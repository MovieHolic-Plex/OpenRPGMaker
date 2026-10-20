#!/usr/bin/env python3
# noqa: SIZE_OK - jp-inaka rural vehicles/props (3/4 top-down) + seamless rural ground tiles
# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "pillow"]
# ///
# --- How to run ---
# python3 scripts/content/jp-inaka/bake_inaka.py
"""jp-inaka 소품·탈것 19종 + 시골 바닥 10종.

탈것은 jp_city parts_vehicles / vehicles/cars.py 관례: 밝은 지붕·보닛·짐칸 윗면(+2/+1) → 접힘선 → 어두운 옆면,
바퀴집은 옆면을 파고 들어간 어두운 반원, 타이어 + 휠캡, 전체 1px sumi 윤곽. 오른쪽(동)을 보고 선다.
바닥은 jp_shopstreet16 잔디/물 칩(chip)과 jp_regions_pack 의 칸 해시 클러스터(H) 관례: 16 주기 이음매 없음,
가로 줄무늬·소용돌이 없음, 대비 낮은 2~3px 덩이만.
"""
from __future__ import annotations

import collections
import math
from typing import Callable, Final


from inaka_art_houses import (  # noqa: E402
    OL, Cv, H, J, K, add_outline, canopy_clusters, disc, kit, line, plinth_34, post, rect_3d, rows, shed, stones,
)
from inaka_style import ground_shadow, tint_outlines  # noqa: E402

# ═══════════════════════════ R5 명암 도우미 ═══════════════════════════
# 색 목록은 밝음 → 어둠 순서. 단 사이는 4×4 베이어 디더로 섞는다(난수 없음, 위치 고정).
_BAYER: Final = ((0, 8, 2, 10), (12, 4, 14, 6), (3, 11, 1, 9), (15, 7, 13, 5))
SHADOW: Final = K('tairu', -2)

W_PAINT = [K('shiro', 2), K('shiro', 1), K('shiro', 0), K('conc', 1), K('shiro', -1), K('conc', -1)]
RED = [K('daidai', 2), K('aka', 2), K('aka', 1), K('aka', 0), K('aka', -1), K('aka', -2)]
ORANGE = [K('kii', 2), K('daidai', 2), K('daidai', 1), K('daidai', 0), K('daidai', -1), K('daidai', -2)]
RUBBER = [K('tekko', 0), K('tekko', -1), K('tekko', -2), K('sumi', 1)]
GLASS = [K('garasu', 3), K('garasu', 2), K('garasu', 1), K('garasu', 0), K('garasu', -1), K('garasu', -2)]
STEEL = [K('tekko', 3), K('tekko', 2), K('tekko', 1), K('tekko', 0), K('tekko', -1), K('tekko', -2)]
CONC = [K('conc', 3), K('conc', 2), K('conc', 1), K('conc', 0), K('conc', -1), K('conc', -2)]
CEDAR = [J('aged_cedar', 4), J('aged_cedar', 3), J('aged_cedar', 2), J('aged_cedar', 1), J('aged_cedar', 0), J('machiya_timber', 2)]
TIMBER = [J('machiya_timber', 4), J('machiya_timber', 3), J('machiya_timber', 2), J('machiya_timber', 1), J('machiya_timber', 0)]
STONE = [J('shrine_flagstone', 4), J('shrine_flagstone', 3), J('shrine_flagstone', 2), J('shrine_flagstone', 1), J('shrine_flagstone', 0), K('yoru', 0)]
STRAW = [J('lantern_amber', 4), J('lantern_amber', 3), J('tatami_straw', 3), J('lantern_amber', 2), J('tatami_straw', 2),
         J('tatami_straw', 1), J('lantern_amber', 1), J('lantern_amber', 0)]
LEAF = [K('ki', 3), K('ki', 2), K('ki', 1), K('ki', 0), K('ki', -1), K('ki', -2)]
SUN = [K('kii', 2), K('kii', 1), K('kii', 0), K('daidai', 0), K('kii', -1), K('kii', -2)]
SEED = [J('machiya_timber', 4), J('machiya_timber', 3), J('machiya_timber', 2), J('machiya_timber', 1), J('machiya_timber', 0)]
VERM = [J('torii_vermilion', 4), J('torii_vermilion', 3), J('torii_vermilion', 2), J('torii_vermilion', 1), J('torii_vermilion', 0)]
CREAM = [K('kinari', 2), K('kinari', 1), K('kinari', 0), K('kinari', -1), K('kinari', -2)]
GREEN_IRON = [K('midori', 2), K('midori', 1), K('midori', 0), K('kokuban', 0), K('midori', -1), K('midori', -2)]
SOIL = [K('soil', 2), K('soil', 1), K('soil', 0), K('soil', -1), K('soil', -2)]
VCW = [J('vending_cool_white', 4), J('vending_cool_white', 3), J('vending_cool_white', 2), J('vending_cool_white', 1),
       J('vending_cool_white', 0), K('conc', -1)]
INDIGO = [J('noren_indigo', 4), J('noren_indigo', 3), J('noren_indigo', 2), J('noren_indigo', 1), J('noren_indigo', 0)]
BRONZE = [J('lantern_amber', 4), J('lantern_amber', 3), J('lantern_amber', 2), J('lantern_amber', 1), J('lantern_amber', 0)]


def pick(cols, v, x, y):
    """밝기 단 v(0 = 가장 밝음, 소수 = 다음 단과 베이어 디더)."""
    n = len(cols)
    v = max(0.0, min(n - 1.0, v))
    i = int(v)
    if i + 1 < n and v - i > (_BAYER[y & 3][x & 3] + 0.5) / 16:
        i += 1
    return cols[i]


def vgrad(c, x, y, w, h, cols, v0, v1):
    for j in range(h):
        v = v0 + (v1 - v0) * (j / max(1, h - 1))
        for i in range(w):
            c.P(x + i, y + j, pick(cols, v, x + i, y + j))


def hgrad(c, x, y, w, h, cols, v0, v1):
    for i in range(w):
        v = v0 + (v1 - v0) * (i / max(1, w - 1))
        for j in range(h):
            c.P(x + i, y + j, pick(cols, v, x + i, y + j))


def cyl_lv(u, n, dark_left=1.1):
    """원통 가로 위치 u(-1 왼쪽 … 1 오른쪽) → 단. 빛은 왼쪽 위: u≈-0.45 가 가장 밝고 오른쪽으로 깊어진다."""
    if u < -0.45:
        return (-0.45 - u) / 0.55 * dark_left
    return (u + 0.45) / 1.45 * (n - 1)


