#!/usr/bin/env python3
"""modern_campus 건물 키트 — 지붕 윗면(평지붕 슬래브 14행 / 寄棟 기와) + 정면 한 겹. 조립한 건물 한 장을 kind=structure 로 관문에 낸다.
python3 buildings.py -> tiledata/modern-campus/buildings/_gate/mc-bld-*.png + preview"""
from mc_core import *
R = Reg('buildings'); A = R.add
from props_a import ell


def wall_fill(c, x, y, w, h, mat):
    if mat == 'renga': bricks(c, x, y, w, h)
    else:
        c.R(x, y, w, h, K(mat, 0))
        for yy in range(y + 3, y + h, 8): c.HL(x, yy, w, K(mat, 1))
        for i in range(0, w, 16):
            c.VL(x + i, y, h, K(mat, -1))
    c.VL(x, y, h, K(mat, 2)); c.VL(x + w - 1, y, h, K(mat, -2))


def win(c, x, y, w=8, h=8, kind='plain'):
    c.R(x - 1, y - 1, w + 2, h + 2, OL); c.R(x, y, w, h, K('shiro', 1)); c.R(x + 1, y + 1, w - 2, h - 2, K('garasu', -1))
    c.HL(x + 1, y + 1, w - 2, K('garasu', 1)); c.P(x + 2, y + 2, K('shiro', 3))
    if kind == 'cross': c.VL(x + w // 2, y + 1, h - 2, K('shiro', 1))
    if kind == 'arch': c.HL(x, y, w, K('shiro', 2)); c.P(x, y, OL); c.P(x + w - 1, y, OL)
    c.HL(x - 1, y + h, w + 2, K('conc', 3)); c.HL(x - 1, y + h + 1, w + 2, K('conc', -1))


def flat_roof(c, W, RZ, objs=(), glass=False, rim='conc'):
    """윗면 슬래브: 뒤 변 윤곽 y=11, 난간 윗면 띠, 안쪽 지붕면, 앞 난간 5행(RZ-6..RZ-1)."""
    fy = RZ - 6; ib = fy - 2
    c.R(0, 12, W, fy - 12, K('hodo', 1)); c.HL(0, 12, W, K(rim, 4)); c.R(0, 13, W, 1, K(rim, 3)); c.VL(0, 12, fy - 12, K(rim, 3)); c.VL(W - 1, 12, fy - 12, K(rim, 1))
    c.R(2, 14, W - 4, ib - 14, K('hodo', 0))
    for yy in range(17, ib, 4): c.HL(2, yy, W - 4, K('hodo', 1))
    for xx in range(8, W - 4, 16): c.VL(xx, 14, ib - 14, K('hodo', -1))
    c.HL(2, 14, W - 4, K('hodo', -1)); c.VL(2, 14, ib - 14, K('hodo', -1)); c.HL(2, ib, W - 4, K('hodo', 2))
    if glass: c.R(6, 18, W - 12, 8, K('garasu', -1)); c.HL(6, 18, W - 12, K('garasu', 2)); [c.VL(x, 18, 8, K('shiro', 1)) for x in range(6, W - 6, 8)]
    c.HL(0, 11, W, OL)
    c.R(0, fy, W, 5, K(rim, 0)); c.HL(0, fy, W, K(rim, 3)); c.HL(0, fy + 4, W, K(rim, -2)); c.HL(0, fy + 5, W, K('sumi', 0))
    for o in objs: o(c)


def hip_roof(c, W, mat='kawara', ridge=None, extra=None):
    x0, x1 = 0, W; top = 5; bot = 30; ins = 14
    for y in range(top, bot):
        t = (y - top) / (bot - top)
        l = int(ins * (1 - t)); 
        for x in range(x0 + l, x1 - l):
            if y < top + 5: col = K(mat, 3)            # 뒤 사면/마룻줄
            elif x < x0 + int(ins * (1 - t)) + 3: col = K(mat, 2)
            elif x > x1 - int(ins * (1 - t)) - 4: col = K(mat, -1)
            else: col = K(mat, 1 if (y - top) % 4 else 0)
            c.P(x, y, col)
        c.P(x0 + l, y, K(mat, 3)); c.P(x1 - l - 1, y, K(mat, -2))
        c.P(x0 + l - 1, y, OL); c.P(x1 - l, y, OL)
    c.HL(ins, top - 1, W - 2 * ins, OL); c.HL(x0, bot, W, OL)
    c.HL(ins, top, W - 2 * ins, K(mat, 4))
    c.R(0, bot + 0, W, 1, OL); c.R(0, 31, W, 1, K('kawara', -2))
    if extra: extra(c)


def ac(c, x, y):
    cube(c, x, y, 12, 4, 4, 'tekko', tt=4, ft=1); ell(c, x + 6, y + 2, 3, 1, K('sumi', 1))


def tank(c, x, y):
    cube(c, x, y, 10, 5, 8, 'tekko', tt=3, ft=0); c.HL(x, y + 7, 10, K('tekko', -2))


def hut(c, x, y, w=14):
    cube(c, x, y, w, 5, 7, 'conc', tt=3, ft=0); c.R(x + w // 2 - 2, y + 7 - 4 + 5, 4, 4, K('sumi', 1))


def face(c, W, H, y0, floors, wall, win_kind='plain', bay=16, ground='door', sill=True, balcony=False, band=True, doorx=None, wins_n=None):
    """정면: y0 부터 floors+1 개 층(맨 아래가 1층)."""
    wall_fill(c, 0, y0, W, H - y0, wall)
    for f in range(floors - 1):
        fy = y0 + f * 16
        if band and f > 0: c.HL(0, fy, W, K('conc', 3)); c.HL(0, fy + 1, W, K('conc', -1))
        for bx in range(0, W, bay):
            if bx + bay > W: break
            cx = bx + bay // 2 - 4
            win(c, cx, fy + 4, 8, 7, win_kind)
            if balcony: cube(c, cx - 2, fy + 12, 12, 1, 2, 'tekko', tt=2, ft=0, sides=False); c.HL(cx - 2, fy + 10, 12, K('tekko', 1))
    gy = y0 + (floors - 1) * 16
    if band and floors > 1: c.HL(0, gy, W, K('conc', 3)); c.HL(0, gy + 1, W, K('conc', -1))
    c.R(0, gy, W, 16, K(wall, -1)); wall_fill(c, 0, gy, W, 16, wall)
    if ground:
        dx = (W // 2 - 8) // 16 * 16 + 0 if doorx is None else doorx; dx = (W - 20) // 2 if doorx is None else doorx
        c.R(dx - 1, gy + 2, 22, 14, OL); c.R(dx, gy + 3, 20, 13, K('garasu', -1)); c.VL(dx + 10, gy + 3, 13, K('shiro', 1)); c.HL(dx, gy + 3, 20, K('garasu', 1))
        cube(c, dx - 3, gy - 3, 26, 5, 2, 'conc', tt=3, ft=-2)
        for bx in range(0, W, 16):
            if abs(bx + 8 - (dx + 10)) > 18: win(c, bx + 4, gy + 5, 8, 7, win_kind)
    c.HL(0, H - 3, W, K('conc', -1)); c.HL(0, H - 2, W, K('conc', -2)); c.HL(0, H - 1, W, OL)
    c.VL(0, y0, H - y0, OL); c.VL(W - 1, y0, H - y0, OL)


def bld(id_, name, w, floors, wall, roof='flat', **kw):
    RZ = 48 if roof == 'flat' else 32
    H = RZ + floors * 16; W = w * 16; hc = H // 16
    sol = [(x, hc - 1) for x in range(w)]
    @A('bld-' + id_, name, w, hc, 'structure', solid=sol, tags=['건물', '학교', id_], rules=kw.pop('rules', '정면 1층 문이 열리는 칸 앞에 접근 칸을 비운다.'))
    def d(c):
        extra = kw.get('extra'); glass = kw.get('glass', False)
        objs = []
        if roof == 'flat':
            for i, x in enumerate(range(6, W - 20, 36)):
                objs.append((lambda c, x=x, i=i: [ac(c, x, 17), tank(c, x + 2, 16), ac(c, x, 21)][i % 3]))
            if w >= 5: objs.append(lambda c: hut(c, W - 26, 15, 18))
            flat_roof(c, W, RZ, objs, glass=glass)
        else: hip_roof(c, W, extra=extra)
        face(c, W, H, RZ, floors, wall, kw.get('win', 'plain'), kw.get('bay', 16), kw.get('ground', 'door'), balcony=kw.get('balcony', False), doorx=kw.get('doorx'))
        if kw.get('after'): kw['after'](c, W, H)
    return d


def sign_cross(c, W, H): c.R(W // 2 - 1, 30 - 22 + 8, 3, 9, K('shiro', 2)); c.R(W // 2 - 3, 30 - 22 + 11, 7, 3, K('shiro', 2))
def red_cross(c, W, H):
    x = W // 2 - 4; c.R(x - 1, 33 - 0 - 0, 0, 0, OL)
    c.R(x - 1, 35, 10, 10, OL); c.R(x, 36, 8, 8, K('shiro', 2)); c.R(x + 3, 37, 2, 6, K('aka', 0)); c.R(x + 1, 39, 6, 2, K('aka', 0))


bld('main3', '본관 3층(벽돌·평지붕)', 8, 3, 'renga', rules='학교 중앙. 현관 차양 아래가 출입 칸.')
bld('main4', '본관 4층(콘크리트·평지붕)', 8, 4, 'conc')
bld('annex', '별관(베이지 콘크리트 2층)', 5, 2, 'kinari')
bld('gym', '체육관(넓은 1층 + 채광창 지붕)', 8, 1, 'conc', glass=True, bay=32, win='cross')
bld('auditorium', '강당(기와 寄棟 지붕)', 7, 2, 'kinari', roof='hip')
bld('library', '도서관(벽돌 아치창)', 6, 2, 'renga', win='arch', roof='hip')
bld('dorm', '기숙사 동(4층 벽돌)', 6, 4, 'renga')
bld('cafeteria', '식당(1층 + 환기탑)', 6, 1, 'kinari')
bld('studenthall', '학생회관(2층 유리)', 5, 2, 'shiro', glass=True)
bld('church', '교회 부속 건물(기와 지붕)', 4, 2, 'shiro', roof='hip', after=lambda c, W, H: None)
bld('apartment', '아파트 동(6층 발코니)', 5, 6, 'shiro', balcony=True)
bld('shop', '상가 건물(3층)', 3, 3, 'kinari')
bld('hospital', '병원(흰 4층 + 십자 표지)', 7, 4, 'shiro', after=red_cross)
bld('police', '경찰서(남색 띠 2층)', 5, 2, 'conc')
bld('cafe', '카페(작은 기와 지붕)', 3, 1, 'kinari', roof='hip')

if __name__ == '__main__':
    metas, ims = R.export(); sheet(ims, os.path.join(OUT, R.group, 'preview.png'), W=1100, z=1); print(len(metas), 'buildings')
