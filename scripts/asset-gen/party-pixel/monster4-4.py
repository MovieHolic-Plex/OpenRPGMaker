"""monster4-4 너구리 둔갑사(운) 15칸 — 칩 × 1, 셀 48, hop. 배 두드리기·둔갑 연기·나뭇잎 표창."""
import sys
from pathlib import Path
sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pp15_nm4 import run, hexrgb as H, FLOOR

OL, T0, T2, C1 = H('#1e140c'), H('#5a3a20'), H('#b8864e'), H('#f0dcb4')
LF, L2, WH, RD = H('#4a9a2e'), H('#9ad84a'), H('#fffaf0'), H('#c83a2a')
SM = H('#d8d0e8')  # 효과색: 둔갑 연기
GD = H('#f2c83a')  # 효과색: 행운 금빛


def leaf(f, x, y):
    """나뭇잎 표창(왼쪽으로 날아간다)."""
    f.poly([(x, y), (x + 3, y - 2), (x + 6, y), (x + 3, y + 2)], LF)
    f.line([(x, y), (x + 6, y)], L2)
    f.px(x + 7, y, T0)


def puff(f, x, y, r):
    f.ell(x - r, y - r, x + r, y + r, SM)
    f.ell(x - r + 1, y - r - 1, x, y, WH)
    f.px(x + r - 1, y + r - 1, T2)


def beat(f, x, y):
    """배 두드리는 소리 물결(왼쪽 바깥)."""
    f.arc((x - 4, y - 4, x + 4, y + 4), 120, 240, GD)
    f.arc((x - 7, y - 7, x + 7, y + 7), 130, 230, WH)


def fx(f, pal):
    f['idle_b'].px(9, 24, GD)
    beat(f['idle_c'], 13, 30)
    f['windup'].dust(34, FLOOR, T2, 2)
    f['move'].dust(33, FLOOR, T2, 3)
    c = f['attack']
    c.spark(6, 30, 3, WH, GD)
    leaf(c, 1, 20)
    f['recover'].dust(10, FLOOR, T2, 2, -1)
    leaf(f['recover'], 3, 26)
    c = f['hit']
    for x, y in ((35, 16), (38, 21), (36, 27)):
        c.px(x, y, WH)
    c.px(28, 12, RD)
    puff(f['dead'], 32, 38, 3)
    c = f['cast_charge']
    beat(c, 13, 30)
    c.px(24, 10, GD)
    c.px(10, 20, GD)
    c = f['cast_raise']
    for x, y, r in ((14, 10, 3), (22, 6, 4), (32, 9, 3)):
        puff(c, x, y, r)
    leaf(c, 20, 3)
    c = f['cast_release']
    for x, y in ((2, 16), (6, 24), (1, 31)):
        leaf(c, x, y)
    c.line([(10, 16), (14, 16)], WH)
    c.line([(14, 24), (18, 24)], WH)
    c = f['leap']
    for x, y, r in ((16, 40, 3), (24, 42, 4), (32, 40, 3)):
        puff(c, x, y, r)
    c = f['buff']
    for x, y in ((8, 20), (40, 20), (12, 8), (36, 8), (24, 3)):
        c.ell(x - 1, y - 1, x + 1, y + 1, GD)
        c.px(x, y, WH)
    beat(c, 12, 30)
    c = f['finisher']
    for x, y, r in ((30, 12, 5), (38, 20, 5), (32, 30, 4), (40, 34, 3)):
        puff(c, x, y, r)
    for x, y in ((1, 8), (4, 16), (0, 24), (5, 32), (2, 40), (10, 12), (9, 36)):
        leaf(c, x, y)
    c.spark(8, 24, 3, GD, WH)


if __name__ == '__main__':
    run(4, fx)
