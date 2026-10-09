"""dark_lord_hellbolt: 지옥 번개. 머리 위 보라 먹구름에 예고선이 번쩍인 뒤 붉은 번개 기둥이 내리꽂혀 땅에서 불똥이 튄다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'dark_lord_hellbolt', 64, 8, 'target'
PAL = pal(pick(DARKV, 'u1', 'u2', 'u3', 'u4'), HELL, WHITE)


def draw(c, f):
    cx = 32
    c.cloud(cx, 7, 12 if f < 6 else 10, ['u1', 'u2', 'u3'], seed=4, parity=f % 2)
    if f == 1:
        c.line([(cx, 14), (cx, FEET)], 'u3')
    if 2 <= f <= 5:
        keys = ['z1', 'z2', 'z3', 'w'] if f < 4 else ['z1', 'z2']
        lightning(c, (cx, 12), (cx + (f % 2) * 2 - 1, FEET), 7 + f, keys, segs=7, jitter=5)
        if f == 2:
            c.spark(cx, FEET - 4, 12, 'w', 'z3', diag=True)
        c.oval(cx, FEET, 10 + f, 3, 'z1')
        c.oval(cx, FEET, 6 + f, 2, 'z2')
    if f >= 3:
        spark_burst(c, cx, FEET - 3, (f - 2) / 5.5, 14, 8, ['w', 'z3', 'z2', 'u3'], spd=(6, 24), grav=0.7, squash=0.6)
    if f >= 6:
        for k in range(3):
            c.line([(cx - 10 + k * 10, FEET - 6), (cx - 8 + k * 10 + f % 2 * 2, FEET - 14 - (f - 6) * 4)], 'u2')


if __name__ == '__main__':
    run(globals())

