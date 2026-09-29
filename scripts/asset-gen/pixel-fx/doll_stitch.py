import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib_nm5 import *  # noqa

"""저주 인형 꿰매기 — 바늘이 흰 실을 끌며 지그재그로 상처를 꿰매고, 다 꿰맨 자리에 분홍 치유 빛이 번진다. 64×10, target."""
KEY, SIZE, FRAMES = 'doll_stitch', 64, 10
PAL = ['1a0e16', 'b8c0d0', 'ffffff', 'ece4f4', '9a2034', 'f08aa0', 'ffd0da']
O, PIN, W, S, R, PK, PL = range(1, 8)
ZIG = [(18 + i * 4, 26 if i % 2 == 0 else 40) for i in range(8)]


def draw(c, f, t):
    if f < 6:
        c.line([(20, 33), (44, 33)], R, 2)
    n = min(f + 2, 8)
    pts = ZIG[:n]
    if len(pts) > 1:
        c.line(pts, S)
    if f < 7:
        x, y = pts[-1]
        c.line([(x - 4, y - 4), (x + 3, y + 3)], PIN)
        c.px(x - 4, y - 4, W)
    if f >= 6:
        r = (f - 5) * 5
        c.ring(32, 33, r + 6, r * .7 + 4, PK, 1, gap=6, phase=f)
        for k in range(4):
            a = k * 1.57 + f * .5
            c.star(32 + math.cos(a) * (r + 4), 33 + math.sin(a) * (r * .7 + 3), 1 if k % 2 else 2, PL if k % 2 else W)
    if f == 9:
        c.star(32, 20, 3, W, PL)


run(globals())

