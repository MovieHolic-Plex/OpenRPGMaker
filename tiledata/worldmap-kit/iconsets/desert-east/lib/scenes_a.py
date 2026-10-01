"""동양·사막풍 아이콘 장면 A: 탑·촌락·천막·단일 랜드마크. 좌표는 월드 단위(=화면 px)."""
import math
import sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import numpy as np  # noqa: E402
import oblique as ob  # noqa: E402
import east as E  # noqa: E402
from oblique import Scene, render, finish  # noqa: E402


def sand_fn(x, y):
    t = ob.hsh(x, y, 12)
    idx = np.clip((2 + t * 3.2).astype(int), 0, 6)
    return np.array(ob.MAT['sand'], np.uint8)[idx]


def _done(s, W, H, ox, oy, shadow=True):
    arr, st = render(s, W, H, ox=ox, oy=oy, shadow=shadow)
    return finish(arr), st


# ──────────────────────────────────────────────────────────────────────────────── 탑
def tower_small():
    """3층 전탑(벽돌 탑): 층마다 벽돌 몸통 + 기와 처마 윗면."""
    s = Scene()
    cx, cy = 6.5, 3.0
    s.box(cx - 5.5, cx + 5.5, 0.2, 6.2, 0, 2.2, mat='greywall', tex='brick', role='wall', contour=True)
    z = 2.2
    for (hw, hd, h, ov, rise) in ((3.4, 2.2, 6.2, 1.5, 2.2), (2.9, 1.9, 4.6, 1.4, 2.0), (2.4, 1.6, 3.8, 1.3, 2.6)):
        s.box(cx - hw, cx + hw, cy - hd, cy + hd, z, z + h, mat='wstone', tex='brick', role='wall', contour=True,
              decals=(('front', (cx - .8, cx + .8, z + h * .3, z + h * .75, 'arch')),) if h > 4 else ())
        E.tile_roof(s, cx - hw - ov, cx + hw + ov, cy - hd - ov, cy + hd + ov, z + h, rise, tips=1.0)
        z += h + rise * .55
    s.add(ob.Cyl(cx, cy, .6, z + .3, z + 2.6, mat='goldroof', tex='plain', role='roof'))
    return _done(s, 16, 32, 0, 28)


def tower_great():
    """9층 팔각 전탑: 층마다 처마 윗면(팔각 지붕)이 보인다."""
    s = Scene()
    xc, yc = 14, 7.5
    s.add(E.oct_prism(xc, yc, 12.5, 0, 2.4, mat='greywall', tex='brick', role='wall', contour=True))
    s.add(E.oct_prism(xc, yc, 9.2, 2.4, 4.4, mat='greywall', tex='brick', role='wall', contour=True))
    z = 4.4
    n = 9
    for i in range(n):
        a = 7.0 - .5 * i
        wh = 3.3 if i < 8 else 3.6
        s.add(E.oct_prism(xc, yc, a, z, z + wh, mat='wstone', tex='brick', role='wall', contour=True,
                          decals=(('front', (xc - .9, xc + .9, z + .6, z + wh - .5, 'win')),) if i < 8 else ()))
        E.oct_roof(s, xc, yc, a + 1.9, z + wh, 2.2, mat='tile', fa=.5, fh=.3, tip=False)
        z += wh + 1.4
    s.add(ob.Cyl(xc, yc, .5, z - 1.0, z + 6, mat='goldroof', tex='plain', role='roof'))
    for k in (1.5, 3.0, 4.3):
        s.add(E.Ellip(xc, yc, z - 1.0 + k, 1.7 - k * .22, 1.7 - k * .22, .7, mat='goldroof', role='roof'))
    return _done(s, 32, 64, 1, 60)


# ──────────────────────────────────────────────────────────────────────────────── 촌락
def _thatch_hut(s, x, y, w, d, wh=4.5, rise=5.2, wallmat='sand', door=True):
    dec = (('front', (x + w / 2 - 1.1, x + w / 2 + 1.1, 0, 3.3, 'door')),) if door else ()
    s.box(x, x + w, y, y + d, 0, wh, mat=wallmat, tex='adobe', role='house', contour=True, decals=dec)
    sl = rise / (min(w, d) / 2 + 1)
    s.add(E.hip_t(x - 1.3, x + w + 1.3, y - 1.3, y + d + 1.3, wh, sl, mat='thatch', tex='speck', contour=True, role='roof'))


