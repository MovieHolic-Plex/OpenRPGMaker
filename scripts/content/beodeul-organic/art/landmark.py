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
    def sp(y):
        half = 5.0 + 0.04 * (y - 12) + 6 * max(0, (y - 46) / 9) ** 2
        cx = 23 + 1.2 * math.sin(y * 0.15)
        return int(round(cx - half)), int(round(cx + half))
    # broken top: column tops, a tall splinter on the left, low on the right
    top = {}
    a, b = sp(14)
    prof = [16, 12, 9, 7, 6, 8, 11, 12, 10, 12, 14, 15, 13, 14, 16]
    for i, x in enumerate(range(a, b + 1)): top[x] = prof[min(i, len(prof) - 1)]
    for y in range(6, 56):
        a, b = sp(y)
        for x in range(a, b + 1):
            if y < top.get(x, 6): continue
            n = (x - a) / max(1, b - a)
            g[y][x] = "h" if n < 0.22 else ("l" if n < 0.45 else ("m" if n < 0.7 else ("d" if n < 0.88 else "D")))
    # roots: wedge lobes joined to the flare
    for (x0, dx, ln, th) in ((sp(52)[0] + 2, -1.4, 9, 3), (sp(52)[1] - 2, 1.4, 10, 3), (19, -0.6, 5, 2), (27, 0.7, 6, 2)):
        for i in range(ln):
            x = int(x0 + dx * i); y0 = 51 + i // 2
            t = max(1, th - i // 3)
            for k in range(t):
                yy = y0 + k
                if g[yy][x] == ".": g[yy][x] = "l" if dx < 0 and k == 0 else ("m" if k == 0 else "d")
    # branch stubs (thick, tapering, cut tip)
    def stub(x0, y0, dx, ln):
        for i in range(ln):
            x = x0 + dx * i; yc = y0 - i // 2
            for k in range(-1, 2 - i // 3):
                g[yc + k][x] = "l" if k < 0 else ("m" if k == 0 else "d")
        g[y0 - (ln - 1) // 2][x0 + dx * ln] = "c"
    a, b = sp(24); stub(a - 1, 24, -1, 5)
    a, b = sp(18); stub(b + 1, 19, 1, 4)
    outline(g, "o", "D", "hlmdDc")
    # bark: staggered dark clusters (2-4 px tall, 1-2 wide) in plates, light plate tops
    for y in range(10, 52):
        a, b = sp(y)
        for x in range(a + 1, b):
            if g[y][x] not in "hlmdD": continue
            col = (x - a)
            if col % 3 == 1 and H(x, y // 4 + (col * 7) % 3) < 0.55:
                g[y][x] = "D" if g[y][x] in "md" else "d"
                if H(x, y, 3) < 0.3 and g[y][x + 1] in "hlm": g[y][x + 1] = "d"
            elif col % 3 == 2 and (y + col) % 4 == 0 and g[y][x] in "lm" and H(x, y, 5) < 0.5:
                g[y][x] = "h" if g[y][x] == "l" else "l"
    # broken top surface: warm splintered wood with a dark rotted mouth behind a front lip
    for x in range(min(top), max(top) + 1):
        t = top[x]
        if g[t][x] != ".": g[t][x] = "C" if x < 22 else "w"
        if g[t + 1][x] in "hlmdD": g[t + 1][x] = "w" if x < 22 else "h"
    for x in range(20, 26):
        t = top[x] + 2
        g[t][x] = "k"; g[t + 1][x] = "k" if 20 < x < 25 else "D"
    # hollow at foot: dark interior, inner wood thickness lit on the right/bottom lip, bark rim
    cx, cy = 22, 44
    for y in range(36, 52):
        r = 3.4 * math.sqrt(max(0.0, 1 - ((y - cy) / 7.5) ** 2))
        if y > 48: r = min(r, 3.6 - (y - 48))
        L, R = int(round(cx - r)), int(round(cx + r - (1 if y < 39 else 0)))
        if R < L: continue
        for x in range(L, R + 1): g[y][x] = "k" if (x < R - 1 or y < 39) else "q"
        g[y][L - 1] = "o"
        if g[y][R + 1] != ".": g[y][R + 1] = "w" if y > 40 else "C"
        if g[y][R + 2] in "hlmdD": g[y][R + 2] = "D"
    for x in range(19, 25): g[51][x] = "w" if 19 < x < 24 else "o"   # sill
    for (x, y) in ((19, 41), (20, 42), (19, 47)): g[y][x] = "q"
    # moss clumps (woodland ramp) on the lit side and on roots
    for (x, y, c) in ((17,22,"M"),(18,22,"G"),(17,23,"G"),(18,23,"g"),(17,24,"g"),
                     (17,31,"G"),(18,31,"M"),(17,32,"g"),(18,32,"G"),
                     (14,50,"M"),(15,50,"G"),(13,51,"G"),(14,51,"g"),(15,51,"g"),
                     (27,52,"G"),(28,52,"M"),(29,53,"g"),(28,53,"G"),
                     (16,9,"G"),(17,8,"M"),(17,9,"g"),(18,7,"G")):
        if g[y][x] not in ".": g[y][x] = c
    # ground shadow lower right
    for y in range(52, 62):
        for x in range(12, 47):
            if g[y][x] == ".":
                d = ((x - 29) / 15) ** 2 + ((y - 56) / 4) ** 2
                if d < 0.5: g[y][x] = "S"
                elif d < 1: g[y][x] = "s"
    keys = {"o": "#1e150a", "D": "#2a1a0f", "d": "#452a17", "m": "#543719", "l": "#6f4725", "h": "#885a26",
            "k": "#190e0d", "q": "#3a261c", "c": "#d9d2be", "C": "#bcaaa0", "w": "#b77541",
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
    # carved star centred (14,22): groove dark, lower-right lip lit (cut lit from upper left)
    star = ["...x...", "...x...", "xxxxxxx", ".xxxxx.", "..x.x..", ".x...x."]
    ox, oy = 11, 20
    for j, r in enumerate(star):
        for i, ch in enumerate(r):
            if ch == "x":
                g[oy + j][ox + i] = "o"
    for j, r in enumerate(star):
        for i, ch in enumerate(r):
            if ch == "x":
                x, y = ox + i + 1, oy + j + 1
                if g[y][x] not in "o.": g[y][x] = "T"
    # moss: on the crown and the left shoulder, flowing down a little
    for (x, y, c) in ((12,6,"G"),(13,6,"M"),(11,7,"G"),(12,7,"M"),(13,7,"L"),(14,8,"M"),(10,8,"g"),(11,8,"G"),
                     (9,9,"G"),(10,9,"M"),(9,10,"g"),(8,11,"G"),(9,11,"g"),(8,12,"g"),(7,14,"G"),(7,15,"g"),
                     (16,7,"G"),(17,8,"g"),(4,38,"G"),(3,39,"M"),(4,39,"G"),(5,40,"g"),(3,40,"g")):
        if g[y][x] != ".": g[y][x] = c
    # offering lying on the ground in front-left: a small flat dish stone with a flower bundle
    off = {(4,43):"a",(5,43):"B",(6,43):"B",(7,43):"T",(8,43):"b",(9,43):"a",
           (3,44):"a",(4,44):"b",(5,44):"b",(6,44):"B",(7,44):"b",(8,44):"m",(9,44):"m",(10,44):"o",
           (4,45):"o",(5,45):"d",(6,45):"m",(7,45):"m",(8,45):"d",(9,45):"o",(5,46):"o",(6,46):"o",(7,46):"o",(8,46):"o",
           (5,41):"y",(6,41):"Y",(7,40):"p",(8,41):"P",(6,42):"M",(7,42):"G",(8,42):"g",(7,41):"G"}
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
            "y": "#eac24d", "Y": "#fbc10d", "p": "#e8a8b9", "P": "#ecd6c6", "s": "s", "S": "S"}
    return rows(g), keys

ART = {"hollow-tree": hollow_tree(), "shrine-stone": shrine_stone()}
