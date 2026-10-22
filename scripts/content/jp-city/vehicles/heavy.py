"""jp_city 움직이는 대형 탈것: 노선버스 · 노면전차(1량) · 통근 전철(3량) · 지하철(3량). 계약: SPEC.md

옆모습은 진행 방향(앞)이 오른쪽(`right`) 또는 왼쪽(`left`). `left` 는 반전하지 않고 기하만 거꾸로 놓는다 —
빛(왼쪽 위 밝음 · 오른쪽 어둠)은 방향과 무관하게 고정이라 그림자 열은 늘 오른쪽에 둔다.
문은 남쪽(보이는) 면에 있고 `_open` 은 그 문이 열려 어두운 실내(yoru 낮은 단)가 보인다.
앞/뒤(`down`/`up`)는 폭 32: 위(먼 끝) → 지붕(가장 밝은 단 · 에어컨 · 환기 줄) → 앞유리 → 얼굴 → 바닥 그림자.
"""
import os, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
for p in (HERE, os.path.join(HERE, '..', '..', 'atlas-pick'), os.path.join(HERE, '..', 'lib')):
    if p not in sys.path: sys.path.insert(0, p)
from parts_tokyo import *                       # noqa: E402,F401  (K, Cv)
from v2core import ink2                         # noqa: E402
from parts_vehicles import _wheel, _arch        # noqa: E402


class Side:
    """옆모습 그리개. 앞쪽 기준 좌표(앞=오른쪽)로 그리면 facing='left' 일 때 위치만 좌우로 옮긴다."""
    def __init__(s, w, h, front_right=True):
        s.c = Cv(w, h); s.W = w; s.fr = front_right
    def fx(s, x, w=1): return x if s.fr else s.W - x - w
    def R(s, x, y, w, h, col): s.c.R(s.fx(x, w), y, w, h, col)
    def HL(s, x, y, w, col): s.c.R(s.fx(x, w), y, w, 1, col)
    def VL(s, x, y, h, col): s.c.R(s.fx(x), y, 1, h, col)
    def P(s, x, y, col): s.c.P(s.fx(x), y, col)
    def glass(s, x, y, w, h, base=-1, hi=1, top=1):
        """유리: 짙은 남색(앞/뒤 그림과 같은 톤). 위 1줄 + 왼쪽 위 반짝 1점만 밝다, 오른쪽 열 어둠(화면 기준)."""
        X = s.fx(x, w); c = s.c
        c.R(X, y, w, h, K('garasu', base)); c.R(X, y, w, top, K('garasu', hi)); c.VL(X + w - 1, y, h, K('garasu', -3))
        if w > 6: c.P(X + 1, y + top, K('garasu', hi + 1))
    def wheel(s, x, y, r):
        _wheel(s.c, s.fx(x), y, r)
    def arch(s, x, y, r):
        _arch(s.c, s.fx(x), y, r, None)


def _cut(c, pts):
    """그림 픽셀을 비운다(둥근 모서리)."""
    for x, y in pts:
        if 0 <= x < c.w and 0 <= y < c.h: c.a[y, x] = 0


