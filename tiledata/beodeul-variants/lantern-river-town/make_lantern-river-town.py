# 등불 수향 마을(lantern-river-town) — 무협 장르 장소 팩, 64x48 데모 맵. 다시 돌리면 같은 그림이 나온다.
#   python3 make_lantern-river-town.py            (전체: 조각 내보내기 + 렌더 + 격자 + 비교 + 오토타일 시험 + 전투 배경)
#   python3 make_lantern-river-town.py --quick    (_qa/map1x.png 만)
# 칠하는 순서 = 조수가 따라 할 순서: ① 맨 바탕 표본(ground-*) → ② 땅 덩이 오토타일(운하·젖은 석판·연잎) → ③ 건물·다리·소품.
# 동선: 남쪽 패루(29~30,47) → 큰길(28~30) 북으로 장터 광장 → 남북 돌다리로 큰 운하를 건너 → 북쪽 동서 거리(12~13) →
#   동쪽 아치 돌다리로 갈래 운하를 건너 동쪽 마을 / 서쪽 연못가 찻집. 광장 동쪽 = 2층 객잔, 남동 = 염색 마당.
import sys, os, json, math, random
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import numpy as np
from PIL import Image
from lr_base import *
from lr_base import _hash
from lr_scene import Scene
import lr_build as B, lr_props as P

W, H = 64, 48
s = Scene(W, H, base='ground-grass')
R = s.ground


def put(im, x, y, block='bottom', rows=1, name=None, **kw):
    s.at(im, x, y, block=block, rows=rows, name=name, **kw)


# ================================================================ ① 맨 바탕 표본
# 길: 화강암 판석(큰길·운하 둑 거리·장터 광장), 흙(뒷골목), 회청 벽돌(객잔 앞마당), 부두 널(남쪽 물가 판잣길)
R('ground-flagstone', 28, 14, 30, 47)                      # 남북 큰길(패루 → 돌다리 → 북쪽 거리)
R('ground-flagstone', 8, 12, 63, 13)                       # 북쪽 동서 거리
R('ground-flagstone', 13, 20, 43, 21)                      # 큰 운하 북쪽 둑 거리(갈래 운하 서쪽)
R('ground-flagstone', 48, 20, 63, 21)                      # 큰 운하 북쪽 둑 거리(갈래 운하 동쪽)
R('ground-flagstone', 13, 26, 63, 27)                      # 큰 운하 남쪽 둑 거리
R('ground-flagstone', 14, 28, 44, 41)                      # 장터 광장
R('ground-dock', 31, 26, 43, 27)                           # 남쪽 물가 판잣길(부두 앞)
R('ground-brick', 35, 37, 44, 40)                          # 객잔 앞마당
R('ground-flagstone-moss', 2, 16, 8, 16)                   # 연못가 찻집 앞 이끼 판석
R('ground-flagstone-moss', 8, 14, 8, 15)
R('ground-dirt', 46, 28, 63, 29); R('ground-dirt', 46, 40, 63, 41); R('ground-dirt', 45, 28, 45, 41)   # 염색 마당·남동 골목
R('ground-dirt', 0, 0, 63, 0)                              # 북쪽 끝 뒷골목(집 뒤)

def blob(cx, cy, rx, ry, seed):
    out = set()
    for y in range(int(cy - ry - 1), int(cy + ry + 2)):
        for x in range(int(cx - rx - 1), int(cx + rx + 2)):
            dx = (x - cx) / rx; dy = (y - cy) / ry
            if dx * dx + dy * dy < 1 + .25 * math.sin(x * 2.1 + y * 1.3 + seed): out.add((x, y))
    return out
