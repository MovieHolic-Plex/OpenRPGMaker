#!/usr/bin/env python3
"""jp 숲 r3 — 붓으로 칠하는 숲 오토타일(위치 위상 8방 오토타일). 2026-10-20.

구조(버들항 숲 역설계, tiledata/jp-city/forest-r3/SPEC.md):
  숲은 한 그루 수관들이 겹친 덩이다. 이 파일은 세계 좌표 위의 주기적인 「수관 밭」(종마다 6×4칸 주기, 수관 4그루 이상)을 만들고,
  수관을 반지름 ≤7px 잎 덩이(clump)로 쪼갠다. 칸 하나의 그림은 다음 규칙으로만 정한다:
    1) 잎 덩이는 그 원판이 닿는 칸이 모두 숲일 때만 그린다(덩이는 자기 칸 위로는 넘지 않고 아래·옆으로만 넘친다).
       → 원판이 닿는 칸은 모두 둘레 3×3 안이라 칸 그림은 8방 마스크(정규화 47)와 (x mod 6, y mod 4) 만으로 정해진다 = 오토타일.
    2) 남쪽 가장자리 칸(아래가 숲 아님)은 세계 x 의 물결 선 아래를 줄기 띠로 바꾼다(줄기·덤불·고사리·그늘 점). 줄기·덤불은 칸 안에서 끝난다.
    3) 숲 속 깊은 곳(바깥 칸에서 4px 이상)은 잎 사이 틈을 짙은 숲 그늘로 메운다. 가장자리 틈은 비워 둔다(둥근 윤곽).
  가장자리 계단이 생기지 않는 까닭: 윤곽은 칸 선이 아니라 둥근 잎 덩이 원판들이 만든다.

  python3 forest_r3.py [OUT_DIR]      # 종마다 시트·장면 미리보기·붓 시험 GIF
"""
import hashlib
import json
import math
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
T = 16
PW, PH = 6, 4                     # 위상 주기(칸)
N, E, S, W, NE, SE, SW, NW = 1, 2, 4, 8, 16, 32, 64, 128


def canon(m):
    c = m & 15
    if (m & NE) and (m & N) and (m & E): c |= NE
    if (m & SE) and (m & S) and (m & E): c |= SE
    if (m & SW) and (m & S) and (m & W): c |= SW
    if (m & NW) and (m & N) and (m & W): c |= NW
    return c


CANON = sorted({canon(m) for m in range(256)})
assert len(CANON) == 47
OFFS = {N: (0, -1), E: (1, 0), S: (0, 1), W: (-1, 0), NE: (1, -1), SE: (1, 1), SW: (-1, 1), NW: (-1, -1)}


def mask_grid(m):
    """정규화 마스크 → 3×3 bool(가운데 = 숲)."""
    g = np.zeros((3, 3), bool); g[1, 1] = True
    for bit, (dx, dy) in OFFS.items():
        if m & bit: g[1 + dy, 1 + dx] = True
    return g


def h32(*a):
    v = hashlib.blake2b(repr(a).encode(), digest_size=4).digest()
    return int.from_bytes(v, 'little')


def hf(*a):
    return h32(*a) / 4294967296.0


# ---------------------------------------------------------------- 팔레트(계약 잔 램프)
_C = json.load(open(os.path.join(ROOT, 'tiledata', 'jp-city', 'palette-contract.json'), encoding='utf-8'))
_R = _C['ramps']


def _rgb(h):
    return (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16))


def ramp(name):
    r = _R[name]
    return [_rgb(h) for h in (r['steps'] if isinstance(r, dict) else r)]


def fine(mat, sid):
    a, b = ramp(f'{mat}/{sid}1'), ramp(f'{mat}/{sid}2')
    out = []
    for i in range(10): out += [a[i], b[i]]
    return out


PAL = {
    'keyaki_a': fine('pine_bamboo', 'keyaki_a'), 'keyaki_b': fine('pine_bamboo', 'keyaki_b'),
    'sugi': fine('pine_bamboo', 'sugi'), 'pine': fine('pine_bamboo', 'pine'), 'bamboo': fine('pine_bamboo', 'bamboo_leaf'),
    'sakura': fine('sakura_petal', 'fine'), 'maple': fine('autumn_maple', 'fine'),
    'hi': ramp('pine_bamboo/leafhi'), 'shade': ramp('pine_bamboo/shade'), 'floor': ramp('pine_bamboo/floor'),
    'culm': ramp('pine_bamboo/culm2'), 'bark': ramp('aged_cedar/bark2'), 'sugibark': ramp('aged_cedar/sugibark'),
    'sakurabark': ramp('aged_cedar/sakurabark'),
    # 잔디 위 그늘(jp 잔디 (73,128,76) 보다 1~3단 어둡게): pine_bamboo+ 의 3·4·5 단
    'gsh': [ramp('pine_bamboo+')[i] for i in (3, 4, 5)],
}

# ---------------------------------------------------------------- 수관 밭(세계 좌표, 주기 PW×PH 칸)
# 수관: (cx, cy, rw, rh, 모양, 색 계열). 모양 dome(활엽) · cone(삼나무) · pads(소나무) · fan(대숲)
SPECIES = {
    # 활엽(느티·잡목): 폭 3칸 돔, 벽돌 엇갈림 — 윗줄 2그루, 아랫줄 2그루(반 칸 비껴), 청록·황록 번갈아
    'bl': dict(ko='활엽 혼효림(느티나무·잡목)', crowns=[(13, 16, 28, 24, 'dome', 'keyaki_a'), (57, 8, 20, 17, 'dome', 'keyaki_a'), (85, 21, 17, 15, 'dome', 'keyaki_a'),
                                                (36, 45, 24, 20, 'dome', 'keyaki_a'), (79, 50, 29, 24, 'dome', 'keyaki_a'), (4, 54, 14, 12, 'dome', 'keyaki_a')],
               style=[(0.07, 0.15), (-0.10, 0.05), (0.02, 0.55), (0.04, 0.35), (-0.04, 0.22), (-0.13, 0.0)],
               trunk='bark', floor_tint=None),
    'sk': dict(ko='벚나무 숲', crowns=None, fam='sakura', trunk='sakurabark'),
    'mp': dict(ko='단풍 숲', crowns=None, fam='maple', trunk='bark'),
    # 삼나무: 폭 2칸 원뿔, 촘촘(16px 간격 반 엇갈림)
    'sg': dict(ko='삼나무 숲', crowns=[(10, 24, 15, 30, 'cone', 'sugi'), (42, 20, 14, 29, 'cone', 'sugi'), (26, 54, 15, 31, 'cone', 'sugi'),
                                  (57, 52, 13, 28, 'cone', 'sugi')], trunk='sugibark'),
    'bb': dict(ko='대숲', crowns=[(14, 18, 17, 18, 'fan', 'bamboo'), (46, 14, 16, 17, 'fan', 'bamboo'), (0, 48, 17, 18, 'fan', 'bamboo'),
                                (32, 50, 16, 18, 'fan', 'bamboo')], trunk='culm'),
    # 소나무 숲(신사·해안): 납작한 구름 잎판, 수관 사이가 성기다
    'pn': dict(ko='소나무 숲', crowns=[(14, 14, 22, 15, 'pads', 'pine'), (48, 12, 18, 13, 'pads', 'pine'),
                                   (30, 44, 23, 16, 'pads', 'pine'), (60, 50, 17, 12, 'pads', 'pine')], trunk='bark'),
}
DEEP = dict(bl='keyaki_a', sk='sakura', mp='maple', sg='sugi', bb='bamboo', pn='pine')
KINDS = ['bl', 'bb', 'sk', 'sg', 'mp', 'pn']
BROAD64 = [(13, 16, 26, 22, 'dome'), (46, 9, 21, 18, 'dome'), (30, 45, 25, 21, 'dome'), (60, 50, 21, 18, 'dome'), (3, 53, 13, 11, 'dome')]
for _k in ('sk', 'mp'):   # 벚·단풍: 4×4 주기의 활엽 배치, 색만 다르다
    SPECIES[_k]['crowns'] = [c + (SPECIES[_k]['fam'],) for c in BROAD64]
    SPECIES[_k]['style'] = [(0.07, 0), (-0.08, 0), (0.03, 0), (-0.03, 0), (-0.12, 0)]
