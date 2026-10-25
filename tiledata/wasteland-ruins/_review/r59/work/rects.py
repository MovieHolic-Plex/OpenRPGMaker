import sys
def grid(rects, strict=True):
    g = [['.'] * 32 for _ in range(32)]; err = []
    for ch, (x0, y0, x1, y1) in rects.items():
        for y in range(y0, y1):
            for x in range(x0, x1):
                if g[y][x] != '.': err.append((ch, x, y, g[y][x]))
                g[y][x] = ch
    G = [''.join(r) for r in g]
    if any('.' in r for r in G) or err:
        print('\n'.join(f'{i:2d} {r}' for i, r in enumerate(G)), file=sys.stderr); print('overlaps', err[:5], file=sys.stderr)
        if strict: raise SystemExit('bad grid')
    return G
