"""gunslinger_ricochet: 도탄 사격: 탄이 꺾인 궤적을 그리며 튕겨 다니다가 대상을 스치고 불똥이 튄다"""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'gunslinger_ricochet', 64, 8, 'allTargets'
PAL = pal(pick(GOLDY, 'y1', 'y2', 'y3'), pick(EMBER, 'm2', 'm3'), WHITE)
PATH = [(62, 10), (44, 54), (20, 8), (8, 44), (40, 30)]


def draw(c, f):
    seg = min(len(PATH) - 2, f // 2)
    t = (f % 2) / 2 + .5
    pts = PATH[:seg + 1]
    a, b = PATH[seg], PATH[seg + 1]
    head = (lerp(a[0], b[0], t), lerp(a[1], b[1], t))
    trail = pts[-2:] + [head] if len(pts) > 1 else [pts[-1], head]
    c.line(trail, 'y1')
    c.line([pts[-1], head], 'y3')
    c.disc(*head, 1.4, 'w')
    for p in PATH[1:seg + 1]:
        c.spark(p[0], p[1], 3, 'w', 'm3')
        burst(c, p[0], p[1], .4 + (f % 2) * .2, 5, p[0], ['y3', 'm3'], spd=(3, 8))
    if f >= 6:
        pow_burst(c, 40, 30, 6 + (f - 6) * 3, ['m2', 'y2', 'w'][f - 6:], n=7)


if __name__ == '__main__':
    run(globals())

