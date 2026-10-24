"""Landmarks drawn on a grid: silhouette by per-row spans, then shading by face position,
bark as staggered 2-4px clusters, hollow and offerings placed by hand."""
import math

def grid(w, h): return [["."] * w for _ in range(h)]
def rows(g): return ["".join(r) for r in g]
def H(x, y, k=0):  # deterministic hash 0..1
    v = (x * 374761393 + y * 668265263 + k * 2147483647) & 0xffffffff
    v = ((v ^ (v >> 13)) * 1274126177) & 0xffffffff
    return (v & 0xffff) / 65535

def outline(g, dark, lit, solid):
    """dark rim on the lower-right / bottom, mid-tone rim on the upper-left (no full black ring)."""
    h, w = len(g), len(g[0]); src = [r[:] for r in g]
    for y in range(h):
        for x in range(w):
            if src[y][x] != ".": continue
            nb = [(dx, dy) for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)) if 0<=x+dx<w and 0<=y+dy<h and src[y+dy][x+dx] in solid]
            if not nb: continue
            g[y][x] = lit if all(d in ((1,0),(0,1)) for d in nb) and y < h - 12 else dark

# ---------------- hollow tree 48x64 ----------------
def hollow_tree():
    W, Hh = 48, 64
    g = grid(W, Hh)
    TOPY = 12
    LST = [0, 0, 1, 1, 1, 0, 0, 0, -1, -1, -1, -1, 0, 0, 0, 1, 1, 0, 0, 0, 0, -1, -1, -1, -1, -1, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, -1, -1, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    RST = [0, 0, 0, -1, -1, -1, -1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, -1, -1, -1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0]
    def sp(y):
        i = max(0, min(49, y - TOPY))
        lean = (y - TOPY) // 14                      # leans left toward the top
        bulge = 1 if 24 <= y <= 31 else 0
        flare = int(7 * max(0, (y - 45) / 9) ** 1.6)
        return 18 - (2 - lean) - LST[i] - bulge - flare, 28 - (2 - lean) + RST[i] + flare
    # broken rim height per column: jagged, higher at back-left
    a0, b0 = sp(TOPY)
    jag = [3, 1, 0, -2, -1, 1, 2, 0, 1, 3, 2, 3]
    top = {x: TOPY + jag[(x - a0) % len(jag)] for x in range(a0, b0 + 1)}
    for y in range(TOPY - 3, 55):
        a, b = sp(min(max(y, TOPY), 54))
        for x in range(a, b + 1):
            if y < top.get(x, TOPY): continue
            n = (x - a) / max(1, b - a)
            n += 0.18 * (H(x // 3, y // 3 + (x // 3) % 2, 7) - 0.5)
            g[y][x] = "h" if n < 0.22 else ("l" if n < 0.45 else ("m" if n < 0.7 else ("d" if n < 0.88 else "D")))
    # roots: split into toes like the Beodeul trees, uneven lengths and drops
    def root(x, y, dx, ln, drop):
        for i in range(ln):
            xx = int(round(x + dx * i)); yy = y + int(drop * i)
            th = 4 if i < 2 else (3 if i < ln - 2 else 2)
            for k in range(th):
                if g[yy + k][xx] == ".": g[yy + k][xx] = "l" if (dx < 0 and k == 0) else ("m" if k == 0 else "d")
    a, b = sp(54)
    root(a + 1, 51, -1.2, 7, 0.4); root(a + 3, 53, -0.6, 5, 0.6)
    root(b - 1, 51, 1.3, 8, 0.35); root(b - 4, 53, 0.5, 5, 0.7)
    root(23, 54, 0.1, 3, 1.0)
    # bottom: not a straight line, ragged by column
    for x in range(W):
        for y in range(54, 60):
            if g[y][x] != "." and H(x, y, 9) < 0.35 and g[y-1][x] != ".": g[y][x] = "."

    def stub(x0, y0, dx, ln):
        for i in range(ln):
            x = x0 + dx * i; yc = y0 - i // 2
            for k in range(-1, 2 - i // 3):
                g[yc + k][x] = "l" if k < 0 else ("m" if k == 0 else "d")
    a, b = sp(26); stub(a - 1, 26, -1, 5)
    a, b = sp(20); stub(b + 1, 21, 1, 4)
    outline(g, "o", "D", "hlmdD")
    # broken top in 3/4: elliptical opening, dark inside, lit inner rim on the far (back) side, wood ring on the front
    a, b = sp(TOPY)
    cx = (a + b) / 2
    for y in range(TOPY - 3, TOPY + 5):
        for x in range(a, b + 1):
            e = ((x - cx) / ((b - a) / 2)) ** 2 + ((y - (TOPY + 1)) / 3.2) ** 2
            if g[y][x] == ".": continue
            if e < 0.45: g[y][x] = "k"
            elif e < 0.75: g[y][x] = "q" if y <= TOPY + 1 else "w"   # inner wall back: rotten dark; front lip: wood
            elif e < 1.05 and y <= TOPY + 1: g[y][x] = "w" if x < cx else "h"
    # jagged broken rim: notch the lid edge with uneven teeth so it is not a clean ellipse
    a, b = sp(TOPY)
    teeth = {a: 3, a+1: 2, a+2: -1, a+3: -2, a+4: -2, a+5: 0, a+6: 2, a+7: 1, a+8: 0, a+9: 2, a+10: 3, a+11: 2}
    for x, dt in teeth.items():
        if dt > 0:
            for y in range(TOPY - 4, TOPY - 4 + dt + 1):
                if g[y][x] != ".": g[y][x] = "."
        elif dt < 0:
            for y in range(TOPY - 2 + dt, TOPY - 1):
                g[y][x] = "w" if x < (a + b) / 2 else "h"
            g[TOPY - 3 + dt][x] = "D"
    # bark: short 2-4px strokes, staggered, with a few knots; nothing above the hollow mouth
    def clear_zone(x, y): return 33 <= y <= 40 and 17 <= x <= 27
    for (x0, y0, ln) in ((19,15,3),(22,17,4),(25,14,2),(20,21,2),(24,22,3),(27,19,3),(18,26,3),(23,27,2),(26,25,4),
                         (21,31,3),(27,30,2),(19,44,2),(28,34,3),(28,42,3),(26,47,2),(24,12,2)):
        for k in range(ln):
            x, y = x0 + (1 if k == ln - 1 and ln > 2 else 0), y0 + k
            if clear_zone(x, y) or g[y][x] not in "hlmdD": continue
            g[y][x] = "D" if g[y][x] in "dD" else "d"
            if k == 0 and g[y][x - 1] in "hl": g[y][x - 1] = "h"
    for (kx, ky) in ((22,23),(25,29)):           # knots: dark eye-free oval knot with a lit lower edge
        for (dx, dy, c) in ((0,0,"D"),(1,0,"d"),(0,1,"d"),(1,1,"D"),(0,2,"h"),(1,2,"l")):
            g[ky+dy][kx+dx] = c
    # hollow at foot: off-centre to the left, leaning right toward its top, ragged; inner wood on the right, lit lower lip
    for y in range(40, 52):
        t = (y - 40) / 11
        cx = 21.0 + 2.0 * (1 - t)            # top leans right
        r = 1.2 + 2.6 * min(1.0, t * 1.6) - (0.8 if y > 49 else 0)
        L, R = int(round(cx - r)), int(round(cx + r * 0.8))
        if y in (43, 46): L -= 1
        for x in range(L, R + 1): g[y][x] = "k"
        g[y][R] = "q"
        if g[y][R + 1] != ".": g[y][R + 1] = "m"
        g[y][L - 1] = "D"
    for x in range(18, 25): g[51][x] = "h" if x < 23 else "l"          # lit lower lip (sill)
    g[52][19] = "l"; g[52][20] = "h"
    # moss clumps (woodland ramp) on the lit side and roots
    for (x, y, c) in ((17,24,"M"),(18,24,"G"),(17,25,"G"),(18,25,"g"),(17,26,"g"),
                     (17,33,"G"),(18,33,"M"),(17,34,"g"),(18,34,"G"),
                     (15,52,"M"),(16,52,"G"),(14,53,"G"),(15,53,"g"),
                     (17,11,"G"),(18,11,"M"),(18,12,"g")):
        if g[y][x] not in ".": g[y][x] = c
    for y in range(52, 63):
        for x in range(10, 47):
            if g[y][x] == ".":
                d = ((x - 29) / 15) ** 2 + ((y - 57) / 4) ** 2
                if d < 0.5: g[y][x] = "S"
                elif d < 1: g[y][x] = "s"
    keys = {"o": "#1e150a", "D": "#2a1a0f", "d": "#452a17", "m": "#543719", "l": "#6f4725", "h": "#885a26",
            "k": "#190e0d", "q": "#3a261c", "w": "#b77541",
            "g": "#063328", "G": "#104c2f", "M": "#296535", "s": "s", "S": "S"}
    return rows(g), keys

# ---------------- shrine stone 32x48 ----------------
STONE = [
"................................",
"................................",
"................................",
"................................",
"................................",
"................................",
"...........aBBb.................",
".........aBBTTBBb...............",
"........aBTTTTTBBb..............",
"........aBTTTTBBBbb.............",
".......aBBTTTBBBbbbo............",
".......aBBBTBBBbbbbo............",
".......aBBBBBBbbbbmo............",
"......aBBBBBbbbbbmmo............",
"......aBBBbbbbbbmmmo............",
"......aBBbbbbbbmmmmo............",
"......aBbbbbbbbmmmddo...........",
"......aBbbbbbbmmmmddo...........",
".....aBbbbbbbbmmmdddo...........",
".....aBbbbbbbbmmmdddo...........",
".....aBbbbbbbmmmmdddo...........",
".....aBbbbbbbmmmmdddo...........",
".....aBbbbbbmmmmdddDo...........",
".....aBbbbbbmmmmdddDo...........",
"....aBbbbbbmmmmmdddDo...........",
"....aBbbbbbmmmmddddDo...........",
"....aBbbbbbmmmmddddDo...........",
"....aBbbbbmmmmmddddDDo..........",
"....aBbbbbmmmmdddddDDo..........",
"....aBbbbbmmmmdddddDDo..........",
"...aBbbbbmmmmmddddDDDo..........",
"...aBbbbbmmmmddddDDDo...........",
"...aBbbbbmmmmddddDDDo...........",
"...aBbbbmmmmmdddDDDDo...........",
"...aBbbbmmmmddddDDDDo...........",
"...aBbbbmmmmddddDDDo............",
"...aBbbbmmmmdddDDDDo............",
"...aBbbbmmmmdddDDDDo............",
"..aBbbbmmmmmdddDDDDDo...........",
"..aBbbbmmmmddddDDDDDo...........",
"..aBbbmmmmmddddDDDDoo...........",
"...oDDmmmmddddDDDDoo............",
"....ooDDDDDDDDDooo..............",
"................................",
"................................",
"................................",
"................................",
"................................",
]
STAR_ZONE = set()
def shrine_stone():
    g = [list(r) for r in STONE]
    # flat tone regions: lit upper-left plane (B), lit top (T), mid front (b/m), dark right side (d/D)
    for y in range(6, 41):
        xs = [x for x in range(32) if g[y][x] in "bBmdDT"]
        if not xs: continue
        L, R = xs[0], xs[-1]; wdt = max(1, R - L)
        for x in xs:
            n = (x - L) / wdt
            if y < 12: c = "T" if n < 0.55 else "B"
            elif n < 0.28 - (y - 12) * 0.002: c = "B"
            elif n < 0.55: c = "b"
            elif n < 0.78: c = "d"
            else: c = "D"
            g[y][x] = c
    # slight tilt: shift upper rows right (leaning) and irregular left notches
    for y in range(6, 41):
        sh = (40 - y) // 12
        g[y] = ["."] * sh + g[y][:32 - sh]
    for (x, y) in ((6, 27), (6, 28), (5, 33)):
        g[y][x] = "a"
    # weathering clusters: darker pits, lichen lights
    for (x, y, c) in ((11,18,"m"),(12,18,"m"),(12,19,"m"),(15,30,"D"),(16,30,"d"),(16,31,"D"),
                     (9,35,"m"),(10,35,"m"),(10,36,"m"),(13,24,"B"),(14,24,"B"),(9,28,"B"),(10,28,"B")):
        if g[y][x] not in ".o": g[y][x] = c
    # facets: a few large planes (lit upper-left facets, dark notches) instead of one flat plane
    for (x0, y0, w0, h0, c) in ((8,14,3,4,"B"),(7,19,2,5,"B"),(12,27,3,3,"B"),(6,30,2,4,"B"),(9,33,3,2,"b"),
                               (14,15,3,3,"m"),(16,25,2,4,"d"),(10,36,4,2,"m"),(13,31,2,3,"m"),(17,35,2,3,"D"),
                               (11,12,2,2,"T"),(9,18,1,2,"T")):
        for y in range(y0, y0 + h0):
            for x in range(x0 + (y - y0) % 2 * 0, x0 + w0):
                if g[y][x] in "bBmdDT": g[y][x] = c
    def despeckle(passes=2):
        stone = "bBmdDT"
        for _ in range(passes):
            src = [r[:] for r in g]
            for y in range(1, 47):
                for x in range(1, 31):
                    c = src[y][x]
                    if c not in stone: continue
                    nb = [src[y+dy][x+dx] for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)) if src[y+dy][x+dx] in stone]
                    if len(nb) >= 3 and c not in nb:
                        g[y][x] = max(nb, key=nb.count)
    for (x0, y0, w0, h0, c) in ((15,37,3,2,"D"),(9,14,2,3,"T")):
        for y in range(y0, y0 + h0):
            for x in range(x0, x0 + w0):
                if g[y][x] in "bBmdDT": g[y][x] = c
    despeckle()
    # shallow relief star: mid-tone face, thin dark edge on its upper-left, light lip on its lower-right
    star = ["....xx....", "....xx....", "...xxxx...", "xxxxxxxxxx", ".xxxxxxxx.", "..xxxxxx..", "..xxx.xxx.", ".xxx...xxx", ".xx.....xx"]
    ox, oy = 6, 25
    pts = {(ox + i, oy + j) for j, r in enumerate(star) for i, ch in enumerate(r) if ch == "x"}
    for (x, y) in pts: g[y][x] = "m"
    for (x, y) in pts:
        if (x - 1, y) not in pts or (x, y - 1) not in pts: g[y][x] = "d"
    for (x, y) in pts:
        for q in ((x + 1, y), (x, y + 1)):
            if q not in pts and g[q[1]][q[0]] in "bmdDT": g[q[1]][q[0]] = "B"
    STAR_ZONE.update(pts | {(x + 1, y) for x, y in pts} | {(x, y + 1) for x, y in pts})
    # moss: on the crown and the left shoulder, flowing down a little
    for (x, y, c) in ((12,6,"G"),(13,6,"M"),(11,7,"G"),(12,7,"M"),(13,7,"L"),(14,8,"M"),(10,8,"g"),(11,8,"G"),
                     (9,9,"G"),(10,9,"M"),(9,10,"g"),(8,11,"G"),(9,11,"g"),(8,12,"g"),(7,14,"G"),(7,15,"g"),
                     (16,7,"G"),(17,8,"g"),(4,38,"G"),(3,39,"M"),(4,39,"G"),(5,40,"g"),(3,40,"g")):
        if g[y][x] != ".": g[y][x] = c
    # offering lying on the ground in front-left: a small flat dish stone with a flower bundle
    off = {}
    dish = ["..aBBTTa..", ".abbBBbbmo", ".odmmmmddo", "..oooooo.."]
    for j, r in enumerate(dish):
        for i, ch in enumerate(r):
            if ch != ".": off[(2 + i, 42 + j)] = ch
    bundle = ["..yY.pP.", ".yYYpppc", "..GMMG..", "..gGGg.."]
    for j, r in enumerate(bundle):
        for i, ch in enumerate(r):
            if ch != ".": off[(2 + i, 38 + j)] = ch
    for (x, y), c in off.items(): g[y][x] = c
    # a single pebble right of the foot
    for y in range(41, 48):
        for x in range(8, 32):
            if g[y][x] == ".":
                d = ((x - 18) / 11) ** 2 + ((y - 43.5) / 3) ** 2
                if d < 0.5: g[y][x] = "S"
                elif d < 1: g[y][x] = "s"
    for y in range(1, 47):
        for x in range(1, 31):
            if g[y][x] not in ".sS" and all(g[y+dy][x+dx] in ".sS" for dx, dy in ((1,0),(-1,0),(0,1),(0,-1))):
                g[y][x] = "S" if y > 40 else "."
    keys = {"o": "#231c26", "D": "#3a2e38", "d": "#584a52", "m": "#7a6a6c", "b": "#868281", "B": "#a09088",
            "T": "#c4c6c3", "a": "#584a52", "k": "#151019",
            "g": "#063328", "G": "#104c2f", "M": "#296535", "L": "#497f3c",
            "y": "#eac24d", "Y": "#fbc10d", "p": "#e8a8b9", "P": "#ecd6c6", "c": "#8f6b61", "s": "s", "S": "S"}
    return rows(g), keys

def no_lone(rws):
    g = [list(r) for r in rws]
    h, w = len(g), len(g[0])
    for _ in range(6):
        changed = 0
        for y in range(h):
            for x in range(w):
                c = g[y][x]
                if c == ".": continue
                nb = [g[y+dy][x+dx] if 0 <= x+dx < w and 0 <= y+dy < h else "." for dx, dy in ((1,0),(-1,0),(0,1),(0,-1))]
                if c not in nb:
                    g[y][x] = max(nb, key=nb.count); changed += 1
        if not changed: break
    return ["".join(r) for r in g]

def _clean(t, protect=()):
    r, k = t
    out = no_lone(r)
    if protect:
        out = [list(x) for x in out]
        for (x, y) in protect: out[y][x] = r[y][x]
        out = ["".join(x) for x in out]
    return out, k

ART = {"hollow-tree": _clean(hollow_tree()), "shrine-stone": _clean(shrine_stone())}

# hollow-tree frozen at its judged r7 pixels (commit 245edfb857); do not regenerate
HOLLOW_TREE_R7 = ([
"................................................",
"................................................",
"................................................",
"................................................",
"................................................",
"................................................",
"................................................",
"...................AA...........................",
"..................BBB...........................",
"..................BBB...........................",
"..................BBB...........................",
"..................BCCC..........................",
".................DCCCCCCC.......................",
".................DCCCCCCCC......................",
"..............AEEBBCCCCCBBFF....................",
"..............AEEGECCCCCHAF.....................",
"..............AEEGEGGIHHHAF.....................",
"...............EEEEGGIHHHAF.....................",
"...............AEEEGGIHHAAF..AA.................",
"...............AEEEGGIHHHAAAAGGF................",
"................EEEEGGIHHAAAAIIF................",
"................AEEEHIIHHHAHHH..................",
"................AEEEHIIIHHHHHH..................",
"..........AFF..AAEEEGIHHHHHAF...................",
"..........AFGGGEEEEGGIHHHAAAF...................",
"...........FIIGGEEEGIIIHHAAA....................",
".............IIIEEHGGGIIHHAAF...................",
"..............HHEGHGGIIHHHAAF...................",
"...............EEGGGGIIHHHAAF...................",
"...............EEEEGGIIIHHHAF...................",
"...............AEEEGGIIHHHHF....................",
"...............AEEEGGHIHHHHF....................",
"................EEEEGHIIHAAF....................",
".................EEEEGGIIHAAF...................",
".................EEEEGGIIHAAF...................",
".................AEEEGGIIHAAF...................",
".................AEEGGGIHHAAF...................",
".................AEEGGGGHHHHAF..................",
"................AEEEGGGIHHHHAF..................",
"................AEEEGGIIIIHHAF..................",
".................EEEECCCDIIHHAF.................",
"................AEEEACCCDIIHHAF.................",
"................AEEEACCCDIIIAHAF................",
"................AEECCCCCDIIIAHAF................",
"................AEECCCCCDIHHHAF.................",
".................CCCCCCCCDIHAAF.................",
".................CCCCCCCCDIHAAF.................",
".................ACCCCCCCDIAAA..................",
"................AACCCCCCCDIHAAF.................",
".................ACCCCCCDIHHAAF.................",
"...........AAA..AACCCCCCDIHHHAAAA..AA...........",
"........AAAGGGEEEAEEEEEGGIHIIHHAAAAIIFFF........",
"......FFGGFHHHEEEEGGEGGGIIHIIHHAAAAHHFHIIFFFF...",
"......GGHHFHHHEEEEGGGGGGIIHIIIHHAAAHHFHHHFHII...",
"......FFHH..FFFEFEEGGGFGIIIFFFHHAHAAAFFHFFHFF...",
"............FHHHFFFsFFFFFSSSSSFFHHHFFssssss.....",
".............HHHFsssSSSFSSSSSSSFHHHFSSSsssss....",
"..............FFsssSSSFHFSSSSSSSFFFSSSSSssss....",
"...............sssssSSFHFSSSSSSSSSSSSSSsssss....",
".................sssssFFSSSSSSSSSSSSSsssss......",
"....................sssssssssssssssssss.........",
"................................................",
"................................................",
"................................................"
],
{"A": "#2a1a0f", "B": "#b77541", "C": "#190e0d", "D": "#3a261c", "E": "#885a26", "F": "#1e150a", "G": "#6f4725", "H": "#452a17", "I": "#543719", "s": "s", "S": "S"})
ART["hollow-tree"] = HOLLOW_TREE_R7
