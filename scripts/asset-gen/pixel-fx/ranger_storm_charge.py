"""ranger_storm_charge: 폭풍의 화살 (시전자). A storm vortex wraps the ranger, lightning crackles into the bow hand, a violet-cyan flare builds.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_scout import *

KEY, SIZE, FRAMES, ANCHOR = 'ranger_storm_charge', 64, 8, 'user'
PAL = pal(STORM, pick(SMOKE, 'q1', 'q2'), WHITE)
HX, HY = 20, 32
CX, FEET = 32, 56


def draw(c, f):
    # vortex bands around the body
    for i in range(3):
        y = FEET - 6 - i * 13
        r = 20 - i * 2 + (f % 2)
        start = (f * 60 + i * 110) % 360
        c.arc(CX, y, r, start, start + 200, 'z1' if i % 2 else 'z2', 2, squash=0.3)
        c.arc(CX, y, r, start + 30, start + 110, 'z3', 1, squash=0.3)
    c.oval(CX, FEET, 18 + f % 3, 4, 'z0')
    c.oval(CX, FEET, 14, 3, 'z1', 1)
    if f >= 1:
        n = min(4, f)
        for i in range(n):
            a = i * 2 * math.pi / 4 + f * 0.9
            p0 = pol(HX, HY, 24 - f, a)
            c.bolt(p0, (HX, HY), seed=f * 7 + i, keys=['z1', 'z3', 'z4'], segs=4, jitter=3, widths=[3, 1, 1])
    core = [1, 2, 3, 4, 5, 6, 7, 5][f]
    c.disc(HX, HY, core + 2, 'z1')
    c.disc(HX, HY, core, 'z3')
    c.disc(HX, HY, max(0.5, core - 2), 'w')
    if f >= 5:
        c.spark(HX, HY, 8 + (f - 5) * 4, 'w', 'z4', diag=True)
        c.ring(HX, HY, core + 6, 'zy', 1)
    if f == 7:
        c.dring(HX, HY, 18, 'z2')
        c.rays(HX, HY, 10, 10, 18, 'z3', rot=0.2, jitter=[1, 0.7])
    for i in range(5):
        x = 12 + i * 9 + (f * 3) % 4
        y = FEET - 4 - ((f * 5 + i * 11) % 44)
        c.px(x, y, 'z4' if i % 2 else 'zy')


if __name__ == '__main__':
    run(globals())

