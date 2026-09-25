# Biome art for tiledata/atlas-biomes (drawn, not recoloured): giant jungle trees, mangroves, giant mushrooms, crystals,
# acacias and baobabs, snowy spruces, cairns, blighted obelisks, clouds and floating rocks, palms and corals…
# Each piece is a function returning an RGBA array of (h*16, w*16); PIECES lists them per biome with their cell roles:
#   C crown   upper, walkable (drawn over the walker)      T body   upper, solid
#   B base    lower, solid, lawn (240) backing             S small  upper, solid (1×1 bush, rock, crystal)
#   W decal   upper, walkable (flowers, shells)            O water  upper, solid, stands on water (lily, coral, cloud)
#   V vine    upper, solid, hangs on a cliff face          b baked  lower, solid, drawn on the neighbour ground (opaque)
# Cells that draw fewer than 6 pixels are dropped (-1) so a stamp never carries an empty cell.
import math, random
import numpy as np
from atlas_pixel import C, canvas, put, opaque, outline, darken_edge, over, clumps, trunk, line, ellipse, sphere_t, polygon, rock, shadow, pick, hash01, bayer

# ── palettes ─────────────────────────────────────────────────────────────────────────────────────────────────────
def P(*hexes): return [C(h) for h in hexes]
LEAF = {
    "jungle": P("071a0e", "0c2e18", "14502a", "25803a", "56b444", "b6ea6a"),
    "jungle2": P("071a10", "0e3420", "185e30", "2c9040", "6cc450", "c8f07a"),
    "swamp": P("111608", "1e2812", "34461e", "56702e", "8a9c4a", "c8cc86"),
    "mangrove": P("0e1a0c", "1a3014", "2e5020", "4a7632", "7ca24a", "b8d27a"),
    "savanna": P("141a08", "243412", "3c5420", "5c7a2c", "8ea444", "c8d27a"),
    "acacia": P("141806", "26320e", "3e5418", "5e7a24", "8aa438", "c2d06e"),
    "spruce": P("06120f", "0c2420", "143a32", "22584a", "3e7a64", "7eaa92"),
    "tropical": P("06200e", "0c3c18", "157026", "2ea43a", "6ad658", "c8f886"),
    "palm": P("0a2410", "124018", "1e6a22", "38962e", "72c048", "c4ec7a"),
    "sky": P("0a2a1c", "124430", "1e6e40", "3ea452", "7cd06a", "d0f49a"),
    "forest": P("0f2410", "1a3a1a", "2a5a26", "3f8030", "72b048", "c0e070"),
    "blight": P("08040a", "180c1e", "2a1632", "422450", "6a3e7a", "a47ab8"),
    "tundra": P("1a120a", "34240e", "5a3e1c", "86602e", "b08a50", "dcc088"),
}
BARK = {
    "jungle": P("1a0e06", "3a2210", "5e3a1c", "86582e", "aa7a48"),
    "grey": P("1a1614", "3a322c", "5a5048", "807466", "a89a88"),
    "mangrove": P("140c06", "2e1e10", "4e3620", "725234", "9a7a54"),
    "acacia": P("160e08", "34220e", "56381c", "7a5630", "a07a4e"),
    "baobab": P("1e140e", "4a3426", "6e5240", "947662", "b89c86"),
    "spruce": P("140c08", "2e1e12", "4a3220", "6a4a30", "8c6a48"),
    "palm": P("1e1408", "4a3418", "74542a", "9a7a44", "c0a068"),
    "blight": P("06040a", "140e1a", "241a2e", "3a2e46", "56466a"),
}
MUD = P("1a140c", "2e2414", "463824", "5e4c34", "7a6648")

def S(w, h): return canvas(w * 16, h * 16)

# ── trees ────────────────────────────────────────────────────────────────────────────────────────────────────────
def giant_tree(w, h, seed, leaf="jungle", bark="jungle", vines=True, buttress=True):
    """Huge rainforest tree: wide lumpy crown over the top rows, thick trunk with flaring buttress roots, hanging vines."""
    R = random.Random(seed); W, H = w * 16, h * 16
    a = canvas(W, H)
    cx = W / 2 + R.uniform(-2, 2); foot = H - 3
    top_h = H * 0.62
    # trunk + buttresses
    tm = trunk(a, cx, foot, cx + R.uniform(-3, 3), top_h * 0.55, W * 0.2, W * 0.13, BARK[bark], seed, roots=W * 0.22 if buttress else 2)
    if buttress:
        for sgn in (-1, 1):
            for k in range(2):
                x0 = cx + sgn * W * 0.08; y0 = foot - 6 - k * 4
                x1 = cx + sgn * (W * 0.28 + k * 5 + R.uniform(0, 3)); y1 = foot + 1
                line(a, x0, y0, x1, y1, BARK[bark][2], 2.2 - k * 0.6)
                line(a, x0 - sgn, y0, x1 - sgn, y1, BARK[bark][3], 1.0)
    a = outline(a, BARK[bark][0])
    # crown
    blobs = []
    n = int(w * 3.2)
    for k in range(n):
        t = k / max(1, n - 1)
        bx = W * 0.1 + t * W * 0.8 + R.uniform(-3, 3)
        by = top_h * (0.22 + 0.5 * R.random())
        r = W * R.uniform(0.13, 0.19)
        blobs.append((bx, by, r))
    for k in range(int(w * 1.3)):
        blobs.append((W * R.uniform(0.25, 0.75), top_h * R.uniform(0.12, 0.3), W * R.uniform(0.14, 0.2)))
    crown = clumps(W, H, blobs, LEAF[leaf], seed)
    a = over(a, crown)
    if vines:
        A = opaque(crown)
        for k in range(int(w * 1.6)):
            x = int(W * R.uniform(0.12, 0.88))
            ys = [y for y in range(H) if A[y, x]]
            if not ys: continue
            y = ys[-1]
            for d in range(R.randint(4, int(H * 0.25))):
                yy = y + d
                if yy >= foot - 2: break
                put(a, x, yy, LEAF[leaf][2] if d % 3 else LEAF[leaf][4])
                if d % 3 == 1: put(a, x + (1 if (x + d) % 2 else -1), yy, LEAF[leaf][3])
    return a

