"""demon_knight_thrust: 지옥 찌르기. 붉은 창끝 모양 충격이 왼쪽으로 곧게 뻗어 관통하고 관통점에서 방사 파편이 터진다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'demon_knight_thrust', 64, 8, 'target'
PAL = pal(DEMON, BLADE, pick(GOLD, 'y3'))


def draw(c, f):
    cy = 34
    if f <= 4:
        L = [14, 34, 60, 66, 48][f]
        x1 = 64 - L
        for k, key in enumerate(('d1', 'd2', 'd3', 'd4')):
            w = 5 - k
            c.poly([(x1, cy), (min(70, x1 + 22), cy - w * 2 - 1), (70, cy - w), (70, cy + w), (min(70, x1 + 22), cy + w * 2 + 1)], key)
        c.line([(x1, cy), (70, cy)], 'k3')
        c.px(x1 - 1, cy, 'y3')
    if f >= 3:
        c.spark(20, cy, [0, 0, 0, 12, 10, 7, 4, 2][f], 'y3', 'd4', diag=True)
        spark_burst(c, 14, cy, (f - 3) / 4, 14, 3, ['d4', 'd3', 'd2', 'd1'], spd=(8, 26), size=(1, 2.2))
    if f >= 4:
        c.line([(2, cy - 10 - (f - 4) * 2), (30, cy)], 'd2')
        c.line([(2, cy + 10 + (f - 4) * 2), (30, cy)], 'd2')
    if f >= 5:
        for k in range(4):
            c.line([(6 + k * 3, cy - 5 + k * 3), (18 + k * 3, cy - 5 + k * 3)], 'd3')


if __name__ == '__main__':
    run(globals())
