import sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'torii', 'work'))
from j3_lib import *
SL = 'garbage_station'
def h(x, y, k=0): return ((x*73856093) ^ (y*19349663) ^ (k*83492791)) % 100
def shape(x0, x1, top, bot, dome=4):
    """돔형 더미: 위 dome 줄은 좁아진다. {(x,y)}"""
    s = set()
    for y in range(top, bot+1):
        k = max(0, dome - (y - top))
        for x in range(x0 + k, x1 - k + 1): s.add((x, y))
    return s
def pile(g, S, base, hi, lo, crease, net, netlit, seed, meshp=6, skirt=True):
    xs = [p[0] for p in S]; ys = [p[1] for p in S]; x0, x1, top, bot = min(xs), max(xs), min(ys), max(ys)
    for (x, y) in S:
        c = base
        # 봉투 덩어리: 3~4칸 블록마다 밝기 다르게
        bx, by = (x - x0) // 5, (y - top) // 4
        if (bx + by + seed) % 3 == 0: c = sh(base, 1, 6)
        if (x, y-1) not in S or (x-1, y) not in S: c = hi
        elif (x+1, y) not in S or (x, y+1) not in S: c = lo
        elif (x - x0) % 5 == 4 or (y - top) % 4 == 3: c = crease
        g.px(x, y, c)
    for (x, y) in S:  # 그물
        if (x + y) % meshp == 0 or (x - y) % meshp == 0:
            lit = (x, y-1) not in S or (x-1, y) not in S or (x + y) < (x0 + top + 8)
            g.px(x, y, netlit if lit else net)
    if skirt:  # 아래 무게추 줄
        for x in range(x0 - 1, x1 + 2, 1):
            if (x - x0) % 2 == 0: g.px(x, bot + 1 if bot < 14 else bot, net)
def cage(g, x0, y0, w, h_, frame, bar, hi):
    g.hl(x0, y0, w, hi); g.hl(x0, y0 + h_ - 1, w, frame)
    g.vl(x0, y0, h_, hi); g.vl(x0 + w - 1, y0, h_, frame)
    for x in range(x0 + 2, x0 + w - 1, 2): g.vl(x, y0 + 1, h_ - 2, bar)
    g.hl(x0 + 1, y0 + h_ // 2, w - 2, bar)
def A():
    g = Grid(32, 16)
    S = shape(1, 19, 4, 13, 4); pile(g, S, C('mwhite', 3), C('mwhite', 5), C('mwhite', 2), C('mwhite', 2), C('kgreen', 2), C('kgreen', 4), 0)
    outline(g, C('mwhite', 1), C('mwhite', 0))
    cage(g, 21, 6, 9, 8, C('mmetal', 2), C('mmetal', 3), C('mmetal', 5))
    outline(g, C('mmetal', 1), C('mmetal', 0), only={'mmetal'})
    g.hl(3, 15, 18, '~'); g.hl(22, 15, 9, '~')
    return g, '강남 조각 결로 흰 봉투 더미(밝은 위·왼쪽, 어두운 오른쪽·아래)를 초록 그물로 덮고 옆에 강철 접이식 철망 상자, 발치 오른쪽 아래 그림자'
def B():
    g = Grid(32, 16)
    S = shape(1, 19, 4, 13, 4); pile(g, S, C('mwhite', 3), C('mwhite', 5), C('mwhite', 1), C('mwhite', 2), C('kblue', 1), C('kblue', 4), 1)
    outline(g, C('mwhite', 0), C('mwhite', 0))
    cage(g, 21, 6, 9, 8, C('mmetal', 1), C('mmetal', 2), C('mmetal', 6))
    outline(g, C('mmetal', 0), C('mmetal', 0), only={'mmetal'})
    g.hl(2, 15, 20, '~'); g.hl(3, 14, 1, '-'); g.hl(21, 15, 10, '~')
    for y in (10, 11, 12, 13): g.px(20, y, '-')
    return g, '파란 그물을 쓰고 더미 오른쪽 옆을 1단까지 눌러 어둡게, 왼쪽·위는 5단으로 밝게 해 명암을 벌림, 접지 그림자 길게, 철망 상자는 가장 어두운 윤곽에 밝은 윗줄'
def Cc():
    g = Grid(32, 16)
    S = shape(3, 14, 1, 13, 5); pile(g, S, C('washi', 4), C('mwhite', 5), C('washi', 2), C('washi', 2), C('kgreen', 3), C('kgreen', 5), 2, meshp=5, skirt=False)
    outline(g, C('washi', 1), C('washi', 0))
    # 그물 자락이 오른쪽 아래로 늘어짐
    for i in range(6): g.px(15 + i//2, 9 + i, C('kgreen', 3))
    cage(g, 19, 2, 11, 12, C('mmetal', 2), C('mmetal', 3), C('mmetal', 5))
    outline(g, C('mmetal', 1), C('mmetal', 0), only={'mmetal'})
    g.hl(4, 15, 12, '~'); g.hl(20, 15, 11, '~')
    return g, '봉투 더미를 좁고 높게 쌓고 그물 자락이 옆으로 늘어지며, 철망 상자를 키가 큰 우리로 바꿔 높이가 큰 두 덩이로 재해석 (이동 우리 가림)'
for k, f in zip('ABC', (A, B, Cc)):
    g, n = f(); g.emit(os.path.join(HERE, '..', f'j3-{k}.pxg'), n, header=f'{SL} j3-{k}')