def _led(c, X, y, w, col='daidai'):
    """행선 LED: 어두운 판 + 주황 점(글자 아님)."""
    c.R(X, y, w, 4, K('tekko', -2)); c.HL(X, y, w, K('tekko', 0))
    for i in range(1, w - 1):
        if i % 2 == 1: c.P(X + i, y + 1 + (i // 2) % 2, K(col, 1))
    c.HL(X + 1, y + 3, w - 2, K('tekko', -3))


# ───────────────────────────── 노선버스 ─────────────────────────────
BUS_BAND = 'midori'

def bus_side(front_right=True, open_=False, band=None):
    """3/4 탑뷰 옆모습(2026-10-20 깊이 다시 그림): 지붕 윗면이 화면 세로 22줄(차폭 2.5m를 위에서 본 면) →
    둥근 어깨 2줄 → 옆면 26줄. 옥상 설비는 윗면 + 남쪽 면이 있는 상자. 옛 그림은 지붕 13줄 + 옆면 37줄의 입면도였다."""
    s = Side(144, 64, front_right); c = s.c
    BUS_BAND = band or globals()['BUS_BAND']
    RT, RB = 3, 25                     # 지붕 윗면 줄(먼 쪽 가장자리 RT, 가까운 쪽 RB-1)
    ST = RB + 2                         # 옆면 시작(어깨 2줄 아래)
    # ── 지붕 윗면: 먼 가장자리 밝은 단 · 가운데 · 가까운 쪽으로 한 단 어두워짐(둥근 지붕) ──
    for y in range(RT, RB):                                                                             # 윗면: 옆면보다 밝은 값 + 북→남 그러데이션(디더)
        f = (y - RT) / (RB - RT)
        for x in range(3, 139):
            t = 2 if f < 0.45 else 1 if f > 0.8 else (2 if (x + y) % 2 else 1) if f < 0.62 else (1 if (x + y) % 3 else 2)
            c.P(x, y, K('shiro', t))
    c.HL(3, RT - 1, 136, K('shiro', 3)); c.HL(4, RT - 2, 134, K('shiro', 2))                         # 먼 쪽 둥근 가장자리
    for y in range(RT - 1, RB):                                                                         # 앞뒤 끝: 둥근 모서리(왼쪽 빛 · 오른쪽 그늘)
        c.P(2, y, K('shiro', 3)); c.P(140, y, K('conc', 0)); c.P(139, y, K('shiro', 1))
    for x in range(14, 132, 22): c.VL(x, RT + 1, RB - RT - 2, K('shiro', 1))                          # 지붕 판 이음(차폭 방향 = 세로)
    # 옥상 설비: 에어컨(긴 상자) · 냉각기 · 환기 덮개 — 윗면 + 남쪽 면 + 바닥 그늘
    def roofbox(x, y, w, top, face):
        X = s.fx(x, w)
        c.R(X, y, w, top, K('conc', 3)); c.HL(X, y, w, K('shiro', 3)); c.VL(X, y, top, K('shiro', 3))
        for i in range(X + 3, X + w - 2, 3): c.VL(i, y + 2, top - 3, K('conc', 2))                     # 윗면 환기 살
        c.R(X, y + top, w, face, K('conc', 1)); c.HL(X, y + top, w, K('conc', 0)); c.VL(X + w - 1, y, top + face, K('conc', -1))
        c.HL(X + 1, y + top + face, w, K('shiro', 0)); c.VL(X + w, y + 2, top + face - 1, K('shiro', 0))   # 지붕 위 그늘
        c.HL(X - 1, y - 1, w + 2, K('conc', -1)); c.VL(X - 1, y, top + face, K('conc', -1))
    roofbox(16, 7, 24, 7, 4)
    roofbox(56, 7, 18, 7, 4)
    roofbox(90, 10, 12, 5, 3)
    # 앞 끝 위 행선 LED(지붕 앞 가장자리 아래로 내려온 판)
    # ── 어깨: 지붕 → 옆면 둥근 모서리 2줄 ──
    c.HL(2, RB, 139, K('conc', 1)); c.HL(2, RB + 1, 139, K('conc', -1))                                # 어두운 둥근 어깨 띠 2px
    # ── 옆면 ──
    c.R(2, ST, 139, 54 - ST, K('shiro', 0)); c.VL(2, ST, 54 - ST, K('shiro', 1)); c.VL(140, ST, 54 - ST, K('conc', 0))   # 옆면: 지붕보다 한 단 어둡다
    c.HL(2, ST, 139, K(BUS_BAND, 1))                                                                    # 처마 가는 띠
    WY, WH = ST + 2, 11                                                                                 # 창 줄
    c.R(2, 41, 139, 4, K(BUS_BAND, 1)); c.HL(2, 41, 139, K(BUS_BAND, 2)); c.HL(2, 44, 139, K(BUS_BAND, -1))   # 허리 띠
    c.HL(2, 47, 139, K(BUS_BAND, 0))
    doors = () if front_right else (66, 116)   # 일본 버스 문은 왼쪽(인도) 면에만. 동쪽 진행이면 보이는 면은 운전석 쪽
    if doors:
        for x in (6, 20, 34, 48): s.glass(x, WY, 12, WH)
        s.glass(82, WY, 12, WH); s.glass(96, WY, 12, WH); s.glass(110, WY, 4, WH)
        _led(c, s.fx(82, 12), WY, 12)
    else:
        for x in (6, 20, 34, 48, 62, 76, 90, 104): s.glass(x, WY, 12, WH)
        s.glass(118, WY, 11, WH)
        s.VL(129, WY - 1, WH + 2, K('conc', 0))
    for dx in doors:                                                                                    # 중문 · 앞문(저상: 치마 바로 위까지)
        X = s.fx(dx, 14)
        c.R(X - 1, WY - 1, 16, 55 - WY, K('conc', 0))
        if open_:
            c.R(X, WY, 14, 53 - WY, K('yoru', -2)); c.R(X, WY, 14, 2, K('yoru', -3))
            c.HL(X, 51, 14, K('yoru', 0)); c.HL(X, 52, 14, K('conc', 1))
            c.R(X, WY, 2, 52 - WY, K('garasu', -3)); c.R(X + 12, WY, 2, 52 - WY, K('garasu', -3))
            c.VL(X + 3, WY + 3, 48 - WY, K('kii', 1)); c.VL(X + 10, WY + 3, 48 - WY, K('kii', 0))
            c.R(X + 5, WY + 4, 4, 8, K('yoru', -1))
        else:
            c.R(X, WY, 14, 53 - WY, K('garasu', -1)); c.HL(X, WY, 14, K('garasu', 1)); c.VL(X + 13, WY, 53 - WY, K('garasu', -3))
            c.VL(X + 6, WY, 53 - WY, K('tekko', 1)); c.VL(X + 7, WY, 53 - WY, K('conc', 2))
            c.HL(X, WY + WH + 1, 14, K('conc', 1)); c.HL(X, 52, 14, K('tekko', 1))
    # 앞(운전석 옆 큰 유리 · 앞 행선 LED는 지붕 앞 가장자리 밑)
    s.glass(131, WY - 1, 9, WH + 4, base=0, hi=2)
    X = s.fx(131, 9); c.VL(X if front_right else X + 8, WY - 1, WH + 4, K('conc', 0))
    s.R(134, 46, 5, 2, K('kii', 3))                                                                     # 전조등
    s.R(130, 49, 10, 2, K('conc', 0))                                                                   # 앞 범퍼 모서리
    s.R(3, WY + 1, 2, 9, K('aka', 0)); s.VL(3, WY + 1, 9, K('aka', 2)); s.R(3, 46, 2, 2, K('aka', -1))  # 뒤 후미등
    # 치마 · 바퀴
    c.R(2, 51, 139, 3, K('tekko', 1)); c.HL(2, 51, 139, K('tekko', 2))
    for dx in doors:
        if not open_: s.R(dx - 1, 51, 16, 3, K('conc', 0))
    for x in (28, 102):                                                                                 # 휠 아치: 차체 아래쪽을 반원으로 파낸 어두운 홈(한 색)
        X = s.fx(x)
        for j in range(-8, 0):
            for i in range(-9, 10):
                if i * i + j * j <= 81: c.P(X + i, 54 + j, K('sumi', 1))
    out = ink2(c)
    for x in (28, 102):                                                                                 # 바퀴(잉크 뒤에 직접): 윗부분은 아치 그늘에 숨고 아래 ~60% 가 치마 밑으로
        X = s.fx(x)
        for j in range(-4, 8):
            for i in range(-7, 8):
                d2 = i * i + j * j
                if d2 > 56: continue
                col = K('sumi', 0) if d2 > 42 else K('tekko', -2) if d2 > 12 else K('conc', 1) if d2 > 2 else K('conc', -1)
                if 12 < d2 <= 42 and i < -1 and j > 0: col = K('tekko', -1)                               # 타이어 왼쪽 아래 빛
                if j < -1 and d2 > 12: col = K('sumi', 0)                                                    # 아치 그늘 속 윗부분
                out.P(X + i, 55 + j, col)
        out.P(X - 1, 54, K('conc', 2))                                                                  # 허브 반짝
    return out.a


def _bus_roof_top(c, H, roof_end, ac_at):
    """앞/뒤 그림의 지붕 공통(폭 28: x2..29). 먼 끝 둥근 모서리, 왼쪽 빛 · 오른쪽 어둠 1px."""
    c.R(2, 2, 28, roof_end - 2, K('shiro', 2))
    c.HL(4, 1, 24, K('shiro', 2)); c.HL(3, 2, 26, K('shiro', 2))
    c.VL(2, 3, roof_end - 3, K('shiro', 2)); c.VL(29, 3, roof_end - 3, K('conc', 0)); c.VL(28, 3, roof_end - 3, K('shiro', 1))
    for y0, n in ac_at:                                                                                 # 에어컨 · 냉각기 상자
        c.R(7, y0, 18, n, K('conc', 2)); c.HL(7, y0, 18, K('shiro', 2)); c.VL(7, y0, n, K('shiro', 2))
        c.HL(7, y0 + n - 1, 18, K('conc', 0)); c.VL(24, y0, n, K('conc', 0))
        for j in range(3, n - 2, 3): c.HL(9, y0 + j, 14, K('conc', 1))
    for y in range(8, roof_end - 4, 22):                                                                # 지붕 이음 / 환기 줄
        c.HL(4, y, 3, K('conc', 1)); c.HL(25, y, 3, K('conc', 1))


def bus_down():
    """남쪽으로 달림: 지붕 + 앞유리 + 앞 얼굴."""
    c = Cv(32, 176)
    _bus_roof_top(c, 176, 138, [(16, 22), (66, 22)])
    c.R(6, 104, 20, 3, K('conc', 1)); c.HL(6, 104, 20, K('conc', 3))                                   # 환기 덮개
    c.HL(2, 137, 28, K('conc', 1))                                                                       # 지붕 → 앞 접힘
    c.R(2, 138, 28, 38 - 2, K('shiro', 1)); c.VL(2, 138, 34, K('shiro', 2)); c.VL(29, 138, 34, K('conc', 0))
    _led(c, 6, 139, 20)                                                                                  # 앞 행선 LED
    # 앞유리: 크게, 아래로 갈수록 살짝 넓다
    for j in range(15):
        ins = 4 if j < 2 else 3
        c.HL(2 + ins, 144 + j, 28 - 2 * ins, K('garasu', 1 if j < 1 else 0))
    c.R(5, 149, 9, 9, K('garasu', -2))                                                                    # 운전석(화면 왼쪽) 어두운 유리
    c.VL(16, 145, 13, K('conc', 0))                                                                      # 가운데 기둥
    c.VL(26, 147, 11, K('garasu', -3))
    c.HL(6, 158, 9, K('tekko', 0)); c.HL(18, 158, 8, K('tekko', 0))                                       # 와이퍼
    c.HL(2, 159, 28, K('conc', 0))
    c.R(2, 160, 28, 4, K(BUS_BAND, 1)); c.HL(2, 160, 28, K(BUS_BAND, 2)); c.HL(2, 163, 28, K(BUS_BAND, -1))
    c.R(4, 165, 5, 3, K('kii', 3)); c.HL(4, 165, 5, K('kii', 2)); c.R(23, 165, 5, 3, K('kii', 3)); c.HL(23, 165, 5, K('kii', 2))
    c.R(12, 165, 8, 4, K('shiro', 2)); c.VL(19, 165, 4, K('conc', 1)); c.HL(12, 168, 8, K('conc', 1))   # 번호판(글자 없음)
    c.R(2, 169, 28, 3, K('tekko', 1)); c.HL(2, 169, 28, K('tekko', 3))                                   # 범퍼
    c.R(3, 172, 4, 2, K('sumi', 0)); c.R(25, 172, 4, 2, K('sumi', 0))                                    # 바퀴 밑동
    c.R(7, 172, 18, 2, K('tekko', -3))                                                                    # 차 밑 그림자
    out = ink2(c)
    return out.a


def bus_up():
    """북쪽으로 달림: 지붕(뒤쪽에 냉각기) + 뒤 얼굴(후미등 · 엔진 루버)."""
    c = Cv(32, 176)
    _bus_roof_top(c, 176, 140, [(84, 22), (112, 22)])
    c.R(6, 40, 20, 3, K('conc', 1)); c.HL(6, 40, 20, K('conc', 3))
    c.HL(2, 139, 28, K('conc', 1))
    c.R(2, 140, 28, 34, K('shiro', 1)); c.VL(2, 140, 32, K('shiro', 2)); c.VL(29, 140, 32, K('conc', 0))
    _led(c, 9, 141, 14)                                                                                  # 뒤 행선(작다)
    for j in range(8): c.HL(5, 146 + j, 22, K('garasu', 1 if j < 1 else -1))                             # 뒤 창
    c.VL(26, 146, 8, K('garasu', -3))
    c.R(2, 155, 28, 3, K(BUS_BAND, 1)); c.HL(2, 155, 28, K(BUS_BAND, 2)); c.HL(2, 157, 28, K(BUS_BAND, -1))
    for x in (3, 26):                                                                                    # 세로 후미등
        c.R(x, 146, 3, 18, K('aka', 0)); c.VL(x, 146, 18, K('aka', 2)); c.R(x, 158, 3, 3, K('kii', 1))
    for y in range(159, 166, 2): c.HL(9, y, 14, K('conc', 0))                                           # 엔진 루버
    c.R(12, 166, 8, 3, K('shiro', 2)); c.VL(19, 166, 3, K('conc', 1))                                     # 번호판
    c.R(2, 169, 28, 3, K('tekko', 1)); c.HL(2, 169, 28, K('tekko', 3))
    c.R(3, 172, 4, 2, K('sumi', 0)); c.R(25, 172, 4, 2, K('sumi', 0)); c.R(7, 172, 18, 2, K('tekko', -3))
    out = ink2(c)
    return out.a


# ───────────────────────────── 노면전차 ─────────────────────────────
TRAM_UP, TRAM_LO = 'kinari', 'midori'

def _panto_diamond(out, cx, base, folded=False):
    """마름모 집전장치(윤곽 뒤에 1px 선으로). 가선은 그리지 않는다."""
    dk, md = K('sumi', 0), K('tekko', 0)
    if folded:
        for x in range(cx - 9, cx + 10): out.P(x, base - 1, md)
        out.P(cx - 10, base - 1, dk); out.P(cx + 10, base - 1, dk)
        return
    top = base - 9
    for k in range(5):                                                                                   # 아래 마름모 반쪽
        out.P(cx - 8 + k * 2, base - 1 - k, dk); out.P(cx - 7 + k * 2, base - 1 - k, md)
        out.P(cx + 8 - k * 2, base - 1 - k, dk); out.P(cx + 7 - k * 2, base - 1 - k, md)
    for k in range(4):                                                                                   # 위 반쪽
        out.P(cx - 1 - k, top + 1 + k, dk); out.P(cx + 1 + k, top + 1 + k, dk)
    for x in range(cx - 7, cx + 8): out.P(x, top, dk)                                                   # 습판(머리 막대)
    out.P(cx - 8, top + 1, dk); out.P(cx + 8, top + 1, dk)
    out.P(cx - 10, base, K('conc', 3)); out.P(cx + 10, base, K('conc', 3))                              # 애자


def tram_side(front_right=True, open_=False):
    W = 192; s = Side(W, 64, front_right); c = s.c
    # 지붕: 회색 둥근 지붕(윗면)
    c.R(4, 8, W - 8, 12, K('conc', 3)); c.HL(6, 7, W - 12, K('conc', 3)); c.HL(4, 19, W - 8, K('conc', 1))
    c.HL(6, 7, 70, K('shiro', 2)); c.VL(4, 8, 6, K('shiro', 2))                                          # 왼쪽 위 밝은 단
    c.HL(4, 18, W - 8, K('conc', 2)); c.VL(W - 5, 8, 11, K('conc', 1))
    for x in (24, 140):                                                                                  # 에어컨 · 저항기 상자 — 윗면 위
        s.R(x, 10, 26, 7, K('conc', 2)); s.HL(x, 10, 26, K('shiro', 2)); s.VL(x, 10, 7, K('shiro', 2))
        s.HL(x, 16, 26, K('conc', 0)); s.VL(x + 25, 10, 7, K('conc', 0))
        for i in range(4, 24, 5): s.VL(x + i, 12, 3, K('conc', 1))
    s.R(88, 12, 24, 3, K('tekko', 1)); s.HL(88, 12, 24, K('tekko', 3)); s.HL(88, 14, 24, K('tekko', -1))   # 집전장치 받침
    # 몸체: 위 크림 / 아래 초록 (투톤)
    c.R(2, 20, W - 4, 18, K(TRAM_UP, 1)); c.R(2, 38, W - 4, 15, K(TRAM_LO, 0))
    c.VL(2, 21, 31, K(TRAM_UP, 2)); c.VL(W - 3, 21, 31, K(TRAM_LO, -1)); c.HL(2, 20, W - 4, K(TRAM_UP, 2))
    c.HL(2, 37, W - 4, K(TRAM_LO, 1)); c.HL(2, 38, W - 4, K(TRAM_LO, 1)); c.HL(2, 52, W - 4, K(TRAM_LO, -2))
    c.HL(2, 44, W - 4, K(TRAM_UP, 0))                                                                   # 허리 가는 크림 선
    # 양 끝 운전창(비스듬한 윗선)
    for front in (True, False):
        x0 = 2 if front is False else W - 14
        X = s.fx(x0, 12)
        for j in range(15):
            sl = max(0, 3 - j)                                                                           # 끝쪽 윗모서리 비스듬
            if (X < W // 2) == True: c.HL(X + sl, 22 + j, 12 - sl, K('garasu', 0 if j > 0 else 1))
            else: c.HL(X, 22 + j, 12 - sl, K('garasu', 0 if j > 0 else 1))
        c.VL(X + (11 if X < W // 2 else 0), 22, 15, K('conc', 0))
        c.R(X + 3, 26, 6, 9, K('garasu', -2))                                                            # 어두운 운전석
        _led(c, s.fx(x0 + 1 if not front else x0 - 1, 12), 15, 12, 'kii')                                # 행선 표시(양 끝)
    # 창
    for x in (34, 50, 66, 82, 98, 114, 130): s.glass(x, 23, 12, 12)
    # 문 2개(남쪽 면): 뒤쪽 문 16..29, 앞쪽 문 148..161
    for dx in (16, 150):
        X = s.fx(dx, 14)
        c.R(X - 1, 22, 16, 31, K('conc', 0))
        if open_:
            c.R(X, 23, 14, 29, K('yoru', -2)); c.R(X, 23, 14, 2, K('yoru', -3))
            c.HL(X, 49, 14, K('yoru', 0)); c.R(X, 50, 14, 2, K('conc', 1)); c.HL(X, 50, 14, K('conc', 3))  # 디딤판
            c.R(X, 23, 2, 27, K(TRAM_LO, -1)); c.R(X + 12, 23, 2, 27, K(TRAM_LO, -1))                    # 접힌 문
            c.VL(X + 7, 26, 22, K('kii', 1))
        else:
            c.R(X, 23, 14, 14, K('garasu', -1)); c.HL(X, 23, 14, K('garasu', 1)); c.VL(X + 13, 23, 14, K('garasu', -3))
            c.R(X, 37, 14, 15, K(TRAM_LO, 0)); c.HL(X, 37, 14, K(TRAM_LO, 1))
            c.VL(X + 6, 23, 29, K('tekko', 0)); c.VL(X + 7, 23, 29, K(TRAM_UP, 0))
    s.R(W - 10, 46, 4, 3, K('kii', 3))                                                                    # 앞 전조등(낮은 곳)
    s.R(4, 46, 3, 3, K('aka', 1))                                                                         # 뒤 미등
    # 치마(바퀴 대부분 가림) + 대차
    c.R(3, 53, W - 6, 4, K(TRAM_LO, -1)); c.HL(3, 53, W - 6, K(TRAM_LO, -2)); c.HL(3, 56, W - 6, K('tekko', -1))
    for bx in (44, 148):
        s.R(bx - 12, 57, 24, 2, K('tekko', -2))
        s.wheel(bx - 6, 58, 4); s.wheel(bx + 6, 58, 4)
    _cut(c, [(2, 20), (W - 3, 20), (3, 7), (W - 4, 7), (4, 7), (W - 5, 7)])
    out = ink2(c)
    _panto_diamond(out, s.fx(100), 13)
    return out.a


def _tram_roof(c, roof_end, folded_y):
    c.R(3, 2, 26, roof_end - 2, K('conc', 3)); c.HL(5, 1, 22, K('conc', 3))
    c.VL(3, 3, roof_end - 3, K('conc', 3)); c.VL(28, 3, roof_end - 3, K('conc', 1))
    c.HL(3, roof_end - 1, 26, K('conc', 1))
    for y0 in (20, 140):                                                                                  # 에어컨 상자
        c.R(8, y0, 16, 22, K('conc', 2)); c.HL(8, y0, 16, K('shiro', 2)); c.HL(8, y0 + 21, 16, K('conc', 0)); c.VL(23, y0, 22, K('conc', 0))
        for j in range(4, 20, 4): c.HL(10, y0 + j, 12, K('conc', 1))
    # 접힌 마름모 집전장치(위에서 본 납작한 틀)
    y0 = folded_y
    c.R(6, y0, 20, 22, K('tekko', 1)); c.R(8, y0 + 2, 16, 18, K('conc', 3))
    for j in range(2, 20, 4): c.HL(8, y0 + j, 16, K('tekko', 0))
    c.VL(16, y0, 22, K('tekko', -1)); c.HL(5, y0 + 10, 22, K('sumi', 0))                                # 습판
    for x, y in ((5, y0 - 1), (26, y0 - 1), (5, y0 + 22), (26, y0 + 22)): c.R(x, y, 2, 2, K('shiro', 2))  # 애자


def _tram_face(c, y0, front=True):
    """앞(또는 뒤) 얼굴: 행선 · 두 장 유리 · 크림/초록 · 등."""
    c.R(2, y0, 28, 206 - y0, K(TRAM_UP, 1)); c.VL(2, y0, 206 - y0, K(TRAM_UP, 2)); c.VL(29, y0, 206 - y0, K(TRAM_LO, -1))
    _led(c, 8, y0 + 1, 16, 'kii')
    for j in range(11):
        c.HL(4, y0 + 6 + j, 11, K('garasu', 1 if j < 1 else 0)); c.HL(17, y0 + 6 + j, 11, K('garasu', 1 if j < 1 else 0))
    c.VL(14, y0 + 6, 11, K('garasu', -3)); c.VL(27, y0 + 6, 11, K('garasu', -3))
    if front: c.R(5, y0 + 10, 7, 7, K('garasu', -2))                                                      # 운전석
    c.R(2, y0 + 18, 28, 12, K(TRAM_LO, 0)); c.HL(2, y0 + 18, 28, K(TRAM_LO, 1)); c.HL(2, y0 + 22, 28, K(TRAM_UP, 0))
    if front:
        c.R(14, y0 + 24, 4, 3, K('kii', 3)); c.HL(14, y0 + 24, 4, K('kii', 2))                            # 가운데 전조등
    else:
        c.R(4, y0 + 24, 3, 3, K('aka', 1)); c.R(25, y0 + 24, 3, 3, K('aka', 1))
    c.R(2, y0 + 29, 28, 2, K(TRAM_LO, -2))
    c.R(4, 204, 24, 2, K('tekko', -3))


def tram_down():
    c = Cv(32, 208)
    _tram_roof(c, 172, 80)
    _tram_face(c, 173, True)
    return ink2(c).a


def tram_up():
    c = Cv(32, 208)
    _tram_roof(c, 172, 92)
    _tram_face(c, 173, False)
    return ink2(c).a


# ───────────────────────────── 전철 · 지하철 (3량) ─────────────────────────────
CARS = ((1, 157), (161, 157), (321, 158))      # (x0, 폭) — 사이 3px 는 연결 막
DOORS = (22, 72, 122)                           # 차 안 기준 문 x (폭 12) — 20m 급 아닌 짧은 차: 한쪽 3문

def rail_side(kind, front_right=True, open_=False):
    W = 480; s = Side(W, 64, front_right); c = s.c
    sub = kind == 'subway'
    band = 'murasaki' if sub else 'daidai'
    ry = 11 if sub else 10                      # 지붕 윗면 시작 (전철은 위 9줄을 팬터그래프에)
    by = ry + 8                                 # 옆면 시작
    for ci, (x0, cw) in enumerate(CARS):
        lead = ci == 2; tail = ci == 0          # 앞쪽 기준: CARS[2] 가 진행 방향 맨 앞
        # 지붕
        s.R(x0 + 1, ry, cw - 2, 8, K('conc', 3)); s.HL(x0 + 1, ry + 7, cw - 2, K('conc', 1))
        s.VL(x0 + (cw - 2 if front_right else 1), ry, 7, K('conc', 1))
        for ax in (18, 66, 114):                                                                          # 에어컨
            s.R(x0 + ax, ry + 1, 24, 5, K('conc', 1)); s.HL(x0 + ax, ry + 1, 24, K('conc', 3)); s.HL(x0 + ax, ry + 5, 24, K('tekko', 0))
            s.VL(x0 + ax + 6, ry + 2, 3, K('tekko', 1)); s.VL(x0 + ax + 17, ry + 2, 3, K('tekko', 1))
        # 옆면(스테인리스)
        s.R(x0, by, cw, 49 - by, K('conc', 2)); s.HL(x0, by, cw, K('conc', 3))
        s.HL(x0, 48, cw, K('conc', 0))
        if not sub:
            s.HL(x0, by + 2, cw, K(band, 1))                                                             # 창 위 가는 띠
            for y in range(42, 48, 2): s.HL(x0, y, cw, K('conc', 1))                                     # 골판
        s.R(x0, 36, cw, 4, K(band, 1)); s.HL(x0, 36, cw, K(band, 2)); s.HL(x0, 39, cw, K(band, -1))       # 띠
        # 창(문 사이 큰 창 2장 + 양 끝)
        for i in range(2):
            wx = DOORS[i] + 12 + 4
            s.glass(x0 + wx, 21, 30, 12); s.VL(x0 + wx + 15, 21, 12, K('conc', 1))
        if tail: s.glass(x0 + 14, 21, 7, 12)
        else: s.glass(x0 + 4, 21, 15, 12)
        if lead: s.glass(x0 + 136, 21, 7, 12)
        else: s.glass(x0 + 138, 21, 15, 12)
        # 문 3개 (두 짝 미닫이)
        for dx in DOORS:
            X = s.fx(x0 + dx, 12)
            c.R(X - 1, by + 2, 14, 48 - by - 1, K('tekko', 0))
            if open_:
                c.R(X, by + 3, 12, 45 - by - 1, K('yoru', -3)); c.R(X + 2, 24, 8, 8, K('yoru', -2))         # 실내 + 반대편 창
                c.HL(X, 46, 12, K('yoru', 0)); c.HL(X, 47, 12, K('conc', 1))
                c.VL(X + 1, by + 6, 38 - by, K('conc', 1))                                                # 손잡이 봉
            else:
                c.R(X, by + 3, 12, 45 - by - 1, K('conc', 2))
                c.R(X + 1, 22, 4, 10, K('garasu', -1)); c.R(X + 7, 22, 4, 10, K('garasu', -1))
                c.HL(X + 1, 22, 4, K('garasu', 1)); c.HL(X + 7, 22, 4, K('garasu', 1))
                c.VL(X + 5, by + 3, 45 - by - 1, K('conc', 0)); c.VL(X + 6, by + 3, 45 - by - 1, K('conc', 3))
                c.HL(X, 36, 12, K(band, 1)); c.HL(X, 39, 12, K(band, -1))
        # 이음 끝 세로선
        s.VL(x0, by, 49 - by, K('conc', 1)); s.VL(x0 + cw - 1, by, 49 - by, K('conc', 0))
        # 운전실 끝
        if lead or tail:
            ex = x0 + cw - 13 if lead else x0
            X = s.fx(ex, 13)
            nose_right = (X > W // 2)                                                                     # 화면에서 바깥이 오른쪽?
            for j in range(13):                                                                          # 비스듬한 운전창
                sl = max(0, 5 - j // 2)
                gx0 = X + 1 if nose_right else X + 1 + sl
                c.HL(gx0, 20 + j, 11 - sl, K('garasu', 1 if j < 1 else 0))
            c.R(X + (3 if nose_right else 5), 25, 5, 7, K('garasu', -2))                                   # 어두운 운전석
            c.VL(X + (12 if nose_right else 0), by, 49 - by, K('conc', 0) if nose_right else K('conc', 3))  # 앞 얼굴 모서리
            if sub:                                                                                       # 앞 비상문: 테두리 + 창 + 손잡이
                ex0 = X + (8 if nose_right else 1)
                c.R(ex0, by + 1, 4, 47 - by - 1, K('conc', 1)); c.VL(ex0 + (3 if nose_right else 0), by + 1, 46 - by, K('tekko', 0))
                c.R(ex0 + 1, 21, 2, 10, K('garasu', -1)); c.P(ex0 + 1, 21, K('garasu', 1))
                c.P(ex0 + 1, 34, K('tekko', 0))
            if lead: c.R(X + (8 if nose_right else 1), 42, 4, 3, K('kii', 3)); c.HL(X + (8 if nose_right else 1), 42, 4, K('kii', 2))
            else: c.R(X + (8 if nose_right else 1), 42, 4, 3, K('aka', 1))
            # 둥근 앞 윤곽: 바깥 위 모서리 깎기
            edge = X + 12 if nose_right else X
            d = -1 if nose_right else 1
            pts = []
            for k, n in enumerate((6, 4, 3, 2, 1, 1)):
                for i in range(n): pts.append((edge + d * i, ry + k))
            _cut(c, pts)
        # 바닥 기기 · 대차
        s.R(x0 + 1, 49, cw - 2, 4, K('tekko', 1)); s.HL(x0 + 1, 49, cw - 2, K('tekko', 3))
        s.R(x0 + 50, 53, 56, 3, K('tekko', -1)); s.HL(x0 + 50, 53, 56, K('tekko', 0))                       # 기기 상자
        for bx in (14, 117):
            s.R(x0 + bx, 53, 26, 4, K('tekko', -2)); s.HL(x0 + bx, 53, 26, K('tekko', 1))
            s.wheel(x0 + bx + 6, 58, 3); s.wheel(x0 + bx + 20, 58, 3)
    for gx in (158, 318):                                                                                # 연결 막(주름)
        X = s.fx(gx, 3)
        c.R(X, by + 2, 3, 47 - by, K('tekko', -2))
        for y in range(by + 3, 48, 3): c.HL(X, y, 3, K('tekko', 0))
    out = ink2(c)
    if not sub:                                                                                          # 마름모 팬터그래프 (가운데 차, 에어컨 사이)
        _panto_diamond(out, s.fx(161 + 54), ry + 4)
    return out.a


def _f(fn, *a, **k): return lambda: fn(*a, **k)

VEHICLES = [
    dict(id='jp-bus-city', name='노선버스(흰·초록 띠)', kind='bus', L=9,
         frames={'right': _f(bus_side, True), 'left': _f(bus_side, False), 'up': bus_up, 'down': bus_down,
                 'left_open': _f(bus_side, False, True)}),   # 문은 왼쪽(인도) 면에만 — 동쪽 진행이면 보이는 면에 문이 없어 right_open 이 없다(멈춰도 right 를 그린다, 2026-10-21 VQA)
    dict(id='jp-tram', name='노면전차(크림·초록)', kind='tram', L=12,
         frames={'right': _f(tram_side, True), 'left': _f(tram_side, False), 'up': tram_up, 'down': tram_down,
                 'right_open': _f(tram_side, True, True), 'left_open': _f(tram_side, False, True)}),
    dict(id='jp-train-commuter', name='통근 전철(은·주황 띠, 3량)', kind='train', L=30,
         frames={'right': _f(rail_side, 'train', True), 'left': _f(rail_side, 'train', False),
                 'right_open': _f(rail_side, 'train', True, True), 'left_open': _f(rail_side, 'train', False, True)}),
    dict(id='jp-subway', name='지하철(은·보라 띠, 3량)', kind='subway', L=30,
         frames={'right': _f(rail_side, 'subway', True), 'left': _f(rail_side, 'subway', False),
                 'right_open': _f(rail_side, 'subway', True, True), 'left_open': _f(rail_side, 'subway', False, True)}),
]
