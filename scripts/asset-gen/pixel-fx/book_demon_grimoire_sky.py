import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib_nm5 import *  # noqa

"""마도서 마지막 장(필살기 배경) — 하늘에 거대한 보라 마도서가 펼쳐지고 책장이 넘어가며 금빛 마법진과 룬 폭풍이 쏟아진다. 128×12, screen."""
KEY, SIZE, FRAMES = 'book_demon_grimoire_sky', 128, 12
PAL = ['0c0616', '1c0c2c', '3a1450', '6a2890', 'a058c8', 'e0b040', 'fff2a0', 'b0a894', 'e6decc', 'fffcf0', '60f0e0', 'd8fff8', '140c1c']
N0, N1, VD, VM, VL, G, GL, PD, PM, PL, C, CL, O = range(1, 14)


def glyph(c, x, y, v, k):
    shapes = [((0, -3), (0, 3), (-3, 0), (3, 0)), ((-3, -3), (3, 3), (3, -3), (-3, 3)), ((-3, 3), (0, -3), (0, -3), (3, 3))]
    s = shapes[v % 3]
    c.line([(x + s[0][0], y + s[0][1]), (x + s[1][0], y + s[1][1])], k)
    c.line([(x + s[2][0], y + s[2][1]), (x + s[3][0], y + s[3][1])], k)


def draw(c, f, t):
    c.ell(64, 64, 62, 60, N0)
    c.ell(64, 60, 52, 44, N1)
    op = min(f / 4, 1)
    top = 18
    h = 38
    w = 12 + 34 * op
    c.poly([(64, top + 4), (64 - w - 4, top), (64 - w - 6, top + h + 4), (64, top + h + 8)], VM)
    c.poly([(64, top + 4), (64 + w + 4, top), (64 + w + 6, top + h + 4), (64, top + h + 8)], VM)
    c.poly([(64, top + 6), (64 - w, top + 3), (64 - w - 1, top + h), (64, top + h + 4)], PM)
    c.poly([(64, top + 6), (64 + w, top + 3), (64 + w + 1, top + h), (64, top + h + 4)], PM)
    c.line([(64, top + 4), (64, top + h + 8)], VD, 2)
    if op >= 1:
        for k in range(5):
            y = top + 10 + k * 6
            c.line([(64 - w + 4, y), (60, y + 1)], PD)
            c.line([(68, y + 1), (64 + w - 4, y)], PD)
    if 3 <= f <= 7:
        tt = (f - 3) / 4
        fx = 64 + (w - 2) * math.cos(tt * math.pi)
        c.poly([(64, top + 5), (fx, top + 2 - math.sin(tt * math.pi) * 8), (fx, top + h + 2 - math.sin(tt * math.pi) * 6), (64, top + h + 5)], PL)
    for x0, y0 in ((64 - w - 6, top), (64 + w + 2, top), (64 - w - 6, top + h), (64 + w + 2, top + h)):
        c.rect(x0, y0, x0 + 4, y0 + 4, G)
    c.outline(O, [VM])
    if f >= 5:
        r = 14 + (f - 5) * 3
        c.ring(64, 96, r + 12, (r + 12) * .3, G, 1)
        c.ring(64, 96, r, r * .3, GL, 1, gap=8, phase=f)
    if f >= 6:
        for k in range(10):
            s = f - 6
            x = 18 + k * 10
            y = 60 + ((s * 9 + k * 13) % 50)
            glyph(c, x, y, k, C if k % 2 else CL)
    if f == 11:
        c.star(64, 70, 12, CL, GL)


run(globals())

