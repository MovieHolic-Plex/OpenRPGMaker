"""현대·SF 아이콘 장면 B: 촌락·캠프·탑·동굴·폐허·시설·부유.  (라운드 2: 큰 스케일, 땅판 제거, 그림자 짧게)"""
import sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import math
import numpy as np
import oblique as ob
from oblique import Scene, box, render, finish
from modsf_kit import *
import modsf_kit as K
from msf_core import icon, done


def pad(s, x0, x1, y0, y1, mat='concrete', h=.8):
    s.add(box(x0, x1, y0, y1, 0, h, mat=mat, tex='plain', role='pad', contour=True))


def cdoor(s, x, y, z, w, h, doorw=3.4):
    s.add(box(x + w - doorw - 1, x + w - 1, y - .35, y, z, z + h - 1, mat='steel', tex='plain', role='gate', contour=False))


def cwin(s, x, y, z, w=3, h=1.8):
    s.add(box(x, x + w, y - .35, y, z, z + h, mat='glass', tex='plain', role='misc', contour=False))


def tank(s, x, y, r, h, mat='steel', cap='dome'):
    add(s, Frustum(x, y, r, r, 0, h, mat=mat, role='tank', contour=True), with_ramp(bands(1.5, 3, 1, -1, ('side',)), mat))
    if cap == 'dome':
        s.add(Dome(x, y, h, r, mat=mat, role='tank', contour=True))


# ════════════════════════════════════════ village 2x2 (2변형) ════════════════════════════════════════
@icon('village_a')
def village_a():
    """컨테이너 촌락: 쌓은 컨테이너 집 + 문 달린 컨테이너 둘 + 급수탑."""
    s = Scene()
    container(s, 1, 9, 0, 'cblue', 13, 6.2, 5.2)
    container(s, 2, 9.2, 5.2, 'cyellow', 11.5, 5.8, 5.2)
    container(s, 14, 0.5, 0, 'cred', 12, 6.4, 5.2)
    cdoor(s, 14, 0.5, 0, 12, 5.2)
    cwin(s, 15.5, .5, 2.4, 3, 1.8)
    container(s, 0, 0.5, 0, 'cgreen', 12, 6.4, 5.2)
    cdoor(s, 0, 0.5, 0, 12, 5.2)
    rooftop(s, 0, .5, 12, 6.4, 5.2, 'ac')
    tank(s, 22, 11, 3.2, 9)
    return done(s, 32, 32)


@icon('village_b')
def village_b():
    """농가: 붉은 헛간 + 사일로 + 살림집."""
    s = Scene()
    s.add(box(0, 14, 7, 17, 0, 7, mat='cred', tex='plain', role='house', contour=True,
              decals=(('front', (4.5, 10, 0, 5.2, 'dark')),)))
    s.add(box(4.5, 10, 6.6, 7, 5.2, 5.8, mat='white', tex='plain', role='misc'))
    s.add(ob.gable(-.8, 14.8, 6.2, 17.8, 7, .55, mat='roofgrey', tex='plain', role='roof', contour=True))
    tank(s, 19.5, 11, 3.4, 12, cap='dome')
    house_gable(s, 15, 0, 11, 7, 4, 4, wall='plaster', roof='roofred')
    tree_s(s, 3, 3, 2.6)
    return done(s, 32, 32)


def tree_s(s, x, y, r=2.8):
    tree_round(s, x, y, r)


# ════════════════════════════════════════ camp 2x2 (2변형) ════════════════════════════════════════
def dome_tent(s, cx, cy, r, mat='orange'):
    d = Dome(cx, cy, 0, r, zmin=0, mat=mat, role='tent', contour=True)
    d.post = chain(dome_panels(8, 2, mat)(d), dome_door(cx, r * .5, r * .55))
    s.add(d)


def floodlight(s, x, y, h):
    s.add(box(x, x + 1.2, y, y + 1.2, 0, h, mat='steel', tex='plain', role='misc', contour=True))
    s.add(box(x - 2, x + 3.2, y - .6, y + 1.8, h, h + 2.4, mat='steel', tex='plain', role='misc', contour=True))
    s.add(box(x - 1.5, x + 2.7, y - .9, y - .55, h + .2, h + 2.2, mat='cyellow', tex='plain', role='misc'))


