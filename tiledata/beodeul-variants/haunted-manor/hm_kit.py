# 폐가 저택 내부 던전(haunted-manor) 공용 재료 — 장르 gothic (tiledata/beodeul-kits/genres/gothic.md).
# tower-interior 의 ti_kit(→ graveyard-crypt gc_kit/gc_ext/gc_map, _lib3 dlib)을 읽기만 하고 그리기 도우미(Cv·Mk·vol·fin·stone_box·
# cyl_k·topell·Kit·KMap·mk_floor)를 그대로 쓴다. 새 재질(검은 참나무 마루·썩은 마루·바랜 대리석 바둑판·젖은 지하 판석·
# 바랜 벽지와 판벽·청회 석재)은 버들항 7단 램프(0 윤곽 .. 6 밝음)를 채도 40~55% 로 낮춰 청회 쪽으로 기울인 램프로 칠한다.
# 3/4 시점, 빛 왼쪽 위, 1칸 = 16px. 사람·글자·상표 없음.
import os, sys, math
_HM_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(_HM_DIR, '..', 'tower-interior'))
from ti_kit import *                                    # noqa  (T, ST, WD, Cv, Mk, vol, fin, mk, mix, mul, Kit, KMap, foot, SAMPLES …)
from ti_kit import _hash
import ti_kit as TK
import dlib
HERE = HERE0 = _HM_DIR                   # ti_kit 의 HERE0(탑 내부)로 덮이지 않게 다시 고정


def desat(ramp, s=.5, tint=(0, 0, 0), t=0.0, k=1.0):
    """램프 채도를 s 배로(0 = 회색), tint 쪽으로 t 만큼, 밝기 k 배."""
    out = []
    for c in ramp:
        l = .3 * c[0] + .59 * c[1] + .11 * c[2]
        d = tuple(l + (c[i] - l) * s for i in range(3))
        d = tuple(d[i] + (tint[i] - d[i]) * t for i in range(3))
        out.append(tuple(max(0, min(255, int(v * k))) for v in d))
    return out


BLUEG = (64, 72, 92)
# 검은 참나무(목골·마루·가구): 버들항 WD 를 채도 45%, 청회로 살짝, 한 단 어둡게
GW = desat(WD, .42, BLUEG, .2, .86)
GW[6] = mix(GW[6], (150, 128, 104), .25)
# 청회 석재(gothic.md #2b3140 ~ #9aa3ad)
GS = [(18, 20, 30), (32, 36, 48), (43, 49, 64), (62, 69, 84), (90, 98, 112), (124, 132, 144), (160, 168, 178)]
# 검붉은 천(카펫·커튼·의자 천): #5a1e24 ~ #8e2f33
CR = [(26, 12, 20), (48, 18, 26), (68, 24, 30), (90, 30, 36), (112, 38, 42), (142, 47, 51), (168, 84, 78)]
# 흐린 호박색 등불(#c8a050): 초·창 불빛만
AM = [(58, 40, 22), (106, 76, 36), (156, 116, 54), (200, 160, 80), (226, 196, 122), (246, 228, 172), (255, 246, 214)]
# 바랜 벽지(회청록 다마스크)
PP = [(22, 26, 32), (36, 42, 48), (50, 58, 64), (66, 76, 80), (86, 96, 98), (108, 116, 116), (136, 142, 138)]
# 흐린 놋쇠(손잡이·액자 테·촛대): 버들항 금을 채도 45%
BRS = desat(GLD, .45, BLUEG, .12, .92)
# 덮개 천(먼지 쌓인 리넨)
LN = [(40, 42, 50), (70, 72, 78), (102, 104, 106), (132, 132, 130), (158, 156, 150), (182, 178, 170), (204, 200, 190)]
# 먼지·거미줄·곰팡이
DU = [(58, 56, 56), (82, 80, 76), (108, 104, 98), (134, 130, 120), (158, 154, 142), (180, 176, 164), (200, 196, 184)]
WEB = [(118, 124, 132), (146, 152, 160), (172, 176, 184), (200, 202, 208)]
MO = [(16, 20, 22), (22, 28, 30), (30, 38, 38), (40, 50, 46), (54, 64, 58), (70, 80, 70), (92, 100, 86)]   # 곰팡이(검푸른 회록, 채도 낮게)
# 어두운 거울·유리(밤 창)
GLS = [(14, 18, 28), (24, 32, 46), (40, 52, 70), (62, 78, 98), (98, 116, 136), (150, 166, 182), (206, 214, 222)]
# 쇠(경첩·자물쇠·사슬): ti_kit IRON 을 한 단 녹슬게
RI = [mix(c, (70, 46, 34), .18) for c in IR]
# 포도주(병·얼룩)
WN = [(22, 14, 22), (38, 22, 34), (54, 32, 46), (72, 44, 58), (94, 62, 74)]   # 마른 포도주(보라 갈색, 피처럼 붉지 않게)
BOT = [(10, 18, 16), (18, 32, 28), (30, 50, 42), (46, 72, 60), (84, 116, 100), (150, 178, 160)]   # 짙은 녹색 병 유리
OUTL = (14, 12, 20)


