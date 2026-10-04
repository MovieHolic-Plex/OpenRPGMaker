import sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'torii', 'work'))
from j3_lib import *
SL = 'konbini_pole'
def pole(g, x, y0, y1, hi=5, lo=3, mid=None):
    g.rect(x, y0, 2, y1-y0+1, C('mmetal', lo)); g.vl(x, y0, y1-y0+1, C('mmetal', hi))
def A():
    g = Grid(16, 48)
    # 간판 상자: 앞면 x2..11, 옆면 x12..13, 윗면 y1
    g.rect(2, 2, 10, 18, C('mwhite', 3)); g.rect(12, 2, 2, 18, C('mwhite', 1)); g.rect(2, 1, 12, 1, C('mwhite', 4))
    g.vl(2, 2, 18, C('mwhite', 4)); g.hl(2, 19, 12, C('mwhite', 1))
    bands = [(3, 5, C('kgreen', 3)), (8, 1, C('washi', 4)), (9, 4, C('korange', 4)), (13, 1, C('washi', 4)), (14, 5, C('kblue', 3))]
    for yy, h, c in bands:
        g.rect(3, yy, 8, h, c); g.hl(3, yy, 8, sh(c, 1)) if h > 1 else None; g.px(11, yy, sh(c, -1)) if h>1 else None
    outline(g, C('mmetal', 2), C('mmetal', 1))
    g.px(1, 1, None); g.px(14, 1, None)
    pole(g, 7, 21, 43); g.rect(6, 21, 4, 1, C('mmetal', 2))
    g.hl(5, 44, 6, C('mmetal', 4)); g.hl(5, 45, 6, C('mmetal', 2)); g.px(10, 44, C('mmetal', 2)); g.px(10, 45, C('mmetal', 1))
    g.hl(6, 46, 8, '~'); g.hl(8, 47, 6, '-')
    return g, '강남 조각 결로 흰 틀 간판 상자(초록·주황·파랑 띠 사이 흰 줄, 글자 없음)와 가는 강철 기둥, 오른쪽 옆면 한 단 어둡게'
def B():
    g = Grid(16, 48)
    g.rect(2, 3, 10, 17, C('mwhite', 3)); g.rect(12, 3, 2, 17, C('mwhite', 0)); g.rect(2, 1, 12, 2, C('mwhite', 5))
    g.hl(2, 1, 12, C('mwhite', 5)); g.hl(3, 2, 10, C('mwhite', 4)); g.vl(2, 3, 17, C('mwhite', 5)); g.hl(2, 19, 12, C('mmetal', 3))
    bands = [(4, 5, C('kgreen', 4)), (9, 1, C('mwhite', 5)), (10, 4, C('korange', 4)), (14, 1, C('mwhite', 5)), (15, 4, C('kblue', 4))]
    for yy, h, c in bands:
        g.rect(3, yy, 8, h, c); g.hl(3, yy, 8, sh(c, 1)) if h > 1 else None; g.hl(3, yy+h-1, 8, sh(c, -1)) if h > 3 else None
    outline(g, C('mmetal', 2), C('mmetal', 0)); g.px(1, 1, None); g.px(14, 1, None)
    pole(g, 7, 21, 43, 6, 2); g.hl(6, 21, 4, C('mmetal', 1)); g.px(6, 22, C('mmetal', 1)); g.px(9, 22, C('mmetal', 1))
    g.hl(5, 44, 6, C('mmetal', 5)); g.hl(5, 45, 6, C('mmetal', 2))
    # 간판이 기둥·바닥에 지는 그림자: 오른쪽 아래로 길게
    g.hl(6, 46, 9, '~'); g.hl(7, 47, 9, '~'); g.hl(10, 46, 1, '~')
    g.vl(10, 30, 14, '-')
    return g, '윗면 5단·앞면 3단·옆면 0단으로 간판 명암 대비를 키우고 흰 밝은 테두리와 기둥 하이라이트, 접지 그림자 두 줄을 길게'
def Cc():
    g = Grid(16, 48)
    # 좁고 긴 기둥형 간판(위가 둥근 지붕), 세로 띠
    g.rect(4, 2, 8, 30, C('mwhite', 3)); g.rect(12, 3, 2, 29, C('mwhite', 1)); g.vl(4, 2, 30, C('mwhite', 4)); g.hl(5, 1, 6, C('mwhite', 4)); g.hl(4, 2, 8, C('mwhite', 4))
    g.px(4, 2, None); g.px(11, 2, None); g.px(12, 3, None) 
    bands = [(4, 8, C('kgreen', 3)), (12, 1, C('washi', 4)), (13, 6, C('korange', 4)), (19, 1, C('washi', 4)), (20, 8, C('kblue', 3))]
    for yy, h, c in bands:
        g.rect(5, yy, 6, h, c); g.hl(5, yy, 6, sh(c, 1)); g.px(10, yy+h-1, sh(c, -1))
    g.hl(5, 29, 6, C('mwhite', 1)) if False else None
    outline(g, C('mmetal', 2), C('mmetal', 1))
    pole(g, 7, 33, 43); g.rect(5, 32, 6, 1, C('mmetal', 2))
    g.hl(4, 44, 8, C('mmetal', 4)); g.hl(4, 45, 8, C('mmetal', 2)); g.px(11, 44, C('mmetal', 2)); g.px(11, 45, C('mmetal', 1))
    g.hl(5, 46, 9, '~'); g.hl(7, 47, 7, '-')
    return g, '간판 상자를 좁고 긴 기둥형(위쪽 모서리 둥글게, 초록·주황·파랑 세 마디)으로 다시 해석, 기둥은 짧게'
for k, f in zip('ABC', (A, B, Cc)):
    g, n = f(); g.emit(os.path.join(HERE, '..', f'j3-{k}.pxg'), n, header=f'{SL} j3-{k}')
