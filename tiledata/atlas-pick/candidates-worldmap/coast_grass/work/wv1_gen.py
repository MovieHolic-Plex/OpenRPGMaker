#!/usr/bin/env python3
"""wv1 2판 후보 생성기 — coast_grass/coast_sand/coast_snow/sea_deep/shoal 의 A·B·C 격자(wv1-X.pxg)를 만든다.
  python3 tiledata/atlas-pick/candidates-worldmap/coast_grass/work/wv1_gen.py [슬러그 ...]
모양 규칙만 코드(기슭선 깊이 표·모서리 원·홈 반지름 3, pilot_coast.py 와 같은 엔진 사분면 합성)이고, 색은 전부 아래 손 표에서 고른다(보간·난수 없음).
같은 글자 A/B/C 의 바다 몸통 그림·기슭선 깊이 표는 coast_* 세 슬러그가 똑같다 — 둑 색(BANK)만 다르다.
"""
import os, sys
import numpy as np
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))   # candidates-worldmap
T = 16

# ── 기슭선 깊이 표 (칸 바깥에서 잰 깊이). 이음 열 0·7·8·15 = 3, 이웃 차 ≤1, 진폭 ±1, 평지 길이를 섞는다. 글자마다 다르다.
PROFS = {
 'A': {'n': [3,4,4,4,3,3,3,3,3,3,2,2,2,3,3,3], 's': [3,3,3,2,2,3,3,3,3,4,4,4,3,3,3,3],
       'w': [3,3,4,4,4,4,3,3,3,3,3,3,2,2,3,3], 'e': [3,2,2,3,3,3,3,3,3,3,4,4,4,3,3,3]},
 'B': {'n': [3,3,3,3,4,4,3,3,3,3,3,3,3,4,4,3], 's': [3,3,2,2,2,3,3,3,3,3,3,4,4,3,3,3],
       'w': [3,3,3,3,3,2,2,2,3,3,3,3,4,4,4,3], 'e': [3,4,4,3,3,3,3,3,3,2,2,3,3,3,3,3]},
 'C': {'n': [3,2,2,3,3,4,4,3,3,3,3,2,3,3,3,3], 's': [3,3,4,3,3,3,2,3,3,3,4,4,3,2,3,3],
       'w': [3,3,3,4,3,3,2,3,3,2,3,3,4,4,3,3], 'e': [3,3,4,4,3,2,2,3,3,3,3,3,2,3,3,3]},
}

# ── 바다 몸통 16×16 손 격자 (. 바탕, n 물결 마루, d 물결 그늘, g 반짝임 1화소). 16px 주기로 이어진다.
BODIES = {
 'A': ['................', '....nn..........', '......n.........', '................',
       '.............g..', '.nnn............', '....n...........', '................',
       '..........nn....', '............n...', '................', '..g.............',
       '................', '.....nnn........', '........n.......', '................'],
 'B': ['................', '...nnn..........', '....ddd.........', '................',
       '..........g.....', '.........nn.....', '..........dd....', '................',
       '.dd.............', '...dd...........', '................', '.............nn.',
       '..............dd', '.......n........', '.......dd.......', '................'],
 'C': ['................', '.n..............', '..n.............', '...n............',
       '................', '.........g......', '................', '.....d..........',
       '......d.........', '.......d........', '................', '..............n.',
       '.............n..', '............n...', '................', '...g............'],
}
def body_ch(v, x, y, alt=False, rows=None):
    if alt: x, y = (x + 8) % T, (y + 5) % T
    if rows is not None and (y % T) not in rows: return '.'
    return BODIES[v][y % T][x % T]

