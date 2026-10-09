# 버들항 웨이브 2 — 일반 암석 동굴(rock-cave). 다시 돌리면 같은 그림이 나온다.
#   python3 make_rock_cave.py   → parts/, partmeta.json, parts.md, render-1x/2x.png, grid.json, compare-ref.png, _qa/*
import os, sys, json, math
OUT = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, OUT)
from rc_props import *
import rc_props as R
from rc_base import _hash
assert OUT.endswith('rock-cave')
QA = os.path.join(OUT, '_qa'); os.makedirs(QA, exist_ok=True)

# ================================================================== 조각 등록
kit = Kit('rock-cave', '일반 암석 동굴')
S = {}
def obj(name, img, ko, desc, rules, brows=1, kind='object', **kw):
    S[name] = img; kit.add(name, img, kind, ko, desc, rules, brows, **kw); return img

AT = sheets()
import rc_fix_autotiles as _FX; AT.update(_FX.sheets())          # 감사 보정 2026-10-08: pool·crack 둥근 윤곽
# -- 앵커 구조물
obj('cave_mouth', R.cave_mouth(), '동굴 입구 아치', '벽 앞면 3줄에 뚫린 굵은 바위 아치. 안으로 바깥 하늘·풀밭·흙길이 밝게 보이고 아랫줄은 빛과 흙이 들이친 바닥(4×4).',
    '4×4칸. 위 3줄은 벽 앞면(높이 3) 칸 위에, 맨 아랫줄은 그 앞 바닥 칸에 놓는다(아랫줄 걷기 = 출입구 칸). 앞에 light_shaft 와 fern_tuft, 흙 바닥(ground-dirt)을 둔다. 맵당 1개.', brows=0, kind='walk')
obj('light_shaft', R.light_shaft(), '바깥빛 줄기', '입구 아치에서 바닥으로 떨어지는 밝은 빛 띠와 먼지 점(3×3, 반투명).', '3×3칸 덧그림(걷기). cave_mouth 아랫줄 바로 아래에 왼쪽을 맞춰 얹는다. 입구 말고는 쓰지 않는다.', brows=0, kind='decal')
obj('stairs_down_broken', R.stairs_down(2), '부서진 내림 계단', '바닥에 뚫린 직사각 구덩이 안으로 북쪽을 향해 내려가는 돌계단. 디딤판 몇 개가 빠졌고 안쪽은 어둠으로 사라진다(2×3).',
    '2×3칸, 걷기(계단 칸 = 아래층 이동 이벤트). 바닥 위 평평한 곳에 시트 모양 그대로 놓고, 남쪽 문지방 앞 한 칸을 비운다. 둘레에 rubble·autotile-crack 을 흩는다. 벽 앞면에 붙이지 않는다.', brows=0, kind='walk')
