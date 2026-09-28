"""메테오 운석 — 32px 4칸 루프, 머리가 왼쪽 아래(하늘에서 적진으로). 불꼬리는 오른쪽 위. mage_meteor_blast 와 같은 FIRE+ROCK."""
import math
from lib_mage import *

KEY = 'mage_meteor_rock'; FRAME = 32; FRAMES = 4; ANCHOR = 'projectile'
PAL = Pal(F=FIRE, R=ROCK)
PEAK = [0, 2]
HX, HY = 11, 20
DX, DY = math.cos(-.5), math.sin(-.5)   # tail direction: up-right


def draw(c, f):
    F, R = PAL.F, PAL.R
    ph = f * math.pi / 2
    for k in range(7, 0, -1):
        d = k * 2.8
        w = math.sin(ph + k * 1.1) * (.4 + k * .25)
        x = HX + DX * d - DY * w; y = HY + DY * d + DX * w
        r = 7.2 - k * .8
        c.glow(x, y, r, [F[2], F[3], F[4], F[5]][:max(1, 4 - k // 2)])
    for k in range(4):
        d = 10 + ((k * 7 + f * 4) % 16)
        x = HX + DX * d + (k - 1.5) * 2; y = HY + DY * d + (k % 2) * 3 - 1
        c.px(x, y, F[6] if k % 2 else F[4])
    # heat sheath around the leading face
    c.disc(HX - 1, HY + 1, 7, F[3]); c.disc(HX - 2, HY + 1, 6, F[5]); c.disc(HX - 2, HY + 1, 4, F[6])
    # the rock: dark body, lit crescent on the trailing (upper-right) side, one rotating crater
    c.disc(HX + 1, HY - 1, 5, R[0])
    c.disc(HX + 1, HY - 1, 4, R[1])
    c.arc(HX + 1, HY - 1, 3, 260, 20, R[2], 1)
    x, y = orbit(HX + 1, HY - 1, 2, ph + .8)
    c.px(x, y, R[0])
    c.arc(HX + 1, HY - 1, 5, 110, 250, F[6], 1)
    c.arc(HX + 1, HY - 1, 5, 250, 290, F[4], 1)


if __name__ == '__main__':
    make(KEY)

