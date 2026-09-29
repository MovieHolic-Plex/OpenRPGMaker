"""세계수의 분노(화면 층) — 128px 12칸. 땅이 초록으로 빛나며 싹이 트고 → 거대한 세계수 줄기가 솟아 가지를 펼치고 은빛 달 아래 잎 왕관이 피어남, 빛살·꽃잎 폭풍 → 뿌리가 왼쪽 적진으로 뻗어 내려찍고 잎비·치유 빛가루가 쏟아지며 나무가 빛으로 풀림."""
import math
from lib_druid import *

KEY = 'druid_world_tree'; FRAME = 128; FRAMES = 12; ANCHOR = 'screen'
PAL = Pal(L=LEAF, B=BARK, M=MOON[2:5], P=BLOOM[1:3])
PEAK = [3, 6, 9]
_r = rng(KEY)
BRANCH = [(-1, 34, .9, 30), (1, 38, .85, 28), (-1, 50, .7, 22), (1, 54, .75, 22), (-1, 62, .5, 14), (1, 64, .55, 14)]  # side, height on trunk, spread, length
CROWN = [(_r.uniform(-44, 44), _r.uniform(-14, 14), _r.uniform(7, 13)) for _ in range(20)]
RAIN = [(_r.uniform(0, 128), _r.uniform(-60, 60), _r.randint(0, 3)) for _ in range(40)]
ROOTS = [(-4, 70, 104), (-2, 42, 120), (0, 20, 100), (2, 58, 124)]
GROUND = 118


def trunk(c, g, glow=False):
    L, B = PAL.L, PAL.B
    h = 84 * g
    base = 64
    pts = [(base + math.sin(i * .6) * 2, GROUND - h * i / 8) for i in range(9)]
    for col, w0 in ((B[0], 20), (B[1], 16), (B[2], 10), (B[3], 4)):
        for i in range(8):
            ww = round(w0 * (1 - i / 11))
            if ww >= 1: c.line([pts[i], pts[i + 1]], col, ww)
    if glow:
        for i in range(1, 8, 2): c.px(pts[i][0] - 2, pts[i][1], L[4])
    # root flare
    for sg in (-1, 1):
        c.poly([(base + sg * 8, GROUND - 14), (base + sg * 22, GROUND + 2), (base + sg * 4, GROUND + 2)], B[1])
        c.line([(base + sg * 8, GROUND - 10), (base + sg * 18, GROUND + 1)], B[3])
    return pts


def branches(c, g):
    B = PAL.B
    tips = []
    for side, h, sp, ln in BRANCH:
        y0 = GROUND - h
        if 84 * g < h: continue
        u = min(1, (84 * g - h) / 14 + .2)
        x1, y1 = 64 + side * ln * u * 1.25, y0 - ln * sp * u * 1.25
        vine(c, [(64, y0), (64 + side * ln * u * .55, y0 - ln * sp * u * .12), (64 + side * ln * u * 1.0, y0 - ln * sp * u * .55), (x1, y1)],
             6, 2, B[0], B[2], B[3])
        tips.append((x1, y1))
    return tips


def crown(c, s, bright):
    L = PAL.L
    cy = GROUND - 88
    for i, col in enumerate([L[0], L[1], L[2], L[3]] + ([L[4]] if bright else [])):
        for x, y, r in CROWN:
            rr = r * s * (1 - i * .18)
            if rr < 1: continue
            c.disc(64 + x * s - i * 1.5, cy + y * s - i * 1.5, rr, col, rr * .8)


