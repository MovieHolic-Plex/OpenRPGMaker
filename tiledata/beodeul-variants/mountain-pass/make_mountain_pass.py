# 고갯길 — 버들항 변형 5-4. 다시 돌리면 같은 그림이 나온다.
import sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE + '/../_lib-5')
from bd5 import *
import parts5 as P
import roman
import random

W, H = 88, 58
s = Scene('mountain-pass', W, H, seed=54)
rng = random.Random(5401)

# ---------------- 지형: 능선(lev2) / 선반(lev1) / 계곡(lev0) ----------------
def smooth_runs(a, mn):
    ch = True
    while ch:
        ch = False; i = 0
        while i < len(a):
            j = i
            while j + 1 < len(a) and a[j + 1] == a[i]: j += 1
            if j - i + 1 < mn and 0 < i and j < len(a) - 1:
                for k in range(i, j + 1): a[k] = a[i - 1]
                ch = True
            i = j + 1
E2b, E1b = 13, 34
E2 = noise_edge(5402, W, E2b, 1.6, 9); E1 = noise_edge(5403, W, E1b, 1.6, 9)
smooth_runs(E2, 5); smooth_runs(E1, 5)
STAIRS = [(58, 3, 1), (14, 3, 2), (78, 3, 2), (83, 3, 1)]        # (x, 폭, 어느 절벽: 1=아래 절벽, 2=위 절벽)
for (sx, sw, t) in STAIRS:
    arr = E1 if t == 1 else E2
    base = E1b if t == 1 else E2b
    for x in range(sx - 3, min(W, sx + sw + 3)): arr[x] = base
for x in range(61, 70): E2[x] = E2b; E1[x] = E1b                 # 폭포 둘레는 곧게
for y in range(H):
    for x in range(W):
        s.lev[y][x] = 2 if y <= E2[x] else (1 if y <= E1[x] else 0)
s.stairs = [(58, E1b + 1, 3), (14, E2b + 1, 3), (78, E2b + 1, 3), (83, E1b + 1, 3)]
s.falls = [(65, E2b + 1, 2), (65, E1b + 1, 2)]

# 강: 능선 x65~66(위쪽 개울) → 폭포① → 선반 강 → 폭포② → 계곡 강(3칸) → 아래 가장자리
def wat(x, y):
    s.water[y][x] = True; s.nat[y][x] = True; s.flow[y][x] = 'S'
for y in range(0, E2b + 1):
    for x in (65, 66): wat(x, y)
for y in range(E2b + 4, E1b + 1):
    for x in (65, 66): wat(x, y)
for y in range(E1b + 4, H):
    for x in (64, 65, 66): wat(x, y)

# ---------------- 길 (흙길) ----------------
def hroad(x0, x1, f, w=2):
    prev = None
    for x in range(min(x0, x1), max(x0, x1) + 1):
        y = f(x)
        for j in range(w): s.track[y + j][x] = True
        if prev is not None:
            for yy in range(min(prev, y), max(prev, y) + w): s.track[yy][x] = True
        prev = y
def vroad(y0, y1, g, w=2):
    prev = None
    for y in range(min(y0, y1), max(y0, y1) + 1):
        x = g(y)
        for i in range(w): s.track[y][x + i] = True
        if prev is not None:
            for xx in range(min(prev, x), max(prev, x) + w): s.track[y][xx] = True
        prev = x
def patch(x0, y0, x1, y1):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if not s.water[y][x]: s.track[y][x] = True

# 1구간: 계곡(서쪽 출구 → 계단① 아래)
f1 = lambda x: int(round(46 + 1.6 * math.sin(x / 11.0 + 1)))
hroad(0, 59, f1)
vroad(E1b + 4, f1(58), lambda y: 58, 3)        # x58~60
# 2구간: 선반 (계단① 위 → 서쪽으로 되돌아 → 계단② 아래)
vroad(29, E1b, lambda y: 58, 3)
f2 = lambda x: int(round(28 + 3.0 * math.sin(x / 9.0)))
hroad(15, 59, f2)
vroad(E2b + 4, f2(15), lambda y: 14, 3)        # x14~16
# 3구간: 능선 (계단② 위 → 동쪽 → 계단③)
vroad(9, E2b, lambda y: 14, 3)
f3 = lambda x: 8
hroad(14, 79, f3)
vroad(9, E2b, lambda y: 78, 3)
# 4구간: 동쪽 선반 → 계단④ → 동쪽 계곡 → 동쪽 출구
vroad(E2b + 4, 30, lambda y: 78 + int(round(5 * (y - 17) / 13.0)) if y < 30 else 83, 3)
vroad(30, E1b, lambda y: 83, 3)
vroad(E1b + 4, 47, lambda y: 83, 3)
f4 = lambda x: 46 + int(round(1.2 * math.sin(x / 9.0 + 0.5)))
hroad(83, W - 1, f4)

