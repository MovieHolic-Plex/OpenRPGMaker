# 해안 절벽길 — 버들항 변형 5-1. 다시 돌리면 같은 그림이 나온다.
import sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE + '/../_lib-5')
from bd5 import *
import parts5 as P
import roman
import random
import numpy as np

W, H = 80, 44
s = Scene('coast-cliff-road', W, H, seed=51)
rng = random.Random(5101)

# ---------------- 지형 ----------------
E0 = 33
EDGE = noise_edge(5102, W, E0, 2.2, 10)
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
smooth_runs(EDGE, 5)              # 고원의 마지막 땅 줄(y)
for x in range(46, 62): EDGE[x] = E0                 # 계단·만 위쪽은 곧게
for x in range(62, 68): EDGE[x] = E0 + (1 if x > 63 else 0)
# 서쪽(x<WEST)은 두 단: 고원(2) → 바위벽 3칸 → 풀 선반(1) → 바위벽 3칸 → 바다(0)
WEST = 24
UP = [EDGE[x] - 4 for x in range(W)]
UPw = UP[:WEST]; smooth_runs(UPw, 5); UP[:WEST] = UPw
for x in range(7, 12): UP[x] = UP[9]                 # 선반 계단 자리는 곧게
SHELF = 7                                            # 고원 끝~선반 끝 (바위벽 3 + 풀 4)
for x in range(W):
    for y in range(H):
        if x < WEST: lv = 2 if y <= UP[x] else (1 if y <= UP[x] + SHELF else 0)
        else: lv = 2 if y <= EDGE[x] else 0
        s.lev[y][x] = lv
        if lv == 0: s.water[y][x] = True; s.nat[y][x] = True
s.stairs = [(52, E0 + 1, 3), (8, UP[9] + 1, 3)]
cove_rows = {E0 + 4: (49, 58), E0 + 5: (48, 59), E0 + 6: (49, 58), E0 + 7: (50, 57), E0 + 8: (51, 55)}
for y in (E0 + 1, E0 + 2, E0 + 3):
    for x in range(52, 55): s.water[y][x] = False; s.sand[y][x] = True
for y, (a, b) in cove_rows.items():
    for x in range(a, b + 1): s.water[y][x] = False; s.sand[y][x] = True

# ---------------- 대로: 굽이치는 돌길(연석 + 닳은 가운데) ----------------
from px2 import vnoise, _hash
def road_c(X):                                   # 중심선 y(px)
    x = X / 16.0
    return 16.0 * (23.2 + 2.3 * math.sin(x / 11.0 + 0.5) + 1.6 * math.sin(x / 23.0 + 2.0) + 0.9 * math.sin(x / 6.3 + 1.1))
