"""dancer_fanburn: 불꽃 부채 착탄: 불꽃 부채가 활짝 펴지며 타오르고 불티가 치솟는다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'dancer_fanburn', 64, 8, 'target'
PAL = pal(EMBER, pick(ROSE, 'p1', 'p2', 'p3'), WHITE)
PX, PY = 32, 54


def draw(c, f):
    if f == 0:
        c.spark(PX, 40, 6, 'w', 'm4', diag=True)
        fan(c, PX, PY, -math.pi / 2, 10, 40, ['m2', 'm3', 'm1', 'm4'], ribs=4, edge='m1')
    elif f <= 4:
        span = [80, 120, 150, 150][f - 1]
        r = [20, 27, 30, 30][f - 1]
        fan(c, PX, PY, -math.pi / 2, r, span, ['m2', 'm3', 'm1', 'm4'], ribs=8, edge='m1')
        fan(c, PX, PY, -math.pi / 2, r * .55, span * .8, ['m3', 'm4', 'm2', 'w'], ribs=5, edge='m3')
        if f >= 2:
            for i in range(5):
                a = -math.pi / 2 + (i - 2) * .55
                x, y = PX + math.cos(a) * r, PY + math.sin(a) * r
                c.flame(x, y + 2, 7 + (f * 3 + i * 2) % 5, 3, ['m1', 'm2', 'm3', 'm4'], lean=(i - 2) * .6)
        if f == 3:
            c.ring(PX, PY, 24, 'p3', 1, squash=.3)
    else:
        k = f - 5
        for i in range(5):
            a = -math.pi / 2 + (i - 2) * .55
            x, y = PX + math.cos(a) * (28 - k * 3), PY + math.sin(a) * (28 - k * 3)
            c.flame(x, y + 2, 9 - k * 2, 3, ['m1', 'm2', 'm3'] if k < 2 else ['m1', 'm2'], lean=(i - 2) * .6)
        burst(c, PX, 40, .3 + k * .3, 10, 4, ['m4', 'm3', 'p3'], spd=(6, 22), up=1.4)
        if k == 2:
            dissolve(c, .5)


if __name__ == '__main__':
    run(globals())
