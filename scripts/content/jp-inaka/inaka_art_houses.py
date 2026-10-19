#!/usr/bin/env python3
# noqa: SIZE_OK - jp-inaka shared 3/4 drawing parts + the 10 rural building kits
# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "pillow"]
# ///
# --- How to run ---
# python3 scripts/content/jp-inaka/bake_inaka.py
"""jp-inaka(일본 시골) 건물 키트 10종 - jp_city 본편 주택 부품(ref_house / house_kit / jp_regions_pack)으로 조립한다.

화풍 규칙(jp_city 와 같다):
  - 3/4 탑뷰: 지붕은 경사 윗면(기와 줄·초가 결)이 보이고, 그 아래 남쪽 정면 벽, 맨 아래 기단 윗면 + 앞면.
  - 색은 modern3 램프(K) + 일본 로케일 계약 색(J) 만, 빛은 왼쪽 위, 1px sumi 윤곽(OL), 반투명·노이즈 점 없음.
  - 지붕·창·현관·처마 그림자는 ref_house.py 의 hip_roof / lean_to / eave_shadow / sash / genkan 을 그대로 쓴다.
"""
from __future__ import annotations

import json
import os
import sys
from typing import Final

HERE: Final[str] = os.path.dirname(os.path.abspath(__file__))
ROOT: Final[str] = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
JP_CITY_DIR: Final[str] = os.path.join(ROOT, 'scripts', 'content', 'jp-city')
for _p in (os.path.join(JP_CITY_DIR, 'houses'), os.path.join(JP_CITY_DIR, 'blocks'), JP_CITY_DIR):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from house_kit import Cv, K, OL, gable_side, lattice_door, shed, wall  # noqa: E402
from jp_regions_pack import add_outline, canopy_clusters, plinth_34, rect_3d, stones  # noqa: E402,F401
from ref_house import eave_shadow, foundation, genkan, hip_roof, lean_to, sash  # noqa: E402
from shitamachi_pack import H, disc, line  # noqa: E402,F401

with open(os.path.join(ROOT, 'tiledata', 'jp-city', 'palette-contract.json'), encoding='utf-8') as _f:
    _CONTRACT = json.load(_f)
_RAMP: Final[dict[str, list[int]]] = {
    m['id']: [int(h[1:], 16) for h in m['steps']]
    for f in _CONTRACT['families']
    for m in f['materials']
}


def J(mat: str, s: int) -> int:
    """계약 재료 mat 의 단 s(0 그늘 … 4 하이라이트)."""
    r = _RAMP[mat]
    return r[max(0, min(4, s))]


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


# ═══════════════════════════ 공통 시골 부품 ═══════════════════════════
def lerp(a, b, f):
    return a + (b - a) * f


def post(c, x, y, h, mat='machiya_timber', t=2, w=2):
    """나무 기둥(빛 왼쪽 1px 밝게, 오른쪽 1px 어둡게)."""
    c.R(x, y, w, h, J(mat, t))
    c.VL(x, y, h, J(mat, t + 1))
    c.VL(x + w - 1, y, h, J(mat, t - 1))


def shoji(c, x, y, w, h, panes=2):
    """장지문(障子): 나무 틀 + 흰 종이 + 4px 격자 + 아래 나무 허리판. 미닫이 맞닿는 곳은 짙은 틀."""
    c.R(x, y, w, h, J('machiya_timber', 2))
    c.R(x + 1, y + 1, w - 2, h - 2, J('cream_stucco', 4))
    for gx in range(x + 4, x + w - 1, 4):
        c.VL(gx, y + 1, h - 6, J('cream_stucco', 2))
    for gy in range(y + 5, y + h - 5, 5):
        c.HL(x + 1, gy, w - 2, J('cream_stucco', 2))
    c.R(x + 1, y + h - 5, w - 2, 4, J('aged_cedar', 2))
    c.HL(x + 1, y + h - 5, w - 2, J('aged_cedar', 3))
    for k in range(1, panes):
        px = x + w * k // panes
        c.VL(px, y, h, J('machiya_timber', 1))
    c.HL(x + 1, y + 1, w - 2, J('cream_stucco', 1))            # 윗틀 밑 그늘
    c.VL(x - 1, y, h, OL); c.VL(x + w, y, h, OL)


def noren(c, x, y, w, h, mat='noren_indigo', crest=True):
    """포렴: 세 폭 천, 폭 사이 1px 틈, 가운데 흰 문장."""
    c.R(x, y, w, h, J(mat, 2))
    c.HL(x, y, w, J(mat, 3))
    c.HL(x, y + h - 1, w, J(mat, 1))
    for k in range(1, 3):
        sx = x + w * k // 3
        c.VL(sx, y + 3, h - 3, J(mat, 0))
    c.VL(x + w - 1, y, h, J(mat, 1))
    if crest:
        cx, cy = x + w // 2, y + h // 2
        c.R(cx - 1, cy - 1, 3, 3, J('vending_cool_white', 4)); c.P(cx, cy, J(mat, 2))


def engawa(c, x, y, w, depth=5, front=3):
    """툇마루(縁側): 윗면 판재(depth px, 가로 이음) + 앞 테 + 짧은 다리. 3/4 윗면이 확실히 보인다."""
    c.R(x, y, w, depth, J('aged_cedar', 3))
    c.HL(x, y, w, J('aged_cedar', 1))                         # 벽 밑 그늘
    for k, yy in enumerate(range(y + 1, y + depth)):
        for sx in range(x + (k * 7) % 11, x + w, 11):
            c.P(sx, yy, J('aged_cedar', 2))                  # 판 이음
    c.HL(x, y + depth - 1, w, J('aged_cedar', 4))             # 앞 끝 밝은 모서리
    c.R(x, y + depth, w, front, J('machiya_timber', 3))
    c.HL(x, y + depth + front - 1, w, J('machiya_timber', 1))
    for px in range(x + 2, x + w - 2, 14):
        c.R(px, y + depth + front, 2, 2, J('machiya_timber', 1))
    c.VL(x - 1, y, depth + front, OL); c.VL(x + w, y, depth + front, OL)
    c.HL(x - 1, y + depth + front, w + 2, OL)


