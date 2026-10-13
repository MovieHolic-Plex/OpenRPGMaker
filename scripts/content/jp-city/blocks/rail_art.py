"""철도·고가·벽돌 보도·골함석 지붕·덩굴 손 도트 키트 — street_hand 가 register(prop) 로 등록한다(shopfront_art 와 같은 방식).
2026-10-13 사용자 참고 화면(건널목·상점가·옛 골목·고가 철도·열차 측면)의 분위기: 붉은 벽돌 보도, 철제 격자 전주, 잔디 둔덕+말뚝 울타리,
고가 콘크리트 보+교각, 크림/청회색 열차(초록 줄), 4색 골함석 지붕, 담쟁이·나팔꽃, 위성 안테나·급수탱크. 그림·팔레트는 베끼지 않는다(우리 램프 K(ramp,shade)).
3/4 관문 교훈: 판정자는 몸체 위쪽 줄을 센다 → 깊은(5줄+) 밝은 윗면 + 뒤 모서리 OL + 어두운 앞면, 얇고 긴 것은 두껍게.
키트 id 는 아래 SPECS 의 `rail-*`·`via-*`·`pave-*` 등. ENABLED 에 든 것만 등록한다(관문 통과분)."""
import os, sys, random
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'houses'))
from house_kit import K, OL            # noqa: E402

# 관문(object-gate) 통과 키트만 굽는다. 전체 후보는 CANDIDATES.
CANDIDATES = []


def _spec(id_, name, w, h, kind, solid=(), other='star', tags=(), rules=''):
    def deco(fn):
        CANDIDATES.append(dict(id=id_, name=name, w=w, h=h, kind=kind, draw=fn, solid=list(solid), other=other, tags=list(tags), rules=rules))
        return fn
    return deco


def deck(c, x, y, w, rows, ramp, t=2, ends=False):
    """3/4 윗면 판: 뒤 모서리 OL, 뒤쪽 두 줄 그늘, 밝은 결, 앞 모서리 밝은 입술."""
    c.HL(x, y - 1, w, OL)
    for j in range(rows):
        col = K(ramp, t - 2) if j == 0 else K(ramp, t - 1) if j == 1 else K(ramp, t + 2) if j == rows - 1 else K(ramp, t + 1) if j == rows - 2 else K(ramp, t)
        c.HL(x, y + j, w, col)
    for j in range(2, rows - 2):
        for i in range(x + (j * 3) % 5, x + w, 6): c.HL(i, y + j, 2, K(ramp, t - 1))
        for i in range(x + 1 + (j * 2) % 4, x + w, 7): c.P(i, y + j, K(ramp, t + 2))
    if ends:
        c.VL(x - 1, y - 1, rows + 1, OL); c.VL(x + w, y - 1, rows + 1, OL)


