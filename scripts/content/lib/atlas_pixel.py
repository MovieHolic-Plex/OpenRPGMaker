# Pixel helpers for the atlas biome art (lib/atlas_art.py): deterministic, alpha 0/255, 1px dark outline, lit from the
# upper left — the forest_harmony look (clumped leaves with a bright rim, cylinder-shaded trunks, faceted stone).
import math, random
import numpy as np

def C(s): return np.array([int(s[i:i + 2], 16) for i in (0, 2, 4)], np.float32)

LIGHT = np.array([-0.62, -0.78])  # from the upper left

def canvas(w, h): return np.zeros((h, w, 4), np.float32)

def put(a, x, y, c):
    x, y = int(x), int(y)
    if 0 <= y < a.shape[0] and 0 <= x < a.shape[1]:
        a[y, x, :3] = c; a[y, x, 3] = 255

def opaque(a): return a[..., 3] > 127

def bayer(x, y):
    B = ((0, 8, 2, 10), (12, 4, 14, 6), (3, 11, 1, 9), (15, 7, 13, 5))
    return (B[y % 4][x % 4] + 0.5) / 16

def hash01(x, y, s=0):
    n = (x * 374761393 + y * 668265263 + s * 2246822519) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFFFF) / 0xFFFFFF

def pick(pal, t, x=0, y=0, dither=True):
    """pal: list of colours dark→light; t in [0,1] (ordered dither between neighbours)."""
    t = min(0.999, max(0.0, t)) * (len(pal) - 1)
    k = int(t); f = t - k
    if dither and f > bayer(x, y) and k + 1 < len(pal): k += 1
    elif not dither and f > 0.5 and k + 1 < len(pal): k += 1
    return pal[k]

def outline(a, col, where=None, diag=False):
    """1px outline on transparent pixels touching opaque ones (optionally only where `where` is True)."""
    A = opaque(a); H, W = A.shape
    out = a.copy()
    for y in range(H):
        for x in range(W):
            if A[y, x]: continue
            nb = [(x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)] + ([(x - 1, y - 1), (x + 1, y - 1), (x - 1, y + 1), (x + 1, y + 1)] if diag else [])
            if any(0 <= xx < W and 0 <= yy < H and A[yy, xx] and (where is None or where[yy, xx]) for xx, yy in nb):
                out[y, x, :3] = col; out[y, x, 3] = 255
    return out

def darken_edge(a, col, sides="br"):
    """Opaque pixels on the lower/right silhouette edge get the dark colour (self-shadow rim)."""
    A = opaque(a); H, W = A.shape; out = a.copy()
    for y in range(H):
        for x in range(W):
            if not A[y, x]: continue
            edge = (("b" in sides and (y + 1 >= H or not A[y + 1, x])) or ("r" in sides and (x + 1 >= W or not A[y, x + 1]))
                    or ("t" in sides and (y == 0 or not A[y - 1, x])) or ("l" in sides and (x == 0 or not A[y, x - 1])))
            if edge: out[y, x, :3] = col
    return out

def over(dst, src, ox=0, oy=0):
    """Paste src (opaque pixels) over dst at (ox, oy)."""
    h, w = src.shape[:2]
    for y in range(h):
        for x in range(w):
            if src[y, x, 3] > 127 and 0 <= y + oy < dst.shape[0] and 0 <= x + ox < dst.shape[1]:
                dst[y + oy, x + ox] = src[y, x]
    return dst

