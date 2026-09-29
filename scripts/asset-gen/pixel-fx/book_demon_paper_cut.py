import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib_nm5 import *  # noqa

"""마도서 종이 칼날 — 날카로운 책장이 빙글 돌며 연달아 날아와 대상을 네 번 가르고 종잇조각이 흩날린다. 64×10, target."""
KEY, SIZE, FRAMES = 'book_demon_paper_cut', 64, 10
PAL = ['140c1c', 'b0a894', 'e6decc', 'fffcf0', '60f0e0', 'd83040', '6a2890']
O, PD, PM, PL, C, R, V = range(1, 8)
CUTS = [((10, 16), (54, 44)), ((54, 18), (10, 42)), ((8, 30), (56, 30)), ((20, 8), (44, 56))]


def page(c, x, y, a):
    ca, sa = math.cos(a), math.sin(a)
    pts = [(x + ca * dx - sa * dy, y + sa * dx + ca * dy) for dx, dy in ((-4, -3), (4, -3), (4, 3), (-4, 3))]
    c.poly(pts, PM)
    c.line([pts[0], pts[1]], PL)
    c.outline(O, [PM, PL])


def draw(c, f, t):
    for i, (a, b) in enumerate(CUTS):
        s = f - i * 2
        if s < 0:
            continue
        if s == 0:
            tx = a[0] + (b[0] - a[0]) * .5
            ty = a[1] + (b[1] - a[1]) * .5
            page(c, tx, ty, f * .9)
            c.line([a, (tx, ty)], C)
        elif s <= 3:
            c.line([a, b], PL if s == 1 else PD, 2 if s == 1 else 1)
            if s == 1:
                c.line([a, b], C)
    if f >= 3:
        for k in range(6):
            x = 12 + (k * 11 + f * 3) % 40
            y = 10 + (k * 7 + f * 4) % 44
            c.rect(x, y, x + 1, y + (k % 2), PD if k % 2 else PL)
    if f == 9:
        c.star(32, 30, 5, PL, C)


run(globals())

