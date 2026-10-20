#!/usr/bin/env python3
# noqa: SIZE_OK - jp-inaka ground tiles + 8-way countryside autotiles (R5, beodeul depth)
# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "pillow"]
# ///
"""jp-inaka 바닥 — R5(버들항 깊이).

R4 까지는 jp_city 잔디·산길 흙·연못 오토타일을 빌려 깔고, 이나카 고유 바닥은 1px 디더 노이즈 칸(논·개울)이었다.
버들항 바닥과 나란히 보면 ① 같은 칸이 수십 번 되풀이되는 벽지, ② 1px 점 노이즈(덩이·결이 아님), ③ 재질마다 2~3단,
④ 논과 흙의 칼 경계가 문제였다. R5 는 이나카 전용 8방 오토타일 6종을 둔다(같은 입력 → 같은 결과, 난수 없음):

  시골 풀밭(inaka-grass)    — 몸통 3변형, 가장자리를 그리지 않는다(다른 재료가 자기 쪽에 풀 테를 그린다). 맵 밖·다른 시골 바닥과 이어짐.
  시골 흙길(inaka-dirt)     — 다진 흙 + 잔돌·바퀴 자국 결. 가장자리는 풀이 흙 위로 삐죽 덮고 풀 그늘(빛 왼쪽 위 → 북·서 테 아래로 그늘).
  시골 개울(inaka-stream)   — 맑은 얕은 물(물밑 자갈이 비침·물살). 북쪽은 흙 둑 앞면, 남·옆은 풀 둑 입술.
  물논·여름 논·황금 논(inaka-paddy-*) — 논 가장자리에 논두렁(畦) 둑을 칸 안에 그린다: 북쪽 둑은 앞면이 보이고, 남쪽은 윗면만.

단일 칸 그룹(R1~R4 의 inaka-paddy-water 등)은 번호를 지키려고 남기고 그림만 오토타일 몸통으로 바꾼다.
"""
from __future__ import annotations

import collections
import os
import sys
from typing import Callable, Final

import numpy as np

from inaka_art_houses import Cv, H, J, K  # noqa: E402,F401

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
_JPC = os.path.join(ROOT, 'scripts', 'content', 'jp-city')
if _JPC not in sys.path:
    sys.path.insert(0, _JPC)
from lib_blocks import ground_autotile as GA  # noqa: E402

from inaka_style import palette  # noqa: E402

# ═══════════════════════════ 색 ═══════════════════════════
_R: dict[str, list[int]] = {}


def _ramps() -> dict[str, list[int]]:
    if not _R:
        import json
        from modern3_check import load_pal
        _R.update(load_pal())
        with open(os.path.join(ROOT, 'tiledata', 'jp-city', 'palette-contract.json'), encoding='utf-8') as f:
            for fam in json.load(f)['families']:
                for m in fam['materials']:
                    _R[m['id']] = [int(h[1:], 16) for h in m['steps']]
    return _R


def P(name: str, i: int) -> tuple[int, int, int, int]:
    """램프 name 의 절대 단 i(0 = 가장 어두움). RGBA 튜플."""
    r = _ramps()[name]
    c = r[max(0, min(len(r) - 1, i))]
    return ((c >> 16) & 255, (c >> 8) & 255, c & 255, 255)


# 재질 램프(어두움 → 밝음). 버들항처럼 재질마다 6~7단, 그늘은 차갑게·빛은 따뜻하게.
GRASS = [P('ki', 1), P('ki', 2), P('ki', 3), P('ki', 4), P('ki', 5), P('moss', 4), P('ki', 6)]
#          0 깊은 그늘   1 그늘     2 어둔 풀   3 몸 어둠   4 몸       5 따뜻한 잎끝  6 빛
DIRT = [P('soil', 1), P('soil', 2), P('soil', 3), P('ita', 5), P('soil', 4), P('kinari', 2), P('kinari', 3)]
#         0 틈          1 그늘       2 어둠       3 몸 어둠    4 몸         5 밝음        6 빛
PEBBLE = [P('shrine_flagstone', 1), P('shrine_flagstone', 2), P('shrine_flagstone', 3), P('shrine_flagstone', 4), P('paving_stone', 4)]
WATER = [P('canal_indigo', 1), P('onsen_mineral_teal', 1), P('onsen_mineral_teal', 2), P('onsen_mineral_teal', 3),
         P('onsen_mineral_teal', 4), P('lino', 4), P('vending_cool_white', 4)]
#          0 깊음               1 그늘                       2 몸                          3 밝은 물
#          4 하늘 비침           5 물살                       6 반짝
RICE = [P('ki', 1), P('ki', 2), P('pine_bamboo', 2), P('ki', 4), P('pine_bamboo', 4), P('moss', 4), P('ki', 6)]
GOLD = [P('soil', 2), P('mado', 1), P('tatami_straw', 1), P('tatami_straw', 2), P('mado', 2), P('tatami_straw', 3), P('kii', 3), P('tatami_straw', 4)]
MUD_WATER = [P('canal_indigo', 1), P('garasu', 2), P('garasu', 3), P('arcade_skylight_slate', 2), P('arcade_skylight_slate', 3),
             P('garasu', 5), P('garasu', 6)]
#              0 깊은 그늘          1 그늘            2 몸 어둠          3 몸                                4 하늘 밝음
#              5 구름 비침          6 반짝


def h(x: int, y: int, s: int) -> float:
    """16 주기 위치 해시(칸 이음매 없음)."""
    return GA.h01(x % 16, y % 16, s)


def blank(col) -> np.ndarray:
    a = np.zeros((16, 16, 4), np.uint8)
    a[:, :] = col
    return a


def put(a: np.ndarray, x: int, y: int, col) -> None:
    a[y % 16, x % 16] = col


def blob(a, cx, cy, rx, ry, col, wrap=True):
    for y in range(int(cy - ry - 1), int(cy + ry + 2)):
        for x in range(int(cx - rx - 1), int(cx + rx + 2)):
            if ((x - cx) / max(rx, .1)) ** 2 + ((y - cy) / max(ry, .1)) ** 2 <= 1.0:
                if wrap or (0 <= x < 16 and 0 <= y < 16):
                    put(a, x, y, col)


