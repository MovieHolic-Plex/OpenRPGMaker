# 밀밭 로마 대로 — 버들항 변형 5-2. 다시 돌리면 같은 그림이 나온다.
import sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE + '/../_lib-5')
from bd5 import *
import parts5 as P
import roman
from px2 import _hash
import math
import random

W, H = 88, 52
s = Scene('wheat-roman-road', W, H, seed=52)
rng = random.Random(5201)

# ---------------- 대로(픽셀로 굽이치는 연석 돌길) ----------------
import road5
def _sm(u): u = min(1.0, max(0.0, u)); return u * u * (3 - 2 * u)
def road_c(X):                                        # 중심선(px). 여관 앞(30~52)·갈림길(58~68)은 곧게
    x = X / 16.0
    g = 1.0 - 0.85 * (_sm((x - 26) / 8.0) * (1 - _sm((x - 52) / 8.0))) - 0.85 * (_sm((x - 54) / 8.0) * (1 - _sm((x - 66) / 8.0)))
    return 16.0 * (24.4 + g * (2.0 * math.sin(x / 13.0 + 0.4) + 1.1 * math.sin(x / 23.0 + 1.3) - 0.4)) + 2.0 * (1 - g) * math.sin(x * 1.3)
def road_hw(X): return 22.0 + 1.6 * math.sin(X / 37.0) + 0.9 * math.sin(X / 11.0 + 2)
RM, RD, topc, botc = road5.build(s, road_c, road_hw, 820)
ry = [int(round(road_c(x * 16 + 8) / 16.0 - 1.5)) for x in range(W)]
road5.install(s, RM, RD, road_c, road_hw, 820)
s.marks['west_exit'] = (0, ry[0] + 1); s.marks['east_exit'] = (W - 1, ry[W - 1] + 1)

def track_v(x, y0, y1, w=1):
    for y in range(min(y0, y1), max(y0, y1) + 1):
        for i in range(w): s.track[y][x + i] = True
def track_h(y, x0, x1, h=1):
    for x in range(min(x0, x1), max(x0, x1) + 1):
        for j in range(h): s.track[y + j][x] = True

# ---------------- 이정표 ----------------
ms = P.ALL['milestone']()
s.at(ms, 8, ry[8] + 4); s.reserve(8, ry[8] + 3, 8, ry[8] + 4); s.marks['milestone_w'] = (8, ry[8] + 2)
s.at(ms, 79, ry[79] - 1); s.reserve(79, ry[79] - 2, 79, ry[79] - 1); s.marks['milestone_e'] = (79, ry[79] + 1)

# ---------------- 길가 여관 ----------------
IX = 36; IY = ry[IX] - 3                              # 여관 밑변 줄
inn = lib_sprite('inn')
s.at(inn, IX, IY); s.reserve(IX - 1, IY - 8, IX + 8, IY)
track_h(IY + 1, IX - 4, IX + 15, ry[IX] - IY - 1)
s.marks['inn_door'] = (IX + 4, IY + 1)
s.at(lib_sprite('estable'), IX + 10, IY); s.reserve(IX + 10, IY - 5, IX + 12, IY)
s.at(lib_sprite('well_roofed'), IX - 3, IY); s.reserve(IX - 3, IY - 2, IX - 2, IY)
s.at(P.ALL['trough'](), IX + 13, ry[IX] - 1, block=None); s.reserve(IX + 13, ry[IX] - 1, IX + 14, ry[IX] - 1)
s.at(lib_sprite('bench_wood'), IX + 6, IY + 1, dy=-2, block=None)
s.at(lib_sprite('crate_apple'), IX - 1, IY + 1, block=None)
s.marks['stable'] = (IX + 11, IY + 1)
c3 = roman.cypress(3)
for (cx_, off) in ((IX - 6, 0), (IX + 16, 1)):
    s.at(roman.cypress(3, seed=off + 2), cx_, IY); s.reserve(cx_, IY - 3, cx_, IY)

