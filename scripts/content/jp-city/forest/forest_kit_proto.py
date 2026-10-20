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
# 계약 v2(2026-10-20): 핵심 5단 + 확장 램프(`<재료>+`) + 하위 램프(`<재료>/<하위>`) 를 모두 이름으로 부른다.
MAT = {name: [hx(h) for h in steps] for name, steps in _CONTRACT['ramps'].items()}


def R(name, i):
    """계약 램프(핵심·확장·하위)면 MAT, 아니면 modern3 보조 램프(GA.RAMPS)."""
    if name in MAT:
        r = MAT[name]
    else:
        r = [(*c, 255) for c in GA.RAMPS[name]]
    return r[max(0, min(len(r) - 1, i))]


TRANSPARENT = (0, 0, 0, 0)
INK = R('sumi', 1)          # 윤곽(jp_city ink)
SUN = 'pine_bamboo/sunleaf'   # 버들항 숲 결: 그늘 청록 → 빛 연두(9단)
PBX = 'pine_bamboo+'          # 차가운 짙은 녹(9단) — 덩이 일부를 식혀 색 덩이 변화를 준다
CULM = 'pine_bamboo/culm'     # 대 줄기(7단)
BARK = 'aged_cedar/bark'      # 나무껍질(7단)
DEEP = R(SUN, 0)              # 수관 속 가장 깊은 그늘 — 검정이 아닌 짙은 청록(버들항 틈 색)
NLV = 9                       # 잎 단 수 0..8

SAK = 'sakura_petal+'         # 벚나무 숲(꽃 핀 수관) 9단
MPL = 'autumn_maple+'         # 단풍 숲(가을 활엽) 9단
BROAD_KINDS = ('broadleaf', 'sakura', 'sugi', 'maple')   # 활엽 문법(덩이 수관·1칸 줄기 띠)을 쓰는 종류. 대숲만 따로.


def _broad(kind):
    return kind in BROAD_KINDS


def _layout_kind(kind):
    return 'bamboo' if kind == 'bamboo' else 'broadleaf'


def h01(x, y, s):
    return GA.h01(x, y, s)


# ───────────────────────── 잎 덩이(크라운) 그리기 ─────────────────────────
def _wrap(v):
    return v % 16


def _lv_color(kind, L, x, y, s=0, hue=None):
    """단 L(0..8) → 색. 잎 덩이마다 색 계열(hue 0..1)을 정한다 — 화소마다 섞으면 소금 후추 잡티가 된다.
    활엽: 햇빛 잎 램프(그늘 청록 → 빛 연두)가 몸통, 덩이 30% 는 같은 밝기의 차가운 짙은 녹(pine_bamboo+)으로 식힌다.
    대숲: 한 단 밝고 노랗다(잎이 얇아 빛이 비친다) — 그늘 단은 활엽과 같은 청록이라 숲끼리 같은 그늘을 쓴다."""
    L = max(0, min(NLV - 1, int(L)))
    k = h01(x, y, 300 + s) if hue is None else hue
    if kind == 'bamboo':
        if L >= 7: return R(CULM, 6) if k > 0.6 else R(SUN, 8)
        return R(SUN, min(8, L + (1 if L >= 3 else 0)))
    if kind == 'sakura':
        # 꽃 덩이: 분홍 9단. 가장 깊은 틈 두 단은 잎 그늘 청록(꽃 사이로 보이는 가지·잎 그늘) — 덩이 30% 는 한 단 낮춰 색 덩이 변화
        if L <= 1: return R(SUN, L)
        return R(SAK, max(2, L - (1 if (k < 0.3 and L < 8) else 0)))
    if kind == 'maple':
        # 단풍: 가장 깊은 틈 한 단은 잎 그늘 청록, 덩이 30% 는 한 단 낮춰 붉은 색 덩이 변화
        if L == 0: return R(SUN, 0)
        return R(MPL, max(1, L - (1 if (k < 0.3 and L < 8) else 0)))
    if kind == 'sugi':
        # 삼나무: 차가운 짙은 청록(pine_bamboo+) 위주, 빛 끝 두 단만 햇빛 잎 램프
        if L >= 7: return R(SUN, L - 1)
        return R(PBX, L)
    if L <= 5 and k < 0.3:
        return R(PBX, L)
    return R(SUN, L)


def crown_levels(W, H, cx, cy, rx, ry, seed, kind='broadleaf', sub=None, wrap=False, lv=None, own=None, macro=1.0, hue=None, bias=0.0, light=None, crescent=1.0):
    """하나의 수관(지름 수십 px)을 작은 잎 덩이 여럿의 겹침으로 그린다 → 단(level) 배열.
    덩이마다: 잎 끝 톱니 윤곽, 왼쪽 위 초승달 빛, 몸통 평면, 오른쪽 아래 테두리 한 단 어둡게(덩이 사이 틈).
    덩이 하나는 한 색 계열(hue)로 칠한다. lv/own/hue 에 덧그린다."""
    if lv is None: lv = np.full((H, W), -1, np.int16)
    if own is None: own = np.zeros((H, W), bool)
    if hue is None: hue = np.zeros((H, W), np.float32)
    lcx, lcy, lrx, lry = light or (cx, cy, rx, ry)     # 빛 계산용 타원(덩이 무리 전체) — 둥근 공 명암을 피하려고 엽(lobe)과 분리
    sub = sub or (3.4 if _broad(kind) else 2.7)
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
                lv[y, x] = int(math.floor(max(0, min(8, base + 0.5))))
                own[y, x] = True
                hue[y, x] = hv
    if _broad(kind):
        for i, (px, py, r) in enumerate(pts):          # 해 드는 덩이 머리에만 잎 끝 2점
            mx, my = (px - lcx) / lrx, (py - lcy) / lry
            if -(mx * 0.6 + my * 0.8) * macro < 0.15: continue
            for (ox, oy) in ((-1, -r + 0.8), (0, -r + 0.8)):
                x, y = int(round(px + ox)), int(round(py + oy))
                if wrap: x, y = x % W, y % H
                if 0 <= x < W and 0 <= y < H and lv[y, x] >= 4: lv[y, x] = min(8, lv[y, x] + 2)
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


BAYER2 = ((0.0, 0.5), (0.75, 0.25))

# 덩이 엽(lobe) 자리 후보 — 위쪽 두 자리(좌상·우상)를 같이 쓰면 「고양이 귀」가 된다. 작은 덩이는 위쪽 엽을 쓰지 않는다.
_LOBE_ANGLES = {'R': 0.15, 'BR': 0.85, 'B': 1.57, 'BL': 2.3, 'L': 3.0, 'UL': 3.75, 'UR': 5.55}


def mass_silhouette(W, H, cx, cy, rx, ry, seed, small=False):
    """덩이 하나의 모양 = 큰 몸 타원 + 옆·아래 엽 2~4개 + 잎 끝 톱니(각도 자리마다 ±1px). 위쪽 엽은 큰 덩이에서 한쪽만."""
    names = ['R', 'BR', 'B', 'BL', 'L'] + ([] if small else [('UL' if h01(seed, 3, 611) < 0.5 else 'UR')])
    pick = [n for i, n in enumerate(names) if h01(i, seed, 612) < 0.62] or ['BR', 'L']
    lobes = [(cx, cy + ry * 0.04, rx * 0.86, ry * 0.84)]
    for i, n in enumerate(pick):
        ang = _LOBE_ANGLES[n] + (h01(i, seed, 613) - 0.5) * 0.5
        d = 0.42 + h01(i, seed, 614) * 0.16
        rr = 0.44 + h01(i, seed, 615) * 0.16
        lobes.append((cx + math.cos(ang) * rx * d, cy + math.sin(ang) * ry * d, rx * rr, ry * rr))
    S = np.zeros((H, W), bool)
    for y in range(H):
        for x in range(W):
            for (lx, ly, lrx, lry) in lobes:
                dx, dy = (x + 0.5 - lx) / lrx, (y + 0.5 - ly) / lry
                ang = math.atan2(dy, dx)
                tip = 1.0 + (h01(int((ang + 4) * 3.1), int(lx) * 7 + int(ly), seed + 616) - 0.5) * 0.22
                if dx * dx + dy * dy <= tip * tip:
                    S[y, x] = True
                    break
    return S, lobes


