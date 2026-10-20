"""jp_city 블록 `street_hand` — 손 도트 거리 소품·노면 표시(전봇대·전선·커브미러·소화전 표지·블록 담·대문·카포트·주차·생활 소품·신사·주유소 캐노피·학교 정문). 계약: ../CONTRACT.md
근거는 tiledata/jp-city/research/(README 의 「일본」 신호 우선순위와 치수). 화풍은 houses/ 의 건물과 같다(modern3, sumi 윤곽, 빛 왼쪽 위, 정면 고정 3/4).
통행: 소품마다 막힘 칸을 적는다(대개 맨 아래 줄의 기둥·몸통). 나머지 칸은 star(뒤로 지나감). 노면 표시·주차 잠금판은 flat(캐릭터 밑).
전선(jp-wire-*)은 4층(위 덧그림) 전용이다 — 3층에 찍으면 지붕·전봇대 팔 칸을 덮는다. stamp_layer_block 의 layers["4"] 로 키트 격자를 그대로 찍는다.
  python3 scripts/content/jp-city/blocks/street_hand.py         # selftest + tiledata/jp-city/blocks/street_hand/*.png
"""
import os, sys, hashlib, json, collections
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..')); sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '..', 'houses'))
import numpy as np                                        # noqa: E402
from PIL import Image                                     # noqa: E402
from lib_blocks_lines.core import check_cell, ROOT        # noqa: E402
import house_kit as HK                                    # noqa: E402
import shop_parts as SP                                   # noqa: E402
from house_kit import K, OL, Cv                           # noqa: E402

BLOCK = 'street_hand'
OUTDIR = os.path.join(ROOT, 'tiledata', 'jp-city', 'blocks', 'street_hand')
P = []          # (id, name, w, h, draw, solid cells, pc for other cells, tags, rules)


def prop(id_, name, w, h, solid=(), other='star', tags=(), rules=''):
    def deco(fn):
        P.append(dict(id=id_, name=name, w=w, h=h, draw=fn, solid=list(solid), other=other, tags=list(tags), rules=rules))
        return fn
    return deco


def shadow(c, x, y, w):
    """바닥 그림자 2줄(아스팔트·보도 위 어디서나 읽히게 yoru 낮은 단)."""
    c.HL(x, y, w, K('yoru', -2)); c.HL(x + 1, y + 1, w - 2, K('yoru', -1))


def top_face(c, x, y, w, rows, ramp, t=1, edge=True, grain=True):
    """3/4 윗면: rows 줄의 밝고 결 있는 면(왼쪽 위 빛). 뒷모서리는 OL(y-1), 앞 모서리는 어두운 줄(윗면 ↔ 앞면을 가르는 선),
    안쪽에 한 칸 들인 테두리 홈(윗판이 판으로 읽히게)."""
    c.R(x, y, w, rows, K(ramp, t + 1))
    if grain:
        for j in range(1, rows - 1, 2):
            for i in range(x + (j * 3) % 5, x + w, 7): c.HL(i, y + j, 3, K(ramp, t))
        for i in range(x + 1, x + w, 5): c.P(i, y + (i * 3) % max(1, rows - 1), K(ramp, t + 2))
    if rows >= 5 and w >= 6:
        c.HL(x + 1, y + 1, w - 2, K(ramp, t - 1)); c.VL(x + 1, y + 1, rows - 2, K(ramp, t - 1)); c.VL(x + w - 2, y + 1, rows - 2, K(ramp, t - 1))
        c.HL(x + 2, y + 2, w - 4, K(ramp, t + 3))
    if edge: c.HL(x, y + rows - 1, w, K(ramp, -3))
    c.HL(x, y - 1, w, OL); c.VL(x - 1, y - 1, rows + 1, OL); c.VL(x + w, y - 1, rows + 1, OL)


