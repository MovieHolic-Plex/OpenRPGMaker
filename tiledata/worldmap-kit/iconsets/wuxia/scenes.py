"""무협 중국 월드맵 아이콘 — 정면 카메라(KX=0, KY=.62)용 장면.
노란 기와 궁·붉은 벽·청기와 문파·장성 벽돌·객잔·전탑·산수(바위산·소나무·구름).
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
from icons_v9_lib import hx, STONE, WSTONE, WOOD, ROCK, RED, LEAF, GOLD, WATER, SNOW, LAVA  # noqa: E402
from oblique import Scene, box  # noqa: E402

SET = dict(id='wuxia', name='무협 중국')

# ── 재질 ─────────────────────────────────────────────────────────────────────────────────────────
ob.MAT.update({
    'marble': [WSTONE[2], WSTONE[3], WSTONE[4], WSTONE[5], SNOW[5]],                       # 한백옥 기단
    'blacktile': [hx('111618'), hx('1d2c33'), hx('2c3738'), hx('363540'), hx('445353'), hx('5d6869')],
    'bamboo': [LEAF[1], LEAF[2], LEAF[3], LEAF[4], LEAF[5], LEAF[6]],
    'pine': [hx('1d2c33'), LEAF[1], hx('2c634c'), LEAF[2], LEAF[3], hx('53856c')],
    'junk': [WOOD[0], RED[1], RED[2], RED[3], RED[4], RED[5]],
    'bronze': [WOOD[1], WOOD[2], WOOD[4], GOLD[2], GOLD[3]],                                    # 대나무 돛(붉은 갈색)
    'falls': [WATER[0], WATER[1], WATER[2], WATER[3], WATER[5], SNOW[5]],
    'redrock': [ROCK[0], ROCK[1], RED[0], RED[1], RED[2], RED[3], RED[4]],                    # 화염산 붉은 사암
    'flame': [RED[3], RED[5], hx('f3aa38'), hx('fad343'), hx('f8e878'), hx('f8ec78')],
    'ochre': [ROCK[4], ROCK[5], ROCK[6], ROCK[7], ROCK[8], ROCK[9]],                          # 사찰 황토벽
    'crag': [hx('111618'), hx('464f49'), hx('575e58'), hx('616a62'), hx('758276'), hx('849c97'), hx('aac3b5')],
    'crane': [WSTONE[3], WSTONE[4], WSTONE[5], SNOW[5]],
    'ink': [hx('111618'), hx('1d2c33'), hx('363540')],
})
for _r, _o in (('marble', '564a3e'), ('blacktile', '111618'), ('bamboo', '1d2c33'), ('pine', '111618'), ('junk', '351803'), ('bronze', '351803'),
               ('falls', '065298'), ('redrock', '291010'), ('flame', '931d10'), ('ochre', '411e05'), ('crane', '564a3e'), ('crag', '111618'), ('ink', '111618')):
    L._reg(ob.MAT[_r], hx(_o))


def stone_fn(x, y):
    st = np.array(ob.MAT['stone'], np.uint8)
    col = st[np.clip((4 + ob.hsh(x, y, 21) * 2).astype(int), 0, 6)]
    seam = (np.mod(np.floor(x), 6) == 0) | (np.mod(np.floor(y), 4) == 0)
    return np.where(seam[:, None], st[3], col)


def marble_fn(x, y):
    mb = np.array(ob.MAT['marble'], np.uint8)
    col = mb[np.clip((2 + ob.hsh(x, y, 7) * 1.8).astype(int), 0, 4)]
    seam = (np.mod(np.floor(x), 8) == 0) | (np.mod(np.floor(y), 5) == 0)
    return np.where(seam[:, None], mb[1], col)


# ── 부품 ─────────────────────────────────────────────────────────────────────────────────────────
def terrace(s, x0, x1, y0, y1, z0, h, mat='marble', rail=True):
    """한백옥 기단(층계 단) + 앞 난간."""
    s.box(x0, x1, y0, y1, z0, z0 + h, mat=mat, tex='brick', role='misc', contour=True)
    if rail:
        s.add(box(x0, x1, y0, y0 + .8, z0 + h, z0 + h + 1.0, mat=mat, tex='plain', role='misc'))


def stairs(s, xc, w, y_front, z_top, n=4, mat='marble', run=1.6):
    """앞으로 내려오는 계단: n 단, 맨 윗단이 z_top."""
    for i in range(n):
        zt = z_top * (i + 1) / n
        yb = y_front - (n - 1 - i) * run
        s.box(xc - w / 2, xc + w / 2, yb, y_front + .5, 0, zt, mat=mat, tex='plain', role='misc', contour=True)


def chall(s, x, y, w, d, wh, rise, z0=0.0, roof='goldroof', wall='redwall', double=False, over=2.4, tips=2.0,
          band='jade', doors=True, nwin=None, door_mode='reddoor'):
    """중국 전각: 붉은 벽(살창) + 청록 단청 들보 + 오목 기와지붕(겹처마 선택). 반환: 지붕 꼭대기 z."""
    decs = []
    cx = x + w / 2
    if doors:
        decs.append(('front', (cx - 1.4, cx + 1.4, z0, z0 + min(wh - 1.2, 4.6), door_mode)))
    k = nwin if nwin is not None else max(0, int(w // 7))
    for i in range(k):
        f = (i + 1) / (k + 1)
        wx = x + w * f
        if abs(wx - cx) < 3.2:
            continue
        decs.append(('front', (wx - 1.1, wx + 1.1, z0 + wh * .3, z0 + wh * .8, 'lat')))
    s.box(x, x + w, y, y + d, z0, z0 + wh, mat=wall, tex='plain', role='house', contour=True, decals=tuple(decs))
    if band:
        s.add(box(x - .3, x + w + .3, y - .5, y + d, z0 + wh - 1.3, z0 + wh, mat=band, tex='plain', role='misc'))
    z = z0 + wh
    if double:
        E.tile_roof(s, x - over - .6, x + w + over + .6, y - over - .6, y + d + over + .6, z, 2.4, mat=roof, tips=1.2, fa=.25, fh=.9)
        z += 1.6
        s.box(x + 1.6, x + w - 1.6, y + 1.4, y + d - 1.4, z, z + 2.6, mat=wall, tex='plain', role='house', contour=True)
        if band:
            s.add(box(x + 1.3, x + w - 1.3, y + .9, y + d - 1.4, z + 1.3, z + 2.6, mat=band, tex='plain', role='misc'))
        z += 2.6
        over = over - .4
        E.tile_roof(s, x + 1.6 - over, x + w - 1.6 + over, y + 1.4 - over, y + d - 1.4 + over, z, rise, mat=roof, tips=tips)
        return z + rise
    E.tile_roof(s, x - over, x + w + over, y - over, y + d + over, z, rise, mat=roof, tips=tips)
    return z + rise


def redwall(s, x0, x1, y0, y1, h, cap='goldroof', mat='redwall', tex='plain', z0=0.0):
    """궁 담: 붉은 벽 + 기와 갓."""
    s.box(x0, x1, y0, y1, z0, z0 + h, mat=mat, tex=tex, role='wall', contour=True)
    s.add(box(x0 - .8, x1 + .8, y0 - .8, y1 + .8, z0 + h, z0 + h + 1.2, mat=cap, tex='plain', role='misc', contour=True))
    s.add(box(x0 - .1, x1 + .1, y0 + .1, y1 - .1, z0 + h + 1.2, z0 + h + 2.0, mat=cap, tex='plain', role='misc'))


def pine(s, x, y, z=0.0, h=9.0, r=3.4, lean=0.0, tiers=3):
    """산수화 소나무: 굽은 줄기 + 납작한 잎 층."""
    s.cyl(x, y, .7, z, z + h * .7, mat='bark', tex='plain', role='misc')
    for i in range(tiers):
        f = i / max(tiers - 1, 1)
        tx = x + lean * (f - .3) * 2.2
        rr = r * (1.0 - .28 * f)
        s.add(E.Ellip(tx, y, z + h * (.55 + .32 * f), rr, rr * .75, 1.2, mat='pine', tex='speck', role='misc', contour=True))


def bamboo(s, x, y, h=14, n=5, spread=3.0, seed=1):
    rng = np.random.default_rng(seed)
    for i in range(n):
        bx = x + rng.uniform(-spread, spread)
        by = y + rng.uniform(-spread * .6, spread * .6)
        hh = h * rng.uniform(.75, 1.05)
        s.box(bx - .5, bx + .5, by - .5, by + .5, 0, hh, mat='bamboo', tex='plain', role='misc')
        s.add(E.Ellip(bx, by, hh, 2.4, 1.6, 2.6, mat='bamboo', tex='speck', role='misc', contour=True))


def flag(s, x, y, h, w=3.5, fh=4.5, mat='cloth', pole='wood', side=1):
    s.box(x - .4, x + .4, y - .4, y + .4, 0, h, mat=pole, tex='plain', role='misc')
    x0, x1 = (x + .4, x + .4 + w) if side > 0 else (x - .4 - w, x - .4)
    s.box(x0, x1, y - .3, y + .3, h - fh, h - .3, mat=mat, tex='plain', role='misc', contour=True)


def lantern(s, x, y, z):
    s.add(E.Ellip(x, y, z, .9, .9, 1.1, mat='cloth', tex='plain', role='misc'))


def brick_wall(s, x0, x1, y0, y1, h, z0=0.0, step=2.0, mat='greywall', merl=True):
    s.box(x0, x1, y0, y1, z0, z0 + h, mat=mat, tex='brick', role='wall', contour=True)
    if merl:
        s.crenels(x0, x1, y0, y1, z0 + h, mat=mat, step=step, h=1.6, edges=('front',), depth=1.2)


def arrow_tower(s, xc, y, w, d, base_h, h, rise, roof='tile', rows=2):
    """전루(箭樓): 벽돌 덩어리 + 줄 지은 활창 + 겹 기와."""
    x0, x1 = xc - w / 2, xc + w / 2
    s.box(x0, x1, y, y + d, 0, base_h, mat='greywall', tex='brick', role='gate', contour=True,
          decals=(('front', (xc - 2.4, xc + 2.4, 0, base_h - 1.4, 'arch')),))
    decs = []
    for r in range(rows):
        zz = base_h + 1.2 + r * 2.6
        for i in range(int((w - 3) // 3)):
            wx = x0 + 2.4 + i * 3
            decs.append(('front', (wx, wx + 1.0, zz, zz + 1.2, 'dark')))
    s.box(x0 + 1, x1 - 1, y + 1, y + d - 1, base_h, base_h + h, mat='greywall', tex='plain', role='tower', contour=True,
          decals=tuple(decs))
    E.tile_roof(s, x0 - 1.4, x1 + 1.4, y - .4, y + d + 1.4, base_h + h, rise, mat=roof, tips=1.6)


def wheel(s, x, y, z, r=1.6):
    s.add(E.Ellip(x, y, z, r, .45, r, mat='wood', tex='plain', role='misc', contour=True))


def cloud(s, x, y, z, rx, ry=None, rz=None):
    ry = ry or rx * .55
    rz = rz or rx * .4
    s.add(E.Ellip(x, y, z, rx, ry, rz, mat='cloud', tex='speck', role='nocast'))
    s.add(E.Ellip(x - rx * .55, y + .5, z + rz * .2, rx * .55, ry * .8, rz * .8, mat='cloud', tex='speck', role='nocast'))
    s.add(E.Ellip(x + rx * .5, y + .5, z + rz * .35, rx * .6, ry * .8, rz * .85, mat='cloud', tex='speck', role='nocast'))


def crane(s, x, y, z, dirn=1):
    """하늘을 나는 학: 흰 몸 + 펼친 날개 + 검은 날개 끝 + 붉은 정수리."""
    s.add(E.Ellip(x, y, z, 1.6, .6, .7, mat='crane', tex='plain', role='nocast'))
    s.add(box(x - 3.6, x + 3.6, y - .3, y + .3, z + .1, z + .8, mat='crane', tex='plain', role='nocast'))
    s.add(box(x - 4.6, x - 3.6, y - .3, y + .3, z + .3, z + 1.1, mat='ink', tex='plain', role='nocast'))
    s.add(box(x + 3.6, x + 4.6, y - .3, y + .3, z + .3, z + 1.1, mat='ink', tex='plain', role='nocast'))
    hx_ = x + 2.4 * dirn
    s.add(box(min(x + 1.2 * dirn, hx_), max(x + 1.2 * dirn, hx_), y - .2, y + .2, z + .2, z + .8, mat='crane', tex='plain', role='nocast'))
    s.add(box(hx_ - .5, hx_ + .5, y - .3, y + .3, z + .4, z + 1.2, mat='cloth', tex='plain', role='nocast'))


# ═══════════════════════════════════════════════════════════════════ 도시
def capital():
    """황도(자금성풍): 붉은 궁성 담 + 오문(대문 누각 겹지붕) + 한백옥 3단 기단 위 태화전 + 좌우 배전 + 뒤 침전."""
    s = Scene()
    x0, x1, D = 6, 82, 98
    cx = (x0 + x1) / 2
    s.patch(x0 + 3, x1 - 3, 4, D - 3, stone_fn, z=0, h=.4, mat='stone')
    # 뒤·옆 담
    redwall(s, x0, x1, D - 3, D, 9)
    redwall(s, x0, x0 + 3, 0, D, 9)
    redwall(s, x1 - 3, x1, 0, D, 9)
    # 뒤 침전(조금 작게, 높은 기단)
    terrace(s, cx - 15, cx + 15, 70, 84, 0, 5)
    chall(s, cx - 11, 73, 22, 8, 6, 7, z0=5, double=False, over=2.6)
    # 좌우 배전(엇갈림)
    for hx0 in (x0 + 8, x1 - 8 - 16):
        terrace(s, hx0 - 1, hx0 + 17, 44, 56, 0, 2.2, rail=False)
        chall(s, hx0, 46, 16, 7, 5.5, 5.5, z0=2.2, over=2.2, tips=1.5)
    # 태화전: 3단 기단 + 겹지붕
    terrace(s, cx - 20, cx + 20, 26, 54, 0, 3)
    terrace(s, cx - 17, cx + 17, 29, 52, 3, 3)
    terrace(s, cx - 14, cx + 14, 32, 50, 6, 3)
    stairs(s, cx, 6, 26, 9, n=5)
    chall(s, cx - 12, 36, 24, 10, 8, 9, z0=9, double=True, over=3.2, tips=2.4)
    # 앞 담 + 오문
    redwall(s, x0, cx - 16, 0, 4, 10)
    redwall(s, cx + 16, x1, 0, 4, 10)
    s.box(cx - 16, cx + 16, -3, 6, 0, 12, mat='redwall', tex='plain', role='gate', contour=True,
          decals=(('front', (cx - 2.4, cx + 2.4, 0, 7, 'arch')), ('front', (cx - 9.5, cx - 6.5, 0, 5.5, 'arch')),
                  ('front', (cx + 6.5, cx + 9.5, 0, 5.5, 'arch'))))
    s.add(box(cx - 16.6, cx + 16.6, -3.6, 6.6, 12, 13, mat='marble', tex='plain', role='misc'))
    chall(s, cx - 11, -1, 22, 6, 5.5, 6.5, z0=13, double=True, over=2.6)
    # 모서리 각루
    for tx in (x0 + 1.5, x1 - 1.5):
        for ty in (2, D - 1.5):
            s.box(tx - 4, tx + 4, ty - 3, ty + 3, 9, 13, mat='redwall', tex='plain', role='tower', contour=True)
            E.tile_roof(s, tx - 6, tx + 6, ty - 5, ty + 5, 13, 5.5, mat='goldroof', tips=1.6)
    return s


def fort_city():
    """장성풍 성곽 도시: 회색 벽돌 성벽·총안 + 앞 전루 + 모서리 각루 + 안의 고루·민가."""
    s = Scene()
    x0, x1, D = 4, 58, 60
    cx = (x0 + x1) / 2
    s.patch(x0 + 3, x1 - 3, 4, D - 3, P.court_fn(xr=(cx - 2, cx + 2), yr=(30, 33), grass=.18), mat='dirt')
    brick_wall(s, x0, x1, D - 4, D, 8)
    brick_wall(s, x0, x0 + 4, 0, D, 8)
    brick_wall(s, x1 - 4, x1, 0, D, 8)
    # 안: 고루(鼓樓) 가운데 뒤, 민가 좌우
    s.box(cx - 8, cx + 8, 38, 48, 0, 8, mat='greywall', tex='brick', role='keep', contour=True,
          decals=(('front', (cx - 2, cx + 2, 0, 5.5, 'arch')),))
    chall(s, cx - 6, 40, 12, 6, 4.5, 5.5, z0=8, double=True, over=2.0, roof='tile', band='jade')
    for (hx0, hy) in ((x0 + 6, 40), (x1 - 6 - 11, 40), (x0 + 7, 18), (x1 - 7 - 11, 18)):
        P.house(s, hx0, hy, 11, 6, wh=4.0, rise=4.4)
    P.tree(s, cx - 10, 24, 7, 2.8)
    P.tree(s, cx + 10, 24, 7, 2.8)
    brick_wall(s, x0, cx - 9, 0, 5, 9)
    brick_wall(s, cx + 9, x1, 0, 5, 9)
    arrow_tower(s, cx, -2, 18, 9, 10, 6, 6.5)
    for tx in (x0 + 2, x1 - 2):
        for ty in (2.5, D - 2):
            s.box(tx - 4, tx + 4, ty - 3.5, ty + 3.5, 0, 10, mat='greywall', tex='brick', role='tower', contour=True)
            s.crenels(tx - 4, tx + 4, ty - 3.5, ty + 3.5, 10, mat='greywall', step=1.6, h=1.4, edges=('front',), depth=1.0)
    return s


def harbor_city():
    """강 포구: 뒤 성벽·누각, 기와 민가, 아치 돌다리, 앞 부두에 대나무 돛 정크선 둘."""
    s = Scene()
    x0, x1, D = 2, 76, 46
    # 뒤 성벽 + 큰 누각(강변 망루)
    brick_wall(s, x0, x1, D - 4, D, 7)
    s.box(x0 + 40, x0 + 62, D - 12, D - 2, 0, 9, mat='greywall', tex='brick', role='keep', contour=True)
    chall(s, x0 + 43, D - 10, 16, 6, 5, 6.5, z0=9, double=True, over=2.2, roof='jade', band='redwall')
    # 민가(엇갈려)
    P.house(s, x0 + 4, 24, 10, 6, wh=4, rise=4.4, floors=2)
    P.house(s, x0 + 18, 28, 10, 6, wh=3.6, rise=4.2)
    P.house(s, x0 + 32, 22, 11, 6, wh=4, rise=4.4, floors=2)
    P.house(s, x0 + 64, 24, 9, 6, wh=3.8, rise=4.2)
    # 강가 석축
    s.box(x0, x0 + 48, 10, 18, 0, 3.2, mat='greywall', tex='brick', role='misc', contour=True)
    # 아치 돌다리(오른쪽, 강을 건넌다)
    s.box(x0 + 51, x0 + 67, 5, 11, 0, 5.4, mat='marble', tex='brick', role='misc', contour=True,
          decals=(('front', (x0 + 54.5, x0 + 63.5, 0, 4.4, 'arch')),))
    s.add(box(x0 + 51, x0 + 67, 5, 5.8, 5.4, 6.6, mat='marble', tex='plain', role='misc'))
    # 부두
    s.box(x0 + 6, x0 + 30, 2, 10, 0, 1.8, mat='wood', tex='plank', role='misc', contour=True)
    for px in (7, 15, 23, 29):
        s.box(x0 + px, x0 + px + 1.2, 1.4, 2.6, -1, 3, mat='wood', tex='plain', role='misc')
    # 정크선 둘 (붉은 대나무 돛)
    for (bx, by, L_, mh) in ((x0 + 2, -8, 24, 19), (x0 + 30, -12, 18, 15)):
        s.add(E.hull(bx, bx + L_, by, by + 5, 0, 3.2, rise=.9, mat='wood', tex='plank', role='misc', contour=True))
        s.add(box(bx + L_ - 5, bx + L_ - .8, by + .6, by + 4.4, 3.2, 6.0, mat='wood', tex='plank', role='misc', contour=True))
        for (mx, hh, sw) in ((bx + L_ * .34, mh, L_ * .5), (bx + L_ * .74, mh * .7, L_ * .36)):
            s.box(mx - .4, mx + .4, by + 2.6, by + 3.2, 3, 3 + hh, mat='wood', tex='plain', role='misc')
            s.box(mx - sw * .55, mx + sw * .45, by + 2.0, by + 2.6, 5.0, 3 + hh - .8, mat='junk', tex='ribs', role='misc', contour=True)
    return s


# ═══════════════════════════════════════════════════════════════════ 성
def castle():
    """무림 문파 본산: 산비탈을 깎은 3단 석축 위 청기와 대전, 가운데 곧은 돌계단, 좌우 배전, 뒤 바위 봉우리, 앞 패방 산문."""
    s = Scene()
    xc = 23
    # 뒤 바위 봉우리 + 소나무
    for (x, rx, rz) in ((8, 4.5, 8), (38, 4.5, 9.5)):
        s.add(E.Ellip(x, 33, rz * .9, rx, 3.5, rz, mat='crag', tex='strata', role='wall', contour=True))
    pine(s, 8, 33, 14.5, 4, 2.4, lean=-1, tiers=2)
    pine(s, 38, 33, 17, 4, 2.4, lean=1, tiers=2)
    # 3단 석축
    for (x0, x1, y0, z0, z1) in ((5, 41, 7, 0, 3.5), (8, 38, 14, 3.5, 7), (12, 34, 21, 7, 10.5)):
        s.box(x0, x1, y0, 31, z0, z1, mat='greywall', tex='brick', role='wall', contour=True)
        s.add(box(x0, x1, y0, y0 + .8, z1, z1 + .9, mat='marble', tex='plain', role='misc'))
    # 가운데 돌계단 (단마다)
    for (yb, ye, z0, z1) in ((2, 7.5, 0, 3.5), (7.5, 14.5, 3.5, 7), (14.5, 21.5, 7, 10.5)):
        n = 4
        for k in range(n):
            s.box(xc - 3, xc + 3, yb + (ye - yb) * k / n, ye, z0, z0 + (z1 - z0) * (k + 1) / n, mat='marble', tex='plain',
                  role='misc', contour=True)
    # 좌우 배전 (2단 위, 엇갈림)
    for hx0 in (9, 28):
        chall(s, hx0, 16, 9, 4, 3.4, 3.6, z0=7, roof='jade', wall='plaster', band='redwall', over=1.6, tips=1.0, nwin=0)
    # 대전
    chall(s, xc - 9, 24, 18, 4.5, 4.6, 6, z0=10.5, roof='jade', wall='plaster', band='redwall', double=True, over=2.2)
    # 산문(패방): 기둥 4 + 지붕 3
    py = 0
    for px in (xc - 9, xc - 4.6, xc + 3.4, xc + 7.8):
        s.box(px, px + 1.2, py, py + 1.2, 0, 7.5, mat='redwall', tex='plain', role='misc')
    s.add(box(xc - 9.4, xc + 9.4, py - .2, py + 1.4, 6.0, 7.5, mat='jade', tex='plain', role='misc'))
    E.tile_roof(s, xc - 5.6, xc + 5.6, py - 1.6, py + 2.8, 7.5, 2.8, mat='jade', tips=1.0)
    E.tile_roof(s, xc - 11, xc - 3, py - 1.2, py + 2.4, 6.6, 2.0, mat='jade', tips=.8)
    E.tile_roof(s, xc + 3, xc + 11, py - 1.2, py + 2.4, 6.6, 2.0, mat='jade', tips=.8)
    return s


def castle_b():
    """마교 총단: 검은 바위 위 검은 기와 대전, 현무암 성벽, 붉은 불 화로·붉은 깃발."""
    s = Scene()
    xc = 23
    s.add(E.Ellip(xc, 24, 2, 20, 14, 8, mat='basalt', tex='speck', role='ground', contour=True))
    s.box(xc - 19, xc + 19, 30, 34, 0, 10, mat='basalt', tex='brick', role='wall', contour=True)
    s.crenels(xc - 19, xc + 19, 30, 34, 10, mat='basalt', step=1.8, h=1.6, edges=('front',), depth=1.2)
    s.box(xc - 14, xc + 14, 18, 30, 0, 9, mat='basalt', tex='brick', role='wall', contour=True)
    chall(s, xc - 10, 21, 20, 7, 6, 8.5, z0=9, roof='blacktile', wall='redwall', band='basalt', double=True, over=2.8,
          door_mode='lavagate')
    # 앞 성벽 + 문
    s.box(xc - 19, xc + 19, 4, 9, 0, 7, mat='basalt', tex='brick', role='wall', contour=True,
          decals=(('front', (xc - 3, xc + 3, 0, 5.5, 'lavagate')),))
    s.crenels(xc - 19, xc + 19, 4, 9, 7, mat='basalt', step=1.8, h=1.6, edges=('front',), depth=1.2)
    s.box(xc - 19, xc - 14, 4, 34, 0, 8.5, mat='basalt', tex='brick', role='wall', contour=True)
    s.box(xc + 14, xc + 19, 4, 34, 0, 8.5, mat='basalt', tex='brick', role='wall', contour=True)
    # 문 위 검은 누각
    E.tile_roof(s, xc - 7, xc + 7, 2.6, 10.4, 8.6, 4.2, mat='blacktile', tips=1.6)
    # 화로(불) 양쪽
    for fx in (xc - 11, xc + 11):
        s.cyl(fx, 2.5, 1.8, 0, 3.0, mat='basalt', tex='plain', role='misc', contour=True)
        s.add(E.Ellip(fx, 2.5, 4.6, 1.8, 1.4, 2.6, mat='ember', tex='speck', role='nocast'))
        s.add(ob.Cone(fx, 2.5, 1.0, 5.6, 8.8, mat='ember', tex='plain', role='nocast'))
    # 붉은 깃발
    for fx, sd in ((xc - 16.5, 1), (xc + 16.5, -1)):
        s.box(fx - .4, fx + .4, 6, 6.8, 8.5, 20, mat='basalt', tex='plain', role='misc')
        x0f, x1f = (fx + .4, fx + 4.4) if sd > 0 else (fx - 4.4, fx - .4)
        s.box(x0f, x1f, 6.1, 6.7, 13, 19.6, mat='cloth', tex='plain', role='misc', contour=True)
    return s


# ═══════════════════════════════════════════════════════════════════ 마을
def large_town():
    """객잔 거리: 가운데 큰 2층 객잔(주기 깃발·홍등), 앞 청기와 찻집, 좌우 기와 민가."""
    s = Scene()
    P.house(s, 2, 22, 10, 6, wh=4.0, rise=4.4)
    P.house(s, 31, 22, 10, 6, wh=4.0, rise=4.4)
    P.house(s, 15, 17, 15, 7, wh=5.0, rise=5.0, floors=2)
    flag(s, 31.5, 15, 18, w=3.2, fh=6.5, mat='cloth')
    for lx in (16.5, 28.5):
        lantern(s, lx, 16, 4.0)
    P.house(s, 3, 3, 12, 6, wh=4.0, rise=4.2, floors=2)
    flag(s, 2.4, 1, 14, w=3.0, fh=4.5, mat='goldroof', side=1)
    P.house(s, 30, 3, 10, 6, wh=3.8, rise=4.2)
    s.box(19, 27, -1, 4, 0, 4.2, mat='wood', tex='plank', role='house', contour=True,
          decals=(('front', (21.5, 24.5, 0, 3, 'door')),))
    s.add(E.gable_ew(18, 28, -2, 5, 4.2, .9, mat='jade', contour=True, role='roof'))
    lantern(s, 19, -1.5, 3.6)
    lantern(s, 27, -1.5, 3.6)
    return s


def village():
    """산골 마을: 비탈 석축 위 뒷집과 앞집 둘(흙벽·청회 기와), 소나무."""
    s = Scene()
    s.box(6, 21, 13, 21, 0, 3.0, mat='greywall', tex='brick', role='wall', contour=True)
    for (x, y, w, d, wh, rise, zb) in ((8, 15, 10, 4.5, 4.0, 3.2, 3.0), (1.8, 2, 10, 5, 4.6, 3.4, 0), (16.2, 4, 9.2, 5, 4.4, 3.2, 0)):
        dec = (('front', (x + w / 2 - 1.1, x + w / 2 + 1.1, zb, zb + 3.2, 'door')), ('front', (x + 1.4, x + 3.0, zb + 1.8, zb + 3.4, 'lat')),
               ('front', (x + w - 3.0, x + w - 1.4, zb + 1.8, zb + 3.4, 'lat')))
        s.box(x, x + w, y, y + d, zb, zb + wh, mat='sand', tex='adobe', role='house', contour=True, decals=dec)
        E.tile_roof(s, x - 1.2, x + w + 1.2, y - 1.2, y + d + 1.2, zb + wh, rise, mat='tile', tips=1.0)
    pine(s, 23.5, 16, 0, 10, 2.6, lean=1)
    pine(s, 3.6, 15, 0, 8, 2.2, lean=-1, tiers=2)
    return s


def village_b():
    """대나무 숲 마을: 대숲 사이 초가 대나무집 둘."""
    s = Scene()
    bamboo(s, 6, 16, h=12, n=6, spread=2.2, seed=3)
    bamboo(s, 21.5, 17, h=13, n=6, spread=2.0, seed=5)
    bamboo(s, 14, 20, h=11, n=4, spread=2.4, seed=7)
    for (x, y, w, d, wh, rise) in ((3, 2, 10, 6, 3.8, 4.6), (16, 5, 9, 6, 3.6, 4.4)):
        s.box(x, x + w, y, y + d, 0, wh, mat='bamboo', tex='plank', role='house', contour=True,
              decals=(('front', (x + w / 2 - 1.1, x + w / 2 + 1.1, 0, 2.8, 'door')),))
        s.add(E.hip_t(x - 1.4, x + w + 1.4, y - 1.4, y + d + 1.4, wh, rise / (d / 2 + 1.4), mat='thatch', tex='speck',
                      contour=True, role='roof'))
    bamboo(s, 25.5, 3, h=10, n=3, spread=.8, seed=9)
    return s


def camp():
    """표국 야영: 짐 마차 + 표기(鏢旗) + 천막 + 모닥불."""
    s = Scene()
    # 천막(뒤)
    s.add(E.gable_ns(14, 27, 10, 18, 0, 6.0 / 6.5, mat='felt', tex='plain', contour=True, role='house'))
    s.box(19.6, 21.4, 9.9, 10.1, 0, 3.2, mat='ink', tex='plain', role='misc')
    # 마차
    s.box(3, 15, 2, 7, 2.0, 4.2, mat='wood', tex='plank', role='house', contour=True)
    for (bx, bw) in ((4, 4), (8.5, 5)):
        s.box(bx, bx + bw, 2.6, 6.4, 4.2, 6.8, mat='thatch', tex='speck', role='misc', contour=True)
    s.box(6.5, 10, 2.4, 6.6, 6.8, 7.6, mat='cloth', tex='plain', role='misc')
    wheel(s, 5.5, 1.6, 1.8)
    wheel(s, 12.5, 1.6, 1.8)
    s.box(15, 20, 4.2, 4.8, 2.6, 3.0, mat='wood', tex='plain', role='misc')
    # 표기
    s.box(1.0, 1.8, 9, 9.8, 0, 17, mat='wood', tex='plain', role='misc')
    s.box(1.8, 8.2, 9.1, 9.7, 11, 16.6, mat='goldroof', tex='plain', role='misc', contour=True,
          decals=(('front', (4.0, 6.0, 12.4, 15.2, 'red')),))
    # 모닥불
    s.cyl(23, 3, 1.8, 0, .6, mat='greywall', tex='plain', role='misc', contour=True)
    s.add(E.Ellip(23, 3, 1.6, 1.3, 1.0, 1.8, mat='ember', tex='speck', role='nocast'))
    return s


# ═══════════════════════════════════════════════════════════════════ 탑
def tower_small():
    """누각: 돌 기단 + 붉은 기둥 2층 + 청기와 겹처마."""
    s = Scene()
    cx, cy = 7, 3
    s.box(cx - 3.6, cx + 3.6, 0, 6, 0, 4, mat='greywall', tex='brick', role='wall', contour=True,
          decals=(('front', (cx - 1.4, cx + 1.4, 0, 3.0, 'arch')),))
    z = 4
    for (hw, hd, h, ov, rise) in ((2.8, 2.2, 5.4, .8, 2.4), (2.3, 1.8, 4.6, .7, 4.8)):
        s.box(cx - hw, cx + hw, cy - hd, cy + hd, z, z + h, mat='plaster', tex='plain', role='wall', contour=True,
              decals=(('front', (cx - 1, cx + 1, z + h * .25, z + h * .8, 'lat')),))
        E.pillars(s, cx - hw - .2, cx + hw + .2, cy - hd, z, z + h, 3, w=1.0, d=.8)
        s.add(box(cx - hw - .3, cx + hw + .3, cy - hd - .9, cy + hd, z + h - 1.0, z + h, mat='redwall', tex='plain', role='misc'))
        E.tile_roof(s, cx - hw - ov, cx + hw + ov, cy - hd - ov, cy + hd + ov, z + h, rise, mat='jade', tips=1.2)
        z += h + rise * .5
    s.add(ob.Cyl(cx, cy, .5, z + 1.6, z + 3.4, mat='goldroof', tex='plain', role='roof'))
    return s


def tower_great():
    """9층 팔각 전탑: 벽돌 몸통 층마다 청회 기와 처마, 금 상륜."""
    s = Scene()
    xc, yc = 14, 7.5
    s.add(E.oct_prism(xc, yc, 7.6, 0, 2.4, mat='marble', tex='brick', role='wall', contour=True))
    s.add(E.oct_prism(xc, yc, 6.4, 2.4, 4.6, mat='greywall', tex='brick', role='wall', contour=True))
    z = 4.6
    for i in range(9):
        a = 5.0 - .34 * i
        wh = 3.0 if i else 4.0
        s.add(E.oct_prism(xc, yc, a, z, z + wh, mat='wstone', tex='brick', role='wall', contour=True,
                          decals=(('front', (xc - .9, xc + .9, z + .6, z + wh - .5, 'arch' if i == 0 else 'win')),)))
        E.oct_roof(s, xc, yc, a + 1.7, z + wh, 2.1, mat='tile', fa=.5, fh=.3, tip=False)
        z += wh + 1.2
    s.add(ob.Cyl(xc, yc, .5, z - 1.0, z + 6, mat='goldroof', tex='plain', role='roof'))
    for k in (1.5, 3.0, 4.3):
        s.add(E.Ellip(xc, yc, z - 1.0 + k, 1.7 - k * .22, 1.7 - k * .22, .7, mat='goldroof', role='roof'))
    return s


# ═══════════════════════════════════════════════════════════════════ 지형 랜드마크
def cave():
    """수련 동굴: 바위 절벽 앞면에 판 동굴 입구, 그 오른쪽 절반을 가리는 폭포와 물웅덩이, 꼭대기 소나무."""
    s = Scene()
    s.add(E.Ellip(15, 12, 7, 11.5, 7, 9.5, mat='crag', tex='strata', role='wall', contour=True))
    s.add(E.Ellip(6.5, 9, 4, 4.5, 5, 6.5, mat='crag', tex='strata', role='wall', contour=True))
    s.add(E.Ellip(23.5, 9, 4, 4.5, 5, 7, mat='crag', tex='strata', role='wall', contour=True))
    s.box(6, 23, 2.5, 6, 0, 12, mat='crag', tex='strata', role='wall', contour=True,
          decals=(('front', (7.4, 14.0, 0, 8.5, 'arch')),))
    s.box(14.6, 20.6, 1.4, 2.4, .8, 15.5, mat='falls', tex='plank', role='nocast')
    s.add(E.Ellip(16, 1.0, .5, 7, 2.2, 1.0, mat='falls', tex='speck', role='nocast'))
    pine(s, 20, 12, 15, 5, 2.3, lean=1, tiers=2)
    return s


def ruin():
    """무너진 사당: 돌 기단 위 기운 붉은 기둥과 끊긴 들보, 무너진 담, 땅에 내려앉은 기와지붕 조각, 쓰러진 향로."""
    s = Scene()
    s.box(1, 28, 7, 18, 0, 2.4, mat='greywall', tex='brick', role='wall', contour=True)
    s.box(3, 9, 15, 17, 2.4, 8.5, mat='plaster', tex='plain', role='wall', contour=True)
    s.box(9, 13, 15, 17, 2.4, 5.0, mat='plaster', tex='plain', role='wall', contour=True)
    s.box(21, 26, 15, 17, 2.4, 6.4, mat='plaster', tex='plain', role='wall', contour=True)
    for (px, ph) in ((3.5, 11), (10, 5.0), (16.5, 10), (23, 3.5)):
        s.box(px, px + 2.0, 9, 11, 2.4, 2.4 + ph, mat='redwall', tex='plain', role='misc', contour=True)
    s.add(box(3, 19, 8.6, 11.2, 13.4, 14.8, mat='wood', tex='plank', role='misc', contour=True))
    E.tile_roof(s, 15, 30, 0, 7, 0, 3.6, mat='tile', tips=0, contour=True)
    s.box(22.5, 24.5, 4, 6, 3.4, 5.4, mat='redwall', tex='plain', role='misc', contour=True)
    s.cyl(5, 3, 2.2, 0, 2.6, mat='bronze', tex='plain', role='misc', contour=True)
    s.box(9, 13, .5, 3, 0, 1.4, mat='greywall', tex='brick', role='misc', contour=True)
    return s


def ruin_city():
    """장성 폐허: 능선을 따라 꺾여 가는 장성 구간 — 끊긴 틈, 무너진 봉화대, 벽돌 더미."""
    s = Scene()
    for (cx, cy, rx, ry, rz) in ((30, 32, 12, 6, 8), (50, 27, 8, 6, 5)):
        s.add(E.Ellip(cx, cy, 0, rx, ry, rz, mat='crag', tex='strata', role='ground', contour=True))
    # 장성 구간 (뒤로 꺾여 올라가며 높이가 들쭉날쭉, 끊긴 틈 둘)
    segs = ((1, 13, 8, 13, 11.0, True), (13, 22, 14, 19, 14.0, True), (22, 27, 20, 25, 8.0, False),
            (31, 40, 26, 31, 17.0, True), (44, 52, 21, 26, 7.0, False), (52, 58, 15, 20, 12.0, True))
    for (x0, x1, y0, y1, h, merl) in segs:
        s.box(x0, x1, y0, y1, 0, h, mat='greywall', tex='brick', role='wall', contour=True)
        if merl:
            s.crenels(x0, x1, y0, y1, h, mat='greywall', step=1.6, h=1.6, edges=('front',), depth=1.0)
    # 무너진 봉화대(가운데 앞)
    s.box(33, 43, 7, 15, 0, 15, mat='greywall', tex='brick', role='tower', contour=True,
          decals=(('front', (36.5, 39.5, 0, 5.5, 'arch')),))
    s.box(33, 38, 7, 15, 15, 20, mat='greywall', tex='brick', role='tower', contour=True)
    s.box(38, 40.5, 11, 15, 15, 16.8, mat='greywall', tex='brick', role='tower', contour=True)
    # 무너진 틈 앞 벽돌 더미
    for (x, y, w, d, h) in ((23, 12, 5, 3, 2.4), (26, 9, 3.4, 2.6, 1.4), (42, 14, 4, 3, 2.6), (45, 3, 4, 3, 1.6),
                            (4, 2, 4, 3, 1.6), (17, 5, 3, 2.4, 1.2)):
        s.box(x, x + w, y, y + d, 0, h, mat='greywall', tex='brick', role='misc', contour=True)
    pine(s, 9, 20, 0, 8, 2.6, lean=-1, tiers=2)
    pine(s, 52, 5, 0, 7, 2.6, lean=1, tiers=2)
    return s


def shrine():
    """소림사풍 사찰: 황토 담과 산문, 높은 기단 대웅전(청회 기와 겹처마), 옆 탑림(작은 전탑들), 앞 향로."""
    s = Scene()
    xc = 20
    # 뒤 대웅전
    s.box(xc - 14, xc + 14, 22, 34, 0, 5, mat='greywall', tex='brick', role='wall', contour=True)
    stairs(s, xc, 6, 22, 5, n=3, mat='greywall')
    chall(s, xc - 11, 25, 22, 7, 6, 7.5, z0=5, roof='tile', wall='ochre', band='jade', double=True, over=2.6)
    # 탑림(오른쪽 뒤)
    for (tx, ty, h) in ((37, 30, 12), (41, 24, 9), (35, 20, 7)):
        s.box(tx - 2, tx + 2, ty - 2, ty + 2, 0, 2, mat='greywall', tex='brick', role='misc', contour=True)
        s.add(E.oct_prism(tx, ty, 1.5, 2, h, mat='wstone', tex='brick', role='tower', contour=True))
        s.add(E.oct_pyr(tx, ty, 2.0, h, h + 2.4, mat='tile', tex='plain', role='roof', contour=True))
    # 황토 담 + 산문
    for (x0, x1) in ((2, xc - 7), (xc + 7, 32)):
        s.box(x0, x1, 4, 6.5, 0, 6, mat='ochre', tex='plain', role='wall', contour=True)
        s.add(box(x0 - .6, x1 + .6, 3.4, 7.1, 6, 7.2, mat='tile', tex='plain', role='misc', contour=True))
    s.box(2, 4.5, 4, 34, 0, 6, mat='ochre', tex='plain', role='wall', contour=True)
    chall(s, xc - 7, 3, 14, 5, 6, 5.5, z0=0, roof='tile', wall='redwall', band='jade', over=2.0, nwin=0, door_mode='arch')
    # 향로
    s.cyl(xc + 6, 13, 1.8, 0, 3.2, mat='greywall', tex='plain', role='misc', contour=True)
    s.add(ob.Cone(xc + 6, 13, 2.4, 3.2, 5.2, mat='greywall', tex='plain', role='misc', contour=True))
    P.tree(s, xc - 9, 15, 8, 3.0)
    return s


def landmark_nature():
    """기암 소나무 봉우리: 세 개의 가파른 바위 기둥, 바위에 붙은 소나무, 허리에 걸친 구름."""
    s = Scene()
    for (x, y, rx, h, z0) in ((23, 12, 6.0, 31, 0), (12, 9, 4.6, 24, 0), (34, 8, 4.6, 20, 0), (29, 3, 3.4, 12, 0)):
        s.add(E.Ellip(x, y, z0 + h * .5, rx, rx * .8, h * .5, mat='crag', tex='strata', role='wall', contour=True))
        s.add(E.Ellip(x - rx * .3, y - 1, z0 + h * .38, rx * .7, rx * .6, h * .36, mat='crag', tex='strata', role='wall', contour=True))
    pine(s, 23, 12, 29.5, 5, 3.6, lean=1, tiers=2)
    pine(s, 12, 9, 22.5, 4.5, 3.0, lean=-1, tiers=2)
    pine(s, 34, 8, 18.5, 4, 2.6, lean=1, tiers=2)
    pine(s, 27.5, 2, 11, 4, 2.4, lean=-1, tiers=2)
    cloud(s, 10, 1, 9, 6.5)
    cloud(s, 35, -1, 5, 7)
    return s


def circle():
    """팔괘진: 팔각 돌 단 위에 태극과 팔괘 무늬, 가운데 뒤 청동 향로, 둘레 돌기둥."""
    s = Scene()
    xc, yc, r = 15, 13, 14
    s.add(E.oct_prism(xc, yc, r, 0, 2.0, mat='greywall', tex='brick', role='wall', contour=True))
    a = r * .7
    stn = np.array(ob.MAT['stone'], np.uint8)

    def bagua(x, y):
        dx, dy = x - xc, y - yc
        rr = np.hypot(dx, dy)
        th = np.arctan2(dy, dx)
        col = stn[np.clip((4 + ob.hsh(x, y, 3) * 1.6).astype(int), 0, 6)]
        col = np.where((np.abs(rr - a * .98) < .6)[:, None], stn[2], col)
        # 태극
        yin = (rr < a * .34) & ((dx < 0) ^ (np.hypot(dx, dy - a * .17 * np.sign(dx + 1e-6)) < a * .17))
        yang = (rr < a * .34) & ~yin
        col = np.where(yin[:, None], np.array(hx('1d2c33'), np.uint8), col)
        col = np.where(yang[:, None], np.array(SNOW[5], np.uint8), col)
        # 팔괘: 8 방향마다 반지름 .55~.9 사이 세 줄
        sec = np.mod(np.round(th / (np.pi / 4)), 8).astype(int)
        cen = sec * (np.pi / 4)
        dth = np.angle(np.exp(1j * (th - cen)))
        band = (rr > a * .5) & (rr < a * .9) & (np.abs(dth) * rr < a * .22)
        k = np.floor((rr - a * .5) / (a * .4 / 3)).astype(int)
        line = band & (np.mod((rr - a * .5), a * .4 / 3) < a * .4 / 3 * .62)
        broken = ((sec * 7 + k * 3) % 5 < 2) & (np.abs(dth) * rr < a * .05)
        col = np.where((line & ~broken)[:, None], np.array(hx('1d2c33'), np.uint8), col)
        return col
    s.patch(xc - a, xc + a, yc - a, yc + a, bagua, z=1.9, h=.25, mat='stone')
    for k in range(8):
        th = math.radians(-90 + 45 * k + 22.5)
        px, py = xc + (r - 1.6) * math.cos(th), yc + (r - 1.6) * math.sin(th)
        if py < yc - 4:
            continue
        s.box(px - .9, px + .9, py - .9, py + .9, 2.0, 7.0, mat='wstone', tex='plain', role='misc', contour=True)
    # 향로(정鼎)
    s.cyl(xc, yc + 6.5, 2.2, 2.0, 5.5, mat='bronze', tex='plain', role='misc', contour=True)
    s.add(box(xc - 2.8, xc + 2.8, yc + 6.1, yc + 6.9, 5.5, 6.3, mat='bronze', tex='plain', role='misc'))
    return s


def volcano():
    """화염산: 세로 골이 패인 검붉은 사암 산등성이(가로로 긴 능선)와 등성이마다 일렁이는 노란 불꽃."""
    s = Scene()
    for (x, y, r, h) in ((15, 11, 11.5, 15), (6.5, 6, 6, 9), (23.5, 6, 6.5, 10)):
        s.add(ob.Cone(x, y, r, 0, h, mat='redrock', tex='plank', role='wall', contour=True))
    s.add(E.Ellip(15, 7, 3, 14, 3.5, 3.5, mat='redrock', tex='plank', role='wall', contour=True))
    for (x, y, z, r, h) in ((15, 9, 10.5, 3.4, 9), (8.5, 6, 6.5, 2.6, 7), (22, 6, 7.5, 2.8, 7.5), (4.5, 5, 4.5, 1.6, 4.5), (26, 5, 5, 1.6, 4.5)):
        s.add(E.Ellip(x, y, z, r * 1.25, r, 2.0, mat='flame', tex='speck', role='nocast'))
        s.add(ob.Cone(x, y, r, z, z + h, mat='flame', tex='plain', role='nocast'))
        s.add(ob.Cone(x + r * .5, y - .5, r * .45, z + .5, z + h * .6, mat='flame', tex='plain', role='nocast'))
    return s


def floating():
    """구름 위 선계: 거꾸로 선 바위섬 위 청기와·금기와 누각, 소나무, 흘러내리는 폭포, 나는 학, 섬 밑 구름."""
    s = Scene()
    xc, yc = 38, 14
    s.add(E.InvCone(xc, yc, 21, 0, 13, mat='rock', tex='speck', role='wall', contour=True))
    s.add(E.Ellip(xc, yc, 13.2, 22, 12, 2.2, mat='leaf2', tex='speck', role='ground', contour=True))
    zb = 14.5
    # 뒤 누각(엇갈려 왼쪽)
    s.box(xc - 16, xc - 2, yc + 1, yc + 9, zb, zb + 2, mat='marble', tex='brick', role='misc', contour=True)
    chall(s, xc - 14, yc + 3, 10, 5, 4.5, 6, z0=zb + 2, roof='goldroof', wall='redwall', band='jade', over=2.0)
    # 앞 큰 전각(오른쪽)
    s.box(xc - 4, xc + 18, yc - 7, yc + 3, zb, zb + 2.4, mat='marble', tex='brick', role='misc', contour=True)
    chall(s, xc - 1, yc - 4, 16, 6, 5.5, 7, z0=zb + 2.4, roof='jade', wall='redwall', band='goldroof', double=True, over=2.4)
    pine(s, xc - 19, yc - 3, zb - 1, 7, 3.0, lean=-1, tiers=2)
    # 섬 가장자리 폭포
    s.box(xc + 19, xc + 19.5, yc - 6, yc - 4.5, 2, 15.5, mat='falls', tex='plank', role='nocast')
    # 학
    crane(s, 8, 6, 36, 1)
    crane(s, 68, 10, 40, -1)
    crane(s, 14, 2, 24, 1)
    # 구름
    cloud(s, 14, 6, 6, 11)
    cloud(s, 62, 4, 5, 12)
    cloud(s, 38, -2, 1.5, 15, 5, 4)
    return s


ORDER = [
    ('capital', '황도 자금성', 'capital', (6, 6), '붉은 궁 담·오문 겹지붕·한백옥 3단 기단 위 노란 기와 태화전·좌우 배전'),
    ('fort_city', '장성 성곽 도시', 'fort_city', (4, 4), '회색 벽돌 성벽·총안·전루·모서리 각루·안의 고루와 기와 민가'),
    ('harbor_city', '강 포구', 'harbor_city', (5, 4), '뒤 성벽·강변 누각·기와 민가·아치 돌다리·부두의 대나무 돛 정크선 둘'),
    ('castle', '무림 문파 본산', 'castle', (3, 3), '바위산 위 높은 기단 청기와 대전·종루 고루·긴 돌계단·앞 패방 산문'),
    ('castle', '마교 총단', 'castle_b', (3, 3), '검은 바위·현무암 성벽 안 검은 기와 대전·붉은 문·불 화로·붉은 깃발'),
    ('large_town', '객잔 거리', 'large_town', (3, 3), '2층 객잔(주기·홍등)·청기와 찻집·기와 민가'),
    ('village', '산골 마을', 'village', (2, 2), '흙벽 청회 기와집 셋과 소나무'),
    ('village', '대나무 숲 마을', 'village_b', (2, 2), '대숲 사이 초가지붕 대나무집 둘'),
    ('camp', '표국 야영', 'camp', (2, 2), '짐 실은 마차·노란 표기·천막·모닥불'),
    ('tower_small', '누각', 'tower_small', (1, 2), '돌 기단 위 붉은 기둥 2층 누각, 청기와 겹처마'),
    ('tower_great', '9층 팔각 전탑', 'tower_great', (2, 4), '한백옥 기단·벽돌 팔각 몸통 9층·층마다 기와 처마·금 상륜'),
    ('cave', '수련 동굴', 'cave', (2, 2), '바위 절벽 동굴 입구를 반쯤 가린 폭포와 물웅덩이, 꼭대기 소나무'),
    ('ruin', '무너진 사당', 'ruin', (2, 2), '부러진 붉은 기둥·반쯤 남은 담·땅에 내려앉은 기와지붕·쓰러진 향로'),
    ('ruin_city', '장성 폐허', 'ruin_city', (4, 3), '능선 따라 끊긴 장성 구간·무너진 봉화대·벽돌 더미'),
    ('shrine', '소림사', 'shrine', (3, 3), '황토 담·산문·높은 기단 대웅전 겹처마·탑림·향로'),
    ('landmark_nature', '기암 소나무 봉우리', 'landmark_nature', (3, 3), '가파른 바위 기둥 셋·꼭대기 소나무·허리 구름'),
    ('circle', '팔괘진', 'circle', (2, 2), '팔각 돌 단 위 태극·팔괘 무늬, 돌기둥, 청동 향로'),
    ('volcano', '화염산', 'volcano', (2, 2), '세로 골 패인 붉은 사암 산과 꼭대기 불꽃'),
    ('floating', '구름 위 선계', 'floating', (5, 4), '거꾸로 선 바위섬 위 금·청기와 누각, 소나무, 폭포, 학, 구름'),
]
