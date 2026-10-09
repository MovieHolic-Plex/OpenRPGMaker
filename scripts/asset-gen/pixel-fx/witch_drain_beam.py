"""생명 흡수(대상 층) — 64px 10칸. 대상 몸에 보라 저주 고리가 조여 → 심장 부근에서 붉은 생명 구슬과 핏빛 실타래가 뜯겨 나오며 섬광 → 구슬이 오른쪽(시전자 쪽)으로 흘러 나가고 보라 잔광이 수축. witch_drain_orb 와 같은 BLOOD·HEX 팔레트."""
import math
from lib_druid import *

KEY = 'witch_drain_beam'; FRAME = 64; FRAMES = 10; ANCHOR = 'target'
PAL = Pal(H=HEX, R=BLOOD, T=TOXIC[3:4])
PEAK = [3, 5, 7]
_r = rng(KEY)
STRANDS = [(_r.uniform(-1.1, 1.1), _r.uniform(.6, 1.2)) for _ in range(9)]
MOTES = [(_r.uniform(0, math.tau), _r.uniform(6, 16)) for _ in range(12)]


def heart(c, x, y, s, col, rim=None):
    if rim is not None:
        c.disc(x - 2 * s, y - 1 * s, 2.3 * s + 1, rim); c.disc(x + 2 * s, y - 1 * s, 2.3 * s + 1, rim)
        c.poly([(x - 4.3 * s - 1, y - .5 * s), (x + 4.3 * s + 1, y - .5 * s), (x, y + 4.5 * s + 1)], rim)
    c.disc(x - 2 * s, y - 1 * s, 2.3 * s, col); c.disc(x + 2 * s, y - 1 * s, 2.3 * s, col)
    c.poly([(x - 4.3 * s, y - .5 * s), (x + 4.3 * s, y - .5 * s), (x, y + 4.5 * s)], col)


def draw(c, f):
    H, R, T = PAL.H, PAL.R, PAL.T
    hy = CY - 4
    if f <= 2:   # curse rings tighten on the body
        for k in range(3):
            r = [24, 18, 13][f] + k * 5
            c.ring(CX, hy + k * 2, r, H[2 + (k == 0)], 1 + (k == 0), r * .35)
        for a, r in MOTES:
            x, y = orbit(CX, hy, r + 14 - f * 5, a - f * .8, (r + 14 - f * 5) * .7)
            c.px(x, y, H[5] if f else H[4])
        c.glow(CX, hy, 2 + f * 2, [R[0], R[1], R[2]])
        return
    if f <= 4:   # life torn out: heart + strands, flash
        if f == 3:
            rays(c, CX, hy, 12, 8, 30, R[2], alt=20)
            c.disc(CX, hy, 16, H[3]); c.disc(CX, hy, 12, R[1])
        s = [1.6, 1.3][f - 3]
        for dy, ln in STRANDS:
            pts = [(CX, hy)] + [(CX + ln * 8 * i, hy + dy * i * 4 + math.sin(i + f) * 2) for i in range(1, 5)]
            c.line(pts, R[1], 2); c.line(pts, R[2])
        heart(c, CX + (f - 3) * 5, hy, s, R[2], R[0])
        c.px(CX - 2 + (f - 3) * 5, hy - 2, R[3]); c.px(CX - 3 + (f - 3) * 5, hy - 1, R[3])
        c.ring(CX, hy, 20 + (f - 3) * 5, H[4], 1, 14 + (f - 3) * 4)
        return
    t = f - 5   # 0..4 orbs stream to the right edge; curse ring collapses
    for k, (dy, ln) in enumerate(STRANDS):
        if t >= 3 and k % 2: continue
        x0 = CX + 6 + t * 5; pts = [(x0 + i * 7, hy + dy * (4 - i) * 2 + math.sin(i + f + k) * 2) for i in range(5)]
        fade(c, t >= 2, lambda cc, pts=pts: (cc.line(pts, R[0], 2), cc.line(pts, R[1])), f + k)
    for k in range(4):
        x = CX + 8 + t * 6 + k * 9 + (f % 2) * 2
        if x > 62: continue
        y = hy + math.sin(k * 1.7 + f) * 5
        c.disc(x, y, 3 - k * .4, R[1]); c.disc(x - 1, y - 1, 1.5, R[2]); c.px(x - 1, y - 1, R[3])
    r = [16, 12, 9, 6, 3][t]
    c.ring(CX, hy, r, H[3] if t < 3 else H[2], 1, r * .6)
    if t <= 2: c.disc(CX, hy, 3 - t, H[5])
    for a, rr in MOTES[:8 - t]:
        x, y = orbit(CX, hy, rr * (1 - t * .15), a + t, rr * .7)
        c.px(x, y, H[4] if (f + round(a * 3)) % 2 else T[0])


if __name__ == '__main__':
    make(KEY)

