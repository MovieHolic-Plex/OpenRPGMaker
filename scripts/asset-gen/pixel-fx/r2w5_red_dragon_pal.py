"""새끼 화룡(red_dragon_pal) 이펙트 1종 — b5. 색: 붉은 비늘, 화산 주황·노랑, 검붉은 하늘.
화룡 각성(화산 하늘에 어미 용의 거대한 실루엣이 날개를 펴고 금빛 눈을 뜨며 불길을 쏟음)."""
from lib_r2w5 import *

P_AWK = Pal(K=['#140404', '#3a0a0a', '#6a1414'], R=['#952735', '#ca333c'], F=['#d4401c', '#f07a22', '#ffc040', '#fff2a0'], E=['#ffe070'], T=['#e8dcc8'])


@sheet('red_dragon_pal_awaken_sky', 128, 12, 'screen', P_AWK, peak=[3, 7, 10])
def red_dragon_pal_awaken_sky(c, f):
    K, R, F, E, T = P_AWK.K, P_AWK.R, P_AWK.F, P_AWK.E[0], P_AWK.T[0]
    c.rect(0, 0, 127, 127, K[0]); c.dither(lambda cc: cc.rect(0, 40 - f % 3 * 4, 127, 127, K[1]), f); c.rect(0, 80, 127, 127, K[1])
    # 화산 두 개
    for x0, h in ((10, 30), (90, 38)):
        c.poly([(x0 - 26, 128), (x0, 128 - h), (x0 + 8, 128 - h), (x0 + 34, 128)], K[2])
        LM.flame(c, x0 + 4, 128 - h, 8 + (f % 3) * 3, 4, [F[0], F[1], F[2]])
    # 어미 용 실루엣
    spread = [0, .2, .4, .6, .8, 1, 1, .95, 1, 1, .95, .9][f]
    cx, cy = 64, 58
    for sg in (-1, 1):
        tip = (cx + sg * (20 + 42 * spread), cy - 30 * spread - 6)
        fingers = [(cx + sg * (18 + 34 * spread), cy + 10), (cx + sg * (22 + 40 * spread), cy - 6), tip]
        pts = [(cx + sg * 8, cy - 8)] + [tip] + [(cx + sg * (16 + 30 * spread), cy + 2), fingers[0], (cx + sg * 10, cy + 12)]
        c.poly(pts, R[0])
        for q in fingers: c.line([(cx + sg * 8, cy - 8), q], K[2])
    c.disc(cx, cy + 10, 16, R[1], 22)
    c.disc(cx + 3, cy + 14, 9, F[0], 15)
    for k in range(5):
        y = cy + 2 + k * 6
        c.line([(cx - 2, y), (cx + 9, y)], F[1] if k % 2 else R[0])
    c.disc(cx, cy - 16, 11, R[1], 10)
    c.disc(cx - 3, cy - 19, 4, R[0], 3)
    for sg in (-1, 1):
        c.poly([(cx + sg * 5, cy - 24), (cx + sg * 12, cy - 38), (cx + sg * 9, cy - 22)], T)
    open_ = min(1, max(0, (f - 3) / 2))
    for sg in (-1, 1):
        c.rect(cx + sg * 5 - 2, cy - 18, cx + sg * 5 + 2, cy - 18 + round(open_ * 3), E if open_ else K[2])
    if f >= 7:     # 불길이 아래로 쏟아진다
        for k in range(9):
            t = ((f - 7) * .22 + k / 9) % 1
            x = cx + (k - 4) * 6 * t * 2
            y = cy - 4 + t * 60
            LM.flame(c, x, y, 10 * (1 - t) + 4, 3, [F[1], F[2], F[3]])
    for k in range(10):
        x = (k * 23 + f * 9) % 128; y = 120 - ((k * 31 + f * 11) % 100)
        c.px(x, y, F[2] if k % 2 else F[1])

