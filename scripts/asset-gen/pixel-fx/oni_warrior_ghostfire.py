"""oni_warrior_ghostfire: 귀화 날리기(투사체). 둥근 머리가 왼쪽, 갈라진 푸른 꼬리가 오른쪽으로 일렁인다. 첫 칸이 왼쪽을 본다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'oni_warrior_ghostfire', 32, 4, 'projectile'
PAL = pal(GHOST)
EDGE = dict(L=0)


def draw(c, f):
    y = 16
    for i, (dx, r) in enumerate([(27, 1.5), (23, 2), (19, 3)]):
        wob = math.sin(f * 1.6 + i * 1.1) * 2
        c.disc(dx + f % 2, y + wob, r, 'h0' if i == 0 else 'h1')
    c.poly([(3, y), (7, y - 7), (15, y - 5 + f % 2), (24, y - 9 + f % 3), (19, y), (24, y + 8 - f % 3), (15, y + 5), (7, y + 7)], 'h1')
    c.poly([(4, y), (8, y - 5), (14, y - 3), (18, y), (14, y + 3), (8, y + 5)], 'h2')
    c.disc(8, y, 3, 'h3')
    c.disc(7, y - 1, 1, 'h4')
    for i in range(3):
        c.px(29 - (f * 4 + i * 9) % 14, y - 6 + i * 6, 'h3')


if __name__ == '__main__':
    run(globals())

