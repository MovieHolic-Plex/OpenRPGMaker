"""guard_holy_shield: 성스러운 방패 — 빛의 방패 문장이 대상 앞에 떠오르고 초록 치유 빛이 오른다 (target, 64px x 10)."""
import math

from lib_hero import HOLY, Cell, dilate, erode, shift, radial, rays, shock, debris, run

KEY = "guard_holy_shield"
SIZE, FRAMES, PAL = 64, 10, HOLY
CX, CY, G = 32, 32, 58


def emblem(c: Cell, s, cols=("k", "d", "m", "l", "w"), dither=None):
    m = c.heater(CX, CY, 26 * s, 32 * s)
    if dither is not None:
        c.put(c.dith(dilate(m), dither), "m")
        c.put(c.dith(c.rect(CX - 1, CY - 12 * s, CX + 1, CY + 10 * s) | c.rect(CX - 8 * s, CY - 5 * s, CX + 8 * s, CY - 3 * s), dither), "l")
        return
    c.ramp(m, cols, mode="over")
    # gold cross in the field
    cross = c.rect(CX - 1, CY - 12 * s, CX + 1, CY + 10 * s) | c.rect(CX - 8 * s, CY - 5 * s, CX + 8 * s, CY - 3 * s)
    c.put(dilate(cross) & m, "d", "over")
    c.put(cross, "w", "over")


def heal_motes(c: Cell, f, n=8):
    for k in range(n):
        x = 12 + (k * 23) % 42
        y = G - 4 - ((f * 6 + k * 9) % 44)
        if k % 2:
            m = c.rect(x - 2, y, x + 2, y) | c.rect(x, y - 2, x, y + 2)
            c.put(dilate(m), "gd", "over")
            c.put(m, "gl", "over")
        else:
            c.spark(x, y, 1, ("gd", "g", "gl"), "over")


def draw(c: Cell, f: int) -> None:
    if f == 0:
        radial(c, CX, CY, 22, 8, rot=0, size=1, cols=("d", "m", "l"))
        c.ramp(c.disc(CX, CY, 2), ("m", "l", "w"))
    elif f == 1:
        radial(c, CX, CY, 14, 8, rot=22, size=1, cols=("m", "l", "w"))
        emblem(c, 0.35)
    elif f == 2:
        emblem(c, 0.7)
        shock(c, CX, CY, 20, 20, 1, ("d", "m", "l"))
    elif f == 3:  # peak: full crest, halo and rays
        rays(c, CX, CY, 8, 18, 30, 4, rot=22, cols=("d", "m", "l"))
        emblem(c, 1.0)
        c.spark(CX - 7, CY - 10, 3, ("l", "w", "w"), "over")
    elif f <= 6:
        emblem(c, 1.0)
        # QA: 퍼지는 고리 반경이 26~28 까지 커져 아래·좌우 칸 경계에서 잘렸다 — 가로 28·세로 25 상한.
        shock(c, CX, CY + 2, min(28, 20 + (f - 3) * 3), min(25, 22 + (f - 3) * 3), 1, ("d", "m"), dither=f)
        heal_motes(c, f, 4 + (f - 3) * 2)
        c.spark(CX + 6 - (f - 4) * 5, CY - 12 + (f - 4) * 8, 2, ("l", "w", "w"), "over")
    elif f <= 8:
        emblem(c, 1.0, dither=f)
        heal_motes(c, f, 10)
    else:
        heal_motes(c, f, 8)
        c.thin(1)


# QA 2026-09-28: 칸 경계에서 직선으로 잘리던 가장자리를 디더로 걷는다(fx_edge.py). 그림 수식은 위 draw 그대로.
from fx_edge import fade_edges  # noqa: E402

_draw_body = draw


def draw(c, f):
    _draw_body(c, f)
    fade_edges(c, T=3, B=3, L=3, R=3)


if __name__ == "__main__":
    run([KEY])

