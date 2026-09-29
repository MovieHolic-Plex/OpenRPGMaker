"""demon_knight_wave: 마력 참격파(투사체). 붉은 초승달 참격이 검은 잔불을 끌며 왼쪽으로 날아간다. 첫 칸이 왼쪽을 본다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'demon_knight_wave', 32, 4, 'projectile'
PAL = pal(pick(DEMON, 'd1', 'd2', 'd3', 'd4'), pick(BLADE, 'k3'))
EDGE = dict(L=0)


def draw(c, f):
    x = 10 + (f % 2)
    # 초승달: 볼록한 쪽이 왼쪽(진행 방향)
    c.blade((x + 8, 2), (x + 8, 30), 10 + (f % 2), 9, ['d1', 'd2', 'd3', 'd4'], 1.0)
    c.line([(x + 1, 16), (x + 5, 16)], 'k3')
    for i in range(4):
        y = 6 + i * 6
        c.line([(x + 12 + i, y), (x + 20 + i + (f * 3 + i) % 4, y)], 'd1' if i % 2 else 'd2')
    c.px(x - 1, 16, 'd4')


if __name__ == '__main__':
    run(globals())
