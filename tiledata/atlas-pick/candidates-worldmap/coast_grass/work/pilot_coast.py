#!/usr/bin/env python3
"""coast_grass 파일럿(2판 규칙) — 격자 pilot-A.pxg 를 만든다.
  python3 tiledata/atlas-pick/candidates-worldmap/coast_grass/work/pilot_coast.py [--variant A|B]

수식 명암이 아니라 **모양 규칙**만 코드로 적는다: 물가 선(기슭선)의 칸별 깊이 표, 모서리 원, 안쪽 모서리 홈 반지름.
색은 전부 손으로 정한 표(아래 CLASS_*)에서 고른다 — 보간·난수 없음. 몸통 물결은 16×16 손 격자.
규칙(worldmap-reference-study.md 4절):
  - 기슭선 깊이 S(바깥에서 물이 시작하는 화소) = 2~4, 사분면 이음 열(0·7·8·15)은 모두 3. → 1칸 폭 해협도 물 8px 이상.
  - 바깥 모서리(물 덩이의 볼록 모서리) = 반지름 큰 원(중심 (10,10) r²=52) — 이음 열에서 S=3, 대각선 S=5.
  - 안쪽 모서리 홈(땅의 볼록 모서리가 대각선 칸을 파고든 자리) = 반지름 3 사분원(r²=9) — 이음 열에서 S=3 과 맞다.
  - 땅 쪽: 북쪽 물가(땅이 물 위) = 흙 둑 앞면 2px(3/4 시점에서 보이는 면), 남쪽 물가 = 짙은 풀 입술 1px, 동서 = 흙 1px.
  - 물 쪽: 테 1px(wsea:3) → 여울 2px(wsea:2) → 몸통(wsea:1 + 물결 그물).
"""
import os, sys
import numpy as np
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), 'pilot-A.pxg')
T = 16
J = 3   # 이음 열 깊이
PROF = {   # 칸 바깥쪽에서 잰 기슭선 깊이(열/행 0..15). 이음 0·7·8·15 = J. 이웃 차 ≤ 1, 진폭 ±1, 평지 길이를 섞는다
    # (진폭 ±2 이상·8px 마다 같은 혹 = 16px 주기로 되풀이되는 톱니가 된다 — 2026-09-30 파일럿 2차에서 실패)
    'n': [3, 3, 4, 4, 4, 4, 3, 3, 3, 3, 3, 2, 2, 3, 3, 3],
    's': [3, 3, 3, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 3, 3, 3],
    'w': [3, 3, 3, 4, 4, 4, 3, 3, 3, 2, 2, 3, 3, 3, 3, 3],
    'e': [3, 3, 2, 2, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 3, 3],
}
# 몸통 물결 그물 16×16 (. = wsea:1 바탕, n = wsea:2 물결 줄, g = wsea:3 반짝임). 16px 주기로 이어진다.
BODY = [
    '................',
    '......nn........',
    '........n.......',
    '................',
    '..............g.',
    '..nnn...........',
    '.....n..........',
    '................',
    '...........nn...',
    '.............n..',
    '................',
    '.g..............',
    '................',
    '......nnn.......',
    '.........n......',
    '................',
]

def body_px(x, y, alt=False):
    if alt: x, y = (x + 8) % T, (y + 5) % T
    return {'.': ('wsea', 1), 'n': ('wsea', 2), 'g': ('wsea', 3)}[BODY[y % T][x % T]]

def quarter_land(role, q, x, y):
    """역할 칸 role 의 사분면 q 안 화소 (x,y)(칸 좌표 0..15) 가 땅인가 — 엔진이 그 사분면을 쓰는 경우의 모양."""
    lx, ly = x % 8, y % 8
    if role in ('edge_n', 'edge_s', 'edge_w', 'edge_e'):
        s = role[-1]
        if s == 'n': return y < PROF['n'][x]
        if s == 's': return (15 - y) < PROF['s'][x]
        if s == 'w': return x < PROF['w'][y]
        return (15 - x) < PROF['e'][y]
    if role.startswith('corner_'):
        # 사분면 안쪽 꼭짓점(칸 가운데) 쪽으로 좌표를 뒤집어 nw 꼴로 맞춘다
        fx = lx if q[1] == 'w' else 7 - lx; fy = ly if q[0] == 'n' else 7 - ly
        return (fx + 0.5 - 10) ** 2 + (fy + 0.5 - 10) ** 2 > 52
    if role == 'inner':
        fx = lx if q[1] == 'w' else 7 - lx; fy = ly if q[0] == 'n' else 7 - ly
        return (fx + 0.5) ** 2 + (fy + 0.5) ** 2 <= 9
    return False   # body

