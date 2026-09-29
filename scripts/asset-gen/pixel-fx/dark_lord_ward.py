"""dark_lord_ward: 마력 방벽. 육각 마법진이 발밑에서 떠올라 몸 둘레 육각 방패로 서고, 룬이 돌다 금이 가듯 반짝이며 굳는다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'dark_lord_ward', 64, 10, 'user'
PAL = pal(DARKV, pick(GOLD, 'y2', 'y3'))


def hexa(c, cx, cy, r, k, rot=0.0, sq=1.0, w=1):
    pts = [pol(cx, cy, r, rot + i * math.pi / 3, sq) for i in range(6)]
    c.line(pts + [pts[0]], k, w)
    return pts


def draw(c, f):
    cx, cy = CX, CY
    if f <= 3:
        y = lerp(FEET, cy, ease(f / 3))
        sq = lerp(0.3, 1.0, ease(f / 3))
        hexa(c, cx, y, 22, 'u3', 0.0, sq, 2)
        hexa(c, cx, y, 16, 'u2', math.pi / 6, sq)
        c.dring(cx, FEET, 22, 'u2', squash=0.3, parity=f % 2)
    else:
        pulse = 1 if f % 2 else 0
        pts = hexa(c, cx, cy, 24 + pulse, 'u2', 0.0, 1.0, 3)
        hexa(c, cx, cy, 24 + pulse, 'u4', 0.0, 1.0, 1)
        hexa(c, cx, cy, 16, 'u3', math.pi / 6 + f * 0.1)
        for i in range(6):
            a = f * 0.35 + i * math.pi / 3
            x, y = pol(cx, cy, 20, a)
            c.diamond(x, y, 1.5, 2.5, 'y2' if i % 2 else 'u4')
        if 5 <= f <= 7:
            p = pts[f - 5]
            c.spark(p[0], p[1], 5, 'y3', 'y2')
        if f >= 8:
            for i in range(6):
                c.px(*pol(cx, cy, 10 + (f - 8) * 6, i * math.pi / 3 + 0.5), 'u4')


if __name__ == '__main__':
    run(globals())

