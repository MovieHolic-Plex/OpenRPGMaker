"""wv3 공용: 산·고원용 3x4 묶음 조립기 (2판, 엔진 사분면 합성 규칙).
 - 역할마다 3x3 마당을 엔진 규칙으로 짜서 가운데 칸을 그린다(pilot_coast.py 와 같은 방식).
 - opaque(role,q,x,y): 프로파일 N,S,W,E(바깥쪽에서 잰 투명 깊이 ≤8), 모서리 반지름 R, 안쪽 홈 반지름 RN.
 - 색은 손으로 정한 글자표만 쓴다. 팔레트 밖 색 없음.
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '../../../../..'))
sys.path.insert(0, os.path.join(ROOT, 'scripts/content/atlas-pick'))
from pxg_emit import emit

T = 16
AT = {'isolated': (0, 0), 'body_alt': (1, 0), 'inner': (2, 0), 'corner_nw': (0, 1), 'edge_n': (1, 1), 'corner_ne': (2, 1),
      'edge_w': (0, 2), 'body': (1, 2), 'edge_e': (2, 2), 'corner_sw': (0, 3), 'edge_s': (1, 3), 'corner_se': (2, 3)}
CONFIG = {
    'body': [[1, 1, 1], [1, 1, 1], [1, 1, 1]],
    'edge_n': [[0, 0, 0], [1, 1, 1], [1, 1, 1]], 'edge_s': [[1, 1, 1], [1, 1, 1], [0, 0, 0]],
    'edge_w': [[0, 1, 1], [0, 1, 1], [0, 1, 1]], 'edge_e': [[1, 1, 0], [1, 1, 0], [1, 1, 0]],
    'corner_nw': [[0, 0, 0], [0, 1, 1], [0, 1, 1]], 'corner_ne': [[0, 0, 0], [1, 1, 0], [1, 1, 0]],
    'corner_sw': [[0, 1, 1], [0, 1, 1], [0, 0, 0]], 'corner_se': [[1, 1, 0], [1, 1, 0], [0, 0, 0]],
    'inner': [[0, 1, 0], [1, 1, 1], [0, 1, 0]],
}

def make_opaque(prof):
    N, S, W, E = prof['N'], prof['S'], prof['W'], prof['E']
    R = prof.get('R', 7.0); RN = prof.get('RN', 3.0)
    def opaque(role, q, x, y):
        lx, ly = x % 8, y % 8
        if role.startswith('edge_'):
            s = role[-1]
            if s == 'n': return y >= N[x]
            if s == 's': return (15 - y) >= S[x]
            if s == 'w': return x >= W[y]
            return (15 - x) >= E[y]
        if role.startswith('corner_'):
            fx = lx if q[1] == 'w' else 7 - lx; fy = ly if q[0] == 'n' else 7 - ly   # 바깥 꼭짓점에서의 거리
            # 안쪽 꼭짓점(8,8)-쪽 기준 원: 중심 (8,8) 반지름 R 안이 불투명
            ex = 7 - fx; ey = 7 - fy     # 사분면 안쪽 꼭짓점에서의 거리
            return (ex + 0.5) ** 2 + (ey + 0.5) ** 2 <= R * R
        if role == 'inner':
            fx = lx if q[1] == 'w' else 7 - lx; fy = ly if q[0] == 'n' else 7 - ly
            return (fx + 0.5) ** 2 + (fy + 0.5) ** 2 > RN * RN
        return True
    return opaque

def compose(cfg, opaque):
    import numpy as np
    on = lambda x, y: cfg[y][x] == 1 if 0 <= x < 3 and 0 <= y < 3 else False
    M = np.zeros((48, 48), bool)
    Q = {'nw': ((0, -1), (-1, 0), (-1, -1), 0, 0), 'ne': ((0, -1), (1, 0), (1, -1), 8, 0),
         'sw': ((0, 1), (-1, 0), (-1, 1), 0, 8), 'se': ((0, 1), (1, 0), (1, 1), 8, 8)}
    for cy in range(3):
        for cx in range(3):
            if not on(cx, cy): continue
            for q, ((vx, vy), (hx, hy), (dx, dy), ox, oy) in Q.items():
                v, h, d = on(cx + vx, cy + vy), on(cx + hx, cy + hy), on(cx + dx, cy + dy)
                if not v and not h: r = 'corner_' + q
                elif not v: r = 'edge_n' if q[0] == 'n' else 'edge_s'
                elif not h: r = 'edge_w' if q[1] == 'w' else 'edge_e'
                elif not d: r = 'inner'
                else: r = 'body'
                for y in range(8):
                    for x in range(8):
                        M[cy * T + oy + y, cx * T + ox + x] = opaque(r, q, ox + x, oy + y)
    return M

def dist_map(M, cap=6):
    """불투명 화소의 4방향 걸음 거리(투명 이웃까지, 1 = 가장자리). 투명이면 0."""
    import numpy as np
    from scipy import ndimage
    d = ndimage.distance_transform_cdt(np.pad(M, 1, constant_values=False), metric='taxicab')[1:-1, 1:-1]
    return d

def build(opaque, paint, iso, alt=None, shadow=None):
    """paint(gx,gy,lx,ly,M,d) -> 픽셀. gx,gy = 마당 좌표(16..31), lx,ly = 칸 좌표.
    shadow(gx,gy,lx,ly,M,d) -> '~'/'-'/'%'/None (투명 화소 위)."""
    grid = [[None] * 48 for _ in range(64)]
    for role, (cx, cy) in AT.items():
        if role in ('isolated',):
            for y in range(16):
                for x in range(16): grid[cy * T + y][cx * T + x] = iso[y][x]
            continue
        cfg = CONFIG['body' if role == 'body_alt' else role]
        M = compose(cfg, opaque); d = dist_map(M)
        for ly in range(16):
            for lx in range(16):
                gx, gy = 16 + lx, 16 + ly
                if M[gy, gx]:
                    p = paint(gx, gy, lx, ly, M, d, role == 'body_alt')
                else:
                    p = shadow(gx, gy, lx, ly, M, d) if shadow else None
                grid[cy * T + ly][cx * T + lx] = p
    return grid

CH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
def to_pxg(grid, title):
    legend = {}; rows = []
    for r in grid:
        s = ''
        for p in r:
            if p is None: s += '.'
            elif isinstance(p, str): s += p
            else:
                if p not in legend: legend[p] = CH[len(legend)]
                s += legend[p]
        rows.append(s)
    return emit(rows, {v: k for k, v in legend.items()}, title=title)

# ---- 봉우리 stamping ----
def stamp_peaks(peaks, shader, size=48, origin=(16, 16), tiles=range(-1, 2)):
    """peaks: [{cx,top,hw:[..],H}] (칸 안 좌표). 주기 16 로 3x3 타일링해 top 순으로 그린 뒤 가운데 칸을 돌려준다."""
    canvas = {}
    allp = []
    for ty in tiles:
        for tx in tiles:
            for p in peaks:
                allp.append((p['top'] + ty * 16, p['cx'] + tx * 16, p))
    allp.sort(key=lambda t: (t[0] + len(t[2]['hw']), t[0]))
    for top, cx, p in allp:
        hw = p['hw']; H = len(hw)
        for r in range(H):
            for dx in range(-hw[r], hw[r] + 1):
                c = shader(p, dx, r, hw[r], H)
                if c is not None: canvas[(cx + dx, top + r)] = c
    return canvas
