# w30-E: 고딕 뾰족아치 첨탑 옥좌: 높은 뾰족 등판+정수리 첨탑·청옥, 아치 안 붉은 벨벳+금 세로 패널, 사자발 팔걸이, 3단 금 단상
import sys; sys.path.insert(0, 'work')
from w24_lib import Cv
c = Cv(48, 32)
G, R, B = 'gold', 'red', 'blue'
# 3단 단상: 금 테 + 붉은 카펫 앞판
c.r(2, 30, 23, 30, G, 5); c.r(2, 31, 23, 31, G, 2); c.p(2, 31, G, 1)
c.r(5, 28, 23, 28, G, 5); c.r(5, 29, 23, 29, R, 3); c.r(5, 29, 5, 29, G, 3)
c.r(8, 26, 23, 26, G, 4); c.r(8, 27, 23, 27, R, 4); c.r(8, 27, 23, 27, R, 3) 
for x in range(9, 24, 4): c.p(x, 27, R, 5)
for x in range(6, 24, 4): c.p(x, 29, R, 4)
# 좌석부: 금 앞판 + 붉은 방석
c.r(10, 23, 23, 25, G, 4); c.r(10, 23, 23, 23, G, 5); c.r(10, 25, 23, 25, G, 2)
for x in (12, 16, 20): c.r(x, 24, x + 1, 24, R, 3)
c.r(10, 20, 23, 20, R, 5); c.r(10, 21, 23, 22, R, 4); c.r(10, 22, 23, 22, R, 3)
# 사자발 팔걸이: 금 패드+발
c.r(6, 15, 11, 15, G, 5); c.r(6, 16, 11, 16, G, 4); c.r(6, 17, 11, 17, G, 3)
c.r(7, 18, 8, 24, G, 3); c.r(7, 18, 7, 24, G, 2); c.r(8, 19, 8, 24, G, 5)
c.row(25, 6, '3443', G); c.row(26, 5, '.44', G) if False else None
c.p(6, 14, G, 5); c.p(7, 14, G, 6); c.p(6, 15, G, 6)
c.r(7, 17, 9, 17, R, 3) if False else None
# 뾰족 아치 등판
for x in range(10, 24):
    top = 1 + round((23 - x) * 0.62)
    top = max(top, 1)
    for y in range(top, 20):
        c.p(x, y, G, 4)
    for y in range(top, top + 1): c.p(x, y, G, 6 if x % 3 == 0 else 5)
    for y in range(top + 3, 20): c.p(x, y, R, 3)
    c.p(x, top + 3, R, 2)
    c.p(x, top + 1, G, 5); c.p(x, top + 2, G, 3)
# 기둥(양옆)
c.r(9, 9, 11, 24, G, 3); c.r(9, 9, 9, 24, G, 2); c.r(10, 9, 10, 24, G, 5); c.r(11, 10, 11, 20, G, 4)
c.r(12, 10, 12, 19, R, 1)
# 안쪽 세로 금 패널 + 붉은 골
for x in (16, 20):
    for y in range(9, 20): c.p(x, y, R, 4 if x == 16 else 4)
for x in (18,):
    for y in range(8, 20): c.p(x, y, G, 4 if y % 5 else 6)
for (x, y) in ((14, 13), (14, 17), (22 - 1, 13), (21, 17), (16, 15), (20, 15), (14, 10), (16, 11)): c.p(x, y, G, 5) if x != 18 else None
# 아치 위 크로켓 + 정수리 첨탑 + 청옥
c.p(10, 8, G, 6); c.p(11, 7, G, 5)
c.p(13, 6, G, 6); c.p(16, 4, G, 6); c.p(19, 2, G, 6) 
c.p(23, 0, G, 6); c.r(23, 1, 23, 2, G, 5)
c.r(22, 3, 23, 5, B, 4); c.p(23, 3, B, 6); c.p(22, 4, B, 5); c.p(23, 4, B, 5); c.p(22, 5, B, 3); c.p(23, 5, B, 3)
c.r(21, 3, 21, 5, G, 3) if False else None
# 기둥 끝 뾰족 장식
c.row(6, 9, '.5', G) if False else None
c.p(10, 6, G, 5); c.p(10, 7, G, 4); c.p(10, 5, G, 6)
c.mirror(24, dark=0)
c.dim(34, 0, 47, 26, -1, ('gold', 'red'))
c.emit('w30-E.pxg')
c.show()
