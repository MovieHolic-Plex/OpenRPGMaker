"""세계수의 분노(적 전체 층) — 64px 10칸. 발밑이 초록으로 갈라지고 → 거대한 뿌리가 솟아 올랐다 내려찍으며 초록 섬광·흙 충격파·나무 파편 → 가시 뿌리 더미가 남아 잎과 흙먼지가 가라앉음. druid_world_tree 와 같은 LEAF·BARK 팔레트."""
import math
from lib_druid import *

KEY = 'druid_tree_hit'; FRAME = 64; FRAMES = 10; ANCHOR = 'allTargets'
PAL = Pal(L=LEAF, B=BARK, M=MOON[3:5], P=BLOOM[1:2])
PEAK = [3, 5, 8]
_r = rng(KEY)
CHIPS = [(_r.uniform(-math.pi, 0), _r.uniform(3, 6.5), _r.randint(0, 2)) for _ in range(20)]
LEAVES = [(_r.uniform(-28, 28), _r.uniform(0, 30)) for _ in range(10)]


def big_root(c, h, x_top, wither=False):
    B, L = PAL.B, PAL.L
    pts = [(CX + 18, GY + 2), (CX + 20, GY - h * .4), (lerp(CX + 16, x_top, .7), GY - h * .9), (x_top, GY - h)]
    vine(c, pts, 11, 4, B[0], B[1] if wither else B[2], B[3])
    for i, (x, y) in enumerate(pts[1:]):
        thorn(c, x - 5, y, math.pi + .4, 5, B[3], L[4] if not wither else None)
        thorn(c, x + 5, y, -.3, 4, B[2])


def draw(c, f):
    L, B, M, P = PAL.L, PAL.B, PAL.M, PAL.P
    if f <= 1:
        c.disc(CX, GY + 1, 16 + f * 8, L[1], 3 + f); c.disc(CX, GY + 1, 8 + f * 5, L[2], 2)
        cr = [(CX - 16 - f * 6, GY), (CX - 6, GY + 2), (CX + 2, GY - 1), (CX + 10, GY + 2), (CX + 18 + f * 6, GY)]
        c.line(cr, L[4]); c.line(cr[1:4], L[6])
        rays(c, CX, GY, 7, 4, 14 + f * 8, L[3], rot=math.pi, ry=.9)
        return
    if f == 2:   # root rears up high
        c.disc(CX, GY + 1, 26, B[0], 5)
        big_root(c, 50, CX + 4)
        c.spark(CX + 4, GY - 50, 4, L[4], L[6])
        return
    if f == 3:   # slams down: flash on the target
        rays(c, CX, CY, 14, 8, 31, L[4], alt=22)
        c.disc(CX, CY, 17, L[3]); c.disc(CX, CY, 13, L[4]); c.disc(CX, CY, 8, L[5]); c.disc(CX, CY, 4, L[6])
        big_root(c, 32, CX - 18)
        return
    t = f - 4   # 0..5
    if t <= 2:   # earth shock ring + debris
        rr = [22, 28, 31][t]
        fade(c, t == 2, lambda cc: (cc.ring(CX, GY, rr, B[3] if t == 0 else B[2], 3, rr * .28), cc.ring(CX, GY, rr - 3, L[4], 1, (rr - 3) * .28)), f)
    c.disc(CX, GY + 1, 24, B[0], 4)
    if t <= 3: big_root(c, 30 - t * 2, CX - 18 + t * 2, wither=t >= 2)
    else: c.dither(lambda cc: big_root(cc, [0, 0, 0, 0, 18, 8][t], CX - 6 + t * 3, wither=True), f)
    for k, (a, v, kind) in enumerate(CHIPS):
        e = t + 1
        x = CX + math.cos(a) * v * e * 1.7; y = CY + 6 + math.sin(a) * v * e * 1.3 + e * e * 1.1
        if y > GY + 2 or not (0 <= x < 64): continue
        if kind == 0: c.rect(x, y, x + 1, y + 1, B[3 if e < 3 else 2])
        elif kind == 1: leaf(c, x, y, a + e, 4, L[3], L[1])
        elif e < 4 or (k + f) % 2: c.px(x, y, L[5] if e < 3 else M[0])
    if t >= 2:
        for k, (x, y) in enumerate(LEAVES):
            yy = CY - 24 + y + (t - 2) * 5
            if yy >= GY: continue
            if k % 3 == 0: c.rect(CX + x, yy, CX + x + 1, yy, P[0])
            else: leaf(c, CX + x + math.sin(k + t) * 2, yy, k + t, 4, L[3 if k % 2 else 2], L[0])
    if t >= 1:
        for k in range(4):
            sd = -1 if k % 2 else 1
            x = CX + sd * (16 + t * 2 + (k // 2) * 6); y = GY - 3 - (k // 2) * 3
            c.dither(lambda cc, x=x, y=y: puff(cc, x, y, 3 + t * .5, [B[1], B[2]]), k + f)


if __name__ == '__main__':
    make(KEY)

