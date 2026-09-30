import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'school_gate', 'work'))
from s4_lib import C, write_item, shadow, shift_up, grade, cast

# 책: (너비, 높이, 램프, 단, 띠여부)  — 손으로 정한 들쭉날쭉한 높이
SH = [
  [(3,7,'vred',3,1),(2,6,'vblue',3,0),(3,8,'vgreen',3,1),(2,5,'vyellow',3,0),(3,7,'vblue',2,1),(2,7,'vred',2,0),(3,6,'vyellow',3,1),(2,8,'vgreen',2,0),(3,7,'vred',3,0),(2,6,'vblue',3,1),(3,7,'vgreen',3,0)],
  [(2,7,'vblue',3,0),(3,8,'vyellow',3,1),(2,6,'vred',3,0),(3,7,'vgreen',3,1),(2,7,'vred',2,0),(3,5,'vblue',2,1),(2,8,'vyellow',2,0),(3,7,'vred',3,1),(2,6,'vgreen',3,0),(3,7,'vblue',3,0),(2,7,'vyellow',3,1)],
  [(3,6,'vgreen',3,0),(2,7,'vred',3,1),(3,8,'vblue',3,0),(2,6,'vyellow',3,1),(3,7,'vred',2,0),(2,7,'vgreen',2,1),(3,6,'vblue',2,0),(3,8,'vyellow',3,0),(2,7,'vred',3,1),(3,6,'vgreen',3,0),(2,7,'vblue',3,1)],
]

def book(c, x, ybot, w, h, r, t, band, hi=1, lo=1):
    y = ybot - h + 1
    c.rect(x, y, w, h, r, t)
    c.vl(x, y, h, r, t + hi)            # 빛 쪽(왼쪽) 한 단 밝게
    c.vl(x + w - 1, y, h, r, t - lo)    # 어두운 쪽
    c.hl(x, y, w, r, t + hi)            # 윗선
    if band and h >= 5: c.hl(x, y + 2, w, 'washi', 3)   # 등띠(글자 없는 줄)

def tilted(c, x, ybot, r, t):
    # 기울어진 책 하나: 오른쪽으로 기대
    rows = ['..3', '.33', '.33', '33.', '33.', '3..']
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch == '3': c.px(x + i, ybot - 5 + j, r, t if i else t + 1)

def shelf_A(hi=1, lo=1, deep=False, glow=False):
    c = C(32, 32)
    W = 'vpine'
    # 뒤판
    c.rect(2, 3, 30, 26, 'vdwood', 1)
    c.hl(2, 3, 30, 'vdwood', 0)
    if deep:
        c.hl(2, 4, 30, 'vdwood', 0); c.hl(2, 12, 30, 'vdwood', 0); c.hl(2, 21, 30, 'vdwood', 0)
    # 윗판 1px + 밑 그늘
    c.hl(0, 1, 32, W, 5 + (1 if deep else 0)); c.hl(0, 2, 32, W, 3)
    # 옆기둥(왼쪽 2px) - 타일 이음은 다음 칸의 기둥으로
    c.rect(0, 1, 2, 30, W, 4); c.vl(0, 1, 30, W, 5 + hi - 1); c.vl(1, 2, 29, W, 3)
    # 칸 바닥(선반 판)
    for by in (11, 20):
        c.hl(0, by, 32, W, 5); c.hl(0, by + 1, 32, W, 3 - (1 if deep else 0))
    c.hl(0, 29, 32, W, 5); c.rect(0, 30, 32, 1, W, 2)
    # 책
    for row, (ybot, lst) in enumerate(zip((10, 19, 28), SH)):
        x = 2
        for (w, h, r, t, band) in lst:
            if x + w > 32: break
            book(c, x, ybot, w, h, r, t + (0 if not deep else 0), band, hi, lo)
            x += w
            if (x + row) % 5 == 0 and x < 30: x += 1
    # 기울어진 책(중단 오른쪽 빈자리)
    return c

def labels(c, yrow):
    # 선반 판 앞면 흰 라벨 점
    for x in range(4, 32, 4): c.px(x, yrow, 'vwhite', 5)

