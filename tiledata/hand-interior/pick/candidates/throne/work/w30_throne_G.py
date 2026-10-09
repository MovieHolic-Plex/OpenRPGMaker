# w30-G: 부채 등판 옥좌: 부채꼴 등판(금 테)+붉은 벨벳에 금 방사 살, 붉은 방석, 금 사자머리 팔걸이, 보라 카펫 단상
import sys, math; sys.path.insert(0, 'work')
from w24_lib import Cv
c = Cv(48, 32)
G, R, B, P = 'gold', 'red', 'blue', 'purple'
# 단상: 금 테두리 + 보라 카펫(금 줄)
c.r(1, 29, 23, 29, G, 5); c.r(1, 30, 23, 31, P, 3); c.r(1, 31, 23, 31, P, 2); c.r(1, 30, 1, 31, G, 3)
c.r(1, 30, 23, 30, P, 4)
for x in range(3, 24, 6): c.p(x, 30, G, 5)
c.r(6, 27, 23, 27, G, 5); c.r(6, 28, 23, 28, P, 3); c.p(6, 28, G, 3)
# 좌석
c.r(9, 24, 23, 26, G, 4); c.r(9, 24, 23, 24, G, 5); c.r(9, 26, 23, 26, G, 2)
for x in (11, 15, 19): c.r(x, 25, x + 1, 25, P, 3)
c.r(10, 21, 23, 21, R, 5); c.r(10, 22, 23, 23, R, 4); c.r(10, 23, 23, 23, R, 3)
# 사자머리 팔걸이 (금)
c.r(5, 16, 11, 16, G, 5); c.r(5, 17, 11, 17, G, 4); c.r(5, 18, 11, 18, G, 3)
c.r(4, 15, 6, 18, G, 4); c.p(4, 15, G, 5); c.p(5, 15, G, 6); c.p(4, 16, G, 6); c.p(5, 17, G, 2) ; c.p(4, 18, G, 2)
c.p(5, 16, B, 5)  # 눈(보석)
c.r(7, 19, 9, 25, G, 3); c.r(7, 19, 7, 25, G, 2); c.r(8, 19, 8, 25, G, 5)
# 부채 등판
cx, cy = 23.5, 20.0
for y in range(0, 21):
    for x in range(8, 24):
        dx, dy = x + 0.5 - 24, y + 0.5 - cy
        d = math.hypot(dx * 0.95, dy)
        if d <= 19.6 and (y <= 20):
            if d > 18.2: c.p(x, y, G, 2 if x < 12 else 3)
            elif d > 16.8: c.p(x, y, G, 5 if d < 17.6 else 4)
            else:
                ang = math.atan2(-dy, -dx) if dx != 0 else 1.57   # 왼쪽이 0
                c.p(x, y, R, 3)
# 방사 살 (금) + 안쪽 보라 명암
for y in range(1, 21):
    for x in range(8, 24):
        v = c.c.get((x, y))
        if not v or v[0] != R: continue
        dx, dy = x + 0.5 - 24, y + 0.5 - cy
        d = math.hypot(dx * 0.95, dy)
        a = math.atan2(-dy, -dx)   # 0..pi/2 (왼쪽 위)
        s = (a / (math.pi / 10))
        if abs(s - round(s)) < 0.16 and d > 5: c.p(x, y, G, 4 if int(d) % 3 else 5)
        elif d < 5: c.p(x, y, R, 4 if d > 3 else 5)
        elif int(s) % 2 == 0: c.p(x, y, R, 2)
# 정수리 보석(청)
c.r(22, 0, 23, 0, G, 6); c.r(22, 1, 23, 2, B, 4); c.p(23, 1, B, 6); c.p(22, 1, B, 5); c.r(22, 3, 23, 3, G, 5)
# 등판 뒤 기둥 받침 (좌석 옆 금 몸통)
c.r(9, 17, 10, 22, G, 3); c.r(9, 17, 9, 22, G, 2); c.r(10, 17, 10, 22, G, 4)
c.mirror(24, dark=0)
c.dim(34, 0, 47, 27, -1, ('gold', 'red', 'purple'))
c.emit('w30-G.pxg')
c.show()
