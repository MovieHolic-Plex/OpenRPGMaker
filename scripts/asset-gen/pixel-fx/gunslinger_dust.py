"""gunslinger_dust: 모래 회오리: 모래바람이 대상 둘레로 휘몰아쳐 시야를 가리고, 바람 틈으로 총구 섬광이 번쩍인다"""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'gunslinger_dust', 64, 8, 'target'
PAL = pal(pick(EARTHB, 'd1', 'd2', 'd3'), pick(GOLDY, 'y2', 'y3'), pick(EMBER, 'm2'), WHITE)


def draw(c, f):
    for j in range(3):
        a0 = f * 50 + j * 120
        band(c, CX, 36 - j * 4, 20 - j * 3, 8 - j, a0, a0 + 150, 4, ['d1', 'd2', 'd3'])
    r = rng(f)
    for i in range(14):
        a = r.uniform(0, 2 * math.pi)
        d = r.uniform(8, 24)
        c.px(CX + math.cos(a) * d, 34 + math.sin(a) * d * .5 - r.uniform(0, 10), 'd3' if i % 2 else 'd2')
    if f in (4, 5):
        x = 18 if f == 4 else 44
        pow_burst(c, x, 30, 7, ['m2', 'y2', 'w'], n=7)
        c.line([(x, 30), (CX, 32)], 'y3')
    if f == 7:
        dissolve(c, .45)


if __name__ == '__main__':
    run(globals())

