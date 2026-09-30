#!/usr/bin/env python3
"""snow wv6-A/B/C 생성. python3 wv6_gen.py  (이 폴더에서 아니어도 됨)
모양 = wv6_lib(기슭선 깊이 표 J=3·바깥 모서리 원·안쪽 홈 사분원). 색 = 아래 손 격자(보간·난수 없음)."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import wv6_lib as L
OUT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = L.P3

# 몸통 16x16 (글자 = 색 단): '.' 바탕, 1 = 옅은 푸른 획, 2 = 더 짙은 푸른 알갱이, h = 밝은 반짝임
BODY = {
 'A': ['................',
       '......11........',
       '.....1111.......',
       '................',
       '..............h.',
       '..111...........',
       '................',
       '..........1.....',
       '.........111....',
       '................',
       '.h..............',
       '.......22.......',
       '................',
       '....111.........',
       '...........h....',
       '................'],
 'B': ['................',
       '....11..........',
       '...1111.........',
       '..........11....',
       '.........1111...',
       '................',
       '................',
       '.2..............',
       '..111...........',
       '................',
       '..........h.....',
       '.......11.......',
       '......1111......',
       '................',
       '.h..........1...',
       '.........111....'],
 'C': ['................',
       '..1.............',
       '...11......h....',
       '....11..........',
       '.....2..........',
       '.........1......',
       '..........11....',
       '...h.......11...',
       '............2...',
       '................',
       '.11.............',
       '..11........h...',
       '...12...........',
       '.........1......',
       '..........11....',
       '...........12...'],
}
# C 의 세 번째 줄 길이 보정
BODY['C'] = [r.ljust(16, '.')[:16] for r in BODY['C']]

def make(v):
    prof = {'A': dict(n=P['a'], s=P['b'], w=P['c'], e=P['d']),
            'B': dict(n=P['e'], s=P['f'], w=P['g'], e=P['h']),
            'C': dict(n=P['f'], s=P['e'], w=P['d'], e=P['a'])}[v]
    sh = L.Shape(prof)
    B = BODY[v]
    def paint(role, x, y, i):
        ch = B[y % 16][x % 16]
        d = i['d']
        # 바탕색
        base = {'A': 5, 'B': 4, 'C': 5}[v]
        c = ('wsnow', base)
        if ch in '1': c = ('wsnow', base - 1 if v != 'B' else 3)
        elif ch == '2': c = ('wsnow', 3 if v == 'C' else 2 if v == 'B' else 3)
        elif ch in 'hH': c = ('wsnow', 6 if ch == 'H' else 5 if v == 'C' else 6) if v == 'C' else ('wsnow', 6)
        # 가장자리 명암 (빛 왼쪽 위): 북·서 쪽 테는 밝게, 남·동 쪽 테는 푸른 그늘
        south = i['ds'] == 1; east = i['de'] == 1; north = i['dn'] == 1; west = i['dw'] == 1
        if v == 'A':
            if d == 1: c = ('wsnow', 3) if (north or west) and not (south or east) else ('wsnow', 2)
            elif d == 2 and (south or i['ds'] == 2 or east): c = ('wsnow', 4) if ch == '.' else c
        elif v == 'B':
            if south: c = ('wsnow', 1)
            elif i['ds'] == 2: c = ('wsnow', 2)
            elif east: c = ('wsnow', 2)
            elif i['de'] == 2: c = ('wsnow', 3)
            elif north: c = ('wsnow', 5)
            elif west: c = ('wsnow', 3)
            elif i['dn'] == 2: c = ('wsnow', 6) if ch == '.' else c
        else:  # C
            if d == 1: c = ('wsnow', 2) if (south or east) else ('wsnow', 3)
            elif d == 2 and (south or east) and ch == '.': c = ('wsnow', 4)
            elif d == 2 and (north or west) and ch == '.': c = ('wsnow', 6)
        return c
    def rim(role, x, y, i):
        # 눈 가장자리 밖: 풀이 살짝 눈 밑에 물린 듯 짙은 풀 알갱이 띄엄띄엄 (덩이 바깥 1px)
        if i['db'] == 1 and ((x * 3 + y * 5 + (x // 3) * 2) % 7 in (0, 3)):
            return ('wgrass', 1) if v != 'C' else ('wgrass', 2)
        return None
    return L.render(sh, paint, rim)

NOTE = {'A': 'World.png 결 — 가장 조용한 흰 눈, 옅은 푸른 바람 획 드문드문, 푸른 그늘 테 1px, 풀 알갱이가 눈 밑에 물림',
        'B': '깊이 강조 — 남동은 푸른 그늘 2px 눈 둑, 북서는 밝은 입술, 바람 획 굵게',
        'C': '다른 해석 — 얼어붙은 눈 껍질: 십자 반짝이와 짙은 푸른 눈구멍 점, 획 없음'}
for v in 'ABC':
    L.emit(make(v), os.path.join(OUT, f'wv6-{v}.pxg'), f'snow wv6-{v}')
    open(os.path.join(OUT, f'wv6-{v}.note'), 'w').write(NOTE[v] + '\n')
print('ok')
