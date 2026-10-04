"""파이어볼 투사체 — 32px 4칸 루프, 머리가 왼쪽. mage_fire_burst 와 같은 FIRE 팔레트."""
import math
from lib_mage import *

KEY = 'mage_fireball_orb'; FRAME = 32; FRAMES = 4; ANCHOR = 'projectile'
PAL = Pal(F=FIRE)
PEAK = [0, 2]


def draw(c, f):
    F = PAL.F
    ph = f * math.pi / 2
    # flame tail: overlapping puffs that shrink and cool toward the back, wobbling per frame
    for k in range(7, 0, -1):
        x = 8 + k * 2.9; y = 16 + math.sin(ph + k * 1.05) * (.4 + k * .32)
        r = 6.8 - k * .78
        ramp = [F[2], F[3], F[4], F[5]][:max(1, 5 - (k + 1) // 2)]
        c.glow(x, y, r, ramp)
    # two flicker streaks sweeping off the top and bottom of the tail
    for s, off in ((-1, 0), (1, 1.7)):
        w = math.sin(ph + off)
        c.line([(12, 16 + s * 5), (19, 16 + s * (6 + w)), (25 + w * 2, 16 + s * (5 + w * 2))], F[3])
        c.line([(12, 16 + s * 4), (17, 16 + s * 5)], F[5])
    # ember specks drifting behind
    for k in range(3):
        x = 22 + ((k * 4 + f * 3) % 9); y = 16 + round(math.sin(ph * 2 + k * 2.3) * 5)
        c.px(x, y, F[5 if k % 2 else 4])
    # head: dark rim -> white core, core pushed toward the front (left)
    c.disc(9, 16, 7, F[1])
    c.disc(9, 16, 6, F[3])
    c.disc(8, 16, 4.6, F[4])
    c.disc(7, 15, 3.2, F[5])
    c.disc(6, 15, 1.8, F[6])
    c.px(6, 14, F[7]); c.px(5, 15, F[7])
    for k in range(5):
        a = math.pi * 0.55 + k * math.pi * 0.23 + (f % 2) * 0.12
        x, y = orbit(9, 16, 7, a)
        c.px(x, y, F[2 + (k + f) % 2])


if __name__ == '__main__':
    make(KEY)

