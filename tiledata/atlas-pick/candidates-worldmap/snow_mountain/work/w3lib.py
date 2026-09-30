"""w3 작업자 공용 도우미 — 손으로 정한 봉우리 그림·프로파일로 3x4 묶음을 조립한다.
 픽셀은 (램프,단) 튜플. 마지막에 pxg_emit 으로 .pxg 에 옮긴다.  '.' = 투명, '~' '-' = 그림자 글자."""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '../../../../..'))
sys.path.insert(0, os.path.join(ROOT, 'scripts/content/atlas-pick'))
from pxg_emit import emit

CH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

def to_pxg(grid, title):
    """grid: 2차원 리스트, 원소 None(투명) / '~' '-' '%' / (램프,단)"""
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

class Torus:
    def __init__(self, n=16):
        self.n = n; self.g = [[None] * n for _ in range(n)]
    def put(self, x, y, p):
        self.g[y % self.n][x % self.n] = p
    def get(self, x, y): return self.g[y % self.n][x % self.n]

def blank(w, h): return [[None] * w for _ in range(h)]

# ---------- 봉우리 ----------
def peak(canvas_put, cx, top, hl, hr, ridge, pal, snow=None, creases=(), foot_shadow=None):
    """hl/hr/ridge: 줄마다 왼·오른 반폭, 능선 위치(cx 기준). pal: 글자→(램프,단).
    snow: 줄마다 눈 깊이(윗 줄들만) 리스트: snow[y] = 그 줄에서 눈이 차지하는 열 폭 비율 대신, 눈 경계 y(x) = snow_edge[dx]."""
    H = len(hl)
    for y in range(H):
        xl = cx - hl[y]; xr = cx + hr[y]; rg = cx + ridge[y]
        low = y >= int(H * 0.62)
        for x in range(xl, xr + 1):
            if x == xl: c = 'o'
            elif x == xr: c = 'O'
            elif x < rg - 1: c = 'M' if low else 'L'
            elif x == rg - 1: c = 'h'
            elif x == rg: c = 'H' if y > 1 else 'h'
            else: c = 'D' if low else 'R'
            canvas_put(x, top + y, pal[c])
    for (dx, dy, c) in creases:
        canvas_put(cx + dx, top + dy, pal[c])
    if snow:   # snow: {dx: 눈 밑 경계 dy(포함)} — 경계 위는 눈
        for y in range(H):
            xl = cx - hl[y]; xr = cx + hr[y]; rg = cx + ridge[y]
            for x in range(xl + 1, xr):
                lim = snow.get(x - cx)
                if lim is None or y > lim: continue
                if y == lim and (x + y) % 2 == 0: c = 'v'
                elif x < rg: c = 'W' if y < lim else 'v'
                else: c = 'V'
                if y == lim and c == 'W': c = 'v'
                canvas_put(x, top + y, pal[c])

# ---------- 묶음 조립 ----------
LIT = 'lit'; DRK = 'dark'

def make_masks(prof):
    """prof: dict N,S,W,E = 16 주기 투명 깊이 목록, R = 모서리 반지름, RN = 안쪽 모서리 반지름"""
    N, S, W, E = prof['N'], prof['S'], prof['W'], prof['E']
    R = prof.get('R', 7.5); RN = prof.get('RN', 4.5)
    def op_edge(role, x, y):
        if role == 'N': return y >= N[x % 16] if y < 16 else True
        if role == 'S': return y < 16 - S[x % 16] if y >= 0 else True
        if role == 'W': return x >= W[y % 16] if x < 16 else True
        if role == 'E': return x < 16 - E[y % 16] if x >= 0 else True
    def ext(role, x, y):
        """셀 밖(-2..17) 포함 불투명 여부"""
        if role == 'body': return True
        if role in ('N', 'S'):
            if role == 'N' and y < 0: return False
            if role == 'S' and y > 15: return False
            return op_edge(role, x, y)
        if role in ('W', 'E'):
            if role == 'W' and x < 0: return False
            if role == 'E' and x > 15: return False
            return op_edge(role, x, y)
        if role == 'inner':
            for cx_, cy_ in ((0, 0), (16, 0), (0, 16), (16, 16)):
                if (x + .5 - cx_) ** 2 + (y + .5 - cy_) ** 2 < RN ** 2: return False
            return True
        v = 'N' if role[0] == 'n' else 'S'; h = 'W' if role[1] == 'w' else 'E'
        # 바깥 방향 판정
        if v == 'N' and y < 0 or v == 'S' and y > 15 or h == 'W' and x < 0 or h == 'E' and x > 15: return False
        if not (op_edge(v, x, y) and op_edge(h, x, y)): return False
        qx = 0 if h == 'W' else 16; qy = 0 if v == 'N' else 16
        # 8x8 사분면 안쪽 반원: 바깥 모서리 쪽에서 반지름 R 원
        ccx = 8 if h == 'W' else 8; ccy = 8
        inq = (x < 8) if h == 'W' else (x >= 8)
        inqy = (y < 8) if v == 'N' else (y >= 8)
        if inq and inqy:
            return (x + .5 - 8) ** 2 + (y + .5 - 8) ** 2 <= R ** 2
        return True
    return ext

