import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from j2_lib import Cv
from j2_small import box, outline, save

def sh(c, x0, x1, y0, rows=2, side=None):
    for r in range(rows):
        for x in range(x0 + r, x1 + 1 - (0 if r == 0 else 0)):
            if c.get(x, y0 + r) is None: c.px(x, y0 + r, '~' if r == 0 else '-')
    if side:
        for y in range(side[0], y0):
            for k, x in enumerate(range(x1 - 1, x1 + 1)):
                if c.get(x + 1, y) is None: c.px(x + 1, y, '~' if k == 0 else '-')

# ───────── 공중전화 16x32 (object)
def phone(kind):
    c = Cv(16, 32)
    if kind == 'A':
        c.rect(2, 3, 11, 27, 'mmetal:4')
        c.h_(2, 3, 11, 'mmetal:6'); c.h_(2, 4, 11, 'mmetal:5'); c.h_(2, 5, 11, 'mmetal:3')
        c.rect(4, 6, 7, 20, 'mglass:3'); c.rect(4, 6, 7, 2, 'mglass:4')
        for i in range(4): c.px(5 + i, 12 - i, 'mglass:5')
        c.v_(2, 3, 27, 'mmetal:5'); c.v_(12, 3, 27, 'mmetal:2'); c.v_(3, 5, 22, 'mmetal:4'); c.v_(11, 5, 22, 'mmetal:3')
        # 전화기
        c.rect(5, 10, 5, 9, 'kgreen:3'); c.h_(5, 10, 5, 'kgreen:4'); c.v_(9, 10, 9, 'kgreen:2')
        c.rect(6, 11, 3, 2, 'mglass:1'); c.rect(6, 14, 3, 4, 'kgreen:2'); c.px(6, 15, 'mwhite:2'); c.px(8, 15, 'mwhite:2'); c.px(6, 17, 'mwhite:2'); c.px(8, 17, 'mwhite:2')
        c.v_(4, 11, 6, 'kgreen:1'); c.h_(4, 10, 1, 'kgreen:1')
        c.rect(2, 26, 11, 4, 'mmetal:2'); c.h_(2, 26, 11, 'mmetal:4'); c.v_(12, 26, 4, 'mmetal:1'); c.h_(2, 29, 11, 'mmetal:1')
        sh(c, 3, 14, 30, 2, side=(8, 30))
    elif kind == 'B':
        c.rect(2, 3, 11, 27, 'mmetal:3')
        c.h_(2, 3, 11, 'mmetal:6'); c.h_(2, 4, 11, 'mmetal:4'); c.h_(2, 5, 11, 'mmetal:1')
        c.rect(4, 6, 7, 20, 'mdglass:2'); c.rect(4, 6, 3, 20, 'mdglass:4'); c.rect(4, 6, 7, 2, 'mdglass:5')
        for i in range(5): c.px(4 + i, 13 - i, 'mglass:6'); c.px(5 + i, 13 - i, 'mdglass:6')
        c.v_(2, 3, 27, 'mmetal:5'); c.v_(3, 5, 22, 'mmetal:4'); c.v_(12, 3, 27, 'mmetal:0'); c.v_(11, 5, 22, 'mmetal:1')
        c.rect(5, 10, 5, 9, 'kgreen:3'); c.h_(5, 10, 5, 'kgreen:5'); c.v_(5, 10, 9, 'kgreen:4'); c.v_(9, 10, 9, 'kgreen:1')
        c.rect(6, 11, 3, 2, 'mglass:5'); c.rect(6, 14, 3, 4, 'kgreen:1')
        for (x, y) in ((6, 15), (8, 15), (6, 17), (8, 17)): c.px(x, y, 'mwhite:3')
        c.v_(4, 11, 7, 'kgreen:0')
        c.rect(2, 26, 11, 4, 'mmetal:1'); c.h_(2, 26, 11, 'mmetal:3'); c.v_(12, 26, 4, 'mmetal:0'); c.h_(2, 29, 11, 'mmetal:0')
        for y in range(6, 26):
            if c.get(13, y) is None: c.px(13, y, '~')
        for x in range(3, 15): c.px(x, 30, '~')
        for x in range(4, 16): c.px(x, 31, '~')
        for x in range(5, 15): c.px(x, 31, '~') if False else None
        for y in range(8, 30): c.px(14, y, '-') if c.get(14, y) is None else None
        for x in range(4, 11): c.px(x, 31, '%') if False else None
    else:  # C: 넓은 챙 지붕 + 큰 녹색 전화기 (부스는 좁게)
        c.rect(1, 3, 13, 3, 'kgreen:3'); c.h_(1, 3, 13, 'kgreen:5'); c.h_(1, 5, 13, 'kgreen:1'); c.v_(1, 3, 3, 'kgreen:4'); c.v_(13, 3, 3, 'kgreen:1')
        c.rect(3, 4, 9, 1, 'mwhite:2'); c.px(5,4,'kgreen:2'); c.px(7,4,'kgreen:2'); c.px(9,4,'kgreen:2')
        c.rect(3, 6, 9, 21, 'mglass:2'); c.rect(3, 6, 9, 2, 'mglass:5')
        c.v_(3, 6, 21, 'mmetal:5'); c.v_(11, 6, 21, 'mmetal:2')
        c.rect(4, 9, 7, 13, 'kgreen:3'); c.h_(4, 9, 7, 'kgreen:5'); c.v_(4, 9, 13, 'kgreen:4'); c.v_(10, 9, 13, 'kgreen:1'); c.h_(4, 21, 7, 'kgreen:1')
        c.rect(5, 10, 5, 3, 'mglass:1'); c.px(5, 10, 'mglass:5')
        c.rect(5, 14, 5, 6, 'kgreen:1')
        for y in (15, 17, 19):
            for x in (5, 7, 9): c.px(x, y, 'mwhite:3')
        c.rect(3, 26, 9, 4, 'mmetal:2'); c.h_(3, 26, 9, 'mmetal:4'); c.v_(11, 26, 4, 'mmetal:1'); c.h_(3, 29, 9, 'mmetal:1')
        c.px(2, 12, 'kgreen:1'); c.px(2, 13, 'kgreen:1')
        sh(c, 3, 14, 30, 2, side=(8, 30))
    return c

