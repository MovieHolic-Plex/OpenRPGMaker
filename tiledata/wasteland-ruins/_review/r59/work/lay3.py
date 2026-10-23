import sys
from lay2 import N, show
PT = (4, 12, 20, 28); PL = (4, 12, 20, 28)
def chk(G, name):
    assert len(G) == 32 and all(len(r) == 32 for r in G), [len(r) for r in G]
    g = [list(r) for r in G]; errs = []
    for a, b in ((0, 1), (1, 2), (29, 30), (30, 31)):
        if g[a] != g[b]: errs.append(f'rows {a},{b}')
        if [r[a] for r in g] != [r[b] for r in g]: errs.append(f'cols {a},{b}')
    for r in (0, 31):
        ch = tuple(x for x in range(1, N) if g[r][x] != g[r][x-1])
        if ch != PT: errs.append(f'row {r} ports {ch}')
    for c in (0, 31):
        ch = tuple(y for y in range(1, N) if g[y][c] != g[y-1][c])
        if ch != PL: errs.append(f'col {c} ports {ch}')
    # rect-ness and connectivity
    lets = {}
    for y in range(N):
        for x in range(N): lets.setdefault(g[y][x], []).append((x, y))
    info = []
    for ch, cells in lets.items():
        xs = [c[0] for c in cells]; ys = [c[1] for c in cells]
        w, h = max(xs) - min(xs) + 1, max(ys) - min(ys) + 1
        if w * h != len(cells): errs.append(f'{ch} not rect')
        edge = min(xs) == 0 or min(ys) == 0 or max(xs) == 31 or max(ys) == 31
        if min(w, h) < (3 if edge else 4): errs.append(f'{ch} small {w}x{h}')
        info.append((ch, w, h))
    n4 = [(x, y) for y in range(1, N) for x in range(1, N) if len({g[y-1][x-1], g[y-1][x], g[y][x-1], g[y][x]}) == 4]
    runs = []
    for x in range(1, N):
        r = 0
        for y in range(N + 1):
            if y < N and g[y][x-1] != g[y][x]: r += 1
            else:
                if r: runs.append((r, 'v', x, y - r))
                r = 0
    for y in range(1, N):
        r = 0
        for x in range(N + 1):
            if x < N and g[y-1][x] != g[y][x]: r += 1
            else:
                if r: runs.append((r, 'h', y, x - r))
                r = 0
    runs.sort(reverse=True)
    print(name, 'ERR' if errs else 'ok', errs[:8], '4way', n4, 'runs', runs[:5], 'slabs', len(lets))
    return not errs
if __name__ == '__main__':
    ns = {}; exec(open(sys.argv[1]).read(), ns)
    for n in sys.argv[2:]: chk(ns[n], n)