def LS_A():
    c = shelf_A()
    for by in (11, 20, 29): labels(c, by)
    # 기울어진 책: 2단 오른쪽 끝
    c.rect(27, 12, 4, 8, 'vdwood', 1)
    tilted(c, 27, 19, 'vblue', 3)
    shadow(c, 0, 32, 31, two=False)
    return c

def LS_B():
    # 빛은 왼쪽 위: 왼쪽 열은 밝게, 오른쪽은 두 단 어둡게, 아래 칸은 더 어둡게 + 접지 그림자 2줄
    c = shelf_A(hi=2, lo=2, deep=True)
    for by in (11, 20, 29): labels(c, by)
    c.rect(27, 12, 4, 8, 'vdwood', 0)
    tilted(c, 27, 19, 'vblue', 3)
    for y0 in (3, 12, 21):
        c.hl(2, y0, 30, 'vdwood', 0); c.hl(2, y0 + 1, 30, 'vdwood', 0)
    shift_up(c)
    grade(c, lit=0.25, dark=0.55, darker=0.82, low=0.66, lit_d=2, dark_d=1, darker_d=1, low_d=1)
    for x in range(1, 31): c.px(x, 30, '~')
    for x in range(3, 29): c.px(x, 31, '-')
    return c

def LS_C():
    # 윗칸 열린 선반 + 아래는 문 달린 장(넓은 관 몰딩)
    c = C(32, 32)
    W = 'vpine'
    c.hl(0, 1, 32, W, 6); c.hl(0, 2, 32, W, 5); c.hl(0, 3, 32, W, 2)   # 두툼한 관 몰딩(3줄)
    c.rect(2, 4, 30, 12, 'vdwood', 1); c.hl(2, 4, 30, 'vdwood', 0)
    c.rect(0, 4, 2, 26, W, 4); c.vl(0, 4, 26, W, 5); c.vl(1, 4, 26, W, 3)
    c.hl(0, 15, 32, W, 5); c.hl(0, 16, 32, W, 3)
    # 윗칸 책 (한 단)
    x = 2
    for (w, h, r, t, band) in SH[0]:
        if x + w > 32: break
        book(c, x, 14, w, h, r, t, band); x += w
    tilted(c, 27, 14, 'vyellow', 3)
    # 아랫 장: 문 두 짝
    c.rect(2, 17, 30, 12, W, 4); c.hl(2, 17, 30, W, 5)
    c.vl(15, 18, 11, W, 2); c.vl(16, 18, 11, W, 5)
    c.box(3, 19, 12, 9, W, 3); c.box(17, 19, 14, 9, W, 3)
    c.rect(4, 20, 10, 7, W, 4); c.rect(18, 20, 12, 7, W, 4)
    c.hl(4, 20, 10, W, 5); c.hl(18, 20, 12, W, 5)
    c.px(13, 23, 'vbrass', 5); c.px(13, 24, 'vbrass', 3); c.px(17, 23, 'vbrass', 5); c.px(17, 24, 'vbrass', 3)
    for x in range(6, 30, 5): c.px(x, 28, 'vwhite', 5)
    c.hl(0, 29, 32, W, 5); c.hl(0, 30, 32, W, 2)
    shadow(c, 0, 32, 31, two=False)
    return c

