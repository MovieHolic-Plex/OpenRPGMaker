"""vampire_bloodmoon: 붉은 달의 밤(필살 배경, 화면 128). 핏빛 보름달이 떠오르고 박쥐 떼가 밤하늘을 가로지르며 붉은 안개가 낮게 깔린다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'vampire_bloodmoon', 128, 12, 'screen'
PAL = pal(BLOOD, pick(NIGHTV, 'n0', 'n1', 'n2', 'n3'), pick(BONEW, 'w1', 'w2'))
OVAL = 0.42


def draw(c, f):
    cx = 64
    rise = ease(min(1.0, (f + 1) / 5))
    my = lerp(86, 44, rise)
    R = 28
    # 달 광배
    for i, k in enumerate(('b1', 'b2')):
        c.ddisc(cx, my, R + 16 - i * 6, k, squash=1.0, parity=(f + i) % 2)
    c.disc(cx, my, R, 'b1')
    c.disc(cx, my, R - 2, 'b2')
    c.disc(cx - 2, my - 2, R - 8, 'b3')
    # 분화구 무늬
    for (dx, dy, rr) in ((-9, -5, 5), (8, 6, 6), (-3, 12, 3), (11, -10, 3)):
        c.disc(cx + dx, my + dy, rr, 'b2')
        c.arc(cx + dx, my + dy, rr, 200, 340, 'b4', 1)
    c.arc(cx, my, R - 3, 190, 290, 'b4', 2)
    # 박쥐 떼가 달 앞을 가로지른다
    r = rng(5)
    for i in range(14):
        ph = r.uniform(0, 1)
        t = (f / 11.0 * 1.2 + ph) % 1.0
        x = lerp(-10, 138, t)
        y = 44 + r.uniform(-28, 26) + math.sin(t * 10 + i) * 6
        bat(c, x, y, 5 + (i % 3) * 2, 'n0', math.sin(f * 2.3 + i), hi='b4')
    # 바닥 붉은 안개
    for i in range(7):
        c.ddisc(10 + i * 18 + math.sin(f * 0.5 + i) * 4, 116, 22, 'b1', squash=0.32, parity=(i + f) % 2)
        c.ddisc(10 + i * 18 + math.sin(f * 0.5 + i) * 4, 114, 14, 'b2', squash=0.3, parity=(i + f + 1) % 2)
    # 별
    for k in range(10):
        rr = rng(60 + k)
        c.px(rr.uniform(8, 120), rr.uniform(8, 60), 'n3' if (f + k) % 3 else 'n2')
    if f in (5, 6):
        c.spark(cx, my, 22 - (f - 5) * 6, 'b4', 'b3', diag=True)
    if f >= 8:
        for k in range(4):
            c.line([(cx - 40 + k * 26, my + R), (cx - 34 + k * 26, 112)], 'b2')


if __name__ == '__main__':
    run(globals())
