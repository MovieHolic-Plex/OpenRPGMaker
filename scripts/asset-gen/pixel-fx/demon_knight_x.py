"""demon_knight_x: 십자 난도질. 열 겹으로 엇갈린 붉은 X 자국이 연달아 새겨지고 마지막에 굵은 X가 번쩍한다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'demon_knight_x', 64, 10, 'target'
PAL = pal(DEMON, pick(BLADE, 'k3'), pick(GOLD, 'y3'))


def draw(c, f):
    cx, cy = 32, 34
    if f == 0:
        c.spark(cx, cy, 3, 'd4', 'd3')
        c.line([(cx - 8, cy - 8), (cx + 8, cy + 8)], 'd2')
    r = rng(2)
    for i in range(min(f, 6)):
        o = r.uniform(-6, 6)
        ang = r.uniform(-0.5, 0.5)
        s = (r.uniform(0.6, 1.0)) * 22
        for sg in (1, -1):
            a = math.radians(45 * sg) + ang
            ux, uy = math.cos(a), math.sin(a)
            p0 = (cx + o - ux * s, cy + o * 0.5 - uy * s)
            p1 = (cx + o + ux * s, cy + o * 0.5 + uy * s)
            c.line([p0, p1], 'd2' if i < f - 1 else 'd3', 1 if i < f - 1 else 2)
    if f >= 6:
        w = [8, 9, 6, 4][f - 6]
        for sg in (1, -1):
            a = math.radians(45 * sg)
            ux, uy = math.cos(a), math.sin(a)
            p0 = (cx - ux * 28, cy - uy * 28)
            p1 = (cx + ux * 28, cy + uy * 28)
            c.blade(p0, p1, 2 * sg, w, ['d1', 'd3', 'd4', 'k3'], 1.0)
        c.spark(cx, cy, [12, 14, 8, 4][f - 6], 'y3', 'd4', diag=True)
    if f >= 2:
        spark_burst(c, cx, cy, (f - 2) / 8, 12, 8, ['d4', 'd3', 'd2', 'd1'], spd=(8, 26), size=(1, 2))


if __name__ == '__main__':
    run(globals())
