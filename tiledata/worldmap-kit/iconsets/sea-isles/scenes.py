"""바다·군도(열대 군도·해적) 월드맵 아이콘 — 정면 카메라용 장면.
모래·야자·청록 바다빛, 나무 판자, 범선, 등대. 대부분 남쪽(앞)이 물가에 닿는다.
"""
import math
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / '_scene3d'))
import numpy as np  # noqa: E402
import oblique as ob  # noqa: E402
import east as E  # noqa: E402
import modsf_kit as M  # noqa: E402
import parts as P  # noqa: E402
import icons_v9_lib as L  # noqa: E402
from icons_v9_lib import STONE, WSTONE, WOOD, ROCK, RED, BLUE, SNOW, LEAF, VOLC, WATER, SAND, GOLD, GREY, hx  # noqa: E402
from oblique import Scene, box  # noqa: E402

SET = dict(id='sea-isles', name='바다·군도')

# ── 재질(전부 World.png 색) ─────────────────────────────────────────────────────────────────
ob.MAT.update({
    'sea': [WATER[0], WATER[1], WATER[2], WATER[3], WATER[4], WATER[5]],          # 청록 바다
    'beach': [SAND[0], SAND[1], SAND[2], SAND[3], SAND[4], SAND[5]],             # 흰 모래
    'blacksail': [STONE[0], STONE[1], STONE[2], STONE[3], STONE[4]],            # 해적 검은 돛
    'bone': [WSTONE[2], WSTONE[3], WSTONE[4], WSTONE[5], SNOW[5]],              # 뼈·흰 대리석
    'coral': [RED[2], RED[3], RED[4], RED[5], RED[6]],
    'smoke': [VOLC[1], VOLC[2], VOLC[3], VOLC[4], VOLC[5]],
    'iron': [STONE[0], STONE[1], STONE[2], STONE[3]],
})


# ── 장면 통째 줄이기(칸 맞춤용). 결(벽돌·기와 줄)은 화면 px 단위라 그대로 남는다 ──────────────────
def _scale_decal(dc, k):
    kind, spec = dc
    spec = list(spec)
    if kind == 'side':
        spec[1] *= k
        spec[2] *= k
        spec[3] *= k
    else:
        for i in range(4):
            spec[i] *= k
    return (kind, tuple(spec))


def scaled(s, k):
    for p in s.prims:
        if isinstance(p, ob.Poly):
            p.d = p.d * k
        elif isinstance(p, M.Dome):
            p.c = p.c * k
            p.r *= k
            p.zmin *= k
        elif isinstance(p, E.Ellip):
            p.c = p.c * k
            p.r = p.r * k
        elif isinstance(p, M.Frustum):
            p.xc, p.yc, p.r0, p.r1, p.z0, p.z1 = (v * k for v in (p.xc, p.yc, p.r0, p.r1, p.z0, p.z1))
            if p.zc is not None:
                p.zc *= k
            if hasattr(p, 'r'):
                p.r *= k
        elif isinstance(p, ob.Cone):
            p.xc, p.yc, p.r, p.z0, p.zt = (v * k for v in (p.xc, p.yc, p.r, p.z0, p.zt))
        elif isinstance(p, ob.Cyl):
            p.xc, p.yc, p.r, p.z0, p.z1 = (v * k for v in (p.xc, p.yc, p.r, p.z0, p.z1))
        else:
            raise TypeError(type(p))
        if p.decals:
            p.decals = tuple(_scale_decal(dc, k) for dc in p.decals)
        if p.fn is not None:
            f0 = p.fn
            p.fn = (lambda f: (lambda x, y: f(x / k, y / k)))(f0)
    return s


def turned(p, R, about):
    """볼록 다면체를 점 about 둘레로 R 만큼 돌린다(법선 n' = R n, 오프셋은 그 점 기준으로 다시 잡는다)."""
    a = np.array(about, float)
    n2 = (R @ p.n.T).T
    p.d = p.d - p.n @ a + n2 @ a
    p.n = n2
    return p


def fitk(k):
    def deco(f):
        def g():
            return scaled(f(), k)
        g.__doc__ = f.__doc__
        return g
    return deco


def sea_fn(x, y):
    w = np.array(ob.MAT['sea'], np.uint8)
    t = ob.hsh(np.floor(x / 3), np.floor(y), 21)
    i = np.where(t > .9, 4, np.where(t > .55, 2, 1))
    i = np.where(ob.hsh(x, y, 5) > .96, 5, i)
    return w[i]


def court_sand(xr=None, yr=None, canal=None, plaza=None):
    """성 안 바닥: 흰 모래 + 돌길 + 운하(canal=(y0,y1))."""
    sd = np.array(ob.MAT['beach'], np.uint8)
    stn = np.array(ob.MAT['stone'], np.uint8)
    w = np.array(ob.MAT['sea'], np.uint8)

    def fn(x, y):
        col = sd[np.clip((2 + ob.hsh(x, y, 13) * 3).astype(int), 0, 5)]
        road = np.zeros(len(x), bool)
        if xr:
            road |= (x >= xr[0]) & (x <= xr[1])
        if yr:
            road |= (y >= yr[0]) & (y <= yr[1])
        if plaza:
            road |= (x >= plaza[0]) & (x <= plaza[1]) & (y >= plaza[2]) & (y <= plaza[3])
        col = np.where(road[:, None], stn[np.clip((4 + ob.hsh(x, y, 17) * 2).astype(int), 0, 6)], col)
        if canal:
            c = (y >= canal[0]) & (y <= canal[1])
            edge = c & ((y < canal[0] + 1) | (y > canal[1] - 1))
            wc = w[np.where(ob.hsh(np.floor(x / 3), np.floor(y), 9) > .7, 3, 2)]
            col = np.where(c[:, None], wc, col)
            col = np.where(edge[:, None], stn[2], col)
        return col
    return fn


# ── 부품 ────────────────────────────────────────────────────────────────────────────────────
def palm(s, x, y, h=10, lean=2.0, r=4.2, z=0.0, seed=0):
    """야자: 휘는 줄기(짧은 원통을 쌓아 기울인다) + 처진 잎 6장 + 열매."""
    n = 5
    for i in range(n):
        t0, t1 = i / n, (i + 1) / n
        dx = lean * t0 ** 1.6
        s.cyl(x + dx, y, .75 - .1 * t0, z + h * t0, z + h * t1 + .2, mat='bark', tex='speck', role='misc')
    tx, tz = x + lean, z + h
    for k in range(6):
        a = math.radians(seed * 17 + k * 60 + 15)
        dr = math.radians(28)
        R = M.rot_z(a) @ M.rot_y(dr)
        c = np.array([tx, y, tz]) + R @ np.array([r * .5, 0, 0])
        s.add(M.obox(c, (r, 1.7, .7), R, mat='leaf2', tex='speck', role='misc', contour=True))
    s.add(E.Ellip(tx, y, tz, 1.3, 1.1, 1.0, mat='leaf2', tex='speck', role='misc', contour=True))
    s.add(E.Ellip(tx + .3, y - .9, tz - .9, .7, .6, .7, mat='wood', tex='plain', role='misc'))


def island(s, xc, yc, rx, ry, rz=2.6, mat='beach'):
    """모래섬 둔덕(낮은 타원체). 지형 위에 얹히는 섬 덩어리."""
    s.add(E.Ellip(xc, yc, 0, rx, ry, rz, mat=mat, tex='speck', role='ground', contour=True))


def water(s, xc, yc, rx, ry, z=0.0, rz=.7):
    s.add(E.Ellip(xc, yc, z, rx, ry, rz, mat='sea', tex='speck', role='ground', contour=False))


