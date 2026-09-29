"""demon_knight_smash: 낙뢰 내려찍기. 붉은 번개가 위에서 꽂히고 검이 땅을 쪼개며 균열과 붉은 충격 고리가 번진다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'demon_knight_smash', 64, 10, 'target'
PAL = pal(DEMON, BLADE, pick(HELL, 'z1', 'z2', 'z3'), pick(GOLD, 'y3'))


def draw(c, f):
    cx, gy = 32, 52
    if f <= 3:
        pts = lightning(c, (cx + 8 - f * 2, 0), (cx, gy - 4), 4 + f, ['z1', 'z2', 'z3', 'y3'], segs=6, jitter=5)
    if f in (3, 4):
        c.spark(cx, gy - 2, 14 - (f - 3) * 4, 'y3', 'z3', diag=True)
    if f >= 3:
        t = (f - 3) / 6
        c.oval(cx, gy, 8 + t * 24, 2 + t * 6, 'd3', 1)
        c.oval(cx, gy, 5 + t * 16, 1 + t * 4, 'd4', 1)
        for k in range(5):
            crack(c, cx, gy, math.radians(190 + k * 32), 24, 9 + k, 'd1', min(1.0, t * 2.2), branch=1, k2='d2')
        spark_burst(c, cx, gy - 6, t, 14, 4, ['d4', 'd3', 'd2', 'd1'], spd=(8, 26), grav=0.9)
    if 4 <= f <= 7:
        # 땅에 꽂힌 검
        c.poly([(cx - 2, gy - 30 + (f - 4)), (cx + 2, gy - 30 + (f - 4)), (cx + 1, gy + 1), (cx - 1, gy + 1)], 'k2')
        c.line([(cx - 1, gy - 28 + (f - 4)), (cx - 1, gy)], 'k3')
        c.line([(cx - 5, gy - 32 + (f - 4)), (cx + 5, gy - 32 + (f - 4))], 'y3')
    if f >= 6:
        for k in range(3):
            dust(c, cx - 14 + k * 14, gy + 3, 8 + (f - 6) * 2, k + 3, ['d0', 'd1', 'd2'], fade=f >= 8)


if __name__ == '__main__':
    run(globals())
