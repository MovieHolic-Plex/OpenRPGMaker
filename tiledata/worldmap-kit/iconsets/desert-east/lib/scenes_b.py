"""동양·사막풍 아이콘 장면 B: 성곽 도시·읍성·항구·산성·큰 마을·폐허 성채."""
import sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import numpy as np  # noqa: E402
import oblique as ob  # noqa: E402
import east as E  # noqa: E402
from oblique import Scene, render, finish  # noqa: E402


def _done(s, W, H, ox, oy, shadow=True):
    arr, st = render(s, W, H, ox=ox, oy=oy, shadow=shadow)
    return finish(arr), st


def court_fn(xr=None, yr=None, plaza=None, grass=.25):
    """안뜰 바닥: 마른 흙 + 드문 풀 + 돌길(xr 세로·yr 가로 띠) + 광장."""
    dirt = np.array(ob.MAT['dirt'], np.uint8)
    gr = np.array(ob.MAT['grass'], np.uint8)
    stn = np.array(ob.MAT['stone'], np.uint8)

    def fn(x, y):
        col = dirt[np.clip((1 + ob.hsh(x, y, 13) * 3).astype(int), 0, 4)]
        g = ob.hsh(np.floor(x / 3), np.floor(y / 3), 4) < grass
        col = np.where(g[:, None], gr[np.clip((ob.hsh(x, y, 11) * 4.2).astype(int), 0, 4)], col)
        road = np.zeros(len(x), bool)
        if xr:
            road |= (x >= xr[0]) & (x <= xr[1])
        if yr:
            road |= (y >= yr[0]) & (y <= yr[1])
        if plaza:
            road |= (x >= plaza[0]) & (x <= plaza[1]) & (y >= plaza[2]) & (y <= plaza[3])
        sl = stn[np.clip((3 + ob.hsh(x, y, 17) * 2).astype(int), 0, 6)]
        return np.where(road[:, None], sl, col)
    return fn


def merlons(s, x0, x1, y0, y1, z, edges=('front', 'back'), step=2.5, h=1.8, mat='greywall'):
    s.crenels(x0, x1, y0, y1, z, mat=mat, step=step, h=h, edges=edges, depth=1.3)


def wall(s, x0, x1, y0, y1, h, mat='greywall', edges=('front', 'back'), role='wall', decals=(), step=2.5):
    s.box(x0, x1, y0, y1, 0, h, mat=mat, tex='brick', role=role, contour=True, decals=decals)
    merlons(s, x0, x1, y0, y1, h, edges=edges, mat=mat, step=step)


def gatehouse(s, xc, y, w, d, base_h, wh, rise, gate_w=6, mat='tile', pavilion=True, wall_mat='greywall', ytop=None, role='gate'):
    """성문 문루: 석축 문 + 위의 2층 목조 누각(붉은 기둥·흰 벽) + 겹처마 기와."""
    x0, x1 = xc - w / 2, xc + w / 2
    s.box(x0, x1, y, y + d, 0, base_h, mat=wall_mat, tex='brick', role=role, contour=True,
          decals=(('front', (xc - gate_w / 2, xc + gate_w / 2, 0, base_h - 1.2, 'arch')),))
    if not pavilion:
        return base_h
    z0 = base_h
    m = 1.2
    s.box(x0 + m, x1 - m, y + m, y + d - m, z0, z0 + wh, mat='plaster', tex='plain', role='tower', contour=True,
          decals=(('front', (xc - 1.2, xc + 1.2, z0 + wh * .25, z0 + wh * .75, 'lat')),))
    E.pillars(s, x0 + m - .3, x1 - m + .3, y + m, z0, z0 + wh, max(3, int(w / 5)), w=1.3, d=1.1)
    E.tile_roof(s, x0 - 2, x1 + 2, y - 2, y + d + 2, z0 + wh, rise, mat=mat, tips=2)
    return z0 + wh + rise


