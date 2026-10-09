# 산중 무림 문파 (wuxia-sect-mountain) — 64x48 한 판, 세 단(아래 산문 마당 · 가운데 연무장 · 위 대전 마당) 을 절벽 띠 둘이 가른다.
# 다시 돌리면 같은 그림이 나온다.   python3 make_wuxia-sect-mountain.py   (--quick = _qa/map1x.png 만)
# 동선: 남쪽 흙 산길(31,47) → 산문 문길(30~32, y38~40) → 이끼 돌판 마당 → 가파른 돌계단(30~33, y31~33) → 연무장(판석) →
#       돌계단(30~33, y11~14) → 대전 마당 → 대전 문(31,7). 곁길: 연무장 서쪽 → 폭포 웅덩이 · 정자 / 동쪽 → 숙소 · 단약 화로 /
#       대전 마당 동쪽 끝(46,10) → 절벽 잔도(y11) → 수련 동굴(61,11).
# 칠하는 순서: 맨 바탕 표본 → 땅 덩이 오토타일 → 절벽 띠 → 건물·소품(밑변 순) → 구름·안개(맨 위).
import sys, os, math, random
sys.dont_write_bytecode = True
_HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, _HERE)
import numpy as np
from PIL import Image
import ws_base
from ws_base import _hash, smooth
from ws_scene import Scene
import ws_build as B, ws_props as P, ws_cliff as C
HERE = _HERE

W, H = 64, 48
rng = random.Random(4864)
s = Scene(W, H, seed=48)
R = s.rect; AR = s.arect


def put(im, x, y, block='bottom', rows=1, name=None, **kw): s.at(im, x, y, block=block, rows=rows, name=name, **kw)


# ================================================================ ① 맨 바탕: 판석 마당·암반
R('court', 20, 8, 47, 10)                                   # 대전 마당(위 단)
R('court', 25, 6, 46, 7)                                    # 대전·장경각 밑 마당
R('court', 23, 17, 41, 27)                                  # 연무장(가운데 단)
for (x, y0, y1) in ((22, 18, 26), (42, 18, 26), (21, 20, 24), (43, 20, 23)): R('court', x, y0, x, y1)
for (x0, x1, y) in ((25, 39, 16), (24, 40, 28)): R('court', x0, y, x1, y)
R('court', 30, 29, 33, 30); R('court', 30, 15, 33, 15)      # 계단 앞뒤
R('rock', 48, 0, 63, 10)                                    # 북동 바위 산덩이(못 간다)
for (x, y) in [(47, 0), (47, 1), (46, 0), (47, 2)]: s.m['rock'][y, x] = True

# ================================================================ ② 절벽 띠 + 계단
def profile(x0, x1, top, bot, seed):
    """열마다 위·아래 줄을 0/−1/+1 로 흔든 절벽 띠 윤곽(같은 높이가 3~6 열 이어진다 — 일직선 띠 금지)."""
    tops, bots = [], []; x = x0; i = 0
    while x <= x1:
        run = 3 + int(_hash(i, seed, 3) * 4); dt = [0, -1, 0, 1][int(_hash(i, seed, 4) * 4)]; db = [0, 1, 0, -1][int(_hash(i, seed, 5) * 4)]
        for _ in range(min(run, x1 - x + 1)): tops.append(top + dt); bots.append(bot + db); x += 1
        i += 1
    return tops, bots
BANDS = [(0, 29, 11, 15, 1), (34, 63, 11, 15, 2), (0, 29, 31, 34, 3), (34, 63, 31, 34, 4)]
for (x0, x1, t, b, sd) in BANDS:
    tp, bt = profile(x0, x1, t, b, sd)
    if x1 == 29: tp[-3:] = [t] * 3; bt[-3:] = [b] * 3                            # 계단 옆 열은 계단 높이에 맞춘다
    if x0 == 34: tp[:3] = [t] * 3; bt[:3] = [b] * 3
    if t == 11 and x0 == 34: tp[12:] = [t] * len(tp[12:])                        # 잔도 구간은 위 줄 고정(잔도 = y11 널 줄)
    if t == 11 and x0 == 0: tp[3:8] = [t] * 5; bt[3:8] = [b] * 5                 # 폭포 구간
    s.band(x0, x1, tp, bt)
