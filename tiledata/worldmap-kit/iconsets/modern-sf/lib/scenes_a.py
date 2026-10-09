"""현대·SF 아이콘 장면 A: 도시·성·주택. (좌표: 월드 단위 = 화면 1px, x 오른쪽·y 안쪽·z 위)"""
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


def tree_s(s, x, y, r=2.8):
    tree_round(s, x, y, r)


def pad(s, x0, x1, y0, y1, mat='concrete', h=.8):
    s.add(box(x0, x1, y0, y1, 0, h, mat=mat, tex='plain', role='pad', contour=True))


# ════════════════════════════════════════ capital 6x6 ════════════════════════════════════════
@icon('capital')
def capital():
    s = Scene()
    add(s, Frustum(42, 17, 21, 21, 0, .6, mat='asphalt', role='ground', contour=False), None)
    add(s, Frustum(42, 17, 13, 13, .6, 1.0, mat='concrete', role='ground', contour=False), None)
    bldg(s, 3, 30, 12, 11, 52, mat='concrete', seed=1)
    bldg(s, 21, 38, 12, 10, 42, mat='glass', seed=2)
    bldg(s, 38, 36, 14, 12, 60, mat='glass', seed=3)
    rooftop(s, 38, 36, 14, 12, 60, 'mast')
    bldg(s, 58, 32, 12, 10, 48, mat='concrete', seed=4)
    rooftop(s, 58, 32, 12, 10, 48, 'ac2')
    bldg(s, 70, 17, 10, 10, 32, mat='glass', seed=5)
    bldg(s, 1, 10, 11, 10, 28, mat='concrete', seed=6)
    rooftop(s, 1, 10, 11, 10, 28, 'helipad')
    bldg(s, 68, 1, 10, 9, 18, mat='concrete', seed=7)
    add(s, Frustum(42, 17, 3, 3, 1.0, 3, mat='steel', role='misc', contour=True))
    add(s, Frustum(42, 17, 1.6, .4, 3, 26, mat='steel', role='misc', contour=True))
    add(s, Frustum(42, 17, 1.0, 1.0, 26, 28, mat='neon', role='misc'))
    return done(s, 96, 96)


# ════════════════════════════════════════ fort_city 4x4 ════════════════════════════════════════
@icon('fort_city')
def fort_city():
    """방벽 도시: 콘크리트 방벽 고리 + 모서리 감시탑 + 안쪽 고층 + 앞 철문 문루."""
    s = Scene()
    W0, W1 = 4, 38
    s.add(box(W0, W1, 22, 27, 0, 10, mat='concrete', tex='plain', role='wall', contour=True))
    s.add(box(W0, W0 + 5, 0, 27, 0, 9, mat='concrete', tex='plain', role='wall', contour=True))
    s.add(box(W1 - 5, W1, 0, 27, 0, 9, mat='concrete', tex='plain', role='wall', contour=True))
    bldg(s, 11, 10, 8, 8, 24, mat='glass', seed=3)
    bldg(s, 21, 12, 10, 9, 36, mat='glass', seed=4)
    rooftop(s, 21, 12, 10, 9, 36, 'mast')
    bldg(s, 10, 19, 8, 5, 14, mat='concrete', seed=5)
    s.add(box(W0, W1, 0, 4, 0, 7, mat='concrete', tex='plain', role='wall', contour=True))
    s.add(box(W0 + 1, W1 - 1, 1.2, 3, 7, 8.4, mat='steel', tex='plain', role='misc'))
    s.add(box(13, 29, -3, 6, 0, 13, mat='concrete', tex='plain', role='gate', contour=True))
    steel_door(s, 17, 25, -3, 9)
    watch_tower(s, 0, -3, 6, 15)
    watch_tower(s, 36, -3, 6, 15)
    watch_tower(s, 0, 23, 6, 18, ant=False)
    watch_tower(s, 36, 23, 6, 18, ant=False)
    return done(s, 64, 64)