# ---------------- 북쪽 농장 ----------------
FXT = 62
track_v(FXT, 16, ry[FXT] - 1, 2)                    # 대로 -> 마당
track_h(16, 50, 82, 2)                               # 농장 마당
kh, kb = 52, 64
s.kit('bd-out-house-plank', kh, 10); s.reserve(kh - 1, 9, kh + 8, 15)
s.kit('bd-out-longhouse', kb, 10); s.reserve(kb - 1, 9, kb + 10, 15)
s.marks['farm_door'] = (kh + 6, 16); s.marks['barn_door'] = (kb + 4, 16)
s.kit('bd-out-woodshed', 46, 13); s.reserve(45, 12, 49, 15)
s.kit('bd-out-woodpile', 49, 15)
s.kit('bd-out-hay-barrels', 61, 17 + 1 - 1) if False else None
s.at(lib_sprite('well_roofed'), 58, 19); s.reserve(58, 18, 59, 19)
s.kit('bd-out-hay-barrels', 72, 18); s.reserve(72, 18, 74, 18)
s.at(P.ALL['haystack'](), 76, 19, block=None); s.reserve(76, 18, 77, 19)
s.at(lib_sprite('veg_cart'), 55, 19, block=None)
s.marks['farm_well'] = (58, 20)
# 풍차 마당 (언덕 위)
track_v(80, 13, 16, 2)
track_h(13, 76, 83, 2)
mb = roman.windmill_body(); mb.alpha_composite(roman.windmill_sails(0))
s.at(mb, 78, 12); s.reserve(77, 6, 82, 12)
s.marks['mill'] = (79, 13)

# ---------------- 남쪽 곁길 : 연못 + 과수 ----------------
track_v(30, ry[30] + 3, 38, 2)
POND = (31, 44, 8.5, 4.2)
for y in range(H):
    for x in range(W):
        dxp, dyp = (x - POND[0]) / POND[2], (y - POND[1]) / POND[3]
        d = dxp * dxp + dyp * dyp + 0.16 * (_hash(x, y, 9) - 0.5)
        if d < 1.0: s.water[y][x] = True; s.nat[y][x] = True
for y in range(37, 41):
    for x in range(29, 33): s.track[y][x] = True
s.at(lib_sprite('bench_wood'), 33, 39, dy=-2, block=None)
s.marks['pond'] = (31, 39)

