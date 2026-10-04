"""oni_warrior_parade_hit: 백귀야행 명중. 등불이 스쳐 와 적 앞에서 터지고, 푸른 잔불이 타오르며 혼 둘이 위로 빠져나간다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'oni_warrior_parade_hit', 64, 8, 'allTargets'
PAL = pal(ONI, pick(GHOST, 'h1', 'h2', 'h3', 'h4'), pick(GOLD, 'y2', 'y3'))


def draw(c, f):
    cx, cy = 32, 34
    if f <= 2:
        x = lerp(58, cx, ease((f + 1) / 3))
        y = cy - 6 + f
        for k in range(3):
            c.line([(x + 7 + k * 4, y - 4 + k * 4), (x + 12 + k * 4, y - 4 + k * 4)], 'h2')
        c.oval(x, y, 5, 7, 'o2')
        c.oval(x - 1, y - 1, 3, 5, 'y2')
        c.line([(x - 5, y - 3), (x + 5, y - 3)], 'o1')
        c.line([(x - 5, y + 3), (x + 5, y + 3)], 'o1')
    if f >= 2:
        a = f - 2
        h = [0, 10, 16, 18, 12, 6][a]
        if h:
            for i, x in enumerate((20, 32, 44)):
                flame(c, x, FEET, 4, h * (1 if i == 1 else 0.7), ['h1', 'h2', 'h3'], seed=i + f, tongues=1)
        if a <= 2:
            orb(c, cx, cy, 8 - a * 2, ['o2', 'o3', 'y2', 'y3'])
        spark_burst(c, cx, cy, (a + 1) / 6, 16, 6, ['y3', 'y2', 'o3', 'o2'], spd=(6, 24))
    if f >= 4:
        for j, x in enumerate((24, 40)):
            y = cy - (f - 4) * 6 - j * 3
            c.disc(x, y, 3, 'h4')
            c.poly([(x - 3, y), (x + 3, y), (x + (f % 2) * 2 - 1, y + 8)], 'h3')
            c.px(x - 1, y - 1, 'o1')
            c.px(x + 1, y - 1, 'o1')


if __name__ == '__main__':
    run(globals())