@icon('camp_a')
def camp_a():
    """탐사 캠프: 돔 텐트 3 · 발전기 · 투광등."""
    s = Scene()
    dome_tent(s, 9.5, 9, 8.2, 'orange')
    dome_tent(s, 20.5, 9.5, 6.2, 'white')
    dome_tent(s, 15, 1.5, 5.0, 'cgreen')
    s.add(box(20, 25.6, 0, 4, 0, 3.6, mat='steel', tex='plain', role='misc', contour=True))
    s.add(box(20.5, 25.1, -.35, 0, 1.2, 2.8, mat='orange', tex='plain', role='misc'))
    s.add(box(23, 24.2, 2.8, 4, 3.6, 6, mat='steel', tex='plain', role='misc'))
    floodlight(s, 2.5, 0, 15)
    return done(s, 32, 32)


@icon('camp_b')
def camp_b():
    """피난민 캠프: A자 천막 줄 · 급수 탱크 · 무전 마스트."""
    s = Scene()
    s.add(tent_ridge_y(0, 9, 1, 11, 8, 'cblue'))
    s.add(tent_ridge_y(9.5, 18.5, 2, 12, 8, 'cyellow'))
    s.add(tent_ridge_y(4.5, 13.5, 12, 21, 9, 'white'))
    tank(s, 22.5, 2.5, 2.4, 5, cap='dome')
    s.add(box(19.8, 21, 11, 12.2, 0, 15, mat='steel', tex='plain', role='misc', contour=True))
    s.add(box(18, 22.8, 10.4, 13, 15, 16.6, mat='steel', tex='plain', role='misc', contour=True))
    s.add(box(19.8, 21, 11, 12.2, 16.6, 19, mat='neon', tex='plain', role='misc'))
    return done(s, 32, 32)


# ════════════════════════════════════════ tower_small 1x2 (2변형) ════════════════════════════════════════
@icon('tower_small_a')
def tower_small_a():
    """송신탑: 적백 줄무늬 원뿔대 + 안테나 플랫폼."""
    s = Scene()
    s.add(box(-5, 5, 0, 5, 0, 2.2, mat='concrete', tex='plain', role='misc', contour=True))
    add(s, Frustum(0, 2.5, 3.2, 1.3, 2.2, 20, mat='cred', role='tower', contour=True), band_swap(2.2, 4, 'white'))
    s.add(box(-3.4, 3.4, -.2, 5.2, 19, 20.2, mat='steel', tex='plain', role='misc', contour=True))
    s.add(box(-.6, .6, 2, 3, 20.2, 24, mat='steel', tex='plain', role='misc'))
    s.add(box(-.8, .8, 1.8, 3.2, 24, 25.5, mat='neon', tex='plain', role='misc'))
    return done(s, 16, 32)


@icon('tower_small_b')
def tower_small_b():
    """풍력 터빈."""
    s = Scene()
    add(s, Frustum(0, 2.5, 2.0, 1.1, 0, 15, mat='white', role='tower', contour=True))
    s.add(box(-1.8, 1.8, -.3, 5.5, 14.6, 17.2, mat='white', tex='plain', role='misc', contour=True))
    hub = np.array([0.0, -.9, 16.0])
    s.add(Dome(hub[0], hub[1], hub[2], 1.6, zmin=-99, mat='steel', role='misc', contour=True))
    for ang in (0.0, 2.094, 4.188):
        R = rot_y(ang)
        d = R @ np.array([0, 0, 1.0])
        c = hub + d * 3.4 + np.array([0, -.5, 0])
        s.add(obox(c, (2.2, .8, 6.4), R, mat='white', tex='plain', role='blade', contour=True))
    return done(s, 16, 32)


