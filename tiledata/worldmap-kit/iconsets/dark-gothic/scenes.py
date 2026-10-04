"""다크 판타지·고딕 월드맵 아이콘 — 정면 카메라용 장면.
검은 슬레이트 지붕·이끼 낀 보라회색 돌·썩은 나무·핏빛 깃발·붉은 창. 채도는 낮게, 윤곽은 또렷하게.
"""
import math
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / '_scene3d'))
import numpy as np  # noqa: E402
import oblique as ob  # noqa: E402
import east as E  # noqa: E402
import modsf_kit as M  # noqa: E402
import icons_v9_lib as L  # noqa: E402
from icons_v9_lib import hx, STONE, RED, LAVA, GOLD, WOOD  # noqa: E402
from oblique import Scene, Poly, box  # noqa: E402

SET = dict(id='dark-gothic', name='다크 판타지·고딕')

# ── 재질 ── (violet 만 새 색, 나머지는 World.png 색)
VIOLET = [hx(c) for c in ('2a1840', '4a2a70', '7040a8', 'a070e0')]
_H = lambda *cs: [hx(c) for c in cs]  # noqa: E731
ob.MAT.update({
    'slate': _H('111618', '1d2c33', '2c3738', '363540', '445353', '515567'),       # 검은 슬레이트
    'gstone': _H('363540', '493f59', '515567', '66648b', '78739c', '8f8cb5'),      # 보라회색 돌
    'moss': _H('363540', '464f49', '575e58', '616a62', '758276', '849c97'),        # 이끼 낀 돌
    'daub': _H('363540', '564a3e', '766e60', 'b9ab9d'),                            # 더러운 회벽
    'rot': _H('411e05', '5f4324', '75472d', '8b7465', '9a8b60'),                   # 썩은 나무
    'blood': _H('351803', '690907', '931d10', 'c21919'),                           # 핏빛 천
    'bone': _H('766e60', 'b9ab9d', 'd8cbac', 'e1d7c1'),
    'marble': _H('78739c', '8f8cb5', 'aac3b5', 'cfecec', 'dcf7f9'),                # 흰 엘프 돌
    'ivy': _H('1d2c33', '13522e', '218238', '3d882b'),
    'reed': _H('411e05', '65442a', '77693c', '9d8e5c'),
    'hide': _H('4f2e21', '65442a', '8c5a21', 'a77b4b', 'b99664'),
    'fog': _H('66648b', '78739c', '8f8cb5', 'aac3b5'),
    'smoke': _H('363540', '564a3e', '766e60', 'b9ab9d'),        # 따뜻한 잿빛 연기
    'blackrock': _H('111618', '2c3738', '363540', '464f49', '575e58'),
    'violet': VIOLET,
    'fire': [LAVA[2], LAVA[3], LAVA[4], LAVA[5]],
})
L._reg(VIOLET, hx('111618'))

# ── 데칼: 뾰족 아치 창(어둠·붉은 불빛·보라)·등불 ──
_prev_decal = ob._apply_decal


def _gdecal(p, dc, tag, P_, col):
    spec = dc[1]
    mode = spec[4] if len(spec) > 4 else 'dark'
    if dc[0] in ('front', 'back') and mode in ('garch', 'gred', 'gviolet', 'lamp'):
        t = np.asarray(tag, dtype=object)
        a0, a1, z0, z1 = spec[:4]
        a, z = P_[:, 0], P_[:, 2]
        m = (t == dc[0]) & (a >= a0) & (a <= a1) & (z >= z0) & (z <= z1)
        cx, half = (a0 + a1) / 2, (a1 - a0) / 2
        zs = z1 - max(half * 1.5, .8)
        inside = m & ((z <= zs) | (np.abs(a - cx) <= half * (z1 - z) / max(z1 - zs, .01) + .2))
        if mode == 'garch':
            col[inside] = STONE[0]
            col[inside & (z < z0 + (z1 - z0) * .5)] = L.OUT
        elif mode == 'gred':
            col[inside] = RED[1]
            col[inside & (np.abs(a - cx) < half - .3) & (z < zs + .6)] = RED[3]
        elif mode == 'gviolet':
            col[inside] = VIOLET[1]
            col[inside & (np.abs(a - cx) < half - .3) & (z < zs + .6)] = VIOLET[3]
        elif mode == 'lamp':
            col[inside] = GOLD[3]
            col[inside & (z < zs)] = LAVA[5]
        return col
    return _prev_decal(p, dc, tag, P_, col)


ob._apply_decal = _gdecal


# ── 입체 부품 ──
def sbox(x0, x1, y0, y1, z0, z1, k=0.0, zb=0.0, **kw):
    """x 방향으로 기운(전단) 상자. k = 높이 1 당 오른쪽으로 밀리는 양."""
    return Poly([((1, 0, -k), x1 - k * zb, 'right'), ((-1, 0, k), -x0 + k * zb, 'left'), ((0, 1, 0), y1, 'back'),
                 ((0, -1, 0), -y0, 'front'), ((0, 0, 1), z1, 'top'), ((0, 0, -1), -z0, 'bottom')], **kw)


def sgable(x0, x1, y0, y1, z0, s, k=0.0, zb=0.0, **kw):
    kw.setdefault('tex', 'shingle')
    return Poly([((0, -s, 1), z0 - s * y0, 'slope'), ((0, s, 1), z0 + s * y1, 'slope'),
                 ((-1, 0, k), -x0 + k * zb, 'left'), ((1, 0, -k), x1 - k * zb, 'right'), ((0, 0, -1), -z0, 'bottom')], **kw)


def gwin(x, z0, z1, w=1.8, mode='gred'):
    return ('front', (x - w / 2, x + w / 2, z0, z1, mode))


def sgable_ns(x0, x1, y0, y1, z0, s, k=0.0, zb=0.0, **kw):
    """마루가 앞뒤(y)로 달린 박공(정면에 삼각 박공벽) — x 로 기울일 수 있다."""
    kw.setdefault('tex', 'shingle')
    return Poly([((-s, 0, 1 + s * k), z0 - s * x0 + s * k * zb, 'slope'), ((s, 0, 1 - s * k), z0 + s * x1 - s * k * zb, 'slope'),
                 ((0, -1, 0), -y0, 'front'), ((0, 1, 0), y1, 'back'), ((0, 0, -1), -z0, 'bottom')], **kw)


def ghouse(s, x, y, w, d, wh=5.0, rise=6.0, k=0.0, wall='daub', roof='slate', win='gred', door=True, chim=False, ridge='y'):
    """좁고 높은 고딕 집. ridge='y' 면 정면이 뾰족한 박공벽(삼각), 'x' 면 앞 경사 지붕이 보인다."""
    dec = []
    cx = x + w / 2
    if door:
        dec.append(('front', (cx - 1.1 + k * 1.6, cx + 1.1 + k * 1.6, 0, 3.2, 'door')))
    if win and w >= 7:
        for fx in (.2, .8):
            wx = x + w * fx + k * (wh - 1.6)
            dec.append(gwin(wx, wh - 3.0, wh - .8, 1.5, win))
    elif win and not door:
        dec.append(gwin(cx + k * (wh - 1.6), wh - 3.0, wh - .8, 1.5, win))
    s.add(sbox(x, x + w, y, y + d, 0, wh, k, mat=wall, tex='plain', role='house', contour=True, decals=tuple(dec)))
    if ridge == 'y':
        o = .8
        sl = rise / (w / 2 + o)
        s.add(sgable_ns(x - o, x + w + o, y - .3, y + d + .6, wh, sl, k, mat=roof, role='roof', contour=True))
        gdec = (gwin(cx + k * (wh + rise * .3), wh + .6, wh + min(rise * .5, 3.4), 1.4, win),) if win else ()
        s.add(sgable_ns(x, x + w, y, y + .5, wh, sl, k, mat=wall, tex='plain', role='house', contour=True, decals=gdec))
        s.box(x - .2 + k * wh, x + w + .2 + k * wh, y - .45, y + .4, wh - .5, wh, mat='rot', tex='plain', role='misc')
    else:
        s.add(sgable(x - .7, x + w + .7, y - .9, y + d + .9, wh, rise / (d / 2 + .9), k, mat=roof, role='roof', contour=True))
    if chim:
        ccx = x + w * .78 + k * (wh + rise * .6)
        s.box(ccx - .7, ccx + .7, y + d * .6, y + d * .6 + 1.4, wh, wh + rise + .6, mat='gstone', tex='brick', role='misc', contour=True)


