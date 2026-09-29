"""monster4-7 만드라고라(지원) 15칸 — 칩 × 1, 셀 48, hop. 비명 음파·약초."""
import sys
from pathlib import Path
sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pp15_nm4 import run, hexrgb as H, FLOOR

OL, R0, R1, R2, MO = H('#241408'), H('#7a4e2a'), H('#b07a44'), H('#d8a868'), H('#4a0e14')
L1, L2, L3, FL = H('#3a8a2a'), H('#72c43a'), H('#c0ec6a'), H('#f0e2ff')
SW = H('#f07ab0')  # 효과색: 비명 음파(분홍)


def scream(f, x, y, n=2, big=False):
    """입(왼쪽)에서 왼쪽으로 퍼지는 음파 호."""
    for k in range(n):
        r = 3 + k * (4 if big else 3)
        f.arc((x - r, y - r, x + r, y + r), 130, 230, SW if k % 2 == 0 else FL, 1)


def herb(f, x, y):
    f.px(x, y, L2)
    f.px(x - 1, y - 1, L3)
    f.px(x + 1, y - 1, L1)
    f.px(x, y + 1, L1)


def fx(f, pal):
    herb(f['idle_b'], 36, 18)
    herb(f['idle_c'], 10, 16)
    f['windup'].dust(34, FLOOR, R2, 2)
    f['move'].dust(33, FLOOR, R2, 3)
    c = f['attack']
    c.spark(5, 34, 2, FL, SW)
    scream(c, 8, 22, 2)
    f['recover'].dust(10, FLOOR, R2, 2, -1)
    c = f['hit']
    for x, y in ((35, 17), (38, 22), (36, 27)):
        c.px(x, y, R2)
    c.px(34, 12, L3)
    herb(f['dead'], 34, 40)
    herb(f['dead'], 14, 41)
    c = f['cast_charge']
    herb(c, 12, 24)
    herb(c, 36, 24)
    c.px(24, 12, SW)
    c = f['cast_raise']
    for x, y in ((14, 8), (24, 4), (34, 8)):
        herb(c, x, y)
    c.ring(12, 1, 36, 15, L2)
    c = f['cast_release']
    scream(c, 12, 26, 4, big=True)
    c = f['leap']
    c.dust(16, FLOOR, R2, 3)
    herb(c, 24, 42)
    c = f['buff']
    for x, y in ((8, 16), (40, 16), (6, 32), (42, 32), (24, 5)):
        herb(c, x, y)
    c.ring(6, 36, 42, 46, L2, under=True)
    c = f['finisher']
    scream(c, 14, 26, 6, big=True)
    for x, y in ((2, 6), (6, 42), (1, 24)):
        c.spark(x, y, 2, FL, SW)
    herb(c, 30, 6)
    herb(c, 40, 10)


if __name__ == '__main__':
    run(7, fx)
