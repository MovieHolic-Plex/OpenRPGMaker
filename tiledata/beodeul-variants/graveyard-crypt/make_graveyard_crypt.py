# 버들항 웨이브 B-① 공동묘지 + 지하 묘소. 다시 돌리면 같은 그림이 나온다.
#   python3 make_graveyard_crypt.py   (parts/, partmeta.json, parts.md, render-1x/2x.png, grid.json, 시각 페이지)
import os, sys, json, random
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from gc_kit import *
from gc_kit import _hash
import gc_art1 as A1, gc_art2 as A2, gc_art3 as A3, gc_art4 as A4, gc_atiles as AT
from gc_ext import *
from gc_map import KMap, foot
import gc_page
import dlib, dfill, dcheck

kit = Kit('graveyard-crypt', '공동묘지와 지하 묘소')
OUT = os.path.dirname(os.path.abspath(__file__))
assert OUT.endswith('graveyard-crypt')

# ---------------------------------------------------------------- 조각 그리기·등록
S = {}
def obj(name, img, ko, desc, rules, brows=1, kind='object', **kw):
    S[name] = img; kit.add(name, img, kind, ko, desc, rules, brows, **kw); return img

TREE = 'tree'
obj('tomb_round', A1.tomb_round(), '둥근 비석', '둥근 머리의 낮은 돌 비석, 이끼가 낀다.', '1칸, 막힘 1줄. 가족 묘역 안에 3~5개 덩이로, 줄 세우지 말고 비스듬한 간격으로. 길 한가운데 금지.')
obj('tomb_cross', A1.tomb_cross(), '십자 비석', '계단 받침 위의 가는 돌 십자가(가로대 윗면이 보인다).', '1×2칸, 아랫줄만 막힘. 묘역마다 1~2개, 둥근 비석 사이에 섞는다.')
obj('tomb_slab', A1.tomb_slab(), '판석 비석', '봉분 앞에 세운 윗면이 뾰족한 판석 비석.', '1칸, 막힘 1줄. 봉분이 앞에 붙어 있으므로 위쪽(북)에 빈 칸 하나를 두고 놓는다.')
obj('obelisk', A1.obelisk(), '오벨리스크', '사각 첨탑형 기념비(1×3), 아랫쪽에 이끼.', '1×3칸, 아랫줄만 막힘(윗칸은 걷기+가림). 묘역마다 최대 1개, 가장자리 쪽에 놓는다.')
obj('mourner', A1.mourner(), '두건 쓴 조상', '두건을 쓰고 손을 모은 얼굴 없는 석상.', '1×2칸, 아랫줄만 막힘. 묘역 안쪽 모서리나 길 끝 안내용으로 쓴다.')
obj('crypt_chest_tomb', A1.crypt_chest_tomb(), '상자 무덤', '십자 홈이 새겨진 큰 돌 상자 무덤(윗면+앞면).', '2×2칸, 아래 2줄 막힘. 묘역 중앙 가까이에 1개. 둘레 앞쪽 한 칸은 비운다.', brows=2)
obj('grave_mound', A1.grave_mound(), '봉분과 나무 십자', '흙 봉분에 나무 십자가를 꽂은 옛 무덤.', '1칸, 막힘 1줄. 비석 가까이에 붙여 덩이로, 가난한 묘역 구석에 많이 쓴다.')
obj('open_grave', A1.open_grave(), '파 놓은 무덤', '구덩이와 오른쪽 흙더미, 꽂힌 삽(2×2).', '2×2칸, 아래 2줄 막힘(구덩이). 사건 장소 앵커용으로 맵당 1~2개. 길 위 금지.', brows=2)
obj('urn_pedestal', A1.urn_pedestal(), '항아리 받침', '사각 받침 위의 붉은 띠 장례 항아리.', '1×2칸, 아랫줄만 막힘. 묘역 입구 양쪽에 쌍으로 쓰거나 단독으로.')
obj('dead_tree', A2.dead_tree(), '고목', '잎 없는 큰 고목, 옹이 구멍과 휜 가지(2×3).', '2×3칸, 맨 아랫줄(줄기 두 칸)만 막힘. 가지 칸은 걷기+가림. 맵 모서리·묘역 뒤에 덩이로 2~3그루, 일렬 금지.', kind='tree')
obj('dead_tree_small', A2.dead_tree_small(), '작은 고목', '가지만 남은 키 작은 고목(1×2).', '1×2칸, 아랫줄만 막힘. 큰 고목 옆 보조 또는 담 가까이.', kind='tree')
obj('stump', A2.gnarled_stump(), '나이테 그루터기', '베어 낸 나무 그루터기, 윗면 나이테가 보인다.', '1칸, 막힘 1줄. 고목 곁에 한 개씩.')
obj('lamp_post', A2.lamp_post(), '푸른 불 가로등', '철제 기둥과 푸른 불꽃 유리등(1×3).', '1×3칸, 아랫줄만 막힘. 길 가장자리에서 한 칸 띄워 5~7칸 간격으로, 길 맞은편은 어긋나게. 빛무리(lamp_glow)를 겹쳐도 좋다.')
obj('crypt_gate', A2.crypt_gate(), '가족 납골 철문', '돌 아치와 쇠창살 잠긴 납골문(3×3).', '3×3칸, 아래 2줄 막힘. 담/벽 앞에 붙여 쓴다. 안으로 통하지 않는 장식 문.', brows=2)
obj('mausoleum', A2.mausoleum(), '영묘', '평지붕 윗면과 기둥 둘, 닫힌 어두운 문의 작은 영묘(6×4). 지붕 두 줄은 걷기+가림.', '6×4칸, 아래 2줄(앞면) 막힘. 문 앞 두 칸에 mausoleum_steps 를 놓고 그 앞은 길로 비운다. 맵당 1개 앵커.', brows=2)
obj('mausoleum_steps', A2.mausoleum_steps(), '영묘 계단', '영묘 문 앞 두 단 돌계단(2×1).', '2×1칸, 걷기. 영묘 문(앞면 가운데 두 칸) 바로 아래에 붙인다.', brows=0, kind='walk')
obj('cypress', A4.cypress(), '사이프러스', '좁고 어두운 불꽃 모양 침엽수(1×3).', '1×3칸, 아랫줄(줄기)만 막힘. 담 안쪽·길 끝에 2~3그루 덩이, 줄 세우기 금지.', kind='tree')
obj('tomb_leaning', A4.tomb_leaning(), '기운 비석', '오른쪽으로 기운 낡은 비석과 풀.', '1칸, 막힘 1줄. 오래된 구석에 흩뿌린다.')
obj('stone_bench', A4.stone_bench(), '돌 벤치', '두 받침 위에 판석을 얹은 묘지 벤치(2×1).', '2×1칸, 두 칸 막힘. 길가에 쉼터 앵커로 1개.')
obj('sarcophagus_carved', A3.sarcophagus_carved(), '조각 석관', '십자 능선 뚜껑과 앞면 홈 부조의 석관(2×2).', '2×2칸, 아래 2줄 막힘. 지하 묘실 벽 쪽에 1~2개씩 덩이로, 앞 한 칸은 비운다.', brows=2)
obj('coffin_wood', A3.coffin_wood(), '나무 관', '못 박힌 쇠띠 둘린 나무 관(2×2, 윗면 육각).', '2×2칸, 아래 2줄 막힘. 납골실에 흩어 놓는다.', brows=2)
obj('candelabra', A3.candelabra(), '푸른 촛대', '세 갈래 쇠 촛대와 푸른 불꽃(1×2).', '1×2칸, 아랫줄만 막힘. 방 모서리·석관 양쪽에 놓는다. 빛무리와 함께.')
obj('statue_angel', A3.statue_angel(), '날개 천사 석상', '날개 접은 천사 석상과 사각 받침(2×3).', '2×3칸, 아랫줄 두 칸 막힘(받침), 위는 걷기+가림. 광장 중앙·묘실 중앙 앵커로 1개.', kind='object')
obj('gargoyle', A3.gargoyle(), '가고일', '붉은 눈의 웅크린 돌 짐승(1×1.5).', '1×2칸 이미지(아래 1칸 막힘). 방 모서리나 문 양옆에 쌍으로.')
obj('bone_pile', A3.bone_pile(), '해골 더미', '해골 셋과 정강이뼈 X(1×1).', '1칸, 걷기 가능한 장식(막지 않는다). 지하 바닥에 덩이로.', brows=0, kind='decal')
obj('wall_cross', A3.wall_cross(), '벽 십자 부조', '벽 앞면에 새긴 십자 홈.', '1칸 장식(앞면 위). 벽 앞면 칸에만 얹는다.', brows=0, kind='decal')
obj('wall_sconce', A3.wall_sconce(), '푸른 벽 횃불', '벽 앞면의 쇠 고리 횃불과 푸른 불꽃.', '1칸 장식(앞면 위). 방마다 6~8칸 간격, 빛무리와 함께.', brows=0, kind='decal')
obj('wall_niche_stack', A3.wall_niche_stack(), '납골 칸', '관 끝과 해골이 보이는 벽 속 2단 칸(1×2).', '1×2칸 장식(앞면 위, 앞면 2줄 필요). 벽 앞면에 줄지어 붙이되 횃불 사이를 섞는다.', brows=0, kind='decal')
obj('iron_door', A3.iron_door(), '묘소 철문', '자물쇠 달린 띠 철판 아치문(1×2).', '1×2칸 장식(앞면 위). 닫힌 문. 통로 쪽 벽 앞면 칸에만.', brows=0, kind='decal')
obj('cobweb', A3.cobweb(), '거미줄', '벽 모서리에서 퍼지는 반투명 거미줄.', '1칸 장식(앞면 위, 앞면의 왼쪽 위 모서리). 방 구석에만.', brows=0, kind='decal')
obj('crypt_stairs', A3.crypt_stairs(), '지하 계단 입구', '어둠으로 내려가는 돌 계단 입구(2×2).', '2×2칸, 걷기. 지상에서 지하 통로가 시작되는 칸에 얹고 아래로 계단 통로를 잇는다.', brows=0, kind='walk')
obj('wilted_flowers', A3.wilted_flowers(), '시든 꽃다발', '무덤 앞에 놓인 시든 붉은 꽃다발.', '1칸, 걷기 가능한 장식. 비석 앞 칸에 놓는다.', brows=0, kind='decal')
obj('raven_tomb', A3.raven_tomb(), '까마귀 앉은 비석', '비석 위에 앉은 검은 까마귀.', '1칸, 막힘 1줄. 묘역에 1개 정도만.')
obj('gate_pillar', A3.gate_pillar(), '묘지 문기둥', '구슬 얹은 네모 돌기둥(1×3).', '1×3칸, 아랫줄만 막힘. 두 개를 입구 양옆에 세우고 사이에 gate_arch_top 을 위층으로 얹는다.')
obj('gate_arch_top', A3.gate_arch_top(), '쇠 문 아치', '문기둥 사이를 잇는 굽은 쇠 띠와 금빛 십자(4×1).', '4×1칸 위층 장식(걷기+가림). 문기둥 두 개 위쪽 한 줄에 걸친다. 아래로는 통행 가능.', brows=0, kind='decal')
obj('fog_patch', A3.fog_patch(), '안개 덩이', '반투명 푸른 안개 덩이(2×1).', '2×1칸 바닥 장식(걷기). 풀·길 위에 얹는다. 20×15 화면에 2~4개.', brows=0, kind='decal')
obj('fog_patch_small', A3.fog_patch(28, 16), '작은 안개', '반투명 푸른 안개 덩이(1×1).', '1칸 바닥 장식(걷기). 비석 사이 틈에.', brows=0, kind='decal')
obj('pumpkin_lantern', A3.pumpkin_lantern(), '호박 등', '속에서 불이 새는 잭 랜턴.', '1칸, 막힘 1줄. 길 끝·무덤 앞에 한두 개.')
obj('grass_tuft', A4.grass_tuft(), '시든 풀', '회녹색 시든 풀 다발.', '1칸, 걷기 가능한 장식. 풀밭 틈새에 덩이로.', brows=0, kind='decal')
obj('skeleton_hand', A4.skeleton_hand(), '솟은 해골 손', '흙에서 솟은 해골 손.', '1칸, 막힘 1줄. 무덤가에 드물게.')
obj('wisp', A4.wisp(), '도깨비불', '바닥 위에 뜬 푸른 불.', '1칸 장식(걷기, 위층). 사건 장소 근처에 한두 개.', brows=0, kind='decal')
obj('candle_cluster', A4.candle_cluster(), '무덤 초', '무덤 앞 푸른 불꽃 초 세 개.', '1칸, 걷기 가능한 장식. 비석 앞에.', brows=0, kind='decal')
LG = glow(64, (110, 210, 200), 54); obj('lamp_glow', LG, '푸른 빛무리', '가로등·촛대·횃불 위에 얹는 반투명 푸른 빛무리(4×4).', '4×4칸 장식(걷기, 위층 반투명). 불빛 중심에 맞춰 얹는다.', brows=0, kind='decal')

