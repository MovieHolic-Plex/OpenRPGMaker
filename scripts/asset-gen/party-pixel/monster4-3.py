"""monster4-3 구미호(마법) 15칸 — 칩 × 1, 셀 48, float. 여우불·환술."""
import math
import sys
from pathlib import Path
sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pp15_nm4 import run, hexrgb as H, FLOOR

OL, F2, F3, C1, RD = H('#2a1406'), H('#f2a83a'), H('#ffd878'), H('#fff6e6'), H('#d02838')
B0, B1 = H('#3a6ad8'), H('#9ad8ff')
BV = H('#6a2ab8')  # 효과색: 환술 보라


def foxfire(f, x, y, s=1, under=False):
    """푸른 여우불: 아래 둥근 몸, 위로 뾰족 불꽃. s = 크기 1~3."""
    f.ell(x - s, y - s, x + s, y + s, B0, under=under)
    f.poly([(x - s, y), (x, y - 2 - s * 2), (x + s, y)], B0, under=under)
    k = max(0, s - 1)
    f.ell(x - k, y - k, x + k, y + k, B1, under=under)
    if not under:
        f.px(x, y - 1 - s, B1)
        f.px(x, y, C1)


def fx(f, pal):
    foxfire(f['idle_b'], 8, 18, 1)
    foxfire(f['idle_c'], 9, 16, 1)
    f['idle_c'].px(39, 13, B1)
    f['windup'].px(38, 20, B1)
    foxfire(f['windup'], 38, 24, 1)
    c = f['move']
    for x in (34, 38, 42):
        c.px(x, 26, B1)
        c.px(x + 1, 30, B0)
    c = f['attack']
    for k in range(3):
        c.line([(4 + k * 3, 18 + k), (2 + k * 3, 30 + k)], F3)
    c.px(3, 17, C1)
    foxfire(c, 5, 34, 1)
    foxfire(f['recover'], 7, 20, 1)
    c = f['hit']
    for x, y in ((35, 15), (39, 20), (36, 26)):
        c.px(x, y, F3)
        c.px(x + 1, y + 1, RD)
    foxfire(f['dead'], 30, 36, 1)
    c = f['cast_charge']
    for x, y in ((31, 10), (38, 16), (40, 24)):
        foxfire(c, x, y, 1)
    c = f['cast_raise']
    for x, y in ((14, 8), (24, 4), (34, 8)):
        foxfire(c, x, y, 2)
    c.ring(10, 2, 38, 14, BV)
    c = f['cast_release']
    foxfire(c, 5, 22, 3)
    c.line([(9, 22), (15, 21)], B1)
    c.line([(9, 25), (14, 26)], B0)
    foxfire(c, 12, 12, 1)
    c = f['leap']
    for x, y in ((14, 38), (24, 42), (34, 38)):
        foxfire(c, x, y, 1)
    c = f['buff']
    c.ring(6, 6, 42, FLOOR, BV, 1, under=True)
    c.ring(9, 9, 39, FLOOR - 3, B0, 1, under=True)
    for x, y in ((6, 22), (42, 22), (24, 3)):
        foxfire(c, x, y, 1)
    c = f['finisher']
    for i in range(9):
        a = math.radians(-90 + i * 40)
        foxfire(c, 16 + math.cos(a) * 14, 22 + math.sin(a) * 16, 1 if i % 2 else 2, under=True)
    c.ring(1, 5, 31, 39, BV, under=True)
    foxfire(c, 5, 24, 3)
    c.spark(5, 24, 4, C1)


if __name__ == '__main__':
    run(3, fx)
