"""Bushes. Each bush = hand-placed irregular leaf lobes painted back to front. A lobe mask is hand-drawn:
'L' lit rim (upper-left), 'M' body, 'm' body shade clump, 'D' lower-right shade. Where a lobe's bottom/right edge
lies over an earlier lobe, a deep gap (o/1) is drawn, so masses read as separate clusters. Lit top/left edges
keep their light tone (no outline); only lower-right exterior and base get the darkest tone."""
WD = {"5":"#94b353","4":"#497f3c","3":"#296535","2":"#104c2f","1":"#063328","o":"#071d1b","g":"#0c2222","s":"s","S":"S"}
BR = {"5":"#8cbf5f","4":"#418640","3":"#226b39","2":"#0a5134","1":"#08372c","o":"#071f1d","g":"#0c2222","s":"s","S":"S",
      "r":"#9e2514","R":"#61160d","h":"#dd2912"}
TH = dict(WD, t="#885a26", T="#543719", u="#2a1a0f")
from importlib import import_module as _im
LOBE = {
 "A": ["..LL.L...",
       ".LLLLLL..",
       "LLMMMmMD.",
       "LMMMmMmDD",
       ".MMmmmDD.",
       "..mDDDD..",
       "...D....."],
 "B": [".LLL...",
       "LLLLL..",
       "LLMMmD.",
       "LMMmmDD",
       ".mmDDD.",
       "..DD..."],
 "C": ["...LL...",
       ".LLLLL..",
       "LLLMmMD.",
       "LMMmMmDD",
       "MMmmDDD.",
       ".mDDD...",],
 "d": [".LL..",
       "LMML.",
       "MmMD.",
       ".MDD.",
       "..D.."],
}
TONE = [("5","4","3","2"), ("4","3","2","1"), ("3","2","1","o"), ("2","1","1","o")]

def paint(W, H, lobes):
    g = [["."] * W for _ in range(H)]
    for (x, y, sh, lv) in lobes:
        L, M, m, D = TONE[lv]
        mask = LOBE[sh]
        for j, row in enumerate(mask):
            for i, ch in enumerate(row):
                if ch == ".": continue
                X, Y = x + i, y + j
                if 0 <= X < W and 0 <= Y < H:
                    g[Y][X] = {"L": L, "M": M, "m": m, "D": D}[ch]
        # deep gap just outside this lobe's lower/right edge, where an earlier lobe shows
        for j, row in enumerate(mask):
            for i, ch in enumerate(row):
                if ch not in "D": continue
                for ax, ay in ((0, 1), (1, 0), (1, 1)):
                    jj, ii = j + ay, i + ax
                    inside = jj < len(mask) and ii < len(mask[jj]) and mask[jj][ii] != "."
                    X, Y = x + ii, y + jj
                    if not inside and 0 <= X < W and 0 <= Y < H and g[Y][X] not in ".":
                        g[Y][X] = "o" if g[Y][X] in "12o" else "1"
    # exterior: dark only lower-right; base broken with ground-dark and shadow
    out = [r[:] for r in g]
    for Y in range(H):
        for X in range(W):
            if g[Y][X] == ".": continue
            below = Y + 1 >= H or g[Y + 1][X] == "."
            right = X + 1 >= W or g[Y][X + 1] == "."
            if below and Y > H * 0.5:
                out[Y][X] = "o" if X > W * 0.3 else "1"
            elif right and X > W * 0.6:
                out[Y][X] = "o" if out[Y][X] in "12" else "1"
    for X in range(W):
        col = [Y for Y in range(H) if out[Y][X] != "."]
        if not col: continue
        b = max(col)
        if b + 1 < H and X >= W * 0.3: out[b + 1][X] = "S" if X > W * 0.45 else "s"
        if b + 2 < H and X >= W * 0.6: out[b + 2][X] = "s"
    return out

def fin(g): return ["".join(r) for r in g]

# bush-s: three lobes split by gaps, back pair + low front-right lobe, uneven base
BS = paint(16, 16, [
 (1, 6, "B", 0), (6, 5, "C", 1),
 (0, 9, "d", 1), (3, 9, "B", 1), (8, 9, "A", 2)])