# ── 대출 데스크 48x32 ──
def top_items(c, deep=False):
    # 도장
    c.rect(6, 12, 4, 3, 'vred', 3); c.hl(6, 12, 4, 'vred', 4); c.rect(7, 10, 2, 2, 'vwood', 4); c.px(7, 10, 'vwood', 5)
    c.hl(5, 15, 6, 'vdwood', 1)  # 도장 그림자
    # 반납 책 더미(3권 납작)
    c.rect(15, 14, 11, 2, 'vblue', 3); c.hl(15, 14, 11, 'vblue', 4); c.hl(16, 16, 10, 'washi', 4)
    c.rect(16, 12, 9, 2, 'vgreen', 3); c.hl(16, 12, 9, 'vgreen', 4); c.hl(17, 14, 8, 'washi', 4) if False else None
    c.rect(17, 10, 8, 2, 'vred', 3); c.hl(17, 10, 8, 'vred', 4); c.hl(17, 12, 8, 'washi', 3)
    c.hl(15, 17, 12, 'vdwood', 1)
    # 작은 모니터
    c.rect(33, 6, 11, 8, 'mdglass', 2); c.box(33, 6, 11, 8, 'mdglass', 1)
    c.rect(34, 7, 9, 6, 'mglass', 5); c.hl(34, 7, 9, 'mglass', 6)
    c.px(36, 9, 'mglass', 7); c.px(37, 9, 'mglass', 7); c.hl(36, 11, 5, 'mglass', 4)
    c.rect(37, 14, 3, 2, 'mdglass', 2); c.hl(35, 16, 7, 'mdglass', 1)
    c.hl(34, 17, 9, 'vdwood', 1)

def counter(deep=False, hi=0):
    c = C(48, 32)
    W = 'vpine'
    # 윗면(넓게) y5..21
    c.rect(1, 5, 46, 17, W, 5 + hi)
    c.hl(1, 5, 46, W, 6); c.hl(1, 6, 46, W, 6)
    c.vl(1, 5, 17, W, 6 + hi if hi else 6)
    c.vl(46, 6, 16, W, 4)
    # 판 결(가로)
    for y, xs in ((9, (5, 27)), (13, (12, 38)), (18, (3, 20, 33)), (21, (8, 30))):
        for x0 in xs: c.hl(x0, y, 5, W, 4 + hi)
    # 앞 턱
    c.hl(0, 22, 48, W, 3); c.hl(0, 23, 48, W, 2 if deep else 3)
    # 앞판 y24..29
    c.rect(1, 24, 46, 6, W, 4 if not deep else 3)
    for x in (12, 24, 36): c.vl(x, 24, 6, W, 2)
    c.vl(1, 24, 6, W, 5); c.vl(46, 24, 6, W, 2)
    c.hl(0, 30, 48, 'vdwood', 1); c.hl(1, 29, 46, W, 2)
    # 윤곽
    c.hl(0, 4, 48, 'vdwood', 2); c.vl(0, 5, 26, 'vdwood', 2); c.vl(47, 5, 26, 'vdwood', 1)
    # 책 아이콘 간판
    c.rect(19, 25, 10, 4, 'washi', 4); c.box(19, 25, 10, 4, 'vdwood', 2)
    c.vl(24, 26, 2, 'vred', 3); c.vl(23, 26, 2, 'washi', 2); c.vl(25, 26, 2, 'washi', 2)
    top_items(c, deep)
    return c

def LC_A():
    c = counter()
    shadow(c, 1, 47, 31, two=False)
    return c

def LC_B():
    c = counter(deep=True, hi=1)
    c.hl(1, 21, 46, 'vpine', 3)
    for x in range(34, 43): c.px(x, 18, '%')
    shift_up(c)
    grade(c, lit=0.2, dark=0.6, darker=0.85, low=0.72, lit_d=2, dark_d=1, darker_d=1, low_d=1, top_rows=3)
    for x in range(1, 47): c.px(x, 30, '~')
    for x in range(3, 45): c.px(x, 31, '-')
    return c

