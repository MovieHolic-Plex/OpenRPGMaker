"""업화(flame_spirit) 이펙트 1종 — b5. 색: 진홍·주황·노랑·흰 불, 검붉은 하늘.
업화 폭발(가운데 불꽃이 태양처럼 부풀어 흰 핵을 드러낸 뒤 사방으로 불꽃 혀를 뿜으며 터짐)."""
from lib_r2w5 import *

P_NOVA = Pal(K=['#140204', '#3a0406', '#6b0000'], F=['#a50000', '#d30000', '#f45858', '#ff9a2a', '#ffe070', '#fff6d0'], W=['#ffffff'], E=['#151617'])


@sheet('flame_spirit_nova_sky', 128, 12, 'screen', P_NOVA, peak=[3, 7, 9])
def flame_spirit_nova_sky(c, f):
    K, F, W, E = P_NOVA.K, P_NOVA.F, P_NOVA.W[0], P_NOVA.E[0]
    c.rect(0, 0, 127, 127, K[0]); c.dither(lambda cc: cc.rect(0, 0, 127, 127, K[1]), f)
    g = [10, 16, 22, 28, 34, 40, 30, 20, 12, 8, 6, 4][f]
    cx, cy = 64, 64
    # 불꽃 혀(방사)
    n = 14
    for k in range(n):
        a = k * math.tau / n + f * .12
        ln = g * (1.3 + .3 * math.sin(k * 2.3 + f)) + (0 if f < 6 else (f - 5) * 12)
        w = .16
        col = F[1] if k % 2 else F[3]
        c.poly([(cx + math.cos(a - w) * g * .6, cy + math.sin(a - w) * g * .6), (cx + math.cos(a) * ln, cy + math.sin(a) * ln), (cx + math.cos(a + w) * g * .6, cy + math.sin(a + w) * g * .6)], col)
    for i, col in enumerate((F[0], F[2], F[3], F[4], F[5])):
        r = g * (1 - i * .18)
        c.disc(cx, cy, r, col)
    if f <= 5:     # 얼굴 구멍: 커지며 흰 핵으로 바뀜
        c.disc(cx + 4, cy, max(2, 8 - f), E, max(2, 7 - f))
        if f < 4: c.rect(cx + 1, cy - 1, cx + 2, cy, F[2]); c.rect(cx + 5, cy - 1, cx + 6, cy, F[2])
    else:
        c.disc(cx, cy, g * .3, W)
    if f >= 6:
        rr = (f - 5) * 14
        c.ring(cx, cy, rr, F[4], 3, rr * .9); c.ring(cx, cy, rr + 8, F[2], 1, (rr + 8) * .9)

