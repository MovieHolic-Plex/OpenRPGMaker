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


# ─────────────────────────── 전봇대·전선 (조사 02: 지상 약 10m, 위→아래 고압·저압·변압기·통신선, 노랑 검정 표지판) ───────────────────────────
ARM1, ARM2, CABLE = 9, 21, 37          # 전봇대 키트 맨 위에서 고압 완목·저압 완목·통신선 높이(px). 전선 키트가 이 높이에 맞춘다.


def pole_body(c, x, top, bot, mat='conc'):
    """콘크리트 기둥: 위 4px → 아래 6px(굵어진다), 왼쪽 빛, 발판 볼트, 밑동 노랑·검정 표지 12px."""
    for y in range(top, bot):
        t = (y - top) / max(1, bot - top)
        w = 4 + (2 if t > 0.55 else 1 if t > 0.25 else 0)
        x0 = x - w // 2
        c.HL(x0, y, w, K(mat, 0)); c.P(x0, y, K(mat, 2)); c.P(x0 + 1, y, K(mat, 1)); c.P(x0 + w - 1, y, K(mat, -2))
        c.P(x0 - 1, y, OL); c.P(x0 + w, y, OL)
    for y in range(top + 30, bot - 26, 9): c.HL(x + 3, y, 2, K('tekko', -1)); c.HL(x - 5, y + 4, 2, K('tekko', -1))   # 발판 볼트
    for y in range(bot - 14, bot - 2):                                                                             # 호랑이 무늬 표지
        for i in range(-3, 3):
            c.P(x + i, y, K('kii', 1) if ((y + i) // 2) % 2 else K('sumi', 1))
    c.P(x - 4, bot - 1, OL); c.HL(x - 4, bot - 1, 9, K('conc', -2))


def crossarm(c, x0, x1, y, mat='tekko'):
    """완목 2px + 애자(흰 2×3) 4개."""
    c.HL(x0, y, x1 - x0, K(mat, 1)); c.HL(x0, y + 1, x1 - x0, K(mat, -2)); c.HL(x0, y - 1, x1 - x0, OL); c.HL(x0, y + 2, x1 - x0, OL)
    for ix in (x0 + 2, x0 + (x1 - x0) // 3, x0 + 2 * (x1 - x0) // 3, x1 - 4):
        c.R(ix, y - 4, 2, 3, K('shiro', 2)); c.P(ix + 1, y - 3, K('shiro', 0))


def transformer(c, x, y):
    """변압기 원통 9×15(회색, 위 뚜껑, 왼쪽 빛) + 걸쇠."""
    c.R(x, y, 9, 15, K('tekko', 1)); c.VL(x, y, 15, K('tekko', 3)); c.VL(x + 1, y, 15, K('tekko', 2)); c.VL(x + 8, y, 15, K('tekko', -1))
    c.HL(x, y, 9, K('tekko', 3)); c.HL(x - 1, y - 1, 11, K('tekko', 0)); c.HL(x, y + 15, 9, K('tekko', -2))
    for j in (y + 4, y + 10): c.HL(x, j, 9, K('tekko', 0))
    c.VL(x - 1, y, 16, OL); c.VL(x + 9, y, 16, OL); c.HL(x - 1, y + 16, 11, OL)


@prop('pole', '전봇대(콘크리트·변압기)', 3, 10, solid=[(1, 9)], tags=['전봇대', '전선', '가로 시설'],
      rules='생활도로 길가(보도 없는 길은 길 칸 안쪽 가장자리)에 25~35칸마다 하나. 완목이 키트 폭 전체(3칸)라 전선 키트가 양옆 칸 경계에서 이어진다.')
def _pole(c):
    pole_body(c, 24, 4, 160)
    crossarm(c, 0, 48, ARM1); crossarm(c, 4, 44, ARM2)
    transformer(c, 30, ARM2 + 5); c.HL(27, ARM2 + 8, 3, K('tekko', -1))
    c.R(18, CABLE - 2, 5, 6, K('tekko', -1)); c.HL(18, CABLE - 2, 5, K('tekko', 1))                                # 통신선 단자함
    c.R(25, 50, 6, 10, K('shiro', 1)); c.HL(25, 50, 6, K('shiro', 2)); c.HL(26, 53, 4, K('sora', 0)); c.HL(26, 56, 3, K('sumi', 2))  # 번호판


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
    pole_body(c, 24, 6, 144, 'ita')
    crossarm(c, 2, 46, ARM1 + 2, 'ita')
    c.R(28, 30, 7, 9, K('tekko', 0)); c.HL(28, 30, 7, K('tekko', 2)); c.VL(35, 30, 9, OL)                          # 통신 단자
    c.R(19, 60, 10, 14, K('shiro', 1)); c.R(20, 62, 8, 4, K('aka', 0)); c.HL(20, 68, 8, K('sumi', 2)); c.HL(20, 70, 6, K('sumi', 2))   # 옛 광고판


WIRE_BOTTOM = 46        # 키트 높이 3칸(48px) 안 — 처짐이 이보다 내려가면 잘려 끊긴 조각이 된다(2026-10-07 학교 관문 지적)


def wire(c, x0, x1, y0, y1, sag, col):
    """두 점 사이 처진 전선. 처짐은 키트 바닥(WIRE_BOTTOM)을 넘지 않게 줄이고, 이웃 화소 사이 세로 틈은 메워 끊기지 않게 한다."""
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
            for yo in (ARM1 - 4, ARM1 - 3):                                                         # 고압 2가닥(애자 높이)
                wire(c, 0, W - 1, yo, yo, s * 0.6, K('sumi', 1))
            wire(c, 0, W - 1, ARM2 - 4, ARM2 - 4, s * 0.8, K('sumi', 1))                             # 저압
            wire(c, 0, W - 1, CABLE, CABLE, s * 1.2, K('sumi', 0)); wire(c, 0, W - 1, CABLE + 1, CABLE + 1, s * 1.2, K('sumi', 1))   # 통신선(굵음)
        return _w
    _mk(_L)


for _L in (6, 8, 10):
    def _mkv(L):
        @prop(f'wire-v{L}', f'전선(세로, 남북 {L}칸)', 3, L, tags=['전선', '4층'],
              rules=f'같은 x 에 {L}칸 떨어진 두 전봇대(위쪽 전봇대 y = Y) 사이: 위쪽 전봇대와 같은 x, y = Y 에 **4층**으로 찍는다. 아래쪽 전봇대 팔에서 끝난다.')
        def _w(c):
            H = L * 16
            for xo, col in ((2, K('sumi', 1)), (45, K('sumi', 1)), (8, K('sumi', 1)), (40, K('sumi', 1))):
                c.VL(xo, ARM1 - 3 if xo in (2, 45) else ARM2 - 3, H, col)
            c.VL(28, CABLE + 2, H - 2, K('sumi', 0)); c.VL(29, CABLE + 2, H - 2, K('sumi', 1))
        return _w
    _mkv(_L)


# ─────────────────────────── 길가 표지 ───────────────────────────
@prop('mirror2', '커브미러(주황, 둘)', 2, 3, solid=[(0, 2)], tags=['커브미러', '교차로', '가로 시설'],
      rules='보이지 않는 모퉁이(T자·十자 생활도로) 길가. 지주와 테두리는 주황이 표준(조사 02).')
def _mirror(c):
    o = 'daidai'
    c.R(7, 12, 3, 36, K(o, 0)); c.VL(7, 12, 36, K(o, 2)); c.VL(9, 12, 36, K(o, -2)); c.VL(6, 12, 36, OL); c.VL(10, 12, 36, OL)
    c.HL(4, 14, 22, K(o, -1)); c.HL(4, 13, 22, OL)
    for cx, cy in ((7, 8), (22, 9)):
        for j in range(-7, 8):
            for i in range(-7, 8):
                d = i * i + j * j
                if d <= 49: c.P(cx + i, cy + j, OL if d > 36 else K(o, 1) if d > 25 else K('garasu', 1) if (i + j) < 0 else K('garasu', -1))
        c.P(cx - 2, cy - 2, K('garasu', 3)); c.P(cx - 1, cy - 3, K('garasu', 3))
    shadow(c, 3, 46, 10)


@prop('hydrant-sign', '소화전 표지(빨강 원판)', 1, 3, solid=[(0, 2)], tags=['소화전', '가로 시설'],
      rules='길가 전봇대·담 곁. 빨간 기둥 위 빨간 원판.')
def _hydrant(c):
    c.R(7, 12, 2, 36, K('aka', 0)); c.VL(7, 12, 36, K('aka', 2)); c.VL(6, 12, 36, OL); c.VL(9, 12, 36, OL)
    for j in range(-6, 7):
        for i in range(-6, 7):
            d = i * i + j * j
            if d <= 36: c.P(8 + i, 7 + j, OL if d > 25 else K('aka', 1) if d > 9 else K('shiro', 2))
    c.HL(6, 7, 5, K('aka', 0)); shadow(c, 4, 46, 8)


@prop('bus-stop', 'バス停 버스 정류장 표지', 1, 3, solid=[(0, 2)], tags=['버스', '정류장', '가로 시설'],
      rules='간선·역 앞 보도 가장자리. 둥근 표지판 + 시간표 판 + 무거운 받침.')
def _bus(c):
    c.R(7, 10, 2, 32, K('tekko', 1)); c.VL(6, 10, 32, OL); c.VL(9, 10, 32, OL)
    for j in range(-6, 7):
        for i in range(-6, 7):
            d = i * i + j * j
            if d <= 36: c.P(8 + i, 6 + j, OL if d > 25 else K('kon', 0) if d > 12 else K('shiro', 2))
    c.R(3, 20, 10, 12, K('shiro', 2)); c.HL(3, 20, 10, K('kon', 0))
    for j in (23, 25, 27, 29): c.HL(4, j, 7, K('sumi', 2))
    c.VL(2, 20, 12, OL); c.VL(13, 20, 12, OL); c.HL(2, 32, 12, OL)
    c.R(3, 42, 10, 5, K('conc', 0)); c.HL(3, 42, 10, K('conc', 2)); c.HL(2, 47, 12, OL); shadow(c, 2, 47, 12)


# ─────────────────────────── 노면 표시(flat, 캐릭터 밑) ───────────────────────────
@prop('mark-30', '노면 「30」 주황(세로로 긴 규제 표시)', 2, 4, other='flat', tags=['노면', '속도', '생활도로'],
      rules='생활도로 차선 한가운데. 남→북으로 달리는 차가 읽는 방향(글자 아래가 남쪽). 가로 1.2m × 세로 5m 라 아주 길쭉하다.')
def _m30(c):
    o = K('daidai', 1); d = K('daidai', 0)
    # 3: 폭 12, 높이 56  /  0: 폭 12
    def seg(x, y, w, h): c.R(x, y, w, h, o); c.HL(x, y + h - 1, w, d)
    x = 3
    seg(x, 4, 12, 3); seg(x + 9, 4, 3, 28); seg(x + 2, 29, 10, 3); seg(x + 9, 30, 3, 28); seg(x, 55, 12, 3)
    x = 18
    seg(x, 4, 12, 3); seg(x, 4, 3, 54); seg(x + 9, 4, 3, 54); seg(x, 55, 12, 3)


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
    c.R(4, 6, 8, 5, K('tekko', -1)); c.HL(4, 6, 8, K('kii', 1)); c.HL(4, 7, 8, K('kii', -1)); c.HL(4, 10, 8, K('tekko', -3))
    c.P(7, 8, K('tekko', 2)); c.P(8, 8, K('tekko', 2))


# ─────────────────────────── 블록 담·대문·카포트 (조사 02·03: 블록 한 단 20cm, 보통 1.2m 이하 + 위 펜스) ───────────────────────────
def block_wall(c, x, y, w, sukashi=(), cap=True, end_l=False, end_r=False):
    """블록 담 높이 14px(6단 + 갓돌 2): 단마다 가로 줄눈, 엇갈린 세로 줄눈, 투각 블록(꽃 모양 구멍)."""
    c.R(x, y, w, 14, K('conc', 1))
    for j in range(y + 4, y + 14, 2): c.HL(x, j, w, K('conc', -1))
    for k, j in enumerate(range(y + 2, y + 14, 2)):
        for i in range(x + (0 if k % 2 else 4), x + w, 8): c.VL(i, j, 2, K('conc', -1))
    for sx in sukashi:
        c.R(sx, y + 6, 7, 5, K('conc', -2)); c.P(sx + 3, y + 7, K('conc', 1)); c.HL(sx + 2, y + 8, 3, K('conc', 1)); c.P(sx + 3, y + 9, K('conc', 1))
    if cap: c.R(x, y, w, 2, K('conc', 2)); c.HL(x, y, w, K('conc', 3)); c.HL(x, y + 2, w, K('conc', -2))
    c.HL(x, y + 13, w, K('conc', -2))
    if end_l: c.VL(x, y, 14, K('conc', 2)); c.VL(x - 1, y, 14, OL)
    if end_r: c.VL(x + w - 1, y, 14, K('conc', -2)); c.VL(x + w, y, 14, OL)
    c.HL(x, y - 1, w, OL); c.HL(x, y + 14, w, OL)


def fence_top(c, x, y, w, h=11):
    """블록 위 알루미늄 가림 펜스(세로 살, 갈색)."""
    c.R(x, y, w, h, K('ita', -1)); c.HL(x, y, w, K('ita', 1))
    for i in range(x + 1, x + w, 3): c.VL(i, y + 1, h - 1, K('ita', 0))
    c.HL(x, y - 1, w, OL)


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
    c.R(2, 3, 12, 13, K('tairu', 1)); c.R(1, 1, 14, 2, K('conc', 2)); c.HL(1, 1, 14, K('conc', 3)); c.VL(2, 3, 13, K('tairu', 2)); c.VL(13, 3, 13, K('tairu', -2))
    c.R(4, 4, 8, 3, K('ita', 1)); c.HL(5, 5, 6, K('sumi', 2))                     # 표찰
    c.R(4, 8, 3, 3, K('tekko', 0)); c.P(5, 9, K('sora', 1))                         # 인터폰
    c.R(8, 9, 5, 5, K('tekko', 2)); c.HL(9, 10, 3, K('tekko', -2))                   # 우편함
    c.VL(0, 1, 15, OL); c.VL(15, 1, 15, OL); c.HL(0, 0, 16, OL); c.HL(1, 15, 14, K('conc', -2))


@prop('gate', '門扉 알루미늄 대문(두 칸)', 2, 1, solid=[(0, 0), (1, 0)], tags=['대문', '주택가'],
      rules='gatepost 옆 2칸. 닫힌 대문이라 막힘 — 들어가는 길이 필요하면 대신 비워 둔다.')
def _gate(c):
    for x0 in (1, 16):
        c.R(x0, 3, 15, 12, K('ita', -1)); c.HL(x0, 3, 15, K('ita', 1)); c.HL(x0, 14, 15, K('ita', -2))
        for i in range(x0 + 2, x0 + 14, 3): c.VL(i, 4, 10, K('ita', 1))
        c.VL(x0, 3, 12, OL); c.VL(x0 + 15, 3, 12, OL); c.HL(x0, 2, 16, OL)


@prop('carport', 'カーポート 알루미늄 카포트', 4, 3, solid=[(0, 2), (3, 2)], tags=['카포트', '주차', '주택가'],
      rules='교외 집 앞마당(길과 집 사이 4×3칸). 지붕 밑은 지나갈 수 있다 — 차 소품(jp-prop-car-*)은 지붕 밑 줄에 둔다. 앞 기둥 둘만 막힘.')
def _carport(c):
    W = 64
    c.R(0, 8, W, 12, K('garasu', 3))                                                     # 폴리카보 지붕 윗면(밝은 유리 단)
    for i in range(0, W, 12): c.VL(i, 8, 12, K('tekko', 1))
    for k in range(8): c.P(6 + k * 7, 18 - (k % 3) * 3, K('shiro', 2))
    c.HL(0, 8, W, K('ita', 1)); c.R(0, 20, W, 3, K('ita', 0)); c.HL(0, 20, W, K('ita', 1)); c.HL(0, 22, W, K('ita', -2))   # 앞 보(브론즈)
    c.HL(0, 7, W, OL); c.HL(0, 23, W, OL); c.VL(-1, 7, 17, OL); c.VL(W, 7, 17, OL)
    for px in (4, W - 8):
        c.R(px, 23, 4, 24, K('ita', 0)); c.VL(px, 23, 24, K('ita', 2)); c.VL(px + 3, 23, 24, K('ita', -2)); c.VL(px - 1, 23, 24, OL); c.VL(px + 4, 23, 24, OL)
    for i in range(0, W): c.P(i, 23 + 1, K('yoru', -2)) if i % 2 else None


@prop('tsukigime', '月極駐車場 간판(空あり)', 2, 2, solid=[(0, 1), (1, 1)], tags=['주차', '月極', '간판'],
      rules='월정 주차장 길 쪽 모퉁이. 주차 칸 선은 기존 주차 바닥 칸을 쓴다.')
def _tsuki(c):
    c.R(2, 4, 28, 18, K('shiro', 2)); c.HL(2, 4, 28, K('kon', 0)); c.HL(2, 5, 28, K('kon', 0))
    c.R(4, 8, 10, 10, K('kon', 0)); c.R(6, 9, 3, 8, K('shiro', 2)); c.R(8, 9, 4, 4, K('shiro', 2)); c.R(9, 10, 2, 2, K('kon', 0))   # P
    for j in (9, 12, 15): c.HL(16, j, 12, K('sumi', 2))
    c.R(4, 19, 24, 2, K('aka', 0))                                                    # 空あり 띠
    c.VL(1, 3, 20, OL); c.VL(30, 3, 20, OL); c.HL(1, 3, 30, OL); c.HL(1, 22, 30, OL)
    for px in (6, 24): c.R(px, 23, 2, 22, K('tekko', 1)); c.VL(px - 1, 23, 22, OL); c.VL(px + 2, 23, 22, OL)
    shadow(c, 3, 45, 26)


# ─────────────────────────── 생활 소품 ───────────────────────────
@prop('propane', 'プロパン 가스통 두 개', 1, 2, solid=[(0, 1)], tags=['가스', '생활', '주택가'],
      rules='도시가스가 없는 동네의 집 옆벽 앞(건물 키트 바로 아래 줄 옆 칸).')
def _propane(c):
    for x0 in (1, 8):
        c.R(x0, 10, 7, 20, K('shiro', 1)); c.VL(x0, 10, 20, K('shiro', 2)); c.VL(x0 + 6, 10, 20, K('tekko', 1))
        c.R(x0 + 1, 7, 5, 3, K('tekko', 1)); c.R(x0 + 2, 5, 3, 2, K('tekko', -1))
        c.HL(x0, 15, 7, K('sumi', 1)); c.HL(x0, 25, 7, K('sumi', 1))              # 쇠사슬 2줄
        c.VL(x0 - 1, 7, 23, OL); c.VL(x0 + 7, 7, 23, OL)
    c.HL(0, 30, 16, OL); shadow(c, 1, 30, 14)


@prop('ac-unit', '에어컨 실외기', 1, 1, solid=[(0, 0)], tags=['실외기', '생활'],
      rules='집·가게 옆벽 앞이나 골목.')
def _ac(c):
    HK.ac_unit(c, 1, 5)


@prop('pots', '화분 줄(下町)', 2, 1, solid=[], tags=['화분', '下町', '생활'],
      rules='下町 골목의 집 앞·담 위. 마당이 없는 집 앞을 화분으로 채운다(조사 02). 지나갈 수 있다.')
def _pots(c):
    cols = (('midori', 1), ('aka', 1), ('midori', 2), ('kii', 2), ('pinku', 2))
    for k, x0 in enumerate((1, 8, 15, 22)):
        h = 6 + (k % 3) * 2
        c.R(x0, 16 - 5, 6, 5, K('renga', 0)); c.HL(x0, 11, 6, K('renga', 2)); c.VL(x0 + 5, 11, 5, K('renga', -2))
        m, t = cols[k % len(cols)]
        for j in range(h):
            w = 2 + (j % 3)
            c.HL(x0 + 3 - w // 2, 11 - h + j, w, K('ki', 1 - (j % 2)))
        c.P(x0 + 2, 11 - h, K(m, t)); c.P(x0 + 4, 11 - h + 2, K(m, t))
        c.VL(x0 - 1, 11, 5, OL)


@prop('monohoshi', '物干し 빨래 장대(마당)', 3, 2, solid=[(0, 1), (2, 1)], tags=['빨래', '생활', '주택가'],
      rules='집 앞마당이나 아파트 1층 앞. 양 끝 받침만 막힘.')
def _monohoshi(c):
    for px in (5, 41):
        c.R(px, 6, 2, 24, K('tekko', 2)); c.HL(px - 3, 6, 8, K('tekko', 1)); c.R(px - 3, 28, 8, 2, K('tekko', 0)); c.VL(px - 1, 6, 24, OL)
    c.HL(2, 8, 44, K('shiro', 2)); c.HL(2, 9, 44, K('tekko', 0))
    clothes = (('sora', 1, 8, 10), ('shiro', 2, 7, 12), ('pinku', 2, 6, 9), ('kii', 2, 8, 11), ('midori', 1, 6, 8))
    x = 7
    for m, t, w, h in clothes:
        c.R(x, 10, w, h, K(m, t)); c.HL(x, 10, w, K(m, t + 1)); c.VL(x + w - 1, 10, h, K(m, t - 1)); c.HL(x, 10 + h, w, K(m, t - 2))
        x += w + 1
    shadow(c, 2, 30, 44)


@prop('keijiban', '町内会 掲示板', 2, 2, solid=[(0, 1), (1, 1)], tags=['게시판', '町内会', '생활'],
      rules='골목 모퉁이·공원 입구·신사 앞. 다리 둘, 차양, 유리 안 종이.')
def _board(c):
    c.R(1, 4, 30, 3, K('ita', -1)); c.HL(1, 4, 30, K('ita', 1))                           # 차양
    c.R(2, 7, 28, 16, K('tekko', 2)); c.R(3, 8, 26, 14, K('kinari', 1))
    for x0, y0, w, h, m in ((4, 9, 7, 9, 'shiro'), (12, 9, 8, 6, 'kii'), (21, 10, 7, 10, 'shiro'), (12, 16, 7, 5, 'pinku')):
        c.R(x0, y0, w, h, K(m, 2)); c.HL(x0 + 1, y0 + 2, w - 2, K('sumi', 2)); c.HL(x0 + 1, y0 + 4, w - 3, K('sumi', 2))
    c.VL(1, 4, 20, OL); c.VL(30, 4, 20, OL); c.HL(0, 3, 32, OL); c.HL(1, 23, 30, OL)
    for px in (6, 24): c.R(px, 24, 2, 21, K('tekko', 1)); c.VL(px - 1, 24, 21, OL); c.VL(px + 2, 24, 21, OL)
    shadow(c, 3, 45, 26)


@prop('gomi-box', 'ゴミ集積所 접이식 철망 상자', 2, 1, solid=[(0, 0), (1, 0)], tags=['쓰레기', '생활', '주택가'],
      rules='골목 길가(전봇대 곁). 녹색 철망 상자 + 자치회 명패.')
def _gomi(c):
    c.R(1, 3, 30, 12, K('midori', -1)); c.HL(1, 3, 30, K('midori', 1))
    for i in range(2, 31, 3): c.VL(i, 4, 10, K('midori', 0))
    for j in range(5, 14, 3): c.HL(2, j, 28, K('midori', 0))
    c.R(11, 6, 10, 5, K('shiro', 2)); c.HL(12, 8, 8, K('sumi', 2))
    c.VL(0, 3, 12, OL); c.VL(31, 3, 12, OL); c.HL(0, 2, 32, OL); c.HL(0, 15, 32, OL)


@prop('jizo', 'お地蔵さん 길가 祠', 1, 2, solid=[(0, 1)], tags=['지장', '祠', '골목'],
      rules='골목 모퉁이·담 곁. 빨간 턱받이와 모자를 쓴 돌 지장 + 작은 나무 사당.')
def _jizo(c):
    c.R(1, 8, 14, 3, K('ita', -1)); c.HL(1, 8, 14, K('ita', 1)); c.HL(0, 7, 16, OL)          # 지붕
    c.R(2, 11, 12, 18, K('ita', -2)); c.VL(2, 11, 18, K('ita', 0)); c.VL(13, 11, 18, K('ita', 0))
    c.R(5, 14, 6, 6, K('conc', 1)); c.R(5, 14, 6, 2, K('aka', 0))                            # 머리 + 모자
    c.R(4, 20, 8, 3, K('aka', 1)); c.R(5, 23, 6, 5, K('conc', 0)); c.VL(5, 20, 8, K('conc', 2))
    c.P(6, 17, K('sumi', 1)); c.P(9, 17, K('sumi', 1))
    c.R(1, 28, 14, 3, K('conc', 1)); c.HL(1, 28, 14, K('conc', 2))
    c.VL(1, 11, 18, OL); c.VL(14, 11, 18, OL); c.HL(0, 31, 16, OL)


@prop('torii', '鳥居 주홍 도리이', 4, 3, solid=[(0, 2), (3, 2)], tags=['신사', '도리이'],
      rules='신사 참배길 입구. 가운데 두 칸이 걸어 지나가는 길이다(기둥 두 칸만 막힘). 뒤쪽(북쪽)에 참배길·拝殿.')
def _torii(c):
    v = 'aka'
    c.R(0, 4, 64, 4, K('sumi', 1)); c.HL(0, 4, 64, K('sumi', 2))                             # 笠木(검은 윗면)
    c.R(2, 8, 60, 4, K(v, 0)); c.HL(2, 8, 60, K(v, 2)); c.HL(2, 11, 60, K(v, -2))          # 島木
    c.P(0, 3, OL); c.P(63, 3, OL); c.HL(0, 3, 64, OL); c.HL(1, 12, 62, OL)
    c.R(29, 12, 6, 6, K(v, 0)); c.VL(29, 12, 6, OL); c.VL(34, 12, 6, OL)                    # 額束
    c.R(4, 18, 56, 3, K(v, 0)); c.HL(4, 18, 56, K(v, 2)); c.HL(4, 20, 56, K(v, -2)); c.HL(4, 17, 56, OL); c.HL(4, 21, 56, OL)   # 貫
    for px in (6, 52):
        c.R(px, 12, 6, 34, K(v, 0)); c.VL(px, 12, 34, K(v, 2)); c.VL(px + 5, 12, 34, K(v, -2)); c.VL(px - 1, 12, 34, OL); c.VL(px + 6, 12, 34, OL)
        c.R(px - 1, 42, 8, 4, K('sumi', 1))                                                 # 根巻
    shadow(c, 4, 46, 12); shadow(c, 50, 46, 12)


@prop('gas-canopy', '給油所 캐노피 + 주유기 둘', 7, 4, solid=[(1, 3), (5, 3), (2, 3), (4, 3)], tags=['주유소', '캐노피'],
      rules='간선 길가. 캐노피 밑(위 세 줄)은 차가 들어가는 바닥이다. 주유기 섬 두 개와 기둥이 맨 아래 줄을 막는다. 뒤(북쪽)에 給油所 사무소(jp-bldg-gas-office).')
def _gas(c):
    W = 112
    c.R(0, 2, W, 10, K('shiro', 1)); c.HL(0, 2, W, K('shiro', 2))                             # 캐노피 윗면
    c.R(0, 12, W, 6, K('aka', 0)); c.HL(0, 12, W, K('aka', 1)); c.HL(0, 17, W, K('aka', -2)); c.HL(0, 15, W, K('shiro', 2))   # 앞 띠
    c.HL(0, 1, W, OL); c.HL(0, 18, W, OL); c.VL(-1, 1, 18, OL); c.VL(W, 1, 18, OL)
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
        c.R(px, 6, 12, 26, K('conc', 1)); c.HL(px, 6, 12, K('conc', 3)); c.VL(px, 6, 26, K('conc', 2)); c.VL(px + 11, 6, 26, K('conc', -2))
        c.VL(px - 1, 6, 26, OL); c.VL(px + 12, 6, 26, OL); c.HL(px - 1, 5, 14, OL)
    c.R(4, 9, 8, 20, K('ita', 1)); c.VL(5, 10, 18, K('sumi', 2)); c.VL(9, 12, 14, K('sumi', 2))    # 교명판(세로 글 줄)
    for x0 in (14, 66):                                                                       # 접힌 미닫이 문
        c.R(x0, 16, 16, 14, K('tekko', 2))
        for i in range(x0 + 1, x0 + 16, 3): c.VL(i, 17, 12, K('tekko', 0))
        c.HL(x0, 16, 16, K('tekko', 3)); c.VL(x0 + 15, 16, 14, OL)
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
