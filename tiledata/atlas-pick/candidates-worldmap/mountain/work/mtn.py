import sys
from w3lib import *

def torus_put(g):
    def put(x, y, c):
        g[y % 16][x % 16] = c
    return put

def peak(put, cx, ay, h, w, jl=None, jr=None, rg=None, cre=(), snow=None, wrapx=True):
    jl = jl or {}; jr = jr or {}; rg = rg or {}
    for i in range(h + 1):
        y = ay + i
        hw = int(round(w * (i + 0.6) / (h + 0.6)))
        hl = max(0, hw + jl.get(i, 0)); hr = max(0, hw + jr.get(i, 0)); r = rg.get(i, 0)
        for dx in range(-hl, hr + 1):
            if dx == -hl and hl > 0: c = 'M'
            elif dx == hr and hr > 0: c = 'O'
            elif dx < r: c = 'L'
            elif dx == r: c = 'h'
            else: c = 'R'
            if i == h: c = 'D' if dx > r else 'M'
            if snow is not None:
                lim = snow.get(dx, snow.get('d', -1))
                if i <= lim:
                    if dx == -hl and hl > 0: c = 'u'
                    elif dx == hr and hr > 0: c = 'v'
                    elif i == lim: c = 'u' if dx <= r else 'v'
                    elif dx < r: c = 'W'
                    elif dx == r: c = 'H'
                    else: c = 'V'
            put(cx + dx, y, c)
    for (i, dx, c) in cre: put(cx + dx, ay + i, c)

def body(peaks, bg, flat=()):
    g = [[bg] * 16 for _ in range(16)]
    put = torus_put(g)
    for p in peaks: peak(put, **p)
    for (x, y, c) in flat: g[y % 16][x % 16] = c
    return g

def show(g):
    return '\n'.join(''.join(r) for r in g)

def mapg(g, pal):
    return [[None if c == '.' else pal[c] for c in r] for r in g]
