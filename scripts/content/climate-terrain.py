# Climate ground (기후 지형) for the volcano, desert and snow climate sheets — deterministic pixel generator in the sheets'
# own palettes (1px outline, lit from the upper left), alpha 0/255 only. build-climate-chipsets.py bakes every block into
# the same numbers on all three sheets (FIRST = 3030, rows 101..; each sheet draws only its own climate's block, the
# other blocks stay transparent and unused), prepare-climate-tilesets.mjs names them.
#
# Volcano (the ground itself is the decoration, user 2026-09-25 「균열 + 용암」):
#   lava crack   16 cells, one per N/E/S/W mask (1 cell wide, branching network; glowing core, scorched rim) + 2 straights
#   lava plate   47-cell blob autotile (cooled basalt plates, glowing seams, raised lit rim) + 2 body variants
#   lava pool    47-cell blob autotile (molten lava, crusted rim) + 2 body variants
#   fumarole     vent (lower) + smoke (upper, 2 frames used as variants), sulfur stains ×2
#   basalt       column clusters 2×2 ×2, 3×2, 3×3; obsidian ×2 and ash heaps ×2 (by the cracks only)
# Desert (「사구」): ripple sand ×4, cracked dry earth (47 blob + 2), dunes 3×2 ×2 · 4×3 ×2 · 6×3, sandstone mesas 3×3 ·
#   4×3 · 5×4, cacti (saguaro 1×2, barrel, flowering), half-buried column 1×2, bones 2×1.
# Snow: snow-capped copies of the castle wall, tower and gatehouse top tiles (white + 1px blue-grey outline).
#
# Blob autotiles: 47 canonical 8-neighbour masks (a diagonal counts only with both of its sides), mask bits
# N=1 E=2 S=4 W=8 NE=16 SE=32 SW=64 NW=128 (lib/tall-grass.mjs). Each cell is drawn from its 3×3 neighbourhood:
# rounded convex and concave corners (open + close), a boundary wobble and every texture periodic in 16 px, so any two
# neighbours meet seamlessly.
# Preview: python3 scripts/content/climate-terrain.py /tmp/climate-terrain.png   (all three blocks on their grounds)
import math, random, sys
import numpy as np
from PIL import Image

FIRST = 3030; COLS = 30; ROW0 = FIRST // COLS  # 101
DIRS = dict(N=1, E=2, S=4, W=8, NE=16, SE=32, SW=64, NW=128)
OFF = dict(N=(0, -1), E=(1, 0), S=(0, 1), W=(-1, 0), NE=(1, -1), SE=(1, 1), SW=(-1, 1), NW=(-1, -1))

def hexc(s): return np.array([int(s[i:i + 2], 16) for i in (0, 2, 4)], np.float32)

def canon(m):
    n, e, s, w = m & 1, m & 2, m & 4, m & 8
    out = m & 15
    if n and e: out |= m & 16
    if s and e: out |= m & 32
    if s and w: out |= m & 64
    if n and w: out |= m & 128
    return out

CANON = sorted({canon(m) for m in range(256)})
assert len(CANON) == 47

