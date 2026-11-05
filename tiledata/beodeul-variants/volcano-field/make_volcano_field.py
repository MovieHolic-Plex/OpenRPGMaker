# 화산 지대 필드 (volcano-field) — 72x52 JRPG 필드. 다시 돌리면 같은 그림이 나온다.   python3 make_volcano_field.py
# 동선: 남쪽 입구 → 재 평원(그을린 숲 · 짐승 뼈 · 용암 웅덩이 · 분기공 벌판) → 현무암 다리로 용암 강 건넘 → 절벽 돌계단 → 신전 앞뜰 → 화산 신전 입구.
#       곁길: 분기공 벌판 → 현무암 징검돌 → 북쪽 둑 → 화산 동굴 입구(절벽 앞면).
import sys, os, json, math, random
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import numpy as np
from PIL import Image
from vf_base import *
from vf_scene import Scene
import vf_pieces as V, vf_struct as S, vf_mountain as M, vf_auto as A

W, H = 72, 52
rng = random.Random(7302)
s = Scene(W, H, seed=73)

# ================================================================ 높이: 북쪽 고원(1) — 앞면 3줄
EDGE = [21] * 5 + [19] * 4 + [18] * 6 + [20] * 7 + [17] * 6 + [19] * 16 + [18] * 6 + [17] * 6 + [17] * 9 + [19] * 7          # x 별 고원 마지막 줄
assert len(EDGE) == W
for x in range(W):
    for y in range(EDGE[x] + 1): s.lev[y][x] = 1
STAIR = (33, 20, 4)                                                        # 신전 축 돌계단(앞면 20..22)
s.stairs.append(STAIR)
F0 = s.faces()

# ================================================================ 용암 강 (서→동, 폭 3, 다리 자리 4)
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
YT = [25 + int(round(1.2 * math.sin((x + 4) / 6.5) + 0.6 * math.sin(x / 13.0 + 1.0))) for x in range(W)]
for x in range(31, 39): YT[x] = 24
for x in range(50, 63): YT[x] = 23
smooth_runs(YT, 4)
for _ in range(3):
    for x in range(W): YT[x] = max(YT[x], max(EDGE[max(5, x - 1):x + 2]) + 5) if x > 4 else EDGE[x] + 4   # 절벽 밑 둑 한 줄은 남긴다(서쪽 끝은 절벽이 바로 용암에 잠긴다)
    for x in range(1, W):
        if YT[x] - YT[x - 1] > 1 and not (31 <= x <= 38 or 50 <= x <= 62): YT[x] = YT[x - 1] + 1
    for x in range(W - 2, -1, -1):
        if YT[x] - YT[x + 1] > 1 and not (31 <= x <= 38 or 50 <= x <= 62): YT[x] = YT[x + 1] + 1
RB = {}
for x in range(W):
    yb = YT[x] + (3 if 33 <= x <= 37 else 2)
    if x <= 3: yb += 1
    RB[x] = yb
    for y in range(YT[x], yb + 1): s.lava.add((x, y))
# 용암 폭포 샘(고원 가장자리) + 발치(서쪽 절벽 x5..6 → 강)
for (x, y) in ((5, 18), (6, 18), (5, 19), (6, 19), (4, 17), (5, 17)): s.lava.add((x, y))
for y in range(23, YT[5]): s.lava.add((5, y)); s.lava.add((6, y))
# 북쪽 둑이 1~2줄뿐인 곳은 통로 — 아무것도 놓지 않는다(서쪽 폭포 전망 자리까지 길이 끊기지 않게)
BANK = {x: [y for y in range(EDGE[x] + 4, YT[x]) if (x, y) not in s.lava] for x in range(W)}
for x in range(W):
    bank = BANK[x]
    if min(len(BANK[xx]) for xx in range(max(0, x - 1), min(W, x + 2))) <= 2 or 15 <= x <= 33:
        for y in bank: s.occ.add((x, y))
s.marks['lavafall_view'] = (9, 23)

# ================================================================ 길(재 오솔길) · 다리 · 징검돌
def line_cells(pts, wid=2):
    out = set()
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if x0 == x1:
            for y in range(min(y0, y1), max(y0, y1) + 1):
                for i in range(wid): out.add((x0 + i, y))
        else:
            for x in range(min(x0, x1), max(x0, x1) + 1):
                for i in range(wid): out.add((x, y0 + i))
    return out
