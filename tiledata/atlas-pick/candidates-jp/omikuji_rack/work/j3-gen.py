import sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'torii', 'work'))
from j3_lib import *
SL = 'omikuji_rack'
def post(g, x, y0, y1, w=3, hi=5, mid=4, lo=2, ed=1):
    h = y1-y0+1
    g.rect(x, y0, w, h, C('hinoki', mid)); g.vl(x, y0, h, C('hinoki', hi)); g.vl(x+w-1, y0, h, C('hinoki', lo))
    g.vl(x+w, y0, h, C('hinoki', ed))
def beam(g, x, y, w, h=3, top=6, mid=4, lo=2, ed=1):
    g.rect(x, y, w, h, C('hinoki', mid)); g.hl(x, y, w, C('hinoki', top)); g.hl(x, y+h-1, w, C('hinoki', lo)); g.hl(x, y+h, w, C('hinoki', ed))
    g.vl(x+w-1, y, h, C('hinoki', lo))
def knots(g, x0, x1, y, seed=0, big=1):
    """줄 y 에 매달린 흰 오미쿠지 매듭 덩이: 폭 2, 높이 3~4, 위 한 점 밝게, 오른쪽·아래 그늘."""
    x = x0 + (seed % 2)
    i = 0
    while x + 2 <= x1:
        hh = 3 + ((i + seed) % 3 == 0) * big
        g.rect(x, y+1, 2, hh, C('washi', 4)); g.px(x, y+1, C('washi', 5)); g.px(x+1, y+hh, C('washi', 2)); g.px(x+1, y+1+hh//2, C('washi', 3))
        i += 1; x += 3 if i % 4 else 2
def rope(g, x0, x1, y, c=(2)):
    g.hl(x0, y, x1-x0+1, C('sumi', c)); g.hl(x0, y, x1-x0+1, C('sumi', c))
def A():
    g = Grid(32, 32)
    post(g, 3, 3, 28); post(g, 26, 3, 28)
    beam(g, 2, 3, 28, 3)
    for i, y in enumerate((10, 16, 22)):
        rope(g, 7, 25, y, 3); knots(g, 7, 25, y, seed=i)
    # 발
    g.rect(2, 29, 6, 2, C('hinoki', 2)); g.hl(2, 29, 6, C('hinoki', 4)); g.hl(2, 30, 6, C('hinoki', 1)); g.vl(7, 29, 2, C('hinoki', 1))
    g.rect(24, 29, 6, 2, C('hinoki', 2)); g.hl(24, 29, 6, C('hinoki', 4)); g.hl(24, 30, 6, C('hinoki', 1)); g.vl(29, 29, 2, C('hinoki', 1))
    g.hl(4, 31, 6, '~'); g.hl(25, 31, 7, '~'); g.hl(10, 31, 3, '-'); g.hl(31, 30, 1, '-')
    return g, '강남 조각 결: 흰 나무 틀(기둥 둘·윗보), 가로 줄 세 줄에 흰 종이 매듭이 촘촘히, 왼쪽 빛·오른쪽 그늘 한 단, 발판 둘'
def B():
    g = Grid(32, 32)
    post(g, 3, 3, 28, hi=6, mid=4, lo=1, ed=0); post(g, 26, 3, 28, hi=6, mid=4, lo=1, ed=0)
    beam(g, 2, 3, 28, 4, top=6, mid=4, lo=2, ed=1); g.hl(3, 4, 26, C('hinoki', 5))
    for i, y in enumerate((11, 17, 23)):
        rope(g, 7, 25, y, 3); knots(g, 7, 25, y, seed=i)
        g.hl(7, y+1, 19, '-') if False else None
    for y in (11, 17, 23):   # 줄이 기둥에 지는 그림자
        g.hl(7, y+5, 19, '~') if False else None
    g.rect(2, 29, 6, 2, C('hinoki', 2)); g.hl(2, 29, 6, C('hinoki', 5)); g.hl(2, 30, 6, C('hinoki', 0)); g.vl(7, 29, 2, C('hinoki', 0))
    g.rect(24, 29, 6, 2, C('hinoki', 2)); g.hl(24, 29, 6, C('hinoki', 5)); g.hl(24, 30, 6, C('hinoki', 0)); g.vl(29, 29, 2, C('hinoki', 0))
    g.hl(4, 31, 10, '~'); g.hl(14, 31, 5, '-'); g.hl(25, 31, 7, '~'); g.hl(30, 30, 2, '~'); g.vl(31, 8, 22, '-')
    return g, '빛 구조 강화: 윗보 윗면 두 줄 밝게·기둥 왼쪽 가장 밝게 오른쪽 가장 어둡게, 종이 매듭 위쪽 한 점 흰빛, 오른쪽 아래로 접지 그림자와 오른쪽 옆 번짐'
def Cc():
    g = Grid(32, 32)
    # A자(삼각) 틀: 위가 좁고 아래가 넓다. 줄은 아래로 갈수록 길다.
    for y in range(4, 29):
        o = (y-4)*10//24            # 0..10
        lx = 11 - o + 0; rx = 19 + o - 2
        for x in (lx, rx):
            g.rect(x, y, 3, 1, C('hinoki', 4)); g.px(x, y, C('hinoki', 5)); g.px(x+2, y, C('hinoki', 2)); g.px(x+3, y, C('hinoki', 1))
    beam(g, 12, 2, 8, 3)
    for i, y in enumerate((10, 17, 24)):
        o = (y-4)*10//24
        x0, x1 = 12 - o + 3, 19 + o - 2 - 1
        rope(g, x0, x1, y, 3); knots(g, x0, x1, y, seed=i)
    g.rect(0, 29, 5, 2, C('hinoki', 2)); g.hl(0, 29, 5, C('hinoki', 4)); g.hl(0, 30, 5, C('hinoki', 1))
    g.rect(27, 29, 5, 2, C('hinoki', 2)); g.hl(27, 29, 5, C('hinoki', 4)); g.hl(27, 30, 5, C('hinoki', 1))
    g.hl(2, 31, 6, '~'); g.hl(28, 31, 4, '~')
    return g, '실루엣 재해석: 네모 틀 대신 위가 좁고 아래가 넓은 A자 틀, 줄이 아래로 갈수록 길어져 매듭 덩이가 삼각으로 쌓인다'
for k, f in zip('ABC', (A, B, Cc)):
    g, n = f(); g.emit(os.path.join(HERE, '..', f'j3-{k}.pxg'), n, header=f'{SL} j3-{k}')