# ════════════════════════════════════════ tower_great 2x4 ════════════════════════════════════════
@icon('tower_great')
def tower_great():
    """궤도 엘리베이터 기단 + 층진 원통 탑."""
    s = Scene()
    xc, yc = 0, 12
    add(s, Frustum(xc, yc, 13, 8, 0, 7, mat='concrete', role='tower', contour=True),
        chain(with_ramp(bands(2, 3, 1, -1, ('side',)), 'concrete'), cyl_windows(xc, yc, 11, 1.5, 6, pz=2.5, cols=18, ramp='glass', seed=1)))
    add(s, Frustum(xc, yc, 6.2, 4.6, 7, 33, mat='white', role='tower', contour=True),
        chain(cyl_windows(xc, yc, 5.5, 9, 31, pz=3, cols=10, ramp='glass', lit_p=.12, seed=2)))
    add(s, Frustum(xc, yc, 9.6, 9.6, 22, 25.4, mat='steel', role='tower', contour=True),
        cyl_windows(xc, yc, 9.6, 22.4, 25, pz=3.4, cols=20, ramp='glass', lit_p=.15, seed=3))
    add(s, Frustum(xc, yc, 7, 7, 34, 36, mat='steel', role='tower', contour=True))
    add(s, Frustum(xc, yc, 1.9, .9, 36, 52, mat='steel', role='tower', contour=True), band_swap(37, 4, 'white'))
    add(s, Frustum(xc, yc, 1.0, 1.0, 52, 54, mat='neon', role='misc'))
    return done(s, 32, 64)


# ════════════════════════════════════════ cave 2x2 ════════════════════════════════════════
@icon('cave')
def cave():
    """지하 벙커 입구: 흙 언덕 + 콘크리트 문틀 + 철문 + 환기구."""
    s = Scene()
    s.add(ob.hip(0, 25, 5, 22, 0, .6, mat='dirtg', tex='plain', role='mound', contour=True))
    s.add(box(3, 20, 2, 9, 0, 14, mat='concrete', tex='plain', role='house', contour=True))
    s.add(box(5.5, 17.5, 1.4, 2, 0, 10, mat='steel', tex='plain', role='gate', contour=True))
    steel_door(s, 7, 16, 1.4, 9.2)
    s.add(box(2.5, 20.5, .4, 2.6, 14, 15.4, mat='concrete', tex='plain', role='roof', contour=True))
    s.add(box(5, 7.2, 3, 5.4, 15, 20, mat='steel', tex='plain', role='misc', contour=True))
    add(s, Frustum(22.5, 13, 1.5, 1.5, 1, 8, mat='steel', role='misc', contour=True))
    s.add(box(20.8, 24.2, 11.5, 14.5, 8, 9, mat='steel', tex='plain', role='misc', contour=True))
    s.add(box(11.2, 12.8, 1.1, 1.5, 11, 12.5, mat='neon', tex='plain', role='misc'))
    return done(s, 32, 32)


# ════════════════════════════════════════ ruin 2x2 ════════════════════════════════════════
@icon('ruin')
def ruin():
    """무너진 건물: 앞 모서리가 뜯겨 나간 몸체(창 다 깨짐) + 무너져 내린 반대쪽 + 기울어 박힌 슬래브 + 철근 + 잔해."""
    s = Scene()
    rng = np.random.RandomState(4)
    p = box(0, 14, 10, 18, 0, 19, mat='concrete', tex='plain', role='house', contour=True)
    p.post = chain(windows(0, 10, z0=2.5, ztop=16, px=3, pz=3, lit_p=0, missing=.3, seed=9), hole(5.5, 11, 5, 14, seed=2))
    s.add(p)
    s.add(box(-.5, 5.5, 9.6, 18.4, 17, 19.6, mat='oldgrey', tex='plain', role='misc', contour=True))
    s.add(box(14, 23, 10, 17, 0, 9, mat='oldgrey', tex='plain', role='house', contour=True))
    s.add(box(14, 18.5, 10, 17, 9, 12, mat='concrete', tex='plain', role='house', contour=True))
    s.add(obox((18.5, 5, 5.5), (11, 7, 1.4), rot_x(.75) @ rot_z(-.12), mat='concrete', tex='plain', role='slab', contour=True))
    for (x, y, h) in ((3, 6, 8), (11, 5, 10), (22, 13, 13)):
        s.add(box(x, x + .6, y, y + .6, 1, h, mat='rust', tex='plain', role='misc'))
    rubble(s, rng, 0, 26, 0, 8, n=7, hmax=2.4)
    return done(s, 32, 32)


