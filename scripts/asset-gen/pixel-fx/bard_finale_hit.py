"""bard_finale_hit: 그랜드 피날레 착탄. A rainbow note bomb drops on each enemy, bursts into a six-colour
star with a white core, rainbow rings chase outward and confetti notes rain down.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monk import *

KEY, SIZE, FRAMES, ANCHOR = 'bard_finale_hit', 64, 10, 'allTargets'
PAL = pal(RAINBOW, WHITE, q2='#fff2a0')
CX, CY = 32, 34


def confetti(c, t, seed, n=16):
    r = rng(seed)
    for i in range(n):
        a = i * 2 * math.pi / n + r.uniform(-0.25, 0.25)
        v = r.uniform(12, 28)
        x = CX + math.cos(a) * v * ease(t)
        y = CY + math.sin(a) * v * ease(t) * 0.8 + t * t * 18
        k = HUES[i % 6]
        if i % 4 == 0:
            note(c, x, y, k, 8, s=0.8)
        elif i % 4 == 1:
            c.rect(x, y, x + 1, y + (1 if (i + int(t * 10)) % 2 else 0), k)
        else:
            c.px(x, y, k)
            c.px(x + 1, y + 1, 'n0')


def draw(c, f):
    if f == 0:
        note(c, CX + 2, 10, 'ry', 2, s=1.4)
        c.line([(CX + 6, 0), (CX + 6, 4)], 'rp')
        return
    if f == 1:
        note(c, CX + 1, 26, 'rp', 2, s=1.6)
        for i in range(3):
            c.line([(CX - 4 + i * 5, 4), (CX - 4 + i * 5, 16)], HUES[i + 2])
        return
    if f == 2:
        star(c, CX, CY, 6, 22, 9, 'n0', 0.2)
        for i, k in enumerate(HUES):
            a = 0.2 + i * math.pi / 3
            x, y = pol(CX, CY, 12, a)
            c.poly([(CX, CY), pol(CX, CY, 20, a - 0.18), pol(CX, CY, 20, a + 0.18)], k)
        c.disc(CX, CY, 7, 'q2')
        c.disc(CX, CY, 4, 'w')
        c.rays(CX, CY, 12, 22, 30, 'w', rot=0.45)
    elif f == 3:
        for i, k in enumerate(['rv', 'rb', 'rg', 'ry', 'ro', 'rr']):
            c.ring(CX, CY, 8 + i * 3, k, 2)
        c.disc(CX, CY, 6, 'q2')
        c.disc(CX, CY, 3, 'w')
        c.spark(CX, CY, 20, 'w', 'q2', diag=True)
    else:
        t = (f - 3) / 6
        for i, k in enumerate(['rv', 'rb', 'rg', 'ry', 'ro', 'rr']):
            r = 8 + i * 3 + (f - 3) * 4
            if r > 31:
                continue
            if f >= 7:
                c.dring(CX, CY, r, k, parity=i)
            else:
                c.ring(CX, CY, r, k, 1)
        confetti(c, t, 5, n=18)
        if f in (4, 5):
            c.spark(CX + (f - 4.5) * 16, CY - 8, 5, 'w', HUES[f])
        if f == 6:
            c.spark(CX, CY, 3, 'w', 'rp')


if __name__ == '__main__':
    run(globals())

