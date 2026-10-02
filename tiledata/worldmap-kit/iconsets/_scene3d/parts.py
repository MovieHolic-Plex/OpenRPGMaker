"""공용 부품 — 사막·동양풍 장면(desert-east/lib/scenes_a·b)에서 옮긴 성벽·문루·모서리 탑·집·나무·안뜰 바닥·초가·게르.
장면 함수(아이콘 하나)는 각 세트 scenes.py 가 쓴다. 이 파일은 부품만."""
import sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import numpy as np  # noqa: E402
import oblique as ob  # noqa: E402
import east as E  # noqa: E402
from oblique import Scene  # noqa: E402


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


def sand_fn(x, y):
    t = ob.hsh(x, y, 12)
    idx = np.clip((2 + t * 3.2).astype(int), 0, 6)
    return np.array(ob.MAT['sand'], np.uint8)[idx]


def thatch_hut(s, x, y, w, d, wh=4.5, rise=5.2, wallmat='sand', door=True):
    dec = (('front', (x + w / 2 - 1.1, x + w / 2 + 1.1, 0, 3.3, 'door')),) if door else ()
    s.box(x, x + w, y, y + d, 0, wh, mat=wallmat, tex='adobe', role='house', contour=True, decals=dec)
    sl = rise / (min(w, d) / 2 + 1)
    s.add(E.hip_t(x - 1.3, x + w + 1.3, y - 1.3, y + d + 1.3, wh, sl, mat='thatch', tex='speck', contour=True, role='roof'))


def yurt(s, xc, yc, r, wh, rise, door=True):
    dec = (('side', (-90, 1.5, 0, wh * .8, 'dark')),) if door else ()
    s.add(ob.Cyl(xc, yc, r, 0, wh, mat='felt', tex='plain', role='house', contour=True, decals=dec))
    s.add(ob.Cyl(xc, yc, r + .15, wh * .55, wh * .75, mat='redwall', tex='plain', role='misc'))
    s.add(ob.Cone(xc, yc, r + 1.2, wh, wh + rise, mat='felt', tex='plain', role='roof', contour=True))
    s.add(ob.Cyl(xc, yc, 1.4, wh + rise - 1.0, wh + rise - .2, mat='wood', tex='plain', role='misc'))


