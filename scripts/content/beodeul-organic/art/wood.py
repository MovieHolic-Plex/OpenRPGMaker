"""beodeul_organic wood: logs and stumps. Column-profile logs modelled on the Beodeul fallen log,
hand-written stumps modelled on the Beodeul stump (warm cream ring top, brown rings, no grey)."""
import random
K = {"a": "#3d220c", "b": "#442c19", "d": "#543719", "x": "#2a1a0f", "y": "#1e150a",
     "m": "#885a26", "t": "#b77541", "s": "#6f4725", "u": "#633712", "v": "#452a17", "i": "#71482c",
     "k": "#bcaaa0", "r": "#d9d2be", "l": "#9e8d83", "j": "#8f6b61", "w": "#312210",
     "e": "#37340c", "f": "#2e5022", "g": "#616022", "n": "#595513", "o": "#4b8232", "p": "#9d9c33", "q": "#264d2c",
     "1": "#063328", "2": "#104c2f", "3": "#296535", "4": "#497f3c", "5": "#94b353",
     "h": "#cf9558", "c": "#e8b672", "z": "#856234", "s_": "s", "S": "S"}
K["~"] = "s"

def canvas(w, h): return [["."] * w for _ in range(h)]
def put(c, x, y, ch):
    if 0 <= y < len(c) and 0 <= x < len(c[0]): c[y][x] = ch
def stamp(c, x0, y0, rows):
    for dy, r in enumerate(rows):
        for dx, ch in enumerate(r):
            if ch != " ": put(c, x0 + dx, y0 + dy, ch)
def done(c): return ["".join(r) for r in c]

def runs(n, rnd, choices, lo=2, hi=4):
    out = []
    while len(out) < n:
        out += [rnd.choice(choices)] * rnd.randint(lo, hi)
    return out[:n]

END = ["  ll", " jkkl", "jkrkm", "lrmrr", "lrrmr", "lkrrk", " jkkm", "  ll"]  # warm cut face, brown ring

