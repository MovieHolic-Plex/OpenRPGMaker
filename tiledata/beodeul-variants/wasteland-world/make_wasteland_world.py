# 세계 붕괴 후 황폐 필드 (wasteland-world) — 80x56 걸어 다니는 JRPG 필드. 다시 돌리면 같은 그림이 나온다.   python3 make_wasteland_world.py
# 동선: 남쪽 입구 → 갈라진 붉은 대지 → (서) 생존자 야영지 / (동) 마른 호수 바닥 부두·난파선 → 부서진 돌다리로 깊은 골을 건넘
#       → 북쪽 폐허: 반쯤 묻혀 기운 옛 망루 · (서) 기울어 가라앉은 옛 회당 · (동북) 죽은 숲을 지나 북쪽 출구.
import sys, os, json, math, random
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import numpy as np
from PIL import Image
from ww_base import *
from ww_scene import Scene
import ww_pieces as V, ww_struct as S, ww_auto as A

W, H = 80, 56
rng = random.Random(8101)
s = Scene(W, H, seed=81)


def smooth_runs(a, mn, lock=()):
    ch = True
    while ch:
        ch = False; i = 0
        while i < len(a):
            j = i
            while j + 1 < len(a) and a[j + 1] == a[i]: j += 1
            if j - i + 1 < mn and 0 < i and j < len(a) - 1 and not any(k in lock for k in range(i, j + 1)):
                for k in range(i, j + 1): a[k] = a[i - 1]
                ch = True
            i = j + 1


# ================================================================ 앵커 1: 깊은 골 (서→동 전 폭) + 부서진 돌다리
BX = 38                                                                  # 다리 왼쪽 칸(3칸 폭)
TOP = [21 + int(round(1.4 * math.sin((x + 3) / 7.0) + 0.8 * math.sin(x / 13.0 + 1.0))) for x in range(W)]
for x in range(BX - 2, BX + 5): TOP[x] = 22
smooth_runs(TOP, 4, lock=range(BX - 2, BX + 5))
for x in range(1, W):
    if abs(TOP[x] - TOP[x - 1]) > 1: TOP[x] = TOP[x - 1] + (1 if TOP[x] > TOP[x - 1] else -1)
DEP = [5 + (1 if math.sin(x / 5.3 + 0.4) > 0.2 else 0) for x in range(W)]
for x in range(BX - 2, BX + 5): DEP[x] = 6
smooth_runs(DEP, 4, lock=range(BX - 2, BX + 5))
BOT = [TOP[x] + DEP[x] - 1 for x in range(W)]
for x in range(W):
    for y in range(TOP[x], BOT[x] + 1): s.lev[y][x] = 0
NB = TOP[BX + 1] - 1; SB = BOT[BX + 1] + 1                                # 다리 북쪽 끝 땅 줄 21, 남쪽 끝 땅 줄 28
BR = S.broken_bridge(rows=SB - NB + 1)
s.at(BR, BX, SB, block=[(0, NB - SB), (2, NB - SB)], shadow=False, sorty=(NB + 1) * 16, name='broken_bridge')
for x in range(BX, BX + 3):
    for y in range(NB + 1, SB): s.walk_ok.add((x, y))
s.reserve(BX - 1, NB - 1, BX + 3, SB)
s.join = {(x, y) for x in range(BX, BX + 3) for y in range(NB, SB + 1)}
s.marks['bridge_n'] = (BX + 1, NB - 1); s.marks['bridge_s'] = (BX + 1, SB + 1)

# ================================================================ 길(밟아 다진 흙길)
def add2(x, y, horiz=False):
    s.path.add((x, y)); s.path.add((x, y + 1) if horiz else (x + 1, y))

def vpath(y0, y1, xfun):
    prev = None
    for y in range(y0, y1 + 1):
        x = xfun(y); add2(x, y)
        if prev is not None and prev != x:
            for xx in range(min(prev, x), max(prev, x) + 2): s.path.add((xx, y))
        prev = x

def hpath(x0, x1, yfun):
    prev = None
    for x in range(min(x0, x1), max(x0, x1) + 1):
        y = yfun(x); add2(x, y, True)
        if prev is not None and prev != y:
            for yy in range(min(prev, y), max(prev, y) + 2): s.path.add((x, yy))
        prev = y

