# 하늘 도시·부유섬 (sky-city) — 64×48 JRPG 필드. 다시 돌리면 같은 그림.  python3 make_sky_city.py
# 바탕 = 구름 바다(sc_sky, 통행 불가) · 섬 = 버들항 풀/절벽 바위(sc_island) · 조각 = sc_props.
# 동선: 서쪽 비행선 잔교(입구) → 착륙 섬 → 부유 계단 → 신전 섬(광장·하늘 신전) → 밧줄 다리 → 정원 섬(떠 있는 수정)
#       신전 섬 남동 → 구름 길 → 풍차 섬.
import os, sys, json, math, random
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import numpy as np
from PIL import Image, ImageDraw
import sc_base as B
from sc_base import T, new, at_cell, _hash, vnoise, CL, CP, SK, ST, TRV, LF, mul, mix
import sc_sky as S, sc_island as I, sc_props as P, sc_tiling as Z
import bd5, roman, terrain, terrain7, ground
from collections import deque

W, H = 64, 48
Wp, Hp = W * T, H * T
rng = random.Random(4801)
PH = os.path.join(B.VAR, 'plains-highroad', 'parts')
def ph(n): return Image.open(os.path.join(PH, n + '.png')).convert('RGBA')

# ================================================================ 섬 모양(칸)
def ell(cx, cy, rx, ry, wob=.10, seed=0):
    m = set()
    for y in range(H):
        for x in range(W):
            a = math.atan2(y + .5 - cy, x + .5 - cx)
            k = 1 + wob * math.sin(a * 3 + seed) + wob * .6 * math.sin(a * 5 + seed * 2)
            if ((x + .5 - cx) / (rx * k)) ** 2 + ((y + .5 - cy) / (ry * k)) ** 2 <= 1: m.add((x, y))
    return m
def organic(cells, seed, protect=()):
    """칸 섬 모양을 자연스럽게: 볼록 모서리 칸을 깎고, 곧은 가장자리 몇 곳에 한 칸 혹을 붙인다(일렬 직선·계단 모서리 줄이기)."""
    r = random.Random(seed); c = set(cells); P_ = set(protect)
    def nb(x, y): return [(x + dx, y + dy) in c for dx, dy in ((0, -1), (1, 0), (0, 1), (-1, 0))]
    for rnd in range(2):
        rem = []
        for (x, y) in sorted(c):
            n, e, s_, w = nb(x, y)
            if (x, y) in P_: continue
            if sum((n, e, s_, w)) == 2 and ((not n and not w) or (not n and not e) or (not s_ and not w) or (not s_ and not e)) and r.random() < .5: rem.append((x, y))
            elif sum((n, e, s_, w)) <= 1: rem.append((x, y))
        for q in rem: c.discard(q)
    add = []
    for (x, y) in sorted(c):
        for (dx, dy) in ((0, -1), (1, 0), (-1, 0)):
            q = (x + dx, y + dy)
            if q in c or not (0 <= q[0] < W and 6 <= q[1] < H): continue
            side = [(q[0] + ex, q[1] + ey) in c for ex, ey in ((0, -1), (1, 0), (0, 1), (-1, 0))]
            if sum(side) == 1 and r.random() < .16: add.append(q)
    c |= set(add)
    # 긴 곧은 서·동 가장자리(4칸 이상)에 한 칸 패임
    for (x, y) in sorted(c):
        for dx in (-1, 1):
            run = all((x, y + k) in c and (x + dx, y + k) not in c for k in range(-2, 3))
            if run and (x, y) not in P_ and r.random() < .35 and (x - dx, y) in c: c.discard((x, y))
    return c

ISL = {
    'landing': ell(12.5, 34.0, 7.6, 5.2, seed=1) | ell(8, 31.5, 3, 2, seed=2) | ell(16.5, 30.6, 2.6, 1.9, seed=9) | {(17, 29), (18, 29), (16, 29)},
    'temple': (ell(32.0, 15.5, 12.4, 9.6, .10, seed=3) | ell(24.0, 22.0, 3.6, 2.6, seed=4) | {(22, 24), (23, 24), (21, 23)}) - {(x, y) for x in range(W) for y in range(0, 6)},
    'garden': ell(55.5, 18.0, 7.8, 8.4, .12, seed=5),
    'mill': ell(50.5, 37.5, 6.0, 4.3, .08, seed=6),
    'ruin': ell(6.5, 10.5, 4.2, 2.6, .1, seed=7),
}
_PROT = {'landing': {(x, y) for x in range(0, 20) for y in range(29, 36)} | {(16, 29), (17, 29), (18, 29)},
         'temple': {(x, y) for x in range(20, 45) for y in range(13, 17)} | {(22, 24), (23, 24), (21, 23), (22, 23), (34, 24), (35, 24)},
         'garden': {(x, y) for x in range(47, 53) for y in range(13, 17)},
         'mill': {(x, y) for x in range(45, 49) for y in range(32, 37)}}
for k in list(ISL): ISL[k] = organic(ISL[k], 90 + len(k), _PROT.get(k, ()))
# 섬 사이를 너무 붙이지 않게 확인
ISLAND = [[False] * W for _ in range(H)]
OWNER = {}
for k, cells in ISL.items():
    for (x, y) in cells:
        ISLAND[y][x] = True; OWNER[(x, y)] = k