# ════════════════════════════════════════ harbor_city 5x4 ════════════════════════════════════════
@icon('harbor_city')
def harbor_city():
    """항만: 컨테이너 크레인 + 컨테이너 더미 + 화물선 + 항만 고층."""
    s = Scene()
    # 물(앞) + 부두
    s.patch(30, 70, -16, -1, flat_fn('cwater', 0, 1, seed=3), mat='cwater')
    pad(s, 0, 52, -1, 26)
    # 화물선
    s.add(wedge_hull(32, 64, -15, -3, 0, 5, bow=6, mat='cred', tex='plain', role='hull', contour=True))
    s.add(box(32, 61, -15, -3, 5, 5.8, mat='concrete', tex='plain', role='hull'))
    for i, c in enumerate(['cred', 'cyellow', 'cgreen']):
        container(s, 40 + i * 6.2, -13.5, 5.8, c, 6, 2.6, 2.6)
        container(s, 40 + i * 6.2, -10.2, 5.8, c if i % 2 else 'cblue', 6, 2.6, 2.6)
    bldg(s, 32.5, -14.5, 6, 9, 15, mat='concrete', seed=8, z0=7, win=True)
    s.add(box(32.5, 38.5, -14.5, -5.5, 15, 16.2, mat='white', tex='plain', role='misc', contour=True))
    # 문형 크레인
    for (cx, cy) in ((6, -1), (21.4, -1), (6, 5), (21.4, 5)):
        s.add(box(cx, cx + 1.8, cy, cy + 1.8, .8, 20, mat='cyellow', tex='plain', role='crane', contour=True))
    s.add(box(5, 23.4, -1, 1, 20, 22.4, mat='cyellow', tex='plain', role='crane', contour=True))
    s.add(box(5, 23.4, 5, 6.8, 20, 22.4, mat='cyellow', tex='plain', role='crane', contour=True))
    s.add(box(12, 15, -12, 7.4, 20.4, 22.8, mat='cyellow', tex='plain', role='crane', contour=True))
    s.add(box(12.6, 14.4, -9, -7, 13, 20.4, mat='steel', tex='plain', role='crane'))
    container(s, 12, -10.5, 10.5, 'cred', 3.6, 2.2, 2.4)
    # 컨테이너 더미
    cols = ['cred', 'cblue', 'cgreen', 'cyellow', 'cred', 'cblue']
    k = 0
    for row, y in enumerate((9, 13, 17)):
        for i in range(3):
            n = 3 - ((i + row) % 3)
            for z in range(n):
                container(s, 28 + i * 6.2, y, .8 + z * 2.6, cols[(k + z) % 6], 6, 3.2, 2.6)
            k += 1
    # 창고 + 항만 고층
    s.add(box(1, 20, 14, 25, .8, 10, mat='concrete', tex='plain', role='house', contour=True))
    s.add(ob.gable(0, 21, 13, 26, 10, .22, mat='steel', tex='plain', role='roof', contour=True))
    steel_door(s, 5, 11, 14, 7, z0=.8)
    bldg(s, 48, 16, 10, 9, 30, mat='glass', seed=11, z0=2.8)
    return done(s, 80, 64)


# ════════════════════════════════════════ castle 3x3 (2변형) ════════════════════════════════════════
@icon('castle_a')
def castle_a():
    """군사 기지: 반원통 격납고 + 낮은 방벽 + 레이더 타워."""
    s = Scene()
    s.add(prism_arch(3, 27, 15, 9, N=8, mat='steel', tex='plain', role='house', contour=True))
    s.add(box(0, 36, 0, 2.5, 0, 5, mat='concrete', tex='plain', role='wall', contour=True))
    s.add(box(0, 36, .6, 1.9, 5, 6.4, mat='steel', tex='plain', role='misc'))
    s.add(box(11, 22, -2, 4, 0, 8, mat='concrete', tex='plain', role='gate', contour=True))
    steel_door(s, 13, 20, -2, 5)
    s.add(box(26, 35, 6, 13, 0, 5, mat='concrete', tex='plain', role='house', contour=True,
              decals=(('front', (29, 32, 0, 3, 'dark')),)))
    s.add(box(28, 32, 14, 18, 0, 20, mat='concrete', tex='plain', role='tower', contour=True))
    s.add(box(27, 33, 13, 19, 20, 23, mat='steel', tex='plain', role='tower', contour=True))
    dish(s, 30, 16, 27, 4.4, tilt=.5, yaw=.7, mast=False)
    return done(s, 48, 48)


