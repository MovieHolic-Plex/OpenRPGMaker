"""golem_pal_pillars: 지반 융기. 발밑에서 흙기둥이 차례로 솟구쳐 위쪽에서 갈라지고 바위를 들어 올리며 흙비가 내린다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'golem_pal_pillars', 64, 10, 'allTargets'
PAL = pal(CLAY, pick(GOLD, 'y3'))


def draw(c, f):
    gy = 56
    plan = [(14, 0, 38), (30, 1, 46), (46, 2, 34), (22, 3, 26), (38, 3, 30)]
    for i, (x, st, H) in enumerate(plan):
        t = (f - st) / 3.0
        if t < 0:
            continue
        hh = H * (ease(min(1.0, t)) if f < 8 else max(0.0, (10 - f) / 2.0))
        if hh < 2:
            continue
        w = 6 + (i % 2)
        top = gy - hh
        c.poly([(x - w - 1, gy), (x - w + 1, top + 4), (x - 3, top), (x + 2, top + 2), (x + w - 1, top + 5), (x + w + 1, gy)], 'c0')
        c.poly([(x - w, gy), (x - w + 2, top + 5), (x - 3, top + 1), (x + 1, top + 3), (x + 1, gy)], 'c2')
        c.line([(x - w + 2, gy - 2), (x - w + 3, top + 6)], 'c3')
        c.line([(x + w - 1, gy), (x + w - 1, top + 6)], 'c1')
        for k in range(1, 4):
            yy = gy - hh * 0.22 * k
            c.line([(x - w + 1, yy), (x + w - 1, yy + 1)], 'c1')
        if hh > 20:
            rock(c, x + 1, top - 3 - (f - st) % 3, 3.4, ['c0', 'c2', 'c3', 'c4'], i, 6)
        if f <= st + 1:
            c.oval(x, gy + 1, 9, 2, 'c1')
            c.spark(x, gy - 2, 6, 'y3', 'c4')
    for k in range(6):
        r = rng(30 + k)
        c.px(r.uniform(4, 60), (f * 3 + k * 10) % 44 + 4, 'c3')
    if f >= 6:
        for k in range(4):
            dust(c, 8 + k * 16, gy + 2, 8, k + 40, ['c1', 'c2', 'c3'], fade=f >= 8)


if __name__ == '__main__':
    run(globals())