def spire_tower(s, xc, yc, w, h, sp, mat='gstone', roof='slate', win='gred', nwin=1, finial=True, cornice=True):
    """네모 탑 + 가파른 사각뿔 첨탑."""
    hw = w / 2
    dec = []
    if win:
        for i in range(nwin):
            zz = h - 3.6 - i * 5
            if zz > 2:
                dec.append(gwin(xc, zz, zz + 3.0, 1.8 if w > 5 else 1.4, win))
    s.box(xc - hw, xc + hw, yc - hw, yc + hw, 0, h, mat=mat, tex='brick', role='tower', contour=True, decals=tuple(dec))
    o = .8
    if cornice:
        s.box(xc - hw - .5, xc + hw + .5, yc - hw - .5, yc + hw + .5, h, h + .8, mat=mat, tex='plain', role='misc', contour=True)
        o = 1.0
    s.hip(xc - hw - o + .3, xc + hw + o - .3, yc - hw - o + .3, yc + hw + o - .3, h + (.8 if cornice else 0), sp / (hw + o), mat=roof, tex='shingle', role='roof', contour=True)
    if finial:
        top = h + (.8 if cornice else 0) + sp
        s.box(xc - .4, xc + .4, yc - .4, yc + .4, top - 1, top + 2.2, mat='slate', tex='plain', role='misc')


def round_spire(s, xc, yc, r, h, sp, mat='gstone', roof='slate', win='gred', wz=None):
    s.add(ob.Cyl(xc, yc, r, 0, h, mat=mat, tex='brick', role='tower', contour=True))
    if win:
        zz = wz if wz is not None else h - 4
        s.add(box(xc - .8, xc + .8, yc - r - .25, yc - r + .6, zz, zz + 2.4, mat='slate', tex='plain', role='misc',
                  decals=(gwin(xc, zz, zz + 2.4, 1.6, win),)))
    s.add(ob.Cone(xc, yc, r + 1.1, h, h + sp, mat=roof, tex='shingle', role='roof', contour=True))


def crenel_wall(s, x0, x1, y0, y1, h, mat='gstone', edges=('front',), step=2.0, decals=()):
    s.box(x0, x1, y0, y1, 0, h, mat=mat, tex='brick', role='wall', contour=True, decals=decals)
    s.crenels(x0, x1, y0, y1, h, mat=mat, step=step, h=1.6, edges=edges, depth=1.2)


def banner(s, x, y, z, h=5.0, w=2.2, pole=3.0):
    s.box(x - .35, x + .35, y - .35, y + .35, z, z + h + pole, mat='slate', tex='plain', role='misc')
    s.box(x + .35, x + .35 + w, y - .3, y + .3, z + h + pole - h * .55 - .2, z + h + pole - .2, mat='blood', tex='plain', role='misc', contour=True)


def hang_banner(s, x, y, z, w=2.0, h=4.0):
    """벽 앞에 늘어뜨린 핏빛 휘장."""
    s.box(x - w / 2, x + w / 2, y - .5, y, z - h, z, mat='blood', tex='plain', role='misc', contour=True)


def crow(s, x, y, z):
    s.box(x - .9, x + .9, y - .3, y + .3, z, z + .7, mat='slate', tex='plain', role='nocast')
    s.box(x - .3, x + .3, y - .3, y + .3, z + .7, z + 1.3, mat='slate', tex='plain', role='nocast')


def dead_tree(s, x, y, h=9, r=.9, seed=0):
    s.add(M.Frustum(x, y, r, r * .45, 0, h, mat='rot', role='misc', contour=True))
    for i, (ang, zz, ln) in enumerate(((-.7, h * .55, h * .45), (.8, h * .7, h * .4), (-.2, h * .9, h * .3))):
        R = M.rot_y(ang)
        c = np.array([x, y, zz]) + R @ np.array([0, 0, ln / 2])
        s.add(M.obox(c, (.8, .8, ln), R, mat='rot', tex='plain', role='misc', contour=True))


def smoke(s, x, y, z, n=3, r0=1.8, rise=2.6, drift=1.4, mat='smoke', seed=1):
    M.steam(s, x, y, z, np.random.RandomState(seed), n=n, r0=r0, rise=rise, drift=drift, mat=mat)


def gallows(s, x, y, h=7.0, w=5.0):
    s.box(x, x + .9, y, y + .9, 0, h, mat='rot', tex='plain', role='misc', contour=True)
    s.box(x, x + w, y, y + .9, h - .9, h, mat='rot', tex='plain', role='misc', contour=True)
    s.box(x + w - .7, x + w - .3, y + .25, y + .65, h - 3.2, h - .9, mat='reed', tex='plain', role='misc')
    s.box(x + w - 1.1, x + w + .1, y + .1, y + .8, h - 4.0, h - 3.2, mat='reed', tex='plain', role='misc')
    s.box(x - 1.2, x + w + 1.2, y - 1.5, y + 2.5, 0, 1.0, mat='rot', tex='plank', role='misc', contour=True)


def court(lo=1, hi=3, mat='gstone', seed=21, road=None):
    ramp = np.array(ob.MAT[mat], np.uint8)
    dk = np.array(ob.MAT['moss'], np.uint8)

    def fn(x, y):
        h = ob.hsh(x, y, seed)
        col = ramp[np.clip((lo + h * (hi - lo + .99)).astype(int), 0, len(ramp) - 1)]
        joint = (np.mod(np.floor(x), 3) == 0) | (np.mod(np.floor(y), 2) == 0)
        col = np.where(joint[:, None], ramp[max(lo - 1, 0)], col)
        mossy = ob.hsh(np.floor(x / 2), np.floor(y / 2), seed + 1) < .18
        col = np.where(mossy[:, None], dk[np.clip((1 + h * 2).astype(int), 0, 5)], col)
        return col
    return fn


def stilt_hut(s, x, y, w, d, post_h=3.0, wh=3.6, rise=4.0, roof='reed', wall='rot', win='lamp'):
    for px in (x + .3, x + w - 1.1):
        for py in (y + .3, y + d - 1.1):
            s.box(px, px + .8, py, py + .8, 0, post_h, mat='rot', tex='plain', role='misc', contour=True)
    s.box(x - .8, x + w + .8, y - 1.2, y + d + .6, post_h, post_h + .8, mat='rot', tex='plank', role='misc', contour=True)
    dec = (('front', (x + w * .3 - .9, x + w * .3 + .9, post_h + .8, post_h + 3.4, 'door')),
           gwin(x + w * .72, post_h + 1.6, post_h + 3.2, 1.4, win))
    s.box(x, x + w, y, y + d, post_h + .8, post_h + .8 + wh, mat=wall, tex='plank', role='house', contour=True, decals=dec)
    z = post_h + .8 + wh
    s.add(E.hip_t(x - 1.2, x + w + 1.2, y - 1.2, y + d + 1.2, z, rise / (min(w, d) / 2 + 1.2), mat=roof, tex='speck', role='roof', contour=True))


def reeds(s, x, y, n=4, h=5, seed=3):
    rng = np.random.RandomState(seed)
    for i in range(n):
        xx = x + i * 1.3 + rng.uniform(-.3, .3)
        hh = h * rng.uniform(.6, 1.0)
        s.box(xx, xx + .5, y + rng.uniform(-.5, .5), y + .5, 0, hh, mat='reed', tex='plain', role='misc')
        s.box(xx - .1, xx + .6, y - .1, y + .6, hh - 1.4, hh, mat='hide', tex='plain', role='misc')


