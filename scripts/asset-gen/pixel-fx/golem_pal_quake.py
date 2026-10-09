"""golem_pal_quake: 대지 내려찍기. 바닥이 넓게 쩍 갈라지고 금이 사방으로 내달리며 흙기둥 파편이 솟는다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'golem_pal_quake', 64, 10, 'allTargets'
PAL = pal(CLAY, pick(GOLD, 'y3'))


def draw(c, f):
    gy = 52
    t = min(1.0, f / 5)
    # 충격 고리
    c.oval(32, gy, 4 + t * 30, 1 + t * 8, 'c3', 1)
    if f >= 2:
        c.oval(32, gy, 2 + (f - 2) * 5, 1 + (f - 2) * 1.2, 'c4', 1)
    for k in range(7):
        crack(c, 32, gy + (k % 2), math.radians(180 + (k * 26) % 180) if k < 6 else 0, 30, k + 12, 'c0', t, branch=2, k2='c1')
    # 솟는 흙조각들
    r = rng(6)
    for k in range(10):
        x = 6 + k * 5.5
        st = (k % 4) * 0.5
        u = (f - 1 - st) / 5
        if 0 <= u <= 1:
            y = gy - math.sin(u * math.pi) * (14 + (k % 3) * 8)
            rock(c, x, y, 2.4 + (k % 2), ['c0', 'c2', 'c3'], k, 5)
    if f in (1, 2):
        c.spark(32, gy - 2, 12 - f * 3, 'y3', 'c4', diag=True)
    if f >= 3:
        for i in range(4):
            dust(c, 8 + i * 16, gy + 3, 9 + (f - 3), i + 2, ['c1', 'c2', 'c3'], fade=f >= 7)


if __name__ == '__main__':
    run(globals())
