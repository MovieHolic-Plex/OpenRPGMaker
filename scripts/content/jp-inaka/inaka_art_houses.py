#!/usr/bin/env python3
# noqa: SIZE_OK - jp-inaka shared 3/4 drawing parts + the 10 rural building kits
# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "pillow"]
# ///
# --- How to run ---
# python3 scripts/content/jp-inaka/render_kit.py --ids inaka-kominka-thatched --out /tmp/x   (작업자 대조판, 저장소에 안 씀)
"""jp-inaka(일본 시골) 건물 키트 10종 + 다른 이나카 모듈이 쓰는 공용 3/4 도트 부품.

R5(버들항 깊이) 화풍 규칙:
  - 3/4 탑뷰: 지붕은 경사 윗면(기와 장·초가 다발 결)이 보이고, 그 아래 남쪽 정면 벽, 맨 아래 기단 윗면 + 앞면. 옆면 없음.
  - 색은 modern3 램프(K) + 일본 로케일 계약 색(J) 만. 빛은 왼쪽 위(따뜻), 그늘은 오른쪽 아래(조금 차갑게).
  - 재질마다 4~6단: 기와는 장마다 하이라이트·골 그늘, 회벽은 얼룩·아래 때, 판벽은 판마다 톤·결, 초가는 다발 결·이끼, 돌은 한 개씩.
  - 윤곽은 마지막에 inaka_style.tint_outlines 로 이웃 재질의 어두운 톤이 된다(보라검정 스티커 금지). 발치는 ground_shadow.
  - 결은 위치 해시 H(x, y, seed) 로만 낸다(난수 없음 → 굽기 결과가 매번 같다).
jp_city 부품(house_kit / ref_house / jp_regions_pack)은 import 만 하고 고치지 않는다. 더 깊은 판은 이 파일 안 사본(_kawara_* 등)이다.
"""
from __future__ import annotations

import json
import math
import os
import sys
from functools import lru_cache
from typing import Final

HERE: Final[str] = os.path.dirname(os.path.abspath(__file__))
ROOT: Final[str] = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
JP_CITY_DIR: Final[str] = os.path.join(ROOT, 'scripts', 'content', 'jp-city')
for _p in (HERE, os.path.join(JP_CITY_DIR, 'houses'), os.path.join(JP_CITY_DIR, 'blocks'), JP_CITY_DIR):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from house_kit import Cv, K, OL, gable_side, lattice_door, shed, wall  # noqa: E402,F401
from jp_regions_pack import add_outline, canopy_clusters, plinth_34, rect_3d, stones  # noqa: E402,F401
from ref_house import eave_shadow, foundation, genkan, hip_roof, lean_to, sash  # noqa: E402,F401
from shitamachi_pack import H, disc, line  # noqa: E402,F401
from inaka_style import ground_shadow, lum, palette, tint_outlines  # noqa: E402

with open(os.path.join(ROOT, 'tiledata', 'jp-city', 'palette-contract.json'), encoding='utf-8') as _f:
    _CONTRACT = json.load(_f)
_RAMP: Final[dict[str, list[int]]] = {
    m['id']: [int(h[1:], 16) for h in m['steps']]
    for f in _CONTRACT['families']
    for m in f['materials']
}


def J(mat, s):
    """계약 재료 mat 의 단 s(0 그늘 … 4 하이라이트)."""
    r = _RAMP[mat]
    return r[max(0, min(4, s))]


def T(mat, t):
    """재료 mat 의 가운데 단 기준 상대 단 t(0 = 가운데). 계약 재료(J)와 modern3 램프(K)를 같은 방식으로 부른다."""
    if mat in _RAMP:
        return J(mat, 2 + int(t))
    return K(mat, int(t))


# ═══════════════════════════ 키트 등록 ═══════════════════════════
KITS: list[dict] = []


def kit(id_, name, w, h, kind, solid=(), other='star', tags=(), rules='', role='prop', doors=None):
    def deco(fn):
        KITS.append(dict(id=id_, name=name, w=w, h=h, kind=kind, draw=fn, solid=set(solid), other=other,
                         tags=list(tags), rules=rules, role=role, doors=list(doors or [])))
        return fn
    return deco


def rows(w, ys):
    return [(x, y) for y in ys for x in range(w)]


# ═══════════════════════════ 색 다루기 ═══════════════════════════
def lerp(a, b, f):
    return a + (b - a) * f


def _rgb(c):
    return (c >> 16) & 255, (c >> 8) & 255, c & 255


@lru_cache(maxsize=16384)
def _dim(col, k=0.8, cool=6):
    """col 을 k 배 어둡게(그늘은 조금 차갑게 = 파랑 +cool) 한 목표에 가장 가까운 허용 색. 원색보다 확실히 어두운 것만."""
    cols, _ = palette()
    r, g, b = _rgb(col)
    tr, tg, tb = r * k, g * k, min(255, b * k + cool)
    L = lum(col)
    best, bd = col, 1e18
    for p in cols:
        if lum(p) >= L - 4:
            continue
        pr, pg, pb = _rgb(p)
        d = 2 * (pr - tr) ** 2 + 4 * (pg - tg) ** 2 + 3 * (pb - tb) ** 2
        if max(r, g, b) - min(r, g, b) > 20 and (r >= g) != (pr >= pg):
            d *= 2.5                                                     # 색조(붉은/푸른 쪽) 유지
        if (g >= b) != (pg >= pb) and abs(g - b) > 12:
            d *= 1.6
        if d < bd:
            bd, best = d, p
    return best


def _key(c, x, y):
    a = c.a[y, x]
    return (int(a[0]) << 16) | (int(a[1]) << 8) | int(a[2])


def _shade(c, x, y, w, h, k=0.75, cool=6, dither=False):
    """이미 그린 화소를 어둡게(처마 그늘·접지 그늘). dither 면 체커 반만."""
    for yy in range(max(0, y), min(c.h, y + h)):
        for xx in range(max(0, x), min(c.w, x + w)):
            if c.a[yy, xx, 3] == 0 or (dither and (xx + yy) % 2):
                continue
            c.P(xx, yy, _dim(_key(c, xx, yy), k, cool))


def _eave_shade(c, x, y, w, depth=4):
    """처마 밑 그늘: 위 줄일수록 깊고 아래로 디더로 풀린다."""
    ks = (0.52, 0.64, 0.76, 0.86, 0.92)
    for j in range(depth):
        k = ks[min(j, len(ks) - 1)]
        _shade(c, x, y + j, w, 1, k, 8, dither=(j == depth - 1))


@lru_cache(maxsize=4096)
def _edge_tone(col):
    """실루엣 윤곽 색: 이웃 재질과 같은 색조 방향의, 밝기 약 절반인 허용 색(무채 근흑 제외, 색조 치우침 > 14)."""
    cols, _ = palette()
    r, g, b = _rgb(col)
    L = lum(col)
    m = (r + g + b) / 3
    d0 = (r - m, g - m, b - m)
    n0 = math.sqrt(sum(v * v for v in d0)) or 1.0
    best, bs = col, 1e18
    for p in cols:
        pr, pg, pb = _rgb(p)
        if max(pr, pg, pb) - min(pr, pg, pb) <= 14 or lum(p) > L * 0.72 or lum(p) < 30:
            continue
        pm = (pr + pg + pb) / 3
        d1 = (pr - pm, pg - pm, pb - pm)
        n1 = math.sqrt(sum(v * v for v in d1)) or 1.0
        hue = sum((a / n0 - b_ / n1) ** 2 for a, b_ in zip(d0, d1))
        sc = ((lum(p) - L * 0.5) / 10) ** 2 + hue * 6
        if sc < bs:
            bs, best = sc, p
    return best


def _retint_edges(c):
    """tint_outlines 뒤에도 남은 근흑 실루엣 화소(색조가 엇나간 초록·보라 검정 등)를 이웃 재질 색조를 지킨 어두운 톤으로."""
    from inaka_style import is_inkish
    a = c.a
    h, w = a.shape[:2]
    ch = []
    for y in range(h):
        for x in range(w):
            if a[y, x, 3] == 0 or not is_inkish(_key(c, x, y)):
                continue
            edge = any(not (0 <= y + dy < h and 0 <= x + dx < w) or a[y + dy, x + dx, 3] == 0
                       for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            if not edge:
                continue
            votes = {}
            for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)):
                yy, xx = y + dy, x + dx
                if 0 <= yy < h and 0 <= xx < w and a[yy, xx, 3] and not is_inkish(_key(c, xx, yy)):
                    k = _key(c, xx, yy)
                    votes[k] = votes.get(k, 0) + 1
            if votes:
                nb = max(votes, key=lambda k: (votes[k], -lum(k)))
                ch.append((x, y, _edge_tone(nb)))
    for x, y, col in ch:
        c.P(x, y, col)


def _below(c, d):
    """c 의 위 d 줄을 뺀 아래쪽 보기(같은 화소 버퍼). R6 세로 깊이: 몸채는 옛 좌표 그대로 아래로 내려 그리고, 지붕만 전체 캔버스에 높게 그린다."""
    v = Cv.__new__(Cv)
    v.w, v.h, v.a = c.w, c.h - d, c.a[d:]
    return v


def _finish(c, shadow=None, keep_bottom=0):
    """마지막 손질: 근흑 윤곽을 재질 색 어두운 톤으로 바꾸고 발치 체커 그늘을 깐다. shadow=(x0, x1, y0, rows)."""
    tint_outlines(c, keep_bottom)
    _retint_edges(c)
    if shadow:
        x0, x1, y0, n = shadow
        ground_shadow(c, x0, x1, y0, n, K('yoru', -1))


# 섞은 램프(어두움 → 밝음). 초가: 새 짚(노르스름) / 묵은 짚(회갈) / 이끼.
STRAW: Final[list[int]] = [J('moss', 1), J('tatami_straw', 0), J('tatami_straw', 1), J('tatami_straw', 2),
                           J('tatami_straw', 3), J('tatami_straw', 4), K('kinari', 1)]
STRAW_OLD: Final[list[int]] = [J('moss', 0), J('moss', 1), J('aged_cedar', 2), J('aged_cedar', 3),
                               J('aged_cedar', 4), K('kinari', 0), J('tatami_straw', 4)]
MOSS: Final[list[int]] = [J('moss', 0), J('moss', 0), J('moss', 1), J('moss', 2), J('moss', 3), J('moss', 4), J('moss', 4)]


def _ri(ramp, t):
    return ramp[max(0, min(len(ramp) - 1, int(t)))]