# bush-m: woodland bush, irregular lobes in 4 depth rows
BM = paint(32, 32, [
 (6, 9, "B", 0), (12, 7, "C", 0), (20, 10, "A", 1),
 (2, 13, "C", 0), (10, 12, "d", 0), (14, 12, "A", 1), (24, 13, "B", 2),
 (6, 15, "A", 1), (19, 15, "C", 2), (1, 18, "d", 1), (12, 18, "B", 2), (25, 18, "d", 3),
 (4, 20, "C", 2), (17, 20, "A", 3), (9, 22, "d", 3), (23, 22, "B", 3)])
# bush-berry: brighter, taller rounded lobes, berries bunched in shade
BB = paint(32, 32, [
 (10, 6, "A", 0), (17, 7, "C", 0),
 (5, 9, "B", 0), (13, 10, "d", 1), (21, 11, "A", 1),
 (2, 13, "C", 0), (9, 13, "A", 1), (16, 14, "B", 1), (24, 15, "B", 2),
 (4, 18, "A", 1), (12, 18, "C", 2), (19, 19, "A", 2), (25, 20, "d", 3),
 (2, 22, "B", 2), (8, 23, "A", 3), (16, 23, "B", 3), (21, 23, "C", 3)])
for x, y, pat in [(8, 12, ["r.", "Rr"]), (15, 13, ["r"]), (5, 17, ["rR"]), (20, 17, [".r", "rR"]),
                  (11, 21, ["r", "R"]), (25, 18, ["r"]), (17, 25, ["rR", ".R"]), (13, 16, ["R"]), (23, 13, ["r"])]:
    for j, row in enumerate(pat):
        for i, c in enumerate(row):
            if c != "." and BB[y + j][x + i] not in ".gsS5": BB[y + j][x + i] = c
BB[12][8] = "h"; BB[18][21] = "h"
# bramble: low leaf clumps, curved canes (2px where they arch forward) weaving in and out of the leaves
BRAM = paint(32, 16, [
 (0, 8, "d", 1), (3, 7, "B", 1), (10, 8, "C", 2), (17, 7, "B", 1), (23, 8, "C", 2), (28, 9, "d", 2),
 (6, 10, "d", 3), (14, 10, "d", 3), (21, 10, "d", 3)])
def cane(pts, thick=()):
    """pts: control points; joined with 8-connected steps. thick: indices of points after which the cane is 2px (front)."""
    path = [pts[0]]
    for (x1, y1) in pts[1:]:
        x0, y0 = path[-1]
        while (x0, y0) != (x1, y1):
            x0 += (x1 > x0) - (x1 < x0); y0 += (y1 > y0) - (y1 < y0); path.append((x0, y0))
    seg = 0
    for k, (x, y) in enumerate(path):
        if k and path[k] in pts: seg += 1
        lit = y <= 6
        BRAM[y][x] = "t" if lit else "T"
        if seg in thick and y + 1 < 16 and BRAM[y + 1][x] in ".12345o":
            BRAM[y + 1][x] = "T" if lit else "u"
    for (x, y) in path[3::5]:
        if y > 0 and BRAM[y - 1][x] == ".": BRAM[y - 1][x] = "T"
