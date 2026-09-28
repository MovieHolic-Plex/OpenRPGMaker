"""악몽(화면 층) — 128px 10칸. 위에서 검보라 어둠이 번지며 붉은 초승달 눈이 뜨이고 → 거대한 악몽의 눈이 열려 핏빛 동공과 보라 빛살, 해골 유령들이 떠다님 → 유령이 왼쪽 적진으로 몰려 내려가고 눈이 감기며 어둠이 걷힘. witch_nightmare_hit 와 같은 HEX·BLOOD 팔레트."""
import math
from lib_druid import *

KEY = 'witch_nightmare_sky'; FRAME = 128; FRAMES = 10; ANCHOR = 'screen'
PAL = Pal(H=HEX, R=BLOOD, T=TOXIC[3:5], I=IRON[:1])
PEAK = [2, 4, 7]
_r = rng(KEY)
GHOSTS = [(_r.uniform(10, 118), _r.uniform(40, 96), _r.uniform(.8, 1.2), _r.uniform(0, math.tau)) for _ in range(9)]
STARS = [(_r.randint(2, 125), _r.randint(2, 60)) for _ in range(26)]
EX, EY = 64, 30


def ghost(c, x, y, s, f, k, bright=True):
    H, R = PAL.H, PAL.R
    c.disc(x, y, 6 * s + 1, H[1], 6 * s + 1)
    c.disc(x, y, 6 * s, H[3] if bright else H[2], 6 * s)
    tail = [(x - 6 * s, y), (x + 6 * s, y)]
    for i in range(4):
        tail.append((x + 6 * s - i * 4 * s, y + 9 * s + (i + f + k) % 2 * 3 * s))
    c.poly([(x - 6 * s, y)] + tail[1:] + [(x - 6 * s, y + 8 * s)], H[3] if bright else H[2])
    c.disc(x - 1, y - 2, 3.5 * s, H[4] if bright else H[3])
    c.rect(x - 3 * s, y - 1, x - 1 * s, y + 1 * s, H[0]); c.rect(x + 1 * s, y - 1, x + 3 * s, y + 1 * s, H[0])
    c.px(x - 2 * s, y, R[2]); c.px(x + 2 * s, y, R[2])
    c.disc(x, y + 4 * s, 1.5 * s, H[0], 2 * s)


def eye(c, open_, glow):
    H, R = PAL.H, PAL.R
    w, h = 44, 18 * open_
    if h < 1:
        c.line([(EX - w, EY), (EX, EY + 3), (EX + w, EY)], R[1], 2); return
    c.poly([(EX - w - 3, EY), (EX - w * .5, EY - h - 3), (EX + w * .5, EY - h - 3), (EX + w + 3, EY), (EX + w * .5, EY + h + 3), (EX - w * .5, EY + h + 3)], H[0])
    c.poly([(EX - w, EY), (EX - w * .5, EY - h), (EX + w * .5, EY - h), (EX + w, EY), (EX + w * .5, EY + h), (EX - w * .5, EY + h)], R[3] if glow else H[5])
    c.disc(EX, EY, 13 * min(1, open_ * 1.3), R[0], 13 * open_)
    c.disc(EX, EY, 10 * min(1, open_ * 1.3), R[1], 10 * open_)
    c.disc(EX, EY, 7 * min(1, open_ * 1.3), R[2], 7 * open_)
    c.rect(EX - 1, EY - 8 * open_, EX + 1, EY + 8 * open_, H[0])
    c.rect(EX - 7, EY - 5 * open_, EX - 5, EY - 3 * open_, H[6])
    # lashes
    for k in range(7):
        x = EX - w * .7 + k * w * .23
        c.line([(x, EY - h - 2), (x + (k - 3) * 1.5, EY - h - 8)], H[0], 2)


def sky(c, h, f):
    H = PAL.H
    if h <= 0: return
    c.dither(lambda cc: cc.disc(64, -10, 76, H[1], h + 6), f)
    c.disc(64, -10, 72, H[1], h)
    c.disc(64, -10, 64, H[0], h * .8)
    for x, y in STARS:
        if ((x - 64) / 64) ** 2 + ((y + 10) / (h * .8 + .1)) ** 2 < .8: c.px(x, y, H[3] if (x + f) % 5 else PAL.R[2])


def draw(c, f):
    H, R, T = PAL.H, PAL.R, PAL.T
    h = [30, 56, 70, 76, 78, 78, 76, 70, 54, 30][f]
    sky(c, h, f)
    op = [0, .2, .8, 1, 1, .9, .7, .45, .15, 0][f]
    if f == 3:
        rays(c, EX, EY, 16, 50, 90, H[4], rot=.1, alt=68)
        c.ring(EX, EY, 52, R[2], 2, 30)
    if f == 4: c.dither(lambda cc: cc.ring(EX, EY, 58, H[4], 2, 34), f)
    if 1 <= f <= 8 or f == 0: eye(c, op, f == 3)
    if f == 0:
        c.line([(EX - 30, EY), (EX, EY + 2), (EX + 30, EY)], R[0], 1)
    if f >= 2:   # ghosts drift, then dive toward the enemy side (lower left)
        for k, (x, y, s, ph) in enumerate(GHOSTS):
            u = max(0, f - 5)
            gx = x + math.sin(ph + f) * 4 - u * 12 * s
            gy = y + math.cos(ph + f * .7) * 3 + u * 6 * s
            if f <= 3 and k % 3 > f - 2: continue
            if -12 < gx < 140 and gy < 134:
                if u: c.line([(gx + 8, gy - 4), (gx + 18, gy - 10)], H[2])
                ghost(c, gx, gy, s, f, k, bright=f <= 7)
    if f >= 8:
        for k in range(8):
            x = 8 + k * 15; y = 60 + (k % 3) * 12 + (f - 8) * 10
            c.px(x, y, R[2] if k % 2 else H[4])


if __name__ == '__main__':
    make(KEY)

