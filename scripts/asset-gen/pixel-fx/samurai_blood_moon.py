"""samurai_blood_moon: 혈월 (화면). The night sky bleeds crimson, a huge red moon rises and swells with a halo, drips and red petals rain from it, a pulse ring rolls out, then it sinks away.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_samurai import *

KEY, SIZE, FRAMES, ANCHOR = 'samurai_blood_moon', 128, 10, 'screen'
PAL = pal(BLOOD, pick(INDIGO, 'n0', 'n1', 'n2'), pick(SAKURA, 's1', 's2'), WHITE)
MX = 64


def sky(c, h, parity_edge=True):
    c.rect(0, 0, 127, h, 'n0')
    if parity_edge:
        c.drect(0, h + 1, 127, h + 8, 'n0')
        c.drect(0, h + 1, 127, h + 3, 'r0', 1)


def moon(c, y, r, halo=0):
    if halo:
        c.dring(MX, y, r + halo + 4, 'r1')
        c.ring(MX, y, r + halo, 'r1', 2)
    c.disc(MX, y, r + 1, 'r0')
    c.disc(MX, y, r, 'r1')
    c.disc(MX - 1, y - 1, r - 2, 'r2')
    c.disc(MX - r * 0.25, y - r * 0.25, r * 0.55, 'r3')
    c.disc(MX - r * 0.35, y - r * 0.35, r * 0.2, 'r4')
    # craters
    for dx, dy, cr in ((r * 0.35, r * 0.1, r * 0.18), (-r * 0.1, r * 0.45, r * 0.14), (r * 0.5, -r * 0.4, r * 0.1)):
        c.disc(MX + dx, y + dy, cr, 'r1')


def drips(c, y, n, length, seed):
    r = rng(seed)
    for i in range(n):
        x = MX + r.uniform(-34, 34)
        y0 = y + r.uniform(0, length)
        c.line([(x, y0), (x, y0 + 4)], 'r2')
        c.px(x, y0 + 5, 'r3')
        c.px(x, y0 - 1, 'r1')


def draw(c, f):
    heights = [30, 60, 90, 110, 118, 118, 118, 110, 80, 40]
    sky(c, heights[f])
    ys = [120, 90, 62, 48, 44, 44, 44, 46, 56, 76]
    rs = [10, 16, 20, 22, 25, 26, 25, 24, 20, 14]
    y, r = ys[f], rs[f]
    if f == 0:
        c.disc(MX, 118, 12, 'r1')
        c.disc(MX, 118, 8, 'r2')
        specks(c, MX, 40, 12, 10, 60, 1, ['n2', 'r1'], sq=0.4)
    elif f <= 2:
        moon(c, y, r, halo=4 * f)
        specks(c, MX, 30, 16, 20, 60, f, ['n2', 'r1', 'w'], sq=0.4)
    elif f == 3:
        moon(c, y, r, halo=8)
        c.rays(MX, y, 16, r + 12, r + 30, 'r2', rot=0.1, jitter=[1, 0.7, 0.9, 0.6])
    elif f == 4:
        c.ring(MX, y, r + 20, 'r2', 3)
        c.ring(MX, y, r + 19, 'r4', 1)
        moon(c, y, r, halo=8)
        c.spark(MX - 8, y - 8, 9, 'w', 'r4', diag=True)
        drips(c, y + r, 10, 20, 4)
    elif f == 5:
        c.ring(MX, y, r + 34, 'r1', 2)
        c.dring(MX, y, r + 40, 'r2')
        moon(c, y, r, halo=6)
        drips(c, y + r, 14, 40, 5)
        burst_petals(c, MX, y + 30, 14, 50, 5, L=4.5, keys=('r2', 's1', 's2'), hi='r4', sq=0.6)
    elif f == 6:
        c.dring(MX, y, r + 50, 'r1', parity=1)
        moon(c, y, r, halo=5)
        drips(c, y + r, 16, 56, 6)
        burst_petals(c, MX, y + 44, 18, 56, 6, drop=6, L=4.5, keys=('r2', 's1', 's2'), hi='r4', sq=0.6)
    elif f == 7:
        moon(c, y, r, halo=3)
        drips(c, y + r, 12, 60, 7)
        burst_petals(c, MX, y + 54, 16, 60, 7, drop=12, L=4, keys=('r1', 'r2', 's1'), hi='r3', sq=0.6)
    elif f == 8:
        moon(c, y, r)
        burst_petals(c, MX, y + 50, 12, 60, 8, drop=18, L=3.5, keys=('r1', 'r2'), hi='r3', sq=0.6)
    else:
        c.disc(MX, y, r, 'r1')
        c.disc(MX - 2, y - 2, r - 4, 'r2')
        burst_petals(c, MX, 100, 8, 60, 9, drop=10, L=3, keys=('r1', 's1'), sq=0.3)


# 감독 QA 2026-09-28: 화면 층(128px 칸 → 무대 256px 상자)이 칸 끝까지 칠해져 무대 한가운데 네모로 잘려 보였다.
# 칸에 내접한 타원 바깥을 디더로 걷어 둥글게 흩뜨린다(fx_edge.fade_oval, 새 색 없음·알파 0/255 유지).
from fx_edge import fade_oval  # noqa: E402

_draw_body = draw


def draw(c, f):
    _draw_body(c, f)
    fade_oval(c, band=0.3)


if __name__ == '__main__':
    run(globals())

