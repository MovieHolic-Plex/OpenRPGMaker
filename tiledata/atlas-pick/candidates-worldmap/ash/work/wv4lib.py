"""wv4 공용 도우미 — 묶음(bundle) 12칸 생성기 + 16px 토러스 손 격자 도장.
pilot_coast.py(coast_grass/work)의 사분면 합성·기슭 깊이표·모서리 원을 그대로 쓰되,
바깥(땅)을 투명 + 테(fringe) 로 두고 재료(mask==1)를 칠한다.
"""
import os, sys
import numpy as np
from scipy import ndimage

T = 16
J = 3
# 기슭 깊이표(바깥에서 잰 화소 수). 이음 0·7·8·15 = 3, 이웃 차 ≤1, 진폭 ≤2. 세트별로 다르게 한다.
PROFS = {
    'P1': {'n': [3,3,4,4,4,4,3,3,3,3,3,2,2,3,3,3], 's': [3,3,3,2,2,3,3,3,3,3,4,4,4,3,3,3],
           'w': [3,3,3,4,4,4,3,3,3,2,2,3,3,3,3,3], 'e': [3,3,2,2,3,3,3,3,3,3,3,4,4,4,3,3]},
    'P2': {'n': [3,3,3,2,2,3,3,3,3,4,4,4,3,3,3,3], 's': [3,3,4,4,3,3,3,3,3,2,2,2,3,3,3,3],
           'w': [3,3,2,2,2,3,3,3,3,3,4,4,4,3,3,3], 'e': [3,3,3,4,4,3,3,3,3,2,2,3,3,3,3,3]},
    'P3': {'n': [3,4,4,3,3,2,2,2,3,3,3,4,4,4,3,3], 's': [3,2,2,3,3,4,4,4,3,3,3,2,2,3,3,3],
           'w': [3,3,4,4,4,3,3,3,3,2,2,2,3,3,4,3], 'e': [3,2,2,3,3,3,3,3,3,4,4,3,3,2,2,3]},
}
CIRC = {'A': (10.0, 52.0), 'B': (10.0, 52.0), 'C': (10.0, 52.0)}   # 바깥 모서리 원 중심·r²
INNER_R2 = 9.0

def quarter_land(role, q, x, y, prof, circ=(10.0, 52.0), ir2=INNER_R2):
    lx, ly = x % 8, y % 8
    if role in ('edge_n', 'edge_s', 'edge_w', 'edge_e'):
        s = role[-1]
        if s == 'n': return y < prof['n'][x]
        if s == 's': return (15 - y) < prof['s'][x]
        if s == 'w': return x < prof['w'][y]
        return (15 - x) < prof['e'][y]
    if role.startswith('corner_'):
        fx = lx if q[1] == 'w' else 7 - lx; fy = ly if q[0] == 'n' else 7 - ly
        return (fx + 0.5 - circ[0]) ** 2 + (fy + 0.5 - circ[0]) ** 2 > circ[1]
    if role == 'inner':
        fx = lx if q[1] == 'w' else 7 - lx; fy = ly if q[0] == 'n' else 7 - ly
        return (fx + 0.5) ** 2 + (fy + 0.5) ** 2 <= ir2
    return False

def compose(mask, prof, circ=(10.0, 52.0), ir2=INNER_R2):
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
                        land[cy * T + oy + y, cx * T + ox + x] = quarter_land(r, q, ox + x, oy + y, prof, circ, ir2)
    return land

CONFIG = {
    'body': [[1,1,1],[1,1,1],[1,1,1]],
    'edge_n': [[0,0,0],[1,1,1],[1,1,1]], 'edge_s': [[1,1,1],[1,1,1],[0,0,0]],
    'edge_w': [[0,1,1],[0,1,1],[0,1,1]], 'edge_e': [[1,1,0],[1,1,0],[1,1,0]],
    'corner_nw': [[0,0,0],[0,1,1],[0,1,1]], 'corner_ne': [[0,0,0],[1,1,0],[1,1,0]],
    'corner_sw': [[0,1,1],[0,1,1],[0,0,0]], 'corner_se': [[1,1,0],[1,1,0],[0,0,0]],
    'inner': [[0,1,0],[1,1,1],[0,1,0]],
    'isolated': [[0,0,0],[0,1,0],[0,0,0]],
}
AT = {'isolated': (0,0), 'body_alt': (1,0), 'inner': (2,0), 'corner_nw': (0,1), 'edge_n': (1,1), 'corner_ne': (2,1),
      'edge_w': (0,2), 'body': (1,2), 'edge_e': (2,2), 'corner_sw': (0,3), 'edge_s': (1,3), 'corner_se': (2,3)}