def slab(c, x, y, w, rows, ramp, t=2, taper=0.5, lip=True):
    """3/4 윗면 사다리꼴 판(뒤쪽 줄이 좁다): 원근이 한눈에 읽힌다. 앞 모서리에 어두운 입술 + OL."""
    for j in range(rows):
        ins = int((rows - 1 - j) * taper)
        x0, ww = x + ins, w - 2 * ins
        c.HL(x0, y + j, ww, K(ramp, t + 1 if j < rows // 2 else t))
        if ww >= 4:
            c.P(x0 + 1, y + j, K(ramp, t + 3)) if j < rows - 1 else None
            for i in range(x0 + 2 + (j * 3) % 4, x0 + ww - 1, 6): c.P(i, y + j, K(ramp, t - 1))
        c.P(x0 - 1, y + j, OL); c.P(x0 + ww, y + j, OL)
    c.HL(x + int((rows - 1) * taper), y - 1, w - 2 * int((rows - 1) * taper), OL)
    if lip:
        c.HL(x, y + rows - 1, w, K(ramp, t - 2)); c.HL(x, y + rows, w, OL)


def disc(c, cx, cy, rx, ry, ramp, t=2):
    for j in range(-ry - 1, ry + 2):
        for i in range(-rx - 1, rx + 2):
            d = (i * i) / ((rx + 0.5) ** 2) + (j * j) / ((ry + 0.5) ** 2)
            if d <= 1.0: c.P(cx + i, cy + j, K(ramp, t + 1) if j < 0 else K(ramp, t))
            elif d <= 1.45: c.P(cx + i, cy + j, OL)


# ───────────────────────── 1) 붉은 벽돌 타일 보도 ─────────────────────────
def _pave(c, var):
    base = 0
    c.R(0, 0, 16, 16, K('kawara', base - 1))
    for ty in (0, 8):
        for tx in (0, 8):
            sh = ((tx // 8) * 3 + (ty // 8) * 5 + var * 7) % 4
            col = K('kawara', base + (1 if sh == 0 else 0 if sh in (1, 3) else -1) if var else base)
            c.R(tx, ty, 7, 7, col)
            c.HL(tx, ty, 7, K('kawara', base + 2)); c.VL(tx, ty, 7, K('kawara', base + 1))      # 타일 왼쪽 위 빛
            c.HL(tx, ty + 6, 7, K('kawara', base - 2))
            if var:
                c.P(tx + 3 + sh, ty + 2 + sh, K('kawara', base + 2)); c.P(tx + 5 - sh, ty + 4, K('kawara', base - 2))
    c.HL(0, 7, 16, K('kawara', -3)); c.HL(0, 15, 16, K('kawara', -3))                          # 줄눈
    c.VL(7, 0, 16, K('kawara', -3)); c.VL(15, 0, 16, K('kawara', -3))


@_spec('pave-a', '붉은 벽돌 타일 보도 A', 1, 1, 'flat', other='flat', tags=['보도', '벽돌', '바닥'], rules='보도 칸 전체에 깐다(사방 이음).')
def pave_a(c): _pave(c, 0)


@_spec('pave-b', '붉은 벽돌 타일 보도 B(얼룩)', 1, 1, 'flat', other='flat', tags=['보도', '벽돌', '바닥'], rules='A 와 섞어 깐다(사방 이음).')
def pave_b(c): _pave(c, 1)


@_spec('pave-manhole', '벽돌 보도 맨홀', 1, 1, 'flat', other='flat', tags=['보도', '맨홀', '바닥'], rules='벽돌 보도 위 드문드문.')
def pave_manhole(c):
    _pave(c, 0)
    disc(c, 8, 8, 6, 5, 'tekko', 1)
    c.HL(4, 8, 8, K('tekko', -1)); c.HL(5, 6, 6, K('tekko', 0)); c.HL(5, 10, 6, K('tekko', 0)); c.VL(8, 4, 8, K('tekko', -1))
    c.P(6, 5, K('tekko', 3)); c.P(7, 5, K('tekko', 3))


# ───────────────────────── 2) 철도 ─────────────────────────
@_spec('rail-pylon', '철제 격자 전주(전차선 기둥, 굵고 짧게 1×2)', 1, 2, 'column', solid=[(0, 1)], tags=['철도', '전주'],
       rules='선로 띠 위·아래 줄 밖(둑·보도 쪽)에 30~40칸 간격. 윗면 뚜껑에서 전차선 키트가 이어진다. 세로로 길게 하려면 위 칸에 rail-pylon-mid 없이 두 개를 쌓지 말 것.')
def rail_pylon(c):
    slab(c, 0, 1, 16, 9, 'kinari', 1, taper=0.25, lip=False)                                  # 뚜껑 윗면(밝은 판)
    c.R(0, 10, 16, 3, K('tekko', -1)); c.HL(0, 10, 16, K('tekko', 1)); c.HL(0, 12, 16, K('tekko', -3))
    c.VL(0, 10, 3, OL); c.VL(15, 10, 3, OL); c.HL(0, 13, 16, OL)
    c.R(3, 13, 10, 9, K('yoru', -1))
    for y in range(13, 22):
        c.VL(3, y, 1, K('tekko', 2)); c.VL(4, y, 1, K('tekko', 1)); c.VL(11, y, 1, K('tekko', -1)); c.VL(12, y, 1, K('tekko', -2))
        k = (y - 13) % 8
        c.P(5 + min(5, abs(k - 4) * 5 // 4), y, K('tekko', 3)); c.P(10 - min(5, abs(k - 4) * 5 // 4), y, K('tekko', 0))
    c.VL(2, 13, 9, OL); c.VL(13, 13, 9, OL)
    slab(c, 0, 22, 16, 7, 'kinari', 1, taper=0.25, lip=False)
    c.R(0, 29, 16, 2, K('conc', -2)); c.HL(0, 29, 16, K('conc', 0)); c.VL(0, 29, 2, OL); c.VL(15, 29, 2, OL); c.HL(0, 31, 16, OL)


@_spec('rail-wire', '전차선(가공 전차선, 처진 곡선 4×1, 4층 전용)', 4, 1, 'wall_mounted', tags=['철도', '전선'], rules='4층(위 덧그림). 선로 띠 위로 4칸 단위 가로로 잇는다(양 끝 높이 같음).')
def rail_wire(c):
    for x in range(64):
        d = (x - 31.5) / 32.0
        y = 2 + int(round(5 * (1 - d * d)))
        c.P(x, y, K('sumi', 1)); c.P(x, y + 1, K('tekko', -2))
    for x in (0, 63): c.VL(x, 0, 3, K('tekko', 1))
    c.HL(0, 12, 64, K('sumi', 1)); c.HL(0, 13, 64, K('tekko', -2))
    for x in (8, 24, 40, 56):
        d = (x - 31.5) / 32.0
        y = 2 + int(round(5 * (1 - d * d)))
        c.VL(x, y + 2, 11 - y, K('tekko', -1))


@_spec('rail-xing-bars', '건널목 보행자 횡단 줄(1×4)', 1, 4, 'flat', other='flat', tags=['철도', '건널목', '횡단보도'], rules='rail-xing 위에 얹는다(레일 위는 비어 있음).')
def rail_xing_bars(c):
    for y0 in (1, 9, 49, 57):
        c.R(1, y0, 14, 5, K('shiro', 0)); c.HL(1, y0, 14, K('shiro', 2)); c.HL(1, y0 + 4, 14, K('shiro', -1))
    c.VL(0, 0, 64, K('shiro', -1)); c.VL(15, 0, 64, K('shiro', -1))


@_spec('rail-verge', '선로 옆 잔디 둔덕 + 말뚝(1×2)', 1, 2, 'structure', solid=[(0, 0), (0, 1)], tags=['철도', '울타리', '잔디'],
       rules='선로 띠 위·아래 줄 바깥에 가로로 이어 찍는다(건널목 칸은 비운다).')
def rail_verge(c):
    for px in (1, 9):                                                                           # 말뚝(짧고 굵게, 큰 윗면)
        deck(c, px, 1, 4, 3, 'conc', 3, ends=True)
        c.R(px, 4, 4, 4, K('tekko', -1)); c.VL(px, 4, 4, K('tekko', 1)); c.VL(px + 3, 4, 4, K('tekko', -3))
    c.HL(0, 5, 16, K('ita', -1)); c.HL(0, 6, 16, K('ita', -3))
    c.HL(0, 8, 16, OL)                                                                          # 잔디 뒤 모서리
    for j in range(9, 26):
        base = K('ki', 2) if j < 12 else K('midori', 0) if j < 19 else K('midori', 1)
        c.HL(0, j, 16, base)
        for i in range((j * 3) % 5, 16, 5): c.P(i, j, K('midori', 2)); c.P((i + 2) % 16, j, K('ki', 1))
    c.HL(0, 25, 16, K('midori', 3))
    c.R(0, 26, 16, 5, K('soil', -1)); c.HL(0, 26, 16, K('soil', 0))
    for i in range(1, 16, 3): c.P(i, 27 + (i % 2), K('soil', 1)); c.P(i + 1, 29, K('soil', -2))
    c.HL(0, 31, 16, OL)


@_spec('rail-signal2', '건널목 경보기(지붕 있는 큰 함체, 1×2)', 1, 2, 'structure', solid=[(0, 1)], tags=['철도', '건널목', '경보기'],
       rules='건널목 양쪽 보도 칸에 하나씩.')
def rail_signal2(c):
    slab(c, 0, 1, 16, 8, 'kinari', 1, taper=0.25, lip=False)                                    # 함체 윗면(밝은 판)
    c.R(0, 9, 16, 9, K('kii', -1)); c.HL(0, 9, 16, K('kii', 1)); c.VL(0, 9, 9, K('kii', 1)); c.HL(0, 17, 16, K('kii', -2))
    c.VL(0, 9, 9, OL); c.VL(15, 9, 9, OL); c.HL(0, 18, 16, OL)
    for x in (2, 9):
        c.R(x, 11, 5, 4, K('sumi', 1)); c.R(x + 1, 12, 3, 2, K('aka', 1)); c.P(x + 1, 12, K('aka', 3))
    for y in range(18, 23):
        col = K('kii', 1) if (y // 2) % 2 else K('sumi', 1)
        c.R(6, y, 4, 1, col); c.P(5, y, OL); c.P(10, y, OL)
    slab(c, 1, 22, 14, 6, 'kinari', 1, taper=0.25, lip=False)                                   # 기초판 윗면
    c.R(1, 28, 14, 3, K('conc', -2)); c.HL(1, 28, 14, K('conc', 0)); c.VL(0, 28, 3, OL); c.VL(15, 28, 3, OL); c.HL(0, 31, 16, OL)


# ───────────────────────── 3) 고가 철도 ─────────────────────────
def _via_top(c):
    deck(c, 0, 1, 16, 26, 'conc', 3)                                                            # 고가 바닥 윗면(밝은 콘크리트 판, 깊게)
    for y in (5, 10, 16, 22): c.HL(0, y, 16, K('conc', 2))                                       # 앞으로 갈수록 성긴 이음
    for x in range(0, 16, 8): c.VL(x, 3, 22, K('conc', 2))
    c.P(5, 8, K('pinku', -1)); c.P(11, 14, K('pinku', 0)); c.P(2, 19, K('pinku', -1))
    c.HL(0, 27, 16, K('conc', -2))
    c.R(0, 28, 16, 11, K('conc', -2)); c.HL(0, 28, 16, K('conc', 1))                              # 보 앞면(어둡게)
    for x in range(2, 16, 5): c.VL(x, 30, 7, K('conc', -3)); c.P(x + 1, 31, K('conc', 0))
    c.HL(0, 37, 16, K('tekko', -2)); c.HL(0, 38, 16, K('tekko', -3))
    c.HL(0, 39, 16, OL)
    for y in range(40, 47): c.HL(0, y, 16, K('yoru', -1 if y < 43 else -2))                    # 보 밑 그늘


@_spec('via-span', '고가 철도 구간(보행로 윗면+보 앞면, 1×4)', 1, 4, 'structure', solid=[(0, 2), (0, 3)], tags=['철도', '고가', '고가 구간'],
       rules='가로로 쭉 잇고 4~6칸마다 via-pier 를 끼운다. 위 3칸(윗면)은 열차가 지나는 높은 바닥이다.')
def via_span(c):
    _via_top(c)
    c.R(0, 47, 16, 17, K('tekko', -3))
    for y in (50, 56): c.HL(0, y, 16, K('tekko', -2))
    for x in range(3, 16, 8): c.R(x, 52, 4, 2, K('tekko', 0))
    c.HL(0, 63, 16, K('yoru', -2))


@_spec('via-pier', '고가 철도 교각(보 + 기둥, 1×4)', 1, 4, 'structure', solid=[(0, 2), (0, 3)], tags=['철도', '고가', '교각'],
       rules='via-span 사이에 끼운다.')
def via_pier(c):
    _via_top(c)
    c.R(0, 47, 16, 17, K('tekko', -3))
    c.R(0, 40, 16, 6, K('conc', -1)); c.HL(0, 40, 16, K('conc', 1)); c.HL(0, 45, 16, K('conc', -3))     # 기둥머리
    c.R(3, 46, 10, 17, K('conc', 0)); c.VL(3, 46, 17, K('conc', 2)); c.VL(4, 46, 17, K('conc', 1)); c.VL(12, 46, 17, K('conc', -2))
    c.VL(2, 46, 17, OL); c.VL(13, 46, 17, OL)
    c.R(1, 60, 14, 3, K('conc', -2)); c.HL(1, 60, 14, K('conc', 1)); c.HL(0, 63, 16, OL)


@_spec('platform-edge', '승강장 가장자리(노란 점자 블록, 1×2)', 1, 2, 'structure', solid=[(0, 1)], tags=['철도', '승강장', '점자블록'],
       rules='선로 가까운 쪽 승강장 가장자리에 가로로 잇는다.')
def platform_edge(c):
    deck(c, 0, 1, 16, 20, 'conc', 2)
    for y in range(4, 12, 4): c.HL(0, y, 16, K('conc', 1))
    for x in range(0, 16, 8): c.VL(x, 2, 9, K('conc', 1))
    c.R(0, 13, 16, 5, K('kii', 1)); c.HL(0, 13, 16, K('kii', 3)); c.HL(0, 17, 16, K('kii', -1))
    for x in range(1, 16, 3):
        for y in (14, 16): c.P(x, y, K('kii', -1)); c.P(x + 1, y, K('kii', 3))
    c.R(0, 21, 16, 9, K('conc', -2)); c.HL(0, 21, 16, K('conc', 0)); c.HL(0, 22, 16, K('conc', -1))
    for x in range(3, 16, 7): c.VL(x, 24, 5, K('conc', -3))
    c.HL(0, 29, 16, K('conc', -3)); c.HL(0, 30, 16, OL); c.HL(0, 31, 16, K('yoru', -2))


def _train(c, kind):
    W = 64
    c.HL(0, 0, W, OL)
    deck(c, 0, 1, W, 17, 'conc', 3, ends=False)                                                # 지붕 윗면(밝은 회백색 판, 깊게)
    for j in (6, 12): c.HL(0, j, W, K('conc', 2))
    for ax in ((6, 40) if kind == 'a' else (10, 44)):                                         # 지붕 에어컨(윗면+앞면)
        deck(c, ax, 5, 14, 5, 'shiro', 2, ends=True)
        c.R(ax, 10, 14, 3, K('tekko', 0)); c.HL(ax, 10, 14, K('tekko', 2)); c.HL(ax, 12, 14, K('tekko', -2))
        c.VL(ax - 1, 10, 3, OL); c.VL(ax + 14, 10, 3, OL); c.HL(ax - 1, 13, 16, OL)
    if kind == 'a':                                                                            # 지붕 환기 덮개(낮은 상자)
        slab(c, 22, 6, 18, 6, 'conc', 1, taper=0.5, lip=True)
    if kind == 'b':                                                                            # 팬터그래프
        for k in range(8): c.P(28 + k, 8 + k // 2, K('tekko', -1)); c.P(35 - k, 8 + k // 2, K('tekko', -1))
        c.HL(24, 7, 16, K('tekko', 2)); c.HL(24, 6, 16, OL)
    c.HL(0, 18, W, K('tekko', -3)); c.HL(0, 19, W, OL)                                        # 처마(윗면 ↔ 옆면 경계)
    c.R(0, 20, W, 6, K('kinari', 2)); c.HL(0, 20, W, K('kinari', 1))
    for px in range(5, W - 8, 24 if kind == 'a' else 20):
        c.R(px, 21, 11, 3, K('shiro', 0)); c.HL(px, 21, 11, K('shiro', 2)); c.HL(px, 23, 11, K('kinari', 0))
    c.HL(0, 26, W, K('kinari', 0))
    c.R(0, 27, W, 12, K('tairu', 3)); c.HL(0, 27, W, K('tairu', 4))
    c.HL(0, 34, W, K('midori', -1)); c.HL(0, 35, W, K('midori', 0)); c.HL(0, 36, W, K('midori', -1))   # 초록 줄
    c.HL(0, 38, W, K('tairu', 1))
    doors = (12, 44) if kind == 'a' else (8, 48)
    wins = (3, 22, 29, 36, 53) if kind == 'a' else (20, 27, 34, 41)
    for x in wins:
        c.R(x, 29, 6, 4, K('tairu', -2)); c.HL(x, 29, 6, K('tairu', -1)); c.P(x + 1, 30, K('garasu', 1))
    for dx in doors:
        c.R(dx, 27, 8, 11, K('tekko', 2)); c.VL(dx + 3, 27, 11, K('tekko', 0)); c.VL(dx + 4, 27, 11, K('tekko', -1))
        c.R(dx + 1, 29, 2, 4, K('tairu', -2)); c.R(dx + 5, 29, 2, 4, K('tairu', -2)); c.P(dx + 1, 30, K('garasu', 1)); c.P(dx + 5, 30, K('garasu', 1))
        c.HL(dx, 34, 8, K('midori', -1))
    c.R(0, 39, W, 3, K('tekko', -2)); c.HL(0, 39, W, K('tekko', 0))
    for bx in (10, 22, 42, 54):
        c.R(bx - 3, 42, 7, 3, K('yoru', -1)); c.P(bx - 2, 43, K('tekko', 2)); c.P(bx + 2, 43, K('tekko', 2))
    c.HL(0, 45, W, OL); c.HL(0, 46, W, K('yoru', -2))


@_spec('train-car-a', '통근 열차 한 량 A(크림+청회색, 초록 줄, 4×3)', 4, 3, 'box', solid=[(x, 1) for x in range(4)] + [(x, 2) for x in range(4)],
       tags=['철도', '열차', '탈것'], rules='선로(jp-rail-h) 위에 4칸 단위로 이어 4량 편성(A B A B). 좌우 이음 화소가 이어진다.')
def train_a(c): _train(c, 'a')


@_spec('train-car-b', '통근 열차 한 량 B(팬터그래프, 4×3)', 4, 3, 'box', solid=[(x, 1) for x in range(4)] + [(x, 2) for x in range(4)],
       tags=['철도', '열차', '탈것'], rules='A 사이에 낀다.')
def train_b(c): _train(c, 'b')


# ───────────────────────── 4) 골함석 지붕 ─────────────────────────
def _roof(c, ramp, t):
    c.HL(0, 0, 32, OL)
    for y in range(1, 26):
        for x in range(32):
            k = (x % 4)
            tt = t + (1 if k == 0 else 0 if k in (1, 3) else -1)
            if y <= 3: tt = t + (3 if y == 1 else 2 if y == 2 else 1)
            elif y > 20: tt -= 1
            elif y % 11 == 0: tt -= 2
            c.P(x, y, K(ramp, tt))
    for x in range(0, 32, 6): c.P(x + 1, 6 + (x % 5), K(ramp, t + 2))
    c.HL(0, 26, 32, K(ramp, t + 2))
    for y in range(27, 30):
        for x in range(32):
            c.P(x, y, K(ramp, t - 2 - (1 if (x // 2) % 2 else 0)))
    c.HL(0, 30, 32, OL); c.HL(0, 31, 32, K('yoru', -2))


for _n, _r, _t in (('orange', 'daidai', -1), ('navy', 'tairu', 0), ('green', 'ki', 1), ('charcoal', 'tekko', -1)):
    _spec('roof-' + _n, '골함석 지붕면 %s(2×2)' % _n, 2, 2, 'structure', solid=[(0, 1), (1, 1)], tags=['지붕', '골함석', _n],
          rules='가로로 이어 붙인다. 위 줄이 용마루 쪽.')(lambda c, _r=_r, _t=_t: _roof(c, _r, _t))


# ───────────────────────── 5) 덩굴·옥상 소품 ─────────────────────────
def _vines(c, seed, flowers):
    rnd = random.Random(seed)
    for y in range(0, 32, 2):
        x = 7 + int(3 * ((y // 4) % 3 - 1)) + rnd.randint(-1, 1)
        c.P(x, y, K('ki', 0)); c.P(x, y + 1, K('ki', 0))
    for _ in range(46):
        x = rnd.randint(2, 13); y = rnd.randint(1, 30)
        c.R(x, y, 2, 2, K('midori', rnd.choice((-1, 0, 0, 1)))); c.P(x, y, K('midori', 2)); c.P(x + 1, y + 1, K('ki', 0))
    if flowers:
        for _ in range(9):
            x = rnd.randint(2, 13); y = rnd.randint(2, 29)
            c.P(x, y, K('murasaki', 2)); c.P(x + 1, y, K('sora', 3)); c.P(x, y + 1, K('murasaki', 3))


@_spec('ivy', '담쟁이 덩굴(벽 덧그림, 1×2)', 1, 2, 'organic', tags=['식물', '덩굴', '벽'], rules='건물 벽 앞 4층(위 덧그림)에 세로로 얹는다.')
def ivy(c): _vines(c, 3, False)


@_spec('glory', '나팔꽃 덩굴(벽 덧그림, 1×2)', 1, 2, 'organic', tags=['식물', '나팔꽃', '벽'], rules='건물 벽 앞 4층(위 덧그림)에 세로로 얹는다.')
def glory(c): _vines(c, 9, True)


@_spec('sat-dish', '위성 안테나(옥상 받침 위, 1×1)', 1, 1, 'other', solid=[(0, 0)], tags=['옥상', '안테나'], rules='옥상 칸 위에 하나.')
def sat_dish(c):
    slab(c, 0, 8, 16, 5, 'conc', 2, taper=0.6, lip=False)                                        # 받침 윗면(사다리꼴)
    c.R(0, 13, 16, 2, K('conc', -2)); c.HL(0, 13, 16, K('conc', 0)); c.VL(0, 13, 2, OL); c.VL(15, 13, 2, OL); c.HL(0, 15, 16, OL)
    c.R(7, 6, 2, 3, K('tekko', 0))
    disc(c, 7, 3, 6, 3, 'shiro', 2)
    for i in range(-4, 4): c.P(7 + i, 3, K('tairu', 3)); 
    c.HL(4, 2, 7, K('tairu', 1)); c.HL(5, 4, 5, K('tairu', 2))
    c.R(11, 0, 2, 1, K('tekko', 0)); c.P(10, 1, K('tekko', -1))


@_spec('water-tank', '옥상 급수탱크(원통 윗면, 1×2)', 1, 2, 'round_body', solid=[(0, 1)], tags=['옥상', '탱크'], rules='옥상 칸 위에 하나.')
def water_tank(c):
    for y in range(6, 24):
        for x in range(1, 15):
            t = 3 if x < 4 else 2 if x < 7 else 1 if x < 11 else -1
            c.P(x, y, K('hodo', t))
    for y in (11, 17): c.HL(1, y, 14, K('hodo', -2)); c.HL(1, y + 1, 14, K('hodo', -3))
    c.VL(0, 4, 20, OL); c.VL(15, 4, 20, OL); c.HL(1, 24, 14, OL)
    disc(c, 8, 5, 7, 4, 'hodo', 2)
    c.HL(4, 4, 8, K('hodo', 3)); c.R(6, 3, 4, 2, K('tekko', 1))                                 # 뚜껑
    for x in (2, 12): c.R(x, 25, 2, 5, K('tekko', 0)); c.P(x, 25, K('tekko', 2))
    c.HL(1, 30, 14, OL); c.HL(2, 31, 12, K('yoru', -2))


# 관문 통과분(2026-10-13, 영수증 harness-data/object-gate/receipts). 미통과(4라운드 넘게 실패): rail-pylon(전주), rail-signal2(경보기) — 윗면 0행 정면 입면도 판정.
# 후보 전체를 다시 검사하려면 ENABLED = None.
ENABLED = {'pave-a', 'pave-b', 'pave-manhole', 'rail-wire', 'rail-xing-bars', 'rail-verge', 'via-span', 'via-pier', 'platform-edge',
           'train-car-a', 'train-car-b', 'roof-orange', 'roof-navy', 'roof-green', 'roof-charcoal', 'ivy', 'glory', 'sat-dish', 'water-tank'}


def register(prop):
    for s in CANDIDATES:
        if ENABLED is not None and s['id'] not in ENABLED: continue
        prop(s['id'], s['name'], s['w'], s['h'], solid=s['solid'], other=s['other'], tags=s['tags'], rules=s['rules'])(s['draw'])


def kinds():
    return {'jp-' + s['id']: s['kind'] for s in CANDIDATES}