def draw(c, f):
    L, B, M, P = PAL.L, PAL.B, PAL.M, PAL.P
    if f <= 1:   # ground glow + sprout
        c.disc(64, GROUND + 4, 30 + f * 20, L[1], 6 + f * 3); c.disc(64, GROUND + 4, 16 + f * 10, L[2], 3 + f * 2)
        c.ring(64, GROUND + 4, 40 + f * 22, L[4], 1, 8 + f * 3)
        rays(c, 64, GROUND, 9, 8, 30 + f * 20, L[3], rot=math.pi, ry=.8)
        vine(c, [(64, GROUND), (63, GROUND - 6 - f * 8), (65, GROUND - 10 - f * 14)], 3, 1, L[0], L[2], L[4])
        leaf(c, 65, GROUND - 10 - f * 14, -2.2, 6, L[3], L[1]); leaf(c, 65, GROUND - 10 - f * 14, -.9, 6, L[4], L[1])
        return
    g = [0, 0, .35, .7, 1, 1, 1, 1, 1, 1, 1, 1][f]
    if f in (2, 3):   # the ground ruptures around the rising trunk
        c.disc(64, GROUND + 4, 44, L[1], 8); c.ring(64, GROUND + 4, 50 + f * 6, L[4], 1, 10)
        for k in range(12):
            a = -math.pi * (k + .5) / 12
            x, y = orbit(64, GROUND, 20 + (f - 1) * 14 + (k % 3) * 4, a, 10 + (f - 1) * 12)
            c.rect(x, y, x + 2, y + 1, B[2 + k % 2]); c.px(x + 1, y - 2, L[3])
        rays(c, 64, GROUND - 40 * g, 10, 14, 60, L[3], rot=math.pi * 1.05, alt=44)
    # moon behind the crown from frame 4
    if f >= 4 and f <= 10:
        c.disc(112, 10, 9, M[0]); c.disc(112, 10, 7, M[2]); c.disc(115, 8, 6, 0)
    if f in (5, 6):   # radiant burst behind the crown
        rays(c, 64, GROUND - 88, 16, 20, 80, L[4] if f == 5 else L[3], rot=.1 + f * .1, alt=58)
    if f >= 8:   # roots drive into the enemy side
        u = f - 8
        for k, (dy, x_end, y_end) in enumerate(ROOTS):
            gx = min(1, (u + 1) / 2.2)
            xe = lerp(50, x_end - 40 + k * 8, gx); ye = lerp(GROUND - 6, y_end, gx)
            vine(c, [(56, GROUND - 6 + dy), (lerp(56, xe, .5), lerp(GROUND - 6, ye, .5) - 6), (xe, ye)], 7, 2, B[0], B[2], B[3])
            if u == 1: c.spark(xe, ye, 5, L[4], L[6], diag=True)
    fading = f >= 10
    def tree(cc):
        trunk(cc, g, glow=f >= 5)
        branches(cc, g)
        if f >= 4:
            crown(cc, [0, 0, 0, 0, .6, 1, 1.05, 1, 1, 1, .95, .9][f], f in (5, 6, 7))
    fade(c, fading, tree, f)
    if f == 6:   # white bloom flash in the crown
        c.disc(64, GROUND - 88, 16, L[5], 12); c.disc(64, GROUND - 88, 9, L[6], 7)
    if f >= 5:   # blossoms in the crown
        for k, (x, y, r) in enumerate(CROWN[::2]):
            if fading and k % 2: continue
            petal5(c, 64 + x, GROUND - 88 + y, 3, P[0], L[6] if f < 9 else P[1], rot=k)
    if f >= 6:   # leaf / petal rain + healing motes over the whole stage
        u = f - 6
        for k, (x, y, kind) in enumerate(RAIN):
            yy = (y + u * 18) % 150 - 20
            xx = x - u * 6 + math.sin(k + u) * 3
            if not (-4 < yy < 128): continue
            if kind == 0: leaf(c, xx, yy, 1 + k + u, 5, L[3], L[1])
            elif kind == 1: c.rect(xx, yy, xx + 1, yy, P[0]); c.px(xx, yy + 1, P[1])
            elif kind == 2: plus(c, xx, yy, 2, L[4], L[6])
            else: c.px(xx, yy, M[2])


if __name__ == '__main__':
    make(KEY)

