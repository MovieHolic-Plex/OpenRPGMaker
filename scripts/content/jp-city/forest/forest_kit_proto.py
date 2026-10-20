#!/usr/bin/env python3
"""jp_city 숲 키트 시제품 r1 — 이어지는 수관 오토타일(8방 canon 47 + 몸통 변형) + 앞줄 줄기 띠.

왜: 지금 jp_city 숲은 나무 한 그루짜리 키트(윤곽선·발치 둔덕·원형 수관)를 흩뿌린 것이라
    빽빽하게 깔아도 「막대사탕 무리」가 되고, 수관 사이로 잔디가 보인다(진단: forest_kit_proto 의 before 그림).
    SNES 시대 16px RPG 의 숲은 수관을 지형처럼 칠한다 — 속은 이음새 없는 잎 덩이 질감, 위 가장자리는 햇빛 받은 덩이 혹,
    좌우는 잎 끝, 아래 가장자리는 짙은 그늘과 앞줄 줄기(숲 벽). 이 파일은 그 문법을 jp_city 팔레트로 시험한다.

그림은 코드 손 도트(위치 해시, 난수 없음). 색은 jp_city 계약 재료 + 보조 램프(ki·kokuban·sumi)만 쓴다.
시제품이다 — 시트에 굽지 않고, 번들·지도에 넣지 않는다. 사람이 고르기 전 비교 그림만 낸다.

  python3 scripts/content/jp-city/forest/forest_kit_proto.py [--out DIR]
  대숲 「지금」 그림은 #3026 브랜치의 시트·정의를 쓴다:
    mkdir -p /tmp/jpf/pr3026 && git show origin/fix/jp-shitamachi-bamboo-vqa:public/assets/jp-city/jp-city-chipset.png > /tmp/jpf/pr3026/sheet.png
    git show origin/fix/jp-shitamachi-bamboo-vqa:src/assets/jpCityTileset.json > /tmp/jpf/pr3026/ts.json   (경로는 JPF_PR3026 로 바꿀 수 있다)
"""
import json
import math
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
sys.path.insert(0, str(HERE.parent))
from lib_blocks import ground_autotile as GA  # noqa: E402
from lib_blocks.ground_autotile import CANON, canon, mask_at, depth_at, cell_hash  # noqa: E402

OUT = ROOT / 'tiledata' / 'jp-city' / 'forest-proto'


# ───────────────────────── 팔레트 ─────────────────────────
def hx(h):
    return (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16), 255)


_CONTRACT = json.load(open(ROOT / 'tiledata' / 'jp-city' / 'palette-contract.json', encoding='utf-8'))
MAT = {m['id']: [hx(h) for h in m['steps']] for f in _CONTRACT['families'] for m in f['materials']}


def R(name, i):
    """계약 재료면 MAT, 아니면 modern3 보조 램프(GA.RAMPS)."""
    if name in MAT:
        r = MAT[name]
    else:
        r = [(*c, 255) for c in GA.RAMPS[name]]
    return r[max(0, min(len(r) - 1, i))]


TRANSPARENT = (0, 0, 0, 0)
INK = R('sumi', 1)          # 윤곽(jp_city ink)
DEEP = R('kokuban', 0)      # 수관 속 가장 깊은 그늘 — 검정이 아닌 짙은 청록(버들항 틈 색에 가깝게)

# 활엽(느티·졸참 혼효림) 잎 단: 0 가장 어두움 … 7 햇빛 끝. 그늘은 청록(ki/kokuban), 빛은 이끼 쪽 노랑으로 기운다.
LEAF = {
    'broadleaf': [R('ki', 0), R('ki', 1), R('ki', 2), R('ki', 3), R('ki', 4), R('moss', 3), R('ki', 5), R('moss', 4)],
    # 대숲: 전체가 밝고 노랗다(대나무 잎은 얇아 빛이 비친다). 그늘은 kokuban 으로 차갑게.
    'bamboo': [R('kokuban', 0), R('kokuban', 1), R('ki', 2), R('ki', 3), R('moss', 2), R('ki', 4), R('moss', 3), R('ki', 6)],
}


def h01(x, y, s):
    return GA.h01(x, y, s)


# ───────────────────────── 잎 덩이(크라운) 그리기 ─────────────────────────
def _wrap(v):
    return v % 16


def _lv_color(kind, L, x, y, s=0, hue=None):
    """단 L(0..7) → 색. 잎 덩이마다 차가운 ki / 따뜻한 moss 쪽을 정한다(hue 0..1) — 화소마다 섞으면 소금 후추 잡티가 된다."""
    L = max(0, min(7, int(L)))
    k = h01(x, y, 300 + s) if hue is None else hue
    if kind == 'broadleaf':
        table = {0: [R('kokuban', 0), R('ki', 1)], 1: [R('kokuban', 1), R('ki', 1), R('ki', 1), R('ki', 1)], 2: [R('kokuban', 2), R('ki', 2), R('ki', 2), R('moss', 1)],
                 3: [R('ki', 3), R('ki', 3), R('ki', 3), R('moss', 2)], 4: [R('ki', 4), R('ki', 4), R('ki', 4), R('moss', 3)],
                 5: [R('ki', 5), R('ki', 5), R('moss', 3)], 6: [R('ki', 5), R('moss', 4)], 7: [R('moss', 4), R('ki', 6)]}
    else:
        table = {0: [R('kokuban', 0), R('ki', 0)], 1: [R('kokuban', 1), R('ki', 1)], 2: [R('ki', 2), R('kokuban', 2)],
                 3: [R('ki', 3), R('moss', 2)], 4: [R('ki', 4), R('moss', 3)], 5: [R('moss', 3), R('ki', 5)],
                 6: [R('ki', 5), R('moss', 4)], 7: [R('moss', 4), R('ki', 6)]}
    opts = table[L]
    return opts[int(k * len(opts)) % len(opts)]


def crown_levels(W, H, cx, cy, rx, ry, seed, kind='broadleaf', sub=None, wrap=False, lv=None, own=None, macro=1.0, hue=None, bias=0.0, light=None, crescent=1.0):
    """하나의 수관(지름 수십 px)을 작은 잎 덩이 여럿의 겹침으로 그린다 → 단(level) 배열.
    덩이마다: 잎 끝 톱니 윤곽, 왼쪽 위 초승달 빛, 몸통 평면, 오른쪽 아래 테두리 한 단 어둡게(덩이 사이 틈).
    덩이 하나는 한 색 계열(hue)로 칠한다. lv/own/hue 에 덧그린다."""
    if lv is None: lv = np.full((H, W), -1, np.int16)
    if own is None: own = np.zeros((H, W), bool)
    if hue is None: hue = np.zeros((H, W), np.float32)
    lcx, lcy, lrx, lry = light or (cx, cy, rx, ry)     # 빛 계산용 타원(덩이 무리 전체) — 둥근 공 명암을 피하려고 엽(lobe)과 분리
    sub = sub or (3.4 if kind == 'broadleaf' else 2.7)
    pts = []
    step = sub * 1.3
    if wrap:
        n = max(2, round(W / step))
        for j in range(n):
            for i in range(n):
                px = (i + 0.5 + (j % 2) * 0.5 + (h01(i, j, seed) - 0.5) * 0.7) * W / n
                py = (j + 0.5 + (h01(i, j, seed + 1) - 0.5) * 0.6) * H / n
                pts.append((px, py, sub * (0.8 + h01(i, j, seed + 2) * 0.5)))
    j = 0
    yy = cy - ry
    while yy <= cy + ry and not wrap:
        xx = cx - rx + (h01(j, 3, seed + 9)) * step
        while xx <= cx + rx:
            ox = (h01(int(xx * 7), int(yy * 7), seed) - 0.5) * step * 1.1
            oy = (h01(int(xx * 5), int(yy * 11), seed + 1) - 0.5) * step * 1.1
            px, py = xx + ox, yy + oy
            if ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 <= 1.0:
                r = sub * (0.75 + h01(int(px * 3), int(py * 3), seed + 2) * 0.6)
                pts.append((px, py, r))
            xx += step
        yy += step * (0.7 + 0.25 * h01(j, 5, seed + 4))
        j += 1
    pts.sort(key=lambda p: (p[1], p[0]))
    for i, (px, py, r) in enumerate(pts):
        hv = h01(i, int(px), seed + 6)
        hl = h01(i, int(py), seed + 8) < crescent
        hl_cut = 0.35 + h01(i, 2, seed + 9) * 0.35          # 초승달 두께도 덩이마다 다르게
        for dy in range(-int(r) - 2, int(r) + 3):
            for dx in range(-int(r) - 2, int(r) + 3):
                d = math.hypot(dx, dy)
                ang = math.atan2(dy, dx)
                jag = (h01(int((ang + 4) * 2.2), i, seed + 3) - 0.5) * 1.6
                if d > r + jag: continue
                x, y = int(round(px + dx)), int(round(py + dy))
                if wrap: x, y = x % W, y % H
                if not (0 <= x < W and 0 <= y < H): continue
                mx, my = (px + dx - lcx) / lrx, (py + dy - lcy) / lry
                lm = -(mx * 0.6 + my * 0.8)
                lx = -(dx / max(r, 1) * 0.6 + dy / max(r, 1) * 0.8)
                base = 2.7 + bias + lm * 1.5 * macro
                if hl and lx > hl_cut: base += 1.0           # 왼쪽 위 초승달(덩이마다 있거나 없음)
                elif lx < -0.35: base -= 1.2                 # 오른쪽 아래 그늘
                if kind == 'bamboo' and (dx - dy + i) % 3 == 0 and lx > -0.3: base += 0.8   # 가는 사선 잎
                if d > r + jag - 1.1 and (dx + dy) > 0:
                    base = min(base - 1.0, 1.8)               # 덩이 틈
                lv[y, x] = int(math.floor(max(0, min(7, base + 0.5))))
                own[y, x] = True
                hue[y, x] = hv
    if kind == 'broadleaf':
        for i, (px, py, r) in enumerate(pts):          # 해 드는 덩이 머리에만 잎 끝 2점
            mx, my = (px - lcx) / lrx, (py - lcy) / lry
            if -(mx * 0.6 + my * 0.8) * macro < 0.15: continue
            for (ox, oy) in ((-1, -r + 0.8), (0, -r + 0.8)):
                x, y = int(round(px + ox)), int(round(py + oy))
                if wrap: x, y = x % W, y % H
                if 0 <= x < W and 0 <= y < H and lv[y, x] >= 4: lv[y, x] = min(7, lv[y, x] + 2)
    return lv, own


