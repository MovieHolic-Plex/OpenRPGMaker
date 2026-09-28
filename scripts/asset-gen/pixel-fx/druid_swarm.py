"""벌레 떼 — 64px 10칸. 좌우에서 독벌레 떼가 줄지어 날아들고 → 대상 둘레를 소용돌이치며 조여 독침 섬광이 연달아 터짐 → 초록 독 기운이 피어오르고 벌레가 흩어져 날아감."""
import math
from lib_druid import *

KEY = 'druid_swarm'; FRAME = 64; FRAMES = 10; ANCHOR = 'target'
PAL = Pal(L=LEAF[:6], B=BARK[:2], A=AMBER, T=TOXIC[2:5])
PEAK = [2, 5, 8]
_r = rng(KEY)
BUGS = [(_r.uniform(0, math.tau), _r.uniform(9, 17), _r.uniform(.7, 1.3), _r.randint(0, 2), _r.uniform(.5, .95)) for _ in range(26)]
STINGS = [(_r.uniform(-12, 12), _r.uniform(-16, 12)) for _ in range(12)]


def bug(c, x, y, f, k, big=False):
    L, B, A = PAL.L, PAL.B, PAL.A
    up = (f + k) % 2
    w = L[5] if up else L[4]
    c.px(x - 1, y - 1 - up, w); c.px(x + 1, y - 1 - up, w)
    if big: c.px(x - 2, y - 1 - up, w); c.px(x + 2, y - 1 - up, w)
    c.rect(x, y, x + 1, y, B[0]); c.px(x, y, A[1] if k % 3 else A[0])
    if big: c.px(x + 2, y, B[1])


def draw(c, f):
    L, A, T = PAL.L, PAL.A, PAL.T
    if f <= 2:   # two streams fly in from both sides along wavy paths
        t = (f + 1) / 3
        for k, (a, r, sp, kind, h) in enumerate(BUGS):
            side = -1 if k % 2 else 1
            d = (1 - t) * (24 + (k % 5) * 4) + r * t
            x = CX + side * d; y = CY - 6 + math.sin(k + d * .2) * 6 + (k % 7 - 3) * 2 * (1 - t * .5)
            c.px(x + side * 3, y, L[1]); c.px(x + side * 5, y + 1, L[0])
            bug(c, x, y, f, k, kind == 0)
        if f == 2: c.ring(CX, CY, 16, L[2], 1, 18)
        return
    if f <= 6:   # vortex tightens; stings flash
        t = f - 3
        rs = [1.1, .85, .7, .75][t]
        c.dither(lambda cc: cc.ring(CX, CY, 20 * rs + 2, T[0], 3, 24 * rs), f)
        for k in range(3):
            c.arc(CX, CY, (18 - k * 4) * rs, f * 60 + k * 110, f * 60 + k * 110 + 140, L[2 + k], 1, (22 - k * 4) * rs)
        for k, (a, r, sp, kind, h) in enumerate(BUGS):
            ang = a + f * sp * 1.3
            x, y = CX + math.cos(ang) * r * rs * 1.1, CY + math.sin(ang) * r * rs * 1.3
            tx, ty = CX + math.cos(ang - .5) * r * rs * 1.1, CY + math.sin(ang - .5) * r * rs * 1.3
            c.px(tx, ty, L[1])
            bug(c, x, y, f, k, kind == 0)
        n = [3, 6, 9, 5][t]
        for k, (x, y) in enumerate(STINGS[(t * 3) % 12:][:n] if t < 3 else STINGS[:n]):
            s = 3 if (k + t) % 3 == 0 else 2
            c.spark(CX + x, CY + y, s + (t == 2), T[1], PAL.L[5])
            if t == 2 and k % 3 == 0: c.spark(CX + x, CY + y, 5, T[2], L[5], diag=True)
        if t == 2:
            c.disc(CX, CY, 6, T[1]); c.disc(CX, CY, 4, T[2]); c.disc(CX, CY, 2, L[5])
        return
    u = f - 7   # 0..2 disperse: toxic puffs rise, bugs spiral out
    for k, (sx, sy) in enumerate(STINGS[:7]):
        x = CX + sx * 1.2 + math.sin(k * 2 + u) * 2; y = CY + sy * .8 - u * 6 - k % 3 * 2
        r = 2 + (k % 3) + u * .8
        fade(c, u >= 1 and k % 2 == 0 or u == 2, lambda cc, x=x, y=y, r=r: puff(cc, x, y, r, [T[0], T[1], T[2]]), k + f)
    for k, (a, r, sp, kind, h) in enumerate(BUGS):
        if u == 2 and k % 2: continue
        ang = a + f * sp * 1.3
        d = r + (u + 1) * 9 * h + u * u * 3
        x, y = CX + math.cos(ang) * d, CY + math.sin(ang) * d * .8 - u * 6
        bug(c, x, y, f, k, kind == 0)
    for x, y in STINGS[:4 - u]:
        c.px(CX + x, CY + y - u * 3, T[2])


if __name__ == '__main__':
    make(KEY)

