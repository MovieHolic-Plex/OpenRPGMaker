"""3/4 시점 탈것 v3: 옆면 + 윗면. 바퀴=속찬 원반+허브(휠 아치 오목), 유리는 지붕 폭 안, 열차는 대차+레일."""
import random
from parts_tokyo import *
from v2core import ink2

CAR_BODY2 = {'white': ('shiro', 3), 'silver': ('conc', 3), 'black': ('tekko', 0), 'red': ('aka', 1), 'blue': ('sora', 1), 'taxi': ('kii', 2), 'green': ('midori', 1), 'navy': ('kon', 1)}
from v2core import wheel as _w2
def _wheel(c, x, y, r=5):
    _w2(c, x, y, r)
def _arch(c, x, y, r, col):
    """휠 아치: 바퀴 위를 반원으로 파낸 어두운 오목 + 위쪽 가장자리 한 줄 밝게."""
    for yy in range(-r - 1, 1):
        for xx in range(-r - 1, r + 1):
            if (xx + .5) ** 2 + yy * yy <= (r + 1) ** 2: c.P(x + xx, y + yy, K('tekko', -2))

import json as _json, os as _os
import numpy as _np
_CONTRACT = _json.load(open(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..', '..', '..', '..', 'tiledata', 'jp-city', 'palette-contract.json'), encoding='utf-8'))
_CRAMP = {m['id']: [int(h[1:], 16) for h in m['steps']] for f in _CONTRACT['families'] for m in f['materials']}
def J(mat, s):
    """계약 재료 mat 의 단 s(0 깊은 그늘 … 4 하이라이트). 범위를 넘으면 끝 단."""
    return _CRAMP[mat][max(0, min(4, s))]

# 승용차 3/4 색 변형: (계약 재료, 옆면 기본 단 b, 윤곽 색). 윗면 = b+1, 접힘·문선 = b-2.
CAR34 = {'white': ('vending_cool_white', 2, 4, J('concrete_grey', 0)), 'silver': ('concrete_grey', 2, 4, J('asphalt', 1)),
         'black': ('asphalt', 1, 3, K('yoru', -3)), 'red': ('torii_vermilion', 2, 3, J('torii_vermilion', 0)),
         'blue': ('arcade_skylight_slate', 2, 3, J('canal_indigo', 0)), 'taxi': ('lantern_amber', 2, 3, J('lantern_amber', 0)),
         'green': ('pine_bamboo', 2, 3, J('pine_bamboo', 0)), 'navy': ('noren_indigo', 2, 3, J('noren_indigo', 0))}


def _outline(c, col, skip=None):
    """불투명 실루엣 바깥 1px 를 col 로(재질 톤 윤곽). skip(x, y) 가 참인 자리는 두지 않는다."""
    a = c.a[..., 3] > 0; pad = _np.pad(a, 1)
    nb = pad[:-2, 1:-1] | pad[2:, 1:-1] | pad[1:-1, :-2] | pad[1:-1, 2:]
    ys, xs = _np.nonzero(nb & ~a)
    for y, x in zip(ys, xs):
        if skip is None or not skip(x, y): c.P(int(x), int(y), col)


def _sedan34(color):
    """80x48 승용차, 동서로 선 차를 남쪽 위에서 비스듬히 내려다본 3/4. 진행 방향 오른쪽(동).
    줄 배치: 지붕 윗면 10..18(9줄) · 옆 창 면 19..28 · 보닛/트렁크 윗면 21..28(8줄) · 접힘 29 · 옆면 30..41(12줄) · 바퀴 중심 42 · 그림자 43..46.
    앞유리·뒷유리는 지붕 앞뒤 모서리와 보닛·트렁크 뒤 모서리를 잇는 기운 띠(평행사변형)."""
    c = Cv(80, 48); mat, b, tb, OLC = CAR34[color]
    R = lambda s: J(mat, s)
    top, topH, side, sideH, lo, dk = R(tb), R(tb + 1), R(b), R(b + 1), R(b - 1), R(b - 2)
    if tb >= 4: top, topH = R(3), R(4)
    mid = R(tb - 1) if tb - 1 > b else R(b)                                  # 윗면의 먼(북) 모서리
    G = lambda s: K('garasu', s)                                            # 유리: -3 … +3
    X0, X1 = 6, 73                                                           # 차체 좌우 끝(트렁크 뒤 · 범퍼 앞)
    RB, RF = 27, 47                                                          # 지붕 뒤·앞 끝 x
    TB, HF = 17, 58                                                          # 트렁크 앞 끝 · 보닛 뒤 끝 x
    # ── 그림자(차 밑 접지) ──
    c.R(X0 + 2, 43, X1 - X0 - 3, 3, K('yoru', -3)); c.HL(X0 + 5, 46, X1 - X0 - 9, K('yoru', -2))
    # ── 옆면(남쪽 면) 30..41 ──
    c.R(X0, 30, X1 - X0 + 1, 12, side)
    c.HL(X0 + 1, 31, X1 - X0 - 1, sideH)                                     # 어깨 빛(접힘 밑 한 줄)
    c.HL(X0, 35, X1 - X0 + 1, lo)                                            # 캐릭터 라인(오목)
    c.HL(X0 + 1, 36, X1 - X0 - 1, sideH)
    c.R(X0, 38, X1 - X0 + 1, 2, lo); c.R(X0, 40, X1 - X0 + 1, 2, dk)         # 아래 그늘 · 사이드 스커트
    # 문선·손잡이는 x=39.5 좌우 대칭(가운데 아래 칸이 반전 차와 같은 칸으로 묶여 칸 수가 늘지 않게)
    for x in (24, 55): c.VL(x, 30, 9, dk)                                    # 앞문 앞 · 뒷문 뒤 문선
    c.VL(39, 30, 9, dk); c.VL(40, 30, 9, dk)                                 # 가운데 문선(B 기둥 밑)
    for x in (35, 42): c.HL(x, 33, 3, dk); c.HL(x, 32, 3, sideH)             # 손잡이
    c.R(X1 - 2, 31, 3, 3, J('lantern_amber', 3)); c.P(X1 - 1, 31, J('lantern_amber', 4)); c.HL(X1 - 2, 34, 3, J('lantern_amber', 1))   # 전조등
    c.R(X0, 31, 2, 3, J('torii_vermilion', 2) if mat != 'torii_vermilion' else J('lantern_amber', 2)); c.P(X0, 31, J('torii_vermilion', 4))  # 후미등
    c.R(X1 - 3, 38, 4, 2, J('paving_stone', 1)); c.HL(X1 - 3, 38, 4, J('paving_stone', 3))   # 앞 범퍼 하단
    c.R(X0, 38, 3, 2, J('paving_stone', 1)); c.HL(X0, 38, 3, J('paving_stone', 3))           # 뒤 범퍼 하단
    # ── 보닛·트렁크 윗면 21..28 ──
    for (x0, x1) in ((X0, TB), (HF, X1)):
        c.R(x0, 21, x1 - x0 + 1, 8, top)
        c.HL(x0, 21, x1 - x0 + 1, mid)                                       # 뒤(북) 모서리는 둥글게 한 단 어둡게
        c.HL(x0 + 1, 22, x1 - x0 - 1, topH)                                  # 빛 받는 결
        c.HL(x0, 28, x1 - x0 + 1, topH)                                      # 앞 모서리 입술
    c.HL(HF + 3, 25, X1 - HF - 5, sideH); c.HL(HF + 3, 24, X1 - HF - 5, topH)  # 보닛 가운데 주름
    c.P(X1, 21, None); c.P(X1, 22, None); c.P(X0, 21, None)                  # 모서리 둥글게
    c.HL(X0, 29, X1 - X0 + 1, dk)                                            # 윗면 ↔ 옆면 접힘선
    # ── 앞·뒤 유리(기운 띠) + 옆 창 면 ──
    for y in range(10, 30):
        for x in range(X0, X1 + 1):
            tf = (x - RF - 1) / (HF - RF - 1); df = y - 10 - 11 * tf                   # 앞유리: 지붕 앞 → 보닛 뒤
            tr = (RB - 1 - x) / (RB - 1 - TB); dr = y - 10 - 11 * tr                   # 뒷유리: 지붕 뒤 → 트렁크 앞
            if 0 <= tf <= 1 and 0 <= df <= 8:
                edge = df < 1 or df > 7 or tf > .9
                k = side if edge else (G(1) if (df - 2 * tf * 3) % 6 < 2 else G(-1) if df > 5 else G(0))
                c.P(x, y, k)
            elif 0 <= tr <= 1 and 0 <= dr <= 8:
                edge = dr < 1 or dr > 7 or tr > .9
                k = side if edge else (G(0) if dr < 3 else G(-1) if dr < 6 else G(-2))
                c.P(x, y, k)
    for y in range(19, 29):                                                   # 옆 창 면: 남쪽 기둥 두 줄 사이
        t = (y - 18) / 11; xl = int(round(RB - 1 - (RB - 1 - TB) * t)); xr = int(round(RF + 1 + (HF - RF - 1) * t))
        for x in range(xl, xr + 1): c.P(x, y, side)
        c.P(xl, y, lo); c.P(xr, y, lo)
        if 20 <= y <= 26:
            for x in range(xl + 2, xr - 1):
                if x in (39, 40): continue                                    # B 기둥
                g = G(-2) if y >= 25 else G(-1) if y >= 22 else G(0)
                if (x - y) % 11 in (0, 1) and y <= 24: g = G(1)               # 유리 반사 사선 2단
                if (x - y) % 11 == 2 and y <= 24: g = G(2)
                c.P(x, y, g)
    c.VL(39, 20, 7, dk); c.VL(40, 20, 7, side)
    # ── 지붕 윗면 10..18 ──
    c.R(RB, 10, RF - RB + 1, 9, top)
    c.HL(RB + 1, 10, RF - RB - 1, mid)                                       # 뒤 모서리(멀다)
    c.HL(RB, 11, RF - RB + 1, topH); c.VL(RB, 11, 7, topH)                    # 빛: 왼쪽 위
    c.HL(RB, 18, RF - RB + 1, mid); c.VL(RF, 11, 7, mid)                    # 앞 모서리 둥글게
    for x in range(RB + 4, RF - 3, 7): c.HL(x, 14 + (x // 7) % 2, 3, topH)   # 미세한 광택
    c.R(HF - 2, 27, 2, 2, side); c.P(HF - 2, 27, dk)                          # 사이드 미러
    if color == 'taxi':                                                       # 택시 표시등
        tx = (RB + RF) // 2 - 4
        c.R(tx, 6, 9, 2, J('vending_cool_white', 4)); c.R(tx, 8, 9, 3, J('vending_cool_white', 2))
        c.HL(tx + 1, 9, 7, J('torii_vermilion', 2)); c.HL(tx, 11, 9, dk)
    # ── 바퀴: 휠 아치(오목) + 아래 반원이 몸 밑으로 ──
    for wx in (TB - 1, HF + 3):
        for yy in range(36, 42):
            for xx in range(wx - 6, wx + 6):
                if (xx + .5 - wx) ** 2 + (yy + .5 - 42) ** 2 <= 36: c.P(xx, yy, J('asphalt', 0))
        c.HL(wx - 5, 35, 10, dk)                                              # 아치 가장자리
        for yy in range(37, 47):
            for xx in range(wx - 5, wx + 5):
                d = (xx + .5 - wx) ** 2 + (yy + .5 - 42) ** 2
                if d <= 25:
                    col = J('asphalt', 1) if d > 9 else J('paving_stone', 3) if d > 2.5 else J('paving_stone', 1)
                    if d > 9 and yy < 40: col = J('asphalt', 0)                # 아치 그늘에 든 위쪽 타이어
                    c.P(xx, yy, col)
        c.P(wx - 2, 40, J('paving_stone', 4)); c.HL(wx - 5, 46, 10, K('yoru', -3))
    _outline(c, OLC, skip=lambda x, y: y >= 44)
    return c


def car(color='white', kind='sedan', flip=False):
    if kind != 'van':
        out = _sedan34(color)
        if flip: out.a[:] = out.a[:, ::-1]
        return out
    return _car_v3(color, kind, flip)


def _car_v3(color='white', kind='sedan', flip=False):
    """80x48. 진행 방향 오른쪽. 위=윗면(트렁크·지붕·보닛), 아래=옆면. 윗면은 앞면보다 한 단 밝고 경계에 어두운 접힘선."""
    c = Cv(80, 48); ramp, t = CAR_BODY2[color]
    n5 = len(RAMPS[ramp]) == 5; mx = 2 if n5 else 3
    if color == 'black': t = -1                                                           # 윗면·앞면 명도 차를 확보
    t = min(t, mx - 1)                                                                    # 윗면(t+1)이 항상 한 단 더 밝다
    bod = K(ramp, t); top = K(ramp, t + 1); topE = K(ramp, t + 2); lo = K(ramp, t - 1); dk = K(ramp, t - 2)
    glass = K('garasu', 2); glass_hi = K('garasu', 4); gdk = K('garasu', 0)
    if kind == 'van':
        # 화물칸 윗면(넓음) / 캐빈 지붕(낮고 좁음) / 앞면. 캐빈 앞유리는 앞으로 기운 사다리꼴.
        c.R(5, 11, 51, 9, top); c.HL(6, 11, 49, topE); c.VL(5, 12, 8, topE); c.HL(5, 19, 51, lo)                             # 화물칸 윗면
        c.R(57, 16, 18, 5, top); c.HL(58, 16, 14, topE); c.HL(57, 20, 18, lo); c.P(74, 16, None)                              # 캐빈 지붕 윗면
        c.R(5, 20, 51, 19, bod); c.VL(5, 21, 17, top); c.VL(55, 21, 17, lo)                                                     # 화물칸 앞면
        c.R(56, 21, 19, 18, bod); c.VL(74, 22, 16, lo); c.VL(56, 21, 18, lo)                                                    # 캐빈 앞면 (56 은 칸 경계선)
        for j in range(9):                                                                                                     # 앞유리·문 창: 오른쪽 아래로 기운다
            c.HL(58, 22 + j, 9 + (j + 1) // 2 + 2, glass)
        c.R(58, 22, 11, 2, glass_hi); c.VL(64, 22, 9, bod); c.VL(65, 22, 9, lo)
        for x in (9, 24, 39): c.R(x, 24, 9, 5, glass); c.R(x, 24, 9, 2, glass_hi)                                              # 화물칸 창 3개
        for x in (20, 35, 50): c.VL(x, 21, 17, lo)                                                                             # 칸 단위 규칙 이음
        c.R(70, 31, 4, 3, K('kii', 3)); c.R(5, 29, 3, 3, K('aka', 1)); c.R(5, 35, 70, 3, K('tekko', 1)); c.HL(5, 35, 70, K('tekko', 3))
        wx = (17, 62)
    else:
        # 옆면 몸통 + 숄더라인
        c.R(4, 27, 70, 12, bod); c.VL(4, 28, 11, top); c.VL(73, 28, 11, lo); c.HL(4, 38, 70, dk)
        c.HL(5, 29, 68, top); c.R(4, 33, 70, 2, lo)
        # 트렁크·보닛 윗면 (앞면 위에 한 단 밝은 면 + 어두운 접힘선)
        for (x0, w, ch) in ((5, 16, 1), (53, 21, 2)):
            c.R(x0, 22, w, 5, top); c.HL(x0 + 1, 22, w - 2, topE); c.HL(x0, 26, w, lo)
        c.HL(4, 27, 70, lo)
        # 캐빈: 지붕 윗면 4px(앞쪽 줄은 앞면색), 유리는 사다리꼴(A필러 경사)
        c.R(24, 9, 26, 3, top); c.HL(25, 9, 24, topE); c.HL(24, 12, 26, bod)
        for j in range(15):
            xs = 26 - j // 3; xe = 49 + j // 3
            c.HL(xs, 13 + j, xe - xs, glass)
        c.R(26, 13, 24, 2, glass_hi); c.VL(37, 13, 14, bod); c.VL(38, 13, 14, lo)
        for j in range(3): c.HL(48 - j, 9 + j, 3 + j, lo)                                                                        # 지붕 오른쪽 어두운 사선
        c.R(70, 29, 3, 3, K('kii', 3)); c.R(4, 29, 2, 3, K('aka', 1)); c.R(66, 33, 6, 2, lo)
        if color == 'taxi':
            c.R(33, 4, 10, 5, K('shiro', 3)); c.HL(33, 4, 10, K('shiro', 4)); c.R(34, 6, 8, 2, K('aka', 2)); c.VL(42, 5, 4, K('conc', 0))
        wx = (17, 60)
    if kind == 'van': c.R(5, 39, 70, 2, K('sumi', 0))
    else: c.R(4, 39, 70, 2, K('sumi', 0))
    for x in wx:
        _arch(c, x, 38, 6, K('sumi', 1)); _wheel(c, x, 40, 5)
    out = ink2(c)
    if flip: out.a[:] = out.a[:, ::-1]
    return out

def bus(flip=False, stripe='aka'):
    """9칸 x 4칸 (144x64). 지붕(한 단 밝은 윗면)과 옆면(한 단 어두움) 사이 접힘선, 앞=넓은 앞유리+행선 표시+전조등, 뒤=후미창."""
    c = Cv(144, 64)
    SH, SB = K('shiro', 2), K('shiro', 1)                                                                                   # 지붕(밝음) / 옆면
    c.R(2, 6, 138, 11, SH); c.HL(3, 6, 136, K('shiro', 2)); c.VL(2, 7, 10, SH); c.VL(139, 7, 10, K('shiro', 0)); c.HL(2, 16, 138, K('conc', 1))
    for x in (16, 62, 102): c.R(x, 9, 20, 5, K('conc', 2)); c.HL(x, 9, 20, K('shiro', 2)); c.HL(x, 13, 20, K('conc', 0)); c.VL(x + 19, 10, 4, K('conc', 1))
    c.R(2, 17, 138, 35, SB); c.VL(2, 18, 34, K('shiro', 2)); c.VL(139, 18, 34, K('conc', 0)); c.HL(2, 51, 138, K('conc', 0)); c.HL(2, 17, 138, K('conc', 2))
    c.R(2, 40, 138, 5, K(stripe, 1)); c.HL(2, 40, 138, K(stripe, 2)); c.HL(2, 44, 138, K(stripe, -1))                       # 줄무늬: 양 끝까지 직선
    for k in range(6):
        x = 8 + k * 16; c.R(x, 22, 13, 14, K('garasu', 2)); c.R(x, 22, 13, 3, K('garasu', 4)); c.VL(x + 12, 22, 14, K('garasu', 0))
    c.R(105, 22, 14, 26, K('garasu', 2)); c.VL(112, 22, 26, K('tekko', 2)); c.R(105, 22, 14, 3, K('garasu', 4)); c.HL(105, 47, 14, K('tekko', 1))        # 승강문
    # 앞(오른쪽): 넓고 높은 앞유리, 행선 표시, 전조등
    c.R(122, 20, 16, 18, K('garasu', 3)); c.R(122, 20, 16, 3, K('garasu', 4)); c.VL(122, 20, 18, K('conc', 0)); c.VL(129, 23, 15, K('garasu', 1)); c.HL(122, 37, 16, K('conc', 0))
    c.R(124, 10, 14, 4, K('tekko', -2)); c.HL(124, 10, 14, K('tekko', 0)); c.HL(126, 12, 8, K('kii', 2))
    c.R(133, 41, 5, 3, K('kii', 3)); c.HL(133, 41, 5, K('kii', 2))
    # 뒤(왼쪽): 세로 후미등
    c.R(3, 24, 3, 9, K('aka', 0)); c.VL(3, 24, 9, K('aka', 2)); c.R(3, 41, 2, 3, K('aka', -1))
    c.R(2, 51, 138, 4, K('tekko', 1))
    for x in (28, 96):
        _arch(c, x, 51, 8, K('sumi', 1)); _wheel(c, x, 54, 7)
    out = ink2(c)
    if flip: out.a[:] = out.a[:, ::-1]
    return out

def train(n=10, stripe='midori'):
    """n칸 x 4칸: 지붕 윗면(밝음, 에어컨) + 옆면(창은 칸 사이 벽 사이, 띠는 끊김 없음) + 대차 박스 + 레일 윗면."""
    c = Cv(16 * n, 64); W = c.w
    c.R(1, 5, W - 2, 10, K('shiro', 4)); c.HL(1, 5, W - 2, K('shiro', 4)); c.VL(1, 6, 9, K('shiro', 4)); c.VL(W - 2, 6, 9, K('shiro', 2)); c.HL(1, 14, W - 2, K('conc', 3))
    for x in range(10, W - 30, 54): c.R(x, 7, 24, 5, K('conc', 4)); c.HL(x, 7, 24, K('shiro', 4)); c.HL(x, 11, 24, K('conc', 1))
    c.R(1, 15, W - 2, 34, K('shiro', 2)); c.VL(1, 16, 33, K('shiro', 3)); c.VL(W - 2, 16, 33, K('conc', 1)); c.HL(1, 15, W - 2, K('shiro', 4)); c.HL(1, 48, W - 2, K('conc', 1))
    for k, x in enumerate(range(5, W - 24, 36)):
        c.R(x, 20, 12, 14, K('garasu', 2)); c.R(x, 20, 12, 3, K('garasu', 4)); c.VL(x + 11, 20, 14, K('garasu', 0))
        c.R(x + 15, 20, 12, 14, K('garasu', 2)); c.R(x + 15, 20, 12, 3, K('garasu', 4)); c.VL(x + 26, 20, 14, K('garasu', 0))
    c.R(1, 38, W - 2, 4, K(stripe, 1)); c.HL(1, 38, W - 2, K(stripe, 3)); c.HL(1, 41, W - 2, K(stripe, -1))
    for x in range(34, W - 2, 36): c.VL(x, 16, 32, K('conc', 1)); c.VL(x + 1, 16, 32, K('shiro', 3))              # 차량 이음 (창 사이 벽에만)
    c.R(1, 49, W - 2, 4, K('tekko', 1)); c.HL(1, 49, W - 2, K('tekko', 3))
    for x in range(8, W - 20, 36):                                                                                          # 대차 박스
        c.R(x, 53, 26, 5, K('tekko', -2)); c.HL(x, 53, 26, K('tekko', 1)); _wheel(c, x + 5, 57, 3); _wheel(c, x + 21, 57, 3)
    c.R(0, 59, W, 2, K('hodo', 4)); c.HL(0, 59, W, K('shiro', 3)); c.HL(0, 61, W, K('hodo', -1))                           # 레일 윗면
    return ink2(c)

def ad_truck(flip=False):
    """6칸 x 4칸 (96x64): 광고 적재함(2색 띠 반복, 하단은 바퀴 위) + 운전실(지붕 윗면·경사 앞유리·문선)."""
    c = Cv(96, 64)
    c.R(2, 6, 64, 9, K('shiro', 2)); c.HL(3, 6, 62, K('shiro', 2)); c.VL(2, 7, 8, K('shiro', 2)); c.HL(2, 14, 64, K('conc', 1))
    c.R(2, 15, 64, 35, K('shiro', 1)); c.VL(2, 16, 34, K('shiro', 2)); c.VL(65, 16, 34, K('conc', 0))
    c.R(6, 18, 56, 22, K('sora', 0))
    for i in range(0, 56, 8): c.R(6 + i, 18, 4, 22, K('sora', 1))                                  # 칸 단위 반복 세로 띠
    c.R(6, 31, 56, 5, K('pinku', 1)); c.HL(6, 31, 56, K('pinku', 2)); c.R(6, 36, 56, 4, K('sora', -1))
    # 운전실: 지붕 윗면 + 앞면. 앞유리는 오른쪽 아래로 기운 사다리꼴
    c.R(69, 22, 20, 6, K('tekko', 3)); c.HL(70, 22, 18, K('tekko', 4)); c.HL(69, 27, 20, K('tekko', 1))
    c.R(88, 28, 6, 6, K('tekko', 3)); c.HL(88, 28, 6, K('tekko', 4)); c.HL(88, 33, 6, K('tekko', 1))          # 후드 윗면
    c.R(68, 28, 20, 22, K('tekko', 2)); c.R(88, 34, 6, 16, K('tekko', 2)); c.VL(68, 28, 22, K('tekko', 4)); c.VL(93, 34, 16, K('tekko', 0))
    for j in range(11): c.HL(72, 30 + j, 10 + j // 3, K('garasu', 2))
    c.R(72, 30, 11, 2, K('garasu', 4)); c.VL(78, 30, 11, K('tekko', 2))
    c.VL(70, 29, 21, K('tekko', 0)); c.VL(87, 40, 10, K('tekko', 0))                                    # 문선(양쪽)
    c.R(90, 43, 3, 3, K('kii', 3))                                                                      # 전조등
    c.R(2, 50, 92, 4, K('tekko', 0)); c.HL(2, 50, 92, K('tekko', 3))
    for x in (16, 78):
        _arch(c, x, 50, 8, K('sumi', 1)); _wheel(c, x, 54, 7)
    out = ink2(c)
    if flip: out.a[:] = out.a[:, ::-1]
    return out
