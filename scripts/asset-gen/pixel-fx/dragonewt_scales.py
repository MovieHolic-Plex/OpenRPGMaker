"""dragonewt_scales: 비늘 경화. 몸 둘레에 비늘 모양 육각 방패가 차례로 켜져 초록 금속빛 물결이 위로 훑고 지난다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'dragonewt_scales', 64, 8, 'user'
PAL = pal(DRAKE, pick(LEAFG, 'g3', 'g4'), pick(DOWN, 'f3'), pick(GOLD, 'y2'))


def hexa(c, x, y, r, k, fill=None):
    pts = [pol(x, y, r, i * math.pi / 3 + math.pi / 6) for i in range(6)]
    if fill:
        c.poly(pts, fill)
    c.line(pts + [pts[0]], k)


def draw(c, f):
    cx, cy = 32, 36
    sweep = 56 - f * 8
    for row in range(7):
        for col in range(-2, 3):
            x = cx + col * 8 + (4 if row % 2 else 0)
            y = 16 + row * 6.6
            if ((x - cx) / 15.0) ** 2 + ((y - 38) / 24.0) ** 2 > 1:
                continue
            on = y >= sweep - 4
            near = abs(y - sweep) < 6
            if on:
                hexa(c, x, y, 4, 'g3' if near else 'r2', 'r1' if not near else 'r2')
                if near:
                    c.px(x, y, 'f3')
            elif f < 7:
                hexa(c, x, y, 4, 'r0')
    if f >= 1:
        c.line([(cx - 16, sweep), (cx + 16, sweep)], 'g4')
    if f in (5, 6):
        c.spark(cx - 4, 26, 6, 'f3', 'g4', diag=True)
    for k in range(4):
        r = rng(12 + k)
        c.px(cx + r.uniform(-17, 17), 56 - (f * 4 + k * 6) % 34, 'y2')
    c.oval(cx, 56, 14, 2, 'r1', 1)


if __name__ == '__main__':
    run(globals())