put(C.steep_stair(4, 4), 30, 14, block=None, walk=[(i, -j) for i in range(4) for j in range(4)], name='steep_stair', shadow=False)
put(C.steep_stair(4, 3, seed=14), 30, 33, block=None, walk=[(i, -j) for i in range(4) for j in range(3)], name='steep_stair', shadow=False)
for y in range(11, 15):
    for x in range(30, 34): s.block[y, x] = False
for y in range(31, 34):
    for x in range(30, 34): s.block[y, x] = False

# ================================================================ ③ 땅 덩이 오토타일
POOL = {15: (1, 8), 16: (0, 9), 17: (0, 9), 18: (1, 8), 19: (2, 7), 20: (3, 5)}
for y, (a, b) in POOL.items(): AR('pool', a, y, b, y)
for y in range(2, 11): AR('pool', 4 + (1 if 5 <= y <= 7 else 0), y, 6 + (1 if 5 <= y <= 7 else 0), y)   # 위 단 개울 → 폭포
AR('pool', 3, 1, 7, 2); AR('pool', 2, 0, 8, 0)
# 흙 산길(아래 단): 남쪽 입구 → 산문
for y in range(41, 48):
    x0 = 30 + (1 if 43 <= y <= 45 else 0) - (1 if y >= 47 else 0)
    AR('trail', x0, y, x0 + 2, y)
AR('trail', 18, 42, 29, 43); AR('trail', 12, 40, 18, 41); AR('trail', 33, 42, 44, 43); AR('trail', 44, 40, 50, 41)
# 이끼 돌판: 산문 안쪽 마당, 정자 앞, 숙소 앞
for y, (a, b) in {34: (26, 37), 35: (27, 36), 36: (27, 35), 37: (28, 34)}.items(): AR('mossflag', a, y, b, y)
for y, (a, b) in {20: (10, 14), 21: (9, 15), 22: (11, 14)}.items(): AR('mossflag', a, y, b, y)
for y, (a, b) in {21: (45, 61), 22: (46, 62), 23: (48, 55)}.items(): AR('trail', a, y, b, y)
for y, (a, b) in {17: (19, 21), 18: (19, 20), 26: (20, 22), 27: (20, 23), 28: (21, 22)}.items(): AR('mossflag', a, y, b, y)
for y, (a, b) in {16: (41, 44), 17: (42, 44), 27: (42, 44), 28: (41, 43)}.items(): AR('mossflag', a, y, b, y)