def corner_tower(s, xc, yc, w, wh, base_h, rise, mat='tile'):
    s.box(xc - w / 2, xc + w / 2, yc - w / 2, yc + w / 2, 0, base_h, mat='greywall', tex='brick', role='tower', contour=True)
    s.box(xc - w / 2 + .9, xc + w / 2 - .9, yc - w / 2 + .9, yc + w / 2 - .9, base_h, base_h + wh, mat='plaster', tex='plain', role='tower', contour=True,
          decals=(('front', (xc - .9, xc + .9, base_h + wh * .3, base_h + wh * .8, 'win')),))
    E.tile_roof(s, xc - w / 2 - 1.8, xc + w / 2 + 1.8, yc - w / 2 - 1.8, yc + w / 2 + 1.8, base_h + wh, rise, mat=mat, tips=1.8)


def tree(s, x, y, h=8, r=3.2):
    s.cyl(x, y, .7, 0, h * .55, mat='bark', tex='plain', role='misc')
    s.add(E.Ellip(x, y, h * .8, r, r * .85, r * .85, mat='leaf2', tex='speck', role='misc', contour=True))


def house(s, x, y, w, d, wh=4.5, rise=5, mat='tile', wall='plaster', door=True, floors=1, over=1.8):
    dec = (('front', (x + w / 2 - 1.1, x + w / 2 + 1.1, 0, 3.2, 'reddoor')),) if door else ()
    s.box(x, x + w, y, y + d, 0, wh, mat=wall, tex='plain', role='house', contour=True, decals=dec)
    z = wh
    if floors == 2:
        s.add(ob.box(x - .5, x + w + .5, y - .6, y + d + .5, wh, wh + .8, mat='redwall', tex='plain', role='misc'))
        E.tile_roof(s, x - 1.6, x + w + 1.6, y - 1.8, y + d + 1.6, wh + .8, 1.8, mat=mat, tips=1.2)
        z = wh + 1.8
        s.box(x + 1, x + w - 1, y + .8, y + d - .8, z, z + wh * .8, mat=wall, tex='plain', role='house', contour=True,
              decals=(('front', (x + w / 2 - .9, x + w / 2 + .9, z + 1.2, z + 3, 'lat')),))
        z += wh * .8
        over = 1.5
    E.tile_roof(s, x - over, x + w + over, y - over, y + d + over, z, rise, mat=mat, tips=1.5)