def fill_holes(own):
    """덩이 안 구멍(톱니 윤곽이 만든 1~3px 빈칸)을 메운다 — 바깥과 이어진 빈칸만 남긴다."""
    H, W = own.shape
    out = np.zeros((H + 2, W + 2), bool)
    st = [(0, 0)]
    out[0, 0] = True
    pad = np.zeros((H + 2, W + 2), bool); pad[1:-1, 1:-1] = own
    while st:
        x, y = st.pop()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            xx, yy = x + dx, y + dy
            if 0 <= xx < W + 2 and 0 <= yy < H + 2 and not pad[yy, xx] and not out[yy, xx]:
                out[yy, xx] = True; st.append((xx, yy))
    return ~out[1:-1, 1:-1]


def lobed_crown(W, H, cx, cy, rx, ry, seed, kind, lv, own, hue, macro=0.8, bias=0.0, bites=2):
    """수관 하나 = 크기·자리가 다른 엽(lobe) 3~5개의 비대칭 무리 + 아래·오른쪽 오목한 이 빠짐.
    빛은 무리 전체 타원으로 계산해 엽마다 공 명암이 생기지 않게 한다."""
    n = 3 + int(h01(seed, 1, 501) * 3)
    lobes = [(cx - rx * 0.1, cy - ry * 0.1, rx * 0.74, ry * 0.7)]
    for k in range(n - 1):
        ang = -2.6 + k * (5.2 / max(1, n - 2)) + (h01(k, seed, 502) - 0.5) * 0.9
        d = 0.38 + h01(k, seed, 503) * 0.2
        rr = 0.42 + h01(k, seed, 504) * 0.2
        lobes.append((cx + math.cos(ang) * rx * d, cy + math.sin(ang) * ry * d * 0.9 + ry * 0.05, rx * rr, ry * rr * 0.95))
    mine = np.zeros((H, W), bool)
    for li, (lx, ly, lrx, lry) in enumerate(sorted(lobes, key=lambda t: t[1])):
        lv, mine = crown_levels(W, H, lx, ly, max(3, lrx), max(3, lry), seed + li * 13, kind, lv=lv, own=mine, hue=hue, macro=macro, bias=bias,
                                light=(cx, cy, rx, ry))
    # 오목한 이 빠짐: 아래·오른쪽 윤곽 몇 곳을 반경 2~3 으로 덜어낸다(덜어낸 자리는 원래 바닥)
    filled = fill_holes(mine)
    for b in range(bites):
        ang = 0.2 + b * 1.4 + (h01(b, seed, 505) - 0.5) * 0.8
        bx, by = cx + math.cos(ang) * rx * 0.95, cy + math.sin(ang) * ry * 0.95
        br = 2.2 + h01(b, seed, 506) * 1.3
        for y in range(int(by - br - 1), int(by + br + 2)):
            for x in range(int(bx - br - 1), int(bx + br + 2)):
                if 0 <= x < W and 0 <= y < H and math.hypot(x - bx, y - by) <= br and mine[y, x]:
                    filled[y, x] = False
    newly = filled & ~mine
    lv[newly] = 2
    own |= filled
    return lv, own


def draw_leaf(lv, hue, x0, y0, dx, ln, lvl, hv, wrap=True, droop=0.45):
    """대나무 잎 한 장: 가늘고 긴 피침형 사선(위 줄 밝게, 밑 줄 한 단 어둡게, 끝은 1px)."""
    H, W = lv.shape
    for k in range(ln):
        x = x0 + dx * k
        y = y0 + int(round(k * droop))
        for (yy, L) in ((y, lvl), (y + 1, lvl - 2)):
            if k == ln - 1 and yy != y: continue
            if k == 0 and yy != y: continue
            xx, yq = (x % W, yy % H) if wrap else (x, yy)
            if 0 <= xx < W and 0 <= yq < H:
                lv[yq, xx] = max(0, min(7, L - (1 if k == ln - 1 else 0)))
                hue[yq, xx] = hv