# ================================================================ ④ 위 단(대전 마당)
put(B.main_hall(1), 27, 8, block=[(i, -j) for i in range(10) for j in range(4) if not (i in (4, 5) and j <= 1)], name='main_hall')
s.marks['hall_door'] = (31, 7)
put(B.scripture_tower(6), 40, 8, block=[(i, -j) for i in range(6) for j in range(3) if not (i in (2, 3) and j == 0)], name='scripture_tower')
s.marks['tower_door'] = (42, 8)
put(B.stone_pagoda(7), 22, 8, block=[(0, 0), (1, 0)], name='stone_pagoda')
put(B.stone_pagoda(9, tiers=4), 46, 8, block=[(0, 0), (1, 0)], name='stone_pagoda')
put(P.incense_burner(1), 25, 10, block=[(0, 0), (1, 0)], name='incense_burner')
put(P.stone_lantern(1), 29, 10, block=[(0, 0)], name='stone_lantern'); put(P.stone_lantern(2), 34, 10, block=[(0, 0)], name='stone_lantern')
put(P.turtle_stele(1), 37, 10, block=[(0, 0), (1, 0)], name='turtle_stele')
for (x, y) in ((19, 9), (44, 8)): put(P.banner_pole(x, 'ink'), x, y, block=[(0, 0)], name='banner_pole')
# 북서: 산 풀 언덕 + 개울(폭포 머리) + 봉우리
put(P.peak_spire(1, 3, 6), 0, 5, block=[(0, 0), (1, 0), (2, 0), (0, -1), (1, -1), (2, -1)], name='peak_spire')
put(P.peak_spire(2, 3, 5), 9, 3, block=[(0, 0), (1, 0), (2, 0)], name='peak_spire')
put(P.cliff_pine(1), 12, 10, block=[(1, 0)], name='cliff_pine')
put(P.cliff_pine(3, True), 0, 10, block=[(1, 0)], name='cliff_pine')
put(P.meditation_rock(1), 15, 6, block=[(0, 0), (1, 0)], name='meditation_rock')
put(P.mtn_shrub(1), 18, 3, block=[(0, 0), (1, 0)], name='mtn_shrub')
# 북동 바위 산덩이: 봉우리·소나무
put(P.peak_spire(3, 3, 6), 50, 7, block=None, name='peak_spire')
put(P.peak_spire(4, 4, 7), 56, 9, block=None, name='peak_spire')
put(P.peak_spire(5, 3, 5), 60, 4, block=None, name='peak_spire')
put(P.cliff_pine(5), 52, 10, block=None, name='cliff_pine'); put(P.cliff_pine(6, True), 61, 10, block=None, name='cliff_pine')
put(P.boulder(3, 2), 48, 10, block=None, name='boulder')
# 잔도 + 수련 동굴(위 단 절벽 띠 앞면)
for (x, w) in ((46, 4), (50, 4), (54, 4), (58, 2)):
    put(C.jando(w, seed=x), x, 12, block=None, walk=[(i, -1) for i in range(w)], name='jando', sorty=12 * 16)
put(C.cave_mouth(11), 60, 13, block=None, walk=[(0, -2), (1, -2), (1, -1)], name='cave_mouth', sorty=11 * 16 + 2)
s.marks['hermit_cave'] = (61, 12)
put(C.waterfall(4, 3, 0), 4, 15, block=None, dy=0, name='waterfall', sorty=15 * 16, shadow=False)

put(C.rope_bridge(5), 3, 6, block=None, walk=[(i, -1) for i in range(5)] + [(i, 0) for i in range(5)], name='rope_bridge', sorty=6 * 16 + 15)
for (x0) in (20, 39): put(C.stone_rail(4), x0, 10, block='all', name='stone_rail')

