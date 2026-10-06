"""jp_city 블록 — 노면전차·지하철 거리(transit_street).

바닥 그림(ground) 은 1층(키트 base: floor·solidfloor), 서 있는 것(draw) 은 3층(키트 grid: solid·star).
레일은 투명 덧그림(flat, 2층) — 아스팔트 위에 얹는다. 가선(jp-tram-wire-h)은 4층 용 덧그림이다.
시점: 3/4 정면(윗면+남쪽 앞면), 빛은 왼쪽 위. 색은 modern3 램프만(K), 외곽선 sumi(OL).
사람·상표·실제 회사 도색 없음. 글자는 glyphs.json 의 글자만(さくら町·地下鉄), 노선 기호는 무늬로.

  python3 scripts/content/jp-city/blocks/transit_street.py   # selftest + 점검 그림
"""
import os, sys, collections
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..')); sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '..', 'houses'))
import numpy as np
from PIL import Image
from lib_blocks_lines.core import check_cell, ROOT
import shop_parts as SP
from house_kit import K, OL, Cv

BLOCK = 'transit_street'
OUTDIR = os.path.join(ROOT, 'tiledata', 'jp-city', 'blocks', 'transit_street')
P = []

def prop(id_, name, w, h, solid=(), other='star', tags=(), rules='', ground=None, ground_solid=(), role='prop', repeat=None):
    def deco(fn):
        P.append(dict(id=id_, name=name, w=w, h=h, draw=fn, solid=list(solid), other=other, tags=list(tags), rules=rules,
                      ground=ground, ground_solid=list(ground_solid), role=role, repeat=repeat)); return fn
    return deco

# ── 공용 바탕 ───────────────────────────────────────────────
def asphalt(c, x, y, w, h):
    """아스팔트(점 무늬는 세계 좌표 고정 — 칸을 이어 붙여도 이음매가 없다)."""
    for j in range(h):
        for i in range(w):
            X, Y = x + i, y + j
            col = K('yoru', -1)
            if (X * 7 + Y * 13) % 19 == 0: col = K('yoru', 0)
            elif (X * 11 + Y * 5) % 23 == 0: col = K('yoru', -2)
            c.P(X, Y, col)

def hodo(c, x, y, w, h):
    """보도 판석 8px."""
    for j in range(h):
        for i in range(w):
            X, Y = x + i, y + j
            u, v = X % 8, Y % 8
            col = K('hodo', 0)
            if u == 7 or v == 7: col = K('hodo', -1)
            elif u == 0 or v == 0: col = K('hodo', 1)
            c.P(X, Y, col)

def box(c, x, y, w, h, col):
    c.HL(x, y, w, OL); c.HL(x, y + h - 1, w, OL); c.VL(x, y, h, OL); c.VL(x + w - 1, y, h, OL)
    if col is not None: c.R(x + 1, y + 1, w - 2, h - 2, col)

def post_v(c, x, y0, y1, m='tekko'):
    """2px 기둥: 왼쪽 밝음·오른쪽 어둠 + 양옆 외곽선."""
    c.VL(x - 1, y0, y1 - y0 + 1, OL); c.VL(x + 2, y0, y1 - y0 + 1, OL)
    c.VL(x, y0, y1 - y0 + 1, K(m, 1)); c.VL(x + 1, y0, y1 - y0 + 1, K(m, -1))

# ── 레일 ────────────────────────────────────────────────────
RAIL_A, RAIL_B = 5, 27            # 궤간 22px

def _rail_profile(along):
    """레일 단면(띠 가로질러). 바깥 매립 콘크리트 + 1px 밝은 금속 윗면 + 1px 어두운 홈 + 홈 그늘."""
    hi = K('tekko', 3) if along % 16 != 6 else K('shiro', 1)
    head = [(-3, K('conc', -2)), (-2, K('conc', -1)), (-1, K('tekko', -1)), (0, hi), (1, OL), (2, K('yoru', -2))]
    tail = [(-2, K('yoru', -2)), (-1, OL), (0, hi), (1, K('tekko', -1)), (2, K('conc', -1)), (3, K('conc', -2))]
    return [(RAIL_A + d, col) for d, col in head] + [(RAIL_B + d, col) for d, col in tail]

def rail_h(c, x0, x1, oy=0):
    for x in range(x0, x1):
        for y, col in _rail_profile(x): c.P(x, oy + y, col)

@prop('tram-rail-h', '노면전차 레일(가로)', 1, 2, other='flat', role='terrain', repeat='x',
      tags=('노면전차', '레일', '선로', '도로'),
      rules='간선도로 가운데 2칸 띠로 가로로 이어 깐다(복선은 레일 2행 + 사이 1행 + 레일 2행). 아스팔트 위 2층 덧그림(레일 사이는 투명). 정류장 섬은 남쪽 궤도 바로 남쪽.')
