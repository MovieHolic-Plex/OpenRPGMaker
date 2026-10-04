import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'school_gate', 'work'))
from s4_lib import C, write_item, shadow

def wall(c, b):
    # 뒷벽 타일 띠: x1..30, y1..13, 4x4 타일 줄눈
    for y in range(1, 14):
        for x in range(1, 31):
            grout = (x % 4 == 1) or (y % 4 == 1)
            c.px(x, y, 'stile', 2 + b if grout else 4 + b)
    for y in range(2, 14):
        for x in range(2, 31):
            if (x % 4 == 2 and y % 4 == 2): c.px(x, y, 'stile', 5 + b)
    c.hl(1, 13, 30, 'stile', 1 + b)   # 몰딩 아랫선 
    c.clear(1, 1); c.clear(30, 1)

def faucet(c, x, b):
    # T자 수전: 세로대 2px (y9..13), 팔 y8 4px, 부리는 아래로
    c.vl(x, 9, 4, 'mmetal', 5 + b); c.vl(x + 1, 9, 4, 'mmetal', 3)
    c.hl(x - 1, 8, 4, 'mmetal', 6 + b); c.hl(x - 1, 7, 4, 'mmetal', 3)
    c.px(x + 2, 8, 'mmetal', 2); c.px(x - 1, 7, 'mmetal', 4)
    c.vl(x - 1, 9, 2, 'mmetal', 4)     # 손잡이 쪽 짧은 대
    c.px(x + 1, 14, 'mmetal', 2)

def sink(c, b, basins):
    # 윗면 넓게: y14..16 림, 물 y17..21 어두운 유리, 앞면 y22..27, 다리 y28..30
    c.hl(1, 14, 30, 'tray', 5 + (1 if b else 0)); c.hl(1, 15, 30, 'tray', 4)
    c.rect(1, 16, 30, 1, 'tray', 3)
    for (bx0, bx1) in basins:
        for y in range(17, 22):
            for x in range(bx0, bx1 + 1):
                c.px(x, y, 'mdglass', 2 if y < 19 else 3)
        c.hl(bx0, 17, bx1 - bx0 + 1, 'mdglass', 1)
        c.px(bx0 + 1, 18, '&'); c.px(bx0 + 2, 18, '&'); c.px(bx0 + 1, 19, '&')
        c.hl(bx0, 21, bx1 - bx0 + 1, 'mdglass', 4 + b)     # 물 표면 밝은 줄
        c.px((bx0 + bx1)//2, 20, 'mmetal', 5)             # 배수구
    # 사이 림
    for y in range(17, 22): 
        for x in range(1, 31):
            if c.at(x, y) is None: c.px(x, y, 'tray', 4 if y < 20 else 3)
    # 앞면
    for y in range(22, 28):
        for x in range(1, 31): c.px(x, y, 'tray', 3 - (1 if b and y > 24 else 0))
    c.hl(1, 22, 30, 'tray', 5 + b if b else 4)
    c.vl(1, 22, 6, 'tray', 4); c.vl(30, 22, 6, 'tray', 1)
    c.hl(1, 27, 30, 'tray', 1)
    for x in (10, 20): c.vl(x, 23, 4, 'tray', 2)           # 캐비닛 문 이음
    # 다리
    for x in (2, 27):
        c.vl(x, 28, 3, 'viron', 3); c.vl(x + 1, 28, 3, 'viron', 1)
    # 바닥 그림자
    for x in range(4, 27): c.px(x, 31, '-') if not b else c.px(x, 31, '~')

def A():
    c = C(32, 32); wall(c, 0)
    for fx in (5, 14, 23): faucet(c, fx, 0)
    sink(c, 0, [(3, 10), (12, 19), (21, 28)] if False else [(2, 29)]); return c
def B():
    c = C(32, 32); wall(c, -1)
    for fx in (5, 14, 23): faucet(c, fx, 1)
    sink(c, 1, [(2, 29)])
    # 물 위 반사 강조
    c.hl(4, 18, 6, '&'); c.hl(16, 19, 8, '&')
    return c
def Cc():
    c = C(32, 32); wall(c, 0)
    # 둥근 세면대 세 개 따로
    for i, cx in enumerate((6, 16, 26)):
        c.vl(cx, 7, 6, 'mmetal', 5); c.hl(cx - 1, 6, 3, 'mmetal', 6); c.px(cx - 1, 7, 'mmetal', 3)
        c.ell(cx, 19, 4.6, 3.2, 'tray', 4)
        c.ell(cx, 19, 3.4, 2.2, 'mdglass', 2)
        c.px(cx - 1, 18, '&'); c.px(cx - 2, 19, '&')
        c.hl(cx - 3, 21, 7, 'mdglass', 4) if False else None
        c.vl(cx, 24, 3, 'tray', 2); c.hl(cx - 2, 26, 5, 'tray', 3)
    c.hl(3, 27, 26, 'tray', 2)
    for x in range(4, 28): c.px(x, 30, '-')
    return c

if __name__ == '__main__':
    write_item(A(), 'water_fountain', 'A', '복도 수도대: 4x4 타일 뒷벽, 은색 T자 수전 3개, 긴 스테인리스 싱크(윗면 넓게)·짙은 물칸·반사, 캐비닛 앞면, 얇은 철 다리')
    write_item(B(), 'water_fountain', 'B', '명암 강화: 벽 타일 어둡게, 수전·림 하이라이트, 물 반사 확대, 앞면 아래 짙게, 바닥 그림자')
    write_item(Cc(), 'water_fountain', 'C', '재해석: 긴 싱크 대신 둥근 세면 볼 셋을 나란히, 각각 기둥 받침')
