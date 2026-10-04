import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'door_wood', 'work'))
from hf3_lib import *
S = 'window_barred'

def base(cv, r, o, hi, body, lo, sill_hi, sill_lo):
    """틀 x1..14, y2..12(테 1px 윤곽), 유리 x3..12,y4..11, 턱 y13..14."""
    cv.hl(2, 1, 14, r, o)
    cv.rect(1, 3, 14, 12, r, body)
    cv.vl(1, 3, 12, r, o); cv.vl(14, 3, 12, r, o)
    cv.hl(3, 2, 13, r, hi); cv.vl(2, 3, 12, r, hi)
    cv.vl(13, 4, 12, r, lo); cv.hl(12, 3, 13, r, lo)
    cv.hl(13, 1, 14, r, sill_hi); cv.hl(14, 1, 14, r, sill_lo)

def bars(cv, xs, hi, mid, lo, r='tin', y0=3, y1=12, cap=None):
    for x in xs:
        for y in range(y0, y1 + 1):
            cv.px(x, y, r, hi); cv.px(x + 1, y, r, lo if lo is not None else mid)
        cv.px(x, y0, r, cap if cap is not None else hi)

def glass(cv, base_t, lit=None):
    for y in range(4, 12):
        for x in range(3, 13): cv.px(x, y, 'murk', base_t)
    if lit:
        for (x, y, t) in lit: cv.px(x, y, 'moon', t)

def A():
    cv = Cv(16, 16)
    base(cv, 'dust', 1, 5, 4, 3, 5, 3)
    glass(cv, 1, [(3, 4, 2), (4, 4, 2), (3, 5, 2)])
    bars(cv, (3, 7, 11), 5, 4, 3, y0=4, y1=11)
    return cv, '쇠창살 창 A — 흰 칠 쇠 틀(dust 4~5단), 유리 murk 1단, 세로 쇠창살 셋(폭 2px: 밝은 5단 + 어두운 3단), 사이가 2px 열려 유리가 비친다.'

def B():
    cv = Cv(16, 16)
    base(cv, 'dust', 1, 6, 5, 3, 6, 4)
    glass(cv, 0, [(3, 4, 4), (4, 4, 3), (3, 5, 3)])
    bars(cv, (3, 7, 11), 6, 5, 2, y0=4, y1=11)
    return cv, '쇠창살 창 B — 틀 dust 6·5단으로 밝게, 유리는 murk 0단(거의 검정), 창살 6단/2단으로 폭 대비 크게. 어둠 속에서 밝은 틀선과 창살이 격자로 뜬다.'

def C():
    cv = Cv(16, 16)
    base(cv, 'grave', 0, 5, 4, 2, 5, 3)
    glass(cv, 1, [(3, 4, 2), (4, 4, 2)])
    bars(cv, (3, 7, 11), 5, 4, 2, r='viron', y0=4, y1=11)
    # 녹 번짐(창살 아래) + 틀 돌 이빨 빠짐
    for (x, y) in [(3, 10), (7, 9), (7, 10), (11, 11)]: cv.px(x, y, 'rust', 3)
    cv.px(4, 11, 'rust', 2); cv.px(8, 10, 'rust', 2)
    cv.px(14, 5, 'grave', 1); cv.px(14, 6, 'grave', 1)
    return cv, '쇠창살 창 C — 돌 틀(grave 4~5단), 창살은 청회 쇠(viron), 창살 밑동 녹(rust 2~3단) 자국과 틀 오른쪽 이빨 빠진 곳.'

if __name__ == '__main__':
    for n, f in zip('ABC', (A, B, C)):
        cv, note = f(); cv.emit(S, 'hf3-' + n, note)
