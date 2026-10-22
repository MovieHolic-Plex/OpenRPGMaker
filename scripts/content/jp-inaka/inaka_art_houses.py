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


def _crop_draw(c, extra, fn):
    """키 낮추기: 옛 좌표 그대로 extra 줄 더 높은 캔버스에 그린 뒤 아래쪽만 c 에 옮긴다(바닥 고정, 위 빈 줄 버림)."""
    t = Cv(c.w, c.h + extra)
    fn(t)
    assert not t.a[:extra, :, 3].any(), 'crop 영역에 그림이 남았다'
    c.a[:] = t.a[extra:]


def _deep_eave_shadow(c, x, y, w):
    """처마가 벽에 던지는 그늘(R9): 지붕 처마는 짙은 한 줄뿐이고 어둠은 벽 위 2~3줄 그늘로 옮긴다 — 위 짙고 아래로 풀린다."""
    for j, k in enumerate((0.58, 0.68, 0.8)):
        _shade(c, x, y + j, w, 1, k, 8)
    _shade(c, x, y + 3, w, 1, 0.88, 6, dither=True)


def _mat_dark_for(col, lighter=False):
    """이웃 재질 색 → 그 재질의 어두운 윤곽 색(무채 근흑 대신). lighter 면 한 단 밝은 것(원래 덜 어둡던 화소 — 단 차이 보존)."""
    r, g, b = _rgb(col)
    j = 1 if lighter else 0
    if r > b + 30 and r > g + 25:
        return K('kawara', -2 + j)                                         # 붉은 기와·붉은 칠
    if g > r + 4 and g > b:
        return J('moss', 0 + j)
    if r > b + 8:
        return J('machiya_timber', 2 + j)                                  # 나무·흙·짚
    if b > r + 6:
        return K('tairu', -3 + j)                                          # 푸른 회색 기와·함석
    return K('yoru', -2 + j)


def _material_darks(c, thr=36):
    """R9 윤곽: 밝기 thr 미만(근흑) 화소를 주변(5×5) 재질 색의 어두운 톤으로 — 버들항처럼 근흑 몫을 작게."""
    a = c.a
    h, w = a.shape[:2]
    ch = []
    for y in range(h):
        for x in range(w):
            if a[y, x, 3] == 0:
                continue
            k = _key(c, x, y)
            if lum(k) >= thr:
                continue
            votes = {}
            for r in (1, 2, 3):
                for dy in range(-r, r + 1):
                    for dx in range(-r, r + 1):
                        if max(abs(dy), abs(dx)) != r:
                            continue
                        yy, xx = y + dy, x + dx
                        if 0 <= yy < h and 0 <= xx < w and a[yy, xx, 3]:
                            kk = _key(c, xx, yy)
                            if lum(kk) >= thr + 10:
                                votes[kk] = votes.get(kk, 0) + (4 - r)
                if votes:
                    break
            nb = max(votes, key=votes.get) if votes else 0x2b2a33
            if k not in (OL, 0x100a1a, 0x1a1226) and max(_rgb(k)) - min(_rgb(k)) > 6:
                nb = k                                                     # 재질이 있는 어둠(나무 안쪽 등)은 제 색조를 따른다
            ch.append((x, y, _mat_dark_for(nb, lum(k) >= 29)))
    for x, y, col in ch:
        c.P(x, y, col)


def _finish(c, shadow=None, keep_bottom=0, mat=False):
    """마지막 손질: 근흑 윤곽을 재질 색 어두운 톤으로 바꾸고 발치 체커 그늘을 깐다. shadow=(x0, x1, y0, rows).
    mat 이면(R9 건물) 남은 근흑 화소를 모두 이웃 재질의 어두운 색으로."""
    tint_outlines(c, keep_bottom)
    _retint_edges(c)
    if mat:
        _material_darks(c)
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
    band = n >= 10 and (yy < 2 or n - yy <= 2)
    if band and H(x, y, seed + 6) < 0.45 + moss_bias:
        col = _ri(MOSS, t - 1)
    return col


_THATCH_WEDGE: dict = {}   # 키트별 隅面 덮어쓰기(고민가 전용): {'w': 쐐기 px, 'face': 쐐기 면 단}. 비면 옛 동작(run//2, 왼쪽 빛).