# ═══════════════════════════════════════════════════════════════════ 도시
def capital():
    """이중 성벽 궁성 도시: 바깥 성벽 + 앞·뒤·좌우 문루 + 모서리 각루 + 안쪽 궁성의 큰 전각."""
    s = Scene()
    x0, x1, D = 6, 57, 88
    cx = 31.5
    s.patch(x0, x1, 5, D - 5, court_fn(xr=(cx - 2, cx + 2), yr=(24, 27), grass=.22), mat='dirt')
    wall(s, x0 - 3, x1 + 3, D - 6, D, 8, edges=('front',))
    wall(s, x0 - 3, x0 + 3, 0, D, 8, edges=('front',))
    wall(s, x1 - 3, x1 + 3, 0, D, 8, edges=('front',))
    ix0, ix1, iy0, iy1 = 20, 46, 38, 76
    wall(s, ix0, ix1, iy1 - 2.5, iy1, 5, edges=('front',), step=2)
    wall(s, ix0, ix0 + 2.5, iy0, iy1, 5, edges=('front',), step=2)
    wall(s, ix1 - 2.5, ix1, iy0, iy1, 5, edges=('front',), step=2)
    # 궁성 큰 전각 두 채(앞 정전, 뒤 침전)
    E.hall(s, 22, 46, 21, 9, 8, 10, plat=3.0, mat='jade', npil=6, over=3.4)
    s.add(ob.Cyl(32.5, 50.5, .7, 8 + 3 + 10 - .3, 8 + 3 + 10 + 3.4, mat='goldroof', tex='plain', role='roof'))
    E.hall(s, 25, 63, 15, 6, 5.5, 6, plat=2.0, mat='tile', npil=4, over=2.6)
    wall(s, ix0, cx - 5, iy0, iy0 + 2.5, 4, edges=('front',), step=2)
    wall(s, cx + 5, ix1, iy0, iy0 + 2.5, 4, edges=('front',), step=2)
    gatehouse(s, cx, iy0 - .5, 10, 3.5, 4, 3.4, 3.8, gate_w=4, mat='jade')
    for (hx, hy, w, d, fl) in ((9, 30, 8, 6, 1), (9, 46, 8, 6, 2), (9, 62, 8, 5, 1), (49, 30, 8, 6, 1), (49, 46, 8, 6, 2), (49, 62, 8, 5, 1),
                               (18, 14, 8, 5, 1), (38, 14, 8, 5, 1)):
        house(s, hx, hy, w, d, wh=4, rise=4.2, floors=fl)
    for (tx, ty) in ((18, 38), (48, 38), (18, 56), (48, 56), (26, 22), (40, 22)):
        tree(s, tx, ty, 8, 3)
    wall(s, x0 - 3, cx - 10, 0, 6, 8, edges=('front', 'back'))
    wall(s, cx + 10, x1 + 3, 0, 6, 8, edges=('front', 'back'))
    gatehouse(s, cx, -3, 20, 12, 9, 6.5, 8.5, gate_w=7, mat='jade')
    gatehouse(s, x0, 42, 9, 12, 8, 5, 6, gate_w=4)
    gatehouse(s, x1, 42, 9, 12, 8, 5, 6, gate_w=4)
    gatehouse(s, cx, D - 9, 14, 9, 8, 5, 6, gate_w=5)
    corner_tower(s, x0 - 1, 3, 9, 6, 8, 6.5)
    corner_tower(s, x1 + 1, 3, 9, 6, 8, 6.5)
    corner_tower(s, x0 - 1, D - 3, 9, 6, 8, 6.5)
    corner_tower(s, x1 + 1, D - 3, 9, 6, 8, 6.5)
    return _done(s, 96, 96, 2, 91)


def fort_city():
    """성벽을 두른 읍성: 앞 문루 하나, 안에 관아."""
    s = Scene()
    x0, x1, D = 6, 39, 48
    s.patch(x0, x1, 4, D - 4, court_fn(xr=(20, 24), yr=(18, 21), grass=.2), mat='dirt')
    wall(s, x0 - 3, x1 + 3, D - 5, D, 6, edges=('front',))
    wall(s, x0 - 3, x0 + 3, 0, D, 6, edges=('front',))
    wall(s, x1 - 3, x1 + 3, 0, D, 6, edges=('front',))
    E.hall(s, 13, 30, 19, 8, 6.5, 8, plat=2.4, mat='tile', npil=5, over=3)
    house(s, 9, 22, 6, 4, wh=3.4, rise=3.6)
    house(s, 30, 22, 6, 4, wh=3.4, rise=3.6)
    tree(s, 12, 12, 7, 2.8)
    tree(s, 33, 12, 7, 2.8)
    wall(s, x0 - 3, 17, 0, 5, 6, edges=('front', 'back'))
    wall(s, 29, x1 + 3, 0, 5, 6, edges=('front', 'back'))
    gatehouse(s, 22.5, -3, 14, 10, 7, 4.6, 5.8, gate_w=6)
    corner_tower(s, x0 - 1, 3, 8, 5, 6, 5.5)
    corner_tower(s, x1 + 1, 3, 8, 5, 6, 5.5)
    corner_tower(s, x0 - 1, D - 3, 8, 5, 6, 5.5)
    corner_tower(s, x1 + 1, D - 3, 8, 5, 6, 5.5)
    return _done(s, 64, 64, 2, 56)


