import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'school_gate', 'work'))
from s4_lib import C, write_item, shadow

def foot(c, b):
    # 발판: 윗면 y25..27 보이게, 앞면 y28..29
    c.hl(1, 25, 14, 'mmetal', 6 + b if b else 6); c.hl(1, 26, 14, 'mmetal', 5); c.hl(1, 27, 14, 'mmetal', 4)
    c.hl(1, 28, 14, 'mmetal', 3 - (1 if b else 0)); c.hl(1, 29, 14, 'mmetal', 1)
    c.px(1, 25, 'mmetal', 3); c.px(14, 25, 'mmetal', 3)
    c.vl(1, 26, 4, 'mmetal', 4); c.vl(14, 26, 4, 'mmetal', 1)
    # 발 모양 표시 
    c.hl(4, 26, 3, 'mmetal', 2); c.hl(9, 26, 3, 'mmetal', 2)
    c.clear(1, 29) if False else None

def A():
    c = C(16, 32)
    # 기둥 x6..9 (흰), 눈금 x10..12
    c.vl(6, 0, 25, 'vwhite', 6); c.vl(7, 0, 25, 'vwhite', 5); c.vl(8, 0, 25, 'vwhite', 4); c.vl(9, 0, 25, 'vwhite', 2)
    for i, y in enumerate(range(2, 25, 3)):
        w = 3 if i % 2 == 0 else 2
        c.hl(10, y, w, 'vblack', 3)
    # 압판 
    c.hl(2, 10, 12, 'mmetal', 6); c.hl(2, 11, 12, 'mmetal', 4); c.hl(2, 12, 12, 'mmetal', 2)
    c.vl(2, 10, 3, 'mmetal', 5); c.vl(13, 10, 3, 'mmetal', 1)
    c.hl(4, 13, 8, 'mmetal', 1) if False else None
    c.hl(3, 13, 10, '-')
    c.px(7, 9, 'mmetal', 4); c.px(8, 9, 'mmetal', 2)      # 압판 손잡이 
    foot(c, 0)
    for x in range(3, 13): c.px(x, 30, '-')
    return c
def B():
    c = C(16, 32)
    c.vl(6, 0, 25, 'vwhite', 6); c.vl(7, 0, 25, 'vwhite', 6); c.vl(8, 0, 25, 'vwhite', 3); c.vl(9, 0, 25, 'vwhite', 1)
    for i, y in enumerate(range(2, 25, 3)):
        w = 3 if i % 2 == 0 else 2
        c.hl(10, y, w, 'vblack', 2)
    c.hl(2, 10, 12, 'mmetal', 7); c.hl(2, 11, 12, 'mmetal', 5); c.hl(2, 12, 12, 'mmetal', 1)
    c.vl(2, 10, 3, 'mmetal', 6); c.vl(13, 10, 3, 'mmetal', 0)
    c.hl(3, 13, 10, '~'); c.hl(3, 14, 10, '-')
    c.px(7, 9, 'mmetal', 6); c.px(8, 9, 'mmetal', 3)
    foot(c, 1)
    for x in range(3, 13): c.px(x, 30, '~')
    for x in range(4, 12): c.px(x, 31, '-')
    return c
def Cc():
    c = C(16, 32)
    # 넓은 등판 x4..11, y0..24 (연한 나무, 눈금 표시)
    for y in range(0, 25):
        for x in range(4, 12): c.px(x, y, 'vpine', 5)
    c.vl(4, 0, 25, 'vpine', 6); c.vl(11, 0, 25, 'vpine', 3); c.hl(4, 0, 8, 'vpine', 6)
    for i, y in enumerate(range(2, 24, 3)):
        c.hl(4, y, 4 if i % 2 == 0 else 2, 'vdwood', 1)
    # 미끄럼 팔: 등판 오른쪽으로 뻗음 (y9..11), 끝에 판
    c.rect(11, 9, 4, 2, 'mmetal', 5); c.hl(11, 9, 4, 'mmetal', 6); c.hl(11, 11, 4, 'mmetal', 2)
    c.rect(13, 11, 2, 3, 'mmetal', 3); c.vl(14, 11, 3, 'mmetal', 1)
    # 작은 다이얼 (등판 아래쪽)
    c.ell(7.5, 19, 2.3, 2.3, 'vwhite', 5); c.px(7, 18, 'vwhite', 6); c.px(8, 19, 'vblack', 3); c.px(7, 20, 'vwhite', 2); c.px(8, 20, 'vwhite', 2)
    foot(c, 0)
    for x in range(3, 13): c.px(x, 30, '-')
    return c

if __name__ == '__main__':
    write_item(A(), 'height_scale', 'A', '신장계: 흰 기둥에 검은 눈금(길고 짧게 번갈아), 금속 압판+손잡이, 아랫 발판(윗면 보임)·발자국 홈')
    write_item(B(), 'height_scale', 'B', '명암 강화: 기둥 왼쪽 하이라이트·오른쪽 짙게, 압판 밑 그림자 2줄, 발판 앞 짙게, 바닥 그림자')
    write_item(Cc(), 'height_scale', 'C', '재해석: 좁은 기둥 대신 넓은 나무 등판(눈금 새김)에 옆으로 뻗은 금속 슬라이드 팔과 작은 다이얼')
