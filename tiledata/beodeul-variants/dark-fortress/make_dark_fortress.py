# 버들항 웨이브 B-② 마왕성 내부·외곽. 다시 돌리면 같은 그림이 나온다.
#   python3 make_dark_fortress.py   (parts/, partmeta.json, parts.md, render-1x/2x.png, grid.json, 시각 페이지)
import os, sys, json, random
OUT = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, OUT)
from df_kit import *
from df_kit import _hash
import df_art1 as A1, df_art2 as A2, df_art3 as A3, df_ext as X, df_lava as LV
from df_ext import *
import dfill, dcheck
OUT = os.path.dirname(os.path.abspath(__file__)); assert OUT.endswith('dark-fortress')

kit = Kit('dark-fortress', '마왕성 내부·외곽')
S = {}
def obj(name, img, ko, desc, rules, brows=1, kind='object', **kw):
    S[name] = img; kit.add(name, img, kind, ko, desc, rules, brows, **kw); return img

obj('gate_tower_left', A1.gate_tower_left(), '성문 탑(왼쪽)', '총안 윗면, 붉은 방패 문장과 횃불이 있는 검은 돌 탑(3×4).', '3×4칸, 아래 3줄 막힘(맨 윗줄은 걷기+가림). 성벽 앞면 칸 위에 올리고 오른쪽에 gate_arch 를 붙인다. gate_tower_right 와 쌍.', brows=3)
obj('gate_tower_right', A1.gate_tower_right(), '성문 탑(오른쪽)', '왼쪽 탑의 짝(횃불이 반대쪽).', '3×4칸, 아래 3줄 막힘. gate_arch 오른쪽에 붙인다.', brows=3)
obj('gate_arch', A1.gate_arch(), '성문 아치 통로', '반쯤 올라간 쇠 격자 아래 어두운 통로, 위 한 줄은 흉벽(4×4).', '4×4칸, 통로 3줄(아래)은 걷기, 맨 윗줄은 걷기+가림. 성벽을 가르는 4칸 폭 통로 자리에 놓고 그 앞에 다리를 잇는다.', brows=0, kind='walk')
obj('throne', A1.throne(), '옥좌 단', '3단 단 위에 높은 검은 옥좌와 붉은 방석, 앞에 카펫 끝(6×4).', '6×4칸, 전체 막힘(단 앞 한 칸에서 멈춘다). 알현실 북쪽 벽 앞면 바로 아래, 카펫 오토타일을 단 앞 중앙에서 시작해 입구까지 깐다. 맵당 1개 앵커.', brows=4)
obj('drawbridge', A1.drawbridge(), '도개교', '쇠테를 두른 널판 다리와 쇠사슬 난간(2×3).', '2×3칸, 걷기. 용암 해자 위에 놓고 해자 폭만큼 세로로 이어 붙인다. 양 끝은 문 통로와 바깥 길에 닿게.', brows=0, kind='walk')
obj('obs_pillar', A1.obs_pillar(), '검은 기둥', '붉은 띠 두른 검은 돌 기둥(1×3).', '1×3칸, 아랫줄만 막힘(윗칸은 걷기+가림). 입구 홀·복도 카펫 양옆에 짝으로, 간격 3칸. 알현실은 grand_pillar.')
obj('grand_pillar', A3.grand_pillar(), '알현실 큰 기둥', '둥근 머리판 윗면, 붉은 띠·금선을 두른 홈 새긴 검은 원통, 두 단 받침(2×4).', '2×4칸, 아랫줄 2칸만 막힘(위 3줄은 걷기+가림). 알현실 카펫 양옆에 좌우 대칭 열로, 세로 간격 4칸(그림 4줄이 겹치지 않게). 카펫과 3칸 이상 띄운다.')
obj('armor_stand', A3.armor_stand(), '갑옷 장식', '받침 위 검은 판금 갑옷: 붉은 깃털 투구, 어깨받이, 앞에 짚은 큰 검(1×2).', '1×2칸, 아랫줄만 막힘. 알현실 카펫 양옆에 마주 보게 쌍으로 늘어세운다(의장대). 카펫 바로 옆 칸은 비운다.')
obj('obs_pillar_broken', A1.obs_pillar_broken(), '부러진 기둥', '위가 깨진 검은 기둥 그루터기(1×2).', '1×2칸, 아랫줄만 막힘. 무너진 방·바깥 폐허 쪽에 덩이로.')
obj('war_table', A1.war_table(), '전술 탁자', '붉은 천을 깐 큰 검은 탁자와 말 조각들(2×2).', '2×2칸, 아래 2줄 막힘. 작전실 한가운데에 1개, 둘레 한 칸씩 비운다.', brows=2)
obj('weapon_rack', A1.weapon_rack(), '무기대', '창 셋과 검 둘, 붉은 방패를 건 검은 틀(2×2).', '2×2칸, 아래 2줄 막힘. 벽 앞면 바로 아래에 붙여 두 개씩.', brows=2)
obj('treasure_chest_dark', A1.treasure_chest_dark(), '검은 보물 상자', '쇠띠와 붉은 자물쇠의 검은 상자.', '1칸, 막힘 1줄. 보물고 벽가에 덩이로 3~4개.')
obj('demon_statue', A1.demon_statue(), '뿔 달린 마왕 석상', '날개를 펼친 뿔 마왕 석상과 받침(2×3).', '2×3칸, 아랫줄 두 칸만 막힘(받침). 알현실 모서리·복도 끝 앵커로 쌍으로.')
obj('candelabra_black', A2.candelabra_black(), '검은 촛대', '다섯 가지의 검은 쇠 촛대(1×2).', '1×2칸, 아랫줄만 막힘. 카펫 양옆·방 모서리에 쌍으로.')
obj('brazier_stand', A2.brazier_stand(), '화로 기둥', '검은 기둥 위 접시에서 타오르는 붉은 불길(1×2).', '1×2칸, 아랫줄만 막힘. 단 앞·문 양옆. 빛무리(red_glow)와 함께.')
obj('banner_dark', A2.banner_dark(), '마왕 깃발', '뿔 문양과 금빛 마름모의 붉은 깃발(1×3, 글자 없음).', '1×3칸 장식(앞면 위, 앞면 3줄 필요). 벽 앞면에 2~3칸 간격으로 걸고 횃불 사이를 섞는다.', brows=0, kind='decal')
obj('bars_window', A2.bars_window(), '쇠창살 창', '세로 창살 셋의 어두운 창.', '1칸 장식(앞면 위). 벽 앞면 가운데 줄에만.', brows=0, kind='decal')
obj('arrow_slit', A2.arrow_slit(), '화살 구멍', '붉은 빛이 새는 가는 틈.', '1칸 장식(앞면 위). 성벽·복도 벽 앞면에.', brows=0, kind='decal')
obj('sconce_red', A2.sconce_red(), '붉은 벽 횃불', '쇠 고리 횃불과 붉은 불꽃.', '1칸 장식(앞면 위). 벽 앞면 6~8칸 간격, 빛무리와 함께.', brows=0, kind='decal')
obj('trap_spikes', A2.trap_spikes(), '가시 함정', '올라온 쇠 가시 다섯의 바닥 함정.', '1칸 바닥 장식(걷기 — 피해는 이벤트로). 복도 한가운데 일렬은 피하고 어긋나게 2~4칸.', brows=0, kind='decal')
obj('trap_plate', A2.trap_plate(), '압력판', '붉은 홈이 새겨진 눌린 돌판.', '1칸 바닥 장식(걷기, 함정 이벤트용). 가시 함정 옆에 한두 개.', brows=0, kind='decal')
obj('spike_row', A2.spike_row(), '말뚝 울타리', '뾰족한 검은 말뚝 여덟 개(2×1).', '2×1칸, 두 칸 막힘. 바깥 길 가장자리에 이어 붙이되 틈을 둔다.')
obj('cage_floor', A2.cage_floor(), '쇠 우리', '굽은 쇠창살 우리와 바닥의 뼈(2×2).', '2×2칸, 아래 2줄 막힘. 감옥·의식실 벽가에.', brows=2)
obj('rune_circle', A2.rune_circle(), '마법진', '두 겹 붉은 원과 별(3×3, 글자 없음).', '3×3칸 바닥 장식(걷기). 의식실 가운데에, 둘레 한 칸씩 비운다.', brows=0, kind='decal')
obj('beast_skull', A2.beast_skull(), '뿔 짐승 해골', '굵은 이마와 굽은 뿔의 거대 해골(2×2).', '2×2칸, 아래 2줄 막힘. 의식실·성문 밖 장식으로 1~2개.', brows=2)
obj('chandelier', A2.chandelier(), '쇠 샹들리에', '둥근 쇠 고리에 초 다섯 개(3×2).', '3×2칸 위층 장식(걷기+가림). 매달린 줄이 위로 이어지지 않아 바닥 무늬로 읽히기 쉽다 — 카펫·바닥 한가운데에는 두지 않는다. 방 북쪽 벽 앞면 바로 아래 한 칸에만.', brows=0, kind='decal')
obj('stairs_black_down', A2.stairs_black_down(), '지하 계단', '붉은 빛이 올라오는 검은 돌 계단 입구(2×2).', '2×2칸, 걷기. 방 안 바닥에 얹어 지하로 가는 입구로.', brows=0, kind='walk')
obj('stairs_black_up', A2.stairs_black_up(), '위로 오르는 계단(앞면)', '벽 앞면에서 어둠으로 오르는 검은 돌 계단(2×3).', '2×3칸 장식(앞면 위, 앞면 3줄 필요). 위층 이동 자리에.', brows=0, kind='decal')
obj('armor_statue', A2.armor_statue(), '갑옷 석상', '검을 짚고 선 투구 쓴 기사 석상(1×2).', '1×2칸, 아랫줄만 막힘. 복도·알현실 벽가에 쌍으로.')
obj('door_double', A2.door_double(), '큰 이중 철문', '붉은 띠와 쇠고리의 검은 이중문(2×3).', '2×3칸 장식(앞면 위, 앞면 3줄 필요). 알현실 문.', brows=0, kind='decal')
obj('door_iron_black', A2.door_iron_black(), '작은 철문', '붉은 장식 손잡이의 검은 철문(1×2).', '1×2칸 장식(앞면 위). 방 입구 벽 앞면에.', brows=0, kind='decal')
obj('altar_dark', A2.altar_dark(), '흑요석 제단', '붉은 홈과 피 담긴 그릇이 있는 제단(2×2).', '2×2칸, 아래 2줄 막힘. 의식실 북쪽 벽 아래.', brows=2)
obj('crystal_red', A2.crystal_red(), '붉은 마석', '바닥에서 솟은 붉은 결정 둘(1×2).', '1×2칸, 아랫줄만 막힘. 의식실·보물고 모서리에 덩이로.')
obj('chain_hang', A2.chain_hang(), '늘어진 쇠사슬', '천장에서 내려온 쇠사슬과 수갑(1×2).', '1×2칸 장식(앞면 위). 감옥·의식실 벽 앞면.', brows=0, kind='decal')
obj('lava_vent', A2.lava_vent(), '용암 분출구', '검은 바위 틈에서 불꽃이 나는 작은 분출구.', '1칸, 막힘 1줄. 용암 가장자리나 바깥 길 옆에.')
obj('lava_rock', A3.lava_rock(), '용암 위 현무암 덩이', '용암 위에 뜬 검은 바위 한 덩이, 아래는 붉게 비친다(1칸).', '1칸 장식(용암 칸 위, 막힘은 용암이 이미 막는다). 해자·웅덩이 안쪽에 드문드문 2~4칸 간격, 물가 바위와 붙이지 않는다.', brows=0, kind='decal')
obj('lava_rock_wide', A3.lava_rock_wide(), '용암 위 현무암 덩이(넓은)', '크고 작은 바위 셋이 붙은 덩이(2×1).', '2×1칸 장식(용암 칸 위). 긴 해자 가운데에 하나씩, lava_rock 과 섞는다.', brows=0, kind='decal')
obj('battlement', A2.battlement(), '성벽 총안', '벽 윗면 위로 솟은 두 톱니.', '1칸 위층 장식. 성벽 윗줄(천장 띠)에 한 칸씩 이어 붙인다.', brows=0, kind='decal')
RG = A2.red_glow(); obj('red_glow', RG, '붉은 빛무리', '횃불·화로 위에 얹는 반투명 붉은 빛무리(4×4).', '4×4칸 장식(걷기, 위층 반투명). 불빛 중심에 맞춰 얹는다.', brows=0, kind='decal')

