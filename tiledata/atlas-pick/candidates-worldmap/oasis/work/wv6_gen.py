#!/usr/bin/env python3
"""oasis wv6-A/B/C (16x16 아이콘, 투명, 아래쪽에 그린다)"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wv6_sprite import *
OUT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def pond(cx, cy, rx, ry, wet=('wriver', 2), lite=('wsea', 4)):
    body = ell(cx, cy, rx, ry)
    inner = ell(cx, cy, rx - 1.2, ry - 1.0)
    px = {}
    for p in body: px[p] = ('wsand', 1)                      # 물가 젖은 모래(둑)
    for p in inner: px[p] = ('wriver', 2)
    for p in inner:
        if p[1] <= cy - ry * 0.35 + 0.5: px[p] = ('wriver', 1)   # 위쪽은 야자 그림자에 짙게
    hl = sorted(inner, key=lambda q: (q[1], q[0]))
    return px, body, inner

def palm(tx, ty0, ty1, lean, crown_y, fr, fronds, trunk_step=(2, 3)):
    px = {}
    n = ty1 - ty0
    for i, y in enumerate(range(ty1, ty0 - 1, -1)):
        x = tx + (lean * i) // max(1, n)
        px[(x, y)] = ('wbark', trunk_step[i % 2])
    cx = tx + lean
    for (dx, dy, st) in fronds:
        px[(cx + dx, crown_y + dy)] = ('wleaf', st)
    return px, (cx, crown_y)

def frond_line(cx, cy, pts):
    return [(dx, dy) for dx, dy in pts]

def A():   # 둑이 있는 둥근 샘 + 오른쪽 야자 한 그루(부채꼴)
    p, body, inner = pond(5.5, 12.0, 5.4, 2.9)
    px = dict(p)
    for x in range(2, 10):                     # 물빛 한 줄
        if (x, 11) in inner and x % 3 == 0: px[(x, 11)] = ('wsea', 4)
    px[(5, 12)] = px[(6, 12)] = ('wriver', 3)
    px[(4, 13)] = ('wriver', 3)
    tr, (cx, cy) = palm(11, 7, 13, 1, 5, 0, [])
    px.update(tr)
    fr = {(-3, 2): 1, (-2, 1): 2, (-1, 0): 3, (0, 0): 4, (1, 0): 3, (2, 1): 2, (3, 2): 1, (0, -1): 4, (-1, -1): 3, (1, -1): 3,
          (-2, 0): 2, (2, 0): 2, (-3, 1): 1, (3, 1): 1, (0, 1): 1}
    for (dx, dy), st in fr.items(): px[(cx + dx, cy + dy)] = ('wleaf', st)
    px[(cx, cy + 1)] = ('wbark', 1)
    pxo = merge(px, {k: ('wrock', 0) for k in outline(px, ('wrock', 0))})
    return pxo

def B():   # 깊이 강조: 짙은 둑 + 물속 하늘빛 + 두 마리 잎 층
    p, body, inner = pond(5.5, 12.2, 5.4, 2.8)
    px = dict(p)
    for q in inner: px[q] = ('wriver', 1) if q[1] < 12 else ('wriver', 2)
    for x, y in [(4, 12), (5, 12), (7, 13), (8, 13)]: px[(x, y)] = ('wsea', 4)
    for q in body - inner: px[q] = ('wsand', 3) if q[1] >= 12 else ('wsand', 1)
    tr = {}
    for i, y in enumerate(range(13, 5, -1)): tr[(10 + (i > 4), y)] = ('wbark', 1 + (i % 2))
    px.update(tr)
    cx, cy = 11, 5
    fr = [(-4, 1, 1), (-3, 0, 2), (-2, -1, 3), (-1, -1, 4), (0, -1, 5), (1, -1, 4), (2, -1, 3), (3, 0, 2), (-3, 1, 2), (-2, 1, 2), (2, 0, 1),
          (0, 0, 4), (-1, 0, 3), (1, 0, 3), (0, -2, 5), (-1, 2, 1), (1, 1, 1), (2, 1, 1)]
    for dx, dy, st in fr: px[(cx + dx, cy + dy)] = ('wleaf', st)
    return merge(px, outline(px, ('wrock', 0)))

def C():   # 다른 해석: 가로로 긴 못 + 야자 두 그루, 왼쪽 것이 작다
    p, body, inner = pond(7.5, 12.6, 7.0, 2.4)
    px = dict(p)
    for x in range(3, 13):
        if (x, 12) in inner and x % 2: px[(x, 12)] = ('wsea', 4)
    for x, y in [(6, 13), (9, 13)]: px[(x, y)] = ('wriver', 3)
    for y in range(8, 12): px[(2, y)] = ('wbark', 2 + (y % 2))
    for y in range(6, 12): px[(12, y)] = ('wbark', 2 + (y % 2))
    for cx, cy, s in ((2, 7, 2), (12, 5, 3)):
        for dx in range(-s, s + 1):
            px[(cx + dx, cy + (abs(dx) + 1) // 2)] = ('wleaf', 3 if abs(dx) < s else 1)
        px[(cx, cy - 1)] = ('wleaf', 4)
        px[(cx - 1, cy)] = px[(cx + 1, cy)] = ('wleaf', 4)
    return merge(px, outline(px, ('wrock', 0)))

NOTE = {'A': '둥근 샘(1px 젖은 모래 둑, 위쪽은 그늘진 물)과 오른쪽 부채꼴 야자 한 그루',
        'B': '깊이 강조 — 짙은 둑과 물속 하늘빛 점, 잎 넓은 야자에 어두운 윤곽',
        'C': '다른 해석 — 가로로 긴 못 양옆에 작은 야자 한 쌍'}
for v, f in zip('ABC', (A, B, C)):
    px = {k: val for k, val in f().items() if 0 <= k[0] < 16 and 0 <= k[1] < 16}
    emit(px, set(), 16, 16, os.path.join(OUT, f'wv6-{v}.pxg'), f'oasis wv6-{v}')
    open(os.path.join(OUT, f'wv6-{v}.note'), 'w').write(NOTE[v] + '\n')
print('ok')
