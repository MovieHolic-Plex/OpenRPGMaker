"""dark_lord_orb_hit: 암흑 구체 명중. 구체가 안으로 오그라들었다 검은 고리와 보랏빛 파편으로 폭발하고, 연기가 남는다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'dark_lord_orb_hit', 64, 8, 'target'
PAL = pal(DARKV, pick(HELL, 'z2', 'z3'))


def draw(c, f):
    cx, cy = CX, CY
    if f <= 1:
        orb(c, cx, cy, 9 - f * 4, ['u1', 'u2', 'u3', 'u4'])
        converge(c, cx, cy, (f + 1) / 2, 10, 2, ['u2', 'u4'], r0=22, r1=6)
    elif f <= 4:
        a = f - 2
        c.disc(cx, cy, 10 + a * 6, 'u1')
        c.disc(cx, cy, 6 + a * 6, 'u0')
        ring(c, cx, cy, 12 + a * 7, ['u3', 'u2'])
        c.spark(cx, cy, 16 - a * 4, 'u4', 'z3', diag=True)
    else:
        a = f - 5
        c.dring(cx, cy, 26 + a * 2, 'u2', parity=f % 2)
        for i in range(4):
            c.ddisc(cx - 10 + i * 7, cy + 4 - a * 4 - i % 2 * 3, 6 - a, 'u1', parity=(i + f) % 2)
    if f >= 2:
        spark_burst(c, cx, cy, (f - 1) / 6.5, 16, 12, ['u4', 'z3', 'u3', 'z2'], spd=(10, 28))


if __name__ == '__main__':
    run(globals())