def ship(s, x, y, L=18, W=5, black=False, masts=2, hz=3.2, mh=15, z0=0.0, flag=True, sailmat=None):
    """범선: 들린 선체 + 갑판 + 돛대 + 네모 돛(정면을 향함) + 꼬리 선루."""
    s.add(E.hull(x, x + L, y, y + W, z0, z0 + hz, rise=.7, mat='wood', tex='plank', role='misc', contour=True))
    s.box(x + .6, x + L - .6, y + .4, y + W - .4, z0 + hz - .4, z0 + hz - .2, mat='wood', tex='plank', role='misc')
    s.box(x + .4, x + 5, y + .3, y + W - .3, z0 + hz, z0 + hz + 2.0, mat='wood', tex='plank', role='misc', contour=True,
          decals=(('front', (x + 1.4, x + 2.4, z0 + hz + .5, z0 + hz + 1.5, 'lit')),))
    sm = sailmat or ('blacksail' if black else 'sail')
    ym = y + W / 2
    xs = [x + L * .55] if masts == 1 else [x + L * .34, x + L * .7]
    for i, mx in enumerate(xs):
        top = z0 + hz + mh - i * 2.0
        yy = ym - 1.4 + i * .9                                 # 뒤 돛대 돛은 한 칸 뒤 — 두 돛 사이에 윤곽이 생긴다
        s.box(mx - .5, mx + .5, ym - .5, ym + .5, z0 + hz, top + .8, mat='wood', tex='plain', role='misc')
        span = top - (z0 + hz + 2.2)
        z = z0 + hz + 2.2
        for j, (fw, fh) in enumerate(((.17, .40), (.13, .33), (.09, .27))):
            sw = L * fw - i * .4
            zz1 = z + span * fh - .8
            s.box(mx - sw, mx + sw, yy, yy + .7, z, zz1, mat=sm, tex='ribs', role='misc', contour=True)
            s.box(mx - sw - .6, mx + sw + .6, yy + .7, yy + 1.2, zz1 - .1, zz1 + .5, mat='wood', tex='plain', role='misc')
            if black and i == 0 and j == 0:                    # 흰 해골 문장
                zc = (z + zz1) / 2
                s.box(mx - 1.3, mx + 1.3, yy - .4, yy, zc - .4, zc + 1.8, mat='bone', tex='plain', role='misc')
                s.box(mx - .9, mx - .2, yy - .6, yy - .4, zc + .5, zc + 1.2, mat='iron', tex='plain', role='misc')
                s.box(mx + .2, mx + .9, yy - .6, yy - .4, zc + .5, zc + 1.2, mat='iron', tex='plain', role='misc')
                s.add(M.obox((mx, yy - .2, zc - 1.2), (4.4, .3, .7), M.rot_y(.55), mat='bone', tex='plain', role='misc'))
                s.add(M.obox((mx, yy - .2, zc - 1.2), (4.4, .3, .7), M.rot_y(-.55), mat='bone', tex='plain', role='misc'))
            z = zz1 + .8
    if flag:
        fx = xs[0]
        ft = z0 + hz + mh
        s.box(fx - .3, fx + .3, ym - .3, ym + .3, ft, ft + 2.6, mat='wood', tex='plain', role='misc')
        s.box(fx + .3, fx + 3.2, ym - .3, ym + .2, ft + .6, ft + 2.6, mat='blacksail' if black else 'cloth', tex='plain', role='misc',
              decals=(('front', (fx + 1.3, fx + 2.2, ft + 1.2, ft + 2.0, 'gold')),) if black else ())
    # 뱃머리 기움 돛대
    s.add(M.obox((x + L + 1.2, ym, z0 + hz + 1.2), (4.0, .6, .6), M.rot_y(-.45), mat='wood', tex='plain', role='misc'))


def canoe(s, x, y, L=7, W=1.8):
    s.add(E.hull(x, x + L, y, y + W, 0, 1.3, rise=1.0, mat='wood', tex='plank', role='misc', contour=True))


def hut(s, x, y, w, d, wh=3.6, rise=4.6, z=0.0, wall='wood', door=True):
    """열대 초가: 판자벽 + 짚 우진각(처마가 넓다)."""
    dec = (('front', (x + w / 2 - 1.1, x + w / 2 + 1.1, z, z + min(3.0, wh - .6), 'door')),) if door else ()
    s.box(x, x + w, y, y + d, z, z + wh, mat=wall, tex='plank', role='house', contour=True, decals=dec)
    sl = rise / (min(w, d) / 2 + 1.4)
    s.add(E.hip_t(x - 1.6, x + w + 1.6, y - 1.6, y + d + 1.6, z + wh, sl, mat='thatch', tex='speck', contour=True, role='roof'))


def stilt_hut(s, x, y, w, d, ph=3.4, wh=3.2, rise=4.4):
    """말뚝 위 초가: 말뚝 넷 + 판자 마루 + 초가."""
    for px in (x - .3, x + w - .9):
        for py in (y - .5, y + d - .5):
            s.box(px, px + 1.2, py, py + 1.0, -.5, ph, mat='wood', tex='plain', role='misc')
    s.box(x - 1.2, x + w + 1.2, y - 1.6, y + d + .6, ph, ph + .8, mat='wood', tex='plank', role='misc', contour=True)
    hut(s, x, y, w, d, wh=wh, rise=rise, z=ph + .8)


def white_house(s, x, y, w, d, wh=4.0, roof='redroof', rise=3.4):
    s.box(x, x + w, y, y + d, 0, wh, mat='bone', tex='plain', role='house', contour=True,
          decals=(('front', (x + w / 2 - 1.0, x + w / 2 + 1.0, 0, 2.8, 'door')),
                  ('front', (x + 1.0, x + 2.2, 2.0, 3.2, 'shut')) if w >= 7 else ('front', (0, 0, -9, -9, 'dark')),
                  ('front', (x + w - 2.2, x + w - 1.0, 2.0, 3.2, 'shut')) if w >= 7 else ('front', (0, 0, -9, -9, 'dark'))))
    s.hip(x - 1, x + w + 1, y - 1, y + d + 1, wh, rise / (min(w, d) / 2 + 1), mat=roof, tex='shingle', contour=True, role='roof')


def round_tower_w(s, xc, yc, r, h, roof='cblue', rh=None, mat='bone', base=0.0):
    """흰 원탑 + 푸른 원뿔 지붕(해상 왕국)."""
    s.add(ob.Cyl(xc, yc, r, base, base + h, mat=mat, tex='brick', role='tower', contour=True,
                 decals=(('side', (-90, .8, base + h * .55, base + h * .8, 'dark')),)))
    s.add(ob.Cyl(xc, yc, r + .6, base + h - 1.0, base + h, mat=mat, tex='plain', role='tower', contour=True))
    s.add(ob.Cone(xc, yc, r + 1.2, base + h, base + h + (rh or r * 2.2), mat=roof, tex='shingle', role='roof', contour=True))


def cannon(s, x, y, z, L=3.0):
    """대포: 앞(-y)으로 내민 쇠 포신 + 나무 포가."""
    s.box(x - .9, x + .9, y, y + 1.6, z, z + .9, mat='wood', tex='plain', role='misc')
    s.add(M.obox((x, y - L / 2 + .6, z + 1.3), (1.2, L, 1.2), mat='iron', tex='plain', role='misc', contour=True))


def wall_w(s, x0, x1, y0, y1, h, mat='bone', edges=('front',), decals=()):
    s.box(x0, x1, y0, y1, 0, h, mat=mat, tex='brick', role='wall', contour=True, decals=decals)
    P.merlons(s, x0, x1, y0, y1, h, edges=edges, mat=mat)


