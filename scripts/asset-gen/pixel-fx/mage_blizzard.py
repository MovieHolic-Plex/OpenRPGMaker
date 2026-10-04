"""블리자드(적 개별) — 64px 10칸. 서리 소용돌이 → 얼음 기둥 분출·섬광 → 파편 비산과 서리 잔광. mage_snow 와 같은 ICE 팔레트."""
import math, random
from lib_mage import *

KEY = 'mage_blizzard'; FRAME = 64; FRAMES = 10; ANCHOR = 'allTargets'
PAL = Pal(I=ICE, A=AQUA[2:])
PEAK = [2, 4, 7]
CX, FY = 32, 54
_r = random.Random(5)
FLAKES = [(_r.uniform(0, math.tau), _r.uniform(14, 26), _r.uniform(-8, 8)) for _ in range(16)]
# crystal pillars: x offset, height, half width, lean
PILLARS = [(0, 40, 7, 0), (-14, 26, 5, -3), (13, 30, 5, 3), (-22, 15, 4, -4), (21, 17, 4, 4)]
SHARDS = [(_r.uniform(math.pi * 1.05, math.pi * 1.95), _r.uniform(3, 6)) for _ in range(14)]


def crystal(c, x, base, h, w, lean, lit=False):
    I = PAL.I
    top = (x + lean, base - h)
    c.poly([(x - w, base), (x - w + 1, base - h * .7), top, (x + w - 1, base - h * .75), (x + w, base)], I[1])
    c.poly([(x - w + 2, base), (x - w + 3, base - h * .65), top, (x, base)], I[3] if not lit else I[4])
    c.poly([(x, base), top, (x + w - 2, base - h * .7), (x + w - 2, base)], I[2])
    c.line([(x - w + 3, base - 2), (x - w + 3 + lean * .5, base - h * .55)], I[5 if lit else 4])
    c.line([(x - w, base), (x - w + 1, base - h * .7), top, (x + w - 1, base - h * .75), (x + w, base)], I[0])


def flake(c, x, y, r, col):
    c.spark(x, y, r, col, diag=r >= 2)


def draw(c, f):
    I, A = PAL.I, PAL.A
    # frost patch on the ground
    fr = [6, 12, 18, 24, 26, 26, 25, 22, 18, 12][f]
    patch = lambda cc: (cc.disc(CX, FY, fr, I[2], fr * .3), cc.disc(CX, FY, fr * .7, I[3], fr * .2))
    (c.dither(patch, f) if f >= 8 else patch(c))
    if f <= 2:  # swirl in
        for a, r0, dy in FLAKES:
            ang = a + f * .9; r = r0 * (1 - f * .28)
            x, y = orbit(CX, 36 + dy, r, ang, r * .55)
            tx, ty = orbit(CX, 36 + dy, r, ang - .35, r * .55)
            c.line([(tx, ty), (x, y)], A[0]); flake(c, x, y, 1 + (r0 > 20), I[5])
        c.glow(CX, 40, 3 + f * 2, [I[3], I[4], I[5]])
        return
    if f == 3:  # eruption flash
        for p in PILLARS[:3]: crystal(c, CX + p[0], FY, p[1] * .7, p[2], p[3], lit=True)
        c.glow(CX, 38, 13, [I[3], I[4], I[5]])
        for k in range(8):
            a = k * math.pi / 4; x1, y1 = orbit(CX, 38, 26 if k % 2 == 0 else 18, a)
            c.line([(CX, 38), (x1, y1)], I[5], 2 if k % 2 == 0 else 1)
        return
    if f <= 6:  # pillars stand, glint travels up
        grow = [0, 0, 0, 0, .9, 1.0, 1.0][f]
        for i, (dx, h, w, lean) in enumerate(PILLARS):
            if f == 4 and i >= 3: grow2 = .6
            else: grow2 = grow
            crystal(c, CX + dx, FY, h * grow2, w, lean, lit=(f == 4 and i == 0))
        gy = FY - 40 * [0, 0, 0, 0, .2, .55, .9][f]
        c.spark(CX - 2, gy, 3, I[5], diag=True)
        for a, r0, dy in FLAKES[::2]:
            x, y = orbit(CX, 30 + dy, r0 + f * 2, a + f, r0 * .5)
            flake(c, x, y, 1, A[1])
        if f == 6:  # crack lines before the shatter
            c.line([(CX - 3, FY - 30), (CX + 2, FY - 20), (CX - 2, FY - 11)], I[5])
            c.line([(CX - 14, FY - 18), (CX - 12, FY - 8)], I[5])
        return
    # shatter
    t = f - 6
    for a, v in SHARDS:
        x = CX + math.cos(a) * v * t * 2.4; y = FY - 18 + math.sin(a) * v * t * 1.6 + t * t * 1.3
        s = 3 if t < 2 else 2
        c.poly([(x - s, y), (x, y - s - 1), (x + s, y), (x, y + s)], I[3 if t < 3 else 2])
        if t < 3: c.px(x, y - 1, I[5])
    if t == 1: crystal(c, CX, FY, 16, 6, 0)
    for k in range(6):
        x = 8 + k * 10 + (t * 3) % 5; y = 14 + ((k * 13 + t * 9) % 30)
        flake(c, x, y, 1 if t < 3 else 0, I[4] if t < 3 else I[2])


if __name__ == '__main__':
    make(KEY)