def step_stone(c, x, y, w=10):
    """沓脱石: 윗면 3px + 앞면 2px 판석."""
    c.R(x - 1, y - 1, w + 2, 7, OL)
    c.R(x, y, w, 3, J('shrine_flagstone', 3)); c.HL(x, y, w, J('shrine_flagstone', 4))
    c.R(x, y + 3, w, 2, J('shrine_flagstone', 1))


def stone_base(c, x, y, w, h=5, mat='shrine_flagstone'):
    """건물 밑 돌 기단(윗면 2px + 앞면 돌 줄눈)."""
    c.R(x, y, w, h, J(mat, 2))
    c.HL(x, y, w, J(mat, 4)); c.HL(x, y + 1, w, J(mat, 3))
    for sx in range(x + 5, x + w - 2, 9):
        c.VL(sx, y + 2, h - 2, J(mat, 0))
    c.HL(x, y + h - 1, w, J(mat, 0))
    c.VL(x - 1, y, h, OL); c.VL(x + w, y, h, OL); c.HL(x - 1, y + h, w + 2, OL)


def plaster(c, x, y, w, h, mat='shiro', base=1):
    """회벽(漆喰): 평평한 흰 면 + 왼쪽 1px 빛, 오른쪽 1px 그늘."""
    c.R(x, y, w, h, K(mat, base))
    c.VL(x, y, h, K(mat, base + 1)); c.VL(x + w - 1, y, h, K(mat, base - 1))


