"""dragonewt_flame: 화염 브레스(투사체). 좁은 불줄기가 앞이 뭉툭한 불덩이로 뭉쳐 일렁이며 왼쪽으로 날아간다. 첫 칸이 왼쪽을 본다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'dragonewt_flame', 32, 4, 'projectile'
PAL = pal(FIRE)
EDGE = dict(L=0)


def draw(c, f):
    y = 16
    # 꼬리로 갈수록 가늘어지는 불줄기: 앞(왼쪽)에 큰 머리
    for i, (dx, hh) in enumerate([(3, 7), (8, 8), (13, 7), (18, 6), (23, 4), (28, 3)]):
        wob = math.sin(f * 1.7 + i * 1.3) * 1.6
        x = dx + (f % 2) * (1 if i % 2 else 0)
        c.poly([(x - 4, y + wob), (x, y - hh + wob), (x + 5, y - hh * 0.5 + wob), (x + 6, y + hh * 0.4 + wob), (x, y + hh + wob)], 'e1' if i > 3 else 'e2')
        if i < 4:
            c.poly([(x - 2, y + wob), (x, y - hh * 0.6 + wob), (x + 3, y + wob), (x, y + hh * 0.6 + wob)], 'e3')
    c.disc(6, y, 4, 'e3')
    c.disc(5, y, 2, 'e4')
    for i in range(3):
        c.px(2 + ((f * 5 + i * 9) % 26), y - 8 + i * 8, 'e4')


if __name__ == '__main__':
    run(globals())
