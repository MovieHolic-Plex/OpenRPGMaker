"""monster4-2 갓파(민첩) 15칸 — 칩 × 1, 셀 48, dash. 물대포·스모 박치기."""
import sys
from pathlib import Path
sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pp15_nm4 import run, hexrgb as H, FLOOR

OL, K1, K2 = H('#0d1e14'), H('#3a8a48'), H('#6cc060')
WA, PL, WH, E1 = H('#5ab8e8'), H('#e6eef2'), H('#f8f8ec'), H('#f2c83a')
DW = H('#2a6ab8')  # 효과색: 짙은 물


def drops(f, pts, c=WA):
    for x, y in pts:
        f.px(x, y, c)
        f.px(x, y - 1, WH)


def jet(f, x0, y, x1, w=2):
    """물대포: 입(왼쪽)에서 왼쪽으로."""
    f.line([(x0, y), (x1, y)], DW, w + 2)
    f.line([(x0, y), (x1, y)], WA, w)
    f.line([(x0 - 2, y - 1), (x1 + 2, y - 1)], WH)


def fx(f, pal):
    drops(f['idle_b'], [(21, 15)])
    drops(f['idle_c'], [(19, 12), (27, 13)])
    f['windup'].dust(34, FLOOR, K2, 2)
    c = f['move']
    c.dust(30, FLOOR, WA, 3)
    c.line([(32, 30), (40, 30)], WA)
    c.line([(33, 34), (42, 34)], WA)
    c = f['attack']
    c.spark(3, 21, 3, WH, E1)
    c.arc((0, 12, 10, 30), 120, 240, WA, 2)
    drops(c, [(2, 12), (8, 10), (1, 32)])
    drops(f['recover'], [(10, 18), (6, 24)])
    c = f['hit']
    drops(c, [(34, 14), (38, 18), (36, 22), (41, 15)])
    c = f['dead']
    c.ell(14, 42, 34, 44, WA, under=True)
    drops(c, [(12, 40), (36, 40)])
    c = f['cast_charge']
    drops(c, [(10, 22), (38, 22), (14, 32), (34, 32)])
    c.ring(18, 12, 30, 20, WA)
    c = f['cast_raise']
    c.ell(18, 2, 28, 11, WA)
    c.ell(20, 3, 24, 6, WH)
    c.ring(17, 1, 29, 12, DW)
    c = f['cast_release']
    jet(c, 12, 28, 0, 2)
    drops(c, [(3, 23), (7, 33), (1, 34)])
    c = f['leap']
    c.ell(14, 41, 34, 45, WA, under=True)
    drops(c, [(12, 38), (36, 37), (24, 42)])
    c = f['buff']
    c.ring(8, 8, 40, FLOOR, WA, 1, under=True)
    c.arc((10, 10, 38, FLOOR - 2), 200, 260, WH)
    drops(c, [(9, 18), (39, 20), (24, 7)])
    c = f['finisher']
    jet(c, 10, 26, 0, 6)
    c.arc((-12, 8, 18, 44), 60, 300, DW, 2)
    c.arc((-10, 10, 16, 42), 70, 290, WA, 1)
    drops(c, [(2, 6), (10, 4), (16, 10), (4, 42), (12, 40), (18, 44)])
    c.spark(1, 26, 3, WH)


if __name__ == '__main__':
    run(2, fx)
