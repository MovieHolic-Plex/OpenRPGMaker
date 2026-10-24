"""Bookkeeping for r6: unbroken ground rim + shadow pool, and lone-speck merge (art stays hand-placed above the base)."""
from collections import Counter
DARK = set("012")
def is_body(c): return c not in ".sS"

def despeck(rows):
    g = [list(r) for r in rows]; H, W = len(g), len(g[0])
    for y in range(H):
        for x in range(W):
            c = g[y][x]
            if c not in DARK and c not in "3": continue
            nb = [g[y+dy][x+dx] for dy, dx in ((0,1),(0,-1),(1,0),(-1,0)) if 0 <= y+dy < H and 0 <= x+dx < W]
            if not all(is_body(n) for n in nb): continue
            if all(n > c for n in nb if n.isdigit()):
                g[y][x] = Counter(n for n in nb if n.isdigit()).most_common(1)[0][0]
    return ["".join(r) for r in g]

def ground(rows, rx=2):
    g = [[c if is_body(c) else "." for c in r] for r in rows]; H, W = len(g), len(g[0])
    cols = [x for x in range(W) if any(is_body(g[y][x]) for y in range(H))]
    x0, x1 = cols[0], cols[-1]
    raw = {x: max(y for y in range(H) if is_body(g[y][x])) for x in cols}
    # smooth: median of 5, then clamp neighbour steps to 1 and kill single-column dips/bumps
    b = {}
    for x in cols:
        w = sorted(raw[xx] for xx in range(x-2, x+3) if xx in raw); b[x] = w[len(w)//2]
    for _ in range(3):
        for x in cols[1:-1]:
            if b[x-1] == b[x+1] != b[x]: b[x] = b[x-1]
    # ends follow the drawn silhouette (no squared corners)
    for x in cols[:3] + cols[-3:]: b[x] = min(b[x], raw[x])
    # hand-chosen 1px lift steps so no bottom run is ruler straight (runs of 3-4)
    for i, x in enumerate(cols[3:-3]):
        if (i // 4) % 2 == 1 and b[x] - 1 > min(y for y in range(H) if is_body(g[y][x])) + 2: b[x] -= 1
    for x in cols:
        top = min(y for y in range(H) if is_body(g[y][x]))
        for y in range(H):
            if y > b[x]: g[y][x] = "."
            elif y >= top and not is_body(g[y][x]): g[y][x] = "2"
        g[b[x]][x] = "1"
        if b[x]-1 >= 0 and g[b[x]-1][x] in "345": g[b[x]-1][x] = "2"
    # pool: one S row under the whole base (+rx right), an s row under the middle, flat ends
    for x in range(x0, min(W, x1 + rx + 1)):
        y = b.get(x, b[x1]) + 1
        if x > x1: y = b[x1]
        if 0 <= y < H and g[y][x] == ".": g[y][x] = "S" if x > x0 + 1 else "s"
        y2 = y + 1
        if x0 + 3 <= x <= x1 + rx - 2 and y2 < H and g[y2][x] == ".": g[y2][x] = "s"
    return ["".join(r) for r in g]

def fix(rows): return ground(despeck(despeck(rows)))
