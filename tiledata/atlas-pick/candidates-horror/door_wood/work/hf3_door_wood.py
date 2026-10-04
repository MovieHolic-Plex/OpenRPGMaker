import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from hf3_lib import *
S = 'door_wood'

def A():
    cv = Cv(16, 32); door_skeleton(cv, 'mahog', 3)
    P = ['2222222.', '2333334.', '2333334.', '2333334.', '2333334.', '2333334.', '2333334.', '.444444.']  # 안쪽 6폭 패널(위)
    # 위 패널 y7..14, 아래 패널 y17..28 (x5..10)
    def panel(y0, y1):
        cv.hl(y0, 5, 10, 'mahog', 2)
        for y in range(y0 + 1, y1):
            cv.px(5, y, 'mahog', 2); cv.rect(6, y, 9, y, 'mahog', 3); cv.px(10, y, 'mahog', 4)
        cv.px(5, y1, 'mahog', 3); cv.hl(y1, 6, 10, 'mahog', 4)
    panel(7, 14); panel(17, 28)
    cv.hl(30, 4, 11, 'mahog', 2)
    T = lambda s: ('tarn', s)
    cv.px(9, 21, 'tarn', 5); cv.px(10, 21, 'tarn', 4); cv.px(9, 22, 'tarn', 3); cv.px(10, 22, 'tarn', 2)
    return cv, '기본 두 패널 문 — 위 2px 비우고 문틀 4px(왼 밝게·오른 어둡게), 문짝은 벽지보다 두 단 아래 3단, 들어간 패널 둘(위 8·아래 12칸), 놋쇠 손잡이 2×2. 얼룩·균열 없음.'

def B():
    cv = Cv(16, 32)
    door_skeleton(cv, 'mahog', 1, L=(1, 6, 5, 3), R=(3, 5, 4, 1), T=(1, 6, 5, 3))
    # 어두운 문짝(1단) 위에 커다란 밝은 무늬 둘: 위 큰 패널 테두리 4단, 아래 큰 패널 테두리 4단, 가운데 문 가르는 세로선 없음
    def panel(y0, y1):
        cv.hl(y0, 5, 10, 'mahog', 4)
        for y in range(y0 + 1, y1):
            cv.px(5, y, 'mahog', 4); cv.px(10, y, 'mahog', 3); cv.rect(6, y, 9, y, 'mahog', 2)
        cv.hl(y1, 5, 10, 'mahog', 3); cv.px(5, y1, 'mahog', 4)
    panel(7, 14); panel(17, 28)
    cv.hl(30, 4, 11, 'mahog', 0)
    cv.px(9, 21, 'tarn', 5); cv.px(10, 21, 'tarn', 5); cv.px(9, 22, 'tarn', 4); cv.px(10, 22, 'tarn', 3)
    cv.px(9, 20, 'tarn', 2); cv.px(10, 20, 'tarn', 2)
    return cv, '어두운 데서 읽히는 문 — 문틀은 6·5단 밝게 또렷한 테, 문짝은 1단으로 짙게(틀과 문짝 5단 차), 큰 패널 둘의 밝은 테두리만, 손잡이는 밝은 놋쇠 5단.'

def C():
    cv = Cv(16, 32)
    door_skeleton(cv, 'rot', 3, L=(0, 5, 4, 1), R=(4, 4, 3, 0), T=(0, 5, 4, 1), sill=0)
    # 세로 판자 2폭 4장: x4..5 x6..7 x8..9 x10..11, 사이 틈 1단 → 폭 2px 판자 넷 (틈은 오른쪽 1px)
    for k in range(4):
        x = 4 + 2 * k
        cv.vl(x, 6, 30, 'rot', 4 if k % 2 == 0 else 3)
        cv.vl(x + 1, 6, 30, 'rot', 2)
    # 결(나뭇결) 몇 가닥 — 판자별 다른 높이
    for (x, y, l) in [(4, 9, 3), (6, 14, 4), (8, 8, 2), (10, 18, 4), (4, 22, 3), (6, 25, 2), (8, 21, 3), (10, 11, 2)]:
        cv.vl(x, y, y + l - 1, 'rot', 3 if x in (4, 8) else 2)
    # 쇠 띠 경첩 둘 + 대갈못
    for y in (9, 22):
        cv.hl(y, 4, 11, 'viron', 2); cv.hl(y + 1, 4, 11, 'viron', 3); cv.hl(y + 2, 4, 11, 'viron', 1)
        cv.px(5, y + 1, 'viron', 5); cv.px(10, y + 1, 'viron', 5)
    # 쇠고리 손잡이
    cv.px(10, 16, 'tarn', 4); cv.px(9, 17, 'tarn', 4); cv.px(11, 17, 'tarn', 2); cv.px(10, 18, 'tarn', 2)
    return cv, '재질 문 — 어두운 동화색(rot) 세로 판자 넷·틈 한 줄씩·결 가닥, 쇠 띠 경첩 둘(대갈못), 놋 고리 손잡이. 썩음·핏자국 없음.'

if __name__ == '__main__':
    for n, f in zip('ABC', (A, B, C)):
        cv, note = f(); cv.emit(S, 'hf3-' + n, note)
