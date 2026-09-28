"""연쇄 번개 — 64px 8칸, 적마다 같은 시트. 오른쪽에서 튀어 들어와 → 하늘 벼락·섬광 → 왼쪽으로 튀어 나가는 잔전류."""
import math, random
from lib_mage import *

KEY = 'mage_chain_bolt'; FRAME = 64; FRAMES = 8; ANCHOR = 'allTargets'
PAL = Pal(B=BOLT)
PEAK = [2, 4]
CX, CY = 32, 40


def zig(f, x0, y0, x1, y1, seg, amp, salt):
    return jag(x0, y0, x1, y1, seg, amp, random.Random(f * 31 + salt))


def draw(c, f):
    B = PAL.B
    thick = [(B[1], 5), (B[2], 3), (B[5], 1)]
    thin = [(B[2], 3), (B[3], 1)]
    if f == 0:  # arc jumps in from the previous target (right edge)
        pts = zig(f, 63, 26, 44, 36, 5, 4, 1)
        c.bolt(pts, thin); c.spark(44, 36, 3, B[5], diag=True)
        return
    if f == 1:
        c.bolt(zig(f, 63, 24, CX, CY, 7, 5, 2), thick)
        c.glow(CX, CY, 8, [B[1], B[3], B[5], B[6]])
        return
    if f == 2:  # sky strike + white flash
        c.disc(CX, CY, 20, B[0], 16); c.disc(CX, CY, 16, B[2], 13)
        c.bolt(zig(f, CX + 4, 0, CX, CY, 8, 5, 3), [(B[4], 7), (B[5], 4), (B[6], 2)])
        c.glow(CX, CY, 11, [B[3], B[5], B[6]])
        for k in range(6):
            a = k * math.tau / 6 + .3
            c.bolt(zig(f, CX, CY, *orbit(CX, CY, 22, a), 3, 3, 10 + k), [(B[4], 2), (B[6], 1)])
        return
    if f == 3:
        c.bolt(zig(f, CX - 3, 0, CX, CY, 8, 6, 4), thick)
        c.ring(CX, CY + 12, 18, B[4], 2, 6)
        c.glow(CX, CY, 7, [B[2], B[4], B[6]])
        for k in range(4):
            a = math.pi * .8 + k * .45
            c.bolt(zig(f, CX, CY, *orbit(CX, CY, 20 + k * 3, a), 4, 3, 20 + k), [(B[3], 1)])
        return
    if f == 4:  # jumps onward to the next target (left edge)
        c.bolt(zig(f, CX, CY, 0, 30, 7, 5, 5), thick)
        c.bolt(zig(f, CX, CY, 6, 54, 5, 4, 6), thin)
        c.ring(CX, CY + 12, 24, B[3], 1, 8)
        c.spark(CX, CY, 5, B[6], diag=True)
        return
    # residual crackle around the body, fading
    t = f - 5
    for k in range(4 - t):
        a = k * 1.7 + f * .9
        x0, y0 = orbit(CX, CY, 6 + t * 3, a); x1, y1 = orbit(CX, CY, 14 + t * 4, a + .4)
        c.bolt(zig(f, x0, y0, x1, y1, 3, 2, 30 + k), [(B[3 if t < 2 else 2], 1)])
    def glow_edge(cc): cc.ring(CX, CY, 10 + t * 5, B[2], 1)
    c.dither(glow_edge, t)
    for k in range(5):
        x, y = orbit(CX, CY, 10 + t * 6, k * 1.25 + t)
        c.px(x, y, B[5] if t == 0 else B[4])


if __name__ == '__main__':
    make(KEY)