def ground(name, tag, ko, desc, rules):
    kit.add('ground-' + name, SAMPLES[tag].copy(), 'floor', ko, desc, rules, 0, layer='lower')
ground('slab', 'bf_slab', '검은 판석', '보랏빛 도는 검은 판석 3×3 표본.', '복도·방 기본 바닥. 3×3 이어 붙여도 이음새가 없다.')
ground('obsidian', 'bf_obs', '흑요석 바닥', '큰 정사각 흑요석, 사선 반사 3×3 표본.', '알현실 같은 중요한 방 바닥.')
ground('ash', 'bf_ash', '재와 불씨 땅', '재투성이 땅, 붉은 불씨 자국 3×3 표본.', '성 바깥 길·용암 가장자리.')
ground('dais', 'bf_dais', '붉은빛 단 바닥', '검붉은 판석 3×3 표본.', '옥좌 단 주변·제단 바닥.')
kit.add('face_black_3h', face_sample('black', 3, 3), 'wall', '검은 성 벽 앞면(3줄)', '보랏빛 검은 쌓은 돌 벽 앞면, 3칸 폭 표본.', '방 천장 밑에 3줄. 방 모든 벽에 필수. 바닥보다 어둡게.', 0, role='wall')
kit.add('face_black_2h', face_sample('black', 3, 2), 'wall', '검은 성 벽 앞면(2줄)', '같은 돌, 2줄 높이(복도용).', '복도 천장 밑에 2줄.', 0, role='wall')
kit.add('face_rampart_3h', face_sample('rampart', 3, 3), 'wall', '외곽 성벽 앞면(3줄)', '밝은 갓돌의 바깥 성벽 앞면, 3줄.', '성 바깥쪽 앞면. 맨 윗줄에 battlement 를 얹는다.', 0, role='wall')
kit.add('ceiling_black', ceiling_sample_black(), 'wall', '마왕성 천장', '어두운 보라 천장 + 밝은 테두리, 모서리 포함 3×3 표본.', '방·복도 바깥(벽 너머). 열린 칸에 닿은 곳만 밝은 윗면 띠.', 0, role='wall')
cs = carpet_sheet(); ls = LV.lava_sheet(); ts = thorn_sheet()
kit.add('autotile-carpet', cs, 'autotile', '붉은 카펫', '금실 테두리·술 달린 붉은 카펫 16변형(위 1·오른쪽 2·아래 4·왼쪽 8).', '이웃으로 모양이 정해진다. 폭 2칸 이상 직선으로 옥좌 앞에서 입구까지. 걷기.', 0, layer='lower', role='terrain')
kit.add('autotile-lava', ls, 'autotile', '용암 해자', '들쭉날쭉한 현무암 덩이 테두리(바깥 모서리는 둥글게 깎임)와 밝은 띠·껍질 균열·거품 점이 있는 흐르는 용암 16변형(위 1·오른쪽 2·아래 4·왼쪽 8).', '성벽 앞 해자·방 웅덩이. 폭 3줄 이상, 네모 대신 가장자리를 한두 칸씩 들쭉날쭉하게. 모든 변형 막힘, 다리는 위층 조각으로. 안쪽에 lava_rock 을 드문드문.', 1, layer='lower', role='terrain')
kit.add('autotile-thorn', ts, 'autotile', '가시 덤불 울타리', '검은 가시 줄기 16변형.', '바깥 길 가장자리 장벽. 틈 한 곳(2칸 이상)을 길로 남긴다. 모든 변형 막힘.', 1, layer='upper', role='fence')

