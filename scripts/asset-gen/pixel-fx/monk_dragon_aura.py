"""monk_dragon_aura: 용권 멸살 (필살기 무대). Gold chi gathers at the stage centre, a golden dragon bursts up,
coils once around the whole stage, roars in a ray flash and dives at the enemy side (lower left),
leaving a burning wake and falling embers.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monk import *

KEY, SIZE, FRAMES, ANCHOR = 'monk_dragon_aura', 128, 12, 'screen'
PAL = pal(MONK, WHITE, q0='#1a0c0a', q1='#48180c')
CX, CY = 64, 70
# Catmull-Rom control points of the dragon's flight (screen coordinates, may leave the cell)
CTRL = [(100, 150), (98, 124), (104, 92), (86, 58), (56, 42), (28, 56), (26, 88), (56, 100), (90, 82), (94, 46),
        (70, 20), (40, 24), (22, 56), (10, 96), (-8, 136), (-30, 170)]
KEYS = ('k', 'o2', 'y2', 'w')
BODY = 0.26
HEAD = [None, None, 0.10, 0.19, 0.28, 0.37, 0.46, 0.55, 0.66, 0.80, 0.94, None]


def path(t):
    n = len(CTRL) - 3
    u = max(0.0, min(0.9999, t)) * n
    i = int(u)
    s = u - i
    p0, p1, p2, p3 = CTRL[i:i + 4]

    def cr(a, b, c_, d):
        return 0.5 * (2 * b + (-a + c_) * s + (2 * a - 5 * b + 4 * c_ - d) * s * s + (-a + 3 * b - 3 * c_ + d) * s ** 3)

    return cr(p0[0], p1[0], p2[0], p3[0]), cr(p0[1], p1[1], p2[1], p3[1])


def rad(u):
    return 1.2 + 6.2 * u ** 0.7


def vignette(c, strength):
    """Dithered dusk over the stage; strength 0..1 widens it (never reaches the cell corners)."""
    if strength > 0.05:
        shade(c, CX, CY, lerp(20, 50, strength), 'q0', squash=0.9)


def wake(c, head_t, n, keys, seed):
    """Burning scale flakes left along the path behind the body."""
    r = rng(seed)
    for i in range(n):
        t = head_t - BODY - r.uniform(0.0, 0.18)
        if t <= 0.02:
            continue
        x, y = path(t)
        x += r.uniform(-6, 6)
        y += r.uniform(-6, 6) + (head_t - t) * 30
        k = keys[i % len(keys)]
        if i % 4 == 0:
            c.spark(x, y, 2, 'y3', k)
        else:
            c.px(x, y, k)


def draw(c, f):
    if f < 11:
        vignette(c, min(1.0, f / 3) if f < 9 else 1 - (f - 8) / 3)
    if f == 0:
        converge(c, CX, CY, 0.45, 26, 1, ['o1', 'y2'], r0=56, r1=10, trail=8)
        c.disc(CX, CY, 3, 'y2')
        c.px(CX, CY, 'w')
        return
    if f == 1:
        converge(c, CX, CY, 0.85, 26, 1, ['o2', 'y3'], r0=56, r1=10, trail=8)
        c.disc(CX, CY, 8, 'o1')
        c.disc(CX, CY, 6, 'y2')
        c.disc(CX, CY, 3, 'w')
        c.rays(CX, CY, 12, 11, 20, 'y2', rot=0.2)
        return
    ht = HEAD[f]
    if ht is not None:
        if f == 2:  # launch column from the stage floor
            c.poly([(92, 128), (100, 70), (106, 70), (112, 128)], 'o1')
            c.poly([(98, 128), (102, 80), (104, 80), (106, 128)], 'y2')
        wake(c, ht, 22, ['o2', 'y2', 'o1'], f)
        dragon(c, path, ht, max(0.0, ht - BODY), rad, KEYS, 'y3', head_s=1.35, eye='k', whisker='y3')
        if f == 6:  # roar at the top of the loop
            hx, hy = path(ht)
            c.rays(hx, hy, 18, 16, 70, 'y2', rot=0.05, jitter=[1, 0.7, 0.9, 0.6])
            c.ring(hx, hy, 20, 'y3', 2)
            c.spark(hx - 12, hy + 4, 10, 'w', 'y2', diag=True)
        if f == 7:
            hx, hy = path(ht)
            c.dring(hx, hy, 30, 'y2')
            c.ring(hx, hy, 24, 'o2', 1)
        if f >= 9:  # dive: speed lines along the heading
            hx, hy = path(ht)
            bx, by = path(ht - 0.03)
            a = math.atan2(hy - by, hx - bx)
            for j in range(-3, 4):
                ox, oy = -math.sin(a) * j * 5, math.cos(a) * j * 5
                L = 30 - abs(j) * 6
                c.line([(hx + ox - math.cos(a) * (14 + L), hy + oy - math.sin(a) * (14 + L)),
                        (hx + ox - math.cos(a) * 14, hy + oy - math.sin(a) * 14)], 'y2' if j % 2 else 'o2')
        if f == 10:
            pow_burst(c, 12, 110, 22, ['o1', 'y2', 'w'], rot=0.3, n=10)
        return
    # f == 11: embers drifting over the fading stage
    burst(c, 20, 104, 0.8, 30, 11, ['y3', 'y2', 'o2', 'o1'], spd=(20, 70), up=0.6, size=(1, 3))
    for i in range(7):
        x, y = 24 + i * 14, 40 + (i * 23) % 50
        c.spark(x, y, 1 + i % 2, 'y2', 'o1')


if __name__ == '__main__':
    run(globals())

