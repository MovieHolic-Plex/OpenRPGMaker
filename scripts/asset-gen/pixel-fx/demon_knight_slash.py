"""demon_knight_slash: 마검 일섬. 검은 마검이 붉은 반월을 그리며 대각선으로 베고 붉은 불씨가 튄다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'demon_knight_slash', 64, 8, 'target'
PAL = pal(DEMON, BLADE, pick(GOLD, 'y2', 'y3'))


def draw(c, f):
    cx, cy = 32, 34
    if f == 0:
        c.spark(54, 10, 4, 'd4', 'd3')
        c.line([(58, 4), (52, 14)], 'd2')
    if 1 <= f <= 4:
        fr = min(1.0, f / 2.5)
        c.blade((56, 8), (8, 56), 11, 12, ['d1', 'd2', 'd3', 'd4'], fr)
    if 2 <= f <= 5:
        fr = min(1.0, (f - 1) / 2.5)
        c.blade((14, 12), (54, 54), -5, 5, ['d1', 'd2', 'k3'], fr * 0.85)
    if f == 2:
        c.spark(cx, cy, 8, 'y3', 'd4', diag=True)
    if f >= 2:
        spark_burst(c, cx, cy, (f - 2) / 5, 16, 9, ['d4', 'd3', 'd2', 'd1'], spd=(8, 28), grav=0.6, size=(1, 2.2))
    if f >= 5:
        c.line([(cx - 16, cy + 16), (cx + 18, cy - 18)], 'd2')


if __name__ == '__main__':
    run(globals())