# ── layout: (id, climate, col, row offset from ROW0, w, h, kind) ─────────────────────────────────────────────────
def _layout():
    L = []
    # volcano rows 0..7
    for m in range(16): L.append((f"crack-{m}", "volcano", m, 0, 1, 1, "crack"))
    L += [("crack-ns-2", "volcano", 16, 0, 1, 1, "crack"), ("crack-ew-2", "volcano", 17, 0, 1, 1, "crack"),
          ("sulfur-1", "volcano", 18, 0, 1, 1, "sulfur"), ("sulfur-2", "volcano", 19, 0, 1, 1, "sulfur"),
          ("obsidian-1", "volcano", 20, 0, 1, 1, "obsidian"), ("obsidian-2", "volcano", 21, 0, 1, 1, "obsidian"),
          ("ash-heap-1", "volcano", 22, 0, 1, 1, "ash"), ("ash-heap-2", "volcano", 23, 0, 1, 1, "ash"),
          ("fumarole-1", "volcano", 24, 0, 1, 2, "fumarole"), ("fumarole-2", "volcano", 25, 0, 1, 2, "fumarole")]
    for k, c in enumerate(CANON + ["b1", "b2"]):
        L.append((f"plate-{c}", "volcano", k % 30, 2 + k // 30, 1, 1, "plate"))
    for k, c in enumerate(CANON + ["b1", "b2"]):
        L.append((f"pool-{c}", "volcano", k % 30, 4 + k // 30, 1, 1, "pool"))
    L += [("basalt-2x2-1", "volcano", 0, 6, 2, 2, "basalt"), ("basalt-2x2-2", "volcano", 2, 6, 2, 2, "basalt"),
          ("basalt-3x2", "volcano", 4, 6, 3, 2, "basalt"), ("basalt-3x3", "volcano", 7, 6, 3, 3, "basalt")]
    # desert rows 9..18
    L += [(f"ripple-{k}", "desert", k - 1, 9, 1, 1, "ripple") for k in range(1, 5)]
    L += [("cactus-barrel", "desert", 4, 9, 1, 1, "cactus"), ("cactus-bloom", "desert", 5, 9, 1, 1, "cactus"),
          ("cactus-saguaro", "desert", 6, 9, 1, 2, "cactus"), ("cactus-saguaro-2", "desert", 7, 9, 1, 2, "cactus"),
          ("bones", "desert", 8, 9, 2, 1, "bones"), ("buried-column", "desert", 10, 9, 1, 2, "column")]
    for k, c in enumerate(CANON + ["b1", "b2"]):
        L.append((f"cracked-{c}", "desert", k % 30, 11 + k // 30, 1, 1, "cracked"))
    L += [("dune-s-1", "desert", 0, 13, 3, 2, "dune"), ("dune-s-2", "desert", 3, 13, 3, 2, "dune"),
          ("dune-m-1", "desert", 6, 13, 4, 3, "dune"), ("dune-m-2", "desert", 10, 13, 4, 3, "dune"),
          ("dune-l-1", "desert", 14, 13, 6, 3, "dune"),
          ("mesa-3x3", "desert", 20, 13, 3, 3, "mesa"), ("mesa-4x3", "desert", 23, 13, 4, 3, "mesa"),
          ("mesa-5x4", "desert", 0, 16, 5, 4, "mesa")]
    return L

# Snow: castle tops that get a snow cap (source tile → copy, in this order from row 20 col 0). A source listed again
# gets another variant (the walks 412 and 21: the same dusting plus a small drift inside the tile, so a long walk
# does not repeat one tile).
SNOW_WALLS = [18, 19, 20, 21, 24, 25, 51, 78, 80, 108, 109, 110, 412, 412, 412, 21, 21]
ROWS = 21
COUNT = (ROW0 + ROWS) * COLS
LAYOUT = _layout()

def snow_layout():
    """[(source castle tile, snow-capped copy)] in row 121; a source may appear more than once (variants)."""
    return [(src, (ROW0 + 20) * COLS + k) for k, src in enumerate(SNOW_WALLS)]

def snow_variant(k):
    """0 for the first copy of SNOW_WALLS[k], 1, 2, … for the later ones."""
    return SNOW_WALLS[:k].count(SNOW_WALLS[k])

def tile_no(col, row): return (ROW0 + row) * COLS + col

# ── helpers ─────────────────────────────────────────────────────────────────────────────────────────────────────
def periodic_noise(seed, period=16, octaves=((4, 1.0), (8, 0.5))):
    """Smooth noise on a period×period torus in [-1, 1]."""
    R = np.random.RandomState(seed); out = np.zeros((period, period), np.float32)
    yy, xx = np.mgrid[0:period, 0:period].astype(np.float32)
    for cells, amp in octaves:
        g = R.uniform(-1, 1, (cells, cells)).astype(np.float32)
        fx = xx / period * cells; fy = yy / period * cells
        x0 = np.floor(fx).astype(int); y0 = np.floor(fy).astype(int); tx = fx - x0; ty = fy - y0
        tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty)
        a = g[y0 % cells, x0 % cells]; b = g[y0 % cells, (x0 + 1) % cells]
        c = g[(y0 + 1) % cells, x0 % cells]; d = g[(y0 + 1) % cells, (x0 + 1) % cells]
        out += amp * ((a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty)
    return out / max(1e-6, np.abs(out).max())

def voronoi_seams(seed, n=5, period=16):
    """Periodic Voronoi on a 16×16 torus: (edge distance d2-d1, cell id) per pixel."""
    R = random.Random(seed); pts = [(R.uniform(0, period), R.uniform(0, period)) for _ in range(n)]
    yy, xx = np.mgrid[0:period, 0:period].astype(np.float32) + 0.5
    ds = []
    for px, py in pts:
        dx = np.abs(xx - px); dx = np.minimum(dx, period - dx); dy = np.abs(yy - py); dy = np.minimum(dy, period - dy)
        ds.append(np.hypot(dx, dy))
    ds = np.stack(ds); order = np.sort(ds, 0)
    return order[1] - order[0], np.argmin(ds, 0)

try:
    from scipy.ndimage import distance_transform_edt as _edt
except ImportError:  # pragma: no cover - same numbers, slower
    _edt = None

def edt(mask):
    """Exact distance from each pixel to the nearest pixel where mask is False (0 on False pixels)."""
    if _edt is not None:
        return _edt(mask).astype(np.float32) if (~mask).any() else np.full(mask.shape, 99.0, np.float32)
    H, W = mask.shape; out = np.zeros((H, W), np.float32)
    ys, xs = np.nonzero(~mask)
    if not len(ys): return np.full((H, W), 99.0, np.float32)
    iy, ix = np.nonzero(mask)
    pts = np.stack([ys, xs], 1).astype(np.float32)
    for s in range(0, len(iy), 512):
        q = np.stack([iy[s:s + 512], ix[s:s + 512]], 1).astype(np.float32)
        d = np.sqrt(((q[:, None, :] - pts[None, :, :]) ** 2).sum(-1)).min(1)
        out[iy[s:s + 512], ix[s:s + 512]] = d
    return out

def blob_field(mask_bits, r_open=4.0, r_close=3.0, wobble=None, amp=1.2, inset=0.0):
    """Signed distance (px, + inside) of the centre cell of a 3×3 neighbourhood; 48×48 → centre 16×16 slice."""
    I = np.zeros((48, 48), bool); I[16:32, 16:32] = True
    for k, b in DIRS.items():
        if mask_bits & b:
            dx, dy = OFF[k]; I[16 + dy * 16:32 + dy * 16, 16 + dx * 16:32 + dx * 16] = True
    # the context continues past its frame (edge padding), so the frame is no false boundary
    I = np.pad(I, 16, mode='edge')
    op = edt(~(edt(I) > r_open)) <= r_open          # open: rounds convex corners
    cl = edt(edt(~op) <= r_close) > r_close         # close: rounds concave corners
    D = np.where(cl, edt(cl) - 0.5, -(edt(~cl) - 0.5))[16:64, 16:64]
    if wobble is not None: D = D + amp * np.tile(wobble, (3, 3))
    D = D - inset  # the edge sits inside the cells, so the wobble never shows the grid
    gy, gx = np.gradient(D)
    return D[16:32, 16:32], gx[16:32, 16:32], gy[16:32, 16:32]

def tile_px(img, t):
    return np.array(img.crop(((t % 30) * 16, (t // 30) * 16, (t % 30) * 16 + 16, (t // 30) * 16 + 16))).astype(np.float32)

# ── volcano palette ────────────────────────────────────────────────────────────────────────────────────────────
V = dict(soot=hexc('1a1210'), crustD=hexc('291010'), crust=hexc('3c322f'), crustL=hexc('544640'), core=hexc('c4450e'),
         deep=hexc('b5310a'), hot=hexc('e48625'), white=hexc('ffda58'), bas=hexc('2c2522'), basM=hexc('3a312c'),
         basL=hexc('4f433b'), basH=hexc('6a5a4e'), scorch=hexc('4a413c'), sulf=hexc('d6c24a'), sulfD=hexc('9a8a2e'),
         sulfL=hexc('f0e27a'), obs=hexc('17121c'), obsM=hexc('2e2438'), obsH=hexc('8a78a8'), ash=hexc('8a827c'),
         ashL=hexc('a79f98'), ashD=hexc('5a524d'), smoke=hexc('c9c4c0'), smokeD=hexc('9a9490'), smokeL=hexc('eceae6'))

def dither(x, y, t):
    """Ordered 4×4 Bayer threshold test: True where t (0..1) beats the matrix."""
    B = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16 + 1 / 32
    return t > B[y % 4, x % 4]

def mixed_seams(seed, n, variant):
    """Seam field of a blob body: the base pattern along the tile's edges (so every tile joins), a different pattern
    3 px in for the body variants — mixed at random over a plate, the 16 px repeat does not show."""
    seam, cid = voronoi_seams(seed, n)
    if variant:
        s2, c2 = voronoi_seams(seed + variant * 97, n)
        yy, xx = np.mgrid[0:16, 0:16]
        inner = np.minimum.reduce([xx, yy, 15 - xx, 15 - yy]) >= 3
        seam = np.where(inner, s2, seam); cid = np.where(inner, c2 + n, cid)
    return seam, cid

PL = dict(o=hexc('241b18'), a=hexc('3f3632'), b=hexc('463c37'), l=hexc('564b45'), h=hexc('6e635b'), seam=hexc('2a1d19'))

def paint_plate(ground, m, variant=0):
    """Cooled lava crust: flat plates a shade darker than the ash, dark seams that glow here and there, a thin raised
    rim (lit on the upper left) and a scorched fringe — ground, not a heap of rocks."""
    wob = periodic_noise(11, octaves=((2, 1.0), (4, 0.6)))
    D, gx, gy = blob_field(m if variant == 0 else 255, 9.0, 5.0, wob, 2.4, 2.6)
    seam, cid = mixed_seams(5, 6, variant)
    out = ground.copy()
    glow = periodic_noise(23, octaves=((2, 1.0), (4, 0.5)))
    for y in range(16):
        for x in range(16):
            d = D[y, x]
            if d < -1.5: continue
            if d < 0:  # scorched halo round the plate
                if dither(x, y, 0.45 + 0.3 * (d + 1.5) / 1.5): out[y, x, :3] = V['scorch']
                continue
            if d < 1.0: out[y, x, :3] = PL['o']; continue
            lit = -(gx[y, x] + gy[y, x])  # normal points to the upper left → lit rim
            if d < 2.0:
                out[y, x, :3] = PL['h'] if lit > 0.25 else PL['seam'] if lit < -0.25 else PL['l']; continue
            c = PL['a'] if cid[y, x] % 2 else PL['b']
            if 1.0 <= seam[y, x] < 1.6 and (x + y) % 2: c = PL['l']   # plate edges catch the light
            if seam[y, x] < 0.8 and d > 2.4:
                c = PL['seam']
                if seam[y, x] < 0.45 and glow[y, x] > 0.4: c = V['hot'] if glow[y, x] > 0.75 else V['core']
            out[y, x, :3] = c
    return out

def paint_pool(ground, lava, m, variant=0):
    wob = periodic_noise(41, octaves=((2, 1.0), (4, 0.7)))
    D, gx, gy = blob_field(m if variant == 0 else 255, 8.0, 5.0, wob, 2.4, 2.4)
    crack = voronoi_seams(9, 4)[0]
    flow = periodic_noise(43, octaves=((2, 1.0), (4, 0.8), (8, 0.3)))
    lava = np.zeros((16, 16, 4), np.float32)
    for y in range(16):
        for x in range(16):
            f = flow[y, x]
            lava[y, x, :3] = V['white'] if f > 0.72 else V['hot'] if f > 0.3 else V['core'] if f > -0.45 else V['deep']
    out = ground.copy()
    for y in range(16):
        for x in range(16):
            d = D[y, x]
            if d < -1.5: continue
            if d < 0:
                if dither(x, y, 0.5 + 0.35 * (d + 1.5) / 1.5): out[y, x, :3] = V['scorch']
                continue
            if d < 1.0: out[y, x, :3] = V['crustD']; continue
            lit = -(gx[y, x] + gy[y, x])
            if d < 3.0:  # crusted rim: grey crust, bright where it faces the light, hot cracks
                c = V['crustL'] if lit > 0.3 and d < 2.0 else V['crust']
                if crack[y, x] < 0.5: c = V['core']
                if d > 2.3 and (x * 7 + y * 3) % 5 == 0: c = V['deep']
                out[y, x, :3] = c; continue
            out[y, x, :3] = lava[y, x, :3] if d >= 3.8 else V['deep']
    if variant:
        R = random.Random(variant * 17)
        for k in range(3 + variant):
            cx, cy = R.randint(4, 11), R.randint(4, 11)
            out[cy, cx, :3] = V['white']; out[cy, cx - 1, :3] = V['hot']; out[cy - 1, cx, :3] = V['crustD'] if variant == 2 else V['hot']
    return out

CRACK_END = {'N': (7.5, -1.0), 'E': (17.0, 7.5), 'S': (7.5, 17.0), 'W': (-1.0, 7.5)}
CRACK_IN = {'N': (7.5, 3.0), 'E': (13.0, 7.5), 'S': (7.5, 13.0), 'W': (3.0, 7.5)}

def seg_dist(px, py, a, b):
    ax, ay = a; bx, by = b; vx, vy = bx - ax, by - ay
    t = np.clip(((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy + 1e-9), 0, 1)
    return np.hypot(px - ax - t * vx, py - ay - t * vy), t

def paint_crack(ground, m, alt=0):
    R = random.Random(1000 + m * 7 + alt * 101)
    dirs = [k for k in 'NESW' if m & DIRS[k]]
    cx, cy = 7.5 + R.uniform(-1.2, 1.2), 7.5 + R.uniform(-1.2, 1.2)
    segs = []  # (a, b, width at a, width at b)
    if not dirs:  # a short lone fissure
        a = (cx - 3, cy + 2); b = (cx + 3, cy - 2); segs += [(a, (cx, cy + 0.5), 0.3, 1.0), ((cx, cy + 0.5), b, 1.0, 0.3)]
    for k in dirs:
        mid = CRACK_IN[k]; jitter = R.uniform(-1.6, 1.6)
        j = (mid[0] + (jitter if k in 'NS' else 0), mid[1] + (jitter if k in 'EW' else 0))
        full = len(dirs) > 1
        segs += [((cx, cy), j, 1.0 if full else 0.35, 1.0), (j, mid, 1.0, 1.0), (mid, CRACK_END[k], 1.0, 1.0)]
    yy, xx = np.mgrid[0:16, 0:16].astype(np.float32) + 0.5
    best = np.full((16, 16), 99.0, np.float32); width = np.ones((16, 16), np.float32)
    for a, b, wa, wb in segs:
        d, t = seg_dist(xx, yy, a, b); w = wa + (wb - wa) * t
        upd = d / np.maximum(w, 0.2) < best / np.maximum(width, 0.2)
        best = np.where(upd, d, best); width = np.where(upd, w, width)
    out = ground.copy(); nz = periodic_noise(77 + alt)
    for y in range(16):
        for x in range(16):
            d, w = best[y, x], width[y, x]
            if d < 1.05 * w: out[y, x, :3] = V['white'] if (w > 0.9 and d < 0.35 and (x * 3 + y * 5 + alt) % 7 == 0) else V['hot'] if d < 0.5 * w and nz[y, x] > -0.1 else V['core']
            elif d < 2.1 * w: out[y, x, :3] = V['crustD']
            elif d < 3.0 * w and dither(x, y, 0.6): out[y, x, :3] = V['scorch']
    return out

def paint_sulfur(ground, variant):
    out = ground.copy(); nz = periodic_noise(300 + variant, octaves=((4, 1.0), (8, 0.7)))
    R = random.Random(variant)
    cx, cy = 7.5 + R.uniform(-1, 1), 8 + R.uniform(-1, 1)
    for y in range(16):
        for x in range(16):
            r = math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 1.25) + nz[y, x] * 1.6
            if r < 3.0: out[y, x, :3] = V['sulfL'] if (x + y) % 3 == 0 else V['sulf']
            elif r < 4.6: out[y, x, :3] = V['sulf'] if dither(x, y, 0.5) else V['sulfD']
            elif r < 5.8 and dither(x, y, 0.3): out[y, x, :3] = V['sulfD']
    return out

def sprite(w, h, fn):
    a = np.zeros((h, w, 4), np.float32)
    fn(a)
    return a

def put(a, x, y, c):
    if 0 <= x < a.shape[1] and 0 <= y < a.shape[0]: a[y, x, :3] = c; a[y, x, 3] = 255

def outline(a, c):
    A = a[..., 3] > 0; H, W = A.shape; o = a.copy()
    for y in range(H):
        for x in range(W):
            if A[y, x]: continue
            if any(0 <= x + dx < W and 0 <= y + dy < H and A[y + dy, x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                o[y, x, :3] = c; o[y, x, 3] = 255
    return o

def blob_sprite(w, h, cx, cy, rx, ry, seed, pal, jag=0.25):
    """Lit-from-upper-left lump (rock, heap) with a 1px outline — pal = (dark, mid, light, high, outline)."""
    R = np.random.RandomState(seed); a = np.zeros((h, w, 4), np.float32)
    ang = R.uniform(0, 2 * math.pi, 5); amp = R.uniform(0, jag, 5)
    for y in range(h):
        for x in range(w):
            dx, dy = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
            th = math.atan2(dy, dx); rr = 1 + sum(amp[k] * math.cos((k + 2) * th + ang[k]) for k in range(5)) * 0.5
            r = math.hypot(dx, dy) / rr
            if r > 1: continue
            lit = -(dx + dy) / 1.4 + (1 - r) * 0.6
            c = pal[3] if lit > 0.75 else pal[2] if lit > 0.25 else pal[1] if lit > -0.35 else pal[0]
            a[y, x, :3] = c; a[y, x, 3] = 255
    return outline(a, pal[4])

def paint_obsidian(variant):
    R = random.Random(variant * 13); a = np.zeros((16, 16, 4), np.float32)
    shards = [(8, 10, 4.5, 3.2)] + [(R.uniform(4, 12), R.uniform(8, 12), R.uniform(1.8, 3), R.uniform(3, 5.5)) for _ in range(2)]
    for sx, sy, hw, hh in shards:  # upright wedge shards
        for y in range(16):
            for x in range(16):
                u = (x + 0.5 - sx) / hw; v = (sy + 2 - (y + 0.5)) / hh
                if 0 <= v <= 1.4 and abs(u) <= max(0, 1 - v * 0.75):
                    face = V['obsM'] if u < 0 else V['obs']
                    if abs(u) < 0.18 and v > 0.3: face = V['obsH']
                    a[y, x, :3] = face; a[y, x, 3] = 255
    return outline(a, V['soot'])

def paint_ash(variant):
    return blob_sprite(16, 16, 8 + (variant - 1.5), 10.5, 6.2, 4.0, 60 + variant, (V['ashD'], V['ash'], V['ashL'], hexc('c8c1ba'), V['soot']))

def paint_fumarole(ground, variant):
    """(smoke over the vent, vent) — the vent is a lower tile on ash, the smoke an upper tile above it."""
    vent = paint_sulfur(ground, 10 + variant)
    for y in range(16):
        for x in range(16):
            r = math.hypot(x + 0.5 - 8, (y + 0.5 - 9) * 1.5)
            if r < 1.6: vent[y, x, :3] = V['soot']
            elif r < 2.6: vent[y, x, :3] = V['crustD']
            elif r < 3.4 and y < 9: vent[y, x, :3] = V['sulfD']
    smoke = np.zeros((16, 16, 4), np.float32); R = random.Random(variant * 5 + 2)
    # a curling column of puffs rising from the vent (bottom edge) and drifting right (frame 2 drifts left)
    drift = 1 if variant == 1 else -1
    puffs = [(8, 14.5, 1.6), (8 + drift * 1.5, 10.5, 2.4), (8 + drift * 0.5, 6.0, 3.0), (8 + drift * 2.5, 2.2, 2.2)]
    for px, py, rad in puffs:
        for y in range(16):
            for x in range(16):
                r = math.hypot(x + 0.5 - px, (y + 0.5 - py) * 1.15)
                if r < rad:
                    lit = (x + 0.5 - px + y + 0.5 - py) < -rad * 0.2
                    smoke[y, x, :3] = V['smokeL'] if lit else V['smoke']; smoke[y, x, 3] = 255
    smoke = outline(smoke, V['smokeD'])
    return smoke, vent

def paint_basalt(w, h, seed, ground):
    """Column cluster seen from the upper left: hexagonal tops (lit), dark shafts, 1px soot outline; on ash."""
    W, H = w * 16, h * 16; R = random.Random(seed)
    img = np.zeros((H, W, 4), np.float32)
    cols = []
    n = {(2, 2): 4, (3, 2): 5, (3, 3): 8}[(w, h)]
    for k in range(n * 6):
        if len(cols) >= n: break
        cx = R.uniform(5, W - 5); top = R.uniform(4, H * 0.55); rad = R.uniform(3.2, 4.6); tall = R.uniform(H * 0.25, H - top - 2)
        if any(abs(cx - c[0]) < rad + c[2] - 2.5 and abs(top - c[1]) < 4 for c in cols): continue
        cols.append((cx, top, rad, min(tall, H - 2 - top)))
    cols.sort(key=lambda c: c[1] + c[3])
    for cx, top, rad, tall in cols:
        bottom = top + tall
        for y in range(H):
            for x in range(W):
                u = (x + 0.5 - cx) / rad
                if abs(u) > 1: continue
                ytop = top + abs(u) * rad * 0.35
                if ytop - rad * 0.45 <= y + 0.5 <= ytop + rad * 0.45 and abs(u) < 1 - abs(y + 0.5 - ytop) / (rad * 0.9):
                    c = V['basH'] if u < 0.1 else V['basL']
                elif ytop <= y + 0.5 <= bottom:
                    c = V['basL'] if u < -0.45 else V['basM'] if u < 0.35 else V['bas']
                    if abs(u - 0.35) < 0.08: c = V['crustD']
                else: continue
                img[y, x, :3] = c; img[y, x, 3] = 255
    img = outline(img, V['soot'])
    out = np.tile(ground, (h, w, 1)).astype(np.float32)
    A = img[..., 3] > 0; out[A] = img[A]
    # soft soot shadow at the feet (right side)
    for y in range(H):
        for x in range(W):
            if not A[y, x] and y > 2 and A[max(0, y - 2), max(0, x - 2)] and dither(x, y, 0.5): out[y, x, :3] = V['scorch']
    return out, A

# ── desert palette ─────────────────────────────────────────────────────────────────────────────────────────────
D_ = dict(sand=hexc('e5c98c'), lit=hexc('f2dca3'), high=hexc('fbecc0'), shade=hexc('cfae70'), shadeD=hexc('b8935a'),
          line=hexc('9c7644'), rip=hexc('efd69e'), ripD=hexc('d9bb80'), clay=hexc('dcbd82'), clayL=hexc('e8cf98'),
          clayD=hexc('c9a56c'), crack=hexc('9a7448'), st1=hexc('7d562f'), st2=hexc('936637'), st3=hexc('ac7841'),
          st4=hexc('bb8346'), st5=hexc('eea859'), stTop=hexc('d99a55'), stTopL=hexc('f0bd78'), stO=hexc('4e3419'),
          cac=hexc('4e7f37'), cacD=hexc('205030'), cacO=hexc('143a27'), cacL=hexc('7fae52'), cacH=hexc('d9dc6f'),
          flower=hexc('e8506a'), flowerL=hexc('ffb0c0'), bone=hexc('eee6d2'), boneD=hexc('bfb299'), boneO=hexc('6e5e48'))

RIPPLE_ROWS = (2, 7, 12)  # every ripple line crosses the tile's side edges on these rows, so variants join

def paint_ripple(ground, variant):
    """Wind ripples: three wavy lines across the tile (lit crest over a soft shadow). The lines meet the side edges on
    fixed rows, so any mix of variants runs on; variants bow the lines differently, drop one, or add pebbles."""
    out = ground.copy(); R = random.Random(400 + variant)
    amps = {1: (1.6, -1.2, 1.4), 2: (-1.5, 1.8, -1.0), 3: (0.8, 0.6, -1.8), 4: (1.2, 0.0, -1.4)}[variant]
    for k, (y0, amp) in enumerate(zip(RIPPLE_ROWS, amps)):
        if variant == 4 and k == 1: continue
        ph = R.uniform(0.7, 1.3)
        for x in range(16):
            y = int(round(y0 + amp * math.sin(math.pi * ph * (x + 0.5) / 16) * math.sin(math.pi * (x + 0.5) / 16)))
            out[y, x, :3] = D_['rip']
            if y + 1 < 16: out[y + 1, x, :3] = D_['ripD']
    if variant == 4:  # a few pebbles in the gap
        for _ in range(3):
            x, y = R.randint(2, 13), R.randint(5, 9); out[y, x, :3] = D_['shadeD']; out[y - 1, x, :3] = D_['lit']
    return out

def paint_cracked(ground, m, variant=0):
    """Dried mud: the sand a shade darker and flatter, split into plates by thin dark cracks with a lit lip on the far
    side; the rim crumbles into the sand (every other pixel)."""
    wob = periodic_noise(91, octaves=((4, 1.0), (8, 0.8)))
    D, gx, gy = blob_field(m if variant == 0 else 255, 9.0, 5.0, wob, 2.4, 2.4)
    seam, cid = mixed_seams(33, 9, variant)
    out = ground.copy()
    for y in range(16):
        for x in range(16):
            d = D[y, x]
            if d < 0: continue
            if d < 1.0:
                if dither(x, y, 0.5): out[y, x, :3] = D_['clayD']
                continue
            c = D_['clay'] if cid[y, x] % 3 else D_['clayL']
            if seam[y, x] < 0.5 and d > 1.5: c = D_['crack']
            elif seam[y, x] < 1.0 and d > 1.5: c = D_['clayL'] if (gx[y, x] + gy[y, x]) >= 0 or (x + y) % 2 else D_['clayD']
            out[y, x, :3] = c
    return out

def paint_dune(w, h, seed, ground):
    """Sand dune seen from above with the light from the upper left: an oval mound split by a sharp bowed crest — the
    windward back (upper left) lit and brightest at the crest, the steep slip face (lower right) in shade, darkest just
    under the crest. The foot fades into plain sand, so the stamp sits on the 240 ground with no seam."""
    W, H = w * 16, h * 16; R = random.Random(seed)
    out = np.tile(ground, (h, w, 1)).astype(np.float32)
    cx, cy = W * R.uniform(0.47, 0.53), H * R.uniform(0.5, 0.56)
    rx, ry = W * 0.47 - 1, H * 0.44 - 1
    wob = [R.uniform(-1, 1) for _ in range(4)]
    # crest: a quadratic curve from the lower left to the upper right, bowed toward the lower right
    p0 = (cx - rx * 0.78, cy + ry * R.uniform(0.2, 0.4)); p2 = (cx + rx * 0.78, cy - ry * R.uniform(0.35, 0.55))
    p1 = (cx + rx * 0.2, cy + ry * 0.25)
    ts = np.linspace(0, 1, 60)
    crx = (1 - ts) ** 2 * p0[0] + 2 * (1 - ts) * ts * p1[0] + ts ** 2 * p2[0]
    cry = (1 - ts) ** 2 * p0[1] + 2 * (1 - ts) * ts * p1[1] + ts ** 2 * p2[1]
    A = np.zeros((H, W), bool)
    for y in range(H):
        for x in range(W):
            dx, dy = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
            th = math.atan2(dy, dx)
            e = math.hypot(dx, dy) / (1 + 0.07 * sum(wob[k] * math.sin((k + 2) * th + k * 1.7) for k in range(4)))
            if e >= 1: continue
            hgt = 1 - e
            # side of the crest: sign of the cross product with the nearest crest segment
            k = int(np.argmin((crx - x - 0.5) ** 2 + (cry - y - 0.5) ** 2)); k = min(k, len(ts) - 2)
            tx, ty = crx[k + 1] - crx[k], cry[k + 1] - cry[k]
            s = tx * (y + 0.5 - cry[k]) - ty * (x + 0.5 - crx[k])   # > 0: lower right of the crest (lee)
            dist = math.hypot(x + 0.5 - crx[k], y + 0.5 - cry[k])
            if s > 0:
                if hgt < 0.1: c = D_['shade'] if dither(x, y, hgt / 0.1 * 0.8) else None
                else: c = D_['shadeD'] if dist < 2.5 else D_['shade']
            else:
                if dist < 1.2 and hgt > 0.12: c = D_['high']
                elif hgt > 0.28: c = D_['lit'] if dist > 5 or (x + y) % 3 else D_['high']
                elif hgt > 0.06: c = D_['lit'] if dither(x, y, (hgt - 0.06) / 0.22) else None
                else: c = None
                if c is not None and 0.3 < hgt and dist > 3 and int(x * 0.45 + y) % 5 == 0 and (x + y) % 2: c = D_['rip']
            if c is None: continue
            out[y, x, :3] = c; A[y, x] = True
    # 1px line along the crest's lee edge; soft shadow where the slip face meets flat sand
    for y in range(1, H):
        for x in range(W):
            if A[y, x] and A[y - 1, x] and (out[y, x, :3] == D_['shadeD']).all() and (out[y - 1, x, :3] == D_['high']).all(): out[y, x, :3] = D_['line']
    for y in range(H - 1, 0, -1):
        for x in range(W - 1, 0, -1):
            if not A[y, x] and A[y - 1, x - 1] and (out[y - 1, x - 1, :3] == D_['shade']).all() and dither(x, y, 0.5): out[y, x, :3] = D_['shade']; A[y, x] = True
    return out, A


def paint_mesa(w, h, seed, ground):
    """Sandstone butte: rounded flat top (lit), layered cliff face that widens into a scree foot, eroded outline,
    1px dark outline, shade on the right; on sand."""
    W, H = w * 16, h * 16; R = random.Random(seed)
    out = np.tile(ground, (h, w, 1)).astype(np.float32); A = np.zeros((H, W), bool)
    nz = [R.uniform(-1, 1) for _ in range(12)]
    def wav(t, amp, k0): return amp * sum(nz[(k0 + k) % 12] * math.sin((k + 1) * t * math.pi * 2 + nz[(k0 + k + 5) % 12] * 3) / (k + 1) for k in range(3))
    t0, foot = 2.5, H - 2.5
    tb = t0 + (H - 5) * R.uniform(0.3, 0.36)       # top face bottom
    cxm = W / 2 + R.uniform(-1.5, 1.5); hw0 = W / 2 - 1.5
    for y in range(H):
        yc = y + 0.5
        if yc < t0 or yc > foot: continue
        if yc < tb:  # plateau: an ellipse-like top, narrower than the base
            v = (yc - t0) / (tb - t0)
            hw = hw0 * 0.78 * math.sqrt(max(0, 1 - (1 - v) ** 2 * 0.85)) if v < 0.5 else hw0 * 0.78 * math.sqrt(max(0, 1 - (v - 0.5) ** 2 * 0.2))
        else:
            v = (yc - tb) / (foot - tb)
            hw = hw0 * (0.78 + 0.22 * v ** 1.6)
        hw += wav(yc / H, 1.2, 0)
        for x in range(W):
            u = (x + 0.5 - cxm) / max(1, hw)
            if abs(u) > 1: continue
            A[y, x] = True
            if yc < tb:
                c = D_['stTopL'] if u < 0.15 else D_['stTop']
                if (x * 5 + y * 3) % 19 == 0: c = D_['st4']
            elif (yc - tb) > (foot - tb) * 0.82:  # scree at the foot
                c = [D_['st4'], D_['st3'], D_['st5'], D_['st2']][(x * 3 + y * 7) % 4]
            else:
                band = int((yc - tb + wav(x / W, 0.9, 4)) / 3.0) % 4
                c = [D_['st4'], D_['st3'], D_['st5'], D_['st3']][band]
                if u > 0.35: c = [D_['st2'], D_['st1'], D_['st3'], D_['st2']][band]
                if u < -0.65: c = D_['st5'] if band != 2 else D_['stTopL']
                if abs(yc - tb) < 1.0: c = D_['st1']
                if (x * 7 + y * 11) % 31 == 0: c = D_['st1']
            out[y, x, :3] = c
    img = np.zeros((H, W, 4), np.float32); img[A, 3] = 255
    ring = (outline(img, D_['stO'])[..., 3] > 0) & ~A
    out[ring, :3] = D_['stO']
    for y in range(H):  # cast shadow on the sand to the right of the face
        for x in range(W):
            if not A[y, x] and not ring[y, x] and y + 0.5 > tb and A[y, max(0, x - 2)] and dither(x, y, 0.5): out[y, x, :3] = D_['shadeD']
    return out, A | ring


def paint_cactus(kind):
    if kind == 'barrel':
        a = blob_sprite(16, 16, 8, 10.5, 4.8, 4.6, 7, (D_['cacD'], D_['cac'], D_['cacL'], D_['cacH'], D_['cacO']), 0.05)
        for x in (6, 8, 10):  # ribs
            for y in range(7, 15):
                if a[y, x, 3] and not (a[y, x, :3] == D_['cacO']).all(): a[y, x, :3] = D_['cacD']
        for x, y in ((7, 6), (9, 6), (8, 5)): put(a, x, y, D_['cacH'])
        return [a]
    if kind == 'bloom':  # prickly pear pads with a flower
        a = np.zeros((16, 16, 4), np.float32)
        for cx, cy, rx, ry in ((6, 11, 3.6, 3.4), (10.5, 9.5, 3.2, 3.6), (8, 5.5, 2.6, 2.8)):
            b = blob_sprite(16, 16, cx, cy, rx, ry, int(cx * 10), (D_['cacD'], D_['cac'], D_['cacL'], D_['cacH'], D_['cacO']), 0.05)
            m_ = b[..., 3] > 0; a[m_] = b[m_]
        for x, y, c in ((8, 2, D_['flower']), (7, 3, D_['flower']), (9, 3, D_['flower']), (8, 3, D_['flowerL']), (8, 4, D_['flower'])): put(a, x, y, c)
        for x, y in ((5, 10), (11, 8), (6, 13)): put(a, x, y, D_['cacH'])
        return [a]
    # saguaro 1×2 (16×32): trunk and two arms
    a = np.zeros((32, 16, 4), np.float32); left = kind == 'saguaro'
    def bar(x0, x1, y0, y1):
        for y in range(y0, y1):
            for x in range(x0, x1):
                u = (x - x0 + 0.5) / (x1 - x0)
                put(a, x, y, D_['cacL'] if u < 0.3 else D_['cac'] if u < 0.72 else D_['cacD'])
    bar(6, 11, 5, 30)
    for y in range(4, 7):
        for x in range(7, 10): put(a, x, y, D_['cacL'] if x == 7 else D_['cac'])
    if left: bar(2, 5, 9, 18); bar(2, 7, 17, 20); bar(11, 14, 13, 21); bar(10, 14, 20, 23)
    else: bar(2, 5, 13, 21); bar(2, 7, 20, 23); bar(11, 14, 7, 16); bar(10, 14, 15, 18)
    for y in range(7, 29, 3): put(a, 8, y, D_['cacD'])
    a = outline(a, D_['cacO'])
    return [a[:16], a[16:]]

def paint_bones():
    a = np.zeros((16, 32, 4), np.float32)
    # skull on the left, rib arcs and a spine to the right
    for y in range(16):
        for x in range(32):
            r = math.hypot((x + 0.5 - 7) / 4.2, (y + 0.5 - 9) / 3.6)
            if r < 1: put(a, x, y, D_['bone'] if (x < 7 or y < 8) else D_['boneD'])
    for x, y in ((5, 9), (6, 9), (8, 9), (9, 9)): put(a, x, y, D_['boneO'])
    for x in range(11, 29): put(a, x, 10, D_['boneD'])
    for k, x in enumerate(range(13, 28, 3)):
        for y in range(6, 14):
            if abs(y - 10) >= 1: put(a, x + (1 if y > 10 else 0), y, D_['bone'] if y < 10 else D_['boneD'])
    return [o for o in (lambda b: [b[:, :16], b[:, 16:]])(outline(a, D_['boneO']))]

def paint_column():
    a = np.zeros((32, 16, 4), np.float32)
    for y in range(9, 30):
        for x in range(4, 12):
            u = (x - 3.5) / 8
            put(a, x, y, D_['st5'] if u < 0.3 else D_['st4'] if u < 0.7 else D_['st2'])
            if x in (6, 9) and y > 10: put(a, x, y, D_['st3'])
    for x, y in ((4, 9), (5, 8), (6, 9), (7, 7), (8, 8), (9, 9), (10, 8), (11, 9)):  # broken top
        for yy in range(0, y): a[yy, x, 3] = 0
        put(a, x, y, D_['stTopL'])
    for y in range(26, 30):  # sand drift over the foot
        for x in range(2, 14):
            if y - 26 > abs(x - 8) * 0.5 - 1: put(a, x, y, D_['lit'] if x < 8 else D_['sand'])
    a = outline(a, D_['stO'])
    return [a[:16], a[16:]]

# ── snow caps on castle tops ─────────────────────────────────────────────────────────────────────────────────────
S_ = dict(snow=hexc('ffffff'), snow2=hexc('dfe9f1'), rim=hexc('8ea3b5'), rimD=hexc('6f8396'))

def _snow_pixel(a, x, y, c):
    a[y, x, :3] = c; a[y, x, 3] = 255

# How each castle top takes snow: flat wall tops and merlons (rim), walk surfaces (blanket), the wall face under a
# walk (lip: an overhang with drips), tower heads against the sky (cap).
SNOW_MODE = {18: 'rim', 19: 'rim', 20: 'rim', 78: 'rim', 80: 'rim', 108: 'rim', 109: 'rim', 110: 'rim',
             21: 'blanket', 412: 'blanket', 51: 'lip', 24: 'cap', 25: 'cap'}

def snow_cap(src, tile, variant=0):
    """Snow on a castle top tile: white snow, a pale blue shade where it rounds off, and a 1px blue-grey outline where
    it meets stone or sky, so a snowy wall still reads on a snowfield (bare-trees.py's snow on branches)."""
    a = src.copy(); A = a[..., 3] > 0; H, W = A.shape
    lum = a[..., :3].mean(-1)
    snow = np.zeros((H, W), bool)
    mode = SNOW_MODE[tile]
    edge = np.zeros((H, W), bool)  # snow pixels that turn into the blue-grey outline (the wall edge stays readable)
    if mode == 'rim':
        # the flat wall top (pale slate, with its dark specks filled in) is snow, but where it meets the stone on its
        # right or lower side it keeps a 1px blue-grey edge; merlons (lighter blocks) take snow on their top 3 rows
        floor = A & (lum > 95) & (lum < 135)
        nb = sum(np.roll(floor, d, ax).astype(int) for d in (-1, 1) for ax in (0, 1))
        floor |= A & ~floor & (nb >= 3)
        merlon = A & (lum >= 135) & ~floor
        # half of the slate lies under drifts (two soft drifts a tile, tile-periodic), the rest stays stone
        nz = periodic_noise(515 + tile, octaves=((2, 1.0), (4, 0.45)))
        drift = nz >= np.percentile(nz, 45)
        snow |= floor & drift
        for y in range(H):
            for x in range(W):
                if not snow[y, x]: continue
                if (x + 1 < W and A[y, x + 1] and not floor[y, x + 1] and not merlon[y, x + 1]) or \
                   (y + 1 < H and A[y + 1, x] and not floor[y + 1, x] and not merlon[y + 1, x]): edge[y, x] = True
        for x in range(W):
            run = 0
            for y in range(H):
                if merlon[y, x]:
                    run += 1
                    if run <= 3: snow[y, x] = True
                else: run = 0
    elif mode == 'blanket':
        # a walk dusted with snow: the raised stones whiten, the joints stay dark (the tile's own texture already
        # tiles, so the dusting does too); variants add one small drift inside the tile, clear of its edges
        snow = A & (lum >= np.percentile(lum[A], 62))
        cnt = sum(np.roll(np.roll(snow, dy, 0), dx, 1).astype(int) for dy in (-1, 0, 1) for dx in (-1, 0, 1))
        snow &= cnt >= 3  # no lone specks
        if variant:
            R = random.Random(tile * 7 + variant)
            cx, cy = R.uniform(6, 9.5), R.uniform(6, 9.5)
            rx, ry = R.uniform(3.2, 4.4), R.uniform(2.2, 3.0)
            yy, xx = np.mgrid[0:H, 0:W]
            wob = periodic_noise(900 + tile + variant, octaves=((4, 1.0),)) * 0.25
            snow |= A & ((((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2) <= 1 + wob)
    elif mode == 'lip':
        for x in range(W):
            depth = 2 + (1 if x % 5 in (1, 2) else 0) + (1 if x % 10 == 2 else 0)
            for y in range(depth): snow[y, x] = A[y, x]
    elif mode == 'cap':
        for x in range(W):
            for y in range(H):
                if A[y, x] and (y == 0 or not A[y - 1, x]):
                    for k in range(3 if lum[y, x] > 60 else 2):
                        if y + k < H and A[y + k, x]: snow[y + k, x] = True
                    break
    out = a.copy()
    for y in range(H):
        for x in range(W):
            if not snow[y, x]: continue
            below = y + 1 < H and A[y + 1, x] and not snow[y + 1, x]
            right = x + 1 < W and A[y, x + 1] and not snow[y, x + 1]
            if edge[y, x]: _snow_pixel(out, x, y, S_['rim']); continue
            _snow_pixel(out, x, y, S_['snow2'] if (below or right) and mode != 'lip' else S_['snow'])
    # outline: stone just under the snow, and (cap) the sky just over it
    for y in range(H):
        for x in range(W):
            if snow[y, x]: continue
            if A[y, x] and y > 0 and snow[y - 1, x] and lum[y, x] > 45: _snow_pixel(out, x, y, S_['rim'])
            elif mode == 'cap' and not A[y, x] and ((y + 1 < H and snow[y + 1, x]) or (0 < x and snow[y, x - 1] and not A[y, x]) or (x + 1 < W and snow[y, x + 1])):
                _snow_pixel(out, x, y, S_['rim'])
    return out

# ── bake ─────────────────────────────────────────────────────────────────────────────────────────────────────────
PALETTES = ('volcano', 'desert', 'snow')

def stamps():
    """[{id, climate, kind, w, h, col, row, tiles, layers}] — tiles row-major sheet numbers (-1 = draws nothing)."""
    out = []
    for sid, climate, col, row, w, h, kind in LAYOUT:
        tiles = [tile_no(col + k % w, row + k // w) for k in range(w * h)]
        out.append(dict(id=sid, climate=climate, kind=kind, w=w, h=h, col=col, row=row, tiles=tiles))
    return out

_cache = {}
def _render(sheet, climate):
    ground = tile_px(sheet, 240)
    cells = {}  # tile → 16×16×4 array
    mask = {}   # stamp id → per-cell "draws" flags
    for st in stamps():
        if st['climate'] != climate: continue
        k, sid = st['kind'], st['id']
        t0 = st['tiles'][0]
        if k == 'crack':
            m = int(sid.split('-')[1]) if sid.split('-')[1].isdigit() else (5 if 'ns' in sid else 10)
            cells[t0] = paint_crack(ground, m, 0 if sid.split('-')[1].isdigit() else 1)
        elif k == 'sulfur': cells[t0] = paint_sulfur(ground, int(sid[-1]))
        elif k == 'obsidian': cells[t0] = paint_obsidian(int(sid[-1]))
        elif k == 'ash': cells[t0] = paint_ash(int(sid[-1]))
        elif k == 'fumarole':
            sm, vent = paint_fumarole(ground, int(sid[-1])); cells[st['tiles'][0]] = sm; cells[st['tiles'][1]] = vent
        elif k in ('plate', 'pool', 'cracked'):
            c = sid.split('-')[1]; m = 255 if c.startswith('b') else int(c); var = int(c[1]) if c.startswith('b') else 0
            if k == 'plate': cells[t0] = paint_plate(ground, m, var)
            elif k == 'pool': cells[t0] = paint_pool(ground, tile_px(sheet, 1530), m, var)
            else: cells[t0] = paint_cracked(ground, m, var)
        elif k == 'ripple': cells[t0] = paint_ripple(ground, int(sid[-1]))
        elif k in ('basalt', 'dune', 'mesa'):
            fn = dict(basalt=paint_basalt, dune=paint_dune, mesa=paint_mesa)[k]
            img, A = fn(st['w'], st['h'], sum(map(ord, sid)), ground)
            draws = []
            for j, t in enumerate(st['tiles']):
                dx, dy = j % st['w'], j // st['w']
                sub = A[dy * 16:dy * 16 + 16, dx * 16:dx * 16 + 16]
                draws.append(bool(sub.sum() >= 6))
                cells[t] = img[dy * 16:dy * 16 + 16, dx * 16:dx * 16 + 16]
            mask[sid] = draws
        elif k == 'cactus':
            for t, a in zip(st['tiles'], paint_cactus(sid.split('-')[1] if sid != 'cactus-saguaro-2' else 'saguaro2')): cells[t] = a
        elif k == 'bones':
            for t, a in zip(st['tiles'], paint_bones()): cells[t] = a
        elif k == 'column':
            for t, a in zip(st['tiles'], paint_column()): cells[t] = a
    if climate == 'snow':
        for k, (src, dst) in enumerate(snow_layout()): cells[dst] = snow_cap(tile_px(sheet, src), src, snow_variant(k))
    return cells, mask

def layout():
    """Stamps with -1 where a multi-cell piece draws nothing (shape only: the same on every sheet, flat probe ground)."""
    if 'layout' not in _cache:
        probe = Image.new('RGBA', (480, 1616), (128, 120, 110, 255))
        masks = {c: _render(probe, c)[1] for c in ('volcano', 'desert')}
        out = []
        for st in stamps():
            st = dict(st)
            if st['kind'] in ('basalt', 'dune', 'mesa'):
                st['tiles'] = [t if d else -1 for t, d in zip(st['tiles'], masks[st['climate']][st['id']])]
            out.append(st)
        _cache['layout'] = out
    return _cache['layout']

def bake(sheet, climate):
    """Copy of `sheet` grown to COUNT cells with this climate's block drawn (other blocks transparent)."""
    out = Image.new('RGBA', (COLS * 16, (COUNT // COLS) * 16), (0, 0, 0, 0))
    out.paste(sheet.crop((0, 0, COLS * 16, min(sheet.height, FIRST // COLS * 16))), (0, 0))
    cells, mask = _render(sheet, climate)
    full = stamps_by_id()
    drop = {t0 for st in layout() if st['climate'] == climate for t0, t in zip(full[st['id']]['tiles'], st['tiles']) if t < 0}
    for t, a in cells.items():
        if t in drop: continue
        a = a.copy(); a[..., 3] = np.where(a[..., 3] > 127, 255, 0)
        out.paste(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)), ((t % 30) * 16, (t // 30) * 16))
    return out

def stamps_by_id(): return {st['id']: st for st in stamps()}

def autotile_groups():
    """Blob groups (47 canonical masks → tiles; body 255 with its variants) and the crack (N/E/S/W bits only)."""
    by = stamps_by_id(); groups = {}
    for k in ('plate', 'pool', 'cracked'):
        vm = {str(m): by[f"{k}-{canon(m)}"]['tiles'][0] for m in range(256)}
        groups[k] = dict(variantMap=vm, body=by[f"{k}-255"]['tiles'][0], interior=[by[f"{k}-b1"]['tiles'][0], by[f"{k}-b2"]['tiles'][0]],
                         members=sorted({*vm.values(), by[f"{k}-b1"]['tiles'][0], by[f"{k}-b2"]['tiles'][0]}))
    vm = {str(m): by[f"crack-{m & 15}"]['tiles'][0] for m in range(256)}
    groups['crack'] = dict(variantMap=vm, alternates={"5": by['crack-ns-2']['tiles'][0], "10": by['crack-ew-2']['tiles'][0]},
                           members=sorted({*vm.values(), by['crack-ns-2']['tiles'][0], by['crack-ew-2']['tiles'][0]}))
    return groups

if __name__ == '__main__':
    import pathlib
    root = pathlib.Path(__file__).resolve().parents[2] / 'public/assets/climate-villages'
    ims = []
    for cl in PALETTES:
        sh = Image.open(root / f'{cl}-chipset.png').convert('RGBA')
        b = bake(sh, cl).crop((0, ROW0 * 16, 480, (ROW0 + ROWS) * 16))
        bg = Image.new('RGBA', b.size, tuple(int(v) for v in tile_px(sh, 240)[0, 0][:3]) + (255,)); bg.alpha_composite(b); ims.append(bg)
    sheet = Image.new('RGBA', (480, sum(i.height + 4 for i in ims)), (255, 0, 255, 255)); y = 0
    for i in ims: sheet.paste(i, (0, y)); y += i.height + 4
    sheet.resize((sheet.width * 2, sheet.height * 2), Image.NEAREST).save(sys.argv[1] if len(sys.argv) > 1 else '/tmp/climate-terrain.png')