# ---------------------------------------------------------------- 바닥·벽·천장 표본, 오토타일
def ground(name, tag, ko, desc, rules):
    kit.add('ground-' + name, SAMPLES[tag].copy(), 'floor', ko, desc, rules, 0, layer='lower')
ground('mist', 'gy_grass', '안개 낀 풀밭', '푸른 안개가 번진 어두운 풀밭 3×3 표본.', '바닥 기본. 3×3 이어 붙여도 이음새가 없다. 비석·울타리 아래 전부.')
ground('road', 'gy_path', '이끼 낀 돌길', '이끼 낀 둥근 돌 바닥 3×3 표본.', '길·광장. 폭 2칸 이상, 문·영묘 앞 광장에 넓게.')
ground('crypt', 'cr_slab', '지하 판석', '어두운 큰 판석 바닥 3×3 표본.', '지하 묘소 기본 바닥.')
ground('crypt-cracked', 'cr_cracked', '금 간 이끼 판석', '금과 이끼가 낀 판석 3×3 표본.', '오래된 방·가장 깊은 방에.')
kit.add('face_crypt_3h', face_sample('crypt', 3, 3), 'wall', '묘소 벽 앞면(3줄)', '이끼 낀 어두운 쌓은 돌 벽 앞면, 3칸 폭 표본.', '방 천장 밑에 3줄. 바닥보다 어둡게. 방 천장 밑 벽 앞면은 필수, 칸막이 없이 바닥부터.', 0, role='wall')
kit.add('face_crypt_2h', face_sample('crypt', 3, 2), 'wall', '묘소 벽 앞면(2줄)', '같은 돌, 2줄 높이(복도용).', '복도 천장 밑에 2줄.', 0, role='wall')
kit.add('face_cemwall_2h', face_sample('cemwall', 3, 2), 'wall', '묘지 담 앞면', '이끼 낀 회색 돌담 앞면, 윗단 밝은 갓돌.', '묘지 둘레 담. 위에 천장 띠가 얹힌다.', 0, role='wall')
kit.add('ground-cliff', face_sample('cemwall', 3, 3), 'wall', '묘지 담 앞면(3줄)', '이끼 낀 회색 돌담 앞면 3줄 높이.', '높은 둘레 담 또는 언덕 단.', 0, role='wall')
kit.add('ceiling_crypt', ceiling_sample(), 'wall', '묘소 천장', '어두운 천장 + 밝은 테두리, 방 모서리 포함 3×3 표본.', '방·복도 바깥(벽 너머). 열린 칸에 닿은 곳만 밝은 윗면 띠.', 0, role='wall')
import gc_fix_mist as _FX                                               # 감사 보정 2026-10-08: 안개 둥근 윤곽
fs = AT.fence_sheet(); ds = AT.dirt_sheet(); ms = _FX.mist_sheet()
kit.add('autotile-fence', fs, 'autotile', '철 울타리', '뾰족 창살 철 울타리 16변형(위 1·오른쪽 2·아래 4·왼쪽 8).', '이웃으로 모양이 정해진다. 묘역을 네모로 두르고 입구 2칸은 비운다. 모든 변형 막힘.', 1, layer='upper', role='fence')
kit.add('autotile-dirt', ds, 'autotile', '밟힌 흙길', '풀 위에 덮는 흙길 가장자리 16변형.', '풀밭 위 샛길(폭 2칸). 이웃 없는 쪽은 들쭉날쭉한 가장자리. 걷기.', 0, layer='lower', role='terrain')
kit.add('autotile-mist', ms, 'autotile', '안개 띠', '이웃 쪽으로 이어지고 바깥으로 옅어지는 반투명 안개 16변형.', '풀밭·길 위 낮은 곳에 덩이로 덮는다. 걷기.', 0, layer='lower', role='decal')

