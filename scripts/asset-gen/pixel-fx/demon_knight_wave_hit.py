"""demon_knight_wave_hit: 마력 참격파 착탄. 초승달이 부서지며 붉은 불꽃 십자가 터지고 조각이 흩날린다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'demon_knight_wave_hit', 64, 8, 'target'
PAL = pal(DEMON, pick(GOLD, 'y3'), pick(BLADE, 'k3'))


def draw(c, f):
    cx, cy = 30, 36
    if f <= 2:
        c.blade((cx + 6, cy - 22 + f * 2), (cx + 6, cy + 22 - f * 2), 12 - f * 3, 9, ['d1', 'd2', 'd3', 'd4'], 1.0)
    if f >= 1:
        n = [0, 12, 22, 26, 22, 16, 10, 4][f]
        c.line([(cx - n, cy), (cx + n, cy)], 'd3', 2)
        c.line([(cx, cy - n), (cx, cy + n)], 'd3', 2)
        c.line([(cx - n + 3, cy), (cx + n - 3, cy)], 'd4')
        c.line([(cx, cy - n + 3), (cx, cy + n - 3)], 'd4')
    if f in (1, 2):
        c.spark(cx, cy, 9 - f * 2, 'y3', 'd4', diag=True)
    if f >= 1:
        spark_burst(c, cx, cy, (f - 1) / 6, 16, 7, ['d4', 'd3', 'd2', 'd1'], spd=(8, 28), grav=0.7, size=(1, 2.2))
    if f >= 3:
        r = rng(3)
        for k in range(5):
            x = cx + r.uniform(-16, 16)
            y = cy + r.uniform(-14, 10) + (f - 3) * 3
            c.poly([(x, y - 2), (x + 2, y), (x, y + 2)], 'k3')


if __name__ == '__main__':
    run(globals())