def cyl(c, x, y, w, h, cols, add=0.0, grain=0.0, seed=0):
    for i in range(w):
        u = (i + 0.5) / w * 2 - 1
        for j in range(h):
            g = (H(x + i, (y + j) // 3, seed) - 0.5) * grain if grain else 0.0
            c.P(x + i, y + j, pick(cols, cyl_lv(u, len(cols)) + add + g, x + i, y + j))


def ball(c, cx, cy, r, cols, ry=None, bias=0.0, mask=None):
    """빛이 왼쪽 위인 공·타원 덩이(가장자리 약간 어둡게)."""
    ry = r if ry is None else ry
    n = len(cols)
    for y in range(int(cy - ry - 1), int(cy + ry + 2)):
        for x in range(int(cx - r - 1), int(cx + r + 2)):
            u, v = (x - cx) / r, (y - cy) / ry
            if u * u + v * v > 1.0:
                continue
            if mask is not None and not mask(x, y):
                continue
            s = (u + v) * 0.62 + (u * u + v * v) * 0.35 + bias
            c.P(x, y, pick(cols, (s + 0.45) / 1.65 * (n - 1), x, y))


def speck(c, x, y, w, h, col, p, seed):
    """이미 칠한 화소 위에만 위치 해시 점(때·녹·결)."""
    for j in range(h):
        for i in range(w):
            xx, yy = x + i, y + j
            if 0 <= xx < c.w and 0 <= yy < c.h and c.a[yy, xx, 3] and H(xx, yy, seed) < p:
                c.P(xx, yy, col)


def finish(c, shadow=None):
    """윤곽 → 재질색 윤곽 → 발치 그늘(투명 칸에만)."""
    add_outline(c)
    tint_outlines(c)
    for s in (shadow or ()):
        ground_shadow(c, *s)


def _ramps():
    """색 → (램프 목록(어둠 → 밝음), 그 안 위치). 윤곽을 「이웃 재질의 몇 단 어두운 색」으로 고를 때 쓴다."""
    import json as _json
    import os as _os
    from modern3_check import load_pal
    rs = {k: list(v) for k, v in load_pal().items() if k not in ('shiba', 'neonP', 'neonC')}
    root = _os.path.abspath(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..', '..', '..'))
    with open(_os.path.join(root, 'tiledata', 'jp-city', 'palette-contract.json'), encoding='utf-8') as f:
        for fam in _json.load(f)['families']:
            for m in fam['materials']:
                rs[m['id']] = [int(h[1:], 16) for h in m['steps']]
    own = {}
    for r in rs.values():
        for i, col in enumerate(r):
            own.setdefault(col, (r, i))
    return own


_RAMP_OF: Final = _ramps()


def soft_outline(c, steps=2):
    """add_outline 대신: 투명 칸 둘레를 이웃 재질 램프의 steps 단 어두운 색으로 두른다(근흑 대신 재질 어두운 톤).
    이웃이 여럿이면 가장 많이 닿은 색, 같으면 더 어두운 색."""
    a = c.a
    h, w = a.shape[:2]
    op = a[..., 3] > 0
    out = []
    for y in range(h):
        for x in range(w):
            if op[y, x]:
                continue
            votes = {}
            for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                yy, xx = y + dy, x + dx
                if 0 <= yy < h and 0 <= xx < w and op[yy, xx]:
                    k = (int(a[yy, xx, 0]) << 16) | (int(a[yy, xx, 1]) << 8) | int(a[yy, xx, 2])
                    votes[k] = votes.get(k, 0) + 1
            if not votes:
                continue
            nb = max(votes, key=lambda k: (votes[k], -k))
            r, i = _RAMP_OF.get(nb, ([nb], 0))
            out.append((x, y, r[max(1 if len(r) > 4 else 0, i - steps)] if i - steps >= 0 else r[0]))
    for x, y, col in out:
        c.P(x, y, col)


def wheel(c, cx, cy, r=4.5, hub='conc'):
    """바퀴: 바퀴집 그늘 → 고무 4단(왼쪽 위 밝은 트레드, 바깥 둘레 깊게) → 휠 5단 + 너트."""
    disc(c, cx + 0.3, cy - 0.6, r + 1.5, K('tekko', -2))
    disc(c, cx + 0.8, cy - 0.2, r + 1.1, K('sumi', 1))
    R = r + 0.6
    hb = [K(hub, 3), K(hub, 2), K(hub, 1), K(hub, 0), K(hub, -1), K(hub, -2)]
    for y in range(int(cy - R - 1), int(cy + R + 2)):
        for x in range(int(cx - R - 1), int(cx + R + 2)):
            dx, dy = x - cx, y - cy
            d = math.hypot(dx, dy)
            if d > R:
                continue
            s = (dx + dy) / (R * 1.414)
            if d > r * 0.56:
                lv = 1.3 + s * 1.6 + (0.9 if d > R - 0.8 else 0.0)
                if d < r * 0.56 + 1.0:
                    lv += 0.8                                    # 휠 둘레 안쪽 틈
                c.P(x, y, pick(RUBBER, lv, x, y))
            else:
                lv = 1.9 + s * 2.4 + (0.9 if d > r * 0.56 - 1 else 0.0)
                c.P(x, y, pick(hb, lv, x, y))
    c.P(round(cx), round(cy), K('tekko', -1)); c.P(round(cx) + 1, round(cy), K('tekko', 0))
    c.P(round(cx - 1), round(cy - 1), K(hub, 3))
    for k in range(4):                                           # 너트 4개
        a = k * math.pi / 2 + 0.6
        c.P(round(cx + math.cos(a) * r * 0.32), round(cy + math.sin(a) * r * 0.32), hb[3])
    c.P(round(cx - r * 0.7), round(cy - r * 0.7), RUBBER[0])     # 트레드 빛


def crate(c, x, y, w, h, content):
    """나무 채소 상자(3/4): 위 테두리 → 내용물 → 앞판 나무결."""
    for j in range(h):
        for i in range(w):
            xx, yy = x + i, y + j
            if j == 0:
                col = pick(CEDAR, 0.6 + i / w * 0.8, xx, yy)
            elif j < 4:
                col = pick(CEDAR, 3.2 + (1 if i in (0, w - 1) else 0), xx, yy)
            else:
                g = (H(xx, yy // 2, 41) - 0.5) * 1.1
                col = pick(CEDAR, 1.4 + (j - 4) * 0.35 + i / w * 0.9 + g + (1.4 if j == 6 else 0), xx, yy)
            c.P(xx, yy, col)
    content(x + 1, y + 1, w - 2)


# ═══════════════════════════ 탈것 ═══════════════════════════
@kit('inaka-keitora-white', '흰 경트럭(軽トラ) - 3/4 탑뷰: 넓은 캡 지붕 윗면·기운 앞유리·짧은 보닛 윗면·짐칸 골 바닥(먼 난간 → 바닥 → 가까운 난간)·낮은 옆면·바퀴 아래 절반(4×3)', 4, 3, 'vehicle',
     solid=rows(4, [1, 2]), tags=['inaka', '경트럭', '軽トラ', '탈것'],
     rules='농가 마당·논두렁 옆 자갈길에 오른쪽(동)을 보고 세운다.', role='prop')
def keitora(c, base):
    # 투영: 화면 y = 46 - 높이 z - 북쪽 깊이 n. 차 폭 n = 0..13 → 윗면은 14줄, 옆면은 그보다 낮다.
    def Y(z, n):
        return 46 - z - n
    # 1) 바퀴(아래 절반만 보인다: 위는 옆판이 덮는다) — 먼저 그린다
    wheel(c, 13, 41, 4.8); wheel(c, 49, 41, 4.8)
    # 2) 짐칸(x3~39): 먼 난간 윗면 → 먼 판 안쪽 면(남향) → 넓은 골 바닥 → 가까운 난간 윗면 → 옆판
    BX0, BX1 = 3, 39
    for x in range(BX0, BX1 + 1):
        for y in range(Y(15, 13), Y(15, 13) + 2):                        # 먼 난간 윗면 y18~19
            c.P(x, y, W_PAINT[0] if y == Y(15, 13) else W_PAINT[2])
        for y in range(Y(15, 13) + 2, Y(9, 13)):                         # 먼 판 안쪽 면 y20~23
            c.P(x, y, pick(W_PAINT, 1.6 + (y - Y(15, 13)) * 0.35 + (x - BX0) / 36 * 0.5, x, y))
        for y in range(Y(9, 13), Y(15, 0)):                              # 골 바닥 y24~30(가로 골: 차 길이 방향)
            r = (y - Y(9, 13)) % 3
            c.P(x, y, pick(STEEL, (1.2 if r == 0 else 3.4 if r == 2 else 2.2) + (x - BX0) / 36 * 0.5, x, y))
    c.HL(BX0, Y(9, 13), BX1 - BX0 + 1, STEEL[4])                          # 먼 판 밑 그늘
    # 바닥 위 작은 짐: 채소 상자 하나 + 방수포 덮은 짐 하나(바닥이 둘레로 보이게)
    for j in range(5):
        for i in range(7):
            x, y = 8 + i, 23 + j
            if j < 3:
                c.P(x, y, pick(CEDAR, 0.4 + i * 0.12, x, y) if (j == 0 or i in (0, 6)) else LEAF[2])
            else:
                c.P(x, y, pick(CEDAR, 1.8 + (j - 3) * 0.6 + i * 0.1, x, y))
    for (bx, by) in ((10, 24), (12, 25)):
        ball(c, bx, by, 1.4, LEAF, ry=1.0)
    blue = [K('sora', 2), K('sora', 1), K('garasu', 1), K('sora', 0), K('sora', -1), K('kon', -1)]
    for y in range(22, 29):
        for x in range(24, 34):
            u = (x - 28.5) / 5.5; v = (y - 25.2) / 3.4
            if u * u + v * v <= 1:
                c.P(x, y, pick(blue, 0.8 + (u + v) * 1.4 + 0.6 * math.sin(x * 1.3 + y), x, y))
    # 가까운 난간 윗면 y30~31 + 옆판 y32~39(8줄): 위 밝음 → 아래 그늘, 프레스 선
    c.HL(BX0, 30, BX1 - BX0 + 1, W_PAINT[0]); c.HL(BX0, 31, BX1 - BX0 + 1, W_PAINT[1])
    vgrad(c, BX0, 32, BX1 - BX0 + 1, 8, W_PAINT, 2.0, 4.0)
    c.HL(BX0, 34, BX1 - BX0 + 1, W_PAINT[4]); c.HL(BX0, 35, BX1 - BX0 + 1, W_PAINT[1])
    for x in (15, 27):
        c.VL(x, 32, 7, W_PAINT[4]); c.VL(x + 1, 32, 7, W_PAINT[1])
    for y in range(Y(15, 13), 32):                                       # 뒤 문짝 윗선(서쪽 끝 판)
        c.P(BX0, y, W_PAINT[1]); c.P(BX0 + 1, y, W_PAINT[3] if Y(15, 13) + 2 <= y < 30 else W_PAINT[1])
    ball(c, 4, 35, 1.5, RED[1:], ry=2.0)                                  # 후미등
    speck(c, 4, 37, 34, 3, K('kinari', -1), 0.08, 12)
    # 3) 캡 뒤 가드 프레임(x40, 남·북 기둥 + 깊이 방향 윗대 = 세로 줄)
    for y in range(Y(22, 13), 32):
        c.P(40, y, STEEL[1] if y % 3 else STEEL[3])
    # 4) 캡: 넓은 지붕 윗면(x41~56, n0~13, z22 → y11~24) — 왼쪽 위 빛, 지붕 홈 두 줄, 남쪽 가장자리 빛 테
    CX0, CX1 = 41, 56
    for n in range(14):
        y = Y(20, n)
        for x in range(CX0, CX1 + 1):
            lv = 0.0 + (x - CX0) / 16 * 0.9 + (0.9 if n == 13 else 0) + (0.6 if x in (CX0, CX1) else 0)
            c.P(x, y, pick(W_PAINT, lv, x, y))
    for n in (4, 9):
        c.HL(CX0 + 1, Y(20, n), CX1 - CX0 - 1, W_PAINT[2]); c.HL(CX0 + 1, Y(20, n) - 1, CX1 - CX0 - 1, W_PAINT[0])
    c.HL(CX0, Y(20, 0), CX1 - CX0 + 1, K('kinari', 2)); c.HL(CX0, Y(20, 0) + 1, CX1 - CX0 + 1, W_PAINT[4])   # 지붕 → 옆면 꺾임(빛 테 + 그늘 줄)
    c.HL(43, Y(20, 11), 5, K('kinari', 2))
    # 기운 앞유리: 지붕 앞 끝(x57, z22) → 앞 아래(x60, z15), 깊이 n 마다 같은 띠
    for n in range(14):
        for k in range(4):
            x = 57 + k; y = Y(20 - k * 2.0, n)
            c.P(x, round(y), pick(GLASS, 0.6 + k * 0.8 + (13 - n) * 0.08, x, round(y)))
            c.P(x, round(y) + 1, pick(GLASS, 1.0 + k * 0.8 + (13 - n) * 0.08, x, round(y) + 1))
    for n in (2, 3, 9):
        line(c, 57, Y(20, n), 59, Y(15, n), GLASS[0])
    # 짧은 보닛 윗면(x61~62, z14)
    for n in range(14):
        c.P(61, Y(14, n), W_PAINT[1]); c.P(62, Y(14, n), W_PAINT[3])
    # 캡 옆면(남향, z7~22 → y25~39): 위 밝음 → 아래 그늘 · 문 창 · 손잡이 · 미러 · 전조등·번호판
    for y in range(Y(20, 0) + 1, 40):
        xe = 57 + min(5, max(0, (y - Y(20, 0)) * 4 // 9))
        for x in range(CX0, xe + 1):
            c.P(x, y, pick(W_PAINT, 2.0 + (y - Y(20, 0)) * 0.14 + (x - CX0) / 20 * 0.4, x, y))
    for y in range(29, 34):
        for x in range(43, 53 + (y - 29) // 2):
            c.P(x, y, pick(GLASS, 2.0 + (y - 29) * 0.5, x, y))
    line(c, 44, 33, 47, 30, GLASS[0])
    c.HL(41, 33, 18, W_PAINT[4]); c.HL(44, 34, 3, K('tekko', -1))
    c.R(56, 28, 2, 2, K('tekko', -2)); c.P(56, 28, K('tekko', 2))
    ball(c, 61, 34, 1.3, [K('shiro', 2), K('kii', 2), K('kii', 1), K('kii', 0)], ry=1.4)
    c.R(58, 37, 4, 2, K('kii', 1)); c.HL(58, 37, 4, K('kii', 2))
    hgrad(c, 41, 39, 22, 1, CONC, 1.0, 3.5)
    vgrad(c, 4, 40, 58, 1, [K('tekko', -1), K('tekko', -2)], 0.5, 1.5)    # 차체 밑 그늘(바퀴 사이)
    finish(c, [(5, 63, 45, 3, SHADOW, 0)])


@kit('inaka-red-tractor', '빨간 농기계 트랙터 - 위쪽 3/4: 차양 캐노피 윗면·보닛 윗면·운전석 바닥과 좌석·로터리 덮개 윗면, 양옆 큰 뒷바퀴는 위에서 본 트레드 띠(4×4)', 4, 4, 'vehicle',
     solid=rows(4, [2, 3]), tags=['inaka', '트랙터', 'トラクター', '농기계'],
     rules='논 가장자리·헛간 앞. 오른쪽(동)을 보고 둔다.', role='prop')
def tractor(c, base):
    # 위쪽 3/4 투영: 화면 y = 58 - 0.4·높이 z - 북쪽 깊이 n. 높이는 크게 눌리고 윗면이 주인공이다.
    def Y(z, n):
        return round(63 - 0.4 * z - 1.3 * n)

    def tread(x0, x1, n0, n1, R, dim=0.0):
        """위에서 본 바퀴: 트레드 윗면 띠(가로 러그 줄, 가운데가 가장 높고 밝다) + 아래 납작한 옆 반달."""
        cx = (x0 + x1) / 2
        for x in range(x0, x1 + 1):
            u = (x - cx) / ((x1 - x0) / 2 + 0.5)
            zt = R + R * math.sqrt(max(0.0, 1 - u * u))
            for n10 in range(n1 * 10, n0 * 10 - 1, -5):
                n = n10 / 10
                y = Y(zt, n)
                lug = (x - x0) % 3 == 0
                lv = (0.0 if abs(u) < 0.5 else 1.0) + (2.0 if lug else 0) + dim + (1.0 if n == n1 else 0)
                c.P(x, y, RUBBER[max(0, min(3, round(lv)))])
            yb = Y(zt, n0)                                             # 옆 반달: 납작하게 2~3줄
            for k in range(1, 3 if abs(u) < 0.7 else 2):
                c.P(x, yb + k, pick(RUBBER, 2.0 + k * 0.6 + abs(u) * 0.5 + dim, x, yb + k))
            if abs(u) < 0.18:
                c.P(x, yb + 1, K('kii', -1) if dim == 0 else RUBBER[2])   # 작은 허브 점
    yellow = [K('kii', 2), K('kii', 1), K('kii', 0), K('kii', -1), K('kii', -2)]
    # 1) 먼 쪽 바퀴(n24~30): 캐노피 뒤 가장자리로 조금만
    tread(11, 33, 24, 29, 10, dim=0.8)
    tread(45, 54, 22, 26, 5, dim=0.8)
    # 2) 로터리 작업기(뒤, x1~11): 덮개 윗면 n5~27 → 앞 띠 3줄 → 칼날 점
    # 덮개: 남북으로 누운 반원통(가운데 마루가 가장 높고, 왼쪽 빛·오른쪽 그늘, 골 띠) — 앞 끝은 아치 입구
    def hz(x):
        u = (x - 6) / 5.6
        return 5 + 6 * math.sqrt(max(0.0, 1 - u * u)), u
    for n in [k / 2 for k in range(54, 19, -1)]:
        for x in range(1, 12):
            z, u = hz(x)
            if abs(u) > 0.8 and (n > 25 or n < 11):
                continue                                               # 네 모서리를 둥글게
            y = Y(z, n)
            lv = 1.4 + u * 2.4 - (1.0 if abs(u + 0.35) < 0.18 else 0) + (0.8 if int(n) % 4 == 0 else 0)
            c.P(x, y, pick(ORANGE, lv, x, y))
    for x in range(1, 12):                                             # 덮개 앞 끝 테(아치) → 안쪽 그늘
        z, u = hz(x)
        y0 = Y(z, 10)
        c.P(x, y0, ORANGE[0] if u < 0 else ORANGE[3])
        for y in range(y0 + 1, Y(2, 10) + 1):
            c.P(x, y, J('machiya_timber', 2) if y - y0 < 2 else RUBBER[3])
    # 회전 날(tines): 덮개 앞으로 드러난 굴대(n7) + 엇갈려 휜 칼날, 위에서 본 모양
    ys = Y(5, 7)
    c.HL(1, ys, 11, STEEL[2]); c.HL(1, ys + 1, 11, STEEL[4])
    for k, x in enumerate(range(1, 12, 2)):
        d = -1 if k % 2 else 1                                         # 칼날이 앞뒤로 엇갈려 휜다
        c.P(x, ys - 2 * d, STEEL[0]); c.P(x, ys - 1 * d, STEEL[1])
        c.P(x + 1, ys - 2 * d, STEEL[2]); c.P(x + 1, ys - 3 * d, STEEL[3])
        c.P(x, ys + 3, SOIL[2] if H(x, 3, 11) < 0.5 else SOIL[3])
    speck(c, 1, Y(11, 27), 11, 20, SOIL[2], 0.08, 7)
    line(c, 12, Y(14, 16), 11, Y(9, 16), STEEL[2])                    # 유압 암
    # 3) 운전석 바닥(x12~31, n8~23, z12): 철판 줄무늬 + 좌석(쿠션 윗면) + 변속 레버
    for n in [k / 2 for k in range(16, 47)]:
        y = Y(12, n)
        for x in range(12, 32):
            c.P(x, y, pick(STEEL, 1.4 + (0.9 if int(n) % 3 == 0 else 0) + (H(x, int(n * 2), 7) - 0.5) * 0.5 + (x - 12) / 20 * 0.5, x, y))
    for y in range(Y(12, 8) + 1, Y(12, 8) + 3):
        c.HL(12, y, 20, STEEL[3 + (y - Y(12, 8)) // 2])
    for n in [k / 2 for k in range(18, 29)]:                           # 좌석 윗면(검은 비닐 쿠션, 왼쪽 위 빛)
        y = Y(20, n)
        for x in range(15, 23):
            lv = 0.6 + (x - 15) / 8 * 1.6 + (n - 9) * 0.08 + (1.0 if x == 15 else 0)
            c.P(x, y, RUBBER[max(0, min(3, round(lv)))])
    c.HL(15, Y(20, 9) + 1, 8, RUBBER[3]); c.HL(16, Y(20, 13.5), 5, STEEL[3])   # 앞 모서리 그늘 · 쿠션 접힘
    for n in [k / 2 for k in range(18, 30)]:                           # 등받이 윗면(좌석 뒤 x13~14)
        c.P(13, Y(26, n), STEEL[3]); c.P(14, Y(26, n), RUBBER[2])
    for k in range(24):                                                # 핸들(위에서 본 납작한 고리)
        th = k / 24 * 2 * math.pi
        x, y = round(28 + 2.6 * math.cos(th)), round(Y(24, 13) + 1.3 * math.sin(th))
        c.P(x, y, RUBBER[1] if math.sin(th) < 0 else RUBBER[3])
    c.VL(28, Y(24, 13) + 1, 3, STEEL[3])
    c.VL(27, Y(22, 10), 3, STEEL[1]); c.P(27, Y(22, 10) - 1, RED[1])  # 변속 레버
    # 4) 긴 보닛(x31~58, n9~21, z18): 윗면 13줄(빛 띠·냉각 구멍·흰 줄) → 옆 띠 4줄 → 앞 그릴
    def hood_z(n):
        v = (n - 15) / 6.6
        return 15.5 + 2.5 * math.sqrt(max(0.0, 1 - v * v))
    for n in [k / 2 for k in range(42, 17, -1)]:
        for x in range(31, 60):
            k = max(0, x - 55)                                         # 앞 끝을 평면에서 둥글게
            if n < 9 + k * 0.9 or n > 21 - k * 0.9:
                continue
            y = Y(hood_z(n), n)
            v = (n - 15) / 6.6
            lv = 0.6 + (x - 31) / 29 * 1.0 + max(0.0, v) * 1.2 + max(0.0, -v - 0.6) * 1.5 + (1.6 if x >= 58 else 0)
            c.P(x, y, pick(RED, lv, x, y))
    for x in range(33, 56):                                            # 마루 빛 줄
        c.P(x, Y(hood_z(16), 16), RED[0]); c.P(x, Y(hood_z(17), 17), K('daidai', 1) if x < 42 else RED[0])
    for x in range(39, 55, 2):                                         # 환기구: 마루 양쪽 남북 슬릿(그늘 + 빛 턱)
        for n in [k / 2 for k in range(22, 29)] + [k / 2 for k in range(36, 41)]:
            c.P(x, Y(hood_z(n), n), RED[4]); c.P(x + 1, Y(hood_z(n), n), RED[1])
    for n in range(10, 21):
        c.P(34, Y(hood_z(n), n), W_PAINT[1])
    for y in range(Y(15.5, 9) + 1, Y(15.5, 9) + 4):                    # 남쪽 옆 띠 3줄(앞 끝은 둥글게 줄인다)
        for x in range(31, 59 - (y - Y(15.5, 9))):
            c.P(x, y, pick(RED, 2.5 + (y - Y(15.5, 9)) * 0.5 + (x - 31) / 29 * 0.4, x, y))
    ball(c, 57, Y(17, 11), 1.2, [K('shiro', 2)] + yellow[:3])
    ball(c, 57, Y(17, 19), 1.2, [K('shiro', 2)] + yellow[:3])
    # 5) 배기 연통(보닛 n19 에서, 위에서 보면 짧은 원통 + 입구 타원)
    top = Y(30, 19)
    cyl(c, 48, top, 3, Y(hood_z(19), 19) - top, STEEL); c.HL(48, top - 1, 3, STEEL[4]); c.P(49, top - 1, RUBBER[3])
    # 6) 가까운 바퀴(n0~6 큰 뒷바퀴, n3~7 앞바퀴): 위에서 본 트레드 띠
    tread(11, 33, 1, 7, 10)
    tread(45, 54, 3, 8, 5)
    for x in range(17, 28):                                            # 작은 펜더: 바퀴 꼭대기 뒤쪽 가운데 얇은 판(트레드가 드러난다)
        c.P(x, Y(21, 7) - 1, RED[1] if x < 23 else RED[2]); c.P(x, Y(21, 7), RED[3])
    # 7) 차양 캐노피(z38, x12~33, n10~26 → 17줄, 붉은·흰 줄, 왼쪽 위 빛) + 기둥 + 앞 테 2줄
    for (px, n, add) in ((13, 26, 1.4), (31, 26, 2.0)):              # 뒤 기둥 둘(캐노피 뒤 끝 아래로 조금)
        cyl(c, px, Y(38, n), 2, Y(12, n) - Y(38, n), RED, add=add)
    for n in [k / 2 for k in range(54, 29, -1)]:
        y = Y(38, n)
        for x in range(12, 34):
            if (x in (12, 33)) and (n < 16 or n > 26):
                continue                                               # 캐노피 모서리를 둥글게
            cols = RED if ((x - 12) // 4) % 2 == 0 else W_PAINT
            c.P(x, y, pick(cols, 0.4 + (x - 12) / 22 * 1.2 + (27 - n) * 0.02 + (0.7 if n >= 26.5 else 0), x, y))
    for x in range(13, 33):
        cols = RED if ((x - 12) // 4) % 2 == 0 else W_PAINT
        c.P(x, Y(38, 15) + 1, cols[3]); c.P(x, Y(38, 15) + 2, cols[4])
    for (px, add) in ((13, 0.0), (31, 0.8)):                           # 앞 기둥 둘: 캐노피 앞 테 → 바닥, 밝은 쇠(왼쪽 빛)
        top, bot = Y(38, 15) + 3, Y(12, 15)
        for y in range(top, bot + 1):
            c.P(px, y, RED[1 if add == 0 else 2]); c.P(px + 1, y, RED[3 if add == 0 else 4])
        c.HL(px - 1, bot + 1, 4, STEEL[4])                              # 기둥 발 받침
    finish(c, [(2, 62, 58, 5, SHADOW, 1)])


@kit('inaka-single-car-train', '단량 디젤 동차(キハ40 국철색) - AU75 냉방기·물탱크·배기구 지붕 윗면·크림+주홍 투톤 차체·폴딩 도어·전조등·대차(8×3)', 8, 3, 'vehicle',
     solid=rows(8, [1, 2]), tags=['inaka', '열차', '기차', '디젤동차', 'キハ', '철도'],
     rules='시골 선로(jp-rail-h) 위에 올린다(간이역 승강장 앞).', role='prop')
def single_car_train(c, base):
    W = 128
    ROOF = [K('shiro', 2), K('shiro', 1), K('conc', 3), K('conc', 2), K('conc', 1), K('conc', 0), K('conc', -1)]
    # 3/4 지붕 윗면(y=1..17, jp-train-car-a 와 같은 비례): 뒤 어깨 그늘 → 넓은 판 → 앞 어깨 빛 → 처마로 꺾이는 그늘
    c.HL(2, 0, W - 4, OL)
    prof = (5, 4, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 1, 1, 0, 1, 3)
    for j, lv in enumerate(prof):
        y = 1 + j
        for x in range(2, W - 2):
            c.P(x, y, ROOF[lv])
    for j in (2, 9, 11, 13):                                      # 단 사이 한 줄만 디더(둥근 지붕의 부드러운 꺾임)
        y = 1 + j
        for x in range(2, W - 2):
            c.P(x, y, pick(ROOF, prof[j] - 0.5, x, y))
    for sx in range(18, W - 4, 16):                              # 지붕 판 이음(빛 쪽 밝은 턱 + 그늘 골)
        for y in range(2, 17):
            c.P(sx, y, ROOF[min(6, prof[y - 1] + 1)]); c.P(sx + 1, y, ROOF[max(0, prof[y - 1] - 1)])
    speck(c, 2, 3, W - 4, 9, ROOF[2], 0.07, 34); speck(c, 2, 3, W - 4, 9, ROOF[4], 0.05, 35)   # 지붕 도료 얼룩
    for x in range(56, 74):                                      # 배기 그을음(연통 뒤쪽으로 번짐)
        for y in range(9, 16):
            if H(x, y, 32) < 0.35 - abs(x - 64) * 0.03 - (y - 9) * 0.03:
                c.P(x, y, ROOF[5])
    c.VL(1, 1, 17, OL); c.VL(W - 2, 1, 17, OL)
    # 지붕 위 기기: 물탱크·AU75 냉방기 2기(윗면 + 앞면 그릴)
    for (bx, bw) in ((8, 14), (30, 22), (76, 22)):
        c.HL(bx, 3, bw, OL)
        for y in range(4, 9):
            for x in range(bx, bx + bw):
                c.P(x, y, pick(W_PAINT, 0.3 + (x - bx) / bw * 1.3 + (y - 4) * 0.3, x, y))
        c.HL(bx, 4, bw - 2, W_PAINT[0])
        vgrad(c, bx, 9, bw, 3, STEEL, 1.0, 4.5)
        for gx in range(bx + 3, bx + bw - 2, 4):
            c.VL(gx, 5, 3, CONC[3]); c.VL(gx + 1, 5, 3, W_PAINT[0]); c.P(gx, 10, STEEL[5])
        c.VL(bx - 1, 4, 8, OL); c.VL(bx + bw, 4, 8, OL); c.HL(bx - 1, 12, bw + 2, OL)
    # 디젤 배기 연통(원통 + 검은 구멍)
    cyl(c, 59, 3, 8, 6, STEEL); c.HL(59, 3, 8, STEEL[0])
    vgrad(c, 61, 4, 4, 3, RUBBER, 2.0, 3.0)
    c.VL(58, 3, 6, OL); c.VL(67, 3, 6, OL); c.HL(58, 9, 10, OL)
    for vx in (24, 53, 70, 102):                                 # 환기구
        hgrad(c, vx, 6, 4, 2, CONC, 0.2, 2.0); c.HL(vx, 8, 4, STEEL[4])
    for hx in (3, W - 7):                                        # 운전실 지붕 헤드라이트 포드
        cyl(c, hx, 7, 4, 4, STEEL); c.P(hx + (0 if hx < 64 else 3), 8, K('kii', 2))
    c.HL(1, 18, W - 2, K('tekko', -2)); c.HL(1, 19, W - 2, OL)    # 처마 홈통
    # 차체 옆면: 국철 크림 + 주홍 투톤 — 각 띠 위 빛 → 아래 그늘, 아래쪽은 대차 그늘로 더 깊다
    rowlv = {20: (VERM, 0), 21: (VERM, 1), 22: (VERM, 1), 23: (VERM, 2),
             24: (CREAM, 0), 25: (CREAM, 1), 26: (CREAM, 1), 27: (CREAM, 1), 28: (CREAM, 1), 29: (CREAM, 1), 30: (CREAM, 2), 31: (CREAM, 2),
             32: (VERM, 0), 33: (VERM, 1), 34: (CREAM, 1), 35: (CREAM, 3), 36: (VERM, 2), 37: (VERM, 2), 38: (VERM, 3)}
    for y, (cols, lv) in rowlv.items():
        c.HL(2, y, W - 4, cols[lv])
    for y in (23, 37):                                            # 띠 아래쪽 꺾임만 디더
        for x in range(2, W - 2):
            c.P(x, y, pick(rowlv[y][0], rowlv[y][1] - 0.5, x, y))
    for x in range(2, W - 2):                                     # 아래 때(물 흘린 자국, 세로로 짧게)
        if H(x, 0, 33) < 0.12:
            c.VL(x, 37, 2, VERM[3])
    for y in range(20, 39):
        cols, lv = rowlv[y]
        c.P(2, y, cols[max(0, lv - 1)]); c.P(W - 3, y, cols[min(len(cols) - 1, lv + 1)])
    c.VL(1, 20, 20, OL); c.VL(W - 2, 20, 20, OL)

    def pane(x, y, w, h, seed):
        for j in range(h):
            for i in range(w):
                c.P(x + i, y + j, pick(GLASS, 1.4 + j * 0.55 + (H(x, seed, 2) - 0.5) * 0.6, x + i, y + j))
        line(c, x + 1, y + h - 2, x + min(w - 1, 3), y, GLASS[0])
        if w > 4:
            c.P(x + 4, y, GLASS[1]); c.P(x + w - 1, y + h - 1, GLASS[5])
    for cx0 in (3, W - 9):                                       # 운전실 옆창
        pane(cx0, 24, 6, 6, cx0)
    ball(c, 3, 34.5, 1.5, RED[1:], ry=1.8)                         # 미등
    ball(c, W - 3.5, 34.5, 1.5, [K('shiro', 2), K('kii', 2), K('kii', 1), K('kii', 0)], ry=1.8)
    for wx in (23, 34, 45, 56, 67, 78, 89):                      # 2단 유닛 창
        vgrad(c, wx - 1, 23, 9, 8, STEEL, 1.0, 3.5)
        pane(wx, 24, 7, 3, wx); pane(wx, 28, 7, 2, wx + 1)
        c.HL(wx, 27, 7, STEEL[1])
    c.R(63, 33, 8, 3, W_PAINT[1]); c.HL(64, 34, 6, K('sora', 0)); c.HL(63, 35, 8, W_PAINT[3])   # 행선판(무늬 없음)
    c.R(99, 25, 4, 3, K('midori', 1)); c.HL(99, 25, 4, K('midori', 2)); c.HL(99, 27, 4, K('midori', 0))
    for dx in (11, 105):                                         # 폴딩 승강문
        for y in range(22, 38):                                   # 문짝은 차체보다 한 단 들어가 어둡다(줄마다 한 색)
            cols, lv = rowlv[y]
            c.HL(dx, y, 9, cols[min(len(cols) - 1, lv + 1)])
        c.HL(dx, 24, 9, CREAM[0])
        c.VL(dx, 22, 16, VERM[3]); c.VL(dx + 8, 22, 16, VERM[3])
        c.VL(dx + 4, 22, 16, K('tekko', -1)); c.VL(dx + 5, 22, 16, VERM[1])
        pane(dx + 1, 24, 3, 6, dx); pane(dx + 5, 24, 3, 6, dx + 3)
        c.HL(dx + 1, 36, 7, STEEL[1]); c.HL(dx + 1, 37, 7, STEEL[4])
    # 하부: 언더프레임 → 기기함 → 대차(강철 바퀴 공 명암) → 배장기
    vgrad(c, 2, 39, W - 4, 3, STEEL, 2.6, 5.0); c.HL(2, 39, W - 4, STEEL[2])
    vgrad(c, 4, 41, 6, 4, STEEL, 2.0, 3.6); vgrad(c, W - 10, 41, 6, 4, STEEL, 2.0, 3.6)
    for (ux, uw) in ((42, 16), (62, 14), (80, 10)):
        vgrad(c, ux, 41, uw, 3, STEEL, 2.6, 4.0); c.HL(ux + 1, 42, uw - 2, STEEL[2])
    for bx in (16, 30, 94, 108):
        c.R(bx - 4, 41, 9, 4, K('tairu', -2))
        for wx in (bx - 2, bx + 2):
            ball(c, wx, 43, 1.6, STEEL[1:], ry=1.6)
    c.HL(14, 41, 19, STEEL[3]); c.HL(92, 41, 19, STEEL[3])
    c.HL(2, 45, W - 4, OL); c.HL(3, 46, W - 6, K('tairu', -2))
    tint_outlines(c)


@kit('inaka-bicycle-parked', '세워 둔 엄마 자전거(ママチャリ) - 앞 바구니 윗면·안장 윗면·짐받이(2×2)', 2, 2, 'prop',
     solid=[(0, 1), (1, 1)], tags=['inaka', '자전거', 'ママチャリ'],
     rules='가게 앞·역 앞·집 처마 밑에 오른쪽을 보고 세운다.', role='prop')
def bicycle(c, base):
    for cx in (8, 24):                                           # 타이어 트레드 윗면(폭 2줄): 위쪽 둘레가 깊이 방향으로 두껍다
        for off in (2, 1):
            for x in range(cx - 7, cx + 8):
                for y in range(14 - off, 22 - off):
                    d = math.hypot(x - cx, y + off - 22)
                    if 5.0 < d <= 6.6 and y + off < 20:
                        c.P(x, y, pick(RUBBER, 1.4 + off * 0.5 + ((x + off) % 2) * 0.8, x, y))
    for cx in (8, 24):                                           # 바퀴: 고무 3단 → 은색 림 → 살 → 허브
        for y in range(14, 30):
            for x in range(cx - 8, cx + 8):
                dx, dy = x - cx, y - 22
                d = math.hypot(dx, dy)
                s = (dx + dy) / 9.0
                if 5.0 < d <= 6.6:
                    c.P(x, y, pick(RUBBER, 1.3 + s * 1.4 + (0.8 if d > 6.0 else 0), x, y))
                elif 4.2 < d <= 5.0:
                    c.P(x, y, pick(CONC, 1.4 + s * 2.2, x, y))
        for k in range(8):
            a = k * math.pi / 4 + 0.2
            line(c, cx, 22, round(cx + math.cos(a) * 4.0), round(22 + math.sin(a) * 4.0), CONC[3] if k % 2 else CONC[1])
        ball(c, cx, 22, 1.3, CONC)
    fr = [K('sora', 2), K('sora', 1), K('sora', 0), K('sora', -1), K('kon', -1)]

    def tube(x0, y0, x1, y1):
        line(c, x0, y0, x1, y1, fr[2]); line(c, x0, y0 - 1, x1, y1 - 1, fr[1])
        c.P(round((x0 + x1) / 2) - 1, round((y0 + y1) / 2) - 1, fr[0])
    tube(8, 22, 15, 22); tube(15, 22, 21, 13); tube(12, 14, 15, 22)
    tube(12, 14, 21, 14); line(c, 21, 13, 24, 22, fr[2]); line(c, 22, 13, 25, 22, fr[3]); tube(8, 22, 12, 14)
    ball(c, 15.5, 22.5, 2.0, STEEL)                               # 체인 기어
    line(c, 13, 23, 18, 23, STEEL[4]); c.P(17, 25, RUBBER[1]); c.P(14, 20, RUBBER[1])   # 체인·페달
    # 흙받이(윗면 빛) + 짐받이
    for x in range(2, 14):
        u = (x - 8) / 6.5
        yt = round(22 - 6.6 * math.sqrt(max(0.0, 1 - u * u))) - 1
        c.P(x, yt, CONC[1 if x < 8 else 2])
    for y in range(11, 16):                                      # 짐받이 윗면(깊이 5줄, 길이 방향 살)
        for x in range(3, 12):
            c.P(x, y, pick(STEEL, (0.3 if y % 2 == 1 else 3.6) + (x - 3) * 0.08 + (y - 11) * 0.15, x, y))
    line(c, 4, 16, 7, 21, STEEL[2]); line(c, 5, 16, 8, 21, STEEL[4])
    # 안장(갈색 가죽 공 명암) + 기둥
    ball(c, 12, 10.5, 3.2, [K('ita', 3), K('ita', 2), K('ita', 1), K('ita', 0), K('ita', -1), K('ita', -2)], ry=2.3)
    c.VL(12, 12, 2, STEEL[2]); c.VL(13, 12, 2, STEEL[4])
    # 핸들 + 앞 바구니(윗면 입구 → 철망 앞면)
    c.VL(21, 9, 5, STEEL[2]); c.VL(22, 10, 4, STEEL[4])            # 핸들 기둥
    for y in range(4, 12):                                         # 핸들바 윗면: 남북으로 뻗은 막대 + 양 끝 손잡이
        c.P(20, y, STEEL[1] if 6 <= y <= 9 else RUBBER[1]); c.P(21, y, STEEL[3] if 6 <= y <= 9 else RUBBER[2])
    # 앞 바구니: 윗면 입구(깊이 5줄: 테 → 어두운 안 → 파 한 단) → 철망 앞면
    for y in range(4, 10):
        for x in range(23, 31):
            rim = y in (4, 9) or x in (23, 30)
            c.P(x, y, pick(CONC, 0.2 + (x - 23) * 0.1, x, y) if rim else pick(STEEL, 3.0 + (y - 4) * 0.3, x, y))
    ball(c, 25.5, 6.5, 1.5, LEAF, ry=1.2); c.P(27, 6, K('shiro', 1)); c.P(28, 7, LEAF[1]); c.P(28, 5, K('shiro', 2))   # 파 한 단
    for y in range(10, 15):
        for x in range(23, 31):
            wire = (x % 2 == 0) or (y % 2 == 1)
            lv = (0.8 if wire else 3.6) + (x - 23) * 0.22 + (y - 10) * 0.2
            c.P(x, y, pick(CONC, lv, x, y))
    c.HL(23, 14, 8, CONC[4])
    finish(c, [(3, 30, 29, 3, SHADOW, 1)])


# ═══════════════════════════ 전봇대·거리 소품 ═══════════════════════════
@kit('inaka-wooden-pole-transformer', '나무 전봇대와 변압기 - 완목 윗면·애자·원통 변압기·발판 볼트(1×3)', 1, 3, 'column',
     solid=[(0, 2)], tags=['inaka', '전봇대', '電柱', '변압기'],
     rules='시골길 가장자리에 6~8칸 간격. 길 쪽 칸만 막힌다.', role='prop')
def wooden_pole(c, base):
    # 방부 나무 기둥(원통 명암 + 세로 갈라짐·옹이)
    cyl(c, 5, 4, 4, 41, CEDAR, add=0.3, grain=1.2, seed=8)
    for y in range(6, 44, 7):
        c.P(6 + (y // 7) % 2, y, J('aged_cedar', 0)); c.P(6 + (y // 7) % 2, y + 1, J('aged_cedar', 1))
    for y in range(20, 44):
        if H(7, y, 4) < 0.35:
            c.P(7, y, J('machiya_timber', 2))
    vgrad(c, 4, 43, 6, 2, CONC, 1.0, 3.0)                        # 근가 콘크리트
    # 노랑·검정 사선 표지 커버(원통 명암)
    for y in range(35, 42):
        for x in range(5, 9):
            u = (x - 4.5) / 4 * 2 - 1
            lv = cyl_lv(u, 4)
            band = ((x + y) // 2) % 2
            cols = [K('kii', 2), K('kii', 1), K('kii', 0), K('kii', -1)] if band else RUBBER
            c.P(x, y, pick(cols, lv, x, y))
    for y in range(14, 34, 5):                                   # 발판 볼트
        c.P(9, y, STEEL[1]); c.P(9, y + 1, STEEL[4])
    # 완목: 윗면 2px(빛) + 앞면 2px(결)
    for x in range(1, 15):
        c.P(x, 5, pick(CEDAR, 0.2 + x / 14 * 1.0, x, 5)); c.P(x, 6, pick(CEDAR, 1.0 + x / 14 * 1.0, x, 6))
        c.P(x, 7, pick(CEDAR, 2.4 + (H(x, 7, 2) - 0.5), x, 7)); c.P(x, 8, pick(CEDAR, 3.6, x, 8))
    line(c, 3, 9, 6, 12, STEEL[3])                               # 완금 받침
    for x in (2, 12):                                            # 애자(흰 사기 공)
        ball(c, x + 0.5, 3, 1.3, W_PAINT, ry=1.8); c.P(x, 2, W_PAINT[0])
    # 원통 변압기: 타원 윗면 → 몸통(왼쪽 빛 → 오른쪽 그늘) → 띠 → 녹
    cyl(c, 3, 14, 10, 12, CONC, add=0.3)
    for y, x0, w_ in ((12, 5, 6), (13, 4, 8), (14, 3, 10)):
        hgrad(c, x0, y, w_, 1, CONC, 0.0 if y < 14 else 0.6, 1.8)
    c.HL(6, 12, 2, K('shiro', 2))
    for yy in (19, 24):
        for x in range(3, 13):
            c.P(x, yy, pick(CONC, cyl_lv((x - 2.5) / 10 * 2 - 1, 6) + 1.4, x, yy))
    for x in (5, 9):                                             # 볼트 밑으로 흘러내린 녹(옅게)
        c.P(x, 20, K('soil', 1)); c.P(x, 21, K('soil', 2))
    speck(c, 3, 22, 10, 4, K('soil', 2), 0.06, 14)
    c.R(11, 15, 2, 2, STEEL[3])
    finish(c, [(9, 15, 44, 3, SHADOW, 0)])


@kit('inaka-roadside-mirror', '커브 볼록거울(カーブミラー) - 주황 기둥·둥근 거울·거울 위 차양(1×2)', 1, 2, 'column',
     solid=[(0, 1)], tags=['inaka', '커브거울', 'カーブミラー'],
     rules='시골 굽은길·교차로 모서리.', role='prop')
def roadside_mirror(c, base):
    cyl(c, 6, 12, 3, 18, ORANGE, add=0.4)                        # 주황 원통 기둥
    speck(c, 6, 24, 3, 6, K('daidai', -2), 0.15, 5)              # 아래 녹
    vgrad(c, 4, 29, 8, 2, CONC, 0.5, 3.0)
    c.R(7, 12, 2, 2, STEEL[3])                                   # 거울 받침
    # 둥근 테(빛 왼쪽 위) + 볼록 거울(하늘 → 길 반사, 사선 빛)
    ball(c, 8, 7, 6.2, ORANGE)
    for y in range(1, 13):
        for x in range(2, 14):
            dx, dy = x - 8, y - 7
            d = math.hypot(dx, dy)
            if d <= 4.9:
                lv = 1.0 + dy * 0.32 + dx * 0.12 + (0.8 if d > 4.1 else 0)
                cols = GLASS if dy < 1 else [K('conc', 2), K('conc', 1), K('conc', 0), K('tekko', 0), K('tekko', -1)]
                c.P(x, y, pick(cols, lv if dy < 1 else (dy - 1) * 0.6 + dx * 0.1, x, y))
    line(c, 5, 6, 7, 3, GLASS[0]); c.P(5, 5, K('shiro', 2)); c.P(6, 7, GLASS[1])
    c.HL(4, 8, 8, K('ki', 0))                                     # 비친 길가 풀
    c.HL(4, 1, 8, ORANGE[1]); c.HL(5, 0, 6, ORANGE[0])            # 차양 윗면
    finish(c, [(8, 13, 30, 2, SHADOW, 0)])


@kit('inaka-retro-postbox-vending', '둥근 우체통과 자판기 - 둥근 지붕 우체통·자판기 윗면·음료 진열(2×2)', 2, 2, 'structure',
     solid=[(0, 1), (1, 1)], tags=['inaka', '우체통', '자판기', '丸ポスト'],
     rules='가게·버스 정류장 옆 길가.', role='prop')
def postbox_vending(c, base):
    # 둥근 우체통: 원통 몸(5단) → 둥근 지붕(공) → 투입구 그늘 → 흰 안내판 → 밑 녹
    cyl(c, 2, 10, 10, 17, RED, add=0.3)
    ball(c, 6.5, 8.5, 5.2, RED, ry=3.3)
    c.HL(4, 6, 3, RED[0]); c.P(5, 7, K('daidai', 1))
    for x in range(2, 12):                                        # 지붕 처마 턱
        c.P(x, 11, pick(RED, cyl_lv((x - 1.5) / 10 * 2 - 1, 6) + 1.6, x, 11))
    vgrad(c, 4, 14, 6, 2, RUBBER, 2.0, 3.0); c.HL(4, 16, 6, RED[1])
    vgrad(c, 5, 19, 4, 3, W_PAINT, 0.4, 2.0); c.HL(5, 20, 4, RED[3])
    speck(c, 2, 22, 10, 5, RED[5], 0.12, 21)
    vgrad(c, 1, 27, 12, 3, CONC, 0.4, 3.4)
    # 자판기: 윗면 3px → 앞면(위 밝음 → 아래 때) → 옆 모서리 그늘
    c.R(14, 3, 17, 27, OL)
    for y in range(4, 7):
        for x in range(15, 30):
            c.P(x, y, pick(VCW, 0.2 + (x - 15) / 15 * 1.2 + (y - 4) * 0.4, x, y))
    vgrad(c, 15, 7, 15, 22, VCW, 1.0, 3.2)
    c.VL(15, 7, 22, VCW[0]); c.VL(29, 7, 22, VCW[4])
    speck(c, 15, 24, 15, 5, VCW[5], 0.1, 22)
    hgrad(c, 16, 7, 13, 2, [K('sora', 2), K('sora', 1), K('sora', 0), K('sora', -1)], 0.2, 2.5)   # 머리 색띠
    # 진열창(어두운 유리 + 캔 2줄, 캔마다 원통 명암)
    vgrad(c, 16, 9, 13, 8, GLASS, 3.4, 5.0)
    for k, col in enumerate(('aka', 'sora', 'kii', 'midori', 'daidai', 'aka')):
        x = 17 + (k % 3) * 4; y = 10 + (k // 3) * 4
        cyl(c, x, y, 2, 3, [K(col, 2), K(col, 1), K(col, 0), K(col, -1)])
        c.HL(x, y + 3, 2, GLASS[2])
    line(c, 17, 16, 21, 9, GLASS[1])                              # 유리 반사
    for x in range(17, 29, 2):                                    # 단추 줄
        c.P(x, 18, K('kii', 1)); c.P(x, 19, VCW[3])
    c.R(25, 20, 2, 3, STEEL[2]); c.P(25, 20, STEEL[0])            # 동전 투입구
    vgrad(c, 17, 24, 11, 3, RUBBER, 1.0, 3.0); c.HL(17, 24, 11, STEEL[1])   # 꺼내는 곳
    finish(c, [(2, 31, 30, 2, SHADOW, 0)])


@kit('inaka-unmanned-veg-stand', '무인 채소 판매대(無人販売所) - 깊게 기운 片流れ 널판 차양 윗면·진열대 상판 위 바구니 채소·요금 통(2×3)', 2, 3, 'structure',
     solid=[(0, 1), (1, 1), (0, 2), (1, 2)], tags=['inaka', '무인판매', '野菜', '채소'],
     rules='밭 옆 길가. 앞 1칸에서 산다.', role='prop')
def veg_stand(c, base):
    # 투영: 화면 y = 46 - 높이 z - 북쪽 깊이 n
    def Y(z, n):
        return round(46 - z - n)
    # 1) 기둥 넷(먼 기둥은 진열대 뒤로 짧게, 가까운 기둥은 땅까지)
    for (x, n, add) in ((3, 13, 1.4), (27, 13, 2.0)):
        cyl(c, x, Y(30, n), 2, Y(10, n) - Y(30, n), CEDAR, add=add)
    # 2) 진열대: 상판 윗면(n2~12, z10, 가로 널 결·왼쪽 빛·차양 그늘은 뒤쪽) → 앞면 널(z0~10)
    for n in range(1, 14):
        y = Y(10, n)
        for x in range(2, 30):
            lv = 0.5 + (x - 2) / 28 * 0.8 + (H(x // 6, n, 19) - 0.5) * 0.6 + (1.3 if n % 4 == 2 else 0)
            lv += max(0, n - 7) * 0.3                                   # 차양 밑 깊은 쪽은 그늘
            c.P(x, y, pick(CEDAR, lv, x, y))
    for x in range(2, 30):
        c.P(x, Y(10, 1), CEDAR[0])
    for y in range(Y(10, 1) + 1, Y(0, 1) + 1):
        for x in range(2, 30):
            lv = 2.4 + (y - Y(10, 1)) * 0.18 + (H(x // 5, 0, 20) - 0.5) * 0.9 + (1.4 if (x - 2) % 5 == 0 else 0)
            c.P(x, y, pick(CEDAR, lv, x, y))
    c.HL(2, Y(10, 1) + 1, 28, CEDAR[4])
    # 3) 상판 위 엮은 바구니 셋(테 윗면 타원 + 안에 담긴 채소 공)
    tomato = RED[1:]
    eggplant = [K('murasaki', 1), K('murasaki', 0), K('murasaki', -1), K('kon', -1), K('kon', -2)]
    for (cx, kind) in ((7.5, 'tomato'), (15.5, 'cuke'), (23.0, 'egg')):
        cy = Y(10, 5) + 0.5
        for y in range(int(cy) - 4, int(cy) + 5):
            for x in range(int(cx) - 5, int(cx) + 6):
                u, v = (x - cx) / 3.6, (y - cy) / 2.6
                d = math.hypot(u, v)
                if d > 1:
                    continue
                lv = 1.0 + ((x + y) % 2) * 1.4 + (u + v) * 0.6 + (0.9 if d > 0.78 else 0)
                c.P(x, y, pick(STRAW, lv, x, y))
        c.P(round(cx), round(cy) + 3, J('machiya_timber', 2)); c.HL(round(cx) - 2, round(cy) + 3, 5, STRAW[4])   # 바구니 밑 그늘
        if kind == 'tomato':
            for (bx, by) in ((-1.4, -0.6), (1.4, -0.4), (0, 0.9)):
                ball(c, cx + bx, cy + by, 1.4, tomato)
                c.P(round(cx + bx), round(cy + by) - 1, LEAF[2])
        elif kind == 'cuke':
            for k in range(3):
                ball(c, cx - 1.6 + k * 1.6, cy - 0.3 + (k % 2) * 0.6, 1.5, LEAF, ry=0.9)
        else:
            for bx in (-1.3, 1.5):
                ball(c, cx + bx, cy, 1.6, eggplant, ry=1.3)
                c.P(round(cx + bx), round(cy) - 2, LEAF[3])
    # 요금 통(상판 앞 오른쪽, 뚜껑 윗면 + 앞면)
    c.HL(26, Y(10, 4) - 3, 3, STEEL[0]); c.HL(26, Y(10, 4) - 2, 3, STEEL[1])
    vgrad(c, 26, Y(10, 4) - 1, 3, 3, STEEL, 2.0, 4.2); c.P(27, Y(10, 4) - 3, RUBBER[3])
    # 4) 가까운 기둥(땅 → 처마)
    for (x, add) in ((3, 0.4), (27, 1.0)):
        cyl(c, x, Y(25, 0), 2, Y(0, 0) - Y(25, 0), CEDAR, add=add)
    # 5) 片流れ 차양: 앞 처마 z22(n0) → 뒤 용마루 z30(n16). 널판은 비탈 따라 세로 줄, 왼쪽 빛·오른쪽 그늘
    for n in range(0, 14):
        z = 25 + n * 0.4
        y = Y(z, n)
        for yy in (y, y + 1):
            for x in range(0, 32):
                pl = x // 4
                lv = 0.4 + x / 31 * 1.3 + (H(pl, 0, 31) - 0.5) * 0.8 + (H(x, yy // 2, 33) - 0.5) * 0.5
                if x % 4 == 0:
                    lv += 1.4                                            # 널 이음 그늘
                if x % 4 == 1:
                    lv -= 0.4                                            # 널 가장자리 빛
                lv += (13 - n) * 0.03
                c.P(x, yy, pick(CEDAR, lv, x, yy))
    for x in range(0, 32):                                              # 덮개 띠(용마루 쪽) + 앞 처마 마구리
        c.P(x, Y(30.2, 13), CEDAR[0] if x < 20 else CEDAR[1])
        c.P(x, Y(25, 0) + 2, CEDAR[4])
    speck(c, 1, Y(30, 13), 30, 14, LEAF[3], 0.04, 41)             # 이끼 점
    # 6) 처마 밑 가격 종이(글자 없는 색 띠)
    vgrad(c, 6, Y(25, 0) + 3, 5, 3, W_PAINT, 0.2, 1.4)
    c.HL(7, Y(25, 0) + 4, 3, K('aka', 0)); c.VL(8, Y(25, 0) + 2, 1, STEEL[3])
    finish(c, [(2, 30, 46, 2, SHADOW, 1)])



@kit('inaka-well-handpump', '우물과 작두 펌프 - 돌 우물 테 윗면(검은 물)·초록 펌프·양동이(2×2)', 2, 2, 'water',
     solid=[(0, 1), (1, 1)], tags=['inaka', '우물', '井戸', '펌프'],
     rules='농가 마당 한쪽.', role='water')
def well_pump(c, base):
    # 돌 우물 앞면: 돌 한 개씩(위·왼 빛 턱, 아래·오른 그늘), 둥근 몸이라 양 끝이 어둡다
    for y in range(15, 27):
        row = (y - 15) // 4
        for x in range(1, 18):
            off = (x + row * 3) % 6
            j = (y - 15) % 4
            u = (x - 9.5) / 8.5
            base_lv = 1.4 + max(0.0, u) * 1.6 + max(0.0, -u - 0.6) * 1.5 + (H((x + row * 3) // 6, row, 3) - 0.5) * 1.2
            if j == 3 or off == 5:
                lv = 4.6
            elif j == 0 or off == 0:
                lv = base_lv - 0.9
            else:
                lv = base_lv + (0.6 if j == 2 else 0)
            c.P(x, y, pick(STONE, lv, x, y))
    speck(c, 1, 22, 17, 5, K('ki', -1), 0.12, 4)                 # 밑 이끼
    # 테 윗면 링(돌 이음) + 검은 물(반짝임)
    for y in range(9, 21):
        for x in range(0, 20):
            u, v = (x - 9.5) / 8.4, (y - 15) / 4.4
            if u * u + v * v > 1:
                continue
            ui, vi = (x - 9.5) / 6.2, (y - 15) / 2.8
            if ui * ui + vi * vi <= 1:
                wv = [K('garasu', -1), K('garasu', -2), K('kon', -2), K('sumi', 1)]
                c.P(x, y, pick(wv, 1.0 + vi * 1.4 + (0.8 if vi < -0.5 else 0), x, y))
            else:
                seg = int((math.atan2(v, u) + math.pi) * 6 / math.pi)
                inner = ui * ui + vi * vi <= 1.35                 # 테 안쪽 턱(물 쪽으로 꺾이는 그늘)
                lv = 0.2 + (u + v) * 0.5 + (H(seg, 0, 6) - 0.5) * 0.8 + (2.6 if inner else 0) + (1.6 if H(seg, 1, 6) > 0.85 else 0)
                c.P(x, y, pick(STONE, lv, x, y))
    c.HL(12, 16, 2, K('garasu', 1)); c.P(13, 17, K('garasu', 0))
    # 덮개 널판(반쯤 덮음, 윗면 결)
    for y in range(12, 16):
        for x in range(2, 9):
            c.P(x, y, pick(CEDAR, 0.4 + (y - 12) * 0.35 + (1.6 if x == 5 else 0) + (H(x, y, 9) - 0.5) * 0.6, x, y))
    # 콘크리트 받침 + 초록 작두 펌프(주철 원통) + 손잡이 + 토수구
    c.R(18, 23, 13, 7, OL)
    for y in range(24, 29):
        for x in range(19, 30):
            lv = (1.4 + (x - 19) / 11 * 0.8) if y < 27 else (3.2 + (y - 27) * 0.6)
            c.P(x, y, pick(CONC, lv + (H(x, y, 10) - 0.5) * 0.6, x, y))
    speck(c, 19, 24, 11, 3, K('ki', -1), 0.08, 11)
    cyl(c, 22, 8, 4, 15, GREEN_IRON, add=0.2)
    hgrad(c, 21, 6, 6, 2, GREEN_IRON, 0.2, 2.6); c.HL(21, 8, 6, GREEN_IRON[3])
    speck(c, 22, 10, 4, 12, GREEN_IRON[4], 0.08, 12)
    line(c, 26, 7, 30, 4, STEEL[1]); line(c, 26, 8, 30, 5, STEEL[4])
    hgrad(c, 18, 14, 4, 2, GREEN_IRON, 1.0, 3.0); c.P(18, 15, GREEN_IRON[5])
    # 양동이(함석 원통 + 물)
    cyl(c, 18, 20, 4, 4, STEEL, add=-0.5); c.HL(18, 19, 4, STEEL[1])
    c.HL(19, 20, 2, K('sora', 0)); c.P(19, 20, K('sora', 1)); c.HL(18, 22, 4, STEEL[4])
    finish(c, [(3, 31, 29, 3, SHADOW, 1)])


@kit('inaka-fire-watchtower', '소방 망루(火の見櫓) - 위로 모이는 철골 네 다리·사다리·난간 안 널마루 윗면·빛/그늘 두 면 사각뿔 지붕·半鐘(2×4)', 2, 4, 'structure',
     solid=[(0, 3), (1, 3)], tags=['inaka', '망루', '火の見櫓', '소방'],
     rules='마을 갈림길·소방 창고 옆. 아래 두 칸만 막힌다.', role='building')
def watchtower(c, base):
    # 투영: 화면 y = 62 - 높이 z - 북쪽 깊이 n
    def Y(z, n):
        return 62 - z - n

    DZ, RZ = 28, 40                                                   # 전망대 바닥·처마 높이

    def leg(x0, n0, x1, n1, cols, w=2):
        y0, y1 = Y(0, n0), Y(DZ, n1)
        for y in range(y1, y0 + 1):
            t = (y0 - y) / max(1, y0 - y1)
            x = round(x0 + (x1 - x0) * t)
            for i in range(w):
                c.P(x + i, y, cols[i])
    # 1) 먼 다리 둘(n9 → 위에서 n7): 땅이 더 높고 짧게, 어둡게
    leg(6, 9, 10, 7, [RED[4], RED[5]]); leg(24, 9, 20, 7, [RED[4], RED[5]])
    for (ya, yb) in ((51, 45), (45, 39)):
        line(c, 7, ya, 22, yb, RED[5]); line(c, 23, ya, 8, yb, RED[5])
    # 2) 사다리(가까운 면 가운데)
    c.VL(13, Y(DZ, 0) + 2, DZ - 1, STEEL[2]); c.VL(18, Y(DZ, 0) + 2, DZ - 1, STEEL[4])
    for y in range(Y(DZ, 0) + 3, 61, 3):
        c.HL(14, y, 4, STEEL[1]); c.HL(14, y + 1, 4, STEEL[4])
    # 3) 가까운 다리 둘(n0 → 위에서 n1): 땅 x2/28 에서 위로 x7/23 으로 모인다
    leg(2, 0, 7, 1, [RED[2], RED[4]]); leg(28, 0, 23, 1, [RED[3], RED[5]])
    for (za, zb) in ((3, 11), (11, 19), (19, 27)):                    # X 가새 + 가로 띠
        f = lambda z: z / DZ
        xl = lambda z: 2 + 5 * f(z)
        xr = lambda z: 29 - 5 * f(z)
        line(c, round(xl(za)) + 1, Y(za, 0), round(xr(zb)) - 1, Y(zb, 1), RED[3])
        line(c, round(xr(za)) - 1, Y(za, 0), round(xl(zb)) + 1, Y(zb, 1), RED[4])
        c.HL(round(xl(zb)) + 1, Y(zb, 1), round(xr(zb) - xl(zb)) - 1, RED[2])
    speck(c, 3, 30, 26, 30, K('daidai', -2), 0.08, 40)               # 녹
    for (x, n) in ((1, 0), (26, 0)):                                   # 기초(윗면 + 앞면)
        c.HL(x, Y(0, n) - 1, 5, CONC[0]); vgrad(c, x, Y(0, n), 5, 2, CONC, 1.5, 3.5)
    for (x, n) in ((5, 9), (22, 9)):
        c.HL(x, Y(0, n) - 1, 4, CONC[1]); c.HL(x, Y(0, n), 4, CONC[3])
    # 4) 전망대 널마루 윗면(z34, n0~10, x4~27: 11줄, 왼쪽 빛, 가로 널 이음) → 앞 테 2줄
    for n in range(0, 10):
        y = Y(DZ, n)
        for x in range(4, 28):
            lv = 0.3 + (x - 4) / 24 * 1.0 + (H(x // 7, n, 3) - 0.5) * 0.6 + (1.3 if n % 3 == 0 else 0)
            lv += max(0, n - 6) * 0.25                                  # 지붕 밑 뒤쪽 그늘
            c.P(x, y, pick(CEDAR, lv, x, y))
    for y in (Y(DZ, 0) + 1, Y(DZ, 0) + 2):
        for x in range(4, 28):
            c.P(x, y, pick(TIMBER, 2.0 + (y - Y(DZ, 0)) * 0.9 + (x - 4) / 24 * 0.5, x, y))
    # 5) 난간: 먼 쪽(n10)·옆(x4, x27) → 바닥 위로 4px, 가까운 쪽은 기둥과 낮은 띠만(바닥이 보이게)
    c.HL(4, Y(DZ + 4, 9), 24, RED[2]); c.HL(4, Y(DZ + 3, 9), 24, RED[4])
    for x in range(4, 28, 5):
        c.VL(x, Y(DZ + 4, 9), 4, RED[3])
    for n in range(0, 11):
        c.P(4, Y(DZ + 4, n), RED[1]); c.P(27, Y(DZ + 4, n), RED[3])
    for n in range(0, 11, 3):
        c.VL(4, Y(DZ + 4, n), 4, RED[2]); c.VL(27, Y(DZ + 4, n), 4, RED[4])
    for x in range(4, 28, 5):
        c.VL(x, Y(DZ + 4, 0), 4, RED[2]); c.P(x + 1, Y(DZ + 4, 0) + 1, RED[4])
    c.HL(4, Y(DZ + 4, 0), 24, RED[1]); c.HL(5, Y(DZ + 4, 0) + 1, 22, RED[4])
    # 6) 지붕 기둥(바닥 모서리 → 처마)
    for (x, n, col) in ((5, 9, RED[4]), (26, 9, RED[5]), (5, 1, RED[2]), (26, 1, RED[4])):
        c.VL(x, Y(RZ, n), RZ - DZ + 1, col)
    # 7) 半鐘(지붕 밑 가운데에 매달린 청동 종)
    bx, by = 15.5, Y(RZ - 7, 5) + 0.5
    c.VL(15, Y(RZ, 5), 4, STEEL[3])
    ball(c, bx, by, 2.4, BRONZE[1:] + [J('machiya_timber', 2)], ry=2.6)
    c.HL(13, round(by) + 2, 6, BRONZE[3]); c.P(14, round(by) - 1, BRONZE[0])
    # 8) 사각뿔 지붕(처마 z48, x3~28, n0~11 · 꼭지 z58): 왼 면·앞 면 빛, 오른 면·뒤 면 그늘(함석 골)
    # 지붕은 모서리가 앞을 보게 놓인 사각뿔: 왼쪽 앞면(빛, 함석 골) + 오른쪽 앞면(그늘) 두 면이 윗면으로 보인다
    F = (16, Y(RZ, -1) + 1); L = (1, Y(RZ, 5)); R = (31, Y(RZ, 5)); P = (16, 0)

    def inside(p, a, b, q):
        def s(u, v, w):
            return (u[0] - w[0]) * (v[1] - w[1]) - (v[0] - w[0]) * (u[1] - w[1])
        d1, d2, d3 = s(p, a, b), s(p, b, q), s(p, q, a)
        return not ((d1 < 0 or d2 < 0 or d3 < 0) and (d1 > 0 or d2 > 0 or d3 > 0))
    for (a, b, lit) in ((L, F, True), (F, R, False)):
        for y in range(0, 30):
            for x in range(0, 32):
                if not inside((x + 0.5, y + 0.5), a, b, P):
                    continue
                if lit:   # 골은 처마 모서리에 나란한 줄(왼쪽 아래로 흐름)
                    lv = 0.2 + (y - P[1]) / 26 * 0.9 + (0.8 if (x + y) % 4 == 0 else 0)
                else:
                    lv = 3.6 + (x - 16) / 15 * 0.6 + (y - P[1]) / 26 * 0.4 + (0.8 if (y - x) % 4 == 0 else 0)
                c.P(x, y, pick(STEEL, lv, x, y))
    line(c, P[0], P[1], F[0], F[1], STEEL[1])                          # 앞 마루 모서리(빛)
    line(c, F[0], F[1] + 1, L[0], L[1] + 1, STEEL[3]); line(c, F[0], F[1] + 2, L[0], L[1] + 2, STEEL[4])   # 처마 립
    line(c, F[0], F[1] + 1, R[0], R[1] + 1, STEEL[4]); line(c, F[0], F[1] + 2, R[0], R[1] + 2, STEEL[5])
    c.P(16, 0, RED[1]); c.P(16, 1, RED[2])                              # 꼭지 장식
    finish(c, [(1, 31, 62, 2, SHADOW, 1)])



# ═══════════════════════════ 논·밭 소품 ═══════════════════════════
STALK = [J('lantern_amber', 4), J('lantern_amber', 3), J('lantern_amber', 2), J('lantern_amber', 1), J('lantern_amber', 0)]
EAR = [K('kii', 2), K('kii', 1), K('kii', 0), K('kii', -1), K('kii', -2)]
GAP = J('machiya_timber', 2)                                      # 다발 사이 틈: 검정이 아니라 짙은 갈색


def straw_bundle(c, x, y, L, seed=0):
    """매달린 볏단(はさ掛け) 하나: 가로대 위로 나온 줄기 끝 → 목(3px) → 몸(5px, 세로 짚 결: 빛 가닥·그늘 가닥, 왼쪽 빛·오른쪽 그늘)
    → 열마다 길이가 다르고 바깥으로 벌어지는 이삭 끝(진한 금빛 + 낟알 점, 들쭉날쭉한 실루엣)."""
    for dx in (-1, 0, 1):                                         # 가로대 위 줄기 끝(자른 단면)
        if H(x + dx, 2, seed) < 0.8:
            c.P(x + dx, y - 3, STALK[1 + (dx > 0)])
    for dx in range(-3, 4):
        Lc = L + int(H(x + dx, 1, seed) * 3) - (1 if abs(dx) >= 2 else 0)
        for k in range(Lc):
            if abs(dx) == 3 and k < Lc - 2:                       # 바깥 열은 맨 끝 이삭만 벌어진다
                continue
            if abs(dx) == 2 and k < 2:
                continue
            px, py = x + dx, y + k
            edge = (0, 0, 0, 1, 2, 3, 3)[dx + 3]
            if k >= Lc - 3:                                       # 이삭
                lv = edge * 0.8 + (0 if H(px, py, seed + 1) < 0.4 else 1) + (1 if k == Lc - 1 else 0)
                c.P(px, py, EAR[min(4, round(lv))])
            else:
                hs = H(px, 0, seed)
                strand = -1 if hs < 0.3 else 1 if hs > 0.62 else 0   # 빛 가닥 / 그늘 가닥
                strand += 1 if H(px, py, seed + 3) < 0.12 else 0
                lv = edge + strand + (1 if k < 2 else 0)
                c.P(px, py, STALK[max(0, min(4, lv))])
    c.HL(x - 1, y + 1, 3, J('aged_cedar', 1)); c.P(x - 1, y + 1, J('aged_cedar', 3))   # 묶은 새끼줄


@kit('inaka-rice-rack-hasagi', '볏단 걸이(はさ掛け) - 장대 윗면·가로대·매달린 볏단 두 단(3×2)', 3, 2, 'structure',
     solid=[(0, 1), (1, 1), (2, 1)], tags=['inaka', '하사기', 'はさ掛け', '볏단'],
     rules='가을 황금 논(inaka-paddy-golden) 논두렁 위.', role='prop')
def hasagi(c, base):
    def stakes(ymin, ymax):                                       # X 장대: 꼭대기에서 엇갈려 위로 튀어나온다(빛 줄 + 그늘 줄)
        for x in (4, 24, 44):
            for (x0, x1, col) in ((x - 5, x + 2, CEDAR[1]), (x - 4, x + 3, CEDAR[3]), (x + 5, x - 2, CEDAR[2]), (x + 6, x - 1, CEDAR[4])):
                for i in range(32):
                    yy = 31 - i
                    xx = round(x0 + (x1 - x0) * i / 31)
                    if ymin <= yy < ymax:
                        c.P(xx, yy, col)

    def bar(y):                                                   # 가로대(대나무: 윗면 빛 → 아래 그늘, 마디)
        for x in range(0, 48):
            c.P(x, y, pick(CEDAR, 0.3 + (H(x // 4, y, 2) - 0.5) * 0.8, x, y))
            c.P(x, y + 1, CEDAR[3])
        for x in range(5, 48, 9):
            c.P(x, y, CEDAR[3]); c.P(x, y + 1, CEDAR[4])

    stakes(0, 32)
    xs = list(range(3, 46, 6))
    for t, (yb, y0) in enumerate(((16, 18), (5, 7))):             # 아랫단 먼저 → 윗단 이삭이 아랫단 위로 늘어진다
        bar(yb)
        for x in xs[:-1]:                                         # 목·몸통 사이 틈은 짙은 갈색으로 메운다
            for k in range(0, 7):
                for gx in ((x + 2, x + 3, x + 4) if k < 2 else (x + 3,)):
                    c.P(gx, y0 + k, GAP)
        for k, x in enumerate(xs):
            straw_bundle(c, x, y0, 8, seed=t * 40 + k)
        if t == 0:
            for x in range(1, 47):                                # 윗단 이삭 밑에 진 그늘(아랫단 목·가로대)
                for yy in (yb - 1, yb):
                    if c.a[yy, x, 3]:
                        c.P(x, yy, CEDAR[4] if yy == yb else c.a[yy, x, 3] and STALK[3])
    stakes(27, 32)
    for x in (4, 24, 44):                                         # 장대 끝: 가로대 위에서 X 로 엇갈려 V 로 벌어진다
        for i in range(6):
            yy = 5 - i
            c.P(x - round(i * 1.0), yy, CEDAR[1]); c.P(x + 1 - round(i * 1.0), yy, CEDAR[3])
            c.P(x + 1 + round(i * 1.0), yy, CEDAR[2]); c.P(x + 2 + round(i * 1.0), yy, CEDAR[4])
    finish(c, [(1, 48, 29, 3, SHADOW, 0)])


def _blit(c, t):
    """임시 캔버스 t 의 불투명 픽셀을 c 위에 덮는다(add_outline 을 t 에만 두르기 위해)."""
    for y in range(c.h):
        for x in range(c.w):
            if t.a[y, x, 3]:
                c.P(x, y, (int(t.a[y, x, 0]) << 16) | (int(t.a[y, x, 1]) << 8) | int(t.a[y, x, 2]))


def scarecrow(c, t, x, y, robe='noren_indigo', obi='torii_vermilion', tilt=1):
    """3/4 허수아비: 흙 둔덕 → 대나무 기둥·기운 팔 막대(tilt: 오른팔이 올라가면 1, 내려가면 -1) → 소매 늘어진 기모노(주름 명암)
    → 자루 얼굴 → 菅笠(짚 결 원뿔 윗면 + 챙) → 삿갓이 얼굴·어깨 위로 드리운 그늘(t)."""
    RB = [J(robe, 4), J(robe, 3), J(robe, 2), J(robe, 1), J(robe, 0)]
    ball(t, x - 0.3, y + 27.4, 5.4, SOIL, ry=2.2)
    for gx in (x - 4, x + 3):
        t.P(gx, y + 26, J('moss', 3)); t.P(gx + 1, y + 25, J('moss', 4)); t.P(gx + 1, y + 26, J('moss', 2))
    cyl(t, x - 1, y + 8, 2, 20, [J('pine_bamboo', 4), J('pine_bamboo', 3), J('pine_bamboo', 2), J('pine_bamboo', 1)])
    for my in (y + 20, y + 24): t.HL(x - 1, my, 2, J('pine_bamboo', 1))

    def arm_y(xx):                                                # 기운 팔 막대 높이
        return y + 12 - round((xx - x) * tilt * 0.22)
    for xx in (x - 8, x + 8):                                     # 팔 막대는 소매 밖 끝만 보인다
        t.P(xx, arm_y(xx), J('pine_bamboo', 4)); t.P(xx, arm_y(xx) + 1, J('pine_bamboo', 2))
    # 기모노 몸통: 왼 빛 → 오른 그늘, 세로 주름, 밑단 그늘
    for k in range(11):
        hw = 4 if k < 6 else 3
        for dx in range(-hw, hw + 1):
            px, py = x + dx, y + 12 + k
            lv = 1.2 + dx / hw * 1.4 + (0.9 if k >= 9 else 0)
            if dx in (-2, 2) and k > 4:
                lv += 1.1
            if dx in (-3, 1) and k > 4:
                lv -= 0.7
            t.P(px, py, pick(RB, lv, px, py))
    t.P(x - 1, y + 12, K('shiro', 1)); t.P(x + 1, y + 12, K('shiro', 0)); t.P(x, y + 13, K('shiro', 1))
    # 늘어진 소매: 팔 막대를 따라 기울고, 내려간 쪽 소매가 더 길게 처진다
    for (sx, add, side) in ((x - 7, 0.0, -1), (x + 5, 1.2, 1)):
        drop = 5 + (1 if side * tilt < 0 else 0)
        for i in range(3):
            top = arm_y(sx + i)
            for j in range(drop + 1):
                t.P(sx + i, top + j, pick(RB, (0.0 if j == 0 else 0.6) + add + i * 0.5 + j * 0.3 + (1.2 if j == drop else 0), sx + i, top + j))
    OB = [J(obi, 4), J(obi, 3), J(obi, 2), J(obi, 1), J(obi, 0)]
    hgrad(t, x - 4, y + 16, 9, 1, OB, 0.2, 2.0); hgrad(t, x - 4, y + 17, 9, 1, OB, 1.4, 3.2)
    t.P(x + 2, y + 18, OB[2]); t.P(x + 3, y + 18, OB[3])
    # 자루 얼굴(꿰맨 점)
    ball(t, x, y + 9, 2.9, [J('cream_stucco', 4), J('cream_stucco', 3), J('cream_stucco', 2), J('cream_stucco', 1)], ry=2.6)
    t.P(x - 1, y + 10, J('aged_cedar', 1)); t.P(x + 1, y + 10, J('aged_cedar', 1)); t.P(x, y + 11, J('aged_cedar', 2))
    # 삿갓 그늘: 챙 바로 밑 얼굴 윗줄과 어깨가 한 단 어둡다(빛 왼쪽 위 → 그늘은 오른쪽으로 더 길게)
    for xx in range(x - 3, x + 4):
        if t.a[y + 9, xx, 3]:
            t.P(xx, y + 9, J('cream_stucco', 1 if xx < x + 1 else 0))
    for xx in range(x - 1, x + 6):
        yy = y + 12
        t.P(xx, yy, pick(RB, 3.2 + (xx - x) * 0.15, xx, yy))
    # 菅笠: 챙 아래 테 → 원뿔 윗면(왼쪽 빛, 방사 짚 결)
    ball(t, x, y + 6.5, 7.2, STRAW[2:], ry=2.4, bias=0.5)
    for k in range(7):
        hw = 1 + k
        yy = y + k
        for xx in range(x - hw, x + hw + 1):
            lv = 0.6 + (xx - x) / hw * 1.6 + k * 0.15
            if (xx - x + 20) % 3 == 0 and k > 1:
                lv += 1.0
            t.P(xx, yy, pick(STRAW, lv, xx, yy))
    t.P(x, y, STRAW[0])


@kit('inaka-scarecrow-pair', '허수아비 한 쌍(案山子) - 菅笠 원뿔 윗면·챙 그늘·소매 늘어진 기모노·대나무 기둥·흙 둔덕 그림자(2×2)', 2, 2, 'prop',
     solid=[(0, 1), (1, 1)], tags=['inaka', '허수아비', 'かかし'],
     rules='논 한가운데·논두렁.', role='prop')
def scarecrows(c, base):
    scarecrow(c, c, 8, 1, 'noren_indigo', 'torii_vermilion', tilt=1)
    scarecrow(c, c, 24, 2, 'torii_vermilion', 'tatami_straw', tilt=-1)
    soft_outline(c)
    for s in ((4, 15, 30, 2, SHADOW, 0), (20, 31, 31, 1, SHADOW, 0)):
        ground_shadow(c, *s)


def _sunflower_head(t, x, y, rx, ry, face=1):
    """3/4 해바라기 머리(위로 살짝 젖힌 납작 타원): 아래 초록 꽃받침 테 → 꽃잎 한 장씩(뒤쪽 짧고 어둡게, 앞쪽 길고 밝게)
    → 타원 씨앗판(씨 결 + 위쪽 빛 테)."""
    ball(t, x + 0.3, y + ry * 0.55, rx * 0.8, LEAF[1:], ry=ry * 0.75, bias=0.3)   # 꽃받침(밑면이 살짝 보인다)
    for k in range(14):
        a = k * math.pi / 7 + 0.2
        front = math.sin(a)                                       # +1 앞(아래), -1 뒤(위)
        pl = 1.0 + 0.45 * max(0.0, front)
        px, py = x + math.cos(a) * rx * pl, y + math.sin(a) * ry * pl
        lit = -(math.cos(a) * 0.6 + front * 0.2)
        ball(t, px, py, 1.5, SUN, ry=1.1 + 0.4 * max(0.0, front), bias=-lit * 0.5 + (0.5 if front < -0.3 else 0))
    ball(t, x, y, rx * 0.92, SUN, ry=ry * 0.92, bias=0.1)
    cx, cy = x + face * rx * 0.1, y + ry * 0.1
    sr, sry = rx * 0.6, ry * 0.6
    for yy in range(int(cy - sry - 1), int(cy + sry + 2)):
        for xx in range(int(cx - sr - 1), int(cx + sr + 2)):
            u, v = (xx - cx) / sr, (yy - cy) / sry
            if u * u + v * v > 1:
                continue
            lv = 1.6 + u * 0.8 + v * 0.5 + ((xx + 2 * yy) % 3 == 0) * 1.0
            if v < -0.55:
                lv -= 1.0                                         # 위쪽 테에 빛
            t.P(xx, yy, pick(SEED, lv, xx, yy))


def _leaf(t, x, y, side):
    """하트꼴 큰 잎(4~5 녹색 덩이, 가운데 잎맥) - side -1 왼쪽, 1 오른쪽."""
    ball(t, x + side * 3, y + 1, 3.6, LEAF, ry=2.4, bias=0.15)
    line(t, x + side * 1, y + 1, x + side * 5, y + 1, LEAF[3])
    t.P(x + side * 2, y, LEAF[0])


@kit('inaka-sunflower-patch', '해바라기 밭 한 덩이 - 3/4 북돋운 흙 두둑·층층 잎 줄기·뒷줄 작고 앞줄 큰 비스듬한 꽃 머리(3×2)', 3, 2, 'tree',
     solid=[(0, 1), (1, 1), (2, 1)], tags=['inaka', '해바라기', 'ひまわり', '여름'],
     rules='밭·마당 가장자리에 2~6개 이어 붙인다.', role='prop')
def sunflowers(c, base):
    for y in range(21, 31):
        for x in range(1, 48):
            u, v = (x - 24) / 22.5, (y - 26.5) / 4.2
            if u * u + v * v > 1:
                continue
            top = ((x - 24) / 21.5) ** 2 + ((y - 25.0) / 3.0) ** 2 <= 1
            lv = (0.8 + (y - 22) * 0.35 + u * 0.6) if top else (2.6 + (y - 26) * 0.35)
            lv += (H(x, y, 50) - 0.5) * 0.9
            c.P(x, y, pick(SOIL, lv, x, y))
    for x in range(6, 43, 5):
        c.HL(x, 24, 3, SOIL[3]); c.HL(x, 25, 3, SOIL[0])
    # 머리끼리 떨어지게: 뒷줄 4송이(높고 작게) · 앞줄 3송이(낮고 크게), 앞줄은 뒷줄 사이에 둔다
    back = ((7, 5, 3.2, 2.0, 1), (19, 3, 3.4, 2.1, -1), (31, 4, 3.2, 2.0, 1), (42, 5, 3.0, 1.9, -1))
    front = ((13, 13, 4.0, 2.5, -1), (25, 12, 4.2, 2.6, 1), (37, 14, 3.9, 2.4, -1))
    for row, top_ in ((back, 22), (front, 25)):
        for (x, y, rx, ry, face) in row:
            cyl(c, x, y + 2, 2, top_ - y - 2, LEAF[1:])
            for k, ly in enumerate(range(y + 6, top_ - 2, 5)):
                _leaf(c, x + (0 if k % 2 else 1), ly, -1 if k % 2 else 1)
        for (x, y, rx, ry, face) in row:
            # 뒤에 있는 머리·잎 위로 이 머리의 그늘 테(이미 칠한 곳에만)를 먼저 깔아 머리끼리 갈라 보이게 한다
            ball(c, x + 0.6, y + 0.8, rx * 1.4 + 1.6, [LEAF[4]], ry=ry * 1.45 + 1.6, mask=lambda xx, yy: 0 <= xx < c.w and 0 <= yy < c.h and c.a[yy, xx, 3] > 0)
            _sunflower_head(c, x, y, rx, ry, face)
    soft_outline(c)
    ground_shadow(c, 6, 47, 30, 2, SHADOW, 1)


@kit('inaka-hydrangea-hedge', '수국 꽃덤불(紫陽花) - 잎 덩이 위 파랑·보라 꽃송이·낮은 돌 테(3×2)', 3, 2, 'tree',
     solid=[(0, 1), (1, 1), (2, 1)], tags=['inaka', '수국', '紫陽花', '생울타리'],
     rules='집·절 담장 앞, 돌담 위에 이어 붙인다.', role='prop')
def hydrangea(c, base):
    # 돌 테: 판석 윗면 + 앞면 돌 한 개씩
    c.R(1, 23, 46, 9, OL)
    for y in range(24, 31):
        for x in range(2, 46):
            if y < 27:
                lv = 0.3 + (y - 24) * 0.4 + (H(x // 7, 0, 60) - 0.5) * 0.8 + (1.4 if x % 7 == 0 else 0)
            else:
                st = (x + (y // 2) * 3) // 6
                lv = 2.0 + (H(st, y // 2, 61) - 0.5) * 1.2 + (y - 27) * 0.3 + (2.0 if (x + (y // 2) * 3) % 6 == 0 else 0)
            c.P(x, y, pick(STONE, lv, x, y))
    speck(c, 2, 27, 44, 4, K('ki', -1), 0.08, 62)
    # 잎 덩이(뒤 깊은 그늘 → 앞 밝은 덩이)
    blobs = ((8, 15, 8, 7), (22, 13, 9, 8), (37, 15, 9, 7), (14, 19, 7, 4), (31, 19, 7, 4))
    for bx, by, rx, ry in blobs:
        ball(c, bx + 1, by + 1.5, rx, LEAF[2:], ry=ry, bias=0.2)
    for k, (bx, by, rx, ry) in enumerate(blobs):
        for j in range(6):
            a = j * 1.1 + k
            lx, ly = bx + math.cos(a) * rx * 0.55, by + math.sin(a) * ry * 0.55
            ball(c, lx, ly, 2.6, LEAF, ry=1.9, bias=0.1 + (math.cos(a) + math.sin(a)) * 0.2)
    # 꽃송이(작은 꽃 2px 결 + 공 명암): 파랑·보라·청자
    BLUE = [K('garasu', 3), K('sora', 2), K('sora', 1), K('sora', 0), K('kon', 0), K('kon', -1)]
    VIOLET = [K('murasaki', 2), K('murasaki', 1), K('kon', 2), K('murasaki', 0), K('kon', 0), K('murasaki', -1)]
    LILAC = [K('shiro', 2), K('kon', 2), K('kon', 1), K('murasaki', 0), K('kon', 0), K('kon', -1)]
    heads = ((5, 10, 4.2), (13, 7, 4.4), (21, 12, 4.0), (28, 6, 4.6), (36, 11, 4.2), (43, 8, 3.8), (9, 17, 3.4),
             (31, 17, 3.4), (17, 17, 3.0), (40, 17, 3.0), (2, 15, 2.6), (46, 14, 2.4))
    for k, (x, y, r) in enumerate(heads):
        cols = (BLUE, VIOLET, LILAC)[k % 3]
        for yy in range(int(y - r - 1), int(y + r + 2)):
            for xx in range(int(x - r - 1), int(x + r + 2)):
                u, v = (xx - x) / r, (yy - y) / (r * 0.85)
                if u * u + v * v > 1:
                    continue
                s = (u + v) * 0.62 + (u * u + v * v) * 0.35
                fl = (xx % 3 == 0) + (yy % 3 == 0)                # 작은 꽃(4장 꽃잎) 사이 틈
                lv = (s + 0.45) / 1.65 * 5 + (0.9 if fl == 2 else 0) - (0.7 if fl == 0 and H(xx, yy, k) < 0.4 else 0)
                c.P(xx, yy, pick(cols, lv, xx, yy))
    finish(c, [(4, 47, 32, 0, SHADOW, 1)])


@kit('inaka-jizo-shrine-row', '길가 지장보살 세 분 사당 - 片流れ 나무 지붕 윗면(깊이 1.5칸)·붉은 턱받이·돌 기단(3×3)', 3, 3, 'structure',
     solid=rows(3, [1, 2]), tags=['inaka', '지장', '地蔵', '사당'],
     rules='마을 갈림길·다리 옆. 앞 1칸 비운다.', role='prop')
def jizo_row(c, base):
    D = 14                                                        # 깊어진 지붕 면만큼 지장·기단을 아래로
    v = Cv.__new__(Cv)
    v.w, v.h, v.a = c.w, c.h - D, c.a[D:]

    def front(c):
        cyl(c, 3, 9, 2, 18, CEDAR, add=0.6); cyl(c, 43, 9, 2, 18, CEDAR, add=1.2)
        # 안 벽(처마 밑이라 어둡다, 널 이음)
        for y in range(10, 24):
            for x in range(5, 43):
                lv = 3.2 + (1.0 if y < 13 else 0) + (H(x // 5, 0, 70) - 0.5) * 0.8 + (0.9 if x % 5 == 0 else 0)
                c.P(x, y, pick(CEDAR, lv, x, y))
        # 돌 기단: 윗면 판석 → 앞면 돌 한 개씩
        c.R(1, 22, 46, 9, OL)
        for y in range(23, 30):
            for x in range(2, 46):
                if y < 26:
                    lv = 0.4 + (y - 23) * 0.4 + (H(x // 8, 1, 71) - 0.5) * 0.8 + (1.5 if x % 8 == 0 else 0)
                else:
                    st = (x + (y // 2) * 4) // 7
                    lv = 2.0 + (H(st, y // 2, 72) - 0.5) * 1.2 + (y - 26) * 0.3 + (2.0 if (x + (y // 2) * 4) % 7 == 0 else 0)
                c.P(x, y, pick(STONE, lv, x, y))
        speck(c, 2, 26, 44, 4, K('ki', -1), 0.08, 73)
        for x in (12, 24, 36):
            # 몸(돌 원통 + 이끼 점) → 머리(돌 공) → 붉은 턱받이(주름 명암)
            for yy in range(11, 22):                                  # 뒤 벽에 진 지장 그림자(오른쪽)
                c.P(x + 5, yy, CEDAR[5]); c.P(x + 4, yy - 2, CEDAR[5])
            cyl(c, x - 4, 15, 9, 9, STONE, add=0.0, grain=0.8, seed=x)
            ball(c, x, 12, 3.4, STONE, bias=-0.15)
            c.HL(x - 1, 13, 3, STONE[3]); c.P(x - 1, 12, STONE[2]); c.P(x + 1, 12, STONE[2])   # 감은 눈
            speck(c, x - 4, 20, 9, 4, K('ki', -1), 0.08, x + 1)
            for j in range(5):
                hw = 3 + j // 2
                for dx in range(-hw, hw + 1):
                    px, py = x + dx, 15 + j
                    lv = 0.8 + dx / hw * 1.2 + j * 0.3 + (1.0 if (dx + j) % 3 == 0 else 0)
                    c.P(px, py, pick(VERM, lv, px, py))
            c.HL(x - 3, 15, 7, VERM[0])
            hgrad(c, x - 3, 22, 7, 1, STONE, 0.5, 2.5)
        for x in (17, 30):                                            # 공양 꽃(작은 병 + 꽃)
            cyl(c, x, 23, 2, 2, CONC); c.P(x, 22, K('kii', 2)); c.P(x + 1, 21, K('aka', 1)); c.P(x + 1, 22, LEAF[2])
    front(v)
    # 片流れ 나무 지붕 윗면(y0~21 ≈ 1.5칸): 뒤(위)가 높고 앞(아래)으로 흘러내린다.
    # 널판은 경사 따라 세로(판마다 명암·이음 그늘), 7줄마다 겹친 판 끝(빛 + 그늘), 위쪽 빛 → 처마 쪽 그늘, 이끼
    for y in range(0, 10 + D):
        for x in range(0, 48):
            pl = x // 3
            lv = 0.4 + (y * 0.07) + (H(pl, y // 7, 74) - 0.5) * 1.2 + (x / 48) * 0.6 + (1.6 if x % 3 == 2 else 0)
            if y % 7 == 6:
                lv += 1.3                                         # 겹친 판 밑 그늘
            elif y % 7 == 0 and y > 0:
                lv -= 0.6                                         # 겹친 판 끝 빛
            if y >= 8 + D:
                lv = 3.0 + (y - 8 - D) * 0.8                      # 앞 처마 판(측면 두께)
            c.P(x, y, pick(CEDAR, lv, x, y))
    c.HL(0, 0, 48, CEDAR[0])
    speck(c, 0, 1, 48, 6 + D, J('moss', 2), 0.05, 75)              # 지붕 이끼
    finish(c, [(3, 47, 31 + D, 2, SHADOW, 0)])


# ═══════════════════════════ 물·담·다리 ═══════════════════════════


import inaka_art_walls  # noqa: E402,F401  (담·울타리·물 건너기 키트 등록)
from inaka_art_ground import GROUND, GROUND_GROUPS  # noqa: E402,F401
