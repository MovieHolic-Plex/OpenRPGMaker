"""gargoyle_pal_claw: 돌 발톱. 앞으로 뻗은 석화 발톱이 굵은 세 줄을 각지게 긁고 돌조각과 먼지가 튄다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'gargoyle_pal_claw', 64, 8, 'target'
PAL = pal(STONE, pick(SAND, 'n1', 'n2', 'n3'), pick(GOLD, 'y2', 'y3'))


def chip(c, x, y, r, k1, k2):
    c.poly([(x - r, y), (x, y - r), (x + r * 0.8, y + r * 0.3), (x, y + r)], k1)
    c.px(x - r * 0.3, y - r * 0.3, k2)


def draw(c, f):
    cx, cy = 32, 34
    if f == 0:
        c.spark(54, 14, 5, 'y3', 'y2')
        for k in range(3):
            c.line([(58 - k * 3, 8 + k * 5), (62 - k * 3, 12 + k * 5)], 's3')
    ang = math.radians(198)                                  # 오른쪽 위 → 왼쪽 아래로 스치듯
    for i in range(3):
        st = 1 + i
        if not (st <= f <= st + 3):
            continue
        fr = min(1.0, (f - st + 1) / 2)
        ux, uy = math.cos(ang), math.sin(ang)
        nx, ny = -uy, ux
        o = (i - 1) * 10
        p0 = (cx + nx * o - ux * 25, cy + ny * o - uy * 25)
        p1 = (cx + nx * o + ux * 25, cy + ny * o + uy * 25)
        c.blade(p0, p1, 3, 7, ['s0', 's2', 's3', 's4'], fr)
        if f == st:
            hx, hy = lerp(p0[0], p1[0], fr), lerp(p0[1], p1[1], fr)
            c.spark(hx, hy, 5, 'y3', 'y2')
    if f >= 2:
        r = rng(8)
        for k in range(7):
            a = r.uniform(0, 6.28)
            d = r.uniform(6, 22) * ease((f - 1) / 6)
            x, y = cx + math.cos(a) * d, cy + math.sin(a) * d * 0.8 + (f - 1) * (f - 1) * 0.5
            chip(c, x, y, 1 + (k % 3) * 0.6, 's2' if k % 2 else 's3', 's4')
    if 2 <= f <= 5:
        dust(c, cx + 2, 52, 9 + (f - 2) * 2, 3, ['n1', 'n2', 'n3'], fade=f >= 5)


if __name__ == '__main__':
    run(globals())
