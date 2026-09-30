import sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'torii', 'work'))
from j3_lib import *
SL = 'crosswalk_jp'
def h(x, y, k=0): return ((x*73856093) ^ (y*19349663) ^ (k*83492791)) % 100
def road(g, base, k):
    for y in range(g.h):
        for x in range(g.w):
            r = h(x, y, k); g.px(x, y, C('masph', base-1 if r < 3 else base+1 if r > 98 else base))
def bars(x0, w, gap, n):
    xs = set()
    for i in range(n):
        for d in range(w): xs.add(x0 + i*(w+gap) + d)
    return xs
def A():
    g = Grid(32, 32); road(g, 2, 1)
    xs = bars(1, 3, 3, 5)
    for y in range(32):
        for x in xs:
            if h(x, y, 4) < 6: g.px(x, y, C('mwhite', 3)); continue
            c = C('mwhite', 4) if x in xs and (x-1) not in xs else C('mwhite', 3)
            if (x+1) not in xs: c = C('mwhite', 2)
            g.px(x, y, c)
    return g, '강남 조각 결로 3px 흰 줄 다섯 개(사이 3px, 옆줄 없음)를 세로로 이어 붙게 하고 줄의 왼쪽 가장자리만 밝게, 오른쪽은 한 단 어둡게, 페인트가 드문드문 벗겨짐'
def B():
    g = Grid(32, 32); road(g, 1, 6)
    xs = bars(1, 3, 3, 5)
    for x in xs:
        if (x+1) not in xs:  # 오른쪽 옆 아스팔트에 페인트 그림자
            for y in range(32): g.px(x+1, y, C('masph', 0))
    for y in range(32):
        for x in xs:
            c = C('mwhite', 5) if (x-1) not in xs else C('mwhite', 4)
            if (x+1) not in xs: c = C('mwhite', 3)
            if h(x, y, 8) < 5: c = sh(c, -1, 8)
            g.px(x, y, c)
    return g, '왼쪽 줄 가장자리를 가장 밝게(5단), 오른쪽은 3단, 줄 오른쪽 옆에 어두운 아스팔트 그림자 한 줄을 붙여 페인트가 솟아 보이는 강한 빛 구조'
def Cc():
    g = Grid(32, 32); road(g, 2, 11)
    xs = bars(0, 4, 2, 6)
    for y in range(32):
        # 바퀴 자국: 가운데 근처가 더 닳음
        wear = 20 if 8 <= y % 32 <= 22 else 6
        for x in xs:
            if x > 31: continue
            if h(x, y, 3) < wear: g.px(x, y, C('mwhite', 1)); continue
            c = C('mwhite', 4) if (x-1) not in xs else C('mwhite', 3)
            if (x+1) not in xs: c = C('mwhite', 2)
            g.px(x, y, c)
    return g, '줄을 4px 굵기·틈 2px 로 바꿔 흰 덩이가 더 크게 읽히게 하고, 바퀴가 지나는 가운데 부분이 더 많이 닳은 모습'
for k, f in zip('ABC', (A, B, Cc)):
    g, n = f(); g.emit(os.path.join(HERE, '..', f'j3-{k}.pxg'), n, header=f'{SL} j3-{k}')