# ═════════════════════════════════════════════════════════ 도시
def capital():
    """왕도: 이중 첨탑 대성당 + 높은 성벽·원탑 + 빽빽한 검은 지붕 집 + 교수대 광장."""
    s = Scene()
    X0, X1, D = 4, 86, 78
    s.patch(X0 + 4, X1 - 4, 5, D - 3, court(1, 3), mat='gstone')
    # 뒤 성벽
    crenel_wall(s, X0, X1, D - 4, D, 7, edges=('front',))
    # 옆 성벽
    crenel_wall(s, X0, X0 + 4, 0, D, 7, edges=('front',))
    crenel_wall(s, X1 - 4, X1, 0, D, 7, edges=('front',))
    # 대성당(정면이 앞을 본다): 신랑 + 정면 박공 + 쌍탑 + 교차부 첨탑
    cx = 45
    s.box(cx - 9, cx + 9, 46, 68, 0, 15, mat='gstone', tex='brick', role='keep', contour=True,
          decals=(('front', (cx - 2.4, cx + 2.4, 0, 7.5, 'garch')), gwin(cx - 5, 5, 11, 1.8, 'gred'), gwin(cx + 5, 5, 11, 1.8, 'gred')))
    s.add(E.gable_ns(cx - 10, cx + 10, 45, 69, 15, 1.25, mat='slate', tex='shingle', role='roof', contour=True))
    s.add(E.gable_ns(cx - 9, cx + 9, 45.2, 46.2, 15, 1.25, mat='gstone', tex='brick', role='keep', contour=True,
                     decals=(gwin(cx, 15.5, 22, 3.6, 'gred'),)))
    for tx in (cx - 12.5, cx + 12.5):
        spire_tower(s, tx, 46, 7, 27, 17, nwin=3)
    spire_tower(s, cx, 64, 6, 30, 16, win=None)
    # 집들(좌우 블록, 엇갈림)
    rows = [(9, 52, 7, 5, 6.5, 6.5, .0), (18, 58, 6, 5, 5.5, 6, .1), (66, 52, 7, 5, 6.5, 6.5, -.08), (75, 58, 6, 5, 6, 6, 0),
            (9, 34, 6, 5, 5.5, 6, .08), (17, 38, 7, 5, 6.5, 7, 0), (67, 34, 7, 5, 6, 6.5, 0), (76, 38, 6, 5, 5.5, 6, -.1),
            (9, 18, 7, 5, 5, 6, 0), (18, 22, 6, 5, 6, 6.5, -.06), (66, 18, 6, 5, 6, 6, .06), (74, 22, 7, 5, 5, 6, 0),
            (27, 30, 6, 5, 5, 5.5, 0), (58, 30, 6, 5, 5, 5.5, 0)]
    for (x, y, w, d, wh, rise, k) in rows:
        ghouse(s, x, y, w, d, wh, rise, k=k, chim=(x % 2 == 1), win='gred' if (x + y) % 3 else 'garch',
               ridge='x' if (x * 7 + y) % 3 == 0 else 'y')
    # 교수대 광장
    gallows(s, cx - 3, 16, h=7.5, w=5)
    crow(s, cx + 1.5, 16.4, 8.4)
    # 앞 성벽 + 성문
    crenel_wall(s, X0, cx - 8, 0, 5, 8, edges=('front',))
    crenel_wall(s, cx + 8, X1, 0, 5, 8, edges=('front',))
    s.box(cx - 8, cx + 8, -1, 5, 0, 10.5, mat='gstone', tex='brick', role='gate', contour=True,
          decals=(('front', (cx - 3, cx + 3, 0, 8.5, 'garch')),))
    s.crenels(cx - 8, cx + 8, -1, 5, 10.5, mat='gstone', step=2, h=1.6, edges=('front',), depth=1.2)
    hang_banner(s, cx - 5.5, -1, 10, 2, 5)
    hang_banner(s, cx + 5.5, -1, 10, 2, 5)
    for (tx, ty) in ((X0 + 2, 2), (X1 - 2, 2), (X0 + 2, D - 2), (X1 - 2, D - 2)):
        round_spire(s, tx, ty, 4.2, 13, 9)
    banner(s, cx, 2, 12.1, 4, 3, 2)
    return s


def fort_city():
    """성채 도시: 높은 돌성벽 + 네모 망루 넷 + 성문 위 핏빛 깃발 + 안쪽 아성."""
    s = Scene()
    X0, X1, D = 4, 52, 46
    s.patch(X0 + 3, X1 - 3, 4, D - 3, court(1, 3), mat='gstone')
    crenel_wall(s, X0, X1, D - 4, D, 11, edges=('front',))
    crenel_wall(s, X0, X0 + 3.5, 0, D, 11, edges=('front',))
    crenel_wall(s, X1 - 3.5, X1, 0, D, 11, edges=('front',))
    # 아성(뒤 가운데)
    cx = 28
    s.box(cx - 7, cx + 7, 28, 38, 0, 20, mat='gstone', tex='brick', role='keep', contour=True,
          decals=(gwin(cx - 3, 13, 17, 1.8), gwin(cx + 3, 13, 17, 1.8), gwin(cx, 6, 10, 1.8, 'garch')))
    s.crenels(cx - 7, cx + 7, 28, 38, 20, mat='gstone', step=2, h=1.6, edges=('front',), depth=1.2)
    spire_tower(s, cx + 4, 34, 5, 25, 10, win=None)
    ghouse(s, 9, 26, 7, 5, 6, 6.5, chim=True)
    ghouse(s, 39, 24, 7, 5, 6, 6.5, k=.06)
    ghouse(s, 11, 13, 6, 5, 5, 6, k=-.06)
    ghouse(s, 38, 12, 6, 5, 5, 6)
    # 앞 성벽 + 성문
    crenel_wall(s, X0, cx - 6, 0, 4, 12, edges=('front',))
    crenel_wall(s, cx + 6, X1, 0, 4, 12, edges=('front',))
    s.box(cx - 6, cx + 6, -1.5, 4, 0, 15, mat='gstone', tex='brick', role='gate', contour=True,
          decals=(('front', (cx - 2.6, cx + 2.6, 0, 8, 'garch')), gwin(cx, 10.5, 13.5, 1.6)))
    s.crenels(cx - 6, cx + 6, -1.5, 4, 15, mat='gstone', step=2, h=1.6, edges=('front',), depth=1.2)
    banner(s, cx, 1, 16.6, 5, 3.4, 3)
    for (tx, ty) in ((X0 + 2, 2), (X1 - 2, 2), (X0 + 2, D - 2), (X1 - 2, D - 2)):
        spire_tower(s, tx, ty, 6.4, 16 if ty < 10 else 14, 7, win='gred', finial=False)
    return s


