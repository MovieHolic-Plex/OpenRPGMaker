import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'school_gate', 'work'))
from s4_lib import C, write_item, shadow, grade

# 책상 한 벌을 (x0, 너비) 로 그리는 조각. 의자는 등받이가 책상 쪽(위)을 향한다.
def desk(c, x0, w, sty):
    hi = sty.get('hi', 0); deep = sty.get('deep', 0)
    T = 'vpine'
    # 상판: y2..9 (윗면 넓게 ¾), 앞 모서리 y10
    c.rect(x0, 2, w, 8, T, 5 + hi)
    c.hl(x0, 2, w, T, 6); c.vl(x0, 2, 8, T, 6 + (1 if hi else 0))
    c.vl(x0 + w - 1, 3, 7, T, 4)
    c.hl(x0, 10, w, T, 3)                       # 앞 턱
    c.hl(x0, 11, w, 'vdwood', 1 - 0)            # 서랍 틈(어두움)
    c.hl(x0 + 1, 12, w - 2, T, 2 - (1 if deep else 0))
    # 바깥 윤곽(재질 어두운 단)
    c.hl(x0, 1, w, 'vdwood', 2); c.vl(x0 - 1, 2, 10, 'vdwood', 2) if x0 > 0 else None
    # 책상 다리(가는 철)
    for lx in (x0 + 1, x0 + w - 2):
        c.vl(lx, 12, 4, 'locker', 3); c.px(lx, 15, 'locker', 1)
    # 판 결
    c.hl(x0 + 2, 5, 3, T, 4); c.hl(x0 + w - 6, 7, 3, T, 4)

def chair(c, x0, sty):
    hi = sty.get('hi', 0)
    # 등받이(위, 책상 쪽): y17..19, 좌석 y20..23, 다리 y24..28
    c.rect(x0 + 1, 17, 8, 3, 'vpine', 4 + hi); c.hl(x0 + 1, 17, 8, 'vpine', 5 + hi); c.hl(x0 + 1, 19, 8, 'vpine', 2)
    c.hl(x0 + 1, 16, 8, 'vdwood', 2)
    c.vl(x0 + 1, 20, 2, 'locker', 2); c.vl(x0 + 8, 20, 2, 'locker', 2)      # 등받이 지지대
    c.rect(x0, 21, 10, 4, 'vpine', 5 + hi); c.hl(x0, 21, 10, 'vpine', 6 + hi)
    c.hl(x0, 25, 10, 'vpine', 2); c.vl(x0 + 9, 22, 3, 'vpine', 3)
    c.hl(x0, 20, 10, 'vdwood', 2) if False else None
    for lx in (x0 + 1, x0 + 8):
        c.vl(lx, 26, 3, 'locker', 3); c.px(lx, 28, 'locker', 1)

def one(sty):
    c = C(16, 32)
    desk(c, 1, 14, sty)
    chair(c, 3, {'hi': sty.get('hi', 0)})
    return c

def pair(sty):
    c = C(32, 32)
    desk(c, 1, 30, sty)
    c.vl(15, 3, 7, 'vdwood', 1); c.vl(16, 3, 7, 'vpine', 6)         # 두 사람 이음선
    # 가운데 다리
    c.vl(15, 12, 4, 'locker', 2); c.vl(16, 12, 4, 'locker', 3)
    chair(c, 3, {'hi': sty.get('hi', 0)}); chair(c, 19, {'hi': sty.get('hi', 0)})
    return c

def shade(c, x0, x1, deep=False):
    shadow(c, x0, x1, 29, two=True)

def A1():
    c = one({}); shadow(c, 3, 13, 29, two=False); return c
def A2():
    c = pair({}); shadow(c, 3, 13, 29, two=False); shadow(c, 19, 29, 29, two=False); return c

def B1():
    c = one({'hi': 1, 'deep': 1})
    c.hl(2, 10, 12, 'vpine', 2)
    grade(c, lit=0.3, dark=0.55, darker=0.85, low=0.55, lit_d=2, dark_d=1, darker_d=1, low_d=1, top_rows=2)
    for x in range(2, 15): c.px(x, 29, '~')
    for x in range(3, 15): c.px(x, 30, '~')
    for x in range(5, 14): c.px(x, 31, '-')
    return c