# ---------------------------------------------------------------- 지도
W_, H_ = 56, 46
LAVA_BAYS = ((13, 15), (38, 40))           # 해자 남쪽 만: 소품·길과 겹치지 않는 칸만
m = KMap(W_, H_, 'dark-fortress'); m.cave = False; m.ceil_seed = 71
m.ceil_fn = black_ceiling
BAD = []
def hrect(x0, y0, x1, y1, kind, wh=None, sty=None): m.floor(x0, y0, x1 - x0 + 1, y1 - y0 + 1, kind, wh, sty)
# 알현실 T, 작전실 W, 의식실 E, 입구 홀 H, 위병실 W2, 보물고 E2
hrect(16, 6, 39, 17, 'bf_obs', 3, 'black')                       # 알현실: 곁 통로 폭을 4칸으로 줄여 빈 바닥을 덜어 냈다
for (x0, y0, w, h) in ((16, 6, 1, 1), (39, 6, 1, 1), (16, 16, 1, 1), (39, 16, 1, 1), (16, 17, 10, 1), (30, 17, 10, 1)): m.cut(x0, y0, w, h)   # 남쪽 끝 줄은 카펫 입구(26~29)만 남긴다
hrect(3, 8, 11, 16, 'bf_slab', 3, 'black'); hrect(44, 8, 52, 16, 'bf_dais', 3, 'black')
hrect(18, 22, 37, 27, 'bf_slab', 3, 'black')
hrect(6, 22, 14, 27, 'bf_slab', 3, 'black'); hrect(41, 22, 49, 27, 'bf_slab', 3, 'black')
for (x0, y0, w, h) in ((3, 8, 1, 1), (11, 8, 1, 1), (44, 8, 1, 1), (52, 8, 1, 1), (3, 27, 1, 1), (6, 27, 1, 1), (49, 27, 1, 1)): pass
for (x0, y0, x1, y1) in ((12, 11, 15, 12), (40, 11, 43, 12), (27, 18, 28, 21), (15, 24, 17, 25), (38, 24, 40, 25)): hrect(x0, y0, x1, y1, 'bf_slab', 2, 'black')
# 성문 통로(4칸 폭)와 해자·바깥 길
hrect(26, 28, 29, 32, 'bf_slab', 3, 'black')
hrect(8, 33, 47, 35, 'bf_ash', 3, 'rampart')                    # 해자 칸(바닥은 재, 용암을 덧그린다)
hrect(6, 36, 49, 44, 'bf_ash', 3, 'rampart')
for (x0, y0, w, h) in ((6, 36, 2, 2), (48, 36, 2, 2), (6, 43, 3, 2), (47, 43, 3, 2), (6, 40, 1, 2), (49, 39, 1, 2)): m.cut(x0, y0, w, h)
m.cut(8, 33, 1, 3); m.cut(47, 33, 1, 3)
hrect(26, 36, 29, 44, 'bf_slab', 3, 'rampart')
for (x0, y0, w, h) in ((14, 6, 2, 2), ):
    pass
