"""gunner_volley: 마탄의 일제사격: 하늘이 어두워지고 오른쪽 위에서 왼쪽 아래로 예광탄 소나기가 쏟아지며 바닥에서 불똥과 연기가 튄다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'gunner_volley', 128, 12, 'screen'
PAL = pal(pick(STEELB, 'b0', 'b2'), pick(GOLDY, 'y1', 'y2', 'y3'), pick(SMOG, 'q1', 'q2', 'q3'), pick(EMBER, 'm3'), WHITE)


def draw(c, f):
    lvl = [.35, .6, .85, 1, 1, 1, 1, 1, 1, 1, .7, .4][f]
    shade(c, 64, 66, 52 * lvl + 14, 'b0', squash=.8)
    # 조준 원
    if 1 <= f <= 10:
        c.dring(60, 76, 32 + (f % 2), 'b2', squash=.55, parity=f)
    r = rng(90 + f * 3)
    if f >= 1:
        n = 26 if 3 <= f <= 9 else 12
        for i in range(n):
            x0 = r.uniform(30, 126)
            y0 = r.uniform(-6, 72)
            L = r.uniform(10, 24)
            dx, dy = -L * .55, L * .84
            if y0 + dy > 112:
                continue
            k = 'y3' if i % 3 == 0 else 'y2' if i % 3 == 1 else 'y1'
            c.line([(x0, y0), (x0 + dx, y0 + dy)], k)
            c.px(x0 + dx, y0 + dy, 'w')
            if i % 4 == 0:
                c.line([(x0 - dx * .5, y0 - dy * .5), (x0, y0)], 'q3')
    # 위쪽 총구 불꽃 별(오른쪽 위 모서리)
    if 1 <= f <= 10:
        for i in range(3):
            c.spark(84 + i * 15 + (f * 5 + i * 9) % 8, 8 + (f * 3 + i * 7) % 10, 3, 'w', 'm3')
    # 바닥 착탄
    if f >= 3:
        for i in range(6):
            x = 12 + (i * 17 + f * 11) % 76
            y = 84 + (i * 7 + f * 3) % 26
            if (f + i) % 3 == 0:
                c.spark(x, y, 3, 'w', 'y2')
                burst(c, x, y, .3, 4, i + f, ['y3', 'y2'], spd=(4, 10))
            elif (f + i) % 3 == 1:
                c.puff(x, y - 3, 3, ['q1', 'q2', 'q3'], i)
    if f == 11:
        pass


if __name__ == '__main__':
    run(globals())
