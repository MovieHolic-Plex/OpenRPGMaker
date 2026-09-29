"""ninja_log_puff: 변신술 (시전자). A 'poof' of smoke bursts where the ninja stood, a log with a pasted charm drops out of it, bounces, and the smoke rolls away.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_samurai import *

KEY, SIZE, FRAMES, ANCHOR = 'ninja_log_puff', 64, 8, 'user'
PAL = pal(SMOKEV, LOG, pick(NIGHT, 'v2', 'v3'), pick(BLOOD, 'r2'), WHITE)
SM = ['q1', 'q2', 'q3', 'q4']


def log(c, y, tilt=0.0):
    x0, x1 = 20, 44
    c.poly([(x0, y - 5 + tilt), (x1, y - 5 - tilt), (x1, y + 5 - tilt), (x0, y + 5 + tilt)], 't1', outline='t0')
    c.line([(x0 + 2, y - 3 + tilt), (x1 - 3, y - 3 - tilt)], 't2')
    c.line([(x0 + 4, y + 2 + tilt), (x1 - 6, y + 2 - tilt)], 't0')
    c.oval(x1, y - tilt, 3, 5, 't0')
    c.oval(x1, y - tilt, 2, 4, 't2')
    c.ring(x1, y - tilt, 1, 't3')
    c.line([(x0 + 3, y - 7 + tilt), (x0 + 1, y - 9 + tilt)], 't0')
    c.rect(29, y - 6, 33, y + 3, 't3')
    c.line([(31, y - 5), (31, y + 2)], 'r2')


def draw(c, f):
    if f == 0:
        c.ring(CX, CY, 6, 'q3', 2)
        c.spark(CX, CY, 7, 'w', 'q4', diag=True)
        c.rays(CX, CY, 8, 9, 14, 'v3', rot=0.4)
    elif f == 1:
        c.cloud(CX, CY, 17, SM, seed=1)
        c.rays(CX, CY, 10, 20, 27, 'q4', rot=0.1, jitter=[1, 0.7])
    elif f == 2:
        c.cloud(CX, CY - 2, 22, SM, seed=2, lobes=11)
        c.cloud(16, FEET - 6, 8, SM[:3], seed=12)
        c.cloud(48, FEET - 6, 8, SM[:3], seed=13)
    elif f == 3:
        c.cloud(CX, CY - 5, 21, SM, seed=3, lobes=11)
        log(c, FEET - 12)
        c.cloud(12, FEET - 4, 7, SM[:3], seed=14)
        c.cloud(52, FEET - 4, 7, SM[:3], seed=15)
    elif f == 4:
        c.cloud(CX - 4, CY - 10, 17, SM[:3], seed=4, parity=1)
        log(c, FEET - 5, 1)
        c.spark(18, FEET, 3, 'w', 'q3')
        c.spark(46, FEET, 3, 'w', 'q3')
        c.ring(CX, FEET + 1, 18, 'q2', 1, squash=0.25)
    elif f == 5:
        c.cloud(CX - 8, CY - 14, 13, SM[:3], seed=5, parity=1)
        c.cloud(CX + 12, CY - 8, 8, SM[:3], seed=15)
        log(c, FEET - 7, -1)
    elif f == 6:
        c.ddisc(CX - 10, CY - 18, 12, 'q1')
        c.cloud(CX - 10, CY - 18, 8, SM[:2], seed=6)
        log(c, FEET - 5)
        specks(c, CX, CY - 10, 5, 8, 20, 6, ['q3', 'v3'])
    else:
        c.ddisc(CX - 12, CY - 22, 8, 'q1', parity=1)
        log(c, FEET - 5)
        c.px(38, FEET - 14, 'q2')
        c.px(26, FEET - 16, 'q2')


if __name__ == '__main__':
    run(globals())

