"""몬스터 수집(포켓몬풍) 월드맵 아이콘 — 정면 카메라용 장면.
마을은 빨강·파랑 지붕 박공집, 회복소(빨간 지붕 + 흰 십자), 상점(파란 지붕), 체육관(큰 지붕 + 문장), 연구소(흰 벽 + 회색 지붕).
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / '_scene3d'))
import numpy as np  # noqa: E402
import oblique as ob  # noqa: E402
import east as E  # noqa: E402
import modsf_kit as M  # noqa: E402
import parts as P  # noqa: E402
from oblique import Scene, box  # noqa: E402

SET = dict(id='monster', name='몬스터 수집')


def grass_fn(x, y):
    g = np.array(ob.MAT['grass'], np.uint8)
    return g[np.clip((1.6 + ob.hsh(x, y, 7) * 1.6).astype(int), 0, len(g) - 1)]


def path_fn(x, y):
    d = np.array(ob.MAT['dirt'], np.uint8)
    return d[np.clip((2 + ob.hsh(x, y, 3) * 2).astype(int), 0, len(d) - 1)]


def home(s, x, y, w=9, d=6, wall=4.0, roof='roofred', rh=3.6, door=True, chimney=False):
    """박공집 — 앞 경사 지붕이 크게 보이고 아래 흰 벽에 문·창."""
    dec = (('front', (x + w / 2 - 1.1, x + w / 2 + 1.1, 0, 3.0, 'door')),) if door else ()
    s.add(box(x, x + w, y, y + d, 0, wall, mat='plaster', tex='plain', role='house', contour=True, decals=dec))
    s.add(ob.gable(x - .8, x + w + .8, y - 1.0, y + d + 1.0, wall, rh / (d / 2 + 1.0), mat=roof, tex='shingle', role='roof', contour=True))
    if chimney:
        s.box(x + 1.4, x + 2.8, y + d * .55, y + d * .55 + 1.4, wall, wall + rh + 1.0, mat='stone', tex='brick', role='misc', contour=True)


def center(s, x, y, w=12, d=7):
    """회복소: 빨간 지붕 큰 집 + 지붕 앞에 흰 십자 간판."""
    M.house_flat(s, x, y, w, d, 5.0, wall='plaster', trim='cred', win=True, door=True)
    cx = x + w / 2
    s.box(cx - 2.2, cx + 2.2, y - .6, y + .2, 5.6, 7.8, mat='plaster', tex='plain', role='misc', contour=True)
    s.box(cx - .5, cx + .5, y - .9, y - .5, 5.9, 7.5, mat='cred', tex='plain', role='misc')
    s.box(cx - 1.6, cx + 1.6, y - .9, y - .5, 6.4, 7.0, mat='cred', tex='plain', role='misc')


def mart(s, x, y, w=10, d=6):
    M.house_flat(s, x, y, w, d, 4.6, wall='plaster', trim='cblue', win=True, door=True)


def lab(s, x, y, w=14, d=8):
    M.house_flat(s, x, y, w, d, 5.4, wall='white', trim='roofgrey', win=True, door=True)
    s.box(x + w - 4, x + w - 1, y + 2, y + 5, 6.2, 8.4, mat='steel', tex='plain', role='misc', contour=True)


def village():
    """시작 마을: 뒤에 연구소, 앞에 빨강·파랑 지붕 집 둘."""
    s = Scene()
    lab(s, 6, 14, 16, 7)
    home(s, 1, 1, 11, 6, wall=3.4, roof='roofred', rh=4.2, chimney=True)
    home(s, 16, 1, 11, 6, wall=3.4, roof='cblue', rh=4.2)
    return s


def large_town():
    """회복소 마을: 뒤에 회복소·상점, 앞에 집 둘, 가운데 나무."""
    s = Scene()
    center(s, 2, 22, 16, 8)
    mart(s, 26, 22, 14, 7)
    home(s, 1, 2, 13, 7, roof='roofred', rh=5, chimney=True)
    home(s, 28, 2, 13, 7, roof='cblue', rh=5)
    M.tree_round(s, 21, 6, 3.0)
    return s



# ════════════════════════════════════════════════════════════════ 공용 부품 (추가)
import math  # noqa: E402
from icons_v9_lib import hx  # noqa: E402


def fence_x(s, x0, x1, y, h=2.4, mat='wood', step=3.0):
    """가로 울타리: 가로대 두 줄 + 기둥."""
    s.box(x0, x1, y, y + .5, h - 1.0, h - .4, mat=mat, tex='plain', role='misc')
    s.box(x0, x1, y, y + .5, .6, 1.1, mat=mat, tex='plain', role='misc')
    for x in np.arange(x0, x1 + .01, step):
        s.box(x - .45, x + .45, y - .1, y + .6, 0, h, mat=mat, tex='plain', role='misc', contour=True)


def fence_y(s, x, y0, y1, h=2.4, mat='wood', step=3.0):
    s.box(x, x + .5, y0, y1, h - 1.0, h - .4, mat=mat, tex='plain', role='misc')
    for y in np.arange(y0, y1 + .01, step):
        s.box(x - .1, x + .6, y - .45, y + .45, 0, h, mat=mat, tex='plain', role='misc', contour=True)


def bush(s, x, y, r=2.6, z=0.0, mat='leaf2'):
    """둥근 활엽수(잎 점 결)."""
    s.cyl(x, y, .7, z, z + r * .9, mat='wood', tex='plain', role='misc')
    s.add(E.Ellip(x, y, z + r * 1.35, r, r * .85, r * .95, mat=mat, tex='speck', role='misc', contour=True))


def pine(s, x, y, h=11.0, r=3.4, z=0.0):
    """침엽수: 줄기 + 원뿔 두 단."""
    s.cyl(x, y, .7, z, z + h * .3, mat='wood', tex='plain', role='misc')
    s.add(ob.Cone(x, y, r, z + h * .22, z + h * .72, mat='leaf2', tex='speck', role='misc', contour=True))
    s.add(ob.Cone(x, y, r * .72, z + h * .5, z + h, mat='leaf2', tex='speck', role='misc', contour=True))


def emblem(s, cx, y, z, r=2.2):
    """몬스터 볼 문장: 흰 원판 + 위 절반 빨강 + 가운데 검은 띠·흰 단추 (앞면에 붙는 얇은 판)."""
    s.box(cx - r, cx + r, y - .5, y, z, z + 2 * r, mat='white', tex='plain', role='misc', contour=True)
    s.box(cx - r + .3, cx + r - .3, y - .7, y - .4, z + r + .3, z + 2 * r - .3, mat='cred', tex='plain', role='misc')
    s.box(cx - r + .3, cx + r - .3, y - .7, y - .4, z + r - .3, z + r + .3, mat='steel', tex='plain', role='misc')
    s.box(cx - .6, cx + .6, y - .9, y - .6, z + r - .6, z + r + .6, mat='white', tex='plain', role='misc')


def gym(s, x, y, w, d, wall=7.0, roof='orange', rs=.55, plinth=1.2):
    """체육관: 기단 + 흰 벽(유리 문) + 큰 우진각 지붕 + 지붕 앞 문장 간판."""
    cx = x + w / 2
    s.box(x - 1, x + w + 1, y - 1.5, y + d + 1, 0, plinth, mat='stone', tex='brick', role='misc', contour=True)
    dec = (('front', (cx - 2.2, cx + 2.2, plinth, plinth + 4.2, 'glass')),
           ('front', (x + 2, x + 4.5, plinth + 2.6, plinth + 4.6, 'glass')),
           ('front', (x + w - 4.5, x + w - 2, plinth + 2.6, plinth + 4.6, 'glass')))
    s.box(x, x + w, y, y + d, plinth, plinth + wall, mat='plaster', tex='plain', role='house', contour=True, decals=dec)
    s.box(x - .3, x + w + .3, y - .3, y + d + .3, plinth + wall - 1.2, plinth + wall, mat=roof, tex='plain', role='misc')
    s.add(ob.hip(x - 1.6, x + w + 1.6, y - 1.6, y + d + 1.6, plinth + wall, rs, mat=roof, tex='shingle', role='roof', contour=True))
    emblem(s, cx, y - 1.7, plinth + wall + .4, r=2.6)
    return plinth + wall


def radio_tower(s, xc, yc, h=40, r0=3.6):
    """라디오 타워: 적백 줄무늬 원뿔대 + 전망층(창 띠) + 안테나."""
    M.add(s, M.Frustum(xc, yc, r0, r0 * .45, 0, h, mat='cred', role='tower', contour=True), M.band_swap(0, 4, 'white'))
    zc = h * .7
    M.add(s, M.Frustum(xc, yc, r0 * 1.15, r0 * 1.15, zc, zc + 4, mat='white', role='tower', contour=True),
          M.cyl_windows(xc, yc, r0, zc + 1, zc + 3, pz=3, cols=10, ramp='glass', lit_p=.0, seed=4))
    M.add(s, M.Frustum(xc, yc, r0 * 1.3, r0 * 1.3, zc + 4, zc + 5, mat='cred', role='tower', contour=True))
    s.box(xc - .5, xc + .5, yc - .5, yc + .5, h, h + 7, mat='steel', tex='plain', role='misc')
    s.box(xc - .7, xc + .7, yc - .7, yc + .7, h + 7, h + 8, mat='cred', tex='plain', role='misc')


def dept_store(s, x, y, w, d, h):
    """고층 백화점: 흰 벽 + 유리 창 격자 + 옥상 간판."""
    M.bldg(s, x, y, w, d, h, mat='white', ramp='glass', lit_p=.0, seed=7)
    s.box(x - .4, x + w + .4, y - .4, y + d + .4, h, h + 1, mat='roofgrey', tex='plain', role='roof', contour=True)
    s.box(x + 1.5, x + w - 1.5, y + d * .4, y + d * .4 + .8, h + 1, h + 4.5, mat='cblue', tex='plain', role='misc', contour=True)
    s.box(x + w / 2 - 2.4, x + w / 2 + 2.4, y - .6, y, 0, 3.6, mat='glass', tex='plain', role='misc')


# ════════════════════════════════════════════════════════════════ 장면 (추가)
def village_b():
    """숲속 오두막 마을: 통나무 오두막 둘 + 둘레 침엽수."""
    s = Scene()
    pine(s, 4, 15, 13, 3.2)
    pine(s, 25, 17, 14, 3.4)
    pine(s, 15, 19, 11, 3.0)
    for (x, y, w, roof) in ((2, 2, 10, 'cgreen'), (16, 6, 10, 'roofred')):
        dec = (('front', (x + w / 2 - 1.1, x + w / 2 + 1.1, 0, 3.0, 'door')), ('front', (x + 1.2, x + 3, 1.6, 3.0, 'glass')))
        s.add(box(x, x + w, y, y + 6, 0, 3.6, mat='wood', tex='plank', role='house', contour=True, decals=dec))
        s.add(ob.gable(x - .8, x + w + .8, y - 1, y + 7, 3.6, 4.0 / 4.0, mat=roof, tex='shingle', role='roof', contour=True))
    s.box(12.6, 14.4, 1, 3, 0, 4.5, mat='stone', tex='brick', role='misc', contour=True)
    return s


def large_town_b():
    """농장 마을: 붉은 헛간 + 풍차 + 살림집 + 목장 울타리."""
    s = Scene()
    # 헛간 (뒤 왼쪽)
    s.add(box(1, 17, 18, 28, 0, 7.5, mat='cred', tex='plank', role='house', contour=True,
              decals=(('front', (6, 12, 0, 5.4, 'door')),)))
    s.add(box(5.4, 12.6, 17.6, 18, 5.4, 6.2, mat='white', tex='plain', role='misc'))
    s.add(ob.gable(.2, 17.8, 17.2, 28.8, 7.5, 5.0 / 5.8, mat='roofgrey', tex='shingle', role='roof', contour=True))
    # 풍차 (뒤 오른쪽): 원뿔대 몸통 + 원뿔 지붕 + 날개 넷
    xc, yc = 31, 22
    M.add(s, M.Frustum(xc, yc, 4.2, 3.0, 0, 15, mat='plaster', role='tower', contour=True))
    s.add(ob.Cone(xc, yc, 4.0, 15, 20, mat='roofred', tex='shingle', role='roof', contour=True))
    hub = np.array([xc, yc - 4.6, 15.5])
    s.add(M.Dome(hub[0], hub[1], hub[2], 1.1, zmin=-99, mat='wood', role='misc', contour=True))
    for ang in (math.pi / 4, 3 * math.pi / 4, 5 * math.pi / 4, 7 * math.pi / 4):
        R = M.rot_y(ang)
        dvec = R @ np.array([0, 0, 1.0])
        c = hub + dvec * 4.4 + np.array([0, -.4, 0])
        s.add(M.obox(c, (2.6, .6, 7.0), R, mat='white', tex='plain', role='blade', contour=True))
    # 살림집 (앞)
    home(s, 22, 2, 11, 6, wall=3.8, roof='cblue', rh=4.4, chimney=True)
    # 목장 울타리 (앞 왼쪽) + 건초
    fence_x(s, 0, 18, 1)
    fence_y(s, 0, 1, 13)
    fence_y(s, 18, 1, 9)
    s.cyl(7, 9, 1.8, 0, 2.6, mat='thatch', tex='speck', role='misc', contour=True)
    s.cyl(12, 7, 1.6, 0, 2.4, mat='thatch', tex='speck', role='misc', contour=True)
    return s


def camp():
    """캠핑장·사파리 입구: 파랑·주황 천막 둘 + 안내 간판 + 모닥불."""
    s = Scene()
    s.add(M.tent_ridge_y(1, 13, 8, 18, 9, mat='cblue'))
    s.add(M.tent_ridge_y(15, 25, 11, 19, 7.5, mat='orange'))
    # 안내 간판(앞 오른쪽)
    s.box(19.2, 20.2, 0, 1, 0, 6.5, mat='wood', tex='plain', role='misc')
    s.box(26.0, 27.0, 0, 1, 0, 6.5, mat='wood', tex='plain', role='misc')
    s.box(18.4, 27.8, -.4, .4, 3.2, 7.4, mat='wood', tex='plank', role='misc', contour=True,
          decals=(('front', (19.8, 26.4, 4.6, 5.0, 'dark')), ('front', (19.8, 24.6, 5.8, 6.2, 'dark'))))
    # 모닥불: 돌 둘레 + 장작 + 불
    s.cyl(10, 2.5, 2.4, 0, .8, mat='stone', tex='plain', role='misc', contour=True)
    s.box(8.4, 11.6, 1.9, 3.1, .8, 1.5, mat='wood', tex='plain', role='misc')
    s.add(ob.Cone(10, 2.5, 1.5, .8, 4.6, mat='ember', tex='plain', role='nocast'))
    s.add(ob.Cone(10, 2.2, .8, 1.2, 3.4, mat='gold', tex='plain', role='nocast'))
    s.box(1, 2, 2, 3, 0, 2.2, mat='wood', tex='plain', role='misc', contour=True)
    return s


def tower_small():
    """등대: 바위 받침 + 적백 원뿔대 + 전망 난간 + 불 켜진 등실 + 빨간 고깔."""
    s = Scene()
    xc, yc = 6, 3
    s.add(E.Ellip(xc, yc, .5, 3.4, 2.4, 2.0, mat='rock', tex='speck', role='misc', contour=True))
    M.add(s, M.Frustum(xc, yc, 2.5, 1.8, 1.5, 17, mat='white', role='tower', contour=True), M.band_swap(1.5, 4, 'cred'))
    M.add(s, M.Frustum(xc, yc, 2.6, 2.6, 17, 18, mat='steel', role='tower', contour=True))
    M.add(s, M.Frustum(xc, yc, 1.8, 1.8, 18, 20.6, mat='glass', role='misc', contour=True),
          M.cyl_windows(xc, yc, 2.0, 18.3, 20.4, pz=3, cols=6, ramp='glass', lit_p=1.0, seed=1))
    s.add(ob.Cone(xc, yc, 2.4, 20.6, 23.6, mat='cred', tex='plain', role='roof', contour=True))
    s.add(box(xc - .6, xc + .6, yc - 2.4, yc - 2.0, 4, 6.2, mat='glass', tex='plain', role='misc'))
    return s


def tower_great():
    """방울탑: 돌 기단 위 오층 목탑(층마다 기와 처마) + 꼭대기 금 방울."""
    s = Scene()
    xc, yc = 14, 8
    s.box(xc - 10, xc + 10, yc - 6, yc + 6, 0, 2.2, mat='stone', tex='brick', role='wall', contour=True)
    for i in range(3):
        s.box(xc - 3.5, xc + 3.5, yc - 9.6 + i * .9, yc - 6.9, 0, .8 + i * .7, mat='plaster', tex='plain', role='misc', contour=True)
    z = 2.2
    tiers = ((7.4, 5.0, 6.2, 2.2, 3.0), (6.4, 4.4, 5.2, 2.0, 2.8), (5.6, 3.9, 4.8, 1.9, 2.6),
             (4.8, 3.4, 4.4, 1.7, 2.4), (4.0, 2.9, 4.2, 1.5, 3.4))
    for i, (hw, hd, h, ov, rise) in enumerate(tiers):
        dec = (('front', (xc - 1.2, xc + 1.2, z + .4, z + h - .8, 'reddoor' if i == 0 else 'lat')),)
        s.box(xc - hw, xc + hw, yc - hd, yc + hd, z, z + h, mat='wood', tex='plank', role='wall', contour=True, decals=dec)
        E.pillars(s, xc - hw - .2, xc + hw + .2, yc - hd, z, z + h, 3, mat='redwall', w=1.1, d=.8)
        E.tile_roof(s, xc - hw - ov, xc + hw + ov, yc - hd - ov, yc + hd + ov, z + h, rise, mat='tile', tips=1.0)
        z += h + rise * .5
    s.add(ob.Cyl(xc, yc, .45, z, z + 4.5, mat='goldroof', tex='plain', role='roof'))
    s.add(E.Ellip(xc, yc, z + 6.2, 2.2, 2.0, 2.4, mat='goldroof', tex='plain', role='roof', contour=True))
    s.add(ob.Cyl(xc, yc, 1.0, z + 3.6, z + 4.4, mat='goldroof', tex='plain', role='roof'))
    return s


def cave():
    """달맞이산 동굴: 둥근 바위산 + 아치 입구 + 오른쪽 사다리."""
    s = Scene()
    s.add(E.Ellip(15, 14, 4, 12, 9, 13, mat='basalt', tex='speck', role='wall', contour=True))
    s.add(E.Ellip(6, 9, 2, 5, 5.5, 8, mat='basalt', tex='speck', role='wall', contour=True))
    s.add(E.Ellip(24, 8, 2, 4.8, 5.5, 7, mat='basalt', tex='speck', role='wall', contour=True))
    s.box(8.5, 19.5, 1.6, 6, 0, 8.5, mat='basalt', tex='speck', role='house', contour=True,
          decals=(('front', (10.5, 17.5, 0, 7.2, 'arch')),))
    # 사다리(입구 오른쪽 바위에 기대 선)
    for x in (20.6, 23.0):
        s.box(x, x + .7, 1.2, 1.9, 0, 12.5, mat='wood', tex='plain', role='misc', contour=True)
    for z in np.arange(1.5, 12.0, 2.0):
        s.box(20.6, 23.7, 1.0, 1.6, z, z + .6, mat='wood', tex='plain', role='misc')
    # 달 바위(밝은 돌 하나)
    s.add(E.Ellip(5, 1.5, 1.4, 2.2, 1.8, 1.6, mat='stone', tex='plain', role='misc', contour=True))
    return s


def ruin():
    """알프 유적: 계단식 돌 기단 + 기호 새긴 석판 셋."""
    s = Scene()
    s.box(1, 27, 4, 18, 0, 2.2, mat='wstone', tex='brick', role='wall', contour=True)
    s.box(4, 24, 7, 18, 2.2, 4.4, mat='wstone', tex='brick', role='wall', contour=True,
          decals=(('front', (12, 16, 2.2, 4.4, 'arch')),))
    for i in range(3):
        s.box(12, 16, 1.2 + i * 1.0, 4.2, 0, .7 + i * .75, mat='wstone', tex='plain', role='misc', contour=True)
    glyph = lambda x, z: (('front', (x + .8, x + 1.4, z + 1.0, z + 4.4, 'dark')), ('front', (x + 1.4, x + 3.0, z + 3.8, z + 4.4, 'dark')),
                          ('front', (x + 2.4, x + 3.0, z + 1.0, z + 3.0, 'dark')), ('front', (x + 1.4, x + 2.4, z + 1.0, z + 1.6, 'dark')))
    for (x, y, z, h) in ((6, 12, 4.4, 9.5), (12.4, 14, 4.4, 11.5), (19, 12, 4.4, 9.0)):
        s.box(x, x + 3.8, y, y + 1.6, z, z + h, mat='stone', tex='plain', role='misc', contour=True, decals=glyph(x, z + h - 6.4))
    s.box(22, 26, 0, 3, 0, 1.6, mat='wstone', tex='brick', role='misc', contour=True)
    return s


def _pylon(s, xc, yc, h=26):
    """송전 철탑: 네 다리 + 가로대 + 팔."""
    for dx in (-2.2, 1.6):
        s.box(xc + dx - .2, xc + dx + .9, yc - .5, yc + .5, 0, h, mat='steel', tex='plain', role='misc', contour=True)
    for z in np.arange(3, h - 1, 4.5):
        s.box(xc - 2.2, xc + 2.2, yc - .2, yc + .2, z, z + .6, mat='steel', tex='plain', role='misc')
    for z, wdt in ((h - 6, 5.5), (h - 1.5, 4.0)):
        s.box(xc - wdt, xc + wdt, yc - .3, yc + .3, z, z + .8, mat='steel', tex='plain', role='misc', contour=True)
    s.box(xc - .9, xc + .3, yc - .3, yc + .3, h, h + 3, mat='steel', tex='plain', role='misc')


def ruin_city():
    """버려진 발전소: 녹슨 공장동(깨진 창) + 굴뚝 둘 + 송전 철탑 + 녹슨 탱크."""
    s = Scene()
    rng = np.random.RandomState(5)
    # 뒤: 큰 공장동 (톱날 지붕)
    p = box(2, 34, 16, 28, 0, 13, mat='rust', tex='plain', role='house', contour=True)
    p.post = M.chain(M.windows(2, 16, z0=3, ztop=11, px=4, pz=4, lit_p=0, missing=.35, seed=3, band_right=False),
                     M.hole(22, 29, 2, 10, seed=4))
    s.add(p)
    for i in range(4):
        x = 2 + i * 8
        s.add(ob.Poly([((0, -1, 0), -16, 'front'), ((0, 1, 0), 28, 'back'), ((-1, 0, 0), -x, 'left'), ((0, 0, -1), -13, 'bottom'),
                       ((.55, 0, 1), .55 * (x + 8) + 13, 'slope')], mat='oldgrey', tex='plain', role='roof', contour=True))
    # 굴뚝
    for (cx, cy, hgt) in ((38, 24, 22), (44, 22, 18)):
        M.add(s, M.Frustum(cx, cy, 2.6, 2.0, 0, hgt, mat='rust', role='tower', contour=True),
              M.with_ramp(M.bands(2, 4, 1, -1, ('side',)), 'rust'))
        M.add(s, M.Frustum(cx, cy, 2.4, 2.4, hgt, hgt + 1.2, mat='oldgrey', role='tower', contour=True))
    # 앞: 무너진 사무동 + 녹슨 탱크
    q = M.broken(5, 18, 3, 11, 12, tilts=((.45, .1), (-.6, 0)), drops=(0, 4), mat='oldgrey', tex='plain', role='house', contour=True)
    q.post = M.windows(5, 3, z0=2.2, ztop=10, px=3, pz=3, lit_p=0, missing=.5, seed=8, band_right=False)
    s.add(q)
    M.add(s, M.Frustum(27, 6, 4.0, 4.0, 0, 7, mat='rust', role='tank', contour=True), M.with_ramp(M.bands(1.5, 3, 1, -1, ('side',)), 'rust'))
    s.add(M.Dome(27, 6, 7, 4.0, mat='rust', role='tank', contour=True))
    _pylon(s, 52, 10, 20)
    M.rubble(s, rng, 0, 50, -2, 2, n=6, hmax=1.8, mats=('concrete', 'rust', 'oldgrey'))
    return s


def shrine():
    """전설 사당: 돌 단 + 가운데 제단(금 구슬) + 기둥 원 + 뒤 신목."""
    s = Scene()
    xc, yc = 22, 14
    s.cyl(xc, yc, 19, 0, 2.0, mat='stone', tex='brick', role='wall', contour=True)
    s.cyl(xc, yc, 8, 2.0, 3.6, mat='stone', tex='brick', role='wall', contour=True)
    s.box(xc - 3.2, xc + 3.2, yc - 2.2, yc + 2.2, 3.6, 7.0, mat='wstone', tex='brick', role='house', contour=True)
    s.box(xc - 4, xc + 4, yc - 3, yc + 3, 7.0, 8.0, mat='wstone', tex='plain', role='house', contour=True)
    s.add(M.Dome(xc, yc, 10.2, 2.2, zmin=-99, mat='cblue', role='misc', contour=True))
    n = 8
    for k in range(n):
        th = 2 * math.pi * (k + .5) / n
        px, py = xc + 15.5 * math.cos(th), yc + 11 * math.sin(th)
        h = 11 if py > yc else 9
        s.cyl(px, py, 1.3, 2.0, 2.0 + h, mat='plaster', tex='brick', role='misc', contour=True)
        s.box(px - 1.8, px + 1.8, py - 1.6, py + 1.6, 2.0 + h, 3.0 + h, mat='plaster', tex='plain', role='misc', contour=True)
    # 뒤 신목(금줄)
    s.cyl(xc + 1, yc + 15, 1.6, 2.0, 11, mat='bark', tex='speck', role='misc', contour=True)
    s.cyl(xc + 1, yc + 15, 1.8, 6.0, 7.0, mat='cloth', tex='plain', role='misc')
    s.add(E.Ellip(xc + 1, yc + 16, 15.5, 9, 5.5, 6, mat='leaf2', tex='speck', role='roof', contour=True))
    s.add(E.Ellip(xc - 6, yc + 15, 12.5, 5, 4, 4, mat='leaf2', tex='speck', role='roof', contour=True))
    s.add(E.Ellip(xc + 8, yc + 15, 12.5, 5, 4, 4, mat='leaf2', tex='speck', role='roof', contour=True))
    # 앞 계단
    for i in range(2):
        s.box(xc - 4, xc + 4, yc - 21 + i * 1.4, yc - 17, 0, 1.0 * (i + 1), mat='wstone', tex='plain', role='misc', contour=True)
    return s


def landmark_nature():
    """거대 나무: 굵은 줄기·뿌리 + 수관 덩이 + 빨강·파랑 열매."""
    s = Scene()
    xc, yc = 23, 10
    s.cyl(xc, yc, 4.0, 0, 12, mat='bark', tex='speck', role='wall', contour=True)
    for (dx, dy, rx) in ((-6, -1, 3.2), (6, 0, 3.0), (0, -4, 2.6)):
        s.add(E.Ellip(xc + dx, yc + dy, 0, rx, 2.4, 2.4, mat='bark', tex='speck', role='misc', contour=True))
    blobs = ((xc, yc + 2, 23, 14, 8, 8.5), (xc - 10, yc, 19, 8.5, 6, 6), (xc + 10, yc + 1, 19, 8.5, 6, 6),
             (xc, yc - 1, 29, 9.5, 6, 5.5), (xc, yc - 2, 17, 10.5, 6, 4.5))
    for b in blobs:
        s.add(E.Ellip(*b, mat='leaf2', tex='speck', role='roof', contour=True))
    rng = np.random.RandomState(3)
    berries = ((xc - 9, 21), (xc - 4, 26), (xc + 3, 28), (xc + 8, 22), (xc + 12, 18), (xc - 13, 17), (xc + 1, 20), (xc - 2, 31), (xc + 5, 31))
    for i, (bx, bz) in enumerate(berries):
        # 가장 앞에 있는 수관 표면 y 를 찾아 그 앞에 붙인다
        fy = 99.0
        for (cx, cy, cz, rx, ry, rz) in blobs:
            q = 1 - ((bx - cx) / rx) ** 2 - ((bz - cz) / rz) ** 2
            if q > 0:
                fy = min(fy, cy - ry * math.sqrt(q))
        mat = 'cred' if i % 3 else 'cblue'
        s.add(E.Ellip(bx, fy - .2, bz, 1.2, .9, 1.2, mat=mat, tex='plain', role='misc', contour=True))
    return s


def circle():
    """바위 원: 둥근 큰 돌 넷(뒤 둘·앞 둘 엇갈림) + 가운데 납작돌."""
    s = Scene()
    s.add(E.Ellip(14, 9, .6, 3.6, 2.8, 1.2, mat='stone', tex='plain', role='misc', contour=True))
    for (x, y, rx, rz) in ((7, 15, 4.4, 6.2), (22, 16, 4.2, 5.8), (5, 3, 4.0, 5.2), (23, 3, 4.3, 5.6)):
        s.add(E.Ellip(x, y, rz * .8, rx, rx * .9, rz, mat='stone', tex='speck', role='misc', contour=True))
    return s


def volcano():
    """불꽃섬 화산: 잘린 현무암 화산 + 붉은 화구 + 용암 줄기 + 기슭 연구소."""
    s = Scene()
    s.add(E.oct_pyr(15, 11, 13, 0, 21, ztrunc=13, mat='basalt', tex='speck', role='wall', contour=True))
    s.add(E.oct_prism(15, 11, 5.6, 12.9, 13.6, mat='ember', tex='plain', role='misc'))
    s.add(E.Ellip(15, 10, 13.6, 5.6, 4.2, 1.2, mat='ember', tex='speck', role='misc'))
    s.add(E.Ellip(13, 4.0, 7.5, 1.4, 1.2, 5.6, mat='ember', tex='speck', role='misc'))
    s.add(E.Ellip(18.5, 5.4, 9.5, 1.2, 1.0, 3.6, mat='ember', tex='speck', role='misc'))
    s.add(E.Ellip(13.5, 12, 15.6, 2.6, 2.2, 2.0, mat='oldgrey', tex='speck', role='nocast', contour=True))
    s.add(E.Ellip(16.8, 13, 17.4, 1.8, 1.6, 1.4, mat='oldgrey', tex='speck', role='nocast', contour=True))
    # 기슭 연구소(흰 벽·회색 지붕)
    M.house_flat(s, 21, -2, 8, 4, 3.4, wall='white', trim='roofgrey', win=False, door=True)
    return s


def floating():
    """하늘 기둥 섬: 구름 위에 뜬 바위섬 + 풀 윗면 + 가운데 높은 돌탑."""
    s = Scene()
    xc, yc = 38, 14
    for (cx, cy, cz, rx, ry, rz) in ((14, 10, 6, 11, 7, 4.5), (62, 8, 5, 12, 7, 4.5), (38, 6, 3, 17, 7, 4)):
        s.add(E.Ellip(cx, cy, cz, rx, ry, rz, mat='cloud', tex='speck', role='nocast', contour=False))
    s.add(E.InvCone(xc, yc, 22, 2, 12, mat='rock', tex='speck', role='wall', contour=True))
    s.add(E.Ellip(xc, yc, 12.2, 23, 13, 2.0, mat='leaf2', tex='speck', role='ground', contour=True))
    zb = 13.5
    # 하늘 기둥: 층진 돌탑
    z = zb
    for (hw, hd, h) in ((8, 6, 6.5), (6.6, 5, 6), (5.4, 4.2, 5.5), (4.4, 3.4, 5)):
        s.box(xc - hw, xc + hw, yc - hd, yc + hd, z, z + h, mat='jade', tex='brick', role='tower', contour=True,
              decals=(('front', (xc - 1.2, xc + 1.2, z + 1.5, z + h - 2, 'arch')),))
        s.box(xc - hw - .8, xc + hw + .8, yc - hd - .8, yc + hd + .8, z + h, z + h + 1.2, mat='stone', tex='plain', role='tower', contour=True)
        z += h + 1.2
    s.add(ob.hip(xc - 4, xc + 4, yc - 3.2, yc + 3.2, z, .9, mat='jade', tex='shingle', role='roof', contour=True))
    for (tx, ty) in ((xc - 17, yc - 2), (xc + 16, yc + 1), (xc - 11, yc - 8)):
        pine(s, tx, ty, 12, 3.0, z=zb - 1.0)
    return s


def plaza_fn(x, y):
    st = np.array(ob.MAT['stone'], np.uint8)
    idx = np.clip((4 + ob.hsh(np.floor(x / 2), np.floor(y / 2), 21) * 2.4).astype(int), 0, 6)
    c = st[idx]
    line = (np.mod(np.floor(x), 4) == 0) | (np.mod(np.floor(y), 4) == 0)
    return np.where(line[:, None], st[3], c)


def capital():
    """대도시: 뒤에 라디오 타워·고층 백화점, 가운데 체육관·회복소·광장 분수, 앞에 상점·집·나무."""
    s = Scene()
    # 광장 + 분수 (가운데)
    s.patch(34, 60, 14, 34, plaza_fn, mat='stone')
    s.cyl(47, 22, 5, .5, 1.8, mat='stone', tex='brick', role='misc', contour=True)
    s.cyl(47, 22, 4, 1.8, 2.0, mat='cwater', tex='plain', role='misc')
    s.cyl(47, 22, 1, 1.8, 5, mat='white', tex='plain', role='misc', contour=True)
    # 맨 뒤: 라디오 타워(왼쪽 뒤) · 백화점(오른쪽 뒤)
    radio_tower(s, 22, 64, 36, 3.6)
    dept_store(s, 52, 58, 18, 10, 26)
    home(s, 74, 62, 11, 7, roof='cblue', rh=4.6)
    home(s, 2, 64, 11, 7, roof='roofred', rh=4.6)
    # 가운데 줄: 체육관(왼쪽) · 회복소(오른쪽)
    gym(s, 4, 36, 26, 12, wall=7.0, roof='orange')
    center(s, 62, 38, 17, 9)
    M.bldg(s, 34, 42, 12, 8, 14, mat='plaster', ramp='glass', lit_p=0, seed=11)
    s.box(33.6, 46.4, 41.6, 50.4, 14, 15, mat='roofgrey', tex='plain', role='roof', contour=True)
    # 앞 줄: 상점 · 집들 · 나무
    mart(s, 4, 6, 15, 8)
    home(s, 22, 3, 11, 7, roof='roofred', rh=4.6, chimney=True)
    home(s, 61, 4, 11, 7, roof='cblue', rh=4.6)
    home(s, 75, 8, 11, 7, roof='roofred', rh=4.6)
    for (tx, ty) in ((36, 6), (56, 7), (84, 30), (3, 26), (58, 30)):
        M.tree_round(s, tx, ty, 2.8)
    return s


def fort_city():
    """체육관 도시: 가운데 큰 체육관(문장·큰 지붕) + 둘레 집 넷 + 흰 울타리."""
    s = Scene()
    gym(s, 13, 22, 32, 14, wall=10.0, roof='cgreen', rs=.75)
    home(s, 3, 44, 10, 6, roof='roofred', rh=4.2)
    home(s, 45, 45, 10, 6, roof='cblue', rh=4.2, chimney=True)
    home(s, 23, 50, 12, 6, roof='cblue', rh=4.4)
    home(s, 3, 4, 11, 6, roof='cblue', rh=4.4)
    home(s, 44, 4, 11, 6, roof='roofred', rh=4.4, chimney=True)
    # 흰 울타리: 앞(가운데 길 비움)·양옆
    fence_x(s, 1, 23, 0, mat='white', step=3)
    fence_x(s, 35, 57, 0, mat='white', step=3)
    fence_y(s, .5, 0, 52, mat='white', step=4)
    fence_y(s, 56.5, 0, 52, mat='white', step=4)
    for (tx, ty) in ((19, 10), (39, 10), (8, 36), (50, 37)):
        M.tree_round(s, tx, ty, 2.6)
    return s


def harbor_city():
    """항구 도시: 뒤에 창고·회복소·집, 앞 부두(널판)에 여객선, 오른쪽 방파제 끝에 등대."""
    s = Scene()
    # 뒤 줄
    for (x, col) in ((2, 'cblue'), (16, 'cred')):
        s.add(box(x, x + 12, 28, 38, 0, 6.5, mat='oldgrey', tex='plank', role='house', contour=True,
                  decals=(('front', (x + 3.5, x + 8.5, 0, 4.8, 'dark')),)))
        s.add(ob.gable(x - .6, x + 12.6, 27.4, 38.6, 6.5, 3.4 / 5.6, mat=col, tex='shingle', role='roof', contour=True))
    center(s, 32, 30, 16, 8)
    home(s, 50, 32, 10, 6, roof='cblue', rh=4.2)
    # 가운데: 상점 + 컨테이너
    mart(s, 40, 14, 12, 7)
    M.container(s, 6, 14, 0, 'cred', 9, 3, 3)
    M.container(s, 7, 14.2, 3, 'cyellow', 8, 2.6, 2.8)
    M.container(s, 18, 15, 0, 'cblue', 9, 3, 3)
    M.tree_round(s, 66, 32, 2.6)
    M.tree_round(s, 56, 16, 2.4)
    # 부두(앞, 칸 아래로) + 말뚝
    s.box(0, 44, -2, 4, 0, 1.0, mat='wood', tex='plank', role='misc', contour=True)
    s.box(28, 36, -12, -2, 0, 1.0, mat='wood', tex='plank', role='misc', contour=True)
    for px in (1, 10, 19, 28, 34.5, 44):
        s.box(px, px + 1.4, -2.6 if px not in (28, 34.5) else -12.6, -1.4 if px not in (28, 34.5) else -11.4, -1, 2.6,
              mat='wood', tex='plain', role='misc')
    # 여객선 (부두 왼쪽 앞에 댐): 흰 선체 + 파란 띠 + 선실 + 빨간 굴뚝
    hull = E.hull(2, 26, -13, -6, 0, 4, rise=.8, mat='white', tex='plain', role='misc', contour=True,
                  decals=(('front', (0, 30, 1.2, 2.2, 'glass')),))
    s.add(hull)
    s.box(7, 21, -11.5, -7.5, 4, 7.5, mat='white', tex='plain', role='house', contour=True,
          decals=(('front', (8, 20, 5.2, 6.4, 'glass')),))
    s.box(9, 18, -10.5, -8, 7.5, 9.6, mat='white', tex='plain', role='house', contour=True)
    M.add(s, M.Frustum(15, -9, 1.4, 1.4, 9.6, 13, mat='cred', role='misc', contour=True))
    # 방파제 + 등대 (오른쪽 앞)
    s.box(47, 69, -8, -2, 0, 2.2, mat='stone', tex='brick', role='misc', contour=True)
    xc, yc = 63, -5
    M.add(s, M.Frustum(xc, yc, 3.2, 2.2, 2.2, 20, mat='white', role='tower', contour=True), M.band_swap(2.2, 4.4, 'cred'))
    M.add(s, M.Frustum(xc, yc, 3.2, 3.2, 20, 21, mat='steel', role='tower', contour=True))
    M.add(s, M.Frustum(xc, yc, 2.0, 2.0, 21, 23.6, mat='glass', role='misc', contour=True),
          M.cyl_windows(xc, yc, 2.0, 21.3, 23.4, pz=3, cols=6, ramp='glass', lit_p=1.0, seed=1))
    s.add(ob.Cone(xc, yc, 2.7, 23.6, 26.8, mat='cred', tex='plain', role='roof', contour=True))
    return s


def castle():
    """리그 본부: 계단식 돌 기단 + 흰 기둥 늘어선 석조 본관 + 파란 지붕·금 문장 + 앞 큰 계단 + 깃발."""
    s = Scene()
    s.box(1, 41, 6, 26, 0, 3, mat='stone', tex='brick', role='wall', contour=True)
    s.box(4, 38, 9, 26, 3, 5.5, mat='stone', tex='brick', role='wall', contour=True)
    # 앞 큰 계단
    for i in range(5):
        s.box(15, 27, -1 + i * 2.0, 9, 0, 1.1 * (i + 1), mat='plaster', tex='plain', role='misc', contour=True)
    z0 = 5.5
    s.box(7, 35, 15, 24, z0, z0 + 11, mat='stone', tex='brick', role='house', contour=True,
          decals=(('front', (18.5, 23.5, z0, z0 + 6.5, 'arch')),))
    for px in (8.2, 12.2, 16.2, 24.8, 28.8, 32.8):
        s.cyl(px, 13.4, 1.2, z0, z0 + 11, mat='plaster', tex='plain', role='misc', contour=True)
    s.box(6, 36, 12, 25, z0 + 11, z0 + 13, mat='white', tex='plain', role='misc', contour=True)
    s.add(ob.hip(5, 37, 11, 26, z0 + 13, .75, mat='cblue', tex='shingle', role='roof', contour=True))
    s.box(18, 24, 10.6, 11.2, z0 + 13.2, z0 + 17.2, mat='gold', tex='plain', role='misc', contour=True)
    s.box(20, 22, 10.3, 10.6, z0 + 14.2, z0 + 16.2, mat='cred', tex='plain', role='misc')
    # 깃대 둘
    for (fx, col) in ((2.5, 'cred'), (35.5, 'cblue')):
        s.box(fx, fx + .7, 2, 2.7, 0, 15, mat='steel', tex='plain', role='misc')
        s.box(fx + .7, fx + 3.6, 2, 2.4, 11.5, 14.5, mat=col, tex='plain', role='misc', contour=True)
    return s


ORDER = [
    ('capital', '대도시', 'capital', (6, 6), '라디오 타워·고층 백화점·체육관·회복소·광장 분수가 모인 큰 도시'),
    ('fort_city', '체육관 도시', 'fort_city', (4, 4), '가운데 큰 체육관(몬스터 볼 문장) + 둘레 집 넷 + 흰 울타리'),
    ('harbor_city', '항구 도시', 'harbor_city', (5, 4), '창고·회복소·상점 + 부두의 여객선 + 방파제 끝 등대'),
    ('castle', '리그 본부', 'castle', (3, 3), '흰 기둥 늘어선 석조 본관·파란 지붕·금 문장 + 앞 큰 계단'),
    ('large_town', '회복소 마을', 'large_town', (3, 3), '회복소(빨간 지붕·십자)·상점(파란 지붕)·집 둘·나무'),
    ('large_town', '농장 마을', 'large_town_b', (3, 3), '붉은 헛간·풍차·살림집 + 목장 울타리·건초'),
    ('village', '시작 마을', 'village', (2, 2), '연구소 하나와 빨강·파랑 지붕 집 둘'),
    ('village', '숲속 오두막 마을', 'village_b', (2, 2), '통나무 오두막 둘 + 둘레 침엽수'),
    ('camp', '캠핑장', 'camp', (2, 2), '파랑·주황 천막 둘 + 안내 간판 + 모닥불'),
    ('tower_small', '등대', 'tower_small', (1, 2), '바위 위 적백 줄무늬 등대'),
    ('tower_great', '방울탑', 'tower_great', (2, 4), '오층 목탑 + 꼭대기 금 방울'),
    ('cave', '달맞이산 동굴', 'cave', (2, 2), '둥근 바위산 + 아치 입구 + 사다리'),
    ('ruin', '알프 유적', 'ruin', (2, 2), '계단식 돌 기단 + 기호 새긴 석판 셋'),
    ('ruin_city', '버려진 발전소', 'ruin_city', (4, 3), '녹슨 톱날 지붕 공장·굴뚝 둘·탱크·송전 철탑'),
    ('shrine', '전설 사당', 'shrine', (3, 3), '둥근 돌 단 + 제단(파란 구슬) + 기둥 원 + 뒤 신목'),
    ('landmark_nature', '열매 거목', 'landmark_nature', (3, 3), '굵은 줄기 + 수관 덩이 + 빨강·파랑 열매'),
    ('circle', '바위 원', 'circle', (2, 2), '둥근 큰 돌 넷 + 가운데 납작돌'),
    ('volcano', '불꽃섬 화산', 'volcano', (2, 2), '용암 화구·줄기 + 연기 + 기슭 연구소'),
    ('floating', '하늘 기둥 섬', 'floating', (5, 4), '구름 위 바위섬 + 층진 돌탑'),
]