# ---------------------------------------------------------------- 지도
W_, H_ = 56, 46
m = KMap(W_, H_, 'graveyard-crypt'); m.cave = False; m.ceil_seed = 53
BAD = []
def hrect(x0, y0, x1, y1, kind, wh=None, sty=None): m.floor(x0, y0, x1 - x0 + 1, y1 - y0 + 1, kind, wh, sty)
rng = random.Random(1307)
# 지상 묘역: 모서리를 깎은 불규칙한 윤곽 (북쪽은 묘지 담 앞면 2줄)
hrect(3, 3, 52, 22, 'gy_grass', 2, 'cemwall')
for (x0, y0, w, h) in ((3, 3, 3, 2), (50, 3, 3, 2), (3, 20, 2, 3), (51, 20, 2, 3), (3, 13, 1, 3)): m.cut(x0, y0, w, h)
hrect(27, 23, 28, 25, 'gy_path', 2, 'cemwall')                  # 문 밖 길
hrect(27, 9, 28, 22, 'gy_path')                                  # 영묘 → 남문
# 광장: 모서리 깎은 타원
for y in range(11, 18):
    for x in range(22, 34):
        dx = (x + .5 - 28) / 6.4; dy = (y + .5 - 14) / 3.6
        if dx * dx + dy * dy <= 1: m.fl[y][x] = 'gy_path'
