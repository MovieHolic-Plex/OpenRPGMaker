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
    """레일 단면(띠 가로질러). 바깥쪽 매립 콘크리트 줄 + 머리 2px + 안쪽 홈(먹선) + 홈 그늘."""
    hi = K('tekko', 2) if along % 16 != 6 else K('shiro', -1)
    head = [(-3, OL), (-2, K('conc', -1)), (-1, K('conc', -2)), (0, hi), (1, K('tekko', 0)), (2, OL), (3, K('yoru', -1))]
    tail = [(-3, K('yoru', -1)), (-2, OL), (-1, hi), (0, K('tekko', 0)), (1, K('conc', -2)), (2, K('conc', -1)), (3, OL)]
    return [(RAIL_A + d, col) for d, col in head] + [(RAIL_B + d, col) for d, col in tail]

def rail_h(c, x0, x1, oy=0):
    for x in range(x0, x1):
        for y, col in _rail_profile(x): c.P(x, oy + y, col)

@prop('tram-rail-h', '노면전차 레일(가로)', 1, 2, other='flat', role='terrain', repeat='x',
      tags=('노면전차', '레일', '선로', '도로'),
      rules='4차로 간선도로 한가운데 2칸 띠로 가로로 이어 깐다. 아스팔트 위 2층 덧그림(레일 사이는 투명). 정류장 섬은 이 띠 바로 남쪽.')
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
      rules='가로 레일 띠의 동쪽 끝에 붙인다(왼쪽에서 레일이 들어온다). 오른쪽 열은 막힘.')
def _(c):
    rail_h(c, 0, 21)
    # 받침 다리(레일 위에 선 두 다리)
    for ry in (RAIL_A, RAIL_B):
        c.R(21, ry - 2, 6, 4, K('tekko', -2)); c.HL(21, ry + 2, 6, OL); c.VL(27, ry - 2, 5, OL)
    # 가로대(남북으로 걸친 보): 윗면 x19..28 y1..21, 앞면 y22..28
    x0, x1 = 19, 29
    c.R(x0, 0, x1 - x0, 22, K('kii', 0))
    for y in range(0, 22):
        for x in range(x0, x1):
            if (x + y) % 8 < 3: c.P(x, y, K('sumi', 1))
    c.VL(x0, 0, 22, K('kii', 2))
    c.R(x0, 22, x1 - x0, 7, K('kii', -2))
    for y in range(22, 29):
        for x in range(x0, x1):
            if (x + y) % 8 < 3: c.P(x, y, K('sumi', 0))
    c.HL(x0, 21, x1 - x0, K('kii', 1))
    c.VL(x0 - 1, 0, 30, OL); c.VL(x1, 0, 30, OL); c.HL(x0, 29, x1 - x0, OL); c.HL(x0, 0, x1 - x0, OL)
    # 빨간 표지등(윗면 위)
    c.R(22, 3, 4, 3, K('aka', 0)); c.P(22, 3, K('aka', 2)); c.HL(22, 6, 4, OL); c.VL(21, 3, 3, OL); c.VL(26, 3, 3, OL); c.HL(22, 2, 4, OL)

# ── 가선·전주 ──────────────────────────────────────────────
WIRE_Y = 22                        # 전차선(접촉선) y — 전주 팔 끝과 맞춘다

@prop('tram-wire-h', '노면전차 가선(가로)', 1, 2, other='star', role='prop', repeat='x',
      tags=('노면전차', '가선', '전선', '4층'),
      rules='4층(맨 위)에 가로로 이어 깐다. 레일 띠보다 위쪽(북쪽)으로 높이만큼 띄워 전주 팔 끝에 맞춘다.')
def _(c):
    c.HL(0, WIRE_Y - 5, 16, K('tekko', 0)); c.HL(0, WIRE_Y - 6, 16, OL)  # 조가선
    c.HL(0, WIRE_Y, 16, OL)                  # 전차선
    c.VL(8, WIRE_Y - 4, 4, K('tekko', -1))   # 드로퍼
    c.P(8, WIRE_Y - 1, K('tekko', 1)); c.P(7, WIRE_Y - 1, OL); c.P(9, WIRE_Y - 1, OL)

