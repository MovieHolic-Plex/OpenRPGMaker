# 깊은 숲길 — 버들항 변형 5-3. 다시 돌리면 같은 그림이 나온다.
import sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE + '/../_lib-5')
from bd5 import *
import parts5 as P
import random

W, H = 84, 56
s = Scene('deep-forest-path', W, H, seed=53)
rng = random.Random(5301)
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

# ---------------- 길: 서→동, 성문에서 북으로 꺾임 ----------------
GX = 69                                             # 성문 통로 왼쪽 칸(통로 GX, GX+1)
def road_f(x): return 30.4 + 2.0 * math.sin(x / 9.5 + 0.6) + 1.0 * math.sin(x / 21.0 + 1.3)
ry = [int(round(road_f(x))) for x in range(GX + 2)]
smooth_runs(ry, 5)
for x in range(46, 54): ry[x] = ry[46]                # 여울 둘레는 곧게
ry_w = ry[GX]
ry_e = [22 + (1 if x < 77 and x > 74 else 0) for x in range(W)]   # 성문 뒤 동쪽 구간
for x in range(0, GX + 2):
    if x > 0:
        for y in range(min(ry[x - 1], ry[x]), max(ry[x - 1], ry[x]) + 2): s.track[y][x] = True
    for y in (ry[x], ry[x] + 1): s.track[y][x] = True
for y in range(ry_e[GX] , ry[GX] + 2):                # 세로 구간(성문 통로 두 칸)
    for x in (GX, GX + 1): s.track[y][x] = True
for x in range(GX, W):
    for y in (ry_e[x], ry_e[x] + 1): s.track[y][x] = True
    if x > GX and ry_e[x] != ry_e[x - 1]:
        for y in range(min(ry_e[x - 1], ry_e[x]), max(ry_e[x - 1], ry_e[x]) + 2): s.track[y][x] = True

def track_v(x, y0, y1, w=1):
    for y in range(min(y0, y1), max(y0, y1) + 1):
        for i in range(w): s.track[y][x + i] = True
def track_h(y, x0, x1, w=1):
    for x in range(min(x0, x1), max(x0, x1) + 1):
        for j in range(w): s.track[y + j][x] = True
s.marks['west_exit'] = (0, ry[0]); s.marks['east_exit'] = (W - 1, ry_e[W - 1])

# ---------------- 개울 (북→남, 2칸 폭) ----------------
def sx_of(y):
    if ry[46] - 5 <= y <= ry[46] + 5: return 49
    return 49 + int(round(2.2 * math.sin(y / 8.0 + 0.5)))
SX = [sx_of(y) for y in range(H)]
smooth_runs(SX, 4)
for y in range(H):
    for x in (SX[y], SX[y] + 1):
        s.water[y][x] = True; s.nat[y][x] = True; s.flow[y][x] = 'S'
    if y > 0 and SX[y] != SX[y - 1]:                    # 어긋나는 줄: 두 줄을 이어 붙인다
        for x in range(min(SX[y - 1], SX[y]), max(SX[y - 1], SX[y]) + 2):
            s.water[y][x] = True; s.nat[y][x] = True; s.flow[y][x] = 'S'
# 여울: 길이 개울을 지나는 자리의 물칸(걸을 수 있음)
ford = [(x, y) for y in (ry[SX[ry[46]]], ry[SX[ry[46]]] + 1) for x in range(SX[ry[46]] - 1, SX[ry[46]] + 3) if s.water[y][x]]
for (x, y) in ford: s.track[y][x] = False
stone_imgs = [P.ALL['stones_a'](), P.ALL['stones_b'](), P.ALL['stones_c']()]
for i, (x, y) in enumerate(ford): s.top_overlays.append((stone_imgs[i % 3], x * 16, y * 16))
_wg = s.walk_grid
def walk_with_ford():
    g = _wg()
    for (x, y) in ford: g[y][x] = True
    return g
s.walk_grid = walk_with_ford
FY = ry[SX[ry[46]]]
s.marks['ford'] = (SX[ry[46]] - 1, FY)