def barrel(s, x, y, r=1.0, h=1.8):
    s.cyl(x, y, r, 0, h, mat='wood', tex='plain', role='misc', contour=True)


def chest(s, x, y, w=3.0, d=2.0, h=1.8):
    s.box(x, x + w, y, y + d, 0, h, mat='wood', tex='plank', role='misc', contour=True,
          decals=(('front', (x + w / 2 - .5, x + w / 2 + .5, h * .4, h * .8, 'gold')),))
    s.box(x - .1, x + w + .1, y - .1, y + d + .1, h, h + .8, mat='gold', tex='plain', role='misc', contour=True)


def coins(s, x, y, rx=2.2, ry=1.4):
    s.add(E.Ellip(x, y, 0, rx, ry, 1.2, mat='gold', tex='speck', role='misc', contour=True))


# ══════════════════════════════════════════════════════════════════ 도시
@fitk(0.96)
def capital():
    """해상 왕국 수도: 모래섬 위 흰 성벽 · 가운데 흰 궁(푸른 원뿔 지붕) · 가로 운하와 다리 · 앞 부두에 범선 둘."""
    s = Scene()
    x0, x1, D = 6, 86, 74
    cx = 46
    island(s, cx, 34, 46, 40, 2.4)
    s.patch(x0, x1, 4, D - 4, court_sand(xr=(cx - 2, cx + 2), canal=(22, 27)), z=1.6, h=.5, mat='beach')
    # 운하 다리
    for bx in (cx - 3, 22, 68):
        s.box(bx, bx + 6, 20.5, 28.5, 1.6, 2.9, mat='stone', tex='brick', role='misc', contour=True)
    # 뒤·옆 성벽
    wall_w(s, x0 - 3, x1 + 3, D - 5, D, 8)
    wall_w(s, x0 - 3, x0 + 3, 0, D, 8)
    wall_w(s, x1 - 3, x1 + 3, 0, D, 8)
    # 궁성(뒤쪽 높은 기단)
    s.box(cx - 17, cx + 17, 40, 62, 0, 7, mat='bone', tex='brick', role='keep', contour=True)
    P.merlons(s, cx - 17, cx + 17, 40, 62, 7, edges=('front',), mat='bone')
    s.box(cx - 10, cx + 10, 46, 58, 7, 17, mat='bone', tex='brick', role='keep', contour=True,
          decals=(('front', (cx - 2, cx + 2, 7, 12, 'arch')), ('front', (cx - 7, cx - 5.5, 12, 15, 'shut')), ('front', (cx + 5.5, cx + 7, 12, 15, 'shut'))))
    s.add(M.Dome(cx, 52, 17, 6.5, zmin=17, mat='cblue', role='roof', contour=True))
    s.add(ob.Cyl(cx, 52, .5, 23, 27, mat='gold', tex='plain', role='roof'))
    for tx in (cx - 14, cx + 14):
        round_tower_w(s, tx, 50, 3.4, 19, rh=8)
    round_tower_w(s, cx, 59, 2.6, 24, rh=7)
    # 집들(운하 양쪽)
    for (hx_, hy, w, d, rf) in ((10, 31, 9, 6, 'redroof'), (22, 36, 8, 5, 'cblue'), (64, 32, 9, 6, 'cblue'), (76, 36, 8, 5, 'redroof'),
                                (10, 8, 9, 6, 'cblue'), (22, 11, 8, 5, 'redroof'), (64, 9, 9, 6, 'redroof'), (76, 12, 8, 5, 'cblue')):
        white_house(s, hx_, hy, w, d, wh=4.2, roof=rf)
    for (tx, ty) in ((35, 34), (57, 34), (34, 9), (58, 11)):
        palm(s, tx, ty, 9, 1.6, 3.6, z=1.6, seed=tx)
    # 앞 성벽 + 바다문
    wall_w(s, x0 - 3, cx - 9, 0, 5, 8, edges=('front', 'back'))
    wall_w(s, cx + 9, x1 + 3, 0, 5, 8, edges=('front', 'back'))
    s.box(cx - 9, cx + 9, -1, 6, 0, 11, mat='bone', tex='brick', role='gate', contour=True,
          decals=(('front', (cx - 3.5, cx + 3.5, 0, 8, 'arch')),))
    P.merlons(s, cx - 9, cx + 9, -1, 6, 11, edges=('front',), mat='bone')
    for (tx, ty) in ((x0 - 1, 2), (x1 + 1, 2), (x0 - 1, D - 2), (x1 + 1, D - 2)):
        round_tower_w(s, tx, ty, 4.2, 11, rh=8)
    # 부두 + 범선
    s.box(cx - 3, cx + 3, -12, -1, 0, 1.6, mat='wood', tex='plank', role='misc', contour=True)
    ship(s, 8, -15, 22, 5.5, masts=2, mh=16, sailmat='cblue')
    ship(s, 58, -15, 22, 5.5, masts=2, mh=16, sailmat='cblue')
    return s


def fort_city():
    """해안 요새 도시: 사각 성벽 네 귀에 다이아몬드 포대(대포), 안에 흰 집들과 망루."""
    s = Scene()
    x0, x1, D = 10, 52, 40
    s.patch(x0, x1, 3, D - 3, court_sand(xr=(29, 33), plaza=(24, 38, 14, 22)), mat='beach')
    wall_w(s, x0, x1, D - 4, D, 6, mat='stone')
    wall_w(s, x0, x0 + 4, 0, D, 6, mat='stone')
    wall_w(s, x1 - 4, x1, 0, D, 6, mat='stone')
    # 안: 사령부 + 집
    s.box(23, 39, 24, 32, 0, 8, mat='bone', tex='brick', role='keep', contour=True,
          decals=(('front', (29.5, 32.5, 0, 4, 'door')), ('front', (25, 26.5, 5, 7, 'shut')), ('front', (35.5, 37, 5, 7, 'shut'))))
    s.hip(22, 40, 23, 33, 8, .55, mat='redroof', contour=True, role='roof')
    s.box(30, 30.6, 28, 28.6, 12, 18, mat='wood', tex='plain', role='misc')
    s.box(30.6, 34, 28, 28.4, 15.5, 18, mat='cblue', tex='plain', role='misc')
    white_house(s, 15, 22, 6, 5, wh=3.6, roof='cblue', rise=3)
    white_house(s, 42, 22, 6, 5, wh=3.6, roof='redroof', rise=3)
    white_house(s, 15, 9, 6, 4, wh=3.4, roof='redroof', rise=3)
    white_house(s, 42, 9, 6, 4, wh=3.4, roof='cblue', rise=3)
    palm(s, 26, 10, 8, 1.4, 3.2, seed=3)
    palm(s, 37, 11, 7, -1.2, 3.0, seed=5)
    # 앞 성벽 + 문
    s.box(x0, x1, 0, 4, 0, 6, mat='stone', tex='brick', role='wall', contour=True,
          decals=(('front', (28.5, 33.5, 0, 4.6, 'arch')),))
    P.merlons(s, x0, x1, 0, 4, 6, edges=('front',), mat='stone')
    # 네 귀 다이아몬드 포대
    for (bx, by) in ((x0, 2), (x1, 2), (x0, D - 2), (x1, D - 2)):
        R = M.rot_z(math.radians(45))
        s.add(M.obox((bx, by, 3.6), (11, 11, 7.2), R, mat='stone', tex='brick', role='tower', contour=True))
        s.add(M.obox((bx, by, 7.6), (9, 9, 1.0), R, mat='stone', tex='plain', role='tower', contour=True))
        if by < 10:
            cannon(s, bx - 2.6, by - 4.2, 7.2, 3.0)
            cannon(s, bx + 2.6, by - 4.2, 7.2, 3.0)
    return s


