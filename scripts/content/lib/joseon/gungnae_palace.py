"""국내성 왕궁(관청) 구역 조각 — 정전·전각·행각·궁 담·궁 문·포장 마당·어도·연못·마당 소품·탑형 랜드마크.

문법은 blocks.py(조립)·roof3d.py(지붕)와 같고 색은 tk.RGB 램프만 쓴다. blocks.py 는 건드리지 않고 이 모듈이 확장한다:
  - 2층 팔작: 아래층(지붕+벽) 위에 위층(작은 지붕+벽)을 아래 지붕 용마루께로 가라앉혀 얹는다 -> 이중 처마.
  - 월대: 돌 기단 2단(윗단 면, 아랫단 윗면+난간, 아랫단 면) + 계단 + 어도 비탈.
  - 지붕 색: roof3d 가 모르는 램프(wood·dblue·dgreen·giwa)는 _ramp 를 잠깐 바꿔 끼워 그린다.
폭·층수는 함수 인자(bays 등)로 바꿔 다시 조립한다.
"""
import contextlib
import math
from tk import *
from build import outline
import blocks as K
import roof3d
import trees as TR
from props5 import ell, shadow_ell, box, cyl
from props4 import slab
from trees import ground_shadow
import structs as ST
import ground as G


def lib():
    import catalog
    return catalog.lib()


# ---------------------------------------------------------------- 지붕(램프 지정)
@contextlib.contextmanager
def _ramp(name):
    old = roof3d._ramp
    roof3d._ramp = lambda s: RGB[name]
    try:
        yield
    finally:
        roof3d._ramp = old


def baram_roof(cv, R, ramp, wing, trim=False):
    with _ramp(ramp):
        K.roof_baram(cv, R, 'x', wing=wing, trim=trim)


# ---------------------------------------------------------------- 벽 블록(주황/붉은 기둥·청록 창살·열린 칸)
def _col(c, x, y0, y1, ramp):
    r = RGB[ramp]
    hi, mid, lo = (r[4], r[3], r[2]) if ramp in ('red', 'persimmon') else (r[5], r[4], r[2])
    for y in range(y0, y1):
        c.put(x, y, hi); c.put(x + 1, y, mid); c.put(x + 2, y, lo)


def _pane(c, x0, y0, x1, y1, glass, rows=(4,)):
    """창살: paper = 한지(버들항 lattice), teal = 청록 유리빛 창살."""
    if glass == 'paper':
        K._lattice(c, x0, y0, x1, y1, 3, rows)
        return
    g = RGB['dgreen']
    for y in range(y0, y1):
        for x in range(x0, x1):
            q = rnd(x, y, 71)
            c.put(x, y, g[6] if q > 0.93 else (g[5] if q > 0.1 else g[4]))
    for x in range(x0 + 3, x1 - 1, 3):
        c.vl(x, y0, y1, g[2])
    for r in rows:
        if y0 + r < y1:
            c.hl(x0, x1, y0 + r, g[2])
    c.vl(x0, y0, y1, g[3]); c.vl(x1 - 1, y0, y1, g[1])