cane([(1, 11), (2, 8), (4, 5), (7, 4), (10, 5), (12, 8), (13, 10)], thick=(2, 3))
cane([(11, 10), (13, 6), (16, 4), (19, 5), (20, 7)], thick=(1,))
cane([(18, 11), (20, 7), (23, 3), (26, 3), (29, 6), (30, 10)], thick=(2, 3))
cane([(25, 9), (24, 7), (22, 6)])
cane([(6, 9), (8, 8)])
FS_FROZEN = ['................', '................', '................', '................', '................', '................', '......4.........', '.......3........', '.....5322.......', '..5.4432..5.4...', '4.33553444.33.5.', '.32.4345543.23..', '..2.225323.22...', '.....4.23.2.....', '....111o1o.1....', '.....ssSSSSS....']
ST_FROZEN = ['................', '................', '.......5........', '......544.......', '.....5443.......', '....54431o......', '.....331o5......', '...5o21o544.....', '..5443o54432....', '..44321443321...', '...321o3321o1...', '.....o1o1o1o....', '....5443o55.....', '...5443315443...', '..54432o144321..', '..4332o5443211..', '...21o544332o1..', '..55o1443321o...', '.5443o13321o1o..', '.44321o1211o5...', '..321o55o1o5443.', '..1o154431o44321', '.5o5443321o43211', '5443433211o3211o', '4332o3221o1o11og', '.2211o211oo1oog.', '.g11o1o1oo1oogS.', '..gg.gg.ogg.gSs.', '............Ss..', '................', '................', '................']
# shrub-tall passed both blind judges: frozen as literal rows
ART = {"bush-s": (fin(BS), WD), "bush-m": (fin(BM), WD), "bush-berry": (fin(BB), BR),
       "shrub-tall": (ST_FROZEN, WD), "bramble": (fin(BRAM), TH)}

# ---- r6 bramble: one asymmetric thorny mound, hand-written rows. Canes t (lit) / T (shade) / u (dark), 1-2px,
# arcing at different heights and crossing; dense leaf mass at the base; a few dark berries r; one continuous shadow.
TH6 = dict(WD, t="#885a26", T="#543719", u="#2a1a0f", r="#61160d", R="#9e2514")
BRAM6 = [
 "................................",
 "................................",
 "..........tt....................",
 "........tT..t...................",
 ".......t.....T.......tt.........",
 "......t...5...T....tT..t........",
 ".....T...544...T..t.....T.......",
 "...tT...54431..tTt..55...u......",
 "..t.T.55443215.tT.55443..u..t...",
 ".....54431544321.5443321.T.t.T..",
 "...5443215443o2154432o1544T..u..",
 "..54R3215443o1544321o15443321...",
 ".5443o1T443r1o54432o1o543321o1..",
 ".4321o1o3221o1o3321o1R3321o11o..",
 "..21o1o1o11o1oo1o11oo1o1o1oogSS.",
 "...gSSSSSSSSSSSSSSSSSSSSSSSSSs..",
]
ART["bramble"] = (BRAM6, TH6)

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
# r7 bush-s: four lobes kept 2px off the edges, then outlined all round (lit side mid-dark, lower-right darkest)
BS7 = paint(16, 16, [
 (2, 5, "B", 0), (7, 4, "C", 1),
 (2, 8, "d", 1), (5, 8, "B", 1), (9, 7, "A", 2)])
BS7 = [r[:] for r in BS7]
for y in range(16):
    for x in range(16):
        if BS7[y][x] in "sS": BS7[y][x] = "."
BS7 = outline(fin(BS7), mid="2", dark="o")
BS7 = [list(r) for r in BS7]
for x in range(16):
    col = [y for y in range(16) if BS7[y][x] != "."]
    if col and x >= 4:
        b = max(col)
        if b + 1 < 16: BS7[b+1][x] = "S" if x >= 6 else "s"
ART["bush-s"] = (fin(BS7), WD)
# r7 bramble: low dense leafy thicket, mostly leaf mass; three short 2px cane tips; undulating base on a shadow pool
TH7 = dict(WD, t="#885a26", T="#543719", u="#2a1a0f", r="#61160d")
BRAM7 = [
 "................................",
 "................................",
 "................................",
 "................................",
 "........tT..............uT......",
 ".........tT.......5.....tu......",
 "......55..tT.55..544.55.Tu......",
 ".....5443o25443.54431544355.....",
 "...554432154432154432o154443....",
 "..5443321o443321o4432154321o1...",
 ".54432r1o5443o215443o1544321o1..",
 ".4432o1o544321o1o4432154r32o1o..",
 ".43321o1443o21r1o3321o1o4321oo..",
 "..3221oo1321o1oo1o221o1oo211oog.",
 "...g11og.g1oog1ogg11oog1o1og.SS.",
 ".....gg....gg.SSSSgg..SSggSSSs..",
]
ART["bramble"] = (outline(BRAM7, mid="2", dark="o"), TH7)
_b = list(ART["bramble"][0]); _b[15] = _b[15].replace("g", "S"); ART["bramble"] = (_b, TH7)  # art ends by row 14