obj('bridge_plank', R.bridge_plank(4), '나무 널다리', '가로 널판과 양옆 밧줄 난간, 양 끝 말뚝(2×4, 남북 방향).', '2×4칸, 걷기. 동서로 흐르는 시냇물(autotile-pool 2줄)을 남북으로 건넌다: 위·아래 1줄씩 둔치에 걸친다.', brows=0, kind='walk')
obj('stepping_stone', R.stepping_stone(1), '징검돌', '물 위로 솟은 납작한 둥근 돌과 물 고리.', '1칸, 걷기. 웅덩이(autotile-pool) 칸 위에 한 줄로 이어 놓아 섬·건너편으로 잇는다. 3~6개, 칸마다 다른 표본(stepping_stone_b)을 섞는다.', brows=0, kind='walk')
obj('stepping_stone_b', R.stepping_stone(4), '징검돌(변형)', '조금 왼쪽으로 치우친 징검돌.', '1칸, 걷기. stepping_stone 과 번갈아 놓는다.', brows=0, kind='walk')
# -- 석순·석주
obj('stalagmite_s', R.stalagmite('s', 1), '낮은 석순', '바닥에서 솟은 작은 석순과 밑동 잔돌.', '1칸, 막힘 1줄. 큰 석순 곁·벽가에 덩이로. 길 한가운데는 피한다.')
obj('stalagmite_m', R.stalagmite('m', 2), '석순', '흐름돌 고리가 감긴 중간 석순(1×2).', '1×2칸, 아랫줄만 막힘(위 칸은 걷기+가림). 3~5개씩 크기를 섞어 덩이로, 일렬 금지.')
obj('stalagmite_l', R.stalagmite('l', 3, .3), '큰 석순', '살짝 기운 높은 석순(1×3).', '1×3칸, 아랫줄만 막힘. 무리의 가운데에 하나, 둘레에 m·s 를 둔다.')
obj('stalagmite_cluster', R.stalagmite_cluster(1), '석순 무리', '흐름돌 받침 하나에 크고 작은 석순 넷이 붙은 덩이(2×2).', '2×2칸, 아랫줄 두 칸 막힘. 방 모서리·벽가 앵커. 통로 폭을 2칸 아래로 줄이지 않는다.')
obj('stalagmite_cluster_b', R.stalagmite_cluster(5), '석순 무리(변형)', '키와 기울기가 다른 석순 무리(2×2).', '2×2칸, 아랫줄 막힘. stalagmite_cluster 와 섞어 반복을 깬다.')
obj('column_drip', R.column_drip(1), '석주', '천장 종유석과 바닥 석순이 이어 붙은 허리 잘록한 기둥(1×3). 꼭대기는 천장 그늘로 사라진다.', '1×3칸, 아랫줄만 막힘. 벽 앞면 바로 아래나 방 안쪽에 2~3개 덩이로, 간격 2칸 이상.')
obj('column_great', R.column_great(1), '큰 석주', '치마 주름이 진 굵은 흐름돌 기둥(2×4).', '2×4칸, 아랫줄 2칸만 막힘(위 3줄은 걷기+가림). 넓은 방에 1~2개 앵커. 둘레 한 칸은 비운다.')
obj('stalactites_face', R.stalactites_face(2, 1), '벽 종유석', '벽 앞면 꼭대기에 매달린 뾰족한 종유석 줄과 물방울(2×1).', '2×1칸 앞면 장식(걷기 영향 없음). 벽 앞면 맨 윗줄 칸에만 붙인다. 4~8칸 간격, 횃불과 겹치지 않게.', brows=0, kind='decal')
obj('stalactites_face_b', R.stalactites_face(2, 6), '벽 종유석(변형)', '길이가 다른 종유석 줄(2×1).', '2×1칸 앞면 장식. stalactites_face 와 번갈아.', brows=0, kind='decal')
# -- 바위
obj('boulder_s', R.boulder('s', 1), '바위', '둥근 동굴 바위와 곁 돌.', '1칸, 막힘. 벽가·석순 곁에 2~3개 덩이.')
obj('boulder_moss', R.boulder('s', 5, True), '이끼 바위', '윗면에 회록 이끼가 앉은 바위.', '1칸, 막힘. 물가·입구 근처 젖은 자리.')
obj('boulder_wide', R.boulder('w', 2, True), '낮은 바위 무더기', '낮고 넓게 누운 바위 둘(2×1).', '2×1칸, 두 칸 막힘. 벽가를 따라 놓아 곧은 벽선을 깬다.')
obj('boulder_big', R.boulder('m', 3, True), '큰 바위', '금 간 큰 바위와 곁 바위(2×2).', '2×2칸, 아래 2줄 막힘. 방 가장자리 앵커, 통로를 막지 않는다.', brows=2)
obj('rubble', R.rubble(1), '돌무더기', '천장에서 떨어진 모난 돌이 낮게 쌓였다(2×1).', '2×1칸, 두 칸 막힘. 무너진 자리·계단 둘레, autotile-crack 위에.')
obj('pebbles', R.pebbles(1), '잔돌', '바닥에 흩어진 작은 돌멩이 몇 개.', '1칸 바닥 장식(걷기). 빈 바닥을 깨는 데 2~3칸마다 하나씩, 덩이로.', brows=0, kind='decal')
obj('pebbles_b', R.pebbles(5), '잔돌(변형)', '다른 배치의 잔돌.', '1칸 바닥 장식(걷기). pebbles 와 섞는다.', brows=0, kind='decal')
# -- 보물 방
obj('chest_closed', R.chest(False), '보물 상자', '쇠띠·금 자물쇠의 나무 상자(뚜껑 윗면 + 앞면).', '1칸, 막힘. 보물 방 벽가에 1~3개, 사이를 한 칸 띄운다.')
obj('chest_open', R.chest(True), '열린 보물 상자', '뚜껑이 뒤로 젖혀지고 금화·보석이 찬 상자.', '1칸, 막힘. 보물 방 가운데 앵커 또는 이미 연 상자.')
obj('gold_pile', R.gold_pile(), '금화 더미', '반짝이는 금화 둔덕과 붉은 보석.', '1칸 바닥 장식(걷기). 상자 곁에 1~2개.', brows=0, kind='decal')
obj('torch_stand', R.torch_stand(), '세운 횃불', '쇠 받침대 위 불꽃(1×2).', '1×2칸, 아랫줄만 막힘. 보물 방 입구·갈림길 양옆에 짝으로, 빛무리(torch_glow)와 함께.')
obj('wall_torch', R.wall_torch(), '벽 횃불', '쇠 고리에 꽂힌 횃불.', '1칸 앞면 장식. 벽 앞면 가운데·아래 줄, 6~8칸 간격, 빛무리와 함께.', brows=0, kind='decal')
obj('torch_glow', R.light_glow(24), '횃불 빛무리', '두 단으로 끊긴 따뜻한 빛 원(3×3, 반투명).', '3×3칸 덧그림(걷기). 횃불 불꽃을 가운데로 얹는다.', brows=0, kind='decal')
# -- 갈림길·위험 표지
obj('skull_stake', R.skull_stake(), '해골 말뚝', '말뚝 꼭대기 짐승 해골과 해진 천 — 「이 앞 위험」 표지(1×2).', '1×2칸, 아랫줄만 막힘. 갈림길·계단·보물 방 앞에 하나. 길 가장자리에.')
obj('signpost', R.signpost(), '갈림길 표지', '두 갈래 나무 화살판(글자 없음, 새긴 화살)(1×2).', '1×2칸, 아랫줄만 막힘. 갈림길 가운데 가장자리에 하나.')
obj('bones', R.bones(), '흩어진 뼈', '뼈 두 대와 둥근 관절.', '1칸 바닥 장식(걷기). 해골 말뚝·계단 둘레에 1~2개.', brows=0, kind='decal')
obj('skeleton_remains', R.skeleton_remains(), '쓰러진 모험가 유해', '해골·갈비뼈, 녹슨 칼, 둥근 나무 방패(2×1).', '2×1칸 바닥 장식(걷기, 조사 이벤트용). 막다른 곳·섬·보물 방 앞에 맵당 1~2.', brows=0, kind='decal')
# -- 생물·식생·잡동사니
obj('bats_hanging', R.bats_hanging(), '매달린 박쥐', '벽 앞면에 거꾸로 매달린 박쥐 셋(2×1).', '2×1칸 앞면 장식. 앞면 맨 윗줄, 어두운 방 구석.', brows=0, kind='decal')
obj('bat_flying', R.bat_flying(), '나는 박쥐', '날개를 편 박쥐와 바닥 그림자.', '1칸 덧그림(위층, 걷기). 넓은 방 공중에 1~3마리, 몰리지 않게.', brows=0, kind='decal')
obj('mushrooms', R.mushrooms(), '동굴 버섯', '갓 윗면이 보이는 버섯 셋.', '1칸 바닥 장식(걷기). 젖은 벽가·이끼 곁.', brows=0, kind='decal')
obj('moss_patch', R.moss_patch(), '이끼 덩이', '젖은 바닥에 낮게 깔린 회록 이끼.', '1칸 바닥 장식(걷기). 물가·입구 근처에 2~4개 덩이.', brows=0, kind='decal')
obj('cobweb', R.cobweb(), '거미줄', '구석에서 퍼지는 거미줄.', '1칸 앞면·구석 장식. 벽 앞면 왼쪽 위 구석 칸.', brows=0, kind='decal')
obj('roots_hanging', R.roots_hanging(), '늘어진 뿌리', '천장 틈에서 내려온 나무뿌리와 잎(2×1).', '2×1칸 앞면 장식. 입구 근처 벽 앞면 윗줄에만.', brows=0, kind='decal')
obj('fern_tuft', R.fern_tuft(), '고사리 풀', '바깥빛에 자란 고사리 한 포기.', '1칸 바닥 장식(걷기). 입구 빛줄기 둘레에만 2~4개.', brows=0, kind='decal')
obj('campfire_old', R.campfire_old(), '식은 모닥불', '돌 고리 안 숯과 타다 만 장작.', '1칸 바닥 장식(걷기). 입구 홀 한쪽 쉼터, rope_crate 곁.', brows=0, kind='decal')
obj('rope_crate', R.rope_crate(), '탐험 짐', '낡은 나무 상자 위 사린 밧줄과 곡괭이.', '1칸, 막힘. 입구 홀·계단 앞 쉼터.')
obj('drip_puddle', R.drip_puddle(), '물방울 웅덩이', '석순 곁에 고인 얕은 물과 동심원.', '1칸 바닥 장식(걷기). 종유석 아래·석주 곁.', brows=0, kind='decal')
# -- 바닥·벽·천장 표본
def ground(name, tag, ko, desc, rules):
    kit.add(name, SAMPLES[tag].copy(), 'floor', ko, desc, rules, 0, layer='lower', role='terrain')
