"""gargoyle_pal_dive: 급강하 폭격. 위에서 곤두박질친 돌덩이 꼬리별이 땅에 꽂혀 분화구 고리와 파편이 사방으로 터진다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'gargoyle_pal_dive', 64, 9, 'target'
PAL = pal(STONE, pick(SAND, 'n1', 'n2', 'n3'), pick(GOLD, 'y3'))


def draw(c, f):
    cx, gy = 32, 54
    if f <= 3:                                              # 곤두박질 궤적
        t = (f + 1) / 4
        y = lerp(6, gy - 8, t * t)
        x = lerp(48, cx, t)
        for k in range(1, 6):
            c.line([(x + k * 3.2, y - k * 6), (x + k * 3.2 + 2, y - k * 6 - 4)], 's1' if k % 2 else 's2', 2)
        rock(c, x, y, 7, ['s0', 's2', 's3', 's4'], 4)
        c.spark(x - 2, y - 2, 3, 's4', 's3')
    if f >= 3:
        t = (f - 3) / 5
        c.spark(cx, gy - 2, max(3, 12 - (f - 3) * 3), 'y3', 's4', diag=True)
        c.oval(cx, gy, 6 + t * 26, 2 + t * 5, 's3', 1)
        c.oval(cx, gy + 1, 4 + t * 20, 1 + t * 4, 's2', 1)
        r = rng(21)
        for k in range(9):
            a = math.radians(200 + (k / 8) * 140)
            v = r.uniform(12, 30)
            x = cx + math.cos(a) * v * ease(t)
            y = gy - 2 + math.sin(a) * v * ease(t) + t * t * 22
            rock(c, x, y, 2.4 - t, ['s0', 's2', 's3'], k, 5) if t < 0.9 else c.px(x, y, 's2')
        dust(c, cx, gy, 10 + t * 14, 5, ['n1', 'n2', 'n3'], fade=f >= 7)
        for k in range(4):
            crack(c, cx + (k - 1.5) * 4, gy + 1, math.radians(180 if k < 2 else 0) + (k % 2) * 0.3, 14, 40 + k, 's0', t, branch=1)


if __name__ == '__main__':
    run(globals())