def sstep(t): t = min(1, max(0, t)); return t * t * (3 - 2 * t)
# 큰길: 남쪽 입구(40,55) → 다리 남쪽 끝(39,29)
vpath(SB + 1, H - 1, lambda y: int(round(39 + 3.0 * math.sin((y - SB) / (H - SB) * math.pi) * (1 if y < 50 else (55 - y) / 5) + 0.6 * math.sin(y / 2.3))) if SB + 3 < y < H - 2 else 39)
# 북쪽: 다리 북쪽 끝 → 망루 앞
vpath(13, NB - 1, lambda y: 38 + (1 if 15 <= y <= 17 else 0))
# 서쪽 곁길: 망루 길(17줄) → 옛 회당 앞(9,15)
hpath(10, 37, lambda x: int(round(16 + 1.2 * math.sin(x / 4.0) * (1 - sstep((10 - x + 6) / 6.0)) if x > 13 else 15)))
for y in (14, 15): s.path.add((9, y)); s.path.add((10, y))
# 동북 곁길: 망루 길 → 죽은 숲 → 북쪽 출구(66,0)
prev = None
for y in range(0, 17):
    t = (16 - y) / 16.0
    x = int(round(40 + 26 * sstep(t) + 1.4 * math.sin(y / 2.2) * (1 - abs(2 * t - 1))))
    add2(x, y)
    if prev is not None and prev != x:
        for xx in range(min(prev, x), max(prev, x) + 2): s.path.add((xx, y))
    prev = x
# 서쪽 곁길: 큰길 → 생존자 야영지 입구
MAINX = {y: min(x for (x, yy) in s.path if yy == y and x > 30) for y in range(SB + 1, H)}
hpath(23, MAINX[42], lambda x: int(round(41 + 1.0 * math.sin(x / 3.0) * sstep((x - 23) / 4.0))))
# 동쪽 곁길: 큰길 → 옛 부두(60,34)
hpath(MAINX[33] + 1, 61, lambda x: int(round(33 + 1.2 * math.sin(x / 3.7) * (1 - sstep((x - 54) / 4.0)))))
s.path -= s.join
s.path = {c for c in s.path if 0 <= c[0] < W and 0 <= c[1] < H and s.lev[c[1]][c[0]] == 1}
s.marks['south_entrance'] = (40, H - 1); s.marks['north_exit'] = min(((x, 0) for (x, y) in s.path if y == 0))

# ================================================================ 좁은 땅 균열(오토타일) — 골에서 뻗어 나간 가지
def crack_walk(x, y, dx, dy, n, seed):
    r = random.Random(seed); out = []
    for i in range(n):
        if not (0 <= x < W and 0 <= y < H) or (x, y) in s.path or any((x + i2, y + j2) in s.path for i2 in (-1, 0, 1) for j2 in (-1, 0, 1)): break
        if s.lev[y][x] == 0: x += dx; y += dy; continue
        out.append((x, y))
        if i % 3 == 2 and r.random() < 0.7:                                # 옆으로 한 칸(4방향 이웃 유지)
            sx = r.choice((-1, 1)) if dy else 0; sy = r.choice((-1, 1)) if dx else 0
            x += sx; y += sy
            if 0 <= x < W and 0 <= y < H and s.lev[y][x] == 1 and (x, y) not in s.path: out.append((x, y))
            else: break
        x += dx; y += dy
    return out
for (x, dy, n, sd) in ((12, 1, 9, 1), (70, 1, 10, 2), (60, -1, 9, 3), (24, -1, 5, 4), (4, -1, 7, 5), (52, 1, 6, 6)):
    y0 = BOT[x] + 1 if dy > 0 else TOP[x] - 1
    s.crack |= set(crack_walk(x, y0, 0, dy, n, sd))
for (x, y, dx, n, sd) in ((46, 9, 1, 5, 7), (28, 40, 1, 4, 8), (66, 27 + 3, -1, 4, 9)):
    s.crack |= set(crack_walk(x, y, dx, 0, n, sd))