def draw_spray(lv, hue, x, y, n, seed, wrap=True, bright=0, length=(4, 6)):
    """잎 다발: 한 점(마디)에서 좌우 아래로 늘어진 잎 n 장."""
    for k in range(n):
        side = -1 if (k + seed) % 2 else 1
        ln = length[0] + int(h01(k, seed, 401) * (length[1] - length[0] + 1))
        oy = int(h01(k, seed, 402) * 3) - 1
        ox = int(h01(k, seed, 403) * 3) - 1
        lvl = 5 + bright + (1 if h01(k, seed, 404) < 0.35 else 0) - (1 if h01(k, seed, 405) < 0.25 else 0)
        draw_leaf(lv, hue, x + ox, y + oy + k // 2, side, ln, lvl, h01(k, seed, 406), wrap, droop=0.35 + 0.3 * h01(k, seed, 407))


def bamboo_texture(variant=0):
    """대숲 몸통 칸: 빽빽이 선 대나무를 3/4 로 내려다본 결.
    줄기 다섯(앞 굵은 둘·뒤 가는 셋)은 칸 위아래로 끊김 없이 이어지는 16 주기 공통부이고,
    variant 는 마디 자리와 칸 안쪽 잎 다발만 바꾼다(경계 화소는 같음 → 이음새 없음)."""
    lv = np.full((16, 16), 1, np.int16)
    hue = np.zeros((16, 16), np.float32)
    for y in range(16):
        for x in range(16):
            k = h01(x, y // 2, 411)
            lv[y, x] = 2 if k < 0.25 else 0 if k > 0.85 else 1
            hue[y, x] = 0.1
    culms = [(0, 1, 0), (2, 2, 1), (6, 1, 0), (9, 3, 1), (14, 1, 0)]
    for ci, (cx, cw, front) in enumerate(culms):
        nodes = {(int(h01(ci, variant, 413) * 8) + 3 + 8 * t) % 16 for t in range(2)}
        for y in range(16):
            for i in range(cw):
                if front: L = 6 if i == 0 else 4
                else: L = 3
                if 1 <= y <= 14 and y in nodes: L = 1 if front else 0
                elif 1 <= y + 1 <= 14 and (y + 1) in nodes: L = 7 if front else 4
                lv[y, cx + i] = L
                hue[y, cx + i] = 0.2 if front else 0.9
            if front: lv[:, (cx + cw) % 16] = np.minimum(lv[:, (cx + cw) % 16], 1)   # 앞 줄기 오른쪽 그늘
    # 공통 잎 다발(경계를 넘는 것) — 높이를 엇갈려 가로 띠가 생기지 않게
    # variant 별 잎 다발(칸 안쪽) — 자리·장 수가 달라 같은 「V」 무늬가 줄 서지 않는다
    for (sx, sy, n) in [((3, 4, 4), (11, 8, 3)), ((10, 3, 4), (4, 9, 2)), ((12, 4, 2), (5, 7, 4)), ((5, 2, 3), (10, 9, 4))][variant % 4]:
        sub_lv = lv.copy(); sub_h = hue.copy()
        draw_spray(sub_lv, sub_h, sx, sy, n, 20 + variant * 5 + sx, wrap=False, length=(3, 5))
        m = np.zeros((16, 16), bool); m[1:15, 1:15] = True
        lv = np.where(m, sub_lv, lv); hue = np.where(m, sub_h, hue).astype(np.float32)
    return lv, hue


def leaf_texture(kind, variant=0):
    if kind == 'bamboo':
        return bamboo_texture(variant)
    return _leaf_texture(kind, variant)


def _leaf_texture(kind, variant=0):
    """16 주기 몸통 질감 = 엇갈린 작은 나무 머리(가운데 하나 + 네 모서리를 잇는 하나)의 벽돌 배치.
    SNES 숲 몸통 칸의 문법(칸마다 나무 머리 하나)을 잎 덩이로 그린다. 머리 사이 틈은 깊은 그늘.
    variant 는 가운데 머리만 바꾼다(가장자리 1px 는 variant 0 과 같다 → 이웃과 이어짐). 반환 (단, 색 계열)."""
    seed = 500 if kind == 'broadleaf' else 600
    sub = 2.7 if kind == 'broadleaf' else 2.2
    bias = -0.25 if kind == 'broadleaf' else -0.1

    def make(cseed):
        # 촘촘한 잎 덩이 깔개(주기 격자) — 덩이마다 초승달 빛만, 큰 공 모양 명암 없음
        lv = np.full((16, 16), 1, np.int16)
        hue = np.zeros((16, 16), np.float32)
        lv, _ = crown_levels(16, 16, 8, 8, 10, 10, cseed, kind, sub=sub, wrap=True, lv=lv, macro=0.0, hue=hue, bias=bias, crescent=0.55)
        return lv, hue
    lv, hue = make(seed + 3)
    if variant:
        # 덩이 크기·톱니·빛이 다른 판을 칸 안쪽(경계에서 2~3px 들쭉 안)에만 쓴다 → 경계 화소는 같아 이음새가 없다
        lv2, hue2 = make(seed + 3 + variant * 37)
        for y in range(16):
            for x in range(16):
                d = min(x, y, 15 - x, 15 - y)
                if d >= 2 + (h01(x, y, 520 + variant) < 0.5):
                    lv[y, x] = lv2[y, x]; hue[y, x] = hue2[y, x]
    lv = np.clip(lv, 0, 4)
    if kind == 'broadleaf':
        hue = hue * 0.7            # 그늘 잎은 차가운 쪽만(따뜻한 이끼 사선 줄무늬가 격자로 읽혔다)
    else:
        for (x0, y0, ln) in ((14, 5, 4), (6, 13, 4))[: 2 - (variant % 2)]:
            for jj in range(ln):
                y = _wrap(y0 + jj)
                lv[y, _wrap(x0)] = 6 if jj != ln // 2 else 0
                lv[y, _wrap(x0 + 1)] = 3 if jj != ln // 2 else 0
                hue[y, _wrap(x0)] = 0.99; hue[y, _wrap(x0 + 1)] = 0.99
    return lv, hue


# ───────────────────────── 수관 윤곽(가장자리 혹) ─────────────────────────
_EDGE_CACHE = {}


def _edge_profile(kind, side, nvar=0):
    """16 주기 잎 덩이 윗선: 덩이(반경 3~5) 여럿의 머리선 최솟값 + 잎 끝 1px 톱니 → 둥근 물결이 아닌 들쭉 잎 덩이 윤곽."""
    key = (kind, side, nvar)
    if key in _EDGE_CACHE: return _EDGE_CACHE[key]
    seed = {'N': 801, 'S': 802, 'W': 803, 'E': 804}[side] + (0 if kind == 'broadleaf' else 50)
    if kind == 'broadleaf':
        cl = {'N': [(2.5, 6.0, 4.8), (8.0, 5.0, 5.6), (13.2, 6.3, 4.4)],
              'S': [(3.0, 4.2, 3.6), (9.5, 3.8, 4.4), (14.5, 4.6, 3.2)],
              'W': [(3.5, 4.4, 4.2), (10.5, 3.6, 4.6)],
              'E': [(4.5, 4.4, 4.4), (11.5, 3.8, 4.2)]}[side]
    else:
        cl = {'N': [(1.5, 5.0, 3.0), (5.5, 4.0, 3.4), (10.0, 5.2, 3.2), (14.0, 4.4, 3.0)],
              'S': [(2.0, 3.0, 2.4), (6.5, 2.6, 2.8), (11.0, 3.2, 2.4), (14.5, 2.8, 2.2)],
              'W': [(2.0, 3.6, 3.0), (7.5, 3.0, 3.2), (12.5, 3.8, 3.0)],
              'E': [(3.0, 3.4, 3.0), (8.5, 3.6, 3.2), (13.5, 3.0, 3.0)]}[side]
    if nvar:
        # 위 가장자리 변형: 가운데 덩이만 자리·크기를 바꾼다(양 끝 2px 은 기본형과 같게 맞춘다)
        alt = {1: [(2.5, 6.0, 4.8), (6.5, 4.2, 4.0), (11.0, 3.6, 5.2), (13.8, 6.4, 3.6)],
               2: [(2.5, 6.0, 4.8), (7.0, 6.2, 3.4), (10.0, 4.4, 4.6), (13.2, 6.3, 4.4)],
               3: [(2.5, 6.0, 4.8), (9.0, 2.8, 6.4), (13.2, 6.3, 4.4)]} if kind == 'broadleaf' else {}
        if nvar in alt: cl = alt[nvar]
        seed += nvar * 7
    prof = []
    for u in range(16):
        best = 9.0
        for (c, d, r) in cl:
            for k in (-16, 0, 16):
                dx = u + 0.5 - (c + k)
                if abs(dx) < r:
                    best = min(best, d - math.sqrt(r * r - dx * dx))
        b = best + (1 if h01(u, 7, seed) < 0.28 else 0) - (1 if h01(u, 8, seed) < 0.12 else 0)
        prof.append(max(0, int(round(b))))
    if nvar:
        base = _edge_profile(kind, side, 0)
        prof[0:2] = base[0:2]; prof[14:16] = base[14:16]
    _EDGE_CACHE[key] = prof
    return prof


def edge_depth(u, side, kind, nvar=0):
    """잘린 쪽 가장자리에서 안쪽으로 몇 px 비우는가(16 주기 → 이웃 칸과 이어짐)."""
    return _edge_profile(kind, side, nvar if side == 'N' else 0)[u % 16]


def _cell_inside(m, u, v, kind, nvar=0):
    """마스크 m 인 칸 안의 (u,v) 가 수관인가."""
    n, e, s, w = m & 1, m & 2, m & 4, m & 8
    ne, se, sw, nw = m & 16, m & 32, m & 64, m & 128
    if not n and v < edge_depth(u, 'N', kind, nvar): return False
    if not s and 15 - v < edge_depth(u, 'S', kind): return False
    if not w and u < edge_depth(v, 'W', kind): return False
    if not e and 15 - u < edge_depth(v, 'E', kind): return False
    R0 = 6.5
    for (has_a, has_b, cx, cy) in ((n, w, 0, 0), (n, e, 15, 0), (s, w, 0, 15), (s, e, 15, 15)):
        if not has_a and not has_b:
            ox = R0 if cx == 0 else 15 - R0
            oy = R0 if cy == 0 else 15 - R0
            if (u < ox if cx == 0 else u > ox) and (v < oy if cy == 0 else v > oy):
                if math.hypot(u - ox, v - oy) > R0 + (h01(u, v, 91) - 0.5) * 1.0: return False
    for (has_a, has_b, has_d, cx, cy) in ((n, w, nw, 0, 0), (n, e, ne, 15, 0), (s, w, sw, 0, 15), (s, e, se, 15, 15)):
        if has_a and has_b and not has_d:
            du = u if cx == 0 else 15 - u
            dv = v if cy == 0 else 15 - v
            if du + dv < 3 + (h01(u, v, 92) > 0.5): return False
    return True


def _mini_grid(m):
    g = np.zeros((5, 5), bool)
    g[2, 2] = True
    off = dict(N=(0, -1), E=(1, 0), S=(0, 1), W=(-1, 0), NE=(1, -1), SE=(1, 1), SW=(-1, 1), NW=(-1, -1))
    for name, (dx, dy) in off.items():
        if m & GA.DIRS[name]: g[2 + dy, 2 + dx] = True
    for y in range(5):
        for x in range(5):
            if 1 <= x <= 3 and 1 <= y <= 3: continue
            cx, cy = min(3, max(1, x)), min(3, max(1, y))
            g[y, x] = g[cy, cx]
    return g


def _inside_global(g, X, Y, kind, nvar=0, center=(2, 2)):
    cx, cy = X // 16, Y // 16
    h, w = g.shape
    if not (0 <= cx < w and 0 <= cy < h) or not g[cy, cx]: return False
    return _cell_inside(mask_at(g, cx, cy), X % 16, Y % 16, kind, nvar if (cx, cy) == center else 0)


def render_levels(lv, ins, kind, pad=2, hue=None):
    """단 배열 lv(HxW) + 안/밖 ins((H+2pad)x(W+2pad)) → RGBA. 윤곽은 sumi, 위 가장자리 밝게·아래·오른쪽 어둡게.
    색 해시는 (x%16, y%16) 로 → 같은 칸 자리는 같은 색(이음새)."""
    H, W = lv.shape
    a = np.zeros((H, W, 4), np.uint8)
    for v in range(H):
        for u in range(W):
            I = lambda dx, dy: ins[v + pad + dy, u + pad + dx]
            if not I(0, 0): continue
            if not (I(0, -1) and I(0, 1) and I(-1, 0) and I(1, 0)):
                a[v, u] = INK
                continue
            L = int(lv[v, u])
            if not I(0, -2): L = min(7, L + 2)
            elif pad >= 3 and not I(0, -3): L = min(7, L + 1)
            if not I(0, 2): L = max(0, L - 2)
            elif not I(1, 1): L = max(0, L - 1)
            if not I(2, 0): L = max(0, L - 1)
            if not I(-2, 0): L = min(7, L + 1)
            a[v, u] = _lv_color(kind, L, u % 16, v % 16, hue=None if hue is None else float(hue[v, u]))
    return a


def paint_canopy_tile(m, kind, tex, nvar=0):
    g = _mini_grid(m)
    pad = 3
    ins = np.zeros((16 + 2 * pad, 16 + 2 * pad), bool)
    for j in range(16 + 2 * pad):
        for i in range(16 + 2 * pad):
            ins[j, i] = _inside_global(g, 32 + i - pad, 32 + j - pad, kind, nvar)
    a = render_levels(tex[0], ins, kind, pad, tex[1])
    if not m & 4:
        _under_shade(a, m, kind)
    return a


def _under_shade(a, m, kind):
    """아래가 잘린 칸: 잎 아래를 깊은 그늘로 채운다(줄기 띠 윗부분과 이어짐)."""
    for u in range(16):
        col = [v for v in range(16) if a[v, u, 3]]
        if not col: continue
        top = max(col)
        for v in range(top + 1, 16):
            if (not m & 8 and u < max(3, edge_depth(v, 'W', kind))) or (not m & 2 and u > min(12, 15 - edge_depth(v, 'E', kind))):
                continue
            a[v, u] = DEEP if h01(u, v, 95) > 0.15 else R('kokuban', 0)


def build_canopy(kind):
    """canon 47 + 몸통 변형(얕은/깊은 두 단 × 4)."""
    tex = [leaf_texture(kind, v) for v in range(4)]
    tiles = {m: paint_canopy_tile(m, kind, tex[0]) for m in CANON}
    interior = []
    for tier in range(2):
        row = []
        for v in range(4):
            t = paint_canopy_tile(255, kind, tex[v])
            row.append(t)
        interior.append(row)
    return tiles, interior, tex


# ───────────────────────── 수관 덩이 키트(몸통 위 큰 머리) ─────────────────────────
def _tiled_tex(tex, W, H):
    return np.tile(tex, (H // 16, W // 16))


CROWN_LAYOUTS = {
    'broadleaf': {
        'c2x2': (2, 2, [(16, 15, 13.5, 12.5)]),
        'c3x2': (3, 2, [(14, 15, 12.5, 12), (33, 17, 13, 12)]),
        'c2x3': (2, 3, [(16, 14, 13, 11.5), (16, 32, 13.5, 13)]),
        'c3x3': (3, 3, [(14, 14, 12, 11.5), (34, 15, 12.5, 12), (24, 32, 17, 13.5)]),
    },
    'bamboo': {
        'c2x2': (2, 2, [(16, 16, 11.5, 10.5)]),
        'c3x2': (3, 2, [(14, 16, 10, 10), (33, 15, 11, 10)]),
        'c3x3': (3, 3, [(16, 14, 11, 10), (33, 26, 11, 11.5), (14, 34, 10, 9.5)]),
    },
}


def crown_patch(kind, key, tex, seed):
    """몸통 칸(마스크 255)들 위에 놓는 수관 머리 키트. 바깥 2px 는 몸통 질감 그대로라 이웃과 이어진다."""
    w, h, crowns = CROWN_LAYOUTS[kind][key]
    W, H = w * 16, h * 16
    base = _tiled_tex(tex[0], W, H)
    bhue = _tiled_tex(tex[1], W, H)
    lv = base.copy()
    hue = bhue.copy()
    if kind == 'bamboo':
        # 대숲 머리: 햇빛 받은 우듬지 잎 부채(잎 장 5~7, 3단 명암, 잎 사이 짙은 틈) — 점묘 없이 잎 장으로만
        for ci, (cx, cy, rx, ry) in enumerate(crowns):
            k = 0
            for j in range(max(1, int(ry * 2 / 6))):
                for i in range(max(1, int(rx * 2 / 7))):
                    px = int(cx - rx + 4 + i * 7 + (j % 2) * 3 + (h01(i, j, seed + ci) - 0.5) * 2)
                    py = int(cy - ry + 3 + j * 6 + (h01(j, i, seed + ci + 1) - 0.5) * 2)
                    if ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 > 0.8: continue
                    br = 1 if ((px - cx) / rx * 0.6 + (py - cy) / ry * 0.8) < 0 else 0
                    # 잎 아래 틈 그늘 먼저
                    for dx in range(-4, 5):
                        for dy in range(1, 4):
                            xx, yy = px + dx, py + dy + abs(dx) // 2
                            if 0 <= xx < W and 0 <= yy < H and h01(xx, yy, seed + 3) < 0.6: lv[yy, xx] = min(lv[yy, xx], 1)
                    draw_spray(lv, hue, px, py, 6, seed + ci * 31 + k, wrap=False, bright=br, length=(4, 7))
                    k += 1
        for sl in (np.s_[:2, :], np.s_[-2:, :], np.s_[:, :2], np.s_[:, -2:]):
            lv[sl] = base[sl]; hue[sl] = bhue[sl]
        ins = np.ones((H + 6, W + 6), bool)
        return render_levels(lv, ins, kind, 3, hue)
    for ci, (cx, cy, rx, ry) in enumerate(crowns):
        # 그림자: 수관 오른쪽 아래로 몸통 질감을 한 단 눌러 둔다
        for y in range(H):
            for x in range(W):
                if ((x - cx - 2) / (rx + 1)) ** 2 + ((y - cy - 3) / (ry + 1)) ** 2 <= 1:
                    lv[y, x] = max(0, lv[y, x] - 1)
        tmp_own = np.zeros((H, W), bool)
        lv, _ = lobed_crown(W, H, cx, cy, rx, ry, seed + ci * 17, kind, lv, tmp_own, hue, macro=1.0, bias=0.3, bites=0)
    for sl in (np.s_[:2, :], np.s_[-2:, :], np.s_[:, :2], np.s_[:, -2:]):
        lv[sl] = base[sl]; hue[sl] = bhue[sl]
    ins = np.ones((H + 6, W + 6), bool)
    return render_levels(lv, ins, kind, 3, hue)


def edge_crown_kit(kind, tex, seed, wide=2):
    """위 가장자리(마스크 110: 위·위 대각만 빔) 칸 wide 개 + 그 밑 몸통 칸 → 하늘선 위로 솟은 수관 머리.
    좌우 끝 2열은 표준 가장자리 윤곽과 같아 이웃과 이어진다."""
    W, H = wide * 16, 32
    g = np.zeros((4, wide + 2), bool)
    g[1:, :] = True
    pad = 3
    ins = np.zeros((H + 2 * pad, W + 2 * pad), bool)
    for j in range(H + 2 * pad):
        for i in range(W + 2 * pad):
            ins[j, i] = _inside_global(g, 16 + i - pad, 16 + j - pad, kind)
    lv = _tiled_tex(tex[0], W, H).copy()
    hue = _tiled_tex(tex[1], W, H).copy()
    cx, cy, rx, ry = W / 2 - 0.5, 19, W / 2 - 3.5, 15
    hue2 = hue.copy()
    lv2, own = crown_levels(W, H, cx, cy, rx, ry, seed, kind, lv=lv.copy(), hue=hue2)
    for y in range(H):
        for x in range(W):
            if own[y, x] and (3 <= x < W - 3 or ins[y + pad, x + pad]):
                lv[y, x] = lv2[y, x]; hue[y, x] = hue2[y, x]
                ins[y + pad, x + pad] = True
    return render_levels(lv, ins, kind, pad, hue)


# ───────────────────────── 한 그루 나무 키트(성긴 숲·길가) ─────────────────────────
TREE_LAYOUTS = {
    't3x4': (3, 4, [(24, 30, 22, 21)], [(22, 4)]),
    't2x3': (2, 3, [(16, 21, 14.5, 15)], [(14, 3)]),
    't4x4': (4, 4, [(22, 27, 19, 18), (42, 32, 19, 17)], [(20, 4), (41, 4)]),
}


def tree_kit(key, seed, kind='broadleaf'):
    w, h, crowns, trunks = TREE_LAYOUTS[key]
    W, H = w * 16, h * 16
    a = np.zeros((H, W, 4), np.uint8)
    foot = H - 4
    # 땅 그림자(잔디 위 짙은 녹 점묘)
    for (tx, tw) in trunks:
        for y in range(foot - 3, H):
            for x in range(W):
                if ((x - tx - tw / 2 - 3) / (tw * 2.6)) ** 2 + ((y - foot) / 3.2) ** 2 <= 1 and (x + y) % 2 == 0:
                    a[y, x] = R('ki', 2)
    # 줄기
    for (tx, tw) in trunks:
        top = min(cy for (cx, cy, rx, ry) in crowns) + 6
        for y in range(top, foot + 1):
            a[y, tx - 1] = INK; a[y, tx + tw] = INK
            for i in range(tw):
                lvl = 3 if i == 0 else (1 if i == tw - 1 else 2)
                a[y, tx + i] = R('aged_cedar', lvl)
            if (y * 3 + tx) % 7 == 0: a[y, tx + 1] = R('aged_cedar', 1)
        for i in range(-2, tw + 2):
            a[foot, tx + i] = R('aged_cedar', 2) if 0 <= i < tw else INK
            a[foot + 1, tx + i] = INK
    lv = np.full((H, W), -1, np.int16)
    own = np.zeros((H, W), bool)
    hue = np.zeros((H, W), np.float32)
    for ci, (cx, cy, rx, ry) in enumerate(crowns):
        lv, own = lobed_crown(W, H, cx, cy, rx, ry, seed + ci * 23, kind, lv, own, hue)
    # 수관 밑 줄기에 드리운 그늘
    ins = np.zeros((H + 6, W + 6), bool)
    ins[3:-3, 3:-3] = own
    crown = render_levels(np.maximum(lv, 0), ins, kind, 3, hue)
    m = crown[:, :, 3] > 0
    a[m] = crown[m]
    for (tx, tw) in trunks:
        for x in range(tx, tx + tw):
            col = [y for y in range(H) if crown[y, x, 3]]
            if col:
                b = max(col)
                for y in range(b + 1, min(foot, b + 4)):
                    a[y, x] = R('aged_cedar', 0) if y - b < 3 else R('aged_cedar', 1)
    return a


# ───────────────────────── 앞줄 줄기 띠 ─────────────────────────
def trunk_band(kind, part, variant):
    """수관 덩이 아랫줄(S 가장자리) 바로 밑 칸. part: 'L','M','R','one'.
    활엽: 1칸(16x16). 대숲: 2칸(16x32) — 대나무는 키가 커서 3/4 정면이 길다.
    큰 덩이(L/M/R): 줄기 사이가 숲 속 어둠. 'one'(폭 1칸 끝): 줄기 하나 + 잔디."""
    H = 16 if kind == 'broadleaf' else 32
    a = np.zeros((H, 16, 4), np.uint8)
    s = 200 + variant * 13 + (ord(part[0]) * 3)

    def P(x, y, c):
        if 0 <= x < 16 and 0 <= y < H: a[y, x] = c

    open_ = part == 'one'
    x0 = 3 if part in ('L', 'one') else 0
    x1 = 12 if part in ('R', 'one') else 15
    floor_y = H - 4
    if kind == 'broadleaf':
        if not open_:
            for y in range(0, floor_y + 1):
                for x in range(x0, x1 + 1):
                    if part == 'L' and x < x0 + 2 and y > 2 + (x - x0) * 3: continue
                    if part == 'R' and x > x1 - 2 and y > 2 + (x1 - x) * 3: continue
                    P(x, y, DEEP if h01(x, y, s) > 0.18 else R('kokuban', 0))
            # 뒤 줄기(희미)
            for bx in ((2, 12), (6,), (4, 10), (1, 8, 14), (9,), (3, 13))[variant % 6]:
                if x0 + 1 <= bx <= x1 - 1:
                    for y in range(3, floor_y):
                        P(bx, y, R('kokuban', 1)); P(bx + 1, y, R('kokuban', 0))
        else:
            for y in range(0, 4):
                for x in range(5, 11):
                    P(x, y, DEEP)
        for x in range(x0, x1 + 1):
            if h01(x, 0, s + 1) < 0.4: P(x, 0, _lv_color('broadleaf', 2, x, 0))
            if h01(x, 1, s + 2) < 0.15: P(x, 1, _lv_color('broadleaf', 1, x, 1))
        sets = [[(4, 5)], [(11, 4)], [], [(7, 5)], [(2, 3), (12, 4)], []]
        trunks = [(6, 4)] if open_ else sets[variant % 6]
        if part == 'L': trunks = [(max(t[0], 6), t[1]) for t in trunks] or [(8, 4)]
        if part == 'R': trunks = [(min(t[0], 9 - t[1] + 1), t[1]) for t in trunks] or [(5, 4)]
        for tx, tw in trunks:
            for y in range(1, floor_y + 1):
                P(tx - 1, y, INK); P(tx + tw, y, INK)
                for i in range(tw):
                    # 나무껍질: 짙은 밤색(machiya) 몸통 + 왼쪽 1px 빛(aged_cedar) — 분홍빛 기둥이 울타리처럼 줄 서지 않게
                    if i == 0: c = R('aged_cedar', 2) if y >= 5 else R('machiya_timber', 3)
                    elif i == tw - 1: c = R('machiya_timber', 1)
                    else: c = R('machiya_timber', 3) if (i == 1 or (y + i) % 4) else R('machiya_timber', 2)
                    if y < 3: c = R('machiya_timber', 1) if i < tw - 1 else R('machiya_timber', 0)
                    P(tx + i, y, c)
                if (y * 3 + tx) % 7 == 0 and y > 4: P(tx + 1 + (tw > 4), y, R('aged_cedar', 1))
            for i in range(-2, tw + 2):
                P(tx + i, floor_y, R('aged_cedar', 2) if 0 <= i < tw else R('aged_cedar', 1))
            P(tx - 2, floor_y - 1, INK); P(tx + tw + 1, floor_y - 1, INK)
        # 밑줄 덤불·고사리(잔디로 녹는 들쭉 경계)
        for x in range(x0 - 1, x1 + 2):
            if open_ and not (3 <= x <= 12): continue
            hgt = 2 + int(h01(x, 0, s + 5) * 4)
            if part == 'L' and x < x0 + 1: hgt = min(hgt, 2)
            if part == 'R' and x > x1 - 1: hgt = min(hgt, 2)
            for k in range(hgt):
                y = H - 1 - k
                if k == 0 and h01(x, 31, s + 8) < 0.35: continue        # 맨 아랫줄을 들쭉하게(곧은 잔디 줄 없음)
                c = _lv_color('broadleaf', 2 + min(2, k), x, y, 7, hue=0.1)
                if k == hgt - 1 and h01(x, k, s + 6) < 0.35: c = _lv_color('broadleaf', 4, x, y, 8, hue=0.1)
                P(x, y, c)
            if h01(x, 9, s + 7) < 0.75: P(x, H - 1 - hgt, INK)
        return a

    # ── 대숲 줄기 벽 ──
    if not open_:
        for y in range(0, floor_y + 1):
            for x in range(x0, x1 + 1):
                P(x, y, R('kokuban', 1) if h01(x, y, s) > 0.3 else R('kokuban', 0))
        for bx in ((1, 5, 9, 13), (3, 7, 11, 15), (2, 8, 12), (0, 4, 10, 14))[variant % 4]:
            if x0 <= bx <= x1:
                ph = int(h01(bx, 1, s + 3) * 9)
                for y in range(0, floor_y):
                    P(bx, y, R('kokuban', 3) if (y + ph) % 9 else R('kokuban', 1))
    culm_sets = [[(2, 3), (8, 2), (12, 3)], [(1, 2), (5, 3), (11, 2)], [(3, 2), (7, 3), (13, 2)], [(2, 2), (6, 2), (10, 3)]]
    culms = [(5, 2), (9, 2)] if open_ else culm_sets[variant % 4]
    if part == 'L': culms = [c for c in culms if c[0] >= 4] or [(6, 3)]
    if part == 'R': culms = [c for c in culms if c[0] + c[1] <= 11] or [(6, 3)]
    for ci, (cx, cw) in enumerate(culms):
        phase = int(h01(ci, variant, s + 9) * 9)
        back = (ci + variant) % 3 == 2
        foot = floor_y - int(h01(ci, variant, s + 15) * 4)        # 밑동 높이를 엇갈려 아랫선이 자처럼 곧지 않게
        for y in range(0, foot + 1):
            P(cx - 1, y, INK); P(cx + cw, y, INK)
            for i in range(cw):
                if i == 0: c = R('ki', 4) if back else R('moss', 4) if y % 5 else R('ki', 6)
                elif i == cw - 1: c = R('ki', 2) if back else R('moss', 2)
                else: c = R('ki', 3) if back else R('moss', 3)
                P(cx + i, y, c)
            if (y + phase) % 9 == 0 and y > 1:
                for i in range(cw): P(cx + i, y, R('ki', 1))
                for i in range(cw): P(cx + i, y - 1, R('ki', 5) if back else R('ki', 6))
        for y in range(5 + phase % 4, floor_y - 3, 9):
            side = 1 if (ci + y) % 2 else -1
            sx = cx + cw if side > 0 else cx - 2
            for k in range(4):
                P(sx + side * k, y - 1 - k // 2, _lv_color('bamboo', 6 - (k == 3), sx + side * k, y))
            P(sx + side * 2, y, _lv_color('bamboo', 4, sx, y))
    for x in range(x0, x1 + 1):
        if h01(x, 0, s + 11) < 0.55: P(x, 0, _lv_color('bamboo', 3, x, 0))
        if h01(x, 1, s + 12) < 0.3: P(x, 1, _lv_color('bamboo', 2, x, 1))
        if h01(x, 2, s + 13) < 0.12: P(x, 2, _lv_color('bamboo', 4, x, 2))
    for x in range(x0 - 1, x1 + 2):
        if open_ and not (3 <= x <= 12): continue
        hgt = 2 + int(h01(x, 3, s + 13) * 3)
        for k in range(hgt):
            y = H - 1 - k
            P(x, y, _lv_color('bamboo', 3 + min(3, k), x, y, 9))
        if h01(x, 4, s + 14) < 0.6: P(x, H - 1 - hgt, INK)
    if not open_ and variant in (1, 3):
        sx = 5 + variant
        for (dx, dy, c) in ((0, 0, R('aged_cedar', 2)), (1, 0, R('aged_cedar', 1)), (0, -1, R('aged_cedar', 3)), (0, -2, R('aged_cedar', 4)), (-1, 0, INK), (2, 0, INK)):
            P(sx + dx, H - 3 + dy, c)
    return a


def build_bands(kind):
    out = {}
    for part in ('L', 'M', 'R', 'one'):
        for v in range(6 if part == 'M' else 2):
            out[(part, v)] = trunk_band(kind, part, v)
    return out


# ───────────────────────── 시트(바닥·길) ─────────────────────────
class Sheet:
    def __init__(self, png, js):
        self.img = np.array(Image.open(png).convert('RGBA'))
        self.d = json.load(open(js, encoding='utf-8'))
        self.tpr = self.d['tilesPerRow']
        self.kits = {k['id']: k for k in self.d['structureKits']}
        self.at = {a['id']: a for a in self.d['autotileGroups']}

    def tile(self, t):
        y, x = divmod(t, self.tpr)
        return self.img[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16]

    def kit_img(self, kid):
        k = self.kits[kid]
        w, h = k['width'], k['height']
        out = np.zeros((h * 16, w * 16, 4), np.uint8)
        lower = np.zeros_like(out)
        for j, row in enumerate(k['rows']):
            for i in range(w):
                for key, dst in (('tiles', lower), ('upperTiles', out)):
                    t = (row.get(key) or [-1] * w)[i]
                    if t is not None and t >= 0:
                        dst[j * 16:(j + 1) * 16, i * 16:(i + 1) * 16] = self.tile(t)
        return lower, out


def over(dst, src, x, y):
    h, w = src.shape[:2]
    H, W = dst.shape[:2]
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(W, x + w), min(H, y + h)
    if x0 >= x1 or y0 >= y1: return
    s = src[y0 - y:y1 - y, x0 - x:x1 - x]
    m = s[:, :, 3] > 0
    dst[y0:y1, x0:x1][m] = s[m]


TRAIL = 16108


def ground_layer(sheet, W, H, road=None, seed=0):
    img = np.zeros((H * 16, W * 16, 4), np.uint8)
    inter = sheet.at['jp-lawn-dirt']['interiorVariants'][0]
    for y in range(H):
        for x in range(W):
            t = TRAIL if (road is not None and road[y, x]) else inter[cell_hash(x + seed, y) % len(inter)]
            img[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16] = sheet.tile(t)
    return img


# ───────────────────────── 새 키트로 숲 칠하기 ─────────────────────────
def components(g):
    h, w = g.shape
    lab = np.zeros((h, w), int)
    n = 0
    for y in range(h):
        for x in range(w):
            if g[y, x] and not lab[y, x]:
                n += 1
                st = [(x, y)]
                lab[y, x] = n
                while st:
                    cx, cy = st.pop()
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        xx, yy = cx + dx, cy + dy
                        if 0 <= xx < w and 0 <= yy < h and g[yy, xx] and not lab[yy, xx]:
                            lab[yy, xx] = n; st.append((xx, yy))
    return lab, n


class Kit:
    def __init__(self, kind):
        self.kind = kind
        self.tiles, self.interior, self.tex = build_canopy(kind)
        self.bands = build_bands(kind)
        self.n_edge = [self.tiles[EDGE_MASK]] + ([paint_canopy_tile(EDGE_MASK, kind, self.tex[0], v) for v in (1, 2, 3)] if kind == 'broadleaf' else [])
        self.patches = {}
        for key in CROWN_LAYOUTS[kind]:
            for v in range(2):
                self.patches[(key, v)] = crown_patch(kind, key, self.tex[0], 700 + v * 31 + len(key) * 7)
        self.edge_kits = ([edge_crown_kit(kind, self.tex[0], 900 + v * 41, 2) for v in range(2)] +
                          [edge_crown_kit(kind, self.tex[0], 960 + v * 41, 3) for v in range(1)]) if kind == 'broadleaf' else []
        self.trees = {}
        if kind == 'broadleaf':
            for key in TREE_LAYOUTS:
                for v in range(2):
                    self.trees[(key, v)] = tree_kit(key, 1100 + v * 53 + len(key))

    def unique_cells(self):
        cells = set()
        def add(a):
            for y in range(0, a.shape[0], 16):
                for x in range(0, a.shape[1], 16):
                    c = a[y:y + 16, x:x + 16]
                    if c[:, :, 3].any(): cells.add(c.tobytes())
        for t in self.tiles.values(): add(t)
        for r in self.interior:
            for t in r: add(t)
        for b in self.bands.values(): add(b)
        for t in self.n_edge: add(t)
        for p in self.patches.values(): add(p)
        for e in self.edge_kits: add(e)
        for t in self.trees.values(): add(t)
        return len(cells)


EDGE_MASK = canon(2 | 4 | 8 | 32 | 64)


def paint_forest(base, canopy, kit, seed=0, patch_cover=0.95):
    img = base.copy()
    H, W = canopy.shape
    kind = kit.kind
    lab, n = components(canopy)
    # 1) 줄기 띠(아래층)
    for y in range(H - 1):
        for x in range(W):
            if not canopy[y, x] or canopy[y + 1, x]: continue
            # 이웃이 같은 줄 S 가장자리이거나, 계단처럼 아래로 숲이 이어지면(대각 덩이) 띠를 그쪽으로 잇는다
            l = x > 0 and canopy[y, x - 1] and (not canopy[y + 1, x - 1] or canopy[y + 1, x - 1])
            r = x + 1 < W and canopy[y, x + 1] and (not canopy[y + 1, x + 1] or canopy[y + 1, x + 1])
            l = l or (x > 0 and canopy[y + 1, x - 1])
            r = r or (x + 1 < W and canopy[y + 1, x + 1])
            if not l and not r: part = 'one'
            elif not l: part = 'L'
            elif not r: part = 'R'
            else: part = 'M'
            nv = len([k for k in kit.bands if k[0] == part])
            over(img, kit.bands[(part, cell_hash(x + seed, y) % nv)], x * 16, (y + 1) * 16)
    # 2) 수관 오토타일
    for y in range(H):
        for x in range(W):
            if not canopy[y, x]: continue
            m = canon(mask_at(canopy, x, y))
            t = kit.tiles[m]
            if m == 255:
                d = depth_at(canopy, x, y)
                tier = kit.interior[min(max(d, 1) - 1, 1)]
                t = tier[cell_hash(x, y) % len(tier)]
            elif m == EDGE_MASK:
                t = kit.n_edge[cell_hash(x + 3, y) % len(kit.n_edge)]
            over(img, t, x * 16, y * 16)
    # 3) 하늘선 수관 머리(위 가장자리 칸 + 밑 몸통)
    used = np.zeros((H, W), bool)
    for y in range(H - 1):
        x = 0
        while x < W:
            if not kit.edge_kits: break
            ek = kit.edge_kits[cell_hash(x + seed * 3, y) % len(kit.edge_kits)]
            w = ek.shape[1] // 16
            ok = x + w <= W and all(canopy[y, x + i] and canon(mask_at(canopy, x + i, y)) == EDGE_MASK and canopy[y + 1, x + i]
                                    and canon(mask_at(canopy, x + i, y + 1)) == 255 for i in range(w))
            if ok and GA.h01(x, y, seed + 77) < 0.9:
                over(img, ek, x * 16, y * 16)
                used[y:y + 2, x:x + w] = True
                x += w + 1
            else:
                x += 1
    # 4) 몸통 위 큰 수관 머리 — 위에서 아래로 훑으며 큰 키트부터 촘촘히
    keys = sorted(CROWN_LAYOUTS[kind], key=lambda k: -CROWN_LAYOUTS[kind][k][0] * CROWN_LAYOUTS[kind][k][1])
    for y in range(H):
        for x in range(W):
            if used[y, x]: continue
            order = sorted(keys, key=lambda k: GA.h01(x, y, seed + 7 + len(k)))
            for key in order:
                w, h, _ = CROWN_LAYOUTS[kind][key]
                if x + w > W or y + h > H: continue
                if any(used[y + j, x + i] or not canopy[y + j, x + i] or canon(mask_at(canopy, x + i, y + j)) != 255
                       for j in range(h) for i in range(w)): continue
                if GA.h01(x, y, seed + 6) > patch_cover: break
                over(img, kit.patches[(key, cell_hash(x, y) % 2)], x * 16, y * 16)
                used[y:y + h, x:x + w] = True
                break
    return img


def paint_trees(base, region, kit, seed, gap=2.4):
    """성긴 숲: 한 그루 나무 키트를 겹쳐 세운다(아래 발이 앞)."""
    H, W = region.shape
    img = base.copy()
    cand = [(x, y) for y in range(H) for x in range(W) if region[y, x]]
    cand.sort(key=lambda p: GA.h01(p[0], p[1], seed))
    keys = list(TREE_LAYOUTS)
    placed = []
    for (x, y) in cand:
        key = keys[int(GA.h01(x, y, seed + 1) * len(keys)) % len(keys)]
        w, h, _, _ = TREE_LAYOUTS[key]
        left, top = x - w // 2, y - h + 1
        if left < -1 or left + w > W + 1 or top < -2: continue
        if any(math.hypot(x - px, (y - py) * 1.3) < gap * (1.25 if pk == 't4x4' or key == 't4x4' else 1) for (px, py, pk, _, _) in placed): continue
        placed.append((x, y, key, left, top))
    for (x, y, key, left, top) in sorted(placed, key=lambda p: p[1]):
        over(img, kit.trees[(key, cell_hash(x, y) % 2)], left * 16, top * 16)
    return img


# ───────────────────────── 옛 키트로 같은 자리 칠하기(before) ─────────────────────────
def paint_old(base, sheet, region, pool, seed, min_gap=2.2):
    """regionComposer 의 숲 채우기와 같은 문법: 후보 칸 섞기 → 발 칸 간격 → 아래 발부터 그리기."""
    H, W = region.shape
    img = base.copy()
    cand = [(x, y) for y in range(H) for x in range(W) if region[y, x]]
    cand.sort(key=lambda p: GA.h01(p[0], p[1], seed))
    placed = []
    for (x, y) in cand:
        kid = pool[int(GA.h01(x, y, seed + 1) * len(pool)) % len(pool)]
        k = sheet.kits[kid]
        w, h = k['width'], k['height']
        left, top = x - w // 2, y - h + 1
        if left < 0 or left + w > W: continue
        # regionComposer.isForestTreeAllowed 와 같게: 키트 칸 전부가 숲 구획 안(맵 위쪽 밖은 허용)
        if any(0 <= top + j < H and not region[top + j, left + i] for j in range(h) for i in range(w)): continue
        if any(math.hypot(x - px, (y - py) * 1.3) < min_gap for (px, py, _, _, _) in placed): continue
        placed.append((x, y, kid, left, top))
    for (fx, fy, kid, left, top) in sorted(placed, key=lambda p: p[1]):
        lo, up = sheet.kit_img(kid)
        over(img, lo, left * 16, top * 16)
        over(img, up, left * 16, top * 16)
    return img


# ───────────────────────── 시험 지도 4장 ─────────────────────────
def blob(W, H, cx, cy, rx, ry, seed, wob=0.35):
    g = np.zeros((H, W), bool)
    for y in range(H):
        for x in range(W):
            ang = math.atan2(y - cy, x - cx)
            rr = 1 + wob * (math.sin(ang * 3 + seed) * 0.5 + math.sin(ang * 5 + seed * 2) * 0.3)
            if ((x - cx) / (rx * rr)) ** 2 + ((y - cy) / (ry * rr)) ** 2 <= 1: g[y, x] = True
    return g


def smooth(g, it=2):
    """한 칸짜리 혹·홈 지우기(오토타일 가장자리가 들쭉날쭉해지지 않게)."""
    H, W = g.shape
    for _ in range(it):
        h = g.copy()
        for y in range(H):
            for x in range(W):
                n = sum(g[yy, xx] for yy in range(max(0, y - 1), min(H, y + 2)) for xx in range(max(0, x - 1), min(W, x + 2))) - g[y, x]
                if g[y, x] and n <= 2: h[y, x] = False
                if not g[y, x] and n >= 6: h[y, x] = True
        g = h
    return g


def scenes():
    W, H = 24, 16
    sc = {}
    # A 성긴 숲(잡목림)
    g = np.zeros((H, W), bool)
    g[2:15, 1:23] = True
    g &= ~blob(W, H, 12, 8, 4, 2.5, 3, 0.2)            # 가운데 빈터
    sc['light'] = dict(name='성긴 숲(잡목림)', kind='broadleaf', mode='trees', canopy=g, road=None, old_pool=['jp-rg-sugi', 'jp-rg-pine'])
    # B 빽빽한 숲
    g = smooth(blob(W, H, 12, 6, 13, 6.5, 2, 0.18))
    g[13:, :] = False
    sc['dense'] = dict(name='빽빽한 숲(활엽 혼효림)', kind='broadleaf', mode='canopy', canopy=g, road=None, old_pool=['jp-rg-sugi', 'jp-rg-pine'])
    # C 빽빽한 대숲 + 오솔길(세로, 폭 2)
    road = np.zeros((H, W), bool)
    for y in range(H):
        c = 11 if y < 6 else 12 if y < 11 else 11
        road[y, c:c + 2] = True
    g = np.zeros((H, W), bool)
    g[0:11, :] = True
    for y in range(H):
        for x in range(W):
            if road[y, x] or (x > 0 and road[y, x - 1]) or (x + 1 < W and road[y, x + 1]): g[y, x] = False
    g &= smooth(blob(W, H, 12, 3, 15, 9, 5, 0.1), 1)
    sc['bamboo'] = dict(name='빽빽한 대숲(竹林)과 오솔길', kind='bamboo', mode='canopy', canopy=g, road=road, old_pool=['jp-rg-bamboo-grove', 'jp-rg-bamboo-grove-b', 'jp-rg-bamboo-clump'])
    # D 길가 숲 가장자리: 가로 산길(폭 2) 위·아래
    road = np.zeros((H, W), bool)
    road[7:9, :] = True
    north = np.zeros((H, W), bool)
    south = np.zeros((H, W), bool)
    for x in range(W):
        en = 4 + (1 if 6 <= x < 11 else 0) - (1 if 16 <= x < 20 else 0)    # 북쪽 숲 S 가장자리(줄기 띠가 6행 = 길 위 1칸)
        north[0:en + 1, x] = True
        es = 10 + (1 if 3 <= x < 8 else 0) + (1 if 14 <= x < 18 else 0)
        south[es:H - 2, x] = True
    sc['edge'] = dict(name='길가 숲 가장자리(산길)', kind='broadleaf', mode='canopy', canopy=north | south, road=road, old_pool=['jp-rg-sugi', 'jp-rg-pine'])
    return sc


def save(a, path, scale=1):
    im = Image.fromarray(a, 'RGBA')
    if scale != 1: im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path)


def palette_check(arrs):
    allowed = {tuple(c[:3]) for m in MAT.values() for c in m} | set(GA.PAL_SET)
    bad = {}
    for name, a in arrs:
        vis = a[a[:, :, 3] > 0][:, :3]
        for c in {tuple(int(v) for v in p) for p in vis}:
            if c not in allowed: bad.setdefault(name, set()).add(c)
        if ((a[:, :, 3] != 0) & (a[:, :, 3] != 255)).any(): bad.setdefault(name, set()).add('partial-alpha')
    return bad


def seam_report(img, canopy):
    """수관 칸끼리 맞닿는 선에서 위·아래(좌·우) 화소 밝기 차가 큰 비율 — 이음새 눈금 지표."""
    H, W = canopy.shape
    a = img[:, :, :3].astype(int).sum(-1)
    jumps, tot = 0, 0
    for y in range(H):
        for x in range(W - 1):
            if canopy[y, x] and canopy[y, x + 1]:
                d = np.abs(a[y * 16:(y + 1) * 16, x * 16 + 15] - a[y * 16:(y + 1) * 16, x * 16 + 16])
                jumps += int((d > 120).sum()); tot += 16
    return round(jumps / max(1, tot), 3)


def sheet_png(kit, out):
    """조각 시트: canon 47 · 몸통 변형 8 · 줄기 띠 · 수관 머리 키트 · 하늘선 키트 · 나무."""
    items = [kit.tiles[m] for m in CANON] + [t for r in kit.interior for t in r]
    big = list(kit.bands.values()) + list(kit.patches.values()) + kit.edge_kits + list(kit.trees.values())
    cols = 16
    rows = (len(items) + cols - 1) // cols
    Wd = cols * 18
    y = rows * 18 + 8
    x = 2
    rowh = 0
    pos = []
    for b in big:
        h, w = b.shape[:2]
        if x + w + 2 > Wd: x = 2; y += rowh + 6; rowh = 0
        pos.append((x, y)); x += w + 6; rowh = max(rowh, h)
    sh = np.zeros((y + rowh + 4, Wd, 4), np.uint8)
    sh[:, :] = (52, 56, 66, 255)
    for i, t in enumerate(items):
        yy, xx = divmod(i, cols)
        reg = sh[yy * 18 + 1:yy * 18 + 17, xx * 18 + 1:xx * 18 + 17]
        sh[yy * 18 + 1:yy * 18 + 17, xx * 18 + 1:xx * 18 + 17] = np.where(t[:, :, 3:4] > 0, t, reg)
    for b, (bx, by) in zip(big, pos):
        h, w = b.shape[:2]
        reg = sh[by:by + h, bx:bx + w]
        sh[by:by + h, bx:bx + w] = np.where(b[:, :, 3:4] > 0, b, reg)
    save(sh, out / f'{kit.kind}-pieces-x3.png', 3)


def main(out=OUT):
    sheet_now = Sheet(ROOT / 'public/assets/jp-city/jp-city-chipset.png', ROOT / 'src/assets/jpCityTileset.json')
    pr = Path(os.environ.get('JPF_PR3026', '/tmp/jpf/pr3026'))
    sheet_bamboo = Sheet(pr / 'sheet.png', pr / 'ts.json') if (pr / 'ts.json').exists() else None
    kits = {k: Kit(k) for k in ('broadleaf', 'bamboo')}
    for k in kits.values(): sheet_png(k, out)
    report = dict(scenes={}, palette={}, piece_cells={k: v.unique_cells() for k, v in kits.items()})
    arrs = []
    for key, s in scenes().items():
        H, W = s['canopy'].shape
        base = ground_layer(sheet_now, W, H, s['road'])
        kit = kits[s['kind']]
        if s['mode'] == 'trees':
            new = paint_trees(base, s['canopy'], kit, seed=3, gap=2.1)
        else:
            new = paint_forest(base, s['canopy'], kit, seed=len(key))
        sh = sheet_bamboo if (s['kind'] == 'bamboo' and sheet_bamboo) else sheet_now
        old = paint_old(base, sh, s['canopy'], s['old_pool'], seed=17 + len(key))
        for tag, im in (('new', new), ('old', old)):
            save(im, out / f'scene-{key}-{tag}.png'); save(im, out / f'scene-{key}-{tag}-x3.png', 3)
        arrs.append((key, new))
        report['scenes'][key] = dict(name=s['name'], kind=s['kind'], size=[W, H], seam_jump=seam_report(new, s['canopy']) if s['mode'] == 'canopy' else None)
    report['palette'] = {k: sorted(map(str, v)) for k, v in palette_check(arrs).items()}
    for kind, kit in kits.items():
        cnt = [len({tuple(p) for p in t.reshape(-1, 4) if p[3]}) for t in [x for r in kit.interior for x in r]]
        pc = []
        for p in kit.patches.values():
            for y in range(0, p.shape[0], 16):
                for x in range(0, p.shape[1], 16):
                    pc.append(len({tuple(q) for q in p[y:y + 16, x:x + 16].reshape(-1, 4) if q[3]}))
        report.setdefault('colors_per_cell', {})[kind] = dict(interior=cnt, crown_patch_median=sorted(pc)[len(pc) // 2], crown_patch_max=max(pc))
    json.dump(report, open(out / 'report.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    o = OUT
    if '--out' in sys.argv: o = Path(sys.argv[sys.argv.index('--out') + 1])
    main(o)