def harbor_city():
    """늪 항구: 뒤에 검은 지붕 창고·집, 앞에 나무 말뚝 부두와 검은 범선, 등불."""
    s = Scene()
    # 뒤 마을
    ghouse(s, 6, 34, 12, 6, 6, 6.5, wall='rot', win='lamp', chim=True, ridge='x')
    ghouse(s, 22, 38, 7, 5, 7, 7, k=.08)
    ghouse(s, 33, 34, 13, 6, 6.5, 6.5, wall='rot', win='lamp', ridge='x')
    ghouse(s, 50, 37, 7, 5, 6.5, 7, k=-.06, chim=True)
    spire_tower(s, 64, 40, 6, 20, 10, win='lamp', nwin=2)
    ghouse(s, 56, 26, 8, 5, 5, 5.5)
    ghouse(s, 13, 24, 7, 5, 5, 6, k=.05)
    # 부두(말뚝 + 널판)
    s.box(3, 70, 14, 20, 1.2, 2.2, mat='rot', tex='plank', role='misc', contour=True)
    s.box(40, 46, -4, 14, 1.2, 2.2, mat='rot', tex='plank', role='misc', contour=True)
    s.box(58, 64, -2, 14, 1.2, 2.2, mat='rot', tex='plank', role='misc', contour=True)
    for x in range(4, 70, 6):
        s.box(x, x + .9, 13.4, 14.3, 0, 3.0, mat='rot', tex='plain', role='misc', contour=True)
    for (x0, y0, y1) in ((40, -4, 14), (58, -2, 14)):
        for y in np.arange(y0, y1, 4.5):
            for x in (x0, x0 + 5.1):
                s.box(x, x + .9, y - .6, y + .3, 0, 3.0, mat='rot', tex='plain', role='misc', contour=True)
    # 등불 기둥
    for (lx, ly) in ((47, -3.5), (65, -1.5), (20, 14)):
        s.box(lx - .3, lx + .3, ly - .3, ly + .3, 2.2, 7.5, mat='slate', tex='plain', role='misc')
        s.box(lx - .9, lx + .9, ly - .9, ly + .3, 7.5, 9.3, mat='slate', tex='plain', role='misc', contour=True,
              decals=(('front', (lx - .6, lx + .6, 7.7, 9.1, 'lamp')),))
    # 검은 범선(왼쪽 앞)
    s.add(E.hull(4, 34, -3, 5, 0, 4.2, rise=.9, mat='slate', tex='plank', role='misc', contour=True))
    s.box(5, 12, -2, 4, 4.2, 7.2, mat='rot', tex='plank', role='misc', contour=True, decals=(gwin(8.5, 5, 6.8, 1.2, 'lamp'),))
    for (mx, mh, sw) in ((13, 22, 4.2), (25, 18, 3.6)):
        s.box(mx - .5, mx + .5, .5, 1.5, 4.2, 4.2 + mh, mat='rot', tex='plain', role='misc')
        for (z0, z1, ww) in ((8, 4.2 + mh * .55, sw), (4.2 + mh * .6, 4.2 + mh - 1.5, sw * .75)):
            s.box(mx - ww - .4, mx + ww + .4, -.2, .4, z1 - .5, z1, mat='rot', tex='plain', role='misc')
            s.box(mx - ww, mx + ww, 0, .5, z0, z1 - .5, mat='daub', tex='ribs', role='misc', contour=True)
    s.box(13.4, 14.6, .5, 1.5, 26.2, 28, mat='blood', tex='plain', role='misc')
    s.box(14.6, 17.4, .6, 1.4, 26.6, 28, mat='blood', tex='plain', role='misc')
    return s


# ═════════════════════════════════════════════════════════ 성
def castle():
    """흡혈귀 성: 높은 아성 위 뾰족탑 셋, 붉은 창, 앞 성벽."""
    s = Scene()
    cx = 22
    s.box(cx - 9, cx + 9, 14, 24, 0, 14, mat='gstone', tex='brick', role='keep', contour=True,
          decals=(gwin(cx - 4.5, 8, 12, 1.8), gwin(cx + 4.5, 8, 12, 1.8), gwin(cx, 7.5, 12.5, 2.6)))
    s.add(E.gable_ns(cx - 9.6, cx + 9.6, 13.5, 24.5, 14, .9, mat='slate', tex='shingle', role='roof', contour=True))
    spire_tower(s, cx, 20, 6, 23, 10, nwin=2)
    round_spire(s, cx - 12.5, 12, 4, 17, 10, wz=12)
    round_spire(s, cx + 12.5, 12, 4, 17, 10, wz=12)
    crenel_wall(s, cx - 13, cx + 13, 2, 6, 8, edges=('front',), decals=(('front', (cx - 2.2, cx + 2.2, 0, 6.2, 'garch')),))
    hang_banner(s, cx - 5, 2, 7.6, 1.8, 4)
    hang_banner(s, cx + 5, 2, 7.6, 1.8, 4)
    crow(s, cx + 8, 18, 27)
    return s


def castle_b():
    """마녀 사냥꾼 요새: 각진 망루(흉벽) 셋, 나무 덧성, 깃발."""
    s = Scene()
    cx = 22
    s.box(cx - 8, cx + 8, 14, 24, 0, 12, mat='moss', tex='brick', role='keep', contour=True,
          decals=(gwin(cx - 3.5, 8, 11, 1.4, 'garch'), gwin(cx + 3.5, 8, 11, 1.4, 'garch')))
    s.crenels(cx - 8, cx + 8, 14, 24, 12, mat='moss', step=2, h=1.8, edges=('front', 'back'), depth=1.3)
    # 큰 사각 망루(가운데 뒤)
    s.box(cx - 4, cx + 4, 18, 26, 0, 19, mat='moss', tex='brick', role='tower', contour=True,
          decals=(gwin(cx, 15, 18, 1.6, 'gred'),))
    s.box(cx - 5, cx + 5, 17, 27, 19, 22, mat='rot', tex='plank', role='misc', contour=True)
    s.hip(cx - 5.6, cx + 5.6, 16.4, 27.6, 22, .5, mat='rot', tex='shingle', role='roof', contour=True)
    banner(s, cx, 22, 24.5, 3.5, 3, 1.5)
    for tx in (cx - 14, cx + 14):
        s.box(tx - 4, tx + 4, 3, 11, 0, 15, mat='moss', tex='brick', role='tower', contour=True,
              decals=(gwin(tx, 9.5, 12.5, 1.4, 'garch'),))
        s.box(tx - 4.8, tx + 4.8, 2.2, 11.8, 15, 16, mat='moss', tex='plain', role='misc', contour=True)
        s.crenels(tx - 4.8, tx + 4.8, 2.2, 11.8, 16, mat='moss', step=2, h=1.8, edges=('front', 'back', 'left', 'right'), depth=1.3)
    crenel_wall(s, cx - 10, cx + 10, 3, 7, 9, mat='moss', edges=('front',),
                decals=(('front', (cx - 2.4, cx + 2.4, 0, 6.5, 'gate')),))
    banner(s, cx - 14, 7, 17.8, 3.5, 2.6, 1.2)
    banner(s, cx + 14, 7, 17.8, 3.5, 2.6, 1.2)
    # 화형대
    s.box(cx + 7.5, cx + 8.3, -2.5, -1.7, 0, 6, mat='rot', tex='plain', role='misc')
    s.add(E.Ellip(cx + 7.9, -2.1, .6, 2.2, 1.6, 1.0, mat='reed', tex='speck', role='misc', contour=True))
    return s


# ═════════════════════════════════════════════════════════ 마을
def large_town():
    """역병 마을: 기운 집 다섯, 지붕 위 까마귀, 앞 묘지 울타리와 묘비."""
    s = Scene()
    ghouse(s, 3, 26, 8, 5, 6, 6.5, k=.12, chim=True)
    ghouse(s, 16, 30, 7, 5, 7, 7, k=-.08)
    ghouse(s, 28, 25, 9, 5, 6, 6.5, k=.06, win='garch')
    ghouse(s, 8, 13, 7, 5, 5.5, 6, k=-.1, win='garch')
    ghouse(s, 31, 12, 8, 5, 5.5, 6, k=.1, chim=True)
    dead_tree(s, 22, 16, 10, .8)
    # 묘지(앞)
    for x in np.arange(2, 42, 2.0):
        s.box(x, x + .6, -1, -.4, 0, 2.4, mat='rot', tex='plain', role='misc')
    s.box(2, 42, -1, -.4, 1.5, 2.0, mat='rot', tex='plain', role='misc')
    for (gx, gy, cr) in ((6, 3, 0), (12, 4, 1), (18, 2.5, 0), (26, 3.5, 1), (33, 2.5, 0)):
        if cr:
            s.box(gx - .4, gx + .4, gy, gy + .8, 0, 3.6, mat='gstone', tex='plain', role='misc', contour=True)
            s.box(gx - 1.3, gx + 1.3, gy, gy + .8, 2.2, 2.9, mat='gstone', tex='plain', role='misc', contour=True)
        else:
            s.box(gx - 1.1, gx + 1.1, gy, gy + .9, 0, 2.6, mat='gstone', tex='plain', role='misc', contour=True)
    crow(s, 8.5, 28.5, 15.5)
    crow(s, 35.5, 14.5, 14)
    crow(s, 24, 16, 11)
    return s


def village():
    """늪 마을: 말뚝 위 오두막 셋과 갈대."""
    s = Scene()
    stilt_hut(s, 2, 14, 9, 6, 3.0, 3.8, 4.6)
    stilt_hut(s, 17, 17, 9, 5, 3.6, 3.4, 4.2, roof='slate')
    stilt_hut(s, 10, 3, 8, 5, 2.4, 3.2, 4.0)
    s.box(17, 26, 7, 8, 1.6, 2.2, mat='rot', tex='plank', role='misc')
    reeds(s, 1, 2, 4, 5, 3)
    reeds(s, 22, 3, 4, 4.5, 5)
    return s