def sstep(t): t = min(1, max(0, t)); return t * t * (3 - 2 * t)
# 큰길: 남쪽 입구(35,51) → 서쪽으로 휘었다가 → 다리 남쪽 끝(35,29). 폭 2, 굽이는 한 칸씩
for y in range(29, H):
    f = (y - 29) / (H - 1 - 29)
    xc = 35 - 4.2 * math.sin(f * math.pi) + 0.8 * math.sin(y / 2.6) * math.sin(f * math.pi)
    xc = int(round(xc)) if 31 < y < 50 else 35
    s.path.add((xc, y)); s.path.add((xc + 1, y))
MAINX = {y: min(x for (x, yy) in s.path if yy == y) for y in range(29, H)}
for y in range(30, H):                                                     # 줄 사이 끊김 잇기
    a_, b_ = MAINX[y - 1], MAINX[y]
    for x in range(min(a_, b_), max(a_, b_) + 2): s.path.add((x, y))
# 곁길: 큰길(38줄) → 동쪽으로 오르며 분기공 벌판 북쪽 → 징검돌 남쪽 끝(57,26)
prev = None
for x in range(MAINX[38] + 2, 57):
    t = (x - MAINX[38]) / (57 - MAINX[38])
    yc = int(round(38 - 7.5 * sstep(t) + 0.7 * math.sin(x / 2.4) * (1 - abs(2 * t - 1))))
    s.path.add((x, yc)); s.path.add((x, yc + 1))
    if prev is not None and prev != yc:
        for y in range(min(prev, yc), max(prev, yc) + 2): s.path.add((x, y))
    prev = yc
for y in range(26, prev + 2): s.path.add((56, y)); s.path.add((57, y))
BRIDGE = [(x, y) for x in (34, 35, 36) for y in range(23, 29)]
STONES = [(56, 23), (56, 24), (57, 24), (57, 25)]
s.join = set(BRIDGE) | {(57, 26), (56, 22)}
s.path -= set(BRIDGE)
for c in BRIDGE + STONES: s.walk_ok.add(c)
s.path -= s.lava
# 신전 앞뜰 판석(고원 19줄 + 계단 옆)
for x in range(29, 42): s.flag.add((x, 19))
for x in (29, 30, 31, 32, 38, 39, 40, 41): s.flag.add((x, 18))
s.flag -= s.stair_cells()