def village():
    """초가 촌락: 흙벽 + 짚 우진각 지붕 세 채, 장독."""
    s = Scene()
    _thatch_hut(s, 2, 1, 10, 7, wh=4.2, rise=5.2)
    _thatch_hut(s, 17, 2, 9, 6, wh=4.0, rise=4.8)
    _thatch_hut(s, 9, 11, 9, 6, wh=3.8, rise=4.6)
    s.cyl(15, 1, 1.3, 0, 2.6, mat='wood', tex='plain', role='misc', contour=True)
    s.cyl(1.2, 10, 1.1, 0, 2.2, mat='wood', tex='plain', role='misc', contour=True)
    # 마당 울타리 한 칸
    s.box(21, 30, -0.2, 0.6, 0, 2.2, mat='wood', tex='plank', role='misc')
    return _done(s, 32, 32, 0, 26)


def village_b():
    """사막 흙벽 마을: 평지붕 흙집 + 돔 한 채 + 야자."""
    s = Scene()
    s.box(2, 12, 1, 8, 0, 6, mat='sand', tex='adobe', role='house', contour=True,
          decals=(('front', (6, 8, 0, 3.4, 'arch')), ('front', (3.2, 4.6, 3.2, 5, 'win')), ('front', (9.4, 10.8, 3.2, 5, 'win'))))
    s.box(1.4, 12.6, 0.4, 8.6, 6, 6.8, mat='sand', tex='plain', role='misc', contour=True)
    s.box(15, 25, 3, 9, 0, 4.5, mat='sand', tex='adobe', role='house', contour=True,
          decals=(('front', (19, 21, 0, 3, 'arch')),))
    s.box(14.4, 25.6, 2.4, 9.6, 4.5, 5.2, mat='sand', tex='plain', role='misc', contour=True)
    # 돔
    s.add(E.Ellip(8.5, 14, 3.5, 4.6, 4.2, 5.0, mat='plaster', tex='plain', role='house', contour=True))
    s.box(6, 11, 9.8, 12, 0, 4, mat='sand', tex='adobe', role='house', contour=True,
          decals=(('front', (7.6, 9.4, 0, 2.8, 'arch')),))
    # 야자
    s.cyl(27.3, 10, .7, 0, 11, mat='bark', tex='speck', role='misc')
    s.add(E.Ellip(27.3, 10, 11.4, 4.2, 3.4, 1.1, mat='leaf2', tex='speck', role='misc', contour=True))
    return _done(s, 32, 32, 0, 26)


# ──────────────────────────────────────────────────────────────────────────────── 야영
def _yurt(s, xc, yc, r, wh, rise, door=True):
    dec = (('side', (-90, 1.5, 0, wh * .8, 'dark')),) if door else ()
    s.add(ob.Cyl(xc, yc, r, 0, wh, mat='felt', tex='plain', role='house', contour=True, decals=dec))
    s.add(ob.Cyl(xc, yc, r + .15, wh * .55, wh * .75, mat='redwall', tex='plain', role='misc'))
    s.add(ob.Cone(xc, yc, r + 1.2, wh, wh + rise, mat='felt', tex='plain', role='roof', contour=True))
    s.add(ob.Cyl(xc, yc, 1.4, wh + rise - 1.0, wh + rise - .2, mat='wood', tex='plain', role='misc'))


def camp():
    """유목 게르 야영: 흰 펠트 게르 둘 + 불."""
    s = Scene()
    _yurt(s, 10, 7, 7, 5.5, 5.0)
    _yurt(s, 23, 5, 5, 4.2, 4.0)
    s.add(ob.Cyl(18.2, -0.5, 1.5, 0, .6, mat='ember', tex='plain', role='misc'))
    s.box(3, 3.8, -1.5, -0.8, 0, 9, mat='wood', tex='plain', role='misc')
    s.box(3.8, 8, -1.5, -0.8, 6, 9, mat='cloth', tex='plain', role='misc')
    return _done(s, 32, 32, 0, 27)


