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
