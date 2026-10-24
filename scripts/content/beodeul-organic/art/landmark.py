"""Landmarks: old hollow dead tree and mossy shrine stone. Built on a grid with deliberate
silhouettes (per-row spans), then bark cracks, moss and highlights placed by hand-chosen coordinates."""
import math

def grid(w, h): return [["."] * w for _ in range(h)]
def put(g, x, y, c):
    if 0 <= y < len(g) and 0 <= x < len(g[0]): g[y][x] = c
def rows(g): return ["".join(r) for r in g]

# ---------------- hollow tree 48x64 ----------------
def hollow_tree():
    W, H = 48, 64
    g = grid(W, H)
    # trunk spans (left,right) per row, top at y=9 jagged
    span = {}
    for y in range(8, 54):
        t = (y - 8) / 45
        half = 7.0 + 2.0 * t + (7 * max(0, (y - 42) / 12) ** 2)
        cx = 24 + int(1.5 * math.sin(y * 0.18))
        span[y] = (int(cx - half), int(cx + half))
    # jagged broken top: per column, top y
    tops = {}
    l, r = span[12]
    jag = [14, 11, 8, 6, 9, 10, 7, 5, 3, 4, 8, 11, 12, 9, 8, 10, 13, 12, 15]
    for i, x in enumerate(range(l, r + 1)):
        tops[x] = jag[i % len(jag)] if i < len(jag) else 14
    # roots spreading at bottom rows 50..58
    roots = [(-1, 0.55), (-1, 0.15), (1, 0.2), (1, 0.6), (0, 1)]
    for y in range(8, 56):
        if y not in span: continue
        a, b = span[y]
        for x in range(a, b + 1):
            if y < tops.get(x, 8): continue
            n = (x - a) / max(1, b - a)
            c = "D" if n > 0.8 else ("d" if n > 0.55 else ("m" if n > 0.25 else "l"))
            if n < 0.12: c = "m"
            g[y][x] = c
    # roots
    def root(x0, y0, dx, ln):
        x, y = x0, y0
        for i in range(ln):
            for k in range(max(1, 3 - i // 3)):
                put(g, int(x), y + k, "d" if dx > 0 else "m")
            put(g, int(x), y + max(1, 3 - i // 3), "o")
            x += dx; y += 1 if i % 2 else 0
    root(span[50][0] + 2, 50, -1.3, 8)
    root(span[50][0] + 7, 52, -0.6, 6)
    root(span[50][1] - 3, 51, 1.2, 9)
    root(span[50][1] - 9, 53, 0.4, 5)
    # outline
    src = [r[:] for r in g]
    for y in range(H):
        for x in range(W):
            if src[y][x] == ".":
                if any(0 <= y+dy < H and 0 <= x+dx < W and src[y+dy][x+dx] not in ".o" for dx, dy in ((1,0),(-1,0),(0,1),(0,-1))):
                    g[y][x] = "o"
    # vertical cracks (deep)
    for cx, y0, y1, wob in ((19, 14, 46, 0.7), (23, 9, 40, 0.5), (28, 17, 49, 0.6), (31, 12, 30, 0.4), (17, 30, 50, 0.3)):
        for y in range(y0, y1):
            x = cx + int(wob * math.sin(y * 0.35 + cx))
            if g[y][x] not in ".o": g[y][x] = "o"; 
            if g[y][x+1] in "lm" : g[y][x+1] = "d"
            if g[y][x-1] in "dD" and (y % 3 == 0): g[y][x-1] = "m"
    # bark highlight clumps on left
    for (x, y) in ((16,20),(17,21),(16,26),(17,27),(16,34),(18,35),(17,40),(21,18),(21,19),(22,28),(20,37),(21,38),(25,24),(25,25),(26,33)):
        if g[y][x] in "lm": g[y][x] = "h"
    # hollow at foot: dark opening
    hx, hy = 24, 43
    for y in range(hy - 6, hy + 8):
        hw = int(4.2 * math.sqrt(max(0, 1 - ((y - hy - 1) / 7.2) ** 2)))
        for x in range(hx - hw, hx + hw + 1):
            if g[y][x] != ".": g[y][x] = "k"
        if hw:
            if g[y][hx-hw-1] != ".": g[y][hx-hw-1] = "o"
            if g[y][hx+hw+1] in "dDm": g[y][hx+hw+1] = "h"  # lit right rim (inner wall)
    for (x, y) in ((22, 40), (23, 41), (26, 46), (25, 47)):
        g[y][x] = "o"
    # broken top: cut wood showing on top (3/4 top surface) - ragged pale fibres
    for x in range(l, r + 1):
        t = tops.get(x, 8)
        if g[t][x] not in ".o": g[t][x] = "c" if x < 26 else "C"
        if g[t+1][x] in "lmdD" and x % 3: g[t+1][x] = "o"
    # hollow interior of broken top (dark mouth)
    for x in range(21, 28):
        t = tops.get(x, 8) + 1
        if g[t][x] != ".": g[t][x] = "k"
    # branch stubs
    def stub(x0, y0, dx, dy, ln):
        for i in range(ln):
            x, y = x0 + dx * i, y0 + int(dy * i)
            put(g, x, y - 1, "o"); put(g, x, y, "m" if dx < 0 else "d"); put(g, x, y + 1, "d"); put(g, x, y + 2, "o")
        put(g, x0 + dx * ln, y0 + int(dy * ln), "o"); put(g, x0 + dx * ln, y0 + int(dy * ln) + 1, "c")
    stub(span[22][0], 22, -1, -0.6, 6)
    stub(span[16][1], 16, 1, -0.8, 5)
    stub(span[32][1], 32, 1, -0.3, 3)
    # moss patches
    for (x, y, c) in ((15,25,"G"),(15,26,"g"),(16,25,"L"),(14,27,"g"),(15,28,"g"),
                     (19,50,"G"),(20,49,"L"),(21,50,"G"),(18,51,"g"),(27,51,"g"),(28,50,"G"),
                     (14,48,"g"),(13,49,"G"),(30,10,"g"),(31,11,"G"),(18,12,"L"),(19,13,"G"),(29,40,"g"),(30,39,"G")):
        if g[y][x] != ".": g[y][x] = c
    # ground shadow lower-right
    for y in range(54, 62):
        for x in range(14, 46):
            if g[y][x] == "." :
                d = ((x - 30) / 16) ** 2 + ((y - 57) / 4.2) ** 2
                if d < 0.55: g[y][x] = "S"
                elif d < 1: g[y][x] = "s"
    keys = {"o": "#1e150a", "D": "#2a1a0f", "d": "#452a17", "m": "#543719", "l": "#6f4725", "h": "#885a26",
            "k": "#100918", "c": "#bcaaa0", "C": "#9e8d83",
            "g": "#123624", "G": "#296535", "L": "#497f3c", "s": "s", "S": "S"}
    return rows(g), keys

# ---------------- shrine stone 32x48 ----------------
def shrine_stone():
    W, H = 32, 48
    g = grid(W, H)
    # leaning menhir: per row (left,right); top surface rows 6..11
    for y in range(5, 43):
        t = (y - 5) / 37
        lean = int(3 * (1 - t))
        left = 9 + lean - int(2 * t) + (1 if y % 7 == 3 else 0)
        right = 21 + lean + int(1.5 * t) - (1 if y % 9 == 5 else 0)
        if y < 9:  # rounded irregular crown
            k = 9 - y
            left += [0, 1, 3, 5][min(3, k)]; right -= [0, 1, 2, 4][min(3, k)]
        for x in range(left, right + 1):
            n = (x - left) / max(1, right - left)
            if y < 12: c = "T" if n < 0.6 else "t"          # top surface lit
            else: c = "h" if n < 0.3 else ("m" if n < 0.65 else ("d" if n < 0.88 else "D"))
            g[y][x] = c
    src = [r[:] for r in g]
    for y in range(H):
        for x in range(W):
            if src[y][x] == "." and any(0<=y+dy<H and 0<=x+dx<W and src[y+dy][x+dx]!="." for dx,dy in ((1,0),(-1,0),(0,1),(0,-1))):
                g[y][x] = "o"
    # edge between top and front face
    for x in range(W):
        if g[12][x] in "hmdD": g[12][x] = "e"
    # weathering pits / cracks
    for (x, y) in ((14,18),(15,19),(20,24),(20,25),(13,33),(14,33),(18,38),(19,30),(12,26)):
        if g[y][x] not in ".o": g[y][x] = "D"
    for (x,y) in ((11,16),(12,16),(11,17),(13,28),(12,29),(13,29),(16,35),(17,35),(16,36),(19,15),(20,15),(18,33)):
        if g[y][x] in 'mdh': g[y][x]='t' if g[y][x]=='h' else 'h'
    # carved star on front (centre ~ (17,24))
    star = ["...x...", "..xxx..", "xxxxxxx", "..xxx..", ".xx.xx.", ".x...x."]
    for j, row in enumerate(star):
        for i, ch in enumerate(row):
            if ch == "x": g[20 + j][12 + i] = "o"; 
            if ch == "x" and g[21+j][12+i] in "hmd": g[21+j][12+i] = "t"   # lit lower lip of carving
    # moss on top and shoulders
    for (x, y, c) in ((14,6,"G"),(15,6,"L"),(16,7,"L"),(13,7,"G"),(14,8,"g"),(17,8,"G"),(12,9,"g"),(18,7,"g"),
                     (11,10,"G"),(10,11,"g"),(11,12,"G"),(10,13,"g"),(11,14,"g"),(21,10,"g"),(22,11,"G"),(22,12,"g"),
                     (10,38,"G"),(9,39,"g"),(10,40,"G"),(11,41,"L"),(21,40,"g"),(22,41,"G")):
        if g[y][x] != ".": g[y][x] = c
    # offering: pebbles + tiny flower bundle at foot
    for (x, y, c) in ((6,43,"o"),(7,43,"o"),(5,44,"o"),(6,44,"T"),(7,44,"m"),(8,44,"o"),(6,45,"o"),(7,45,"o"),
                     (25,43,"o"),(26,43,"o"),(24,44,"o"),(25,44,"T"),(26,44,"d"),(27,44,"o"),(25,45,"o"),(26,45,"o"),
                     (12,41,"a"),(13,40,"G"),(14,39,"y"),(13,38,"y"),(15,40,"p"),(16,39,"p"),(14,41,"a"),(15,42,"a")):
        g[y][x] = c
    for y in range(42, 48):
        for x in range(6, 32):
            if g[y][x] == ".":
                d = ((x - 19) / 12) ** 2 + ((y - 44) / 3) ** 2
                if d < 0.5: g[y][x] = "S"
                elif d < 1: g[y][x] = "s"
    keys = {"o": "#1a2323", "D": "#262729", "d": "#3e403d", "m": "#595b58", "h": "#797a84", "e": "#3e403d",
            "T": "#c4c6c3", "t": "#929491", "g": "#123624", "G": "#296535", "L": "#497f3c", "a": "#1e522a",
            "y": "#eac24d", "p": "#e8a8b9", "s": "s", "S": "S"}
    return rows(g), keys

ART = {"hollow-tree": hollow_tree(), "shrine-stone": shrine_stone()}