lava = {(x, y) for y in range(33, 36) for x in range(8, 48) if m.fl[y][x]}
# 해자 남쪽 물가를 칸 단위로도 들쭉날쭉하게: 바깥 길 쪽으로 용암이 한 칸씩 파고든 만(灣)
for (x0, x1) in LAVA_BAYS: lava |= {(x, 36) for x in range(x0, x1 + 1) if m.fl[36][x]}
# 알현실 좌우 웅덩이: 네모 대신 강낭콩 모양(좌우 대칭, x' = 55 - x)
POOL_W = {(x, 13) for x in range(17, 19)} | {(x, y) for y in (14, 15) for x in range(16, 20)} | {(x, 16) for x in range(17, 20)}
POOL_E = {(55 - x, y) for (x, y) in POOL_W}
lava |= {c for c in POOL_W | POOL_E if m.fl[c[1]][c[0]]}
for c in lava: m.blocked.add(c)
carpet = {(x, y) for x in (27, 28) for y in range(10, 32)}
thorn = {(x, 38) for x in list(range(9, 25)) + list(range(31, 47)) if m.fl[38][x]} | {(x, 42) for x in list(range(9, 24)) + list(range(32, 46)) if m.fl[42][x]}
for c in thorn: m.blocked.add(c)
m.under.append((carpet, cs)); m.over.append((thorn, ts))
m.dry = set()