ground('ground-rock', 'rc_rock', '동굴 암반 바닥', '회갈색 암반: 한 주조에 잔돌·점·실금(3×3 이음새 없음).', '걷는 바닥 기본. 방·통로 전체.')
ground('ground-gravel', 'rc_gravel', '자갈 바닥', '굵은 잔돌이 빽빽한 바닥(3×3).', '갈림길·계단 둘레·무너진 자리에 덩이로.')
ground('ground-wet', 'rc_wet', '젖은 바위 바닥', '물기 어린 푸른 회색 암반과 반짝임(3×3).', '물가 1~2칸 띠, 석주 둘레.')
from gc_ext import compose_
kit.add('face_rock', compose_(3, 3, lambda i, j: dlib.face_tile(FACE, None, j, int(_hash(i + 3, j, 3) * 6), i == 0, i == 2, 48)), 'wall',
        '동굴 벽 앞면(3줄)', '세로 바위 갈비와 틈, 끊긴 층리, 아래쪽 이끼와 물 스민 줄(3×3, 양끝 마구리 포함).', '천장 바로 밑 3줄(넓은 방). 바닥 북쪽 가장자리마다.', 0, role='wall')
kit.add('face_rock_2h', compose_(3, 2, lambda i, j: dlib.face_tile(FACE, None, j, int(_hash(i + 5, j, 3) * 6), i == 0, i == 2, 32)), 'wall',
        '동굴 벽 앞면(2줄)', '통로용 낮은 앞면(3×2).', '폭 2칸 통로 북쪽 가장자리.', 0, role='wall')
