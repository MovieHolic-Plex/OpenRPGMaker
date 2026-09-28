"""ninja_thousand_sky: 천본 벚꽃 (필살기 배경). A violet night falls with a full moon, the ninja's hand seal flashes, a thousand kunai materialise in rings across the sky, then rain down as a steel storm through drifting violet sakura, a final flash and scattered petals.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_samurai import *

KEY, SIZE, FRAMES, ANCHOR = 'ninja_thousand_sky', 128, 12, 'screen'
PAL = pal(NIGHT, IRON, pick(SAKURA, 's1', 's2', 's3'), pick(BLOOD, 'r2'), WHITE)
R = rng(41)
BLADES = [(R.uniform(4, 124), R.uniform(4, 60), R.uniform(0, 1)) for _ in range(46)]
ANG = math.pi / 2 + 0.3


def night(c, h=127, moon=True):
    c.rect(0, 0, 127, h, 'v0')
    c.drect(0, h - 24, 127, h, 'v1')
    if moon:
        c.disc(100, 22, 13, 'v2')
        c.disc(100, 22, 11, 'v4')
        c.disc(98, 20, 8, 'w')
        c.disc(104, 26, 3, 'v4')


def seal(c, x, y, s):
    c.ring(x, y, 10 * s, 'v3', 2)
    c.line([(x - 7 * s, y), (x + 7 * s, y)], 'w', 2)
    c.line([(x, y - 7 * s), (x, y + 7 * s)], 'w', 2)
    c.diamond(x, y, 3 * s, 3 * s, 'r2')


def sakura_drift(c, f, n, seed, keys=('s1', 's2', 's3', 'v3')):
    r = rng(seed)
    for i in range(n):
        x = (r.uniform(0, 160) - f * 7) % 140 - 6
        y = (r.uniform(0, 128) + f * 5) % 132 - 2
        c.petal(x, y, r.uniform(0, 6) + f, r.uniform(3, 5), keys[i % len(keys)], 'w' if i % 5 == 0 else None)


def draw(c, f):
    if f == 0:
        c.drect(0, 0, 127, 127, 'v0')
        seal(c, 64, 70, 0.8)
    elif f == 1:
        night(c)
        seal(c, 64, 70, 1.4)
        c.spark(64, 70, 18, 'w', 'v4', diag=True)
    elif f == 2:
        night(c)
        for ring_r, n in ((22, 8), (40, 14)):
            for i in range(n):
                a = i * 2 * math.pi / n + f
                x, y = pol(64, 56, ring_r, a, 0.6)
                c.spark(x, y, 2, 'w', 'v3')
        c.ring(64, 56, 46, 'v2', 1, squash=0.6)
    elif f == 3:
        night(c)
        for i, (x, y, t) in enumerate(BLADES):
            if t < 0.6:
                c.kunai(x, y, ANG, 11, 'i0', 'i2', 'i3', 'v2', 'r2')
            else:
                c.spark(x, y, 2, 'w', 'v4')
    elif f == 4:
        night(c)
        for i, (x, y, t) in enumerate(BLADES):
            c.kunai(x, y, ANG, 12, 'i0', 'i2', 'i3', 'v2', 'r2')
            if i % 4 == 0:
                c.px(x, y + 1, 'w')
        sakura_drift(c, f, 10, 4)
    elif 5 <= f <= 8:
        night(c, moon=f < 8)
        fall = (f - 4) * 22
        for i, (x, y, t) in enumerate(BLADES):
            yy = (y + fall + t * 30) % 150 - 12
            xx = x - (fall * 0.3) % 30
            ux, uy = math.cos(ANG), math.sin(ANG)
            c.line([(xx - ux * 12, yy - uy * 12), (xx - ux * 24, yy - uy * 24)], 'v2')
            c.kunai(xx, yy, ANG, 12, 'i0', 'i2', 'w' if i % 3 == 0 else 'i3', 'v2', 'r2')
        sakura_drift(c, f, 22, 5)
        if f == 7:
            c.spark(40, 110, 8, 'w', 'v4', diag=True)
            c.spark(92, 116, 6, 'w', 'v4')
    elif f == 9:
        c.rect(0, 0, 127, 127, 'v0')
        c.rays(64, 76, 30, 14, 110, 'v2', rot=0.05, jitter=[1, 0.6, 0.85, 0.5])
        c.rays(64, 76, 14, 12, 80, 'v3', rot=0.2, jitter=[1, 0.7])
        c.ring(64, 76, 44, 'v3', 3, squash=0.6)
        c.ring(64, 76, 43, 'v4', 1, squash=0.6)
        c.flower(64, 76, 30, -math.pi / 2, ('v2', 's2', 's3'), core='w', dots='s1')
        c.disc(64, 76, 8, 'w')
        c.spark(64, 76, 26, 'w', 'w', diag=True)
        sakura_drift(c, f, 20, 9, ('s1', 's2', 'v3'))
    elif f == 10:
        c.drect(0, 0, 127, 127, 'v0')
        c.ring(64, 64, 62, 'v3', 2, squash=0.6)
        sakura_drift(c, f, 30, 10)
        specks(c, 64, 64, 20, 20, 64, 10, ['v4', 'w', 's3'], spark_every=5)
    else:
        c.drect(0, 100, 127, 127, 'v0')
        sakura_drift(c, f, 18, 11, ('s1', 's2', 'v2'))
        specks(c, 64, 64, 12, 30, 64, 11, ['v3', 'v4'], spark_every=4)


# 감독 QA 2026-09-28: 화면 층(128px 칸 → 무대 256px 상자)이 칸 끝까지 칠해져 무대 한가운데 네모로 잘려 보였다.
# 칸에 내접한 타원 바깥을 디더로 걷어 둥글게 흩뜨린다(fx_edge.fade_oval, 새 색 없음·알파 0/255 유지).
from fx_edge import fade_oval  # noqa: E402

_draw_body = draw


def draw(c, f):
    _draw_body(c, f)
    fade_oval(c, band=0.3)


if __name__ == '__main__':
    run(globals())

