from h5_lib import *
L = {}
for i in range(7): L[str(i)] = ('tin', i)
for i, ch in enumerate('pqrstuv'): L[ch] = ('sheet', i)
for i, ch in enumerate('ABCDEF'): L[ch] = ('blood', i)
for i, ch in enumerate('mnoOPQ'): L[ch] = ('murk', i)
for i, ch in enumerate('xyzw'): L[ch] = ('void', i)
for i, ch in enumerate('abcdef'): L[ch] = ('dust', i)
for i, ch in enumerate('GHIJKL'): L[ch] = ('rust', i)
for i, ch in enumerate('RSTUVW'): L[ch] = ('moon', i)
for i, ch in enumerate('ghijkl'): L[ch] = ('flame', i % 6)
for i, ch in enumerate('EFGHIJ'): pass
L['Z'] = ('rot', 3); L['Y'] = ('rot', 2); L['X'] = ('rot', 4)

def ell(c, cx, cy, rx, ry, ch):
    for j in range(-ry, ry + 1):
        for i in range(-rx, rx + 1):
            if (i * i) / (rx * rx + .3) + (j * j) / (ry * ry + .3) <= 1: c.px(cx + i, cy + j, ch)

def lamp(c, lit, dx=0, tilt=0):
    # 무영등: 매단 팔 + 원판 + 전구 점들
    c.vl(9 + dx, 0, 3, '3'); c.vl(10 + dx, 0, 3, '2')
    rows = {3: (3, 14), 4: (2, 15), 5: (2, 15), 6: (3, 14), 7: (5, 12)}
    for y, (a, b) in rows.items(): c.hl(a + dx, y + tilt, b - a + 1, '4')
    c.hl(3 + dx, 3 + tilt, 12, '6'); c.hl(2 + dx, 4 + tilt, 8, '5'); c.hl(5 + dx, 7 + tilt, 8, '2'); c.hl(11 + dx, 6 + tilt, 4, '3')
    c.vl(15 + dx, 5 + tilt, 1, '2'); c.px(2 + dx, 5 + tilt, '4')
    for x in (4, 7, 10, 13):
        c.px(x + dx, 4 + tilt, 'g' if lit else 'n'); c.px(x + dx, 5 + tilt, 'i' if lit else 'm')

def table(c, sheet=True, stain=True, shade_right=False):
    # 판
    c.rect(1, 14, 30, 6, '5'); c.hl(1, 14, 30, '6'); c.hl(1, 15, 30, '5'); c.vl(1, 14, 8, '6')
    c.rect(1, 20, 30, 3, '3'); c.hl(1, 20, 30, '4'); c.hl(1, 22, 30, '1')
    c.px(0, 15, '.'); c.vl(30, 15, 8, '2'); c.vl(31, 15, 7, '1')
    # 기둥 + 받침
    c.rect(13, 23, 5, 5, '3'); c.vl(13, 23, 5, '4'); c.vl(17, 23, 5, '2'); c.hl(13, 23, 5, '1')
    c.rect(7, 28, 18, 3, '3'); c.hl(7, 28, 18, '5'); c.hl(7, 30, 18, '1'); c.vl(24, 28, 3, '2'); c.px(6, 29, '.')
    if shade_right: c.rect(24, 15, 6, 5, '4')
    if sheet:
        rows = {9: (5, 7), 10: (4, 9), 11: (4, 10), 12: (4, 22), 13: (4, 24), 14: (5, 26), 15: (7, 28), 16: (8, 28), 17: (9, 28), 18: (10, 27)}
        for y, (a, b) in rows.items():
            c.hl(a, y, b - a + 1, 'u'); c.px(a, y, 't'); c.px(b, y, 's')
            c.px(b - 1, y, 's') if y > 12 else None
        c.hl(5, 9, 3, 'v'); c.hl(4, 10, 6, 'v'); c.hl(7, 12, 15, 'v'); c.hl(8, 13, 15, 'v')
        c.hl(9, 18, 18, 'q'); c.hl(10, 19, 17, 'p')
        c.vl(9, 12, 3, 'v')
        # 발끝 텐트
        c.rect(25, 12, 4, 2, 'u'); c.vl(28, 12, 3, 's'); c.px(25, 12, 'v')
        for k in range(4): c.px(12 + k * 2, 14 + (k % 2), 's')      # 주름
        c.px(17, 16, 's'); c.px(19, 16, 's'); c.px(21, 15, 't'); c.px(22, 15, 't')
        if stain:
            for (x, y, ch) in ((13, 13, 'D'), (14, 13, 'C'), (15, 14, 'D'), (13, 14, 'C'), (14, 14, 'B'), (14, 15, 'C'), (15, 15, 'B'), (14, 16, 'B'), (12, 14, 'D')):
                c.px(x, y, ch)