def P(name, x, y, rows=None, soft=None, layer=1, block=None, check=True):
    img = S[name]; kind = kit.meta[name]['kind']
    br = kit.meta[name]['brows'] if rows is None else rows
    if block is None:
        if br == 0: block = []
        else: block = foot(img, br, 10, soft if soft is not None else (name in ('obs_pillar', 'candelabra_black', 'brazier_stand', 'armor_statue', 'demon_statue', 'crystal_red')))
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
def FLOORDEC(name, x, y):
    m.decal(x, y, S[name])
def lit(cx, cy): m.glow_at(cx + .5, cy + .5, glow(48, (255, 120, 60), 60))
def litc(cx, cy): m.glow_at(cx + .5, cy - 1.0, RG)
BX = lambda w, h: [(dx, -dy) for dx in range(w) for dy in range(h)]
m.compute_faces()

# ---- 성문과 해자
P('gate_tower_left', 24, 32, block=[(dx, -k) for dx in range(3) for k in (0, 1, 2)], check=False)
P('gate_tower_right', 31, 32, block=[(dx, -k) for dx in range(3) for k in (0, 1, 2)], check=False)
P('gate_arch', 26, 32, block=[])
for k in (0, 1, 2): P('gate_arch', 0, 0, block=[]) if False else None
P('drawbridge', 27, 35, block=[])
for c in ((27, 33), (28, 33), (27, 34), (28, 34), (27, 35), (28, 35)): m.blocked.discard(c)
for x in range(8, 48):
    if m.fl[29][x] is None and (x, 30) in m.face and not (22 <= x <= 33): m.decal(x, 29, S['battlement']) if x % 2 == 0 else None
