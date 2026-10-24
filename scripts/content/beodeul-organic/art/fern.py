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
    arc(7, 13, "wwlwlv"),
    arc(7, 13, "uwuuue"),
    arc(8, 13, "eeerf"),
], (7, 14))

FL = plant(32, 32, [
    arc(14, 27, "wlwwlwllllvlvv"),        # long low sweep to the left
    arc(14, 27, "uwuuwuwwwlwlv"),         # tall frond leaning left, tip drooping
    arc(15, 27, "uueueeueerrfrf"),        # frond over to the right, arching down
    arc(15, 27, "errerrfr"),              # short low right frond
], (14, 28), back=[arc(14, 27, "uuuuueuuueer"), arc(14, 27, "wwlwwlvl")])

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
FC_FROZEN = ['................................',
 '................................',
 '................................',
 '................................',
 '....................4.5.........',
 '.......5............33..........',
 '........3...........24324.5.4...',
 '......4322.321...5.4.534.4.33.5.',
 '..4.54532.3.2..4.33.44325.3.23.4',
 '5.334.432445.45.42.3454453222.3.',
 '.32.34.341413333422.4454332..2..',
 '..2.2.24354352233..245333221....',
 '.....14532413343524.4.2322......',
 '......4323.32.52233151o1o.1.....',
 '.....1.1o1oo241o1o23ssSSSSS.....',
 '......ssSSSSSssSSS2S............']

# fern-cluster passed round 3: frozen as literal rows
ART = {"fern-s": (FS, K), "fern-l": (FL, K), "fern-cluster": (FC_FROZEN, K)}

# ---- round 5: fern-l / fern-cluster use 2x2 leaflet blocks, every 2nd rib step, fewer fronds; fern-s frozen
FS_FROZEN = ['................', '................', '................', '................', '................', '................', '......4.........', '.......3........', '.....5322.......', '..5.4432..5.4...', '4.33553444.33.5.', '.32.4345543.23..', '..2.225323.22...', '.....4.23.2.....', '....111o1o.1....', '.....ssSSSSS....']
def frond2(g, pts, back=False):
    n = len(pts)
    lit = ("4","3","2","1") if back else ("5","4","2","1")
    for i in range(1, n):
        x, y = pts[i]; px, py = pts[i-1]
        dx, dy = x - px, y - py
        nx, ny = -dy, dx
        if ny > 0 or (ny == 0 and nx > 0): nx, ny = -nx, -ny
        tip = i >= n - 2
        if i % 2 == 1:   # upper (lit) leaflet: 2x2 block offset along the normal
            cx, cy = x + nx, y + ny
            blk = [(cx, cy, lit[0]), (cx + nx, cy + ny, lit[1])] if tip else \
                  [(cx, cy, lit[0]), (cx + dx, cy + dy, lit[0]), (cx + nx, cy + ny, lit[1]), (cx + nx + dx, cy + ny + dy, lit[1])]
        else:            # lower (shade) leaflet
            cx, cy = x - nx, y - ny
            blk = [(cx, cy, lit[2])] if tip else \
                  [(cx, cy, lit[2]), (cx + dx, cy + dy, lit[2]), (cx - nx, cy - ny, lit[3]), (cx - nx + dx, cy - ny + dy, lit[3])]
        for bx, by, c in blk: put(g, bx, by, c)
    for (x, y) in pts[:-1]:
        put(g, x, y, "3" if not back else "2")

def plant2(W, H, fronds, root, back=()):
    g = [["."] * W for _ in range(H)]
    for f in back: frond2(g, f, True)
    for f in fronds: frond2(g, f)
    rx, ry = root
    for x, y, c in ((rx-2,ry,"1"),(rx-1,ry,"o"),(rx,ry,"o"),(rx+1,ry,"1"),(rx-1,ry-1,"1"),(rx,ry-1,"2"),(rx+1,ry-1,"1")):
        put(g, x, y, c)
    for x in range(rx - 2, rx + 5): put(g, x, ry + 1, "S" if x > rx - 1 else "s", over=False)
    return ["".join(r) for r in g]

