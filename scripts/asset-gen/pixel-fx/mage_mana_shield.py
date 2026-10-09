"""마나 실드 — 64px 10칸, 시전자 몸 위. 발밑 마법진이 그려짐 → 빛기둥 → 육각 방벽 → 반짝이며 옅어짐."""
import math
from lib_mage import *

KEY = 'mage_mana_shield'; FRAME = 64; FRAMES = 10; ANCHOR = 'user'
PAL = Pal(M=MANA)
PEAK = [2, 5, 8]
CX, FY, CY = 32, 55, 40


def circle(c, f, sweep=360):
    M = PAL.M
    rx, ry = 24, 7
    c.arc(CX, FY, rx, 90, 90 + sweep, M[3], 1, ry)
    c.arc(CX, FY, rx - 5, 270, 270 + sweep, M[2], 1, ry - 2)
    for k in range(12):
        a = k * math.tau / 12 + f * .35
        if math.degrees(a - f * .35) % 360 > sweep: continue
        x, y = orbit(CX, FY, rx - 2.5, a, ry - 1)
        c.rect(x, y, x + (k % 2), y, M[4] if k % 3 == 0 else M[6])
    if sweep >= 360:  # hexagram inside the circle
        for s in (0, math.pi / 3):
            pts = [orbit(CX, FY, rx - 7, s + f * .2 + k * math.tau / 3, ry - 3) for k in range(3)]
            c.line(pts + [pts[0]], M[2])


def hexwall(c, f, bright):
    M = PAL.M
    R = 21
    pts = [orbit(CX, CY, R, math.pi / 6 + k * math.pi / 3, R * 1.08) for k in range(6)]
    c.line(pts + [pts[0]], M[3] if bright else M[2], 2)
    c.line([orbit(CX, CY, R - 3, math.pi / 6 + k * math.pi / 3, (R - 3) * 1.08) for k in range(7)], M[1])
    # honeycomb facets on the front
    for k in range(6):
        x, y = orbit(CX, CY, R * .55, k * math.pi / 3 + math.pi / 6)
        cells = [orbit(x, y, 5, math.pi / 6 + j * math.pi / 3) for j in range(7)]
        c.line(cells, M[2] if (k + f) % 3 else M[4])
    # shimmer sweep crossing the wall
    sy = CY - R + ((f - 5) * 11) % (2 * R)
    c.line([(CX - R + 3, sy), (CX + R - 3, sy - 4)], M[5])
    for k in range(6): c.px(*pts[k], M[7 if bright else 4])


def draw(c, f):
    M = PAL.M
    if f <= 2:
        circle(c, f, [110, 240, 360][f])
        x, y = orbit(CX, FY, 24, math.radians(90 + [110, 240, 360][f]), 7)
        c.spark(x, y, 2, M[5])
        if f == 2: c.disc(CX, FY, 6, M[4], 2)
        return
    circle(c, f)
    if f <= 4:  # pillar of light rises from the circle
        top = [0, 0, 0, 30, 6][f]
        c.rect(CX - 16, top, CX + 16, FY, M[1]) if f == 4 else None
        c.poly([(CX - 14, FY), (CX - 10, top), (CX + 10, top), (CX + 14, FY)], M[2])
        c.poly([(CX - 8, FY), (CX - 5, top), (CX + 5, top), (CX + 8, FY)], M[4])
        c.rect(CX - 2, top, CX + 2, FY, M[5])
        for k in range(5):
            x = CX - 18 + k * 9; y = FY - 6 - ((f * 9 + k * 7) % 24)
            c.line([(x, y), (x, y - 4)], M[6])
        return
    if f <= 7:
        hexwall(c, f, bright=(f == 5))
        if f == 5:
            for k in range(8):
                a = k * math.pi / 4
                c.line([orbit(CX, CY, 24, a), orbit(CX, CY, 29, a)], M[5])
        for k in range(4):
            x, y = orbit(CX, CY, 25, f * .9 + k * math.pi / 2, 26)
            c.spark(x, y, 2 if k % 2 else 1, M[7 if k % 2 else 5])
        return
    # fade: dithered wall + rising motes
    c.dither(lambda cc: hexwall(cc, f, False), f)
    for k in range(5):
        x = CX - 16 + k * 8; y = 30 - (f - 8) * 8 - (k % 2) * 6
        c.spark(x, y, 1, M[6 if k % 2 else 4])


if __name__ == '__main__':
    make(KEY)