# ================================================================ 앵커 1: 분화구 산 + 연기 (고원 가운데)
MT = M.crater_mountain(); SM = M.smoke_column()
MX, MY = 27, 14
s.at(MT, MX, MY, block=None, shadow=False, name='crater_mountain')
a = np.array(MT)[:, :, 3] > 0; oy = (MY + 1) * 16 - MT.height
for cy in range(MT.height // 16):
    for cx in range(MT.width // 16):
        if a[cy * 16:(cy + 1) * 16, cx * 16:(cx + 1) * 16].mean() > 0.30:
            s.block[oy // 16 + cy, MX + cx] = True; s.occ.add((MX + cx, oy // 16 + cy))
s.top.append((MX * 16 + MT.width // 2 - 26, oy + 72 - SM.height, SM))
s.marks['mountain'] = (MX + 9, MY + 1)

# ================================================================ 앵커 2: 화산 신전 입구 + 앞뜰 (산 밑동)
GATE = S.temple_gate()
GX, GY = 32, 18
s.at(GATE, GX, GY, block=[(i, j) for i in range(7) for j in (-4, -3, -2, -1) if not (i == 3 and j == -1)], dx=8, shadow=False, name='temple_gate')
s.reserve(GX, GY - 4, GX + 6, GY)
s.walk_ok.add((35, 17))
s.marks['temple_door'] = (35, 17)
BR = S.temple_brazier()
for x in (32, 38):
    s.at(BR, x, 19, block='bottom', shadow=False, name='temple_brazier'); s.reserve(x, 18, x, 19)
GU = S.fire_guardian()
s.at(GU, 29, 18, block=[(0, 0), (1, 0)], name='fire_guardian'); s.reserve(29, 16, 30, 18)
s.at(GU.transpose(Image.FLIP_LEFT_RIGHT), 40, 18, block=[(0, 0), (1, 0)], name='fire_guardian'); s.reserve(40, 16, 41, 18)
s.marks['forecourt'] = (35, 19)

# ================================================================ 앵커 3: 용암 강 · 현무암 다리 · 징검돌 · 폭포
s.at(V.basalt_bridge(), 34, 28, block=None, shadow=False, sorty=23 * 16, name='basalt_bridge')
s.reserve(34, 23, 36, 28)
ST1 = V.basalt_step()
for (x, y) in STONES: s.at(ST1, x, y, block=None, shadow=False, sorty=y * 16, name='basalt_step')
s.marks['bridge_n'] = (35, 23); s.marks['bridge_s'] = (35, 29); s.marks['stones_n'] = (56, 22); s.marks['stones_s'] = (57, 26)
s.at(V.lava_fall(), 5, 22, block=None, shadow=False, sorty=20 * 16, name='lava_fall')

# ================================================================ 앵커 4: 화산 동굴 입구 (동쪽 절벽 앞면)
s.at(S.cave_mouth(), 61, 20, block=None, shadow=False, sorty=18 * 16, name='cave_mouth')
s.walk_ok.add((62, 20)); s.marks['cave_door'] = (62, 20)
s.reserve(61, 18, 63, 21)

# ================================================================ 놓기 도우미
P_ = {n: getattr(V, n)() for n in ['basalt_columns', 'basalt_columns_low', 'basalt_boulder', 'lava_bomb', 'basalt_rocks', 'pumice_scatter',
                                    'obsidian_spire', 'obsidian_cluster', 'charred_tree_a', 'charred_tree_b', 'charred_snag', 'charred_log',
                                    'charred_stump', 'burnt_grass', 'sulfur_vent', 'sulfur_vent_big', 'steam_wisp', 'sulfur_crystals',
                                    'fumarole_crack', 'ember_scatter', 'cooled_lava', 'ash_mound', 'beast_ribs', 'beast_skull', 'pilgrim_cairn', 'lava_pool']}
FLIP = {k: v.transpose(Image.FLIP_LEFT_RIGHT) for k, v in P_.items()}
def img_of(n): return FLIP[n] if rng.random() < 0.5 and n not in ('lava_pool',) else P_[n]

def put(n, x, y, block=None, hrows=None, margin=0, cover=True, allow_path=False):
    """그림 밑 왼쪽 칸 (x,y). block: 막는 상대 칸 목록(기본 밑줄 전체). 그림이 덮는 칸이 다 비어야 놓는다."""
    im = img_of(n); wc = im.width // 16; hc = hrows or im.height // 16
    if x < 0 or x + wc > W or y - hc + 1 < 0 or y >= H: return False
    lv = s.lev[y][x]
    for i in range(wc):
        for j in range(hc if cover else 1):
            if not s.cell_ok(x + i, y - j, lv, path_margin=(margin if j == 0 else 0), allow_path=allow_path and j > 0): return False
    bl = [(i, 0) for i in range(wc)] if block is None else block
    s.at(im, x, y, block=bl, name=n)
    s.reserve(x, y - hc + 1, x + wc - 1, y)
    return True

def deco(n, x, y, dx=0, dy=0):
    im = img_of(n); wc = im.width // 16
    lv = s.lev[y][x] if 0 <= y < H and 0 <= x < W else None
    if lv is None or not all(s.cell_ok(x + i, y, lv) for i in range(wc)): return False
    s.decal(im, x, y, dx, dy, name=n)
    for i in range(wc): s.occ.add((x + i, y))
    return True

def _tree(n, x, y):
    im = P_[n]; wc = im.width // 16; hc = im.height // 16
    if x < 0 or x + wc > W or y - hc + 1 < 0: return False
    lv = s.lev[y][x]
    for i in range(wc):
        if not s.cell_ok(x + i, y, lv, path_margin=0): return False
        for j in range(1, hc):
            if not s.cell_ok(x + i, y - j, lv, allow_path=True) and (x + i, y - j) not in s.path: return False
    trunk = [(wc // 2, 0)]
    s.at(img_of(n), x, y, block=trunk, name=n)
    s.reserve(x, y, x + wc - 1, y)
    for i in range(wc):
        for j in range(1, hc): s.occ.add((x + i, y - j))
    return True

def m_tree_a(x, y): return _tree('charred_tree_a', x, y)
def m_tree_b(x, y): return _tree('charred_tree_b', x, y)
def m_snag(x, y): return _tree('charred_snag', x, y)
def m_log(x, y): return put('charred_log', x, y)
def m_stump(x, y): return put('charred_stump', x, y)
def m_cols(x, y): return put('basalt_columns', x, y, block=[(0, 0), (1, 0)])
def m_cols_low(x, y): return put('basalt_columns_low', x, y, block=[(0, 0), (1, 0)])
def m_boulder(x, y): return put('basalt_boulder', x, y, block=[(0, 0), (1, 0)])
def m_bomb(x, y): return put('lava_bomb', x, y)
def m_spire(x, y): return put('obsidian_spire', x, y, block=[(0, 0)])
def m_obsc(x, y): return put('obsidian_cluster', x, y, block=[(0, 0), (1, 0)])
def m_vent(x, y): return put('sulfur_vent', x, y)
def m_vent_big(x, y):
    ok = put('sulfur_vent_big', x, y, block=[(0, 0), (1, 0)])
    if ok: s.scorch_pts.append((x + 1, y))
    return ok
def m_cairn(x, y): return put('pilgrim_cairn', x, y, block=[(0, 0)])
def m_mound(x, y): return deco('ash_mound', x, y)
def d_rocks(x, y): return deco('basalt_rocks', x, y, rng.randrange(-3, 4), rng.randrange(-2, 3))
def d_pumice(x, y): return deco('pumice_scatter', x, y, rng.randrange(-3, 4), rng.randrange(-2, 3))
def d_grass(x, y): return deco('burnt_grass', x, y, rng.randrange(-3, 4), rng.randrange(-1, 2))
def d_ember(x, y): return deco('ember_scatter', x, y, rng.randrange(-3, 4), rng.randrange(-3, 4))
def d_crack(x, y): return deco('fumarole_crack', x, y)
def d_cryst(x, y): return deco('sulfur_crystals', x, y, rng.randrange(-3, 4), rng.randrange(-2, 3))
def d_cooled(x, y): return deco('cooled_lava', x, y)
s.scorch_pts = []

def cluster(cx, cy, rx, ry, n, makers, tries=16):
    placed = 0
    for _ in range(n * tries):
        if placed >= n: break
        a = rng.random() * 6.2832; d = math.sqrt(rng.random())
        x = int(round(cx + math.cos(a) * rx * d)); y = int(round(cy + math.sin(a) * ry * d))
        if not (0 <= x < W and 1 <= y < H): continue
        if rng.choice(makers)(x, y): placed += 1
    return placed

# ================================================================ 옛 용암 흐름판(식은 용암 벌판, 걷기) — 강·산 밑동에서 흘러나온 혀
def flow_tongue(pts, rads):
    for (x0, y0, r0), (x1, y1, r1) in zip([(a, b, r) for (a, b), r in zip(pts, rads)][:-1], [(a, b, r) for (a, b), r in zip(pts, rads)][1:]):
        for t in np.linspace(0, 1, 30):
            cx = x0 + (x1 - x0) * t; cy = y0 + (y1 - y0) * t; r = r0 + (r1 - r0) * t
            for y in range(int(cy - r) - 1, int(cy + r) + 2):
                for x in range(int(cx - r) - 1, int(cx + r) + 2):
                    if 0 <= x < W and 0 <= y < H and (x + 0.5 - cx) ** 2 + ((y + 0.5 - cy) * 1.2) ** 2 < r * r and (x, y) not in s.lava and not F0[y][x] and (x, y) not in s.flag:
                        if s.lev[y][x] == s.lev[int(min(H - 1, max(0, y0)))][int(x0)]: s.flow.add((x, y))
flow_tongue([(19, 29), (17, 32), (19, 35)], [3.2, 2.6, 1.5])
flow_tongue([(45, 29), (43, 32), (46, 35)], [3.0, 2.4, 1.4])
flow_tongue([(26, 11), (20, 9), (15, 12), (12, 16)], [2.6, 3.2, 2.6, 1.4])
flow_tongue([(45, 11), (51, 13), (55, 16)], [2.4, 2.8, 1.4])
flow_tongue([(66, 29), (67, 33)], [2.2, 1.2])

# ================================================================ 앵커 5: 짐승 뼈 (재 평원 서쪽, 길 곁)
put('beast_ribs', 21, 39, block=[(0, 0), (1, 0), (2, 0), (3, 0)]); s.marks['beast_bones'] = (23, 40)
put('beast_skull', 25, 40, block=[(0, 0), (1, 0)])
for (x, y) in ((20, 40), (26, 37), (19, 37)): d_rocks(x, y)
# ================================================================ 앵커 6: 용암 웅덩이 + 흑요석 (길 동쪽)
put('lava_pool', 40, 44, block=[(i, j) for i in range(3) for j in (-1, 0)]); s.marks['lava_pool'] = (41, 45); s.reserve(40, 45, 42, 45)
s.scorch_pts += [(41, 43), (40, 44), (42, 44)]
for (x, y) in ((44, 44), (38, 42), (43, 41)): m_spire(x, y)
m_obsc(44, 47); m_bomb(39, 46); m_bomb(45, 42)
for (x, y) in ((39, 45), (43, 45), (40, 41), (42, 46)): d_ember(x, y)
# ================================================================ 앵커 7: 분기공 벌판 (남동, 징검돌 곁길)
VENTS_BIG = ((51, 35), (61, 34), (55, 41), (64, 39), (59, 44))
for (vx, vy) in VENTS_BIG + ((57, 37), (60, 40)):                      # 분기공 둘레만 붉은 자갈(덩이마다 크기 다르게)
    r = 2.2 + hash2(vx, vy, 4) * 1.6
    for y in range(int(vy - r) - 1, int(vy + r) + 2):
        for x in range(int(vx - r) - 1, int(vx + r) + 3):
            if ((x - vx - 0.5) / (r * 1.2)) ** 2 + ((y - vy + 0.3) / r) ** 2 < 1.0: s.cinder.add((x, y))
for (x, y) in VENTS_BIG: m_vent_big(x, y)
for i, (x, y) in enumerate(((53, 39), (58, 37), (62, 42), (50, 42), (66, 36), (61, 31))):
    if m_vent(x, y) and i % 2 == 0: s.top.append((x * 16, y * 16 - 30, P_['steam_wisp']))
s.marks['vent_field'] = (57, 39)
cluster(57, 38, 9, 6.5, 14, [d_cryst, d_crack, d_cryst, d_pumice])
# 순례 돌무더기(입구·길가)
for (x, y) in ((33, 50), (38, 49), (28, 43), (37, 33), (55, 30)): m_cairn(x, y)
s.marks['south_entrance'] = (35, 51)

# ================================================================ 그을린 숲 (남서) · 고원 서쪽 숲
TREES = [m_tree_a, m_tree_b, m_tree_a, m_tree_b, m_snag]
cluster(9, 38, 7, 6, 20, TREES, tries=24)
cluster(13, 46, 6, 3.5, 7, TREES)
cluster(25, 47, 4, 2.5, 4, TREES + [m_boulder])
cluster(9, 9, 7, 5, 12, TREES + [m_cols_low])
cluster(20, 15, 4, 2.5, 4, TREES + [m_boulder])

# 주상절리 · 바위 덩이(가장자리 틀과 고원 동쪽)
cluster(56, 6, 3, 2, 6, [m_cols, m_cols_low, m_cols], tries=30)
cluster(64, 10, 3, 2, 5, [m_cols, m_cols_low, m_boulder], tries=30)
cluster(60, 3, 3, 1.5, 3, [m_boulder, m_spire, m_cols_low])
cluster(67, 13, 3, 2.5, 3, [m_cols, m_boulder, m_cols_low])
cluster(49, 13, 3, 2.5, 3, [m_obsc, m_spire])
cluster(3, 11, 3, 3, 4, [m_cols, m_cols_low, m_boulder])
cluster(22, 4, 4, 2.5, 5, [m_boulder, m_cols_low, m_snag, m_tree_a])
cluster(68, 44, 3, 6, 7, [m_cols, m_cols_low, m_boulder])
cluster(2, 48, 2, 3, 4, [m_cols, m_boulder])
cluster(50, 49, 6, 2, 6, [m_boulder, m_cols_low, m_bomb])
# 절벽 밑(북쪽 둑) · 고원 앞 가장자리: 흑요석·돌
for x0 in range(8, 70, 5):
    cluster(x0 + 2, EDGE[min(W - 1, x0 + 2)] + 4, 2, 0.6, 1, [m_spire, m_bomb, d_rocks, m_obsc])
# 폭포 전망 자리(북서 둑): 흑요석 노두
for (x, y) in ((11, 24), (14, 23)): m_spire(x, y)
m_obsc(12, 22); m_bomb(8, 25)
# 식은 용암 혀(강 남쪽)
for (x, y) in ((14, 29), (24, 29), (44, 29), (64, 29), (27, 31), (8, 30)): d_cooled(x, y)

# ================================================================ 빈 바닥 메우기(큰 빈 창부터, 자연 덩이)
s.filled = set()
def ashfield(cx, cy, r):
    n = 0
    for y in range(int(cy - r) - 1, int(cy + r) + 2):
        for x in range(int(cx - r * 1.3) - 1, int(cx + r * 1.3) + 2):
            if not (0 <= x < W and 0 <= y < H): continue
            if ((x - cx) / (r * 1.3)) ** 2 + ((y - cy) / r) ** 2 > 0.9 + (rng.random() - 0.5) * 0.5: continue
            if not s.cell_ok(x, y, s.lev[y][x], path_margin=0): continue
            s.filled.add((x, y)); n += 1
            k = rng.random()
            if hash2(x // 2, y // 2, 77) < 0.50: s.fine.add((x, y))
            if k < 0.10: d_grass(x, y)
            elif k < 0.20: d_rocks(x, y)
            elif k < 0.27: d_pumice(x, y)
    return n
for it in range(160):
    e = s.empty(); r, wx, wy = s.worst(e)
    if r <= 0.39: print('fill', it, round(float(r), 3)); break
    best = None
    for y in range(wy + 2, wy + 13):
        for x in range(wx + 2, wx + 18):
            if e[y, x]:
                sc = e[max(0, y - 2):y + 3, max(0, x - 2):x + 3].sum()
                if best is None or sc > best[0]: best = (sc, x, y)
    if best is None: break
    _, bx, by = best
    pk = rng.random()
    if pk < 0.80: n = ashfield(bx, by, rng.uniform(1.8, 3.0))
    else: n = cluster(bx, by, 1.8, 1.4, 3, [m_cols, m_cols_low, m_boulder, m_boulder, m_bomb])
    if n == 0: s.filled.add((bx, by))

# ================================================================ 렌더 · 통행 · 저장
import vf_fix_heat as _FX                                                 # 감사 보정 2026-10-08: 열기 번짐 둥근 덩이
SHEETS = {'lava': A.lava_sheet(), 'heat': _FX.heat_sheet(), 'ashpath': A.path_sheet()}
s.heat_sheet = SHEETS['heat']
s.heat_cells = set()
for (vx, vy) in VENTS_BIG:                                               # 큰 분기공 둘레 열기 덩이(덩이마다 크기 다르게)
    r = 1.3 + hash2(vx, vy, 9) * 0.9
    for y in range(int(vy - r) - 1, int(vy + r) + 2):
        for x in range(int(vx - r) - 1, int(vx + r) + 3):
            if ((x - vx - 0.5) / (r * 1.3)) ** 2 + ((y - vy + 0.2) / r) ** 2 < 1.0 and (x, y) in s.cinder: s.heat_cells.add((x, y))
FLAG = A.ground_basaltflag()

def run():
    im = s.render(SHEETS['ashpath'], FLAG)
    seen = s.bfs(s.marks['south_entrance'])
    reach = {k: (tuple(v) in seen) for k, v in s.marks.items() if k != 'mountain'}
    e = s.empty(); w = s.worst(e)
    return im, reach, (float(w[0]), (w[1], w[2]), float(e.mean())), seen

if __name__ == '__main__':
    im, reach, dens, seen = run()
    g = s.walk_grid()
    print(im.size, 'reach', {k: v for k, v in reach.items() if not v} or 'all', 'density', dens)
    print('walkable', int(g.sum()), 'reached', len(seen))
    un = [(x, y) for y in range(H) for x in range(W) if g[y, x] and (x, y) not in seen]
    print('unreached', un)
    print(dict(s.count))
    if '--draft' in sys.argv:
        im.convert('RGB').save(HERE + '/_qa/draft.png')
    else:
        import vf_export
        print('parts', vf_export.export(s, im, reach, dens, seen, SHEETS, FLAG))
