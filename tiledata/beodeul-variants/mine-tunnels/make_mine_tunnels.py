# 광산 갱도 (mine-tunnels) — 48x36 던전. 다시 돌리면 같은 그림. python3 make_mine_tunnels.py
import os, sys, json, random, math
MYDIR = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, MYDIR)
import numpy as np
import mt_base as B
from mt_base import *
import mt_pieces as P
import dlib, pz
HERE = MYDIR            # dlib 의 from-import 가 HERE 를 _lib3 로 덮어쓰므로 다시 지정
from scipy import ndimage as ndi

W_, H_ = 48, 36
rnd = random.Random(2077)
m = Map(W_, H_, 'mine-tunnels'); m.cave = False; m.ceil_seed = 5
m.set_style(0, 0, W_, H_, 3, 'mine')

# ------------------------------------------------------------------ 열린 칸 마스크
op = np.zeros((H_, W_), bool); kind = np.full((H_, W_), '', dtype=object)
yy, xx = np.mgrid[0:H_, 0:W_]
def nz(seed, sc=3.0): return np.array([[vnoise(x, y, sc, seed) for x in range(W_)] for y in range(H_)])
N1, N2, N3 = nz(1), nz(2), nz(3)
def rect(x0, y0, x1, y1): op[y0:y1 + 1, x0:x1 + 1] = True
def ell(cx, cy, rx, ry, noise=N1, amp=.30):
    op[:] |= (((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2) < (.92 + amp * (noise - .5) * 2)
# A 입구 홀, B 레일 홀, C 수정 동굴, D 저장고, E 광부 숙소, 복도
ell(11, 28, 8.6, 4.4, N1); rect(3, 27, 5, 29); ell(21, 25, 3.4, 1.6, N3, .2)
ell(22, 16, 9.6, 4.9, N2, .26); rect(14, 14, 18, 18); rect(26, 13, 30, 19)
ell(39.5, 10, 7.4, 6.4, N3, .35)
ell(37, 27, 9.4, 5.2, N2, .30); rect(26, 26, 30, 30)
ell(7, 13, 5.2, 5.6, N1, .30)
for (a, b, c_, d) in [(15, 20, 16, 25), (31, 13, 33, 14), (26, 19, 27, 26), (11, 14, 14, 15), (17, 28, 29, 29)]: rect(a, b, c_, d)
# 열린 칸 위 두 칸이 모두 바위여야 벽 앞면이 두 줄 이상 나온다: 얇은 벽은 깎아서 열어 준다
op[:4, :] = False; op[:, :2] = False; op[:, W_ - 2:] = False; op[H_ - 2:, :] = False
for _ in range(20):
    ch = False
    for y in range(4, H_ - 2):
        for x in range(2, W_ - 2):
            if op[y, x] and not op[y - 1, x] and op[y - 2, x]:
                op[y - 1, x] = True; ch = True
    if not ch: break
# 얇은 바위 기둥(좌우 또는 위아래가 열린 한 칸 벽) 열기
for _ in range(6):
    for y in range(4, H_ - 2):
        for x in range(2, W_ - 2):
            if not op[y, x] and ((op[y, x - 1] and op[y, x + 1]) or (op[y - 1, x] and op[y + 1, x])): op[y, x] = True
# 작은 바위 섬(6칸 이하) 열기
_sl, _sn = ndi.label(~op)
for i in range(1, _sn + 1):
    mk_ = _sl == i
    if mk_.sum() <= 6 and not (mk_[0].any() or mk_[-1].any() or mk_[:, 0].any() or mk_[:, -1].any()): op[mk_] = True
# 입구에서 이어지지 않는 칸 제거(ㅁ자 고립 방 금지) + 한 칸짜리 구멍 메우기
lab, nl = ndi.label(op); op &= (lab == lab[28, 11])
for y in range(1, H_ - 1):
    for x in range(1, W_ - 1):
        if not op[y, x] and op[y - 1, x] and op[y + 1, x] and op[y, x - 1] and op[y, x + 1]: op[y, x] = True
# 바닥 종류
for y in range(H_):
    for x in range(W_):
        if op[y, x]:
            n = N2[y, x]
            kind[y, x] = 'mrock'
rock_mask = op.copy()
def put_kind(mask, k, only=None): 
    for y in range(H_):
        for x in range(W_):
            if mask[y, x] and op[y, x] and (only is None or kind[y, x] in only): kind[y, x] = k
# A: 다져진 운반로 가운데 + 자갈
put_kind(((xx - 11) / 7) ** 2 + ((yy - 28) / 2.2) ** 2 < 1 + (N3 - .5) * .8, 'mpacked')
put_kind(((xx - 22) / 8) ** 2 + ((yy - 16) / 1.9) ** 2 < 1 + (N1 - .5) * .8, 'mpacked')
put_kind((xx >= 14) & (xx <= 16) & (yy >= 14) & (yy <= 27), 'mpacked')
put_kind((xx >= 31) & (xx <= 33) & (yy == 13), 'mpacked')
for (cx, cy, rx, ry) in ((19, 14, 3, 1.6), (26, 18, 3.2, 1.4), (9, 31, 3, 1.3), (14, 25, 1.8, 1.5), (29, 22, 3, 1.8), (42, 24, 2.4, 1.8), (36, 31, 3.2, 1.2), (6, 15, 2.2, 1.8)):
    put_kind(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 < 1 + (N2 - .5) * .7, 'mgravel', only=('mrock',))
# C: 젖은 바닥 + 못
put_kind((((xx - 39.5) / 6.5) ** 2 + ((yy - 10) / 5.5) ** 2 < .9 + (N3 - .5) * .5), 'mwet', only=('mrock', 'mgravel'))
# D: 서쪽 복도 자갈, 동쪽 포장
put_kind((xx >= 17) & (xx <= 29) & (yy >= 28) & (yy <= 29), 'mgravel', only=('mrock', 'mpacked'))
put_kind(((xx - 37) / 6) ** 2 + ((yy - 28) / 2.4) ** 2 < 1 + (N1 - .5) * .6, 'mpacked', only=('mrock', 'mgravel'))
# E: 숙소 포장
put_kind(((xx - 7) / 3.4) ** 2 + ((yy - 13) / 3.6) ** 2 < 1 + (N2 - .5) * .6, 'mpacked', only=('mrock',))
for y in range(H_):
    for x in range(W_):
        if op[y, x]: m.fl[y][x] = str(kind[y, x])
# 물: C 수정 못 (걷기 불가) — 둘레는 젖은 바닥
water = np.zeros((H_, W_), bool)
water |= (((xx - 41.5) / 3.6) ** 2 + ((yy - 12) / 2.3) ** 2 < .95 + (N1 - .5) * .7) & op
for y in range(H_):
    for x in range(W_):
        if water[y, x]: m.fl[y][x] = None; m.wa[y][x] = 'mine'
# 벽 앞면 종류: 대부분 거친 바위, 복도·레일 홀 북쪽은 갱목 널
for y in range(H_):
    for x in range(W_):
        if (x in range(14, 31) and 8 <= y <= 12) or (x in range(15, 17) and 17 <= y <= 24) or (x in range(2, 12) and 7 <= y <= 9): m.sty[y][x] = 'minet'


# ================================================================== 조각 (새로 그린 것) — parts/
PT = Parts('mine-tunnels', HERE)
G = {}
def reg(name, img, kind, ko, desc, rules, **kw):
    G[name] = PT.add(name, img, kind, ko, desc, rules, **kw); return G[name]

# ---- 바닥 표본 3x3 (48x48, 이어 붙여도 이음새 없음)
for k, ko, desc, rules in (
    ('rock', '갱도 바위 바닥', '갱도·동굴의 기본 바닥. 갈라진 따뜻한 회갈색 바위.', '넓은 바닥에 3x3 이상으로 이어 칠한다. 바닥은 하층. 길목은 운반로·자갈 바닥으로 섞어 덩이를 만든다.'),
    ('gravel', '자갈 바닥', '굵은 자갈이 깔린 바닥. 낙반 지대·복도에 쓴다.', '복도·무너진 자리 곁에 덩이로. 일렬 금지.'),
    ('packed', '다져진 운반로', '손수레와 광차가 다니는 따뜻한 흙길 바닥.', '레일·갱도 입구 앞·야영지 바닥. 길 폭 2~4칸 덩이로.'),
    ('wet', '젖은 바위 바닥', '물기 서린 푸른 기 도는 바닥. 반짝이는 물방울.', '못·웅덩이 둘레와 수정 동굴에. 가장자리는 오토타일 「물 번짐」으로 부드럽게.')):
    s48 = B.floor_sample(k)
    reg('ground-' + k, s48, 'floor', ko, desc, rules, pad=False, brows=0)

# ---- 벽 앞면·천장 표본
def face_sample(style, h=3):
    im = new(48, h * T)
    for j in range(h):
        for i in range(3):
            im.alpha_composite(dlib.face_tile(style, None, j, 1 + i, i == 0, i == 2, h * T), (i * T, j * T))
    return im
reg('face_rock', face_sample('mine'), 'wall', '갱도 바위 벽 앞면', '갱도 벽의 앞면 3줄. 위가 밝은 턱, 아래는 어둡고 광맥 점이 박혀 있다.',
    '천장 칸 바로 아래 3줄로 쌓는다(최소 2줄). 천장 없이 단독으로 놓지 않는다. 걷는 칸 북쪽에만.', brows=3)
reg('face_timber', face_sample('minet'), 'wall', '갱목 덧댄 벽 앞면', '널판 갱목을 덧대고 가로 보를 지른 앞면 3줄. 중요한 통로·방 둘레.',
    '복도·방 북쪽 벽에 face_rock 과 섞어 쓴다. 3줄 한 덩이로.', brows=3)
def ceil_sample():
    """바위 덩어리 3x3 (둘레가 모두 열린 칸): 가장자리 8px 밝은 윗면 띠, 한가운데는 어두운 속."""
    im = new(48, 48)
    for j in range(3):
        for i in range(3):
            N_, E_, S_, W_o = j == 0, i == 2, j == 2, i == 0
            o8 = (N_, E_, S_, W_o, (N_ or E_), (S_ or E_), (S_ or W_o), (N_ or W_o))
            im.alpha_composite(dlib.ceiling(o8, i + j), (i * T, j * T))
    return im
reg('ceiling_mine', ceil_sample(), 'wall', '갱도 천장(바위 윗면)', '둘레가 열린 바위 덩어리 3x3 표본: 가장자리 8px 밝은 윗면 띠, 안쪽은 어두운 속(모서리·속 칸 포함).',
    '벽 앞면 3줄 위와 방 둘레 바깥을 이 천장으로 채운다. 열린 쪽만 밝은 띠.', brows=3)

# ---- 물체
def OBJ(name, img, ko, desc, rules, kind='object', **kw): return reg(name, img, kind, ko, desc, rules, **kw)
OBJ('crystal-b1', P.crystal('b', 0), '청록 결정(작은 것)', '바닥에서 솟은 청록 발광 결정 하나.', '젖은 바닥·벽 발치에 2~3개 덩이로. 아랫줄만 막힘, 위는 걷기+가림.', kind='object', brows=1)
OBJ('crystal-b2', P.crystal('b', 1), '청록 결정 무리', '키 큰 청록 결정 두 줄기와 작은 줄기.', '수정 동굴 중심 덩이. 1x2칸, 아랫줄만 막힘.', brows=1)
OBJ('crystal-b3', P.crystal('b', 2), '청록 결정 큰 무리', '세 줄기 큰 결정 무리(가장 큼).', '방당 1~2개. 폭 2칸 아랫줄만 막힘.', brows=1)
OBJ('crystal-v1', P.crystal('v', 1), '보라 결정 무리', '보라색 결정 무리.', '청록과 섞어 덩이로. 1x2칸.', brows=1)
OBJ('crystal-a1', P.crystal('a', 1), '호박색 결정 무리', '호박색 결정 무리. 등불처럼 따뜻한 빛.', '광산 홀·창고 구석에 1~2개. 1x2칸.', brows=1)
OBJ('crystal-a0', P.crystal('a', 0), '호박 결정(작은 것)', '호박색 결정 한 줄기.', '벽 발치·광석 곁 장식. 아랫줄만 막힘.', brows=1)
OBJ('ore-iron', P.ore_pile('iron', 1), '철광석 더미', '푸른 회색 철광석 덩이 더미.', '레일 옆·광차 곁·작업장에. 몸통 줄 1줄 막힘. 2~3개 덩이로.', brows=1)
OBJ('ore-copper', P.ore_pile('copper', 2), '구리 광석 더미', '구리와 청록 녹이 섞인 광석 더미.', '철광석과 섞어 놓는다. 몸통 1줄 막힘.', brows=1)
OBJ('ore-gold', P.ore_pile('gold', 3, 24, 16), '금광석 조각', '금빛 광석이 박힌 작은 더미.', '보물방·궤짝 곁에 1~2개. 몸통 1줄 막힘.', brows=1)
OBJ('boulder', P.boulder(24, 20, 5), '바위 덩이', '둥근 큰 바위 하나.', '길 가장자리에 자연 덩이로 2~3개. 몸통 1줄 막힘.', brows=1)
OBJ('rubble', P.rubble(), '잔돌 무더기', '16x12 잔돌 무더기.', '걷기 가능 땅 장식. 복도 가장자리·낙반 곁에.', kind='decal', brows=0)
OBJ('stalagmite', P.stalagmite(2), '석순', '높은 석순 하나(1x2칸).', '동굴 방에 덩이로. 아랫줄만 막힘.', brows=1)
OBJ('timber-frame', P.timber_frame(3, 3), '갱목 지지대(3칸)', '두 기둥과 윗보로 이뤄진 갱도 지지틀. 가운데는 지나갈 수 있다.', '3칸 폭 통로 입구마다. 양쪽 기둥 칸만 막힘, 윗보는 걷기+가림.', brows=1)
# 폭 4칸 변형(2칸 복도용): 기둥이 바깥 칸 안쪽에
def frame4(): 
    c = Cv(64, 48); wd = WOODX
    for post in (8, 48):
        for y in range(8, 47):
            for dx in range(6):
                k = 5 if dx == 0 else (4 if dx < 3 else (3 if dx < 5 else 2))
                if y % 11 == 0: k -= 1
                c.px(post + dx, y, wd[cl(k, 1, 6)])
        for dx in range(-1, 7): c.px(post + dx, 46, RK[3]); c.px(post + dx, 47, RK[2])
    for x in range(4, 60):
        c.px(x, 2, wd[5]); c.px(x, 3, wd[5] if x % 9 else wd[4])
        for y in range(4, 9):
            c.px(x, y, wd[cl(4 - (1 if y > 6 else 0) - (1 if x > 50 else 0) - (1 if x % 9 == 4 else 0), 1, 6)])
        c.px(x, 9, wd[1])
    for i in range(9): c.px(14 + i, 9 + i, wd[3]); c.px(15 + i, 9 + i, wd[4]); c.px(49 - i, 9 + i, wd[2]); c.px(48 - i, 9 + i, wd[3])
    for (x, y) in ((10, 5), (50, 5), (10, 20), (50, 20)): c.px(x, y, IRON[4])
    return pz.fin(c.im, .6)
OBJ('timber-frame4', frame4(), '갱목 지지대(4칸)', '2칸 복도 입구를 감싸는 넓은 지지틀. 기둥은 복도 양옆 벽 칸에 선다.', '2칸 폭 복도 입구에 놓는다. 기둥 두 칸만 막힘(복도 칸은 열림).', brows=1)
OBJ('lantern-post', P.lantern_post(), '갱도 등불 기둥', '갈고리에 노란 등을 건 나무 기둥(1x2칸).', '입구·교차로·방 모서리에 쌍으로. 아랫줄만 막힘, 위는 걷기+가림. 빛무리는 맵에서 따로 겹친다.', brows=1)
OBJ('minecart', P.minecart(False), '빈 광차', '레일 위에 서는 빈 광차(2x2칸).', '레일 위에 얹는다. 몸통 줄 1줄 막힘. 레일 끝·방 한가운데 피하기.', brows=1)
OBJ('minecart-ore', P.minecart(True, 4), '광석 실은 광차', '광석을 가득 실은 광차.', '레일 위 또는 광석 더미 곁. 몸통 1줄 막힘.', brows=1)
OBJ('ladder', P.ladder(2), '벽 사다리', '벽 앞면에 기대 세운 사다리(1x2칸).', '벽 앞면(천장 밑) 위에 얹는다. 위층 연결 표시, 걷는 칸 위에 두지 않는다.', kind='decal', brows=0)
OBJ('keg-powder', P.barrel_keg('powder'), '화약통', '도화선이 달린 화약통.', '창고 구석에 2~3개 덩이로. 레일·길목은 피한다. 몸통 1줄 막힘.', brows=1)
OBJ('keg-plain', P.barrel_keg('plain'), '나무통', '쇠테 두른 나무통.', '창고·야영지에 덩이로. 몸통 1줄 막힘.', brows=1)
OBJ('crates', P.crate_stack(1, 2), '상자 더미', '쌓아 올린 나무 상자 둘.', '벽 발치에 붙여서. 몸통 1줄 막힘.', brows=1)
OBJ('chest', P.chest(), '광부 궤짝', '쇠띠 두른 작은 궤짝.', '창고·야영지 구석에 하나씩. 몸통 1줄 막힘.', brows=1)
OBJ('pickaxe-stand', P.pickaxe_stand(), '곡괭이 걸이', '곡괭이 둘과 삽을 기대 세운 걸이(1x2칸).', '작업장·입구 벽 곁에. 아랫줄만 막힘.', brows=1)
OBJ('wheelbarrow', P.wheelbarrow(), '광석 손수레', '광석 실은 외바퀴 수레(2x1칸).', '운반로 곁에. 길 한가운데는 피한다. 막힘 1줄.', brows=1)
OBJ('mine-mouth', P.mine_mouth(), '갱도 입구', '갱목 틀과 어두운 아치, 바깥 빛이 새는 입구(3x3칸).', '벽 앞면 3줄 자리에 맞춰 얹는다(아랫줄이 바닥에 닿음). 입구 앞 한 칸은 길. 출입 이벤트 칸으로 쓴다.', brows=3)
OBJ('cave-in', P.cave_in(), '붕괴 갱도', '무너진 바위와 부러진 갱목이 복도를 막은 자리(3x3칸).', '2칸 높이 복도 끝을 막을 때 쓴다. 아래 2줄 막힘(통로 폐쇄), 위는 벽 앞면에 걸친다.', brows=2)
OBJ('shaft-hole', P.shaft_hole(), '수직 갱', '나무 테두리 구멍과 도르래 틀(2x3칸). 구멍은 걸을 수 없다.', '넓은 방 한쪽에. 아래 2줄 막힘, 도르래 틀은 가림. 곁에 감개(winch)와 짝.', brows=2)
OBJ('winch', P.winch(), '갱 감개', '밧줄을 감는 나무 감개 틀(2x2칸).', '수직 갱 곁에. 몸통 1줄 막힘.', brows=1)
OBJ('timber-stack', P.timber_stack(), '갱목 더미', '둥근 단면이 보이는 갱목 더미(2x1칸).', '창고 벽 곁. 몸통 1줄 막힘.', brows=1)
OBJ('rail-buffer', P.rail_buffer(), '레일 끝막이', '레일 끝에 세우는 쇠 완충대.', '레일이 막다른 곳에 한 칸. 막힘 1줄.', brows=1)
OBJ('stairs-down', P.stairs_hole(), '내려가는 계단', '바닥에서 아래로 내려가는 돌 계단(2x1칸, 위에서 본 모양).', '벽 곁 바닥에 놓고 이벤트(이동) 칸으로 쓴다. 위에 물체를 얹지 않는다.', kind='walk', brows=0)
OBJ('ore-vein', P.ore_vein_wall(1), '청록 광맥', '벽 앞면에 박힌 청록 결정 조각.', '벽 앞면 위에 얹는 장식(걷는 칸 위 금지). 한 줄에 두세 개 간격을 두고.', kind='decal', brows=0)
OBJ('ore-vein-amber', P.ore_vein_wall(2, 'a'), '호박 광맥', '벽 앞면에 박힌 호박색 결정 조각.', '벽 앞면 위 장식. 청록 광맥과 섞는다.', kind='decal', brows=0)
OBJ('hanging-chain', P.hanging_chain(), '늘어진 쇠사슬', '벽 앞면에서 늘어진 쇠사슬(8x32).', '벽 앞면 위 장식. 땅 위에 두지 않는다.', kind='decal', brows=0)
OBJ('spiderweb', P.spiderweb(1), '거미줄', '모서리에 걸린 거미줄(16x16).', '방 모서리·벽 발치 장식.', kind='decal', brows=0)
OBJ('puddle', P.puddle(2, 1, 3), '물웅덩이', '푸른 물이 고인 웅덩이(2x1칸). 걸을 수 있는 얕은 물.', '젖은 바닥·벽 발치에 덩이로. 하층 장식.', kind='decal', brows=0)
OBJ('puddle-small', P.puddle(1, 1, 5), '작은 물웅덩이', '작은 물방울 웅덩이.', '큰 웅덩이 곁에 흩뿌린다.', kind='decal', brows=0)
OBJ('miner-bones', P.bones_miner(), '광부 유골', '낡은 헬멧을 쓴 유골.', '붕괴 갱도·막다른 곳에. 땅 위 장식.', kind='decal', brows=0)

# ---- 16변형 오토타일 (칸 번호 = 위1 + 오른쪽2 + 아래4 + 왼쪽8)
rails = autotile_sheet(P.rails_cell)
reg('autotile-rails', rails, 'autotile', '광차 레일', '침목과 쇠 레일 두 줄. 이웃 방향으로 곧게·꺾이게·갈라지게 이어지는 16변형 투명 오토타일.',
    '걷는 바닥 위에 덧그린다(바닥을 지우지 않음). 레일 위는 걸을 수 있다. 막다른 끝에는 rail-buffer. 광차는 레일 위에.', layer='upper', role='terrain', pad=False)
wet = autotile_sheet(P.wet_cell)
reg('autotile-wet', wet, 'autotile', '물 번짐', '젖은 바위가 번지는 반투명 푸른 얼룩 16변형. 이웃 없는 쪽은 들쭉날쭉.',
    '웅덩이·못 둘레 바닥에 덩이로 칠한다(3칸 이상). 바닥을 지우지 않는 투명 덮개. 걸을 수 있음.', layer='lower', role='terrain', pad=False)
rub = autotile_sheet(P.rubble_cell)
reg('autotile-rubble', rub, 'autotile', '낙반 자갈 번짐', '잔돌이 흩어진 낙반 자갈 덮개 16변형. 이웃 쪽으로 이어질수록 촘촘.',
    '붕괴 갱도·무너진 벽 발치에 덩이로. 투명 덮개, 걸을 수 있음.', layer='lower', role='terrain', pad=False)

# ================================================================== 맵 배치
m.compute_faces()
occ = np.zeros((H_, W_), bool)          # 물체가 차지한 칸 (빈칸 계산·겹침 검사)
wat = np.array([[m.wa[y][x] is not None for x in range(W_)] for y in range(H_)])
def is_open(x, y): return 0 <= x < W_ and 0 <= y < H_ and m.fl[y][x] is not None
SKIP = []
def cellsof(img): return -(-img.width // T), -(-img.height // T)
def place(img, x, y, block='bottom', name='', check=True, layer=1, over=0):
    """img 왼쪽 아래 칸이 (x,y). block: 'bottom'(맨 아랫줄만) / int n(아래 n줄) / list of (dx,dy) / None."""
    cw, ch = cellsof(img)
    foot = [(x + i, y) for i in range(cw)]
    if check:
        if not all(is_open(a, b) and not occ[b, a] for (a, b) in foot):
            SKIP.append((name, x, y)); return False
    if block == 'bottom': blk = [(i, 0) for i in range(cw)]
    elif isinstance(block, int): blk = [(i, -j) for i in range(cw) for j in range(block)]
    else: blk = block or []
    m.props_add(x, y, img, blk, layer)
    for (a, b) in foot: occ[b, a] = True
    for j in range(ch):
        for i in range(cw):
            if 0 <= y - j < H_ and x + i < W_ and (j <= over or True) and is_open(x + i, y - j): occ[y - j, x + i] = True
    return True
def put_decal(img, x, y, name=''):
    if not is_open(x, y) or wat[y, x]: SKIP.append((name, x, y)); return False
    m.decal(x, y, img); return True
def glow(cx, cy, col, a=60, size=48): m.glow_at(cx + .5, cy + .5, dlib_glow(size, col, a))
from dprops import glow as dlib_glow
def top_open(x, y0=0):
    for y in range(y0, H_):
        if is_open(x, y): return y

# ---- 레일 (위층 덧그림)
RAILS = set()
def rpath(*pts):
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if x0 == x1:
            for y in range(min(y0, y1), max(y0, y1) + 1): RAILS.add((x0, y))
        else:
            for x in range(min(x0, x1), max(x0, x1) + 1): RAILS.add((x, y0))
rpath((4, 28), (15, 28), (15, 14), (33, 14))
rpath((27, 14), (27, 28), (35, 28))
rm = np.zeros((H_, W_), bool)
for (x, y) in RAILS:
    if not is_open(x, y): print('레일이 막힌 칸', x, y)
    rm[y, x] = True
for y, row in enumerate(autotile_layout(rm)):
    for x, n in enumerate(row):
        if n is not None and is_open(x, y): m.decal(x, y, autotile_cell(rails, n))

# ---- 앵커 1: 갱도 입구 (A 북벽)
mx = 6; mb = top_open(7, 20) - 1
print('mouth bottom', mb, [(x, y) in m.face for x in (6, 7, 8) for y in (mb - 2, mb - 1, mb)])
mouth = G['mine-mouth']
m.props_add(mx, mb, mouth, [(i, 0) for i in range(3)], 1)
for (a, b) in [(mx + i, mb - j) for i in range(3) for j in range(3)]: occ[b, a] = True
m.marks['exit'] = (7, mb + 1)

# ---- 배치 도구 (덩이로, 통행이 끊기면 취소)
rr = random.Random(4242)
def reach_count():
    seen = set(); st = [(7, 25)]
    while st:
        x, y = st.pop()
        if (x, y) in seen or not m.is_walk(x, y): continue
        seen.add((x, y))
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)): st.append((x + dx, y + dy))
    return len(seen)
m.marks['entrance'] = (7, top_open(7, 20))
START = m.marks['entrance']
def reach_count():
    seen = {START}; st = [START]
    while st:
        x, y = st.pop()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (x + dx, y + dy)
            if n not in seen and m.is_walk(*n): seen.add(n); st.append(n)
    return len(seen)
def total_walk(): return sum(1 for y in range(H_) for x in range(W_) if m.is_walk(x, y))
def safe_place(img, x, y, block='bottom', name='', allow_rail=False, margin=0, **kw):
    cw, ch = cellsof(img)
    if not allow_rail and any((x + i, y) in RAILS for i in range(cw)): return False
    # 열린 칸 둘레 한 칸은 비워 둔다(복도 막힘 방지) — 레일은 예외
    before = reach_count(); tw = total_walk()
    sp, sb, so = len(m.props), set(m.blocked), occ.copy()
    if not place(img, x, y, block, name, **kw): return False
    if reach_count() != total_walk() or total_walk() < tw - 8:
        del m.props[sp:]; m.blocked = sb; occ[:] = so; SKIP.append((name + '(통행)', x, y)); return False
    return True
def cluster(cx, cy, rx, ry, items, n, tries=60, **kw):
    done = 0
    for _ in range(tries):
        if done >= n: break
        img, name, opts = rr.choice(items)
        x = int(round(cx + rr.uniform(-rx, rx))); y = int(round(cy + rr.uniform(-ry, ry)))
        if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 > 1.0: continue
        o = dict(opts); o.update(kw)
        if safe_place(img, x, y, name=name, **o): done += 1
    return done
def wall_base(x0, x1, y0, y1, north_solid=True):
    out = []
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if is_open(x, y) and not is_open(x, y - 1) and not wat[y, x] and (x, y) not in RAILS: out.append((x, y))
    return out
def wall_place(img, region, name, n=1, **o):
    cells = wall_base(*region); rr.shuffle(cells); done = 0
    for (x, y) in cells:
        if done >= n: break
        if safe_place(img, x, y, name=name, **o): done += 1
    return done
def glowhere(x, y, col, a=60, size=48): m.glow_at(x + .5, y - .2, dlib_glow(size, col, a))
def I(name, **o): return (G[name], name, o)

# ============ A 입구 홀
yA = top_open(5, 20)
lantern = G['lantern-post']
for lx in (5, 9):
    ty = top_open(lx, 20)
    if place(lantern, lx, ty, name='lantern'): glowhere(lx, ty - 1, (255, 190, 90), 80, 56)
for (nm, reg_) in (('pickaxe-stand', (11, 13, 24, 27)), ('crates', (12, 17, 24, 28)), ('keg-powder', (12, 18, 24, 28)), ('keg-plain', (10, 18, 24, 28))):
    wall_place(G[nm], reg_, nm, n=1)
safe_place(G['minecart'], 10, 29, name='minecart', allow_rail=True)
safe_place(G['wheelbarrow'], 13, 31, name='wheelbarrow')
cluster(8, 30, 4, 1.6, [I('ore-iron'), I('boulder'), I('stalagmite')], 3)
cluster(16, 30, 3, 1.6, [I('ore-copper'), I('boulder'), I('timber-stack')], 3)
cluster(5, 29, 2, 1.5, [I('timber-stack'), I('stalagmite'), I('crystal-a0')], 2)

# ============ B 레일 홀 (갱목 지지대 두 쌍 + 광차 + 광석)
for fx, fy in ((14, 22), (25, 22)):
    if place(G['timber-frame4'], fx, fy, block=[(0, 0), (3, 0)], name='timber-frame4', check=False):
        for (a, b) in [(fx + i, fy - j) for i in range(4) for j in range(3) if is_open(fx + i, fy - j)]: occ[b, a] = True
safe_place(G['minecart-ore'], 20, 14, name='minecart-ore', allow_rail=True)
safe_place(G['minecart'], 23, 15, name='minecart', allow_rail=True)
for lx, ly in ((18, top_open(18, 10)), (26, top_open(26, 10)), (30, top_open(30, 10))):
    if place(lantern, lx, ly, name='lantern'): glowhere(lx, ly - 1, (255, 190, 90), 80, 56)
cluster(21, 17, 3.6, 1.6, [I('ore-iron'), I('ore-copper'), I('boulder'), I('crystal-a0')], 4)
cluster(17, 17, 2, 1.4, [I('boulder'), I('stalagmite')], 2)
cluster(29, 17, 2.2, 1.6, [I('ore-iron'), I('boulder'), I('stalagmite')], 3)
wall_place(G['pickaxe-stand'], (19, 25, 11, 14), 'pickaxe-stand')
wall_place(G['crates'], (21, 24, 11, 13), 'crates')
wall_place(G['crystal-a1'], (14, 16, 12, 16), 'crystal-a1')

# ============ C 수정 동굴
GCY = (80, 240, 220)
for (cx_, cy_, nm) in ((36, 6, 'crystal-b3'), (44, 8, 'crystal-b2'), (35, 10, 'crystal-v1'), (37, 15, 'crystal-b2'), (45, 15, 'crystal-v1'), (43, 6, 'crystal-b1')):
    ty = None
    for dy in range(0, 4):
        for dx in (0, 1, -1, 2, -2):
            if safe_place(G[nm], cx_ + dx, cy_ + dy, name=nm): ty = (cx_ + dx, cy_ + dy); break
        if ty: break
    if ty: glowhere(ty[0] + (cellsof(G[nm])[0] - 1) / 2.0, ty[1] - 1, GCY if nm.startswith('crystal-b') else (190, 140, 250), 38, 40)
cluster(40, 10, 6, 4.5, [I('crystal-b1'), I('crystal-b1'), I('stalagmite'), I('boulder')], 5)
cluster(42, 7, 4, 2, [I('crystal-a0'), I('crystal-b1')], 2)
safe_place(G['rail-buffer'], 34, 14, name='rail-buffer', allow_rail=True)
for lx in (33, 35):
    ty = top_open(lx, 8)
    if ty and ty < 20 and is_open(lx, ty): 
        pass
wall_place(G['crystal-b1'], (33, 46, 4, 8), 'crystal-b1', n=3)
put_decal(G['miner-bones'], 38, 14, 'bones')
place(lantern, 34, 13, name='lantern', check=True) and glowhere(34, 12, (255, 190, 90), 80, 56)

# ============ D 저장고
safe_place(G['shaft-hole'], 40, 30, block=[(0, 0), (1, 0), (0, -1), (1, -1)], name='shaft-hole')
safe_place(G['winch'], 37, 30, name='winch') or safe_place(G['winch'], 36, 31, name='winch')
for (nm, n_) in (('keg-powder', 3), ('keg-plain', 2), ('crates', 3), ('chest', 1), ('timber-stack', 2), ('pickaxe-stand', 1), ('ore-gold', 1)):
    wall_place(G[nm], (30, 45, 22, 25), nm, n=n_)
cluster(33, 30, 3.2, 1.5, [I('ore-iron'), I('wheelbarrow'), I('boulder')], 3)
cluster(44, 25, 2.5, 2, [I('crystal-a1'), I('crystal-a0'), I('boulder')], 3)
cluster(30, 24, 2.5, 1.4, [I('keg-powder'), I('crates')], 2)
for lx in (31, 43):
    ty = top_open(lx, 22)
    if place(lantern, lx, ty, name='lantern'): glowhere(lx, ty - 1, (255, 190, 90), 80, 56)
put_decal(G['stairs-down'], 44, 28, 'stairs'); m.marks['stairs_down'] = (44, 28)
# 붕괴 갱도: 서쪽 지름길 막기
cav = G['cave-in']
if place(cav, 22, 29, block=[(i, -j) for i in range(3) for j in range(2)], name='cave-in', check=False):
    for (a, b) in [(22 + i, 29 - j) for i in range(3) for j in range(2)]: occ[b, a] = True
put_decal(G['miner-bones'], 21, 29, 'bones')

# ============ E 광부 숙소
place(lantern, 6, top_open(6, 8), name='lantern', check=True) and glowhere(6, top_open(6, 8) - 1, (255, 190, 90), 80, 56)
for (nm, n_) in (('keg-plain', 1), ('crates', 1), ('chest', 1), ('pickaxe-stand', 1)):
    wall_place(G[nm], (3, 11, 8, 12), nm, n=n_)
cluster(7, 15, 3, 2.5, [I('wheelbarrow'), I('ore-iron'), I('boulder'), I('stalagmite')], 3)

# ---- 땅 장식: 물웅덩이·거미줄·잔돌·젖은 번짐
def deco_cluster(img, cx, cy, rx, ry, n, name):
    d = 0
    for _ in range(60):
        if d >= n: break
        x = int(round(cx + rr.uniform(-rx, rx))); y = int(round(cy + rr.uniform(-ry, ry)))
        if is_open(x, y) and not occ[y, x] and not wat[y, x] and (x, y) not in RAILS and put_decal(img, x, y, name): d += 1; occ[y, x] = True
WETM = np.zeros((H_, W_), bool); RUBM = np.zeros((H_, W_), bool)
def blobmask(M, cx, cy, rx, ry, seed):
    for y in range(H_):
        for x in range(W_):
            if is_open(x, y) and not wat[y, x] and (x, y) not in RAILS and not occ[y, x] and ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1 + (vnoise(x, y, 2.5, seed) - .5) * .8: M[y, x] = True
for (cx, cy) in ((22, 18), (17, 31), (36, 31), (9, 13)):
    blobmask(WETM, cx, cy, 2.2, 1.6, cx * 3 + cy)
    deco_cluster(G['puddle'], cx, cy, 1.5, 1, 1, 'puddle')
for (cx, cy) in ((40, 14), (36, 9), (44, 10)): blobmask(WETM, cx, cy, 2.4, 1.8, cx + cy)
deco_cluster(G['puddle-small'], 40, 12, 6, 4, 4, 'puddle-small')
for (cx, cy) in ((20, 28), (25, 28), (16, 24), (30, 18)): blobmask(RUBM, cx, cy, 1.9, 1.3, cx + cy * 5)
for y, row in enumerate(autotile_layout(WETM)):
    for x, n in enumerate(row):
        if n is not None: m.decal(x, y, autotile_cell(wet, n))
for y, row in enumerate(autotile_layout(RUBM)):
    for x, n in enumerate(row):
        if n is not None: m.decal(x, y, autotile_cell(rub, n))
deco_cluster(G['rubble'], 12, 30, 7, 2, 3, 'rubble'); deco_cluster(G['rubble'], 22, 17, 8, 2, 3, 'rubble'); deco_cluster(G['rubble'], 36, 28, 6, 2, 3, 'rubble')
# 거미줄: 북서 모서리 (위·왼쪽이 바위)
webs = [(x, y) for y in range(H_) for x in range(W_) if is_open(x, y) and not is_open(x, y - 1) and not is_open(x - 1, y) and not occ[y, x] and not wat[y, x]]
for (x, y) in webs[:6]: put_decal(G['spiderweb'], x, y, 'web')
# 벽 앞면 장식: 광맥·쇠사슬
faces_lo = sorted([(x, y) for (x, y) in m.face if is_open(x, y + 1) and m.face[(x, y)][1] == 1], key=lambda p: (p[1], p[0]))
rr.shuffle(faces_lo); nv = 0; used_f = set()
for (x, y) in faces_lo:
    if nv >= 14: break
    if any(abs(x - a) < 3 and abs(y - b) < 3 for (a, b) in used_f) or (x in (6, 7, 8) and y > 20 and y < 25): continue
    if m.sty[y][x] == 'minet' and nv % 2: continue
    m.decal(x, y, G['ore-vein'] if (nv % 3) else G['ore-vein-amber']); used_f.add((x, y)); nv += 1
nc = 0
for (x, y) in faces_lo:
    if nc >= 4: break
    if m.sty[y][x] == 'minet' and (x, y - 1) in m.face and (x, y) not in used_f and not any(abs(x - a) < 4 for (a, b) in used_f if b == y):
        m.decal(x, y - 1, G['hanging-chain']); used_f.add((x, y)); nc += 1
# 사다리: C 북벽
for (x, y) in faces_lo:
    if x in range(36, 46) and y < 8 and (x, y - 1) in m.face and (x, y) not in used_f:
        m.decal(x, y - 1, G['ladder']); m.marks['ladder_up'] = (x, y + 1); break

# ================================================================== 검사·저장
decor = np.zeros((H_, W_), bool)
for (x, y, img, w, h, layer) in m.props:
    cw, ch = cellsof(img)
    for j in range(ch):
        for i in range(cw):
            if 0 <= y - j < H_ and x + i < W_: decor[y - j, x + i] = True
for (x, y, img) in m.decals:
    x, y = int(x), int(y)
    if img.width >= T and img.height >= T and img.getbbox() and (img.width > T or img.height > T or (np.array(img)[..., 3] > 0).mean() > .25): decor[y, x] = True
for (x, y) in RAILS: decor[y, x] = True
walk = np.array(m.walk_grid(), bool)
op_cells = np.array([[m.fl[y][x] is not None or m.wa[y][x] is not None for x in range(W_)] for y in range(H_)])
decor |= np.array([[m.wa[y][x] is not None for x in range(W_)] for y in range(H_)])
# 구조 칸(벽·천장)은 「채워진 칸」: 열린 칸 중 장식 없는 칸만 빈칸
from wavekit import empty_windows
ew = empty_windows(decor, op_cells)
print('빈칸 최악 창 %.1f%% at %s' % (ew[0] * 100, ew[1:]))
worst_over = [(x, y, round(float((op_cells[y:y + 15, x:x + 20] & ~decor[y:y + 15, x:x + 20]).sum() / 300.), 2)) for y in range(0, H_ - 14, 3) for x in range(0, W_ - 19, 4)]
print('40%초과 창', sum(1 for a in worst_over if a[2] > .4))
MARKS = {'entrance': START, 'mine_mouth(exit)': (7, 25), 'rail_hall': (22, 15), 'crystal_cave': (38, 8), 'depot': (36, 26), 'shaft': (40, 31), 'stairs_down': (44, 28), 'camp': (7, 15), 'ladder': m.marks.get('ladder_up', (40, 5))}
ok_, nreach, _s = bfs_reach(walk, START, {k: v for k, v in MARKS.items() if k != 'entrance'})
print('BFS', ok_, 'reach', nreach, 'walk', int(walk.sum()))

# ---- 저장: 조각·메타·렌더·격자
kinds = PT.save()
img = m.render()
img.convert('RGB').save(os.path.join(HERE, 'render-1x.png'))
img.convert('RGB').resize((img.width * 2, img.height * 2), Image.NEAREST).save(os.path.join(HERE, 'render-2x.png'))
grid = dict(w=W_, h=H_, tile=16, entrance=list(START), legend='1=막힘(벽·물·소품), 0=걸음',
            blocked=[[0 if walk[y, x] else 1 for x in range(W_)] for y in range(H_)], marks={k: list(v) for k, v in MARKS.items()},
            reachable=nreach, walkable=int(walk.sum()), unreachable=[k for k, v in ok_.items() if not v], emptiness_worst=round(float(ew[0]), 3), over40=sum(1 for a in worst_over if a[2] > .4))
json.dump(grid, open(os.path.join(HERE, 'grid.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
print('조각', len(PT.items), dict(kinds), '| skip', len(SKIP))

# ---- 벽 앞면 검사: 열린 칸 위가 바위면 앞면이 2줄 이상 있어야 한다
bad_face = []
for y in range(H_):
    for x in range(W_):
        if m.open(x, y) and not m.open(x, y - 1):
            chain = m.face.get((x, y - 1))
            if not chain or chain[2] < 2: bad_face.append((x, y))
print('앞면 2줄 미만', len(bad_face), bad_face[:6])
comps = m.components(); print('걷는 덩어리', len(comps), [len(c) for c in comps][:4])

# ---- 시각 검증 페이지 (~/claude-viz/beodeul-wave-mine-tunnels.html)
if os.environ.get('NOPAGE') != '1':
    items = [(n, im) for n, (im, mt) in PT.items.items()]
    notes = ('<b>QA 기록</b>: 아래 plan.md 의 적대적 검수 목록과 같다. 통행 BFS: 입구→%d곳 전부 도달(걸음 %d/%d). 빈칸 최악 창 %.1f%%(≤40%%). 천장 밑 앞면 2줄 미만 %d곳.' % (len(ok_), nreach, int(walk.sum()), ew[0] * 100, len(bad_face)))
    os.makedirs(os.path.expanduser('~/claude-viz'), exist_ok=True)
    n_ = build_page(os.path.expanduser('~/claude-viz/beodeul-wave-mine-tunnels.html'), '버들항 웨이브 C — 광산 갱도 (mine-tunnels)',
        '48x36칸 던전. 입구 홀 → 레일 홀 → 수정 동굴 / 저장고(수직 갱·계단) / 광부 숙소. 새 조각 %d개.' % len(PT.items), img.convert('RGB'),
        [('입구 홀과 레일 홀 (왼쪽 아래)', (0, 280, 400, 576)), ('수정 동굴 (오른쪽 위)', (400, 0, 768, 290))], items,
        [('광차 레일 (autotile-rails)', rails), ('물 번짐 (autotile-wet)', wet), ('낙반 자갈 (autotile-rubble)', rub)], np.array(grid['blocked'], bool), notes)
    print('page', n_)
