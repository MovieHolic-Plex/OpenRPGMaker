"""beodeul_organic wood: logs and stumps, hand-placed via small canvas helpers."""
K = {"o": "#1e150a", "k": "#2a1a0f", "d": "#452a17", "m": "#633712", "b": "#6f4725", "l": "#885a26",
     "h": "#b77541", "n": "#9e8d83", "r": "#bcaaa0", "R": "#d9d2be", "e": "#543719",
     "G": "#0a201c", "g": "#123624", "v": "#1e522a", "V": "#347430", "w": "#5c983a", "W": "#96c254",
     "s": "s", "S": "S", "f": "#bcaaa0", "F": "#9e8d83", "y": "#e8b672", "Y": "#cf9558"}

def canvas(w, h): return [["."] * w for _ in range(h)]
def put(c, x, y, ch):
    if 0 <= y < len(c) and 0 <= x < len(c[0]): c[y][x] = ch
def stamp(c, x0, y0, rows):
    for dy, r in enumerate(rows):
        for dx, ch in enumerate(r):
            if ch != " ": put(c, x0 + dx, y0 + dy, ch)
def done(c): return ["".join(r) for r in c]

def log(c, x0, x1, top, bot, moss, seed, endL=True):
    """East-west log: top band lit (bark or moss), front bark face, left cut end with rings."""
    import random
    rnd = random.Random(seed)
    H = bot - top
    for x in range(x0, x1 + 1):
        t = top + (1 if rnd.random() < .25 and x0 + 3 < x < x1 - 2 else 0)
        b = bot - (1 if rnd.random() < .2 and x0 + 3 < x < x1 - 2 else 0)
        for y in range(t, b + 1):
            k = y - t
            if y == t or y == b: ch = "o"
            elif k <= 1: ch = "h" if k == 1 else "l"
            elif k <= 3: ch = "l" if (x + y) % 5 else "b"
            elif y >= b - 1: ch = "d" if y == b - 1 else "k"
            else: ch = "m"
            c[y][x] = ch
        put(c, x, b + 1, "S"); put(c, x + 1, b + 2, "s")
    # grain: short dark vertical-ish cracks on front face, clumped
    x = x0 + 4
    while x < x1 - 2:
        L = rnd.choice([2, 3, 3, 4])
        y = top + 3 + rnd.randint(0, 1)
        for i in range(L):
            if c[y + i][x] not in "o.": put(c, x + (i == L - 1 and rnd.random() < .5), y + i, "d")
        if rnd.random() < .5: put(c, x + 1, y, "e")
        x += rnd.choice([3, 4, 5])
    # lit streaks on top band
    for x in range(x0 + 3, x1 - 1, 3):
        if rnd.random() < .5: put(c, x, top + 1, "h"); put(c, x + 1, top + 1, "h")
    if moss:
        for x in range(x0 + 3, x1 - 1):
            if rnd.random() < moss:
                d = rnd.choice([1, 2, 2, 3])
                for i in range(d):
                    yy = top + i
                    put(c, x, yy, "g" if i == d - 1 else ("w" if i == 0 else "V"))
                if rnd.random() < .3: put(c, x, top - 1, "v")
                if rnd.random() < .25: put(c, x, top, "W")
    if endL:
        # cut end: foreshortened oval on left
        e = []
        hh = H + 1
        for y in range(top, bot + 1):
            k = y - top
            if k == 0 or k == hh - 1: w = 2
            elif k in (1, hh - 2): w = 3
            else: w = 4
            for i in range(w):
                ch = "R" if i >= 1 else "o"
                if i == w - 1: ch = "n"
                put(c, x0 - (w - 3) + i - 1, y, ch)
            put(c, x0 - (w - 3) - 2, y, "o")
        # rings
        mid = (top + bot) // 2
        for y in range(top + 2, bot - 1): put(c, x0, y, "r")
        put(c, x0 - 1, mid, "n"); put(c, x0, mid, "n"); put(c, x0 + 1, mid - 1, "r")

def log_long():
    c = canvas(48, 16)
    log(c, 4, 45, 5, 12, 0.55, 7)
    # right end: broken jagged
    stamp(c, 44, 4, ["oo  ", "lho ", "lmlo", "mmdo", "mdko", "dko ", "ko  ", "oo  ", "ko  ", "o   "])
    # branch stub on top
    stamp(c, 30, 2, [" oo", "ohlo", "oldo"])
    put(c, 31, 2, "o"); put(c, 32, 2, "o")
    return done(c), K

def log_short():
    c = canvas(32, 16)
    log(c, 5, 27, 6, 13, 0.0, 3)
    # right cut end shown as bark cap (back end), slightly lighter top crack
    stamp(c, 27, 6, ["o ", "lo", "mo", "mo", "do", "do", "ko", "o "])
    stamp(c, 14, 5, ["oooo", "lhhl"])  # knot hump
    # peeled bark patch showing pale sapwood
    stamp(c, 9, 8, [" ooo  ", "onFno ", "oFnFno", " oooo "])
    stamp(c, 20, 9, ["oo", "do"])  # knot hole
    put(c, 21, 9, "k"); put(c, 20, 10, "k")
    return done(c), K