# 지하 방들
hrect(22, 30, 33, 35, 'cr_slab', 3, 'crypt')                      # A 안뜰
hrect(4, 30, 16, 37, 'cr_slab', 3, 'crypt')                       # B 가족 납골실
hrect(39, 30, 51, 37, 'cr_slab', 3, 'crypt')                      # C 석관 홀
hrect(20, 40, 35, 44, 'cr_cracked', 3, 'crypt')                   # D 깊은 묘실
for (x0, y0, x1, y1) in ((17, 32, 21, 33), (34, 32, 38, 33), (27, 36, 28, 39)): hrect(x0, y0, x1, y1, 'cr_slab', 2, 'crypt')
for (x0, y0, w, h) in ((4, 30, 1, 1), (16, 36, 1, 2), (51, 30, 1, 1), (39, 36, 1, 2), (20, 43, 1, 2), (35, 43, 1, 2)): m.cut(x0, y0, w, h)
m.outdoor = {(x, y) for y in range(0, 26) for x in range(2, 54) if m.fl[y][x] in ('gy_grass', 'gy_path')}
m.canopy_r = 3
m.dry = set()

# ---- 배치 도우미
def P(name, x, y, rows=None, soft=None, layer=1, block=None, check=True):
    img = S[name]; kind = kit.meta[name]['kind']
    br = kit.meta[name]['brows'] if rows is None else rows
    if block is None:
        if br == 0: block = []
        else: block = foot(img, br, 10, soft if soft is not None else (kind in ('tree',) or name in ('lamp_post', 'candelabra', 'cypress', 'obelisk', 'tomb_cross', 'mourner', 'urn_pedestal', 'gate_pillar', 'statue_angel', 'gargoyle', 'dead_tree_small')))
    if check:
        for (bx, by) in block:
            if not (m.inb(x + bx, y + by) and m.fl[y + by][x + bx] is not None and (x + bx, y + by) not in m.blocked):
                BAD.append((name, x + bx, y + by))
    m.props_add(x, y, img, block, layer)
def DEC(name, x, y):
    img = S[name]; m.compute_faces(); w = img.width // T; h = img.height // T
    for j in range(h):
        for i in range(w):
            if (x + i, y + j) not in m.face: BAD.append((name + '@face', x + i, y + j))
    m.decal(x, y, img)
def lit(cx, cy): m.glow_at(cx + .5, cy + .5, glow(48, (110, 210, 200), 54))
def litc(cx, cy): m.glow_at(cx + .5, cy - 1.5, LG)
BX = lambda w, h: [(dx, -dy) for dx in range(w) for dy in range(h)]
OCC = set()
def occ(x, y, w=1, h=1, pad=0):
    for yy in range(y - h + 1 - pad, y + 1 + pad):
        for xx in range(x - pad, x + w + pad): OCC.add((xx, yy))
