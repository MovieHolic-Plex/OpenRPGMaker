import sys; sys.path.insert(0, 'work')
from w24_lib import Cv
c = Cv(48, 32)
G, R, M, B, P = 'gold', 'red', 'marble', 'blue', 'purple'
# 받침판: 금 모서리 대리석 단
c.r(3, 26, 23, 26, M, 5); c.r(2, 27, 23, 27, M, 4)
c.r(1, 28, 23, 28, G, 5); c.p(1, 28, G, 3)
c.r(1, 29, 23, 30, M, 3); c.r(1, 29, 1, 30, M, 2); c.r(2, 31, 23, 31, M, 1)
for x in (5, 11, 17): c.r(x, 29, x + 3, 30, R, 3); c.r(x, 29, x + 3, 29, R, 4)
c.r(6, 26, 23, 26, M, 3)
# 높은 뾰족 첨탑 (가운데) + 모서리 첨탑
c.row(0, 23, '6', G); c.row(1, 23, '5', G); c.row(2, 22, '.5', G); c.row(2, 23, '5', G) if False else None
c.row(1, 22, '5', G); c.row(2, 22, '56', G); c.row(3, 22, '45', G) if False else None
c.row(3, 22, '44', B); c.row(4, 22, '56', B) if False else None
c.row(4, 22, '34', B) if False else None
# 천개(캐노피): 금 지붕 + 붉은 술 달린 가리개
c.row(5, 8, '..3555555555555', G) if False else None
c.r(8, 5, 23, 5, G, 5); c.r(8, 6, 23, 6, G, 4); c.r(8, 7, 23, 7, G, 3)
c.r(7, 6, 7, 7, G, 2)
c.row(4, 12, '..55555555', G) if False else None
c.r(19, 4, 23, 4, G, 5); c.r(20, 3, 23, 3, G, 5)
c.row(2, 22, '56', G); c.row(3, 22, '45', G)
c.row(4, 19, '55', G)
# 술 달린 붉은 가리개 (밸런스)
c.r(7, 8, 23, 8, R, 5); c.r(7, 9, 23, 9, R, 4); c.r(7, 10, 23, 10, R, 3)
for x in range(7, 24, 3): c.p(x, 11, G, 5); c.p(x + 1, 11, G, 4)
for x in range(8, 24, 3): c.p(x, 11, R, 2)
# 모서리 첨탑
c.row(1, 7, '6', G); c.row(2, 7, '5', G); c.row(3, 6, '.5', G) if False else None
c.row(3, 7, '5', G); c.row(4, 6, '.4', G) if False else None
c.row(4, 7, '4', G)
c.row(0, 7, '6', G) if False else None
# 기둥 (금, 모서리)
c.r(7, 12, 7, 25, G, 2); c.r(8, 12, 8, 25, G, 5); c.r(9, 12, 9, 25, G, 4)
# 등판 안쪽 (짙은 붉은 + 금 세로띠)
c.r(10, 12, 23, 22, R, 2)
for y in range(12, 23): c.p(12, y, R, 3); c.p(16, y, R, 3); c.p(20, y, R, 3)
for x in (14, 18): 
    for y in range(12, 22): c.p(x, y, G, 4 if (y % 4) else 6)
c.r(10, 12, 10, 22, R, 1)
# 중앙 문양 (청 보석 + 금 무늬)
c.row(14, 22, '55', G); c.row(15, 21, '4666', G) if False else None
c.row(15, 22, '56', B); c.row(16, 22, '44', B); c.row(17, 22, '33', B)
c.row(14, 21, '4', G); c.row(15, 21, '5', G); c.row(16, 21, '4', G); c.row(17, 21, '3', G); c.row(18, 22, '33', G)
# 팔걸이·방석
c.r(3, 17, 8, 17, R, 5); c.r(3, 18, 8, 18, R, 4); c.r(3, 19, 8, 19, R, 3)
c.r(3, 20, 8, 25, G, 4); c.r(3, 20, 3, 25, G, 2); c.r(4, 20, 4, 25, G, 5)
c.row(22, 5, '56', B); c.row(23, 5, '34', B)
c.r(10, 20, 23, 20, R, 5); c.r(10, 21, 23, 22, R, 4); c.r(10, 23, 23, 23, G, 4)
c.r(9, 24, 23, 24, G, 4); c.r(9, 25, 23, 25, G, 2)
for x in (11, 14, 17, 20): c.p(x, 24, G, 6)
c.mirror(24, dark=0)
c.dim(34, 0, 47, 26, -1, ('gold', 'red'))
c.dim(24, 26, 47, 31, -1, ('marble',))
c.emit('w24-F.pxg')
c.show()
