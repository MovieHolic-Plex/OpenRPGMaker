import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib_nm5 import *  # noqa

"""미믹 통째로 삼키기(필살기 배경) — 무대 가득 보물상자 입이 벌어지고, 이빨 사이 어둠이 적을 빨아들였다 쾅 닫힌다. 128×12, screen."""
KEY, SIZE, FRAMES = 'mimic_pal_maw_sky', 128, 12
PAL = ['1c100c', '5a3218', '8e5628', 'c08040', '9a6410', 'd8a830', 'f8e878', 'f4f0e2', '2a0810', '5a1020', 'e0546c', 'f8f040', 'ffffff']
O, WD, WM, WL, GD, G, GL, T, M, M2, TM, E, W = range(1, 14)


def lid(c, y, up, h):
    s = -1 if up else 1
    top, bot = (y - h, y) if up else (y, y + h)
    c.rect(10, top, 118, bot, WM)
    c.rect(10, top, 118, top + 3 if up else top + 2, WL if up else WD)
    for x0 in (26, 58, 90):
        c.rect(x0, top, x0 + 6, bot, G)
        c.line([(x0 + 1, top), (x0 + 1, bot)], GL)
    c.rect(10, (bot - 5) if up else top, 118, (bot) if up else (top + 5), GD)
    for k in range(13):
        x = 13 + k * 8
        tip = y + s * -1 * -9 if up else y - 9
        c.poly([(x, y), (x + 6, y), (x + 3, y + (9 if up else -9))], T)
        c.line([(x + 1, y), (x + 3, y + (7 if up else -7))], W)
    c.outline(O, [WM, WL, WD, G, GL, GD, T])


def draw(c, f, t):
    gap = [8, 24, 44, 60, 66, 66, 62, 40, 10, 0, 0, 0][f]
    mid = 64
    if gap > 0:
        c.ell(64, mid, 56, gap / 2 + 2, M)
        c.ell(64, mid, 40, max(gap / 2 - 6, 1), M2)
        if 3 <= f <= 6:
            for k in range(10):
                a = k * math.pi / 5 + f * .5
                r = 40 - (f - 3) * 9
                c.line([(64 + math.cos(a) * (r + 10), mid + math.sin(a) * (r + 10) * .45), (64 + math.cos(a) * r, mid + math.sin(a) * r * .45)], TM)
            c.ell(46, mid - gap / 2 + 14, 4, 3, E)
            c.ell(82, mid - gap / 2 + 14, 4, 3, E)
            c.px(46, mid - gap / 2 + 14, O)
            c.px(82, mid - gap / 2 + 14, O)
    lid(c, mid - gap // 2, True, 22)
    lid(c, mid + gap // 2, False, 22)
    if f >= 9:
        r = (f - 8) * 14
        for k in range(12):
            a = k * math.pi / 6
            c.line([(64 + math.cos(a) * (r + 6), mid + math.sin(a) * (r + 6) * .7), (64 + math.cos(a) * (r + 16), mid + math.sin(a) * (r + 16) * .7)], GL if k % 2 else W, 2)
        c.star(64, mid, 10 - (f - 9) * 2, W, GL)


run(globals())

