"""재생 — 64px 10칸(아군 대상). 하늘에서 빛 씨앗이 떨어져 → 발밑에서 새싹이 돋고 잎이 펼쳐져 꽃이 피며 초록 섬광·십자 → 꽃잎과 빛 씨앗이 떠오르며 흩어짐."""
import math
from lib_druid import *

KEY = 'druid_regrowth'; FRAME = 64; FRAMES = 10; ANCHOR = 'target'; SIDE = 'ally'
PAL = Pal(L=LEAF, P=BLOOM, A=AMBER)
PEAK = [2, 5, 8]
_r = rng(KEY)
SPROUTS = [(-16, .55, -1), (-8, .8, 1), (0, 1.0, -1), (9, .75, 1), (17, .5, -1)]
MOTES = [(_r.uniform(-24, 24), _r.uniform(0, 30), _r.randint(0, 2)) for _ in range(16)]
PETALS = [(_r.uniform(0, math.tau), _r.uniform(1.8, 3.6)) for _ in range(12)]


def sprout(c, x, h, lean, g, bloom):
    L, P, A = PAL.L, PAL.P, PAL.A
    top = (x + lean * 3 * g, GY - h * g)
    mid = (x + lean * 1.5 * g, GY - h * g * .5)
    vine(c, [(x, GY), mid, top], 2, 1, L[0], L[2], L[3])
    if g > .3:
        s = 2 + g * 4
        leaf(c, *mid, -math.pi / 2 - .9, s, L[3], L[1])
        leaf(c, *mid, -math.pi / 2 + .9, s, L[3], L[1])
    if g > .6:
        leaf(c, *top, -math.pi / 2 - .5 * lean, 3 + g * 3, L[4], L[2])
    if bloom:
        petal5(c, top[0], top[1] - 2, 3 + bloom, P[1], A[1], rot=x * .3)
        c.px(top[0], top[1] - 2, P[2])


def draw(c, f):
    L, P, A = PAL.L, PAL.P, PAL.A
    if f <= 2:   # a seed of light falls onto the ally's feet
        y = [10, 30, GY - 3][f]
        c.line([(CX, y - 14 + f * 2), (CX, y)], L[2], 1)
        c.line([(CX, y - 7), (CX, y)], L[4], 1)
        c.glow(CX, y, 4 + f, [L[3], L[4], L[5], L[6]])
        c.spark(CX, y, 3 + f * 2, L[5], L[6])
        for x, yy, k in MOTES[:6 + f * 3]:
            c.px(CX + x * (1 - f * .3), y - 10 + yy * .5 * (1 - f * .3), L[4] if k else A[1])
        if f == 2: c.disc(CX, GY, 14, L[2], 3); c.ring(CX, GY, 18, L[4], 1, 4)
        return
    t = f - 3   # 0..6
    # ground bed + growing ring
    rr = [16, 22, 26, 28, 28, 26, 22][t]
    fade(c, t >= 5, lambda cc: (cc.disc(CX, GY, rr, L[1], rr * .2), cc.disc(CX, GY, rr - 6, L[2], (rr - 6) * .2)), f)
    if t <= 3: c.ring(CX, GY, rr + 4, L[4], 1, (rr + 4) * .22)
    if t == 0:   # sprouting pulse
        c.ring(CX, GY - 2, 12, L[5], 1, 4); rays(c, CX, GY - 4, 7, 6, 16, L[3], rot=math.pi, ry=.8)
    if t == 2:   # full bloom flash
        rays(c, CX, CY - 4, 12, 8, 30, L[4], alt=22)
        c.disc(CX, CY - 4, 14, L[3]); c.disc(CX, CY - 4, 10, L[4]); c.disc(CX, CY - 4, 6, L[5]); c.disc(CX, CY - 4, 3, L[6])
    g = [.35, .7, 1, 1, 1, .9, .75][t]
    bloom = [0, 0, 1, 2, 2, 1, 0][t]
    fade(c, t == 6, lambda cc: [sprout(cc, CX + x, 24 * h, ln, g, bloom if abs(x) < 12 else max(0, bloom - 1)) for x, h, ln in SPROUTS], f)
    if 2 <= t <= 5:   # healing crosses rising
        for k, (x, y, _) in enumerate(MOTES[:5]):
            yy = CY - 2 - (t - 2) * 7 - y * .3 + k * 3
            if yy < 2: continue
            plus(c, CX + x * .8, yy, 3 if k % 2 else 2, L[4] if k % 2 else L[3], L[6])
    if t >= 3:   # petals and motes drift up and away
        u = t - 3
        for k, (a, v) in enumerate(PETALS):
            x = CX + math.cos(a) * v * (6 + u * 5); y = CY - 6 + math.sin(a) * v * 3 - u * 6 - k % 3 * 2
            if u >= 2 and (k + f) % 2: continue
            if k % 3 == 0: c.px(x, y, A[1])
            else: c.rect(x, y, x + 1, y, P[1 + k % 2]); c.px(x, y + 1, P[0])
    for x, y, k in MOTES:
        if t < 1: break
        yy = GY - 4 - y - t * 4
        if yy < 0: continue
        c.px(CX + x, yy, L[5] if (k + f) % 3 else L[6])


if __name__ == '__main__':
    make(KEY)