# ---------- 수술대 A
c = C(32, 32); table(c); lamp(c, False)
save('operating_table', 'h5-A', c, L, 'v5 쇠 기물 결로: 위에서 살짝 본 판·기둥·받침, 누런 천 아래 사람 윤곽과 가슴께 검붉은 얼룩, 왼쪽 위 무영등(전구 꺼짐)')

# ---------- B : 무영등 켜짐(빛 원뿔은 반투명 %), 접지 그림자
c = C(32, 32)
# 빛 원뿔: 등 밑에서 머리 쪽 판 위로
for y in range(8, 14):
    a = 3 - (y - 8) // 2; b = 14 + (y - 8) // 2
    c.hl(a, y, b - a + 1, '%')
table(c, stain=True); lamp(c, True)
c.hl(5, 8, 8, '.') if False else None
# 판 위 빛 맺힘(머리 쪽) - 밝게
c.hl(2, 14, 12, '6'); c.hl(2, 15, 8, '6')
c.rect(20, 15, 10, 5, '4'); c.rect(24, 16, 6, 4, '3')      # 오른쪽 어둡게
c.hl(6, 31, 20, '~'); c.hl(8, 31, 4, '-') if False else None
save('operating_table', 'h5-B', c, L, '무영등이 다시 켜진 순간: 등 밑 반투명 따뜻한 빛 원뿔이 머리 쪽 판을 비추고 발치 쪽은 어두움, 전구 노란 점, 받침 밑 반투명 그림자')

# ---------- C : 빈 판 + 가죽 끈 + 모서리에서 떨어지는 피 (등은 꺾여 매달림)
c = C(32, 32); table(c, sheet=False); lamp(c, False, dx=8, tilt=0)
# 등 팔이 꺾임: 2px 밀린 원판
c.vl(17, 3, 1, '2')
# 끈 (양옆 늘어짐)
for x0 in (6, 22):
    c.rect(x0, 13, 3, 1, 'Z'); c.vl(x0, 14, 1, 'Y')
    c.vl(x0 + 1, 21, 7, 'Z'); c.vl(x0, 21, 6, 'Y'); c.px(x0 + 1, 28, 'Y')
# 판 위 얼룩 자국(사람 모양 번짐)
for (x, y) in ((7, 15), (8, 15), (9, 16), (10, 16), (11, 16), (12, 17), (13, 17), (14, 17), (15, 17), (16, 17), (17, 17), (18, 16), (19, 16), (20, 15), (21, 15)):
    c.px(x, y, 'B'); c.px(x, y - 1, 'C') if x % 3 else None
c.rect(9, 15, 6, 2, 'C'); c.rect(18, 15, 3, 2, 'B')
# 모서리에서 떨어지는 피
c.vl(26, 22, 5, 'C'); c.px(26, 27, 'D'); c.px(26, 28, 'B'); c.vl(27, 22, 2, 'B')
c.rect(24, 30, 6, 1, 'B')
save('operating_table', 'h5-C', c, L, '몸 없는 수술대: 판에 사람 모양으로 번진 핏자국, 늘어진 가죽 끈 둘, 판 모서리에서 피가 떨어져 바닥에 고임. 등은 꺾여 오른쪽으로 쏠려 매달림')

