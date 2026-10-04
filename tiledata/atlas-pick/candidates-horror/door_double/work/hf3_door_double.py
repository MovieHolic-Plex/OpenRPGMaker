import sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'door_wood', 'work'))
from hf3_lib import *
S = 'door_double'

def skel2(cv, r, leaf, L, R, T, sill):
    """32x32 양문 뼈대: 위 2px 비움, 왼 틀 x0..3, 오른 틀 x28..31, 인방 y2..5, 문짝 x4..15 / x16..27 (y6..30), 맨 밑 y31."""
    for y in range(2, 32):
        for i, t in enumerate(L): cv.px(i, y, r, t)
        for i, t in enumerate(R): cv.px(28 + i, y, r, t)
    cv.hl(2, 0, 31, r, T[0]); cv.hl(3, 1, 30, r, T[1]); cv.hl(4, 1, 30, r, T[2]); cv.hl(5, 3, 28, r, T[3])
    cv.px(30, 3, r, max(T[1] - 1, 0)); cv.px(30, 4, r, max(T[2] - 1, 0))
    for x in (0, 31):
        cv.px(x, 3, r, T[0]); cv.px(x, 4, r, T[0])
    cv.rect(4, 6, 27, 30, r, leaf)
    cv.hl(31, 0, 31, r, sill)

def panels(cv, r, hi, mid, lo, x0s=(6, 18)):
    for x0 in x0s:
        for (y0, y1) in ((7, 14), (17, 28)):
            cv.hl(y0, x0, x0 + 7, r, hi)
            for y in range(y0 + 1, y1):
                cv.px(x0, y, r, hi); cv.rect(x0 + 1, y, x0 + 6, y, r, mid); cv.px(x0 + 7, y, r, lo)
            cv.px(x0, y1, r, mid); cv.hl(y1, x0 + 1, x0 + 7, r, lo)

def seam(cv, r, dk, lt):
    cv.vl(15, 6, 30, r, dk); cv.vl(16, 6, 30, r, lt)

def handles(cv, spec, y=20):
    # 각 손잡이 2x2: (x, 위줄, 아랫줄)
    for x, a, b in spec:
        cv.px(x, y, 'tarn', a); cv.px(x + 1, y, 'tarn', a - 1)
        cv.px(x, y + 1, 'tarn', b + 1); cv.px(x + 1, y + 1, 'tarn', b)

def A():
    cv = Cv(32, 32); skel2(cv, 'mahog', 3, (1, 5, 3, 4), (4, 4, 3, 1), (1, 5, 4, 2), 1)
    panels(cv, 'mahog', 2, 3, 4); seam(cv, 'mahog', 1, 4)
    cv.hl(30, 4, 27, 'mahog', 2); cv.px(15, 30, 'mahog', 1); cv.px(16, 30, 'mahog', 1)
    handles(cv, [(13, 5, 2), (17, 5, 2)])
    return cv, '기본 양문 A — door_wood A 와 같은 틀 폭 4px·문짝 3단·패널 둘씩, 가운데 맞닿는 선(왼 짝 어둡게·오른 짝 밝게), 놋쇠 손잡이 둘이 선 양쪽에.'

def B():
    cv = Cv(32, 32); skel2(cv, 'mahog', 1, (1, 6, 5, 3), (3, 5, 4, 1), (1, 6, 5, 3), 1)
    panels(cv, 'mahog', 4, 2, 3); seam(cv, 'mahog', 0, 3)
    cv.hl(30, 4, 27, 'mahog', 0)
    handles(cv, [(13, 5, 3), (17, 5, 3)])
    return cv, '양문 B — 밝은 틀(6·5단)과 아주 짙은 문짝(1단), 밝은 패널 테두리 넷, 가운데 선은 0단 틈으로 또렷, 손잡이 밝은 놋쇠.'

def C():
    cv = Cv(32, 32); skel2(cv, 'rot', 3, (0, 5, 4, 1), (4, 4, 3, 0), (0, 5, 4, 1), 0)
    for k in range(12):      # 세로 판자, 폭 2px
        x = 4 + 2 * k
        if x in (14,): pass
        cv.vl(x, 6, 30, 'rot', 4 if k % 2 == 0 else 3); cv.vl(x + 1, 6, 30, 'rot', 2)
    for (x, y, l) in [(4, 9, 3), (6, 14, 4), (8, 8, 2), (10, 18, 4), (4, 22, 3), (6, 25, 2), (8, 21, 3), (10, 11, 2),
                      (12, 10, 3), (18, 12, 4), (20, 8, 3), (22, 24, 3), (24, 15, 2), (26, 20, 3), (16, 26, 3), (14, 22, 2)]:
        cv.vl(x, y, y + l - 1, 'rot', 2)
    for y in (9, 23):        # 쇠 띠 — 두 짝을 가로질러
        cv.hl(y, 4, 27, 'viron', 2); cv.hl(y + 1, 4, 27, 'viron', 3); cv.hl(y + 2, 4, 27, 'viron', 1)
        for x in (5, 10, 21, 26): cv.px(x, y + 1, 'viron', 5)
    cv.vl(15, 6, 30, 'rot', 0); cv.vl(16, 6, 30, 'rot', 3)
    for x, dx in ((13, 0), (18, 0)):    # 고리 손잡이
        cv.px(x, 16, 'tarn', 4); cv.px(x - 1, 17, 'tarn', 4); cv.px(x + 1, 17, 'tarn', 2); cv.px(x, 18, 'tarn', 2)
    return cv, '재질 양문 C — rot 세로 판자 열둘·결, 쇠 띠 둘이 두 짝을 가로지르고 가운데 선은 0단 틈, 놋 고리 손잡이 둘.'

if __name__ == '__main__':
    for n, f in zip('ABC', (A, B, C)):
        cv, note = f(); cv.emit(S, 'hf3-' + n, note)
