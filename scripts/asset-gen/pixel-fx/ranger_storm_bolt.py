"""ranger_storm_bolt: 폭풍의 화살 (필살기 무대). The sky darkens into storm clouds, a giant lightning-wrapped arrow materialises right and tears across the stage to the left, leaving a crackling wake.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_scout import *

KEY, SIZE, FRAMES, ANCHOR = 'ranger_storm_bolt', 128, 12, 'screen'
PAL = pal(STORM, pick(SMOKE, 'q0', 'q1', 'q2'), pick(WOOD, 't1', 't2'), WHITE)
Y = 70


def clouds(c, dark, f):
    for i in range(6):
        x = 10 + i * 22 + ((f * 2) % 6) * (1 if i % 2 else -1)
        c.cloud(x, 12 + (i % 2) * 5, 13, ['q0', 'q1', 'q2'] if dark else ['q0', 'q1'], seed=i, lobes=7, parity=f)


def big_arrow(c, tip, L=76):
    tail = tip + L
    # outer electric aura around the whole arrow
    c.poly([(tip - 6, Y), (tip + 22, Y - 20), (tail + 12, Y - 11), (tail + 12, Y + 11), (tip + 22, Y + 20)], 'z0')
    c.poly([(tip + 20, Y - 5), (tail, Y - 5), (tail, Y + 5), (tip + 20, Y + 5)], 'z1')
    c.poly([(tip + 20, Y - 3), (tail, Y - 3), (tail, Y + 3), (tip + 20, Y + 3)], 'z3')
    c.line([(tip + 20, Y - 1), (tail, Y - 1)], 'z4', 2)
    c.line([(tip + 20, Y - 1), (tail, Y - 1)], 'w')
    # fletching: two swept fins of lightning
    for s in (-1, 1):
        c.poly([(tail - 22, Y + s * 4), (tail + 2, Y + s * 18), (tail + 10, Y + s * 18), (tail - 4, Y + s * 4)], 'z2', outline='z1')
        c.line([(tail - 16, Y + s * 5), (tail + 4, Y + s * 16)], 'z4')
    # head
    c.poly([(tip, Y), (tip + 24, Y - 15), (tip + 18, Y), (tip + 24, Y + 15)], 'z3', outline='z1')
    c.poly([(tip + 3, Y), (tip + 20, Y - 9), (tip + 15, Y)], 'z4')
    c.poly([(tip + 3, Y), (tip + 15, Y), (tip + 20, Y + 9)], 'z2')
    c.line([(tip, Y), (tip + 16, Y)], 'w', 2)
    c.spark(tip, Y, 11, 'w', 'zy', diag=True)
    c.disc(tip, Y, 2, 'w')


def wrap(c, x0, x1, f):
    for i in range(3):
        c.bolt((x1, Y + (i - 1) * 14), (x0, Y + (1 - i) * 10), seed=f * 3 + i, keys=['z2', 'z3', 'w'], segs=9, jitter=9, widths=[3, 1, 1])


def draw(c, f):
    if f == 0:
        for i in range(5):
            c.ddisc(14 + i * 25, 10, 12, 'q0', parity=i)
        for i in range(10):
            a = i * math.pi / 5
            c.line([pol(108, Y, 20, a), pol(108, Y, 15, a)], 'z2')
        c.spark(108, Y, 5, 'w', 'z3')
    elif f == 1:
        clouds(c, False, f)
        c.ring(108, Y, 8, 'z2', 1)
        c.spark(108, Y, 6, 'w', 'z3')
        c.bolt((80, 20), (100, 60), seed=4, keys=['z1', 'z3', 'w'], segs=5, jitter=6, widths=[3, 1, 1])
    elif f == 2:
        clouds(c, True, f)
        c.ring(108, Y, 14, 'z2', 2)
        c.ring(108, Y, 10, 'z3', 1)
        c.disc(108, Y, 6, 'z3')
        c.disc(108, Y, 3, 'w')
        c.bolt((40, 22), (104, 64), seed=5, keys=['z1', 'z3', 'w'], segs=7, jitter=7, widths=[3, 1, 1])
        c.bolt((120, 20), (110, 62), seed=6, keys=['z1', 'z3'], segs=4, jitter=4, widths=[3, 1])
    elif f == 3:
        clouds(c, True, f)
        big_arrow(c, 92, 34)
        c.rays(96, Y, 12, 16, 28, 'z3', rot=0.2, jitter=[1, 0.6, 0.85])
        c.ring(96, Y, 18, 'zy', 1)
    elif f in (4, 5, 6, 7):
        clouds(c, True, f)
        tip = [70, 44, 18, -6][f - 4]
        # wake: a violet band where the arrow passed
        c.rect(tip + 60, Y - 7, 127, Y + 7, 'z0')
        c.rect(tip + 60, Y - 4, 127, Y + 4, 'z1')
        c.line([(tip + 60, Y), (127, Y)], 'z3', 2)
        wrap(c, max(0, tip), 127, f)
        big_arrow(c, tip)
        for i in range(6):
            x = tip + 40 + i * 14
            if 0 <= x < 128:
                c.line([(x, Y - 12 - i % 3 * 4), (x + 8, Y - 12 - i % 3 * 4)], 'z4')
                c.line([(x + 4, Y + 12 + i % 2 * 5), (x + 12, Y + 12 + i % 2 * 5)], 'z4')
        if f == 6:
            c.bolt((30, 18), (20, Y - 4), seed=9, keys=['z1', 'zy', 'w'], segs=5, jitter=5, widths=[3, 1, 1])
    elif f == 8:
        clouds(c, True, f)
        c.rect(0, Y - 10, 127, Y + 10, 'z1')
        c.rect(0, Y - 6, 127, Y + 6, 'z3')
        c.rect(0, Y - 2, 127, Y + 2, 'w')
        for i in range(5):
            c.bolt((i * 30, Y), (i * 30 + 10, Y - 40 + (i % 2) * 80), seed=20 + i, keys=['z2', 'z4'], segs=4, jitter=5, widths=[2, 1])
    elif f == 9:
        clouds(c, True, f)
        c.rect(0, Y - 6, 127, Y + 6, 'z1')
        c.line([(0, Y), (127, Y)], 'z4', 3)
        for i in range(8):
            x = 8 + i * 16
            c.bolt((x, Y), (x + 6, Y - 20 - (i % 3) * 8), seed=30 + i, keys=['z2', 'z3'], segs=3, jitter=3, widths=[1, 1])
    elif f == 10:
        clouds(c, False, f)
        for x in range(0, 128, 4):
            c.px(x, Y + (x // 4) % 2, 'z2')
            c.px(x + 2, Y - 3 + (x // 4) % 3, 'z1')
        for i in range(6):
            c.spark(10 + i * 22, Y - 10 + (i % 2) * 20, 2, 'z4', 'z2')
    elif f == 11:
        for i in range(5):
            c.ddisc(14 + i * 25, 12, 10, 'q0', parity=i + 1)
        for i in range(7):
            c.spark(6 + i * 19, Y - 8 + (i * 7) % 18, 1, 'z3')


if __name__ == '__main__':
    run(globals())

