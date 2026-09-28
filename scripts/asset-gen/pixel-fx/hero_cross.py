"""hero_cross: 십자베기 — X 자 두 번 베기 (target, 64px x 10)."""
import math

from lib_hero import STEEL, Cell, dilate, erode, shift, radial, rays, shock, debris, run

KEY = "hero_cross"
SIZE, FRAMES, PAL = 64, 10, STEEL
A = ((54, 12), (10, 60))   # first cut: upper right -> lower left
B = ((10, 14), (54, 60))   # second cut: upper left -> lower right
C = (32, 37)


def cut(c: Cell, seg, bend, cols, w=6, t1=1.0):
    c.ramp(c.stroke(seg[0], seg[1], bend, w, 0.0, t1), cols)


def draw(c: Cell, f: int) -> None:
    if f == 0:  # gather: sparks close in, glint where the blade enters
        radial(c, *C, 24, 8, rot=10, size=1, cols=("d", "m", "l"))
        c.spark(*A[0], 4)
        c.put(c.line([(40, 6), (60, 2)]), "d")
    elif f == 1:
        radial(c, *C, 14, 8, rot=32, size=1, cols=("m", "l", "w"))
        cut(c, A, 5, ("d", "m", "l", "w"), 6, 0.55)
    elif f == 2:
        cut(c, A, 5, ("d", "m", "l", "w"), 7)
        c.spark(*A[1], 3)
    elif f == 3:
        cut(c, A, 5, ("k", "d", "m"), 5)
        cut(c, B, -5, ("d", "m", "l", "w"), 6, 0.55)
        c.spark(*B[0], 3)
    elif f == 4:
        cut(c, A, 5, ("k", "d", "m"), 5)
        cut(c, B, -5, ("d", "m", "l", "w"), 7)
        c.spark(*C, 6, ("l", "p", "w"))
    elif f == 5:  # peak: both cuts white-hot, eight-point flash on the cross
        cut(c, A, 5, ("m", "l", "p", "w"), 8)
        cut(c, B, -5, ("m", "l", "p", "w"), 8)
        c.ramp(c.burst(*C, 18, 5, 8, rot=22), ("l", "p", "w"))
        shock(c, *C, 11, 11, 2, ("m", "l", "w"))
    elif f == 6:
        cut(c, A, 5, ("d", "m", "l"), 6)
        cut(c, B, -5, ("d", "m", "l"), 6)
        c.ramp(c.burst(*C, 9, 3, 4, rot=45), ("l", "p", "w"))
        shock(c, *C, 19, 17, 2, ("d", "m", "l"))
        debris(c, "cross", 14, *C, 0.5, (22, 40), size=2, cols=("m", "l", "w"))
    elif f == 7:
        cut(c, A, 5, ("k", "d"), 5)
        cut(c, B, -5, ("k", "d"), 5)
        c.thin(0)
        shock(c, *C, 25, 22, 2, ("d", "m"), dither=1)
        debris(c, "cross", 14, *C, 0.8, (22, 40), size=1, cols=("m", "l", "p"))
    elif f == 8:
        shock(c, *C, 29, 26, 1, ("k", "d"), dither=0)
        debris(c, "cross", 14, *C, 1.05, (22, 40), size=1, cols=("d", "m", "l"))
    else:
        debris(c, "cross", 10, *C, 1.3, (22, 40), size=0, cols=("m", "l"))


if __name__ == "__main__":
    run([KEY])

