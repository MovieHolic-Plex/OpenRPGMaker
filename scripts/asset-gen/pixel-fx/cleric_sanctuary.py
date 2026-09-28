"""성역 — 64px 10칸, 아군마다. 발밑에 성역 문양이 선을 따라 그려짐 → 문양이 빛나며 반투명 빛벽이 솟음 → 문양만 남아 맥동하며 옅어짐."""
import math
from lib_mage import *

KEY = 'cleric_sanctuary'; FRAME = 64; FRAMES = 10; ANCHOR = 'allAllies'
PAL = Pal(H=HOLY, A=AQUA[1:])
PEAK = [2, 5, 7]
CX, FY, CY = 32, 55, 38
RX, RY = 27, 8


def glyph(c, f, prog, lit):
    """Ellipse ring + inner ring + 4 cross arms + 8 runes. prog 0..1 = how much is drawn."""
    H, A = PAL.H, PAL.A
    c.arc(CX, FY, RX, 90, 90 + 360 * min(1, prog * 1.3), H[3] if lit else H[2], 1 + lit, RY)
    if prog > .3:
        c.arc(CX, FY, RX - 6, 270, 270 + 360 * min(1, (prog - .3) * 1.6), A[1] if not lit else A[2], 1, RY - 2)
    if prog > .55:
        k = min(1, (prog - .55) * 2.4)
        for s in (-1, 1):
            c.line([(CX, FY), (CX + s * (RX - 7) * k, FY)], H[3])
        c.line([(CX, FY - (RY - 3) * k), (CX, FY + (RY - 3) * k)], H[3])
        c.disc(CX, FY, 2, H[4] if lit else H[3], 1)
    if prog >= 1:
        for k in range(8):
            a = k * math.pi / 4 + f * .2
            x, y = orbit(CX, FY, RX - 3, a, RY - 1)
            c.rect(x, y, x + (k % 2), y, H[5] if (k + f) % 3 == 0 else A[2])


def wall(c, h, f):
    H, A = PAL.H, PAL.A
    top = FY - h
    for k in range(9):   # vertical light slats around the dome
        a = math.pi * (k / 8)
        x, _ = orbit(CX, 0, RX - 1, a)
        y0 = FY + math.sin(a) * (RY - 1)
        col = A[2] if k % 2 else H[3]
        c.line([(x, y0), (x, y0 - h * (1 - abs(k - 4) * .06))], col)
    c.arc(CX, top + 6, RX - 1, 180, 360, H[4], 1, 9)
    c.ring(CX, top + 6, RX - 1, A[1], 1, 4)
    sy = FY - ((f - 4) * 9) % max(1, h)
    c.line([(CX - RX + 2, sy), (CX + RX - 2, sy)], H[5]) if h > 10 else None


def draw(c, f):
    H, A = PAL.H, PAL.A
    if f <= 3:
        prog = (f + 1) / 4
        glyph(c, f, prog, lit=(f == 3))
        x, y = orbit(CX, FY, RX, math.radians(90 + 360 * min(1, prog * 1.3)), RY)
        c.spark(x, y, 2, H[5])
        if f == 3: c.spark(CX, FY - 2, 8, H[5], diag=True)
        return
    if f <= 7:
        h = [26, 38, 38, 32][f - 4]
        (wall(c, h, f) if f < 7 else c.dither(lambda cc: wall(cc, h, f), f))
        glyph(c, f, 1, lit=(f in (4, 5)))
        for k in range(5):
            x = CX - 20 + k * 10; y = FY - 6 - ((f * 7 + k * 9) % (h - 4))
            c.spark(x, y, 1, H[5] if k % 2 else A[2])
        return
    glyph(c, f, 1, lit=False) if f == 8 else c.dither(lambda cc: glyph(cc, f, 1, False), f)
    for k in range(4):
        x = CX - 15 + k * 10; y = FY - 10 - (f - 8) * 8 - (k % 2) * 5
        c.px(x, y, H[4])


# QA 2026-09-28: 칸 경계에서 직선으로 잘리던 가장자리를 디더로 걷는다(fx_edge.py). 그림 수식은 위 draw 그대로.
from fx_edge import fade_edges  # noqa: E402

_draw_body = draw


def draw(c, f):
    _draw_body(c, f)
    fade_edges(c, B=3)


if __name__ == '__main__':
    make(KEY)

