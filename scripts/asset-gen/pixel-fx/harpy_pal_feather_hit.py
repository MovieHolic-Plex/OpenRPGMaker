"""harpy_pal_feather_hit: 깃털 표창 착탄. 깃이 꽂히며 초록 잎사귀 불꽃이 튀고 흰 솜깃털이 흩날려 내려앉는다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'harpy_pal_feather_hit', 64, 6, 'target'
PAL = pal(LEAFG, pick(DOWN, 'f0', 'f1', 'f2', 'f3'), pick(AIR, 'a3'))


def draw(c, f):
    cx, cy = 30, 36
    t = f / 5
    if f <= 3:
        feather(c, cx + 7, cy - 1 + (1 if f else 0), math.pi * 0.94, 22, 'g2', 'f3', 'g1', 'g3')
    if f <= 2:
        c.spark(cx, cy, 8 - f * 2, 'f3', 'g3', diag=True)
        c.ring(cx, cy, 4 + f * 4, 'g3', 1, 0.8)
    spark_burst(c, cx, cy, t, 16, 11, ['g4', 'g3', 'g2', 'g1'], spd=(9, 26), grav=0.6, size=(1.2, 2.4))
    r = rng(5)
    for k in range(6):
        a0 = r.uniform(0, 2 * math.pi)
        d = r.uniform(8, 20) * ease(min(1, t * 1.3))
        x = cx + math.cos(a0) * d
        y = cy + math.sin(a0) * d * 0.7 + t * t * 12
        if f >= 1:
            feather(c, x, y, a0 + t * 2.5, 7, 'f2', 'f1', 'f0')
    if f >= 4:
        for k in range(3):
            c.px(cx - 12 + k * 12, cy + 12 + (f - 4) * 3, 'g3')


if __name__ == '__main__':
    run(globals())
