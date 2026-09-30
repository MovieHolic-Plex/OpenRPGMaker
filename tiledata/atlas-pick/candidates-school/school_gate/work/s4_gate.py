import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from s4_lib import C, write_item, shadow

def pillar(c, x0, b, wide_cap=True, narrow=False):
    w = 12
    if narrow: x0 += 1; w = 10
    # 몸통 y7..44
    for y in range(7, 45):
        for x in range(x0, x0 + w): c.px(x, y, 'mgran', 4)
    c.vl(x0, 7, 38, 'mgran', 5 + b); c.vl(x0 + 1, 7, 38, 'mgran', 5)
    c.vl(x0 + w - 1, 7, 38, 'mgran', 1); c.vl(x0 + w - 2, 7, 38, 'mgran', 2 - (1 if b else 0))
    # 돌 줄눈(가로, 4단)
    for y in (14, 22, 30, 38):
        c.hl(x0, y, w, 'mgran', 2 - (1 if b else 0))
    # 받침(y41..44)
    c.hl(x0 - 1, 41, w + 2, 'mgran', 5); c.rect(x0 - 1, 42, w + 2, 3, 'mgran', 3)
    c.hl(x0 - 1, 44, w + 2, 'mgran', 1); c.vl(x0 + w, 42, 3, 'mgran', 1)
    # 갓돌(y4..6) 더 넓게
    cw = w + 4 if wide_cap else w + 2
    cx = x0 - (cw - w) // 2
    c.hl(cx, 4, cw, 'mgran', 6 + (1 if b else 0)); c.rect(cx, 5, cw, 2, 'mgran', 4); c.hl(cx, 7, cw, 'mgran', 1)
    c.vl(cx + cw - 1, 5, 3, 'mgran', 1); c.vl(cx, 5, 2, 'mgran', 5)
    # 등(y1..3)
    lx = x0 + w // 2 - 2
    c.rect(lx, 1, 4, 3, 'vyellow', 5 if not b else 6); c.hl(lx, 1, 4, 'vyellow', 3); c.vl(lx + 3, 2, 2, 'vyellow', 2)
    c.px(lx, 2, 'vwhite', 6)
    if b:
        for (x, y) in [(lx - 1, 2), (lx + 4, 2), (lx - 1, 3), (lx + 4, 3), (lx + 1, 0), (lx + 2, 0)]: c.px(x, y, '%')

def gate(c, b, arch=False):
    # 문틀 x14..49, 철 창살
    x0, x1 = 14, 49
    ytop, ybot = 12, 39
    # 레일
    for x in range(x0, x1 + 1):
        c.px(x, 12, 'mmetal', 6 + (1 if b else 0)); c.px(x, 13, 'mmetal', 4); c.px(x, 14, 'mmetal', 2)
        c.px(x, 37, 'mmetal', 5); c.px(x, 38, 'mmetal', 3); c.px(x, 39, 'mmetal', 1)
    # 창살 (3px 간격, 1px 굵기 + 어두운 짝)
    for x in range(x0 + 1, x1, 3):
        for y in range(15, 37):
            c.px(x, y, 'mmetal', 4 if not b else 5)
        c.px(x, 15, 'mmetal', 6); 
        if x + 1 < x1: 
            for y in range(15, 37): c.px(x + 1, y, 'mmetal', 1 if b else 2) if False else None
    # 가운데 이음 (양쪽 문짝)
    for y in range(12, 40): 
        c.px(31, y, 'mmetal', 2); c.px(32, y, 'mmetal', 6 if b else 5)
    # 가로 보강대
    c.hl(x0, 26, x1 - x0 + 1, 'mmetal', 3)
    # 레일 홈(바닥 y40..41 어두운 선)
    c.hl(x0, 40, x1 - x0 + 1, 'mmetal', 2); c.hl(x0, 41, x1 - x0 + 1, 'mmetal', 1)
    # 바퀴 두 개 
    for wx in (18, 45): c.px(wx, 40, 'viron', 4); c.px(wx + 1, 40, 'viron', 2)
    # 위 장식 창끝 (뾰족)
    if not arch:
        for x in range(x0 + 1, x1, 6): c.px(x, 11, 'mmetal', 6); c.px(x, 10, 'mmetal', 4)
    else:
        # 위 곡선 레일: 가운데가 더 높음
        for x in range(x0, x1 + 1):
            d = abs(x - 31.5)
            h = int(6 - d * d / 55)
            for k in range(h):
                c.px(x, 12 - 1 - k, 'mmetal', 5 if k == h - 1 else 3)
        # 창살 윗 연장 
        for x in range(x0 + 1, x1, 3):
            d = abs(x - 31.5); h = int(6 - d * d / 55)
            for yy in range(12 - h, 12): c.px(x, yy, 'mmetal', 4)

def plate(c, b):
    # 왼쪽 기둥 명패 (글자 없이 가로 홈 2줄)
    c.rect(4, 22, 8, 7, 'vbrass', 4); c.hl(4, 22, 8, 'vbrass', 6); c.vl(4, 22, 7, 'vbrass', 5); c.hl(4, 28, 8, 'vbrass', 1); c.vl(11, 23, 6, 'vbrass', 2)
    c.hl(5, 24, 5, 'vbrass', 1); c.hl(5, 26, 4, 'vbrass', 1)

def base(b, arch=False, narrow=False, wide_cap=True):
    c = C(64, 48)
    pillar(c, 2, b, wide_cap, narrow); pillar(c, 50, b, wide_cap, narrow)
    gate(c, b, arch)
    plate(c, b)
    # 그림자
    for x in range(14, 50): c.px(x, 45, '~')
    for x in range(16, 48): c.px(x, 46, '-')
    if b:
        for x in range(15, 56): c.px(x, 46, '~') if False else None
        for x in range(6, 20): c.px(x, 46, '-') if False else None
    return c

def A(): return base(0)
def B():
    c = base(1)
    for x in range(14, 62): c.px(x, 46, '~') if c.at(x, 46) is None else None
    for x in range(20, 60): c.px(x, 47, '-') if c.at(x, 47) is None else None
    return c
def Cc(): return base(0, arch=True, narrow=True, wide_cap=True)

if __name__ == '__main__':
    write_item(A(), 'school_gate', 'A', '교문: 화강암 기둥 2개(줄눈·받침·갓돌)에 노란 등, 왼쪽 기둥 명패(글자 없음), 가운데 철 창살 미닫이 문, 레일 홈, 바퀴')
    write_item(B(), 'school_gate', 'B', '명암 강화: 돌 밝은 쪽·짙은 그늘, 등에 % 빛무리, 긴 바닥 그림자')
    write_item(Cc(), 'school_gate', 'C', '재해석: 좁은 기둥에 넓은 갓돌, 문 위쪽을 가운데가 높은 아치형으로')
