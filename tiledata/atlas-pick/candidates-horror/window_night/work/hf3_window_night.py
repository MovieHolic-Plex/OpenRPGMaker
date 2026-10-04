import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'door_wood', 'work'))
from hf3_lib import *
S = 'window_night'

def frame(cv, r, o, hi, body, lo, mull_v, mull_h, sill_hi, sill_lo, glass=None):
    """16x16 창 뼈대: 틀 x2..13,y2..12, 유리 x4..11,y4..11, 세로 창살 x7, 가로 창살 y7, 턱 y13..14."""
    cv.hl(2, 2, 13, r, o)
    cv.hl(3, 3, 12, r, hi); cv.px(2, 3, r, o); cv.px(13, 3, r, o)
    cv.rect(2, 4, 3, 12, r, body); cv.rect(12, 4, 13, 12, r, body)
    cv.vl(2, 3, 12, r, o); cv.vl(13, 3, 12, r, o)
    cv.vl(3, 4, 12, r, hi); cv.vl(12, 4, 12, r, lo)
    cv.hl(12, 3, 12, r, body); cv.hl(12, 12, 12, r, lo)
    cv.vl(7, 4, 11, r, mull_v); cv.hl(7, 4, 11, r, mull_h)
    cv.hl(13, 1, 14, r, sill_hi); cv.hl(14, 1, 14, r, sill_lo)
    cv.px(14, 13, r, sill_lo)

def A():
    cv = Cv(16, 16)
    frame(cv, 'mahog', 1, 5, 3, 2, 4, 3, 5, 2)
    for y in range(4, 12):
        for x in range(4, 12):
            if x == 7 or y == 7: continue
            cv.px(x, y, 'murk', 1 if y < 7 else 0)
    cv.rect(4, 4, 6, 5, 'murk', 2); cv.px(5, 5, 'moon', 3); cv.px(6, 5, 'moon', 3); cv.px(5, 6, 'moon', 3)
    cv.px(9, 9, 'moon', 1); cv.px(10, 9, 'moon', 1)
    return cv, '밤 창 A — 짙은 마호가니 틀·십자 창살(세로 4단·가로 3단), 유리 murk 1~0단(밤), 왼위 칸에 달빛 moon 3단 세 점, 밝은 턱. 벽면 위 2px 비움.'

def B():
    cv = Cv(16, 16)
    frame(cv, 'mahog', 0, 6, 5, 3, 6, 5, 6, 3)
    for y in range(4, 12):
        for x in range(4, 12):
            if x == 7 or y == 7: continue
            cv.px(x, y, 'murk', 0)
    # 큰 달빛 한 덩이: 왼위 칸 안 대각 띠
    for (x, y, t) in [(4, 4, 4), (5, 4, 3), (4, 5, 3), (5, 5, 5), (6, 5, 4), (5, 6, 4), (6, 6, 3), (6, 4, 2)]:
        cv.px(x, y, 'moon', t) if t > 1 else None
    for (x, y, t) in [(8, 8, 2), (9, 8, 2), (8, 9, 2)]:
        cv.px(x, y, 'murk', 3)
    return cv, '밤 창 B — 틀 5·6단으로 밝게, 유리는 murk 0단(거의 검정), 창살 6·5단. 왼위 칸의 큰 달빛 덩이(moon 3~5단)와 반대쪽 옅은 반사 하나. 어두운 방에서 틀선과 달빛만 보인다.'

def C():
    cv = Cv(16, 16)
    frame(cv, 'rot', 0, 5, 4, 2, 3, 3, 5, 2)
    # 납테 마름모 유리: 동화 창 — 유리 칸마다 마름모(납 grave 2단), 유리 murk 2~3단
    for y in range(4, 12):
        for x in range(4, 12):
            if x == 7 or y == 7: continue
            cv.px(x, y, 'murk', 2)
    cv.px(4, 4, 'murk', 3); cv.px(5, 4, 'murk', 3); cv.px(4, 5, 'murk', 3)
    cv.px(6, 6, 'grave', 2); cv.px(6, 5, 'grave', 2); cv.px(5, 6, 'grave', 2)
    cv.px(8, 5, 'grave', 2); cv.px(9, 4, 'grave', 2); cv.px(10, 5, 'grave', 2)
    cv.px(9, 6, 'grave', 2); cv.px(5, 8, 'grave', 2); cv.px(6, 9, 'grave', 2); cv.px(5, 10, 'grave', 2)
    cv.px(9, 8, 'grave', 2); cv.px(10, 9, 'grave', 2); cv.px(9, 10, 'grave', 2)
    cv.px(5, 5, 'moon', 4)
    return cv, '밤 창 C — 어두운 동화색(rot) 틀·창살, 유리 murk 2단에 납선 마름모 조각 넷(grave 2단), 왼위 달빛 한 점.'

if __name__ == '__main__':
    for n, f in zip('ABC', (A, B, C)):
        cv, note = f(); cv.emit(S, 'hf3-' + n, note)