@fitk(.97)
def harbor_city():
    """해적 항구: 판자 집·2층 술집(간판), 앞의 나무 부두, 오른쪽 앞에 검은 돛 해적선."""
    s = Scene()
    # 뒤 판자 마을
    s.box(4, 20, 26, 34, 0, 9, mat='wood', tex='plank', role='house', contour=True,
          decals=(('front', (10.5, 13.5, 0, 3.6, 'door')), ('front', (6, 8, 5, 7.5, 'lit')), ('front', (16, 18, 5, 7.5, 'lit'))))
    s.add(E.gable_ew(3, 21, 25, 35, 9, .8, mat='redroof', tex='shingle', role='roof', contour=True))
    s.box(9, 15, 24.2, 24.8, 5, 7.6, mat='gold', tex='plain', role='misc', contour=True)        # 술집 간판
    hut(s, 26, 28, 9, 6, wh=4, rise=4.6)
    hut(s, 56, 27, 9, 6, wh=4, rise=4.6)
    s.box(40, 52, 24, 32, 0, 6, mat='wood', tex='plank', role='house', contour=True,
          decals=(('front', (44.5, 47.5, 0, 3.4, 'door')),))
    s.add(E.gable_ew(39, 53, 23, 33, 6, .9, mat='thatch', tex='speck', role='roof', contour=True))
    s.box(12, 22, 12, 18, 0, 4.4, mat='wood', tex='plank', role='house', contour=True,
          decals=(('front', (15.5, 18.5, 0, 3.2, 'door')),))
    s.add(E.gable_ew(11, 23, 11, 19, 4.4, .8, mat='redroof', tex='shingle', role='roof', contour=True))
    for (bx, by) in ((26, 15), (28.3, 15.6), (27, 17.6)):
        barrel(s, bx, by)
    palm(s, 34, 18, 10, 1.6, 3.8, seed=1)
    palm(s, 3, 18, 9, -1.4, 3.6, seed=4)
    palm(s, 68, 20, 9, 1.4, 3.6, seed=8)
    # 부두
    s.box(2, 50, 4, 9, 0, 1.8, mat='wood', tex='plank', role='misc', contour=True)
    s.box(10, 15, -10, 4, 0, 1.8, mat='wood', tex='plank', role='misc', contour=True)
    s.box(36, 41, -10, 4, 0, 1.8, mat='wood', tex='plank', role='misc', contour=True)
    for px in (2.5, 10.5, 13.5, 36.5, 39.5, 48):
        s.box(px, px + 1.1, -10 if px in (10.5, 13.5, 36.5, 39.5) else 3.4, (-8.9 if px in (10.5, 13.5, 36.5, 39.5) else 4.5), -.5, 2.8,
              mat='wood', tex='plain', role='misc')
    s.box(20, 23, 5, 7.5, 1.8, 3.6, mat='wood', tex='plank', role='misc', contour=True)
    # 해적선
    ship(s, 42, -12, 29, 6.5, black=True, masts=2, mh=31, hz=4.6)
    canoe(s, 18, -8, 7)
    return s


# ══════════════════════════════════════════════════════════════════ 성
@fitk(0.94)
def castle():
    """해적 요새: 바위 언덕 위 통나무 울타리 요새 + 망루 + 해골 깃발."""
    s = Scene()
    s.add(E.Ellip(22, 14, 2, 21, 13, 7.5, mat='stone', tex='speck', role='ground', contour=True))
    s.add(E.Ellip(9, 6, 1, 9, 6, 5, mat='stone', tex='speck', role='ground', contour=True))
    s.add(E.Ellip(36, 5, 0, 7, 5, 3.5, mat='stone', tex='speck', role='ground', contour=True))
    z = 6.5
    # 울타리(통나무 벽)
    s.box(6, 38, 20, 23, z, z + 6, mat='wood', tex='plank', role='wall', contour=True)
    s.box(6, 9, 6, 23, z - 1, z + 6, mat='wood', tex='plank', role='wall', contour=True)
    s.box(35, 38, 6, 23, z - 1, z + 6, mat='wood', tex='plank', role='wall', contour=True)
    s.box(9, 35, 5, 8, z - 1.5, z + 5, mat='wood', tex='plank', role='wall', contour=True,
          decals=(('front', (19.5, 24.5, z - 1.5, z + 3.2, 'gate')),))
    for x in np.arange(6.5, 38, 2):
        s.add(ob.Cone(x + .5, 6.5, .9, z + 5 if 9 < x < 35 else z + 6, z + 7 if 9 < x < 35 else z + 8, mat='wood', tex='plain', role='misc'))
    # 안 판자 집 + 망루
    s.box(11, 22, 13, 19, z, z + 5.5, mat='wood', tex='plank', role='house', contour=True,
          decals=(('front', (15.5, 17.5, z, z + 3, 'door')),))
    s.add(E.gable_ew(10, 23, 12, 20, z + 5.5, .8, mat='thatch', tex='speck', role='roof', contour=True))
    for px in (26, 32):
        for py in (11, 16):
            s.box(px, px + 1.2, py, py + 1.2, z, z + 12, mat='wood', tex='plain', role='misc')
    s.box(25, 34, 10, 18, z + 12, z + 13, mat='wood', tex='plank', role='misc', contour=True)
    s.box(25, 34, 10, 11, z + 13, z + 15, mat='wood', tex='plank', role='misc', contour=True)
    s.add(E.hip_t(24, 35, 9.5, 18.5, z + 16.5, .7, mat='thatch', tex='speck', role='roof', contour=True))
    for px in (25.2, 33):
        s.box(px, px + .8, 10.2, 11, z + 15, z + 16.6, mat='wood', tex='plain', role='misc')
    # 해골 깃발
    fx = 29.5
    s.box(fx - .3, fx + .3, 14, 14.6, z + 18, z + 26, mat='wood', tex='plain', role='misc')
    s.box(fx + .3, fx + 6, 14, 14.4, z + 21.5, z + 26, mat='blacksail', tex='plain', role='misc', contour=True,
          decals=(('front', (fx + 2.4, fx + 3.8, z + 23.2, z + 24.8, 'gold')),))
    # 앞 바위에 대포
    cannon(s, 12, 4, 4.8, 2.6)
    return s


@fitk(0.9)
def castle_b():
    """해안 포대: 사암 흉벽 위에 대포 다섯 문이 바다(앞)를 겨눈다 · 화약 창고 · 원형 망루 · 깃대."""
    s = Scene()
    s.box(2, 46, 2, 18, 0, 5, mat='wstone', tex='brick', role='wall', contour=True)
    s.box(2, 46, 2, 4.5, 5, 7, mat='wstone', tex='brick', role='wall', contour=True)
    for (m0, m1) in ((2, 4.6), (11, 13), (19, 21), (27, 29), (35, 37), (43.4, 46)):
        s.box(m0, m1, 2, 4.5, 7, 9.4, mat='wstone', tex='brick', role='merlon', contour=True)
    for x in (8, 16, 24, 32, 40):
        s.box(x - 1.8, x + 1.8, 4.6, 8.0, 5.0, 7.4, mat='wood', tex='plain', role='misc', contour=True)
        s.cyl(x - 2.0, 5.6, 1.1, 5.0, 6.0, mat='wood', tex='plain', role='misc')
        s.cyl(x + 2.0, 5.6, 1.1, 5.0, 6.0, mat='wood', tex='plain', role='misc')
        s.add(M.obox((x, 3.6, 8.4), (2.2, 7.5, 2.2), M.rot_x(.1), mat='iron', tex='plain', role='misc', contour=True))
        s.add(M.obox((x, -.1, 8.0), (2.8, 1.0, 2.8), M.rot_x(.1), mat='iron', tex='plain', role='misc', contour=True))
    # 뒤 화약 창고·망루
    s.box(6, 18, 10, 17, 5, 10, mat='wstone', tex='brick', role='house', contour=True,
          decals=(('front', (10.8, 13.2, 5, 8.4, 'door')),))
    s.hip(5, 19, 9, 18, 10, .55, mat='redroof', contour=True, role='roof')
    s.add(ob.Cyl(38, 13, 4, 5, 15, mat='wstone', tex='brick', role='tower', contour=True,
                 decals=(('side', (-90, .8, 10, 13, 'dark')),)))
    s.ring_crenels(38, 13, 4, 15, mat='wstone', n=8, size=1.8, h=1.8)
    s.box(37.7, 38.3, 12.7, 13.3, 15, 24, mat='wood', tex='plain', role='misc')
    s.box(38.3, 43, 12.7, 13.1, 20.5, 24, mat='cblue', tex='plain', role='misc')
    for (bx, by) in ((23, 13), (25.3, 14), (24.1, 16)):
        s.cyl(bx, by, 1.0, 5, 6.8, mat='wood', tex='plain', role='misc', contour=True)
    s.add(E.Ellip(30, 15.5, 5, 2.4, 1.6, 1.4, mat='iron', tex='speck', role='misc', contour=True))   # 포탄 더미
    return s


