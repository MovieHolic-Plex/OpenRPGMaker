"""월식의 연회(화면 층) — 128px 12칸. 보라 하늘에 큰 달이 떠오르고 → 검은 그림자가 달을 먹어 월식(붉은 코로나 고리)이 되며 거대한 오망성 마법진이 달 둘레에 그려짐, 빛살 → 빗자루 탄 마녀 실루엣들과 박쥐가 달 앞을 원을 그리며 돌고 독녹색·보라 불꽃이 비처럼 왼쪽 적진으로 쏟아진 뒤 달이 가라앉음. witch_sabbath_hit 와 같은 HEX·TOXIC·BLOOD 팔레트."""
import math
from lib_druid import *

KEY = 'witch_sabbath_sky'; FRAME = 128; FRAMES = 12; ANCHOR = 'screen'
PAL = Pal(H=HEX, T=TOXIC[1:5], R=BLOOD[1:4], M=MOON[3:4])
PEAK = [3, 5, 9]
_r = rng(KEY)
MX, MY = 64, 40
STARS = [(_r.randint(2, 125), _r.randint(2, 76)) for _ in range(34)]
FLYERS = [(k * math.tau / 5, _r.uniform(.9, 1.1), k % 2) for k in range(5)]
RAIN = [(_r.uniform(20, 180), _r.uniform(-50, 40), _r.randint(0, 2), _r.randint(0, 3)) for _ in range(26)]


def witch(c, x, y, s, col, eye):
    """Broom-riding witch silhouette facing left: hat, cloak, broom with bristles."""
    c.line([(x - 10 * s, y + 3 * s), (x + 10 * s, y + 1 * s)], col, 2)
    c.poly([(x + 9 * s, y - 1 * s), (x + 15 * s, y - 2 * s), (x + 15 * s, y + 5 * s), (x + 9 * s, y + 3 * s)], col)
    c.poly([(x - 3 * s, y + 2 * s), (x - 1 * s, y - 6 * s), (x + 4 * s, y - 6 * s), (x + 7 * s, y + 2 * s)], col)   # cloak
    c.disc(x + 1 * s, y - 8 * s, 2.5 * s, col)
    c.poly([(x - 4 * s, y - 9 * s), (x + 6 * s, y - 9 * s), (x + 4 * s, y - 16 * s), (x + 8 * s, y - 19 * s), (x + 1 * s, y - 13 * s)], col)   # hat
    c.px(x - 1 * s, y - 8 * s, eye)


def sky(c, h, f):
    H = PAL.H
    if h <= 0: return
    c.dither(lambda cc: cc.disc(64, -8, 78, H[2], h + 6), f)
    c.disc(64, -8, 74, H[2], h)
    c.disc(64, -8, 66, H[1], h * .86)
    c.disc(64, -8, 54, H[0], h * .7)
    for x, y in STARS:
        if ((x - 64) / 66) ** 2 + ((y + 8) / (h * .86 + .1)) ** 2 < .85: c.px(x, y, H[4] if (x * 3 + f) % 7 else PAL.M[0])


def draw(c, f):
    H, T, R, M = PAL.H, PAL.T, PAL.R, PAL.M
    h = [36, 60, 76, 84, 86, 86, 86, 86, 84, 76, 58, 34][f]
    sky(c, h, f)
    my = MY + [22, 10, 0, 0, 0, 0, 0, 0, 0, 2, 6, 10][f]
    ecl = [0, 0, .35, .8, 1, 1, 1, 1, 1, 1, 1, 1][f]
    if f >= 10:   # the eclipsed moon sinks into the closing sky as a dithered afterglow ring
        u = f - 10
        c.dither(lambda cc: (cc.ring(MX, my, 20 - u * 4, R[1], 2), cc.ring(MX, my, 24 - u * 4, H[3], 1)), f)
        if u == 0: rays(c, MX, my, 9, 22, 30, R[0], rot=.3)
        ecl = -1
    # corona + moon + eclipse shadow
    if ecl >= .8:
        rays(c, MX, my, 18, 21, 30 + (f % 2) * 4, R[1], rot=f * .08, alt=26)
        c.disc(MX, my, 22, R[0]); c.disc(MX, my, 20, R[2]); c.ring(MX, my, 22, R[1])
    if ecl >= 0:
        c.disc(MX, my, 18, M[0] if ecl < .8 else R[1]); c.disc(MX - 3, my - 3, 12, H[6] if ecl < .8 else R[2])
    if ecl > 0:
        c.disc(MX + 36 * (1 - ecl), my, 18 - (ecl >= 1) * 1, H[0])
        if ecl >= 1: c.px(MX - 6, my - 5, H[2]); c.px(MX + 4, my + 6, H[2])
    # pentagram circle around the moon
    if f >= 3 and f <= 10:
        u = min(1, (f - 2) / 2)
        pentagram(c, MX, my, 38, H[4] if f != 4 else T[3], ry=26, rot=-math.pi / 2 + f * .05, upto=u, w=1)
        if f == 4:
            c.ring(MX, my, 44, T[2], 2, 31)
            rays(c, MX, my, 10, 46, 70, T[2], rot=.2, ry=.7)
            for k in range(5): c.spark(*orbit(MX, my, 38, -math.pi / 2 + f * .05 + k * math.tau / 5, 26), 4, T[3], H[6], diag=True)
    # witches & bats circling in front of the moon
    if f >= 5 and f <= 10:
        for k, (a, s, kind) in enumerate(FLYERS):
            ang = a + f * .55
            x, y = orbit(MX, my + 4, 50 * s, ang, 22 * s)
            if kind == 0: witch(c, x - 1, y - 1, 1.3, H[4], T[3]); witch(c, x + 1, y, 1.3, H[3], T[3]); witch(c, x, y, 1.3, H[0], T[3])
            else: bat(c, x, y, 1.2, f + k, H[0], R[2], H[4])
            c.line([(x + 14, y + 2), (x + 26, y + 5)], H[3])
    # fire rain toward the enemy side
    if f >= 7:
        u = f - 7
        for x0, y0, kind, delay in RAIN:
            if u < delay * .5: continue
            v = u - delay * .5
            x = x0 - v * 20; y = y0 + 60 + v * 14
            if not (-6 < x < 134 and -6 < y < 134): continue
            head = T[3] if kind == 0 else H[5] if kind == 1 else R[2]
            tail = T[1] if kind == 0 else H[3] if kind == 1 else R[0]
            c.line([(x, y), (x + 9, y - 6)], tail, 2); c.line([(x, y), (x + 4, y - 3)], head)
            c.disc(x, y, 2, head); c.px(x, y, T[3] if kind else H[6])


# 감독 QA 2026-09-28: 화면 층(128px 칸 → 무대 256px 상자)이 칸 끝까지 칠해져 무대 한가운데 네모로 잘려 보였다.
# 칸에 내접한 타원 바깥을 디더로 걷어 둥글게 흩뜨린다(fx_edge.fade_oval, 새 색 없음·알파 0/255 유지).
from fx_edge import fade_oval  # noqa: E402

_draw_body = draw


def draw(c, f):
    _draw_body(c, f)
    fade_oval(c, band=0.3)


if __name__ == '__main__':
    make(KEY)

