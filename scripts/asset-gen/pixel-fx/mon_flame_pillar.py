"""mon_flame_pillar: 화염 폭발 (착탄, 아군 전원). The ground under the ally glows and cracks, an orange-red fire
pillar erupts through the body, roars at the peak with a white-hot core and flying embers, then collapses into smoke.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monster_18_35 import *

KEY, SIZE, FRAMES, ANCHOR = 'mon_flame_pillar', 64, 10, 'allTargets'
PAL = pal(FIRE, pick(STONE, 'o0', 'o1', 'o2'), WHITE)
PEAK = 4
FK = ['e0', 'e1', 'e2', 'e3', 'e4']


def base_glow(c, r, keys=('e1', 'e2', 'e3')):
    for i, k in enumerate(keys):
        c.oval(CX, FEET, r - i * r * 0.28, (r - i * r * 0.28) * 0.28, k)


def tongues(c, h, w, seed, keys=FK, n=5):
    r = rng(seed)
    for i in range(n):
        x = CX + (i - (n - 1) / 2) * w * 0.7 + r.uniform(-1.5, 1.5)
        hh = h * (1 - abs(i - (n - 1) / 2) / n * 0.8) * r.uniform(0.8, 1.05)
        c.flame(x, FEET, hh, w * 0.55, keys, lean=r.uniform(-3, 3))


def embers(c, n, seed, spread, top, drift=0):
    r = rng(seed)
    for i in range(n):
        x = CX + r.uniform(-spread, spread) + drift
        y = r.uniform(top, FEET - 10)
        c.diamond(x, y, 1, 1.5, 'e3' if i % 3 else 'e4')


def smoke(c, y, r, seed, keys=('o0', 'o1', 'o2')):
    c.puff(CX + 2, y, r, keys, seed=seed)


def draw(c, f):
    if f == 0:
        base_glow(c, 12, ('e0', 'e1'))
        c.crack(CX - 10, FEET, CX + 10, FEET - 1, 1, 'e3', segs=5, jit=1.5)
    elif f == 1:
        base_glow(c, 18)
        for s, (a, b) in enumerate([(-16, -4), (-2, 8), (4, 16)]):
            c.crack(CX + a, FEET + 1, CX + b, FEET - 1, s, 'e4', segs=4, jit=1.5)
        tongues(c, 10, 5, 2, FK[1:4], 3)
    elif f == 2:
        base_glow(c, 20)
        tongues(c, 26, 7, 3, FK[:4])
        embers(c, 4, 3, 14, 26)
    elif f == 3:
        base_glow(c, 22)
        c.rect(CX - 9, 8, CX + 9, FEET - 2, 'e1')
        tongues(c, 44, 8, 4)
        c.rect(CX - 4, 14, CX + 4, FEET - 4, 'e3')
        embers(c, 6, 4, 18, 12)
    elif f == 4:  # peak roar: full column, white-hot core, flared crown
        base_glow(c, 24, ('e1', 'e2', 'e4'))
        c.oval(CX, 30, 16, 26, 'e0')
        c.rect(CX - 12, 6, CX + 12, FEET - 2, 'e1')
        tongues(c, 52, 9, 5)
        c.rect(CX - 7, 10, CX + 7, FEET - 4, 'e3')
        c.rect(CX - 3, 14, CX + 3, FEET - 6, 'e4')
        c.line([(CX - 1, 16), (CX - 1, FEET - 8)], 'w', 2)
        for dx, h in ((-14, 30), (14, 34), (-6, 48), (8, 50)):
            c.flame(CX + dx, 20, 14, 3, ['e2', 'e3', 'e4'], lean=dx * 0.2)
        embers(c, 10, 5, 22, 4)
    elif f == 5:
        base_glow(c, 22)
        c.rect(CX - 10, 6, CX + 10, FEET - 2, 'e1')
        tongues(c, 50, 8, 6)
        c.rect(CX - 5, 12, CX + 5, FEET - 4, 'e3')
        c.rect(CX - 2, 16, CX + 2, FEET - 8, 'e4')
        embers(c, 10, 6, 24, 2)
    elif f == 6:  # thinning: top breaks off into smoke
        base_glow(c, 18, ('e0', 'e1', 'e2'))
        smoke(c, 12, 8, 7)
        tongues(c, 36, 7, 7, FK[:4])
        embers(c, 9, 7, 24, 6, 2)
    elif f == 7:
        base_glow(c, 16, ('e0', 'e1'))
        smoke(c, 10, 9, 8)
        smoke(c, 22, 7, 9, ('o0', 'o1'))
        tongues(c, 20, 6, 8, FK[:3], 4)
        embers(c, 7, 8, 22, 10, 3)
    elif f == 8:
        c.ddisc(CX, FEET, 14, 'e0', squash=0.3)
        smoke(c, 8, 8, 10, ('o0', 'o1'))
        smoke(c, 24, 6, 11, ('o0', 'o1'))
        tongues(c, 8, 4, 9, ['e1', 'e2'], 3)
        embers(c, 5, 9, 18, 16, 4)
    else:
        c.ddisc(CX, FEET, 12, 'e0', 1, squash=0.3)
        c.ddisc(CX + 2, 10, 9, 'o0')
        c.ddisc(CX + 4, 22, 6, 'o1', 1)
        embers(c, 4, 10, 16, 20, 5)


if __name__ == '__main__':
    run(globals())
