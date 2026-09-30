from h5_lib import *
L = {}
def _r(name, chars):
    for i, ch in enumerate(chars): L[ch] = (name, i)
_r('tin', '0123456'); _r('rust', 'abcdef'); _r('grave', 'ghijklm'); _r('hmoss', 'nopqr')
_r('night', 'stuvwx'); _r('rot', 'ABCDEFG'); _r('board', 'HIJKL'); _r('dust', 'MNOPQR')
_r('blood', 'STUVWX'); _r('murk', 'yzYZ:;,'); _r('moon', '@=<>/|'); _r('tarn', '()[]{}')
def shear(c, f):
    """행마다 가로로 밀어(기울임) — 손으로 정한 함수 f(y)->dx"""
    g = [r[:] for r in c.g]
    c.g = [['.'] * c.w for _ in range(c.h)]
    for y in range(c.h):
        d = f(y)
        for x in range(c.w):
            if g[y][x] != '.' and 0 <= x + d < c.w: c.g[y][x + d] = g[y][x]