# ---------------- 앵커 1: 사냥꾼 숲 터 ----------------
CX, CYc = 33, ry[33] - 6                              # 숲 터 중심
def in_clearing(x, y): return ((x - CX) / 8.0) ** 2 + ((y - CYc) / 5.6) ** 2 <= 1.0
LX, LY = CX - 3, CYc - 5                              # 오두막 왼쪽 위 칸(5×6칸)
s.kit('bd-out-cabin', LX, LY)
door = (LX + 2, LY + 6)
track_v(LX + 2, LY + 6, ry[LX + 2] - 1, 2)            # 앞길
s.marks['lodge'] = (LX + 2, LY + 6)
s.kit('bd-out-woodshed', LX + 7, LY + 1)
s.kit('bd-out-woodpile', LX - 3, LY + 4)
s.at(P.ALL['chopping_block'](), LX + 7, LY + 7, block=None)
s.at(P.ALL['hide_rack'](), LX - 5, LY + 7)
s.at(P.ALL['campfire'](), LX + 6, LY + 9, block=None)
s.at(P.ALL['stump'](), LX + 8, LY + 9); s.at(P.ALL['stump'](), LX + 4, LY + 10, block=None)
s.at(P.ALL['log_fallen'](), LX + 9, LY + 11, block=None)
s.at(P.ALL['log_fallen'](), LX + 3, LY + 11, block=None)
s.at(P.ALL['log_fallen'](), LX - 4, LY + 1, block=None); s.at(P.ALL['stump'](), LX - 2, LY + 2, block=None)
s.at(P.ALL['stump'](), LX + 10, LY + 8, block=None); s.at(P.ALL['toadstools_b'](), LX + 11, LY + 5, block=None)
for (dx, dy, k) in ((-2, 6, 'wild_a'), (12, 3, 'wild_b'), (5, 11, 'wild_c'), (10, -1, 'wild_a')):
    s.at(P.ALL[k](), LX + dx, LY + dy, block=None)
for y in range(LY - 1, LY + 12):
    for x in range(CX - 10, CX + 11):
        if in_clearing(x, y) or (LX - 1 <= x <= LX + 12 and LY - 1 <= y <= LY + 7): s.reserve(x, y, x, y)
s.at(lib_sprite('signpost') if False else P.ALL['hunter_post'](), CX - 11, ry[CX - 11] - 1)   # 숲 터 서쪽 들머리 표지
s.reserve(CX - 11, ry[CX - 11] - 1, CX - 11, ry[CX - 11] - 1)
s.marks['clearing'] = (CX, ry[CX] - 1)

# ---------------- 곁길 A: 남쪽 야영지 ----------------
AX = 12
track_v(AX, ry[AX] + 2, 45, 1)
for (x0, y0, w, h) in ((AX - 4, 43, 9, 5),):
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            if (x - AX) ** 2 / 13.0 + (y - 45) ** 2 / 7.0 <= 1: s.track[y][x] = True
s.reserve(AX - 5, 41, AX + 5, 49)
s.at(P.ALL['campfire'](), AX, 45, block=None)
s.at(P.ALL['log_fallen'](), AX - 4, 46); s.at(P.ALL['log_fallen'](), AX + 2, 43, block=None)
s.at(P.ALL['stump'](), AX - 2, 43); s.at(P.ALL['stump'](), AX + 4, 46)
s.at(P.ALL['toadstools_a'](), AX + 5, 44, block=None)
s.at(P.ALL['hunter_post'](), AX - 1, ry[AX] + 2)   # 갈림 표지
s.reserve(AX - 1, ry[AX] + 2, AX - 1, ry[AX] + 2)
s.marks['camp'] = (AX, 45); s.marks['fork_post'] = (AX, ry[AX] + 2)

# ---------------- 곁길 B: 북쪽 버섯 빈터 ----------------
BX = 42
track_v(BX, 10, ry[BX] - 1, 1)
for y in range(7, 12):
    for x in range(BX - 4, BX + 5):
        if (x - BX) ** 2 / 13.0 + (y - 9) ** 2 / 7.0 <= 1: s.track[y][x] = True
s.reserve(BX - 6, 5, BX + 6, 12)
s.at(P.ALL['stump'](), BX, 9)
for (dx, dy, k) in ((-3, 8, 'a'), (-2, 10, 'b'), (2, 10, 'c'), (3, 8, 'a'), (0, 11, 'b'), (-1, 6, 'c'), (2, 6, 'b')):
    s.at(P.ALL['toadstools_' + k](), BX + dx, dy, block=None)
s.at(P.ALL['cairn_s'](), BX + 5, 9)
s.at(P.ALL['log_fallen'](), BX - 6, 10, block=None)
s.marks['glade'] = (BX, 10)

# ---------------- 앵커 3: 옛 성문 ----------------
gate = P.ALL['ruin_gate']()
s.at(gate, GX - 1, ry_e[GX] + 4, block=[(0, 0), (3, 0)])
s.reserve(GX - 3, ry_e[GX], GX + 4, ry_e[GX] + 5)
s.at(P.ALL['stones_b'](), GX - 3, ry_e[GX] + 4, block=None)
s.at(P.ALL['stones_c'](), GX + 4, ry_e[GX] + 4, block=None)
s.at(P.ALL['cairn'](), GX + 5, ry_e[GX] + 3)
s.marks['gate'] = (GX, ry_e[GX] + 3)
s.marks['past_gate'] = (GX + 4, ry_e[GX])

# ---------------- 덮개: 나무 · 숲 ----------------
NZ = value_noise(5303, W, H, 9)
def tall_ok(x, y, w, h):
    for j in range(1, h):
        for i in range(w):
            yy = y - j
            if yy < 0: return False
            if s.track[yy][x + i]: return False
    return True
