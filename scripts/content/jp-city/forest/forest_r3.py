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
}

# ---------------------------------------------------------------- 수관 밭(세계 좌표, 주기 PW×PH 칸)
# 수관: (cx, cy, rw, rh, 모양, 색 계열). 모양 dome(활엽) · cone(삼나무) · pads(소나무) · fan(대숲)
SPECIES = {
    # 활엽(느티·잡목): 폭 3칸 돔, 벽돌 엇갈림 — 윗줄 2그루, 아랫줄 2그루(반 칸 비껴), 청록·황록 번갈아
    'bl': dict(ko='활엽 혼효림(느티나무·잡목)', crowns=[(24, 16, 28, 23, 'dome', 'keyaki_a'), (73, 13, 27, 22, 'dome', 'keyaki_b'),
                                                (1, 45, 28, 23, 'dome', 'keyaki_b'), (49, 48, 27, 23, 'dome', 'keyaki_a')],
               trunk='bark', floor_tint=None),
    'sk': dict(ko='벚나무 숲', crowns=[(24, 18, 24, 20, 'dome', 'sakura'), (72, 14, 25, 20, 'dome', 'sakura'),
                                  (0, 46, 25, 21, 'dome', 'sakura'), (48, 50, 24, 21, 'dome', 'sakura')], trunk='sakurabark'),
    'mp': dict(ko='단풍 숲', crowns=[(24, 18, 24, 20, 'dome', 'maple'), (72, 14, 25, 20, 'dome', 'maple'),
                                 (0, 46, 25, 21, 'dome', 'maple'), (48, 50, 24, 21, 'dome', 'maple')], trunk='bark'),
    # 삼나무: 폭 2칸 원뿔, 촘촘(16px 간격 반 엇갈림)
    'sg': dict(ko='삼나무 숲', crowns=[(16, 26, 15, 30, 'cone', 'sugi'), (48, 22, 15, 30, 'cone', 'sugi'), (80, 28, 15, 30, 'cone', 'sugi'),
                                  (0, 56, 15, 30, 'cone', 'sugi'), (32, 58, 15, 30, 'cone', 'sugi'), (64, 54, 15, 30, 'cone', 'sugi')], trunk='sugibark'),
    'bb': dict(ko='대숲', crowns=[(16, 20, 17, 18, 'fan', 'bamboo'), (48, 16, 17, 18, 'fan', 'bamboo'), (80, 22, 17, 18, 'fan', 'bamboo'),
                                (0, 50, 17, 18, 'fan', 'bamboo'), (32, 52, 17, 18, 'fan', 'bamboo'), (64, 48, 17, 18, 'fan', 'bamboo')], trunk='culm'),
    # 섞인 숲: 신사 소나무+단풍, 산비탈 삼나무+활엽
    'mx': dict(ko='신사 숲(소나무+단풍)', crowns=[(24, 18, 24, 18, 'pads', 'pine'), (72, 16, 24, 20, 'dome', 'maple'),
                                            (0, 46, 24, 20, 'dome', 'maple'), (48, 48, 24, 18, 'pads', 'pine')], trunk='bark'),
    'mh': dict(ko='산비탈 숲(삼나무+활엽)', crowns=[(16, 26, 15, 30, 'cone', 'sugi'), (56, 18, 24, 20, 'dome', 'keyaki_a'), (88, 26, 15, 30, 'cone', 'sugi'),
                                             (8, 52, 24, 20, 'dome', 'keyaki_b'), (48, 56, 15, 30, 'cone', 'sugi'), (80, 50, 24, 20, 'dome', 'keyaki_b')], trunk='bark'),
}
DEEP = dict(bl='keyaki_a', sk='sakura', mp='maple', sg='sugi', bb='bamboo', mx='pine', mh='sugi')
KINDS = ['bl', 'bb', 'sk', 'sg', 'mp', 'mx', 'mh']
PERIOD = (PW * T, PH * T)


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
            # 덩이는 자기 칸 위로 넘지 않는다(칸 그림이 3×3 마스크로만 정해지도록)
            top = math.floor(wy / T) * T
            if wy - r < top: wy = top + r + 0.01
            out.append(dict(x=wx, y=wy, r=r, crown=ci, fam=fam, shape=shape, cx=cx, cy=cy, rw=rw, rh=rh, k=k))
    return out


_WC = {}


