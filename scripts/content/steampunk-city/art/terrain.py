#!/usr/bin/env python3
"""steampunk_city 바닥 — 한 칸(16px) 반복 바닥과 2칸 선로·물가 조각. 무늬는 16 주기라 이어 칠해도 이음새가 없다.

  python3 terrain.py     # tiledata/steampunk-city/terrain/_gate/*.png + preview
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from px import C, rnd, h32, tex_brick, tex_cluster
from kit import Reg, contact, OUT

R = Reg('terrain')

# ── 자갈 포석(setts) ── 화풍 정렬 2026-10-14: 돌 하나하나가 읽히게(버들항 판석 문법 — 윗면 빛 줄·몸·밑/오른쪽 그늘·줄눈)
SETT_YS = [(0, 5), (5, 10), (10, 16)]                         # 줄(돌 4·4·5 + 줄눈 1)
SETT_XS = [[0, 8], [4, 11], [2, 9]]                           # 줄마다 돌 경계(16 주기) — 폭 7~9, 엇갈림


def sett_of(lx, ly):
    """(돌 번호, 돌 안 x, 돌 폭, 돌 안 y, 돌 높이)."""
    for r, (y0, y1) in enumerate(SETT_YS):
        if y0 <= ly < y1: break
    yy, sh = ly - y0, y1 - y0
    b = SETT_XS[r]
    for k in range(len(b)):
        x0 = b[k]; x1 = b[(k + 1) % len(b)] + (16 if k == len(b) - 1 else 0)
        xx = (lx - x0) % 16
        if xx < x1 - x0: return (r * 4 + k, xx, x1 - x0, yy, sh)
    return (0, 0, 5, yy, sh)


def cobble(c, x, y, w, h, base=3, s=1, oil=0.0, mat='stone', soot=0.12, wear=0.07, moss=0.0):
    """돌 셋트: 돌마다 몸 단(base-1~base+1)이 다르고, 윗줄 = 몸+1(왼쪽 두 화소 몸+2 빛), 맨 아래 줄·오른쪽 끝 = 몸-1,
    위 두 모서리를 깎아 둥글게, 줄눈 = 단 1(먹 아님). 드물게 그을린 돌(석탄재 램프)·잔 마모 점·줄눈 이끼."""
    def f(wx, wy, i, j):
        lx, ly = wx % 16, wy % 16
        sid, xx, sw, yy, sh = sett_of(lx, ly)
        tilex, tiley = wx // 16, wy // 16
        if yy == sh - 1 or xx == sw - 1:
            if moss and rnd(lx, ly, s + 41) < moss: return ('moss', 1 if rnd(lx, ly, s + 43) < 0.6 else 2)
            if yy == sh - 1: return (mat, 1 if rnd(lx, ly, s + 9) < 0.85 else 2)     # 가로 줄눈 = 돌 밑 그림자
            return (mat, 2 if rnd(lx, ly, s + 9) < 0.75 else 1)                      # 세로 줄눈은 한 단 밝게
        if yy == 0 and xx in (0, sw - 2): return (mat, 2)
        v = h32(sid, tilex * 7 + tiley * 13, s) % 12
        t = base + (1 if v >= 8 else 0) - (1 if v <= 1 else 0)
        m = mat
        if rnd(sid, tilex + tiley * 3, s + 77) < soot: m = 'cinder'; t = 3 if v >= 6 else 2
        if yy == 0 and xx < sw - 3: t += 1                                          # 윗면 빛 줄(오른쪽 끝은 안 닿는다)
        if yy == 0 and xx in (1, 2) and m == mat and v % 3 == 0: t += 1             # 몇 돌만 반짝
        if xx == sw - 2 and yy > 0: t -= 1                                          # 오른쪽 끝 그늘(빛은 왼쪽 위)
        elif yy == sh - 2 and sh >= 5 and xx > 1: t -= 1                            # 큰 돌만 밑 그늘
        q = rnd(lx, ly, s + 23)
        if 0 < yy < sh - 2 and 0 < xx < sw - 2:
            if q < wear: t -= 1
            elif q > 1 - wear * 0.6: t += 1
        if oil and rnd(wx // 3, wy // 3, s + 31) < oil: t = min(t, base - 1)
        return (m, t)
    c.F(x, y, w, h, f)


@R.add('cobble', '자갈 포석(돌 셋트)', 1, 1, 'terrain', tags=['길', '도로', '포석'], rules='차도·광장 바닥. 넓게 칠한다.')
def _(c): cobble(c, 0, 0, 16, 16)


@R.add('cobble-b', '자갈 포석(얼룩 변주)', 1, 1, 'terrain', tags=['길', '도로'], rules='자갈 포석 사이에 드문드문 섞는다(덩이 잡음).')
def _(c):
    cobble(c, 0, 0, 16, 16, s=5, soot=0.3, wear=0.1)


@R.add('cobble-c', '자갈 포석(이끼 낀 줄눈·금 간 돌 변주)', 1, 1, 'terrain', tags=['길', '도로'], rules='자갈 포석 사이에 낱칸으로 섞는다(반복 깨기).')
def _(c):
    cobble(c, 0, 0, 16, 16, s=21, soot=0.08, wear=0.05, moss=0.2)
    for (x, y) in ((8, 6), (9, 7), (9, 8)): c.P(x, y, 'stone', 1)          # 금 간 돌
    c.P(10, 7, 'stone', 2)


@R.add('cobble-oil', '기름 밴 자갈 포석', 1, 1, 'terrain', tags=['길', '공장', '마당'], rules='공장 앞·선로 곁 자갈. 덩이로 섞는다.')
def _(c):
    cobble(c, 0, 0, 16, 16, s=7)
    def f(wx, wy, i, j):
        r = ((i - 8) ** 2) / 40 + ((j - 9) ** 2) / 22
        g = c.get(i, j)
        if r < 1 and g and g[1] >= 2: return ('cinder', 2 if r < 0.45 else 3)
        return None
    c.F(0, 0, 16, 16, f)
    c.P(6, 8, 'iron', 4); c.P(9, 10, 'iron', 3)


# ── 판석 보도 ── 버들항 판석 문법: 판 안쪽 윗줄·왼줄 빛, 밑줄·오른줄 그늘, 줄눈 어둡게, 드문 잔점
FLAG_ROWS = [[4, 14], [9], [2, 10], [7, 14]]     # 줄(높이 8)마다 판 경계 — 폭이 들쭉날쭉해야 바둑판으로 안 보인다


def flag(c, x, y, w, h, base=5, s=2, slab=8, rows=FLAG_ROWS, crack=False):
    def f(wx, wy, i, j):
        lx, ly = wx % 16, wy % 16
        row = (ly // slab) % 2 + (2 if s % 2 else 0)
        b = rows[row % len(rows)]
        yy = ly % slab
        k = 0
        for kk, x0 in enumerate(b):
            if lx >= x0: k = kk
        x0 = b[k] if lx >= b[0] else b[-1] - 16
        xx = lx - x0 if lx >= b[0] else lx + 16 - b[-1]
        nxt = b[k + 1] if (lx >= b[0] and k + 1 < len(b)) else b[0] + 16
        if lx < b[0]: nxt = b[0]
        last = (nxt - 1 - x0) % 16
        if yy == slab - 1 or xx == last: return ('stone', base - 2 if rnd(lx, ly, s) < 0.75 else base - 3)
        sk = (k if lx >= b[0] else len(b) - 1) + row * 3
        tb = base - (1 if h32(sk, 0, s + 5) % 5 == 0 else 0)
        t = tb
        if yy == 0 or xx == 0: t = tb + 1
        elif yy == slab - 2 or xx == last - 1: t = tb - 1
        else:
            q = rnd(lx, ly, s + 4)
            if q < 0.06: t = tb - 1
            elif q > 0.95: t = tb + 1
        return ('stone', min(6, t))
    c.F(x, y, w, h, f)


@R.add('flag', '판석 보도', 1, 1, 'terrain', tags=['보도', '인도'], rules='건물 앞 보도. 문 앞 접근칸은 이 바닥이다.')
def _(c): flag(c, 0, 0, 16, 16)


@R.add('flag-c', '판석 보도(금 간·닳은 판 변주)', 1, 1, 'terrain', tags=['보도', '인도'], rules='판석 보도 사이에 낱칸으로 섞는다(반복 깨기).')
def _(c):
    flag(c, 0, 0, 16, 16, s=12)
    for (x, y) in ((3, 2), (4, 3), (4, 4), (5, 5)): c.P(x, y, 'stone', 3)     # 금
    c.P(5, 4, 'stone', 6)
    for (x, y) in ((11, 10), (12, 10), (11, 11), (12, 12)): c.P(x, y, 'stone', 4)   # 닳은 얼룩


def curb_face(c, y0, n=3):
    """연석 앞면 띠: 돌 블록(8px)마다 왼쪽 빛·오른쪽 그늘, 위 모서리 빛 줄."""
    for x in range(16):
        bx = x % 8
        for k in range(n):
            t = 5 if k == 0 else 4
            if bx == 0: t += 1
            elif bx == 6: t -= 1
            if bx == 7: t = 2
            c.P(x, y0 + k, 'stone', min(6, t))


@R.add('curb-s', '보도 연석(남쪽 차도로 턱)', 1, 1, 'terrain', tags=['보도', '연석'], rules='보도의 남쪽 끝 줄. 바로 아래 줄은 차도(자갈).')
def _(c):
    flag(c, 0, 0, 16, 11)
    c.HL(0, 10, 16, 'stone', 3)
    c.HL(0, 11, 16, 'stone', 6)
    curb_face(c, 12, 2)
    c.HL(0, 14, 16, 'stone', 2); c.HL(0, 15, 16, 'stone', 1)


@R.add('curb-n', '보도 연석(북쪽 차도에서 오르는 턱)', 1, 1, 'terrain', tags=['보도', '연석'], rules='보도의 북쪽 끝 줄. 바로 위 줄은 차도.')
def _(c):
    flag(c, 0, 0, 16, 16)
    c.HL(0, 0, 16, 'stone', 1); c.HL(0, 1, 16, 'stone', 6)
    curb_face(c, 2, 2)
    c.HL(0, 4, 16, 'stone', 3)


# ── 벽돌 포석(광장) ── 8×8 바구니 짜임(가로 두 장 / 세로 두 장 엇갈림), 벽돌마다 단이 다르고 윗/왼 빛·밑/오른 그늘, 모래 줄눈
def brickpave(c, s=4, soot=0.08, chip=0.0):
    def f(wx, wy, i, j):
        lx, ly = wx % 16, wy % 16
        bx, by = lx // 8, ly // 8; xx, yy = lx % 8, ly % 8
        horiz = (bx + by) % 2 == 0
        if horiz: half = yy // 4; u, v = xx, yy % 4; L, H = 8, 4
        else: half = xx // 4; u, v = yy, xx % 4; L, H = 8, 4
        # u = 벽돌 긴 축 위치, v = 짧은 축 위치
        if v == H - 1 or u == L - 1: return ('stone', 2 if rnd(lx, ly, s) < 0.7 else 1)
        bid = (bx * 2 + by * 5 + half * 11)
        hv = h32(bid, 0, s) % 9
        t = 4 + (1 if hv >= 6 else 0) - (1 if hv <= 1 else 0)
        m = 'brick'
        if rnd(bid, 1, s + 3) < soot: m = 'soot'; t = 4
        # 빛은 왼쪽 위: 벽돌 안쪽 윗줄·왼줄 빛, 밑줄·오른줄 그늘(가로·세로 벽돌 모두 화면 기준)
        ty, tx = (v, u) if horiz else (u, v)          # 벽돌 안 화면 y, x
        bh, bw = (H, L) if horiz else (L, H)
        if ty == 0 or tx == 0: t += 1
        if ty == 0 and tx == 0: t += 1
        if ty == bh - 2 or tx == bw - 2: t -= 1
        q = rnd(lx, ly, s + 8)
        if q < 0.05: t -= 1
        if chip and rnd(bid, 2, s + 9) < chip and q > 0.6: return ('stone', 3)
        return (m, max(1, min(6 if m == 'brick' else 5, t)))
    c.F(0, 0, 16, 16, f)


@R.add('brickpave', '벽돌 바구니 포석(광장)', 1, 1, 'terrain', tags=['광장', '포석'], rules='광장·시장 바닥.')
def _(c): brickpave(c)


@R.add('brickpave-b', '벽돌 바구니 포석(그을린·이 빠진 벽돌 변주)', 1, 1, 'terrain', tags=['광장', '포석'], rules='벽돌 포석 사이에 낱칸으로 섞는다(반복 깨기).')
def _(c): brickpave(c, s=17, soot=0.22)


# ── 철판 바닥 ──
def tread(c, x, y, w, h, base=3):
    def f(wx, wy, i, j):
        lx, ly = wx % 16, wy % 16
        if lx == 15 or ly == 15: return ('iron', 1)
        if lx == 0 or ly == 0: return ('iron', base + 1)
        if (lx in (2, 13) and ly in (2, 13)): return ('iron', 6)
        if (lx in (3, 14) and ly in (3, 14)): return ('iron', 1)
        # 줄무늬 돌기(사선 짧은 막대, 엇갈림)
        k = (lx + (4 if (ly // 4) % 2 else 0)) % 8
        if ly % 4 == 1 and k in (1, 2): return ('iron', base + 2)
        if ly % 4 == 2 and k in (2, 3): return ('iron', base - 1)
        return ('iron', base)
    c.F(x, y, w, h, f)


@R.add('tread', '줄무늬 철판 바닥', 1, 1, 'terrain', tags=['철판', '공장', '정거장'], rules='공장 안마당·하역장·다리 위 바닥.')
def _(c): tread(c, 0, 0, 16, 16)


@R.add('grate', '배수 철창(자갈 속)', 1, 1, 'terrain', tags=['길', '철창'], rules='차도 가장자리에 드물게. 증기 구멍과 다르다.')
def _(c):
    cobble(c, 0, 0, 16, 16, s=3)
    c.R(2, 4, 12, 8, 'iron', 1); c.HL(2, 4, 12, 'ink', 1)
    for x in range(3, 13, 2): c.VL(x, 5, 6, 'iron', 4); c.P(x, 5, 'iron', 5)
    c.HL(2, 11, 12, 'iron', 5); c.VL(13, 4, 8, 'iron', 4); c.VL(2, 4, 8, 'iron', 2)


# ── 공장 마당 석탄재 ── 화풍 정렬 2026-10-14: 버들항 마당 모래 문법(큰 얼룩 두 단 + 박힌 잔돌 = 윗면 빛 1·몸·밑 그늘 + 석탄 덩이·짙은 점)
CINDER_PEBBLES = [(2, 2, 2), (11, 4, 3), (5, 9, 2), (13, 12, 2), (8, 14, 1)]
CINDER_COAL = [(7, 5), (2, 13)]


def cinder_ground(c, s=4, ruts=False, pebbles=CINDER_PEBBLES, coal=CINDER_COAL):
    def f(wx, wy, i, j):
        lx, ly = wx % 16, wy % 16
        a = rnd((lx + 1) // 4, (ly + 2) // 4, s); b2 = rnd(lx // 2, ly // 2, s + 3)
        t = 3 if a > 0.62 else 2
        if a < 0.18: t = 1 if b2 < 0.5 else 2
        q = rnd(lx, ly, s + 17)
        if q < 0.06: t = max(1, t - 1)
        elif q > 0.94: t = min(4, t + 1)
        return ('cinder', t)
    c.F(0, 0, 16, 16, f)
    if ruts:
        for y0 in (4, 11):
            for x in range(16):
                c.P(x, y0, 'cinder', 1); c.P(x, y0 + 1, 'cinder', 4 if rnd(x, y0, s) < 0.35 else 3)
    for k, (x, y, w) in enumerate(pebbles):                       # 박힌 잔돌: 윗줄 빛, 밑 한 줄 그늘
        mat = 'stone'
        hi = 5 if k % 2 else 4
        c.HL(x, y, w, mat, hi - 1); c.P(x, y, mat, hi)
        c.HL(x, y + 1, w, 'cinder', 1)
    for (x, y) in coal:                                          # 석탄 덩이: 먹 같은 몸 + 위 한 점 반짝
        c.P(x, y, 'coal', 2); c.P(x + 1, y, 'coal', 1); c.P(x, y + 1, 'coal', 0); c.P(x + 1, y + 1, 'coal', 1)
        c.P(x, y - 1, 'cinder', 4)


@R.add('cinder', '석탄재 마당', 1, 1, 'terrain', tags=['공장', '마당', '흙'], rules='공장·석탄 마당 바닥. 길·포석과는 연석 없이 바로 닿는다.')
def _(c): cinder_ground(c)


@R.add('cinder-b', '석탄재 마당(바퀴 자국)', 1, 1, 'terrain', tags=['공장', '마당'], rules='석탄재 마당 변주. 수레가 다니는 띠에.')
def _(c): cinder_ground(c, s=9, ruts=True, pebbles=[(2, 2, 2), (9, 8, 2), (13, 1, 2), (6, 14, 2)], coal=[(5, 8), (12, 14)])


@R.add('cinder-c', '석탄재 마당(잔돌 적은 변주)', 1, 1, 'terrain', tags=['공장', '마당', '흙'], rules='석탄재 마당 사이에 낱칸으로 섞는다(반복 깨기).')
def _(c): cinder_ground(c, s=13, pebbles=[(3, 3, 2), (10, 6, 3), (6, 11, 2), (13, 13, 2)], coal=[(12, 2), (2, 8)])


# ── 그을린 풀·화단 ──
@R.add('grass', '그을린 풀(쌈지 공원)', 1, 1, 'terrain', tags=['풀', '공원'], rules='쌈지 공원·철 울타리 안쪽에만. 띠 전체를 풀로 덮지 않는다.')
def _(c):
    def f(wx, wy, i, j):
        lx, ly = wx % 16, wy % 16
        cx, cy = (lx + (ly // 3) % 2) // 3, ly // 3
        r = rnd(cx, cy, 6)
        t = 2 if r < 0.22 else 3 + (1 if r > 0.86 else 0)
        q = rnd(lx, ly, 13)
        if q < 0.07: t = 4
        if rnd(lx, (ly - 1) % 16, 13) < 0.07: t = 1
        return ('moss', t)
    c.F(0, 0, 16, 16, f)


@R.add('soil', '화단 흙', 1, 1, 'terrain', tags=['흙', '화단'], rules='가로수 둘레·화단.')
def _(c):
    def f(wx, wy, i, j):
        lx, ly = wx % 16, wy % 16
        m, t = tex_cluster(lx, ly, 'wood', 2, s=8, scale=2, amt=0.4)
        if rnd(lx, ly, 2) < 0.04: return ('moss', 3)
        return (m, max(1, min(3, t)))
    c.F(0, 0, 16, 16, f)


# ── 선로(동서, 2칸 높이) ──
def ballast(c, x, y, w, h, s=11):
    """자갈 도상(화풍 정렬 2026-10-14): 3×2 잔돌 격자(줄마다 엇갈림) — 돌마다 윗줄 왼쪽 빛·몸·오른쪽 그늘, 틈은 단 1, 드문 녹·석탄 점."""
    def f(wx, wy, i, j):
        lx, ly = wx % 16, wy % 32
        row = ly // 2; yy = ly % 2
        xs = lx + (1 if row % 2 else 0) + (h32(row, 0, s) % 3); col = xs // 3; xx = xs % 3
        if xx == 2 and yy == 1: return ('stone', 1)
        v = h32(col % 6, row, s) % 7
        t = 3 + (1 if v >= 5 else 0) - (1 if v == 0 else 0)
        if yy == 0 and xx == 0: t += 1
        elif xx == 2 or yy == 1: t -= 1
        if v == 3 and xx == 1 and yy == 0 and rnd(col, row, s + 2) < 0.3: return ('copper', 1)
        return ('stone', max(1, t))
    c.F(x, y, w, h, f)


def rail_tile(c, part, bed='ballast'):
    """part 'n'(북쪽 레일, 위 칸) | 's'(남쪽 레일, 아래 칸). 침목은 8px 마다(3px 폭), 레일 머리 1px 빛 + 몸 + 밑 그늘."""
    if bed == 'ballast':
        ballast(c, 0, 0, 16, 16)
        y0, y1 = (3, 16) if part == 'n' else (0, 12)
        for sx in (2, 10):
            c.R(sx, y0, 4, y1 - y0, 'wood', 2)
            c.VL(sx, y0, y1 - y0, 'wood', 4); c.VL(sx + 1, y0, y1 - y0, 'wood', 3); c.VL(sx + 3, y0, y1 - y0, 'wood', 1)
            c.VL(sx + 4, y0, y1 - y0, 'stone', 1)                                             # 침목 옆 그늘
            if part == 'n': c.HL(sx, y0, 4, 'wood', 3); c.HL(sx, y0 - 1, 4, 'stone', 1)
            else: c.HL(sx, y1, 4, 'wood', 0); c.HL(sx, y1 + 1, 4, 'stone', 1)
            for yy in range(y0 + 1, y1, 3): c.P(sx + 1, yy, 'wood', 1)
    else:
        cobble(c, 0, 0, 16, 16, s=13)
    ry = 8 if part == 'n' else 7
    c.HL(0, ry - 1, 16, 'iron', 6); c.HL(0, ry, 16, 'iron', 4); c.HL(0, ry + 1, 16, 'iron', 2); c.HL(0, ry + 2, 16, 'ink', 1)
    if bed == 'ballast':
        for sx in (3, 11): c.P(sx, ry + 1, 'iron', 5); c.P(sx + 2, ry + 1, 'iron', 5)     # 레일 고정쇠
    else:
        c.HL(0, ry + 2, 16, 'stone', 1); c.HL(0, ry - 2, 16, 'stone', 2)                  # 노면 홈


@R.add('rail-n', '선로 북쪽 레일(자갈 도상)', 1, 1, 'terrain', tags=['선로', '철도'], rules='선로 한 가닥 = 북쪽 레일 줄 + 바로 아래 남쪽 레일 줄. 동서로 길게 칠한다.')
def _(c): rail_tile(c, 'n')


@R.add('rail-s', '선로 남쪽 레일(자갈 도상)', 1, 1, 'terrain', tags=['선로', '철도'], rules='rail-n 바로 아래 줄.')
def _(c): rail_tile(c, 's')


@R.add('tram-n', '노면 궤도 북쪽 레일(자갈 포석 속)', 1, 1, 'terrain', tags=['궤도', '노면 전차', '도로'], rules='차도 안 궤도. 북쪽 줄 + 바로 아래 tram-s.')
def _(c): rail_tile(c, 'n', bed='cobble')


@R.add('tram-s', '노면 궤도 남쪽 레일(자갈 포석 속)', 1, 1, 'terrain', tags=['궤도', '노면 전차', '도로'], rules='tram-n 바로 아래 줄.')
def _(c): rail_tile(c, 's', bed='cobble')


# ── 운하 물(3프레임) ──
def water(c, f=0):
    def fn(wx, wy, i, j):
        lx, ly = wx % 16, wy % 16
        band = (ly // 4) % 2
        t = 2 + (1 if rnd(lx, ly, 3) > 0.93 else 0)
        # 잔물결: 짧은 밝은 획 + 밑 어두운 획, 프레임마다 2px 흐른다
        for k, (ox, oy, ln) in enumerate(((1, 2, 4), (9, 6, 3), (4, 10, 5), (12, 13, 3))):
            xx = (lx - ox - f * 2) % 16
            if ly == oy and xx < ln: return ('water', 4 if xx in (1, 2) else 3)
            if ly == oy + 1 and 0 < xx < ln + 1: return ('water', 1)
        return ('water', t)
    c.F(0, 0, 16, 16, fn)


for fr in range(3):
    R.add('water' if fr == 0 else 'water-f%d' % fr, '운하 물' + ('' if fr == 0 else ' (프레임 %d)' % (fr + 1)), 1, 1, 'terrain',
          tags=['물', '운하'], rules='운하 물. 북쪽 물가는 quay(석축 벽), 남쪽 물가는 quay-lip.')(lambda c, fr=fr: water(c, fr))


@R.add('quay', '운하 석축(북쪽 물가, 벽면이 물로 내려간다)', 1, 1, 'terrain', tags=['물가', '운하', '석축'], rules='운하 물 바로 위 줄(북쪽 둑). 위 줄은 보도·포석.')
def _(c):
    water(c, 0)
    # 갓돌 윗면(0~3) + 석축 벽(4~12) + 물때(13) + 물 그림자
    c.HL(0, 0, 16, 'stone', 6); c.R(0, 1, 16, 2, 'stone', 5); c.HL(0, 3, 16, 'stone', 3)
    for x in (0, 8): c.VL(x + 7, 0, 3, 'stone', 3)
    def f(wx, wy, i, j):
        lx = wx % 16; yy = j - 4
        row = yy // 4; xx = (lx + (4 if row % 2 else 0)) % 8
        if yy % 4 == 3 or xx == 7: return ('stone', 1)
        t = 3 - (1 if row >= 1 else 0) + (1 if yy % 4 == 0 and xx < 3 else 0)
        if h32((lx + (4 if row % 2 else 0)) // 8, row, 7) % 4 == 0: t -= 1
        return ('stone', max(1, t))
    c.F(0, 4, 16, 9, f)
    c.HL(0, 13, 16, 'verd', 0); c.HL(0, 14, 16, 'water', 0)
    for x in range(0, 16, 3): c.P(x + (1 if x % 2 else 0), 13, 'verd', 1)


@R.add('quay-lip', '운하 갓돌(남쪽 물가)', 1, 1, 'terrain', tags=['물가', '운하'], rules='운하 물 바로 아래 줄(남쪽 둑). 아래 줄은 보도·포석.')
def _(c):
    flag(c, 0, 0, 16, 16)
    c.HL(0, 0, 16, 'ink', 1); c.HL(0, 1, 16, 'stone', 6); c.R(0, 2, 16, 3, 'stone', 5); c.HL(0, 5, 16, 'stone', 3)
    for x in (0, 8): c.VL(x + 7, 1, 4, 'stone', 3)


# ── 나무 부두 판자 ──
def planks(c, x, y, w, h, s=3):
    def f(wx, wy, i, j):
        lx, ly = wx % 16, wy % 16
        row = ly // 4; yy = ly % 4
        seam = (h32(row, 0, s) % 10 + 3)
        if yy == 3: return ('wood', 0)
        if lx == seam: return ('wood', 1)
        t = 3 + (1 if yy == 0 else 0) - (1 if h32(row, lx > seam, s + 1) % 3 == 0 else 0)
        if (lx == seam - 2 or lx == seam + 2) and yy == 1: return ('iron', 2)
        return ('wood', t)
    c.F(x, y, w, h, f)


@R.add('deck', '나무 부두 판자', 1, 1, 'terrain', tags=['부두', '판자'], rules='부두·잔교 바닥.')
def _(c): planks(c, 0, 0, 16, 16)


@R.add('deck-edge', '부두 끝(판자 앞면 + 물 위 말뚝)', 1, 1, 'terrain', tags=['부두', '물가'], rules='물 위로 나온 부두의 남쪽 끝 줄. 아래 줄은 물.')
def _(c):
    water(c, 0)
    planks(c, 0, 0, 16, 7)
    c.HL(0, 6, 16, 'wood', 4); c.R(0, 7, 16, 3, 'wood', 2); c.HL(0, 9, 16, 'wood', 1)
    for px_ in (2, 11):
        c.R(px_, 10, 3, 5, 'wood', 2); c.VL(px_, 10, 5, 'wood', 3); c.VL(px_ + 2, 10, 5, 'wood', 1)
        c.HL(px_ - 1, 15, 5, 'water', 4)
    c.HL(0, 10, 16, 'water', 0)
    for px_ in (2, 11): c.R(px_, 10, 3, 1, 'wood', 1)


# ── 정거장 승강장 ──
@R.add('platform', '승강장 판석', 1, 1, 'terrain', tags=['정거장', '승강장'], rules='승강장 바닥.')
def _(c): flag(c, 0, 0, 16, 16, base=5, s=6, slab=8)


@R.add('platform-edge', '승강장 끝(놋쇠 안전선 + 선로로 내려가는 벽)', 1, 1, 'terrain', tags=['정거장', '승강장'], rules='승강장 남쪽 끝 줄. 바로 아래는 선로(rail-n).')
def _(c):
    flag(c, 0, 0, 16, 6, base=5, s=6)
    c.HL(0, 5, 16, 'brass', 4); c.HL(0, 6, 16, 'brass', 3)
    c.HL(0, 7, 16, 'stone', 6); c.HL(0, 8, 16, 'stone', 5)
    c.R(0, 9, 16, 6, 'brick', 2)
    for x in range(0, 16, 4): c.VL(x + (2 if x % 8 else 0), 9, 3, 'brick', 1)
    c.HL(0, 12, 16, 'brick', 1); c.HL(0, 9, 16, 'brick', 3)
    c.HL(0, 15, 16, 'ink', 1)



# ── 운하를 남북으로 건너는 돌다리(왼쪽 난간 · 가운데 · 오른쪽 난간) ──
def bridge(c, part):
    cobble(c, 0, 0, 16, 16, s=17, base=3)
    if part == 'w':
        c.VL(0, 0, 16, 'ink', 1); c.R(1, 0, 5, 16, 'stone', 5); c.VL(1, 0, 16, 'stone', 6); c.VL(5, 0, 16, 'stone', 3)
        for y in (3, 11): c.HL(1, y, 5, 'stone', 3)
        c.VL(6, 0, 16, 'stone', 1); c.VL(7, 0, 16, 'stone', 2)
    if part == 'e':
        c.VL(9, 0, 16, 'stone', 2); c.R(10, 0, 5, 16, 'stone', 5); c.VL(10, 0, 16, 'stone', 6); c.VL(14, 0, 16, 'stone', 3)
        for y in (3, 11): c.HL(10, y, 5, 'stone', 3)
        c.VL(15, 0, 16, 'ink', 1)


for part, nm in (('w', '서쪽 난간'), ('m', '가운데'), ('e', '동쪽 난간')):
    R.add('bridge-' + part, '운하 돌다리 ' + nm + '(남북으로 건넌다)', 1, 1, 'terrain', tags=['다리', '운하', '길'],
          rules='운하(물·석축·갓돌 줄 전부)를 남북으로 덮는다: 서쪽 난간 · 가운데(1~2칸) · 동쪽 난간 순. 다리 남북 끝은 길·보도로 잇는다.')(lambda c, part=part: bridge(c, part))


@R.add('flag-b', '판석 보도(배수 홈 변주)', 1, 1, 'terrain', tags=['보도', '인도'], rules='판석 보도 사이에 드문드문 섞는다.')
def _(c):
    flag(c, 0, 0, 16, 16, s=8)
    c.R(6, 6, 4, 4, 'iron', 2); c.HL(6, 6, 4, 'iron', 4)
    for x in (7, 9): c.VL(x, 7, 2, 'ink', 1)

def sheet(path=None, z=3):
    items = []
    for it in R.items:
        im = R.render(it).img()
        if it['w'] == 1 and it['h'] == 1:
            from PIL import Image
            t = Image.new('RGBA', (48, 48))
            for a in range(3):
                for b in range(3): t.paste(im, (a * 16, b * 16))
            im = t
        items.append((it['id'], im))
    return contact(items, path or os.path.join(OUT, 'terrain', 'preview.png'), z=z, W=1800)


if __name__ == '__main__':
    R.export(); sheet()
    print(len(R.items), 'terrain')