def thatch_roof(c, x0, x1, ytop, yeave, run, ridge=True, small=None):
    """茅葺き 寄棟: 사다리꼴 경사 윗면에 짚 다발 결(다발 끝 빛·밑 그늘·세로 획), 묵은 짚 얼룩, 북·오른쪽 그늘 이끼.
    처마는 6px 두께 단면(짚 끝 층), 위에 箱棟(대나무 누름대·烏おどり)."""
    rl, rr = x0 + run, x1 - run
    n = yeave - ytop
    for y in range(ytop, yeave):
        f = (y - ytop) / n
        xl = round(lerp(rl, x0, f)); xr = round(lerp(rr, x1, f))
        wg = _THATCH_WEDGE.get('w', run // 2)                            # 隅面 쐐기 폭
        bl = round(lerp(rl, x0 + wg, f)); br = round(lerp(rr, x1 - wg, f))
        for x in range(xl, xr + 1):
            if x < bl:
                face, mb = _THATCH_WEDGE.get('face', 2), -0.2
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
        _thatch_ridge(c, rl - 4, rr + 4, ytop, small=(n < 20) if small is None else small)


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


def _kominka_ridge_low(c, bx0, bx1, ytop):
    w = bx1 - bx0 + 1
    top = ytop - 4
    c.R(bx0 - 1, top - 1, w + 2, 5, OL)
    for xx in range(bx0, bx1 + 1):
        lit = 1 if xx < bx0 + w // 3 else (-1 if xx > bx1 - w // 4 else 0)
        c.P(xx, top, K('ita', 3 if lit >= 0 else 2))
        c.P(xx, top + 1, K('ita', 1 + lit - (1 if H(xx // 3, 1, 28) < 0.2 else 0)))
        c.P(xx, top + 2, K('ita', -1 + min(0, lit)))
        c.P(xx, ytop - 1, _ri(STRAW_OLD, 1 if xx % 2 else 0))
    for sx in range(bx0 + 3, bx1 - 1, 6):                                  # 대나무 누름대
        c.P(sx, top + 1, J('pine_bamboo', 4)); c.P(sx, top + 2, J('pine_bamboo', 2))
    n = 5
    for k in range(n):                                                     # 烏おどし: 작은 X(3줄)
        sx = round(bx0 + 4 + k * (w - 10) / (n - 1))
        for i in range(3):
            c.P(sx - 1 + i, top - 3 + i, J('aged_cedar', 4 if i == 0 else 3))
            c.P(sx + 1 - i, top - 3 + i, J('aged_cedar', 2))
        c.P(sx - 2, top - 4, OL); c.P(sx + 2, top - 4, OL)


def _box_ridge(c, bx0, bx1, ytop, sticks=5, seed=0):
    """R9 箱棟: 이엉 맨 윗줄(ytop) 위에 얹힌 상자 — 이엉 윗변보다 좁다. 윗면 1줄(왼쪽 빛) · 앞면 2줄(판, 1px 짙은 누름대 4~5개)
    · 짙은 밑면 1줄, 밑면을 짚 다발 끝이 군데군데 덮는다. 위에 작은 烏おどし X. 판 결은 해시."""
    w = bx1 - bx0 + 1
    top = ytop - 4
    c.HL(bx0, top - 1, w, OL); c.VL(bx0 - 1, top, 3, OL); c.VL(bx1 + 1, top, 3, OL)
    for xx in range(bx0, bx1 + 1):
        lit = 1 if xx < bx0 + w // 4 else (-1 if xx > bx1 - w // 5 else 0)
        c.P(xx, top, K('ita', 3 if lit > 0 else 2 + lit))
        g = -1 if H(xx // 3, 2, 28 + seed) < 0.22 else 0
        c.P(xx, top + 1, K('ita', 1 + lit + g)); c.P(xx, top + 2, K('ita', 0 + min(0, lit) + g))
        c.P(xx, top + 3, K('ita', -2))                                     # 짙은 밑면(이엉에 닿는 그늘)
    c.VL(bx0, top, 3, K('ita', 3))                                         # 왼쪽 끝 빛
    nb = 5 if w > 30 else 3
    for k in range(nb):                                                    # 대나무 누름대(1px 짙은 세로)
        bx = round(bx0 + 3 + k * (w - 7) / (nb - 1))
        c.P(bx, top + 1, K('ita', -1)); c.P(bx, top + 2, K('ita', -2))
    for xx in range(bx0 - 1, bx1 + 2):                                     # 짚 다발 끝이 밑면을 덮는다
        if H(xx, 1, 81 + seed) < 0.4:
            c.P(xx, top + 3, _ri(STRAW_L, 3 if H(xx, 2, 81) < 0.5 else 2))
            if H(xx, 3, 81 + seed) < 0.3:
                c.P(xx, top + 2, _ri(STRAW_L, 4))
    for k in range(sticks):                                                # 烏おどし: 작은 X(3줄)
        sx = round(bx0 + 4 + k * (w - 9) / max(1, sticks - 1))
        for i in range(3):
            c.P(sx - 1 + i, top - 3 + i, J('aged_cedar', 4 if i == 0 else 3))
            c.P(sx + 1 - i, top - 3 + i, J('aged_cedar', 2))
        c.P(sx - 2, top - 4, OL); c.P(sx + 2, top - 4, OL)


def _straw_eave(c, x0, x1, y):
    """R9 초가 처마 끝: 밝은 둥근 입술 1줄 + 짚 끝 단면 1줄(세로 결) + 짙은 밑 1줄(= 아래 윤곽, 검은 띠 없이)."""
    for x in range(x0, x1 + 1):
        sh = -1 if x > x1 - (x1 - x0) // 6 else 0
        c.P(x, y, _ri(STRAW_L, 4 + sh - (1 if H(x, 3, 74) < 0.25 else 0)))
        c.P(x, y + 1, _ri(STRAW_L, 3 + sh - (1 if H(x, 4, 74) < 0.4 else 0)))
        c.P(x, y + 2, _ri(STRAW_L, 0 + (1 if H(x, 5, 74) < 0.3 else 0)))
    c.VL(x0 - 1, y, 3, OL); c.VL(x1 + 1, y, 3, OL)


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


_KAWARA_WEDGE: dict = {}   # 寄棟 기와 隅面 덮어쓰기(기와 농가 전용): {'w','lface','rface','rh','courses'}. 비면 옛 동작.


def _kawara_hip(c, x0, x1, ytop, yeave, run, mat='tairu', base=0, glint=None, seed=0):
    """寄棟 기와 지붕(ref_house.hip_roof 의 깊은 사본): 장마다 하이라이트·골 그늘, 왼쪽 隅 삼각면 빛, 오른쪽 그늘,
    위 1/3 은 하늘빛 한 단 밝게, 隅棟 마루, 大棟 + 鬼瓦, 막새 처마."""
    rl, rr = x0 + run, x1 - run
    wg = _KAWARA_WEDGE.get('w', run // 2)                                 # 隅面 쐐기 폭(농가만 덮어씀)
    lf, rf = _KAWARA_WEDGE.get('lface', 2), _KAWARA_WEDGE.get('rface', -1)
    rh = _KAWARA_WEDGE.get('rh', 4)
    crs_k = _KAWARA_WEDGE.get('courses', False)
    for y in range(ytop, yeave):
        f = (y - ytop) / (yeave - ytop)
        xl = round(lerp(rl, x0, f)); xr = round(lerp(rr, x1, f))
        bl = round(lerp(rl, x0 + wg, f)); br = round(lerp(rr, x1 - wg, f))
        for x in range(xl, xr + 1):
            if x < bl:
                face = lf
            elif x > br:
                face = rf
            else:
                face = 1 if f < 0.34 else 0
            tt = _tile_t(x, y, ytop, seed, rh=rh)
            if crs_k:                                                     # 가로 기와 줄 강조: 줄눈 한 단 더, 세로 골 한 단 덜
                if (y - ytop) % rh == rh - 1:
                    tt -= 1
                elif x % 4 == 3:
                    tt += 1
            c.P(x, y, _kt(mat, base + face + tt, glint))
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


def kawara_gable(c, x0, x1, ytop, yeave, mat='tekko', base=0, low=False):
    """切妻 기와 경사 윗면(平入り): 장마다 명암, 위 밝고 아래 한 단, 양 끝 破風(흰 회반죽 판), 大棟, 막새 처마.
    low 이면 얕은 지붕 띠: 대마루 쪽 두 단 밝은 띠 → 처마 쪽 어둡게, 破風이 대마루에서 처마로 바깥으로 벌어진다(박공 모양)."""
    glint = K('conc', 2)
    n = yeave - ytop
    for y in range(ytop, yeave):
        f = (y - ytop) / n
        if low:
            ins = round((1 - f) * 3)                                       # 破風이 처마로 갈수록 바깥으로
            xa, xb = x0 + ins, x1 - ins
            up = 2 if f < 0.3 else 1 if f < 0.65 else 0
        else:
            xa, xb = x0, x1
            up = 1 if f < 0.4 else 0
        for x in range(xa, xb + 1):
            sh = -1 if x > x1 - (x1 - x0) // 7 else 0
            c.P(x, y, _kt(mat, base + up + sh + _tile_t(x, y, ytop, x0 * 3), glint))
        c.P(xa, y, K('shiro', 1)); c.P(xa + 1, y, _kt(mat, base + 2)); c.P(xb, y, K('shiro', -1)); c.P(xb - 1, y, _kt(mat, base - 2))
        c.P(xa - 1, y, OL); c.P(xb + 1, y, OL)
    if low:
        _tile_ridge(c, x0 + 3, x1 - 3, ytop, mat, base, True, glint)
    else:
        _tile_ridge(c, x0, x1, ytop, mat, base, True, glint)
    _tile_eave(c, x0 - 1, x1 + 1, yeave, mat, base, glint)


# ─────────────── 얕은 지붕(지붕 몫 ≈25%) 공용 ───────────────
# 한 방향 명암: 대마루 쪽 맨 윗줄이 가장 밝고 처마로 한 단씩 어두워진다(둥근·원통 음영 없음). 윤곽은 사다리꼴
# (대마루 쪽이 좁고 처마로 벌어짐). 寄棟은 隅棟 대각 화소(왼쪽 빛·오른쪽 그늘)로 隅面 쐐기를 가른다.
def low_roof(c, ex0, ex1, ytop, yeave, rl, rr, px, hip=True, wg=6, edge=None):
    """px(x, y, f, face) → 색. face: 0 앞 경사면, -1 왼쪽 隅面, -2 오른쪽 隅面, +1 隅棟 빛, -3 隅棟 그늘.
    edge(x, y, f, side) 가 있으면 사다리꼴 양 끝 1px(破風 등)를 그 색으로."""
    n = yeave - ytop
    for y in range(ytop, yeave):
        f = (y - ytop) / max(1, n - 1)
        xl = round(lerp(rl, ex0, f)); xr = round(lerp(rr, ex1, f))
        bl = round(lerp(rl, ex0 + wg, f)) if hip else xl - 1
        br = round(lerp(rr, ex1 - wg, f)) if hip else xr + 1
        for x in range(xl, xr + 1):
            face = -1 if x < bl else (-2 if x > br else 0)
            c.P(x, y, px(x, y, f, face))
        if hip:
            if xl <= bl <= xr:
                c.P(bl, y, px(bl, y, f, 1))
            if xl <= br <= xr:
                c.P(br, y, px(br, y, f, -3))
        if edge is not None:
            c.P(xl, y, edge(xl, y, f, -1)); c.P(xr, y, edge(xr, y, f, 1))
        c.P(xl - 1, y, OL); c.P(xr + 1, y, OL)


def _grad(f, hi=2.0, lo=-2.0, x=None, y=None):
    """0(대마루)→1(처마) 한 방향 단계. x,y 를 주면 2×2 질서 디더로 단 경계를 풀어 가로 띠가 안 생기게."""
    v = hi + (lo - hi) * f
    if x is None:
        return round(v)
    b = math.floor(v)
    thr = (((x % 2) * 2 + (y % 2)) + 0.5) / 4
    return b + (1 if v - b > thr else 0)


def tile_px(mat, base, ytop, rh=3):
    """얕은 기와 화소(R9): 고른 면 밝기(세로 그라데이션 없음) + 가로 기와 줄(3줄마다 줄 그늘 한 줄) +
    丸瓦 세로 골(4px: 등 빛 · 몸 · 몸 · 골) — 줄마다 丸瓦 왼쪽 위 1px 빛. 왼쪽 隅面 한 단 밝고 오른쪽 한 단 어둡다."""
    def px(x, y, f, face):
        if face == 1:
            return _kt(mat, base + 3)                                      # 서쪽 隅棟 선(빛)
        if face == -3:
            return _kt(mat, base - 3)                                      # 동쪽 隅棟 선(그늘)
        t = base + {0: 0, -1: 1, -2: -2}[face]                             # 서쪽 隅面 한 단 밝게, 동쪽 두 단 어둡게
        r = (y - ytop) % rh
        i = (x + 2 * (((y - ytop) // rh) % 2)) % 4                         # 줄마다 丸瓦 열을 반 장 엇갈림
        if r == rh - 1:
            t -= 2 if i == 3 else 1                                        # 줄 그늘(기와 한 줄의 아래 끝)
        elif i == 3:
            t -= 1                                                         # 丸瓦 사이 골
        elif i == 0:
            t += 1 if r == 0 else 0                                        # 丸瓦 왼쪽 위 빛
        return _kt(mat, t)
    return px


def tin_low_px(ytop, seed=40, base=1, rust=True):
    """얕은 함석 화소(R9): 고른 면 + 2px 골(빛·그늘), 가로 줄 없음, 처마 쪽 녹 줄."""
    def px(x, y, f, face):
        t = base + {0: 0, -1: 1, -2: -2, 1: 3, -3: -3}[face]                # 서쪽 隅面 밝게 · 동쪽 두 단 어둡게
        if face in (0, -1, -2):
            i = x % 4
            t += 1 if i == 0 else (-1 if i == 3 else 0)
        col = K('tekko', t)
        if rust and f > 0.62 and face in (0, -1, -2) and x % 4 == 1 and H(x // 4, 0, seed) < 0.22:
            col = J('noren_rust', 1 if f < 0.8 else 0)                      # 처마로 흐르는 녹 줄
        return col
    return px


STRAW_L: Final[list[int]] = [J('aged_cedar', 1), J('aged_cedar', 2), J('tatami_straw', 1), J('tatami_straw', 2),
                             J('tatami_straw', 3), J('tatami_straw', 4), K('kinari', 1)]   # 밝기 한 방향(70→217)


STRAW_D: Final[list[int]] = [J('moss', 1), J('tatami_straw', 0), J('moss', 2)]   # 그늘진 이엉(어둠·몸·빛)


def straw_low_px(seed=0):
    """얕은 초가 화소(R9): 고른 면(밝기 ≈150, 회벽보다 어둡고 금빛) + 짧은 1×2 짚 획(어둡게·밝게) — 처마 쪽 획은 이끼빛.
    왼쪽 隅面 한 단 밝고 오른쪽 한 단 어둡다."""
    def px(x, y, f, face):
        t = 3 + {0: 0, -1: 1, -2: -2, 1: 3, -3: -3}[face]                  # 서쪽 隅面 밝게·동쪽 두 단 어둡게, 隅棟 선
        if face == -3:
            return STRAW_D[0]
        if face == 1:
            return _ri(STRAW_L, t)
        if face == -2:                                                     # 동쪽 隅面: 어두운 이엉 램프(나무 갈색 아님)
            v = H(x, y // 2 + (x % 3), seed + 4)
            return STRAW_D[0] if v < 0.24 else (STRAW_D[2] if v > 0.88 else STRAW_D[1])
        v = H(x, y // 2 + (x % 3), seed + 4)
        if v < 0.24:
            if f > 0.55 and H(x, y // 2, seed + 7) < (f - 0.45):
                return J('moss', 2 if face != -2 else 1)                   # 처마 쪽 이끼 낀 짚 획
            t -= 1
        elif v > 0.88:
            t += 1
        return _ri(STRAW_L, t)
    return px


def low_ridge(c, x0, x1, y, col_hi, col_lo, oni=None):
    """얕은 지붕의 대마루: 윤곽 + 밝은 윗줄 + 한 단 낮은 줄(2px). oni=(밝,어둠) 끝 덩이."""
    c.HL(x0 - 1, y - 3, x1 - x0 + 3, OL)
    c.HL(x0, y - 2, x1 - x0 + 1, col_hi); c.HL(x0, y - 1, x1 - x0 + 1, col_lo)
    c.P(x0 - 1, y - 2, OL); c.P(x0 - 1, y - 1, OL); c.P(x1 + 1, y - 2, OL); c.P(x1 + 1, y - 1, OL)
    if oni:
        for ox in (x0, x1 - 2):
            c.R(ox - 1, y - 5, 5, 3, OL); c.HL(ox, y - 4, 3, oni[0]); c.P(ox + 2, y - 4, oni[1])


def low_eave(c, x0, x1, y, col_lip, col_dark, mouth=None):
    """얕은 지붕 처마 끝(R9): 밝은 입술 한 줄 + 짙은 한 줄(이 줄이 곧 아래 윤곽 — 검은 띠 없이). mouth 면 짙은 줄의 4px 마다 막새 입."""
    c.HL(x0, y, x1 - x0 + 1, col_lip); c.HL(x0 - 1, y + 1, x1 - x0 + 3, col_dark)
    if mouth is not None:
        for x in range(x0, x1 + 1):
            if x % 4 == 0:
                c.P(x, y + 1, mouth)
    c.P(x0 - 1, y, OL); c.P(x1 + 1, y, OL)


def low_kawara(c, ex0, ex1, ytop, yeave, mat, base, hip, taper, wg=6, oni=True):
    """얕은 기와 지붕 한 벌(R9): 대마루 → 고른 면 경사(가로 기와 줄·丸瓦 골, 사다리꼴) → 입술 + 짙은 막새 한 줄. 切妻 면 끝은 흰 破風."""
    edge = None if hip else (lambda x, y, f, side: K('shiro', 1 if side < 0 else -1))
    low_roof(c, ex0, ex1, ytop, yeave, ex0 + taper, ex1 - taper, tile_px(mat, base, ytop), hip=hip, wg=wg, edge=edge)
    low_ridge(c, ex0 + taper, ex1 - taper, ytop, _kt(mat, base + 3), _kt(mat, base + 1),
              oni=(_kt(mat, base + 2), _kt(mat, base - 1)) if oni else None)
    low_eave(c, ex0, ex1, yeave, _kt(mat, base + 1), _kt(mat, base - 2), mouth=_kt(mat, base - 1))


def deep_kawara(c, ex0, ex1, ytop, yeave, mat, base, taper, wg=13, hip=True, glint=None):
    """R10 탑 3/4 기와 지붕: 깊은 윗면(경사 줄 수 = yeave - ytop, 6칸 폭이면 30~36) — 고른 면 + 엇갈린 가로 기와 줄,
    R7 大棟(のし瓦 4줄 + 鬼瓦), 처마는 입술 1줄 + 짙은 1줄(검은 띠 없음). 切妻 면 끝은 흰 破風."""
    edge = None if hip else (lambda x, y, f, side: K('shiro', 1 if side < 0 else -1))
    low_roof(c, ex0, ex1, ytop, yeave, ex0 + taper, ex1 - taper, tile_px(mat, base, ytop), hip=hip, wg=wg, edge=edge)
    _tile_ridge(c, ex0 + taper, ex1 - taper, ytop, mat, base, True, glint)
    low_eave(c, ex0, ex1, yeave, _kt(mat, base + 1), _kt(mat, base - 2), mouth=_kt(mat, base - 1))


# ─────────────── R12 jp_city 지붕 문법 ───────────────
# jp_city 판(#3098)에서 표본을 떠 맞춘 규칙: 실루엣은 모두 #1a1226 1px 윤곽. 기와는 4행 주기(밝음 1 · 중간 2 · 줄눈 1),
# 위 줄 밝고 아래 줄 어둡게, 세로 줄눈 격자 없이 12px 마다 3px 기와 끝 하이라이트만. 귀마루는 선이 아니라 따로 칠한 삼각면
# (위가 넓고 처마 모서리에서 끝난다, 서쪽 한 단 밝게·동쪽 한 단 어둡게). 처마는 립 1행 → 짙은 2행 → 윤곽 → 벽 그림자 1행.
_JP_ROOF: Final[dict] = {
    # 앞면 줄(위 절반, 아래 절반): 단(t) 4행 주기. ridge: 용마루 상자 행들(색), lip/dark: 처마.
    # face: 귀마루 삼각면 세로 줄(서, 동) 4px 주기 단 — さくら駅 표본(서 'b a e b', 동 'c d e e').
    'tairu': dict(ramp=lambda t: K('tairu', max(-3, min(3, t))), up=(2, 1, 1, -1), lo=(1, 0, 0, -2),
                  ridge=(('t', 3), ('t', 2), ('c', K('kinari', 1)), ('t', 1), ('c', K('kinari', -1)), ('t', -2), ('t', -3)),
                  lip=('t', 2), dark=(('t', -1), ('t', -3)), face=((2, 0, 3, 2), (-2, 1, 0, 0)), tick=True, oni=True),
    'kawara': dict(ramp=lambda t: K('kawara', max(-3, min(3, t))), up=(0, -1, -1, -3), lo=(-1, -2, -2, -3),
                   ridge=(('t', 2), ('t', 1), ('c', K('kinari', 1)), ('t', 0), ('c', K('kinari', -1)), ('t', -2), ('t', -3)),
                   lip=('t', 0), dark=(('t', -3), ('t', -3)), face=((0, -2, 1, 0), (-3, 0, -1, -1)),
                   tick=True, oni=True),                                      # R14: 용마루 상자 + 鬼瓦(규칙 5)
    'tin': dict(ramp=lambda t: K('tekko', max(-3, min(3, t))), up=(0,), lo=(0,),
                ridge=(), lip=('c', K('shiro', 1)), dark=(('c', K('shiro', 0)),), tick=False, oni=False),
    # 초가(R13): 띠 사이는 한 단 어두운 짚 1행만(판자 줄눈 #593e39 없음), 짚결은 불규칙 1×2 틱, 처마 립 2행 + 짙은 2행.
    'thatch': dict(ramp=lambda t: J('tatami_straw', max(0, min(4, t))), up=(3, 2, 2, 1), lo=(2, 1, 1, 0),
                   ridge=(), lip=('c', J('tatami_straw', 3)),
                   dark=(('c', J('tatami_straw', 3)), ('c', J('aged_cedar', 1)), ('c', J('aged_cedar', 0))),
                   tick=True, oni=False),
}
_THATCH_SIDE: Final[dict] = {1: (4, 3, 3, 2), -1: (1, 0, 0, 0)}
# 鬼瓦 끝 블록(hiraya_gable 표본 5×6, 단): a=3 c=2 b=1 d=-2, 안쪽 1열은 -3 칸막이.
_ONI: Final[tuple] = ((3, 3, 3, 3, 3), (3, 2, 2, 1, -2), (3, 2, 1, 1, -2), (3, 1, 1, 1, -2), (3, 1, 1, -2, -2), (-2, -2, -2, -2, -2))


def _jp_col(cfg, spec):
    kind, v = spec
    return cfg['ramp'](v) if kind == 't' else v


def _straw_ticks(ex0, ex1, k):
    """초가 띠 k 의 짚결 틱 x → (단 차 +1/−1, 시작 행 0~1, 길이 1~3행): 3~5px 불규칙 간격·행 위치도 제각각(R14 — 줄 맞춘 2행 쌍 금지)."""
    out = {}
    x = ex0 + int(H(k, 0, 71) * 5)
    while x <= ex1:
        r0 = int(H(x, k, 74) * 2)
        n = 1 + int(H(x, k, 78) * 3)
        out[x] = (1 if H(x, k, 72) > 0.5 else -1, r0, min(n, 3 - r0))
        x += 3 + int(H(x, k, 73) * 3)
    return out


def jp_roof(c, ex0, ex1, ytop, ybot, mat, hip=True, inset=None, hw=None, box=None, lo2=None, jk=None, breaks=0):
    """R12/R13 jp_city 문법 지붕. ytop = 윗 윤곽 행, ybot = 처마 밑 윤곽 행(벽은 ybot+1 부터, 그 1행은 벽 그림자).
    inset: 윗변이 처마보다 안으로 들어간 폭(기본 높이×0.28). hw: 위에서 본 귀마루 삼각면 윗변 폭(寄棟만).
    box: 초가·함석 용마루 상자 색 행들(앞면 폭에만). lo2: 마지막 기왓줄 단(더 어둡게). 반환: 앞면 윗변 (xa, xb).
    jk: 4px 줄눈을 넣을 위 줄 수(그 아래 줄은 드문 3px 틱만, さくら駅). breaks: 초가 띠 사이 어두운 줄을 끊는 곳 수.
    R13 기와: 줄마다 몸 2행에 4px 줄눈(몸 −1) + 44px 간격으로 줄마다 엇갈린 3px 틱(몸 +1). 寄棟 끝은 세로 줄 삼각면,
    서쪽 경계 밝은 1px + 앞면 첫 열 짙게, 동쪽 경계 짙은 1px. 용마루 상자 양 끝에 鬼瓦 블록."""
    cfg = _JP_ROOF[mat]
    Hh = ybot - ytop
    ins = round(Hh * 0.28) if inset is None else inset
    hw = (10 if hip else 0) if hw is None else hw
    eave = [cfg['lip']] + list(cfg['dark'])
    y_e0 = ybot - len(eave)                                               # 처마 립 행
    ridge = list(cfg['ridge']) if box is None else [('c', b) for b in box]
    y_c0 = ytop + 1 + len(ridge)                                          # 첫 기왓줄 행
    ncrs = max(1, (y_e0 - y_c0) // 4)
    xa0, xb0 = ex0 + ins, ex1 - ins
    tile = mat in ('tairu', 'kawara')
    straw = {}
    gaps = []                                                             # 초가 띠 줄 끊김 (줄 k, x0, x1)
    for g in range(breaks):
        kg = 1 + (g * 2) % max(1, ncrs - 1)
        gx = round(lerp(xa0 + hw + 4, xb0 - hw - 12, (g + 0.35 + 0.3 * H(g, 3, 75)) / max(1, breaks)))
        gaps.append((kg, gx, gx + 5 + int(H(g, 4, 76) * 4)))
    for y in range(ytop, ybot + 1):
        f = (y - ytop) / max(1, Hh)
        xl = round(lerp(xa0, ex0, f)); xr = round(lerp(xb0, ex1, f))
        if hip:
            bl = round(lerp(xa0 + hw, ex0 + 1, f)); br = round(lerp(xb0 - hw, ex1 - 1, f))
        else:
            bl, br = xl, xr
        if y == ytop or y == ybot:
            c.HL(xl - 1, y, xr - xl + 3, OL)
            continue
        for x in range(xl, xr + 1):
            side = 1 if x < bl else (-1 if x > br else 0)
            if y >= y_e0:                                                 # 처마 립·짙은 행(삼각면 밑까지 한 줄로)
                spec = eave[y - y_e0]
                col = _jp_col(cfg, spec) if spec[0] == 'c' else cfg['ramp'](spec[1] + (side if spec is cfg['lip'] else 0))
            elif y < y_c0 and side == 0:                                  # 용마루 상자
                col = _jp_col(cfg, ridge[y - ytop - 1])
            else:
                k, r = (y - y_c0) // 4, (y - y_c0) % 4
                if y < y_c0:
                    k, r = 0, (y - y_c0) % 4
                lower = k >= (ncrs + 1) // 2
                if mat == 'thatch':
                    seq = _THATCH_SIDE[side] if side else (cfg['lo'] if lower else cfg['up'])
                    t = seq[r]
                    if r == 3 and side == 0 and (any(kg == k and g0 <= x <= g1 for kg, g0, g1 in gaps)
                                                 or H(x // 3, k, 77) > 0.7):
                        t = seq[2]                                        # 띠 사이 줄을 군데군데 끊음(R14: 짧은 끊김도 불규칙하게)
                    if r < 3:
                        if k not in straw:
                            straw[k] = _straw_ticks(ex0, ex1, k)
                        tk = straw[k].get(x)
                        if tk and tk[1] <= r < tk[1] + tk[2]:
                            t += tk[0]                                    # 짚결: 1px × 1~3행 틱, 행 위치 제각각(띠 밝은색 ±1단)
                    col = cfg['ramp'](t)
                elif mat == 'tin':
                    i = x % 4
                    t = (2, 1, 1, 0)[i]
                    if side == 1:
                        t = (2, 2, 1, 1)[i]
                    elif side == -1:
                        t = (0, -1, -1, -2)[i]
                    if (y - y_c0) % 12 == 11:
                        t = -2 if side != 1 else -1                       # 12행마다 판 이음새(R14: 골 무늬를 끊는 짙은 한 행)
                    col = cfg['ramp'](t)
                elif side:                                                # 寄棟 삼각면: 세로 줄 4px + 엇갈린 줄눈
                    st = cfg['face'][0 if side == 1 else 1]
                    t = st[x % 4]
                    if (y - ytop + 2 * (x // 4)) % 4 == 0:
                        t -= 1
                    if side == 1 and x == bl - 1:
                        t = st[2] + 1 if mat == 'kawara' else 3           # 서쪽 귀마루 경계: 밝은 1px
                    if side == -1 and x == br + 1:
                        t = -3                                            # 동쪽 귀마루 경계: 짙은 1px
                    col = cfg['ramp'](t)
                else:
                    seq = cfg['lo'] if lower else cfg['up']
                    if lo2 is not None and k >= ncrs - 1:
                        seq = lo2
                    t = seq[r]
                    if r in (1, 2):
                        u = x - ex0
                        if u % 4 == 3 and (jk is None or k < jk):
                            t -= 1                                        # 4px 줄눈
                        elif u % 4 != 3 and (u // 4 + 3 * k) % 11 == 0:
                            t += 1                                        # 드문 3px 기와 끝(줄마다 엇갈림)
                    if hip and x == bl and r != 0:
                        t = -3                                            # 서쪽 경계 밑 앞면 첫 열 짙게
                    col = cfg['ramp'](t)
            c.P(x, y, col)
        c.P(xl - 1, y, OL); c.P(xr + 1, y, OL)
    if cfg.get('oni') and box is None and len(ridge) >= 6:               # 鬼瓦 끝 블록(용마루 상자 양 끝)
        f1 = 1 / max(1, Hh)                                               # R14: 블록은 곧은 5×6(윗줄 위치에 고정) — 귀마루 사선을 따라 기울지 않는다
        if hip:
            xl0, xr0 = round(lerp(xa0 + hw, ex0 + 1, f1)), round(lerp(xb0 - hw, ex1 - 1, f1))
        else:
            xl0, xr0 = round(lerp(xa0, ex0, f1)), round(lerp(xb0, ex1, f1))
        for j, row in enumerate(_ONI):
            y = ytop + 1 + j
            xl, xr = xl0, xr0
            for i, t in enumerate(row):
                c.P(xl + i, y, cfg['ramp'](t)); c.P(xr - 4 + i, y, cfg['ramp'](t))
            if j:
                c.P(xl + 5, y, cfg['ramp'](-3)); c.P(xr - 5, y, cfg['ramp'](-3))
    return xa0 + hw, xb0 - hw


def _jp_edges(c):
    """R12: 실루엣 가장자리(투명과 맞닿은 불투명 화소)를 모두 #1a1226 윤곽으로."""
    a = c.a
    h, w = a.shape[:2]
    al = a[..., 3] > 0
    ch = []
    for y in range(h):
        for x in range(w):
            if not al[y, x]:
                continue
            if any(not (0 <= y + dy < h and 0 <= x + dx < w) or not al[y + dy, x + dx]
                   for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                ch.append((x, y))
    for x, y in ch:
        c.P(x, y, OL)


def _jp_finish(c, shadow=None):
    """R12 마무리: 윤곽은 jp_city 처럼 #1a1226 그대로(재질색으로 바꾸지 않음), 실루엣 가장자리 전부 윤곽, 그다음 발치 그늘."""
    _jp_edges(c)
    if shadow:
        x0, x1, y0, n = shadow
        ground_shadow(c, x0, x1, y0, n, K('yoru', -1))


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
def _kominka_straw(x, y, ytop, n, face, dirx=0, seed=0):
    """고민가 초가 화소: 경사 따라 길게 흐르는 짚 획(세로, 隅面은 바깥으로 기운 사선). 용마루 쪽 밝고 처마 쪽 어둡다.
    가로 단 없음 — 획마다 길이·시작이 달라 바둑판·벽돌 무늬가 생기지 않는다."""
    yy = y - ytop
    f = yy / max(1, n)
    t = 5 - f * 2.6 + face + (H(x, y // 2, seed + 9) - 0.5) * 0.9         # 용마루 5 → 처마 2.4(경계는 흩어 단 띠가 안 보이게)
    sx = x + (dirx * yy) // 2                                              # 隅面: 획이 바깥 아래로 기운다
    L = 9 + int(H(sx, 0, seed + 2) * 8)                                    # 획 길이 9~16
    seg = (yy + int(H(sx, 1, seed + 3) * L)) // L
    st = H(sx, seg, seed + 4)
    t += -1 if st < 0.3 else (1 if st > 0.8 else 0)
    if H(sx, 5, seed + 5) < 0.22:
        t -= 1                                                             # 다발 사이 가는 어두운 결(길게 이어짐)
    col = _ri(STRAW_R, round(t))
    if n >= 12 and (f > 0.9 or yy < 2) and H(x, y, seed + 6) < 0.3:
        col = _ri(MOSS, round(t) - 1)                                      # 처마 끝·용마루 밑 이끼만
    return col


def _kominka_roof(c, ex0, ex1, ytop, yeave, rl, rr, wg, roll=4):
    """寄棟 초가 윗면(위에서 본 3/4): 앞 경사면(사다리꼴) + 양 끝 隅面 삼각 경사면(왼쪽 한 단·오른쪽 두 단 어둡게,
    隅棟 등은 밝은 둥근 선), 두껍게 부푼 처마(4px: 빛 입술 · 짚 끝 단면 · 밑 그늘) + 그 아래 어두운 처마 밑 그늘 줄."""
    n = yeave - ytop
    for y in range(ytop, yeave):
        f = (y - ytop) / n
        xl = round(lerp(rl, ex0, f)); xr = round(lerp(rr, ex1, f))
        bl = round(lerp(rl, ex0 + wg, f)); br = round(lerp(rr, ex1 - wg, f))
        for x in range(xl, xr + 1):
            if x < bl:
                col = _kominka_straw(x, y, ytop, n, -1.6, -1, seed=0)
            elif x > br:
                col = _kominka_straw(x, y, ytop, n, -2.6, 1, seed=0)
            else:
                col = _kominka_straw(x, y, ytop, n, 0, 0, seed=0)
            if x == bl - 1:
                col = _ri(STRAW_R, 6)                                      # 왼쪽 隅棟: 둥근 등 빛(2px) + 앞면과의 골
            elif x == bl:
                col = _ri(STRAW_R, 5)
            elif x == bl + 1:
                col = _ri(STRAW_R, 1)
            elif x == br:
                col = _ri(STRAW_R, 5 - round(f))
            elif x == br + 1:
                col = _ri(STRAW_OLD, 0)                                    # 오른쪽 隅棟 너머 짙은 골
            c.P(x, y, col)
            continue
        c.P(xl - 1, y, OL); c.P(xr + 1, y, OL)
    # 두툼하게 말린 처마(4~5px 둥근 짚 단면): 지붕과 만나는 골 그늘 → 둥근 등 빛 → 짚 끝 단면(세로 결, 다발마다 아래로
    # 불룩) → 둥근 밑 그늘, 그 아래 짙은 처마 밑 그늘 줄. 양 끝은 둥글게 말려 들어간다.
    # 처마 말림: 짚 획이 그대로 내려와 둥글게 말린다. 다발(4~6px)마다 밑이 둥근 덩이 — 위는 지붕보다 한 단 밝은 등,
    # 가운데 짚 끝 단면(세로 결), 아래로 갈수록 어둡고 다발 사이는 파인 골. 맨 밑은 짙은 그늘 + 처마 밑 그늘 줄.
    x = ex0 - 2
    bundles = []
    k = 0
    while x <= ex1 + 2:
        bw = 4 + int(H(k, 0, 73) * 3)
        bundles.append((x, min(ex1 + 2, x + bw - 1), roll + (1 if H(k, 1, 73) > 0.4 else 0)))
        x += bw
        k += 1
    for bx0, bx1, bh in bundles:
        for x in range(bx0, bx1 + 1):
            e = min(x - (ex0 - 2), ex1 + 2 - x)
            sh = -1 if x > ex1 - (ex1 - ex0) // 6 else (1 if x < ex0 + (ex1 - ex0) // 8 else 0)
            edge = x in (bx0, bx1)                                         # 다발 가장자리: 둥근 밑(1px 짧게) · 파인 골
            cut = 2 if e == 0 else 1 if e == 1 else 0
            hgt = bh - (1 if edge else 0) - 2 * cut
            if 0 <= x < c.w and c.a[yeave - 1, x, 3]:
                c.P(x, yeave - 1, _ri(STRAW_OLD, 2 + max(0, sh)))          # 지붕과 말림 사이 얕은 골
            y0 = yeave + cut
            strand = -1 if H(x, 7, 74) < 0.3 else (1 if H(x, 8, 74) > 0.8 else 0)
            for r in range(hgt):
                fr = r / max(1, hgt - 1)
                v = (5 if fr < 0.25 else 4 if fr < 0.55 else 3 if fr < 0.8 else 2) + sh + (strand if r else 0) - (1 if edge else 0)
                c.P(x, y0 + r, _ri(STRAW_R, v))
            c.P(x, y0 + hgt, _ri(STRAW_OLD, 1 if sh >= 0 else 0))          # 둥근 밑면 그늘
            c.P(x, y0 + hgt + 1, K('yoru', 0))
            c.P(x, y0 + hgt + 2, OL)
            if cut:
                c.P(x, y0 - 1, OL)
    for x in range(ex0, ex1 + 1):                                          # 처마 밑 그늘 줄: 벽 바깥 빈 칸에도 이어지게
        if c.a[yeave + 6, x, 3] == 0:
            c.P(x, yeave + 6, K('yoru', 0))
    c.P(ex0 - 3, yeave + 2, OL); c.P(ex1 + 3, yeave + 2, OL)


def _kominka_ridge(c, bx0, bx1, ytop, low=False):
    """箱棟(윗면 판 + 앞면 짙은 판 + 대나무 누름대) 위에 교차 막대(烏おどし) 다섯 쌍. low 면 낮은 箱棟(윗면 1·앞면 2)과 작은 X(3줄)."""
    if low:
        _kominka_ridge_low(c, bx0, bx1, ytop)
        return
    w = bx1 - bx0 + 1
    top = ytop - 6
    c.R(bx0 - 1, top - 1, w + 2, 8, OL)
    for xx in range(bx0, bx1 + 1):
        lit = 1 if xx < bx0 + w // 3 else (-1 if xx > bx1 - w // 4 else 0)
        c.P(xx, top, K('ita', 3 if lit >= 0 else 2)); c.P(xx, top + 1, K('ita', 2 + min(0, lit)))
        for j in range(4):
            t = 0 + (1 if j == 0 else 0) - (1 if j == 3 else 0) + (lit if j < 2 else 0)
            c.P(xx, top + 2 + j, K('ita', t - (1 if H(xx // 3, j, 28) < 0.2 else 0)))
    for sx in range(bx0 + 3, bx1 - 1, 6):                                  # 대나무 누름대
        c.VL(sx, top + 2, 4, J('pine_bamboo', 3)); c.P(sx, top + 2, J('pine_bamboo', 4))
    n = 5
    for k in range(n):                                                     # 烏おどし: X 자 교차 막대
        sx = round(bx0 + 4 + k * (w - 10) / (n - 1))
        for i in range(5):
            c.P(sx - 2 + i, top - 5 + i, J('aged_cedar', 4 if i < 2 else 3))
            c.P(sx + 2 - i, top - 5 + i, J('aged_cedar', 2))
        c.P(sx - 3, top - 6, OL); c.P(sx + 3, top - 6, OL); c.P(sx - 2, top - 6, OL); c.P(sx + 2, top - 6, OL)


@kit('inaka-kominka-thatched', '초가 고민가(茅葺き古民家) - 이엉 寄棟 지붕·箱棟·흙벽·장지문·툇마루(6×6)', 6, 6, 'building',
     solid=rows(6, [3, 4, 5]), tags=['inaka', '고민가', '초가집', '茅葺き', '古民家'],
     rules='시골 마을 중심 집. 앞(남)에 흙마당 2칸 이상, 뒤에 대숲·삼나무. 현관은 왼쪽 두 번째 칸.', role='building',
     doors=[(1, 5, 1)])
def kominka(c, base):
    _crop_draw(c, 16, _kominka_draw)                                     # 지붕 낮춤 뒤 비는 위 16px 를 버린다(바닥 고정)


def _kominka_draw(c):
    # 6×7(96×112). 지붕 윗면이 화면 대부분, 아래 짧은 벽 띠(현관 18×28). 처마는 벽보다 양쪽 3px 넓다.
    X0, X1 = 8, 87                                                         # 벽
    EX0, EX1 = 4, 91                                                       # 처마(벽보다 바깥)
    RL, RR = 18, 77                                                        # 용마루(짧은 隅面 쐐기)
    YT, YE = 29, 63                                                        # R10 탑 3/4: 이엉 윗면 34줄(지붕이 위 몸통)
    WT, WB = 66, 96                                                        # 단층 벽 띠(30줄)
    W = X1 - X0 + 1
    UW = WT - 6                                                            # R12: 벽 위(처마 윤곽 밑) — 단층 벽 36행
    plaster(c, X0, UW, W, 12, 'kinari', 1)
    _boards_v(c, X0, WT + 8, W, WB - WT - 8, 'aged_cedar', -1, 4, seed=3)
    _hbeam(c, X0, WT + 6, W, 'machiya_timber', 2)
    for px in (X0, 34, 40, 74, X1 - 1):
        post(c, px, UW, WB - UW, 'machiya_timber', 2, 3 if px not in (X0, X1 - 1) else 2)
    # 土間 입구(폭 20 · 높이 28): 반쯤 연 판문 + 어두운 안 + 흙바닥 + 짧은 포렴
    DX0, DX1 = 13, 32
    c.R(DX0 - 1, WT + 1, DX1 - DX0 + 3, WB - WT - 1, OL)
    for yy in range(WT + 2, WB):
        for xx in range(DX0, DX1 + 1):
            if yy >= WB - 5:
                t = 1 + (1 if H(xx, yy, 30) > 0.7 else 0)
                col = J('aged_cedar', t)                                   # 흙바닥(土間)
            else:
                col = J('machiya_timber', 0 if (yy < WT + 9 or xx < DX0 + 3) else 1)
            c.P(xx, yy, col)
    for yy in range(WT + 2, WB):                                           # 오른쪽으로 연 판문(板戸)
        for xx in range(DX1 - 7, DX1 + 1):
            c.P(xx, yy, J('aged_cedar', 3 if xx == DX1 - 7 else 2 if (xx - DX1) % 3 else 1))
    c.HL(DX1 - 7, WT + 2, 8, J('aged_cedar', 4)); c.HL(DX1 - 7, WB - 6, 8, J('aged_cedar', 1))
    noren(c, DX0, WT + 2, DX1 - DX0 - 7, 7, crest=False)                # R14: 문장(글리프) 없음
    c.HL(DX0 - 1, WT + 1, DX1 - DX0 + 3, J('machiya_timber', 3))           # 문 위 인방
    # 장지문 + 툇마루
    shoji(c, 42, WT + 9, 31, WB - WT - 9, panes=3)
    _lattice_win(c, 77, WT + 11, 9, 8)
    c.VL(X0 - 1, UW, WB - UW, OL); c.VL(X1 + 1, UW, WB - UW, OL)
    _shade(c, X0, UW, W, 1, 0.6)                                           # 처마 밑 벽 그림자 1행
    # 지붕(R12 jp 문법): 윤곽 · 箱棟 4행 · 이엉 4행 띠 5줄 · 처마 립+짙은 2 · 윤곽 = 31행
    jp_roof(c, EX0, EX1, 35, UW - 1, 'thatch', hip=True, hw=10, breaks=4,   # R14: 지붕 25행(높이의 약 33%)
            box=(K('ita', 2), K('ita', 0), K('ita', -1), K('ita', -2)))
    stone_base(c, X0, WB, W, 5)
    engawa(c, 40, WB - 4, 48, depth=5, front=3)
    _shade(c, 40, WB + 4, 48, 1, 0.7)
    step_stone(c, 56, WB + 5, 10)
    step_stone(c, 16, WB + 5, 12)
    _jp_finish(c, (X0 + 2, X1 + 5, WB + 6, 4))


# ═══════════════════════════ 2. 기와 농가 ═══════════════════════════
@kit('inaka-kawara-farmhouse', '기와 농가 - 넓은 寄棟 기와 지붕·회벽·격자문·툇마루(6×5)', 6, 5, 'building',
     solid=rows(6, [2, 3, 4]), tags=['inaka', '기와집', '농가', '瓦', '母屋'],
     rules='마을 큰 농가 본채. 앞에 마당·경트럭, 옆에 토장 창고와 헛간.', role='building', doors=[(1, 4, 1)])
def farmhouse(c, base):
    _crop_draw(c, 32, _farmhouse_draw)                                   # 지붕 낮춤 뒤 비는 위 32px 를 버린다(바닥 고정)


def _farmhouse_draw(c):
    # R12 jp_city 문법: 寄棟 기와 지붕 28행(윤곽·용마루 상자 7·기왓줄 4줄×4·처마 립+짙은 2·윤곽) 아래 단층 벽 36행.
    D = 32
    c0, c = c, _below(c, D)
    X0, X1 = 7, 88
    W = X1 - X0 + 1
    Y1, YF = 35, 71                                                        # 벽 위(처마 윤곽 밑) · 바닥
    plaster(c, X0, Y1, W, 12, 'shiro', 1)                                  # 위 회벽 띠(높은 창)
    for wx in (30, 52):
        _lattice_win(c, wx, Y1 + 3, 14, 5)
    _boards_h(c, X0, Y1 + 13, W, YF - Y1 - 13, 'ita', -1, 4, 12, seed=7)
    _hbeam(c, X0, Y1 + 12, W, 'machiya_timber', 2)
    for px in (X0, 36, 72, X1 - 1):
        post(c, px, Y1, YF - Y1, 'machiya_timber', 2)
    _koshido(c, 12, Y1 + 14, 20, YF - Y1 - 14)                            # 현관 격자 미닫이
    shoji(c, 40, Y1 + 16, 30, YF - Y1 - 16, panes=3)
    _lattice_win(c, 75, Y1 + 18, 10, 6)
    c.VL(X0 - 1, Y1, YF - Y1, OL); c.VL(X1 + 1, Y1, YF - Y1, OL)
    _shade(c, X0, Y1, W, 1, 0.6)                                           # 처마 밑 벽 그림자 1행
    jp_roof(c0, 3, 92, 11 + D, 34 + D, 'tairu', hip=True, hw=10, jk=2)    # R14: 24행(약 33%), 줄눈은 위 2줄만
    stone_base(c, X0, YF, W, 4)
    engawa(c, 38, YF - 3, 34, depth=4, front=3)
    _shade(c, 38, YF + 4, 34, 1, 0.7)
    step_stone(c, 50, YF + 5, 10)
    step_stone(c, 17, YF + 5, 10)
    _jp_finish(c0, (X0 + 2, X1 + 5, YF + 5 + D, 3))


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
def namako(c, x, y, w, h, p=6):
    """海鼠壁(R9): 45° 로 돌린 네모 평기와(짙은 돌빛 4b4943) 격자 — 1px 흰 회반죽 줄눈(f6f1fc) 두 사선,
    줄눈 오른쪽 아래로 1px 그늘, 왼쪽 위로 1px 빛. 기와마다 같은 톤(잡점 없음)."""
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            u, v = (xx + yy) % p, (xx - yy) % p
            if u == 0 or v == 0:
                col = K('shiro', 2)
            elif u == 1 or v == 1:
                col = K('tekko', -2)                                       # 줄눈이 기와에 던지는 그늘(오른쪽 아래)
            elif u == p - 1 or v == p - 1:
                col = J('shrine_flagstone', 1)                             # 줄눈 앞 기와 끝 빛(왼쪽 위)
            else:
                col = J('shrine_flagstone', 0)
            c.P(xx, yy, col)
    c.HL(x, y, w, K('shiro', 1)); c.HL(x, y + h - 1, w, K('shiro', -1))


def _kura_plaster(c, x, y, w, h):
    """토장 흰 회벽(R9): 고른 흰 면 + 드문 반점(옛 얼룩의 4할), 회색은 맨 아래 2줄(기단 쪽)만. 왼쪽 빛·오른쪽 그늘 1px."""
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            t = 1
            gx, gy = (xx - x) // 6, (yy - y) // 6                          # 6×6 칸마다 1px 반점 하나(위치 해시)
            if (xx - x) % 6 == int(H(gx, gy, 27) * 6) and (yy - y) % 6 == int(H(gx, gy, 29) * 6):
                t += -1 if H(gx, gy, 30) < 0.7 else 1
            if yy >= y + h - 2 and H(xx, yy, 28) < (0.5 if yy == y + h - 1 else 0.25):
                t -= 1
            c.P(xx, yy, K('shiro', t))
    c.VL(x, y, h, K('shiro', 2)); c.VL(x + w - 1, y, h, K('shiro', 0))


@kit('inaka-kura-storehouse', '토장 창고(土蔵) - 검은 기와 切妻·흰 회벽·海鼠壁·観音扉(4×5)', 4, 5, 'building',
     solid=rows(4, [3, 4]), tags=['inaka', '토장', '창고', '蔵', '海鼠壁'],
     rules='농가 본채 옆·뒤. 앞에 돌계단 칸을 비운다.', role='building', doors=[(1, 4, 2)])
def kura(c, base):
    # 지붕 몫 ≈25%: 낮은 切妻 기와 띠(대마루·鬼瓦 + 경사 9줄 + 막새) 아래 높은 흰 회벽 2층 몸채.
    X0, X1 = 6, 57
    W = X1 - X0 + 1
    YW = 33                                                                # R10 탑 3/4: 벽 위(처마 바로 밑) — 단층 높이 34줄
    _kura_plaster(c, X0, YW, W, 56 - YW)
    namako(c, X0, 56, W, 11)
    c.VL(X0, YW, 67 - YW, K('shiro', 2)); c.VL(X1, YW + 3, 56 - YW - 3, K('shiro', -1))
    c.VL(X0 - 1, YW, 67 - YW, OL); c.VL(X1 + 1, YW, 67 - YW, OL)
    # 창(철 덧문 + 회반죽 턱) 둘 — 문 양옆
    for wx in (10, 45):
        c.R(wx, 39, 9, 8, K('shiro', 2)); c.VL(wx + 8, 39, 8, K('shiro', -1))
        c.R(wx + 1, 40, 7, 6, K('tekko', -2))
        for gx in (wx + 2, wx + 4, wx + 6):
            c.VL(gx, 40, 6, K('tekko', 2)); c.P(gx, 40, K('tekko', 3))
        c.HL(wx, 46, 9, K('shiro', 2)); c.HL(wx, 47, 9, K('shiro', -2)); c.VL(wx - 1, 39, 8, OL)
    # 観音扉: 계단식 두꺼운 회반죽 문틀(3단, 왼쪽 위 빛) + 닫힌 두 짝(철판 줄·징) — 높이 29
    dx, dy, dw, dh = 22, 38, 20, 29
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
    for hy in (dy + 8, dy + 18):
        for hx in (dx + dw // 2 - 3, dx + dw // 2 + 2):
            c.P(hx, hy, K('kii', 2)); c.P(hx + 1, hy, K('kii', 0)); c.P(hx, hy + 1, K('kii', 0)); c.P(hx + 1, hy + 1, K('kii', -1))
    for sy in range(dy + 5, dy + dh, 4):
        c.P(dx + 5, sy, K('tekko', 2)); c.P(dx + dw - 6, sy, K('tekko', 1))
    c.VL(dx - 1, dy, dh, OL)
    _shade(c, dx + dw - 2, dy + 2, 2, dh - 2, 0.75)
    _shade(c, X0, YW, W, 1, 0.6)                                           # 처마 밑 벽 그림자 1행
    jp_roof(c, 3, 60, 9, YW - 1, 'tairu', hip=False, inset=0, jk=2)      # R14: 切妻는 jp hiraya_gable 처럼 곧은 네모 윤곽                      # R12 jp 문법 切妻 24행
    # 기단 + 돌계단(윗면·챌면)
    plinth_34(c, 3, 67, 58, 7, top_h=2, mat='shrine_flagstone')
    stones(c, 4, 70, 56, 3, 'shrine_flagstone', seed=9, course=(3, 3), width=(6, 11), moss=0.25)
    _step_block(c, 20, 72, 24, 5)
    _step_block(c, 18, 75, 28, 5)
    _jp_finish(c, (6, 63, 74, 6))


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
    # 지붕 몫 ≈25%: 얕은 切妻 띠 아래 2층 판벽(격자창 둘) + 1층 간판·차양·가게 앞
    YW = 52                                                                # R10 탑 3/4 단층 가게: 벽 위(c0, 처마 바로 밑) — 간판 띠만
    _boards_h(c0, X0, YW, W, 21 + D + 12 - YW, 'ita', 0, 4, 10, seed=11)
    c0.VL(X0 - 1, YW, 21 + D + 12 - YW, OL); c0.VL(X1 + 1, YW, 21 + D + 12 - YW, OL)
    _shade(c0, X0, YW, W, 1, 0.6)                                         # 처마 밑 벽 그림자 1행
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
    _shade(c, sx0 + 1, sy0 + sh + 1, sw, 1, 0.7); _shade(c, sx0 + sw + 1, sy0 + 1, 1, sh + 1, 0.7)   # 간판 그늘(아래·오른쪽 1px)
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
    # 줄무늬 차양(R9): 윗 가장자리 빛 1줄 + 고른 윗면 4줄(붉은 db4d4a · 누그러진 흰 cac7d6, 사다리꼴) + 앞 주름 2줄(5px 마다 반원)
    for y in range(32, 37):
        ins = round((36 - y) * 1.0)                                        # 벽 쪽 좁고 앞으로 벌어짐
        c.P(X0 - 3 + ins, y, OL); c.P(X1 + 3 - ins, y, OL)
        for x in range(X0 - 2 + ins, X1 + 3 - ins):
            band = ((x - X0) // 5) % 2
            t = 2 if y == 32 else 1                                        # 윗 가장자리 한 줄 빛, 나머지 고른 면
            if (x - X0) % 5 == 4 and y > 32:
                t -= 1                                                     # 줄 사이 솔기
            if x > X1 - 6:
                t -= 1
            c.P(x, y, K('aka', t) if band == 0 else K('shiro', t))
    for x in range(X0 - 2, X1 + 3):                                        # 앞 주름(valance): 5px 마다 반원 끝
        band = ((x - X0) // 5) % 2
        i = (x - X0) % 5
        c.P(x, 37, K('aka', 0) if band == 0 else K('shiro', 0))
        c.P(x, 38, K('aka', 0) if band == 0 else K('shiro', 0))
        if i in (1, 2, 3):
            c.P(x, 39, K('aka', -1) if band == 0 else K('shiro', -1))
    c.VL(X0 - 3, 37, 2, OL); c.VL(X1 + 3, 37, 2, OL)
    c.HL(X0, 31, X1 - X0 + 1, OL)                                          # 벽과 차양 사이 1px 짙은 솔기
    for x in range(X0, X1 + 1):                                            # 주름 밑 그늘 2줄(풀림)
        y0 = 40 if (x - X0) % 5 in (1, 2, 3) else 39
        _shade(c, x, y0, 1, 1, 0.6)
        _shade(c, x, y0 + 1, 1, 1, 0.78)
        if (x + y0) % 2 == 0:
            _shade(c, x, y0 + 2, 1, 1, 0.88)
    # 둥근 법랑 간판(기둥에)
    disc(c, 4, 46, 3.6, OL); disc(c, 4, 46, 2.6, K('sora', 1)); c.P(3, 45, K('shiro', 2)); c.P(4, 46, K('shiro', 1)); c.P(5, 47, K('sora', -1))
    jp_roof(c0, 2, 77, 28, 51, 'tairu', hip=False, lo2=(0, -1, -1, -2), inset=0, jk=2)   # R14 切妻 네모 윤곽                       # R12 jp 문법 切妻 24행
    stone_base(c, X0, YF, W, 4)
    _jp_finish(c0, (X0 + 2, X1 + 4, YF + 4 + D, 3))


# ═══════════════════════════ 5. 목조 간이역 ═══════════════════════════
@kit('inaka-wooden-station', '목조 간이역(木造駅舎) - 기와 寄棟(용마루 상자·鬼瓦)·흰 함석 차양·개찰·역명판·승강장 기단(7×6)', 7, 6, 'building',
     solid=rows(7, [3, 4, 5]), tags=['inaka', '간이역', '목조역', '駅舎', '無人駅'],
     rules='선로(jp-rail-h) 바로 남쪽 또는 북쪽에 승강장 끝(jp-platform-edge)과 나란히 둔다. 개찰구는 가운데 두 칸.',
     role='building', doors=[(3, 5, 2)])
def station(c, base):
    # 지붕 몫 ≈25%: 얕은 寄棟 기와 띠(짧은 隅面) + 가운데 작은 시계 박공 아래 높은 판벽(높은 창·개찰 입구·역명판).
    D = 32
    c0, c = c, _below(c, D)
    X0, X1 = 7, 104
    YW, YF = 5, 49                                                         # 벽 위(처마 바로 밑, c 좌표) · 승강장
    W = X1 - X0 + 1
    _boards_h(c, X0, YW, W, YF - YW, 'lino', 1, 3, 14, seed=13)            # 페인트 칠한 下見板(옅은 녹색)
    for yy in range(YF - 6, YF):                                          # 허리 판(짙은 갈색)
        for xx in range(X0, X1 + 1):
            c.P(xx, yy, J('aged_cedar', 2 + (1 if yy == YF - 6 else 0) - (1 if (xx % 6 == 0) else 0) - (1 if yy == YF - 1 else 0)))
    _hbeam(c, X0, YW + 9, W, 'aged_cedar', 2)                             # 欄間 띠
    for px in (X0, 42, 70, X1 - 1):
        post(c, px, YW, YF - YW, 'aged_cedar', 2)
    for wx in (14, 76):
        sash(c, wx, YW + 19, 22, 18, 'lino', 1, shutter=False)             # 큰 미닫이 창(차양 밑)
    # 가운데 개찰 입구(R9): 안쪽 대합실 뒷벽(판 이음·시간표) + 바닥 2줄 + 왼쪽 문설주 빛 + 나무 개찰 울
    EY = YW + 19                                                           # R10: 입구 위 = 차양 밑
    for yy in range(EY, YF):
        for xx in range(45, 69):
            if yy >= YF - 9:
                seg = (xx + (yy - YF) * 2) // 7
                t = 3 if yy <= YF - 8 else 2
                if H(seg, yy // 2, 35) < 0.3:
                    t -= 1
                c.P(xx, yy, J('paving_stone', t))                          # 대합실 바닥(밝은 판석)
                continue
            t = 1 if yy > EY + 2 else 0                                    # 뒷벽: 문 인방 밑 그늘 → 판벽
            if (xx - 45) % 6 == 0:
                t -= 1
            elif H(xx // 6, yy // 3, 36) < 0.12:
                t -= 1
            c.P(xx, yy, K('ita', t + (1 if xx < 52 else 0)))
    c.HL(45, YF - 10, 24, K('ita', -1))                                    # 벽과 바닥이 만나는 그늘
    c.R(53, EY + 4, 13, 9, K('ita', -2))                                   # 시간표(칠판 + 줄마다 흰·붉은 칸)
    c.R(54, EY + 5, 11, 7, K('kokuban', 0)); c.HL(54, EY + 5, 11, K('kokuban', 1))
    for j, yy in enumerate(range(EY + 6, EY + 11, 2)):
        for xx in range(55, 64, 2):
            c.P(xx, yy, K('shiro', 2) if (xx + j) % 6 else K('aka', 1))
    c.VL(45, EY, YF - EY - 9, J('aged_cedar', 4)); c.VL(46, EY, YF - EY - 9, J('aged_cedar', 3))   # 왼쪽 문설주(빛)
    c.VL(67, EY, YF - EY - 9, K('ita', -1)); c.VL(68, EY, YF - EY - 9, K('ita', -2))               # 오른쪽 안 벽 그늘
    for gx in (49, 56, 63):
        rect_3d(c, gx, 40, 4, 9, 2, 'aged_cedar', top_t=4, front_t=2)
    _hbeam(c, 46, 42, 22, 'aged_cedar', 3, 1)
    c.VL(44, EY, YF - EY, OL)
    # 시간표판(오른쪽 벽 끝): 칠판 + 색 칸(글자 없음)
    c.R(99, 26, 5, 14, OL); c.R(100, 27, 3, 12, K('kokuban', 0)); c.VL(100, 27, 12, K('kokuban', 1))
    for yy, col in ((29, K('shiro', 1)), (30, K('aka', 1)), (33, K('shiro', 0)), (36, K('sora', 1))):
        c.P(101, yy, col); c.P(102, yy, _dim(col, 0.8))
    # 역명판(입구 위): 흰 판 + 남색 띠 + 붉은 점(노선색) — 글자 없음
    EY2 = EY + 4                                                           # 역명판은 차양 밑에 매단다
    c.R(44, EY2 - 7, 26, 6, OL)
    for yy in range(EY2 - 6, EY2 - 2):
        for xx in range(45, 69):
            t = 2 if yy == EY2 - 6 else 1
            if xx > 64:
                t -= 1
            c.P(xx, yy, K('shiro', t))
    c.HL(45, EY2 - 3, 24, K('kon', 0)); c.HL(45, EY2 - 4, 24, K('kon', 1))
    c.R(48, EY2 - 5, 3, 1, K('aka', 1)); c.R(63, EY2 - 5, 3, 1, K('aka', 0))
    # 승강장 차양(R9b): 본 지붕 처마 밑 벽 4줄을 띄우고 c0 41~45 에 밝은 아연 함석(차가운 흰빛, 기와와 다른 색) 윗면 4줄 + 입술,
    # 기둥 넷(2px 밝은 나무 + 그늘 1px)과 까치발이 승강장까지 — 지붕 한 단이 아니라 차양으로 읽히게.
    _shade(c0, X0, 45, W, 1, 0.6)                                         # 처마 밑 벽 그림자 1행
    CT, CL, CX0, CX1 = 49, 53, 7, 104                                      # R14: 벽선과 맞춘 차양 띠(떠 보이지 않게)
    _shade(c0, X0, CL + 2, W, 1, 0.6)                                     # R14: 차양 밑 벽 그늘 1행(지붕 문법 3)
    for px in (8, 42, 70, 102):
        for yy in range(CL + 3, YF + D):                                   # R14: 차양 윤곽 밑 1행은 벽 그늘(기둥은 그 아래부터)
            c0.P(px, yy, J('aged_cedar', 4 if yy < YF + D - 2 else 3)); c0.P(px + 1, yy, J('aged_cedar', 3 if yy < YF + D - 2 else 2))
            c0.P(px + 2, yy, J('machiya_timber', 3))
        c0.P(px - 1, CL + 2, OL)
        for k in range(3):                                                 # 까치발(기둥 → 차양 밑)
            if px > CX0 + 4:
                c0.P(px - 1 - k, CL + 4 - k, J('aged_cedar', 3))
            if px < CX1 - 4:
                c0.P(px + 3 + k, CL + 4 - k, J('aged_cedar', 2))
    for yy in range(CT, CL):
        for xx in range(CX0, CX1 + 1):
            i = xx % 4
            t = 1 + (1 if i == 0 else -1 if i == 3 else 0) + (1 if yy == CT else 0)
            c0.P(xx, yy, T('vending_cool_white', t) if yy < CL - 1 else K('shiro', 1))   # R14: 마지막 행 = 흰 끝
    c0.HL(CX0, CL, CX1 - CX0 + 1, K('shiro', 0)); c0.HL(CX0 - 1, CL + 1, CX1 - CX0 + 3, OL)   # R14: 차양 처마 = 흰 끝 1행 → 윤곽(그 밑 벽 그늘)
    c0.HL(CX0 - 1, CT - 1, CX1 - CX0 + 3, K('conc', -1)); c0.VL(CX0 - 1, CT, CL - CT + 1, OL); c0.VL(CX1 + 1, CT, CL - CT + 1, OL)
    # 지붕(테라코타 기와 寄棟, 얕은 띠) + 가운데 시계 박공(破風이 처마선을 넘어 y38 까지)
    jp_roof(c0, 3, 108, 21, 44, 'kawara', hip=True, hw=12, jk=2)   # R14: 용마루 상자 7 + 기왓줄 정확히 3줄(잘린 줄 없음)               # R12 jp 문법(さくら駅 결) 26행   # R10 寄棟 윗면 36줄(7칸 폭)
    # R14: 시계 박공은 뺐다(독립 검수: 제 지붕 없는 박공은 지붕 문법 위반). 지붕은 용마루 상자·鬼瓦·4행 기왓줄만.
    # 승강장(판석 윗면 8줄 + 점자 띠 + 앞면 3줄)
    PT = 8
    c.R(1, YF, 110, PT + 5, OL)
    for xx in range(2, 109):
        for yy in range(YF + 1, YF + 1 + PT):
            if yy == YF + PT - 1:
                c.P(xx, yy, K('kii', 2 if xx % 2 else 1))                 # 점자 블록 띠
                continue
            seg = (xx + (yy - YF) * 3) // 11
            t = 3 + (1 if yy == YF + 1 else 0) - (1 if H(seg, yy, 37) < 0.25 else 0)
            if (xx + (yy - YF) * 3) % 11 == 0:
                t = 2
            c.P(xx, yy, J('paving_stone', t))
        for yy in range(YF + 1 + PT, YF + 4 + PT):
            t = 2 - (1 if yy == YF + 3 + PT else 0)
            if (xx + 5 * (yy // 4)) % 12 == 0:
                t -= 1
            c.P(xx, yy, J('paving_stone', t))
    c.VL(1, YF + 1, PT + 3, J('paving_stone', 0)); c.VL(110, YF + 1, PT + 3, J('paving_stone', 0)); c.HL(1, YF + PT + 4, 110, J('paving_stone', 0))
    _shade(c, X0, YF + 1, W, 1, 0.8)
    for px in (8, 42, 70, 102):                                            # 기둥 발치 그늘
        c.P(px + 2, YF + 1, _dim(_key(c, px + 2, YF + 1), 0.7)); c.P(px + 3, YF + 1, _dim(_key(c, px + 3, YF + 1), 0.8))
    _jp_finish(c0)


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
        _boards_v(c, 4, 15, 30, 20, 'aged_cedar', 0, 4, seed=15)
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
        # 벤치: 넓은 앉는 판 윗면(6px, 길이 방향 판 세 장) + 얇은 앞 띠 + 다리
        rect_3d(c, 4, 23, 30, 11, 7, 'aged_cedar', top_t=4, front_t=1)
        for yy in range(24, 31):                                           # 앉는 판 윗면: 밝은 생나무 판 셋(가로 이음 2줄)
            for xx in range(5, 33):
                t = 2 if yy in (24, 25) else (0 if yy in (27, 29) else 1)
                if t >= 0 and H(xx, yy, 61) < 0.1:
                    t -= 1
                c.P(xx, yy, K('kinari', t))
        for lx in (8, 28):
            c.R(lx, 34, 2, 3, J('machiya_timber', 1)); c.P(lx, 34, J('machiya_timber', 3))
        _shade(c, 5, 34, 29, 2, 0.5)                                       # 앉는 판 밑 짙은 그늘
        # 기둥
        post(c, 3, 13, 21, 'aged_cedar', 3, 3); post(c, 32, 13, 21, 'aged_cedar', 3, 3)
        # 둥근 버스 정류장 표지(파랑 테 + 흰 판 + 붉은 띠) + 기둥 + 콘크리트 받침
        c.R(42, 12, 2, 30, K('tekko', 2)); c.VL(42, 12, 30, K('tekko', 3)); c.VL(41, 12, 30, OL); c.VL(44, 12, 30, OL)
        for yy in range(14, 42, 5):
            c.P(43, yy, K('tekko', 0))
        # 둥근 표지판: 살짝 눌린 타원 + 위 가장자리 두께(밝은 테 초승달, 아래로 판 옆면 한 줄)
        disc(c, 42.5, 8, 5.8, OL, ry=5.2)
        disc(c, 42.5, 7.6, 4.8, K('tekko', 3), ry=4.0)                     # 판 윗 가장자리(빛 받는 두께)
        disc(c, 42.5, 8.8, 4.8, K('tekko', 1), ry=4.0)                     # 판 아래 옆면
        disc(c, 42.5, 8.4, 4.6, K('sora', 0), ry=3.7); disc(c, 42, 8.0, 3.6, K('sora', 1), ry=2.9)
        disc(c, 42.5, 8.4, 3.0, K('shiro', 2), ry=2.4); disc(c, 43.2, 9.0, 1.8, K('shiro', 1), ry=1.4)
        c.HL(40, 8, 6, K('sora', 0)); c.P(41, 6, K('aka', 1)); c.P(42, 6, K('aka', 1))
        c.HL(39, 4, 7, K('tekko', 3)); c.P(42, 4, K('conc', 3))           # 윗 테 하이라이트
        c.R(40, 18, 6, 7, K('shiro', 2)); c.VL(45, 18, 7, K('shiro', 0)); c.HL(40, 18, 6, K('sora', 1))
        c.R(41, 20, 2, 2, K('kii', 1)); c.R(41, 22, 4, 1, K('sora', 0))
        c.R(39, 17, 8, 1, OL); c.VL(39, 18, 7, OL); c.VL(46, 18, 7, OL); c.HL(39, 25, 8, OL)
        disc(c, 42.5, 43, 4.2, OL, ry=2.6); disc(c, 42.5, 43, 3.2, K('conc', 1), ry=1.6); c.HL(41, 42, 3, K('conc', 3)); c.P(44, 44, K('conc', -1))
    # 지붕 몫 ≈25%: 높은 판자 뒷벽(위로 늘림)·기둥 + 얕은 片流れ 함석 띠(뒤 높고 앞 낮게, 위 밝게) + 앞 처마 판 + 깊은 처마 그늘
    _boards_v(c, 4, 14, 30, D + 1, 'aged_cedar', 0, 4, seed=16)
    c.VL(3, 14, D + 21, OL); c.VL(34, 14, D + 21, OL)
    c.R(8, 20, 8, 6, J('aged_cedar', 0)); c.R(9, 21, 6, 4, K('shiro', 1)); c.HL(9, 21, 6, K('kii', 1)); c.P(10, 23, K('sora', 0)); c.P(12, 23, K('aka', 0))
    front(_shift(c, D))
    post(c, 3, 13, D + 21, 'aged_cedar', 3, 3); post(c, 32, 13, D + 21, 'aged_cedar', 3, 3)   # 밝은 3px 옆 기둥(열린 대합실)
    _shade(c, 4, 22, 30, 1, 0.6)                                           # 처마 밑 그림자 1행
    jp_roof(c, 1, 36, 2, 21, 'tin', hip=True, hw=6)                        # R12 jp 함석: 골 4px · 12행 이음새 · 흰 립 2행 · 윤곽
    _jp_finish(c)
    ground_shadow(c, 3, 47, 42 + D, 4, K('tairu', -2))             # 차가운 남색 그늘(무채색 근흑 대신)


# ═══════════════════════════ 7. 물레방아간 ═══════════════════════════
@kit('inaka-waterwheel-mill', '물레방아간(水車小屋) - 초가 오두막·筧 물길·나무 물레·돌 물받이(4×4)', 4, 4, 'building',
     solid=rows(4, [2, 3]), tags=['inaka', '물레방아', '水車', '물레방아간'],
     rules='개울·수로 가장자리에 둔다(오른쪽 아래 물받이가 물에 닿는다).', role='building', doors=[(1, 3, 1)])
def waterwheel_mill(c, base):
    _crop_draw(c, 16, _waterwheel_mill_draw)                             # 지붕 낮춤 뒤 비는 위 16px 를 버린다(바닥 고정)


def _waterwheel_mill_draw(c):
    D = 16
    c0, c = c, _below(c, D)
    # 오두막 벽(세로 판) + 문
    # 지붕 몫 ≈25%: 얕은 초가 띠 아래 높은 판벽 오두막(문 높이 26)
    _boards_v(c, 6, 21, 28, 30, 'aged_cedar', 0, 4, seed=17)
    for yy in range(28, 51):                                               # 열린 문 안(R9): 뒷벽 3px 판 번갈아 + 흙바닥 + 문 위 그늘
        for xx in range(13, 23):
            if yy >= 46:
                c.P(xx, yy, J('aged_cedar', 2 if yy == 46 else (3 if H(xx, yy, 41) > 0.7 else 2) - (1 if yy == 50 else 0)))
                continue
            t = 1 if ((xx - 13) // 3) % 2 == 0 else 0
            if yy < 31:
                t = 0
            c.P(xx, yy, J('aged_cedar', t))
    c.VL(13, 28, 18, J('aged_cedar', 3))
    _hbeam(c, 12, 27, 12, 'machiya_timber', 3, 1)
    c.VL(12, 28, 23, OL)
    for (sx, sy) in ((16, 46), (18, 47), (17, 48), (20, 48)):                # 안쪽 쌀겨 자루
        c.P(sx, sy, J('cream_stucco', 2)); c.P(sx + 1, sy, J('cream_stucco', 1))
    _shade(c, 6, 26, 28, 1, 0.6)                                           # 처마 밑 벽 그림자 1행
    c.VL(5, 21, 30, OL); c.VL(34, 21, 30, OL)
    jp_roof(c0, 0, 40, 7 + D, 25 + D, 'thatch', hip=True, hw=6,   # R14: 2행 줄여 약 33%          # R12 jp 문법 초가 21행(箱棟 4 · 띠 3줄)
            box=(K('ita', 2), K('ita', 0), K('ita', -1), K('ita', -2)))
    stone_base(c, 4, 51, 32, 4)
    # 돌 물받이(윗면에 물 + 앞면 돌, 젖은 아래쪽)
    c.R(36, 49, 27, 14, OL)
    stones(c, 37, 54, 25, 8, 'shrine_flagstone', seed=3, course=(4, 4), width=(6, 9), moss=0.35)
    _shade(c, 37, 59, 25, 3, 0.8, dither=True)
    for yy in range(50, 54):                                               # 뒤 턱 윗면 2줄(빛) + 물 윗면 2줄
        for xx in range(37, 62):
            t = 0 if yy > 52 else 1
            if H(xx // 3, yy, 42) > 0.82:
                t = 2
            c.P(xx, yy, K('sora', t) if yy > 51 else J('shrine_flagstone', 4 if yy == 50 else 3))
    c.HL(37, 54, 25, J('shrine_flagstone', 4)); c.HL(37, 55, 25, J('shrine_flagstone', 2))   # 앞 턱 윗면(두께)
    for yy in range(50, 54):
        c.P(37, yy, J('shrine_flagstone', 4)); c.P(61, yy, J('shrine_flagstone', 2))           # 양 턱 윗면
    for (wx, wy, ww) in ((38, 52, 5), (48, 51, 4), (55, 52, 4)):
        c.HL(wx, wy, ww, K('sora', 2)); c.P(wx + ww, wy, K('shiro', 2))
    # 물레(R9): 정면에서 본 바퀴(타원 17×22) — 짙은 테 두께 · 8 바퀴살 · 축통 · 테 밖 날개 끝(왼쪽 위 빛, 오른쪽 아래 그늘).
    # 살 사이로는 바퀴 뒤 그늘이 보인다. 아래 끝은 물받이 물에 잠긴다.
    WX, WY, RX, RY = 49.5, 40.0, 8.6, 10.8
    for y in range(26, 52):                                                # 날개 8개: 바퀴살 끝마다 2px 폭 · 테 밖 2px, 날개마다 한 색
        for x in range(38, 62):
            u, v = (x + 0.5 - WX) / RX, (y + 0.5 - WY) / RY
            r = math.hypot(u, v)
            if not (1.0 < r <= 1.24):
                continue
            ang = math.atan2(v, u)
            k = ((ang - 0.2) / (2 * math.pi) * 8) % 1.0
            if min(k, 1 - k) > 0.13:
                continue
            ph = 0.2 + 2 * math.pi * round((ang - 0.2) / (2 * math.pi) * 8) / 8
            lit = -(math.cos(ph) + math.sin(ph)) * 0.7
            c.P(x, y, J('aged_cedar', 4 if lit > 0.3 else 3 if lit > -0.3 else 1))
    for y in range(26, 52):
        for x in range(38, 62):
            u, v = (x + 0.5 - WX) / RX, (y + 0.5 - WY) / RY
            r = math.hypot(u, v)
            if r > 1.0:
                continue
            lit = -(u + v) / max(r, 1e-6) * 0.7                            # 왼쪽 위 +, 오른쪽 아래 −
            if r > 0.84:
                col = J('aged_cedar', 4 if lit > 0.35 else 3 if lit > -0.35 else 2)   # 깨끗한 바깥 테(세 단)
            elif r > 0.72:
                col = J('machiya_timber', 3)                               # 테 안쪽 두께(한 색)
            else:
                col = K('yoru', 0)                                         # 살 사이: 바퀴 뒤 그늘(한 색)
            c.P(x, y, col)
    for k in range(8):                                                     # 바퀴살 8개(축 → 테 안쪽)
        ph = 2 * math.pi * k / 8 + 0.2
        cu, sv = math.cos(ph), math.sin(ph)
        lit = -(cu + sv) * 0.7
        line(c, round(WX - 0.5 + cu * RX * 0.18), round(WY - 0.5 + sv * RY * 0.18),
             round(WX - 0.5 + cu * RX * 0.74), round(WY - 0.5 + sv * RY * 0.74), J('aged_cedar', 3 if lit > -0.3 else 2))
    disc(c, WX - 0.5, WY - 0.5, 2.0, J('machiya_timber', 3))              # 축통
    disc(c, WX - 0.5, WY - 0.5, 1.2, J('aged_cedar', 4))                  # 축 머리
    c.P(round(WX), round(WY), J('machiya_timber', 2))
    ay = round(WY)                                                         # 축: 오두막 벽에서 바퀴로
    c.R(34, ay - 1, 6, 3, OL); c.HL(35, ay, 5, K('tekko', 3)); c.HL(35, ay + 1, 5, K('tekko', 1))
    c.R(33, ay - 3, 3, 7, J('machiya_timber', 1)); c.VL(33, ay - 3, 7, J('machiya_timber', 3))
    # 筧(나무 물길, 남북): 북쪽에서 바퀴 오른쪽 위 날개로 곧게 오는 열린 홈통, 남쪽 끝면(2px)
    FX0, FX1 = 48, 57
    for y in range(9, 26):                                                 # R14: 물길이 지붕 윗변보다 높이 솟지 않게(지붕 몫 ≈33%)
        c.P(FX0 - 1, y, OL); c.P(FX1 + 1, y, OL)
        c.P(FX0, y, J('aged_cedar', 4)); c.P(FX0 + 1, y, J('aged_cedar', 3)); c.P(FX0 + 2, y, J('aged_cedar', 1))
        for x in range(FX0 + 3, FX1 - 2):
            c.P(x, y, K('shiro', 2) if (x + y // 3) % 4 == 0 else K('sora', 2 if x < FX1 - 4 else 1))
        c.P(FX1 - 2, y, J('aged_cedar', 2)); c.P(FX1 - 1, y, J('aged_cedar', 3)); c.P(FX1, y, J('aged_cedar', 2))
    for x in range(FX0, FX1 + 1):
        c.P(x, 26, J('aged_cedar', 2)); c.P(x, 27, J('aged_cedar', 1))
    c.VL(FX0 - 1, 26, 2, OL); c.VL(FX1 + 1, 26, 2, OL)
    c.HL(FX0 - 1, 8, FX1 - FX0 + 3, OL)
    for y in range(28, 34):                                                # 홈통 끝에서 바퀴 오른쪽 위 날개로 떨어지는 물
        for x in range(FX0 + 3, FX1 - 2):
            u, v = (x + 0.5 - WX) / RX, (y + 0.5 - WY) / RY
            if math.hypot(u, v) < 0.86:
                continue
            c.P(x, y, K('shiro', 2) if (x + y) % 3 == 0 else K('sora', 2 if x < FX1 - 4 else 1))
    for (sx, sy) in ((57, 33), (58, 35), (55, 32), (59, 37)):              # 날개에 튄 물
        c.P(sx, sy, K('shiro', 2))
    for yy in range(52, 54):                                               # 바퀴 아래 끝을 덮는 물받이 물
        for xx in range(38, 61):
            c.P(xx, yy, K('sora', 1 if yy == 53 else 2))
    for (sx, sy) in ((41, 51), (43, 50), (54, 50), (56, 51), (58, 50), (47, 52), (52, 52)):   # 물받이에 흰 물보라
        c.P(sx, sy, K('shiro', 2)); c.P(sx + 1, sy, K('shiro', 1))
    _jp_finish(c0, (6, 63, 55 + D, 4))


# ═══════════════════════════ 8. 비닐하우스 ═══════════════════════════
# ─────────────── 비닐 터널 투영(밑그림 tunnel_underdraw.py 와 같은 식) ───────────────
# 점 (x, y=북, z=위) → 화면 sx = x, sy = 바닥 − c·y − z. 빛은 북서 위, 그림자는 남동 바닥.
_TUN_C = 0.65
_TUN_LIGHT = tuple(v / math.sqrt(0.55 ** 2 + 0.45 ** 2 + 0.70 ** 2) for v in (-0.55, 0.45, 0.70))


def _tun_lam(nx, ny, nz):
    return max(0.0, nx * _TUN_LIGHT[0] + ny * _TUN_LIGHT[1] + nz * _TUN_LIGHT[2])


def _tun_ns(sx, sy, cx, r, base, L, rib=10.0):
    """남북 터널 화소 → ('face', v, pipe) | ('film', v, rib, y) | None."""
    c = _TUN_C
    x = sx - cx
    if abs(x) >= r:
        return None
    zt = math.sqrt(r * r - x * x)
    if base - zt <= sy <= base:
        return ('face', 0.25, base - zt <= sy < base - zt + 1.2)
    y = (base - sy - zt) / c
    if 0 <= y <= L:
        v = 0.2 + 0.8 * _tun_lam(x / r, 0, zt / r)
        return ('film', v, (y % rib) < 1.0 / c or y > L - 1.0 / c, y)
    return None


def _tun_shadow(gx, gy, inside):
    """바닥 점(gx, gy)에서 빛 쪽으로 쏘아 터널에 막히면 그늘."""
    for i in range(1, 200):
        t = i * 0.5
        if inside(gx + t * _TUN_LIGHT[0], gy + t * _TUN_LIGHT[1], t * _TUN_LIGHT[2]):
            return True
    return False


def _film_col(v, VW='vending_cool_white'):
    """밑그림 값(0.2~1.0) → 비닐 필름 팔레트: 밝은 서쪽·꼭대기 → 어두운 동쪽."""
    if v > 0.86: return J(VW, 4)
    if v > 0.72: return J(VW, 3)
    if v > 0.58: return J(VW, 2)
    if v > 0.45: return J(VW, 1)
    if v > 0.33: return J(VW, 0)
    if v > 0.25: return K('tekko', 2)
    return K('tekko', 1)


def _film_step(v):
    return 4 if v > 0.86 else 3 if v > 0.72 else 2 if v > 0.58 else 1 if v > 0.45 else 0 if v > 0.33 else -1 if v > 0.25 else -2


def _greenhouse_doors(c, DX0, DX1, YB, VW='vending_cool_white'):
    """16×27 양쪽 미닫이(쇠 문틀 + 가운데 맞닿는 문살, 위 비닐 창 · 아래 판)."""
    DY0 = YB - 27
    c.R(DX0 - 1, DY0 - 1, DX1 - DX0 + 3, YB - DY0 + 1, OL)
    c.R(DX0, DY0, DX1 - DX0 + 1, YB - DY0, K('tekko', 2))
    c.HL(DX0, DY0, DX1 - DX0 + 1, K('tekko', 3)); c.VL(DX0, DY0, YB - DY0, K('tekko', 3)); c.VL(DX1, DY0, YB - DY0, K('tekko', 0))
    mid = (DX0 + DX1) // 2
    for (lx0, lx1, sh) in ((DX0 + 1, mid - 1, 0), (mid + 2, DX1 - 1, -1)):
        for yy in range(DY0 + 2, YB - 1):
            for xx in range(lx0, lx1 + 1):
                if yy < YB - 10:
                    col = J(VW, max(0, (3 if xx == lx0 else 2 if yy < DY0 + 6 else 1) + sh))
                    if (xx + yy) % 3 == 0 and yy > DY0 + 6:
                        col = K('lino', 1 + sh)
                else:
                    col = K('tekko', 1 + sh)
                c.P(xx, yy, col)
        c.HL(lx0, YB - 10, lx1 - lx0 + 1, K('tekko', 3 + sh))
        c.HL(lx0, DY0 + 1, lx1 - lx0 + 1, K('tekko', 1))
    c.VL(mid, DY0 + 1, YB - DY0 - 1, K('tekko', 0)); c.VL(mid + 1, DY0 + 1, YB - DY0 - 1, K('tekko', 3))
    c.P(mid - 2, YB - 15, K('kinari', 1)); c.P(mid + 3, YB - 15, K('kinari', 0))
    c.HL(DX0 - 1, YB - 1, DX1 - DX0 + 3, K('tekko', 0))


@kit('inaka-vinyl-greenhouse', '비닐하우스 - 남북으로 긴 터널(3/4 탑뷰): 긴 아치 비닐 윗면·가로 아치 골조 줄·용마루 빛 띠·필름 너머 작물 줄·앞 아치 끝 미닫이(4×7)', 4, 7, 'building',
     solid=rows(4, [1, 2, 3, 4, 5, 6]), tags=['inaka', '비닐하우스', '온실', 'ハウス'],
     rules='밭(inaka-paddy 아님) 옆 흙 위에 둔다. 여러 동을 옆으로 나란히 놓는다. 맨 아래 가운데 두 칸이 출입구.', role='building', doors=[(1, 6, 2)])
def greenhouse(c, base):
    # 남북으로 누운 반원 터널(밑그림 tunnel_underdraw.py ns 와 같은 투영): 갈비대 하나하나가 남쪽 끝면과 같은 온전한 ∩ 로
    # 찍혀 c·Δy 씩 위로 쌓인다. 윗 실루엣 = 북쪽 갈비대의 ∩. 빛은 북서(왼쪽·꼭대기 밝고 동쪽 어둡다).
    VW = 'vending_cool_white'
    cx, r, base_y = 32.0, 30.0, 109
    L = (base_y - r - 2) / _TUN_C
    info = {}
    for sy in range(c.h):
        for sx in range(c.w):
            t = _tun_ns(sx + 0.5, sy + 0.5, cx, r, base_y, L)
            if t:
                info[(sx, sy)] = t
    # 1) 필름 + 갈비대(1px 밝은 ∩)
    for (sx, sy), t in info.items():
        if t[0] == 'film':
            v, rib = t[1], t[2]
            st = min(3, _film_step(v) - 1)                                 # 필름 몸은 한 단 낮춰(최대 3) 갈비대 빛이 늘 보이게
            if rib:
                st += 1
            elif H(sx // 2, sy // 3, 44) < 0.04:
                st += 1                                                    # 필름 주름 빛
            c.P(sx, sy, J(VW, min(4, st)) if st >= 0 else K('tekko', 2 + max(-1, st)))
    # 2) 필름 너머 작물: 바닥 고랑 3줄(x = -15, 0, 15)에 떨어진 잎 덩이(갈비대 사이), 필름에 비쳐 한 단 옅다
    for k, gx in enumerate((-15, 0, 15)):
        for gy in [5 + 10 * i + (k % 2) * 2 for i in range(int(L // 10))]:
            px_, py_ = cx + gx, base_y - _TUN_C * gy - 3
            for yy in range(int(py_) - 2, int(py_) + 3):
                for xx in range(int(px_) - 3, int(px_) + 4):
                    dx, dy = (xx + 0.5 - px_) / 2.6, (yy + 0.5 - py_) / 1.8
                    t = info.get((xx, yy))
                    if dx * dx + dy * dy > 1.0 or not t or t[0] != 'film' or t[2]:
                        continue
                    lit = t[1] > 0.58
                    tt = (2 if lit else 1) + (1 if dy < -0.3 and dx < 0.3 else 0) - (1 if dx > 0.5 or dy > 0.6 else 0)
                    c.P(xx, yy, K('lino', tt))
    # 3) 남쪽 끝면(필름보다 어두운 세로 면) + 끝 아치 파이프 + 안쪽 아치 · 기둥 · 가로대 + 끝면 너머 작물
    for (sx, sy), t in info.items():
        if t[0] == 'face':
            u = (sx + 0.5 - cx) / r
            c.P(sx, sy, K('tekko', 3 if u < -0.2 else 2) if t[2] else (J(VW, 0) if u < 0.45 else K('tekko', 1)))
    for sx in range(c.w):
        x = sx + 0.5 - cx
        if abs(x) < r:
            zt = math.sqrt(r * r - x * x)
            if zt > 3:
                c.P(sx, round(base_y - zt) + 1, K('yoru', 0))                # 파이프 밑 그늘
                c.P(sx, round(base_y - 0.72 * zt), K('tekko', 1))         # 안쪽 아치 늑재
    for sx in (int(cx) - 21, int(cx) + 20):
        zt = math.sqrt(r * r - (sx + 0.5 - cx) ** 2)
        for sy in range(round(base_y - zt) + 2, base_y):
            c.P(sx, sy, K('tekko', 1 if sx < cx else 0))
    for sx in range(int(cx - r) + 3, int(cx + r) - 3):
        c.P(sx, base_y - 14, K('tekko', 1))                                # 가로대
    for gx, sgn in ((-15, 0), (15, -1)):
        px_ = cx + gx
        for yy in range(base_y - 8, base_y):
            for xx in range(int(px_) - 4, int(px_) + 5):
                dx, dy = (xx + 0.5 - px_) / 3.8, (yy + 0.5 - (base_y - 2)) / 5.0
                if dx * dx + dy * dy <= 1.0 and info.get((xx, yy), ('',))[0] == 'face':
                    c.P(xx, yy, K('lino', sgn + (1 if dy < -0.4 else 0)))
    # 4) 문(16×27, 칸 1~2 사이 가운데)
    _greenhouse_doors(c, 24, 39, base_y)
    # 5) 양옆 치마: 땅에 닿는 곧은 짙은 선
    for (sx, sy), t in info.items():
        if t[0] == 'film' and (sx + 0.5 - cx) < -r + 2:
            c.P(sx, sy, K('lino', 0))
        elif t[0] == 'film' and (sx + 0.5 - cx) > r - 2:
            c.P(sx, sy, K('lino', -2))
    add_outline(c)
    # 6) 흙: 남쪽 끝면 앞 흙 띠, 서쪽 치마 밖 흙 알갱이
    for xx in range(0, c.w):
        c.P(xx, base_y, K('soil', 1 if H(xx, 0, 47) > 0.3 else 2))
        c.P(xx, base_y + 1, K('soil', 0 if H(xx, 1, 47) > 0.25 else 1))
        c.P(xx, base_y + 2, K('soil', -1 if xx % 4 else 0))
    x0 = int(cx - r)
    for sy in range(int(base_y - r - _TUN_C * L) + 4, base_y):
        if H(0, sy, 51) < 0.4 and x0 - 2 >= 0 and c.a[sy, x0 - 2, 3] == 0:
            c.P(x0 - 2, sy, K('soil', 0 if H(1, sy, 51) > 0.5 else -1))
    _finish(c)
    # 7) 남동 그림자(칸 안에 떨어지는 만큼): 바닥 점에서 빛 쪽으로 쏴 터널에 막히면 디더 그늘
    inside = lambda X, Y, Z: 0 <= Y <= L and X * X + Z * Z <= r * r
    for sy in range(c.h):
        for sx in range(c.w):
            if c.a[sy, sx, 3] == 0 and (sx + sy) % 2 == 0:
                if _tun_shadow(sx + 0.5 - cx, (base_y - sy - 0.5) / _TUN_C, inside):
                    c.P(sx, sy, K('yoru', -1))


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
        for yy in range(23, 43):                                           # 안쪽 뒷벽: 3px 판 번갈아(짙은·덜 짙은)
            for xx in range(9, 31):
                c.P(xx, yy, K('tekko', -2 if ((xx - 9) // 3) % 2 == 0 else -1))
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
    # 지붕 몫 ≈25%: 정면 골판 벽·문을 위로 늘리고(옛 정면 지붕 자리 덮음) 위에 얕은 切妻 함석 띠
    YW = 38                                                                # R11: 벽 위(처마 바로 밑) — 지붕 32줄, 벽 짧게
    c.a[YW:D + 19, :X0 - 1, 3] = 0; c.a[YW:D + 19, X1 + 2:, 3] = 0          # 옛 정면 지붕·처마 띠의 양옆 나머지 지움
    for x in range(X0, X1 + 1):
        drip = False                                                       # R13: 처마 밑 녹 점 없음
        dl = 4 + int(H(x // 4, 1, 48) * 12)
        for y in range(YW, D + 23):
            i = x % 4
            t = (1 if i == 0 else 0 if i == 1 else -1 if i == 2 else -2) + (1 if H(x // 12, 2, 48) > 0.7 else 0)
            col = K('tekko', t)
            if drip and i in (2, 3) and y < YW + dl:
                col = J('noren_rust', 2 if y < YW + dl - 3 else 1)
            c.P(x, y, col)
    c.VL(X0, YW, D + 15 - YW + 8, K('tekko', 2)); c.VL(X1, YW, D + 15 - YW + 8, K('tekko', -2))
    c.VL(X0 - 1, YW, D + 15 - YW + 8, OL); c.VL(X1 + 1, YW, D + 15 - YW + 8, OL)
    DT = 42                                                                # 문 위(레일 밑) — R11 짧아진 열린 칸
    for yy in range(DT, D + 23):                                           # 열린 미닫이 안: 3px 판 번갈아, 문 위 그늘 2줄
        for xx in range(9, 31):
            t = -2 if ((xx - 9) // 3) % 2 == 0 else -1
            c.P(xx, yy, K('tekko', t - (1 if yy < DT + 2 else 0)))
    c.VL(8, DT, D + 23 - DT, OL)
    for yy in range(DT, D + 23):                                           # 닫힌 문짝 윗부분
        for xx in range(32, 54):
            i = xx % 4
            c.P(xx, yy, K('tekko', (1 if i == 0 else 0 if i == 1 else -1 if i == 2 else -2) + (1 if yy < DT + 2 else 0)))
    c.HL(32, DT, 22, K('tekko', 3)); c.VL(31, DT, D + 23 - DT, OL)
    FY = D + 23 + 20                                                       # 열린 문 안 흙바닥 윗면(앞 밝고 안쪽으로 어둡게, 5줄)
    for j, yy in enumerate(range(FY - 5, FY)):
        for xx in range(9, 31):
            if c.a[yy, xx, 3] and _key(c, xx, yy) in (K('tekko', -3), K('tekko', -2), K('tekko', -1)):
                c.P(xx, yy, J('aged_cedar', j // 2) if H(xx, yy, 58) > 0.15 else K('tekko', -2))
    for xx in range(9, 31):
        c.P(xx, FY - 6, K('tekko', -2))
    c.VL(9, DT, FY - DT, K('tekko', 2)); c.VL(10, DT, FY - DT - 5, K('tekko', 0))   # 왼쪽 문설주 빛
    c.HL(8, DT - 1, 47, K('tekko', 2)); c.HL(8, DT - 2, 47, K('tekko', -1))   # 레일
    _shade(c, X0, YW, X1 - X0 + 1, 1, 0.6)                                 # 처마 밑 벽 그림자 1행
    jp_roof(c, 1, 62, 18, YW - 1, 'tin', hip=True, hw=10)   # R14: 20행(약 33%)                  # R12 jp 함석 27행: 골 4px · 12행 이음새 · 흰 립 · 윤곽, 녹 없음
    _jp_finish(c)
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
    # 笠(갓): 위에서 보이는 네모뿔 지붕 윗면 — 꼭대기에서 처마로 넓어지는 사다리꼴, 왼쪽 면 빛 · 오른쪽 면 그늘,
    # 처마 끝 두께 2px(앞면 짙게) + 보주
    cxl = x + 5
    for j in range(5):                                                     # 윗면 y+1..y+5
        hw = 2 + j * 1.5
        yy = y + 1 + j
        xl, xr = round(cxl - hw), round(cxl + hw)
        c.P(xl - 1, yy, OL); c.P(xr + 1, yy, OL)
        for i in range(xl, xr + 1):
            t = 4 if i < cxl - 0.5 else 3 if i <= cxl + 0.5 else 2
            if i == xl:
                t = 3
            if H(i, yy, 70) < 0.12:
                t -= 1
            col = K('conc', t - 2) if t >= 3 else J('shrine_flagstone', t)  # 갓 윗면: 하늘빛 받는 밝은 돌
            if j == 4 and i < cxl + 3 and i % 2 == 0:
                col = K('conc', 2)                                         # 갓 앞 모서리 빛(윗면 끝)
            c.P(i, yy, col)
    c.HL(cxl - 2, y, 5, OL)
    for i in range(x - 2, x + 13):                                         # 처마 두께(앞면)
        c.P(i, y + 6, J('shrine_flagstone', 1 if i < x + 9 else 0)); c.P(i, y + 7, J('shrine_flagstone', 0))
    c.HL(x - 2, y + 8, 15, OL); c.P(x - 3, y + 6, OL); c.P(x - 3, y + 7, OL); c.P(x + 13, y + 6, OL); c.P(x + 13, y + 7, OL)
    c.P(x + 1, y + 5, J('moss', 3)); c.P(x + 2, y + 5, J('moss', 2)); c.P(x + 9, y + 5, J('moss', 1))
    c.R(cxl - 1, y - 2, 3, 2, J('shrine_flagstone', 3)); c.P(cxl - 1, y - 2, J('shrine_flagstone', 4)); c.P(cxl + 1, y - 1, J('shrine_flagstone', 2))
    c.HL(cxl - 1, y - 3, 3, OL); c.P(cxl - 2, y - 2, OL); c.P(cxl + 2, y - 2, OL); c.P(cxl - 2, y - 1, OL); c.P(cxl + 2, y - 1, OL)
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
                if j < 4:
                    t = 3 if j == 0 else 4                                 # 디딤판 윗면 4px: 뒤 한 줄 · 밝은 넓은 면
                    if j == 3 and x % 3:
                        t = 5                                              # 앞 끝 코(모서리 빛)
                    if 0 < j < 3 and H(x, yy, 61) < 0.18:
                        t -= 1
                elif j == 4:
                    t = 1                                                  # 챌면(앞면) 2px: 짙은 그늘
                else:
                    t = 0
                if joint:
                    t = 2 if j < 4 else 0
                col = K('conc', 2) if t >= 5 else J('shrine_flagstone', min(4, t))
                edge = min(x - SX0, SX1 - 1 - x)
                if edge < 2 and H(x // 2, yy // 2, 63) < 0.5 - edge * 0.2 and j < 3:
                    col = J('moss', 3)
                elif j == 5:
                    col = K('yoru', 0) if H(x, k, 69) > 0.25 else J('wet_cobble', 1)   # 챌면 밑 짙은 그늘 줄
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
        c.P(xx, 15, J(VR, 4 + sh)); c.P(xx, 16, J(VR, 1 + sh))               # 貫: 윗면 빛 1px + 앞면 그늘
    # 額束(판, 금 테, 글자 없음)
    c.R(29, 9, 6, 6, OL); c.R(30, 10, 4, 4, J('kawara_dark_tile', 1)); c.HL(30, 10, 4, J('lantern_amber', 3))
    c.VL(30, 10, 4, J('lantern_amber', 3)); c.P(31, 11, J('lantern_amber', 2)); c.P(32, 12, J('kawara_dark_tile', 2))
    # 島木
    c.R(5, 6, 54, 4, OL)
    for xx in range(6, 58):
        sh = -1 if xx > 52 else 0
        c.P(xx, 7, J(VR, 4 + sh)); c.P(xx, 8, J(VR, 2 + sh if xx % 7 else 1 + sh))
    c.HL(6, 9, 52, J('autumn_maple', 0))
    # 笠木: 위에서 보이는 윗면 4px(뒤 가장자리가 양쪽 2px 안으로 들어간 사다리꼴 — 뒤로 눕는 면, 하늘빛 받아 밝다)
    #       + 앞 모서리 빛 + 앞면 2px(짙은 그늘) + 반전 끝
    c.R(2, 1, 60, 7, OL); c.HL(4, 0, 56, OL)
    for xx in range(3, 61):
        sh = -1 if xx > 54 else 0
        if 4 < xx < 59:
            c.P(xx, 1, K('conc', 0 + sh))                                  # 윗면 뒤 가장자리(사다리꼴 윗변)
        else:
            c.P(xx, 1, OL)
        c.P(xx, 2, K('conc', 1 + sh)); c.P(xx, 3, K('conc', 1 + sh) if xx % 7 else K('conc', 0 + sh))
        c.P(xx, 4, K('conc', 2 + sh))                                      # 앞 모서리 빛(윗면 끝)
        c.P(xx, 5, J('kawara_dark_tile', 1 + sh)); c.P(xx, 6, J('kawara_dark_tile', 0))
    c.R(0, 1, 4, 3, OL); c.R(60, 1, 4, 3, OL)
    c.P(1, 2, K('conc', 1)); c.P(2, 2, K('conc', 0)); c.P(62, 2, K('conc', -1)); c.P(61, 2, K('conc', -1))
    for xx in range(6, 58):                                                # 島木: 笠木 밑 한 줄 + 그늘
        sh = -1 if xx > 52 else 0
        c.P(xx, 8, J(VR, 3 + sh))
    _finish(c)
