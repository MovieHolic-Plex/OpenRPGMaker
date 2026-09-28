"""그라비티 — 64px 12칸. 어둠 입자 나선 수렴·중력구 → 짓누름(압력 고리 수축, 하강 줄) → 붕괴 섬광과 흩어지는 잔광."""
import math, random
from lib_mage import *

KEY = 'mage_gravity'; FRAME = 64; FRAMES = 12; ANCHOR = 'target'
PAL = Pal(V=VOID)
PEAK = [3, 6, 9]
CX, CY = 32, 40
_r = random.Random(3)
MOTES = [(_r.uniform(0, math.tau), _r.uniform(18, 30)) for _ in range(16)]
SPARKS = [(k * math.tau / 12 + _r.uniform(-.2, .2), _r.uniform(3, 5)) for k in range(12)]


def sphere(c, r, squash=1.0, hot=False):
    V = PAL.V
    ry = r * squash
    c.disc(CX, CY, r + 2, V[4], ry + 2)
    c.disc(CX, CY, r + 1, V[3], ry + 1)
    c.disc(CX, CY, r, V[1], ry)
    c.disc(CX, CY, r * .75, V[0], ry * .75)
    c.arc(CX, CY, r - 1, 200, 290, V[5 if not hot else 6], 1, ry - 1)   # lensing rim highlight
    c.px(CX - r * .45, CY - ry * .55, V[6])


def draw(c, f):
    V = PAL.V
    if f <= 3:  # spiral in
        t = (f + 1) / 4
        for a, r0 in MOTES:
            ang = a + t * 2.4; r = r0 * (1 - t * .8)
            x, y = orbit(CX, CY, r, ang, r * .8)
            tx, ty = orbit(CX, CY, r + 3, ang - .45, (r + 3) * .8)
            c.line([(tx, ty), (x, y)], V[3]); c.px(x, y, V[5])
        sphere(c, 2 + f * 3)
        if f == 3: c.ring(CX, CY, 17, V[5], 1)
        return
    if f <= 8:  # crush: rings contract, down-pressure lines, sphere flattens
        t = f - 4
        for k in range(3):
            rr = 30 - ((t * 5 + k * 10) % 26)
            c.ring(CX, CY, rr, V[4 if k else 5], 1, rr * .8)
        for k in range(7):
            x = CX - 21 + k * 7; y = (t * 9 + k * 11) % 30 + 2
            c.line([(x, y), (x, y + 7)], V[3]); c.px(x, y + 7, V[5])
            c.line([(x - 2, y + 5), (x, y + 8), (x + 2, y + 5)], V[4])
        # ground crater pressure
        c.disc(CX, 55, 18 + t, V[2], 3); c.arc(CX, 55, 18 + t, 0, 180, V[4], 1, 3)
        sphere(c, 12 + (t % 2), squash=1 - t * .06, hot=(t % 2 == 0))
        return
    if f == 9:  # implosion flash
        for k in range(8):
            a = k * math.pi / 4; x1, y1 = orbit(CX, CY, 28, a)
            c.line([(CX, CY), (x1, y1)], V[5], 2)
        c.disc(CX, CY, 12, V[6], 9); c.disc(CX, CY, 8, V[7], 6)
        return
    t = f - 9
    for a, v in SPARKS:
        d = v * t * 3 + 4
        x, y = orbit(CX, CY, d, a, d * .8)
        tx, ty = orbit(CX, CY, d - 4, a, (d - 4) * .8)
        c.line([(tx, ty), (x, y)], V[5] if t == 1 else V[4])
        c.px(x, y, V[6] if t == 1 else V[5])
    c.disc(CX, CY, 3 - t, V[1] if t == 2 else V[0])
    c.dither(lambda cc: cc.ring(CX, CY, 12 + t * 7, V[3], 2, (12 + t * 7) * .8), t)


if __name__ == '__main__':
    make(KEY)