FL2 = plant2(32, 32, [
    arc(14, 26, "wwlwlwllllvv"),
    arc(14, 26, "uuwuwuwwlwl"),
    arc(15, 26, "eueeeeerrff"),
], (14, 27), back=[arc(14, 26, "uuuuueueer"), arc(15, 26, "rrerrrff")])
_a = plant2(32, 16, [arc(8, 13, "wwlwlv"), arc(9, 13, "ueueerf")], (8, 14), back=[arc(8, 13, "uuuwu")])
_b = plant2(32, 16, [arc(23, 12, "wwwlv"), arc(23, 12, "uuuuwl"), arc(24, 12, "eeerf")], (23, 13))
_c = plant2(32, 16, [arc(15, 14, "wwlv"), arc(16, 14, "eerf")], (15, 14))
FC2 = []
for ra, rb, rc in zip(_a, _b, _c):
    FC2.append("".join(c if c not in ".sS" else (a if a not in ".sS" else (b if b not in ".sS" else (c if c != "." else (a if a != "." else b))))
                       for a, b, c in zip(ra, rb, rc)))
ART = {"fern-s": (FS_FROZEN, K), "fern-l": (FL2, K), "fern-cluster": (FC2, K)}

# ---- round 5b: hand-written rows. Fronds: rib '3', paired leaflets lit '5'/'4' above, shade '2'/'1' below, 2px each.
FL3 = ["."*32]*6 + [
 "..............55................",
 ".............5443...............",
 "............54.3.1..............",
 "..........55..3..21.............",
 ".........5443.3.21.......55.....",
 "..55......4..3.21......55443....",
 ".5443.....55.3.1....5544.21.....",
 "..44.3...5443.3...5443.321......",
 "....443...44.3..5443.321........",
 "..55.4433..4.3.443.3221....55...",
 ".5443..4433..3443.321....5544...",
 "..44.21..44333.3321....5443.21..",
 "....4.21...4433321...5443.321...",
 "......443...43321..443.3221.....",
 "..55....4433.3321.43.3221.......",
 ".5443.....44332o1333221.........",
 "..44.3221...433o1o2221.....55...",
 "....43.221...32o1o21....5544.1..",
 "......4433221.21oo1o11.443.21...",
 ".........44332212o1o13321.......",
 "............4431o1oo1o11........",
 "..............21o1o1oSSS........",
 "................SSSSSSs.........",
 "................................",
 "................................",
 "................................",
]
FC3 = ["."*32]*2 + [
 "......................55........",
 ".....................5443.......",
 "......55............54.3.1......",
 ".....5443..........55..3.21.....",
 "....54.3.1........5443.3.21.....",
 "...55..3.21........44.3.21..55..",
 "..5443.3.21..........43.21.5443.",
 "...44.3.21....55..55..3321.4.21.",
 ".....43.21...5443.5443.3321.21..",
 "..55..3321....44.3.44.3.o1o21...",
 ".5443..321.......4433.21o1o1S...",
 "...4433.o1o21.......4332o1oSs...",
 ".....443o1o1oSS......21o1SSs....",
 ".......21o1oSSs.................",
]
ART = {"fern-s": (FS_FROZEN, K), "fern-l": (FL3, K), "fern-cluster": (FC3, K)}
ART["fern-cluster"] = (FC3[1:] + ["."*32], K)  # walk-over decor: keep the bottom row empty

# ---- r7 outline pass: every exterior edge gets an outline. Upper/left side uses a mid-dark tone (lit side),
# lower/right side the darkest. Lone pixels (no 4-neighbour of art) are removed first. Shadow pixels are not art.
def outline(rows, mid="2", dark="o", margin=1):
    H, W = len(rows), len(rows[0])
    g = [list(r) for r in rows]
    art = lambda x, y: 0 <= x < W and 0 <= y < H and g[y][x] not in ".sS"
    for y in range(H):
        for x in range(W):
            if art(x, y) and not any(art(x+a, y+b) for a, b in ((1,0),(-1,0),(0,1),(0,-1))):
                g[y][x] = "."
    out = [r[:] for r in g]
    for y in range(H):
        for x in range(W):
            if art(x, y): continue
            if not (margin <= x < W - margin and margin <= y < H - margin): continue
            nb = [(a, b) for a, b in ((1,0),(-1,0),(0,1),(0,-1)) if art(x+a, y+b)]
            if not nb: continue
            # art lies below or right of this pixel -> we are on its upper/left (lit) side
            lit = all(a >= 0 and b >= 0 for a, b in nb)
            out[y][x] = mid if lit else dark
    return ["".join(r) for r in out]