def camp_b():
    """검은 펠트 게르 야영: 짙은 갈색 게르 둘(붉은 문)과 낙타 대신 짐 더미, 깃대."""
    s = Scene()
    for (x, y, r, wh, rise) in ((9, 7, 6.4, 4.6, 6.4), (22, 4, 4.6, 3.6, 5.4)):
        s.add(ob.Cyl(x, y, r, 0, wh, mat='bark', tex='plain', role='house', contour=True,
                     decals=(('side', (-90, 1.4, 0, wh * .8, 'dark')),)))
        s.add(ob.Cyl(x, y, r + .15, wh * .5, wh * .72, mat='felt', tex='plain', role='misc'))
        s.add(ob.Cone(x, y, r + 1.1, wh, wh + rise, mat='bark', tex='plain', role='roof', contour=True))
        s.add(ob.Cyl(x, y, 1.3, wh + rise - .9, wh + rise - .2, mat='felt', tex='plain', role='misc'))
    s.box(15, 18.5, -1.2, 1.2, 0, 2.2, mat='thatch', tex='speck', role='misc', contour=True)
    s.box(2, 2.8, -1.5, -.7, 0, 13, mat='wood', tex='plain', role='misc')
    s.box(2.8, 6.4, -1.5, -.7, 9.5, 12.5, mat='cloth', tex='plain', role='misc')
    return _done(s, 32, 32, 0, 24)


# ──────────────────────────────────────────────────────────────────────────────── 지형 랜드마크
def cave():
    """석굴 사원: 사암 절벽에 판 석굴 입구 위에 처마."""
    s = Scene()
    s.add(E.Ellip(15, 9, 7, 13.5, 7.5, 9.0, mat='sand', tex='strata', role='wall', contour=True))
    s.add(E.Ellip(6.5, 8, 5, 6.5, 5.5, 6.0, mat='sand', tex='strata', role='wall', contour=True))
    s.add(E.Ellip(24, 8, 5, 6.5, 5.5, 5.8, mat='sand', tex='strata', role='wall', contour=True))
    s.box(10.5, 20, -1.2, 2.2, 0, 8.0, mat='wstone', tex='brick', role='house', contour=True,
          decals=(('front', (13.2, 17.4, 0, 6.0, 'arch')),))
    E.tile_roof(s, 8.8, 21.8, -3.6, 3.0, 8.0, 3.2, mat='tile', tips=1.2)
    s.box(10.2, 11.5, -2.8, -1.6, 0, 8.0, mat='redwall', tex='plain', role='misc')
    s.box(18.6, 19.9, -2.8, -1.6, 0, 8.0, mat='redwall', tex='plain', role='misc')
    return _done(s, 32, 32, 1, 26)


def ruin():
    """무너진 석탑·폐사지: 층이 떨어져 나간 석탑 밑동과 흩어진 석재."""
    s = Scene()
    cx, cy = 14, 5
    s.box(cx - 8, cx + 8, cy - 4.5, cy + 4.5, 0, 2.0, mat='greywall', tex='brick', role='wall', contour=True)
    s.box(cx - 5, cx + 5, cy - 3, cy + 3, 2.0, 7.0, mat='wstone', tex='brick', role='wall', contour=True,
          decals=(('front', (cx - 1.2, cx + 1.2, 2.2, 5.4, 'arch')),))
    s.box(cx - 6.2, cx + 6.2, cy - 4, cy + 4, 7.0, 8.2, mat='greywall', tex='brick', role='wall', contour=True)
    # 부서진 2층: 뒤쪽 벽만 남음
    s.box(cx - 3.8, cx + 1, cy - 1, cy + 2.4, 8.2, 13, mat='wstone', tex='brick', role='wall', contour=True)
    s.box(cx + 1, cx + 3.8, cy + 1, cy + 2.4, 8.2, 10, mat='wstone', tex='brick', role='wall', contour=True)
    # 떨어진 지붕돌·기와·돌
    s.box(cx + 7.5, cx + 12.5, cy - 5, cy - 1, 0, 2.6, mat='greywall', tex='brick', role='misc', contour=True)
    s.box(cx - 13, cx - 9, cy - 5, cy - 1.5, 0, 1.8, mat='wstone', tex='brick', role='misc', contour=True)
    s.add(E.hip_t(cx - 2, cx + 3, cy - 8.5, cy - 5, 0, .8, mat='tile', contour=True, role='misc'))
    return _done(s, 32, 32, 0, 25)


def circle():
    """석등과 선돌 군."""
    s = Scene()
    for (x, y, w, h) in ((1, 9, 3.4, 11), (23, 8, 3.6, 12), (5.5, 1.0, 3.2, 8)):
        s.add(ob.box(x, x + w, y, y + 2.8, 0, h, mat='greywall', tex='plain', role='misc', contour=True))
        s.add(ob.box(x + .5, x + w - .5, y + .4, y + 2.4, h, h + 1.2, mat='greywall', tex='plain', role='misc', contour=True))
    # 석등 (가운데 앞)
    s.cyl(15, 4.5, 4.2, 0, 1.6, mat='wstone', tex='brick', role='misc', contour=True)
    s.cyl(15, 4.5, 1.5, 1.6, 7, mat='wstone', tex='brick', role='misc', contour=True)
    s.box(12.2, 17.8, 2, 7, 7, 11, mat='wstone', tex='plain', role='house', contour=True,
          decals=(('front', (13.6, 16.4, 8, 10, 'gold')),))
    E.tile_roof(s, 10.2, 19.8, .2, 9, 11, 3.0, mat='tile', tips=0)
    return _done(s, 32, 32, 0, 24)


