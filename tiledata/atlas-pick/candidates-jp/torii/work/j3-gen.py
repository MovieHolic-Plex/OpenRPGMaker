import sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from j3_lib import *
SL = 'torii'
def hbeam(g, x, y, w, h, body=3, top=5, low=2, edge=1, hi=None):
    g.rect(x, y, w, h, C('shu', body))
    g.hl(x, y, w, C('shu', top))
    if hi is not None and h >= 4: g.hl(x, y+1, w, C('shu', hi))
    g.hl(x, y+h-1, w, C('shu', edge))
    if h >= 4: g.hl(x, y+h-2, w, C('shu', low))
    g.vl(x+w-1, y, h, C('shu', edge)); g.vl(x, y, h, C('shu', low))
def pillar(g, x, y0, y1, w, lit=4, mid=3, dark=2, edge=1, lit2=None):
    h = y1-y0+1
    g.rect(x, y0, w, h, C('shu', mid))
    g.vl(x, y0, h, C('shu', dark)); g.vl(x+1, y0, h, C('shu', lit))
    if lit2 is not None: g.vl(x+2, y0, h, C('shu', lit2))
    g.vl(x+w-2, y0, h, C('shu', dark)); g.vl(x+w-1, y0, h, C('shu', edge))
def kasagi(g, y, x0, x1, thick, lift, top=4, body=2, base=1):
    """검정 가사기: 가운데 곧고 양끝이 계단으로 들린다. y=가운데 윗줄."""
    for x in range(x0, x1):
        d = min(x-x0, x1-1-x)
        up = 0
        if d < 2*lift: up = lift - d//2
        yy = y - up
        g.rect(x, yy, 1, thick, C('lacq', body))
        g.px(x, yy, C('lacq', top)); g.px(x, yy+thick-1, C('lacq', 0))
    g.vl(x0, y-lift, thick, C('lacq', 0)); g.vl(x1-1, y-lift, thick, C('lacq', 0))
def stone(g, x, y, w, h, top=5, body=3, edge=0, lit=4):
    g.rect(x, y, w, h, C('lacq', body)); g.hl(x, y, w, C('lacq', top)); g.vl(x+1, y+1, h-2, C('lacq', lit))
    g.hl(x, y+h-1, w, C('lacq', edge)); g.vl(x+w-1, y, h, C('lacq', edge)); g.vl(x, y+1, h-1, C('lacq', 2))
def plaque(g, x, y, w, h, letters=True):
    g.rect(x, y, w, h, C('lacq', 0)); g.rect(x+1, y+1, w-2, h-2, C('washi', 4))
    g.vl(x+w-2, y+1, h-2, C('washi', 2)); g.hl(x+1, y+h-2, w-2, C('washi', 2)); g.hl(x+1, y+1, w-3, C('washi', 5))
    if letters:
        for yy in range(y+3, y+h-3, 3): g.rect(x+w//2-1, yy, 2, 2, C('sumi', 1))
def shadow(g, rows):
    for (x, y, w) in rows:
        for xx in range(x, x+w):
            if g.get(xx, y) is None: g.px(xx, y, '~' if xx < x+w-2 else '-')
def A():
    g = Grid(64, 64)
    kasagi(g, 6, 1, 63, 4, 3)
    hbeam(g, 4, 10, 56, 3, top=4)
    pillar(g, 11, 13, 57, 6); pillar(g, 47, 13, 57, 6)
    hbeam(g, 3, 20, 58, 4)
    plaque(g, 28, 12, 8, 8)
    stone(g, 9, 57, 10, 4); stone(g, 45, 57, 10, 4)
    shadow(g, [(19, 60, 3), (55, 60, 3), (10, 61, 11), (46, 61, 11)])
    return g, '강남 조각 결: 명신형. 검정 가사기 양끝 3계단 들림, 주홍 시마기·누키(기둥 밖으로), 기둥 왼쪽 한 단 빛, 가운데 액자, 검정 받침돌'
def B():
    g = Grid(64, 64)
    kasagi(g, 6, 1, 63, 5, 3, top=5, body=3)
    g.hl(8, 7, 48, C('lacq', 4))
    hbeam(g, 4, 11, 56, 3, top=5)
    pillar(g, 11, 14, 57, 7, lit=5, lit2=4); pillar(g, 46, 14, 57, 7, lit=5, lit2=4)
    hbeam(g, 2, 20, 60, 5, top=6, hi=4)
    # 누키 밑 그늘이 기둥과 액자에 드리운다
    for x in (11, 46): g.rect(x, 25, 7, 2, C('shu', 1)); g.hl(x, 27, 7, C('shu', 2))
    plaque(g, 28, 14, 8, 6)
    stone(g, 9, 56, 11, 5, top=6, body=3, lit=5); stone(g, 44, 56, 11, 5, top=6, body=3, lit=5)
    g.px(10, 58, C('moss', 2)); g.px(11, 58, C('moss', 3)); g.px(45, 58, C('moss', 2))
    shadow(g, [(20, 57, 3), (55, 57, 3), (20, 58, 4), (55, 58, 4), (20, 59, 6), (55, 59, 6), (10, 61, 16), (45, 61, 16), (14, 62, 16), (49, 62, 14)])
    return g, '빛 구조 강화: 가사기·누키 윗면을 가장 밝게, 기둥 왼쪽 빛 두 줄과 오른쪽 그늘, 누키 밑 그늘이 기둥에 드리움, 돌 받침 이끼 점, 오른쪽 아래로 긴 접지 그림자'
def C_():
    g = Grid(64, 64)
    # 신메이(神明)형으로 재해석: 곧은 가사기, 가는 기둥 간격 좁게, 누키는 기둥 안쪽만, 시마기 없이 액자 크게
    g.rect(6, 6, 52, 4, C('lacq', 2)); g.hl(6, 6, 52, C('lacq', 4)); g.hl(6, 9, 52, C('lacq', 0)); g.vl(6, 6, 4, C('lacq', 0)); g.vl(57, 6, 4, C('lacq', 0))
    g.hl(6, 5, 52, C('lacq', 0)); g.px(5, 6, None)
    g.hl(9, 5, 46, C('lacq', 0)); g.hl(9, 6, 46, C('lacq', 5)) ; g.hl(6, 6, 3, C('lacq', 4)); g.hl(55, 6, 3, C('lacq', 4))
    hbeam(g, 12, 11, 40, 3, top=4)
    pillar(g, 14, 14, 58, 5, lit=4); pillar(g, 45, 14, 58, 5, lit=4)
    hbeam(g, 14, 22, 36, 3, top=5)
    plaque(g, 26, 14, 12, 8)
    stone(g, 13, 58, 7, 3, top=5); stone(g, 44, 58, 7, 3, top=5)
    shadow(g, [(20, 60, 3), (51, 60, 3), (13, 61, 9), (44, 61, 9)])
    return g, '신메이(神明)형으로 다시 해석: 곧은 가사기, 누키를 기둥 안쪽에만 걸고 폭을 좁게, 액자를 크게, 기둥은 가늘고 바닥이 좁다'
for k, f in zip('ABC', (A, B, C_)):
    g, n = f(); g.emit(os.path.join(HERE, '..', f'j3-{k}.pxg'), n, header=f'{SL} j3-{k}')