def mass_levels(lv, hue, S, cx, cy, rx, ry, seed, kind='broadleaf', lit=4.8, sp=5.6, rim_dark=True, shadow=None, wg=2.0, wc=1.9, crack=1.0):
    """덩이 S 를 칠한다. 큰 빛(덩이 전체, 왼쪽 위) + 잎 뭉치(지름 5~8px, 뭉치마다 작은 빛)의 두 겹.
    뭉치 사이 틈은 오른쪽 아래만 한두 단 어둡게(모든 뭉치에 같은 초승달을 두면 「콜리플라워」가 된다).
    가장자리: 아래·오른쪽은 가장 어두운 청록, 위·왼쪽은 밝은 잎 끝 — 검은 윤곽 없음.
    shadow=(dx,dy): 덩이 밖 그림자(lv 를 두 단 누른다)."""
    H, W = S.shape
    ys, xs = np.nonzero(S)
    if not len(xs): return
    # 잎 뭉치 중심(엇갈린 격자 + 흔들림)
    pts = []
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    j = 0
    yy = y0 + sp * 0.4
    while yy <= y1 + 1:
        xx = x0 + sp * (0.3 + (j % 2) * 0.5)
        i = 0
        while xx <= x1 + 1:
            px = xx + (h01(i, j, seed + 620) - 0.5) * sp * 0.7
            py = yy + (h01(i, j, seed + 621) - 0.5) * sp * 0.6
            iy, ix = int(min(H - 1, max(0, py))), int(min(W - 1, max(0, px)))
            if S[iy, ix]:
                pts.append((px, py, sp * (0.55 + h01(i, j, seed + 622) * 0.35), h01(i, j, seed + 623)))
            xx += sp; i += 1
        yy += sp * 0.82; j += 1
    if not pts: pts = [(cx, cy, max(rx, ry) * 0.6, 0.5)]
    if shadow:
        sdx, sdy = shadow
        for y in range(H):
            for x in range(W):
                if S[y, x]: continue
                sy, sx = y - sdy, x - sdx
                if 0 <= sy < H and 0 <= sx < W and S[sy, sx] and lv[y, x] >= 0:
                    lv[y, x] = max(0, lv[y, x] - 2)
    for y, x in zip(ys, xs):
        best = (9e9, 0)
        second = 9e9
        for k, (px, py, r, hv) in enumerate(pts):
            d = math.hypot(x + 0.5 - px, y + 0.5 - py) / r
            if d < best[0]: second = best[0]; best = (d, k)
            elif d < second: second = d
        px, py, r, hv = pts[best[1]]
        nx, ny = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
        gl = -(nx * 0.55 + ny * 0.85)
        cdx, cdy = (x + 0.5 - px) / r, (y + 0.5 - py) / r
        cl = -(cdx * 0.55 + cdy * 0.85)
        L = lit + wg * gl + wc * cl
        if second - best[0] < 0.2 and (cdx + cdy) > 0.0:            # 뭉치 사이 틈(오른쪽 아래 쪽만)
            L -= (2.4 if gl < 0.35 else (1.5 if gl < 0.6 else 0.7)) * crack
        hs = h01(x, y, seed + 624)
        if hs < 0.035 and 2 <= L <= 5.5: L -= 2                      # 잎 사이 구멍(어두운 점)
        elif hs > 0.975 and L >= 5: L += 1                            # 반짝 잎 끝
        # 덩이 가장자리 1px
        edge = not (0 < y < H - 1 and 0 < x < W - 1 and S[y - 1, x] and S[y + 1, x] and S[y, x - 1] and S[y, x + 1])
        if edge:
            out_ = (0 if y + 1 < H and S[y + 1, x] else 1) * 0.85 + (0 if x + 1 < W and S[y, x + 1] else 1) * 0.55 \
                   - (0 if y > 0 and S[y - 1, x] else 1) * 0.85 - (0 if x > 0 and S[y, x - 1] else 1) * 0.55
            if out_ > 0.2: L = min(L, 1.0) if rim_dark is True else min(L, float(rim_dark)) if rim_dark else L
            elif out_ < -0.2: L = max(L, 4.6)
        L += (BAYER2[y % 2][x % 2] - 0.375) * 0.6
        lv[y, x] = int(max(0, min(NLV - 1, math.floor(L + 0.5))))
        hue[y, x] = hv


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
                lv[yq, xx] = max(0, min(8, L - (1 if k == ln - 1 else 0)))
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
    """대숲 몸통 칸: 빽빽한 대숲을 3/4 위에서 본 결 = 잎 갓(우듬지)의 바다. 줄기는 잎 사이로 짧게만 비친다
    (세로 줄기를 칸마다 같은 열에 두면 16px 세로 줄무늬가 된다 — r1 적대 검수 지적).
    잎은 가늘고 긴 피침형 사선(위 줄 밝게, 밑 줄 어둡게)이 잔가지 점에서 아래로 늘어진 다발.
    칸 테두리를 넘는 다발(wrap)은 모든 변형이 같고, variant 는 칸 안쪽 다발·줄기 틈만 바꾼다 → 이음새 없음."""
    lv = np.full((16, 16), 1, np.int16)
    hue = np.zeros((16, 16), np.float32)
    for y in range(16):
        for x in range(16):
            k = h01(x, y, 411)
            lv[y, x] = 1 if k < 0.35 else 3 if k > 0.85 else 2
            hue[y, x] = 0.3
    # 공통 다발(테두리를 넘는다): 뒤(어둡게) → 앞(밝게)
    for (sx, sy, n, br, sd) in ((0, 1, 4, -1, 3), (8, 9, 4, -1, 5), (13, 4, 3, -1, 7)):
        draw_spray(lv, hue, sx, sy, n, 900 + sd, wrap=True, bright=br, length=(4, 6))
    # 변형 다발(칸 안쪽만): 자리·장 수가 달라 같은 「V」가 줄 서지 않는다
    var = [((4, 4, 4), (10, 9, 3)), ((9, 3, 4), (4, 9, 4)), ((11, 6, 3), (5, 6, 4)), ((6, 3, 3), (9, 10, 4)),
           ((3, 7, 4), (11, 4, 3)), ((7, 6, 5),), ((5, 3, 3), (10, 7, 3), (6, 11, 3)), ((8, 4, 4), (3, 10, 3))][variant % 8]
    sub_lv = lv.copy(); sub_h = hue.copy()
    # 잎 사이로 비친 줄기 한두 토막(변형마다 다른 열, 짧게)
    for ci in range(1 + variant % 2):
        cx = 3 + int(h01(ci, variant, 431) * 10)
        y0 = 2 + int(h01(ci, variant, 432) * 6)
        for y in range(y0, min(14, y0 + 3 + int(h01(ci, variant, 433) * 3))):
            sub_lv[y, cx] = 4 if y % 4 else 2; sub_h[y, cx] = 0.2
            sub_lv[y, cx + 1] = 1; sub_h[y, cx + 1] = 0.2
    for i, (sx, sy, n) in enumerate(var):
        draw_spray(sub_lv, sub_h, sx, sy, n, 920 + variant * 5 + i * 3, wrap=False, bright=0 if i == 0 else -1, length=(4, 6))
    m = np.zeros((16, 16), bool); m[2:14, 2:14] = True
    lv = np.where(m, sub_lv, lv); hue = np.where(m, sub_h, hue).astype(np.float32)
    return lv, hue


def leaf_texture(kind, variant=0):
    if kind == 'bamboo':
        return bamboo_texture(variant)
    return _leaf_texture(kind, variant)


def _bubble_tile(bubbles, seed, lit=4.0, wg=1.2, wc=2.2, sp=4.4, front_shadow=True):
    """16 주기 이음새 없는 잎 덩이 칸: 48×48 캔버스에 덩이를 3×3 으로 되풀이해 칠하고 가운데 16×16 을 쓴다.
    bubbles = [(cx, cy, r, small)] (칸 좌표 0..16). 덩이 밖 틈은 가장 깊은 그늘."""
    W = H = 48
    lv = np.full((H, W), 0, np.int16)
    hue = np.zeros((H, W), np.float32)
    for y in range(H):
        for x in range(W):
            lv[y, x] = 0 if h01(x % 16, y % 16, seed + 5) < 0.7 else 1
    allb = []
    for bi, b in enumerate(bubbles):
        cx, cy, r, small = b[:4]
        blit = b[4] if len(b) > 4 else lit
        layer = b[5] if len(b) > 5 else 1
        offs = (-16, 0, 16, 32) if layer < 2 else (0,)          # 앞 덩이(층 2)는 칸 안쪽에만 — 되풀이하지 않는다
        for oy in offs:
            for ox in offs:
                allb.append((layer, cy + 16 + oy, cx + 16 + ox, r, small, bi, blit))
    allb.sort()
    for (layer, cy, cx, r, small, bi, blit) in allb:
        if not (-r <= cx - 16 <= 16 + r and -r <= cy - 16 <= 16 + r): continue
        S, _ = mass_silhouette(W, H, cx, cy, r, r * 0.92, seed + bi * 31, small)
        mass_levels(lv, hue, S, cx, cy, r, r * 0.92, seed + bi * 31, 'broadleaf', lit=blit, sp=sp, wg=wg, wc=wc,
                    shadow=(1, 2) if (layer < 2 or front_shadow) else None, rim_dark=2.0 if layer == 0 else True)
    return lv[16:32, 16:32].copy(), hue[16:32, 16:32].copy()


N_BODY = 12   # 활엽 몸통 변형 수


def _pnoise16(x, y, seed, cell=4):
    """16 주기 값 잡음(격자 cell px, 쌍선형) — 칸 경계에서 이어진다."""
    n = 16 // cell
    gx, gy = x / cell, y / cell
    i0, j0 = int(math.floor(gx)), int(math.floor(gy))
    fx, fy = gx - i0, gy - j0
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    v = lambda i, j: h01(i % n, j % n, seed)
    a = v(i0, j0) * (1 - fx) + v(i0 + 1, j0) * fx
    b = v(i0, j0 + 1) * (1 - fx) + v(i0 + 1, j0 + 1) * fx
    return a * (1 - fy) + b * fy


def _undergrowth_base(seed):
    """몸통 바탕 = 버들항 숲의 어두운 덤불 결: 가장 깊은 청록 위에 3~5px 잎 뭉치(어두운 두 단, 뭉치마다 왼쪽 위 1px 밝게).
    격자 점묘(Bayer)·한 화소 잡음을 쓰지 않는다(Argon r5: 체크무늬 점묘가 16px 벽지로 보인다). 16 주기로 감아 칸 경계에서 이어진다.
    둥근 큰 공을 두지 않는다 — 칸마다 같은 덩이가 서면 16px 「달걀판」이 된다(Argon r4)."""
    lv = np.zeros((16, 16), np.int16)
    hue = np.zeros((16, 16), np.float32)
    pts = []
    for j in range(4):
        for i in range(4):
            px = i * 4 + 2 + (h01(i, j, seed + 30) - 0.5) * 3.2
            py = j * 4 + 2 + (h01(i, j, seed + 31) - 0.5) * 3.2
            q = h01(i, j, seed + 32)
            L = 0 if q < 0.12 else (1 if q < 0.45 else (2 if q < 0.8 else 3))
            pts.append((px, py, L, 1.6 + h01(i, j, seed + 33) * 1.2, h01(i, j, seed + 34)))
    for y in range(16):
        for x in range(16):
            best, sec, bk = 9e9, 9e9, 0
            for k, (px, py, L, r, hv) in enumerate(pts):
                dx = (x + 0.5 - px + 8) % 16 - 8
                dy = (y + 0.5 - py + 8) % 16 - 8
                d = math.hypot(dx, dy * 1.15) / r
                if d < best: sec, best, bk = best, d, k
                elif d < sec: sec = d
            px, py, L, r, hv = pts[bk]
            dx = (x + 0.5 - px + 8) % 16 - 8
            dy = (y + 0.5 - py + 8) % 16 - 8
            v = L
            if best > 1.0: v = 0                                   # 뭉치 밖 = 깊은 틈
            elif dx + dy < -1.2 and L >= 1: v = L + 1              # 뭉치 왼쪽 위 잎 끝
            elif dx + dy > 1.4 or dy > 1.2: v = max(0, L - 1)      # 오른쪽 아래 그늘
            if sec - best < 0.12 and v > 0: v -= 1                 # 뭉치 사이 1px 골
            lv[y, x] = v
            hue[y, x] = hv
    return lv, hue


