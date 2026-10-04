"""mon_boulder: 바위 던지기 (투사체, 몬스터 → 아군). A tumbling boulder hurled LEFT -> RIGHT with a dust
wake behind it (left). First cell faces right: the lit, leading face is on the right-top."""
import math

from lib_monster_36_52 import *

KEY, SIZE, FRAMES, ANCHOR = 'mon_boulder', 32, 4, 'projectile'
PAL = pal(ROCK, DUST, WHITE)
X, Y = 18, 16


def draw(c, f):
    # dust wake (left), speed lines
    for i in range(3):
        u = ((i * 4 + f * 3) % 12) / 12
        x = 8 - u * 7
        c.disc(x, Y + 3 - u * 2 + (i % 2), max(0.5, 3.2 - u * 2.4), ['u3', 'u2', 'u1'][min(2, int(u * 3))])
    for j, yy in enumerate((Y - 6, Y + 1, Y + 7)):
        x0 = 1 + (f + j) % 3
        c.line([(x0, yy), (x0 + 5 - j, yy)], 'u2' if j != 1 else 'u3')
    rock(c, X, Y, 9, f * math.pi / 2 + 0.3, ('o0', 'o1', 'o2', 'o3', 'o4'), seed=5)
    # grit shaken off the rim
    r = rng(f + 11)
    for i in range(3):
        a = r.uniform(math.pi * 0.6, math.pi * 1.4)
        c.px(*pol(X, Y, 11 + r.uniform(0, 2), a), 'u1')
    c.px(X + 5, Y - 6, 'w' if f % 2 == 0 else 'o4')


if __name__ == '__main__':
    run(globals())