def isfree(x, y, w=1, h=1, pad=0):
    for yy in range(y - h + 1 - pad, y + 1 + pad):
        for xx in range(x - pad, x + w + pad):
            if (xx, yy) in OCC or not m.inb(xx, yy) or m.fl[yy][xx] is None or (xx, yy) in m.blocked: return False
    return True
def place(name, x, y, w=1, h=1, pad=0, **kw):
    if not isfree(x, y, w, h, pad): return False
    P(name, x, y, **kw); occ(x, y, w, h, pad); return True

# ---- 길(흙길 오토타일) / 울타리 / 안개
dirt = set()
def band(x0, y0, x1, y1):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if m.fl[y][x] == 'gy_grass': dirt.add((x, y))
band(4, 14, 26, 15); band(29, 14, 51, 15); band(12, 4, 13, 13); band(44, 16, 45, 21); band(6, 12, 13, 13); band(36, 10, 41, 11)
fence = set()
def ring(x0, y0, x1, y1, gaps):
    for x in range(x0, x1 + 1):
        for y in (y0, y1):
            if (x, y) not in gaps: fence.add((x, y))
    for y in range(y0, y1 + 1):
        for x in (x0, x1):
            if (x, y) not in gaps: fence.add((x, y))
for x in range(4, 52):
    if x not in (26, 27, 28, 29): fence.add((x, 22))
for y in range(5, 22): fence.add((3, y)) if m.fl[y][3] else None; fence.add((52, y)) if m.fl[y][52] else None
for x in range(3, 6): fence.discard((x, 22)) if not m.fl[22][x] else None
ring(36, 4, 49, 10, {(42, 10), (43, 10)}); ring(5, 16, 17, 21, {(10, 16), (11, 16)})
fence = {c for c in fence if m.fl[c[1]][c[0]]}
for c in fence: m.blocked.add(c)
m.over.append((fence, fs)); m.under.append((dirt, ds))
for c in dirt: OCC.add(c)
for y in range(H_):
    for x in range(W_):
        if m.fl[y][x] == 'gy_path': OCC.add((x, y))
mist = set()
for (x0, y0, x1, y1) in ((17, 17, 23, 19), (34, 17, 39, 18), (8, 6, 11, 8), (46, 12, 50, 13)):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if m.fl[y][x]: mist.add((x, y))
m.under.append((mist, ms))
m.compute_faces()

# ---- 정문(남쪽)과 영묘(북쪽)
P('gate_pillar', 26, 22, block=[(0, 0)], check=False); P('gate_pillar', 29, 22, block=[(0, 0)], check=False)
m.decal(26, 20, S['gate_arch_top'])
for (x, y) in ((26, 22), (29, 22)): OCC.add((x, y))
P('mausoleum', 25, 8, block=[(dx, -k) for dx in range(6) for k in (0, 1) if not (k == 0 and dx in (2, 3))]); occ(25, 8, 6, 5)
P('mausoleum_steps', 27, 9); occ(27, 9, 2, 1)
P('crypt_gate', 8, 4, block=[(dx, -k) for dx in range(3) for k in (0,)]) if False else None
DEC('wall_sconce', 24, 2); DEC('wall_sconce', 31, 2); lit(24, 2); lit(31, 2)
# ---- 광장과 길가
P('statue_angel', 27, 14, block=[(0, 0), (1, 0)]); occ(27, 14, 2, 3)
for (x, y) in ((25, 11), (30, 11), (26, 19), (29, 19), (24, 8), (31, 8)):
    P('lamp_post', x, y); litc(x, y); occ(x, y)
P('urn_pedestal', 24, 17); occ(24, 17); P('urn_pedestal', 31, 17); occ(31, 17)
for (x, y) in ((22, 12), (32, 12), (22, 16), (32, 16)):
    P('stone_bench', x, y, block=[(0, 0), (1, 0)]); occ(x, y, 2, 1)
for (x, y) in ((24, 12), (31, 12), (24, 15), (31, 15)): P('pumpkin_lantern', x, y); occ(x, y)
for (x, y) in ((26, 15), (29, 15), (26, 13), (30, 13)): m.decal(x, y, S[('wilted_flowers', 'candle_cluster')[(x + y) % 2]])
# ---- 가족 묘역(북동, 담 안): 오벨리스크 중심
P('obelisk', 42, 7); occ(42, 7, 1, 3, 1)
for (n, x, y) in (('tomb_cross', 38, 6), ('tomb_round', 40, 6), ('tomb_cross', 45, 6), ('tomb_round', 47, 6), ('mourner', 44, 9), ('tomb_slab', 38, 9), ('tomb_round', 40, 9), ('tomb_slab', 47, 9), ('raven_tomb', 48, 7), ('tomb_round', 38, 8)):
    P(n, x, y, check=False); occ(x, y)
