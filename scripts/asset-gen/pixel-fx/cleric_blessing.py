"""축복 — 64px 10칸, 아군마다. 깃털이 흩날려 내려옴 → 금빛 소용돌이가 몸을 감고 상승 화살표 → 깃털이 흩어지며 반짝임."""
import math, random
from lib_mage import *

KEY = 'cleric_blessing'; FRAME = 64; FRAMES = 10; ANCHOR = 'allAllies'
PAL = Pal(H=HOLY, W=['#e8e4f0', '#b4aac8'])
PEAK = [2, 5, 7]
CX, FY, CY = 32, 55, 38
_r = random.Random(8)
FEATHERS = [(_r.uniform(8, 56), _r.uniform(-20, 20), _r.uniform(0, math.tau), _r.uniform(.8, 1.2)) for _ in range(7)]


def plume(c, x, y, ang, s):
    H, W = PAL.H, PAL.W
    ln = 10 * s
    dx, dy = math.cos(ang), math.sin(ang)
    nx, ny = -dy, dx
    c.poly([(x, y), (x + dx * ln * .35 + nx * 3, y + dy * ln * .35 + ny * 3), (x + dx * ln, y + dy * ln),
            (x + dx * ln * .35 - nx * 2, y + dy * ln * .35 - ny * 2)], W[0])
    c.line([(x + nx * 1.5, y + ny * 1.5), (x + dx * ln * .7 + nx, y + dy * ln * .7 + ny)], W[1])
    c.line([(x, y), (x + dx * ln, y + dy * ln)], H[2])


def arrow(c, x, y, col, edge):
    c.poly([(x, y - 6), (x - 4, y - 1), (x - 1, y - 1), (x - 1, y + 4), (x + 1, y + 4), (x + 1, y - 1), (x + 4, y - 1)], col)
    c.px(x, y - 5, edge)


def draw(c, f):
    H = PAL.H
    # feathers drift down with a sway across the whole sheet
    for k, (x0, y0, ph, s) in enumerate(FEATHERS):
        y = y0 + f * 6
        if y < -4 or y > FY + 2: continue
        x = x0 + math.sin(ph + f * .8) * 5
        ang = math.pi / 2 + math.sin(ph + f * .8) * .9
        if f >= 8 and (k + f) % 2: continue
        plume(c, x, y, ang, s if f < 8 else s * .7)
    if f < 2:
        c.spark(CX, CY - 20 + f * 6, 2 + f, H[5])
        return
    # golden spiral wrapping the body, rising
    t = f - 2
    if t <= 5:
        for k in range(18):
            u = k / 18
            a = u * math.tau * 1.6 + t * .9
            y = FY - u * 42 - t * 2
            x, _ = orbit(CX, 0, 16 - u * 5, a)
            front = math.sin(a) > 0
            col = H[4] if front else H[1]
            if (k + t) % 6 == 0 and front: c.spark(x, y, 1, H[5])
            else: c.rect(x, y, x + 1, y + 1, col)
    if 2 <= t <= 6:  # up-arrows = power up
        for k, dx in enumerate((-12, 0, 12)):
            y = FY - 8 - ((t - 2) * 9 + k * 5) % 36
            arrow(c, CX + dx, y, H[3] if k != 1 else H[4], H[5])
    ring_r = [0, 0, 0, 20, 26, 29, 0, 0][t] if t < 8 else 0
    if ring_r: c.ring(CX, FY, ring_r, H[3], 2 if t == 3 else 1, ring_r * .28)
    if t == 3:
        c.spark(CX, CY - 6, 9, H[5], diag=True); c.spark(CX, CY - 6, 4, H[3])
    if t >= 6:
        c.dither(lambda cc: cc.disc(CX, FY, 18 - (t - 6) * 5, H[2], 4), t)


if __name__ == '__main__':
    make(KEY)

