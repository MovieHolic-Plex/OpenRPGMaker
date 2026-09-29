"""gunslinger_deadeye: 데드아이: 대상 위에 붉은 X 표식 세 개가 하나씩 찍히고, 한 번에 세 발이 꿰뚫으며 표식이 터진다"""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'gunslinger_deadeye', 64, 10, 'target'
PAL = pal(pick(EMBER, 'm0', 'm1', 'm2', 'm3', 'm4'), pick(INKK, 'k1'), WHITE)
MARKS = [(30, 20), (36, 32), (26, 40)]


def mark(c, x, y, s, k):
    c.line([(x - s, y - s), (x + s, y + s)], k, 2)
    c.line([(x - s, y + s), (x + s, y - s)], k, 2)


def draw(c, f):
    if f <= 6:
        c.dring(CX, 32, 26, 'k1', parity=f)
    for i, (x, y) in enumerate(MARKS):
        if f >= 1 + i * 2 and f <= 6:
            mark(c, x, y, 3, 'm2')
            if f == 1 + i * 2:
                c.ring(x, y, 7, 'm3')
    if f == 7:
        for x, y in MARKS:
            c.line([(x, y), (64, y - 6)], 'm4')
            pow_burst(c, x, y, 7, ['m1', 'm3', 'w'], n=8)
    if f >= 8:
        for x, y in MARKS:
            c.spark(x, y, 9 - f, 'w', 'm3')
            burst(c, x, y, (f - 7) / 3, 6, x, ['m4', 'm2', 'm1'], spd=(4, 12))


if __name__ == '__main__':
    run(globals())

