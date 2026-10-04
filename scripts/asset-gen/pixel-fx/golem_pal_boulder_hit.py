"""golem_pal_boulder_hit: 바위 투척 착탄. 바위가 산산이 부서져 파편이 방사형으로 튀고 별 모양 충격이 번쩍인다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'golem_pal_boulder_hit', 64, 8, 'target'
PAL = pal(CLAY, pick(GOLD, 'y3'))


def draw(c, f):
    cx, cy = 30, 36
    if f <= 1:
        rock(c, cx + 4 - f * 4, cy, 10 - f * 2, ['c0', 'c2', 'c3', 'c4'], 3, 9)
    if f >= 1:
        n = 9
        for i in range(n):
            a = i * 2 * math.pi / n + 0.3
            d = (6 + (i % 3) * 5) + (f - 1) * (5 + (i % 2) * 2)
            x, y = cx + math.cos(a) * d, cy + math.sin(a) * d * 0.9 + max(0, f - 3) ** 2 * 1.3
            rock(c, x, y, max(1.2, 4 - (i % 3) - (f - 1) * 0.4), ['c0', 'c2', 'c3'], i, 5)
    if f in (1, 2):
        pts = [pol(cx, cy, 14 - f * 3 if k % 2 == 0 else 6, k * math.pi / 6) for k in range(12)]
        c.poly(pts, 'y3' if f == 1 else 'c4')
        c.spark(cx, cy, 10 - f * 2, 'y3', 'c4', diag=True)
    if f >= 2:
        dust(c, cx, cy + 12, 9 + (f - 2) * 2.5, 2, ['c1', 'c2', 'c3', 'c4'], fade=f >= 5)


if __name__ == '__main__':
    run(globals())
