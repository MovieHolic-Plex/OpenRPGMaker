import sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'torii', 'work'))
from j3_lib import *
SL = 'konbini_front'
W, H = 64, 48
GOODS = [('mred', 3), ('myellow', 4), ('mblue', 3), ('mgreen', 3), ('morange', 3), ('mwhite', 3), ('mpurple', 3), ('mred', 4)]
def shelves(g, x0, y0, x1, y1, lit, seed=0):
    """창 안: 뒷벽 + 선반 줄 + 상품 덩이."""
    g.rect(x0, y0, x1-x0+1, y1-y0+1, C('mconc', 1 if not lit else 2))
    ys = list(range(y0+3, y1-1, 5))
    for i, sy in enumerate(ys):
        g.hl(x0, sy, x1-x0+1, C('mmetal', 3 if not lit else 4))
        for x in range(x0+1, x1, 3):
            gc = GOODS[(x//3 + i*3 + seed) % len(GOODS)]
            hh = 3 if (x//3+i) % 3 else 2
            g.rect(x, sy-hh, 2, hh, C(*gc)); g.px(x, sy-hh, sh(C(*gc), 1))
def glass(g, x0, y0, x1, y1, glare=True, hi=5):
    """유리 위 대각선 반사 2줄(왼쪽 위 빛)."""
    if not glare: return
    for k in range(0, (x1-x0)+(y1-y0), 1):
        pass
    for off in (6, 7):
        for t in range(0, y1-y0+1):
            x = x0 + off + (y1-y0-t)//2 - 1
            y = y0 + t
            if x0 <= x <= x1: 
                c = g.get(x, y)
                if isinstance(c, tuple): g.px(x, y, sh(c, 1 if off == 7 else 2))
def sign(g, x0, y0, style):
    w = 60
    O = C('mmetal', 1)
    g.rect(x0-1, y0-1, w+2, 12, C('mwhite', 3))
    bands = [(0, 3, C('kgreen', 3)), (3, 1, C('mwhite', 4)), (4, 3, C('korange', 4)), (7, 1, C('mwhite', 4)), (8, 3, C('kblue', 3))]
    for dy, h, c in bands:
        g.rect(x0, y0+dy, w, h, c)
        if h > 1: g.hl(x0, y0+dy, w, sh(c, 1)); g.hl(x0, y0+dy+h-1, w, sh(c, -1))
def A():
    g = Grid(W, H)
    g.rect(0, 0, W, H, C('mwhite', 3))                        # 흰 벽
    g.vl(0, 0, H, C('mwhite', 4)); g.vl(W-1, 0, H, C('mwhite', 2)); g.hl(0, 0, W, C('mwhite', 4))
    sign(g, 2, 2, 'A')
    g.hl(0, 13, W, C('mwhite', 2)); g.hl(0, 14, W, C('mwhite', 1))
    # 유리 두 쪽
    for (x0, x1) in ((3, 15), (48, 60)):
        g.rect(x0-1, 15, x1-x0+3, 27, C('mmetal', 2)); g.rect(x0, 16, x1-x0+1, 25, C('mglass', 2))
        shelves(g, x0+1, 17, x1-1, 39, False)
        glass(g, x0, 16, x1, 40)
        g.hl(x0-1, 15, x1-x0+3, C('mmetal', 4))
    # 문(가운데 두 칸): 문틀 + 두 짝
    g.rect(16, 15, 32, 31, C('mmetal', 2)); g.hl(16, 15, 32, C('mmetal', 4)); g.vl(16, 15, 31, C('mmetal', 3))
    for (x0, x1) in ((18, 30), (33, 45)):
        g.rect(x0, 17, x1-x0+1, 27, C('mglass', 3)); g.rect(x0+1, 18, x1-x0-1, 25, C('mglass', 4))
        g.hl(x0, 17, x1-x0+1, C('mmetal', 4)); g.hl(x0, 43, x1-x0+1, C('mmetal', 2))
        glass(g, x0, 18, x1, 42)
    g.vl(31, 17, 27, C('mmetal', 1)); g.vl(32, 17, 27, C('mmetal', 3))
    for x in (29, 34): g.vl(x, 28, 6, C('mmetal', 5))       # 손잡이
    g.hl(20, 16, 24, C('mmetal', 1)); g.px(31, 16, C('mred', 3)); g.px(32, 16, C('mred', 3)) # 센서
    # 발치: 유리 아래 벽 + 길
    g.rect(0, 42, 16, 4, C('mwhite', 2)); g.hl(0, 42, 16, C('mwhite', 4)); g.rect(48, 42, 16, 4, C('mwhite', 2)); g.hl(48, 42, 16, C('mwhite', 4))
    g.rect(17, 45, 30, 1, C('mmetal', 2))
    g.rect(0, 46, W, 2, C('mpave', 4)); g.hl(0, 46, W, C('mpave', 6))
    # 발깔개
    g.rect(20, 44, 24, 2, C('mconc', 1)); g.hl(20, 44, 24, C('mconc', 3)); 
    for x in range(20, 44, 3): g.px(x, 45, C('mconc', 2))
    g.hl(0, 47, W, C('mpave', 3))
    return g, '강남 조각 결로 흰 벽 테두리, 맨 위 초록·주황·파랑 세 띠 간판(글자·로고 없음), 양쪽 큰 유리창(안에 선반·상품 덩이), 가운데 두 짝 유리 자동문과 발깔개, 발치는 포장 두 줄'
def B():
    g = Grid(W, H)
    g.rect(0, 0, W, H, C('mwhite', 3))
    g.hl(0, 0, W, C('mwhite', 5)); g.vl(0, 0, H, C('mwhite', 5)); g.vl(W-1, 0, H, C('mwhite', 1))
    sign(g, 2, 2, 'B')
    g.hl(2, 1, 60, C('mwhite', 5))                             # 간판 윗 테두리 빛
    g.hl(0, 13, W, C('mwhite', 0)); g.hl(0, 14, W, C('mwhite', 1)); g.hl(0, 15, W, C('mwhite', 2))  # 간판 아래 처마 그림자
    for (x0, x1) in ((3, 15), (48, 60)):
        g.rect(x0-1, 16, x1-x0+3, 26, C('mmetal', 2)); g.rect(x0, 17, x1-x0+1, 24, C('mglass', 2))
        shelves(g, x0+1, 18, x1-1, 39, True)
        # 안쪽 불빛: 위에서 아래로 밝음
        for y in range(18, 24):
            for x in range(x0+1, x1):
                c = g.get(x, y)
                if isinstance(c, tuple) and c[0] == 'mconc': g.px(x, y, sh(c, 1))
        glass(g, x0, 17, x1, 40)
        g.hl(x0-1, 16, x1-x0+3, C('mmetal', 5)); g.hl(x0-1, 41, x1-x0+3, C('mmetal', 1)); g.vl(x1+1, 16, 26, C('mmetal', 1))
    g.rect(16, 16, 32, 30, C('mmetal', 2)); g.hl(16, 16, 32, C('mmetal', 5)); g.vl(16, 16, 30, C('mmetal', 4)); g.vl(47, 16, 30, C('mmetal', 1))
    for (x0, x1) in ((18, 30), (33, 45)):
        g.rect(x0, 18, x1-x0+1, 26, C('mglass', 3)); g.rect(x0+1, 19, x1-x0-1, 24, C('mglass', 5))
        for y in range(34, 43): g.hl(x0+1, y, x1-x0-1, C('mglass', 4 if y < 39 else 3))   # 안이 밝고 아래가 어둡다
        g.hl(x0, 18, x1-x0+1, C('mmetal', 5)); g.hl(x0, 43, x1-x0+1, C('mmetal', 1))
        glass(g, x0, 19, x1, 42)
    g.vl(31, 18, 26, C('mmetal', 0)); g.vl(32, 18, 26, C('mmetal', 3))
    for x in (29, 34): g.vl(x, 28, 6, C('mmetal', 6))
    g.hl(20, 17, 24, C('mmetal', 1)); g.rect(30, 17, 4, 1, C('mred', 4))
    g.rect(0, 42, 16, 4, C('mwhite', 1)); g.hl(0, 42, 16, C('mwhite', 5)); g.rect(48, 42, 16, 4, C('mwhite', 1)); g.hl(48, 42, 16, C('mwhite', 5))
    g.rect(0, 46, W, 2, C('mpave', 4)); g.hl(0, 46, W, C('mpave', 7)); g.hl(0, 47, W, C('mpave', 2))
    g.rect(20, 44, 24, 2, C('mconc', 1)); g.hl(20, 44, 24, C('mconc', 4))
    for x in range(20, 44, 3): g.px(x, 45, C('mconc', 2))
    # 문 앞으로 번지는 불빛(오른쪽 아래 그림자 아님, 바닥 불빛)
    return g, '빛 구조 강화: 간판 윗면 밝게·아래 처마 그림자 세 줄, 유리 안이 밝고(위에서 아래로 어두워짐), 창틀 윗면 밝고 오른쪽 어둡게, 문 손잡이·상단 센서 강조'
def Cc():
    g = Grid(W, H)
    g.rect(0, 0, W, H, C('mwhite', 3)); g.vl(0, 0, H, C('mwhite', 4)); g.vl(W-1, 0, H, C('mwhite', 2))
    # 세로 줄무늬 차양(어닝): 초록·흰·주황·흰·파랑 반복, 아래 끝이 물결
    cols = [C('kgreen', 3), C('mwhite', 4), C('korange', 4), C('mwhite', 4), C('kblue', 3), C('mwhite', 4)]
    for x in range(W):
        c = cols[(x//4) % len(cols)]
        e = 11 + (1 if (x//2) % 2 else 0)
        g.rect(x, 0, 1, e, c); g.px(x, 0, sh(c, 1)); g.px(x, e-1, sh(c, -1))
        g.px(x, e, C('mwhite', 0)) 
    g.hl(0, 13, W, C('mwhite', 1))
    # 창은 통째로 넓게, 가운데 문은 폭 좁게
    g.rect(2, 15, 60, 27, C('mmetal', 2)); g.hl(2, 15, 60, C('mmetal', 4))
    g.rect(3, 16, 58, 25, C('mglass', 2))
    shelves(g, 4, 17, 59, 39, False, seed=2)
    glass(g, 3, 16, 60, 40)
    # 문: 가운데 하나의 넓은 미닫이(두 짝), 창보다 튀어나온 문틀
    g.rect(22, 15, 20, 31, C('mmetal', 3)); g.hl(22, 15, 20, C('mmetal', 5)); g.vl(41, 15, 31, C('mmetal', 1))
    for (x0, x1) in ((24, 31), (33, 40)):
        g.rect(x0, 17, x1-x0+1, 27, C('mglass', 4)); g.hl(x0, 17, x1-x0+1, C('mmetal', 5)); g.hl(x0, 43, x1-x0+1, C('mmetal', 2))
        glass(g, x0, 18, x1, 42)
    g.vl(32, 17, 27, C('mmetal', 1)); g.vl(31, 27, 8, C('mmetal', 6)); g.vl(33, 27, 8, C('mmetal', 6))
    g.rect(0, 42, 22, 4, C('mwhite', 2)); g.hl(0, 42, 22, C('mwhite', 4)); g.rect(42, 42, 22, 4, C('mwhite', 2)); g.hl(42, 42, 22, C('mwhite', 4))
    g.rect(0, 46, W, 2, C('mpave', 4)); g.hl(0, 46, W, C('mpave', 6)); g.hl(0, 47, W, C('mpave', 3))
    g.rect(24, 44, 16, 2, C('mconc', 1)); g.hl(24, 44, 16, C('mconc', 3))
    return g, '실루엣 재해석: 가로 띠 간판 대신 초록·주황·파랑 세로 줄무늬 물결 차양으로 지붕 밑을 덮고, 창은 한 장으로 길게 이은 뒤 가운데 좁은 미닫이 문틀이 튀어나온다'
for k, f in zip('ABC', (A, B, Cc)):
    g, n = f(); g.emit(os.path.join(HERE, '..', f'j3-{k}.pxg'), n, header=f'{SL} j3-{k}')
