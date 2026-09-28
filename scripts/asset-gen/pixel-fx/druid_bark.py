"""수피 — 64px 8칸(아군 전체). 흙이 튀며 나무껍질 조각이 날아와 몸 둘레 타원에 맞물리고 → 껍질 갑옷 고리가 잠기며 은빛 광택이 쓸고 잎이 터짐 → 갈색 방패 문양이 떠올랐다 흩어지며 이끼 고리가 발밑으로 가라앉음. 몸 가운데는 비워 배틀러가 보인다."""
import math
from lib_druid import *

KEY = 'druid_bark'; FRAME = 64; FRAMES = 8; ANCHOR = 'allAllies'
PAL = Pal(B=BARK, L=LEAF[1:6], M=MOON[2:5])
PEAK = [2, 3, 5]
_r = rng(KEY)
N = 12
PLATES = [(k * math.tau / N + math.pi / 2, _r.uniform(-.25, .25)) for k in range(N)]   # rest angle, spin
LEAVES = [(_r.uniform(-math.pi, 0), _r.uniform(3, 5.5), _r.randint(3, 5)) for _ in range(12)]
RX, RY, OY = 17, 22, CY - 4


def plate(c, x, y, ang, lit, shine):
    """Bark scale 8x10 tilted along the ring tangent: dark rim, grain lines, lit edge."""
    B, M = PAL.B, PAL.M
    tx, ty = math.cos(ang), math.sin(ang)
    nx, ny = -ty, tx
    def q(s, t): return (x + tx * s + nx * t, y + ty * s + ny * t)
    c.poly([q(-4, -4), q(0, -5), q(4, -4), q(4, 3), q(0, 5), q(-4, 3)], B[0])
    c.poly([q(-3, -3), q(0, -4), q(3, -3), q(3, 2), q(0, 4), q(-3, 2)], B[2 if lit else 1])
    c.line([q(-1, -3), q(-1, 3)], B[3 if lit else 2])
    c.line([q(2, -2), q(2, 2)], B[1] if lit else B[0])
    if shine: c.line([q(-3, 1), q(3, -2)], M[2]); c.px(*q(-2, 1), M[1])


def ring_pos(k, f):
    a0, sp = PLATES[k]
    fly = [1, .45, 0, 0, 0, 0, 0, 0][f]
    a = a0 + sp * fly * 3
    x = CX + math.cos(a) * RX * (1 + fly * .9)
    y = OY + math.sin(a) * RY * (1 + fly * .5) + fly * 14
    return x, y, a + math.pi / 2, a


def draw(c, f):
    B, L, M = PAL.B, PAL.L, PAL.M
    if f <= 4:
        c.disc(CX, GY, 20 + f, B[1], 3 + f * .3); c.disc(CX, GY, 13, B[0], 2)
    if f <= 1:   # dirt spray as plates are torn from the ground
        for k in range(10):
            a = -math.pi * (k + .5) / 10
            x, y = orbit(CX, GY, 10 + f * 10, a, 6 + f * 8)
            c.rect(x, y, x + 1, y + 1, B[2 + k % 2])
            if k % 2: c.px(x, y + 3, L[1])
    sweep = [None, None, None, -1.2, .3, 1.8, None, None][f]
    if f <= 6:
        def ring(cc):
            if 2 <= f <= 5:   # moss binding cord under the scales
                cc.ring(CX, OY, RX + 1, L[0], 3, RY + 1)
                cc.ring(CX, OY, RX + 1, L[2], 1, RY + 1)
            for k in sorted(range(N), key=lambda k: math.sin(PLATES[k][0])):
                x, y, tang, a = ring_pos(k, f)
                shine = sweep is not None and abs(math.cos(a) * RX - sweep * 12) < 5
                plate(cc, x, y, tang, math.cos(a) < .2, shine)
        fade(c, f == 6, ring, f)
    if f == 2:   # lock flash: sparks at every seam
        for k in range(N):
            _, _, _, a = ring_pos(k, f)
            x2, y2 = orbit(CX, OY, RX + 5, a + math.pi / N, RY + 5)
            c.spark(x2, y2, 2 if k % 2 else 3, M[1], M[2])
    if f == 3:
        rays(c, CX, OY, 12, RX + 8, RX + 16, M[1], rot=.26, ry=RY / RX, alt=RX + 12)
        c.spark(CX - 12, OY - 14, 5, M[1], M[2], diag=True)
    if f >= 3:   # shield crest rises + leaves burst
        u = f - 3
        y = OY - RY - 6 - u * 2 + 6
        def crest(cc):
            cc.poly([(CX - 7, y - 6), (CX + 6, y - 6), (CX + 6, y + 1), (CX, y + 7), (CX - 1, y + 7), (CX - 7, y + 1)], B[0])
            cc.poly([(CX - 5, y - 4), (CX + 4, y - 4), (CX + 4, y + 1), (CX, y + 5), (CX - 1, y + 5), (CX - 5, y + 1)], B[3])
            cc.line([(CX - 5, y - 4), (CX + 4, y - 4)], M[1])
            leaf(cc, CX, y + 3, -math.pi / 2, 7, L[3], L[1])
            if u == 0: cc.ring(CX, y, 11, M[2], 1); cc.ring(CX, y, 13, M[0], 1)
        fade(c, u >= 3, crest, f)
        if u <= 3:
            for k, (a, v, ln) in enumerate(LEAVES):
                x, y2 = orbit(CX, OY, v * (4 + u * 3) + 8, a)
                y2 += u * u * 3
                if u == 3 and k % 2: continue
                leaf(c, x, y2, a + u, ln, L[3 if k % 2 else 2], L[0])
    if f >= 6:   # moss afterglow ring sinking to the feet
        u = f - 6
        c.dither(lambda cc: cc.ring(CX, GY - 12 + u * 8, 18 + u * 4, L[2], 2, 5 + u), f)
        for k in range(8): c.px(CX - 18 + k * 5, GY - 1 - (k % 2) - u, B[2] if k % 2 else L[3])


if __name__ == '__main__':
    make(KEY)