PERIOD = (PW * T, PH * T)
# 종마다 위상 주기(칸): 활엽만 6×4, 나머지는 4×4 — jp 시트 4096px 높이 안에 6종(1128 + 5×752 칸)이 들어가도록
for _k in SPECIES: SPECIES[_k].setdefault('period', (6, 4) if _k == 'bl' else (4, 4))


def per(sp):
    """(주기 폭 칸, 주기 높이 칸)."""
    return SPECIES[sp]['period']


def perpx(sp):
    w, h = per(sp)
    return (w * T, h * T)


def _crown_clumps(sp, ci, cx, cy, rw, rh, shape, seed):
    """수관 하나 → 잎 덩이 [(x, y, r)] (수관 중심 기준 상대 좌표)."""
    out = []
    rnd = lambda k: hf(sp, ci, seed, k)
    if shape in ('dome', 'pads'):
        # 버들항 수관: 6~10px 덩이 12~16개가 둥근 돔(위가 넓은 반달꼴)으로. 가장자리 고리 + 속
        n_ring = 14
        for k in range(n_ring):
            a = math.pi * 2 * k / n_ring + rnd(('a', k)) * 0.35
            rr = 0.80 + rnd(('rr', k)) * 0.16
            x = math.cos(a) * (rw - 6) * rr
            y = math.sin(a) * (rh - 6) * rr - (1.5 if math.sin(a) < 0 else 0)
            out.append((x, y, 6.0 + rnd(('r', k)) * 1.0))
        for k in range(10):
            a = rnd(('ia', k)) * math.pi * 2; d = math.sqrt(rnd(('id', k))) * 0.62
            out.append((math.cos(a) * (rw - 6) * d, math.sin(a) * (rh - 6) * d, 6.4 + rnd(('ir', k)) * 0.6))
        if shape == 'pads':   # 소나무: 납작한 잎판 세 장(위·왼아래·오른아래)
            out = []
            for k, (px, py, w) in enumerate([(-2, -10, 16), (-11, 4, 12), (9, 2, 13), (0, 12, 10)]):
                m = max(2, int(w / 5))
                for j in range(m):
                    x = px - w + (2 * w) * (j + 0.5) / m + (rnd(('pj', k, j)) - 0.5) * 3
                    out.append((x, py + (rnd(('py', k, j)) - 0.5) * 2, 4.2 + rnd(('pr', k, j)) * 1.2))
    elif shape == 'cone':
        # 삼나무: 꼭대기에서 아래로 층층, 층마다 넓어진다
        tiers = 7
        for t in range(tiers):
            f = (t + 0.5) / tiers
            y = -rh + 2 * rh * f
            half = 2 + (rw - 3) * f
            m = 1 + int(half / 5)
            for j in range(m):
                x = -half + (2 * half) * (j + 0.5) / m + (rnd(('cj', t, j)) - 0.5) * 2
                out.append((x, y + (rnd(('cy', t, j)) - 0.5) * 1.5, 3.4 + f * 2.0 + rnd(('cr', t, j)) * 0.8))
    elif shape == 'fan':
        # 대숲 잎 덩이: 작은 덩이를 성기게, 깃털 획은 그릴 때 덧댄다
        for k in range(14):
            a = rnd(('fa', k)) * math.pi * 2; d = math.sqrt(rnd(('fd', k)))
            out.append((math.cos(a) * rw * d * 0.85, math.sin(a) * rh * d * 0.8, 4.0 + rnd(('fr', k)) * 1.8))
    return out


def world_clumps(sp, seed=0):
    """주기 상자 안 잎 덩이 목록: dict(x, y, r, crown, fam, shape, cx, cy, rw, rh, order)."""
    out = []
    for ci, (cx, cy, rw, rh, shape, fam) in enumerate(SPECIES[sp]['crowns']):
        for k, (x, y, r) in enumerate(_crown_clumps(sp, ci, cx, cy, rw, rh, shape, seed)):
            r = min(r, 7.0)
            wx, wy = cx + x, cy + y
            out.append(dict(x=wx, y=wy, r=r, crown=ci, fam=fam, shape=shape, cx=cx, cy=cy, rw=rw, rh=rh, k=k))
    return out


_WC = {}


def clumps_near(sp, x0, y0, x1, y1):
    """세계 사각형 [x0,x1)×[y0,y1) 에 닿는 덩이(주기 복제)."""
    if sp not in _WC: _WC[sp] = world_clumps(sp)
    base = _WC[sp]
    pw, ph = perpx(sp)
    res = []
    for i in range(math.floor((x0 - 8) / pw) - 1, math.floor((x1 + 8) / pw) + 2):
        for j in range(math.floor((y0 - 8) / ph) - 1, math.floor((y1 + 8) / ph) + 2):
            for c in base:
                x, y = c['x'] + i * pw, c['y'] + j * ph
                if x + c['r'] < x0 or x - c['r'] >= x1 or y + c['r'] < y0 or y - c['r'] >= y1: continue
                d = dict(c); d['x'] = x; d['y'] = y; d['cx'] = c['cx'] + i * pw; d['cy'] = c['cy'] + j * ph; d['tile'] = (i, j)
                res.append(d)
    # 뒤(위) 수관 먼저, 같은 수관 안은 위 덩이 먼저 — 앞(아래) 수관이 덮는다
    res.sort(key=lambda d: (d['cy'] + d['rh'] * 0.6, d['y']))
    return res