for (n, x, y) in (('wilted_flowers', 40, 7), ('candle_cluster', 45, 7), ('wilted_flowers', 47, 8), ('candle_cluster', 41, 9)): m.decal(x, y, S[n])
# ---- 남서 묘역(담 안): 상자 무덤과 석관
P('crypt_chest_tomb', 8, 19, block=BX(2, 2)); occ(8, 19, 2, 2, 1)
P('mourner', 15, 18); occ(15, 18, 1, 2, 1)
for (n, x, y) in (('tomb_round', 6, 18), ('tomb_cross', 12, 19), ('tomb_slab', 14, 21), ('tomb_round', 6, 21), ('tomb_leaning', 12, 21)):
    P(n, x, y, check=False); occ(x, y)
m.decal(7, 19, S['candle_cluster']); m.decal(11, 20, S['wilted_flowers'])
# ---- 절반은 거친 묘지: 그리드+흔들림으로 흩뿌린다
TYPES = [('tomb_round', 3), ('tomb_slab', 3), ('tomb_cross', 2), ('tomb_leaning', 3), ('grave_mound', 4)]
def field(x0, y0, x1, y1, step=(3, 3), p=.92, seed=1):
    r = random.Random(seed); n = 0
    names = [t for t, w in TYPES for _ in range(w)]
    for y in range(y0, y1 + 1, step[1]):
        for x in range(x0, x1 + 1, step[0]):
            if r.random() > p: continue
            xx = x + r.choice((0, 0, 1, -1)); yy = y + r.choice((0, 0, 1))
            nm = r.choice(names)
            if place(nm, xx, yy, 1, 2 if nm == 'tomb_cross' else 1, 0):
                n += 1
                if r.random() < .55 and isfree(xx, yy + 1): m.decal(xx, yy + 1, S['grave_mound']) if nm != 'grave_mound' else None
                if r.random() < .2 and (xx + 1, yy + 1) not in OCC and m.fl[yy + 1][xx + 1]: m.decal(xx + 1, yy + 1, S[r.choice(('wilted_flowers', 'candle_cluster', 'grass_tuft'))])
    return n
field(5, 5, 11, 12, seed=1); field(15, 5, 23, 9, seed=2); field(31, 5, 35, 13, seed=3); field(19, 17, 25, 21, seed=4); field(32, 17, 43, 21, seed=5); field(5, 15, 5, 15, seed=6)
field(46, 11, 51, 15, seed=7); field(46, 17, 51, 21, seed=8); field(17, 11, 21, 13, seed=9); field(5, 12, 12, 13, seed=10)
field(14, 5, 24, 12, step=(2, 3), p=.95, seed=21); field(29, 4, 36, 12, step=(2, 3), p=.9, seed=22); field(17, 16, 22, 21, step=(2, 2), p=.9, seed=23)
# 특별: 파 놓은 무덤 둘, 해골 손, 도깨비불, 호박 등, 까마귀
for (x, y) in ((36, 20), (14, 9)): place('open_grave', x, y, 2, 2, 1, block=BX(2, 2))
for (n, x, y) in (('skeleton_hand', 39, 19), ('skeleton_hand', 9, 11), ('pumpkin_lantern', 30, 20), ('pumpkin_lantern', 23, 21), ('raven_tomb', 34, 18), ('raven_tomb', 20, 18)):
    place(n, x, y, 1, 1, 0)
