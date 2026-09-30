import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../house_roof/work'))
from j1_lib import C
OUT = os.path.dirname(os.path.dirname(__file__))
W, H = 16, 64
G = {
 'pa': [".......XXX","....XX.X.X","...XXX.XXX","...XX..XX.","..XX..XX..","..XX...XX.",".XX....XX.",".XX.....XX","XX......XX","XX......XX","XX......XX","XX......XX"],
 'chi': [".XXXXXXXX.",".XXXXXXXX.","....XX....","....XX....","XXXXXXXXXX","XXXXXXXXXX","....XX....","....XX....","....XX....","....XX....","...XX.....","..XX......"],
 'n': ["..........","..XX......","..XXX.....","...XX.....","........XX","........XX",".......XX.","......XX..",".....XX...","...XXX....","..XXX.....",".XXX......"],
 'ko': ["..........","XXXXXXXXXX","XXXXXXXXXX","........XX","........XX","........XX","........XX","........XX","........XX","XXXXXXXXXX","XXXXXXXXXX",".........."],
}
ORDER = ['pa', 'chi', 'n', 'ko']
for k, g in G.items():
    assert len(g) == 12 and all(len(r) == 10 for r in g), k

def glyphs(c, x0, y0, step, hi, mid, lo, sh=None):
    for i, k in enumerate(ORDER):
        g = G[k]; ys = y0 + i * step
        on = lambda x, y: 0 <= y < 12 and 0 <= x < 10 and g[y][x] == 'X'
        for y in range(12):
            for x in range(10):
                if not on(x, y): continue
                if not on(x - 1, y) or not on(x, y - 1): t = hi
                elif not on(x + 1, y) or not on(x, y + 1): t = lo
                else: t = mid
                c.px(x0 + x, ys + y, *t)
                if sh and not on(x + 1, y + 1) and not on(x + 1, y) and not on(x, y + 1) and c.at(x0 + x + 1, ys + y + 1) is None:
                    pass
        if sh:
            for y in range(12):
                for x in range(10):
                    if on(x, y) and not on(x + 1, y + 1) and 0 <= x + 1 < 12:
                        if c.at(x0 + x + 1, ys + y + 1) == sh[1]: c.px(x0 + x + 1, ys + y + 1, *sh[0])

def frame(c, ramp, lo_t, hi_t, bulb, bulb2, x1=1, x2=14, y1=1, y2=62):
    # 테두리 한 줄: 전구는 한 칸 걸러
    for x in range(x1, x2 + 1):
        for y in (y1, y2):
            c.px(x, y, *(bulb if (x - x1) % 2 == 0 else bulb2))
    for y in range(y1, y2 + 1):
        for x in (x1, x2):
            c.px(x, y, *(bulb if (y - y1) % 2 == 0 else bulb2))

def glow(c, keep=('%',), corners=False):
    for x in range(0, 16):
        for y in (0, 63):
            if c.at(x, y) is None and 1 <= x <= 14: c.px(x, y, '%')
    for y in range(1, 63):
        for x in (0, 15):
            if c.at(x, y) is None: c.px(x, y, '%')

LC = 'lacq'
# ── A: 강남식 — 검은 남색 바탕, 분홍 테두리에 노랑 전구 한 칸 걸러, 흰 가나(빛 쪽 밝고 그늘 쪽 분홍)
a = C(W, H)
a.rect(1, 1, 14, 62, LC, 1)
frame(a, 'neon', 2, 5, ('taxi', 5), ('neon', 3))
a.rect(2, 2, 12, 60, LC, 1)
# 안쪽 테두리 그늘 (왼쪽 위 밝고 오른쪽 아래 어둡게)
a.hl(2, 2, 12, LC, 3); a.vl(2, 2, 60, LC, 3)
a.hl(2, 61, 12, LC, 0); a.vl(13, 2, 60, LC, 0)
glyphs(a, 3, 4, 15, ('mwhite', 5), ('mwhite', 3), ('neon', 4))
glow(a)
a.save(os.path.join(OUT, 'j1-A.pxg'))

# ── B: 센 빛 — 글자가 노랑 네온관(속 흰 심), 전구는 켜져 빛 번짐 두 겹, 바탕은 가장 어둡게
b = C(W, H)
b.rect(1, 1, 14, 62, LC, 0)
frame(b, 'neon', 2, 5, ('mwhite', 5), ('neon', 4))
b.rect(2, 2, 12, 60, LC, 0)
# 전구 옆 안쪽 빛 번짐: 전구가 있는 자리 안쪽 칸에 반투명
for i in range(0, 62, 2):
    y = 1 + i
    if 2 <= y <= 61: b.px(2, y, '%'); b.px(13, y, '%')
for i in range(0, 14, 2):
    x = 1 + i
    if 2 <= x <= 13: b.px(x, 2, '%'); b.px(x, 61, '%')
glyphs(b, 3, 4, 15, ('taxi', 5), ('taxi', 4), ('korange', 3))
# 글자 심: 획 안쪽 흰 점
for i, k in enumerate(ORDER):
    g = G[k]; ys = 4 + i * 15
    for y in range(1, 11):
        for x in range(1, 9):
            if g[y][x] == 'X' and all(g[y + dy][x + dx] == 'X' for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1))):
                b.px(3 + x, ys + y, 'mwhite', 5)
glow(b)
for y in range(1, 63): pass
b.save(os.path.join(OUT, 'j1-B.pxg'))

# ── C: 재해석 — 넓은 두 줄 테두리(전구 판) + 파랑 바탕에 빨강 띠, 흰 글자에 빨강 그림자
cc = C(W, H)
cc.rect(1, 1, 14, 62, 'ai', 2)
for x in range(1, 15):
    for y in (1, 2, 61, 62):
        cc.px(x, y, *(('taxi', 5) if (x + (0 if y in (1, 61) else 1)) % 2 == 0 else ('taxi', 2)))
for y in range(1, 63):
    for x in (1, 2, 13, 14):
        cc.px(x, y, *(('taxi', 5) if (y + (0 if x in (1, 13) else 1)) % 2 == 0 else ('taxi', 2)))
cc.rect(3, 3, 10, 58, 'ai', 1)
# 글자칸 사이 빨강 띠
for i in range(3):
    cc.hl(3, 3 + 14 + i * 14 + i, 10, 'shu', 3) if False else None
glyphs(cc, 3, 4, 15, ('mwhite', 5), ('mwhite', 4), ('mwhite', 2))
glow(cc)
cc.save(os.path.join(OUT, 'j1-C.pxg'))