def _(c):
    rail_h(c, 0, 16)

@prop('tram-rail-v', '노면전차 레일(세로)', 2, 1, other='flat', role='terrain', repeat='y',
      tags=('노면전차', '레일', '선로', '도로'),
      rules='남북 도로 한가운데 2칸 폭으로 세로로 이어 깐다. 2층 덧그림.')
def _(c):
    for y in range(16):
        for x, col in _rail_profile(y): c.P(x, y, col)

@prop('tram-rail-end', '노면전차 차막이', 2, 2, solid=[(1, 0), (1, 1)], other='flat', role='prop',
      tags=('노면전차', '레일', '종점', '차막이'),
      rules='종점 선로의 동쪽 끝에만 붙인다(왼쪽에서 레일이 들어온다). 오른쪽 열은 막힘. 지나가는 선로에는 쓰지 않는다.')
def _(c):
    rail_h(c, 0, 24)
    x0, x1 = 17, 31                         # 판 폭 14px
    # 윗면 5px(y9..13)
    c.R(x0, 9, x1 - x0, 5, K('tekko', 0)); c.HL(x0, 9, x1 - x0, K('tekko', 2)); c.HL(x0, 10, x1 - x0, K('tekko', 1))
    # 앞면 16px(y14..29): 위 노랑·검정 판(y14..22) + 아래 기둥 두 개
    for y in range(14, 23):
        for x in range(x0, x1):
            c.P(x, y, K('kii', 1) if ((x + y) // 3) % 2 == 0 else K('sumi', 1))
    c.HL(x0, 14, x1 - x0, K('kii', 2)); c.HL(x0, 23, x1 - x0, OL)
    for px in (x0 + 1, x1 - 3): post_v(c, px, 24, 29)
    c.HL(x0 + 1, 29, 2, K('tekko', -2)); c.HL(x1 - 3, 29, 2, K('tekko', -2))
    c.HL(x0 - 1, 8, x1 - x0 + 2, OL); c.VL(x0 - 1, 8, 16, OL); c.VL(x1, 8, 16, OL); c.HL(x0, 13, x1 - x0, OL)
    c.HL(x0 - 1, 30, 4, OL); c.HL(x1 - 4, 30, 5, OL)
    # 빨간 표지등(윗면 가운데)
    c.R(22, 10, 4, 3, K('aka', 0)); c.P(22, 10, K('aka', 2)); c.HL(22, 13, 4, OL); c.VL(21, 10, 3, OL); c.VL(26, 10, 3, OL); c.HL(22, 9, 4, OL)

# ── 정류장 유도 표시(導流帯) ────────────────────────────────
def _in_zebra(x, y):
    """섬 동쪽 끝(서쪽 변 y1..29)에서 동쪽 x46 한 점으로 좁아지는 삼각형."""
    if x < 0 or x > 46: return False
    half = 14 * (46 - x) / 46.0
    return abs(y - 15) <= half

@prop('tram-stop-zebra', '정류장 유도 표시(導流帯)', 3, 2, other='flat', role='terrain',
      tags=('노면전차', '정류장', '導流帯', '노면 표시', '도로'),
      rules='정류장 섬(jp-tram-stop) 동쪽 끝에 바로 붙여 깐다(같은 행). 2층 투명 덧그림, 차는 지나가지 않는다.')
def _(c):
    for y in range(32):
        for x in range(48):
            if not _in_zebra(x, y): continue
            edge = not (_in_zebra(x, y - 2) and _in_zebra(x, y + 2) and _in_zebra(x + 2, y))
            if edge: c.P(x, y, K('shiro', 0))
            elif (x + y) % 9 < 3: c.P(x, y, K('shiro', -1))

# ── 가선·전주 ──────────────────────────────────────────────
WIRE_Y = 8                         # 전차선(접촉선) y — 궤도 가운데보다 5칸+8px(88px) 위
WIRE_RULE = '궤도 위 칸 행 −5 에 4층으로 둔다(궤도 키트 윗행 −5 = 가선 키트 윗행). 전차선은 궤도 한가운데 88px 위로 보인다.'

def _wire(c):
    c.HL(0, WIRE_Y - 5, 16, K('tekko', -1))  # 조가선
    c.HL(0, WIRE_Y, 16, OL)                  # 전차선

@prop('tram-wire-h', '노면전차 가선(가로)', 1, 2, other='star', role='prop', repeat='x',
      tags=('노면전차', '가선', '전선', '4층'),
      rules=WIRE_RULE + ' 행어 달린 칸(jp-tram-wire-hanger)과 한 칸씩 번갈아 이어 32px 간격을 만든다.')
def _(c):
    _wire(c)

@prop('tram-wire-hanger', '노면전차 가선(행어 칸)', 1, 2, other='star', role='prop', repeat='x',
      tags=('노면전차', '가선', '전선', '행어', '4층'),
      rules=WIRE_RULE + ' jp-tram-wire-h 와 한 칸씩 번갈아 깐다(행어 32px 간격).')
def _(c):
    _wire(c)
    c.VL(8, WIRE_Y - 4, 4, K('tekko', -2))   # 드로퍼 1px

def _line(x0, y0, x1, y1):
    n = max(abs(x1 - x0), abs(y1 - y0))
    return [(int(round(x0 + (x1 - x0) * i / n)), int(round(y0 + (y1 - y0) * i / n))) for i in range(n + 1)]

def draw_pole(c, gy, top, root, tip, px=4, tx=20):
    """전주: 4px 강관 + 받침, 팔은 root(기둥 옆)→tip 로 궤도 쪽을 향한다.
    팔 끝에서 오른쪽 짧은 받침대 → 애자 → 1px 행어가 전차선(tip+7)에 닿는다."""
    # 받침(윗면+앞면)
    c.R(px - 3, gy - 6, 10, 3, K('conc', 1)); c.HL(px - 3, gy - 6, 10, K('conc', 2))
    c.R(px - 3, gy - 3, 10, 4, K('conc', -1)); c.HL(px - 3, gy - 3, 10, K('conc', -2))
    box(c, px - 4, gy - 7, 12, 10, None); c.HL(px - 3, gy - 3, 10, K('conc', -2))
    c.HL(px - 3, gy + 3, 10, K('yoru', -3))
    # 기둥(왼쪽 밝음)
    for i, s in enumerate((2, 0, -1, -2)): c.VL(px + i, top, gy - 6 - top, K('tekko', s))
    c.VL(px - 1, top, gy - 6 - top, OL); c.VL(px + 4, top, gy - 6 - top, OL)
    for y in range(gy - 22, gy - 9):                 # 노랑·검정 띠
        on = (y // 3) % 2 == 0
        for i in range(4): c.P(px + i, y, K('kii', 1 - i) if on else K('sumi', 1 - (i > 1)))
    c.R(px - 1, top - 2, 6, 2, K('tekko', 1)); c.HL(px - 1, top - 3, 6, OL); c.VL(px - 2, top - 2, 2, OL); c.VL(px + 5, top - 2, 2, OL)
    # 팔: 외곽선 먼저, 몸통 나중
    pts = _line(px + 6, root, tx, tip)
    for x, y in pts: c.P(x - 1, y, OL); c.P(x + 2, y, OL)
    for x, y in pts: c.P(x, y, K('tekko', 1)); c.P(x + 1, y, K('tekko', -1))
    (ax, ay), (bx, by) = pts[0], pts[-1]
    lo = -1 if ay < by else 1
    c.HL(ax - 1, ay - lo, 4, OL)                      # 팔 뿌리 마감
    c.HL(px + 5, ay, 1, OL); c.R(px + 5, ay - 1, 1, 3, OL)
    # 당김줄(기둥 머리 → 팔 가운데)
    mx, my = pts[len(pts) // 2]
    for x, y in _line(px + 5, top + 2, mx - 1, my): c.P(x, y, K('tekko', -2))
    # 팔 끝 받침대(오른쪽 5px) + 애자 + 행어
    c.HL(bx, tip - 1, 7, OL); c.HL(bx, tip, 7, K('tekko', 1)); c.HL(bx, tip + 1, 7, OL); c.VL(bx + 7, tip - 1, 3, OL)
    hx = bx + 5
    c.R(hx - 1, tip + 2, 3, 3, K('shiro', -1)); c.P(hx - 1, tip + 2, K('shiro', 1))
    c.VL(hx - 2, tip + 2, 3, OL); c.VL(hx + 2, tip + 2, 3, OL)
    c.VL(hx, tip + 5, WIRE_GAP - 5, OL); c.P(hx - 1, tip + WIRE_GAP, OL); c.P(hx + 1, tip + WIRE_GAP, OL)

WIRE_GAP = 7                       # 팔 끝(tip) → 전차선 y 간격

@prop('tram-pole-n', '노면전차 전주(북쪽 보도, 팔 남향)', 2, 7, solid=[(0, 6)], other='star', role='prop',
      tags=('노면전차', '전주', '가선', '기둥', '보도'),
      rules='북쪽 보도의 연석 쪽 행에 세운다: 키트 윗행 = 가선 키트 윗행 −5(받침 = 북쪽 궤도 윗행 −4). 팔이 남쪽(아래)으로 뻗어 행어가 북쪽 궤도 가선 전차선에 닿는다. 맨 아래 왼쪽 칸만 막힘.')
def _(c):
    draw_pole(c, gy=108, top=6, root=14, tip=88 - WIRE_GAP)

@prop('tram-pole-s', '노면전차 전주(남쪽 보도, 팔 북향)', 2, 13, solid=[(0, 12)], other='star', role='prop',
      tags=('노면전차', '전주', '가선', '기둥', '보도'),
      rules='남쪽 보도의 연석 쪽 행에 세운다: 키트 윗행 = 남쪽 궤도 가선 키트 윗행(받침 = 남쪽 궤도 윗행 +7, 섬 2행·차로 3행 다음). 팔이 북쪽(위)으로 뻗어 행어가 남쪽 궤도 가선에 닿는다. 정류장 섬과 겹치지 않는 열에. 맨 아래 왼쪽 칸만 막힘.')
def _(c):
    draw_pole(c, gy=200, top=94, root=104, tip=WIRE_Y - WIRE_GAP)

# ── 정류장 안전지대 ─────────────────────────────────────────
ISL_FRONT = 23                     # 앞면 시작 y(윗면 0..22)

def island_ground(c):
    W = 192
    for y in range(0, ISL_FRONT):
        for x in range(W):
            u, v = x % 16, (y - 8) % 12
            col = K('conc', 1)
            if u == 15 or v == 11: col = K('conc', 0)
            c.P(x, y, col)
    # 북쪽 승강 가장자리: 흰 선 + 노란 점자 블록(전 길이)
    c.HL(0, 0, W, K('shiro', 1)); c.HL(0, 1, W, K('shiro', -1))
    c.R(0, 2, W, 5, K('kii', 1))
    for y in range(2, 7):
        for x in range(W):
            if (x % 3 == 1) and ((y - 2) % 2 == (x // 3) % 2): c.P(x, y, K('kii', -1))
    c.HL(0, 7, W, K('kii', -3))
    # 앞면(연석 7px) — 서쪽 끝만 경사로
    for x in range(W):
        e = 16 - x if x < 16 else 0
        h = 7 - (e * 7) // 16
        top = 30 - h
        for y in range(ISL_FRONT, top): c.P(x, y, K('conc', 0))
        for y in range(top, 30): c.P(x, y, K('conc', -2) if y == top else K('conc', -1))
        c.P(x, 30, OL if h else K('yoru', -3)); c.P(x, 31, K('yoru', -3) if h else K('yoru', -1))
        if h and not e: pass
    c.HL(16, ISL_FRONT - 1, W - 16, OL); c.HL(16, ISL_FRONT, W - 16, K('conc', 0))
    for x in range(40, W, 24): c.VL(x, ISL_FRONT + 1, 6, K('conc', -2))
    c.VL(0, 0, 31, OL); c.VL(W - 1, 0, 31, OL)

def marker_post(c, x, y0, y1):
    """안전지대 표지 기둥 3px: 노랑·흰 줄."""
    for y in range(y0, y1 + 1):
        on = ((y - y0) // 2) % 2 == 0
        c.P(x, y, K('kii', 2) if on else K('shiro', 1)); c.P(x + 1, y, K('kii', 0) if on else K('shiro', 0)); c.P(x + 2, y, K('kii', -2) if on else K('shiro', -2))
    c.VL(x - 1, y0, y1 - y0 + 1, OL); c.VL(x + 3, y0, y1 - y0 + 1, OL); c.HL(x, y0 - 1, 3, OL)
    c.P(x + 1, y0, K('aka', 1))

@prop('tram-stop', '노면전차 정류장(안전지대)', 12, 2, ground=island_ground,
      ground_solid=[(x, 1) for x in range(1, 12)],
      solid=[(x, 1) for x in range(1, 12)],
      other='star', role='prop', tags=('노면전차', '정류장', '안전지대', '시간표', '점자 블록'),
      rules='남쪽 궤도(2행) 바로 남쪽에 붙인다(서행 차로 쪽). 윗줄이 섬 윗면(북쪽 가장자리 노란 점자 블록), 아랫줄은 남쪽 난간·연석(막힘). 서쪽 끝은 경사로, 동쪽 끝은 안전지대 표지 기둥 + jp-tram-stop-zebra.')
def _(c):
    # 남쪽 난간(키 10px — 점자 띠를 가리지 않는다)
    for x in range(24, 177, 16): post_v(c, x, 14, 22)
    c.HL(18, 12, 160, OL); c.HL(18, 13, 160, K('tekko', 2)); c.HL(18, 14, 160, OL)
    c.HL(18, 18, 160, K('tekko', 0)); c.HL(18, 19, 160, OL)
    c.VL(17, 12, 3, OL); c.VL(178, 12, 3, OL)
    # 정류장 표지(원판, 꼭대기 y8)
    post_v(c, 48, 16, 22)
    for y in range(8, 17):
        for x in range(44, 54):
            d = ((x - 48.5) ** 2 + (y - 12) ** 2) ** 0.5
            if d <= 2.4: c.P(x, y, K('shiro', 1))
            elif d <= 3.6: c.P(x, y, K('kon', 0) if y < 12 else K('kon', -1))
            elif d <= 4.5: c.P(x, y, OL)
    # 시간표(꼭대기 y8)
    post_v(c, 150, 17, 22)
    c.R(145, 9, 12, 7, K('shiro', 0)); c.HL(145, 9, 12, K('kon', 0))
    for i, y in enumerate((11, 13)):
        for x in range(146, 156):
            if (x + i) % 4 != 3: c.P(x, y, K('tekko', -1))
    box(c, 144, 8, 14, 9, None)
    # 동쪽 끝 안전지대 표지 기둥
    for x in (181, 187): marker_post(c, x, 9, 22)

# ── 지하철 출입구 ──────────────────────────────────────────
ROOF_B = 46                        # 지붕(윗면 0..21 + 처마 22..24 + 간판 25..42 + 밑면 43..45)

def subway_ground(c):
    hodo(c, 0, 0, 64, 80)
    # 계단 y46..79: 아래(입구)가 밝고 북쪽(안)으로 내려가며 어두워진다. 단마다 밝은 앞 모서리.
    tread = [('conc', 1), ('conc', 0), ('conc', -1), ('conc', -2), ('yoru', 0), ('yoru', -1), ('yoru', -2), ('sumi', -1)]
    for i in range(8):
        y0 = 75 - 4 * i
        r, s = tread[i]
        c.R(14, y0 + 1, 36, 3, K(r, s))
        c.HL(14, y0 + 3, 36, K(r, s - 1))
        c.HL(14, y0, 36, K('kii', 0) if i == 0 else K(r, s + 2))
    c.R(14, 46, 36, 3, K('sumi', -2))
    c.VL(14, 46, 34, OL); c.VL(49, 46, 34, OL)

@prop('subway-entrance', '지하철 출입구', 4, 5, ground=subway_ground,
      solid=[(x, y) for y in range(3) for x in range(4)] + [(0, 3), (3, 3), (0, 4), (3, 4)],
      other='star', role='building', tags=('지하철', '출입구', '역', '계단', '전이'),
      rules='보도 뒤쪽(연석에서 2칸 이상 물린 건물 줄)에 남쪽을 향해 둔다. 맨 아랫줄 가운데 2칸(계단 입구)에 장소 이동 이벤트를 놓는다. 벽·지붕은 막힘.')
def _(c):
    # 양옆 벽: 윗면(남북으로 긴 띠) y46..67, 남쪽 끝 앞면 y68..79
    for x0 in (0, 50):
        c.R(x0, 46, 14, 22, K('conc', 1)); c.VL(x0 + 1, 46, 22, K('conc', 2))
        for y in range(68, 80):
            for x in range(x0, x0 + 14):
                c.P(x, y, K('tairu', -1) if (x - x0) % 5 == 4 or (y - 68) % 4 == 3 else K('tairu', 0))
        c.HL(x0, 67, 14, OL); c.HL(x0, 68, 14, K('conc', 2)); c.HL(x0, 79, 14, OL); c.VL(x0, 46, 34, OL); c.VL(x0 + 13, 46, 34, OL)
    # 손잡이(벽 윗면 안쪽)
    c.VL(11, 47, 20, K('tekko', 2)); c.VL(12, 47, 20, OL)
    c.VL(52, 47, 20, K('tekko', 0)); c.VL(51, 47, 20, OL)
    # 지붕 윗면 y0..21(채광 유리 줄) + 처마 앞 끝 y22..24
    c.R(0, 0, 64, 22, K('conc', 1)); c.HL(1, 1, 62, K('conc', 2)); c.VL(1, 1, 21, K('conc', 2))
    for x in range(6, 58, 13):
        c.R(x, 4, 10, 13, K('sora', -1)); c.HL(x, 4, 10, K('sora', 1)); c.P(x, 5, K('shiro', 1))
        c.HL(x, 17, 10, K('conc', -1))
    c.R(0, 22, 64, 3, K('tekko', 1)); c.HL(0, 22, 64, K('tekko', 2))
    c.HL(0, 25, 64, OL)
    # 간판(앞면) y26..42
    c.R(0, 26, 64, 17, K('kon', 0)); c.HL(1, 26, 62, K('kon', 1))
    c.R(0, 43, 64, 3, K('tekko', -2))
    box(c, 0, 0, 64, 46, None); c.HL(1, 42, 62, OL)
    cx, cy = 9, 34
    for y in range(26, 43):
        for x in range(1, 18):
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            if d <= 6.4: c.P(x, y, K('shiro', 0))
            if 3.4 <= d <= 5.4: c.P(x, y, K('midori', 0))
            if 6.4 < d <= 7.2: c.P(x, y, OL)
    SP.text(c, 19, 26, '地下鉄', K('shiro', 1), step=14)

# ── 칸 자르기·키트 ─────────────────────────────────────────
def _render(fn, w, h): c = Cv(w * 16, h * 16); fn(c); return c.a

def _cut(a, R, C, key_of, add):
    rows = []
    for cy in range(R):
        row = []
        for cx in range(C):
            t = a[cy * 16:(cy + 1) * 16, cx * 16:(cx + 1) * 16].copy()
            if not t[:, :, 3].any(): row.append(None); continue
            t[t[:, :, 3] == 0] = 0
            row.append(add(cx, cy, t))
        rows.append(row)
    return rows

_CACHE = {}
def _finalize():
    if 'r' in _CACHE: return _CACHE['r']
    cells, kits, sprites, groups, seen = {}, [], {}, [], {}
    for p in P:
        C, R = p['w'], p['h']
        def adder(layer):
            def add(cx, cy, t):
                if layer == 'base': pc = 'solidfloor' if (cx, cy) in set(map(tuple, p['ground_solid'])) else 'floor'
                else: pc = 'solid' if (cx, cy) in set(map(tuple, p['solid'])) else p['other']
                k = (t.tobytes(), pc)
                if k in seen: return seen[k]
                local = '%s/%s%d.%d' % (p['id'], 'g' if layer == 'base' else '', cx, cy)
                seen[k] = local
                cells[local] = dict(img=Image.fromarray(t, 'RGBA'), pc=pc,
                                    label='%s 칸 (%d,%d)%s' % (p['name'], cx, cy, ' 바닥' if layer == 'base' else ''),
                                    desc='%s — %s' % (p['name'], p['rules']), tags=list(p['tags']))
                return local
            return add
        base = _cut(_render(p['ground'], C, R), R, C, None, adder('base')) if p['ground'] else None
        grid = _cut(_render(p['draw'], C, R), R, C, None, adder('grid'))
        spr = Image.new('RGBA', (C * 16, R * 16), (0, 0, 0, 0))
        if p['ground']: spr.alpha_composite(Image.fromarray(_render(p['ground'], C, R), 'RGBA'))
        spr.alpha_composite(Image.fromarray(_render(p['draw'], C, R), 'RGBA'))
        sprites[p['id']] = spr
        ai = dict(snap='floor', tags=list(p['tags']), description='%s — %s' % (p['name'], p['rules']),
                  placementRules=p['rules'], repeatability='repeat' if p['repeat'] else 'fixed',
                  growthAxis=p['repeat'], anchor=dict(dx=0, dy=R - 1), access=[], role=p['role'])
        parts = []
        if p['id'] == 'subway-entrance':
            parts = [{"kind": "anchor", "x": 1, "y": 4, "w": 2, "h": 1, "label": "계단 입구(전이 이벤트 자리)"}]
        kits.append(dict(id='jp-' + p['id'], name=p['name'], grid=grid, base=base, parts=parts, ai=ai))
    def _cells_of(prefixes): return [k for k in cells if k.split('/')[0] in prefixes]
    groups = [dict(id='jp:tram-rail', name='노면전차 궤도(투명 덧그림)', role='detail', defaultLayer='upper',
                   cells=_cells_of(('tram-rail-h', 'tram-rail-v', 'tram-rail-end')), desc='아스팔트에 묻힌 노면전차 레일·차막이.', rules='키트 jp-tram-rail-* 로 2층에 찍는다.'),
              dict(id='jp:tram-stop', name='노면전차 정류장·가선·전주', role='prop', defaultLayer='upper',
                   cells=_cells_of(('tram-stop', 'tram-stop-zebra', 'tram-wire-h', 'tram-wire-hanger', 'tram-pole-n', 'tram-pole-s')), desc='안전지대 섬·가공 전차선·전주.', rules='키트로 찍는다(가선은 4층).'),
              dict(id='jp:subway-entrance', name='지하철 출입구', role='building', defaultLayer='upper',
                   cells=_cells_of(('subway-entrance',)), desc='보도 위 지하철 출입구.', rules='키트 jp-subway-entrance, 계단 입구 anchor 2칸에 전이 이벤트.')]
    groups = [g for g in groups if g['cells']]
    _CACHE['r'] = (cells, kits, sprites, groups)
    return _CACHE['r']

def build():
    cells, kits, sprites, groups = _finalize()
    return dict(cells={k: dict(v, img=v['img'].copy()) for k, v in cells.items()}, autotiles=[],
                groups=[dict(g) for g in groups], kits=[dict(k) for k in kits],
                notes='노면전차 레일·차막이·안전지대 정류장·가선·전주, 지하철 출입구. 레일은 2층 투명 덧그림, 가선은 4층.')

# ── 점검 그림 ───────────────────────────────────────────────
def _asphalt_img(w, h):
    c = Cv(w, h); asphalt(c, 0, 0, w, h); return Image.fromarray(c.a, 'RGBA')

def _kit_img(kit, cells):
    R, C = len(kit['grid']), len(kit['grid'][0])
    im = _asphalt_img(C * 16, R * 16)
    for layer in (kit['base'], kit['grid']):
        if not layer: continue
        for cy, row in enumerate(layer):
            for cx, k in enumerate(row):
                if k: im.alpha_composite(cells[k]['img'], (cx * 16, cy * 16))
    return im

def render_all():
    cells, kits, sprites, groups = _finalize()
    os.makedirs(OUTDIR, exist_ok=True)
    ims = []
    for kit in kits:
        im = _kit_img(kit, cells); im.save(os.path.join(OUTDIR, kit['id'] + '.png')); ims.append(im)
    W, x, y, rh, pos = 1100, 8, 8, 0, []
    for im in ims:
        if x + im.width > W - 8: x, y, rh = 8, y + rh + 8, 0
        pos.append((x, y)); x += im.width + 8; rh = max(rh, im.height)
    sheet = Image.new('RGBA', (W, y + rh + 8), (104, 103, 122, 255))
    for im, p in zip(ims, pos): sheet.alpha_composite(im, p)
    sheet.resize((sheet.width * 2, sheet.height * 2), Image.NEAREST).save(os.path.join(OUTDIR, '_all-x2.png'))
    sheet.resize((sheet.width * 3, sheet.height * 3), Image.NEAREST).save(os.path.join(OUTDIR, '_all-x3.png'))
    render_scene(cells, kits)

def _bldg(name):
    a = np.array(Image.open(os.path.join(ROOT, 'tiledata', 'jp-city', 'blocks', 'buildings', name + '.png')).convert('RGBA'))
    a[(a[:, :, :3] == a[0, 0, :3]).all(axis=2)] = 0          # 점검 그림 바탕색 빼기
    return Image.fromarray(a, 'RGBA')

# 장면 가로 단면(칸 행): 건물 0..8 · 북 보도 9..11 · 동행 차로 12..14 · 동행 궤도 15..16 · 사이 17 ·
# 서행 궤도 18..19 · 서행 안전지대 20..21 · 서행 차로 22..24 · 남 보도 25..27 (좌측 통행)
SC = dict(walk_n=9, lane_e=12, track_n=15, track_s=18, island=20, lane_w=22, walk_s=25, rows=28)

def render_scene(cells, kits):
    """좌측 통행 간선: 북 보도(건물·지하철 출입구) · 동행 차로 · 복선 궤도 · 서행 안전지대 · 서행 차로 · 남 보도."""
    KI = {k['id']: k for k in kits}
    CW, CH = 40, SC['rows']
    S = Cv(CW * 16, CH * 16)
    hodo(S, 0, 0, CW * 16, SC['lane_e'] * 16)                       # 건물 뒤·북 보도
    asphalt(S, 0, SC['lane_e'] * 16, CW * 16, (SC['walk_s'] - SC['lane_e']) * 16)
    hodo(S, 0, SC['walk_s'] * 16, CW * 16, 3 * 16)
    yn, ys = SC['lane_e'] * 16, SC['walk_s'] * 16                   # 연석
    S.R(0, yn - 4, CW * 16, 3, K('conc', -1)); S.HL(0, yn - 5, CW * 16, K('conc', 1)); S.HL(0, yn - 1, CW * 16, OL)
    S.HL(0, ys, CW * 16, K('conc', 1)); S.HL(0, ys + 1, CW * 16, K('conc', 0)); S.HL(0, ys + 2, CW * 16, OL)
    # 차로 표시: 궤도 쪽 흰 실선(차·전차 분리), 보도 쪽 흰 점선(갓길)
    W = K('shiro', 0)
    S.R(0, SC['track_n'] * 16 - 12, CW * 16, 2, W); S.R(0, SC['lane_w'] * 16 + 4, 13 * 16, 2, W); S.R(13 * 16 + 40, SC['lane_w'] * 16 + 4, CW * 16, 2, W)
    for x in range(0, CW * 16, 32):
        S.R(x + 4, yn + 6, 18, 2, W)
        if not 12 * 16 <= x <= 17 * 16: S.R(x + 4, ys - 8, 18, 2, W)
    # 남 보도 → 안전지대 횡단보도(섬 서쪽 끝)
    for i in range(4):
        S.R((13 * 16) + 2 + i * 10, SC['lane_w'] * 16 + 9, 6, 3 * 16 - 12, W)
    im = Image.fromarray(S.a, 'RGBA')
    def put(kid, gx, gy, layers=('base', 'grid'), dy=0):
        kit = KI[kid]
        for ln in layers:
            L = kit[ln]
            if not L: continue
            for cy, row in enumerate(L):
                for cx, k in enumerate(row):
                    if k: im.alpha_composite(cells[k]['img'], ((gx + cx) * 16, (gy + cy) * 16 + dy))
    # 건물 줄: 보도 뒤 가장자리(아랫변 = 북 보도 윗행)에 붙인다
    gx = 0
    for name in ('jp-bldg-shop-pharmacy', 'jp-bldg-conbini', None, 'jp-bldg-coin-laundry', 'jp-bldg-shop-ramen', 'jp-bldg-shop-barber'):
        if name is None:                                            # 지하철 출입구: 연석에서 2칸 물림
            put('jp-subway-entrance', gx, SC['walk_n'] - 4); gx += 4; continue
        b = _bldg(name); im.alpha_composite(b, (gx * 16, SC['walk_n'] * 16 - b.height)); gx += b.width // 16
    # 2층: 궤도·유도 표시
    for gx in range(CW):
        put('jp-tram-rail-h', gx, SC['track_n']); put('jp-tram-rail-h', gx, SC['track_s'])
    ISX = 13
    put('jp-tram-stop', ISX, SC['island'], layers=('base',))
    put('jp-tram-stop-zebra', ISX + 12, SC['island'])
    # 3층: 정류장 소품·전주
    put('jp-tram-stop', ISX, SC['island'], layers=('grid',))
    for gx in (2, 13, 24, 35): put('jp-tram-pole-n', gx, SC['track_n'] - 5 - 5)
    for gx in (4, 30, 37): put('jp-tram-pole-s', gx, SC['track_s'] - 5)
    # 4층: 가선(궤도 윗행 −5), 행어 칸과 번갈아
    for gx in range(CW):
        kid = 'jp-tram-wire-hanger' if gx % 2 == 0 else 'jp-tram-wire-h'
        put(kid, gx, SC['track_n'] - 5); put(kid, gx, SC['track_s'] - 5)
    im.save(os.path.join(OUTDIR, 'scene-street.png'))
    im.resize((im.width * 3, im.height * 3), Image.NEAREST).save(os.path.join(OUTDIR, 'scene-street-x3.png'))

# ── selftest ───────────────────────────────────────────────
def selftest(verbose=True, render=True):
    cells, kits, sprites, groups = _finalize()
    bad = 0
    for k, v in cells.items():
        e = check_cell(v['img'])
        if e: bad += 1; print('칸 오류', k, e)
        if v['pc'] not in ('floor', 'solidfloor', 'flat', 'solid', 'star'): bad += 1; print('pc 오류', k, v['pc'])
    ids = [k['id'] for k in kits]
    if len(set(ids)) != len(ids): bad += 1; print('키트 id 중복')
    for kit in kits:
        if not kit['id'].startswith('jp-'): bad += 1; print('id 접두 오류', kit['id'])
        if kit['ai']['role'] not in ('building', 'castle', 'fence', 'roof', 'terrain', 'water', 'wall', 'prop'): bad += 1; print('role 오류', kit['id'])
        p = next(q for q in P if 'jp-' + q['id'] == kit['id'])
        # 재조립: 칸을 다시 붙이면 원래 그림과 같아야 한다
        R, C = len(kit['grid']), len(kit['grid'][0])
        re = Image.new('RGBA', (C * 16, R * 16), (0, 0, 0, 0))
        for layer in (kit['base'], kit['grid']):
            if not layer: continue
            for cy, row in enumerate(layer):
                for cx, k in enumerate(row):
                    if k: re.alpha_composite(cells[k]['img'], (cx * 16, cy * 16))
        a = np.array(sprites[p['id']]); a[a[:, :, 3] == 0] = 0
        if not np.array_equal(a, np.array(re)): bad += 1; print('재조립 불일치', kit['id'])
        for (sx, sy) in p['solid']:
            if kit['grid'][sy][sx] is None: bad += 1; print('막힘 칸에 그림 없음', kit['id'], sx, sy)
        for (sx, sy) in p['ground_solid']:
            if not kit['base'] or kit['base'][sy][sx] is None: bad += 1; print('막힘 바닥 없음', kit['id'], sx, sy)
    if render: render_all()
    if verbose: print('transit_street — 키트 %d · 고유 칸 %d · 오류 %d' % (len(kits), len(cells), bad))
    return bad

if __name__ == '__main__':
    sys.exit(1 if selftest() else 0)
