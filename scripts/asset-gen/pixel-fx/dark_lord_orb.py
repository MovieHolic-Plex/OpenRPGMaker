"""dark_lord_orb: 암흑 구체(투사체). 검보라 구체 둘레를 작은 조각 두 개가 돌고, 보랏빛 꼬리가 오른쪽으로 끌린다. 첫 칸이 왼쪽을 본다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'dark_lord_orb', 32, 4, 'projectile'
PAL = pal(DARKV, pick(HELL, 'z2'))
EDGE = dict(L=0)


def draw(c, f):
    x, y = 10, 16
    for i in range(4):
        c.line([(x + 6 + i * 2, y - 4 + i * 3 - f % 2), (x + 14 + i * 3 + (f + i) % 3 * 2, y - 4 + i * 3 - f % 2)], 'u2' if i % 2 else 'u1')
    c.disc(x, y, 7, 'u1')
    c.disc(x, y, 5, 'u2')
    c.disc(x - 1, y - 1, 3, 'u3')
    c.px(x - 2, y - 2, 'u4')
    c.px(x + 1, y + 1, 'z2')
    for j in range(2):
        a = f * math.pi / 2 + j * math.pi
        px, py = pol(x, y, 10, a, 0.5)
        c.disc(px, py, 1, 'u4' if j == 0 else 'u3')


if __name__ == '__main__':
    run(globals())