# ================================================================ ⑤ 가운데 단(연무장 · 폭포 웅덩이 · 정자 · 종각 · 숙소)
put(B.pavilion(5), 10, 19, block=[(0, 0), (3, 0)], walk=[(1, 0), (2, 0)], name='pavilion')
s.marks['pavilion'] = (11, 19)
put(B.bell_pavilion(3), 15, 22, block=[(i, -j) for i in range(5) for j in range(2) if not (i == 2 and j == 0)], name='bell_pavilion')
s.marks['bell'] = (17, 22)
put(P.war_drum(1), 24, 19, block=[(0, 0), (1, 0)], name='war_drum')
put(P.polearm_rack(1), 39, 19, block=[(0, 0), (1, 0)], name='polearm_rack')
put(P.incense_burner(2), 31, 19, block=[(0, 0), (1, 0)], name='incense_burner')
put(B.sparring_stage(6), 29, 25, block=[(i, -j) for i in range(6) for j in range(3) if not (i in (2, 3) and j == 0)], walk=[(i, -j) for i in (2, 3) for j in (1, 2)], name='sparring_stage')
s.marks['stage'] = (31, 24)
for (x, y) in ((25, 23), (27, 24), (25, 26), (28, 26)): put(P.wooden_dummy(x + y), x, y, block=[(0, 0)], name='wooden_dummy')
put(P.plum_posts(1), 35, 25, block=[(0, 0), (1, 0), (2, 0)], name='plum_posts')
put(P.plum_posts(2), 37, 22, block=[(0, 0), (1, 0), (2, 0)], name='plum_posts')
put(P.sword_rack(1), 38, 27, block='all', name='sword_rack')
for (x, y) in ((35, 18), (36, 19), (27, 18)): put(P.stone_weights(x), x, y, block='all', name='stone_weights')
for (x, y) in ((23, 17), (41, 17), (23, 27), (41, 26)): put(P.banner_pole(x * 3 + y), x, y, block=[(0, 0)], name='banner_pole')
for (x, y) in ((29, 29), (34, 29), (29, 16), (34, 16)): put(P.stone_lantern(x + y), x, y, block=[(0, 0)], name='stone_lantern')
put(B.dormitory(7, 4, door=3), 47, 20, rows=2, walk=[(3, 0)], name='dormitory')
s.marks['dorm_a'] = (50, 20)
put(B.dormitory(6, 8, door=2), 55, 20, rows=2, walk=[(2, 0)], name='dormitory')
s.marks['dorm_b'] = (57, 20)
put(P.alchemy_furnace(1), 57, 26, block=[(0, 0), (1, 0)], name='alchemy_furnace')
put(P.herb_rack(1), 60, 26, block=[(0, 0), (1, 0)], name='herb_rack')
for (x, y) in ((55, 25), (62, 23), (54, 20)): put(P.water_jar(x), x, y, block='all', name='water_jar')
put(P.stone_table(1), 49, 27, block=[(0, 0), (1, 0)], name='stone_table')
put(P.maple_tree(1), 45, 30, block=[(1, 0)], name='maple_tree')
put(P.maple_tree(2), 12, 29, block=[(1, 0)], name='maple_tree')
put(P.ginkgo_tree(1), 17, 30, block=[(1, 0)], name='ginkgo_tree')
put(P.meditation_rock(2), 2, 25, block=[(0, 0), (1, 0)], name='meditation_rock')
put(P.cliff_pine(7), 5, 29, block=[(1, 0)], name='cliff_pine')
for y, (a, b) in {28: (11, 16), 29: (10, 19), 30: (12, 19)}.items(): AR('leafpile', a, y, b, y)
for y, (a, b) in {23: (15, 21), 24: (14, 21), 25: (16, 19)}.items(): AR('mossflag', a, y, b, y)        # 연무장 서쪽 → 정자 오솔길
put(P.maple_tree(9), 5, 27, block=[(1, 0)], name='maple_tree')
for y, (a, b) in {26: (4, 9), 27: (3, 9), 28: (5, 8)}.items(): AR('leafpile', a, y, b, y)
put(P.boulder(41, 2), 8, 23, block=[(0, 0), (1, 0)], name='boulder')
put(P.mtn_shrub(3), 0, 22, block=[(0, 0), (1, 0)], name='mtn_shrub')
put(B.stone_pagoda(21, tiers=4), 1, 29, block=[(0, 0), (1, 0)], name='stone_pagoda')
for (x, y) in ((14, 22), (14, 26)): put(P.stone_lantern(x * 5 + y), x, y, block=[(0, 0)], name='stone_lantern')
for y, (a, b) in {28: (44, 48), 29: (43, 49), 30: (45, 47)}.items(): AR('leafpile', a, y, b, y)