# ferns: shift fern-s / fern-cluster art right 1px where it touches the left edge, then outline; lit side '1', dark side 'o'
def _pad(rows):
    if any(r[0] not in ".sS" for r in rows): rows = ["." + r[:-1] for r in rows]
    if any(r[-1] not in ".sS" for r in rows): rows = [r[1:] + "." for r in rows]
    return rows
def _calm(rows):
    # break gradient runs: a 5 with no 5 neighbour becomes 4; a 2 isolated inside 4s becomes 3
    g = [list(r) for r in rows]; H, W = len(g), len(g[0])
    for y in range(H):
        for x in range(W):
            if g[y][x] == "5" and not any(0<=x+a<W and 0<=y+b<H and g[y+b][x+a]=="5" for a,b in ((1,0),(-1,0),(0,1),(0,-1))):
                g[y][x] = "4"
    return ["".join(r) for r in g]
for _k in ("fern-s", "fern-l", "fern-cluster"):
    _r, _kk = ART[_k]
    ART[_k] = (outline(_pad(_calm(_r)), mid="1", dark="o"), _kk)

# ---- r8 fern-cluster: one tall fern (left of centre, fronds curving left and up) and one small low fern
# leaning right, overlapping it. Outline dark green only (2 lit side, 1 shade side); no near-black inside fronds.
FC8 = [
 "................................",
 "...........2.55.................",
 "..........25443.................",
 ".......2.254.32.................",
 "......254.4..321................",
 ".....2543.55.321..2.............",
 "....2543.25443.12.252...........",
 "...2543.2544.3.1.25441..........",
 "..2543.2.44.3.12.544.3..........",
 "..243.21..43.3215443.21.....2...",
 "..21..1.2..433.443.21.2..2.2541.",
 "......2543..4333.321.2541.2543..",
 "....2544.3221.3321..2544.3243...",
 "...2443.21..1.3221.2443.3321....",
 "....21..1....SS111.21.2112SS....",
 "................................",
]
ART["fern-cluster"] = (FC8, K)

# ---- r9 cleanup helpers: smooth the bottom silhouette (fill 1px notches, trim 1px legs), and merge lone pixels
def _smooth_bottom(rows):
    g = [list(r) for r in rows]; H, W = len(g), len(g[0])
    isart = lambda c: c not in ".sS"
    for _ in range(3):
        bot = [max([y for y in range(H) if isart(g[y][x])], default=-1) for x in range(W)]
        for x in range(1, W - 1):
            a, b, c = bot[x-1], bot[x], bot[x+1]
            if min(a, b, c) < 0: continue
            if b > a and b > c:            # leg: cut it back to the higher neighbour
                for y in range(max(a, c) + 1, b + 1): g[y][x] = "S" if y == max(a, c) + 1 else "."
            elif b < a and b < c:          # notch: fill down to the shallower neighbour
                for y in range(b + 1, min(a, c) + 1): g[y][x] = "o"
    return ["".join(r) for r in g]
def _merge_lone(rows):
    g = [list(r) for r in rows]; H, W = len(g), len(g[0])
    isart = lambda c: c not in ".sS"
    for y in range(1, H - 1):
        for x in range(1, W - 1):
            c = g[y][x]
            if not isart(c): continue
            nb = [g[y+b][x+a] for a, b in ((1,0),(-1,0),(0,1),(0,-1))]
            if all(isart(n) for n in nb) and all(n != c for n in nb):
                from collections import Counter
                g[y][x] = Counter(nb).most_common(1)[0][0]
    return ["".join(r) for r in g]
def tidy(rows): return _merge_lone(_smooth_bottom(_merge_lone(rows)))
# r9 fern-cluster in fern-l's language: fronds of 2px leaflet clusters (5/4 lit, 3 rib, 2/1/o shade), dark base cluster.
FC9 = [
 "................................",
 "................................",
 "..............11................",
 ".............155o...............",
 "............14443o..............",
 "..11.......1o44o3o..............",
 ".155o.....1155o3o1o.....11......",
 ".4443o...14443o3o21o..1155o.....",
 ".o44o3o..o44o3o21o.1155443o.....",
 "..oo443o11oo43o1o114443o21o..11.",
 "....o4433o1443o21443o321o..1155o",
 "......oo44333o3321o321oo.114443o",
 "........ooo4433321o3221o1144o21o",
 "...........oo43321o221o4443o21o.",
 "............ooo2211oooooo1ooooS.",
 "...............oooSSSoooSSSs....",
]
FC9[14] = "............ooo2211ooSooo1ooSS.."
ART["fern-cluster"] = (tidy(FC9), K)

