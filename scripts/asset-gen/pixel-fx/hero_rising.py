"""hero_rising: 올려베기 — 발밑에서 위로 솟는 초승달 베기, 빛기둥, 위로 뜨는 파편 (target, 64px x 9)."""
import math

from lib_hero import STEEL, Cell, dilate, erode, shift, radial, rays, shock, debris, run

KEY = "hero_rising"
SIZE, FRAMES, PAL = 64, 9, STEEL
P0, P1 = (42, 60), (20, 4)
FEET = 56


def arc(c: Cell, cols, w=7, t1=1.0):
    c.ramp(c.stroke(P0, P1, -7, w, 0.0, t1), cols)


def up_chevrons(c: Cell, y, cols, dither=None):
    m = c.chevron(22, y, 6, 2) | c.chevron(42, y + 6, 5, 2) | c.chevron(32, y - 8, 7, 2)
    if dither is not None:
        m = c.dith(m, dither)
    c.ramp(m, cols, rim=dither is None)


def draw(c: Cell, f: int) -> None:
    if f == 0:  # ground glint + crack where the blade comes up
        c.ramp(c.line([(22, FEET + 1), (46, FEET + 1)]), ("d", "m", "l"))
        c.spark(40, FEET - 1, 4)
        radial(c, 32, 40, 20, 6, rot=-90, size=1, cols=("d", "m", "l"))
    elif f == 1:
        arc(c, ("d", "m", "l", "w"), 6, 0.45)
        c.spark(40, FEET - 1, 3)
    elif f == 2:
        arc(c, ("d", "m", "l", "w"), 7, 0.85)
    elif f == 3:
        arc(c, ("d", "m", "l", "p", "w"), 8)
        c.spark(*P1, 5, ("l", "p", "w"))
    elif f == 4:  # peak: pillar of light, burst on the lifted body
        c.ramp(c.poly([(26, 63), (38, 63), (34, 0), (30, 0)]), ("d", "m", "l", "w"))
        arc(c, ("m", "l", "p"), 7)
        c.ramp(c.burst(31, 30, 15, 4, 4, rot=-90, sy=1.3), ("l", "p", "w"))
        shock(c, 32, FEET, 18, 4, 1, ("m", "l"))
    elif f == 5:
        c.ramp(c.rect(30, 0, 33, 60), ("d", "m", "l"))
        arc(c, ("k", "d", "m"), 6)
        debris(c, "rising", 12, 32, 48, 0.5, (30, 54), ang=(245, 295), size=2)
        up_chevrons(c, 34, ("d", "m", "l", "p"))
        shock(c, 32, FEET, 25, 5, 1, ("d", "m"), dither=0)
    elif f == 6:
        c.put(c.dith(c.rect(31, 0, 32, 58)), "d")
        debris(c, "rising", 12, 32, 48, 0.85, (30, 54), ang=(245, 295), size=1, cols=("m", "l", "p"))
        up_chevrons(c, 24, ("d", "m", "l"))
    elif f == 7:
        debris(c, "rising", 12, 32, 48, 1.15, (30, 54), ang=(245, 295), size=1, cols=("d", "m", "l"))
        up_chevrons(c, 14, ("m",), dither=f)
    else:
        debris(c, "rising", 8, 32, 48, 1.4, (30, 54), ang=(245, 295), size=0, cols=("m", "l"))


# QA 2026-09-28: 칸 경계에서 직선으로 잘리던 가장자리를 디더로 걷는다(fx_edge.py). 그림 수식은 위 draw 그대로.
from fx_edge import fade_edges  # noqa: E402

_draw_body = draw


def draw(c, f):
    _draw_body(c, f)
    fade_edges(c, T=3, B=3)


if __name__ == "__main__":
    run([KEY])