for (x, y) in ((22, 20), (35, 10), (18, 14), (44, 14), (12, 16)): m.decal(x, y, S['wisp']) if (x, y) not in OCC else None
for (x, y) in ((17, 14), (34, 12), (47, 16)): place('stone_bench', x, y, 2, 1, 0, block=[(0, 0), (1, 0)])
# ---- 나무: 가장자리와 길 끝에 덩이로 (일렬 금지)
def tree_clump(cx, cy, names, r=3, n=4, seed=1):
    rr = random.Random(seed); c = 0
    for _ in range(n * 6):
        if c >= n: break
        x = cx + rr.randint(-r, r); y = cy + rr.randint(-r // 2, r // 2)
        nm = rr.choice(names)
        w = 2 if nm == 'dead_tree' else 1
        if x < 4 or x + w > 51 or y < 6 or y > 21: continue
        if place(nm, x, y, w, 1, 0): c += 1
tree_clump(18, 9, ['dead_tree', 'cypress'], 3, 3, 11); tree_clump(5, 6, ['dead_tree', 'cypress', 'dead_tree_small'], 2, 3, 1); tree_clump(49, 21, ['dead_tree', 'cypress'], 2, 3, 2)
tree_clump(22, 6, ['cypress', 'dead_tree_small', 'dead_tree'], 3, 4, 3); tree_clump(34, 6, ['cypress', 'dead_tree'], 2, 3, 4)
tree_clump(5, 14, ['dead_tree', 'cypress'], 1, 2, 5); tree_clump(50, 14, ['dead_tree', 'dead_tree_small'], 1, 2, 6)
tree_clump(18, 21, ['dead_tree', 'stump'], 2, 3, 7); tree_clump(44, 20, ['cypress', 'dead_tree'], 2, 3, 8)
place('dead_tree', 29, 11, 2, 1, 0) if False else None
for (x, y) in ((24, 12), (33, 12)): place('cypress', x, y, 1, 1, 0)

# ---- 지하: 안뜰 A (북쪽 앞면에 올라가는 계단 = 영묘로)
m.compute_faces()
DEC('stairs_up_face', 27, 28) if False else None
img_stairs = D.stairs_up_face(1); m.decal(27, 28, img_stairs)
for x in (24, 30): DEC('wall_sconce', x, 29); lit(x, 29)
for x in (23, 25, 29, 31, 32): DEC('wall_niche_stack', x, 28)
DEC('wall_cross', 26, 29); DEC('wall_cross', 29, 29) if False else None
DEC('cobweb', 22, 27)
for (x, y) in ((23, 31), (32, 31), (23, 35), (32, 35)): P('candelabra', x, y); litc(x, y)
P('gargoyle', 26, 31); P('gargoyle', 29, 31); P('mourner', 27, 34, block=[(0, 0)]); m.decal(26, 35, S['wilted_flowers']); m.decal(29, 33, S['candle_cluster'])
colimg = D.column(2, 'cata'); S['_col'] = colimg
for (x, y) in ((25, 33), (30, 33)): m.props_add(x, y, colimg, [(0, 0)], 1)
P('bone_pile', 24, 34, check=False); P('bone_pile', 31, 33, check=False)
# ---- 가족 납골실 B
for x in (5, 7, 9, 11, 14): DEC('wall_niche_stack', x, 28)
for x in (6, 13): DEC('wall_sconce', x, 29); lit(x, 29)
DEC('iron_door', 15, 28) if False else None; DEC('cobweb', 4, 27) if False else None
for (n, x, y) in (('coffin_wood', 6, 33), ('sarcophagus_carved', 12, 33), ('coffin_wood', 6, 36), ('sarcophagus_carved', 12, 36)):
    P(n, x, y, block=BX(2, 2))
for (x, y) in ((5, 31), (15, 31), (5, 37), (15, 37)): P('candelabra', x, y); litc(x, y)
P('urn_pedestal', 9, 31); P('urn_pedestal', 11, 31); P('bone_pile', 9, 35); P('bone_pile', 14, 35, check=False)
for (x, y) in ((9, 33), (10, 36)): m.props_add(x, y, colimg, [(0, 0)], 1)
P('mourner', 8, 36); P('gargoyle', 15, 34)
for (x, y) in ((10, 34), (7, 35), (13, 35), (14, 32)): m.decal(x, y, S['candle_cluster'])
for (x, y) in ((8, 34), (15, 36)): m.decal(x, y, S['bone_pile'])
# ---- 석관 홀 C (가운데 통로, 철문)
img = S['crypt_gate']; m.decal(44, 27, img)
for x in (40, 42, 48, 50): DEC('wall_niche_stack', x, 28)
for x in (41, 49): DEC('wall_sconce', x, 29); lit(x, 29)
DEC('cobweb', 51, 27) if False else None
for (x, y) in ((40, 33), (49, 33)): P('sarcophagus_carved', x, y, block=BX(2, 2))
for (x, y) in ((40, 37), (49, 37)): P('coffin_wood', x, y, block=BX(2, 2))
for (x, y) in ((40, 31), (51, 31), (43, 37), (51, 36)): P('candelabra', x, y); litc(x, y)
P('statue_angel', 45, 36, block=[(0, 0), (1, 0)]) if False else None
P('gargoyle', 44, 31); P('gargoyle', 47, 31)
P('bone_pile', 44, 35); P('bone_pile', 46, 33); P('bone_pile', 43, 36)
for (x, y) in ((43, 33), (47, 35)): m.props_add(x, y, colimg, [(0, 0)], 1)
for (x, y) in ((45, 31), (42, 35), (48, 36)): m.decal(x, y, S['candle_cluster'])
P('mourner', 39, 34)
for (x, y) in ((46, 37), (50, 33)): m.decal(x, y, S['bone_pile'])
# ---- 깊은 묘실 D
for x in (22, 24, 30, 32): DEC('wall_niche_stack', x, 38)
for x in (21, 26, 29, 34): DEC('wall_sconce', x, 39); lit(x, 39)
for x in (23, 33): DEC('wall_cross', x, 39)
DEC('cobweb', 20, 37) if False else None
P('sarcophagus_carved', 27, 42, block=BX(2, 2)) if False else None
for (x, y) in ((22, 41), (33, 41), (22, 44), (33, 44)): P('candelabra', x, y); litc(x, y)
P('gargoyle', 25, 41); P('gargoyle', 30, 41)
P('statue_angel', 26, 43, block=[(0, 0), (1, 0)]) if False else None
P('crypt_stairs', 27, 44, block=[]); 
for (x, y) in ((23, 43), (32, 43)): P('bone_pile', x, y, check=False)
for (x, y) in ((24, 42), (31, 42)): m.decal(x, y, S['wisp'])
if BAD: print('배치 오류', BAD)

# ---------------------------------------------------------------- 빈 바닥 채움(덩이)
RES = set()
def res(x0, y0, x1, y1):
    for yy in range(y0, y1 + 1):
        for xx in range(x0, x1 + 1): RES.add((xx, yy))
res(27, 9, 28, 25); res(17, 32, 21, 33); res(34, 32, 38, 33); res(27, 36, 28, 39)
for (x0, y0, x1, y1) in ((4, 14, 51, 15),): res(x0, y0, x1, y1)
TH = {
    'gy_grass': [[(0, 0, S['grass_tuft'], 'n'), (1, 0, S['grass_tuft'], 'n')], [(0, 0, S['grass_tuft'], 'n'), (1, 1, S['wilted_flowers'], 'n'), (2, 1, S['grass_tuft'], 'n')],
                 [(0, 0, S['dead_tree_small'], 'b'), (1, 1, S['grass_tuft'], 'n')]],
    'cr_slab': [[(0, 0, S['bone_pile'], 'n'), (1, 1, S['candle_cluster'], 'n')]],
    'cr_band': [[(0, 0, S['bone_pile'], 'n'), (1, 0, S['candle_cluster'], 'n')]],
    'cr_cracked': [[(0, 0, S['bone_pile'], 'n'), (1, 1, S['candle_cluster'], 'n')]],
}
n_fill = dfill.autofill(m, TH, RES, seed=6, lim=.40)
print('fill clusters', n_fill)

# 막다른 고립 칸(소품 사이에 갇힌 칸)은 그루터기·돌무더기로 메운다
for comp in sorted(m.components(), key=len)[:-2]:
    if len(comp) < 100:
        for (x, y) in comp: m.props_add(x, y, S['stump'] if m.fl[y][x] == 'gy_grass' else S['bone_pile'], [(0, 0)] if m.fl[y][x] == 'gy_grass' else [], 1); m.blocked.add((x, y))
# ---------------------------------------------------------------- 출력
ENT = (27, 25); FIN = (27, 41)
CRYPT_ENT = (27, 36)
def near(p):
    from collections import deque
    q = deque([p]); seen = {p}
    while q:
        c = q.popleft()
        if m.is_walk(*c) and m.bfs(ENT, c): return c
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (c[0] + dx, c[1] + dy)
            if n not in seen and m.inb(*n): seen.add(n); q.append(n)
    return p
wps = {'정문 밖': ENT, '정문': (27, 21), '광장': (26, 13), '영묘 문': (27, 8), '북동 가족 묘역': (43, 11), '남서 묘역': (13, 17), '남동 묘지': (40, 20), '북서 묘지': (9, 8)}
wps = {k: near(v) for k, v in wps.items()}
emp = dcheck.emptiness(m)
data = m.export(OUT, ENT, (27, 8), wps, extra=dict(emptiness=emp, kind='graveyard-crypt'))
# 지하는 영묘 문 이벤트로 들어간다: 안뜰(27,31)에서 시작해 깊은 묘실까지
cw = {'안뜰': (27, 32), '가족 납골실': (9, 34), '석관 홀': (45, 34), '깊은 묘실 입구': (27, 37), '지하 계단': FIN}
cpath = m.bfs((27, 32), FIN)
data['crypt'] = dict(entrance=[27, 32], final=list(FIN), path_len=(len(cpath) - 1 if cpath else None), reachable=cpath is not None,
                     waypoints={k: dict(at=list(v), reach=bool(m.bfs((27, 32), v))) for k, v in cw.items()})
json.dump(data, open(os.path.join(OUT, 'grid.json'), 'w'), ensure_ascii=False, indent=1)
print('path', data['path_len'], 'reach', data['reachable'], 'comps', data['walk_components'], data['component_sizes'])
print('wp', {k: v['reach'] for k, v in data['waypoints'].items()}); print('crypt', data['crypt'])
print('empty', emp)
print('parts', kit.save())

# ---------------------------------------------------------------- 시각 페이지
VIZ = os.path.expanduser('~/claude-viz'); os.makedirs(VIZ, exist_ok=True)
render = m.img
QA = [l.strip() for l in open(os.path.join(OUT, 'qa.txt'))] if os.path.exists(os.path.join(OUT, 'qa.txt')) else ['(QA 기록은 plan.md 참고)']
grass_t = SAMPLES['gy_grass'].crop((0, 0, 16, 16))
shape_fence = {(x, y) for x in range(2, 9) for y in range(2, 7) if x in (2, 8) or y in (2, 6)}
shape_dirt = {(x, y) for x in range(2, 9) for y in range(2, 5)} | {(x, y) for x in range(5, 7) for y in range(5, 8)}
shape_mist = {(x, y) for x in range(2, 8) for y in range(2, 5)} | {(3, 5), (4, 5)}
autos = [('autotile-fence (철 울타리)', fs, grass_t, shape_fence), ('autotile-dirt (흙길)', ds, grass_t, shape_dirt), ('autotile-mist (안개 띠)', ms, grass_t, shape_mist)]
crops = [('정문·영묘·광장', (300, 40, 620, 330), 3), ('북동 가족 묘역과 남동 묘지', (560, 40, 840, 360), 3), ('지하 가족 납골실·안뜰', (40, 420, 560, 620), 2), ('지하 석관 홀·깊은 묘실', (320, 420, 850, 720), 2)]
plan = '공동묘지(야외 56×46 중 지상 50×20)와 지하 묘소 한 판. 동선: 정문 → 광장(천사 석상) → 영묘 문 / 지하: 영묘 문 이벤트 → 안뜰 → 가족 납골실·석관 홀 → 깊은 묘실(내려가는 계단).'
sz = gc_page.build_page(os.path.join(VIZ, 'beodeul-wave-graveyard-crypt.html'), '버들항 웨이브 — 공동묘지와 지하 묘소', 'graveyard-crypt', render, data['grid'], crops, kit, autos, QA, plan)
print('page bytes', sz)
