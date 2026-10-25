import random, sys, json
from lay2 import N, PT, PL, build, check, show
TOPSEG = [(0, PT[0])] + [(PT[i], PT[i+1]) for i in range(len(PT)-1)] + [(PT[-1], N)]
LEFTSEG = [(0, PL[0])] + [(PL[i], PL[i+1]) for i in range(len(PL)-1)] + [(PL[-1], N)]
def ok_span(a, b, segs):
    return (a, b) in segs
def okx(x0, x1): return (x0 == 0 or 3 <= x0 <= 29) and (x1 == N or 3 <= x1 <= 29)
def gen(rng, tries=4000):
    g = [[-1] * N for _ in range(N)]; rects = []
    def first_empty():
        for y in range(N):
            for x in range(N):
                if g[y][x] < 0: return x, y
        return None
    steps = 0
    def rec():
        nonlocal steps
        steps += 1
        if steps > tries: return False
        p = first_empty()
        if p is None: return True
        x0, y0 = p
        # max width available in row y0 from x0
        mw = 0
        while x0 + mw < N and g[y0][x0 + mw] < 0: mw += 1
        cands = []
        for w in range(2, mw + 1):
            x1 = x0 + w
            if not okx(x0, x1): continue
            # max height for this width
            mh = 0
            while y0 + mh < N and all(g[y0 + mh][x] < 0 for x in range(x0, x1)): mh += 1
            for h in range(2, mh + 1):
                y1 = y0 + h
                if not okx(y0, y1): continue
                if y0 == 0 and (x0, x1) not in TOPSEG: continue
                if y1 == N and (x0, x1) not in TOPSEG: continue
                if x0 == 0 and (y0, y1) not in LEFTSEG: continue
                if x1 == N and (y0, y1) not in LEFTSEG: continue
                edge = x0 == 0 or y0 == 0 or x1 == N or y1 == N
                mn = 2 if edge else 4
                if min(w, h) < mn: continue
                if max(w, h) > 13: continue
                if not edge and max(w, h) / min(w, h) > 2.2: continue
                # avoid tiny leftover gaps to the right in this row
                rem = mw - w
                if 0 < rem < 2: continue
                score = rng.random() * 1.5 + (1.0 if 6 <= w <= 11 else 0) + (1.0 if 5 <= h <= 10 else 0)
                cont = 0
                if y0 > 0:
                    if 0 < x0 and g[y0-1][x0-1] != g[y0-1][x0]: cont += 1          # left edge continues a joint above
                    if x1 < N and g[y0-1][x1-1] != g[y0-1][x1]: cont += 1
                if x0 > 0 and y1 < N and g[y1-1][x0-1] >= 0 and g[y1][x0-1] >= 0 and g[y1-1][x0-1] != g[y1][x0-1]: cont += 1   # bottom continues a joint to the left
                if x0 > 0 and y0 > 0 and g[y0-1][x0-1] != g[y0][x0-1]: cont += 1     # top edge continues a joint to the left
                score -= 5 * cont
                cands.append((score, x1, y1))
        cands.sort(reverse=True)
        for _, x1, y1 in cands[:3]:
            for y in range(y0, y1):
                for x in range(x0, x1): g[y][x] = len(rects)
            rects.append((x0, y0, x1, y1))
            if rec(): return True
            rects.pop()
            for y in range(y0, y1):
                for x in range(x0, x1): g[y][x] = -1
        return False
    return rects if rec() else None
if __name__ == '__main__':
    out = []
    for sd in range(int(sys.argv[1]), int(sys.argv[2])):
        r = gen(random.Random(sd))
        if not r: continue
        gg, e = build(r); e2, n4, runs = check(gg)
        if e or e2: continue
        if len(n4) > 3 or runs[0][0] > 20: continue
        out.append(dict(seed=sd, n4=len(n4), longest=runs[0][0], n=len(r), rects=r))
    json.dump(out, open(sys.argv[3], 'w'))
    print(len(out))