# ════════════════════════════════════════ ruin_city 4x3 ════════════════════════════════════════
@icon('ruin_city')
def ruin_city():
    s = Scene()
    rng = np.random.RandomState(7)
    specs = [(0, 18, 12, 9, 34, (.45, .1), (-.8, 0), 'concrete', 1, (4, 9, 4, 17)),
             (15, 21, 11, 9, 24, (-.5, .1), (.6, -.1), 'oldgrey', 2, (5, 10, 3, 10)),
             (31, 17, 12, 9, 30, (.6, 0), (-.5, .15), 'concrete', 3, (4, 10, 6, 15)),
             (47, 7, 10, 8, 18, (.4, .1), (-.7, 0), 'oldgrey', 4, (3, 8, 4, 9)),
             (6, 4, 10, 8, 14, (-.6, 0), (.5, .1), 'concrete', 5, (3, 8, 3, 9))]
    for (x, y, w, d, h, ta, tb, mat, sd, hl) in specs:
        p = broken(x, x + w, y, y + d, h, tilts=(ta, tb), drops=(0, 4.5), mat=mat, tex='plain', role='house', contour=True)
        p.post = chain(windows(x, y, z0=2.5, ztop=h - 3, px=3, pz=3, lit_p=0, missing=.38, seed=sd),
                       hole(x + hl[0], x + hl[1], hl[2], hl[3], seed=sd))
        s.add(p)
    for (x, y) in ((9, 11), (30, 10), (42, 20)):
        s.add(box(x, x + .6, y, y + .6, 14, 21, mat='rust', tex='plain', role='misc'))
    rubble(s, rng, 0, 58, 0, 12, n=16, hmax=2.8)
    return done(s, 64, 48)


# ════════════════════════════════════════ shrine 3x3 ════════════════════════════════════════
@icon('shrine')
def shrine():
    """연구 시설: 원형 관측 돔(개구부·리브) + 부속동 + 접시 안테나."""
    s = Scene()
    xc, yc = 23, 13
    pad(s, 0, 40, 0, 20)
    add(s, Frustum(xc, yc, 10.5, 10.5, .8, 10, mat='white', role='tower', contour=True),
        chain(with_ramp(bands(3, 3, 1, -1, ('side',)), 'white'), cyl_windows(xc, yc, 10.5, 3.2, 9, pz=3.0, cols=16, ramp='glass', lit_p=.15, seed=1)))
    add(s, Frustum(xc, yc, 11.4, 11.4, 9.4, 11, mat='steel', role='tower', contour=True))
    d = Dome(xc, yc, 11, 9.2, zmin=11, mat='white', role='dome', contour=True)
    d.post = dome_ribs(8, slit_deg=-65, slit_w=12)(d)
    s.add(d)
    bldg(s, 0, 8, 9, 10, 12, mat='concrete', seed=21)
    rooftop(s, 0, 8, 9, 10, 12, 'ac')
    bldg(s, 34, 3, 6, 8, 9, mat='glass', seed=22)
    dish(s, 13, 3, 10, 3.8, tilt=.5, yaw=.7, mast=False)
    s.add(box(11.4, 14.6, 1.5, 4.5, .8, 8, mat='steel', tex='plain', role='misc', contour=True))
    return done(s, 48, 48)


# ════════════════════════════════════════ landmark_nature 3x3 ════════════════════════════════════════
@icon('landmark_nature')
def landmark_nature():
    """거대 태양광 패널 농장."""
    s = Scene()
    for r, y in enumerate((0, 10, 20, 30)):
        for i in range(2):
            x = 0 + i * 18 + (r % 2) * 1.5
            pn = obox((x + 8, y + 3.8, 5.0), (15, 6.6, .9), rot_x(.62), mat='solar', tex='plain', role='panel', contour=True)
            pn.post = solar_cells(3, 2)
            s.add(pn)
            s.add(box(x + 2, x + 3.2, y + 3.2, y + 4.4, 0, 3.2, mat='steel', tex='plain', role='misc'))
            s.add(box(x + 12, x + 13.2, y + 3.2, y + 4.4, 0, 3.2, mat='steel', tex='plain', role='misc'))
    s.add(box(35, 40, 0, 6, 0, 5, mat='concrete', tex='plain', role='house', contour=True))
    s.add(box(34.5, 40.5, -.4, 6.4, 5, 6, mat='steel', tex='plain', role='roof', contour=True))
    return done(s, 48, 48)


