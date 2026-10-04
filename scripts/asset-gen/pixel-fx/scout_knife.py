"""scout_knife: 비수 폭풍 (투사체). A tight volley of three throwing knives, tips left, with violet speed streaks.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_scout import *

KEY, SIZE, FRAMES, ANCHOR = 'scout_knife', 32, 4, 'projectile'
PAL = pal(STEEL, pick(SHADOW, 'd', 'm', 'v', 'l'), WHITE)


def knife(c, x, y, streak, glint):
    c.line([(x + 12, y), (x + 12 + streak, y)], 'v')
    c.line([(x + 14, y), (x + 14 + streak // 2, y)], 'l')
    c.poly([(x, y), (x + 3, y - 2), (x + 8, y - 2), (x + 8, y + 1), (x + 3, y + 1)], 's1')
    c.line([(x + 1, y - 1), (x + 7, y - 1)], 's2')
    c.line([(x + 2, y + 1), (x + 7, y + 1)], 's0')
    c.line([(x + 9, y - 3), (x + 9, y + 2)], 'd')
    c.line([(x + 10, y), (x + 12, y)], 'm', 2)
    c.px(x + 13, y, 'v')
    if glint:
        c.spark(x + 1, y - 1, 2, 'w', 's2')


def draw(c, f):
    jit = [(0, 0, 0), (1, 0, -1), (0, 1, 0), (-1, 0, 1)][f]
    knife(c, 3 + jit[0], 9, 6 + 2 * (f % 2), f == 0)
    knife(c, 8 + jit[1], 16, 4 + 2 * ((f + 1) % 2), f in (1, 3))
    knife(c, 2 + jit[2], 23, 7 - (f % 2) * 2, f == 2)


if __name__ == '__main__':
    run(globals())