def village_b():
    """숯쟁이 마을: 흙 돔 숯가마 둘(연기), 오두막, 장작 더미."""
    s = Scene()
    ghouse(s, 16, 15, 9, 5, 4.5, 5.0, wall='rot', roof='slate', chim=True)
    for (kx, ky, r, sd) in ((7, 9, 5.0, 1), (21, 4, 4.0, 2)):
        s.add(E.Ellip(kx, ky, 0, r, r * .85, r * 1.0, mat='hide', tex='speck', role='house', contour=True))
        s.box(kx - 1.0, kx + 1.0, ky - r * .85 - .2, ky - r * .5, 0, 1.8, mat='slate', tex='plain', role='misc',
              decals=(('front', (kx - .6, kx + .6, 0, 1.4, 'lamp')),))
        smoke(s, kx, ky, r + 2, n=3, r0=1.6, rise=3.0, drift=1.6, seed=sd)
    for i in range(3):
        s.add(ob.Cyl(27 + i * .1, 11 + i * .2, .8, 0, 1.6 + i * 0, mat='rot', tex='plain', role='misc', contour=True)) if False else None
    for j, z in enumerate((0, 1.4, 2.8)):
        s.box(1 + j * .7, 8 - j * .7, -2.5, -.5, z, z + 1.4, mat='rot', tex='plank', role='misc', contour=True)
    return s


def camp():
    """사냥꾼 야영: 가죽 천막 둘, 모닥불, 짐승 가죽 걸이."""
    s = Scene()
    s.add(M.tent_ridge_y(2, 13, 9, 17, 9, mat='hide'))
    s.add(M.tent_ridge_y(18, 27, 13, 20, 7.5, mat='rot'))
    # 모닥불
    s.add(ob.Cyl(16, 4, 2.0, 0, .7, mat='gstone', tex='plain', role='misc', contour=True))
    s.add(ob.Cone(16, 4, 1.4, .7, 3.6, mat='fire', tex='plain', role='nocast'))
    # 가죽 걸이
    for px in (21, 28):
        s.box(px, px + .8, 2, 2.8, 0, 7.5, mat='rot', tex='plain', role='misc', contour=True)
    s.box(21, 28.8, 2, 2.8, 6.8, 7.5, mat='rot', tex='plain', role='misc')
    s.box(22.3, 27.5, 2.6, 3.0, 2.2, 6.8, mat='hide', tex='speck', role='misc', contour=True)
    s.box(.5, 1.3, 1, 1.8, 0, 9, mat='rot', tex='plain', role='misc')
    s.box(1.3, 4.0, 1.1, 1.7, 6, 8.6, mat='blood', tex='plain', role='misc', contour=True)
    return s


# ═════════════════════════════════════════════════════════ 탑
def tower_small():
    """마법사의 탑: 위로 갈수록 살짝 기우는 둥근 이끼 돌탑, 보라 창, 보라 고깔."""
    s = Scene()
    xc, yc, r = 5.5, 3.5, 2.7
    s.add(ob.Cyl(xc, yc, r + .7, 0, 2.2, mat='moss', tex='brick', role='tower', contour=True))
    z = 2.2
    for i, h in enumerate((5.5, 5.0, 4.5)):
        x = xc + i * .4
        rr = r - i * .12
        s.add(ob.Cyl(x, yc, rr, z, z + h, mat='moss', tex='brick', role='tower', contour=True))
        s.add(box(x - .8, x + .8, yc - rr - .25, yc - rr + .6, z + 1.2, z + 3.8, mat='slate', tex='plain', role='misc',
                  decals=(gwin(x, z + 1.2, z + 3.8, 1.6, 'gviolet'),)))
        z += h
    x = xc + 1.2
    s.add(ob.Cyl(x, yc, r + .3, z, z + .8, mat='moss', tex='plain', role='misc', contour=True))
    s.add(ob.Cone(x + .2, yc, r + .7, z + .8, z + 7.4, mat='violet', tex='shingle', role='roof', contour=True))
    return _scale(s, .93)


def tower_great():
    """해골 첨탑: 단을 줄여 가는 검은 탑, 정면 해골, 열린 종루의 종, 긴 첨탑."""
    s = Scene()
    xc, yc = 12.5, 5
    s.box(xc - 8, xc + 8, yc - 4.5, yc + 4.5, 0, 2.5, mat='slate', tex='brick', role='wall', contour=True)
    z = 2.5
    for i, (hw, h) in enumerate(((6.8, 10), (5.6, 9), (4.6, 7))):
        dec = (gwin(xc, z + h - 5.5, z + h - 1.2, 2.0, 'gred'),) if i < 2 else ()
        s.box(xc - hw, xc + hw, yc - hw * .6, yc + hw * .6, z, z + h, mat='slate', tex='brick', role='tower', contour=True, decals=dec)
        for bx in (xc - hw - .7, xc + hw - .5):        # 버팀벽
            s.box(bx, bx + 1.2, yc - hw * .6 - 1.3, yc - hw * .6 + 1, z, z + h - 1.5, mat='slate', tex='brick', role='misc', contour=True)
        s.box(xc - hw - .5, xc + hw + .5, yc - hw * .6 - .5, yc + hw * .6 + .5, z + h, z + h + .9, mat='gstone', tex='plain', role='misc', contour=True)
        z += h + .9
    # 해골(1단 앞면)
    s.add(E.Ellip(xc, yc - 4.6, 7.6, 2.4, 1.1, 2.4, mat='bone', tex='plain', role='misc', contour=True))
    s.box(xc - 1.5, xc - .3, yc - 6.0, yc - 5.4, 7.2, 8.4, mat='slate', tex='plain', role='misc')
    s.box(xc + .3, xc + 1.5, yc - 6.0, yc - 5.4, 7.2, 8.4, mat='slate', tex='plain', role='misc')
    s.box(xc - 1.1, xc + 1.1, yc - 5.3, yc - 4.5, 4.9, 5.8, mat='bone', tex='plain', role='misc', contour=True)
    # 종루
    hw = 3.8
    for bx in (xc - hw, xc + hw - 1.1):
        s.box(bx, bx + 1.1, yc - 1.8, yc + 1.8, z, z + 5.5, mat='slate', tex='plain', role='misc', contour=True)
    s.add(M.Frustum(xc, yc, 1.2, 2.2, z + 1.6, z + 4.2, mat='gold', role='misc', contour=True))
    s.box(xc - hw - .5, xc + hw + .5, yc - 2.4, yc + 2.4, z + 5.5, z + 6.4, mat='gstone', tex='plain', role='misc', contour=True)
    z += 6.4
    s.hip(xc - 4.0, xc + 4.0, yc - 2.6, yc + 2.6, z, 4.2, mat='slate', tex='shingle', role='roof', contour=True)
    s.box(xc - .4, xc + .4, yc - .4, yc + .4, z + 9.5, z + 13, mat='slate', tex='plain', role='misc')
    s.box(xc - 1.4, xc + 1.4, yc - .4, yc + .4, z + 11.2, z + 11.9, mat='slate', tex='plain', role='misc')
    return _scale(s, .96)


def cave():
    """괴물 소굴: 이끼 낀 검은 바위 무더기, 이빨 같은 동굴 입구, 흩어진 뼈."""
    s = Scene()
    s.add(E.Ellip(15, 11, 6, 12, 7.5, 10, mat='blackrock', tex='speck', role='wall', contour=True))
    s.add(E.Ellip(5.5, 9, 3, 4.6, 5, 6, mat='moss', tex='speck', role='wall', contour=True))
    s.add(E.Ellip(24.5, 9, 3, 4.4, 5, 6.5, mat='moss', tex='speck', role='wall', contour=True))
    s.box(10, 20, 3.6, 5, 0, 9, mat='blackrock', tex='plain', role='house', contour=True,
          decals=(('front', (11.5, 18.5, 0, 8.4, 'garch')),))
    for tx in (12.2, 14.4, 16.6):                                   # 윗니
        s.add(M.Frustum(tx + .6, 3.4, .7, .05, 6.6, 5.0, mat='bone', role='misc'))
    for (bx, by, ln, a) in ((6, -1, 4, .4), (20, -2, 3.6, -.5), (23.5, 1, 3, .9), (9, -3, 2.6, 1.2)):
        R = M.rot_z(a)
        s.add(M.obox((bx, by, .4), (ln, .7, .7), R, mat='bone', tex='plain', role='misc', contour=True))
    s.add(E.Ellip(14, -2, 1.0, 1.4, 1.1, 1.1, mat='bone', role='misc', contour=True))
    s.box(13.2, 13.8, -3.2, -3.0, .8, 1.4, mat='slate', tex='plain', role='misc')
    s.box(14.2, 14.8, -3.2, -3.0, .8, 1.4, mat='slate', tex='plain', role='misc')
    return s


