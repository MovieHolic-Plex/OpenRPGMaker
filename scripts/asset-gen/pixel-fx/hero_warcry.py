"""hero_warcry: 함성 — 시전자에게서 퍼지는 충격파 고리와 솟는 공격 강화 화살표 (user, 128px x 10)."""
import math

from lib_hero import WAR, Cell, dilate, erode, shift, radial, rays, shock, debris, run

KEY = "hero_warcry"
SIZE, FRAMES, PAL = 128, 10, WAR
CX, CY = 64, 100  # chest height of a 48px battler whose feet rest on row 120


def ring(c: Cell, r, w, cols, dither=None):
    # flattened so the wave reads as spreading over the ground and never hits the cell floor
    shock(c, CX, CY, min(r, 60), min(r * 0.42, 24), w, cols, dither)


def chevrons(c: Cell, dy, cols, dither=None):
    m = c.empty()
    for x, y, s in ((36, 86, 7), (64, 70, 10), (92, 86, 7)):
        m |= c.chevron(x, y + dy, s, 3)
    if dither is not None:
        m = c.dith(m, dither)
    c.ramp(m, cols, rim=dither is None)


def draw(c: Cell, f: int) -> None:
    if f == 0:
        radial(c, CX, CY, 46, 12, rot=0, size=2, cols=("d", "m", "l"), sy=0.8)
        c.ramp(c.disc(CX, CY, 3), ("m", "l"))
    elif f == 1:
        radial(c, CX, CY, 26, 12, rot=15, size=2, cols=("m", "l", "p"), sy=0.8)
        c.ramp(c.disc(CX, CY, 7), ("d", "m", "l", "p"))
    elif f == 2:  # the shout: white core + long rays
        rays(c, CX, CY, 12, 10, 44, 6, rot=0, cols=("d", "m", "l", "p"))
        c.ramp(c.disc(CX, CY, 12), ("m", "l", "p", "w"))
    elif f == 3:
        rays(c, CX, CY, 12, 16, 58, 4, rot=7, cols=("d", "m", "l"))
        ring(c, 24, 4, ("d", "m", "l", "p", "w"))
        c.ramp(c.disc(CX, CY, 7), ("l", "p", "w"))
    elif f == 4:
        rays(c, CX, CY, 12, 30, 58, 3, rot=12, cols=("d", "m"))
        ring(c, 38, 4, ("d", "m", "l", "p"))
        ring(c, 18, 2, ("m", "l", "w"))
    elif f == 5:
        ring(c, 50, 3, ("d", "m", "l"))
        ring(c, 30, 3, ("m", "l", "p"))
        chevrons(c, 0, ("d", "m", "l", "p"))
    elif f == 6:
        ring(c, 60, 2, ("d", "m"), dither=0)
        ring(c, 42, 3, ("d", "m", "l"))
        chevrons(c, -12, ("d", "m", "l", "p"))
        debris(c, "warcry", 14, CX, CY, 0.5, (40, 70), ang=(200, 340), size=1, cols=("m", "l", "p"))
    elif f == 7:
        ring(c, 54, 2, ("d", "m"), dither=1)
        chevrons(c, -24, ("d", "m", "l"))
        debris(c, "warcry", 14, CX, CY, 0.8, (40, 70), ang=(200, 340), size=1, cols=("m", "l", "p"))
    elif f == 8:
        chevrons(c, -36, ("m",), dither=0)
        debris(c, "warcry", 14, CX, CY, 1.05, (40, 70), ang=(200, 340), size=1, cols=("d", "m", "l"))
    else:
        debris(c, "warcry", 10, CX, CY, 1.3, (40, 70), ang=(200, 340), size=0, cols=("m", "l"))
        chevrons(c, -46, ("d",), dither=1)


# QA 2026-09-28: 칸 경계에서 직선으로 잘리던 가장자리를 디더로 걷는다(fx_edge.py). 그림 수식은 위 draw 그대로.
from fx_edge import fade_edges  # noqa: E402

_draw_body = draw


def draw(c, f):
    _draw_body(c, f)
    fade_edges(c, T=8, B=8, L=8, R=8)


if __name__ == "__main__":
    run([KEY])

