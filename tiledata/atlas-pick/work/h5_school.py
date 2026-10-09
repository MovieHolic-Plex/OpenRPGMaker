from h5_common import *
NA = ['##....##..', '##....##..', '##....##..', '##....####', '##....####', '##....##..', '##....##..', '######.##.', '######.##.']
GA = ['#####.##..', '#####.##..', '...##.##..', '...##.##..', '...##.####', '...##.####', '...##.##..', '...##.##..', '...##.##..']
def glyph(c, x, y, rows, ch, ch2=None):
    for j, r in enumerate(rows):
        for i, t in enumerate(r):
            if t == '#': c.px(x + i, y + j, ch)

def board(c, crack=False):
    # 나무 테
    c.rect(0, 0, 48, 14, 'D'); c.hl(0, 0, 48, 'F'); c.vl(0, 0, 14, 'F'); c.hl(1, 1, 46, 'E'); c.hl(0, 13, 48, 'B'); c.vl(47, 1, 13, 'B'); c.vl(46, 2, 11, 'C')
    # 판
    c.rect(2, 2, 44, 11, 'J'); c.hl(2, 2, 44, 'I'); c.vl(2, 2, 11, 'I'); c.hl(2, 12, 44, 'K'); c.vl(45, 3, 10, 'K')
    # 분필 받침
    c.rect(0, 14, 48, 2, 'C'); c.hl(0, 14, 48, 'E'); c.hl(0, 15, 48, 'A')
    for (x, y) in ((0,0),(1,0),(0,1),(46,0),(47,0),(47,1),(0,15),(47,15),(0,14),(47,14)): c.px(x, y, '.')
    c.hl(5, 14, 4, 'Q'); c.hl(11, 14, 2, 'P'); c.px(38, 14, 'Q')       # 분필 토막

def smudge(c, seed_pts, ch):
    for (x, y, n) in seed_pts: c.hl(x, y, n, ch)

def bloodtext(c, dx=0, dy=3, hi='V', lo='U'):
    glyph(c, 14 + dx, dy, NA, hi); glyph(c, 26 + dx, dy, GA, hi)

# ---- A : 분필이 지워지다 만 번짐 + 붉은 나가
c = C(48, 16); board(c)
for (x, y, n) in ((4, 3, 7), (6, 4, 9), (4, 6, 6), (36, 3, 8), (38, 5, 7), (37, 8, 9), (5, 9, 8), (8, 10, 6), (40, 10, 4)): c.hl(x, y, n, 'L' if False else 'K')
for (x, y, n) in ((4, 5, 5), (37, 4, 5), (6, 8, 4), (40, 7, 3)): c.hl(x, y, n, 'N')
for (x, y, n) in ((5, 3, 2), (38, 9, 2)): c.hl(x, y, n, 'P')
for k in range(5): c.px(3 + k, 11, 'M')
glyph(c, 14, 3, NA, 'W'); glyph(c, 26, 3, GA, 'W')
for j in range(9):
    for i in range(10):
        pass
for (x, y) in ((14, 3), (15, 3), (14, 4), (15, 4), (26, 3), (27, 3), (26, 4), (27, 4), (31, 3), (32, 3)): c.px(x, y, 'X')
for x, n in ((15, 2), (23, 1), (27, 2), (32, 1)): c.vl(x, 12, n, 'V')
c.vl(23, 11, 1, 'V')
save('broken_blackboard', 'h5-A', c, L, '학교 칠판: 나무 테·녹색 판·분필 받침, 분필 낙서가 지워지다 만 흰 번짐, 붉은 「나가」 두 자(2px) 획 끝이 아래로 흐름')

# ---- B : 왼쪽 위 창문 빛 띠(반투명 달빛) + 글씨가 빛 속에서 젖은 듯 반짝, 모서리 금
c = C(48, 16); board(c)
for (x, y, n) in ((5, 4, 8), (7, 5, 6), (40, 9, 5), (38, 10, 6)): c.hl(x, y, n, 'K')
for (x, y, n) in ((6, 6, 5), (39, 4, 4)): c.hl(x, y, n, 'M')
glyph(c, 14, 3, NA, 'W'); glyph(c, 26, 3, GA, 'W')
for (x, y, dx) in ((14, 3, 0), (26, 3, 0)):
    for j in range(9): c.px(x, y + j, 'X') if (NA if x == 14 else GA)[j][0] == '#' else None
for x in (15, 27): c.px(x, 3, 'X')
for x, n in ((14, 3), (22, 2), (27, 3), (32, 2)): c.vl(x, 12, n, 'V')
# 빛 띠: 대각 반투명
for y in range(2, 13):
    for x in range(2 + (y - 2) // 2 * 2, 2 + (y - 2) // 2 * 2 + 4):
        if 2 <= x < 46 and c.g[y][x] in 'JIK': pass
# 반투명 달빛 띠 두 줄
for y in range(2, 13):
    x0 = 30 - y * 2
    for x in range(x0, x0 + 3):
        if 2 <= x < 46 and c.g[y][x] in 'JIK': c.px(x, y, '%')
for y in range(2, 13):
    x0 = 42 - y * 2
    for x in range(x0, x0 + 2):
        if 2 <= x < 46 and c.g[y][x] in 'JIK': c.px(x, y, '%')
# 오른쪽 어둠 눌림
c.rect(38, 2, 7, 10, 'K') if False else None
save('broken_blackboard', 'h5-B', c, L, '창 빛이 대각 띠로 칠판에 떨어져 번짐(반투명), 붉은 글씨 왼쪽 획이 밝게 번쩍이고 흘러내린 자국이 더 길다')

# ---- C : 글씨가 판 전체를 덮지 않고 「나가」만, 대신 판이 금가고 귀퉁이 조각 떨어짐, 판이 검다
c = C(48, 16); board(c)
# 오른쪽 위 귀퉁이 금·조각 결손
for (x, y) in ((40, 2), (41, 3), (41, 4), (42, 5), (43, 5), (43, 6), (44, 7), (44, 8), (45, 9)): c.px(x, y, 'H')
c.rect(43, 2, 3, 3, 'H'); c.px(43, 2, 'D'); c.px(44, 3, 'D')
for (x, y) in ((41, 2), (42, 3), (42, 4)): c.px(x, y, 'K') if False else None
c.hl(4, 4, 6, 'K'); c.hl(4, 7, 4, 'N'); c.hl(4, 9, 6, 'K')
for x0 in (14, 26):
    for y in range(3, 12): pass
glyph(c, 14, 3, NA, 'V'); glyph(c, 26, 3, GA, 'V')
glyph(c, 14, 3, [r if i > 5 else r for i, r in enumerate(NA)], 'V')
# 손자국: 글씨 오른쪽 옆 손바닥 붉은 지문 네 줄
for k in range(4): c.vl(38 + k * 2, 5 + (k % 2), 4, 'U')
c.hl(38, 9, 7, 'U')
for x, n in ((16, 3), (28, 2), (35, 1)): c.vl(x, 12, n, 'T')
c.px(3, 15, 'N') if False else None
save('broken_blackboard', 'h5-C', c, L, '오른쪽 위 귀퉁이 조각이 떨어진 큰 금, 글씨 옆에 피 묻은 손가락 네 줄 자국(손으로 쓴 느낌)')