# ---------------------------------------------------------------- 칸 하나 그리기
def _disk_cells(c, gx, gy):
    """덩이 원판이 닿는 칸들(세계 칸 좌표)."""
    x, y, r = c['x'], c['y'], c['r']
    # 화소 중심(k+0.5)이 원판 안일 수 있는 열·행 범위(보수적)
    xs = range(math.floor(math.ceil(x - r - 0.5) / T), math.floor(math.floor(x + r - 0.5) / T) + 1)
    ys = range(math.floor(math.ceil(y - r - 0.5) / T), math.floor(math.floor(y + r - 0.5) / T) + 1)
    return [(i, j) for i in xs for j in ys]


def _eroded(c, cells, inside):
    """가장자리 침식: 원판이 닿는 칸 모두의 s 쪽 이웃이 숲 밖이고 덩이가 그 변에서 7px 안이면 해시로 뺀다(깊은 홈).
    s 쪽 이웃이 원판 칸 집합 안에 있으면 바로 거짓 — 그래서 원판 칸을 그리는 모든 칸이 같은 답을 낸다."""
    cs = set(cells)
    for s, (dx, dy) in ((N, (0, -1)), (E, (1, 0)), (W, (-1, 0))):
        nb = [(i + dx, j + dy) for (i, j) in cells]
        if any(n in cs for n in nb): continue
        if any(inside(*n) for n in nb): continue
        if s == N: near = c['y'] - c['r'] - min(j for _, j in cells) * T < 7
        elif s == E: near = (max(i for i, _ in cells) + 1) * T - (c['x'] + c['r']) < 7
        else: near = c['x'] - c['r'] - min(i for i, _ in cells) * T < 7
        if near and hf('ero', c['crown'], c['k'], s) < 0.5: return True
    return False


def _resolve(c, cells, inside):
    """원판 칸이 모두 숲이면 그대로. 아니면 숲인 칸들 안으로 들어가도록 최소로 민다(위·아래·옆, 반지름 0.8배).
    민 덩이는 원래 칸 집합의 부분집합 안에 있으므로 3×3 안에서 같은 답이 나온다."""
    if all(inside(i, j) for (i, j) in cells): return c
    ok = {(i, j) for (i, j) in cells if inside(i, j)}
    if not ok: return None
    r = max(4.2, c['r'] * 0.8)
    i0, i1 = min(i for i, _ in cells), max(i for i, _ in cells)
    j0, j1 = min(j for _, j in cells), max(j for _, j in cells)
    jit = hf('jit', c['crown'], c['k'])
    sl = T - 2 * r - 0.04
    xs = [c['x'], (i0 + 1) * T - r - 0.02 - sl * jit, i1 * T + r + 0.02 + sl * jit]
    # 아래 줄로 밀 때(북쪽이 빈 칸) 수관 가운데는 덜, 가장자리는 더 내려 돔 윤곽을 남긴다
    dome = min(1.0, abs(c['x'] - c['cx']) / max(1.0, c['rw'])) ** 1.5
    ys = [c['y'], (j0 + 1) * T - r - 0.02, j1 * T + r + 0.02 + sl * min(1.0, 0.7 * dome + 0.3 * jit)]
    best = None
    for nx in xs:
        for ny in ys:
            d = dict(c); d['x'] = nx; d['y'] = ny; d['r'] = r
            nc = _disk_cells(d, 0, 0)
            if not set(nc) <= ok: continue
            cost = abs(nx - c['x']) + abs(ny - c['y'])
            if best is None or cost < best[0]: best = (cost, d)
    return best[1] if best else None


def _noise(wx, wy, salt):
    return hf('n', wx, wy, salt)


_LEAF = {}
_LGRAD = {}


def leaf(wx, wy, sp, size=3):
    """잎 결: 주기 상자(96×64) 위 원환 보로노이(칸 약 size px). (잎 값 -1~1, 경계 0~1, 잎 id) — 버들항 수관의 2~4px 잎 무리.
    원환이라 주기 경계에서도 이음매가 없다."""
    key = (wx, wy, sp, size)
    if key in _LEAF: return _LEAF[key]
    pw, ph = perpx(sp)
    nx, ny = max(1, round(pw / size)), max(1, round(ph / size))
    sx, sy = pw / nx, ph / ny
    gx, gy = math.floor(wx / sx), math.floor(wy / sy)
    best = (1e9, 0, 0); second = 1e9
    for j in (-1, 0, 1):
        for i in (-1, 0, 1):
            cx, cy = gx + i, gy + j
            hx, hy = cx % nx, cy % ny
            px = (cx + hf('lx', hx, hy, sp, size)) * sx
            py = (cy + hf('ly', hx, hy, sp, size)) * sy
            d = (wx + 0.5 - px) ** 2 + (wy + 0.5 - py) ** 2
            if d < best[0]: second = best[0]; best = (d, hx, hy); bp = (px, py)
            elif d < second: second = d
    _LGRAD[key] = max(-1.0, min(1.0, (-(wx + 0.5 - bp[0]) * 0.55 - (wy + 0.5 - bp[1]) * 0.8) / (0.75 * size)))
    val = hf('lv', best[1], best[2], sp, size) * 2 - 1
    edge = 1.0 - min(1.0, (math.sqrt(second) - math.sqrt(best[0])) / 1.2)
    _LEAF[key] = (val, edge, best[1], best[2])
    return _LEAF[key]