# 엔진 사분면 규칙으로 3×3 마당(가운데 칸 = 그 역할)을 짜서 거리를 잰다 — 이음 너머 이웃의 물가까지 보고 둑·테를 칠하려고
ROLE_Q = {}
def compose(mask):
    """mask 3×3 (1 = 물). 돌려주는 값 = 48×48 땅 여부."""
    H = W = 3; land = np.zeros((48, 48), bool)
    on = lambda x, y: mask[y][x] == 1 if 0 <= x < W and 0 <= y < H else False
    Q = {'nw': ((0, -1), (-1, 0), (-1, -1), 0, 0), 'ne': ((0, -1), (1, 0), (1, -1), 8, 0),
         'sw': ((0, 1), (-1, 0), (-1, 1), 0, 8), 'se': ((0, 1), (1, 0), (1, 1), 8, 8)}
    for cy in range(3):
        for cx in range(3):
            if not on(cx, cy): land[cy * T:(cy + 1) * T, cx * T:(cx + 1) * T] = True; continue
            for q, ((vx, vy), (hx, hy), (dx, dy), ox, oy) in Q.items():
                v, h, d = on(cx + vx, cy + vy), on(cx + hx, cy + hy), on(cx + dx, cy + dy)
                if not v and not h: r = 'corner_' + q
                elif not v: r = 'edge_n' if q[0] == 'n' else 'edge_s'
                elif not h: r = 'edge_w' if q[1] == 'w' else 'edge_e'
                elif not d: r = 'inner'
                else: r = 'body'
                for y in range(8):
                    for x in range(8):
                        land[cy * T + oy + y, cx * T + ox + x] = quarter_land(r, q, ox + x, oy + y)
    return land

CONFIG = {   # 가운데 칸이 그 역할 그림이 되는 3×3 물(1)/땅(0) 배치
    'body': [[1, 1, 1], [1, 1, 1], [1, 1, 1]],
    'edge_n': [[0, 0, 0], [1, 1, 1], [1, 1, 1]], 'edge_s': [[1, 1, 1], [1, 1, 1], [0, 0, 0]],
    'edge_w': [[0, 1, 1], [0, 1, 1], [0, 1, 1]], 'edge_e': [[1, 1, 0], [1, 1, 0], [1, 1, 0]],
    'corner_nw': [[0, 0, 0], [0, 1, 1], [0, 1, 1]], 'corner_ne': [[0, 0, 0], [1, 1, 0], [1, 1, 0]],
    'corner_sw': [[0, 1, 1], [0, 1, 1], [0, 0, 0]], 'corner_se': [[1, 1, 0], [1, 1, 0], [0, 0, 0]],
    'inner': [[0, 1, 0], [1, 1, 1], [0, 1, 0]],
    'isolated': [[0, 0, 0], [0, 1, 0], [0, 0, 0]],
}
AT = {'isolated': (0, 0), 'body_alt': (1, 0), 'inner': (2, 0), 'corner_nw': (0, 1), 'edge_n': (1, 1), 'corner_ne': (2, 1),
      'edge_w': (0, 2), 'body': (1, 2), 'edge_e': (2, 2), 'corner_sw': (0, 3), 'edge_s': (1, 3), 'corner_se': (2, 3)}

def paint(role, variant):
    cfg = CONFIG['body' if role == 'body_alt' else role]
    land = compose(cfg)
    water = ~land
    st = ndimage.generate_binary_structure(2, 1)   # 네 방향 걸음 거리
    dw = ndimage.distance_transform_cdt(water, metric='taxicab')   # 물 화소: 가장 가까운 땅까지
    dl = ndimage.distance_transform_cdt(land, metric='taxicab')
    out = {}
    for y in range(16, 32):
        for x in range(16, 48 - 16):
            lx, ly = x - 16, y - 16
            if water[y, x]:
                d = dw[y, x]
                if d == 1: c = ('wsea', 3)
                elif d <= 3: c = ('wsea', 2)
                else: c = body_px(lx, ly, role == 'body_alt')
                if variant == 'B' and d == 4: c = ('wsea', 2) if c == ('wsea', 1) else c
            else:
                d = dl[y, x]; c = None
                wS = y + 1 < 48 and water[y + 1, x]; wN = y > 0 and water[y - 1, x]
                if d == 1:
                    if wS: c = ('wdirt', 0)            # 북쪽 물가: 둑 앞면 아래(젖은 흙)
                    elif wN: c = ('wgrass', 1)         # 남쪽 물가: 짙은 풀 입술
                    else: c = ('wdirt', 1)             # 동서·모서리: 흙 한 줄
                elif d == 2 and y + 2 < 48 and water[y + 2, x] and land[y + 1, x]:
                    c = ('wdirt', 2)                   # 둑 앞면 윗줄(빛 받는 흙)
                    if variant == 'B': c = ('wdirt', 3)
                elif d == 2 and variant == 'B' and wN is False and y + 1 < 48 and not water[y + 1, x] and y > 1 and water[y - 2, x]:
                    c = ('wgrass', 2)
            out[(lx, ly)] = c
    return out

def main():
    variant = sys.argv[sys.argv.index('--variant') + 1] if '--variant' in sys.argv else 'A'
    grid = [[None] * 48 for _ in range(64)]
    for role, (cx, cy) in AT.items():
        px = paint(role, variant)
        for (x, y), c in px.items(): grid[cy * T + y][cx * T + x] = c
    keys = sorted({c for row in grid for c in row if c})
    letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
    lk = {k: letters[i] for i, k in enumerate(keys)}
    out = os.path.join(os.path.dirname(HERE), f'pilot-{variant}.pxg')
    L = [f'// coast_grass pilot-{variant} — 2판 규칙 파일럿(work/pilot_coast.py 가 만든다; 손으로 고칠 땐 이 격자를 직접 고친다)',
         '@size 48 64', '@cell 16', '@palette palette.pal', '@layer main']
    for k, l in lk.items(): L.append(f'@mat {l} {k[0]} {k[1]}')
    L.append('@mblock 0 0')
    for row in grid: L.append(''.join(lk[c] if c else '.' for c in row))
    open(out, 'w').write('\n'.join(L) + '\n'); print(out)

if __name__ == '__main__':
    main()
