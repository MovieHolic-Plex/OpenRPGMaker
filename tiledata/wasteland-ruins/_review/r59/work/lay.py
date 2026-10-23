# layout designer: paint rects on 32x32 char grid (1 char = 4 px)
import sys
PT = (5, 15, 24)   # top/bottom port cols
PL = (7, 18, 27)   # left/right port rows
def frame():
    g = [[None]*32 for _ in range(32)]
    return g
def paint(g, rects):
    for (ch, x0, y0, x1, y1) in rects:
        for y in range(y0, y1):
            for x in range(x0, x1): g[y][x] = ch
    return g
def check(g, name):
    errs = []
    for y in range(32):
        for x in range(32):
            if g[y][x] is None: errs.append(f'hole {x},{y}')
    if errs: return errs[:10]
    for r in (0, 30):
        if g[r] != g[r+1]: errs.append(f'rows {r},{r+1} differ')
    for c in (0, 30):
        if [g[y][c] for y in range(32)] != [g[y][c+1] for y in range(32)]: errs.append(f'cols {c},{c+1} differ')
    for r in (0, 31):
        ch = [x for x in range(1, 32) if g[r][x] != g[r][x-1]]
        if tuple(ch) != PT: errs.append(f'row {r} changes {ch}')
    for c in (0, 31):
        ch = [y for y in range(1, 32) if g[y][c] != g[y-1][c]]
        if tuple(ch) != PL: errs.append(f'col {c} changes {ch}')
    # connected letters
    seen = set(); comps = {}
    for y in range(32):
        for x in range(32):
            if (x, y) in seen: continue
            ch = g[y][x]; st = [(x, y)]; cells = []
            while st:
                p = st.pop()
                if p in seen: continue
                px, py = p
                if not (0 <= px < 32 and 0 <= py < 32) or g[py][px] != ch: continue
                seen.add(p); cells.append(p); st += [(px+1,py),(px-1,py),(px,py+1),(px,py-1)]
            if ch in comps: errs.append(f'letter {ch} split')
            comps[ch] = cells
    for ch, cells in comps.items():
        xs = [c[0] for c in cells]; ys = [c[1] for c in cells]
        # min thickness: every row run and column run >= 3 chars
        for y in set(ys):
            run = sorted(c[0] for c in cells if c[1] == y)
            if len(run) < 3 and not (min(ys) == 0 or max(ys) == 31): errs.append(f'{ch} thin row {y}')
        for x in set(xs):
            run = [c for c in cells if c[0] == x]
            if len(run) < 3 and not (min(xs) == 0 or max(xs) == 31): errs.append(f'{ch} thin col {x}')
    # 4-way crosses
    for y in range(1, 32):
        for x in range(1, 32):
            q = {g[y-1][x-1], g[y-1][x], g[y][x-1], g[y][x]}
            if len(q) == 4: errs.append(f'4way at {x},{y}')
    return errs
def show(g):
    return '\n'.join(''.join(r) for r in g)