def mottle(a, ramp, levels, seed, cell=2, lo=.14, hi=.93):
    """드문 작은 덩이(2px 덩이를 1px 흔들어 모서리를 깎음) — 몸통은 거의 한 톤, 어둠·밝음 덩이는 드물게.
    16px 칸에 큰 무늬가 하나 서면 넓게 깔았을 때 벽지처럼 칸 격자가 보인다(R5 1·2차 시도에서 확인)."""
    for y in range(16):
        for x in range(16):
            v = h(x // cell + (y // cell) * 5, y // cell, seed)
            if h(x, y, seed + 3) < .25:
                v = h(x, y, seed + 4)                       # 덩이 가장자리 흔들기
            t = levels[1] if v < lo else levels[2] if v > hi else levels[0]
            a[y, x] = ramp[t]


# ═══════════════════════════ 풀밭 ═══════════════════════════
def _tuft(a, x, y, kind=0):
    """풀포기: 끝 빛 1 + 잎 2 + 밑동 그늘 1(빛 왼쪽 위 → 그늘은 오른쪽 아래)."""
    G = GRASS
    put(a, x, y, G[6] if kind == 0 else G[5])
    put(a, x - 1, y + 1, G[5]); put(a, x, y + 1, G[4] if kind else G[5]); put(a, x + 1, y + 1, G[4])
    put(a, x + 1, y + 2, G[2]); put(a, x, y + 2, G[3])


def grass_body(seed=0) -> np.ndarray:
    """풀밭 몸통(버들항 풀처럼 거의 단색 면): 기본 몸 한 색 + 드문 2px 그늘 덩이 2개 + 풀잎 획 1~2개.
    seed 1·3 은 점 무리 덩이(빛·그늘 엇갈림) 한 판 — 넓게 깔면 점 무리가 띄엄띄엄 놓인다. 황토빛(moss) 점은 흙처럼 읽혀 뺐다."""
    a = blank(GRASS[4])
    q = seed * 97
    for k in range(2):
        x = int(h(k, 3, 11 + q) * 14); y = int(h(k, 5, 12 + q) * 14)
        put(a, x, y, GRASS[3]); put(a, x + 1, y, GRASS[3]); put(a, x + 1, y + 1, GRASS[3])
    for k in range(1 + seed % 2):
        x = 1 + int(h(k, 3, 21 + q) * 14); y = 1 + int(h(k, 7, 22 + q) * 13)
        put(a, x, y, GRASS[5 if seed % 2 else 6] if False else GRASS[6]); put(a, x, y + 1, GRASS[3])
    if seed in (1, 3):                                         # 점 무리 덩이
        cx = 4 + int(h(seed, 1, 31) * 8); cy = 4 + int(h(seed, 2, 32) * 8)
        for y in range(cy - 3, cy + 4):
            for x in range(cx - 4, cx + 5):
                d = ((x - cx) / 4.5) ** 2 + ((y - cy) / 3.5) ** 2
                if d < 1 and (x + y) % 2 == 0 and h(x, y, 33 + seed) < 1.15 - d:
                    put(a, x, y, GRASS[5] if (x - y) % 4 == 0 else GRASS[3])
    if seed == 2:
        _tuft(a, 3 + int(h(0, 9, 31 + q) * 10), 3 + int(h(0, 13, 32 + q) * 9), 0)
    return a


def grass_var(base: np.ndarray, kind: int) -> np.ndarray:
    """둘레 1줄은 몸통과 같게(섞어 깔아도 이음매 없음). 1 = 토끼풀·작은 흰꽃, 2 = 키 큰 풀 덤불."""
    a = base.copy()
    if kind == 1:
        for (x, y) in ((5, 5), (10, 9), (4, 11)):
            put(a, x, y, P('vending_cool_white', 4)); put(a, x + 1, y, P('vending_cool_white', 2)); put(a, x, y + 1, GRASS[2])
        put(a, 11, 4, P('kii', 4)); put(a, 11, 5, GRASS[2])
        for (x, y) in ((7, 7), (8, 7), (7, 8)):
            put(a, x, y, GRASS[5])
    else:
        for i, x in enumerate(range(4, 12)):
            top = 6 - (i % 3 == 1) - (i == 4)
            for y in range(top, 11):
                put(a, x, y, GRASS[6] if y == top else GRASS[5] if y < top + 2 else GRASS[4] if y < 9 else GRASS[3])
        for x in range(5, 13):
            put(a, x, 11, GRASS[2]); put(a, x + 1, 12, GRASS[1]) if x % 2 else None
    return a


# ═══════════════════════════ 흙길 ═══════════════════════════
def _pebble(a, x, y, big=False):
    S = PEBBLE
    put(a, x, y, S[3] if big else S[2]); put(a, x + 1, y, S[2] if big else S[1])
    if big:
        put(a, x, y - 1, S[4]); put(a, x + 1, y - 1, S[3]); put(a, x + 2, y, S[1])
    put(a, x + 1, y + 1, DIRT[1]); put(a, x, y + 1, DIRT[2])          # 돌 그늘(오른쪽 아래)


def dirt_body() -> np.ndarray:
    a = blank(DIRT[4])
    mottle(a, DIRT, (4, 3, 4), 51, lo=.1)
    for k in range(2):                                        # 흙 알갱이 결(밝은 위 + 어두운 아래 2px) — 드물게
        x = int(h(k, 3, 61) * 16); y = int(h(k, 4, 62) * 16)
        put(a, x, y, DIRT[5]); put(a, x, y + 1, DIRT[3])
    # 2칸 폭 길은 모두 가장자리 칸이라 몸통 변형이 안 들어간다 → 몸통에 눈에 띄는 돌을 두면 16px 마다 같은 돌이 줄 선다. 잔돌 하나만.
    put(a, 5, 11, PEBBLE[2]); put(a, 6, 11, PEBBLE[1]); put(a, 6, 12, DIRT[2])
    x = 3 + int(h(0, 5, 81) * 9); y = 3 + int(h(0, 6, 82) * 9)   # 잔금 하나
    put(a, x, y, DIRT[2]); put(a, x + 1, y + 1, DIRT[1]); put(a, x + 2, y + 1, DIRT[2])
    return a


def dirt_var(base, kind):
    a = base.copy()
    if kind == 1:                                             # 바퀴 자국 한 줄(가로) — 둘레 1줄은 그대로
        for x in range(2, 14):
            put(a, x, 7, DIRT[2]); put(a, x, 8, DIRT[3] if x % 3 else DIRT[1]); put(a, x, 6, DIRT[5] if x % 4 == 1 else a[6, x])
    else:                                                     # 잔돌 무리 + 풀 한 포기
        for (x, y, b) in ((4, 5, True), (8, 9, False), (11, 6, False), (6, 11, True)):
            _pebble(a, x, y, b)
        _tuft(a, 10, 10, 1)
    return a


GRASS_EDGE = {   # 풀이 흙 위로 덮는 깊이(16 주기, 이웃 칸과 끝-처음 차 ≤1)
    'N': [3, 4, 4, 3, 2, 3, 4, 5, 4, 3, 3, 2, 2, 3, 4, 3],
    'S': [2, 2, 3, 3, 2, 1, 2, 3, 3, 4, 3, 2, 2, 2, 3, 2],
    'W': [3, 3, 4, 3, 2, 2, 3, 4, 4, 3, 2, 3, 3, 2, 3, 3],
    'E': [2, 3, 3, 2, 2, 3, 3, 2, 1, 2, 3, 3, 2, 2, 2, 2],
}


def _grass_px(x, y):
    return tuple(int(v) for v in _GRASS_TEX[y % 16, x % 16])


def style_dirt(side, d, s, x, y):
    """흙길(member)/바깥 = 시골 풀밭. 풀 테가 흙 위로 삐죽, 풀끝 빛, 북·서 테는 흙 위로 그늘(빛 왼쪽 위)."""
    depth = GRASS_EDGE[side][s % 16]
    if d < depth - 1:
        return _grass_px(x, y)
    if d == depth - 1:                                        # 풀 끝: 들쭉날쭉 잎끝
        return GRASS[6] if (s + d) % 3 == 0 else GRASS[5]
    if d == depth:
        if side in 'NW':
            return DIRT[2]                                     # 풀이 드리운 그늘(한 단만 — 두 단이면 흙 카펫 테두리로 읽힌다)
        return DIRT[3] if (s % 3 == 0) else None
    if d == depth + 1 and side in 'NW' and s % 3 == 0:
        return DIRT[3]
    return None


# ═══════════════════════════ 개울 ═══════════════════════════
def stream_body() -> np.ndarray:
    W = WATER
    a = blank(W[2])
    mottle(a, W, (2, 1, 3), 91, lo=.18, hi=.9)
    for k in range(5):                                        # 물밑 자갈(물에 잠겨 한 단 흐림)
        cx, cy = h(k, 1, 92) * 16, h(k, 2, 93) * 16
        blob(a, cx, cy, 1.6, 1.0, W[3]); put(a, int(cx) - 1, int(cy) - 1, W[4]); put(a, int(cx) + 1, int(cy) + 1, W[1])
    # 물살: 가로로 길고 끝이 가늘어지는 밝은 결(머리·꼬리 같은 밝기 → 화살표로 읽히지 않게), 아래 1px 물 그늘. 반짝은 따로 드문 점.
    for k in range(3):
        x = int(h(k, 3, 94) * 16); y = 2 + int(h(k, 4, 95) * 12); ln = 3 + int(h(k, 5, 96) * 4)
        for i in range(ln):
            put(a, x + i, y, W[4] if 0 < i < ln - 1 else W[3])
            if 1 < i < ln - 2:
                put(a, x + i, y + 1, W[1])
    put(a, int(h(9, 3, 97) * 16), int(h(9, 4, 98) * 16), W[6])
    return a


def stream_var(base, kind):
    a = base.copy()
    W = WATER
    if kind == 1:                                             # 물살이 갈라지는 돌 하나
        blob(a, 8, 8, 2.2, 1.4, PEBBLE[2], wrap=False); put(a, 7, 7, PEBBLE[4]); put(a, 8, 7, PEBBLE[3]); put(a, 9, 9, PEBBLE[0])
        for x in range(3, 6):
            put(a, x, 8, W[4])
        put(a, 11, 7, W[5]); put(a, 11, 9, W[4]); put(a, 12, 9, W[4])
    else:                                                     # 소용돌이 반짝
        for (x, y) in ((5, 5), (6, 4), (7, 4), (8, 5), (10, 10), (11, 11)):
            put(a, x, y, W[4])
        put(a, 7, 4, W[5])
    return a


def style_stream(side, d, s, x, y):
    """개울(member)/바깥 = 풀밭. 북쪽 둑: 풀 입술 → 흙 둑 앞면(돌 박힘) → 젖은 선 → 물 그늘. 남·옆: 풀 입술 + 젖은 선 + 물가 빛."""
    G, D, W = GRASS, DIRT, WATER
    if side == 'N':
        lip = 2 + (GRASS_EDGE['N'][s % 16] > 3)
        if d < lip - 1:
            return _grass_px(x, y)
        if d == lip - 1:
            return G[5] if s % 3 else G[6]
        face = d - lip                                         # 흙 둑 앞면 4줄(위 밝음 → 아래 어둠)
        if 0 <= face < 4:
            if (s // 4 + face // 2) % 3 == 0 and face in (1, 2):
                return PEBBLE[3] if face == 1 else PEBBLE[1]  # 둑에 박힌 돌
            return (D[3], D[2], D[1], D[1])[face] if (s + face) % 5 else (D[4], D[3], D[2], D[0])[face]
        if face == 4:
            return D[0]                                        # 젖은 둑 발치
        if face == 5:
            return W[0]
        if face in (6, 7):
            return W[1]                                        # 둑 아래 깊은 물 그늘
        if face == 8:
            return W[1] if s % 2 else None
        return None
    if side == 'S':
        lip = GRASS_EDGE['S'][s % 16]
        if d < lip:
            return _grass_px(x, y) if d < lip - 1 else (G[3] if s % 2 else G[2])   # 풀 둑 윗면, 물 쪽 끝은 어둠
        if d == lip:
            return D[1]
        if d == lip + 1:
            return W[4] if s % 3 else W[6]                     # 물가 빛
        return None
    lip = 2 + (GRASS_EDGE[side][s % 16] > 3)
    if d < lip - 1:
        return _grass_px(x, y)
    if d == lip - 1:
        return G[5] if side == 'E' else G[3]
    if d == lip:
        return D[2] if side == 'W' else D[3]
    if d == lip + 1:
        return W[1] if side == 'W' else W[4] if s % 3 else W[3]
    if d == lip + 2 and side == 'W':
        return W[1] if s % 2 else None
    return None


# ═══════════════════════════ 논 ═══════════════════════════
def paddy_water_body(seed=0) -> np.ndarray:
    """모내기 물논: 하늘 비친 잔잔한 물(넓은 밝은 덩이 + 구름 비침) + 4px 간격 줄에 4px 간격으로 심은 작은 모(잎 2·끝 빛·물 그림자)."""
    M = MUD_WATER
    a = blank(M[3])
    mottle(a, M, (3, 2, 4), 101 + seed * 13, cell=4, lo=.1, hi=.93)
    if seed % 2 == 0:
        x = int(h(0, 1, 102 + seed) * 12); y = 3 + int(h(0, 2, 103 + seed) * 10)  # 구름 비침 한 줄
        for i in range(4):
            put(a, x + i, y, M[4])
        put(a, x + 1, y, M[5])
    for j, y in enumerate((1, 5, 9, 13)):
        for i in range(4):
            if h(i, j, 107 + seed) < .08:
                continue                                       # 빈 자리(모가 빠짐)
            x = i * 4 + 1 + (h(i, j, 109 + seed) < .2)
            put(a, x, y, RICE[6] if (i + j) % 3 else RICE[5]); put(a, x, y + 1, RICE[3]); put(a, x - 1, y + 1, RICE[4])
            put(a, x + 1, y + 1, M[1]); put(a, x, y + 2, M[2])   # 물에 진 그림자(오른쪽 아래)
    return a


def _rice_clumps(a, R, water, seed, droop=False):
    """벼 줄(버들항 밭 이랑처럼 굵게): 8px 마다 한 줄 — 잎끝이 1~2px 들쭉날쭉 솟은 위 실루엣(빛),
    몸 4줄(빛→몸→몸→그늘), 짙은 밑동 1줄, 포기 사이 고랑 1~2줄(물·그늘). 포기(株)는 4~6px 마다 그늘 틈으로 갈린다.
    숙인 이삭(황금)은 잎끝이 오른쪽으로 꺾인다."""
    for j in range(2):
        y0 = j * 8 + 1
        cut = [x for x in range(16) if h(x, j, seed + 7) < .2]     # 포기 사이 틈
        for x in range(16):
            v = h(x, j, seed)
            spike = 2 if v < .25 else 1 if v < .7 else 0
            for k in range(1, spike + 1):
                put(a, x, y0 - k, R[6] if k == spike else R[5])
            gap = x in cut
            put(a, x, y0, R[5] if not gap else R[3])
            put(a, x, y0 + 1, R[4] if h(x, j, seed + 1) < .7 else R[5])
            put(a, x, y0 + 2, (R[4] if h(x, j, seed + 2) < .55 else R[3]) if not gap else R[2])
            put(a, x, y0 + 3, R[3] if not gap else R[2])
            put(a, x, y0 + 4, R[2] if h(x, j, seed + 3) < .8 else R[1])
            put(a, x, y0 + 5, R[1] if h(x, j, seed + 4) < .6 else water[1])
            put(a, x, y0 + 6, water[1] if h(x, j, seed + 5) < .5 else water[2])
            if droop and spike and v < .3:
                put(a, x + 1, y0 - spike + 1, R[6])
    return a


def paddy_summer_body(seed=0) -> np.ndarray:
    """여름 푸른 논: 빽빽하게 자란 벼 포기 덩이(6단 녹색) + 포기 사이로 비치는 어두운 물."""
    return _rice_clumps(blank(RICE[2]), RICE, [MUD_WATER[0], P('ki', 1), P('ki', 2)], 111 + seed * 17)


def paddy_golden_body(seed=0) -> np.ndarray:
    """가을 황금 논: 고개 숙인 이삭 포기(8단 황금) + 마른 논흙 틈."""
    G = GOLD
    return _rice_clumps(blank(G[2]), [G[0], G[1], G[2], G[3], G[5], G[6], G[7]], [P('soil', 1), P('soil', 2), G[1]], 121 + seed * 17, droop=True)


def _paddy_var(base, kind, ramp):
    a = base.copy()
    if kind == 1:   # 빈 포기 자리(물이 드러남)
        for (x, y) in ((6, 6), (7, 6), (6, 7)):
            put(a, x, y, MUD_WATER[2])
        put(a, 7, 7, MUD_WATER[4])
    else:           # 짙은 포기 덩이
        for (x, y) in ((9, 9), (10, 9), (9, 10), (10, 10)):
            put(a, x, y, ramp[2])
        put(a, 9, 9, ramp[4])
    return a


def style_paddy(fill_ramp):
    """논(member)/바깥 = 무엇이든. 논두렁(畦) 둑을 논 칸 안에 그린다: 풀 어깨 + 닳은 흙 윗면 + 풀 어깨, 그 안쪽에 둑 안벽.
    3/4: 북쪽 둑은 남향 안벽(흙 2줄)이 물로 떨어지고, 남쪽 둑은 바깥 남향 비탈(흙 2줄)이 칸 맨 아래에 보인다. 서쪽 안벽 = 그늘, 동쪽 안벽 = 빛."""
    G, D, M = GRASS, DIRT, MUD_WATER

    def ridge(i, s):
        """둑 윗면 단면 i(0 바깥 어깨 … 4 안 어깨)."""
        if i == 0:
            return G[3] if s % 3 else G[2]
        if i == 1:
            return G[4] if h(s, 1, 131) < .6 else G[5]
        if i in (2, 3):
            v = h(s, i, 132)
            return D[5] if v < .35 else D[4] if v < .8 else G[4]
        return G[5] if h(s, 4, 133) < .5 else G[4]

    def f(side, d, s, x, y):
        if side == 'N':
            if d < 5:
                return ridge(d, s)
            if d == 5:
                return D[3] if s % 5 else D[4]
            if d == 6:
                return D[2]
            if d == 7:
                return D[0] if s % 3 else D[1]
            if d == 8:
                return M[0] if s % 2 == 0 else fill_ramp[1]
            return None
        if side == 'S':
            if d == 0:
                return D[2]
            if d == 1:
                return D[3] if s % 4 else D[4]
            if d < 7:
                return ridge(d - 2, s)
            if d == 7:
                return M[5] if s % 3 else M[6]
            return None
        if d < 5:
            return ridge(d, s)
        if d == 5:
            return D[1] if side == 'W' else D[4]
        if d == 6 and side == 'W':
            return M[0] if s % 2 else fill_ramp[1]
        return None
    return f


# ═══════════════════════════ 오토타일 묶기 ═══════════════════════════
_GRASS_TEX = grass_body()


def _sets():
    gb, db, sb = _GRASS_TEX, dirt_body(), stream_body()
    pw, ps, pg = paddy_water_body(), paddy_summer_body(), paddy_golden_body()
    none = lambda side, d, s, x, y: None  # noqa: E731
    return [
        dict(key='grass', id='jp-inaka-at-grass', name='시골 풀밭', role='green', tex=gb, style=none,
             var=(grass_var(gb, 1), grass_var(gb, 2), grass_body(1), grass_body(2), grass_body(3)),
             pc='floor', flat=True, weights=(3, 1, 1, 2, 2, 2),
             desc='시골 여름 풀밭(기본 대지). 풀포기·잎끝 빛·그늘 덩이 6단 녹색. 가장자리를 그리지 않는다 — 흙길·개울·논이 자기 쪽에 풀 테·둑을 그린다.'),
        dict(key='dirt', id='jp-inaka-at-dirt', name='시골 흙길', role='path', tex=db, style=style_dirt, var=(dirt_var(db, 1), dirt_var(db, 2)),
             pc='floor', weights=(3, 1, 1),
             desc='논두렁·마당·고갯길 흙길. 다진 흙 덩이·흙 알갱이·잔돌·바퀴 자국. 풀밭과 닿는 가장자리는 풀이 흙 위로 삐죽 덮고 북·서 풀 테 아래로 그늘이 진다.'),
        dict(key='stream', id='jp-inaka-at-stream', name='시골 개울', role='water', tex=sb, style=style_stream, var=(stream_var(sb, 1), stream_var(sb, 2)),
             pc='solidfloor', weights=(3, 1, 1),
             desc='맑고 얕은 시골 개울(지나갈 수 없음). 물밑 자갈이 비치고 물살이 반짝인다. 북쪽은 흙 둑 앞면(박힌 돌)·젖은 선, 남·옆은 풀 둑 입술과 물가 빛.'),
        dict(key='paddy-water', id='jp-inaka-at-paddy-water', name='시골 물논', role='terrain', tex=pw, style=style_paddy(MUD_WATER),
             var=(_paddy_var(pw, 1, RICE), _paddy_var(pw, 2, RICE), paddy_water_body(1), paddy_water_body(2), paddy_water_body(3)), pc='solidfloor', weights=(3, 1, 1, 3, 3, 3),
             desc='모내기 물논(지나갈 수 없음). 하늘 비친 물에 줄지어 심은 모. 논 가장자리에 풀 덮인 논두렁 둑이 저절로 생긴다(북쪽 둑은 흙 앞면이 물로 떨어진다).'),
        dict(key='paddy-summer', id='jp-inaka-at-paddy-summer', name='시골 여름 논', role='terrain', tex=ps, style=style_paddy(RICE),
             var=(_paddy_var(ps, 1, RICE), _paddy_var(ps, 2, RICE), paddy_summer_body(1), paddy_summer_body(2), paddy_summer_body(3)), pc='solidfloor', weights=(3, 1, 1, 3, 3, 3),
             desc='여름 푸른 논(지나갈 수 없음). 포기 줄마다 벼 덩이(빛·몸·그늘)와 고랑. 가장자리에 논두렁 둑이 저절로 생긴다.'),
        dict(key='paddy-golden', id='jp-inaka-at-paddy-golden', name='시골 황금 논', role='terrain', tex=pg, style=style_paddy(GOLD),
             var=(_paddy_var(pg, 1, GOLD), _paddy_var(pg, 2, GOLD), paddy_golden_body(1), paddy_golden_body(2), paddy_golden_body(3)), pc='solidfloor', weights=(3, 1, 1, 3, 3, 3),
             desc='가을 황금 논(지나갈 수 없음). 고개 숙인 이삭 줄과 그늘 고랑. 가장자리에 논두렁 둑이 저절로 생긴다. 볏단 걸이와 짝.'),
    ]


_PAINT: dict[str, list] = {}


def painted(S) -> list:
    if S['key'] not in _PAINT:
        if S.get('flat'):
            _PAINT[S['key']] = [(255, S['tex']), ('b1', S['var'][0]), ('b2', S['var'][1])]
        else:
            _PAINT[S['key']] = GA.build_set(S['tex'], S['style'], S['var'][:2], None, None)
        _PAINT[S['key']] += [('b%d' % (i + 3), v) for i, v in enumerate(S['var'][2:])]   # 몸통 변형 더(넓은 논·풀밭 벽지 깨기)
    return _PAINT[S['key']]


def autotile_cells():
    """(cells{loc: (rgba, pc, label, desc, tags)}, autotiles[], groups[]) — bake_inaka 가 칸으로 굽는다."""
    cells: dict[str, tuple] = {}
    autotiles, groups = [], []
    sets = _sets()
    others = {S['id'] for S in sets}
    for S in sets:
        def loc(k, S=S):
            return 'at/%s.%s' % (S['key'], ('m%d' % k) if isinstance(k, int) else k)
        members = []
        for k, a in painted(S):
            members.append(loc(k))
            lab = '%s · %s' % (S['name'], GA.describe_mask(k) if isinstance(k, int) else '몸통 변형 ' + k[1:])
            cells[loc(k)] = (a, S['pc'], lab, '[이나카 시골 팩] %s 오토타일 칸. %s' % (S['name'], S['desc']), ['autotile', 'ground', '일본 시골', 'inaka', S['key']])
        if S.get('flat'):
            vm = {str(m): loc(255) for m in range(256)}
            conn = list(members) + ['other:' + o for o in others if o != S['id']]
        else:
            vm = GA.variant_map(lambda m: loc(m))
            conn = list(members)
        w3 = S['weights']
        body = [loc(255)] * w3[0] + [loc('b%d' % i) for i in range(1, len(w3)) for _ in range(w3[i])]
        autotiles.append(dict(id=S['id'], name=S['name'], neighborhood=8, layer='lower', member=members, connect=conn,
                              variantMap=vm, interior=[list(body), list(body)], edgeConnects=True))
        groups.append(dict(id='jp:' + S['id'][3:], name=S['name'], role=S['role'], defaultLayer='lower', cells=list(members), desc=S['desc'],
                           rules='8방 오토타일(fill_region 재료 「%s」). 맵 밖은 이어진 것으로 본다. 가장자리 그림은 이 재료 쪽 칸에 그린다.' % S['name']))
    return cells, autotiles, groups


# ═══════════════════════════ 단일 칸 그룹(R1~R4 번호 유지) ═══════════════════════════
def _from(arr_fn):
    def draw(c):
        a = arr_fn()
        for y in range(16):
            for x in range(16):
                r, g, b = (int(v) for v in a[y, x, :3])
                c.P(x, y, (r << 16) | (g << 8) | b)
    return draw


def gravel_road_body() -> np.ndarray:
    """시골 자갈 신작로: 흙 바탕에 굵은 자갈 무리(돌마다 빛·그늘)."""
    a = dirt_body()
    for k in range(9):
        _pebble(a, int(h(k, 7, 141) * 16), int(h(k, 8, 142) * 16), big=k % 3 == 0)
    return a


def canal_water_body() -> np.ndarray:
    """농수로 물: 흐르는 짙은 물(남색 → 청록 5단) + 흐름 줄."""
    a = blank(P('canal_indigo', 2))
    mottle(a, [P('canal_indigo', 1), P('canal_indigo', 2), P('canal_indigo', 3), P('onsen_mineral_teal', 2)], (2, 1, 3), 151)
    for k in range(6):
        x = int(h(k, 1, 152) * 16); y = int(h(k, 2, 153) * 16)
        for i in range(4):
            put(a, x + i, y, P('canal_indigo', 4))
        put(a, x + 4, y, P('vending_cool_white', 3)); put(a, x, y + 1, P('canal_indigo', 0))
    return a


def canal_wall_body() -> np.ndarray:
    """농수로 석축: 윗면 연석(빛 2줄) + 젖은 돌 정면(돌마다 4단) + 이끼 + 물선."""
    a = blank(P('wet_cobble', 2))
    for x in range(16):
        a[0, x] = P('paving_stone', 4); a[1, x] = P('paving_stone', 3) if x % 8 else P('paving_stone', 2)
        a[2, x] = P('paving_stone', 3); a[3, x] = P('paving_stone', 1)
    for y in range(4, 13):
        row = (y - 4) // 3
        for x in range(16):
            sx = (x + row * 3) % 6; sy = (y - 4) % 3
            stone = (x + row * 3) // 6 + row * 7
            tone = 2 + int(h(stone, row, 161) * 2)
            col = P('wet_cobble', tone + (1 if sy == 0 and sx < 4 else 0))
            if sx == 5 or sy == 2:
                col = P('wet_cobble', 0)
            elif y >= 10 and h(x, y, 162) < .35:
                col = P('moss', 2) if h(x, y, 163) < .6 else P('moss', 3)
            a[y, x] = col
    for x in range(16):
        a[13, x] = P('canal_indigo', 1); a[14, x] = P('canal_indigo', 2); a[15, x] = P('canal_indigo', 2) if x % 5 else P('canal_indigo', 4)
    return a


def furrow_body() -> np.ndarray:
    """채소밭 이랑(버들항 밭처럼): 이랑마다 윗면 빛·흙 몸·고랑 그늘 + 포기(잎 4단, 흙에 진 그늘)."""
    S = [P('soil', 0), P('soil', 1), P('soil', 2), P('soil', 3), P('yuka', 2)]
    a = blank(S[2])
    for y in range(16):
        r = y % 8
        for x in range(16):
            if r in (6, 7):
                a[y, x] = S[0] if r == 7 else S[1]
            elif r == 0:
                a[y, x] = S[4] if h(x, y, 171) < .5 else S[3]
            else:
                a[y, x] = S[3] if h(x, y, 172) < .3 else S[2]
    L = [P('midori', 0), P('midori', 1), P('ki', 4), P('midori', 2), P('ki', 6)]
    for (x, y) in ((2, 1), (10, 1), (6, 9), (14, 9)):
        put(a, x + 2, y + 4, S[0]); put(a, x + 3, y + 4, S[1])
        for dx, dy, t in ((0, 0, 4), (1, 0, 3), (-1, 1, 3), (0, 1, 2), (1, 1, 2), (2, 1, 1), (0, 2, 1), (1, 2, 1), (-1, 2, 2), (2, 2, 0), (1, 3, 0)):
            put(a, x + dx, y + dy, L[t])
    return a


# ═══════════════════ 단일 칸 바닥(R14: 넓게 깔아도 16px 격자가 안 보이게) ═══════════════════
# 단일 칸은 변형 없이 같은 칸만 되풀이되므로, 눈에 띄는 무리 하나가 서면 16px 마다 줄·대각선·물방울 무늬가 선다.
# 작은 결을 칸 전체에 고르게(토러스 거리로 서로 떨어지게) 흩고, 크기·간격·톤을 섞어 주된 줄·열·대각선이 없게 한다.
def _scatter(n: int, mind: float, seed: int, tries: int = 400) -> list[tuple[int, int]]:
    """16×16 토러스 위 결정적 포아송 원반 흩뿌림(같은 입력 → 같은 점). 같은 행·열에 3개 이상 몰리지 않게 한다."""
    pts: list[tuple[int, int]] = []
    rows: collections.Counter = collections.Counter()
    cols: collections.Counter = collections.Counter()
    for t in range(tries):
        if len(pts) >= n:
            break
        x = int(GA.h01(t, 1, seed) * 16) % 16
        y = int(GA.h01(t, 2, seed) * 16) % 16
        if rows[y] >= 2 or cols[x] >= 2:
            continue
        ok = True
        for (px, py) in pts:
            dx = min(abs(px - x), 16 - abs(px - x)); dy = min(abs(py - y), 16 - abs(py - y))
            if dx * dx + dy * dy < mind * mind:
                ok = False; break
        if ok:
            pts.append((x, y)); rows[y] += 1; cols[x] += 1
    return pts


def _speckle(a, col, seed, rate):
    for y in range(16):
        for x in range(16):
            if h(x, y, seed) < rate:
                a[y, x] = col


def aze_path_body() -> np.ndarray:
    """논두렁·흙마당 단일 칸: 다진 흙 + 칸 전체에 흩어진 잔 알갱이·잔돌 + 옅은 풀싹. 가로 돌 줄을 두지 않는다."""
    a = blank(DIRT[4])
    _speckle(a, DIRT[3], 201, .10)                               # 다진 흙 얼룩(1px, 옅게)
    pts = _scatter(14, 3.2, 202, tries=900)
    for i, (x, y) in enumerate(pts):
        k = i % 5
        if k == 0:                                              # 알갱이: 빛 위 + 그늘 아래
            put(a, x, y, DIRT[5]); put(a, x, y + 1, DIRT[2])
        elif k == 1:                                            # 잔돌 한 알
            put(a, x, y, PEBBLE[2]); put(a, x + 1, y + 1, DIRT[2])
        elif k == 2:                                            # 패인 점
            put(a, x, y, DIRT[2]); put(a, x - 1, y, DIRT[3])
        elif k == 3:                                            # 밝은 흙 알
            put(a, x, y, DIRT[5])
        elif i in (4, 9):                                       # 옅은 풀싹(따뜻한 잎끝 1 + 그늘 1)
            put(a, x, y, GRASS[5]); put(a, x, y + 1, DIRT[2])
        else:
            put(a, x, y, DIRT[3]); put(a, x + 1, y, DIRT[2])
    return a


def gravel_road_tile_body() -> np.ndarray:
    """자갈 신작로 단일 칸: 다진 흙 위 촘촘한 잔자갈(돌 3~4톤, 1~2px, 돌마다 오른쪽 아래 그늘)."""
    a = blank(DIRT[3])
    _speckle(a, DIRT[4], 211, .35)                              # 다진 흙(두 톤 섞임)
    _speckle(a, DIRT[2], 212, .08)
    pts = _scatter(26, 2.3, 213, tries=900)
    for i, (x, y) in enumerate(pts):
        tone = 1 + int(h(i, 3, 214) * 3.99)                     # 1..4
        r = h(i, 4, 215)
        put(a, x + 1, y + 1, DIRT[1]); put(a, x, y + 1, DIRT[2])
        put(a, x, y, PEBBLE[tone])
        if r < .2:                                              # 가로 긴 돌
            put(a, x + 1, y, PEBBLE[max(0, tone - 1)]); put(a, x + 2, y + 1, DIRT[1])
        elif r < .35:                                           # 세로 긴 돌
            put(a, x, y + 1, PEBBLE[max(0, tone - 1)]); put(a, x, y + 2, DIRT[2]); put(a, x + 1, y + 2, DIRT[1])
    return a


def canal_water_tile_body() -> np.ndarray:
    """농수로 물 단일 칸: 짙은 흐르는 물 + 칸 곳곳에 짧은 가로 물살(길이 2~4, 행이 겹치지 않게)."""
    a = blank(P('canal_indigo', 2))
    _speckle(a, P('canal_indigo', 1), 221, .22)
    _speckle(a, P('canal_indigo', 3), 222, .05)
    used_rows: set[int] = set()
    for i, (x, y) in enumerate(_scatter(6, 4.2, 223)):
        if y in used_rows:
            y = (y + 1) % 16
        used_rows.add(y)
        ln = 2 + int(h(i, 5, 224) * 2.99)
        for j in range(ln):
            put(a, x + j, y, P('canal_indigo', 4) if 0 < j < ln - 1 or ln == 2 else P('canal_indigo', 3))
        put(a, x + 1, y + 1, P('canal_indigo', 1))
    return a


def meadow_flower_body() -> np.ndarray:
    """여름 풀밭(토끼풀 꽃) 단일 칸: 풀 몸 + 흩어진 풀 그늘·잎끝 + 크기 둘의 토끼풀 꽃을 고르지 않게(한 번에 흩어 행·열이 겹치지 않음)."""
    W4, W2 = P('vending_cool_white', 4), P('vending_cool_white', 2)
    a = blank(GRASS[4])
    _speckle(a, GRASS[3], 231, .09)
    _speckle(a, GRASS[5], 232, .03)
    pts = _scatter(11, 3.3, 233, tries=900)
    for i, (x, y) in enumerate(pts):
        if i in (0, 6):                                         # 큰 꽃(둥근 머리 3px + 잎 그늘)
            put(a, x, y, W4); put(a, x + 1, y, W2); put(a, x, y + 1, W2)
            put(a, x + 1, y + 1, GRASS[2]); put(a, x, y + 2, GRASS[2])
        elif i in (2, 4, 8, 10):                                # 작은 꽃(1px)
            put(a, x, y, W2 if i % 4 else W4); put(a, x, y + 1, GRASS[2])
        elif i == 5:                                            # 꽃봉오리(덜 핀 흰 꽃, 1px 흐림)
            put(a, x, y, W2); put(a, x + 1, y, GRASS[3])
        else:                                                   # 풀잎 획
            put(a, x, y, GRASS[6] if i % 2 else GRASS[5]); put(a, x, y + 1, GRASS[3])
    return a


_BODY = {
    'gnd/inaka-paddy-water': (paddy_water_body, 'solidfloor'),
    'gnd/inaka-paddy-summer': (paddy_summer_body, 'solidfloor'),
    'gnd/inaka-paddy-golden': (paddy_golden_body, 'solidfloor'),
    'gnd/inaka-aze-path': (aze_path_body, 'floor'),
    'gnd/inaka-canal-water': (canal_water_tile_body, 'solidfloor'),
    'gnd/inaka-canal-wall': (canal_wall_body, 'solidfloor'),
    'gnd/inaka-gravel-road': (gravel_road_tile_body, 'floor'),
    'gnd/inaka-river-shallow': (stream_body, 'solidfloor'),
    'gnd/inaka-meadow-wildflower': (meadow_flower_body, 'floor'),
    'gnd/inaka-vegetable-furrow': (furrow_body, 'solidfloor'),
}

GROUND: Final[collections.OrderedDict[str, tuple[Callable[[Cv], None], str]]] = collections.OrderedDict(
    (k, (_from(fn), pc)) for k, (fn, pc) in _BODY.items()
)

GROUND_GROUPS: Final[tuple[tuple[str, str, list[str], str], ...]] = (
    ('jp:inaka-paddy-water', 'inaka-paddy-water', ['gnd/inaka-paddy-water'], '논(모내기 물논) 한 칸 — 둑 없이 쓰는 몸통. 넓은 논은 오토타일 「시골 물논」으로 깔아 둑을 저절로 두른다.'),
    ('jp:inaka-paddy-summer', 'inaka-paddy-summer', ['gnd/inaka-paddy-summer'], '논(푸른 여름 벼) 한 칸 — 넓은 논은 오토타일 「시골 여름 논」.'),
    ('jp:inaka-paddy-golden', 'inaka-paddy-golden', ['gnd/inaka-paddy-golden'], '논(황금 가을 벼) 한 칸 — 넓은 논은 오토타일 「시골 황금 논」.'),
    ('jp:inaka-aze-path', 'inaka-aze-path', ['gnd/inaka-aze-path'], '논두렁·시골 흙마당 한 칸(가장자리 없음). 길은 오토타일 「시골 흙길」.'),
    ('jp:inaka-canal-water', 'inaka-canal-water', ['gnd/inaka-canal-water'], '농수로 물(用水路) — 흐르는 짙은 물.'),
    ('jp:inaka-canal-wall', 'inaka-canal-wall', ['gnd/inaka-canal-wall'], '농수로 석축 — 3/4 윗면 연석과 젖은 돌 정면·이끼·물선. 수로 북쪽 가장자리에 한 줄.'),
    ('jp:inaka-gravel-road', 'inaka-gravel-road', ['gnd/inaka-gravel-road'], '시골 자갈 신작로 — 흙 바탕에 굵은 자갈.'),
    ('jp:inaka-river-shallow', 'inaka-river-shallow', ['gnd/inaka-river-shallow'], '시골 맑은 개울 한 칸(둑 없음). 개울은 오토타일 「시골 개울」.'),
    ('jp:inaka-meadow-wildflower', 'inaka-meadow-wildflower', ['gnd/inaka-meadow-wildflower'], '여름 풀밭(토끼풀 꽃) 한 칸. 넓은 풀밭은 오토타일 「시골 풀밭」.'),
    ('jp:inaka-vegetable-furrow', 'inaka-vegetable-furrow', ['gnd/inaka-vegetable-furrow'], '채소밭 이랑 — 흙 이랑과 양배추 포기. 걸을 수 없다.'),
)


# ═══════════════════════════ 눈 확인 ═══════════════════════════
def demo_map(out_png: str, scale: int = 3) -> str:
    """흙길·개울·논 3종을 풀밭에 깐 32×20 시험 지도(8방 마스크로 칸을 고른다)."""
    from PIL import Image
    W_, H_ = 32, 20
    mat = [['grass'] * W_ for _ in range(H_)]

    def fill(x0, y0, w, hh, m):
        for y in range(y0, y0 + hh):
            for x in range(x0, x0 + w):
                if 0 <= x < W_ and 0 <= y < H_:
                    mat[y][x] = m
    fill(0, 8, 32, 2, 'dirt'); fill(14, 0, 2, 20, 'dirt'); fill(16, 3, 3, 1, 'dirt')
    fill(1, 1, 6, 6, 'paddy-water'); fill(7, 1, 6, 6, 'paddy-summer'); fill(18, 11, 8, 6, 'paddy-golden')
    fill(1, 11, 6, 5, 'paddy-summer')
    for y in range(H_):
        cx = 27 + (1 if y % 6 < 3 else 0) - (1 if y % 6 == 5 else 0)
        fill(cx, y, 3, 1, 'stream')
    fill(20, 1, 4, 3, 'stream')
    sets = {S['key']: S for S in _sets()}
    tiles = {k: dict(painted(S)) for k, S in sets.items()}
    img = Image.new('RGBA', (W_ * 16, H_ * 16))
    for y in range(H_):
        for x in range(W_):
            m = mat[y][x]
            S = sets[m]
            if S.get('flat'):
                key = 255
            else:
                bits = 0
                for nb, (dx, dy) in dict(N=(0, -1), E=(1, 0), S=(0, 1), W=(-1, 0), NE=(1, -1), SE=(1, 1), SW=(-1, 1), NW=(-1, -1)).items():
                    xx, yy = x + dx, y + dy
                    if not (0 <= xx < W_ and 0 <= yy < H_) or mat[yy][xx] == m:
                        bits |= GA.DIRS[nb]
                key = GA.canon(bits)
            a = tiles[m][key]
            if key == 255:
                v = GA.h01(x, y, 7)
                a = tiles[m]['b1'] if v < .18 else tiles[m]['b2'] if v < .32 else a
            img.paste(Image.fromarray(a, 'RGBA'), (x * 16, y * 16))
    img.save(out_png)
    img.resize((img.width * scale, img.height * scale), Image.Resampling.NEAREST).save(out_png.replace('.png', '-x%d.png' % scale))
    return out_png


if __name__ == '__main__':
    print(demo_map(sys.argv[1] if len(sys.argv) > 1 else '/tmp/inaka-r5/ground-demo.png'))
