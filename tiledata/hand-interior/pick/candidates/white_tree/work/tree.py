import math
from w6lib import emit, Cv
LG = {}
for i in range(7):
    LG['mrbl'[0]+str(i)] = f'marble:{i}'   # m0..: 두 글자 불가 -> 아래 한 글자 표로
LG = {'0':'marble:0','1':'marble:1','2':'marble:2','3':'marble:3','4':'marble:4','5':'marble:5','6':'marble:6',
 's':'stone:1','t':'stone:2','u':'stone:3','v':'stone:4','w':'stone:5','x':'stone:6','z':'stone:0',
 'a':'iron:1','b':'iron:2','c':'iron:3','d':'dwood:2','e':'dwood:3','f':'dwood:4','g':'gold:4','h':'gold:5','i':'gold:6','j':'gold:3',
 'l':'ice:4','m':'ice:5','n':'ice:6','o':'ice:3',
 '~':'P:~','-':'P:-'}
def disc_mask(cx, cy, rx, ry):
    return {(x, y) for y in range(cy - ry - 1, cy + ry + 2) for x in range(cx - rx - 1, cx + rx + 2)
            if ((x - cx) / (rx + .5)) ** 2 + ((y - cy) / (ry + .5)) ** 2 <= 1.0}
def shade_puffs(c, puffs, bright=1.0, holes=(), lo=2):
    """puffs: (cx,cy,rx,ry). 각 덩이를 위쪽 왼쪽 빛으로 칠하고, 겹치면 뒤(위쪽)에 그린 것이 덮는다. 테두리는 안쪽 단을 한 단 낮춘다."""
    full = set()
    for (cx, cy, rx, ry) in puffs: full |= disc_mask(cx, cy, rx, ry)
    full -= set(holes)
    owner = {}
    for (cx, cy, rx, ry) in puffs:
        for p in disc_mask(cx, cy, rx, ry): owner[p] = (cx, cy, rx, ry)
    for p in full:
        cx, cy, rx, ry = owner[p]; x, y = p
        l = (-(x - cx) / (rx + .5) * .6 - (y - cy) / (ry + .5) * .8) * bright
        st = 6 if l > .55 else 5 if l > .15 else 4 if l > -.25 else 3 if l > -.6 else 2
        edge = any((x + dx, y + dy) not in full for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        if edge:
            st = max(lo, st - 1) if (x >= cx or y >= cy) else st
            if (x >= cx and y >= cy): st = max(lo - 1 if lo > 0 else 0, st - 1)
        c.px(x, y, str(st))
    return full
def pot(c, strong=False, y0=41):
    # 화분: 테두리 + 몸통 + 밑단, 흙
    c.hl(3, y0, 10, 'e'); c.hl(4, y0, 8, 'd')
    c.hl(3, y0 + 1, 10, 'x'); c.hl(3, y0 + 1, 1, 'w'); c.px(12, y0 + 1, 'v')
    for r, y in enumerate(range(y0 + 2, 47)):
        c.hl(4, y, 8, 'w' if r == 0 else 'v' if r < 2 else 'u'); c.px(4, y, 'x' if r < 3 else 'w'); c.vl(11, y, 1, 'u' if r < 2 else 't'); c.px(11, y, 't')
    c.hl(4, 46, 8, 't'); c.hl(3, 47, 10, 'z')
    c.hl(3, y0 + 1, 10, 'x'); c.px(12, y0 + 1, 'u'); c.px(3, y0 + 1, 'x')
    c.vl(12, y0 + 2, 5, 'z')
def trunk(c, y0, y1, x=7, w=3):
    for y in range(y0, y1 + 1):
        for i, ch in enumerate(('5', '4', '3', '2')[:w + (1 if w >= 3 else 0)]):
            c.px(x + i, y, ch)
def write(name, c):
    emit(f'../w6-{name}.pxg', LG, c.rows())