def render_cell(sp, mask, cx, cy):
    """칸 (cx, cy)(세계 칸 좌표, 위상은 cx%PW, cy%PH 로 충분) + 정규화 마스크 → 16×16 RGBA."""
    g = mask_grid(mask)

    def inside(i, j):
        di, dj = i - cx, j - cy
        if abs(di) > 1 or abs(dj) > 1: raise AssertionError('3×3 밖 칸을 물었다')
        return bool(g[1 + dj, 1 + di])

    X0, Y0 = cx * T, cy * T
    out = np.zeros((T, T, 4), np.uint8)
    lev = np.full((T, T), -1, int)        # 램프 단(덩이)
    fam = np.empty((T, T), object)
    own = np.full((T, T), -1, int)
    spec = SPECIES[sp]
    s_edge = not g[2, 1]
    n_edge = not g[0, 1]
    # 3) 깊은 속 그늘: 바깥 칸까지 거리 ≥ 4px 인 화소
    ys, xs = np.mgrid[0:T, 0:T]
    dist = np.full((T, T), 99.0)
    for dj in (-1, 0, 1):
        for di in (-1, 0, 1):
            if g[1 + dj, 1 + di]: continue
            # 칸 (di,dj) 사각형까지 거리
            ax0, ax1 = di * T, di * T + T - 1
            ay0, ay1 = dj * T, dj * T + T - 1
            dx = np.maximum(np.maximum(ax0 - xs, xs - ax1), 0)
            dy = np.maximum(np.maximum(ay0 - ys, ys - ay1), 0)
            dist = np.minimum(dist, np.sqrt(dx * dx + dy * dy))
    wn = np.array([[hf('bn', X0 + x, Y0 + y) for x in range(T)] for y in range(T)])
    base = dist >= 5.0 + 3.0 * wn
    # 1) 잎 덩이: 원판이 바깥 칸에 걸치면 안쪽으로 밀고(반지름 0.8배) 해시만큼 더 밀어 윤곽을 들쭉날쭉하게 한다
    for c0 in clumps_near(sp, X0 - T, Y0 - T, X0 + 2 * T, Y0 + 2 * T):
        cells0 = _disk_cells(c0, cx, cy)
        if (cx, cy) not in cells0: continue
        c = _resolve(c0, cells0, inside)
        if c is None: continue
        cells = _disk_cells(c, cx, cy)
        if (cx, cy) not in cells: continue
        if _eroded(c, cells, inside): continue
        x, y, r = c['x'] - X0, c['y'] - Y0, c['r']
        d2 = ((xs + 0.5 - x) ** 2 + (ys + 0.5 - y) ** 2) / (r * r)
        hit = d2 <= 1.0
        if not hit.any(): continue
        nx = (xs + 0.5 - x) / r; ny = (ys + 0.5 - y) / r
        nz = np.sqrt(np.clip(1 - d2, 0, 1))
        lam = np.clip(-0.50 * nx - 0.62 * ny + 0.60 * nz, -1, 1)
        # 수관 단위 명암(버들항: 덩이마다 공 명암이 아니라 수관 하나가 왼쪽 위 빛 + 잎 무리 결)
        ncx = (X0 + xs + 0.5 - c['cx']) / c['rw']; ncy = (Y0 + ys + 0.5 - c['cy']) / c['rh']
        dc = np.sqrt(ncx * ncx + ncy * ncy)
        sty = SPECIES[sp].get('style')
        coff, mixf = sty[c['crown']] if sty else ((hf('co', sp, c['crown']) - 0.5) * 0.18, 0.12 + 0.40 * hf('mix', sp, c['crown']))
        crown_v = 0.68 - 0.22 * ncy - 0.10 * ncx + coff
        if c['shape'] == 'cone':
            crown_v = 0.52 - 0.14 * ncy - 0.22 * ncx
        rim_c = np.clip((dc - 0.74) / 0.24, 0, 1) * np.clip(0.25 + 0.5 * ncx + 0.8 * ncy, 0, 1)
        v = crown_v + 0.06 * (lam - 0.35) - 0.30 * rim_c
        dd = np.sqrt(d2)
        size = 3 if c['shape'] != 'cone' else 2
        for yy, xx in zip(*np.nonzero(hit)):
            wx, wy = X0 + xx, Y0 + yy
            lv, le, lx, ly = leaf(wx, wy, sp, size)
            gr = _LGRAD[(wx, wy, sp, size)]
            # 바깥 둘레 잎 무리 경계는 파내 톱니 윤곽(잎 하나 빠진 홈)
            if dd[yy, xx] > 0.78 and le > 0.55 and hf('notch', lx, ly, sp) < 0.55: continue
            nv = v[yy, xx] + 0.17 * lv + 0.20 * gr - 0.42 * le * (1.0 if gr < 0.2 else 0.3)
            L = int(np.clip(round(nv * 19), 0, 19))
            # 반짝임: 잎 무리 하나의 왼쪽 위 2~3화소만(낱점 흩뿌림 아님)
            if c['fam'].startswith('keyaki') and v[yy, xx] + 0.12 * lv > 0.60 and gr > 0.55 and le < 0.5 and hf('hl', lx, ly, sp) < 0.55:
                L = 100 + (1 if gr > 0.8 else 0)
            # 가지 V: 수관 속(가운데 70%)에 수관마다 3~4개, 잎 위로 비치는 갈색 삼각
            if c['shape'] in ('dome', 'pads') and dc[yy, xx] < 0.72:
                for b in range(2 + int(hf('bvn', sp, c['crown']) * 2)):
                    bx = c['cx'] + (hf('bvx', sp, c['crown'], b) - 0.5) * c['rw'] * 1.1
                    by = c['cy'] + (hf('bvy', sp, c['crown'], b) - 0.5) * c['rh'] * 1.0
                    u, w_ = wx - math.floor(bx), wy - math.floor(by)
                    if 0 <= w_ <= 2 and abs(u - 1) <= 2 - w_ and (w_ > 0 or u in (0, 2)):
                        L = 200 if u <= 1 else 201
            lev[yy, xx] = L
            fam[yy, xx] = c['fam']
            # 잎 무리 단위로 따뜻한 잎(황록)을 섞는다 — 수관마다 비율이 달라 두 계열로 갈리지 않는다
            if c['fam'] == 'keyaki_a' and L < 100 and lv > -0.2 and hf('fm', lx, ly, sp, c['crown']) < mixf:
                fam[yy, xx] = 'keyaki_b'; lev[yy, xx] = max(0, L - 2)
            own[yy, xx] = c['crown'] * 1000 + c['k']
    pal_hi = PAL['hi']
    # 2) 속 그늘 채움 + 가지
    trunk_r = PAL[spec['trunk']] if spec['trunk'] in PAL else PAL['bark']
    for yy in range(T):
        for xx in range(T):
            if lev[yy, xx] >= 0 or not base[yy, xx]: continue
            # 속 그늘은 수관 아래에만: 바로 위 3줄 안에 잎이 있거나(칸 위로 넘어가면 위 칸이 숲일 때) 해야 한다
            ok = dist[yy, xx] >= 9.0 + 3.0 * wn[yy, xx]
            for k in (1, 2, 3):
                if ok: break
                if yy - k < 0: ok = bool(g[0, 1]); break
                if lev[yy - k, xx] >= 0: ok = True; break
            if not ok: continue
            # 가지 V: 세계 해시로 드문드문
            wx, wy = X0 + xx, Y0 + yy
            t = hf('tw', (wx // 8) % (perpx(sp)[0] // 8), (wy // 8) % (perpx(sp)[1] // 8), sp)
            u, v8 = wx % 8, wy % 8
            if t < 0.30 and sp in ('bl', 'mp', 'sk', 'mx', 'mh') and 2 <= v8 <= 5 and (abs(u - 4) == 5 - v8 or (u == 4 and v8 >= 4)):
                out[yy, xx, :3] = trunk_r[1 + (1 if u < 4 else 0)]; out[yy, xx, 3] = 255; continue
            # 속 틈 = 깊은 그늘 잎(검은 구멍이 아니라 아주 어두운 잎 결)
            lv, le, _, _ = leaf(wx, wy, sp, 3)
            deep = PAL[DEEP[sp]]
            out[yy, xx, :3] = deep[int(np.clip(round(2.2 + 1.6 * lv - 2.0 * le), 0, 5))]; out[yy, xx, 3] = 255
    for yy in range(T):
        for xx in range(T):
            L = lev[yy, xx]
            if L < 0: continue
            if L >= 200: out[yy, xx, :3] = trunk_r[2 if L == 200 else 0]
            elif L >= 100: out[yy, xx, :3] = pal_hi[L - 100]
            else: out[yy, xx, :3] = PAL[fam[yy, xx]][L]
            out[yy, xx, 3] = 255
    # 대숲: 잎 덩이 위 깃털 획(세계 좌표 선분)
    if sp == 'bb':
        _bamboo_strokes(out, lev, X0, Y0)
    # 가장자리 깎기: 북쪽은 수관 돔 하늘선, 동·서쪽은 수관 줄의 둥근 옆선(세계 좌표 함수라 이웃 칸과 이어진다)
    _carve(out, lev, sp, cx, cy, g)
    _edge_rim(out, lev, fam, g)
    # 윤곽: 칸 안 투명 화소나 바깥 칸에 닿은 화소를 한두 단 어둡게(오른쪽·아래쪽 면은 더)
    _outline(out, lev, fam, g)
    # 4) 남쪽 줄기 띠
    if s_edge and n_edge:
        out[:] = 0
        _hedge(out, sp, cx, cy, g)
        return out
    if not g[1, 0] and not g[1, 2]:
        out[:] = 0
        _narrow(out, sp, cx, cy, g, s_edge, n_edge)
        return out
    if s_edge:
        _band(out, sp, cx, cy, g, n_edge, lev, fam)
    return out


def _narrow(out, sp, cx, cy, g, s_edge, n_edge):
    """세로 1칸 띠: 칸마다 작은 둥근 나무 한 그루(위 칸 나무와 겹친다), 맨 아래 칸은 줄기."""
    X0, Y0 = cx * T, cy * T
    fam = HEDGE_PAL[sp] if sp not in ('bl', 'sk', 'mh') else ('sakura' if sp == 'sk' else 'keyaki_a')
    P = PAL[fam]
    trunk = PAL[SPECIES[sp]['trunk']]
    ccx = 8 + (hf('nwx', cy % per(sp)[1], sp) - 0.5) * 2
    ccy, r = (6.5, 6.6) if s_edge else (8.0, 7.6)
    if n_edge: ccy += 1
    if s_edge and sp != 'bb':
        for y in range(10, 15):
            for x in range(7, 10):
                out[y, x, :3] = trunk[3 if x == 7 else 2 if x == 8 else 1]; out[y, x, 3] = 255
        for x in range(4, 13):
            if not out[14, x, 3]: out[14, x, :3] = PAL['gsh'][1]; out[14, x, 3] = 255
            if 5 <= x <= 11 and not out[15, x, 3]: out[15, x, :3] = PAL['gsh'][2]; out[15, x, 3] = 255
    lev = np.full((T, T), -1, int)
    for y in range(T):
        for x in range(T):
            dx, dy = x + 0.5 - ccx, y + 0.5 - ccy
            d = math.hypot(dx / r, dy / (r * (1.05 if s_edge or n_edge else 1.30)))
            if d > 1: continue
            lv, le, lx, ly = leaf(X0 + x, Y0 + y, sp, 3)
            gr = _LGRAD[(X0 + x, Y0 + y, sp, 3)]
            if d > 0.8 and le > 0.55 and hf('nn', lx, ly) < 0.55: continue
            rim = max(0.0, (d - 0.72) / 0.28) * max(0.0, min(1.0, 0.25 + 0.5 * dx / r + 0.8 * dy / r))
            v = 0.62 - 0.18 * dy / r - 0.10 * dx / r - 0.26 * rim + 0.13 * lv + 0.13 * gr - 0.28 * le * (1.0 if gr < 0.3 else 0.35)
            lev[y, x] = int(np.clip(round(v * 19), 0, 19))
    for y in range(T):
        for x in range(T):
            L = lev[y, x]
            if L < 0: continue
            exp = any(not (0 <= x + a < T and 0 <= y + b < T) or lev[y + b, x + a] < 0 for a, b in ((1, 0), (0, 1)))
            if exp and not (y + 1 >= T and g[2, 1]): L = max(0, min(L - 4, 3))
            out[y, x, :3] = P[L]; out[y, x, 3] = 255


HEDGE_PAL = dict(bl='keyaki_a', sk='keyaki_a', mp='maple', sg='sugi', bb='bamboo', pn='pine')


def _hedge(out, sp, cx, cy, g):
    """1줄 띠(북·남 모두 숲 아님): 키 낮은 관목 줄. 관목은 세계 x 로 놓여 이웃 1줄 칸과 이어지고, 옆이 숲이 아니면 그 변에서 둥글게 끝난다."""
    X0, Y0 = cx * T, cy * T
    P = PAL[HEDGE_PAL[sp]]
    lev = np.full((T, T), -1, int)
    shrubs = []
    for k in range(math.floor((X0 - 24) / 8), math.floor((X0 + 40) / 8) + 1):
        kk = k % (perpx(sp)[0] // 8)
        bx = k * 8 + hf('hx', kk, sp) * 4
        br = 5.6 + hf('hr', kk, sp) * 2.6
        by = 15.2 - br + hf('hy', kk, sp) * 1.2
        shrubs.append((by, bx, br, k))
    shrubs.sort()
    for by, bx, br, k in shrubs:
        lx0 = bx - br - X0; lx1 = bx + br - X0
        if lx0 < 0 and not g[1, 0]: continue          # 서쪽이 숲 아니면 넘치는 관목은 빼고
        if lx1 > T and not g[1, 2]: continue
        for y in range(T):
            for x in range(T):
                dx, dy = x + 0.5 - (bx - X0), y + 0.5 - by
                d = math.hypot(dx, dy * 1.15) / br
                if d > 1: continue
                lv, le, llx, lly = leaf(X0 + x, Y0 + y, sp, 3)
                if d > 0.8 and le > 0.55 and hf('hn', llx, lly) < 0.5: continue
                nz = math.sqrt(max(0, 1 - d * d))
                lam = -0.5 * dx / br - 0.62 * dy / br + 0.6 * nz
                v = 0.52 + 0.30 * (lam - 0.3) + 0.15 * lv - 0.25 * le + (hf('hv', k % (perpx(sp)[0] // 8), sp) - 0.5) * 0.1
                lev[y, x] = int(np.clip(round(v * 19), 1, 19))
    # 가장자리 짙게, 밑에 그늘 한 줄
    for y in range(T):
        for x in range(T):
            L = lev[y, x]
            if L < 0:
                if y >= 13 and y > 0 and lev[y - 1, x] >= 0 and hf('hs', X0 + x, y) < 0.8:
                    out[y, x, :3] = PAL['shade'][1]; out[y, x, 3] = 255
                continue
            exp = any(not (0 <= x + a < T and 0 <= y + b < T) and False or (0 <= x + a < T and 0 <= y + b < T and lev[y + b, x + a] < 0)
                      for a, b in ((1, 0), (0, 1), (-1, 0), (0, -1)))
            if exp: L = max(0, min(L - 4, 4) if (x > 0 and y > 8) else L - 3)
            out[y, x, :3] = P[L]; out[y, x, 3] = 255


def _crowns_world(sp, x0, x1, y0, y1):
    pw, ph = perpx(sp)
    res = []
    for (cx, cy, rw, rh, shape, fam) in SPECIES[sp]['crowns']:
        for i in range(math.floor((x0 - 64) / pw), math.floor((x1 + 64) / pw) + 1):
            for j in range(math.floor((y0 - 64) / ph), math.floor((y1 + 64) / ph) + 1):
                res.append((cx + i * pw, cy + j * ph, rw, rh))
    return res


def _bumps(wv, period, n, salt, sp, rmin, rmax, hmax):
    """주기 period 위 n 개 둥근 혹의 위쪽 원호: 깊이(px). 혹 사이는 V 홈."""
    best = 99.0
    for k in range(n):
        c0 = (k + 0.5 + (hf(salt, 'c', k, sp) - 0.5) * 0.5) * period / n
        R = rmin + (rmax - rmin) * hf(salt, 'r', k, sp)
        h = hmax * hf(salt, 'h', k, sp)
        for m in (-1, 0, 1):
            dx = wv + 0.5 - (c0 + m * period)
            if abs(dx) < R:
                best = min(best, h + R - math.sqrt(R * R - dx * dx))
    return best


def skyline(sp, wx):
    """북쪽 하늘선 깊이(px, 0~12): 나무 꼭대기 돔이 이어진 선. 돔 사이는 V 홈."""
    pw = perpx(sp)[0]
    d = _bumps(wx % pw, pw, 5 * pw // 96 or 1, 'sky', sp, 10, 15, 3.5) + 0.9 * hf('skb', wx // 2 % (pw // 2), sp)
    return max(0.0, min(12.0, d))


def sideline(sp, wy, side):
    """동·서 옆선 깊이(px, 0~10)."""
    ph = perpx(sp)[1]
    d = _bumps(wy % ph, ph, 5 * ph // 64, 'side' + side, sp, 7, 11, 4.0) + 0.9 * hf('slb', wy // 2 % (ph // 2), side, sp)
    return max(0.0, min(10.0, d))


def _edge_rim(out, lev, fam, g):
    """깎인 가장자리 둘레를 둥근 면처럼: 동·남쪽 바깥 2~3px 는 어둡게, 북·서쪽 바깥 안쪽 1px 은 밝게."""
    a = out[..., 3] > 0
    def outside(x, y):
        if 0 <= x < T and 0 <= y < T: return not a[y, x]
        gi = 1 + (1 if x >= T else -1 if x < 0 else 0); gj = 1 + (1 if y >= T else -1 if y < 0 else 0)
        return not g[gj, gi]
    res = lev.copy()
    for y in range(T):
        for x in range(T):
            L = lev[y, x]
            if L < 0 or L >= 100 or fam[y, x] is None: continue
            de = next((k for k in (1, 2, 3) if outside(x + k, y)), 0)
            dn = next((k for k in (1, 2) if outside(x, y - k)), 0)
            dw = next((k for k in (1, 2) if outside(x - k, y)), 0)
            if de: res[y, x] = max(0, L - (5, 3, 1)[de - 1])
            elif dn == 2 or dw == 2: res[y, x] = min(19, L + 2)
    for y in range(T):
        for x in range(T):
            if res[y, x] != lev[y, x]:
                lev[y, x] = res[y, x]; out[y, x, :3] = PAL[fam[y, x]][res[y, x]]


def _carve(out, lev, sp, cx, cy, g):
    X0, Y0 = cx * T, cy * T
    narrow = not g[1, 0] and not g[1, 2]
    if not g[0, 1]:
        for x in range(T):
            d = int(round(skyline(sp, X0 + x)))
            out[:d, x] = 0; lev[:d, x] = -1
            for y in range(d, min(T, d + 4)):
                if lev[y, x] < 0: out[y, x] = 0
    for side, gi, xr in (('E', 2, lambda k: range(T - k, T)), ('W', 0, lambda k: range(0, k))):
        if g[1, gi]: continue
        for y in range(T):
            k = int(round(sideline(sp, Y0 + y, side) * (0.45 if narrow else 1.0)))
            for x in xr(k):
                out[y, x] = 0; lev[y, x] = -1
            for x in xr(min(T, k + 4)):
                if lev[y, x] < 0: out[y, x] = 0


def _bamboo_strokes(out, lev, X0, Y0):
    P = PAL['bamboo']
    for yy in range(T):
        for xx in range(T):
            if lev[yy, xx] < 0 or lev[yy, xx] >= 100: continue
            wx, wy = X0 + xx, Y0 + yy
            k = (wx + 2 * wy) % 7
            if k == 0 and _noise(wx, wy, 'bs') < 0.55:
                out[yy, xx, :3] = P[min(19, max(0, lev[yy, xx] + 4))]
            elif k == 3 and _noise(wx, wy, 'bd') < 0.5:
                out[yy, xx, :3] = P[max(0, lev[yy, xx] - 4)]


def _outline(out, lev, fam, g):
    a = out[..., 3] > 0
    res = out.copy()
    for yy in range(T):
        for xx in range(T):
            if not a[yy, xx] or lev[yy, xx] < 0: continue
            exposed = 0
            for dx, dy, w in ((1, 0, 2), (0, 1, 2), (-1, 0, 1), (0, -1, 1)):
                x2, y2 = xx + dx, yy + dy
                if 0 <= x2 < T and 0 <= y2 < T:
                    if not a[y2, x2]: exposed = max(exposed, w)
                else:
                    gi, gj = 1 + (1 if x2 >= T else -1 if x2 < 0 else 0), 1 + (1 if y2 >= T else -1 if y2 < 0 else 0)
                    if not g[gj, gi]: exposed = max(exposed, w)
            if not exposed: continue
            L = lev[yy, xx]
            if L >= 100: L = 17
            if fam[yy, xx] is None: continue
            P = PAL[fam[yy, xx]]
            res[yy, xx, :3] = P[max(0, min(L - 4, 3)) if exposed == 2 else max(0, L - 3)]
    out[:] = res


def _band(out, sp, cx, cy, g, n_edge, lev=None, fam=None):
    """남쪽 가장자리 칸: 세계 x 물결 선 아래 = 줄기·덤불·그늘 점. 줄기·덤불은 이 칸 안에서 끝난다."""
    X0, Y0 = cx * T, cy * T
    spec = SPECIES[sp]
    shade = PAL['shade']
    prof = [int(round(canopy_bottom(sp, X0 + x))) for x in range(T)]
    # 밑면 선 아래는 지우고, 바로 위 두 줄은 수관 밑면 그늘(같은 램프 4~6단 어둡게)
    for x in range(T):
        p = max(3, min(11, prof[x]))
        prof[x] = p
        for y in range(T):
            if y >= p:
                out[y, x] = 0
                if lev is not None: lev[y, x] = -1
            elif y >= p - 2 and out[y, x, 3] and lev is not None and 0 <= lev[y, x] < 100 and fam[y, x] is not None:
                lev[y, x] = max(0, lev[y, x] - (6 if y == p - 1 else 4))
                out[y, x, :3] = PAL[fam[y, x]][lev[y, x]]
            elif y >= p - 2 and out[y, x, 3]:
                out[y, x, :3] = PAL[DEEP[sp]][1 if y == p - 1 else 2]
    # 그늘: 수관 밑 1~2줄만 그늘 잔디(검은 띠 아님), 아래로 성겨진다
    for y in range(T):
        for x in range(T):
            if out[y, x, 3]: continue
            p = prof[x]
            wx, wy = X0 + x, Y0 + y
            gsh = PAL['gsh']
            if p <= y < p + 2:
                out[y, x, :3] = gsh[0 if y == p else 1]; out[y, x, 3] = 255
            elif y == p + 2 and hf('s2', wx, wy) < 0.6:
                out[y, x, :3] = gsh[2]; out[y, x, 3] = 255
    trunk = PAL[spec['trunk']]
    # 줄기: 수관 중심 아래(세계 좌표)에 한 그루씩. 칸을 넘지 않게 안으로 당긴다. 폭·밑동 높이·뿌리는 수관마다 다르다
    kind = sp
    used = []
    tr = []
    if kind != 'bb' and not n_edge:
        pw, ph = perpx(sp)
        for (ccx, ccy, rw, rh, shape, fm) in _trunk_crowns(sp):
            ci = (ccx, ccy)
            for i in range(math.floor((X0 - 64) / pw), math.floor((X0 + 80) / pw) + 1):
                tx = ccx + i * pw + (hf('tox', ci, sp) - 0.5) * 6
                w = 3 if kind == 'sg' else 5 + (1 if hf('tw', ci, sp) < 0.5 else 0) + (1 if hf('tw2', ci, sp) < 0.3 else 0)
                if math.floor(tx / T) * T != X0: continue      # 줄기는 가운데가 든 칸 하나만 그린다
                x0 = int(round(tx - w / 2)) - X0
                x0 = max(1, min(T - w - 1, x0))
                tr.append((x0, w, ci))
    tr.sort(key=lambda t: t[0])
    for x0, w, ci in tr:
        if any(abs(x0 - u) < w + 6 for u in used): continue
        if not all(out[max(0, prof[x0 + i] - 1), x0 + i, 3] for i in range(w)): continue
        used.append(x0)
        base = 13 + int(hf('tb', ci, sp) * 1.99)          # 13~14
        top = max(prof[x0], prof[min(T - 1, x0 + w - 1)]) - 2
        streak = 1 + int(hf('tsk', ci, sp) * (w - 2))
        # 땅 그늘 타원(줄기 밑)
        for y in range(base - 1, min(T, base + 3)):
            for x in range(max(0, x0 - 4), min(T, x0 + w + 4)):
                ex = (x + 0.5 - (x0 + w / 2)) / (w / 2 + 4); ey = (y + 0.5 - (base + 0.8)) / 2.0
                if ex * ex + ey * ey <= 1 and not out[y, x, 3]:
                    out[y, x, :3] = PAL['gsh'][0 if ex * ex + ey * ey < 0.4 else 1]; out[y, x, 3] = 255
        for y in range(top, base - 1):
            for i in range(w):
                x = x0 + i
                lit = 4 if i == 0 else 3 if i == 1 else 2 if i < w - 1 else 1
                if y < top + 3: lit -= 2                      # 수관 그늘 속 줄기 윗부분
                if i == streak and hf('tst', ci, y // 2, sp) < 0.6: lit -= 1   # 껍질 골
                if kind == 'sg' and (y + i) % 3 == 0: lit -= 1
                out[y, x, :3] = trunk[max(0, min(len(trunk) - 1, lit))]; out[y, x, 3] = 255
        # 밑동: 두 줄에 걸쳐 넓어지고, 맨 아랫줄은 갈라진 뿌리 가닥(왼쪽 밝게)
        flare = [(base - 2, -1, w), (base - 1, -2, w + 1), (base, -4, w + 3)]
        for y, l, r_ in flare:
            if not (0 <= y < T): continue
            for x in range(x0 + l, x0 + r_ + 1):
                if not (0 <= x < T): continue
                rel = x - x0
                if y == base and rel in (-3, -2, w + 1, w + 2) and hf('rg', ci, rel, sp) < 0.35: continue
                if y == base - 1 and rel in (-2, w + 1) and hf('rg1', ci, rel, sp) < 0.4: continue
                if y == base and 1 <= rel <= w - 2 and (rel + int(hf('rs', ci, sp) * 3)) % 3 == 0:
                    out[y, x, :3] = PAL['gsh'][0]; out[y, x, 3] = 255; continue     # 뿌리 사이 틈
                L = 3 if rel <= 0 else 1 if rel >= w - 1 else 2
                if y == base and (rel < 0 or rel >= w): L = 2 if rel < 0 else 0
                out[y, x, :3] = trunk[L]; out[y, x, 3] = 255
    if kind == 'bb':
        _culms(out, prof, X0, Y0)
    # 고사리 술: 줄기 사이 드문드문 2~3px 잎 획(공 모양 덤불 없음)
    fern = PAL['keyaki_a'] if kind not in ('sg', 'bb') else PAL['sugi'] if kind == 'sg' else PAL['bamboo']
    for b in range(3):
        if hf('fe', cx, cy, b, sp) < 0.45: continue
        fx = 1 + int(hf('fx', cx, cy, b, sp) * 13); fy = 12 + int(hf('fy', cx, cy, b, sp) * 3)
        for dx, dy, L in ((0, 0, 9), (-1, -1, 12), (1, -1, 11), (-2, -1, 7), (2, -2, 13), (0, -1, 10)):
            x, y = fx + dx, fy + dy
            if 0 <= x < T and 0 <= y < T and not out[y, x, 3]:
                out[y, x, :3] = fern[L]; out[y, x, 3] = 255
    # 풀잎 술: 맨 아래 줄 밝은 점
    hi = PAL['keyaki_b']
    for x in range(T):
        if hf('gt', X0 + x, sp) < 0.18 and not out[15, x, 3]:
            out[15, x, :3] = hi[14]; out[15, x, 3] = 255
            if hf('gt2', X0 + x) < 0.5 and not out[14, x, 3]: out[14, x, :3] = hi[12]; out[14, x, 3] = 255
    if kind == 'sk':   # 바닥 꽃잎
        for y in range(10, T):
            for x in range(T):
                if not out[y, x, 3] and hf('pt', X0 + x, Y0 + y) < 0.05:
                    out[y, x, :3] = PAL['sakura'][17]; out[y, x, 3] = 255
    if kind in ('mp', 'mx'):   # 낙엽
        for y in range(11, T):
            for x in range(T):
                if not out[y, x, 3] and hf('lf', X0 + x, Y0 + y) < 0.05:
                    out[y, x, :3] = PAL['maple'][12]; out[y, x, 3] = 255


def canopy_bottom(sp, wx):
    """남쪽 수관 밑면 높이(칸 안 y, px): 줄기 수관 가운데가 아래로 둥글게 처지고 사이는 올라간다."""
    pw = perpx(sp)[0]
    best = 4.0 + 1.2 * hf('cbn', wx % pw, sp) + 1.5 * max(0.0, math.sin(wx * 2 * math.pi / 6.0 + 7 * hf('cbl', (wx // 6) % 16, sp)))
    for (ccx, ccy, rw, rh, shape, fm) in _trunk_crowns(sp):
        tx = ccx + (hf('tox', (ccx, ccy), sp) - 0.5) * 6
        # 줄기 위는 들려 줄기가 길게 보이고, 줄기 사이는 잎이 1~4px 처진다
        for k in (-1, 0, 1):
            dx = abs(wx + 0.5 - (tx + k * pw))
            if 4 < dx < 14:
                best = max(best, 4.0 + (2.0 + 2.5 * hf('cbd', (ccx, ccy), sp)) * math.sin(math.pi * (dx - 4) / 10))
    return best


def _trunk_crowns(sp):
    """줄기를 세울 수관: 앞(아래) 수관부터, 주기 거리로 14px 안에 이미 줄기가 있으면 뺀다(쌍둥이 줄기 방지)."""
    pw = perpx(sp)[0]
    kept = []
    for c in sorted(SPECIES[sp]['crowns'], key=lambda c: -c[1]):
        if all(min((c[0] - k[0]) % pw, (k[0] - c[0]) % pw) >= 14 for k in kept): kept.append(c)
    return kept


def _culms(out, prof, X0, Y0):
    C = PAL['culm']
    for x in range(T):
        wx = X0 + x
        ph = wx % 5
        if ph in (0, 1):
            top = prof[x] - 2
            for y in range(max(0, top), 15):
                node = (Y0 + y + (wx // 5) * 3) % 9 == 0
                L = (4 if ph == 0 else 2) + (1 if node else 0) - (2 if y < prof[x] + 2 else 0)
                out[y, x, :3] = C[max(0, min(6, L))]; out[y, x, 3] = 255


# ---------------------------------------------------------------- 오토타일 표: 47 마스크 × 위상
def autotile_tiles(sp):
    """{(mask, px, py): 16×16 RGBA}."""
    res = {}
    PW_, PH_ = per(sp)
    for py in range(PH_):
        for px in range(PW_):
            for m in CANON:
                res[(m, px, py)] = render_cell(sp, m, px, py)
    return res


def paint_map(sp, M, tiles=None, ox=0, oy=0):
    """bool 마스크 M(H×W) 를 오토타일로 칠한 RGBA(투명 배경). tiles 를 주면 표에서 뽑는다(엔진과 같은 경로)."""
    H, Wd = M.shape
    img = np.zeros((H * T, Wd * T, 4), np.uint8)
    for y in range(H):
        for x in range(Wd):
            if not M[y, x]: continue
            m = 0
            for bit, (dx, dy) in OFFS.items():
                xx, yy = x + dx, y + dy
                if xx < 0 or yy < 0 or xx >= Wd or yy >= H or M[yy, xx]: m |= bit
            m = canon(m)
            wx, wy = x + ox, y + oy
            pw_, ph_ = per(sp)
            t = tiles[(m, wx % pw_, wy % ph_)] if tiles is not None else render_cell(sp, m, wx % pw_, wy % ph_)
            img[y * T:(y + 1) * T, x * T:(x + 1) * T] = t
    return img


def over(dst, src, x, y):
    h, w = src.shape[:2]
    a = src[..., 3:4].astype(np.float32) / 255.0
    region = dst[y:y + h, x:x + w]
    region[..., :3] = (src[..., :3] * a + region[..., :3] * (1 - a)).astype(np.uint8)
    region[..., 3] = np.maximum(region[..., 3], src[..., 3])


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/jpf/r3'
    os.makedirs(out, exist_ok=True)
    M = np.zeros((14, 20), bool)
    M[1:9, 2:16] = True; M[9:12, 2:7] = True; M[0, 6:11] = True; M[5:7, 16:19] = True
    for sp in KINDS:
        img = paint_map(sp, M)
        bg = np.zeros_like(img); bg[...] = (96, 132, 60, 255)
        over(bg, img, 0, 0)
        Image.fromarray(bg).resize((bg.shape[1] * 3, bg.shape[0] * 3), Image.NEAREST).save(os.path.join(out, f'paint-{sp}-x3.png'))
        print(sp, 'ok')
