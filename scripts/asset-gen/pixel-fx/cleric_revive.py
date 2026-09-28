"""부활 — 64px 12칸, 쓰러진 아군 위. 하늘 빛줄기 → 천사 날개가 펼쳐지며 대상을 감쌈 → 깃털 폭발과 원환 섬광 → 날개가 접히며 빛 조각."""
import math, random
from lib_mage import *

KEY = 'cleric_revive'; FRAME = 64; FRAMES = 12; ANCHOR = 'target'
SIDE = 'ally'   # 검토 합성판에서 아군 위에 얹는다(시트 자체는 대상 기준)
PAL = Pal(H=HOLY, W=['#ecebf6', '#b8b2d0', '#7a7298'])
PEAK = [4, 7, 9]
CX, FY, CY = 32, 55, 36
_r = random.Random(14)
BURST = [(k * math.tau / 12 + _r.uniform(-.2, .2), _r.uniform(3, 5)) for k in range(12)]


def wing(c, side, spread, lift=0):
    """side -1 left / +1 right. spread 0..1 opens the wing up from the body."""
    H, W = PAL.H, PAL.W
    root = (CX + side * 3, CY - 2 - lift)
    for i in range(6):   # six primaries fanned from the root, longest on top
        a = math.radians(-100 + side * (30 + i * 15) * (.35 + spread * .65))
        ln = (27 - i * 2.6) * (0.45 + spread * .55)
        tip = (root[0] + math.cos(a) * ln, root[1] + math.sin(a) * ln * .95)
        mid = (root[0] + math.cos(a) * ln * .5, root[1] + math.sin(a) * ln * .5)
        nx, ny = -math.sin(a) * 3.2, math.cos(a) * 3.2
        c.poly([root, (mid[0] + nx, mid[1] + ny), tip, (mid[0] - nx, mid[1] - ny)], W[2])
        c.poly([(root[0] + (tip[0] - root[0]) * .15, root[1] + (tip[1] - root[1]) * .15), (mid[0] + nx * .6, mid[1] + ny * .6),
                (tip[0] - math.cos(a), tip[1] - math.sin(a)), (mid[0] - nx * .2, mid[1] - ny * .2)], W[1])
        c.line([(mid[0] + nx * .3, mid[1] + ny * .3), (tip[0] - math.cos(a) * 2, tip[1] - math.sin(a) * 2)], W[0])
    # covert: rounded upper shoulder
    sx, sy = root[0] + side * 6 * spread, root[1] - 4 * spread
    c.disc(sx, sy, 6, W[1], 4); c.disc(sx - side, sy - 1, 4, W[0], 2.5)
    c.px(sx - side * 2, sy - 3, H[5])


def draw(c, f):
    H, W = PAL.H, PAL.W
    if f <= 2:  # beam from above lands on the fallen ally
        w = [2, 5, 8][f]
        c.poly([(CX - w, 0), (CX + w, 0), (CX + w + 2, FY), (CX - w - 2, FY)], H[2])
        c.rect(CX - max(0, w - 3), 0, CX + max(0, w - 3), FY, H[4])
        c.disc(CX, FY, 8 + f * 4, H[3], 2 + f)
        for k in range(3): c.spark(CX + (k - 1) * 10, FY - 10 - ((f * 7 + k * 9) % 30), 1, H[5])
        return
    if f <= 8:
        spread = min(1, (f - 2) / 3)
        lift = max(0, f - 5) * 1.5
        # light column behind (thin, so the wings carry the silhouette)
        c.poly([(CX - 3, 0), (CX + 3, 0), (CX + 6, FY), (CX - 6, FY)], H[1])
        c.rect(CX - 1, 0, CX + 1, FY, H[3])
        for s in (-1, 1): wing(c, s, spread, lift)
        c.glow(CX, CY - 2 - lift, 4 + (f == 6) * 3, [H[3], H[4], H[5]])
        # halo ring above
        c.ring(CX, CY - 20 - lift, 7, H[3], 2, 2); c.px(CX - 4, CY - 21 - lift, H[5])
        if f == 6:   # peak flash
            c.ring(CX, CY, 28, H[4], 2, 26)
            for k in range(8):
                a = k * math.pi / 4 + math.pi / 8
                c.line([orbit(CX, CY, 20, a), orbit(CX, CY, 30, a)], H[5])
        if f >= 7:   # feather burst
            t = f - 6
            for a, v in BURST:
                x, y = orbit(CX, CY, 10 + v * t * 3, a); y += t * t * .5
                feather(c, x, y, 5, a + math.pi / 2, W[0], W[1])
        c.ring(CX, FY, 22, H[3], 1, 4); c.ring(CX, FY, 16, H[4], 1, 3)
        return
    # 9..11: wings fold away, feathers flutter down, motes rise
    t = f - 8
    spread = max(.2, 1 - t * .3)
    c.dither(lambda cc: [wing(cc, s, spread, 4) for s in (-1, 1)], t)
    for k, (a, v) in enumerate(BURST):
        x, y = orbit(CX, CY, 10 + v * (t + 2) * 3, a)
        y += (t + 2) ** 2 * .5 + t * 3
        if y < FY and (k + t) % 3: feather(c, x, y, 4, math.pi / 2 + math.sin(t + k) * .7, W[0], W[2])
    for k in range(5):
        c.spark(CX - 16 + k * 8, FY - 12 - t * 9 - (k % 2) * 6, 1, H[5] if k % 2 else H[3])


if __name__ == '__main__':
    make(KEY)

