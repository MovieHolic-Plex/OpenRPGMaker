"""guard_charge: 돌격 — 거대한 방패가 밀고 들어와 부딪히고 흙먼지·충격파가 뒤로 밀려난다 (target, 64px x 8)."""
import math

from lib_hero import CHARGE, Cell, dilate, erode, shift, radial, rays, shock, debris, run

KEY = "guard_charge"
SIZE, FRAMES, PAL = 64, 8, CHARGE
Y, G = 34, 58


def shield(c: Cell, x, lean=0, dither=None):
    """Big tower shield seen edge-on-ish: tall, face to the left."""
    m = c.poly([(x - 8, Y - 20 + lean), (x + 4, Y - 22), (x + 6, Y + 20), (x - 6, Y + 22 + lean)])
    if dither is not None:
        c.put(c.dith(dilate(m), dither), "m")
        return
    c.put(dilate(m), "k", "over")
    c.put(m, "d", "over")
    face = m & ~shift(m, 3, 0)
    c.put(face, "l", "over")
    c.put(erode(m) & shift(erode(m), -3, 0), "m", "over")
    c.put(c.line([(x - 6, Y - 2 + lean // 2), (x + 4, Y - 2)], 2), "o", "over")
    c.put(c.rect(x - 4, Y - 4, x - 2, Y), "y", "over")


def dust(c: Cell, t, k=5):
    for i in range(min(3, k)):
        x = 42 + i * 9 + t * 12
        c.cloud(x, G - 2 - t * 2, 2.5 + t * 4 - i * 0.6, f"charge{i}", ("b0", "b1", "b2", "p"), floor=G + 1)


def draw(c: Cell, f: int) -> None:
    if f == 0:
        # QA: 첫 칸 방패가 칸 오른쪽 밖으로 반쯤 잘렸다 — 몸 전체가 보이는 x 로 당긴다.
        shield(c, 53)
        for y in (18, 28, 40, 50):
            c.put(c.line([(62, y), (59, y)]), "l")
    elif f == 1:
        shield(c, 44, -2)
        for y in (16, 26, 38, 48, 54):
            c.put(c.line([(63, y), (54, y)]), "l")
        dust(c, 0.1, 3)
    elif f == 2:  # crash: flattened impact wedge in front of the shield
        c.ramp(c.burst(28, Y, 22, 7, 6, rot=0, sy=1.4), ("o", "y", "p", "w"))
        shield(c, 36, -4)
        dust(c, 0.3)
    elif f == 3:  # peak: shock ring and shove lines
        c.ramp(c.burst(26, Y, 28, 10, 8, rot=20, sy=1.2), ("d", "l", "p", "w"))
        shock(c, 26, Y, 10, 26, 2, ("m", "l", "w"))
        shield(c, 38, -4)
        dust(c, 0.5)
    elif f == 4:
        shock(c, 20, Y, 13, 28, 2, ("d", "m"), dither=0)
        c.ramp(c.burst(26, Y, 12, 5, 6, rot=10), ("o", "y", "p"))
        shield(c, 44, -2)
        dust(c, 0.75)
        debris(c, "charge", 10, 26, Y, 0.5, (26, 46), ang=(140, 220), size=2, cols=("m", "l", "w"))
    else:
        if f < 7:
            shield(c, 46 + (f - 4) * 4, 0, dither=f)
        shock(c, 16 - (f - 4) * 4, Y, 14 + (f - 4) * 2, 28 + (f - 4), 1, ("d", "m"), dither=f)
        dust(c, 0.75 + (f - 4) * 0.3)
        debris(c, "charge", 10, 26, Y, 0.5 + (f - 4) * 0.3, (26, 46), ang=(140, 220), size=1 if f < 7 else 0, cols=("m", "l", "w"))
        c.thin(f)


# QA 2026-09-28: 칸 경계에서 직선으로 잘리던 가장자리를 디더로 걷는다(fx_edge.py). 그림 수식은 위 draw 그대로.
from fx_edge import fade_edges  # noqa: E402

_draw_body = draw


def draw(c, f):
    _draw_body(c, f)
    fade_edges(c, R=2)


if __name__ == "__main__":
    run([KEY])