s.marks['west_exit'] = (0, f1(0)); s.marks['east_exit'] = (W - 1, f4(W - 1))

# ---------------- 돌다리: 강 위, 능선 길 위 ----------------
BR = (63, 10)
bridge_cells = [(x, y) for x in range(63, 68) for y in (8, 9)]
for (x, y) in bridge_cells: s.track[y][x] = False
for x in (65, 66):
    for y in (8, 9): s.track[y][x] = False
s.top_overlays.append((P.ALL['stone_bridge'](), 63 * 16, 7 * 16))
_wg = s.walk_grid
def _bridge_walk():
    g = _wg()
    for (x, y) in bridge_cells: g[y][x] = True
    return g
s.walk_grid = _bridge_walk
s.reserve(62, 6, 68, 11)
for x in (63, 64, 67):
    for y in (8, 9): s.track[y][x] = True

# ---------------- 앵커 ----------------
# (1) 나귀꾼 쉼터 — 계곡 x22~31, y40~44 (곁길: 큰길 x=26 에서 북쪽)
vroad(40, f1(26) - 1, lambda y: 26, 2)
patch(22, 41, 31, 43)
s.reserve(21, 39, 32, 45)
s.kit('bd-out-cabin-small', 22, 39)
s.at(P.ALL['trough'](), 30, 41)
s.kit('bd-out-hay-barrels', 27, 40)
s.at(P.ALL['campfire'](), 24, 43, block=None)
s.at(lib_sprite('bench_wood'), 28, 43, dy=-4)
s.marks['halt'] = (26, 42)

# (2) 은자의 오두막 + 사당 — 선반 x38~46, y18~22 (곁길: 큰길 x=40 에서 북쪽)
vroad(21, f2(40) - 1, lambda y: 40, 2)
patch(37, 20, 44, 22)
s.reserve(36, 15, 47, 23)
s.kit('bd-out-cabin-small', 36, 17)
s.kit('bd-out-woodpile', 40, 17)
s.at(P.ALL['shrine'](), 43, 21)
s.at(P.ALL['stump'](), 39, 22, block=None)
s.marks['hermit'] = (40, 21)

# (3) 조망대 — 선반 남쪽 벼랑 끝 (곁길: 큰길 x=29 에서 남쪽)
vroad(f2(29) + 2, 32, lambda y: 29, 2)
patch(26, 31, 33, 32)
s.reserve(25, 29, 34, E1b)
s.at(lib_sprite('bench_wood'), 28, 32, dy=-4)
s.at(P.ALL['cairn'](), 31, 32)
for kx in (24, 32): s.kit('bd-out-fence-run', kx, E1b - 1)
s.marks['overlook'] = (29, 31)

# (4) 초소 — 능선 x30~40 (길 북쪽)
s.reserve(29, 2, 41, 7)
s.at(P.ALL['guard_post'](), 34, 7)
s.at(P.ALL['wall_seg'](), 31, 7); s.at(P.ALL['wall_seg'](), 37, 7)
s.at(P.ALL['brazier'](), 39, 7)
s.at(P.ALL['trail_post'](), 29, 10)
s.marks['guard'] = (35, 8)

# (5) 정상 쉼터 — 능선 x69~77, y8~11
patch(69, 8, 77, 11)
s.reserve(68, 5, 78, 12)
s.at(P.ALL['cairn'](), 72, 7)
s.at(P.ALL['campfire'](), 74, 10, block=None)
s.at(lib_sprite('bench_wood'), 70, 11, dy=-4)
s.at(P.ALL['wayside_cross'](), 76, 7)
s.kit('bd-out-signpost', 69, 10)
s.marks['summit'] = (73, 9)
s.marks['bridge'] = (65, 9)

# (6) 동쪽 선반 — 길가 사당 + 케른 (x 74~80, y 20~24)
patch(74, 21, 80, 22)
s.reserve(72, 17, 82, 24)
s.at(P.ALL['shrine'](), 74, 20)
s.at(P.ALL['cairn_s'](), 79, 20)
s.at(P.ALL['stump'](), 76, 23, block=None)
s.marks['east_shrine'] = (77, 21)

