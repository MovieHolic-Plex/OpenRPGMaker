#!/usr/bin/env python3
# noqa: SIZE_OK - jp-inaka walls / fences / water crossings (3/4 top-down)
# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "pillow"]
# ///
"""jp-inaka 담·울타리·물 건너기 키트: 수문·죽담(建仁寺垣)·이끼 돌담 2종·붉은 철교·징검다리. (R5 에서 inaka_art_props.py 에서 떼어 냄)

R5 깊이(버들항 기준): 돌은 한 개씩 5단(윗모서리 빛·밝은 면·면·아래 그늘·줄눈), 돌마다 램프(따뜻한 회색·차가운 회색·밝은 판석)와 톤이 다르다.
윤곽은 근흑 대신 이웃 재질의 어두운 톤(tint_outlines), 발치는 체커 디더 그늘(ground_shadow).
"""
from __future__ import annotations

from inaka_art_houses import (  # noqa: E402,F401
    OL, Cv, H, J, K, add_outline, disc, kit, line, post, rect_3d, rows, stones,
)
from inaka_art_props import _blit  # noqa: E402
from inaka_style import ground_shadow, tint_outlines  # noqa: E402,F401


def _ramp(mat):
    return [J(mat, i) for i in range(5)]


FLAG = _ramp('shrine_flagstone')      # 따뜻한 회색 돌
GRAV = _ramp('gravel')                # 차가운 보랏빛 회색 돌
PAVE = _ramp('paving_stone')          # 밝은 판석
WETC = _ramp('wet_cobble')            # 젖은 돌·깊은 줄눈
MOSS = _ramp('moss')
BAMB = _ramp('pine_bamboo')
CEDAR = _ramp('aged_cedar')
TIMB = _ramp('machiya_timber')
STRAW = _ramp('tatami_straw')
TILE = _ramp('kawara_dark_tile')
CONC = _ramp('concrete_grey')
CANAL = _ramp('canal_indigo')
RUST = _ramp('noren_rust')
VERM = _ramp('torii_vermilion')
AKA = [K('aka', t) for t in (-2, -1, 0, 1, 2)]
TEK = [K('tekko', t) for t in (-3, -2, -1, 0, 1, 2, 3)]
WHITE = [K('shiro', t) for t in (-2, -1, 0, 1, 2)]
MORTAR = WETC[1]


def _rc(ramp, k):
    return ramp[max(0, min(len(ramp) - 1, k))]


def _stone_px(c, x, y, dl, dr, j, ch, ramp, t, sd):
    """돌 한 화소: dl=왼끝에서 거리, dr=오른끝(0=줄눈 열)까지 거리, j=줄 안 행(ch-1=줄눈 행).
    5단: 윗모서리 빛(4) · 왼/윗 밝은 면(3) · 면(2, 얼룩) · 아래·오른 그늘(1) · 모서리 깊은 그늘(0) + 줄눈(젖은 돌 짙은 색)."""
    if dr == 0 or j == ch - 1:
        col = MORTAR
    elif dl == 0 and j == 0:
        col = _rc(ramp, 2 + t)                     # 둥근 모서리
    elif dr == 1 and j == ch - 2:
        col = _rc(ramp, 0 + t)
    elif (dr == 1 and j == 0) or (dl == 0 and j == ch - 2):
        col = _rc(ramp, 1 + t) if j else MORTAR                   # 깨진 모서리
    elif j == 0:
        col = _rc(ramp, 4 + t) if dr > 2 else _rc(ramp, 3 + t)
    elif dl == 0:
        col = _rc(ramp, 3 + t)
    elif j == ch - 2 or dr == 1:
        col = _rc(ramp, 1 + t)
    elif j == 1 and dl < 4:
        col = _rc(ramp, 3 + t)
    elif j >= ch - 3 and dr <= 3:
        col = _rc(ramp, 1 + t)
    else:
        h = H(x, y, sd)
        col = _rc(ramp, 1 + t) if h < 0.13 else _rc(ramp, 3 + t) if h > 0.93 else _rc(ramp, 2 + t)
        if 0.5 < h < 0.54:
            col = _rc(GRAV if ramp is not GRAV else FLAG, 2 + t)      # 다른 결의 돌 알갱이
        elif 0.6 < h < 0.62:
            col = STRAW[1] if t >= 0 else MOSS[2]                       # 지의류 얼룩
    c.P(x, y, col)


def _pick_stone(row, k, seed):
    h = H(row, k, seed + 2)
    ramp = FLAG if h < 0.62 else GRAV if h < 0.78 else PAVE
    ht = H(row, k, seed + 3)
    t = 0 if ht < 0.55 else -1 if ht < 0.85 else 1
    if ramp is PAVE:
        t -= 1
    return ramp, t


def _course(c, y, ch, row, seed, W=64, tone=0):
    """W 폭 한 줄 돌 쌓기. 첫 줄눈 f 와 그 줄의 「감싸는 돌」(오른끝→다음 토막 왼끝)은 seed 와 무관하다:
    서로 다른 토막을 가로로 이어도 이음매에서 같은 돌 하나가 둘로 갈려 이어진다."""
    f = 3 + int(H(row, 9, 4242) * 5)
    minwrap = max(8, f + 4)
    x, k = f, 0
    while True:
        rem = W + f - x
        if rem <= minwrap + 5:
            break
        w = min(6 + int(H(row, k, seed + 1) * 9), rem - minwrap)
        ramp, t = _pick_stone(row, k, seed)
        for j in range(ch):
            for i in range(w):
                _stone_px(c, x + i, y + j, i, w - 1 - i, j, ch, ramp, t + tone, seed + 5)
        x += w
        k += 1
    ramp, t = _pick_stone(row, 0, 999)                # 감싸는 돌: 줄에만 묶인 램프·톤
    end = W + f
    for xx in range(x, end):
        px = xx if xx < W else xx - W
        for j in range(ch):
            _stone_px(c, px, y + j, xx - x, end - 1 - xx, j, ch, ramp, t + tone, 77)


