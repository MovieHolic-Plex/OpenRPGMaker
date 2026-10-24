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
    def sp(y):
        half = 5.0 + 0.03 * (y - TOPY) + 5 * max(0, (y - 47) / 7) ** 2
        cx = 23 + 1.0 * math.sin(y * 0.15)
        return int(round(cx - half)), int(round(cx + half))
    # broken rim height per column: jagged, higher at back-left
    a0, b0 = sp(TOPY)
    jag = [3, 1, 0, -2, -1, 1, 2, 0, 1, 3, 2, 3]
    top = {x: TOPY + jag[(x - a0) % len(jag)] for x in range(a0, b0 + 1)}
    for y in range(TOPY - 3, 55):
        a, b = sp(min(max(y, TOPY), 54))
        for x in range(a, b + 1):
            if y < top.get(x, TOPY): continue
            n = (x - a) / max(1, b - a)
            g[y][x] = "h" if n < 0.22 else ("l" if n < 0.45 else ("m" if n < 0.7 else ("d" if n < 0.88 else "D")))
    # roots: split into toes like the Beodeul trees, uneven lengths and drops
    def root(x, y, dx, ln, drop):
        for i in range(ln):
            xx = int(round(x + dx * i)); yy = y + int(drop * i)
            th = 2 if i < ln - 2 else 1
            for k in range(th):
                if g[yy + k][xx] == ".": g[yy + k][xx] = "l" if (dx < 0 and k == 0) else ("m" if k == 0 else "d")
    a, b = sp(54)
    root(a + 1, 51, -1.2, 7, 0.4); root(a + 3, 53, -0.6, 5, 0.6)
    root(b - 1, 51, 1.3, 8, 0.35); root(b - 4, 53, 0.5, 5, 0.7)
    root(23, 54, 0.1, 3, 1.0)
    # bottom: not a straight line, ragged by column
    for x in range(W):
        if g[55][x] != "." and (x % 5 in (0, 3)): g[55][x] = "."
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
    # bark: staggered 2-4px dark clusters in plates
    for y in range(TOPY + 5, 52):
        a, b = sp(y)
        for x in range(a + 1, b):
            if g[y][x] not in "hlmdD": continue
            col = x - a; band = (y + 3 * (col // 3)) // 4
            if col % 3 == 1 and H(x, band) < 0.5 and (y + col) % 4 != 0:
                g[y][x] = "D" if g[y][x] in "md" else "d"
            elif col % 3 == 0 and H(x, band, 2) < 0.25 and g[y][x] in "lm":
                g[y][x] = "h" if g[y][x] == "l" else "l"
    # hollow at foot: dark mouth, inner wood thickness as a brown band on the right and the sill, no light specks
    cx, cy = 22, 45
    for y in range(38, 52):
        r = 3.3 * math.sqrt(max(0.0, 1 - ((y - cy) / 7) ** 2))
        L, R = int(round(cx - r)), int(round(cx + r))
        if R <= L: continue
        for x in range(L, R + 1): g[y][x] = "k"
        g[y][R] = "q"; g[y][L - 1] = "o"
        if g[y][R + 1] != ".": g[y][R + 1] = "m"
    for x in range(19, 26): g[51][x] = "m" if x < 24 else "d"
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
def shrine_stone():
    g = [list(r) for r in STONE]
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
    # carved star: flat 5-point groove; upper-left inner edge in shadow, lower-right lip lit
    star = ["....x....", "....x....", "...xxx...", "xxxxxxxxx", ".xxxxxxx.", "..xxxxx..", "..xx.xx..", ".xx...xx.", ".x.....x."]
    ox, oy = 9, 18
    pts = {(ox + i, oy + j) for j, r in enumerate(star) for i, ch in enumerate(r) if ch == "x"}
    for (x, y) in pts:
        g[y][x] = "o" if ((x - 1, y) not in pts or (x, y - 1) not in pts) else "D"
    for (x, y) in pts:
        for (dx, dy) in ((1, 0), (0, 1)):
            q = (x + dx, y + dy)
            if q not in pts and g[q[1]][q[0]] not in ".o": g[q[1]][q[0]] = "T"
    # moss: on the crown and the left shoulder, flowing down a little
    for (x, y, c) in ((12,6,"G"),(13,6,"M"),(11,7,"G"),(12,7,"M"),(13,7,"L"),(14,8,"M"),(10,8,"g"),(11,8,"G"),
                     (9,9,"G"),(10,9,"M"),(9,10,"g"),(8,11,"G"),(9,11,"g"),(8,12,"g"),(7,14,"G"),(7,15,"g"),
                     (16,7,"G"),(17,8,"g"),(4,38,"G"),(3,39,"M"),(4,39,"G"),(5,40,"g"),(3,40,"g")):
        if g[y][x] != ".": g[y][x] = c
    # offering lying on the ground in front-left: a small flat dish stone with a flower bundle
    off = {(4,43):"a",(5,43):"B",(6,43):"B",(7,43):"T",(8,43):"b",(9,43):"a",
           (3,44):"a",(4,44):"b",(5,44):"b",(6,44):"B",(7,44):"b",(8,44):"m",(9,44):"m",(10,44):"o",
           (4,45):"o",(5,45):"d",(6,45):"m",(7,45):"m",(8,45):"d",(9,45):"o",(5,46):"o",(6,46):"o",(7,46):"o",(8,46):"o",
           (5,40):"y",(6,40):"Y",(5,41):"Y",(6,41):"o",(8,39):"p",(9,39):"P",(8,40):"p",(9,40):"c",
           (6,42):"M",(7,42):"G",(8,42):"g",(7,41):"G",(7,40):"L",(8,41):"M"}
    for (x, y), c in off.items(): g[y][x] = c
    # a single pebble right of the foot
    for (x, y, c) in ((21,44,"a"),(22,44,"B"),(23,44,"o"),(21,45,"o"),(22,45,"o")): g[y][x] = c
    for y in range(41, 48):
        for x in range(8, 32):
            if g[y][x] == ".":
                d = ((x - 18) / 11) ** 2 + ((y - 43.5) / 3) ** 2
                if d < 0.5: g[y][x] = "S"
                elif d < 1: g[y][x] = "s"
    keys = {"o": "#231c26", "D": "#3a2e38", "d": "#584a52", "m": "#7a6a6c", "b": "#868281", "B": "#a09088",
            "T": "#c4c6c3", "a": "#584a52",
            "g": "#063328", "G": "#104c2f", "M": "#296535", "L": "#497f3c",
            "y": "#eac24d", "Y": "#fbc10d", "p": "#e8a8b9", "P": "#ecd6c6", "c": "#8f6b61", "s": "s", "S": "S"}
    return rows(g), keys

ART = {"hollow-tree": hollow_tree(), "shrine-stone": shrine_stone()}