def _cf(i, j):
    o8 = (j > 0, i < 2, j < 2, i > 0, j > 0 and i < 2, j < 2 and i < 2, j < 2 and i > 0, j > 0 and i > 0)
    return ceil_rc((False,) * 8 if (i == 1 and j == 1) else o8, i + j)
kit.add('ceiling_rock', compose_(3, 3, _cf), 'wall', '동굴 천장 바위', '솟은 바위 덩어리: 열린 쪽 8px 는 잔돌 결 윗면 띠, 속은 어둠(3×3).', '걷는 칸·앞면이 아닌 모든 칸. 띠는 이웃에 맞춰 바뀐다.', 0, role='wall')
kit.add('autotile-crack', AT['crack'], 'autotile', '균열 자갈밭', '바닥 위 투명 덧그림: 무너져 내린 잔돌과 짧은 금(16변형).', '걷는 바닥 위에 덩이로 칠한다(4~12칸). 계단·갈림길·무너진 자리. 일렬 띠 금지.', 0, layer='lower', role='terrain')
kit.add('autotile-ledge', AT['ledge'], 'autotile', '암반 턱', '낮은 바위 언덕: 잔돌 결 윗면, 남쪽 6px 앞면, 들쭉날쭉한 가장자리(16변형).', '막힘. 벽 앞면 밑동·방 모서리에 붙여 칠해 곧은 벽선을 깬다. 통로 폭을 2칸 아래로 줄이지 않는다.', 0, layer='lower', role='wall')
kit.add('autotile-pool', AT['pool'], 'autotile', '지하수 웅덩이·시냇물', '어두운 물과 잔물결, 북쪽 바위 둑 앞면, 남쪽 밝은 물가(16변형).', '막힘(징검돌·다리 칸만 걷기). 지하 호수·2칸 폭 시냇물. 물가 1~2칸은 ground-wet.', 0, layer='lower', role='terrain')

# ================================================================== 지도
# 칸 단위 손 설계(행마다 열린 구간). 방 사이에는 바위 4줄(천장 띠 1 + 앞면 3)을 남겨 앞면이 언제나 천장 밑에 선다.
W, H = 48, 40
m = CaveMap(W, H, 'rock-cave')
FL = {}
def span(rows, kind='rc_rock', wh=3):
    for y, segs in rows.items():
        for (a, b) in segs:
            for x in range(a, b + 1): FL[(x, y)] = (kind, wh)
ROOM_D = {4: [(4, 8), (11, 15)], 5: [(3, 16)], 6: [(2, 17)], 7: [(2, 17)], 8: [(2, 17)], 9: [(2, 16)], 10: [(3, 16)], 11: [(3, 17)], 12: [(4, 16)], 13: [(5, 10), (13, 16)]}
LOOP = {6: [(17, 28)], 7: [(17, 29)], 8: [(26, 29)]}
ROOM_C = {4: [(31, 36), (39, 44)], 5: [(30, 45)], 6: [(29, 46)], 7: [(29, 46)], 8: [(29, 46)], 9: [(29, 46)], 10: [(29, 46)], 11: [(29, 46)],
          12: [(28, 46)], 13: [(25, 45)], 14: [(25, 40)], 15: [(25, 26), (29, 37)], 16: [(25, 26), (31, 35)], 17: [(25, 26), (33, 34)]}
LAKEW = {6: [(36, 42)], 7: [(34, 44)], 8: [(33, 45)], 9: [(33, 38), (42, 45)], 10: [(33, 38), (42, 45)], 11: [(34, 38), (42, 45)], 12: [(35, 44)],
         13: [(36, 44)], 14: [(35, 40)], 15: [(34, 37)], 16: [(33, 35)], 17: [(33, 34)], 18: [(21, 34)], 19: [(21, 34)]}
