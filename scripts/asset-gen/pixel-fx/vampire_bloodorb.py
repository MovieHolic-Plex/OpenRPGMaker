"""vampire_bloodorb: 핏빛 구슬(투사체). 검붉은 피 구슬이 핏방울 꼬리를 늘어뜨리며 왼쪽으로 날아간다. 첫 칸이 왼쪽을 본다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'vampire_bloodorb', 32, 4, 'projectile'
PAL = pal(BLOOD, pick(BONEW, 'w2'))
EDGE = dict(L=0)


def draw(c, f):
    x, y = 12, 16
    r = [6.0, 6.6, 6.2, 6.8][f]
    # 꼬리: 오른쪽으로 길게 늘어진 핏방울들
    for i in range(6):
        px = x + 6 + i * 3 + (f * 2) % 3
        py = y + math.sin(i * 1.4 + f * 1.5) * 3
        c.disc(px, py, max(0.6, 2.4 - i * 0.35), 'b2' if i % 2 == 0 else 'b1')
    for i in range(3):
        c.px(x + 8 + ((f * 5 + i * 7) % 16), y - 6 + i * 6, 'b3')
    orb(c, x, y, r, ('b0', 'b2', 'b3', 'b4'))
    c.disc(x, y, r * 0.45, 'b3')
    c.line([(x - 2, y - 3), (x + 1, y - 4)], 'w2')
    c.px(x - r - 1, y + (f % 2) * 2 - 1, 'b4')
    c.line([(x - 1, y + r), (x - 1, y + r + 1 + f % 2)], 'b3')


if __name__ == '__main__':
    run(globals())