def road_hw(X): return 13.2 + 1.7 * math.sin(X / 83.0 + 1.0) + 0.9 * math.sin(X / 29.0)
RM = np.zeros((H * 16, W * 16), bool); RD = np.zeros((H * 16, W * 16), np.float32)
for X in range(W * 16):
    cy = road_c(X); hw = road_hw(X); sl = (road_c(X + 1) - road_c(X - 1)) / 2.0; nf = 1.0 / math.sqrt(1 + sl * sl)
    for Y in range(int(cy - hw - 4), int(cy + hw + 5)):
        if not (0 <= Y < H * 16): continue
        j = 2.2 * (vnoise(X, Y, 7, 801) - 0.5) + 1.3 * (_hash(X // 3, Y // 3, 803) - 0.5)
        de = (hw + j - abs(Y - cy)) * nf
        RD[Y, X] = de
        if de > -3.0: RM[Y, X] = de > 0
topc = [0] * W; botc = [0] * W
for x in range(W):
    ys = [y for y in range(H) if RM[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16].any()]
    topc[x], botc[x] = min(ys), max(ys)
    for y in range(topc[x], botc[x] + 1): s.cobble[y][x] = True
ry = topc
def track_v(x, y0, y1, w=1):
    for y in range(min(y0, y1), max(y0, y1) + 1):
        for i in range(w): s.track[y][x + i] = True
def track_h(y, x0, x1):
    for x in range(min(x0, x1), max(x0, x1) + 1): s.track[y][x] = True

s.marks['west_exit'] = (0, ry[0]); s.marks['east_exit'] = (W - 1, ry[W - 1])

# ---------------- 곁길 3 + 앵커 ----------------
# (1) 양우리: 큰길 x=23~24 에서 북쪽 문으로
FX0, FX1, FY0, FY1 = 15, 28, 3, 10                  # 울타리 안 x, 북쪽 울타리 y, 남쪽 울타리 y
track_v(23, FY1, min(topc[23], topc[24]), 2)
track_v(23, FY1 - 5, FY1, 2)
s.reserve(FX0 - 2, FY0 - 1, FX1 + 2, FY1 + 1)
for kx in (14, 18, 22, 26): s.kit('bd-out-fence-run', kx, FY0)
for kx in (14, 18): s.kit('bd-out-fence-run', kx, FY1)
s.kit('bd-out-fence-run', 25, FY1); s.kit('bd-out-woodpile', 29, FY1)
bushE = lambda: tree_look('bushE', rng.randrange(4))
for by in (5, 7, 9):                            # 울타리 양옆: 낮은 울
    s.at(bushE(), 13, by); s.at(bushE(), 29, by)
s.kit('bd-out-cabin-small', 16, 4)
s.kit('bd-out-hay-barrels', 22, 5)
sheep = [P.ALL['sheep_a'](), P.ALL['sheep_b']()]
for (sx, sy) in ((20, 8), (24, 7), (18, 9), (26, 8), (22, 9), (27, 5), (16, 8)):
    s.at(sheep[(sx + sy) % 2], sx, sy, block=None)
s.at(P.ALL['haystack'](), 18, 5, block=None)
s.at(P.ALL['haystack'](), 27, 7, block=None)
s.at(P.ALL['trough'](), 20, 6, block=None)
s.at(P.ALL['trough'](), 26, 9, block=None)
for (sx, sy) in ((17, 7), (19, 9), (25, 6), (21, 7), (27, 9)):
    s.at(sheep[(sx * 3 + sy) % 2], sx, sy, block=None)
for (gx, gy) in ((18, 7), (22, 8), (26, 7), (19, 6), (21, 9), (25, 8)):
    s.at(P.ALL[('wild_a', 'wild_b', 'fern_c')[(gx + gy) % 3]](), gx, gy, block=None)
s.marks['sheepfold'] = (23, FY1 + 1)

# (2) 길가 사당: 큰길 북쪽 x~33~38, 모래 앞마당
sx0 = 32; sy = min(topc[x] for x in range(32, 38)) - 1
for y in range(sy - 4, sy + 2):
    for x in range(sx0, sx0 + 6): s.track[y][x] = True
shr = P.ALL['shrine']()
s.at(shr, sx0 + 2, sy - 3); s.reserve(sx0 + 2, sy - 5, sx0 + 3, sy - 3)
cy_img = roman.cypress(3)
s.at(cy_img, sx0 - 1, sy - 3); s.at(roman.cypress(3, seed=1), sx0 + 6, sy - 3)
s.reserve(sx0 - 1, sy - 5, sx0 - 1, sy - 3); s.reserve(sx0 + 6, sy - 5, sx0 + 6, sy - 3)
s.at(P.ALL['wayside_cross'](), sx0 + 4, sy - 1)
s.marks['shrine'] = (sx0 + 2, sy)

# (3) 조망대: 큰길 x=69 에서 남쪽 절벽 끝으로
ox = 69
track_v(ox, max(botc[ox], botc[ox + 1]), EDGE[ox] - 2, 2)
for y in range(EDGE[ox] - 4, EDGE[ox]):
    for x in range(ox - 2, ox + 4): s.track[y][x] = True
for kx in (ox - 3, ox + 1): s.kit('bd-out-fence-run', kx, EDGE[ox])
s.at(lib_sprite('bench_wood'), ox - 1, EDGE[ox] - 1, dy=-6)
s.reserve(ox - 4, EDGE[ox] - 5, ox + 5, EDGE[ox])
s.marks['overlook'] = (ox + 1, EDGE[ox] - 2)

# (4) 만으로 내려가는 길
track_v(52, max(botc[52:55]), E0, 3)
s.marks['cove'] = (53, E0 + 5)

# (5) 서쪽 선반으로 내려가는 계단: 큰길 → 고원 끝 계단 → 풀 선반(벤치·그물 말뚝)
track_v(8, max(botc[8:11]), UP[9], 3)
SY = UP[9] + 4                                       # 선반 첫 풀 줄
for y in range(SY, SY + 3):
    for x in range(5, 14): s.track[y][x] = True
s.reserve(5, SY, 13, SY + 2)
s.at(lib_sprite('bench_wood'), 12, SY + 1, dy=-2, block=None)
s.at(lib_sprite('net_rack'), 5, SY + 2, block=None)
s.at(lib_sprite('fish_barrel'), 13, SY + 2, block=None)
s.marks['shelf'] = (9, SY + 1)

# ---------------- 길 그리기: 연석·돌판·닳은 가운데·틈 난 풀 ----------------
import roman, terrain
TS = terrain.ST
GR = roman.GRV
LFc = terrain.LF
def road_img():
    im = Image.new('RGBA', (W * 16, H * 16)); px = im.load()
    for X in range(W * 16):
        cy = road_c(X)
        for Y in range(int(cy - road_hw(X) - 6), int(cy + road_hw(X) + 7)):
            if not (0 <= Y < H * 16): continue
            de = float(RD[Y, X])
            if de <= -3.0: continue
            if de <= 0:                                   # 가장자리 바깥: 흙이 조금 흘러나옴
                if _hash(X, Y, 811) < 0.22 + 0.1 * (de + 3) / 3: px[X, Y] = GR[3] + (255,)
                continue
            d = de
            off = (X * 0 + int(cy)) // 1
            if d < 1.0: c = TS[1]                          # 바깥 윤곽
            elif d < 4.0:                                  # 연석: 길이 7~10px 돌 덩이가 이어진다
                u = X + int(3 * vnoise(X, Y, 11, 812)); k = int(u / 8.5 + _hash(int(u / 8.5), Y > cy, 813) * 0.5)
                hb = _hash(k, Y > cy, 814); c = TS[5] if hb < 0.55 else TS[4]
                if d < 1.9: c = TS[4] if hb < 0.55 else TS[3]                 # 바깥쪽 한 줄은 한 단 어둡게
                if (u % 8.5) < 0.9: c = TS[2]                                 # 돌 사이 틈
                if d >= 3.2: c = TS[3]                                        # 안쪽 그늘 선
            else:
                c = roman.tex_flag(X, Y)
                ct = abs(Y - cy)                                              # 가운데 닳음: 자갈색 + 바퀴 자국 두 줄
                wear = vnoise(X, Y, 17, 815)
                if ct < 8 and wear > 0.42 - 0.05 * (8 - ct):
                    c = GR[4] if _hash(X, Y, 816) < 0.82 else GR[3]
                    if _hash(X, Y, 817) > 0.95: c = GR[5]
                for rut in (-5.5, 5.5):
                    if abs(Y - (cy + rut + 1.2 * math.sin(X / 9.0 + rut))) < 0.8 and wear > 0.3: c = GR[2]
                if _hash(X // 2, Y // 2, 818) < 0.012: c = GR[2]              # 빠진 돌 자리
                if d < 6.0 and _hash(X, Y, 819) < 0.03: c = LFc[3]            # 틈새 풀
            px[X, Y] = tuple(c[:3]) + (255,)
    return im

# ---------------- 이정표 ----------------
ms = P.ALL['milestone']()
s.at(ms, 14, botc[14] + 1); s.reserve(14, botc[14] + 1, 14, botc[14] + 1); s.marks['milestone_w'] = (14, botc[14])
s.at(ms, 60, topc[60] - 1); s.reserve(60, topc[60] - 1, 60, topc[60] - 1); s.marks['milestone_e'] = (60, topc[60])

# ---------------- 만의 소품 ----------------
s.at(P.ALL['rowboat'](), 49, E0 + 5, block=None)
s.at(lib_sprite('net_rack'), 56, E0 + 5, block=None)
s.at(lib_sprite('fish_crates'), 53, E0 + 7, block=None)
s.at(lib_sprite('fish_barrel'), 55, E0 + 6, block=None)
s.at(P.ALL['driftwood'](), 51, E0 + 8, block=None)
s.at(P.ALL['sea_rock_s'](), 58, E0 + 7, block=None)

# ---------------- 바다의 바위 ----------------
rl, rs = P.ALL['sea_rock_l'](), P.ALL['sea_rock_s']()
for (rx, rz, big) in ((12, 40, 1), (13, 43, 0), (24, 42, 1), (35, 45, 1), (36, 46, 0), (44, 40, 0), (66, 41, 1), (67, 44, 0), (73, 46, 1), (6, 46, 0), (28, 47, 0), (60, 45, 1), (61, 47, 0), (18, 37, 0), (40, 38, 1)):
    if rz < H and s.water[rz][rx]: s.at(rl if big else rs, rx, rz, block=None)

# ---------------- 덮개: 나무·숲·헤더 ----------------
NZ = value_noise(5103, W, H, 8)
def tall_ok(x, y, w, h):
    """세워진 그림 위쪽이 길·모래를 덮지 않는가."""
    for j in range(1, h):
        for i in range(w):
            yy = y - j
            if yy < 0: return False
            if s.cobble[yy][x + i] or s.track[yy][x + i]: return False
    return True
def mk_fir(name, w, h):
    im = [None]
    def f(s_, x, y):
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
        if not s.cell_free(x + i, y, lv, 0): return False
    im = roman.umbrella_pine()
    s.at(im, x, y, block=[(1, 0), (2, 0)]); [s._occ().add((x + i, y)) for i in range(4)]
    return True
def mk_cyp(s_, x, y):
    if not tall_ok(x, y, 1, 3): return False
    return s.put(roman.cypress(3, seed=x), x, y, fw=1)
def mk_stone(s_, x, y):
    return s.put(P.ALL[rng.choice(['stones_a', 'stones_b', 'stones_c'])](), x, y, block=True)
F_m, F_m2, F_l, F_s = mk_fir('fir_m', 2, 3), mk_fir('fir_m2', 2, 3), mk_fir('fir_l', 3, 4), mk_fir('fir_s', 2, 3)
O_a, O_b = mk_oak('oakA', 4, 5), mk_oak('oakB', 3, 4)
B_c, B_d, B_e = mk_bush('bushC', 2), mk_bush('bushD', 3), mk_bush('bushE', 2)

# 북쪽 숲띠
cluster(s, rng, 6, 7, 7, 4.5, 9, [F_m, F_m2, F_l, F_s, B_c, O_b, B_e])
cluster(s, rng, 37, 4, 9, 2.6, 8, [F_m, F_l, F_s, F_m2, B_c])
cluster(s, rng, 45, 12, 6, 3.5, 8, [O_a, O_b, B_d, B_c, F_m])
cluster(s, rng, 56, 7, 7, 4, 9, [F_l, F_m, F_s, F_m2, B_e, O_b])
cluster(s, rng, 73, 8, 6, 5, 10, [O_a, O_b, B_d, B_c, F_m, F_s])
cluster(s, rng, 6, 20, 6, 3, 6, [B_c, B_e, F_s, O_b])
cluster(s, rng, 48, 19, 7, 3, 7, [B_c, B_d, O_b, F_s])
cluster(s, rng, 24, 21, 5, 2.5, 4, [B_c, B_e, F_s])
cluster(s, rng, 12, 12, 4, 2.5, 5, [B_c, F_s, B_e])
cluster(s, rng, 11, 9, 4, 3, 6, [B_c, B_e, F_s, O_b, F_m])
cluster(s, rng, 20, 14, 4, 2, 4, [B_c, B_e, F_s])
cluster(s, rng, 8, 16, 7, 3, 6, [B_c, B_e, F_s])
cluster(s, rng, 5, 12, 4, 2.4, 5, [B_c, O_b, F_s])
cluster(s, rng, 15, 19, 5, 2.2, 5, [B_c, B_e, mk_stone])
cluster(s, rng, 38, 15, 5, 3, 6, [B_c, B_d, O_b])
# 남쪽 띠: 우산소나무·측백·바위 무더기
cluster(s, rng, 22, 29, 6, 2.6, 5, [mk_pine, mk_cyp, B_c])
cluster(s, rng, 38, 30, 6, 2.5, 6, [mk_pine, mk_cyp, mk_stone, B_c])
cluster(s, rng, 64, 29, 5, 2, 4, [mk_pine, mk_cyp, B_e])
cluster(s, rng, 8, 30, 5, 2.5, 5, [mk_stone, B_c, mk_cyp, B_e])
cluster(s, rng, 75, 27, 3, 2.5, 3, [mk_pine, mk_stone])
cluster(s, rng, 46, 27, 4, 1.6, 3, [mk_stone, B_c])

# 헤더(낮은 풀) — 덩어리 잡음으로 촘촘한 곳과 성긴 곳
H3 = [P.ALL[k]() for k in ('heath_a', 'heath_b', 'heath_c')]
order = [(x, y) for y in range(H) for x in range(W)]
rng.shuffle(order)
RIMP = [P.ALL[k]() for k in ('fern_a', 'fern_b', 'stones_a', 'wild_a', 'fern_c', 'stones_c', 'wild_b')]
def near_drop(x, y):
    lv = s.lev[y][x]
    return any(0 <= y + k < H and s.lev[y + k][x] < lv for k in (1, 2, 3))
for (x, y) in order:
    if s.lev[y][x] < 1 or not s.cell_free(x, y): continue
    if near_drop(x, y):                                   # 벼랑 머리: 같은 덤불 반복 대신 양치·돌·들풀을 섞어 성기게
        if rng.random() < 0.42:
            k = int(6.99 * vnoise(x * 16, y * 16, 40, 91)) if rng.random() < 0.6 else rng.randrange(7)
            s.put(RIMP[k], x, y, block=False, dx=rng.randrange(-5, 6), dy=rng.randrange(-2, 4))
        continue
    p = 0.95 if NZ[y][x] > 0.5 else (0.6 if NZ[y][x] > 0.36 else 0.3)
    if rng.random() < p:
        s.put(H3[rng.randrange(3)], x, y, block=False, dx=rng.randrange(-5, 6), dy=rng.randrange(-4, 5))

# 길은 픽셀 모양 그대로(칸 단위 포장 끄기). 바닥 풀 지움도 길 모양만.
ROAD = road_img()
s.overlays.append((ROAD, 0, 0))
terrain.paving = lambda mask, tx, ty, joins=None, curb=True: Image.new('RGBA', (W * 16, H * 16))
_rp0 = s.road_px
def _rp():
    tk = np.kron(np.array(s.track, bool) & ~np.array(s.sand, bool), np.ones((16, 16), bool))
    from scipy.ndimage import binary_dilation
    return tk | binary_dilation(RM, iterations=2)
s.road_px = _rp

# ---------------- 통행 · 밀도 · 저장 ----------------
def run():
    im = s.render()
    # 만 모래 둘레: 물가 띠의 풀 테두리를 모래로 바꾼다(맨 해변)
    import v6pieces, numpy as _n
    SAND = v6pieces.ctile(64, 224); px = im.load()
    for y in range(H):
        for x in range(W):
            if s.water[y][x] and any(0 <= y + b < H and 0 <= x + a < W and s.sand[y + b][x + a] for a in (-1, 0, 1) for b in (-1, 0, 1)):
                for ly in range(16):
                    for lx in range(16):
                        r, g, b_, a_ = px[x * 16 + lx, y * 16 + ly]
                        if g > r + 6 and g > b_ + 10 and a_ == 255: px[x * 16 + lx, y * 16 + ly] = tuple(SAND[(x * 16 + lx) % 16, (y * 16 + ly) % 16]) + (255,)
    reach = {}
    for st in ('west_exit', 'east_exit'):
        r = s.bfs(s.marks[st]); reach[st] = {k: (v in r) for k, v in s.marks.items()}
    dens = s.density()
    return im, reach, dens

if __name__ == '__main__':
    im, reach, dens = run()
    print(im.size, 'ry', ry[::8], 'bot', botc[::8]); print('reach W', all(reach['west_exit'].values()), 'E', all(reach['east_exit'].values()))
    print({k: v for k, v in reach['west_exit'].items() if not v}, 'density', dens)
    s.img = im
    P.register(s, ['fir_m', 'fir_m2', 'fir_l', 'fir_s', 'milestone', 'shrine', 'sea_rock_s', 'sea_rock_l', 'haystack', 'wayside_cross',
                   'heath_a', 'heath_b', 'heath_c', 'sheep_a', 'sheep_b', 'rowboat', 'driftwood', 'trough'])
    n = s.save(HERE, extra_grid={'reach': {k: all(v.values()) for k, v in reach.items()}, 'density_max_window': [float(dens[0]), list(dens[1])]})
    print('parts', n)