BtoC = {18: [(25, 26)], 19: [(25, 26)], 20: [(25, 26)]}
BtoD = {14: [(15, 16)], 15: [(15, 16)], 16: [(15, 16)], 17: [(15, 16)], 18: [(15, 16)], 19: [(15, 16)], 20: [(15, 19)]}
ROOM_B = {21: [(16, 27)], 22: [(19, 28)], 23: [(18, 29)], 24: [(18, 32)], 25: [(18, 32)], 26: [(19, 30)], 27: [(20, 28)]}
AtoB = {28: [(17, 21)], 29: [(15, 18)], 30: [(14, 17)]}
BtoF = {28: [(23, 24)], 29: [(23, 24)], 30: [(22, 24)], 31: [(22, 24)]}
BtoE = {26: [(31, 32)], 27: [(31, 32)], 28: [(31, 33)], 29: [(32, 33)], 30: [(32, 35)], 31: [(33, 35)]}
ROOM_A = {29: [(5, 14)], 30: [(3, 17)], 31: [(2, 16)], 32: [(2, 15)], 33: [(2, 15)], 34: [(3, 21)], 35: [(3, 21)], 36: [(4, 13)], 37: [(6, 10)]}
ROOM_F = {32: [(22, 26)], 33: [(21, 28)], 34: [(20, 29)], 35: [(20, 29)], 36: [(21, 28)], 37: [(23, 27)]}
ROOM_E = {29: [(37, 43)], 30: [(35, 45)], 31: [(34, 46)], 32: [(34, 46)], 33: [(34, 45)], 34: [(35, 45)], 35: [(36, 44)], 36: [(38, 42)]}
for r in (ROOM_D, ROOM_C, ROOM_B, ROOM_A, ROOM_F, ROOM_E): span(r)
for r in (LOOP, BtoC, BtoD, AtoB, BtoF, BtoE): span(r, wh=3)
WATER = set()
for y, segs in LAKEW.items():
    for (a, b) in segs:
        for x in range(a, b + 1): WATER.add((x, y)); FL[(x, y)] = ('rc_wet', 3)
