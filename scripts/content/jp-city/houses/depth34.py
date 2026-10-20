#!/usr/bin/env python3
"""jp_city 3/4 탑뷰 깊이 지붕(2026-10-20 사용자: 「가로 공간감만 있고 세로 공간감이 없다」).

옛 지붕은 정면 입면도처럼 그려졌다(지붕 높이 = 물매 높이뿐, 사다리꼴 실루엣). 3/4 탑뷰에서는 남북 깊이가 화면 세로로
보여야 하므로 지붕 = **위에서 내려다본 면**이다:
  - 바깥선은 직사각형(앞 처마 · 뒤 처마 · 옆 처마가 세로선). 사다리꼴로 좁아지지 않는다.
  - 용마루는 가로선, 위쪽 20~25% 자리. 그 위로 뒤 경사면이 어두운 띠로 조금 보인다.
  - 寄棟: 隅棟이 용마루 끝에서 네 귀퉁이로 내려간다. 옆 삼각면(왼쪽 빛·오른쪽 그늘)은 기와 줄이 세로다.
  - 陸屋根: 옥상 바닥 = 건물 깊이. 뒤 난간 안쪽 면이 보이고, 옥상 설비는 윗면 + 남쪽 면이 있는 상자다.
지붕 높이는 그림 높이의 40~60%(버들항 집 비율). 앞벽은 그 아래.
house_kit.build 의 ROOFS 에 등록한다: ('hip_top', {'h': 52}) · ('gable_top', {'h': 48}) · ('flat_top', {'h': 56, 'items': …}).
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import house_kit as hk  # noqa: E402
from house_kit import K, OL, ROOFS  # noqa: E402


def _course(c, x, y, ytop, mat, t, seam_x=True):
    """기와 한 칸: 4px 줄(첫 줄 +1, 마지막 줄 -2), 줄마다 엇갈린 세로 골(-1). 기와 몇 장은 한 단 밝다(결)."""
    k = (y - ytop) % 4
    row = (y - ytop) // 4; col = (x + (2 if row % 2 else 0)) // 4
    if k == 3: t -= 2
    elif k == 0: t += 1
    elif seam_x and (x + (2 if row % 2 else 0)) % 4 == 0: t -= 1
    elif (row * 7 + col * 13) % 11 == 0: t += 1
    c.P(x, y, K(mat, t))


def _eave_lip(c, x0, x1, y, mat, base):
    """앞 처마 끝(軒先) 3px + 윤곽."""
    c.HL(x0, y, x1 - x0 + 1, K(mat, base + 2))
    for x in range(x0, x1 + 1):
        c.P(x, y + 1, K(mat, base - 1 if x % 3 else base - 2))
    c.HL(x0, y + 2, x1 - x0 + 1, K(mat, base - 3))
    c.HL(x0, y + 3, x1 - x0 + 1, OL)
    c.VL(x0 - 1, y, 3, OL); c.VL(x1 + 1, y, 3, OL)


def hip_top(c, x0, x1, ytop, yeave, mat, base, ridge_frac=0.24, run=None):
    """寄棟을 위에서: 직사각 바깥선, 가로 용마루, 隅棟 넷. 앞 경사면이 가장 크다."""
    D = yeave - ytop
    yr = ytop + (2 if ridge_frac <= 0.08 else max(5, round(D * ridge_frac)))   # 용마루 줄
    fd = yeave - yr                                           # 앞 경사면 화면 깊이
    run = run if run is not None else round(fd * 0.62)        # 옆 삼각면 폭(용마루 끝까지)
    flat_back = ridge_frac <= 0.08                            # 뒤 경사면을 안 보이게(버들항식: 용마루 = 윗선)
    rl, rr = x0 + run, x1 - run
    for y in range(ytop, yeave):
        if y < yr:   # 뒤 경사면 + 뒤쪽 隅棟
            f = 1.0 if flat_back else (y - ytop) / max(1, yr - ytop)
            bl = round(x0 + run * f); br = round(x1 - run * f)
        else:
            f = (yeave - y) / max(1, fd)
            bl = round(x0 + run * f); br = round(x1 - run * f)
        up = 1 if y >= yr and (y - yr) < fd * 0.35 else 0
        for x in range(x0, x1 + 1):
            if x < bl:                                       # 왼쪽 옆면(서향 · 빛) — 기와 줄 세로
                t = base + 2 - (2 if (x - x0) % 4 == 3 else 0) + (1 if (x - x0) % 4 == 0 else 0)
                if (y + (2 if (x - x0) // 4 % 2 else 0)) % 4 == 0: t -= 1
                c.P(x, y, K(mat, t))
            elif x > br:                                     # 오른쪽 옆면(동향 · 그늘)
                t = base - 1 - (2 if (x1 - x) % 4 == 0 else 0) + (1 if (x1 - x) % 4 == 3 else 0)
                if (y + (2 if (x1 - x) // 4 % 2 else 0)) % 4 == 0: t -= 1
                c.P(x, y, K(mat, t))
            elif y < yr and not flat_back:                   # 뒤 경사면(북향 · 빛을 받아 밝다)
                _course(c, x, y, ytop, mat, base + 1)
            else:                                            # 앞 경사면
                _course(c, x, y, yr, mat, base + up)
        # 隅棟(마루): 밝은 1px + 아래 그늘 1px
        if bl > x0:
            c.P(bl, y, K(mat, base + 3)); c.P(bl + 1, y, K(mat, base - 2))
        if br < x1:
            c.P(br, y, K(mat, base + 1)); c.P(br - 1, y, K(mat, base - 2))
        c.P(x0 - 1, y, OL); c.P(x1 + 1, y, OL)
    # 용마루(大棟): 위에서 본 가로 띠 3px(밝은 윗면 2 + 남쪽 그늘 1)
    c.HL(rl - 1, yr - 2, rr - rl + 3, K(mat, base + 3)); c.HL(rl - 1, yr - 1, rr - rl + 3, K(mat, base + 2))
    c.HL(rl - 1, yr, rr - rl + 3, K(mat, base - 3))
    c.P(rl - 2, yr - 1, K(mat, base + 1)); c.P(rr + 2, yr - 1, K(mat, base - 1))
    # 뒤 처마 윤곽 + 얇은 뒤 처마 끝
    c.HL(x0 - 1, ytop - 1, x1 - x0 + 3, OL)
    if not flat_back: c.HL(x0, ytop, x1 - x0 + 1, K(mat, base + 2))
    _eave_lip(c, x0 - 1, x1 + 1, yeave, mat, base)
    if flat_back:                                                            # 위 바깥 귀퉁이를 사선으로 깎아 寄棟 실루엣(옆면 쐐기가 윤곽이 된다)
        ch = max(3, run // 2)
        for j in range(ch):
            n = ch - j
            for x in list(range(x0 - 1, x0 - 1 + n)) + list(range(x1 + 2 - n, x1 + 2)):
                if 0 <= ytop + j < c.h: c.a[ytop + j, x] = 0
            c.P(x0 - 1 + n, ytop + j, OL); c.P(x1 + 1 - n, ytop + j, OL)
        for x in range(x0 - 1, x0 - 1 + ch): c.a[ytop - 1, x] = 0
        for x in range(x1 + 2 - ch, x1 + 2): c.a[ytop - 1, x] = 0
    return yr


def gable_top(c, x0, x1, ytop, yeave, mat, base, ridge_frac=0.22):
    """平入り 切妻를 위에서: 직사각 바깥선, 가로 용마루, 뒤 경사면 띠, 양 끝 破風板은 세로 흰 띠."""
    D = yeave - ytop
    flat_back = ridge_frac <= 0.08                            # 버들항식: 용마루 = 윗선(뒤 경사면 안 보임)
    yr = ytop + (2 if flat_back else max(5, round(D * ridge_frac)))
    fd = yeave - yr
    for y in range(ytop, yeave):
        up = 1 if y >= yr and (y - yr) < fd * 0.35 else 0
        for x in range(x0, x1 + 1):
            if y < yr and not flat_back: _course(c, x, y, ytop, mat, base + 1)
            else: _course(c, x, y, yr, mat, base + up)
        c.P(x0, y, K(mat, base + 3)); c.P(x0 + 1, y, K(mat, base + 1))       # 케라바(빛 쪽): 기와 톤 밝게 1px
        c.P(x1, y, K(mat, base - 3)); c.P(x1 - 1, y, K(mat, base - 2))       # 케라바(그늘 쪽)
        c.P(x0 - 1, y, OL); c.P(x1 + 1, y, OL)
    c.HL(x0 + 2, yr - 2, x1 - x0 - 3, K(mat, base + 3)); c.HL(x0 + 2, yr - 1, x1 - x0 - 3, K(mat, base + 2)); c.HL(x0 + 2, yr, x1 - x0 - 3, K(mat, base - 3))
    c.HL(x0 - 1, ytop - 1, x1 - x0 + 3, OL)
    if not flat_back: c.HL(x0, ytop, x1 - x0 + 1, K(mat, base - 1))
    _eave_lip(c, x0 - 1, x1 + 1, yeave, mat, base)
    return yr


def gable_front_top(c, x0, x1, ytop, yeave, ywall, mat, base, rise, wx0, wx1, wmat, wbase, wkind='plaster'):
    """妻入り 切妻를 위에서: 용마루가 남북(화면 세로) 가운데선. 왼쪽 경사 빛 · 오른쪽 그늘, 기와 줄은 세로(처마와 나란).
    뒤 끝·앞 끝 바깥선은 납작한 Λ(가운데가 rise 만큼 높다). 앞 끝 아래로 박공 삼각벽이 벽 위(ywall)까지 보인다."""
    xc = (x0 + x1) // 2; half = max(1, (x1 - x0) / 2)
    tex_ribs = mat == 'tekko'
    rise_b = rise                                                            # 뒤 끝 = 앞 처마와 나란한 Λ
    for x in range(x0, x1 + 1):
        d = abs(x - xc) / half
        yt = ytop + round(rise_b * d); yb = yeave - round(rise * (1 - d))
        lit = x <= xc
        for y in range(yt, yb - 1):
            t = base + (2 if lit else -1)
            if tex_ribs:                                                     # 골판: 얕은 세로 골 + 12줄마다 판 이음
                t += (1 if (x - x0) % 6 == 1 else -1 if (x - x0) % 6 == 4 else 0)
                if (y - yt) % 12 == 11: t -= 1
            else:                                                            # 기와: 가로 단(4줄) + 엇갈린 골
                k = (y - yt) % 4
                if k == 3: t -= 2
                elif k == 0: t += 1
                elif (x + (2 if (y - yt) // 4 % 2 else 0)) % 4 == 0: t -= 1
            if lit and x < x0 + 2: t += 1
            if not lit and x > x1 - 2: t -= 1
            c.P(x, y, K(mat, t))
        c.P(x, yb - 1, K('shiro', 1 if lit else -1)); c.P(x, yb, K('shiro', 0 if lit else -2))   # 破風板(앞 끝)
        c.P(x, yb + 1, OL)
        c.P(x, yt - 1, OL)
        if wx0 <= x <= wx1:                                                  # 박공 삼각벽
            for y in range(yb + 2, ywall):
                if wkind == 'vboard':
                    tt = wbase + (-1 if x % 4 == 0 else 1 if x % 4 == 1 else 0)
                elif wkind == 'siding':
                    tt = wbase - 1 if y % 4 == 0 else wbase
                else:
                    tt = wbase + (1 if (x * 5 + y * 11) % 23 == 0 else 0)
                if y < yb + 4: tt -= 1                                       # 처마 밑 그늘
                c.P(x, y, K(wmat, tt))
    for y in range(ytop - 1, yeave - rise + 2):                              # 용마루(세로): 밝은 1 + 그늘 1
        c.P(xc, y, K(mat, base + 3)); c.P(xc + 1, y, K(mat, base - 2))
    c.VL(x0 - 1, ytop + rise_b - 1, yeave - ytop - rise_b + 3, OL); c.VL(x1 + 1, ytop + rise_b - 1, yeave - ytop - rise_b + 3, OL)
    gy = yeave - rise // 2 - 1                                               # 박공 환기창(박공벽 가운데, 처마선 아래)
    if rise >= 16 and gy > yeave - rise + 3 and gy + 5 < ywall:
        c.R(xc - 3, gy, 7, 5, K('tekko', -1)); c.HL(xc - 3, gy, 7, K('tekko', 2))
        for i in range(xc - 2, xc + 4, 2): c.VL(i, gy + 1, 4, K('tekko', 1))


def shed_top(c, x0, x1, ytop, yeave, mat, base):
    """片流れ를 위에서: 한 장 직사각 경사면(뒤가 높다). 뒤→앞으로 어두워지는 명암 + 16줄마다 가로 판 이음,
    골은 얕게(세로 줄은 약하게), 양옆 마구리 판(왼쪽 밝음 · 오른쪽 그늘) 3px, 뒤 끝 밝은 판금 캡, 앞 처마 물받이."""
    D = yeave - ytop
    for y in range(ytop, yeave):
        f = (y - ytop) / max(1, D)
        g = 2 if f < 0.15 else 1 if f < 0.6 else 0
        for x in range(x0 + 3, x1 - 2):
            t = base + g + (1 if (x % 4 == 1 and (y // 2) % 2) else -1 if x % 8 == 3 else 0)
            if (y - ytop) % 16 == 15: t -= 1
            elif (y - ytop) % 16 == 0 and y > ytop: t += 1
            c.P(x, y, K(mat, t))
        c.P(x0, y, K(mat, base + 3)); c.P(x0 + 1, y, K(mat, base + 2)); c.P(x0 + 2, y, K(mat, base + 2))   # 마구리(빛)
        c.P(x1, y, K(mat, base - 3)); c.P(x1 - 1, y, K(mat, base - 2)); c.P(x1 - 2, y, K(mat, base))      # 마구리(그늘)
        c.P(x0 - 1, y, OL); c.P(x1 + 1, y, OL)
    c.HL(x0 - 1, ytop - 1, x1 - x0 + 3, OL); c.HL(x0, ytop, x1 - x0 + 1, K('tekko', 3)); c.HL(x0, ytop + 1, x1 - x0 + 1, K('tekko', 1))
    c.HL(x0 - 1, yeave, x1 - x0 + 3, K('tekko', 3)); c.HL(x0 - 1, yeave + 1, x1 - x0 + 3, K('tekko', 0))
    c.HL(x0 - 1, yeave + 2, x1 - x0 + 3, K('tekko', -2)); c.HL(x0 - 2, yeave + 3, x1 - x0 + 5, OL)
    c.VL(x0 - 2, yeave, 3, OL); c.VL(x1 + 2, yeave, 3, OL)


# ─────────────────────────── 옥상(陸屋根) ───────────────────────────
def _box(c, x, y, w, top, face, mat='conc', tb=2, fb=0):
    """옥상 상자: 윗면 top 줄(밝음) + 남쪽 면 face 줄 + 윤곽 + 오른쪽 아래 그림자 2px(바닥 위)."""
    c.R(x, y, w, top, K(mat, tb)); c.HL(x, y, w, K(mat, tb + 1)); c.VL(x, y, top, K(mat, tb + 1))
    c.R(x, y + top, w, face, K(mat, fb)); c.HL(x, y + top, w, K(mat, fb - 1)); c.VL(x + w - 1, y + top, face, K(mat, fb - 2))
    c.HL(x - 1, y - 1, w + 2, OL); c.VL(x - 1, y, top + face, OL); c.VL(x + w, y, top + face, OL); c.HL(x - 1, y + top + face, w + 2, OL)
    c.HL(x + 1, y + top + face + 1, w + 1, K('conc', -2)); c.VL(x + w + 1, y + 2, top + face, K('conc', -2))


def _ac(c, x, y):
    """실외기: 윗면 7(환기 살) + 남쪽 면 7(둥근 팬)."""
    _box(c, x, y, 14, 7, 7, 'shiro', 1, -1)
    for i in range(x + 2, x + 12, 2): c.VL(i, y + 2, 4, K('shiro', 0))
    for j in range(y + 8, y + 13):
        for i in range(x + 2, x + 9):
            if (i - x - 5.5) ** 2 + (j - y - 10.5) ** 2 <= 7: c.P(i, j, K('tekko', -1 if (i + j) % 2 else 0))
    c.VL(x + 11, y + 8, 5, K('tekko', 0))


def _tank(c, x, y, w=14):
    """물탱크: 다리 받침 + 원통(윗면 타원 + 몸)."""
    c.R(x, y + 4, w, 8, K('shiro', 0)); c.VL(x, y + 4, 8, K('shiro', 1)); c.VL(x + w - 1, y + 4, 8, K('shiro', -2)); c.VL(x + w - 2, y + 4, 8, K('shiro', -1))
    c.HL(x, y + 8, w, K('conc', 1))
    for j in range(-1, 8):                                                   # 윗면 타원(위에서 본 뚜껑) — 몸보다 밝다
        for i in range(w):
            if ((i - (w - 1) / 2) / (w / 2)) ** 2 + ((j - 3) / 3.6) ** 2 <= 1: c.P(x + i, y + j, K('shiro', 2 if (i < w // 2 or j < 2) else 1))
    c.P(x + w // 2, y + 2, K('conc', 0)); c.P(x + w // 2 - 1, y + 2, K('conc', 0))
    for px in (x + 2, x + w - 4): c.R(px, y + 12, 2, 4, K('tekko', 0))
    c.HL(x + 1, y + 16, w, K('conc', -2))
    c.VL(x - 1, y + 1, 11, OL); c.VL(x + w, y + 1, 11, OL); c.HL(x + 2, y - 1, w - 4, OL); c.HL(x, y + 12, w, OL)


def _penthouse(c, x, y, w=28, top=16, face=18):
    """塔屋(계단실): 윗면(난간 캡) + 남쪽 면에 철문."""
    _box(c, x, y, w, top, face, 'conc', 1, 1)
    c.R(x, y, w, 2, K('conc', 3)); c.R(x, y, 2, top, K('conc', 2)); c.R(x + w - 2, y, 2, top, K('conc', 0))
    dx = x + (w - 12) // 2
    c.R(dx, y + top + face - 17, 12, 17, K('tekko', 0)); c.VL(dx, y + top + face - 17, 17, K('tekko', 2)); c.VL(dx + 11, y + top + face - 17, 17, K('tekko', -2))
    c.HL(dx, y + top + face - 17, 12, K('tekko', 2)); c.P(dx + 9, y + top + face - 9, K('kii', 2))
    c.HL(dx - 1, y + top + face - 18, 14, K('conc', -2))


def flat_top(c, x0, x1, ytop, yb, mat='conc', items=()):
    """陸屋根을 위에서. 바닥 = 깊이(ytop..yb). 뒤 난간은 캡 + 안쪽 면(남향, 보인다), 옆 난간은 캡만, 앞 난간은 캡 + 앞 띠."""
    W = x1 - x0 + 1
    c.R(x0, ytop, W, yb - ytop, K(mat, 0))
    # 방수 시트 이음(가로) · 세로 줄눈
    for y in range(ytop + 12, yb - 6, 9): c.HL(x0 + 4, y, W - 8, K(mat, -1)); c.HL(x0 + 4, y + 1, W - 8, K(mat, 1))
    for x in range(x0 + 20, x1 - 6, 24): c.VL(x, ytop + 9, yb - ytop - 14, K(mat, -1))
    # 뒤 난간: 캡 3 + 안쪽 면 5(남향 · 조금 어둡다) + 바닥에 떨어진 그늘 2
    c.R(x0, ytop, W, 3, K(mat, 3)); c.HL(x0, ytop + 2, W, K(mat, 2))
    c.R(x0, ytop + 3, W, 5, K(mat, -1)); c.HL(x0, ytop + 3, W, K(mat, -2))
    for x in range(x0 + 6, x1 - 4, 6): c.VL(x, ytop + 4, 4, K(mat, -2))          # 안쪽 면 줄눈
    c.HL(x0, ytop + 8, W, K(mat, -2)); c.HL(x0, ytop + 9, W, K(mat, -1))
    # 옆 난간 캡(왼쪽 빛 · 오른쪽 그늘) + 왼쪽 난간이 오른쪽 바닥에 드리운 그늘
    c.R(x0, ytop, 3, yb - ytop, K(mat, 2)); c.VL(x0, ytop, yb - ytop, K(mat, 3))
    c.R(x1 - 2, ytop, 3, yb - ytop, K(mat, 0)); c.VL(x1, ytop, yb - ytop, K(mat, -1))
    c.VL(x0 + 3, ytop + 8, yb - ytop - 8, K(mat, -2)); c.VL(x0 + 4, ytop + 8, yb - ytop - 8, K(mat, -1))
    # 앞 난간 캡(위에서 본 윗면) + 앞 띠(벽 맨 위)
    c.HL(x0, yb - 5, W, K(mat, -2))                                              # 캡 뒤(바닥 쪽) 그늘
    c.HL(x0, yb - 4, W, K(mat, 3)); c.HL(x0, yb - 3, W, K(mat, 2)); c.HL(x0, yb - 2, W, K(mat, 1))
    c.HL(x0, yb - 1, W, K(mat, -2)); c.HL(x0 - 1, yb, W + 2, OL)                 # 앞 난간 립 그늘 + 윤곽: 옥상/벽 경계를 또렷이
    c.R(x0 + 6, yb - 9, 4, 3, K('tekko', -2)); c.HL(x0 + 6, yb - 9, 4, K('tekko', -3))   # 배수구
    c.HL(x0 - 1, ytop - 1, W + 2, OL); c.VL(x0 - 1, ytop, yb - ytop, OL); c.VL(x1 + 1, ytop, yb - ytop, OL)
    taken = []
    for kind, ix, iy in items:
        ix += x0; iy += ytop
        bw = {'pent': 28, 'ac': 14, 'tank': 14}.get(kind, 14)
        for a, b in taken:                                                   # 겹치면 오른쪽으로 민다
            if ix < b + 4 and ix + bw > a - 4: ix = b + 5
        if ix + bw > x1 - 4: continue                                        # 옥상 밖으로 나가면 뺀다
        taken.append((ix, ix + bw))
        if kind == 'ac': _ac(c, ix, iy)
        elif kind == 'tank': _tank(c, ix, iy)
        elif kind == 'pent': _penthouse(c, ix, iy)


# ─────────────────────────── house_kit 등록 ───────────────────────────
def _hip_top(cv, X0, X1, top, h, r, opt):
    hip_top(cv, X0 - 4, X1 + 4, top - h, top - 4, r['rmat'], r['rbase'], opt.get('ridge', 0.24), opt.get('run'))


def _gable_top(cv, X0, X1, top, h, r, opt):
    gable_top(cv, X0 - 4, X1 + 4, top - h, top - 4, r['rmat'], r['rbase'], opt.get('ridge', 0.22))


def deepen(r, kind_map=None):
    """옛 레시피 r 의 지붕을 3/4 깊이 지붕으로 바꾼 사본. 지붕 높이는 벽 높이에 맞춰 그림 높이의 40~50%.
    hip→hip_top · gable_side→gable_top · gable_front/gable_front_big→gable_front_top · shed→shed_top · flat→flat_top."""
    import copy
    r = copy.deepcopy(r)
    rk, ro = r['roof']
    walls = sum(f['h'] for f in r['floors']) + sum(hk.JOIN_H.get(j[0], {'lean': 16, 'lean_bal': 16, 'belt': 4, 'corridor': 4}.get(j[0], 0)) for j in r.get('joins', [])) + 8
    hp = max(50, min(70, round(walls * 0.85)))
    if rk == 'hip':
        r['roof'] = ('hip_top', {'h': hp, 'ridge': 0.0, 'run': min(16, (r['w'] * 16) // 8)})
    elif rk == 'gable_side':
        r['roof'] = ('gable_top', {'h': hp - 4, 'ridge': 0.0})
    elif rk in ('gable_front', 'gable_front_big'):
        r['roof'] = ('gable_front_top', {'h': hp + 6, 'rise': max(12, min(20, r['w'] * 3))})
    elif rk == 'shed':
        r['roof'] = ('shed_top', {'h': hp})
    elif rk == 'flat':
        hf = max(52, min(72, round(walls * 0.75)))
        items = []
        for kind, ix in ro.get('items', ()):
            if kind == 'hatch': items.append(('pent', ix, hf // 4))
            elif kind == 'tank': items.append(('tank', ix, 8))
            elif kind == 'ac': items.append(('ac', ix, hf - 30))
        r['roof'] = ('flat_top', {'h': hf, 'mat': ro.get('mat', 'conc'), 'items': tuple(items)})
    return r


def _flat_top(cv, X0, X1, top, h, r, opt):
    flat_top(cv, X0, X1, top - h, top, opt.get('mat', 'conc'), opt.get('items', ()))


def _gable_front_top(cv, X0, X1, top, h, r, opt):
    f = r['floors'][-1]
    rise = opt.get('rise', 14)
    gable_front_top(cv, X0 - 4, X1 + 4, top - h, top, top, r['rmat'], r['rbase'], rise, X0, X1, f['mat'], f['base'], f['kind'])


def _shed_top(cv, X0, X1, top, h, r, opt):
    shed_top(cv, X0 - 3, X1 + 3, top - h, top - 4, r['rmat'], r['rbase'])


ROOFS['gable_front_top'] = _gable_front_top
ROOFS['shed_top'] = _shed_top
ROOFS['hip_top'] = _hip_top
ROOFS['gable_top'] = _gable_top
ROOFS['flat_top'] = _flat_top