def blk(half, kind, col='red', plaster='plaster', glass='paper', dan=False, base=True, floor='wood'):
    """벽 한 칸. half u(위행)/b(아래행). kind: l p r(끝 기둥) w(창) d(문) o(열린 칸) g(널문)."""
    c = Cv(T, T)
    W = RGB['wood']; St = RGB['stone']; E = RGB['earth']; P = RGB[plaster]
    if half == 'u':
        for x in range(T):
            c.put(x, 0, W[1]); c.put(x, 1, W[1]); c.put(x, 2, W[5])
            c.put(x, 3, W[4]); c.put(x, 4, W[1]); c.put(x, 5, P[2])
        if dan:
            g, b, rd = RGB['dgreen'], RGB['dblue'], RGB['red']
            pat = [g[5], g[5], g[4], rd[4], rd[5], b[5], b[4], b[4]]
            pt3 = [g[4], g[4], g[3], rd[3], rd[4], b[4], b[3], b[3]]
            pt4 = [g[3], g[3], g[2], rd[2], rd[3], b[3], b[2], b[2]]
            for x in range(T):
                c.put(x, 2, pat[x % 8]); c.put(x, 3, pt3[x % 8]); c.put(x, 4, pt4[x % 8])
        K._wall_fill(c, plaster, 6, T, seed=1)
        c.hl(0, T, 6, P[2])
        if kind == 'w':
            _pane(c, 4, 8, 15, T, glass, (4,))
        elif kind == 'd':
            _pane(c, 3, 7, 15, T, glass, (4, 9))
            c.vl(3, 6, T, W[5]); c.vl(9, 6, T, W[3]); c.hl(3, 15, 6, W[5]); c.hl(3, 15, 7, W[2])
            c.put(8, 12, RGB['straw'][5]); c.put(10, 12, RGB['straw'][5])
        elif kind == 'g':
            K._plank_door(c, 0, 7)
        elif kind in ('o', 'q'):                            # 열린 칸: 안쪽 그늘(q = 기둥 없는 통로)
            for y in range(6, T):
                for x in range(T):
                    c.put(x, y, E[0] if y < 10 else E[1])
            for x in (4, 11):
                c.vl(x, 8, T, W[1])
        if kind != 'q':
            _col(c, 0, 2, T, col)
        if kind == 'r':
            _col(c, 13, 2, T, col)
    else:
        top = 12 if base else T
        K._wall_fill(c, plaster, 0, top, seed=2)
        if kind == 'f':
            _pane(c, 4, 0, 15, 6, glass, (4,))
            for x in range(3, T):
                c.put(x, 6, W[6]); c.put(x, 7, W[5]); c.put(x, 8, W[4]); c.put(x, 9, W[3]); c.put(x, 10, W[3]); c.put(x, 11, W[2])
        elif kind == 'd':
            _pane(c, 3, 0, 15, 5, glass, (2,))
            for y in range(5, 12):
                for x in range(3, 15):
                    c.put(x, y, W[4] if (x + y) % 5 else W[3])
            for x in range(3, 15):
                c.put(x, 5, W[6]); c.put(x, 11, W[2])
            for xx in (3, 9, 14):
                c.vl(xx, 5, 12, W[2])
            c.vl(9, 0, 5, W[3])
        elif kind == 'g':
            K._plank_door(c, 0, 0, lower=True)
        elif kind in ('o', 'q'):                            # 열린 칸: 안쪽 그늘 + 마루 윗면
            for y in range(0, 7):
                for x in range(T):
                    c.put(x, y, E[0])
            for y in range(7, top):
                for x in range(T):
                    if floor == 'stone':
                        c.put(x, y, St[6] if y == 7 else (St[4] if (x // 8 + y // 3) % 2 else St[5]))
                    else:
                        c.put(x, y, W[6] if y == 7 else (W[5] if (x // 5 + y) % 2 else W[4]))
        if base:
            for x in range(T):
                c.put(x, 12, St[6]); c.put(x, 13, St[5]); c.put(x, 14, St[4] if rnd(x, 14, 8) > 0.2 else St[5]); c.put(x, 15, St[3])
            c.vl(7, 14, 15, St[3])
        if kind != 'q':
            _col(c, 0, 0, top, col)
        if kind == 'r':
            _col(c, 13, 0, top, col)
    return c


def _lean(cv, y0, y1, xa, xb):
    """벽 오른쪽을 어둡게(빛은 왼쪽 위). blocks.finish_house 와 같은 식, 범위를 지정한다."""
    from build import _snap_dark
    cache = {}
    for y in range(y0, y1):
        for x in range(xa, xb + 1):
            if cv.a[y, x, 3] != 255:
                continue
            t = (x - xa) / max(1, xb - xa)
            f = 1.0 - 0.24 * max(0.0, (t - 0.45) / 0.55) ** 1.4
            if f < 0.985:
                c = tuple(int(v) for v in cv.a[y, x, :3])
                k = (c, round(f, 2))
                if k not in cache:
                    cache[k] = _snap_dark(tuple(int(v * f) for v in c))
                cv.put(x, y, cache[k])


def _railing(cv, y0, y1):
    """위층 마루 난간: 가로대 두 줄 + 굵은 살(벽 폭 안쪽에만)."""
    W = RGB['wood']
    xa, xb = T - 2, cv.w - T + 2
    for x in range(xa, xb):
        cv.put(x, y0, W[5]); cv.put(x, y0 + 1, W[4])
        cv.put(x, y1 - 2, W[3]); cv.put(x, y1 - 1, W[1])
    for x in range(xa + 1, xb - 1, 4):
        for y in range(y0 + 2, y1 - 2):
            cv.put(x, y, W[3]); cv.put(x + 1, y, W[1])


def tier(bays, R, ramp, wing, ku, kb, col='red', plaster='plaster', glass='paper', dan=False, trim=False, base=True, rows='ub', railing=False, floor='wood', nobase=()):
    """한 층: 지붕 R 행 + 벽 위행(+아래행). 지붕은 벽보다 좌우 한 칸씩 넓다. 윤곽선·땅 그림자는 붙이지 않는다(합성 뒤 한 번만)."""
    nrow = R + (2 if rows == 'ub' else 1)
    W = bays + 2
    cv = Cv(W * T, nrow * T)
    for i, k in enumerate(ku):
        cv.paste(blk('u', k, col, plaster, glass, dan), (i + 1) * T, R * T)
    if rows == 'ub':
        for i, k in enumerate(kb):
            cv.paste(blk('b', k, col, plaster, glass, dan, base and i not in nobase, floor), (i + 1) * T, (R + 1) * T)
    baram_roof(cv, R, ramp, wing, trim)
    _lean(cv, R * T, nrow * T, T, (W - 1) * T - 1)
    if railing:
        _railing(cv, cv.h - 7, cv.h)
    return cv


# ---------------------------------------------------------------- 돌 기단·계단·난간
def _courses(c, x0, y0, x1, y1, seed=0, ch=7):
    ST.stone_courses(c, x0, y0, x1, y1, seed=seed, ch=ch)


def _stairs(c, cx, y0, w, n, tread=3, riser=3, slab_w=14):
    """계단 w px 폭, n 단. 가운데 slab_w px 는 어도 비탈(밝은 판석 + 새김). 위쪽이 높고 아래가 앞이다."""
    S = RGB['stone']
    x0 = cx - w // 2
    for i in range(n):
        y = y0 + i * (tread + riser)
        for yy in range(tread):
            for x in range(w):
                c.put(x0 + x, y + yy, S[6] if yy == 0 else S[5])
        for yy in range(riser):
            for x in range(w):
                f = x / max(1, w - 1)
                t = 4 if f < 0.3 else (3 if f < 0.85 else 2)
                if yy == riser - 1:
                    t = max(1, t - 1)
                c.put(x0 + x, y + tread + yy, S[t])
        c.put(x0, y, S[6]); c.put(x0 + w - 1, y, S[3])
    H = n * (tread + riser)
    if slab_w:
        sx0 = cx - slab_w // 2
        for y in range(y0, y0 + H):
            for x in range(slab_w):
                col = S[6] if x < 2 else (S[5] if x < slab_w - 3 else S[4])
                if x == slab_w - 1: col = S[3]
                c.put(sx0 + x, y, col)
        for y in range(y0 + 2, y0 + H - 2):                       # 비탈 새김: 가운데 두 줄 무늬
            if (y - y0) % 6 in (1, 2):
                c.put(cx - 2, y, S[4]); c.put(cx - 1, y, S[4]); c.put(cx + 1, y, S[4]); c.put(cx + 2, y, S[4])
        for x in range(slab_w):
            c.put(sx0 + x, y0 + H - 1, S[3])
    return H


def _post(c, x, ytop, h=9):
    """난간 기둥(석주): 윗 덮개 + 몸통(왼쪽 밝음)."""
    S = RGB['stone']
    c.rect(x - 1, ytop, x + 5, ytop + 2, S[6])
    c.rect(x, ytop + 2, x + 4, ytop + h, S[5])
    c.vl(x, ytop + 2, ytop + h, S[6]); c.vl(x + 3, ytop + 2, ytop + h, S[3]); c.vl(x + 2, ytop + 2, ytop + h, S[4])


def _rail(c, x0, x1, y, skip=()):
    S = RGB['stone']
    for x in range(x0, x1):
        if any(a <= x < b for a, b in skip):
            continue
        c.put(x, y, S[6]); c.put(x, y + 1, S[5]); c.put(x, y + 2, S[3])


def wolde(c, x0, x1, ytop, stair_w=48, rail=True):
    """월대 2단. ytop = 건물 아랫선. 위 단 면(12px, 계단 3단) -> 아랫단 윗면(8px, 난간) -> 아랫단 면(14px, 계단 4단).
    돌려주는 값 = 아래 끝 y."""
    S = RGB['stone']
    cx = (x0 + x1) // 2
    ux0, ux1 = x0 + 12, x1 - 12
    _courses(c, ux0, ytop, ux1, ytop + 12, 1, 6)
    for x in range(ux0, ux1):
        c.put(x, ytop + 11, S[1])
    for y in range(ytop + 12, ytop + 20):                              # 아랫단 윗면
        for x in range(x0, x1):
            t = S[6] if y == ytop + 12 else (S[5] if rnd(x, y, 5) > 0.15 else S[4])
            c.put(x, y, t)
    for x in range(ux0, ux1):
        c.put(x, ytop + 12, S[3])
    _courses(c, x0, ytop + 20, x1, ytop + 34, 2, 7)
    for x in range(x0, x1):
        c.put(x, ytop + 33, S[1])
    _stairs(c, cx, ytop + 12, 32, 3, 2, 2, 12)                         # 윗 단 계단(12px 면을 덮는다)
    yb = ytop + 20
    _stairs(c, cx, yb, stair_w, 5, 3, 3, 14)
    if rail:                                                           # 아랫단 난간(계단 자리는 비운다)
        ry = ytop + 14
        _rail(c, x0 + 2, x1 - 2, ry + 3, skip=[(cx - stair_w // 2 - 2, cx + stair_w // 2 + 2)])
        px = x0 + 2
        step = 28
        n = max(2, int((x1 - x0 - 4) // step))
        xs = [x0 + 2 + int(round(i * (x1 - x0 - 8) / n)) for i in range(n + 1)]
        for xp in xs:
            if abs(xp + 2 - cx) < stair_w // 2 + 2:
                continue
            _post(c, xp, ry - 3, 9)
        _post(c, cx - stair_w // 2 - 6, ry - 3, 9)
        _post(c, cx + stair_w // 2 + 2, ry - 3, 9)
    return ytop + 20 + 5 * 6


# ---------------------------------------------------------------- 정전
def palace_hall(bays=5, roof='wood', glass='paper', col='red'):
    """정전: 2층 팔작 + 이중 처마 + 단청 띠 + 높은 월대(돌 기단 2단 + 난간 + 계단/어도). 폭 = bays + 4 칸, 높이 12 칸."""
    ub = max(1, bays - 2)
    lo_u = 'l' + ('d' * (bays - 2)) + 'r' if bays <= 5 else 'l' + 'dwd' + 'd' * (bays - 6) + 'dwd'[::-1] + 'r'
    lo_u = lo_u[:bays]
    lo_b = lo_u.replace('w', 'f')
    up_u = 'l' + 'w' * (ub - 2) + 'r' if ub >= 2 else 'r'
    up_b = up_u.replace('w', 'f')
    low = tier(bays, 3, roof, 36, lo_u, lo_b, col, 'plaster', glass, dan=True, trim=True, base=True)
    up = tier(ub, 3, roof, 22, up_u, up_b, col, 'plaster', glass, dan=True, trim=True, base=False, railing=True)
    PW = (bays + 4) * T
    cv = Cv(PW, 12 * T)
    y_low = 58
    cv.paste(low, (PW - low.w) // 2, y_low)
    cv.paste(up, (PW - up.w) // 2, 0)
    yb = wolde(cv, 0, PW, y_low + low.h)
    outline(cv)
    ground_shadow(cv, PW // 2 + 6, yb + 1, PW // 2 - 6, 2, 70)
    return cv


# ---------------------------------------------------------------- 정전(넓은 단층 대전 + 낮은 3단 월대)
def wolde3(c, x0, x1, ytop, stair_w=48):
    """낮은 월대 3단. 단마다 면 9px + 윗면 5px(난간 기둥은 맨 윗단 모서리만), 가운데 계단(어도 비탈)이 세 단을 내려간다. ytop = 건물 아랫선. 돌려주는 값 = 아래 끝 y.
    좌우 폭이 단마다 한 칸(16px)씩 넓어진다(위 단이 가장 좁다)."""
    S = RGB['stone']
    cx = (x0 + x1) // 2
    y = ytop
    tiers = ((x0 + 32, x1 - 32), (x0 + 16, x1 - 16), (x0, x1))
    for k, (a, b) in enumerate(tiers):
        for yy in range(y, y + 5):                                         # 윗면
            for x in range(a, b):
                t = S[6] if yy == y else (S[5] if rnd(x, yy, 5 + k) > 0.12 else S[4])
                c.put(x, yy, t)
        _courses(c, a, y + 5, b, y + 14, k + 1, 5)                        # 면
        for x in range(a, b):
            c.put(x, y + 13, S[1])
        y += 14
    # 계단: 세 단을 가로질러 내려간다(맨 윗단 면은 3칸 높이 9px 이므로 2단씩)
    yy0 = ytop + 5
    _stairs(c, cx, yy0, stair_w, 6, 3, 2, 14)
    # 맨 윗단 난간(계단 자리는 비운다) + 모서리 기둥
    a, b = tiers[0]
    ry = ytop
    _rail(c, a + 2, b - 2, ry + 2, skip=[(cx - stair_w // 2 - 2, cx + stair_w // 2 + 2)])
    for xp in (a + 1, b - 6, cx - stair_w // 2 - 6, cx + stair_w // 2 + 2):
        _post(c, xp, ry - 5, 8)
    return ytop + 3 * 14


def palace_hall_wide(bays=8, roof='wood', glass='paper', col='red'):
    """넓은 단층 정전(원작 비율): 아래 큰 팔작 지붕 + 그 용마루께에 얹힌 낮은 위 지붕(이중 처마, 위 벽은 한 줄뿐) + 낮은 3단 월대.
    폭 = bays + 4 칸(가운데가 칸 경계 = 축), 높이 10 칸. 가운데 칸들은 열 수 있는 문."""
    ku = 'l' + 'wd' + 'dd' + 'dw' + 'r' if bays == 8 else 'l' + 'w' * (bays - 2) + 'r'
    ku = ku[:bays]
    kb = ku.replace('w', 'f')
    ub = bays - 3
    up_u = 'l' + 'w' * (ub - 2) + 'r'
    up_b = up_u.replace('w', 'f')
    low = tier(bays, 3, roof, 38, ku, kb, col, 'plaster', glass, dan=True, trim=True, base=True)
    up = tier(ub, 2, roof, 22, up_u, up_b, col, 'plaster', glass, dan=True, trim=True, base=False, rows='u')
    PW = (bays + 4) * T
    y_up = 0
    y_low = up.h - 14
    cv = Cv(PW, 10 * T)
    cv.paste(low, (PW - low.w) // 2, y_low)
    cv.paste(up, (PW - up.w) // 2, y_up)
    yb = wolde3(cv, 0, PW, y_low + low.h)
    outline(cv)
    ground_shadow(cv, PW // 2 + 6, min(cv.h - 3, yb + 1), PW // 2 - 6, 2, 70)
    return cv


# ---------------------------------------------------------------- 행각(마당 둘레 낮은 건물: 정전과 같은 기와 어휘)
def haenggak(bays=4, variant=0):
    """좌우 행각: 단층 팔작(정전·전각과 같은 곡선 처마·기와 지붕) + 낮은 돌 기단. 폭 bays+2 칸, 높이 5 칸. variant 는 문 칸 위치만 바꾼다."""
    ku = ['w'] * bays; kb = ['f'] * bays
    ku[0] = 'l'; kb[0] = 'l'; ku[-1] = 'r'; kb[-1] = 'r'
    m = bays // 2
    ku[m] = 'd'; kb[m] = 'd'
    t = tier(bays, 2, 'wood', 20, ku, kb, 'red', 'plaster', 'paper', dan=True, trim=True, base=True)
    W = t.w
    cv = Cv(W, t.h)
    cv.paste(t, 0, 0)
    outline(cv)
    ground_shadow(cv, W // 2 + 4, cv.h - 3, W // 2 - 8, 2, 70)
    return cv


# ---------------------------------------------------------------- 전각(작은 단층)
def jeongak(bays=5, variant=0):
    """좌우 전각: 단층 기와 + 낮은 돌 기단 + 계단. variant 0 = 갈색 지붕·붉은 기둥·청록 창살, 1 = 청록 지붕·주황 기둥, 2 = 회색 지붕·붉은 기둥·열린 가운데 칸."""
    spec = [('wood', 'red', 'teal', False), ('dgreen', 'persimmon', 'teal', True), ('giwa', 'red', 'teal', False)][variant % 3]
    ramp, col, glass, dan = spec
    mid = bays // 2
    ku = ['p'] * bays; kb = ['p'] * bays
    for i in range(bays):
        ku[i] = 'w'; kb[i] = 'f'
    ku[0] = 'l'; kb[0] = 'l'; ku[-1] = 'r'; kb[-1] = 'r'
    if variant % 3 == 2:
        ku[mid] = 'o'; kb[mid] = 'o'
    else:
        ku[mid] = 'd'; kb[mid] = 'd'
    t = tier(bays, 3, ramp, 22, ku, kb, col, 'plaster', glass, dan=dan, trim=(variant % 3 == 1), base=True)
    W = t.w
    cv = Cv(W, t.h + T)
    cv.paste(t, 0, 0)
    L = lib()
    for i in range(bays):
        cv.paste(L['plinths' if i == mid else 'plinth'], (i + 1) * T, t.h - 0)
    outline(cv)
    ground_shadow(cv, W // 2 + 4, cv.h - 3, W // 2 - 8, 2, 70)
    return cv


# ---------------------------------------------------------------- 행각(마당 둘레 낭하)
def _flat_roof_block(ramp, row, side):
    """roof_block 과 같은 기와 한 칸을 램프를 바꿔 그린다."""
    c = Cv(T, T)
    G_ = RGB[ramp]; Wd = RGB['wood']
    back_t = (G_[2], G_[3], G_[4], G_[5]); front_t = (G_[1], G_[2], G_[3], G_[4])
    for y in range(T):
        for x in range(T):
            if row == 'ridge':
                if y == 0: col = G_[6]
                elif y in (1, 2): col = (G_[5] if y == 1 else G_[4]) if x % 4 in (0, 1) else G_[3]
                elif y <= 12: col = K._scale(x, y, 1, back_t)
                elif y == 13: col = G_[5]
                else: col = G_[4]
            elif row == 'front':
                if y == 0: col = G_[4]
                elif y == 1: col = G_[2]
                elif y == 2: col = G_[1]
                else: col = K._scale(x, y, 2, front_t)
            elif row == 'body':
                col = K._scale(x, y, 3, front_t)
            else:
                if y <= 8: col = K._scale(x, y, 4, front_t)
                elif y <= 12:
                    k = x % 4
                    if k in (0, 1): col = [G_[5], G_[6], G_[5], G_[3]][y - 9]
                    else: col = [G_[2], G_[2], G_[1], G_[1]][y - 9]
                else:
                    col = Wd[1]
                    if y == 14 and x % 4 == 1: col = Wd[4]
                    if y == 13 and x % 4 == 1: col = Wd[3]
            c.put(x, y, col)
    if side in ('l', 'r'):
        xs = (0, 1) if side == 'l' else (15, 14)
        for y in range(T):
            if row == 'eave' and y >= 13:
                continue
            c.put(xs[0], y, Wd[4] if y % 8 else Wd[3]); c.put(xs[1], y, Wd[2])
    return c


def haengnak(n=6, ends='both', ramp='wood', col='red'):
    """행각: 마당 둘레의 긴 낭하(맞배 지붕 + 열린 기둥 칸 + 석축). 폭 n 칸(+끝 풍판).
    ends: both(양끝 풍판) / l / r / none(이어 붙이는 가운데 토막, 지붕 이음이 맞는다)."""
    rows = ['ridge', 'front', 'eave']
    cv = Cv(n * T, 5 * T)
    for ri, nm in enumerate(rows):
        for i in range(n):
            side = 'm'
            if i == 0 and ends in ('both', 'l'): side = 'l'
            if i == n - 1 and ends in ('both', 'r'): side = 'r'
            cv.paste(_flat_roof_block(ramp, nm, side), i * T, ri * T)
    kinds = ['o'] * n
    kinds[0] = 'l' if ends in ('both', 'l') else 'o'
    kinds[-1] = 'r' if ends in ('both', 'r') else 'o'
    for i, k in enumerate(kinds):
        kk = 'o' if k == 'o' else k
        cv.paste(blk('u', 'o' if kk == 'o' else ('o'), col, 'plaster', 'paper', False), i * T, 3 * T)
        cv.paste(blk('b', 'o', col, 'plaster', 'paper', False, True), i * T, 4 * T)
    # 칸 사이 기둥: 칸마다 왼쪽 기둥은 블록에 있고, 끝 칸은 오른쪽 기둥을 더 세운다
    if ends in ('both', 'r'):
        _col(cv, n * T - 3, 3 * T + 2, 5 * T - 4, col)
    _lean(cv, 3 * T, 5 * T, 0, n * T - 1)
    L = lib()
    return cv


def haengnak_piece(n=6, ends='both', ramp='wood'):
    c = haengnak(n, ends, ramp)
    cv = Cv(c.w, c.h + T)
    cv.paste(c, 0, 0)
    L = lib()
    for i in range(n):
        cv.paste(L['plinth'], i * T, c.h)
    S = RGB['stone']
    for x in range(cv.w):                              # 낭하 앞 디딤돌 띠(밑줄이 어두운 검은 선이 되지 않게)
        for k, t in enumerate((6, 5, 5, 4)):
            cv.put(x, c.h + 8 + k, S[t] if (x // 8 + k) % 3 else S[max(3, t - 1)])
    for x in range(0, cv.w, 8):
        cv.vl(x, c.h + 9, c.h + 12, S[3])
    outline(cv)
    ground_shadow(cv, cv.w // 2 + 3, cv.h - 1, cv.w // 2 - 6, 1.5, 60)
    return cv


# ---------------------------------------------------------------- 궁 담장(황토 흙담 + 기와 덮개)
def _cap(c, x0, x1, y0=0, round_l=False, round_r=False, groove=4):
    """기와 덮개 9줄(앞에서 본 지붕 사면 + 처마 막새 끝)."""
    S = RGB['giwa']
    tones = [6, 5, 5, 4, 4, 3, 3, 2, 1]
    for r, t in enumerate(tones):
        for x in range(x0, x1):
            col = S[t]
            if r in (3, 4, 5) and (x - x0 + groove) % 4 in (0, 1):
                col = S[min(6, t + 1)]
            if r == 8 and (x - x0) % 4 in (0, 1):
                col = S[2]
            c.put(x, y0 + r, col)
    if round_l:
        for r in range(9):
            c.a[y0 + r, x0, 3] = 0 if r in (0, 8) else c.a[y0 + r, x0, 3]
    if round_r:
        for r in range(9):
            c.a[y0 + r, x1 - 1, 3] = 0 if r in (0, 8) else c.a[y0 + r, x1 - 1, 3]


def _body(c, x0, x1, y0, y1, seed=0):
    """회벽(흰 회반죽) 담 몸통: 가로 층 줄눈 + 한 칸 단위 얼룩. 어두운 기와 갓과 짝을 이룬다(황토색이면 길·밭으로 읽힌다)."""
    R_ = RGB['plaster']
    for y in range(y0, y1):
        layer = (y - y0) // 6
        ry = (y - y0) % 6
        for x in range(x0, x1):
            t = 4
            q = rnd(x // 2 + layer * 3, y // 2, seed + 11)
            if q > 0.82: t = 5
            elif q < 0.15: t = 3
            if ry == 0: t += 1                       # 층 윗머리
            if ry == 5: t = max(2, t - 2)            # 층 아래 그늘
            c.put(x, y, R_[max(2, min(6, t))])


def pwall_h(seed=0):
    """궁 담 가로 16×32: 기와 덮개 9줄 + 처마 그늘 + 황토 몸통 + 땅 그림자. 이어 붙이면 이음 없이 이어진다."""
    c = Cv(T, 2 * T)
    _body(c, 0, T, 9, 30, seed)
    for x in range(T):
        c.put(x, 9, RGB['plaster'][2]); c.put(x, 10, RGB['plaster'][2])
    _cap(c, 0, T, 0, groove=(0, 2, 1)[seed % 3])
    for x in range(T):
        c.put(x, 30, RGB['plaster'][2]); c.put(x, 31, SHADOW, 80)
    for x in range(0, T, 8):                          # 받침 돌 한 줄
        pass
    return c


_PX0, _PX1 = 2, 14


def _pband(c, y0, y1, east=False, face=True):
    S = RGB['giwa']; R_ = RGB['plaster']
    cx0, sx0 = (_PX1 - 6, _PX0) if east else (_PX0, _PX0 + 6)
    cap = (S[6], S[6], S[5], S[5], S[4], S[4]) if not east else (S[4], S[4], S[3], S[3], S[2], S[2])[::-1]
    for y in range(y0, y1):
        for lx in range(6):
            col = cap[lx]
            if y % 4 == 3 and lx in (2, 3): col = S[3]
            c.put(cx0 + lx, y, col)
        if face:
            for lx in range(6):
                layer = y // 6; ry = y % 6
                t = (5 if lx < 3 else 4) if not east else (4 if lx < 3 else 3)
                if ry == 0: t += 1
                if ry == 5: t = 2
                if rnd(lx, y, 21) > 0.9: t = min(6, t + 1)
                c.put(sx0 + lx, y, R_[max(2, t)])


def pwall_v(east=False):
    """궁 담 세로(동·서): 3/4 시점에서 왼쪽에 회벽 옆면(빛), 오른쪽에 기와 갓 윗면, 땅 그림자는 오른쪽. 동·서 모두 같은 문법(성벽과 같다)."""
    c = Cv(T, T)
    _pband(c, 0, T, True)
    for y in range(T):
        c.put(_PX1, y, SHADOW, 70); c.put(_PX1 + 1, y, SHADOW, 45)
    return c


def pwall_corner(kind):
    c = Cv(T, 2 * T)
    R_ = RGB['plaster']
    west = kind[1] == 'W'
    hx0, hx1 = (_PX0, T) if west else (0, _PX1)
    _body(c, hx0, hx1, 9, 30, 1 if west else 2)
    for x in range(hx0, hx1):
        c.put(x, 9, R_[2]); c.put(x, 10, R_[2])
    _cap(c, hx0, hx1, 0, round_l=west, round_r=not west)
    if kind[0] == 'N':
        _pband(c, 8, 2 * T, east=True)
        for y in range(8, 2 * T):
            c.put(_PX1, y, SHADOW, 60); c.put(_PX1 + 1, y, SHADOW, 40)
    else:
        _pband(c, 0, 9, east=True, face=False)
    for x in range(hx0, hx1):
        c.put(x, 30, R_[2]); c.put(x, 31, SHADOW, 80)
    return c


# ---------------------------------------------------------------- 궁 문(소문루)
def palace_gate(bays=4):
    """궁 문: 주황 기둥 + 회색 지붕의 작은 문루. 가운데 두 칸은 열린 통로(안쪽 그늘 + 돌 바닥이 앞 포장까지 이어짐), 양끝은 황토 벽. 폭 bays+2 칸, 높이 6 칸."""
    ku = 'l' + 'o' * (bays // 2 - 1) + 'q' + 'o' * (bays - bays // 2 - 2) + 'r'
    kb = ku
    pas = tuple(range(1, bays - 1))
    t = tier(bays, 3, 'giwa', 22, ku, kb, 'persimmon', 'plaster', 'paper', dan=False, trim=True, base=True, floor='stone', nobase=pas)
    cv = Cv(t.w, t.h + T)
    cv.paste(t, 0, 0)
    L = lib()
    for i in range(bays):
        if i in pas:
            cv.paste(court(i % 3), (i + 1) * T, t.h)
        else:
            cv.paste(L['plinth'], (i + 1) * T, t.h)
    outline(cv)
    ground_shadow(cv, cv.w // 2 + 4, cv.h - 3, cv.w // 2 - 8, 2, 70)
    return cv


# ---------------------------------------------------------------- 마당 바닥
def court(v=0):
    """궁 마당 포장: 큰 정방형 판석(한 칸 = 판석 하나), 줄눈은 위·왼쪽 1px 만 약하게. 잡음을 줄여 지붕 그림과 결이 같다. 이음 없는 한 칸."""
    c = Cv(T, T)
    s = RGB['stone']
    tone = (4, 4, 5)[v % 3]
    for y in range(T):
        for x in range(T):
            q = rnd(x, y, 880 + v)
            col = s[tone]
            if q < 0.05: col = s[tone - 1]
            elif q > 0.96: col = s[min(6, tone + 1)]
            c.put(x, y, col)
    for k in range(T):
        c.put(k, 0, s[3]); c.put(0, k, s[3])
        if k > 0:
            c.put(k, 1, s[5]); c.put(1, k, s[5])
    for k in range(2):                                # 판석마다 다른 작은 흠
        x, y = 4 + hsh(k, v, 41) % 9, 4 + hsh(v, k, 43) % 9
        c.put(x, y, s[3]); c.put(x + 1, y, s[3])
    return c


def court_edge(mask):
    """마당 이음(이어지는 쪽 = 포장, 아닌 쪽 = 낮은 경계석 + 흙 + 풀)."""
    c = Cv(T, T)
    s = RGB['stone']; e = RGB['earth']; g = RGB['leaf']
    base = court(0)
    for y in range(T):
        for x in range(T):
            d = G._edge_depth(mask, x, y)
            if d == 0:
                col = tuple(int(v) for v in base.a[y, x, :3])
            elif d == 1: col = s[3]
            elif d == 2: col = e[4] if rnd(x, y, 5) > 0.3 else e[3]
            else: col = e[4] if rnd(x, y, 100) > 0.2 else e[3]       # 풀 대신 맨 흙(바깥 마당 흙과 이어진다)
            c.put(x, y, col)
    # 경계석 윗면 밝은 선: 포장 바로 안쪽
    for y in range(T):
        for x in range(T):
            if G._edge_depth(mask, x, y) == 0:
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    X, Y = x + dx, y + dy
                    if 0 <= X < T and 0 <= Y < T and G._edge_depth(mask, X, Y) == 1:
                        c.put(x, y, s[6]); break
    return c


def eodo(kind='v'):
    """어도(御道) 4×1(가운데 돌길 3칸 = 48px): 밝은 판석 길이 양옆 포장보다 한 단 높고 오른쪽에 그림자. 가운데 x 는 칸 경계(축 x=48)에 놓인다.
    kind v=가운데 토막, end=계단 쪽 끝(아래로 둥글게 내려앉음)."""
    c = Cv(4 * T, T)
    s = RGB['stone']
    for i in range(4):
        c.paste(court(i % 3), i * T, 0)
    x0, x1 = 8, 56
    for y in range(T):
        for x in range(x0, x1):
            q = rnd(x, y, 907)
            col = s[6] if x < x0 + 2 else (s[5] if q > 0.1 else s[4])
            if x >= x1 - 3: col = s[4]
            if x == x1 - 1: col = s[3]
            c.put(x, y, col)
        if y % 8 == 0:
            for x in range(x0 + 2, x1 - 3):
                c.put(x, y, s[4])
    for xc in (x0 + 15, x0 + 16, x0 + 31, x0 + 32):      # 세로 새김 두 줄
        for y in range(T):
            if (y // 4) % 2 == 0:
                c.put(xc, y, s[4])
    for y in range(T):                                # 양옆 그림자
        c.put(x1, y, SHADOW, 90); c.put(x1 + 1, y, SHADOW, 55); c.put(x1 + 2, y, SHADOW, 25)
    for y in range(T):
        c.put(x0 - 1, y, s[3])
    if kind == 'end':
        for x in range(x0, x1):
            c.put(x, T - 1, s[2]); c.put(x, T - 2, s[3])
    return c


# ---------------------------------------------------------------- 연못
def pond(w=4, h=3):
    """돌 난간 둘린 사각 연못 w×h 칸. 3/4: 뒤 턱 윗면 + 안쪽 벽 그늘, 물, 앞 턱 윗면과 앞면. 석주는 모서리와 일정 간격."""
    W, H = w * T, h * T
    c = Cv(W, H)
    S = RGB['stone']; Wt = RGB['water']
    rim_t = 6; rim_s = 5; face_h = 7
    wy0 = 14
    wy1 = H - 14
    # 뒤 턱
    for y in range(8, 8 + rim_t):
        for x in range(2, W - 2):
            c.put(x, y, S[6] if y == 8 else (S[5] if rnd(x, y, 3) > 0.2 else S[4]))
    for y in range(wy0, wy1):                         # 물
        for x in range(2 + rim_s, W - 2 - rim_s):
            q = rnd(x, y, 17)
            col = Wt[3]
            if q < 0.2: col = Wt[2]
            if y < wy0 + 3: col = Wt[2] if y < wy0 + 2 else Wt[3]
            c.put(x, y, col)
    for x in range(2 + rim_s, W - 2 - rim_s):          # 안쪽 벽 그늘
        c.put(x, wy0, S[2]); c.put(x, wy0 + 1, Wt[1])
    # 물결
    for k in range(w * 2):
        x = 8 + hsh(k, w, 3) % (W - 28); y = wy0 + 4 + hsh(w, k, 7) % (wy1 - wy0 - 7)
        c.put(x, y, Wt[4]); c.put(x + 1, y, Wt[4]); c.put(x + 2, y, Wt[5])
    # 옆 턱
    for y in range(8 + rim_t, H - 4 - face_h):
        for x in range(2, 2 + rim_s):
            c.put(x, y, S[6] if x == 2 else S[5])
        for x in range(W - 2 - rim_s, W - 2):
            c.put(x, y, S[4] if x < W - 4 else S[3])
    # 앞 턱 윗면 + 앞면
    for y in range(wy1, wy1 + rim_s):
        for x in range(2, W - 2):
            c.put(x, y, S[6] if y == wy1 else (S[5] if rnd(x, y, 9) > 0.2 else S[4]))
    ST.stone_courses(c, 2, wy1 + rim_s, W - 2, wy1 + rim_s + face_h, seed=3, ch=7)
    for x in range(2, W - 2):
        c.put(x, wy1 + rim_s + face_h - 1, S[1])
    # 앞 턱 아래 그림자
    # 석주와 난간
    n = max(1, w // 2)
    xs = [2 + int(round(i * (W - 8) / n)) for i in range(n + 1)]
    for x0_, x1_ in zip(xs, xs[1:]):                  # 뒤 난간 가로대
        _rail(c, x0_ + 4, x1_, 8 + 1, ())
    for xp in xs:
        _post(c, xp, 1, 9)
    for x0_, x1_ in zip(xs, xs[1:]):                  # 앞 난간 가로대
        _rail(c, x0_ + 4, x1_, wy1 + 1 - 4, ())
    for xp in xs:
        _post(c, xp, wy1 - 8, 9)
    outline(c)
    ground_shadow(c, W // 2 + 3, H - 2, W // 2 - 6, 1.6, 60)
    return c


# ---------------------------------------------------------------- 마당수·소품
def pine_bed(v=0):
    """마당 소나무: 돌 경계석 두른 흙 화단 위에 선 소나무. 4×6 칸."""
    c = Cv(64, 96)
    S = RGB['stone']; E = RGB['earth']
    rect = v != 2
    bx0, bx1 = (2, 62) if rect else (6, 58)
    by0, by1 = 66, 84
    if rect:
        for y in range(by0, by1):
            for x in range(bx0, bx1):
                q = rnd(x, y, 31)
                c.put(x, y, E[4] if q > 0.2 else E[3])
        for x in range(bx0, bx1):
            c.put(x, by0, S[6]); c.put(x, by0 + 1, S[5])
        for y in range(by0, by1):
            c.put(bx0, y, S[6]); c.put(bx0 + 1, y, S[5]); c.put(bx1 - 1, y, S[3]); c.put(bx1 - 2, y, S[4])
        ST.stone_courses(c, bx0, by1, bx1, by1 + 8, seed=v + 2, ch=7)
        for x in range(bx0, bx1):
            c.put(x, by1 + 7, S[1])
    else:
        def top(x, y, u, vv):
            q = rnd(x, y, 33)
            if u * u + vv * vv > 0.82: return S[6] if (u < 0.3 and vv < 0.3) else S[5]
            return E[4] if q > 0.2 else E[3]
        ell(c, 32, 75, 26, 9, top)
        for x in range(8, 57):
            u = (x - 32) / 26.0
            y0 = 75 + int(9 * math.sqrt(max(0, 1 - u * u)))
            for y in range(y0 + 1, y0 + 7):
                t = 5 if u < -0.5 else (4 if u < 0.1 else (3 if u < 0.6 else 2))
                if y == y0 + 6: t = 1
                c.put(x, y, S[t])
    if v == 1:
        for x, y in ((12, 76), (50, 74), (22, 79)):
            c.put(x, y, S[5]); c.put(x + 1, y, S[4]); c.put(x, y + 1, S[3]) ; c.put(x + 1, y + 1, S[3])
    outline(c)
    tree = (TR.pine(0, 0), TR.pine(1, 1), TR.pine(3, 1))[v % 3]
    for yy in range(tree.h):                      # 반투명 그림자는 받침 위에서 건너뛴다(섞이면 허용 밖 색)
        for xx in range(tree.w):
            px = tree.a[yy, xx]
            if px[3] == 0 or (px[3] < 255 and c.a[yy + 4, xx, 3] == 255):
                continue
            c.a[yy + 4, xx] = px
    return c


def lantern_big():
    """궁 석등 16×32: 네모 받침 두 단 + 팔각 간주석 + 불창(주황 불빛) + 넓은 옥개석 + 보주. 정면 소품."""
    c = Cv(T, 2 * T)
    S = RGB['stone']; O = RGB['persimmon']
    ground_shadow(c, 9, 30, 6, 1.5, 70)
    slab(c, 1, 25, 14, 3, 3, S, (6, 5), (5, 4, 3, 2))
    slab(c, 3, 21, 10, 2, 2, S, (6, 5), (5, 4, 3, 2))
    for y in range(14, 21):
        hw = 2 if 16 <= y <= 18 else 1
        for x in range(8 - hw - 1, 8 + hw + 1):
            c.put(x, y, S[5] if x < 8 - hw // 2 else (S[4] if x < 8 + hw // 2 else S[3]))
    slab(c, 3, 11, 10, 2, 2, S, (6, 5), (5, 4, 3, 2))
    for y in range(5, 11):
        for x in range(4, 12):
            c.put(x, y, S[5] if x < 6 else (S[4] if x < 10 else S[3]))
    for y in range(6, 10):
        for x in (6, 7, 8, 9):
            c.put(x, y, O[5] if y < 8 else O[4])
    c.hl(6, 10, 6, O[6])
    for dy, (a, b) in enumerate(((4, 12), (2, 14), (1, 15))):
        for x in range(a, b):
            c.put(x, 2 + dy, S[6] if x < 8 else S[5])
    for x in range(0, 16):
        c.put(x, 5, S[5] if x < 6 else (S[4] if x < 11 else S[3]))
        c.put(x, 6, S[4] if x < 6 else (S[3] if x < 11 else S[2]))
    for y in (0, 1):
        c.put(7, y, S[6]); c.put(8, y, S[5])
    outline(c)
    return c


def haetae():
    """해태(獬豸) 석상 32×32: 3/4 로 보이는 네모 대좌 위에 앉은 정면 사자꼴, 물결 갈기·외뿔·성난 눈썹."""
    c = Cv(2 * T, 2 * T)
    S = RGB['stone']
    ground_shadow(c, 18, 30, 12, 1.8, 70)
    box(c, 5, 25, 22, 4, 6, S, (6, 5), (5, 4, 3, 2))                  # 대좌
    # 몸: 어깨에서 앞다리까지
    for y in range(16, 25):
        hw = 6 if y < 19 else 8
        for x in range(16 - hw, 16 + hw):
            f = (x - (16 - hw)) / (2.0 * hw)
            c.put(x, y, S[5] if f < 0.3 else (S[4] if f < 0.65 else S[3]))
    for y in range(19, 25):                                            # 앞다리 사이 그늘
        for x in range(14, 19):
            c.put(x, y, S[2] if x in (14, 18) else S[1])
    for x0_ in (8, 19):                                                # 발: 위가 밝고 발가락 틈
        for x in range(x0_, x0_ + 5):
            c.put(x, 24, S[6] if x0_ < 16 else S[4])
        c.put(x0_ + 1, 24, S[3]); c.put(x0_ + 3, 24, S[3])
    # 갈기: 반지름이 물결치는 큰 덩이
    def mane(x, y, u, v):
        ang = math.atan2(v, u)
        rr = u * u + v * v
        lim = (0.86 + 0.12 * math.sin(ang * 7)) ** 2
        if rr > lim: return None
        t = 5 if u < -0.35 else (4 if u < 0.35 else 3)
        if (x + y * 2) % 4 == 0: t -= 1
        return S[max(2, t)]
    ell(c, 16, 11, 11, 10, mane)
    # 얼굴
    def face(x, y, u, v):
        return S[6] if (u < -0.25 and v < 0.0) else (S[5] if u < 0.35 else S[4])
    ell(c, 16, 12, 6, 6, face)
    for dx, sx in ((11, 1), (21, -1)):                                  # 성난 눈썹과 눈
        c.put(dx, 8, S[1]); c.put(dx + sx, 8, S[1]); c.put(dx + 2 * sx, 9, S[1]); c.put(dx + 3 * sx, 9, S[1])
        c.put(dx + sx, 10, S[1]); c.put(dx + 2 * sx, 10, S[1])
    c.rect(14, 12, 19, 14, S[4])                                       # 주둥이 덩이
    c.put(15, 12, S[1]); c.put(17, 12, S[1])                           # 콧구멍
    c.hl(12, 21, 14, S[1]); c.hl(13, 20, 15, S[1])                     # 벌린 입
    c.put(13, 15, S[6]); c.put(20, 15, S[6]); c.put(15, 14, S[6]); c.put(18, 14, S[6])   # 송곳니
    for y in range(0, 5):                                              # 외뿔
        c.put(15, y, S[6]); c.put(16, y, S[5])
        if y > 1:
            c.put(14, y, S[5]); c.put(17, y, S[3])
    outline(c)
    return c


def deumeu():
    """드므(큰 청동 항아리) 16×32: 낮은 돌 받침 위에 넓은 입 청동 독, 물 담긴 입, 양쪽 고리."""
    c = Cv(T, 2 * T)
    S = RGB['stone']; B = RGB['wood']; Wt = RGB['water']; P = RGB['persimmon']
    ground_shadow(c, 9, 30, 7, 1.8, 70)
    slab(c, 2, 26, 12, 3, 2, S, (6, 5), (5, 4, 3, 2))
    # 독 몸통: 아래로 좁아지는 둥근 배
    cx = 8
    for y in range(12, 27):
        t = (y - 12) / 14.0
        hw = int(round(7.2 - 2.0 * (t ** 1.8)))
        if y < 14: hw = 7
        for x in range(cx - hw, cx + hw):
            f = (x - (cx - hw)) / max(1, 2 * hw - 1)
            tone = 5 if f < 0.25 else (4 if f < 0.55 else (3 if f < 0.85 else 2))
            if rnd(x, y, 63) > 0.93: tone = min(6, tone + 1)
            if y in (14, 15, 16) and f > 0.9: tone = 3
            c.put(x, y, B[tone])
    for y in range(18, 22):                                           # 띠 장식
        for x in range(cx - 7, cx + 7):
            if c.a[y, x, 3] and (x + y) % 3 == 0:
                c.put(x, y, B[6] if x < cx else B[3])
    # 입(타원) + 물
    def mouth(x, y, u, v):
        if u * u + v * v > 0.62:
            return B[6] if (u < 0.2 and v < 0.3) else B[5]
        return Wt[2] if v < -0.1 else Wt[3]
    ell(c, 8, 12, 8, 3.6, mouth)
    for x in range(5, 11):
        pass
    c.put(6, 12, Wt[5]); c.put(7, 12, Wt[4]); c.put(10, 13, Wt[4])
    for side in (-1, 1):                                              # 고리
        xx = cx + side * 8
        c.put(xx, 15, P[5] if side < 0 else P[3]); c.put(xx, 16, P[4] if side < 0 else P[2]); c.put(xx, 17, P[3] if side < 0 else P[1])
    outline(c)
    return c


def censer():
    """향로 16×32: 돌 원통 받침 위 세 발 청동 향로, 위로 오르는 연기."""
    c = Cv(T, 2 * T)
    S = RGB['stone']; P = RGB['persimmon']; Pl = RGB['plaster']
    ground_shadow(c, 9, 30, 7, 1.8, 70)
    cyl(c, 8, 22, 6, 6, S, (6, 5), (5, 4, 3, 2))                      # 받침
    # 세 발
    for x in (4, 7, 11):
        for y in range(18, 22):
            c.put(x, y, P[3] if x < 9 else P[1]); c.put(x + 1, y, P[2])
    # 몸통
    cyl(c, 8, 13, 6, 5, P, (5, 4), (4, 3, 2, 1))
    for x in range(3, 14):                                            # 어깨 띠
        if c.a[16, x, 3]:
            c.put(x, 16, P[5] if x < 8 else P[2])
    c.put(2, 13, P[3]); c.put(13, 13, P[1])
    # 뚜껑 + 꼭지
    for y in range(8, 11):
        for x in range(5 + (10 - y), 11 - (10 - y) + 0):
            c.put(x, y, P[5] if x < 8 else P[3])
    c.rect(7, 6, 9, 8, P[5]); c.put(8, 5, P[6])
    # 연기
    sm = [(8, 4), (9, 3), (9, 2), (8, 1), (7, 0)]
    for i, (x, y) in enumerate(sm):
        if i >= 1:
            c.put(x, y, Pl[4]); c.put(x + 1 if i % 2 else x - 1, y, Pl[3])
    outline(c)
    return c


# ---------------------------------------------------------------- 랜드마크 탑형 건물
def _spire(cv, cx, y0):
    """상륜: 가는 철대 + 둥근 보주 세 개 + 꼭지."""
    P = RGB['persimmon']; S = RGB['stone']
    for y in range(y0 + 6, y0 + 22):
        cv.put(cx - 1, y, S[5]); cv.put(cx, y, S[4])
    for k, (yy, rr) in enumerate(((y0 + 10, 3), (y0 + 15, 4), (y0 + 20, 5))):
        for x in range(cx - rr, cx + rr):
            f = (x - (cx - rr)) / max(1, 2 * rr - 1)
            cv.put(x, yy, P[5] if f < 0.4 else (P[4] if f < 0.75 else P[3]))
            cv.put(x, yy + 1, P[3] if f < 0.4 else P[2])
    cv.put(cx - 1, y0 + 3, P[6]); cv.put(cx, y0 + 3, P[5])
    cv.put(cx - 1, y0 + 4, P[5]); cv.put(cx, y0 + 4, P[4])
    cv.put(cx - 1, y0 + 5, P[4]); cv.put(cx, y0 + 5, P[3])
    cv.put(cx - 1, y0, P[6]); cv.put(cx - 1, y0 + 1, P[5]); cv.put(cx - 1, y0 + 2, P[5])


def _court_floor(cv, x0, x1, y0, y1, kind='orange'):
    """작은 포장 마당 바닥."""
    S = RGB['stone']; P = RGB['persimmon']; E = RGB['earth']
    for y in range(y0, y1):
        for x in range(x0, x1):
            q = rnd(x, y, 777)
            if kind == 'orange':
                col = P[3] if q > 0.15 else P[2]
                if q > 0.93: col = P[4]
                if (y - y0) % 8 == 0 or (x - x0 + ((y - y0) // 8) * 8) % 16 == 0: col = P[2] if q > 0.5 else P[1]
            else:
                col = S[4] if q > 0.16 else S[3]
                if q > 0.9: col = S[5]
                if (y - y0) % 8 == 0 or (x - x0 + ((y - y0) // 8) * 8) % 16 == 0: col = S[3]
            cv.put(x, y, col)
    if kind == 'gray':                                                  # 마름모 무늬
        mx = (x0 + x1) // 2
        for k in range(0, 7):
            for dx in (-k, k):
                cv.put(mx + dx, y0 + 6 + k, E[4]); cv.put(mx + dx, y0 + 6 + 12 - k, E[4])
    # 가장자리 경계석
    for x in range(x0, x1):
        cv.put(x, y1 - 1, S[3]); cv.put(x, y1 - 2, S[5])
    for y in range(y0, y1):
        cv.put(x0, y, S[5]); cv.put(x1 - 1, y, S[3])


def tower(bays=5, ramp='dblue', col='red', glass='paper', court_kind='orange', trim=True, tiers=3):
    """탑형 다층 지붕 건물(술사의 길·예식장형): 위로 갈수록 좁아지는 지붕 층 + 상륜, 낮은 돌 기단, 작은 포장 마당.
    bays = 맨 아래층 벽 칸 수(홀수), 위층은 2칸씩 줄어든다. 폭 = bays+4 칸."""
    spans = [max(1, bays - 2 * i) for i in range(tiers)]
    wing = [26, 22, 18][:tiers]
    Rs = [3, 2, 2][:tiers]
    ts = []
    for i, b in enumerate(spans):
        ku = ('l' + 'w' * (b - 2) + 'r') if b >= 2 else 'r'
        if b >= 3 and i == 0:
            ku = 'l' + 'w' * ((b - 3) // 2) + 'd' + 'w' * ((b - 3) // 2) + 'r' if (b - 3) % 2 == 0 else ku
        kb = ku.replace('w', 'f')
        if i == 0:
            ts.append(tier(b, Rs[i], ramp, wing[i], ku, kb, col, 'plaster', glass, dan=True, trim=trim, base=True, rows='ub'))
        else:
            ts.append(tier(b, Rs[i], ramp, wing[i], ku, None, col, 'plaster', glass, dan=True, trim=trim, base=False, rows='u', railing=False))
    PW = (bays + 4) * T
    sink = 18
    ytops = [0] * tiers
    # 맨 위층부터 y 계산(맨 아래층 윗줄 y = 마지막)
    y = 26
    ys = []
    for i in range(tiers - 1, -1, -1):
        ys.append(y)
        # 다음(아래) 층 윗줄 = 이 층 아랫선 - sink
        y = y + ts[i].h - sink
    ys = ys[::-1]
    base_bottom = ys[0] + ts[0].h
    H = base_bottom + 56
    H = ((H + T - 1) // T) * T
    cv = Cv(PW, H)
    _court_floor(cv, 0, PW, base_bottom - 12, H - 4, court_kind)
    # 낮은 돌 기단 (아래층 밑): 면 8px
    S = RGB['stone']
    _courses(cv, 10, base_bottom, PW - 10, base_bottom + 9, 4, 8)
    for x in range(10, PW - 10):
        cv.put(x, base_bottom + 8, S[1])
    _stairs(cv, PW // 2, base_bottom + 9, 36, 3, 3, 3, 12)
    for i in range(tiers):
        cv.paste(ts[i], (PW - ts[i].w) // 2, ys[i])
    _spire(cv, PW // 2, 0)
    outline(cv)
    ground_shadow(cv, PW // 2 + 6, base_bottom + 14, PW // 2 - 12, 2, 60)
    return cv


# ---------------------------------------------------------------- 목록
def terrain():
    return {
        'palace_court': [court(v) for v in range(3)],
        'palace_court16': [court_edge(m) for m in range(16)],
    }


def objects():
    return {
        'palace_hall_5': palace_hall(5),
        'palace_hall_wide_8': palace_hall_wide(8),
        'palace_haenggak_3': haenggak(3),
        'palace_hall_7': palace_hall(7),
        'palace_hall_5g': palace_hall(5, 'dgreen', 'teal', 'persimmon'),
        'palace_jeongak_a': jeongak(5, 0),
        'palace_jeongak_b': jeongak(4, 1),
        'palace_jeongak_c': jeongak(5, 2),
        'palace_haengnak_6': haengnak_piece(6, 'both'),
        'palace_haengnak_mid_4': haengnak_piece(4, 'none'),
        'palace_wall_h': pwall_h(0),
        'palace_wall_h1': pwall_h(1),
        'palace_wall_h2': pwall_h(2),
        'palace_wall_v': pwall_v(False),
        'palace_wall_v_e': pwall_v(True),
        'palace_wall_nw': pwall_corner('NW'),
        'palace_wall_ne': pwall_corner('NE'),
        'palace_wall_sw': pwall_corner('SW'),
        'palace_wall_se': pwall_corner('SE'),
        'palace_gate_4': palace_gate(4),
        'palace_eodo': eodo('v'),
        'palace_eodo_end': eodo('end'),
        'palace_pond_4': pond(4, 3),
        'palace_pond_6': pond(6, 3),
        'palace_pine_a': pine_bed(0),
        'palace_pine_b': pine_bed(1),
        'palace_pine_c': pine_bed(2),
        'palace_lantern': lantern_big(),
        'palace_haetae': haetae(),
        'palace_deumeu': deumeu(),
        'palace_censer': censer(),
        'tower_sulsa_5': tower(5, 'dblue', 'red', 'paper', 'orange'),
        'tower_yesik_7': tower(7, 'dblue', 'persimmon', 'teal', 'gray', trim=True),
    }