ROLE_KEY = {'corner_nw': 'nw', 'edge_n': 'N', 'corner_ne': 'ne', 'edge_w': 'W', 'body': 'body', 'edge_e': 'E',
            'corner_sw': 'sw', 'edge_s': 'S', 'corner_se': 'se', 'inner': 'inner'}

def rim_cell(role, tex, ext, rim, shadow):
    """tex(x,y) -> 픽셀. rim = {LIT:[d1,d2..], DRK:[d1,d2,d3..]} (튜플 또는 None=본체 그대로). shadow = 문자 규칙."""
    key = ROLE_KEY[role]
    op = lambda x, y: ext(key, x, y)
    cell = [[None] * 16 for _ in range(16)]
    # 거리·방향(BFS)
    dist = {}; face = {}
    for y in range(-1, 17):
        for x in range(-1, 17):
            pass
    frontier = []
    for y in range(16):
        for x in range(16):
            if not op(x, y): continue
            nb = [((0, -1), 'N'), ((-1, 0), 'W'), ((0, 1), 'S'), ((1, 0), 'E')]
            tr = [d for (dx, dy), d in nb if not op(x + dx, y + dy)]
            if tr:
                dist[(x, y)] = 1
                face[(x, y)] = LIT if all(d in 'NW' for d in tr) else DRK
                frontier.append((x, y))
    d = 1
    while frontier and d < 4:
        nxt = []
        for (x, y) in frontier:
            for dx, dy in ((0, -1), (-1, 0), (0, 1), (1, 0)):
                q = (x + dx, y + dy)
                if 0 <= q[0] < 16 and 0 <= q[1] < 16 and op(*q) and q not in dist:
                    dist[q] = d + 1; face[q] = face[(x, y)]; nxt.append(q)
        frontier = nxt; d += 1
    for y in range(16):
        for x in range(16):
            if op(x, y):
                p = tex(x, y)
                if (x, y) in dist:
                    lst = rim[face[(x, y)]]; i = dist[(x, y)] - 1
                    if i < len(lst) and lst[i] is not None: p = lst[i]
                cell[y][x] = p
    # 그림자
    if shadow:
        for y in range(16):
            for x in range(16):
                if op(x, y): continue
                s = None
                if y > 0 and op(x, y - 1): s = shadow.get('S')
                elif x > 0 and op(x - 1, y) and not (y > 0 and op(x, y - 1)): s = shadow.get('E')
                elif x > 0 and y > 0 and op(x - 1, y - 1): s = shadow.get('SE')
                elif y > 1 and op(x, y - 2) and shadow.get('S2'): s = shadow['S2']
                if s: cell[y][x] = s
    return cell

def assemble(bodyA, bodyB, iso, prof, rim, shadow=None, rimB=None):
    """bodyA/bodyB: 16x16 Torus 격자, iso: 16x16 격자(이미 완성). 반환 64행x48열."""
    ext = make_masks(prof)
    out = blank(48, 64)
    def put(cx, cy, cell):
        for y in range(16):
            for x in range(16): out[cy * 16 + y][cx * 16 + x] = cell[y][x]
    texA = lambda x, y: bodyA[y % 16][x % 16]
    layout = [['iso', 'alt', 'inner'], ['corner_nw', 'edge_n', 'corner_ne'], ['edge_w', 'body', 'edge_e'], ['corner_sw', 'edge_s', 'corner_se']]
    for cy in range(4):
        for cx in range(3):
            r = layout[cy][cx]
            if r == 'iso': put(cx, cy, iso)
            elif r == 'alt': put(cx, cy, [[bodyB[y][x] for x in range(16)] for y in range(16)])
            elif r == 'body': put(cx, cy, [[bodyA[y][x] for x in range(16)] for y in range(16)])
            else: put(cx, cy, rim_cell(r, texA, ext, rim, shadow))
    return out