# ================================================================ ⑥ 아래 단(산문 마당 · 산길)
put(B.sanmen(2), 28, 40, block=[(i, -j) for i in range(7) for j in range(3) if not (i in (2, 3, 4))], walk=[(i, -j) for i in (2, 3, 4) for j in range(3)], name='sanmen')
s.marks['sanmen_gate'] = (31, 39)
put(P.turtle_stele(2), 25, 41, block=[(0, 0), (1, 0)], name='turtle_stele')
for (x, y) in ((28, 42), (34, 42)): put(P.stone_lantern(x * 7), x, y, block=[(0, 0)], name='stone_lantern')
put(P.peak_spire(6, 3, 6), 1, 41, block=[(0, 0), (1, 0), (2, 0)], name='peak_spire')
put(P.peak_spire(7, 3, 6), 59, 43, block=[(0, 0), (1, 0), (2, 0)], name='peak_spire')
put(P.maple_tree(3), 20, 39, block=[(1, 0)], name='maple_tree')
put(P.maple_tree(4), 39, 39, block=[(1, 0)], name='maple_tree')
put(P.ginkgo_tree(2), 47, 38, block=[(1, 0)], name='ginkgo_tree')
put(P.stone_table(2), 9, 38, block=[(0, 0), (1, 0)], name='stone_table')
for y, (a, b) in {39: (19, 23), 40: (18, 24), 41: (20, 22)}.items(): AR('leafpile', a, y, b, y)
for y, (a, b) in {39: (38, 42), 40: (37, 43)}.items(): AR('leafpile', a, y, b, y)
for (x, y, f) in ((14, 37, 'pine'), (52, 37, 'pine2'), (42, 46, 'pine'), (6, 46, 'pine2')):
    put(P.cliff_pine(x + y, f == 'pine2'), x, y, block=[(1, 0)], name='cliff_pine')
for (x, y) in ((24, 36), (39, 36), (55, 45), (16, 46)): put(P.boulder(x, 2), x, y, block=[(0, 0), (1, 0)], name='boulder')

# ================================================================ ⑦ 안개 낀 풀 · 산 풀 덧그림
_NZ = smooth(W, H, 4, 505)
MIST_ZONES = [(0, 2, 19, 10), (0, 21, 9, 30), (13, 23, 20, 27), (0, 34, 15, 47), (44, 34, 63, 47), (51, 24, 63, 30)]
def _free(x, y):
    return not (s.block[y, x] or s.m['court'][y, x] or s.m['rock'][y, x] or any((x, y) in s.auto[k] for k in s.auto))
for (x0, y0, x1, y1) in MIST_ZONES:
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if _free(x, y) and _NZ[y, x] > .66 and (x, y) not in s.occ: s.auto['mistgrass'].add((x, y))
for y in range(H):
    for x in range(W):
        if _free(x, y) and (x, y) not in s.auto['mistgrass'] and _hash(x, y, 77) > .45: s.mtn.add((x, y))

# ================================================================ ⑧ 절벽 위·아래 바위 · 맨 위 구름
for (x, y, w) in ((8, 10, 2), (17, 30, 2), (24, 30, 1), (38, 30, 1), (53, 30, 2), (60, 30, 1), (2, 35, 1), (44, 35, 1), (58, 35, 2), (12, 35, 1)):
    if not s.block[y, x] and (x, y) not in s.occ:
        put(P.boulder(x * 3 + y, 2) if w == 2 else P.rock_small(x + y), x, y, block='bottom', name='boulder' if w == 2 else 'rock_small')
for (x, y) in ((22, 34), (47, 34), (9, 15), (55, 15)): put(P.fern(x), x, y, block=None, name='fern', shadow=False)
for (sd, x, y, w) in ((1, 49, 0, 5), (2, 56, 3, 4), (3, -1, 0, 4), (4, 10, 26, 4), (5, 50, 33, 4), (6, 0, 36, 4), (7, 16, 13, 3), (8, 58, 38, 4)):
    s.topimg(P.mist_cloud(sd, w, 2), x * 16, y * 16, name='mist_cloud')

s.marks['south_entrance'] = (31, 47)


# ================================================================ ⑨ 빈 풀밭 메우기: 가장 빈 20x15 창 안에 덩이로(일렬 금지, 길·문 앞·물가 피함, 통행 유지)
def _free_grass(x, y, w, h):
    for j in range(h):
        for i in range(w):
            xx, yy = x + i, y - j
            if not (0 <= xx < W and 0 <= yy < H): return False
            if (xx, yy) in s.occ or s.block[yy, xx] or s.m['court'][yy, xx] or s.m['rock'][yy, xx]: return False
            if any((xx, yy) in s.auto[k] for k in ('trail', 'pool', 'mossflag')): return False
    for (mx, my) in s.marks.values():
        if x - 1 <= mx <= x + w and y - h <= my + 1 <= y + 1: return False
    return True


