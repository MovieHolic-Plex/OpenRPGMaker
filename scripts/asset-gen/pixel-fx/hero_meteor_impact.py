"""hero_meteor_impact: 낙하참 착지 — 내리꽂는 불기둥, 불꽃 돔, 땅 충격파, 튀는 바위 (target, 128px x 10)."""
import math

from lib_hero import METEOR, Cell, dilate, erode, shift, radial, rays, shock, debris, run

KEY = "hero_meteor_impact"
SIZE, FRAMES, PAL = 128, 10, METEOR
CX, G = 64, 120   # target feet sit on row 120


def ground(c: Cell, rx, cols, dither=None):
    shock(c, CX, G, rx, max(3, rx // 6), 2, cols, dither)


def rocks(c: Cell, t):
    debris(c, "meteor_rocks", 10, CX, G - 6, t, (40, 80), ang=(205, 335), grav=110, size=2, cols=("s0", "s1", "s2"), mode="over", rock=True)


def embers(c: Cell, t, size=1):
    debris(c, "meteor_embers", 18, CX, G - 20, t, (30, 70), ang=(200, 340), grav=40, size=size, cols=("d", "l", "p"))


def tongues(c: Cell, f, H, cols):
    for k, x in enumerate(range(22, 110, 11)):
        bell = 1 - abs(x - CX) / 50
        h = H * (0.35 + 0.65 * bell) * (0.8 + 0.2 * math.sin(k * 2.1 + f))
        c.ramp(c.flame(x, G + 2, h, 7, 3 * math.sin(k + f)), cols)


def draw(c: Cell, f: int) -> None:
    if f == 0:  # the falling streak
        c.ramp(c.poly([(58, 0), (70, 0), (64, 112)]), ("r", "d", "m", "l", "p", "w"))
        for x in (44, 84, 52, 76):
            c.put(c.line([(x, 10 + x % 20), (x, 50 + x % 30)]), "d")
    elif f == 1:  # contact flash
        c.ramp(c.poly([(60, 40), (68, 40), (64, 112)]), ("m", "l", "p", "w"))
        c.ramp(c.disc(CX, G - 6, 11), ("m", "l", "p", "w"))
        ground(c, 22, ("d", "m", "l", "w"))
    elif f == 2:
        rays(c, CX, G - 12, 7, 18, 52, 7, rot=-90, cols=("r", "d", "m", "l"))
        c.ramp(c.burst(CX, G - 12, 27, 17, 11, rot=0), ("r", "d", "m", "l", "p", "w"))
        ground(c, 36, ("d", "m", "l", "p"))
    elif f == 3:  # peak dome
        c.ramp(c.burst(CX, G - 18, 36, 24, 12, rot=12), ("r", "d", "m", "l", "p", "w"))
        c.ramp(c.disc(CX, G - 18, 10), ("p", "w"))
        ground(c, 50, ("d", "m", "l"))
        rocks(c, 0.28)
    elif f == 4:  # mushroom: column + cap
        c.ramp(c.flame(CX, G + 2, 78, 14, 0), ("r", "d", "m", "l", "p"))
        c.ramp(c.burst(CX, 48, 26, 15, 10, rot=4, sy=0.75), ("r", "d", "m", "l", "p"))
        ground(c, 58, ("d", "m"), dither=0)
        rocks(c, 0.5)
        embers(c, 0.3, 2)
    elif f == 5:
        tongues(c, f, 42, ("r", "d", "m", "l", "p"))
        c.ramp(c.burst(CX, 38, 20, 12, 9, rot=20, sy=0.75), ("r", "d", "m", "l"))
        c.thin(1, c.rect(0, 0, 127, 60))
        rocks(c, 0.72)
        embers(c, 0.55, 1)
    elif f == 6:
        tongues(c, f, 30, ("r", "d", "m", "l"))
        c.thin(0, c.rect(0, 0, 127, 70))
        for x, y, r in ((48, 58, 9), (78, 50, 11), (62, 38, 8)):
            c.puff(x, y, r, ("s0", "s1", "s2"), "over")
        rocks(c, 0.94)
        embers(c, 0.8, 1)
    elif f == 7:
        tongues(c, f, 18, ("r", "d", "m"))
        for x, y, r in ((46, 44, 8), (80, 36, 9), (62, 26, 7)):
            c.puff(x, y, r, ("s0", "s1", "s2"), "over")
        c.thin(1, c.rect(0, 0, 127, 80))
        rocks(c, 1.14)
        embers(c, 1.05, 1)
    elif f == 8:
        tongues(c, f, 9, ("r", "d"))
        c.thin(0)
        rocks(c, 1.32)
        embers(c, 1.3, 0)
    else:
        for x0, x1 in ((40, 56), (70, 90), (58, 66)):
            c.put(c.line([(x0, G + 1), ((x0 + x1) // 2, G - 1), (x1, G + 1)]), "r")
        embers(c, 1.55, 0)


# QA 2026-09-28: 칸 경계에서 직선으로 잘리던 가장자리를 디더로 걷는다(fx_edge.py). 그림 수식은 위 draw 그대로.
from fx_edge import fade_edges  # noqa: E402

_draw_body = draw


def draw(c, f):
    _draw_body(c, f)
    fade_edges(c, T=8, B=8, L=8, R=8)


if __name__ == "__main__":
    run([KEY])