# ------------------------------------------------------------------ 바닥 (48x48 주기 표본, 3x3 이음새 없음)
def _board(X, Y, seed, ramp, bh=6, bl=48):
    """가로로 누운 마루 널: 높이 bh, 길이 bl, 줄마다 이음 위치가 다르다. 결(가는 어두운 줄)·못·옹이. (색, 널 번호, 칸 안 위치)"""
    row = Y // bh; ly = Y % bh
    off = int(_hash(row % (48 // bh), 0, seed + 1) * 8) * 6
    xx = (X + off) % 48; col = (xx // bl + row) % 3; lx = xx % bl
    if (lx + 24) % 48 == 47 and _hash(row % (48 // bh), 1, seed + 4) < .45: return ramp[1], (col + 1, row), (lx, ly)   # 반쪽 널 이음
    if ly == bh - 1: return ramp[1], (col, row), (lx, ly)
    if lx == bl - 1: return ramp[1], (col, row), (lx, ly)
    h = _hash(col, row % (48 // bh), seed + 2)
    k = 4 if h < .5 else (3 if h < .82 else 5)
    c = ramp[k]
    if ly == 0: c = mix(c, ramp[min(6, k + 1)], .5)
    elif ly == bh - 2: c = mix(c, ramp[k - 1], .45)
    g = pn(X * 1.0, Y * 4.0, 6, seed + 3)
    if g > .72: c = mix(c, ramp[k - 1], .55)
    elif g < .16: c = mix(c, ramp[min(6, k + 1)], .3)
    if lx in (1, bl - 3) and ly == bh // 2 - 1 and _hash(col, row, seed + 5) < .6: c = ramp[1]   # 못
    return c, (col, row), (lx, ly)


def manor_boards(X, Y):
    """저택 마루: 검은 참나무 널(6px 줄, 24px 길이). 바랜 결, 못, 드문드문 닳아 밝은 널."""
    c, (col, row), (lx, ly) = _board(X, Y, 701, GW)
    if _hash(X, Y, 703) < .04: c = mul(c, .86)
    return c
mk_floor('hm_boards', manor_boards)


def rotten_boards(X, Y):
    """썩은 마루: 저택 마루와 같은 긴 널에 부러져 빠진 토막(들쭉날쭉 끝, 어둠 속 들보), 바랜 회색 널,
    곰팡이 점, 쪼개진 금. 걷는 바닥(구멍은 널 한 줄 폭이라 발이 빠지지 않는다)."""
    c, (col, row), (lx, ly) = _board(X, Y, 701, GW)
    nr = 48 // 6
    if c == GW[1] and ly == 5: return c
    r = row % nr
    h = _hash(col, r, 716)
    if h < .17:                                                                # 부러져 빠진 토막
        x0 = 4 + int(_hash(col, r, 717) * 26); L = 9 + int(_hash(col, r, 718) * 6)
        j0 = x0 + (1 if (ly + r) % 3 == 0 else 0) - (1 if ly == 3 else 0)
        j1 = x0 + L - (1 if (ly + r) % 2 else 0) + (1 if ly == 1 else 0)
        if j0 <= lx < j1:
            c = OUTL if ly in (0, 4) else (GW[2] if ly == 2 else mix(OUTL, GW[1], .55))
            return c
        if lx in (j0 - 1, j1): return GW[5] if lx == j0 - 1 else GW[2]          # 부러진 끝(밝은 생나무 / 그늘)
    if h > .72: c = mix(c, DU[3], .3)                                           # 바랜 회색 널(널 하나 통째)
    if _hash(X, Y, 719) < .05: c = mix(c, DU[4], .35)                           # 먼지 알갱이
    if 0 < ly < 5 and pn(X, Y, 8, 712) > .78 and _hash(X, Y, 713) < .5: c = mix(c, MO[3], .55)
    if .93 < h and lx in (30, 31, 32) and ly in (1, 2, 3) and _hash(lx, ly, 714) < .7: c = GW[1]   # 쪼개진 금
    return c
mk_floor('hm_rotten', rotten_boards)


def faded_checker(X, Y):
    """연회장 바닥: 바랜 흑·회백 대리석 16px 바둑판, 결(사선 실금)·이 빠진 모서리·먼지 낀 줄눈."""
    lx = X % 16; ly = Y % 16; cx = X // 16; cy = Y // 16
    if lx == 15 or ly == 15: return GS[1]
    dark = (cx + cy) % 2 == 1
    base = mix(GS[2], GS[3], .4) if dark else mix(GS[3], GS[4], .75)
    h = _hash(cx % 3, cy % 3, 721)
    base = mix(base, DU[2] if dark else DU[3], .16 + .14 * h)
    c = base
    if lx == 0 or ly == 0: c = mix(base, GS[5] if dark else GS[6], .4)
    elif lx == 14 or ly == 14: c = mix(base, GS[2] if dark else GS[3], .45)
    # 대리석 결: 칸마다 다른 기울기의 가는 줄
    ph = _hash(cx % 3, cy % 3, 722) * 16; sl = 1 if _hash(cx % 3, cy % 3, 723) < .5 else -1
    if (lx * sl + ly + int(ph) + int(3 * math.sin((ly + ph) * .7))) % 16 == 0 and 0 < lx < 14 and 0 < ly < 14:
        c = mix(base, GS[1] if not dark else GS[4], .45)
    r = _hash(X, Y, 724)
    if r < .035: c = mix(c, GS[1], .4)
    elif r > .975: c = mix(c, GS[6], .3)
    if (lx, ly) in ((13, 13), (14, 13), (13, 14)) and _hash(cx % 3, cy % 3, 725) < .35: c = GS[1]   # 이 빠진 모서리
    return c
mk_floor('hm_checker', faded_checker)


def cellar_flag(X, Y):
    """지하실 판석: 크기가 다른 젖은 청회 판석(줄마다 높이 16/8 번갈아, 길이 16~24), 줄눈에 낀 이끼, 물기 어린 어두운 결."""
    band = (Y // 24) % 2; yy = Y % 24
    if yy < 16: row = (Y // 24) * 2; ly = yy; bh = 16
    else: row = (Y // 24) * 2 + 1; ly = yy - 16; bh = 8
    off = int(_hash(row % 4, 0, 735) * 6) * 8
    xx = (X + off) % 48
    opts = ((0, 16, 40), (0, 24), (0, 20, 36)) if bh == 16 else ((0, 12, 28), (0, 16, 32), (0, 24))
    cuts = opts[int(_hash(row % 4, 1, 736) * 3)]
    col = max(i for i, c in enumerate(cuts) if c <= xx); lx = xx - cuts[col]
    L = (cuts[col + 1] if col + 1 < len(cuts) else 48) - cuts[col]
    if ly == bh - 1 or lx == L - 1:
        return MO[2] if pn(X, Y, 4, 732) > .5 else GS[1]
    h = _hash(col, row % 4, 731)
    base = mix(GS[3], GS[4], .55) if h < .45 else (mix(GS[3], GS[4], .3) if h < .8 else mix(GS[3], MO[4], .3))
    c = base
    if ly == 0 or lx == 0: c = mix(base, GS[5], .45)
    elif ly == bh - 2 or lx == L - 2: c = mix(base, GS[2], .5)
    r = _hash(X, Y, 734)
    if r < .05: c = mix(c, GS[2], .5)
    elif r > .975: c = mix(c, GS[5], .45)
    w = pn(X, Y, 12, 733)
    if w > .72: c = mix(c, GS[2], .3)
    return c
mk_floor('hm_cellar', cellar_flag)


def foyer_flag(X, Y):
    """현관 홀: 큰 마름모꼴이 아닌 정사각 청회 판석(24x16 어긋남) + 판 사이 검은 줄눈, 가운데로 닳아 밝은 결."""
    row = Y // 16; ly = Y % 16; off = (row % 2) * 12
    xx = (X + off) % 48; col = xx // 24; lx = xx % 24
    if ly == 15 or lx == 23: return GS[1]
    h = _hash(col, row % 3, 741)
    base = mix(GS[3], GS[4], .7) if h < .5 else (mix(GS[3], GS[4], .45) if h < .8 else mix(GS[4], DU[3], .3))
    c = base
    if ly == 0 or lx == 0: c = mix(base, GS[5], .5)
    elif ly == 14 or lx == 22: c = mix(base, GS[2], .5)
    r = _hash(X, Y, 742)
    if r < .045: c = mix(c, GS[2], .5)
    elif r > .975: c = mix(c, GS[5], .5)
    if pn(X, Y, 6, 743) > .8: c = mix(c, DU[2], .3)
    return c
mk_floor('hm_foyer', foyer_flag)


# ------------------------------------------------------------------ 벽 앞면
#  'manor'  : 위 = 바랜 회청록 다마스크 벽지(세로 줄 + 작은 백합 무늬, 벗겨진 자리에 회벽, 물 자국 줄), 가운데 의자 높이 나무 띠,
#             아래 = 검은 참나무 판벽(네모 판 + 테), 맨 아래 걸레받이. 높이 H(32/48)에 비례.
#  'mcellar': 청회 거친 마름돌(줄눈 한 겹), 아래로 젖은 이끼.
dlib.FACE_BASE['manor'] = PP[3]
dlib.FACE_BASE['mcellar'] = GS[3]
_prev_face = dlib.face_px


def _paper(X, Y, seed):
    """벽지 한 점: 12px 세로 줄(짙은·옅은 번갈아) + 줄 가운데 마름모 백합 무늬(12x12 주기)."""
    sx = X % 12; sy = Y % 12
    c = PP[3] if (X // 12) % 2 == 0 else mix(PP[3], PP[2], .5)
    if sx == 0: c = PP[2]
    # 다마스크: 가운데(6,6)를 둘러싼 마름모 테 + 위 꽃잎 점
    dx = abs(sx - 6); dy = abs(sy - 6)
    if dx + dy == 4: c = PP[4]
    elif dx + dy == 0 or (dx == 0 and dy == 2): c = PP[5]
    elif (dx, sy) in ((1, 1), (2, 2)): c = PP[4]
    return c


def _face_px(style, X, Y, H, seed, capL, capR):
    if style not in ('manor', 'mcellar'): return _prev_face(style, X, Y, H, seed, capL, capR)
    if style == 'manor':
        dado = int(H * .62)                      # 판벽 시작(위에서)
        if Y < dado - 2:
            c = _paper(X, Y, seed)
            # 벗겨진 벽지: 덩이진 자리에 회벽, 가장자리 한 줄 말린 종이(밝음)
            pe = vnoise(X, Y, 7, seed + 81) * .7 + vnoise(X, Y, 2.5, seed + 82) * .3
            if pe > .74: c = mix(PL[2], GS[3], .75)
            elif pe > .71: c = PP[5]
            # 물 자국: 위에서 흘러내린 세로 얼룩
            if _hash(X // 3, 0, seed + 83) < .12 and _hash(X // 3, Y // 6, seed + 84) < .75 - Y / float(H): c = mix(c, PP[1], .45)
            if vnoise(X, Y, 5, seed + 85) > .8: c = mix(c, MO[3], .35)
        elif Y < dado:                           # 의자 높이 나무 띠(위 밝은 모)
            c = GW[5] if Y == dado - 2 else GW[3]
        else:
            ly = Y - dado; ph = H - dado - 4
            px_ = X % 24
            c = GW[3]
            if 0 < ly < ph and 2 < px_ < 22:     # 판 안쪽(움푹, 테 그늘 + 밝은 아래 모)
                c = GW[2] if (ly == 1 or px_ == 3) else (GW[4] if (ly == ph - 1 or px_ == 21) else mix(GW[2], GW[3], .5))
                if pn(X * 1.0, Y * 3.0, 6, seed + 86) > .74: c = mix(c, GW[1], .4)
            elif px_ in (0, 1, 23): c = GW[2] if px_ != 1 else GW[4]
            if ly >= ph: c = GW[2] if ly == ph else GW[1]   # 걸레받이
        if Y == 0: c = GW[4]                     # 천장 돌림띠
        elif Y == 1: c = GW[2]
        elif Y == 2: c = mul(c, .68)
        elif Y == 3: c = mul(c, .82)
        if Y == H - 1: c = OUTL
        elif Y == H - 2: c = mul(c, .55)
        if capL and X % 16 == 0: c = mix(c, PP[6], .3)
        if capR and X % 16 == 15: c = mul(c, .55)
        if capR and X % 16 == 14: c = mul(c, .8)
        return c
    # 지하실 석벽
    c = dlib.ash(X, Y, seed, mix(GS[2], GS[3], .35), GS[1], bw=16, bh=8, k=1.0)
    c = mix(c, GS[3], .25) if vnoise(X, Y, 4, seed + 91) > .7 else c
    wet = max(0.0, (Y - (H - 22)) / 22.0)
    if wet > .2 and vnoise(X * 1.3, Y * 2, 3, seed + 92) > .8 - .12 * wet: c = mix(c, MO[3], .55)
    if _hash(X // 2, 0, seed + 93) < .1 and Y > 6 and _hash(X // 2, Y, seed + 94) < .5 * (1 - Y / float(H)): c = mix(c, GS[1], .45)
    if Y == 0: c = GS[5]
    elif Y == 1: c = mix(c, GS[5], .3)
    elif Y == 2: c = mul(c, .7)
    elif Y == 3: c = mul(c, .84)
    if Y == H - 1: c = OUTL
    elif Y == H - 2: c = mul(c, .5)
    elif Y == H - 3: c = mul(c, .78)
    if capL and X % 16 == 0: c = mix(c, GS[5], .3)
    if capR and X % 16 == 15: c = mul(c, .55)
    return c
dlib.face_px = _face_px


def face_sample(style, w, h):
    return compose_(w, h, lambda i, j: dlib.face_tile(style, None, j, int(_hash(i + 3, j, 3) * 6), i == 0, i == w - 1, h * T))


# ------------------------------------------------------------------ 천장(벽 너머): 청회 돌 윗면 띠 + 어두운 속
_hc_cache = {}
VOIDG = [(10, 10, 16), (14, 14, 22), (20, 20, 30)]


def ceiling(open8, seed=0, style='manor'):
    """dlib.ceiling 과 같은 규칙(열린 쪽 BAND px 가 벽 윗면 띠, 안쪽은 어두운 속). 띠는 저택 = 검은 참나무 들보 위 청회 회반죽, 지하 = 청회 돌."""
    key = (open8, seed % 4, style)
    if key in _hc_cache: return _hc_cache[key]
    N, E, S, W, NE, SE, SW, NW = open8
    t = dlib.BAND
    def depth(x, y):
        best = None
        def up(d, side):
            nonlocal best
            if best is None or d < best[0]: best = (d, side)
        if N and y < t: up(y, 'N')
        if S and y >= 16 - t: up(15 - y, 'S')
        if W and x < t: up(x, 'W')
        if E and x >= 16 - t: up(15 - x, 'E')
        if not N and not W and NW and x < t and y < t: up(max(x, y), 'N')
        if not N and not E and NE and x >= 16 - t and y < t: up(max(15 - x, y), 'N')
        if not S and not W and SW and x < t and y >= 16 - t: up(max(x, 15 - y), 'S')
        if not S and not E and SE and x >= 16 - t and y >= 16 - t: up(max(15 - x, 15 - y), 'S')
        return best
    def f(x, y):
        X = x + (seed % 4) * 16; Y = y + (seed % 4) * 8
        b = depth(x, y)
        if b is None:
            r = _hash(X, Y, 141)
            return VOIDG[0] if r < .55 else (VOIDG[1] if r < .93 else VOIDG[2])
        d, side = b
        if style == 'manor':
            # 벽 윗면: 검은 참나무 들보 띠(결) — 바깥 2px 는 들보 모, 안쪽은 회반죽 채움
            c = GW[3] if (X + Y * 3) % 7 else GW[2]
            if _hash(X, Y, 142) < .08: c = GW[4]
        else:
            row = Y // 8; off = (row % 2) * 8; col = (X + off) // 16
            c = GS[4] if _hash(col, row, 135) < .6 else mix(GS[4], GS[3], .4)
            if (X + off) % 16 == 0 or Y % 8 == 7: c = mix(c, GS[3], .45)
            if _hash(X, Y, 136) < .05: c = GS[5]
        if d == 0: c = (GW[5] if style == 'manor' else GS[6]) if side in ('N', 'W') else mix(c, GW[4] if style == 'manor' else GS[5], .45)
        elif d == 1: c = mix(c, GW[5] if style == 'manor' else GS[5], .2)
        if d == t - 1: c = OUTL
        elif d == t - 2: c = mix(c, OUTL, .35)
        return c
    im = mk(f); _hc_cache[key] = im; return im


def ceiling_sample(style='manor'):
    def cf(i, j):
        o8 = (j > 0, i < 2, j < 2, i > 0, j > 0 and i < 2, j < 2 and i < 2, j < 2 and i > 0, j > 0 and i > 0)
        return ceiling((False,) * 8 if (i == 1 and j == 1) else o8, i + j, style)
    return compose_(3, 3, cf)


# ------------------------------------------------------------------ 작은 도우미
def dust_top(cv, x0, y0, x1, y1, seed=0, a=.35):
    """가구 윗면에 앉은 먼지: 칠해진 화소를 먼지색 쪽으로 성기게 섞는다(바둑판 디더 금지, 군집 잡음)."""
    for y in range(y0, y1):
        for x in range(x0, x1):
            px_ = cv.p[x, y] if 0 <= x < cv.w and 0 <= y < cv.h else None
            if not px_ or px_[3] == 0: continue
            v = vnoise(x, y, 3, seed + 51) * .7 + _hash(x, y, seed + 52) * .3
            if v > .5: cv.px(x, y, mix(px_[:3], DU[4], a))


def web_corner(cv, x0, y0, r, flip=False, seed=0):
    """구석 거미줄: 모서리에서 뻗는 살 4~5줄 + 동심 실 3겹(성기게, 1px)."""
    import math as _m
    for i in range(5):
        a = (i / 4.0) * (_m.pi / 2)
        for t in range(1, r + 1):
            x = x0 + int(round(_m.cos(a) * t)) * (-1 if flip else 1); y = y0 + int(round(_m.sin(a) * t))
            if _hash(i, t, seed + 61) < .9: cv.px(x, y, WEB[1] if t < r - 1 else WEB[0])
    for rr in (r * .35, r * .62, r * .9):
        for i in range(int(rr * 2)):
            a = (i / max(1.0, rr * 2 - 1)) * (_m.pi / 2)
            x = x0 + int(round(_m.cos(a) * rr)) * (-1 if flip else 1); y = y0 + int(round(_m.sin(a) * rr + _m.sin(a * 2) * .6))
            if _hash(i, int(rr), seed + 62) < .7: cv.px(x, y, WEB[2] if rr < r * .5 else WEB[1])


def flame(cv, x, y, big=False):
    """작은 촛불 불꽃(호박색)."""
    cv.px(x, y, AM[5]); cv.px(x, y - 1, AM[6] if big else AM[5]); cv.px(x, y + 1, AM[4])
    if big: cv.px(x, y - 2, AM[4]); cv.px(x - 1, y, AM[3]); cv.px(x + 1, y, AM[3])


def candle(cv, x, ytop, h, lit=True, ramp=None):
    """굵기 2px 초(위가 녹아 내린 촛농)."""
    R = ramp or LN
    for y in range(ytop, ytop + h):
        cv.px(x, y, R[5] if y > ytop else R[6]); cv.px(x + 1, y, R[3])
    cv.px(x + 1, ytop + 1, R[5]); cv.px(x, ytop + 2, R[6])
    if lit: cv.px(x, ytop - 1, OUTL); flame(cv, x, ytop - 2)
    else: cv.px(x, ytop - 1, GS[1])
