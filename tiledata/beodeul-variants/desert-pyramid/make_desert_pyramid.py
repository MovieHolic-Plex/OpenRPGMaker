# 사막 필드 + 피라미드·고분 (desert-pyramid) — 84x56 야외 던전 입구 맵. 다시 돌리면 같은 그림.  python3 make_desert_pyramid.py
# 동선: 남쪽 입구(마을 쪽 카라반 길) → 오아시스(우물) → 상인 천막·낙타 쉼터 → 피라미드 앞 광장 → 피라미드 입구.
# 곁가지: 광장 서쪽 → 고분 터(흙무덤·마스타바), 광장 동쪽 → 발굴터.
import sys, os, json, math, random
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from dp_bd import *                     # 버들항 땅(풀)·Scene·BFS (city_v6 파이프라인)
import dp_wl as wl
import dp_art as A
import dp_auto as U
import dp_pyr as Y
import dp_props as PP
from dp_meta import META
from scipy import ndimage as ndi

W, H = 84, 56
Wp, Hp = W * 16, H * 16
rng = random.Random(9060)
s = Scene('desert-pyramid', W, H, seed=90)

def grid(v=False): return [[v] * W for _ in range(H)]
def nbits(mask, x, y, join=None):
    def on(xx, yy): return 0 <= xx < W and 0 <= yy < H and (mask[yy][xx] or (join is not None and join[yy][xx]))
    return (1 if on(x, y - 1) else 0) | (2 if on(x + 1, y) else 0) | (4 if on(x, y + 1) else 0) | (8 if on(x - 1, y) else 0)
def ell(g, cx, cy, rx, ry, seed=0, rough=0.15):
    for y in range(max(0, int(cy - ry) - 2), min(H, int(cy + ry) + 3)):
        for x in range(max(0, int(cx - rx) - 2), min(W, int(cx + rx) + 3)):
            a = math.atan2(y - cy, x - cx)
            r = 1 + rough * (math.sin(a * 3 + seed) * 0.6 + math.sin(a * 5 + seed * 2.1) * 0.4)
            if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < r * r: g[y][x] = True

# ---------------------------------------------------------------- 지형 마스크(칸)
CLIFF = grid()          # 고원+절벽 칸(막힘)
TRAIL = grid(); FLAG = grid(); ROCK = grid(); DRIFT = grid(); LAWN = grid(); WATER = grid()

# 북쪽 고원 절벽: 칸마다 절벽 밑(첫 걷는 줄) 높이 cb[x]. 피라미드 뒤는 높고(뒤로 물러남) 양 끝은 앞으로 나온다.
cb = []
for x in range(W):
    v = 4.2 + 1.3 * math.sin(x / 7.3 + 0.6) + 0.8 * math.sin(x / 3.1 + 2.0)
    if 30 <= x <= 59: v = min(v, 3.6)
    if x < 8: v += 1.2
    if x > 76: v += 1.4
    cb.append(int(round(v)))
for i in range(1, W - 1):                       # 한 칸짜리 튐 없애기
    if cb[i - 1] == cb[i + 1] != cb[i]: cb[i] = cb[i - 1]
for x in range(W):
    for y in range(cb[x]): CLIFF[y][x] = True

# 오아시스: 풀밭 고리 + 못 — 화소 단위 모양(칸 계단 없이)을 먼저 만들고 칸 마스크는 그 덮임으로 정한다
def blob_px(cx, cy, rx, ry, seed, rough):
    Yy, Xx = np.mgrid[0:Hp, 0:Wp]
    X = (Xx + 0.5) / 16.0; Yc = (Yy + 0.5) / 16.0
    ang = np.arctan2(Yc - cy, X - cx)
    r = 1 + rough * (np.sin(ang * 3 + seed) * 0.6 + np.sin(ang * 5 + seed * 2.1) * 0.4) + (A.vn_full(Wp, Hp, 20, seed + 9) - 0.5) * 0.12
    return ((X - cx) / rx) ** 2 + ((Yc - cy) / ry) ** 2 < r * r
LAWN_PX = blob_px(25, 41, 11.0, 6.6, 2, 0.14)
WATER_PX = blob_px(24, 41.5, 6.4, 3.3, 5, 0.12)
def px_to_cells(m, th):
    c = m.reshape(H, 16, W, 16).mean(axis=(1, 3))
    return [[bool(c[y, x] >= th) for x in range(W)] for y in range(H)]
LAWN = px_to_cells(LAWN_PX, 0.5); WATER = px_to_cells(WATER_PX, 0.45)
# 남동 바위 언덕(메사): 사암 고원 한 덩이 — 둘레 절벽 앞면, 윗면 암반+모래
MESA_PX = blob_px(77.5, 50.5, 6.2, 3.6, 13, 0.16)
for y, row in enumerate(px_to_cells(MESA_PX, 0.4)):
    for x, v in enumerate(row):
        if v: CLIFF[y][x] = True
# 피라미드 앞 광장(포석): 입구 앞 반 타원
PYX, PYB = 33, 19                                # 피라미드 왼쪽 칸, 맨 아랫줄
for y in range(PYB + 1, PYB + 10):
    for x in range(31, 60):
        if ((x - 44.5) / 12.0) ** 2 + ((y - (PYB + 1)) / 8.0) ** 2 < 1.0: FLAG[y][x] = True
# 드러난 암반 덩이
for (cx, cy, rx, ry, sd) in ((71, 32, 5.5, 3.2, 1), (60, 53, 3.6, 1.8, 2), (79, 21, 3.6, 2.2, 6), (7, 50, 4.5, 2.6, 3), (64, 9, 4.0, 2.4, 4), (11, 28, 3.6, 2.0, 5)):
    ell(ROCK, cx, cy, rx, ry, seed=sd, rough=0.3)
for y in range(H):
    for x in range(W):
        if CLIFF[y][x] or LAWN[y][x]: ROCK[y][x] = False

# ---------------------------------------------------------------- 길(카라반 길, 폭 2)
def path(pts, wid=2):
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = max(abs(x1 - x0), abs(y1 - y0)) * 2 + 1
        for i in range(n + 1):
            t = i / n; x = x0 + (x1 - x0) * t; y = y0 + (y1 - y0) * t
            xi, yi = int(round(x)), int(round(y))
            for dx in range(wid):
                for dy in range(wid):
                    if 0 <= xi + dx < W and 0 <= yi + dy < H: TRAIL[yi + dy][xi + dx] = True
