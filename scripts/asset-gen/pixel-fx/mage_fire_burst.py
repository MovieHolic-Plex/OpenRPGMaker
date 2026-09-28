"""파이어볼 착탄 — 64px 10칸. 불씨 수렴 → 백열 섬광·화염 구·충격파 → 불꽃 혀가 사그라들고 연기와 불씨가 흩어짐. mage_fireball_orb 와 같은 FIRE 팔레트."""
import math, random
from lib_mage import *

KEY = 'mage_fire_burst'; FRAME = 64; FRAMES = 10; ANCHOR = 'target'
PAL = Pal(F=FIRE, S=SMOKE)
PEAK = [2, 4, 7]
CX, CY = 32, 40
_r = random.Random(11)
EMBERS = [(_r.uniform(0, math.tau), _r.uniform(3.2, 6.4), _r.randint(0, 2)) for _ in range(18)]
INCOMING = [(_r.uniform(0, math.tau), _r.uniform(20, 28)) for _ in range(10)]
SPIKES = [(k * math.tau / 11 + _r.uniform(-.15, .15), _r.uniform(.8, 1.2)) for k in range(11)]
TONGUES = [(-15, .7, -3), (-8, 1.0, -1), (0, 1.25, 0), (8, .95, 2), (15, .65, 3)]   # x, height scale, lean
PUFFS = [(-12, -4, 6), (10, -6, 7), (-3, -12, 7), (15, 4, 5), (-16, 5, 5), (4, 2, 5)]


def ray(c, a, r0, r1, w, col):
    x0, y0 = orbit(CX, CY, r0, a); x1, y1 = orbit(CX, CY, r1, a)
    nx, ny = -math.sin(a) * w, math.cos(a) * w
    c.poly([(x0 + nx, y0 + ny), (x1, y1), (x0 - nx, y0 - ny)], col)


def tongue(c, x, base, h, w, lean, ramp, f):
    """Pointed flame with a wavering tip and a split second tip."""
    for i, col in enumerate(ramp):
        s = 1 - i * .28
        hh, ww = h * s, w * s
        wob = math.sin(f * 1.7 + x) * 1.5
        tip = (x + lean * s + wob, base - hh)
        c.poly([(x - ww, base), (x - ww * .8, base - hh * .35), (x - ww * .3 + lean * .4, base - hh * .7), tip,
                (x + ww * .45 + lean * .6, base - hh * .62), (x + ww * .7 + lean * .8, base - hh * .8),
                (x + ww * .9, base - hh * .4), (x + ww, base)], col)


def draw(c, f):
    F, S = PAL.F, PAL.S
    if f <= 2:  # gather: embers stream in, core swells
        t = (f + 1) / 3
        for a, r0 in INCOMING:
            r = r0 * (1 - t) + 2
            x, y = orbit(CX, CY, r, a)
            x2, y2 = orbit(CX, CY, r + 4 + f, a)
            c.line([(x, y), (x2, y2)], F[3]); c.px(x, y, F[6])
        c.glow(CX, CY, 4 + f * 3, [F[1], F[3], F[4], F[5], F[6], F[7]])
        if f == 2:
            for k in range(4): ray(c, k * math.pi / 2 + math.pi / 4, 6, 15, 1.2, F[6])
        return
    if f == 3:  # white flash
        for k in range(12): ray(c, k * math.tau / 12, 8, 30 if k % 2 else 22, 2.4, F[5])
        c.disc(CX, CY, 17, F[5]); c.disc(CX, CY, 14, F[6]); c.disc(CX, CY, 10, F[7])
        return
    t = f - 4   # 0..5
    # smoke puffs rising behind everything from frame 6
    if f >= 6:
        u = f - 6
        for k, (dx, dy, r) in enumerate(PUFFS):
            if k > 2 + u: continue
            x = CX + dx * (1 + u * .25); y = CY - 4 + dy - u * 5
            rr = r + u * .6
            def puff(cc, x=x, y=y, rr=rr):
                cc.disc(x, y, rr, S[0]); cc.disc(x - 1, y - 1, rr * .7, S[1]); cc.disc(x - 2, y - 2, rr * .35, S[2])
            (c.dither(puff, k) if u >= 2 else puff(c))
    # ground shock ring
    rr = [20, 26, 30, 31, 0, 0][t]
    if rr:
        ring = lambda cc: cc.ring(CX, CY + 12, rr, F[5] if t < 2 else F[3], 2, rr * .3)
        (c.dither(ring, f) if t >= 2 else ring(c))
    # flame tongues standing on the ground line, dying down
    hs = [26, 30, 26, 19, 11, 5][t]
    ramp = [[F[1], F[3], F[4], F[6]], [F[1], F[3], F[4], F[6]], [F[1], F[2], F[4], F[5]], [F[1], F[2], F[4]], [F[1], F[2], F[3]], [F[1], F[2]]][t]
    for x, sc, lean in TONGUES:
        tongue(c, CX + x, CY + 13, hs * sc, 5 if x == 0 else 4, lean, ramp, f)
    # fire mass: billowing lobes, shaded dark rim -> lit upper-left; shrinks and cools
    R = [15, 17, 13, 9, 5, 0][t]
    if R:
        if t <= 1:
            for a, s in SPIKES:
                ray(c, a - .1 * t, R * .6, R * (1.25 + .3 * s) + t * 2, 2.2 * s, F[3])
        cy = CY - t * 2
        lobes = [(0, 0, 1.0)] + [(math.cos(k * math.tau / 6 + f * .5) * R * .6, math.sin(k * math.tau / 6 + f * .5) * R * .5, .55) for k in range(6)]
        shades = [[F[1], F[3], F[4], F[5], F[6]], [F[1], F[3], F[4], F[5], F[6]], [F[1], F[2], F[3], F[4], F[5]],
                  [F[1], F[2], F[3], F[4]], [F[1], F[2], F[3]]][t]
        for i, col in enumerate(shades):
            k = 1 - i * .2
            for dx, dy, sc in (lobes if i < 3 else lobes[:1]):
                rr2 = R * sc * k
                c.disc(CX + dx - R * .12 * i, cy + dy - R * .12 * i, rr2, col)
        if t == 0: c.disc(CX - 3, cy - 3, 2, F[7])
    # embers: ballistic, bright while young
    for a, v, kind in EMBERS:
        e = t + 1
        x = CX + math.cos(a) * v * e * 1.6; y = CY + math.sin(a) * v * e * 1.1 + e * e * .9
        if not (0 <= x < 64 and 0 <= y < 64): continue
        col = F[6] if e < 3 else F[4] if e < 5 else F[2]
        if kind == 0 and e < 5: c.rect(x, y, x + 1, y + 1, col)
        elif kind == 1: c.line([(x, y), (x - math.cos(a) * 3, y - math.sin(a) * 2)], col)
        elif e < 5 or (round(x) + round(y) + f) % 2 == 0: c.px(x, y, col)


if __name__ == '__main__':
    make(KEY)

