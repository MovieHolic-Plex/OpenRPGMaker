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


ORDER = [
    ('village', '시작 마을', 'village', (2, 2), '연구소 하나와 빨강·파랑 지붕 집 둘'),
    ('large_town', '회복소 마을', 'large_town', (3, 3), '회복소(빨간 지붕·십자)·상점(파란 지붕)·집 둘·나무'),
]
