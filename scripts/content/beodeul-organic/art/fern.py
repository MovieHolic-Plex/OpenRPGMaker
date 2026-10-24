"""Ferns. Each frond is a hand-listed curved rib (points from root to tip). Leaflets are 2x2 clusters
placed alternately above (lit 5/4) and below (shade 2/1) the rib, shrinking to 1px near the tip.
Small dark heart at the root, soft ground shadow."""
K = {"5":"#96c254","4":"#5c983a","3":"#347430","2":"#1e522a","1":"#123624","o":"#0a201c","s":"s","S":"S"}

def put(g, x, y, c, over=True):
    if 0 <= y < len(g) and 0 <= x < len(g[0]) and (over or g[y][x] == "."):
        g[y][x] = c

def frond(g, pts, shade=0):
    """Feather: every rib step gets an upper leaflet (lit) and a lower leaflet (shade);
    leaflets are 2px long for most of the frond, stagger by one step, 1px at the tip."""
    n = len(pts)
    L5, L4, L3, L2, L1 = ("5","4","3","2","1") if shade == 0 else ("4","3","2","1","o")
    for i in range(1, n):
        x, y = pts[i]; px, py = pts[i-1]
        dx, dy = x - px, y - py
        nx, ny = -dy, dx
        if ny > 0 or (ny == 0 and nx > 0): nx, ny = -nx, -ny
        if nx == 0 and ny == 0: nx, ny = 0, -1
        k = 2 if i < n - 3 else 1
        for j in range(1, k + 1):
            put(g, x + nx*j - dx*(j-1), y + ny*j - dy*(j-1), L5 if (j == 1 and i % 2) else L4)
            if i % 2 == 0 or j == 1:
                put(g, x - nx*j - dx*(j-1), y - ny*j - dy*(j-1), L2 if j == 1 else L1)
    for (x, y) in pts:
        put(g, x, y, L3)

def plant(W, H, fronds, root, back=()):
    g = [["."] * W for _ in range(H)]
    for f in back: frond(g, f, 1)
    for f in fronds: frond(g, f, 0)
    rx, ry = root
    for x, y, c in ((rx-1,ry,"1"),(rx,ry,"o"),(rx+1,ry,"1"),(rx,ry-1,"2"),(rx+2,ry,"o")):
        put(g, x, y, c)
    for x in range(rx - 2, rx + 5): put(g, x, ry + 1, "S" if x > rx - 1 else "s", over=False)
    return ["".join(r) for r in g]

def arc(x0, y0, steps):
    """steps: string of moves u r l d (and e=ur, w=ul, f=dr, v=dl)."""
    mv = {"u":(0,-1),"d":(0,1),"l":(-1,0),"r":(1,0),"e":(1,-1),"w":(-1,-1),"f":(1,1),"v":(-1,1)}
    pts = [(x0, y0)]
    for c in steps:
        dx, dy = mv[c]; x, y = pts[-1]; pts.append((x + dx, y + dy))
    return pts

FS = plant(16, 16, [
    arc(7, 13, "wwwlwllv"),        # left frond arching out and down
    arc(7, 13, "uuuwuuel"[:7]),    # centre frond up, tip curling
    arc(8, 13, "eeerreff"),        # right frond
], (7, 14), back=[arc(7, 13, "wuwuuw")])

FL = plant(32, 32, [
    arc(15, 27, "wwwwlwlwllllvv"),
    arc(15, 27, "uwuwuwuuuwwl"),
    arc(16, 27, "ueueuuuueeer"),
    arc(16, 27, "eeeeereerrrff"),
    arc(15, 27, "lwlllllvlv"),
], (15, 28), back=[arc(15, 27, "uuuuuuuuuuuue"), arc(16, 27, "eueueueeeef"), arc(15, 27, "wuwwwwwwlv")])

FC = ["."]
_a = plant(32, 16, [arc(8, 13, "wwwlwlv"), arc(8, 13, "uuwuuue"), arc(9, 13, "eeerrf")], (8, 14),
           back=[arc(9, 13, "ueueeu")])
_b = plant(32, 16, [arc(22, 12, "wwwwlv"), arc(22, 12, "uuuuuuwl"), arc(23, 12, "eeueerff"), arc(22, 12, "eeee")], (22, 13))
_c = plant(32, 16, [arc(15, 14, "wwlv"), arc(15, 14, "uuew"), arc(16, 14, "erf")], (15, 14))
FC = []
for ra, rb, rc in zip(_a, _b, _c):
    row = []
    for a, b, c in zip(ra, rb, rc):
        row.append(c if c not in ".sS" else a if a not in ".sS" else b if b != "." else (a if a != "." else c))
    FC.append("".join(row))
ART = {"fern-s": (FS, K), "fern-l": (FL, K), "fern-cluster": (FC, K)}