# ═══════════════════════════ 수문 ═══════════════════════════
@kit('inaka-sluice-gate', '농수로 수문(水門) - 양 둑 콘크리트 기둥·3/4 윗면 다리판 보도·핸들 축·내려온 철 수문판·아래 흰 물거품(2×2)', 2, 2, 'structure',
     solid=[(0, 0), (1, 0), (0, 1), (1, 1)], tags=['inaka', '수문', '水門', '농수로'],
     rules='폭 2칸 남북 농수로(수로) 위에 가로질러 놓는다. 양 기둥이 양쪽 호안에 선다.', role='water')
def sluice(c, base):
    # 물: 수문 밑 거품 단계(흰 거품 → 옅은 거품 → 물살 → 흐르는 물)
    for y in range(22, 32):
        for x in range(6, 26):
            h = H(x, y, 41)
            d = y - 22
            if d == 0:
                col = WHITE[4] if h < 0.55 else WHITE[3]
            elif d == 1:
                col = WHITE[3] if h < 0.45 else WHITE[2] if h < 0.8 else CANAL[4]
            elif d == 2:
                col = WHITE[2] if h < 0.3 else CANAL[4] if h < 0.65 else WHITE[1]
            elif d == 3:
                col = CANAL[4] if h < 0.35 else CANAL[3] if h < 0.8 else WHITE[2]
            elif d <= 5:
                col = CANAL[3] if (x + d) % 3 else CANAL[4] if h < 0.5 else CANAL[2]
            else:
                col = CANAL[2] if d % 2 else CANAL[1] if h < 0.35 else CANAL[2]
                if (x + 2 * d + int(H(d, 0, 40) * 7)) % 9 < 2:
                    col = CANAL[3]                                       # 흐름 결(가로 물살)
                if (x + 2 * d + int(H(d, 0, 40) * 7)) % 9 == 0 and d % 2 == 0:
                    col = CANAL[4]
            c.P(x, y, col)
    for y in range(23, 32):                                              # 기둥 옆 물 그늘(빛 왼쪽 → 오른 기둥 밑이 짙다)
        c.P(24, y, CANAL[1]); c.P(23, y, CANAL[1] if y > 26 else c_get(c, 23, y))
        c.P(6, y, CANAL[2] if y > 26 else c_get(c, 6, y))
    # 철 수문판: 위 밝고 물 가까이 젖어 짙다, 보강대 2줄 + 리벳 + 녹 줄
    for y in range(12, 22):
        for x in range(6, 26):
            g = 0 if y < 15 else -1 if y < 19 else -2
            h = H(x, y, 43)
            col = TEK[3 + g] if h > 0.1 else TEK[2 + g]
            if x == 7:
                col = TEK[4 + g]
            elif x == 24:
                col = TEK[1 + g]
            c.P(x, y, col)
    for y in (14, 18):                                                   # 보강대: 빛 윗면 + 그늘 + 리벳
        c.HL(6, y, 20, TEK[5]); c.HL(6, y + 1, 20, TEK[1])
        for x in range(9, 24, 4):
            c.P(x, y, TEK[6]); c.P(x + 1, y + 1, TEK[1])
    for x in (13, 21):                                                   # 녹 줄: 리벳 밑으로 흘러내림
        c.P(x, 16, RUST[2]); c.P(x, 17, RUST[1])
    c.P(10, 20, RUST[1]); c.P(18, 20, RUST[2])
    c.HL(6, 21, 20, WETC[2]); c.HL(6, 20, 20, TEK[1])
    for x in range(6, 26, 2):
        c.P(x, 20, MOSS[1])                                              # 물때
    # 양 둑 콘크리트 기둥: 윗면 3px(빛·면·모서리) + 정면 얼룩·물때·이끼 띠 + 안쪽 홈
    for x0, x1 in ((0, 7), (25, 32)):
        for y in range(4, 32):
            for x in range(x0, x1):
                h = H(x, y, 45 + x0)
                if y == 4:
                    col = CONC[1]
                elif y == 5:
                    col = CONC[4] if x < x1 - 1 else CONC[3]
                elif y <= 7:
                    col = CONC[3] if h > 0.15 else CONC[4]
                elif y == 8:
                    col = CONC[2]
                else:
                    col = CONC[2] if h > 0.07 else CONC[1] if h < 0.04 else CONC[3]
                    if x == x0:
                        col = CONC[3]
                    elif x == x1 - 1:
                        col = CONC[1]
                    if x in (x0 + 2, x0 + 4) and y > 10 and H(x, y // 4, 46 + x0) < 0.5:
                        col = CONC[1]                                    # 비 얼룩 세로 줄
                    if y >= 24:
                        col = MOSS[1] if h < 0.35 else WETC[2] if h < 0.7 else CONC[1]
                    if y >= 29:
                        col = WETC[2] if h < 0.6 else MOSS[0]
                c.P(x, y, col)
    for gx in (6, 25):                                                   # 수문판이 들어가는 홈
        c.VL(gx, 9, 23, CONC[0])
    c.VL(7, 12, 10, TEK[1]); c.VL(24, 12, 10, TEK[1])
    # 다리판 보도: 뒤 난간 + 윗면 판(빛 결) + 앞 갓
    c.HL(0, 1, 32, CONC[0]); c.HL(0, 2, 32, TEK[4]); c.HL(0, 3, 32, TEK[2])
    for x in (1, 30):
        c.VL(x, 1, 4, TEK[3])
    for y in range(5, 12):
        for x in range(0, 32):
            h = H(x, y, 47)
            if y == 5:
                col = CONC[0]
            elif y == 6:
                col = CONC[4]
            elif y <= 8:
                col = CONC[3] if h > 0.2 else CONC[4] if h > 0.08 else CONC[2]
                if x % 8 == 7:
                    col = CONC[2]                                        # 판 이음
            elif y == 9:
                col = CONC[4] if x < 31 else CONC[3]                     # 앞 모서리 빛
            elif y == 10:
                col = CONC[2] if h > 0.2 else CONC[1]
            else:
                col = CONC[0]
            c.P(x, y, col)
    # 핸들 축 + 붉은 핸들 바퀴(타원 윗면 · 바퀴살)
    c.R(15, 0, 2, 7, TEK[3]); c.VL(15, 0, 7, TEK[5]); c.VL(16, 3, 4, TEK[2])
    disc(c, 16, 2, 4.6, AKA[0], ry=2.0)
    disc(c, 16, 2, 3.8, AKA[2], ry=1.4)
    disc(c, 16, 2, 2.4, AKA[1], ry=0.8)
    c.P(13, 1, AKA[4]); c.P(14, 1, AKA[3]); c.P(12, 2, AKA[3]); c.P(19, 3, AKA[1]); c.P(20, 2, AKA[1])
    c.P(16, 2, TEK[6]); c.P(16, 1, TEK[4])
    c.HL(14, 7, 4, CONC[1])                                              # 축 그늘
    tint_outlines(c)


def c_get(c, x, y):
    a = c.a[y, x]
    return (int(a[0]) << 16) | (int(a[1]) << 8) | int(a[2])


# ═══════════════════════════ 죽담 ═══════════════════════════
# 대나무 줄기 문법: PR #3026(jp_regions_pack.bamboo_culm, 보류 중)과 같은 규칙을 이나카 팩 안에 둔다.
#   줄기 2~3px(왼쪽 빛·몸·오른쪽 그늘), 줄기마다 윤곽선 없음, 마디 7~9px 간격으로 줄기마다 어긋남(마디 줄 + 바로 위 밝은 턱).
#   R5: 앞 줄기 5단(이끼빛 하이라이트·밝음·몸·그늘·밑동 깊은 그늘), 마른 대(황록 짚색) 섞음, 밑동으로 갈수록 한 단 어둡다.
_CULM = {
    2: (MOSS[4], BAMB[4], BAMB[3], BAMB[2], BAMB[1]),        # 앞(밝음)
    1: (BAMB[4], BAMB[3], BAMB[2], BAMB[1], BAMB[0]),        # 가운데
    0: (BAMB[3], BAMB[2], BAMB[1], BAMB[0], BAMB[0]),        # 뒤(그늘)
    3: (STRAW[3], MOSS[4], MOSS[3], MOSS[2], MOSS[1]),       # 마른 대(황록)
}


def bamboo_culm(c, x, top, bot, w=3, depth=2, seed=0, lean=0):
    """대나무 줄기 하나: x = 밑동 왼쪽 열, top~bot(포함), 폭 w(2|3), depth 0 뒤(그늘) · 1 가운데 · 2 앞(밝음) · 3 마른 대."""
    hi, lt, body, sh, deep = _CULM[depth]
    node = deep if depth != 3 else MOSS[1]
    ridge = hi
    span = max(1, bot - top)
    gap = 7 + int(H(x, depth, seed) * 3)
    first = bot - 3 - int(H(x, top, seed + 1) * gap)
    for y in range(top, bot + 1):
        ox = x + round(lean * ((bot - y) / span) ** 2)
        ww = w if y > top + 6 else max(2, w - 1)
        seg = (first - y) % gap if y < first else gap
        low = (y - top) / span > 0.72                              # 밑동: 한 단 어둡게
        c0 = (lt if low else hi) if (seg > 2 or H(x, y, seed + 3) < 0.7) else lt
        c1 = (sh if low else body) if seg not in (1, 2) else sh
        c2 = (deep if low else sh) if seg != 1 else deep
        c.P(ox, y, c0)
        if ww == 3:
            c.P(ox + 1, y, c1)
        c.P(ox + ww - 1, y, c2)
        if y < first and y > top + 2 and seg == 0:
            c.HL(ox, y, ww, node)
        elif y < first - 1 and y > top + 2 and seg == gap - 1:
            c.HL(ox, y, ww - 1, ridge)
        elif ww == 3 and not low and H(ox, y, seed + 9) < 0.06:
            c.P(ox + 1, y, lt)                                     # 반짝임


def _takegaki_panel(c, x0, x1, top, bot, seed, cap=7):
    """建仁寺垣 판(3/4 탑뷰). 위에서 내려다본 笠木(갓) 윗면: 먼 끝선 1줄 → 나란히 묶은 쪼갠 대 윗면 cap-3 줄(먼 쪽 밝고
    앞으로 한 단씩 어두움, 길이 방향 결·엇갈린 마디·묶음 끈) → 앞 모서리 빛 1줄 → 갓 앞면(둥근 대) 1줄 → 판에 진 그늘 1줄.
    그 아래 쪼갠 대 정면 + 누름대(押縁)·종려 끈."""
    ft = top + cap                                                 # 정면(대 판) 시작
    k = 0
    c.R(x0, ft, x1 - x0, bot - ft + 1, BAMB[1])                    # 판 뒤 그늘
    for x in range(x0, x1, 3):
        h = H(x, 2, seed)
        depth = 3 if H(x, 4, seed) < 0.10 else ((1, 0, 1, 2, 0)[k % 5] if h > 0.25 else 0)
        bamboo_culm(c, x, ft, bot, w=min(3, x1 - x), depth=depth, seed=seed + k)
        k += 1
    TOPR = [STRAW[1], STRAW[2], STRAW[3], STRAW[4]]                # 마른 대 윗면(어둠 → 밝음)
    n = cap - 4                                                    # 윗면 줄 수
    for x in range(x0, x1):
        for j in range(cap):
            y = top + j
            g = H(x, y, seed + 14)
            if j == 0:
                col = STRAW[1] if g < 0.7 else CEDAR[1]            # 먼 끝선(뒤 모서리)
            elif j <= n:                                           # 윗면: 먼 쪽 밝음 → 앞 한 단 어둠
                lv = 3 - (j - 1) * 1.0 / max(1, n - 1) * 1.6
                if (y + (x // 7)) % 2 == 0 and g < 0.35:
                    lv -= 1                                        # 쪼갠 대 사이 결(길이 방향)
                col = TOPR[max(0, min(3, round(lv)))]
                if (x + int(H(x // 11, j, seed) * 5)) % 11 == 0:
                    col = STRAW[1]                                 # 마디(가닥마다 어긋남)
            elif j == n + 1:
                col = STRAW[4] if g < 0.8 else STRAW[3]            # 앞 모서리 빛
            elif j == n + 2:
                col = BAMB[2] if g < 0.7 else BAMB[3]              # 갓 앞면(둥근 대)
            else:
                col = BAMB[0]                                      # 판에 진 그늘
            c.P(x, y, col)
    for x in range(x0 + 4, x1 - 2, 10):                            # 갓을 묶은 종려 끈: 앞 모서리를 감아 앞면으로 내려온 매듭만
        c.P(x, top + n + 1, CEDAR[1]); c.P(x, top + n + 2, K('sumi', 1)); c.P(x + 1, top + n + 2, MOSS[0])
    y = ft + (bot - ft) // 2 - 1                                   # 누름대(쪼갠 대) 한 줄: 밝은 등 + 판에 진 그늘
    for x in range(x0, x1):
        h = H(x, y, seed + 12)
        c.P(x, y - 1, BAMB[4] if h < 0.5 else MOSS[4])
        c.P(x, y, BAMB[3] if h < 0.3 else BAMB[2])
        if H(x, y + 1, seed + 13) < 0.8:
            c.P(x, y + 1, BAMB[0])
    for x in range(x0 + 2 + (y % 3), x1 - 1, 6):
        c.P(x, y, K('sumi', 1)); c.P(x, y + 1, K('sumi', 0)); c.P(x + 1, y + 1, MOSS[0])   # 종려 끈 매듭


def _cedar_post(c, x, y, h, w=3):
    """삼나무 기둥: 왼 빛 · 몸(세로 결) · 오른 그늘, 밑동 젖어 짙다."""
    for j in range(h):
        low = j > h - 4
        for i in range(w):
            hh = H(x + i, (y + j) // 2, 61)
            if i == 0:
                col = CEDAR[3] if low else CEDAR[4]
            elif i == w - 1:
                col = CEDAR[0] if low else CEDAR[1]
            else:
                col = CEDAR[2] if hh > 0.25 else CEDAR[1] if hh < 0.12 else CEDAR[3]
                if low:
                    col = CEDAR[1]
            c.P(x + i, y + j, col)


def _mini_kawara_roof(c, x0, x1, y0, rows_n=8):
    """문 위 작은 기와 지붕(3/4 탑뷰, 우진각): 짧은 용마루 + 위에서 내려다본 경사 윗면 rows_n 줄(아래로 갈수록 넓어짐) —
    둥근 기와 골이 세로로 흐르고(등 빛·몸·골 그늘) 2줄마다 장 겹침 비늘, 아래로 갈수록 한 단 어두움 + 막새 끝 + 처마 그늘.
    처마 끝 다음 줄(그늘) y 를 돌려준다."""
    ins = [max(0, 4 - j // 2) for j in range(rows_n)]
    rx0, rx1 = x0 + 5, x1 - 5                                   # 용마루(위에서 본 윗면 2줄 + 앞면 + 그늘)
    c.HL(rx0, y0, rx1 - rx0, TILE[3]); c.HL(rx0, y0 + 1, rx1 - rx0, TILE[4])
    c.HL(rx0, y0 + 2, rx1 - rx0, TILE[2]); c.HL(rx0, y0 + 3, rx1 - rx0, TILE[0])
    for yy in range(y0, y0 + 4):
        c.P(rx0 - 1, yy, TILE[2] if yy < y0 + 3 else TILE[0]); c.P(rx1, yy, TILE[1] if yy < y0 + 3 else TILE[0])
    c.P(rx0, y0 + 2, TILE[4]); c.P(rx1 - 1, y0 + 1, TILE[3])   # 귀면 기와 끝 빛
    y0 += 2
    for j in range(rows_n):
        y = y0 + 2 + j
        a, b = x0 + ins[j], x1 - ins[j]
        for x in range(a, b):
            ph = (x - x0) % 4
            far = j < rows_n // 2
            col = (TILE[4] if far else TILE[3]) if ph == 0 else TILE[3] if ph == 1 and far else TILE[2] if ph in (1, 2) else TILE[1]
            if j % 2 == 1 and ph in (2, 3):
                col = TILE[1] if ph == 2 else TILE[0]               # 장 겹침 비늘 그늘
            if x == a:
                col = TILE[4] if j < rows_n - 1 else TILE[3]         # 왼 내림마루(빛)
            elif x == b - 1:
                col = TILE[1]                                      # 오른 내림마루(그늘)
            c.P(x, y, col)
    ye = y0 + 2 + rows_n
    for x in range(x0 - 1, x1 + 1):                               # 막새 끝(장마다 밝은 동그라미)
        ph = (x - x0) % 4
        c.P(x, ye, TILE[4] if ph == 0 else TILE[2] if ph == 1 else TILE[1])
    c.HL(x0 - 1, ye + 1, x1 - x0 + 2, TILE[0])
    return ye + 1


@kit('inaka-bamboo-fence-gate', '대나무 울타리와 문(建仁寺垣) - 위에서 본 넓은 갓 윗면·짧은 쪼갠 대 판·누름대·종려 끈·작은 기와 문(4×2)', 4, 2, 'structure',
     solid=[(0, 1), (1, 1), (3, 1)], tags=['inaka', '대나무울타리', '竹垣', '문'],
     rules='농가 마당 경계. 세 번째 칸이 드나드는 문.', role='fence')
def bamboo_fence(c, base):
    t = Cv(c.w, c.h)
    _takegaki_panel(t, 0, 33, 10, 28, 3, cap=9)
    _takegaki_panel(t, 57, 64, 10, 28, 8, cap=9)
    for x in (33, 54):                                           # 문 기둥(삼나무 결)
        _cedar_post(t, x, 12, 18)
    for x in range(36, 54):                                      # 꿰뚫은 가로대(貫): 윗면 2줄 + 앞면 + 그늘
        h = H(x, 10, 62)
        t.P(x, 15, CEDAR[4] if h < 0.4 else CEDAR[3]); t.P(x, 16, CEDAR[3]); t.P(x, 17, CEDAR[1]); t.P(x, 18, CEDAR[0])
    ye = _mini_kawara_roof(t, 30, 60, 0, rows_n=7)
    for x in (33, 54):
        t.P(x + 1, ye + 1, CEDAR[0]); t.P(x + 1, 19, CEDAR[0])  # 처마·가로대 밑 그늘
    add_outline(t)                                               # 실루엣만 윤곽(대 판 안쪽은 윤곽 없음)
    tint_outlines(t)
    _blit(c, t)
    sh = K('yoru', -2)
    ground_shadow(c, 0, 37, 30, 2, sh, inset=0)                  # 발치 그늘(빛 왼쪽 위 → 오른쪽 아래)
    ground_shadow(c, 53, 64, 30, 2, sh, inset=0)


# ═══════════════════════════ 이끼 돌담 ═══════════════════════════
# R6 시점(3/4 탑뷰): 위에서 내려다본 이끼 덮인 담 윗면이 8줄 띠(먼 쪽 밝음 → 앞 끝 짙은 턱)로 깊이를 갖고,
# 그 아래 정면은 돌 2줄(7·8px)로 짧다. 윗면 띠 > 정면 높이의 절반이라 「앞에서 본 입면」으로 읽히지 않는다.
_TOP0, _LIP = 3, 11            # 윗면 띠: 3..10(8줄), 앞 턱 11
_FACE = 13                     # 정면 돌 줄 시작(12 = 턱 밑 그늘)


def _field(seed):
    """4px 값 잡음 높이장. x=0·64 칸 값은 seed 무관 → 어느 토막과 이어도 끊기지 않는다."""
    def cell(i, j):
        fixed = i <= 0 or i >= 16
        return H(0 if fixed else i, j, 1234 + seed if fixed else seed)

    def hgt(x, y):
        x = max(0, min(64, x))
        i, fx = divmod(x, 4)
        j, fy = divmod(y, 4)
        a0 = cell(i, j) + (cell(i + 1, j) - cell(i, j)) * fx / 4
        a1 = cell(i, j + 1) + (cell(i + 1, j + 1) - cell(i, j + 1)) * fx / 4
        return a0 + (a1 - a0) * fy / 4
    return hgt


def _moss_top(c, seed):
    """담 윗면(위에서 본 면): 이끼 덩이(왼쪽 위 빛으로 깎음) 사이로 갓돌 윗면이 드문드문 비친다.
    먼 쪽(위)이 밝고 앞으로 올수록 한 단 어두워지며, 앞 끝은 짙은 이끼 턱 + 정면에 진 그늘 줄."""
    moss = _field(seed)
    rock = _field(seed + 400)
    for x in range(64):
        for y in range(_TOP0, _LIP):
            ny = (y - _TOP0) / (_LIP - 1 - _TOP0)
            r = rock(x, y)
            if r < 0.30 and 0 < y - _TOP0 < 7:                      # 갓돌 윗면(이끼 사이로 비침)
                if rock(x - 1, y - 1) >= 0.30:
                    col = FLAG[4]
                elif rock(x + 1, y + 1) >= 0.30:
                    col = FLAG[1]
                else:
                    col = FLAG[3] if H(x, y, seed + 31) > 0.2 else GRAV[3]
                c.P(x, y, col)
                continue
            lit = (moss(x - 1, y - 1) - moss(x + 1, y + 1)) * 4.0
            lv = 3.5 + lit - ny * 1.5 + (H(x, y, seed + 21) - 0.5) * 0.6
            col = MOSS[max(1, min(4, round(lv)))]
            if y == _TOP0:
                col = MOSS[2] if H(x, y, seed + 23) < 0.5 else MOSS[1]   # 먼 끝 선
            elif lv > 4.3 and H(x, y, seed + 24) < 0.35:
                col = STRAW[4]                                          # 볕 받은 마른 이끼 끝
            elif y == _TOP0 + 1 and H(x, 3, seed + 23) < 0.25:
                col = BAMB[4]                                           # 새 잎 끝
            c.P(x, y, col)
        h = H(x, _LIP, seed + 22)
        c.P(x, _LIP, MOSS[1] if h < 0.7 else MOSS[0])                  # 앞 턱(짙은 이끼 가장자리)
        c.P(x, _LIP + 1, MOSS[0] if h < 0.45 else WETC[1])            # 턱 밑 정면 그늘
        if 2 < x < 61 and H(x, 8, seed) < 0.22:                        # 정면으로 흘러내린 이끼(짧게)
            n = 1 + int(H(x, 9, seed) * 3)
            for k2 in range(n):
                c.P(x, _FACE + k2, MOSS[2] if k2 < n - 1 else MOSS[1])


def _mossy_wall(c, seed):
    """이끼 돌담 4×2 한 토막. 양옆 끝에 윤곽이 없고, 가장자리에 걸친 돌·이끼 덩이는 seed 와 무관해서
    이 토막과 -mid 를 어떤 순서로 이어도 이음매가 생기지 않는다. 윗면 띠 8줄 + 정면 돌 줄 7·8px."""
    y = _FACE
    for k, ch in enumerate((7, 8)):
        _course(c, y, ch, k, seed + 31 * k)
        y += ch
    for x in range(64):                                          # 줄눈 이끼
        for yy in range(_FACE, y):
            if c_get(c, x, yy) == MORTAR and H(x, yy, seed + 3) < 0.14:
                c.P(x, yy, MOSS[1])
    _moss_top(c, seed)
    for k in range(3):                                           # 윗면 먼 끝 풀포기(토막 안쪽에만)
        x = 8 + k * 17 + int(H(k, 2, seed) * 8)
        c.P(x, 2, BAMB[2]); c.P(x + 1, 2, BAMB[3]); c.P(x + 2, 2, BAMB[2]); c.P(x + 3, 2, MOSS[2])
        c.P(x + 1, 1, BAMB[4]); c.P(x + 2, 1, MOSS[4]); c.P(x + 3, 0, MOSS[4]); c.P(x - 1, 1, BAMB[3]); c.P(x + 1, 0, MOSS[4])
    for x in range(64):                                          # 담 발치: 젖은 돌·이끼 접지선 + 디더 그늘
        c.P(x, y, MOSS[0] if H(x, 30, 7) < 0.3 else FLAG[0])
        if (x + y + 1) % 2 == 0:
            c.P(x, y + 1, K('yoru', -2))


@kit('inaka-mossy-stone-wall', '이끼 낀 돌담 - 이끼 덮인 윗길·돌 쌓기 정면(4×2)', 4, 2, 'wall',
     solid=rows(4, [0, 1]), tags=['inaka', '돌담', '石垣', '이끼'],
     rules='경사 밭·집터 경계를 가로로 이어 쌓는다. 길게 이을 때는 inaka-mossy-stone-wall-mid 와 번갈아 놓는다.', role='wall')
def stone_wall(c, base):
    _mossy_wall(c, 5)
    tint_outlines(c)


@kit('inaka-mossy-stone-wall-mid', '이끼 낀 돌담(이음 토막) - 다른 돌 쌓기·이끼 결(4×2)', 4, 2, 'wall',
     solid=rows(4, [0, 1]), tags=['inaka', '돌담', '石垣', '이끼'],
     rules='inaka-mossy-stone-wall 과 번갈아 가로로 이어 쌓아 4칸마다 같은 돌 무늬가 되풀이되지 않게 한다.', role='wall')
def stone_wall_mid(c, base):
    _mossy_wall(c, 17)
    tint_outlines(c)


# ═══════════════════════════ 붉은 철교 ═══════════════════════════
def _red(k):
    """페인트 붉은 철 단 0(깊은 그늘)…4(빛): 깊은 단은 주홍 쪽(차갑게 어둡게), 빛 단은 따뜻한 주홍."""
    return (AKA[0], VERM[1], AKA[2], AKA[3], VERM[4])[max(0, min(4, k))]


@kit('inaka-red-iron-bridge', '붉은 철교(人道橋) - 먼 난간·판재 다리 바닥 윗면·가까운 난간 갓 윗면·거더(6×3)', 6, 3, 'structure',
     solid=rows(6, [0]), other='floor', tags=['inaka', '철교', '다리', '橋'],
     rules='개울·수로 위에 가로로. 가운데 줄(바닥 판재)을 건넌다.', role='terrain')
def iron_bridge(c, base):
    W = 96
    # 다리 바닥(윗면 판재): 판마다 톤, 세로 결, 판 이음, 못 두 줄, 먼 난간 밑 그늘
    for x0 in range(0, W, 4):
        tn = 2 + (1 if H(x0, 1, 70) > 0.55 else 0) - (1 if H(x0, 2, 70) > 0.85 else 0)
        for y in range(16, 38):
            for i in range(4):
                x = x0 + i
                if i == 3:
                    col = CEDAR[1]
                elif i == 0:
                    col = CEDAR[min(4, tn + 1)]
                else:
                    h = H(x, (y + x0) // 7, 71)
                    col = CEDAR[tn - 1] if (h < 0.18 and i == 2) else CEDAR[tn]  # 긴 세로 결
                if y in (16, 17):
                    col = CEDAR[1] if y == 16 else CEDAR[max(1, tn - 1)]
                if y in (19, 34) and i == 1 and (x0 // 4) % 2 == 0:
                    col = CEDAR[0]                                       # 못(판 하나 걸러)
                if y in (18, 33) and i == 1 and (x0 // 4) % 2 == 0:
                    col = CEDAR[4]
                if y >= 35:
                    col = CEDAR[max(0, tn - 1)] if i < 3 else CEDAR[0]   # 가까운 난간 밑 그늘
                c.P(x, y, col)
    # 먼 난간(북): 갓 윗면 2px + 앞 1px + 세로 살(빛·그늘) + 큰 기둥 + 아래 가로대 + 녹
    for x in range(W):
        h = H(x, 7, 73)
        c.P(x, 6, _red(0))
        c.P(x, 7, _red(4) if h > 0.3 else VERM[3] if h > 0.1 else _red(3))
        c.P(x, 8, _red(3) if h > 0.15 else VERM[2])
        c.P(x, 9, _red(1))
    for x in range(3, W - 2, 6):
        c.VL(x, 10, 6, _red(3)); c.VL(x + 1, 10, 6, _red(1))
        c.P(x, 10, _red(4))
        if H(x, 11, 73) < 0.4:
            c.P(x + 1, 14, RUST[1]); c.P(x + 1, 15, RUST[0])
    for x in range(1, W, 16):                                            # 먼 기둥(굵게) + 머리
        c.R(x, 4, 3, 12, _red(2)); c.VL(x, 4, 12, _red(3)); c.VL(x + 2, 4, 12, _red(1))
        c.P(x + 1, 3, K('kii', 0)); c.P(x, 4, _red(4)); c.P(x + 1, 4, _red(3))
    for x in range(W):
        c.P(x, 13, _red(3) if x % 6 not in (3, 4) else _red(4))
        c.P(x, 14, _red(1) if H(x, 14, 74) > 0.12 else RUST[2])
        c.P(x, 15, CEDAR[0])                                             # 데크에 진 난간 그늘
    # 가까운 난간(남): 갓 윗면 3줄 + 앞 + 기둥(擬宝珠 머리) + 가운데 가로대
    for x in range(W):
        h = H(x, 29, 74)
        c.P(x, 28, _red(0))
        c.P(x, 29, _red(4) if h > 0.25 else _red(3))
        c.P(x, 30, _red(3))
        c.P(x, 31, _red(2) if h > 0.1 else RUST[2])
        c.P(x, 32, _red(0))
        c.P(x, 35, _red(3)); c.P(x, 36, _red(1))
    for x in range(1, W, 16):
        for y in range(32, 39):
            c.P(x, y, _red(3)); c.P(x + 1, y, _red(2)); c.P(x + 2, y, _red(1))
        c.P(x + 1, 38, RUST[1])
        c.P(x, 26, _red(1)); c.P(x + 1, 26, _red(3)); c.P(x + 2, 26, _red(1))     # 기둥 머리
        c.P(x, 27, _red(3)); c.P(x + 1, 27, _red(4)); c.P(x + 2, 27, _red(2))
        c.P(x + 1, 25, K('kii', 0))
    # 거더(앞면): 윗 플랜지 빛 · 웨브 · 보강판 · 리벳 두 줄 · 녹 줄 · 아래 플랜지 그늘
    for x in range(W):
        h = H(x, 40, 75)
        c.P(x, 39, _red(4))
        for y in range(40, 45):
            col = _red(3) if y == 40 else _red(2) if y < 43 else _red(1)
            if h < 0.08 and y > 40:
                col = _red(1)
            c.P(x, y, col)
        c.P(x, 45, _red(0))
    for x in range(6, W - 6, 12):                                        # 보강판(빛 · 그늘)
        c.VL(x, 41, 4, _red(3)); c.VL(x + 1, 41, 4, _red(1))
    for x in range(2, W - 2, 4):                                         # 리벳: 위·아래 플랜지 곁에 한 줄씩
        c.P(x, 40, _red(4)); c.P(x + 1, 40, _red(1))
        c.P(x + 2, 44, _red(3))
        if H(x, 41, 76) < 0.15:
            c.P(x, 42, RUST[2]); c.P(x, 43, RUST[1])                     # 녹 줄
    for x in range(W):
        c.P(x, 46, CANAL[0] if x % 2 == 0 else K('kon', -2))
        if x % 2 == 1:
            c.P(x, 47, CANAL[0])                                         # 물에 진 그늘(디더)
    # 양 끝 돌 교대(橋台): 돌마다 5단
    for ax in (0, W - 7):
        for y in range(38, 48):
            for x in range(ax, ax + 7):
                c.P(x, y, MORTAR)
        y = 38
        for r, ch in enumerate((3, 4, 3)):
            sx = ax + (r % 2) * 2 - 2
            k = 0
            while sx < ax + 7:
                sw = 4 + int(H(r, k, ax) * 2)
                ramp, tt = _pick_stone(r, k, ax + 11)
                for j in range(ch):
                    for i in range(sw):
                        px = sx + i
                        if ax <= px < ax + 7:
                            _stone_px(c, px, y + j, i, sw - 1 - i, j, ch, ramp, tt, 78)
                sx += sw
                k += 1
            y += ch
        c.HL(ax, 38, 7, FLAG[4])
        c.VL(ax if ax else ax + 6, 39, 9, FLAG[0] if ax else FLAG[1])
    tint_outlines(c)


# ═══════════════════════════ 징검다리 ═══════════════════════════
_STONES = (
    # cx, cy, rx, ry, p(모양: 2 둥근 · 3+ 각진), 흔들림
    (8, 9, 6.2, 3.6, 2.0, 0.18),
    (23, 19, 7.0, 3.6, 3.4, 0.10),
    (39, 10, 5.4, 3.4, 2.4, 0.26),
    (54, 19, 6.6, 4.0, 2.8, 0.16),
    (29, 4, 4.2, 2.4, 2.0, 0.22),
)


def _inside(dx, dy, rx, ry, p, wob, sd):
    import math
    a = math.atan2(dy, dx)
    k = int((a + math.pi) / (2 * math.pi) * 8) % 8
    r = 1 + (H(k, 0, sd) - 0.5) * wob
    return abs(dx / rx) ** p + abs(dy / ry) ** p <= r ** p


@kit('inaka-stepping-stones', '개울 징검다리(飛び石) - 윗면 밝은 납작 돌·물에 잠긴 옆면(4×2)', 4, 2, 'terrain',
     solid=[], other='floor', tags=['inaka', '징검다리', '飛び石'],
     rules='얕은 개울(inaka-river-shallow) 위에 깔아 건넌다.', role='terrain')
def stepping(c, base):
    SIDE = 2
    for n, (cx, cy, rx, ry, p, wob) in enumerate(_STONES):
        sd = 90 + n
        x0, x1, y0, y1 = int(cx - rx - 4), int(cx + rx + 6), int(cy - ry - 2), int(cy + ry + SIDE + 4)
        for y in range(y0, y1):
            for x in range(x0, x1):
                dx, dy = x - cx, y - cy
                top = _inside(dx, dy, rx, ry, p, wob, sd)
                side = (not top) and any(_inside(dx, dy - s, rx, ry, p, wob, sd) for s in range(1, SIDE + 1))
                rim = (not top and not side) and _inside(dx, dy - SIDE - 1, rx + 1.2, ry + 0.8, p, wob, sd)
                wake = (not top and not side and not rim) and dx > 0 and _inside(dx - 2.5, dy - SIDE - 1, rx + 1.5, ry + 0.9, p, wob, sd)
                h = H(x, y, sd)
                if top:
                    s = dx / rx + dy / ry * 1.2 + (h - 0.5) * 0.35
                    col = FLAG[4] if s < -0.95 else FLAG[3] if s < -0.1 else FLAG[2] if s < 0.75 else FLAG[1]
                    if s < -0.95 and h < 0.3:
                        col = PAVE[4]
                    if 0.2 < h < 0.26 and s > -0.6:
                        col = GRAV[2]                                     # 돌 얼룩
                    mx, my = cx + rx * (H(n, 5, 3) - 0.5) * 0.9, cy + ry * 0.3
                    if (x - mx) ** 2 / 4 + (y - my) ** 2 < 1.6 and h < 0.75:
                        col = MOSS[3] if dy < my - cy + 0.5 else MOSS[1] if dx > mx - cx else MOSS[2]   # 이끼 점
                elif side:
                    col = WETC[3] if dx < -rx * 0.3 else WETC[2]
                    if not _inside(dx, dy - SIDE + 1, rx, ry, p, wob, sd) and not top:
                        col = WETC[1] if dx > 0 else WETC[2]              # 물에 닿은 젖은 밑단
                elif rim:
                    if dx < -rx * 0.2 or dy > ry + SIDE:
                        col = WHITE[4] if h < 0.45 else WHITE[3] if h < 0.75 else CANAL[4]
                    else:
                        col = CANAL[3] if h < 0.6 else WHITE[2]
                elif wake:
                    if (x + y) % 2 == 0:
                        col = CANAL[1] if dy < SIDE + 2 else CANAL[3]     # 돌 그늘·물살 디더
                    elif h < 0.25:
                        col = WHITE[3]
                    else:
                        continue
                else:
                    continue
                c.P(x, y, col)
        # 위로 흘러오는 물을 가르는 흰 물살 한 줄(왼쪽)
        lx = round(cx - rx) - 2
        for k in range(3):
            c.P(lx - k, round(cy) + k, WHITE[3] if k else WHITE[4])
    tint_outlines(c)
