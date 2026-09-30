import sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'torii', 'work'))
from j3_lib import *
SL = 'tomare_mark'
SHI = ["....XX......", "....XX......", "....XXXXXX..", "....XXXXXX..", "XX..XX......", "XXXXXX......", "XX..XX......", "XX..XX......", "XXXXXXXXXXXX", "XXXXXXXXXXXX"]
MA = ["....XX......", "..XXXXXXXX..", "....XX......", "..XXXXXXXX..", "....XX......", "....XXXXXX..", ".XXXXX...XX.", ".XX.XX...XX.", ".XX..XXXXX..", "..XXXX......"]
RE = ["..XX........", "..XX........", "XXXXXXXXX...", "..XX.XX.XX..", "..XXXX..XX..", ".XXXXX..XX..", ".XX.XX..XX..", "XX..XX..XXX.", "....XX...XXX", "....XX....XX"]
def h(x, y, k=0): return ((x*73856093) ^ (y*19349663) ^ (k*83492791)) % 100
def road(g, base=2, k=0):
    for y in range(g.h):
        for x in range(g.w):
            r = h(x, y, k+1); s = base
            if r < 3: s = base-1
            elif r > 98: s = base+1
            g.px(x, y, C('masph', s))
def glyphs(g, x0s, ys=(0, 11, 22), wear=0, k=5):
    cells = []
    for gl, x0, y0 in zip((SHI, MA, RE), x0s, ys):
        for j, r in enumerate(gl):
            for i, ch in enumerate(r):
                if ch == 'X': cells.append((x0+i, y0+j))
    return cells
def A():
    g = Grid(32, 32); road(g, 2, 0)
    P = set(glyphs(g, (10, 10, 10), (1, 12, 22)))
    for (x, y) in P:
        if h(x, y, 7) < 9: continue
        top = (x, y-1) not in P; left = (x-1, y) not in P
        c = C('mwhite', 4 if top or left else 3)
        if (x+1, y) not in P or (x, y+1) not in P: c = C('mwhite', 2)
        g.px(x, y, c)
    return g, '강남 조각 결로 아스팔트 바탕 위에 낡은 흰 페인트 글자를 2px 획으로 놓고 페인트 가장자리만 한 단 어둡게, 군데군데 벗겨짐'
def B():
    g = Grid(32, 32); road(g, 1, 3)
    P = set(glyphs(g, (10, 10, 10), (1, 12, 22)))
    for (x, y) in P:  # 페인트가 살짝 솟은 것처럼 오른쪽·아래에 짙은 그림자 (불투명)
        for dx, dy in ((1, 0), (0, 1), (1, 1)):
            if (x+dx, y+dy) not in P: g.px(x+dx, y+dy, C('masph', 0))
    for (x, y) in P:
        top = (x, y-1) not in P; left = (x-1, y) not in P
        c = C('mwhite', 5 if top or left else 4)
        if (x+1, y) not in P or (x, y+1) not in P: c = C('mwhite', 3)
        g.px(x, y, c)
    return g, '위쪽·왼쪽 가장자리를 가장 밝은 흰색(5단), 오른쪽·아래는 어둡게, 페인트 오른쪽 아래로 짙은 아스팔트 그림자를 붙여 페인트가 솟아 보이게'
def Cc():
    g = Grid(32, 32); road(g, 2, 9)
    # 정지선(아래 가로 띠) + 글자 작게 위 두 줄로 좁힘: 止 / まれ 가로 배치 재해석
    P = set()
    for (gl, x0, y0) in ((SHI, 10, 1), (MA, 3, 12), (RE, 17, 12)):
        for j, r in enumerate(gl):
            for i, ch in enumerate(r):
                if ch == 'X': P.add((x0+i, y0+j))
    for x in range(0, 32):
        for y in (25, 26, 27): P.add((x, y))
    for (x, y) in P:
        if h(x, y, 2) < 24 and y < 25: continue
        top = (x, y-1) not in P; left = (x-1, y) not in P
        c = C('mwhite', 4 if top or left else 3)
        if (x+1, y) not in P or (x, y+1) not in P: c = C('mwhite', 2)
        g.px(x, y, c)
    return g, '같은 2x2 안에서 止는 위에 크게, まれ는 가로 두 글자로 나누고 아래에 정지선 띠를 넣어 실루엣을 바꿈, 많이 닳은 페인트'
for k, f in zip('ABC', (A, B, Cc)):
    g, n = f(); g.emit(os.path.join(HERE, '..', f'j3-{k}.pxg'), n, header=f'{SL} j3-{k}')