# ================== 수레 16x16
def tray(c, lit_edge=True):
    # 윗판(트레이)
    c.rect(1, 3, 14, 7, '3'); c.hl(1, 3, 14, '5'); c.vl(1, 3, 7, '5'); c.hl(1, 9, 14, '1'); c.vl(14, 4, 6, '2')
    c.rect(2, 4, 12, 4, '4'); c.hl(2, 4, 12, '2'); c.vl(2, 4, 4, '2'); c.hl(2, 7, 12, '5')
    # 아래 선반
    c.rect(2, 11, 12, 1, '3'); c.hl(2, 12, 12, '1')
    c.vl(2, 10, 5, '3'); c.vl(13, 10, 5, '2')
    c.px(1, 14, '2'); c.px(2, 15, '1'); c.px(13, 15, '1'); c.px(14, 14, '2')
    c.hl(1, 14, 3, '1'); c.hl(12, 14, 3, '1'); c.rect(2, 15, 2, 1, '1'); c.rect(12, 15, 2, 1, '1')

def tools(c):
    c.hl(3, 5, 5, '6'); c.px(8, 5, '5')                     # 메스
    c.px(4, 6, '6'); c.px(5, 6, '5'); c.px(6, 6, '6'); c.px(7, 7, '6')                # 가위
    c.hl(9, 6, 3, '6'); c.px(12, 6, '5'); c.px(11, 7, '6')                          # 집게
    c.rect(9, 4, 3, 2, 'u'); c.px(10, 5, 'D'); c.px(11, 5, 'C'); c.px(10, 4, 'v')      # 거즈 + 피
    c.rect(3, 7, 2, 1, 'q') if False else None

# ---------- 수레 A
c = C(16, 16); tray(c); tools(c)
c.rect(9, 4, 3, 2, 'u'); c.px(10, 5, 'D'); c.px(11, 5, 'C'); c.px(10, 4, 'v'); c.px(9, 5, 't')
save('instrument_tray', 'h5-A', c, L, '쇠 수레: 윗판 쟁반 안에 메스·가위·집게 밝은 선, 피 묻은 거즈 덩이, 아래 선반과 바퀴. 윗면이 칸 절반 이상')

# ---------- 수레 B
c = C(16, 16); tray(c); tools(c)
c.rect(9, 4, 3, 2, 'u'); c.px(10, 5, 'D'); c.px(11, 5, 'C'); c.px(10, 4, 'v')
c.hl(3, 5, 5, 'a'); c.px(4, 6, 'a'); c.px(6, 6, 'a')       # 도구 하이라이트 흰
c.hl(1, 3, 14, 'c') ; c.vl(1, 3, 7, 'c')
c.rect(9, 8, 5, 1, '2') if False else None
c.hl(2, 15, 12, '~'); c.px(14, 14, '~'); c.px(14, 15, '-')
c.hl(3, 15, 1, '1'); c.hl(12, 15, 1, '1')
c.hl(10, 6, 2, 'f') if False else None
save('instrument_tray', 'h5-B', c, L, '윗판 왼쪽 위 가장자리와 도구 선이 거의 흰색으로 튀고 안쪽 쟁반·아래는 어둡게, 바퀴 밑 반투명 그림자')

# ---------- 수레 C : 도구 대신 가지런한 이빨/손가락? -> 쟁반 밖으로 흘러내린 피, 쓰러진 도구
c = C(16, 16); tray(c)
c.hl(3, 5, 4, '6'); c.px(7, 6, '6'); c.px(8, 7, '5')
# 쟁반 가득 검붉은 액 + 가장자리로 넘침
c.rect(3, 6, 10, 2, 'C'); c.hl(4, 5, 8, 'D') if False else None
c.hl(4, 6, 9, 'D'); c.hl(3, 7, 10, 'C')
c.vl(6, 9, 4, 'C'); c.px(6, 13, 'D'); c.vl(11, 9, 2, 'B')
# 쟁반 위 손가락 마디 하나
c.px(9, 4, 'k') if False else None
c.rect(9, 3, 3, 1, '.') if False else None
c.px(9, 5, 'j') if False else None
save('instrument_tray', 'h5-C', c, L, '쟁반에 도구는 밀려나고 붉은 액이 가득 고여 가장자리로 넘쳐 아래 선반까지 흘러내림. 도구는 하나만 걸쳐 있음')

