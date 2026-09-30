"""wv6 손 도트 도우미 — 도형 집합 + 자동 윤곽 + 명암. 격자는 dict[(x,y)] = (램프,단)."""
import math
def rect(x0, y0, x1, y1): return {(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)}
def ell(cx, cy, rx, ry): return {(x, y) for y in range(int(cy - ry) - 1, int(cy + ry) + 2) for x in range(int(cx - rx) - 1, int(cx + rx) + 2)
                                 if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0}
def run_shade(shape, ramp, lo, mid, hi):
    """행마다 연속 구간의 왼쪽 끝 = 밝음, 오른쪽 끝 = 어둠"""
    out = {}
    for y in {p[1] for p in shape}:
        xs = sorted(p[0] for p in shape if p[1] == y)
        i = 0
        while i < len(xs):
            j = i
            while j + 1 < len(xs) and xs[j + 1] == xs[j] + 1: j += 1
            for k in range(i, j + 1):
                out[(xs[k], y)] = (ramp, hi if k == i else lo if k == j else mid)
            i = j + 1
    return out
def blob_shade(shape, ramp, steps, cx, cy, rx, ry):
    """steps: 어두움→밝음 리스트. 북서에서 빛"""
    out = {}
    for x, y in shape:
        t = ((x - cx) / rx) * 0.5 + ((y - cy) / ry) * 0.7   # -1.2..1.2, 작을수록 밝음
        idx = int(round((1 - (t + 1.0) / 2.0) * (len(steps) - 1)))
        out[(x, y)] = (ramp, steps[max(0, min(len(steps) - 1, idx))])
    return out
def outline(px, ramp_step, other=()):
    filled = set(px) | set(other)
    o = {}
    for x, y in filled:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = (x + dx, y + dy)
            if q not in filled and q not in px: o[q] = ramp_step
    return o
def merge(*ds):
    r = {}
    for d in ds: r.update(d)
    return r
def shift(d, ox, oy): return {(x + ox, y + oy): v for (x, y), v in d.items()}
def emit(px, shadow, w, h, path, title):
    keys = sorted(set(px.values()))
    letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
    lk = {k: letters[i] for i, k in enumerate(keys)}
    L = [f'// {title}', f'@size {w} {h}', '@cell 16', '@palette palette.pal', '@layer main']
    for k, l in lk.items(): L.append(f'@mat {l} {k[0]} {k[1]}')
    L.append('@mblock 0 0')
    for y in range(h): L.append(''.join(lk.get(px.get((x, y)), '.') for x in range(w)))
    if shadow:
        L += ['@layer shadow', '@block 0 0']
        for y in range(h): L.append(''.join('-' if (x, y) in shadow else '.' for x in range(w)))
    open(path, 'w').write('\n'.join(L) + '\n')
