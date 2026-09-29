"""gargoyle_pal_rockfall: 낙석. 청회색 바윗덩이들이 엇갈려 떨어져 박히고 먼지와 파편이 쌓인다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'gargoyle_pal_rockfall', 64, 10, 'allTargets'
PAL = pal(STONE, pick(SAND, 'n1', 'n2', 'n3'))


def draw(c, f):
    plan = [(16, 0, 7), (32, 2, 8), (46, 1, 6), (24, 4, 5), (40, 5, 6)]
    for i, (x, st, r) in enumerate(plan):
        t = (f - st + 1) / 4
        gy = 50 + (i % 2) * 4
        if t < 0:
            continue
        if t < 1:
            c.ddisc(x, gy + 3, r + 2, 's0', squash=0.3)
        if t < 1:
            y = lerp(-2, gy, t * t)
            for k in range(1, 4):
                c.line([(x + k, y - r - k * 5), (x + k, y - r - k * 5 - 3)], 's1')
            rock(c, x, y, r, ['s0', 's2', 's3', 's4'], i, 8)
        else:
            u = min(1.0, (f - st - 4) / 5)
            if u < 0.3:
                c.spark(x, gy, 9 - u * 20, 's4', 's3', diag=True)
            rock(c, x, gy - 1 + u * 1.5, r - u * 2, ['s0', 's2', 's3'], i, 8) if u < 0.9 else None
            dust(c, x, gy + 3, 7 + u * 10, i, ['n1', 'n2', 'n3'], fade=u > 0.6)
            r2 = rng(i)
            for k in range(5):
                a = r2.uniform(3.6, 5.9)
                d = r2.uniform(5, 15) * ease(u)
                c.px(x + math.cos(a) * d, gy + math.sin(a) * d * 0.9 + u * u * 9, 's3' if k % 2 else 's2')


if __name__ == '__main__':
    run(globals())