# ---- r10 fern-cluster: chunky fronds. 2px midribs (3), 2px leaflets (5/4 lit above, 2/1 shade below).
# tall group: 3 fronds (left, up, right); small group: 2 fronds, low and to the right.
FC10 = [
 "................................",
 "...........55...................",
 "..........5443..................",
 "...55.....4433..................",
 "..5443.55.2332.55...............",
 "..44335443.33.5443..............",
 "...2334433.33.4433..............",
 "....3322331331332...............",
 ".....2213333331221......55......",
 "..55...213333312..55...5443.....",
 ".5443...2133312..5443.54433.....",
 ".44332...213312.54433..2333.....",
 "..2233221213311233221..2133155..",
 "....2211121111112211...213354433",
 "......o11o1oo1oo1oSSSSS.o1o112o.",
 ".........oooSSoooSs...ooSSSSs...",
]
ART["fern-cluster"] = (FC10, K)

# ---- r12 fern-l: 6 broad arching fronds of different lengths. Each frond: a 2px midrib along a hand-listed curve,
# leaflets as 2-3px clusters placed at uneven intervals (hand-listed per frond), lit upper side 5/4, underside 2/1.
# Outline only on the outer silhouette (1 lit side, o lower-right), dense dark base, smooth shadow pool.
import math as _m
def _fern_l():
    W = H = 32
    g = [["."] * W for _ in range(H)]
    def P(x, y, c):
        if 1 <= x < W - 1 and 1 <= y < H - 1: g[y][x] = c
    def curve(x0, y0, ang, L, bend):
        pts = []; x, y, a = float(x0), float(y0), _m.radians(ang)
        for i in range(L):
            pts.append((x, y, a)); x += _m.cos(a); y += _m.sin(a); a += _m.radians(bend)
        return pts
    # (root x, root y, start angle deg, length, bend deg/step, leaflet steps)
    fronds = [
        (14, 26, -165, 15, 2.6, (3, 6, 8, 11, 13)),    # long low left, droops
        (14, 25, -130, 16, 2.2, (2, 5, 8, 10, 13)),    # upper left
        (15, 25, -98, 19, 2.0, (3, 6, 9, 11, 14, 16)), # tall, leaning, tip curling over
        (16, 25, -60, 15, 3.0, (2, 5, 7, 10, 12)),     # upper right
        (17, 26, -25, 13, 4.2, (3, 5, 8, 10)),         # right, arching down
        (17, 26, -3, 8, 6.0, (2, 5)),                  # short low right
    ]
    for (rx, ry, ang, L, bend, leaf) in fronds:
        pts = curve(rx, ry, ang, L, bend)
        for i, (x, y, a) in enumerate(pts):
            nx, ny = _m.sin(a), -_m.cos(a)          # normal; make it point up
            if ny > 0: nx, ny = -nx, -ny
            t = i / L
            # 2px midrib: upper pixel mid-lit, lower pixel dark
            P(round(x), round(y), "4" if t < 0.8 else "3"); P(round(x - nx), round(y - ny), "3" if t < 0.5 else "2")
            if i in leaf:
                size = 3 if t < 0.6 else 2
                side = 1 if (i * 7 + rx) % 3 else -1   # uneven alternation
                for k in range(1, size + 1):
                    for along in (0, 1):
                        px = round(x + side * nx * k + _m.cos(a) * (along - k * 0.4))
                        py = round(y + side * ny * k + _m.sin(a) * (along - k * 0.4))
                        if side > 0: c = "5" if (k <= 2 and t < 0.75) else "4"
                        else:        c = "3" if k == 1 else "2"
                        P(px, py, c)
                # opposite smaller leaflet for body
                for k in (1, 2):
                    px = round(x - side * nx * k + _m.cos(a) * 0.5); py = round(y - side * ny * k + _m.sin(a) * 0.5)
                    P(px, py, "4" if side < 0 else "2")
    # dense dark base cluster
    for y, row in enumerate(["...2332...", "..213312..", ".21133112.", ".1o1221o1.", "..o1oo1o.."]):
        for x, c in enumerate(row):
            if c != ".": P(11 + x, 23 + y, c)
    rows = ["".join(r) for r in g]
    rows = _merge_lone(rows)
    rows = outline(rows, mid="1", dark="o")
    rows = _merge_lone(_smooth_bottom(rows))
    # shadow pool under the base, lower-right
    g = [list(r) for r in rows]
    for x in range(12, 22):
        col = [y for y in range(H) if g[y][x] not in ".sS"]
        if col and max(col) + 1 < H - 1 and g[max(col) + 1][x] == ".": g[max(col) + 1][x] = "S" if x > 13 else "s"
    return ["".join(r) for r in g]
