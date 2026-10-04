"""dark_lord_eclipse: 종말의 어둠(필살 배경, 화면 128). 금빛 해가 검은 원에 먹혀 개기 일식이 되고, 코로나 빛살과
보랏빛 암흑 파동이 화면을 채운 뒤 붉은 금이 하늘을 가른다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'dark_lord_eclipse', 128, 12, 'screen'
PAL = pal(DARKV, GOLD, HELL, INK)
OVAL = 0.4


def draw(c, f):
    cx, cy = 64, 56
    dim = min(1.0, f / 5)
    c.ddisc(cx, 64, 62, 'u1' if f < 4 else 'u0', parity=f % 2)
    if f >= 4:
        c.ddisc(cx, 64, 60, 'u1', parity=(f + 1) % 2, squash=0.9)
    R = 20
    if f >= 3:                                            # 코로나 빛살
        L = 10 + min(f - 3, 4) * 7
        c.rays(cx, cy, 16, R + 2, R + L, 'y1', 2, rot=f * 0.06)
        c.rays(cx, cy, 16, R + 2, R + L * 0.6, 'y2', 1, rot=f * 0.06 + 0.2)
    c.disc(cx, cy, R + 2, 'y1')
    c.disc(cx, cy, R, 'y2' if f < 5 else 'y1')
    c.disc(cx - 3, cy - 3, R - 8, 'y3')
    mx = lerp(cx + 44, cx, ease(dim))                     # 검은 달이 오른쪽에서 덮는다
    c.disc(mx, cy, R, 'k0')
    if f >= 5:
        c.ring(cx, cy, R + 1, 'y3', 1)
        c.px(cx - R + 3, cy - 12, 'y3')
        c.spark(cx - R + 4, cy - 12, 6 if f == 5 else 3, 'y3', 'y2')   # 다이아몬드 반지
    if f >= 6:
        for j in range(3):                                # 암흑 파동
            r = 26 + ((f - 6) * 9 + j * 14) % 44
            c.ring(cx, cy + 8, r, ['u2', 'u3', 'u4'][j], 1, 0.7)
    if f >= 8:
        a = f - 8
        pts = [(0, 30), (22, 42), (40, 34), (56, 52), (74, 44), (92, 62), (110, 50), (128, 60)]
        cut = pts[:2 + a * 2]
        c.line(cut, 'z1', 3)
        c.line(cut, 'z2', 1)
        for i, p in enumerate(cut[1:-1]):
            c.line([p, (p[0] + 4, p[1] + 10 + i % 2 * 4)], 'z2')
    for i in range(8):                                    # 바닥 그림자 손
        x = 10 + i * 15
        h = [0, 0, 0, 0, 4, 10, 16, 22, 26, 24, 20, 16][f] * (0.6 + (i % 3) * 0.2)
        if h:
            c.poly([(x - 4, 124), (x - 2, 124 - h), (x, 122 - h - 3), (x + 2, 124 - h), (x + 4, 124)], 'u2')
            c.px(x, 122 - h - 3, 'u4')


if __name__ == '__main__':
    run(globals())

