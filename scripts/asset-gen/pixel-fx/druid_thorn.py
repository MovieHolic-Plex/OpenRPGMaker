"""가시 덩굴 — 64px 10칸. 발밑 균열에 초록 빛이 모이고 → 가시 덩굴이 솟아 몸을 휘감고 조이며 초록 섬광·잎 폭발 → 덩굴이 갈색으로 말라 부서지고 잎이 흩날림."""
import math
from lib_druid import *

KEY = 'druid_thorn'; FRAME = 64; FRAMES = 10; ANCHOR = 'target'
PAL = Pal(L=LEAF, B=BARK, P=BLOOM[:2])
PEAK = [2, 5, 8]
_r = rng(KEY)
VINES = [(-14, 1, 0.0, 1.0), (13, -1, 1.7, .95), (-5, 1, 3.3, .85), (7, -1, 4.6, .8)]   # base dx, spin dir, phase, height
MOTES = [(_r.uniform(0, math.tau), _r.uniform(18, 28)) for _ in range(12)]
LEAVES = [(_r.uniform(-math.pi, 0), _r.uniform(2.5, 5), _r.randint(3, 5)) for _ in range(14)]
CHIPS = [(_r.uniform(-20, 20), _r.uniform(-4, 0)) for _ in range(9)]


def path(dx, sp, ph, hs, g):
    """Vine centreline from the ground: spirals around the body, g = grown fraction."""
    pts = []
    n = max(2, round(12 * g))
    for i in range(n + 1):
        u = g * i / n
        rr = 15 - u * 5
        x = CX + dx * (1 - u) + math.sin(u * 7.5 * sp + ph) * rr * u
        y = GY - u * 40 * hs
        pts.append((x, y))
    return pts


def draw_vines(c, g, dry=0, squeeze=0.0):
    L, B = PAL.L, PAL.B
    dark, mid, hi = [(L[0], L[2], L[3]), (B[0], B[2], L[2]), (B[0], B[1], B[2])][dry]
    for dx, sp, ph, hs in VINES:
        pts = path(dx * (1 - squeeze * .3), sp, ph, hs, g)
        vine(c, pts, 4, 1, dark, mid, hi)
        for i in range(2, len(pts) - 1, 2):
            (x0, y0), (x1, y1) = pts[i - 1], pts[i]
            a = math.atan2(y1 - y0, x1 - x0) + (math.pi / 2 if i % 4 else -math.pi / 2)
            thorn(c, x1, y1, a - .5 * sp, 3 + (dry == 0), hi if dry else L[4], L[5] if not dry else None)
        if dry == 0 and g >= .9:   # blossoms at the vine tips
            x, y = pts[-1]
            c.disc(x, y, 2, PAL.P[0]); c.px(x, y, PAL.P[1]); c.px(x - 1, y - 1, PAL.P[1])


def draw(c, f):
    L, B = PAL.L, PAL.B
    if f <= 1:   # gather: green motes sink into a glowing crack under the feet
        t = (f + 1) / 2
        converge(c, CX, GY, MOTES, t, L[3], L[5], ry=.45, tail=3 + f * 2)
        c.disc(CX, GY + 1, 10 + f * 6, L[1], 2 + f)
        crack = [(CX - 14 - f * 4, GY + 1), (CX - 7, GY - 1), (CX - 2, GY + 2), (CX + 4, GY - 1), (CX + 10, GY + 1), (CX + 15 + f * 4, GY)]
        c.line(crack, L[3], 1); c.line(crack[1:5], L[5], 1)
        if f == 1:
            for x, y in CHIPS[:5]: c.rect(CX + x, GY - 2 + y, CX + x + 1, GY - 1 + y, B[2])
        return
    if f <= 4:   # vines erupt and spiral upward
        g = [0, 0, .35, .7, 1.0][f]
        c.disc(CX, GY + 1, 22, L[1], 3); c.disc(CX, GY + 1, 14, L[2], 2)
        for k, (x, y) in enumerate(CHIPS):
            yy = GY - 4 - (f - 1) * 6 + y * (f - 1) + (f - 2) ** 2 * 2
            c.rect(CX + x * (1 + f * .2), yy, CX + x * (1 + f * .2) + 1, yy + 1, B[1 + k % 3])
        draw_vines(c, g)
        if f == 4: c.spark(CX, CY - 4, 4, L[4], L[6])
        return
    if f == 5:   # squeeze: white-green flash from the body, thorn burst
        rays(c, CX, CY, 12, 6, 28, L[4], rot=.2, alt=20)
        c.disc(CX, CY, 13, L[3]); c.disc(CX, CY, 10, L[4]); c.disc(CX, CY, 7, L[5]); c.disc(CX, CY, 4, L[6])
        draw_vines(c, 1.0, squeeze=1)
        for k in range(8):
            a = k * math.tau / 8 + .3
            thorn(c, *orbit(CX, CY, 12, a), a, 8, L[5], L[6])
        return
    if f == 6:   # leaf explosion over the tightened vines
        draw_vines(c, 1.0, squeeze=1)
        c.ring(CX, CY, 20, L[4], 2, 16); c.disc(CX, CY, 5, L[5])
        for a, v, ln in LEAVES:
            x, y = orbit(CX, CY, v * 4, a)
            leaf(c, x, y, a, ln, L[3], L[1])
        return
    u = f - 7   # 0..2 wither: vines dry brown, crumble and sink; leaves fall
    g = [1.0, .75, .45][u]
    fade(c, u == 2, lambda cc: draw_vines(cc, g, dry=1 + (u > 0)), f)
    for k, (a, v, ln) in enumerate(LEAVES):
        x, y = orbit(CX, CY, v * (5 + u * 1.5), a)
        y += (u + 1) ** 2 * 2.5
        if y > GY + 4: continue
        col = L[2] if u == 0 else (B[3] if k % 2 else L[1])
        leaf(c, x + math.sin(k + f) * 2, y, a + f * .9, ln - u, col)
    for k, (x, y) in enumerate(CHIPS):
        c.px(CX + x, GY - 1 - (k % 3) + u, B[2 - (k % 2)])


if __name__ == '__main__':
    make(KEY)

