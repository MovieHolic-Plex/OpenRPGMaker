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


def _anchor(yr, yeave):
    """기와 단 기준선: 마지막 단이 처마 바로 위에서 끝나도록(처마 쪽 단이 잘리지 않게) 위로 맞춘다."""
    return yr - ((4 - (yeave - yr) % 4) % 4)


def _up(y, ya, yr, fd):
    """앞 경사면 위쪽 밝은 띠는 단 단위로(단 중간에서 바뀌면 같은 색 3줄이 생긴다)."""
    cy = y - ((y - ya) % 4)
    return 1 if (cy - yr) < fd * 0.35 else 0


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
    ya = _anchor(yr, yeave)
    for y in range(ytop, yeave):
        if y < yr:   # 뒤 경사면 + 뒤쪽 隅棟
            f = 1.0 if flat_back else (y - ytop) / max(1, yr - ytop)
            bl = round(x0 + run * f); br = round(x1 - run * f)
        else:
            f = (yeave - y) / max(1, fd)
            bl = round(x0 + run * f); br = round(x1 - run * f)
        up = _up(y, ya, yr, fd) if y >= yr else 0
        for x in range(x0, x1 + 1):
            if x < bl:                                       # 왼쪽 옆면(서향 · 빛) — 기와 줄 세로
                t = base + 2 - (2 if (x - x0) % 4 == 3 else 0) + (1 if (x - x0) % 4 == 0 else 0)
                if (y + (2 if (x - x0) // 4 % 2 else 0)) % 4 == 0: t -= 1
                c.P(x, y, K(mat, t))
            elif x > br:                                     # 오른쪽 옆면(동향 · 그늘)
                t = max(base - 1, -1) - (2 if (x1 - x) % 4 == 0 else 0) + (1 if (x1 - x) % 4 == 3 else 0)
                if (y + (2 if (x1 - x) // 4 % 2 else 0)) % 4 == 0: t -= 1
                c.P(x, y, K(mat, t))
            elif y < yr and not flat_back:                   # 뒤 경사면(북향 · 빛을 받아 밝다)
                _course(c, x, y, ytop, mat, base + 1)
            else:                                            # 앞 경사면
                _course(c, x, y, ya, mat, base + up)
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
    if flat_back:                                                            # 바깥선을 지붕 높이 전체에 걸쳐 안으로 기울인다(寄棟 사다리꼴 실루엣)
        ch = max(3, run // 2)
        for y in range(ytop - 1, yeave):
            n = round(ch * (yeave - y) / max(1, yeave - ytop + 1))
            if n <= 0: continue
            for x in list(range(x0 - 1, x0 - 1 + n)) + list(range(x1 + 2 - n, x1 + 2)):
                if 0 <= y < c.h: c.a[y, x] = 0
            if y >= ytop: c.P(x0 - 1 + n, y, OL); c.P(x1 + 1 - n, y, OL)
            else: c.HL(x0 - 1 + n, y, x1 - x0 + 3 - 2 * n, OL)
    return yr


def gable_top(c, x0, x1, ytop, yeave, mat, base, ridge_frac=0.22):
    """平入り 切妻를 위에서: 직사각 바깥선, 가로 용마루, 뒤 경사면 띠, 양 끝 破風板은 세로 흰 띠."""
    D = yeave - ytop
    flat_back = ridge_frac <= 0.08                            # 버들항식: 용마루 = 윗선(뒤 경사면 안 보임)
    yr = ytop + (7 if flat_back else max(5, round(D * ridge_frac)))       # 버들항식: 용마루(棟瓦) 7줄 띠가 윗선(1배에서 읽히게)
    fd = yeave - yr
    ya = _anchor(yr, yeave)
    for y in range(ytop, yeave):
        up = _up(y, ya, yr, fd) if y >= yr else 0
        for x in range(x0, x1 + 1):
            if y < yr and not flat_back: _course(c, x, y, ytop, mat, base + 1)
            else: _course(c, x, y, ya, mat, base + up)
        c.P(x0, y, K('shiro', 1)); c.P(x0 + 1, y, K(mat, base + 3)); c.P(x0 + 2, y, K(mat, base + 2))   # けらば(빛 쪽) 3px: 흰 테 + 밝은 기와 두 줄
        c.P(x1, y, OL); c.P(x1 - 1, y, K(mat, base - 3)); c.P(x1 - 2, y, K(mat, base - 2))             # けらば(그늘 쪽) 3px
        c.P(x0 - 1, y, OL); c.P(x1 + 1, y, OL)
    if flat_back:                                                            # 棟瓦 7줄: 冠瓦 + 漆喰(따뜻한 흰) 줄 사이 熨斗 2단 + 그늘, 양 끝 鬼瓦(기와 끝 모양)
        W = x1 - x0 + 1
        c.HL(x0, yr - 7, W, K(mat, 3)); c.HL(x0, yr - 6, W, K(mat, 2))                     # 冠瓦 2줄: 램프 맨 위 빛 + 앞면(슬레이트 위에서 띠로 읽히게)
        for x in range(x0 + 1, x1, 4): c.P(x, yr - 6, K(mat, 0)); c.P(x, yr - 7, K(mat, 1))   # 冠瓦 이음(기와 한 장씩)
        c.HL(x0, yr - 5, W, K('kinari', 1))                                                    # 漆喰 줄(따뜻한 흰)
        c.HL(x0, yr - 4, W, K(mat, base + 1))                                                  # 熨斗 1단
        for x in range(x0 + 2, x1 - 1, 3): c.P(x, yr - 4, K(mat, base - 1))
        c.HL(x0, yr - 3, W, K('kinari', -1))                                                   # 漆喰 줄(그늘진)
        c.HL(x0, yr - 2, W, K(mat, base + 1))                                                  # 熨斗 2단
        for x in range(x0 + 3, x1 - 1, 3): c.P(x, yr - 2, K(mat, base - 2))
        c.HL(x0, yr - 1, W, K(mat, base - 4)); c.HL(x0, yr, W, K(mat, base - 2))              # 棟 아래 그늘
        ONI = ('.LLL.', 'LHHMD', 'LHMMD', 'LMMMD', 'LMMDD', 'DDDDD')                          # 鬼瓦: 둥근 머리 기와 끝(위 빛 · 오른쪽 그늘), 점 없음
        col = {'L': K(mat, base + 3), 'H': K(mat, base + 2), 'M': K(mat, base + 1), 'D': K(mat, base - 2)}
        for ex in (x0, x1 - 4):
            for j, row in enumerate(ONI):
                for i, ch in enumerate(row):
                    if ch != '.': c.P(ex + i, yr - 7 + j, col[ch])
            c.R(ex + 5 if ex == x0 else ex - 1, yr - 6, 1, 6, K(mat, base - 4))               # 안쪽 끝 그늘: 棟 띠와 떨어진 기와 끝으로 읽히게
    else:
        c.HL(x0 + 2, yr - 2, x1 - x0 - 3, K(mat, base + 4)); c.HL(x0 + 2, yr - 1, x1 - x0 - 3, K(mat, base + 3)); c.HL(x0 + 2, yr, x1 - x0 - 3, K(mat, base - 4))
    c.HL(x0 - 1, ytop - 1, x1 - x0 + 3, OL)
    if not flat_back: c.HL(x0, ytop, x1 - x0 + 1, K(mat, base - 1))
    _eave_lip(c, x0 - 1, x1 + 1, yeave, mat, base)
    return yr


def gable_front_top(c, x0, x1, ytop, yeave, ywall, mat, base, rise, wx0, wx1, wmat, wbase, wkind='plaster', wall_px=None):
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
            t = min(base + 2, 2) if lit else max(base - 1, -1)                # 그늘 면 하한 −1: 기와 단(−2/+1)이 램프 끝에 눌려 사라지지 않게(3~5색)
            if tex_ribs:                                                     # 골판(r2 VQA 2026-10-21): 골은 물매 방향 = 박공 끝 Λ 와 나란(세로 골은 서 있는 판으로 읽혔다)
                k = (y - yt) % 5
                t += 1 if k == 0 else -1 if k == 3 else 0                    # 골 마루 빛 · 골 바닥 그늘
                if d > 0.72 and k != 0: t -= 1                              # 처마 쪽으로 한 단 어둡게(면 명암 단계)
                if d < 0.22 and k == 1: t += 1                              # 용마루 쪽 밝게
                if abs(x - xc) % 22 == 11 and k != 0: t -= 1                # 판 이음(물매에 가로지르는 겹침)
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
                if wall_px is not None:                                      # 아래층 벽과 같은 재질·같은 무늬 위상(이음매 없음)
                    if y < yb + 4: c.P(x, y, K(wmat, wbase - (2 if y < yb + 3 else 1)))
                    else: c.a[y, x] = wall_px[y, x]
                    continue
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
        c.R(xc - 4, gy - 1, 9, 7, OL)
        c.R(xc - 3, gy, 7, 5, K('sumi', 1)); c.HL(xc - 3, gy, 7, K('shiro', 0))
        for j in range(gy + 1, gy + 5, 2): c.HL(xc - 3, j, 7, K('shiro', -1))


def shed_top(c, x0, x1, ytop, yeave, mat, base):
    """片流れ를 위에서: 한 장 직사각 경사면(뒤가 높다). 한 톤 면 + 뒤 끝 밝게·앞 끝 어둡게(가로 이음선·명암 띠는 판넬 격자로 읽혀 뺐다),
    골은 얕게(세로 줄은 약하게), 양옆 마구리 판(왼쪽 밝음 · 오른쪽 그늘) 3px, 뒤 끝 밝은 판금 캡, 앞 처마 물받이."""
    D = yeave - ytop
    for y in range(ytop, yeave):
        f = (y - ytop) / max(1, D)
        for x in range(x0 + 3, x1 - 2):
            # 위(뒤)에서 아래(처마)로 밝음 → 어두움 그러데이션(경계는 체커 디더, 띠·격자 없음) + 왼쪽 위 반사
            m = (x - x0) % 4
            g = 2 if f < 0.22 else 1 if f < 0.50 else 0 if f < 0.80 else -1   # 경사 방향(위→아래)으로 4단(r4 VQA 2026-10-21: 3단·8px 골은 민 판으로 읽혔다)
            t = base + g + (1 if m == 0 else -1 if m == 1 else 0)          # 골판 골 4px(apart-steel2 처럼 면 전체에 결)
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
    dx = x + (w - 12) // 2; dh = min(17, face - 1)                          # 철문(낮은 塔屋이면 문도 낮게)
    c.R(dx, y + top + face - dh, 12, dh, K('tekko', 0)); c.VL(dx, y + top + face - dh, dh, K('tekko', 2)); c.VL(dx + 11, y + top + face - dh, dh, K('tekko', -2))
    c.HL(dx, y + top + face - dh, 12, K('tekko', 2)); c.P(dx + 9, y + top + face - dh // 2, K('kii', 2))
    c.HL(dx - 1, y + top + face - dh - 1, 14, K('conc', -2))


def _plant(c, x, y):
    """화분: 위에서 본 잎 덩이(밝은 위 · 어두운 아래) + 화분 남쪽 면."""
    for j in range(7):
        for i in range(9):
            if ((i - 4) / 4.6) ** 2 + ((j - 3) / 3.6) ** 2 <= 1:
                c.P(x + i, y + j, K('midori', 3 if (j < 3 and i < 5) else 1 if (i + j) % 3 else 0))
    c.P(x + 3, y + 1, K('aka', 3)); c.P(x + 6, y + 2, K('pinku', 3))
    c.R(x + 2, y + 6, 5, 4, K('renga', 1)); c.HL(x + 2, y + 6, 5, K('renga', 3)); c.VL(x + 6, y + 7, 3, K('renga', -1))
    c.HL(x + 1, y + 10, 7, OL); c.VL(x + 1, y + 6, 4, OL); c.VL(x + 7, y + 6, 4, OL)


def _pot(c, x, y):
    """작은 화분(5×7): 화분이 안 들어갈 때의 대체품."""
    for j in range(4):
        for i in range(5):
            if ((i - 2) / 2.6) ** 2 + ((j - 1.5) / 2.1) ** 2 <= 1:
                c.P(x + i, y + j, K('midori', 3 if (j < 2 and i < 3) else 1))
    c.R(x + 1, y + 4, 3, 2, K('renga', 1)); c.HL(x + 1, y + 4, 3, K('renga', 3)); c.HL(x, y + 6, 5, OL)


ROOF_LOG = []                                                                    # 옥상 물건 대체·제외 기록(조용히 사라지지 않게)


def _laundry(c, x, y, w=22):
    """빨래 건조대: 양 끝 기둥 + 줄 + 걸린 천(흰·하늘·분홍)."""
    for px in (x, x + w - 1):
        c.VL(px, y, 12, K('tekko', 2)); c.P(px, y + 12, OL)
    c.HL(x, y + 1, w, K('shiro', 1))
    cl = (('shiro', 2), ('sora', 2), ('pinku', 2), ('shiro', 1), ('kii', 3))
    xx = x + 2; k = 0
    while xx + 4 < x + w - 1:
        rm, t = cl[k % len(cl)]; h = 6 + (k % 2) * 2
        c.R(xx, y + 2, 4, h, K(rm, t)); c.VL(xx + 3, y + 2, h, K(rm, t - 2)); c.HL(xx, y + 2 + h, 4, OL)
        xx += 5; k += 1
    c.HL(x + 1, y + 13, w - 1, K('conc', -2))


def _railing(c, x0, x1, ytop, yb, mat):
    """옥상 난간 갓(2026-10-20 VQA: 기둥 이빨이 성가퀴·레이스로 읽혀 뺐다) — 사방 민무늬 흰 갓돌: 윗면 밝음 · 안쪽 그늘 한 줄."""
    W = x1 - x0 + 1
    c.HL(x0, ytop, W, K('shiro', 2)); c.HL(x0, ytop + 1, W, K('shiro', 1)); c.HL(x0, ytop + 2, W, K('shiro', -1))   # 뒤 갓
    c.HL(x0, yb - 4, W, K('shiro', 2)); c.HL(x0, yb - 3, W, K('shiro', 1)); c.HL(x0, yb - 2, W, K('shiro', 0))      # 앞 갓
    c.VL(x0, ytop, yb - ytop - 1, K('shiro', 2)); c.VL(x0 + 1, ytop, yb - ytop - 1, K('shiro', 1))                   # 왼쪽 갓(빛)
    c.VL(x1, ytop, yb - ytop - 1, K('shiro', -1)); c.VL(x1 - 1, ytop, yb - ytop - 1, K('shiro', 0))                  # 오른쪽 갓(그늘)


def flat_top(c, x0, x1, ytop, yb, mat='conc', items=(), rail=False, floor=None):
    """陸屋根을 위에서. 바닥 = 깊이(ytop..yb). 뒤 난간은 캡 + 안쪽 면(남향, 보인다), 옆 난간은 캡만, 앞 난간은 캡 + 앞 띠."""
    W = x1 - x0 + 1
    c.R(x0, ytop, W, yb - ytop, K(mat, 0))
    if floor:                                                                    # 방수 도장 바닥(초록 등) — 난간 안쪽만
        c.R(x0 + 3, ytop + 8, W - 6, yb - ytop - 13, K(floor[0], floor[1]))
    # 방수 시트 이음(가로) · 세로 줄눈
    fm, fb = floor if floor else (mat, 0)
    for y in range(ytop + 12, yb - 6, 9): c.HL(x0 + 4, y, W - 8, K(fm, fb - 1)); c.HL(x0 + 4, y + 1, W - 8, K(fm, fb + 1))
    for x in range(x0 + 20, x1 - 6, 24): c.VL(x, ytop + 9, yb - ytop - 14, K(fm, fb - 1))
    # 뒤 난간: 캡 3 + 안쪽 면 5(남향 · 조금 어둡다) + 바닥에 떨어진 그늘 2
    c.R(x0, ytop, W, 3, K(mat, 3)); c.HL(x0, ytop + 2, W, K(mat, 2))
    c.R(x0, ytop + 3, W, 3, K(mat, -1)); c.HL(x0, ytop + 3, W, K(mat, -2))     # 뒤 난간 안쪽 면 3줄(남향)
    for x in range(x0 + 6, x1 - 4, 6): c.VL(x, ytop + 4, 2, K(mat, -2))          # 안쪽 면 줄눈
    c.HL(x0, ytop + 6, W, K(mat, -2))                                            # 바닥에 떨어진 그늘 1줄
    # 옆 난간 캡(왼쪽 빛 · 오른쪽 그늘) + 왼쪽 난간이 오른쪽 바닥에 드리운 그늘
    c.R(x0, ytop, 3, yb - ytop, K(mat, 2)); c.VL(x0, ytop, yb - ytop, K(mat, 3))
    c.R(x1 - 2, ytop, 3, yb - ytop, K(mat, 0)); c.VL(x1, ytop, yb - ytop, K(mat, -1))
    c.VL(x0 + 3, ytop + 8, yb - ytop - 8, K(mat, -2)); c.VL(x0 + 4, ytop + 8, yb - ytop - 8, K(mat, -1))
    # 앞 난간 캡(위에서 본 윗면) + 앞 띠(벽 맨 위)
    c.HL(x0, yb - 5, W, K(mat, -2))                                              # 캡 뒤(바닥 쪽) 그늘
    c.HL(x0, yb - 4, W, K(mat, 3)); c.HL(x0, yb - 3, W, K(mat, 2)); c.HL(x0, yb - 2, W, K(mat, 1))
    c.HL(x0, yb - 1, W, K(mat, -2)); c.HL(x0 - 1, yb, W + 2, OL)                 # 앞 난간 립 그늘 + 윤곽: 옥상/벽 경계를 또렷이
    c.HL(x0 - 1, ytop - 1, W + 2, OL); c.VL(x0 - 1, ytop, yb - ytop, OL); c.VL(x1 + 1, ytop, yb - ytop, OL)
    if rail: _railing(c, x0, x1, ytop, yb, mat)
    taken = []
    BW = {'pent': 28, 'ac': 14, 'tank': 14, 'plant': 9, 'laundry': 22, 'pot': 5}
    BH = {'pent': 34, 'ac': 15, 'tank': 17, 'plant': 11, 'laundry': 14, 'pot': 7}
    PRI = {'pent': 0, 'laundry': 1, 'tank': 2, 'ac': 3, 'plant': 4, 'pot': 5}
    SMALLER = {'laundry': 'plant', 'tank': 'ac', 'plant': 'pot'}                  # 자리가 없으면 한 단계 작은 물건으로
    lo, hi = ytop + 7, yb - 7                                                    # 뒤 난간 안쪽 면(+그늘) 아래 ~ 앞 난간 앞 바닥

    def free(ax, ay, bw, bh):
        return all(not (ax < a1 + 3 and ax + bw > a0 - 3 and ay < b1 + 2 and ay + bh > b0 - 2) for a0, a1, b0, b1 in taken)

    def place(kind, ix, iy):
        if kind == 'tank': ix = x1 - 4 - 14                                    # 물탱크는 오른쪽 구석
        bw, bh = BW.get(kind, 14), BH.get(kind, 15)
        pt, pf = 16, 18
        if kind == 'pent':                                                   # 塔屋은 문 앞에 바닥이 3줄 이상 남게: 윗면 16→5, 남쪽 면 18→12 순으로 줄인다
            room = hi - 3 - lo
            pt = max(5, min(16, room - 18)); pf = max(12, min(18, room - pt))
            if pt + pf > room: return None
            bh = pt + pf; iy = lo
        iy = max(lo, iy)
        if iy + bh > hi: iy = max(lo, hi - bh)                               # 앞 난간을 덮지 않게 위로 올린다
        if iy + bh > hi: return None
        ix = max(x0 + 4, min(ix, x1 - 4 - bw))

        def hug(ax, ay):                                                     # 난간 또는 다른 물건과의 틈(작을수록 붙어 있다)
            g = [ax - (x0 + 4), (x1 - 4 - bw) - ax, ay - lo, (hi - bh) - ay]
            for a0, a1, b0, b1 in taken:
                dx = max(a0 - (ax + bw), ax - a1, 0); dy = max(b0 - (ay + bh), ay - b1, 0)
                g.append(max(dx, dy))
            return min(g)
        small = kind in ('plant', 'pot')
        if not free(ix, iy, bw, bh) or (small and hug(ix, iy) > 4):          # 막혔거나, 화분이 데크 한가운데 외톨이면 난간·물건 곁 빈자리로
            spots = [(ax, ay) for ay in range(lo, hi - bh + 1, 1) for ax in range(x0 + 4, x1 - 3 - bw, 1) if free(ax, ay, bw, bh)]
            if not spots: return None
            ix, iy = min(spots, key=lambda p: (hug(*p) if small else 0, abs(p[0] - ix) + abs(p[1] - iy)))
        taken.append((ix, ix + bw, iy, iy + bh))
        if kind == 'ac': _ac(c, ix, iy)
        elif kind == 'tank': _tank(c, ix, iy)
        elif kind == 'pent': _penthouse(c, ix, iy, top=pt, face=pf)
        elif kind == 'plant': _plant(c, ix, iy)
        elif kind == 'pot': _pot(c, ix, iy)
        elif kind == 'laundry': _laundry(c, ix, iy)
        return kind

    for kind, ix, iy in sorted(items, key=lambda t: PRI.get(t[0], 5)):           # 큰 것부터 자리를 잡는다(塔屋→빨래→물탱크→실외기→화분)
        k = kind
        while k and place(k, ix + x0, iy + ytop) is None:
            k = SMALLER.get(k)
        if k != kind:
            ROOF_LOG.append((kind, k or 'dropped', W))


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
    flat_top(cv, X0, X1, top - h, top, opt.get('mat', 'conc'), opt.get('items', ()), opt.get('rail', False), opt.get('floor'))


def _gable_front_top(cv, X0, X1, top, h, r, opt):
    f = r['floors'][-1]
    rise = opt.get('rise', 14)
    fy = top + 4                                                             # 맨 위층 벽 시작(지붕·벽 사이 4줄 틈도 박공벽으로 메운다)
    tmp = hk.Cv(cv.w, cv.h)
    ys = fy - 48 * ((fy - (top - h)) // 48 + 1)                              # 무늬 주기(4·6·8·12·16·24)의 배수만큼 위에서 시작 → 위상 일치
    hk.wall(tmp, X0, ys, X1 - X0 + 1, fy - ys, f['mat'], f['base'], f['kind']) if ys >= 0 else None
    if ys < 0:
        tmp2 = hk.Cv(cv.w, cv.h + 96); hk.wall(tmp2, X0, ys + 96, X1 - X0 + 1, fy - ys, f['mat'], f['base'], f['kind'])
        tmp.a[:] = tmp2.a[96:96 + cv.h]
    gable_front_top(cv, X0 - 4, X1 + 4, top - h, top, fy, r['rmat'], r['rbase'], rise, X0, X1, f['mat'], f['base'], f['kind'], wall_px=tmp.a)


def _shed_top(cv, X0, X1, top, h, r, opt):
    shed_top(cv, X0 - 3, X1 + 3, top - h, top - 4, r['rmat'], r['rbase'])


ROOFS['gable_front_top'] = _gable_front_top
ROOFS['shed_top'] = _shed_top
ROOFS['hip_top'] = _hip_top
ROOFS['gable_top'] = _gable_top
ROOFS['flat_top'] = _flat_top


# ── 지붕 높이 상한(2026-10-20 사용자: 「지붕이 너무 세로로 길어지는 경우」) ─────────────────────
# 지붕 줄 R = 그림 맨 위 → 처마선, 그림 높이 H = R + 벽(층+이음) + 기초 4. 경사 지붕 ≤ 40%, 평지붕 데크 ≤ 35%.
# 줄 수만 줄이고(무늬는 같은 간격으로 그려진다) 벽·문은 그대로 둔다. 기준: 버들항 단층 60%·2층 43%(cream/ochre/brick-native).
ROOF_CAP = {'flat_top': 0.35, 'shed_top': 0.35}
ROOF_CAP_PITCHED = 0.40
ROOF_MIN_H = 24
ROOF_DEPTH = 36                                         # 지붕 면(妻入り는 박공벽 제외 · 평지붕은 데크) 절대 깊이 상한


def cap_roof(r):
    import copy
    r = copy.deepcopy(r)
    # 주택·역은 따뜻한 기와(kawara −2, 2026-10-20 VQA 3판: −1 은 밝은 주황, −3 은 검붉게 뭉개진다). 상점가는 townify 가 흑갈(ita)로 먼저 바꾼다.
    if r.get('rmat') in ('renga', 'aka'): r['rmat'], r['rbase'] = 'kawara', -2
    if r.get('rmat') == 'kawara': r['rbase'] = -2
    rk, ro = r['roof']
    if 'h' not in ro: return r
    hgt = {'lean': 16, 'lean_bal': 16, 'belt': 4, 'none': 0, 'corridor': 4, **hk.JOIN_H}
    walls = sum(f['h'] for f in r['floors']) + sum(hgt[j[0]] for j in r.get('joins', []))
    c = ROOF_CAP.get(rk, ROOF_CAP_PITCHED)
    r_max = int(c / (1 - c) * (walls + 4))              # 비율 상한(낮은 집에만 걸린다)
    rise = ro.get('rise', 14) if rk == 'gable_front_top' else 0
    r_max += rise                                       # 앞 박공 삼각벽은 벽이다(지붕 면 깊이만 센다)
    # 2026-10-20 적대 VQA: 비율 상한은 키 큰 건물에 깊은 지붕을 준다 → 지붕 면 깊이를 절대값 ROOF_DEPTH(파출소 35·창고 32)로 묶는다
    h_new = max(ROOF_MIN_H, min(ro['h'], r_max - 2, ROOF_DEPTH + rise))
    if h_new == ro['h']: return r
    ro = dict(ro, h=h_new)
    if rk == 'hip_top' and h_new < r['roof'][1]['h']:  # 寄棟 옆 삼각면을 넓혀 추녀가 서지 않게(45° 근처)
        ro['run'] = max(ro.get('run') or 0, min(27, int(h_new * 0.72)))
    if rk == 'flat_top' and ro.get('items'):
        k = h_new / r['roof'][1]['h']
        ro['items'] = tuple((kind, ix, max(4, round(iy * k))) for kind, ix, iy in ro['items'])
    r['roof'] = (rk, ro)
    return r


# ── 상점가 화풍(2026-10-20 사용자 참고: 妻入り 박공 · 난간 두른 옥상) ─────────────────────────────
# 좁은 상점·주택(폭 ≤ 6칸)은 妻入り(용마루 남북) 박공, 평지붕은 사방 난간 + 화분·실외기·塔屋·빨래가 있는 데크.
# 지붕 색은 어둡고 중립(슬레이트·흑갈·녹), 두 경사면 명암을 또렷이. 밝은 빨강 지붕은 기와색으로 내린다.
PITCHED_OLD = ('gable_side', 'shed', 'gable_front', 'gable_front_big', 'hip')
FLOORS = (('midori', -2), ('conc', -1), ('tairu', 0), ('conc', 0))   # 어둡고 중립(밝은 초록 금지)


def townify(r, id_, narrow_w=6, force=None):
    """옛 레시피 → 상점가 화풍 3/4 레시피. force = 'gable_front' | 'flat' 이면 폭과 무관하게 그 지붕으로."""
    import copy, zlib
    r = copy.deepcopy(r)
    seed = zlib.crc32(id_.encode())
    rk = r['roof'][0]
    # 상점가 지붕 한 계열: 슬레이트(yoru·tairu) · 흑갈 기와(ita −2, VQA 3판: −1 은 회갈 베이지) · 골판(tekko). 빨강·주황·분홍 기와(kawara·renga·aka)는 흑갈로.
    if r.get('rmat') in ('kawara', 'renga', 'aka'): r['rmat'], r['rbase'] = 'ita', -2
    if force == 'gable_front' or (force is None and rk in PITCHED_OLD and r['w'] <= narrow_w):
        r['roof'] = ('gable_front', {})
    elif force == 'flat':
        r['roof'] = ('flat', {'items': (('ac', 30),)})
    r = deepen(r)
    rk, ro = r['roof']
    if rk == 'flat_top':
        W = r['w'] * 16; h = ro['h']
        items = list(ro.get('items', ()))
        if not any(k == 'pent' for k, _, _ in items) and W >= 80: items.insert(0, ('pent', 6, 4))
        items.append(('plant', W - 22, h - 20))
        items.append(('plant', 8 if W < 80 else 40, h - 20))
        if W >= 96 and seed % 2 == 0: items.append(('laundry', W // 2, 12))
        elif W >= 96: items.append(('plant', W // 2 + 8, h - 20))
        ro = dict(ro, items=tuple(items), rail=True, floor=FLOORS[seed % len(FLOORS)])
        r['roof'] = (rk, ro)
    return r
