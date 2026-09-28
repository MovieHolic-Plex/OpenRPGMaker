"""생명 흡수(투사체 층) — 32px 4칸 루프. 붉은 생명 구슬(흰 코어·핏빛·검보라 가장자리)이 왼쪽 머리로 날고 뒤로 보라 나선 꼬리 두 가닥이 꼬임. witch_drain_beam 과 같은 BLOOD·HEX 팔레트."""
import math
from lib_druid import *

KEY = 'witch_drain_orb'; FRAME = 32; FRAMES = 4; ANCHOR = 'projectile'
PAL = Pal(H=HEX[:6], R=BLOOD, W=['#ffffff'])
PEAK = [0, 1, 2, 3]


def draw(c, f):
    H, R, W = PAL.H, PAL.R, PAL.W
    hx, hy = 10, 16
    # tapered comet body behind the orb
    c.poly([(hx, hy - 5), (hx + 20, hy - 1), (hx + 22, hy), (hx + 20, hy + 1), (hx, hy + 5)], H[1])
    c.poly([(hx, hy - 3), (hx + 14, hy - 1), (hx + 15, hy), (hx + 14, hy + 1), (hx, hy + 3)], R[0])
    for k in range(2):   # twin spiral tail
        pts = []
        for i in range(13):
            x = hx + 3 + i * 1.6
            y = hy + math.sin(i * math.pi / 4 - f * math.pi / 2 + k * math.pi) * (2 + i * .3)
            pts.append((x, y))
        c.line(pts[:8], H[4] if k == 0 else R[2])
        c.line(pts[7:], H[3] if k == 0 else R[1])
        c.px(*pts[2 + (f % 2) * 4], H[5] if k == 0 else R[3])
    c.disc(hx, hy, 6, H[1]); c.disc(hx, hy, 5, R[0]); c.disc(hx - 1, hy, 4, R[1]); c.disc(hx - 1, hy - 1, 2.5, R[2])
    c.rect(hx - 2, hy - 2, hx - 1, hy - 1, W[0]); c.px(hx - 1, hy, R[3])
    # pulsing spark ahead
    s = [1, 2, 3, 2][f]
    c.spark(hx - 7, hy, s, R[3] if f % 2 else H[5])
    c.px(hx + 1 + f, hy - 5 + (f % 2), H[4]); c.px(hx + 3 - f, hy + 5 - (f % 2), R[2])


if __name__ == '__main__':
    make(KEY)

