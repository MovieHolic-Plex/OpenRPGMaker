#!/usr/bin/env python3
"""wv2 공용 도우미 — 3x4 이어짐 묶음(line/flat)의 「모양」 규칙만 코드로 적는다(기슭선 깊이 표·모서리 원·안쪽 홈 원).
색은 각 기물 스크립트의 손 표에서 고른다(보간·난수 없음). 골격은 coast_grass/work/pilot_coast.py 와 같은 사분면 합성.
  body  = 몸통 재료(체크가 「몸통」으로 재는 램프)가 시작하는 자리. 기슭 깊이 J=3(이음 열 0·7·8·15)±1.
  sil   = 실루엣(몸통 + 테). 몸통 바깥으로 변마다 다른 두께 r 만큼 테가 붙는다(북 둑 앞면 2px, 남 입술 1px …).
"""
import os, numpy as np
from scipy import ndimage
T = 16
AT = {'isolated': (0, 0), 'body_alt': (1, 0), 'inner': (2, 0), 'corner_nw': (0, 1), 'edge_n': (1, 1), 'corner_ne': (2, 1),
      'edge_w': (0, 2), 'body': (1, 2), 'edge_e': (2, 2), 'corner_sw': (0, 3), 'edge_s': (1, 3), 'corner_se': (2, 3)}
CONFIG = {   # 가운데 칸이 그 역할이 되는 3x3 (1 = 덩이 칸)
    'body': [[1, 1, 1], [1, 1, 1], [1, 1, 1]],
    'edge_n': [[0, 0, 0], [1, 1, 1], [1, 1, 1]], 'edge_s': [[1, 1, 1], [1, 1, 1], [0, 0, 0]],
    'edge_w': [[0, 1, 1], [0, 1, 1], [0, 1, 1]], 'edge_e': [[1, 1, 0], [1, 1, 0], [1, 1, 0]],
    'corner_nw': [[0, 0, 0], [0, 1, 1], [0, 1, 1]], 'corner_ne': [[0, 0, 0], [1, 1, 0], [1, 1, 0]],
    'corner_sw': [[0, 1, 1], [0, 1, 1], [0, 0, 0]], 'corner_se': [[1, 1, 0], [1, 1, 0], [0, 0, 0]],
    'inner': [[0, 1, 0], [1, 1, 1], [0, 1, 0]],
    'isolated': [[0, 0, 0], [0, 1, 0], [0, 0, 0]],
}
# 기슭선 깊이 표 세트(칸 바깥에서 몸통까지, 열/행 0..15). 이음 0·7·8·15 = 3, 이웃 차 ≤ 1, 진폭 ±1, 평지 길이 섞음
PROFS = {
    1: {'n': [3,3,4,4,4,4,3,3, 3,3,3,2,2,3,3,3], 's': [3,3,3,2,2,3,3,3, 3,3,4,4,4,3,3,3],
        'w': [3,3,3,4,4,4,3,3, 3,2,2,3,3,3,3,3], 'e': [3,3,2,2,3,3,3,3, 3,3,3,4,4,4,3,3]},
    2: {'n': [3,3,3,2,2,3,3,3, 3,4,4,4,3,3,3,3], 's': [3,4,4,3,3,3,3,3, 3,3,2,2,2,3,3,3],
        'w': [3,3,2,2,2,3,3,3, 3,3,3,4,4,3,3,3], 'e': [3,3,3,3,4,4,4,3, 3,2,2,3,3,3,3,3]},
    3: {'n': [3,3,3,3,4,4,3,3, 3,3,2,2,2,3,3,3], 's': [3,2,2,3,3,3,3,3, 3,4,4,4,4,3,3,3],
        'w': [3,3,3,3,3,2,2,3, 3,3,4,4,4,3,3,3], 'e': [3,4,4,3,3,3,3,3, 3,3,3,2,2,2,3,3]},
}

def _quarter_out(role, q, x, y, prof, cx=10, cy=10, r2=52, ir2=9):
    """역할 칸 role 의 사분면 q 안 화소(칸 좌표)가 덩이 바깥인가."""
    lx, ly = x % 8, y % 8
    if role in ('edge_n', 'edge_s', 'edge_w', 'edge_e'):
        s = role[-1]
        if s == 'n': return y < prof['n'][x]
        if s == 's': return (15 - y) < prof['s'][x]
        if s == 'w': return x < prof['w'][y]
        return (15 - x) < prof['e'][y]
    fx = lx if q[1] == 'w' else 7 - lx; fy = ly if q[0] == 'n' else 7 - ly
    if role.startswith('corner_'): return (fx + .5 - cx) ** 2 + (fy + .5 - cy) ** 2 > r2
    if role == 'inner': return (fx + .5) ** 2 + (fy + .5) ** 2 <= ir2
    return False

def compose_body(cfg, prof):
    """3x3 배치(cfg)를 사분면 규칙으로 짜서 48x48 「몸통 재료」 마스크를 낸다(True = 몸통)."""
    body = np.zeros((48, 48), bool); H = W = 3
    on = lambda x, y: cfg[y][x] == 1 if 0 <= x < W and 0 <= y < H else False
    Q = {'nw': ((0, -1), (-1, 0), (-1, -1), 0, 0), 'ne': ((0, -1), (1, 0), (1, -1), 8, 0),
         'sw': ((0, 1), (-1, 0), (-1, 1), 0, 8), 'se': ((0, 1), (1, 0), (1, 1), 8, 8)}
    for cy in range(3):
        for cx_ in range(3):
            if not on(cx_, cy): continue
            for q, ((vx, vy), (hx, hy), (dx, dy), ox, oy) in Q.items():
                v, h, d = on(cx_ + vx, cy + vy), on(cx_ + hx, cy + hy), on(cx_ + dx, cy + dy)
                if not v and not h: r = 'corner_' + q
                elif not v: r = 'edge_n' if q[0] == 'n' else 'edge_s'
                elif not h: r = 'edge_w' if q[1] == 'w' else 'edge_e'
                elif not d: r = 'inner'
                else: r = 'body'
                for y in range(8):
                    for x in range(8):
                        body[cy * T + oy + y, cx_ * T + ox + x] = not _quarter_out(r, q, ox + x, oy + y, prof)
    return body