# ───────── 여우 석상 16x32 (object)
def fox(kind):
    c = Cv(16, 32)
    S = lambda t: f'ishi:{t}'
    if kind == 'A':
        # 받침
        box(c, 2, 24, 12, 6, 'ishi', 3, lit=1, top=1, dark=1, bot=1)
        c.h_(2, 24, 12, S(5)); c.h_(2, 25, 12, S(4))
        for (x, y) in ((4, 28), (10, 27), (12, 28)): c.px(x, y, 'moss:2')
        # 몸(앉은 자세)
        c.rect(4, 14, 8, 10, S(3)); c.v_(4, 14, 10, S(4)); c.v_(11, 14, 10, S(2)); c.v_(7, 19, 5, S(2)); c.v_(8, 19, 5, S(2))
        # 앞다리
        c.v_(6, 18, 6, S(4)); c.v_(9, 18, 6, S(3)); 
        # 머리
        c.rect(4, 6, 8, 7, S(4)); c.h_(4, 6, 8, S(5)); c.v_(4, 6, 7, S(5)); c.v_(11, 6, 7, S(3)); c.h_(5, 12, 6, S(3))
        c.rect(6, 11, 4, 2, S(5)); c.px(7, 11, S(0)); c.px(8, 11, S(0))          # 코
        # 귀
        for (x, y0) in ((4, 1), (10, 1)):
            c.px(x + 1, y0, S(3)); c.rect(x, y0 + 1, 3, 2, S(4)); c.rect(x, y0 + 3, 3, 2, S(4))
        c.px(5, 2, S(5)); c.px(11, 2, S(3)); c.h_(4, 5, 3, S(4)); c.h_(10, 5, 3, S(3))
        # 눈
        c.px(5, 8, S(0)); c.px(6, 8, S(1)); c.px(9, 8, S(1)); c.px(10, 8, S(0))
        # 붉은 턱받이
        c.rect(5, 13, 6, 3, 'shu:3'); c.h_(5, 13, 6, 'shu:4'); c.h_(5, 15, 6, 'shu:2'); c.px(8, 16, 'shu:2')
        # 꼬리
        c.rect(12, 16, 3, 8, S(3)); c.v_(14, 14, 10, S(2)); c.rect(13, 12, 2, 4, S(3)); c.px(13, 12, S(4)); c.px(12, 17, S(4))
        outline(c, {'ishi': 1, 'shu': 1}, keys=('ishi',))
        sh(c, 3, 15, 30, 2, side=(14, 30))
    elif kind == 'B':
        box(c, 2, 24, 12, 6, 'ishi', 2, lit=2, top=3, dark=1, bot=1)
        c.h_(2, 24, 12, S(6)); c.h_(2, 25, 12, S(4)); c.rect(2, 26, 3, 3, S(3))
        for (x, y) in ((4, 28), (10, 27), (12, 28)): c.px(x, y, 'moss:1')
        c.rect(4, 14, 8, 10, S(3)); c.v_(4, 14, 10, S(5)); c.v_(5, 14, 10, S(4)); c.v_(11, 14, 10, S(1)); c.v_(10, 14, 10, S(2)); c.v_(7, 19, 5, S(1)); c.v_(8, 19, 5, S(1))
        c.rect(4, 6, 8, 7, S(4)); c.h_(4, 6, 8, S(6)); c.v_(4, 6, 7, S(6)); c.v_(5, 7, 6, S(5)); c.v_(11, 6, 7, S(2)); c.v_(10, 7, 6, S(3)); c.h_(5, 12, 6, S(2))
        c.rect(6, 11, 4, 2, S(5)); c.px(7, 11, S(0)); c.px(8, 11, S(0))
        for (x, y0) in ((4, 1), (10, 1)):
            c.px(x + 1, y0, S(3)); c.rect(x, y0 + 1, 3, 4, S(4))
        c.v_(4, 2, 4, S(6)); c.v_(12, 2, 4, S(1)); c.px(5, 2, S(6)); c.h_(4, 5, 3, S(3)); c.h_(10, 5, 3, S(2))
        c.rect(5, 8, 2, 1, S(0)); c.rect(9, 8, 2, 1, S(0))
        c.rect(5, 13, 6, 3, 'shu:2'); c.h_(5, 13, 6, 'shu:5'); c.v_(5, 13, 3, 'shu:4'); c.v_(10, 13, 3, 'shu:1'); c.h_(5, 15, 6, 'shu:1'); c.px(8, 16, 'shu:1')
        c.rect(12, 16, 3, 8, S(2)); c.v_(14, 14, 10, S(1)); c.rect(13, 12, 2, 4, S(2)); c.px(13, 12, S(4)); c.px(12, 17, S(3))
        outline(c, {'ishi': 0, 'shu': 0}, keys=('ishi',))
        for x in range(3, 16): c.px(x, 30, '~')
        for x in range(4, 16): c.px(x, 31, '~')
        for y in range(15, 30): c.px(15, y, '-') if c.get(15, y) is None else None
        for x in range(2, 12): c.px(x, 31, '-') if c.get(x, 31) is None else None
    else:  # C: 홀쭉·긴 귀·긴 목·큰 꼬리 곡선 (고마이누와 다르게)
        box(c, 3, 25, 10, 5, 'ishi', 3, lit=1, top=1, dark=1, bot=1)
        c.h_(3, 25, 10, S(5))
        for (x, y) in ((5, 28), (11, 27)): c.px(x, y, 'moss:2')
        # 목·몸: 가늘고 긴 S자
        c.rect(6, 14, 5, 11, S(3)); c.v_(6, 14, 11, S(4)); c.v_(10, 14, 11, S(2)); c.v_(8, 20, 5, S(2))
        c.rect(5, 22, 7, 3, S(3)); c.v_(5, 22, 3, S(4)); c.v_(11, 22, 3, S(2))
        # 머리: 길쭉한 주둥이 + 큰 귀
        c.rect(5, 8, 6, 6, S(4)); c.v_(5, 8, 6, S(5)); c.v_(10, 8, 6, S(3))
        c.rect(6, 12, 4, 3, S(5)); c.px(7, 13, S(0)); c.px(8, 13, S(0))
        c.px(6, 10, S(0)); c.px(9, 10, S(0))
        for (x, w) in ((4, 3), (9, 3)):
            c.rect(x, 3, w, 5, S(4)); c.rect(x + 1, 1, w - 2, 2, S(4)); c.px(x + 1, 0, S(3))
        c.v_(4, 3, 5, S(5)); c.v_(11, 3, 5, S(2)); c.v_(5, 1, 2, S(5))
        c.h_(6, 3, 1, S(3)); c.h_(9, 3, 1, S(3))
        # 붉은 턱받이(길다)
        c.rect(6, 15, 5, 4, 'shu:3'); c.h_(6, 15, 5, 'shu:5'); c.v_(10, 15, 4, 'shu:2'); c.h_(6, 18, 5, 'shu:2'); c.px(8, 19, 'shu:2')
        # 큰 꼬리: 오른쪽으로 크게 휘어 오름
        c.rect(11, 20, 3, 5, S(3)); c.rect(12, 14, 3, 8, S(3)); c.rect(11, 9, 3, 6, S(4)); c.px(12, 8, S(5)); c.v_(14, 14, 8, S(2)); c.v_(13, 9, 6, S(3))
        c.v_(11, 9, 6, S(5)); c.px(12, 9, S(5))
        outline(c, {'ishi': 1}, keys=('ishi',))
        sh(c, 4, 15, 30, 2, side=(15, 30))
    return c