# ══════════════════════════════════════════════════════════════════ 마을
def large_town():
    """섬 마을: 모래섬 위 초가 여섯 채(앞뒤로 엇갈림) · 야자 · 앞 물가에 카누 둘."""
    s = Scene()
    island(s, 22, 18, 21, 20, 2.0)
    for (x, y, w, d, wh, rise) in ((4, 31, 8, 5, 3.4, 4.4), (25, 32, 8, 5, 3.4, 4.4),
                                   (13, 21, 9, 6, 3.6, 4.8), (31, 19, 8, 5, 3.6, 4.6),
                                   (3, 9, 8, 5, 3.6, 4.6), (21, 7, 9, 6, 3.8, 5.0)):
        hut(s, x, y, w, d, wh=wh + 1.2, rise=rise)
    palm(s, 16, 33, 9, 1.4, 3.4, seed=2)
    palm(s, 38, 8, 10, 1.4, 3.6, seed=6)
    palm(s, 4, 22, 9, -1.3, 3.4, seed=9)
    palm(s, 14, 6, 7, 1.0, 3.0, seed=4)
    canoe(s, 4, -3.5, 8)
    canoe(s, 26, -4.0, 7)
    return s


@fitk(0.93)
def village():
    """수상 가옥 마을: 얕은 물 위 말뚝 초가 셋 + 잇는 판자 다리."""
    s = Scene()
    water(s, 15, 8, 16, 9, z=0, rz=.8)
    stilt_hut(s, 3, 9, 7, 5, ph=3.0, wh=3.0, rise=4.0)
    stilt_hut(s, 19, 11, 7, 5, ph=3.0, wh=3.0, rise=4.0)
    stilt_hut(s, 12, 1, 6, 4, ph=2.6, wh=2.8, rise=3.6)
    s.box(10.5, 18.5, 10.5, 12.5, 3.0, 3.6, mat='wood', tex='plank', role='misc', contour=True)
    canoe(s, 22, 1.5, 6, 1.6)
    return s


def village_b():
    """어촌: 모래 위 초가 둘 · 장대에 늘어진 그물 · 끌어올린 작은 돛배."""
    s = Scene()
    hut(s, 2, 13, 9, 6, wh=3.6, rise=4.6)
    hut(s, 19, 14, 8, 5, wh=3.4, rise=4.2)
    for px in (14, 21.5):
        s.box(px, px + .8, 6, 6.8, 0, 8, mat='wood', tex='plain', role='misc')
    s.box(14, 22.3, 6.1, 6.6, 7.2, 7.8, mat='wood', tex='plain', role='misc')
    s.add(E.Ellip(18.2, 6.4, 5.4, 3.6, .5, 2.6, mat='thatch', tex='speck', role='misc', contour=True))   # 늘어진 그물
    s.add(E.hull(1, 11, 1, 4.4, 0, 2.2, rise=1.0, mat='wood', tex='plank', role='misc', contour=True))
    s.box(5.6, 6.3, 2.4, 3.1, 2.0, 9, mat='wood', tex='plain', role='misc')
    s.box(6.3, 9.6, 2.4, 2.8, 3.4, 8.4, mat='sail', tex='ribs', role='misc', contour=True)
    barrel(s, 27, 6, 1.0, 1.8)
    s.add(E.Ellip(25.5, 2.4, .4, 2.4, 1.4, 1.0, mat='sea', tex='speck', role='misc', contour=True))     # 물고기 통 대신 물웅덩이
    return s


@fitk(.8)
def camp():
    """난파 생존자 야영: 기운 돛대에 걸친 돛천 천막 · 모닥불 · 반쪽 선체 조각 · 통 · 구조 깃발."""
    s = Scene()
    # 반쪽 선체(뒤 오른쪽, 엎어 세운 판자벽)
    s.add(E.hull(19, 32, 12, 16, 0, 5.5, rise=.8, mat='wood', tex='plank', role='wall', contour=True,
                 decals=(('front', (24, 28, 1.5, 4.5, 'dark')),)))
    s.add(M.tent_ridge_y(0, 17, 5, 14, 9.5, mat='sail'))
    s.add(ob.box(8.2, 8.8, 4, 4.6, 0, 11.5, mat='wood', tex='plain', role='misc'))
    s.add(ob.box(10.5, 13.5, 4.4, 5.0, 2.0, 3.6, mat='cloth', tex='plain', role='misc'))     # 덧댄 천
    # 모닥불
    for a in (.5, -.5, 1.5):
        s.add(M.obox((19, 4, .5), (4.4, .8, .8), M.rot_z(a), mat='wood', tex='plain', role='misc', contour=True))
    s.add(ob.Cone(19, 4, 1.7, .6, 4.6, mat='ember', tex='plain', role='misc', contour=True))
    s.add(ob.Cone(19, 3.6, .8, .6, 2.6, mat='gold', tex='plain', role='misc'))
    # 통·상자·깃대
    barrel(s, 27, 5, 1.1, 2.0)
    s.box(23.5, 26.5, 1, 3.4, 0, 2.2, mat='wood', tex='plank', role='misc', contour=True)
    s.add(M.obox((30, 9, 6.5), (.8, .8, 13), M.rot_y(.12), mat='wood', tex='plain', role='misc'))
    s.box(30.6, 33.6, 8.8, 9.2, 9.8, 12.6, mat='cloth', tex='plain', role='misc', contour=True)
    return s


def _lighthouse(s, xc, yc, r0, r1, h, bands=4, mat='bone', band='cred', base=0.0):
    """흰·빨강 띠 등대 몸통(아래가 넓은 원뿔대를 띠마다 끊어 쌓는다)."""
    for i in range(bands):
        z0, z1 = base + h * i / bands, base + h * (i + 1) / bands
        ra = r0 + (r1 - r0) * i / bands
        rb = r0 + (r1 - r0) * (i + 1) / bands
        s.add(M.Frustum(xc, yc, ra, rb, z0, z1, mat=band if i % 2 else mat, role='tower', contour=True))
    zt = base + h
    s.add(ob.Cyl(xc, yc, r1 + 1.2, zt, zt + .9, mat='iron', tex='plain', role='tower', contour=True))
    s.add(ob.Cyl(xc, yc, r1 - .3, zt + .9, zt + 3.4, mat='gold', tex='plain', role='tower', contour=True,
                 decals=(('side', (-90, 1.0, zt + 1.2, zt + 3.1, 'lit')),)))
    s.add(ob.Cone(xc, yc, r1 + .6, zt + 3.4, zt + 6, mat='redroof', tex='plain', role='roof', contour=True))
    return zt


