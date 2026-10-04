"""dragonewt_claw: 용의 발톱. 굵은 비늘빛 발톱 자국 세 줄이 위에서 아래로 깊게 파이고 초록 비늘 조각이 튄다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'dragonewt_claw', 64, 8, 'target'
PAL = pal(DRAKE, pick(FIRE, 'e2', 'e3', 'e4'), pick(LEAFG, 'g3', 'g4'), pick(DOWN, 'f2', 'f3'))


def draw(c, f):
    cx, cy = 32, 34
    if f == 0:
        c.line([(46, 6), (40, 14)], 'r2'); c.spark(46, 6, 4, 'f3', 'g3')
    for i in range(3):
        st = 1 + i
        if not (st <= f <= st + 3):
            continue
        fr = min(1.0, (f - st + 1) / 2)
        o = (i - 1) * 11
        p0 = (cx + o + 10, cy - 26)
        p1 = (cx + o - 6, cy + 26)
        c.blade(p0, p1, 5, 9, ['r0', 'r1', 'e2', 'e4'], fr)
        if f == st:
            c.spark(lerp(p0[0], p1[0], fr), lerp(p0[1], p1[1], fr), 4, 'f3', 'e3')
    if f >= 2:
        r = rng(3)
        for k in range(8):
            a = r.uniform(0, 6.28)
            d = r.uniform(8, 24) * ease((f - 1) / 5)
            x, y = cx + math.cos(a) * d, cy + math.sin(a) * d * 0.9 + (f - 2) ** 2 * 0.6
            c.poly([(x, y - 2), (x + 2, y), (x, y + 2), (x - 1.5, y)], 'r2' if k % 2 else 'r1')
    if f >= 3:
        spark_burst(c, cx, cy, (f - 3) / 4, 8, 9, ['e4', 'e3', 'e2'], spd=(6, 20), grav=0.5)


if __name__ == '__main__':
    run(globals())
