"""pinwheel + guillotine layout generator on a 32x32 char block (1 char = 4px). Virtual block edges; ports fixed."""
import random, sys, json
N = 32
PT = (5, 15, 24)      # cols where vertical joints cross top/bottom edges
PL = (7, 18, 27)      # rows where horizontal joints cross left/right edges
LO, HI = 3, 29

def gen(rng, pin):
    cx0, cx1, cy0, cy1, mirror = pin
    # regions: (x0,y0,x1,y1); sides virtual if on block edge
    if not mirror:
        regs = [(0, 0, cx1, cy0), (cx1, 0, N, cy1), (cx0, cy1, N, N), (0, cy0, cx0, N), (cx0, cy0, cx1, cy1)]
        segs = [('v', cx1, 0, cy1), ('h', cy1, cx0, N), ('v', cx0, cy0, N), ('h', cy0, 0, cx1)]
    else:
        regs = [(cx0, 0, N, cy0), (0, 0, cx0, cy1), (0, cy1, cx1, N), (cx1, cy0, N, N), (cx0, cy0, cx1, cy1)]
        segs = [('v', cx0, 0, cy1), ('h', cy1, 0, cx1), ('v', cx1, cy0, N), ('h', cy0, cx0, N)]
    out = []
    def split(r, depth):
        x0, y0, x1, y1 = r; w, h = x1 - x0, y1 - y0
        big = max(w, h)
        want = big > 11 or (big > 7 and rng.random() < 0.55) or w * h > 80
        if not want or depth > 6: out.append(r); return
        opts = []
        def bad4(o, k, a, b):
            for (o2, k2, a2, b2) in segs:
                if o2 == o and k2 == k and (b2 == a or a2 == b): return True
            return False
        mnx = lambda lo, hi: 3 if (lo == 0 or hi == N) else 4
        # vertical split at col x: ends on top (y0) and bottom (y1)
        for x in range(x0 + 1, x1):
            if not (LO <= x <= HI): continue
            if x - x0 < mnx(x0, x) or x1 - x < mnx(x, x1): continue
            if y0 == 0 and x not in PT: continue
            if y1 == N and x not in PT: continue
            opts.append(('v', x, (w / max(h, 1)) * (0.25 if bad4('v', x, y0, y1) else 1)))
        for y in range(y0 + 1, y1):
            if not (LO <= y <= HI): continue
            if y - y0 < mnx(y0, y) or y1 - y < mnx(y, y1): continue
            if x0 == 0 and y not in PL: continue
            if x1 == N and y not in PL: continue
            opts.append(('h', y, (h / max(w, 1)) * (0.25 if bad4('h', y, x0, x1) else 1)))
        if not opts: out.append(r); return
        wts = [o[2] ** 2 for o in opts]
        o = rng.choices(opts, wts)[0]
        if o[0] == 'v':
            segs.append(('v', o[1], y0, y1)); split((x0, y0, o[1], y1), depth + 1); split((o[1], y0, x1, y1), depth + 1)
        else:
            segs.append(('h', o[1], x0, x1)); split((x0, y0, x1, o[1]), depth + 1); split((x0, o[1], x1, y1), depth + 1)
    for r in regs: split(r, 0)
    return out, segs

def grid_of(rects):
    g = [[-1] * N for _ in range(N)]
    for k, (x0, y0, x1, y1) in enumerate(rects):
        for y in range(y0, y1):
            for x in range(x0, x1): g[y][x] = k
    return g

def score(rects, segs):
    g = grid_of(rects)
    # ports present exactly
    top = tuple(x for x in range(1, N) if g[0][x] != g[0][x - 1]); bot = tuple(x for x in range(1, N) if g[N-1][x] != g[N-1][x - 1])
    lef = tuple(y for y in range(1, N) if g[y][0] != g[y - 1][0]); rig = tuple(y for y in range(1, N) if g[y][N-1] != g[y - 1][N-1])
    if (top, bot, lef, rig) != (PT, PT, PL, PL): return None
    if g[0] != g[1] or g[N-1] != g[N-2]: return None
    for y in range(N):
        if g[y][0] != g[y][1] or g[y][N-1] != g[y][N-2]: return None
    n4 = 0
    for y in range(1, N):
        for x in range(1, N):
            if len({g[y-1][x-1], g[y-1][x], g[y][x-1], g[y][x]}) == 4: n4 += 1
    if n4 > 3: return None
    s = -n4 * 1.0
    for (x0, y0, x1, y1) in rects:
        w, h = x1 - x0, y1 - y0
        edge = x0 == 0 or y0 == 0 or x1 == N or y1 == N
        if min(w, h) < (3 if edge else 4): return None
        if max(w, h) > 14: s -= 3
        if max(w, h) / min(w, h) > 2.8 and not edge: s -= 2
    # longest straight joint run (merge collinear segments)
    runs = {}
    for (o, k, a, b) in segs:
        runs.setdefault((o, k), []).append((a, b))
    longest = 0
    for key, iv in runs.items():
        iv.sort(); cur = None
        for a, b in iv:
            if cur and a <= cur[1]: cur = (cur[0], max(cur[1], b))
            else:
                if cur: longest = max(longest, cur[1] - cur[0])
                cur = (a, b)
        if cur: longest = max(longest, cur[1] - cur[0])
    if longest > 17: return None
    s -= longest * 0.15
    n = len(rects)
    s -= abs(n - 15) * 0.4
    return s

if __name__ == '__main__':
    pin = tuple(int(v) for v in sys.argv[1].split(','))
    seed0 = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    best = []
    for sd in range(seed0, seed0 + 40000):
        rng = random.Random(sd)
        rects, segs = gen(rng, pin)
        sc = score(rects, segs)
        if sc is None: continue
        best.append((sc, sd, rects))
    best.sort(key=lambda t: -t[0])
    print(len(best))
    json.dump([dict(score=s, seed=sd, rects=r) for s, sd, r in best[:12]], open(sys.argv[3], 'w'))
