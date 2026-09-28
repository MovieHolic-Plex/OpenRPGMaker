"""mon_spear_pierce: 관통 찌르기 (착탄). A spearhead drives straight in from the LEFT, punches through the ally
with a ring shockwave, bursts out the right side as a cone of wind streaks, then the line fades."""
import math

from lib_monster_36_52 import *

KEY, SIZE, FRAMES, ANCHOR = 'mon_spear_pierce', 64, 8, 'target'
PAL = pal(STEEL, pick(WOOD, 't0', 't1', 't2'), pick(BLOOD, 'r1', 'r2', 'r3'), SHOCK, WHITE)
PEAK = 3
Y = BY - 3


def spear(c, tip, L=28):
    """Leaf spearhead pointing RIGHT with its tip at x=tip, shaft trailing left."""
    c.line([(tip - 9, Y), (tip - L, Y)], 't0', 3)
    c.line([(tip - 9, Y - 1), (tip - L, Y - 1)], 't2')
    c.line([(tip - 9, Y), (tip - L, Y)], 't1')
    c.poly([(tip + 1, Y), (tip - 5, Y - 4), (tip - 10, Y), (tip - 5, Y + 4)], 's0')
    c.poly([(tip, Y), (tip - 5, Y - 3), (tip - 9, Y), (tip - 5, Y + 3)], 's1')
    c.line([(tip - 1, Y), (tip - 7, Y - 2)], 's3')
    c.rect(tip - 11, Y - 2, tip - 10, Y + 2, 'r2')


def draw(c, f):
    if f == 0:
        c.line([(2, Y), (18, Y)], 's1')
        c.line([(6, Y - 4), (14, Y - 4)], 's0')
        c.line([(4, Y + 4), (12, Y + 4)], 's0')
        spear(c, 24, 22)
    elif f == 1:
        c.line([(2, Y), (26, Y)], 's2', 3)
        c.line([(2, Y), (26, Y)], 's3')
        spear(c, 36, 30)
        c.spark(37, Y, 3, 'w', 'h2')
    elif f == 2:        # impact: ring on the pierce point
        spear(c, 44, 40)
        c.ring(30, Y, 7, 'h1', 1, squash=1.4)
        c.ring(30, Y, 5, 'h2', 1, squash=1.4)
        c.spark(44, Y, 5, 'w', 'h2', diag=True)
    elif f == 3:        # PEAK: through the body, flash line + exit cone
        c.lens((0, Y), (64, Y), 5, ['s0', 's1', 'h2', 'w'])
        c.oval(30, Y, 5, 10, 'h1', 1)
        c.oval(30, Y, 3, 7, 'w', 1)
        for i, a in enumerate((-0.45, -0.22, 0.22, 0.45)):
            c.line([pol(44, Y, 4, a), pol(44, Y, 17 - abs(i - 1.5) * 2, a)], 's2' if i % 3 else 'h2')
        c.spark(46, Y, 7, 'w', 'h2', diag=True)
        for i in range(4):
            c.px(48 + i * 3, Y + 3 + i, 'r2' if i % 2 else 'r3')
    elif f == 4:        # shaft withdrawn, ring grows, streaks leave to the right
        c.lens((6, Y), (60, Y), 2.5, ['s1', 's3'])
        c.oval(30, Y, 8, 14, 'h1', 1)
        c.dring(30, Y, 10, 's1', squash=1.5)
        for i, a in enumerate((-0.4, -0.15, 0.15, 0.4)):
            c.line([pol(48, Y, 4, a), pol(48, Y, 12, a)], 's2')
        for i in range(6):
            c.px(50 + i * 2, Y + 4 + i * 1.3, 'r2' if i % 2 else 'r1')
    elif f == 5:
        c.dline((10, Y), (58, Y), 's2', step=2)
        c.dring(30, Y, 12, 'h1', squash=1.3)
        for i, a in enumerate((-0.35, 0.0, 0.35)):
            c.dline(pol(50, Y, 2, a), pol(50, Y, 12, a), 's1', step=2)
        for i in range(5):
            c.px(52 + i * 2, Y + 8 + i * 1.6, 'r1')
    elif f == 6:
        c.dline((20, Y), (54, Y), 's1', step=3)
        c.spark(30, Y, 3, 's2', 's1')
        for i in range(4):
            c.px(54 + i * 2, FEET - 4 + (i % 2), 'r1')
    else:
        c.dline((26, Y), (46, Y), 's1', step=4)
        c.px(30, Y, 's2')
        c.px(31, Y, 's1')
        for i in range(3):
            c.px(56 + i * 2, FEET - 1, 'r1')
    fade_edges(c, L=4, R=4)


if __name__ == '__main__':
    run(globals())

