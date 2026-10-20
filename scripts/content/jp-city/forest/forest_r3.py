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
    # 단풍 숲에 섞는 노란 잎(등롱 호박색 램프를 20단으로 늘린다 — 계약 색만)
    'amber': [ramp('lantern_amber')[min(len(ramp('lantern_amber')) - 1, max(0, (i - 6) * len(ramp('lantern_amber')) // 14))] for i in range(20)],
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
    'sg': dict(ko='삼나무 숲', crowns=[(10, 24, 15, 30, 'cone', 'sugi'), (41, 18, 13, 28, 'cone', 'sugi'), (73, 27, 16, 31, 'cone', 'sugi'),
                                  (25, 55, 14, 31, 'cone', 'sugi'), (58, 49, 12, 27, 'cone', 'sugi'), (90, 57, 15, 30, 'cone', 'sugi')], trunk='sugibark',
               style=[(0.04, 0), (-0.06, 0), (0.08, 0), (-0.02, 0), (0.05, 0), (-0.08, 0)]),
    'bb': dict(ko='대숲', crowns=[(9, 14, 15, 16, 'fan', 'bamboo'), (36, 9, 17, 14, 'fan', 'bamboo'), (62, 17, 14, 17, 'fan', 'bamboo'),
                                (87, 8, 13, 13, 'fan', 'bamboo'), (22, 40, 16, 17, 'fan', 'bamboo'), (50, 44, 13, 15, 'fan', 'bamboo'),
                                (77, 40, 18, 16, 'fan', 'bamboo'), (4, 60, 12, 12, 'fan', 'bamboo')], trunk='culm'),
    # 소나무 숲(신사·해안): 납작한 구름 잎판, 수관 사이가 성기다
    # 섞인 숲(진수의 숲·산비탈): 삼나무 원뿔 + 활엽 돔이 한 수관 밭 안에 불규칙하게 섞인다. 주기 6×4(시트 한도로 하나만)
    'mh': dict(ko='섞인 숲(삼나무+활엽)', crowns=[(8, 20, 12, 26, 'cone', 'sugi'), (34, 14, 20, 17, 'dome', 'keyaki_a'), (58, 10, 10, 22, 'cone', 'sugi'),
                                            (80, 22, 18, 16, 'dome', 'keyaki_a'), (20, 50, 17, 15, 'dome', 'keyaki_a'), (48, 44, 12, 25, 'cone', 'sugi'),
                                            (70, 54, 15, 13, 'dome', 'keyaki_a'), (92, 50, 11, 24, 'cone', 'sugi')],
               trunk='bark', style=[(0.04, 0), (0.05, 0.3), (-0.03, 0), (-0.02, 0.5), (-0.03, 0.15), (-0.04, 0), (0.02, 0.4), (0.03, 0)]),
}
BRIGHT = dict(sugi=0.30, pine=0.14, sakura=0.08, maple=0.14, bamboo=0.04)   # 색 계열별 밝기 올림(어두운 램프)
DEEP_OFF = dict(bl=2, bb=5, sg=3, sk=5, mp=3, mh=3)
DEEP = dict(bl='keyaki_a', sk='sakura', mp='maple', sg='sugi', bb='bamboo', mx='pine', mh='sugi')
KINDS = ['bl', 'bb', 'sk', 'sg', 'mp', 'mh']
BROAD64 = [(13, 16, 26, 22, 'dome'), (46, 9, 21, 18, 'dome'), (30, 45, 25, 21, 'dome'), (60, 50, 21, 18, 'dome'), (3, 53, 13, 11, 'dome')]
for _k in ('sk', 'mp'):   # 벚·단풍: 4×4 주기의 활엽 배치, 색만 다르다
    SPECIES[_k]['crowns'] = [c[:5] + (SPECIES[_k]['fam'],) for c in SPECIES['bl']['crowns']]
    SPECIES[_k]['style'] = [(o, 0) for o, _ in SPECIES['bl']['style']]
PERIOD = (PW * T, PH * T)
# 종마다 위상 주기(칸): 활엽만 6×4, 나머지는 4×4 — jp 시트 4096px 높이 안에 6종(1128 + 5×752 칸)이 들어가도록
for _k in SPECIES: SPECIES[_k].setdefault('period', (6, 4))


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
        if shape == 'pads':   # 소나무: 납작한 구름 잎판 네 층(위가 좁고 아래가 넓다), 층끼리 겹쳐 틈이 작다
            out = []
            for k, (fy, fw) in enumerate([(-0.62, 0.55), (-0.22, 0.85), (0.18, 1.0), (0.58, 0.8)]):
                w = rw * fw - 5; py = rh * fy
                m = max(2, int(2 * w / 7))
                for j in range(m):
                    x = -w + (2 * w) * (j + 0.5) / m + (rnd(('pj', k, j)) - 0.5) * 3 + (rnd(('ps', k)) - 0.5) * 6
                    out.append((x, py + (rnd(('py', k, j)) - 0.5) * 2, 5.4 + rnd(('pr', k, j)) * 1.4))
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
        # 대숲 잎 덩이: 촘촘한 덩이(틈이 작다). 잎 결은 그릴 때 대 잎 획(비스듬한 2~3px 칼날)으로 칠한다
        for k in range(22):
            a = rnd(('fa', k)) * math.pi * 2; d = math.sqrt(rnd(('fd', k)))
            out.append((math.cos(a) * rw * d * 0.85, math.sin(a) * rh * d * 0.8, 5.0 + rnd(('fr', k)) * 1.6))
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
            crown_v = 0.58 - 0.14 * ncy - 0.22 * ncx + coff
        crown_v = crown_v + BRIGHT.get(c['fam'], 0.0)
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
            tk = 0.55 if c['fam'] == 'sakura' else 1.0
            nv = v[yy, xx] + tk * (0.17 * lv + 0.20 * gr - 0.42 * le * (1.0 if gr < 0.2 else 0.3))
            if c['shape'] == 'fan':
                # 대숲: 늘어진 대 잎 다발(밝은 칼날) 사이로 마디 있는 대줄기가 비친다
                tb, tc = _bamboo_tex(sp)
                ph_, pw_ = tb.shape
                b = tb[wy % ph_, wx % pw_]; cu = tc[wy % ph_, wx % pw_]
                if b > 0:
                    nv = v[yy, xx] + 0.05 * lv - 0.10 + 0.30 * b
                elif cu > 0:
                    nv = 0.50 + 0.18 * cu + 0.04 * lv
                else:
                    nv = v[yy, xx] - 0.30 + 0.05 * lv + (0.0 if b == 0 else -0.10)
                lev[yy, xx] = int(np.clip(round(nv * 19), 0, 19)); fam[yy, xx] = c['fam']; own[yy, xx] = c['crown'] * 1000 + c['k']
                continue
            L = int(np.clip(round(nv * 19), 0, 19))
            # 반짝임: 잎 무리 하나의 왼쪽 위 2~3화소만(낱점 흩뿌림 아님)
            if v[yy, xx] + 0.12 * lv > 0.60 and gr > 0.55 and le < 0.5 and hf('hl', lx, ly, sp) < 0.55:
                L = (100 + (1 if gr > 0.8 else 0)) if c['fam'].startswith('keyaki') else (19 if gr > 0.8 else 18)
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
            if c['fam'] == 'maple' and L < 100 and L >= 10 and hf('am', lx, ly, sp, c['crown']) < 0.28:
                fam[yy, xx] = 'amber'
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
            out[yy, xx, :3] = deep[int(np.clip(round(2.2 + DEEP_OFF.get(sp, 0) + 1.6 * lv - 2.0 * le), 0, 9))]; out[yy, xx, 3] = 255
    for yy in range(T):
        for xx in range(T):
            L = lev[yy, xx]
            if L < 0: continue
            if L >= 200: out[yy, xx, :3] = trunk_r[2 if L == 200 else 0]
            elif L >= 100: out[yy, xx, :3] = pal_hi[L - 100]
            else: out[yy, xx, :3] = PAL[fam[yy, xx]][L]
            out[yy, xx, 3] = 255
    # 대숲: 잎 덩이 위 깃털 획(세계 좌표 선분)
    # 가장자리 깎기: 북쪽은 수관 돔 하늘선, 동·서쪽은 수관 줄의 둥근 옆선(세계 좌표 함수라 이웃 칸과 이어진다)
    _carve(out, lev, sp, cx, cy, g)
    _edge_rim(out, lev, fam, g)
    # 윤곽: 칸 안 투명 화소나 바깥 칸에 닿은 화소를 한두 단 어둡게(오른쪽·아래쪽 면은 더)
    _outline(out, lev, fam, g)
    # 4) 남쪽 줄기 띠
    if (s_edge and n_edge) or (not g[1, 0] and not g[1, 2]):
        out[:] = 0
        _small_tree(out, sp, cx, cy, g, s_edge)
        return out
    if s_edge:
        _band(out, sp, cx, cy, g, n_edge, lev, fam)
    return out


def _hedge_paint(out, sp, X0, Y0, face):
    """face[y][x] = 0 없음 · 1 윗면(밝음) · 2 앞면(어두움) → 잎 결로 칠하고, 바깥 둘레를 한 단 어둡게."""
    P = PAL[HEDGE_PAL[sp]]
    lev = np.full((T, T), -1, int)
    for y in range(T):
        for x in range(T):
            f = face[y][x]
            if not f: continue
            lv, le, _, _ = leaf(X0 + x, Y0 + y, sp, 3)
            gr = _LGRAD[(X0 + x, Y0 + y, sp, 3)]
            v = (0.66 if f == 1 else 0.36) + BRIGHT.get(HEDGE_PAL[sp], 0.0) + 0.15 * lv + 0.16 * gr - 0.36 * le * (1.0 if gr < 0.2 else 0.3)
            lev[y, x] = int(np.clip(round(v * 19), 0, 19))
    for y in range(T):
        for x in range(T):
            L = lev[y, x]
            if L < 0: continue
            if any(0 <= x + a < T and 0 <= y + b < T and not face[y + b][x + a] for a, b in ((1, 0), (0, 1))): L = max(0, min(L - 4, 4))
            elif any(0 <= x + a < T and 0 <= y + b < T and not face[y + b][x + a] for a, b in ((-1, 0), (0, -1))): L = max(0, L - 2)
            out[y, x, :3] = P[L]; out[y, x, 3] = 255


def _narrow(out, sp, cx, cy, g, s_edge, n_edge):
    """세로 1칸 띠 = 세로 생울타리(3/4): 윗면이 세로로 이어지고 옆선은 세계 y 혹으로 들쭉날쭉, 남쪽 끝에만 앞면·그늘, 북쪽 끝은 둥글게."""
    X0, Y0 = cx * T, cy * T
    ph = perpx(sp)[1]
    face = [[0] * T for _ in range(T)]
    for y in range(T):
        wy = Y0 + y
        l = 2 + int(round(min(3.0, _bumps(wy % ph, ph, 6, 'nwl', sp, 4, 7, 1.0))))
        r = T - 2 - int(round(min(3.0, _bumps(wy % ph, ph, 6, 'nwr', sp, 4, 7, 1.0))))
        top_cap = 0
        if n_edge:
            top_cap = 2 + int(2 * abs((l + r) / 2 - 8) > 0)
            # 북쪽 끝 둥근 마개
            if y < top_cap: continue
            if y < top_cap + 3:
                k = top_cap + 3 - y
                l, r = l + k, r - k
        front0 = 9 if s_edge else T
        for x in range(l, r):
            if y >= 14 and s_edge: continue
            face[y][x] = 2 if y >= front0 else 1
    _hedge_paint(out, sp, X0, Y0, face)
    if s_edge:
        for x in range(1, T - 1):
            for y in (14, 15):
                if not out[y, x, 3] and (y == 14 or 3 <= x <= 12): out[y, x, :3] = PAL['gsh'][1 if y == 14 else 2]; out[y, x, 3] = 255


HEDGE_PAL = dict(bl='keyaki_a', sk='sakura', mp='maple', sg='sugi', bb='bamboo', mx='pine', mh='keyaki_a')


def _small_tree(out, sp, cx, cy, g, s_edge):
    """1칸 띠(가로·세로) = 칸마다 작은 나무 한 그루(둥근 수관 + 짧은 줄기 + 그림자). 크기·치우침은 칸 위상 해시라
    주기 안에서 그루마다 다르다. 삼나무는 원뿔, 섞인 숲은 위상마다 원뿔/돔이 갈린다."""
    X0, Y0 = cx * T, cy * T
    pw, ph = per(sp)
    q = (cx % pw, cy % ph)
    fam = HEDGE_PAL[sp]
    cone = sp == 'sg' or (sp == 'mh' and hf('stc', *q) < 0.45)
    if sp == 'mh' and cone: fam = 'sugi'
    P = PAL[fam]
    bark = PAL[SPECIES[sp]['trunk']] if SPECIES[sp]['trunk'] in PAL else PAL['bark']
    jx = (hf('stx', sp, *q) - 0.5) * 3.0
    big = hf('sts', sp, *q)
    rw = 5.6 + 1.6 * big if not cone else 4.2 + 1.2 * big
    top = 1.0 + (1.0 - big) * 2.0
    bot = 11.5
    ccx = 8.0 + jx
    lev = np.full((T, T), -1, int)
    # 줄기: 수관 밑으로 2~3px 보인다(남쪽이 열려 있을 때). 세로 띠에서 아래 칸이 숲이면 다음 그루 수관이 덮는다
    tx = int(round(ccx - 1))
    for y in range(9, 14 if s_edge else 16):
        for x in (tx, tx + 1):
            if 0 <= x < T: out[y, x, :3] = bark[3 if x == tx else 1]; out[y, x, 3] = 255
    if s_edge:
        for x in range(T):
            for y in (13, 14):
                d = abs(x + 0.5 - ccx) / (rw + 0.5)
                if d < 1.0 and not out[y, x, 3] and (y == 13 or d < 0.7): out[y, x, :3] = PAL['gsh'][0 if y == 13 else 1]; out[y, x, 3] = 255
    for y in range(T):
        for x in range(T):
            ny = (y + 0.5 - (top + bot) / 2) / ((bot - top) / 2)
            if cone:
                half = rw * (0.25 + 0.75 * (ny + 1) / 2)
                if not (-1 <= ny <= 1) or abs(x + 0.5 - ccx) > half: continue
                nx = (x + 0.5 - ccx) / max(half, 1)
            else:
                nx = (x + 0.5 - ccx) / rw
                wob = 0.12 * math.sin((x + X0) * 1.7 + (y + Y0) * 0.9)
                if nx * nx + ny * ny > 1.0 + wob: continue
            lv, le, _, _ = leaf(X0 + x, Y0 + y, sp if sp != 'bb' else 'bl', 3)
            gr = _LGRAD[(X0 + x, Y0 + y, sp if sp != 'bb' else 'bl', 3)]
            v = 0.62 - 0.20 * ny - 0.14 * nx + BRIGHT.get(fam, 0.0) + 0.14 * lv + 0.14 * gr - 0.30 * le * (1.0 if gr < 0.2 else 0.3)
            if nx * 0.6 + ny * 0.8 > 0.75: v -= 0.18
            lev[y, x] = int(np.clip(round(v * 19), 0, 19))
    for y in range(T):
        for x in range(T):
            L = lev[y, x]
            if L < 0: continue
            if any(not (0 <= x + a < T and 0 <= y + b < T) or lev[y + b, x + a] < 0 for a, b in ((1, 0), (0, 1), (-1, 0), (0, -1))):
                L = max(0, min(L - 4, 5))
            out[y, x, :3] = P[L]; out[y, x, 3] = 255


def _hedge(out, sp, cx, cy, g):
    """1줄 띠 = 가로 생울타리(3/4 시점): 윗면(밝음, 세계 x 혹으로 들쭉날쭉한 윗선) + 앞면(어두움) + 밑 그늘 한 줄.
    옆이 숲이 아니면 그 끝을 둥글게 마감한다."""
    X0, Y0 = cx * T, cy * T
    pw = perpx(sp)[0]
    face = [[0] * T for _ in range(T)]
    for x in range(T):
        wx = X0 + x
        top = 2 + int(round(min(4.0, _bumps(wx % pw, pw, 9, 'hgt', sp, 5, 8, 1.5))))
        bot = 14
        end = 99
        if not g[1, 0]: end = min(end, x)
        if not g[1, 2]: end = min(end, T - 1 - x)
        if end < 4:                               # 끝 마개: 둥글게 줄인다
            k = (4 - end) ** 2 // 2 + 1
            top += k; bot -= max(0, k - 3)
        for y in range(top, bot):
            face[y][x] = 1 if y < top + 5 else 2
    _hedge_paint(out, sp, X0, Y0, face)
    for x in range(T):
        if out[13, x, 3] and not out[14, x, 3]:
            out[14, x, :3] = PAL['gsh'][0]; out[14, x, 3] = 255
            if not out[15, x, 3] and hf('hs', X0 + x) < 0.6: out[15, x, :3] = PAL['gsh'][2]; out[15, x, 3] = 255


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
    d = _bumps(wy % ph, ph, 3, 'side' + side, sp, 10, 15, 6.0) + 0.9 * hf('slb', wy // 2 % (ph // 2), side, sp)
    return max(0.0, min(13.0, d))


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


_BTEX = {}


def _bamboo_tex(sp):
    """주기 상자 크기 토러스 결: (잎 칼날 밝기 0..1, 칼날 바로 밑 그림자 -1, 틈 0), (대줄기 밝기 0..1, 마디 0.2, 없음 0)."""
    if sp in _BTEX: return _BTEX[sp]
    pw, ph = perpx(sp)
    bl = np.zeros((ph, pw)); cu = np.zeros((ph, pw))
    # 대줄기: 6~8px 간격 세로 2px 줄, 오른쪽 열은 어둡다, 마디는 5~7px 마다
    x = 0.0; k = 0
    while x < pw - 1:
        xi = int(x); off = int(hf('cn', sp, k) * 6)
        for y in range(ph):
            node = ((y + off) % (5 + int(hf('cm', sp, k) * 3))) == 0
            cu[y, xi % pw] = 0.2 if node else 1.0
            cu[y, (xi + 1) % pw] = 0.2 if node else 0.55
        x += 6 + hf('cg', sp, k) * 3; k += 1
    # 잎 다발: 5×5 지터 격자, 다발마다 칼날 2~3장이 한 점에서 아래 양쪽으로 늘어진다
    for gy in range(0, ph, 5):
        for gx in range(0, pw, 5):
            ox = gx + hf('lx', sp, gx, gy) * 5; oy = gy + hf('ly', sp, gx, gy) * 5
            n = 2 + int(hf('ln', sp, gx, gy) * 2)
            for j in range(n):
                a = math.radians(25 + 130 * (j + 0.5) / n + (hf('la', sp, gx, gy, j) - 0.5) * 30)
                L = 4 + int(hf('ll', sp, gx, gy, j) * 3)
                for t in range(L + 1):
                    px = int(round(ox + math.cos(a) * t)) % pw; py = int(round(oy + math.sin(a) * t * 0.8)) % ph
                    lit = 1.0 - 0.6 * t / L if math.cos(a) < 0 else 0.75 - 0.5 * t / L
                    bl[py, px] = max(bl[py, px], max(0.15, lit))
                    qy = (py + 1) % ph
                    if bl[qy, px] == 0: bl[qy, px] = -1
    _BTEX[sp] = (bl, cu)
    return _BTEX[sp]


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
                w = 3 + (1 if hf('tw', ci, sp) < 0.4 else 0) if shape == 'cone' else 4 + int(hf('tw', ci, sp) * 3.99)
                if math.floor(tx / T) * T != X0: continue      # 줄기는 가운데가 든 칸 하나만 그린다
                x0 = int(round(tx - w / 2)) - X0
                x0 = max(1, min(T - w - 1, x0))
                tr.append((x0, w, ci))
    tr.sort(key=lambda t: t[0])
    for x0, w, ci in tr:
        if any(abs(x0 - u) < w + 6 for u in used): continue
        if not all(out[max(0, prof[x0 + i] - 1), x0 + i, 3] for i in range(w)): continue
        used.append(x0)
        base = 11 + int(hf('tb', ci, sp) * 3.99)          # 11~14: 밑동이 한 줄에 서지 않는다
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
    # 밑풀 덩이: 폭 5~10 · 높이 2~5 의 낮은 잎 덩이가 밑동 몇을 덮어 밑선이 한 줄로 서지 않게 한다
    und = PAL['keyaki_a'] if kind not in ('sg', 'mh') else PAL['sugi']
    for b in range(3):
        if hf('ug', cx, cy, b, sp) < 0.3: continue
        ux = 1 + hf('ux', cx, cy, b, sp) * 14; uw = 3 + hf('uw', cx, cy, b, sp) * 3.5; uh = 3 + hf('uh', cx, cy, b, sp) * 3
        ub = 11.5 + hf('ub', cx, cy, b, sp) * 3.0        # 밑동 높이가 덤불마다 달라 밑선이 한 줄로 서지 않는다
        bh = 1.5 + hf('ubh', cx, cy, b, sp) * 1.5          # 덤불 아래쪽도 둥글게(납작한 바닥 없음)
        for y in range(max(0, int(ub - uh) - 1), min(T, int(ub + bh) + 1)):
            for x in range(max(0, int(ux - uw) - 1), min(T, int(ux + uw) + 2)):
                dx = (x + 0.5 - ux) / uw
                dy = (y + 0.5 - ub) / (uh if y + 0.5 < ub else bh)
                if dx * dx + dy * dy > 1: continue
                lv, le, llx, lly = leaf(X0 + x, Y0 + y, sp, 3)
                if dx * dx + dy * dy > 0.6 and le > 0.6: continue
                Lu = int(np.clip(round(7 + 5 * (-dy) - 2 * dx + 3 * lv - 3 * le - (3 if dy > 0.3 else 0)), 2, 14))
                out[y, x, :3] = und[Lu]; out[y, x, 3] = 255
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
    """남쪽 수관 밑면 높이(칸 안 y, px): 잎 자락이 3~10px 로 처지는 둥근 혹들. 줄기 위(±3px)는 5px 까지 들려 줄기가 보인다."""
    pw = perpx(sp)[0]
    u = wx % pw
    lobe = _bumps(u, pw, 7, 'cbl', sp, 5, 10, 1.5)
    L = 3.0 + 4.5 * hf('cbd', int(u // 9), sp)
    best = 3.0 + L * max(0.0, 1.0 - lobe / 5.0)
    for (ccx, ccy, rw, rh, shape, fm) in _trunk_crowns(sp):
        tx = ccx + (hf('tox', (ccx, ccy), sp) - 0.5) * 6
        for k in (-1, 0, 1):
            if abs(wx + 0.5 - (tx + k * pw)) < 5.5: best = min(best, 4.0 + hf('cbt', (ccx, ccy), sp))
    return best


def _trunk_crowns(sp):
    """줄기를 세울 수관: 앞(아래) 수관부터, 주기 거리로 14px 안에 이미 줄기가 있으면 뺀다(쌍둥이 줄기 방지)."""
    pw = perpx(sp)[0]
    kept = []
    for c in sorted(SPECIES[sp]['crowns'], key=lambda c: -c[1]):
        if hf('tkeep', c[0], c[1], sp) < 0.45: continue      # 수관 셋 중 하나는 줄기를 덤불 뒤에 감춘다(울타리 방지)
        if all(min((c[0] - k[0]) % pw, (k[0] - c[0]) % pw) >= 14 for k in kept): kept.append(c)
    return kept


def _culms(out, prof, X0, Y0):
    C = PAL['culm']
    pw = 96
    starts = []
    u = 0; k = 0
    while u < pw - 2:
        if hf('cs', k) < 0.8: starts.append(u)
        u += 4 + int(hf('cg2', k) * 5); k += 1
    for x in range(T):
        wx = X0 + x
        u = wx % pw
        ph = next((u - s0 for s0 in starts if 0 <= u - s0 <= 1), -1)
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
