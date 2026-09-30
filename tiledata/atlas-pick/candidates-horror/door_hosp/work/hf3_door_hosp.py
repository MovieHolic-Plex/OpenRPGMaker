import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'door_wood', 'work'))
from hf3_lib import *
S = 'door_hosp'

def glass(cv, x0, y0, x1, y1, fr, frt, base, glare=None):
    cv.rect(x0, y0, x1, y1, 'tin', frt[0])
    cv.rect(x0 + 1, y0 + 1, x1 - 1, y1 - 1, 'murk', base)
    cv.vl(x0, y0, y1, 'tin', frt[1]); cv.hl(y0, x0, x1, 'tin', frt[1])
    if glare:
        for (x, y, t) in glare: cv.px(x, y, 'murk', t)

def bar(cv, y, x0, x1, hi, mid, lo):
    cv.hl(y, x0, x1, 'tin', hi); cv.hl(y + 1, x0, x1, 'tin', mid); cv.hl(y + 2, x0, x1, 'tin', lo)
    cv.px(x0, y + 1, 'tin', hi); cv.px(x1, y + 1, 'tin', lo)

def A():
    cv = Cv(16, 32)
    door_skeleton(cv, 'tin', 2, L=(0, 5, 4, 2), R=(3, 3, 2, 0), T=(0, 5, 4, 2), sill=1)
    cv.rect(4, 6, 11, 30, 'ward', 2)
    cv.vl(4, 6, 30, 'ward', 3); cv.vl(11, 6, 30, 'ward', 1)
    glass(cv, 6, 8, 9, 16, None, (1, 4), 2, [(7, 10, 3), (7, 11, 3)])
    # 아래 철판(걷어차는 판)
    cv.hl(26, 4, 11, 'tin', 4); cv.rect(4, 27, 11, 30, 'tin', 3); cv.hl(30, 4, 11, 'tin', 2)
    bar(cv, 20, 5, 10, 5, 4, 2)
    return cv, '병실 문 A — 쇠 틀(tin 4·5단) + 바랜 회녹 문짝(ward 2단), 위쪽 세로 긴 작은 유리창(속 짙은 murk 2단), 아래 걷어차는 철판, 가로 밀대 손잡이.'

def B():
    cv = Cv(16, 32)
    door_skeleton(cv, 'tin', 1, L=(0, 6, 5, 3), R=(3, 5, 4, 0), T=(0, 6, 5, 3), sill=2)
    cv.rect(4, 6, 11, 30, 'ward', 0)
    glass(cv, 5, 8, 10, 17, None, (5, 6), 0)
    cv.rect(6, 9, 9, 16, 'murk', 0)
    for (x, y, t) in [(6, 9, 3), (7, 9, 3), (6, 10, 3)]: cv.px(x, y, 'murk', t)
    bar(cv, 21, 5, 10, 6, 5, 3)
    cv.hl(29, 4, 11, 'tin', 3)
    return cv, '병실 문 B — 틀 6·5단 밝은 쇠, 문짝 0단(거의 검정), 유리창 테두리 밝은 쇠 5·6단 안에 속 0단, 밀대 6단. 어두운 방에서 창 테와 밀대만 뜬다.'

def C():
    cv = Cv(16, 32)
    door_skeleton(cv, 'tin', 2, L=(0, 5, 4, 2), R=(3, 3, 2, 0), T=(0, 5, 4, 2), sill=1)
    cv.rect(4, 6, 11, 30, 'ward', 3)
    cv.vl(4, 6, 30, 'ward', 4); cv.vl(11, 6, 30, 'ward', 2)
    glass(cv, 6, 8, 9, 16, None, (1, 4), 1, [(7, 10, 3), (7, 11, 3)])
    # 벗겨진 칠 → 밑 쇠·녹 덩이
    for (x0, y0, x1, y1) in [(4, 19, 5, 21), (9, 24, 11, 26), (4, 27, 6, 29)]:
        cv.rect(x0, y0, x1, y1, 'rust', 2)
        cv.hl(y0, x0, x1, 'rust', 3); cv.hl(y1, x0, x1, 'rust', 1)
    cv.px(4, 22, 'rust', 1); cv.px(4, 23, 'rust', 1)
    cv.hl(19, 6, 6, 'ward', 4)
    bar(cv, 20, 6, 11, 5, 4, 2)
    return cv, '병실 문 C — 회녹 칠 문짝(ward 3단)의 벗겨진 칠 덩이 셋(밑 쇠·녹 rust 1~3단), 유리창은 짙게, 가로 밀대. 핏자국 없음.'

if __name__ == '__main__':
    for n, f in zip('ABC', (A, B, C)):
        cv, note = f(); cv.emit(S, 'hf3-' + n, note)
