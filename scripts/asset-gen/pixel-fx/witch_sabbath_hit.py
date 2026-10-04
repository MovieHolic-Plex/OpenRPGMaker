"""월식의 연회(적 전체 층) — 64px 10칸. 독녹색·보라 불꽃비가 사선으로 내리꽂히고 → 발밑에 오망성이 번쩍이며 보라 불꽃 기둥이 솟고 핏빛 섬광 → 녹색 도깨비불이 몸 둘레를 돌다 사그라지고 보라 연기가 남음. witch_sabbath_sky 와 같은 HEX·TOXIC·BLOOD 팔레트."""
import math
from lib_druid import *

KEY = 'witch_sabbath_hit'; FRAME = 64; FRAMES = 10; ANCHOR = 'allTargets'
PAL = Pal(H=HEX, T=TOXIC[1:5], R=BLOOD[1:4], I=IRON[1:2])
PEAK = [2, 4, 7]
_r = rng(KEY)
BOLTS = [(_r.uniform(-18, 22), _r.randint(0, 1)) for _ in range(6)]
WISPS = [(k * math.tau / 6, _r.uniform(.8, 1.2)) for k in range(6)]


def flame_col(c, x, base, h, w, cols, f):
    for i, col in enumerate(cols):
        s = 1 - i * .28
        hh, ww = h * s, w * s
        wob = math.sin(f * 1.7 + x + i) * 2
        c.poly([(x - ww, base), (x - ww * .7, base - hh * .5), (x + wob, base - hh), (x + ww * .7, base - hh * .55), (x + ww, base)], col)


def draw(c, f):
    H, T, R, I = PAL.H, PAL.T, PAL.R, PAL.I
    if f <= 1:   # diagonal fire bolts streak in from upper right
        for k, (dx, kind) in enumerate(BOLTS):
            u = (f + 1) / 2 - k * .08
            x = CX + dx + 30 * (1 - u); y = GY - 8 - 44 * (1 - u)
            hc, tc = (T[3], T[1]) if kind == 0 else (H[5], H[3])
            c.line([(x, y), (x + 14, y - 12)], tc, 2); c.line([(x, y), (x + 6, y - 5)], hc, 2); c.disc(x, y, 2, hc)
        return
    if f == 2:   # pentagram flashes under the feet
        c.disc(CX, GY, 28, H[2], 8); c.disc(CX, GY, 22, H[3], 6)
        pentagram(c, CX, GY, 22, T[3], ry=6)
        c.disc(CX, GY - 2, 10, T[3], 4); c.disc(CX, GY - 2, 5, H[6], 2)
        rays(c, CX, GY - 4, 9, 10, 34, T[2], rot=math.pi, ry=1.2)
        return
    t = f - 3   # 0..6
    pentagram(c, CX, GY, 22 + t, H[4] if t < 3 else H[2], ry=6 + t * .3, rot=-math.pi / 2 + t * .1) if t < 5 else \
        c.dither(lambda cc: pentagram(cc, CX, GY, 22 + t, H[2], ry=6 + t * .3, rot=-math.pi / 2 + t * .1), f)
    if t <= 3:   # violet flame pillar with toxic core
        h = [40, 48, 36, 20][t]
        flame_col(c, CX, GY, h, 14, [H[1], H[3], H[4], T[3]] if t < 2 else [H[1], H[2], H[3]], f)
        for k in (-12, 12): flame_col(c, CX + k, GY, h * .55, 6, [H[2], H[4]], f + k)
    if t == 1:
        c.disc(CX, CY - 4, 12, R[1]); c.disc(CX, CY - 4, 8, R[2]); c.disc(CX, CY - 4, 4, H[6])
        rays(c, CX, CY - 4, 12, 12, 30, R[2], alt=22)
    if t >= 2:   # will-o-wisps orbit and fade
        u = t - 2
        for k, (a, s) in enumerate(WISPS):
            if u >= 3 and k % 2: continue
            x, y = orbit(CX, CY - 2 - u * 2, 20 * s - u * 1.5, a + u * .9, 12 * s)
            c.disc(x, y, 3 - u * .4, T[1]); c.disc(x, y - 1, 2 - u * .3, T[3]); c.px(x, y - 1, T[3] if u else H[6])
            c.px(x + 2, y + 2, T[0]); c.px(x + 3, y + 3 + (k % 2), T[0])
        for k in range(4):
            c.dither(lambda cc, k=k: puff(cc, CX - 14 + k * 9, GY - 6 - u * 3 - k % 2 * 5, 4 + u * .6, [H[1], H[2], I[0]]), k + f)


if __name__ == '__main__':
    make(KEY)