# (7) 동쪽 계곡 — 이정표 · 작은 야영
ms = P.ALL['milestone']()
s.at(ms, 84, f4(84) + 3); s.reserve(84, f4(84) + 3, 84, f4(84) + 3)
s.marks['milestone'] = (84, f4(84) + 2)
patch(72, 50, 78, 51)
vroad(f4(75) + 2, 50, lambda y: 75, 2)
s.reserve(70, 48, 80, 54)
s.at(P.ALL['campfire'](), 73, 52, block=None)
s.at(P.ALL['log_fallen'](), 76, 52, block=None)
s.kit('bd-out-woodpile', 77, 49)
s.marks['camp'] = (75, 50)

# (8) 계곡 서쪽 이정표
s.at(ms, 11, f1(11) + 3); s.reserve(11, f1(11) + 3, 11, f1(11) + 3)
s.marks['milestone_w'] = (11, f1(11) + 2)

# 길 틈 메우기: 한 칸짜리 풀 구멍·뾰족한 돌기를 없앤다
def fill_holes():
    for _ in range(3):
        for y in range(1, H - 1):
            for x in range(1, W - 1):
                if s.track[y][x] or s.water[y][x] or (x, y) in s._occ(): continue
                n4 = [s.track[y][x - 1], s.track[y][x + 1], s.track[y - 1][x], s.track[y + 1][x]]
                if sum(n4) >= 3 or (n4[0] and n4[1]) or (n4[2] and n4[3]): s.track[y][x] = True
fill_holes()

# ---------------- 덮개 ----------------
NZ = value_noise(5404, W, H, 8)
def tall_ok(x, y, w, h):
    F = s.faces() if not hasattr(s, '_F') else s._F
    for j in range(1, h):
        for i in range(w):
            yy = y - j
            if yy < 0 or x + i >= W: return False
            if s.cobble[yy][x + i] or s.track[yy][x + i] or F[yy][x + i]: return False
    return True
def mk_fir(name, w, h):
    im = [None]
    def f(s_, x, y):
        if x + w > W: return False
        if im[0] is None: im[0] = P.ALL[name]()
        if not tall_ok(x, y, w, h): return False
        return s.put(im[0], x, y, fw=w, margin=0)
    return f
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
    lv = s.lev[y][x]
    for i in range(4):
        if not s.cell_free(x + i, y, lv, 0) or s.lev[y][x + i] != lv: return False
    im = roman.umbrella_pine()
    s.at(im, x, y, block=[(1, 0), (2, 0)]); [s._occ().add((x + i, y)) for i in range(4)]
    return True
def mk_stone(s_, x, y):
    return s.put(P.ALL[rng.choice(['stones_a', 'stones_b', 'stones_c'])](), x, y, block=True)
def mk_boulder(name, w):
    im = [None]
    def f(s_, x, y):
        if x + w > W: return False
        if im[0] is None: im[0] = P.ALL[name]()
        return s.put(im[0], x, y, fw=w, margin=0)
    return f
F_m, F_m2, F_l, F_s = mk_fir('fir_m', 2, 3), mk_fir('fir_m2', 2, 3), mk_fir('fir_l', 3, 4), mk_fir('fir_s', 2, 3)
O_a, O_b = mk_oak('oakA', 4, 5), mk_oak('oakB', 3, 4)
B_c, B_d, B_e = mk_bush('bushC', 2), mk_bush('bushD', 3), mk_bush('bushE', 2)
R_l, R_m = mk_boulder('boulder_l', 2), mk_boulder('boulder_m', 2)

