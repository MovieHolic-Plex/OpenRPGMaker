"""매직 미사일 탄 — 32px 4칸 루프. 머리(왼쪽)의 회전 빛 마름모 + 가늘어지는 혜성 꼬리와 분홍·하늘 불티. mage_missile_hit 와 같은 ARCANE 팔레트."""
import math
from lib_mage import *

KEY = 'mage_missile_orb'; FRAME = 32; FRAMES = 4; ANCHOR = 'projectile'
PAL = Pal(A=ARCANE)
PEAK = [0, 2]


def draw(c, f):
    A = PAL.A
    ph = f * math.pi / 2
    # tapered comet tail
    c.poly([(6, 16), (12, 11), (29, 15), (29, 17), (12, 21)], A[0])
    c.poly([(6, 16), (12, 12), (24, 15), (24, 17), (12, 20)], A[1])
    c.poly([(6, 16), (12, 13), (19, 16), (12, 19)], A[2])
    # two wisps curling off the tail (short, not a full helix)
    for s, col in ((-1, A[7]), (1, A[6])):
        wob = math.sin(ph + (0 if s < 0 else math.pi))
        c.line([(14, 16 + s * 3), (19, 16 + s * (4 + wob)), (23, 16 + s * (3 + wob * 2))], col)
    # trailing sparkles
    for k in range(3):
        x = 17 + ((k * 5 + f * 4) % 13); y = 16 + (k - 1) * 4 + (f % 2) * (1 if k else -1)
        c.px(x, y, [A[5], A[6], A[7]][(k + f) % 3])
    # spinning diamond head
    w = [5, 3, 5, 3][f]; h = [4, 5, 4, 5][f]
    c.poly([(9 - w, 16), (9, 16 - h), (9 + w, 16), (9, 16 + h)], A[3])
    c.poly([(9 - w + 2, 16), (9, 16 - h + 2), (9 + w - 2, 16), (9, 16 + h - 2)], A[4])
    c.rect(8, 15, 9, 16, A[5])
    c.spark(3 if f % 2 else 4, 16, 2 if f % 2 else 1, A[5])


if __name__ == '__main__':
    make(KEY)

