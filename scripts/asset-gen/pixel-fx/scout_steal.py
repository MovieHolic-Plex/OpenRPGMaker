"""scout_steal: 훔치기. A claw swipe, a glint on the target, and a gold coin that pops out and flies back to the thief (right).
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_scout import *

KEY, SIZE, FRAMES, ANCHOR = 'scout_steal', 64, 8, 'target'
PAL = pal(GOLD, pick(SHADOW, 'd', 'm', 'v', 'l'), pick(STEEL, 's2'), WHITE)
CX, CY = 32, 36


def coin(c, x, y, rx):
    c.oval(x, y, rx + 1, 5, 'y0')
    if rx >= 2:
        c.oval(x, y, rx, 4, 'y1')
        c.oval(x - 1, y - 1, max(1, rx - 2), 2, 'y2')
        c.px(x - rx + 1, y - 2, 'y3')
    else:
        c.line([(x, y - 3), (x, y + 3)], 'y2')


def swipe(c, frac, th):
    for dy in (-5, 0, 5):
        c.blade((58, 20 + dy), (16, 46 + dy), 7, th, ['m', 'v', 'l'], frac=frac)


def sparkles(c, pts, k='y3'):
    for x, y, r in pts:
        c.spark(x, y, r, 'w', k)


def draw(c, f):
    if f == 0:
        swipe(c, 0.6, 3)
        c.spark(58, 22, 3, 'w', 'l')
    elif f == 1:
        swipe(c, 1.0, 3)
        c.spark(CX - 2, CY, 8, 'w', 'l', diag=True)
    elif f == 2:
        c.rays(CX, 30, 8, 7, 13, 'y2', rot=0.4)
        c.spark(CX, 30, 11, 'w', 'y3')
        coin(c, CX, 26, 4)
        c.line([(20, 44), (46, 30)], 'd')
    elif f == 3:
        coin(c, CX, 16, 2)
        sparkles(c, [(28, 26, 2), (36, 30, 1), (30, 34, 1)])
        c.dring(CX, 30, 12, 'y1')
    elif f == 4:
        coin(c, 36, 10, 4)
        c.spark(33, 7, 5, 'w', 'y3')
        sparkles(c, [(30, 20, 1), (40, 22, 2)])
    elif f == 5:
        c.line([(36, 12), (48, 15)], 'y1', 3)
        c.line([(38, 13), (48, 15)], 'y3')
        coin(c, 51, 15, 1)
        sparkles(c, [(42, 20, 1), (34, 16, 1)])
    elif f == 6:
        c.ddisc(50, 16, 5, 'y1')
        coin(c, 60, 19, 3)
        sparkles(c, [(44, 14, 2), (30, 24, 1)])
    elif f == 7:
        sparkles(c, [(56, 16, 2), (48, 22, 1), (38, 18, 1), (60, 26, 1)], 'y2')


# QA 2026-09-28: 칸 경계에서 직선으로 잘리던 가장자리를 디더로 걷는다(fx_edge.py). 그림 수식은 위 draw 그대로.
from fx_edge import fade_edges  # noqa: E402

_draw_body = draw


def draw(c, f):
    _draw_body(c, f)
    fade_edges(c, R=4)


if __name__ == '__main__':
    run(globals())