# ── 엔진 사분면 합성 (pilot_coast.py 와 같은 규칙)
def quarter_land(PROF, role, q, x, y):
    lx, ly = x % 8, y % 8
    if role in ('edge_n', 'edge_s', 'edge_w', 'edge_e'):
        s = role[-1]
        if s == 'n': return y < PROF['n'][x]
        if s == 's': return (15 - y) < PROF['s'][x]
        if s == 'w': return x < PROF['w'][y]
        return (15 - x) < PROF['e'][y]
    fx = lx if q[1] == 'w' else 7 - lx; fy = ly if q[0] == 'n' else 7 - ly
    if role.startswith('corner_'): return (fx + 0.5 - 10) ** 2 + (fy + 0.5 - 10) ** 2 > 52
    if role == 'inner': return (fx + 0.5) ** 2 + (fy + 0.5) ** 2 <= 9
    return False

def compose(PROF, mask):
    land = np.zeros((48, 48), bool)
    on = lambda x, y: mask[y][x] == 1 if 0 <= x < 3 and 0 <= y < 3 else False
    Q = {'nw': ((0,-1),(-1,0),(-1,-1),0,0), 'ne': ((0,-1),(1,0),(1,-1),8,0), 'sw': ((0,1),(-1,0),(-1,1),0,8), 'se': ((0,1),(1,0),(1,1),8,8)}
    for cy in range(3):
        for cx in range(3):
            if not on(cx, cy): land[cy*T:(cy+1)*T, cx*T:(cx+1)*T] = True; continue
            for q, ((vx,vy),(hx,hy),(dx,dy),ox,oy) in Q.items():
                v, h, d = on(cx+vx, cy+vy), on(cx+hx, cy+hy), on(cx+dx, cy+dy)
                if not v and not h: r = 'corner_' + q
                elif not v: r = 'edge_n' if q[0] == 'n' else 'edge_s'
                elif not h: r = 'edge_w' if q[1] == 'w' else 'edge_e'
                elif not d: r = 'inner'
                else: r = 'body'
                for y in range(8):
                    for x in range(8): land[cy*T+oy+y, cx*T+ox+x] = quarter_land(PROF, r, q, ox+x, oy+y)
    return land

CONFIG = {
 'body': [[1,1,1],[1,1,1],[1,1,1]], 'edge_n': [[0,0,0],[1,1,1],[1,1,1]], 'edge_s': [[1,1,1],[1,1,1],[0,0,0]],
 'edge_w': [[0,1,1],[0,1,1],[0,1,1]], 'edge_e': [[1,1,0],[1,1,0],[1,1,0]],
 'corner_nw': [[0,0,0],[0,1,1],[0,1,1]], 'corner_ne': [[0,0,0],[1,1,0],[1,1,0]],
 'corner_sw': [[0,1,1],[0,1,1],[0,0,0]], 'corner_se': [[1,1,0],[1,1,0],[0,0,0]],
 'inner': [[0,1,0],[1,1,1],[0,1,0]], 'isolated': [[0,0,0],[0,1,0],[0,0,0]],
}
AT = {'isolated': (0,0), 'body_alt': (1,0), 'inner': (2,0), 'corner_nw': (0,1), 'edge_n': (1,1), 'corner_ne': (2,1),
      'edge_w': (0,2), 'body': (1,2), 'edge_e': (2,2), 'corner_sw': (0,3), 'edge_s': (1,3), 'corner_se': (2,3)}

