"""samurai_iai_flash: 발도술 (착탄). One horizontal iai flash across the target: gathering slit -> white lens + star -> the cut splits apart in indigo rings and a few sakura petals.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_samurai import *

KEY, SIZE, FRAMES, ANCHOR = 'samurai_iai_flash', 64, 8, 'target'
PAL = pal(INDIGO, pick(SAKURA, 's1', 's2', 's3'), WHITE)
A, B = (1, 41), (63, 27)
M = ((A[0] + B[0]) / 2, (A[1] + B[1]) / 2)


def at(t, o=0.0):
    ln = math.hypot(B[0] - A[0], B[1] - A[1])
    nx, ny = -(B[1] - A[1]) / ln, (B[0] - A[0]) / ln
    return (lerp(A[0], B[0], t) + nx * o, lerp(A[1], B[1], t) + ny * o)


def draw(c, f):
    if f == 0:
        for i in range(6):
            y = 22 + i * 5
            c.line([(40 + i % 2 * 6, y), (60, y - 2)], 'n1')
        c.lens(at(0.35), at(0.65), 1.5, ['n2', 'n3'])
        c.spark(M[0], M[1], 3, 'w', 'n4')
    elif f == 1:
        c.lens(A, B, 3, ['n1', 'n3', 'n4', 'w'])
        c.line([A, B], 'w')
        c.spark(at(0.05)[0], at(0.05)[1], 4, 'w', 'n4')
        for t in (0.25, 0.5, 0.8):
            c.px(*at(t, -5), 'n4')
            c.px(*at(t + 0.07, 5), 'n3')
    elif f == 2:
        c.lens(at(-0.05, 0), at(1.05, 0), 6, ['n1', 'n2', 'n3', 'n4', 'w'])
        c.spark(M[0], M[1], 9, 'w', 'n4', diag=True)
        c.rays(M[0], M[1], 12, 11, 20, 'n3', rot=0.13, jitter=[1, 0.7, 0.9, 0.6])
    elif f == 3:
        c.ring(M[0], M[1], 15, 'n2', 3)
        c.ring(M[0], M[1], 15, 'n4', 1)
        c.lens(at(-0.05), at(1.05), 7, ['n2', 'n4', 'w'])
        c.disc(M[0], M[1], 6, 'w')
        c.rays(M[0], M[1], 16, 17, 29, 'n4', rot=0.3, jitter=[1, 0.75, 0.9, 0.6])
        c.spark(M[0], M[1], 12, 'w', 'w')
    elif f == 4:
        for s in (-1, 1):
            c.lens(at(-0.05, s * 4), at(1.05, s * 4), 2.5, ['n2', 'n4', 'w'])
        c.ring(M[0], M[1], 21, 'n3', 2, squash=0.8)
        c.dring(M[0], M[1], 26, 'n2', squash=0.8)
        burst_petals(c, M[0], M[1], 7, 18, 4, L=4)
        c.spark(at(0.9)[0], at(0.9)[1], 4, 'w', 'n4')
    elif f == 5:
        for s in (-1, 1):
            c.lens(at(0.05, s * 7), at(0.95, s * 7), 1.5, ['n3', 'n4'])
        c.dring(M[0], M[1], 26, 'n3', squash=0.8)
        burst_petals(c, M[0], M[1], 9, 23, 5, drop=3, L=4)
        specks(c, M[0], M[1], 8, 12, 24, 5, ['n4', 'w'], spark_every=4)
    elif f == 6:
        for s in (-1, 1):
            c.dline(at(0.15, s * 10), at(0.85, s * 10), 'n2', phase=f)
        c.dring(M[0], M[1], 29, 'n1', parity=1, squash=0.8)
        burst_petals(c, M[0], M[1], 8, 26, 6, drop=7, L=3.5, keys=('s1', 's2'))
    else:
        burst_petals(c, M[0], M[1], 6, 28, 7, drop=11, L=3, keys=('s1', 's2'))
        specks(c, M[0], M[1], 7, 14, 28, 8, ['n3', 'n2'], spark_every=3, core='n4')


if __name__ == '__main__':
    run(globals())

