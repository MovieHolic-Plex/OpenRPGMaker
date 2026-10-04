"""ranger_frost_hit: 빙결 화살 착탄. White flash, ice spikes burst out of the ground around the target, freeze, then shatter into shards and snow.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_scout import *

KEY, SIZE, FRAMES, ANCHOR = 'ranger_frost_hit', 64, 8, 'target'
PAL = pal(FROST, WHITE, pick(STEEL, 's1'))
CX, CY, FEET = 32, 36, 56
SPIKES = [(14, 20, -0.35), (22, 32, -0.18), (32, 42, 0.0), (42, 30, 0.2), (50, 18, 0.38), (27, 24, -0.08), (37, 26, 0.1)]


def spike(c, x, h, lean):
    tip = (x + lean * h, FEET - h)
    w = max(3, h * 0.22)
    c.poly([(x - w, FEET), tip, (x + w, FEET)], 'i1', outline='i0')
    c.poly([(x - w * 0.2, FEET - 1), tip, (x + w * 0.8, FEET - 1)], 'i2')
    c.line([(x + w * 0.3, FEET - 2), (tip[0], tip[1] + 1)], 'i3')
    c.px(*tip, 'i4')


def shard(c, x, y, a, L, k):
    c.poly([(x, y), pol(x, y, L, a + 0.3), pol(x, y, L * 1.4, a), pol(x, y, L, a - 0.3)], k)


def draw(c, f):
    if f == 0:
        c.spark(CX, CY, 12, 'w', 'i3', diag=True)
        c.ring(CX, CY, 5, 'i2', 1)
        c.disc(CX, CY, 2, 'w')
    elif f == 1:
        for x, h, lean in SPIKES[:5]:
            spike(c, x, h * 0.45, lean)
        c.ring(CX, CY, 11, 'i3', 2)
        c.spark(CX, CY, 8, 'w', 'i4')
        c.oval(CX, FEET, 22, 3, 'i1', 1)
    elif f in (2, 3):
        s = 1.0 if f == 2 else 1.05
        for x, h, lean in SPIKES:
            spike(c, x, h * s, lean)
        c.oval(CX, FEET + 1, 24, 3, 'i0')
        c.line([(CX - 22, FEET), (CX + 22, FEET)], 'i2')
        if f == 2:
            c.rays(CX, CY - 4, 8, 20, 28, 'i3', rot=0.4)
            c.spark(CX, FEET - 42, 5, 'w', 'i4')
        else:
            for x, y in [(18, 30), (44, 22), (30, 12), (54, 40)]:
                c.spark(x, y, 3, 'w', 'i4', diag=True)
    elif f == 4:
        for x, h, lean in SPIKES:
            spike(c, x, h, lean)
        # crack lines + flash before shattering
        c.line([(24, 30), (32, 36), (40, 28)], 'w')
        c.line([(32, 36), (34, 48)], 'w')
        c.spark(CX, CY, 16, 'w', 'i4')
    elif f == 5:
        r = rng(2)
        for i in range(16):
            a = r.uniform(-math.pi, 0.2)
            d = r.uniform(8, 20)
            x, y = pol(CX, 42, d, a)
            shard(c, x, y, a, r.uniform(2, 4), ['i1', 'i2', 'i3'][i % 3])
        c.ring(CX, 42, 22, 'i3', 1)
        c.oval(CX, FEET + 1, 24, 3, 'i0')
    elif f == 6:
        r = rng(3)
        for i in range(14):
            a = r.uniform(-math.pi, 0.4)
            d = r.uniform(18, 28)
            x, y = pol(CX, 44, d, a)
            shard(c, x, y + 4, a + 1.2, r.uniform(1.5, 2.5), ['i2', 'i3'][i % 2])
        c.dring(CX, 42, 27, 'i2')
        c.ddisc(CX, FEET, 20, 'i1', squash=0.2)
    elif f == 7:
        r = rng(4)
        for i in range(10):
            x, y = CX + r.randint(-26, 26), 14 + r.randint(0, 36)
            c.spark(x, y, 1 if i % 3 == 0 else 0, 'w', 'i3')
        c.ddisc(CX, FEET, 16, 'i1', parity=1, squash=0.2)


if __name__ == '__main__':
    run(globals())

