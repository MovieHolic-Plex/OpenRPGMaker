"""harpy_pal_storm_hit: 깃털 폭풍 명중. 칼날 같은 깃털이 적을 어지러운 방향으로 갈라 흰 자국과 초록 잎 불꽃을 남긴다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'harpy_pal_storm_hit', 64, 8, 'allTargets'
PAL = pal(pick(LEAFG, 'g1', 'g2', 'g3', 'g4'), DOWN, pick(AIR, 'a1', 'a2'))


def draw(c, f):
    cx, cy = 32, 34
    dirs = [(-40, 0), (35, 1), (-15, 2), (62, 3), (-72, 4)]
    for ang, st in dirs:
        if f < st or f > st + 3:
            continue
        a = math.radians(ang)
        ux, uy = math.cos(a), math.sin(a)
        fr = min(1.0, (f - st + 1) / 2)
        p0 = (cx - ux * 24, cy - uy * 24)
        p1 = (cx + ux * 24, cy + uy * 24)
        c.blade(p0, p1, 3 if st % 2 else -3, 3, ['g1', 'f1', 'f2', 'f3'], fr)
        if f == st:
            hx, hy = lerp(p0[0], p1[0], fr), lerp(p0[1], p1[1], fr)
            feather(c, hx, hy, a + 3.14, 10, 'f2', 'g3', 'g1')
    if f >= 1:
        spark_burst(c, cx, cy, (f - 1) / 6, 16, 33, ['g4', 'g3', 'g2', 'g1'], spd=(8, 26), grav=0.5, size=(1.2, 2.4))
    if f in (1, 2):
        c.spark(cx, cy, 8 - f * 2, 'f3', 'a2', diag=True)
    for k in range(4):
        r = rng(70 + k)
        x = 12 + r.uniform(0, 40)
        y = 14 + r.uniform(0, 30) + f * 2.5
        if f >= 3:
            feather(c, x, y, r.uniform(0, 6), 8, 'f2', 'f1', 'f1')


if __name__ == '__main__':
    run(globals())
