#!/usr/bin/env python3
"""ice_sea wv6-A/B/C 생성. 얼음판 = 모서리 깎인 네모(윗면 밝음 + 앞면 두 줄 한 단 어두움), 틈 = wdeep 바탕 + wsea 반짝. 16px 감김."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import wv6_lib as L
OUT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = L.P3

def floes(rects):
    """rects [(x,y,w,h)] (윗면 w×h, 앞면 아래 2줄). 반환: {(x,y): 'T'|'F'|'t'(윗 테)}"""
    m = {}
    for x0, y0, w, h in rects:
        for yy in range(h + 2):
            for xx in range(w):
                # 모서리 깎기: 윗줄 양끝, 앞면 맨 아랫줄 양끝
                if (yy == 0 or yy == h + 1) and (xx == 0 or xx == w - 1): continue
                kind = 'F' if yy >= h else ('t' if yy == 0 else 'T')
                m[((x0 + xx) % 16, (y0 + yy) % 16)] = kind
    return m

def body(v):
    if v == 'A':   # 세 판 + 작은 조각
        m = floes([(0, 0, 7, 4), (8, 1, 8, 3), (1, 8, 8, 4), (11, 9, 4, 3)])
    elif v == 'B':  # 큰 판 둘, 틈 넓음, 앞면 짙게
        m = floes([(0, 0, 9, 5), (10, 6, 7, 5), (0, 9, 6, 4)])
    else:          # C: 긴 가로 판(유빙 줄) 셋
        m = floes([(0, 0, 12, 2), (13, 1, 4, 2), (0, 6, 7, 3), (8, 7, 8, 2), (2, 12, 11, 1)])
    def f(x, y):
        k = m.get((x, y))
        if k == 't': return ('wice', 4 if v != 'B' else 3)
        if k == 'T': return ('wice', 3 if (x + y) % 7 else 4) if v != 'B' else ('wice', 3 if (x * 3 + y) % 5 else 2)
        if k == 'F': return ('wice', 2 if v != 'B' else 1)
        # 틈: 얼음 앞면 바로 아래는 그림자(wsea 0), 나머지는 둘레 바다와 맞춘 wsea 1~2
        if (x, (y - 1) % 16) in m and m[(x, (y - 1) % 16)] == 'F': return ('wsea', 0)
        if v == 'C': return ('wsea', 2) if (x * 5 + y * 3) % 6 == 0 else ('wsea', 1)
        return ('wsea', 2) if (x * 7 + y * 5) % 9 == 0 else ('wsea', 1)
    return f

def make(v):
    prof = {'A': dict(n=P['a'], s=P['b'], w=P['c'], e=P['d']),
            'B': dict(n=P['e'], s=P['f'], w=P['g'], e=P['h']),
            'C': dict(n=P['d'], s=P['c'], w=P['b'], e=P['a'])}[v]
    sh = L.Shape(prof); f = body(v)
    def paint(role, x, y, i):
        d = i['d']
        if d == 1: return ('wice', 4) if i['dn'] == 1 or i['dw'] == 1 else ('wice', 1)   # 판 테: 북·서 밝음, 남·동 어두움
        return f(x, y)
    def rim(role, x, y, i):
        # 흩어지는 얼음 조각: 바깥 1px 자리에 떨어져 나온 낱알(밝은 단 3)을 성기게
        h = (x * 5 + y * 11 + (x // 3) * 7) % 13
        if i['db'] == 1 and h == 2: return ('wfoam', 1)
        if i['db'] == 2 and h == 8 and v != 'B': return ('wfoam', 0)
        return None
    return L.render(sh, paint, rim)

NOTE = {'A': 'World.png 결 — 모서리 깎인 얼음판 넷(윗면 밝고 앞면 두 줄 한 단 어둡다) 사이로 물 틈, 기슭에 낱알 조각이 흩어짐',
        'B': '깊이 강조 — 큰 판 둘과 넓은 물 틈, 앞면을 wice 1로 짙게, 판 윗면은 한 단 낮춰 대비 정리',
        'C': '다른 해석 — 판 대신 가로로 긴 유빙 줄(폭 13·7·7px) 세 줄, 틈은 밝은 물빛 반짝 많음'}
for v in 'ABC':
    L.emit(make(v), os.path.join(OUT, f'wv6-{v}.pxg'), f'ice_sea wv6-{v}')
    open(os.path.join(OUT, f'wv6-{v}.note'), 'w').write(NOTE[v] + '\n')
print('ok')
