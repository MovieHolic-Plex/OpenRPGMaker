"""블리자드 화면 층 — 128px 8칸. 오른쪽 위에서 몰아치는 눈보라: 드문 눈 → 돌풍 띠와 밀집 → 가라앉음. mage_blizzard 와 같은 ICE 팔레트."""
import math, random
from lib_mage import *

KEY = 'mage_snow'; FRAME = 128; FRAMES = 8; ANCHOR = 'screen'
PAL = Pal(I=ICE, A=AQUA[2:])
PEAK = [1, 4]
_r = random.Random(23)
FLAKES = [(_r.uniform(0, 200), _r.uniform(-60, 128), _r.uniform(.7, 1.4), _r.choice([0, 0, 1, 1, 2, 3])) for _ in range(170)]
DENSITY = [.25, .5, .8, 1, 1, .9, .55, .25]
GUSTS = [(_r.uniform(0, 128), _r.uniform(10, 118), _r.uniform(24, 46)) for _ in range(16)]


def draw(c, f):
    I, A = PAL.I, PAL.A
    vx, vy = -13, 7   # wind blows toward the enemy side (left) and down
    # gust bands: long faint streak lines, dithered because they're airy afterglow
    def gusts(cc):
        for k, (x0, y0, ln) in enumerate(GUSTS):
            if k / len(GUSTS) > DENSITY[f]: continue
            x = (x0 + vx * f * 1.7) % 170 - 20; y = (y0 + vy * f * .6) % 128
            cc.line([(x, y), (x + ln, y - ln * .45)], I[2])
            cc.line([(x + 4, y + 3), (x + ln * .7, y + 3 - ln * .3)], I[1])
    c.dither(gusts, f)
    for k, (x0, y0, sp, kind) in enumerate(FLAKES):
        if k / len(FLAKES) > DENSITY[f]: continue
        x = (x0 + vx * sp * f * 1.3) % 190 - 30; y = (y0 + vy * sp * f * 1.3) % 190 - 30
        if not (-4 < x < 132 and -4 < y < 132): continue
        if kind == 0:
            c.line([(x, y), (x + 5 * sp, y - 3 * sp)], A[0]); c.px(x, y, I[5])
        elif kind == 1:
            c.spark(x, y, 2, I[4], core=I[5], diag=True)
        elif kind == 2:
            c.rect(x, y, x + 1, y + 1, I[5])
        else:
            c.line([(x, y), (x + 3, y - 2)], I[3]); c.px(x, y, A[1])
    # big hero flakes crossing the foreground at the storm's peak
    if 2 <= f <= 5:
        for k in range(6):
            x = (128 - (f - 2) * 30 - k * 23 + (k % 3) * 47) % 150 - 10; y = 12 + k * 19 + (f - 2) * 8
            c.line([(x + 4, y - 2), (x + 16, y - 9)], A[0])
            c.spark(x, y, 5, I[3], diag=True); c.spark(x, y, 3, I[5]); c.px(x, y, I[1])


if __name__ == '__main__':
    make(KEY)

