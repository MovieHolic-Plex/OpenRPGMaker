"""vampire_bloodspikes: 피의 창. 땅에서 핏빛 창이 차례로 솟아 뾰족하게 뻗고 핏방울이 흘러내린다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'vampire_bloodspikes', 64, 10, 'allTargets'
PAL = pal(BLOOD, pick(BONEW, 'w2'), pick(NIGHTV, 'n1', 'n2'))


def draw(c, f):
    plan = [(16, 0, 34), (30, 1, 44), (44, 0, 30), (23, 2, 22), (38, 3, 26)]
    gy = 55
    for i, (x, st, H) in enumerate(plan):
        t = (f - st) / 3.0
        if t < 0:
            continue
        h = H * (ease(min(1, t)) if f < 8 else max(0.0, (10 - f) / 2))
        if h < 2:
            continue
        w = 5 - (i % 2)
        # 창날: 밑이 굵고 위가 뾰족, 약간 휘어짐
        lean = (i % 3 - 1) * 2
        tip = (x + lean, gy - h)
        c.poly([(x - w - 1, gy), (x - w + 1, gy - h * 0.5), tip, (x + w - 1, gy - h * 0.55), (x + w + 1, gy)], 'b0')
        c.poly([(x - w, gy), (x - w + 1.5, gy - h * 0.5), tip, (x + 1, gy - h * 0.5), (x + 1, gy)], 'b2')
        c.line([(x - w + 2, gy - 2), (x - 1 + lean * 0.5, gy - h * 0.8)], 'b3')
        c.px(tip[0], tip[1], 'b4')
        if h > 20:
            for k in range(1, 4):
                yy = gy - h * 0.25 * k
                c.line([(x - w + 1, yy), (x + w - 1, yy)], 'b1')
        if f >= st + 3 and h > 10:
            drip(c, x + w - 1, gy - h * 0.4, 3 + (f - st) % 3 * 2, ('b3', 'b4'))
        if f <= st + 1:
            c.oval(x, gy + 1, 8, 2, 'b1')
            spark_burst(c, x, gy - 2, t + 0.3, 6, 4 + i, ['b4', 'b3', 'b2'], spd=(6, 14), grav=0.8)
    for k in range(4):
        c.px(6 + k * 16, 8 + (f * 4 + k * 9) % 30, 'n2')


if __name__ == '__main__':
    run(globals())