# ── 바다(coast_*) 물 쪽 색: 세 슬러그가 똑같다
def coast_water(v, d, lx, ly, alt, up, up2):
    W = 'wsea'
    if v == 'A':
        if d == 1: return (W, 3)
        if d <= 3: return (W, 2)
    elif v == 'B':   # 한 화소씩 다섯 단 — 기슭에서 몸통까지 깊이가 층으로 보인다
        if d == 1: return (W, 4)
        if d == 2: return (W, 3)
        if d == 3: return (W, 2)
        if d == 4 and (lx + ly) % 3 != 0: return (W, 2)   # 4단은 성기게 풀어 몸통과 섞는다
    else:            # C: 테 1화소, 여울은 끊긴 획(가장자리가 들쭉날쭉)
        if d == 1: return (W, 3)
        if d == 2: return (W, 2) if (lx // 2 + ly // 2) % 3 != 1 else (W, 1)
        if d == 3 and (lx * 5 + ly * 3) % 7 < 2: return (W, 2)
    ch = body_ch(v, lx, ly, alt)
    return {'.': (W, 1), 'n': (W, 2), 'g': (W, 3), 'd': (W, 0)}[ch]

# ── 둑(땅 쪽) 색 표. 형: N = 북쪽 물가(땅이 물 위: 둑 앞면), S = 남쪽 물가(입술), E = 동서. {물에서 잰 걸음: (램프, 단)}
BANK = {
 'coast_grass': {
   'A': {'N': {1:('wdirt',0), 2:('wdirt',2)}, 'S': {1:('wgrass',1)}, 'E': {1:('wdirt',1)}},
   'B': {'N': {1:('wdirt',0), 2:('wdirt',3), 3:('wgrass',2)}, 'S': {1:('wgrass',1), 2:('wgrass',2)}, 'E': {1:('wdirt',1), 2:('wgrass',2)}},
   'C': {'N': {1:('wdirt',1), 2:('wdirt',2)}, 'S': {1:('wdirt',1)}, 'E': {1:('wdirt',1)}}},
 'coast_sand': {   # 젖은 모래 = 밑바탕보다 한 단 어둡게
   'A': {'N': {1:('wsand',1), 2:('wsand',2)}, 'S': {1:('wsand',2)}, 'E': {1:('wsand',2)}},
   'B': {'N': {1:('wsand',0), 2:('wsand',1), 3:('wsand',2)}, 'S': {1:('wsand',1), 2:('wsand',2)}, 'E': {1:('wsand',1), 2:('wsand',2)}},
   'C': {'N': {1:('wsand',2), 2:('wsand',3)}, 'S': {1:('wsand',2)}, 'E': {1:('wsand',2)}}},
 'coast_snow': {   # 얼음 테 2px, 윗면 밝게
   'A': {'N': {1:('wice',2), 2:('wice',3)}, 'S': {1:('wice',3), 2:('wice',4)}, 'E': {1:('wice',3), 2:('wice',4)}},
   'B': {'N': {1:('wice',1), 2:('wice',2), 3:('wice',4)}, 'S': {1:('wice',2), 2:('wice',3)}, 'E': {1:('wice',2), 2:('wice',3)}},
   'C': {'N': {1:('wice',2), 2:('wice',3)}, 'S': {1:('wice',3)}, 'E': {1:('wice',3)}}},
}
# 둑 위 조각(C·B 의 결) — (슬러그, 글자) → 조건 함수(lx,ly,d,type) → 색
def bank_extra(slug, v, x, y, d, typ):
    if slug == 'coast_grass' and v == 'C' and d == 2 and typ != 'N' and (x * 3 + y * 7) % 9 == 0: return ('wgrass', 4)   # 풀 끝 한두 개
    if slug == 'coast_grass' and v == 'C' and d == 1 and (x * 5 + y * 3) % 11 == 0: return ('wdirt', 3)                # 자갈 알
    if slug == 'coast_sand' and v == 'C' and d == 1 and (x * 5 + y * 3) % 11 == 0: return ('wsand', 4)
    if slug == 'coast_snow' and v == 'C' and d == 1 and (x * 5 + y * 3) % 9 == 0: return ('wice', 2)
    return None

def bank_type(land, water, x, y, d):
    if y + d < 48 and water[y + d, x] and land[y + 1:y + d, x].all(): return 'N'
    if y - d >= 0 and water[y - d, x] and land[y - d + 1:y, x].all(): return 'S'
    if x + d < 48 and water[y, x + d] and land[y, x + 1:x + d].all(): return 'E'
    if x - d >= 0 and water[y, x - d] and land[y, x - d + 1:x].all(): return 'E'
    return None   # 대각선 뒤 — 둑을 그리지 않는다(안쪽 모서리 홈 귀가 비어야 한다)

# ── 깊은 바다: 안 = 깊은 물, 바깥(투명) = 얕은 바다. 얕은 바다(wsea:1)보다 두 단 어둡다
DEEP_KEEP = {'A': {1, 2, 5, 6, 8, 9, 13, 14}, 'B': {1, 2, 5, 6, 8, 9, 13, 14}, 'C': {1, 2, 3, 7, 8, 9, 11, 12, 13}}
def deep_water(v, d, lx, ly, alt, up, up2):
    R = 'wdeep'; ch = body_ch(v, lx, ly, alt, DEEP_KEEP[v])
    if v == 'A':   # 경계 2화소가 얕은 바다로 풀린다: 가장자리 밝은 단, 안쪽은 손 표로 섞는다
        if d == 1: return (R, 4) if (lx + 2 * ly) % 5 != 0 else (R, 3)
        if d == 2: return (R, 3) if (lx * 3 + ly) % 4 != 0 else (R, 2)
        return {'.': (R, 2), 'n': (R, 1), 'g': (R, 3), 'd': (R, 1)}[ch]
    if v == 'B':   # 층: 가장자리 3단 → 몸통 1단(더 어둡다) — 깊이가 진다
        if d == 1: return (R, 4)
        if d == 2: return (R, 3)
        if d == 3: return (R, 2)
        return {'.': (R, 1), 'n': (R, 0), 'g': (R, 2), 'd': (R, 0)}[ch]
    # C: 가장자리는 짧은 획으로 끊겨 풀리고 속은 소용돌이 대각 획
    if d == 1: return (R, 4) if (lx // 3 + ly // 2) % 2 == 0 else (R, 3)
    if d == 2 and (lx + ly * 2) % 5 < 2: return (R, 3)
    return {'.': (R, 2), 'n': (R, 3), 'g': (R, 4), 'd': (R, 1)}[ch]

# ── 여울·암초: 안 = 밝은 여울(얕은 바다보다 두 단 밝음) + 모래 비침 + 바위 머리
SAND = {   # 모래 비침 조각 (x, y, 램프, 단) — 몸통 16×16 안(16px 주기)
 'A': [(3,3,'wsand',3),(4,3,'wsand',3),(11,9,'wsand',3),(12,9,'wsand',4),(12,10,'wsand',3)],
 'B': [(2,6,'wsand',2),(3,6,'wsand',3),(4,6,'wsand',3),(3,7,'wsand',2),(4,7,'wsand',3),(12,2,'wsand',3),(13,2,'wsand',3)],
 'C': [(6,12,'wsand',4),(7,12,'wsand',4),(13,5,'wsand',4)]}
ROCK = {   # 바위 머리 (bitmap, ox, oy): r 바위:3, R 바위:4, h 밝은 바위:5, s 그늘:1 — body_alt·isolated 칸에만
 'A': (['.rr..', 'rRRr.', 'rRRhr', '.ssr.'], 5, 6),
 'B': (['..rr..', '.rRRr.', 'rRhRRr', 'rRRRRr', '.ssss.'], 5, 5),
 'C': (['.r.', 'rRr', 'sss'], 6, 7)}
RCOL = {'r': ('wrock', 3), 'R': ('wrock', 4), 'h': ('wrock', 5), 's': ('wrock', 1)}
def shoal_water(v, d, lx, ly, alt, up, up2):
    R = 'wsea'
    if v == 'A':
        if d == 1: return (R, 2)
        if d == 2 and (lx + ly) % 3 != 0: return (R, 3) 
    elif v == 'B':
        if d == 1: return (R, 2)
        if d == 2: return (R, 3)
        if d == 3 and (lx + 2 * ly) % 4 == 0: return (R, 3)
    else:
        if d == 1: return (R, 3) if (lx // 2 + ly) % 2 == 0 else (R, 2)
        if d == 2 and (lx + ly * 3) % 5 == 0: return (R, 2)
    for (sx, sy, r, s) in SAND[v]:
        px, py = (sx, sy) if not alt else ((sx + 8) % T, (sy + 5) % T)
        if (lx, ly) == (px, py): return (r, s)
    ch = body_ch(v, lx, ly, alt)
    base = 4 if v == 'C' else 3
    return {'.': (R, base), 'n': (R, base + 1), 'g': (R, 5), 'd': (R, base - 1)}[ch]

def paint(slug, v, role):
    PROF = PROFS[v]
    land = compose(PROF, CONFIG['body' if role == 'body_alt' else role])
    water = ~land
    dw = ndimage.distance_transform_cdt(water, metric='taxicab')
    dl = ndimage.distance_transform_cdt(land, metric='taxicab')
    out = {}
    alt = role == 'body_alt'
    for y in range(16, 32):
        for x in range(16, 32):
            lx, ly = x - 16, y - 16
            if water[y, x]:
                d = int(dw[y, x]); up = land[y-1, x] if y else False; up2 = land[y-2, x] if y > 1 else False
                fn = {'coast': coast_water, 'sea_deep': deep_water, 'shoal': shoal_water}['coast' if slug.startswith('coast') else slug]
                c = fn(v, d, lx, ly, alt, up, up2)
                if slug == 'shoal' and role in ('isolated', 'body_alt'):
                    bm, ox, oy = ROCK[v]
                    rx, ry = lx - ox, ly - oy
                    if 0 <= ry < len(bm) and 0 <= rx < len(bm[0]) and bm[ry][rx] in RCOL and (role == 'body_alt' or d >= 4): c = RCOL[bm[ry][rx]]
                out[(lx, ly)] = c
            else:
                out[(lx, ly)] = None
                if slug.startswith('coast'):
                    d = int(dl[y, x])
                    if d <= 3:
                        typ = bank_type(land, water, x, y, d) if d > 1 or True else 'E'
                        # d>1 인 땅 화소는 정말 물이 d 걸음 앞에 있을 때만 (대각선은 E)
                        c = BANK[slug][v][typ].get(d) if typ else None
                        ex = bank_extra(slug, v, x, y, d, typ) if typ else None
                        out[(lx, ly)] = ex or c
                        if role == 'inner' and (lx, ly) in ((0, 0), (0, 15), (15, 0), (15, 15)): out[(lx, ly)] = None   # 안쪽 모서리 칸 네 귀는 바깥(투명)
    return out

def build(slug, v):
    grid = [[None] * 48 for _ in range(64)]
    for role, (cx, cy) in AT.items():
        for (x, y), c in paint(slug, v, role).items(): grid[cy*T+y][cx*T+x] = c
    # 칸 자기 자리(가운데 16폭)만 칠하므로 열 0..15 → 실제 칸 x 오프셋 cx*16 (paint 는 로컬 좌표 0..15)
    return grid

def emit(slug, v, name):
    grid = build(slug, v)
    keys = sorted({c for row in grid for c in row if c})
    letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
    lk = {k: letters[i] for i, k in enumerate(keys)}
    L = [f'// {slug} wv1-{v} — 2판 (work/wv1_gen.py 가 만든다; 손으로 고칠 땐 이 격자를 직접 고친다)', '@size 48 64', '@cell 16', '@palette palette.pal', '@layer main']
    for k, l in lk.items(): L.append(f'@mat {l} {k[0]} {k[1]}')
    L.append('@mblock 0 0')
    for row in grid: L.append(''.join(lk[c] if c else '.' for c in row))
    p = os.path.join(ROOT, slug, f'wv1-{v}.pxg'); open(p, 'w').write('\n'.join(L) + '\n'); print(p)

if __name__ == '__main__':
    slugs = [a for a in sys.argv[1:] if not a.startswith('-')] or ['coast_grass', 'coast_sand', 'coast_snow', 'sea_deep', 'shoal']
    for s in slugs:
        for v in 'ABC': emit(s, v, s)