# ---------------- 밀밭 ----------------
WH = [P.ALL[k]() for k in ('wheat_a', 'wheat_b', 'wheat_c')]
s.fill = set()
def wheat_blob(cx, cy, rx, ry_, seed, ov=None):
    nz = value_noise(seed, W, H, 5)
    cells = []
    for y in range(max(1, int(cy - ry_ - 2)), min(H - 1, int(cy + ry_ + 3))):
        for x in range(max(1, int(cx - rx - 2)), min(W - 1, int(cx + rx + 3))):
            d = abs((x - cx) / rx) ** 3.2 + abs((y - cy) / ry_) ** 3.2 + 0.5 * (nz[y][x] - 0.5)
            if d < 1.0 and s.cell_free(x, y, 0, 0) and not any(s.cobble[y + b][x + a] or s.track[y + b][x + a] for a in (-1, 0, 1) for b in (-1, 0, 1)):
                cells.append((x, y))
    if rx >= 9:
        sx = int(cx + rng.choice((-2, -1, 0, 1)))
        cells = [(x, y) for (x, y) in cells if x != sx]
        for y in range(int(cy - ry_) - 1, int(cy + ry_) + 2):
            if any((sx + a, y) in set(cells) for a in (-1, 1)): s.track[y][sx] = True
    v0 = rng.randrange(3)
    for (x, y) in cells:
        img = WH[(v0 + (x // 2) + (y // 3)) % 3]
        s.overlays.append((img, x * 16, y * 16)); s.fill.add((x, y)); s._occ().add((x, y))
    return cells
def scare(cells, bias=0.5):
    if len(cells) < 12: return
    xs = sorted(c[0] for c in cells); ys = sorted(c[1] for c in cells)
    mx, my = xs[len(xs) // 2], ys[len(ys) // 2]
    if (mx, my) in s.fill: s.at(P.ALL['scarecrow'](), mx, my, block=None, shadow=False)
FIELDS = [(15, 11, 12.5, 6.5, 5301), (36, 5, 9, 3.2, 5302), (61, 4, 9, 2.8, 5307), (13, 39, 10.5, 6.2, 5303), (49, 39, 11, 6, 5304), (77, 41, 9.5, 6.5, 5305), (67, 31, 8, 2.4, 5306), (44, 32, 5.5, 2.4, 5308), (84, 26, 3.5, 3.2, 5309)]
FC = []
for (fx, fy, frx, fry, sd) in FIELDS:
    cells = wheat_blob(fx, fy, frx, fry, sd); FC.append(cells)
    scare(cells)

# ---------------- 소품 : 밀단·울타리 ----------------
sheaf = P.ALL['wheat_sheaf']()
def edge_cells(cells, dirn):
    S = set(cells)
    return [(x, y) for (x, y) in cells if (x + dirn[0], y + dirn[1]) not in S]
for cells in FC:
    if len(cells) < 20: continue
    S = set(cells)
    outs = [c for c in edge_cells(cells, (0, 1)) if s.cell_free(c[0], c[1] + 1, 0, 0)]
    rng.shuffle(outs)
    for (x, y) in outs[:2]:
        if s.cell_free(x, y + 1, 0, 0): s.at(sheaf, x, y + 1, block=None, shadow=False); s._occ().add((x, y + 1))
# 울타리: 밭 남·북 가장자리 바깥줄에 이어 붙인다(4칸 토막, 빈 곳만)
def fence_edge(cells, dy):
    S = set(cells); row = {}
    for (x, y) in cells:
        if (x, y + dy) not in S: row.setdefault(y + dy, []).append(x)
    for yy, xs in row.items():
        xs.sort(); i = 0
        while i < len(xs):
            if all(s.cell_free(xs[i] + k, yy, 0, 0) for k in range(4)) and xs[i] + 3 in xs and (yy - dy) >= 0:
                s.kit('bd-out-fence-run', xs[i], yy); s._occ().update((xs[i] + k, yy) for k in range(4)); i += 4
            else: i += 1
for n, cells in enumerate(FC):
    if len(cells) < 20: continue
    my = sum(c[1] for c in cells) / len(cells)
    fence_edge(cells, 1 if my < ry[W // 2] else -1)

# ---------------- 덮개 ----------------
def tall_ok(x, y, w, h):
    for j in range(1, h):
        for i in range(w):
            yy = y - j
            if yy < 0 or s.cobble[yy][x + i] or s.track[yy][x + i]: return False
    return True
def mk_oak(kind, w, h):
    def f(s_, x, y):
        if x + w > W or not tall_ok(x, y, w, h): return False
        return s.put_tree(kind, x, y)
    return f
def mk_bush(kind, w):
    def f(s_, x, y):
        if x + w > W: return False
        return s.put_tree(kind, x, y)
    return f
def mk_pine(s_, x, y):
    if x + 4 > W or not tall_ok(x, y, 4, 5): return False
    for i in range(4):
        if not s.cell_free(x + i, y, 0, 0): return False
    s.at(roman.umbrella_pine(), x, y, block=[(1, 0), (2, 0)]); [s._occ().add((x + i, y)) for i in range(4)]
    return True
def mk_cyp(s_, x, y):
    if not tall_ok(x, y, 1, 3): return False
    return s.put(roman.cypress(3, seed=x), x, y, fw=1)
O_a, O_b = mk_oak('oakA', 4, 5), mk_oak('oakB', 3, 4)
B_c, B_d, B_e = mk_bush('bushC', 2), mk_bush('bushD', 3), mk_bush('bushE', 2)
def mk_hedge(s_, x, y):
    if x + 3 > W: return False
    return s.put(lib_sprite('hedge'), x, y, fw=3, block=True)

cluster(s, rng, 5, 5, 6, 3.6, 9, [O_a, O_b, mk_pine, B_c, B_e])
cluster(s, rng, 24, 3, 6, 2.2, 6, [O_b, B_c, B_d, mk_pine])
cluster(s, rng, 52, 3, 5, 2.0, 5, [O_b, B_c, mk_cyp])
cluster(s, rng, 68, 4, 7, 2.6, 8, [O_a, O_b, B_d, mk_pine, B_e])
cluster(s, rng, 84, 5, 3, 3.6, 5, [O_b, B_c, B_e, mk_cyp])
cluster(s, rng, 30, 16, 6, 2.2, 6, [B_c, B_e, B_d, O_b])
cluster(s, rng, 16, 21, 3, 1.5, 3, [mk_cyp, mk_cyp, B_e])
cluster(s, rng, 84, 21, 3, 2, 4, [mk_cyp, B_c, B_e])
cluster(s, rng, 3, 30, 3.5, 3, 5, [O_b, B_c, mk_cyp])
cluster(s, rng, 12, 43, 6, 4.5, 10, [O_a, O_b, B_d, B_c, B_e])
cluster(s, rng, 36, 46, 5, 3.2, 7, [O_b, B_c, mk_pine, B_e])
cluster(s, rng, 44, 33, 4, 2.4, 6, [B_c, B_d, O_b, mk_cyp])
cluster(s, rng, 66, 47, 7, 3, 7, [mk_pine, O_b, B_c, B_e])
cluster(s, rng, 84, 34, 3, 4, 6, [O_b, B_c, mk_cyp, B_e])
cluster(s, rng, 48, 41, 3.5, 3.5, 5, [B_c, B_e, O_b])
cluster(s, rng, 70, 30, 6, 2, 6, [B_c, B_e, mk_hedge])
cluster(s, rng, 4, 20, 3, 3, 4, [B_c, B_e, mk_hedge])
cluster(s, rng, 39, 30, 4, 1.6, 4, [B_c, B_e])
cluster(s, rng, 12, 28, 5, 1.8, 4, [B_c, B_e, B_d])
cluster(s, rng, 30, 34, 4, 2.2, 4, [B_c, B_e])
cluster(s, rng, 20, 2, 3, 1.2, 2, [B_c])
cluster(s, rng, 21, 31, 3.5, 2.5, 6, [O_b, B_c, B_d, B_e])
cluster(s, rng, 26, 28, 2.5, 1.2, 3, [B_c, B_e])
cluster(s, rng, 41, 11, 4, 2.2, 6, [O_b, B_c, B_d, B_e])
cluster(s, rng, 44, 18, 3, 1.6, 4, [mk_cyp, B_c, B_e])
cluster(s, rng, 30, 12, 3, 2, 4, [B_c, B_d, O_b])
cluster(s, rng, 74, 3, 4, 2, 4, [O_b, B_c, B_e])
cluster(s, rng, 49, 20, 3.5, 1.8, 5, [O_b, B_c, B_d, B_e])

# 들꽃 덮개 — 덩어리 잡음으로 꽃밭·성긴 풀밭
NZ = value_noise(5277, W, H, 7)
WF = [P.ALL[k]() for k in ('wild_a', 'wild_b', 'wild_c')]
order = [(x, y) for y in range(H) for x in range(W)]
rng.shuffle(order)
for (x, y) in order:
    if (x, y) in s.fill or not s.cell_free(x, y): continue
    p = 0.97 if NZ[y][x] > 0.5 else (0.8 if NZ[y][x] > 0.36 else 0.5)
    if rng.random() < p:
        s.put(WF[rng.randrange(3)], x, y, block=False, dx=rng.randrange(-2, 3), dy=rng.randrange(-2, 3))

# ---------------- 통행 · 밀도 · 저장 ----------------
def run():
    im = s.render()
    reach = {}
    for st in ('west_exit', 'east_exit'):
        r = s.bfs(s.marks[st]); reach[st] = {k: (v in r) for k, v in s.marks.items()}
    dens = s.density()
    return im, reach, dens

if __name__ == '__main__':
    im, reach, dens = run()
    print(im.size, 'ry', ry[::8]); print('reach W', all(reach['west_exit'].values()), 'E', all(reach['east_exit'].values()))
    print({k: v for k, v in reach['west_exit'].items() if not v}, 'density', dens, 'wheat cells', len(s.fill))
    s.img = im
    P.register(s, ['milestone', 'wheat_a', 'wheat_b', 'wheat_c', 'scarecrow', 'wheat_sheaf', 'trough', 'haystack', 'wild_a', 'wild_b', 'wild_c'])
    n = s.save(HERE, extra_grid={'reach': {k: all(v.values()) for k, v in reach.items()}, 'density_max_window': [float(dens[0]), list(dens[1])], 'wheat_cells': len(s.fill)})
    print('parts', n)