def log(c, x0, x1, top, seed, moss, H=8, cut=True):
    rnd = random.Random(seed)
    n = x1 - x0 + 1
    mossrow = runs(n, rnd, ["o", "o", "p", "f", None, None] if moss else [None])
    lit = runs(n, rnd, ["m", "m", "t", "m", "s"])
    mid = runs(n, rnd, ["s", "s", "s", "m", "u"], 2, 5)
    low = runs(n, rnd, ["u", "u", "u", "v"], 2, 5)
    for i, x in enumerate(range(x0, x1 + 1)):
        col = []
        col.append("d" if mossrow[i] is None else "e")
        col.append(mossrow[i] or "i")
        col.append(lit[i] if mossrow[i] is None else ("f" if lit[i] == "s" else "q"))
        col.append(lit[i] if mossrow[i] is None else lit[i] if lit[i] != "t" else "m")
        col += [mid[i]] * (H - 6)
        col.append(low[i]); col.append(low[i] if low[i] == "u" else "u")
        col[-1] = "v" if low[i] == "v" else "u"
        col.append("x" if (i // 3) % 3 else "y")
        for k, ch in enumerate(col): put(c, x, top + k, ch)
        if i > 3: put(c, x + 1, top + len(col), "S"); put(c, x + 2, top + len(col) + 1, "~")
    # right end: dark bark cap
    for k in range(H + 1): put(c, x1 + 1, top + k, "b" if k < H // 2 else "a")
    put(c, x1 + 1, top, "d")
    if cut: stamp(c, x0 - 4, top + (H + 1 - len(END)) // 2, END)

def log_long():
    c = canvas(48, 16)
    log(c, 5, 44, 5, 21, True, H=8)
    stamp(c, 33, 3, ["  bd", " dmb", "  i "])   # broken branch stub on the top
    stamp(c, 15, 8, ["uu", "vu"]); stamp(c, 26, 9, ["vvu"])  # knots as 2-3px clusters
    return done(c), K

def log_short():
    c = canvas(32, 16)
    log(c, 7, 26, 6, 5, False, H=7)
    # horizontal bark grain: short 2-4px darker runs along the face
    for x, y, L in ((10, 9, 4), (17, 10, 3), (13, 11, 3), (21, 9, 4), (19, 12, 2)):
        for i in range(L): put(c, x + i, y, "u")
    for x, y, L in ((12, 8, 3), (22, 8, 2)):
        for i in range(L): put(c, x + i, y, "t")
    return done(c), K

def log_mossy():
    c = canvas(48, 32)
    log(c, 6, 42, 18, 33, True, H=8)
    rnd = random.Random(9)
    # moss blanket: woodland ramp, lobes hanging 1-3 rows down the front, lit clumps upper-left
    x = 7
    while x < 42:
        w = rnd.randint(3, 5); d = rnd.choice([1, 2, 2, 3])
        for i in range(w):
            if x + i > 41: break
            for k in range(2 + (d if 0 < i < w - 1 else max(0, d - 1))):
                put(c, x + i, 17 + k, "3" if k < 2 else ("2" if k < 3 else "1"))
            put(c, x + i, 17, "4" if i < w - 1 else "3")
        if rnd.random() < .5: put(c, x + 1, 17, "5"); put(c, x + 2, 17, "5")
        x += w
    x = 8
    while x < 40:  # irregular raised moss cushions, 3-5px, not a ruler line
        w = rnd.randint(3, 5)
        if rnd.random() < .6:
            for i in range(w): put(c, x + i, 16, "3" if i < w - 1 else "2")
            put(c, x + 1, 15, "4"); put(c, x + 2, 15, "3")
        x += w + rnd.randint(1, 3)
    # fern clumps behind: lobed 2-3px leaflets, no 1px spikes
    fern = ["    33   ", "  3443 33", " 344 2343", "34 23 42 ", " 2213122 ", "  1121   "]
    stamp(c, 14, 11, fern)
    stamp(c, 30, 12, [" 33  33", "3443343", " 23422 ", "  1211 "])
    # rot hollow on the front, irregular
    stamp(c, 22, 22, [" xx", "xwwx", " xwx"])
    return done(c), K

STUMP_L = [
    "                    ",
    "      ididdii       ",
    "    iitctcrkcdd     ",
    "   dtcrrrkkrrrmd    ",
    "   dmrkmmmmmkrrmd   ",
    "  dtrkmrrrrmmkrmd   ",
    "  dmrkmmmmmmkrkmd   ",
    "  ddmrkkrrrkkmmdd   ",
    "  bmmtmmmmmuumuub   ",
    "  bmtmmssmmuuvuvb   ",
    "  bmmssmmsuuuvuva   ",
    "  bmmsmssuuuvuvva   ",
    "  bmssmsssuuvuvva   ",
    " bmmsssmssuuuvvva   ",
    " bmmssvsssuuvuvva   ",
    "bmmssssvssuuvuvvva  ",
    "bmsssvssssuuuvvwva  ",
    "dmssxsssvsuvuvwvwax ",
    "xmsxbsssssvuuvwxwvwx",
    "xsx  xvsvvxxuwx xvwx",
    "xx    xxxx  xx   xx ",
]
def stump_l():
    c = canvas(32, 32)
    stamp(c, 6, 8, STUMP_L)
    for x in range(8, 28): put(c, x + 1, 29, "S") if c[28][x] == "." else None
    for x in range(14, 28): put(c, x, 30, "~")
    stamp(c, 10, 9, ["  44", " 3443", "  21"])  # moss tuft at the rim, lit
    return done(c), K

STUMP_S = [
    "   idiid   ",
    "  dtkrrcd  ",
    " dmrmkrmmd ",
    " dtrrmmrmd ",
    " bmmmmuuub ",
    " bmsmsuvua ",
    " bmssuuvva ",
    "dmssvsuvvax",
    "x xvsxuvx x",
    "    xx xx  ",
]
def stump_s():
    c = canvas(16, 16)
    stamp(c, 2, 4, STUMP_S)
    for x in range(5, 14): put(c, x, 14, "S")
    for x in range(8, 15): put(c, x, 15, "~")
    return done(c), K

STUMP_F = [
    "    dd     ",
    "   ditd d  ",
    "  dtrkmidd ",
    "  dmrrmkmd ",
    "  bmmmuuub ",
    "  bmsmsuva ",
    "  bmssuuva ",
    "  bmsmsuva ",
    "  bmssuvva ",
    " dmssvsuvax",
    " x xsvxuvx ",
    "    xx  x  ",
]
def stump_shelf():
    c = canvas(16, 16)
    stamp(c, 2, 2, STUMP_F)
    # asymmetric brackets overlapping the front face: big one right-low, small one left-mid
    stamp(c, 8, 7, [" cch  ", "chhzhz", " zzzaa"])
    stamp(c, 9, 10, ["chz", " za"])
    stamp(c, 3, 9, ["ch", "za"])
    for x in range(6, 15): put(c, x, 14, "S")
    for x in range(10, 15): put(c, x, 15, "~")
    return done(c), K

ART = {"log-long": log_long(), "log-short": log_short(), "log-mossy": log_mossy(),
       "stump-l": stump_l(), "stump-s": stump_s(), "stump-shelf": stump_shelf()}
