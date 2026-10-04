"""monster4-0 트렌트(탱커) 15칸 — 칩 × 1, 셀 48, stomp. 뿌리 휘감기·잎 폭풍·나무껍질 방벽."""
import sys
from pathlib import Path
sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pp15_nm4 import run, hexrgb as H, FLOOR

OL, B0, B1, B2 = H('#1c1109'), H('#4a2c16'), H('#7a4c28'), H('#a8743e')
L1, L2, L3, EY = H('#357326'), H('#5fa83a'), H('#a2d85a'), H('#f4e25a')
GLOW = H('#e8ffb0')  # 효과색 1


def root(f, x, h, lean=0, col=B1):
    """땅에서 솟는 뿌리 가시: 아래 3px 폭, 위로 갈수록 가늘다. 몸 뒤에만."""
    f.poly([(x - 1, FLOOR), (x + 2, FLOOR), (x + 1 + lean, FLOOR - h)], col, under=True)
    f.line([(x, FLOOR - 1), (x + lean, FLOOR - h + 1)], B2, under=True)
    f.px_under(x + 1 + lean, FLOOR - h, OL)


def leaves(f, pts):
    for i, (x, y) in enumerate(pts):
        f.px(x, y, L3 if i % 2 else L2)
        f.px(x + 1, y, L1)


def fx(f, pal):
    leaves(f['idle_b'], [(8, 20)])
    leaves(f['idle_c'], [(9, 27), (37, 18)])
    f['windup'].dust(34, FLOOR, B2, 2)
    f['windup'].px(11, 22, L3)
    f['move'].dust(33, FLOOR, B2, 3)
    for x, h, l in ((4, 10, -1), (8, 14, -1), (12, 7, 0)):
        root(f['attack'], x, h, l)
    f['attack'].spark(6, 28, 2, GLOW)
    f['recover'].dust(10, FLOOR, B2, 2, -1)
    root(f['recover'], 5, 4)
    for x, y in ((34, 20), (37, 24), (35, 28), (39, 19)):
        f['hit'].px(x, y, B2)
        f['hit'].px(x + 1, y + 1, B0)
    f['dead'].dust(12, FLOOR, B2, 2, -1)
    leaves(f['dead'], [(30, 41), (16, 40), (34, 43)])
    leaves(f['cast_charge'], [(8, 22), (38, 24), (12, 34), (36, 34)])
    f['cast_charge'].spark(24, 13, 1, GLOW)
    c = f['cast_raise']
    c.ring(12, 4, 36, 14, L2)
    leaves(c, [(13, 8), (34, 8), (24, 3), (18, 13), (30, 13)])
    c.spark(24, 9, 2, GLOW, EY)
    c = f['cast_release']
    c.line([(12, 30), (7, 26), (3, 28), (1, 24)], B1, 2)
    c.line([(12, 34), (6, 36), (2, 33)], B1, 2)
    leaves(c, [(5, 25), (2, 31), (8, 34)])
    c.spark(2, 26, 2, GLOW)
    c = f['leap']
    c.dust(16, FLOOR, B2, 3)
    c.dust(28, FLOOR - 1, B2, 2)
    c.px(24, 40, B0)
    c = f['buff']
    c.ring(6, 8, 42, FLOOR, B1, 2, under=True)
    c.ring(8, 10, 40, FLOOR - 1, B2, 1, under=True)
    leaves(c, [(8, 18), (39, 18), (6, 30), (41, 32)])
    c = f['finisher']
    for x, h, l in ((1, 16, 0), (4, 22, -1), (8, 12, -1), (11, 18, 0), (14, 8, 1)):
        root(c, x, h, l)
    c.arc((2, 4, 46, 40), 200, 330, L2, 2)
    c.arc((6, 8, 42, 36), 210, 320, L3)
    leaves(c, [(6, 6), (14, 3), (30, 2), (40, 8), (3, 18), (44, 16)])
    c.spark(5, 20, 3, GLOW, EY)


if __name__ == '__main__':
    run(0, fx)
