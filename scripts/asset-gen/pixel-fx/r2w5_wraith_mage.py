"""망령술사(wraith_mage) 이펙트 2종 — b5. 색: 영혼 청록·흰, 명계 남흑, 금 테 문양.
영혼 흡수(대상 몸에서 청록 영혼 가닥이 뽑혀 오른쪽 위로 빨려감) · 영혼 수확제(검은 하늘 한가운데 금 테 마법진이 돌고 사방의 영혼이 모여 터짐)."""
from lib_r2w5 import *

P_DRAIN = Pal(E=['#1a4a50', '#3aa0a0', '#7fe6d4', '#d8fff4'], K=['#101f28'], W=['#ffffff'])


@sheet('wraith_mage_drain', 64, 10, 'target', P_DRAIN, peak=[2, 5, 8])
def wraith_mage_drain(c, f):
    E, K, W = P_DRAIN.E, P_DRAIN.K[0], P_DRAIN.W[0]
    cy = CY - 4
    # 몸 둘레 어두운 고리가 조여 옴
    c.ring(CX, cy + 12, 16 - (f % 4), E[0], 1, 5)
    for k in range(5):
        base = (CX - 8 + k * 4, cy + 6 - (k % 2) * 6)
        t = min(1, max(0, (f - k * .4) / 6))
        pts = []
        for i in range(8):
            u = i / 7 * t
            x = lerp(base[0], 62, u) + math.sin(u * 8 + k + f * .6) * 3
            y = lerp(base[1], 2, u)
            pts.append((x, y))
        if len(pts) > 1:
            c.line(pts, E[1], 2); c.line(pts, E[2], 1)
            hx, hy = pts[-1]
            c.disc(hx, hy, 2.5, E[2]); c.px(hx - 1, hy - 1, E[3])
    if f <= 4:
        c.disc(CX, cy, 5 + f, E[0], 5 + f)
        c.disc(CX, cy, 3 + f * .5, E[2])
    if f >= 7:
        for k in range(5):
            a = k * 1.3 + f
            c.px(CX + math.cos(a) * (14 + f), cy + math.sin(a) * 10, W)


P_HARV = Pal(N=['#040810', '#0c1624', '#18263a'], Y=['#7a5a14', '#d8ad50', '#fff0a0'], E=['#1a4a50', '#3aa0a0', '#7fe6d4', '#ffffff'], V=['#3a2a4a'])


@sheet('wraith_mage_harvest_sky', 128, 12, 'screen', P_HARV, peak=[3, 7, 10])
def wraith_mage_harvest_sky(c, f):
    N, Y, E, V = P_HARV.N, P_HARV.Y, P_HARV.E, P_HARV.V[0]
    c.rect(0, 0, 127, 127, N[0]); c.dither(lambda cc: cc.rect(0, 40 - f % 3 * 4, 127, 127, N[1]), f); c.rect(0, 92, 127, 127, N[1])
    cx, cy = 64, 62
    rot = f * .18
    r = 36
    c.ring(cx, cy, r, Y[1], 2, r * .5)
    c.ring(cx, cy, r - 7, Y[0], 1, (r - 7) * .5)
    pentagram(c, cx, cy, r - 8, Y[1], ry=(r - 8) * .5, rot=rot - math.pi / 2, ring=False)
    for k in range(8):
        a = rot + k * math.tau / 8
        c.rect(cx + math.cos(a) * r - 1, cy + math.sin(a) * r * .5 - 1, cx + math.cos(a) * r + 1, cy + math.sin(a) * r * .5 + 1, Y[2])
    # 영혼이 사방에서 모인다
    t = min(1, f / 8)
    for k in range(12):
        a = k * math.tau / 12 + .3
        d = 70 * (1 - t) + 6
        x, y = cx + math.cos(a) * d, cy - 10 + math.sin(a) * d * .7
        c.disc(x, y, 3, E[1]); c.disc(x - 1, y - 1, 1.5, E[2])
        c.line([(x, y), (x + math.cos(a) * 8, y + math.sin(a) * 6)], E[0])
    if f >= 8:
        rr = (f - 7) * 12
        c.disc(cx, cy - 10, rr, E[1], rr * .8); c.disc(cx, cy - 10, rr * .6, E[2], rr * .5); c.disc(cx, cy - 10, rr * .3, E[3], rr * .25)
    c.dither(lambda cc: cc.rect(0, 100, 127, 127, V), f)

