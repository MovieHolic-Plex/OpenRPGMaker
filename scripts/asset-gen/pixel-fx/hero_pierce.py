"""hero_pierce: 돌진 찌르기 — 오른쪽에서 왼쪽으로 꿰뚫는 창빛 (target, 64px x 8)."""
import math

from lib_hero import STEEL, Cell, dilate, erode, shift, radial, rays, shock, debris, run

KEY = "hero_pierce"
SIZE, FRAMES, PAL = 64, 8, STEEL
Y = 38
HIT = (26, Y)


def lines(c: Cell, x0, cols=("d", "m")):
    for dy, ln, col in ((-7, 14, 0), (6, 18, 0), (-3, 22, 1), (10, 10, 1)):
        c.put(c.line([(x0, Y + dy), (min(63, x0 + ln), Y + dy)]), cols[col])


def draw(c: Cell, f: int) -> None:
    if f == 0:  # wind-up: speed lines streaming in from the right, tip glint
        lines(c, 44)
        c.spark(50, Y, 3)
    elif f == 1:
        lines(c, 30, ("d", "m"))
        c.ramp(c.poly([(64, Y - 4), (64, Y + 4), (30, Y)]), ("d", "m", "l", "w"))
    elif f == 2:  # lance of light runs through the target
        lines(c, 18, ("k", "d"))
        c.ramp(c.poly([(64, Y - 5), (64, Y + 5), (4, Y)]), ("d", "m", "l", "p", "w"))
        c.spark(*HIT, 4, ("l", "p", "w"))
    elif f == 3:  # peak: pierce flash, flat ring around the lance
        c.ramp(c.poly([(64, Y - 2), (64, Y + 2), (2, Y)]), ("m", "l", "w"))
        c.ramp(c.burst(*HIT, 20, 4, 4, rot=0, sy=0.6), ("l", "p", "w"))
        shock(c, *HIT, 5, 15, 2, ("m", "l", "w"))
    elif f == 4:
        c.ramp(c.poly([(50, Y - 1), (50, Y + 1), (2, Y)]), ("d", "m"))
        c.ramp(c.burst(*HIT, 9, 3, 4, rot=45), ("l", "p", "w"))
        shock(c, HIT[0] - 4, Y, 8, 21, 2, ("d", "m", "l"))
        debris(c, "pierce", 12, *HIT, 0.5, (24, 44), ang=(150, 210), size=2)
    elif f == 5:
        shock(c, HIT[0] - 8, Y, 10, 25, 2, ("d", "m"), dither=0)
        debris(c, "pierce", 12, *HIT, 0.85, (24, 44), ang=(150, 210), size=1, cols=("m", "l", "p"))
        c.put(c.dith(c.line([(4, Y), (40, Y)])), "d")
    elif f == 6:
        debris(c, "pierce", 12, *HIT, 1.15, (24, 44), ang=(150, 210), size=1, cols=("d", "m", "l"))
        shock(c, HIT[0] - 12, Y, 11, 27, 1, ("k", "d"), dither=1)
    else:
        debris(c, "pierce", 9, *HIT, 1.4, (24, 44), ang=(150, 210), size=0, cols=("m", "l"))


# QA 2026-09-28: 칸 경계에서 직선으로 잘리던 가장자리를 디더로 걷는다(fx_edge.py). 그림 수식은 위 draw 그대로.
from fx_edge import fade_edges  # noqa: E402

_draw_body = draw


def draw(c, f):
    _draw_body(c, f)
    fade_edges(c, R=4)


if __name__ == "__main__":
    run([KEY])

