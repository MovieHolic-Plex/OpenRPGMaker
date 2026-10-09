"""mon_smoke_bomb: 연막탄 (투사체, 몬스터 → 아군). An iron smoke bomb tumbling LEFT -> RIGHT, fuse spitting sparks
at the leading side, olive smoke puffs trailing behind (to the left). First cell faces right."""
import math

from lib_monster_36_52 import *

KEY, SIZE, FRAMES, ANCHOR = 'mon_smoke_bomb', 32, 4, 'projectile'
PAL = pal(IRON, pick(SOOT, 'k1', 'k2', 'k3', 'k4'), pick(WOOD, 't2'), SHOCK, pick(FIRE, 'e2', 'e3'), WHITE)
X, Y = 19, 17


def draw(c, f):
    # trailing puffs (left), drifting back and shrinking
    for i in range(3):
        u = ((i * 4 + f * 2) % 12) / 12
        x = 10 - u * 9
        r = 3.8 - u * 2.8
        k = ['k3', 'k2', 'k1'][min(2, int(u * 3))]
        c.disc(x, Y + (1 if i % 2 else -1) + u * 2, max(0.5, r), k)
        if r > 2.4:
            c.px(x - 1, Y - 2 + (1 if i % 2 else -1), 'k4')
    c.line([(2, Y - 5 + f % 2), (7, Y - 5 + f % 2)], 'k2')
    # bomb body: iron sphere lit from the upper left
    c.disc(X, Y, 7, 'i0')
    c.disc(X, Y, 6, 'i1')
    c.arc(X, Y, 5, 190, 270, 'i2', 2)
    c.px(X - 3, Y - 4, 'k4')
    c.px(X - 2, Y - 4, 'w')
    # band that turns with the tumble
    a = f * math.pi / 2
    c.line([pol(X, Y, 6, a + math.pi / 2), pol(X, Y, 6, a - math.pi / 2)], 'i0')
    # fuse cap + fuse on the leading (right-upper) side, rotating a little
    fa = -math.pi / 4 + (0.25 if f % 2 else -0.25)
    x0, y0 = pol(X, Y, 6, fa)
    x1, y1 = pol(X, Y, 10, fa - 0.2)
    c.rect(x0 - 1, y0 - 1, x0 + 1, y0 + 1, 'i2')
    c.line([(x0, y0), (x1, y1)], 't2')
    c.spark(x1, y1, 3 if f % 2 == 0 else 2, 'w', 'h2' if f % 2 == 0 else 'e3', diag=f % 2 == 1)
    c.px(x1 + 2, y1 + (1 if f % 2 else -2), 'e2')
    c.px(x1 - 1, y1 - 3 + f % 2, 'h1')


if __name__ == '__main__':
    run(globals())

