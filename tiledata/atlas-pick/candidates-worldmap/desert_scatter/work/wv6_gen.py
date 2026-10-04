#!/usr/bin/env python3
"""desert_scatter wv6-A/B/C (48x16, 칸 셋: 선인장 · 바위 · 뼈) + oasis 는 oasis/work/wv6_gen.py"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wv6_sprite import *
OUT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OL = ('wleaf', 0)           # 선인장 윤곽
RO = ('wrock', 0)           # 바위 윤곽
BO = ('wbark', 1)           # 뼈 윤곽(모래와 대비되는 갈색)

def cactus_saguaro(ribs=False):
    trunk = rect(6, 3, 9, 13) - {(6, 3), (9, 3)}
    la = rect(2, 5, 3, 10) | rect(2, 9, 5, 10)
    ra = rect(12, 4, 13, 8) | rect(10, 7, 13, 8)
    body = trunk | la | ra
    px = run_shade(body, 'wmead', 1, 2, 4)
    for (x, y) in list(px):
        if px[(x, y)][1] == 2 and (x + y) % 5 == 0: px[(x, y)] = ('wmead', 3)
    if ribs:
        for y in range(4, 13): px[(8, y)] = ('wmead', 1)
        for y in range(4, 13):
            if (6, y) in px: px[(6, y)] = ('wmead', 5)
    ol = outline(px, OL)
    # 꼭대기 꽃 한 점
    px[(7, 3)] = ('wmead', 5)
    return merge(px, ol), rect(4, 14, 11, 14)

def cactus_barrel():   # C: 통선인장 + 노란 꽃 + 손바닥선인장 조각
    b = ell(6.5, 9.5, 4.5, 4.2)
    px = blob_shade(b, 'wmead', [1, 2, 3, 4], 6.5, 9.5, 4.5, 4.2)
    for x in (4, 6, 8):                       # 세로 골
        for y in range(6, 14):
            if (x, y) in px: px[(x, y)] = ('wmead', 1 if x != 6 else 2)
    px[(6, 5)] = ('wgold', 3); px[(7, 5)] = ('wgold', 4); px[(6, 4)] = ('wgold', 3)
    pad = ell(12.5, 11.0, 1.8, 2.6)
    p2 = run_shade(pad, 'wleaf', 2, 3, 4)
    p2[(12, 8)] = ('wgold', 3)
    both = merge(px, p2)
    return merge(both, outline(both, OL)), rect(3, 14, 13, 14)

def rocks(kind):
    if kind == 'A':   # 무더기 셋
        s = [(6.0, 10.0, 4.0, 3.6), (11.5, 11.5, 2.8, 2.4), (3.0, 12.0, 2.2, 1.9)]
    elif kind == 'B':  # 큰 바위 하나 + 작은 조각, 금
        s = [(7.5, 9.0, 5.5, 5.0), (13.0, 12.5, 1.9, 1.6)]
    else:              # C: 쌓인 판돌 셋 + 조약돌
        s = [(8.0, 12.0, 6.5, 1.9), (7.0, 9.3, 4.6, 1.8), (9.0, 6.8, 2.6, 1.6), (13.5, 12.6, 1.5, 1.2)]
    px = {}
    for cx, cy, rx, ry in s:
        sh = ell(cx, cy, rx, ry)
        px.update(blob_shade(sh, 'wrock', [2, 3, 4, 5] if kind != 'B' else [1, 2, 3, 4, 5, 6], cx, cy, rx, ry))
    if kind == 'B':                             # 금
        for x, y in [(7, 6), (7, 7), (8, 8), (8, 9), (9, 10), (9, 11)]: px[(x, y)] = ('wrock', 0)
    return merge(px, outline(px, RO)), rect(2, 14, 14, 14)

def bones(kind):
    W = lambda n: ('mwhite', n)
    px = {}
    if kind == 'A':   # 소 해골: 두개골 + 뿔 둘
        sk = ell(8, 9, 3.6, 3.4) | rect(6, 11, 9, 13)
        px = blob_shade(sk, 'mwhite', [0, 1, 2, 3], 8, 9, 3.6, 3.4)
        for p in [(1, 5), (2, 6), (3, 7), (4, 8), (1, 6), (14, 5), (13, 6), (12, 7), (11, 8), (14, 6)]: px[p] = W(2)
        for p in [(0, 4), (15, 4)]: px[p] = W(1)
        px[(6, 8)] = px[(7, 8)] = ('wrock', 0); px[(9, 8)] = px[(10, 8)] = ('wrock', 0)
        px[(8, 11)] = ('wrock', 1)
        for x in (6, 8, 9): px[(x, 13)] = W(1)
    elif kind == 'B':  # 옆모습 긴 두개골 + 등뼈 조각 (손 도트)
        art = ["..........",
               "..2222....",
               ".23332222.",
               ".23332222.",
               "22111211..",
               "2.1..1.1..",
               ]
        g = ["....1222....1.",
             "...123333221.2",
             "..12333333322.",
             ".1233033333322",
             "12333333322221",
             "1233322211....",
             ".123211.......",
             "..1111........"]
        for j, row in enumerate(g):
            for i, ch in enumerate(row):
                if ch == '.': continue
                px[(1 + i, 4 + j)] = ('wrock', 0) if ch == '0' else W(int(ch))
        for i, x in enumerate(range(3, 14, 2)):     # 바닥에 놓인 척추뼈 마디
            px[(x, 13)] = W(2); px[(x + 1, 13)] = W(1)
    else:              # C: 엇갈린 뼈 + 작은 해골
        for i in range(11): px[(2 + i, 4 + i // 2 * 1 + (i % 2 == 0) * 0)] = W(3 - (i % 2))
        for i in range(11): px[(13 - i, 4 + (i // 2))] = W(2 - (i % 2))
        for p in [(1, 3), (1, 4), (2, 3), (14, 3), (14, 4), (13, 3), (1, 9), (2, 10), (14, 9), (13, 10)]: px[p] = W(3)
        sk = ell(8, 11.5, 2.4, 2.2)
        px.update(blob_shade(sk, 'mwhite', [0, 1, 2, 3], 8, 11.5, 2.4, 2.2))
        px[(7, 11)] = px[(9, 11)] = ('wrock', 0)
    return merge(px, outline(px, BO)), rect(3, 14, 12, 14)

def build(v):
    cells = {'A': (cactus_saguaro(False), rocks('A'), bones('A')),
             'B': (cactus_saguaro(True), rocks('B'), bones('B')),
             'C': (cactus_barrel(), rocks('C'), bones('C'))}[v]
    px, sh = {}, set()
    for i, (p, s) in enumerate(cells):
        px.update(shift(p, 16 * i, 0)); sh |= {(x + 16 * i, y) for x, y in s}
    px = {k: val for k, val in px.items() if 0 <= k[0] < 48 and 0 <= k[1] < 16}
    sh = {q for q in sh if q not in px}
    return px, sh

NOTE = {'A': '두 팔 선인장(왼쪽 밝고 오른쪽 어두움) · 바위 셋 무더기(북서 빛) · 뿔 달린 소 해골, 윤곽 1px 발치 그림자',
        'B': '깊이 강조 — 골이 진 선인장 · 금 간 큰 바위 하나+조각 · 옆모습 긴 두개골+바닥 척추 마디',
        'C': '다른 해석 — 통선인장(노란 꽃)+손바닥 조각 · 쌓인 판돌 셋+조약돌 · 엇갈린 뼈 위 작은 해골'}
for v in 'ABC':
    px, sh = build(v)
    emit(px, sh, 48, 16, os.path.join(OUT, f'wv6-{v}.pxg'), f'desert_scatter wv6-{v}')
    open(os.path.join(OUT, f'wv6-{v}.note'), 'w').write(NOTE[v] + '\n')
print('ok')