# 풀 변화: 그늘 풀(버드나무·대숲 밑)·들풀(마을 가장자리) 을 직사각이 아니라 덩이로
for (cx, cy, rx, ry, sd, g) in ((5, 40, 7, 6, 1, 'ground-grass-shade'), (61, 44, 3, 3, 3, 'ground-grass-shade'),
                                (20, 45, 6, 2.6, 4, 'ground-grass-meadow'), (39, 45, 5, 2.4, 5, 'ground-grass-meadow'), (55, 3, 6, 2.5, 6, 'ground-grass-meadow'),
                                (8, 3, 5, 2.4, 7, 'ground-grass-meadow'), (53, 31, 5, 2, 8, 'ground-grass-meadow')):
    s.ground_cells(g, [c for c in blob(cx, cy, rx, ry, sd) if 0 <= c[0] < W and 0 <= c[1] < H and s.g[c[1], c[0]] == 'ground-grass'])

# ================================================================ ② 땅 덩이 오토타일
# 큰 운하(동서, 4줄) — 둑이 곧게 줄 서지 않게 곳곳에 한 칸씩 부푼다(다리·부두 자리는 곧게).
canal = set()
for x in range(0, W):
    for y in range(22, 26): canal.add((x, y))
for (x0, x1, y) in ((50, 54, 26), (58, 61, 21), (16, 19, 21), (56, 60, 26)):
    for x in range(x0, x1 + 1): canal.add((x, y))
# 갈래 운하(남북, 4칸 폭) — 북쪽 끝에서 큰 운하로
for y in range(0, 22):
    for x in range(44, 48): canal.add((x, y))
for (x, y) in ((43, 4), (43, 5), (48, 7), (48, 8)): canal.add((x, y))
# 서쪽 연못(큰 운하가 넓어진 곳) — 불규칙 덩이
for y in range(16, 32):
    for x in range(0, 14):
        dx = (x - 5.5) / 7.2; dy = (y - 23.5) / 7.6
        wob = .16 * math.sin(x * 1.3 + y * .7) + .1 * math.cos(y * 1.9)
        if dx * dx + dy * dy < 1 + wob: canal.add((x, y))
s.paint('autotile-canal', canal)
for c in [(x, y) for (x, y) in canal if (x, y) in {(x, y) for x in range(13, 16) for y in range(16, 32)} and y not in range(22, 26)]: pass
# 연잎 덩이: 연못 안 둘, 큰 운하 동쪽 끝 하나(물 안쪽, 둑에서 한 칸 띄움)
lotus = set()
lotus |= blob(4.0, 20.5, 2.6, 2.2, 1); lotus |= blob(8.0, 27.0, 2.8, 1.8, 2); lotus |= blob(61.0, 23.5, 1.8, 1.2, 3)
lotus = {c for c in lotus if c in canal and all(((c[0] + dx, c[1] + dy) in canal) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))}
s.paint('autotile-lotus', lotus)

# 판석 길 연석: 판석 칸 전부에 덧칠(속은 같은 판 줄이라 이음새 없음, 풀·흙과 닿는 쪽에만 연석이 선다)
flag_cells = {(x, y) for y in range(H) for x in range(W) if s.g[y, x] in ('ground-flagstone', 'ground-flagstone-moss') and (x, y) not in canal}
s.paint('autotile-flagstone-curb', flag_cells)
# 젖은 석판: 물가 계단·부두·우물 둘레에 덩이로(같은 판 줄 위에 젖은 판)
wet = set()
for (cx, cy, rx, ry, sd) in ((23.5, 20.5, 2.6, 1.2, 1), (35.0, 20.6, 2.4, 1.1, 2), (51.0, 20.4, 2.0, 1.0, 3), (18.0, 26.6, 3.4, 1.1, 4),
                             (32.5, 33.5, 2.2, 1.8, 5), (46.0, 26.5, 2.6, 1.0, 6), (29.0, 39.0, 1.6, 1.6, 7)):
    wet |= {c for c in blob(cx, cy, rx, ry, sd) if c in flag_cells}
s.paint('autotile-wet-flagstone', wet)
s.marks['south_gate'] = (29, 47)