# ================================================================ 놓기 도우미
NAMES_V = ['red_boulder', 'ash_boulder', 'rock_spire', 'rock_ridge', 'rocks_small', 'dust_mound', 'dead_tree_a', 'dead_tree_big', 'dead_tree_lean',
           'dead_snag', 'dead_log', 'dead_stump', 'dead_bramble', 'bleached_grass', 'drygrass_tall', 'fish_skeleton', 'big_fish_bones', 'shipwreck',
           'rowboat_overturned', 'pier_posts', 'pier_broken', 'anchor_rusted', 'dead_reeds', 'shells_scatter', 'tent_lean', 'tarp_shelter', 'campfire',
           'cook_tripod', 'crates_stack', 'rusty_drum', 'rain_barrel', 'bedroll', 'signal_pole', 'scrap_fence_h', 'scrap_fence_v', 'scrap_fence_post',
           'scrap_heap', 'scrap_small', 'broken_wheel']
NAMES_S = ['sunken_tower', 'tilted_hall', 'ruin_wall_long', 'ruin_wall_short', 'rubble_heap', 'rubble_small', 'fallen_block', 'ruin_chips',
           'broken_pillar', 'fallen_column', 'ruin_steps']
P_ = {n: getattr(V, n)() for n in NAMES_V}
P_.update({n: getattr(S, n)() for n in NAMES_S})
P_ = {k: pad16(v) for k, v in P_.items()}
NOFLIP = {'sunken_tower', 'tilted_hall', 'shipwreck', 'tent_lean', 'signal_pole', 'scrap_fence_v', 'pier_broken', 'campfire', 'broken_bridge'}
FLIP = {k: v.transpose(Image.FLIP_LEFT_RIGHT) for k, v in P_.items()}
def img_of(n, flip=None):
    if n in NOFLIP: return P_[n]
    f = (rng.random() < 0.5) if flip is None else flip
    return FLIP[n] if f else P_[n]

