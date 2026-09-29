"""dark_lord_meteor: 암흑 유성우. 보라 불꼬리를 끈 검은 운석 셋이 오른쪽 위에서 비스듬히 떨어져 차례로 암흑 폭발을 낸다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'dark_lord_meteor', 64, 10, 'allTargets'
PAL = pal(DARKV, pick(HELL, 'z1', 'z2', 'z3'), pick(STONE, 's0', 's1'))
DROPS = [(0, 20, 50, 5), (2, 42, 52, 4), (4, 30, 54, 6)]   # (시작 칸, 착지 x, 착지 y, 크기)


def draw(c, f):
    for i, (s, x1, y1, r) in enumerate(DROPS):
        t = f - s
        if 0 <= t < 3:
            u = (t + 1) / 3
            x = lerp(x1 + 30, x1, u)
            y = lerp(y1 - 56, y1 - r, u)
            for k in range(3):
                c.line([(x + 2 + k, y - 2 - k), (x + 14 + k * 3, y - 14 - k * 3)], ['u2', 'u3', 'z1'][k], 3 - k)
            rock(c, x, y, r, ['s0', 's1', 'u3', 'u4'], seed=i)
            c.px(x + 1, y + 1, 'z2')
        elif 3 <= t <= 6:
            a = t - 3
            c.oval(x1, y1, 6 + a * 4, 2 + a, 'u1')
            if a <= 2:
                c.disc(x1, y1 - 5, 7 + a * 2 - a * a, 'u2')
                c.disc(x1, y1 - 5, 4 + a, 'u0' if a else 'u4')
                c.spark(x1, y1 - 5, 8 - a * 2, 'z3', 'z2')
            spark_burst(c, x1, y1 - 4, (a + 1) / 4.5, 8, i + 20, ['z3', 'u4', 'u3', 'z1'], spd=(4, 16), grav=0.5)


if __name__ == '__main__':
    run(globals())

