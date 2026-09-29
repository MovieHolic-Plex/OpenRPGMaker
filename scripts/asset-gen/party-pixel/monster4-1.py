"""monster4-1 버섯 요정(회복) 15칸 — 칩 × 1, 셀 48, hop. 포자 치유·수면 가루."""
import sys
from pathlib import Path
sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pp15_nm4 import run, hexrgb as H, FLOOR

R0, R1, W1, PK = H('#7a1622'), H('#c42a30'), H('#fffaf0'), H('#f08a9a')
G1, G2 = H('#5a9a3a'), H('#9ad060')
SP = H('#f6e27a')    # 효과색: 치유 포자(금빛)
SL = H('#b89af0')    # 효과색: 수면 포자(보라)


def spores(f, pts, c=SP, big=False):
    for x, y in pts:
        f.px(x, y, c)
        if big:
            f.px(x + 1, y, c)
            f.px(x, y + 1, c)


def fx(f, pal):
    spores(f['idle_b'], [(34, 14)])
    spores(f['idle_c'], [(12, 13), (36, 20)])
    f['windup'].px(35, FLOOR, G1)
    f['move'].dust(33, FLOOR, G2, 2)
    c = f['attack']
    c.spark(6, 22, 3, W1, SP)
    spores(c, [(3, 17), (9, 16), (2, 27), (10, 28)], SP)
    spores(f['recover'], [(8, 20), (5, 26)], SP)
    c = f['hit']
    for x, y in ((36, 16), (39, 21), (35, 25)):
        c.px(x, y, R1)
        c.px(x + 1, y, W1)
    spores(f['dead'], [(20, 36), (26, 34), (31, 37)], SL)
    c = f['cast_charge']
    spores(c, [(10, 30), (38, 30), (14, 22), (34, 22)], SP)
    c.px(24, 12, SP)
    c = f['cast_raise']
    c.ring(16, 2, 32, 12, SP)
    spores(c, [(24, 1), (18, 5), (30, 5), (24, 9)], SP, big=True)
    spores(c, [(12, 10), (36, 10)], SL)
    c = f['cast_release']
    for i, (x, y) in enumerate(((10, 18), (6, 14), (3, 20), (7, 24), (1, 15), (4, 28))):
        c.px(x, y, SP if i % 2 else SL)
        c.px(x - 1, y, SP if i % 2 else SL)
    c.arc((0, 10, 20, 30), 150, 230, W1)
    c = f['leap']
    c.dust(18, FLOOR, G2, 3)
    spores(c, [(20, 42), (28, 41)], SP)
    c = f['buff']
    c.ring(10, 38, 38, 46, G2, under=True)
    spores(c, [(10, 30), (38, 28), (14, 18), (34, 14), (24, 6)], SP, big=True)
    c.spark(24, 5, 2, W1)
    c = f['finisher']
    c.ring(-6, 6, 20, 36, SL, 2, under=True)
    c.ring(-3, 10, 14, 32, SP, 1, under=True)
    for x, y in ((3, 12), (7, 16), (2, 26), (9, 28), (13, 22), (5, 32)):
        c.px(x, y, SL)
        c.px(x + 1, y + 1, SP)
    for x, y in ((2, 6), (8, 4), (14, 9), (1, 36), (9, 38), (16, 34), (4, 20), (11, 18)):
        c.px(x, y, W1)
    c.spark(6, 20, 3, W1, PK)
    spores(c, [(20, 6), (26, 3), (32, 7)], SP, big=True)


if __name__ == '__main__':
    run(1, fx)