ART["fern-l"] = (_fern_l(), K)

# ---- r12b fern-l hand-written in fern-cluster's (passed) language: 2px midribs (33/32), leaflet clusters
# 2-3px (55/544/443 lit, 21 under), uneven spacing, 6 fronds of different lengths, outer outline 1/o only.
FL12 = [
 "................................",
 "................................",
 "................................",
 "..............55................",
 ".............5443...............",
 "..........55.4433...............",
 ".........5443.332.55............",
 "..........4433332.5443..........",
 "...55.......23321.4433...55.....",
 "..5443..55...3321..332..5443....",
 "..44332544...3321.5433..4433....",
 "...2233433....332.4432.332......",
 ".....22333.55.332.433.3321..55..",
 "..55...2333544.3324332333215443.",
 ".5443...2333433.33433.332..4433.",
 ".44332...23333..3333.3321.332...",
 "..2233322.23333.333.33321332....",
 "....22332...2333333333332321....",
 "......2333...23333333333321..55.",
 ".55....22333..2333333333215.5443",
 "5443....223333233333333321443321"[:32],
 "44332.....22333333333332133321..",
 ".2233322...2233333333321221.....",
 "...222333322223333333221........",
 ".......222211223333221.11.......",
 "..........112o1221121o1.........",
 "...........o1o11o1o11oSS........",
 ".............ooSooooSSSs........",
 "...............SSSSSSs..........",
 "................................",
 "................................",
 "................................",
]
FL12 = [r[:32].ljust(32, ".") for r in FL12]
FL12 = ["." + r[1:31] + "." for r in FL12]   # 1px clear of the cell edges
ART["fern-l"] = (_merge_lone(outline(FL12, mid="1", dark="o")), K)

# ---- r12c fern-l: fern-cluster's language scaled up, fronds separated by open gaps (lawn shows between them)
FL12 = [
 "................................",
 "................................",
 "...............55...............",
 "..............5443..............",
 "........55....4433..............",
 ".......5443...2332...55.........",
 ".......4433....33...5443........",
 "...55..2332.55.33...4433...55...",
 "..5443..33.5443.33..2332..5443..",
 "..4433..33.4433.33...33...4433..",
 "...2332.33.2332.33..33..552332..",
 ".....33.33...33.33..33.5443.....",
 "..55..3333...33.33.33..4433.....",
 ".5443..333...3333.33..2332..55..",
 ".4433...33..333333.33.33...5443.",
 "..2332...33333..3333.33.33.4433.",
 "....3333..333....33333...332332.",
 ".55...33333.55....3333..33......",
 "5443....3333443...3333333.......",
 "4433......33433..33333...55.....",
 ".2332......3333.3333....5443....",
 "...333......333333332..34433....",
 ".....3333...2333332333332.......",
 "........3333233333322...........",
 "...........1233332211...........",
 "..........112o1221121o..........",
 "...........o1o11o1o11oSS........",
 ".............ooSooooSSSs........",
 "...............SSSSSSs..........",
 "................................",
 "................................",
 "................................",
]
FL12 = ["." + r[1:31] + "." for r in FL12]
ART["fern-l"] = (_merge_lone(outline(FL12, mid="1", dark="o")), K)
# r12d: no outline pass (it filled the gaps between fronds); same as passed fern-cluster: frond edges carry their own 2/1 shade
ART["fern-l"] = (_merge_lone(FL12), K)
# r12e: leaflets along the bare midribs: 2px lit clusters on the upper-left side and 2px shade clusters on the
# lower-right side, at uneven intervals (hash of position), so the stems read as fronds, not coral.
def _leaf_ribs(rows):
    g = [list(r) for r in rows]; H, W = len(g), len(g[0]); src = [r[:] for r in g]
    for y in range(2, H - 6):
        for x in range(2, W - 2):
            if src[y][x] != "3": continue
            h = (x * 7 + y * 11) % 5
            if h == 0 and src[y][x-1] == ".":
                for (a, b, c) in ((-1, 0, "4"), (-2, 0, "5"), (-1, -1, "5"), (-2, -1, "4")):
                    if g[y+b][x+a] == ".": g[y+b][x+a] = c
            elif h == 2 and x + 2 < W and src[y][x+1] == ".":
                for (a, b, c) in ((1, 0, "2"), (2, 0, "2"), (1, 1, "1"), (2, 1, "1")):
                    if g[y+b][x+a] == ".": g[y+b][x+a] = c
    return ["".join(r) for r in g]
