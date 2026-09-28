"""scout_bomb: 연막탄 (투사체). A spinning fused bomb with a spitting fuse and a grey puff trail; flies right-to-left.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_scout import *

KEY, SIZE, FRAMES, ANCHOR = 'scout_bomb', 32, 4, 'projectile'
PAL = pal(pick(SHADOW, 'k', 'd', 'm', 'l'), pick(SMOKE, 'q1', 'q2', 'q3'), pick(WOOD, 't2'), pick(GOLD, 'y2', 'y3'), pick(FIRE, 'e2'), WHITE)
BX, BY = 12, 17


def draw(c, f):
    # trail puffs behind (to the right), drifting back
    for i in range(3):
        x = 22 + ((i * 4 + f * 2) % 12)
        r = 3.6 - ((i * 4 + f * 2) % 12) / 4.5
        k = ['q3', 'q2', 'q1'][min(2, int((x - 22) / 4))]
        c.disc(x, BY + (1 if i % 2 else -1), max(0.5, r), k)
    c.line([(24, BY - 5), (30, BY - 5)], 'q2')
    c.line([(26, BY + 5), (31, BY + 5)], 'q2')
    # bomb body
    c.disc(BX, BY, 7, 'k')
    c.disc(BX, BY, 6, 'd')
    c.arc(BX, BY, 5, 190, 260, 'm', 2)
    c.px(BX - 3, BY - 4, 'l')
    c.px(BX - 4, BY - 3, 'w')
    # spinning fuse
    a = -math.pi / 4 + f * math.pi / 2
    x0, y0 = pol(BX, BY, 6, a)
    x1, y1 = pol(BX, BY, 9, a + 0.3)
    c.rect(x0 - 1, y0 - 1, x0 + 1, y0 + 1, 'm')
    c.line([(x0, y0), (x1, y1)], 't2')
    c.spark(x1, y1, 3 if f % 2 else 2, 'w', 'y3' if f % 2 else 'e2', diag=f % 2 == 0)
    c.px(x1 + 2, y1 - 2, 'y2')


if __name__ == '__main__':
    run(globals())

