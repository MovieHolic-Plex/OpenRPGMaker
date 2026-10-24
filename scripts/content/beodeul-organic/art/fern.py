"""Ferns: arching fronds (rachis + alternating leaflets), drawn as line paths."""
import math
K = {"o":"#0a201c","1":"#123624","2":"#1e522a","3":"#347430","4":"#5c983a","5":"#96c254","s":"s","S":"S"}

def frond(g, x0, y0, ang, length, bend, leaf, lit):
    """ang: radians (0=right, -pi/2=up). bend: curvature per step (droop)."""
    x, y = float(x0), float(y0); a = ang
    W, H = len(g[0]), len(g)
    pts = []
    for i in range(length):
        x += math.cos(a); y += math.sin(a); a += bend
        pts.append((x, y, a, i))
    for (x, y, a, i) in pts:
        t = i / length
        L = max(1, round(leaf * (1 - t) ** 0.7 + 0.4))
        nx, ny = -math.sin(a), math.cos(a)  # normal
        for side in (1, -1):
            if i < 1 or (i % 2 == 0) != (side > 0): continue
            for k in range(1, L + 1):
                px = round(x + side * nx * k + math.cos(a) * k * 0.5)
                py = round(y + side * ny * k + math.sin(a) * k * 0.5)
                if 0 <= px < W and 0 <= py < H:
                    up = side * ny < 0  # upper-side leaflet lit
                    c = ("5" if lit and k == 1 and t < 0.6 else "4") if up else ("3" if lit else "2")
                    if k == L: c = "3" if up else "2"
                    g[py][px] = c
        px, py = round(x), round(y)
        if 0 <= px < W and 0 <= py < H:
            g[py][px] = "2" if t < 0.8 else "3"

def finish(g, shadow=True):
    W, H = len(g[0]), len(g)
    out = [r[:] for r in g]
    for y in range(H):
        for x in range(W):
            if g[y][x] != ".": continue
            n = [(x+ax, y+ay) for ax, ay in ((1,0),(0,1),(-1,0),(0,-1))]
            if any(0<=a<W and 0<=b<H and g[b][a] != "." for a, b in n):
                # outline only on lower/right sides for airiness
                if 0<=y-1 and g[y-1][x] in "12": out[y][x] = "o"
    if shadow:
        for x in range(W):
            col = [y for y in range(H) if out[y][x] != "."]
            if col and max(col) + 1 < H and out[max(col)+1][x] == ".":
                out[max(col)+1][x] = "s"
    return ["".join(r) for r in out]

def make(W, H, fronds, base, shadow=True):
    g = [["."] * W for _ in range(H)]
    bx, by = base
    for f in fronds:
        frond(g, bx + f[0], by, *f[1:])
    # dark heart at base
    for dx in (-1, 0, 1):
        if 0 <= bx+dx < W: g[by][bx+dx] = "1"
    return finish(g, shadow)

D = math.radians
ART = {
 "fern-s": (make(16, 16, [
     (0, D(-150), 7, 0.10, 2, True), (0, D(-115), 8, 0.09, 2, True),
     (0, D(-70), 8, 0.10, 2, True), (0, D(-30), 7, 0.13, 2, False), ], (7, 14)), K),
 "fern-l": (make(32, 32, [
     (0, D(-170), 13, 0.05, 3, True), (0, D(-140), 15, 0.06, 3, True), (0, D(-112), 15, 0.07, 3, True),
     (0, D(-85), 14, 0.07, 3, True), (0, D(-55), 15, 0.08, 3, False), (0, D(-25), 13, 0.10, 3, False),
     ], (15, 28)), K),
 "fern-cluster": (None, K),
}
# cluster: three small plants side by side, middle one taller
_g = [["."] * 32 for _ in range(16)]
for bx, by, s in ((6, 14, 0.8), (16, 13, 1.0), (26, 14, 0.75)):
    for a, L, b, lf, lit in ((-155, 7, .10, 2, True), (-105, 8, .09, 2, True), (-50, 7, .12, 2, False)):
        frond(_g, bx, by, D(a), round(L * s), b, lf, lit)
    for dx in (-1, 0, 1): _g[by][bx+dx] = "1"
ART["fern-cluster"] = (finish(_g), K)
