"""jp_city 움직이는 대형 탈것: 노선버스 · 노면전차(1량) · 통근 전철(3량) · 지하철(3량). 계약: SPEC.md

옆모습은 진행 방향(앞)이 오른쪽(`right`) 또는 왼쪽(`left`). `left` 는 반전하지 않고 기하만 거꾸로 놓는다 —
빛(왼쪽 위 밝음 · 오른쪽 어둠)은 방향과 무관하게 고정이라 그림자 열은 늘 오른쪽에 둔다.
문은 남쪽(보이는) 면에 있고 `_open` 은 그 문이 열려 어두운 실내(yoru 낮은 단)가 보인다.
앞/뒤(`down`/`up`)는 폭 32: 위(먼 끝) → 지붕(가장 밝은 단 · 에어컨 · 환기 줄) → 앞유리 → 얼굴 → 바닥 그림자.
"""
import os, sys
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
    def glass(s, x, y, w, h, base=2, hi=4, top=3):
        """유리: 위 top 줄 밝음, 오른쪽 열 어둠(화면 기준 — 방향 무관)."""
        X = s.fx(x, w); c = s.c
        c.R(X, y, w, h, K('garasu', base)); c.R(X, y, w, top, K('garasu', hi)); c.VL(X + w - 1, y, h, K('garasu', 0))
        if w > 6: c.P(X + 1, y + top, K('garasu', hi))
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

