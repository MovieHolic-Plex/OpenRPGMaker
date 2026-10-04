"""박쥐 떼 — 64px 10칸(적 전체). 위쪽 어둠에서 붉은 눈이 번뜩이며 → 박쥐 떼가 쏟아져 내려 대상을 덮치고 물기 섬광(보라·핏빛 이빨 자국) 연타 → 박쥐가 흩어져 날아오르며 보라 깃털 같은 그림자 입자가 남음."""
import math
from lib_druid import *

KEY = 'witch_bat_swarm'; FRAME = 64; FRAMES = 10; ANCHOR = 'allTargets'
PAL = Pal(H=HEX, R=BLOOD, T=TOXIC[3:4])
PEAK = [2, 4, 7]
_r = rng(KEY)
BATS = [(_r.uniform(-26, 26), _r.uniform(-8, 10), _r.uniform(.8, 1.3), _r.randint(0, 2), _r.uniform(0, math.tau)) for _ in range(12)]
BITES = [(_r.uniform(-12, 12), _r.uniform(-14, 10)) for _ in range(8)]


def bite(c, x, y, big):
    H, R = PAL.H, PAL.R
    s = 2 if big else 1
    for sg in (-1, 1):
        c.poly([(x + sg * 2 * s - 1, y - 3 * s), (x + sg * 2 * s + 1, y - 3 * s), (x + sg * 2 * s, y + 1 * s)], R[2])
        c.poly([(x + sg * 2 * s - 1, y + 5 * s), (x + sg * 2 * s + 1, y + 5 * s), (x + sg * 2 * s, y + 1 * s + 1)], R[2])
    c.spark(x, y + s, 2 + s, H[5], H[6])


def draw(c, f):
    H, R, T = PAL.H, PAL.R, PAL.T
    if f <= 1:   # dark cloud with glowing eyes above
        c.dither(lambda cc: cc.disc(CX, 8, 30, H[1], 10 + f * 4), f)
        c.disc(CX, 4, 26, H[0], 8 + f * 3); c.disc(CX, 2, 18, H[1], 6 + f * 2)
        for k, (x, y, s, ph, a) in enumerate(BATS):
            ex, ey = CX + x * .9, 4 + (k % 4) * 3 + f * 2
            c.px(ex - 1, ey, R[1] if (k + f) % 2 else R[2]); c.px(ex + 1, ey, R[1] if (k + f) % 2 else R[2])
        if f == 1:
            for k, (x, y, s, ph, a) in enumerate(BATS[:5]): bat(c, CX + x, 14 + y * .5, .8, ph + f, H[1], R[1])
        return
    if f <= 6:   # swarm pours in, circles and bites
        t = f - 2
        conv = [.35, .75, 1, 1, .9][t]
        for k, (x, y, s, ph, a) in enumerate(BATS):
            ang = a + f * .8 * s
            ox = CX + math.cos(ang) * 20 * s * conv + x * (1 - conv)
            oy = lerp(8 + y, CY + math.sin(ang) * 14 * s, conv)
            c.px(ox + 3, oy - 2, H[2])
            bat(c, ox, oy, 1.0 if k % 3 else 1.3, ph + f, H[0] if k % 2 else H[1], R[2], H[3] if k % 3 == 0 else None)
        if t >= 1:
            n = [0, 3, 5, 4, 2][t]
            for k, (x, y) in enumerate(BITES[(t * 2) % 8:][:n] if t != 2 else BITES[:n]):
                bite(c, CX + x, CY + y, (k + t) % 3 == 0)
        if t == 2:
            c.disc(CX, CY, 9, H[3]); c.disc(CX, CY, 6, R[1]); c.disc(CX, CY, 3, R[3])
            rays(c, CX, CY, 8, 12, 26, H[4], rot=.4)
        return
    u = f - 7   # 0..2 bats scatter up and out, shadow motes remain
    for k, (x, y, s, ph, a) in enumerate(BATS):
        if u == 2 and k % 2: continue
        sg = 1 if x > 0 else -1
        ox = CX + x * .6 + sg * (u + 1) * 9 * s; oy = CY - 4 - (u + 1) * 10 * s + y * .5
        bat(c, ox, oy, .9 - u * .15, ph + f, H[1] if u < 2 else H[2], R[1])
    for k, (x, y) in enumerate(BITES):
        yy = CY + y + u * 5
        if (k + u) % 3 == 2: continue
        c.dither(lambda cc, x=x, yy=yy: cc.disc(CX + x, yy, 2 + (k % 2), H[2]), k + f)
        c.px(CX + x, yy, H[4] if k % 2 else R[1])


if __name__ == '__main__':
    make(KEY)

