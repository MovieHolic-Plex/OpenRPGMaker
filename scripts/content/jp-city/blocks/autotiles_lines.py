"""블록 autotiles_lines — 선형 오토타일 9세트(블록담·생울타리·철망·가드레일·선로·중앙선·점선·횡단보도·점자블록선). 계약: ../CONTRACT.md
전부 코드로 그린 손 도트(modern3 팔레트, 알파 0/255). 4방(16키) 오토타일.
  python3 scripts/content/jp-city/blocks/autotiles_lines.py            # selftest + tiledata/jp-city/blocks/autotiles_lines/*.png
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..'))
from lib_blocks_lines.core import *            # noqa
from lib_blocks_lines import slab              # noqa

BLOCK = 'autotiles_lines'
OUTDIR = os.path.join(ROOT, 'tiledata', 'jp-city', 'blocks', 'autotiles_lines')

def famof(v): return 0 if v == 0 else (2 if v in (3, 4) else 1)

# ═══════════════ 1. 블록담 ═══════════════
WALL_SPEC = slab.Spec(ty0=2, ty1=5, fy1=13, sx0=4, sx1=11, pillar=dict(x0=3, x1=12, ty0=1, ty1=5, fy1=13))
OLW = K('sumi', 1)
def wall_shader(rl, x, y, r):
    nb = lambda dx, dy: rl.at(x + dx, y + dy)
    L, R, U, D = nb(-1, 0), nb(1, 0), nb(0, -1), nb(0, 1)
    if 0 in (L, R, U, D): return OLW
    if r in (3, 4):
        for q, d in ((L, 'l'), (R, 'r'), (U, 'u'), (D, 'd')):
            if famof(q) != 2 and not (d == 'u' and q == 1): return OLW
    if r == 1 and (L in (2, 4) or R in (2, 4)): return OLW
    first_back = nb(0, -2) == 0; first_left = nb(-2, 0) == 0; first_right = nb(2, 0) == 0
    if r in (1, 3):
        cap = (r == 3)
        if D in (2, 4) or first_back or first_left: return K('conc', 3)
        if first_right: return K('conc', 1 if cap else 0)
        if nb(3, 0) == 0 and not cap and U != 0 and D != 0: return K('conc', 1)     # 세로 띠 오른쪽 둘째 줄
        return K('conc', 3 if cap else 2)
    # 앞면
    base = rl.at(x, y)
    v = 0
    yy = y
    while rl.at(x, yy - 1) in (2, 4): yy -= 1
    v = y - yy
    xm = x % 8
    if v == 0: return K('conc', -1)
    if v == 3: return K('conc', -2)
    if v == 6 or (D == 0 and False): return K('conc', -1)
    course = 0 if v <= 2 else 1
    joint = (xm == 7) if course == 0 else (xm == 3)
    if joint: return K('conc', -2)
    lit = (xm == 0) if course == 0 else (xm == 4)
    if first_right: return K('conc', -1)
    if lit or first_left: return K('conc', 2)
    return K('conc', 1)

def draw_wall(m): return shade_roles(slab.roles_for(m, WALL_SPEC), wall_shader)

# ═══════════════ 2. 생울타리 ═══════════════
_BUMP = [1, 0, 0, 0, 1, 2, 3, 2]
HEDGE_SPEC = slab.Spec(ty0=1, ty1=5, fy1=14, sx0=3, sx1=12,
                       top_prof=lambda x: _BUMP[x % 8],
                       side_prof=lambda y: (min(2, _BUMP[(y + 2) % 8]), min(2, _BUMP[(y + 6) % 8])))
OLH = K('midori', -2)
_CEN = [(2, 2), (6, 6)]
def _leaf(x, y):
    best = None
    for cx, cy in _CEN:
        for ox in (-8, 0, 8):
            for oy in (-8, 0, 8):
                dx = x - (cx + ox); dy = y - (cy + oy); d = (dx * dx + dy * dy) ** 0.5
                if best is None or d < best[0]: best = (d, dx, dy)
    return best
def _leaf_tone(x, y):
    """덩이 하나(반지름 3)의 명암: 왼쪽 위 +2 · 가운데 +1 · 오른쪽 아래 0 · 덩이 사이 홈 -1."""
    d, dx, dy = _leaf(x, y)
    lit = dx + dy
    if d >= 3.2: return -1
    if d <= 1.2: return 2 if lit < 0 else 1
    if d <= 2.4: return 1 if lit <= 0 else 0
    return 0 if lit < 0 else -1
def hedge_shader(rl, x, y, r):
    nb = lambda dx, dy: rl.at(x + dx, y + dy)
    L, R, U, D = nb(-1, 0), nb(1, 0), nb(0, -1), nb(0, 1)
    if 0 in (L, R, U, D): return OLH
    t = _leaf_tone(x, y)
    yy = y
    while rl.at(x, yy - 1) in (1, 2): yy -= 1
    yb = y
    while rl.at(x, yb + 1) == 2: yb += 1
    below = yb - y if r == 2 else 9
    if r == 2 and below <= 1: return K('midori', -1)                 # 밑동 그늘
    if r == 2 and below == 2: return K('midori', -1) if t <= 0 else K('midori', 0)
    if r == 1 and D == 2: return K('midori', 0) if t <= 0 else K('midori', 1)   # 윗면과 앞면 사이: 한 단 어둡게
    return K('midori', t) if t >= -1 else K('midori', -1)
def draw_hedge(m): return shade_roles(slab.roles_for(m, HEDGE_SPEC), hedge_shader)

# ═══════════════ 3. 철망 울타리 ═══════════════
def _ps(p, x, y, c): p.P(x, y, c)
def draw_mesh(m):
    p = Px(); T = lambda t: K('tekko', t)
    e, w, n, s_ = has(m, E_), has(m, W_), has(m, N_), has(m, S_)
    def harm(x0, x1):
        for x in range(x0, x1 + 1):
            p.P(x, 4, T(3)); p.P(x, 5, T(1))                          # 윗 레일(2px: 윗면 + 앞면)
            for y in range(6, 12):                                    # 그물: 1px 점 바둑(선 금지, 점만)
                if (x + y) % 2 == 0: p.P(x, y, T(1) if (x // 2 + y // 2) % 2 == 0 else T(2))
            p.P(x, 12, T(1)); p.P(x, 13, T(-1))                      # 아랫 레일(2px)
    if e: harm(8, 15)
    if w: harm(0, 7)
    def varm(y0, y1):
        for y in range(y0, y1 + 1):                                   # 세로 방향: 그물이 옆모습이라 2px 막대 하나로 보인다
            p.P(7, y, T(3)); p.P(8, y, T(1))
    if n: varm(0, 4)
    if s_: varm(4, 15)
    # 기둥(칸마다 가운데): 2px 폭, 머리 밝게 · 발치 어둡게
    for y in range(3, 14):
        p.P(7, y, T(2)); p.P(8, y, T(0))
    p.P(7, 3, T(3)); p.P(8, 3, T(2)); p.P(7, 13, T(-1)); p.P(8, 13, T(-2))
    p.P(6, 14, T(-2)); p.P(7, 14, T(-2)); p.P(8, 14, T(-2)); p.P(9, 14, T(-2))   # 기둥 밑 받침 그늘
    return p.img()

# ═══════════════ 4. 가드레일 ═══════════════
def draw_guard(m):
    p = Px(); S = lambda t: K('shiro', t); T = lambda t: K('tekko', t)
    e, w, n, s_ = has(m, E_), has(m, W_), has(m, N_), has(m, S_)
    def harm(x0, x1):
        for x in range(x0, x1 + 1):
            p.P(x, 5, S(1)); p.P(x, 6, S(0)); p.P(x, 7, T(0))        # 윗 보: 윗면 + 앞면 + 밑면 그늘
            p.P(x, 10, S(1)); p.P(x, 11, S(0)); p.P(x, 12, T(0))     # 아랫 보
    if e: harm(8, 15)
    if w: harm(0, 7)
    def varm(y0, y1):
        for y in range(y0, y1 + 1):                                   # 세로: 보를 위에서 본 띠(4px)
            p.P(6, y, S(1)); p.P(7, y, S(0)); p.P(8, y, S(-1)); p.P(9, y, T(0))
    if n: varm(0, 4)
    if s_: varm(4, 15)
    for y in range(3, 14):                                            # 기둥
        p.P(7, y, T(2)); p.P(8, y, T(0))
    p.P(7, 3, S(1)); p.P(8, 3, S(0)); p.P(7, 4, S(0)); p.P(8, 4, T(1))
    p.P(7, 8, K('aka', 2)); p.P(7, 9, K('aka', 1))                    # 반사판
    for x in (6, 7, 8, 9): p.P(x, 14, T(-2))
    return p.img()

# ═══════════════ 5. 선로 ═══════════════
_PEB = [(1, 2), (11, 3), (3, 9), (12, 12), (8, 14), (14, 7)]
def ballast():
    p = Px(); p.R(0, 0, 15, 15, K('hodo', -1))
    for i, (x, y) in enumerate(_PEB):
        p.P(x, y, K('hodo', 0)); p.P((x + 1) % 16, y, K('hodo', 0)); p.P(x, (y + 1) % 16, K('hodo', -2))
    return p

def _rail_h(p, y_top, x0, x1):
    for x in range(x0, x1 + 1):
        p.P(x, y_top, K('tekko', 3)); p.P(x, y_top + 1, K('tekko', 1))
def _rail_v(p, x_left, y0, y1):
    for y in range(y0, y1 + 1):
        p.P(x_left, y, K('tekko', 3)); p.P(x_left + 1, y, K('tekko', 1))
def _tie_v(p, x, y0=2, y1=13):                                         # 가로 레일용 침목(세로로 긴 널): 왼쪽 밝게
    for y in range(y0, y1 + 1):
        p.P(x, y, K('ita', 0)); p.P(x + 1, y, K('ita', -1)); p.P(x + 2, y, K('ita', -2))
def _tie_h(p, y, x0=2, x1=13):                                         # 세로 레일용 침목(가로로 긴 널): 위 밝게
    for x in range(x0, x1 + 1):
        p.P(x, y, K('ita', 0)); p.P(x, y + 1, K('ita', -1)); p.P(x, y + 2, K('ita', -2))
def _under_rail_h(p, y):                                               # 레일 밑에 드리운 침목 그늘(침목 위 화소만)
    for x in range(16):
        c = p.get(x, y)
        if c is not None and c in [K('ita', t) for t in (-2, -1, 0)]: p.P(x, y, K('ita', -3))
def _under_rail_v(p, x):
    for y in range(16):
        c = p.get(x, y)
        if c is not None and c in [K('ita', t) for t in (-2, -1, 0)]: p.P(x, y, K('ita', -3))

def _bumper(p, side):
    if side == 'W':
        for y in range(3, 13): p.P(3, y, K('tekko', 3)); p.P(4, y, K('tekko', 1))
        p.P(3, 3, K('aka', 2)); p.P(4, 3, K('aka', 1)); p.P(3, 4, K('aka', 1)); p.P(4, 4, K('aka', 0))
        for y in range(3, 13): p.P(5, y, K('tekko', -2))
    elif side == 'E':
        for y in range(3, 13): p.P(12, y, K('tekko', 1)); p.P(11, y, K('tekko', 3))
        p.P(11, 3, K('aka', 2)); p.P(12, 3, K('aka', 1)); p.P(11, 4, K('aka', 1)); p.P(12, 4, K('aka', 0))
        for y in range(3, 13): p.P(13, y, K('tekko', -2))
    elif side == 'N':
        for x in range(3, 13): p.P(x, 3, K('tekko', 3)); p.P(x, 4, K('tekko', 1))
        p.P(3, 3, K('aka', 2)); p.P(4, 3, K('aka', 2)); p.P(3, 4, K('aka', 1)); p.P(4, 4, K('aka', 1))
        for x in range(3, 13): p.P(x, 5, K('tekko', -2))
    elif side == 'S':
        for x in range(3, 13): p.P(x, 11, K('tekko', 3)); p.P(x, 12, K('tekko', 1))
        p.P(3, 11, K('aka', 2)); p.P(4, 11, K('aka', 2)); p.P(3, 12, K('aka', 1)); p.P(4, 12, K('aka', 1))
        for x in range(3, 13): p.P(x, 13, K('tekko', -2))

import math
def _arc_corner(p, cx, cy):
    """곡선 모서리: 8배 확대로 호를 그려 다수결로 줄인다(균일한 2px 선). 중심 (cx,cy) = 휘어 도는 안쪽 칸 모서리.
    레일 반지름 5·11(칸 가장자리에서 직선 레일과 같은 자리로 만난다), 침목은 호 길이 3.5·9.07 지점의 방사 띠(폭 3)."""
    SS = 8
    def cover(pred):
        m = np.zeros((16, 16), bool)
        for y in range(16):
            for x in range(16):
                n = 0
                for j in range(SS):
                    for i in range(SS):
                        if pred((x + (i + .5) / SS) - cx, (y + .5 + j) / 1.0 * 0 + (y + (j + .5) / SS) - cy): n += 1
                m[y, x] = n * 2 >= SS * SS
        return m
    # 시작 변(세로 변 쪽)에서 잰 각 a: 0 = 세로 이웃 쪽 가장자리, pi/2 = 가로 이웃 쪽 가장자리
    def ang(dx, dy): return math.atan2(abs(dx), abs(dy))
    rail = np.zeros((16, 16), bool)
    for R in (5.0, 11.0):
        rail |= cover(lambda dx, dy, R=R: abs(math.hypot(dx, dy) - R) <= 1.0)
    sleeper = np.zeros((16, 16), bool)
    for k in (3.5, math.pi * 4 - 3.5):
        a0 = k / 8.0
        sleeper |= cover(lambda dx, dy, a0=a0: 2.5 <= math.hypot(dx, dy) <= 13.5 and abs(ang(dx, dy) - a0) * math.hypot(dx, dy) <= 1.5)
    Lx = -1 / math.sqrt(2)
    for y in range(16):
        for x in range(16):
            if sleeper[y, x] and (abs(x + .5 - cx) < 2 or abs(y + .5 - cy) < 2): sleeper[y, x] = False   # 이웃 칸 침목과 겹치지 않게 변에서 2px 띄운다
    for y in range(16):
        for x in range(16):
            if sleeper[y, x]:
                dx, dy = x + .5 - cx, y + .5 - cy; d = math.hypot(dx, dy)
                # 침목: 호 방향 위치에 따라 왼쪽(시작 변 쪽)이 밝다 — 근사: 가장자리 화소 여부
                up = y > 0 and sleeper[y - 1, x]; lf = x > 0 and sleeper[y, x - 1]
                dn = y < 15 and sleeper[y + 1, x]; rt = x < 15 and sleeper[y, x + 1]
                t = 0 if (not up or not lf) else (-2 if (not dn or not rt) else -1)
                p.P(x, y, K('ita', t))
    for y in range(16):
        for x in range(16):
            if rail[y, x]:
                dx, dy = x + .5 - cx, y + .5 - cy; d = math.hypot(dx, dy)
                R = 5.0 if abs(d - 5.0) < abs(d - 11.0) else 11.0
                sg = d - R; nl = (dx / d) * Lx + (dy / d) * Lx
                if abs(nl) < 0.25: c = K('tekko', 2)
                else: c = K('tekko', 3) if sg * nl > 0 else K('tekko', 1)
                p.P(x, y, c)

def draw_rail(m):
    p = ballast()
    e, w, n, s_ = has(m, E_), has(m, W_), has(m, N_), has(m, S_)
    arms_n = bin(m).count('1')
    if arms_n == 2 and not (m in (5, 10)):                              # 곡선 모서리
        corner = {3: (16, 0), 6: (16, 16), 12: (0, 16), 9: (0, 0)}[m]
        _arc_corner(p, *corner); return p.img()
    h = e or w; v = n or s_
    if m == 0:                                                           # 외딴: 짧은 토막 + 양쪽 차막이
        _tie_v(p, 7); _rail_h(p, 4, 5, 10); _rail_h(p, 10, 5, 10)
        _under_rail_h(p, 6); _under_rail_h(p, 12)
        for x in (2, 3): pass
        for y in range(3, 13): p.P(2, y, K('tekko', 3)); p.P(3, y, K('tekko', 1)); p.P(12, y, K('tekko', 1)); p.P(13, y, K('tekko', 3))
        return p.img()
    # 침목 먼저
    if h:
        if w: _tie_v(p, 2)
        if e: _tie_v(p, 10)
    if v:
        if n: _tie_h(p, 2)
        if s_: _tie_h(p, 10)
    cross = (h and v)
    # 레일
    if h:
        x0 = 0 if w else (5 if arms_n == 1 else 0); x1 = 15 if e else (10 if arms_n == 1 else 15)
        if cross and not w: x0 = 10
        if cross and not e: x1 = 5
        if not cross or True:
            xs = (x0 if (w or cross) else x0, x1)
        _rail_h(p, 4, x0, x1); _rail_h(p, 10, x0, x1)
        _under_rail_h(p, 6); _under_rail_h(p, 12)
    if v:
        y0 = 0 if n else (5 if arms_n == 1 else 0); y1 = 15 if s_ else (10 if arms_n == 1 else 15)
        if cross and not n: y0 = 10
        if cross and not s_: y1 = 5
        _rail_v(p, 4, y0, y1); _rail_v(p, 10, y0, y1)
        _under_rail_v(p, 6); _under_rail_v(p, 12)
    if arms_n == 1:                                                      # 막다른 끝: 차막이
        _bumper(p, {E_: 'W', W_: 'E', N_: 'S', S_: 'N'}[m])
    return p.img()

# ═══════════════ 6. 중앙선(노란 이중 실선) ═══════════════
A1, A2 = (5, 6), (9, 10)
def _lane_base(m):
    """빛 방향이 없는 평면 표시라 기본형(직선·북동 모서리·북 끝·북동남 T·십자·외딴)만 그리고 회전으로 나머지를 만든다."""
    rects = []
    def V(xs, y0, y1):
        for x in xs: rects.append((x, y0, x, y1))
    def H(ys, x0, x1):
        for y in ys: rects.append((x0, y, x1, y))
    return rects, V, H
def _lane_pix(rects, col):
    p = Px()
    for x0, y0, x1, y1 in rects: p.R(x0, y0, x1, y1, col)
    return p
def draw_lane_center(m):
    col = K('kii', 1)
    if m in (5, 10):
        rects, V, H = _lane_base(m)
        if m == 5: V(A1, 0, 15); V(A2, 0, 15)
        else: H(A1, 0, 15); H(A2, 0, 15)
        return _lane_pix(rects, col).img()
    if m == 0:
        rects, V, H = _lane_base(m); H(A1, 4, 11); H(A2, 4, 11); return _lane_pix(rects, col).img()
    if m == 15:                                    # 십자: 교차로 한가운데는 비운다 — 팔 넷의 토막만
        rects, V, H = _lane_base(m)
        V(A1, 0, 3); V(A2, 0, 3); V(A1, 12, 15); V(A2, 12, 15); H(A1, 0, 3); H(A2, 0, 3); H(A1, 12, 15); H(A2, 12, 15)
        return _lane_pix(rects, col).img()
    # 기본형 → 회전
    base = {1: 1, 2: 1, 4: 1, 8: 1, 3: 3, 6: 3, 12: 3, 9: 3, 7: 7, 14: 7, 13: 7, 11: 7}[m]
    k = 0
    while rot_mask(base, k) != m: k += 1
    rects, V, H = _lane_base(base)
    if base == 1:                                  # 북 끝: 두 줄이 가운데까지 와서 끝난다
        V(A1, 0, 8); V(A2, 0, 8)
    elif base == 3:                                # 북동 모서리: 바깥줄은 크게 돌고 안쪽줄은 작게 돈다
        V(A1, 0, 10); H(A2, 5, 15)                 # 바깥: 북쪽 왼줄 → 동쪽 아랫줄
        V(A2, 0, 6); H(A1, 9, 15)                  # 안쪽: 북쪽 오른줄 → 동쪽 윗줄
    elif base == 7:                                # 북동남 T: 세로 본선은 이어지고 동쪽 가지가 붙는다
        V(A1, 0, 15); V(A2, 0, 15); H(A1, 11, 15); H(A2, 11, 15)
    img = _lane_pix(rects, col).img()
    return rot90(img, k)

# ═══════════════ 7. 차선 점선(흰 점선) ═══════════════
def draw_lane_dash(m):
    col = K('shiro', 1); p = Px()
    if m == 10: p.R(4, 7, 11, 8, col); return p.img()
    if m == 5: p.R(7, 4, 8, 11, col); return p.img()
    if m == 0: p.R(6, 7, 9, 8, col); return p.img()
    arm = {E_: (7, 7, 13, 8), W_: (2, 7, 8, 8), N_: (7, 2, 8, 8), S_: (7, 7, 8, 13)}
    for b, r in arm.items():
        if m & b: p.R(*r, col)
    return p.img()

# ═══════════════ 8. 횡단보도(일본식: 줄이 차 진행 방향과 평행) ═══════════════
def draw_crosswalk(axis):
    """axis 'ew': 보행 방향이 동서 → 줄무늬는 남북으로 긴 막대, 칸마다 2줄(폭 4 · 간격 4). 위아래로 이어 붙이면 줄이 길어진다.
    axis 'ns': 보행 방향이 남북 → 줄무늬는 동서로 긴 막대."""
    def make(cm):
        p = Px(); col = K('shiro', 2); wear = K('shiro', 1)
        for a in ((2, 5), (10, 13)):
            if axis == 'ew': p.R(a[0], 0, a[1], 15, col)
            else: p.R(0, a[0], 15, a[1], col)
        # 낡은 자국(칠 벗겨짐): 줄 안쪽에 어두운 한 단 화소 몇 개 — 이웃 칸과 안 겹치게 가운데쪽에만
        for (x, y) in ((3, 4), (11, 10), (4, 11), (12, 3)):
            if axis == 'ew': p.P(x, y, wear)
            else: p.P(y, x, wear)
        return p.img()
    return make

# ═══════════════ 9. 점자블록 선 ═══════════════
def _tac_h(y, x):                                       # 가로 안내블록(줄이 진행 방향 = 가로) 한 화소
    r = y - 3
    if r < 0 or r > 9: return None
    return {0: K('kii', 0), 1: K('kii', 2), 2: K('kii', 1), 3: K('kii', 0), 4: K('kii', 2), 5: K('kii', 1), 6: K('kii', 0), 7: K('kii', 2), 8: K('kii', 1), 9: K('kii', 0)}[r]
def _tac_v(y, x):
    return _tac_h(x, y)
def draw_tactile(m):
    p = Px()
    e, w, n, s_ = has(m, E_), has(m, W_), has(m, N_), has(m, S_)
    if m == 10:
        for y in range(3, 13):
            for x in range(16): p.P(x, y, _tac_h(y, x))
        return p.img()
    if m == 5:
        for x in range(3, 13):
            for y in range(16): p.P(x, y, _tac_v(y, x))
        return p.img()
    if e:
        for y in range(3, 13):
            for x in range(12, 16): p.P(x, y, _tac_h(y, x))
    if w:
        for y in range(3, 13):
            for x in range(0, 4): p.P(x, y, _tac_h(y, x))
    if n:
        for x in range(3, 13):
            for y in range(0, 4): p.P(x, y, _tac_v(y, x))
    if s_:
        for x in range(3, 13):
            for y in range(12, 16): p.P(x, y, _tac_v(y, x))
    # 점 블록(경고): 방향이 바뀌는 곳·끝·외딴 칸
    for y in range(3, 13):
        for x in range(3, 13):
            ring = (x in (3, 12) or y in (3, 12))
            p.P(x, y, K('kii', 0) if ring else K('kii', 1))
    for dx in (4, 7, 10):
        for dy in (4, 7, 10):
            p.P(dx, dy, K('kii', 2)); p.P(dx + 1, dy, K('kii', 2)); p.P(dx, dy + 1, K('kii', 2)); p.P(dx + 1, dy + 1, K('kii', 0))
    return p.img()

# ═══════════════ 세트 정의 표 ═══════════════
SETS = {}
def reg(**kw): SETS[kw['id']] = kw

reg(id='jp-wall-block', ko='블록담', role='wall', pc='solid', layer='upper', draw=draw_wall, bg='lawn',
    label='블록담', desc='콘크리트 블록 담(높이 1칸). 막힘. 이웃 블록담과 이어지고 끝·모서리·T·십자에 기둥이 선다.', tags=['담', '울타리', '막힘'])

reg(id='jp-hedge', ko='생울타리', role='edge', pc='solid', layer='upper', draw=draw_hedge, bg='flat',
    label='생울타리', desc='녹색 생울타리(높이 1칸). 막힘. 집 마당·공원 경계에 두른다.', tags=['울타리', '식물', '막힘'])

def build_set(sp):
    """로컬 키 `<세트>.m<마스크>`. canon 이 있으면(횡단보도) 마스크를 줄여 같은 칸을 가리키게 한다."""
    cells = {}; vmap = {}
    canon = sp.get('canon', lambda m: m)
    for m in range(16):
        cm = canon(m); key = '%s.m%d' % (sp['id'], cm)
        if key not in cells: cells[key] = sp['draw'](cm)
        vmap[str(m)] = key
    return cells, vmap

ORDER = ['jp-wall-block', 'jp-hedge', 'jp-fence-mesh', 'jp-guardrail', 'jp-rail-track', 'jp-lane-center', 'jp-lane-dash', 'jp-crosswalk-ew', 'jp-crosswalk-ns', 'jp-tactile']
GROUPS = [   # (그룹 id, 이름, role, 세트들, 규칙 문구)
    ('jp:wall-block', '블록담', 'wall', ['jp-wall-block'], '막힘(위층). 담이 지나갈 칸을 칠하면 끝·모서리·T·십자에 기둥이 자동으로 선다. 문(철문)은 담 한 칸을 비우고 놓는다.'),
    ('jp:hedge', '생울타리', 'edge', ['jp-hedge'], '막힘(위층). 마당·공원 경계 선으로 칠한다. 모서리·끝은 자동으로 둥글게 맞춘다.'),
    ('jp:fence-mesh', '철망 울타리', 'edge', ['jp-fence-mesh'], '막힘(위층). 칸마다 기둥이 하나, 가로 칸 사이는 그물. 세로 방향은 옆모습이라 가는 막대로 보인다.'),
    ('jp:guardrail', '가드레일', 'edge', ['jp-guardrail'], '막힘(위층). 차도와 보도 사이 선으로 칠한다. 건널목·출입구 자리는 한 칸 이상 비운다.'),
    ('jp:rail-track', '선로', 'path', ['jp-rail-track'], '아래층 불투명 칸(자갈 포함, 걸어 지나갈 수 있음). 건널 때 위험하다 — 건널목(차단기·경보기) 말고는 건너게 두지 말 것. T·십자는 분기기가 아닌 평면 교차이다.'),
    ('jp:lane-center', '중앙선', 'road', ['jp-lane-center'], '도로 위에 얹는 투명 오버레이(아래층 위 2층). 도로 칸 위에 선을 칠한다. 십자 칸은 가운데가 비어 교차로가 열린다.'),
    ('jp:lane-dash', '차선 점선', 'road', ['jp-lane-dash'], '도로 위에 얹는 투명 오버레이. 직선 칸마다 흰 점선 한 마디.'),
    ('jp:crosswalk', '횡단보도', 'road', ['jp-crosswalk-ew', 'jp-crosswalk-ns'], '도로 위에 얹는 투명 오버레이. 보행 방향이 동서면 ew, 남북이면 ns. 보행 방향으로 이어 폭을 늘리고 차선 수만큼 위아래(ns는 좌우)로 겹쳐 깐다.'),
    ('jp:tactile', '점자블록 선', 'path', ['jp-tactile'], '보도 위에 얹는 투명 오버레이. 선은 안내블록, 방향이 바뀌는 곳·끝은 경고블록(점).'),
]
PC_LABEL = {'solid': '막힘', 'floor': '통행', 'flat': '통행'}

def build():
    """계약 블록 인터페이스. 부작용 없음 · 같은 입력이면 같은 결과(난수 없음)."""
    cells = {}; autotiles = []; groups = []
    for sid in ORDER:
        sp = SETS[sid]; cs, vmap = build_set(sp)
        for key, im in cs.items():
            m = int(key.rsplit('.m', 1)[1])
            lab = '%s · %s' % (sp['label'], MASK_KO[m])
            cells[key] = {'img': im, 'pc': sp['pc'], 'label': lab, 'desc': sp['desc'], 'tags': list(sp['tags'])}
        autotiles.append({'id': sid, 'name': sp['label'], 'neighborhood': 4, 'layer': sp['layer'], 'member': list(cs.keys()), 'connect': [],
                          'variantMap': vmap, 'interior': None, 'edgeConnects': False})
    for gid, name, role, sids, rules in GROUPS:
        mem = []
        for sid in sids:
            for k in build_set(SETS[sid])[0].keys():
                if k not in mem: mem.append(k)
        lay = SETS[sids[0]]['layer']
        groups.append({'id': gid, 'name': name, 'role': role, 'defaultLayer': lay, 'cells': mem, 'desc': SETS[sids[0]]['desc'], 'rules': rules})
    notes = ('선형 오토타일 9세트(10 오토타일), 4방 16키. 막힘 4세트(블록담·생울타리·철망·가드레일)는 pc=solid(위층) — 담 칸은 한 칸 안(윗면 rows 2..5 + 앞면 6..13)에 그려 '
             '사람이 담 남쪽 칸에 서면 머리 윗 8px 가 담 앞면에 가려진다(solid 는 항상 캐릭터 위층). 선로는 불투명 floor. 표시류(중앙선·점선·횡단보도·점자블록)는 투명 flat 오버레이. '
             '횡단보도의 양 끝·몸통·외딴 4칸은 줄 간격이 칸 주기(8px)라 그림이 같다(키만 4종). 선로 T·십자는 분기기 없이 평면 교차로 그린다.')
    return {'cells': cells, 'autotiles': autotiles, 'groups': groups, 'kits': [], 'notes': notes}

def selftest(ids=None, verbose=True):
    """계약 (a)~(d): 칸 검사 · 키 완전성 · 이음새(실루엣 알파 끊김 0) · 마스크 맵 PNG. 반환: 문제 수."""
    problems = 0
    for sid in (ids or SETS):
        sp = SETS[sid]; cells, vmap = build_set(sp)
        bad = []
        for k, im in cells.items():
            for b in check_cell(im): bad.append((k, b))
        miss = [m for m in range(16) if str(m) not in vmap or vmap[str(m)] not in cells]
        er = edge_report(cells, vmap); sh, sv = seam_rows(cells, vmap)
        # (c) 직선 3칸 반복의 맞닿음은 edge_report(경계 일관성)+seam_rows(참고)로 본다
        render_set(sid)
        n = len(set(vmap.values()))
        if verbose: print('%-16s 칸 %2d · 키 %d/16 · 칸검사 문제 %d · 경계 불일치 %d · 직선 맞닿음 알파차 H%d V%d · 마스크맵 PNG' % (sid, n, 16 - len(miss), len(bad), len(er), sh, sv))
        for x in bad[:5]: print('   ', x)
        for x in er[:6]: print('    경계 불일치', x)
        problems += len(bad) + len(miss) + len(er)
    return problems

reg(id='jp-fence-mesh', ko='철망 울타리', role='edge', pc='solid', layer='upper', draw=draw_mesh, bg='flat',
    label='철망 울타리', desc='가는 기둥과 그물의 철망 울타리(높이 1칸). 막힘. 학교·공터·주차장 둘레.', tags=['울타리', '철망', '막힘'])
reg(id='jp-guardrail', ko='가드레일', role='edge', pc='solid', layer='upper', draw=draw_guard, bg='flat',
    label='가드레일', desc='은색 가드레일(횡 막대 둘 + 기둥, 반사판). 막힘. 차도와 보도 사이 경계.', tags=['가드레일', '도로', '막힘'])
reg(id='jp-rail-track', ko='선로', role='path', pc='floor', layer='lower', draw=draw_rail, bg=None,
    label='선로', desc='자갈 위 레일 두 줄과 침목. 걸어서 지나갈 수 있지만 건널 때 위험하다(열차 건널목 밖에서는 건너지 말 것). 직선·곡선·끝(차막이).', tags=['선로', '철도', '자갈'])

reg(id='jp-lane-center', ko='중앙선', role='road', pc='flat', layer='lower', draw=draw_lane_center, bg='road',
    label='중앙선', desc='도로 위에 얹는 노란 이중 실선(투명 오버레이). 교차로(십자)에서는 가운데가 비어 선이 끊긴다.', tags=['도로', '차선', '오버레이'])
reg(id='jp-lane-dash', ko='차선 점선', role='road', pc='flat', layer='lower', draw=draw_lane_dash, bg='road',
    label='차선 점선', desc='도로 위에 얹는 흰 점선(투명 오버레이). 직선은 칸마다 점선 한 마디, 모서리·끝은 팔 토막.', tags=['도로', '차선', '오버레이'])

reg(id='jp-crosswalk-ew', ko='횡단보도', role='road', pc='flat', layer='lower', draw=draw_crosswalk('ew'), canon=lambda m: m & 10, bg='road',
    label='횡단보도(동서)', desc='보행 방향이 동서인 횡단보도. 일본식: 흰 줄이 차 진행 방향(남북)과 평행. 동서로 이어 폭을 늘리고 위아래로 겹쳐 차선 수만큼 길이를 맞춘다. 투명 오버레이.', tags=['도로', '횡단보도', '오버레이'])
reg(id='jp-crosswalk-ns', ko='횡단보도', role='road', pc='flat', layer='lower', draw=draw_crosswalk('ns'), canon=lambda m: m & 5, bg='road',
    label='횡단보도(남북)', desc='보행 방향이 남북인 횡단보도. 일본식: 흰 줄이 차 진행 방향(동서)과 평행. 남북으로 이어 폭을 늘리고 좌우로 겹쳐 차선 수만큼 길이를 맞춘다. 투명 오버레이.', tags=['도로', '횡단보도', '오버레이'])
reg(id='jp-tactile', ko='점자블록 선', role='path', pc='flat', layer='lower', draw=draw_tactile, bg='sw',
    label='점자블록 선', desc='보도 위에 얹는 노란 점자블록 선(투명 오버레이). 직선은 안내블록(줄), 방향이 바뀌는 곳·끝·외딴 칸은 경고블록(점).', tags=['보도', '점자블록', '오버레이'])

# ═══════════════ 렌더(눈 확인) ═══════════════
def bg_tile(kind):
    if kind == 'lawn': return ref_cell('st.lawn')
    if kind == 'road': return ref_cell('st.road_c')
    if kind == 'sw': return ref_cell('st.sw')
    if kind == 'flat':
        p = Px(); p.R(0, 0, 15, 15, K('hodo', 2)); return p.img()
    if kind == 'pave': return ref_cell('st.pave_a')
    return ref_cell('st.lawn')

def render_set(sid, scale=(1, 4)):
    sp = SETS[sid]; cells, vmap = build_set(sp)
    grid = test_grid()
    bgi = bg_tile(sp['bg'])
    im = compose({k: v for k, v in cells.items()}, vmap, grid, bg=bgi, size=(25, 18))
    os.makedirs(OUTDIR, exist_ok=True)
    im.save(os.path.join(OUTDIR, '%s-mask-map.png' % sid))
    im.resize((im.width * 4, im.height * 4), Image.NEAREST).save(os.path.join(OUTDIR, '%s-mask-map-x4.png' % sid))
    # 16칸 전체 시트
    sheet = Image.new('RGBA', (16 * 18 * 3, 18 * 3), (0, 0, 0, 255))
    for m in range(16):
        t = Image.new('RGBA', (16, 16)); t.alpha_composite(bgi); t.alpha_composite(cells[vmap[str(m)]])
        sheet.alpha_composite(t.resize((48, 48), Image.NEAREST), (m * 54, 0))
    sheet.save(os.path.join(OUTDIR, '%s-pieces.png' % sid))
    return im

def _layer(out, sid, grid):
    sp = SETS[sid]; cs, vmap = build_set(sp)
    for (x, y) in sorted(grid, key=lambda c: (c[1], c[0])):
        out.alpha_composite(cs[vmap[str(mask_of(grid, x, y))]], (x * 16, y * 16))

def render_overview():
    """전 세트 한 장: 세트마다 16조각(마스크 0..15) ×3 을 알맞은 바닥 위에."""
    sc = 3; pad = 4
    W = 16 * (16 * sc + pad) + 150; H = len(ORDER) * (16 * sc + 10)
    out = Image.new('RGBA', (W, H), (30, 28, 36, 255))
    for r, sid in enumerate(ORDER):
        sp = SETS[sid]; cs, vmap = build_set(sp); bg = bg_tile(sp['bg'])
        for m in range(16):
            t = Image.new('RGBA', (16, 16)); t.alpha_composite(bg); t.alpha_composite(cs[vmap[str(m)]])
            out.alpha_composite(t.resize((16 * sc, 16 * sc), Image.NEAREST), (150 + m * (16 * sc + pad), r * (16 * sc + 10)))
    out.save(os.path.join(OUTDIR, 'overview.png'))
    return out

def render_street_scene():
    """새 세트로 깐 거리 장면(위) 과 기존 시트 칸으로 깐 같은 구성(아래)을 나란히 — 같은 게임인지 눈 판정용(×3)."""
    Wc, Hc = 26, 11
    def base(old):
        im = Image.new('RGBA', (Wc * 16, Hc * 16), (0, 0, 0, 255))
        for y in range(Hc):
            for x in range(Wc):
                n = 'st.sw' if (y <= 1 or y >= 9) else 'st.road_c'
                im.alpha_composite(ref_cell(n), (x * 16, y * 16))
        return im
    new = base(False)
    _layer(new, 'jp-lane-center', {(x, 5) for x in range(0, 26)} - {(x, 5) for x in range(10, 14)})
    _layer(new, 'jp-lane-dash', {(x, 3) for x in range(0, 26)} | {(x, 7) for x in range(0, 26)})
    _layer(new, 'jp-crosswalk-ns', {(x, y) for x in (11, 12) for y in range(2, 9)} | set())
    _layer(new, 'jp-tactile', {(x, 1) for x in range(0, 26)} | {(x, 9) for x in range(0, 26)} - {(x, 9) for x in range(12, 16)})
    _layer(new, 'jp-guardrail', {(x, 2) for x in range(0, 11)} | {(x, 2) for x in range(14, 26)})
    _layer(new, 'jp-fence-mesh', {(x, 0) for x in range(0, 9)})
    _layer(new, 'jp-hedge', {(x, 0) for x in range(9, 17)})
    _layer(new, 'jp-wall-block', {(x, 0) for x in range(17, 26)} | {(25, 1)})
    old = base(True)
    G = ref_cell('st.guard'); Z = ref_cell('st.zeb_c'); LC = ref_cell('st.lane_c'); LN = ref_cell('st.lane_n'); LS = ref_cell('st.lane_s')
    for x in range(26):
        if not (10 <= x <= 13): old.alpha_composite(ref_cell('st.stop_c') if False else LC, (x * 16, 5 * 16))
        if not (11 <= x <= 14): old.alpha_composite(G, (x * 16, 2 * 16))
        old.alpha_composite(ref_cell('st.tactile_bar'), (x * 16, 1 * 16))
    for y in range(2, 9):
        for x in (11, 12): old.alpha_composite(ref_cell('st.cw_m'), (x * 16, y * 16))
    for x in range(9): old.alpha_composite(ref_cell('prop.wall.board.c0.r1'), (x * 16, 0))
    for x in range(9, 17): old.alpha_composite(ref_cell('prop.wall.hedge.c0.r1'), (x * 16, 0))
    for x in range(17, 26): old.alpha_composite(ref_cell('prop.wall.block.c0.r0'), (x * 16, 0))
    out = Image.new('RGBA', (Wc * 16 * 3, Hc * 16 * 3 * 2 + 16), (20, 18, 26, 255))
    out.alpha_composite(new.resize((Wc * 48, Hc * 48), Image.NEAREST), (0, 0))
    out.alpha_composite(old.resize((Wc * 48, Hc * 48), Image.NEAREST), (0, Hc * 48 + 16))
    out.save(os.path.join(OUTDIR, 'street-compare.png'))
    # 선로 비교: 위 = 새 선로(직선·곡선·끝), 아래 = 기존 st.rail 칸
    g = {(x, 0) for x in range(0, 9)} | {(9, y) for y in range(0, 4)}
    r1 = Image.new('RGBA', (12 * 16, 4 * 16), (0, 0, 0, 255)); _layer(r1, 'jp-rail-track', g)
    r2 = Image.new('RGBA', (12 * 16, 2 * 16), (0, 0, 0, 255))
    for x in range(12): r2.alpha_composite(ref_cell('st.rail'), (x * 16, 0)); r2.alpha_composite(ref_cell('st.rail'), (x * 16, 16))
    rc = Image.new('RGBA', (12 * 16 * 4, (4 + 2) * 16 * 4 + 12), (20, 18, 26, 255))
    rc.alpha_composite(r1.resize((12 * 64, 4 * 64), Image.NEAREST), (0, 0)); rc.alpha_composite(r2.resize((12 * 64, 2 * 64), Image.NEAREST), (0, 4 * 64 + 12))
    rc.save(os.path.join(OUTDIR, 'rail-compare.png'))
    return out

if __name__ == '__main__':
    ids = [a for a in sys.argv[1:] if not a.startswith('--')] or None
    code = selftest(ids)
    if not ids: render_overview(); render_street_scene()
    sys.exit(1 if code else 0)
