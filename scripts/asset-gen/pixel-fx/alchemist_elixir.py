"""alchemist_elixir: 회복 영약: 푸른 영약이 위에서 쏟아져 물방울로 튀고 거품이 오르며 초록 십자가 떠오른다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'alchemist_elixir', 64, 8, 'target'
PAL = pal(TEAL, pick(ICEB, 'i2', 'i3', 'i4'), pick(LEAFG, 'g2', 'g3'), WHITE)


def cross(c, x, y, s, k, ol):
    c.rect(x - s, y - 1, x + s, y + 1, ol)
    c.rect(x - 1, y - s, x + 1, y + s, ol)
    c.rect(x - s + 1, y, x + s - 1, y, k)
    c.rect(x, y - s + 1, x, y + s - 1, k)


def draw(c, f):
    if f <= 2:
        h = [16, 30, 40][f]
        w = [2, 3, 4][f]
        c.rect(CX - w, 4, CX + w, 4 + h, 't1')
        c.rect(CX - w + 1, 4, CX - w + 1, 4 + h, 't2')
        c.rect(CX + w - 1, 4, CX + w - 1, 4 + h, 't3') if w > 2 else None
        for i in range(5):
            c.px(CX - 5 + i * 2 + f, 8 + (i * 9 + f * 5) % 34, 'i3')
        if f == 2:
            c.oval(CX, 50, 12, 4, 't2')
    elif f <= 4:
        k = f - 3
        c.oval(CX, 50, 14 + k * 6, 4 + k, 't1')
        c.oval(CX, 49, 10 + k * 5, 3 + k, 't2')
        c.ring(CX, 50, 18 + k * 6, 'i3', 1, squash=.3)
        c.rect(CX - 3 + k, 4, CX + 3 - k, 20 - k * 12, 't2') if k == 0 else None
        for i in range(5):
            bubble(c, 16 + i * 8, 44 - i % 3 * 6 - k * 6, 2 + i % 2, 'i3')
        drops(c, CX, 48, .3 + k * .3, 8, 4, ['i3', 'i4', 't3'], spd=(8, 20))
    else:
        k = f - 5
        c.oval(CX, 50, 20, 4, 't1') if k < 2 else None
        for i in range(4):
            bubble(c, 14 + i * 12, 40 - k * 8 - (i % 2) * 6, 2 + (i + k) % 2, 'i4')
        cross(c, CX - 8, 34 - k * 6, 4, 'g3', 'g2')
        cross(c, CX + 9, 42 - k * 6, 3, 'g3', 'g2')
        cross(c, CX + 1, 22 - k * 4, 5, 'w', 'g3')
        for i in range(5):
            c.spark(12 + (i * 11) % 40, 30 - k * 3 + (i * 7) % 24, 2, 'w', 'i3')
        c.dring(CX, 52, 16 + k * 3, 'i2', squash=.3)
        dissolve(c, .35 * (k - 1) if k > 1 else 0)


if __name__ == '__main__':
    run(globals())
