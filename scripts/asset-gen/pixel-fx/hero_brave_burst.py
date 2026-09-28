"""hero_brave_burst: 브레이브 블레이드 착탄 — 빛기둥, 거대 십자광, 금빛 고리, 흩어지는 별 (target, 128px x 10)."""
import math

from lib_hero import BRAVE, Cell, dilate, erode, shift, radial, rays, shock, debris, run

KEY = "hero_brave_burst"
SIZE, FRAMES, PAL = 128, 10, BRAVE
CX, CY, G = 64, 100, 120


def ring(c: Cell, r, w, cols, dither=None):
    shock(c, CX, CY + 6, min(r, 60), min(r * 0.4, 20), w, cols, dither)


def stars(c: Cell, t, size):
    debris(c, "brave_burst", 16, CX, CY, t, (40, 76), size=size, cols=("c", "l", "w"))
    debris(c, "brave_burst_gold", 10, CX, CY, t, (26, 56), ang=(190, 350), grav=30, size=size, cols=("gd", "g", "p"))


def draw(c: Cell, f: int) -> None:
    if f == 0:
        c.ramp(c.rect(CX - 2, 0, CX + 2, G), ("c", "l", "w"))
        radial(c, CX, CY, 34, 10, rot=0, size=2, cols=("gd", "g", "p"), sy=0.8)
    elif f == 1:
        c.ramp(c.poly([(CX - 5, 0), (CX + 5, 0), (CX + 9, G), (CX - 9, G)]), ("v", "c", "l", "w"))
        c.ramp(c.ellipse(CX, G, 24, 5), ("v", "c", "l", "w"))
        radial(c, CX, CY, 20, 10, rot=18, size=2, cols=("g", "p", "w"), sy=0.8)
    elif f == 2:  # peak: giant four-point cross flash
        c.ramp(c.burst(CX, CY, 58, 7, 4, rot=-90), ("v", "c", "l", "p", "w"))
        c.ramp(c.burst(CX, CY, 30, 6, 4, rot=-45), ("gd", "g", "p", "w"))
        c.ramp(c.disc(CX, CY, 11), ("l", "p", "w"))
    elif f == 3:
        c.ramp(c.burst(CX, CY, 40, 5, 4, rot=-90), ("v", "c", "l", "w"))
        ring(c, 28, 4, ("v", "c", "l", "w"))
        c.ramp(c.rect(CX - 3, 0, CX + 3, G), ("c", "l", "w"))
    elif f == 4:
        rays(c, CX, CY, 8, 20, 60, 5, rot=22, cols=("v", "c", "l"))
        ring(c, 42, 3, ("v", "c", "l", "w"))
        ring(c, 24, 3, ("gd", "g", "p"))
        stars(c, 0.25, 2)
    elif f == 5:
        ring(c, 54, 3, ("v", "c"), dither=0)
        ring(c, 36, 3, ("gd", "g", "p"))
        stars(c, 0.5, 2)
        c.put(c.dith(c.rect(CX - 1, 0, CX + 1, G)), "c")
    elif f == 6:
        ring(c, 48, 2, ("gd", "g"), dither=1)
        stars(c, 0.75, 1)
        for x, y in ((34, 60), (96, 70), (60, 44)):
            c.ramp(c.star5(x, y, 5), ("gd", "g", "p"))
    elif f == 7:
        stars(c, 1.0, 1)
        for x, y in ((30, 52), (100, 62), (64, 34)):
            c.ramp(c.star5(x, y, 4), ("gd", "g", "p"))
    elif f == 8:
        stars(c, 1.25, 1)
        c.thin(0)
    else:
        stars(c, 1.5, 0)


if __name__ == "__main__":
    run([KEY])