# 능선: 북쪽은 전나무 숲(강 서·동)
cluster(s, rng, 6, 4, 7, 3.5, 12, [F_m, F_m2, F_l, F_s, F_l])
cluster(s, rng, 22, 3, 7, 3, 11, [F_l, F_m, F_s, F_m2, B_c])
cluster(s, rng, 47, 3, 9, 3, 14, [F_m, F_l, F_m2, F_s, F_l, B_e])
cluster(s, rng, 58, 4, 4, 3, 6, [F_s, F_m, B_c])
cluster(s, rng, 73, 3, 6, 2.6, 8, [F_l, F_m, F_s, F_m2])
cluster(s, rng, 84, 5, 4, 5, 8, [F_m, F_l, F_s, F_m2, B_c])
cluster(s, rng, 6, 11, 6, 2, 6, [F_s, B_c, B_e, R_m])
cluster(s, rng, 45, 12, 10, 1.8, 7, [R_m, B_c, F_s, mk_stone])
cluster(s, rng, 55, 11, 3, 1.5, 3, [B_c, R_m])
cluster(s, rng, 85, 11, 3, 2, 4, [F_s, B_c])
# 선반: 바위 무더기·전나무·덤불
cluster(s, rng, 6, 22, 7, 4, 10, [F_m, F_s, B_c, R_l, B_e, F_m2])
cluster(s, rng, 24, 24, 6, 2.5, 6, [O_b, B_d, B_c, R_m])
cluster(s, rng, 50, 21, 8, 3, 11, [F_l, F_m, O_b, B_c, R_l, F_s])
cluster(s, rng, 56, 31, 4, 2, 4, [B_c, R_m, F_s])
cluster(s, rng, 40, 31, 5, 2.4, 6, [B_d, mk_stone, B_c, mk_pine])
cluster(s, rng, 10, 32, 7, 2, 7, [R_l, B_c, R_m, mk_stone, B_e])
cluster(s, rng, 71, 24, 4, 3, 7, [F_m, F_l, B_c, R_m, F_s])
cluster(s, rng, 86, 25, 3, 5, 9, [F_m, F_l, F_s, B_c])
cluster(s, rng, 72, 32, 6, 1.8, 6, [B_c, B_d, R_m, mk_stone])
cluster(s, rng, 84, 20, 3, 2, 4, [F_s, B_c])
# 계곡: 참나무·소나무·바위 밭
cluster(s, rng, 8, 41, 7, 2.2, 8, [O_b, B_c, B_d, mk_pine])
cluster(s, rng, 40, 41, 8, 2, 8, [O_a, O_b, B_c, B_d])
cluster(s, rng, 52, 40, 4, 1.6, 4, [B_c, B_e, mk_stone])
cluster(s, rng, 53, 53, 6, 3, 12, [R_l, R_m, R_l, mk_stone, R_m, B_c])
cluster(s, rng, 12, 53, 9, 3, 10, [O_b, mk_pine, B_c, B_d, O_a, mk_stone])
cluster(s, rng, 33, 54, 7, 2.5, 8, [mk_pine, B_c, O_b, mk_stone])
cluster(s, rng, 76, 42, 6, 2.4, 8, [O_a, O_b, B_d, B_c, mk_pine])
cluster(s, rng, 84, 54, 4, 2.6, 6, [mk_pine, O_b, B_c])
cluster(s, rng, 71, 55, 4, 1.8, 4, [B_c, R_m, mk_stone])

# 작은 덮개(비블록): 자갈·고산 꽃·오솔길 표지 → 선반·능선, 헤더는 전 층
SC = [P.ALL['scree_a'](), P.ALL['scree_b']()]
AL = [P.ALL['alpine_a'](), P.ALL['alpine_b']()]
H3 = [P.ALL[k]() for k in ('heath_a', 'heath_b', 'heath_c')]
order = [(x, y) for y in range(H) for x in range(W)]
rng.shuffle(order)
for (x, y) in order:
    if not s.cell_free(x, y): continue
    lv = s.lev[y][x]; n = NZ[y][x]
    p = 1.0 if n > 0.42 else (0.8 if n > 0.3 else 0.45)
    if lv >= 1 and rng.random() < 0.14:
        s.put(rng.choice(SC + AL), x, y, block=False, dx=rng.randrange(-3, 4), dy=rng.randrange(-3, 4)); continue
    if rng.random() < p:
        s.put(H3[rng.randrange(3)], x, y, block=False, dx=rng.randrange(-5, 6), dy=rng.randrange(-4, 5))
# 오솔길 표지: 갈림길마다
for (tx, ty) in ((25, f1(25) - 1), (39, f2(39) - 1), (28, f2(28) - 1), (57, f3(57) - 1)):
    if s.cell_free(tx, ty): s.at(P.ALL['trail_post'](), tx, ty)

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
    print(im.size); print('reach W', all(reach['west_exit'].values()), 'E', all(reach['east_exit'].values()))
    print({k: v for st in reach for k, v in reach[st].items() if not v}, 'density', dens)
    s.img = im
    P.register(s, ['stone_bridge', 'boulder_l', 'boulder_m', 'scree_a', 'scree_b', 'alpine_a', 'alpine_b', 'brazier', 'trail_post', 'wall_seg',
                   'fir_m', 'fir_m2', 'fir_l', 'fir_s', 'milestone', 'shrine', 'guard_post', 'cairn', 'cairn_s', 'campfire', 'wayside_cross',
                   'trough', 'stump', 'log_fallen', 'heath_a', 'heath_b', 'heath_c'])
    n = s.save(HERE, extra_grid={'reach': {k: all(v.values()) for k, v in reach.items()}, 'density_max_window': [float(dens[0]), list(dens[1])]})
    print('parts', n)
