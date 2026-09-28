"""samurai_final_sky: 무명 일도 (필살기 배경). The world stops: the stage floods to ink-indigo and stills, a lone white horizon line, a falling petal freezes, a single colossal white cut splits the whole screen diagonally, the halves shear apart and pink-white fragments scatter before colour returns.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_samurai import *

KEY, SIZE, FRAMES, ANCHOR = 'samurai_final_sky', 128, 12, 'screen'
PAL = pal(INDIGO, pick(SAKURA, 's1', 's2', 's3', 's4'), WHITE)
A, B = (130, 18), (-2, 106)
L = math.hypot(B[0] - A[0], B[1] - A[1])
UX, UY = (B[0] - A[0]) / L, (B[1] - A[1]) / L
NX, NY = -UY, UX
MID = (64, 62)


def at(t, o=0.0):
    return (A[0] + UX * L * t + NX * o, A[1] + UY * L * t + NY * o)


def half(c, side, gap, k):
    """Fill the screen on one side of the cut line, shifted 'gap' px away from it."""
    far = 200
    c.poly([at(-0.2, side * gap), at(1.2, side * gap), at(1.2, side * far), at(-0.2, side * far)], k)


def still_petal(c, x, y):
    c.petal(x, y, 0.6, 7, 's2', 's4', edge='s0' if 's0' in c.pal else None)


def draw(c, f):
    if f == 0:
        c.drect(0, 0, 127, 127, 'n0')
        c.line([(0, 62), (127, 62)], 'n3')
    elif f == 1:
        c.rect(0, 0, 127, 127, 'n0')
        c.line([(0, 62), (127, 62)], 'n4')
        c.dline((0, 64), (127, 64), 'n2')
        still_petal(c, 70, 40)
    elif f == 2:
        c.rect(0, 0, 127, 127, 'n0')
        c.rect(0, 61, 127, 63, 'n2')
        c.line([(0, 62), (127, 62)], 'w')
        still_petal(c, 70, 44)
        c.ring(70, 44, 9, 'n2')
    elif f == 3:
        c.rect(0, 0, 127, 127, 'n0')
        c.line([(0, 62), (127, 62)], 'n3')
        still_petal(c, 70, 44)
        c.ring(70, 44, 13, 'n3')
        c.dring(70, 44, 18, 'n2')
        c.spark(122, 22, 6, 'w', 'n4', diag=True)
    elif f == 4:
        c.rect(0, 0, 127, 127, 'n0')
        c.lens(A, at(0.55), 3, ['n3', 'n4', 'w'])
        c.spark(*at(0.55), 7, 'w', 'n4', diag=True)
        still_petal(c, 70, 44)
    elif f == 5:
        c.rect(0, 0, 127, 127, 'n0')
        c.lens(at(-0.1), at(1.1), 12, ['n2', 'n3', 'n4', 'w'])
        c.line([A, B], 'w', 3)
        c.spark(*MID, 16, 'w', 'w', diag=True)
    elif f == 6:
        c.rect(0, 0, 127, 127, 'w')
        half(c, -1, 10, 'n4')
        half(c, 1, 10, 'n4')
        half(c, -1, 18, 'n3')
        half(c, 1, 18, 'n3')
    elif f == 7:
        half(c, -1, 5, 'n0')
        half(c, 1, 5, 'n0')
        c.lens(at(-0.1), at(1.1), 5, ['n4', 'w'])
        c.line([at(-0.1, -6), at(1.1, -6)], 'n3')
        c.line([at(-0.1, 6), at(1.1, 6)], 'n3')
        c.petal(64, 56, 0.6, 7, 's1', 's4')
        c.petal(72, 64, 3.7, 7, 's2', 's4')
    elif f == 8:
        half(c, -1, 12, 'n0')
        half(c, 1, 12, 'n0')
        half(c, -1, 30, 'n1')
        half(c, 1, 30, 'n1')
        c.line([at(-0.1), at(1.1)], 'n4', 3)
        c.line([at(-0.1), at(1.1)], 'w')
        line_petals(c, at(0), at(1), 22, 10, 8, L=5, keys=('s1', 's2', 's3'))
        specks(c, MID[0], MID[1], 14, 10, 60, 8, ['n4', 'w'], spark_every=4)
    elif f == 9:
        c.drect(0, 0, 127, 127, 'n0')
        half(c, -1, 30, 'n0')
        half(c, 1, 30, 'n0')
        c.line([at(-0.1), at(1.1)], 'n3')
        line_petals(c, at(0), at(1), 26, 22, 9, drop=6, L=5)
        specks(c, MID[0], MID[1], 16, 16, 64, 9, ['n3', 'n4', 's3'], spark_every=5)
    elif f == 10:
        half(c, -1, 44, 'n0')
        half(c, 1, 44, 'n0')
        c.dline(at(-0.1), at(1.1), 'n2')
        line_petals(c, at(0), at(1), 24, 32, 10, drop=14, L=4)
    else:
        c.drect(0, 0, 127, 20, 'n0')
        c.drect(0, 108, 127, 127, 'n0', 1)
        line_petals(c, at(0), at(1), 16, 40, 11, drop=24, L=3.5, keys=('s1', 's2'))


if __name__ == '__main__':
    run(globals())

