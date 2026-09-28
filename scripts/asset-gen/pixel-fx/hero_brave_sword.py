"""hero_brave_sword: 브레이브 블레이드 — 무대 위에서 내려꽂히는 거대한 빛의 검과 방사광 (screen, 128px x 12)."""
import math

from lib_hero import BRAVE, Cell, dilate, erode, shift, radial, rays, shock, debris, run

KEY = "hero_brave_sword"
SIZE, FRAMES, PAL = 128, 12, BRAVE
CX = 64


def sword(c: Cell, tip, blade_cols=("v", "c", "l", "w"), guard_cols=("gd", "g", "p")):
    """Tip at y=tip; blade 80px, guard, grip, pommel above it (clipped at the top)."""
    top = tip - 82
    rim, edge, body, core = blade_cols
    blade = c.poly([(CX - 8, top), (CX + 8, top), (CX + 8, tip - 16), (CX, tip), (CX - 8, tip - 16)])
    c.put(dilate(blade), rim, "over")
    c.put(blade, edge, "over")
    # bevel: lit left face, shaded right face, a white fuller down the ridge
    c.put(c.poly([(CX - 6, top + 1), (CX, top + 1), (CX, tip - 4), (CX - 6, tip - 17)]), body, "over")
    c.put(c.rect(CX - 1, top + 2, CX, tip - 8), core, "over")
    c.put(c.rect(CX - 5, top + 3, CX - 5, tip - 22), core, "over")
    guard = c.poly([(CX - 24, top - 7), (CX + 24, top - 7), (CX + 20, top), (CX - 20, top)])
    c.ramp(guard, guard_cols, mode="over")
    c.ramp(c.disc(CX, top - 4, 3), ("gd", "c", "w"), mode="over")        # gem
    c.ramp(c.rect(CX - 3, top - 26, CX + 3, top - 8), ("gd", "g"), mode="over")
    c.ramp(c.disc(CX, top - 29, 4), guard_cols, mode="over")


def beam(c: Cell, hw, cols, dither=None):
    m = c.rect(CX - hw, 0, CX + hw, 127)
    if dither is not None:
        m = c.dith(m, dither)
    c.put(m, cols)


def speed(c: Cell, y0):
    for x, ln in ((36, 30), (92, 26), (26, 18), (102, 22), (48, 14), (80, 14)):
        c.put(c.line([(x, y0 + x % 17), (x, y0 + x % 17 + ln)]), "c")


def draw(c: Cell, f: int) -> None:
    if f == 0:  # heaven opens: light gathers above the stage
        radial(c, CX, 26, 52, 14, rot=0, size=2, cols=("v", "c", "l"), sy=0.5)
        beam(c, 4, "v", dither=0)
    elif f == 1:
        radial(c, CX, 26, 30, 14, rot=13, size=2, cols=("c", "l", "g"), sy=0.5)
        beam(c, 8, "v", dither=1)
        beam(c, 2, "c")
        c.ramp(c.disc(CX, 20, 6), ("c", "l", "w"))
    elif f == 2:
        beam(c, 10, "v", dither=0)
        sword(c, 30)
        speed(c, 0)
    elif f == 3:
        beam(c, 12, "v", dither=1)
        sword(c, 72)
        speed(c, 26)
    elif f == 4:  # impact
        c.ramp(c.ellipse(CX, 116, 36, 7), ("v", "c", "l", "w"))
        c.ramp(c.burst(CX, 112, 22, 6, 6, rot=-90, sy=0.45), ("c", "l", "w"))
        sword(c, 114)
        c.spark(CX, 112, 7, ("l", "p", "w"))
    elif f == 5:  # peak: radiance erupts behind the planted sword
        rays(c, CX, 100, 16, 10, 124, 10, rot=0, cols=("v", "c", "l"))
        c.ramp(c.disc(CX, 100, 18), ("l", "p", "w"))
        sword(c, 114, ("c", "l", "p", "w"), ("g", "p", "w"))
    elif f == 6:
        rays(c, CX, 100, 16, 22, 124, 8, rot=11, cols=("v", "c", "l"))
        shock(c, CX, 100, 44, 30, 3, ("c", "l", "w"))
        sword(c, 114)
    elif f == 7:
        rays(c, CX, 100, 16, 36, 124, 6, rot=22, cols=("v", "c"), dither=0)
        shock(c, CX, 100, 62, 42, 2, ("v", "c"), dither=1)
        sword(c, 114)
        radial(c, CX, 70, 34, 8, rot=f * 20, size=2, cols=("gd", "g", "p"))
    elif f == 8:
        sword(c, 114)
        c.thin(0, c.rect(0, 70, 127, 127))
        radial(c, CX, 64, 42, 8, rot=f * 20, size=2, cols=("gd", "g", "p"))
    elif f == 9:  # the blade dissolves into motes
        sword(c, 114, ("k", "v", "c", "l"), ("gd", "g"))
        c.thin(1)
        c.thin(0, c.rect(0, 50, 127, 127))
        debris(c, "brave_sword", 20, CX, 80, 0.4, (30, 60), ang=(200, 340), size=2, cols=("c", "l", "w"))
    elif f == 10:
        debris(c, "brave_sword", 20, CX, 80, 0.75, (30, 60), ang=(200, 340), size=1, cols=("c", "l", "w"))
        debris(c, "brave_gold", 8, CX, 60, 0.6, (20, 50), size=1, cols=("gd", "g", "p"))
    else:
        debris(c, "brave_sword", 14, CX, 80, 1.05, (30, 60), ang=(200, 340), size=0, cols=("c", "l"))
        debris(c, "brave_gold", 8, CX, 60, 0.9, (20, 50), size=1, cols=("gd", "g", "p"))


if __name__ == "__main__":
    run([KEY])

