import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../house_roof/work'))
from j1_lib import C
OUT = os.path.dirname(os.path.dirname(__file__))
W, H = 16, 32
CX, CY = 7.5, 6.5

def dist(x, y): return ((x - CX) ** 2 + (y - CY) ** 2) ** .5

def sign_round(c, strong):
    for y in range(0, 14):
        for x in range(0, 16):
            d = dist(x, y)
            if d > 6.3: continue
            lit = (x - CX) + (y - CY)          # 음수=왼쪽 위
            if d > 5.4: r, t = 'kgreen', 0          # 바깥 윤곽(같은 재질의 어두운 단)
            elif d > 4.5:
                r = 'kgreen'
                t = 4 if lit < -3 else (3 if lit < 2 else 2)
                if strong: t = 5 if lit < -3 else (3 if lit < 2 else 1)
            else:
                r = 'mwhite'
                t = 4 if lit < -1 else 3
                if strong: t = 5 if lit < -2 else (3 if lit < 2 else 2)
            c.px(x, y, r, t)
    # 버스 그림 자리: 옆모습 6x4
    bus = ['.gggg.',
           'gwwgwg',
           'gggggg',
           'goggog']
    for j, row in enumerate(bus):
        for i, ch in enumerate(row):
            x, y = 5 + i, 4 + j
            if ch == 'g': c.px(x, y, 'kgreen', 2 if strong else 3)
            elif ch == 'w': c.px(x, y, 'mwhite', 5)
            elif ch == 'o': c.px(x, y, 'kgreen', 0)
    for x in range(5, 11): c.px(x, 8, 'kgreen', 1) if False else None

def pole(c, x0, y0, y1, strong):
    for y in range(y0, y1):
        if strong:
            c.px(x0, y, 'mmetal', 6); c.px(x0 + 1, y, 'mmetal', 2)
        else:
            c.px(x0, y, 'mmetal', 5); c.px(x0 + 1, y, 'mmetal', 3)
    for y in range(y0, y1):
        c.px(x0 + 2, y, 'mmetal', 1 if strong else 2)

def board(c, x, y, w, h, strong):
    c.rect(x, y, w, h, 'mwhite', 4 if not strong else 5)
    c.hl(x, y, w, 'mmetal', 6 if strong else 5)
    c.hl(x, y + h - 1, w, 'mmetal', 1)
    c.vl(x, y, h, 'mmetal', 5 if strong else 4)
    c.vl(x + w - 1, y, h, 'mmetal', 1)
    c.hl(x + 1, y + 1, w - 2, 'kgreen', 3)      # 머리띠
    for k, yy in enumerate((y + 3, y + 5, y + 7)):
        if yy < y + h - 1:
            c.hl(x + 1, yy, w - 3 - (k % 2), 'mmetal', 3)
    if strong:
        c.vl(x + w - 2, y + 1, h - 2, 'mwhite', 2)

def base(c, strong):
    for y in range(26, 32):
        for x in range(0, 16):
            dx = (x - 7.5) / 5.8; dy = (y - 28.5) / 2.9
            if dx * dx + dy * dy > 1: continue
            if y <= 26: t = 5 if strong else 4
            elif y == 27: t = 4 if strong else 4
            elif y <= 29: t = 3 if x < 8 else 2
            else: t = 1
            if strong and y >= 28 and x >= 8: t = 1
            c.px(x, y, 'lacq', t)
    c.px(7, 27, 'lacq', 5); c.px(8, 27, 'lacq', 4)
    for x in range(3, 13): c.px(x, 31, 'lacq', 0)

def shadow(c, strong):
    if strong:
        for x in range(2, 15): c.px(x, 31, '~') if c.at(x, 31) is None else None
        for x in range(9, 16): c.px(x, 30, '-') if c.at(x, 30) is None else None
        for x in range(10, 16): c.px(x, 29, '-') if c.at(x, 29) is None else None
    else:
        for x in range(4, 12): c.px(x, 31, '~') if c.at(x, 31) is None else None

for X, strong in (('A', False), ('B', True)):
    c = C(W, H)
    sign_round(c, strong)
    pole(c, 7, 13, 28, strong)
    board(c, 3, 15, 10, 9, strong)
    base(c, strong)
    shadow(c, strong)
    c.save(os.path.join(OUT, f'j1-{X}.pxg'))

# C: 재해석 — 둥근 판 대신 큰 사각 판(윗변이 둥글다), 버스 정면 그림, 기둥 굵게
c = C(W, H)
for y in range(0, 12):
    for x in range(1, 15):
        if (y == 0 and (x < 4 or x > 11)) or (y == 1 and (x < 2 or x > 13)): continue
        edge = x in (1, 14) or y in (0, 11) or (y == 1 and x in (2, 13))
        if edge: c.px(x, y, 'kgreen', 0)
        elif x == 2 or y == 1 or y == 2 and False: c.px(x, y, 'kgreen', 4)
        elif x == 13 or y == 10: c.px(x, y, 'kgreen', 2)
        else: c.px(x, y, 'mwhite', 4 if x < 8 else 3)
# 정면 버스 그림
bus = ['.gggggg.',
       'gwwwwwwg',
       'gwwwwwwg',
       'gggggggg',
       'gyggggyg',
       '.o....o.']
for j, row in enumerate(bus):
    for i, ch in enumerate(row):
        x, y = 4 + i, 3 + j
        if ch == 'g': c.px(x, y, 'kgreen', 3)
        elif ch == 'w': c.px(x, y, 'mwhite', 5)
        elif ch == 'y': c.px(x, y, 'myellow', 4)
        elif ch == 'o': c.px(x, y, 'mout', 1)
c.hl(3, 9, 10, 'kgreen', 2)
for y in range(12, 28):
    c.px(6, y, 'mmetal', 5); c.px(7, y, 'mmetal', 4); c.px(8, y, 'mmetal', 2); c.px(9, y, 'mmetal', 1)
c.rect(2, 15, 12, 8, 'mwhite', 4)
c.hl(2, 15, 12, 'mmetal', 5); c.hl(2, 22, 12, 'mmetal', 1)
c.vl(2, 15, 8, 'mmetal', 4); c.vl(13, 15, 8, 'mmetal', 1)
for yy in (17, 19, 21):
    c.hl(3, yy, 4, 'mmetal', 3); c.hl(8, yy, 4, 'mmetal', 3)
c.vl(7, 16, 6, 'mmetal', 2)
base(c, False)
shadow(c, False)
c.save(os.path.join(OUT, 'j1-C.pxg'))