def smooth_runs(a, mn):
    ch = True
    while ch:
        ch = False; i = 0
        while i < len(a):
            j = i
            while j + 1 < len(a) and a[j + 1] == a[i]: j += 1
            if j - i + 1 < mn and 0 < i and j < len(a) - 1:
                for kk in range(i, j + 1): a[kk] = a[i - 1]
                ch = True
            i = j + 1
def interp(keys, t):
    for (t0, v0), (t1, v1) in zip(keys, keys[1:]):
        if t0 <= t <= t1: return v0 + (v1 - v0) * (t - t0) / max(1, t1 - t0)
    return keys[-1][1]
def vroute(keys, wid=2, mn=3):
    """세로 길: keys=[(y, x)...] 위→아래. 칸 계단이 3줄 이상씩 이어지게 다듬는다(버들항 길 다듬기와 같은 방식)."""
    ys = list(range(keys[0][0], keys[-1][0] + 1)); xs = [int(round(interp(keys, y))) for y in ys]
    smooth_runs(xs, mn)
    for i, (y, x) in enumerate(zip(ys, xs)):
        for dx in range(wid): TRAIL[y][x + dx] = True
        if i and xs[i - 1] != x:
            for xx in range(min(xs[i - 1], x), max(xs[i - 1], x) + wid): TRAIL[y][xx] = True
def hroute(keys, wid=2, mn=4):
    """가로 길: keys=[(x, y)...] 왼→오."""
    xs = list(range(keys[0][0], keys[-1][0] + 1)); ys = [int(round(interp(keys, x))) for x in xs]
    smooth_runs(ys, mn)
    for i, (x, y) in enumerate(zip(xs, ys)):
        for dy in range(wid): TRAIL[y + dy][x] = True
        if i and ys[i - 1] != y:
            for yy in range(min(ys[i - 1], y), max(ys[i - 1], y) + wid): TRAIL[yy][x] = True
vroute([(28, 44), (31, 43), (36, 39), (41, 38), (46, 37), (50, 36), (55, 36)])              # 광장 → 오아시스 곁 → 남쪽 입구
hroute([(38, 38), (44, 38), (51, 39)])                                                      # 시장 골목
hroute([(37, 43), (45, 43), (53, 44)])                                                      # 낙타 쉼터
hroute([(53, 44), (55, 47), (56, 50)], mn=2)                                                # 야영 자리
hroute([(11, 16), (14, 17), (18, 19), (25, 22), (32, 24)], mn=3)                                                      # 광장 서쪽 → 고분 터
vroute([(14, 20), (17, 20), (19, 21)])                                  # 흙무덤·마스타바 갈래
hroute([(57, 24), (62, 24), (66, 23)])                                                      # 광장 동쪽 → 발굴터
hroute([(33, 37), (37, 38)], mn=2)                                                          # 길 → 우물
for y in range(H):
    for x in range(W):
        if WATER[y][x] or CLIFF[y][x]: TRAIL[y][x] = False
        if FLAG[y][x]: TRAIL[y][x] = False        # 광장 안은 포석

