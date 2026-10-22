#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "pillow"]
# ///
"""jp-inaka R5 공용 화풍 도우미 — 버들항 수준의 윤곽·그림자.

버들항 기준(object-gate 화풍 규칙): 윤곽은 「이웃 재질의 어두운 톤」이지 거의 검정이 아니다. 형태는 명암만으로도 갈린다.
jp_city 부품(add_outline·OL=sumi)은 모든 실루엣에 같은 보라 검정 1px 를 두른다 → 스티커처럼 읽힌다.

- tint_outlines(c): 그림을 다 그린 뒤 부른다. 거의 검정(sumi 계열·OL) 화소를 그 화소에 닿은 재질 색의 어두운 톤으로 바꾼다.
  어두운 톤 = 이웃 색을 0.42 배로 어둡게 한 목표 색에 가장 가까운 허용 팔레트 색(색조 치우침이 있는 것만, 이웃보다 확실히 어두운 것만).
  허용 팔레트는 bake 검사와 같다(modern3 ∪ jp_city palette-contract).
- ground_shadow(c, ...): 알파 0/255 만 허용되므로 반투명 그림자 대신 어두운 화소 체커 디더(어느 바닥 위에서도 그늘로 읽힌다).
"""
from __future__ import annotations

import json
import os
import sys
from functools import lru_cache

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
for _p in (os.path.join(ROOT, 'scripts', 'content', 'atlas-pick'),):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from modern3_check import load_pal  # noqa: E402

_RETIRED = {'shiba', 'neonP', 'neonC'}


@lru_cache(maxsize=1)
def palette() -> tuple[tuple[int, ...], dict[int, tuple[str, int, int]]]:
    """(허용 색 목록, 색 → (램프, 단, 램프 길이)). 퇴역 램프·네온은 윤곽 후보에서 뺀다(검사상 허용이어도)."""
    ramps = {k: v for k, v in load_pal().items() if k not in _RETIRED}
    with open(os.path.join(ROOT, 'tiledata', 'jp-city', 'palette-contract.json'), encoding='utf-8') as f:
        con = json.load(f)
    for fam in con['families']:
        for m in fam['materials']:
            ramps[m['id']] = [int(h[1:], 16) for h in m['steps']]
    owner: dict[int, tuple[str, int, int]] = {}
    for n, r in ramps.items():
        for i, c in enumerate(r):
            owner.setdefault(c, (n, i, len(r)))
    return tuple(owner), owner


def _rgb(c: int) -> tuple[int, int, int]:
    return (c >> 16) & 255, (c >> 8) & 255, c & 255


def lum(c: int) -> float:
    r, g, b = _rgb(c)
    return 0.299 * r + 0.587 * g + 0.114 * b


def spread(c: int) -> int:
    r, g, b = _rgb(c)
    return max(r, g, b) - min(r, g, b)


def is_inkish(c: int) -> bool:
    """거의 무채색이면서 아주 어두운 색(윤곽 잉크): sumi·OL·yoru 바닥단·tekko 바닥단 등."""
    return lum(c) < 42 and spread(c) <= 24


@lru_cache(maxsize=4096)
def dark_tone(c: int, k: float = 0.42) -> int:
    """색 c 의 재질 어두운 톤 — c 를 k 배 어둡게 한 목표에 가까운 허용 색 중 색조가 남은(spread>12) 것."""
    cols, _ = palette()
    r, g, b = _rgb(c)
    tr, tg, tb = r * k, g * k, b * k
    L = lum(c)
    best, bd = None, 1e18
    for p in cols:
        if spread(p) <= 14 or lum(p) > L * 0.66 or lum(p) < 14:
            continue
        pr, pg, pb = _rgb(p)
        d = 2 * (pr - tr) ** 2 + 4 * (pg - tg) ** 2 + 3 * (pb - tb) ** 2
        # 색조 방향 유지: 원색의 가장 큰 채널이 후보에서도 크면 가점
        if np.argmax((r, g, b)) != np.argmax((pr, pg, pb)):
            d *= 1.8
        if d < bd:
            bd, best = d, p
    return best if best is not None else c


def tint_outlines(c, keep_bottom: int = 0) -> int:
    """잉크 화소(거의 검정)를 이웃 재질의 어두운 톤으로 바꾼다. keep_bottom: 맨 아래 n 줄(바닥 접지선)은 그대로. 바꾼 화소 수."""
    a = c.a
    h, w = a.shape[:2]
    keys = (a[..., 0].astype(np.int64) << 16) | (a[..., 1].astype(np.int64) << 8) | a[..., 2].astype(np.int64)
    op = a[..., 3] > 0
    ink = np.zeros((h, w), bool)
    for y in range(h):
        for x in range(w):
            if op[y, x] and is_inkish(int(keys[y, x])):
                ink[y, x] = True
    changes = []
    for y in range(h - keep_bottom):
        for x in range(w):
            if not ink[y, x]:
                continue
            votes: dict[int, int] = {}
            for dy, dx, wt in ((-1, 0, 2), (1, 0, 2), (0, -1, 2), (0, 1, 2), (-1, -1, 1), (-1, 1, 1), (1, -1, 1), (1, 1, 1)):
                yy, xx = y + dy, x + dx
                if 0 <= yy < h and 0 <= xx < w and op[yy, xx] and not ink[yy, xx]:
                    k = int(keys[yy, xx])
                    votes[k] = votes.get(k, 0) + wt
            if not votes:
                continue
            # 가장 많이 닿은 재질, 같으면 더 어두운 쪽(윤곽은 어두운 재질 편을 든다)
            nb = max(votes, key=lambda k: (votes[k], -lum(k)))
            changes.append((y, x, dark_tone(nb)))
    for y, x, col in changes:
        a[y, x, 0], a[y, x, 1], a[y, x, 2] = _rgb(col)
    return len(changes)


def ground_shadow(c, x0: int, x1: int, y0: int, rows: int, col: int, inset: int = 1) -> None:
    """발치 그림자: 투명한 칸에만 어두운 체커 디더(rows 줄, 아래로 갈수록 좁아짐). 이미 칠한 화소는 건드리지 않는다."""
    for j in range(rows):
        y = y0 + j
        if not 0 <= y < c.h:
            continue
        for x in range(x0 + j * inset, x1 - j * inset):
            if 0 <= x < c.w and c.a[y, x, 3] == 0 and (x + y) % 2 == 0:
                c.P(x, y, col)