def _undergrowth_texture(variant=0):
    """활엽 몸통: 바탕(테두리 2px 포함, 모든 변형 같음) + 칸 안쪽의 작은 잎 덩이 0~3개(자리·크기·밝기가 변형마다 다름)."""
    seed = 503
    base_lv, base_hue = _undergrowth_base(seed)
    lv, hue = base_lv.copy(), base_hue.copy()
    if variant == 0:
        return lv, hue
    r = lambda k, s: h01(variant, k, seed + s)
    n = (0, 2, 2, 1, 3, 2, 1, 3, 0, 2, 2, 1)[variant % N_BODY]
    W = H = 16
    for k in range(n):
        rx = 3.0 + r(k, 31) * (2.8 if n == 1 else 1.8)
        ry = rx * (0.75 + r(k, 32) * 0.3)
        cx = 2 + rx + r(k, 33) * max(0.1, 12 - 2 * rx)
        cy = 2 + ry + r(k, 34) * max(0.1, 12 - 2 * ry)
        S, _ = fit_silhouette(W, H, cx, cy, rx, ry, seed + variant * 7 + k, True)
        mass_levels(lv, hue, S, cx, cy, rx, ry, seed + variant * 7 + k, 'broadleaf', lit=3.0 + r(k, 35) * 1.2,
                    sp=3.8, rim_dark=1.6, shadow=(1, 1), wg=1.4, wc=1.3)
    lv = np.where(_RING16, base_lv, lv)
    hue = np.where(_RING16, base_hue, hue).astype(np.float32)
    return np.clip(lv, 0, 6), hue


_RING16 = np.zeros((16, 16), bool)
_RING16[:2, :] = _RING16[-2:, :] = True
_RING16[:, :2] = _RING16[:, -2:] = True


def _leaf_texture(kind, variant=0):
    """16 주기 몸통 질감 = 엇갈린 작은 나무 머리(가운데 하나 + 네 모서리를 잇는 하나)의 벽돌 배치.
    SNES 숲 몸통 칸의 문법(칸마다 나무 머리 하나)을 잎 덩이로 그린다. 머리 사이 틈은 깊은 그늘.
    variant 는 가운데 머리만 바꾼다(가장자리 2px 는 variant 0 과 같다 → 이웃과 이어짐). 반환 (단, 색 계열)."""
    seed = 500 if _broad(kind) else 600
    if _broad(kind):
        return _undergrowth_texture(variant)
    if kind == 'broadleaf_bubble':
        # (r4 까지의 거품 격자 — Argon r4: 16px 마다 같은 공이 줄 서는 「달걀판」이라 버림. 기록용)
        # 뒤 덩이(어둡게, 먼저) + 모서리 덩이 + 가운데 덩이. 모서리·뒤 덩이는 변형마다 같아 칸 테두리가 같다.
        # 뒤 덩이(어둡게, 먼저) + 모서리 덩이(중간 밝기 — 칸 테두리를 지나 모든 변형에서 같다) + 앞 덩이(밝게, 변형마다 자리·크기·수가 다르다).
        # 칸마다 같은 자리에 오는 것은 어두운 뒤 덩이·모서리 덩이뿐이라, 눈에 띄는 밝은 덩이는 16px 격자로 줄 서지 않는다.
        # 뒤 덩이를 밝혀(2.6→3.1) 칸 경계 교차점의 닫힌 어둠 고리(「달걀판」)를 줄이고, 깊은 그늘은 변형마다 다른 자리의 구멍으로 둔다
        back = [(8.0, 0.5, 5.4, True, 2.9, 0), (0.5, 8.0, 5.4, True, 2.9, 0)]
        corner = (0.0, 0.0, 7.6, False, 3.6, 1)
        # 앞 덩이는 칸 안쪽(테두리 2px 안)에만 — 테두리는 모든 변형이 같아(뒤·모서리 덩이) 어떤 이웃과도 이음새가 없다.
        # 자리 ±2px·크기 3.5~6·한~세 덩이로 변형마다 달라 밝은 덩이 간격이 16px 로 고르지 않다.
        fronts = [[(8.0, 8.0, 5.8, True, 4.3, 2)],
                  [(6.5, 6.5, 4.4, True, 4.6, 2), (10.0, 10.0, 3.8, True, 3.8, 2)],
                  [(9.0, 7.0, 5.2, False, 4.1, 2)],
                  [(6.5, 9.5, 4.2, True, 4.4, 2), (10.0, 6.0, 3.8, True, 4.2, 2)],
                  [(8.5, 7.5, 4.4, True, 4.9, 2)],
                  [(6.0, 6.0, 3.6, True, 4.2, 2), (9.5, 9.5, 4.4, True, 4.5, 2)],
                  [(8.0, 8.5, 5.6, False, 3.9, 2)],
                  [(7.0, 6.5, 4.2, True, 4.6, 2), (10.5, 10.5, 3.4, True, 3.6, 2), (5.5, 10.5, 3.2, True, 3.4, 2)]]
        base_lv, base_hue = _bubble_tile(back + [corner], seed + 3)
        lv, hue = _bubble_tile(back + [corner] + fronts[variant % len(fronts)], seed + 3 + variant * 37, front_shadow=False)
        ring = np.zeros((16, 16), bool)
        ring[:2, :] = ring[-2:, :] = True; ring[:, :2] = ring[:, -2:] = True
        lv = np.where(ring, base_lv, lv); hue = np.where(ring, base_hue, hue).astype(np.float32)
        # 변형마다 다른 자리의 깊은 그늘 구멍 1~2개(칸 안쪽, 지름 2~3px) — 숲 속 깊이를 고르지 않게
        for k in range(1 + variant % 2):
            px, py = 3 + int(h01(k, variant, 541) * 10), 3 + int(h01(k, variant, 542) * 10)
            if lv[py, px] <= 3:
                for (dx, dy) in ((0, 0), (1, 0), (0, 1), (1, 1), (-1, 0))[: 3 + (k + variant) % 3]:
                    if 2 <= px + dx < 14 and 2 <= py + dy < 14: lv[py + dy, px + dx] = 0
        return np.clip(lv, 0, 7), hue * 0.8
    sub = 2.2
    bias = -0.1

    def make(cseed):
        lv = np.full((16, 16), 1, np.int16)
        hue = np.zeros((16, 16), np.float32)
        lv, _ = crown_levels(16, 16, 8, 8, 10, 10, cseed, kind, sub=sub, wrap=True, lv=lv, macro=0.0, hue=hue, bias=bias, crescent=0.55)
        return lv, hue
    lv, hue = make(seed + 3)
    if variant:
        lv2, hue2 = make(seed + 3 + variant * 37)
        for y in range(16):
            for x in range(16):
                d = min(x, y, 15 - x, 15 - y)
                if d >= 2 + (h01(x, y, 520 + variant) < 0.5):
                    lv[y, x] = lv2[y, x]; hue[y, x] = hue2[y, x]
    lv = np.clip(lv, 0, 5)
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
    seed = {'N': 801, 'S': 802, 'W': 803, 'E': 804}[side] + (0 if _broad(kind) else 50)
    if _broad(kind):
        cl = {'N': [(2.5, 6.0, 4.8), (8.0, 5.0, 5.6), (13.2, 6.3, 4.4)],
              'S': [(3.0, 4.2, 3.6), (9.5, 3.8, 4.4), (14.5, 4.6, 3.2)],
              'W': [(3.5, 4.4, 4.2), (10.5, 3.6, 4.6)],
              'E': [(4.5, 4.4, 4.4), (11.5, 3.8, 4.2)]}[side]
    else:
        cl = {'N': [(1.5, 5.0, 3.0), (5.5, 4.0, 3.4), (10.0, 5.2, 3.2), (14.0, 4.4, 3.0)],
              'S': [(2.0, 3.0, 2.4), (6.5, 2.6, 2.8), (11.0, 3.2, 2.4), (14.5, 2.8, 2.2)],
              'W': [(2.0, 3.6, 3.0), (7.5, 3.0, 3.2), (12.5, 3.8, 3.0)],
              'E': [(3.0, 3.4, 3.0), (8.5, 3.6, 3.2), (13.5, 3.0, 3.0)]}[side]
    if _broad(kind) and side in ('N', 'S'):
        # (가운데 u, 반지름 r, 가장자리에서 덩이 끝까지 b px) — 덩이 끝 깊이가 변형마다 0~6px 로 달라 하늘선·아랫선이 들쭉날쭉하다
        bub = {'N': {0: [(2.5, 4.8, 1.2), (8.0, 5.6, 0.0), (13.2, 4.4, 1.9)],
                     1: [(2.5, 4.8, 1.2), (6.5, 4.0, 3.0), (11.0, 5.2, 0.0), (13.8, 3.6, 3.0)],
                     2: [(2.5, 4.8, 1.2), (7.0, 3.4, 5.0), (10.5, 4.6, 0.5), (13.2, 4.4, 1.9)],
                     3: [(2.5, 4.8, 1.2), (9.0, 6.4, 0.0), (13.2, 4.4, 1.9)]},
               'S': {0: [(3.0, 4.0, 1.5), (9.5, 4.6, 0.0), (14.5, 3.4, 1.0)],
                     1: [(3.0, 4.0, 1.5), (7.0, 3.6, 4.0), (11.5, 4.4, 0.0), (14.5, 3.4, 1.0)],
                     2: [(3.0, 4.0, 1.5), (8.0, 5.0, 0.0), (12.5, 3.0, 3.5), (14.5, 3.4, 1.0)],
                     3: [(3.0, 4.0, 1.5), (6.5, 3.2, 0.0), (10.5, 3.8, 3.0), (14.5, 3.4, 1.0)]}}[side][nvar if nvar in (0, 1, 2, 3) else 0]
        cl = [(c, b + r, r) for (c, r, b) in bub]
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
    return _edge_profile(kind, side, nvar)[u % 16]


