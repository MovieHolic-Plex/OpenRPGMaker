"""hero_whirl: 회전베기 — 대상 몸을 둘러 도는 두 개의 칼바람 고리 (allTargets, 64px x 10)."""
import math

from lib_hero import STEEL, Cell, dilate, erode, shift, radial, rays, shock, debris, run

KEY = "hero_whirl"
SIZE, FRAMES, PAL = 64, 10, STEEL
CX, CY, RX, RY = 32, 42, 26, 11


def blades(c: Cell, rot, span, w, cols, rx=RX, ry=RY):
    for base in (0, 180):
        a0 = rot + base
        c.ramp(c.arcband(CX, CY, rx, ry, a0, a0 + span, w, head=True), cols)


def head_sparks(c: Cell, rot, r=2):
    for base in (0, 180):
        a = math.radians(rot + base)
        c.spark(CX + math.cos(a) * (RX + 3), CY + math.sin(a) * (RY + 2), r, ("l", "p", "w"))


def draw(c: Cell, f: int) -> None:
    if f == 0:  # wind gathers around the body
        for k in range(4):
            a = k * 90 + 20
            c.put(c.dith(c.arcband(CX, CY, RX + 6, RY + 4, a, a + 40, 2)), "m")
        radial(c, CX, CY, 30, 6, rot=0, size=1, cols=("d", "m", "l"), sy=0.5)
        return
    if f <= 6:
        rot = f * 68
        span = (70, 110, 150, 160, 160, 130)[f - 1]
        w = (3, 4, 5, 6, 6, 5)[f - 1]
        cols = ("d", "m", "l") if f in (1, 6) else ("d", "m", "l", "p", "w")
        # inner echo ring trails the blades by 40 degrees
        blades(c, rot - 40 - span * 0.6, span * 0.6, max(2, w - 2), ("k", "d", "m"), RX - 7, RY - 3)
        blades(c, rot - span, span, w, cols)
        head_sparks(c, rot, 3 if 3 <= f <= 5 else 2)
        if f == 4:  # peak
            c.ramp(c.burst(CX, CY - 2, 10, 3, 4, rot=45), ("l", "p", "w"))
            shock(c, CX, CY, RX + 4, RY + 4, 1, ("m", "l"))
        return
    t = (f - 6) * 0.35
    rot = 6 * 68
    if f == 7:
        blades(c, rot - 90, 90, 3, ("k", "d"))
        c.thin(1)
    debris(c, "whirl", 16, CX, CY, t + 0.2, (26, 44), size=2 if f == 7 else 1 if f == 8 else 0, cols=("m", "l", "w"))
    shock(c, CX, CY, RX + 4 + (f - 6) * 3, RY + 3 + (f - 6) * 2, 1, ("d", "m"), dither=f)


if __name__ == "__main__":
    run([KEY])