def volcano():
    """화산 제단: 잘린 화구에서 붉은 용암이 보이는 화산 + 비탈 아래 작은 제단."""
    s = Scene()
    s.add(E.oct_pyr(13, 9, 13, 0, 21, ztrunc=14, mat='basalt', tex='speck', role='wall', contour=True))
    s.add(E.oct_prism(13, 9, 5.2, 13.9, 14.6, mat='ember', tex='plain', role='misc'))
    s.add(E.Ellip(13, 8, 14.6, 5.2, 4.0, 1.0, mat='ember', tex='speck', role='misc'))
    s.add(E.Ellip(14, 3.2, 6.5, 1.5, 1.2, 4.6, mat='ember', tex='speck', role='misc'))
    s.box(3, 12, -2.8, 2.6, 0, 1.4, mat='greywall', tex='brick', role='misc', contour=True)
    s.box(4.4, 10.6, -1.8, 1.6, 1.4, 5, mat='redwall', tex='plain', role='house', contour=True,
          decals=(('front', (6.4, 8.6, 1.4, 4, 'dark')),))
    E.tile_roof(s, 3, 12, -3.4, 2.6, 5, 3, mat='goldroof', tips=1.2)
    return _done(s, 32, 32, 1, 26)


def landmark_nature():
    """신목: 붉은 금줄을 두른 거목과 늘어진 끈."""
    s = Scene()
    s.cyl(24, 10, 4.6, 0, 10, mat='bark', tex='speck', role='wall', contour=True)
    s.cyl(24, 10, 4.9, 4.6, 6.6, mat='cloth', tex='plain', role='misc')
    # 수관 덩어리들
    for (x, y, z, rx, ry, rz) in ((24, 12, 20, 14, 8, 9), (15, 10, 17, 9, 6, 6.5), (33, 11, 17, 9, 6, 6.5), (24, 8, 27, 9, 6, 6), (24, 9, 15, 11, 7, 5)):
        s.add(E.Ellip(x, y, z, rx, ry, rz, mat='leaf2', tex='speck', role='roof', contour=True))
    for x in (13, 18, 31, 35):
        s.box(x, x + .9, 4, 5, 8.5, 15, mat='cloth', tex='plain', role='misc')
    s.cyl(41, 2, 1.6, 0, 2.2, mat='greywall', tex='brick', role='misc', contour=True)
    return _done(s, 48, 48, 2, 41)


def landmark_baobab():
    """사막 바오바브: 불룩한 줄기와 납작한 수관."""
    s = Scene()
    s.add(E.Ellip(22, 10, 8, 6.4, 5.4, 9, mat='bark', tex='speck', role='wall', contour=True))
    s.cyl(22, 10, 3.2, 12, 20, mat='bark', tex='speck', role='wall', contour=True)
    for (x, y, z, rx, ry, rz) in ((22, 11, 25, 14, 8, 4.5), (13, 9, 22.5, 7, 5, 3.4), (31, 10, 22.5, 7, 5, 3.4)):
        s.add(E.Ellip(x, y, z, rx, ry, rz, mat='leaf2', tex='speck', role='roof', contour=True))
    s.add(E.Ellip(34, 2, 1.8, 3, 2.2, 2, mat='sand', tex='speck', role='misc', contour=True))
    return _done(s, 48, 48, 2, 41)


