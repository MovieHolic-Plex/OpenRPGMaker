import sys, math; sys.path.insert(0, 'work')
from w24_lib import Cv
c = Cv(48, 32)
G, R, M, B, S = 'gold', 'red', 'marble', 'blue', 'stone'
# 받침판: 돌 단 + 붉은 융단 띠
c.r(3, 27, 23, 27, S, 5); c.p(3, 27, S, 3)
c.r(2, 28, 23, 29, S, 4); c.r(2, 28, 23, 28, S, 5); c.r(2, 29, 23, 29, S, 3)
c.r(2, 30, 23, 30, S, 2); c.r(3, 31, 23, 31, S, 1)
c.r(2, 29, 23, 29, G, 4)
c.r(14, 27, 23, 27, R, 4); c.r(16, 28, 23, 28, R, 4); c.r(16, 29, 23, 30, R, 3)
c.r(14, 27, 15, 27, R, 5)
# 부채살 등판: 중심 (23.5, 21), 반지름 17.5
cx, cy = 23.5, 21.0
for y in range(2, 22):
    for x in range(4, 24):
        dx, dy = x + 0.5 - 24, cy - (y + 0.5)
        d = math.hypot(dx, dy)
        if d > 18.5 or dy < 0: continue
        ang = math.degrees(math.atan2(dy, -dx))   # 0 = 왼쪽 수평, 90 = 위
        if d > 16.0:
            c.p(x, y, G, 5 if ang > 40 else 4)      # 금 테두리
        elif d > 15.0:
            c.p(x, y, G, 2)
        elif d > 6.5:
            k = int(ang // 30)                       # 5 줄기 (반쪽)
            if k % 2 == 0: c.p(x, y, R, 3 if d < 11 else 4)
            else: c.p(x, y, G, 4 if d < 12 else 5)
        elif d > 5.5:
            c.p(x, y, G, 3)
        else:
            c.p(x, y, R, 3)
# 살 경계선 (어두운 줄)
for y in range(2, 22):
    for x in range(4, 24):
        dx, dy = x + 0.5 - 24, cy - (y + 0.5); d = math.hypot(dx, dy)
        if 6.5 < d <= 15.0 and dy >= 0:
            ang = math.degrees(math.atan2(dy, -dx))
            if abs(ang % 30) < 2.2 and (x, y) in c.c:
                r, t = c.c[(x, y)]; c.p(x, y, r, max(1, t - 2))
# 중앙 보석 홍옥 + 금 틀
c.row(13, 22, '55', G); c.row(14, 21, '4666', G) if False else None
c.row(15, 22, '56', R); c.row(16, 22, '55', R); c.row(17, 22, '44', R)
c.row(14, 22, '55', G)
# 정수리 왕관 구슬
c.row(1, 22, '56', G); c.row(0, 23, '6', G)
c.row(2, 21, '3443', G) if False else None
# 팔걸이(붉은 쿠션 + 금 받침)
c.row(17, 3, '..2444', R) if False else None
c.r(3, 19, 9, 19, R, 5); c.r(3, 20, 9, 20, R, 4); c.r(3, 21, 9, 21, R, 3)
c.r(3, 22, 9, 22, G, 4); c.r(4, 23, 9, 26, G, 4); c.r(4, 23, 4, 26, G, 2); c.r(5, 23, 5, 26, G, 5)
c.row(23, 7, '6', G)
c.row(24, 6, '56', B); c.row(25, 6, '34', B)
# 방석 / 앞치마
c.r(10, 21, 23, 21, R, 5); c.r(10, 22, 23, 22, R, 4); c.r(10, 23, 23, 23, R, 3)
c.r(10, 24, 23, 25, G, 4); c.r(10, 24, 23, 24, G, 5); c.r(10, 26, 23, 26, G, 2)
for x in (12, 15, 18): c.p(x, 25, G, 6)
c.row(24, 22, '55', B); c.row(25, 22, '34', B)
c.mirror(24, dark=0)
c.dim(34, 0, 47, 26, -1, ('gold', 'red'))
c.dim(24, 26, 47, 31, -1, ('stone',))
c.emit('w24-E.pxg')
c.show()