@fitk(.92)
def tower_small():
    """등대: 바위 위 흰·빨강 띠 탑과 불빛."""
    s = Scene()
    s.add(E.Ellip(6, 4, .5, 3.8, 2.6, 2.0, mat='rock', tex='speck', role='ground', contour=True))
    _lighthouse(s, 6, 4, 2.7, 1.9, 17, bands=5, base=1.2)
    return s


@fitk(.93)
def tower_great():
    """큰 등대: 바위 위 돌 기단 + 흰 벽돌 탑(창·붉은 띠) + 회랑 + 불 켜진 등실."""
    s = Scene()
    xc, yc = 13, 6
    s.add(E.Ellip(xc, yc, .3, 9, 5.0, 2.8, mat='rock', tex='speck', role='ground', contour=True))
    s.add(E.oct_prism(xc, yc, 7.0, 0, 5.5, mat='stone', tex='brick', role='wall', contour=True,
                      decals=(('front', (xc - 1.5, xc + 1.5, 1.2, 4.8, 'arch')),)))
    s.add(E.oct_prism(xc, yc, 7.6, 5.5, 6.5, mat='stone', tex='plain', role='wall', contour=True))
    h = 33
    fr = M.Frustum(xc, yc, 5.2, 3.6, 6.5, 6.5 + h, mat='bone', tex='brick', role='tower', contour=True,
                   decals=tuple(('side', (-90, .9, 6.5 + z, 6.5 + z + 2.4, 'dark')) for z in (5, 13, 24)))
    fr.r = 4.4
    s.add(fr)
    s.add(M.Frustum(xc, yc, 4.65, 4.35, 6.5 + h * .55, 6.5 + h * .55 + 2.2, mat='cred', role='tower', contour=True))
    zt = 6.5 + h
    s.add(ob.Cyl(xc, yc, 5.6, zt, zt + 1.3, mat='stone', tex='plain', role='tower', contour=True))
    for k in range(10):
        a = 2 * math.pi * k / 10
        px, py = xc + 4.9 * math.cos(a), yc + 4.9 * math.sin(a)
        s.box(px - .3, px + .3, py - .3, py + .3, zt + 1.3, zt + 2.9, mat='iron', tex='plain', role='misc')
    s.add(ob.Cyl(xc, yc, 5.2, zt + 2.5, zt + 3.0, mat='iron', tex='plain', role='misc'))
    s.add(ob.Cyl(xc, yc, 3.2, zt + 1.3, zt + 5.6, mat='ember', tex='plain', role='tower', contour=True,
                 decals=(('side', (-90, 2.0, zt + 1.7, zt + 5.2, 'lit')),)))
    s.add(M.Dome(xc, yc, zt + 5.6, 3.8, zmin=zt + 5.6, mat='iron', role='roof', contour=True))
    s.add(ob.Cyl(xc, yc, .4, zt + 9, zt + 11, mat='gold', tex='plain', role='roof'))
    return s


@fitk(.86)
def cave():
    """해적 보물 동굴: 회색 바위 절벽의 해식 동굴 · 입구 앞 금빛 보물 상자와 금화 더미 · 해골 표지."""
    s = Scene()
    s.add(E.Ellip(16, 10, 5, 14.5, 8, 11, mat='stone', tex='speck', role='wall', contour=True))
    s.add(E.Ellip(5, 8, 3, 6, 5, 7, mat='stone', tex='speck', role='wall', contour=True))
    s.add(E.Ellip(27, 7, 3, 6, 5, 6.5, mat='stone', tex='speck', role='wall', contour=True))
    s.box(10.5, 22, 1.4, 4, 0, 11, mat='stone', tex='speck', role='house', contour=False,
          decals=(('front', (12.0, 20.4, 0, 9.2, 'arch')),))
    palm(s, 24, 10, 6, 1.2, 3.0, z=11, seed=2)
    island(s, 15, -1, 13, 3, 1.4)
    chest(s, 6, -2.6, 4.4, 2.6, 2.4)
    coins(s, 12.5, -3.0, 2.4, 1.4)
    coins(s, 10.8, -1.6, 1.4, 1.0)
    s.box(25, 25.6, -2, -1.4, 0, 5.5, mat='wood', tex='plain', role='misc')
    s.add(E.Ellip(25.3, -2.0, 5.2, 1.3, .5, 1.1, mat='bone', tex='plain', role='misc', contour=True,
                  decals=()))
    return s


@fitk(.8)
def ruin():
    """난파선: 모래톱에 박혀 앞으로 기운 배 몸통 · 뒤쪽은 판자가 떨어져 늑골이 드러남 · 부러진 돛대."""
    s = Scene()
    island(s, 16, 8, 16, 8, 2.2)
    R = M.rot_z(-.08) @ M.rot_y(.12) @ M.rot_x(-.22)
    piv = (16, 6, 1)
    s.add(turned(E.hull(13, 31, 3, 10, -1.0, 6.0, rise=.9, mat='wood', tex='plank', role='wall', contour=True), R, piv))
    s.add(turned(ob.box(14, 30, 3.8, 9.2, 5.2, 5.7, mat='wood', tex='plank', role='misc'), R, piv))
    s.add(turned(ob.box(14.5, 22, 4.2, 8.8, 5.7, 6.2, mat='iron', tex='plain', role='misc'), R, piv))          # 갑판의 구멍
    # 드러난 늑골(왼쪽): 굽은 갈비 셋 + 용골
    for i, x in enumerate((3.5, 6.8, 10.1)):
        hh = 6.5 + i * .8
        for y, sg in ((3.4, 1), (9.6, -1)):
            s.add(M.obox((x, y + sg * .4, hh * .5), (1.2, 1.0, hh), M.rot_x(sg * .25), mat='wood', tex='plain', role='misc', contour=True))
    s.add(ob.box(2.5, 13.5, 5.8, 7.2, 0, 1.2, mat='wood', tex='plain', role='misc', contour=True))
    # 부러진 돛대 + 찢긴 돛 조각
    s.add(M.obox((23, 7, 11.5), (1.3, 1.3, 13), M.rot_y(-.32), mat='wood', tex='plain', role='misc', contour=True))
    s.add(M.obox((24.2, 5.8, 14.0), (5.5, .6, 4.0), M.rot_y(-.32), mat='sail', tex='ribs', role='misc', contour=True))
    s.add(M.obox((32, 3.5, .6), (4.5, 1.6, 1.0), M.rot_z(.5), mat='wood', tex='plank', role='misc', contour=True))
    return s


