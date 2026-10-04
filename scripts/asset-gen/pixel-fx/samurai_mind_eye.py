"""samurai_mind_eye: 심안 (시전자). Ki gathers from a ground ring into a closed eye before the face; it opens in a white flash, sends out ripples, and closes as a calm indigo aura rises.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_samurai import *

KEY, SIZE, FRAMES, ANCHOR = 'samurai_mind_eye', 64, 10, 'user'
PAL = pal(INDIGO, pick(SAKURA, 's2', 's3'), pick(BOLT, 'y1', 'y2'), WHITE)
EX, EY = 32, 17


def eye(c, open_, glow=False):
    """Almond eye; open_ 0 (a line) .. 1 (fully open)."""
    w, h = 11, 1 + 5 * open_
    top = [(EX + (i - 10) / 10 * w, EY - math.sin(math.pi * i / 20) * h) for i in range(21)]
    bot = [(EX + (10 - i) / 10 * w, EY + math.sin(math.pi * i / 20) * h * 0.8) for i in range(21)]
    c.poly(top + bot, 'n1', outline='n3')
    if open_ > 0.3:
        c.disc(EX, EY, 3 + open_, 'n3' if not glow else 'y2')
        c.disc(EX, EY, 1.5, 'w' if glow else 'n4')
        c.px(EX - 1, EY - 2, 'w')
    c.line([(EX - w - 3, EY), (EX - w, EY)], 'n4')
    c.line([(EX + w, EY), (EX + w + 3, EY)], 'n4')


def ground(c, r, k, w=1):
    c.ring(32, FEET, r, k, w, squash=0.28)


def aura(c, f, keys):
    r = rng(f)
    for i in range(9):
        x = 16 + i * 4
        h = 10 + (i * 7 + f * 5) % 14
        y = FEET - 2 - (i * 3 + f * 4) % 8
        c.line([(x, y), (x, y - h)], keys[i % len(keys)])
        c.px(x, y - h - 2, keys[-1])


def draw(c, f):
    if f == 0:
        for i in range(12):
            c.px(*pol(32, FEET, 22, i * math.pi / 6, 0.28), 'n4' if i % 3 else 'w')
        ground(c, 24, 'n2')
    elif f == 1:
        ground(c, 18, 'n2', 2)
        ground(c, 18, 'n4')
        for i in range(8):
            a = i * math.pi / 4 + 0.3
            x, y = pol(32, 40, 14, a, 0.6)
            c.line([(x, y), (x + (32 - x) * 0.3, y + (EY - y) * 0.3)], 'n3')
            c.px(x, y, 'w')
    elif f == 2:
        ground(c, 14, 'n3', 2)
        c.lens((32, FEET - 2), (32, 10), 4, ['n1', 'n2', 'n3'])
        specks(c, 32, 34, 8, 8, 16, 2, ['n4', 'w'])
    elif f == 3:
        ground(c, 12, 'n3')
        c.lens((32, FEET - 2), (32, 10), 2, ['n2', 'n3'])
        eye(c, 0)
        c.spark(EX, EY, 3, 'w', 'n4')
    elif f == 4:
        ground(c, 12, 'n2')
        eye(c, 0.6)
        c.dring(EX, EY, 14, 'n3', squash=0.6)
    elif f == 5:
        c.ring(EX, EY, 16, 'n2', 2, squash=0.7)
        c.rays(EX, EY, 12, 15, 24, 'n4', rot=0.26, jitter=[1, 0.7], squash=0.7)
        eye(c, 1, glow=True)
        c.spark(EX, EY, 16, 'w', 'y2')
        ground(c, 18, 'n3', 2)
    elif f == 6:
        c.ring(EX, EY, 20, 'n3', 1, squash=0.7)
        c.dring(EX, EY, 25, 'n2', squash=0.7)
        eye(c, 1)
        ground(c, 22, 'n3', 2)
        ground(c, 28, 'n2')
        aura(c, f, ['n2', 'n3', 'n4'])
    elif f == 7:
        c.dring(EX, EY, 27, 'n2', parity=1, squash=0.7)
        aura(c, f, ['n2', 'n3', 'n4'])
        eye(c, 0.3)
        ground(c, 26, 'n3')
        specks(c, 32, 30, 6, 12, 26, 7, ['n4', 's3'], spark_every=3)
    elif f == 8:
        aura(c, f, ['n1', 'n2', 'n3'])
        c.line([(EX - 8, EY), (EX + 8, EY)], 'n4')
        c.dring(32, FEET, 29, 'n2', squash=0.28)
        specks(c, 32, 26, 7, 10, 26, 8, ['n4', 'n3', 's2'], spark_every=4)
    else:
        for i in range(0, 9, 2):
            c.px(16 + i * 4, 18 + (i * 5) % 12, 'n3')
            c.px(16 + i * 4, 21 + (i * 5) % 12, 'n2')
        specks(c, 32, 24, 6, 10, 26, 9, ['n2', 'n3'], spark_every=3, core='n4')


if __name__ == '__main__':
    run(globals())