# 모래 더미(포석 위): 광장 남·동 가장자리에 몰리고(바람이 북서에서), 구석에 덩이
for y in range(H):
    for x in range(W):
        if not FLAG[y][x]: continue
        edge = any(not (0 <= x + dx < W and 0 <= y + dy < H) or not FLAG[y + dy][x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        if edge and wl.hash2(x, y, 3) > 0.15: DRIFT[y][x] = True
        elif (y > PYB + 5 or x > 53 or x < 36) and wl.hash2(x, y, 4) > 0.45: DRIFT[y][x] = True
for (cx, cy, rx, ry) in ((34, 22.5, 2.6, 1.6), (55, 23, 2.8, 1.8), (40, 27, 2.0, 1.2), (51, 27, 2.2, 1.3), (37, 25, 1.4, 1.0)):
    for y in range(int(cy - ry), int(cy + ry) + 1):
        for x in range(int(cx - rx), int(cx + rx) + 1):
            if 0 <= x < W and 0 <= y < H and FLAG[y][x] and ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1.0: DRIFT[y][x] = True

# ---------------------------------------------------------------- 그림 조각(한 번만 만든다)
PIECE = {}
def G(n):
    if n not in PIECE:
        mod = {'Y': Y, 'P': PP}[META[n]['mod']]
        PIECE[n] = getattr(mod, n)()
    return PIECE[n]

# ---------------------------------------------------------------- 놓기 도우미
s.occ_ = set(); COUNT = {}
def blocked_terrain(x, y):
    return not (0 <= x < W and 0 <= y < H) or CLIFF[y][x] or WATER[y][x]
def free(x, y, allow_trail=False):
    if blocked_terrain(x, y) or (x, y) in s.occ_: return False
    if not allow_trail and (TRAIL[y][x] or FLAG[y][x] and not allow_trail): return False
    return True
def foot_cells(img, cx, cy, brows):
    """막을 칸: 아래에서 brows 줄. 맨 아랫줄은 그 칸 아래 반이 칠해진 칸만, 위 줄은 칸 30% 이상 칠해진 칸만."""
    a = np.array(img)[:, :, 3] > 128; h, w = a.shape; wc = (w + 15) // 16; hc = (h + 15) // 16
    out = []
    for j in range(brows):
        for i in range(wc):
            y1 = h - j * 16; y0 = max(0, y1 - 16); x0 = i * 16; x1 = min(w, x0 + 16)
            cell = a[y0:y1, x0:x1]
            if j == 0: ok = cell[cell.shape[0] // 2:].mean() > 0.25 if cell.size else False
            else: ok = cell.mean() > 0.3 if cell.size else False
            if ok: out.append((cx + i, cy - j))
    return out
FLIPPABLE = {'camel_standing', 'camel_lying', 'sand_boulder', 'sand_boulder_s', 'scrub', 'cactus_branch', 'cactus_column', 'rock_spire', 'palm_tall', 'palm_short', 'palm_young', 'jars', 'crates', 'cargo_pile', 'stela', 'column_broken'}
FLIPPED = {}
SPACED = {'sand_boulder', 'sand_boulder_s', 'scrub', 'cactus_branch', 'cactus_column', 'cactus_barrel', 'rock_spire', 'stela', 'jars', 'crates', 'cargo_pile'}
def put(n, cx, cy, allow_trail=False, brows=None, dx=0, dy=0, canopy=0, force=False, occ_rows=None):
    """조각 n 을 바닥 왼쪽 칸 (cx,cy) 에. 막힘 = META brows. canopy = 위 칸이 길·물·다른 물체를 덮지 않는지 볼 줄 수."""
    img = G(n); md = META[n]
    if n in FLIPPABLE and wl.hash2(cx, cy, 5) > 0.5: img = FLIPPED.setdefault(n, img.transpose(Image.FLIP_LEFT_RIGHT))
    br = md.get('brows', 0) if brows is None else brows
    wc = (img.width + 15) // 16; hc = (img.height + 15) // 16
    if cx < 0 or cx + wc > W or cy - hc + 1 < 0 or cy >= H: return False
    cells = foot_cells(img, cx, cy, br) if br else []
    base = cells if cells else [(cx + i, cy) for i in range(wc)]
    if not force and n in SPACED:
        for (px_, py_) in PLACED.get(n, ()):
            if abs(px_ - cx) <= 2 and abs(py_ - cy) <= 2: return False
    if not force:
        for (x, y) in base:
            if not free(x, y, allow_trail): return False
        for j in range(1, canopy + 1):
            for i in range(wc):
                x, y = cx + i, cy - j
                if y < 0 or WATER[y][x] or (x, y) in s.occ_: return False
    s.at(img, cx, cy, block=[(x - cx, y - cy) for (x, y) in cells], dx=dx, dy=dy, shadow=False)
    orow = occ_rows if occ_rows is not None else max(1, br)
    for i in range(wc):
        for j in range(orow): s.occ_.add((cx + i, cy - j))
    COUNT[n] = COUNT.get(n, 0) + 1
    PLACED.setdefault(n, []).append((cx, cy))
    return True
PLACED = {}
def deco(n, cx, cy, dx=None, dy=None, on_trail=False):
    img = G(n); wc = (img.width + 15) // 16
    if dx is None: dx = int(wl.hash2(cx, cy, 31) * 9) - 4 if n not in ('rug',) else 0      # 칸 격자로 줄 서지 않게 화소 단위로 흔든다
    if dy is None: dy = int(wl.hash2(cx, cy, 32) * 7) - 3 if n not in ('rug',) else 0
    for i in range(wc):
        x = cx + i
        if blocked_terrain(x, cy) or (not on_trail and (TRAIL[cy][x] or FLAG[cy][x])) or (x, cy) in s.occ_: return False
    s.at(img, cx, cy, block=None, dx=dx, dy=dy, shadow=False, sorty=(cy + 1) * 16 - 15)
    COUNT[n] = COUNT.get(n, 0) + 1
    return True
DUNES = []      # 바닥 장식 언덕(아래층 덧그림)
DUNE_OCC = set()
DUNE_COV = np.zeros((H, W))
_DUNE_N = [0]
def gen_dune(wc, hc):
    """같은 언덕 그리기(dp_props._dune)로 마루선만 무작위 — 같은 도장이 되풀이되지 않게. 마루선 = 매끈한 활꼴(가운데 높고
    양 끝 낮다, 한쪽으로 치우침) + 작은 물결."""
    _DUNE_N[0] += 1; sd = 800 + _DUNE_N[0]
    Wd, Hd = wc * 16, hc * 16
    base = Hd * (0.55 + rng.random() * 0.1); amp = Hd * (0.18 + rng.random() * 0.14)
    skew = 0.35 + rng.random() * 0.3; ph = rng.random() * 6.28; wa = 0.6 + rng.random() * 1.2
    pts = []
    for x in range(2, Wd - 1, 3):
        t = (x - 2) / (Wd - 4)
        arch = math.sin(math.pi * (t ** (math.log(0.5) / math.log(skew))))
        pts.append((x, base - amp * arch + wa * math.sin(x / 9.0 + ph)))
    return PP._dune(Wd, Hd, pts, sd)
def dune(n, cx, cy, flip=False):
    img = G(n) if isinstance(n, str) else n
    if flip: img = img.transpose(Image.FLIP_LEFT_RIGHT)
    wc = (img.width + 15) // 16; hc = (img.height + 15) // 16
    if cx < 0 or cx + wc > W or cy - hc + 1 < 0 or cy >= H: return False
    for j in range(hc):
        for i in range(wc):
            x, y = cx + i, cy - j
            if CLIFF[y][x] or WATER[y][x] or TRAIL[y][x] or FLAG[y][x] or LAWN[y][x] or ROCK[y][x] or (x, y) in s.occ_ or (x, y) in DUNE_OCC: return False
    DUNES.append((img, cx * 16, (cy + 1) * 16 - img.height))
    for j in range(hc):
        for i in range(1, wc - 1): DUNE_OCC.add((cx + i, cy - j))      # 언덕끼리 겹치지 않게(양 끝 한 칸은 맞닿아도 된다)
    a = np.array(img)[:, :, 3] > 0
    for j in range(hc):
        for i in range(wc):
            y0 = img.height - (j + 1) * 16; blk = a[max(0, y0):y0 + 16, i * 16:i * 16 + 16]
            DUNE_COV[cy - j, cx + i] = max(DUNE_COV[cy - j, cx + i], blk.mean() if blk.size else 0)
    COUNT[n if isinstance(n, str) else 'dune_gen'] = COUNT.get(n if isinstance(n, str) else 'dune_gen', 0) + 1
    return True

# ---------------------------------------------------------------- 앵커 1: 피라미드
PYR = G('pyramid')
pw, ph = PYR.width // 16, (PYR.height + 15) // 16
pcells = []
a = np.array(PYR)[:, :, 3] > 128
for j in range(ph):
    for i in range(pw):
        y1 = PYR.height - j * 16; y0 = max(0, y1 - 16)
        blk = a[y0:y1, i * 16:i * 16 + 16]
        if blk.mean() > 0.3 or (j == 0 and blk[8:].mean() > 0.25): pcells.append((PYX + i, PYB - j))
door = [(PYX + c, PYB) for c in Y.pyramid_door_cols()]
pcells = [c for c in pcells if c not in door]
s.at(PYR, PYX, PYB, block=[(x - PYX, y - PYB) for (x, y) in pcells], shadow=False, dy=2)
for (x, y) in pcells + door: s.occ_.add((x, y))
for y in range(PYB - ph + 1, PYB + 1):
    for x in range(PYX, PYX + pw): s.occ_.add((x, y))
COUNT['pyramid'] = 1
s.marks['pyramid_gate'] = (PYX + 11, PYB + 1)
s.marks['pyramid_door'] = door[0]

# ---------------------------------------------------------------- 앵커 2: 피라미드 앞 광장 — 오벨리스크·수호상·기둥
put('obelisk', 41, 23, allow_trail=True, canopy=0)
put('obelisk_buried', 49, 22, allow_trail=True, canopy=2)
put('beast_statue', 39, 27, allow_trail=True)
put('beast_statue', 48, 26, allow_trail=True)
put('guardian_seated', 34, 24, allow_trail=True, canopy=2)
put('column_broken', 37, 21, allow_trail=True, canopy=1)
put('column_broken', 52, 21, allow_trail=True, canopy=1)
put('column_drums', 53, 24, allow_trail=True)
put('guardian_head', 56, 27, allow_trail=True)
put('sand_block', 42, 21, allow_trail=True); put('sand_block', 55, 21, allow_trail=True)
put('rubble_sand', 57, 20, allow_trail=True)
put('obelisk_fallen', 31, 30)
s.marks['plaza'] = (44, 25)

# ---------------------------------------------------------------- 앵커 3: 고분 터(서쪽) — 흙무덤·마스타바·묘비
put('tumulus', 9, 15, canopy=0, brows=4)
put('mastaba_a', 18, 12, brows=4)
put('mastaba_b', 23, 19, brows=3)
put('mastaba_b', 2, 11, brows=3)
put('obelisk_fallen', 4, 14)
put('stela', 16, 20, canopy=1); put('stela', 7, 19, canopy=1); put('stela', 27, 15, canopy=1); put('stela', 22, 13, canopy=1)
put('guardian_seated', 5, 18, canopy=2)
put('column_broken', 25, 13, canopy=1)
put('sand_block', 15, 13); put('sand_block', 26, 20)
for (x, y) in ((12, 19), (17, 18), (20, 15), (8, 20)): deco('pot_shards', x, y)
deco('skull', 4, 22)
s.marks['tumulus_gate'] = (12, 16); s.marks['mastaba_gate'] = (20, 13)

# ---------------------------------------------------------------- 앵커 4: 발굴터(동쪽)
put('dig_tent', 62, 21, allow_trail=False, brows=2)
put('dig_pit', 67, 21, brows=2)
put('crates', 59, 21)
put('shovel', 66, 19, canopy=1)
put('wheelbarrow', 69, 24)
put('rope_coil', 65, 22)
put('rubble_sand', 69, 18)
for (x, y) in ((61, 26), (66, 26), (70, 21), (64, 18)): deco('pot_shards', x, y)
s.marks['dig_site'] = (64, 24)

# ---------------------------------------------------------------- 앵커 5: 오아시스 — 못·우물·야자 숲
put('well', 33, 36, canopy=2)
s.marks['well'] = (33, 37)
for (n, x, y) in (('palm_tall', 14, 38), ('palm_lean', 18, 37), ('palm_tall', 11, 44), ('palm_short', 15, 46), ('palm_tall', 29, 47),
                  ('palm_lean', 21, 47), ('palm_short', 26, 36), ('palm_tall', 31, 40), ('palm_tall', 22, 36), ('palm_short', 32, 44),
                  ('palm_tall', 8, 41), ('palm_tall', 25, 48), ('palm_short', 11, 37), ('palm_tall', 17, 48), ('palm_lean', 30, 37)):
    put(n, x, y, canopy=0)
PALMS = [mk2 for mk2 in ()]
def mkp(n): return lambda x, y: put(n, x, y, canopy=0)
for (cx, cy) in ((12, 41), (28, 45), (19, 47), (16, 37), (29, 38)):
    for _ in range(40):
        x = cx + rng.randrange(-3, 4); y = cy + rng.randrange(-2, 3)
        if 0 <= x < W - 2 and 0 <= y < H and LAWN[y][x] and rng.choice([mkp('palm_tall'), mkp('palm_short'), mkp('palm_young'), mkp('palm_young')])(x, y): break
for (x, y) in ((19, 40), (29, 42), (17, 43), (30, 39), (22, 45), (26, 39), (9, 46), (34, 41), (14, 42), (33, 38), (27, 46), (20, 37), (12, 39)): put('palm_young', x, y)
# 갈대: 물가 칸(물 곁 땅)
for y in range(H):
    for x in range(W):
        if WATER[y][x] or not LAWN[y][x]: continue
        near = any(0 <= x + dx < W and 0 <= y + dy < H and WATER[y + dy][x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        if near and wl.hash2(x, y, 11) > 0.45: deco('reeds', x, y, dy=-2)

# ---------------------------------------------------------------- 앵커 6: 상인 천막·낙타 쉼터
put('merchant_tent_a', 41, 37)
put('merchant_tent_b', 46, 37)
put('nomad_tent', 52, 38, brows=2)
put('jars', 45, 37); put('jars', 50, 38); put('jars', 40, 41)
put('cargo_pile', 50, 41)
deco('rug', 44, 40)
put('crates', 57, 38)
put('hitch_rail', 45, 46)
put('camel_standing', 41, 47)
put('camel_lying', 48, 46); put('camel_lying', 54, 47)
put('trough', 49, 49)
put('cargo_pile', 55, 44)
put('palm_short', 58, 46, canopy=0); put('palm_tall', 39, 51, canopy=0)
# 카라반 야영 자리(낙타 쉼터 남동)
put('campfire_ring', 55, 52); deco('rug', 52, 52); put('cargo_pile', 58, 51); put('jars', 57, 53)
put('camel_lying', 59, 49); put('palm_young', 52, 49)
put('camel_standing', 61, 43); put('cargo_pile', 59, 44)
s.marks['market'] = (43, 39); s.marks['camel_rest'] = (47, 44); s.marks['caravan_camp'] = (54, 50)

# 문 앞·이동 지점 칸은 비워 둔다(사막 채우기가 막지 않게)
for (mx, my) in list(s.marks.values()):
    for (ddx, ddy) in ((0, 0), (1, 0), (-1, 0), (0, 1)): s.occ_.add((mx + ddx, my + ddy))
# ---------------------------------------------------------------- 사막: 절벽 밑 바위, 암반 둘레, 선인장·덤불·뼈 덩이
def cluster(cx, cy, rx, ry, n, makers, tries=16):
    placed = 0
    for _ in range(n * tries):
        if placed >= n: break
        ang = rng.random() * 6.2832; d = math.sqrt(rng.random())
        x = int(round(cx + math.cos(ang) * rx * d)); y = int(round(cy + math.sin(ang) * ry * d))
        if not (0 <= x < W and 2 <= y < H): continue
        if rng.choice(makers)(x, y): placed += 1
    return placed
mk = lambda n, **k: (lambda x, y: put(n, x, y, **k))
mkd = lambda n: (lambda x, y: deco(n, x, y))
CACT = [mk('cactus_column', canopy=1), mk('cactus_branch', canopy=2), mk('cactus_barrel'), mk('scrub'), mkd('dry_tuft')]
ROCKS = [mk('sand_boulder'), mk('sand_boulder_s'), mkd('pebbles'), mk('scrub'), mkd('dry_tuft'), mkd('pebbles')]
DEEP = [mkd('tumbleweed'), mk('scrub'), mkd('dry_tuft'), mkd('dry_tuft'), mk('sand_boulder_s'), mkd('pebbles')]
# 절벽 밑 바위 띠(절벽 앞 1~2칸, 덩이로)
for x0 in range(0, W, 6):
    cxx = x0 + rng.randrange(0, 4)
    if 29 <= cxx <= 60: continue
    y = cb[min(W - 1, cxx)] + 1
    cluster(cxx, y, 2.5, 0.8, 3, [mk('sand_boulder'), mk('sand_boulder_s'), mkd('pebbles'), mk('scrub'), mkd('dry_tuft')])
# 암반 둘레
put('rock_spire', 70, 31, canopy=2); put('rock_spire', 73, 33, canopy=2)
cluster(71, 32, 7, 4, 6, ROCKS); cluster(77, 55, 6, 1.2, 4, ROCKS); cluster(70, 50, 2, 3, 3, ROCKS); cluster(7, 50, 6, 3.5, 5, ROCKS); cluster(64, 10, 5, 3, 3, ROCKS); cluster(11, 28, 5, 3, 3, ROCKS)
put('guardian_head', 74, 25); put('rubble_sand', 71, 27); put('obelisk_fallen', 66, 30); put('sand_block', 76, 27)
put('ribcage', 74, 40); deco('skull', 72, 42); put('guardian_head', 79, 37)
put('obelisk_buried', 64, 42, canopy=2)
# 길가 옛 사당 터(남동): 무너진 기둥 셋·토막·잔해·묘비 — 카라반이 쉬어 가던 자리
for (n, x, y) in (('column_broken', 63, 46), ('column_broken', 67, 45), ('column_broken', 70, 48), ('column_drums', 64, 49), ('rubble_sand', 66, 49),
                  ('sand_block', 61, 48), ('stela', 71, 44), ('sand_block', 69, 50)):
    put(n, x, y, canopy=1)
for (x, y) in ((62, 50), (68, 47), (65, 44)): deco('pot_shards', x, y)
s.marks['old_shrine'] = (65, 47)
for yy in range(42, 48): s.occ_.add((65, yy)); s.occ_.add((66, yy))      # 사당 터로 드는 빈 길(북쪽에서)
# 선인장 덩이(드문드문, 한 덩이 2~3)
for (cx, cy) in ((60, 32), (80, 27), (66, 50), (4, 34), (14, 52), (56, 52), (76, 20), (5, 9), (80, 10), (28, 30)):
    cluster(cx, cy, 2.5, 1.8, 3, CACT)

# ---------------------------------------------------------------- 모래 언덕 능선(바닥 장식) — 바람은 북서에서, 마루선은 동서로 길게
for (n, x, y) in (('dune_ridge_l', 61, 30), ('dune_ridge_l', 72, 43), ('dune_ridge_l', 60, 49), ('dune_ridge_s', 77, 25), ('dune_ridge_l', 66, 38),
                  ('dune_ridge_l', 1, 34), ('dune_ridge_s', 13, 33), ('dune_ridge_l', 1, 55), ('dune_ridge_s', 44, 54), ('dune_ridge_l', 70, 54),
                  ('dune_ridge_s', 55, 33), ('dune_ridge_s', 24, 54), ('dune_ridge_l', 72, 15), ('dune_ridge_s', 62, 15), ('dune_ridge_s', 1, 26),
                  ('dune_ridge_s', 21, 30), ('dune_ridge_l', 77, 21), ('dune_ridge_s', 50, 54), ('dune_ridge_s', 12, 55)):
    if (x + y) % 4 == 0: dune(n, x, y, flip=(x * 7 + y) % 3 == 0)
    else:
        wc = 6 if n == 'dune_ridge_l' else 4
        dune(gen_dune(wc + rng.randrange(0, 3), 3 if wc == 6 else 2), x, y, flip=(x * 7 + y) % 3 == 0)

# ---------------------------------------------------------------- 빈 바닥 메우기: 큰 빈 창부터 언덕·선인장·바위 덩이
_COVC = {'n': 0, 'cov': np.zeros((H, W))}
def cov_grid():
    """물체 덮임(칸 비율). 새로 놓인 물체만 더해 간다(빠르게)."""
    cov = _COVC['cov']
    for (sy, x, y, im, sh) in s.objs[_COVC['n']:]:
        if im.width * im.height > 20000: continue
        al = np.array(im)[:, :, 3] > 128; h, w = al.shape
        for cy in range(max(0, y // 16), min(H, (y + h - 1) // 16 + 1)):
            for cx in range(max(0, x // 16), min(W, (x + w - 1) // 16 + 1)):
                x0, y0 = max(cx * 16, x), max(cy * 16, y); x1, y1 = min(cx * 16 + 16, x + w), min(cy * 16 + 16, y + h)
                if x1 > x0 and y1 > y0: cov[cy, cx] = max(cov[cy, cx], al[y0 - y:y1 - y, x0 - x:x1 - x].sum() / 256.0)
    _COVC['n'] = len(s.objs)
    return cov
def empty_cells():
    cov = cov_grid(); e = np.zeros((H, W), bool)
    for y in range(H):
        for x in range(W):
            e[y, x] = not (cov[y, x] >= 0.2 or DUNE_COV[y, x] >= 0.15 or TRAIL[y][x] or FLAG[y][x] or WATER[y][x] or CLIFF[y][x] or ROCK[y][x]
                           or (x, y) in s.occ_)
    return e
def worst_window(e, step=1):
    best = (0, 0, 0)
    for y in range(0, H - 15 + 1, step):
        for x in range(0, W - 20 + 1, step):
            r = e[y:y + 15, x:x + 20].mean()
            if r > best[0]: best = (r, x, y)
    return best
TRIED = set(); DONE_WIN = set(); ROCKFLAT = [0]
def rock_flat(bx, by):
    """빈 사막에 드러난 암반 덩이 하나(뿌린 낱 물체 대신 땅 덩이로 채운다) + 그 위 바위 하나."""
    rx = rng.uniform(2.2, 3.6); ry = rng.uniform(1.4, 2.2)
    cells = [(x, y) for y in range(int(by - ry) - 1, int(by + ry) + 2) for x in range(int(bx - rx) - 1, int(bx + rx) + 2)
             if 0 <= x < W and 0 <= y < H and ((x - bx) / rx) ** 2 + ((y - by) / ry) ** 2 < 1.0]
    if len(cells) < 6 or ROCKFLAT[0] >= 4: return False
    for (x, y) in cells:
        for (ddx, ddy) in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)):
            xx, yy = x + ddx, y + ddy
            if not (0 <= xx < W and 0 <= yy < H): continue
            if CLIFF[yy][xx] or WATER[yy][xx] or TRAIL[yy][xx] or FLAG[yy][xx] or LAWN[yy][xx] or (xx, yy) in s.occ_ or (xx, yy) in DUNE_OCC: return False
    for (x, y) in cells:                                  # 다른 암반과 3칸 안이면 안 된다(덩이가 이어져 고리·구멍이 생기지 않게)
        for yy in range(y - 3, y + 4):
            for xx in range(x - 3, x + 4):
                if 0 <= xx < W and 0 <= yy < H and ROCK[yy][xx]: return False
    ROCKFLAT[0] += 1
    for (x, y) in cells: ROCK[y][x] = True
    if rng.random() < 0.6: cluster(bx, by, rx * 0.6, ry * 0.5, 1, [mk('sand_boulder'), mk('sand_boulder_s')])
    return True
FILL_OBJ = [mk('scrub'), mk('sand_boulder_s'), mk('cactus_barrel'), mk('cactus_column', canopy=1), mk('sand_boulder')]
for it in range(1500):
    e = empty_cells()
    best_w = (0, 0, 0)
    for y in range(0, H - 15 + 1):
        for x in range(0, W - 20 + 1):
            if (x, y) in DONE_WIN: continue
            r_ = e[y:y + 15, x:x + 20].mean()
            if r_ > best_w[0]: best_w = (r_, x, y)
    r, wx, wy = best_w
    if r <= 0.38: break
    best = None
    for y in range(wy, wy + 15):
        for x in range(wx, wx + 20):
            if e[y, x] and (x, y) not in TRIED:
                sc = e[max(0, y - 2):y + 3, max(0, x - 3):x + 4].sum() + rng.random() * 0.5
                if best is None or sc > best[0]: best = (sc, x, y)
    if best is None: DONE_WIN.add((wx, wy)); continue
    _, bx, by = best
    TRIED.add((bx, by))
    pk = rng.random()
    ok = 0
    if LAWN[by][bx]:                                  # 오아시스 풀밭 빈자리는 어린 야자·작은 야자로
        ok = cluster(bx, by, 1.5, 1.0, 1, [mk('palm_young'), mk('palm_young'), mk('palm_short', canopy=0)])
        pk = 2.0 if ok else pk
    if pk < 0.8:
        for (ddx, ddy) in ((-2, 1), (-3, 0), (-1, 2), (-4, 1), (-2, -1), (-1, 0)):
            wc = rng.randrange(4, 9); hc = 2 if wc < 6 else 3
            ok = dune(gen_dune(wc, hc), bx + ddx, by + ddy, flip=rng.random() < 0.4)
            if ok: break
    if not ok:                                        # 작은 언덕(3x2)으로 다시
        for (ddx, ddy) in ((-1, 0), (-2, 1), (0, 1), (-1, -1), (-2, 0), (0, 0)):
            ok = dune(gen_dune(3, 2), bx + ddx, by + ddy, flip=rng.random() < 0.4)
            if ok: break
    if not ok: ok = rock_flat(bx, by)
    if ok and rng.random() < 0.35: cluster(bx, by, 1.6, 1.0, 1, [mkd('dry_tuft'), mkd('pebbles'), mkd('tumbleweed')])
E_FINAL = empty_cells(); WORST = worst_window(E_FINAL, 1); print('fill iterations', it)

# ---------------------------------------------------------------- 그리기
def perturb(mask_cells, seed, amp=6):
    m0 = np.kron(np.array(mask_cells, bool), np.ones((16, 16), bool))
    Yy, Xx = np.mgrid[0:Hp, 0:Wp]
    dx = np.rint((wl.tnoise(Wp, Hp, 8, seed) - 0.5) * amp + (wl.tnoise(Wp, Hp, 4, seed + 1) - 0.5) * 3).astype(int)
    dy = np.rint((wl.tnoise(Wp, Hp, 8, seed + 2) - 0.5) * amp + (wl.tnoise(Wp, Hp, 4, seed + 3) - 0.5) * 3).astype(int)
    return m0[np.clip(Yy + dy, 0, Hp - 1), np.clip(Xx + dx, 0, Wp - 1)]

def cell_of(sheet, n): return sheet.crop(((n % 4) * 16, (n // 4) * 16, (n % 4) * 16 + 16, (n // 4) * 16 + 16))

def render():
    img, lab = ground.render(Wp, Hp, [], np.zeros((Hp, Wp), bool), s.seed)          # 버들항 풀(오아시스 풀밭만 드러난다)
    Yy, Xx = np.mgrid[0:Hp, 0:Wp]
    # --- 모래(풀밭 밖 전부)
    nz = A.Noise(Wp, Hp)
    ripc = np.zeros((H, W))
    for y in range(H):
        for x in range(W):
            d_l = 99
            ripc[y, x] = 0.35 + 0.45 * (x > 58) + 0.25 * (y > 50) + 0.2 * (x < 14 and 24 < y < 40)
            if LAWN[y][x] or FLAG[y][x]: ripc[y, x] = 0.0
    ripc = ndi.gaussian_filter(ripc, 1.6)
    rip = np.kron(ripc, np.ones((16, 16))) * (0.6 + 0.6 * A.vn_full(Wp, Hp, 40, 7))
    sand = A.sand_rgb(Xx, Yy, nz, rip, seed=91)
    lawn_px = LAWN_PX
    near = ndi.binary_dilation(lawn_px, iterations=3) & ~lawn_px
    damp = ndi.binary_dilation(lawn_px, iterations=1) & ~lawn_px
    sand = np.where(damp[..., None], A.P('sand')[2], sand)
    tuft = near & (wl.hash2(Xx, Yy, 43) > 0.80)
    LW = np.array([hx(c) for c in ('#4b8232', '#579f35', '#73b83e', '#8fd24a')])
    tcol = LW[(wl.hash2(Xx, Yy, 44) * 4).astype(int).clip(0, 3)]
    sand = np.where(tuft[..., None], tcol, sand)
    alpha = np.where(lawn_px, 0, 255).astype(np.uint8)
    img.alpha_composite(Image.fromarray(np.dstack([sand.astype(np.uint8), alpha]), 'RGBA'))
    # --- 사암 포석 광장(픽셀 단위로 흔들린 경계 + 테돌 줄)
    fm = perturb(FLAG, 51, 9)
    frgb = A.flag_rgb(Xx, Yy)
    inner = ndi.binary_erosion(fm, iterations=1, border_value=1); inner2 = ndi.binary_erosion(fm, iterations=2, border_value=1)
    frgb = np.where((fm & ~inner)[..., None], A.P('sstone')[2], frgb)
    frgb = np.where((inner & ~inner2)[..., None], A.P('sstone')[5], frgb)
    img.alpha_composite(Image.fromarray(np.dstack([frgb.astype(np.uint8), np.where(fm, 255, 0).astype(np.uint8)]), 'RGBA'))
    # 참배 길(입구에서 광장 남쪽 끝까지 가운데 2칸): 큰 판석(28x12) 밝게 + 양옆 연석(밝은 윗모·어두운 앞모)
    cx0, cx1 = 44 * 16 - 2, 46 * 16 + 2; cy0, cy1 = (PYB + 1) * 16, (PYB + 9) * 16
    sub = (slice(cy0, cy1), slice(cx0, cx1))
    Xs, Ys = Xx[sub] - cx0, Yy[sub] - cy0
    row = Ys // 12; xo = (Xs + (row % 2) * 9); lx = xo % 18; ly = Ys % 12
    hb = wl.hash2(xo // 18, row, 81)
    T = 5 + np.rint((hb - 0.6) * 1.4).astype(int)
    T = np.where((lx == 0) | (ly == 11), 3, np.where((ly == 0) | (lx == 1), 6, T))
    T = np.where(wl.hash2(Xs, Ys, 82) > 0.97, 4, T)
    T = np.where((Xs <= 1) | (Xs >= cx1 - cx0 - 2), np.where((Xs == 0) | (Xs == cx1 - cx0 - 1), 2, 6), T)
    crgb_ = A.P('sstone')[np.clip(T, 0, 6)]
    cal = fm[sub] & ((Ys < (cy1 - cy0) - 6) | (wl.hash2(Xs, Ys, 83) > 0.5))
    lay_c = Image.new('RGBA', (Wp, Hp)); lay_c.paste(Image.fromarray(np.dstack([crgb_.astype(np.uint8), np.where(cal, 255, 0).astype(np.uint8)]), 'RGBA'), (cx0, cy0))
    img.alpha_composite(lay_c)
    # --- 오토타일: 암반·길·모래 더미
    SH = {'bedrock': U.bedrock(), 'trail': U.trail(), 'drift': U.drift()}
    s.SHEETS = SH
    lay = Image.new('RGBA', (Wp, Hp))
    # 암반 덩이: 오토타일과 같은 재질·가장자리 규칙을 화소 단위 모양으로(칸 계단·톱니 없이)
    rm = perturb(ROCK, 91, 12)
    rm = ndi.binary_closing(ndi.binary_opening(rm, iterations=2), iterations=2) & ~LAWN_PX
    brT, bsandy = A.bedrock_tone(Xx, Yy, nz, seed=93)
    below = np.zeros_like(rm); below[:-3] = rm[3:]                      # 3화소 아래도 암반인가
    face_s = rm & ~below
    up1 = np.zeros_like(rm); up1[1:] = rm[:-1]
    lf1 = np.zeros_like(rm); lf1[:, 1:] = rm[:, :-1]
    edge = rm & ~ndi.binary_erosion(rm, iterations=1, border_value=1)
    T = brT.copy()
    T = np.where(rm & ~up1, 5, T); T = np.where(rm & ~lf1, np.maximum(T, 5), T)
    below1 = np.zeros_like(rm); below1[:-1] = rm[1:]
    below2 = np.zeros_like(rm); below2[:-2] = rm[2:]
    T = np.where(face_s, np.where(~below1, 1, np.where(~below2, 2, 3)), T)
    T = np.where(edge & ~face_s, 1, T)
    rrgb = np.where((bsandy & ~face_s & ~edge)[..., None], A.P('sand')[4], A.P('bedrock')[np.clip(T, 0, 6)])
    shs = np.zeros_like(rm); shs[1:] = rm[:-1]; shs = shs & ~rm
    rrgb = np.where(shs[..., None], A.P('sand')[2], rrgb)
    ral = np.where(rm | shs, 255, 0).astype(np.uint8)
    lay.alpha_composite(Image.fromarray(np.dstack([rrgb.astype(np.uint8), ral]), 'RGBA'))
    for y in range(H):
        for x in range(W):
            if TRAIL[y][x]: lay.alpha_composite(cell_of(SH['trail'], nbits(TRAIL, x, y, FLAG)), (x * 16, y * 16))
            if DRIFT[y][x]: lay.alpha_composite(cell_of(SH['drift'], nbits(DRIFT, x, y)), (x * 16, y * 16))
    img.alpha_composite(lay)
    # --- 언덕 능선(바닥 장식)
    for (im, x, y) in DUNES: img.alpha_composite(im, (x, y))
    # --- 오아시스 못(화소 모양 못: 젖은 모래 띠 → 물거품 1px → 얕은 물 → 깊은 물, 잔물결 획)
    wm = WATER_PX
    dist = ndi.distance_transform_edt(wm)
    wt = np.where(dist < 2, 4, np.where(dist < 5, 3, np.where(dist < 10, 2, 1)))
    wt = np.where((wt == 2) & (wl.hash2(Xx, Yy, 62) > 0.6) & (dist < 7), 3, wt)
    rip_w = (np.mod(Yy + np.rint(np.sin(Xx / 6.0) * 1.2), 6) == 0) & (A.vn_full(Wp, Hp, 7, 63) > 0.62) & (dist > 2)
    wt = np.where(rip_w, np.minimum(wt + 2, 5), wt)
    wt = np.where((dist >= 1) & (dist < 1.5), 6, wt)
    wrgb = A.P('oasis')[np.clip(wt, 0, 6)]
    img.alpha_composite(Image.fromarray(np.dstack([wrgb.astype(np.uint8), np.where(wm, 255, 0).astype(np.uint8)]), 'RGBA'))
    shore = ndi.binary_dilation(wm, iterations=2) & ~wm
    sh_img = np.zeros((Hp, Wp, 4), np.uint8); sh_img[shore] = (52, 40, 22, 90)
    img.alpha_composite(Image.fromarray(sh_img, 'RGBA'))
    # --- 북쪽 고원 절벽(화소 단위 윗선 흔들림): 고원 윗면 = 암반+모래, 절벽 앞면 = 지층 3줄(48px) 중 아래 2줄 보임
    cm = np.zeros((Hp, Wp), bool); face = np.zeros((Hp, Wp), bool); fy = np.zeros((Hp, Wp), int)
    jit = np.rint((A.vn_full(Wp, 1, 9, 71)[0] - 0.5) * 5).astype(int)
    cbp = np.repeat(np.array(cb), 16)
    cbp = np.rint(ndi.uniform_filter1d(cbp.astype(float), 9)).astype(int)
    SEG = [[(0, cbp[X] * 16 + jit[X])] for X in range(Wp)]          # 기둥마다 (고원 윗끝, 절벽 밑) — 북쪽 띠 + 바위 언덕
    for X in range(Wp):
        ys = np.nonzero(MESA_PX[:, X])[0]
        if len(ys): SEG[X].append((int(ys.min()), int(ys.max()) + 1))
    for X in range(Wp):
        for (y0, yb_) in SEG[X]:
            fh = min(32, max(8, (yb_ - y0) - 6)) if y0 > 0 else 32
            yt = yb_ - fh
            cm[max(0, y0):max(0, yt), X] = True
            face[max(0, yt):max(0, yb_), X] = True
            fy[max(0, yt):max(0, yb_), X] = (np.arange(max(0, yt), max(0, yb_)) - yt) * 32 // fh
    br, sandy = A.bedrock_tone(Xx, Yy, nz)
    # 고원 윗면: 모래가 덮었다(바닥과 같은 모래 결) — 절벽 끝 3~5px 만 암반 판이 드러난다(얼룩 금지)
    top = sand.copy()
    near_edge = ndi.binary_dilation(face, iterations=5) & ~face
    rimrock = near_edge & (A.vn_full(Wp, Hp, 10, 75) > 0.35)
    top = np.where(rimrock[..., None], A.P('bedrock')[np.clip(br, 0, 6)], top)
    ct = A.cliff_rgb(Xx, Yy, fy)
    ct = np.where(fy < 2, np.where(fy == 0, 5, 4), ct)
    ct = np.where(fy == 2, 1, ct); ct = np.where((fy >= 3) & (fy < 5), np.maximum(ct - 1, 1), ct)
    ct = np.where(fy >= 29, np.maximum(ct - 1, 1), ct)
    crgb = A.P('bedrock')[np.clip(ct, 0, 6)]
    allc = np.where(face[..., None], crgb, top)
    # 바위 언덕 고원 윗면 둘레(뒤·옆) 1px 윤곽 + 안쪽 1px 밝은 모
    whole = cm | face
    rim = whole & ~ndi.binary_erosion(whole, iterations=1, border_value=1)
    rim2 = ndi.binary_erosion(whole, iterations=1, border_value=1) & ~ndi.binary_erosion(whole, iterations=2, border_value=1)
    allc = np.where((rim & cm)[..., None], A.P('bedrock')[1], allc)
    allc = np.where((rim2 & cm)[..., None], A.P('bedrock')[5], allc)
    calpha = np.where(whole, 255, 0).astype(np.uint8)
    img.alpha_composite(Image.fromarray(np.dstack([allc.astype(np.uint8), calpha]), 'RGBA'))
    foot = np.zeros((Hp, Wp, 4), np.uint8)
    talus = np.rint(3 + 7 * A.vn_full(Wp, 1, 22, 73)[0] ** 2).astype(int)
    SAP = A.P('sand')
    for X in range(Wp):
        for (y0, yb_) in SEG[X]:
            for k2 in range(4):                                      # 절벽 밑 그늘
                if 0 <= yb_ + k2 < Hp and not whole[yb_ + k2, X]: foot[yb_ + k2, X] = (60, 30, 14, (110, 80, 50, 25)[k2])
            th = talus[X] if y0 == 0 else min(talus[X], 6)           # 절벽 밑에 쌓인 모래 비탈(앞면 아래를 덮는다)
            for k2 in range(th):
                y = yb_ - k2
                if 0 <= y < Hp:
                    v = k2 / max(1, th)
                    t = 5 if v > 0.75 else (4 if v > 0.3 else 3)
                    if wl.hash2(X, y, 74) > 0.9: t -= 1
                    foot[y, X] = tuple(SAP[t]) + (255,)
    img.alpha_composite(Image.fromarray(foot, 'RGBA'))
    # --- 물체
    for sy, x, y, im, sh in sorted(s.objs, key=lambda o: (o[0], o[1])):
        if x >= 0 and y >= 0: img.alpha_composite(im, (x, y))
        else: img.alpha_composite(im.crop((max(0, -x), max(0, -y), im.width, im.height)), (max(0, x), max(0, y)))
    s.img = img
    return img

# ---------------------------------------------------------------- 통행
def walk_grid():
    return [[(not s.block[y][x]) and (not WATER[y][x]) and (not CLIFF[y][x]) for x in range(W)] for y in range(H)]
s.walk_grid = walk_grid
s.marks['south_entry'] = (36, H - 1)

def export(im, reach, dens):
    Pq = wl.Parts(HERE)
    for n, md in META.items():
        if n.startswith('autotile_'): img = s.SHEETS[n.split('_', 1)[1]]; pad = False; fname = n.replace('_', '-')
        elif md['mod'] == 'A': img = getattr(A, n)(); pad = False; fname = n.replace('_', '-')
        else: img = G(n); pad = True; fname = n
        Pq.add(fname, img, md['kind'], md['ko'], md['desc'], md['rules'], md.get('brows'), md.get('layer'), md.get('role'), pad=pad)
    cnt = Pq.finish('사막 필드 + 피라미드·고분 (desert-pyramid)')
    im.convert('RGB').save(HERE + '/render-1x.png')
    im.convert('RGB').resize((im.width * 2, im.height * 2), Image.NEAREST).save(HERE + '/render-2x.png')
    wg = s.walk_grid()
    json.dump({'w': W, 'h': H, 'tile': 16, 'rows': [''.join('.' if wg[y][x] else '#' for x in range(W)) for y in range(H)],
               'legend': {'.': 'walkable', '#': 'blocked'}, 'marks': {k: list(v) for k, v in s.marks.items()},
               'reach': reach, 'empty_window': [dens[0], [dens[1], dens[2]]], 'empty_cells': [''.join('e' if E_FINAL[y, x] else '.' for x in range(W)) for y in range(H)], 'count': COUNT}, open(HERE + '/grid.json', 'w'), ensure_ascii=False)
    return cnt

if __name__ == '__main__':
    im = render()
    r = s.bfs(s.marks['south_entry'])
    reach = {k: (tuple(v) in r) for k, v in s.marks.items()}
    print(im.size, 'unreached', [k for k, v in reach.items() if not v], 'worst empty', [round(float(WORST[0]), 3), WORST[1], WORST[2]])
    print(COUNT)
    if '--noexport' not in sys.argv:
        print('parts', export(im, reach, (float(WORST[0]), WORST[1], WORST[2])))
    else:
        im.convert('RGB').save('/tmp/dp_render.png')