@icon('castle_b')
def castle_b():
    """요새형: 원통 포탑 네 개 + 중앙 사령동 + 앞 문루."""
    s = Scene()
    s.add(box(5, 34, 16, 20, 0, 8, mat='concrete', tex='plain', role='wall', contour=True))
    s.add(box(5, 9, 0, 20, 0, 8, mat='concrete', tex='plain', role='wall', contour=True))
    s.add(box(30, 34, 0, 20, 0, 8, mat='concrete', tex='plain', role='wall', contour=True))
    bldg(s, 12, 8, 14, 9, 26, mat='glass', seed=7)
    rooftop(s, 12, 8, 14, 9, 26, 'mast')
    s.add(box(5, 34, 0, 4, 0, 6, mat='concrete', tex='plain', role='wall', contour=True))
    s.add(box(12, 26, -2, 6, 0, 10, mat='concrete', tex='plain', role='gate', contour=True))
    steel_door(s, 16, 22, -2, 6)
    for (cx, cy, h) in ((5, 1, 13), (34, 1, 13), (5, 18, 16), (34, 18, 16)):
        add(s, Frustum(cx, cy, 4.0, 4.0, 0, h, mat='concrete', role='tower', contour=True),
            with_ramp(bands(3, 4, 1, -1, ('side',)), 'concrete'))
        add(s, Frustum(cx, cy, 4.6, 4.6, h, h + 2, mat='steel', role='tower', contour=True))
        add(s, Frustum(cx, cy, 1.5, 1.5, h + 2, h + 4, mat='neon', role='misc'))
    return done(s, 48, 48)


# ════════════════════════════════════════ large_town 3x3 (2변형) ════════════════════════════════════════
def house_win(s, x, y, w, d, wall_h, roof_h, wall, roof, flat=False, trim='steel'):
    """창 둘 + 가운데 문이 있는 주택. 박공(flat=False) 또는 평지붕."""
    dc = (('front', (x + w / 2 - 1.2, x + w / 2 + 1.2, 0, 3.6, 'door')),
          ('front', (x + 2, x + 4.6, 2.6, 4.6, 'glass')), ('front', (x + w - 4.6, x + w - 2, 2.6, 4.6, 'glass')))
    s.add(box(x, x + w, y, y + d, 0, wall_h, mat=wall, tex='plain', role='house', contour=True, decals=dc))
    if flat:
        s.add(box(x - .5, x + w + .5, y - .5, y + d + .5, wall_h, wall_h + 1, mat=trim, tex='plain', role='roof', contour=True))
    else:
        s.add(ob.gable(x - .8, x + w + .8, y - .9, y + d + .9, wall_h, roof_h / (d / 2 + .9), mat=roof, tex='plain', role='roof', contour=True))


@icon('large_town_a')
def large_town_a():
    """교외 주택가: 박공 주택 6동 + 마당 나무."""
    s = Scene()
    roofs = ['roofred', 'roofgrey', 'roofred', 'roofgrey', 'roofred', 'roofred']
    walls = ['plaster', 'plaster', 'concrete', 'plaster', 'plaster', 'concrete']
    k = 0
    for r, y in enumerate((0, 15, 30)):
        for c, x in enumerate((0, 18)):
            house_win(s, x + (r % 2) * 2, y, 14, 8, 6, 6.5, walls[k], roofs[k])
            k += 1
    for (x, y) in ((15.5, 4), (16, 19), (15.5, 33), (33, 9), (32, 24)):
        tree_s(s, x, y, 2.6)
    return done(s, 48, 48)


@icon('large_town_b')
def large_town_b():
    """교외 신축 단지: 평지붕 6동 + 옥상 태양광 + 차고."""
    s = Scene()
    k = 0
    for r, y in enumerate((0, 15, 30)):
        for c, x in enumerate((0, 18)):
            xx = x + (r % 2) * 2
            house_win(s, xx, y, 14, 8, 6.5, 0, 'plaster' if (k % 3) else 'white', None, flat=True)
            pn = obox((xx + 7, y + 4.8, 8.8), (8, 3.8, .8), rot_x(-.5), mat='solar', tex='plain', role='misc', contour=True)
            pn.post = solar_cells()
            s.add(pn)
            k += 1
    for (x, y) in ((15.5, 4), (16, 19), (15.5, 33), (33, 9), (32, 24)):
        tree_s(s, x, y, 2.6)
    return done(s, 48, 48)