def _reach_ok():
    seen_ = s.bfs((31, 47)); g_ = s.walk_grid()
    return all(tuple(v) in seen_ for v in s.marks.values()) and int(g_.sum()) == len(seen_)


FILL = [('pine', 3, 4), ('shrub', 2, 2), ('pine', 3, 4), ('maple', 3, 4), ('boulder', 2, 2), ('shrub', 2, 2), ('lantern', 1, 1)]
def _place(kind, x, y):
    if kind == 'pine': put(P.cliff_pine(x * 7 + y, (x + y) % 2 == 0), x, y, block=[(1, 0)], name='cliff_pine')
    elif kind == 'shrub': put(P.mtn_shrub(x + y), x, y, block=[(0, 0), (1, 0)], name='mtn_shrub')
    elif kind == 'boulder': put(P.boulder(x * 3 + y, 2), x, y, block=[(0, 0), (1, 0)], name='boulder')
    elif kind == 'rock': put(P.rock_small(x + y), x, y, block='all', name='rock_small')
    elif kind == 'maple': put(P.maple_tree(x + y * 5), x, y, block=[(1, 0)], name='maple_tree')
    elif kind == 'lantern': put(P.fern(x + y), x, y, block=None, name='fern', shadow=False)


_seen0 = s.bfs((31, 47)); _g0 = s.walk_grid()                                      # 절벽 윤곽 흔들림이 만든 1~4칸 고립 칸은 막는다
for y in range(H):
    for x in range(W):
        if _g0[y, x] and (x, y) not in _seen0: s.block[y, x] = True
frng = random.Random(77); _rej = [0]
import collections as _co
for it in range(160):
    e_ = s.empty(); (wr_, wx_, wy_), _m = s.worst(e_)
    if wr_ <= .30: break
    if it % 40 == 0: print("fill", it, round(wr_, 3), wx_, wy_)
    cells = [(x, y) for y in range(wy_, wy_ + 15) for x in range(wx_, wx_ + 20) if e_[y, x]]
    frng.shuffle(cells); done = False
    for (x, y) in cells[:80]:
        kind, w, h = frng.choice(FILL)
        if not _free_grass(x, y, w, h): continue
        snap = (len(s.objs), s.block.copy(), set(s.occ), dict(s.count))
        _place(kind, x, y)
        for i in range(w):
            for j in range(h): s.occ.add((x + i, y - j))
        if _reach_ok(): done = True; break
        else: _rej[0] += 1
        s.objs = s.objs[:snap[0]]; s.block = snap[1]; s.occ = snap[2]; s.count = _co.Counter(snap[3])
    if not done:
        for (x, y) in cells[:30]:
            if _free_grass(x, y, 1, 1): s.decal(P.fern(x * 3 + y), x, y, name='fern'); s.occ.add((x, y))

img = s.render()
seen = s.bfs((31, 47))
reach = {k: (tuple(v) in seen) for k, v in s.marks.items()}
e = s.empty(); (wr, wx, wy), mean = s.worst(e)
g = s.walk_grid()
print('reach', reach)
print('walkable', int(g.sum()), 'reached', len(seen))
print('empty window worst %.3f at (%d,%d), mean %.2f' % (wr, wx, wy, mean))
if __name__ == '__main__':
    os.makedirs(os.path.join(HERE, '_qa'), exist_ok=True)
    if '--quick' in sys.argv:
        img.convert('RGB').save(os.path.join(HERE, '_qa', 'map1x.png'))
    else:
        import ws_export
        n = ws_export.export(s, img, reach, ((wr, (wx, wy)), mean), seen)
        print('parts', n)