def clumps_near(sp, x0, y0, x1, y1):
    """세계 사각형 [x0,x1)×[y0,y1) 에 닿는 덩이(주기 복제)."""
    if sp not in _WC: _WC[sp] = world_clumps(sp)
    base = _WC[sp]
    pw, ph = PERIOD
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


def _noise(wx, wy, salt):
    return hf('n', wx, wy, salt)


_LEAF = {}


def leaf(wx, wy, sp, size=3):
    """잎 결: 세계 좌표 보로노이(칸 size px). (잎 id 값 -1~1, 경계 0~1) — 버들항 수관의 2~4px 잎 무리."""
    key = (wx, wy, sp, size)
    if key in _LEAF: return _LEAF[key]
    gx, gy = wx // size, wy // size
    best = (1e9, 0, 0); second = 1e9
    for j in (-1, 0, 1):
        for i in (-1, 0, 1):
            cx, cy = gx + i, gy + j
            px = cx * size + hf('lx', cx, cy, sp) * size
            py = cy * size + hf('ly', cx, cy, sp) * size
            d = (wx + 0.5 - px) ** 2 + (wy + 0.5 - py) ** 2
            if d < best[0]: second = best[0]; best = (d, cx, cy)
            elif d < second: second = d
    val = hf('lv', best[1], best[2], sp) * 2 - 1
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
    base = dist >= 8.0 + 4.0 * wn
    # 1) 잎 덩이
    for c in clumps_near(sp, X0, Y0, X0 + T, Y0 + T):
        cells = _disk_cells(c, cx, cy)
        if (cx, cy) not in cells: continue
        if not all(inside(i, j) for (i, j) in cells): continue
        if _eroded(c, cells, inside): continue
        x, y, r = c['x'] - X0, c['y'] - Y0, c['r']
        d2 = ((xs + 0.5 - x) ** 2 + (ys + 0.5 - y) ** 2) / (r * r)
        hit = d2 <= 1.0
        if not hit.any(): continue
        nx = (xs + 0.5 - x) / r; ny = (ys + 0.5 - y) / r
        nz = np.sqrt(np.clip(1 - d2, 0, 1))
        lam = np.clip(-0.50 * nx - 0.62 * ny + 0.60 * nz, -1, 1)
        # 수관 안 위치: 위·왼쪽이 밝다
        ry = (c['y'] - c['cy']) / c['rh']; rx = (c['x'] - c['cx']) / c['rw']
        crown_v = 0.60 - 0.30 * ry - 0.12 * rx + (hf('cv', c['crown'], c['k']) - 0.5) * 0.08
        if c['shape'] == 'cone':
            crown_v = 0.50 - 0.16 * ry - 0.22 * rx
        v = crown_v + 0.26 * (lam - 0.35)
        rim = np.clip((np.sqrt(d2) - 0.80) / 0.20, 0, 1) * np.clip(0.2 + nx * 0.5 + ny * 0.8, 0, 1)
        v = v - 0.15 * rim
        dd = np.sqrt(d2)
        for yy, xx in zip(*np.nonzero(hit)):
            wx, wy = X0 + xx, Y0 + yy
            lv, le, lx, ly = leaf(wx, wy, sp, 3 if c['shape'] != 'cone' else 2)
            # 바깥 둘레 잎 무리 경계는 파내 톱니 윤곽(잎 하나 빠진 홈)
            if dd[yy, xx] > 0.78 and le > 0.55 and hf('notch', lx, ly, sp) < 0.55: continue
            nv = v[yy, xx] + 0.17 * lv - 0.30 * le * (0.5 + 0.5 * (1 - lam[yy, xx])) + (_noise(wx, wy, sp) - 0.5) * 0.06
            L = int(np.clip(round(nv * 19), 0, 19))
            if c['fam'].startswith('keyaki') and nv > 0.74 and lam[yy, xx] > 0.45 and le < 0.45 and hf('hl', lx, ly, sp) < 0.55:
                L = 100 + (1 if nv > 0.86 else 0)
            # 잔가지: 그늘 쪽 잎 틈에 갈색 한두 점
            if le > 0.75 and c['shape'] == 'dome' and hf('twg', lx, ly, sp) < 0.05 and lam[yy, xx] < 0.5:
                L = 200
            lev[yy, xx] = L
            fam[yy, xx] = c['fam']
            own[yy, xx] = c['crown'] * 1000 + c['k']
    pal_hi = PAL['hi']
    # 2) 속 그늘 채움 + 가지
    trunk_r = PAL[spec['trunk']] if spec['trunk'] in PAL else PAL['bark']
    for yy in range(T):
        for xx in range(T):
            if lev[yy, xx] >= 0 or not base[yy, xx]: continue
            # 속 그늘은 수관 아래에만: 바로 위 3줄 안에 잎이 있거나(칸 위로 넘어가면 위 칸이 숲일 때) 해야 한다
            ok = False
            for k in (1, 2, 3):
                if yy - k < 0: ok = bool(g[0, 1]); break
                if lev[yy - k, xx] >= 0: ok = True; break
            if not ok: continue
            # 가지 V: 세계 해시로 드문드문
            wx, wy = X0 + xx, Y0 + yy
            t = hf('tw', wx // 9, wy // 9, sp)
            if t < 0.10 and sp in ('bl', 'mp', 'sk', 'mx', 'mh') and (wx % 9) in (3, 4, 5) and (wy % 9) in (3, 4, 5) and abs((wx % 9) - 4) == (wy % 9) - 3:
                out[yy, xx, :3] = trunk_r[1 + (1 if (wx % 9) < 4 else 0)]; out[yy, xx, 3] = 255; continue
            # 속 틈 = 깊은 그늘 잎(검은 구멍이 아니라 아주 어두운 잎 결)
            lv, le, _, _ = leaf(wx, wy, sp, 3)
            deep = PAL[DEEP[sp]]
            out[yy, xx, :3] = deep[int(np.clip(round(2.2 + 1.6 * lv - 2.0 * le), 0, 5))]; out[yy, xx, 3] = 255
    for yy in range(T):
        for xx in range(T):
            L = lev[yy, xx]
            if L < 0: continue
            if L == 200: out[yy, xx, :3] = trunk_r[2]
            elif L >= 100: out[yy, xx, :3] = pal_hi[L - 100]
            else: out[yy, xx, :3] = PAL[fam[yy, xx]][L]
            out[yy, xx, 3] = 255
    # 대숲: 잎 덩이 위 깃털 획(세계 좌표 선분)
    if sp == 'bb':
        _bamboo_strokes(out, lev, X0, Y0)
    # 윤곽: 칸 안 투명 화소나 바깥 칸에 닿은 화소를 한두 단 어둡게(오른쪽·아래쪽 면은 더)
    _outline(out, lev, fam, g)
    # 4) 남쪽 줄기 띠
    if s_edge:
        _band(out, sp, cx, cy, g, n_edge)
    return out


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


def _band(out, sp, cx, cy, g, n_edge):
    """남쪽 가장자리 칸: 세계 x 물결 선 아래 = 줄기·덤불·그늘 점. 줄기·덤불은 이 칸 안에서 끝난다."""
    X0, Y0 = cx * T, cy * T
    spec = SPECIES[sp]
    shade = PAL['shade']
    prof = [int(6 + 2.5 * math.sin((X0 + x) * 0.21 + 1.3) + 1.5 * math.sin((X0 + x) * 0.53)) for x in range(T)]
    if n_edge:
        prof = [p - 1 for p in prof]
    # 물결 선 아래: 지우고 그 바로 위 두 줄은 수관 밑면(어둡게)
    for x in range(T):
        p = max(3, min(10, prof[x]))
        for y in range(T):
            if y >= p:
                out[y, x] = 0
            elif y >= p - 2 and out[y, x, 3]:
                out[y, x, :3] = (np.array(out[y, x, :3], int) * 0.62).astype(np.uint8)
        # 잎 방울: 세계 해시로 1~2px 아래로 처진 잎
        if hf('drip', X0 + x, sp) < 0.25 and out[p - 1, x, 3]:
            out[p, x] = out[p - 1, x]
            if hf('drip2', X0 + x, sp) < 0.4 and p + 1 < T: out[p + 1, x] = out[p - 1, x]
    # 그늘: 수관 밑 2~3줄은 잡음 섞인 짙은 그늘 땅(불투명), 그 아래 2줄은 성긴 그늘 점(잡음, 체커 아님)
    for y in range(T):
        for x in range(T):
            if out[y, x, 3]: continue
            p = prof[x]
            wx, wy = X0 + x, Y0 + y
            depth = 2 + (1 if hf('sd', wx, sp) < 0.5 else 0)
            if p <= y < p + depth:
                out[y, x, :3] = shade[0 if hf('s0', wx, wy) < 0.45 else 1]; out[y, x, 3] = 255
            elif p + depth <= y < p + depth + 2 and hf('s1', wx, wy) < (0.45 if y == p + depth else 0.2):
                out[y, x, :3] = shade[1 if hf('s2', wx, wy) < 0.5 else 2]; out[y, x, 3] = 255
    trunk = PAL[spec['trunk']]
    # 줄기: 칸마다 0~2 그루, 칸 안에서 뿌리까지 끝난다
    kind = sp
    ntr = 1 + (1 if hf('nt', cx, cy, sp) < 0.35 else 0) - (1 if hf('n0', cx, cy, sp) < 0.15 else 0)
    if kind == 'sg': ntr = 2
    if kind == 'bb' or n_edge: ntr = 0
    used = []
    for t in range(ntr):
        w = {'sg': 3, 'sk': 4, 'mp': 4}.get(kind, 4 + (1 if hf('tw', cx, t, sp) < 0.5 else 0))
        x0 = 2 + int(hf('tx', cx, cy, t, sp) * (T - w - 4))
        if any(abs(x0 - u) < w + 2 for u in used): continue
        # 수관이 바로 위에 없는 줄기는 세우지 않는다(외딴 줄기 막대)
        if not all(out[max(0, prof[x0 + i] - 1), x0 + i, 3] for i in range(w)): continue
        used.append(x0)
        top = max(prof[x0], prof[min(T - 1, x0 + w - 1)]) - 2
        for y in range(top, 15):
            for i in range(w):
                x = x0 + i
                lit = 4 if i == 0 else 3 if i == 1 else 2 if i < w - 1 else 1
                if y < top + 3: lit -= 1                     # 수관 그늘 속 줄기 윗부분
                if kind == 'sg' and (y + i) % 3 == 0: lit -= 1  # 삼나무 세로 결
                out[y, x, :3] = trunk[max(0, min(len(trunk) - 1, lit))]; out[y, x, 3] = 255
        # 뿌리: 13~15 줄에 좌우로 벌어짐
        for k, (dx, y) in enumerate(((-1, 13), (w, 13), (-2, 14), (w + 1, 14), (-1, 14), (w, 14))):
            x = x0 + dx
            if 0 <= x < T and kind != 'sg' or (0 <= x < T and k < 2):
                out[y, x, :3] = trunk[1 if dx < 0 else 0]; out[y, x, 3] = 255
    if kind == 'bb':
        _culms(out, prof, X0, Y0)
    # 덤불·고사리: 칸 안의 작은 덩이(14~15 줄 근처), 줄기 앞
    leafp = PAL['keyaki_b'] if kind not in ('sg', 'bb') else PAL['sugi'] if kind == 'sg' else PAL['bamboo']
    nb = 4 if n_edge else 2
    for b in range(nb):
        if not n_edge and hf('bu', cx, cy, b, sp) < 0.35: continue
        if n_edge:
            bx = 2 + b * 4 + (hf('bx', cx, cy, b, sp) - 0.5) * 2; by = 10.5 + hf('by', cx, cy, b, sp) * 2; br = 3.4 + hf('br', cx, b, sp) * 1.2
        else:
            bx = 2 + hf('bx', cx, cy, b, sp) * 12; by = 13.2 + hf('by', cx, cy, b, sp) * 1.2; br = 2.2 + hf('br', cx, b, sp) * 1.3
        bx = min(max(bx, br), T - br)
        for y in range(T):
            for x in range(T):
                d = math.hypot(x + 0.5 - bx, y + 0.5 - by)
                if d <= br and y < T:
                    lam = -0.5 * (x + 0.5 - bx) / br - 0.7 * (y + 0.5 - by) / br
                    L = int(np.clip(8 + lam * 6 + (hf('bn', X0 + x, Y0 + y) - 0.5) * 3, 2, 16))
                    if d > br - 1 and (x + 0.5 > bx or y + 0.5 > by): L = max(1, L - 4)
                    out[y, x, :3] = leafp[L]; out[y, x, 3] = 255
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
    for py in range(PH):
        for px in range(PW):
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
            t = tiles[(m, wx % PW, wy % PH)] if tiles is not None else render_cell(sp, m, wx % PW, wy % PH)
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