@fitk(0.93)
def ruin_city():
    """가라앉은 도시: 청록 물 위로 돔 지붕·박공 지붕·부러진 흰 기둥이 솟는다."""
    s = Scene()
    for (cx, cy, rx, ry) in ((32, 18, 31, 17), (10, 10, 11, 8), (54, 10, 11, 8)):
        water(s, cx, cy, rx, ry, z=0, rz=.8)
    # 큰 돔(가운데 뒤)
    s.add(M.Dome(30, 26, 0, 9, zmin=0.4, mat='cblue', role='roof', contour=True))
    s.add(ob.Cyl(30, 26, .6, 8.6, 12, mat='gold', tex='plain', role='roof'))
    # 지붕만 나온 집
    s.hip(5, 17, 18, 26, .4, .7, mat='redroof', contour=True, role='roof')
    s.add(E.gable_ew(44, 58, 18, 25, .4, .8, mat='redroof', tex='shingle', role='roof', contour=True))
    s.box(46, 50, 9, 13, 0, 5, mat='bone', tex='brick', role='wall', contour=True,
          decals=(('front', (47, 49, 1, 4, 'dark')),))
    s.hip(45.4, 50.6, 8.4, 13.6, 5, .9, mat='cblue', contour=True, role='roof')
    # 기둥 줄(높이 들쭉날쭉)
    for (x, y, h) in ((14, 6, 9), (19, 6, 6), (24, 6, 10), (36, 7, 4), (41, 7, 8)):
        s.cyl(x, y, 1.3, 0, h, mat='bone', tex='brick', role='misc', contour=True)
        s.cyl(x, y, 1.8, h - .8, h, mat='bone', tex='plain', role='misc', contour=True)
    s.box(12, 26, 4.8, 7.2, 10, 11.4, mat='bone', tex='plain', role='misc', contour=True) if False else None
    s.add(M.obox((22, 6, 10.5), (7, 2.4, 1.4), M.rot_y(.12), mat='bone', tex='plain', role='misc', contour=True))
    # 탑 꼭대기
    s.cyl(58, 5, 2.6, 0, 7, mat='bone', tex='brick', role='tower', contour=True,
          decals=(('side', (-90, .8, 3.5, 5.5, 'dark')),))
    s.add(ob.Cone(58, 5, 3.4, 7, 13, mat='cblue', tex='shingle', role='roof', contour=True))
    s.add(M.Dome(6, 4, 0, 3.2, zmin=.4, mat='cblue', role='roof', contour=True))
    return s


@fitk(0.96)
def shrine():
    """바다 신전: 계단 기단 위 흰 기둥 회랑 · 푸른 돔 · 박공의 금빛 조개 장식."""
    s = Scene()
    s.box(2, 46, 2, 20, 0, 2, mat='bone', tex='brick', role='wall', contour=True)
    s.box(4, 44, 4, 19, 2, 4, mat='bone', tex='brick', role='wall', contour=True)
    for i in range(3):
        s.box(18, 30, -2.6 + i * 2, 4 - i * .1, 0, .8 + i * 1.1, mat='bone', tex='plain', role='misc', contour=True)
    z = 4
    s.box(9, 39, 10, 17, z, z + 10, mat='bone', tex='plain', role='house', contour=True,
          decals=(('front', (21.5, 26.5, z, z + 6.5, 'arch')),))
    for x in np.linspace(8, 40, 8):
        s.cyl(x, 6.6, 1.1, z, z + 10, mat='bone', tex='brick', role='misc', contour=True)
    s.box(6, 42, 4.8, 18, z + 10, z + 12, mat='bone', tex='plain', role='misc', contour=True)
    s.add(E.gable_ew(6, 42, 4.8, 18, z + 12, .42, mat='bone', tex='plain', role='roof', contour=True))
    # 조개 장식(박공 앞)
    s.add(E.Ellip(24, 4.4, z + 14, 3.0, .6, 2.2, mat='gold', tex='plain', role='misc', contour=True))
    for a in (-50, -25, 0, 25, 50):
        th = math.radians(a)
        s.box(24 + 2.2 * math.sin(th) - .25, 24 + 2.2 * math.sin(th) + .25, 3.6, 3.9, z + 13, z + 13 + 2.4 * math.cos(th) + .6,
              mat='gold', tex='plain', role='misc')
    s.add(ob.Cyl(24, 13, 6.4, z + 14, z + 17, mat='bone', tex='plain', role='house', contour=True))
    s.add(M.Dome(24, 13, z + 17, 6.4, zmin=z + 17, mat='cblue', role='roof', contour=True))
    s.add(ob.Cyl(24, 13, .5, z + 23, z + 26, mat='gold', tex='plain', role='roof'))
    return s


@fitk(.94)
def landmark_nature():
    """고래 뼈 해변: 등뼈가 안쪽(y)으로 누운 고래 — 늑골이 정면에서 겹겹 아치로 보이고, 앞에 두개골."""
    s = Scene()
    island(s, 24, 14, 23, 14, 2.0)
    xc = 23
    for i, y in enumerate((8, 12.5, 17, 21.5, 26)):
        hw = 9.5 - abs(i - 1.2) * 1.3
        hh = 13 - abs(i - 1.2) * 1.6
        for side in (-1, 1):
            # 아래 기둥(바깥으로 벌어짐) + 위 굽은 조각(안으로 모임)
            s.add(M.obox((xc + side * hw * .92, y, hh * .32 + .6), (1.5, 1.5, hh * .62), M.rot_y(side * .18), mat='bone', tex='plain', role='misc', contour=True))
            s.add(M.obox((xc + side * hw * .62, y, hh * .8 + .6), (1.4, 1.5, hh * .42), M.rot_y(-side * .75), mat='bone', tex='plain', role='misc', contour=True))
    s.add(M.obox((xc, 17, 1.4), (2.4, 22, 2.0), mat='bone', tex='plain', role='misc', contour=True))            # 등뼈
    s.add(E.Ellip(xc, 2.5, 3.0, 6.0, 4.2, 3.4, mat='bone', tex='speck', role='misc', contour=True))   # 두개골
    s.add(M.obox((xc - 5.5, -1.5, 1.2), (5, 2.2, 1.8), M.rot_z(.45), mat='bone', tex='plain', role='misc', contour=True))  # 턱뼈
    s.add(M.obox((xc + 5.5, -1.5, 1.2), (5, 2.2, 1.8), M.rot_z(-.45), mat='bone', tex='plain', role='misc', contour=True))
    palm(s, 40, 20, 10, 1.6, 3.8, seed=3)
    palm(s, 5, 22, 8, -1.2, 3.2, seed=6)
    return s


def landmark_coral():
    """거대 산호초: 얕은 청록 물 위로 솟은 붉은 가지 산호와 둥근 뇌산호."""
    s = Scene()
    water(s, 24, 12, 23, 12, z=0, rz=.9)
    for (x, y, h, n) in ((14, 13, 14, 5), (30, 15, 17, 6), (38, 8, 10, 4), (8, 6, 8, 3)):
        s.add(M.Frustum(x, y, 1.6, 1.0, 0, h * .5, mat='coral', role='misc', contour=True))
        for k in range(n):
            a = math.radians(-70 + 140 * k / max(n - 1, 1))
            R = M.rot_y(a * .7)
            c = np.array([x + math.sin(a) * h * .22, y, h * .5 + math.cos(a) * h * .22])
            s.add(M.obox(c, (1.4, 1.4, h * .5), R, mat='coral', tex='speck', role='misc', contour=True))
            tip = c + R @ np.array([0, 0, h * .25])
            s.add(E.Ellip(tip[0], tip[1], tip[2], 1.1, 1.1, 1.1, mat='coral', tex='plain', role='misc'))
    for (x, y, r) in ((22, 5, 3.6), (44, 14, 3.0), (4, 15, 2.6)):
        s.add(M.Dome(x, y, 0, r, zmin=.3, mat='gold', role='misc', contour=True))
    s.add(E.Ellip(24, 21, 1, 4, 2, 3, mat='leaf2', tex='speck', role='misc', contour=True))
    return s