# ================================================================ ③ 다리·부두·물가 계단
put(B.stone_bridge_ns(rows=6), 28, 26, block=None, walk=[(i, -j) for i in range(3) for j in range(6)], name='stone_bridge_ns')
s.marks['stone_bridge'] = (29, 23)
put(B.arch_bridge(6), 43, 15, block=[(i, -j) for i in range(6) for j in (0, 1, 4)], walk=[(i, -j) for i in range(6) for j in (2, 3)], name='arch_bridge')
s.marks['arch_bridge'] = (45, 12)
put(B.plank_bridge_ew(6), 43, 21, block=None, walk=[(i, -j) for i in range(6) for j in (0, 1)], name='plank_bridge_ew')
put(B.dock(4, 2), 22, 24, dy=-6, block=None, walk=[(i, j) for i in range(4) for j in (-2, -1)], name='dock')
put(B.dock(4, 2, seed=9, face=False), 36, 25, block=None, walk=[(i, -j) for i in range(4) for j in (0, 1)], name='dock_south')
s.marks['pier'] = (37, 24)
put(B.canal_steps(3), 34, 22, block=None, walk=[(0, -1), (1, -1), (2, -1), (1, 0)], name='canal_steps')
put(B.canal_steps(3, seed=10), 50, 22, block=None, walk=[(0, -1), (1, -1), (2, -1), (1, 0)], name='canal_steps')
# 배(물 칸 위 — 원래 막힘)
put(P.sampan(1), 14, 24, block=None, name='sampan'); put(P.sampan(2, flip_=True), 53, 24, block=None, name='sampan')
put(P.skiff(3), 41, 25, block=None, name='skiff'); put(P.skiff(4, flip_=True), 2, 25, block=None, name='skiff')
put(P.boat_ns(5), 45, 6, block=None, name='boat_ns')
put(P.mooring_post(1), 21, 21, block='all', name='mooring_post'); put(P.mooring_post(2), 13, 26, block='all', name='mooring_post')
put(P.mooring_post(3), 40, 26, block='all', name='mooring_post')

