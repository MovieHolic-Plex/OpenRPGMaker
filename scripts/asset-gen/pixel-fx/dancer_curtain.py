"""dancer_curtain: 천상의 무도회: 금빛 스포트라이트와 장밋빛 리본이 무대를 휘돌고 꽃비가 내린다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'dancer_curtain', 128, 12, 'screen'
PAL = pal(ROSE, pick(GOLDY, 'y1', 'y2', 'y3'), pick(PURP, 'v0', 'v1'), WHITE)
SX, SY = 64, 80


def draw(c, f):
    lvl = [.3, .55, .8, 1, 1, 1, 1, 1, 1, 1, .7, .4][f]
    shade(c, 64, 70, 50 * lvl + 14, 'v0', squash=.8)
    # 스포트라이트 두 줄기(점묘 원뿔)
    for sx in (30, 98):
        beam(c, sx, 2, SX + (sx < 64) * -6 + (sx > 64) * 6, 98, 2, 6 + 12 * lvl, 'y3', 'y2', phase=f * 4)
    # 무대 바닥 빛무리
    c.ring(SX, SY, 36 * lvl + 6, 'y2', 1, squash=.3)
    c.dring(SX, SY, 28 * lvl + 4, 'p2', squash=.3, parity=f)
    # 리본 셋이 무대를 휘돈다
    for k in range(3):
        pts = []
        for i in range(30):
            u = i / 29
            a = f * .55 + k * 2.1 + u * 4.2
            r_ = 14 + u * 34 * lvl
            pts.append((SX + math.cos(a) * r_, 66 + math.sin(a) * r_ * .5 - u * 14))
        ribbon(c, pts[:max(2, int(30 * lvl))], ('p0', 'p1', 'p2'), 3)
    # 꽃비
    r = rng(f + 5)
    for i in range(18):
        x = r.uniform(12, 116)
        y = (r.uniform(0, 110) + f * 9) % 118
        c.petal(x, y, r.uniform(0, 6.28), 4, 'p2' if i % 2 else 'p3', 'p4')
    for i in range(8):
        c.spark(20 + (i * 15 + f * 4) % 90, 16 + (i * 23) % 90, 2 + (i % 2), 'w', 'y3') if (i + f) % 2 == 0 else None


if __name__ == '__main__':
    run(globals())