def harbor_city():
    """바다 쪽(앞)이 열린 항구 읍성: 뒤·옆 성벽만, 앞은 부두와 돛배."""
    s = Scene()
    x0, x1, D = 8, 58, 42
    s.patch(x0, x1, 3, D - 4, court_fn(xr=(31, 35), yr=(18, 21), grass=.12), mat='dirt')
    wall(s, x0 - 3, x1 + 3, D - 5, D, 7, edges=('front',))
    wall(s, x0 - 3, x0 + 3, 0, D, 7, edges=('front',))
    wall(s, x1 - 3, x1 + 3, 0, D, 4, edges=('front',))
    # 뒤 문루(항구 읍성의 주문루)
    gatehouse(s, 33, D - 8, 14, 8, 6, 5.5, 6.5, gate_w=5, mat='jade')
    house(s, 14, 24, 9, 6, wh=4, rise=4.2)
    house(s, 43, 24, 9, 6, wh=4, rise=4.2)
    house(s, 24, 10, 8, 5, wh=3.6, rise=3.8, floors=2)
    house(s, 38, 10, 8, 5, wh=3.6, rise=3.8, floors=2)
    E.hall(s, 26, 26, 14, 6, 5.5, 6.5, plat=2.2, mat='jade', npil=4, over=2.6)
    # 부두(나무 데크) + 돛배
    s.box(12, 40, -9, 1.5, 0, 2.2, mat='wood', tex='plank', role='misc', contour=True)
    for px in (14, 22, 31, 39):
        s.box(px, px + 1.5, -9.8, -8.4, -1, 3.4, mat='wood', tex='plain', role='misc')
    # 창고
    s.box(x0 + 1, x0 + 11, 4, 10, 0, 4, mat='wood', tex='plank', role='house', contour=True)
    s.add(E.gable_ew(x0, x0 + 12, 3, 11, 4, 4.2 / 4, mat='tile', tex='tile', contour=True, role='roof'))
    # 배
    s.add(E.hull(42, 60, -16, -9, 0, 3.4, rise=.7, mat='wood', tex='plank', role='misc', contour=True))
    s.box(50, 51.2, -13.5, -12.3, 3, 16, mat='wood', tex='plain', role='misc')
    s.add(E.sail(51.2, -13.4, 4.5, 15.5, 7.5, mat='cloth', role='misc', contour=True))
    s.add(E.sail(59.8, -11.4, 6, 17, -6.5, mat='sail', role='misc', contour=True)) if False else None
    corner_tower(s, x0 - 1, D - 3, 9, 6, 7, 6)
    corner_tower(s, x1 + 1, D - 3, 9, 6, 7, 6)
    corner_tower(s, x0 - 1, 3, 8, 5, 7, 5.5)
    return _done(s, 80, 64, 0, 44)


# ═══════════════════════════════════════════════════════════════════ 산성
def castle():
    """산성: 석축 성벽 + 흙 언덕 + 3층 누각."""
    s = Scene()
    s.add(E.Ellip(24, 14, 3, 22, 13, 5.5, mat='rock', tex='speck', role='ground', contour=False))
    wall(s, 4, 44, 14, 20, 7, edges=('front',), role='wall')
    s.box(4, 10, 0, 20, 0, 7, mat='greywall', tex='brick', role='wall', contour=True)
    s.box(38, 44, 0, 20, 0, 7, mat='greywall', tex='brick', role='wall', contour=True)
    merlons(s, 4, 10, 0, 20, 7, edges=('front',))
    merlons(s, 38, 44, 0, 20, 7, edges=('front',))
    # 앞 낮은 성벽 + 문
    s.box(10, 38, 0, 6, 0, 5, mat='greywall', tex='brick', role='wall', contour=True,
          decals=(('front', (21.5, 26.5, 0, 3.8, 'arch')),))
    merlons(s, 10, 38, 0, 6, 5, edges=('front',))
    # 3층 누각(성 중앙)
    xc, yc = 24, 11
    s.box(xc - 7, xc + 7, yc - 4, yc + 4, 5, 8.5, mat='greywall', tex='brick', role='keep', contour=True)
    z = 8.5
    for (hw, hd, h, rise) in ((6, 3.2, 4.2, 2.8), (4.8, 2.6, 3.6, 2.6), (3.4, 2.0, 3.2, 4.4)):
        s.box(xc - hw, xc + hw, yc - hd, yc + hd, z, z + h, mat='plaster', tex='plain', role='keep', contour=True,
              decals=(('front', (xc - .9, xc + .9, z + h * .3, z + h * .8, 'win')),))
        E.pillars(s, xc - hw - .2, xc + hw + .2, yc - hd, z, z + h, 3, w=1.2, d=1.0)
        E.tile_roof(s, xc - hw - 2.3, xc + hw + 2.3, yc - hd - 2.3, yc + hd + 2.3, z + h, rise, mat='tile', tips=1.5)
        z += h + rise * .6
    s.add(ob.Cyl(xc, yc, .6, z + 1.6, z + 4.2, mat='goldroof', tex='plain', role='roof'))
    return _done(s, 48, 48, 1, 38)


