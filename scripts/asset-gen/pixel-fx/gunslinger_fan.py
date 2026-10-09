"""gunslinger_fan: 팬 해머: 여섯 발이 연달아 꽂혀 착탄 섬광이 대상 몸 위를 지그재그로 튀고 탄피가 떨어진다"""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'gunslinger_fan', 64, 10, 'target'
PAL = pal(pick(GOLDY, 'y1', 'y2', 'y3'), pick(EMBER, 'm1', 'm2', 'm3'), pick(STONE, 'r1', 'r2'), WHITE)
HITS = [(28, 22), (36, 30), (24, 34), (38, 20), (30, 42), (34, 36)]


def draw(c, f):
    for i, (x, y) in enumerate(HITS):
        age = f - i
        if age < 0 or age > 3:
            continue
        if age == 0:
            c.line([(x + 4, y), (x + 20, y - 2)], 'y3')
            pow_burst(c, x, y, 6, ['m2', 'y2', 'w'], rot=i, n=7)
        elif age == 1:
            c.spark(x, y, 4, 'w', 'y2', diag=True)
            c.disc(x, y, 1.3, 'm1')
        else:
            c.px(x, y, 'm1')
            c.dring(x, y, 3 + age, 'm3', parity=age)
    for i in range(min(f, 6)):
        t = (f - i) / 4
        c.rect(46 + i * 2, 20 + t * 26, 47 + i * 2, 21 + t * 26, 'y1' if i % 2 else 'y2')
    if f >= 8:
        dissolve(c, (f - 7) * .3)


if __name__ == '__main__':
    run(globals())

