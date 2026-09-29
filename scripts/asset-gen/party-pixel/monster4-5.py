"""monster4-5 이끼 골렘(탱커) 15칸 — 칩 × 1, 셀 48, stomp. 바위 주먹·대지 방벽."""
import sys
from pathlib import Path
sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pp15_nm4 import run, hexrgb as H, FLOOR

OL, S0, S1, S2, S3 = H('#161a1c'), H('#3c4448'), H('#666e70'), H('#949a96'), H('#c4c8c0')
G1, G2, EY, E2, FL = H('#3f7a2a'), H('#72b040'), H('#7af0c8'), H('#e0fff4'), H('#f2d24a')
DT = H('#8a6a44')  # 효과색: 흙


def rock(f, x, y, s=2):
    f.poly([(x - s, y + s), (x - s, y - s + 1), (x, y - s), (x + s, y - s + 1), (x + s, y + s)], S1)
    f.px(x - s + 1, y - s + 1, S3)
    f.line([(x - s, y + s), (x + s, y + s)], S0)


def spike(f, x, h):
    """돌가시(몸 뒤에만 — 몸을 가리지 않는다)."""
    f.poly([(x - 2, FLOOR), (x + 2, FLOOR), (x, FLOOR - h)], S1, under=True)
    f.line([(x - 1, FLOOR - 1), (x, FLOOR - h + 1)], S2, under=True)
    f.px_under(x, FLOOR - h, S3)


def fx(f, pal):
    f['idle_b'].px(15, 17, EY)
    f['idle_c'].px(33, 14, G2)
    f['idle_c'].px(34, 13, FL)
    f['windup'].dust(35, FLOOR, DT, 2)
    f['move'].dust(33, FLOOR, DT, 3)
    f['move'].rect(10, FLOOR, 12, FLOOR, S0)
    c = f['attack']
    c.line([(2, FLOOR), (5, FLOOR - 2), (9, FLOOR), (12, FLOOR - 1)], OL)
    for x, y in ((3, 34), (8, 30), (1, 28)):
        rock(c, x, y, 1)
    c.spark(6, 38, 2, S3)
    f['recover'].dust(10, FLOOR, DT, 2, -1)
    rock(f['recover'], 5, 41, 1)
    c = f['hit']
    for x, y in ((36, 16), (39, 22), (35, 28)):
        rock(c, x, y, 1)
    c = f['dead']
    for x, y in ((12, 42), (35, 42)):
        rock(c, x, y, 1)
    c.px(20, 36, G2)
    c = f['cast_charge']
    c.ring(18, 22, 30, 32, EY)
    c.spark(24, 27, 1, E2)
    c = f['cast_raise']
    for x, y in ((14, 8), (24, 3), (34, 8)):
        rock(c, x, y, 2)
    c.ring(10, 0, 38, 14, EY)
    c = f['cast_release']
    rock(c, 4, 22, 3)
    c.line([(8, 22), (14, 21)], S2)
    c.line([(8, 25), (13, 26)], DT)
    c = f['leap']
    c.dust(14, FLOOR, DT, 3)
    c.dust(28, FLOOR, DT, 3)
    rock(c, 24, 42, 1)
    c = f['buff']
    c.rect(2, 22, 7, FLOOR, S1)
    c.rect(2, 22, 3, FLOOR, S2)
    c.line([(2, 30), (7, 30)], S0)
    c.line([(2, 37), (7, 37)], S0)
    c.rect(2, 21, 7, 21, G1)
    c.px(3, 20, G2)
    c.ring(10, 4, 38, 18, EY)
    c = f['finisher']
    for x, h in ((2, 16), (6, 22), (10, 12)):
        spike(c, x, h)
    for x, y in ((4, 6), (12, 4), (18, 8)):
        rock(c, x, y, 2)
    c.ring(-4, 12, 22, 38, EY, under=True)
    c.spark(8, 18, 3, E2, EY)


if __name__ == '__main__':
    run(5, fx)