def castle_b():
    """산성(요새형): 비탈 위 성벽, 문루 하나와 양 망루, 안쪽 장대."""
    s = Scene()
    s.add(E.Ellip(22, 13, 2, 20, 12, 4.5, mat='rock', tex='speck', role='ground'))
    s.box(3, 41, 12, 19, 0, 8, mat='greywall', tex='brick', role='wall', contour=True)
    merlons(s, 3, 41, 12, 19, 8, edges=('front',))
    s.box(3, 9, 0, 19, 0, 8, mat='greywall', tex='brick', role='wall', contour=True)
    merlons(s, 3, 9, 0, 19, 8, edges=('front',))
    s.box(35, 41, 0, 19, 0, 8, mat='greywall', tex='brick', role='wall', contour=True)
    merlons(s, 35, 41, 0, 19, 8, edges=('front',))
    s.box(9, 35, 0, 5, 0, 5.5, mat='greywall', tex='brick', role='wall', contour=True)
    merlons(s, 9, 35, 0, 5, 5.5, edges=('front',))
    gatehouse(s, 22, -3, 14, 10, 6.5, 5, 6.5, gate_w=5.5)
    corner_tower(s, 6, 4, 8, 6, 8, 6.4)
    corner_tower(s, 38, 4, 8, 6, 8, 6.4)
    house(s, 16, 12, 12, 6, wh=5.5, rise=6, wall='plaster', floors=1, over=2.2)
    return _done(s, 48, 48, 3, 38)


# ═══════════════════════════════════════════════════════════════════ 큰 마을
def large_town():
    """기와집 여섯 채 마을(일부 2층), 담장·장독."""
    s = Scene()
    house(s, 1, 21, 9, 5, wh=3.8, rise=3.8, floors=2)
    house(s, 14, 22, 9, 5, wh=3.6, rise=3.6)
    house(s, 27, 21, 9, 5, wh=3.8, rise=3.8, floors=2)
    house(s, 2, 3, 9, 5, wh=3.4, rise=3.6)
    house(s, 15, 2, 10, 5, wh=3.8, rise=4)
    house(s, 29, 3, 9, 5, wh=3.4, rise=3.6)
    s.box(11.5, 14.5, 3, 4.2, 0, 2.2, mat='plaster', tex='plain', role='misc', contour=True)
    s.box(25.5, 28.5, 3, 4.2, 0, 2.2, mat='plaster', tex='plain', role='misc', contour=True)
    for jx in (12.2, 13.8, 26.5):
        s.cyl(jx, -2.0, 1.0, 0, 2.0, mat='wood', tex='plain', role='misc', contour=True)
    return _done(s, 48, 48, 0, 40)


