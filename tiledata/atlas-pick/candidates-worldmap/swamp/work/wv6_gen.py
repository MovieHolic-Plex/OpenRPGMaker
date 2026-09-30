#!/usr/bin/env python3
"""swamp wv6-A/B/C 생성. 몸통은 16px 주기(가장자리 감김)로 웅덩이·둔덕·갈대를 찍는다. 보라 없음: 물 wriver, 둔덕·갈대 wswamp, 테 wgrass 어두운 단."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import wv6_lib as L
OUT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = L.P3

def blobs(specs):
    """specs [(cx,cy,rx,ry)] → 16x16 감김 마스크 집합"""
    s = set()
    for cx, cy, rx, ry in specs:
        for y in range(-2, 19):
            for x in range(-2, 19):
                if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0:
                    s.add((x % 16, y % 16))
    return s

def body(v):
    if v == 'A':
        water = blobs([(4, 4, 2.9, 2.4), (11, 9, 2.6, 2.8), (3, 13, 2.2, 1.8)])
        reeds = [(8, 2), (9, 3), (13, 4), (7, 12), (14, 13)]      # 세로 획 밑 화소
        mound = blobs([(12, 3, 2.2, 1.6), (7, 8, 2.0, 1.6), (12, 14, 2.4, 1.4)])
    elif v == 'B':
        water = blobs([(3, 3, 3.0, 2.6), (10, 6, 2.4, 2.0), (13, 13, 2.8, 2.6), (5, 11, 1.8, 1.8)])
        reeds = [(7, 2), (14, 1), (8, 9), (1, 8), (9, 14)]
        mound = blobs([(8, 4, 1.6, 1.2), (14, 9, 1.8, 1.4), (3, 15, 2.2, 1.2), (9, 12, 1.4, 1.2)])
    else:  # C: 물이 가느다란 물길(가로 구불) + 이끼 알갱이, 갈대 없이 부들 머리(둥근 위쪽)
        water = set()
        for x in range(16):
            for dy in (0, 1):
                water.add((x, (4 + dy + [0, 0, 1, 1, 1, 0, 0, -1, -1, -1, 0, 0, 1, 1, 0, 0][x]) % 16))
                water.add((x, (12 + dy + [1, 0, 0, -1, -1, 0, 0, 1, 1, 1, 0, 0, -1, -1, 0, 1][x]) % 16))
        reeds = [(4, 8), (5, 8), (11, 9), (10, 15), (1, 15)]
        mound = blobs([(8, 9, 2.6, 1.5), (14, 0, 1.6, 1.2), (2, 1, 1.4, 1.0)])
    reedset = set()
    for x, y in reeds:
        for k in range(3): reedset.add((x, (y - k) % 16))
    def f(x, y):
        p = (x, y)
        if p in reedset:
            k = [(x2, y2) for (x2, y2) in reeds if x2 == x and (y2 - y) % 16 < 3]
            top = (k[0][1] - y) % 16 == 2
            return ('wswamp', 4) if top else ('wswamp', 1)
        if p in water:
            edge = any(((x + dx) % 16, (y + dy) % 16) not in water for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            below_free = ((x, (y - 1) % 16) not in water)
            if v == 'B': return ('wriver', 0) if edge else ('wriver', 1)
            if below_free and not edge: return ('wriver', 3)   # 윗물결 반짝
            return ('wriver', 1) if edge else ('wriver', 2 if (x + y) % 5 == 0 else 1)
        if p in mound:
            return ('wswamp', 4 if (x + y) % 4 == 0 else 3)
        return ('wswamp', 2) if (x * 3 + y * 5) % 11 else ('wswamp', 1)
    return f

def make(v):
    prof = {'A': dict(n=P['a'], s=P['b'], w=P['c'], e=P['d']),
            'B': dict(n=P['e'], s=P['f'], w=P['g'], e=P['h']),
            'C': dict(n=P['f'], s=P['e'], w=P['d'], e=P['a'])}[v]
    sh = L.Shape(prof); f = body(v)
    def paint(role, x, y, i):
        d = i['d']
        if d == 1: return ('wswamp', 0)                                   # 질척한 기슭 한 줄
        if d == 2 and (x * 5 + y) % 3 == 0 and f(x, y)[0] == 'wswamp': return ('wswamp', 1)
        c = f(x, y)
        if v == 'B' and (i['ds'] <= 3 or i['de'] <= 3) and c == ('wswamp', 2): return ('wswamp', 1)
        return c
    def rim(role, x, y, i):
        h = (x * 7 + y * 3 + (y // 2) * 5) % 8
        if i['db'] == 1 and h in (0, 3, 5): return ('wgrass', 0)
        if i['db'] == 2 and h == 6 and v != 'C': return ('wgrass', 1)
        if i['db'] == 1 and h == 7 and v == 'C': return ('wgrass', 1)
        return None
    return L.render(sh, paint, rim)

NOTE = {'A': 'World.png 결 — 검푸른 물 웅덩이 셋(4~6px)과 이끼 둔덕, 갈대 세로 획 다섯, 기슭은 질척한 어두운 한 줄+짙은 풀 알갱이',
        'B': '깊이 강조 — 웅덩이 크고 물 테를 어둡게(wriver 0), 물 속 반짝 없음, 남·동쪽 바탕을 한 단 더 눌러 젖은 느낌',
        'C': '다른 해석 — 웅덩이 대신 가로로 구불구불 이어진 얕은 물길 둘과 이끼 둔덕, 갈대는 짧게'}
for v in 'ABC':
    L.emit(make(v), os.path.join(OUT, f'wv6-{v}.pxg'), f'swamp wv6-{v}')
    open(os.path.join(OUT, f'wv6-{v}.note'), 'w').write(NOTE[v] + '\n')
print('ok')