def slab(c, x, y, w, rows, ramp, t=2, taper=0.5, ribs=0, lip=True, rc=None):
    """3/4 윗면 판(원근 사다리꼴): 뒤쪽 줄이 앞쪽보다 좁다(taper 줄당 안쪽으로), 앞 모서리에 어두운 입술 1줄 + 밑 그림자. 밝은 결."""
    for j in range(rows):
        ins = int((rows - 1 - j) * taper)
        x0, ww = x + ins, w - 2 * ins
        c.HL(x0, y + j, ww, K(ramp, t + 1 if j < rows // 2 else t))
        if ww >= 4:
            c.P(x0 + 1, y + j, K(ramp, t + 3)) if j < rows - 1 else None
            for i in range(x0 + 2 + (j * 3) % 4, x0 + ww - 1, 6): c.P(i, y + j, K(ramp, t - 1))
        c.P(x0 - 1, y + j, OL); c.P(x0 + ww, y + j, OL)
    if ribs:
        for k in range(1, ribs):
            fx = k / ribs
            for j in range(rows):
                ins = int((rows - 1 - j) * taper)
                ww = w - 2 * ins
                c.P(x + ins + int(ww * fx), y + j, K(ramp, t - 2 if rc is None else rc))
    c.HL(x + int((rows - 1) * taper), y - 1, w - 2 * int((rows - 1) * taper), OL)
    if lip:
        c.HL(x, y + rows - 1, w, K(ramp, t - 2)); c.HL(x, y + rows, w, OL)


def disc_top(c, cx, cy, rx, ry, ramp, t=2):
    """원판·원통 위의 타원 윗면(밝은 면 + OL 테두리)."""
    for j in range(-ry - 1, ry + 2):
        for i in range(-rx - 1, rx + 2):
            d = (i * i) / ((rx + 0.5) ** 2) + (j * j) / ((ry + 0.5) ** 2)
            if d <= 1.0: c.P(cx + i, cy + j, K(ramp, t + 1) if j < 0 else K(ramp, t))
            elif d <= 1.45: c.P(cx + i, cy + j, OL)


def box_top(c, x, y, w, rows, ramp, t=3, ends=(False, False)):
    """3/4 직사각 윗면(테이퍼 없음 — 가로로 이어도 이음이 안 보이고, 정면 아치로 오독되지 않는다): 뒤 모서리 OL, 뒤쪽 두 줄 그늘(먼 쪽),
    밝은 결 있는 판, 앞 모서리 밝은 입술 + 바로 밑 어두운 앞면 시작선. ends=(왼, 오른) 이면 그 쪽 세로 윤곽을 닫는다."""
    c.HL(x, y - 1, w, OL)
    for j in range(rows):
        col = K(ramp, t - 2) if j == 0 else K(ramp, t - 1) if j == 1 else K(ramp, t + 2) if j == rows - 1 else K(ramp, t + 1) if j == rows - 2 else K(ramp, t)
        c.HL(x, y + j, w, col)
    for j in range(2, rows - 2):
        for i in range(x + (j * 3) % 5, x + w, 6): c.HL(i, y + j, 2, K(ramp, t - 1))
        for i in range(x + 1 + (j * 2) % 4, x + w, 7): c.P(i, y + j, K(ramp, t + 2))
    if rows >= 6:
        for j in (2, rows - 3): c.HL(x, y + j, w, K(ramp, t - 2))                                     # 윗면 가로 홈(앞뒤로 누운 판 — 세로 줄눈은 정면 기둥으로 읽힌다)
    if ends[0]: c.VL(x - 1, y - 1, rows + 1, OL)
    if ends[1]: c.VL(x + w, y - 1, rows + 1, OL)


# ─────────────────────────── 전봇대·전선 (조사 02: 지상 약 10m, 위→아래 고압·저압·변압기·통신선, 노랑 검정 표지판) ───────────────────────────
# 2026-10-20 다시 그림(시골 R5·버들항 기준): 기둥 머리 크림 「갓」·밑동 크림 덩이·순흑 굵은 전선을 걷어냈다.
#   기둥 = 가는 원기둥(콘크리트 회색 / 나무 짙은 삼나무 결) — 윗면은 원래 거의 안 보이므로 머리 윗면은 2px 타원뿐.
#   3/4 는 완목(철 각재: 밝은 윗면 1px + 앞면 1px)·애자(사기 윗면)·변압기 뚜껑 타원·클로저 윗면으로 읽힌다.
#   전선 = 1px 짙은 회색(계약 kawara_dark_tile 0~2단, 순흑 아님) — 고압 2가닥·저압 2가닥·통신선(1px+그늘 1px), 가닥 사이 1px 이상 띄움.
ARM1, ARM2, CABLE = 9, 21, 37          # 전봇대 키트 맨 위에서 고압 완목·저압 완목·통신선 높이(px). 전선 키트가 이 높이에 맞춘다.
HV_Y = (ARM1 - 4, ARM1 - 2)            # 고압 두 가닥: 애자 윗머리 위 · 애자 목(옆으로 묶임)
LV_Y = (ARM2 - 4, ARM2 - 2)            # 저압 두 가닥
HV_INS = (1, 8, 38, 45)                # 고압 완목 위 애자 x(2px 폭) — 양 끝 애자는 키트 경계에 닿아 전선 키트 끝과 만난다
LV_INS = (3, 10, 36, 43)
CABLE_X = 27                           # 세로 통신선(남북 전선 키트)이 내려가는 x — 기둥 오른쪽 클램프

_CONTRACT = json.load(open(os.path.join(ROOT, 'tiledata', 'jp-city', 'palette-contract.json'), encoding='utf-8'))
_RAMP = {m['id']: [int(h[1:], 16) for h in m['steps']] for f in _CONTRACT['families'] for m in f['materials']}


def J(mat, s):
    """계약 재료 mat 의 단 s(0 깊은 그늘 … 4 하이라이트)."""
    r = _RAMP[mat]
    return r[max(0, min(4, s))]


W_HV, W_LV = J('kawara_dark_tile', 2), J('kawara_dark_tile', 1)          # 고압(피복 회색, 조금 밝다) · 저압
W_CB, W_CB_S = J('kawara_dark_tile', 0), J('kawara_dark_tile', 1)        # 통신선(짙다) + 그늘 1px
STEEL_OL = J('kawara_dark_tile', 0)


def _seg(c, x0, y0, x1, y1, col):
    n = max(abs(x1 - x0), abs(y1 - y0), 1)
    for i in range(n + 1):
        c.P(int(round(x0 + (x1 - x0) * i / n)), int(round(y0 + (y1 - y0) * i / n)), col)


def pole_body(c, x, top, bot, mat='conc'):
    """가는 원기둥: 위 3px → 아래 4px, 왼쪽 빛·오른쪽 그늘, 재질 톤 윤곽. 머리 윗면은 2px 낮은 타원(콘크리트) 또는 작은 함석 모자(나무).
    콘크리트는 발판 볼트·노랑 검정 표지·밑동 깃, 나무는 세로 결·옹이·흙 얼룩. 바닥 그림자는 오른쪽 아래로 짧게."""
    wood = mat != 'conc'
    ol = K('ita', -3) if wood else STEEL_OL
    lit, mid, dk = (K('ita', 0), K('ita', -1), K('ita', -2)) if wood else (K('conc', 1), K('conc', 0), K('conc', -2))
    split = top + (bot - top) * 2 // 3 if wood else top + (bot - top) // 2
    for y in range(top, bot):
        w = 4 if y >= split else 3
        x0 = x - 1 - (w - 3)
        cols = [lit, mid, dk] if w == 3 else [lit, mid, mid, dk]
        for i, col in enumerate(cols): c.P(x0 + i, y, col)
        c.P(x0 - 1, y, ol); c.P(x0 + w, y, ol)
    if wood:
        for k, y in enumerate(range(top + 4, bot - 4, 11)):                          # 세로 결(짙은 줄 · 빛 쪽 밝은 결)
            xx = x - (1 if y >= split else 0) + (k % 2)
            c.VL(xx, y, 4 + k % 3, K('ita', -2))
        for y in range(top + 9, bot - 6, 17): c.VL(x - 1 - (1 if y >= split else 0), y, 3, K('ita', 1))
        for y in (top + 47, top + 101): c.P(x, y, K('ita', -3)); c.P(x + 1, y, K('ita', -2))   # 옹이
        c.HL(x - 2, bot - 3, 4, K('ita', -3)); c.HL(x - 2, bot - 2, 4, K('ita', -2)); c.HL(x - 2, bot - 1, 4, K('ita', -3))   # 밑동 흙 얼룩
        c.HL(x - 3, top - 4, 7, ol)                                                   # 함석 모자(5px, 윗면 1 + 테 1)
        c.P(x - 3, top - 3, ol); c.HL(x - 2, top - 3, 5, K('tekko', 1)); c.P(x - 2, top - 3, K('tekko', 2)); c.P(x + 3, top - 3, ol)
        c.P(x - 3, top - 2, ol); c.HL(x - 2, top - 2, 5, K('tekko', -1)); c.P(x + 3, top - 2, ol)
        c.HL(x - 2, top - 1, 5, ol)
    else:
        for y in range(top + 24, bot - 20, 32): c.P(x, y, K('conc', -1)); c.P(x + 1, y, K('conc', -1))   # 거푸집 이음
        for y in range(top + 13, bot - 30, 19): c.P(x, y, K('conc', -1))                                  # 잔 얼룩
        for k, y in enumerate(range(top + 34, bot - 22, 10)):                                             # 발판 볼트(좌우 번갈아)
            xx = (x - 3 - (y >= split)) if k % 2 == 0 else x + 3
            c.P(xx, y, K('tekko', 1)); c.P(xx, y + 1, STEEL_OL)
        for y in range(bot - 15, bot - 6):                                                                 # 노랑 검정 표지
            for i in range(-2, 2):
                c.P(x + i, y, J('lantern_amber', 3) if ((y + i) // 2) % 2 else J('kawara_dark_tile', 0))
        c.HL(x - 3, bot - 4, 7, ol)                                                                         # 밑동 깃(한 줄 윗면 + 앞면)
        c.P(x - 3, bot - 3, ol); c.HL(x - 2, bot - 3, 5, K('conc', 0)); c.P(x - 2, bot - 3, K('conc', 1)); c.P(x + 3, bot - 3, ol)
        c.P(x - 3, bot - 2, ol); c.HL(x - 2, bot - 2, 5, K('conc', -2)); c.P(x + 3, bot - 2, ol)
        c.P(x - 3, bot - 1, ol); c.HL(x - 2, bot - 1, 5, K('conc', -3)); c.P(x + 3, bot - 1, ol)
        c.HL(x - 1, top - 3, 3, ol)                                                                         # 머리 윗면(3×2 타원)
        c.P(x - 2, top - 2, ol); c.P(x - 1, top - 2, K('conc', 3)); c.P(x, top - 2, K('conc', 3)); c.P(x + 1, top - 2, K('conc', 2)); c.P(x + 2, top - 2, ol)
        c.P(x - 2, top - 1, ol); c.P(x - 1, top - 1, K('conc', 2)); c.P(x, top - 1, K('conc', 1)); c.P(x + 1, top - 1, K('conc', 0)); c.P(x + 2, top - 1, ol)
    c.HL(x + 2, bot, 5, K('yoru', -1)); c.HL(x + 3, bot + 1, 3, K('yoru', -1))                             # 바닥 그림자(오른쪽 아래)


def crossarm(c, x0, x1, y, ins, cx=24, braces=True):
    """완목(철 각재): 밝은 윗면 1px(결 반짝) + 앞면 1px, 재질 윤곽. ins 의 x 마다 사기 애자(2px, 윗면 밝게 + 목 + 핀).
    애자 윗머리 바로 위(y-4)에 첫 가닥이 얹히고, 둘째 가닥(y-2)은 애자 목에 옆으로 묶인다. 기둥과 만나는 곳에 띠쇠, 아래로 가는 버팀쇠."""
    c.HL(x0, y - 1, x1 - x0, STEEL_OL)
    c.HL(x0, y, x1 - x0, K('tekko', 1))
    for i in range(x0 + 2, x1 - 1, 9): c.P(i, y, K('tekko', 2))
    c.HL(x0, y + 1, x1 - x0, K('tekko', -1))
    for i in range(x0 + 5, x1 - 1, 9): c.P(i, y + 1, K('tekko', -2))
    c.HL(x0, y + 2, x1 - x0, STEEL_OL)
    c.VL(x0 - 1, y - 1, 4, STEEL_OL) if x0 > 0 else None
    c.VL(x1, y - 1, 4, STEEL_OL) if x1 < 48 else None
    c.HL(cx - 2, y + 3, 5, K('tekko', -2))                                                 # 띠쇠
    if braces:
        _seg(c, cx - 11, y + 3, cx - 3, y + 8, K("tekko", -2)); _seg(c, cx + 11, y + 3, cx + 3, y + 8, K('tekko', -2))
    for ix in ins:
        c.P(ix, y - 3, K('shiro', 2)); c.P(ix + 1, y - 3, K('shiro', 1))                  # 애자 윗면
        c.P(ix, y - 2, K('shiro', 0)); c.P(ix + 1, y - 2, K('shiro', -1))                 # 몸(오른쪽 그늘)
        c.P(ix, y - 1, K('tekko', 0)); c.P(ix + 1, y - 1, STEEL_OL)                       # 핀


def _wires_through(c, W=48):
    """전봇대 키트 안을 지나는 전선(완목 위·기둥 뒤). 전선 키트 끝과 같은 높이로 키트 경계에서 이어진다."""
    for yo in HV_Y: c.HL(0, yo, W, W_HV)
    for yo in LV_Y: c.HL(0, yo, W, W_LV)
    c.HL(0, CABLE, W, W_CB); c.HL(0, CABLE + 1, W, W_CB_S)


def transformer(c, x, y):
    """주상 변압기 원통(폭 6): 뚜껑 타원 윗면 2줄 + 테 + 몸통(왼쪽 빛) + 둥근 밑. 기둥 쪽 걸쇠 2줄."""
    ol = STEEL_OL
    c.HL(x + 1, y, 4, ol)
    c.P(x, y + 1, ol); c.HL(x + 1, y + 1, 4, K('conc', 3)); c.P(x + 4, y + 1, K('conc', 2)); c.P(x + 5, y + 1, ol)
    c.P(x - 1, y + 2, ol); c.HL(x, y + 2, 6, K('conc', 2)); c.P(x, y + 2, K('conc', 3)); c.P(x + 5, y + 2, K('conc', 1)); c.P(x + 6, y + 2, ol)
    c.P(x - 1, y + 3, ol); c.HL(x, y + 3, 6, K('conc', -2)); c.P(x + 6, y + 3, ol)                       # 뚜껑 테(앞)
    for j in range(y + 4, y + 11):
        c.P(x - 1, j, ol); c.P(x + 6, j, ol)
        for i, t in enumerate((1, 1, 0, 0, -1, -2)): c.P(x + i, j, K('conc', t))
    c.HL(x, y + 7, 6, K('conc', -1)); c.P(x, y + 7, K('conc', 0))                                         # 몸통 띠
    c.P(x - 1, y + 11, ol); c.HL(x, y + 11, 6, K('conc', -2)); c.P(x + 6, y + 11, ol)
    c.HL(x, y + 12, 6, ol)
    c.HL(x - 3, y + 5, 2, K('tekko', -2)); c.HL(x - 3, y + 9, 2, K('tekko', -2))                          # 걸쇠
    c.P(x + 1, y - 1, K('shiro', 2)); c.P(x + 1, y, K('shiro', 0)); c.P(x + 4, y - 1, K('shiro', 2)); c.P(x + 4, y, K('shiro', 0))   # 부싱(사기)


def closure(c, x, y, w=6):
    """통신선 접속함(クロージャ): 통신선에 매달린 작은 원통 — 윗면 1줄 밝게."""
    c.HL(x, y - 1, w, STEEL_OL)
    c.P(x - 1, y, STEEL_OL); c.HL(x, y, w, K('tekko', 1)); c.P(x, y, K('tekko', 2)); c.P(x + w, y, STEEL_OL)
    c.P(x - 1, y + 1, STEEL_OL); c.HL(x, y + 1, w, K('tekko', -1)); c.P(x + w, y + 1, STEEL_OL)
    c.P(x - 1, y + 2, STEEL_OL); c.HL(x, y + 2, w, K('tekko', -2)); c.P(x + w, y + 2, STEEL_OL)
    c.HL(x, y + 3, w, STEEL_OL)


@prop('pole', '전봇대(콘크리트·변압기)', 3, 10, solid=[(1, 9)], tags=['전봇대', '전선', '가로 시설'],
      rules='생활도로 길가(보도 없는 길은 길 칸 안쪽 가장자리)에 25~35칸마다 하나. 완목이 키트 폭 전체(3칸)라 전선 키트가 양옆 칸 경계에서 이어진다.')
def _pole(c):
    _wires_through(c)
    pole_body(c, 24, 6, 157)
    crossarm(c, 1, 47, ARM1, HV_INS); crossarm(c, 3, 45, ARM2, LV_INS)
    c.R(27, CABLE - 1, 2, 4, K('tekko', -1)); c.P(27, CABLE - 1, K('tekko', 1)); c.HL(27, CABLE + 3, 2, STEEL_OL)   # 통신선 클램프
    transformer(c, 31, ARM2 + 4)
    closure(c, 36, CABLE - 1)
    c.HL(22, 50, 5, K('tekko', -2)); c.VL(22, 51, 6, K('tekko', -2)); c.VL(26, 51, 6, K('tekko', -2)); c.HL(22, 57, 5, K('tekko', -3))   # 번호판
    c.R(23, 51, 3, 6, K('shiro', 1)); c.VL(25, 51, 6, K('shiro', 0)); c.HL(23, 52, 3, K('kon', 0)); c.HL(23, 54, 3, J('kawara_dark_tile', 2)); c.HL(23, 55, 2, J('kawara_dark_tile', 2))


@prop('pole-guy', '전봇대(지선·노랑 지선 커버)', 4, 10, solid=[(1, 9), (3, 9)], tags=['전봇대', '지선', '가로 시설'],
      rules='길 끝·모퉁이 전봇대. 지선은 오른쪽 아래로 내려가 땅에 박힌다 — 지선 발(오른쪽 맨 아래 칸)도 막힘.')
def _pole_guy(c):
    _pole(c)
    for i in range(0, 34):                                                                                        # 지선
        c.P(26 + i, 12 + int(i * 4.35), K('sumi', 1))
    for y in range(134, 158):                                                                                     # 노랑 지선 커버
        x = 26 + int((y - 12) / 4.35)
        c.R(x - 2, y, 4, 1, K('kii', 1) if (y // 3) % 2 else K('kii', -1))
        c.P(x - 3, y, OL); c.P(x + 2, y, OL)
    c.R(54, 157, 6, 2, K('conc', -1))


@prop('pole-wood', '나무 전봇대(옛 동네)', 3, 9, solid=[(1, 8)], tags=['전봇대', '옛 동네', '가로 시설'],
      rules='골목·下町 쪽. 콘크리트 전봇대와 섞어 둬도 된다.')
def _pole_wood(c):
    _wires_through(c)
    pole_body(c, 24, 6, 141, 'ita')
    crossarm(c, 1, 47, ARM1, HV_INS); crossarm(c, 3, 45, ARM2, LV_INS)               # 고압 완목도 ARM1 — 전선 키트 고압 가닥이 애자 위에 닿는다
    c.R(27, CABLE - 1, 2, 4, K('tekko', -1)); c.P(27, CABLE - 1, K('tekko', 1)); c.HL(27, CABLE + 3, 2, STEEL_OL)   # 통신선 클램프
    ol = J('kawara_dark_tile', 0)                                                   # 옛 법랑 간판(작게)
    c.HL(21, 60, 7, ol); c.HL(21, 71, 7, ol); c.VL(20, 61, 10, ol); c.VL(28, 61, 10, ol)
    c.R(21, 61, 7, 10, K('kinari', 1)); c.VL(21, 61, 10, K('kinari', 2)); c.VL(27, 61, 10, K('kinari', 0))
    c.R(21, 61, 7, 3, K('kawara', 0)); c.HL(21, 61, 7, K('kawara', 1))
    c.HL(22, 65, 5, J('kawara_dark_tile', 1)); c.HL(22, 67, 4, J('kawara_dark_tile', 1)); c.HL(22, 69, 3, J('kawara_dark_tile', 2))
    c.P(27, 70, K('soil', 0)); c.P(26, 70, K('soil', 1))                 # 녹


WIRE_BOTTOM = 46        # 키트 높이 3칸(48px) 안 — 처짐이 이보다 내려가면 잘려 끊긴 조각이 된다(2026-10-07 학교 관문 지적)


def wire(c, x0, x1, y0, y1, sag, col):
    """두 점 사이 처진 1px 전선. 처짐은 키트 바닥(WIRE_BOTTOM)을 넘지 않게 줄이고, 이웃 화소 사이 세로 틈은 메워 끊기지 않게 한다."""
    n = max(1, x1 - x0)
    sag = max(0.0, min(sag, WIRE_BOTTOM - max(y0, y1)))
    prev = None
    for i in range(n + 1):
        t = i / n
        y = int(round(y0 + (y1 - y0) * t + sag * 4 * t * (1 - t)))
        if prev is not None and abs(y - prev) > 1:
            step = 1 if y > prev else -1
            for yy in range(prev + step, y, step): c.P(x0 + i - 1 if step > 0 and t <= 0.5 else x0 + i, yy, col)
        c.P(x0 + i, y, col)
        prev = y


WIRE_SPANS = tuple(range(5, 21))
for _L in WIRE_SPANS:
    def _mk(L):
        @prop(f'wire-{L}', f'전선(가로, 전봇대 사이 {L}칸)', L - 3, 3, tags=['전선', '4층'],
              rules=f'전봇대 키트(폭 3) 두 개를 같은 y 에 키트 x 가 {L}칸 차이 나게 세운 뒤, 왼쪽 전봇대 키트 x + 3, 전봇대 키트와 같은 y(맨 위 줄)에 **4층**으로 찍는다(stamp_layer_block layers["4"]). 완목 끝(전봇대 키트 양옆 칸)과 칸 경계에서 이어진다. 전봇대도 건물 앞에 서면 4층에 둔다. 3층에 찍으면 지붕을 덮는다.')
        def _w(c):
            W = (L - 3) * 16
            s = L * 0.7
            for yo in HV_Y: wire(c, 0, W - 1, yo, yo, s * 0.6, W_HV)                 # 고압 2가닥(같은 처짐 — 나란히, 1px 띄움)
            for yo in LV_Y: wire(c, 0, W - 1, yo, yo, s * 0.8, W_LV)                 # 저압 2가닥
            cs = min(s * 1.2, WIRE_BOTTOM - (CABLE + 1))                              # 통신선(1px + 그늘 1px, 같은 처짐)
            wire(c, 0, W - 1, CABLE + 1, CABLE + 1, cs, W_CB_S); wire(c, 0, W - 1, CABLE, CABLE, cs, W_CB)
        return _w
    _mk(_L)


for _L in (6, 8, 10):
    def _mkv(L):
        @prop(f'wire-v{L}', f'전선(세로, 남북 {L}칸)', 3, L, tags=['전선', '4층'],
              rules=f'같은 x 에 {L}칸 떨어진 두 전봇대(위쪽 전봇대 y = Y) 사이: 위쪽 전봇대와 같은 x, y = Y 에 **4층**으로 찍는다. 아래쪽 전봇대 팔에서 끝난다.')
        def _w(c):
            H = L * 16
            for xo in (HV_INS[0], HV_INS[-1] + 1): c.VL(xo, ARM1 - 3, H, W_HV)        # 고압: 양 끝 애자에서 내려간다
            for xo in (LV_INS[0], LV_INS[-1] + 1): c.VL(xo, ARM2 - 3, H, W_LV)        # 저압
            c.VL(CABLE_X, CABLE + 3, H - 3, W_CB); c.VL(CABLE_X + 1, CABLE + 3, H - 3, W_CB_S)   # 통신선(클램프 밑에서)
        return _w
    _mkv(_L)


# ─────────────────────────── 길가 표지 ───────────────────────────
@prop('mirror2', '커브미러(주황, 둘)', 2, 3, solid=[(0, 2)], tags=['커브미러', '교차로', '가로 시설'],
      rules='보이지 않는 모퉁이(T자·十자 생활도로) 길가. 지주와 테두리는 주황이 표준(조사 02).')
def _mirror(c):
    o = 'daidai'
    c.R(7, 17, 3, 31, K(o, 0)); c.VL(7, 17, 31, K(o, 2)); c.VL(9, 17, 31, K(o, -2)); c.VL(6, 17, 31, OL); c.VL(10, 17, 31, OL)
    top_face(c, 4, 15, 22, 3, o, 0)                                                # 가로 지지대 윗면
    c.HL(4, 18, 22, K(o, -2)); c.HL(4, 19, 22, OL)
    for cx, cy in ((7, 10), (22, 11)):
        for j in range(-7, 8):
            for i in range(-7, 8):
                d = i * i + j * j
                if d <= 49: c.P(cx + i, cy + j, OL if d > 36 else K(o, 1) if d > 25 else K('garasu', 1) if (i + j) < 0 else K('garasu', -1))
        c.P(cx - 2, cy - 2, K('garasu', 3)); c.P(cx - 1, cy - 3, K('garasu', 3))
        disc_top(c, cx, cy - 7, 6, 3, o, 2)                                        # 거울 테두리 윗면(두께)
    c.R(3, 43, 10, 4, K('conc', 0)); top_face(c, 3, 40, 10, 3, 'conc', 1); shadow(c, 2, 46, 12)


@prop('hydrant-sign', '소화전 표지(빨강 원판)', 1, 3, solid=[(0, 2)], tags=['소화전', '가로 시설'],
      rules='길가 전봇대·담 곁. 빨간 기둥 위 빨간 원판.')
def _hydrant(c):
    """소화전 표지: 두께 있는 빨간 원판(위에서 보이는 타원 윗면 7줄) + 기둥 + 받침."""
    c.R(7, 22, 2, 20, K('aka', -1)); c.VL(7, 22, 20, K('aka', 1)); c.VL(6, 22, 20, OL); c.VL(9, 22, 20, OL)
    for j in range(-6, 7):
        for i in range(-6, 7):
            d = i * i + j * j
            if d <= 36: c.P(8 + i, 15 + j, OL if d > 25 else K('aka', -1) if d > 9 else K('shiro', 1))
    c.HL(6, 15, 5, K('aka', -2))
    disc_top(c, 8, 8, 6, 3, 'aka', 2)                                              # 원판 윗면(밝은 타원)
    c.R(3, 42, 10, 5, K('conc', -1)); top_face(c, 3, 38, 10, 5, 'conc', 2); c.HL(2, 47, 12, OL); shadow(c, 3, 47, 10)


@prop('bus-stop', 'バス停 버스 정류장 표지', 1, 3, solid=[(0, 2)], tags=['버스', '정류장', '가로 시설'],
      rules='간선·역 앞 보도 가장자리. 둥근 표지판 + 시간표 판 + 무거운 받침.')
def _bus(c):
    """버스 정류장: 굵은 원통 표지 기둥(위에서 본 큰 타원 윗면 + 곡면 몸통 + 둥근 아랫단) — 파랑 머리띠, 흰 시간표 면, 받침."""
    cx, rx = 8, 6
    top = 7
    for y in range(top, 41):
        for i in range(-rx, rx):
            sh = 4 if i < -3 else 3 if i < -1 else 2 if i < 2 else 0 if i < 4 else -2
            if y < 17: col = K('kon', sh - 2)
            elif y < 21: col = K('shiro', min(sh, 3))
            else: col = K('shiro', min(sh, 3) - 1) if 22 < y < 36 else K('tekko', sh - 3)
            c.P(cx + i, y, col)
        c.P(cx - rx - 1, y, OL); c.P(cx + rx, y, OL)
    for j in (25, 28, 31): c.HL(cx - 4, j, 7, K('sumi', 2))
    c.HL(cx - 4, 33, 7, K('aka', 0))
    for i in range(-rx - 1, rx + 1): c.P(cx + i, 41 - (0 if abs(i + 0.5) < 3 else 1 if abs(i + 0.5) < 5 else 2) + 0, OL)
    disc_top(c, cx, 5, 7, 4, 'kon', 3)
    for i in (-4, -1, 2): c.P(cx + i, 4, K('kon', 5))
    c.R(2, 42, 12, 4, K('conc', -1)); top_face(c, 2, 38 + 0 * 0, 0, 0, 'conc', 2) if False else None
    c.HL(2, 42, 12, K('conc', 2)); c.HL(1, 46, 14, OL); c.VL(1, 42, 4, OL); c.VL(14, 42, 4, OL); shadow(c, 1, 46, 14)


# ─────────────────────────── 노면 표시(flat, 캐릭터 밑) ───────────────────────────
def _draw30(c, x0=0, y0=0):
    """세로로 긴 「30」(남북 길용 원형). 3 은 오른쪽 세로획 + 짧은 가운데 획 + 모서리를 깎아 「ヨ」 와 구별한다."""
    o = K('daidai', 1); d = K('daidai', 0)
    def seg(x, y, w, h): c.R(x0 + x, y0 + y, w, h, o); c.HL(x0 + x, y0 + y + h - 1, w, d)
    x = 3
    seg(x, 4, 10, 3); seg(x + 9, 6, 3, 24); seg(x + 4, 29, 7, 3); seg(x + 9, 31, 3, 23); seg(x, 55, 10, 3)
    seg(x, 7, 3, 4); seg(x, 50, 3, 5)                                                            # 3 의 위·아래 갈고리(왼쪽 끝이 안쪽으로)
    for (px, py) in ((x + 10, 5), (x + 11, 6), (x + 10, 56), (x + 11, 55)): c.P(x0 + px, y0 + py, o)   # 둥근 오른쪽 모서리
    x = 18
    seg(x + 1, 4, 10, 3); seg(x, 6, 3, 50); seg(x + 9, 6, 3, 50); seg(x + 1, 55, 10, 3)


@prop('mark-30', '노면 「30」 주황(세로로 긴 규제 표시 · 남북 길)', 2, 4, other='flat', tags=['노면', '속도', '생활도로'],
      rules='남북 생활도로 차선 한가운데. 남→북으로 달리는 차가 읽는 방향(글자 아래가 남쪽). 가로 1.2m × 세로 5m 라 아주 길쭉하다. 동서 길은 jp-mark-30-e·jp-mark-30-w.')
def _m30(c):
    _draw30(c)


@prop('mark-30-e', '노면 「30」 주황 + 側溝·흰 선(동서 길 · 동쪽행 차선, 글자 위가 동쪽)', 4, 2, other='flat', tags=['노면', '속도', '생활도로'],
      rules='폭 4칸 동서 생활도로의 위 두 줄(동쪽행 차선, 좌측통행)에 둔다 — 윗줄에 側溝 뚜껑·흰 선(jp-mark-edge-n 과 같은 그림)이 들어 있어 가장자리 줄을 끊지 않는다. 글자는 흰 선과 길 가운데 사이 차선 안, 동쪽으로 달리는 운전자가 읽는다(글자 위 = 동쪽). 서쪽행 차선은 jp-mark-30-w(아래 두 줄).')
def _m30e(c):
    _m30_lane(c, -1, 'n')


@prop('mark-30-w', '노면 「30」 주황 + 側溝·흰 선(동서 길 · 서쪽행 차선, 글자 위가 서쪽)', 4, 2, other='flat', tags=['노면', '속도', '생활도로'],
      rules='폭 4칸 동서 생활도로의 아래 두 줄(서쪽행 차선, 좌측통행)에 둔다 — 아랫줄에 흰 선·側溝 뚜껑(jp-mark-edge-s 와 같은 그림)이 들어 있다. 글자는 길 가운데와 흰 선 사이 차선 안, 서쪽으로 달리는 운전자가 읽는다(글자 위 = 서쪽). 동쪽행 차선은 jp-mark-30-e(위 두 줄).')
def _m30w(c):
    _m30_lane(c, 1, 's')


def _draw30n(c, x0=0, y0=0):
    """차선 안에 들어가는 좁은 「30」(폭 15px · 길이 54px). 동서 길 차선은 흰 선을 빼면 18px 뿐이라 원형(26px)이 넘친다."""
    o = K('daidai', 1); d = K('daidai', 0)
    def seg(x, y, w, h): c.R(x0 + x, y0 + y, w, h, o); c.HL(x0 + x, y0 + y + h - 1, w, d)
    x = 0
    seg(x, 4, 6, 3); seg(x + 4, 6, 2, 24); seg(x + 1, 29, 4, 3); seg(x + 4, 31, 2, 23); seg(x, 55, 6, 3)
    seg(x, 7, 2, 3); seg(x, 51, 2, 4)                                                           # 3 의 위·아래 갈고리
    x = 9
    seg(x + 1, 4, 4, 3); seg(x, 6, 2, 50); seg(x + 4, 6, 2, 50); seg(x + 1, 55, 4, 3)


def _m30_lane(c, k, side):
    """좁은 「30」 을 돌려 차선 띠에 놓고, 길 가장자리 줄(側溝·흰 선)을 같은 키트에 그린다."""
    t = Cv(32, 64); _draw30n(t, x0=8)
    r = np.rot90(t.a, k)
    rows = np.where(r[..., 3].any(axis=1))[0]
    g = r[rows[0]:rows[-1] + 1]
    top = 15 if side == 'n' else 1                                                              # n: 흰 선(12~13) 아래 · s: 흰 선(18~19) 위
    band = c.a[top:top + g.shape[0], :64]
    m = g[..., 3] > 0
    band[m] = g[m]
    for i in range(4):
        if side == 'n': _gutter(c, 16 * i, 0, 16, 6)
        else: _gutter(c, 16 * i, 26, 16, 6)
    if side == 'n': _line(c, 0, 12, 64, 2)
    else: _line(c, 0, 18, 64, 2)


def _gutter(c, x, y, w, h, grate=False):
    """側溝 뚜껑 띠(콘크리트, 60cm 마디) 또는 グレーチング(철 격자)."""
    c.R(x, y, w, h, K('conc', 1))
    if w > h:
        c.HL(x, y, w, K('conc', 3)); c.HL(x, y + h - 1, w, K('conc', -2))
        if grate:
            c.R(x + 1, y + 1, w - 2, h - 2, K('tekko', -2))
            for i in range(x + 2, x + w - 1, 2): c.VL(i, y + 1, h - 2, K('tekko', 2))
        else: c.VL(x + 9, y + 1, h - 2, K('conc', -2)); c.VL(x + 10, y + 1, h - 2, K('conc', 2))
    else:
        c.VL(x, y, h, K('conc', 3)); c.VL(x + w - 1, y, h, K('conc', -2))
        if grate:
            c.R(x + 1, y + 1, w - 2, h - 2, K('tekko', -2))
            for j in range(y + 2, y + h - 1, 2): c.HL(x + 1, j, w - 2, K('tekko', 2))
        else: c.HL(x + 1, y + 9, w - 2, K('conc', -2)); c.HL(x + 1, y + 10, w - 2, K('conc', 2))


def _line(c, x, y, w, h):
    c.R(x, y, w, h, K('shiro', 2))


EDGES = {   # 칸 안 위치: n = 동서 길의 맨 위 줄(뚜껑 위 · 흰 선 아래), s = 맨 아래 줄, w = 남북 길의 맨 왼쪽 열, e = 맨 오른쪽 열
    'edge-n': lambda c, g: (_gutter(c, 0, 0, 16, 6, g), _line(c, 0, 12, 16, 2)),
    'edge-s': lambda c, g: (_line(c, 0, 2, 16, 2), _gutter(c, 0, 10, 16, 6, g)),
    'edge-w': lambda c, g: (_gutter(c, 0, 0, 6, 16, g), _line(c, 11, 0, 2, 16)),
    'edge-e': lambda c, g: (_line(c, 3, 0, 2, 16), _gutter(c, 10, 0, 6, 16, g)),
    'line-n': lambda c, g: _line(c, 0, 12, 16, 2), 'line-s': lambda c, g: _line(c, 0, 2, 16, 2),
    'line-w': lambda c, g: _line(c, 11, 0, 2, 16), 'line-e': lambda c, g: _line(c, 3, 0, 2, 16),
}
EDGE_KO = {'n': '동서 길 맨 위 줄', 's': '동서 길 맨 아래 줄', 'w': '남북 길 맨 왼쪽 열', 'e': '남북 길 맨 오른쪽 열'}
for _k, _f in EDGES.items():
    side = _k[-1]
    for _g in ((False, True) if _k.startswith('edge') else (False,)):
        def _mke(f, g):
            return lambda c: f(c, g)
        nm = ('側溝 グレーチング + 路側帯 흰 선' if _g else '側溝 뚜껑 + 路側帯 흰 선') if _k.startswith('edge') else '路側帯 흰 선'
        prop('mark-' + _k + ('-grate' if _g else ''), '%s (%s)' % (nm, EDGE_KO[side]), 1, 1, other='flat', tags=['노면', '길 가장자리', '생활도로'],
             rules='보도 없는 생활도로의 %s 칸에 길 따라 잇는다(투명 덧그림, 3층). 뚜껑 띠는 길 바깥쪽, 흰 선은 0.5m 안쪽. グレーチング 칸은 5~8칸마다 하나 섞는다.' % EDGE_KO[side])(_mke(_f, _g))


@prop('mark-lockplate', '코인 주차 잠금판', 1, 1, other='flat', tags=['노면', '주차'], rules='코인 주차장 칸마다 한가운데(차 앞 바퀴 자리).')
def _lock(c):
    """코인 주차 잠금판: 땅 위에 놓인 얇은 금속판을 위에서 본 모양(윗면 전체가 판, 볼트 넷, 가운데 잠금 원, 앞 가장자리 2줄만 어둡다)."""
    c.R(3, 4, 10, 8, K('tekko', 2)); c.HL(3, 4, 10, K('tekko', 3)); c.VL(3, 4, 8, K('tekko', 3))
    for x, y in ((4, 5), (11, 5), (4, 9), (11, 9)): c.P(x, y, K('tekko', -1))
    for j in range(-2, 3):
        for i in range(-2, 3):
            if i * i + j * j <= 5: c.P(8 + i, 7 + j, K('kii', 1) if i * i + j * j <= 2 else K('tekko', -2))
    c.HL(3, 12, 10, K('tekko', -3)); c.HL(3, 13, 10, K('yoru', -2)); c.HL(4, 14, 9, K('yoru', -1))
    c.HL(2, 3, 12, OL); c.VL(2, 4, 9, OL); c.VL(13, 4, 9, OL)


# ─────────────────────────── 블록 담·대문·카포트 (조사 02·03: 블록 한 단 20cm, 보통 1.2m 이하 + 위 펜스) ───────────────────────────
def coping(c, x, y, w, rows, ramp='tairu', t=1):
    """타일 이음에서 끊기지 않는 윗면: 기와 갓돌(kawara) — 4px마다 골이 지는 어두운 기와 상판(앞면의 연한 줄눈 돌과 확연히 갈림) + 앞 모서리 밝은 선."""
    for j in range(rows):
        c.HL(x, y + j, w, K(ramp, t + (j * 2) // rows))
    for i in range(x + 3, x + w, 4):
        c.VL(i, y + 1, rows - 2, K(ramp, 5)); c.VL(i + 1, y + 1, rows - 2, K(ramp, t - 1))
    c.HL(x, y, w, OL); c.HL(x, y + rows - 1, w, K(ramp, 5))


def block_wall(c, x, y, w, sukashi=(), cap=True, end_l=False, end_r=False):
    """블록 담 높이 14px: 갓돌 윗면 8줄(밝은 직사각 돌판 — 뒤 그늘·앞 입술) + 훨씬 어두운 앞면 6줄(가로 줄눈·엇갈린 세로 줄눈·투각 블록) + 밑 그림자."""
    fy = y + 9
    c.R(x, fy, w, 5, K('conc', -3))
    c.HL(x, fy, w, K('conc', -4 if False else -3))
    for k, j in enumerate(range(fy + 2, fy + 5, 2)): c.HL(x, j, w, K('conc', -4 if False else -3))
    for k, j in enumerate(range(fy + 1, fy + 5, 2)):
        for i in range(x + (0 if k % 2 else 4), x + w, 8): c.VL(i, j, 2, K('conc', -2))
    for sx in sukashi:
        c.R(sx, fy + 1, 7, 3, K('sumi', 1)); c.HL(sx + 2, fy + 1, 3, K('conc', -1)); c.P(sx + 3, fy + 2, K('conc', -1))
    box_top(c, x, y, w, 9, 'ita', 2, ends=(end_l, end_r))
    c.HL(x, y + 14, w, OL)
    if end_l: c.VL(x - 1, fy, 5, OL)
    if end_r: c.VL(x + w, fy, 5, OL)


def fence_top(c, x, y, w, h=11):
    """블록 위 알루미늄 가림 펜스: 윗면 4줄(갈색 판 결) + 앞면 세로 살."""
    top_face(c, x, y, w, 4, 'ita', 0)
    c.R(x, y + 4, w, h - 4, K('ita', -1))
    for i in range(x + 1, x + w, 3): c.VL(i, y + 4, h - 4, K('ita', 0))


for _v, _n in (('plain', '블록 담(가로)'), ('sukashi', '블록 담(가로·투각 블록)'), ('end-l', '블록 담 왼쪽 끝'), ('end-r', '블록 담 오른쪽 끝')):
    def _mkw(v):
        def _w(c):
            block_wall(c, 0, 1, 16, sukashi=(5,) if v == 'sukashi' else (), end_l=v == 'end-l', end_r=v == 'end-r')
        return _w
    prop('bwall-' + _v, _n, 1, 1, solid=[(0, 0)], tags=['담', '블록 담', '주택가'],
         rules='집 앞 경계(길 쪽 한 줄). 가로로 잇고 투각은 띄엄띄엄(3~5칸에 하나), 양 끝에 end-l·end-r. 대문 자리는 비운다.')(_mkw(_v))

for _v, _n in (('plain', '블록 담 + 가림 펜스(가로)'), ('end-l', '블록 담 + 펜스 왼쪽 끝'), ('end-r', '블록 담 + 펜스 오른쪽 끝')):
    def _mkf(v):
        def _w(c):
            fence_top(c, 0, 5, 16)
            block_wall(c, 0, 17, 16, end_l=v == 'end-l', end_r=v == 'end-r')
            if v == 'end-l': c.VL(0, 5, 11, K('ita', 1)); c.VL(-1, 5, 11, OL)
            if v == 'end-r': c.VL(15, 5, 11, K('ita', -2))
        return _w
    prop('bwallf-' + _v, _n, 1, 2, solid=[(0, 1)], tags=['담', '펜스', '주택가'],
         rules='새 집 앞 담(1.2m 블록 + 1m 펜스). 가로로 잇고 양 끝에 end-l·end-r.')(_mkf(_v))


@prop('gatepost', '門柱 대문 기둥(표찰·인터폰·우편함)', 1, 1, solid=[(0, 0)], tags=['대문', '주택가'],
      rules='블록 담이 끊긴 대문 자리 한쪽(담과 같은 줄). 반대쪽 칸은 걸어 들어가는 길로 비우거나 gate 를 둔다.')
def _gatepost(c):
    top_face(c, 0, 1, 16, 6, 'shiro', 2)                                             # 갓돌 윗면
    c.R(2, 7, 12, 9, K('tairu', -1)); c.VL(2, 7, 9, K('tairu', 0)); c.VL(13, 7, 9, K('tairu', -3))
    c.R(4, 8, 8, 2, K('ita', 1)); c.HL(5, 9, 6, K('sumi', 2))                        # 표찰
    c.R(4, 11, 3, 3, K('tekko', 0)); c.P(5, 12, K('sora', 1))                         # 인터폰
    c.R(8, 11, 5, 4, K('tekko', 2)); c.HL(9, 12, 3, K('tekko', -2))                   # 우편함
    c.HL(1, 15, 14, K('conc', -2))


@prop('gate', '門扉 알루미늄 대문(두 칸)', 2, 1, solid=[(0, 0), (1, 0)], tags=['대문', '주택가'],
      rules='gatepost 옆 2칸. 닫힌 대문이라 막힘 — 들어가는 길이 필요하면 대신 비워 둔다.')
def _gate(c):
    for x0 in (1, 16):
        slab(c, x0, 0, 15, 7, 'ita', 2, taper=0.5)                                   # 위 가로대 윗면
        c.R(x0, 7, 15, 8, K('ita', -3)); c.HL(x0, 7, 15, K('ita', -1)); c.HL(x0, 14, 15, K('sumi', 1))
        for i in range(x0 + 2, x0 + 14, 3): c.VL(i, 8, 6, K('ita', 0))
        c.VL(x0, 7, 8, OL); c.VL(x0 + 15, 7, 8, OL)


@prop('carport', 'カーポート 알루미늄 카포트', 4, 3, solid=[(0, 2), (3, 2)], tags=['카포트', '주차', '주택가'],
      rules='교외 집 앞마당(길과 집 사이 4×3칸). 지붕 밑은 지나갈 수 있다 — 차 소품(jp-prop-car-*)은 지붕 밑 줄에 둔다. 앞 기둥 둘만 막힘.')
def _carport(c):
    W = 64
    slab(c, 0, 4, W, 14, 'garasu', 2, taper=0.4, ribs=6, lip=False)                   # 폴리카보 지붕 윗면(원근 사다리꼴, 갈라지는 골)
    c.R(0, 18, W, 5, K('ita', 0)); c.HL(0, 18, W, K('ita', 2)); c.HL(0, 19, W, K('ita', 1)); c.HL(0, 22, W, K('ita', -2)); c.HL(0, 23, W, OL)   # 앞 보(브론즈)
    c.VL(-1, 18, 5, OL); c.VL(W, 18, 5, OL)
    for px in (4, W - 8):
        c.R(px, 23, 4, 24, K('ita', 0)); c.VL(px, 23, 24, K('ita', 2)); c.VL(px + 3, 23, 24, K('ita', -2)); c.VL(px - 1, 23, 24, OL); c.VL(px + 4, 23, 24, OL)
    for i in range(0, W): c.P(i, 23 + 1, K('yoru', -2)) if i % 2 else None


@prop('tsukigime', '月極駐車場 간판(空あり)', 2, 2, solid=[(0, 1), (1, 1)], tags=['주차', '月極', '간판'],
      rules='월정 주차장 길 쪽 모퉁이. 주차 칸 선은 기존 주차 바닥 칸을 쓴다.')
def _tsuki(c):
    box_top(c, 2, 1, 28, 10, 'ita', 2, ends=(True, True))                                            # 간판 상자 윗면(밝은 직사각 판)
    c.R(2, 11, 28, 11, K('shiro', -1)); c.HL(2, 11, 28, K('kon', -2))
    c.R(4, 13, 9, 7, K('kon', 0)); c.R(6, 14, 3, 5, K('shiro', 2)); c.R(8, 14, 4, 3, K('shiro', 2)); c.R(9, 15, 2, 1, K('kon', 0))   # P
    for j in (14, 16, 18): c.HL(16, j, 12, K('sumi', 2))
    c.R(4, 20, 24, 1, K('aka', 0))                                                    # 空あり 띠
    c.VL(1, 11, 12, OL); c.VL(30, 11, 12, OL); c.HL(1, 22, 30, OL)
    for px in (6, 24): c.R(px, 23, 2, 22, K('tekko', 1)); c.VL(px - 1, 23, 22, OL); c.VL(px + 2, 23, 22, OL)
    shadow(c, 3, 45, 26)


# ─────────────────────────── 생활 소품 ───────────────────────────
@prop('propane', 'プロパン 가스통 두 개', 1, 2, solid=[(0, 1)], tags=['가스', '생활', '주택가'],
      rules='도시가스가 없는 동네의 집 옆벽 앞(건물 키트 바로 아래 줄 옆 칸).')
def _propane(c):
    for x0 in (0, 8):
        c.R(x0, 11, 8, 19, K('shiro', 1)); c.VL(x0, 11, 19, K('shiro', 2)); c.VL(x0 + 7, 11, 19, K('tekko', 1))
        disc_top(c, x0 + 4, 8, 3, 3, 'shiro', 1)                                       # 탱크 위 타원 윗면
        c.R(x0 + 3, 4, 3, 2, K('tekko', -1)); c.P(x0 + 4, 3, K('aka', 1))               # 밸브
        c.HL(x0, 16, 8, K('sumi', 1)); c.HL(x0, 25, 8, K('sumi', 1))                    # 쇠사슬
        c.VL(x0 - 1, 9, 21, OL); c.VL(x0 + 8, 9, 21, OL)
    c.HL(0, 30, 16, OL); shadow(c, 1, 30, 14)


@prop('ac-unit', '에어컨 실외기', 1, 1, solid=[(0, 0)], tags=['실외기', '생활'],
      rules='집·가게 옆벽 앞이나 골목.')
def _ac(c):
    top_face(c, 1, 2, 14, 6, 'tekko', 2)                                             # 윗면(밝은 판)
    c.R(1, 8, 14, 7, K('tekko', -2)); c.R(2, 9, 8, 5, K('tekko', -3))
    for i in range(3, 10, 2): c.VL(i, 9, 5, K('tekko', -1))
    c.VL(14, 8, 7, K('tekko', -3)); c.VL(0, 8, 7, OL); c.VL(15, 8, 7, OL); c.HL(0, 15, 16, K('conc', -3))
    c.P(11, 11, K('kii', 2))


@prop('pots', '화분 줄(下町)', 2, 1, solid=[], tags=['화분', '下町', '생활'],
      rules='下町 골목의 집 앞·담 위. 마당이 없는 집 앞을 화분으로 채운다(조사 02). 지나갈 수 있다.')
def _pots(c):
    """화분 둘: 둥근 화분마다 위에서 보이는 타원 아가리(흙) + 식물."""
    for x0 in (1, 17):
        c.R(x0 + 1, 11, 12, 5, K('renga', -1))
        for j in range(5): c.HL(x0 + 1 + (j == 4), 11 + j, 12 - 2 * (j == 4), K('renga', -1 if j else 0))
        c.VL(x0 + 1, 11, 5, K('renga', 1)); c.VL(x0 + 12, 11, 5, K('renga', -3)); c.HL(x0 + 2, 15, 10, OL)
        disc_top(c, x0 + 7, 9, 7, 5, 'renga', 2)                                   # 아가리 림(밝은 테)
        for j in range(-3, 4):
            for i in range(-5, 6):
                if (i * i) / 30.0 + (j * j) / 10.0 <= 1.0: c.P(x0 + 7 + i, 9 + j, K('ita', -4) if (i + j) % 3 else K('ita', -3))
        for k in range(5): c.VL(x0 + 5 + k, 2 + (k % 2) * 2, 7 - (k % 2) * 2, K('midori', 1 if k % 2 else 2))
        c.P(x0 + 7, 1, K('aka', 2)); c.P(x0 + 5, 3, K('kii', 2))


@prop('monohoshi', '物干し 빨래 장대(마당)', 3, 2, solid=[(0, 1), (2, 1)], tags=['빨래', '생활', '주택가'],
      rules='집 앞마당이나 아파트 1층 앞. 양 끝 받침만 막힘.')
def _monohoshi(c):
    for px in (5, 41):
        c.R(px - 1, 9, 4, 21, K('tekko', 2)); c.VL(px - 1, 9, 21, K('tekko', 3)); c.VL(px - 2, 9, 21, OL); c.VL(px + 3, 9, 21, OL)
        c.R(px - 3, 28, 8, 2, K('tekko', 0))
        top_face(c, px - 2, 5, 6, 4, 'tekko', 2)                                       # 기둥 머리 윗면
    slab(c, 2, 2, 44, 7, 'shiro', 2, taper=0.5, lip=False)                           # 장대 윗면
    c.HL(2, 9, 44, K('tekko', 0)); c.HL(2, 10, 44, OL)
    clothes = (('sora', 1, 8, 9), ('shiro', 2, 7, 11), ('pinku', 2, 6, 8), ('kii', 2, 8, 10), ('midori', 1, 6, 7))
    x = 7
    for m, t, w, h in clothes:
        c.R(x, 11, w, h, K(m, t)); c.HL(x, 11, w, K(m, t + 1)); c.VL(x + w - 1, 11, h, K(m, t - 1)); c.HL(x, 11 + h, w, K(m, t - 2))
        x += w + 1
    shadow(c, 2, 30, 44)


@prop('keijiban', '町内会 掲示板', 2, 2, solid=[(0, 1), (1, 1)], tags=['게시판', '町内会', '생활'],
      rules='골목 모퉁이·공원 입구·신사 앞. 다리 둘, 차양, 유리 안 종이.')
def _board(c):
    top_face(c, 1, 2, 30, 5, 'ita', 0)                                               # 차양 윗면(판 결)
    c.R(1, 7, 30, 2, K('ita', -1)); c.HL(1, 7, 30, K('ita', 1)); c.HL(0, 9, 32, OL)
    c.R(2, 9, 28, 14, K('tekko', 2)); c.R(3, 10, 26, 12, K('kinari', 1))
    for x0, y0, w, h, m in ((4, 11, 7, 8, 'shiro'), (12, 11, 8, 5, 'kii'), (21, 12, 7, 8, 'shiro'), (12, 17, 7, 4, 'pinku')):
        c.R(x0, y0, w, h, K(m, 2)); c.HL(x0 + 1, y0 + 2, w - 2, K('sumi', 2)); c.HL(x0 + 1, y0 + 4, w - 3, K('sumi', 2))
    c.VL(1, 7, 16, OL); c.VL(30, 7, 16, OL); c.HL(1, 23, 30, OL)
    for px in (6, 24): c.R(px, 24, 2, 21, K('tekko', 1)); c.VL(px - 1, 24, 21, OL); c.VL(px + 2, 24, 21, OL)
    shadow(c, 3, 45, 26)


@prop('gomi-box', 'ゴミ集積所 접이식 철망 상자', 2, 1, solid=[(0, 0), (1, 0)], tags=['쓰레기', '생활', '주택가'],
      rules='골목 길가(전봇대 곁). 녹색 철망 상자 + 자치회 명패.')
def _gomi(c):
    top_face(c, 1, 2, 30, 5, 'midori', 0)                                            # 철망 뚜껑 윗면
    for i in range(3, 30, 3): c.VL(i, 3, 3, K('midori', -1))
    c.R(1, 7, 30, 8, K('midori', -1)); c.HL(1, 7, 30, K('midori', 1))
    for i in range(2, 31, 3): c.VL(i, 8, 6, K('midori', 0))
    for j in (9, 12): c.HL(2, j, 28, K('midori', 0))
    c.R(11, 9, 10, 4, K('shiro', 2)); c.HL(12, 11, 8, K('sumi', 2))
    c.VL(0, 7, 8, OL); c.VL(31, 7, 8, OL); c.HL(0, 15, 32, OL)


@prop('jizo', 'お地蔵さん 길가 祠', 1, 2, solid=[(0, 1)], tags=['지장', '祠', '골목'],
      rules='골목 모퉁이·담 곁. 빨간 턱받이와 모자를 쓴 돌 지장 + 작은 나무 사당.')
def _jizo(c):
    slab(c, 0, 0, 16, 9, 'tairu', 2, taper=0.6, ribs=4, lip=False)                   # 사당 지붕 윗면(기와, 원근)
    c.R(1, 9, 14, 2, K('ita', -1)); c.HL(1, 9, 14, K('ita', 1)); c.HL(0, 11, 16, OL)  # 처마 앞
    c.R(2, 11, 12, 18, K('ita', -2)); c.VL(2, 11, 18, K('ita', 0)); c.VL(13, 11, 18, K('ita', 0))
    c.R(5, 13, 6, 5, K('conc', 1)); c.R(5, 13, 6, 2, K('aka', 0))                    # 머리 + 모자
    c.R(4, 18, 8, 3, K('aka', 1)); c.R(5, 21, 6, 6, K('conc', 0)); c.VL(5, 18, 8, K('conc', 2))
    c.P(6, 16, K('sumi', 1)); c.P(9, 16, K('sumi', 1))
    slab(c, 0, 27, 16, 4, 'conc', 2, taper=0.5, lip=False)                         # 받침돌 윗면(앞에 보이는 바닥)
    c.VL(1, 10, 19, OL); c.VL(14, 10, 19, OL); c.HL(0, 31, 16, OL)


@prop('torii', '鳥居 주홍 도리이', 4, 3, solid=[(0, 2), (3, 2)], tags=['신사', '도리이'],
      rules='신사 참배길 입구. 가운데 두 칸이 걸어 지나가는 길이다(기둥 두 칸만 막힘). 뒤쪽(북쪽)에 참배길·拝殿.')
def _torii(c):
    v = 'aka'
    slab(c, 0, 0, 64, 7, 'tairu', 1, taper=0.6, ribs=12, lip=False, rc=5)                                    # 笠木 윗면(두꺼운 면, 양 끝이 들린 사다리꼴)
    c.R(0, 7, 64, 2, K('sumi', -2)); c.HL(0, 7, 64, K('sumi', 0)); c.VL(-1, 7, 2, OL); c.VL(64, 7, 2, OL)   # 笠木 앞
    c.R(2, 9, 60, 3, K(v, 0)); c.HL(2, 9, 60, K(v, 2)); c.HL(2, 11, 60, K(v, -2))          # 島木
    c.HL(0, 9, 64, OL); c.HL(1, 12, 62, OL)
    c.R(29, 12, 6, 6, K(v, 0)); c.VL(29, 12, 6, OL); c.VL(34, 12, 6, OL)                    # 額束
    slab(c, 4, 13, 56, 5, 'aka', 3, taper=0.4, lip=False)
    c.R(4, 18, 56, 3, K(v, -2)); c.HL(4, 18, 56, K(v, 0)); c.HL(4, 20, 56, K(v, -3)); c.HL(4, 21, 56, OL)   # 貫
    for px in (6, 52):
        c.R(px, 12, 6, 34, K(v, 0)); c.VL(px, 12, 34, K(v, 2)); c.VL(px + 5, 12, 34, K(v, -2)); c.VL(px - 1, 12, 34, OL); c.VL(px + 6, 12, 34, OL)
        c.R(px - 1, 42, 8, 4, K('sumi', 1))                                                 # 根巻
    shadow(c, 4, 46, 12); shadow(c, 50, 46, 12)


@prop('gas-canopy', '給油所 캐노피 + 주유기 둘', 7, 4, solid=[(1, 3), (5, 3), (2, 3), (4, 3)], tags=['주유소', '캐노피'],
      rules='간선 길가. 캐노피 밑(위 세 줄)은 차가 들어가는 바닥이다. 주유기 섬 두 개와 기둥이 맨 아래 줄을 막는다. 뒤(북쪽)에 給油所 사무소(jp-bldg-gas-office).')
def _gas(c):
    W = 112
    slab(c, 0, 1, W, 11, 'shiro', 2, taper=0.45, ribs=8, lip=False)                           # 캐노피 윗면(원근 사다리꼴)
    c.R(0, 12, W, 6, K('aka', 0)); c.HL(0, 12, W, K('aka', 2)); c.HL(0, 17, W, K('aka', -2)); c.HL(0, 15, W, K('shiro', 2))   # 앞 띠
    c.HL(0, 18, W, OL); c.VL(-1, 12, 6, OL); c.VL(W, 12, 6, OL)
    for px in (22, 86):
        c.R(px, 18, 4, 46, K('shiro', 1)); c.VL(px, 18, 46, K('shiro', 2)); c.VL(px + 3, 18, 46, K('tekko', 0)); c.VL(px - 1, 18, 46, OL); c.VL(px + 4, 18, 46, OL)
    for gx in (36, 68):
        c.R(gx - 2, 58, 16, 4, K('conc', 1)); c.HL(gx - 2, 58, 16, K('conc', 2))            # 섬
        c.R(gx, 36, 12, 22, K('shiro', 2)); c.R(gx, 36, 12, 5, K('aka', 0)); c.R(gx + 2, 43, 8, 5, K('garasu', -1))
        c.R(gx + 2, 50, 3, 6, K('kii', 1)); c.R(gx + 7, 50, 3, 6, K('midori', 1))
        c.VL(gx - 1, 36, 22, OL); c.VL(gx + 12, 36, 22, OL); c.HL(gx - 1, 35, 14, OL)
    for i in range(0, W, 2): c.P(i, 19, K('yoru', -2))


@prop('school-gate', '小学校 정문(기둥·교명판·미닫이 문)', 6, 2, solid=[(0, 1), (5, 1), (1, 1), (4, 1)], tags=['학교', '정문'],
      rules='학교 운동장 남쪽 담 한가운데. 가운데 두 칸은 열린 문(지나감), 양쪽 기둥·접힌 문 칸은 막힘.')
def _sgate(c):
    for px in (2, 82):
        c.R(px, 10, 12, 22, K('conc', -1)); c.VL(px, 10, 22, K('conc', 1)); c.VL(px + 11, 10, 22, K('conc', -3))
        c.VL(px - 1, 10, 22, OL); c.VL(px + 12, 10, 22, OL)
        slab(c, px - 2, 1, 16, 9, 'shiro', 2, taper=0.5, lip=True)                          # 기둥 머리 윗면(넓은 덮개)
    c.R(4, 13, 8, 16, K('ita', 1)); c.VL(5, 14, 14, K('sumi', 2)); c.VL(9, 16, 10, K('sumi', 2))    # 교명판(세로 글 줄)
    for x0 in (14, 66):                                                                       # 접힌 미닫이 문
        slab(c, x0, 9, 16, 7, 'tekko', 2, taper=0.5, lip=False)                               # 문 윗 가로대 윗면
        c.R(x0, 16, 16, 14, K('tekko', -2))
        for i in range(x0 + 1, x0 + 16, 3): c.VL(i, 17, 12, K('tekko', -3))
        c.HL(x0, 16, 16, K('tekko', 0)); c.VL(x0 + 15, 16, 14, OL)
    shadow(c, 0, 32, 96)


# ─────────────────────────── 굽기 ───────────────────────────
def _render(p):
    c = Cv(p['w'] * 16, p['h'] * 16)
    p['draw'](c)
    return c.a


def _finalize():
    if 'r' in _CACHE: return _CACHE['r']
    cells = collections.OrderedDict(); seen = {}; kits = []; sprites = {}
    for p in P:
        a = _render(p)
        R, C = p['h'], p['w']
        solid = set(map(tuple, p['solid']))
        grid = []
        for cy in range(R):
            row = []
            for cx in range(C):
                t = a[cy * 16:(cy + 1) * 16, cx * 16:(cx + 1) * 16].copy()
                if not t[:, :, 3].any(): row.append(None); continue
                t[t[:, :, 3] == 0] = 0
                pc = 'solid' if (cx, cy) in solid else p['other']
                key = (t.tobytes(), pc)
                if key in seen: row.append(seen[key]); continue
                local = '%s/%d.%d' % (p['id'], cx, cy)
                seen[key] = local
                cells[local] = dict(img=Image.fromarray(t, 'RGBA'), pc=pc, label='%s 칸 (%d,%d)' % (p['name'], cx, cy),
                                    desc='[거리 소품] %s 의 일부. 키트 jp-%s 로 통째로 놓는다.' % (p['name'], p['id']), tags=list(p['tags']))
                row.append(local)
            grid.append(row)
        wire = p['id'].startswith('wire')
        desc = '%s — 폭 %d칸×높이 %d칸. 손 도트 일본 거리 소품(modern3, 빛 왼쪽 위, 정면 고정 3/4).' % (p['name'], C, R)
        if wire: desc += ' 4층(위 덧그림) 전용 전선.'
        snap = 'floor'
        ai = dict(snap=snap, tags=list(p['tags']), description=desc, placementRules=p['rules'], repeatability='fixed', growthAxis=None,
                  anchor=dict(dx=0, dy=R - 1), access=[], role='wall' if p['id'].startswith(('bwall', 'gate')) else 'prop')
        kits.append(dict(id='jp-' + p['id'], name=p['name'], grid=grid, base=None, parts=[], ai=ai))
        sprites[p['id']] = a
    groups = [dict(id='jp:hand-marking', name='손 도트 노면·길 가장자리', role='detail', defaultLayer='upper',
                   cells=[k for k, v in cells.items() if v['pc'] == 'flat'], desc='路側帯 흰 실선·側溝 뚜껑·グレーチング·「30」·코인 주차 잠금판(투명 덧그림, 캐릭터 밑).',
                   rules='생활도로 가장자리 칸에 3층으로 칠한다(투명 덧그림이라 바닥은 그대로 보인다).')]
    _CACHE['r'] = (cells, kits, sprites, groups)
    return _CACHE['r']


_CACHE = {}

# ─────────────────────────── 하천 둑·다리·물가 (2026-10-12 적대적 시각 QA: 둑이 가로 줄무늬 띠로만 보여 「내려간다」는 느낌이 없었다) ───────────────────────────
def river_wall_face(c):
    """둑 정면 석축 1×4칸(64px): 위 4px 투명(산책로 바닥) → 갓돌 8px(밝은 단+밑그늘) → 돌 쌓기 면(엇갈린 줄눈, 아래로 갈수록 어둡고 젖음) → 맨 아래 수면 접촉선."""
    W, H = 16, 64
    c.R(0, 4, W, 6, K('conc', 2)); c.HL(0, 4, W, K('conc', 3)); c.HL(0, 5, W, K('conc', 3))                 # 갓돌 윗면(밝음)
    for j in (6, 7, 8): c.VL(7, j, 1, K('conc', 0)); c.VL(15, j, 1, K('conc', 0))                               # 갓돌 이음
    c.HL(0, 10, W, K('conc', -2)); c.HL(0, 11, W, K('sumi', 1))                                                # 갓돌 밑 그늘선
    for y in range(12, H):
        t = (y - 12) / (H - 12)
        shade = 2 if t < 0.1 else 1 if t < 0.3 else 0 if t < 0.5 else -1 if t < 0.7 else -2 if t < 0.88 else -3
        c.HL(0, y, W, K('conc', shade))
    for k, y0 in enumerate(range(13, H - 6, 6)):                                                               # 돌 층(높이 6px, 엇갈린 줄눈)
        c.HL(0, y0 + 5, W, K('conc', -2 if y0 < 40 else -3))
        for ix in ((0, 8) if k % 2 == 0 else (4, 12)):
            c.VL(ix, y0, 5, K('conc', -2 if y0 < 40 else -3)); c.P(ix + 1, y0, K('conc', 2 if y0 < 30 else 0))
    for i in range(0, W, 2):                                                                                    # 젖은 얼룩·이끼(아래쪽)
        c.P(i + (3 if i % 4 == 0 else 1), 49, K('kon', 0)); c.P(i, 55, K('midori', -2)); c.P(i + 1, 58, K('kon', 0))
    c.HL(0, H - 5, W, K('kon', -1)); c.HL(0, H - 4, W, K('kon', -2)); c.HL(0, H - 3, W, K('kon', -2)); c.HL(0, H - 2, W, K('kon', -3)); c.HL(0, H - 1, W, K('sumi', 0))   # 수면 접촉선


prop('river-wall', '하천 둑 석축 정면(갓돌+돌 쌓기 4칸)', 1, 4, solid=[(0, 0), (0, 1), (0, 2), (0, 3)], tags=['하천', '둑', '호안', '석축'],
     rules='동서로 흐르는 하천의 북쪽 둑. 산책로 아랫줄에서 시작해 가로로 이어 붙인다(칸마다 같은 칸이라 이음새 없음). 바로 아래에 물 줄이 온다. 다리 상판이 지나는 칸은 비운다.')(river_wall_face)


def water_shade(c):
    """둑 밑 물 그늘: 위 5줄 짙은 남색 → 3줄 중간 남색(점 섞임) → 4줄 성긴 점으로 사라짐(수로 오토타일의 옅은 윗 테두리를 덮고 물로 부드럽게 이어짐)."""
    for y in range(5): c.HL(0, y, 16, K('kon', -2))
    for y in range(5, 8):
        c.HL(0, y, 16, K('kon', -1))
        for x in range(16):
            if (x + y) % 3 == 0: c.P(x, y, K('kon', -2))
    for y in range(8, 12):
        for x in range(16):
            if (x * 3 + y * 5) % (4 + (y - 8)) == 0: c.P(x, y, K('kon', -1))


prop('water-shade', '물 위 그늘(둑·다리 밑)', 1, 1, other='flat', tags=['하천', '물', '그늘'],
     rules='둑 벽 바로 아래 물 첫 줄 전체와, 다리 상판 양옆의 물 줄에 찍는다(투명 덧그림).')(water_shade)


def _rail_body(c):
    c.R(0, 0, 16, 16, K('ita', -1))
    for y in range(0, 16, 4): c.HL(0, y + 3, 16, K('ita', -2))
    c.VL(4, 0, 16, OL); c.VL(11, 0, 16, OL)
    c.R(5, 0, 6, 16, K('conc', 2)); c.VL(5, 0, 16, K('conc', 3)); c.VL(6, 0, 16, K('conc', 3)); c.VL(10, 0, 16, K('conc', 0))
    c.VL(8, 0, 16, K('conc', 1))


def bridge_rail_v(c):
    """남북 다리 난간(이음 없는 가로대): 위에서 본 석재 윗면 6px, 왼쪽 밝음·가운데 줄눈·오른쪽 그늘. 기둥은 bridge-post 로 따로."""
    _rail_body(c)


def bridge_post(c):
    """난간 기둥: 원통 몸통(앞면 6줄) 위에 위에서 본 타원 머리판(7줄). 이음 가로대는 위·아래 2줄만 남긴다."""
    for y in (0, 1, 14, 15):
        c.R(4, y, 8, 1, K('conc', 1)); c.P(4, y, OL); c.P(11, y, OL)
    c.R(3, 8, 10, 6, K('conc', -1)); c.R(3, 8, 4, 6, K('conc', 1)); c.VL(11, 8, 6, K('conc', -3)); c.VL(12, 8, 6, K('conc', -3)); c.HL(3, 8, 10, K('conc', -3)); c.HL(3, 13, 10, K('conc', -3))
    c.VL(2, 8, 6, OL); c.VL(13, 8, 6, OL); c.HL(2, 14, 12, OL)
    disc_top(c, 8, 5, 7, 4, 'kinari', 2)                                              # 타원 머리판
    for i in range(-5, 6, 3): c.P(8 + i, 4 + (i % 2), K('kinari', 4))
    c.R(6, 10, 4, 2, K('sumi', 1))

prop('bridge-post', '다리 난간 기둥', 1, 1, solid=[(0, 0)], tags=['다리', '난간', '하천'], rules='다리 양 끝과 3칸마다 난간 위에 찍는다.')(bridge_post)


prop('bridge-rail-v', '남북 다리 난간(석재 윗면+기둥머리)', 1, 1, solid=[(0, 0)], tags=['다리', '난간', '하천'],
     rules='남북으로 놓인 다리 상판 양쪽 가장자리 칸에 세로로 잇는다(위 칸과 이어짐). 상판 폭 바깥쪽에 둔다.')(bridge_rail_v)


def _stone_rows(c, y0, y1, shift):
    for y in range(y0, y1):
        k = (y + shift) % 16
        t = K('conc', 2) if k < 4 else K('conc', 1) if k < 8 else K('conc', 0) if k < 12 else K('conc', -1)
        c.HL(0, y, 16, t)
    for yy in range(y0, y1):
        if (yy + shift) % 4 == 3: c.HL(0, yy, 16, K('sumi', 1))
        else:
            for x in range(((yy + shift) // 4 % 2) * 8 + 3, 16, 8): c.P(x, yy, K('sumi', 1))


def bank_lip(c):
    """건너편(남쪽) 둑 석축 윗단: 위 2px 물 접촉 그늘, 이어서 줄눈 있는 돌 14px(위가 밝고 아래로 젖어 어두움)."""
    for x in range(16):
        c.P(x, 0, K('kon', -1)); c.P(x, 1, K('kon', -2))
    c.HL(0, 2, 16, K('sumi', 1))
    _stone_rows(c, 3, 16, 0)


prop('bank-lip', '건너편 둑 윗가장자리+풀 비탈(물 접촉 그늘+갓돌+불투명 풀)', 1, 1, other='flat', tags=['하천', '둑'],
     rules='하천 남쪽 풀 비탈 줄 위에 가로로 이어 찍는다(투명 덧그림, 아래는 비탈 풀이 보인다).')(bank_lip)



def _side(c, right):
    """다리 옆 물: 다리 쪽 5px 은 상판 밑면(어두운 나무 보 + 윤곽, 아래에 교각 물거품), 나머지는 투명 바탕에 다리에서 멀어질수록 성긴 그림자 점."""
    for x in range(16):
        d = x if right else 15 - x          # 다리 쪽이 0
        for y in range(16):
            if 3 <= d < 7 and (d < 5 or (x + y) % 2 == 0): c.P(x, y, K('kon', -2) if d < 5 else K('kon', -1))


def water_dark(c):
    _side(c, False)


def water_dark_r(c):
    _side(c, True)


prop('water-dark-r', '다리 오른쪽 밑면', 1, 1, other='flat', tags=['하천', '그림자', '다리'], rules='다리 상판 오른쪽 물 위.')(water_dark_r)
prop('water-dark', '다리 왼쪽 밑면', 1, 1, other='flat', tags=['하천', '물', '그늘', '다리'],
     rules='다리 상판 왼쪽의 물 칸에 찍는다.')(water_dark)


def crosswalk_v(c):
    """남북 길의 횡단보도(차 진행 방향 줄무늬): 흰 세로 막대 4px 2개 + 닳은 점."""
    for x0 in (1, 9):
        c.R(x0, 0, 6, 16, K('shiro', 2)); c.VL(x0 + 5, 0, 16, K('shiro', 0))
        for y in range(0, 16, 5): c.P(x0 + 1 + (y % 3), y, K('shiro', 0))


prop('crosswalk-v', '횡단보도(세로 줄무늬)', 1, 1, other='flat', tags=['노면', '횡단보도'], rules='다리 어귀 두 줄, 길 차선 칸마다 같은 줄에 찍는다.')(crosswalk_v)


def mark_center_v(c):
    """세로 길 중앙 점선: 칸 가운데 노란 4px 2개 사이 틈."""
    c.R(7, 1, 2, 5, K('kii', 1)); c.R(7, 9, 2, 5, K('kii', 1)); c.VL(7, 1, 5, K('kii', 2)); c.VL(7, 9, 5, K('kii', 2))


prop('mark-center-v', '세로 길 중앙선', 1, 1, other='flat', tags=['노면', '중앙선'], rules='세로 길 가운데 차선 칸에 찍는다.')(mark_center_v)


def foot_shadow(c):
    """건물 밑 접지 그림자: 위 3줄만 가로 점·선(아래로 옅어짐), 나머지 투명."""
    c.HL(0, 0, 16, K('sumi', 1))
    for x in range(16):
        c.P(x, 1, K('sumi', 0) if x % 2 == 0 else K('sumi', 1))
        if x % 3 == 0: c.P(x, 2, K('sumi', 0))


prop('foot-shadow', '건물 밑 접지 그림자', 1, 1, other='flat', tags=['그림자'], rules='건물 맨 아래 줄 바로 아래 칸에 폭만큼 찍는다.')(foot_shadow)


def wall_drain(c):
    """둑 벽 배수구: 어두운 둥근 구멍 + 아래로 번진 이끼·물때 줄."""
    for y in range(16):
        c.HL(0, y, 16, K('conc', 1) if y < 8 else K('conc', 0))
        if y % 4 == 3: c.HL(0, y, 16, K('sumi', 1))
    c.R(5, 3, 6, 5, OL); c.R(6, 4, 4, 3, K('kon', -2)); c.HL(5, 2, 6, K('conc', 3))
    for y in range(8, 16):
        for x in (6 + (y % 2), 8, 9 + (y % 3 == 0)):
            if x < 16: c.P(x, y, K('midori', -2) if y < 12 else K('kon', -1))


prop('wall-drain', '둑 벽 배수구', 1, 1, other='flat', tags=['하천', '둑'], rules='북쪽 둑 벽(river-wall) 가운데 줄에 드문드문 덮어 찍는다.')(wall_drain)


def bridge_abut(c):
    """둑 벽면을 타고 내려가는 돌 접근로: 줄눈 돌 바닥 + 양옆 어두운 측벽 2px(상판이 벽을 덮지 않고 돌 경사로로 보임)."""
    _stone_rows(c, 0, 16, 2)
    for y in range(16):
        c.P(0, y, K('sumi', 1)); c.P(15, y, K('sumi', 1))
        c.P(1, y, K('conc', -2)); c.P(14, y, K('conc', -2))
    for y in (0, 8): c.HL(2, y, 12, K('conc', 3))


prop('bridge-abut', '다리 돌 접근로(교대)', 1, 1, other='flat', tags=['다리', '하천'], rules='다리 상판이 둑 벽면을 지나는 칸에 널 대신 찍는다.')(bridge_abut)


def bridge_pier(c):
    """물 위 상판 마지막 칸: 위에서 본 밝은 널 윗면 6줄(가로 널 이음) + 어두운 보 앞면 4줄 + 물그림자."""
    c.HL(0, 0, 16, OL)
    for j in range(1, 7):
        c.HL(0, j, 16, K('ita', 3 if j in (1, 6) else 2))
        for i in range((j * 5) % 7, 16, 7): c.P(i, j, K('ita', 0))
    c.HL(0, 3, 16, K('ita', 0)); c.HL(0, 7, 16, K('ita', 4))
    c.R(0, 8, 16, 4, K('ita', -3)); c.HL(0, 8, 16, K('ita', -2)); c.HL(0, 12, 16, OL)
    for y in range(13, 16):
        for x in range(16):
            if (x + y) % 2 == 0: c.P(x, y, K('kon', -2))


prop('bridge-pier', '다리 밑면(물 위 끝)', 1, 1, other='flat', tags=['다리', '하천'], rules='물 줄 맨 아래 상판 칸.')(bridge_pier)


def water_streak(c):
    """긴 물결 하이라이트 두 줄."""
    c.HL(1, 4, 6, K('sora', 3)); c.HL(3, 5, 3, K('sora', 2)); c.HL(8, 11, 7, K('sora', 3)); c.HL(10, 12, 3, K('sora', 2))


prop('water-streak', '긴 물결', 1, 1, other='flat', tags=['하천', '물'], rules='수면 위에 드문드문.')(water_streak)


def mark_center_v_l(c):
    """차선이 짝수일 때 두 차선 사이(칸 왼쪽 가장자리) 중앙 점선."""
    c.R(0, 1, 2, 5, K('kii', 1)); c.R(0, 9, 2, 5, K('kii', 1))


prop('mark-center-v-l', '세로 길 중앙선(칸 왼쪽 가장자리)', 1, 1, other='flat', tags=['노면', '중앙선'], rules='차선 수가 짝수인 세로 길.')(mark_center_v_l)


def bridge_lip(c):
    """물 위 상판 첫 칸: 위 4px 어두운 그림자(아스팔트 위로 드리움)·보 윤곽, 아래 널."""
    c.R(0, 0, 16, 3, K('sumi', 1)); c.HL(0, 3, 16, OL)
    c.R(0, 4, 16, 12, K('ita', 0)); c.HL(0, 4, 16, K('ita', 2))
    for y0 in (8, 12):
        c.HL(0, y0, 16, K('ita', -2)); c.HL(0, y0 + 1, 16, K('ita', 1))


prop('bridge-lip', '물 위 상판 시작(턱)', 1, 1, other='flat', tags=['다리', '하천'], rules='물 줄 맨 위 상판 칸.')(bridge_lip)


def water_glint(c):
    """수면 반짝임: 투명 바탕에 밝은 점 5개."""
    for x, y in ((2, 3), (3, 3), (10, 7), (11, 7), (6, 12)): c.P(x, y, K('sora', 3))
    c.P(12, 2, K('shiro', 2)); c.P(5, 9, K('shiro', 2))


prop('water-glint', '수면 반짝임', 1, 1, other='flat', tags=['하천', '물'], rules='수면 위에 드문드문 찍는다.')(water_glint)


def water_rim_s(c):
    """수로 오토타일 남쪽 가장자리의 옅은 테두리를 어두운 물 가장자리로 덮는다(아래 4px)."""
    for x in range(16):
        c.P(x, 12, K('kon', 0)); c.P(x, 13, K('kon', -1)); c.P(x, 14, K('kon', -2)); c.P(x, 15, K('kon', -2))


prop('water-rim-s', '물 남쪽 가장자리 어두운 띠', 1, 1, other='flat', tags=['하천', '물'],
     rules='하천 물 줄의 맨 아랫줄 전체에 가로로 이어 찍는다(투명 덧그림).')(water_rim_s)



def bridge_joint(c):
    """다리 상판 신축 이음: 가로 어두운 줄 + 밝은 줄(아스팔트 위 투명 덧그림), 양 가장자리 돌 연석 한 점."""
    c.HL(0, 7, 16, K('sumi', 1)); c.HL(0, 8, 16, K('conc', 1))


prop('bridge-joint', '다리 상판 신축 이음', 1, 1, other='flat', tags=['다리', '노면'],
     rules='다리 상판 길 칸(난간 사이)에 가로로 이어 찍는다. 상판 양끝과 가운데에 한 줄씩.')(bridge_joint)



def bridge_plank(c):
    """다리 상판 널(남북 다리: 널을 동서로 깐 가로줄): 4px 널 하나씩, 위쪽 밝은 줄·아래 어두운 틈, 엇갈린 이음, 못 머리."""
    for y0 in range(0, 16, 4):
        k = y0 // 4
        c.R(0, y0, 16, 4, K('ita', 0)); c.HL(0, y0, 16, K('ita', 1)); c.HL(0, y0 + 3, 16, K('ita', -2))
        jx = (k * 7 + 3) % 16
        c.VL(jx, y0 + 1, 2, K('ita', -2))
        c.P(2, y0 + 1, K('tekko', -1)); c.P(13, y0 + 1, K('tekko', -1))
        for x in range(16):
            if (x * 5 + k * 9) % 13 == 0: c.P(x, y0 + 2, K('ita', -1))


prop('bridge-plank', '다리 상판 널(남북 다리)', 1, 1, other='flat', tags=['다리', '노면', '목재'],
     rules='남북 다리 상판 칸(난간 사이)을 위아래로 이어 채운다(위 칸과 이어짐). 거리 아스팔트 위에 덮는다.')(bridge_plank)



def bank_mid(c):
    """건너편 석축 가운데 단: 줄눈 돌 16px 전부."""
    _stone_rows(c, 0, 16, 5)


prop('bank-mid', '건너편 석축 가운데 단', 1, 1, other='flat', tags=['하천', '둑'], rules='bank-lip 아래, bank-slope 위.')(bank_mid)


def bank_slope(c):
    """석축 아랫단: 돌 6px(가장 밝은 갓돌 줄 포함) 위에 풀 비탈 10px — 물에서 올라가 풀밭으로 이어짐."""
    c.HL(0, 0, 16, K('conc', 3))
    _stone_rows(c, 1, 6, 8)
    c.HL(0, 6, 16, K('sumi', 1))
    for y in range(7, 16):
        c.HL(0, y, 16, K('midori', -1) if y < 12 else K('midori', 0))
        for x in range(16):
            v = (x * 5 + y * 9) % 10
            if v == 0: c.P(x, y, K('midori', 2))
            elif v == 4: c.P(x, y, K('midori', -1))


prop('bank-slope', '풀 비탈 둘째 줄(어두운 풀+흙 가장자리)', 1, 1, other='flat', tags=['하천', '둑'],
     rules='bank-lip 바로 아랫줄에 가로로 이어 찍는다(불투명).')(bank_slope)


# ─────────────────────────── 철도 구간 (2026-10-13: 일본 도시의 척추 — 지상 선로 + 건널목) ───────────────────────────
def rail_h(c):
    """지상 선로 한 줄 1×4칸(64px): 자갈 도상 + 침목(세로 2px, 8px 간격) + 레일 둘(윗면 밝음·몸·밑그림자). 칸 폭 16 로 이어 붙인다."""
    c.R(0, 0, 16, 64, K('conc', -2))
    for x in range(16):
        for y in range(0, 64):
            v = (x * 7 + y * 13) % 11
            if v == 0: c.P(x, y, K('conc', 0))
            elif v == 5: c.P(x, y, K('conc', -3))
    for x0 in (2, 10):
        c.R(x0, 12, 3, 40, K('ita', -2)); c.VL(x0, 12, 40, K('ita', -1))
    for ry in (19, 42):
        c.HL(0, ry, 16, K('tekko', 3)); c.HL(0, ry + 1, 16, K('tekko', 1)); c.HL(0, ry + 2, 16, K('tekko', -1)); c.HL(0, ry + 3, 16, K('sumi', 1))


prop('rail-h', '지상 선로(자갈 도상+침목+레일, 1×4)', 1, 4, solid=[(0, 1), (0, 2)], tags=['철도', '선로'], rules='가로로 쭉 이어 찍는다. 철도 띠 4줄을 통째로 덮는다.')(rail_h)


def rail_xing(c):
    """건널목 판 1×4: 콘크리트 패널이 레일 사이를 메운 노면(길 아스팔트와 이어짐)."""
    c.R(0, 0, 16, 64, K('conc', 0))
    for y in range(64):
        if y % 16 == 15: c.HL(0, y, 16, K('conc', -2))
    for ry in (19, 42):
        c.HL(0, ry, 16, K('tekko', 3)); c.HL(0, ry + 1, 16, K('tekko', 1)); c.HL(0, ry + 2, 16, K('tekko', -1)); c.HL(0, ry + 3, 16, K('sumi', 1))
    c.VL(0, 0, 64, K('conc', 2)); c.VL(15, 0, 64, K('conc', -2))
    for y in range(4, 64, 8): c.P(7, y, K('sumi', 1)); c.P(8, y, K('conc', 2))


prop('rail-xing', '건널목 노면 판(1×4)', 1, 4, other='flat', tags=['철도', '건널목'], rules='선로 띠를 가로지르는 도로 폭 칸마다 선로 위에 덮어 찍는다.')(rail_xing)


def rail_fence(c):
    """선로 옆 콘크리트 방호벽 1칸: 밝은 직사각 윗면 8줄 + 어두운 앞면 5줄 + 밑 풀."""
    box_top(c, 0, 1, 16, 9, 'ita', 2)
    c.R(0, 10, 16, 4, K('conc', -3)); c.HL(0, 13, 16, K('sumi', 1))
    for x in (3, 11): c.R(x, 11, 2, 1, K('kii', 1))
    c.HL(0, 14, 16, OL); c.HL(0, 15, 16, K('midori', -1))


prop('rail-fence', '선로 콘크리트 방호벽', 1, 1, solid=[(0, 0)], tags=['철도', '울타리'], rules='선로 띠 위·아래 줄에 가로로 이어 찍는다(건널목 칸은 비운다).')(rail_fence)


def rail_signal(c):
    """건널목 경보기 1×3: 계전기 상자(윗면 8줄 결 있는 콘크리트 덮개 + 앞면 문) 위에 줄무늬 기둥과 붉은 등 둘 달린 가로 등보가 선 모양."""
    # 등보(앞면, 위쪽): 붉은 등 둘 + 흰 십자 표지
    box_top(c, 0, 1, 16, 4, 'ita', 2, ends=(True, True))                                                    # 등보 윗면(직사각 판)
    c.R(0, 5, 16, 5, K('kii', -1)); c.HL(0, 5, 16, K('kii', 2)); c.HL(1, 9, 14, K('kii', -2))
    c.VL(0, 5, 5, OL); c.VL(15, 5, 5, OL); c.HL(0, 10, 16, OL)
    for x in (2, 10):
        c.R(x, 6, 4, 3, K('sumi', 1)); c.R(x + 1, 6, 2, 2, K('aka', 1)); c.P(x + 1, 6, K('aka', 3))
    c.R(7, 6, 2, 3, K('shiro', 1))
    # 기둥
    for y in range(11, 25):
        c.R(6, y, 4, 1, K('kii', 1) if (y // 3) % 2 else K('tekko', 0)); c.P(5, y, OL); c.P(10, y, OL); c.P(6, y, K('tekko', 2)); c.P(9, y, K('tekko', -2))
    # 상자 윗면: 뒤 모서리 짙은 선 + 결 있는 8줄 + 앞 모서리 밝은 줄
    c.HL(1, 24, 14, OL); c.HL(0, 25, 16, OL)
    box_top(c, 0, 26, 16, 10, 'ita', 2, ends=(True, True)); c.HL(0, 36, 16, OL)
    c.VL(0, 26, 8, OL); c.VL(15, 26, 8, OL)
    for x, y in ((2, 29), (5, 31), (9, 28), (12, 30), (3, 32), (10, 32), (13, 28)): c.P(x, y, K('conc', 0)); c.P(x + 1, y, K('conc', 0))
    c.R(5, 24, 6, 2, K('conc', -1)); c.HL(5, 25, 6, OL)                                                              # 기둥 받침
    # 상자 앞면
    c.HL(0, 36, 16, OL); c.R(0, 37, 16, 9, K('conc', -2)); c.HL(1, 37, 14, K('conc', 0)); c.HL(1, 45, 14, K('conc', -4))
    c.VL(0, 37, 9, OL); c.VL(15, 37, 9, OL); c.HL(0, 46, 16, OL)
    c.R(3, 38, 10, 6, K('conc', -3)); c.VL(8, 38, 6, OL); c.P(7, 40, K('kii', 2)); c.P(9, 40, K('kii', 2))
    c.HL(1, 47, 14, K('midori', -1))


prop('rail-signal', '건널목 경보기', 1, 3, solid=[(0, 2)], tags=['철도', '건널목', '경보기'], rules='건널목 양쪽 보도 칸에 하나씩.')(rail_signal)


import shopfront_art                                      # noqa: E402
shopfront_art.register(prop)
import rail_art                                          # noqa: E402
rail_art.register(prop)
import lot_art                                           # noqa: E402  빈터 쓰임(코인 주차·놀이터·텃밭·공사장·광장) 키트
lot_art.register(prop)

# 3/4 관문(object-gate)을 통과하지 못해 키트에서 뺀 소품 — 조립기·거리 구성기·마을 시연 지도 어디에도 찍히지 않거나(rail-fence·rail-signal·tsukigime·pole-guy)
# town.mjs 시연 담에서만 쓰였다(bwall*·bwallf-plain/end-r). 얇은 가로 담·펜스는 한 칸(16×16) 안에서 판정자가 정면 입면도로 읽는다(2026-10-13, 3라운드).
_DROPPED = {'rail-fence', 'rail-signal', 'tsukigime', 'pole-guy', 'bwall-plain', 'bwall-sukashi', 'bwall-end-l', 'bwall-end-r',
            'bwallf-plain', 'bwallf-end-l', 'bwallf-end-r'}
P[:] = [q for q in P if q['id'] not in _DROPPED]

NOTES = ('손 도트 거리 소품 %d종(전봇대·전선·커브미러·소화전·버스 정류장·노면 표시·블록 담·대문·카포트·월정 주차 간판·가스통·실외기·화분·빨래 장대·게시판·쓰레기 상자·지장·도리이·주유소 캐노피·학교 정문). '
         '근거 tiledata/jp-city/research/. 전선 키트(jp-wire-*)는 4층 전용 — 3층에 찍으면 지붕을 덮는다. 한계: 전선은 가로·세로 직선 구간만(대각 없음), 밤 조명 없음.')


def build():
    cells, kits, sprites, groups = _finalize()
    return {'cells': collections.OrderedDict((k, dict(v, img=v['img'].copy(), tags=list(v['tags']))) for k, v in cells.items()),
            'autotiles': [], 'groups': [dict(g, cells=list(g['cells'])) for g in groups], 'kits': [dict(k) for k in kits], 'notes': NOTES % len(kits)}


def render_all():
    os.makedirs(OUTDIR, exist_ok=True)
    cells, kits, sprites, groups = _finalize()
    ims = []
    for kit in kits:
        g = kit['grid']; R, C = len(g), len(g[0])
        im = Image.new('RGBA', (C * 16, R * 16), (104, 103, 122, 255))
        for y in range(R):
            for x in range(C):
                if g[y][x]: im.alpha_composite(cells[g[y][x]]['img'], (x * 16, y * 16))
        im.save(os.path.join(OUTDIR, kit['id'] + '.png')); ims.append(im)
        tr = Image.new('RGBA', (C * 16, R * 16), (0, 0, 0, 0))          # 3/4 관문(object-gate)에 내는 투명 배경 사본 — 미리보기 배경색이 판정을 흐리지 않게
        for y in range(R):
            for x in range(C):
                if g[y][x]: tr.alpha_composite(cells[g[y][x]]['img'], (x * 16, y * 16))
        os.makedirs(os.path.join(OUTDIR, '_gate'), exist_ok=True); tr.save(os.path.join(OUTDIR, '_gate', kit['id'] + '.png'))
    W = 1100; x = y = 0; rowh = 0; pos = []
    for im in ims:
        if x + im.width > W: x = 0; y += rowh + 8; rowh = 0
        pos.append((x, y)); x += im.width + 8; rowh = max(rowh, im.height)
    S = Image.new('RGBA', (W, y + rowh), (104, 103, 122, 255))
    for im, p in zip(ims, pos): S.alpha_composite(im, p)
    S.resize((S.width * 2, S.height * 2), Image.NEAREST).save(os.path.join(OUTDIR, '_all-x2.png'))


def selftest(verbose=True, render=True):
    out = []
    b = build(); cells, kits, sprites, groups = _finalize()
    for k, c in b['cells'].items():
        for m in check_cell(c['img']): out.append('(a) %s: %s' % (k, m))
    for kit in kits:
        p = next(q for q in P if 'jp-' + q['id'] == kit['id'])
        a = sprites[p['id']].copy(); a[a[:, :, 3] == 0] = 0
        g = kit['grid']; re_ = np.zeros_like(a)
        for y in range(len(g)):
            for x in range(len(g[0])):
                if g[y][x]: re_[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16] = np.array(b['cells'][g[y][x]]['img'])
        if not (re_ == a).all(): out.append('(b) %s 재조립 불일치' % kit['id'])
        for (sx, sy) in p['solid']:
            if g[sy][sx] is None: out.append('(e) %s 막힘 칸 (%d,%d) 이 비었다' % (kit['id'], sx, sy))
    ids = [k['id'] for k in kits]
    if len(ids) != len(set(ids)): out.append('(e) 키트 id 중복')
    if render: render_all()
    if verbose:
        print('street_hand — 키트 %d · 고유 칸 %d' % (len(kits), len(b['cells'])))
        for m in out: print('  ✗', m)
    return len(out)


if __name__ == '__main__':
    sys.exit(1 if selftest() else 0)
