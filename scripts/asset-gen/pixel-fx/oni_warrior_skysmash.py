"""oni_warrior_skysmash: 도깨비 낙참. 두 칼이 하늘에서 모이며 떨어져 X 충격을 내고, 땅이 갈라지며 흙 불똥이 튄다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'oni_warrior_skysmash', 64, 9, 'target'
PAL = pal(ONI, pick(BLADE, 'k1', 'k2', 'k3'), pick(GOLD, 'y2', 'y3'), pick(CLAY, 'c1', 'c2'))


def draw(c, f):
    cx, g = 32, FEET
    if f <= 3:
        t = ease((f + 1) / 4)
        y = lerp(4, g - 6, t)
        for i in range(4):
            x = cx - 12 + i * 8
            c.line([(x, max(0, y - 40)), (x, max(0, y - 28))], 'o1')
        for sg in (-1, 1):
            x = cx + sg * lerp(14, 3, t)
            tip, base = (x - sg * 6, y), (x + sg * 6, y - 24)
            c.line([base, tip], 'k1', 3)
            c.line([base, tip], 'k3', 1)
            c.line([(base[0] - 3, base[1] + 2), (base[0] + 3, base[1] - 2)], 'o2', 2)
    if f >= 3:
        a = f - 3
        if a <= 4:
            L = [10, 20, 26, 24, 18][a]
            for sg in (-1, 1):
                c.line([(cx - L, g - 10 - L * sg * 0.8), (cx + L, g - 10 + L * sg * 0.8)], 'o3' if a < 2 else 'o2', 3 if a < 2 else 2)
                c.line([(cx - L * 0.7, g - 10 - L * sg * 0.56), (cx + L * 0.7, g - 10 + L * sg * 0.56)], 'y3')
        ring(c, cx, g, 6 + a * 5, ['o1', 'o2'], squash=0.3)
        for i, ang in enumerate((math.pi * 0.97, math.pi * 0.03, math.pi * 0.85, math.pi * 0.15)):
            crack(c, cx, g, ang, 24, i + 3, 'c1', t=min(1.0, (a + 1) / 3), branch=1)
        if a <= 2:
            c.spark(cx, g - 10, 12 - a * 3, 'y3', 'y2', diag=True)
        spark_burst(c, cx, g - 6, (a + 1) / 6.5, 12, 8, ['y3', 'o3', 'o2', 'c2'], spd=(6, 22), grav=0.6)


if __name__ == '__main__':
    run(globals())