POLE_X = 6
POLE_TIP = 52                      # 팔 끝 행어 아래 끝 y(가선 전차선 높이)
@prop('tram-pole', '노면전차 전주(팔 달린)', 3, 8, solid=[(0, 7)], other='star', role='prop',
      tags=('노면전차', '전주', '가선', '기둥'),
      rules='레일 띠 남쪽(정류장 섬·보도)에 세운다. 맨 아래 칸만 막힘. 팔 끝 행어가 가선 전차선에 닿게 높이를 맞춘다.')
def _(c):
    base_y = 124
    # 콘크리트 받침(윗면+앞면)
    c.R(2, 116, 12, 4, K('conc', 1)); c.R(2, 120, 12, 5, K('conc', -1)); box(c, 1, 115, 14, 11, None)
    c.HL(2, 120, 12, K('conc', -2))
    # 기둥
    post_v(c, POLE_X, 12, 116)
    # 노랑·검정 띠(아래쪽)
    for y in range(100, 112):
        col = K('kii', 1) if (y // 3) % 2 == 0 else K('sumi', 1)
        c.P(POLE_X, y, col); c.P(POLE_X + 1, y, K('kii', -1) if (y // 3) % 2 == 0 else K('sumi', 0))
    # 기둥 머리 뚜껑
    c.R(POLE_X - 1, 9, 4, 3, K('tekko', 0)); c.HL(POLE_X - 1, 8, 4, OL); c.HL(POLE_X - 2, 12, 6, OL)
    c.VL(POLE_X - 2, 9, 3, OL); c.VL(POLE_X + 3, 9, 3, OL)
    # 팔(가로대) — 오른쪽으로 2칸 뻗는다(y=AY)
    AY = 36
    c.HL(POLE_X + 3, AY, 38, OL); c.HL(POLE_X + 3, AY + 1, 38, K('tekko', 1)); c.HL(POLE_X + 3, AY + 2, 38, K('tekko', -2)); c.HL(POLE_X + 3, AY + 3, 38, OL)
    c.VL(POLE_X + 41, AY, 4, OL)
    # 당김줄(기둥 머리 → 팔 끝)
    for i in range(36):
        x = POLE_X + 3 + i; y = 13 + (i * (AY - 14)) // 36
        c.P(x, y, K('tekko', -1))
    # 애자 + 행어(팔 끝에서 전차선까지)
    hx = POLE_X + 36
    c.R(hx - 1, AY + 4, 3, 4, K('shiro', -1)); c.P(hx - 1, AY + 4, K('shiro', 1)); c.VL(hx - 2, AY + 4, 4, OL); c.VL(hx + 2, AY + 4, 4, OL); c.HL(hx - 1, AY + 8, 3, OL)
    c.VL(hx, AY + 9, POLE_TIP - AY - 9, K('tekko', 2)); c.VL(hx + 1, AY + 9, POLE_TIP - AY - 9, OL); c.VL(hx - 1, AY + 9, POLE_TIP - AY - 9, OL)
    c.P(hx, POLE_TIP, OL)
    # 그림자(받침 남쪽 아스팔트 위는 각 층이 칠하므로 생략)

# ── 정류장 안전지대 ─────────────────────────────────────────
ISL_FRONT = 36                     # 앞면 시작 y(윗면 0..35)

def island_ground(c):
    W, H = 192, 48
    # 윗면 판석
    for y in range(0, ISL_FRONT):
        for x in range(W):
            u, v = x % 16, y % 12
            col = K('conc', 1)
            if u == 15 or v == 11: col = K('conc', 0)
            c.P(x, y, col)
    # 북쪽 가장자리 흰 선 + 노란 점자 블록
    c.HL(0, 0, W, K('shiro', 0)); c.HL(0, 1, W, K('shiro', -1))
    c.R(0, 3, W, 5, K('kii', 0))
    for y in range(3, 8):
        for x in range(W):
            if (x % 3 == 1) and ((y - 3) % 2 == (x // 3) % 2): c.P(x, y, K('kii', -2))
    c.HL(0, 8, W, K('kii', -3))
    # 앞면(연석) + 그림자
    for x in range(W):
        e = 0
        if x < 16: e = 16 - x
        elif x >= W - 16: e = x - (W - 17)
        h = max(0, 10 - (e * 10) // 16)           # 양 끝은 경사로
        top = 46 - h
        for y in range(ISL_FRONT, top): c.P(x, y, K('conc', 0) if e else K('conc', 1))
        for y in range(top, 46):
            c.P(x, y, K('conc', -2) if y == top else K('conc', -1))
        c.P(x, 46 if h else 46, OL if h else K('yoru', -3))
        c.P(x, 47, K('yoru', -3) if h else K('yoru', -1))
        if h: c.P(x, top - 1 if e else ISL_FRONT - 1, OL if not e else K('conc', 1))
    # 앞면 위 모서리 선(경사로 제외)
    c.HL(16, ISL_FRONT - 1, W - 32, OL); c.HL(16, ISL_FRONT, W - 32, K('conc', 0))
    for x in range(16, W - 16, 24): c.VL(x, ISL_FRONT + 1, 9, K('conc', -2))   # 연석 이음
    c.VL(0, 0, 46, OL); c.VL(W - 1, 0, 46, OL)

@prop('tram-stop', '노면전차 정류장(안전지대)', 12, 3, ground=island_ground,
      ground_solid=[(x, 2) for x in range(1, 11)],
      solid=[(2, 1), (4, 1), (5, 1), (6, 1), (7, 1), (9, 1)] + [(x, 2) for x in range(1, 11)],
      other='star', role='prop', tags=('노면전차', '정류장', '안전지대', '역명판', '시간표'),
      rules='가로 레일 띠(2칸) 바로 남쪽에 붙인다. 윗줄 2줄이 섬 윗면(걷는다), 아랫줄은 앞면·난간(막힘). 양 끝은 경사로.')
def _(c):
    # 남쪽 난간(경사로 사이)
    for x in range(16, 177, 16): post_v(c, x, 27, 38)
    c.HL(15, 25, 164, OL); c.HL(15, 26, 164, K('tekko', 2)); c.HL(15, 27, 164, K('tekko', -1)); c.HL(15, 28, 164, OL)
    c.HL(16, 32, 162, K('tekko', 0)); c.HL(16, 33, 162, OL)
    c.VL(14, 25, 4, OL); c.VL(179, 25, 4, OL)
    # 대합 지붕(가운데 4칸 x64..127)
    X0, X1 = 62, 130
    for x in (66, 124): post_v(c, x, 9, 30)
    c.R(68, 12, 55, 13, K('garasu', 0))                         # 뒷 바람막이 유리
    for x in range(70, 122, 7): c.VL(x, 13, 6, K('garasu', 2))
    box(c, 67, 11, 57, 15, None)
    c.R(76, 22, 40, 3, K('ita', 1)); c.R(76, 25, 40, 2, K('ita', -2)); box(c, 75, 21, 42, 7, None)  # 벤치
    c.VL(79, 28, 3, OL); c.VL(112, 28, 3, OL)
    c.R(X0, 0, X1 - X0, 7, K('tekko', 1)); c.HL(X0, 1, X1 - X0, K('tekko', 2))
    c.R(X0, 7, X1 - X0, 3, K('midori', -1)); c.HL(X0, 7, X1 - X0, K('midori', 0))
    box(c, X0 - 1, 0, X1 - X0 + 2, 11, None)
    # 역명판 기둥(2열) — 「さくら町」
    post_v(c, 31, 21, 30)
    c.R(2, 1, 58, 20, K('shiro', 0)); c.HL(3, 2, 56, K('shiro', 1))
    c.HL(3, 18, 56, K('midori', 0)); c.HL(3, 19, 56, K('midori', -1))
    box(c, 1, 0, 60, 22, None)
    SP.text(c, 4, 2, 'さくら町', K('sumi', 1), step=13)
    # 시간표(9열)
    post_v(c, 151, 18, 30)
    c.R(145, 9, 14, 10, K('shiro', 0)); c.HL(145, 9, 14, K('kon', 0))
    for i, y in enumerate((11, 13, 15, 17)):
        for x in range(146, 158):
            if (x + i) % 4 != 3: c.P(x, y, K('tekko', -1))
    box(c, 144, 8, 16, 12, None)

# ── 지하철 출입구 ──────────────────────────────────────────
def subway_ground(c):
    hodo(c, 0, 0, 64, 64)
    # 계단(남쪽이 가깝고 밝다, 북쪽으로 내려가며 어두워진다)
    cols = [K('sumi', -3), K('sumi', -2), K('yoru', -3), K('yoru', -2), K('yoru', -1), K('conc', -3), K('conc', -2), K('conc', -1)]
    for k in range(8):
        y = 44 + k * 2 + (k > 3) * (k - 3)
        c.R(14, y, 36, 2, cols[k])
        c.HL(14, y + 2, 36, K('kii', -2) if k >= 6 else (K('yoru', 0) if k >= 3 else K('sumi', -1)))
    c.HL(14, 63, 36, K('kii', 0))
    c.VL(14, 44, 20, OL); c.VL(49, 44, 20, OL)

@prop('subway-entrance', '지하철 출입구', 4, 4, ground=subway_ground,
      solid=[(x, y) for y in range(3) for x in range(4)] + [(0, 3), (3, 3)],
      other='star', role='building', tags=('지하철', '출입구', '역', '계단', '전이'),
      rules='보도 위에 남쪽을 향해 둔다. 아랫줄 가운데 2칸(계단 입구)에 장소 이동 이벤트를 놓는다. 벽·지붕은 막힘.')
def _(c):
    # 양옆 벽(윗면 y44..51, 앞면 y52..63)
    for x0 in (0, 50):
        c.R(x0, 44, 14, 8, K('conc', 1)); c.HL(x0, 44, 14, K('conc', 2))
        for y in range(52, 64):
            for x in range(x0, x0 + 14):
                c.P(x, y, K('tairu', -1) if (x - x0) % 5 == 4 or (y - 52) % 4 == 3 else K('tairu', 0))
        c.HL(x0, 51, 14, OL); c.HL(x0, 63, 14, OL); c.VL(x0, 44, 20, OL); c.VL(x0 + 13, 44, 20, OL)
    # 손잡이(벽 안쪽 위)
    c.VL(15, 46, 17, K('tekko', 2)); c.VL(48, 46, 17, K('tekko', 0))
    # 지붕 윗면 y0..7(유리 채광 줄), 파란 띠 y8..25, 흰 띠 y26..41, 처마 밑 y42..43
    c.R(0, 0, 64, 8, K('conc', 1)); c.HL(1, 1, 62, K('conc', 2))
    for x in range(6, 58, 13):
        c.R(x, 2, 10, 4, K('sora', 0)); c.P(x, 2, K('shiro', 1))
    c.HL(1, 7, 62, OL)
    c.R(0, 8, 64, 18, K('kon', 0)); c.HL(1, 8, 62, K('kon', 1))
    c.R(0, 26, 64, 16, K('shiro', 0)); c.HL(1, 26, 62, K('shiro', 1))
    c.R(0, 42, 64, 2, K('tekko', -2))
    box(c, 0, 0, 64, 44, None); c.HL(1, 25, 62, OL)
    # 노선 기호: 흰 원판 + 초록 고리(글자 없음)
    cx, cy = 9, 16
    for y in range(8, 25):
        for x in range(1, 18):
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            if d <= 6.6: c.P(x, y, K('shiro', 0))
            if 3.4 <= d <= 5.6: c.P(x, y, K('midori', 0))
            if 6.6 < d <= 7.4: c.P(x, y, OL)
    SP.text(c, 19, 9, '地下鉄', K('shiro', 1), step=14)
    SP.text(c, 5, 26, 'さくら町', K('kon', -1), step=13)

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
            parts = [{"kind": "anchor", "x": 1, "y": 3, "w": 2, "h": 1, "label": "계단 입구(전이 이벤트 자리)"}]
        kits.append(dict(id='jp-' + p['id'], name=p['name'], grid=grid, base=base, parts=parts, ai=ai))
    groups = [dict(id='tram', name='노면전차', kits=['jp-tram-rail-h', 'jp-tram-rail-v', 'jp-tram-rail-end', 'jp-tram-stop', 'jp-tram-wire-h', 'jp-tram-pole']),
              dict(id='subway', name='지하철', kits=['jp-subway-entrance'])]
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

def render_scene(cells, kits):
    """4차로 간선 + 가운데 노면전차 + 안전지대·가선·전주 + 보도의 지하철 출입구 + 편의점."""
    KI = {k['id']: k for k in kits}
    CW, CH = 34, 22
    S = Cv(CW * 16, CH * 16)
    hodo(S, 0, 0, CW * 16, 8 * 16)                 # 북쪽 보도·가게 앞
    asphalt(S, 0, 8 * 16, CW * 16, 11 * 16)        # 차도 rows 8..18
    hodo(S, 0, 19 * 16, CW * 16, 3 * 16)           # 남쪽 보도
    for yy, top in ((8 * 16, True), (19 * 16, False)):   # 연석
        if top:
            S.R(0, yy - 4, CW * 16, 3, K('conc', -1)); S.HL(0, yy - 5, CW * 16, K('conc', 1)); S.HL(0, yy - 1, CW * 16, OL)
        else:
            S.HL(0, yy, CW * 16, K('conc', 1)); S.HL(0, yy + 1, CW * 16, K('conc', 0))
    # 차선: 바깥 차로 사이 흰 점선(궤도 띠 양옆 실선은 레일과 헷갈려 뺐다)
    for x in range(0, CW * 16):
        if x % 32 < 16: S.HL(x, 10 * 16, 1, K('shiro', 0)); S.HL(x, 10 * 16 + 1, 1, K('shiro', -1))
        if x % 32 < 16: S.HL(x, 17 * 16, 1, K('shiro', 0)); S.HL(x, 17 * 16 + 1, 1, K('shiro', -1))
    im = Image.fromarray(S.a, 'RGBA')
    def put(kid, gx, gy, layers=('base', 'grid'), dy=0):
        kit = KI[kid]
        for ln in layers:
            L = kit[ln]
            if not L: continue
            for cy, row in enumerate(L):
                for cx, k in enumerate(row):
                    if k: im.alpha_composite(cells[k]['img'], ((gx + cx) * 16, (gy + cy) * 16 + dy))
    conb = Image.open(os.path.join(ROOT, 'tiledata', 'jp-city', 'blocks', 'buildings', 'jp-bldg-conbini.png')).convert('RGBA')
    ca = np.array(conb); bgc = ca[0, 0, :3].copy()
    ca[(ca[:, :, :3] == bgc).all(axis=2)] = 0          # 점검 그림 바탕색 빼기
    conb = Image.fromarray(ca, 'RGBA')
    im.alpha_composite(conb, (2 * 16, 1 * 16))
    put('jp-subway-entrance', 14, 3)
    for gx in range(0, 32): put('jp-tram-rail-h', gx, 12)
    put('jp-tram-rail-end', 32, 12)
    put('jp-tram-stop', 9, 14, layers=('base',))
    # 3층: 정류장 소품, 전주
    put('jp-tram-stop', 9, 14, layers=('grid',))
    put('jp-tram-pole', 19, 8)     # 받침이 섬 윗줄(15행) — 차로 한가운데 전주는 뺐다
    # 4층: 가선 — 전주 팔 끝 행어(전주 y=8*16+POLE_TIP)에 전차선(y=WIRE_Y)을 맞춘다
    dy = (8 * 16 + POLE_TIP) - WIRE_Y - 9 * 16
    for gx in range(0, 34): put('jp-tram-wire-h', gx, 9, dy=dy)
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
