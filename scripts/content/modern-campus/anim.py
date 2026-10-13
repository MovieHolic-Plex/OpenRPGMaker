#!/usr/bin/env python3
"""modern_campus 애니메이션 프레임(스트립 = 프레임 4장 가로). 기본 소품 그림에 덧그림만 바꾼다. python3 anim.py"""
import json
from mc_core import *
import props_a
R = Reg('anim'); A = R.add
base = {p['id']: p for p in props_a.R.items}


def strip(id_, name, src, kind, fn, n=4):
    p = base[src]
    for f in range(n):
        def d(c, f=f, p=p, fn=fn): p['draw'](c); fn(c, f)
        A('%s-f%d' % (id_, f), '%s 프레임%d' % (name, f), p['w'], p['h'], kind, solid=p['solid'], tags=['애니메이션', id_], rules='스트립 %s: 프레임 0~%d 순환' % (id_, n - 1))(d)


def clock(c, f):
    ell = props_a.ell
    ell(c, 16, 25, 5, 4, K('shiro', 1)); pts = ((16, 21), (20, 25), (16, 29), (12, 25))[f]
    for t in range(1, 5): c.P(16 + (pts[0] - 16) * t // 4, 25 + (pts[1] - 25) * t // 4, K('sumi', 0))
    c.HL(16, 25, 3, K('sumi', 0)); c.P(16, 25, K('aka', 0))
strip('clock', '시계탑 초침', 'clock-tower', 'structure', clock)


def flag(c, f):
    c.R(10, 0, 6, 6, K('shiro', 1)); c.VL(10, 0, 8, OL)
    w = (0, 1, 0, -1)[f]
    for i in range(5):
        y = 1 + w * (1 if i in (2, 3) else 0)
        c.R(11 + i, y, 1, 4, K('aka', 0 if i % 2 else 1)); c.P(11 + i, y - 1, OL); c.P(11 + i, y + 4, OL)
strip('flag', '게양대 깃발', 'flagpole', 'column', flag)


def fount(c, f):
    import math
    props_a.ell(c, 24, 21, 16, 9, K('sora', 0)); props_a.ell(c, 24, 22, 11, 6, K('sora', 1))
    for k in range(9):
        a = math.radians(k * 40 + f * 20); x = int(24 + 14 * math.cos(a)); y = int(22 + 7 * math.sin(a)); c.P(x, y, K('shiro', 2)); c.P(x + 1, y, K('sora', 2))
    for k, (x, y) in enumerate(((19, 7), (29, 7), (17, 12), (31, 12), (24, 3), (22, 5), (26, 5))):
        c.P(x, (y + (f + k) % 3) if (f + k) % 2 else y, K('shiro', 2))
    props_a.ell(c, 24, 9, 4, 2, K('shiro', 0)); props_a.ell(c, 24, 8, 3, 1, K('shiro', 2 if f % 2 else 1))
strip('fountain', '분수 물', 'fountain', 'container', fount)


def petals_frame(f):
    def d(c):
        for i in range(10):
            x = (hsh(i, 1) % 14 + f * 1 + i) % 16; y = (hsh(i, 2) % 16 + f * 4 + i * 3) % 16
            c.P(x, y, K('pinku', 2 - i % 2)); c.P(x + 1, y + 1, K('pinku', 1))
    return d
for f in range(4): A('petals-f%d' % f, '벚꽃 낙하 프레임%d' % f, 1, 1, 'debris', tags=['애니메이션', 'petals'], rules='스트립 petals(투명 위 덧그림)')(petals_frame(f))


def leaves_frame(f):
    def d(c):
        for i in range(8):
            x = (hsh(i, 5) % 14 + f * 2 + i) % 16; y = (hsh(i, 6) % 16 + f * 4 + i * 2) % 16
            col = ('daidai', 'aka', 'kii')[i % 3]; c.R(x, y, 2, 2, K(col, 1)); c.P(x, y, K(col, 3))
    return d
for f in range(4): A('leaves-f%d' % f, '단풍 낙하 프레임%d' % f, 1, 1, 'debris', tags=['애니메이션', 'leaves'], rules='스트립 leaves(투명 위 덧그림)')(leaves_frame(f))

if __name__ == '__main__':
    metas, ims = R.export(); sheet(ims, os.path.join(OUT, R.group, 'preview.png'), W=700, z=2); print(len(metas), 'anim')
