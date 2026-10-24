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

def wavy(n, rnd, amp, lo=3, hi=6):
    """Outline offsets that wander 1px every 3-6 columns (no straight run over 6px, no 1px teeth)."""
    out, v = [], 0
    while len(out) < n:
        v = max(-amp, min(amp, v + rnd.choice([-1, 1])))
        out += [v] * rnd.randint(lo, hi)
    return out[:n]

def strokes(n, rnd, choices, lo=2, hi=3):
    out = []
    while len(out) < n:
        out += [rnd.choice(choices)] * rnd.randint(lo, hi)
    return out[:n]

def body(c, x0, x1, top, H, seed, moss):
    rnd = random.Random(seed)
    n = x1 - x0 + 1
    tw = wavy(n, rnd, 1); bw = wavy(n, rnd, 1, 4, 6)
    tops, bots = [], []
    # per-row stroke lists: staggered 2-3px strokes, rows grouped in pairs so no lone pixels
    band = strokes(n, rnd, ["t", "t", "m"], 2, 4)          # lit top band (2 rows)
    band2 = strokes(n, rnd, ["m", "m", "t", "i"], 2, 4)
    face = [strokes(n, rnd, ["s", "s", "m", "u"], 2, 3) for _ in range(3)]
    low = strokes(n, rnd, ["u", "u", "v"], 3, 5)
    for i in range(n):
        x = x0 + i; t = top + tw[i]; b = top + H + bw[i]
        tops.append(t); bots.append(b)
        for y in range(t, b + 1):
            k = y - t
            if k == 0: ch = "d"
            elif k == 1: ch = band[i]
            elif k == 2: ch = band2[i]
            elif y == b: ch = "y"
            elif y == b - 1: ch = "x"
            elif y == b - 2: ch = low[i]
            else: ch = face[((y - top) // 2) % 3][i]
            put(c, x, y, ch)
    # continuous shadow pool under the log
    for i in range(-1, n + 2):
        bi = bots[max(0, min(n - 1, i))]
        put(c, x0 + i + 1, bi + 1, "S")
        if 1 < i < n: put(c, x0 + i + 1, bi + 2, "~")
    # crack strokes: 2-3px dark horizontal-diagonal pairs on the face
    for _ in range(n // 7):
        i = rnd.randint(3, n - 5); y = tops[i] + rnd.randint(4, 5)
        put(c, x0 + i, y, "v"); put(c, x0 + i + 1, y, "v"); put(c, x0 + i + 1, y + 1, "u"); put(c, x0 + i + 2, y + 1, "u")
    if moss:
        x = moss[0]
        while x < moss[1]:
            w = rnd.randint(3, 6)
            if rnd.random() < moss[2]:
                for q in range(w):
                    i = x + q - x0
                    if x + q >= moss[1] or i >= n: break
                    put(c, x + q, tops[i], "o"); put(c, x + q, tops[i] + 1, "f" if 0 < q < w - 1 else "o")
                    if 0 < q < w - 1: put(c, x + q, tops[i] - 1, "e")
                    if q in (1, 2): put(c, x + q, tops[i], "p")
            x += w + rnd.randint(2, 4)
    return tops, bots

def log_long():
    c = canvas(48, 16)
    body(c, 5, 44, 5, 8, 21, (8, 42, .75))
    stamp(c, 0, 5, ["    lk", "   lkrk", "  lkrrrm", " lkrmmrm", " krmrrkm", "lkrrrmk", "lkkrk", "llk", ""])
    stamp(c, 32, 1, ["    bd", "   dmb", "  dmi ", " bdu  "])
    stamp(c, 44, 5, ["d  ", "sd ", "mud", "suub", "uva", "uvb", "va ", "ux ", "x  "])
    return done(c), K

def log_short():
    c = canvas(32, 16)
    body(c, 7, 25, 6, 7, 6, None)
    stamp(c, 3, 6, ["  lk ", " lkrl", "lkrrk", "kmrrr", "kmmrk", "lkrkl", " lkk", "  l "])
    stamp(c, 25, 6, ["db ", "sub", "suva", "uuva", "uvva", "vva", "xx ", "x  "])
    stamp(c, 12, 3, [" bd", "dmb", " i "])
    stamp(c, 18, 8, ["ss", "uv"])  # knot
    return done(c), K

def log_mossy():
    c = canvas(48, 32)
    tops, bots = body(c, 7, 41, 18, 8, 33, None)
    rnd = random.Random(12)
    # moss: irregular lumps on top, drapes 2-6px down the front, two drapes reach the ground
    x = 8
    while x < 41:
        w = rnd.randint(3, 5)
        d = rnd.choice([2, 3, 3, 4]) if x < 28 else rnd.choice([0, 1, 1])
        for q in range(w):
            if x + q > 40: break
            i = x + q - 7
            dd = d - (1 if q in (0, w - 1) else 0)
            put(c, x + q, tops[i] - 1, "3" if q not in (0, w - 1) else ".")
            for k in range(dd + 1):
                put(c, x + q, tops[i] + k, "4" if k == 0 and q < 2 else ("3" if k < 2 else ("2" if k < dd else "1")))
        if rnd.random() < .5: put(c, x + 1, tops[x + 1 - 7] - 1, "5")
        x += w + (rnd.choice([0, 1, 1, 2]) if x < 28 else rnd.choice([2, 3]))
    # lobed clumps hanging from the moss over the front (2-4px lobes, notched edges), one spilling to the ground left
    for lx, ly, lobe in ((9, 22, [" 23", "2331", "1221", " 1 "]), (16, 21, ["33", "232", " 1"]),
                         (24, 22, [" 332", "23221", " 12 1", "  1"]), (8, 25, ["12", "221", " 11"])):
        stamp(c, lx, ly, lobe)
    stamp(c, 6, 27, [" 1221", "1211"])
    stamp(c, 10, 9, ["     33  ", "  33 443 ", " 3443432 ", "344 2342 3", " 23 1243 ", "  1212 2 ", "   1121  "])
    stamp(c, 33, 15, [" 3 33", "34342", " 2121"])
    stamp(c, 3, 17, ["    d ", "   dsd", "  dlkm", " dkrkm", "dlrmku", " dkkmu", "  dlks", " d  du", "    x"])
    stamp(c, 41, 18, ["db", "sub", "suu ", "uvub", "uva", "uvb", "vva", "ux ", "x "])
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
    "  ddiddid   ",
    " dtcrkrrcd  ",
    "dmrkmmmkrmd ",
    "dtrkmkkmrkd ",
    "dbmrrkkrrmub",
    " bmmsmsuvvb ",
    " bmssmsuuva ",
    "dmmssmsuvva ",
    "dmmsssuvvvax",
    "  xxsvsxxwx ",
    "    xx      ",
]
def stump_s():
    c = canvas(16, 16)
    stamp(c, 2, 4, STUMP_S)
    for x in range(6, 15): put(c, x, 14, "S")
    for x in range(9, 15): put(c, x, 15, "~")
    return done(c), K

STUMP_F = [
    "  ddiddid  ",
    " dtcrkrrcd ",
    "dmrkmmmkrmd",
    "dtrkmkkmrkd",
    "dbmrrkkrrmb",
    " bmmsmsuvva",
    " bmsmsuuvva",
    " bmsmssuvva",
    " bmssmsuvva",
    "dmmssmsuvva",
    "dmmsssuvvva",
    " xxsvsxxwx ",
    "   xx      ",
]
def stump_shelf():
    c = canvas(16, 16)
    stamp(c, 1, 1, STUMP_F)
    # one wide shelf high on the right, one small lower on the right; nothing on the left
    # low wide shelf across the front-right, small one above it at the right edge
    stamp(c, 6, 9, ["   cchh", " chhhhhz", "zzzzzzza"])
    stamp(c, 10, 6, [" ch", "chz", "za"])
    for x in range(5, 15): put(c, x, 14, "S")
    for x in range(9, 15): put(c, x, 15, "~")
    return done(c), K

ART = {"log-long": log_long(), "log-short": log_short(), "log-mossy": log_mossy(),
       "stump-l": stump_l(), "stump-s": stump_s(), "stump-shelf": stump_shelf()}