def thatch_roof(c, x0, x1, ytop, yeave, run, ridge=True):
    """茅葺き 寄棟: 사다리꼴 경사 윗면. 6px 이엉 단(위 밝은 립, 아래 그늘) + 세로 짚 결.
    왼쪽 隅 삼각면 밝게, 오른쪽 그늘. 처마는 5px 두께로 짚 끝 단면이 보인다."""
    rl, rr = x0 + run, x1 - run
    n = yeave - ytop
    for y in range(ytop, yeave):
        f = (y - ytop) / n
        xl = round(lerp(rl, x0, f)); xr = round(lerp(rr, x1, f))
        bl = round(lerp(rl, x0 + run // 2, f)); br = round(lerp(rr, x1 - run // 2, f))
        k = (y - ytop) % 6
        for x in range(xl, xr + 1):
            if x < bl: t = 3
            elif x > br: t = 1
            else: t = 3 if f < 0.42 else 2
            if k == 5: t -= 1
            elif k == 0: t += 1
            elif (x * 3 + ((y - ytop) // 6) * 2) % 5 == 0: t -= 1
            c.P(x, y, J('tatami_straw', t))
        c.P(bl, y, J('tatami_straw', 4)); c.P(br, y, J('tatami_straw', 1)); c.P(br + 1, y, J('tatami_straw', 0))
        c.P(xl - 1, y, OL); c.P(xr + 1, y, OL)
    # 처마 두께(짚 끝 단면 5px)
    ex0, ex1 = x0 - 2, x1 + 2
    c.HL(ex0, yeave, ex1 - ex0 + 1, J('tatami_straw', 4))
    for x in range(ex0, ex1 + 1):
        c.P(x, yeave + 1, J('tatami_straw', 3 if x % 2 else 2))
        c.P(x, yeave + 2, J('tatami_straw', 2 if x % 3 else 1))
        c.P(x, yeave + 3, J('aged_cedar', 1))
    c.HL(ex0, yeave + 4, ex1 - ex0 + 1, OL)
    c.VL(ex0 - 1, yeave, 4, OL); c.VL(ex1 + 1, yeave, 4, OL)
    if ridge:
        # 箱棟(대나무로 누른 용마루): 윗면 2px + 앞면 4px + 烏おどり(교차 막대)
        bx0, bx1 = rl - 4, rr + 4
        c.R(bx0 - 1, ytop - 8, bx1 - bx0 + 3, 9, OL)
        c.R(bx0, ytop - 7, bx1 - bx0 + 1, 2, J('machiya_timber', 4))
        c.HL(bx0, ytop - 7, bx1 - bx0 + 1, J('aged_cedar', 3))
        c.R(bx0, ytop - 5, bx1 - bx0 + 1, 4, J('machiya_timber', 2))
        c.HL(bx0, ytop - 2, bx1 - bx0 + 1, J('machiya_timber', 0))
        for sx in range(bx0 + 3, bx1 - 1, 5):
            c.VL(sx, ytop - 5, 3, J('pine_bamboo', 3))         # 대나무 누름대
        for sx in range(bx0 + 5, bx1 - 3, 10):                 # 烏おどり
            c.P(sx, ytop - 9, J('aged_cedar', 3)); c.P(sx + 2, ytop - 9, J('aged_cedar', 2))
            c.P(sx - 1, ytop - 10, OL); c.P(sx + 3, ytop - 10, OL); c.P(sx + 1, ytop - 8, J('aged_cedar', 2))


def kawara_gable(c, x0, x1, ytop, yeave, mat='tekko', base=0):
    """house_kit.gable_side 와 같은 切妻 경사 윗면(기와 줄) - 짧은 별칭."""
    gable_side(c, x0, x1, ytop, yeave, mat, base)


# ═══════════════════════════ 1. 초가 고민가 ═══════════════════════════
@kit('inaka-kominka-thatched', '초가 고민가(茅葺き古民家) - 이엉 寄棟 지붕·箱棟·흙벽·장지문·툇마루(6×5)', 6, 5, 'building',
     solid=rows(6, [3, 4]), tags=['inaka', '고민가', '초가집', '茅葺き', '古民家'],
     rules='시골 마을 중심 집. 앞(남)에 흙마당 2칸 이상, 뒤에 대숲·삼나무. 현관은 왼쪽 두 번째 칸.', role='building',
     doors=[(1, 4, 1)])
def kominka(c, base):
    X0, X1 = 6, 89
    # 벽(지붕 아래): 위 흙벽(漆喰) 띠 + 아래 판자·장지
    WT, WB = 50, 71
    plaster(c, X0, WT, X1 - X0 + 1, 8, 'kinari', 1)
    c.R(X0, WT + 8, X1 - X0 + 1, WB - WT - 8, J('aged_cedar', 2))
    for x in range(X0, X1 + 1, 3):
        c.VL(x, WT + 9, WB - WT - 9, J('aged_cedar', 1))
    c.HL(X0, WT + 8, X1 - X0 + 1, J('machiya_timber', 2))       # 長押(가로 보)
    for px in (X0, 24, 40, 72, X1 - 1):
        post(c, px, WT, WB - WT)
    eave_shadow(c, X0, WT, X1 - X0 + 1, 'kinari', 1)
    c.VL(X0 - 1, WT, WB - WT, OL); c.VL(X1 + 1, WT, WB - WT, OL)
    # 현관(土間 입구): 물러선 어두운 감실 + 남색 포렴
    c.R(12, WT + 3, 12, WB - WT - 3, J('machiya_timber', 0))
    c.R(12, WB - 4, 12, 4, J('aged_cedar', 1))
    noren(c, 12, WT + 3, 12, 9)
    c.VL(11, WT + 3, WB - WT - 3, OL)
    # 장지문 6장(툇마루 안쪽)
    shoji(c, 42, WT + 9, 29, WB - WT - 9, panes=3)
    # 오른쪽 창(격자 연子窓)
    c.R(75, WT + 11, 12, 7, J('machiya_timber', 0))
    for gx in range(76, 87, 2): c.VL(gx, WT + 11, 7, J('aged_cedar', 3))
    c.HL(74, WT + 18, 14, J('aged_cedar', 4)); c.VL(74, WT + 11, 7, OL)
    # 지붕(두꺼운 이엉)
    thatch_roof(c, 2, 93, 12, 44, 26)
    # 툇마루 + 디딤돌 + 돌 기단
    stone_base(c, X0, WB, X1 - X0 + 1, 5)
    engawa(c, 40, WB - 4, 50, depth=5, front=3)
    step_stone(c, 55, WB + 5, 10)
    step_stone(c, 14, WB + 5, 8)


# ═══════════════════════════ 2. 기와 농가 ═══════════════════════════
@kit('inaka-kawara-farmhouse', '기와 농가 - 寄棟 기와 지붕·下屋·회벽·격자문·툇마루(6×5)', 6, 5, 'building',
     solid=rows(6, [3, 4]), tags=['inaka', '기와집', '농가', '瓦', '母屋'],
     rules='마을 큰 농가 본채. 앞에 마당·경트럭, 옆에 토장 창고와 헛간.', role='building', doors=[(1, 4, 1)])
def farmhouse(c, base):
    X0, X1 = 8, 87
    # 2층 회벽 띠(本屋 벽: 하얀 회벽 + 기둥)
    plaster(c, X0, 38, X1 - X0 + 1, 10, 'shiro', 1)
    for px in (X0, 28, 48, 68, X1 - 1):
        post(c, px, 38, 10, 'machiya_timber', 2)
    eave_shadow(c, X0, 38, X1 - X0 + 1, 'shiro', 1)
    c.VL(X0 - 1, 38, 10, OL); c.VL(X1 + 1, 38, 10, OL)
    for wx in (32, 52):                                         # 작은 고창
        c.R(wx, 41, 10, 5, J('machiya_timber', 0))
        for gx in range(wx + 1, wx + 10, 2): c.VL(gx, 41, 5, J('aged_cedar', 3))
    # 1층 벽
    Y1, YF = 57, 73
    wall(c, X0, Y1, X1 - X0 + 1, YF - Y1, 'ita', 1, 'board')
    eave_shadow(c, X0, Y1, X1 - X0 + 1, 'ita', 1)
    lattice_door(c, 12, Y1 + 1, 20, YF - Y1 - 1)               # 현관 격자 미닫이
    shoji(c, 40, Y1 + 1, 30, YF - Y1 - 1, panes=3)
    sash(c, 74, Y1 + 4, 10, 8, 'ita', 1, shutter=False)
    # 지붕: 寄棟 본채 + 앞 下屋
    hip_roof(c, 4, 91, 12, 34, 24, 'tairu', 0)
    lean_to(c, 4, 91, 48, 53, 'tairu', 0)
    foundation(c, X0, YF, X1 - X0 + 1, vents=(48,))
    c.VL(X0 - 1, YF, 4, OL); c.VL(X1 + 1, YF, 4, OL); c.HL(X0 - 1, YF + 4, X1 - X0 + 3, OL)
    engawa(c, 38, YF - 3, 34, depth=4, front=3)
    step_stone(c, 50, YF + 5, 10)
    step_stone(c, 17, YF + 5, 10)


# ═══════════════════════════ 3. 토장 창고 ═══════════════════════════
def namako(c, x, y, w, h):
    """海鼠壁: 짙은 평기와 마름모 + 볼록한 흰 회반죽 줄눈(위 밝고 아래 그늘)."""
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            u, v = (xx + yy) % 8, (xx - yy) % 8
            if u == 0 or v == 0: col = K('shiro', 2)
            elif u == 1 or v == 7: col = K('shiro', -1)
            else: col = K('tekko', -1 if (xx // 4 + yy // 4) % 2 else -2)
            c.P(xx, yy, col)
    c.HL(x, y, w, K('shiro', 0))


@kit('inaka-kura-storehouse', '토장 창고(土蔵) - 검은 기와 切妻·흰 회벽·海鼠壁·観音扉(4×4)', 4, 4, 'building',
     solid=rows(4, [2, 3]), tags=['inaka', '토장', '창고', '蔵', '海鼠壁'],
     rules='농가 본채 옆·뒤. 앞에 돌계단 칸을 비운다.', role='building', doors=[(1, 3, 2)])
def kura(c, base):
    X0, X1 = 6, 57
    plaster(c, X0, 25, X1 - X0 + 1, 26, 'shiro', 1)
    c.R(X0, 25, X1 - X0 + 1, 3, K('tekko', -2))                # 鉢巻(처마 밑 검은 띠)
    c.HL(X0, 28, X1 - X0 + 1, K('shiro', -1))
    namako(c, X0, 40, X1 - X0 + 1, 11)
    c.VL(X0 - 1, 25, 26, OL); c.VL(X1 + 1, 25, 26, OL)
    # 観音扉: 계단식 두꺼운 문틀(3단) + 닫힌 두 짝
    dx, dy, dw, dh = 22, 30, 20, 21
    for k, t in enumerate((-1, 0, 1)):
        c.R(dx + k, dy + k, dw - 2 * k, dh - k, K('shiro', t))
    c.R(dx + 3, dy + 3, dw - 6, dh - 3, K('tekko', -1))
    c.VL(dx + dw // 2, dy + 3, dh - 3, K('tekko', -3))
    c.VL(dx + 3, dy + 3, dh - 3, K('tekko', 1))
    for hy in (dy + 7, dy + 15):
        c.R(dx + dw // 2 - 3, hy, 2, 2, K('kii', 1)); c.R(dx + dw // 2 + 2, hy, 2, 2, K('kii', 1))
    c.VL(dx - 1, dy, dh, OL)
    # 높은 창(철 덧문)
    c.R(46, 31, 7, 6, K('tekko', -2))
    for gx in (47, 49, 51): c.VL(gx, 31, 6, K('tekko', 2))
    c.HL(45, 37, 9, K('shiro', 2)); c.VL(45, 31, 6, OL)
    kawara_gable(c, 3, 60, 3, 21, 'tekko', -1)
    # 기단 + 돌계단(윗면·챌면)
    plinth_34(c, 3, 51, 58, 7, top_h=2, mat='shrine_flagstone')
    rect_3d(c, 20, 56, 24, 5, 2, 'shrine_flagstone', top_t=3, front_t=2)
    rect_3d(c, 18, 59, 28, 5, 2, 'shrine_flagstone', top_t=3, front_t=1)


# ═══════════════════════════ 4. 막과자 가게 ═══════════════════════════
@kit('inaka-dagashiya', '막과자 가게(駄菓子屋) - 기와 切妻·줄무늬 차양·사탕 병 진열대·법랑 간판(5×4)', 5, 4, 'building',
     solid=rows(5, [2, 3]), tags=['inaka', '다가시야', '막과자', '駄菓子屋', '가게'],
     rules='마을 길가·버스 정류장 옆. 가게 앞 1칸은 비워 둔다(아이들 자리).', role='building', doors=[(2, 3, 1)])
def dagashiya(c, base):
    X0, X1 = 5, 74
    # 위 판자벽 + 간판
    wall(c, X0, 21, X1 - X0 + 1, 12, 'ita', 0, 'board')
    eave_shadow(c, X0, 21, X1 - X0 + 1, 'ita', 1)
    c.R(22, 23, 36, 8, K('kii', 1)); c.HL(22, 23, 36, K('kii', 2)); c.HL(22, 30, 36, K('kii', -1))
    c.R(21, 22, 38, 1, OL); c.R(21, 31, 38, 1, OL); c.VL(21, 22, 10, OL); c.VL(58, 22, 10, OL)
    for gx in (26, 34, 42, 50):                                # 간판 글자(だがし) 획
        c.R(gx, 25, 5, 1, K('sumi', 0)); c.VL(gx + 2, 25, 4, K('sumi', 0)); c.P(gx + 4, 27, K('sumi', 0))
    # 가게 앞(열린 진열창)
    YS, YF = 38, 57
    c.R(X0, YS, X1 - X0 + 1, YF - YS, J('machiya_timber', 0))
    for sy, cols in ((40, ('aka', 'kii', 'midori', 'pinku', 'sora')), (46, ('daidai', 'sora', 'aka', 'midori', 'kii'))):
        c.HL(X0 + 2, sy + 4, X1 - X0 - 3, J('aged_cedar', 3))  # 선반
        for k, x in enumerate(range(X0 + 4, X1 - 4, 6)):
            col = cols[k % len(cols)]
            c.R(x, sy, 4, 4, K('garasu', 1)); c.R(x, sy + 2, 4, 2, K(col, 1)); c.P(x, sy, K('shiro', 2))
            c.HL(x, sy - 1, 4, K('tekko', 2))                  # 병뚜껑
    # 앞 진열대(3/4 윗면에 상자·뽑기 통)
    rect_3d(c, X0 + 2, 50, 44, 9, 4, 'aged_cedar', top_t=3, front_t=2)
    for k, (x, col) in enumerate(((10, 'aka'), (17, 'kii'), (24, 'sora'), (31, 'pinku'), (38, 'midori'))):
        c.R(x, 51, 5, 3, K(col, 1)); c.HL(x, 51, 5, K(col, 2))
    # 오른쪽: 유리 미닫이 + 라무네 냉장고
    c.R(52, YS, 22, YF - YS, K('tekko', 2))
    c.R(53, YS + 1, 9, YF - YS - 2, K('garasu', 0)); c.R(63, YS + 1, 10, YF - YS - 2, K('garasu', 0))
    c.VL(54, YS + 2, 8, K('garasu', 2)); c.VL(64, YS + 2, 8, K('garasu', 2))
    rect_3d(c, 55, 47, 16, 11, 3, 'vending_cool_white', top_t=4, front_t=3)
    c.R(57, 51, 12, 4, K('sora', 1)); c.HL(57, 51, 12, K('sora', 2))
    c.VL(X0 - 1, YS, YF - YS, OL); c.VL(X1 + 1, YS, YF - YS, OL)
    # 줄무늬 차양(3/4 윗면 경사 + 앞 주름 끝)
    for y in range(32, 38):
        for x in range(X0 - 2, X1 + 3):
            band = ((x - X0) // 5) % 2
            t = 2 if y < 34 else 1 if y < 36 else 0
            c.P(x, y, K('aka', t) if band == 0 else K('shiro', t))
    for x in range(X0 - 2, X1 + 3):
        if ((x - X0) % 5) in (1, 2, 3):
            c.P(x, 38, K('aka', -1) if ((x - X0) // 5) % 2 == 0 else K('shiro', -1))
    c.HL(X0 - 3, 31, X1 - X0 + 7, OL); c.VL(X0 - 3, 32, 6, OL); c.VL(X1 + 3, 32, 6, OL)
    # 둥근 법랑 간판(기둥에)
    disc(c, 4, 46, 3.6, OL); disc(c, 4, 46, 2.6, K('sora', 1)); c.P(3, 45, K('shiro', 2)); c.P(4, 46, K('shiro', 1))
    # 지붕 + 기단
    kawara_gable(c, 2, 77, 3, 18, 'tekko', 0)
    stone_base(c, X0, YF, X1 - X0 + 1, 4)


# ═══════════════════════════ 5. 목조 간이역 ═══════════════════════════
@kit('inaka-wooden-station', '목조 간이역(木造駅舎) - 기와 寄棟·시계 박공·개찰·역명판·승강장 기단(7×4)', 7, 4, 'building',
     solid=rows(7, [2, 3]), tags=['inaka', '간이역', '목조역', '駅舎', '無人駅'],
     rules='선로(jp-rail-h) 바로 남쪽 또는 북쪽에 승강장 끝(jp-platform-edge)과 나란히 둔다. 개찰구는 가운데 두 칸.',
     role='building', doors=[(3, 3, 2)])
def station(c, base):
    X0, X1 = 7, 104
    YW, YF = 28, 49
    wall(c, X0, YW, X1 - X0 + 1, YF - YW, 'lino', 1, 'siding')
    eave_shadow(c, X0, YW, X1 - X0 + 1, 'lino', 1)
    for px in (X0, 42, 70, X1 - 1):
        post(c, px, YW, YF - YW, 'aged_cedar', 1)
    sash(c, 14, 34, 22, 11, 'lino', 1, shutter=False)
    sash(c, 76, 34, 22, 11, 'lino', 1, shutter=False)
    # 가운데 개찰(열린 입구 + 나무 개찰 울)
    c.R(45, 31, 24, YF - 31, J('machiya_timber', 0))
    c.R(45, 31, 24, 2, J('machiya_timber', 1))
    for gx in (49, 56, 63):
        rect_3d(c, gx, 40, 4, 9, 2, 'aged_cedar', top_t=4, front_t=2)
    c.HL(46, 42, 22, J('aged_cedar', 3))
    c.VL(44, 31, YF - 31, OL)
    # 역명판(흰 판 + 駅 글자) - 입구 위
    c.R(46, 29, 22, 1, OL)
    # 시간표판(오른쪽 벽 끝)
    c.R(100, 33, 3, 12, K('kokuban', 0))
    # 지붕(테라코타 기와 寄棟) + 가운데 시계 박공
    hip_roof(c, 3, 108, 10, 24, 16, 'kawara', 0)
    gx0, gx1, gy = 44, 68, 24
    for y in range(12, gy):
        half = (y - 12) * 12 / 12
        for x in range(round(56 - half), round(56 + half) + 1):
            c.P(x, y, K('shiro', 1 if x < 56 else 0))
    line(c, 56, 10, gx0 - 2, gy, K('kawara', 2)); line(c, 56, 11, gx0 - 1, gy, K('kawara', 0))
    line(c, 56, 10, gx1 + 2, gy, K('kawara', -1)); line(c, 56, 11, gx1 + 1, gy, K('kawara', -2))
    line(c, 56, 9, gx0 - 3, gy, OL); line(c, 56, 9, gx1 + 3, gy, OL)
    disc(c, 56, 19, 3.6, OL); disc(c, 56, 19, 2.7, K('shiro', 2)); c.VL(56, 17, 2, K('sumi', 0)); c.P(57, 19, K('sumi', 0))
    # 역명 간판(처마 밑 흰 판, 남색 테)
    c.R(44, 25, 26, 6, OL); c.R(45, 26, 24, 4, K('shiro', 2)); c.HL(45, 29, 24, K('kon', 0))
    for gx in (49, 55, 61): c.R(gx, 27, 4, 1, K('sumi', 0)); c.P(gx + 1, 28, K('sumi', 0))
    c.R(99, 32, 5, 14, OL); c.R(100, 33, 3, 12, K('kokuban', 0)); c.HL(100, 35, 3, K('shiro', 1)); c.HL(100, 38, 3, K('shiro', 1)); c.HL(100, 41, 3, K('shiro', 1))
    # 승강장 기단(판석 윗면 5px + 앞면)
    plinth_34(c, 1, YF, 110, 14, top_h=5, mat='paving_stone')
    c.HL(2, YF + 4, 108, K('kii', 2))                           # 점자 블록 띠


# ═══════════════════════════ 6. 버스 정류장 대합실 ═══════════════════════════
@kit('inaka-bus-stop-shelter', '시골 버스 대합실 - 片流れ 함석 지붕·판자 뒷벽·나무 벤치·둥근 정류장 표지(3×3)', 3, 3, 'structure',
     solid=[(0, 2), (1, 2), (2, 2)], tags=['inaka', '버스정류장', '대합실', 'バス停'],
     rules='시골 길가(자갈길·생활도로) 북쪽에 정면이 길을 보게 둔다. 벤치 칸(아래 가운데)은 앉을 수 있다.', role='building')
def bus_shelter(c, base):
    # 판자 뒷벽(안쪽 그늘)
    c.R(4, 15, 30, 20, J('aged_cedar', 1))
    for x in range(4, 34, 4): c.VL(x, 15, 20, J('aged_cedar', 0))
    c.HL(4, 15, 30, J('machiya_timber', 1)); c.HL(4, 16, 30, J('machiya_timber', 2))
    c.R(20, 19, 9, 11, K('shiro', 1)); c.HL(20, 19, 9, K('aka', 0)); c.HL(21, 22, 6, K('tekko', 0)); c.HL(21, 24, 7, K('tekko', 0)); c.HL(21, 26, 5, K('tekko', 0))
    c.VL(3, 15, 20, OL); c.VL(34, 15, 20, OL)
    # 콘크리트 바닥 슬래브(윗면) + 벤치
    rect_3d(c, 1, 33, 36, 9, 4, 'concrete_grey', top_t=3, front_t=2)
    rect_3d(c, 7, 27, 22, 6, 3, 'aged_cedar', top_t=4, front_t=2)
    c.R(9, 33, 2, 3, J('machiya_timber', 1)); c.R(25, 33, 2, 3, J('machiya_timber', 1))
    # 기둥
    post(c, 3, 13, 21, 'machiya_timber', 3, 3); post(c, 32, 13, 21, 'machiya_timber', 3, 3)
    # 片流れ 지붕(뒤로 올라가는 경사 윗면, 녹슨 함석)
    shed(c, 1, 36, 4, 11, 'tekko', 0)
    for (rx, ry) in ((8, 6), (9, 7), (24, 8), (25, 8), (26, 9), (14, 9)):
        c.P(rx, ry, J('noren_rust', 3))
    # 둥근 버스 정류장 표지(파랑 테 + 흰 판) + 기둥 + 콘크리트 받침
    c.R(42, 12, 2, 30, K('tekko', 2)); c.VL(42, 12, 30, K('tekko', 3)); c.VL(41, 12, 30, OL); c.VL(44, 12, 30, OL)
    disc(c, 42.5, 8, 5.6, OL); disc(c, 42.5, 8, 4.6, K('sora', 0)); disc(c, 42.5, 8, 3.2, K('shiro', 2))
    c.HL(40, 8, 6, K('sora', 0)); c.P(41, 6, K('aka', 1)); c.P(42, 6, K('aka', 1))
    c.R(40, 18, 6, 7, K('shiro', 2)); c.HL(40, 18, 6, K('sora', 1)); c.HL(41, 21, 4, K('tekko', 0)); c.HL(41, 23, 4, K('tekko', 0))
    c.R(39, 17, 8, 1, OL); c.VL(39, 18, 7, OL); c.VL(46, 18, 7, OL); c.HL(39, 25, 8, OL)
    disc(c, 42.5, 43, 4.2, OL, ry=2.6); disc(c, 42.5, 43, 3.2, K('conc', 1), ry=1.6); c.HL(41, 42, 3, K('conc', 3))


# ═══════════════════════════ 7. 물레방아간 ═══════════════════════════
@kit('inaka-waterwheel-mill', '물레방아간(水車小屋) - 초가 오두막·筧 물길·나무 물레·돌 물받이(4×4)', 4, 4, 'building',
     solid=rows(4, [2, 3]), tags=['inaka', '물레방아', '水車', '물레방아간'],
     rules='개울·수로 가장자리에 둔다(오른쪽 아래 물받이가 물에 닿는다).', role='building', doors=[(1, 3, 1)])
def waterwheel_mill(c, base):
    # 오두막 벽 + 문
    wall(c, 6, 31, 28, 20, 'ita', 0, 'board')
    eave_shadow(c, 6, 31, 28, 'ita', 1)
    c.R(13, 37, 10, 14, J('machiya_timber', 0)); c.R(14, 38, 8, 2, J('machiya_timber', 1)); c.VL(12, 37, 14, OL)
    thatch_roof(c, 3, 37, 13, 27, 9)
    stone_base(c, 4, 51, 32, 4)
    # 돌 물받이(윗면에 물 + 앞면 돌)
    c.R(36, 49, 27, 14, OL)
    stones(c, 37, 54, 25, 8, 'shrine_flagstone', seed=3, course=(4, 4), width=(6, 9), moss=0.25)
    c.R(37, 50, 25, 4, K('sora', 0)); c.HL(37, 50, 25, J('shrine_flagstone', 4)); c.HL(38, 52, 6, K('sora', 2)); c.HL(48, 51, 5, K('sora', 1))
    # 물레(두께 = 오른쪽 아래로 밀린 짙은 원) + 테 + 살 + 축
    cx, cy, r = 47, 34, 13.5
    disc(c, cx + 2, cy + 1, r + 1, OL)
    disc(c, cx + 2, cy + 1, r, J('aged_cedar', 0))
    disc(c, cx, cy, r + 1, OL)
    disc(c, cx, cy, r, J('aged_cedar', 3))
    disc(c, cx, cy, r - 3, J('machiya_timber', 1))
    import math
    for k in range(8):
        a = k * math.pi / 4
        line(c, round(cx), round(cy), round(cx + math.cos(a) * (r - 2)), round(cy + math.sin(a) * (r - 2)), J('aged_cedar', 2))
    for k in range(16):
        a = k * math.pi / 8 + 0.2
        px, py = round(cx + math.cos(a) * (r - 1)), round(cy + math.sin(a) * (r - 1))
        c.P(px, py, J('aged_cedar', 1))
    for k in range(10):                                         # 테 왼쪽 위 빛
        a = math.pi + k * 0.16
        c.P(round(cx + math.cos(a) * (r - 0.5)), round(cy + math.sin(a) * (r - 0.5)), J('aged_cedar', 4))
    disc(c, cx, cy, 2.4, OL); disc(c, cx, cy, 1.5, K('tekko', 2))
    # 筧(나무 물길): 윗면에 물이 보이는 홈통, 오른쪽 위에서 물레 꼭대기로
    for k in range(18):
        x = 62 - k; y = 4 + k // 2
        c.P(x, y - 1, OL); c.P(x, y, J('aged_cedar', 4)); c.P(x, y + 1, K('sora', 1)); c.P(x, y + 2, K('sora', 2) if k % 3 else K('sora', 1))
        c.P(x, y + 3, J('aged_cedar', 3)); c.P(x, y + 4, J('aged_cedar', 1)); c.P(x, y + 5, OL)
    c.R(58, 8, 2, 12, J('machiya_timber', 2)); c.VL(57, 8, 12, OL); c.VL(60, 8, 12, OL)   # 받침 기둥
    # 떨어지는 물 + 물보라
    for y in range(13, 22):
        c.P(44, y, K('sora', 2)); c.P(45, y, K('shiro', 2) if y % 3 else K('sora', 2))
    for (sx, sy) in ((40, 48), (42, 47), (52, 48), (55, 49), (47, 48)):
        c.P(sx, sy, K('shiro', 2)); c.P(sx + 1, sy, K('shiro', 1))


# ═══════════════════════════ 8. 비닐하우스 ═══════════════════════════
@kit('inaka-vinyl-greenhouse', '비닐하우스 - 둥근 지붕 윗면·골조·앞 박공 미닫이·안쪽 작물 줄(5×3)', 5, 3, 'building',
     solid=rows(5, [1, 2]), tags=['inaka', '비닐하우스', '온실', 'ハウス'],
     rules='밭(inaka-paddy 아님) 옆 흙 위에 둔다. 가운데 아래 칸이 출입구.', role='building', doors=[(2, 2, 1)])
def greenhouse(c, base):
    import math
    x0, x1, yb, rise, depth = 3, 76, 43, 22, 16
    cx, half = (x0 + x1) / 2, (x1 - x0) / 2

    def arch_y(x, d):
        u = (x - cx) / half
        if abs(u) > 1: return None
        return yb - d - rise * math.sqrt(1 - u * u)
    # 둥근 지붕 윗면(뒤 아치까지 depth px): 원통 명암(왼쪽 밝음, 가운데 하이라이트, 오른쪽 그늘)
    for x in range(x0, x1 + 1):
        top = arch_y(x, depth); front = arch_y(x, 0)
        if top is None: continue
        u = (x - cx) / half
        t = 2 if u < -0.6 else 4 if u < 0.05 else 3 if u < 0.5 else 1
        for y in range(round(top), round(front)):
            c.P(x, y, J('vending_cool_white', t))
    for d in range(0, depth + 1, 4):                            # 골조 파이프(아치)
        for x in range(x0, x1 + 1):
            ay = arch_y(x, d)
            if ay is not None: c.P(x, round(ay), K('tekko', 1) if d else K('tekko', 3))
    for x in (round(cx),):                                      # 용마루 파이프
        c.VL(x, round(arch_y(x, depth)), depth, K('tekko', 2))
    # 앞 박공(반원 면): 비닐 너머 작물 줄 + 가운데 미닫이
    for x in range(x0, x1 + 1):
        fy = arch_y(x, 0)
        if fy is None: continue
        for y in range(round(fy) + 1, yb):
            c.P(x, y, J('vending_cool_white', 2 if y < yb - 9 else 1))
    for ry in (36, 39):
        for x in range(x0 + 4, x1 - 3, 3):
            if 32 <= x <= 47: continue
            c.P(x, ry, K('midori', 1)); c.P(x + 1, ry, K('midori', 0)); c.P(x, ry - 1, K('midori', 2))
    c.R(32, 25, 16, 18, K('tekko', 2))
    c.R(33, 26, 7, 17, J('vending_cool_white', 3)); c.R(40, 26, 7, 17, J('machiya_timber', 0))
    c.VL(33, 26, 17, J('vending_cool_white', 4)); c.VL(40, 26, 17, K('tekko', 3))
    for y in (31, 37): c.HL(33, y, 7, K('tekko', 1))
    for x in (x0 + 18, x1 - 18):
        fy = arch_y(x, 0)
        c.VL(x, round(fy), yb - round(fy), K('tekko', 1))
    add_outline(c)
    # 흙 둔덕(윗면 2px + 앞 2px)
    c.R(1, yb, 78, 4, J('aged_cedar', 1)); c.HL(1, yb, 78, J('aged_cedar', 3)); c.HL(1, yb + 1, 78, J('aged_cedar', 2))
    c.VL(0, yb, 4, OL); c.VL(79, yb, 4, OL); c.HL(0, yb + 4, 80, OL)


# ═══════════════════════════ 9. 함석 헛간 ═══════════════════════════
@kit('inaka-agri-tin-shed', '함석 농기구 헛간 - 녹슨 切妻 함석 지붕·골판 벽·열린 미닫이 안 볏가마(4×3)', 4, 3, 'building',
     solid=rows(4, [1, 2]), tags=['inaka', '헛간', '농기구창고', '納屋', 'トタン'],
     rules='농가 마당 옆이나 논 가장자리. 열린 문 앞 1칸은 비운다.', role='building', doors=[(1, 2, 1)])
def tin_shed(c, base):
    X0, X1 = 5, 58
    wall(c, X0, 19, X1 - X0 + 1, 24, 'tekko', 1, 'vboard')
    eave_shadow(c, X0, 19, X1 - X0 + 1, 'tekko', 1)
    for (rx, ry, rw) in ((48, 30, 4), (10, 36, 3), (52, 38, 5)):
        c.HL(rx, ry, rw, J('noren_rust', 2)); c.HL(rx + 1, ry + 1, rw - 1, J('noren_rust', 1))
    # 열린 미닫이: 어두운 안 + 볏가마 쌓기 + 괭이
    c.R(9, 23, 22, 20, K('tekko', -3)); c.R(9, 23, 22, 2, K('sumi', 1)); c.VL(8, 23, 20, OL)
    for (bx, by) in ((11, 36), (19, 36), (15, 30)):
        c.R(bx, by, 8, 6, J('tatami_straw', 3)); c.HL(bx, by, 8, J('tatami_straw', 4)); c.HL(bx, by + 5, 8, J('tatami_straw', 1))
        c.VL(bx + 2, by, 6, J('tatami_straw', 1)); c.VL(bx + 5, by, 6, J('tatami_straw', 1))
        c.VL(bx + 7, by, 6, J('tatami_straw', 2))
    line(c, 27, 25, 29, 41, J('aged_cedar', 3)); c.R(25, 24, 4, 2, K('tekko', 2))
    # 닫힌 문짝(사선 버팀)
    c.R(32, 23, 22, 20, K('tekko', 0))
    for x in range(32, 54, 4): c.VL(x, 23, 20, K('tekko', -1))
    line(c, 33, 41, 52, 24, K('tekko', 2)); c.HL(32, 23, 22, K('tekko', 2)); c.VL(31, 23, 20, OL)
    kawara_gable(c, 2, 61, 2, 15, 'tekko', 0)
    for (rx, ry) in ((12, 9), (13, 9), (14, 10), (40, 12), (41, 12), (50, 8), (30, 13)):
        c.P(rx, ry, J('noren_rust', 3)); c.P(rx, ry + 1, J('noren_rust', 1))
    foundation(c, X0, 43, X1 - X0 + 1)
    c.VL(X0 - 1, 43, 4, OL); c.VL(X1 + 1, 43, 4, OL)


# ═══════════════════════════ 10. 언덕 도리이 돌계단 ═══════════════════════════
def stone_lantern(c, x, y):
    """석등(높이 26): 받침 윗면 · 기둥 · 불집(창 불빛) · 갓 윗면 · 보주."""
    rect_3d(c, x, y + 20, 11, 6, 2, 'shrine_flagstone', top_t=3, front_t=2)
    c.R(x + 3, y + 12, 5, 8, J('shrine_flagstone', 2)); c.VL(x + 3, y + 12, 8, J('shrine_flagstone', 3)); c.VL(x + 2, y + 12, 8, OL); c.VL(x + 8, y + 12, 8, OL)
    rect_3d(c, x + 1, y + 6, 9, 7, 1, 'shrine_flagstone', top_t=3, front_t=2)
    c.R(x + 3, y + 8, 5, 3, J('lantern_amber', 3)); c.HL(x + 3, y + 8, 5, J('lantern_amber', 4))
    rect_3d(c, x - 1, y + 2, 13, 5, 3, 'shrine_flagstone', top_t=4, front_t=1)
    c.R(x + 4, y, 3, 2, J('shrine_flagstone', 3)); c.P(x + 4, y, J('shrine_flagstone', 4))
    c.HL(x + 4, y - 1, 3, OL); c.P(x + 3, y, OL); c.P(x + 7, y, OL)


@kit('inaka-hillside-torii-stairs', '언덕 신사 돌계단과 明神 도리이 - 디딤판 윗면·챌면·석등 한 쌍(4×5)', 4, 5, 'structure',
     solid=[(0, y) for y in range(5)] + [(3, y) for y in range(5)], other='floor',
     tags=['inaka', '도리이', '돌계단', '神社', 'stair'],
     rules='마을 뒷산 신사 입구. 위(북)쪽에 삼나무(jp-rg-sugi)·배전(jp-bldg-shrine-haiden)을 잇는다. 가운데 두 칸을 오른다.',
     role='building')
def torii_stairs(c, base):
    # 양옆 풀 둔덕(이끼 램프 클러스터) + 돌 테
    for (bx0, bx1) in ((1, 16), (48, 63)):
        for y in range(22, 79):
            for x in range(bx0, bx1):
                h = H(x // 2, y // 2, 31)
                c.P(x, y, J('moss', 3 if h < 0.35 else 2 if h < 0.85 else 4))
        for x in range(bx0 + 2, bx1 - 1, 5):
            c.P(x, 24 + (x * 7) % 40, J('pine_bamboo', 4)); c.P(x, 25 + (x * 7) % 40, J('pine_bamboo', 3))
    # 돌계단: 디딤판(윗면 3px 밝음) + 챌면(3px 어두움)
    for k, y in enumerate(range(30, 78, 6)):
        c.R(16, y, 32, 3, J('shrine_flagstone', 3)); c.HL(16, y, 32, J('shrine_flagstone', 4))
        c.R(16, y + 3, 32, 3, J('shrine_flagstone', 1)); c.HL(16, y + 5, 32, J('shrine_flagstone', 0))
        for sx in range(18 + (k % 2) * 5, 46, 10): c.VL(sx, y + 3, 3, J('shrine_flagstone', 0))
    c.R(16, 24, 32, 6, J('shrine_flagstone', 3)); c.HL(16, 24, 32, J('shrine_flagstone', 4))   # 맨 위 참배길
    for (ex, t) in ((14, 3), (48, 1)):                           # 옆 돌 테(축대 윗면)
        c.R(ex, 24, 2, 54, J('shrine_flagstone', t)); c.VL(ex - 1 if ex < 30 else ex + 2, 24, 54, OL)
    c.HL(13, 78, 38, OL)
    # 석등 한 쌍
    stone_lantern(c, 2, 46); stone_lantern(c, 51, 46)
    # 明神 도리이: 기둥 + 亀腹 + 貫 + 額束 + 島木 + 笠木(윗면 2px)
    for px in (12, 49):
        c.R(px - 1, 6, 5, 26, OL)
        c.R(px, 7, 3, 24, J('torii_vermilion', 2)); c.VL(px, 7, 24, J('torii_vermilion', 3)); c.VL(px + 2, 7, 24, J('torii_vermilion', 1))
        c.R(px - 1, 28, 5, 4, K('sumi', 1)); c.HL(px - 1, 28, 5, K('tekko', -1))
    c.R(8, 14, 48, 4, OL); c.R(9, 15, 46, 2, J('torii_vermilion', 3)); c.HL(9, 16, 46, J('torii_vermilion', 1))
    c.R(29, 9, 6, 6, OL); c.R(30, 10, 4, 4, K('sumi', 1)); c.R(31, 11, 2, 2, K('kii', 1))
    c.R(5, 6, 54, 4, OL); c.R(6, 7, 52, 2, J('torii_vermilion', 3)); c.HL(6, 8, 52, J('torii_vermilion', 1))
    c.R(2, 1, 60, 6, OL)
    c.R(3, 2, 58, 2, J('kawara_dark_tile', 4)); c.HL(3, 2, 58, J('kawara_dark_tile', 3))
    c.R(3, 4, 58, 2, J('kawara_dark_tile', 1))
    c.R(0, 0, 4, 3, OL); c.R(60, 0, 4, 3, OL); c.P(1, 1, J('kawara_dark_tile', 3)); c.P(62, 1, J('kawara_dark_tile', 2))   # 반전(反り) 끝
