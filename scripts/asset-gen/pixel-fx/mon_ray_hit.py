"""mon_ray_hit: 마안 광선 (착탄). The magenta ray strikes the ally's chest, a glaring eye sigil opens over the body,
grey stone creeps up from the feet (petrify) and cracks with a violet flash at the peak, then the sigil closes.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monster_18_35 import *

KEY, SIZE, FRAMES, ANCHOR = 'mon_ray_hit', 64, 8, 'target'
PAL = pal(EYE, pick(STONE, 'o0', 'o1', 'o2', 'o3'), WHITE)
PEAK = 4
HIT = (CX - 4, 38)


def sigil(c, r, open_, turn=0.0):
    c.ring(CX, CY - 2, r, 'q2', 1)
    c.dring(CX, CY - 2, r + 3, 'q1')
    for i in range(6):
        a = turn + i * math.pi / 3
        c.diamond(*pol(CX, CY - 2, r, a), 1.5, 1.5, 'q3')
    c.eye(CX, CY - 2, r * 0.62, r * 0.42, open_, 'q1', 'q4', ('q2', 'q3'), 'q0')


def stone(c, h, cracks=False, seed=0):
    """Stone crust over the lower body, h px high from the feet."""
    top = FEET - h
    c.poly([(CX - 12, FEET + 1), (CX - 11, top + 3), (CX - 6, top), (CX, top + 2), (CX + 6, top - 1),
            (CX + 11, top + 3), (CX + 12, FEET + 1)], 'o1')
    c.poly([(CX - 10, FEET - 1), (CX - 9, top + 4), (CX - 5, top + 2), (CX - 1, top + 4), (CX - 3, FEET - 1)], 'o2')
    c.line([(CX - 9, top + 4), (CX - 5, top + 2)], 'o3')
    c.line([(CX - 12, FEET + 1), (CX + 12, FEET + 1)], 'o0')
    if cracks:
        c.crack(CX - 6, top + 3, CX + 2, FEET - 2, seed, 'o0', segs=3, jit=1.5)
        c.crack(CX + 6, top + 2, CX + 9, FEET - 3, seed + 1, 'o0', segs=3, jit=1.5)


def draw(c, f):
    if f == 0:
        c.lens((0, HIT[1]), HIT, 2.5, ['q2', 'q4'])
        c.spark(*HIT, 4, 'w', 'q3')
    elif f == 1:
        c.lens((0, HIT[1]), HIT, 2, ['q2', 'q3'])
        c.ring(*HIT, 6, 'q3', 2)
        c.spark(*HIT, 6, 'w', 'q4', diag=True)
        stone(c, 4)
    elif f == 2:
        sigil(c, 16, 0.4, 0.0)
        stone(c, 10)
    elif f == 3:
        sigil(c, 18, 1.0, 0.3)
        stone(c, 16)
    elif f == 4:  # peak: eye glares, stone to the chest, violet flash
        c.rays(CX, CY - 2, 14, 20, 28, 'q2', rot=0.1)
        sigil(c, 19, 1.0, 0.6)
        stone(c, 22, cracks=True, seed=4)
        c.spark(CX + 12, CY - 14, 5, 'w', 'q4', diag=True)
        c.spark(CX - 14, CY + 4, 3, 'w', 'q3')
    elif f == 5:
        sigil(c, 18, 0.6, 0.9)
        stone(c, 22, cracks=True, seed=5)
        motes(c, CX, CY, 6, 20, 26, 5, ['q3', 'q2'])
    elif f == 6:
        c.dring(CX, CY - 2, 20, 'q2')
        c.eye(CX, CY - 2, 11, 8, 0.1, 'q1', 'q3', ('q2',), 'q0')
        stone(c, 18, cracks=True, seed=6)
    else:
        stone(c, 12, cracks=True, seed=7)
        motes(c, CX, FEET - 12, 8, 8, 18, 7, ['o2', 'o3', 'q2'], sq=0.6, dy=-4)


if __name__ == '__main__':
    run(globals())
