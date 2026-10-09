import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib_nm5 import *  # noqa

"""저주 인형 꼭두각시 조종 — 아군 머리 위 조종대에서 흰 실이 내려와 팔다리에 이어지고 붉은 빛이 실을 타고 흐른다. 64×10, allAllies."""
KEY, SIZE, FRAMES = 'doll_strings', 64, 10
PAL = ['1a0e16', '7a5230', 'a87848', 'ece4f4', 'd05a6a', 'ff9aa8', 'ffffff']
O, WD, WL, S, R, RL, W = range(1, 8)
ENDS = [(20, 30), (44, 30), (26, 50), (38, 50), (32, 20)]


def draw(c, f, t):
    sway = [0, 1, 2, 1, 0, -1, -2, -1, 0, 1][f]
    bx, by = 32 + sway, 6 + min(f, 2)
    c.rect(bx - 13, by, bx + 13, by + 2, WD)
    c.rect(bx - 1, by - 3, bx + 1, by + 6, WD)
    c.line([(bx - 12, by), (bx + 12, by)], WL)
    c.outline(O, [WD, WL])
    drop = min(f / 3, 1)
    for k, (x, y) in enumerate(ENDS):
        sx = bx - 12 + k * 6
        ex, ey = sx + (x + sway - sx) * drop, by + 2 + (y - by - 2) * drop
        c.line([(sx, by + 3), (ex, ey)], S)
        if f >= 3:
            c.px(ex, ey, RL)
        if f >= 4:
            tt = ((f - 4) / 5 + k * .17) % 1
            c.px(sx + (ex - sx) * tt, by + 3 + (ey - by - 3) * tt, R)
            c.px(sx + (ex - sx) * tt, by + 4 + (ey - by - 3) * tt, R)
    if f >= 7:
        c.star(bx, by - 5, 2 + (f == 8), W, RL)


run(globals())