def ruin():
    """엘프 유적: 덩굴 감긴 흰 아치와 부러진 기둥."""
    s = Scene()
    # 아치(기둥 둘 + 상인방 + 뾰족 머리)
    for px in (5, 15):
        s.add(ob.Cyl(px, 9, 1.7, 0, 15, mat='marble', tex='brick', role='wall', contour=True))
        s.add(ob.Cyl(px, 9, 2.4, 0, 1.5, mat='marble', tex='plain', role='misc', contour=True))
    s.box(2.6, 17.4, 7.6, 10.4, 15, 17, mat='marble', tex='brick', role='wall', contour=True)
    s.add(E.gable_ew(2.6, 17.4, 7.6, 10.4, 17, 2.4, mat='marble', tex='plain', role='roof', contour=True))
    # 부러진 기둥들
    s.add(ob.Cyl(24, 12, 1.7, 0, 8, mat='marble', tex='brick', role='wall', contour=True))
    s.add(M.obox((25, 4, 1.1), (7, 2.2, 2.2), M.rot_z(.35), mat='marble', tex='plain', role='misc', contour=True))
    s.add(ob.Cyl(27, 15, 1.4, 0, 4, mat='marble', tex='brick', role='wall', contour=True))
    # 덩굴
    for (x, y, z, rx, rz) in ((5, 7.4, 11, 1.9, 2.2), (15, 7.4, 6, 1.9, 2.8), (10, 7.2, 16.4, 4, 1.4), (24, 10.4, 7, 1.9, 1.8),
                              (4, 7.4, 3, 2.2, 2), (15.5, 7.4, 13.5, 1.8, 1.6)):
        s.add(E.Ellip(x, y, z, rx, 1.0, rz, mat='ivy', tex='speck', role='misc', contour=True))
    s.add(E.Ellip(19, 4, .6, 3, 2, 1.4, mat='ivy', tex='speck', role='misc', contour=True))
    return s


def ruin_city():
    """전쟁 폐허: 이가 빠진 성벽과 무너진 탑, 지붕이 타 버린 집(박공벽만 남음), 잿빛 연기, 불씨."""
    s = Scene()
    # 뒤 성벽: 구간마다 높이가 다르고 틈이 있다
    for (x0, x1, h, cut) in ((2, 15, 6, True), (19, 27, 4, False), (31, 47, 6.5, True)):
        s.box(x0, x1, 30, 33.5, 0, h, mat='gstone', tex='brick', role='wall', contour=True)
        if cut:
            s.crenels(x0, x1, 30, 33.5, h, mat='gstone', step=2, h=1.5, edges=('front',), depth=1.1)
    s.add(M.broken(49, 57, 27, 35, 17, tilts=((.45, .1), (-.15, -.05)), drops=(0, 3), mat='gstone', tex='brick', role='tower', contour=True,
                   decals=(gwin(53, 8, 12, 1.6, 'garch'),)))
    # 불탄 집: 그을린 벽 + 남은 박공벽 + 검은 서까래
    for (x, y, w, d, wh, sd) in ((5, 19, 8, 5, 5.5, 0), (21, 21, 7, 5, 5, 1), (37, 18, 9, 5, 6, 2), (12, 5, 8, 5, 5, 3), (33, 4, 8, 5, 5, 4)):
        s.add(M.broken(x, x + w, y, y + d, wh, tilts=((.35, .1), (-.3, 0)), drops=(0, 1.6), mat='daub', tex='plain', role='house', contour=True,
                       decals=(gwin(x + w * .25, 1.4, 4.2, 1.4, 'garch'), ('front', (x + w * .65, x + w * .65 + 2, 0, 3.2, 'garch')))))
        sl = 5.5 / (w / 2)
        s.add(E.gable_ns(x, x + w, y, y + .6, wh - 1.6, sl, mat='daub', tex='plain', role='house', contour=True,
                         decals=(gwin(x + w / 2, wh - 1, wh + 1.6, 1.3, 'garch'),)) if sd % 2 == 0 else
              M.obox((x + w * .5, y + d * .5, wh + .2), (w * .95, .9, .9), M.rot_y(.3), mat='slate', tex='plain', role='misc', contour=True))
        s.add(M.obox((x + w * .3, y + d * .6, wh + .6), (.8, d * .9, .8), M.rot_x(.5), mat='slate', tex='plain', role='misc'))
    M.rubble(s, np.random.RandomState(7), 2, 56, -2, 3, n=8, hmax=1.6, mats=('gstone', 'slate', 'daub'))
    for (sx, sy, sz, sd) in ((9, 22, 9, 1), (41, 21, 10, 2), (36, 6, 7, 3)):
        smoke(s, sx, sy, sz + 1, n=2, r0=2.3, rise=3.6, drift=2.2, seed=sd)
    for (ex, ey) in ((17, 4), (42, 17), (25, 20), (8, 18)):
        s.add(ob.Cone(ex, ey - 1, 1.1, 0, 2.6, mat='fire', tex='plain', role='nocast'))
    return s


def shrine():
    """버려진 수도원: 높은 뾰족 아치 창이 줄지은 회당, 무너진 지붕 틈, 종탑, 무너진 회랑."""
    s = Scene()
    dec = tuple(gwin(x, 3.5, 10, 2.0, 'garch') for x in (14, 18.5, 23, 33.5, 38)) + (('front', (26.4, 30.4, 0, 7.5, 'garch')),)
    s.box(10, 42, 16, 24, 0, 12, mat='moss', tex='brick', role='keep', contour=True, decals=dec)
    for bx in (15.9, 20.4, 30.8, 35.4):
        s.box(bx, bx + 1.2, 14.3, 16, 0, 9, mat='moss', tex='brick', role='misc', contour=True)
    s.add(ob.gable(9.2, 42.8, 15, 25, 12, 1.25, mat='slate', tex='shingle', role='roof', contour=True))
    # 지붕이 무너진 자리(서까래만)
    for rx in (33, 35.2, 37.4):
        s.add(M.obox((rx, 17.8, 14.3), (.7, 5.6, .7), M.rot_x(-.9), mat='rot', tex='plain', role='misc'))
    # 정면 박공 장식(문 위 장미창)
    s.add(E.gable_ns(24, 33, 14.3, 15.3, 12, 1.0, mat='moss', tex='brick', role='misc', contour=True,
                     decals=(gwin(28.5, 12.4, 15.6, 2.4, 'garch'),)))
    s.box(24, 33, 14.3, 15.3, 0, 12, mat='moss', tex='brick', role='misc', contour=True,
          decals=(('front', (26.4, 30.4, 0, 7.5, 'garch')),))
    # 종탑(왼쪽)
    tx = 6
    s.box(tx - 3.2, tx + 3.2, 12, 18.5, 0, 19, mat='moss', tex='brick', role='tower', contour=True,
          decals=(gwin(tx, 6, 10, 1.6, 'garch'), gwin(tx, 13, 16, 1.4, 'garch')))
    s.box(tx - 3.2, tx - 2.1, 12, 18.5, 19, 23.5, mat='moss', tex='plain', role='misc', contour=True)
    s.box(tx + 2.1, tx + 3.2, 12, 18.5, 19, 23.5, mat='moss', tex='plain', role='misc', contour=True)
    s.add(M.Frustum(tx, 15.2, 1.0, 1.8, 19.8, 22.2, mat='gold', role='misc', contour=True))
    s.box(tx - 3.7, tx + 3.7, 11.5, 19, 23.5, 24.4, mat='moss', tex='plain', role='misc', contour=True)
    s.hip(tx - 3.9, tx + 3.9, 11.3, 19.2, 24.4, 2.2, mat='slate', tex='shingle', role='roof', contour=True)
    s.box(tx - .4, tx + .4, 14.8, 15.6, 31, 34, mat='slate', tex='plain', role='misc')
    s.box(tx - 1.4, tx + 1.4, 14.8, 15.6, 32.4, 33.1, mat='slate', tex='plain', role='misc')
    # 무너진 회랑(앞 왼쪽)
    for i, px in enumerate((26, 30.5, 35, 39.5)):
        h = (3, 5, 7, 7)[i]
        s.box(px, px + 1.5, 4, 6, 0, h, mat='moss', tex='brick', role='misc', contour=True)
    s.box(30.5, 41, 4, 6, 7, 8, mat='moss', tex='brick', role='misc', contour=True)
    s.add(E.Ellip(20, 4, 1, 2.8, 2, 1.4, mat='moss', tex='speck', role='misc', contour=True))
    s.add(E.Ellip(40, 7, 8.4, 2.2, 1.2, 1.2, mat='ivy', tex='speck', role='misc', contour=True))
    crow(s, 18, 20, 19.5)
    return _scale(s, .93)