if __name__ == '__main__':
    NP = {'A': '강남 결: 은색 틀·녹색 전화기·유리 대각 하이라이트, 위 2px 지붕 띠, 오른쪽 아래 ~/- 그림자.',
          'B': '입체 강화: 어두운 유리(mdglass)와 밝은 왼쪽 틀·짙은 오른쪽 틀, 전화기는 위·왼쪽 밝게, 접지 그림자 ~ 두 줄.',
          'C': '실루엣 재해석: 넓은 녹색 챙 지붕과 큰 녹색 전화기가 주인공, 부스 유리는 좁게 — 멀리서도 「녹색 공중전화」로 읽힘.'}
    NF = {'A': '강남 결: 돌 3단 명암, 받침 윗면 밝게, 이끼 점, 뾰족귀 앉은 여우 + 붉은 턱받이 + 오른쪽 꼬리, 오른쪽 아래 그림자.',
          'B': '입체 강화: 돌 명암 폭 넓게(왼쪽 +2/오른쪽 -2), 어두운 윤곽, 받침 윗면 크게 밝게, 그림자 ~ 두 줄 + - 번짐.',
          'C': '실루엣 재해석: 홀쭉한 몸·긴 목·아주 큰 뾰족귀·크게 솟은 꼬리로 고마이누와 확실히 다른 여우 실루엣.'}
    for L in 'ABC':
        save(phone(L), 'phone_booth', L, NP[L]); save(fox(L), 'fox_statue', L, NF[L])
