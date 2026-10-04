"""저주 — 64px 10칸. 보라 룬 입자가 대상 둘레를 돌며 모이고 → 몸 위에 오망성 문양이 그려지며 번쩍, 검보라 해골이 떠올라 방어 하락 화살표 → 저주 연기가 독녹색 불씨와 함께 가라앉음."""
import math
from lib_druid import *

KEY = 'witch_hex'; FRAME = 64; FRAMES = 10; ANCHOR = 'target'
PAL = Pal(H=HEX, T=TOXIC[2:5], I=IRON[:2])
PEAK = [3, 5, 8]
_r = rng(KEY)
RUNES = [(k * math.tau / 7, _r.randint(0, 2)) for k in range(7)]
EMBERS = [(_r.uniform(-20, 20), _r.uniform(0, 26), _r.randint(0, 2)) for _ in range(14)]


def rune(c, x, y, kind, col):
    if kind == 0: c.line([(x, y - 2), (x, y + 2)], col); c.line([(x - 1, y - 1), (x + 1, y + 1)], col)
    elif kind == 1: c.line([(x - 2, y + 2), (x, y - 2), (x + 2, y + 2)], col)
    else: c.ring(x, y, 2, col); c.px(x, y, col)


def draw(c, f):
    H, T, I = PAL.H, PAL.T, PAL.I
    if f <= 2:   # runes orbit inward
        r = [26, 20, 14][f]
        c.dither(lambda cc: cc.disc(CX, CY, r + 2, H[1], (r + 2) * .45), f)
        c.ring(CX, CY, r, H[3], 1, r * .45)
        for a, kind in RUNES:
            x, y = orbit(CX, CY, r, a + f * .7, r * .45)
            c.rect(x - 3, y - 3, x + 3, y + 3, H[1])
            rune(c, x, y, kind, H[5] if (f + kind) % 2 else H[4])
            tx, ty = orbit(CX, CY, r + 4, a + f * .7 - .3, (r + 4) * .45)
            c.px(tx, ty, H[3])
        c.glow(CX, CY - 2, 2 + f * 2, [H[3], H[4], H[5]])
        return
    if f <= 5:   # pentagram drawn over the body, flash
        u = [.5, 1, 1][f - 3]
        R = 20
        if f == 4:
            rays(c, CX, CY - 2, 10, 20, 31, H[4], rot=-math.pi / 2, alt=26)
            c.disc(CX, CY - 2, 24, H[2]); c.disc(CX, CY - 2, 19, H[3])
        pentagram(c, CX, CY - 2, R, H[1], w=3, upto=u)
        pts = pentagram(c, CX, CY - 2, R, H[5] if f == 4 else H[4], upto=u)
        if f == 3:   # the drawing pen: hot spark at the stroke tip, runes still circling
            a, b = pts[4], pts[1]
            c.spark(lerp(a[0], b[0], .5), lerp(a[1], b[1], .5), 4, H[5], H[6], diag=True)
            c.glow(CX, CY - 2, 7, [H[2], H[3], H[4], H[5]])
            for a0, kind in RUNES:
                x, y = orbit(CX, CY - 2, R + 6, a0 + 2.4, R + 6)
                rune(c, x, y, kind, H[4])
        if f == 4: c.disc(CX, CY - 2, 5, H[5]); c.disc(CX, CY - 2, 2, H[6])
        if f == 5:
            skull(c, CX, CY - 24, 2, H[2], H[0], H[0])
            c.px(CX - 2, CY - 25, T[2]); c.px(CX + 2, CY - 25, T[2])
            arrow_down(c, CX + 18, CY - 8, 10, T[1], H[0])
        return
    u = f - 6   # 0..3 curse settles as smoke + green embers
    fade(c, u >= 1, lambda cc: pentagram(cc, CX, CY - 2 + u * 2, 20 - u * 2, H[2 if u < 2 else 1], ry=(20 - u * 2) * (1 - u * .2)), f)
    if u <= 2: skull(c, CX, CY - 24 - u * 3, 2, H[2] if u < 2 else H[1], H[0], H[0] if u < 2 else None)
    if u <= 1: arrow_down(c, CX + 18, CY - 8 + u * 4, 10, T[1], H[0])
    for k in range(5):
        x = CX - 16 + k * 8; y = GY - 4 - (k % 2) * 4 - u * 2
        c.dither(lambda cc, x=x, y=y: puff(cc, x, y, 4 + u * .6, [H[1], H[2], I[1]]), k + f)
    for x, y, kind in EMBERS:
        yy = CY - 16 + y + u * 4
        if yy >= GY: continue
        c.px(CX + x, yy, T[kind])


if __name__ == '__main__':
    make(KEY)

