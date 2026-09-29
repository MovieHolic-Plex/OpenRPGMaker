"""priest_monk_incense: 정화: 아군 발치 향로에서 오른 향 연기가 굽이굽이 몸을 감싸고 금빛 가루가 씻겨 내려간다"""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'priest_monk_incense', 64, 10, 'allAllies'
PAL = pal(pick(SMOG, 'q1', 'q2', 'q3'), pick(GOLDY, 'y1', 'y2', 'y3'), pick(PURP, 'v3'), WHITE)


def draw(c, f):
    c.poly([(26, 54), (38, 54), (36, 58), (28, 58)], 'y1')
    c.rect(24, 52, 40, 53, 'y2')
    for j in range(3):
        c.line([(29 + j * 3, 52), (29 + j * 3, 47)], 'q2')
        c.px(29 + j * 3, 46, 'y3')
    h = min(1, (f + 1) / 5)
    for j in range(3):
        pts = []
        for i in range(0, int(40 * h)):
            y = 46 - i
            x = 32 + math.sin(i * .2 + f * .6 + j * 2) * (4 + i * .25) + (j - 1) * 3
            pts.append((x, y))
        if len(pts) > 1:
            c.line(pts, ['q1', 'q2', 'q3'][j])
    if f >= 4:
        r = rng(f)
        for i in range(8):
            c.px(CX + r.uniform(-18, 18), 14 + r.uniform(0, 34), 'y3' if i % 2 else 'v3')
    if f in (6, 8):
        c.spark(CX, 10, 3, 'w', 'y3')


if __name__ == '__main__':
    run(globals())