# ════════════════════════════════════════ circle 2x2 ════════════════════════════════════════
@icon('circle')
def circle():
    """위성 안테나 어레이."""
    s = Scene()
    pad(s, 0, 26, 0, 15)
    dish(s, 6, 4.5, 7.5, 4.8, tilt=.55, yaw=.7)
    dish(s, 19.5, 5, 7.5, 4.8, tilt=.55, yaw=.7)
    dish(s, 12.8, 10.5, 10.5, 6.2, tilt=.5, yaw=.7)
    return done(s, 32, 32)


# ════════════════════════════════════════ volcano 2x2 ════════════════════════════════════════
@icon('volcano')
def volcano():
    """지열 발전소: 냉각탑 + 증기 + 터빈동 + 파이프."""
    s = Scene()
    rng = np.random.RandomState(11)
    pad(s, 0, 25, 0, 13)
    add(s, Frustum(8, 7, 7.0, 4.4, .8, 10.5, mat='concrete', role='tower', contour=True), with_ramp(bands(3, 3, 1, -1, ('side',)), 'concrete'))
    steam(s, 8, 7, 10.5, rng, n=3, r0=2.8, rise=4.2, drift=3.4)
    s.add(box(14, 25, 2, 9, .8, 6, mat='steel', tex='plain', role='house', contour=True))
    s.add(box(13.6, 25.4, 1.6, 9.4, 6, 6.8, mat='concrete', tex='plain', role='roof', contour=True))
    s.add(obox((12, 4, 2.6), (5, 1.3, 1.3), np.eye(3), mat='steel', tex='plain', role='misc', contour=True))
    add(s, Frustum(21.5, 4, 1.3, 1.3, 6.8, 11.5, mat='steel', role='misc', contour=True))
    steam(s, 21.5, 4, 11.5, rng, n=2, r0=1.7, rise=2.8, drift=1.8)
    return done(s, 32, 32)


# ════════════════════════════════════════ floating 5x4 ════════════════════════════════════════
@icon('floating')
def floating():
    """부유 도시: 공중에 뜬 암반 원판(아래로 뾰족) + 윗면 도시 + 밑 추진기."""
    s = Scene()
    cx, cy = 34, 12
    zb, zm, zt = 6, 10, 16
    # 밑 추진기(원통 + 네온)
    add(s, Frustum(cx, cy - 1, 3.2, 3.2, zb - 3, zb + 2, mat='steel', role='misc', contour=True))
    add(s, Frustum(cx, cy - 1, 2.4, 2.4, zb - 4.2, zb - 3, mat='neon', role='misc'))
    # 암반: 아래 뾰족 + 위 판 밑 단
    add(s, Frustum(cx, cy, 4.0, 15, zb, zm, mat='rock', role='hull', contour=True))
    add(s, Frustum(cx, cy, 15, 23, zm, zt, mat='rock', role='hull', contour=True))
    add(s, Frustum(cx, cy, 24, 24, zt, zt + 2.6, mat='concrete', role='plate', contour=True),
        cyl_windows(cx, cy, 24, zt + .4, zt + 2.4, pz=3, cols=34, ramp='glass', lit_p=.25, seed=4))
    z0 = zt + 2.6
    def tw(x, y, w, d, h, sd, mat='glass'):
        p = box(x, x + w, y, y + d, z0, z0 + h, mat=mat, tex='plain', role='house', contour=True)
        p.post = windows(x, y, z0=z0 + 2, ztop=z0 + h - 1.5, px=3, pz=3, lit_p=.1, seed=sd)
        s.add(p)
    tw(cx - 9, cy + 5, 9, 8, 21, 61)
    tw(cx + 4, cy + 2, 9, 8, 16, 62, 'concrete')
    tw(cx - 18, cy + 1, 8, 7, 12, 63, 'concrete')
    tw(cx + 15, cy - 3, 7, 7, 9, 64)
    d = Dome(cx - 3, cy - 5, z0, 6.5, zmin=z0, mat='glass', role='dome', contour=True)
    d.post = dome_panels(6, 2, 'glass')(d)
    s.add(d)
    tree_round(s, cx + 8, cy - 8, 2.2, z=z0)
    tree_round(s, cx - 15, cy - 6, 2.2, z=z0)
    return done(s, 80, 64)