def log_mossy():
    c = canvas(48, 32)
    log(c, 5, 43, 17, 27, 0.9, 11)
    # thick moss blanket over the top band, lobed edge hanging down the front
    import random; r = random.Random(4)
    for x in range(7, 43):
        d = 3 + r.choice([0, 0, 1, 1, 2, 3]) if 9 < x < 41 else 2
        for i in range(d):
            put(c, x, 16 + i, "w" if i == 0 else ("V" if i < d - 2 else ("v" if i < d - 1 else "g")))
        if r.random() < .3: put(c, x, 16, "W")
        if r.random() < .25: put(c, x, 15, "G")
    stamp(c, 43, 17, ["o ", "Vo", "vo", "mo", "do", "do", "do", "ko", "ko", "ko", "o "])
    # rot holes on the front
    for x, y in ((14, 22), (29, 23)):
        stamp(c, x, y, [" ooo ", "okkko", " ooo "])
    # ferns rising behind/on top
    fern = ["   W ", "  wV ", " wVv w", "w Vv wV", " vVgVv ", "  ggv  "]
    stamp(c, 18, 11, fern)
    stamp(c, 33, 12, ["  w  ", " wVw ", "wVvVw", " vgv ", "  g  "])
    stamp(c, 8, 13, [" W  ", "wV w", " vVv", "  g "])
    # little pale mushrooms on the log side
    stamp(c, 37, 20, [" RR ", "RRrn", " nf "])
    stamp(c, 40, 22, ["RR", "nF"])
    return done(c), K

def stump(c, cx, top, rw, rh, body, roots, seed, shelf=False):
    """Ring-top ellipse (foreshortened), bark sides, root flare."""
    import random
    rnd = random.Random(seed)
    x0, x1 = cx - rw, cx + rw
    # bark body
    for x in range(x0, x1 + 1):
        bb = top + rh + body + (1 if rnd.random() < .4 else 0)
        for y in range(top + rh // 2, bb + 1):
            fx = (x - x0) / max(1, x1 - x0)
            if x in (x0, x1) or y == bb: ch = "o"
            elif fx < .3: ch = "l" if y < top + rh + 2 else "b"
            elif fx < .65: ch = "m" if (x * 3 + y) % 7 else "d"
            elif fx < .85: ch = "d"
            else: ch = "k"
            c[y][x] = ch
        if x > x0 + 1: put(c, x + 1, bb + 1, "S")
        if x > cx: put(c, x + 2, bb + 2, "s")
    # vertical cracks
    for x in range(x0 + 2, x1 - 1, rnd.choice([3, 4])):
        y = top + rh + 1
        for i in range(rnd.randint(2, body)):
            if c[y + i][x] not in "o.": c[y + i][x] = "d" if c[y + i][x] != "d" else "k"
    # ring top ellipse
    for y in range(top, top + rh + 1):
        t = (y - top - rh / 2) / (rh / 2 + .01)
        half = int(round(rw * (1 - t * t) ** .5 + .2))
        for x in range(cx - half, cx + half + 1):
            edge = x in (cx - half, cx + half) or y in (top, top + rh)
            c[y][x] = "o" if edge else "R"
    # bark rim lip on near (lower) edge
    for x in range(cx - rw + 2, cx + rw - 1): put(c, x, top + rh, "e" if x % 3 else "o")
    put(c, cx - rw + 1, top + rh - 1, "o"); put(c, cx + rw - 1, top + rh - 1, "o")
    # ring lines: inner ellipses, broken
    for k, ch in ((rw - 2, "r"), (rw - 4, "n")):
        if k < 1: continue
        kh = max(1, rh * k // rw)
        for x in range(cx - k, cx + k + 1):
            t = (x - cx) / (k + .01)
            dy = int(round(kh / 2 * (1 - t * t) ** .5))
            if rnd.random() < .85:
                put(c, x, top + rh // 2 - dy, ch); put(c, x, top + rh // 2 + dy, ch)
    put(c, cx, top + rh // 2, "n"); put(c, cx + 1, top + rh // 2, "F")
    # radial crack
    for i in range(rw - 1): put(c, cx + 1 + i, top + rh // 2 - (i // 2) - 0, "F" if i % 2 else "n")
    # roots
    for side, rx, ry, rr in roots:
        stamp(c, rx, ry, rr)

def stump_l():
    c = canvas(32, 32)
    stump(c, 15, 7, 10, 7, 12, [], 5)
    stamp(c, 2, 21, ["    ol", "   olm", "  olmd", "oolmdk", "olmdko", " okko "])
    stamp(c, 24, 22, ["md    ", "dmoo  ", "kdmloo", "kddmmo", " okkko"])
    stamp(c, 11, 28, ["olmdo", " okko"])
    for x, y in ((7, 28), (8, 28), (24, 29), (25, 29), (26, 29), (6, 27)): put(c, x, y, "S")
    # moss tuft on rim, top-left lit
    stamp(c, 6, 7, [" Vw", "vVW", " g"])
    return done(c), K

def stump_s():
    c = canvas(16, 16)
    stump(c, 7, 3, 5, 4, 6, [], 2)
    stamp(c, 0, 11, ["  ool", "oomdk", " ok  "])
    stamp(c, 11, 11, ["dmoo", "kdko", "oo  "])
    return done(c), K

def stump_shelf():
    c = canvas(16, 16)
    # taller narrower broken stump: jagged top instead of flat ring
    stump(c, 7, 2, 4, 3, 8, [], 9)
    stamp(c, 3, 1, [" o  o ", "oRo oR"])
    # shelf fungus brackets on the right side, stacked
    stamp(c, 9, 5, [" oooo ", "ofyyho", "oYhhYo", " oYYo"])
    stamp(c, 10, 9, [" ooooo", "ofyyyho", "oYhhhYo", " ooYYo"])
    stamp(c, 0, 8, ["oooo", "fyho", "YYo ", "oo  "])
    stamp(c, 0, 13, ["oml", " ok"])
    return done(c), K

ART = {"log-long": log_long(), "log-short": log_short(), "log-mossy": log_mossy(),
       "stump-l": stump_l(), "stump-s": stump_s(), "stump-shelf": stump_shelf()}