ART["fern-l"] = (_merge_lone(_leaf_ribs(FL12)), K)
ART["fern-l"] = (_merge_lone(_smooth_bottom(ART["fern-l"][0])), K)

# ---- r12f fern-l: 6 tapered feather fronds. Each frond follows a hand-set curve; leaflets fill both sides of a 2px
# midrib (upper side lit 5/4, lower side 3/2/1), half-width shrinking from 3 to 1 toward a pointed drooping tip.
# Leaflet notches every other step (side width -1) give the feather edge. Fronds are drawn back to front with a
# 1px clear margin kept where they would merge, so gaps stay open.
import math as _m2
def _feather_l():
    W = H = 32
    g = [["."] * W for _ in range(H)]
    owner = [[-1] * W for _ in range(H)]
    def P(x, y, c, f):
        if 1 <= x < W - 1 and 1 <= y < H - 2 and (owner[y][x] in (-1, f)):
            g[y][x] = c; owner[y][x] = f
    fr = [  # root x, root y, start angle, length, bend per step, max half-width
        (15, 25, -96, 21, 2.4, 5),    # tall centre, tip droops right
        (14, 25, -138, 17, 3.0, 5),   # upper left
        (14, 26, -170, 13, 4.0, 4),   # low left, droops
        (16, 25, -58, 17, 3.2, 5),    # upper right
        (17, 26, -20, 13, 5.0, 4),    # right, arching down
        (16, 25, -78, 10, 4.0, 3),    # short front frond
    ]
    for f, (rx, ry, ang, L, bend, hw) in enumerate(fr):
        x, y, a = float(rx), float(ry), _m2.radians(ang)
        if bend and ang < -90: bend = -bend if ang < -120 else bend  # left fronds curl left/down
        for i in range(L):
            t = i / (L - 1)
            nx, ny = _m2.sin(a), -_m2.cos(a)
            if ny > 0: nx, ny = -nx, -ny
            w = hw * (1 - t) ** 0.8 + 0.5
            notch = 2 if i % 3 == 1 else 0
            up = max(0, round(w) - notch); dn = max(0, round(w * 0.75) - (2 if i % 3 == 2 else 0))
            dx, dy = _m2.cos(a), _m2.sin(a)
            for k in range(1, up + 1):
                c = "5" if (k >= up - 1 and t < 0.75) else "4"
                P(round(x + nx * k + dx * k * 0.45), round(y + ny * k + dy * k * 0.45), c, f)
                P(round(x + nx * k + dx * (k * 0.45 + 0.6)), round(y + ny * k + dy * (k * 0.45 + 0.6)), c, f)
            for k in range(1, dn + 1):
                c = "2" if k < dn else "1"
                P(round(x - nx * k + dx * k * 0.45), round(y - ny * k + dy * k * 0.45), c, f)
                P(round(x - nx * k + dx * (k * 0.45 + 0.6)), round(y - ny * k + dy * (k * 0.45 + 0.6)), c, f)
            P(round(x), round(y), "3" if t < 0.85 else "4", f)
            x += _m2.cos(a); y += _m2.sin(a); a += _m2.radians(bend)
    # base cluster
    for yy, row in enumerate(["..23332..", ".2133312.", "211322112", ".1o1221o1", "..o1oo1o."]):
        for xx, c in enumerate(row):
            if c != "." and 1 <= 11 + xx < W - 1: g[23 + yy][11 + xx] = c
    for x in range(12, 21):
        col = [y for y in range(H) if g[y][x] not in ".sS"]
        if col and max(col) + 1 < H - 1 and g[max(col) + 1][x] == ".": g[max(col) + 1][x] = "S" if x > 13 else "s"
    return ["".join(r) for r in g]
ART["fern-l"] = (_merge_lone(_smooth_bottom(_merge_lone(_feather_l()))), K)
