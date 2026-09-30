from h5_common import *
# grave: g0..m6  hmoss n0..r4  night s0..x5
def cross(c, tone_shift=0):
    # 받침 (두껍게)
    c.rect(3, 22, 10, 8, 'j'); c.hl(3, 22, 10, 'm'); c.vl(3, 22, 8, 'l'); c.vl(12, 23, 7, 'i'); c.hl(3, 29, 10, 'h')
    c.hl(2, 29, 12, 'h'); c.hl(2, 30, 12, 'g'); c.px(2, 29, 'j'); c.px(13, 29, 'h')
    # 기둥
    c.rect(6, 9, 4, 14, 'k'); c.vl(6, 9, 14, 'l'); c.vl(9, 9, 14, 'i'); c.vl(8, 10, 12, 'j') if False else None
    # 가로 팔 (끝이 넓어짐)
    c.rect(3, 9, 10, 3, 'k'); c.hl(3, 9, 10, 'm'); c.vl(3, 9, 3, 'm'); c.hl(3, 11, 10, 'i')
    c.rect(2, 8, 2, 5, 'k'); c.vl(2, 8, 5, 'm'); c.hl(2, 8, 2, 'm'); c.hl(2, 12, 2, 'h')
    c.rect(12, 8, 2, 5, 'j'); c.vl(13, 8, 5, 'h'); c.hl(12, 8, 2, 'l'); c.hl(12, 12, 2, 'h')
    # 윗 기둥
    c.rect(6, 2, 4, 8, 'k'); c.vl(6, 2, 8, 'l'); c.vl(9, 2, 8, 'i'); c.hl(6, 2, 4, 'm'); c.hl(6, 2, 1, 'm')
    c.vl(6, 3, 1, 'm')
    # 십자 만나는 곳 밝게
    c.rect(7, 9, 2, 3, 'k')
    # 금 한 줄, 이끼, 풀
    for (x, y) in ((8, 14), (8, 15), (7, 16), (7, 17), (8, 18), (8, 19), (7, 20)): c.px(x, y, 'h')
    for (x, y, ch) in ((7, 3, 'p'), (8, 3, 'o'), (3, 22, 'p'), (4, 22, 'q'), (5, 23, 'o'), (12, 24, 'o'), (3, 27, 'p'), (2, 9, 'p'), (6, 21, 'o')): c.px(x, y, ch)
def grass(c, y=30, big=True):
    for (x, h, ch) in ((1, 3, 'w'), (2, 2, 'v'), (14, 3, 'w'), (13, 2, 'u'), (0, 2, 'v'), (15, 2, 'v')):
        for k in range(h): c.px(x, y - k + 1, ch)
    c.px(1, y - 3 + 1, 'x') ; c.px(14, y - 3 + 1, 'x')
    c.hl(0, 31, 16, 't') if big else None
    c.hl(0, 31, 2, 'u'); c.hl(13, 31, 3, 'u')

# ---- A
c = C(16, 32); cross(c); grass(c)
save('gravestone_cross', 'h5-A', c, L, '돌 십자 비석: 팔 끝 넓어지는 십자, 두꺼운 받침, 윗·왼면 밝은 한 단, 금 한 줄, 이끼 점, 발치 풀')

# ---- B : 달빛(반투명 ? 대신 위쪽 밝음) + 접지 그림자
c = C(16, 32); cross(c); grass(c)
for (x, y) in ((6, 2), (7, 2), (8, 2), (9, 2), (6, 3), (6, 4), (6, 5), (6, 6), (6, 7), (2, 8), (3, 8), (3, 9), (4, 9), (5, 9)): c.px(x, y, 'm')
c.rect(9, 3, 1, 6, 'h'); c.rect(11, 10, 3, 3, 'h'); c.rect(8, 12, 2, 10, 'h')
c.vl(11, 23, 7, 'h')
for x in range(13, 16): c.px(x, 30, '~')
for x in range(2, 16): c.px(x, 31, '~')
save('gravestone_cross', 'h5-B', c, L, '달빛이 왼쪽 위 가장자리만 훑어 밝고 오른쪽·아래는 어둡게 눌림, 오른쪽 아래로 반투명 긴 그림자')

# ---- C : 기울고 한 팔이 부러진 십자, 아래 흙이 솟음
c = C(16, 32); cross(c); grass(c)
c.rect(2, 8, 4, 5, '.'); c.rect(2, 8, 3, 1, '.')
c.rect(5, 9, 1, 3, 'k'); c.px(5, 9, 'm'); c.px(5, 12, 'h')
for (x, y) in ((4, 10), (4, 12), (3, 11)): c.px(x, y, 'h')          # 부러진 조각 파편
c.px(3, 30, 'k'); c.px(4, 30, 'j'); c.px(2, 29, 'j')
for y in range(24, 31): c.px(2, y, 't') if False else None
# 흙무더기 앞에서 솟음
for (x, y, ch) in ((0, 30, 'S'), (1, 30, 'S')): pass
shear(c, lambda y: 2 if y < 7 else (1 if y < 14 else (0 if y < 20 else 0)))
for x in range(0, 16):
    if c.g[30][x] == '.': c.px(x, 30, 'B')
