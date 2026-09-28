"""bard_finale_stage: 그랜드 피날레 (필살기 무대). Stage lights: the screen dims, rainbow spotlights sweep in,
a huge treble clef forms from light, rainbow staff ribbons spiral out, then a white flash and fireworks of notes.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monk import *

KEY, SIZE, FRAMES, ANCHOR = 'bard_finale_stage', 128, 12, 'screen'
PAL = pal(RAINBOW, WHITE, q0='#100a1c', q1='#2c1c44', q2='#fff2a0')
CX, CY = 64, 62


def dim(c, depth):
    """Dithered stage darkening; depth 0..1 widens it."""
    if depth > 0.05:
        shade(c, CX, CY, lerp(20, 50, depth), 'q0', squash=0.9)


def spot(c, x_top, x_bot, w, k, dither=True):
    for y in range(0, 128, 1):
        t = y / 127
        cx = lerp(x_top, x_bot, t)
        half = lerp(2, w, t)
        for x in range(int(cx - half), int(cx + half) + 1):
            if not dither or (x + y) % 2 == 0:
                c.px(x, y, k)


def ribbons(c, t, rot):
    for j, k in enumerate(HUES):
        a0 = rot + j * math.pi / 3
        pts = []
        for i in range(24):
            u = i / 23
            a = a0 + u * 2.4
            d = 6 + u * lerp(10, 58, t)
            pts.append(pol(CX, CY, d, a, 0.85))
        c.line(pts, 'n0', 4)
        c.line(pts, k, 2)


def firework(c, x, y, t, k, seed, n=10, r=18):
    for i in range(n):
        a = i * 2 * math.pi / n + seed
        d = r * ease(t)
        px_, py_ = pol(x, y, d, a)
        qx, qy = pol(x, y, d * 0.6, a)
        c.line([(qx, qy + t * 4), (px_, py_ + t * 6)], k)
        c.px(px_, py_ + t * 6, 'w')
    if t < 0.4:
        c.spark(x, y, 4, 'w', k)


def draw(c, f):
    if f <= 10:
        dim(c, min(1.0, (f + 1) / 3) if f < 9 else (11 - f) / 3)
    if f == 0:
        converge(c, CX, CY, 0.5, 24, 3, ['q1', 'q2'], r0=60, r1=12, trail=6)
        for i, k in enumerate(HUES):
            x, y = pol(CX, CY, 30, i * math.pi / 3 + 0.3)
            note(c, x, y, k, 4, s=0.8)
        c.spark(CX, CY, 4, 'w', 'ry')
        return
    if 1 <= f <= 4:
        sw = (f - 1) * 10
        spot(c, 10 + sw, 40 + sw, 12, 'rr')
        spot(c, 118 - sw, 88 - sw, 12, 'rb')
        spot(c, CX + math.sin(f) * 10, CX, 14, 'ry')
    if 2 <= f <= 7:
        s = min(4.6, 1.4 + (f - 2) * 1.1)
        clef(c, CX, CY - 4, 'q2' if f < 5 else 'w', s=s, ol='ry' if f < 5 else 'ro')
    if 4 <= f <= 8:
        ribbons(c, (f - 4) / 4, f * 0.35)
    if f == 5:
        c.rays(CX, CY, 24, 30, 80, 'ry', rot=0.05, jitter=[1, 0.7, 0.9, 0.6])
    if f == 6:
        for i, k in enumerate(['rv', 'rb', 'rg', 'ry', 'ro', 'rr']):
            c.ring(CX, CY, 20 + i * 4, k, 2)
        c.disc(CX, CY, 14, 'q2')
        c.disc(CX, CY, 9, 'w')
    if f == 7:
        c.disc(CX, CY, 40, 'q2')
        c.disc(CX, CY, 32, 'w')
        c.rays(CX, CY, 32, 40, 90, 'w', rot=0.1)
    if f >= 7:
        spots = [(28, 36, 'rr', 0), (98, 30, 'rb', 1), (40, 94, 'rg', 2), (92, 92, 'rv', 3), (64, 20, 'ry', 4), (16, 70, 'ro', 5), (112, 66, 'rp', 6)]
        for i, (x, y, k, sd) in enumerate(spots):
            t = (f - 7 - (i % 3) * 0.5) / 3
            if 0 <= t <= 1.2:
                firework(c, x, y, min(1, t), k, sd * 0.4)
    if f >= 8:
        r = rng(f)
        for i in range(8):
            x, y = r.uniform(10, 118), r.uniform(10, 118) + (f - 8) * 4
            note(c, x, y, HUES[i % 6], [4, 8, 16, 2][i % 4], s=1.0)
    if f == 11:
        r = rng(77)
        for i in range(20):
            c.px(r.uniform(4, 124), r.uniform(4, 124), HUES[i % 6])


if __name__ == '__main__':
    run(globals())