for x in (10, 14, 18, 36, 40, 44): DEC('arrow_slit', x, 31); lit(x, 31) if False else None
for x in (12, 16, 20, 35, 38, 42, 46): DEC('sconce_red', x, 32) if x in (12, 20, 35, 42) else None
for (x, y) in ((12, 32), (20, 32), (35, 32), (42, 32)): lit(x, y)
for (x, y) in ((25, 36), (30, 36)): P('brazier_stand', x, y); litc(x, y)
# 해자 안 현무암 덩이(가운데 줄에만 드문드문 — 물가 바위와 붙지 않게), 알현실 웅덩이에 하나씩
for (n, x, y) in (('lava_rock', 11, 34), ('lava_rock_wide', 16, 34), ('lava_rock', 22, 34), ('lava_rock_wide', 33, 34), ('lava_rock', 38, 34), ('lava_rock_wide', 43, 34), ('lava_rock', 17, 15), ('lava_rock', 38, 15)):
    if all((x + i, y) in lava for i in range(S[n].width // T)): m.decal(x, y, S[n])
    else: BAD.append((n, x, y))
# ---- 바깥 길: 가시 울타리 사이 통로와 장식
for (n, x, y) in (('beast_skull', 11, 37), ('lava_vent', 16, 36), ('obs_pillar_broken', 19, 37), ('lava_vent', 22, 36), ('obs_pillar_broken', 33, 37), ('lava_vent', 36, 37), ('beast_skull', 41, 37), ('obs_pillar_broken', 45, 37)):
    if m.fl[y][x]: P(n, x, y, block=BX(2, 2) if n == 'beast_skull' else None)
for (x, y) in ((10, 40), (15, 41), (20, 40), (34, 41), (39, 40), (44, 41)):
    if m.fl[y][x] and m.fl[y][x + 1]: P('spike_row', x, y, block=[(0, 0), (1, 0)])
for (x, y) in ((23, 39), (32, 39), (24, 44), (31, 44)):
    P('brazier_stand', x, y); litc(x, y)
for (x, y) in ((13, 38), (18, 43), (36, 43), (42, 38), (9, 41), (46, 41)):
    P('lava_vent', x, y, check=False) if m.fl[y][x] and (x, y) not in m.blocked else None
for (x, y) in ((10, 43), (37, 40), (16, 39), (45, 40)): P('obs_pillar_broken', x, y, check=False) if m.fl[y][x] and (x, y) not in m.blocked else None
for (x, y) in ((12, 41), (40, 43)): P('beast_skull', x, y, block=BX(2, 2), check=False)
P('demon_statue', 21, 44, block=[(0, 0), (1, 0)], check=False); P('demon_statue', 33, 44, block=[(0, 0), (1, 0)], check=False)
# ---- 알현실 T  (카펫 27~28 축 좌우 대칭: x' = 55 - x)
# 북쪽 벽: 깃발·쇠창살 창·벽 횃불, 서쪽 위층 계단 / 동쪽 큰 문
for x in (17, 21, 34, 38): DEC('banner_dark', x, 3)
for x in (19, 36): DEC('bars_window', x, 4)
for x in (18, 37): DEC('sconce_red', x, 5); lit(x, 5)
DEC('stairs_black_up', 22, 3); DEC('door_double', 32, 3)
# 옥좌 단과 그 양옆 촛대, 단 앞 화로 한 쌍
P('throne', 25, 9, block=BX(6, 4), check=True)
for (x, y) in ((24, 7), (31, 7)): P('candelabra_black', x, y); litc(x, y)
for (x, y) in ((25, 11), (30, 11)): P('brazier_stand', x, y); litc(x, y)
# 큰 기둥 열: 카펫 양옆 대칭, 세로 4칸 간격(그림 4줄이 겹치지 않는다)
for y in (10, 16):
    for x in (20, 34): P('grand_pillar', x, y, block=[(0, 0), (1, 0)])
# 카펫 양옆 의장대: 갑옷 장식이 마주 보고 늘어선다
for y in (13, 16):
    for x in (23, 25, 30, 32): P('armor_stand', x, y)
# 곁 통로: 북쪽 모서리 마왕 석상, 남쪽 용암 웅덩이(POOL_W/E)
P('demon_statue', 17, 10, block=[(0, 0), (1, 0)]); P('demon_statue', 37, 10, block=[(0, 0), (1, 0)])
P('weapon_rack', 18, 7, block=BX(2, 2)); P('weapon_rack', 36, 7, block=BX(2, 2))     # 북쪽 벽 아래 무기대 한 쌍
# ---- 작전실 W
for x in (4, 7, 10): DEC('banner_dark', x, 5) if x != 7 else DEC('bars_window', 7, 6)
DEC('arrow_slit', 5, 6); DEC('arrow_slit', 9, 6)
P('war_table', 7, 13, block=BX(2, 2)); P('weapon_rack', 4, 11, block=BX(2, 2)); P('weapon_rack', 10, 11, block=BX(2, 2)) if False else None
P('weapon_rack', 9, 11, block=BX(2, 2))
for (x, y) in ((4, 9), (11, 9), (4, 15), (11, 15)): P('candelabra_black', x, y); litc(x, y)
P('armor_statue', 5, 15); P('armor_statue', 10, 15); P('treasure_chest_dark', 3, 13); P('treasure_chest_dark', 11, 14)
for (x, y) in ((6, 16), (8, 10)): FLOORDEC('trap_plate', x, y) if False else None
# ---- 의식실 E
FLOORDEC('rune_circle', 47, 13)
P('altar_dark', 48, 10, block=BX(2, 2))
for (x, y) in ((45, 10), (51, 10), (45, 15), (51, 15)): P('crystal_red', x, y); litc(x, y)
P('cage_floor', 44, 16, block=BX(2, 2)) if False else None
P('beast_skull', 45, 13, block=BX(2, 2)) if False else None
P('chain_hang', 0, 0, block=[]) if False else None
DEC('chain_hang', 46, 6); DEC('chain_hang', 51, 6); DEC('banner_dark', 48, 5); DEC('sconce_red', 45, 7); DEC('sconce_red', 51, 7); lit(45, 7); lit(51, 7)
P('cage_floor', 46, 16, block=BX(2, 2)); P('cage_floor', 50, 16, block=BX(2, 2)) if False else None
for c in ((45, 12), (45, 13), (45, 14), (51, 12), (51, 13), (51, 14)): pass
# ---- 입구 홀 H
for x in (19, 23, 32, 36): DEC('banner_dark', x, 19)
for x in (21, 34): DEC('bars_window', x, 20); 
for x in (25, 30): DEC('sconce_red', x, 21); lit(x, 21)
for (x, y) in ((20, 26), (35, 26), (20, 23), (35, 23)): P('obs_pillar', x, y)
for (x, y) in ((25, 23), (30, 23)): P('brazier_stand', x, y); litc(x, y)
for (x, y) in ((25, 25), (30, 26), (24, 27), (31, 24), (26, 26)): FLOORDEC('trap_spikes', x, y)
for (x, y) in ((26, 25), (29, 24)): FLOORDEC('trap_plate', x, y)
P('armor_statue', 22, 27); P('armor_statue', 33, 27)
m.decal(26, 23, S['chandelier']) if False else None
# ---- 위병실 W2 / 보물고 E2
for x in (7, 11, 13): DEC('arrow_slit', x, 21) if x == 11 else None
DEC('door_iron_black', 8, 20); DEC('banner_dark', 12, 19); DEC('sconce_red', 6, 21); DEC('sconce_red', 14, 21); lit(6, 21); lit(14, 21)
P('weapon_rack', 7, 24, block=BX(2, 2)); P('weapon_rack', 12, 24, block=BX(2, 2)) if False else None
P('cage_floor', 11, 26, block=BX(2, 2)); P('treasure_chest_dark', 6, 27); P('armor_statue', 14, 27)
P('candelabra_black', 7, 27) if False else None
for x in (42, 45, 48): DEC('banner_dark', x, 19) if x == 45 else DEC('bars_window', x, 21)
DEC('door_iron_black', 43, 20); lit(43, 21) if False else None
for (x, y) in ((42, 24), (44, 24), (47, 24), (48, 27), (42, 27)): P('treasure_chest_dark', x, y)
P('crystal_red', 49, 25); litc(49, 25); P('armor_statue', 45, 27) if False else None
P('beast_skull', 45, 27, block=BX(2, 2)) if False else None
if BAD: print('배치 오류', BAD)

# ---------------------------------------------------------------- 빈 바닥 채움(덩이)
RES = set()
def res(x0, y0, x1, y1):
    for yy in range(y0, y1 + 1):
        for xx in range(x0, x1 + 1): RES.add((xx, yy))
res(27, 10, 28, 36); res(12, 11, 15, 12); res(40, 11, 43, 12); res(15, 24, 17, 25); res(38, 24, 40, 25); res(26, 28, 29, 32)
TH = {
    'bf_obs': [[(0, 0, S['obs_pillar_broken'], 'b')]],
    'bf_slab': [[(0, 0, S['treasure_chest_dark'], 'b')], [(0, 0, S['armor_statue'], 't')]],
    'bf_dais': [[(0, 0, S['crystal_red'], 't')]],
    'bf_ash': [[(0, 0, S['lava_vent'], 'b')], [(0, 0, S['obs_pillar_broken'], 'b')]],
}
# 이전 판의 자동 채움(seed 9) 결과를 그대로 적어 둔다 — 다른 방 그림을 유지하고, 알현실(x14~41, y6~17)은 비운다
# (알현실은 위에서 대칭 배치로 직접 구성; 흩뿌린 부러진 기둥이 무엇인지 안 읽혀 뺐다).
FILL = [('armor_statue', 30, 25), ('armor_statue', 23, 24), ('treasure_chest_dark', 26, 24), ('treasure_chest_dark', 34, 24), ('treasure_chest_dark', 29, 25),
        ('treasure_chest_dark', 34, 25), ('armor_statue', 19, 24), ('armor_statue', 22, 24), ('armor_statue', 25, 24), ('treasure_chest_dark', 29, 26),
        ('armor_statue', 32, 24), ('armor_statue', 26, 23), ('treasure_chest_dark', 19, 25), ('armor_statue', 36, 25), ('armor_statue', 25, 26),
        ('treasure_chest_dark', 29, 23), ('treasure_chest_dark', 28, 41), ('armor_statue', 28, 40), ('treasure_chest_dark', 11, 24), ('armor_statue', 33, 24),
        ('armor_statue', 27, 42), ('armor_statue', 8, 25), ('armor_statue', 12, 24), ('treasure_chest_dark', 28, 38), ('treasure_chest_dark', 43, 24),
        ('obs_pillar_broken', 24, 39), ('treasure_chest_dark', 45, 24), ('armor_statue', 27, 38)]
for (n, x, y) in FILL:
    img = S[n]; m.props_add(x, y, img, [(dx_, 0) for dx_ in range(img.width // T)], 1)
n_fill = len(FILL)
print('fill clusters', n_fill)
for comp in sorted(m.components(), key=len)[:-1]:
    if len(comp) < 120 and not any(c in comp for c in ((27, 38),)):
        pass

# 막다른 고립 칸은 바닥 소품으로 막는다
ISO = 0
for comp in sorted(m.components(), key=len)[:-1]:
    if len(comp) < 60:
        ISO += len(comp)
        for (x, y) in comp: m.props_add(x, y, S['lava_vent'] if m.fl[y][x] == 'bf_ash' else S['treasure_chest_dark'], [(0, 0)], 1); m.blocked.add((x, y))
# 용암: 오토타일과 같은 규칙(df_lava.paint)을 전역 좌표로 그린 층 + 둘레 열기 층. 바닥·오토타일 위, 장식·소품 아래.
LAVA_IMG = LV.lava_layer(lava, W_, H_)
m.compute_faces()
import numpy as np
_solid = np.zeros((H_ * T, W_ * T), bool)
for yy in range(H_):
    for xx in range(W_):
        if m.fl[yy][xx] is None and (xx, yy) not in m.face: _solid[yy * T:(yy + 1) * T, xx * T:(xx + 1) * T] = True
HEAT_IMG = LV.heat_layer(lava, W_, H_, solid=_solid, lava_img=LAVA_IMG)
def _render_lava(s=m):
    s.compute_faces()
    im = Image.new('RGBA', (s.W * T, s.H * T), (0, 0, 0, 255))
    for y in range(s.H):
        for x in range(s.W):
            Pp = (x * T, y * T)
            if s.fl[y][x]:
                im.alpha_composite(dlib.floor_tile(s.fl[y][x], x, y), Pp)
            elif (x, y) in s.face:
                sty, k, n = s.face[(x, y)]
                capL = (x - 1, y) not in s.face and not s.open(x - 1, y)
                capR = (x + 1, y) not in s.face and not s.open(x + 1, y)
                im.alpha_composite(dlib.face_tile(sty, None, n - k, int(_hash(x, y, 3) * 6), capL, capR, n * T), Pp)
            else:
                def op(dx, dy):
                    xx, yy = x + dx, y + dy
                    return s.inb(xx, yy) and (s.open(xx, yy) or (xx, yy) in s.face)
                o8 = (op(0, -1), op(1, 0), op(0, 1), op(-1, 0), op(1, -1), op(1, 1), op(-1, 1), op(-1, -1))
                im.alpha_composite(s.ceil_fn(o8, int(_hash(x, y, 4) * 4)), Pp)
    for cells, sheet in s.under:
        for (x, y) in cells: im.alpha_composite(atile_img(sheet, autotile_mask(cells, x, y)), (x * T, y * T))
    im.alpha_composite(LAVA_IMG); im.alpha_composite(HEAT_IMG)
    for (x, y, img) in s.decals: im.alpha_composite(img, (int(x * T), int(y * T)))
    for cells, sheet in s.over:
        for (x, y) in sorted(cells, key=lambda c: (c[1], c[0])): im.alpha_composite(atile_img(sheet, autotile_mask(cells, x, y)), (x * T, y * T))
    for (x, y, img, w, h, layer) in sorted(s.props, key=lambda p: (p[5], p[1], p[0])):
        im.alpha_composite(img, (x * T, (y + 1) * T - img.height))
    for (px_, py_, img) in s.overlays: im.alpha_composite(img, (int(px_), int(py_)))
    s.img = im
    return im
m.render = _render_lava
m.render()
# ---------------------------------------------------------------- 출력
ENT = (27, 44); FIN = (27, 10)
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
wps = {'바깥 길': ENT, '다리 앞': (27, 37), '성문 통로': (27, 30), '입구 홀': (27, 25), '위병실': (9, 24), '보물고': (45, 25), '알현실 입구': (27, 17), '작전실': (7, 12), '의식실': (48, 14), '옥좌 앞': FIN}
wps = {k: near(v) for k, v in wps.items()}
used_extra = set(carpet) | set(lava)
emp = dcheck.emptiness(m)
emp2 = emp
_r = m.render; m.render = lambda: m.img
data = m.export(OUT, ENT, near(FIN), wps, extra=dict(emptiness=emp, kind='dark-fortress'))
print('isolated filled', ISO); print('path', data['path_len'], 'reach', data['reachable'], 'comps', data['walk_components'], data['component_sizes'])
print('wp', {k: v['reach'] for k, v in data['waypoints'].items()})
print('empty', emp)
print('parts', kit.save())

import gc_page
VIZ = os.path.expanduser('~/claude-viz'); os.makedirs(VIZ, exist_ok=True)
render = m.img
QA = [l.strip() for l in open(os.path.join(OUT, 'qa.txt'))] if os.path.exists(os.path.join(OUT, 'qa.txt')) else ['(QA 기록은 plan.md 참고)']
ash_t = SAMPLES['bf_slab'].crop((0, 0, 16, 16))
shape_c = {(x, y) for x in range(2, 5) for y in range(2, 10)} | {(x, y) for x in range(5, 8) for y in range(5, 8)}
shape_l = {(x, y) for x in range(2, 10) for y in range(2, 5)} | {(x, y) for x in range(4, 7) for y in range(5, 7)}
shape_t = {(x, y) for x in range(2, 9) for y in range(2, 6) if x in (2, 8) or y in (2, 5)}
autos = [('autotile-carpet (붉은 카펫)', cs, ash_t, shape_c), ('autotile-lava (용암 해자)', ls, SAMPLES['bf_ash'].crop((0, 0, 16, 16)), shape_l), ('autotile-thorn (가시 덤불)', ts, SAMPLES['bf_ash'].crop((0, 0, 16, 16)), shape_t)]
crops = [('성문·용암 해자·다리', (112, 448, 784, 640), 2), ('알현실 옥좌·큰 기둥·의장대', (240, 64, 656, 288), 2), ('의식실', (700, 100, 880, 280), 3), ('입구 홀 가시 함정', (270, 320, 640, 440), 2)]
plan = '마왕성 56×46. 동선: 바깥 길 → 가시 울타리 사이 통로 → 도개교(용암 해자) → 성문 통로 → 입구 홀(함정) → 붉은 카펫 → 알현실 옥좌. 곁방: 작전실·의식실·위병실·보물고.'
sz = gc_page.build_page(os.path.join(VIZ, 'beodeul-wave-dark-fortress.html'), '버들항 웨이브 — 마왕성 내부·외곽', 'dark-fortress', render, data['grid'], crops, kit, autos, QA, plan)
print('page bytes', sz)

# ---------------------------------------------------------------- 비교 시트: [버들항 석재 | 알현실 · 해자 · 입구 홀 · 의식실] (같은 2배)
from PIL import ImageDraw
REF = os.path.join(OUT, '..', '..', 'beodeul-city', 'render', 'city6_base.png')
if os.path.exists(REF):
    cw, ch = 208, 144
    tiles = [('버들항 석재 (city6_base 좌상단)', Image.open(REF).convert('RGBA').crop((0, 0, cw, ch))),
             ('알현실', render.crop((344, 80, 344 + cw, 80 + ch))), ('용암 해자', render.crop((160, 496, 160 + cw, 496 + ch))),
             ('입구 홀(유지)', render.crop((288, 336, 288 + cw, 336 + ch))), ('의식실(유지)', render.crop((688, 128, 688 + cw, 128 + ch)))]
    sheet = Image.new('RGBA', (len(tiles) * (cw * 2 + 8) + 8, ch * 2 + 30), (24, 22, 30, 255)); dr = ImageDraw.Draw(sheet)
    from PIL import ImageFont
    _ff = [f for f in ('/usr/share/fonts/truetype/nanum/NanumSquareB.ttf', '/usr/share/fonts/truetype/nanum/NanumGothic.ttf') if os.path.exists(f)]
    _font = ImageFont.truetype(_ff[0], 14) if _ff else None
    for i, (lab, t) in enumerate(tiles):
        x = 8 + i * (cw * 2 + 8)
        sheet.alpha_composite(t.resize((cw * 2, ch * 2), Image.NEAREST), (x, 22))
        dr.text((x, 3), lab, fill=(230, 226, 236, 255), font=_font)
    sheet.convert('RGB').save(os.path.join(OUT, 'compare-ref.png'))