def landmark_nature():
    """교수목: 죽은 거목, 굵은 가지에 늘어진 밧줄 올가미 셋, 까마귀."""
    s = Scene()
    x, y = 22, 10
    s.add(M.Frustum(x, y, 4.0, 2.0, 0, 18, mat='rot', tex='plain', role='wall', contour=True))
    s.add(M.Frustum(x, y, 5.4, 4.0, 0, 3, mat='rot', role='misc', contour=True))
    # 뿌리
    for a in (-.5, .5, 2.6, 3.6):
        R = M.rot_z(a)
        c = np.array([x, y, .6]) + R @ np.array([5.5, 0, 0])
        s.add(M.obox(c, (5, 1.4, 1.4), R @ M.rot_y(.25), mat='rot', tex='plain', role='misc', contour=True))
    br = ((-1.05, 13, 15, 1.6), (1.0, 14, 14, 1.5), (-.35, 17, 9, 1.2), (.45, 17.5, 9, 1.1), (-1.4, 9, 9, 1.2), (1.35, 10, 8, 1.1))
    tips = []
    for (ang, zz, ln, th) in br:
        R = M.rot_y(ang)
        c = np.array([x, y, zz]) + R @ np.array([0, 0, ln / 2])
        s.add(M.obox(c, (th, th, ln), R, mat='rot', tex='plain', role='misc', contour=True))
        tips.append(np.array([x, y, zz]) + R @ np.array([0, 0, ln * .7]))
    # 올가미(굵은 가지 둘 + 하나)
    for t, drop in ((tips[0], 6), (tips[1], 7), (tips[4], 4)):
        rx, rz = t[0], t[2]
        s.box(rx - .25, rx + .25, y - .9, y - .4, rz - drop, rz, mat='bone', tex='plain', role='misc')
        s.box(rx - .8, rx + .8, y - .9, y - .4, rz - drop - 1.6, rz - drop, mat='bone', tex='plain', role='misc')
    crow(s, tips[2][0], y, tips[2][2] + .5)
    crow(s, tips[3][0] + 1, y, tips[3][2])
    return _scale(s, 1.3)


def landmark_witch():
    """마녀 오두막: 늪 위에 닭다리 기둥 둘로 선 오두막, 해골 울타리, 솥."""
    s = Scene()
    x, y, w, d = 14, 9, 13, 8
    # 닭다리(허벅지 + 정강이 + 발가락)
    for lx, sg in ((x + 3.5, -1), (x + w - 3.5, 1)):
        s.add(M.obox((lx + sg * .8, y + 4, 7.2), (2.2, 2.2, 5), M.rot_y(sg * .35), mat='hide', tex='plain', role='misc', contour=True))
        s.add(M.obox((lx, y + 3.5, 2.6), (1.2, 1.2, 5.2), M.rot_y(-sg * .25), mat='gold', tex='plain', role='misc', contour=True))
        for a in (-.6, 0, .6):
            R = M.rot_z(-math.pi / 2 + a)
            c = np.array([lx, y + 3.5, .4]) + R @ np.array([1.4, 0, 0])
            s.add(M.obox(c, (2.6, .7, .7), R, mat='gold', tex='plain', role='misc'))
    z0 = 9.5
    s.box(x, x + w, y, y + d, z0, z0 + 6, mat='rot', tex='plank', role='house', contour=True,
          decals=(('front', (x + 2.4, x + 5, z0, z0 + 4.4, 'door')), gwin(x + 9.5, z0 + 1.6, z0 + 4.8, 2.0, 'gviolet')))
    s.add(sgable_ns(x - 1.3, x + w + 1.3, y - 1.0, y + d + 1.0, z0 + 6, 1.15, mat='reed', tex='speck', role='roof', contour=True))
    s.add(sgable_ns(x, x + w, y - .2, y + .4, z0 + 6, 1.0, mat='rot', tex='plank', role='house', contour=True,
                    decals=(gwin(x + w / 2, z0 + 6.6, z0 + 10, 1.8, 'gviolet'),)))
    s.box(x + w - 3, x + w - 1.6, y + 4, y + 5.4, z0 + 7, z0 + 14, mat='gstone', tex='brick', role='misc', contour=True)
    smoke(s, x + w - 2.3, y + 4.7, z0 + 15.5, n=2, r0=1.4, rise=2.6, drift=1.2, mat='violet', seed=4)
    # 해골 말뚝
    for (px, py) in ((4, 2), (36, 3), (9, -1)):
        s.box(px - .35, px + .35, py, py + .7, 0, 5, mat='rot', tex='plain', role='misc')
        s.add(E.Ellip(px, py + .3, 5.6, 1.1, .9, 1.0, mat='bone', role='misc', contour=True))
    # 솥
    s.add(E.Ellip(30, 2, 1.4, 2.4, 2.0, 1.8, mat='slate', role='misc', contour=True))
    s.add(ob.Cyl(30, 2, 1.7, 2.6, 3.1, mat='ivy', tex='plain', role='misc'))
    reeds(s, 2, 8, 3, 5, 7)
    reeds(s, 38, 10, 3, 4.5, 9)
    return _scale(s, 1.1)


def circle():
    """마녀의 돌원: 기운 검은 선돌 다섯, 가운데 붉은 불."""
    s = Scene()
    xc, yc = 15, 8
    for i, (ang, h, tilt) in enumerate(((200, 12, .08), (250, 9, -.1), (300, 11, .12), (340, 13, -.05), (160, 10, .1),
                                        (100, 9, -.12), (60, 11, .06))):
        th = math.radians(ang)
        px, py = xc + 12 * math.cos(th), yc + 7 * math.sin(th)
        R = M.rot_y(tilt)
        s.add(M.obox((px, py, h / 2 - .3), (3.0, 2.2, h), R, mat='blackrock', tex='plain', role='misc', contour=True))
    s.add(ob.Cyl(xc, yc, 2.6, 0, .8, mat='slate', tex='plain', role='misc', contour=True))
    s.add(ob.Cone(xc, yc, 2.0, .8, 6.0, mat='fire', tex='plain', role='nocast'))
    s.add(ob.Cone(xc + .3, yc - .3, 1.0, .8, 3.4, mat='bone', tex='plain', role='nocast'))
    return s


