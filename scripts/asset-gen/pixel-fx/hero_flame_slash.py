"""hero_flame_slash: 화염검 — 불꽃 초승달 베기 → 불꽃 폭발 → 솟는 불기둥 → 불티 (target, 64px x 10)."""
import math

from lib_hero import FIRE, Cell, dilate, erode, shift, radial, rays, shock, debris, run

KEY = "hero_flame_slash"
SIZE, FRAMES, PAL = 64, 10, FIRE
SEG = ((56, 10), (8, 60))
C = (32, 38)
BASE = 58


def cut(c: Cell, cols, w=8, t1=1.0):
    c.ramp(c.stroke(SEG[0], SEG[1], 6, w, 0.0, t1), cols)


def trail_fire(c: Cell, h, cols):
    """Small flames licking upward off the slash line."""
    from lib_hero import bez
    for k in range(6):
        u = 0.15 + k * 0.14
        x, y, _, _ = bez(SEG[0], SEG[1], 6, u)
        c.ramp(c.flame(x, y + 2, h * (0.7 + 0.3 * math.sin(k * 2.1)), 2.5, 1.5 * math.sin(k)), cols)


def tongues(c: Cell, f: int, H: float, cols):
    for k, x in enumerate((12, 19, 26, 33, 40, 47, 54)):
        bell = 1 - abs(x - 33) / 26
        h = H * (0.4 + 0.6 * bell) * (0.8 + 0.2 * math.sin(k * 2.3 + f * 1.9))
        c.ramp(c.flame(x, BASE, h, 4, 2.5 * math.sin(k + f)), cols)


def embers(c: Cell, t: float, size: int):
    debris(c, "flame_slash", 16, *C, t, (18, 40), ang=(190, 350), grav=18, size=size, cols=("d", "l", "p"))


def draw(c: Cell, f: int) -> None:
    if f == 0:
        radial(c, *C, 24, 10, rot=0, size=1, cols=("r", "m", "l"))
        c.ramp(c.flame(*SEG[0], 8, 3), ("r", "d", "m", "l"))
    elif f == 1:
        radial(c, *C, 14, 10, rot=18, size=0, cols=("m", "l", "p"))
        cut(c, ("r", "d", "m", "l", "p"), 7, 0.5)
    elif f == 2:
        cut(c, ("r", "d", "m", "l", "p", "w"), 9)
        trail_fire(c, 9, ("r", "d", "m", "l"))
    elif f == 3:  # ignition on the target
        cut(c, ("r", "d", "m"), 7)
        trail_fire(c, 12, ("r", "d", "m", "l"))
        c.ramp(c.burst(*C, 15, 7, 9, rot=10), ("r", "d", "m", "l", "p", "w"))
    elif f == 4:  # peak: fire flower + white core + shock ring
        c.ramp(c.burst(*C, 24, 13, 11, rot=25), ("r", "d", "m", "l", "p"))
        c.ramp(c.disc(*C, 6), ("l", "p", "w"))
        shock(c, *C, 26, 22, 2, ("d", "m", "l"))
    elif f == 5:
        tongues(c, f, 34, ("r", "d", "m", "l", "p"))
        c.ramp(c.burst(C[0], C[1] - 4, 15, 9, 9, rot=5), ("r", "d", "m", "l"))
        c.thin(0, c.disc(C[0], C[1] - 4, 16) & ~c.rect(0, 44, 63, 63))
        shock(c, *C, 30, 26, 2, ("d", "m"), dither=1)
        embers(c, 0.35, 1)
    elif f == 6:
        tongues(c, f, 26, ("r", "d", "m", "l", "p"))
        embers(c, 0.65, 1)
    elif f == 7:
        tongues(c, f, 16, ("r", "d", "m", "l"))
        c.thin(1, c.rect(0, 0, 63, 48))
        embers(c, 0.95, 1)
    elif f == 8:
        tongues(c, f, 8, ("r", "d", "m"))
        c.thin(0)
        embers(c, 1.2, 0)
    else:
        embers(c, 1.45, 0)
        c.put(c.dith(c.rect(16, BASE - 1, 48, BASE)), "r")


if __name__ == "__main__":
    run([KEY])