class Ctx:
    """paint 콜백에 넘기는 화소 정보. x,y = 칸 안 좌표. land = 바깥(투명 쪽) 여부."""
    pass

def make_ctx(role, prof, circ=(10.0, 52.0)):
    cfg = CONFIG['body' if role == 'body_alt' else role]
    land = compose(cfg, prof, circ)
    mat = ~land
    dm = ndimage.distance_transform_cdt(mat, metric='taxicab')    # 재료 화소 → 가장 가까운 바깥까지(1 = 맞닿음)
    dl = ndimage.distance_transform_cdt(land, metric='taxicab')   # 바깥 화소 → 가장 가까운 재료까지
    dme = ndimage.distance_transform_edt(mat)
    dle = ndimage.distance_transform_edt(land)
    return land, mat, dm, dl, dme, dle

def torus(rows_by_stamp, size=16, base='.'):
    """rows_by_stamp: [(x, y, [문자열 줄...]), ...] — 16×16 토러스에 도장(가로세로 감싼다). 글자 '.' 는 건너뛴다."""
    g = [[base] * size for _ in range(size)]
    for x0, y0, rows in rows_by_stamp:
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch != '.': g[(y0 + j) % size][(x0 + i) % size] = ch
    return g

def build(paint, out, title, profs, circ=(10.0, 52.0), need_alt=True):
    """paint(role, lx, ly, C) → None | (ramp, idx) | '~' | '-' | '%'. C 는 Ctx(land, mat, dm, dl, dme, dle, N/S/W/E 이웃, alt)."""
    grid = [[None] * 48 for _ in range(64)]
    for role, (cx, cy) in AT.items():
        prof = profs
        land, mat, dm, dl, dme, dle = make_ctx(role, prof, circ)
        for ly in range(16):
            for lx in range(16):
                x, y = lx + 16, ly + 16
                C = Ctx(); C.land = bool(land[y, x]); C.dm = int(dm[y, x]); C.dl = int(dl[y, x])
                C.dme = float(dme[y, x]); C.dle = float(dle[y, x]); C.alt = (role == 'body_alt'); C.role = role
                def nb(dx, dy):
                    xx, yy = x + dx, y + dy
                    return bool(land[yy, xx]) if 0 <= xx < 48 and 0 <= yy < 48 else True
                C.lN, C.lS, C.lW, C.lE = nb(0, -1), nb(0, 1), nb(-1, 0), nb(1, 0)
                C.land_at = lambda dx, dy, x=x, y=y, land=land: bool(land[y + dy, x + dx]) if 0 <= x + dx < 48 and 0 <= y + dy < 48 else True
                C.dm_at = lambda dx, dy, x=x, y=y, dm=dm: int(dm[y + dy, x + dx]) if 0 <= x + dx < 48 and 0 <= y + dy < 48 else 0
                grid[cy * T + ly][cx * T + lx] = paint(role, lx, ly, C)
    shadow = [[None] * 48 for _ in range(64)]
    for yy in range(64):
        for xx in range(48):
            c = grid[yy][xx]
            if isinstance(c, str) and c in '~-%': shadow[yy][xx] = c; grid[yy][xx] = None
            elif isinstance(c, tuple) and len(c) == 3: shadow[yy][xx] = c[2]; grid[yy][xx] = (c[0], c[1])   # (ramp, idx, 반투명글자) 는 못 쓴다
    keys = sorted({c for row in grid for c in row if isinstance(c, tuple)})
    letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
    lk = {k: letters[i] for i, k in enumerate(keys)}
    L = [f'// {title}', '@size 48 64', '@cell 16', '@palette palette.pal', '@layer main']
    for k, l in lk.items(): L.append(f'@mat {l} {k[0]} {k[1]}')
    L.append('@mblock 0 0')
    for row in grid: L.append(''.join(lk[c] if isinstance(c, tuple) else '.' for c in row))
    if any(c for row in shadow for c in row):
        L += ['@layer shadow', '@block 0 0']
        for row in shadow: L.append(''.join(c if c else '.' for c in row))
    open(out, 'w').write('\n'.join(L) + '\n'); print(out, len(keys), 'colors')
