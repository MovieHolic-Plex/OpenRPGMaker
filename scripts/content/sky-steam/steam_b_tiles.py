"""줄 B 바닥·오토타일·실내 벽바닥(kind terrain).

오토타일 두 가지:
  · 8방(블롭 47칸): 48×48 패치 + 16×16 안쪽 모서리 패치를 사분면 합성(wzlib.blob_tile 과 같은 규약: N1 E2 S4 W8 NE16 SE32 SW64 NW128).
    관문에는 [패치 | 안쪽 모서리] 64×48 한 장을 terrain 으로 받는다(47칸은 이 화소를 옮겨 붙인 것뿐).
  · 4방(16칸): 선로·관. 마스크 0..15 를 4×4 로 늘어놓은 64×64 한 장.
무늬는 모두 16px 주기라 사분면을 옮겨 붙여도 이음매가 맞는다.
"""
from __future__ import annotations
import math
import numpy as np
from steam_b_lib import *  # noqa: F401,F403
from steam_b_lib import hv, darken

T16 = 16


# ---------------------------------------------------------------- 16px 주기 무늬(절대 좌표)

def tex_flag(x, y, t=1):
    """보도 판석: 8×8 판, 판마다 색, 위·왼 빛 1px, 아래·오른 틈."""
    i, j = x % 16, y % 16
    row = j // 8; off = (row % 2) * 4
    n = ((i + off) % 16) // 8; ki = (i + off) % 8; kj = j % 8
    r = hv(n + row * 7, 3, 11)
    tt = t + (-1 if r < .3 else (1 if r > .8 else 0))
    if kj == 7 or ki == 7: return K('stone', t - 2)
    if kj == 0 or ki == 0: return K('stone', tt + 1)
    if (ki * 3 + kj * 5 + n) % 23 == 0: return K('stone', tt - 1)
    return K('stone', tt)


def tex_cobble(x, y, t=-1):
    """자갈(둥근 돌 4×3 + 틈): 줄마다 엇갈림. 돌마다 위왼 빛·아래오른 그림자."""
    i, j = x % 16, y % 16
    row = j // 4; kj = j % 4
    off = (row % 2) * 2
    n = ((i + off) % 16) // 4; ki = (i + off) % 4
    r = hv(n + row * 5, 9, 4)
    tt = t + (-1 if r < .3 else (1 if r > .82 else 0))
    if kj == 3 or ki == 3: return K('stone', t - 3) if (kj == 3 and ki == 3) or r < .5 else K('stone', t - 2)
    if (kj == 0 and ki in (0,)) : return K('stone', tt)
    if kj == 0 or ki == 0: return K('stone', tt + 1)
    if kj == 2 and ki == 2: return K('stone', tt - 1)
    return K('stone', tt)


