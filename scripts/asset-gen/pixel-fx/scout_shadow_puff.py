"""scout_shadow_puff: 그림자 습격 (시전자). The scout sinks into a violet shadow cloud that bursts into lobes.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_scout import *

KEY, SIZE, FRAMES, ANCHOR = 'scout_shadow_puff', 64, 6, 'user'
PAL = pal(SHADOW, WHITE)
CX, CY, FEET = 32, 38, 56
CLOUD = ['k', 'd', 'm', 'v']


def wisp(c, x, y0, y1, bend, k):
    pts = [(x + math.sin(t / 3) * bend, lerp(y0, y1, t / 6)) for t in range(7)]
    c.line(pts, k)


def draw(c, f):
    if f == 0:
        c.oval(CX, FEET, 17, 4, 'v', 1)
        c.oval(CX, FEET, 13, 3, 'm', 1)
        c.oval(CX, FEET, 9, 2, 'k')
        for i, x in enumerate((19, 25, 32, 39, 45)):
            wisp(c, x, FEET - 1, FEET - 8 - (i % 2) * 6, 2 if i % 2 else -2, 'm')
        for x, y in [(16, 46), (48, 44), (32, 40)]:
            c.spark(x, y, 2, 'w', 'l')
    elif f == 1:
        for y, r, s in [(52, 10, 1), (44, 9, 2), (35, 8, 3)]:
            c.puff(CX, y, r, CLOUD[:3], seed=s, lobes=4)
        c.oval(CX, FEET, 17, 4, 'm', 1)
        for x, y in [(14, 40), (50, 34), (40, 24)]:
            c.spark(x, y, 3, 'w', 'l')
    elif f == 2:
        c.rays(CX, CY, 12, 18, 29, 'l', rot=0.1, jitter=[1, 0.8, 0.9, 0.75])
        c.cloud(CX, CY, 18, CLOUD, seed=3, lobes=10)
        c.px(CX - 4, CY + 2, 'l')
        c.px(CX + 3, CY + 2, 'l')
        for i in range(6):
            x, y = pol(CX, CY, 24, i * math.pi / 3 + 0.5)
            c.spark(x, y, 3, 'w', 'l')
    elif f == 3:
        for i in range(5):
            a = i * 2 * math.pi / 5 - math.pi / 2
            x, y = pol(CX, CY, 13, a)
            c.cloud(x, y, 11, ['d', 'm', 'v'], seed=10 + i, lobes=6, parity=i)
        c.disc(CX, CY, 6, 'k')
        c.dring(CX, CY, 25, 'l')
    elif f == 4:
        for i in range(5):
            a = i * 2 * math.pi / 5 - math.pi / 2 + 0.25
            x, y = pol(CX, CY - 3, 20, a)
            c.dring(x, y, 8, 'v', parity=i)
            c.cloud(x, y, 6, ['d', 'm', 'v'], seed=30 + i, lobes=5)
        for i in range(4):
            x, y = pol(CX, CY, 10, i * math.pi / 2)
            c.spark(x, y, 1, 'l')
    elif f == 5:
        for i in range(5):
            a = i * 2 * math.pi / 5 - math.pi / 2 + 0.45
            x, y = pol(CX, CY - 6, 25, a)
            c.disc(x, y, 2, 'd')
            c.dring(x, y, 4, 'm', parity=i)
            c.px(x - 1, y - 1, 'v')
        for x, y in [(20, 20), (46, 26), (30, 12)]:
            c.spark(x, y, 2, 'w', 'l')


if __name__ == '__main__':
    run(globals())