# ── foliage: overlapping leaf clumps, each shaded like a lumpy sphere, darker where a clump sits under another ──
def clumps(w, h, blobs, pal, seed=0, rim=None, texture=0.22, highlight=True):
    """blobs: [(cx, cy, r)] drawn back (top) to front (bottom). pal: [outline, deep, shade, mid, light, highlight]."""
    R = random.Random(seed)
    a = canvas(w, h); owner = np.full((h, w), -1)
    # keep every clump inside the canvas (a crown must never be cut flat by the tile edge)
    blobs = [(min(max(cx, r + 1.5), w - r - 1.5), max(cy, r * 1.12 + 1.5), r) for cx, cy, r in blobs]
    order = sorted(range(len(blobs)), key=lambda k: blobs[k][1])
    for k in order:
        cx, cy, r = blobs[k]
        ph = R.uniform(0, 6.28); lobes = R.choice((5, 6, 7))
        for y in range(max(0, int(cy - r - 2)), min(h, int(cy + r + 3))):
            for x in range(max(0, int(cx - r - 2)), min(w, int(cx + r + 3))):
                dx, dy = x + 0.5 - cx, y + 0.5 - cy
                ang = math.atan2(dy, dx)
                rr = r * (1 + 0.1 * math.sin(ang * lobes + ph) + 0.06 * (hash01(x, y, seed + k) - 0.5))
                d = math.hypot(dx, dy * 1.08)
                if d > rr: continue
                nx, ny = dx / rr, dy / rr; nz = math.sqrt(max(0.0, 1 - nx * nx - ny * ny))
                lit = -(nx * LIGHT[0] + ny * LIGHT[1]) * 0.55 + nz * 0.45
                tex = (hash01(x // 2, y // 2, seed * 7 + k) - 0.5) * texture + (hash01(x, y, seed) - 0.5) * texture * 0.5
                t = 0.18 + 0.72 * max(0.0, min(1.0, 0.5 + lit * 0.75 + tex))
                if d > rr - 1.2 and (dx > 0 or dy > 0.5 * rr): t = min(t, 0.3)   # lower-right rim sinks
                a[y, x, :3] = pick(pal[1:-1] if highlight else pal[1:], t, x, y); a[y, x, 3] = 255; owner[y, x] = k
    if highlight:
        # leaf glints: small bright dabs on the lit upper-left of each clump
        for k in order:
            cx, cy, r = blobs[k]
            for _ in range(max(1, int(r * 0.9))):
                ang = R.uniform(3.4, 4.9); dd = R.uniform(0.25, 0.7) * r
                x, y = int(cx + math.cos(ang) * dd), int(cy + math.sin(ang) * dd)
                if 0 <= x < w and 0 <= y < h and owner[y, x] == k:
                    a[y, x, :3] = pal[-1]
                    if x + 1 < w and owner[y, x + 1] == k and R.random() < 0.6: a[y, x + 1, :3] = pal[-2]
    # clump seams: where a front clump meets a back one, a dark line on the back clump
    for y in range(h):
        for x in range(w):
            k = owner[y, x]
            if k < 0: continue
            for xx, yy in ((x, y + 1), (x + 1, y)):
                if 0 <= xx < w and 0 <= yy < h and owner[yy, xx] >= 0 and owner[yy, xx] != k and blobs[owner[yy, xx]][1] > blobs[k][1] + 0.5:
                    a[y, x, :3] = pal[1]
    return outline(a, rim if rim is not None else pal[0])

def trunk(a, x0, y0, x1, y1, w0, w1, pal, seed=0, roots=0, outline_col=None):
    """Tapered trunk from (x0,y0) bottom to (x1,y1) top, cylinder shading (light left, dark right), bark streaks.
    pal: [outline, dark, mid, light, highlight]. roots: flare width added at the foot."""
    R = random.Random(seed)
    steps = int(max(abs(y1 - y0), abs(x1 - x0)) * 2) + 1
    mask = np.zeros(a.shape[:2], bool); u = np.zeros(a.shape[:2], np.float32)
    for s in range(steps + 1):
        t = s / steps
        cx = x0 + (x1 - x0) * t; cy = y0 + (y1 - y0) * t
        wid = w0 + (w1 - w0) * t + (roots * max(0.0, 1 - t * 5) ** 2)
        for xx in range(int(cx - wid / 2 - 1), int(cx + wid / 2 + 2)):
            yy = int(cy)
            if 0 <= yy < a.shape[0] and 0 <= xx < a.shape[1] and abs(xx + 0.5 - cx) <= wid / 2:
                mask[yy, xx] = True; u[yy, xx] = (xx + 0.5 - (cx - wid / 2)) / max(1.0, wid)
    for yy in range(a.shape[0]):
        for xx in range(a.shape[1]):
            if not mask[yy, xx]: continue
            uu = u[yy, xx]
            t = 0.85 - uu * 0.8 + (hash01(xx, yy // 3, seed) - 0.5) * 0.25
            if hash01(xx, yy, seed + 3) < 0.12: t -= 0.25
            a[yy, xx, :3] = pick(pal[1:], t, xx, yy); a[yy, xx, 3] = 255
    return mask

def line(a, x0, y0, x1, y1, col, w=1.0):
    n = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
    for s in range(n + 1):
        t = s / n; x = x0 + (x1 - x0) * t; y = y0 + (y1 - y0) * t
        for yy in range(int(y - w / 2), int(y + w / 2) + 1):
            for xx in range(int(x - w / 2), int(x + w / 2) + 1):
                if (xx + 0.5 - x) ** 2 + (yy + 0.5 - y) ** 2 <= max(0.3, (w / 2) ** 2): put(a, xx, yy, col)

def ellipse(a, cx, cy, rx, ry, fn):
    """Call fn(x, y, nx, ny) for every pixel inside the ellipse; fn returns a colour or None."""
    for y in range(max(0, int(cy - ry - 1)), min(a.shape[0], int(cy + ry + 2))):
        for x in range(max(0, int(cx - rx - 1)), min(a.shape[1], int(cx + rx + 2))):
            nx, ny = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
            if nx * nx + ny * ny <= 1:
                c = fn(x, y, nx, ny)
                if c is not None: put(a, x, y, c)

def sphere_t(nx, ny, amb=0.5):
    nz = math.sqrt(max(0.0, 1 - nx * nx - ny * ny))
    return max(0.0, min(1.0, amb + (-(nx * LIGHT[0] + ny * LIGHT[1])) * 0.45 + nz * 0.3 - 0.15))

def polygon(a, pts, fn):
    """Fill polygon pts [(x,y)] calling fn(x, y) -> colour."""
    ys = [p[1] for p in pts]
    for y in range(max(0, int(min(ys))), min(a.shape[0], int(max(ys)) + 1)):
        yc = y + 0.5; xs = []
        for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]):
            if (y0 <= yc < y1) or (y1 <= yc < y0): xs.append(x0 + (yc - y0) * (x1 - x0) / (y1 - y0))
        xs.sort()
        for l, r in zip(xs[::2], xs[1::2]):
            for x in range(max(0, int(round(l))), min(a.shape[1], int(round(r)))):
                c = fn(x, y)
                if c is not None: put(a, x, y, c)

def rock(w, h, cx, cy, rx, ry, pal, seed=0, cracks=True, top=None, jag=0.14):
    """Lumpy boulder: pal [outline, dark, shade, mid, light, highlight]; top: colour list for a cap (moss/snow) on the top rim."""
    R = random.Random(seed); a = canvas(w, h); ph = R.uniform(0, 6.28)
    for y in range(h):
        for x in range(w):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            ang = math.atan2(dy, dx); rr = 1 + jag * math.sin(ang * 3 + ph) + jag * 0.6 * math.sin(ang * 5 + ph * 2)
            nx, ny = dx / (rx * rr), dy / (ry * rr)
            if nx * nx + ny * ny > 1 or (dy > ry * 0.55 and nx * nx + ny * ny > 0.75): continue
            t = sphere_t(nx, ny, 0.52) + (hash01(x // 2, y // 2, seed) - 0.5) * 0.18
            a[y, x, :3] = pick(pal[1:-1], t, x, y); a[y, x, 3] = 255
    A = opaque(a)
    if cracks:
        for _ in range(max(1, int(rx * ry / 12))):
            x, y = R.randint(int(cx - rx * 0.5), int(cx + rx * 0.4)), R.randint(int(cy - ry * 0.3), int(cy + ry * 0.4))
            for _ in range(R.randint(2, 4)):
                if 0 <= x < w and 0 <= y < h and A[y, x]: a[y, x, :3] = pal[1]
                x += R.choice((-1, 0, 1)); y += 1
    # highlight dabs on the upper-left
    for y in range(h):
        for x in range(w):
            if A[y, x] and (y == 0 or not A[y - 1, x]) and x < cx: a[y, x, :3] = pal[-1]
    if top:
        for x in range(w):
            col = [y for y in range(h) if A[y, x]]
            if not col: continue
            y0 = col[0]; depth = 1 + (hash01(x, 0, seed) > 0.5) + (abs(x + 0.5 - cx) < rx * 0.5)
            for k in range(depth):
                if y0 + k < h and A[y0 + k, x]: a[y0 + k, x, :3] = top[min(k, len(top) - 1)]
    return outline(a, pal[0])

def shadow(a, cx, cy, rx, ry, col, alpha_under=True):
    """Ground shadow ellipse under a piece (only on transparent pixels)."""
    A = opaque(a)
    for y in range(a.shape[0]):
        for x in range(a.shape[1]):
            if A[y, x]: continue
            nx, ny = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
            if nx * nx + ny * ny <= 1 and ((x + y) % 2 == 0 or nx * nx + ny * ny < 0.5):
                a[y, x, :3] = col; a[y, x, 3] = 255
    return a