def tex_yard(x, y, t=-1):
    """공장 마당: 다진 흙 + 석탄재 알갱이(작은 2px 덩이), 바퀴 자국 없음(어디서나 같은 결)."""
    i, j = x % 16, y % 16
    r = hv(i // 2, j // 2, 21)
    tt = t + (1 if r > .78 else 0) - (1 if r < .2 else 0)
    col = K('earth', tt)
    if (i * 7 + j * 11) % 29 == 0: col = K('soot', -2)
    if (i * 5 + j * 13) % 37 == 0: col = K('soot', -3)
    if (i * 3 + j * 17) % 41 == 0: col = K('earth', t + 2)
    return col


def tex_brickpave(x, y, t=0):
    """벽돌 포장(헤링본 대신 엇갈린 눕힌 벽돌 8×4)."""
    i, j = x % 16, y % 16
    row = j // 4; kj = j % 4; off = (row % 2) * 4
    n = ((i + off) % 16) // 8; ki = (i + off) % 8
    r = hv(n + row * 3, 2, 31)
    tt = t + (-1 if r < .3 else (1 if r > .85 else 0))
    if kj == 3 or ki == 7: return K('brick', t - 3)
    if kj == 0: return K('brick', tt + 1)
    return K('brick', tt)


def tex_plate(x, y, t=0):
    """리벳 강판 바닥(위에서 본 판): 16×16 판 하나, 이음 어둠 + 이음 아래 빛, 모서리 리벳, 판 가운데 줄무늬 돌기."""
    i, j = x % 16, y % 16
    if i == 15 or j == 15: return K('iron', t - 2)
    if i == 0 or j == 0: return K('iron', t + 1)
    if i in (2, 13) and j in (2, 13): return K('iron', t + 3)
    if i in (2, 13) and j in (3, 14): return K('iron', t - 2)
    a = (i // 3 + j // 2) % 2
    if 3 < i < 12 and 3 < j < 12:
        if i % 3 == 1 and j % 4 == (0 if a else 2): return K('iron', t + 2)
        if i % 3 == 2 and j % 4 == (1 if a else 3): return K('iron', t - 1)
    return K('iron', t)


def tex_grate(x, y, t=0):
    i, j = x % 16, y % 16
    a, b = i % 4, j % 4
    if a == 0 or b == 0: return K('iron', t + 1 if b == 0 else t)
    if b == 1: return K('iron', t - 3)
    return K('soot', -4) if (a + b) % 2 else K('iron', -4)


def tex_planks(x, y, t=0):
    """실내 판자 바닥(가로 판 4px, 판 끝 엇갈림)."""
    i, j = x % 16, y % 16
    row = j // 4; kj = j % 4
    endx = (row * 7) % 16
    r = hv(row, (i - endx) % 16 // 8, 41)
    tt = t + (-1 if r < .3 else (1 if r > .8 else 0))
    if kj == 3: return K('wood', t - 2)
    if i == endx: return K('wood', t - 2)
    if kj == 0: return K('wood', tt + 1)
    if (i + row * 5) % 11 == 0 and kj == 1: return K('wood', tt - 1)
    return K('wood', tt)


def tex_checker(x, y, t=0):
    """여관·연구소 바닥: 크림·적갈 바둑 타일 8×8, 타일마다 위왼 빛."""
    i, j = x % 16, y % 16
    a = ((i // 8) + (j // 8)) % 2
    ki, kj = i % 8, j % 8
    ramp, tt = ('canvas', t + 2) if a else ('red', t - 1)
    if ki == 7 or kj == 7: return K('soot', -3)
    if ki == 0 or kj == 0: return K(ramp, tt + 1)
    return K(ramp, tt)


def fill(c, x, y, w, h, tex, **kw):
    for j in range(h):
        for i in range(w):
            c.P(x + i, y + j, tex(x + i, y + j, **kw))


# ---------------------------------------------------------------- 8방 블롭 오토타일

def _sdf_patch(x, y):
    """48×48 패치 안쪽까지 거리(바깥 고리 8px 안에서 경계, 모서리 둥글게 r=4)."""
    cx, cy = min(x + .5, 48 - x - .5), min(y + .5, 48 - y - .5)
    r = 4.0
    if cx < r and cy < r: return r - math.hypot(r - cx, r - cy)
    return min(cx, cy)


def _sdf_icorner(x, y):
    """16×16 안쪽 모서리: 네 귀퉁이에서 오목하게 파인 바깥(반지름 4.5)."""
    i, j = x + .5, y + .5
    d = min(math.hypot(i - a, j - b) for a in (0, 16) for b in (0, 16))
    return d - 4.0


def blob_source(draw_px):
    """draw_px(c, x, y, d, side) — d = 안쪽까지 거리(<0 바깥), side = 'N'|'S'|'W'|'E'|None(가장 가까운 경계 방향).
    반환 Cv(64,48): 왼쪽 48×48 패치, 오른쪽 위 16×16 안쪽 모서리."""
    c = Cv(64, 48)
    for y in range(48):
        for x in range(48):
            d = _sdf_patch(x, y)
            ds = {'N': y + .5, 'S': 48 - y - .5, 'W': x + .5, 'E': 48 - x - .5}
            side = min(ds, key=ds.get)
            draw_px(c, x, y, d, side, x, y)
    for y in range(16):
        for x in range(16):
            d = _sdf_icorner(x, y)
            # 안쪽 모서리에서 경계 방향: 위 귀퉁이면 바깥이 위쪽(경계면이 북쪽) → 'N' 취급
            side = 'N' if y < 8 else 'S'
            draw_px(c, 48 + x, y, d + 4.0 - 4.0, side, x, y)
    return c


def curb_px(inner_tex, outer_tex, kerb=2.5):
    """도로(안) ↔ 보도(밖) 연석: d<0 보도, 0..kerb 화강암 연석(윗면 빛), 북쪽 경계에는 연석 앞면(남향) 2px 그림자가 더 보인다."""
    def draw(c, X, Y, d, side, tx, ty):
        if d < 0: c.P(X, Y, outer_tex(tx, ty)); return
        if d < 1: c.P(X, Y, K('stone', 3)); return
        if d < kerb: c.P(X, Y, K('stone', 1 if (tx // 4 + ty // 4) % 2 else 2)); return
        if side == 'N' and d < kerb + 2.2: c.P(X, Y, K('stone', -2 if d < kerb + 1.2 else -3)); return
        if d < kerb + 1: c.P(X, Y, K('stone', -3)); return
        c.P(X, Y, inner_tex(tx, ty))
    return draw


def deck_px(c, X, Y, d, side, tx, ty):
    """비공정 부두 갑판(밖 = 투명, 하늘이 보임): 가장자리 놋쇠 테 + 경고 띠, 남쪽 경계에는 갑판 두께(앞면 거더) 5px."""
    if side == 'S':
        if d < 0: return
        if d < 4: c.P(X, Y, K('iron', -2 if d < 1 else (-1 if d < 2.5 else 0)) if (tx % 4) else K('iron', -3)); return
        if d < 5: c.P(X, Y, K('iron', 3)); return
    if d < 0: return
    if d < 1: c.P(X, Y, OL); return
    if d < 2.5: c.P(X, Y, K('brass', 2 if side in ('N', 'W') else 0)); return
    if d < 4: c.P(X, Y, K('brass', 3) if (tx // 3 + ty // 3) % 2 else K('iron', -3)); return
    c.P(X, Y, tex_plate(tx, ty, 0))


@piece('steam-at-cobble', '오토타일: 자갈 차도(보도 연석)', 4, 3, kind='terrain', line='B', tags=['오토타일', '차도', '자갈'])
def at_cobble(c):
    src = blob_source(curb_px(lambda x, y: tex_cobble(x, y, -1), lambda x, y: tex_flag(x, y, 1)))
    c.a[:] = src.a


@piece('steam-at-yard', '오토타일: 공장 마당 흙(보도 경계)', 4, 3, kind='terrain', line='B', tags=['오토타일', '공장 마당'])
def at_yard(c):
    src = blob_source(curb_px(lambda x, y: tex_yard(x, y, -1), lambda x, y: tex_flag(x, y, 1), kerb=2))
    c.a[:] = src.a


@piece('steam-at-brickpave', '오토타일: 벽돌 포장 광장(보도 경계)', 4, 3, kind='terrain', line='B', tags=['오토타일', '광장', '벽돌'])
def at_brickpave(c):
    src = blob_source(curb_px(lambda x, y: tex_brickpave(x, y, 0), lambda x, y: tex_flag(x, y, 1), kerb=2))
    c.a[:] = src.a


@piece('steam-at-deck', '오토타일: 비공정 부두 강판 갑판(밖=하늘)', 4, 3, kind='terrain', line='B', tags=['오토타일', '부두', '갑판'])
def at_deck(c):
    src = blob_source(deck_px)
    c.a[:] = src.a


# ---------------------------------------------------------------- 4방(16칸) 선로·관

def lanes_tile(m, lanes, base=None, ties=None, junction=None, cap=None):
    """마스크 m(N1 E2 S4 W8)의 16×16 칸. lanes = [(중심 오프셋 s0, 반폭, 램프, 종류)] — 종류 'pipe'(원통 음영) | 'rail'(레일 머리).
    s 좌표: 남북 직선은 x, 동서 직선은 y, 굽은 칸은 모서리에서의 거리. ties = 침목 그리기(c, 형태) 함수."""
    c = Cv(16, 16)
    if base:
        for y in range(16):
            for x in range(16): c.P(x, y, base(x, y))
    N, E, S, W = bool(m & 1), bool(m & 2), bool(m & 4), bool(m & 8)
    n = N + E + S + W
    shapes = []                 # (s(x,y)->(s, along, nx, ny) or None)
    def ns(x, y, lo=0, hi=16):
        return (x + .5, y + .5, 1, 0) if lo <= y + .5 <= hi else None
    def ew(x, y, lo=0, hi=16):
        return (y + .5, x + .5, 0, 1) if lo <= x + .5 <= hi else None
    def arc(cx, cy):
        def f(x, y):
            dx, dy = x + .5 - cx, y + .5 - cy
            r = math.hypot(dx, dy)
            if r > 16: return None
            # s 는 N/S 변에서 x, E/W 변에서 y 와 일치하도록: 반지름이 곧 모서리에서의 거리
            s = r if cx == 0 else 16 - r
            if cy == 0 and cx == 0: s = r
            nx, ny = (dx / max(r, 1e-6), dy / max(r, 1e-6))
            if cx == 16: nx, ny = -nx, -ny
            return (s, math.atan2(dy, dx) * r, nx, ny)
        return f
    if n == 2 and N and S: shapes.append(ns)
    elif n == 2 and E and W: shapes.append(ew)
    elif n == 2:
        cx = 16 if E else 0; cy = 0 if N else 16
        shapes.append(arc(cx, cy))
    else:
        if N and S: shapes.append(ns)
        elif N: shapes.append(lambda x, y: ns(x, y, 0, 9))
        elif S: shapes.append(lambda x, y: ns(x, y, 7, 16))
        if E and W: shapes.append(ew)
        elif E: shapes.append(lambda x, y: ew(x, y, 7, 16))
        elif W: shapes.append(lambda x, y: ew(x, y, 0, 9))
        if n == 0: shapes.append(lambda x, y: ew(x, y, 3, 13))
    if ties:
        for sh in shapes: ties(c, sh)
    for sh in shapes:
        for y in range(16):
            for x in range(16):
                g = sh(x, y)
                if g is None: continue
                s, along, nx, ny = g
                for (s0, hw, ramp, kind) in lanes:
                    u = (s - s0) / hw
                    if abs(u) > 1: continue
                    if kind == 'pipe':
                        b = -u * (nx * .6 + ny * .8)
                        tt = 2 if b > .45 else (1 if b > .1 else (0 if b > -.25 else (-1 if b > -.6 else -2)))
                        if abs(u) > .82: tt = -3
                        c.P(x, y, K(ramp, tt))
                    else:  # rail
                        c.P(x, y, K(ramp, 3 if u < 0 else 0))
    # 관 이음 고리(놋쇠): 직선 칸 가운데에 한 번
    if junction and n >= 3: junction(c)
    if cap and n == 1: cap(c, N, E, S, W)
    return c


RAIL_LANES = [(4.5, 1.0, 'iron', 'rail'), (11.5, 1.0, 'iron', 'rail')]
PIPE_LANES = [(8.0, 4.4, 'copper', 'pipe'), (2.0, 1.5, 'iron', 'pipe'), (14.0, 1.5, 'iron', 'pipe')]


def rail_ties(c, sh):
    """침목: 레일과 직각 짧은 나무 판(along 4px 마다 2px), 레일 바깥 1px 까지."""
    for y in range(16):
        for x in range(16):
            g = sh(x, y)
            if g is None: continue
            s, along, nx, ny = g
            if 2.2 <= s <= 13.8 and int(math.floor(along)) % 4 in (0, 1):
                c.P(x, y, K('wood', -1 if int(math.floor(along)) % 4 == 0 else -2))


def ballast(x, y):
    i, j = x % 16, y % 16
    r = hv(i, j, 51)
    return K('stone', -2 + (r > .55) + (r > .88) - (r < .12))


def pipe_junction(c):
    """관 분기점: 놋쇠 이음 상자(윗면 + 앞면) + 위에 붉은 밸브 손바퀴."""
    top_slab(c, 3, 3, 10, 5, 'brass', 0)
    front(c, 3, 8, 10, 4, 'brass', -1)
    c.HL(5, 4, 6, K('red', 1)); c.VL(8, 3, 3, K('red', 0)); c.P(8, 4, K('brass', 4))


def pipe_cap(c, N, E, S, W):
    """관 끝: 놋쇠 막음 테(두꺼운 고리)."""
    if N: c.R(2, 8, 13, 2, K('brass', 1)); c.HL(2, 8, 13, K('brass', 3))
    if S: c.R(2, 6, 13, 2, K('brass', 1)); c.HL(2, 6, 13, K('brass', 3))
    if E: c.R(6, 2, 2, 13, K('brass', 1)); c.VL(6, 2, 13, K('brass', 3))
    if W: c.R(8, 2, 2, 13, K('brass', 1)); c.VL(8, 2, 13, K('brass', 3))


def rail_buffer(c, N, E, S, W):
    if N: c.R(3, 8, 10, 3, K('red', 0)); c.HL(3, 8, 10, K('red', 2))
    if S: c.R(3, 5, 10, 3, K('red', 0)); c.HL(3, 5, 10, K('red', 2))
    if E: c.R(5, 3, 3, 10, K('red', 0)); c.VL(5, 3, 10, K('red', 2))
    if W: c.R(8, 3, 3, 10, K('red', 0)); c.VL(8, 3, 10, K('red', 2))


def sixteen(c, make):
    for m in range(16):
        t = make(m)
        c.a[(m // 4) * 16:(m // 4) * 16 + 16, (m % 4) * 16:(m % 4) * 16 + 16] = t.a


@piece('steam-at-rail', '오토타일(4방): 자갈 바닥 선로(침목·레일)', 4, 4, kind='terrain', line='B', tags=['오토타일', '선로', '철도'])
def at_rail(c):
    sixteen(c, lambda m: lanes_tile(m, RAIL_LANES, base=ballast, ties=rail_ties, cap=rail_buffer))


@piece('steam-at-tramrail', '오토타일(4방): 자갈 차도에 묻힌 전차 선로', 4, 4, kind='terrain', line='B', tags=['오토타일', '전차', '차도'])
def at_tramrail(c):
    def grooves(cc, sh):
        for y in range(16):
            for x in range(16):
                g = sh(x, y)
                if g is None: continue
                s = g[0]
                for s0 in (4.5, 11.5):
                    if abs(s - s0) <= 1.6: cc.P(x, y, K('stone', -3))
    sixteen(c, lambda m: lanes_tile(m, RAIL_LANES, base=lambda x, y: tex_cobble(x, y, -1), ties=grooves))


@piece('steam-at-pipe', '오토타일(4방): 바닥 배관 통로(구리관 + 쇠관, 분기 밸브)', 4, 4, kind='terrain', line='B', tags=['오토타일', '배관', '관'])
def at_pipe(c):
    sixteen(c, lambda m: lanes_tile(m, PIPE_LANES, junction=pipe_junction, cap=pipe_cap))


# ---------------------------------------------------------------- 채움 칸(변형 4)

def variants(c, tex, n=4, **kw):
    for k in range(n):
        fill(c, k * 16, 0, 16, 16, tex, **kw)
        # 변형 = 같은 무늬 + 칸마다 다른 작은 얼룩(16px 주기는 유지)
        for (i, j) in [((k * 5 + 3) % 14 + 1, (k * 7 + 5) % 14 + 1), ((k * 11 + 9) % 14 + 1, (k * 3 + 2) % 14 + 1)]:
            if k: darken(c, k * 16 + i, j, 1)


@piece('steam-t-flag', '보도 판석(채움 4변형)', 4, 1, kind='terrain', line='B', tags=['바닥', '보도'])
def t_flag(c): variants(c, tex_flag, t=1)


@piece('steam-t-cobble', '자갈 차도(채움 4변형)', 4, 1, kind='terrain', line='B', tags=['바닥', '차도'])
def t_cobble(c): variants(c, tex_cobble, t=-1)


@piece('steam-t-yard', '공장 마당 흙(채움 4변형)', 4, 1, kind='terrain', line='B', tags=['바닥', '공장 마당'])
def t_yard(c): variants(c, tex_yard, t=-1)


@piece('steam-t-grate', '쇠 격자 바닥(채움 2) + 증기 새는 격자', 3, 1, kind='terrain', line='B', tags=['바닥', '격자', '보일러실'])
def t_grate(c):
    fill(c, 0, 0, 16, 16, tex_grate, t=0); fill(c, 16, 0, 16, 16, tex_grate, t=-1)
    fill(c, 32, 0, 16, 16, tex_grate, t=0)
    for (i, j) in ((5, 6), (6, 6), (9, 10), (10, 9), (6, 11)):
        c.P(32 + i, j, K('cloud', 1)); c.P(32 + i, j - 1, K('cloud', 3))


@piece('steam-t-floor', '실내 바닥(판자 2·강판 2·바둑 타일 2)', 6, 1, kind='terrain', line='B', tags=['실내', '바닥'])
def t_floor(c):
    fill(c, 0, 0, 16, 16, tex_planks, t=0); fill(c, 16, 0, 16, 16, tex_planks, t=-1)
    fill(c, 32, 0, 16, 16, tex_plate, t=0); fill(c, 48, 0, 16, 16, tex_plate, t=-1)
    fill(c, 64, 0, 16, 16, tex_checker, t=0); fill(c, 80, 0, 16, 16, tex_checker, t=-1)


# ---------------------------------------------------------------- 실내 벽(천장 윗면 + 벽 앞면 2칸)

def wall_face(c, x, y, mat, variant=0):
    """벽 앞면 16×32: 위 처마 그림자, 벽 재질, 아래 걸레받이(나무). variant 1 = 벽 관 2줄, 2 = 작은 창, 3 = 압력계 판."""
    if mat == 'brick':
        brick(c, x, y, 16, 32, 'brick', -1, bw=7, bh=2, seed=x * 3)
        for j in range(20, 30):
            for i in range(16):
                c.P(x + i, y + j, K('wood', -1 if j > 20 else 1) if (i % 4) else K('wood', -2))
        c.HL(x, y + 20, 16, K('wood', 2)); c.HL(x, y + 21, 16, K('wood', 0))
    elif mat == 'plate':
        plate(c, x, y, 16, 32, 'iron', -1, pw=16, ph=10, seed=x)
        c.HL(x, y + 26, 16, K('brass', 2)); c.HL(x, y + 27, 16, K('brass', -1))
    elif mat == 'paper':     # 여관·연구소: 줄무늬 벽지 + 나무 징두리
        for j in range(20):
            for i in range(16):
                c.P(x + i, y + j, K('canvas', 1) if (i % 4) else K('red', -1))
        for j in range(20, 30):
            for i in range(16): c.P(x + i, y + j, K('wood', -1) if (i % 8) else K('wood', -3))
        c.HL(x, y + 20, 16, K('wood', 2)); c.HL(x, y + 21, 16, K('wood', 0))
    c.HL(x, y, 16, K('soot', -4)); c.HL(x, y + 1, 16, K('soot', -3))          # 천장 밑 그림자
    c.HL(x, y + 30, 16, K('soot', -3)); c.HL(x, y + 31, 16, K('soot', -4))    # 바닥과 닿는 선
    if variant == 1:
        for py in (6, 12):
            pipe_h(c, x, y + py, 16, d=3, ramp='copper' if py == 6 else 'iron', ol=False)
        c.R(x + 6, y + 5, 2, 5, K('brass', 1)); c.R(x + 6, y + 11, 2, 5, K('brass', 0))
    elif variant == 2:
        arch_window(c, x + 4, y + 6, 8, 9, lit=False, arch=(mat == 'brick'), panes=(2, 2), sill=True)
    elif variant == 3:
        c.R(x + 3, y + 5, 10, 10, K('brass', -1)); c.HL(x + 3, y + 5, 10, K('brass', 2))
        for (gx, gy) in ((6, 9), (10, 9)):
            c.ell(x + gx, y + gy, 1.6, 1.6, K('canvas', 3)); c.P(x + gx, y + gy, K('red', 0))
        c.HL(x + 5, y + 13, 6, K('iron', -2))


def ceiling(c, x, y, t=-3):
    """천장(벽 윗면, 지도에서 방 바깥 테): 아주 어두운 판 + 위·왼쪽 테 빛 1px."""
    for j in range(16):
        for i in range(16):
            c.P(x + i, y + j, K('soot', t if (i + j) % 7 else t - 1))
    c.HL(x, y + 15, 16, K('brass', -2))


@piece('steam-t-wall', '실내 벽: 천장(테) + 벽 앞면 2칸(벽돌·강판·벽지 × 민·관·창·계기)', 9, 3, kind='terrain', line='B', tags=['실내', '벽'])
def t_wall(c):
    k = 0
    for mat, vs in (('brick', (0, 1, 2)), ('plate', (0, 1, 3)), ('paper', (0, 2, 3))):
        for v in vs:
            ceiling(c, k * 16, 0)
            wall_face(c, k * 16, 16, mat, v)
            k += 1