for x in range(1, 15): c.px(x, 31, 'B') if c.g[31][x] in '.' else None
save('gravestone_cross', 'h5-C', c, L, '왼쪽 팔이 부러져 떨어져 나가고 위가 오른쪽으로 기운 십자, 발치에 파편 조각과 흙무더기')

# ================= 둥근 비석 16x16
def rnd(c):
    rows = {1: (5, 10), 2: (4, 11), 3: (3, 12)}
    for y in range(4, 13): rows[y] = (3, 12)
    for y, (a, b) in rows.items():
        c.hl(a, y, b - a + 1, 'k')
    for y, (a, b) in rows.items():
        c.px(a, y, 'l'); c.px(b, y, 'i')
    c.hl(5, 1, 6, 'm'); c.px(4, 2, 'm'); c.px(3, 3, 'm'); c.vl(3, 4, 9, 'l') if False else None
    for y in range(3, 13): c.px(3, y, 'm' if y < 8 else 'l')
    for y in range(3, 13): c.px(12, y, 'h')
    c.hl(2, 13, 12, 'i'); c.hl(2, 14, 12, 'h'); c.px(2, 13, 'k'); c.hl(1, 15, 14, 'g')
    c.hl(3, 12, 10, 'i')
    # 글씨 자국
    c.hl(5, 5, 6, 'h'); c.hl(5, 7, 4, 'h'); c.hl(6, 9, 5, 'h')
    # 금: 대각선
    for (x, y) in ((11, 2), (10, 3), (10, 4), (9, 5), (9, 6), (8, 7), (8, 8), (7, 9), (7, 10), (6, 11)): c.px(x, y, 'g')
    for (x, y, ch) in ((6, 1, 'p'), (7, 1, 'o'), (8, 1, 'p'), (5, 2, 'q'), (4, 2, 'o'), (4, 3, 'p'), (3, 13, 'o')): c.px(x, y, ch)
    c.hl(4, 1, 1, '.')
c = C(16, 16); rnd(c)
for (x, h) in ((1, 2), (13, 2), (14, 3)):
    for k in range(h): c.px(x, 14 - k, 'v')
save('gravestone_round', 'h5-A', c, L, '위가 둥근 비석: 글씨 자국 줄 셋(읽히지 않음), 대각 금, 윗면 이끼, 왼쪽 위 밝은 한 단')

c = C(16, 16); rnd(c)
for (x, y) in ((4, 2), (5, 1), (6, 1), (7, 1), (8, 1), (9, 1), (3, 3), (3, 4), (3, 5)): c.px(x, y, 'm')
c.rect(9, 7, 3, 5, 'h'); c.vl(11, 3, 4, 'h')
for x in range(4, 16): c.px(x, 15, '~')
for x in range(13, 16): c.px(x, 14, '~')
for (x, h) in ((1, 2), (13, 2), (14, 3)):
    for k in range(h): c.px(x, 14 - k, 'v')
save('gravestone_round', 'h5-B', c, L, '십자 비석과 같은 방향으로 왼쪽 위만 밝게, 오른쪽·아래는 눌리고 접지 그림자가 오른쪽 아래로 길다')

c = C(16, 16); rnd(c)
# 금이 갈라져 오른쪽 위 조각이 어긋남
for y in range(1, 8):
    for x in range(9, 13):
        if c.g[y][x] != '.': c.px(x + 1 if x + 1 < 16 else x, y + 1, c.g[y][x]); c.px(x, y, '.')
for (x, y) in ((10, 3), (9, 4), (9, 5), (8, 6), (8, 7), (9, 8)): c.px(x, y, 'g')
c.px(12, 2, 'g') if False else None
for x in range(3, 14): c.px(x, 14, 'x') if False else None
for x in range(1, 15):
    if c.g[15][x] == 'g': c.px(x, 15, 'S')
c.hl(4, 15, 8, 'T')
for (x, h) in ((1, 2), (13, 2), (14, 3)):
    for k in range(h): c.px(x, 14 - k, 'v')
save('gravestone_round', 'h5-C', c, L, '금을 따라 오른쪽 위가 어긋나 벌어진 비석, 발치 흙에 검붉은 얼룩이 스며 있다')
