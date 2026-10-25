import sys
N = 32
PT = (3, 12, 21, 28); PL = (3, 11, 20, 28)
L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
def build(rects):
    g = [['.'] * N for _ in range(N)]; errs = []
    for k, (x0, y0, x1, y1) in enumerate(rects):
        for y in range(y0, y1):
            for x in range(x0, x1):
                if g[y][x] != '.': errs.append(f'overlap {L[k]} with {g[y][x]} at {x},{y}')
                g[y][x] = L[k]
    for y in range(N):
        for x in range(N):
            if g[y][x] == '.': errs.append(f'hole {x},{y}')
    return g, errs
def check(g):
    errs = []
    if g[0] != g[1] or g[N-1] != g[N-2]: errs.append('band rows')
    for y in range(N):
        if g[y][0] != g[y][1] or g[y][N-1] != g[y][N-2]: errs.append(f'band cols row {y}')
    for r in (0, N-1):
        ch = tuple(x for x in range(1, N) if g[r][x] != g[r][x-1])
        if ch != PT: errs.append(f'row {r} ports {ch}')
    for c in (0, N-1):
        ch = tuple(y for y in range(1, N) if g[y][c] != g[y-1][c])
        if ch != PL: errs.append(f'col {c} ports {ch}')
    n4 = [(x, y) for y in range(1, N) for x in range(1, N) if len({g[y-1][x-1], g[y-1][x], g[y][x-1], g[y][x]}) == 4]
    # straight runs: vertical joint at col x between rows: change g[y][x-1]!=g[y][x]
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
    # dangling: a joint end not meeting another joint (L corners ok)
    return errs, n4, runs[:4]
def show(g): return '\n'.join(f'{y:2d} ' + ''.join(r) for y, r in enumerate(g))
if __name__ == '__main__':
    ns = {}; exec(open(sys.argv[1]).read(), ns)
    for name in sys.argv[2:]:
        g, e = build(ns[name]); e2, n4, runs = check(g)
        print(name, e[:6], e2[:6], '4way', n4, 'longest', runs)
        print('   ' + ''.join(str(i % 10) for i in range(N)))
        print(show(g))
