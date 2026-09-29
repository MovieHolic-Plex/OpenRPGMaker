"""harpy_pal_talon: 급강하 발톱. 위에서 내리꽂힌 발톱이 흰 세 줄을 순서대로 긋고 초록 바람결과 깃털 부스러기를 남긴다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'harpy_pal_talon', 64, 8, 'target'
PAL = pal(pick(LEAFG, 'g1', 'g2', 'g3', 'g4'), DOWN, pick(AIR, 'a1', 'a2'))


def draw(c, f):
    cx, cy = 34, 34
    ang = math.radians(118)                     # 위 오른쪽에서 아래 왼쪽으로
    for i in range(3):
        st = 1 + i
        if f < st:
            continue
        fr = min(1.0, (f - st + 1) / 2.0)
        ux, uy = math.cos(ang), math.sin(ang)
        nx, ny = -uy, ux
        o = (i - 1) * 9
        p0 = (cx + nx * o + ux * 22, cy + ny * o + uy * 22)
        p1 = (cx + nx * o - ux * 22, cy + ny * o - uy * 22)
        if f - st >= 3:
            continue
        c.blade(p0, p1, 4, 4, ['g1', 'f1', 'f2', 'f3'], fr)
        if f - st == 0:
            c.spark(p1[0] * fr + p0[0] * (1 - fr), p1[1] * fr + p0[1] * (1 - fr), 4, 'f3', 'g3')
    if f == 0:                                                 # 내리꽂히기 직전 바람
        for k in range(4):
            c.line([(46 + k * 3, 4 + k * 5), (52 + k * 3, 16 + k * 5)], 'a1' if k % 2 else 'a2')
    if f >= 2:
        spark_burst(c, cx, cy, (f - 2) / 5, 8, 21, ['f3', 'g3', 'g2'], spd=(6, 20), grav=0.5)
        for k in range(3):
            feather(c, 14 + k * 17 - (f % 2) * 2, 12 + ((f * 5 + k * 9) % 34), 1.9 + k * 0.3, 7, 'f2', 'f1', 'f0')


if __name__ == '__main__':
    run(globals())
