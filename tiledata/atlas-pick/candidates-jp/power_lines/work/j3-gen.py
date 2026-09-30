import sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'torii', 'work'))
from j3_lib import *
SL = 'power_lines'
def wire(g, y0, sag, c, phase=0, shadow=None, thick=1, hi=None):
    for x in range(32):
        t = ((x + 0.5) / 32.0) * 2 - 1
        y = y0 + round(sag * (1 - t*t))
        for d in range(thick): g.px(x, y+d, c)
        if hi: g.px(x, y-1, hi) if g.get(x, y-1) is None else None
        if shadow: g.px(x+1, y+thick+1, shadow) if g.get(x+1, y+thick+1) is None else None
def A():
    g = Grid(32, 16)
    for y0, sag, s in ((1, 3, 2), (3, 4, 3), (6, 5, 2), (8, 5, 3)):
        wire(g, y0, sag, C('lacq', s))
    return g, '강남 조각 결로 1px 짙은 회색 옻색 선 네 가닥(처짐 3~5px, 좌우 끝 높이 같음), 선마다 옻색 2·3단을 섞어 겹쳐 보이게'
def B():
    g = Grid(32, 16)
    for y0, sag, s in ((1, 3, 3), (3, 4, 4), (5, 5, 3)):
        wire(g, y0, sag, C('lacq', s), shadow='~')
    return g, '선 위쪽은 밝은 3~4단으로 살리고 선마다 오른쪽 아래로 반투명 그림자(~)를 한 칸 띄워 붙여 하늘 위 가는 선의 입체감을 냄, 세 가닥'
def Cc():
    g = Grid(32, 16)
    wire(g, 2, 5, C('lacq', 2), thick=2)
    wire(g, 2, 5, C('lacq', 4), thick=1)
    wire(g, 8, 4, C('lacq', 3))
    # 중간 처마로 내려가는 인입선
    for y in range(10, 15): g.px(15, y, C('lacq', 2))
    g.px(14, 7, C('lacq', 1)); g.px(17, 7, C('lacq', 1))
    return g, '굵은 2px 주 케이블 한 가닥과 가는 보조선 한 가닥으로 줄이고 가운데서 아래로 내려가는 인입선을 넣어 실루엣을 다르게 해석'
for k, f in zip('ABC', (A, B, Cc)):
    g, n = f(); g.emit(os.path.join(HERE, '..', f'j3-{k}.pxg'), n, header=f'{SL} j3-{k}')
