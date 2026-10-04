import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib_nm5 import *  # noqa

"""마도서 룬 탄환(투사체) — 청록 룬 글자가 빙글 돌며 왼쪽으로 날아가고 책장 부스러기 꼬리를 끈다. 32×4 루프, projectile(첫 칸 왼쪽)."""
KEY, SIZE, FRAMES = 'book_demon_rune', 32, 4
PAL = ['140c1c', '208080', '60f0e0', 'd8fff8', '6a2890', 'e6decc']
O, CD, C, CL, V, P = range(1, 7)


def draw(c, f, t):
    c.line([(14, 16), (28, 15 + f % 2)], CD)
    c.line([(16, 17), (26, 18 - f % 2)], V)
    c.px(26 - f * 2, 12 + f, P)
    c.px(28 - f, 20 - f, P)
    c.ell(10, 16, 7, 7, CD)
    c.ell(10, 16, 5.5, 5.5, O)
    a = f * math.pi / 8
    for k in range(3):
        b = a + k * 2 * math.pi / 3
        c.line([(10, 16), (10 + math.cos(b) * 4, 16 + math.sin(b) * 4)], C)
    c.px(10, 16, CL)
    c.px(4, 16, CL)
    c.ring(10, 16, 7, 7, C, 1)


run(globals())

