#!/usr/bin/env python3
"""jp_city 주택 조립 키트 — 기준 집(ref_house.py, 사용자 승인 2026-10-06)의 부품을 칸 단위 레시피로 조립한다.
  python3 scripts/content/jp-city/houses/house_kit.py OUT_DIR
레시피 = 폭(칸) · 층 목록(층마다 벽 재료와 칸 위치에 놓을 부품) · 층 사이(下屋/띠/발코니) · 지붕 형식.
모든 수치는 modern-style-bible(한 층 32px, 문 16x28, 창 파인 구멍, 빛 왼쪽 위, 윤곽 sumi)과 기준 집을 따른다."""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from ref_house import (K, Cv, OL, hip_roof, eave, lean_to, siding, eave_shadow, sash, genkan,  # noqa: E402
                       foundation, porch, balcony, ac_unit, hero, tree, gravel, blit)

C = 16
MARGIN = 8            # 캔버스 좌우 여백(처마 4 + 윤곽)


# ─────────────────────────── 벽 재료 ───────────────────────────
def wall(c, x, y, w, h, mat, base, kind):
    """kind: siding(가로 판) · plaster(모르타르 뿜칠) · vboard(세로 금속 골판) · board(옛 목재 판자)."""
    if kind == 'siding':
        siding(c, x, y, w, h, mat, base)
    elif kind == 'plaster':
        for j in range(h):
            for i in range(w):
                v = ((x + i) * 5 + (y + j) * 11) % 23
                c.P(x + i, y + j, K(mat, base + (1 if v == 0 else -1 if v == 7 else 0)))
        c.VL(x, y, h, K(mat, base + 1))
    elif kind == 'vboard':
        for i in range(w):
            t = base - 1 if i % 4 == 0 else base + 1 if i % 4 == 1 else base
            c.VL(x + i, y, h, K(mat, t))
    elif kind == 'board':
        for i in range(w):
            t = base - 2 if i % 6 == 0 else base + 1 if i % 6 == 1 else base
            c.VL(x + i, y, h, K(mat, t))
        for j in range(4, h, 9): c.HL(x, y + j, w, K(mat, base - 1))
    c.VL(x + w - 1, y, h, K(mat, base - 2))
    c.VL(x - 1, y, h, OL); c.VL(x + w, y, h, OL)


def belt(c, x, y, w, mat='conc'):
    """층 사이 띠(幕板) 4px + 그림자 3px."""
    c.HL(x - 1, y, w + 2, K(mat, 2)); c.R(x - 1, y + 1, w + 2, 2, K(mat, 1)); c.HL(x - 1, y + 3, w + 2, K(mat, -2))
    c.VL(x - 2, y, 4, OL); c.VL(x + w + 1, y, 4, OL)