def mk_fir(name, w, h):
    im = [None]
    def f(s_, x, y):
        if x + w > W: return False
        if im[0] is None: im[0] = P.ALL[name]()
        if not tall_ok(x, y, w, h): return False
        ok = s.put(im[0], x, y, fw=w, margin=0)
        if ok: s.canopies.append((x * 16, (y + 1) * 16 - im[0].height, im[0].width, im[0].height))
        return ok
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
def mk_stone(s_, x, y): return s.put(P.ALL[rng.choice(['stones_a', 'stones_b', 'stones_c'])](), x, y, block=True)
F_m, F_m2, F_l, F_s = mk_fir('fir_m', 2, 3), mk_fir('fir_m2', 2, 3), mk_fir('fir_l', 3, 4), mk_fir('fir_s', 2, 3)
O_a, O_b = mk_oak('oakA', 4, 5), mk_oak('oakB', 3, 4)
B_c, B_d, B_e = mk_bush('bushC', 2), mk_bush('bushD', 3), mk_bush('bushE', 2)
def log_maker(s_, x, y): return s.put(P.ALL['log_fallen'](), x, y, fw=2, block=False)

def zone_makers(x, y):
    """서쪽은 활엽수, 동쪽은 침엽수. 사이는 섞임."""
    t = (x - 20) / 44.0 + (NZ[y][x] - 0.5) * 0.5          # 0 = 활엽, 1 = 침엽
    if t < 0.15: return [O_a, O_a, O_b, O_b, B_c, B_d, B_e, F_s]
    if t < 0.5: return [O_a, O_b, B_c, B_d, F_m, F_m2, F_s, B_e]
    if t < 0.75: return [F_l, F_m, F_m2, F_s, F_l, B_c, O_b]
    return [F_l, F_l, F_m, F_m2, F_s, F_s, B_e]

order = [(x, y) for y in range(H) for x in range(W)]
rng.shuffle(order)
for (x, y) in order:
    if not s.cell_free(x, y): continue
    for _ in range(2):
        if rng.choice(zone_makers(x, y))(s, x, y): break
for (x, y) in order:                                     # 남은 큰 빈틈에 덤불·통나무를 한 번 더
    if not s.cell_free(x, y): continue
    if rng.random() < 0.5: rng.choice([B_c, B_e, B_c, log_maker, mk_stone])(s, x, y)

# 낮은 덮개: 고사리(그늘)·버섯(습한 곳)·헤더(트인 곳)
FERN = [P.ALL['fern_' + k]() for k in 'abc']; TOAD = [P.ALL['toadstools_' + k]() for k in 'abc']
H3 = [P.ALL[k]() for k in ('heath_a', 'heath_b', 'heath_c')]
order2 = [(x, y) for y in range(H) for x in range(W)]; rng.shuffle(order2)
for (x, y) in order2:
    if not s.cell_free(x, y): continue
    op = in_clearing(x, y)
    r = rng.random()
    if op:
        if r < 0.35: s.put(H3[rng.randrange(3)], x, y, block=False, dx=rng.randrange(-4, 5), dy=rng.randrange(-4, 5))
    else:
        if r < 0.55: s.put(FERN[rng.randrange(3)], x, y, block=False, dx=rng.randrange(-3, 4), dy=rng.randrange(-3, 4))
        elif r < 0.63 and NZ[y][x] > 0.5: s.put(TOAD[rng.randrange(3)], x, y, block=False, dx=rng.randrange(-3, 4), dy=rng.randrange(-3, 4))
        elif r < 0.75: s.put(H3[rng.randrange(3)], x, y, block=False, dx=rng.randrange(-4, 5), dy=rng.randrange(-4, 5))

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
    print(im.size, 'ry', ry[::9], 'ford', ford)
    for st in reach: print('reach', st, {k: v for k, v in reach[st].items() if not v} or 'all')
    print('density', dens)
    tk = {}
    for k in ('oakA', 'oakB'): tk[k] = trunk_check(tree_look(k, 0))
    for n in ('fir_m', 'fir_m2', 'fir_l', 'fir_s'): tk[n] = trunk_check(P.ALL[n]())
    print('trunk', tk)
    s.img = im
    P.register(s, ['fir_m', 'fir_m2', 'fir_l', 'fir_s', 'ruin_gate', 'stones_a', 'stones_b', 'stones_c', 'campfire', 'chopping_block', 'hide_rack', 'cairn', 'cairn_s',
                   'heath_a', 'heath_b', 'heath_c', 'wild_a', 'wild_b', 'wild_c', 'log_fallen', 'stump', 'fern_a', 'fern_b', 'fern_c', 'toadstools_a', 'toadstools_b', 'toadstools_c', 'hunter_post'])
    n = s.save(HERE, extra_grid={'reach': {k: all(v.values()) for k, v in reach.items()}, 'density_max_window': [float(dens[0]), list(dens[1])], 'trunk_check': {k: list(v) for k, v in tk.items()}})
    print('parts', n)