def volcano():
    """잿빛 화산: 검은 화구의 잿빛 원뿔, 앞 비탈로 흐르는 붉은 용암 한 줄."""
    s = Scene()
    xc, yc = 15, 10
    s.add(M.Frustum(xc, yc, 13.5, 4.6, 0, 14, mat='basalt', tex='plain', role='wall', contour=True))
    s.add(M.Frustum(xc, yc, 4.2, 3.6, 13.6, 14.4, mat='blackrock', role='misc'))
    s.add(E.Ellip(xc, yc - .5, 14.2, 3.0, 1.8, .6, mat='lava', role='misc'))
    # 용암 줄: 앞 비탈(원뿔대 경사 9.2/16) 위에 얇게
    slope = math.atan2(13.5 - 4.6, 14)
    for (zz, ln, w, xo) in ((9.2, 9, 1.6, 0), (3.4, 6, 1.4, .8)):
        rr = 13.5 - (13.5 - 4.6) * zz / 14
        R = M.rot_x(-slope)
        s.add(M.obox((xc + xo, yc - rr - .15, zz), (w, .6, ln), R, mat='lava', tex='plain', role='nocast'))
    smoke(s, xc + 1, yc, 15.5, n=1, r0=1.8, rise=3.0, drift=1.5, seed=6)
    return s


def floating():
    """저주받은 떠 있는 성: 거꾸로 선 검은 바위 섬 + 이끼 윗면 + 첨탑 성, 아래 안개."""
    s = Scene()
    xc, yc = 38, 14
    s.add(E.InvCone(xc, yc, 16, 0, 20, mat='blackrock', tex='speck', role='wall', contour=True))
    for (lx, lr, lb) in ((xc - 17, 10, 8), (xc + 17, 9, 10)):
        s.add(E.InvCone(lx, yc - 1, lr, lb, 19.6, mat='blackrock', tex='speck', role='wall', contour=True))
        s.add(E.Ellip(lx, yc - 1, 19.6, lr + 1, lr + 1, 1.6, mat='moss', tex='speck', role='ground', contour=True))
    s.add(E.Ellip(xc, yc, 20, 17, 17, 2.0, mat='moss', tex='speck', role='ground', contour=True))
    zb = 21.2
    # 성
    cx = xc
    s.add(sbox(cx - 9, cx + 9, yc - 2, yc + 6, zb, zb + 11, mat='gstone', tex='brick', role='keep', contour=True,
               decals=(gwin(cx - 4, zb + 5, zb + 9, 1.8), gwin(cx + 4, zb + 5, zb + 9, 1.8), ('front', (cx - 2, cx + 2, zb, zb + 6, 'garch')))))
    s.add(E.gable_ns(cx - 9.6, cx + 9.6, yc - 2.5, yc + 6.5, zb + 11, .85, mat='slate', tex='shingle', role='roof', contour=True))
    for (tx, ty, w, h, sp) in ((cx, yc + 4, 6, 14, 8), (cx - 13, yc - 2, 5, 10, 5.5), (cx + 13, yc - 1, 5, 11, 6)):
        p0 = len(s.prims)
        spire_tower(s, tx, ty, w, h, sp, nwin=2)
        for p in s.prims[p0:]:                   # 섬 위로 올린다
            _lift(p, zb)
    crenel_wall(s, cx - 22, cx + 22, yc - 9, yc - 6, 4, edges=('front',)) if False else None
    for (wx0, wx1) in ((cx - 22, cx - 4), (cx + 4, cx + 22)):
        s.box(wx0, wx1, yc - 9, yc - 6.5, zb - 1, zb + 3.5, mat='gstone', tex='brick', role='wall', contour=True)
        s.crenels(wx0, wx1, yc - 9, yc - 6.5, zb + 3.5, mat='gstone', step=2, h=1.4, edges=('front',), depth=1.0)
    dead_tree(s, cx - 21, yc + 3, 7, .6) if False else None
    for (fx, fy, fz, rx, rz) in ((14, 4, 7, 9, 2.6), (63, 4, 8, 9, 2.6), (40, -2, 3, 9, 2.2)):
        s.add(E.Ellip(fx, fy, fz, rx, 5, rz, mat='fog', tex='speck', role='steam', contour=False))
    crow(s, cx + 20, yc, zb + 12)
    return s


def _scale(s, k):
    """장면 전체를 k 배 키운다(원점 기준)."""
    for p in s.prims:
        if isinstance(p, Poly):
            p.d = p.d * k
        elif isinstance(p, E.InvCone):
            p.xc, p.yc, p.r, p.z0, p.zt = p.xc * k, p.yc * k, p.r * k, p.z0 * k, p.zt * k
        elif isinstance(p, ob.Cone):
            p.xc, p.yc, p.r, p.z0, p.zt = p.xc * k, p.yc * k, p.r * k, p.z0 * k, p.zt * k
        elif isinstance(p, ob.Cyl):
            p.xc, p.yc, p.r, p.z0, p.z1 = p.xc * k, p.yc * k, p.r * k, p.z0 * k, p.z1 * k
        elif isinstance(p, M.Frustum):
            p.xc, p.yc, p.r0, p.r1, p.z0, p.z1 = p.xc * k, p.yc * k, p.r0 * k, p.r1 * k, p.z0 * k, p.z1 * k
            p.zc = None if p.zc is None else p.zc * k
        elif isinstance(p, E.Ellip):
            p.c, p.r = p.c * k, p.r * k
        elif isinstance(p, M.Dome):
            p.c, p.r, p.zmin = p.c * k, p.r * k, p.zmin * k
    return s


def _lift(p, dz):
    """spire_tower 가 z=0 에서 지은 입체를 dz 만큼 올린다."""
    if isinstance(p, Poly):
        p.d = p.d + p.n[:, 2] * dz
    elif isinstance(p, ob.Cone):
        p.z0 += dz
        p.zt += dz
    elif isinstance(p, ob.Cyl):
        p.z0 += dz
        p.z1 += dz


ORDER = [
    ('capital', '검은 왕도', 'capital', (6, 6), '쌍첨탑 대성당·높은 성벽·원탑·빽빽한 검은 지붕 집·교수대 광장'),
    ('fort_city', '피깃발 성채 도시', 'fort_city', (4, 4), '높은 돌성벽·네모 망루 넷·성문 위 핏빛 깃발·아성'),
    ('harbor_city', '늪 항구', 'harbor_city', (5, 4), '나무 말뚝 부두·검은 범선·창고·등불'),
    ('castle', '흡혈귀 성', 'castle', (3, 3), '뾰족탑 셋·붉은 창·핏빛 휘장'),
    ('castle', '마녀 사냥꾼 요새', 'castle_b', (3, 3), '흉벽 두른 각진 망루·깃발·화형대'),
    ('large_town', '역병 마을', 'large_town', (3, 3), '기운 집·까마귀·묘지 울타리와 묘비'),
    ('village', '늪 마을', 'village', (2, 2), '말뚝 위 오두막·갈대'),
    ('village', '숯쟁이 마을', 'village_b', (2, 2), '흙 숯가마 둘과 연기·오두막·장작'),
    ('camp', '사냥꾼 야영', 'camp', (2, 2), '가죽 천막·모닥불·짐승 가죽 걸이'),
    ('tower_small', '마법사의 탑', 'tower_small', (1, 2), '기운 이끼 돌탑·보라 창·보라 고깔'),
    ('tower_great', '해골 첨탑', 'tower_great', (2, 4), '검은 단탑·해골 장식·종루의 종·긴 첨탑'),
    ('cave', '괴물 소굴', 'cave', (2, 2), '이빨 달린 동굴 입구·흩어진 뼈'),
    ('ruin', '엘프 유적', 'ruin', (2, 2), '덩굴 감긴 흰 아치·부러진 기둥'),
    ('ruin_city', '전쟁 폐허', 'ruin_city', (4, 3), '불탄 집·부서진 성벽·연기·불씨'),
    ('shrine', '버려진 수도원', 'shrine', (3, 3), '고딕 아치 창 회당·종탑·무너진 회랑'),
    ('landmark_nature', '교수목', 'landmark_nature', (3, 3), '죽은 거목·밧줄 올가미·까마귀'),
    ('landmark_nature', '마녀 오두막', 'landmark_witch', (3, 3), '닭다리 오두막·보라 연기·해골 말뚝·솥'),
    ('circle', '마녀의 돌원', 'circle', (2, 2), '기운 검은 선돌·붉은 불'),
    ('volcano', '잿빛 화산', 'volcano', (2, 2), '잿빛 원뿔·검은 화구·붉은 용암 한 줄'),
    ('floating', '저주받은 떠 있는 성', 'floating', (5, 4), '검은 바위 섬·첨탑 성·아래 안개'),
]