# ═══════════════════════════ 공통 시골 부품 ═══════════════════════════
def post(c, x, y, h, mat='machiya_timber', t=2, w=2):
    """나무 기둥: 왼쪽 1px 빛, 오른쪽 1px 그늘, 세로 결(해시 옹이), 아래 2px 물때."""
    for yy in range(y, y + h):
        for i in range(w):
            tt = t + (1 if i == 0 else -1 if i == w - 1 else 0)
            if 0 < i < w - 1 or w == 2:
                hv = H(x + i, yy // 3, 17)
                if hv < 0.16:
                    tt -= 1
                elif hv > 0.93 and i == 0:
                    tt += 1
            if yy >= y + h - 2:
                tt -= 1
            c.P(x + i, yy, J(mat, tt))


def _hbeam(c, x, y, w, mat='machiya_timber', t=2, h=2):
    """가로 보(長押·貫): 윗줄 빛, 아랫줄 그늘, 결."""
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            tt = t + (1 if yy == y else -1 if yy == y + h - 1 else 0)
            if H(xx // 4, yy, 18) < 0.15:
                tt -= 1
            c.P(xx, yy, J(mat, tt))


def shoji(c, x, y, w, h, panes=2):
    """장지문(障子): 나무 틀 + 흰 종이(위 처마 그늘) + 밝은 나무 격자(격자 오른쪽 아래로 그늘) + 판자 허리판."""
    c.R(x, y, w, h, J('machiya_timber', 2))
    for yy in range(y + 1, y + h - 5):
        for xx in range(x + 1, x + w - 1):
            gx, gy = (xx - x) % 4 == 0, (yy - y) % 5 == 0
            if gx or gy:
                col = J('aged_cedar', 4) if not (gx and gy) else J('aged_cedar', 3)
            else:
                t = 4
                if (xx - x) % 4 == 1 or (yy - y) % 5 == 1:
                    t = 3                                            # 살 그늘
                if yy < y + 3:
                    t -= 1                                           # 처마 그늘
                if H(xx, yy, 19) < 0.04:
                    t -= 1                                           # 종이 얼룩
                col = J('cream_stucco', t)
            c.P(xx, yy, col)
    # 허리판(腰板): 세로 판 결
    for yy in range(y + h - 5, y + h - 1):
        for xx in range(x + 1, x + w - 1):
            t = 2 + (1 if (xx - x) % 5 == 1 else -1 if (xx - x) % 5 == 0 else 0)
            if yy == y + h - 5:
                t = 3
            elif yy == y + h - 2:
                t -= 1
            c.P(xx, yy, J('aged_cedar', t))
    for k in range(1, panes):
        px = x + w * k // panes
        c.VL(px, y, h, J('machiya_timber', 1)); c.VL(px + 1, y + 1, h - 2, J('machiya_timber', 3))
    c.HL(x, y, w, J('machiya_timber', 1))
    c.VL(x - 1, y, h, OL); c.VL(x + w, y, h, OL)


def noren(c, x, y, w, h, mat='noren_indigo', crest=True):
    """포렴: 세 폭 천(주름마다 빛·그늘), 폭 사이 틈, 위 봉, 가운데 흰 문장(점), 아래 끝 살짝 흔들림."""
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            i = (xx - x) % 4
            t = 2 + (1 if i == 0 else -1 if i == 3 else 0)
            if yy == y:
                t = 3
            if yy > y + h - 3:
                t -= 1
            if yy == y + h - 1 and H(xx, 0, 20) < 0.3:
                continue
            c.P(xx, yy, J(mat, t))
    c.HL(x - 1, y - 1, w + 2, J('machiya_timber', 3))              # 봉
    for k in range(1, 3):
        sx = x + w * k // 3
        c.VL(sx, y + 3, h - 3, J(mat, 0))
    c.VL(x + w - 1, y, h, J(mat, 1))
    if crest:
        cx, cy = x + w // 2, y + h // 2
        c.R(cx - 1, cy - 1, 3, 3, J('vending_cool_white', 4)); c.P(cx + 1, cy + 1, J('vending_cool_white', 2)); c.P(cx, cy, J(mat, 2))


def engawa(c, x, y, w, depth=5, front=3):
    """툇마루(縁側): 윗면 판재(가로 판, 판마다 톤·이음·결) + 앞 테(인방) + 짧은 다리 + 밑 그늘."""
    for k in range(depth):
        yy = y + k
        for xx in range(x, x + w):
            seg = (xx + k * 7) // 13
            t = 3 + (1 if H(seg, k, 21) > 0.75 else -1 if H(seg, k, 21) < 0.2 else 0)
            if k == 0:
                t = 1                                                # 벽 밑 그늘
            elif k == depth - 1:
                t = 4                                                # 앞 끝 밝은 모서리
            elif (xx + k * 7) % 13 == 0:
                t -= 2                                               # 판 이음
            elif H(xx // 3, yy, 22) < 0.12:
                t -= 1
            c.P(xx, yy, J('aged_cedar', t))
    for j in range(front):
        for xx in range(x, x + w):
            t = 3 - j
            if H(xx // 5, j, 23) < 0.15:
                t -= 1
            c.P(xx, y + depth + j, J('machiya_timber', t))
    for px in range(x + 2, x + w - 2, 14):
        c.P(px, y + depth + front, J('machiya_timber', 2)); c.P(px + 1, y + depth + front, J('machiya_timber', 0))
        c.P(px, y + depth + front + 1, J('machiya_timber', 1)); c.P(px + 1, y + depth + front + 1, J('machiya_timber', 0))
    c.VL(x - 1, y, depth + front, OL); c.VL(x + w, y, depth + front, OL)


def step_stone(c, x, y, w=10):
    """沓脱石: 윗면 3px(왼쪽 위 빛, 반점) + 앞면 2px(그늘) + 이끼 한 점."""
    c.R(x - 1, y - 1, w + 2, 7, OL)
    for j in range(3):
        for i in range(w):
            t = 3 if j else 4
            if i == 0:
                t += 1
            elif i == w - 1:
                t -= 1
            if H(x + i, y + j, 24) < 0.18:
                t -= 1
            c.P(x + i, y + j, J('shrine_flagstone', t))
    for j in range(3, 5):
        for i in range(w):
            t = 2 if j == 3 else 1
            if i == w - 1:
                t -= 1
            c.P(x + i, y + j, J('shrine_flagstone', t))
    c.P(x + w - 2, y + 3, J('moss', 2)); c.P(x + 1, y + 4, J('moss', 1))


def stone_base(c, x, y, w, h=5, mat='shrine_flagstone'):
    """건물 밑 돌 기단: 윗면 2px(판석마다 톤, 이음) + 앞면 돌 하나씩 명암."""
    for j in range(2):
        for xx in range(x, x + w):
            seg = xx // 9
            t = (4 if j == 0 else 3) - (1 if H(seg, 0, 25) < 0.3 else 0)
            if (xx % 9) == 0:
                t = 2
            c.P(xx, y + j, J(mat, t))
    if h > 2:
        stones(c, x, y + 2, w, h - 2, mat, seed=x + y, course=(h - 2, h - 2), width=(6, 10), moss=0.2)
    c.VL(x - 1, y, h, OL); c.VL(x + w, y, h, OL); c.HL(x - 1, y + h, w + 2, OL)


def _plaster_px(x, y, h_frac, seed):
    """회벽 화소 상대 단: 큰 얼룩(5x3 구역) + 작은 반점 + 아래 때(디더)."""
    t = 0
    big = H(x // 5, y // 3, seed)
    sm = H(x, y, seed + 1)
    if big < 0.2 and sm < 0.55:
        t -= 1
    elif sm > 0.9:
        t += 1
    elif sm < 0.06:
        t -= 1
    if h_frac > 0.62:
        g = (h_frac - 0.62) / 0.38
        if H(x, y, seed + 2) < g * 0.75:
            t -= 1
        if g > 0.75 and (x + y) % 2 == 0:
            t -= 1
    return t


def plaster(c, x, y, w, h, mat='shiro', base=1):
    """회벽(漆喰)·흙벽: 얼룩·반점·아래 때. 왼쪽 1px 빛, 오른쪽 1px 그늘."""
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            c.P(xx, yy, K(mat, base + _plaster_px(xx, yy, (yy - y + 0.5) / max(1, h), 26)))
    c.VL(x, y, h, K(mat, base + 1)); c.VL(x + w - 1, y, h, K(mat, base - 1))


def _boards_h(c, x, y, w, h, mat='ita', base=0, bh=4, battens=12, seed=0):
    """下見板張り: 가로로 겹친 판(윗줄 빛, 아랫줄 그늘) · 판마다 톤 · 이음 · 결 + 押縁(세로 누름대)."""
    for yy in range(y, y + h):
        j, b = (yy - y) % bh, (yy - y) // bh
        off = int(H(b, 0, seed) * 30)
        for xx in range(x, x + w):
            seg = (xx + off) // 23
            tv = H(seg, b, seed + 1)
            t = base + (1 if tv > 0.72 else -1 if tv < 0.22 else 0)
            if j == 0:
                t += 1
            elif j == bh - 1:
                t -= 2
            elif (xx + off) % 23 == 0:
                t -= 2
            elif H(xx // 4, yy, seed + 2) < 0.14:
                t -= 1
            c.P(xx, yy, K(mat, t))
    if battens:
        for bx in range(x + battens // 2, x + w - 2, battens):
            for yy in range(y, y + h):
                c.P(bx, yy, K(mat, base + 1)); c.P(bx + 1, yy, K(mat, base - 2))
    c.VL(x, y, h, K(mat, base + 1)); c.VL(x + w - 1, y, h, K(mat, base - 2))


def _boards_v(c, x, y, w, h, mat='aged_cedar', base=0, bw=4, seed=0):
    """縦板: 판마다 톤, 판 왼쪽 빛·오른쪽 이음 그늘, 세로 결, 아래 물때."""
    for xx in range(x, x + w):
        i, b = (xx - x) % bw, (xx - x) // bw
        tb = base + (1 if H(b, 0, seed) > 0.7 else -1 if H(b, 0, seed) < 0.25 else 0)
        for yy in range(y, y + h):
            t = tb + (1 if i == 0 else -2 if i == bw - 1 else 0)
            if 0 < i < bw - 1 and H(xx, yy // 3, seed + 1) < 0.15:
                t -= 1
            if yy >= y + h - 2:
                t -= 1
            c.P(xx, yy, T(mat, t))


def _lattice_win(c, x, y, w, h):
    """連子窓: 짙은 안 + 밝은 나무 살(왼쪽 빛) + 창턱."""
    c.R(x, y, w, h, J('machiya_timber', 0))
    c.HL(x, y, w, J('machiya_timber', 1))
    for gx in range(x + 1, x + w - 1, 2):
        for yy in range(y, y + h):
            c.P(gx, yy, J('aged_cedar', 3 if yy > y + 1 else 2))
        c.P(gx, y + h - 1, J('aged_cedar', 2))
    c.HL(x - 1, y + h, w + 2, J('aged_cedar', 4)); c.HL(x - 1, y + h + 1, w + 2, J('machiya_timber', 1))
    c.VL(x - 1, y, h, OL); c.VL(x + w, y, h, J('machiya_timber', 1))


# ─────────────── 초가 ───────────────
STRAW_R: Final[list[int]] = [J('moss', 1), J('tatami_straw', 0), J('aged_cedar', 2), J('tatami_straw', 1),
                             J('tatami_straw', 2), J('tatami_straw', 3), J('tatami_straw', 4)]


def _thatch_px(x, y, ytop, n, face, moss_bias=0.0, seed=0):
    """초가 화소: 위→아래로 흐르는 1px 짚 획. 8px 이엉 단마다 획 끝이 엇갈리고(끝 빛), 아랫단에 덮이는 끝 줄은
    단차 그늘. 획마다 톤, 획 사이 틈(지붕 전체로 이어지는 가는 어두운 결). 반점 덩이 없음. 이끼는 용마루 밑·처마 끝 띠만."""
    yy = y - ytop
    C = 8
    off = int(H(x, yy // C, seed + 1) * 3)                               # 획 끝 엇갈림 0..2
    crs, j = (yy + off) // C, (yy + off) % C
    f = yy / max(1, n)
    t = 4 + face + (1 if f < 0.2 else 0) - (1 if f > 0.85 else 0)
    st = H(x, crs, seed + 3)
    t += -1 if st < 0.28 else (1 if st > 0.82 else 0)                    # 획마다 톤
    if H(x, 0, seed + 8) < 0.3 and H(x, crs, seed + 9) < 0.75:
        t -= 1                                                           # 획 사이 틈(세로로 길게 이어짐)
    if j == 0:
        t += 1                                                           # 획 끝 빛
    elif j == C - 1:
        t -= 2                                                           # 윗단에 덮인 단차 그늘
    col = _ri(STRAW_R, t)
    band = yy < 2 or n - yy <= 2
    if band and H(x, y, seed + 6) < 0.45 + moss_bias:
        col = _ri(MOSS, t - 1)
    return col


def thatch_roof(c, x0, x1, ytop, yeave, run, ridge=True):
    """茅葺き 寄棟: 사다리꼴 경사 윗면에 짚 다발 결(다발 끝 빛·밑 그늘·세로 획), 묵은 짚 얼룩, 북·오른쪽 그늘 이끼.
    처마는 6px 두께 단면(짚 끝 층), 위에 箱棟(대나무 누름대·烏おどり)."""
    rl, rr = x0 + run, x1 - run
    n = yeave - ytop
    for y in range(ytop, yeave):
        f = (y - ytop) / n
        xl = round(lerp(rl, x0, f)); xr = round(lerp(rr, x1, f))
        bl = round(lerp(rl, x0 + run // 2, f)); br = round(lerp(rr, x1 - run // 2, f))
        for x in range(xl, xr + 1):
            if x < bl:
                face, mb = 2, -0.2
            elif x > br:
                face, mb = -2, 0.15
            else:
                face, mb = 0, 0.0
            col = _thatch_px(x, y, ytop, n, face, mb)
            if x == bl or x == bl - 1:
                col = _thatch_px(x, y, ytop, n, face + 1, -1)            # 왼쪽 隅 둥근 등
            if x == br + 1:
                col = _thatch_px(x, y, ytop, n, -3, 0.0)
            c.P(x, y, col)
        c.P(xl - 1, y, OL); c.P(xr + 1, y, OL)
    # 처마 두께(짚 끝 단면 6px): 맨 위 립 빛, 짚 끝 점무늬 층, 밑면 그늘, 서까래 끝
    ex0, ex1 = x0 - 2, x1 + 2
    wspan = ex1 - ex0
    for x in range(ex0, ex1 + 1):
        sh = -1 if x > ex1 - wspan // 6 else (1 if x < ex0 + wspan // 8 else 0)
        c.P(x, yeave, _ri(STRAW, 5 + sh))
        for r in range(1, 4):
            v = 4 - r // 2 + sh - (1 if H(x, 9, 27) < 0.35 else 0)        # 짚 끝 단면: 세로로 이어지는 결
            if H(x, r, 27) < 0.1:
                v -= 1
            c.P(x, yeave + r, _ri(STRAW if r < 3 else STRAW_OLD, v))
        c.P(x, yeave + 4, _ri(STRAW_OLD, 2 + sh - (x % 2)))
        c.P(x, yeave + 5, J('machiya_timber', 2 if x % 5 == 0 else 1))
    c.VL(ex0 - 1, yeave, 6, OL); c.VL(ex1 + 1, yeave, 6, OL)
    if ridge:
        _thatch_ridge(c, rl - 4, rr + 4, ytop, small=n < 20)


def _thatch_ridge(c, bx0, bx1, ytop, small=False):
    """箱棟: 윗면(판, 빛) + 앞면(짙은 판·결) + 대나무 누름대 + 烏おどり + 지붕에 떨어진 그늘. small 이면 낮은 棟."""
    w = bx1 - bx0 + 1
    th, fh = (1, 3) if small else (2, 4)
    top = ytop - 1 - fh - th
    c.R(bx0 - 1, top - 1, w + 2, th + fh + 2, OL)
    for xx in range(bx0, bx1 + 1):
        lit = 1 if xx < bx0 + w // 3 else (-1 if xx > bx1 - w // 4 else 0)
        c.P(xx, top, K('ita', 3 if lit >= 0 else 2))
        if th == 2:
            c.P(xx, top + 1, K('ita', 1 + lit if (xx - bx0) % 9 else 0))
        for j in range(fh):
            t = 0 - (1 if j == fh - 1 else 0) + (1 if j == 0 else 0) + (lit if j < 2 else 0)
            if H(xx // 3, j, 28) < 0.2:
                t -= 1
            c.P(xx, top + th + j, K('ita', t))
        c.P(xx, ytop - 1, _ri(STRAW_OLD, 1 if xx % 2 else 0))
    fy = top + th
    for sx in range(bx0 + 3, bx1 - 1, 5):
        c.P(sx, fy, J('pine_bamboo', 4)); c.P(sx, fy + 1, J('pine_bamboo', 3)); c.P(sx, fy + 2, J('pine_bamboo', 2))
        c.P(sx + 1, fy + 1, J('pine_bamboo', 1))
    if small:
        return
    for sx in range(bx0 + 5, bx1 - 3, 10):                               # 烏おどり(교차 막대)
        c.P(sx, top - 2, J('aged_cedar', 4)); c.P(sx + 2, top - 2, J('aged_cedar', 2)); c.P(sx + 1, top - 1, J('aged_cedar', 3))
        c.P(sx - 1, top - 3, OL); c.P(sx + 3, top - 3, OL); c.P(sx, top - 3, J('aged_cedar', 3)); c.P(sx + 2, top - 3, J('aged_cedar', 1))


# ─────────────── 기와 ───────────────
def _tile_t(x, y, ytop, seed=0, tw=4, rh=4):
    """기와 한 장 단위 상대 단: 줄(4px) · 세로 골 이어짐(丸瓦 등 4px) · 장마다 톤 · 둥근 등 빛 · 골 그늘 · 반짝임."""
    yy = y - ytop
    crs, j = yy // rh, yy % rh
    xo = x
    i, tile = xo % tw, xo // tw
    v = H(tile, crs, seed)
    t = 1 if v > 0.84 else -1 if v < 0.16 else 0
    if j == rh - 1:
        t -= 1
    elif j == 0:
        t += 1 if i < 2 else 0
    if i == 0:
        t += 1
    elif i == tw - 1:
        t -= 2
    if j == 0 and i == 0 and H(tile, crs, seed + 1) > 0.55:
        t += 1
    return t


def _kt(mat, t, glint=None):
    """기와 램프 단. 맨 위를 넘으면 glint 색(빛 반짝임)."""
    top = 3 if mat not in _RAMP else 2
    if glint is not None and t > top:
        return glint
    return T(mat, t)


def _tile_eave(c, x0, x1, y, mat, base, glint=None):
    """軒先: 막새 줄(4px 마다 둥근 끝: 빛·몸·몸·그늘) 3px + 윤곽. 오른쪽 끝 1/6 은 한 단 그늘."""
    span = x1 - x0
    for x in range(x0, x1 + 1):
        sh = -1 if x > x1 - span // 6 else 0
        i = x % 4
        c.P(x, y, _kt(mat, base + 2 + sh, glint))
        c.P(x, y + 1, _kt(mat, base + (2 if i == 0 else 1 if i == 1 else 0 if i == 2 else -2) + sh, glint))
        c.P(x, y + 2, _kt(mat, base - (3 if i == 3 else 2) + sh))
    c.HL(x0, y + 3, x1 - x0 + 1, OL)
    c.VL(x0 - 1, y, 3, OL); c.VL(x1 + 1, y, 3, OL)


def _tile_ridge(c, x0, x1, y, mat, base, oni=True, glint=None):
    """大棟(のし瓦 단 + 冠瓦): y-4..y-1 4줄 + 위 윤곽, 양 끝 鬼瓦(높은 덩이, 왼쪽 빛)."""
    w = x1 - x0 + 1
    c.HL(x0 - 1, y - 5, w + 2, OL)
    for x in range(x0, x1 + 1):
        lit = 0 if x < x1 - w // 4 else -1
        c.P(x, y - 4, _kt(mat, base + 3 + lit, glint if (x % 6 == 1 and lit == 0) else None))
        c.P(x, y - 3, _kt(mat, base + 1 + lit))
        c.P(x, y - 2, _kt(mat, base - 1 + lit + (1 if x % 6 == 0 else 0)))
        c.P(x, y - 1, _kt(mat, base - 3))
    c.VL(x0 - 1, y - 4, 4, OL); c.VL(x1 + 1, y - 4, 4, OL)
    if oni:
        for ox, lit in ((x0 - 1, 1), (x1 - 3, -1)):
            c.R(ox - 1, y - 7, 6, 7, OL)
            for j in range(6):
                for i in range(4):
                    t = base + (2 if i == 0 else -2 if i == 3 else 0) + (1 if j < 2 else 0) + (lit if i else 0)
                    if j >= 4:
                        t -= 1
                    c.P(ox + i, y - 6 + j, _kt(mat, t))
            c.P(ox, y - 6, _kt(mat, base + 3, glint)); c.P(ox + 2, y - 4, _kt(mat, base - 3))


def _kawara_hip(c, x0, x1, ytop, yeave, run, mat='tairu', base=0, glint=None, seed=0):
    """寄棟 기와 지붕(ref_house.hip_roof 의 깊은 사본): 장마다 하이라이트·골 그늘, 왼쪽 隅 삼각면 빛, 오른쪽 그늘,
    위 1/3 은 하늘빛 한 단 밝게, 隅棟 마루, 大棟 + 鬼瓦, 막새 처마."""
    rl, rr = x0 + run, x1 - run
    for y in range(ytop, yeave):
        f = (y - ytop) / (yeave - ytop)
        xl = round(lerp(rl, x0, f)); xr = round(lerp(rr, x1, f))
        bl = round(lerp(rl, x0 + run // 2, f)); br = round(lerp(rr, x1 - run // 2, f))
        for x in range(xl, xr + 1):
            if x < bl:
                face = 2
            elif x > br:
                face = -1
            else:
                face = 1 if f < 0.34 else 0
            c.P(x, y, _kt(mat, base + face + _tile_t(x, y, ytop, seed), glint))
        c.P(bl, y, _kt(mat, base + 3, glint)); c.P(bl + 1, y, _kt(mat, base - 1))
        c.P(br, y, _kt(mat, base + 2)); c.P(br + 1, y, _kt(mat, base - 2))
        c.P(xl, y, _kt(mat, base)); c.P(xr, y, _kt(mat, base - 3))
        c.P(xl - 1, y, OL); c.P(xr + 1, y, OL)
    _tile_ridge(c, rl, rr, ytop, mat, base, True, glint)
    _tile_eave(c, x0 - 1, x1 + 1, yeave, mat, base, glint)


def _kawara_lean(c, x0, x1, ytop, yeave, mat='tairu', base=0, glint=None, seed=5):
    """下屋(1층 앞 경사): 벽과 만나는 물끊기 판금 + 장마다 명암 + 막새 처마."""
    for y in range(ytop, yeave):
        for x in range(x0, x1 + 1):
            up = 1 if y - ytop < 2 else 0
            sh = -1 if x > x1 - (x1 - x0) // 6 else 0
            c.P(x, y, _kt(mat, base + up + sh + _tile_t(x, y, ytop, seed), glint))
    for x in range(x0, x1 + 1):
        c.P(x, ytop, K('tekko', 2 if x % 7 else 1))
    c.VL(x0 - 1, ytop, yeave - ytop, OL); c.VL(x1 + 1, ytop, yeave - ytop, OL)
    _tile_eave(c, x0, x1, yeave, mat, base, glint)


def kawara_gable(c, x0, x1, ytop, yeave, mat='tekko', base=0):
    """切妻 기와 경사 윗면(平入り): 장마다 명암, 위 밝고 아래 한 단, 양 끝 破風(흰 회반죽 판), 大棟, 막새 처마."""
    glint = K('conc', 2)
    for y in range(ytop, yeave):
        f = (y - ytop) / (yeave - ytop)
        for x in range(x0, x1 + 1):
            up = 1 if f < 0.4 else 0
            sh = -1 if x > x1 - (x1 - x0) // 7 else 0
            c.P(x, y, _kt(mat, base + up + sh + _tile_t(x, y, ytop, x0 * 3), glint))
        c.P(x0, y, K('shiro', 1)); c.P(x0 + 1, y, _kt(mat, base + 2)); c.P(x1, y, K('shiro', -1)); c.P(x1 - 1, y, _kt(mat, base - 2))
        c.P(x0 - 1, y, OL); c.P(x1 + 1, y, OL)
    _tile_ridge(c, x0, x1, ytop, mat, base, True, glint)
    _tile_eave(c, x0 - 1, x1 + 1, yeave, mat, base, glint)


def _tin_px(x, y, ytop, base, seed=0, period=4):
    """함석 골판 화소(세로 골): 등 빛 · 몸 · 골 그늘 + 판마다 톤 + 녹 덩이."""
    i = x % period
    t = base + (1 if i == 0 else 0 if i == 1 else -1 if i == 2 else -2)
    panel = x // 12
    t += 1 if H(panel, 0, seed) > 0.8 else 0
    r = H(x, (y - ytop) // 4, seed + 1) * 0.45 + H(x // 6, (y - ytop) // 5, seed + 2) * 0.55   # 골 따라 길쭉한 녹
    if r > 0.74:
        rt = 3 if i == 0 else 2 if i == 1 else 1
        if r > 0.86:
            rt -= 1
        return J('noren_rust', rt)
    return K('tekko', t)


# ═══════════════════════════ 1. 초가 고민가 ═══════════════════════════
@kit('inaka-kominka-thatched', '초가 고민가(茅葺き古民家) - 이엉 寄棟 지붕·箱棟·흙벽·장지문·툇마루(6×7)', 6, 7, 'building',
     solid=rows(6, [4, 5, 6]), tags=['inaka', '고민가', '초가집', '茅葺き', '古民家'],
     rules='시골 마을 중심 집. 앞(남)에 흙마당 2칸 이상, 뒤에 대숲·삼나무. 현관은 왼쪽 두 번째 칸.', role='building',
     doors=[(1, 6, 1)])
def kominka(c, base):
    D = 32
    c0, c = c, _below(c, D)
    X0, X1 = 6, 89
    WT, WB = 50, 71
    W = X1 - X0 + 1
    plaster(c, X0, WT, W, 8, 'kinari', 1)                                  # 위 흙벽 띠
    _boards_v(c, X0, WT + 10, W, WB - WT - 10, 'aged_cedar', -1, 4, seed=3)
    _hbeam(c, X0, WT + 8, W, 'machiya_timber', 2)                           # 長押
    for px in (X0, 24, 40, 72, X1 - 1):
        post(c, px, WT, WB - WT, 'machiya_timber', 2, 3 if px not in (X0, X1 - 1) else 2)
    # 현관(土間 입구): 물러선 어두운 안 + 흙바닥 + 남색 포렴
    for yy in range(WT + 3, WB):
        for xx in range(12, 24):
            t = 0 if yy < WT + 6 or xx < 14 else 1
            if yy >= WB - 4:
                t = 1 + (1 if H(xx, yy, 30) > 0.7 else 0)
            c.P(xx, yy, J('machiya_timber' if yy < WB - 4 else 'aged_cedar', t))
    noren(c, 12, WT + 3, 12, 9)
    c.VL(11, WT + 3, WB - WT - 3, OL)
    # 장지문(툇마루 안쪽)
    shoji(c, 42, WT + 9, 29, WB - WT - 9, panes=3)
    # 오른쪽 連子窓
    _lattice_win(c, 75, WT + 11, 12, 7)
    # 처마 그늘(깊은 초가 처마)
    _eave_shade(c, X0, WT, W, 5)
    c.VL(X0 - 1, WT, WB - WT, OL); c.VL(X1 + 1, WT, WB - WT, OL)
    thatch_roof(c0, 2, 93, 30, 44 + D, 20)                                 # 가로 용마루(폭 ≈70%) · 짧은 隅면
    stone_base(c, X0, WB, W, 5)
    engawa(c, 40, WB - 4, 50, depth=5, front=3)
    _shade(c, 40, WB + 4, 50, 1, 0.7)                                       # 툇마루 밑 그늘
    step_stone(c, 55, WB + 5, 10)
    step_stone(c, 14, WB + 5, 8)
    # 처마 끝 물받이 자국 대신 낙숫물 돌 줄(雨落ち)
    _finish(c0, (X0 + 2, X1 + 5, WB + 6 + D, 4))


# ═══════════════════════════ 2. 기와 농가 ═══════════════════════════
@kit('inaka-kawara-farmhouse', '기와 농가 - 寄棟 기와 지붕·下屋·회벽·격자문·툇마루(6×7)', 6, 7, 'building',
     solid=rows(6, [4, 5, 6]), tags=['inaka', '기와집', '농가', '瓦', '母屋'],
     rules='마을 큰 농가 본채. 앞에 마당·경트럭, 옆에 토장 창고와 헛간.', role='building', doors=[(1, 6, 1)])
def farmhouse(c, base):
    D = 32
    c0, c = c, _below(c, D)
    X0, X1 = 8, 87
    W = X1 - X0 + 1
    glint = K('conc', 2)
    # 2층 회벽 띠 + 기둥 + 고창
    plaster(c, X0, 38, W, 10, 'shiro', 1)
    for px in (X0, 28, 48, 68, X1 - 1):
        post(c, px, 38, 10, 'machiya_timber', 2)
    for wx in (32, 52):
        _lattice_win(c, wx, 41, 10, 4)
    _eave_shade(c, X0, 38, W, 4)
    c.VL(X0 - 1, 38, 10, OL); c.VL(X1 + 1, 38, 10, OL)
    # 1층 벽: 焼杉 下見板
    Y1, YF = 57, 73
    _boards_h(c, X0, Y1, W, YF - Y1, 'ita', -1, 4, 12, seed=7)
    for px in (X0, 36, 72, X1 - 1):
        post(c, px, Y1, YF - Y1, 'machiya_timber', 2)
    _koshido(c, 12, Y1 + 1, 20, YF - Y1 - 1)                              # 현관 격자 미닫이
    shoji(c, 40, Y1 + 1, 30, YF - Y1 - 1, panes=3)
    _lattice_win(c, 75, Y1 + 4, 10, 7)
    _eave_shade(c, X0, Y1, W, 4)
    # 지붕: 寄棟 본채 + 앞 下屋
    _kawara_hip(c0, 4, 91, 10, 34 + D, 26, 'tairu', 0, glint, seed=1)
    _kawara_lean(c, 4, 91, 48, 53, 'tairu', 0, glint)
    # 기초: 돌 기단
    stone_base(c, X0, YF, W, 4)
    engawa(c, 38, YF - 3, 34, depth=4, front=3)
    _shade(c, 38, YF + 4, 34, 1, 0.7)
    step_stone(c, 50, YF + 5, 10)
    step_stone(c, 17, YF + 5, 10)
    _finish(c0, (X0 + 2, X1 + 5, YF + 5 + D, 3))


def _koshido(c, x, y, w, h):
    """格子戸: 짙은 틀 + 밝은 세로 살(왼쪽 빛) 사이로 어두운 안 + 아래 판 + 가운데 맞닿는 틀."""
    c.R(x, y, w, h, J('machiya_timber', 1))
    for yy in range(y + 2, y + h - 5):
        for xx in range(x + 1, x + w - 1):
            k = (xx - x) % 3
            if k == 1:
                col = J('aged_cedar', 4 if yy < y + h - 8 else 3)
            elif k == 2:
                col = J('aged_cedar', 2)
            else:
                col = J('machiya_timber', 0 if yy < y + 6 else 1)
            c.P(xx, yy, col)
    for j in (y + 8, y + 15):
        c.HL(x + 1, j, w - 2, J('aged_cedar', 3))
    for yy in range(y + h - 5, y + h):
        for xx in range(x + 1, x + w - 1):
            c.P(xx, yy, J('aged_cedar', 2 + (1 if yy == y + h - 5 else 0) - (1 if (xx - x) % 5 == 0 else 0)))
    c.VL(x + w // 2, y, h, J('machiya_timber', 0)); c.R(x, y, w, 2, J('machiya_timber', 0))
    c.VL(x - 1, y, h, OL); c.HL(x - 1, y + h, w + 2, J('shrine_flagstone', 3))


# ═══════════════════════════ 3. 토장 창고 ═══════════════════════════
def namako(c, x, y, w, h):
    """海鼠壁: 짙은 평기와(장마다 톤, 왼쪽 위 빛) + 볼록한 흰 회반죽 줄눈(위 밝고 아래 그늘)."""
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            u, v = (xx + yy) % 8, (xx - yy) % 8
            if u == 0 or v == 0:
                col = K('shiro', 2 if (u == 0) else 1)
            elif u == 1 or v == 7:
                col = K('shiro', -1)
            else:
                tid = ((xx + yy) // 8, (xx - yy) // 8)
                t = -1 if H(*tid, 31) > 0.5 else -2
                if u == 2 or v == 1:
                    t += 1
                elif u == 7 or v == 6:
                    t -= 1
                col = K('tekko', t)
            c.P(xx, yy, col)
    c.HL(x, y, w, K('shiro', 0)); c.HL(x, y + h - 1, w, K('shiro', -2))


@kit('inaka-kura-storehouse', '토장 창고(土蔵) - 검은 기와 切妻·흰 회벽·海鼠壁·観音扉(4×5)', 4, 5, 'building',
     solid=rows(4, [3, 4]), tags=['inaka', '토장', '창고', '蔵', '海鼠壁'],
     rules='농가 본채 옆·뒤. 앞에 돌계단 칸을 비운다.', role='building', doors=[(1, 4, 2)])
def kura(c, base):
    D = 16
    c0, c = c, _below(c, D)
    X0, X1 = 6, 57
    W = X1 - X0 + 1
    plaster(c, X0, 25, W, 15, 'shiro', 1)
    for xx in range(X0, X1 + 1):                                          # 鉢巻(처마 밑 두꺼운 회반죽 띠, 검게 칠함)
        c.P(xx, 25, K('tekko', -1)); c.P(xx, 26, K('tekko', -2 if xx % 5 else -1)); c.P(xx, 27, K('tekko', -3))
    c.HL(X0, 28, W, K('shiro', -1)); c.HL(X0, 29, W, K('shiro', 0))
    namako(c, X0, 40, W, 11)
    c.VL(X0, 25, 26, K('shiro', 2)); c.VL(X1, 28, 12, K('shiro', -1))
    c.VL(X0 - 1, 25, 26, OL); c.VL(X1 + 1, 25, 26, OL)
    # 観音扉: 계단식 두꺼운 회반죽 문틀(3단, 왼쪽 위 빛) + 닫힌 두 짝(철판 줄·징)
    dx, dy, dw, dh = 22, 30, 20, 21
    for k, t in enumerate((-1, 0, 1)):
        c.R(dx + k, dy + k, dw - 2 * k, dh - k, K('shiro', t))
        c.VL(dx + k, dy + k, dh - k, K('shiro', t + 1)); c.HL(dx + k, dy + k, dw - 2 * k, K('shiro', t + 1))
    for yy in range(dy + 3, dy + dh):
        for xx in range(dx + 3, dx + dw - 3):
            t = -1 + (1 if (yy - dy) % 6 == 3 else 0) - (1 if (yy - dy) % 6 == 4 else 0)
            if xx == dx + 3:
                t += 1
            c.P(xx, yy, K('tekko', t))
    c.VL(dx + dw // 2, dy + 3, dh - 3, K('tekko', -3)); c.VL(dx + dw // 2 + 1, dy + 3, dh - 3, K('tekko', 0))
    for hy in (dy + 7, dy + 15):
        for hx in (dx + dw // 2 - 3, dx + dw // 2 + 2):
            c.P(hx, hy, K('kii', 2)); c.P(hx + 1, hy, K('kii', 0)); c.P(hx, hy + 1, K('kii', 0)); c.P(hx + 1, hy + 1, K('kii', -1))
    for sy in range(dy + 5, dy + dh, 4):
        c.P(dx + 5, sy, K('tekko', 2)); c.P(dx + dw - 6, sy, K('tekko', 1))
    c.VL(dx - 1, dy, dh, OL)
    _shade(c, dx + dw - 2, dy + 2, 2, dh - 2, 0.75)
    # 높은 창(철 덧문 + 회반죽 턱)
    c.R(45, 30, 9, 8, K('shiro', 2)); c.HL(45, 30, 9, K('shiro', 2)); c.VL(53, 30, 8, K('shiro', -1))
    c.R(46, 31, 7, 6, K('tekko', -2))
    for gx in (47, 49, 51):
        c.VL(gx, 31, 6, K('tekko', 2)); c.P(gx, 31, K('tekko', 3))
    c.HL(45, 37, 9, K('shiro', 2)); c.HL(45, 38, 9, K('shiro', -2)); c.VL(44, 30, 8, OL)
    for j, k in enumerate((0.5, 0.62, 0.76)):                              # 흰 회벽 바로 밑 짙은 처마 그늘 3px
        _shade(c, X0, 28 + j, W, 1, k, 8)
    _shade(c, X0, 31, W, 1, 0.86, 8, dither=True)
    kawara_gable(c0, 3, 60, 7, 21 + D, 'tekko', -1)
    # 기단 + 돌계단(윗면·챌면)
    plinth_34(c, 3, 51, 58, 7, top_h=2, mat='shrine_flagstone')
    stones(c, 4, 54, 56, 3, 'shrine_flagstone', seed=9, course=(3, 3), width=(6, 11), moss=0.25)
    _step_block(c, 20, 56, 24, 5)
    _step_block(c, 18, 59, 28, 5)
    _finish(c0, (6, 63, 58 + D, 6))


def _step_block(c, x, y, w, h):
    """돌계단 한 단: 윤곽 + 윗면 2px(돌마다 톤, 왼쪽 위 빛) + 챌면(그늘, 이음) + 끝 이끼."""
    c.R(x, y, w, h, OL)
    for xx in range(x + 1, x + w - 1):
        seg = (xx - x) // 8
        tv = 1 if H(seg, y, 32) > 0.7 else 0
        c.P(xx, y + 1, J('shrine_flagstone', 4 - (0 if tv else 0) if (xx - x) % 8 else 2))
        c.P(xx, y + 2, J('shrine_flagstone', 3 + tv - (1 if (xx - x) % 8 == 0 else 0)))
        for j in range(y + 3, y + h - 1):
            t = 1 if j < y + h - 2 else 0
            if (xx - x) % 8 == 0:
                t = 0
            c.P(xx, j, J('shrine_flagstone', t))
    c.P(x + 1, y + 2, J('moss', 3)); c.P(x + w - 2, y + 2, J('moss', 2)); c.P(x + w - 3, y + 3, J('moss', 1))


# ═══════════════════════════ 4. 막과자 가게 ═══════════════════════════
@kit('inaka-dagashiya', '막과자 가게(駄菓子屋) - 기와 切妻·줄무늬 차양·사탕 병 진열대·법랑 간판(5×6)', 5, 6, 'building',
     solid=rows(5, [3, 4, 5]), tags=['inaka', '다가시야', '막과자', '駄菓子屋', '가게'],
     rules='마을 길가·버스 정류장 옆. 가게 앞 1칸은 비워 둔다(아이들 자리).', role='building', doors=[(2, 5, 1)])
def dagashiya(c, base):
    D = 32
    c0, c = c, _below(c, D)
    X0, X1 = 5, 74
    W = X1 - X0 + 1
    _boards_h(c, X0, 21, W, 12, 'ita', 0, 4, 10, seed=11)
    _eave_shade(c, X0, 21, W, 3)
    # 법랑 간판: 노란 판 + 붉은 띠 + 하늘 점 무늬(글자 없음) + 녹 번짐
    sx0, sy0, sw, sh = 22, 23, 36, 8
    c.R(sx0 - 1, sy0 - 1, sw + 2, sh + 2, OL)
    for yy in range(sy0, sy0 + sh):
        for xx in range(sx0, sx0 + sw):
            t = 1 if yy > sy0 else 2
            if yy == sy0 + sh - 1:
                t = -1
            if xx == sx0:
                t += 1
            col = K('kii', t)
            if sy0 + 3 <= yy <= sy0 + 4:
                col = K('aka', 1 if yy == sy0 + 3 else 0)
            elif yy in (sy0 + 1, sy0 + 6) and (xx - sx0) % 6 == 3:
                col = K('sora', 1)
            c.P(xx, yy, col)
    for (rx, ry) in ((sx0 + 2, sy0 + 6), (sx0 + sw - 3, sy0 + 1), (sx0 + sw - 2, sy0 + 2)):
        c.P(rx, ry, J('noren_rust', 3)); c.P(rx, ry + 1, J('noren_rust', 1))
    _shade(c, sx0 + 1, sy0 + sh + 1, sw, 1, 0.7)
    # 가게 앞(열린 진열창): 안쪽 어둠(위 깊게)
    YS, YF = 38, 57
    for yy in range(YS, YF):
        for xx in range(X0, X1 + 1):
            t = 0 if yy < YS + 3 else 1 if H(xx // 3, yy // 3, 33) > 0.3 else 0
            c.P(xx, yy, J('machiya_timber', t))
    for sy, cols in ((40, ('aka', 'kii', 'midori', 'pinku', 'sora')), (46, ('daidai', 'sora', 'aka', 'midori', 'kii'))):
        _hbeam(c, X0 + 2, sy + 4, X1 - X0 - 3 - 22, 'aged_cedar', 3)        # 선반
        for k, x in enumerate(range(X0 + 4, 50, 6)):
            col = cols[k % len(cols)]
            c.R(x, sy, 4, 4, K('garasu', 1)); c.VL(x + 3, sy, 4, K('garasu', 0))
            c.R(x, sy + 2, 3, 2, K(col, 1)); c.P(x, sy + 2, K(col, 2)); c.P(x + 2, sy + 3, K(col, -1))
            c.P(x, sy, K('shiro', 2)); c.P(x, sy + 1, K('garasu', 2))
            c.HL(x, sy - 1, 4, K('tekko', 2)); c.P(x + 3, sy - 1, K('tekko', 0))   # 병뚜껑
    # 앞 진열대(3/4 윗면에 상자·뽑기 통)
    rect_3d(c, X0 + 2, 50, 44, 9, 4, 'aged_cedar', top_t=3, front_t=2)
    for xx in range(X0 + 3, X0 + 45):
        for j in range(55, 58):
            if H(xx // 6, j, 34) < 0.3 or (xx - X0) % 11 == 0:
                c.P(xx, j, J('aged_cedar', 1))
    for x, col in ((10, 'aka'), (17, 'kii'), (24, 'sora'), (31, 'pinku'), (38, 'midori')):
        c.R(x, 51, 5, 3, K(col, 1)); c.HL(x, 51, 5, K(col, 2)); c.VL(x + 4, 51, 3, K(col, -1)); c.P(x, 51, K('shiro', 2))
        c.HL(x, 54, 5, J('aged_cedar', 1))
    # 오른쪽: 유리 미닫이 + 라무네 냉장고
    c.R(52, YS, 22, YF - YS, K('tekko', 2)); c.VL(52, YS, YF - YS, K('tekko', 3)); c.VL(73, YS, YF - YS, K('tekko', 0))
    for gx0, gw in ((53, 9), (63, 10)):
        for yy in range(YS + 1, YF - 1):
            for xx in range(gx0, gx0 + gw):
                t = -1 if yy < YS + 4 else 0
                if (xx - gx0) + (yy - YS) in (6, 7, 14):
                    t = 2
                c.P(xx, yy, K('garasu', t))
    c.VL(62, YS + 1, YF - YS - 2, K('tekko', 1))
    rect_3d(c, 55, 47, 16, 11, 3, 'vending_cool_white', top_t=4, front_t=3)
    c.R(57, 51, 12, 4, K('sora', 1)); c.HL(57, 51, 12, K('sora', 2)); c.VL(68, 51, 4, K('sora', 0))
    for bx in (58, 61, 64, 67):
        c.P(bx, 52, K('shiro', 2)); c.P(bx, 53, K('sora', 0))
    c.VL(X0 - 1, YS, YF - YS, OL); c.VL(X1 + 1, YS, YF - YS, OL)
    # 줄무늬 차양(3/4 윗면 경사 + 앞 주름 끝)
    for y in range(32, 38):
        for x in range(X0 - 2, X1 + 3):
            band = ((x - X0) // 5) % 2
            i = (x - X0) % 5
            t = 2 if y < 34 else 1 if y < 36 else 0
            if i == 0:
                t += 1 if y < 36 else 0
            elif i == 4:
                t -= 1
            if x > X1 - 8:
                t -= 1
            c.P(x, y, K('aka', t) if band == 0 else K('shiro', t))
    for x in range(X0 - 2, X1 + 3):
        if ((x - X0) % 5) in (1, 2, 3):
            band = ((x - X0) // 5) % 2
            c.P(x, 38, K('aka', -1) if band == 0 else K('shiro', -1))
            if (x - X0) % 5 == 2:
                c.P(x, 39, K('aka', -2) if band == 0 else K('shiro', -2))
    c.HL(X0 - 3, 31, X1 - X0 + 7, OL); c.VL(X0 - 3, 32, 6, OL); c.VL(X1 + 3, 32, 6, OL)
    _shade(c, X0, 39, W, 2, 0.7, dither=True)
    # 둥근 법랑 간판(기둥에)
    disc(c, 4, 46, 3.6, OL); disc(c, 4, 46, 2.6, K('sora', 1)); c.P(3, 45, K('shiro', 2)); c.P(4, 46, K('shiro', 1)); c.P(5, 47, K('sora', -1))
    kawara_gable(c0, 2, 77, 6, 18 + D, 'tairu', 0)
    stone_base(c, X0, YF, W, 4)
    _finish(c0, (X0 + 2, X1 + 4, YF + 4 + D, 3))


# ═══════════════════════════ 5. 목조 간이역 ═══════════════════════════
@kit('inaka-wooden-station', '목조 간이역(木造駅舎) - 기와 寄棟·시계 박공·개찰·역명판·승강장 기단(7×6)', 7, 6, 'building',
     solid=rows(7, [3, 4, 5]), tags=['inaka', '간이역', '목조역', '駅舎', '無人駅'],
     rules='선로(jp-rail-h) 바로 남쪽 또는 북쪽에 승강장 끝(jp-platform-edge)과 나란히 둔다. 개찰구는 가운데 두 칸.',
     role='building', doors=[(3, 5, 2)])
def station(c, base):
    D = 32
    c0, c = c, _below(c, D)
    X0, X1 = 7, 104
    YW, YF = 28, 49
    W = X1 - X0 + 1
    _boards_h(c, X0, YW, W, YF - YW, 'lino', 1, 3, 14, seed=13)            # 페인트 칠한 下見板(옅은 녹색)
    for yy in range(YF - 6, YF):                                          # 허리 판(짙은 갈색)
        for xx in range(X0, X1 + 1):
            c.P(xx, yy, J('aged_cedar', 2 + (1 if yy == YF - 6 else 0) - (1 if (xx % 6 == 0) else 0) - (1 if yy == YF - 1 else 0)))
    for px in (X0, 42, 70, X1 - 1):
        post(c, px, YW, YF - YW, 'aged_cedar', 2)
    sash(c, 14, 34, 22, 9, 'lino', 1, shutter=False)
    sash(c, 76, 34, 22, 9, 'lino', 1, shutter=False)
    # 가운데 개찰(열린 입구 + 나무 개찰 울)
    for yy in range(31, YF):
        for xx in range(45, 69):
            t = 0 if yy < 34 else 1
            if yy > YF - 5:
                t = 2 if H(xx // 4, yy, 35) > 0.4 else 1
            c.P(xx, yy, J('machiya_timber' if yy <= YF - 5 else 'shrine_flagstone', t))
    for gx in (49, 56, 63):
        rect_3d(c, gx, 40, 4, 9, 2, 'aged_cedar', top_t=4, front_t=2)
    _hbeam(c, 46, 42, 22, 'aged_cedar', 3, 1)
    c.VL(44, 31, YF - 31, OL)
    _eave_shade(c, X0, YW, W, 4)
    # 시간표판(오른쪽 벽 끝): 칠판 + 색 칸(글자 없음)
    c.R(99, 32, 5, 14, OL); c.R(100, 33, 3, 12, K('kokuban', 0)); c.VL(100, 33, 12, K('kokuban', 1))
    for yy, col in ((35, K('shiro', 1)), (36, K('aka', 1)), (39, K('shiro', 0)), (42, K('sora', 1))):
        c.P(101, yy, col); c.P(102, yy, _dim(col, 0.8))
    # 지붕(테라코타 기와 寄棟) + 가운데 시계 박공
    _kawara_hip(c0, 3, 108, 10, 24 + D, 24, 'kawara', 0, K('daidai', 2), seed=2)
    gx0, gx1, gy = 44, 68, 24
    for y in range(12, gy):
        half = (y - 12)
        for x in range(round(56 - half), round(56 + half) + 1):
            t = 1 if x < 56 else 0
            t += _plaster_px(x, y, (y - 12) / 12, 36)
            c.P(x, y, K('shiro', t))
    line(c, 56, 10, gx0 - 2, gy, K('kawara', 2)); line(c, 56, 11, gx0 - 1, gy, K('kawara', 0))
    line(c, 56, 12, gx0, gy, K('kawara', -2))
    line(c, 56, 10, gx1 + 2, gy, K('kawara', -1)); line(c, 56, 11, gx1 + 1, gy, K('kawara', -2))
    line(c, 56, 12, gx1, gy, K('kawara', -3))
    line(c, 56, 9, gx0 - 3, gy, OL); line(c, 56, 9, gx1 + 3, gy, OL)
    disc(c, 56, 19, 3.6, OL); disc(c, 56, 19, 2.7, K('shiro', 2)); disc(c, 56.6, 19.6, 1.6, K('shiro', 1))
    c.VL(56, 17, 2, K('sumi', 0)); c.P(57, 19, K('sumi', 0)); c.P(54, 18, K('shiro', 2))
    # 역명판(처마 밑): 흰 판 + 남색 띠 + 붉은 점(노선색) — 글자 없음
    c.R(44, 25, 26, 6, OL)
    for yy in range(26, 30):
        for xx in range(45, 69):
            t = 2 if yy == 26 else 1
            if xx > 64:
                t -= 1
            c.P(xx, yy, K('shiro', t))
    c.HL(45, 29, 24, K('kon', 0)); c.HL(45, 28, 24, K('kon', 1))
    c.R(48, 27, 3, 1, K('aka', 1)); c.R(63, 27, 3, 1, K('aka', 0))
    # 승강장 기단(판석 윗면 5px + 앞면)
    plinth_34(c, 1, YF, 110, 14, top_h=5, mat='paving_stone')
    for xx in range(2, 109):
        for yy in range(YF + 1, YF + 6):
            if yy == YF + 4:
                c.P(xx, yy, K('kii', 2 if xx % 2 else 1))                 # 점자 블록 띠
                continue
            seg = (xx + (yy - YF) * 3) // 11
            t = 3 + (1 if yy == YF + 1 else 0) - (1 if H(seg, yy, 37) < 0.25 else 0)
            if (xx + (yy - YF) * 3) % 11 == 0:
                t = 2
            c.P(xx, yy, J('paving_stone', t))
        for yy in range(YF + 6, YF + 12):
            t = 2 - (1 if yy > YF + 9 else 0)
            if (xx + (yy // 4) * 5) % 12 == 0 or (yy - YF - 6) % 4 == 3:
                t -= 1
            if H(xx // 2, yy // 2, 38) < 0.08:
                t -= 1
            c.P(xx, yy, J('paving_stone', t))
    _shade(c, X0, YF + 1, W, 1, 0.8)
    _finish(c0)


def _shift(c, dy):
    """c 의 아래쪽 보기(dy 줄 아래부터). 옛 정면 그림 코드를 그대로 두고 위에 깊은 지붕 면을 더할 때 쓴다(쓰기는 c 로 간다)."""
    v = Cv.__new__(Cv)
    v.w, v.h, v.a = c.w, c.h - dy, c.a[dy:]
    return v


# ═══════════════════════════ 6. 버스 정류장 대합실 ═══════════════════════════
@kit('inaka-bus-stop-shelter', '시골 버스 대합실 - 片流れ 함석 지붕 윗면(깊이 1.5칸)·판자 뒷벽·나무 벤치·둥근 정류장 표지(3×4)', 3, 4, 'structure',
     solid=rows(3, [2, 3]), tags=['inaka', '버스정류장', '대합실', 'バス停'],
     rules='시골 길가(자갈길·생활도로) 북쪽에 정면이 길을 보게 둔다. 벤치 칸(아래 가운데)은 앉을 수 있다.', role='building')
def bus_shelter(c, base):
    D = 15                                                                 # 깊어진 지붕 면만큼 정면을 아래로

    def front(c):
        # 판자 뒷벽(안쪽 그늘): 세로 판
        _boards_v(c, 4, 15, 30, 20, 'aged_cedar', -1, 4, seed=15)
        c.HL(4, 15, 30, J('machiya_timber', 1)); c.HL(4, 16, 30, J('machiya_timber', 2))
        for xx in range(4, 34, 2):
            c.P(xx, 17, J('aged_cedar', 0))
        # 붙은 안내지(색 칸만, 글자 없음)
        c.R(19, 18, 11, 12, J('aged_cedar', 0))
        c.R(20, 19, 9, 10, K('shiro', 1)); c.VL(20, 19, 10, K('shiro', 2)); c.HL(20, 28, 9, K('shiro', 0))
        c.R(20, 19, 9, 2, K('aka', 0)); c.HL(20, 19, 9, K('aka', 1))
        c.R(21, 22, 3, 3, K('sora', 1)); c.R(25, 22, 3, 2, K('kii', 1)); c.R(25, 25, 3, 2, K('midori', 0)); c.R(21, 26, 3, 1, K('shiro', -1))
        c.P(28, 28, K('shiro', -1)); c.P(27, 28, K('kinari', 0))
        c.VL(3, 15, 20, OL); c.VL(34, 15, 20, OL)
        # 콘크리트 바닥 슬래브(윗면 얼룩) + 벤치
        rect_3d(c, 1, 33, 36, 9, 4, 'concrete_grey', top_t=3, front_t=2)
        for xx in range(2, 36):
            for yy in range(34, 41):
                if H(xx, yy, 39) < 0.12:
                    c.P(xx, yy, _dim(_key(c, xx, yy), 0.86))
        _shade(c, 4, 34, 30, 1, 0.75)
        rect_3d(c, 7, 27, 22, 6, 3, 'aged_cedar', top_t=4, front_t=2)
        for xx in range(8, 28):
            if (xx - 8) % 7 == 0:
                c.P(xx, 28, J('aged_cedar', 2)); c.P(xx, 29, J('aged_cedar', 2))
        for lx in (9, 25):
            c.R(lx, 33, 2, 3, J('machiya_timber', 1)); c.P(lx, 33, J('machiya_timber', 3))
        _shade(c, 8, 33, 21, 2, 0.75, dither=True)
        # 기둥
        post(c, 3, 13, 21, 'machiya_timber', 3, 3); post(c, 32, 13, 21, 'machiya_timber', 3, 3)
        # 片流れ 지붕(녹슨 골함석)
        for y in range(4, 11):
            for x in range(1, 37):
                t = 0 + (1 if y < 6 else 0) - (1 if x > 31 else 0)
                c.P(x, y, _tin_px(x, y, 4, t, seed=40))
            c.P(0, y, OL); c.P(37, y, OL)
        c.HL(0, 3, 38, OL); c.HL(1, 4, 36, K('tekko', 3))
        c.HL(0, 11, 38, K('tekko', 3)); c.HL(0, 12, 38, K('tekko', 0)); c.HL(0, 13, 38, K('tekko', -2)); c.HL(-1, 14, 40, OL)
        for x in range(2, 36, 9):
            c.P(x, 13, J('noren_rust', 1)); c.P(x, 14, J('noren_rust', 0))
        # 둥근 버스 정류장 표지(파랑 테 + 흰 판 + 붉은 띠) + 기둥 + 콘크리트 받침
        c.R(42, 12, 2, 30, K('tekko', 2)); c.VL(42, 12, 30, K('tekko', 3)); c.VL(41, 12, 30, OL); c.VL(44, 12, 30, OL)
        for yy in range(14, 42, 5):
            c.P(43, yy, K('tekko', 0))
        disc(c, 42.5, 8, 5.6, OL); disc(c, 42.5, 8, 4.6, K('sora', 0)); disc(c, 42, 7.5, 3.6, K('sora', 1))
        disc(c, 42.5, 8, 3.2, K('shiro', 2)); disc(c, 43.2, 8.7, 2.0, K('shiro', 1))
        c.HL(40, 8, 6, K('sora', 0)); c.P(41, 6, K('aka', 1)); c.P(42, 6, K('aka', 1)); c.P(40, 5, K('sora', 2))
        c.R(40, 18, 6, 7, K('shiro', 2)); c.VL(45, 18, 7, K('shiro', 0)); c.HL(40, 18, 6, K('sora', 1))
        c.R(41, 20, 2, 2, K('kii', 1)); c.R(41, 22, 4, 1, K('sora', 0))
        c.R(39, 17, 8, 1, OL); c.VL(39, 18, 7, OL); c.VL(46, 18, 7, OL); c.HL(39, 25, 8, OL)
        disc(c, 42.5, 43, 4.2, OL, ry=2.6); disc(c, 42.5, 43, 3.2, K('conc', 1), ry=1.6); c.HL(41, 42, 3, K('conc', 3)); c.P(44, 44, K('conc', -1))
    front(_shift(c, D))
    # 片流れ 지붕 윗면(녹슨 골함석, y2~25 ≈ 1.5칸): 뒤(위)가 높고 앞(아래)으로 흘러내린다 — 골은 경사 따라 세로,
    # 판 이음은 가로, 위쪽은 빛, 처마 가까이 녹이 짙다
    for y in range(2, D + 11):
        f = (y - 2) / (D + 8)
        for x in range(1, 37):
            t = (1 if f < 0.25 else 0) - (1 if x > 31 else 0) - (1 if f > 0.85 else 0)
            col = _tin_px(x, y, 2, t, seed=40)
            if (y - 2) % 9 == 8:
                col = K('tekko', t - 1)                                      # 판 겹침 그늘
            elif (y - 2) % 9 == 0 and y > 2:
                col = K('tekko', t + 2) if x % 4 < 2 else col                # 겹친 판 끝 빛
            c.P(x, y, col)
        for xo in (0, 37):
            if c.a[y, xo, 3] == 0:
                c.P(xo, y, OL)
    c.HL(0, 1, 38, OL); c.HL(1, 2, 36, K('tekko', 3))
    _finish(c)
    ground_shadow(c, 3, 47, 42 + D, 4, K('tairu', -2))             # 차가운 남색 그늘(무채색 근흑 대신)


# ═══════════════════════════ 7. 물레방아간 ═══════════════════════════
@kit('inaka-waterwheel-mill', '물레방아간(水車小屋) - 초가 오두막·筧 물길·나무 물레·돌 물받이(4×5)', 4, 5, 'building',
     solid=rows(4, [3, 4]), tags=['inaka', '물레방아', '水車', '물레방아간'],
     rules='개울·수로 가장자리에 둔다(오른쪽 아래 물받이가 물에 닿는다).', role='building', doors=[(1, 4, 1)])
def waterwheel_mill(c, base):
    D = 16
    c0, c = c, _below(c, D)
    # 오두막 벽(세로 판) + 문
    _boards_v(c, 6, 31, 28, 20, 'aged_cedar', 0, 4, seed=17)
    for yy in range(37, 51):
        for xx in range(13, 23):
            t = 0 if yy < 40 or xx < 15 else 1 if H(xx // 2, yy // 3, 41) > 0.4 else 0
            c.P(xx, yy, J('machiya_timber', t))
    _hbeam(c, 12, 36, 12, 'machiya_timber', 3, 1)
    c.VL(12, 37, 14, OL)
    for (sx, sy) in ((16, 46), (18, 47), (17, 48), (20, 48)):                # 안쪽 쌀겨 자루
        c.P(sx, sy, J('cream_stucco', 2)); c.P(sx + 1, sy, J('cream_stucco', 1))
    _eave_shade(c, 6, 33, 28, 4)
    c.VL(5, 31, 20, OL); c.VL(34, 31, 20, OL)
    thatch_roof(c0, 3, 37, 13, 27 + D, 11)
    stone_base(c, 4, 51, 32, 4)
    # 돌 물받이(윗면에 물 + 앞면 돌, 젖은 아래쪽)
    c.R(36, 49, 27, 14, OL)
    stones(c, 37, 54, 25, 8, 'shrine_flagstone', seed=3, course=(4, 4), width=(6, 9), moss=0.35)
    _shade(c, 37, 59, 25, 3, 0.8, dither=True)
    for yy in range(50, 54):
        for xx in range(37, 62):
            t = 0 if yy > 50 else 1
            if H(xx // 3, yy, 42) > 0.82:
                t = 2
            c.P(xx, yy, K('sora', t) if yy > 50 else J('shrine_flagstone', 4))
    for (wx, wy, ww) in ((38, 52, 5), (48, 51, 4), (55, 52, 4)):
        c.HL(wx, wy, ww, K('sora', 2)); c.P(wx + ww, wy, K('shiro', 2))
    # 물레: 뒤 테(두께, 오른쪽 아래) → 앞 테(판마다 톤) → 살 → 바깥 물받이 날개 → 축
    cx, cy, r = 47, 34, 13.5
    disc(c, cx + 2, cy + 1, r + 1, OL)
    disc(c, cx + 2, cy + 1, r, J('machiya_timber', 2))
    disc(c, cx, cy, r + 1, OL)
    for yy in range(int(cy - r - 1), int(cy + r + 2)):
        for xx in range(int(cx - r - 1), int(cx + r + 2)):
            d = math.hypot(xx - cx, yy - cy)
            if d > r:
                continue
            ang = math.atan2(yy - cy, xx - cx)
            seg = int((ang + math.pi) / (math.pi / 8))
            if d > r - 3:                                                  # 테: 판(16장)마다 톤, 위 왼쪽 빛
                lt = -math.cos(ang + math.pi / 4)
                t = 3 + (1 if lt > 0.5 else -1 if lt < -0.4 else 0) - (1 if H(seg, 0, 43) < 0.3 else 0)
                if d > r - 0.8:
                    t -= 1
                c.P(xx, yy, J('aged_cedar', t))
            else:
                g = (xx - cx) + (yy - cy)
                c.P(xx, yy, J('machiya_timber', 2 if g < -9 else 1 if g < 4 else 0))   # 안쪽 그늘(왼쪽 위 옅게)
    for k in range(8):
        a = k * math.pi / 4 + 0.15
        x2, y2 = cx + math.cos(a) * (r - 2), cy + math.sin(a) * (r - 2)
        line(c, round(cx), round(cy), round(x2), round(y2), J('aged_cedar', 3 if math.sin(a) < 0 else 2))
        line(c, round(cx + 1), round(cy), round(x2 + 1), round(y2), J('aged_cedar', 1))
    for k in range(16):                                                    # 날개(바깥 판 끝)
        a = k * math.pi / 8 + 0.2
        px, py = round(cx + math.cos(a) * (r + 0.4)), round(cy + math.sin(a) * (r + 0.4))
        lit = -math.cos(a + math.pi / 4) > 0
        c.P(px, py, J('aged_cedar', 4 if lit else 1))
        c.P(round(cx + math.cos(a) * (r - 1.5)), round(cy + math.sin(a) * (r - 1.5)), J('machiya_timber', 2))
    disc(c, cx, cy, 2.4, OL); disc(c, cx, cy, 1.5, K('tekko', 2)); c.P(cx - 1, cy - 1, K('tekko', 3))
    # 筧(나무 물길): 윗면에 물이 보이는 홈통
    for k in range(18):
        x = 62 - k; y = 4 + k // 2
        c.P(x, y - 1, OL); c.P(x, y, J('aged_cedar', 4)); c.P(x, y + 1, K('sora', 1 if k % 4 else 2))
        c.P(x, y + 2, K('sora', 2) if k % 3 else K('shiro', 1))
        c.P(x, y + 3, J('aged_cedar', 3 if k % 5 else 2)); c.P(x, y + 4, J('aged_cedar', 1)); c.P(x, y + 5, OL)
    post(c, 58, 8, 12, 'machiya_timber', 3); c.VL(57, 8, 12, OL); c.VL(60, 8, 12, OL)
    # 떨어지는 물 + 물보라
    for y in range(13, 22):
        c.P(44, y, K('sora', 2)); c.P(45, y, K('shiro', 2) if y % 3 else K('sora', 2)); c.P(43, y, K('sora', 1) if y % 2 else K('sora', 0))
    for (sx, sy) in ((40, 48), (42, 47), (52, 48), (55, 49), (47, 48), (36, 46), (58, 47)):
        c.P(sx, sy, K('shiro', 2)); c.P(sx + 1, sy, K('shiro', 1))
    _finish(c0, (6, 63, 55 + D, 4))


# ═══════════════════════════ 8. 비닐하우스 ═══════════════════════════
@kit('inaka-vinyl-greenhouse', '비닐하우스 - 남북으로 긴 터널(3/4 탑뷰): 긴 아치 비닐 윗면·가로 아치 골조 줄·용마루 빛 띠·필름 너머 작물 줄·앞 아치 끝 미닫이(3×7)', 3, 7, 'building',
     solid=rows(3, [1, 2, 3, 4, 5, 6]), tags=['inaka', '비닐하우스', '온실', 'ハウス'],
     rules='밭(inaka-paddy 아님) 옆 흙 위에 둔다. 여러 동을 옆으로 나란히 놓는다. 맨 아래 가운데 칸이 출입구.', role='building', doors=[(1, 6, 1)])
def greenhouse(c, base):
    # 남북으로 긴 터널을 위에서 본 3/4: 긴 세로 직사각형 필름 윗면(원통 명암: 가운데 용마루 빛 띠 → 동·서 처마로 어두움),
    # 곧은 가로 늑재 띠, 비친 작물 줄, 곧은 북쪽 끝, 남쪽 끝에만 낮은 반원 끝벽 + 미닫이, 긴 양옆 치마 비닐 + 흙 둔덕 선.
    VW = 'vending_cool_white'
    x0, x1 = 3, 44                      # 터널 동서 폭(처마~처마)
    YN, YB, A = 3, 106, 13              # 북쪽 끝 직선 y, 남쪽 바닥 y, 남쪽 끝벽 아치 높이
    cx, half = (x0 + x1) / 2, (x1 - x0) / 2

    def arch(x):
        u = (x - cx) / half
        return 0.0 if abs(u) >= 1 else A * math.sqrt(1 - u * u)
    RIB = 8
    # 1) 필름 윗면
    for x in range(x0, x1 + 1):
        u = (x - cx) / half
        au = abs(u + 0.08)                                                 # 빛 왼쪽 위: 빛 띠가 살짝 왼쪽
        tb = 4 if au < 0.12 else 3 if au < 0.4 else 2 if au < 0.72 else 1
        if u > 0.75:
            tb -= 1
        crop = any(abs(u - cu) < 0.08 for cu in (-0.48, 0.48))
        ys = round(YB - arch(x))
        for y in range(YN, ys):
            k = (y - YN) % RIB
            t = tb + (1 if k == 1 else -1 if k in (4, 5) else 0)          # 늑재 밑 팽팽한 빛 · 칸 가운데 처짐
            if H(x // 3, (y - YN) // 2, 44) < 0.06:
                t += 1                                                     # 주름 빛
            col = J(VW, t)
            if crop and 2 < k < 7 and H(x, y // 2, 45) < 0.75:
                col = K('lino', 2 if tb >= 2 else 1)                       # 필름 너머 작물 줄(남북으로)
            if k == 0:
                col = K('tekko', 2 if u < -0.2 else 1 if u < 0.5 else 0)  # 곧은 가로 늑재 띠
            c.P(x, y, col)
    for y in range(YN, YB):                                                # 긴 양옆 치마 비닐(진한 필름, 세로 주름)
        for x, t in ((x0, -1), (x0 + 1, 0), (x1 - 1, -1), (x1, -2)):
            if y >= round(YB - arch(x)):
                continue
            c.P(x, y, K('lino', t + (1 if (y // 3) % 3 == 0 else 0)))
    for x in range(x0, x1 + 1):                                            # 곧은 북쪽 끝(끝 파이프)
        c.P(x, YN, K('tekko', 3 if x < cx else 1))
    # 2) 남쪽 끝벽(낮은 반원): 위 밝은 비닐 → 아래 그늘, 비친 작물, 미닫이
    for x in range(x0, x1 + 1):
        a = arch(x)
        if a < 1:
            continue
        u = (x - cx) / half
        for y in range(round(YB - a), YB):
            g = (y - (YB - a)) / max(1.0, a)
            t = 3 if g < 0.35 else 2
            if u > 0.55:
                t -= 1
            if y == round(YB - a):
                t = 4 if u < 0.3 else 2                                    # 아치 끝 파이프 빛
            col = J(VW, t)
            if y >= YB - 6 and (x + y) % 2 == 0:
                col = K('lino', 1 if u < 0.5 else 0)                       # 비친 작물 포기
            c.P(x, y, col)
    DX0, DX1, DY0 = 17, 30, YB - 11
    c.R(DX0, DY0, DX1 - DX0 + 1, YB - DY0, K('tekko', 2)); c.VL(DX0, DY0, YB - DY0, K('tekko', 3)); c.VL(DX1, DY0, YB - DY0, K('tekko', 0))
    for yy in range(DY0 + 1, YB):
        for xx in range(DX0 + 1, 24):
            c.P(xx, yy, J(VW, 4 if xx == DX0 + 1 else 3 if yy < DY0 + 4 else 2))
        for xx in range(24, DX1):
            t = -2 if yy < DY0 + 4 else (0 if (xx - 24) % 3 != 1 and yy % 3 else -1)
            c.P(xx, yy, K('lino', t))
    c.VL(24, DY0 + 1, YB - DY0 - 1, K('tekko', 3)); c.HL(DX0 + 1, DY0 + 5, 6, K('tekko', 1))
    add_outline(c)
    # 3) 흙 둔덕: 남쪽 앞 + 긴 양옆 선
    for xx in range(1, 47):
        c.P(xx, YB, K('soil', 1 if H(xx, 0, 47) > 0.3 else 2))
        c.P(xx, YB + 1, K('soil', 0 if H(xx, 1, 47) > 0.25 else 1))
        c.P(xx, YB + 2, K('soil', -1 if xx % 4 else 0))
        c.P(xx, YB + 3, K('soil', -2))
    for y in range(YN, YB):
        c.P(x0 - 2, y, K('soil', 1 if H(0, y, 48) > 0.4 else 0))
        c.P(x1 + 2, y, K('soil', -1 if H(1, y, 48) > 0.4 else -2))
    _shade(c, x0, YB, x1 - x0 + 1, 1, 0.7)
    _finish(c)
    for y in range(YN + 2, YB + 2):                                        # 동쪽 땅 그늘(긴 띠 = 땅에 누운 터널)
        for xx in (x1 + 3, x1 + 4):
            if xx < c.w and c.a[y, xx, 3] == 0 and (xx + y) % 2 == 0:
                c.P(xx, y, K('yoru', -1))


# ═══════════════════════════ 9. 함석 헛간 ═══════════════════════════
@kit('inaka-agri-tin-shed', '함석 농기구 헛간 - 녹슨 切妻 함석 지붕 앞 경사면(깊이 2.5칸, 골은 세로)·골판 벽·열린 미닫이 안 볏가마(4×5)', 4, 5, 'building',
     solid=rows(4, [2, 3, 4]), tags=['inaka', '헛간', '농기구창고', '納屋', 'トタン'],
     rules='농가 마당 옆이나 논 가장자리. 열린 문 앞 1칸은 비운다.', role='building', doors=[(1, 4, 1)])
def tin_shed(c, base):
    D = 28                                                                 # 깊어진 지붕 면만큼 정면을 아래로

    def front(c):
        X0, X1 = 5, 58
        W = X1 - X0 + 1
        # 골판 벽: 골마다 빛·그늘 · 판마다 톤 · 위에서 흘러내린 녹 줄 · 아래 흙 튐
        for x in range(X0, X1 + 1):
            drip = H(x // 4, 0, 48) < 0.22
            dl = 4 + int(H(x // 4, 1, 48) * 12)
            for y in range(19, 43):
                i = x % 4
                t = (1 if i == 0 else 0 if i == 1 else -1 if i == 2 else -2) + (1 if H(x // 12, 2, 48) > 0.7 else 0)
                col = K('tekko', t)
                if drip and i in (2, 3) and y < 19 + dl:
                    col = J('noren_rust', 2 if y < 19 + dl - 3 else 1)
                elif y > 38 and H(x, y, 49) < (y - 38) * 0.12:
                    col = J('noren_rust', 1) if H(x, y, 50) > 0.4 else K('soil', 0)
                c.P(x, y, col)
        c.VL(X0, 19, 24, K('tekko', 2)); c.VL(X1, 19, 24, K('tekko', -2))
        c.VL(X0 - 1, 19, 24, OL); c.VL(X1 + 1, 19, 24, OL)
        # 열린 미닫이: 어두운 안(위 깊게) + 볏가마 쌓기(짚 결) + 괭이
        for yy in range(23, 43):
            for xx in range(9, 31):
                t = -3 if yy < 27 else -2 if H(xx // 3, yy // 3, 51) > 0.35 else -3
                if yy > 40:
                    t = -1 if H(xx, yy, 52) > 0.5 else -2
                c.P(xx, yy, K('tekko', t))
        c.VL(8, 23, 20, OL)
        for (bx, by) in ((11, 36), (19, 36), (15, 30)):
            for yy in range(by, by + 6):
                for xx in range(bx, bx + 8):
                    j = yy - by
                    t = 3 + (1 if j == 0 else -2 if j == 5 else 0) - (1 if xx == bx + 7 else 0)
                    if 0 < j < 5:
                        hv = H(xx, yy // 2, 53)
                        t += -1 if hv < 0.35 else (1 if hv > 0.85 else 0)
                    if xx - bx in (2, 5) and 0 < j < 5:
                        t -= 1                                                 # 새끼줄 묶음
                    c.P(xx, yy, _ri(STRAW, t + 1))
        line(c, 27, 25, 29, 41, J('aged_cedar', 3)); line(c, 28, 25, 30, 41, J('aged_cedar', 1))
        c.R(25, 24, 4, 2, K('tekko', 2)); c.HL(25, 24, 4, K('tekko', 3))
        # 닫힌 문짝(골판 + 사선 버팀 + 레일)
        for yy in range(23, 43):
            for xx in range(32, 54):
                i = xx % 4
                t = 1 if i == 0 else 0 if i == 1 else -1 if i == 2 else -2
                c.P(xx, yy, K('tekko', t + (1 if yy < 25 else 0)))
        line(c, 33, 41, 52, 24, K('tekko', 3)); line(c, 34, 41, 53, 24, K('tekko', -2))
        c.HL(32, 23, 22, K('tekko', 3)); c.HL(32, 42, 22, K('tekko', -2)); c.VL(31, 23, 20, OL)
        c.HL(8, 22, 47, K('tekko', 2)); c.HL(8, 21, 47, K('tekko', -1))       # 레일
        for (rx, ry) in ((48, 30), (10, 36), (52, 38)):
            c.P(rx, ry, J('noren_rust', 3)); c.P(rx + 1, ry, J('noren_rust', 2)); c.P(rx, ry + 1, J('noren_rust', 1))
        _eave_shade(c, X0, 19, W, 3)
        # 切妻 골함석 지붕(골은 경사 방향 = 세로) + 녹 덩이 + 새로 덧댄 판 + 용마루 덮개
        for y in range(2, 15):
            f = (y - 2) / 13
            for x in range(2, 62):
                up = 1 if f < 0.3 else (-1 if f > 0.8 else 0)
                sh = -1 if x > 53 else (1 if x < 6 else 0)
                col = _tin_px(x, y, 2, up + sh, seed=54)
                if 36 <= x < 48 and 4 <= y < 12:
                    col = K('tekko', up + sh + (2 if x % 4 == 0 else 1 if x % 4 == 1 else 0 if x % 4 == 2 else -1))   # 덧댄 새 판
                c.P(x, y, col)
            c.P(1, y, OL); c.P(62, y, OL)
        c.HL(1, 0, 62, OL); c.HL(2, 1, 60, K('tekko', 3)); c.HL(2, 2, 60, K('tekko', 1))
        for x in range(4, 60, 6):
            c.P(x, 1, K('tekko', 2)); c.P(x, 2, K('tekko', -1))
        c.HL(1, 15, 62, K('tekko', 2)); c.HL(1, 16, 62, K('tekko', -1)); c.HL(1, 17, 62, K('tekko', -3)); c.HL(0, 18, 64, OL)
        c.VL(0, 15, 3, OL); c.VL(63, 15, 3, OL)
        # 기초 + 흙 튐
        foundation(c, X0, 43, W)
        for xx in range(X0, X1 + 1):
            if H(xx, 44, 55) < 0.3:
                c.P(xx, 44, K('conc', -1))
        c.VL(X0 - 1, 43, 4, OL); c.VL(X1 + 1, 43, 4, OL)
    front(_shift(c, D))
    X0, X1 = 5, 58
    # 切妻 앞 경사면(y2~42 ≈ 2.5칸): 용마루에서 처마로 흘러내리는 골(세로) · 판 겹침(가로, 13줄마다) · 처마로 갈수록 녹
    for y in range(2, 15 + D):
        f = (y - 2) / (12 + D)
        for x in range(2, 62):
            up = 1 if f < 0.2 else (-1 if f > 0.85 else 0)
            sh = -1 if x > 53 else (1 if x < 6 else 0)
            col = _tin_px(x, y, 2, up + sh, seed=54 + (1 if f > 0.6 else 0))
            if 36 <= x < 48 and 5 <= y < 30:
                col = K('tekko', up + sh + (2 if x % 4 == 0 else 1 if x % 4 == 1 else 0 if x % 4 == 2 else -1))   # 덧댄 새 판
            lap = (y - 2) % 13
            if lap == 12:
                col = K('tekko', up + sh - 2)                                # 판 겹침 그늘
            elif lap == 0 and y > 2 and x % 4 < 2:
                col = K('tekko', up + sh + 2)                                # 겹친 판 끝 빛
            elif f > 0.7 and x % 4 in (2, 3) and H(x, y // 3, 56) < (f - 0.7) * 1.6:
                col = J('noren_rust', 1 if H(x, y, 57) > 0.4 else 2)         # 처마 쪽 녹물
            c.P(x, y, col)
        c.P(1, y, OL); c.P(62, y, OL)
    c.HL(1, 0, 62, OL); c.HL(2, 1, 60, K('tekko', 3)); c.HL(2, 2, 60, K('tekko', 1))
    for x in range(4, 60, 6):
        c.P(x, 1, K('tekko', 2)); c.P(x, 2, K('tekko', -1))
    _finish(c)
    ground_shadow(c, X0 + 2, X1 + 4, 47 + D, 1, K('tairu', -2))


# ═══════════════════════════ 10. 언덕 도리이 돌계단 ═══════════════════════════
def _clump_px(x, y, near_x=None, seed=57):
    """풀·이끼 덩이(지터 격자 보로노이): 덩이마다 왼쪽 위 빛 · 오른쪽 아래 그늘 · 덩이 사이 깊은 틈. near_x 쪽은 한 단 그늘."""
    S = 5
    best = None
    for gy in range(y // S - 1, y // S + 2):
        for gx in range(x // S - 1, x // S + 2):
            cx_ = gx * S + H(gx, gy, seed) * S
            cy_ = gy * S + H(gx, gy, seed + 1) * S
            d = math.hypot(x - cx_, (y - cy_) * 1.2)
            if best is None or d < best[0]:
                best = (d, x - cx_, y - cy_, gx, gy)
    d, dx, dy, gx, gy = best
    t = 2 + (1 if H(gx, gy, seed + 2) > 0.6 else 0)
    if dx + dy < -2.2:
        t += 1
    elif dx + dy > 1.6:
        t -= 1
    if d > 3.0:
        t -= 1
    if near_x is not None and abs(x - near_x) < 3:
        t -= 1
    mat = 'moss' if H(gx, gy, seed + 3) < 0.55 else 'pine_bamboo'
    return J(mat, t)


def stone_lantern(c, x, y):
    """석등(높이 26): 받침 윗면 · 기둥(돌결) · 불집(창 불빛) · 갓 윗면(넓은 빛) · 보주 · 이끼."""
    rect_3d(c, x, y + 20, 11, 6, 2, 'shrine_flagstone', top_t=3, front_t=2)
    for j in range(y + 12, y + 20):
        for i in range(x + 3, x + 8):
            t = 3 if i == x + 3 else 1 if i == x + 7 else 2
            if H(i, j, 56) < 0.15:
                t -= 1
            c.P(i, j, J('shrine_flagstone', t))
    c.VL(x + 2, y + 12, 8, OL); c.VL(x + 8, y + 12, 8, OL)
    rect_3d(c, x + 1, y + 6, 9, 7, 1, 'shrine_flagstone', top_t=3, front_t=2)
    c.R(x + 3, y + 8, 5, 3, J('lantern_amber', 3)); c.HL(x + 3, y + 8, 5, J('lantern_amber', 4)); c.P(x + 7, y + 10, J('lantern_amber', 2))
    c.VL(x + 5, y + 8, 3, J('shrine_flagstone', 1))
    rect_3d(c, x - 1, y + 2, 13, 5, 3, 'shrine_flagstone', top_t=4, front_t=1)
    c.P(x + 1, y + 3, J('moss', 3)); c.P(x + 2, y + 3, J('moss', 2)); c.P(x + 9, y + 4, J('moss', 1))
    c.R(x + 4, y, 3, 2, J('shrine_flagstone', 3)); c.P(x + 4, y, J('shrine_flagstone', 4)); c.P(x + 6, y + 1, J('shrine_flagstone', 2))
    c.HL(x + 4, y - 1, 3, OL); c.P(x + 3, y, OL); c.P(x + 7, y, OL)
    c.P(x + 1, y + 23, J('moss', 3)); c.P(x + 9, y + 24, J('moss', 1))


@kit('inaka-hillside-torii-stairs', '언덕 신사 돌계단과 明神 도리이 - 디딤판 윗면·챌면·석등 한 쌍(4×5)', 4, 5, 'structure',
     solid=[(0, y) for y in range(5)] + [(3, y) for y in range(5)], other='floor',
     tags=['inaka', '도리이', '돌계단', '神社', 'stair'],
     rules='마을 뒷산 신사 입구. 위(북)쪽에 삼나무(jp-rg-sugi)·배전(jp-bldg-shrine-haiden)을 잇는다. 가운데 두 칸을 오른다.',
     role='building')
def torii_stairs(c, base):
    # 양옆 풀 둔덕: 잎 덩이마다 왼쪽 위 빛·오른쪽 아래 그늘, 덩이 사이 깊은 틈, 들꽃 점
    for (bx0, bx1) in ((1, 16), (48, 63)):
        for y in range(22, 79):
            for x in range(bx0, bx1):
                c.P(x, y, _clump_px(x, y, near_x=(15 if bx0 == 1 else 48)))
        for x in range(bx0 + 2, bx1 - 1, 5):
            fy = 24 + (x * 7) % 40
            c.P(x, fy, K('kii', 2)); c.P(x, fy + 1, K('kii', 0))
        c.P(bx0 + 6, 70, K('shiro', 1)); c.P(bx0 + 9, 33, K('shiro', 2))
    # 돌계단: 단마다 디딤판(윗면 3px: 앞 끝 밝은 모서리) + 챌면(3px 그늘) · 돌 한 장씩 톤 · 양 끝 이끼 · 닳은 가운데
    SX0, SX1 = 16, 48
    for k, y in enumerate(range(30, 78, 6)):
        cuts = sorted({SX0 + 6 + int(H(k, 0, 59) * 6), SX0 + 16 + int(H(k, 1, 59) * 5), SX0 + 25 + int(H(k, 2, 59) * 3)})
        for x in range(SX0, SX1):
            blk = sum(1 for cx_ in cuts if x >= cx_)
            tv = 1 if H(blk, k, 60) > 0.7 else -1 if H(blk, k, 60) < 0.2 else 0
            joint = x in cuts
            for j in range(6):
                yy = y + j
                if j < 3:
                    t = (3 if j < 2 else 4) + tv                           # 디딤판(앞 끝 코가 가장 밝다)
                    if j == 1 and 22 < x < 42 and H(x, yy, 61) < 0.3:
                        t += 1                                             # 닳아 반들한 가운데
                else:
                    t = (1 if j < 5 else 0) + (tv if j == 3 else 0)        # 챌면(그늘)
                if joint:
                    t = 1 if j < 3 else 0
                if H(x, yy, 62) < 0.07:
                    t -= 1
                col = J('shrine_flagstone', t)
                edge = min(x - SX0, SX1 - 1 - x)
                if edge < 3 and H(x // 2, yy // 2, 63) < 0.55 - edge * 0.15 and j != 0:
                    col = J('moss', 3 if j < 3 else 1)
                elif H(x, yy, 68) < 0.035:
                    col = K('kinari', 0) if j < 3 else J('wet_cobble', 1)    # 지의류 반점 · 젖은 금
                elif j == 5 and H(x // 2, k, 69) < 0.3:
                    col = J('wet_cobble', 2)
                c.P(x, yy, col)
    for yy in range(24, 30):                                               # 맨 위 참배길(판석)
        for x in range(SX0, SX1):
            seg = (x + (yy - 24) // 3 * 5) // 8
            t = 4 if yy == 24 else 3 - (1 if H(seg, yy // 3, 64) < 0.3 else 0)
            if (x + (yy - 24) // 3 * 5) % 8 == 0 or yy == 26:
                t = 2
            c.P(x, yy, J('shrine_flagstone', t))
    for (ex, lit) in ((14, 1), (48, -1)):                                  # 옆 돌 테(축대 윗면)
        for yy in range(24, 78):
            for i in range(2):
                t = 3 + lit - (1 if i == 1 else 0) - (1 if yy % 7 == 0 else 0)
                c.P(ex + i, yy, J('shrine_flagstone', t))
        c.VL(ex - 1 if ex < 30 else ex + 2, 24, 54, OL)
    c.HL(13, 78, 38, OL)
    # 석등 한 쌍
    stone_lantern(c, 2, 46); stone_lantern(c, 51, 46)
    # 明神 도리이: 기둥(주홍 5단) + 亀腹(검은 받침) + 貫 + 額束(판, 금 테) + 島木 + 笠木(검은 윗면, 반전 끝)
    VR = 'torii_vermilion'
    for px in (12, 49):
        c.R(px - 1, 6, 5, 26, OL)
        for yy in range(7, 31):
            low = 1 if yy > 25 else 0
            c.P(px, yy, J(VR, 4 - low)); c.P(px + 1, yy, J(VR, 3 - low if yy % 6 else 2)); c.P(px + 2, yy, J(VR, 1 - low))
        c.P(px + 2, 17, J('autumn_maple', 0)); c.P(px + 1, 17, J(VR, 1))     # 貫 그늘
        c.R(px - 1, 28, 5, 4, J('kawara_dark_tile', 1)); c.HL(px - 1, 28, 5, J('kawara_dark_tile', 3))
        c.P(px - 1, 29, J('kawara_dark_tile', 2)); c.VL(px + 3, 29, 3, J('kawara_dark_tile', 0))
    # 貫
    c.R(8, 14, 48, 4, OL)
    for xx in range(9, 55):
        sh = -1 if xx > 50 else 0
        c.P(xx, 15, J(VR, 4 + sh if xx % 9 else 3 + sh)); c.P(xx, 16, J(VR, 2 + sh))
    # 額束(판, 금 테, 글자 없음)
    c.R(29, 9, 6, 6, OL); c.R(30, 10, 4, 4, J('kawara_dark_tile', 1)); c.HL(30, 10, 4, J('lantern_amber', 3))
    c.VL(30, 10, 4, J('lantern_amber', 3)); c.P(31, 11, J('lantern_amber', 2)); c.P(32, 12, J('kawara_dark_tile', 2))
    # 島木
    c.R(5, 6, 54, 4, OL)
    for xx in range(6, 58):
        sh = -1 if xx > 52 else 0
        c.P(xx, 7, J(VR, 4 + sh)); c.P(xx, 8, J(VR, 2 + sh if xx % 7 else 1 + sh))
    c.HL(6, 9, 52, J('autumn_maple', 0))
    # 笠木(검은 윗면 + 앞면) + 반전 끝
    c.R(2, 1, 60, 6, OL)
    for xx in range(3, 61):
        sh = -1 if xx > 54 else 0
        c.P(xx, 2, J('kawara_dark_tile', 4 + sh if xx % 5 else 3 + sh)); c.P(xx, 3, J('kawara_dark_tile', 3 + sh))
        c.P(xx, 4, J('kawara_dark_tile', 1 + sh)); c.P(xx, 5, J('kawara_dark_tile', 0))
    c.R(0, 0, 4, 3, OL); c.R(60, 0, 4, 3, OL)
    c.P(1, 1, J('kawara_dark_tile', 4)); c.P(2, 1, J('kawara_dark_tile', 3)); c.P(62, 1, J('kawara_dark_tile', 2)); c.P(61, 1, J('kawara_dark_tile', 2))
    _finish(c)