def B2():
    c = pair({'hi': 1, 'deep': 1})
    c.hl(2, 10, 28, 'vpine', 2)
    grade(c, lit=0.3, dark=0.55, darker=0.85, low=0.55, lit_d=2, dark_d=1, darker_d=1, low_d=1, top_rows=2, xa=0, xb=16)
    grade(c, lit=0.3, dark=0.55, darker=0.85, low=0.55, lit_d=2, dark_d=1, darker_d=1, low_d=1, top_rows=2, xa=16, xb=32)
    for xa, xb in ((2, 15), (18, 31)):
        for x in range(xa, xb): c.px(x, 29, '~'); c.px(x, 30, '~')
        for x in range(xa + 2, xb - 1): c.px(x, 31, '-')
    return c

# C: 상판이 앞으로 기운 작은 사물함형 책상 + 옆 책가방 걸이 / 의자는 둥근 등받이
def desk_c(c, x0, w):
    T = 'vpine'
    # 경사 상판: 위쪽 좁게, 앞이 넓게 (사다리꼴 느낌) - 첫 줄 안쪽으로 1칸씩
    c.rect(x0 + 2, 1, w - 4, 1, T, 6)
    c.rect(x0 + 1, 2, w - 2, 1, T, 6)
    c.rect(x0, 3, w, 7, T, 5)
    c.vl(x0, 3, 7, T, 6); c.vl(x0 + w - 1, 3, 7, T, 4)
    c.hl(x0, 10, w, T, 3)
    c.hl(x0, 11, w, 'vdwood', 1)
    c.hl(x0 - 0, 0, 0, T, 1)
    # 책 넣는 서랍 상자(상판 밑 틈에서 튀어나옴)
    c.rect(x0 + 2, 12, w - 4, 4, 'vdwood', 3); c.hl(x0 + 2, 12, w - 4, 'vdwood', 4); c.hl(x0 + 2, 15, w - 4, 'vdwood', 1)
    c.hl(x0 + 4, 13, w - 8, 'vdwood', 1)
    for lx in (x0 + 1, x0 + w - 2): c.vl(lx, 12, 5, 'locker', 3)

def chair_c(c, x0):
    # 둥근 등받이(반원) + 좌석
    rows = ['..3333..', '.344443.', '34444443', '34444443', '.222222.']
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch != '.': c.px(x0 + 1 + i, 17 + j, 'vpine', int(ch) + 1)
    c.rect(x0, 22, 10, 3, 'vpine', 5); c.hl(x0, 22, 10, 'vpine', 6); c.hl(x0, 25, 10, 'vpine', 2)
    for lx in (x0 + 1, x0 + 8): c.vl(lx, 26, 3, 'locker', 3); c.px(lx, 28, 'locker', 1)

def C1():
    c = C(16, 32); desk_c(c, 1, 14); chair_c(c, 3); shadow(c, 3, 13, 29, two=False); return c
def C2():
    c = C(32, 32); desk_c(c, 1, 30)
    c.vl(15, 3, 7, 'vdwood', 1); c.vl(16, 3, 7, 'vpine', 6)
    chair_c(c, 3); chair_c(c, 19)
    shadow(c, 3, 13, 29, two=False); shadow(c, 19, 29, 29, two=False); return c

if __name__ == '__main__':
    write_item(A1(), 'desk_set', 'A', '학생 책상+의자: 소나무 합판 상판(윗면 ¾)·앞 턱·서랍 틈, 가는 철 다리, 등받이가 책상 쪽(위)을 향한 의자, 좌우 1px 여백')
    write_item(B1(), 'desk_set', 'B', '명암 강화 책상: 빛은 왼쪽 위 — 왼쪽 다리·윗선 두 단 밝게, 오른쪽·앞 턱·아래 어둡게, 앞 모서리 짙은 띠, 접지 그림자 3줄')
    write_item(C1(), 'desk_set', 'C', '재해석: 앞이 넓어지는 경사 상판 밑에 책 서랍 상자가 튀어나온 책상, 둥근 등받이 의자')
    write_item(A2(), 'desk_pair', 'A', '두 사람 책상: 긴 상판에 이음선 1줄, 가운데 다리, 같은 높이 의자 2개 — desk_set A와 같은 재료·명암')
    write_item(B2(), 'desk_pair', 'B', 'desk_set B와 같은 명암: 사람마다 왼쪽 밝게·오른쪽 어둡게, 앞 턱 짙게, 의자 둘 접지 그림자 3줄')
    write_item(C2(), 'desk_pair', 'C', 'desk_set C 확장: 경사 상판 + 서랍 상자, 이음선 1줄, 둥근 등받이 의자 2개')
