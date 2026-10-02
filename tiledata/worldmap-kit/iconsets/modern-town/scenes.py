"""현대 소도시(마더·페르소나풍) 월드맵 아이콘 — 정면 카메라용 장면.
따뜻한 벽(크림·주황 벽돌·흰 회벽), 빨강·파랑·초록 지붕, 생활감 있는 소품(간판·차양·자판기·전봇대).
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / '_scene3d'))
import math  # noqa: E402
import numpy as np  # noqa: E402
import oblique as ob  # noqa: E402
import east as E  # noqa: E402
import modsf_kit as M  # noqa: E402
import icons_v9_lib as L  # noqa: E402
from icons_v9_lib import STONE, WSTONE, WOOD, ROCK, RED, BLUE, SNOW, LEAF, GOLD, WATER, SAND, GREY  # noqa: E402
from oblique import Scene, box, Poly  # noqa: E402

SET = dict(id='modern-town', name='현대 소도시')

# ── 세트 재질(전부 World.png 색) ─────────────────────────────────────────────────────────────
ob.MAT.update({
    'brick': [ROCK[1], ROCK[2], RED[1], RED[2], ROCK[6], RED[4]],          # 주황·적갈 벽돌
    'cream': [SAND[0], SAND[1], SAND[2], SAND[3], SAND[4], SAND[5]],       # 크림 회벽
    'teal': [BLUE[0], WATER[0], WATER[1], WATER[2], WATER[3], WATER[4]],   # 청록 지붕
    'mint': [LEAF[1], LEAF[2], LEAF[3], LEAF[5], LEAF[6]],                 # 초록 지붕·아케이드
    'rail': [GREY[0], GREY[1], GREY[2], GREY[3]],
})


# ══════════════════════════════════════════ 부품 ══════════════════════════════════════════
def gh(s, x, y, w, d, wh, rh, wall='plaster', roof='roofred', door=True, wins=True, tex='shingle'):
    """박공집 — 앞 경사 지붕(줄 결) + 벽에 문·창."""
    dec = []
    if door:
        dec.append(('front', (x + w * .5 - 1.1, x + w * .5 + 1.1, 0, 3.2, 'door')))
    if wins and w >= 9:
        dec += [('front', (x + 1.3, x + 3.1, 1.6, 3.4, 'glass')), ('front', (x + w - 3.1, x + w - 1.3, 1.6, 3.4, 'glass'))]
    s.box(x, x + w, y, y + d, 0, wh, mat=wall, tex='plain', role='house', contour=True, decals=tuple(dec))
    s.add(ob.gable(x - .7, x + w + .7, y - .9, y + d + .9, wh, rh / (d / 2 + .9), mat=roof, tex=tex, role='roof', contour=True))
    return wh + rh


def flat(s, x, y, w, d, h, wall='cream', trim='roofgrey', ramp='cblue', door=True, seed=3, px=4, z0=2.0, lit=0.0):
    dec = (('front', (x + w * .5 - 1.2, x + w * .5 + 1.2, 0, 3.4, 'door')),) if door else ()
    p = box(x, x + w, y, y + d, 0, h, mat=wall, tex='plain', role='house', contour=True, decals=dec)
    p.post = M.windows(x + 1, y, z0=z0, ztop=h - 1.2, px=px, pz=3, lit_p=lit, ramp=ramp, seed=seed, band_right=False)
    s.add(p)
    s.add(box(x - .4, x + w + .4, y - .4, y + d + .4, h, h + .9, mat=trim, tex='plain', role='roof', contour=True))
    return h + .9


def awning(s, x0, x1, y, z, mat='cred', depth=1.6, stripe='white'):
    """가게 차양: 앞으로 비스듬히 내민 판(줄무늬)."""
    p = M.obox(((x0 + x1) / 2, y - depth / 2, z), (x1 - x0, depth, .7), M.rot_x(-.45), mat=mat, tex='plain', role='misc', contour=True)
    rb = ob.MAT[stripe]

    def post(tag, P, col, sh, nrm):
        m = np.mod(np.floor(P[:, 0] - x0), 2) == 0
        return np.where(m[:, None], ob._darken(rb, sh, 0), col).astype(np.uint8)
    p.post = post
    s.add(p)


def sign(s, x0, x1, y, z0, z1, mat='cyellow', ink='cred'):
    """간판 판 + 글자 점."""
    p = box(x0, x1, y - .6, y, z0, z1, mat=mat, tex='plain', role='misc', contour=True)
    ri = ob.MAT[ink]

    def post(tag, P, col, sh, nrm):
        f = nrm[:, 1] < -.5
        m = f & (np.mod(np.floor(P[:, 0] - x0), 2) == 1) & (P[:, 2] > z0 + .9) & (P[:, 2] < z1 - .9) & (P[:, 0] > x0 + .9) & (P[:, 0] < x1 - .9)
        return np.where(m[:, None], ob._darken(ri, .5, 0), col).astype(np.uint8)
    p.post = post
    s.add(p)


def tree(s, x, y, r=3.0, h=None, z=0.0):
    h = h or r * 1.2
    s.cyl(x, y, .7, z, z + h, mat='wood', tex='plain', role='misc')
    s.add(E.Ellip(x, y, z + h + r * .55, r, r * .85, r * .9, mat='leaf2', tex='speck', role='misc', contour=True))


def pole(s, x, y, h=12, wire=None):
    """전봇대(+ 가로 팔)."""
    s.box(x - .5, x + .5, y - .5, y + .5, 0, h, mat='wood', tex='plain', role='misc')
    s.box(x - 2, x + 2, y - .4, y + .4, h - 1.6, h - 1, mat='wood', tex='plain', role='misc')


def lamp(s, x, y, h=7):
    s.box(x - .4, x + .4, y - .4, y + .4, 0, h, mat='steel', tex='plain', role='misc')
    s.box(x - .9, x + .9, y - .9, y + .9, h, h + 1.2, mat='cyellow', tex='plain', role='misc')


def fence(s, x0, x1, y, h=1.8, mat='white'):
    s.box(x0, x1, y - .3, y + .3, 0, h, mat=mat, tex='plank', role='misc')


def hedge(s, x0, x1, y0, y1, h=2.0):
    s.box(x0, x1, y0, y1, 0, h, mat='leaf2', tex='speck', role='misc', contour=True)


def car(s, x, y, w=6, mat='cblue', d=3.0):
    s.box(x, x + w, y, y + d, .6, 2.4, mat=mat, tex='plain', role='misc', contour=True)
    s.box(x + w * .22, x + w * .78, y + .3, y + d - .3, 2.4, 3.8, mat=mat, tex='plain', role='misc', contour=True,
          decals=(('front', (x + w * .28, x + w * .72, 2.6, 3.6, 'glass')),))
    for wx in (x + 1.2, x + w - 1.2):
        s.box(wx - .8, wx + .8, y - .2, y + .4, 0, 1.4, mat='rail', tex='plain', role='misc')


def flat_fn(mat, lo=0, span=None, seed=5):
    ramp = np.array(ob.MAT[mat], np.uint8)
    n = len(ramp)
    span = span or n

    def fn(x, y):
        return ramp[np.clip((ob.hsh(x, y, seed) * span).astype(int) + lo, 0, n - 1)]
    return fn


def road_fn(xr=None, yr=None, zebra=True):
    """교차로: 아스팔트 + 흰 차선 + 횡단보도."""
    asp = np.array(ob.MAT['roofgrey'], np.uint8)
    wh = np.array(SNOW[3], np.uint8)
    yl = np.array(GOLD[3], np.uint8)

    def fn(x, y):
        col = asp[np.clip((1 + ob.hsh(x, y, 3) * 1.7).astype(int), 0, 4)]
        if xr:
            cx = (xr[0] + xr[1]) / 2
            m = (np.abs(x - cx) < .5) & (np.mod(np.floor(y), 4) < 2)
            col = np.where(m[:, None], yl, col)
        if yr:
            cy = (yr[0] + yr[1]) / 2
            m = (np.abs(y - cy) < .5) & (np.mod(np.floor(x), 4) < 2)
            col = np.where(m[:, None], yl, col)
        if zebra and xr and yr:
            zx = (x > xr[0]) & (x < xr[1]) & (((y > yr[1]) & (y < yr[1] + 3)) | ((y < yr[0]) & (y > yr[0] - 3))) & (np.mod(np.floor(x), 2) == 0)
            zy = (y > yr[0]) & (y < yr[1]) & (((x > xr[1]) & (x < xr[1] + 3)) | ((x < xr[0]) & (x > xr[0] - 3))) & (np.mod(np.floor(y), 2) == 0)
            col = np.where((zx | zy)[:, None], wh, col)
        return col
    return fn


def sawtooth(s, x0, x1, y0, y1, z0, h, mat='roofgrey', glass='glass', broken=0.0, seed=1):
    """톱니 지붕 한 칸: 뒤로 낮아지는 경사 + 앞면 세로 유리."""
    sl = h / (y1 - y0)
    p = Poly([((0, -1, 0), -y0, 'front'), ((0, 1, 0), y1, 'back'), ((-1, 0, 0), -x0, 'left'), ((1, 0, 0), x1, 'right'),
              ((0, 0, -1), -z0, 'bottom'), ((0, sl, 1), z0 + h + sl * y0, 'slope')], mat=mat, tex='plain', role='roof', contour=True)
    rg = ob.MAT[glass]
    dk = np.array(STONE[0], np.uint8)

    def post(tag, P, col, sh, nrm):
        f = nrm[:, 1] < -.5
        g = f & (P[:, 2] > z0 + .6) & (P[:, 2] < z0 + h - .5) & (np.mod(np.floor(P[:, 0] - x0), 3) > 0)
        out = np.where(g[:, None], ob._darken(rg, .6, 0), col)
        if broken:
            b = g & (ob.hsh(np.floor((P[:, 0] - x0) / 3), 0, seed) < broken)
            out = np.where(b[:, None], dk[None, :], out)
        return out.astype(np.uint8)
    p.post = post
    s.add(p)


def torii(s, cx, y, w, h, mat='cred'):
    for px in (cx - w / 2 + 1, cx + w / 2 - 1):
        s.cyl(px, y, .9, 0, h, mat=mat, tex='plain', role='misc', contour=True)
    s.box(cx - w / 2 - .6, cx + w / 2 + .6, y - .8, y + .8, h * .72, h * .72 + 1.0, mat=mat, tex='plain', role='misc', contour=True)
    s.box(cx - w / 2 - 1.8, cx + w / 2 + 1.8, y - 1.0, y + 1.0, h, h + 1.3, mat=mat, tex='plain', role='misc', contour=True)
    s.box(cx - w / 2 - 2.2, cx + w / 2 + 2.2, y - 1.1, y + 1.1, h + 1.3, h + 2.1, mat='roofgrey', tex='plain', role='misc', contour=True)


def stone_lantern(s, x, y, h=5):
    s.box(x - 1.2, x + 1.2, y - 1.2, y + 1.2, 0, 1, mat='stone', tex='plain', role='misc', contour=True)
    s.box(x - .5, x + .5, y - .5, y + .5, 1, h - 2, mat='stone', tex='plain', role='misc')
    s.box(x - 1, x + 1, y - 1, y + 1, h - 2, h - .6, mat='stone', tex='plain', role='misc', contour=True,
          decals=(('front', (x - .5, x + .5, h - 1.8, h - .9, 'lit')),))
    s.add(ob.hip(x - 1.6, x + 1.6, y - 1.6, y + 1.6, h - .6, .8, mat='stone', tex='plain', role='misc', contour=True))


def wheel_ring(s, cx, y, cz, R, n=16, mat='rust', th=1.0):
    for k in range(n):
        a = 2 * math.pi * k / n
        c = (cx + R * math.cos(a), y, cz + R * math.sin(a))
        seg = 2 * math.pi * R / n + .5
        s.add(M.obox(c, (seg, th, th), M.rot_y(-(a + math.pi / 2)), mat=mat, tex='plain', role='misc', contour=False))


# ══════════════════════════════════════════ capital 6x6 ══════════════════════════════════════════
def capital():
    """도심: 교차로 앞에 역 빌딩(유리 반원 지붕·시계탑), 뒤 왼쪽 백화점(간판 띠), 가운데 방송탑, 오른쪽 빌딩들."""
    s = Scene()
    s.patch(3, 93, 0, 26, road_fn(xr=(60, 72), yr=(4, 13)), mat='roofgrey', h=.3)
    # 뒤 왼쪽: 백화점(층마다 색 띠 + 옥상 간판)
    p = box(2, 30, 30, 42, 0, 42, mat='cream', tex='plain', role='house', contour=True)
    p.post = M.chain(M.windows(3, 30, z0=4, ztop=40, px=3, pz=4, lit_p=.12, ramp='glass', seed=4, band_right=False),
                     M.with_ramp(M.bands(3.5, 8, 1.4, -2, ('front',)), 'cream'))
    s.add(p)
    s.add(box(1.4, 30.6, 29.4, 42.6, 42, 43.2, mat='roofgrey', tex='plain', role='roof', contour=True))
    sign(s, 5, 27, 32, 43.2, 48, mat='cred', ink='cyellow')
    # 뒤 가운데: 방송탑(적백)
    tx, ty = 44, 42
    M.add(s, M.Frustum(tx, ty, 3.4, 1.6, 0, 52, mat='orange', role='tower', contour=True), M.band_swap(0, 6, 'white'))
    M.add(s, M.Frustum(tx, ty, 4.6, 4.6, 32, 36, mat='white', role='tower', contour=True),
          M.cyl_windows(tx, ty, 4.6, 32.6, 35.6, pz=3, cols=12, ramp='glass', lit_p=.2, seed=5))
    s.box(tx - .5, tx + .5, ty - .5, ty + .5, 52, 60, mat='steel', tex='plain', role='misc')
    s.box(tx - .7, tx + .7, ty - .7, ty + .7, 60, 61.4, mat='cred', tex='plain', role='misc')
    # 뒤 오른쪽: 사무 빌딩 둘
    M.bldg(s, 56, 36, 14, 10, 44, mat='glass', seed=7)
    M.rooftop(s, 56, 36, 14, 10, 44, 'ac2')
    flat(s, 75, 28, 16, 10, 28, wall='brick', trim='roofgrey', ramp='cblue', seed=9, px=3)
    sign(s, 79, 87, 28, 20, 24, mat='cyellow', ink='cblue')
    # 앞 가운데: 역 빌딩(긴 몸체 + 유리 반원 지붕 + 왼쪽 시계탑)
    flat(s, 20, 17, 38, 10, 10, wall='brick', trim='roofgrey', ramp='cblue', seed=11, px=3, door=False)
    s.add(box(33, 45, 16.4, 17, 0, 6, mat='glass', tex='plain', role='gate', contour=True))
    sign(s, 34, 44, 16.4, 6.6, 9.2, mat='white', ink='cblue')
    p = M.prism_arch(26, 57, 22, 4.0, N=6, z0=10.9, mat='glass', tex='plain', role='roof', contour=True)
    p.post = M.ribs(3, ('front',), mat='glass')
    s.add(p)
    s.box(20.5, 25.5, 18, 24, 10.9, 25, mat='cream', tex='plain', role='tower', contour=True,
          decals=(('front', (21.7, 24.3, 20.5, 23.2, 'gold')),))
    s.add(ob.hip(19.7, 26.3, 17.2, 24.8, 25, 1.0, mat='mint', tex='shingle', role='roof', contour=True))
    # 앞 왼쪽: 낮은 가게 둘
    flat(s, 3, 19, 15, 8, 9, wall='plaster', trim='cred', ramp='cblue', seed=13, px=3)
    awning(s, 3.4, 17.6, 19, 3.6, 'cblue')
    # 앞 오른쪽: 상가 빌딩
    flat(s, 75, 17, 17, 8, 13, wall='cream', trim='roofgrey', ramp='cblue', seed=14, px=3)
    awning(s, 75.4, 91.6, 17, 3.6, 'cred')
    sign(s, 78, 89, 17, 13.9, 17, mat='cgreen', ink='white')
    # 길 위 차·가로수·가로등
    car(s, 22, 6, 9, 'cred', 3.6)
    car(s, 44, 9, 9, 'cyellow', 3.6)
    car(s, 63, 18, 7, 'cblue', 3.2)
    for x in (6, 88):
        tree(s, x, 3, 2.6)
    lamp(s, 36, 2, 7)
    lamp(s, 56, 2, 7)
    return s


# ══════════════════════════════════════════ fort_city 4x4 ══════════════════════════════════════════
def apt(s, x, y, w, d, h, wall='plaster', trim='cred', seed=1, num=None):
    """아파트 동: 층 띠(발코니) + 창 격자 + 옥상 물탱크·동 번호 띠."""
    p = box(x, x + w, y, y + d, 0, h, mat=wall, tex='plain', role='house', contour=True)
    p.post = M.chain(M.windows(x + 1, y, z0=2, ztop=h - 1, px=3, pz=3, lit_p=.1, ramp='cblue', seed=seed, band_right=False),
                     M.with_ramp(M.bands(1.5, 3, 1, -1, ('front',)), wall))
    s.add(p)
    s.add(box(x - .4, x + w + .4, y - .4, y + d + .4, h, h + 1, mat=trim, tex='plain', role='roof', contour=True))
    s.box(x + w * .65, x + w * .65 + 3, y + 1, y + d - 1, h + 1, h + 3, mat='white', tex='plain', role='misc', contour=True)
    s.box(x + .8, x + 2.2, y - .5, y, h - 5, h - .8, mat=trim, tex='plain', role='misc')


def fort_city():
    """신도시 단지: 아파트 동 넷(엇갈림) + 앞 놀이터(미끄럼틀·그네·모래밭) + 나무."""
    s = Scene()
    apt(s, 1, 28, 22, 7, 31, wall='plaster', trim='cred', seed=1)
    apt(s, 32, 31, 26, 7, 35, wall='cream', trim='teal', seed=2)
    apt(s, 20, 17, 18, 6, 22, wall='cream', trim='cblue', seed=3)
    apt(s, 43, 13, 16, 6, 17, wall='plaster', trim='cred', seed=4)
    # 놀이터
    s.patch(4, 30, 0, 12, flat_fn('sand', 2, 3, seed=7), mat='sand', h=.4)
    # 미끄럼틀
    s.box(7, 10, 5, 8, 0, 6, mat='cblue', tex='plain', role='misc', contour=True)
    s.box(6.6, 10.4, 4.6, 8.4, 6, 6.8, mat='cred', tex='plain', role='misc', contour=True)
    s.add(M.obox((13.5, 6.5, 3.2), (7.5, 2.2, .8), M.rot_y(.75), mat='cyellow', tex='plain', role='misc', contour=True))
    # 그네
    for x in (19, 27):
        s.box(x, x + .7, 7, 7.7, 0, 7, mat='cred', tex='plain', role='misc')
    s.box(19, 27.7, 7, 7.7, 7, 7.8, mat='cred', tex='plain', role='misc')
    for x in (21, 24.5):
        s.box(x, x + .3, 7.1, 7.4, 3, 7, mat='steel', tex='plain', role='misc')
        s.box(x - .6, x + .9, 6.6, 7.9, 2.4, 3, mat='cyellow', tex='plain', role='misc')
    tree(s, 2, 3, 2.6)
    tree(s, 35, 4, 3.0)
    tree(s, 57, 4, 2.6)
    hedge(s, 37, 54, 2, 4.5, 2.2)
    return s


# ══════════════════════════════════════════ harbor_city 5x4 ══════════════════════════════════════════
def harbor_city():
    """항구 마을: 왼쪽 등대 방파제 + 여객선 터미널(파란 반원 지붕) + 어시장 창고 둘 + 오른쪽에 댄 여객선 + 뒤 언덕 집."""
    s = Scene()
    s.patch(1, 77, -15, -2, flat_fn('cwater', 0, 3, seed=3), mat='cwater', h=.2)
    s.box(10, 78, -3, 1, 0, 1.6, mat='stone', tex='brick', role='misc', contour=True)
    # 등대(왼쪽 방파제 끝)
    s.box(1, 13, -11, -6, 0, 2, mat='stone', tex='brick', role='misc', contour=True)
    s.box(10, 13, -6, -2, 0, 1.6, mat='stone', tex='brick', role='misc', contour=True)
    M.add(s, M.Frustum(6.5, -8.5, 3.0, 2.0, 2, 24, mat='white', role='tower', contour=True), M.band_swap(2, 5, 'cred'))
    M.add(s, M.Frustum(6.5, -8.5, 2.6, 2.6, 24, 27, mat='cyellow', role='misc', contour=True))
    s.add(ob.Cone(6.5, -8.5, 3.0, 27, 30, mat='cred', tex='plain', role='roof', contour=True))
    # 터미널
    flat(s, 12, 4, 24, 10, 12, wall='plaster', trim='cblue', ramp='glass', seed=21, px=3)
    p = M.prism_arch(11, 37, 9, 4.6, N=6, z0=12.9, mat='cblue', tex='plain', role='roof', contour=True)
    p.post = M.ribs(3, ('front',), mat='cblue')
    s.add(p)
    sign(s, 16, 32, 4, 8.8, 11.2, mat='white', ink='cblue')
    # 어시장(박공 창고 둘, 앞 열림 + 생선 상자)
    for i, (x, rf) in enumerate(((39, 'teal'), (53, 'roofred'))):
        s.box(x, x + 12, 8, 15, 0, 6, mat='cream', tex='plain', role='house', contour=True,
              decals=(('front', (x + 1.6, x + 10.4, 0, 4.4, 'dark')),))
        s.add(ob.gable(x - .8, x + 12.8, 7.2, 15.8, 6, .65, mat=rf, tex='shingle', role='roof', contour=True))
        for k in range(3):
            s.box(x + 1.6 + k * 3.4, x + 3.6 + k * 3.4, 5.4, 7.4, 0, 1.6, mat='cblue' if k % 2 else 'white', tex='plain', role='misc', contour=True)
    # 여객선(오른쪽 부두)
    s.add(M.wedge_hull(48, 76, -14, -6, 0, 3.6, bow=5, mat='white', tex='plain', role='hull', contour=True,
                       decals=(('front', (48, 76, 1.0, 1.8, 'band')),)))
    s.box(51, 67, -12.5, -7.5, 3.6, 6.8, mat='white', tex='plain', role='house', contour=True)
    s.box(53, 64, -11.5, -7.5, 6.8, 9.4, mat='white', tex='plain', role='house', contour=True)
    s.add(box(51.2, 66.8, -12.6, -12.4, 4.4, 6.0, mat='glass', tex='plain', role='misc'))
    s.add(box(53.4, 63.6, -11.6, -11.4, 7.4, 8.8, mat='glass', tex='plain', role='misc'))
    M.add(s, M.Frustum(60, -9.5, 1.4, 1.4, 9.4, 12.4, mat='cred', role='misc', contour=True))
    # 뒤 언덕 집
    gh(s, 14, 28, 10, 6, 5, 4, wall='cream', roof='roofred')
    gh(s, 29, 32, 10, 6, 5, 4, wall='plaster', roof='teal')
    gh(s, 62, 22, 11, 6, 5, 4, wall='plaster', roof='cblue')
    tree(s, 45, 24, 2.6)
    tree(s, 10, 26, 2.4)
    return s


# ══════════════════════════════════════════ castle 3x3: 학교 / 병원 ══════════════════════════════════════════
def school():
    """학교: 3층 본관(시계) + 체육관(초록 반원 지붕) + 앞 운동장(흙·흰 선) + 국기."""
    s = Scene()
    track_w = np.array(SNOW[3], np.uint8)

    def ground_fn(x, y):
        col = np.array(ob.MAT['dirt'], np.uint8)[np.clip((2 + ob.hsh(x, y, 9) * 2).astype(int), 0, 4)]
        m = (np.abs(y - 6) < .5) | (np.abs(x - 22) < .5) | ((np.abs(np.hypot((x - 22) / 1.6, y - 6) - 4) < .5))
        return np.where(m[:, None], track_w, col)
    s.patch(1, 42, 0, 12, ground_fn, mat='dirt', h=.3)
    fence(s, 1, 42, 0, 1.6, 'cgreen')
    # 본관
    p = box(2, 32, 14, 22, 0, 14, mat='plaster', tex='plain', role='house', contour=True,
            decals=(('front', (15, 19, 0, 3.6, 'door')),))
    p.post = M.windows(3, 14, z0=1.6, ztop=13, px=3, pz=4, lit_p=0, ramp='cblue', seed=2, band_right=False)
    s.add(p)
    s.add(box(1.6, 32.4, 13.6, 22.4, 14, 14.9, mat='roofgrey', tex='plain', role='roof', contour=True))
    s.box(14, 20, 15, 21, 14.9, 19, mat='plaster', tex='plain', role='tower', contour=True,
          decals=(('front', (15.6, 18.4, 15.5, 18.4, 'gold')),))
    s.add(box(13.6, 20.4, 14.6, 21.4, 19, 19.8, mat='roofgrey', tex='plain', role='roof', contour=True))
    # 체육관
    s.box(33, 44, 15, 25, 0, 6, mat='cream', tex='plain', role='house', contour=True,
          decals=(('front', (36.5, 40.5, 0, 4, 'door')),))
    p = M.prism_arch(32.6, 44.4, 20, 5.6, N=6, z0=6, mat='mint', tex='plain', role='roof', contour=True)
    p.post = M.ribs(3, ('front',), mat='mint')
    s.add(p)
    # 국기·나무
    s.box(4, 4.6, 8, 8.6, 0, 13, mat='steel', tex='plain', role='misc')
    s.box(4.6, 8, 8, 8.4, 10.4, 12.8, mat='white', tex='plain', role='misc',
          decals=(('front', (5.8, 6.8, 11.1, 12.1, 'red')),))
    tree(s, 40, 4, 2.2)
    return s


def hospital():
    """병원: 흰 고층 본관(옥상 빨간 십자·헬기장) + 낮은 외래동 + 구급차."""
    s = Scene()
    p = box(14, 34, 14, 24, 0, 26, mat='white', tex='plain', role='house', contour=True)
    p.post = M.windows(15, 14, z0=3, ztop=25, px=3, pz=3, lit_p=.08, ramp='glass', seed=6, band_right=False)
    s.add(p)
    s.add(box(13.6, 34.4, 13.6, 24.4, 26, 27, mat='roofgrey', tex='plain', role='roof', contour=True))
    # 십자 간판
    s.box(21, 27, 12.8, 13.6, 20, 26, mat='white', tex='plain', role='misc', contour=True)
    s.box(23.4, 24.6, 12.5, 12.8, 20.6, 25.4, mat='cred', tex='plain', role='misc')
    s.box(21.6, 26.4, 12.5, 12.8, 22.4, 23.6, mat='cred', tex='plain', role='misc')
    M.rooftop(s, 14, 14, 20, 10, 27, 'helipad')
    # 외래동
    flat(s, 2, 6, 17, 10, 9, wall='plaster', trim='teal', ramp='glass', seed=7, px=3, door=False)
    s.add(box(4, 12, 4, 6, 4.2, 5.2, mat='teal', tex='plain', role='misc', contour=True))
    s.box(5, 11, 5.6, 6, 0, 4, mat='glass', tex='plain', role='gate')
    flat(s, 30, 4, 14, 9, 8, wall='cream', trim='teal', ramp='glass', seed=8, px=3)
    # 구급차
    s.box(19, 27, 0, 3.4, .6, 4, mat='white', tex='plain', role='misc', contour=True,
          decals=(('front', (19.4, 27, 1.6, 2.4, 'red')), ('front', (24.4, 26.6, 2.6, 3.6, 'glass'))))
    s.box(22, 23.6, 1, 2.4, 4, 4.8, mat='cred', tex='plain', role='misc')
    for wx in (20.6, 25.4):
        s.box(wx - .8, wx + .8, -.2, .4, 0, 1.4, mat='rail', tex='plain', role='misc')
    tree(s, 3, 21, 2.6)
    return s


# ══════════════════════════════════════════ large_town 3x3 ══════════════════════════════════════════
def shopfront(s, x, y, w, d, h, wall, trim, aw, sg, ink, seed):
    p = box(x, x + w, y, y + d, 0, h, mat=wall, tex='plain', role='house', contour=True,
            decals=(('front', (x + 1, x + w - 1, 0, 3.4, 'glass')), ('front', (x + w / 2 - .8, x + w / 2 + .8, 0, 3.4, 'door'))))
    p.post = M.windows(x + 1, y, z0=5.6, ztop=h - .8, px=3, pz=3, lit_p=0, ramp='cblue', seed=seed, band_right=False)
    s.add(p)
    s.add(box(x - .3, x + w + .3, y - .3, y + d + .3, h, h + .8, mat=trim, tex='plain', role='roof', contour=True))
    awning(s, x + .4, x + w - .4, y, 4.2, aw)
    sign(s, x + 1, x + w - 1, y, h + .8, h + 3.4, mat=sg, ink=ink)


def large_town():
    """상점가: 초록 아케이드 지붕이 덮은 골목 + 양쪽 2층 가게(차양·간판 색색)."""
    s = Scene()
    # 뒤 줄(높음)
    for i, (w, h, wall, trim, aw, sg, ink) in enumerate((
            (10, 13, 'cream', 'roofgrey', 'cred', 'cyellow', 'cred'), (11, 15, 'brick', 'roofgrey', 'cblue', 'white', 'cblue'),
            (10, 12, 'plaster', 'teal', 'cgreen', 'cred', 'white'), (11, 14, 'cream', 'roofred', 'cyellow', 'cblue', 'white'))):
        x = 2 + sum((10, 11, 10, 11)[:i])
        shopfront(s, x, 22, w, 7, h, wall, trim, aw, sg, ink, i + 3)
    # 아케이드(골목 위 반원 지붕)
    p = M.prism_arch(1, 45, 17.5, 4.2, N=6, z0=9.5, mat='mint', tex='plain', role='roof', contour=True)
    p.post = M.ribs(3, ('front',), mat='mint')
    s.add(p)
    for x in (2.5, 15.5, 29.5, 42.5):
        s.box(x, x + .8, 13.4, 14.2, 0, 9.5, mat='steel', tex='plain', role='misc')
    sign(s, 17, 30, 13.2, 9.6, 12.4, mat='cred', ink='cyellow')
    # 앞 줄(낮음)
    for i, (w, h, wall, trim, aw, sg, ink) in enumerate((
            (11, 8, 'plaster', 'cred', 'cyellow', 'cgreen', 'white'), (10, 9, 'cream', 'cblue', 'cred', 'white', 'cred'),
            (11, 8, 'brick', 'roofgrey', 'cblue', 'cyellow', 'cblue'), (10, 9, 'plaster', 'teal', 'cgreen', 'cred', 'white'))):
        x = 2 + sum((11, 10, 11, 10)[:i])
        if i == 1:
            x += 0
        shopfront(s, x, 3, w, 8, h, wall, trim, aw, sg, ink, i + 9)
    # 자판기·전봇대
    s.box(23.2, 24.6, 1.2, 2.4, 0, 3.6, mat='cred', tex='plain', role='misc', contour=True)
    return s


# ══════════════════════════════════════════ village 2x2 ══════════════════════════════════════════
def village():
    """교외 주택가: 마당 있는 집 둘(빨강·파랑 지붕) + 낮은 울타리·나무·우체통."""
    s = Scene()
    gh(s, 1.5, 10, 11.5, 7, 5, 5.2, wall='plaster', roof='roofred')
    s.box(2.9, 4.5, 13, 14.6, 5, 10.5, mat='brick', tex='brick', role='misc', contour=True)
    gh(s, 16.5, 6, 11.5, 7, 5, 5.2, wall='cream', roof='cblue')
    fence(s, 1, 13, 4, 1.8, 'white')
    hedge(s, 16, 29, 0.5, 2.5, 1.4)
    tree(s, 27.5, 16, 2.3)
    s.box(14, 14.8, 2, 2.8, 0, 3, mat='wood', tex='plain', role='misc')
    s.box(13.4, 15.4, 1.6, 3.2, 3, 4.6, mat='cred', tex='plain', role='misc', contour=True)
    return s


def village_rural():
    """시골 정류장 마을: 버스 정류장(지붕·의자) + 시골 버스 + 함석지붕 집 + 자판기·전봇대."""
    s = Scene()
    gh(s, 2, 12, 12, 6, 4.4, 4.4, wall='cream', roof='teal', tex='plank')
    gh(s, 18, 15, 10, 6, 4.2, 4.0, wall='plaster', roof='roofred', wins=False)
    # 정류장
    s.box(3, 10, 4, 7, 0, 4.4, mat='wood', tex='plank', role='house', contour=True,
          decals=(('front', (3.6, 9.4, 1.2, 1.9, 'dark')),))
    s.add(ob.gable(2.2, 10.8, 2.8, 7.8, 4.4, .55, mat='roofred', tex='plain', role='roof', contour=True))
    s.box(11, 11.6, 4, 4.6, 0, 6, mat='steel', tex='plain', role='misc')
    s.box(10.2, 12.4, 3.8, 4.4, 6, 8, mat='cblue', tex='plain', role='misc', contour=True)
    # 버스
    s.box(13, 27, 2, 7, .6, 6.4, mat='cream', tex='plain', role='misc', contour=True,
          decals=(('front', (13, 27, 1.4, 2.4, 'band')), ('front', (14, 26, 3.6, 5.4, 'glass'))))
    s.box(13.2, 26.8, 2.2, 6.8, 6.4, 7, mat='plaster', tex='plain', role='roof', contour=True)
    for wx in (15.4, 24.6):
        s.box(wx - 1, wx + 1, 1.8, 2.4, 0, 1.8, mat='rail', tex='plain', role='misc')
    # 자판기·전봇대
    s.box(1, 3, 5, 7, 0, 4.4, mat='cred', tex='plain', role='misc', contour=True,
          decals=(('front', (1.4, 2.6, 2.2, 3.8, 'glass')),))
    pole(s, 28, 11, 12)
    return s


# ══════════════════════════════════════════ camp 2x2 ══════════════════════════════════════════
def camp():
    """캠핑장: 크림색 캠핑카(줄무늬·창) + 주황 텐트 + 모닥불 + 나무."""
    s = Scene()
    # 캠핑카
    s.box(2, 19, 8, 15, .8, 9, mat='plaster', tex='plain', role='house', contour=True,
          decals=(('front', (2, 19, 3, 3.8, 'band')), ('front', (4, 8, 4.6, 7.2, 'glass')), ('front', (10, 12.4, 1, 6.4, 'door')),
                  ('front', (14, 17, 4.6, 7.2, 'glass'))))
    s.box(2.6, 12, 9, 14.4, 9, 10.6, mat='plaster', tex='plain', role='roof', contour=True)
    s.box(19, 23, 8.6, 14.4, .8, 6, mat='cblue', tex='plain', role='misc', contour=True,
          decals=(('front', (19.6, 22.6, 3, 5.4, 'glass')),))
    for wx in (6, 18):
        s.box(wx - 1.2, wx + 1.2, 7.6, 8.4, 0, 2.2, mat='rail', tex='plain', role='misc')
    # 텐트
    s.add(M.tent_ridge_y(15, 27, 0, 6, 7.2, 'orange'))
    s.add(M.tent_ridge_y(25, 31, 13, 19, 5, 'cgreen'))
    # 모닥불·의자
    s.cyl(9, 2.5, 1.6, 0, .6, mat='stone', tex='plain', role='misc', contour=True)
    s.add(E.Ellip(9, 2.5, 1.2, .9, .9, 1.4, mat='ember', tex='plain', role='misc'))
    s.box(4, 6, 1, 3, 0, 2, mat='cred', tex='plain', role='misc', contour=True)
    tree(s, 28, 6.5, 2.4)
    return s


# ══════════════════════════════════════════ tower_small 1x2 ══════════════════════════════════════════
def tower_small():
    """소방망루: 네 다리 철골 + 엇갈림 버팀 + 빨간 지붕 망대 + 종."""
    s = Scene()
    for (x, y) in ((-5, 0), (4, 0), (-5, 6), (4, 6)):
        s.box(x, x + 1.2, y, y + 1.2, 0, 17, mat='steel', tex='plain', role='tower', contour=True)
    for z in (4, 9.5):
        s.add(M.obox((0.1, .6, z + 2.5), (12, .7, .7), M.rot_y(.45), mat='steel', tex='plain', role='misc'))
        s.add(M.obox((0.1, .6, z + 2.5), (12, .7, .7), M.rot_y(-.45), mat='steel', tex='plain', role='misc'))
        s.box(-5, 5.2, 0, 1.2, z + 5.4, z + 6.1, mat='steel', tex='plain', role='misc')
    s.box(-6, 6.2, -1, 8.2, 17, 18, mat='wood', tex='plain', role='misc', contour=True)
    s.box(-5, 5.2, 0, 7.2, 18, 22, mat='plaster', tex='plain', role='house', contour=True,
          decals=(('front', (-3.4, 3.6, 19, 21.4, 'dark')),))
    s.add(ob.hip(-6.6, 6.8, -1.6, 8.8, 22, .75, mat='roofred', tex='shingle', role='roof', contour=True))
    s.add(E.Ellip(.1, -1.6, 19.4, .9, .9, 1.0, mat='gold', tex='plain', role='misc', contour=True))
    s.box(-.3, .5, 3, 3.8, 24.5, 26, mat='cred', tex='plain', role='misc')
    return s


# ══════════════════════════════════════════ tower_great 2x4 ══════════════════════════════════════════
def tower_great():
    """방송 타워(도쿄타워풍): 넓게 벌린 다리 + 적백 띠 몸통 + 전망대 두 단 + 안테나."""
    s = Scene()
    xc, yc = 0, 6
    for sx in (-1, 1):
        for sy in (-1, 1):
            c = (xc + sx * 6.2, yc + sy * 3.6, 7)
            R = M.rot_y(sx * .42) @ M.rot_x(-sy * .3)
            s.add(M.obox(c, (1.4, 1.4, 15.5), R, mat='orange', tex='plain', role='tower', contour=True))
    s.box(-6.5, 6.5, yc - .5, yc + .5, 7.5, 8.5, mat='white', tex='plain', role='misc')
    M.add(s, M.Frustum(xc, yc, 5.2, 1.4, 13, 45, mat='orange', role='tower', contour=True), M.band_swap(13, 5, 'white'))
    M.add(s, M.Frustum(xc, yc, 6.2, 6.2, 20, 24, mat='white', role='tower', contour=True),
          M.cyl_windows(xc, yc, 6.2, 20.6, 23.6, pz=3, cols=14, ramp='glass', lit_p=.2, seed=3))
    M.add(s, M.Frustum(xc, yc, 3.4, 3.4, 32, 34.4, mat='white', role='tower', contour=True),
          M.cyl_windows(xc, yc, 3.4, 32.4, 34, pz=3, cols=10, ramp='glass', lit_p=.2, seed=4))
    s.box(-.5, .5, yc - .5, yc + .5, 45, 52, mat='white', tex='plain', role='misc')
    s.box(-.7, .7, yc - .7, yc + .7, 52, 53.4, mat='cred', tex='plain', role='misc')
    # 발치 건물
    return s


# ══════════════════════════════════════════ cave 2x2 ══════════════════════════════════════════
def cave():
    """터널: 초록 언덕 + 콘크리트 아치 입구 + 두 줄 철길 + 신호등."""
    s = Scene()
    s.add(E.Ellip(15.5, 13, 6, 13.5, 8, 11, mat='leaf2', tex='speck', role='wall', contour=True))
    s.add(E.Ellip(6, 10, 3, 5.5, 5, 6, mat='leaf2', tex='speck', role='wall', contour=True))
    s.box(7, 23, 3, 7, 0, 13, mat='plastbl', tex='brick', role='house', contour=True,
          decals=(('front', (9.6, 20.4, 0, 10.4, 'arch')),))
    s.box(6.4, 23.6, 2.4, 7, 13, 14.4, mat='plastbl', tex='plain', role='roof', contour=True)
    s.box(12, 18, 2.2, 2.4, 11, 12.6, mat='cyellow', tex='plain', role='misc')
    # 철길
    for x in (11.4, 18.2):
        s.box(x, x + .8, -2, 3, 0, .7, mat='steel', tex='plain', role='misc')
    for y in (-1.5, .5, 2.4):
        s.box(10.4, 20, y, y + .8, 0, .4, mat='wood', tex='plain', role='misc')
    # 신호등
    s.box(25, 25.8, 1, 1.8, 0, 9, mat='steel', tex='plain', role='misc')
    s.box(24.2, 26.6, .4, 1.4, 9, 12.6, mat='roofgrey', tex='plain', role='misc', contour=True,
          decals=(('front', (24.8, 26, 10.8, 12, 'red')),))
    return s


# ══════════════════════════════════════════ ruin 2x2 ══════════════════════════════════════════
def ruin():
    """폐공장: 깨진 톱니 지붕 + 녹슨 굴뚝 + 무너진 벽 + 잡초·잔해."""
    s = Scene()
    rng = np.random.RandomState(3)
    p = box(1, 23, 6, 18, 0, 7, mat='brick', tex='brick', role='house', contour=True)
    p.post = M.hole(13, 20, 1, 6, seed=4)
    s.add(p)
    for i, x in enumerate((1, 8.4, 15.8)):
        if i == 2:
            M.add(s, M.broken(x, x + 7.2, 6, 18, 9.5, tilts=((.5, .05), (-.2, .2)), drops=(0, 3), mat='oldgrey', tex='plain', role='roof', contour=True))
            continue
        sawtooth(s, x, x + 7.4, 6 + i * 0, 18, 7, 4.5, mat='oldgrey', glass='cblue', broken=.6, seed=i + 2)
    s.cyl(26, 14, 2.2, 0, 18, mat='brick', tex='brick', role='tower', contour=True)
    s.cyl(26, 14, 2.6, 16, 17.2, mat='rust', tex='plain', role='misc')
    M.rubble(s, rng, 2, 30, 0, 5, n=6, hmax=2.0, mats=('brick', 'rust', 'oldgrey'))
    for (x, y) in ((3, 3), (22, 2.5)):
        s.add(E.Ellip(x, y, 1, 1.8, 1.4, 1.6, mat='leaf2', tex='speck', role='misc', contour=True))
    return s


# ══════════════════════════════════════════ ruin_city 4x3 ══════════════════════════════════════════
def ruin_city():
    """폐쇄된 놀이공원: 녹슨 관람차(곤돌라 하나 떨어짐) + 끊긴 롤러코스터 + 빛바랜 회전목마 + 닫힌 정문."""
    s = Scene()
    cx, wy, cz, R = 17, 14, 17, 12.5
    wheel_ring(s, cx, wy, cz, R, n=20, mat='brick', th=1.3)
    s.cyl(cx, wy - .8, 2.0, cz - 1.0, cz + 1.0, mat='stone', tex='plain', role='misc', contour=True)
    for k in range(4):
        a = math.pi * k / 4 + .2
        s.add(M.obox((cx, wy + .3, cz), (R * 2, .4, .4), M.rot_y(-a), mat='rust', tex='plain', role='misc'))
    cols = ['cred', 'cblue', 'cyellow', 'cgreen', 'white', 'cred', 'cblue', 'cyellow']
    for k in range(8):
        if k == 5:
            continue
        a = 2 * math.pi * k / 8 + .2
        gx, gz = cx + R * math.cos(a), cz + R * math.sin(a)
        s.box(gx - 1.6, gx + 1.6, wy - 2.2, wy + 1.0, gz - 3.8, gz - .8, mat=cols[k], tex='plain', role='misc', contour=True,
              decals=(('front', (gx - .8, gx + .8, gz - 2.6, gz - 1.6, 'dark')),))
    for sx in (-1, 1):
        s.add(M.obox((cx + sx * 5, wy + 1.4, cz / 2), (1.4, 1.4, cz * 1.12), M.rot_y(sx * .45), mat='rust', tex='plain', role='tower', contour=True))
    # 떨어진 곤돌라
    s.add(M.obox((cx + 9, 6, 1.2), (2.8, 2.6, 2.4), M.rot_y(.6), mat='cred', tex='plain', role='misc', contour=True))
    # 롤러코스터(뒤 오른쪽, 끊긴 레일)
    for i, (x, h) in enumerate(((37, 8), (42, 14), (47, 17), (52, 11))):
        s.box(x, x + 1, 24, 25, 0, h, mat='rust', tex='plain', role='misc', contour=True)
    s.add(M.obox((39.5, 24.5, 11.5), (6.6, 2, 1), M.rot_y(-.85), mat='cred', tex='plain', role='misc', contour=True))
    s.add(M.obox((44.6, 24.5, 15.9), (5.8, 2, 1), M.rot_y(-.5), mat='cred', tex='plain', role='misc', contour=True))
    s.add(M.obox((50.5, 24.5, 14.6), (5.4, 2, 1), M.rot_y(.8), mat='cred', tex='plain', role='misc', contour=True))
    # 회전목마
    s.cyl(48, 10, 7, 0, 1.4, mat='stone', tex='plain', role='misc', contour=True)
    for k in range(6):
        a = 2 * math.pi * k / 6 + .3
        s.box(48 + 5.6 * math.cos(a) - .3, 48 + 5.6 * math.cos(a) + .3, 10 + 5.6 * math.sin(a) - .3, 10 + 5.6 * math.sin(a) + .3, 1.4, 6, mat='gold', tex='plain', role='misc')
    s.add(ob.Cone(48, 10, 8, 6, 11, mat='cred', tex='plain', role='roof', contour=True,
                  ))
    s.cyl(48, 10, .6, 11, 13.4, mat='gold', tex='plain', role='misc')
    # 정문(닫힌 철문)
    s.box(26, 28.2, 0, 2, 0, 9, mat='cream', tex='plain', role='gate', contour=True)
    s.box(38, 40.2, 0, 2, 0, 9, mat='cream', tex='plain', role='gate', contour=True)
    s.add(M.prism_arch(26, 40.2, 1, 3.4, N=6, z0=9, mat='cred', tex='plain', role='gate', contour=True))
    M.steel_door(s, 28.2, 38, 1, 6, mat='rust', stripe=False)
    s.box(2, 24, .6, 1.2, 0, 2.6, mat='rust', tex='plank', role='misc')
    return s


# ══════════════════════════════════════════ shrine 3x3 ══════════════════════════════════════════
def shrine():
    """동네 신사: 빨간 도리이 + 돌계단 + 기단 위 배전(박공 기와) + 석등 둘 + 신목."""
    s = Scene()
    s.box(9, 39, 13, 26, 0, 2.4, mat='stone', tex='brick', role='wall', contour=True)
    for i in range(2):
        s.box(19, 29, 10 + i * 1.2, 14, 0, 1.2 + i * 1.2, mat='stone', tex='plain', role='misc', contour=True)
    z0 = 2.4
    s.box(13, 35, 16, 23, z0, z0 + 6, mat='wood', tex='plank', role='house', contour=True,
          decals=(('front', (20, 28, z0, z0 + 4.6, 'lat')),))
    E.pillars(s, 12.6, 35.4, 16, z0, z0 + 6, 5, mat='cred', w=1.2, d=1.0)
    s.add(E.gable_ew(10, 38, 12.5, 26.5, z0 + 6, 1.05, mat='jade', tex='tile', role='roof', contour=True))
    s.add(ob.box(10, 38, 19.2, 19.8, z0 + 12.6, z0 + 14, mat='wood', tex='plain', role='roof', contour=True))
    s.box(20, 28, 13.6, 15, z0 + 6, z0 + 8.6, mat='jade', tex='plain', role='roof', contour=True)
    s.box(23, 25, 15.2, 16, z0 + 3.2, z0 + 5.2, mat='gold', tex='plain', role='misc')
    torii(s, 24, 2, 14, 12)
    stone_lantern(s, 10, 6, 6)
    stone_lantern(s, 38, 6, 6)
    tree(s, 5, 22, 3.2, 6)
    tree(s, 42.5, 22, 3.0, 5.5)
    return s


# ══════════════════════════════════════════ landmark_nature 3x3 ══════════════════════════════════════════
def landmark_nature():
    """호수 공원 큰 나무: 거대한 느티나무 + 앞 연못(오리배) + 벤치·가로등."""
    s = Scene()
    s.patch(6, 40, -2, 8, flat_fn('cwater', 0, 3, seed=2), mat='cwater', h=.3)
    s.box(5.4, 40.6, -2.6, -2, 0, .8, mat='stone', tex='plain', role='misc')
    s.cyl(18, 16, 3.0, 0, 11, mat='bark', tex='speck', role='wall', contour=True)
    for (x, y, z, rx, ry, rz) in ((18, 18, 21, 13, 8, 7.5), (8, 15, 18, 7.5, 6, 6), (28, 16, 18, 8.5, 6, 6),
                                  (18, 14, 27, 8.5, 6, 5), (18, 15, 15, 10, 6, 4.4)):
        s.add(E.Ellip(x, y, z, rx, ry, rz, mat='leaf2', tex='speck', role='roof', contour=True))
    # 오리배
    s.box(28, 33, 1, 4, .3, 2.4, mat='white', tex='plain', role='misc', contour=True)
    s.add(E.Ellip(32.6, 2.2, 3.4, 1.2, 1.0, 1.4, mat='white', tex='plain', role='misc', contour=True))
    s.box(33.2, 34.4, 1.8, 2.6, 3.2, 3.8, mat='cyellow', tex='plain', role='misc')
    # 벤치·가로등
    s.box(34, 41, 12, 14, 1.4, 2.0, mat='wood', tex='plank', role='misc', contour=True)
    s.box(34, 41, 13.6, 14.2, 2, 3.6, mat='wood', tex='plank', role='misc', contour=True)
    for x in (34.6, 40):
        s.box(x, x + .6, 12.2, 12.8, 0, 1.4, mat='steel', tex='plain', role='misc')
    lamp(s, 43, 12, 8)
    tree(s, 4, 12, 2.6)
    return s


# ══════════════════════════════════════════ circle 2x2 ══════════════════════════════════════════
def circle():
    """원형 광장 분수: 돌 수반 + 물 + 가운데 기둥과 물줄기 + 둘레 화단·가로등."""
    s = Scene()
    s.cyl(15, 10, 13, 0, .6, mat='plastbl', tex='plain', role='misc', contour=True)
    s.cyl(15, 10, 9, .6, 2.4, mat='stone', tex='brick', role='misc', contour=True)
    s.cyl(15, 10, 8, 2.0, 2.5, mat='cwater', tex='plain', role='misc')
    s.cyl(15, 10, 1.5, 2.4, 7, mat='stone', tex='plain', role='misc', contour=True)
    s.cyl(15, 10, 3.4, 7, 8, mat='stone', tex='plain', role='misc', contour=True)
    for (z, r) in ((9.6, 1.6), (11.8, 1.2)):
        s.add(M.Dome(15, 10, z, r, zmin=-99, mat='steam', role='steam', contour=True))
    for k, a in enumerate((200, 250, 290, 340)):
        th = math.radians(a)
        x, y = 15 + 11 * math.cos(th) + 0, 10 + 7.2 * math.sin(th) + 6
        s.add(E.Ellip(x, y, 1, 2.0, 1.5, 1.4, mat='leaf2', tex='speck', role='misc', contour=True))
        s.add(E.Ellip(x, y - .4, 2.0, .8, .6, .6, mat='cred' if k % 2 else 'cyellow', tex='plain', role='misc'))
    lamp(s, 2.5, 3, 8)
    lamp(s, 27.5, 3, 8)
    return s


# ══════════════════════════════════════════ volcano 2x2 ══════════════════════════════════════════
def volcano():
    """온천 화산: 김 오르는 갈색 산 + 발치 온천 료칸(기와) + 김 나는 노천탕."""
    s = Scene()
    rng = np.random.RandomState(5)
    s.add(E.oct_pyr(16, 12, 13, 0, 16, ztrunc=11.5, mat='rock', tex='speck', role='wall', contour=True))
    s.add(E.Ellip(16, 11, 11.5, 3.4, 2.4, .8, mat='steam', tex='plain', role='nocast'))
    M.steam(s, 16, 11, 13, rng, n=2, r0=2.2, rise=3.4, drift=2.4)
    # 료칸
    s.box(1.5, 16, -2, 3, 0, 5, mat='wood', tex='plank', role='house', contour=True,
          decals=(('front', (3, 14.5, 1.6, 3.8, 'lat')),))
    s.add(E.gable_ew(.5, 17, -3.4, 4.4, 5, .95, mat='jade', tex='tile', role='roof', contour=True))
    s.box(7.4, 10.2, -2.4, -2, 1.4, 4.4, mat='cblue', tex='plain', role='misc')
    # 노천탕
    s.cyl(24, 2, 5, 0, 1.4, mat='stone', tex='speck', role='misc', contour=True)
    s.cyl(24, 2, 4, 1.0, 1.5, mat='cwater', tex='plain', role='misc')
    M.steam(s, 24, 2, 3.4, rng, n=2, r0=1.6, rise=2.6, drift=1.6)
    return s


# ══════════════════════════════════════════ floating 5x4: 비행장 ══════════════════════════════════════════
def airplane(s, xc, y, z=0.0, L=20, span=28):
    """여객기(기수가 카메라 쪽): 동체(y 방향) + 좌우로 편 날개 + 꼬리날개 + 엔진 둘."""
    s.box(xc - 2.2, xc + 2.2, y, y + L, z + 1.6, z + 5.6, mat='white', tex='plain', role='misc', contour=True,
          decals=(('front', (xc - 1.4, xc + 1.4, z + 4.0, z + 5.0, 'glass')), ('front', (xc - 2.2, xc + 2.2, z + 2.4, z + 3.0, 'band'))))
    s.add(E.Ellip(xc, y + .4, z + 3.6, 2.2, 1.6, 2.0, mat='white', tex='plain', role='misc', contour=True))
    s.box(xc - span / 2, xc + span / 2, y + L * .4, y + L * .62, z + 2.4, z + 3.2, mat='white', tex='plain', role='misc', contour=True)
    s.box(xc - span * .22, xc + span * .22, y + L - 3, y + L - .6, z + 5.0, z + 5.6, mat='white', tex='plain', role='misc')
    s.box(xc - .6, xc + .6, y + L - 4, y + L, z + 5.6, z + 11, mat='cred', tex='plain', role='misc', contour=True)
    for ex in (xc - span * .28, xc + span * .28):
        s.cyl(ex, y + L * .42, 1.3, z + .4, z + 2.4, mat='steel', tex='plain', role='misc', contour=True)
    for wx in (xc - 2.6, xc + 2.6):
        s.box(wx - .5, wx + .5, y + L * .5, y + L * .5 + 1, 0, 1.6, mat='rail', tex='plain', role='misc')


def floating():
    """비행장: 활주로(흰 표시) + 여객기 + 관제탑 + 유리 터미널 + 격납고."""
    s = Scene()
    wh = np.array(SNOW[3], np.uint8)
    asp = ob.MAT['asphalt']

    def run_fn(x, y):
        col = np.array(asp, np.uint8)[np.clip((1 + ob.hsh(x, y, 4) * 1.6).astype(int), 0, 3)]
        m = (np.abs(y - 4) < .5) & (np.mod(np.floor(x), 6) < 3)
        m |= ((x < 8) | (x > 70)) & (np.mod(np.floor(y), 2) == 0) & (np.abs(y - 4) < 4)
        return np.where(m[:, None], wh, col)
    s.patch(1, 78, -4, 12, run_fn, mat='asphalt', h=.3)
    airplane(s, 30, -3, .3, 18, 32)
    # 터미널
    p = box(2, 40, 22, 32, 0, 10, mat='plaster', tex='plain', role='house', contour=True)
    p.post = M.windows(3, 22, z0=2, ztop=9, px=3, pz=4, lit_p=.1, ramp='glass', seed=8, band_right=False)
    s.add(p)
    s.add(M.prism_arch(1, 41, 27, 5.2, N=6, z0=10, mat='cblue', tex='plain', role='roof', contour=True))
    sign(s, 14, 28, 22, 6.6, 9.4, mat='white', ink='cblue')
    s.box(30, 34, 14, 22, 3, 6, mat='plaster', tex='plain', role='misc', contour=True)
    # 관제탑
    M.watch_tower(s, 46, 24, 5, 26)
    # 격납고
    s.box(56, 78, 18, 30, 0, 4, mat='cream', tex='plain', role='house', contour=True,
          decals=(('front', (59, 75, 0, 3.6, 'dark')),))
    p = M.prism_arch(55.6, 78.4, 24, 6.4, N=6, z0=4, mat='teal', tex='plain', role='roof', contour=True)
    p.post = M.ribs(3, ('front',), mat='teal')
    s.add(p)
    s.add(M.Frustum(4, 16, .4, .4, 0, 9, mat='steel', role='misc'))
    s.box(4.4, 8, 15.8, 16.2, 6.4, 8.6, mat='orange', tex='plain', role='misc')
    return s


ORDER = [
    ('capital', '역 앞 도심', 'capital', (6, 6), '교차로를 둘러싼 역 빌딩(유리 지붕·시계탑)·백화점·방송탑·빌딩'),
    ('fort_city', '신도시 단지', 'fort_city', (4, 4), '엇갈린 아파트 동 넷과 앞 놀이터(미끄럼틀·그네)'),
    ('harbor_city', '항구 마을', 'harbor_city', (5, 4), '여객선 터미널·어시장 창고 둘·등대·여객선'),
    ('castle', '학교', 'school', (3, 3), '3층 본관(시계)·초록 지붕 체육관·흙 운동장'),
    ('castle', '병원', 'hospital', (3, 3), '흰 고층 본관(빨간 십자·헬기장)·외래동·구급차'),
    ('large_town', '상점가', 'large_town', (3, 3), '초록 아케이드 지붕 골목과 양쪽 가게(차양·간판)'),
    ('village', '교외 주택가', 'village', (2, 2), '마당 있는 빨강·파랑 지붕 집 둘, 울타리·나무'),
    ('village', '시골 정류장 마을', 'village_rural', (2, 2), '버스 정류장·시골 버스·함석지붕 집·자판기'),
    ('camp', '캠핑장', 'camp', (2, 2), '캠핑카·주황 텐트·모닥불'),
    ('tower_small', '소방망루', 'tower_small', (1, 2), '철골 다리 위 빨간 지붕 망대와 종'),
    ('tower_great', '방송 타워', 'tower_great', (2, 4), '적백 띠 타워와 전망대 두 단'),
    ('cave', '터널', 'cave', (2, 2), '초록 언덕의 콘크리트 터널 입구와 철길'),
    ('ruin', '폐공장', 'ruin', (2, 2), '깨진 톱니 지붕·녹슨 굴뚝·잔해'),
    ('ruin_city', '폐쇄된 놀이공원', 'ruin_city', (4, 3), '녹슨 관람차·끊긴 롤러코스터·회전목마·닫힌 정문'),
    ('shrine', '동네 신사', 'shrine', (3, 3), '빨간 도리이·돌계단·배전·석등'),
    ('landmark_nature', '호수 공원 큰 나무', 'landmark_nature', (3, 3), '거대한 느티나무와 연못 오리배·벤치'),
    ('circle', '원형 광장 분수', 'circle', (2, 2), '돌 수반 분수와 화단·가로등'),
    ('volcano', '온천 화산', 'volcano', (2, 2), '김 오르는 산과 료칸·노천탕'),
    ('floating', '비행장', 'floating', (5, 4), '활주로·여객기·관제탑·터미널·격납고'),
]


# ══════════════════════════════════════════ 그림자 길이 ══════════════════════════════════════════
def clamp_shadow(s, H=7.0):
    """빛이 낮아(원래 빛) 고층이 칸 밖까지 그림자를 던진다. 높은 입체는 그림자를 끄고,
    그 안에 숨은(보이지 않는) 낮은 입체를 넣어 높이 H 짜리 그림자만 남긴다."""
    extra = []
    for p in s.prims:
        if p.role in ('ground', 'steam', 'nocast'):
            continue
        if isinstance(p, Poly) and sorted(p.tag) == ['back', 'bottom', 'front', 'left', 'right', 'top'] and \
                np.allclose(np.abs(p.n).max(1), 1):
            d = dict(zip(p.tag, p.d))
            x0, x1, y0, y1, z0, z1 = -d['left'], d['right'], -d['front'], d['back'], -d['bottom'], d['top']
            if z1 <= H + 1e-6:
                continue
            p.role = 'nocast'
            e = min(.3, (x1 - x0) * .2, (y1 - y0) * .2)
            if z0 < H - .5:
                extra.append(box(x0 + e, x1 - e, y0 + e, y1 - e, z0 + .05, H, mat=p.mat, tex='plain', role='caster'))
        elif isinstance(p, (ob.Cyl, M.Frustum)):
            z1 = p.z1
            if z1 <= H + 1e-6:
                continue
            p.role = 'nocast'
            r = min(p.r0, p.r1) if isinstance(p, M.Frustum) else p.r
            if p.z0 < H - .5:
                extra.append(ob.Cyl(p.xc, p.yc, r * .9, p.z0 + .05, H, mat=p.mat, tex='plain', role='caster'))
        else:
            top = getattr(p, 'zt', None)
            if top is None and hasattr(p, 'c'):
                top = p.c[2] + (p.r[2] if np.ndim(p.r) else p.r)
            if top is None or top > H:
                p.role = 'nocast'
    for c in extra:
        s.add(c)
    return s


def _wrap(f):
    def g():
        return clamp_shadow(f())
    g.__name__ = f.__name__
    g.__doc__ = f.__doc__
    return g


for _o in ORDER:
    globals()[_o[2]] = _wrap(globals()[_o[2]])
