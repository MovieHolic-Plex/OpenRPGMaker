import sys; sys.path.insert(0, 'work')
from w24_lib import Cv
W_, BL, Y, G, BR, LN = 'wood', 'blue', 'yellow', 'gold', 'brass', 'linen'
def line(c, a, b, ramp, t):
    (x0, y0), (x1, y1) = a, b
    n = max(abs(x1 - x0), abs(y1 - y0))
    for i in range(1, n):
        x = round(x0 + (x1 - x0) * i / n); y = round(y0 + (y1 - y0) * i / n)
        if (x, y) not in c.c or c.c[(x, y)][0] == BL and c.c[(x, y)][1] < t: c.p(x, y, ramp, t)
def star(c, x, y, big=False):
    c.p(x, y, Y, 6)
    if big:
        for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)): c.p(x+dx, y+dy, Y, 4)
def frame(c, x0, y0, x1, y1):
    c.r(x0, y0, x1, y1, W_, 2)
    c.r(x0+1, y0+1, x1-1, y1-1, W_, 5)
    c.r(x1-1, y0+1, x1-1, y1-1, W_, 3); c.r(x0+1, y1-1, x1-1, y1-1, W_, 3)
    c.r(x0+2, y0+2, x1-2, y1-2, BL, 1)
# ---------------- D : 액자 성도
c = Cv(16, 32)
c.p(7, 0, BR, 4); c.p(8, 0, BR, 4)
frame(c, 1, 1, 14, 30)
c.r(3, 17, 12, 28, BL, 2)
pts = [(5,7),(9,11),(4,15),(10,17),(6,22),(11,25),(4,26)]
for a, b in zip(pts, pts[1:]): line(c, a, b, BL, 4)
for i, p in enumerate(pts): star(c, *p, big=(i in (0, 3, 5)))
# 달
c.row(4, 9, '.66', Y); c.row(5, 9, '6..', Y); c.row(6, 9, '65.', Y); c.row(7, 10, '55', Y) if False else None
c.row(5, 9, '65', Y); c.row(6, 9, '5', Y); c.row(7, 10, '4', Y) if False else None
c.p(11, 4, Y, 6); c.p(12, 5, Y, 4)
c.p(5, 13, Y, 5); c.p(11, 20, Y, 5); c.p(3, 20, Y, 5) if False else None
c.emit('w24-D.pxg')
# ---------------- E : 걸개 두루마리 (천 + 위아래 봉)
c = Cv(16, 32)
c.r(3, 0, 12, 0, W_, 2); c.r(2, 1, 13, 1, W_, 5); c.r(2, 2, 13, 2, W_, 3)
c.p(1, 1, BR, 5); c.p(1, 2, BR, 3); c.p(14, 1, BR, 4); c.p(14, 2, BR, 2)   # 봉 마구리
c.p(2, 0, W_, 2)
# 천
c.r(3, 3, 12, 27, BL, 2); c.r(3, 3, 3, 27, BL, 3); c.r(12, 3, 12, 27, BL, 1)
c.r(3, 3, 12, 3, BL, 1)
# 금 테 이중선 안쪽
c.r(4, 4, 11, 26, BL, 1)
for x in range(4, 12): c.p(x, 4, G, 4 if x < 8 else 3); c.p(x, 26, G, 3)
for y in range(4, 27): c.p(4, y, G, 4); c.p(11, y, G, 3)
# 원형 궤도 (별자리 원)
import math
for a in range(0, 360, 6):
    x = round(7.5 + 3.4 * math.cos(math.radians(a))); y = round(12 + 3.4 * math.sin(math.radians(a)))
    c.p(x, y, BL, 4)
c.p(7, 12, Y, 6); c.p(8, 12, Y, 5); c.p(7, 11, Y, 5); c.p(8, 13, Y, 4)
star(c, 7, 8); star(c, 11, 12) if False else None; star(c, 4, 12) if False else None
star(c, 7, 16)
pts = [(6, 19), (8, 21), (6, 23), (10, 24)]
for a, b in zip(pts, pts[1:]): line(c, a, b, BL, 4)
for p in pts: star(c, *p)
star(c, 9, 6) if False else None
# 아래 봉 + 술
c.r(2, 28, 13, 28, W_, 5); c.r(2, 29, 13, 29, W_, 3); c.p(1, 28, BR, 5); c.p(1, 29, BR, 3); c.p(14, 28, BR, 4); c.p(14, 29, BR, 2)
for x in (4, 7, 8, 11): c.p(x, 30, G, 4)
for x in (4, 11): c.p(x, 31, G, 3)
c.p(7, 31, G, 5); c.p(8, 31, G, 3)
c.emit('w24-E.pxg')
# ---------------- F : 놋쇠 천체 고리 + 긴 성도판
c = Cv(16, 32)
# 위 고리(아스트롤라베) 지름 12
for a in range(0, 360, 4):
    x = round(7.5 + 6.2 * math.cos(math.radians(a))); y = round(6.5 + 6.2 * math.sin(math.radians(a)))
    t = 5 if (x + y) < 14 else 3
    c.p(x, y, BR, t)
for a in range(0, 360, 4):
    x = round(7.5 + 4.2 * math.cos(math.radians(a))); y = round(6.5 + 4.2 * math.sin(math.radians(a)))
    c.p(x, y, BR, 3)
for x in range(2, 14): c.p(x, 6, BR, 4) if (x, 6) not in c.c else None
for y in range(1, 13): c.p(7, y, BR, 4) if (7, y) not in c.c else None
# 십자 살
c.row(6, 6, '66', BR); c.row(7, 6, '55', BR)
c.p(7, 0, BR, 6)
# 별 몇 개 (고리 안쪽)
c.p(5, 4, Y, 6); c.p(10, 9, Y, 6); c.p(10, 4, Y, 5)
# 매다는 사슬
c.p(7, 13, BR, 3); c.p(8, 14, BR, 3)
# 아래 성도 판 (좁은 나무 액자)
c.r(2, 15, 13, 15, W_, 2); c.r(2, 16, 13, 30, W_, 2)
c.r(3, 16, 12, 29, W_, 5); c.r(12, 16, 12, 29, W_, 3); c.r(3, 29, 12, 29, W_, 3)
c.r(4, 17, 11, 28, BL, 1)
c.r(4, 23, 11, 28, BL, 2)
pts = [(6,19),(9,21),(6,24),(9,26)]
for a, b in zip(pts, pts[1:]): line(c, a, b, BL, 4)
for i, p in enumerate(pts): star(c, *p, big=(i == 1))
c.p(10, 18, Y, 4); c.p(5, 22, Y, 4); c.p(10, 23, Y, 4) if False else None
c.r(3, 31, 12, 31, W_, 1)
c.emit('w24-F.pxg')
