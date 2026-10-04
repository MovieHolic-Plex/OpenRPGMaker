"""golem_pal_roll: 구르기. 둥글게 말린 바위 덩이가 굴러 지나가며 흙먼지 띠와 눌린 자국, 튀는 돌을 남긴다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'golem_pal_roll', 64, 10, 'target'
PAL = pal(CLAY, pick(GOLD, 'y3'))


def draw(c, f):
    gy = 54
    t = f / 9
    x = lerp(60, 4, t)
    rot = -f * 0.9
    R = 14
    y = gy - R + 1
    if 0 < f < 9:
        pts = [pol(x, y, R + (1 if i % 2 else -0.5), rot + i * 2 * math.pi / 12) for i in range(12)]
        c.poly(pts, 'c0')
        c.poly([pol(x - 1, y - 1, R - 3 + (i % 2), rot + i * 2 * math.pi / 12) for i in range(12)], 'c2')
        c.poly([pol(x - 4, y - 4, R - 8, rot + i * 2 * math.pi / 6) for i in range(6)], 'c3')
        for k in range(4):
            c.line([pol(x, y, 3, rot + k * 1.57), pol(x, y, R - 3, rot + k * 1.57 + 0.4)], 'c1')
        c.px(x - 6, y - 8, 'c4')
    # 자국과 먼지 띠
    for i in range(6):
        px = x + 14 + i * 9
        if px < 68 and f > 0:
            dust(c, px, gy + 1, 7, 10 + i, ['c1', 'c2', 'c3'], fade=i > 2)
    for k in range(6):
        r = rng(4 + k)
        if f > 1:
            c.px(x + 16 + r.uniform(0, 24), gy - r.uniform(2, 14) - (f % 3), 'c3')
    if f == 1:
        c.spark(58, gy - 8, 6, 'y3', 'c4')
    if f in (5, 6):
        c.spark(x - 6, gy - 4, 6, 'y3', 'c4', diag=True)
    if f >= 6:
        c.line([(4, gy + 3), (60, gy + 3)], 'c1')
    if f == 0:
        c.spark(58, gy - 12, 3, 'c4', 'c3')
        c.line([(52, gy - 4), (60, gy - 4)], 'c2')


if __name__ == '__main__':
    run(globals())