def bus_side(front_right=True, open_=False):
    s = Side(144, 64, front_right); c = s.c
    SH, SB = K('shiro', 2), K('shiro', 1)
    # 지붕 윗면(밝음) — 둥근 앞뒤 모서리
    c.R(2, 6, 138, 11, SH); c.VL(139, 7, 10, K('shiro', 0)); c.HL(2, 16, 138, K('conc', 1))
    for x in (12, 52):                                                                                  # 에어컨 · 뒤쪽 냉각기(뒤 절반)
        s.R(x, 8, 24, 6, K('conc', 2)); s.HL(x, 8, 24, K('shiro', 2)); s.HL(x, 13, 24, K('conc', 0))
        for i in range(3, 22, 4): s.VL(x + i, 10, 2, K('conc', 0))
    X = s.fx(76, 22); c.R(X, 10, 22, 3, K('conc', 1)); c.HL(X, 10, 22, K('conc', 3))                    # 환기 덮개
    # 옆면
    c.R(2, 17, 138, 37, SB); c.VL(2, 18, 35, K('shiro', 2)); c.VL(139, 18, 35, K('conc', 0)); c.HL(2, 17, 138, K('conc', 2))
    c.HL(2, 19, 138, K(BUS_BAND, 1))                                                                    # 처마 가는 띠
    c.R(2, 38, 138, 5, K(BUS_BAND, 1)); c.HL(2, 38, 138, K(BUS_BAND, 2)); c.HL(2, 42, 138, K(BUS_BAND, -1))   # 허리 띠
    c.HL(2, 46, 138, K(BUS_BAND, 0))
    # 창 (뒤 → 중문 → 앞문 사이)
    for x in (6, 20, 34, 48): s.glass(x, 22, 12, 13)
    s.glass(82, 22, 12, 13); s.glass(96, 22, 12, 13); s.glass(110, 22, 4, 13)
    _led(c, s.fx(82, 12), 22, 12)                                                                       # 옆 행선 LED (중문 옆 창 위)
    # 문: 중문(66..79) · 앞문(116..129) — 저상: 문 아래가 치마 바로 위까지
    for dx in (66, 116):
        X = s.fx(dx, 14)
        c.R(X - 1, 21, 16, 33, K('conc', 0))                                                            # 문틀
        if open_:
            c.R(X, 22, 14, 31, K('yoru', -2)); c.R(X, 22, 14, 2, K('yoru', -3))
            c.HL(X, 51, 14, K('yoru', 0)); c.HL(X, 52, 14, K('conc', 1))                                  # 바닥 · 디딤
            c.R(X, 22, 2, 30, K('garasu', 0)); c.R(X + 12, 22, 2, 30, K('garasu', 0))                      # 접힌 문짝
            c.VL(X + 3, 26, 24, K('kii', 1)); c.VL(X + 10, 26, 24, K('kii', 0))                           # 손잡이 봉
            c.R(X + 5, 28, 4, 10, K('yoru', -1))                                                         # 실내 반대편 창
        else:
            c.R(X, 22, 14, 31, K('garasu', 2)); c.R(X, 22, 14, 3, K('garasu', 4)); c.VL(X + 13, 22, 31, K('garasu', 0))
            c.VL(X + 6, 22, 31, K('tekko', 1)); c.VL(X + 7, 22, 31, K('conc', 2))                         # 두 짝 이음
            c.HL(X, 36, 14, K('conc', 1)); c.HL(X, 52, 14, K('tekko', 1))
    # 앞(운전석 옆 큰 유리 · 앞 행선)
    s.glass(131, 21, 9, 16, base=3)
    X = s.fx(131, 9); c.VL(X if front_right else X + 8, 21, 16, K('conc', 0))
    _led(c, s.fx(124, 15), 10, 15)
    s.R(134, 44, 5, 3, K('kii', 3)); s.HL(134, 44, 5, K('kii', 2))                                    # 전조등
    s.R(130, 49, 9, 2, K('conc', 0))                                                                    # 앞 범퍼 모서리
    # 뒤: 세로 후미등 + 뒤 창
    s.R(3, 23, 2, 10, K('aka', 0)); s.VL(3, 23, 10, K('aka', 2)); s.R(3, 44, 2, 3, K('aka', -1))
    # 치마 · 바퀴
    c.R(2, 51, 138, 3, K('tekko', 1)); c.HL(2, 51, 138, K('tekko', 2))
    for dx in (66, 116):
        if not open_: s.R(dx - 1, 51, 16, 3, K('conc', 0))
    for x in (28, 102):
        s.arch(x, 52, 8); s.wheel(x, 55, 7)
    out = ink2(c)
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
        c.HL(2 + ins, 144 + j, 28 - 2 * ins, K('garasu', 4 if j < 3 else 3))
    c.R(5, 149, 9, 9, K('garasu', 1))                                                                    # 운전석(화면 왼쪽) 어두운 유리
    c.VL(16, 145, 13, K('conc', 0))                                                                      # 가운데 기둥
    c.VL(26, 147, 11, K('garasu', 0))
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
    for j in range(8): c.HL(5, 146 + j, 22, K('garasu', 4 if j < 2 else 2))                              # 뒤 창
    c.VL(26, 146, 8, K('garasu', 0))
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
    c.R(4, 12, W - 8, 8, K('conc', 3)); c.HL(6, 11, W - 12, K('conc', 3)); c.HL(4, 19, W - 8, K('conc', 1))
    c.VL(W - 5, 12, 7, K('conc', 1))
    for x in (24, 140):                                                                                  # 에어컨 · 저항기 상자
        s.R(x, 13, 26, 5, K('conc', 2)); s.HL(x, 13, 26, K('shiro', 2)); s.HL(x, 17, 26, K('conc', 0))
    s.R(88, 15, 24, 3, K('tekko', 1)); s.HL(88, 15, 24, K('tekko', 3))                                   # 집전장치 받침
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
            if (X < W // 2) == True: c.HL(X + sl, 22 + j, 12 - sl, K('garasu', 3 if j > 2 else 4))
            else: c.HL(X, 22 + j, 12 - sl, K('garasu', 3 if j > 2 else 4))
        c.VL(X + (11 if X < W // 2 else 0), 22, 15, K('conc', 0))
        c.R(X + 3, 26, 6, 9, K('garasu', 1))                                                             # 어두운 운전석
        _led(c, s.fx(x0 + 1 if not front else x0 - 1, 12), 14, 12, 'kii')                                # 행선 표시(양 끝)
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
            c.R(X, 23, 14, 14, K('garasu', 2)); c.R(X, 23, 14, 3, K('garasu', 4)); c.VL(X + 13, 23, 14, K('garasu', 0))
            c.R(X, 37, 14, 15, K(TRAM_LO, 0)); c.HL(X, 37, 14, K(TRAM_LO, 1))
            c.VL(X + 6, 23, 29, K('tekko', 0)); c.VL(X + 7, 23, 29, K(TRAM_UP, 0))
    s.R(W - 10, 46, 4, 3, K('kii', 3))                                                                    # 앞 전조등(낮은 곳)
    s.R(4, 46, 3, 3, K('aka', 1))                                                                         # 뒤 미등
    # 치마(바퀴 대부분 가림) + 대차
    c.R(3, 53, W - 6, 4, K(TRAM_LO, -1)); c.HL(3, 53, W - 6, K(TRAM_LO, -2)); c.HL(3, 56, W - 6, K('tekko', -1))
    for bx in (44, 148):
        s.R(bx - 12, 57, 24, 2, K('tekko', -2))
        s.wheel(bx - 6, 58, 4); s.wheel(bx + 6, 58, 4)
    _cut(c, [(2, 20), (W - 3, 20), (3, 11), (W - 4, 11)])
    out = ink2(c)
    _panto_diamond(out, s.fx(100), 11)
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
        c.HL(4, y0 + 6 + j, 11, K('garasu', 4 if j < 2 else 3)); c.HL(17, y0 + 6 + j, 11, K('garasu', 4 if j < 2 else 3))
    c.VL(14, y0 + 6, 11, K('garasu', 0)); c.VL(27, y0 + 6, 11, K('garasu', 0))
    if front: c.R(5, y0 + 10, 7, 7, K('garasu', 1))                                                      # 운전석
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
DOORS = (16, 53, 91, 129)                       # 차 안 기준 문 x (폭 12)

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
        # 창(문 사이 3개 + 양 끝)
        for i in range(3):
            wx = DOORS[i] + 12 + 3
            s.glass(x0 + wx, 21, 20, 12); s.VL(x0 + wx + 10, 21, 12, K('conc', 1))
        if not lead: s.glass(x0 + 3, 21, 9, 12)
        if not tail: s.glass(x0 + 145, 21, 9, 12)
        # 문 4개 (두 짝 미닫이)
        for dx in DOORS:
            X = s.fx(x0 + dx, 12)
            c.R(X - 1, by + 2, 14, 48 - by - 1, K('tekko', 0))
            if open_:
                c.R(X, by + 3, 12, 45 - by - 1, K('yoru', -3)); c.R(X + 2, 24, 8, 8, K('yoru', -2))         # 실내 + 반대편 창
                c.HL(X, 46, 12, K('yoru', 0)); c.HL(X, 47, 12, K('conc', 1))
                c.VL(X + 1, by + 6, 38 - by, K('conc', 1))                                                # 손잡이 봉
            else:
                c.R(X, by + 3, 12, 45 - by - 1, K('conc', 2))
                c.R(X + 1, 22, 4, 10, K('garasu', 3)); c.R(X + 7, 22, 4, 10, K('garasu', 3))
                c.HL(X + 1, 22, 4, K('garasu', 4)); c.HL(X + 7, 22, 4, K('garasu', 4))
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
                c.HL(gx0, 20 + j, 11 - sl, K('garasu', 4 if j < 3 else 2))
            c.R(X + (3 if nose_right else 5), 25, 5, 7, K('garasu', 1))                                    # 어두운 운전석
            c.VL(X + (12 if nose_right else 0), by, 49 - by, K('conc', 0) if nose_right else K('conc', 3))  # 앞 얼굴 모서리
            if sub:                                                                                       # 앞 비상문: 테두리 + 창 + 손잡이
                ex0 = X + (8 if nose_right else 1)
                c.R(ex0, by + 1, 4, 47 - by - 1, K('conc', 1)); c.VL(ex0 + (3 if nose_right else 0), by + 1, 46 - by, K('tekko', 0))
                c.R(ex0 + 1, 21, 2, 10, K('garasu', 2)); c.P(ex0 + 1, 21, K('garasu', 4))
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
    if not sub:                                                                                          # 싱글암 팬터그래프 (가운데 차)
        bx = s.fx(161 + 44)
        d = 1 if front_right else -1
        dk = K('sumi', 0)
        def line(x0, y0, x1, y1, col):
            n = max(abs(x1 - x0), abs(y1 - y0))
            for i in range(n + 1):
                out.P(round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n), col)
        tk = K('tekko', 0)
        out.R(min(bx, bx + d * 9), ry - 2, 10, 2, dk); out.R(min(bx, bx + d * 9) + 1, ry - 2, 8, 1, tk)   # 받침틀
        out.P(bx, ry - 3, K('conc', 3)); out.P(bx + d * 9, ry - 3, K('conc', 3))                          # 애자
        line(bx + d * 1, ry - 3, bx + d * 10, ry - 7, dk)                                                 # 아래 팔(앞으로)
        line(bx + d * 10, ry - 7, bx + d * 4, ry - 9, dk)                                                 # 위 팔(뒤로 접힘)
        line(bx + d * 2, ry - 3, bx + d * 9, ry - 6, tk)                                                  # 아래 팔 밝은 면
        for i in range(-4, 5): out.P(bx + d * 4 + i, ry - 10, dk)                                         # 습판
        out.P(bx + d * 4 - 5, ry - 9, dk); out.P(bx + d * 4 + 5, ry - 9, dk)                              # 습판 뿔
    return out.a


def _f(fn, *a, **k): return lambda: fn(*a, **k)

VEHICLES = [
    dict(id='jp-bus-city', name='노선버스(흰·초록 띠)', kind='bus', L=9,
         frames={'right': _f(bus_side, True), 'left': _f(bus_side, False), 'up': bus_up, 'down': bus_down,
                 'right_open': _f(bus_side, True, True), 'left_open': _f(bus_side, False, True)}),
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
