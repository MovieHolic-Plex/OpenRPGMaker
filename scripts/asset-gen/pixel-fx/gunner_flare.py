"""gunner_flare: 신호탄: 오른쪽 아래에서 솟은 연기 꼬리가 하늘에서 터져 붉은 빛무리가 천천히 내려온다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'gunner_flare', 128, 10, 'screen'
PAL = pal(EMBER, SMOG, GOLDY, WHITE)
FX_, FY_ = 62, 30


def draw(c, f):
    if f <= 2:
        # 상승: 오른쪽 아래(아군)에서 위 가운데로
        t = [.35, .7, 1][f]
        x0, y0 = 104, 96
        x1, y1 = lerp(x0, FX_, t), lerp(y0, FY_, t)
        for j in range(14):
            u = t * (1 - j / 16)
            x, y = lerp(x0, FX_, u), lerp(y0, FY_, u)
            c.puff(x, y, 2.6 - j * .12 if j < 10 else 1, ['q1', 'q2', 'q3'], j) if j % 2 == 0 else c.px(x, y, 'y2')
        c.line([(x1, y1), (x1 + 3, y1 + 6)], 'm4', 2)
        c.spark(x1, y1, 3, 'w', 'y3')
    elif f == 3:
        c.disc(FX_, FY_, 11, 'm4')
        c.disc(FX_, FY_, 6, 'w')
        c.rays(FX_, FY_, 14, 8, 30, 'y3', rot=.1, jitter=[1, .6, .9, .7])
        shade(c, FX_, FY_ + 20, 42, 'm0', squash=.8)
    else:
        k = f - 4
        y = FY_ + k * 5
        shade(c, FX_, y + 20, 46, 'm0', squash=.8)
        c.dring(FX_, y, 24 + k * 2, 'm1')
        c.dring(FX_, y, 16 + k, 'm2', parity=1)
        c.disc(FX_, y, 6, 'm2')
        c.disc(FX_, y, 4, 'm3')
        c.disc(FX_ - 1, y - 1, 2, 'w')
        c.rays(FX_, y, 10, 8, 14 - k, 'm4', rot=f * .3, jitter=[1, .6, .8])
        for i in range(8):
            a = i * .8 + f * .5
            sx, sy = FX_ + math.cos(a) * (20 + i * 3), y + 8 + math.sin(a * 1.3) * 10 + (f * 3 + i * 5) % 20
            c.spark(sx, sy, 2 if i % 2 else 1, 'y3', 'm3')
        c.line([(FX_, y + 4), (FX_ + 2, y + 34)], 'q2')
        c.dline((FX_ + 2, y + 6), (FX_ + 4, y + 40), 'q3', 3)


if __name__ == '__main__':
    run(globals())
