"""golem_pal_boulder: 바위 투척(투사체). 울퉁불퉁한 흙바위가 빙글빙글 돌며 왼쪽으로 날아가고 부스러기가 떨어진다. 첫 칸이 왼쪽을 본다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'golem_pal_boulder', 32, 4, 'projectile'
PAL = pal(pick(CLAY, 'c0', 'c1', 'c2', 'c3', 'c4'))
EDGE = dict(L=0)


def draw(c, f):
    x, y = 13, 16
    rot = f * 0.7
    pts = []
    for i in range(9):
        a = rot + i * 2 * math.pi / 9
        rr = [10, 8.5, 10.5, 9, 10, 8, 10.5, 9, 9.5][i]
        pts.append(pol(x, y, rr, a))
    c.poly(pts, 'c0')
    pts2 = [pol(x - 0.8, y - 0.8, r_ * 0.78, a_) for (r_, a_) in [(10, rot + i * 2 * math.pi / 9) for i in range(9)]]
    c.poly(pts2, 'c2')
    c.poly([pol(x - 2, y - 3, 5.5, rot + i * 2 * math.pi / 5) for i in range(5)], 'c3')
    c.px(x - 3, y - 4, 'c4'); c.px(x - 2, y - 4, 'c4')
    c.line([pol(x, y, 2, rot + 2), pol(x, y, 8, rot + 2.3)], 'c0')
    for i in range(4):
        c.px(x + 10 + i * 3 + (f * 2) % 3, y + (i % 3 - 1) * 4 + (f + i) % 3, 'c1' if i % 2 else 'c2')


if __name__ == '__main__':
    run(globals())