@fitk(0.93)
def circle():
    """석상 원: 낮은 돌 단 위 모아이풍 석상 셋(긴 얼굴·무거운 눈썹·붉은 모자)."""
    s = Scene()
    s.box(2, 30, 6, 13, 0, 1.6, mat='stone', tex='brick', role='wall', contour=True)
    for (x, y, h, hat) in ((4, 8, 15, 0), (12.5, 9, 18, 1), (21.5, 8, 15, 0)):
        w = 6
        s.box(x, x + w, y - .5, y + 3.5, 1.6, 1.6 + h * .4, mat='basalt', tex='speck', role='misc', contour=True)
        hz = 1.6 + h * .4
        s.box(x + .4, x + w - .4, y, y + 3.5, hz, 1.6 + h, mat='basalt', tex='speck', role='misc', contour=True,
              decals=(('front', (x + 1.1, x + 2.5, hz + h * .32, hz + h * .4, 'dark')), ('front', (x + w - 2.5, x + w - 1.1, hz + h * .32, hz + h * .4, 'dark'))))
        s.box(x + .1, x + w - .1, y - .9, y + .5, hz + h * .42, hz + h * .5, mat='basalt', tex='plain', role='misc', contour=True)   # 눈썹
        s.box(x + 2.2, x + w - 2.2, y - 1.2, y, hz + h * .14, hz + h * .36, mat='basalt', tex='plain', role='misc', contour=True)  # 코
        if hat:
            s.add(ob.Cyl(x + w / 2, y + 1.7, 2.3, 1.6 + h, 1.6 + h + 2.2, mat='rock', tex='speck', role='misc', contour=True))
    return s


@fitk(0.8)
def volcano():
    """화산섬: 모래 해변 위 검은 화산 · 붉은 화구 · 회색 연기 · 야자."""
    s = Scene()
    island(s, 15, 8, 15, 8, 2.0)
    s.add(E.oct_pyr(15, 10, 11, 0, 19, ztrunc=13.5, mat='basalt', tex='speck', role='wall', contour=True))
    s.add(E.Ellip(15, 9.5, 13.6, 4.0, 3.0, .9, mat='ember', tex='speck', role='misc'))
    s.add(E.Ellip(16.5, 4.6, 7.5, 1.1, .8, 4.6, mat='ember', tex='speck', role='misc'))
    for i, (dx, dz, r) in enumerate(((0, 18, 2.4), (1.6, 21.2, 2.8), (3.6, 24.2, 3.0))):
        s.add(M.Dome(15 + dx, 11, dz, r, zmin=-99, mat='smoke', role='steam', contour=True))
    palm(s, 3, 3, 7, -1.2, 3.0, seed=4)
    palm(s, 27, 3, 6, 1.0, 2.8, seed=7)
    return s


def floating():
    """하늘섬: 거꾸로 선 바위 밑 위 풀밭 · 초가와 야자 · 앞 가장자리 호수에서 떨어지는 폭포 · 아래 물보라 구름."""
    s = Scene()
    xc, yc = 40, 18
    for (dx, r, zb_) in ((-15, 15, 6), (0, 15.5, 0), (15, 15, 5), (-24, 8, 10), (24, 8, 9)):
        s.add(E.InvCone(xc + dx, yc, r, zb_, 20, mat='rock', tex='speck', role='wall', contour=True))
    s.add(E.Ellip(xc, yc, 20.2, 31, 15, 2.0, mat='leaf2', tex='speck', role='ground', contour=True))
    s.patch(xc - 27, xc + 27, yc - 12, yc + 12, lambda x, y: np.array(ob.MAT['grass'], np.uint8)[np.clip((ob.hsh(x, y, 5) * 4.2).astype(int), 0, 4)],
            z=20, h=1.0, mat='grass')
    zb = 21
    # 호수 + 폭포(앞 가장자리에서 아래로)
    s.add(E.Ellip(xc + 8, yc - 6, 20.9, 7, 4.2, .3, mat='sea', tex='speck', role='ground'))
    s.box(xc + 6, xc + 10.5, yc - 15.6, yc - 15.0, -4, 21.0, mat='sea', tex='plank', role='nocast', contour=False)
    s.box(xc + 7, xc + 9.5, yc - 15.9, yc - 15.6, -4, 21.0, mat='cloud', tex='plank', role='nocast', contour=False)
    for (cx, cy, cz, rx, ry, rz) in ((xc + 8, yc - 17, -3, 8, 4, 3.2), (xc - 20, yc - 8, 4, 10, 5, 3), (xc + 26, yc - 6, 5, 9, 5, 3)):
        s.add(E.Ellip(cx, cy, cz, rx, ry, rz, mat='cloud', tex='speck', role='steam', contour=False))
    hut(s, xc - 18, yc - 2, 9, 6, wh=4, rise=5, z=zb)
    hut(s, xc - 4, yc + 5, 9, 5, wh=3.8, rise=4.8, z=zb)
    hut(s, xc + 17, yc + 3, 8, 5, wh=3.6, rise=4.6, z=zb)
    palm(s, xc + 23, yc - 4, 10, 1.4, 3.8, z=zb, seed=1)
    palm(s, xc - 25, yc + 4, 10, -1.2, 3.6, z=zb, seed=5)
    palm(s, xc - 2, yc - 7, 8, 1.0, 3.2, z=zb, seed=8)
    palm(s, xc + 8, yc + 9, 9, -1.0, 3.4, z=zb, seed=3)
    return s


ORDER = [
    ('capital', '해상 왕국 수도', 'capital', (6, 6), '모래섬 위 흰 성벽·푸른 돔 궁·운하와 다리·앞 부두의 범선 둘'),
    ('fort_city', '해안 요새 도시', 'fort_city', (4, 4), '네 귀 다이아몬드 포대와 대포·돌 성벽·흰 집과 야자'),
    ('harbor_city', '해적 항구', 'harbor_city', (5, 4), '판자 술집과 집·나무 부두·검은 돛 해적선'),
    ('castle', '해적 요새', 'castle', (3, 3), '바위 언덕 위 통나무 요새·망루·해골 깃발'),
    ('castle', '해안 포대', 'castle_b', (3, 3), '돌 흉벽에 대포 다섯 문·화약 창고·원형 망루'),
    ('large_town', '섬 마을', 'large_town', (3, 3), '모래섬 위 초가 다섯 채·야자·카누'),
    ('village', '수상 가옥 마을', 'village', (2, 2), '얕은 물 위 말뚝 초가 셋과 판자 다리'),
    ('village', '어촌', 'village_b', (2, 2), '초가 둘·그물 말리는 장대·끌어올린 작은 배'),
    ('camp', '난파 생존자 야영', 'camp', (2, 2), '돛천 천막·모닥불·부서진 배 조각'),
    ('tower_small', '등대', 'tower_small', (1, 2), '바위 위 흰·빨강 띠 등대'),
    ('tower_great', '큰 등대', 'tower_great', (2, 4), '돌 기단·흰 벽돌 탑·회랑·불 켜진 등실'),
    ('cave', '해적 보물 동굴', 'cave', (2, 2), '해식 동굴 입구와 보물 상자·금화'),
    ('ruin', '난파선', 'ruin', (2, 2), '모래에 기운 채 박힌 배 몸통과 부러진 돛대'),
    ('ruin_city', '가라앉은 도시', 'ruin_city', (4, 3), '물 위로 나온 돔·지붕·부러진 기둥'),
    ('shrine', '바다 신전', 'shrine', (3, 3), '흰 기둥 회랑·푸른 돔·금빛 조개 장식'),
    ('landmark_nature', '고래 뼈 해변', 'landmark_nature', (3, 3), '모래톱 위 늑골 아치와 두개골'),
    ('landmark_nature', '거대 산호초', 'landmark_coral', (3, 3), '얕은 물 위 가지 산호와 뇌산호'),
    ('circle', '석상 원', 'circle', (2, 2), '돌 단 위 모아이풍 석상 셋'),
    ('volcano', '화산섬', 'volcano', (2, 2), '모래 해변·검은 화산·붉은 화구·연기·야자'),
    ('floating', '하늘섬', 'floating', (5, 4), '떠 있는 바위섬·초가와 야자·떨어지는 폭포·구름'),
]
