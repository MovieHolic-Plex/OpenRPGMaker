"""guard_fortress_slam: 요새 착탄(대상별) — 방패 밑면이 대상 위로 떨어져 납작 누르고 흙먼지·별이 튄다 (allTargets, 64px x 8)."""
import math

from lib_hero import FORT, Cell, dilate, erode, shift, radial, rays, shock, debris, run

KEY = "guard_fortress_slam"
SIZE, FRAMES, PAL = 64, 8, FORT
CX, G = 32, 58


def slab(c: Cell, bottom, dither=None):
    """Bottom edge of the falling tower shield entering from the top of the cell."""
    m = c.rect(10, 0, 54, bottom) & c.poly([(10, -40), (54, -40), (54, bottom), (32, bottom + 4), (10, bottom)])
    if dither is not None:
        c.put(c.dith(m, dither), "d")
        return
    c.put(dilate(m), "k", "over")
    c.put(m, "d", "over")
    c.put(erode(m) & ~shift(erode(m), 3, 0), "l", "over")
    c.put(erode(m, 2) & shift(erode(m, 2), 3, 0), "m", "over")
    c.put(m & ~shift(m, 0, -3), "g", "over")          # gold rim along the bottom


def dust(c: Cell, r):
    for i, (x, k) in enumerate(((12, 0.85), (32, 0.7), (52, 0.85))):
        c.cloud(x, G - 1 - r * 0.35, r * k, f"fs{i}", ("b0", "b1", "b2", "p"), floor=G + 1)


def draw(c: Cell, f: int) -> None:
    if f == 0:
        c.ramp(c.ellipse(CX, G, 20, 3), ("k", "d"))
        slab(c, 8)
        for x in (14, 50):
            c.put(c.line([(x, 12), (x, 22)]), "l")
    elif f == 1:
        c.ramp(c.ellipse(CX, G, 22, 3), ("k", "d", "m"))
        slab(c, 34)
        for x in (8, 56):
            c.put(c.line([(x, 20), (x, 36)]), "l")
    elif f == 2:  # impact
        slab(c, G - 2)
        c.ramp(c.burst(CX, G - 2, 28, 6, 8, rot=0, sy=0.35), ("g", "y", "w"))
        shock(c, CX, G, 30, 5, 2, ("m", "l", "w"))
    elif f == 3:  # peak
        slab(c, G - 4)
        rays(c, CX, G, 6, 20, 34, 3, rot=-90 - 75, cols=("gd", "g", "y"))
        dust(c, 4)
        debris(c, "fortress_slam", 10, CX, G - 4, 0.35, (26, 44), ang=(195, 345), grav=30, size=2, cols=("gd", "g", "y"))
    elif f == 4:
        slab(c, G - 10)
        dust(c, 6)
        debris(c, "fortress_slam", 10, CX, G - 4, 0.6, (26, 44), ang=(195, 345), grav=30, size=1, cols=("gd", "g", "y"))
    elif f == 5:
        slab(c, 14)                                       # the shield lifts away
        c.thin(0, c.rect(0, 0, 63, 16))
        dust(c, 7)
        debris(c, "fortress_slam", 10, CX, G - 4, 0.85, (26, 44), ang=(195, 345), grav=30, size=1, cols=("gd", "g", "y"))
    elif f == 6:
        dust(c, 7)
        c.thin(1, c.rect(0, 0, 63, G - 6))
        for k in range(3):
            a = math.radians(f * 60 + k * 120)
            c.ramp(c.star5(CX + math.cos(a) * 12, 22 + math.sin(a) * 4, 3), ("gd", "g", "y"))
    else:
        dust(c, 6)
        c.thin(0)
        for k in range(3):
            a = math.radians(f * 60 + k * 120)
            c.ramp(c.star5(CX + math.cos(a) * 12, 22 + math.sin(a) * 4, 3), ("gd", "g", "y"))


# QA 2026-09-28: 칸 경계에서 직선으로 잘리던 가장자리를 디더로 걷는다(fx_edge.py). 그림 수식은 위 draw 그대로.
from fx_edge import fade_edges  # noqa: E402

_draw_body = draw


def draw(c, f):
    _draw_body(c, f)
    # 방패 밑면은 화면 층(guard_fortress_wall)이 내리꽂은 방패의 끝이라 위에서 들어오는 게 맞다 — 위는 걷지 않는다.
    fade_edges(c, L=2, R=2)


if __name__ == "__main__":
    run([KEY])

