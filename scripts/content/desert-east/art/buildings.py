#!/usr/bin/env python3
"""desert_east 건물 — 평지붕 흙집·사암집·회칠집, 돔 집, 바람탑 집, 가게 집, 2층 집, 첨탑, 둥근 지붕 회당, 궁전, 대상 숙소 문루.

모든 건물: 지붕 윗면 ≥ 2칸(밝은 슬래브 + 난간 테), 앞 벽면 2칸(32px), 아치 문 12~14×24px 은 맨 아랫줄 칸 안(문 칸 = entrance).
문 칸 바로 아래(접근칸)는 구성기가 길로 비워 둔다.
  python3 buildings.py
"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from px import C, rnd, h32
from kit import Reg, contact, OUT
import bparts as BP

R = Reg('buildings')


def B(id_, name, w, h, entrance, tags=(), rules='', kind='structure', **kw):
    return R.add(id_, name, w, h, kind, tags=tags, rules=rules, entrance=list(entrance), **kw)


def house(c, w, roof, mat, door_cells, win_cells=(), s=1, door_style='wood', win_style='lattice', jars=(), hatch=None, rug=None,
          kind=None, beams=True, frame=None):
    """기본 평지붕 집. roof = 지붕 칸 수(윗면). 벽 2칸."""
    W, Hroof = w * 16, roof * 16
    frame = frame or (('plaster', 5) if mat != 'plaster' else ('stone', 5))
    BP.flat_roof(c, 0, 0, W, Hroof, mat, s=s, jars=jars, hatch=hatch, rug=rug)
    BP.wall(c, 0, Hroof, W, 32, mat, s=s, kind=kind)
    if beams and mat == 'adobe': BP.beams(c, 2, Hroof + 3, W - 4, step=7, off=3)
    for dc in door_cells:
        BP.door(c, dc * 16 + 2, Hroof + 8, 12, 24, style=door_style, frame=frame, s=s)
    for wc in win_cells:
        BP.window(c, wc * 16 + 5, Hroof + 9, 6, 9, style=win_style, frame=frame)
    return Hroof


HOUSE_RULE = ('집 하나를 키트로 찍는다. 문 칸(entrance)은 막힘이고 바로 아래 칸(접근칸)은 길·마당 바닥으로 비워 둔다. '
              '집끼리는 1칸 이상 띄우거나 옆벽을 맞붙인 줄집으로 놓는다. 지붕 위(윗면 칸)는 걸을 수 없다.')


@B('house-adobe-3', '흙벽돌 집(작은)', 3, 4, [1], ['집', '흙벽돌', '평지붕'], HOUSE_RULE)
def _(c): house(c, 3, 2, 'adobe', [1], [], s=3, jars=[(30, 9)])


@B('house-adobe-4', '흙벽돌 집', 4, 4, [1], ['집', '흙벽돌', '평지붕'], HOUSE_RULE)
def _(c): house(c, 4, 2, 'adobe', [1], [3], s=5, hatch=(42, 8), rug=(8, 7, 18, 12, 'red'))


@B('house-adobe-5', '흙벽돌 집(넓은, 마당 지붕)', 5, 5, [2], ['집', '흙벽돌', '평지붕'], HOUSE_RULE)
def _(c): house(c, 5, 3, 'adobe', [2], [0, 4], s=7, jars=[(8, 8), (14, 8)], rug=(40, 22, 22, 14, 'saffron'), win_style='shutter')


@B('house-stone-4', '사암 집', 4, 4, [2], ['집', '사암', '평지붕'], HOUSE_RULE)
def _(c): house(c, 4, 2, 'stone', [2], [0], s=9, kind='stone', jars=[(48, 7)], door_style='turq')


@B('house-plaster-4', '회칠 흰 집', 4, 4, [1], ['집', '회칠', '평지붕'], HOUSE_RULE)
def _(c): house(c, 4, 2, 'plaster', [1], [3], s=11, door_style='turq', win_style='shutter', rug=(32, 6, 22, 12, 'lapis'))


@B('house-plaster-3', '회칠 흰 집(작은)', 3, 4, [1], ['집', '회칠', '평지붕'], HOUSE_RULE)
def _(c): house(c, 3, 2, 'plaster', [1], [], s=19, door_style='wood', jars=[(6, 8)], hatch=(32, 9))


@B('house-stone-5', '사암 집(넓은, 창 둘)', 5, 5, [2], ['집', '사암', '평지붕'], HOUSE_RULE)
def _(c): house(c, 5, 3, 'stone', [2], [0, 4], s=23, kind='stone', door_style='turq', win_style='lattice', jars=[(10, 10), (62, 9)], rug=(30, 14, 20, 14, 'red'))


@B('house-dome-4', '돔 지붕 사암 집', 4, 5, [1], ['집', '돔', '사암'], HOUSE_RULE + ' 돔은 지붕 위 장식이라 막힌다.')
def _(c):
    # 지붕 3칸 중 위 1칸은 돔이 솟는 자리(투명 배경)
    sub = C(64, 64); house(sub, 4, 2, 'stone', [1], [3], s=13, kind='stone', door_style='wood')
    c.paste(sub, 0, 16)
    BP.dome(c, 40, 36, 11, 'turq', ry=13, drum=5, drum_mat='plaster')


@B('house-dome-white', '흰 돔 회칠 집', 3, 5, [1], ['집', '돔', '회칠'], HOUSE_RULE)
def _(c):
    sub = C(48, 64); house(sub, 3, 2, 'plaster', [1], [], s=17, door_style='turq')
    c.paste(sub, 0, 16)
    BP.dome(c, 24, 36, 12, 'plaster', ry=14, drum=4, drum_mat='plaster', ribs=False)


@B('house-2f', '2층 사암 집(나무 격자 발코니)', 4, 6, [1], ['집', '2층', '사암', '마슈라비야'], HOUSE_RULE)
def _(c):
    W = 64
    BP.flat_roof(c, 0, 0, W, 32, 'stone', s=21, jars=[(46, 8)])
    BP.wall(c, 0, 32, W, 64, 'stone', s=21, kind='stone')
    # 층 띠(가운데 돌림띠: 윗면 밝게 + 밑 그늘)
    c.HL(0, 62, W, 'stone', 6); c.HL(0, 63, W, 'stone', 4); c.HL(0, 64, W, 'stone', 1)
    BP.window(c, 5, 40, 6, 10, style='lattice')
    # 나무 격자 돌출 창(마슈라비야): 윗면(작은 지붕) + 격자 앞면 + 받침 까치발 + 벽 그림자
    x0, y0, bw = 28, 36, 22
    c.R(x0 + 1, y0, bw - 2, 3, 'dwood', 4); c.HL(x0, y0 + 3, bw, 'dwood', 3)
    c.HL(x0 + 1, y0, bw - 2, 'dwood', 2)
    for j in range(y0 + 4, y0 + 19):
        for i in range(x0, x0 + bw):
            lx, ly = i - x0, j - y0 - 4
            t = 2 if (lx + ly) % 3 == 0 or (lx - ly) % 3 == 0 else 0
            if lx in (0, bw - 1) or ly in (0, 14): t = 3 if lx == 0 else 1 if lx == bw - 1 else 3
            c.P(i, j, 'dwood' if t else 'void', t if t else 1)
    c.HL(x0, y0 + 19, bw, 'dwood', 3); c.HL(x0 + 1, y0 + 20, bw - 2, 'dwood', 1)
    for k in (x0 + 3, x0 + bw - 5):
        c.R(k, y0 + 21, 2, 3, 'dwood', 2); c.P(k + 1, y0 + 23, 'dwood', 1)
    c.R(x0 + bw, y0 + 5, 1, 18, 'stone', 1)                  # 돌출 창이 벽에 던진 그림자(오른쪽)
    c.HL(x0 + 2, y0 + 24, bw - 2, 'stone', 1)
    BP.door(c, 18, 72, 12, 24, style='wood')
    BP.window(c, 53, 74, 6, 9, style='shutter')


@B('house-shop', '가게 집(줄무늬 차양)', 4, 5, [2], ['집', '가게', '차양', '바자르'], HOUSE_RULE + ' 가게 앞 차양 아래 칸은 문 접근칸과 같은 줄이다.')
def _(c):
    W = 64
    BP.flat_roof(c, 0, 0, W, 32, 'adobe', s=25, hatch=(8, 8))
    BP.wall(c, 0, 32, W, 48, 'adobe', s=25)
    BP.beams(c, 2, 35, 60, step=7)
    # 가게 앞 열린 진열 칸(어두운 안 + 선반 물건)
    c.R(4, 52, 24, 24, 'void', 1); c.HL(4, 52, 24, 'void', 0)
    for sy, items in ((57, ('adobe', 'saffron', 'turq')), (65, ('red', 'adobe', 'gold'))):
        c.HL(5, sy + 4, 22, 'wood', 3); c.HL(5, sy + 5, 22, 'wood', 1)
        for k, ix in enumerate(range(6, 26, 4)):
            m = items[k % 3]
            c.R(ix, sy, 3, 4, m, 3); c.HL(ix, sy, 3, m, 4 if m != 'gold' else 5); c.P(ix + 2, sy + 2, m, 1)
    c.R(3, 72, 26, 4, 'wood', 3); c.HL(3, 72, 26, 'wood', 5); c.HL(3, 75, 26, 'wood', 1)      # 진열대 판
    BP.door(c, 34, 56, 12, 24, style='curtain', s=1)
    BP.window(c, 53, 58, 6, 9, style='lattice')
    BP.awning(c, 1, 44, 47, depth=6, front=4, col='red')
    for j in range(54, 57):
        for i in range(2, 47):
            g = c.get(i, j)
            if g and g[0] != 'red' and g[0] != 'plaster': c.P(i, j, g[0], max(0, g[1] - 1))
    c.R(1, 45, 1, 14, 'wood', 2); c.R(46, 45, 1, 14, 'wood', 1)       # 차양 기둥


@B('house-windtower', '바람탑 집', 4, 6, [1], ['집', '바람탑', '사암'], HOUSE_RULE + ' 바람탑은 지붕 뒤에 솟는다.')
def _(c):
    sub = C(64, 64); house(sub, 4, 2, 'plaster', [1], [3], s=29, door_style='wood', win_style='lattice')
    c.paste(sub, 0, 32)
    # 탑: x 34..58, 꼭대기 윗면 y 0..6, 앞면 y 7..44(지붕 위로)
    x0, x1 = 36, 58
    tw = x1 - x0
    c.R(x0, 0, tw, 6, 'stone', 6); c.HL(x0, 0, tw, 'stone', 2); c.HL(x0, 5, tw, 'stone', 5)
    c.R(x0 + 2, 1, tw - 4, 3, 'stone', 5)
    BP.wall_tex(c, x0, 6, tw, 40, 'stone', 'stone', 31)
    c.VL(x0, 0, 46, 'stone', 1); c.VL(x0 + 1, 6, 40, 'stone', 5); c.VL(x1 - 1, 0, 46, 'stone', 0); c.VL(x1 - 2, 6, 40, 'stone', 2)
    c.HL(x0, 6, tw, 'stone', 2)
    for k in range(4):                         # 바람 구멍(세로 틈) 4개
        vx = x0 + 3 + k * 5
        c.R(vx, 9, 3, 14, 'void', 1); c.HL(vx, 9, 3, 'void', 0); c.VL(vx + 3, 9, 14, 'stone', 5)
        c.HL(vx, 23, 3, 'stone', 6)
    c.HL(x0, 26, tw, 'stone', 6); c.HL(x0, 27, tw, 'stone', 2)
    c.HL(x0 - 1, 46, tw + 2, 'stone', 1)      # 지붕과 만나는 접지 그늘


# ═════════════ 3/4 부품: 원통(윗면 타원·둥근 띠), 윗면 판 ═════════════
def cyl(c, cx, yt, yb, r, mat, ry=None, r_bot=None, bands=(), cap='flat', cap_mat=None, s=0, tex=None):
    """3/4 원통(위에서 비스듬히): 몸 앞면(왼쪽 빛) + 밑선은 타원 앞 호(가운데가 아래로 처진다) + 띠도 같은 호 + 위 끝 타원 윗면.
    cx = 가운데(화소 경계), yt = 윗면 타원 중심 y, yb = 밑 타원 중심 y. r_bot 을 주면 위로 좁아지는 탑.
    cap: 'flat'(밝은 윗면 판) · 'crenel'(성가퀴 고리 + 안 바닥) · None."""
    T = BP.top(mat); rb = r_bot if r_bot is not None else r
    ry = ry if ry is not None else max(2.0, r * 0.42)
    ryb = ry * rb / r
    for Y in range(int(yt), int(yb + ryb) + 2):
        f = min(1.0, max(0.0, (Y - yt) / max(1.0, yb - yt)))
        rY = r + (rb - r) * f
        for X in range(int(cx - rb - 1), int(cx + rb + 2)):
            u = (X + 0.5 - cx) / rY
            if abs(u) > 1: continue
            ub = (X + 0.5 - cx) / rb
            if abs(ub) > 1: continue
            arc_b = ryb * math.sqrt(max(0.0, 1 - ub * ub))
            if Y > yb + arc_b: continue
            t = T - 1 if u < -0.45 else T - 2 if u < 0.2 else T - 3 if u < 0.65 else T - 4
            if u < -0.82: t = T - 2
            if u > 0.9: t = 1
            if tex == 'stone' and rnd(X, Y, s) < 0.07: t -= 1
            if tex == 'adobe' and rnd(X // 2, Y // 2, s) < 0.08: t -= 1
            ryY = ry * rY / r
            arc = ryY * math.sqrt(max(0.0, 1 - u * u))
            for b in bands:
                by_ = int(round(b + arc))
                if Y == by_: t = max(1, t - 2)
                elif Y == by_ + 1: t = min(T, t + 1)
            if Y >= yb + arc_b - 0.99: t = 1
            c.P(X, Y, mat, max(0, min(T, t)))
    if cap: cyl_cap(c, cx, yt, r, ry, cap_mat or mat, cap)


def cyl_cap(c, cx, yt, r, ry, mat, cap='flat'):
    """원통 위 끝의 타원 윗면(위에서 내려다본 면)."""
    T = BP.top(mat)
    def flat(x, y, dx, dy, d):
        if d > 0.78 and dy < 0: return (mat, T - 3)                 # 뒤 가장자리(어두운 선)
        if d > 0.72 and dy > 0.2: return (mat, T)                   # 앞 모서리(밝음)
        t = T - 1 if dx < 0.25 else T - 2
        return (mat, t)
    def crenel(x, y, dx, dy, d):
        if d > 0.86 and dy < 0: return (mat, T - 3)
        if d > 0.5:                                                  # 성가퀴 고리 윗면
            ang = math.atan2(dy, dx); k = int((ang + math.pi) / (math.pi / 6))
            merl = k % 2 == 0
            if dy > 0.1 and d > 0.82: return (mat, T if merl else T - 2)
            return (mat, T - 1 if merl else T - 3)
        if d > 0.32 and dy < 0: return (mat, T - 4)                  # 고리 안벽(뒤, 그늘)
        return (mat, T - 2 if rnd(x, y, 5) > 0.1 else T - 3)        # 안 바닥
    c.ell(cx, yt, r, ry, flat if cap == 'flat' else crenel)


def slab_top(c, x, y, w, h, mat, s=0, grid=8, crenel_front=False, crenel_back=True, sides=True):
    """위에서 내려다본 두꺼운 윗면 판(성벽 길·문루 지붕): 뒤 성가퀴 + 포석(가로·세로 줄눈 격자) + 앞 성가퀴(이 윗면 밝게) + 좌우 테."""
    T = BP.top(mat)
    for j in range(h):
        for i in range(w):
            X, Y = x + i, y + j
            t = T - 1 if rnd(X, Y, s) > 0.07 else T - 2
            if i % grid == grid - 1 or j % 6 == 5: t = T - 2            # 포석 줄눈(가지런한 격자 = 위에서 본 바닥)
            if rnd(X // 3, Y // 3, s + 4) < 0.05: t = T
            c.P(X, Y, mat, t)
    c.HL(x, y, w, mat, 1)
    if crenel_back:
        for i in range(w):
            merl = ((x + i) // 4) % 2 == 0
            c.P(x + i, y + 1, mat, T if merl else T - 3); c.P(x + i, y + 2, mat, T - 1 if merl else T - 3)
            c.P(x + i, y + 3, mat, T - 4 if merl else T - 3)
    if sides:
        for j in range(h):
            merl = ((y + j) // 4) % 2 == 0
            c.P(x, y + j, mat, 1); c.P(x + 1, y + j, mat, T if merl else T - 2); c.P(x + 2, y + j, mat, T - 4)
            c.P(x + w - 1, y + j, mat, 0); c.P(x + w - 2, y + j, mat, T - 2 if merl else T - 4); c.P(x + w - 3, y + j, mat, T - 2)
    if crenel_front:
        for i in range(w):
            merl = ((x + i) // 4) % 2 == 0
            c.P(x + i, y + h - 4, mat, T - 4 if merl else T - 2)
            c.P(x + i, y + h - 3, mat, T if merl else T - 3); c.P(x + i, y + h - 2, mat, T - 1 if merl else T - 3)
    c.HL(x + 1, y + h - 1, w - 2, mat, T)                     # 앞 모서리(밝은 선)


def tile_floor(c, x, y, w, h, mat='plaster', a=5, b=4, cell=6, s=0):
    """지붕 테라스 바닥 타일(위에서 본 바둑판 + 줄눈) — 가지런한 격자 = 위에서 내려다본 바닥."""
    for j in range(h):
        for i in range(w):
            X, Y = x + i, y + j
            if i % cell == cell - 1 or j % cell == cell - 1: t = b - 1
            else: t = a if ((i // cell) + (j // cell)) % 2 == 0 else b
            c.P(X, Y, mat, t)


def cast_shadow(c, x, y, w, h, dt=1):
    """위에서 본 바닥에 드리운 그림자(같은 램프 한 단 어둡게)."""
    for j in range(h):
        for i in range(w):
            g = c.get(x + i, y + j)
            if g and g[0] not in ('void',): c.P(x + i, y + j, g[0], max(1, g[1] - dt))


def brighten(c, x, y, w, h, dt=1, mats=('plaster',)):
    """지붕 윗면을 한 단 밝게(회칠 지붕이 벽과 같은 단으로 보이지 않게). 테두리 어두운 선은 둔다."""
    for j in range(h):
        for i in range(w):
            g = c.get(x + i, y + j)
            if g and g[0] in mats and g[1] >= 2: c.P(x + i, y + j, g[0], g[1] + dt)


def darken(c, x, y, w, h, dt=1):
    """벽 앞면을 지붕보다 한 단 더 어둡게(윗면과 앞면 대비)."""
    for j in range(h):
        for i in range(w):
            g = c.get(x + i, y + j)
            if g and g[0] in ('stone', 'plaster', 'adobe') and g[1] > 1: c.P(x + i, y + j, g[0], g[1] - dt)


@B('minaret', '첨탑(미너렛)', 2, 7, [], ['첨탑', '탑', '랜드마크'], '마을 랜드마크. 회당·광장 곁 한 곳에만. 문 없음(장식).', kind='column')
def _(c):
    cx = 16
    # 기단(네모 받침): 위에서 본 넓은 윗면(14줄) + 앞면 — 탑 몸은 윗면 위에 서고, 몸 앞으로 윗면이 보인다
    slab_top(c, 1, 70, 30, 16, 'stone', s=33, grid=7, crenel_back=False, sides=False)
    c.VL(1, 70, 16, 'stone', 3); c.VL(30, 70, 16, 'stone', 2)
    BP.wall_tex(c, 1, 86, 30, 26, 'stone', 'stone', 33); darken(c, 1, 86, 30, 26)
    c.HL(1, 86, 30, 'stone', 1); c.VL(1, 86, 26, 'stone', 1); c.VL(30, 86, 26, 'stone', 0); c.HL(1, 111, 30, 'stone', 0)
    BP.window(c, 13, 94, 6, 9, style='lattice', frame=('stone', 6))
    # 아랫몸(원통): 띠는 타원 앞 호
    cyl(c, cx, 40, 78, 9, 'stone', ry=4, bands=(48, 58, 68), cap=None, s=33, tex='stone')
    for X in range(cx - 9, cx + 9):
        u = (X + 0.5 - cx) / 9; arc = 4 * math.sqrt(max(0, 1 - u * u))
        for k in range(5):
            Y = int(round(60 + arc)) + k
            t = 3 if (X + k) % 4 < 2 else 2
            if abs(u) > 0.7: t -= 1
            c.P(X, Y, 'turq', t)
    # 발코니(고리): 앞면 + 위에서 본 바닥과 난간 고리
    cyl(c, cx, 34, 38, 14, 'stone', ry=6, cap='crenel', s=35)
    # 윗몸(회칠) — 발코니 바닥 위에 선다
    cyl(c, cx, 15, 35, 6, 'plaster', ry=2.6, bands=(24,), cap='flat', s=37)
    for y in (19, 26): c.R(cx - 1, y, 2, 4, 'void', 1)
    # 꼭대기 작은 발코니 + 양파 돔
    cyl(c, cx, 13, 15, 8, 'stone', ry=3.4, cap='flat')
    BP.onion(c, cx, 12, 6, 10, 'turq', drum=0)


@B('domed-hall', '둥근 지붕 회당(큰 돔·아치 문루)', 6, 6, [2, 3], ['회당', '돔', '목욕탕', '랜드마크'],
   '광장 북쪽 한가운데. 문은 두 칸(entrance 2·3) — 그 아래 두 칸을 광장 포석으로 비운다. 회당·목욕탕(하맘) 외관으로 쓴다.')
def _(c):
    # 평지붕(윗면 3칸) + 앞 벽 2.4칸
    BP.flat_roof(c, 0, 4, 96, 54, 'stone', s=41, jars=[(8, 10), (14, 12), (80, 40)], hatch=(76, 12))
    BP.wall(c, 0, 58, 96, 38, 'stone', s=41, kind='stone'); darken(c, 0, 60, 96, 36)
    for wx in (10, 79): BP.window(c, wx, 70, 7, 11, style='lattice')
    # 돔: 지붕 뒤쪽 위에 얹힌 둥근 북(윗면 턱 타원) + 반구
    cyl(c, 48, 26, 30, 22, 'plaster', ry=7, cap='flat', s=41)
    BP.dome(c, 48, 27, 19, 'turq', ry=19, drum=0)
    # 앞으로 튀어나온 문루(이완): 위에서 본 두꺼운 지붕 판 + 앞면
    BP.pishtaq(c, 28, 46, 40, 50, door_w=14, mat='stone', s=41)
    BP.flat_roof(c, 28, 34, 40, 14, 'stone', s=43)
    c.HL(28, 48, 40, 'stone', 1)


@B('palace', '궁전(양파 돔·아치 회랑·모서리 탑)', 10, 8, [4, 5], ['궁전', '양파 돔', '랜드마크'],
   '궁전 마당 북쪽 가운데. 문은 두 칸(entrance 4·5) — 아래 두 칸과 그 앞 마당을 포석으로. 양옆 2칸 이상 띄운다.')
def _(c):
    # 날개(좌우): 깊은 평지붕 윗면(3.5칸) + 낮은 아치 회랑 앞면(2칸)
    for x0 in (14, 112):
        BP.flat_roof(c, x0, 40, 34, 56, 'stone', s=43)
        BP.roof_rug(c, x0 + 8, 54, 16, 14, 'red' if x0 < 80 else 'lapis')
        if x0 > 80: cast_shadow(c, x0 + 1, 41, 7, 52)                   # 본채가 오른 날개 지붕에 드리운 그림자
        for (jx, jy) in ((5, 8), (25, 38)): BP.roof_jar(c, x0 + jx, 40 + jy)
        BP.wall(c, x0, 96, 34, 32, 'plaster', s=43); darken(c, x0, 98, 34, 30, 2)
        for k in range(3):
            ax = x0 + 3 + k * 10
            m = BP.pointed_mask(8, 18, rise=6)
            BP.fill_mask(c, ax, 104, m, lambda i, j, m=m: ('plaster', 5) if BP.mask_border(m, i, j) and i == 0 else ('void', 1 if j < 6 else 2))
            c.VL(ax + 8, 102, 22, 'plaster', 2)
        c.HL(x0, 99, 34, 'turq', 3); c.HL(x0, 100, 34, 'turq', 1)
    # 가운데 본채: 깊은 평지붕 윗면 + 앞면
    BP.flat_roof(c, 46, 14, 68, 74, 'stone', s=47)
    BP.roof_hatch(c, 50, 70, 'stone'); BP.roof_jar(c, 104, 70); BP.roof_jar(c, 52, 24)
    BP.wall(c, 46, 88, 68, 40, 'plaster', s=47); darken(c, 46, 90, 68, 38, 2)
    BP.tile_band(c, 47, 92, 66, 3, 1)
    # 금 양파 돔: 지붕 위 둥근 북(윗면 턱 타원) 위에
    c.ell(88, 54, 20, 7, lambda x, y, dx, dy, d: None if not c.on(x, y) else (c.get(x, y)[0], max(1, c.get(x, y)[1] - 1)))   # 돔 그림자
    cyl(c, 80, 46, 50, 18, 'plaster', ry=6, cap='flat', s=47)
    BP.onion(c, 80, 47, 16, 26, 'gold', drum=0)
    for sx in (58, 102):
        cyl(c, sx, 30, 34, 6, 'plaster', ry=2.6, cap='flat')
        BP.onion(c, sx, 30, 5, 10, 'turq', drum=0)
    # 문루(이완): 위에서 본 지붕 판 + 앞면
    BP.pishtaq(c, 62, 76, 36, 52, door_w=14, mat='plaster', s=47)
    BP.flat_roof(c, 62, 62, 36, 14, 'stone', s=49); brighten(c, 63, 63, 34, 12, mats=('stone',))
    c.HL(62, 76, 36, 'plaster', 1)
    # 모서리 탑(원통, 날개 지붕 높이까지): 둥근 띠 + 꼭대기 성가퀴 고리(위에서 본 바닥) + 작은 양파 돔
    for cx in (8, 152):
        cyl(c, cx, 58, 122, 7, 'plaster', ry=3, bands=(80, 102), cap=None, s=51)
        for y in (86, 106): c.R(cx - 1, y, 2, 6, 'void', 1)
        cyl(c, cx, 52, 58, 8, 'plaster', ry=5, cap='crenel', s=53)
        BP.onion(c, cx, 50, 3, 9, 'turq', drum=0)


# ═════════════ 성벽 조립 부품(대상 숙소·도성·궁전 담) ═════════════
WALL_RULE = ('성벽 조립 부품. 구성기가 사각 둘레로 놓는다: 북·남 벽은 wall-h(가로, 3칸 높이 = 윗길 1 + 벽면 2), 동·서 벽은 wall-v(세로, 위에서 본 성가퀴 길), '
             '네 모서리는 wall-tower, 문은 wall-gate(가운데 두 칸 통로는 걸을 수 있다). 낱칸으로 칠하지 않는다.')


def battlement_top(c, x, y, w, mat='stone', s=0):
    """가로 성벽 윗길(16px): 뒤 성가퀴(작은 이) + 걷는 길 + 앞 성가퀴(이의 윗면 + 앞면)."""
    T = BP.top(mat)
    c.R(x, y, w, 16, mat, 4)
    for i in range(w):
        X = x + i
        c.P(X, y, mat, 1)
        # 뒤 성가퀴 이(4 주기, 높이 3)
        if (X // 4) % 2 == 0: c.P(X, y + 1, mat, T); c.P(X, y + 2, mat, T - 1)
        else: c.P(X, y + 1, mat, 2); c.P(X, y + 2, mat, 3)
        # 걷는 길(사암 판, 결)
        for j in range(3, 9):
            t = 4 if rnd(X, y + j, s) > 0.1 else 3
            if (X + (j // 3) * 3) % 8 == 7: t = 3
            c.P(X, y + j, mat, t)
        c.P(X, y + 3, mat, 3)
        # 앞 성가퀴: 이는 윗면(밝음) 2 + 앞면 4, 틈은 그늘
        if (X // 4) % 2 == 0:
            c.P(X, y + 9, mat, T); c.P(X, y + 10, mat, T - 1)
            for j in range(11, 16): c.P(X, y + j, mat, 3 if (X % 4) else 4)
        else:
            c.P(X, y + 9, mat, 2); c.P(X, y + 10, mat, 2)
            c.P(X, y + 11, mat, T - 1)
            for j in range(12, 16): c.P(X, y + j, mat, 3)
    c.HL(x, y + 15, w, mat, 2)


@B('wall-h', '사암 성벽(가로)', 1, 3, [], ['성벽', '대상 숙소', '도성'], WALL_RULE, kind='structure')
def _(c):
    battlement_top(c, 0, 0, 16, s=51)
    BP.wall_tex(c, 0, 16, 16, 32, 'stone', 'stone', 51)
    c.HL(0, 16, 16, 'stone', 1); c.HL(0, 46, 16, 'stone', 2); c.HL(0, 47, 16, 'stone', 1)


@B('wall-h-slit', '사암 성벽(가로, 활 구멍)', 1, 3, [], ['성벽', '대상 숙소', '도성'], WALL_RULE, kind='structure')
def _(c):
    battlement_top(c, 0, 0, 16, s=53)
    BP.wall_tex(c, 0, 16, 16, 32, 'stone', 'stone', 53)
    c.HL(0, 16, 16, 'stone', 1); c.HL(0, 46, 16, 'stone', 2); c.HL(0, 47, 16, 'stone', 1)
    c.R(7, 24, 2, 9, 'void', 1); c.P(7, 24, 'void', 0); c.VL(9, 24, 9, 'stone', 5); c.HL(6, 33, 4, 'stone', 6)


@B('wall-v', '사암 성벽(세로, 위에서 본 성가퀴 길)', 2, 1, [], ['성벽', '대상 숙소', '도성'], WALL_RULE + ' 세로로 이어 붙는다(폭 2칸 = 모서리 탑과 같다).', kind='structure')
def _(c):
    # 위에서 본 성벽 윗면: 가운데 성가퀴 길(돌판 이음) + 양쪽 성가퀴(솟은 돌 덩이 — 윗면 밝게, 아래 그늘) + 길 양쪽 낮은 턱 그늘
    for y in range(16):
        for x in range(32):
            t = 4 if rnd(x, y, 55) > 0.12 else 3
            if y % 8 == 7 or (x in (12, 20) and y % 8 < 7 and (y // 8) % 2 == 0): t = 3
            c.P(x, y, 'stone', t)
        for x in (6, 25): c.P(x, y, 'stone', 2)            # 성가퀴 안쪽 턱 그늘
        merl = (y // 4) % 2 == 0
        for x0 in (0, 26):
            for x in range(x0, x0 + 6):
                if merl:
                    t = 6 if (y % 4 == 0) else 5
                    if y % 4 == 3: t = 2
                else:
                    t = 3
                if x == x0: t = min(t, 1) if x0 == 26 else max(t - 1, 1)
                if x == x0 + 5: t = 1 if x0 == 26 else t
                c.P(x, y, 'stone', t)
    c.VL(0, 0, 16, 'stone', 0); c.VL(31, 0, 16, 'stone', 0)


@B('wall-tower', '성벽 모서리 탑', 2, 4, [], ['성벽', '탑', '대상 숙소', '도성'], WALL_RULE + ' 모서리마다 하나. 벽보다 한 줄 높다.', kind='structure')
def _(c):
    # 윗면: 성가퀴 테 둘레 + 안 바닥(1.5칸) / 앞면 2.5칸
    W = 32
    c.R(0, 0, W, 24, 'stone', 4)
    for i in range(W):
        merl = (i // 4) % 2 == 0
        c.P(i, 0, 'stone', 1); c.P(i, 1, 'stone', 6 if merl else 2); c.P(i, 2, 'stone', 5 if merl else 3)
        c.P(i, 20, 'stone', 6 if merl else 3); c.P(i, 21, 'stone', 5 if merl else 3)
        for j in (22, 23): c.P(i, j, 'stone', 3 if merl else 2)
    for j in range(24):
        merl = (j // 4) % 2 == 0
        c.P(0, j, 'stone', 1); c.P(1, j, 'stone', 6 if merl else 3); c.P(2, j, 'stone', 5)
        c.P(W - 1, j, 'stone', 0); c.P(W - 2, j, 'stone', 4 if merl else 2); c.P(W - 3, j, 'stone', 3)
    c.HL(3, 3, W - 6, 'stone', 3); c.VL(3, 3, 17, 'stone', 3)
    for j in range(4, 20):
        for i in range(4, W - 3):
            if rnd(i, j, 57) < 0.07: c.P(i, j, 'stone', 3)
    BP.wall_tex(c, 0, 24, W, 40, 'stone', 'stone', 57)
    c.VL(0, 24, 40, 'stone', 1); c.VL(1, 24, 40, 'stone', 5); c.VL(W - 1, 24, 40, 'stone', 0); c.VL(W - 2, 24, 40, 'stone', 2)
    c.HL(0, 24, W, 'stone', 1); c.HL(0, 25, W, 'stone', 2)
    c.HL(0, 60, W, 'stone', 2); c.HL(0, 62, W, 'stone', 2); c.HL(0, 63, W, 'stone', 1)
    c.R(15, 34, 2, 10, 'void', 1); c.VL(17, 34, 10, 'stone', 5); c.HL(14, 44, 5, 'stone', 6)
    c.HL(0, 48, W, 'stone', 5); c.HL(0, 49, W, 'stone', 2)


@B('wall-gate', '성문(아치 통로)', 4, 4, [], ['성벽', '성문', '대상 숙소', '도성'],
   WALL_RULE + ' 가운데 두 칸(x 1·2)은 통로라 걸어 지나간다(위 두 줄은 머리 위로 그려진다). 성문 앞뒤 칸을 길로 잇는다.', kind='structure',
   passable=[(1, 0), (2, 0), (1, 1), (2, 1), (1, 2), (2, 2), (1, 3), (2, 3)])
def _(c):
    W = 64
    # 문루 윗면(위에서 내려다본 성가퀴 길, 26줄): 둘레 성가퀴 + 포석 격자 — 성벽 모서리 탑과 같은 화법
    BP.flat_roof(c, 0, 0, W, 26, 'stone', s=59, jars=[(50, 8)], hatch=(8, 9))
    for i in range(1, W - 1):                                         # 앞 난간 테 위 성가퀴 이(윗면 밝게)
        if (i // 4) % 2 == 0: c.P(i, 21, 'stone', 6); c.P(i, 22, 'stone', 6)
    for i in range(1, W - 1):
        if (i // 4) % 2 == 0: c.P(i, 1, 'stone', 6); c.P(i, 2, 'stone', 5)
    # 앞면 26..64
    BP.wall_tex(c, 0, 26, W, 38, 'stone', 'stone', 59); darken(c, 0, 26, W, 38, 2)
    c.VL(0, 26, 38, 'stone', 1); c.VL(1, 26, 38, 'stone', 4); c.VL(W - 1, 26, 38, 'stone', 0); c.VL(W - 2, 26, 38, 'stone', 1)
    c.HL(0, 26, W, 'stone', 1); c.HL(0, 27, W, 'stone', 2)
    BP.tile_band(c, 4, 29, W - 8, 3, 2)
    # 통로 아치 x 16..48(두 칸): 아치 안 위쪽 = 둥근 천장 밑면(머리 위), 아래 = 열린 땅(투명)
    m = BP.arch_mask(32, 30, r=16)
    for (i, j) in m:
        X, Y = 16 + i, 34 + j
        if Y >= 64: continue
        c.P(X, Y, None, 0)
    for (i, j) in m:
        for dx, dy in ((-1, 0), (1, 0), (0, -1), (-2, 0), (2, 0), (0, -2), (-1, -1), (1, -1)):
            if (i + dx, j + dy) not in m and 34 + j + dy < 64:
                c.P(16 + i + dx, 34 + j + dy, 'stone', 6 if dx <= 0 else 4)
    for (i, j) in m:
        if j < 16:
            # 천장 밑면: 바깥 테 쪽 밝은 쐐기돌 밑면 → 안쪽 깊은 그늘
            edge = min(abs(i + 0.5 - 16) - 0, 99)
            ring = 16 - math.hypot(i + 0.5 - 16, 16 - (j + 0.5))
            if ring < 3: c.P(16 + i, 34 + j, 'stone', 2)
            else: c.P(16 + i, 34 + j, 'void', 1 if j < 12 else 2)
    for k in (6, 54): c.R(k, 40, 4, 20, 'stone', 1); c.VL(k, 40, 20, 'stone', 3)
    c.HL(0, 62, 16, 'stone', 1); c.HL(48, 62, 16, 'stone', 1); c.HL(0, 63, 16, 'stone', 0); c.HL(48, 63, 16, 'stone', 0)


# ═════════════ 고대 유적: 피라미드·지구라트·오벨리스크 ═════════════
def pyramid(c, W, H, s=0, cap=True, worn=0.0, shadow=None, fit=False):
    """피라미드(3/4 탑뷰, 깊이는 화면 위로): 밑면 앞 모서리 FL·FR, 뒤 모서리 BL·BR(앞 모서리 바로 위 D 화소), 꼭짓점 A.
    보이는 면 = 남쪽 면(FL·FR·A, 돌 단 줄) + 서쪽 면(FL·BL·A, 빛) + 동쪽 면(FR·BR·A, 그늘). 윤곽은 오각형 FL-BL-A-BR-FR.
    shadow = 동쪽에 드리운 땅 그림자 폭(화소, 키트 오른쪽 여백 안)."""
    sw = shadow if shadow is not None else W // 8
    pw = W - sw
    by = H - 1; D = int(H * 0.36); ay = 3
    if fit:                      # 대피라미드와 같은 비율(밑폭 : 높이 = 192 : 140, 뒤 모서리 깊이 = 0.36 H)
        hh = int(round(pw * 140 / 192)); ay = by - hh; D = int(hh * 144 / 140 * 0.36)
    ax = (pw - 1) / 2
    FL, FR, BL, BR, A = (0, by), (pw - 1, by), (0, by - D), (pw - 1, by - D), (ax, ay)

    tread = fit
    def side(p, q, r):
        return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])

    def inside(pt, a, b, c3):
        d1, d2, d3 = side(a, b, pt), side(b, c3, pt), side(c3, a, pt)
        return not ((d1 < 0 or d2 < 0 or d3 < 0) and (d1 > 0 or d2 > 0 or d3 > 0))
    # 땅 그림자(동쪽): FR·BR 에서 동쪽으로 쐐기
    top = by - int(D * 0.75)
    for y in range(top, H):
        u = (y - top) / max(1, by - top)
        reach = sw * (0.15 + 0.85 * u ** 0.8)
        for x in range(pw, pw + int(reach) + 1):
            v = (x - pw) / max(1.0, reach)
            if v > 1: continue
            if v > 0.7 and (x + y) % 2: continue                  # 끝 성긴 점
            c.P(x, y, 'sand', 2 if v < 0.55 else 3)
    for y in range(H):
        for x in range(pw):
            pt = (x + 0.5, y + 0.5)
            if inside(pt, FL, FR, A): face = 'S'
            elif inside(pt, FL, BL, A): face = 'W'
            elif inside(pt, FR, BR, A): face = 'E'
            else: continue
            ly = y % 4; course = y // 4
            if face == 'S' and tread:           # 단마다 디딤 윗면(위에서 본 밝은 2줄) + 챌면 2줄
                t = 6 if ly == 0 else 5 if ly == 1 else 4 if ly == 2 else 3
                off = 3 if course % 2 else 0
                if (x + off) % 7 == 0 and ly in (2, 3): t -= 1
            elif face == 'S':
                t = 4 if ly else 5
                if ly == 3: t = 3
                off = 3 if course % 2 else 0
                if (x + off) % 7 == 0 and ly in (1, 2): t -= 1
            elif face == 'W' and tread:
                t = 6 if ly < 2 else 5
            elif face == 'W':
                t = 6 if ly == 0 else 5
                if ly == 3: t = 4
            elif tread:
                t = 4 if ly < 2 else 3
            else:
                t = 2 if ly == 0 else 1
                if ly == 3: t = 0
            if worn and rnd(x // 3, y // 3, s) < worn and y > H * 0.3: t -= 1
            c.P(x, y, 'stone', max(0, min(6, t)))
    # 능선(남쪽 면의 두 모서리): 서쪽 능선 밝게, 동쪽 능선 어둡게
    for k in range(200):
        u = k / 199
        for (q, t) in ((FL, 6), (FR, 3 if tread else 2)):
            x = A[0] + (q[0] - A[0]) * u; y = A[1] + (q[1] - A[1]) * u
            if c.on(int(x), int(y)): c.P(int(x), int(y), 'stone', t)
    if cap:
        cap_h = max(5, (by - ay) // 8 if fit else H // 8)
        for y in range(ay, ay + cap_h):
            for x in range(pw):
                pt = (x + 0.5, y + 0.5)
                if inside(pt, FL, FR, A): c.P(x, y, 'gold', 5 if x < ax - 1 else 4)
                elif inside(pt, FL, BL, A): c.P(x, y, 'gold', 5)
                elif inside(pt, FR, BR, A): c.P(x, y, 'gold', 2)
    c.HL(0, by, pw, 'stone', 1)


def step_pyramid(c, W, H, tiers, f, t, sh, s=0, shadow=8, worn=0.0, tier_shadow=True):
    """계단 피라미드(3/4 탑뷰): 단마다 위에서 본 테라스 윗면(밝은 판) + 남쪽 앞면(마름돌, 어둡게). 옆으로 물러나는 면 없음.
    tiers = 단 수, f = 앞면 높이, t = 위 단 앞에 보이는 테라스 줄 수, sh = 단마다 양옆으로 들어가는 폭."""
    pw = W - shadow; by = H - 1
    d = t + f                                     # 테라스 깊이(양옆 끝에서 다 보인다)
    # 땅 그림자(동쪽, 단마다 계단꼴)
    for k in range(tiers if tier_shadow else 1):
        x1 = pw - k * sh; base = by - k * (f + t)
        for y in range(max(0, base - f + 1), base + 1):
            reach = min(shadow, int((base - y + 2) * 0.9) + 2)
            for x in range(x1, min(W, x1 + reach)):
                if (x - x1) > reach * 0.7 and (x + y) % 2: continue
                if not c.on(x, y): c.P(x, y, 'sand', 2 if (x - x1) < reach * 0.6 else 3)
    for k in range(tiers):
        x0 = k * sh; x1 = pw - k * sh; w = x1 - x0
        base = by - k * (f + t)
        top0 = base - f - d + 1; top1 = base - f
        for y in range(max(0, top0), top1 + 1):
            for x in range(x0, x1):
                tt = 5
                if y == top1: tt = 6
                elif y == top0: tt = 3
                if worn and rnd(x // 3, y // 2, s) < worn: tt = 4
                c.P(x, y, 'stone', tt)
            c.P(x0, y, 'stone', 4); c.P(x1 - 1, y, 'stone', 3)
        BP.wall_tex(c, x0, top1 + 1, w, f, 'stone', 'stone', s + k)
        darken(c, x0, top1 + 1, w, f)
        c.HL(x0, top1 + 1, w, 'stone', 1)
        c.VL(x0, top1 + 1, f, 'stone', 4); c.VL(x1 - 1, top1 + 1, f, 'stone', 0)
        c.HL(x0, base, w, 'stone', 0)
    # 꼭대기 금 덮개(작은 피라미디온 + 윗면)
    k = tiers; x0 = k * sh; x1 = pw - k * sh; base = by - k * (f + t)
    cw = max(6, x1 - x0); cx0 = (pw - cw) // 2
    for y in range(max(0, base - f - 4), base + 1):
        u = (y - (base - f - 4)) / max(1, f + 4)
        hw = cw / 2 * (0.25 + 0.75 * u)
        for x in range(int(pw / 2 - hw), int(pw / 2 + hw + 0.99)):
            c.P(x, y, 'gold', 5 if x < pw / 2 - 1 else 4 if x < pw / 2 + hw * 0.4 else 2)
    c.HL(int(pw / 2 - cw / 2), base, cw, 'gold', 1)


@B('pyramid-great', '대피라미드(큰)', 14, 9, [], ['피라미드', '유적', '랜드마크'],
   '사막 유적의 중심. 남쪽 면 가운데 아래(밑변 가운데, 그림자 여백 2칸을 뺀 폭 12칸의 가운데)에 «피라미드 입구»(pyramid-door)를 붙여 내부와 잇는다. 오른쪽 2칸은 땅 그림자. 둘레 2칸 비움.')
def _(c): pyramid(c, 224, 144, s=67, shadow=32)


@B('pyramid', '피라미드', 8, 6, [], ['피라미드', '유적', '랜드마크'],
   '대피라미드 곁·작은 유적의 중심. 남쪽 면 가운데 아래에 «피라미드 입구»(pyramid-door)를 붙이면 내부로 잇는다. 오른쪽 1칸은 땅 그림자. 둘레 2칸 비움.')
def _(c): step_pyramid(c, 128, 96, tiers=6, f=7, t=6, sh=8, s=61, shadow=16, tier_shadow=False)


@B('pyramid-small', '작은 피라미드', 4, 3, [], ['피라미드', '유적'], '대피라미드 곁에 한두 개. 둘레 1칸 비움.')
def _(c): step_pyramid(c, 64, 48, tiers=3, f=6, t=6, sh=8, s=63, shadow=8, worn=0.06)


@B('pyramid-door', '피라미드 입구(돌 문틀)', 2, 2, [0, 1], ['피라미드', '입구', '유적'],
   '대피라미드 남쪽 면 가운데 아래(밑변에 맞춰) 겹쳐 찍는다. 문 칸 두 개(entrance) 아래를 포석으로 비우고 내부 맵과 잇는다.')
def _(c):
    # 앞으로 튀어나온 돌 문틀(상자꼴): 매끈한 밝은 윗면 판 12줄(뒤 어둡게 → 앞 밝게) + 어두운 앞면 + 통로(상인방 밑면 그늘 → 안으로 드는 모래 바닥)
    for j in range(1, 13):
        for i in range(1, 31):
            c.P(i, j, 'stone', 5 if j < 10 else 6)
    c.HL(1, 1, 30, 'stone', 3); c.HL(1, 2, 30, 'stone', 4)
    c.ell(9, 7, 5, 2, lambda x, y, dx, dy, d: ('sand', 6))                  # 윗면 위 모래 더미
    BP.wall_tex(c, 1, 13, 30, 18, 'stone', 'stone', 67); darken(c, 1, 13, 30, 18, 2)
    c.HL(1, 13, 30, 'stone', 0); c.HL(1, 14, 30, 'stone', 1)
    for j in range(17, 31):
        for i in range(9, 23):
            u = (j - 17) / 13
            if u < 0.5: c.P(i, j, 'void', 0 if u < 0.25 else 1)
            else: c.P(i, j, 'sand', 1 if u < 0.7 else 2 if u < 0.85 else 3)
    c.HL(9, 17, 14, 'stone', 1)
    c.VL(8, 16, 15, 'stone', 4); c.VL(23, 16, 15, 'stone', 1); c.HL(8, 16, 16, 'stone', 4)
    c.outline(mat='stone', t=0, bottom=('stone', 0))


@B('ziggurat', '지구라트(계단 신전)', 7, 6, [3], ['지구라트', '신전', '유적', '랜드마크'],
   '단이 셋인 계단 신전. 가운데 계단 밑 칸(entrance)이 입구이고 그 아래를 길로 비운다. 둘레 2칸 비움.')
def _(c):
    W = 112
    tiers = [(0, 34, 96, 16, 'adobe'), (14, 18, 68, 14, 'adobe'), (28, 4, 40, 12, 'adobe')]
    # 아래 단부터: (들여쓰기 x, 윗면 y, 앞면 y, ...)
    levels = [(4, 50, 104, 46), (18, 30, 76, 20), (32, 12, 48, 18)]   # (x0, top_y, width, ...)
    specs = [(4, 48, 104, 18, 30), (18, 26, 76, 14, 22), (32, 8, 48, 10, 18)]  # x0, top_y, w, top_h, face_h
    for (x0, ty, w, th, fh) in specs:
        # 윗면(테라스)
        for j in range(th):
            for i in range(w):
                t = 5 if rnd(x0 + i, ty + j, 67) > 0.08 else 4
                if j == 0: t = 2
                if j == 1: t = 6
                c.P(x0 + i, ty + j, 'adobe', t)
        c.VL(x0, ty, th, 'adobe', 2); c.VL(x0 + w - 1, ty, th, 'adobe', 1)
        # 앞면(흙벽돌 단, 세로 버팀벽 줄)
        BP.wall_tex(c, x0, ty + th, w, fh, 'adobe', 'stone', 67)
        for k in range(x0 + 6, x0 + w - 4, 10):
            c.VL(k, ty + th, fh, 'adobe', 4); c.VL(k + 1, ty + th, fh, 'adobe', 2)
        c.HL(x0, ty + th, w, 'adobe', 6); c.HL(x0, ty + th + 1, w, 'adobe', 2)
        c.VL(x0, ty + th, fh, 'adobe', 1); c.VL(x0 + w - 1, ty + th, fh, 'adobe', 0); c.HL(x0, ty + th + fh - 1, w, 'adobe', 1)
    # 꼭대기 사당(작은 집 + 청록 문)
    c.R(42, 0, 28, 6, 'adobe', 6); c.HL(42, 0, 28, 'adobe', 2)
    BP.wall_tex(c, 42, 6, 28, 12, 'adobe', None, 69); c.VL(42, 0, 18, 'adobe', 1); c.VL(69, 0, 18, 'adobe', 0)
    c.R(52, 8, 8, 10, 'turq', 2); c.HL(52, 8, 8, 'turq', 4)
    # 가운데 계단(밑에서 꼭대기 단까지): 디딤 윗면 밝음 + 챌판 어둡게, 양옆 난간
    for y in range(18, 96):
        for x in range(46, 66):
            t = 6 if (y % 3 == 0) else 4 if y % 3 == 1 else 2
            if x in (46, 47): t = 3
            if x in (64, 65): t = 1
            c.P(x, y, 'stone', t)
    c.HL(46, 95, 20, 'stone', 1)


@B('obelisk', '오벨리스크', 1, 3, [], ['오벨리스크', '유적', '광장'], '광장·궁전 문 앞·피라미드 길 양옆에 짝으로. 무늬는 글자 아닌 띠.', kind='column')
def _(c):
    # 비석(de-stele)과 같은 짜임으로: 넓은 받침(윗면 5행) + 가는 네모 몸통 — 몸통 머리 윗면(위에서 본 판 6행, 가운데 금 박은 꼭짓점 자리) + 남쪽 앞면(글자 없는 띠)
    from props import slab
    slab(c, 0, 36, 16, 5, 7, 'stone', s=71)
    slab(c, 2, 1, 12, 8, 31, 'stone', s=77)
    c.VL(2, 9, 31, 'stone', 4); c.VL(13, 9, 31, 'stone', 1)
    c.R(6, 4, 4, 2, 'gold', 4); c.HL(6, 4, 4, 'gold', 5)
    for y in (16, 24, 32):
        c.HL(4, y, 8, 'stone', 1); c.HL(4, y + 1, 8, 'stone', 4)
    c.HL(3, 38, 10, 'stone', 1)
    c.outline(mat=None, bottom=('stone', 0))


# ═════════════ 천막 ═════════════
def tent_body(c, x0, y0, w, ridge_h, wall_h, cloth, stripe=None, open_=True, s=0):
    """천막: 윗면(능선에서 앞으로 내려오는 지붕 천, 위에서 비스듬히 보인다) + 앞 처마 술 + 낮은 앞 휘장(가운데 열린 입구).
    천은 세로 솔기 줄(밝음/어두움), 능선 줄 가장 밝다. 바깥 줄(당김줄)·말뚝."""
    T = BP.top(cloth)
    for j in range(ridge_h):
        u = j / max(1, ridge_h - 1)
        for i in range(w):
            t = T - 1 if u < 0.25 else T - 2 if u < 0.7 else T - 3
            if j == 0: t = T
            if stripe and (i // 4) % 2 == 1: m, tt = stripe, max(0, t - (1 if BP.top(stripe) < T else 0))
            else: m, tt = cloth, t
            if i % 8 == 0: tt = max(0, tt - 1)              # 솔기
            if i == 0: tt = max(0, tt - 1)
            if i == w - 1: tt = max(0, tt - 2)
            c.P(x0 + i, y0 + j, m, min(BP.top(m), tt))
    # 처마 술(물결 끝)
    ey = y0 + ridge_h
    for i in range(w):
        c.P(x0 + i, ey, cloth, 1)
        if i % 3 != 1: c.P(x0 + i, ey + 1, cloth, 2)
    # 앞 휘장
    for j in range(wall_h):
        for i in range(1, w - 1):
            t = 2 if (i // 3) % 2 else 3
            if j == 0: t = 1
            c.P(x0 + i, ey + 2 + j, cloth, t)
    c.HL(x0 + 1, ey + 2 + wall_h - 1, w - 2, cloth, 1)
    if open_:
        dw = 12; dx = x0 + (w - dw) // 2
        for j in range(wall_h + 2):
            for i in range(dw):
                if j < 2 and (i in (0, dw - 1)): continue
                c.P(dx + i, ey + j, 'void', 1 if j < 4 else 2)
        # 걷어 올린 휘장 자락
        c.R(dx - 2, ey + 1, 3, 4, cloth, T - 1); c.R(dx + dw - 1, ey + 1, 3, 4, cloth, T - 2)
        c.HL(dx, ey + 2 + wall_h, dw, 'rug' if False else 'red', 3)          # 입구 깔개
    # 기둥 끝·당김줄·말뚝
    for px_ in (x0 + 1, x0 + w - 2):
        c.VL(px_, y0 - 3, 4, 'wood', 3); c.P(px_, y0 - 4, 'wood', 5)


@B('dovecote', '비둘기 탑(흙벽돌)', 2, 4, [], ['비둘기 탑', '오아시스', '밭', '탑'], '과수원·밭 가장자리 모래 위에 하나. 막힘. 집 줄에는 넣지 않는다.', kind='column')
def _(c):
    """이집트·페르시아 들판의 흙벽돌 비둘기 탑: 둥근 받침(위에서 본 고리 윗면) + 위로 좁아지는 원통(둥근 층 띠·둥지 구멍 줄)
    + 꼭대기 평지붕 타원 윗면(낮은 난간 고리 + 작은 회칠 꼭지)."""
    # 받침: 넓은 원통 + 타원 윗면(탑 앞으로 고리 윗면이 보인다)
    cyl(c, 16, 52, 56, 15.5, 'adobe', ry=6, cap='flat', s=91, tex='adobe')
    # 몸: 위로 좁아진다(밑 r 11 → 위 r 8)
    cyl(c, 16, 10, 53, 8, 'adobe', ry=3.6, r_bot=11, bands=(20, 32, 44), cap=None, s=93, tex='adobe')
    for k, yb in enumerate((14, 26, 38)):
        rr = 8 + (11 - 8) * (yb - 10) / 43
        for n in (-2, -1, 0, 1, 2):
            X = int(16 + n * rr / 2.6) + (k % 2)
            u = (X + 0.5 - 16) / rr
            if abs(u) > 0.8: continue
            Y = int(round(yb + 3.6 * rr / 8 * math.sqrt(1 - u * u)))
            c.R(X, Y, 1, 2, 'void', 1); c.P(X + 1, Y, 'adobe', 2)
            c.P(X, Y + 2, 'wood', 4); c.P(X - 1, Y + 2, 'wood', 4)       # 횃대 끝
    # 꼭대기: 평지붕 타원 윗면 + 낮은 난간 고리 + 회칠 꼭지
    cyl(c, 16, 10, 12, 9, 'adobe', ry=4.6, cap='crenel', s=95)
    cyl(c, 16, 6, 9, 3, 'plaster', ry=1.4, cap='flat')
    c.P(16, 3, 'plaster', 5); c.P(15, 4, 'plaster', 4); c.P(16, 4, 'plaster', 4)


@B('tent-bedouin', '유목 검은 천막', 3, 2, [1], ['천막', '유목', '오아시스'], '오아시스·대상 야영지. 입구 칸(entrance) 아래를 비운다. 천막끼리 1칸 띄운다.')
def _(c):
    """검은 염소털 천막(바이트 샤르): 기둥 셋이 밀어 올린 물결 지붕(윗면) + 처진 처마 + 가운데 걷어 올린 앞 휘장(안쪽 그늘·깔개) + 양옆 당김줄."""
    import math
    W, POLES = 48, (9, 24, 39)
    def top_y(x):                        # 지붕 윗선: 기둥 끝에서 솟고 사이에서 처진다
        d = min(abs(x + 0.5 - p) for p in POLES)
        return 4 + min(4.0, d * d / 14.0)
    def eave_y(x):                       # 처마선: 기둥 사이에서 한 화소 처짐
        d = min(abs(x + 0.5 - p) for p in POLES)
        return 18 + (1 if d > 5 else 0)
    for x in range(2, W - 2):
        ty, ey = top_y(x), eave_y(x)
        d = min(abs(x + 0.5 - p) for p in POLES)
        for y in range(int(math.ceil(ty)), ey):
            u = (y - ty) / max(1.0, ey - ty)
            t = 4 if d < 2.5 and u < 0.5 else 3 if u < 0.35 else 2 if u < 0.8 else 1   # 기둥 끝 주름 밝게, 처마 쪽 어둡게
            if x < 4 or x > W - 5: t -= 1
            c.P(x, y, 'dwood', max(0, t))
            if y == int(math.ceil(ty)): c.P(x, y, 'dwood', min(4, t + 1))
        # 짜 넣은 밝은 띠 두 줄(지붕을 따라 굽는다)
        for k in (0.38, 0.72):
            yy = int(round(ty + (ey - ty) * k))
            c.P(x, yy, 'hide', 2 if k < 0.5 else 1)
        c.P(x, ey, 'dwood', 0)          # 처마 끝 그늘
    # 기둥 끝(천 위로 살짝)
    for px in POLES: c.VL(px, 2, 3, 'wood', 4); c.P(px, 2, 'wood', 5)
    # 앞 휘장: 양옆 닫힘(세로 줄무늬) · 가운데 열림
    for y in range(19, 31):
        for x in range(4, W - 4):
            if 17 <= x <= 30: continue
            t = 2 if (x // 3) % 2 else 1
            if (x // 6) % 4 == 1: c.P(x, y, 'hide', 1); continue
            c.P(x, y, 'dwood', t)
    # 열린 입구: 안쪽 그늘 + 깔개 + 방석
    c.R(17, 19, 14, 12, 'void', 1); c.R(17, 19, 14, 3, 'void', 0)
    c.R(18, 27, 12, 4, 'red', 2); c.HL(18, 27, 12, 'red', 3); c.HL(19, 29, 10, 'saffron', 2)
    c.R(19, 24, 4, 3, 'indigo', 2); c.HL(19, 24, 4, 'indigo', 3)
    # 걷어 올린 앞 처마(가운데) + 받침 기둥 둘
    for x in range(15, 33):
        c.P(x, 18, 'dwood', 3); c.P(x, 19, 'dwood', 2 if x % 4 else 1)
    for px in (16, 31): c.VL(px, 19, 12, 'wood', 3); c.P(px, 30, 'wood', 1)
    # 양옆 당김줄 + 말뚝
    for (x0, y0, x1, y1) in ((4, 8, 0, 25), (43, 8, 47, 25)):
        n = max(abs(x1 - x0), abs(y1 - y0))
        for i in range(n + 1):
            c.P(round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n), 'hide', 1)
    c.R(0, 25, 1, 3, 'wood', 2); c.R(47, 25, 1, 3, 'wood', 2)
    # 아래 바닥선(천 끝 그늘)
    c.HL(4, 31, W - 8, 'dwood', 0)


@B('tent-pavilion', '줄무늬 정자 천막', 3, 3, [1], ['천막', '바자르', '대상', '정자'], '광장·대상 숙소 마당·궁전 정원. 입구 아래를 비운다.')
def _(c):
    """둥근 정자 천막(위에서 비스듬히): 원뿔 지붕 = 꼭짓점에서 처마 타원까지 퍼지는 줄무늬(지붕 면이 넓게 보인다) + 타원 앞 호 처마 술 + 둥근 휘장 벽(밑선도 호)."""
    W = 48; ax, ay = 24.0, 5.0; ex, ey, rx, ry = 24.0, 24.0, 22.5, 9.0
    def eave(x):
        u = (x + 0.5 - ex) / rx
        return ey + ry * math.sqrt(max(0.0, 1 - u * u)) if abs(u) <= 1 else None
    thetas = [k * math.pi / 180 for k in range(-30, 211, 2)]
    pts = [(ex + rx * math.cos(t), ey + ry * math.sin(t), t) for t in thetas]
    for y in range(2, 36):
        for x in range(W):
            px_, py_ = x + 0.5, y + 0.5
            ev = eave(x)
            if ev is None or py_ > ev: continue
            if py_ < ey:            # 위쪽: 꼭짓점과 타원 사이 원뿔 옆선 안쪽인지
                half = rx * (py_ - ay) / (ey - ay) if py_ > ay else -1
                inell = ((px_ - ex) / rx) ** 2 + ((py_ - ey) / ry) ** 2 <= 1
                if abs(px_ - ex) > half and not inell: continue
            # 줄무늬: 이 점을 지나는 꼭짓점→처마 선의 각
            vx, vy = px_ - ax, py_ - ay
            best, bt = 9, 0
            for (qx, qy, t) in pts:
                wx, wy = qx - ax, qy - ay
                n = math.hypot(wx, wy)
                d = abs(vx * wy - vy * wx) / n
                if vx * wx + vy * wy > 0 and d < best: best, bt = d, t
            k = int((bt + math.pi * 0.2) / (math.pi / 9))
            m = 'red' if k % 2 == 0 else 'plaster'
            lit = math.cos(bt)              # 왼쪽(θ≈π) 밝음
            T = BP.top(m)
            t = T - 1 if lit < -0.3 else T - 2 if lit < 0.45 else T - 3
            if m == 'red': t = 4 if lit < -0.3 else 3 if lit < 0.45 else 2
            if py_ < ay + 4: t = min(T, t + 1)
            c.P(x, y, m, max(0, t))
    c.VL(24, 0, 5, 'gold', 3); c.P(24, 0, 'gold', 5); c.P(23, 4, 'gold', 4)
    # 처마 술(앞 호)
    for x in range(1, W - 1):
        ev = eave(x)
        if ev is None: continue
        Y = int(ev)
        c.P(x, Y, 'red', 1)
        if x % 3 != 1: c.P(x, Y + 1, 'saffron', 3)
    # 휘장 벽: 처마 호 밑으로 10줄, 밑선도 호
    for x in range(3, W - 3):
        ev = eave(x)
        if ev is None: continue
        u = (x + 0.5 - 24) / 21
        for j in range(2, 12):
            Y = int(ev) + j
            t = 3 if (x // 4) % 2 else 2
            if u > 0.6: t -= 1
            if j == 11: t = 0
            c.P(x, Y, 'plaster', max(0, t))
    # 가운데 열린 입구 + 걷어 올린 자락
    for x in range(18, 30):
        ev = eave(x)
        for j in range(2, 12): c.P(x, int(ev) + j, 'void', 1 if j < 6 else 2)
    c.R(15, 35, 4, 6, 'red', 3); c.R(29, 35, 4, 6, 'red', 2)
    for x in (3, W - 4):
        ev = eave(x); c.VL(x, int(ev) + 1, 11, 'wood', 3)


@B('tent-small', '작은 천 천막', 2, 2, [], ['천막', '야영'], '야영지·대상 길가. 막힘.', kind='structure')
def _(c):
    """동서 능선 천막(위에서 비스듬히): 능선 뒤 비탈은 가는 띠, 남쪽 비탈 = 위에서 내려다본 넓은 밝은 면(세로 줄무늬) + 처마 술 + 낮은 앞 휘장(닫힌 틈) + 당김줄·말뚝."""
    rx0, rx1, ey = 8.0, 15.0, 20          # 능선 반폭 / 처마 반폭 / 처마 y
    for y in range(2, 5):                 # 뒤 비탈(능선 너머, 그늘)
        for x in range(int(16 - rx0) + 1, int(16 + rx0)):
            c.P(x, y, 'plaster', 2 if y < 4 else 3)
    for y in range(5, ey):
        u = (y - 5) / (ey - 5)
        half = rx0 + (rx1 - rx0) * u
        for x in range(32):
            dx = x + 0.5 - 16
            if abs(dx) > half: continue
            k = int((dx / half) * 3.5 + 3.5)
            m = 'saffron' if k % 2 == 0 else 'plaster'
            T = BP.top(m)
            t = T - 1 if u < 0.6 else T - 2
            if abs(dx) > rx0 + (rx1 - rx0) * u - 2.5 and abs(dx) > rx0: t -= 1 if dx < 0 else 2     # 양 끝 비탈(동쪽 그늘)
            c.P(x, y, m, max(0, t))
    c.HL(8, 5, 16, 'plaster', 5); c.HL(8, 4, 16, 'plaster', 1)           # 능선 줄
    for px_ in (8, 23): c.VL(px_, 1, 4, 'wood', 3); c.P(px_, 1, 'wood', 5)
    for x in range(1, 31):
        c.P(x, ey, 'saffron', 1)
        if x % 3 != 1: c.P(x, ey + 1, 'saffron', 2)
    for y in range(ey + 2, 29):                                          # 낮은 앞 휘장
        for x in range(3, 29):
            c.P(x, y, 'plaster', 2 if (x // 4) % 2 else 3)
    c.VL(16, ey + 2, 7, 'void', 1); c.VL(15, ey + 4, 5, 'plaster', 1)
    c.HL(3, 29, 26, 'plaster', 0)
    for (x0, y0, x1, y1) in ((2, 16, 0, 27), (29, 16, 31, 27)):
        n = max(abs(x1 - x0), abs(y1 - y0))
        for i in range(n + 1): c.P(round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n), 'hide', 1)
    c.R(0, 27, 1, 3, 'wood', 2); c.R(31, 27, 1, 3, 'wood', 2)


# ═════════════ 대상 숙소 문루·폐허 ═════════════
@B('caravanserai-gate', '대상 숙소 문루(이완 통로)', 6, 5, [], ['대상 숙소', '문루', '성벽'],
   '대상 숙소(성벽 사각 둘레)의 남쪽 가운데. 가운데 두 칸(x 2·3)이 통로라 걸어 지나간다 — 앞뒤를 길로 잇는다. 양옆은 wall-h 로 이어진다.',
   passable=[(2, 0), (3, 0), (2, 1), (3, 1), (2, 2), (3, 2), (2, 3), (3, 3), (2, 4), (3, 4)])
def _(c):
    W = 96
    # 가운데 문루(이완): 앞면 먼저, 그 위에 위에서 본 두꺼운 지붕 판(성가퀴 길)
    BP.pishtaq(c, 16, 18, 64, 62, mat='stone', s=77, no_door=True)
    darken(c, 18, 22, 60, 58)
    slab_top(c, 16, 0, 64, 20, 'stone', s=79, grid=8, crenel_front=True)
    for j in range(4, 15):
        for i in range(20, 76):
            if rnd(i // 2, j // 2, 83) < 0.04: c.P(i, j, 'sand', 5)
    c.HL(16, 20, 64, 'stone', 1)
    # 통로: 반원 아치 28×40 — 위쪽 = 둥근 천장 밑면(머리 위 칸), 아래 16줄은 투명(땅이 보이고 걸어 지나간다)
    m = BP.arch_mask(28, 40, r=14)
    for (i, j) in m:
        X, Y = 34 + i, 40 + j
        if Y >= 64: c.P(X, Y, None, 0); continue
        ring = 14 - math.hypot(i + 0.5 - 14, 14 - (j + 0.5)) if j < 14 else 99
        if ring < 3: c.P(X, Y, 'stone', 2)
        else: c.P(X, Y, 'void', 0 if j < 14 else 1 if Y < 58 else 2)
    for (i, j) in m:
        for dx, dy in ((-1, 0), (1, 0), (0, -1), (-2, 0), (2, 0), (-1, -1), (1, -1), (0, -2)):
            if (i + dx, j + dy) not in m and 40 + j + dy < 80:
                c.P(34 + i + dx, 40 + j + dy, 'stone', 6 if dx <= 0 else 3)
    # 양옆 망루(원통): 둥근 띠 + 꼭대기 성가퀴 고리(위에서 본 바닥)
    for cx in (9, 87):
        cyl(c, cx, 12, 75, 9, 'stone', ry=4, bands=(26, 42, 58), cap=None, s=85, tex='stone')
        c.R(cx - 1, 34, 2, 8, 'void', 1)
        cyl(c, cx, 8, 12, 9.5, 'stone', ry=5, cap='crenel', s=87)


@B('ruin-wall', '무너진 사암 벽', 3, 2, [], ['폐허', '유적'], '폐허·피라미드 둘레·모래 속. 2~3개를 어긋나게. 둘레에 돌 부스러기(rubble)를 곁들인다.')
def _(c):
    """무너진 사암 벽(ㄱ자, 위에서 비스듬히): 왼쪽은 남북으로 뻗은 벽 토막(위에서 본 긴 윗면 띠 + 남쪽 끝면),
    오른쪽은 동서 벽 토막들(윗면 = 벽 두께 판 + 앞면 마름돌). 윗면은 매끈하고 밝게, 앞면은 어둡게."""
    def top(x0, y0, w, h):
        for j in range(h):
            for i in range(w):
                t = 6 if j >= h - 2 else 5
                if j == 0: t = 4
                c.P(x0 + i, y0 + j, 'stone', t)
    def face(x0, y0, w, h, s_):
        BP.wall_tex(c, x0, y0, w, h, 'stone', 'stone', s_); darken(c, x0, y0, w, h, 2)
        c.HL(x0, y0, w, 'stone', 1)
    # 남북 벽 토막(x 2..12): 윗면 y 2..19(위로 길게) + 남쪽 끝면 y 20..29
    top(2, 2, 10, 18)
    for j in range(2, 20): c.P(2, j, 'stone', 5); c.P(11, j, 'stone', 4)
    c.P(5, 7, 'stone', 4); c.P(8, 13, 'stone', 4); c.P(6, 15, 'sand', 6)
    face(2, 20, 10, 10, 79)
    # 동서 벽 토막: (x0, x1, 앞면 높이), 윗면 깊이 8
    for (x0, x1, h) in ((12, 22, 9), (25, 34, 6), (34, 42, 4)):
        fy = 30 - h; top(x0, fy - 8, x1 - x0, 8); face(x0, fy, x1 - x0, h, 80 + x0)
    # 떨어진 돌 블록(윗면 4줄 + 앞면 3줄)
    for (bx, by, bw) in ((22, 24, 4), (42, 24, 5)):
        c.R(bx, by, bw, 4, 'stone', 5); c.HL(bx, by, bw, 'stone', 4); c.HL(bx, by + 3, bw, 'stone', 6)
        c.R(bx, by + 4, bw, 3, 'stone', 2); c.HL(bx, by + 6, bw, 'stone', 1)
    c.outline(mat=None, bottom=('stone', 0))


@B('ruin-arch', '무너진 아치 문', 3, 3, [], ['폐허', '유적', '아치'], '폐허 마당의 표식. 아치 밑(가운데 아랫칸)은 걸어 지나간다.', passable=[(1, 2)])
def _(c):
    """무너진 아치 문: 두 돌기둥(위 끝 = 위에서 본 두꺼운 윗면 판 7줄) + 왼쪽에서 솟아 반만 남은 아치(쐐기돌 앞면 + 바깥 위로 아치 두께 윗면 띠)."""
    TH = 11
    for x0 in (2, 32):
        w = 14
        BP.wall_tex(c, x0, 17, w, 29, 'stone', 'stone', 81); darken(c, x0, 17, w, 29, 2)
        y0 = 17 - TH
        for j in range(TH):
            for i in range(w):
                X = x0 + i
                t = 5 if j < TH - 3 else 6
                if j == 1: t = 4
                c.P(X, y0 + j, 'stone', t)
        c.HL(x0, 17, w, 'stone', 0); c.HL(x0, 18, w, 'stone', 1)
        c.VL(x0, 19, 27, 'stone', 1); c.VL(x0 + 1, 19, 27, 'stone', 3); c.VL(x0 + w - 1, 19, 27, 'stone', 0)
        c.HL(x0, 45, w, 'stone', 0)
    # 아치: 앞면 고리(중심 24,22) + 위로 4화소 밀린 같은 고리 = 아치 두께의 윗면(밝은 띠)
    cx, cy, R0, R1, D = 24, 22, 8, 15, 4
    a_c = C(48, 48)
    for y in range(0, 24):
        for x in range(4, 44):
            px_, py_ = x + 0.5, y + 0.5
            rf = math.hypot(px_ - cx, cy - py_); ru = math.hypot(px_ - cx, cy - D - py_)
            af = math.degrees(math.atan2(cy - py_, px_ - cx)); au = math.degrees(math.atan2(cy - D - py_, px_ - cx))
            front = R0 <= rf <= R1 and cy - py_ >= -1 and af >= 72
            upper = R0 <= ru <= R1 and cy - D - py_ >= -1 and au >= 66
            if front:
                t = 4 if rf > R0 + 2 else 3
                if int((180 - af) * 10) % 220 < 18: t = 2
                if rf < R0 + 1: t = 2
                if rf > R1 - 1: t = 3
                a_c.P(x, y, 'stone', t)
            elif upper:
                if rf > R1: a_c.P(x, y, 'stone', 6 if ru < R1 - 1 else 5)          # 아치 위 끝(윗면, 위에서 봄)
                else: a_c.P(x, y, 'stone', 1)                                     # 아치 밑면(그늘)
    c.paste(a_c, 0, 0)
    # 무너진 쐐기돌(땅 위, 윗면 3줄)
    c.R(36, 39, 7, 3, 'stone', 5); c.HL(36, 39, 7, 'stone', 3); c.HL(36, 41, 7, 'stone', 6); c.R(36, 42, 7, 3, 'stone', 2); c.HL(36, 44, 7, 'stone', 1)
    c.R(29, 41, 4, 2, 'stone', 6); c.R(29, 43, 4, 2, 'stone', 2)
    c.outline(mat=None, bottom=('stone', 0))


if __name__ == '__main__':
    R.export()
    ims = [(it['id'], R.render(it).img()) for it in R.items]
    contact(ims, os.path.join(OUT, 'buildings', 'preview.png'), z=4, W=1800)
    print('buildings', len(R.items))