# ================== 엑스레이 판독기 16x16
def xbox(c, lit):
    c.rect(1, 1, 14, 13, '3'); c.hl(1, 1, 14, '6'); c.vl(1, 1, 13, '5'); c.hl(1, 13, 14, '1'); c.vl(14, 2, 12, '2')
    c.hl(4, 0, 8, '4'); c.hl(4, 14, 8, '1') if False else None       # 윗 클립
    c.rect(2, 2, 12, 11, '2')
    # 빛판
    c.rect(3, 3, 10, 9, 'W' if lit else 'V'); 
    c.hl(3, 3, 10, '3') if False else None
    # 얼룩진 밝기
    for (x, y) in ((4, 4), (11, 4), (5, 10), (10, 9), (12, 11), (3, 6)): c.px(x, y, 'U' if lit else 'T')
    # 필름
    c.rect(4, 4, 8, 7, 'y'); c.hl(4, 4, 8, 'z') if False else None
    # 척추
    c.vl(7, 4, 7, 'c'); c.vl(8, 4, 7, 'c') if False else None
    # 갈비뼈 곡선
    for y, (a, b) in ((5, (5, 6)), (6, (4, 5)), (7, (4, 5)), (8, (5, 6)), (9, (6, 6))):
        c.px(a, y, 'c'); c.px(b, y, 'c')
    for y, (a, b) in ((5, (9, 10)), (6, (10, 11)), (7, (10, 11)), (8, (9, 10)), (9, (9, 9))):
        c.px(a, y, 'd'); c.px(b, y, 'd')
    c.hl(4, 10, 8, 'x')

c = C(16, 16); xbox(c, False)
c.px(8, 5, 'c'); c.px(8, 6, 'c'); c.px(8, 7, 'c'); c.px(8, 8, 'c'); c.px(8, 9, 'c')
save('xray_viewer', 'h5-A', c, L, '벽 판독 상자: 쇠 테 안 창백한 빛판(얼룩진 밝기)에 검은 흉부 필름, 척추 한 줄과 갈비뼈 곡선 양쪽 네 줄')

c = C(16, 16); xbox(c, True)
for y in range(4, 11): c.px(8, y, 'e')
c.hl(3, 12, 10, 'S') if False else None
for (x, y) in ((0, 3), (0, 4), (0, 5), (0, 6), (0, 7), (0, 8), (0, 9), (0, 10), (15, 3), (15, 4), (15, 5), (15, 6), (15, 7), (15, 8), (15, 9), (15, 10), (2, 14), (3, 14), (4, 14), (5, 14), (6, 14), (7, 14), (8, 14), (9, 14), (10, 14), (11, 14), (12, 14), (13, 14)):
    c.px(x, y, '%')
c.hl(3, 15, 10, '%')
c.vl(15, 11, 4, '%')
c.rect(4, 9, 3, 2, 'z'); c.rect(9, 4, 3, 1, 'z')
save('xray_viewer', 'h5-B', c, L, '빛판이 가장 밝게 켜져 판 둘레 벽에 반투명 청백 빛이 번지고, 필름 모서리는 어둡게 눌림. 어둠 속에서 이것 하나만 빛남')

c = C(16, 16); xbox(c, False)
# 필름 안: 갈비 대신 서 있는 사람 형체
c.rect(4, 4, 8, 7, 'y')
for (x, y) in ((7, 4), (8, 4), (7, 5), (8, 5)): c.px(x, y, 'e')     # 머리
c.px(7, 5, 'x') if False else None
c.hl(5, 6, 6, 'd'); c.hl(5, 7, 6, 'd'); c.vl(5, 6, 4, 'd'); c.vl(10, 6, 4, 'd')
c.vl(7, 8, 3, 'd'); c.vl(8, 8, 3, 'd')
c.px(7, 5, 'x'); c.px(8, 5, 'x')      # 눈구멍 두 점
c.px(3, 4, 'T'); c.px(12, 4, 'T')
# 유리 금
for (x, y) in ((11, 3), (12, 4), (12, 5), (13, 6), (13, 7)): c.px(x, y, 'x')
save('xray_viewer', 'h5-C', c, L, '필름에 갈비뼈 대신 서서 팔을 늘어뜨린 사람 형체가 찍혀 있고 머리에 눈구멍 두 점, 판 귀퉁이 금')
