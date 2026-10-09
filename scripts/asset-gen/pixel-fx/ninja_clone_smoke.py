"""ninja_clone_smoke: 분신술 (시전자). A cross-shaped seal glows, three smoke bursts pop in a row (left, centre, right) with violet silhouettes stepping out, then the smoke thins.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_samurai import *

KEY, SIZE, FRAMES, ANCHOR = 'ninja_clone_smoke', 64, 6, 'user'
PAL = pal(SMOKEV, pick(NIGHT, 'v0', 'v1', 'v2', 'v3', 'v4'), pick(BLOOD, 'r2'), WHITE)
SM = ['q1', 'q2', 'q3', 'q4']
SPOTS = [(12, 0.8), (32, 1.0), (52, 0.8)]


def draw(c, f):
    if f == 0:
        c.ring(CX, CY, 10, 'v2', 2)
        c.line([(CX - 7, CY), (CX + 7, CY)], 'v4', 2)
        c.line([(CX, CY - 7), (CX, CY + 7)], 'v4', 2)
        c.spark(CX, CY, 4, 'w', 'v4')
        c.ring(CX, FEET, 22, 'v2', 1, squash=0.25)
    elif f == 1:
        c.ring(CX, FEET, 26, 'v3', 2, squash=0.25)
        for i, (x, s) in enumerate(SPOTS):
            c.ring(x, CY + 4, 4 + 2 * s, 'q3', 2)
            c.spark(x, CY + 4, 6, 'w', 'v4', diag=True)
    elif f == 2:
        for i, (x, s) in enumerate(SPOTS):
            c.cloud(x, CY + 6, 11 * s, SM, seed=20 + i)
        c.rays(CX, CY + 4, 12, 26, 31, 'q4', rot=0.2)
    elif f == 3:
        for i, (x, s) in enumerate(SPOTS):
            c.ninja(x, FEET, 26 * s, 'v1', 'v0', 'r2', 'v3')
            c.cloud(x, CY + 12, 10 * s, SM[:3], seed=30 + i, parity=i)
        c.dring(CX, FEET, 28, 'v3', squash=0.25)
    elif f == 4:
        for i, (x, s) in enumerate(SPOTS):
            c.ninja(x, FEET, 26 * s, 'v2' if i != 1 else 'v1', 'v0', 'w', 'v4')
            c.ddisc(x, CY - 2, 8 * s, 'q2', parity=i)
        specks(c, CX, CY, 8, 14, 28, 4, ['q3', 'v4'], spark_every=3)
    else:
        for i, (x, s) in enumerate(SPOTS):
            c.ninja(x, FEET, 26 * s, 'v1', 'v0', 'r2')
            c.ddisc(x, CY - 10, 5, 'q1', parity=i + 1)


if __name__ == '__main__':
    run(globals())