def large_town_b():
    """비단길 오아시스 마을: 평지붕 2층 흙집, 돔 사원, 미나렛."""
    s = Scene()
    s.box(3, 15, 5, 12, 0, 7.5, mat='sand', tex='adobe', role='house', contour=True,
          decals=(('front', (7.5, 10.5, 0, 3.6, 'arch')), ('front', (3.8, 4.8, 4.2, 6.2, 'win')), ('front', (13.2, 14.2, 4.2, 6.2, 'win'))))
    s.box(2.4, 15.6, 4.4, 12.6, 7.5, 8.4, mat='sand', tex='plain', role='misc', contour=True)
    s.box(19, 31, 4, 12, 0, 6, mat='plaster', tex='plain', role='house', contour=True,
          decals=(('front', (23.5, 26.5, 0, 3.6, 'arch')),))
    s.add(E.Ellip(25, 8, 5.5, 5.8, 4.2, 5.6, mat='plaster', tex='plain', role='house', contour=True))
    s.add(ob.Cyl(25, 8, .5, 10, 14, mat='goldroof', tex='plain', role='roof'))
    # 미나렛
    s.cyl(39, 6, 2.8, 0, 15, mat='plaster', tex='plain', role='tower', contour=True)
    s.cyl(39, 6, 3.6, 12.5, 14, mat='sand', tex='plain', role='tower')
    s.add(ob.Cone(39, 6, 3.8, 14, 21, mat='jade', tex='plain', role='roof', contour=True))
    # 앞쪽 낮은 집
    s.box(6, 16, -3, 1.5, 0, 4.2, mat='sand', tex='adobe', role='house', contour=True,
          decals=(('front', (9.6, 12.4, 0, 3, 'arch')),))
    s.box(5.4, 16.6, -3.6, 2.1, 4.2, 5, mat='sand', tex='plain', role='misc')
    s.box(24, 33, -2.5, 2, 0, 4, mat='plaster', tex='plain', role='house', contour=True,
          decals=(('front', (27.2, 29.8, 0, 2.8, 'arch')),))
    s.box(23.4, 33.6, -3.1, 2.6, 4, 4.8, mat='plaster', tex='plain', role='misc')
    return _done(s, 48, 48, 0, 30)


# ═══════════════════════════════════════════════════════════════════ 폐허
def ruin_city():
    """모래에 묻힌 폐허 성채: 부서진 성벽 조각, 반쯤 묻힌 문루, 모래 언덕."""
    s = Scene()
    # 남은 성벽 조각들 (높이가 들쭉날쭉)
    s.box(4, 20, 18, 24, 0, 8, mat='wstone', tex='brick', role='wall', contour=True)
    s.box(24, 36, 18, 24, 0, 5, mat='wstone', tex='brick', role='wall', contour=True)
    s.box(46, 60, 18, 24, 0, 9.5, mat='wstone', tex='brick', role='wall', contour=True,
          decals=(('front', (51, 54, 3, 7, 'dark')),))
    s.box(4, 10, 2, 18, 0, 7, mat='wstone', tex='brick', role='wall', contour=True)
    s.box(54, 60, 2, 18, 0, 3.5, mat='wstone', tex='brick', role='wall', contour=True)
    # 문루 잔해: 아치 + 한쪽 기둥
    s.box(22, 40, 5, 12, 0, 9, mat='wstone', tex='brick', role='gate', contour=True,
          decals=(('front', (28, 34, 0, 6.5, 'arch')),))
    s.box(22, 27, 5, 12, 9, 12.5, mat='wstone', tex='brick', role='gate', contour=True)
    s.box(36, 40, 5, 12, 9, 10.2, mat='wstone', tex='brick', role='gate', contour=True)
    # 부서진 탑 밑동
    s.box(44, 54, 4, 12, 0, 6, mat='wstone', tex='brick', role='tower', contour=True)
    s.box(45, 49, 5, 9, 6, 9, mat='wstone', tex='brick', role='tower', contour=True)
    # 기와 조각과 기둥
    for (x, y, h) in ((12, 8, 5), (16, 6, 3), (41, 2, 4)):
        s.box(x, x + 1.6, y, y + 1.6, 0, h, mat='redwall', tex='plain', role='misc')
    # 모래 언덕(밑을 덮는다)
    for (cx, cy, rx, ry, rz) in ((14, 12, 14, 8, 4), (38, 14, 12, 7, 3.4), (56, 8, 8, 6, 4), (28, 3, 11, 4, 2.6), (6, 4, 7, 4, 3)):
        s.add(E.Ellip(cx, cy, 0, rx, ry, rz, mat='sand', tex='speck', role='misc'))
    return _done(s, 64, 48, -5, 36)


ICONS = {n: f for n, f in globals().items() if n in (
    'capital', 'fort_city', 'harbor_city', 'castle', 'castle_b', 'large_town', 'large_town_b', 'ruin_city')}