# ================================================================ 칸 표식
BLOCK = [[False] * W for _ in range(H)]          # 물체 막힘
WALKX = [[False] * W for _ in range(H)]          # 섬 밖이지만 걷기(다리·계단·잔교·구름 길)
PATH = [[False] * W for _ in range(H)]           # 섬 위 흙길
PLAZA = [[False] * W for _ in range(H)]          # 대리석 광장
GRAVEL = [[False] * W for _ in range(H)]         # 정원 자갈길
CPATH = [[False] * W for _ in range(H)]          # 구름 길
FILL = set()
objs = []                                         # (sorty, x, y, img, shadow, layer)
def at(im, cx, cy, block='bottom', dx=0, dy=0, shadow=None, sorty=None, rows=1, cells=None):
    x = cx * T + dx; y = (cy + 1) * T - im.height + dy
    if shadow is None: shadow = im.height >= 40
    objs.append(((y + im.height) if sorty is None else sorty, x, y, im, shadow))
    wc = -(-im.width // T)
    bl = []
    if block == 'bottom': bl = [(cx + i, cy - j) for i in range(wc) for j in range(rows)]
    elif block == 'cells': bl = cells
    for (a, b) in bl:
        if 0 <= a < W and 0 <= b < H: BLOCK[b][a] = True
def walk_rect(x0, x1, y0, y1, g=WALKX):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if 0 <= x < W and 0 <= y < H: g[y][x] = True
def line_path(pts, g=PATH, w=2):
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if x0 == x1:
            for y in range(min(y0, y1), max(y0, y1) + 1):
                for i in range(w): g[y][x0 + i] = True
        else:
            for x in range(min(x0, x1), max(x0, x1) + 1):
                for j in range(w): g[y0 + j][x] = True

# ================================================================ 길·광장
# 착륙 섬: 잔교 머리(6,33) → 착륙장 → 북동 계단 발치(17~18, 30)
line_path([(5, 33), (13, 33), (13, 30), (17, 30)])
# 신전 섬: 계단 머리(23~24, 23) → 북 → 광장 / 광장 동쪽 → 다리 머리(43,14) / 광장 남동 → 구름 길 머리(38~39, 24)
COB = [[False] * W for _ in range(H)]          # 신전 섬 포석길(버들항 자갈 포장)
line_path([(22, 23), (22, 20), (24, 20), (24, 19), (26, 19)], COB)
walk_rect(26, 37, 13, 19, PLAZA)
line_path([(38, 14), (43, 14)], COB)
line_path([(36, 19), (37, 19), (37, 22), (34, 22), (34, 24)], COB)
# 정원: 다리 끝(48,14) → 서쪽 자갈길 → 가운데 둥근 수정 마당 / 북쪽 퍼걸러 길 / 남쪽 전망 길
line_path([(48, 14), (51, 14), (51, 17), (53, 17)], GRAVEL)
for y in range(H):
    for x in range(W):
        if 53 <= x <= 57 and 16 <= y <= 20 and not (x in (53, 57) and y in (16, 20)): GRAVEL[y][x] = True
line_path([(55, 10), (55, 15)], GRAVEL)
line_path([(55, 20), (55, 24)], GRAVEL)
# 풍차 섬: 구름 길 끝(46~47, 33) → 풍차 문 앞
line_path([(46, 34), (46, 36), (49, 36)])
for g in (PATH, PLAZA, GRAVEL, COB):
    for y in range(H):
        for x in range(W):
            if g[y][x] and not ISLAND[y][x]: g[y][x] = False
# 구름 길(신전 섬 남동 → 풍차 섬 북쪽): 섬 밖 칸만
line_path([(34, 25), (34, 28), (40, 28), (40, 30), (46, 30), (46, 33)], CPATH)
for y in range(H):
    for x in range(W):
        if CPATH[y][x] and ISLAND[y][x]: CPATH[y][x] = False

# ================================================================ 남쪽 단면 칸(섬 밖, 막힘) — 구름 ��·다리가 단면을 지나면 안 된다
FACE = [[0] * W for _ in range(H)]
for (x, y) in OWNER:
    if not ISLAND[min(H - 1, y + 1)][x]:
        for k in range(1, 4):
            if y + k < H and not ISLAND[y + k][x]: FACE[y + k][x] = k
            else: break

# ================================================================ 조각 이미지
IM = {}
def im(name, fn):
    if name not in IM: IM[name] = fn()
    return IM[name]
FL = [ph('flowers_red'), ph('flowers_yellow'), ph('flowers_white'), ph('flowers_blue')]
TG = [ph('tallgrass_a'), ph('tallgrass_b'), ph('tallgrass_c')]
decals = []                                       # 땅 장식(물체 아래)
def deco(img, cx, cy, dx=0, dy=0):
    decals.append((img, cx * T + dx, (cy + 1) * T - img.height + dy))

# ---------------- 착륙 섬(입구) ----------------
# 잔교(섬 서쪽 끝 → 맵 끝), 비행선, 계류 기둥
pier = im('pier_h', lambda: P.pier_h(4))
at(pier, 0, 34, block=None, dy=16, sorty=34 * T + 4); walk_rect(0, 4, 33, 34)
at(im('pier_end', lambda: P.pier_h(2, True)), 4, 34, block=None, dy=16, sorty=34 * T + 5); walk_rect(4, 5, 33, 34)
at(im('airship', P.airship), 0, 42, block='cells', cells=[(x, y) for x in range(0, 8) for y in range(37, 43)], shadow=False)
at(im('mooring_mast', P.mooring_mast), 6, 32)
at(im('anchor_post', P.anchor_post), 5, 35, dy=0)
at(im('rope_coil', P.rope_coil), 7, 35, block=None)
at(im('sky_cargo', P.sky_cargo), 8, 36, rows=1)
at(im('sky_cargo', P.sky_cargo), 7, 30, rows=1)
at(im('landing_pad', P.landing_pad), 8, 34, block=None, dy=-2, shadow=False, sorty=0)
# 등대탑(비행선 길잡이)
at(im('beacon_tower', P.beacon_tower), 14, 37, rows=2)
at(im('signal_lantern', P.signal_lantern), 16, 30)
at(im('signal_lantern', P.signal_lantern), 19, 31)
at(im('wind_vane', P.wind_vane), 11, 37)
at(im('anchor_post', P.anchor_post), 18, 35)
at(im('rope_coil', P.rope_coil), 17, 36, block=None)
at(im('sky_house', P.sky_house), 9, 30, rows=2)
at(bd5.tree_look('bushE', 2), 12, 30, block='cells', cells=[(12, 30), (13, 30)])
# ---------------- 부유 계단(착륙 섬 → 신전 섬) ----------------
STEPS = [(18, 28), (19, 27), (20, 26), (21, 25)]
for k, (x, y) in enumerate(STEPS):
    at(im('float_step_%d' % (k % 2), lambda k=k: P.float_step(k % 2)), x, y + 1, block=None, sorty=(y + 1) * T)
    walk_rect(x, x + 1, y, y)

# ---------------- 신전 섬 ----------------
at(im('sky_temple', P.sky_temple), 28, 12, rows=4)
tw = bd5.lib_sprite('castle.tower_round')
at(tw, 25, 11, rows=2); at(tw, 35, 11, rows=2)
at(im('colonnade_sky', P.colonnade_sky), 21, 17, rows=3)
fountain = bd5.lib_sprite('forum.fountain')
at(fountain, 30, 17, rows=2)
for (x, y) in ((27, 14), (35, 14)): at(im('brazier_sky', P.brazier_sky), x, y)
sage = bd5.lib_sprite('statue_sage')
at(sage, 26, 18); at(sage.transpose(Image.FLIP_LEFT_RIGHT), 35, 18)
for (x, y) in ((26, 16), (37, 16)): at(im('marble_column', P.marble_column), x, y)
at(im('marble_column_broken', lambda: P.marble_column(True, 1)), 41, 18)
at(im('bench_marble', P.bench_marble), 39, 10)
at(im('marble_column_broken_b', lambda: P.marble_column(True, 4)), 21, 11)
at(im('obelisk_sky', P.obelisk_sky), 25, 21)
for (x, y, n) in ((39, 13, 0), (43, 16, 1)): pass
# 다리 머리 말뚝
for (x, y) in ((43, 13), (43, 16)): at(im('bridge_post', P.bridge_post), x, y)
# 나무: 사이프러스·참나무(버들항)
cyp = roman.cypress(3, seed=2)
for (x, y) in ((22, 9), (40, 9), (41, 11), (20, 14)): at(cyp, x, y)
at(bd5.tree_look('oakB', 0), 38, 22, block='cells', cells=[(39, 22)])
at(bd5.tree_look('bushC', 1), 28, 23, block='cells', cells=[(28, 23), (29, 23)])
at(bd5.tree_look('bushE', 0), 33, 22, block='cells', cells=[(33, 22), (34, 22)])
at(im('marble_urn', P.marble_urn), 29, 20); at(im('marble_urn_b', lambda: P.marble_urn(1)), 34, 20)
at(im('crystal_cluster_s', lambda: P.crystal_cluster(1)), 21, 21)
at(ph('boulder'), 29, 22); at(ph('rocks_small'), 31, 23, block=None)
at(roman.cypress(2, seed=9), 24, 21); at(roman.cypress(3, seed=11), 32, 21)
# ---------------- 밧줄 다리(신전 섬 → 정원 섬) ----------------
at(im('rope_bridge_h', P.rope_bridge_h), 44, 16, block=None, sorty=15 * T + 8); walk_rect(44, 47, 14, 15)
for (x, y) in ((48, 13), (48, 16)): at(im('bridge_post', P.bridge_post), x, y)

# ---------------- 정원 섬 ----------------
at(im('crystal_float', P.crystal_float), 54, 18, rows=1)
at(im('pergola', P.pergola), 54, 12, block='cells', cells=[(54, 12), (56, 12)], sorty=12 * T + 15)
for (x, y) in ((53, 10), (57, 10)): at(cyp, x, y)
at(roman.topiary(1), 50, 13); at(roman.topiary(2), 50, 16)
# 네 귀퉁이 화단(어긋나게, 같은 것을 같은 자리에 두지 않는다)
at(im('flowerbed_ring', P.flowerbed_ring), 51, 12, rows=1)
at(im('marble_urn', P.marble_urn), 53, 13)
at(im('hedge_trough_3', lambda: P.hedge_trough(3, 1)), 57, 14)
at(im('marble_urn_b', lambda: P.marble_urn(1)), 60, 15)
at(im('hedge_trough', P.hedge_trough), 51, 20)
at(im('birdbath', P.birdbath), 53, 22)
at(im('bench_marble', P.bench_marble), 50, 22)
at(im('flowerbed_ring', P.flowerbed_ring), 57, 22, rows=1)
at(im('bench_marble', P.bench_marble), 57, 19)
at(im('obelisk_sky', P.obelisk_sky), 54, 25); at(im('obelisk_sky', P.obelisk_sky), 57, 25)
at(bd5.tree_look('oakA', 2), 59, 12, block='cells', cells=[(60, 12), (61, 12)])
at(bd5.tree_look('oakB', 1), 47, 19, block='cells', cells=[(48, 19)])
at(bd5.tree_look('oakB', 3), 60, 21, block='cells', cells=[(61, 21)])
at(bd5.tree_look('bushD', 0), 49, 11, block='cells', cells=[(49, 11), (50, 11), (51, 11)])
at(bd5.tree_look('bushC', 2), 49, 24, block='cells', cells=[(49, 24), (50, 24)])
at(bd5.tree_look('bushE', 1), 59, 24, block='cells', cells=[(59, 24), (60, 24)])
at(roman.cypress(2, seed=5), 61, 17)

# ---------------- 구름 길 길잡이 등(길 곁 하늘 칸) ----------------
UND = I.underside_layer(ISLAND, seed=7, root_max=92,
                        cut=lambda X, Y: CPATH[Y // T][X // T] if 0 <= Y // T < H and 0 <= X // T < W else False)
UCOV = UND[2]
cand = []
order = [(34, 25), (34, 26), (34, 27), (34, 28), (35, 28), (36, 28), (37, 28), (38, 28), (39, 28), (40, 29), (40, 30), (41, 30), (42, 30), (43, 30), (44, 30), (45, 30), (46, 31), (46, 32)]
k = 0
for i, (x, y) in enumerate(order):
    if i % 3: continue
    for (dx, dy) in ((-1, 0), (0, 2), (2, 0), (1, 2), (0, -1)):
        q = (x + dx, y + dy)
        if not (0 <= q[0] < W and 0 <= q[1] < H) or ISLAND[q[1]][q[0]] or CPATH[q[1]][q[0]] or FACE[q[1]][q[0]] or q in UCOV or (q[0], q[1] - 1) in UCOV: continue
        at(im('guide_light_%d' % (k % 2), lambda k=k: P.guide_light(k % 2)), q[0], q[1], block=None, shadow=False); k += 1
        break

# ---------------- 풍차 섬 ----------------
at(im('windmill_sky', P.windmill_sky), 50, 37, block='cells', cells=[(51, 36), (52, 36), (50, 37), (51, 37), (52, 37), (53, 37)])
fld = bd5.lib_sprite('field1')
at(fld, 46, 40, block='cells', cells=[(x, y) for x in range(46, 51) for y in range(38, 41)], shadow=False, sorty=0)
at(im('sky_cargo', P.sky_cargo), 44, 38)
at(im('crystal_cluster', P.crystal_cluster), 53, 40)
at(im('wind_vane', P.wind_vane), 49, 33)
at(bd5.tree_look('bushC', 3), 47, 36, block='cells', cells=[(47, 36), (48, 36)])
at(im('rope_coil', P.rope_coil), 52, 39, block=None)

# ---------------- 폐허 섬(북서, 닿을 수 없음) / 바위섬 ----------------
at(im('crystal_float', P.crystal_float), 6, 11)
at(im('marble_column_broken', lambda: P.marble_column(True, 1)), 4, 10)
at(im('marble_column', P.marble_column), 9, 10)
at(im('crystal_cluster_s', lambda: P.crystal_cluster(1)), 3, 12)
at(ph('rubble_small'), 8, 12, block=None); at(ph('fallen_block'), 3, 9)
at(roman.cypress(2, seed=13), 21, 8)

# ---------------- 떠 있는 흙덩이·작은 섬·구름 덩이 ----------------
for (sz, x, y, sd) in (('s', 3, 25, 1), ('m', 13, 22, 2), ('s', 19, 41, 3), ('m', 59, 33, 4), ('s', 42, 37, 5), ('m', 44, 4, 6), ('s', 15, 4, 7),
                       ('s', 61, 42, 8), ('m', 28, 37, 9), ('s', 38, 34, 10), ('s', 1, 18, 11), ('l', 16, 14, 12), ('l', 59, 5, 13), ('s', 62, 9, 14)):
    c = P.clod(sz, sd); at(c, x, y, block=None, shadow=False, sorty=0)
clouds_top = []
for (x, y, w, h, sd) in ((300, 704, 64, 22, 1), (560, 650, 80, 26, 2), (880, 560, 72, 24, 3), (120, 420, 56, 20, 4), (700, 100, 64, 22, 5), (980, 300, 48, 18, 6), (300, 40, 56, 20, 7)):
    clouds_top.append((S.cloud_puff(w, h, sd), x, y))

# ---------------- 섬 위 풀꽃 덩이(빈 풀밭) ----------------
def free(x, y):
    return ISLAND[y][x] and not (BLOCK[y][x] or PATH[y][x] or PLAZA[y][x] or GRAVEL[y][x] or COB[y][x])
MEADOWS = [(10, 37, 2.4), (6, 32, 1.6), (17, 34, 2.0), (22, 12, 1.6), (41, 21, 2.0), (31, 23, 1.8), (36, 8, 1.4), (24, 15, 1.3), (60, 13, 1.6),
           (61, 20, 1.4), (48, 22, 1.6), (53, 25, 1.4), (49, 39, 1.6), (53, 34, 1.6), (6, 9, 1.6), (39, 17, 1.4), (14, 30, 1.5), (61, 23, 1.3), (52, 24, 1.2), (48, 21, 1.3), (56, 22, 1.0), (50, 34, 1.3), (54, 38, 1.0), (60, 17, 1.0), (26, 22, 1.2), (31, 21, 1.1), (15, 32, 1.0), (36, 21, 1.0), (42, 9, 1.2), (38, 11, 1.0), (58, 11, 1.0), (52, 10, 1.0), (8, 11, 1.0), (23, 10, 1.1), (21, 19, 1.2), (24, 23, 1.0)]
for (cx, cy, r) in MEADOWS:
    for y in range(int(cy - r) - 1, int(cy + r) + 2):
        for x in range(int(cx - r * 1.3) - 1, int(cx + r * 1.3) + 2):
            if not (0 <= x < W and 0 <= y < H) or not free(x, y): continue
            d = ((x - cx) / (r * 1.3)) ** 2 + ((y - cy) / r) ** 2
            if d > .95 + (rng.random() - .5) * .5: continue
            FILL.add((x, y))
            if rng.random() < .62:
                t = rng.choice(TG)
                if t.width > 16 and not free(x + 1, y): t = TG[0]
                deco(t, x, y, dx=rng.randrange(-2, 3), dy=rng.randrange(-1, 2))
            if rng.random() < .55 or d < .35:
                deco(FL[(int(cx) // 3 + int(cy) // 2 + (1 if d > .5 and rng.random() < .3 else 0)) % 4], x, y, dx=rng.randrange(-3, 4), dy=rng.randrange(-3, 4))
# 섬 테두리 잔 풀(가장자리 칸 몇 곳)
for (x, y) in sorted(OWNER):
    if free(x, y) and _hash(x, y, 77) < .22 and not all(ISLAND[y + dy][x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= x + dx < W and 0 <= y + dy < H):
        deco(TG[0] if _hash(x, y, 78) < .6 else TG[2], x, y, dx=int(_hash(x, y, 79) * 5) - 2, dy=-1)

# ================================================================ 그리기
# ================================================================ 바탕: 조각 키트로 찍는다(조수가 팩으로 까는 것과 같은 방식)
PARTS = os.path.join(HERE, 'parts')
def part(n): return Image.open(os.path.join(PARTS, n + '.png')).convert('RGBA')
# 하늘: 바탕 칸(ground-cloudsea Q)을 다 칠하고, 구름 덩이 물체(cloud_clump_*)를 칸 단위로 흩는다 — 6칸 격자 없이.
FREE = [[False] * W for _ in range(H)]
for y in range(H):
    for x in range(W):
        if ISLAND[y][x] or FACE[y][x] or (x, y) in UCOV or CPATH[y][x] or WALKX[y][x] or BLOCK[y][x]: continue
        if x <= 8 and 36 <= y <= 43: continue                      # 비행선 자리
        near = any(0 <= x + dx < W and 0 <= y + dy < H and (CPATH[y + dy][x + dx] or WALKX[y + dy][x + dx]) for dx in (-1, 0, 1) for dy in (-1, 0, 1))
        if not near: FREE[y][x] = True
USED = [[False] * W for _ in range(H)]
CLOUDS = []                                                          # (부품 이름, 칸 x, 칸 y)
def put(name, x, y, w, h, mark=True):
    CLOUDS.append((name, x, y))
    if mark:
        for j in range(h):
            for i in range(w):
                if 0 <= x + i < W and 0 <= y + j < H: USED[y + j][x + i] = True
CSZ = {n: (w, h) for (n, w, h, sd) in Z.CLUMPS + Z.BILLOWS}
# 1) 섬 밑면 뿌리 끝을 구름 덩이로 묻는다(구름 번짐 띠를 길게 늘이지 않는다)
def root_tips():
    und, bottoms, cov = UND
    tops = {}
    for (x, y) in OWNER:
        if not ISLAND[min(H - 1, y + 1)][x]: tops[x] = max(tops.get(x, -1), (y + 1) * T)
    tips = {}
    for x in range(W):
        bs = [bottoms[X] for X in range(x * T, x * T + T) if bottoms[X] >= 0]
        if not bs or x not in tops: continue
        b = max(bs)
        if b - tops[x] < 70: continue
        tips[x] = (b - 22) // T
    runs = []; cur = []
    for x in sorted(tips):
        if cur and (x != cur[-1] + 1 or abs(tips[x] - tips[cur[-1]]) > 1): runs.append(cur); cur = []
        cur.append(x)
    if cur: runs.append(cur)
    return [(r_, tips) for r_ in runs]
_rng = random.Random(4807)
for run, tips in root_tips():
    x0 = run[0] - 1; L = len(run) + 2; y = max(tips[x] for x in run)
    while L > 0:
        cand = [n for (n, (w, h)) in CSZ.items() if n.startswith('cloud_clump') and w <= L and h == 2] or ['cloud_clump_s2']
        n = max(cand, key=lambda n: CSZ[n][0] + _rng.random() * 1.5)
        w, h = CSZ[n]
        if 0 <= x0 and x0 + w <= W and y + h <= H and not any(USED[y + j][x0 + i] for i in range(w) for j in range(h)):
            put(n, x0, y, w, h)
        x0 += w; L -= w
# 2) 구름 융단 지대(남쪽 끝): 둥근 둑 + 속 칸에 솟은 뭉게
BANK = [[False] * W for _ in range(H)]
for (x, y) in ell(30.0, 47.5, 12.0, 5.2, .18, seed=4) | ell(19.5, 47.6, 4.5, 2.6, .2, seed=9) | ell(40.0, 46.5, 4.0, 3.4, .2, seed=12):
    if 0 <= x < W and 0 <= y < H and FREE[y][x] and not USED[y][x]: BANK[y][x] = True
BANK_IN = [[BANK[y][x] and all(0 <= x + dx < W and 0 <= y + dy < H and BANK[y + dy][x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            or (BANK[y][x] and y == H - 1 and BANK[y][x - 1] and x + 1 < W and BANK[y][x + 1] and BANK[y - 1][x]) for x in range(W)] for y in range(H)]
for (n, x, y) in Z.scatter_big_first(BANK_IN, [(n, w, h) for (n, w, h, sd) in Z.BILLOWS if n != 'cloud_billow_s'], 4811, fill=.75, tries_per=400, hop=.15):
    put(n, x, y, *CSZ[n], mark=False)
for y in range(H):
    for x in range(W):
        if BANK[y][x]: USED[y][x] = True
# 3) 하늘의 구름 덩이: 무리(큰 덩이 하나 + 붙은 중간 덩이 둘셋 + 끝의 작은 덩이)를 몇 군데에만, 나머지는 트인 하늘
def fits(n, x, y):
    w, h = CSZ[n]
    return all(0 <= x + i < W and 0 <= y + j < H and FREE[y + j][x + i] and not USED[y + j][x + i] for i in range(w) for j in range(h))
BIG = ['cloud_clump_xl', 'cloud_clump_l1', 'cloud_clump_long', 'cloud_clump_l2']
MID = ['cloud_clump_m1', 'cloud_clump_m2', 'cloud_clump_m3', 'cloud_clump_tall']
SML = ['cloud_clump_s1', 'cloud_clump_s2']
_r3 = random.Random(4823)
cells = [(x, y) for y in range(H) for x in range(W) if FREE[y][x]]
nclusters = 0
for t in range(4000):
    if nclusters >= 9: break
    n = BIG[nclusters % len(BIG)]; x, y = _r3.choice(cells)
    if not fits(n, x, y): continue
    # 다른 무리와 6칸 이상 떨어지게
    if any(abs(x - cx) < 9 and abs(y - cy) < 6 for (nn, cx, cy) in CLOUDS if nn in BIG): continue
    w, h = CSZ[n]; put(n, x, y, w, h); nclusters += 1
    for k in range(_r3.randint(2, 4)):                     # 붙은 중간 덩이: 좌우·아래에 맞붙여(한두 칸 엇갈림)
        m = _r3.choice(MID); mw, mh = CSZ[m]
        for _ in range(30):
            side = _r3.choice(('l', 'r', 'r', 'd'))
            if side == 'l': px_, py_ = x - mw, y + _r3.randint(-1, h - 1)
            elif side == 'r': px_, py_ = x + w, y + _r3.randint(-1, h - 1)
            else: px_, py_ = x + _r3.randint(-1, w - 1), y + h
            if fits(m, px_, py_): put(m, px_, py_, mw, mh); break
    for k in range(_r3.randint(0, 1)):                     # 끝의 작은 덩이(한 칸 띄워) — 많으면 팝콘처럼 흩뿌려진다
        m = _r3.choice(SML); mw, mh = CSZ[m]
        for _ in range(30):
            px_ = x + _r3.choice((-mw - 2, w + 2 + _r3.randint(0, 3), _r3.randint(0, w))); py_ = y + _r3.choice((-mh - 1, h + 1, _r3.randint(0, h)))
            if fits(m, px_, py_): put(m, px_, py_, mw, mh); break
clear = [[FREE[y][x] and not USED[y][x] for x in range(W)] for y in range(H)]
for (n, x, y) in Z.scatter_cells(clear, [(n, *CSZ[n]) for n in SML + ['cloud_clump_m3']], 4827, fill=.015, gap=4): put(n, x, y, *CSZ[n])
clear = [[clear[y][x] and not USED[y][x] for x in range(W)] for y in range(H)]
STREAKS = Z.scatter_cells(clear, [('sky_streak_a', 4, 1), ('sky_streak_b', 6, 1)], 4829, fill=.012, gap=3)

# 대리석 광장: 바탕 칸 + 대리석 조각 흩기
MARBLE = Z.marble_field(PLAZA, 4831, fill=.55)
_MA = np.array(MARBLE)
def tex_marble_field(X, Y): return tuple(int(v) for v in _MA[Y, X, :3])

def render():
    # 1) 하늘 바탕(ground-cloudsea 칸) + 구름 융단 지대(속 칸 아래층 = ground-cloudcarpet, 위층 둑 붓) + 섬 그림자
    sky_q = part('ground-cloudsea').crop((0, 0, T, T)); car_q = part('ground-cloudcarpet').crop((0, 0, T, T))
    sea = Z.tile_q(sky_q, W, H)
    for y in range(H):
        for x in range(W):
            if BANK_IN[y][x]: sea.paste(car_q, (x * T, y * T))
    bank_up = new(Wp, Hp); B.at_paint(bank_up, part('autotile-cloudbank'), BANK)
    for (n, x, y) in CLOUDS:                                   # 뭉게가 놓인 칸은 위층 둑 칸이 뭉게 칸으로 바뀐다
        if n.startswith('cloud_billow'):
            w, h = CSZ[n]; bank_up.paste((0, 0, 0, 0), (x * T, y * T, (x + w) * T, (y + h) * T))
    sea.alpha_composite(bank_up)
    for (n, x, y) in STREAKS: sea.alpha_composite(part(n), (x * T, y * T))
    A = np.array(sea).astype(np.float64)
    shm = np.zeros((Hp, Wp), bool)
    isl = np.kron(np.array(ISLAND, bool), np.ones((T, T), bool))
    from scipy import ndimage as ndi
    soft = ndi.binary_erosion(ndi.binary_dilation(isl, iterations=6), iterations=10)
    sh = np.zeros_like(soft); sh[60:, 26:] = soft[:-60, :-26]
    cpi = new(Wp, Hp); B.at_paint(cpi, part('autotile-cloudpath'), CPATH)
    cp = np.array(cpi)[:, :, 3] > 0
    sh2 = np.zeros_like(cp); sh2[8:, 3:] = cp[:-8, :-3]
    sh2 &= ~cp
    yy, xx = np.mgrid[0:Hp, 0:Wp]
    edge = sh & ~ndi.binary_erosion(sh, iterations=2)
    shm = (sh & ~(edge & ((xx + yy) % 2 == 0))) | (sh2 & ((xx + yy) % 2 == 0)) | (sh2 & np.roll(sh2, 2, 0))
    A[shm, :3] = np.floor(A[shm, :3] * np.array((.80, .82, .90)))
    img = Image.fromarray(A.astype(np.uint8), 'RGBA')
    # 2) 구름 길
    B.at_paint(img, part('autotile-cloudpath'), CPATH)
    # 3) 섬 밑면
    und, bottoms, cov = UND
    img.alpha_composite(und)
    # 5) 섬 윗면(섬 테 오토타일 + 버들항 풀밭)
    gimg, lab = ground.render(Wp, Hp, [], np.zeros((Hp, Wp), bool), 6)
    rim = I.autotile_islandrim(); lp = I.LAWN.load(); gp = gimg.load()
    top = new(Wp, Hp)
    g = lambda a, b: 0 <= a < W and 0 <= b < H and ISLAND[b][a]
    for y in range(H):
        for x in range(W):
            if not ISLAND[y][x]: continue
            m = g(x, y - 1) * 1 + g(x + 1, y) * 2 + g(x, y + 1) * 4 + g(x - 1, y) * 8
            c = at_cell(rim, m); cpx = c.load()
            for v in range(T):
                for u in range(T):
                    if cpx[u, v][3] and cpx[u, v] == lp[u, v]: cpx[u, v] = gp[x * T + u, y * T + v]
            top.alpha_composite(c, (x * T, y * T))
    # 6) 길: 흙길(버들항 모래길 오토타일), 광장(트래버틴), 자갈길
    SV = terrain7.sand_variants()
    for y in range(H):
        for x in range(W):
            if PATH[y][x]:
                m = sum(b for b, (dx, dy) in ((1, (0, -1)), (2, (1, 0)), (4, (0, 1)), (8, (-1, 0)))
                        if 0 <= x + dx < W and 0 <= y + dy < H and (PATH[y + dy][x + dx] or PLAZA[y + dy][x + dx]))
                top.alpha_composite(SV[m], (x * T, y * T))
    top.alpha_composite(terrain.paving(COB, 160, 96, joins=[[PLAZA[y][x] for x in range(W)] for y in range(H)]))
    top.alpha_composite(roman.paving5(PLAZA, tex_marble_field, joins=COB))
    top.alpha_composite(roman.paving5(GRAVEL, roman.tex_gravel, joins=None, edge=TRV))
    # 섬 윗면 화소 밖으로 길이 나가지 않게: 섬 테 알파로 자른다
    ta = np.array(top); ia = np.zeros((Hp, Wp), bool)
    for y in range(H):
        for x in range(W):
            if ISLAND[y][x]:
                m = g(x, y - 1) * 1 + g(x + 1, y) * 2 + g(x, y + 1) * 4 + g(x - 1, y) * 8
                ia[y * T:(y + 1) * T, x * T:(x + 1) * T] = np.array(at_cell(rim, m))[:, :, 3] > 0
    ta[~ia] = 0
    # 테 화소(가장자리 짙은 흙·밝은 풀 끝·남쪽 처마)는 길 위에도 다시
    rimimg = new(Wp, Hp)
    for y in range(H):
        for x in range(W):
            if ISLAND[y][x]:
                m = g(x, y - 1) * 1 + g(x + 1, y) * 2 + g(x, y + 1) * 4 + g(x - 1, y) * 8
                if m != 15: rimimg.alpha_composite(at_cell(rim, m), (x * T, y * T))
    ra = np.array(rimimg); lpa = np.array(I.LAWN)
    tile = np.tile(lpa, (H, W, 1))
    edgepx = (ra[:, :, 3] > 0) & ~np.all(ra == tile, axis=2)
    ta[edgepx] = ra[edgepx]
    top = Image.fromarray(ta, 'RGBA')
    img.alpha_composite(top)
    # 7) 땅 장식
    for (dimg, x, y) in decals: img.alpha_composite(dimg, (x, y))
    # 8) 그림자(키 큰 물체) — 섬 윗면에만
    mask = Image.new('L', img.size, 0)
    for sy, x, y, o, shd in objs:
        if shd and o.height >= 40: mask.paste(255, (x + 6, y + 3), o.split()[3].point(lambda v: 255 if v > 128 else 0))
    SH = (np.array(mask) > 0) & ia
    A = np.array(img).astype(np.float64); A[SH, :3] = np.floor(A[SH, :3] * np.array((.52, .58, .74))); img = Image.fromarray(A.astype(np.uint8), 'RGBA')
    # 9) 물체(발치 순)
    for sy, x, y, o, shd in sorted(objs, key=lambda q: (q[0], q[1])):
        if x >= 0 and y >= 0: img.alpha_composite(o, (x, y))
        else: img.alpha_composite(o.crop((max(0, -x), max(0, -y), o.width, o.height)), (max(0, x), max(0, y)))
    # 10) 위층 구름 덩이(칸에 맞춘 물체 — 뿌리 끝을 묻는 덩이·하늘 덩이·융단 위 뭉게)
    for (n, x, y) in sorted(CLOUDS, key=lambda q: (q[2] + CSZ[q[0]][1], q[1])):
        img.alpha_composite(part(n), (x * T, y * T))
    return img, ia

def walk_grid():
    g = [[False] * W for _ in range(H)]
    for y in range(H):
        for x in range(W):
            on = (ISLAND[y][x] or WALKX[y][x] or CPATH[y][x]) and not BLOCK[y][x]
            g[y][x] = on
    return g

def bfs(start, wg):
    seen = {start}; q = deque([start])
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < W and 0 <= ny < H and wg[ny][nx] and (nx, ny) not in seen: seen.add((nx, ny)); q.append((nx, ny))
    return seen

MARKS = {'entrance_pier': (0, 33), 'landing_pad': (10, 32), 'stair_foot': (18, 30), 'stair_top': (23, 23), 'temple_door': (31, 13),
         'plaza_fountain': (30, 18), 'bridge_w': (43, 14), 'bridge_e': (48, 15), 'garden_crystal': (54, 19), 'pergola': (51, 14),
         'cloudpath_n': (34, 26), 'cloudpath_s': (46, 33), 'windmill_door': (52, 38), 'beacon': (13, 37)}

if __name__ == '__main__':
    img, ia = render()
    wg = walk_grid()
    reach = bfs(MARKS['entrance_pier'], wg)
    res = {k: (v in reach) for k, v in MARKS.items()}
    print('reach', {k: v for k, v in res.items() if not v} or 'all ok', len(reach))
    img.save(os.path.join(HERE, 'render-1x.png'))
    img.resize((Wp * 2, Hp * 2), Image.NEAREST).save(os.path.join(HERE, 'render-2x.png'))
    grid = {'w': W, 'h': H, 'tile': 16, 'rows': [''.join('.' if wg[y][x] else '#' for x in range(W)) for y in range(H)],
            'legend': {'.': 'walkable', '#': 'blocked (sky/cloud sea, island face, object)'},
            'marks': {k: list(v) for k, v in MARKS.items()},
            'islands': [''.join((OWNER.get((x, y), '.')[0] if ISLAND[y][x] else ('c' if CPATH[y][x] else ('b' if WALKX[y][x] else '.'))) for x in range(W)) for y in range(H)]}
    json.dump(grid, open(os.path.join(HERE, 'grid.json'), 'w'), ensure_ascii=False)
    # 빈 바닥(섬 윗면만 센다): 물체 덮임 < .25, 길·광장·자갈·풀꽃 덩이 아님
    cov = np.zeros((H, W))
    for sy, x, y, o, shd in objs:
        a = np.array(o)[:, :, 3] > 128; full = np.zeros((Hp, Wp), bool)
        x0, y0 = max(0, x), max(0, y); x1, y1 = min(Wp, x + o.width), min(Hp, y + o.height)
        if x1 > x0 and y1 > y0: full[y0:y1, x0:x1] = a[y0 - y:y1 - y, x0 - x:x1 - x]
        cov = np.maximum(cov, full.reshape(H, T, W, T).mean(axis=(1, 3)))
    empty = np.zeros((H, W), bool); floor = np.zeros((H, W), bool)
    for y in range(H):
        for x in range(W):
            if ISLAND[y][x]:
                floor[y, x] = True
                empty[y, x] = cov[y, x] < .25 and not (PATH[y][x] or PLAZA[y][x] or GRAVEL[y][x] or COB[y][x] or (x, y) in FILL)
    worst = (0, 0, 0)
    for y0 in range(0, H - 15 + 1, 2):
        for x0 in range(0, W - 20 + 1, 2):
            f = floor[y0:y0 + 15, x0:x0 + 20].sum()
            if f < 60: continue
            r = empty[y0:y0 + 15, x0:x0 + 20].sum() / f
            if r > worst[0]: worst = (r, x0, y0)
    print('empty floor worst window %.2f at %s, overall %.2f' % (worst[0], worst[1:], empty.sum() / max(1, floor.sum())))
    # 조각 내보내기
    import sc_export
    (n, kinds), pr = sc_export.export(HERE)
    print('parts', n, kinds)
    # 조각 판(번호) — 검수용
    from PIL import ImageDraw
    items = [(k, pr.imgs[k]) for k in pr.order]
    cw, ch = 140, 190; cols = 9
    sh = Image.new('RGBA', (cols * cw, ((len(items) + cols - 1) // cols) * ch), (96, 140, 196, 255)); d = ImageDraw.Draw(sh)
    for k, (nm, pim) in enumerate(items):
        x = (k % cols) * cw; y = (k // cols) * ch
        sc = 1 if (pim.width > 64 or pim.height > 80) else 2
        sh.alpha_composite(pim.resize((pim.width * sc, pim.height * sc), Image.NEAREST), (x + 4, y + 4))
        d.text((x + 4, y + ch - 14), '%d %s' % (k + 1, nm[:20]), fill=(255, 255, 255, 255))
    os.makedirs(os.path.join(HERE, '_qa'), exist_ok=True)
    sh.save(os.path.join(HERE, '_qa', 'parts-sheet.png'))
    # 비교 시트: 같은 배율(2x)로 [버들항 기준 크롭 | 하늘 도시 크롭]
    from PIL import ImageFont
    try: FNT = ImageFont.truetype('/usr/share/fonts/truetype/nanum/NanumSquare_acR.ttf', 15)
    except Exception: FNT = None
    C6 = Image.open(os.path.join(B.ROOT, 'tiledata/beodeul-city/render/city6_base.png')).convert('RGBA')
    import subprocess, io
    OLD = Image.open(io.BytesIO(subprocess.run(['git', '-C', B.ROOT, 'show', 'a50b9f6d3e:tiledata/beodeul-variants/sky-city/render-1x.png'], capture_output=True).stdout)).convert('RGBA')
    SC3 = '/tmp/asst-bd/sc3.png'
    import sc_tiling as Z
    def tiled(name, w=20, h=12):            # 바닥 대표 칸 하나로 칠한 면(조수 시험에서 쓴 방식)
        im = Image.open(os.path.join(HERE, 'parts', name + '.png')).convert('RGBA'); c = im.crop((im.width // 32 * 16, im.height // 32 * 16, im.width // 32 * 16 + 16, im.height // 32 * 16 + 16))
        return Z.tile_q(c, w, h)
    def tiled_old(name, w=20, h=12):
        b = subprocess.run(['git', '-C', B.ROOT, 'show', 'a50b9f6d3e:tiledata/beodeul-variants/sky-city/parts/%s.png' % name], capture_output=True).stdout
        im = Image.open(io.BytesIO(b)).convert('RGBA'); c = im.crop((16, 16, 32, 32)); return Z.tile_q(c, w, h)
    rows = [
        (('보정 전: 구름 바다 대표 칸으로 면 칠하기(조수 시험 방식)', tiled_old('ground-cloudsea')), ('보정 후: 구름 바다 대표 칸으로 면 칠하기', tiled('ground-cloudsea'))),
        (('보정 전 데모: 구름 바다(절차 그림 — 팩에 없는 그림)', OLD.crop((0, 0, 320, 192))), ('보정 후 데모: 하늘 바탕 칸 + 구름 덩이 무리(자유 배치)', img.crop((0, 0, 320, 192)))),
        (('보정 전: 대리석 대표 칸 칠하기(상감 점 격자)', tiled_old('ground-marble')), ('보정 후 데모: 대리석 광장(바탕 + 조각 흩기)', img.crop((410, 196, 730, 388)))),
        (('보정 전 데모: 구름 길', OLD.crop((520, 380, 840, 572))), ('보정 후 데모: 구름 길(새 덩이 붓)·구름 덩이', img.crop((520, 380, 840, 572)))),
        (('버들항 city6_base: 포룸 광장(기준)', C6.crop((880, 600, 1200, 792))), ('보정 후: 하늘 신전·대리석 광장', img.crop((400, 100, 720, 292)))),
    ]
    cw, chh, lab = 640, 384, 22
    cmp_ = Image.new('RGBA', (cw * 2 + 12, (chh + lab + 8) * len(rows)), (22, 22, 30, 255)); d = ImageDraw.Draw(cmp_)
    for r, pair in enumerate(rows):
        for c, (title, crop) in enumerate(pair):
            x = c * (cw + 12); y = r * (chh + lab + 8)
            d.text((x + 4, y + 3), title, fill=(230, 230, 230, 255), font=FNT)
            cmp_.alpha_composite(crop.resize((crop.width * 2, crop.height * 2), Image.NEAREST), (x, y + lab))
    cmp_.save(os.path.join(HERE, 'compare-ref.png'))