def dilate(body, rn, rs, rw, re_, corner=True):
    """몸통 바깥으로 변마다 다른 두께의 테를 붙인 실루엣. 모서리는 마름모로 둥글게."""
    P = 4; b = np.pad(body, P, mode='edge'); out = b.copy(); m = max(rn, rs, rw, re_)
    for dy in range(-rn, rs + 1):
        for dx in range(-rw, re_ + 1):
            if abs(dx) + abs(dy) > m: continue
            out |= np.roll(np.roll(b, dy, 0), dx, 1)
    return out[P:-P, P:-P]

class Ctx:
    """한 칸(역할)을 칠하는 데 필요한 지형 정보. 좌표는 칸 안 (x,y) 0..15."""
    def __init__(self, role, prof, rim):
        cfg = CONFIG['body' if role == 'body_alt' else role]
        self.role = role
        self.body = compose_body(cfg, prof)
        self.sil = dilate(self.body, *rim)
        self.din = ndimage.distance_transform_cdt(np.pad(self.body, 1), metric='taxicab')[1:-1, 1:-1]   # 몸통 안: 바깥(테)까지, 첫 줄 = 1
        self.dout = ndimage.distance_transform_cdt(np.pad(~self.body, 1, constant_values=True), metric='taxicab')[1:-1, 1:-1]   # 바깥: 몸통까지
    def b(self, x, y):
        X, Y = x + 16, y + 16
        return bool(self.body[Y, X]) if 0 <= X < 48 and 0 <= Y < 48 else False
    def in_body(self, x, y): return self.b(x, y)
    def in_sil(self, x, y):
        X, Y = x + 16, y + 16
        return bool(self.sil[Y, X]) if 0 <= X < 48 and 0 <= Y < 48 else False
    def rim_side(self, x, y):
        """테 화소가 몸통의 어느 쪽 바깥인가('n' = 몸통이 아래에 있어 이 화소가 북쪽 테)."""
        for d in (1, 2, 3, 4):
            if self.b(x, y + d): return 'n'
            if self.b(x, y - d): return 's'
            if self.b(x + d, y): return 'w'
            if self.b(x - d, y): return 'e'
        return 'c'
    def edge_side(self, x, y):
        """몸통 화소가 어느 쪽 가장자리에 가까운가(가장 가까운 바깥 방향; 없으면 None). 'n' = 북쪽 바깥이 가깝다."""
        best = None
        for d in (1, 2, 3):
            for s, (dx, dy) in (('n', (0, -d)), ('w', (-d, 0)), ('s', (0, d)), ('e', (d, 0))):
                if not self.b(x + dx, y + dy): return s
        return None

def write_pxg(path, title, grid, w, h, block='@mblock 0 0', layer='main'):
    """grid 칸 = (램프, 단) 튜플 | '~' '-' '%' (그림자 층 한 글자) | None. 재료는 (램프,단)마다 글자 하나."""
    keys = sorted({c for row in grid for c in row if isinstance(c, tuple)})
    letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    lk = {k: letters[i] for i, k in enumerate(keys)}
    L = [f'// {title}', f'@size {w} {h}', '@cell 16', '@palette palette.pal', f'@layer {layer}']
    for k, l in lk.items(): L.append(f'@mat {l} {k[0]} {k[1]}')
    L.append(block)
    for row in grid: L.append(''.join(lk[c] if isinstance(c, tuple) else '.' for c in row))
    if any(isinstance(c, str) for row in grid for c in row):
        L += ['@layer shadow', '@block 0 0']
        for row in grid: L.append(''.join(c if isinstance(c, str) else '.' for c in row))
    open(path, 'w').write('\n'.join(L) + '\n')

def bundle(path, title, prof, rim, paint):
    """48x64 묶음. paint(ctx, role, x, y) -> (램프,단) | '~' | None."""
    grid = [[None] * 48 for _ in range(64)]
    for role, (gx, gy) in AT.items():
        ctx = Ctx(role, prof, rim)
        for y in range(16):
            for x in range(16):
                grid[gy * 16 + y][gx * 16 + x] = paint(ctx, role, x, y)
    write_pxg(path, title, grid, 48, 64)

def wrap_tex(spec, w=16, h=16):
    """spec = 줄 문자열 16개(글자 = 코드, '.' = 기본)를 (x,y)->코드 로."""
    return lambda x, y: spec[y % h][x % w]

def H(x, y, salt=0):
    """결정적 해시 0..99 (같은 자리 같은 값; 소스 재현용)."""
    v = (x * 73856093) ^ (y * 19349663) ^ (salt * 83492791)
    v = (v ^ (v >> 13)) * 1274126177 & 0xFFFFFFFF
    return (v ^ (v >> 16)) % 100

def wrapH(x, y, salt=0, n=16):
    """칸 안에서 이어지는 해시(몸통 칸끼리 이음새가 안 튀게 16 주기)."""
    return H(x % n, y % n, salt)