def broad_tree(w, h, seed, leaf, bark, crown_frac=0.66, trunk_w=0.2, lean=0.0, roots=3):
    R = random.Random(seed); W, H = w * 16, h * 16
    a = canvas(W, H); cx = W / 2 + R.uniform(-1.5, 1.5); foot = H - 3
    trunk(a, cx, foot, cx + lean * 4, H * (1 - crown_frac) + 4, W * trunk_w, W * trunk_w * 0.7, BARK[bark], seed, roots=roots)
    a = outline(a, BARK[bark][0])
    blobs = []
    for k in range(int(w * 2.4) + 2):
        blobs.append((W * R.uniform(0.18, 0.82) + lean * 3, H * crown_frac * R.uniform(0.25, 0.8), W * R.uniform(0.18, 0.26)))
    return over(a, clumps(W, H, blobs, LEAF[leaf], seed))

def mangrove(w, h, seed, leaf="mangrove", bark="mangrove"):
    """Mangrove: a rounded crown on a short trunk that splits into arched stilt roots."""
    R = random.Random(seed); W, H = w * 16, h * 16
    a = canvas(W, H); cx = W / 2; foot = H - 2
    knee = H * 0.62
    trunk(a, cx, knee + 2, cx + R.uniform(-1, 1), H * 0.35, W * 0.14, W * 0.1, BARK[bark], seed)
    for k in range(5 if w >= 4 else 4):
        t = (k / (4 if w >= 4 else 3)) - 0.5
        x1 = cx + t * W * 0.95
        # arch: out from the knee, down to the ground
        pts = [(cx + t * 3, knee), (cx + t * W * 0.55, knee - 2 + abs(t) * 3), (x1, foot)]
        for s in range(24):
            u = s / 23
            x = (1 - u) ** 2 * pts[0][0] + 2 * u * (1 - u) * pts[1][0] + u * u * pts[2][0]
            y = (1 - u) ** 2 * pts[0][1] + 2 * u * (1 - u) * pts[1][1] + u * u * pts[2][1]
            for d in (-1, 0, 1): put(a, x + d, y, BARK[bark][2 - d])
            put(a, x, y - 1, BARK[bark][3])
    a = outline(a, BARK[bark][0])
    blobs = [(W * R.uniform(0.2, 0.8), H * R.uniform(0.2, 0.42), W * R.uniform(0.18, 0.24)) for _ in range(int(w * 2.2) + 2)]
    return over(a, clumps(W, H, blobs, LEAF[leaf], seed))

def spruce(w, h, seed, snow=True, leaf="spruce"):
    """Snow-dusted spruce: stacked jagged tiers narrowing upward, a short trunk at the foot."""
    R = random.Random(seed); W, H = w * 16, h * 16
    a = canvas(W, H); cx = W / 2; foot = H - 2
    trunk(a, cx, foot, cx, foot - 7, 4, 3, BARK["spruce"], seed)
    pal = LEAF[leaf]
    tiers = h + 1
    top = 1; bottom = foot - 4
    snowc = [C("ffffff"), C("dfe9f1"), C("a9bccb")]
    for k in range(tiers):
        t0 = k / tiers; t1 = (k + 1.25) / tiers
        y0 = top + (bottom - top) * t0; y1 = top + (bottom - top) * t1
        half = (W / 2 - 1) * (0.35 + 0.65 * t1)
        for y in range(int(y0), int(y1) + 1):
            f = (y - y0) / max(1, y1 - y0)
            hw = half * (0.25 + 0.75 * f) + (hash01(y, k, seed) - 0.5) * 1.6
            for x in range(int(cx - hw), int(cx + hw) + 1):
                if not (0 <= x < W and 0 <= y < H): continue
                u = (x + 0.5 - (cx - hw)) / max(1, 2 * hw)
                tt = 0.85 - u * 0.75 + (f - 0.5) * -0.25 + (hash01(x, y, seed) - 0.5) * 0.2
                a[y, x, :3] = pick(pal[1:-1], tt, x, y); a[y, x, 3] = 255
        # jagged hem: little drooping points at the tier bottom
        for x in range(int(cx - half), int(cx + half) + 1, 2):
            put(a, x, y1 + 1, pal[1])
    a = outline(a, pal[0])
    if snow:
        A = opaque(a)
        for x in range(W):
            for y in range(1, H):
                if A[y, x] and not A[y - 1, x] and y < foot - 5 and a[y, x, 0] != pal[0][0]:
                    a[y, x, :3] = snowc[0]
                    if y + 1 < H and A[y + 1, x] and hash01(x, y, seed) < 0.55: a[y + 1, x, :3] = snowc[1]
    return a

def acacia(w, h, seed):
    """Umbrella acacia: a flat, wide two-layer canopy on a thin forked trunk whose branches reach into it."""
    R = random.Random(seed); W, H = w * 16, h * 16
    a = canvas(W, H); cx = W / 2 + R.uniform(-2, 2); foot = H - 2
    slab = H * 0.26
    fork = H * 0.55
    trunk(a, cx, foot, cx + R.uniform(-1.5, 1.5), fork, 4, 3, BARK["acacia"], seed, roots=2)
    for sgn in (-1, 1):
        line(a, cx, fork + 2, cx + sgn * W * 0.3, slab + 3, BARK["acacia"][2], 2)
        line(a, cx + sgn * W * 0.3, slab + 3, cx + sgn * W * 0.38, slab + 1, BARK["acacia"][2], 1.4)
        line(a, cx + sgn * W * 0.12, fork - 4, cx + sgn * W * 0.06, slab + 2, BARK["acacia"][3], 1.3)
    a = outline(a, BARK["acacia"][0])
    blobs = []
    n = int(w * 3.4)
    for k in range(n):
        blobs.append((W * (0.06 + 0.88 * k / max(1, n - 1)) + R.uniform(-2, 2), slab + R.uniform(-1.5, 2.5), R.uniform(5.5, 7.5)))
    for k in range(int(w * 1.8)):
        blobs.append((W * R.uniform(0.18, 0.82), slab - 3 + R.uniform(-1.5, 1), R.uniform(5, 6.5)))
    crown = clumps(W, H, blobs, LEAF["acacia"], seed)
    A = opaque(crown); ys = [y for y in range(H) if A[y].any()]
    squashed = canvas(W, H)
    if ys:
        top = ys[0]; mid = (ys[0] + ys[-1]) / 2
        for y in ys:
            ny = int(round(top + (y - top) * 0.72))
            for x in range(W):
                if A[y, x] and crown[y, x, 3] > 0: squashed[ny, x] = crown[y, x]
    return over(a, squashed)

