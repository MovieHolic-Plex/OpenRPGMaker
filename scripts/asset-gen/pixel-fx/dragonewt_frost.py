"""dragonewt_frost: 서리 브레스. 하얀 냉기 안개가 밀려와 얼음 가시 송이가 솟고 바닥이 서리 결정으로 덮이며 눈가루가 흩날린다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'dragonewt_frost', 64, 10, 'allTargets'
PAL = pal(ICE)


def ice(c, x, gy, h, w, keys):
    tip = (x + (w % 3 - 1), gy - h)
    c.poly([(x - w, gy), (x - w * 0.6, gy - h * 0.55), tip, (x + w * 0.5, gy - h * 0.6), (x + w, gy)], keys[0])
    c.poly([(x - w + 1, gy), (x - w * 0.55, gy - h * 0.55), tip, (x, gy - h * 0.4), (x - 1, gy)], keys[1])
    c.line([(x - w * 0.4, gy - 2), (x - w * 0.3, gy - h * 0.6)], keys[2])
    c.px(tip[0], tip[1], keys[3])


def draw(c, f):
    gy = 55
    # 밀려오는 냉기 안개
    if f <= 6:
        for i in range(6):
            x = 70 - (f + 1) * 12 - i * 5 + (i % 2) * 6
            c.ddisc(x, 30 + (i % 3) * 8, 10 + (i % 2) * 4, 'i1', squash=0.7, parity=i % 2)
            c.ddisc(x - 1, 29 + (i % 3) * 8, 6, 'i2', squash=0.7, parity=(i + 1) % 2)
    plan = [(14, 2, 30), (26, 3, 40), (38, 3, 34), (50, 4, 26), (20, 5, 20), (44, 5, 22)]
    for i, (x, st, H) in enumerate(plan):
        t = (f - st) / 3.0
        if t < 0:
            continue
        hh = H * (ease(min(1.0, t)) if f < 8 else max(0.0, (10 - f) / 2))
        if hh > 2:
            ice(c, x, gy, hh, 5 + (i % 2), ['i0', 'i2', 'i3', 'i4'])
            if f == st + 1:
                c.spark(x, gy - hh, 4, 'i4', 'i3')
    for k in range(8):
        r = rng(30 + k)
        c.spark(r.uniform(4, 60), (f * 4 + r.uniform(0, 50)) % 54 + 2, 1, 'i4', 'i3')
    if f >= 4:
        for k in range(7):
            c.line([(4 + k * 9, gy + 2), (8 + k * 9, gy + 2 + (k % 2))], 'i3')
        c.oval(32, gy + 1, 28, 2.5, 'i2', 1)


if __name__ == '__main__':
    run(globals())
