#!/usr/bin/env python3
"""steampunk_city 건물 — 16px 블록을 이름으로 놓아 짓는다(통짜 그림 금지). 블록은 칸 안 좌표로만 그려 어디에 놓아도 화소가 같다.

한 층 = 2줄(u 윗줄 · d 아랫줄, 32px) — 사람(16×24) 대비 문 높이 26px. 문은 1칸(외문) 또는 2칸(양개·화물 문).
벽 재질: rb 붉은 벽돌(연립주택·가게·여관·선술집) · sb 그을린 벽돌(공장·보일러실·창고) · ds 다듬은 돌(정거장·회관·시계탑 밑동)
지붕: mans(슬레이트 망사르드 + 지붕창, 윗단 납판 윗면이 위에서 보인다) · gab.<재질>(박공 경사면 — 위에서 보이는 큰 면) · flat(평지붕 + 난간, 윗면 슬래브)
굴뚝: 지붕 맨 윗줄 위 한 줄(chim 줄)에 굴뚝 머리를 얹는다(투명 바탕).

  python3 buildings.py      # tiledata/steampunk-city/buildings/_gate/*.png + preview
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from px import C, rnd, h32, tex_brick, box3, NT, MI, cyl_v
from kit import Reg, contact, OUT

B = {}


def blk(name):
    def deco(fn): B[name] = fn; return fn
    return deco


def cell(name):
    c = C(16, 16)
    for part in name.split('+'):
        B[part](c)
    return c


# ═══════════════════════ 벽 재질 ═══════════════════════
WALL = dict(rb=('brick', 4), sb=('soot', 3), ds=('stone', 4))


def wall(c, m, x=0, y=0, w=16, h=16):
    if m == 'rb':
        c.F(x, y, w, h, lambda wx, wy, i, j: tex_brick(wx % 16, wy % 16, base=4, mat='brick', mortar=('brick', 1), s=5))
    elif m == 'sb':
        c.F(x, y, w, h, lambda wx, wy, i, j: tex_brick(wx % 16, wy % 16, base=3, mat='soot', mortar=('soot', 0), s=8))
    else:
        def f(wx, wy, i, j):
            lx, ly = wx % 16, wy % 16
            row = ly // 8; xx = (lx + (8 if row % 2 else 0)) % 16; yy = ly % 8
            if yy == 7 or xx == 15: return ('stone', 2)
            t = 4 + (1 if yy == 0 or xx == 0 else 0)
            if rnd(lx, ly, 3) < 0.06: t -= 1
            return ('stone', t)
        c.F(x, y, w, h, f)


def dark(m): return WALL[m][0], max(0, WALL[m][1] - 3)


def course(c, y, m):
    """층 띠돌(석재 띠, 윗면 1 밝게 + 앞면 + 밑 그늘)."""
    c.HL(0, y, 16, 'stone', 6); c.HL(0, y + 1, 16, 'stone', 4); c.HL(0, y + 2, 16, *dark(m))


def ends(c, m, e, row):
    """양 끝 칸: 모퉁이 돌(rb·sb) 또는 기둥 띠(ds) + 바깥 먹 선."""
    if e is None: return
    L = e == 'L'
    if m in ('rb', 'sb'):
        for k in range(4):
            y = k * 4; n = 4 if k % 2 == 0 else 3
            x = 0 if L else 16 - n
            c.R(x, y, n, 3, 'stone', 5 if L else 3); c.HL(x, y, n, 'stone', 6 if L else 4); c.HL(x, y + 3, n, 'stone', 2)
    else:
        c.R(0 if L else 13, 0, 3, 16, 'stone', 5 if L else 3)
    c.VL(0 if L else 15, 0, 16, 'ink', 1)


# ── 창 ──
SASH = dict(rb=('canvas', 3), sb=('iron', 4), ds=('paint', 3))


def glass_px(i, j, gh, lit, s=0):
    if lit:
        t = 3 if j < gh * 0.4 else 2
        if (i + j + s) % 7 == 0: t = 4
        return ('lit', t)
    t = 1 if j == 0 else 3 if j < gh * 0.45 else 2
    if j > 0 and (i + j + s) % 8 in (0, 1): t = 4
    return ('glass', t)


def sash_u(c, m, lit=False, x0=4, w=8):
    """창 윗반(상인방 + 쐐기돌 + 위 창짝). 창 유리는 아래 줄에서 이어진다."""
    fm, ft = SASH[m]
    c.R(x0 - 1, 3, w + 2, 2, 'stone', 5); c.HL(x0 - 1, 3, w + 2, 'stone', 6); c.HL(x0 - 1, 5, w + 2, *dark(m))
    c.R(x0 + w // 2 - 1, 2, 2, 3, 'stone', 6); c.P(x0 + w // 2, 4, 'stone', 4)
    c.R(x0, 5, w, 11, fm, ft)
    for j in range(6, 16):
        for i in range(x0 + 1, x0 + w - 1): c.P(i, j, *glass_px(i, j - 6, 16, lit))
    c.VL(x0 + w // 2 - (0 if w % 2 else 0), 6, 10, fm, ft - 1)
    c.HL(x0 + 1, 11, w - 2, fm, ft - 1)
    c.HL(x0, 15, w, fm, ft)                                  # 미닫이 맞닿는 살
    c.VL(x0, 5, 11, fm, min(NT[MI[fm]] - 1, ft + 1)); c.VL(x0 + w - 1, 5, 11, fm, ft - 1)


def sash_d(c, m, lit=False, x0=4, w=8, sill=True):
    fm, ft = SASH[m]
    c.R(x0, 0, w, 7, fm, ft)
    for j in range(0, 6):
        for i in range(x0 + 1, x0 + w - 1): c.P(i, j, *glass_px(i, j + 10, 16, lit))
    c.VL(x0 + w // 2, 0, 6, fm, ft - 1); c.HL(x0 + 1, 3, w - 2, fm, ft - 1)
    c.VL(x0, 0, 7, fm, min(NT[MI[fm]] - 1, ft + 1)); c.VL(x0 + w - 1, 0, 7, fm, ft - 1)
    if sill:
        c.HL(x0 - 1, 6, w + 2, 'stone', 6); c.HL(x0 - 1, 7, w + 2, 'stone', 4); c.HL(x0 - 1, 8, w + 2, *dark(m))


def lit_of(m, x, y): return h32(x, y, 77) % 5 == 0


def wall_u(c, m, e=None, win=True, belt=True, lit=False):
    wall(c, m)
    if belt: course(c, 0, m)
    if win: sash_u(c, m, lit)
    ends(c, m, e, 'u')


def wall_d(c, m, e=None, win=True, ground=False, lit=False):
    wall(c, m)
    if win: sash_d(c, m, lit)
    if ground:
        c.HL(0, 11, 16, 'stone', 6); c.R(0, 12, 16, 3, 'stone', 4); c.HL(0, 12, 16, 'stone', 5)
        for x in (5, 13): c.VL(x, 12, 3, 'stone', 2)
        c.HL(0, 15, 16, 'ink', 1)
    ends(c, m, e, 'd')
    if ground and e: c.VL(0 if e == 'L' else 15, 0, 16, 'ink', 1)


def balcony_d(c, m, e=None, lit=False):
    """발코니 층 아랫줄: 창 아래 + 무쇠 발코니(바닥판 윗면이 보인다, 난간 살)."""
    wall(c, m)
    sash_d(c, m, lit, sill=False)
    # 바닥판(윗면 2 + 앞면 2)
    c.HL(0, 9, 16, 'iron', 5); c.HL(0, 10, 16, 'iron', 6); c.R(0, 11, 16, 2, 'iron', 2); c.HL(0, 13, 16, 'ink', 1)
    c.HL(0, 14, 16, *dark(m))
    # 난간: 윗난간 y2 + 살 2px 간격 + 아래 띠 y8
    c.HL(0, 2, 16, 'iron', 5); c.HL(0, 3, 16, 'iron', 2)
    for x in range(1, 16, 2):
        c.VL(x, 4, 5, 'iron', 1)
        if x % 4 == 1: c.P(x, 6, 'iron', 3)
    c.HL(0, 8, 16, 'iron', 3)
    # 소용돌이 장식 점
    for x in (3, 11): c.P(x, 5, 'iron', 4); c.P(x + 1, 6, 'iron', 4)
    ends(c, m, e, 'd')


for m in ('rb', 'sb', 'ds'):
    for e, nm in ((None, 'M'), ('L', 'L'), ('R', 'R')):
        blk('%s.w%s.u' % (m, nm))(lambda c, m=m, e=e: wall_u(c, m, e))
        blk('%s.w%s.d' % (m, nm))(lambda c, m=m, e=e: wall_d(c, m, e))
        blk('%s.w%s.u~lit' % (m, nm))(lambda c, m=m, e=e: wall_u(c, m, e, lit=True))
        blk('%s.w%s.d~lit' % (m, nm))(lambda c, m=m, e=e: wall_d(c, m, e, lit=True))
        blk('%s.g%s.u' % (m, nm))(lambda c, m=m, e=e: wall_u(c, m, e))
        blk('%s.g%s.d' % (m, nm))(lambda c, m=m, e=e: wall_d(c, m, e, ground=True))
        blk('%s.g%s.u~lit' % (m, nm))(lambda c, m=m, e=e: wall_u(c, m, e, lit=True))
        blk('%s.g%s.d~lit' % (m, nm))(lambda c, m=m, e=e: wall_d(c, m, e, ground=True, lit=True))
        blk('%s.b%s.u' % (m, nm))(lambda c, m=m, e=e: wall_u(c, m, e))
        blk('%s.b%s.d' % (m, nm))(lambda c, m=m, e=e: balcony_d(c, m, e))
        blk('%s.b%s.d~lit' % (m, nm))(lambda c, m=m, e=e: balcony_d(c, m, e, lit=True))
        blk('%s.b%s.u~lit' % (m, nm))(lambda c, m=m, e=e: wall_u(c, m, e, lit=True))


# ── 벽 기둥(창 없음): 구리 홈통 / 벽 가스등 / 배관 ──
def pier_u(c, m, kind='plain', ground=False):
    wall(c, m); course(c, 0, m)
    if kind == 'pipe':
        c.R(6, 3, 4, 13, 'copper', 3); c.VL(6, 3, 13, 'copper', 4); c.VL(7, 3, 13, 'copper', 5); c.VL(9, 3, 13, 'copper', 1)
        c.R(5, 6, 6, 2, 'copper', 2); c.HL(5, 6, 6, 'copper', 4)          # 이음 고리
        c.ell(8, 11, 3.2, 3.2, lambda X, Y, dx, dy, d: ('brass', 4 if d < 0.45 else 3 if dx < 0 else 2))   # 압력계
        c.P(8, 10, 'ink', 1); c.P(9, 11, 'ink', 1)
    elif kind == 'lamp':
        c.HL(4, 6, 6, 'iron', 4); c.HL(4, 7, 6, 'iron', 1); c.VL(4, 6, 4, 'iron', 3)            # 까치발
        c.R(8, 7, 5, 2, 'iron', 4); c.HL(8, 7, 5, 'iron', 5)                                    # 등 뚜껑
        c.R(8, 9, 5, 5, 'lit', 3); c.VL(8, 9, 5, 'iron', 2); c.VL(12, 9, 5, 'iron', 1); c.R(9, 10, 3, 2, 'lit', 4)
        c.HL(8, 14, 5, 'iron', 2)
    elif kind == 'gauge':
        c.R(3, 4, 10, 10, 'iron', 2)
        rv = 0
        c.ell(8, 9, 3.6, 3.6, lambda X, Y, dx, dy, d: ('canvas', 3 if d < 0.5 else 2) if d < 0.7 else ('brass', 4 if dx < 0 else 2))
        c.line(8, 9, 10, 7, 'ink', 1); c.P(8, 9, 'cloth', 2)
        c.HL(3, 4, 10, 'iron', 5); c.HL(3, 13, 10, 'ink', 1)


def pier_d(c, m, kind='plain', ground=False):
    wall(c, m)
    if kind == 'pipe':
        c.R(6, 0, 4, 16, 'copper', 3); c.VL(6, 0, 16, 'copper', 4); c.VL(7, 0, 16, 'copper', 5); c.VL(9, 0, 16, 'copper', 1)
        c.R(4, 4, 8, 3, 'brass', 3); c.HL(4, 4, 8, 'brass', 5); c.HL(4, 6, 8, 'brass', 1)        # 밸브 몸
        c.HL(3, 2, 10, 'iron', 4); c.VL(8, 2, 2, 'iron', 3)                                     # 밸브 손잡이 바퀴
        if ground: c.R(5, 13, 6, 2, 'copper', 2)
    if kind == 'lamp':
        c.R(9, 0, 3, 2, 'iron', 2); c.P(10, 2, 'iron', 1)
    if ground:
        c.HL(0, 11, 16, 'stone', 6); c.R(0, 12, 16, 3, 'stone', 4); c.HL(0, 12, 16, 'stone', 5); c.HL(0, 15, 16, 'ink', 1)
        if kind == 'pipe': c.R(6, 11, 4, 4, 'copper', 2); c.VL(7, 11, 4, 'copper', 4)


for m in WALL:
    for k in ('plain', 'pipe', 'lamp', 'gauge'):
        blk('%s.p%s.u' % (m, k))(lambda c, m=m, k=k: pier_u(c, m, k))
        blk('%s.p%s.d' % (m, k))(lambda c, m=m, k=k: pier_d(c, m, k))
        blk('%s.p%s.gu' % (m, k))(lambda c, m=m, k=k: pier_u(c, m, k, True))
        blk('%s.p%s.gd' % (m, k))(lambda c, m=m, k=k: pier_d(c, m, k, True))


# ── 문 ──
DOOR_PAINT = dict(green=('paint', 2), navy=('navy', 2), red=('cloth', 2), wood=('wood', 3))


def door1(c, m, row, paint='green'):
    """외문 1칸: 반원 채광창(켜짐) + 판넬 문짝 + 놋쇠 손잡이 + 돌계단 2단. 열린 높이 26px."""
    pm, pt = DOOR_PAINT[paint]
    wall(c, m)
    if row == 'u':
        course(c, 0, m)
        # 돌 테두리 아치
        c.ell(8, 10.5, 7, 6.5, lambda X, Y, dx, dy, d: ('stone', 5 if dx < 0 else 3) if Y < 11 else None)
        c.ell(8, 10.5, 5.6, 5.1, lambda X, Y, dx, dy, d: ('lit', 3 if d > 0.35 else 4) if Y < 11 else None)
        for k in range(-2, 3): c.line(8, 10, 8 + k * 2, 6, 'iron', 2)
        c.P(7, 4, 'stone', 6); c.P(8, 4, 'stone', 6)
        c.R(1, 11, 14, 1, 'stone', 4); c.HL(2, 12, 12, 'ink', 1)
        c.R(1, 11, 1, 5, 'stone', 5); c.R(14, 11, 1, 5, 'stone', 3)
        c.R(2, 13, 12, 3, pm, pt)
        c.HL(3, 14, 10, pm, pt + 1); c.VL(3, 14, 2, pm, pt + 1); c.VL(12, 14, 2, pm, pt - 1)
    else:
        c.R(1, 0, 1, 12, 'stone', 5); c.R(14, 0, 1, 12, 'stone', 3)
        c.R(2, 0, 12, 11, pm, pt)
        # 판넬 두 칸(밝은 위 테 + 어두운 아래 테)
        for (py, ph) in ((0, 4), (6, 4)):
            c.R(4, py, 8, ph, pm, pt - 1); c.HL(4, py, 8, pm, pt + 1); c.VL(4, py, ph, pm, pt + 1)
        c.VL(2, 0, 11, pm, pt + 1); c.VL(13, 0, 11, pm, pt - 1)
        c.R(11, 4, 2, 2, 'brass', 5); c.P(12, 5, 'brass', 2)                # 손잡이
        c.R(7, 1, 2, 1, 'brass', 4)                                          # 우편 구멍
        # 계단 2단
        c.HL(0, 11, 16, 'stone', 6); c.HL(0, 12, 16, 'stone', 3); c.HL(1, 13, 14, 'stone', 6); c.HL(1, 14, 14, 'stone', 3); c.HL(0, 15, 16, 'ink', 1)
        c.P(0, 13, 'ink', 1); c.P(15, 13, 'ink', 1)


for m in WALL:
    for p in DOOR_PAINT:
        for r in 'ud':
            blk('%s.door1.%s.%s' % (m, p, r))(lambda c, m=m, r=r, p=p: door1(c, m, r, p))


def door2(c, m, side, row, kind='double', paint='wood'):
    """양개 문 2칸(L/R): kind double = 아치 채광창 + 나무 양개문 · cargo = 리벳 철판 미닫이 화물 문(4칸 폭 가능은 짝으로)."""
    L = side == 'L'
    wall(c, m)
    if kind == 'double':
        pm, pt = DOOR_PAINT[paint]
        cx = 16 if L else 0
        if row == 'u':
            course(c, 0, m)
            for y in range(3, 16):
                for x in range(16):
                    d = ((x + 0.5 - cx) ** 2 + ((y + 0.5 - 16) * 1.25) ** 2) ** 0.5
                    if 12 <= d < 14.5: c.P(x, y, 'stone', 5 if L else 3)
                    elif d < 12:
                        if y < 11: c.P(x, y, 'lit', 4 if d < 5 else 3)
                        else: c.P(x, y, pm, pt)
            for y in range(4, 11):
                for x in range(16):
                    d = ((x + 0.5 - cx) ** 2 + ((y + 0.5 - 16) * 1.25) ** 2) ** 0.5
                    if d < 12 and (abs(x + 0.5 - cx) < 0.9 or abs(d - 7) < 0.6): c.P(x, y, 'iron', 2)
            c.HL(2 if L else 0, 11, 14, 'stone', 4)
            c.HL(3 if L else 0, 12, 13, 'ink', 1)
            x0 = 4 if L else 0; x1 = 16 if L else 12
            c.R(x0, 13, x1 - x0, 3, pm, pt); c.HL(x0, 14, x1 - x0, pm, pt + 1)
        else:
            x0 = 4 if L else 0; x1 = 16 if L else 12
            c.R(x0, 0, x1 - x0, 11, pm, pt)
            for (py, ph) in ((0, 4), (6, 4)):
                xa = x0 + 2 if L else x0 + 1
                c.R(xa, py, x1 - x0 - 3, ph, pm, pt - 1); c.HL(xa, py, x1 - x0 - 3, pm, pt + 1)
            c.VL(15 if L else 0, 0, 11, 'ink', 1)
            c.R(13 if L else 2, 4, 1, 3, 'brass', 5)
            if L: c.VL(x0, 0, 11, pm, pt + 1); c.R(x0 - 2, 0, 2, 11, 'stone', 5)
            else: c.VL(x1 - 1, 0, 11, pm, pt - 1); c.R(x1, 0, 2, 11, 'stone', 3)
            c.HL(0, 11, 16, 'stone', 6); c.HL(0, 12, 16, 'stone', 3); c.HL(0, 13, 16, 'stone', 5); c.HL(0, 14, 16, 'stone', 2); c.HL(0, 15, 16, 'ink', 1)
    else:   # cargo: 철판 미닫이 + 레일 + 대각 보강
        if row == 'u':
            course(c, 0, m)
            c.R(0, 3, 16, 2, 'iron', 5); c.HL(0, 3, 16, 'iron', 6); c.HL(0, 5, 16, 'ink', 1)   # 레일 보
            for x in (3, 12): c.R(x, 4, 2, 2, 'iron', 2)
            x0 = 2 if L else 0; x1 = 16 if L else 14
            c.R(x0, 6, x1 - x0, 10, 'iron', 3)
            if L: c.VL(x0, 6, 10, 'iron', 4); c.R(0, 6, 2, 10, 'stone', 5)
            else: c.VL(x1 - 1, 6, 10, 'iron', 2); c.R(14, 6, 2, 10, 'stone', 3)
            c.HL(x0, 6, x1 - x0, 'iron', 5); c.HL(x0, 7, x1 - x0, 'iron', 2)
            for x in range(x0 + 1, x1, 4): c.P(x, 9, 'iron', 6); c.P(x + 1, 10, 'iron', 1)
            c.line(x0 + 1, 15, x1 - 2, 8, 'iron', 2) if L else c.line(x0 + 1, 8, x1 - 2, 15, 'iron', 2)
            c.HL(x0, 12, x1 - x0, 'iron', 4)
        else:
            x0 = 2 if L else 0; x1 = 16 if L else 14
            c.R(x0, 0, x1 - x0, 13, 'iron', 3)
            if L: c.VL(x0, 0, 13, 'iron', 4); c.R(0, 0, 2, 13, 'stone', 5)
            else: c.VL(x1 - 1, 0, 13, 'iron', 2); c.R(14, 0, 2, 13, 'stone', 3)
            c.line(x0 + 1, 0, x1 - 2, 7, 'iron', 2) if L else c.line(x0 + 1, 7, x1 - 2, 0, 'iron', 2)
            c.HL(x0, 4, x1 - x0, 'iron', 4); c.HL(x0, 9, x1 - x0, 'iron', 4); c.HL(x0, 12, x1 - x0, 'iron', 2)
            for x in range(x0 + 1, x1, 4): c.P(x, 10, 'iron', 6); c.P(x + 1, 11, 'iron', 1)
            c.VL(15 if L else 0, 0, 13, 'ink', 1)
            c.R(13 if L else 1, 5, 2, 3, 'brass', 4)
            c.HL(0, 13, 16, 'iron', 4); c.HL(0, 14, 16, 'iron', 2); c.HL(0, 15, 16, 'ink', 1)        # 문턱 레일


for m in WALL:
    for sd in 'LR':
        for r in 'ud':
            for p in DOOR_PAINT:
                blk('%s.door2%s.%s.%s' % (m, sd, p, r))(lambda c, m=m, sd=sd, r=r, p=p: door2(c, m, sd, r, 'double', p))
            blk('%s.cargo%s.%s' % (m, sd, r))(lambda c, m=m, sd=sd, r=r: door2(c, m, sd, r, 'cargo'))


# ── 가게 앞(진열창 + 간판 판 + 줄무늬 차양) ──
AWN = dict(red=('cloth', 3, 'canvas', 3), green=('paint', 4, 'canvas', 3), navy=('navy', 4, 'canvas', 3))


def shop(c, m, col, row, awn='red', goods='gears'):
    """가게 1층 2줄: u = 간판 판(글자 없음) + 차양(윗면 줄무늬가 위에서 보인다), d = 진열창 + 허리 판.
    col L/M/R(진열창 칸) 또는 D(문 칸: 유리 문)."""
    a1, t1, a2, t2 = AWN[awn]
    wall(c, m)
    if row == 'u':
        course(c, 0, m)
        # 간판 판(짙은 칠 나무 + 놋쇠 테) y3~6
        c.R(0, 3, 16, 4, 'wood', 1); c.HL(0, 3, 16, 'brass', 3); c.HL(0, 6, 16, 'brass', 2)
        if col == 'M':
            c.ell(8, 4.8, 2.2, 1.6, lambda X, Y, dx, dy, d: ('brass', 5 if dx < 0 else 3))
        # 차양: 윗면 줄무늬 y7~12(뒤 → 앞 밝아짐), 앞 술 y13~14, 그늘 y15
        for y in range(7, 13):
            for x in range(16):
                stripe = (x // 4) % 2 == 0
                t = (t1 if stripe else t2) + (0 if y < 9 else 0) - (1 if y == 7 else 0)
                c.P(x, y, a1 if stripe else a2, t)
        c.HL(0, 7, 16, 'ink', 1)
        for x in range(16):
            stripe = (x // 4) % 2 == 0
            c.P(x, 13, a1 if stripe else a2, (t1 if stripe else t2) - 1)
            if x % 4 in (1, 2): c.P(x, 14, a1 if stripe else a2, (t1 if stripe else t2) - 2)
        c.HL(0, 15, 16, 'ink', 2)
        for x in range(16):
            if x % 4 in (0, 3): c.P(x, 14, 'ink', 2)
    else:
        if col == 'D':
            c.R(1, 0, 14, 12, 'wood', 2); c.R(3, 0, 10, 10, 'glass', 2)
            for j in range(10):
                for i in range(3, 13):
                    c.P(i, j, 'lit', 3 if (i + j) % 6 else 4)
            c.VL(8, 0, 10, 'wood', 1); c.HL(3, 5, 10, 'wood', 3); c.R(10, 6, 1, 2, 'brass', 5)
            c.VL(1, 0, 12, 'wood', 4); c.VL(14, 0, 12, 'wood', 1)
        else:
            # 진열창(따뜻한 불빛 + 물건 실루엣) y0~8, 허리 판 y9~11
            c.R(0, 0, 16, 9, 'wood', 2)
            for j in range(1, 8):
                for i in range(1, 15):
                    c.P(i, j, 'lit', 3 if j < 4 else 2)
            if goods == 'gears':
                c.ell(5, 5, 2.6, 2.6, lambda X, Y, dx, dy, d: ('brass', 4 if dx < 0 else 2) if d > 0.25 else ('lit', 2))
                for k in range(8):
                    import math
                    a = k * math.pi / 4; c.P(round(5 + 3.2 * math.cos(a) - 0.5), round(5 + 3.2 * math.sin(a) - 0.5), 'brass', 3)
                c.R(10, 3, 3, 4, 'copper', 3); c.HL(10, 3, 3, 'copper', 5); c.P(11, 2, 'brass', 4)
            elif goods == 'bottles':
                for k, x in enumerate((3, 6, 9, 12)):
                    c.R(x, 4, 2, 4, ('verd', 'cloth', 'navy', 'brass')[k], 2); c.P(x, 3, 'ink', 2); c.P(x, 4, ('verd', 'cloth', 'navy', 'brass')[k], 4)
            elif goods == 'bread':
                c.ell(5, 6, 3, 1.6, lambda X, Y, dx, dy, d: ('wood', 5 if dy < 0 else 4))
                c.ell(11, 6, 3, 1.6, lambda X, Y, dx, dy, d: ('wood', 5 if dy < 0 else 4))
            c.HL(1, 7, 14, 'wood', 3)                                           # 진열 선반
            c.VL(0 if col == 'L' else 15 if col == 'R' else 0, 0, 9, 'wood', 1)
            c.HL(0, 0, 16, 'wood', 1)
            c.R(0, 9, 16, 3, 'wood', 3); c.HL(0, 9, 16, 'wood', 4); c.HL(0, 11, 16, 'wood', 1)
            for x in (3, 12): c.R(x, 10, 2, 1, 'wood', 2)
        c.HL(0, 12, 16, 'stone', 6); c.R(0, 13, 16, 2, 'stone', 4); c.HL(0, 15, 16, 'ink', 1)
    if col == 'L': c.VL(0, 0, 16, 'ink', 1)
    if col == 'R': c.VL(15, 0, 16, 'ink', 1)


for m in ('rb', 'sb'):
    for awn in AWN:
        for col in 'LMRD':
            for r in 'ud':
                for g in ('gears', 'bottles', 'bread'):
                    blk('%s.shop%s.%s.%s.%s' % (m, col, awn, g, r))(lambda c, m=m, col=col, r=r, awn=awn, g=g: shop(c, m, col, r, awn, g))


# ── 공장 큰 아치 창(1층 2줄, 무쇠 살 격자) ──
def arch_win(c, m, e, row, lit=False):
    wall(c, m)
    x0, w = 3, 10
    if row == 'u':
        course(c, 0, m)
        for y in range(3, 16):
            for x in range(16):
                dx = x + 0.5 - 8; dy = (y + 0.5 - 9) * 1.0
                d = (dx * dx + dy * dy) ** 0.5
                if y < 9 and d > 6.6: continue
                if (y < 9 and d > 5.2) or (y >= 9 and (x < x0 or x >= x0 + w)):
                    if y >= 9 and (x == x0 - 1 or x == x0 + w): c.P(x, y, 'stone', 5 if x < 8 else 3)
                    elif y < 9: c.P(x, y, 'stone', 5 if x < 8 else 3)
                    continue
                if x0 <= x < x0 + w:
                    c.P(x, y, *glass_px(x, y, 20, lit))
        for x in range(x0, x0 + w):
            for y in range(4, 16):
                if c.get(x, y) and c.get(x, y)[0] in ('glass', 'lit') and ((x - x0) % 3 == 2 or (y - 4) % 4 == 3): c.P(x, y, 'iron', 2)
        c.P(7, 2, 'stone', 6); c.P(8, 2, 'stone', 6); c.P(7, 3, 'stone', 5); c.P(8, 3, 'stone', 5)
    else:
        for y in range(0, 10):
            for x in range(x0, x0 + w):
                if (x - x0) % 3 == 2 or y % 4 == 3: c.P(x, y, 'iron', 2)
                else: c.P(x, y, *glass_px(x, y + 12, 20, lit))
            c.P(x0 - 1, y, 'stone', 5); c.P(x0 + w, y, 'stone', 3)
        c.HL(x0 - 1, 10, w + 2, 'stone', 6); c.HL(x0 - 1, 11, w + 2, 'stone', 4); c.HL(x0 - 1, 12, w + 2, *dark(m))
        c.HL(0, 14, 16, 'stone', 4); c.HL(0, 15, 16, 'ink', 1)
    ends(c, m, e, row)


for m in WALL:
    for e, nm in ((None, 'M'), ('L', 'L'), ('R', 'R')):
        for r in 'ud':
            blk('%s.arch%s.%s' % (m, nm, r))(lambda c, m=m, e=e, r=r: arch_win(c, m, e, r))
            blk('%s.arch%s.%s~lit' % (m, nm, r))(lambda c, m=m, e=e, r=r: arch_win(c, m, e, r, True))


# ═══════════════════════ 지붕 ═══════════════════════
def slate_px(gx, gy, base, mat='slate'):
    """슬레이트: 4px 줄, 3~5px 판 엇갈림, 판 윗줄 밝게 · 아래 줄 그늘."""
    row = gy // 4; yy = gy % 4
    xs = gx + (2 if row % 2 else 0); xx = xs % 5
    t = base
    if yy == 3: t -= 1
    elif yy == 0 and xx < 3: t += 1
    if xx == 4 and yy in (1, 2): t -= 1
    if h32(xs // 5, row, 9) % 7 == 0: t -= 1
    return (mat, t)


def mansard(c, row, col, D=2, dormer=False, flush=False):
    """망사르드 지붕 D줄. 0줄 = 납판 윗단(평평, 위에서 넓게 보인다) + 꺾임 · 1줄~ = 가파른 슬레이트(앞면처럼 어둡다) + 처마 홈통.
    flush=True 면 연립(양옆 이어짐)이라 끝을 비스듬히 자르지 않는다."""
    L, Rr = col == 'L', col == 'R'
    for ly in range(16):
        gy = row * 16 + ly
        for lx in range(16):
            if row == 0:
                if ly < 7:
                    t = 4 if ly > 0 else 2
                    if lx % 6 == 5: t = 3                       # 납판 이음 띠
                    if ly == 1: t = 5
                    px_ = ('iron', t)
                elif ly < 9:
                    px_ = ('iron', 5 if ly == 7 else 2)         # 꺾임 테(빛) + 그늘
                else:
                    px_ = slate_px(lx, gy, 4)
            else:
                px_ = slate_px(lx, gy, 3 if gy < 24 else 2)
            if not flush:
                inset = 3 if row == 0 else 0
                if (L and lx < inset) or (Rr and lx > 15 - inset): continue
            c.P(lx, ly, *px_)
    if row == 0: c.HL(0 if (flush or not L) else 3, 0, 16 - (0 if flush or not (L or Rr) else 3), 'ink', 1)
    if row == D - 1:
        # 처마: 구리 홈통(윗면 1 밝게) + 처마 그늘
        c.HL(0, 12, 16, 'copper', 4); c.HL(0, 13, 16, 'copper', 3); c.HL(0, 14, 16, 'copper', 1); c.HL(0, 15, 16, 'ink', 1)
    if dormer and row >= 1:
        # 지붕창: 작은 슬레이트 지붕 머리(윗면 4행이 위에서 보인다) + 크림 창틀 창 + 볼 벽 + 밑 그늘
        c.HL(2, 0, 12, 'ink', 1)
        for y in range(1, 5):
            for x in range(2, 14):
                c.P(x, y, *slate_px(x, y + 40, 5 if y < 3 else 4))
        c.HL(2, 1, 12, 'slate', 5); c.HL(1, 4, 14, 'slate', 2); c.HL(1, 5, 14, 'ink', 1)
        c.VL(2, 1, 4, 'ink', 1); c.VL(13, 1, 4, 'ink', 1)
        c.R(3, 6, 10, 6, 'canvas', 3); c.VL(3, 6, 6, 'canvas', 3); c.VL(12, 6, 6, 'canvas', 1); c.HL(3, 6, 10, 'canvas', 1)
        lit = h32(row, ord(col), 3) % 2 == 0
        for j in range(7, 11):
            for i in range(4, 12): c.P(i, j, *glass_px(i, j - 6, 6, lit))
        c.VL(8, 7, 4, 'canvas', 2); c.HL(3, 11, 10, 'canvas', 2)
        c.VL(2, 5, 7, 'ink', 1); c.VL(13, 5, 7, 'ink', 1)
    if (L or Rr) and not flush:
        x = 0 if L else 15
        for ly in range(16):
            if c.on(x, ly): c.P(x, ly, 'ink', 1)
        if row == 0:
            for ly in range(0, 7):
                xx = 3 if L else 12
                c.P(xx, ly, 'ink', 1)
    elif flush and (L or Rr):
        c.VL(0 if L else 15, 0, 16, 'ink', 1)


for D in (2, 3):
    for r in range(D):
        for cl in 'LMR':
            for fl in (False, True):
                nm = 'mans%s.%d.%d%s' % ('F' if fl else '', D, r, cl)
                blk(nm)(lambda c, r=r, cl=cl, D=D, fl=fl: mansard(c, r, cl, D, False, fl))
                blk(nm + '.dm')(lambda c, r=r, cl=cl, D=D, fl=fl: mansard(c, r, cl, D, True, fl))


def gable(c, row, col, D, mat='slate', vent=False):
    """박공 경사면 D줄(사다리꼴 — 용마루가 위, 처마가 아래, 양 끝 귀를 비스듬히). 위에서 보이는 큰 면이라 밝은 쪽 반."""
    L, Rr = col == 'L', col == 'R'
    H = 16 * D; inset = 6
    n = NT[MI[mat]]
    base = n - 3
    for ly in range(16):
        gy = row * 16 + ly
        edge = inset * (1 - gy / (H - 1))
        for lx in range(16):
            k = gy / H
            b = base + (1 if k < 0.35 else 0 if k < 0.75 else -1)
            if mat == 'iron':     # 골함석: 세로 골 + 판 겹침 줄 + 녹물 자국
                kk = lx % 4; t = b + (1 if kk == 0 else -1 if kk == 3 else 0)
                if gy % 12 == 11: t -= 1
                px_ = ('iron', t)
                col_ = (lx + 16 * (ord(col) % 3)) // 4
                if kk == 1 and h32(col_, row, 41) % 5 == 0 and (gy % 12) > 3 and (gy % 12) < 3 + h32(col_, row, 42) % 8:
                    px_ = ('copper', 1 if (gy % 12) % 3 else 2)
            else:
                px_ = slate_px(lx, gy, b, mat)
            if L and lx < edge - 0.5: continue
            if Rr and 15 - lx < edge - 0.5: continue
            if L and lx < edge + 1.5: px_ = (mat, min(n - 1, b + 2))
            if Rr and 15 - lx < edge + 1.5: px_ = (mat, max(0, b - 2))
            c.P(lx, ly, *px_)
    if row == 0:
        x0 = inset if L else 0; x1 = 16 - inset if Rr else 16
        c.HL(x0, 0, x1 - x0, 'ink', 1); c.HL(x0, 1, x1 - x0, 'iron', 6); c.HL(x0, 2, x1 - x0, 'iron', 4); c.HL(x0, 3, x1 - x0, 'iron', 2)
    if row == D - 1:
        c.HL(0, 12, 16, mat, max(0, base - 2)); c.HL(0, 13, 16, 'copper', 4); c.HL(0, 14, 16, 'copper', 2); c.HL(0, 15, 16, 'ink', 1)
    if L or Rr:
        for ly in range(16):
            gy = row * 16 + ly; edge = inset * (1 - gy / (H - 1))
            x = int(round(edge - 0.5)) if L else 15 - int(round(edge - 0.5))
            if 0 <= x < 16 and c.on(x, ly): c.P(x, ly, 'ink', 1)


for mat in ('slate', 'iron'):
    for D in (2, 3, 4):
        for r in range(D):
            for cl in 'LMR':
                blk('gab.%s.%d.%d%s' % (mat, D, r, cl))(lambda c, r=r, cl=cl, D=D, mat=mat: gable(c, r, cl, D, mat))


def flat(c, row, col):
    """평지붕: 맨 뒷줄 = 뒤 난간 갓돌, 가운데 = 타르 슬래브(자갈 점), 맨 앞줄 = 앞 난간 갓돌 윗면 + 난간 앞면."""
    L, Rr = col == 'L', col == 'R'
    def tar(wx, wy, i, j):
        lx, ly = wx % 16, wy % 16
        r = rnd(wx, wy, 12)
        k = wy % 7                                           # 타르지 띠(동서로 길게 겹친 이음)
        t = 4 if k == 0 else 2 if k == 6 else 3
        if r < 0.05: t -= 1
        elif r > 0.96: t += 1
        return ('slate', t)
    c.F(0, 0, 16, 16, tar)
    if row == 'b':
        c.HL(0, 0, 16, 'ink', 1); c.R(0, 1, 16, 3, 'stone', 5); c.HL(0, 1, 16, 'stone', 6); c.HL(0, 4, 16, 'stone', 2); c.HL(0, 5, 16, 'slate', 1)
    if row == 'f':
        c.HL(0, 9, 16, 'slate', 1); c.R(0, 10, 16, 3, 'stone', 5); c.HL(0, 10, 16, 'stone', 6)
        c.R(0, 13, 16, 3, 'brick', 3); c.HL(0, 13, 16, 'brick', 2); c.HL(0, 15, 16, 'stone', 4)
    if L:
        c.R(0, 0, 3, 16 if row != 'f' else 13, 'stone', 5); c.VL(0, 0, 16, 'ink', 1); c.VL(3, 1 if row == 'b' else 0, 15 if row != 'f' else 10, 'slate', 1)
    if Rr:
        c.R(13, 0, 3, 16 if row != 'f' else 13, 'stone', 4); c.VL(15, 0, 16, 'ink', 1); c.VL(12, 1 if row == 'b' else 0, 15 if row != 'f' else 10, 'stone', 6)


for r in 'bmf':
    for cl in 'LMR':
        blk('flat.%s%s' % (r, cl))(lambda c, r=r, cl=cl: flat(c, r, cl))


# ── 지붕 위 설비 ──
@blk('rt.tank')
def _(c):
    """나무 물탱크(무쇠 테) — 위 타원 뚜껑이 보인다."""
    cyl_v(c, 2, 1, 12, 9, 6, 'wood', base=3)
    c.ell(8, 4, 6, 3, lambda X, Y, dx, dy, d: ('wood', 4 if dx < 0.2 else 3) if d > 0.55 else ('wood', 2))
    for by in (5, 8): c.HL(2, by + 3, 12, 'iron', 2)
    c.HL(2, 13, 12, 'iron', 3)
    for x in (3, 11): c.VL(x, 13, 3, 'iron', 2)
    c.HL(2, 15, 12, 'slate', 1)


@blk('rt.vent')
def _(c):
    """회전 환기통(구리 원통 + 갓)."""
    c.R(6, 7, 4, 7, 'copper', 3); c.VL(6, 7, 7, 'copper', 4); c.VL(9, 7, 7, 'copper', 1)
    c.ell(8, 6, 4.5, 2.5, lambda X, Y, dx, dy, d: ('copper', 5 if dy < 0 and dx < 0.3 else 3))
    c.ell(8, 4.5, 2.5, 1.5, lambda X, Y, dx, dy, d: ('copper', 4))
    c.HL(5, 14, 6, 'slate', 1)


@blk('rt.sky')
def _(c):
    """천창(유리 경사 + 무쇠 살) — 윗면이 보이는 유리."""
    c.R(2, 3, 12, 9, 'iron', 2)
    for j in range(4, 11):
        for i in range(3, 13): c.P(i, j, 'glass', 3 if j < 7 else 2)
    for i in (5, 8, 11): c.VL(i, 4, 7, 'iron', 4)
    c.HL(2, 3, 12, 'iron', 5); c.R(2, 11, 12, 2, 'iron', 1); c.HL(2, 13, 12, 'slate', 1)
    c.P(4, 5, 'glass', 4); c.P(5, 6, 'glass', 4)


def chim_pots(c, x0, w, mat='brick'):
    """굴뚝 머리: 벽돌 몸(앞면) + 갓돌(윗면 3행 보인다) + 토관 두 개(아가리 타원)."""
    c.R(x0, 6, w, 10, mat, 3 if mat == 'brick' else 2)
    c.F(x0, 8, w, 8, lambda wx, wy, i, j: tex_brick(i + x0, j + 8, base=3 if mat == 'brick' else 2, mat=mat, s=11))
    c.VL(x0, 6, 10, 'ink', 1); c.VL(x0 + w - 1, 6, 10, 'ink', 1)
    box3(c, x0 - 1, 4, w + 2, 3, 2, 'stone', tt=5)
    for px_ in (x0 + 1, x0 + w - 4):
        c.R(px_, 1, 3, 4, 'copper', 2); c.VL(px_, 1, 4, 'copper', 3)
        c.HL(px_, 0, 3, 'copper', 4); c.P(px_ + 1, 1, 'ink', 0)


@blk('chim')
def _(c): chim_pots(c, 4, 8)


@blk('chim.base')
def _(c):
    """굴뚝 몸이 지붕을 뚫는 칸(지붕 위에 덧그린다) — 굴뚝 머리 바로 아래 칸."""
    c.F(4, 0, 8, 12, lambda wx, wy, i, j: tex_brick(i + 4, j, base=3, mat='brick', s=11))
    c.VL(4, 0, 12, 'ink', 1); c.VL(11, 0, 12, 'ink', 1)
    c.HL(3, 12, 10, 'iron', 4); c.HL(3, 13, 10, 'ink', 1)       # 납 물막이


# ── 공장 큰 굴뚝(지붕 위로 3줄 솟는다) ──
def stack(c, part):
    """part top(꼭대기 테 + 아가리 타원) | mid | base(지붕 관통). 폭 10px 원통 벽돌 굴뚝."""
    x0, w = 3, 10
    if part == 'top':
        c.F(x0, 6, w, 10, lambda wx, wy, i, j: tex_brick(i + x0, j, base=3, mat='soot', s=13, course=3, blen=5))
        for j in range(6, 16):
            for i in range(w):
                u = (i + 0.5) / w
                g = c.get(x0 + i, j)
                if u < 0.25: c.P(x0 + i, j, 'soot', g[1] + 1)
                elif u > 0.75: c.P(x0 + i, j, 'soot', max(0, g[1] - 1))
        # 무쇠 테두리 머리(윗면 타원 + 시커먼 아가리)
        c.ell(8, 4, 6.5, 3.5, lambda X, Y, dx, dy, d: ('iron', 5 if dx < -0.1 and dy < 0.2 else 3 if dy < 0.4 else 2))
        c.ell(8, 3.8, 4.6, 2.3, lambda X, Y, dx, dy, d: ('coal', 0 if d < 0.6 else 1))
        c.HL(2, 7, 12, 'iron', 2); c.HL(2, 8, 12, 'iron', 1)
        c.VL(x0, 9, 7, 'ink', 1); c.VL(x0 + w - 1, 9, 7, 'ink', 1)
    else:
        c.F(x0, 0, w, 16, lambda wx, wy, i, j: tex_brick(i + x0, j, base=3, mat='soot', s=13, course=3, blen=5))
        for j in range(16):
            for i in range(w):
                u = (i + 0.5) / w
                g = c.get(x0 + i, j)
                if u < 0.25: c.P(x0 + i, j, 'soot', g[1] + 1)
                elif u > 0.75: c.P(x0 + i, j, 'soot', max(0, g[1] - 1))
        if part == 'mid':
            c.HL(x0, 6, w, 'iron', 4); c.HL(x0, 7, w, 'iron', 2)           # 쇠 띠
        c.VL(x0, 0, 16, 'ink', 1); c.VL(x0 + w - 1, 0, 16, 'ink', 1)
        if part == 'base':
            c.HL(2, 13, 12, 'iron', 4); c.HL(2, 14, 12, 'ink', 1)


for p in ('top', 'mid', 'base'):
    blk('stack.' + p)(lambda c, p=p: stack(c, p))


# ── 공장 지붕 설비 ──
@blk('rt.lantern')
def _(c):
    """용마루 환기 등(솟을지붕): 위 덮개 윗면 4행 + 루버 앞면 5행 + 밑 그늘."""
    c.HL(0, 1, 16, 'ink', 1)
    c.R(0, 2, 16, 4, 'iron', 5); c.HL(0, 2, 16, 'iron', 6); c.HL(0, 5, 16, 'iron', 4)
    c.R(0, 6, 16, 5, 'iron', 2)
    for y in (7, 9): c.HL(0, y, 16, 'iron', 4)
    for x in (0, 8): c.VL(x, 6, 5, 'iron', 1)
    c.HL(0, 11, 16, 'ink', 1)


@blk('rt.glaze')
def _(c):
    """경사 지붕 채광 유리 띠(무쇠 살) — 지붕 가운데 줄에 얹는다."""
    c.R(0, 2, 16, 11, 'iron', 2)
    for j in range(3, 12):
        for i in range(16):
            t = 3 if j < 6 else 2
            if (i - j) % 9 in (0, 1) and j > 3: t = 4
            c.P(i, j, 'glass', t)
    for i in (0, 5, 10, 15): c.VL(i, 3, 9, 'iron', 4)
    c.HL(0, 2, 16, 'iron', 5); c.HL(0, 12, 16, 'iron', 1)


def dome(c, q):
    """구리 둥근 지붕(녹청 얼룩, 리벳 테, 놋쇠 꼭지) — 2×2칸 사분면 q in TL TR BL BR. 위에서 보이는 반구라 왼쪽 위 밝게."""
    ox = 0 if q[1] == 'L' else -16; oy = 0 if q[0] == 'T' else -16
    cx, cy, rx, ry = 16, 26, 14.5, 20
    for y in range(16):
        for x in range(16):
            X, Y = x - ox, y - oy
            if Y > 28: continue
            dx = (X + 0.5 - cx) / rx; dy = (Y + 0.5 - cy) / ry
            d = dx * dx + dy * dy
            if d > 1: continue
            t = 4 if (dx < -0.2 and dy < -0.45) else 3 if dx < 0.15 else 2 if dx < 0.6 else 1
            if d > 0.88: t = 1
            m = 'copper'
            if (X % 7 == 3 and Y > 10 and rnd(X, Y // 4, 5) < 0.6) or (rnd(X // 4, Y // 3, 5) < 0.08) and d < 0.85: m, t = 'verd', 2 if t < 3 else 3
            ring = abs(d ** 0.5 - 0.55) < 0.04
            if ring: m, t = 'brass', 3 if dx < 0 else 2
            if abs(X + 0.5 - cx) < 0.6 and Y < 26: m, t = 'copper', 1
            c.P(x, y, m, t)
    if q[0] == 'B':
        for x in range(16):
            X = x - ox
            if 2 <= X <= 30: c.P(x, 12, 'brass', 4 if X < 16 else 2); c.P(x, 13, 'iron', 2)
    if q[0] == 'T':
        for x in range(16):
            X = x - ox
            if 14 <= X <= 17: c.P(x, 3, 'brass', 4); c.P(x, 4, 'brass', 3)
            if 15 <= X <= 16: c.P(x, 2, 'brass', 5)


for q in ('TL', 'TR', 'BL', 'BR'):
    blk('rt.dome.' + q)(lambda c, q=q: dome(c, q))


def loft(c, m, row):
    """윗층 하역 문 + 도르래 들보(창고): u = 들보(윗면 빛) + 도르래 + 밧줄 + 문 윗부분, d = 문 + 받침 판."""
    wall(c, m)
    if row == 'u':
        course(c, 0, m)
        c.R(3, 4, 10, 2, 'wood', 4); c.HL(3, 4, 10, 'wood', 5); c.HL(3, 6, 10, 'wood', 1)
        c.ell(8, 8, 2, 2, lambda X, Y, dx, dy, d: ('iron', 5 if dx < 0 else 2) if d > 0.3 else ('iron', 1))
        c.R(2, 10, 12, 6, 'wood', 2)
        for x in range(3, 13, 3): c.VL(x, 10, 6, 'wood', 1)
        c.VL(2, 10, 6, 'stone', 5); c.VL(13, 10, 6, 'stone', 3)
        c.VL(9, 10, 6, 'canvas', 2)
    else:
        c.R(2, 0, 12, 10, 'wood', 2)
        for x in range(3, 13, 3): c.VL(x, 0, 10, 'wood', 1)
        c.line(3, 1, 12, 8, 'wood', 3)
        c.VL(2, 0, 10, 'stone', 5); c.VL(13, 0, 10, 'stone', 3)
        c.VL(9, 0, 6, 'canvas', 2); c.R(8, 6, 3, 2, 'brass', 3)
        c.HL(1, 10, 14, 'wood', 5); c.HL(1, 11, 14, 'wood', 2); c.HL(1, 12, 14, *dark(m))


for m in WALL:
    for r in 'ud':
        blk('%s.loft.%s' % (m, r))(lambda c, m=m, r=r: loft(c, m, r))


# ═══════════════════════ 조립 ═══════════════════════
def assemble(rows):
    H = len(rows); W = len(rows[0])
    c = C(W * 16, H * 16)
    for y, r in enumerate(rows):
        assert len(r) == W, (y, r)
        for x, n in enumerate(r):
            if n: c.paste(cell(n), x * 16, y * 16)
    return c


def lmr(W, L, M, Rn):
    return [L] + [M] * (W - 2) + [Rn]


def facade(m, W, S, door=None, door_kind='door1', paint='green', balcony=(), piers=None, ground=None, lit_seed=0, arch=False, shopcols=None, awn='red', goods='gears', upper=None):
    """벽 줄 목록(S층 × 2줄). door = 문 왼쪽 칸 x. piers = {x: 'pipe'|'lamp'|'gauge'|'plain'}. balcony = 발코니 층 번호(0=맨 위층).
    arch=True 면 1층이 공장 아치 창. shopcols = 1층 가게 칸(x 목록, 문 칸 포함 — 문은 door)."""
    piers = piers or {}
    rows = []
    for s in range(S):
        g = s == S - 1
        mat = (ground or m) if g else m
        for hf in 'ud':
            row = []
            for x in range(W):
                e = 'L' if x == 0 else 'R' if x == W - 1 else None
                en = e or 'M'
                lit = h32(x, s * 2 + lit_seed, 91) % 4 == 0
                kind = 'b' if (s in balcony and not g) else 'g' if g else 'w'
                if g and arch: nm = '%s.arch%s.%s' % (mat, en, hf) + ('~lit' if lit else '')
                else: nm = '%s.%s%s.%s' % (mat, kind, en, hf) + ('~lit' if lit and not (kind == 'b' and hf == 'u' and False) else '')
                if x in piers and not e:
                    pk = piers[x]
                    allf = isinstance(pk, tuple)
                    pk = pk[0] if allf else pk
                    if g or allf: nm = '%s.p%s.%s' % (mat, pk if g else ('pipe' if pk == 'pipe' else 'plain'), ('g' if g else '') + hf)
                if not g and upper and x in upper:
                    nm = '%s.%s.%s' % (mat, upper[x], hf)
                if g and shopcols and x in shopcols:
                    col = 'D' if door is not None and x == door else ('L' if x == min(shopcols) else 'R' if x == max(shopcols) else 'M')
                    nm = '%s.shop%s.%s.%s.%s' % (mat, col, awn, goods, hf)
                row.append(nm)
            if g and door is not None and not (shopcols and door in shopcols):
                if door_kind == 'door1':
                    row[door] = '%s.door1.%s.%s' % (mat, paint, hf)
                elif door_kind == 'double':
                    row[door] = '%s.door2L.%s.%s' % (mat, paint, hf); row[door + 1] = '%s.door2R.%s.%s' % (mat, paint, hf)
                elif door_kind == 'cargo':
                    row[door] = '%s.cargoL.%s' % (mat, hf); row[door + 1] = '%s.cargoR.%s' % (mat, hf)
            rows.append(row)
    return rows


def roof_rows(W, roof, D, flush=False, dormers=(), chims=(), rooftop=None, mat='slate', stacks=(), over=None):
    rows = []
    if roof == 'mans':
        key = 'mansF' if flush else 'mans'
        for r in range(D):
            row = lmr(W, '%s.%d.%dL' % (key, D, r), '%s.%d.%dM' % (key, D, r), '%s.%d.%dR' % (key, D, r))
            if r == D - 1:
                for x in dormers: row[x] = row[x] + '.dm'
            rows.append(row)
    elif roof == 'gab':
        for r in range(D): rows.append(lmr(W, 'gab.%s.%d.%dL' % (mat, D, r), 'gab.%s.%d.%dM' % (mat, D, r), 'gab.%s.%d.%dR' % (mat, D, r)))
    else:
        for r in range(D):
            rk = 'b' if r == 0 else 'f' if r == D - 1 else 'm'
            rows.append(lmr(W, 'flat.%sL' % rk, 'flat.%sM' % rk, 'flat.%sR' % rk))
        for (x, y), n in (rooftop or {}).items(): rows[y][x] = rows[y][x] + '+' + n
    for (x, y), n in (over or {}).items(): rows[y][x] = rows[y][x] + '+' + n
    if stacks:
        tops = [[None] * W for _ in range(3)]
        for x in stacks:
            tops[0][x] = 'stack.top'; tops[1][x] = 'stack.mid'; tops[2][x] = 'stack.mid'; rows[0][x] = rows[0][x] + '+stack.base'
        for x in chims:
            tops[2][x] = 'chim'; rows[0][x] = rows[0][x] + '+chim.base'
        rows = tops + rows
    elif chims:
        top = [None] * W
        for x in chims:
            top[x] = 'chim'; rows[0][x] = rows[0][x] + '+chim.base'
        rows.insert(0, top)
    return rows


R = Reg('buildings')
LIB = []


def add_bld(id_, name, rows, door, dw, tags, rules, kind='structure', extra=None):
    W = len(rows[0]); H = len(rows)
    meta = dict(entrance=list(range(door, door + dw)) if door is not None else [], recipe=rows)
    if extra: meta.update(extra)
    LIB.append((id_, name, rows, meta))
    R.add(id_, name, W, H, kind, tags=tags, rules=rules, **meta)(lambda c, rows=rows: c.paste(assemble(rows), 0, 0))


# ── 연립주택 ──
add_bld('row-3', '붉은 벽돌 연립주택(3층, 폭 3, 무쇠 발코니·망사르드)',
        roof_rows(3, 'mans', 2, dormers=(1,), chims=(2,)) + facade('rb', 3, 3, door=1, paint='green', balcony=(1,), lit_seed=1), 1, 1,
        ['연립주택', '집', '거리'], '거리 북쪽 줄에 어깨를 붙여 늘어선다. 문 앞 보도는 비운다.')
add_bld('row-4', '붉은 벽돌 연립주택(3층, 폭 4, 벽 가스등)',
        roof_rows(4, 'mans', 2, dormers=(1, 2), chims=(0, 3)) + facade('rb', 4, 3, door=2, paint='navy', balcony=(0, 1), piers={1: 'lamp'}, lit_seed=3), 2, 1,
        ['연립주택', '집', '거리'], '거리 북쪽 줄. 문 옆 벽 가스등.')
add_bld('row-soot-3', '그을린 벽돌 노동자 주택(2층, 폭 3)',
        roof_rows(3, 'gab', 2, chims=(1,)) + facade('sb', 3, 2, door=0, paint='red', lit_seed=5), 0, 1,
        ['연립주택', '노동자', '공장 거리'], '공장 거리 뒤편. 문 앞 보도.')
add_bld('shop-gears', '부품 가게(벽돌 3층, 진열창·빨강 차양)',
        roof_rows(4, 'mans', 2, dormers=(1, 2), chims=(3,)) + facade('rb', 4, 3, door=2, balcony=(1,), shopcols=(0, 1, 2, 3), awn='red', goods='gears', lit_seed=7), 2, 1,
        ['가게', '시장', '거리'], '큰길 쪽 가게. 차양 앞 보도에 노점·간판을 두지 않는다.')
add_bld('shop-apoth', '약방(벽돌 2층, 진열창·초록 차양)',
        roof_rows(3, 'mans', 2, dormers=(1,), chims=(0,)) + facade('rb', 3, 2, door=1, shopcols=(0, 1, 2), awn='green', goods='bottles', lit_seed=9), 1, 1,
        ['가게', '약방', '거리'], '큰길 가게.')
add_bld('shop-bakery', '빵집(그을린 벽돌 2층, 남색 차양)',
        roof_rows(3, 'gab', 2, chims=(2,)) + facade('sb', 3, 2, door=1, shopcols=(0, 1, 2), awn='navy', goods='bread', lit_seed=11), 1, 1,
        ['가게', '빵집', '거리'], '큰길 가게.')
add_bld('inn', '여관(벽돌 3층, 폭 6, 양개문·발코니)',
        roof_rows(6, 'mans', 3, dormers=(1, 4), chims=(0, 5)) + facade('rb', 6, 3, door=2, door_kind='double', paint='wood', balcony=(1,), piers={1: 'lamp', 4: 'lamp'}, lit_seed=13), 2, 2,
        ['여관', '숙소', '거리'], '광장·역 앞. 문 앞 2칸 보도.')
add_bld('tavern', '선술집(그을린 벽돌 2층, 폭 5, 양개문)',
        roof_rows(5, 'gab', 3, chims=(1, 3)) + facade('sb', 5, 2, door=2, door_kind='double', paint='wood', piers={1: 'lamp', 4: 'gauge'}, lit_seed=15), 2, 2,
        ['선술집', '술집', '거리'], '골목 모퉁이. 문 앞에 통·벤치.')
add_bld('factory', '공장(그을린 벽돌, 폭 10, 큰 아치 창·화물 문·박공 철지붕)',
        roof_rows(10, 'gab', 3, mat='iron', stacks=(8,), over={(x, 0): 'rt.lantern' for x in range(2, 7)} | {(1, 1): 'rt.glaze', (2, 1): 'rt.glaze', (6, 1): 'rt.glaze', (7, 1): 'rt.glaze'}) + facade('sb', 10, 1, door=4, door_kind='cargo', arch=True, piers={3: 'pipe', 6: 'pipe'}, lit_seed=17), 4, 2,
        ['공장', '산업'], '공장 마당 북쪽. 화물 문 앞 2칸은 비우고 석탄재·철판 바닥으로 잇는다.')
add_bld('boiler-house', '보일러실(그을린 벽돌, 폭 6, 배관·압력계)',
        roof_rows(6, 'flat', 3, rooftop={(1, 0): 'rt.dome.TL', (2, 0): 'rt.dome.TR', (1, 1): 'rt.dome.BL', (2, 1): 'rt.dome.BR', (4, 1): 'rt.vent'}, stacks=(5,)) + facade('sb', 6, 1, door=2, door_kind='double', paint='navy', arch=False, piers={1: 'pipe', 4: 'gauge'}, lit_seed=19), 2, 2,
        ['보일러실', '공장'], '공장 옆. 배관으로 공장과 잇는다.')
add_bld('warehouse', '창고(붉은 벽돌 2층, 폭 8, 화물 문)',
        roof_rows(8, 'gab', 3, chims=(6,)) + facade('rb', 8, 2, door=3, door_kind='cargo', piers={1: 'pipe', 6: 'lamp'}, upper={3: 'loft'}, lit_seed=21), 3, 2,
        ['창고', '부두', '공장'], '부두·선로 옆. 화물 문 앞에 짐·수레.')
add_bld('station', '기차역(다듬은 돌 2층, 폭 8, 양개문)',
        roof_rows(8, 'mans', 3, dormers=(2, 5), chims=(1, 6)) + facade('ds', 8, 2, door=3, door_kind='double', paint='green', piers={1: 'lamp', 6: 'lamp'}, lit_seed=23), 3, 2,
        ['기차역', '정거장'], '승강장 북쪽. 문 앞은 광장 포석.')


# ═══════════════════════ 큰 부품(여러 칸을 한 번에 그려 칸으로 자른 블록) ═══════════════════════
def region(prefix, W, H, painter):
    """W×H 칸 그림을 한 번 그리고 칸마다 블록 '<prefix>.<x>.<y>' 로 등록한다(여러 건물이 같은 부품을 화소 그대로 쓴다)."""
    big = C(W * 16, H * 16); painter(big)
    for y in range(H):
        for x in range(W):
            blk('%s.%d.%d' % (prefix, x, y))(lambda c, x=x, y=y: c.paste(big.crop(x * 16, y * 16, 16, 16), 0, 0))
    return [['%s.%d.%d' % (prefix, x, y) for x in range(W)] for y in range(H)]


def clock_face(c, cx, cy, r=15):
    """시계판: 놋쇠 테(왼쪽 위 빛) + 크림 판 + 눈금 12(글자 없음) + 바늘 + 가운데 톱니 꼭지. 드러난 톱니 둘."""
    for (gx, gy, gr) in ((cx - r + 2, cy + r - 3, 5), (cx + r - 3, cy + r - 5, 4)):
        c.ell(gx, gy, gr, gr, lambda X, Y, dx, dy, d: ('brass', 4 if dx + dy < -0.3 else 3 if d < 0.5 else 2) if d > 0.18 else ('iron', 1))
        for a in range(10):
            ang = a * math.pi / 5
            c.P(round(gx + (gr + 1) * math.cos(ang) - 0.5), round(gy + (gr + 1) * math.sin(ang) - 0.5), 'brass', 2)
    c.ell(cx, cy, r, r, lambda X, Y, dx, dy, d: ('brass', 5 if (dx + dy) < -0.6 else 4 if dx + dy < 0 else 3 if dx + dy < 0.6 else 2))
    c.ell(cx, cy, r - 2, r - 2, lambda X, Y, dx, dy, d: ('canvas', 3 if (dx + dy) < 0.4 else 2))
    c.ell(cx, cy, r - 2.5, r - 2.5, lambda X, Y, dx, dy, d: ('canvas', 2) if d > 0.88 else None)
    for k in range(12):
        ang = k * math.pi / 6
        for rr in ((r - 4, r - 6) if k % 3 == 0 else (r - 4,)):
            c.P(round(cx + rr * math.sin(ang) - 0.5), round(cy - rr * math.cos(ang) - 0.5), 'ink', 1)
    c.line(round(cx - 0.5), round(cy - 0.5), round(cx - 0.5), round(cy - 9), 'ink', 1)          # 분침(12)
    c.line(round(cx - 0.5), round(cy - 0.5), round(cx + 5), round(cy + 2), 'ink', 1)           # 시침(4시)
    c.ell(cx, cy, 2, 2, lambda X, Y, dx, dy, d: ('brass', 4 if dx < 0 else 2))


def spire(c, W, H, mat='verd'):
    """녹청 구리 첨탑(사각뿔 남쪽 면): 아래 폭 W → 꼭짓점, 왼쪽 반 밝게, 구리 이음 띠, 놋쇠 꼭지."""
    cx = W / 2
    for y in range(4, H):
        half = (y - 4) / (H - 5) * (W / 2 - 1) + 1
        for x in range(int(cx - half), int(cx + half) + 1):
            if not (0 <= x < W): continue
            u = (x + 0.5 - (cx - half)) / (2 * half)
            t = 4 if u < 0.25 else 3 if u < 0.5 else 2 if u < 0.8 else 1
            if (y - 4) % 6 == 5: t = max(0, t - 1)
            m = mat
            if abs(x + 0.5 - cx) < 0.8: m, t = 'copper', 3
            c.P(x, y, m, t)
        c.P(int(cx - half), y, 'ink', 1); c.P(int(cx + half), y, 'ink', 1)
    c.R(int(cx) - 1, 0, 2, 5, 'brass', 4); c.P(int(cx) - 1, 0, 'brass', 5); c.P(int(cx), 2, 'brass', 2)
    c.HL(0, H - 2, W, 'copper', 4); c.HL(0, H - 1, W, 'ink', 1)


import math


def _ct_face(c):
    """시계 층 4칸×2줄: 다듬은 돌 + 가운데 시계판(지름 30) + 모서리 기둥."""
    wall(c, 'ds', 0, 0, 64, 32)
    for x in (0, 60): c.R(x, 0, 4, 32, 'stone', 5 if x == 0 else 3)
    c.VL(0, 0, 32, 'ink', 1); c.VL(63, 0, 32, 'ink', 1)
    course(c, 0, 'ds')
    clock_face(c, 32, 17, 14)


def _ct_spire(c):
    """시계탑 지붕 4칸×3줄(위에서 내려다본 녹청 구리 모임지붕): 넓은 처마 바닥(앞 처마 띠) + 네 면이 모두 보이는 낮은 사각뿔
    (꼭짓점이 바닥 사각 안쪽 — 북면은 얇게 밝게, 서면 밝게, 동면 어둡게, 남면 넓게) + 놋쇠 꼭지 + 난간 갓."""
    x0, x1, y0, y1 = 1, 62, 14, 40          # 지붕 바닥 사각(처마 끝)
    ax, ay = 32, 25                          # 꼭짓점(바닥 사각 안쪽, 북쪽 가까이)
    N = [(x0, y0), (x1, y0), (ax, ay)]; S = [(x0, y1), (x1, y1), (ax, ay)]
    W = [(x0, y0), (x0, y1), (ax, ay)]; E = [(x1, y0), (x1, y1), (ax, ay)]
    def face(base, bands):
        def f(x, y):
            t = base
            if bands == 'h' and (y - ay) % 5 == 4: t -= 1
            if bands == 'v' and (x - ax) % 6 == 5: t -= 1
            if abs(x + 0.5 - ax) < 0.8 and y > ay: return ('copper', 2)
            return ('verd', t)
        return f
    c.poly(S, face(2, 'h')); c.poly(W, face(4, 'v')); c.poly(E, face(1, 'v')); c.poly(N, face(3, None))
    # 모서리 능선(밝은 구리 띠)
    for (px_, py) in ((x0, y0), (x1, y0), (x0, y1), (x1, y1)):
        c.line(px_, py, ax, ay, 'copper', 4 if px_ < ax else 2)
    c.line(x0, y0, x1, y0, 'ink', 1); c.line(x0, y0, x0, y1, 'ink', 1); c.line(x1, y0, x1, y1, 'ink', 1)
    c.HL(x0, y1, x1 - x0 + 1, 'copper', 4); c.HL(x0, y1 + 1, x1 - x0 + 1, 'copper', 2); c.HL(x0, y1 + 2, x1 - x0 + 1, 'ink', 1)   # 처마 띠
    # 놋쇠 꼭지(구슬 + 피뢰침)
    c.ell(ax, ay - 1, 2.6, 1.8, lambda X, Y, dx, dy, d: ('brass', 5 if dx < 0 else 3))
    c.VL(ax - 1, ay - 16, 15, 'brass', 4); c.VL(ax, ay - 16, 15, 'brass', 2); c.P(ax - 1, ay - 17, 'brass', 5); c.ell(ax, ay - 8, 2, 1.2, lambda X, Y, dx, dy, d: ('brass', 4 if dx < 0 else 2))
    # 처마 밑 난간 갓(시계 층과 만나는 띠, 윗면 보인다)
    c.R(0, 43, 64, 2, 'stone', 5); c.HL(0, 43, 64, 'stone', 6); c.R(0, 45, 64, 2, 'stone', 2); c.HL(0, 47, 64, 'ink', 1)


CT_FACE = region('ct.face', 4, 2, _ct_face)
CT_SPIRE = region('ct.spire', 4, 3, _ct_spire)


def _pump_dome(c):
    """급수 펌프장 지붕 3칸×2줄: 평평한 돌 지붕 바닥(윗면 — 둘레 갓돌 + 앞 난간) 위에 앉은 작은 구리 돔(반구)."""
    # 돌 지붕 바닥(위에서 보인다): 뒤 갓돌(어두운 뒤 테) → 판석 → 앞 갓돌 + 앞면
    c.R(0, 10, 48, 18, 'stone', 4)
    for y in range(12, 25, 4): c.HL(1, y, 46, 'stone', 3)
    for x in range(8, 48, 12): c.VL(x, 12, 13, 'stone', 3)
    c.HL(0, 9, 48, 'ink', 1); c.R(0, 10, 48, 2, 'stone', 5); c.HL(0, 10, 48, 'stone', 2)
    c.R(0, 10, 3, 18, 'stone', 5); c.R(45, 10, 3, 18, 'stone', 3); c.VL(0, 9, 23, 'ink', 1); c.VL(47, 9, 23, 'ink', 1)
    c.R(0, 25, 48, 3, 'stone', 6); c.HL(0, 25, 48, 'stone', 5); c.R(0, 28, 48, 3, 'stone', 2); c.HL(0, 31, 48, 'ink', 1)
    # 돔(바닥 위 반구) + 둥근 받침 테
    cx, base, rx, ry = 24, 23, 15, 20
    c.ell(cx, base, rx + 1.5, 3.2, lambda X, Y, dx, dy, d: ('brass', 4 if dx < 0 else 2) if dy > -0.2 else None)
    for y in range(32):
        for x in range(48):
            dx = (x + 0.5 - cx) / rx; dy = (y + 0.5 - base) / ry
            d = dx * dx + dy * dy
            if d > 1 or y >= base: continue
            t = 4 if (dx < -0.25 and dy < -0.5) else 3 if dx < 0.15 else 2 if dx < 0.6 else 1
            if d > 0.9: t = 1
            m = 'copper'
            if (x % 6 == 3 and y > 8): m, t = 'verd', max(1, t - 1)
            if abs(x + 0.5 - cx) < 0.7: m, t = 'copper', 1
            c.P(x, y, m, t)
    c.HL(cx - rx, base, 2 * rx + 1, 'brass', 3); c.HL(cx - rx, base + 1, 2 * rx + 1, 'iron', 2)
    c.R(23, 0, 2, 5, 'brass', 4); c.P(23, 0, 'brass', 5)


PUMP_DOME = region('pd', 3, 2, _pump_dome)


def lab_roof_extras():
    pass


add_bld('clock-tower', '시계탑(다듬은 돌 밑동 + 벽돌 몸 + 놋쇠 시계 + 녹청 구리 모임지붕·피뢰침, 폭 4)',
        CT_SPIRE + CT_FACE + facade('rb', 4, 2, door=None) + facade('ds', 4, 1, door=1, door_kind='double', paint='green'), 1, 2,
        ['시계탑', '광장', '랜드마크'], '광장 북쪽 가운데 또는 큰길 끝. 둘레 2칸은 포석으로 비우고 쌍 가스등·벤치를 둔다.')
add_bld('guild-hall', '조합 회관(다듬은 돌 3층, 폭 8, 발코니·양개문)',
        roof_rows(8, 'mans', 3, dormers=(1, 6), chims=(0, 7)) + facade('ds', 8, 3, door=3, door_kind='double', paint='navy', balcony=(1,), piers={1: 'lamp', 6: 'lamp'}, lit_seed=31), 3, 2,
        ['회관', '광장', '관청'], '광장 북쪽. 문 앞 2칸 포석.')
add_bld('workshop', '기계 공방(벽돌 1층, 폭 6, 화물 문·천창)',
        roof_rows(6, 'flat', 2, rooftop={(1, 1): 'rt.sky', (2, 1): 'rt.sky', (4, 0): 'rt.vent'}, stacks=(5,)) + facade('rb', 6, 1, door=2, door_kind='cargo', piers={1: 'pipe', 4: 'gauge'}, lit_seed=33), 2, 2,
        ['공방', '공장', '거리'], '공장 거리. 화물 문 앞 마당에 상자·수레.')
add_bld('lab', '연구소(다듬은 돌 2층, 폭 6, 구리 돔·피뢰침)',
        roof_rows(6, 'flat', 3, rooftop={(2, 0): 'rt.dome.TL', (3, 0): 'rt.dome.TR', (2, 1): 'rt.dome.BL', (3, 1): 'rt.dome.BR', (5, 1): 'rt.vent', (0, 1): 'rt.sky'}) + facade('ds', 6, 2, door=2, door_kind='double', paint='green', piers={1: 'gauge', 4: 'pipe'}, lit_seed=35), 2, 2,
        ['연구소', '실험실'], '광장 옆·운하 옆 조용한 자리.')
add_bld('pump-house', '급수 펌프장(다듬은 돌 1층, 폭 3, 구리 돔)',
        PUMP_DOME + facade('ds', 3, 1, door=1, paint='green', piers={}, lit_seed=37), 1, 1,
        ['펌프장', '운하', '공장'], '운하·급수탑 옆.')
add_bld('dock-warehouse', '부두 창고(그을린 벽돌 3층, 폭 7, 하역 문 줄·도르래)',
        roof_rows(7, 'gab', 3, chims=(1,)) + facade('sb', 7, 3, door=3, door_kind='cargo', piers={1: 'plain', 5: 'lamp'}, upper={3: 'loft'}, lit_seed=39), 3, 2,
        ['창고', '부두', '운하'], '운하 북쪽 둑. 하역 문 앞은 판자·포석 하역장으로 비운다.')
add_bld('row-soot-4', '그을린 벽돌 노동자 주택(3층, 폭 4, 발코니)',
        roof_rows(4, 'gab', 2, chims=(0, 3)) + facade('sb', 4, 3, door=1, paint='green', balcony=(1,), piers={2: 'pipe'}, lit_seed=41), 1, 1,
        ['연립주택', '노동자', '공장 거리'], '공장 거리 뒤편에 어깨를 붙여.')
add_bld('row-flush-3', '붉은 벽돌 연립(양옆 잇는 3칸, 망사르드)',
        roof_rows(3, 'mans', 2, flush=True, dormers=(1,), chims=(0,)) + facade('rb', 3, 3, door=2, paint='red', balcony=(1,), lit_seed=43), 2, 1,
        ['연립주택', '집', '거리'], '연립 줄 가운데에 끼운다(양 끝은 row-3·row-4).')


def sheet(path=None, z=3):
    items = [(it['id'], R.render(it).img()) for it in R.items]
    return contact(items, path or os.path.join(OUT, 'buildings', 'preview.png'), z=z, W=2200)


if __name__ == '__main__':
    R.export(); sheet()
    print(len(R.items), 'buildings', len(B), 'blocks')