# ─────────────────────────── 1층 부품 ───────────────────────────
def garage(c, x, y, h, w=40):
    """빌트인 차고: 8px 물러선 감실 + 셔터(가로 살 2px)."""
    c.R(x, y, w, h, K('tekko', -2)); c.R(x, y, w, 3, K('sumi', 1)); c.VL(x, y, h, K('sumi', 1))
    sx, sw = x + 3, w - 6
    for j in range(y + 4, y + h):
        k = (j - y - 4) % 3
        c.HL(sx, j, sw, K('tekko', 2 if k == 0 else 1 if k == 1 else -1))
    c.VL(sx, y + 4, h - 4, K('tekko', 3)); c.VL(sx + sw - 1, y + 4, h - 4, K('tekko', -1))
    c.R(sx + sw // 2 - 3, y + h - 4, 6, 2, K('tekko', -2))   # 손잡이
    c.VL(x - 1, y, h, OL)


def entry_door(c, x, y, h=28, mat='ita'):
    """감실 없는 현관문 16x28(아파트·狭小住宅): 위 2px 처마 그늘, 문턱."""
    c.R(x, y, 16, h, K(mat, -2)); c.R(x + 1, y + 1, 14, h - 1, K(mat, 0))
    for j in range(y + 4, y + h, 5): c.HL(x + 1, j, 14, K(mat, -1))
    c.R(x + 11, y + 13, 2, 5, K('tekko', 3))
    c.R(x + 3, y + 3, 3, 6, K('garasu', 0)); c.P(x + 3, y + 3, K('garasu', 2))
    c.VL(x - 1, y, h, OL); c.VL(x + 16, y, h, K(mat, -3)); c.HL(x - 1, y + h, 18, K('hodo', 2))


def lattice_door(c, x, y, w=32, h=28):
    """옛 목조집 격자 미닫이(格子戸)."""
    c.R(x, y, w, h, K('ita', -2)); c.R(x + 1, y + 1, w - 2, h - 2, K('kinari', 1))
    for i in range(x + 2, x + w - 1, 3): c.VL(i, y + 1, h - 2, K('ita', -1))
    for j in range(y + 5, y + h - 1, 7): c.HL(x + 1, j, w - 2, K('ita', -1))
    c.VL(x + w // 2, y, h, K('ita', -3)); c.R(x, y, w, 2, K('ita', -3))
    c.VL(x - 1, y, h, OL); c.HL(x - 1, y + h, w + 2, K('hodo', 2))


# ─────────────────────────── 지붕 ───────────────────────────
def gable_side(c, x0, x1, ytop, yeave, mat, base):
    """平入り 切妻: 능선이 길과 나란하다. 앞 경사면 = 사각형, 양 끝은 처마 끝선(破風)만."""
    for y in range(ytop, yeave):
        k = (y - ytop) % 4
        up = 1 if (y - ytop) < (yeave - ytop) * 0.45 else 0
        for x in range(x0, x1 + 1):
            t = base + up
            if k == 3: t -= 2
            elif k == 0: t += 1
            elif (x + (2 if (y - ytop) // 4 % 2 else 0)) % 4 == 0: t -= 1
            c.P(x, y, K(mat, t))
        c.P(x0, y, K('shiro', 1)); c.P(x0 + 1, y, K(mat, base + 2)); c.P(x1, y, K('shiro', -1)); c.P(x1 - 1, y, K(mat, base - 2))  # 破風 끝
        c.P(x0 - 1, y, OL); c.P(x1 + 1, y, OL)
    c.HL(x0 - 1, ytop - 3, x1 - x0 + 3, OL)
    c.HL(x0, ytop - 2, x1 - x0 + 1, K(mat, base + 3)); c.HL(x0, ytop - 1, x1 - x0 + 1, K(mat, base - 1))
    eave(c, x0 - 1, x1 + 1, yeave, mat, base)


def gable_front(c, x0, x1, yb, rise, depth, mat, base, wmat, wbase, wkind):
    """妻入り 切妻: 길 쪽으로 삼각 박공벽. 경사면은 박공 위로 depth 만큼 뒤로 물러난 띠(남북 줄 = 세로 골).
    왼쪽 경사 밝게, 오른쪽 어둡게. 박공 판(破風板) 2px."""
    xc = (x0 + x1) // 2
    # 박공벽(삼각)
    for y in range(yb - rise, yb):
        half = (y - (yb - rise)) * (xc - x0) / rise
        a, b = round(xc - half), round(xc + half)
        for x in range(a, b + 1):
            v = (x * 5 + y * 11) % 23 if wkind == 'plaster' else 1
            t = wbase - 1 if (wkind == 'siding' and (y - yb) % 4 == 0) else wbase + (1 if v == 0 else 0)
            c.P(x, y, K(wmat, t))
    # 경사면 띠
    for x in range(x0 - 4, x1 + 5):
        if x <= xc:
            ey = yb - rise * (x - (x0 - 4)) / (xc - (x0 - 4))
            lit = 2
        else:
            ey = yb - rise * ((x1 + 4) - x) / ((x1 + 4) - xc)
            lit = -1
        ey = round(ey)
        for y in range(ey - depth, ey + 1):
            k = (x - x0) % 4
            t = base + lit + (1 if k == 0 else -1 if k == 2 else 0)
            if y >= ey - 1: t = base - 3            # 처마 밑면
            c.P(x, y, K(mat, t))
        c.P(x, ey - depth - 1, OL); c.P(x, ey + 1, OL)
        # 破風板(흰 판 2px)
        c.P(x, ey - 1, K('shiro', 1 if x <= xc else -1)); c.P(x, ey, K('shiro', 0 if x <= xc else -1))
    for y in range(yb - rise - depth - 1, yb - rise + 1):
        c.P(xc, y, K(mat, base + 3)); c.P(xc + 1, y, K(mat, base - 2))      # 능선(세로)
    c.VL(x0 - 5, yb - depth - 1, depth + 3, OL); c.VL(x1 + 5, yb - depth - 1, depth + 3, OL)
    # 박공 환기창
    c.R(xc - 3, yb - rise + 12, 7, 5, K('tekko', -1)); c.HL(xc - 3, yb - rise + 12, 7, K('tekko', 2))
    for i in range(xc - 2, xc + 4, 2): c.VL(i, yb - rise + 13, 4, K('tekko', 1))


def shed(c, x0, x1, ytop, yeave, mat, base):
    """片流れ: 뒤로 올라가는 한 장 경사(금속 골판 = 세로 줄). 앞 처마는 얇은 판금 + 물받이."""
    for y in range(ytop, yeave):
        for x in range(x0, x1 + 1):
            t = base + (1 if (y - ytop) < 3 else 0) + (1 if x % 4 == 1 else -1 if x % 4 == 3 else 0)
            c.P(x, y, K(mat, t))
        c.P(x0 - 1, y, OL); c.P(x1 + 1, y, OL); c.P(x1, y, K(mat, base - 2))
    c.HL(x0 - 1, ytop - 1, x1 - x0 + 3, OL); c.HL(x0, ytop, x1 - x0 + 1, K(mat, base + 3))
    c.HL(x0 - 1, yeave, x1 - x0 + 3, K('tekko', 3)); c.HL(x0 - 1, yeave + 1, x1 - x0 + 3, K('tekko', 0))   # 물받이
    c.HL(x0 - 1, yeave + 2, x1 - x0 + 3, K('tekko', -2)); c.HL(x0 - 2, yeave + 3, x1 - x0 + 5, OL)
    c.VL(x0 - 2, yeave, 3, OL); c.VL(x1 + 2, yeave, 3, OL)


def flat_roof(c, x0, x1, ytop, yb, mat='conc', items=()):
    """陸屋根: 윗면 = 밑면 깊이(D*16) · 난간 캡 · 안쪽 그늘 · 옥상 기물."""
    c.R(x0, ytop, x1 - x0 + 1, yb - ytop, K(mat, 0))
    for y in range(ytop + 3, yb, 8): c.HL(x0 + 3, y, x1 - x0 - 5, K(mat, -1)); c.HL(x0 + 3, y + 1, x1 - x0 - 5, K(mat, 1))   # 방수 시트 이음
    for x in range(x0 + 12, x1 - 3, 24): c.VL(x, ytop + 3, yb - ytop - 6, K(mat, -1))
    c.R(x0 + 4, yb - 6, 3, 2, K('tekko', -2))                                                         # 배수구
    c.R(x0, ytop, x1 - x0 + 1, 3, K(mat, 3)); c.HL(x0, ytop + 3, x1 - x0 + 1, K(mat, -1))       # 뒤 난간 캡
    c.R(x0, ytop, 3, yb - ytop, K(mat, 2)); c.R(x1 - 2, ytop, 3, yb - ytop, K(mat, 0))            # 옆 난간
    c.VL(x0 + 3, ytop + 3, yb - ytop - 3, K(mat, -1))
    c.HL(x0, yb - 3, x1 - x0 + 1, K(mat, 3)); c.R(x0, yb - 2, x1 - x0 + 1, 2, K(mat, 2))           # 앞 캡
    c.HL(x0 - 1, ytop - 1, x1 - x0 + 3, OL); c.VL(x0 - 1, ytop, yb - ytop, OL); c.VL(x1 + 1, ytop, yb - ytop, OL)
    for kind, ix in items:
        ix += x0
        if kind == 'tank':
            c.R(ix, ytop + 5, 10, 9, K('shiro', 1)); c.HL(ix, ytop + 5, 10, K('shiro', 2)); c.VL(ix + 9, ytop + 5, 9, K('shiro', -1))
            c.HL(ix, ytop + 14, 11, K(mat, -1)); c.HL(ix - 1, ytop + 4, 12, OL)
        elif kind == 'ac':
            ac_unit(c, ix, ytop + 12)
        elif kind == 'hatch':
            c.R(ix, ytop + 6, 14, 12, K('conc', 2)); c.HL(ix, ytop + 6, 14, K('conc', 3)); c.R(ix + 3, ytop + 9, 8, 9, K('tekko', -1))
            c.HL(ix, ytop + 18, 15, K(mat, -2)); c.HL(ix - 1, ytop + 5, 16, OL)


def slab_shadow(c, x, y, w, wmat, wbase):
    c.HL(x, y, w, K(wmat, wbase - 3)); c.HL(x, y + 1, w, K(wmat, wbase - 2)); c.HL(x, y + 2, w, K(wmat, wbase - 1))


# ─────────────────────────── 아파트 부품 ───────────────────────────
def corridor(c, x0, x1, yfloor, mat='tekko'):
    """외부 복도: 바닥 슬래브 앞면 4 + 난간 11(살 3px)."""
    ry = yfloor - 11
    c.HL(x0, ry, x1 - x0 + 1, K(mat, 3)); c.HL(x0, ry + 1, x1 - x0 + 1, K(mat, 0))
    for x in range(x0, x1 + 1, 3):
        c.VL(x, ry + 2, 9, K(mat, 1)); c.VL(x + 1, ry + 2, 9, K(mat, -2)) if x + 1 <= x1 else None
    c.HL(x0, yfloor - 1, x1 - x0 + 1, K(mat, -1))
    c.HL(x0, yfloor, x1 - x0 + 1, K('conc', 2)); c.R(x0, yfloor + 1, x1 - x0 + 1, 2, K('conc', 0)); c.HL(x0, yfloor + 3, x1 - x0 + 1, OL)
    c.HL(x0 - 1, ry - 1, x1 - x0 + 3, OL); c.VL(x0 - 1, ry - 1, yfloor - ry + 5, OL); c.VL(x1 + 1, ry - 1, yfloor - ry + 5, OL)


def ext_stair(c, x, ytop, ybot, depth=12):
    """철골 바깥 계단(벽을 따라 오른쪽 위로 오른다). 3/4: 디딤판 윗면(세로 depth) 이 사선 띠로 이어지고,
    앞 옆판(stringer)이 띠 아래, 앞 손잡이가 디딤판 위로 겹친다. 챌판은 옆면이라 안 보인다 → 단 경계는 1px 그늘."""
    n = max(1, (ybot - ytop) // 4)
    for k in range(n):
        sx = x + k * 4; sy = ybot - (k + 1) * 4
        c.R(sx, sy - depth, 4, depth, K('tekko', 2))
        c.HL(sx, sy - depth, 4, K('tekko', 3))
        if k: c.VL(sx, sy - depth + 1, depth - 1, K('tekko', 0))
        c.R(sx, sy, 4, 3, K('tekko', -1)); c.HL(sx, sy + 3, 4, K('tekko', -2))
        c.HL(sx, sy - depth - 1, 4, OL); c.HL(sx, sy + 4, 4, OL)
    c.VL(x - 1, ybot - 4 - depth, depth + 5, OL); c.VL(x + n * 4, ybot - n * 4 - depth - 1, depth + 6, OL)
    for i in range(n * 4):                                   # 앞 손잡이(사선) + 기둥
        hy = ybot - (i // 4 + 1) * 4 - 9 - (i % 4 > 1)
        c.P(x + i, hy, K('tekko', 3)); c.P(x + i, hy + 1, K('tekko', -1))
        if i % 8 == 2: c.VL(x + i, hy + 2, 7, K('tekko', 0))


# ─────────────────────────── 조립 ───────────────────────────
def build(r):
    """레시피 r → (Cv, meta). r 키: w(칸), floors([{h, mat, base, kind, items:[(부품, 칸x, ...)]}] 아래층부터),
    joins([(종류, 옵션)] 층 사이, 아래부터), roof((종류, 옵션))."""
    W = r['w'] * C
    X0 = MARGIN + 4
    X1 = X0 + W - 1
    floors, joins, roof = r['floors'], r.get('joins', []), r['roof']
    # 세로 배치(위 → 아래 거꾸로 계산)
    hgt = {'lean': 16, 'lean_bal': 16, 'belt': 4, 'none': 0, 'corridor': 4}
    roof_h = {'hip': 32, 'gable_side': 30, 'gable_front': 40, 'shed': 22, 'flat': 32, 'none': 0}[roof[0]]
    total = 6 + roof_h + 4 + sum(f['h'] for f in floors) + sum(hgt[j[0]] for j in joins) + 4 + 10
    cv = Cv(W + 2 * MARGIN + 8, total)
    y = 6 + roof_h + 4                                   # 맨 위층 벽 시작
    ys = []
    for i in range(len(floors) - 1, -1, -1):
        ys.append(y); y += floors[i]['h']
        if i > 0: y += hgt[joins[i - 1][0]]
    ys = ys[::-1]                                        # ys[i] = i 층 벽 시작
    yf = ys[0] + floors[0]['h']                          # 기초 시작
    # 벽 + 부품
    for i, f in enumerate(floors):
        fy, fh = ys[i], f['h']
        wall(cv, X0, fy, W, fh, f['mat'], f['base'], f['kind'])
        slab_shadow(cv, X0, fy, W, f['mat'], f['base'])
        for it in f.get('items', []):
            kind, cx = it[0], X0 + it[1] * C
            if kind == 'sash':       # ('sash', 칸, 폭, 높이, x오프셋, y오프셋, curtain, shutter)
                sash(cv, cx + it[4], fy + it[5], it[2], it[3], f['mat'], f['base'], curtain=it[6], shutter=it[7])
            elif kind == 'genkan':
                genkan(cv, cx, fy, f['mat'], f['base'])
            elif kind == 'door':
                entry_door(cv, cx + it[2], fy + fh - 28 - 1)
            elif kind == 'garage':
                garage(cv, cx, fy, fh, it[2])
            elif kind == 'lattice':
                lattice_door(cv, cx, fy + fh - 29, it[2], 28)
            elif kind == 'ac':
                ac_unit(cv, cx + it[2], fy + fh - 9)
            elif kind == 'grille':
                for gx in range(cx + it[2] + 1, cx + it[2] + it[3] - 1, 2): cv.VL(gx, fy + it[4] + 1, it[5] - 2, K('tekko', 3))
    foundation(cv, X0, yf, W, vents=r.get('vents', ()))
    cv.VL(X0 - 1, yf, 4, OL); cv.VL(X1 + 1, yf, 4, OL); cv.HL(X0 - 1, yf + 4, W + 2, OL)
    # 층 사이
    for i, (kind, opt) in enumerate(joins):
        jy = ys[i + 1] + floors[i + 1]['h']
        if kind in ('lean', 'lean_bal'):
            skip = ()
            if kind == 'lean_bal':
                bx0, bx1 = X0 + opt['bal'][0] * C, min(X1 + 4, X0 + opt['bal'][1] * C - 1)
                skip = ((bx0, bx1),)
            lean_to(cv, X0 - 4, X1 + 4, jy, jy + 12, r['rmat'], r['rbase'], skip=skip)
            if kind == 'lean_bal':
                balcony(cv, bx0, bx1, jy, jy + 12, 0, 0, 0)
        elif kind == 'belt':
            belt(cv, X0, jy, W, opt.get('mat', 'conc') if opt else 'conc')
        elif kind == 'corridor':
            corridor(cv, X0, X1, jy)
    # 지붕
    top = ys[-1]
    rk, ro = roof
    if rk == 'hip':
        hip_roof(cv, X0 - 4, X1 + 4, 6 + 4, top - 4, ro.get('run', 34), r['rmat'], r['rbase'])
    elif rk == 'gable_side':
        gable_side(cv, X0 - 4, X1 + 4, 6 + 4, top - 4, r['rmat'], r['rbase'])
    elif rk == 'gable_front':
        f = floors[-1]
        gable_front(cv, X0, X1, top, ro.get('rise', 26), ro.get('depth', 12), r['rmat'], r['rbase'], f['mat'], f['base'], f['kind'])
    elif rk == 'shed':
        shed(cv, X0 - 3, X1 + 3, top - roof_h + 2, top - 4, r['rmat'], r['rbase'])
    elif rk == 'flat':
        flat_roof(cv, X0, X1, top - roof_h, top, ro.get('mat', 'conc'), ro.get('items', ()))
    for p in r.get('porch', ()):
        porch(cv, X0 + p[0], yf + 1, p[1])
    if 'stair' in r:
        sx, fl = r['stair']
        jy = ys[fl + 1] + floors[fl + 1]['h']
        ext_stair(cv, X0 + sx * C, jy, yf + 4, 14)
    return cv, dict(ground=yf + 4, x0=X0, x1=X1)


# ─────────────────────────── 레시피 ───────────────────────────
RECIPES = {
    # A. 기준 집(寄棟 2층, 下屋 + 발코니) — ref_house 와 같은 구성
    'hip2': dict(w=7, rmat='tairu', rbase=0, roof=('hip', {'run': 34}), 
                 floors=[dict(h=30, mat='kinari', base=1, kind='siding',
                              items=[('genkan', 0, ), ('sash', 3, 32, 24, 0, 5, True, False), ('sash', 5, 12, 10, 10, 8, False, False),
                                     ('grille', 5, 10, 12, 8, 10), ('ac', 5, 0)]),
                         dict(h=28, mat='kinari', base=1, kind='siding',
                              items=[('sash', 0, 24, 14, 12, 8, False, True), ('sash', 3, 32, 22, 14, 6, True, True)])],
                 joins=[('lean_bal', {'bal': (3, 8)})], porch=[(-2, 28)]),
    # B. 妻入り 切妻 2층 + 빌트인 차고(좁은 5칸)
    'gable2_garage': dict(w=5, rmat='yoru', rbase=0, roof=('gable_front', {'rise': 26, 'depth': 12}),
                          floors=[dict(h=30, mat='shiro', base=0, kind='siding',
                                       items=[('garage', 0, 44), ('door', 3, 6)]),
                                  dict(h=28, mat='shiro', base=0, kind='siding',
                                       items=[('sash', 0, 24, 14, 8, 8, False, True), ('sash', 3, 16, 14, 4, 8, True, True)])],
                          joins=[('belt', {'mat': 'conc'})], porch=[(50, 20)]),
    # C. 寄棟 단층(平屋) 넓은 8칸, 縁側 유리 미닫이
    'hip1': dict(w=8, rmat='kawara', rbase=-1, roof=('hip', {'run': 40}),
                 floors=[dict(h=30, mat='kinari', base=0, kind='plaster',
                              items=[('lattice', 0, 32), ('sash', 3, 48, 24, 0, 5, True, True), ('sash', 6, 16, 12, 6, 8, False, True)])],
                 joins=[], porch=[(-2, 36)]),
    # D. 片流れ 2층 모던(금속 세로 골판 + 흰 모르타르)
    'shed2': dict(w=6, rmat='tekko', rbase=-1, roof=('shed', {}),
                  floors=[dict(h=30, mat='shiro', base=0, kind='plaster',
                               items=[('door', 0, 8), ('sash', 2, 40, 22, 4, 6, True, False), ('ac', 5, 2)]),
                          dict(h=28, mat='tekko', base=-1, kind='vboard',
                               items=[('sash', 0, 32, 10, 10, 10, False, False), ('sash', 4, 12, 18, 4, 6, False, False)])],
                  joins=[('belt', {'mat': 'tekko'})], porch=[(6, 22)]),
    # E. 3층 陸屋根 협소주택 + 빌트인 차고
    'flat3': dict(w=5, rmat='conc', rbase=0, roof=('flat', {'mat': 'conc', 'items': (('hatch', 6), ('tank', 50), ('ac', 30))}),
                  floors=[dict(h=30, mat='hodo', base=1, kind='plaster', items=[('garage', 0, 44), ('door', 3, 6)]),
                          dict(h=28, mat='hodo', base=2, kind='plaster', items=[('sash', 0, 40, 16, 6, 6, True, False), ('sash', 3, 16, 14, 8, 7, False, True)]),
                          dict(h=28, mat='hodo', base=2, kind='plaster', items=[('sash', 0, 16, 14, 8, 7, False, True), ('sash', 2, 40, 14, 4, 7, False, True)])],
                  joins=[('belt', {'mat': 'conc'}), ('belt', {'mat': 'conc'})], porch=[(50, 20)]),
    # F. 2층 목조 아파트(아파트 복도 + 바깥 계단)
    'apart2': dict(w=12, rmat='kawara', rbase=-1, roof=('gable_side', {}),
                   floors=[dict(h=30, mat='kinari', base=1, kind='siding',
                                items=[('door', 0, 4), ('sash', 1, 16, 12, 6, 8, False, True), ('door', 3, 4), ('sash', 4, 16, 12, 6, 8, True, True),
                                       ('door', 6, 4), ('sash', 7, 16, 12, 6, 8, False, True)]),
                           dict(h=28, mat='kinari', base=1, kind='siding',
                                items=[('door', 0, 4), ('sash', 1, 16, 12, 6, 6, True, True), ('door', 3, 4), ('sash', 4, 16, 12, 6, 6, False, True),
                                       ('door', 6, 4), ('sash', 7, 16, 12, 6, 6, False, True)])],
                   joins=[('corridor', {})], stair=(9, 0)),
}


def render_all(out):
    import numpy as np
    os.makedirs(out, exist_ok=True)
    res = {}
    for name, r in RECIPES.items():
        cv, m = build(r); cv.save(os.path.join(out, f'{name}.png')); res[name] = (cv, m)
    return res


def street(out, rows=(('hip2', 'gable2_garage', 'hip1'), ('shed2', 'flat3', 'apart2'))):
    """줄마다 집을 1칸 띄워 세우고 블록 담·생활도로·사람 눈금을 깐다."""
    import numpy as np
    built = {n: build(RECIPES[n]) for row in rows for n in row}
    widths = [sum(built[n][0].w for n in row) + 16 * (len(row) + 1) for row in rows]
    rowh = max(built[n][0].h for row in rows for n in row) + 40
    S = Cv(max(widths), rowh * len(rows))
    for ri, row in enumerate(rows):
        oy = ri * rowh
        gravel(S, 0, oy, S.w, rowh - 30, 'hodo', 1)
        S.R(0, oy + rowh - 30, S.w, 30, K('yoru', 0))
        for x in range(S.w):
            for y in range(oy + rowh - 30, oy + rowh):
                if (x * 3 + y * 7) % 11 == 0: S.P(x, y, K('yoru', 1))
        S.HL(0, oy + rowh - 30, S.w, K('yoru', -2)); S.HL(0, oy + rowh - 26, S.w, K('shiro', 2))
        gy = oy + rowh - 34
        hx = 16
        for n in row:
            cv, m = built[n]; a = cv.a; msk = a[:, :, 3] > 0
            top = gy - m['ground']
            for k, y in enumerate(range(gy - 10, gy + 1)):
                for x in range(hx + m['x1'] + 2, hx + m['x1'] + 4 + k // 2): S.P(x, y, K('hodo', -1 if k < 3 else 0))
            S.a[top:top + a.shape[0], hx:hx + a.shape[1]][msk] = a[msk]
            hx += cv.w + 16
        hb = Cv(16, 24); hero(hb, 0, 0)
        blit(S, hb, 60 + ri * 200, gy - 18)
    S.save(out)


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/jp-kit'
    render_all(out)
    street(os.path.join(out, 'street.png'))
    print(out)