# ================================================================ ④ 북쪽 마을(동서 거리 북쪽, 문은 남쪽 거리로)
DOOR = lambda w: [(w // 2, 0)]
def house(w, st, x, y, seed, **kw):
    im = B.house_white(w, st, seed, **kw)
    put(im, x, y, block='bottom', rows=2, walk=DOOR(w) if not kw.get('canal') else (), name='house_white_%d%s' % (w, 'b' if st == 2 else 'a'))
    s.marks.setdefault('doors', []).append((x + w // 2, y))
put(B.teahouse(), 1, 15, block=[(0, 0), (5, 0), (0, -1), (5, -1), (1, -1), (2, -1), (3, -1), (4, -1)], walk=[(1, 0), (2, 0), (3, 0), (4, 0)], name='teahouse')
s.marks['teahouse'] = (3, 15)
house(4, 1, 2, 8, 17)
house(5, 2, 9, 11, 11); house(4, 1, 15, 11, 12)
put(P.bamboo_clump(1), 20, 11, block=[(0, 0), (1, 0)], name='bamboo_clump')
put(P.plum_tree(1), 22, 10, block=[(0, 0), (1, 0)], name='plum_tree')
put(P.stone_lion(1), 24, 11, block=[(0, 0)], name='stone_lion'); put(P.stone_lion(1, flip_=True), 27, 11, block=[(0, 0)], name='stone_lion')
put(P.incense_burner(1), 25, 10, block=[(0, 0), (1, 0)], name='incense_burner')
s.marks['incense'] = (25, 12)
house(6, 2, 28, 11, 13); house(5, 1, 35, 11, 14)
put(P.willow(1), 40, 10, block=[(1, 0)], name='willow')
house(6, 2, 49, 11, 15); house(4, 1, 56, 11, 16)
put(P.bamboo_clump(2), 61, 11, block=[(0, 0), (1, 0)], name='bamboo_clump')
# 가운데 줄(동서 거리 ~ 운하 북쪽 둑 거리 사이, 문은 운하 쪽)
house(5, 1, 13, 19, 21); house(4, 1, 19, 19, 22)
put(P.willow(2, flip_=True), 23, 19, block=[(1, 0)], name='willow')
house(6, 1, 32, 19, 23); house(5, 1, 38, 19, 24, gable_steps=1)
house(5, 1, 49, 19, 25, gable_steps=1); house(4, 1, 55, 19, 26)
put(P.willow(3), 60, 19, block=[(1, 0)], name='willow')

# ================================================================ ⑤ 장터 광장 + 객잔
put(B.inn(), 36, 36, block=[(i, -j) for i in range(8) for j in (0, 1)], walk=[(3, 0), (4, 0)], name='inn')
s.marks['inn_door'] = (39, 36)
put(P.lantern_post(1), 35, 38, block=[(0, 0)], name='lantern_post'); put(P.lantern_post(2), 44, 38, block=[(0, 0)], name='lantern_post')
put(P.potted_pine(1), 37, 37, block='all', name='potted_pine'); put(P.potted_pine(2), 42, 37, block='all', name='potted_pine')
put(P.wine_flag(1), 44, 35, block=[(0, 0)], name='wine_flag')
put(P.water_jar(0), 35, 36, block=[(0, 0)], name='water_jar'); put(P.wine_jars(1), 42, 40, block='all', name='wine_jars')
# 노점 줄(서쪽) — 차양 칸은 걷기 + 위층, 판대 줄 막힘
put(P.cloth_stall(1), 15, 31, block='bottom', name='cloth_stall'); s.marks['cloth_stall'] = (16, 32)
put(P.food_stall(2), 20, 31, block='bottom', name='food_stall')
put(P.lantern_stall(3), 23, 31, block='bottom', name='lantern_stall')
put(P.tea_stall(4), 15, 36, block='bottom', name='tea_stall')
put(P.umbrella_stand(5), 18, 36, block='bottom', name='umbrella_stand')
put(P.hand_cart(6), 21, 36, block='bottom', name='hand_cart')
put(P.cloth_sacks(7), 24, 35, block='all', name='cloth_sacks'); put(P.steamer_baskets(8), 23, 36, block='all', name='steamer_baskets')
put(P.crates(9), 26, 36, block='bottom', name='crates')
put(P.tea_table(1), 16, 40, block=[(0, 0), (1, 0)], name='tea_table'); put(P.tea_table(2), 20, 40, block=[(0, 0), (1, 0)], name='tea_table')
put(P.bench(1), 23, 40, block='all', name='bench'); put(P.water_jar(1), 26, 40, block=[(0, 0)], name='water_jar')
# 큰길 동쪽: 우물 + 술독
put(P.well_cn(1), 32, 34, block=[(0, 0), (1, 0)], name='well_cn'); s.marks['well'] = (32, 35)
put(P.wine_jars(2), 33, 30, block='all', name='wine_jars'); put(P.crates(3), 35, 30, block='bottom', name='crates')
# 홍등 기둥 + 줄(큰길 위, 기둥 둘 사이 공중에 위층으로)
for (y, sd) in ((30, 1), (34, 2), (38, 3)):
    put(P.lantern_post(sd + 10), 27, y, block=[(0, 0)], name='lantern_post'); put(P.lantern_post(sd + 20), 31, y, block=[(0, 0)], name='lantern_post')
    s.topimg(P.lantern_string(4, seed=sd), 27 * 16 + 8, (y + 1) * 16 - 48 + 4, name='lantern_string')
for (x0, y) in ((14, 21), (48, 21)):                                       # 운하 둑 거리 위
    put(P.lantern_post(x0), x0, y - 1, block=[(0, 0)], name='lantern_post')
put(P.lantern_post(5), 18, 27, block=[(0, 0)], name='lantern_post'); put(P.lantern_post(6), 24, 27, block=[(0, 0)], name='lantern_post')
s.topimg(P.lantern_string(6, seed=9), 18 * 16 + 8, 28 * 16 - 48 + 4, name='lantern_string')

# ================================================================ ⑥ 남서 버드나무 찻뜰(연못 남쪽 기슭) — 이끼 판석 길 + 뜰 정자(찻집 조각을 정자로)
moss_path = s.rect_cells(5, 38, 13, 38) + s.rect_cells(7, 39, 7, 47) + s.rect_cells(0, 47, 6, 47) + s.rect_cells(8, 47, 10, 47)
s.ground_cells('ground-flagstone-moss', moss_path); s.paint('autotile-flagstone-curb', moss_path)
put(B.teahouse(seed=9), 1, 46, block=[(0, 0), (5, 0), (0, -1), (5, -1), (1, -1), (2, -1), (3, -1), (4, -1)], walk=[(1, 0), (2, 0), (3, 0), (4, 0)], name='teahouse')
s.marks['garden_pavilion'] = (3, 46)
put(P.willow(4), 0, 37, block=[(1, 0)], name='willow'); put(P.willow(5, flip_=True), 10, 35, block=[(1, 0)], name='willow')
put(P.willow(9, flip_=True), 3, 34, block=[(1, 0)], name='willow')
put(P.tea_table(3), 9, 41, block=[(0, 0), (1, 0)], name='tea_table'); put(P.tea_table(4), 11, 44, block=[(0, 0), (1, 0)], name='tea_table')
put(P.lotus_basin(1), 8, 46, block=[(0, 0), (1, 0)], name='lotus_basin'); put(P.plum_tree(2), 12, 40, block=[(0, 0), (1, 0)], name='plum_tree')
put(P.bamboo_clump(3), 12, 47, block=[(0, 0), (1, 0)], name='bamboo_clump'); put(P.reed_clump(1), 12, 32, block=[(0, 0)], name='reed_clump')
put(P.reed_clump(2), 0, 32, block=[(0, 0)], name='reed_clump'); put(P.bench(2), 5, 36, block='all', name='bench')
put(P.lantern_post(9), 8, 39, block=[(0, 0)], name='lantern_post'); put(P.lantern_post(19), 6, 39, block=[(0, 0)], name='lantern_post')
put(P.bush_round(2), 0, 40, block='all', name='bush_round'); put(P.bush_round(5), 6, 41, block='all', name='bush_round')
put(P.stone_lion(5), 0, 47, block=[(0, 0)], name='stone_lion')

# ================================================================ ⑦ 남동 염색 마당 + 집 — 마당은 이끼 판석(일하는 마당), 둘레는 풀
yard = s.rect_cells(46, 30, 57, 39)
s.ground_cells('ground-flagstone-moss', yard); s.paint('autotile-flagstone-curb', yard)
put(P.dye_rack(1), 48, 36, block='bottom', name='dye_rack'); s.marks['dye_rack'] = (49, 37)
put(P.dye_rack(2), 53, 36, block='bottom', name='dye_rack')
house(5, 2, 58, 36, 31)
put(P.water_jar(2, lid=False), 52, 37, block=[(0, 0)], name='water_jar'); put(P.water_jar(3, lid=False), 57, 38, block=[(0, 0)], name='water_jar')
put(P.laundry_pole(1), 47, 39, block=[(0, 0), (2, 0)], name='laundry_pole')
put(P.cloth_sacks(2), 61, 39, block='all', name='cloth_sacks'); put(P.firewood(1), 51, 31, block='all', name='firewood')
put(P.bamboo_clump(4), 62, 33, block=[(0, 0), (1, 0)], name='bamboo_clump')
put(P.reed_clump(3), 55, 28, block=[(0, 0)], name='reed_clump'); put(P.willow(6), 46, 33, block=[(1, 0)], name='willow')
R('ground-dirt', 45, 47, 63, 47)
house(5, 1, 47, 46, 32); house(4, 1, 53, 46, 33)
put(P.bamboo_clump(5), 58, 47, block=[(0, 0), (1, 0)], name='bamboo_clump'); put(P.willow(7, flip_=True), 60, 46, block=[(1, 0)], name='willow')

# ================================================================ ⑧ 남쪽 들머리: 패루 + 집 + 버드나무
put(B.paifang(), 27, 47, block=[(0, 0), (1, 0), (4, 0), (5, 0)], walk=[(2, 0), (3, 0)], name='paifang')
put(P.stone_lion(2), 26, 47, block=[(0, 0)], name='stone_lion'); put(P.stone_lion(2, flip_=True), 33, 47, block=[(0, 0)], name='stone_lion')
R('ground-dirt', 14, 47, 26, 47); R('ground-dirt', 33, 47, 44, 47)
house(5, 1, 15, 46, 41); house(4, 1, 21, 46, 42); house(5, 1, 35, 46, 43); house(4, 1, 40, 46, 44)
put(P.plum_tree(3), 25, 45, block=[(0, 0), (1, 0)], name='plum_tree'); put(P.bush_round(3), 33, 44, block='all', name='bush_round')

# ================================================================ ⑨ 채움(집 뒤뜰·빈 풀밭 — 덩이로, 길·문 앞·물가 피함)
put(P.lotus_basin(2), 32, 40, block=[(0, 0), (1, 0)], name='lotus_basin'); put(P.bench(3), 33, 37, block='all', name='bench')
for (fn, x, y, blk) in ((P.bamboo_clump, 0, 7, [(0, 0), (1, 0)]), (P.bush_round, 7, 4, 'all'), (P.bush_round, 8, 5, 'all'),
                        (P.plum_tree, 19, 4, [(0, 0), (1, 0)]), (P.bush_round, 14, 3, 'all'), (P.bamboo_clump, 34, 4, [(0, 0), (1, 0)]),
                        (P.bush_round, 41, 3, 'all'), (P.bush_round, 50, 3, 'all'), (P.plum_tree, 54, 4, [(0, 0), (1, 0)]),
                        (P.bush_round, 60, 3, 'all'), (P.bush_round, 61, 4, 'all'), (P.bush_round, 27, 4, 'all')):
    put(fn(x + y), x, y, block=blk, name=fn.__name__)
put(P.willow(8), 57, 31, block=[(1, 0)], name='willow'); put(P.wine_jars(4), 49, 30, block='all', name='wine_jars')
put(P.water_jar(4), 60, 31, block=[(0, 0)], name='water_jar'); put(P.bush_round(9), 62, 30, block='all', name='bush_round')
put(P.reed_clump(4), 13, 31, block=[(0, 0)], name='reed_clump')
for (x, y) in ((20, 44), (26, 42), (34, 44), (44, 44), (45, 45), (52, 44), (19, 43)):
    put(P.bush_round(x * 3 + y), x, y, block='all', name='bush_round')

if __name__ == '__main__' and '--stage3' in sys.argv:
    os.makedirs(os.path.join(HERE, '_qa'), exist_ok=True)
    s.render().convert('RGB').save(os.path.join(HERE, '_qa', 'map1x.png')); print('stage3')

if __name__ == '__main__' and '--stage2' in sys.argv:
    os.makedirs(os.path.join(HERE, '_qa'), exist_ok=True)
    s.render().convert('RGB').save(os.path.join(HERE, '_qa', 'map1x.png')); print('stage2')

if __name__ == '__main__' and '--stage1' in sys.argv:
    os.makedirs(os.path.join(HERE, '_qa'), exist_ok=True)
    s.render().convert('RGB').save(os.path.join(HERE, '_qa', 'map1x.png')); print('stage1')


# 집 뒤 대숲(북쪽 끝 띠 — 강남 물마을 집 뒤는 대숲이다): 그늘 풀 위에 대나무 덤불을 2~3칸 간격으로 엇갈려 빽빽이, 뒷골목(0줄)만 비운다
R('ground-grass-shade', 0, 1, 42, 4); R('ground-grass-shade', 49, 1, 63, 4)
rb = random.Random(7)
x = 0
while x < 63:
    if 43 <= x <= 48: x = 49; continue
    y = 4 if rb.random() < .6 else 3
    ok = all(not s.block[yy, xx] for xx in (x, x + 1) for yy in range(y - 3, y + 1) if xx < W)
    if ok and x + 1 < W and not (43 <= x + 1 <= 48):
        put(P.bamboo_clump(100 + x), x, y, block=[(0, 0), (1, 0)], name='bamboo_clump', occ=False)
    x += 2 + (1 if rb.random() < .35 else 0)
for (x, y) in ((6, 4), (25, 4), (42, 4), (55, 4)):
    if not s.block[y, x]: put(P.bush_round(x + 7 * y), x, y, block='all', name='bush_round', occ=False)

for (fn, x, y, blk) in ((lambda: P.water_jar(5), 14, 11, [(0, 0)]), (lambda: P.plum_tree(6), 6, 8, [(0, 0), (1, 0)]), (lambda: P.firewood(2), 7, 11, 'all'),
                        (lambda: P.water_jar(6, lid=False), 19, 11, [(0, 0)]), (lambda: P.potted_pine(3), 8, 11, 'all'),
                        (lambda: P.plum_tree(7), 26, 8, [(0, 0), (1, 0)]), (lambda: P.bench(5), 23, 7, 'all'), (lambda: P.bush_round(41), 42, 9, 'all'),
                        (lambda: P.water_jar(8), 34, 11, [(0, 0)])):
    if s.free(x, y): put(fn(), x, y, block=blk, name='fill')

# ================================================================ 검사 + 내보내기
def check():
    g = s.walk_grid()
    seen = s.bfs(s.marks['south_gate'])
    reach = {}
    for k, v in s.marks.items():
        if k == 'doors':
            reach['doors'] = all(tuple(c) in seen for c in v)
            bad = [c for c in v if tuple(c) not in seen]
            if bad: print('  unreachable doors', bad)
        elif k != 'south_gate': reach[k] = tuple(v) in seen
    walk = int(g.sum()); reach['_reached'] = len(seen)
    isolated = [(x, y) for y in range(H) for x in range(W) if g[y, x] and (x, y) not in seen]
    e = s.empty(); (wr, wx, wy), mean = s.worst(e)
    ws = sorted(((e[y:y + 15, x:x + 20].mean(), x, y) for y in range(0, H - 14, 3) for x in range(0, W - 19, 4)), reverse=True)[:4]
    print('worst windows', [(round(a, 2), x, y) for a, x, y in ws])
    print('reach', {k: v for k, v in reach.items() if v is not True}, 'walk', walk, 'reached', len(seen), 'isolated', len(isolated), isolated[:12])
    print('empty window worst %.2f at (%d,%d) mean %.2f' % (wr, wx, wy, mean))
    return reach, ((wr, wx, wy), mean), isolated


if __name__ == '__main__' and not any(a.startswith('--stage') for a in sys.argv):
    os.makedirs(os.path.join(HERE, '_qa'), exist_ok=True)
    im = s.render()
    im.convert('RGB').save(os.path.join(HERE, '_qa', 'map1x.png'))
    reach, dens, iso = check()
    if '--quick' in sys.argv: sys.exit(0)
    import lr_export as X
    n = X.export_parts(); print('parts', n)
    X.export_map(s, im, reach, dens)
    print('done')
