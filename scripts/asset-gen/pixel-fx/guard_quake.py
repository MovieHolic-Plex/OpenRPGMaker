"""guard_quake: 지진 내려찍기(대상별) — 발밑이 갈라지고 바위가 솟았다 떨어지며 흙먼지가 인다 (allTargets, 64px x 10). 무대 전체 고리는 guard_quake_ring."""
import math

from lib_hero import EARTH, Cell, dilate, erode, shift, radial, rays, shock, debris, run

KEY = "guard_quake"
SIZE, FRAMES, PAL = 64, 10, EARTH
CX, G = 32, 56
CRACKS = [((32, G), (18, G - 1), (8, G + 2)), ((32, G), (44, G - 2), (56, G + 1)), ((32, G), (26, G + 4)), ((32, G), (38, G + 5))]


def cracks(c: Cell, depth=1.0, cols=("k", "r", "o")):
    m = c.empty()
    for pts in CRACKS:
        n = max(2, round(len(pts) * depth + 0.49))
        m |= c.line(list(pts[:n]), 2)
    c.put(dilate(m) & c.rect(0, G - 3, 63, 63), cols[0], "over")
    c.put(m, cols[1], "over")
    c.put(m & ~shift(m, 0, 1), cols[2], "over")


def spikes(c: Cell, h):
    for x, s, hh in ((22, 5, 0.7), (32, 7, 1.0), (43, 5, 0.8)):
        H = h * hh
        if H < 2:
            continue
        m = c.poly([(x - s, G + 1), (x - s * 0.6, G - H * 0.6), (x, G - H), (x + s * 0.5, G - H * 0.55), (x + s, G + 1)])
        c.put(dilate(m), "k", "over")
        c.put(m, "d", "over")
        c.put(m & ~shift(m, 2, 0), "l", "over")
        c.put(erode(m) & shift(erode(m), -2, 0), "m", "over")


def rocks(c: Cell, t):
    debris(c, "quake", 8, CX, G - 4, t, (22, 40), ang=(215, 325), grav=46, size=2, cols=("k", "d", "m"), mode="over", rock=True)


def dust(c: Cell, r, y=G - 2):
    for i, (x, k) in enumerate(((16, 0.8), (32, 1.0), (48, 0.85))):
        c.cloud(x, y - r * 0.4, r * k, f"quake{i}", ("k", "d", "m", "l"), floor=G + 1)


def draw(c: Cell, f: int) -> None:
    if f == 0:
        cracks(c, 0.5, ("k", "d", "m"))
        c.spark(CX, G - 2, 3, ("o", "y", "w"))
    elif f == 1:
        cracks(c, 1.0)
        shock(c, CX, G, 18, 3, 1, ("d", "m", "l"))
    elif f == 2:
        cracks(c)
        spikes(c, 14)
        rocks(c, 0.2)
    elif f == 3:  # peak: spikes fully up, rocks flying, bright seam light
        cracks(c, 1.0, ("k", "o", "y"))
        spikes(c, 24)
        rocks(c, 0.42)
        shock(c, CX, G, 28, 5, 2, ("d", "m", "p"))
    elif f == 4:
        cracks(c, 1.0, ("k", "r", "o"))
        spikes(c, 20)
        rocks(c, 0.64)
        dust(c, 3)
    elif f == 5:
        cracks(c)
        spikes(c, 12)
        rocks(c, 0.86)
        dust(c, 5)
    elif f == 6:
        cracks(c, 1.0, ("k", "d", "r"))
        spikes(c, 5)
        dust(c, 6)
        rocks(c, 1.05)
    elif f == 7:
        cracks(c, 1.0, ("k", "d", "m"))
        dust(c, 6, G - 4)
        c.thin(1, c.rect(0, 0, 63, G - 4))
    elif f == 8:
        cracks(c, 1.0, ("k", "d", "d"))
        dust(c, 5, G - 6)
        c.thin(0)
    else:
        cracks(c, 0.8, ("k", "d", "d"))
        c.thin(1)


# QA 2026-09-28: 칸 경계에서 직선으로 잘리던 가장자리를 디더로 걷는다(fx_edge.py). 그림 수식은 위 draw 그대로.
from fx_edge import fade_edges  # noqa: E402

_draw_body = draw


def draw(c, f):
    _draw_body(c, f)
    fade_edges(c, B=3)


if __name__ == "__main__":
    run([KEY])