def floating():
    """구름 위에 뜬 신선의 섬: 바위 밑동 + 풀 윗면 + 전각."""
    s = Scene()
    xc, yc = 38, 18
    s.add(E.InvCone(xc, yc, 24, 0, 13, mat='rock', tex='speck', role='wall', contour=True))
    s.add(E.Ellip(xc, yc, 13.2, 26, 16, 2.2, mat='leaf2', tex='speck', role='ground', contour=True))
    # 윗면 지면(풀)
    s.patch(xc - 22, xc + 22, yc - 13, yc + 13, lambda x, y: np.array(ob.MAT['grass'], np.uint8)[np.clip((ob.hsh(x, y, 5) * 4.2).astype(int), 0, 4)], z=13.0, h=1.0, mat='grass')
    zb = 14.0
    s.box(xc - 11, xc + 11, yc - 6, yc + 5, zb, zb + 1.8, mat='greywall', tex='brick', role='misc', contour=True)
    E.hall(s, xc - 8, yc - 3, 16, 7, 5, 6.5, plat=0, over=2.6, npil=4, wall='plaster', mat='jade') if False else None
    z0 = zb + 1.8
    s.box(xc - 7, xc + 7, yc - 2.5, yc + 3, z0, z0 + 5.5, mat='plaster', tex='plain', role='house', contour=True,
          decals=(('front', (xc - 1.4, xc + 1.4, z0, z0 + 4.2, 'reddoor')),))
    E.pillars(s, xc - 7.3, xc + 7.3, yc - 2.5, z0, z0 + 5.5, 4)
    E.tile_roof(s, xc - 10.5, xc + 10.5, yc - 6, yc + 6.5, z0 + 5.5, 7.5, mat='jade', tips=2.4)
    s.add(ob.Cyl(xc, yc + .2, .6, z0 + 13, z0 + 17, mat='goldroof', tex='plain', role='roof'))
    # 소나무 두 그루
    for tx, ty in ((xc - 17, yc - 2), (xc + 18, yc + 1)):
        s.cyl(tx, ty, .8, z0 - 1.8, z0 + 3, mat='bark', tex='plain', role='misc')
        s.add(ob.Cone(tx, ty, 3.6, z0 + 1, z0 + 10, mat='leaf2', tex='speck', role='roof', contour=True))
    # 구름
    for (cx, cy, cz, rx, ry, rz) in ((16, 12, 6, 12, 7, 5), (60, 10, 5, 14, 8, 5), (38, 8, 3, 18, 8, 4.5)):
        s.add(E.Ellip(cx, cy, cz, rx, ry, rz, mat='cloud', tex='speck', role='misc', contour=False))
    return _done(s, 80, 64, 1, 60)


def shrine():
    """대사원: 높은 기단 + 계단 + 2층 전각."""
    s = Scene()
    s.box(2, 45, 1, 16, 0, 3, mat='greywall', tex='brick', role='wall', contour=True)
    s.box(5, 42, 3, 15, 3, 5, mat='greywall', tex='brick', role='wall', contour=True)
    # 계단
    for i in range(4):
        s.box(20, 28, -4 + i * 1.6, 3 + i * .4, 0, 1.2 + i * 1.2, mat='wstone', tex='plain', role='misc', contour=True)
    # 1층 전각
    z0 = 5
    s.box(8, 39, 5, 12.5, z0, z0 + 6, mat='plaster', tex='plain', role='house', contour=True,
          decals=(('front', (22.2, 24.8, z0, z0 + 4.4, 'reddoor')),))
    E.pillars(s, 7.6, 39.4, 5, z0, z0 + 6, 7)
    E.tile_roof(s, 3.5, 43.5, 1.4, 16.5, z0 + 6, 5.2, mat='jade', tips=2.2)
    # 2층 전각
    z1 = z0 + 6 + 4.0
    s.box(14, 33, 6.5, 12, z1, z1 + 5, mat='plaster', tex='plain', role='house', contour=True,
          decals=(('front', (22.4, 24.6, z1 + .5, z1 + 3.6, 'lat')),))
    E.pillars(s, 13.6, 33.4, 6.5, z1, z1 + 5, 5)
    E.tile_roof(s, 10, 37, 3.2, 15.2, z1 + 5, 7, mat='jade', tips=2.4)
    s.add(ob.Cyl(23.5, 9.2, .6, z1 + 11.5, z1 + 16, mat='goldroof', tex='plain', role='roof'))
    # 양옆 석등
    for x in (16.5, 30):
        s.cyl(x, -1.5, 1.0, 0, 5, mat='greywall', tex='plain', role='misc', contour=True)
        s.box(x - 1.6, x + 1.6, -3, .2, 5, 7.2, mat='wstone', tex='plain', role='misc', contour=True)
    return _done(s, 48, 48, 1, 41)


ICONS = {n: f for n, f in list(globals().items()) if callable(f) and n in (
    'tower_small', 'tower_great', 'village', 'village_b', 'camp', 'camp_b', 'cave', 'ruin', 'circle', 'volcano',
    'landmark_nature', 'landmark_baobab', 'floating', 'shrine')}