def _cell_inside(m, u, v, kind, nvar=0, svar=0):
    """마스크 m 인 칸 안의 (u,v) 가 수관인가. nvar/svar = 위/아래 가장자리 변형."""
    n, e, s, w = m & 1, m & 2, m & 4, m & 8
    ne, se, sw, nw = m & 16, m & 32, m & 64, m & 128
    if not n and v < edge_depth(u, 'N', kind, nvar): return False
    if not s and not _broad(kind) and 15 - v < edge_depth(u, 'S', kind, svar): return False   # 활엽 아랫선은 줄기 띠의 늘어진 잎 덩이가 만든다
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


def _inside_global(g, X, Y, kind, nvar=0, center=(2, 2), svar=0):
    cx, cy = X // 16, Y // 16
    h, w = g.shape
    if not (0 <= cx < w and 0 <= cy < h) or not g[cy, cx]: return False
    me = (cx, cy) == center
    return _cell_inside(mask_at(g, cx, cy), X % 16, Y % 16, kind, nvar if me else 0, svar if me else 0)


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
                # 바깥 가장자리 1px: 검은 윤곽 없음. 위쪽(해 드는 쪽)은 잎 끝 밝은 단, 옆·아래는 짙은 녹 — 버들항처럼 덩이 색이 윤곽을 대신한다
                if not I(0, -1) and I(0, 1):
                    a[v, u] = _lv_color(kind, max(3, min(6, int(lv[v, u]) + 1)), u % 16, v % 16, hue=None if hue is None else float(hue[v, u]))
                else:
                    a[v, u] = R(SUN, 1) if I(0, -1) and not I(0, 1) else R(PBX, 1)
                continue
            L = int(lv[v, u])
            if not I(0, -2): L = min(8, L + 2)
            elif pad >= 3 and not I(0, -3): L = min(8, L + 1)
            if not I(0, 2): L = max(0, L - (1 if _broad(kind) else 2))
            elif not I(1, 1): L = max(0, L - 1)
            if not I(2, 0): L = max(0, L - 1)
            if not I(-2, 0): L = min(8, L + 1)
            a[v, u] = _lv_color(kind, L, u % 16, v % 16, hue=None if hue is None else float(hue[v, u]))
    return a


def paint_canopy_tile(m, kind, tex, nvar=0, svar=0):
    g = _mini_grid(m)
    pad = 3
    ins = np.zeros((16 + 2 * pad, 16 + 2 * pad), bool)
    for j in range(16 + 2 * pad):
        for i in range(16 + 2 * pad):
            ins[j, i] = _inside_global(g, 32 + i - pad, 32 + j - pad, kind, nvar, svar=svar)
    if _broad(kind) and not m & 4:
        ins[pad + 16:, :] = ins[pad + 15, :]     # 아래 칸은 줄기 띠(늘어진 잎 덩이)가 잇는다 — 아랫줄에 윤곽·그늘 줄을 긋지 않는다
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
            a[v, u] = R(SUN, 1) if h01(u, v, 95) > 0.35 else R(SUN, 0)


def build_canopy(kind):
    """canon 47 + 몸통 변형(얕은/깊은 두 단 × 4)."""
    tex = [leaf_texture(kind, v) for v in range(N_BODY if _broad(kind) else 4)]
    tiles = {m: paint_canopy_tile(m, kind, tex[0]) for m in CANON}
    interior = []
    for tier in range(2):
        row = []
        for v in range(N_BODY) if _broad(kind) else range(4):
            t = paint_canopy_tile(255, kind, tex[v])
            row.append(t)
        interior.append(row)
    return tiles, interior, tex


