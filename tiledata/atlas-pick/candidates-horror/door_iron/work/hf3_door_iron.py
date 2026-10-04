import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'door_wood', 'work'))
from hf3_lib import *
S = 'door_iron'

def peep(cv, x0, y0, x1, y1, fr, hi, lo, bars=None):
    cv.rect(x0, y0, x1, y1, fr, lo)
    cv.hl(y0, x0, x1, fr, hi); cv.vl(x0, y0, y1, fr, hi)
    cv.rect(x0 + 1, y0 + 1, x1 - 1, y1 - 1, 'void', 1)

def rivets(cv, y, xs, r, t):
    for x in xs: cv.px(x, y, r, t)

def A():
    cv = Cv(16, 32)
    door_skeleton(cv, 'tin', 3, L=(0, 5, 4, 2), R=(3, 3, 2, 0), T=(0, 5, 4, 2), sill=1)
    cv.rect(4, 6, 11, 30, 'viron', 2)
    cv.vl(4, 6, 30, 'viron', 3); cv.vl(11, 6, 30, 'viron', 1)
    peep(cv, 6, 11, 9, 16, 'viron', 4, 1)
    cv.vl(7, 12, 15, 'viron', 3); cv.vl(8, 12, 15, 'viron', 2)
    # 대갈못 줄 둘
    for y in (8, 26):
        cv.hl(y, 5, 10, 'viron', 4); cv.hl(y + 1, 5, 10, 'viron', 1)
        rivets(cv, y, (5, 7, 8, 10), 'viron', 5)
    cv.hl(20, 5, 10, 'viron', 1)
    cv.px(9, 22, 'tin', 5); cv.px(10, 22, 'tin', 4); cv.px(9, 23, 'tin', 3); cv.px(10, 23, 'tin', 2)
    # 녹 덩이 하나(아래 왼)
    cv.rect(5, 27, 6, 29, 'rust', 2); cv.px(5, 29, 'rust', 1); cv.px(6, 29, 'rust', 1)
    return cv, '철문 A — 쇠 틀(tin 3~5단)과 청회 쇠 문짝(viron 2단), 가운데 위 작은 창살 창(속 void), 대갈못 줄 둘, 손잡이, 아래 왼쪽 녹 덩이 하나.'

def B():
    cv = Cv(16, 32)
    door_skeleton(cv, 'tin', 1, L=(0, 6, 5, 3), R=(3, 5, 4, 0), T=(0, 6, 5, 3), sill=2)
    cv.rect(4, 6, 11, 30, 'viron', 0)
    peep(cv, 5, 11, 10, 17, 'viron', 6, 3)
    cv.vl(7, 12, 16, 'viron', 5); cv.vl(8, 12, 16, 'viron', 4)
    for y in (8, 25):
        cv.hl(y, 5, 10, 'viron', 5); cv.hl(y + 1, 5, 10, 'viron', 2)
    cv.px(9, 21, 'tin', 6); cv.px(10, 21, 'tin', 5); cv.px(9, 22, 'tin', 4); cv.px(10, 22, 'tin', 3)
    return cv, '철문 B — 틀 6단, 문짝 0단, 큼직한 창살 창(테 6단, 창살 셋 5·4단, 속 void), 굵은 5단 대갈못 줄 둘. 어둠 속 실루엣용.'

def C():
    cv = Cv(16, 32)
    door_skeleton(cv, 'tin', 3, L=(0, 5, 4, 2), R=(3, 3, 2, 0), T=(0, 5, 4, 2), sill=1)
    # 판 넷(가로 이음), 각 판 가장자리 대갈못
    cv.rect(4, 6, 11, 30, 'viron', 2)
    for y in (12, 20):
        cv.hl(y, 4, 11, 'viron', 0); cv.hl(y + 1, 4, 11, 'viron', 4)
    cv.vl(4, 6, 30, 'viron', 3); cv.vl(11, 6, 30, 'viron', 1)
    peep(cv, 6, 14, 9, 18, 'viron', 4, 1)
    for y in (7, 10, 23, 28):
        rivets(cv, y, (5, 10), 'viron', 5)
    # 녹 흘림: 대갈못 밑으로 세로 녹 줄기(굵게)
    for (x, y0, y1) in [(5, 11, 12), (10, 24, 27), (5, 29, 30)]:
        cv.vl(x, y0, y1, 'rust', 2)
    cv.rect(7, 24, 8, 26, 'rust', 3); cv.hl(26, 7, 8, 'rust', 1)
    cv.px(9, 22, 'tin', 5); cv.px(10, 22, 'tin', 4)
    return cv, '철문 C — 가로 이음 둘로 나눈 세 판(viron 2단, 이음 어두운 0단·밝은 4단), 판마다 대갈못, 대갈못 밑 녹 흘림 줄기와 녹 덩이, 작은 창살 창.'

if __name__ == '__main__':
    for n, f in zip('ABC', (A, B, C)):
        cv, note = f(); cv.emit(S, 'hf3-' + n, note)
