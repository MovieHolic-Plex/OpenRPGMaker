#!/usr/bin/env python3
"""steampunk_city 바닥 — 한 칸(16px) 반복 바닥과 2칸 선로·물가 조각. 무늬는 16 주기라 이어 칠해도 이음새가 없다.

  python3 terrain.py     # tiledata/steampunk-city/terrain/_gate/*.png + preview
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from px import C, rnd, h32, tex_brick, tex_cluster
from kit import Reg, contact, OUT

R = Reg('terrain')

# ── 자갈 포석(setts) ──
SETT_ROWS = [[0, 5, 11], [3, 8, 13], [1, 6, 12], [4, 9, 14]]   # 줄마다 돌 경계(16 주기)


def sett_of(lx, ly):
    """(돌 번호, 돌 안 x, 돌 폭, 돌 안 y) — 줄 높이 4(돌 3 + 줄눈 1)."""
    r = (ly // 4) % 4; yy = ly % 4
    b = SETT_ROWS[r]
    for k in range(len(b)):
        x0 = b[k]; x1 = b[(k + 1) % len(b)] + (16 if k == len(b) - 1 else 0)
        xx = (lx - x0) % 16
        if xx < x1 - x0: return (r * 4 + k, xx, x1 - x0, yy)
    return (0, 0, 5, yy)


def cobble(c, x, y, w, h, base=3, s=1, oil=0.0, mat='stone'):
    """둥근 자갈(셋트): 줄 높이 4(돌 3 + 줄눈 1), 돌 폭 4~6, 모서리를 깎아 둥글게. 돌마다 단이 조금씩 다르고
    윗왼쪽 한두 화소만 빛, 아래 줄은 그늘. 줄눈은 어둡지만 먹까지는 아니다(바닥이 건물보다 튀지 않게)."""
    def f(wx, wy, i, j):
        lx, ly = wx % 16, wy % 16
        sid, xx, sw, yy = sett_of(lx, ly)
        tilex, tiley = wx // 16, wy // 16
        if yy == 3 or xx == sw - 1: return (mat, 1 if rnd(lx, ly, s + 9) < 0.55 else 2)
        corner = (xx in (0, sw - 2)) and yy in (0, 2)
        if corner: return (mat, 2)
        v = h32(sid, tilex * 7 + tiley * 13, s) % 10
        t = base + (1 if v >= 7 else 0) - (1 if v == 0 else 0)
        if yy == 0 and xx == 1: t += 1
        if yy == 2: t -= 1
        if oil and rnd(wx // 3, wy // 3, s + 31) < oil: t = min(t, base - 1)
        return (mat, t)
    c.F(x, y, w, h, f)


@R.add('cobble', '자갈 포석(돌 셋트)', 1, 1, 'terrain', tags=['길', '도로', '포석'], rules='차도·광장 바닥. 넓게 칠한다.')
def _(c): cobble(c, 0, 0, 16, 16)


@R.add('cobble-b', '자갈 포석(얼룩 변주)', 1, 1, 'terrain', tags=['길', '도로'], rules='자갈 포석 사이에 드문드문 섞는다(덩이 잡음).')
def _(c):
    cobble(c, 0, 0, 16, 16, s=5)
    for (x, y) in ((3, 5), (11, 10), (7, 13)):
        if c.get(x, y)[1] > 2: c.P(x, y, 'stone', 3)


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


# ── 판석 보도 ──
FLAG_ROWS = [[0, 9], [5, 12], [2, 10], [7, 14]]     # 줄(높이 8)마다 판 경계 — 폭이 들쭉날쭉해야 바둑판으로 안 보인다


def flag(c, x, y, w, h, base=5, s=2, slab=8, rows=FLAG_ROWS):
    """판석: 8px 줄, 줄마다 판 폭이 다르다(7~9). 줄눈 한 단만 어둡게, 판 왼쪽 위 모서리 두세 화소만 밝게, 아주 옅은 얼룩."""
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
        if yy == slab - 1 or lx == (nxt - 1) % 16: return ('stone', base - 1 if rnd(lx, ly, s) < 0.7 else base - 2)
        t = base
        if yy == 0 and xx < 3: t = min(6, base + 1)
        r = rnd(lx // 2, ly // 2, s + 4 + k)
        if r < 0.10: t -= 1
        return ('stone', t)
    c.F(x, y, w, h, f)


@R.add('flag', '판석 보도', 1, 1, 'terrain', tags=['보도', '인도'], rules='건물 앞 보도. 문 앞 접근칸은 이 바닥이다.')
def _(c): flag(c, 0, 0, 16, 16)


@R.add('curb-s', '보도 연석(남쪽 차도로 턱)', 1, 1, 'terrain', tags=['보도', '연석'], rules='보도의 남쪽 끝 줄. 바로 아래 줄은 차도(자갈).')
def _(c):
    flag(c, 0, 0, 16, 11)
    c.HL(0, 10, 16, 'stone', 3)
    c.HL(0, 11, 16, 'stone', 6); c.R(0, 12, 16, 2, 'stone', 5)
    for x in range(0, 16, 8): c.VL(x + 7, 11, 3, 'stone', 3)
    c.HL(0, 14, 16, 'stone', 2); c.HL(0, 15, 16, 'ink', 2)


@R.add('curb-n', '보도 연석(북쪽 차도에서 오르는 턱)', 1, 1, 'terrain', tags=['보도', '연석'], rules='보도의 북쪽 끝 줄. 바로 위 줄은 차도.')
def _(c):
    flag(c, 0, 0, 16, 16)
    c.HL(0, 0, 16, 'stone', 2); c.R(0, 1, 16, 3, 'stone', 5); c.HL(0, 1, 16, 'stone', 6)
    for x in range(0, 16, 8): c.VL(x + 7, 1, 3, 'stone', 3)
    c.HL(0, 4, 16, 'stone', 3)


# ── 벽돌 포석(광장) ──
@R.add('brickpave', '벽돌 바구니 포석(광장)', 1, 1, 'terrain', tags=['광장', '포석'], rules='광장·시장 바닥.')
def _(c):
    def f(wx, wy, i, j):
        lx, ly = wx % 16, wy % 16
        bx, by = lx // 4, ly // 4; xx, yy = lx % 4, ly % 4
        horiz = (bx + by) % 2 == 0
        a, b = (xx, yy) if horiz else (yy, xx)
        if b == 1 and False: pass
        # 한 칸(4×4) = 벽돌 두 장(2px 씩), 줄눈 1px
        if (b in (1, 3)) and not horiz and xx == 3: pass
        mort = (yy == 3) if horiz else (xx == 3)
        split = (yy == 1) if horiz else (xx == 1)
        if mort: return ('brick', 1)
        if split: return ('brick', 2)
        v = h32(bx, by * 2 + (yy > 1 if horiz else xx > 1), 4) % 5
        t = 4 + (-1 if v == 0 else 1 if v == 4 else 0)
        if (yy == 0 if horiz else xx == 0): t += 1
        return ('brick', t)
    c.F(0, 0, 16, 16, f)


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


# ── 공장 마당 석탄재 ──
@R.add('cinder', '석탄재 마당', 1, 1, 'terrain', tags=['공장', '마당', '흙'], rules='공장·석탄 마당 바닥. 길·포석과는 연석 없이 바로 닿는다.')
def _(c):
    def f(wx, wy, i, j):
        lx, ly = wx % 16, wy % 16
        m, t = tex_cluster(lx, ly, 'cinder', 3, s=4, scale=3, amt=0.4)
        r = rnd(lx, ly, 17)
        if r < 0.05: return ('coal', 1)
        if r > 0.965: return ('stone', 5)
        if r > 0.94: return ('cinder', 4)
        return (m, t)
    c.F(0, 0, 16, 16, f)


@R.add('cinder-b', '석탄재 마당(바퀴 자국)', 1, 1, 'terrain', tags=['공장', '마당'], rules='석탄재 마당 변주. 수레가 다니는 띠에.')
def _(c):
    def f(wx, wy, i, j):
        lx, ly = wx % 16, wy % 16
        m, t = tex_cluster(lx, ly, 'cinder', 3, s=9, scale=3, amt=0.35)
        if ly in (4, 11): t = 2
        if ly in (5, 12): t = 4 if rnd(lx, ly, 3) < 0.5 else 3
        r = rnd(lx, ly, 21)
        if r < 0.04: return ('coal', 1)
        return (m, t)
    c.F(0, 0, 16, 16, f)


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
    def f(wx, wy, i, j):
        r = rnd(wx % 16, wy % 32, s)
        cl = rnd((wx % 16) // 2, (wy % 32) // 2, s + 1)
        t = 2 + (1 if cl > 0.55 else 0) + (1 if r > 0.9 else 0)
        if r < 0.08: t = 1
        return ('stone', t)
    c.F(x, y, w, h, f)


def rail_tile(c, part, bed='ballast'):
    """part 'n'(북쪽 레일, 위 칸) | 's'(남쪽 레일, 아래 칸). 침목은 8px 마다(3px 폭), 레일 머리 1px 빛 + 몸 + 밑 그늘."""
    if bed == 'ballast':
        ballast(c, 0, 0, 16, 16)
        y0, y1 = (3, 16) if part == 'n' else (0, 12)
        for sx in (2, 10):
            c.R(sx, y0, 4, y1 - y0, 'wood', 2)
            c.VL(sx, y0, y1 - y0, 'wood', 3); c.VL(sx + 3, y0, y1 - y0, 'wood', 1)
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
        t = 2 + (1 if rnd(lx // 4, ly // 4, 3) > 0.7 else 0)
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
