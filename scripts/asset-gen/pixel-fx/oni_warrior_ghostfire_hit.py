"""oni_warrior_ghostfire_hit: 귀화 명중. 푸른 불구슬이 터져 발밑에서 도깨비불 다섯 줄기가 솟고, 불티가 떠오르며 꺼진다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'oni_warrior_ghostfire_hit', 64, 8, 'target'
PAL = pal(GHOST, pick(ONI, 'o2'))


def draw(c, f):
    cx, cy = 32, 36
    if f == 7:
        c.ddisc(cx, FEET - 4, 12, 'h1', squash=0.4)
    if 1 <= f <= 6:
        a = f - 1
        h = [12, 22, 28, 26, 18, 10][a]
        for i, x in enumerate((18, 25, 32, 39, 46)):
            hh = h * (1.0 if i == 2 else 0.75 if i % 2 else 0.55)
            flame(c, x, FEET, 4, hh, ['h0', 'h1', 'h2', 'h3'] if a < 4 else ['h0', 'h1'], seed=i * 5 + f, sway=math.sin(f + i) * 2, tongues=1)
        c.ring(cx, FEET, 8 + a * 3, 'h1', 1, 0.3)
    if f <= 1:
        orb(c, cx, cy, 4 + f * 4, ['h1', 'h2', 'h3', 'h4'])
        c.spark(cx, cy, 8 + f * 5, 'h4', 'h3', diag=True)
        c.px(cx + 1, cy + 1, 'o2')
    if f >= 3:
        r = rng(4)
        for i in range(6):
            x = cx + r.uniform(-16, 16)
            y = FEET - 12 - (f - 3) * 6 - r.uniform(0, 10)
            c.disc(x, y, 1.5 if i % 2 else 1, 'h3')
            c.px(x, y + 2, 'h1')


if __name__ == '__main__':
    run(globals())