def baobab(w, h, seed):
    """Baobab: a fat bottle trunk with a thin crown of short branches and sparse leaf clumps."""
    R = random.Random(seed); W, H = w * 16, h * 16
    a = canvas(W, H); cx = W / 2; foot = H - 2
    pal = BARK["baobab"]
    for y in range(int(H * 0.3), foot + 1):
        f = (y - H * 0.3) / (foot - H * 0.3)
        hw = W * (0.2 + 0.2 * math.sin(min(1, f * 1.2) * math.pi * 0.62)) + (1.5 if f > 0.92 else 0)
        for x in range(int(cx - hw), int(cx + hw) + 1):
            u = (x + 0.5 - (cx - hw)) / max(1, 2 * hw)
            t = 0.9 - u * 0.8 + (hash01(x, y // 3, seed) - 0.5) * 0.2
            if hash01(x, y, seed) < 0.05: t -= 0.3
            put(a, x, y, pick(pal[1:], t, x, y))
    for k in range(6):
        ang = -math.pi / 2 + (k / 5 - 0.5) * 2.2
        x0, y0 = cx + (k / 5 - 0.5) * W * 0.3, H * 0.32
        line(a, x0, y0, x0 + math.cos(ang) * W * 0.3, y0 + math.sin(ang) * H * 0.18, pal[2], 1.6)
    a = outline(a, pal[0])
    blobs = [(W * R.uniform(0.12, 0.88), H * R.uniform(0.08, 0.2), R.uniform(3.5, 5)) for _ in range(7)]
    return over(a, clumps(W, H, blobs, LEAF["savanna"], seed))

def palm(w, h, seed, lean=1):
    """Coconut palm: a ringed trunk curving up, a starburst of drooping fronds and a coconut cluster."""
    R = random.Random(seed); W, H = w * 16, h * 16
    a = canvas(W, H); foot = H - 2; bx = W / 2 - lean * 3
    tx, ty = W / 2 + lean * 4, H * 0.3
    pal = BARK["palm"]
    n = 40
    for s in range(n + 1):
        u = s / n
        x = bx + (tx - bx) * (u ** 1.6); y = foot - (foot - ty) * u
        wid = 4.2 - 1.6 * u
        for xx in range(int(x - wid / 2), int(x + wid / 2) + 1):
            uu = (xx + 0.5 - (x - wid / 2)) / wid
            c = pick(pal[1:], 0.9 - uu * 0.8, xx, int(y))
            if int(y) % 3 == 0: c = pal[1]
            put(a, xx, y, c)
    a = outline(a, pal[0])
    fr = LEAF["palm"]; fronds = canvas(W, H)
    for k in range(7):
        ang = -math.pi / 2 + (k / 6 - 0.5) * 3.6 + R.uniform(-0.15, 0.15)
        L = W * R.uniform(0.42, 0.55)
        pts = []
        for s in range(18):
            u = s / 17
            x = tx + math.cos(ang) * L * u
            y = ty + math.sin(ang) * L * u + (u ** 2) * L * 0.55
            pts.append((x, y))
        for s, (x, y) in enumerate(pts):
            put(fronds, x, y, fr[3]); put(fronds, x, y - 1, fr[4] if s % 2 else fr[3])
            if 2 < s < 16:
                ll = 2.5 * (1 - s / 17) + 1
                for d in (1, -1):
                    put(fronds, x + d * 0.4, y + ll, fr[2]); put(fronds, x + d * 0.8, y + ll * 0.6, fr[2])
    fronds = outline(fronds, fr[0])
    a = over(a, fronds)
    for dx, dy in ((-1, 2), (1, 2), (0, 3)):
        ellipse(a, tx + dx * 2, ty + dy, 1.6, 1.6, lambda x, y, nx, ny: C("5a3a1a") if ny > 0.1 else C("8a6030"))
    return a

def dead_tree(w, h, seed, bark="blight", glow=None, snow=False):
    """Twisted leafless tree (blight / badlands / tundra twins): a gnarled trunk with crooked forks."""
    R = random.Random(seed); W, H = w * 16, h * 16
    a = canvas(W, H); pal = BARK[bark] if isinstance(bark, str) else bark
    cx = W / 2; foot = H - 2
    def branch(x, y, ang, L, wd, d):
        x1 = x + math.cos(ang) * L; y1 = y + math.sin(ang) * L
        line(a, x, y, x1, y1, pal[2], wd); line(a, x - 0.6, y, x1 - 0.6, y1, pal[3], max(0.8, wd * 0.4))
        if d <= 0: return
        for s in (-1, 1):
            branch(x1, y1, ang + s * R.uniform(0.35, 0.8), L * R.uniform(0.55, 0.75), max(0.9, wd * 0.62), d - 1)
    trunk(a, cx, foot, cx + R.uniform(-2, 2), H * 0.45, W * 0.16, W * 0.1, pal, seed, roots=4)
    branch(cx, H * 0.47, -math.pi / 2 + R.uniform(-0.4, 0.4), H * 0.22, 2.4, 3)
    branch(cx, H * 0.55, -math.pi / 2 - 0.9, H * 0.18, 1.8, 2)
    branch(cx, H * 0.52, -math.pi / 2 + 0.95, H * 0.18, 1.8, 2)
    a = outline(a, pal[0])
    if glow is not None:
        A = opaque(a)
        for y in range(H):
            for x in range(W):
                if A[y, x] and hash01(x, y, seed + 9) < 0.035 and y < foot - 2: a[y, x, :3] = glow
    if snow:
        A = opaque(a)
        for y in range(1, H):
            for x in range(W):
                if A[y, x] and not A[y - 1, x] and y < foot - 3: a[y - 1, x, :3] = C("ffffff"); a[y - 1, x, 3] = 255
    return a

# ── mushrooms ────────────────────────────────────────────────────────────────────────────────────────────────────
CAPS = {
    "red": P("2a0808", "5a1414", "8e2222", "c23a2e", "e8684a", "ffb08a"),
    "blue": P("0a1430", "142a5e", "1e4494", "3068c4", "5e9ae6", "b8e0ff"),
    "purple": P("1e0a2a", "3a145a", "5a2288", "8036b4", "a860d6", "e0b0f4"),
    "gold": P("2a1a06", "5a3a0e", "8e6018", "c28e24", "e8bc44", "fff0a0"),
}
STEM = P("3a3028", "8a7c6a", "b8ab96", "d8ceba", "f2ecde")

def giant_mushroom(w, h, seed, cap="red", spots=True):
    R = random.Random(seed); W, H = w * 16, h * 16
    a = canvas(W, H); cx = W / 2; foot = H - 2
    capr = W * 0.48; capy = H * 0.36; caph = H * 0.3
    # stem
    for y in range(int(capy + 2), foot + 1):
        f = (y - capy) / (foot - capy)
        hw = W * (0.11 + 0.06 * f) + (2 if f > 0.9 else 0)
        for x in range(int(cx - hw), int(cx + hw) + 1):
            u = (x + 0.5 - (cx - hw)) / (2 * hw)
            put(a, x, y, pick(STEM[1:], 0.95 - u * 0.85 + (hash01(x, y // 2, seed) - 0.5) * 0.1, x, y))
    # gill shadow under the cap
    ellipse(a, cx, capy + caph * 0.42, capr * 0.86, caph * 0.28, lambda x, y, nx, ny: STEM[1] if ny > -0.2 else None)
    pal = CAPS[cap]
    # dome
    def dome(x, y, nx, ny):
        if ny > 0.35: return None
        t = sphere_t(nx * 0.9, ny * 0.9 - 0.1, 0.55) + (hash01(x, y, seed) - 0.5) * 0.08
        return pick(pal[1:-1], t, x, y)
    ellipse(a, cx, capy, capr, caph, dome)
    # rim: slightly curled lip
    for x in range(int(cx - capr * 0.95), int(cx + capr * 0.95) + 1):
        ny = 0.35; y = capy + caph * ny + math.sin(x * 0.7 + seed) * 0.4
        put(a, x, y, pal[2])
    if spots:
        for k in range(int(w * 2.5) + 2):
            ang = R.uniform(math.pi * 1.05, math.pi * 1.95); rr = R.uniform(0.25, 0.8)
            sx = cx + math.cos(ang) * capr * rr; sy = capy + math.sin(ang) * caph * rr * 0.9
            sr = R.uniform(1.2, 2.2)
            ellipse(a, sx, sy, sr, sr * 0.8, lambda x, y, nx, ny: C("fff6ea") if ny < 0.3 else C("d8c8b8"))
    a = outline(a, pal[0])
    return a

def small_mushrooms(seed, caps=("red", "purple")):
    R = random.Random(seed); a = canvas(16, 16)
    for k in range(3):
        cap = CAPS[caps[k % len(caps)]]
        x0 = 3 + k * 4.5 + R.uniform(-1, 1); base = 14 - (k % 2) * 2; hgt = R.randint(4, 7)
        for y in range(base - hgt + 2, base + 1):
            put(a, x0, y, STEM[3]); put(a, x0 + 1, y, STEM[2])
        cr = R.uniform(2.2, 3.2)
        ellipse(a, x0 + 0.5, base - hgt + 2, cr, cr * 0.75, lambda x, y, nx, ny, cap=cap: None if ny > 0.3 else pick(cap[1:-1], sphere_t(nx, ny - 0.1, 0.55), x, y))
        put(a, x0 - 0.5, base - hgt + 1, C("fff6ea"))
    return outline(a, C("1a1020"))

def glow_caps(seed, col="7af0e0"):
    R = random.Random(seed); a = canvas(16, 16); c = C(col); d = c * 0.55
    for k in range(4):
        x = R.randint(2, 13); y = R.randint(6, 14)
        put(a, x, y, STEM[2]); put(a, x, y - 1, c); put(a, x - 1, y - 1, d); put(a, x + 1, y - 1, d); put(a, x, y - 2, C("eaffff"))
    return a

def fairy_ring(seed):
    """3×3 ring of tiny white-capped mushrooms on the moss (walkable decal)."""
    R = random.Random(seed); a = canvas(48, 48)
    for k in range(18):
        ang = k / 18 * math.tau + R.uniform(-0.08, 0.08)
        x = 24 + math.cos(ang) * 16 + R.uniform(-1, 1); y = 25 + math.sin(ang) * 13 + R.uniform(-1, 1)
        put(a, x, y + 1, STEM[2]); put(a, x, y, C("f4ece0")); put(a, x - 1, y, C("c8b8a8")); put(a, x + 1, y, C("fffaf0")); put(a, x, y - 1, C("ffffff"))
    return a

# ── crystals ─────────────────────────────────────────────────────────────────────────────────────────────────────
GEM = {
    "violet": P("1e0a36", "4a1c7a", "7a3cb8", "a86ae0", "d4a8f8", "ffffff"),
    "cyan": P("062a3a", "0e5a78", "1e90b4", "4ec4e0", "a0ecfa", "ffffff"),
    "pink": P("3a0a24", "7a1c4e", "b83c7a", "e06aa6", "f8a8d0", "ffffff"),
    "clear": P("26304a", "4e6284", "8298bc", "b4c6e2", "dce8f8", "ffffff"),
    "ice": P("142a44", "2e5a82", "5890bc", "8cc0e2", "c4e4f8", "ffffff"),
    "blood": P("2a060e", "5e0e1e", "961a2e", "c8303e", "ee6a6a", "ffc8c8"),
}

def crystal_prism(a, bx, by, height, width, lean, pal):
    """One pointed hexagonal prism standing at (bx, by): lit left face, dark right face, bright tip."""
    tip = (bx + lean * height * 0.35, by - height)
    hw = width / 2
    L = [(bx - hw, by), (bx - hw + lean * height * 0.3, by - height * 0.72), tip, (bx + lean * height * 0.33, by - height * 0.7), (bx, by + 1)]
    Rr = [(bx, by + 1), (bx + lean * height * 0.33, by - height * 0.7), tip, (bx + hw + lean * height * 0.3, by - height * 0.72), (bx + hw, by)]
    polygon(a, L, lambda x, y: pal[4] if (x + y) % 5 else pal[5])
    polygon(a, Rr, lambda x, y: pal[2] if (x * 3 + y) % 7 else pal[3])
    line(a, bx + lean * height * 0.33, by - height * 0.7, tip[0], tip[1], pal[5], 1)
    line(a, bx, by, bx + lean * height * 0.33, by - height * 0.7, pal[3], 1)

def crystals(w, h, seed, gem="violet", n=3, big=1.0, base_rock=True):
    R = random.Random(seed); W, H = w * 16, h * 16
    a = canvas(W, H); foot = H - 3
    pal = GEM[gem]
    items = []
    for k in range(n):
        t = (k + 0.5) / n
        hgt = (H - 5) * big * (1.0 if k == n // 2 else R.uniform(0.45, 0.7))
        items.append((W * (0.18 + 0.64 * t) + R.uniform(-1.5, 1.5), foot + R.uniform(-1, 1), hgt, max(3.2, W * 0.16 * (1.2 if k == n // 2 else 0.9)), (t - 0.5) * 0.9 + R.uniform(-0.1, 0.1)))
    items.sort(key=lambda i: -i[2])
    if base_rock:
        rk = rock(W, H, W / 2, foot - 0.5, W * 0.36, 3.2, P("1c1a24", "34303e", "4a4656", "625e70", "7e7a8c", "a09cae"), seed, cracks=False)
        a = over(a, rk)
    for bx, by, hgt, wd, lean in items:
        crystal_prism(a, bx, by, hgt, wd, lean, pal)
    a = outline(a, pal[0])
    # sparkle
    A = opaque(a)
    for _ in range(2 + w):
        x, y = R.randint(1, W - 2), R.randint(1, H - 4)
        if A[y, x]: put(a, x, y, C("ffffff"))
    return a

def shards(seed, gem="violet"):
    R = random.Random(seed); a = canvas(16, 16); pal = GEM[gem]
    for k in range(4):
        x = R.randint(2, 13); y = R.randint(5, 14); hh = R.randint(2, 4)
        for d in range(hh):
            put(a, x, y - d, pal[4] if d < hh - 1 else pal[5]); put(a, x + 1, y - d + 1, pal[2])
    return outline(a, pal[0])

# ── ground pieces ────────────────────────────────────────────────────────────────────────────────────────────────
STONE = {
    "grey": P("1a1a1e", "3a3a40", "56565e", "74747c", "9696a0", "bcbcc6"),
    "red": P("2a0e06", "5a2210", "86361c", "b0502c", "d27a4e", "eeaa7e"),
    "lichen": P("1e1e18", "3c3c34", "5a5a4e", "78786a", "9a9a88", "c0c0ac"),
    "sand": P("3a2e1e", "6e5a3e", "9a8260", "c0a882", "dcc8a4", "f4e6c8"),
    "sky": P("22242e", "4a4e5e", "6e7486", "949aac", "b8bece", "e4e8f2"),
    "dark": P("0c080e", "1e1622", "302636", "46384e", "5e4e68", "806e8e"),
}
def boulder(w, h, seed, stone="grey", top=None, scale=1.0):
    W, H = w * 16, h * 16
    return rock(W, H, W / 2, H - 5.5 * scale - (H - 16) * 0.35, W * 0.4 * scale, (5 + (H - 16) * 0.32) * scale, STONE[stone], seed, top=top)

def fern(seed, leaf="jungle", big=False):
    """Fern clump: fronds arching out from the foot, leaflets on both sides (fills most of the cell)."""
    R = random.Random(seed); W = 32 if big else 16; H = 32 if big else 16
    a = canvas(W, H); pal = LEAF[leaf]; cx = W / 2; foot = H - 1.5
    n = 9 if big else 7
    fronds = sorted(range(n), key=lambda k: abs(k - (n - 1) / 2), reverse=True)
    for k in fronds:
        ang = -math.pi / 2 + (k / (n - 1) - 0.5) * 2.9 + R.uniform(-0.1, 0.1)
        L = H * (1.0 if big else 1.02) * R.uniform(0.85, 1) * (1 - abs(k / (n - 1) - 0.5) * 0.5)
        for s_ in range(16):
            u = s_ / 15
            x = cx + math.cos(ang) * L * u; y = foot + math.sin(ang) * L * u + u * u * L * 0.45
            put(a, x, y, pal[2])
            w2 = (1 - u) * (2.6 if big else 1.8) + 0.6
            for d in (-1, 1):
                for q in (0.6, 1.0):
                    xx = x + d * w2 * q * abs(math.sin(ang)) - (0.4 if d < 0 else 0); yy = y + d * w2 * q * abs(math.cos(ang)) * 0.5 + 0.4
                    put(a, xx, yy, pal[4] if (d < 0 and q > 0.9) else pal[3])
    a = outline(a, pal[0])
    return a

def broadleaf_plant(seed, leaf="jungle2"):
    """2×2 banana / elephant-ear plant: big paddle leaves on short stalks, fanned from the foot."""
    R = random.Random(seed); a = canvas(32, 32); pal = LEAF[leaf]; cx, foot = 16, 30
    for k in sorted(range(7), key=lambda k: abs(k - 3), reverse=True):
        ang = -math.pi / 2 + (k / 6 - 0.5) * 2.7 + R.uniform(-0.08, 0.08)
        L = R.uniform(15, 18) * (1 - abs(k - 3) * 0.06)
        ex, ey = cx + math.cos(ang) * L, foot - 3 + math.sin(ang) * L + 2
        mx, my = cx + math.cos(ang) * L * 0.55, foot - 3 + math.sin(ang) * L * 0.55
        ww = 4.6
        nx, ny = -math.sin(ang), math.cos(ang)
        pts = [(cx + math.cos(ang) * 3, foot - 3 + math.sin(ang) * 3), (mx + nx * ww, my + ny * ww), (ex, ey), (mx - nx * ww, my - ny * ww)]
        polygon(a, pts, lambda x, y, k=k: pick(pal[2:-1], 0.3 + 0.45 * hash01(x // 2, y // 3, seed + k) + (0.2 if (x - cx) * nx + (y - foot) * ny < 0 else 0), x, y))
        line(a, cx, foot - 3, ex, ey, pal[4], 1)
    for y in range(foot - 6, foot + 1):
        put(a, cx, y, pal[2]); put(a, cx - 1, y, pal[3])
    return outline(a, pal[0])

def flowers(seed, cols=("e84a5a", "ffd86a"), n=4):
    R = random.Random(seed); a = canvas(16, 16)
    for k in range(n):
        x, y = R.randint(2, 13), R.randint(4, 13)
        c = C(cols[k % len(cols)])
        put(a, x, y + 1, C("2e6a2a")); put(a, x - 1, y + 1, C("3e8a36"))
        for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1)): put(a, x + dx, y + dy, c)
        put(a, x, y, C("fff4b0"))
    return a

def reeds(seed, cattail=True, leaf="mangrove"):
    R = random.Random(seed); a = canvas(16, 16); pal = LEAF[leaf]
    for k in range(6):
        x = 2 + k * 2.3 + R.uniform(-0.6, 0.6); top = R.randint(1, 6); lean = R.uniform(-0.25, 0.25)
        for y in range(top, 15):
            xx = x + lean * (15 - y) * 0.3
            put(a, xx, y, pal[3] if k % 2 else pal[4])
        if cattail and k % 2 == 0:
            for y in range(top, top + 3): put(a, x + lean * (15 - top) * 0.3, y, C("6a3e1e")); put(a, x + 1 + lean * (15 - top) * 0.3, y, C("4a2a12"))
    return outline(a, pal[0])

def lily(seed, flower=True):
    R = random.Random(seed); a = canvas(16, 16)
    pad = P("0e2a10", "1e4a1a", "2e6a24", "4a8e30", "76b44a", "b0de7a")
    for k in range(2 + (seed % 2)):
        cx, cy, r = R.uniform(4, 12), R.uniform(5, 12), R.uniform(2.5, 3.8)
        notch = R.uniform(0, 6.28)
        def f(x, y, nx, ny, notch=notch):
            ang = math.atan2(ny, nx)
            if abs((ang - notch + math.pi) % math.tau - math.pi) < 0.35: return None
            return pick(pad[2:-1], sphere_t(nx, ny, 0.5), x, y)
        ellipse(a, cx, cy, r, r * 0.8, f)
    a = outline(a, pad[1])
    if flower:
        x, y = R.randint(5, 10), R.randint(5, 9)
        for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1), (-1, -1), (1, -1)): put(a, x + dx, y + dy, C("f4a0c8"))
        put(a, x, y, C("ffe890"))
    return a

def coral(seed, cols=("e86a8a", "ff9a7a"), big=False):
    R = random.Random(seed); W = 32 if big else 16; a = canvas(W, W)
    for k in range(3 if big else 2):
        col = C(cols[k % len(cols)]); dk = col * 0.6; lt = np.minimum(255, col * 1.25)
        bx = W * (0.25 + 0.5 * (k / max(1, (2 if big else 1)))) + R.uniform(-2, 2); by = W - 2
        def br(x, y, ang, L, d):
            x1 = x + math.cos(ang) * L; y1 = y + math.sin(ang) * L
            line(a, x, y, x1, y1, col, 1.6 if d > 1 else 1.1); line(a, x - 0.5, y, x1 - 0.5, y1, lt, 0.8)
            put(a, x1, y1, lt)
            if d > 0:
                for s in (-1, 1): br(x1, y1, ang + s * R.uniform(0.35, 0.7), L * 0.7, d - 1)
        br(bx, by, -math.pi / 2 + R.uniform(-0.3, 0.3), W * 0.26, 3 if big else 2)
    a = outline(a, C("3a1a26"))
    return a

def cloud(w, h, seed):
    R = random.Random(seed); W, H = w * 16, h * 16
    a = canvas(W, H)
    pal = [C("7e9cc8"), C("a8c0e0"), C("cfdff2"), C("eaf2fb"), C("ffffff")]
    blobs = []
    n = w * 3
    for k in range(n):
        blobs.append((W * (0.15 + 0.7 * k / max(1, n - 1)) + R.uniform(-2, 2), H * 0.55 + R.uniform(-3, 2) - (H * 0.12 if 0 < k < n - 1 else 0), min(H * 0.42, R.uniform(4.5, 7.5))))
    for bx, by, r in sorted(blobs, key=lambda b: b[1]):
        ellipse(a, bx, by, r, r * 0.8, lambda x, y, nx, ny: pick(pal[1:], sphere_t(nx, ny, 0.62) + 0.1, x, y))
    # flat soft underside
    A = opaque(a)
    for x in range(W):
        ys = [y for y in range(H) if A[y, x]]
        if ys:
            put(a, x, ys[-1], pal[1])
    return outline(a, pal[0])

def float_rock(w, h, seed, grass=True):
    """A small floating islet: grassy top, a rocky underside tapering to a point, dangling roots."""
    R = random.Random(seed); W, H = w * 16, h * 16
    a = canvas(W, H); cx = W / 2; top = H * 0.3
    st = STONE["sky"]
    for y in range(int(top), H - 1):
        f = (y - top) / (H - 1 - top)
        hw = W * 0.42 * (1 - f) ** 0.8 + (hash01(y, 1, seed) - 0.5)
        for x in range(int(cx - hw), int(cx + hw) + 1):
            u = (x + 0.5 - (cx - hw)) / max(1, 2 * hw)
            put(a, x, y, pick(st[1:-1], 0.8 - u * 0.6 - f * 0.2, x, y))
    if grass:
        gp = LEAF["sky"]
        for x in range(int(cx - W * 0.44), int(cx + W * 0.44) + 1):
            for d in range(3):
                put(a, x, top - 1 + d, gp[4] if d == 0 else gp[3])
            if hash01(x, 2, seed) < 0.3: put(a, x, top - 2, gp[4])
    a = outline(a, st[0])
    for k in range(w * 2):
        x = int(cx + R.uniform(-W * 0.25, W * 0.25))
        ys = [y for y in range(H) if opaque(a)[y, x]]
        if ys:
            for d in range(R.randint(1, 3)): put(a, x, ys[-1] + d, C("6a4a2a"))
    return a

def thorns(seed, w=1):
    """Bramble of black thorny stems curling up from the ground, pale thorn tips (blight)."""
    R = random.Random(seed); W = w * 16; a = canvas(W, 16)
    pal = P("0a060c", "241a2a", "3e2e46", "5e4a68", "9a7aa8")
    for k in range(7 * w):
        x, y = R.uniform(2, W - 2), 15.5
        ang = -math.pi / 2 + R.uniform(-1.0, 1.0)
        for s_ in range(R.randint(9, 14)):
            nx = x + math.cos(ang) * 1.0; ny = y + math.sin(ang) * 1.0
            put(a, nx, ny, pal[2]); put(a, nx + 0.8, ny, pal[1]); put(a, nx - 0.8, ny, pal[3])
            if s_ % 3 == 2: put(a, nx + (1.6 if math.cos(ang) >= 0 else -1.6), ny - 1, pal[4])
            ang += R.uniform(-0.5, 0.5); x, y = nx, ny
            if y < 3: break
    return outline(a, pal[0])

def obelisk(seed, rune="c060ff"):
    """1×3 blackened stone pillar with a glowing rune (the dark lord's mark)."""
    a = canvas(16, 48); st = STONE["dark"]; g = C(rune)
    polygon(a, [(4, 46), (5, 8), (8, 2), (11, 8), (12, 46)], lambda x, y: pick(st[1:-1], 0.85 - (x - 4) / 8 * 0.7, x, y))
    for y, dx in ((16, 0), (17, 0), (18, -1), (18, 1), (19, 0), (22, 0), (23, -1), (23, 1), (24, 0), (28, 0), (29, 0), (30, 0)):
        put(a, 8 + dx, y, g)
    put(a, 8, 20, np.minimum(255, g * 1.3))
    for y in range(44, 48):
        for x in range(2, 14): put(a, x, y, pick(st[1:-1], 0.6 - (x - 2) / 12 * 0.4, x, y))
    return outline(a, st[0])

def vent(seed, smoke=("b080d8", "7a50a0"), pool=("5a1a7a", "c060ff")):
    """1×2: a vent hole (lower) with a curl of coloured miasma (upper)."""
    R = random.Random(seed); a = canvas(16, 32)
    ellipse(a, 8, 26, 5.5, 3.2, lambda x, y, nx, ny: C(pool[1]) if nx * nx + ny * ny < 0.35 else C(pool[0]) if ny > -0.3 else C("2a1832"))
    for k in range(10):
        y = 22 - k * 1.8; x = 8 + math.sin(k * 0.9 + seed) * 2.2
        ellipse(a, x, y, 2.2 - k * 0.1, 1.6, lambda xx, yy, nx, ny: C(smoke[0]) if ny < 0 else C(smoke[1]))
    return a

def cairn(seed, stone="lichen", h=2):
    R = random.Random(seed); a = canvas(16, 16 * h); st = STONE[stone]
    y = 16 * h - 2
    for k, rw in enumerate((6.5, 5.5, 4.5, 3.6, 2.8)[: 3 + h]):
        rh = R.uniform(2.2, 3.0)
        ellipse(a, 8 + R.uniform(-0.8, 0.8), y - rh, rw, rh, lambda x, yy, nx, ny: pick(st[1:-1], sphere_t(nx, ny, 0.55), x, yy))
        y -= rh * 1.7
    return outline(a, st[0])

def stump(seed):
    a = canvas(16, 16); pal = BARK["spruce"]
    for y in range(7, 15):
        for x in range(3, 13):
            put(a, x, y, pick(pal[1:], 0.9 - (x - 3) / 10 * 0.8, x, y))
    ellipse(a, 8, 7, 5, 2.2, lambda x, y, nx, ny: C("c8a070") if (nx * nx + ny * ny) % 0.3 > 0.12 else C("9a7446"))
    ellipse(a, 8, 5.5, 5, 1.5, lambda x, y, nx, ny: C("ffffff") if ny < 0.2 else None)
    return outline(a, pal[0])

def log(w, seed, snow=True, moss=None):
    a = canvas(w * 16, 16); pal = BARK["spruce"]
    for y in range(5, 14):
        for x in range(2, w * 16 - 4):
            u = (y - 5) / 9
            put(a, x, y, pick(pal[1:], 0.9 - u * 0.8 + (hash01(x // 3, y, seed) - 0.5) * 0.15, x, y))
    ellipse(a, w * 16 - 4, 9.5, 2.5, 4.5, lambda x, y, nx, ny: C("c8a070") if nx * nx + ny * ny < 0.5 else C("8a6440"))
    if snow:
        for x in range(2, w * 16 - 5): put(a, x, 5, C("ffffff")); put(a, x, 6, C("dfe9f1") if x % 3 else C("ffffff"))
    if moss is not None:
        for x in range(2, w * 16 - 5):
            if hash01(x, 5, seed) < 0.6: put(a, x, 5, moss); put(a, x, 6, moss * 0.8)
    return outline(a, pal[0])

def termite_mound(seed):
    a = canvas(16, 32); pal = P("2a1a0c", "5a3a1c", "86582c", "aa7a44", "cca068", "e8c898")
    polygon(a, [(2, 31), (4, 18), (6, 6), (8, 2), (10, 8), (12, 20), (14, 31)], lambda x, y: pick(pal[1:-1], 0.85 - (x - 2) / 12 * 0.75 + (hash01(x, y // 2, seed) - 0.5) * 0.2, x, y))
    for y in (12, 20, 26): put(a, 7, y, pal[1]); put(a, 8, y, pal[1])
    return outline(a, pal[0])

def idol(seed):
    """2×3 moss-grown stone head of a forgotten jungle god."""
    a = canvas(32, 48); st = STONE["grey"]; moss = LEAF["jungle"]
    polygon(a, [(4, 46), (5, 10), (10, 3), (22, 3), (27, 10), (28, 46)], lambda x, y: pick(st[1:-1], 0.85 - (x - 4) / 24 * 0.7 + (hash01(x // 2, y // 2, seed) - 0.5) * 0.15, x, y))
    for (x0, y0, x1, y1) in ((9, 16, 13, 18), (19, 16, 23, 18)):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): put(a, x, y, st[1])
    for y in range(26, 29):
        for x in range(10, 23): put(a, x, y, st[1])
    for x in range(8, 25, 2): put(a, x, 30, st[4])
    A = opaque(a)
    for y in range(48):
        for x in range(32):
            if A[y, x] and (hash01(x // 2, y // 3, seed + 5) < 0.18 or (y < 8 and hash01(x, y, seed) < 0.5)): a[y, x, :3] = moss[3] if (x + y) % 3 else moss[4]
    return outline(a, st[0])

def vine_curtain(seed, leaf="jungle", flowers=True):
    """1×2 vines hanging down a cliff face (drawn over the cliff, upper layer)."""
    R = random.Random(seed); a = canvas(16, 32); pal = LEAF[leaf]
    for k in range(3):
        x = 3 + k * 5 + R.uniform(-1, 1); L = R.randint(18, 30)
        for y in range(0, L):
            xx = x + math.sin(y * 0.35 + k) * 1.2
            put(a, xx, y, pal[2])
            if y % 3 == 0: put(a, xx + (1 if (y // 3) % 2 else -1), y, pal[4]); put(a, xx + (1 if (y // 3) % 2 else -1), y + 1, pal[3])
        if flowers and k == 1: put(a, x, L - 2, C("f06a9a")); put(a, x + 1, L - 3, C("ffd0e0"))
    return outline(a, pal[0])

def vine_arch(seed):
    """3×3 arch: two vine-wrapped stone posts and a garland of leaves and flowers across the top (walk under)."""
    R = random.Random(seed); a = canvas(48, 48); st = STONE["grey"]; pal = LEAF["jungle"]
    for x0 in (3, 38):
        for y in range(8, 46):
            for x in range(x0, x0 + 7):
                put(a, x, y, pick(st[1:-1], 0.85 - (x - x0) / 7 * 0.7 + (hash01(x, y // 3, seed) - 0.5) * 0.12, x, y))
        for y in range(44, 48):
            for x in range(x0 - 1, x0 + 8): put(a, x, y, st[2])
    a = outline(a, st[0])
    garland = canvas(48, 48)
    blobs = [(4 + k * 4, 8 + 3.5 * math.sin(k / 10 * math.pi) * -1 + 4, 3.6) for k in range(11)]
    garland = clumps(48, 48, [(x, y, r) for x, y, r in blobs] + [(6, 16, 3), (41, 18, 3), (7, 26, 2.6), (40, 28, 2.6)], pal, seed)
    a = over(a, garland)
    for k in range(6):
        x, y = R.randint(4, 44), R.randint(4, 14)
        if opaque(a)[y, x]: put(a, x, y, C("f06a9a")); put(a, x + 1, y, C("ffd0e0"))
    return a

def shell(seed):
    a = canvas(16, 16); R = random.Random(seed)
    x, y = R.randint(5, 10), R.randint(6, 11)
    ellipse(a, x, y, 3, 2.4, lambda xx, yy, nx, ny: C("f4d2c0") if int((math.atan2(ny, nx) + 3.2) * 2.5) % 2 else C("e0a898"))
    return outline(a, C("8a5a4a"))

def starfish(seed):
    a = canvas(16, 16); c = C("f07848"); d = C("c04a2a")
    for k in range(5):
        ang = -math.pi / 2 + k * math.tau / 5
        line(a, 8, 8, 8 + math.cos(ang) * 5, 8 + math.sin(ang) * 5, c, 1.6)
    put(a, 8, 8, C("ffb080"))
    return outline(a, d)

def driftwood(seed):
    a = canvas(32, 16); pal = P("2a2218", "6a5a44", "948066", "b8a488", "dccab0")
    line(a, 4, 11, 27, 8, pal[2], 3); line(a, 4, 10, 27, 7, pal[3], 1); line(a, 18, 9, 23, 3, pal[2], 1.5)
    return outline(a, pal[0])

def wind_crystal(seed):
    a = canvas(16, 32)
    crystal_prism(a, 8, 27, 20, 7, 0.0, GEM["cyan"])
    ellipse(a, 8, 28, 5, 2.2, lambda x, y, nx, ny: C("8a8e9c") if ny < 0 else C("5a5e6c"))
    a = outline(a, GEM["cyan"][0])
    for y in (6, 12, 18): put(a, 3, y, C("eaffff")); put(a, 13, y + 3, C("eaffff"))
    return a

def sagebrush(seed, leaf="savanna"):
    R = random.Random(seed); a = canvas(16, 16); pal = LEAF[leaf]
    blobs = [(R.uniform(4, 12), R.uniform(8, 11), R.uniform(3, 4.2)) for _ in range(4)]
    return clumps(16, 16, blobs, pal, seed, texture=0.35)

def bush(seed, leaf, n=4, size=(3.2, 4.4)):
    R = random.Random(seed)
    blobs = [(R.uniform(4.5, 11.5), R.uniform(7.5, 11), R.uniform(*size)) for _ in range(n)]
    return clumps(16, 16, blobs, LEAF[leaf], seed)

def hibiscus(seed):
    a = bush(seed, "tropical")
    R = random.Random(seed)
    A = opaque(a)
    for _ in range(3):
        x, y = R.randint(4, 11), R.randint(5, 11)
        if A[y, x]:
            for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1)): put(a, x + dx, y + dy, C("f04a6a"))
            put(a, x, y, C("ffe070"))
    return a

def cave_mouth(face, stone="grey"):
    """2×2 cave mouth cut into a cliff face: the sheet's own cliff texture (face, 16×16×4) around a dark arch with a
    rim of framing stones, a keystone and a floor line. Drawn over the cliff face (upper, solid)."""
    a = canvas(32, 32)
    for y in range(32):
        for x in range(32): a[y, x] = face[y % 16, x % 16]
    st = STONE[stone]
    cx, top, bot = 16.0, 7.0, 32.0
    def inside(x, y, grow=0.0):
        ry = bot - top + grow; rx = 10.5 + grow
        return ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - bot) / ry) ** 2 < 1
    # framing stones: a ring 2.5 px outside the opening
    for y in range(32):
        for x in range(32):
            if inside(x, y, 3.0) and not inside(x, y):
                lit = (x < cx and y < 20)
                n = hash01(x // 3, y // 3, 5)
                c = st[4] if lit and n > 0.4 else st[3] if n > 0.35 else st[2]
                if (x // 3 + y // 3) % 3 == 0: c = st[1]
                a[y, x, :3] = c
    for y in range(32):
        for x in range(32):
            if inside(x, y):
                d = min(1.0, ((x + 0.5 - cx) / 10.5) ** 2 + ((y + 0.5 - bot) / (bot - top)) ** 2)
                a[y, x, :3] = C("0a0708") if d < 0.55 else C("161012") if d < 0.8 else C("241a1c")
    # keystone
    for y in range(int(top) - 3, int(top) + 1):
        for x in range(14, 19): a[y, x, :3] = st[4] if x < 16 else st[3]
    for x in range(13, 20): a[int(top) - 4, x, :3] = st[1]
    # floor line and a few pebbles at the threshold
    for x in range(7, 26):
        if inside(x, 30): a[31, x, :3] = C("2e2420"); a[30, x, :3] = C("1c1416")
    a[..., 3] = 255
    return a