def LC_C():
    # 뒤가 높은 카운터: 뒷판(높이 6) 위에 모니터·간판, 앞 상판은 낮음
    c = C(48, 32)
    W = 'vpine'
    c.rect(1, 2, 46, 8, W, 3); c.hl(1, 2, 46, W, 6); c.hl(1, 3, 46, W, 5)
    c.vl(1, 2, 8, W, 5); c.vl(46, 3, 7, W, 2); c.hl(1, 9, 46, W, 2)
    c.hl(0, 1, 48, 'vdwood', 2); c.vl(0, 2, 8, 'vdwood', 2); c.vl(47, 2, 8, 'vdwood', 1)
    # 뒷판 위 간판(책 아이콘)
    c.rect(19, 4, 10, 4, 'washi', 4); c.box(19, 4, 10, 4, 'vdwood', 2)
    c.vl(24, 5, 2, 'vred', 3); c.vl(23, 5, 2, 'washi', 2); c.vl(25, 5, 2, 'washi', 2)
    # 앞 상판
    c.rect(1, 12, 46, 10, W, 5); c.hl(1, 11, 46, 'vdwood', 1); c.hl(1, 12, 46, W, 6)
    c.vl(1, 12, 10, W, 6); c.vl(46, 13, 9, W, 4)
    c.hl(0, 22, 48, W, 3); c.hl(0, 23, 48, W, 3)
    for y, xs in ((15, (5, 27)), (19, (12, 38))):
        for x0 in xs: c.hl(x0, y, 5, W, 4)
    # 앞판
    c.rect(1, 24, 46, 6, W, 4)
    for x in (12, 24, 36): c.vl(x, 24, 6, W, 2)
    c.vl(1, 24, 6, W, 5); c.vl(46, 24, 6, W, 2)
    c.hl(1, 29, 46, W, 2); c.hl(0, 30, 48, 'vdwood', 1)
    c.vl(0, 11, 20, 'vdwood', 2); c.vl(47, 11, 20, 'vdwood', 1)
    # 윗면 물건(작게 한 줄)
    c.rect(4, 15, 4, 3, 'vred', 3); c.hl(4, 15, 4, 'vred', 4); c.rect(5, 13, 2, 2, 'vwood', 4)
    c.rect(11, 16, 9, 2, 'vblue', 3); c.hl(11, 16, 9, 'vblue', 4); c.hl(11, 18, 9, 'washi', 4)
    c.rect(12, 14, 7, 2, 'vgreen', 3); c.hl(12, 14, 7, 'vgreen', 4)
    c.rect(32, 13, 11, 6, 'mdglass', 2); c.box(32, 13, 11, 6, 'mdglass', 1)
    c.rect(33, 14, 9, 4, 'mglass', 5); c.hl(33, 14, 9, 'mglass', 6); c.hl(35, 16, 5, 'mglass', 4)
    c.hl(34, 19, 8, 'mdglass', 1)
    shadow(c, 1, 47, 31, two=False)
    return c

if __name__ == '__main__':
    write_item(LS_A(), 'library_shelf', 'A', '3단 책장: 단마다 색이 다른 책등(빨강·파랑·초록·노랑, 채도 낮게)을 들쭉날쭉 세우고 기울어진 책 1권, 선반 앞 흰 라벨 점, 윗판 1px, 왼쪽 기둥 2px로 좌우 이음')
    write_item(LS_B(), 'library_shelf', 'B', '명암 강화 책장: 빛은 왼쪽 위 — 왼쪽 열 두 단 밝게, 오른쪽·아래 칸 한두 단 어둡게, 칸마다 위 그늘 2줄, 바닥 접지 그림자 2줄')
    write_item(LS_C(), 'library_shelf', 'C', '재해석: 두툼한 관 몰딩(3줄) + 윗칸 열린 책 한 단 + 아래 문 두 짝 장(황동 손잡이). 위아래 다른 기물이 한 몸')
    write_item(LC_A(), 'library_counter', 'A', '긴 소나무 카운터: 윗면 넓게(가로 결)에 도장·반납 책 3권 더미·작은 모니터, 앞판 널 이음 3줄 + 책 아이콘 간판')
    write_item(LC_B(), 'library_counter', 'B', '명암 강화 카운터: 빛은 왼쪽 위 — 윗면 왼쪽·윗줄 밝게, 오른쪽·앞판 아래 어둡게, 앞턱 밑 짙은 띠, 접지 그림자 2줄, 모니터 화면 빛 번짐(%)')
    write_item(LC_C(), 'library_counter', 'C', '재해석: 뒤가 한 단 높은 카운터(뒷판에 책 아이콘 간판) + 낮은 앞 상판 위에 물건 한 줄 — 윗선이 두 단인 실루엣')
