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

def body(c, x0, x1, top, H, seed, topbump, botbump, moss):
    """Log body with an irregular outline: per-column top/bottom offsets from bump lists."""
    rnd = random.Random(seed)
    n = x1 - x0 + 1
    lit = runs(n, rnd, ["m", "m", "t", "m", "s"])
    mid = runs(n, rnd, ["s", "s", "s", "m", "u"], 2, 5)
    low = runs(n, rnd, ["u", "u", "u", "v"], 2, 5)
    for i in range(n):
        x = x0 + i
        t = top + topbump.get(i, 0); b = top + H + botbump.get(i, 0)
        for y in range(t, b + 1):
            k = y - t
            if y == t: ch = "d"
            elif k == 1: ch = "i" if lit[i] != "t" else "m"
            elif k == 2: ch = lit[i]
            elif y == b: ch = "x" if (i // 3) % 3 else "y"
            elif y == b - 1: ch = "v" if low[i] == "v" else "u"
            elif y == b - 2: ch = low[i]
            else: ch = mid[i]
            put(c, x, y, ch)
        if i > 2: put(c, x + 1, b + 1, "S"); put(c, x + 2, b + 2, "~")
    if moss:
        x = moss[0]
        while x < moss[1]:
            w = rnd.randint(3, 6)
            if rnd.random() < moss[2]:
                d = rnd.choice([1, 2, 2, 3])
                for q in range(w):
                    if x + q >= moss[1]: break
                    tt = top + topbump.get(x + q - x0, 0)
                    dd = d if 0 < q < w - 1 else 1
                    for k in range(dd + 1):
                        put(c, x + q, tt + k, "o" if k == 0 else ("f" if k < dd else "q"))
                    if q in (1, 2): put(c, x + q, tt, "p")
                    if 0 < q < w - 1: put(c, x + q, tt - 1, "e" if q % 2 else "f")
            x += w + rnd.randint(1, 4)

def log_long():
    c = canvas(48, 16)
    tb = {0: 1, 1: 1, 2: 0, 9: -1, 10: -1, 11: -1, 22: 1, 23: 1, 30: -1, 31: -1, 37: 1, 38: 1, 39: 1}
    bb = {0: -1, 13: 1, 14: 1, 26: -1, 27: -1, 28: -1, 38: 1, 39: 1}
    body(c, 5, 44, 5, 8, 21, tb, bb, (8, 42, .7))
    # cut end: angled face, warm cream, rings offset
    stamp(c, 1, 5, ["   lk", "  lkrk", " lkrmrm", " krmrrm", "lkrrmrk", "lkrmmrk", " lkrrk", "  lkkm", "   ll"])
    # broken branch stub, angled up-right
    stamp(c, 32, 1, ["    bd", "   dmb", "  dmi ", " bdu  "])
    # right end: splintered, jagged
    stamp(c, 44, 5, ["d  ", "sd ", "mud", "suub", "uva", "uvb", "va ", "ux ", "x  "])
    return done(c), K

def log_short():
    c = canvas(32, 16)
    tb = {0: 0, 5: -1, 6: -1, 7: -1, 14: 1, 15: 1, 19: -1}
    bb = {0: -1, 1: -1, 9: 1, 10: 1, 16: -1, 17: -1}
    body(c, 7, 25, 6, 7, 5, tb, bb, None)
    for x, y, L in ((10, 9, 4), (17, 10, 3), (13, 11, 3), (21, 9, 3)):
        for q in range(L): put(c, x + q, y, "u")
    # cut end on the left: plain, slightly broken rim, ring off-centre
    stamp(c, 3, 6, ["  lk ", " lkrl", "lkrrk", "kmrrr", "kmmrk", "lkrkl", " lkk", "  l "])
    # right end: rounded broken bark, short bark stub on the top
    stamp(c, 25, 6, ["db ", "sub", "suva", "uuva", "uvva", "vva", "xx ", "x  "])
    stamp(c, 12, 3, [" bd", "dmb", " i "])
    return done(c), K

def log_mossy():
    c = canvas(48, 32)
    tb = {0: 1, 6: -1, 7: -1, 8: -1, 18: 1, 19: 1, 27: -1, 28: -1, 33: 1}
    bb = {4: 1, 5: 1, 20: -1, 21: -1, 30: 1}
    body(c, 7, 41, 18, 8, 33, tb, bb, None)
    rnd = random.Random(9)
    # moss blanket flowing over the top and spilling down the left half to the ground
    # moss blanket: lumpy clumps, larger on the left half, one tongue running down to the ground
    lobes = [(8, 3, 4), (11, 4, 3), (15, 5, 5), (20, 3, 3), (23, 4, 4), (28, 3, 2), (32, 5, 3), (37, 3, 2)]
    for lx, w, d in lobes:
        for q in range(w):
            x = lx + q; tt = 18 + tb.get(x - 7, 0)
            dd = d - (1 if q in (0, w - 1) else 0)
            for k in range(dd + 2):
                put(c, x, tt - 1 + k, "3" if k < 2 else ("2" if k < dd + 1 else "1"))
            if q < 2: put(c, x, tt - 1, "4")
        put(c, lx + 1, 18 + tb.get(lx - 6, 0) - 1, "5")
    stamp(c, 8, 21, ["2223", "12232", " 1222", " 1121", "  112"])
    # moss runs into the grass at the left foot
    stamp(c, 6, 26, ["  1223", " 12211", "1211  "])
    stamp(c, 3, 27, ["31", " 1"])
    # one fern on the left, a smaller lower one right (not symmetric)
    stamp(c, 10, 9, ["     33  ", "  33 443 ", " 3443432 ", "344 2342 3", " 23 1243 ", "  1212 2 ", "   1121  "])
    stamp(c, 33, 15, [" 3 33", "34342", " 2121"])
    # cut end: rotten, hollow and broken (dark core, cream only at the rim)
    stamp(c, 3, 18, ["   lk", "  lkrrk", " lkrmrkm", " krrkmrr", "lkrmrrk", " lkrrkm", "  lkkm", "   lk"])
    stamp(c, 5, 16, ["4", "3"])
    # right end splintered
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
    "    didd    ",
    "  ditkkrd   ",
    " dmrkmmkkd  ",
    " dtrmkmkmmd ",
    " bmkrrrmmmb ",
    " bmmsmsuuvb ",
    " bmsmsuuvva ",
    " bmssmsuvva ",
    "dmmssvsuvvax",
    "xsx vsuuvxwx",
    "      xx x  ",
]
def stump_s():
    c = canvas(16, 16)
    stamp(c, 1, 4, STUMP_S)
    for x in range(6, 15): put(c, x, 15, "S")
    put(c, 3, 14, "S"); put(c, 4, 14, "~")
    return done(c), K

STUMP_F = [
    "   ddidd   ",
    "  ditkrkd  ",
    " dmrkmmkkd ",
    " dtkrrrkmd ",
    " bmmmmmuub ",
    " bmmsmsuva ",
    " bmsmsuuva ",
    " bmsmssuva ",
    " bmssmsuva ",
    " bmsssuuva ",
    "dmmssvsuvva",
    "xsxxvsxuvxx",
]
def stump_shelf():
    c = canvas(16, 16)
    stamp(c, 1, 2, STUMP_F)
    # thin half-disc shelves on the right side, stacked unevenly; one small on the front-left low
    stamp(c, 9, 6, ["  cch", "chhhzz", "zzzza"])
    stamp(c, 10, 10, [" ch", "chhz", "zza"])
    stamp(c, 3, 11, ["ch", "za"])
    for x in range(5, 15): put(c, x, 14, "S")
    for x in range(9, 15): put(c, x, 15, "~")
    return done(c), K

ART = {"log-long": log_long(), "log-short": log_short(), "log-mossy": log_mossy(),
       "stump-l": stump_l(), "stump-s": stump_s(), "stump-shelf": stump_shelf()}
