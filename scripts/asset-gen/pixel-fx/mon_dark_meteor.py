"""mon_dark_meteor: 암흑 운석 (투사체, 몬스터 → 아군). A black meteor wrapped in violet fire, flying LEFT -> RIGHT
and dipping down-right; the flame tail streams back to the upper left. First cell faces right."""
import math

from lib_monster_36_52 import *

KEY, SIZE, FRAMES, ANCHOR = 'mon_dark_meteor', 32, 4, 'projectile'
PAL = pal(DARK, CRIM, pick(ROCK, 'o0', 'o1'), WHITE)
HX, HY = 21, 19
ANG = math.radians(200)          # tail direction: back to the upper left


def draw(c, f):
    ux, uy = math.cos(ANG), math.sin(ANG)
    vx, vy = -uy, ux
    # flame tail: layered tapering tongues, licking with f
    for i, (k, L, w) in enumerate((('v1', 20, 7), ('v2', 17, 5.5), ('v3', 13, 4), ('c2', 8, 2.5), ('v4', 6, 1.6))):
        wob = math.sin(f * math.pi / 2 + i) * 1.2
        pts = [(HX + vx * w, HY + vy * w), (HX + ux * L * 0.55 + vx * (w * 0.7 + wob), HY + uy * L * 0.55 + vy * (w * 0.7 + wob)),
               (HX + ux * L + vx * wob, HY + uy * L + vy * wob),
               (HX + ux * L * 0.5 - vx * (w * 0.6 - wob), HY + uy * L * 0.5 - vy * (w * 0.6 - wob)), (HX - vx * w, HY - vy * w)]
        c.poly(pts, k)
    # loose flame flecks peeling off the tail
    for j in range(3):
        d = 10 + ((j * 5 + f * 3) % 12)
        s = (1 if j % 2 else -1) * (3 + j)
        c.px(HX + ux * d + vx * s, HY + uy * d + vy * s, 'v3' if j else 'c3')
    # rock head
    c.disc(HX, HY, 6, 'c1')
    c.disc(HX, HY, 5, 'v0')
    c.disc(HX - 1, HY - 1, 3, 'o0')
    c.arc(HX, HY, 4, 250 + f * 90, 330 + f * 90, 'o1', 1)
    c.arc(HX, HY, 5, 300, 60, 'c2', 1)
    c.px(HX + 3, HY - 3, 'v5')
    c.px(HX + 4, HY - 2, 'w')


if __name__ == '__main__':
    run(globals())