# ---- r8 bush-s: small leafy shrub, four leaf clumps at different heights (tall back-left, mid back-right,
# low front-left, low front-right), each with a lit top cluster and a dark underside, notched outline.
BS8 = [
 "................",
 "................",
 "................",
 "......2.2.......",
 ".....254452.....",
 "....25544431..2.",
 "...2.54433212541",
 "...2544321o54431",
 "..25543o1o544321",
 ".25443321o44331o",
 ".2544o21543321o.",
 ".244321o5443o1o.",
 "..3321o1o3321o..",
 "..o1o1oo1o11oSS.",
 "...o.oo.o1oSSs..",
 "................",
]
ART["bush-s"] = (BS8, WD)
# ---- r8 bramble: one big lobe, one medium, one small low lobe; uneven gaps; three short 2px cane tips; undulating base
BRAM8 = [
 "................................",
 "................................",
 "................................",
 "......tT........................",
 ".......tT...........uT..........",
 "....2..2tT2.........Tu..........",
 "...25525443.2......2.u2.........",
 "..2554454431252...25445.2.......",
 ".2554432544332542.2544321452....",
 ".25443r2154432r4325443o154431...",
 ".2544321o5443o1o32544321o4431.2.",
 "..44332o154321o1o14432o1o4321ut.",
 "..3321o1o33211o1o1o33211o1o3425.",
 "...o1oo1o1o1oo1o.oo1o1oo1o12221.",
 "....o.oo.oo..oo...o.oo..oo.11o1.",
 "...........SSSSSs.....SSSSSSSs..",
]
ART["bramble"] = (BRAM8, TH7)

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
# r9 bush-s: one rounded shrub mass, a little wider than tall, in bush-m's language (light lumps top-left, mid body,
# 1/o shade lower-right), leaf-cluster bumps all round.
BS9 = [
 "................",
 "................",
 "................",
 "......55.55.....",
 "....5555455541..",
 "...55443544332..",
 "..554432443323o.",
 "..54434433332231",
 ".5543344332322o1",
 ".54433433322211o",
 ".4433333232221o.",
 "..3322332221o1o.",
 "..1222212111ooS.",
 "...11o111oooSs..",
 ".....oooooSSs...",
 "................",
]
BS9[13] = "...11o111ooSSs.."
BS9[14] = "....ooo.SSSs...."
ART["bush-s"] = (tidy(BS9), WD)
# r9 bramble: one continuous low mound, wider/higher on the left, tapering right; irregular top; berries; two cane tips
BRAM9 = [
 "................................",
 "................................",
 "................................",
 "................................",
 ".......tT.......................",
 "........tT.55...........uT......",
 "....55..55555.4..........u......",
 "...55555545443441.55.....u......",
 "..5544354433r3324455441..T......",
 ".55443444333232333443332155.....",
 ".544334433r3222333322r2213441...",
 ".4433343333222132223221122331...",
 "..3332223322211222212111112211..",
 "..112221122111o1111111o1o11oo1..",
 "...1o11o11o1ooo1oo1o1ooooo1ooSS.",
 "......ooooSSSSS.oooooSSSoooSSs..",
]
BRAM9[14] = "...1o11o11o1ooo1oo1o1ooooo1ooSS."
BRAM9[13] = "..112221122111o1111111o1o11oo1.."
ART["bramble"] = (tidy(BRAM9), TH7)
# berries re-added after tidy as 2px pairs (lone-pixel merge would remove single berries)
_b = [list(r) for r in ART["bramble"][0]]
for x, y in ((11, 8), (9, 10), (21, 10), (16, 11)):
    _b[y][x] = "r"; _b[y][x+1] = "r"
ART["bramble"] = (["".join(r) for r in _b], TH7)
