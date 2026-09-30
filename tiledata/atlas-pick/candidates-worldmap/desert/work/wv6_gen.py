#!/usr/bin/env python3
"""desert wv6-A/B/C 생성 (모양 = wv6_lib, 색 = 아래 손 규칙). 사선 물결은 (x+y)%16 · (x-y)%16 위의 줄이라 칸 경계·16px 주기를 넘어 이어진다."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import wv6_lib as L
OUT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = L.P3
S = lambda n: ('wsand', n)

def mk_ripples(lines, gap):
    """lines: [(k, dir, span)] dir=+1 → x+y=k 줄(/), -1 → x-y=k 줄(\\). gap(x,y) True 이면 그 화소는 끊는다. 돌려주는 값: (ridge, shadow) 집합."""
    ridge, shadow = set(), set()
    for k, d, w in lines:
        for y in range(16):
            for x in range(16):
                v = (x + y) % 16 if d > 0 else (x - y) % 16
                if v == k % 16 and not gap(x, y): ridge.add((x, y))
                if v == (k + 1) % 16 and not gap(x, y): shadow.add((x, y))
    return ridge, shadow

def body_fn(v):
    if v == 'A':   # \ 방향 두 줄 + 성긴 알갱이. 등성이 wdune:3, 바로 아래 그늘 wsand:2, 바탕 wsand:3
        ridge, shadow = mk_ripples([(3, -1, 1), (11, -1, 1)], lambda x, y: (x // 2 + y) % 5 == 0 or (x in (6, 7) and y < 3))
        def f(x, y):
            if (x, y) in ridge: return ('wdune', 3)
            if (x, y) in shadow: return S(2)
            if (x * 7 + y * 3) % 23 == 0: return S(4)
            return S(3)
        return f
    if v == 'B':   # 굵은 세 줄, 등성이 2px 넓이, 그늘 진하게
        ridge, shadow = mk_ripples([(2, -1, 1), (7, -1, 1), (12, -1, 1)], lambda x, y: (x + 2 * y) % 7 == 0)
        r2 = {(x + 1, y) for x, y in ridge}
        def f(x, y):
            x %= 16
            if (x, y) in ridge: return ('wdune', 3)
            if (x, y) in r2 and (x, y) not in shadow: return S(5) if (x + y) % 3 == 0 else ('wdune', 3)
            if (x, y) in shadow: return S(1)
            if (x, y) in {(a + 1, b) for a, b in shadow}: return S(2)
            return S(3)
        return f
    # C: 초승달 모래언덕(바르한) — 6px 호와 오목한 쪽 그늘. 각 언덕: (cx, cy)
    dunes = [(4, 3), (12, 8), (5, 13)]
    ridge, shadow = set(), set()
    for cx, cy in dunes:
        for dx, dy in [(-3, 1), (-3, 0), (-2, -1), (-1, -1), (0, -1), (1, -1), (2, 0), (3, 1)]:
            ridge.add(((cx + dx) % 16, (cy + dy) % 16))
        for dx, dy in [(-2, 0), (-1, 0), (0, 0), (1, 0), (2, 1)]:
            shadow.add(((cx + dx) % 16, (cy + dy) % 16))
    def f(x, y):
        if (x, y) in ridge: return ('wdune', 3)
        if (x, y) in shadow: return S(2)
        return S(3) if (x * 5 + y * 11) % 19 else S(4)
    return f

def make(v):
    prof = {'A': dict(n=P['a'], s=P['b'], w=P['c'], e=P['d']),
            'B': dict(n=P['g'], s=P['h'], w=P['e'], e=P['f']),
            'C': dict(n=P['c'], s=P['d'], w=P['a'], e=P['b'])}[v]
    sh = L.Shape(prof); f = body_fn(v)
    def paint(role, x, y, i):
        c = f(x, y); d = i['d']
        if d == 1:
            # 풀이 모래를 파먹는 자리: 모래 끝 화소가 마른 모래(wdune:0)
            return ('wdune', 0) if v != 'B' else ('wsand', 1)
        if d == 2 and (i['ds'] <= 2 or i['de'] <= 2) and c[0] == 'wsand' and c[1] == 3: return S(2) if v == 'B' else c
        return c
    def rim(role, x, y, i):
        # 모래 밖 1~2px: 풀 알갱이(짙은 풀)가 성기게 — 풀이 모래 쪽으로 파고든 혀
        h = (x * 3 + y * 7 + (x // 2) * 5) % 9
        if i['db'] == 1 and h in (0, 2, 5): return ('wgrass', 1)
        if i['db'] == 2 and h == 4 and v != 'A': return ('wgrass', 2)
        return None
    return L.render(sh, paint, rim)

NOTE = {'A': 'World.png 결 — 낮은 대비 모래에 \\ 사선 등성이(밝은 선+아래 그늘 선) 두 줄이 칸 경계를 넘어 이어짐, 모래 끝은 마른 모래 1px, 풀 알갱이가 파고듦',
        'B': '깊이 강조 — 등성이 세 줄 2px 굵기, 그늘 진하게(wsand 1~2), 남·동 쪽 테 그늘',
        'C': '다른 해석 — 사선 줄 대신 초승달 모래언덕(바르한) 세 개, 오목한 쪽에 그늘'}
for v in 'ABC':
    L.emit(make(v), os.path.join(OUT, f'wv6-{v}.pxg'), f'desert wv6-{v}')
    open(os.path.join(OUT, f'wv6-{v}.note'), 'w').write(NOTE[v] + '\n')
print('ok')
