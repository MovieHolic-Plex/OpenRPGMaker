"""dark_lord_eclipse_hit: 종말의 어둠 명중. 적 위로 검은 원반이 내려앉아 금빛 테만 남기고 짓누른 뒤, 보라 불꽃과 금 파편으로 부서진다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'dark_lord_eclipse_hit', 64, 8, 'allTargets'
PAL = pal(DARKV, pick(GOLD, 'y1', 'y2', 'y3'), INK)


def draw(c, f):
    cx, cy = CX, CY
    if f <= 3:
        y = lerp(4, cy, ease((f + 1) / 4))
        r = 8 + f * 3
        c.disc(cx, y, r + 1, 'y2')
        c.disc(cx, y, r, 'k0')
        c.arc(cx, y, r + 1, 190, 260, 'y3', 1)
        for k in range(3):
            c.line([(cx - r + k * r, y - r - 2), (cx - r + k * r, y - r - 8)], 'u3')
    else:
        a = f - 4
        if a <= 1:
            c.disc(cx, cy, 18 - a * 4, 'u2')
            c.disc(cx, cy, 14 - a * 5, 'k0')
            c.ring(cx, cy, 18 - a * 4, 'y2', 1)
            c.spark(cx, cy, 14, 'y3', 'y2', diag=True)
        for i in range(5):
            x = cx - 16 + i * 8
            flame(c, x, FEET, 4, [16, 20, 14, 8][a] * (1 if i == 2 else 0.7), ['u1', 'u2', 'u3', 'u4'], seed=i + f, tongues=1)
        spark_burst(c, cx, cy, (a + 1) / 4.5, 14, 9, ['y3', 'y2', 'u4', 'y1'], spd=(10, 28))


if __name__ == '__main__':
    run(globals())

