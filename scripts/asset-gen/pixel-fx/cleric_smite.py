"""심판의 빛 — 64px 10칸, 적 위. 머리 위 빛 고리가 조여듦 → 황금 빛기둥이 내리꽂힘·섬광 → 바닥 파문과 올라가는 빛 조각."""
import math, random
from lib_mage import *

KEY = 'cleric_smite'; FRAME = 64; FRAMES = 10; ANCHOR = 'target'
PAL = Pal(H=HOLY, W=['#c86a2a'])
PEAK = [2, 4, 7]
CX, FY, CY = 32, 55, 38
_r = random.Random(4)
BITS = [(_r.uniform(-22, 22), _r.uniform(0, 30)) for _ in range(12)]


def draw(c, f):
    H = PAL.H
    if f <= 2:  # sigil ring above, contracting; target marked on the ground
        r = [22, 15, 9][f]
        c.ring(CX, 10, r, H[3], 1, r * .35); c.ring(CX, 10, r - 3, H[2], 1, (r - 3) * .35)
        for k in range(6):
            x, y = orbit(CX, 10, r, k * math.pi / 3 + f * .5, r * .35)
            c.spark(x, y, 1, H[5])
        c.ring(CX, FY, 14 - f * 2, H[2], 1, 4 - f * .5)
        if f == 2: c.line([(CX, 12), (CX, FY)], H[4])
        return
    if f == 3:  # the strike: widest, whitest column + flash
        c.poly([(CX - 14, 0), (CX + 14, 0), (CX + 18, FY), (CX - 18, FY)], H[3])
        c.poly([(CX - 9, 0), (CX + 9, 0), (CX + 12, FY), (CX - 12, FY)], H[4])
        c.rect(CX - 5, 0, CX + 5, FY, H[5])
        c.disc(CX, FY - 2, 26, H[4], 8); c.disc(CX, FY - 2, 18, H[5], 5)
        return
    if f <= 6:
        t = f - 4
        w = [11, 9, 6][t]
        c.poly([(CX - w - 2, 0), (CX + w + 2, 0), (CX + w + 5, FY), (CX - w - 5, FY)], H[1])
        c.poly([(CX - w, 0), (CX + w, 0), (CX + w + 3, FY), (CX - w - 3, FY)], H[3])
        c.poly([(CX - w + 4, 0), (CX + w - 4, 0), (CX + w - 2, FY), (CX - w + 2, FY)], H[4])
        c.rect(CX - 1, 0, CX + 1, FY, H[5])
        # ground ripples
        for k in range(2):
            rr = 14 + t * 7 + k * 6
            c.ring(CX, FY, rr, H[3] if k == 0 else H[2], 1 + (k == 0), rr * .28)
        # side flares
        for s in (-1, 1):
            c.line([(CX + s * (w + 4), FY - 2), (CX + s * (w + 16 + t * 3), FY - 7 - t * 2)], H[4], 2)
        for dx, y0 in BITS:
            y = FY - 6 - ((y0 + t * 11) % 44)
            c.spark(CX + dx, y, 1 if (dx > 0) ^ (t % 2 == 0) else 2, H[4 if y0 > 15 else 5])
        return
    t = f - 7
    c.dither(lambda cc: cc.poly([(CX - 5 + t, 0), (CX + 5 - t, 0), (CX + 7 - t, FY), (CX - 7 + t, FY)], H[3]), t)
    rr = 32 + t * 3
    c.dither(lambda cc: cc.ring(CX, FY, rr, H[2], 1, rr * .28), t + 1)
    for dx, y0 in BITS[::2]:
        y = 30 - t * 9 - y0 * .4
        c.spark(CX + dx * .8, y, 1 if t < 2 else 0, H[4] if t < 2 else H[2])


if __name__ == '__main__':
    make(KEY)

