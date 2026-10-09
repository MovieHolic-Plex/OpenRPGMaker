"""harpy_pal_feather: 깃털 표창 (투사체). 초록 깃 한 장이 흰 축을 번뜩이며 왼쪽으로 날아간다. 첫 칸이 왼쪽을 본다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'harpy_pal_feather', 32, 4, 'projectile'
PAL = pal(pick(LEAFG, 'g1', 'g2', 'g3'), pick(DOWN, 'f2', 'f3'), pick(AIR, 'a1', 'a2', 'a3'))
EDGE = dict(L=0)


def draw(c, f):
    off = [-0.14, 0.10, -0.07, 0.13][f]
    feather(c, 13 + f % 2, 16, math.pi + off, 24, 'g2', 'f3', 'g1', 'g3')
    for i, dy in enumerate((-6, -2, 3, 7)):
        L = 7 + ((f * 3 + i * 5) % 7)
        c.line([(24 + i % 2, 16 + dy), (24 + i % 2 + L, 16 + dy)], 'a1' if i % 2 else 'a2')
    c.spark(3 + f % 2, 16 + (f % 2) * 2 - 1, 2, 'f3', 'a3')
    c.px(29 - f * 2, 10 + f, 'a3'); c.px(27 - f, 22 - f, 'a3')


if __name__ == '__main__':
    run(globals())
