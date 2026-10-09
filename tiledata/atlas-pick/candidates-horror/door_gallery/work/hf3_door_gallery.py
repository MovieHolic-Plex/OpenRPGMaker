import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'door_wood', 'work'))
from hf3_lib import *
S = 'door_gallery'

def panel(cv, x0, y0, x1, y1, r, hi, fld, lo):
    cv.rect(x0, y0, x1, y1, r, fld)
    cv.hl(y0, x0, x1, r, hi); cv.vl(x0, y0, y1, r, hi)
    cv.hl(y1, x0, x1, r, lo); cv.vl(x1, y0, y1, r, lo)

def A():
    cv = Cv(16, 32)
    door_skeleton(cv, 'dust', 2, L=(0, 6, 5, 3), R=(3, 5, 4, 0), T=(0, 6, 5, 3), sill=1)
    cv.rect(4, 6, 11, 30, 'grave', 2)
    panel(cv, 5, 7, 10, 15, 'grave', 1, 3, 4)      # 위 패널(짙은 회청 안에서 살짝 들어감)
    panel(cv, 5, 17, 10, 29, 'grave', 1, 3, 4)
    cv.hl(15, 6, 10, 'grave', 4); cv.hl(29, 6, 10, 'grave', 4)
    # 쇠 손잡이 — 세로 막대 + 받침
    cv.vl(10, 20, 22, 'viron', 4); cv.px(10, 20, 'viron', 5); cv.px(9, 21, 'viron', 5); cv.px(9, 22, 'viron', 3)
    return cv, '미술관 문 A — 밝은 회백 문틀(먼지 4·5단, 왼쪽 6단 하이라이트, 윤곽 0단)과 짙은 회청 문짝(grave 2단) + 들어간 패널 둘, 쇠 손잡이. 흰 벽 위에서 문짝의 짙음이 먼저 보인다.'

def B():
    cv = Cv(16, 32)
    door_skeleton(cv, 'dust', 1, L=(0, 6, 6, 4), R=(4, 6, 5, 0), T=(0, 6, 6, 4), sill=2)
    cv.rect(4, 6, 11, 30, 'grave', 0)
    panel(cv, 5, 7, 10, 15, 'grave', 3, 0, 2)
    panel(cv, 5, 17, 10, 29, 'grave', 3, 0, 2)
    cv.vl(10, 20, 22, 'viron', 6); cv.px(9, 21, 'viron', 6); cv.px(9, 22, 'viron', 4)
    return cv, '미술관 문 B — 틀은 가장 밝은 먼지 6단, 문짝은 거의 검은 grave 0단(6단 차). 큰 패널 테두리만 3단, 손잡이 6단. 흰 벽 앞에서도 검은 문이 어둠 속에서도 틀선이 보인다.'

def C():
    cv = Cv(16, 32)
    door_skeleton(cv, 'vmarble', 5, L=(0, 6, 5, 3), R=(3, 5, 4, 0), T=(0, 6, 5, 3), sill=2)
    # 대리석 결: 어두운 잔금 몇 가닥(덩이로)
    for (x, y, l) in [(1, 9, 3), (2, 10, 2), (2, 18, 3), (1, 19, 2), (13, 13, 3), (14, 14, 2), (13, 24, 3), (12, 25, 2)]:
        cv.vl(x, y, y + l - 1, 'vmarble', 3)
    # 문짝 — 어두운 청회 나무에 놋 쇠판
    cv.rect(4, 6, 11, 30, 'ward', 1)
    panel(cv, 5, 7, 10, 12, 'ward', 3, 2, 0)
    panel(cv, 5, 14, 10, 29, 'ward', 3, 2, 0)
    # 안쪽 마름모 상감(놋)
    for (x, y, t) in [(7, 19, 3), (8, 19, 3), (6, 20, 4), (9, 20, 4), (7, 21, 2), (8, 21, 2)]:
        cv.px(x, y, 'tarn', t)
    cv.vl(10, 24, 26, 'tarn', 4); cv.px(10, 24, 'tarn', 5)
    return cv, '미술관 문 C — 대리석 문틀(결 잔금 가닥, 왼 6단 오른 3단)과 청록 회색 문짝 + 놋쇠 마름모 상감·놋 손잡이. 검은 윤곽 0단.'

if __name__ == '__main__':
    for n, f in zip('ABC', (A, B, C)):
        cv, note = f(); cv.emit(S, 'hf3-' + n, note)