for c in ((39, 9), (41, 11)): WATER.add(c); FL[c] = ('rc_wet', 3)
ISLAND = {(x, y) for x in (39, 40, 41) for y in (9, 10, 11)} - {(39, 9), (41, 11)}
SHORE = (32, 10)
STONES = [(x, 10) for x in range(33, 39)]
BRIDGE = {(x, y) for x in (25, 26) for y in (17, 18, 19, 20)}
STAIRS = {(x, y) for x in (24, 25) for y in (34, 35, 36)}
MOUTH = (8, 29)
# 얇은 바위 정리: 천장 띠 없이 앞면만 선 바위(떠 있는 벽 토막)를 없앤다.
#   세로로 두 열린 칸 사이 바위가 1~2줄이면 연다(물 위면 젖은 둑), 3줄이면 아래 바닥의 앞면을 2줄로 줄여 띠 1줄을 남긴다.
#   가로로 양옆이 열린 1칸 폭 바위도 연다.
def isopen(x, y): return (x, y) in FL
for _ in range(6):
    changed = False
    for x in range(W):
        y = 0
        while y < H:
            if not isopen(x, y) and y > 0 and isopen(x, y - 1):
                y1 = y
                while y1 < H and not isopen(x, y1): y1 += 1
                n = y1 - y
                if y1 < H:
                    if n <= 2:
                        for yy in range(y, y1): FL[(x, yy)] = ('rc_wet' if (x, y1) in WATER else 'rc_rock', 3); changed = True
                    elif n == 3:
                        k, wh = FL[(x, y1)]
                        if wh != 2: FL[(x, y1)] = (k, 2); changed = True
                y = y1
            else: y += 1
    for (x, y) in [(x, y) for x in range(1, W - 1) for y in range(4, H - 1)]:
        if not isopen(x, y) and isopen(x - 1, y) and isopen(x + 1, y): FL[(x, y)] = ('rc_rock', 3); changed = True
    # 사방이 바닥·앞면인 천장 한 칸 = 띠로 둘러싸인 작은 상자 → 연다
    def isface(x, y):
        if isopen(x, y): return False
        for k in range(1, 4):
            if isopen(x, y + k): return k <= FL[(x, y + k)][1]
        return False
    for (x, y) in [(x, y) for x in range(1, W - 1) for y in range(1, H - 1)]:
        if isopen(x, y) or isface(x, y): continue
        if all(isopen(x + dx, y + dy) or isface(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            FL[(x, y)] = ('rc_rock', 3); changed = True
    # 작은 바위 섬(4칸 이하, 테두리에 닿지 않음) = 상자처럼 보이므로 연다
    seen = set()
    for y0 in range(H):
        for x0 in range(W):
            if isopen(x0, y0) or (x0, y0) in seen: continue
            comp = [(x0, y0)]; seen.add((x0, y0)); st = [(x0, y0)]; edge = False
            while st:
                cx, cy = st.pop()
                if cx in (0, W - 1) or cy in (0, H - 1): edge = True
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    q = (cx + dx, cy + dy)
                    if 0 <= q[0] < W and 0 <= q[1] < H and not isopen(*q) and q not in seen: seen.add(q); st.append(q); comp.append(q)
            if not edge and len(comp) <= 4:
                for c in comp: FL[c] = ('rc_rock', 3)
                changed = True
    if not changed: break
# 바닥 종류
def nb(p, S_, r=1): return any((p[0] + dx, p[1] + dy) in S_ for dx in range(-r, r + 1) for dy in range(-r, r + 1))
for p, (k, wh) in list(FL.items()):
    if p in WATER: continue
    x, y = p
    if nb(p, WATER, 1): FL[p] = ('rc_wet', wh)
    elif math.hypot((x + .5 - 23.5) / 3.4, (y + .5 - 25) / 1.8) < 1 + (vnoise(x, y, 2, 31) - .5) * .5: FL[p] = ('rc_gravel', wh)
    elif math.hypot((x + .5 - 27) / 2.4, (y + .5 - 35) / 1.8) < 1: FL[p] = ('rc_gravel', wh)
    elif vnoise(x, y, 3, 33) > .64: FL[p] = ('rc_rock2', wh)
for (x, y), (k, wh) in FL.items(): m.floor(x, y, 1, 1, k, wh, FACE)
for y in range(H):
    for x in range(W): m.sty[y][x] = FACE
m.compute_faces()
FACES = set(m.face.keys())

# ---- 오토타일 영역
LEDGE = set()
for c in [(2, 8), (2, 9), (2, 10), (3, 9), (3, 10), (14, 4), (15, 4), (15, 5), (16, 5),            # D
          (46, 6), (46, 7), (46, 8), (45, 7),   # C
          (2, 31), (2, 32), (2, 33), (3, 33), (12, 36), (13, 36), (16, 31), (15, 32),               # A
          (28, 22), (29, 23), (29, 22),                                                          # B
          (46, 31), (46, 32), (45, 33), (45, 34), (34, 33), (35, 34), (34, 32),                    # E
          (29, 34), (29, 35), (28, 36), (20, 34), (20, 35),
          (25, 28), (4, 36), (5, 36), (31, 24), (32, 24), (16, 22), (17, 22)]:                                     # F
    if c in FL and c not in WATER: LEDGE.add(c)
CRACK = set()
for (x, y) in list(FL):
    if (x, y) in WATER or (x, y) in LEDGE or (x, y) in STAIRS: continue
    if math.hypot((x + .5 - 23) / 2.8, (y + .5 - 25.6) / 1.4) < 1 and vnoise(x, y, 2, 41) > .28: CRACK.add((x, y))
    if math.hypot((x + .5 - 26.5) / 2.0, (y + .5 - 35.5) / 1.6) < 1: CRACK.add((x, y))
    if math.hypot((x + .5 - 13.5) / 1.8, (y + .5 - 34.5) / 1.2) < 1: CRACK.add((x, y))
    if math.hypot((x + .5 - 21) / 2.2, (y + .5 - 7) / 1.1) < 1: CRACK.add((x, y))
    if math.hypot((x + .5 - 41) / 2.0, (y + .5 - 34.5) / 1.1) < 1: CRACK.add((x, y))
    if math.hypot((x + .5 - 6.5) / 1.8, (y + .5 - 32.5) / 1.1) < 1: CRACK.add((x, y))
    if math.hypot((x + .5 - 20) / 1.6, (y + .5 - 29) / 1.0) < 1: CRACK.add((x, y))
    if math.hypot((x + .5 - 16) / 1.1, (y + .5 - 17) / 1.6) < 1: CRACK.add((x, y))
m.under.append((WATER, AT['pool']))
m.under.append((LEDGE, AT['ledge']))
m.under.append((CRACK, AT['crack']))
for p in WATER | LEDGE: m.blocked.add(p)
for p in STONES + list(BRIDGE): m.blocked.discard(p)

# ---- 소품
def P(name, x, y, rows=1, soft=True, layer=1, block=None, img=None):
    m.put(x, y, img or S[name], rows, soft, layer, block)
def D(name, x, y, img=None): m.decal(x, y, img or S[name])
def FD(name, x, y):
    im = S[name]; wc = im.width // T
    for dy in (0, 1, -1, 2):
        if all((x + i, y + dy) in FACES for i in range(wc)): m.decal(x, y + dy, im); return
    for dx in (1, -1, 2, -2):
        if all((x + dx + i, y) in FACES for i in range(wc)): m.decal(x + dx, y, im); return
    print('  [앞면 아님]', name, x, y)
def GLOW(cx, cy): m.glow_at(cx + .5, cy + .5, S['torch_glow'])

# A 입구 홀: 아치·빛·고사리, 서쪽 바위, 쉼터(짐·모닥불)
m.props_add(MOUTH[0], MOUTH[1], S['cave_mouth'], block=[], layer=0)
m.overlays.append((MOUTH[0] * T, MOUTH[1] * T + 4, S['light_shaft']))
for (x, y) in ((7, 30), (12, 30), (11, 31), (6, 29), (13, 29)): D('fern_tuft', x, y, R.fern_tuft(x))
FD('roots_hanging', 12, 26); FD('roots_hanging', 5, 26)
D('moss_patch', 5, 31); D('moss_patch', 14, 31)
P('boulder_big', 3, 35, rows=2, soft=False)
P('boulder_moss', 4, 30, soft=False); P('boulder_s', 3, 32, soft=False, img=R.boulder('s', 9))
P('rubble', 12, 35, soft=False); D('pebbles', 11, 34); D('pebbles_b', 9, 36)
P('rope_crate', 7, 35, soft=False); D('campfire_old', 8, 34); D('bones', 5, 34)
P('stalagmite_m', 15, 30); P('stalagmite_s', 14, 33); P('stalagmite_s', 10, 32, img=R.stalagmite('s', 7))
D('pebbles', 6, 32); D('pebbles_b', 13, 32)
P('stalagmite_m', 18, 35, img=R.stalagmite('m', 9, -.3)); D('pebbles', 17, 34)
# B 갈림길: 표지·해골 말뚝·횃불
P('signpost', 21, 23); P('skull_stake', 26, 22)
P('torch_stand', 19, 24); GLOW(19, 23)
P('torch_stand', 30, 25); GLOW(30, 24)
D('bones', 25, 23); D('pebbles_b', 20, 26); D('skeleton_remains', 26, 26)
P('stalagmite_m', 18, 25, img=R.stalagmite('m', 11)); P('stalagmite_s', 27, 27); P('boulder_s', 28, 26, soft=False, img=R.boulder('s', 13))
P('stalagmite_s', 17, 21, img=R.stalagmite('s', 12))
P('boulder_wide', 20, 20, soft=False, img=R.boulder('w', 41, False)); P('rubble', 28, 20, soft=False, img=R.rubble(43)); D('pebbles', 22, 20, R.pebbles(44))
FD('wall_torch', 22, 18); GLOW(22, 18.6); FD('cobweb', 19, 20)
# B→D 통로, 북쪽 고리
P('stalagmite_s', 16, 17, img=R.stalagmite('s', 14)); D('pebbles', 15, 15)
D('pebbles', 24, 6); P('stalagmite_m', 27, 7, img=R.stalagmite('m', 15)); D('mushrooms', 18, 7); P('boulder_s', 28, 8, soft=False, img=R.boulder('s', 17))
FD('bats_hanging', 22, 4)
# D 석순 회랑: 큰 석주, 석주 둘, 석순 무리, 물방울 웅덩이
P('column_great', 6, 7)
P('column_drip', 11, 6); P('column_drip', 14, 7, img=R.column_drip(4))
P('stalagmite_cluster', 8, 12); P('stalagmite_cluster_b', 13, 12)
P('stalagmite_l', 10, 10); P('stalagmite_m', 12, 10); P('stalagmite_s', 11, 11); P('stalagmite_m', 4, 12, img=R.stalagmite('m', 19, .3))
P('stalagmite_s', 17, 9); P('stalagmite_m', 16, 11, img=R.stalagmite('m', 21)); P('stalagmite_l', 3, 7, img=R.stalagmite('l', 23, -.3))
P('stalagmite_s', 6, 10, img=R.stalagmite('s', 25)); P('boulder_s', 15, 13, soft=False)
for (x, y) in ((9, 8), (12, 8), (14, 10), (5, 13)): D('drip_puddle', x, y)
D('mushrooms', 4, 10); D('moss_patch', 16, 6); D('pebbles', 9, 13); D('mushrooms', 16, 12)
FD('stalactites_face', 9, 3); FD('stalactites_face_b', 12, 3); FD('bats_hanging', 4, 3); FD('cobweb', 2, 5)
# C 지하 호수: 징검돌로 섬(유해·상자)에, 물가 바위·이끼
for i, p in enumerate(STONES): D(None, p[0], p[1], R.stepping_stone(i * 3 + 1))
D('skeleton_remains', 39, 10); P('chest_closed', 41, 9, soft=False); P('stalagmite_m', 40, 9, img=R.stalagmite('m', 27)); P('stalagmite_s', 39, 11, img=R.stalagmite('s', 28)); D('moss_patch', 41, 10, R.moss_patch(3))
P('boulder_moss', 30, 9, soft=False); P('boulder_wide', 30, 12, soft=False); P('stalagmite_m', 31, 6, img=R.stalagmite('m', 29))
P('column_drip', 33, 6, img=R.column_drip(7)); P('stalagmite_cluster', 45, 11)
D('moss_patch', 31, 8); D('mushrooms', 29, 10); D('moss_patch', 32, 13); D('moss_patch', 44, 14)
FD('stalactites_face', 37, 3); FD('bats_hanging', 41, 2); FD('stalactites_face_b', 33, 3)
m.overlays.append((int(37.5 * T), int(12.5 * T), S['bat_flying'])); m.overlays.append((int(42.6 * T), int(5.8 * T), R.bat_flying(3)))
m.props_add(25, 20, S['bridge_plank'], block=[], layer=0)
D('moss_patch', 27, 14); P('stalagmite_s', 29, 14, img=R.stalagmite('s', 31))
P('boulder_s', 26, 15, soft=False, img=R.boulder('s', 33)); D('pebbles', 25, 13)
# E 보물 방
P('chest_closed', 38, 30, soft=False); P('chest_closed', 42, 30, soft=False); P('chest_open', 40, 30, soft=False)
D('gold_pile', 39, 31); D('gold_pile', 41, 31, R.gold_pile(3))
P('torch_stand', 37, 31); GLOW(37, 30); P('torch_stand', 43, 31); GLOW(43, 30)
FD('wall_torch', 40, 27); GLOW(40, 27.6)
FD('cobweb', 37, 26); D('bones', 36, 33)
P('stalagmite_m', 35, 31, img=R.stalagmite('m', 35)); P('boulder_wide', 42, 35, soft=False); D('pebbles_b', 38, 34); P('stalagmite_s', 44, 33, img=R.stalagmite('s', 36))
P('skull_stake', 34, 31); D('pebbles', 33, 29)
# F 내림 계단
m.props_add(24, 36, S['stairs_down_broken'], block=[], layer=0)
P('skull_stake', 22, 34); D('bones', 22, 35); P('rubble', 27, 34, soft=False); D('pebbles', 26, 36, R.pebbles(9))
P('stalagmite_m', 28, 33, img=R.stalagmite('m', 37)); P('boulder_s', 21, 36, soft=False, img=R.boulder('s', 39))
FD('bats_hanging', 25, 29); D('pebbles_b', 23, 32)
# 빈 바닥 깨기 (덩이로, 잔돌·이끼·버섯)
for (nm, x, y) in (('pebbles', 23, 30), ('pebbles_b', 16, 20), ('pebbles', 24, 22), ('pebbles_b', 19, 27), ('mushrooms', 18, 23), ('moss_patch', 22, 27),
                   ('pebbles', 8, 31), ('pebbles_b', 12, 33), ('mushrooms', 3, 31), ('pebbles', 26, 21), ('pebbles_b', 30, 27), ('moss_patch', 32, 29)):
    D(nm, x, y, R.pebbles(x * 7 + y) if nm.startswith('pebbles') else None)

# ================================================================== 저장·검사
ENT = (9, 29)
POI = {'입구 아치': ENT, '갈림길': (23, 25), '석순 회랑': (9, 10), '다리': (25, 18), '호수 서안': SHORE, '섬(징검돌 끝)': (40, 10),
       '보물 방': (40, 32), '내림 계단': (24, 34), '북쪽 고리': (23, 7)}
for comp in m.components():                       # 바위 턱 뒤에 갇힌 한두 칸은 턱에 합친다
    if len(comp) < 8:
        for c in comp: LEDGE.add(c); m.blocked.add(c); CRACK.discard(c)
kit.save()
data = m.export(OUT, ENT, POI['보물 방'], POI)
img = m.img
bad = [k for k, v in data['waypoints'].items() if not v['reach']]
print('도달 못함:', bad, '| 걷는 덩어리', data['walk_components'], data['component_sizes'])

# 빈 바닥 (20x15 창): 걷는 칸 중 소품·장식·오토타일·물이 없는 칸
used = set()
for (x, y, im_, w_, h_, l_) in m.props:
    for dy in range(-(-im_.height // T)):
        for dx in range(-(-im_.width // T)): used.add((x + dx, y - dy))
for (x, y, im_) in m.decals:
    for dy in range(-(-im_.height // T)):
        for dx in range(-(-im_.width // T)): used.add((int(x) + dx, int(y) + dy))
used |= CRACK | LEDGE | WATER | STAIRS | BRIDGE
empty = {(x, y) for (x, y) in FL if (x, y) not in used}
worst = (0, None); over = 0
for y0 in range(0, H - 15 + 1, 2):
    for x0 in range(0, W - 20 + 1, 2):
        c = sum(1 for (x, y) in empty if x0 <= x < x0 + 20 and y0 <= y < y0 + 15) / 300
        if c > worst[0]: worst = (c, (x0, y0))
        if c > .4: over += 1
if '--empty' in sys.argv:
    for y in range(H): print('%2d ' % y + ''.join('o' if (x, y) in empty else ('.' if (x, y) in FL and (x, y) not in WATER else ('~' if (x, y) in WATER else ' ')) for x in range(W)))
print('빈 바닥 최대 %.2f at %s, 40%% 넘는 창 %d' % (worst[0], worst[1], over))
g = json.load(open(os.path.join(OUT, 'grid.json')))
g.update(emptiness=dict(max=round(worst[0], 3), at=worst[1], over40=over), legend={'1': '걷는다', '0': '막힘(벽·물·암반 턱·소품)'})
json.dump(g, open(os.path.join(OUT, 'grid.json'), 'w'), ensure_ascii=False, indent=1)

# 통행 겹침 (QA)
ov = img.convert('RGBA').copy(); d = ImageDraw.Draw(ov, 'RGBA')
for y, row in enumerate(g['grid']):
    for x, ch in enumerate(row):
        if ch == '1': d.rectangle((x * T + 5, y * T + 5, x * T + 10, y * T + 10), fill=(60, 230, 90, 150))
ov.save(os.path.join(QA, 'walk-overlay.png'))
# 사분면
for i, (x0, y0) in enumerate(((0, 0), (24, 0), (0, 20), (24, 20))):
    img.crop((x0 * T, y0 * T, (x0 + 24) * T, (y0 + 20) * T)).convert('RGB').save(os.path.join(QA, 'quad-%d.png' % i))
print('조각', len(kit.order))