def alpha_cols(im, row_from_bottom=0, thr=0.22):
    a = np.array(im)[:, :, 3] > 0; h = im.height
    y1 = h - row_from_bottom * 16; y0 = y1 - 16
    return [i for i in range(im.width // 16) if a[y0:y1, i * 16:(i + 1) * 16].mean() > thr]

def put(n, x, y, rows=1, cols=None, flip=None, cover=True, allow_path=False, walk=False, reserve_all=True):
    """그림 밑 왼쪽 칸 (x,y). rows: 막는 아랫줄 수(칠해진 칸만). 그림이 덮는 칸이 다 비어야 놓는다."""
    im = img_of(n, flip); wc = im.width // 16; hc = im.height // 16
    if x < 0 or x + wc > W or y - hc + 1 < 0 or y >= H: return False
    for i in range(wc):
        for j in range(hc if cover else 1):
            if not s.cell_ok(x + i, y - j, allow_path=allow_path and j > 0): return False
    bl = []
    if not walk:
        for r in range(rows):
            cs = alpha_cols(im, r) if cols is None else cols
            bl += [(i, -r) for i in cs]
    s.at(im, x, y, block=bl, name=n)
    if reserve_all: s.reserve(x, y - hc + 1, x + wc - 1, y)
    else: s.reserve(x, y, x + wc - 1, y)
    return True

def deco(n, x, y, dx=0, dy=0):
    im = img_of(n); wc = im.width // 16
    if not all(s.cell_ok(x + i, y) for i in range(wc)): return False
    s.decal(im, x, y, dx, dy, name=n)
    for i in range(wc): s.occ.add((x + i, y))
    return True

def tree(n, x, y):
    """키 큰 부드러운 물체: 줄기 칸 하나만 막고 위 칸은 걷기+가림(위 칸은 길 위로 넘어가도 된다)."""
    im = img_of(n); wc = im.width // 16; hc = im.height // 16
    if x < 0 or x + wc > W or y - hc + 1 < 0: return False
    for i in range(wc):
        if not s.cell_ok(x + i, y): return False
        for j in range(1, hc):
            c = (x + i, y - j)
            if not (0 <= c[1] < H) or s.lev[c[1]][c[0]] == 0 or c in s.occ or s.block[c[1], c[0]]: return False
    a = np.array(im)[:, :, 3] > 0
    tc = max(range(wc), key=lambda i: a[-16:, i * 16:(i + 1) * 16].sum())
    s.at(im, x, y, block=[(tc, 0)], name=n)
    s.reserve(x, y, x + wc - 1, y)
    for i in range(wc):
        for j in range(1, hc): s.occ.add((x + i, y - j))
    return True

def cluster(cx, cy, rx, ry, n, makers, tries=16):
    placed = 0
    for _ in range(n * tries):
        if placed >= n: break
        a = rng.random() * 6.2832; d = math.sqrt(rng.random())
        x = int(round(cx + math.cos(a) * rx * d)); y = int(round(cy + math.sin(a) * ry * d))
        if not (0 <= x < W and 1 <= y < H): continue
        if rng.choice(makers)(x, y): placed += 1
    return placed

TREES = [lambda x, y: tree('dead_tree_a', x, y), lambda x, y: tree('dead_tree_big', x, y), lambda x, y: tree('dead_tree_lean', x, y),
         lambda x, y: tree('dead_tree_a', x, y), lambda x, y: tree('dead_snag', x, y)]
m_log = lambda x, y: put('dead_log', x, y); m_stump = lambda x, y: put('dead_stump', x, y)
m_bram = lambda x, y: put('dead_bramble', x, y)
m_boul = lambda x, y: put('red_boulder', x, y); m_ashb = lambda x, y: put('ash_boulder', x, y)
m_spire = lambda x, y: tree('rock_spire', x, y); m_ridge = lambda x, y: put('rock_ridge', x, y)
d_grass = lambda x, y: deco('bleached_grass', x, y, rng.randrange(-3, 4), rng.randrange(-1, 2))
d_tall = lambda x, y: deco('drygrass_tall', x, y, rng.randrange(-3, 4), rng.randrange(-1, 2))
d_rocks = lambda x, y: deco('rocks_small', x, y, rng.randrange(-3, 4), rng.randrange(-2, 3))
d_mound = lambda x, y: deco('dust_mound', x, y)
d_chips = lambda x, y: deco('ruin_chips', x, y, rng.randrange(-3, 4), rng.randrange(-2, 3))

# ================================================================ 앵커 2: 반쯤 묻혀 기운 옛 망루 (골 북쪽 가운데) + 담 토막
TW = P_['sunken_tower']; TX, TY = 36, 12
blk = []
for r in range(4): blk += [(i, -r) for i in alpha_cols(TW, r, 0.3)]
s.at(TW, TX, TY, block=blk, name='sunken_tower'); s.reserve(TX, TY - 6, TX + 4, TY)
s.marks['tower_front'] = (38, 13)
put('ruin_wall_long', 30, 12, flip=False, rows=1)                        # 서쪽 담: 망루 몸통에 붙고 서쪽 끝은 잔해로
put('rubble_heap', 27, 12, rows=1, flip=False)
put('ruin_wall_short', 41, 12, flip=True, rows=1)                        # 동쪽 담: 망루에 붙은 쪽 온전
put('rubble_small', 45, 12, rows=1)
for (x, y) in ((33, 14), (42, 14), (29, 14), (35, 15)): d_chips(x, y)
put('fallen_block', 44, 15); put('fallen_block', 31, 15)
put('broken_pillar', 34, 15, flip=False); put('broken_pillar', 42, 17, flip=True)
# 망루 둘레 재
for y in range(10, 17):
    for x in range(27, 47):
        if ((x - 38) / 9.5) ** 2 + ((y - 13) / 3.6) ** 2 < 1 + (hash2(x, y, 3) - 0.5) * 0.5: s.dust.add((x, y))

# ================================================================ 앵커 3: 기울어 가라앉은 옛 회당 (북서)
HL = P_['tilted_hall']; HX, HY = 6, 13
blk = []
for r in range(3): blk += [(i, -r) for i in alpha_cols(HL, r, 0.3)]
s.at(HL, HX, HY, block=blk, name='tilted_hall'); s.reserve(HX, HY - HL.height // 16 + 1, HX + 5, HY)
put('ruin_steps', 8, 14, walk=True, cover=False, allow_path=True) or s.at(P_['ruin_steps'], 8, 14, block=None, name='ruin_steps')
s.marks['hall_front'] = (9, 15)
tree('broken_pillar', 4, 15); tree('broken_pillar', 13, 15)
put('fallen_column', 14, 13, rows=1)
put('rubble_small', 2, 13); put('fallen_block', 15, 18)
for y in range(11, 19):
    for x in range(1, 18):
        if ((x - 9) / 8.5) ** 2 + ((y - 14) / 3.4) ** 2 < 1 + (hash2(x, y, 4) - 0.5) * 0.6: s.dust.add((x, y))

# ================================================================ 앵커 4: 마른 호수 바닥 (남동) — 옛 부두 · 난파선 · 물고기 뼈
LCX, LCY, LRX, LRY = 63, 45.5, 13.5, 8.0
for y in range(H):
    for x in range(W):
        d = ((x + 0.5 - LCX) / LRX) ** 2 + ((y + 0.5 - LCY) / LRY) ** 2
        if d < 1 + (hash2(x, y, 9) - 0.5) * 0.25 and (x, y) not in s.path: s.mud.add((x, y))
put('pier_broken', 60, 37, walk=True, flip=False)
for x in (60, 61):
    for y in range(34, 38): s.walk_ok.add((x, y))
s.block[37, 60] = s.block[37, 61] = False
s.marks['pier_end'] = (60, 36)
put('shipwreck', 55, 48, rows=2); s.marks['shipwreck'] = (57, 49)
put('big_fish_bones', 66, 51, rows=1); s.marks['fish_bones'] = (68, 52)
put('rowboat_overturned', 51, 43, rows=1)
put('anchor_rusted', 63, 47, rows=1)
put('pier_posts', 57, 39); put('pier_posts', 65, 38, flip=True)
for (x, y) in ((53, 47), (70, 45), (61, 51), (67, 42), (58, 43)): deco('fish_skeleton', x, y, rng.randrange(-3, 4))
for (x, y) in ((56, 41), (64, 44), (72, 49), (52, 49), (69, 47)): deco('shells_scatter', x, y)
REEDS = []
for y in range(H):
    for x in range(W):
        if (x, y) in s.mud: continue
        d = ((x + 0.5 - LCX) / LRX) ** 2 + ((y + 0.5 - LCY) / LRY) ** 2
        if 1.0 < d < 1.5 and hash2(x, y, 12) < 0.32: REEDS.append((x, y))
for (x, y) in REEDS: deco('dead_reeds', x, y, rng.randrange(-3, 4), rng.randrange(-1, 2))

# ================================================================ 앵커 5: 생존자 야영지 (남서) — 고철 울타리 · 천막 · 모닥불
for x in (8, 11, 14, 17, 20): put('scrap_fence_h', x, 34, cover=False, flip=(x // 3) % 2 == 0)
put('scrap_fence_post', 23, 34, cover=False)
for y in (37, 40, 43): put('scrap_fence_v', 7, y, rows=3, cols=[0], cover=False)
for x in (8, 11): put('scrap_fence_h', x, 46, cover=False, flip=x == 11)
put('scrap_fence_post', 14, 46, cover=False)
put('scrap_fence_post', 23, 46, cover=False)
put('tent_lean', 9, 38, rows=2)
put('tent_lean', 18, 38, rows=2) if False else None
put('tarp_shelter', 13, 38, rows=1)
put('tarp_shelter', 19, 38, rows=1, flip=True)
put('campfire', 15, 41); s.marks['camp_fire'] = (15, 42)
put('cook_tripod', 17, 41)
deco('bedroll', 12, 41); deco('bedroll', 17, 43)
put('crates_stack', 9, 45, rows=2)
put('rusty_drum', 21, 41); put('rusty_drum', 22, 42); put('rain_barrel', 12, 44)
tree('signal_pole', 24, 38)
put('scrap_heap', 18, 46, rows=1)
s.marks['camp_gate'] = (23, 41)
put('scrap_heap', 2, 41, rows=1); put('scrap_small', 3, 49); put('broken_wheel', 26, 46); put('scrap_small', 25, 37)
for y in range(35, 47):
    for x in range(8, 24):
        if ((x - 15.5) / 7.0) ** 2 + ((y - 41.5) / 4.2) ** 2 < 1.0 + (hash2(x, y, 6) - 0.5) * 0.5: s.dust.add((x, y))

# ================================================================ 죽은 숲 (동북 · 남서 · 남쪽 가운데)
cluster(64, 9, 11, 7, 22, TREES + [m_log, m_bram], tries=24)
cluster(73, 17, 5, 2.5, 6, TREES + [m_stump])
cluster(51, 5, 5, 3.5, 6, TREES + [m_bram])
cluster(31, 50, 5, 3.5, 7, TREES + [m_log, m_stump])
cluster(4, 52, 4, 3, 5, TREES + [m_bram])
cluster(47, 51, 3, 3, 3, TREES)
cluster(24, 5, 5, 3, 6, TREES + [m_spire])
# 바위 · 첨탑 · 재 쌓인 바위
cluster(3, 4, 3, 3, 4, [m_spire, m_boul, m_ridge])
cluster(18, 4, 4, 2.5, 4, [m_ashb, m_boul, m_spire])
cluster(76, 31, 3, 4, 4, [m_ridge, m_spire, m_boul])
cluster(30, 31, 4, 2, 4, [m_ashb, m_boul, m_spire])
cluster(76, 51, 3, 3, 3, [m_boul, m_spire, m_ashb])
cluster(46, 30, 3, 1.5, 2, [m_ashb, m_spire])
cluster(2, 30, 2, 2, 3, [m_spire, m_ridge, m_boul])
cluster(56, 17, 3, 2, 3, [m_ashb, m_boul, m_spire])
cluster(34, 39, 3, 3, 3, [m_spire, m_ashb])

# ================================================================ 빈 바닥 메우기(큰 빈 창부터, 자연 덩이)
s.filled = set()
def patch(cx, cy, r):
    n = 0
    for y in range(int(cy - r) - 1, int(cy + r) + 2):
        for x in range(int(cx - r * 1.3) - 1, int(cx + r * 1.3) + 2):
            if not (0 <= x < W and 0 <= y < H): continue
            if ((x - cx) / (r * 1.3)) ** 2 + ((y - cy) / r) ** 2 > 0.9 + (rng.random() - 0.5) * 0.5: continue
            if not s.cell_ok(x, y): continue
            s.filled.add((x, y)); s.hard.add((x, y)); n += 1
            k = rng.random()
            if k < 0.12: d_grass(x, y)
            elif k < 0.20: d_tall(x, y)
            elif k < 0.27: d_rocks(x, y)
            elif k < 0.30: d_mound(x, y)
    return n
for it in range(200):
    e = s.empty(); r, wx, wy = s.worst(e)
    if r <= 0.38: print('fill', it, round(float(r), 3)); break
    best = None
    for y in range(wy + 2, wy + 13):
        for x in range(wx + 2, wx + 18):
            if e[y, x]:
                sc = e[max(0, y - 2):y + 3, max(0, x - 2):x + 3].sum()
                if best is None or sc > best[0]: best = (sc, x, y)
    if best is None: break
    _, bx, by = best
    pk = rng.random()
    if pk < 0.72: n = patch(bx, by, rng.uniform(1.8, 3.0))
    elif pk < 0.88: n = cluster(bx, by, 2.2, 1.6, 3, TREES + [m_bram, m_log])
    else: n = cluster(bx, by, 1.8, 1.4, 2, [m_boul, m_ashb, m_spire, m_ridge])
    if n == 0: s.filled.add((bx, by))

# ================================================================ 렌더 · 통행 · 저장
SHEETS = {'crack': A.crack_sheet(), 'dust': A.dust_sheet(), 'trail': A.trail_sheet()}

def run():
    im = s.render(SHEETS)
    seen = s.bfs(s.marks['south_entrance'])
    reach = {k: (tuple(v) in seen) for k, v in s.marks.items()}
    e = s.empty(); w = s.worst(e)
    return im, reach, (float(w[0]), (w[1], w[2]), float(e.mean())), seen

if __name__ == '__main__':
    im, reach, dens, seen = run()
    g = s.walk_grid()
    print(im.size, 'reach', {k: v for k, v in reach.items() if not v} or 'all', 'density', dens)
    un = [(x, y) for y in range(H) for x in range(W) if g[y, x] and (x, y) not in seen]
    print('walkable', int(g.sum()), 'reached', len(seen), 'unreached', len(un), un[:30])
    print(dict(s.count))
    if '--draft' in sys.argv:
        im.convert('RGB').save(HERE + '/_qa/draft.png')
    else:
        import ww_export
        print('parts', ww_export.export(s, im, reach, dens, seen, SHEETS))
