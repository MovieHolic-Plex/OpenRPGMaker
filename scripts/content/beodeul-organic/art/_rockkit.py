"""Shared rock shading helper: hand-drawn silhouettes (row masks) -> clustered 3/4 shading."""
import random
GREY = {"o":"#1a2323","k":"#262729","d":"#3e403d","m":"#595b58","n":"#797a84","l":"#929491","h":"#c4c6c3","w":"#dee0dd"}
MOSS = {"A":"#0a201c","B":"#123624","C":"#1e522a","D":"#347430","E":"#5c983a","F":"#96c254"}
KEYS = dict(GREY, **MOSS, s="s", S="S")

def shade(mask, seed=1, top=0.45, moss=None, cracks=()):
    """mask: rows, '#' = body, '-' = inner contour (drawn dark), '.' empty.
    top: fraction of each column's height that is the lit top surface."""
    R = random.Random(seed)
    H = len(mask); W = len(mask[0])
    g = [list(r) for r in mask]
    body = lambda x, y: 0 <= y < H and 0 <= x < W and mask[y][x] in "#-"
    # clump noise on 2x2 blocks
    noise = {(bx, by): R.choice([-1, 0, 0, 0, 1]) for bx in range(W//3+2) for by in range(H//2+2)}
    out = [["."]*W for _ in range(H)]
    for x in range(W):
        ys = [y for y in range(H) if body(x, y)]
        if not ys: continue
    for y in range(H):
        for x in range(W):
            if not body(x, y): continue
            if mask[y][x] == "-": out[y][x] = "k"; continue
            edge = not all(body(x+dx, y+dy) for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)))
            if edge: out[y][x] = "o"; continue
            col = [yy for yy in range(H) if body(x, yy)]
            t0, t1 = col[0], col[-1]
            f = (y - t0) / max(1, t1 - t0)
            row = [xx for xx in range(W) if body(xx, y)]
            gx = (x - row[0]) / max(1, row[-1] - row[0])
            if f < top:
                v = 5 - int(gx * 2.2) - int(f / top * 1.3)
            elif f < top + 0.12:
                v = 1
            else:
                v = 2 - int((f - top) / (1 - top) * 1.8) - int(gx * 1.4)
            v += noise[((x + (y//2) % 2) // 3, y//2)]
            # top-left rim highlight
            if not body(x-1, y-1) and f < top and gx < 0.6: v += 1
            v = max(0, min(6, v))
            out[y][x] = "kdmnlhw"[v]
    for (x, y, c) in cracks:
        if out[y][x] not in ".o": out[y][x] = c
    if moss:
        for y, r in enumerate(moss):
            for x, c in enumerate(r):
                if c != "." and out[y][x] != ".":
                    out[y][x] = c
    return out

def shadow(out, dx=2, rows=2):
    """soft ground shadow under lower-right of silhouette."""
    H = len(out); W = len(out[0])
    for x in range(W):
        ys = [y for y in range(H) if out[y][x] not in ".sS"]
        if not ys: continue
        b = ys[-1]
        for k in range(1, rows+1):
            for xx in (x, x+1, x+dx) if k == 1 else (x+dx,):
                if 0 <= b+k < H and 0 <= xx < W and out[b+k][xx] == ".":
                    out[b+k][xx] = "S" if k == 1 and xx > W//3 else "s"
    return out

def rows(out): return ["".join(r) for r in out]