# ───────────────────────── 수관 덩이 키트(몸통 위 큰 머리) ─────────────────────────
def _tiled_tex(tex, W, H):
    return np.tile(tex, (H // 16, W // 16))


CROWN_LAYOUTS = {
    # 키: (칸 폭, 칸 높이, 덩이 [(cx, cy, rx, ry)]) — 덩이 자리·크기는 변형마다 흔든다(head_masses).
    'broadleaf': {
        'c1x1': (1, 1, [(8, 7.5, 6.2, 5.6)]),
        'c2x1': (2, 1, [(15.5, 7.5, 12.5, 5.6)]),
        'c1x2': (1, 2, [(8, 9, 6.2, 6.4), (8.5, 22, 6.4, 7.0)]),
        'c2x2': (2, 2, [(15.5, 15, 12.5, 12)]),
        'c3x2': (3, 2, [(14, 14, 11.5, 11), (33, 17, 12.5, 12)]),
        'c2x3': (2, 3, [(15, 13, 12, 10.5), (17, 32, 12.5, 12.5)]),
        'c3x3': (3, 3, [(14, 13, 11.5, 10.5), (34, 15, 12, 11.5), (23, 32, 16, 13)]),
    },
    'bamboo': {
        'c2x2': (2, 2, [(16, 16, 11.5, 10.5)]),
        'c3x2': (3, 2, [(14, 16, 10, 10), (33, 15, 11, 10)]),
        'c3x3': (3, 3, [(16, 14, 11, 10), (33, 26, 11, 11.5), (14, 34, 10, 9.5)]),
    },
}
N_HEAD_VARIANTS = {'c1x1': 6, 'c2x1': 3, 'c1x2': 3, 'c2x2': 6, 'c3x2': 5, 'c2x3': 5, 'c3x3': 5}


def head_masses(kind, key, variant):
    """변형마다 덩이 자리 ±4px·크기 ±20%·가로세로비를 흔들고, 일부 변형은 덩이를 둘로 쪼갠다(같은 머리가 줄 서지 않게)."""
    w, h, crowns = CROWN_LAYOUTS[_layout_kind(kind)][key]
    out = []
    if _broad(kind):
        # 키트를 거의 다 덮는 잎 덩이 묶음(엇갈린 격자 간격 ~12px, 반지름 6~9.5, 밝기 덩이마다 다름, 가끔 빈 자리 = 깊은 틈).
        # 한 덩이짜리 머리는 몸통 위 「스티커」가 된다(r5 자체 검수) — 여러 덩이가 겹친 선반이어야 숲 지붕이다.
        W, H = w * 16, h * 16
        s0 = 1000 + variant * 97 + w * 7 + h * 3 + sum(map(ord, key))
        cols = max(1, round((W - 4) / 21)); rows = max(1, round((H - 4) / 18))
        cw, rh = (W - 4) / cols, (H - 4) / rows
        for j in range(rows):
            for i in range(cols):
                r = min(cw, rh) * (0.6 + h01(i, j, s0 + 6) * 0.14)
                cx = 2 + cw * (i + 0.5) + (h01(i, j, s0 + 7) - 0.5) * cw * 0.18
                cy = 2 + rh * (j + 0.5) + (h01(i, j, s0 + 8) - 0.5) * rh * 0.16
                out.append((cx, cy, r, r * (0.86 + h01(i, j, s0 + 10) * 0.16), 4.2 + h01(i, j, s0 + 11) * 1.2))
        # 사이 틈을 메우는 작은 덩이(어둡게, 먼저 칠해지도록 위쪽에 둔다)
        for j in range(rows + 1):
            for i in range(cols + 1):
                if (i in (0, cols) and j in (0, rows)) or h01(i, j, s0 + 12) < 0.35: continue
                cx = min(W - 6, max(6, 2 + cw * i)); cy = min(H - 6, max(6, 2 + rh * j))
                r = 3.8 + h01(i, j, s0 + 13) * 1.4
                out.append((cx, cy - 1.5, r, r * 0.9, 3.3 + h01(i, j, s0 + 14) * 0.8))
        return out
    for i, (cx, cy, rx, ry) in enumerate(crowns):
        s0 = 1000 + variant * 97 + i * 13 + w * 7 + h * 3
        sc = 0.82 + h01(i, variant, s0 + 2) * 0.36
        asp = 0.8 + h01(i, variant, s0 + 3) * 0.45
        nx, ny = cx + (h01(i, variant, s0) - 0.5) * 7, cy + (h01(i, variant, s0 + 1) - 0.5) * 5
        if rx >= 11 and h01(i, variant, s0 + 4) < 0.4:
            # 두 덩이: 왼쪽 위 작은 덩이 + 오른쪽 아래 큰 덩이(뒤가 먼저)
            out.append((nx - rx * 0.35, ny - ry * 0.25, rx * 0.62 * sc, ry * 0.62 * sc * asp))
            out.append((nx + rx * 0.22, ny + ry * 0.18, rx * 0.72 * sc, ry * 0.7 * sc))
        else:
            out.append((nx, ny, rx * sc, ry * sc * asp))
    return out


def fit_silhouette(W, H, cx, cy, rx, ry, seed, small, margin=2):
    """덩이가 칸 바깥 테두리(margin px, 이웃과 잇는 몸통 질감 자리)에 닿지 않을 때까지 줄인다 — 잘린 곧은 변이 생기지 않게."""
    for k in range(12):
        S, lobes = mass_silhouette(W, H, cx, cy, rx, ry, seed, small)
        inner = S[margin:H - margin, margin:W - margin].sum()
        if inner == S.sum(): return S, (cx, cy, rx, ry)
        rx *= 0.93; ry *= 0.93
    S[:margin, :] = False; S[H - margin:, :] = False; S[:, :margin] = False; S[:, W - margin:] = False
    return S, (cx, cy, rx, ry)


def crown_patch(kind, key, tex, seed, variant=0):
    """몸통 칸(마스크 255)들 위에 놓는 수관 머리 키트. 바깥 2px 는 몸통 질감 그대로라 이웃과 이어진다."""
    w, h, crowns = CROWN_LAYOUTS[_layout_kind(kind)][key]
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
    if kind == 'sugi':
        lv = np.full((H, W), -1, np.int16)
        hue = np.zeros((H, W), np.float32)
        U = np.zeros((H, W), bool)
        for ci, (cx, top, base, hw, lit) in enumerate(sorted(sugi_cones(W, H, seed, variant), key=lambda c: c[2])):
            U |= cone_draw(lv, hue, cx, top, base, hw, seed + ci * 13, lit)
        return _finish_overlay(lv, hue, U, kind)
    masses = head_masses(kind, key, variant)
    small = w * h <= 2
    # 활엽 머리는 투명 덧그림(몸통 위 한 층 위)이다 — 칸 테두리를 몸통과 맞출 필요가 없어 덩이가 키트 안 칸 경계를 마음대로 넘고,
    # 키트 바깥 1px 까지 닿는다(r5 자체 검수: 테두리를 몸통으로 되돌리면 머리마다 4px 어두운 골이 생겨 「스티커」가 된다).
    lv = np.full((H, W), -1, np.int16)
    hue = np.zeros((H, W), np.float32)
    sil = []
    for ci, ms in enumerate(masses):
        cx, cy, rx, ry = ms[:4]
        S, m = fit_silhouette(W, H, cx, cy, rx, ry, seed + ci * 17, small, margin=1)
        sil.append((S, m, ms[4] if len(ms) > 4 else 5.1))
    U = np.zeros((H, W), bool)
    for ci, (S, (cx, cy, rx, ry), lit) in enumerate(sorted(sil, key=lambda t: t[1][1])):   # 위 덩이부터(아래 덩이가 앞)
        lv[S & (lv < 0)] = 0
        mass_levels(lv, hue, S, cx, cy, rx, ry, seed + ci * 17, kind, lit=lit, shadow=None, rim_dark=2.2, sp=6.4, crack=0.55)
        U |= S
    return _finish_overlay(lv, hue, U, kind)


def _finish_overlay(lv, hue, U, kind):
    H, W = lv.shape
    # 덩이 그림자(오른쪽 1·아래 2): 몸통 위에 짙은 청록으로 떨어진다
    sh = np.zeros_like(U)
    sh[2:, 1:] = U[:-2, :-1]
    sh &= ~U
    sh[:, -1:] = False; sh[-1:, :] = False
    lv[sh] = 0
    A = U | sh
    ins = np.zeros((H + 6, W + 6), bool)
    ins[3:3 + H, 3:3 + W] = A
    out = render_levels(np.maximum(lv, 0), ins, kind, 3, hue)
    for y, x in zip(*np.nonzero(sh)):
        out[y, x] = R(SUN, 0) if h01(x, y, 97) < 0.7 else R(SUN, 1)
    return out


# ───────────────────────── 삼나무(杉) 원뿔 수관 ─────────────────────────
def cone_draw(lv, hue, cx, top, base, halfw, seed, lit=4.8, tier=4.5):
    """삼나무 한 그루 수관: 뾰족한 끝 + 아래로 처진 가지 층(층마다 끝이 1~2px 바깥으로 처지고 아랫면 한 줄 그늘).
    빛은 왼쪽 위: 왼쪽 반 밝게, 오른쪽 반·층 아랫면 어둡게. 검은 윤곽 없음(재료 색 가장자리). 반환: 칠한 칸 마스크."""
    H, W = lv.shape
    S = np.zeros((H, W), bool)
    hgt = max(4.0, base - top)
    rows = {}
    for y in range(int(top), int(math.ceil(base)) + 1):
        if not (0 <= y < H): continue
        t = (y - top) / hgt
        k = (y - top) % tier
        tier_i = int((y - top) // tier)
        hw = halfw * (t ** 0.72) * (0.8 + 0.2 * (k / tier))       # 층 안에서 아래로 갈수록 넓어진다(층마다 폭이 들쭉)
        hw *= 0.92 + h01(tier_i, 2, seed) * 0.16
        hw += (h01(y, 1, seed) - 0.5) * 0.9
        if y == int(top): hw = 0.4
        rows[y] = (hw, k)
        for x in range(int(cx - hw - 1), int(cx + hw + 2)):
            if 0 <= x < W and abs(x + 0.5 - cx) <= hw + 0.25:
                S[y, x] = True
    for y in range(H):
        if y not in rows: continue
        hw, k = rows[y]
        for x in range(W):
            if not S[y, x]: continue
            dx = (x + 0.5 - cx) / max(1.0, hw)
            L = lit - dx * 1.6 - (y - top) / hgt * 0.8
            if k > tier - 1.2 and y < base - 1 and h01(x, y, seed + 7) > 0.25 - dx * 0.2: L -= 1.3   # 층 아랫면 그늘(끊기고 오른쪽이 짙다)
            elif k < 1.0: L += 0.7                                            # 층 윗면 빛
            if abs(x + 0.5 - cx) < 0.8 and k < tier - 1.2: L += 0.4           # 가운데 줄기 쪽 결
            if h01(x, y, seed + 3) < 0.05: L -= 1.5
            right = not (x + 1 < W and S[y, x + 1]); below = not (y + 1 < H and S[y + 1, x])
            left = not (x > 0 and S[y, x - 1])
            if right or below: L = min(L, 1.6)
            elif left: L = max(L, 4.5)
            lv[y, x] = int(max(0, min(NLV - 1, math.floor(L + 0.5))))
            hue[y, x] = h01(int(cx), int(top), seed + 5)
    return S


def sugi_cones(W, H, seed, variant, margin=1, min_top=1, band=(0.7, 1.0)):
    """키트 칸 안을 덮는 삼나무 원뿔 줄(뒤 줄 → 앞 줄). 반환 [(cx, top, base, halfw, lit)]."""
    out = []
    rows_ = max(1, round(H / 11))
    for r in range(rows_):
        base = min(H - margin - 1, (r + 1) * H / rows_ + 3)
        sp = 7.0 + h01(r, variant, seed) * 2.0
        x = margin + 3 + h01(r, variant, seed + 1) * sp * 0.6
        i = 0
        while x < W - margin - 3:
            hw = 4.8 + h01(i, r + variant * 7, seed + 2) * 2.2
            hw = min(hw, x - margin, W - margin - 1 - x)
            ht = min(base - min_top, 13 + h01(i, r + variant * 7, seed + 3) * 9) * (band[0] + h01(i, r, seed + 6) * (band[1] - band[0]))
            top = max(min_top, base - ht)
            if hw >= 2.5:
                out.append((x, top, base, hw, 4.3 + h01(i, r + variant * 7, seed + 4) * 1.3))
            x += sp * (0.85 + h01(i, r, seed + 5) * 0.35)
            i += 1
    return out


def edge_crown_kit(kind, tex, seed, wide=2, rise=10, variant=0):
    """하늘선 머리: 위 가장자리 칸 wide 개(가운데 줄) + 그 밑 몸통 칸(아랫줄) + 숲 밖 위 칸(윗줄, 투명 덧그림).
    큰 덩이가 위 가장자리에서 rise px 솟는다 → 하늘선 높이가 칸마다 4~12px 들쭉날쭉. 좌우 끝 2열은 표준 칸과 같아 이웃과 이어진다.
    반환 RGBA (48 x wide*16). 윗줄은 숲 밖 칸 위에 얹는 위층 칸이다."""
    W, H = wide * 16, 48
    g = np.zeros((5, wide + 2), bool)
    g[2:, :] = True                              # 칸 줄 0 = 숲 밖, 1 = 위 가장자리, 2 = 몸통(캔버스 기준 g 줄 1..3)
    pad = 3
    ins = np.zeros((H + 2 * pad, W + 2 * pad), bool)
    for j in range(H + 2 * pad):
        for i in range(W + 2 * pad):
            ins[j, i] = _inside_global(g, 16 + i - pad, 16 + j - pad, kind)
    lv = _tiled_tex(tex[0], W, H).copy()
    hue = _tiled_tex(tex[1], W, H).copy()
    if kind == 'bamboo':
        # 대숲 하늘선: 우듬지 잎 부채가 위 가장자리 위로 rise px 솟아 아래로 휘어 늘어진다(투명 바탕 위 잎 장)
        n = 2 if wide == 2 else 3
        for k in range(n):
            ox = int((k + 0.5) * W / n + (h01(k, variant, seed) - 0.5) * 5)
            oy = 16 - rise + int(h01(k, variant, seed + 1) * 4)
            # 잎이 빈 하늘(윗줄)에 걸리는 자리를 안쪽으로 표시하고 단을 칠한다
            tmp = np.full((H, W), -1, np.int16); th = np.zeros((H, W), np.float32)
            for j in range(3):
                draw_spray(tmp, th, ox + (j - 1) * 3, oy + j * 3, 6 - j, seed + k * 13 + j * 5, wrap=False, bright=1 - j, length=(5, 8))
            # 부채 밑 그늘(몸통 위)
            for y in range(H):
                for x in range(W):
                    if tmp[y, x] < 0 and 0 < y - 2 < H and tmp[y - 2, x] >= 0 and y >= 18 and ins[y + pad, x + pad]:
                        lv[y, x] = min(lv[y, x], 1)
            m = tmp >= 0
            m[:, :2] = False; m[:, W - 2:] = False; m[H - 2:, :] = False
            lv[m] = tmp[m]; hue[m] = th[m]
            ins[pad:pad + H, pad:pad + W] |= m
        return render_levels(lv, ins, kind, pad, hue)
    if kind == 'sugi':
        # 삼나무 하늘선: 뾰족한 끝이 위 가장자리 위로 rise~rise+6 px 솟는 원뿔 2~3그루(좌우 끝 2열은 표준 칸)
        n = 2 if wide == 2 else 3
        for k in range(n):
            cx = 2 + (k + 0.5) * (W - 4) / n + (h01(k, variant, seed) - 0.5) * 3
            top = 16 - rise - h01(k, variant, seed + 1) * 6
            base = 16 + 18 + h01(k, variant, seed + 2) * 8
            hw = min(5.5 + h01(k, variant, seed + 3) * 1.5, cx - 2, W - 3 - cx)
            S = cone_draw(lv, hue, cx, max(0, top), min(H - 3, base), hw, seed + k * 19, 4.8 + h01(k, variant, seed + 4))
            ins[pad:pad + H, pad:pad + W] |= S
        return render_levels(np.maximum(lv, 0), ins, kind, pad, hue)
    masses = []
    if wide == 2:
        masses = [(W / 2 - 0.5 + (h01(variant, 1, seed) - 0.5) * 3, 16 + 13 - rise * 0.5, 12.0, 11.0)]
    else:
        masses = [(13 + (h01(variant, 2, seed) - 0.5) * 3, 16 + 14 - rise * 0.45, 10.5, 10.0),
                  (W - 15 + (h01(variant, 3, seed) - 0.5) * 3, 16 + 12 - rise * 0.6, 12.0, 11.0)]
    for ci, (cx, cy, rx, ry) in enumerate(masses):
        for k in range(12):
            S, _ = mass_silhouette(W, H, cx, cy, rx, ry, seed + ci * 17, False)
            if not (S[:, :2].any() or S[:, W - 2:].any() or S[H - 2:, :].any()): break
            rx *= 0.93; ry *= 0.93
        mass_levels(lv, hue, S, cx, cy, rx, ry, seed + ci * 17, kind, lit=5.1, shadow=(1, 2))
        ins[pad:pad + H, pad:pad + W] |= S
    return render_levels(lv, ins, kind, pad, hue)


# ───────────────────────── 한 그루 나무 키트(성긴 숲·길가) ─────────────────────────
TREE_LAYOUTS = {
    # (칸 폭, 칸 높이, 덩이 [(cx, cy, rx, ry)], 줄기 [(x, 굵기)])
    't3x4': (3, 4, [(24, 27, 21, 19)], [(21, 7)]),
    't2x3': (2, 3, [(16, 19, 14, 13)], [(13, 6)]),
    't4x4': (4, 4, [(21, 25, 18, 16), (43, 30, 18, 16)], [(18, 6), (41, 6)]),
}


def tree_kit(key, seed, kind='broadleaf', variant=0):
    """한 그루 나무(성긴 숲·길가). 덩이 수관(검은 윤곽 없음, 왼쪽 위 빛) + 굵고 짧은 줄기(뿌리 퍼짐·이끼·세로 껍질 골)
    + 수관 모양을 따라 오른쪽 아래로 진 두 단 그림자(변형마다 모양이 다르다, 바둑 무늬 없음)."""
    w, h, crowns, trunks = TREE_LAYOUTS[key]
    W, H = w * 16, h * 16
    a = np.zeros((H, W, 4), np.uint8)
    foot = H - 4
    if kind == 'sugi':
        return _sugi_tree(key, seed, variant)
    # 땅 그림자: 수관 그림자(오른쪽 아래로 밀린 덩이 모양) + 밑동 접지 그늘
    for ci, (cx, cy, rx, ry) in enumerate(crowns):
        gx, gy = cx + rx * 0.25, foot - 1
        grx, gry = rx * (0.95 + h01(ci, variant, seed + 1) * 0.25), 3.2 + h01(ci, variant, seed + 2) * 1.6
        for y in range(H):
            for x in range(W):
                dx, dy = (x + 0.5 - gx) / grx, (y + 0.5 - gy) / gry
                wob = 1 + (h01(int(math.atan2(dy, dx) * 3 + 9), ci, seed + 3) - 0.5) * 0.3
                q = dx * dx + dy * dy
                if q <= wob:
                    a[y, x] = R(PBX, 2) if q <= wob * 0.55 else R(PBX, 3)
    # 줄기
    crown_bot = min(cy + ry for (cx, cy, rx, ry) in crowns)
    trunks = [(tx - (variant % 3 == 2), tw + (variant % 3) - (1 if key == 't2x3' and variant % 3 == 2 else 0)) for (tx, tw) in trunks]
    for ti, (tx, tw) in enumerate(trunks):
        top = int(crown_bot) - 6
        moss = h01(ti, variant, seed + 4) < 0.45
        fl_l = 1 + int(h01(ti, variant, seed + 6) * 3)          # 뿌리 퍼짐: 좌우 비대칭 1~3px
        fl_r = 1 + int(h01(ti, variant, seed + 7) * 3)
        for y in range(top, foot + 1):
            t = max(0, y - (foot - 3))
            xl, xr = tx - min(t, fl_l) - (1 if y == foot and fl_l > 1 else 0), tx + tw - 1 + min(t, fl_r) + (1 if y == foot and fl_r > 1 else 0)
            for x in range(xl, xr + 1):
                i = x - xl
                L = _bark(y - top, i, xr - xl + 1, 0)
                if i == 2 and (y + ti) % 5 < 3 and tw >= 5: L = max(0, L - 1)
                c = R(BARK, L)
                if moss and i <= 1 and foot - 6 - variant <= y <= foot - 3 and h01(x, y, seed + 8) < 0.75: c = R(SUN, 3 if i == 0 else 2)
                a[y, x] = c
            a[y, xl - 1] = R(PBX, 1); a[y, xr + 1] = R(PBX, 1)
        for i in range(-3, tw + 3):
            if a[foot + 1, tx + i, 3] == 0 or True: a[foot + 1, tx + i] = R(PBX, 1)
    # 수관
    lv = np.full((H, W), -1, np.int16)
    hue = np.zeros((H, W), np.float32)
    own = np.zeros((H, W), bool)
    for ci, (cx, cy, rx, ry) in enumerate(sorted(crowns, key=lambda c: c[1])):
        cx2 = cx + (h01(ci, variant, seed + 5) - 0.5) * 3
        S, (cx2, cy2, rx2, ry2) = fit_silhouette(W, H, cx2, cy, rx, ry, seed + ci * 23 + variant * 101, key == 't2x3', margin=1)
        lv[S & (lv < 0)] = 3
        mass_levels(lv, hue, S, cx2, cy2, rx2, ry2, seed + ci * 23 + variant * 101, kind, lit=5.0, sp=7.0, wg=2.4, wc=1.5)
        own |= S
    ins = np.zeros((H + 6, W + 6), bool)
    ins[3:-3, 3:-3] = own
    crown = render_levels(np.maximum(lv, 0), ins, kind, 3, hue)
    m = crown[:, :, 3] > 0
    a[m] = crown[m]
    # 수관이 줄기에 드리운 그늘(수관 밑 3줄)
    for (tx, tw) in trunks:
        for x in range(tx, tx + tw):
            col = [y for y in range(H) if own[y, x]]
            if col:
                b = max(col)
                for y in range(b + 1, min(foot - 3, b + 4)):
                    a[y, x] = R(BARK, 0) if y - b < 3 else R(BARK, 1)
    return a


SUGI_TREE_LAYOUTS = {'s2x4': (2, 4), 's2x5': (2, 5), 's3x5': (3, 5)}


def _sugi_tree(key, seed, variant):
    """한 그루 삼나무: 곧은 붉은 줄기(아래 1/4 드러남) + 층진 원뿔 수관 + 왼쪽 아래 비낀 길쭉한 그림자."""
    w, h = SUGI_TREE_LAYOUTS[key]
    W, H = w * 16, h * 16
    a = np.zeros((H, W, 4), np.uint8)
    foot = H - 4
    cx = W / 2 + (h01(variant, 1, seed) - 0.5) * 2
    hw = min(W / 2 - 1.5, 7.5 + w * 1.8 + h01(variant, 2, seed) * 1.5)
    top = 1 + h01(variant, 3, seed) * 3
    base = foot - 4 - h01(variant, 4, seed) * 3
    # 땅 그림자(오른쪽 아래로 길게)
    for y in range(foot - 3, H):
        for x in range(W):
            dx, dy = (x + 0.5 - cx - 3) / (hw * 0.9), (y + 0.5 - foot) / 2.6
            if dx * dx + dy * dy <= 1 + (h01(x, y, seed + 9) - 0.5) * 0.3:
                a[y, x] = R(PBX, 2) if dx * dx + dy * dy < 0.5 else R(PBX, 3)
    tw = 3 + (variant % 2)
    tx = int(cx - tw / 2)
    for y in range(int(base) - 6, foot + 1):
        fl = 1 if y >= foot - 1 else 0
        for x in range(tx - fl, tx + tw + fl):
            i = x - (tx - fl)
            a[y, x] = R(BARK, 4 if i == 0 else (2 if i == tw + 2 * fl - 1 else 3))
        a[y, tx - fl - 1] = R(PBX, 1); a[y, tx + tw + fl] = R(PBX, 1)
    lv = np.full((H, W), -1, np.int16)
    hue = np.zeros((H, W), np.float32)
    S = cone_draw(lv, hue, cx, top, base, hw, seed + variant * 7, 5.0, tier=4.0 + (variant % 2))
    ins = np.zeros((H + 6, W + 6), bool)
    ins[3:-3, 3:-3] = S
    crown = render_levels(np.maximum(lv, 0), ins, 'sugi', 3, hue)
    m = crown[:, :, 3] > 0
    a[m] = crown[m]
    return a


# ───────────────────────── 앞줄 줄기 띠 ─────────────────────────
def _bark(y, i, tw, top_dark, lit_x=0):
    """나무껍질 단(0..6): 왼쪽 1px 빛, 오른쪽 그늘, 위쪽(수관 밑)은 어둡다."""
    if i == lit_x: L = 4
    elif i == tw - 1: L = 1
    elif i == tw - 2 and tw > 3: L = 2
    else: L = 3
    if y < top_dark: L = max(0, min(L, 1 + y // 2))
    return L


def _broadleaf_band(a, P, part, variant, s, x0, x1, H, kind='broadleaf'):
    """활엽 숲 벽(S 가장자리 밑 한 칸). 버들항식: 수관 밑 그늘은 검정이 아닌 짙은 청록, 줄기는 굵기 3~8px·뿌리 퍼짐·이끼,
    위에서 잎 뭉치가 1~6px 늘어지고, 밑동에는 고사리·덤불 덩이, 맨 아래는 투명(땅이 비친다) + 잔디 위 그늘 점."""
    floor_y = H - 3
    open_ = part == 'one'
    lv = np.full((H, 16), -1, np.int16)            # 잎 단(덤불·늘어진 잎)
    # 1) 숲 속 어둠(투명 아래 끝은 들쭉)
    bottom = [floor_y - 1 - int(h01(x // 3, 1, s + 1) * 3) - (1 if h01(x, 2, s + 1) < 0.3 else 0) for x in range(16)]
    for x in range(16):
        if open_ and not (4 <= x <= 11): continue
        for y in range(0, bottom[x] + 1):
            if part == 'L' and x < x0 + 2 and y > 1 + (x - x0) * 3: continue
            if part == 'R' and x > x1 - 2 and y > 1 + (x1 - x) * 3: continue
            if x < x0 - (0 if part != 'L' else 0) or x > x1: continue
            k = h01(x, y, s)
            P(x, y, R(SUN, 0) if (y < 4 or k < 0.4) else R(SUN, 1) if k < 0.85 else R(PBX, 2))
    # 2) 먼 줄기(희미, 1~2px)
    for bx in ((2, 12), (6, 13), (4, 10), (1, 8, 14), (9,), (3, 11))[variant % 6]:
        if x0 + 1 <= bx <= x1 - 1 and not open_:
            for y in range(4, bottom[bx] - 1):
                P(bx, y, R(BARK, 2) if y > 8 else R(BARK, 1))
    # 3) 앞 줄기: 굵기·자리·뿌리가 변형마다 다르다
    # 변형: 굵기 3~12px, 한두 그루, 또는 잎이 땅까지 늘어져 줄기를 가린다(drape) — 같은 간격의 「울타리」가 되지 않게
    # 가는 막대 줄기(3~4px)를 줄였다(Argon r6: 「울타리·바코드」). 두 변형(4·7)은 잎이 땅까지 늘어져 줄기가 거의 안 보인다.
    sets = [[(4, 6)], [(10, 5)], [(8, 8)], [(3, 11)], [(2, 6)], [(10, 5)], [(5, 9)], []]
    drape = {5: (0, 8), 7: (0, 16), 1: (0, 5), 4: (9, 16), 2: (0, 6), 3: (14, 16)}.get(variant % 8) if not open_ else None
    trunks = [(5, 6)] if open_ else sets[variant % 8]
    if part == 'L': trunks = [(max(t[0], x0 + 3), t[1]) for t in trunks]
    if part == 'R': trunks = [(min(t[0], x1 - 2 - t[1]), t[1]) for t in trunks]
    for ti, (tx, tw) in enumerate(trunks):
        lean = 1 if h01(ti, variant, s + 7) < 0.3 else 0
        top_dark = 4 + int(h01(ti, variant, s + 8) * 3)
        moss = h01(ti, variant, s + 9) < 0.5
        for y in range(0, floor_y + 1):
            flare = max(0, y - (floor_y - 3))                           # 밑동 3줄은 양쪽으로 퍼진다(뿌리)
            off = lean if y < floor_y // 2 else 0
            xl, xr = tx - flare + off, tx + tw - 1 + flare + off
            for x in range(xl, xr + 1):
                i = x - xl
                L = _bark(y, i, xr - xl + 1, top_dark)
                if i == 1 + (ti + variant) % 2 and (y + ti) % 5 < 3 and xr - xl >= 4: L = max(0, L - 1)   # 세로 껍질 골
                c = R(BARK, L)
                if moss and i <= 1 and 5 <= y <= 9 + ti and h01(x, y, s + 11) < 0.7:
                    c = R(SUN, 3 if i == 0 else 2)                                       # 북서쪽 이끼
                P(x, y, c)
            if xr - xl >= 2:
                P(xl - 1, y, R(SUN, 0)); P(xr + 1, y, R(SUN, 0))
    # 4) 위에서 늘어진 잎 덩이(수관 아랫선을 칸마다 2~7px 들쭉날쭉하게): 둥근 아랫단(가리비 모양) 덩이를 잇대어 건다.
    #    덩이마다 아랫단 1px 은 그늘, 그 위 왼쪽 반은 비껴 드는 빛, 위쪽은 수관 앞면 중간 녹(덩이 사이 틈은 한 단 어둡게).
    bot = np.full(16, -1.0)
    owner = np.full(16, -1)
    bx = -2 + h01(variant, 5, s + 12) * 3
    k = 0
    lobes = []
    while bx < 18:
        r = 2.6 + h01(k, variant, s + 13) * 2.4
        d = 2.0 + h01(k, variant, s + 14) * 5.5
        if drape and drape[0] <= bx <= drape[1]:
            d = H - 4 - h01(k, variant, s + 18) * 2         # 땅까지 늘어진 잎(줄기를 가린다)
            r = max(r, 3.4)
        if (part == 'L' and bx < x0 + 1) or (part == 'R' and bx > x1 - 1) or (open_ and not (3 <= bx <= 12)):
            d = min(d, 2.5)
        lobes.append((bx, r, d))
        bx += r * (1.3 + h01(k, variant, s + 17) * 0.5)
        k += 1
    for x in range(16):
        for li, (bx, r, d) in enumerate(lobes):
            dx = x + 0.5 - bx
            if abs(dx) <= r:
                b = d - r + math.sqrt(max(0.0, r * r - dx * dx))
                if b > bot[x]: bot[x] = b; owner[x] = li
    for x in range(16):
        if bot[x] < 0: continue
        if (part == 'L' and x < x0) or (part == 'R' and x > x1) or (open_ and not (4 <= x <= 11)): continue
        bx, r, d = lobes[owner[x]]
        left = x + 0.5 < bx
        yb = int(round(bot[x]))
        for y in range(0, yb + 1):
            fromb = yb - y
            if fromb == 0: L = 1
            elif fromb <= 2: L = 4 if left else 3
            else: L = 3 if h01(x, y, s + 23) < 0.6 else 2
            nb = owner[x - 1] if x > 0 else owner[x]
            if nb != owner[x] and fromb <= 3: L = max(1, L - 1)      # 덩이 사이 틈
            if fromb >= 3 and h01(x, y, s + 24) < 0.06: L = 5          # 잎 끝 반짝
            lv[y, x] = L
    # 5) 밑동 덤불·고사리(작은 잎 덩이) — 투명 바닥 위로 들쭉하게 솟는다
    bx = -1 + int(h01(variant, 2, s + 15) * 3)
    while bx < 17:
        r = 1.5 + h01(bx, variant, s + 16) * 1.6
        cyb = H - 1.5 - h01(bx, variant, s + 17) * 1.5
        if (open_ and not (2 <= bx <= 13)) or (part == 'L' and bx < x0) or (part == 'R' and bx > x1):
            bx += 3; continue
        for y in range(int(cyb - r - 1), H):
            for x in range(int(bx - r - 1), int(bx + r + 2)):
                if not (0 <= x < 16 and 0 <= y < H): continue
                dx, dy = (x + 0.5 - bx) / r, (y + 0.5 - cyb) / (r * 0.8)
                if dx * dx + dy * dy > 1 + (h01(x, y, s + 18) - 0.5) * 0.5: continue
                lt = -(dx * 0.55 + dy * 0.85)
                L = 3.2 + lt * 2.0 + (h01(x, y, s + 19) - 0.5) * 0.9
                lv[y, x] = int(max(1, min(6, round(L))))
        bx += 3 + int(h01(bx, variant, s + 20) * 4)
    for y in range(H):
        for x in range(16):
            if lv[y, x] >= 0:
                P(x, y, _lv_color(kind, int(lv[y, x]), x, y, 7, hue=0.6))
    # 6) 잔디 위 그늘(숲 벽 밑, 두 단 덩이 — 바둑 무늬 아님). 아래 끝은 2~3px 들쭉.
    for x in range(16):
        if open_ and not (3 <= x <= 12): continue
        if (part == 'L' and x < x0 - 1) or (part == 'R' and x > x1 + 1): continue
        depth = 2 + int(h01(x // 3, 0, s + 21) * 2)
        for y in range(H - 4, H):
            if a[y, x, 3] == 0 and y < H - 4 + depth + 1:
                P(x, y, R(PBX, 2) if y < H - 2 or h01(x, y, s + 22) < 0.5 else R(PBX, 3))
    return a


def trunk_band(kind, part, variant):
    """수관 덩이 아랫줄(S 가장자리) 바로 밑 칸. part: 'L','M','R','one'.
    활엽: 1칸(16x16). 대숲: 2칸(16x32) — 대나무는 키가 커서 3/4 정면이 길다.
    큰 덩이(L/M/R): 줄기 사이가 숲 속 어둠. 'one'(폭 1칸 끝): 줄기 하나 + 잔디."""
    H = 16 if _broad(kind) else 32
    a = np.zeros((H, 16, 4), np.uint8)
    s = 200 + variant * 13 + (ord(part[0]) * 3)

    def P(x, y, c):
        if 0 <= x < 16 and 0 <= y < H: a[y, x] = c

    open_ = part == 'one'
    x0 = 3 if part in ('L', 'one') else 0
    x1 = 12 if part in ('R', 'one') else 15
    floor_y = H - 4
    if _broad(kind):
        return _broadleaf_band(a, P, part, variant, s + (0 if kind == 'broadleaf' else 7), x0, x1, H, kind)

    # ── 대숲 줄기 벽(2칸) ──
    return _bamboo_band(a, P, part, variant, s, x0, x1, H)


def _bamboo_band(a, P, part, variant, s, x0, x1, H):
    """대숲 벽: 짙은 청록 숲 속 앞에 굵기 1~3px 대 줄기가 엇갈려 선다(간격·밑동 높이·기울기 제각각),
    위에서 잎 다발이 4~9px 늘어져 윗선을 가리고, 밑동에는 잎 덩이·죽순, 맨 아래는 투명 + 잔디 위 그늘."""
    open_ = part == 'one'
    floor_y = H - 3
    lv = np.full((H, 16), -1, np.int16)
    hue = np.zeros((H, 16), np.float32)
    lo, hi = (4, 11) if open_ else (x0, x1)
    # 1) 숲 속 어둠
    for x in range(lo, hi + 1):
        bot = floor_y - int(h01(x, 1, s + 1) * 2)
        for y in range(0, bot + 1):
            if part == 'L' and x < x0 + 2 and y > 2 + (x - x0) * 5: continue
            if part == 'R' and x > x1 - 2 and y > 2 + (x1 - x) * 5: continue
            P(x, y, R(SUN, 0) if h01(x, y, s) < 0.75 else R(SUN, 1))
    # 2) 뒤 줄기(가늘고 어둡게, 마디만 한 점 밝게)
    for bi, bx in enumerate(((2, 9, 14), (5, 11), (1, 7, 12), (4, 10, 15))[variant % 4]):
        if lo + 1 <= bx <= hi - 1 and not open_:
            ph = int(h01(bx, 1, s + 3) * 7)
            for y in range(2, floor_y - 1):
                P(bx, y, R(CULM, 1) if (y + ph) % 7 else R(CULM, 3))
    # 3) 앞 줄기: (x, 굵기 1~3, 밑동 높이, 기울기)
    sets = [[(1, 2), (4, 3), (8, 1), (11, 2), (14, 3)], [(2, 3), (6, 2), (9, 3), (13, 1)], [(0, 2), (3, 1), (5, 3), (10, 2), (13, 2)],
            [(2, 2), (7, 3), (10, 1), (12, 3)]]
    culms = [(6, 2), (9, 2)] if open_ else sets[variant % 4]
    culms = [(cx, cw) for (cx, cw) in culms if lo <= cx and cx + cw - 1 <= hi]
    for ci, (cx, cw) in enumerate(culms):
        foot = floor_y - int(h01(ci, variant, s + 15) * 4)
        lean = 1 if h01(ci, variant, s + 16) < 0.3 else 0
        phase = int(h01(ci, variant, s + 9) * 8)
        gap = 7 + int(h01(ci, variant, s + 10) * 3)
        for y in range(0, foot + 1):
            ox = lean if y < foot * 0.4 else 0
            for i in range(cw):
                if cw == 1: L = 4
                elif i == 0: L = 5
                elif i == cw - 1: L = 2
                else: L = 4
                if (y + phase) % gap == 0 and y > 1: L = 1                          # 마디 아래 그늘
                elif (y + phase) % gap == gap - 1 and y > 1: L = min(6, L + 1)      # 마디 위 빛 띠
                P(cx + i + ox, y, R(CULM, L))
    # 4) 늘어진 잎 다발(윗선 가림, 4~9px)
    k = 0
    xs = lo - 1 + int(h01(variant, 3, s + 30) * 2)
    while xs <= hi + 1:
        n = 3 + int(h01(k, variant, s + 31) * 3)
        yy = int(h01(k, variant, s + 32) * 3)
        draw_spray(lv, hue, xs, yy, n, s + 40 + k * 7, wrap=False, bright=0, length=(4, 7))
        xs += 3 + int(h01(k, variant, s + 33) * 3)
        k += 1
    # 수관 밑 그늘 띠(맨 위 2줄은 늘어진 잎 사이도 어둡게)
    for x in range(lo, hi + 1):
        for y in range(0, 2):
            if lv[y, x] < 0: lv[y, x] = 1 if h01(x, y, s + 34) < 0.6 else 2
    # 5) 밑동 잎 덩이·죽순
    for x in range(lo - 1, hi + 2):
        hgt = 1 + int(h01(x // 2, 3, s + 13) * 3)
        for kk in range(hgt):
            y = H - 2 - kk
            if 0 <= x < 16: lv[y, x] = 3 + min(3, kk)
    for y in range(H):
        for x in range(16):
            if lv[y, x] >= 0:
                if (part == 'L' and x < x0) or (part == 'R' and x > x1): continue
                P(x, y, _lv_color('bamboo', int(lv[y, x]), x, y, 9, hue=float(hue[y, x])))
    # 6) 잔디 위 그늘
    for x in range(lo - 1, hi + 2):
        if not 0 <= x < 16: continue
        for y in range(H - 2, H):
            if a[y, x, 3] == 0 and h01(x // 2, y, s + 21) < 0.8:
                P(x, y, R(PBX, 2) if y == H - 2 else R(PBX, 3))
    return a


def build_bands(kind):
    out = {}
    for part in ('L', 'M', 'R', 'one'):
        for v in range(8 if part == 'M' else 3):
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
        # 가장 흔한 곧은 가장자리(위·아래·왼·오른)는 윤곽 변형 × 몸통 변형을 섞어 칸마다 다르게 한다
        nt = len(self.tex)
        self.n_edge = [self.tiles[EDGE_MASK]] + ([paint_canopy_tile(EDGE_MASK, kind, self.tex[(v * 3) % nt], v % 4) for v in range(1, 6)] if _broad(kind) else [])
        self.s_edge = [self.tiles[S_EDGE_MASK]] + ([paint_canopy_tile(S_EDGE_MASK, kind, self.tex[v % nt]) for v in range(1, 6)] if _broad(kind) else [])
        self.w_edge = [self.tiles[W_EDGE_MASK]] + ([paint_canopy_tile(W_EDGE_MASK, kind, self.tex[(v * 5) % nt]) for v in range(1, 4)] if _broad(kind) else [])
        self.e_edge = [self.tiles[E_EDGE_MASK]] + ([paint_canopy_tile(E_EDGE_MASK, kind, self.tex[(v * 7) % nt]) for v in range(1, 4)] if _broad(kind) else [])
        self.patches = {}
        for key in CROWN_LAYOUTS[_layout_kind(kind)]:
            for v in range(N_HEAD_VARIANTS.get(key, 2) if _broad(kind) else 2):
                self.patches[(key, v)] = crown_patch(kind, key, self.tex[0], 700 + v * 31 + len(key) * 7, v)
        self.edge_kits = ([edge_crown_kit(kind, self.tex[0], 900 + v * 41, 2, rise=(5, 9, 12)[v], variant=v) for v in range(3)] +
                          [edge_crown_kit(kind, self.tex[0], 960 + v * 41, 3, rise=(8, 12)[v], variant=v) for v in range(2)])
        self.trees = {}
        if kind == 'broadleaf':
            for key in TREE_LAYOUTS:
                for v in range(4):
                    self.trees[(key, v)] = tree_kit(key, 1100 + v * 53 + len(key), variant=v)
        elif kind == 'sugi':           # 한 그루 느티·벚은 jp_street_trees(가로수 3×4, 사용자 승인 시안)를 쓴다 — 여기서 다시 그리지 않는다
            for key in SUGI_TREE_LAYOUTS:
                for v in range(4):
                    self.trees[(key, v)] = _sugi_tree(key, 1300 + v * 53 + len(key), v)

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
        for t in self.n_edge + self.s_edge + self.w_edge + self.e_edge: add(t)
        for p in self.patches.values(): add(p)
        for e in self.edge_kits: add(e)
        for t in self.trees.values(): add(t)
        return len(cells)


EDGE_MASK = canon(2 | 4 | 8 | 32 | 64)
S_EDGE_MASK = canon(1 | 2 | 8 | 16 | 128)
W_EDGE_MASK = canon(1 | 2 | 4 | 16 | 32)
E_EDGE_MASK = canon(1 | 4 | 8 | 64 | 128)


def _head_ok(canopy, x, y, kind):
    """머리 키트를 얹을 수 있는 칸: 속칸(255). 활엽은 아래 가장자리 칸도 된다(아랫선을 줄기 띠가 만들어 칸 그림이 속칸과 같은 결이다)."""
    m = canon(mask_at(canopy, x, y))
    if m == 255: return True
    return _broad(kind) and (m | 4 | 32 | 64) == 255


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
            elif m == S_EDGE_MASK:
                t = kit.s_edge[cell_hash(x + 5, y) % len(kit.s_edge)]
            elif m == W_EDGE_MASK:
                t = kit.w_edge[cell_hash(x + 7, y) % len(kit.w_edge)]
            elif m == E_EDGE_MASK:
                t = kit.e_edge[cell_hash(x + 9, y) % len(kit.e_edge)]
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
                                    and _head_ok(canopy, x + i, y + 1, kind) for i in range(w))
            if ok and GA.h01(x, y, seed + 77) < 0.9:
                over(img, ek, x * 16, (y - 1) * 16)
                used[y:y + 2, x:x + w] = True
                x += w + 1
            else:
                x += 1
    # 4) 몸통 위 큰 수관 머리 — 위에서 아래로 훑으며 큰 키트부터 촘촘히
    keys = [k for k in CROWN_LAYOUTS[_layout_kind(kind)] if CROWN_LAYOUTS[_layout_kind(kind)][k][0] * CROWN_LAYOUTS[_layout_kind(kind)][k][1] >= 4]
    for y in range(H):
        for x in range(W):
            if used[y, x]: continue
            order = sorted([k for k in keys if k != 'c1x1'], key=lambda k: GA.h01(x, y, seed + 7 + sum(map(ord, k)))) + (['c1x1'] if 'c1x1' in keys else [])
            for key in order:
                w, h, _ = CROWN_LAYOUTS[_layout_kind(kind)][key]
                if x + w > W or y + h > H: continue
                if any(used[y + j, x + i] or not canopy[y + j, x + i] or not _head_ok(canopy, x + i, y + j, kind)
                       for j in range(h) for i in range(w)): continue
                if key != 'c1x1' and GA.h01(x, y, seed + 6) > patch_cover: break
                nv = len([k for k in kit.patches if k[0] == key])
                over(img, kit.patches[(key, cell_hash(x, y) % nv)], x * 16, y * 16)
                used[y:y + h, x:x + w] = True
                break
    # 5) 활엽: 둘째 머리 층(한 층 위) — 첫 층 키트 경계에 걸쳐 엇갈리게 얹어 키트 사이 골을 덮는다(덩이가 서로 겹친 지붕)
    if _broad(kind):
        used2 = np.zeros((H, W), bool)
        big = [k for k in keys if k != 'c1x1']
        for y in range(1, H):
            for x in range(1, W):
                if used2[y, x] or GA.h01(x, y, seed + 31) > 0.5: continue
                for key in sorted(big, key=lambda k: GA.h01(x, y, seed + 37 + sum(map(ord, k)))):
                    w, h, _ = CROWN_LAYOUTS[_layout_kind(kind)][key]
                    if x + w > W or y + h > H: continue
                    if any(used2[y + j, x + i] or not canopy[y + j, x + i] or not _head_ok(canopy, x + i, y + j, kind)
                           for j in range(h) for i in range(w)): continue
                    nv = len([k for k in kit.patches if k[0] == key])
                    over(img, kit.patches[(key, cell_hash(x + 11, y + 5) % nv)], x * 16, y * 16)
                    used2[y:y + h, x:x + w] = True
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
        over(img, kit.trees[(key, cell_hash(x, y) % 4)], left * 16, top * 16)
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
