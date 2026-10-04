"""고대 그리스·로마(classical) 월드맵 아이콘 — 정면 카메라용 장면.
흰 대리석(따뜻한 흰 돌) · 붉은 테라코타 기와 · 도리아 기둥 · 올리브(은록) · 산토리니 파란 돔.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / '_scene3d'))
import math  # noqa: E402
import numpy as np  # noqa: E402
import oblique as ob  # noqa: E402
import east as E  # noqa: E402
import modsf_kit as M  # noqa: E402
from oblique import Scene, box  # noqa: E402
from icons_v9_lib import WSTONE, SNOW, RED, LEAF, VOLC, GOLD, WOOD, STONE, ROCK, GREY  # noqa: E402

SET = dict(id='classical', name='고대 그리스·로마')

# ── 재질(전부 World.png 색) ─────────────────────────────────────────────────────────────────────
ob.MAT.update({
    'marble': [WSTONE[1], WSTONE[2], WSTONE[3], WSTONE[4], WSTONE[5], SNOW[5]],
    'pshade': [GREY[1], WSTONE[1], GREY[3], WSTONE[2]],               # 주랑 안쪽 그늘(신전 내실 벽)
    'olive': [LEAF[1], LEAF[3], VOLC[4], LEAF[5], VOLC[5]],
    'seat': [WSTONE[1], WSTONE[2], WSTONE[3], WSTONE[5]],
    'swhite': [WSTONE[2], WSTONE[3], WSTONE[5], WSTONE[5]],
    'cypress': [LEAF[0], LEAF[1], LEAF[2], LEAF[3], LEAF[4]],
    'snow': [SNOW[0], SNOW[1], SNOW[3], SNOW[4], SNOW[5]],
    'ash': [GREY[1], GREY[2], VOLC[1], VOLC[2], VOLC[3], VOLC[4], VOLC[5]],
    'ochre': [ROCK[3], ROCK[5], GOLD[2], GOLD[3], GOLD[4]],
    'pomp': [RED[1], RED[2], RED[3], RED[4]],                          # 폼페이 붉은 벽
    'bronze': [GOLD[0], GOLD[1], GOLD[2], GOLD[3], GOLD[4]],
    'leather': [ROCK[2], ROCK[4], ROCK[6], ROCK[8], ROCK[9]],
    'smoke': [GREY[2], GREY[3], VOLC[4], WSTONE[3], WSTONE[4]],
})


# ── 결: 테라코타 기와(경사 방향을 따라 줄) ────────────────────────────────────────────────────────
_prev_tex = ob._tex_delta


def _tex3(p, tag, P_, face):
    if p.tex == 'rtile' and isinstance(p, ob.Poly):
        x, y, z = P_[:, 0], P_[:, 1], P_[:, 2]
        d = np.zeros(len(x), int)
        n = p.n[face]
        sl = (n[:, 2] < .97) & (n[:, 2] > 0.05)
        side = np.abs(n[:, 0]) > np.abs(n[:, 1])
        d[sl & side & (np.mod(y, 3) < 1)] -= 1
        d[sl & ~side & (np.mod(np.floor(x), 2) == 0)] -= 1
        return d
    if p.tex == 'dress':          # 다듬은 돌(성긴 가로 줄눈)
        x, y, z = P_[:, 0], P_[:, 1], P_[:, 2]
        d = np.zeros(len(x), int)
        vert = np.isin(np.asarray(tag, dtype=object), ['front', 'back', 'left', 'right', 'side'])
        d[vert & (np.mod(z, 4) < 1)] -= 1
        d[vert & (hsh2(x, z) > .95)] += 1
        return d
    return _prev_tex(p, tag, P_, face)


def hsh2(a, b):
    return ob.hsh(a, b, 21)


ob._tex_delta = _tex3


# ═══════════════════════════════════════════ 부품 ═══════════════════════════════════════════
def column(s, x, y, r, z0, z1, mat='marble', cap=True):
    s.cyl(x, y, r, z0, z1, mat=mat, tex='plain', role='misc')
    if cap:
        s.box(x - r - .45, x + r + .45, y - r - .45, y + r + .45, z1 - .9, z1, mat=mat, tex='plain', role='misc')


def colonnade(s, x0, x1, y, r, z0, z1, n, mat='marble'):
    for i in range(n):
        cx = x0 + r + (x1 - x0 - 2 * r) * i / max(n - 1, 1)
        column(s, cx, y, r, z0, z1, mat=mat)


def steps(s, x0, x1, y0, y1, z, n=3, h=1.0, inset=1.0, mat='marble'):
    for i in range(n):
        k = (n - 1 - i) * inset
        s.box(x0 - k, x1 + k, y0 - k, y1 + k, z + i * h, z + (i + 1) * h, mat=mat, tex='plain', role='wall', contour=True)
    return z + n * h


def temple(s, x0, x1, y0, y1, z=0.0, colh=8.0, ncol=6, r=1.0, roof='redroof', nsteps=3, rise=None, gold=False, ped='marble',
           frieze=True, back=False):
    """주랑 신전: 기단 계단 + 앞 주랑 + 그늘진 내실 + 엔타블러처 + 앞 박공(삼각 페디먼트) + 테라코타 박공지붕(마루가 앞뒤)."""
    zb = steps(s, x0, x1, y0, y1, z, n=nsteps)
    s.box(x0 + 1.6, x1 - 1.6, y0 + 2.6, y1 - 1.0, zb, zb + colh, mat='pshade', tex='plain', role='house', contour=False,
          decals=(('front', ((x0 + x1) / 2 - 1.2, (x0 + x1) / 2 + 1.2, zb, zb + colh * .7, 'dark')),))
    colonnade(s, x0 + .2, x1 - .2, y0 + 1.0 + r, r, zb, zb + colh, ncol)
    if back:
        colonnade(s, x0 + .2, x1 - .2, y1 - 1.0 - r, r, zb, zb + colh, ncol)
    ze = zb + colh
    s.box(x0 - .2, x1 + .2, y0 + .2, y1 - .2, ze, ze + 1.4, mat='marble', tex='plain', role='wall', contour=True)
    if frieze:
        s.box(x0 - .2, x1 + .2, y0 + .2, y0 + .6, ze + 1.4, ze + 2.4, mat='marble', tex='plain', role='wall', contour=True,
              decals=tuple(('front', (xx, xx + .9, ze + 1.4, ze + 2.4, 'dark')) for xx in np.arange(x0 + .6, x1 - .4, 2.4)))
        s.box(x0 - .2, x1 + .2, y0 + .6, y1 - .2, ze + 1.4, ze + 2.4, mat='marble', tex='plain', role='wall', contour=True)
        ze += 2.4
    w = x1 - x0 + 1.2
    rise = rise or w * .26
    sl = rise / (w / 2)
    s.add(E.gable_ns(x0 - .6, x1 + .6, y0 + .8, y1 + .2, ze, sl, mat=roof, tex='rtile', contour=True, role='roof'))
    s.add(E.gable_ns(x0 - .6, x1 + .6, y0 - .2, y0 + .8, ze, sl, mat=ped, tex='plain', contour=True, role='roof'))
    if gold:
        cx = (x0 + x1) / 2
        s.box(cx - .7, cx + .7, y0 - .2, y0 + .6, ze + rise - .2, ze + rise + 1.6, mat='gold', tex='plain', role='misc')
    return ze + rise


def villa(s, x, y, w, d, wh=4.0, rise=3.2, wall='marble', roof='redroof', door=True, win=True):
    """붉은 기와 우진각 집."""
    cx = x + w / 2
    dec = []
    if door:
        dec.append(('front', (cx - 1.0, cx + 1.0, 0, 2.8, 'door')))
    if win and w >= 9:
        for wx in (x + 2, x + w - 3):
            dec.append(('front', (wx, wx + 1, 2.0, 3.0, 'dark')))
    s.box(x, x + w, y, y + d, 0, wh, mat=wall, tex='plain', role='house', contour=True, decals=tuple(dec))
    s.hip(x - .8, x + w + .8, y - .8, y + d + .8, wh, rise / (min(w, d) / 2 + .8), mat=roof, tex='rtile', contour=True, role='roof')


def atrium_house(s, x, y, w, d, wh=3.6, wing=4.0, wall='marble', roof='redroof'):
    """안뜰 집(도무스): 네 날개 지붕이 가운데 안뜰을 둘러싼다. 앞 날개가 낮아 안뜰이 보인다."""
    s.patch(x + wing, x + w - wing, y + wing, y + d - wing, court_fn(), z=0, h=.4, mat='stone')
    s.cyl(x + w / 2, y + d / 2, 1.1, 0, .9, mat='marble', tex='plain', role='nocast')
    sl = 2.6 / (wing / 2)
    # 뒤 날개(높다)
    s.box(x, x + w, y + d - wing, y + d, 0, wh + .8, mat=wall, tex='plain', role='house', contour=True)
    s.add(ob.gable(x - .6, x + w + .6, y + d - wing - .6, y + d + .6, wh + .8, sl, mat=roof, tex='rtile', contour=True, role='roof'))
    # 좌우 날개
    for (a, b) in ((x, x + wing), (x + w - wing, x + w)):
        s.box(a, b, y + wing, y + d - wing, 0, wh, mat=wall, tex='plain', role='house', contour=True)
        s.add(E.gable_ns(a - .6, b + .6, y + wing - .2, y + d - wing + .2, wh, sl, mat=roof, tex='rtile', contour=True, role='roof'))
    # 앞 날개(낮다)
    cx = x + w / 2
    s.box(x, x + w, y, y + wing * .7, 0, wh - .6, mat=wall, tex='plain', role='house', contour=True,
          decals=(('front', (cx - 1, cx + 1, 0, 2.6, 'door')),))
    s.add(ob.gable(x - .6, x + w + .6, y - .6, y + wing * .7 + .6, wh - .6, 2.0 / (wing * .35 + .6), mat=roof, tex='rtile', contour=True, role='roof'))


def court_fn(grass=0.0):
    stn = np.array(ob.MAT['marble'], np.uint8)

    def fn(x, y):
        return stn[np.clip((2 + ob.hsh(np.floor(x / 2), np.floor(y / 2), 7) * 2.4).astype(int), 0, 5)]
    return fn


def olive(s, x, y, r=2.6, h=3.0):
    s.cyl(x, y, .6, 0, h, mat='wood', tex='plain', role='misc')
    s.add(E.Ellip(x, y, h + r * .45, r, r * .8, r * .62, mat='olive', tex='speck', role='misc', contour=True))
    s.add(E.Ellip(x - r * .5, y - .4, h + r * .25, r * .55, r * .5, r * .42, mat='olive', tex='speck', role='misc', contour=True))


def cypress(s, x, y, h=9.0, r=1.4):
    s.add(E.Ellip(x, y, h * .52, r, r, h * .5, mat='cypress', tex='speck', role='misc', contour=True))


def pine(s, x, y, h=8.0, r=3.4):
    """우산소나무: 가는 줄기 + 납작한 수관."""
    s.cyl(x, y, .55, 0, h, mat='wood', tex='plain', role='misc')
    s.add(E.Ellip(x, y, h + .8, r, r * .8, 1.4, mat='cypress', tex='speck', role='misc', contour=True))


def ring_segments(s, cx, cy, a, b, z0, z1, n, thick=2.2, mat='marble', tex='plain', post=None, contour=True,
                  th0=0.0, th1=2 * math.pi, role='wall'):
    """타원 고리를 n 조각의 회전 상자로 짓는다(속이 빈 원형 건물)."""
    span = th1 - th0
    full = abs(span - 2 * math.pi) < 1e-6
    k = n if full else n - 1
    for i in range(n):
        th = th0 + span * (i + (.5 if full else 0)) / k
        px, py = cx + a * math.cos(th), cy + b * math.sin(th)
        tx, ty = -a * math.sin(th), b * math.cos(th)
        ang = math.atan2(ty, tx)
        seg = math.hypot(tx, ty) * span / k * 1.18
        p = M.obox((px, py, (z0 + z1) / 2), (seg, thick, z1 - z0), M.rot_z(ang), mat=mat, tex=tex, role=role, contour=contour)
        p.post = post
        s.add(p)


def arcade_post(cx, cy, a, b, z0, rows, mat='marble', period=3.0, attic=None):
    """원형 외벽 아치 창: 바깥 방향 면에 층마다 아치 줄."""
    rp = ob.MAT[mat]

    def post(tag, P, col, sh, nrm):
        x, y, z = P[:, 0], P[:, 1], P[:, 2]
        rx, ry = (x - cx) / a, (y - cy) / b
        out = (nrm[:, 0] * rx + nrm[:, 1] * ry) > .2
        phi = np.arctan2(ry, rx)
        arc = phi * (a + b) / 2
        m = np.zeros(len(x), bool)
        for (r0, r1) in rows:
            m |= (z >= r0) & (z < r1) & (np.mod(arc, period) < period * .5)
        m &= out
        res = np.where(m[:, None], ob._darken(rp, sh * .5, -1), col)
        if attic is not None:
            band = out & (np.abs(z - attic) < .5)
            res = np.where(band[:, None], ob._darken(rp, sh, -1), res)
        return res.astype(np.uint8)
    return post


def aqueduct(s, x0, x1, y, h, tiers=2, span=5.0, mat='marble', d=2.2):
    """수도교: 아치가 층층이 뚫린 긴 다리 + 맨 위 수로."""
    zt = 0.0
    th = h / tiers
    for t in range(tiers):
        sp = span if t == 0 else span * .5
        dec = tuple(('front', (xx + sp * .22, xx + sp * .78, zt, zt + th - .9, 'arch')) for xx in np.arange(x0, x1 - sp * .5, sp))
        s.box(x0, x1, y, y + d, zt, zt + th, mat=mat, tex='dress', role='wall', contour=True, decals=dec)
        zt += th
    s.box(x0 - .3, x1 + .3, y - .3, y + d + .3, zt, zt + 1.2, mat=mat, tex='plain', role='wall', contour=True)
    return zt + 1.2


def palisade(s, x0, x1, y0, y1, h, mat='wood'):
    s.box(x0, x1, y0, y1, 0, h, mat=mat, tex='plank', role='wall', contour=True)
    # 말뚝 끝(뾰족한 이빨)
    for xx in np.arange(x0 + .5, x1 - .4, 2.0):
        s.box(xx, xx + 1.0, y0, y0 + .8, h, h + 1.0, mat=mat, tex='plain', role='merlon')


def wood_tower(s, xc, yc, w, h, roof='redroof'):
    s.box(xc - w / 2, xc + w / 2, yc - w / 2, yc + w / 2, 0, h, mat='wood', tex='plank', role='tower', contour=True,
          decals=(('front', (xc - .7, xc + .7, h - 2.6, h - 1.2, 'dark')),))
    s.hip(xc - w / 2 - .8, xc + w / 2 + .8, yc - w / 2 - .8, yc + w / 2 + .8, h, 1.0, mat=roof, tex='rtile', contour=True, role='roof')


def eagle_standard(s, x, y, h=11.0):
    s.box(x - .5, x + .5, y - .5, y + .5, 0, h, mat='wood', tex='plain', role='misc', contour=True)
    s.box(x - 1.8, x + 1.8, y - .7, y - .2, h - 5.0, h - 1.8, mat='cloth', tex='plain', role='misc', contour=True,
          decals=(('front', (x - 1.8, x + 1.8, h - 2.6, h - 2.0, 'gold')),))
    s.box(x - 2.2, x + 2.2, y - .6, y + .6, h - 1.6, h - .7, mat='gold', tex='plain', role='misc', contour=True)
    s.box(x - .8, x + .8, y - .6, y + .6, h - .7, h + 1.0, mat='gold', tex='plain', role='misc', contour=True)


def spiral_post(xc, yc, mat='marble', pitch=3.0):
    rp = ob.MAT[mat]

    def post(tag, P, col, sh, nrm):
        phi = np.arctan2(P[:, 1] - yc, P[:, 0] - xc)
        side = np.abs(nrm[:, 2]) < .5
        m = side & (np.mod(P[:, 2] + phi / (2 * math.pi) * pitch, pitch) < 1.0)
        return np.where(m[:, None], ob._darken(rp, sh, -1), col).astype(np.uint8)
    return post


def smoke(s, x, y, z, n=4, r0=2.0, mat='smoke'):
    for i in range(n):
        r = r0 * (1 + .25 * i)
        s.add(M.Dome(x + (i % 2) * 1.6 + i * .9, y, z + i * r0 * 1.5, r, zmin=-99, mat=mat, role='steam', contour=True))


# ═══════════════════════════════════════════ 장면 ═══════════════════════════════════════════
def capital():
    """로마: 앞에 콜로세움, 뒤에 수도교, 오른쪽 뒤 신전, 왼쪽 뒤 판테온, 붉은 지붕 집과 우산소나무."""
    s = Scene()
    aqueduct(s, 6, 86, 98, 16, tiers=2, span=6.0)
    # 판테온: 원통 + 납빛 돔 + 앞 현관(회색 지붕)
    px, py = 20, 72
    s.cyl(px, py, 10, 0, 11, mat='marble', tex='dress', role='house', contour=True)
    s.cyl(px, py, 10.4, 10.2, 11.2, mat='marble', tex='plain', role='house', contour=True)
    s.add(M.Dome(px, py, 11, 9.4, zmin=11, mat='oldgrey', role='roof', contour=True))
    s.cyl(px, py, 2.0, 20.0, 20.8, mat='pshade', tex='plain', role='misc')
    temple(s, px - 7, px + 7, py - 15, py - 8, colh=7, ncol=4, r=1.0, nsteps=2, frieze=False, roof='oldgrey')
    # 카피톨리노 신전(오른쪽 뒤, 높은 기단 + 앞 계단)
    s.box(52, 88, 56, 80, 0, 5, mat='marble', tex='dress', role='wall', contour=True)
    for i in range(5):
        s.box(62, 78, 50 + i * 1.2, 56.5, 0, (i + 1) * 1.0, mat='marble', tex='plain', role='misc', contour=True)
    temple(s, 57, 83, 60, 76, z=5, colh=10, ncol=6, r=1.2, nsteps=2, gold=True)
    for (hx, hy, w, d, wh) in ((50, 40, 11, 8, 5), (66, 42, 10, 7, 4.5), (78, 40, 10, 8, 5.5),
                                (54, 22, 10, 7, 4.5), (70, 24, 9, 7, 5), (79, 20, 9, 8, 4.5),
                                (52, 4, 10, 7, 4), (67, 4, 11, 8, 5), (79, 3, 9, 7, 4),
                                (4, 50, 10, 7, 4.5), (36, 52, 10, 7, 4)):
        villa(s, hx, hy, w, d, wh=wh, rise=3.4)
    cx, cy, a, b = 25, 24, 20, 15
    s.add(E.Ellip(cx, cy, 0, a * .5, b * .45, 1.0, mat='dirt', tex='speck', role='ground'))
    ring_segments(s, cx, cy, a * .62, b * .58, 0, 6, 22, thick=4.0, mat='seat', role='wall')
    ring_segments(s, cx, cy, a * .82, b * .8, 0, 11, 26, thick=4.0, mat='seat', role='wall')
    post = arcade_post(cx, cy, a, b, 0, rows=((1, 4.6), (6, 9.6), (11, 14.4)), period=3.2, attic=16.4)
    ring_segments(s, cx, cy, a, b, 0, 18, 34, thick=2.6, mat='marble', tex='plain', post=post)
    for (tx, ty) in ((47, 32), (47, 14), (6, 42), (40, 44), (88, 32), (64, 16)):
        pine(s, tx, ty, 6, 3.6)
    for (tx, ty) in ((48, 60), (34, 64), (88, 54)):
        cypress(s, tx, ty, 10, 1.3)
    return s


def fort_city():
    """아크로폴리스: 깎아지른 바위 언덕 위 성벽과 파르테논, 언덕 아래 붉은 지붕 마을."""
    s = Scene()
    xc, yc = 32, 34
    s.add(E.oct_pyr(xc, yc, 25, 0, 36, ztrunc=15, mat='rock', tex='strata', role='wall', contour=True))
    zt = 15
    # 언덕 위 성벽(앞 가장자리)
    s.box(xc - 16, xc + 16, yc - 16, yc - 13.5, zt - 4, zt + 3.2, mat='marble', tex='dress', role='wall', contour=True)
    s.crenels(xc - 16, xc + 16, yc - 16, yc - 13.5, zt + 3.2, mat='marble', step=2.2, h=1.4, edges=('front',), depth=1.2)
    # 프로필라이아(문)
    temple(s, xc - 16, xc - 6, yc - 13, yc - 8, z=zt, colh=4.5, ncol=4, r=.8, nsteps=1, frieze=False)
    # 파르테논
    temple(s, xc - 6, xc + 15, yc - 4, yc + 9, z=zt, colh=8, ncol=7, r=1.0, nsteps=2, gold=True)
    # 에렉테이온(왼쪽 뒤 작은 신전)
    temple(s, xc - 15, xc - 7, yc + 2, yc + 10, z=zt, colh=5, ncol=3, r=.8, nsteps=1, frieze=False)
    # 언덕 아래 집들
    for (hx, hy, w, d) in ((3, 2, 9, 6), (13, 0, 8, 6), (43, 0, 9, 6), (52, 3, 8, 6), (2, 14, 7, 6), (53, 14, 7, 6)):
        villa(s, hx, hy, w, d, wh=3.6, rise=3.0)
    olive(s, 25, 0, 2.4, 2.4)
    olive(s, 37, 1, 2.2, 2.2)
    return s


def harbor_city():
    """지중해 항구: 앞 부두의 갤리선(줄무늬 돛), 오른쪽 방파제 끝 등대, 뒤에 창고·신전·집."""
    s = Scene()
    s.box(2, 58, 2, 10, 0, 2.6, mat='marble', tex='dress', role='wall', contour=True)
    s.box(58, 72, -8, 10, 0, 2.6, mat='marble', tex='dress', role='wall', contour=True)
    # 등대(방파제 끝, 높다)
    lx, ly = 66, -3
    s.box(lx - 4.6, lx + 4.6, ly - 3.6, ly + 3.6, 2.6, 17, mat='marble', tex='dress', role='tower', contour=True,
          decals=(('front', (lx - .6, lx + .6, 7, 9, 'dark')), ('front', (lx - .6, lx + .6, 12, 14, 'dark'))))
    s.box(lx - 5.1, lx + 5.1, ly - 4.1, ly + 4.1, 17, 17.8, mat='marble', tex='plain', role='tower', contour=True)
    s.add(E.oct_prism(lx, ly, 3.0, 17.8, 24, mat='marble', tex='plain', role='tower', contour=True))
    s.add(E.oct_prism(lx, ly, 3.5, 24, 24.7, mat='marble', tex='plain', role='tower', contour=True))
    s.add(E.Ellip(lx, ly, 26.2, 2.0, 2.0, 2.0, mat='ember', tex='plain', role='misc'))
    for (wx, wy, w) in ((4, 14, 22), (30, 14, 22)):
        s.box(wx, wx + w, wy, wy + 7, 0, 4.6, mat='ochre', tex='plain', role='house', contour=True,
              decals=tuple(('front', (xx, xx + 1.8, 0, 3.0, 'door')) for xx in np.arange(wx + 2, wx + w - 1, 5)))
        s.add(ob.gable(wx - .7, wx + w + .7, wy - .8, wy + 7.8, 4.6, 3.0 / 4.3, mat='redroof', tex='rtile', contour=True, role='roof'))
    temple(s, 22, 42, 30, 42, colh=7, ncol=6, r=1.0, nsteps=2, gold=True)
    for (hx, hy, w, d) in ((3, 28, 10, 7), (48, 28, 10, 7), (58, 18, 9, 7), (62, 32, 10, 7), (8, 42, 9, 6), (47, 42, 9, 6)):
        villa(s, hx, hy, w, d, wh=4, rise=3.2)
    cypress(s, 18, 40, 9, 1.3)
    cypress(s, 74, 26, 9, 1.3)
    # 갤리선: 선체 + 노 + 들린 고물 + 돛대·활대·줄무늬 사각돛
    s.add(E.hull(6, 44, -9, -3, 0, 3.0, rise=.9, mat='wood', tex='plank', role='misc', contour=True))
    for ox in np.arange(9, 40, 2.6):
        s.box(ox, ox + .6, -11, -9, .2, .9, mat='wood', tex='plain', role='misc')
    s.box(41, 45.5, -8, -4, 3.0, 6.4, mat='wood', tex='plank', role='misc', contour=True)
    s.box(4, 7, -8, -4, 0, 4.4, mat='bronze', tex='plain', role='misc', contour=True)
    s.box(24.5, 25.5, -6.5, -5.5, 3, 21, mat='wood', tex='plain', role='misc')
    s.box(18, 32, -7.4, -6.6, 9, 19, mat='sail', tex='plain', role='misc', contour=True,
          decals=tuple(('front', (xx, xx + 1.8, 9, 19, 'red')) for xx in (19.2, 23.6, 28)))
    s.box(17, 33, -7.6, -6.4, 18.6, 19.6, mat='wood', tex='plain', role='misc', contour=True)
    return s


def castle():
    """군단 요새(카스트룸): 흙 둑 위 목책 사각 진영, 앞 문루, 네 모서리 망루, 안에 막사 줄과 본부."""
    s = Scene()
    x0, x1, y0, y1 = 5, 41, 2, 34
    s.patch(x0 + 1, x1 - 1, y0 + 1, y1 - 1, M.flat_fn('dirtg', 1, 4), z=0, h=.4, mat='dirtg')
    # 막사(긴 박공지붕) — 뒤에서 앞으로
    for (bx, by, w) in ((9, 25, 12), (25, 25, 12), (9, 17, 9), (28, 17, 9)):
        s.box(bx, bx + w, by, by + 4, 0, 2.8, mat='marble', tex='plain', role='house', contour=True)
        s.add(ob.gable(bx - .5, bx + w + .5, by - .6, by + 4.6, 2.8, 2.2 / 2.6, mat='redroof', tex='rtile', contour=True, role='roof'))
    # 본부(프린키피아)
    temple(s, 18, 28, 13, 20, colh=4, ncol=4, r=.8, nsteps=1, frieze=False)
    # 목책(뒤·좌우는 낮게, 앞은 문 양옆)
    palisade(s, x0, x1, y1 - 2, y1, 6)
    palisade(s, x0, x0 + 2, y0, y1, 6)
    palisade(s, x1 - 2, x1, y0, y1, 6)
    palisade(s, x0, 18, y0, y0 + 2, 5.5)
    palisade(s, 28, x1, y0, y0 + 2, 5.5)
    # 문루
    s.box(17, 29, y0 - 1, y0 + 3, 0, 8, mat='wood', tex='plank', role='gate', contour=True,
          decals=(('front', (20.5, 25.5, 0, 5.2, 'gate')),))
    s.hip(16.2, 29.8, y0 - 1.8, y0 + 3.8, 8, .8, mat='redroof', tex='rtile', contour=True, role='roof')
    eagle_standard(s, 31, y0 - 3, 10)
    for (tx, ty) in ((x0 + 1, y0 + 1), (x1 - 1, y0 + 1), (x0 + 1, y1 - 1), (x1 - 1, y1 - 1)):
        wood_tower(s, tx, ty, 5, 9)
    return s


def castle_b():
    """미노스 궁전(크노소스): 층층 평지붕 테라스와 창 줄, 아래가 가는 붉은 기둥의 주랑, 지붕 위 황소 뿔 장식."""
    s = Scene()
    s.patch(13, 33, 10, 22, court_fn(), z=0, h=.4, mat='stone')

    def block(x, y, w, d, z0, h, mat='ochre', floors=1):
        dec = [('front', (x, x + w, z0 + h - 1.4, z0 + h - .7, 'band'))]
        fh = h / floors
        for f in range(floors):
            for wx in np.arange(x + 1.5, x + w - 1.4, 2.8):
                dec.append(('front', (wx, wx + 1.0, z0 + f * fh + fh * .3, z0 + f * fh + fh * .3 + 1.6, 'dark')))
        s.box(x, x + w, y, y + d, z0, z0 + h, mat=mat, tex='plain', role='house', contour=True, decals=tuple(dec))
        s.box(x - .3, x + w + .3, y - .3, y + d + .3, z0 + h, z0 + h + .7, mat='marble', tex='plain', role='roof', contour=True)

    def portico(x, y, w, z0, h, n, d=3.0):
        for i in range(n):
            cx = x + 1.2 + (w - 2.4) * i / max(n - 1, 1)
            s.add(M.Frustum(cx, y + 1.2, .5, .85, z0, z0 + h - 1.0, mat='redwall', role='misc'))
            s.box(cx - .95, cx + .95, y + .3, y + 2.1, z0 + h - 1.0, z0 + h - .3, mat='basalt', tex='plain', role='misc')
        s.box(x, x + w, y + 2.4, y + d + 2.4, z0, z0 + h, mat='pshade', tex='plain', role='house')
        s.box(x - .3, x + w + .3, y, y + d + 2.4, z0 + h - .3, z0 + h + .9, mat='marble', tex='plain', role='roof', contour=True,
              decals=(('front', (x - .3, x + w + .3, z0 + h - .3, z0 + h + .3, 'band')),))

    def horns(x, y, z):
        s.box(x - 1.3, x + 1.3, y, y + 1, z, z + .7, mat='marble', tex='plain', role='misc')
        s.box(x - 1.3, x - .5, y, y + 1, z + .7, z + 2.3, mat='marble', tex='plain', role='misc')
        s.box(x + .5, x + 1.3, y, y + 1, z + .7, z + 2.3, mat='marble', tex='plain', role='misc')

    block(4, 25, 18, 7, 0, 12, floors=3)
    block(26, 23, 16, 8, 0, 9, mat='marble', floors=2)
    portico(8, 24, 10, 12.7, 4.6, 4, d=2.2)
    block(2, 9, 10, 13, 0, 6.5, floors=1)
    block(34, 9, 10, 12, 0, 7.5, floors=1)
    portico(13, 2, 20, 0, 6, 6, d=3.0)
    horns(23, 5, 6.9)
    horns(13, 28, 18.2)
    horns(34, 26, 9.7)
    olive(s, 44, 3, 2.2, 2.0)
    return s


def large_town():
    """빌라 마을: 안뜰 있는 붉은 지붕 도무스 둘, 작은 집, 올리브 나무."""
    s = Scene()
    atrium_house(s, 24, 20, 19, 15, wh=3.8, wing=4.4)
    villa(s, 3, 24, 13, 8, wh=4.4, rise=3.4)
    atrium_house(s, 3, 2, 18, 14, wh=3.6, wing=4.2)
    villa(s, 28, 4, 11, 7, wh=4.0, rise=3.2)
    for (tx, ty, r) in ((21, 34, 2.4), (42, 14, 2.4), (24, 1, 2.3), (3, 19, 2.2)):
        olive(s, tx, ty, r, 2.4)
    cypress(s, 42, 2, 8, 1.2)
    return s


def village():
    """산토리니풍 흰 마을: 검붉은 벼랑을 따라 층층이 흰 상자 집, 맨 위 파란 돔 교회와 종탑."""
    s = Scene()
    s.add(E.Ellip(15, 19, 0, 14, 8, 9, mat='rock', tex='speck', role='ground', contour=True))
    for (hx, hy, w, d, z0, h) in ((1.5, 1, 7, 4, 0, 3.0), (9.5, 0, 6, 4, 0, 2.6), (17, 1, 6, 4, 0, 3.2), (24, 2, 5, 4, 0, 2.6),
                                   (3, 7, 6, 4, 2.4, 3.0), (19, 8, 7, 4, 2.6, 3.0),
                                   (2, 14, 6, 4, 5.0, 3.0), (22, 15, 6, 4, 5.4, 2.8)):
        cx = hx + w / 2
        s.box(hx, hx + w, hy, hy + d, 0, z0 + h, mat='swhite', tex='plain', role='house', contour=True,
              decals=(('front', (cx - .6, cx + .6, z0, z0 + 2.0, 'glass')),))
        s.box(hx - .3, hx + w + .3, hy - .3, hy + d + .3, z0 + h, z0 + h + .5, mat='swhite', tex='plain', role='roof', contour=True)
    # 교회: 흰 몸채 + 큰 파란 돔 + 십자, 옆 종탑
    dx, dy, z0 = 13.5, 11, 0
    s.box(dx - 4, dx + 4, dy - 3.6, dy + 3.6, 0, 7.6, mat='swhite', tex='plain', role='house', contour=True,
          decals=(('front', (dx - .8, dx + .8, 3.0, 5.6, 'glass')),))
    s.add(M.Dome(dx, dy, 7.6, 3.6, zmin=7.6, mat='cblue', role='roof', contour=True))
    s.box(dx - .3, dx + .3, dy - .3, dy + .3, 10.9, 12.8, mat='swhite', tex='plain', role='misc')
    s.box(dx - 1.0, dx + 1.0, dy - .3, dy + .3, 11.9, 12.4, mat='swhite', tex='plain', role='misc')
    bx = 9.0
    s.box(bx - 1.4, bx + 1.4, 7.4, 9.4, 0, 9.4, mat='swhite', tex='plain', role='house', contour=True,
          decals=(('front', (bx - .5, bx + .5, 7.2, 8.6, 'dark')),))
    s.add(M.Dome(bx, 8.4, 9.4, 1.4, zmin=9.4, mat='cblue', role='roof', contour=True))
    return s


def village_b():
    """포도밭 농가: 뒤에 붉은 지붕 농가와 올리브, 앞에 포도 덩굴 줄, 포도주 항아리."""
    s = Scene()
    villa(s, 5, 18, 13, 7, wh=4.4, rise=3.6)
    s.box(19, 24.5, 19, 24, 0, 3.0, mat='marble', tex='plain', role='house', contour=True,
          decals=(('front', (20.8, 22.8, 0, 2.2, 'door')),))
    s.add(ob.gable(18.5, 25, 18.4, 24.6, 3.0, 1.6 / 3.1, mat='redroof', tex='rtile', contour=True, role='roof'))
    olive(s, 27, 21, 2.4, 2.6)
    olive(s, 2.5, 22, 2.0, 2.2)
    for vy in (0.5, 6.0, 11.5):
        for vx in np.arange(2.5, 25, 2.6):
            s.box(vx - .2, vx + .2, vy + .5, vy + .9, 0, 2.6, mat='wood', tex='plain', role='misc')
            s.add(E.Ellip(vx + 1.3, vy + .7, 2.0, 1.25, .9, 1.2, mat='leaf2', tex='speck', role='misc', contour=True))
    for (ax, ay) in ((27.5, 13), (28.5, 15.5)):
        s.add(E.Ellip(ax, ay, 1.4, 1.0, 1.0, 1.5, mat='redwall', tex='plain', role='misc', contour=True))
    return s


def camp():
    """원정군 야영: A자 가죽 천막 두 줄, 지휘관 붉은 천막, 독수리 깃발, 모닥불."""
    s = Scene()
    for (tx, ty) in ((0.5, 13), (7.5, 14), (21.5, 13), (2, 2), (9, 1.5), (21, 2.5)):
        s.add(M.tent_ridge_y(tx, tx + 6.0, ty, ty + 5.5, 4.4, mat='leather'))
    s.add(M.tent_ridge_y(13.5, 21.5, 10, 17, 6.4, mat='cloth'))
    eagle_standard(s, 18, 3.5, 12.5)
    s.add(ob.Cyl(25, 9.5, 1.2, 0, .6, mat='ember', tex='plain', role='misc'))
    return s


def tower_small():
    """기념 기둥(트라야누스 원주): 받침대 + 나선 띠 부조 기둥 + 꼭대기 청동상."""
    s = Scene()
    xc, yc = 6, 3
    s.box(xc - 3.2, xc + 3.2, yc - 2.6, yc + 2.6, 0, 1.2, mat='marble', tex='plain', role='wall', contour=True)
    s.box(xc - 2.7, xc + 2.7, yc - 2.2, yc + 2.2, 1.2, 5.6, mat='marble', tex='dress', role='wall', contour=True,
          decals=(('front', (xc - 1.1, xc + 1.1, 2.4, 4.2, 'dark')),))
    s.box(xc - 3.0, xc + 3.0, yc - 2.5, yc + 2.5, 5.6, 6.3, mat='marble', tex='plain', role='wall', contour=True)
    p = ob.Cyl(xc, yc, 1.9, 6.3, 19.6, mat='marble', tex='plain', role='tower', contour=True)
    p.post = spiral_post(xc, yc, pitch=2.6)
    s.add(p)
    s.box(xc - 2.4, xc + 2.4, yc - 2.3, yc + 2.3, 19.6, 20.6, mat='marble', tex='plain', role='tower', contour=True)
    s.cyl(xc, yc, .9, 20.6, 23.2, mat='bronze', tex='plain', role='misc', contour=True)
    s.add(E.Ellip(xc, yc, 23.8, .8, .8, .8, mat='bronze', tex='plain', role='misc', contour=True))
    return s


def tower_small_b():
    """국경 감시탑(리메스): 돌 몸체 + 목조 회랑 + 붉은 사각뿔 지붕, 횃불."""
    s = Scene()
    xc, yc = 6, 3
    s.box(xc - 3.0, xc + 3.0, yc - 2.6, yc + 2.6, 0, 14, mat='marble', tex='dress', role='tower', contour=True,
          decals=(('front', (xc - 1.0, xc + 1.0, 0, 3.2, 'door')), ('front', (xc - .5, xc + .5, 8, 10, 'dark'))))
    s.box(xc - 3.3, xc + 3.3, yc - 3.2, yc + 3.2, 14, 14.9, mat='wood', tex='plain', role='misc', contour=True)
    for xx in (xc - 3.2, xc - 1.0, xc + .3, xc + 2.5):
        s.box(xx, xx + .7, yc - 3.2, yc - 2.5, 14.9, 17.6, mat='wood', tex='plain', role='misc')
    s.box(xc - 3.3, xc + 3.3, yc - 3.2, yc - 2.6, 16.0, 16.6, mat='wood', tex='plain', role='misc')
    s.hip(xc - 3.4, xc + 3.4, yc - 3.4, yc + 3.4, 17.6, 1.2, mat='redroof', tex='rtile', contour=True, role='roof')
    return s


def tower_great():
    """파로스 등대: 사각 기단 탑 + 팔각 중층 + 기둥 등롱의 불 + 청동상, 바닥 기단 테라스."""
    s = Scene()
    xc, yc = 13, 7
    s.box(xc - 9, xc + 9, yc - 6, yc + 6, 0, 2.4, mat='marble', tex='dress', role='wall', contour=True)
    s.crenels(xc - 9, xc + 9, yc - 6, yc + 6, 2.4, mat='marble', step=2.0, h=1.3, edges=('front',), depth=1.1)
    z = 2.4
    s.box(xc - 7.5, xc + 7.5, yc - 5, yc + 5, z, z + 21, mat='marble', tex='dress', role='tower', contour=True,
          decals=tuple(('front', (xx - .5, xx + .5, zz, zz + 1.6, 'dark')) for xx in (xc - 4.5, xc, xc + 4.5) for zz in (z + 6, z + 12, z + 17))
          + (('front', (xc - 1.4, xc + 1.4, z, z + 3.6, 'door')),))
    z += 21
    s.box(xc - 8.0, xc + 8.0, yc - 5.6, yc + 5.6, z, z + 1.0, mat='marble', tex='plain', role='tower', contour=True)
    z += 1.0
    s.add(E.oct_prism(xc, yc, 5.2, z, z + 10, mat='marble', tex='dress', role='tower', contour=True,
                      decals=(('front', (xc - .6, xc + .6, z + 4, z + 6.4, 'dark')),)))
    z += 10
    s.add(E.oct_prism(xc, yc, 5.8, z, z + .9, mat='marble', tex='plain', role='tower', contour=True))
    z += .9
    for k in range(6):
        th = math.radians(-90 + 60 * k + 30)
        column(s, xc + 2.8 * math.cos(th), yc + 2.8 * math.sin(th), .6, z, z + 4.0, cap=False)
    s.add(E.Ellip(xc, yc, z + 1.8, 2.0, 2.0, 1.8, mat='ember', tex='plain', role='misc'))
    z += 4.0
    s.cyl(xc, yc, 3.6, z, z + .9, mat='marble', tex='plain', role='tower', contour=True)
    s.add(ob.Cone(xc, yc, 2.8, z + .9, z + 2.8, mat='marble', tex='plain', role='roof', contour=True))
    s.cyl(xc, yc, .7, z + 2.8, z + 5.0, mat='bronze', tex='plain', role='misc', contour=True)
    return s


def cave():
    """델포이 신탁 동굴: 바위 절벽에 어두운 굴, 입구 양옆 기둥과 박공, 앞 삼발이 향로에서 김."""
    s = Scene()
    s.add(E.Ellip(14, 10, 6, 12.5, 8, 10, mat='rock', tex='speck', role='wall', contour=True))
    s.add(E.Ellip(5, 8, 3, 5, 5, 6, mat='rock', tex='speck', role='wall', contour=True))
    s.add(E.Ellip(23, 7, 3, 5, 5, 5.5, mat='rock', tex='speck', role='wall', contour=True))
    s.box(8, 20, 0.4, 3.0, 0, 8.4, mat='rock', tex='speck', role='house', contour=True,
          decals=(('front', (10.2, 17.8, 0, 7.6, 'arch')),))
    column(s, 9.0, -0.6, .9, 0, 7.0)
    column(s, 19.0, -0.6, .9, 0, 7.0)
    s.box(8, 20, -1.6, 1.2, 7.0, 8.0, mat='marble', tex='plain', role='misc', contour=True)
    s.add(E.gable_ns(7.6, 20.4, -1.8, 1.2, 8.0, 2.6 / 6.4, mat='marble', tex='plain', role='roof', contour=True))
    for dx in (-1.0, 0, 1.0):
        s.box(14 + dx - .2, 14 + dx + .2, -4.5, -4.1, 0, 2.4, mat='bronze', tex='plain', role='misc')
    s.add(E.Ellip(14, -4.3, 2.8, 1.4, 1.1, .8, mat='bronze', tex='plain', role='misc', contour=True))
    smoke(s, 14, -4, 4.6, n=2, r0=1.2)
    olive(s, 24.5, -1, 2.0, 2.0)
    return s


def ruin():
    """무너진 신전: 부서진 기단 위 기둥 셋(하나는 기울었다)과 남은 들보, 쓰러진 기둥 토막."""
    s = Scene()
    s.box(2, 26, 3, 13, 0, 1.2, mat='marble', tex='plain', role='wall', contour=True)
    s.box(3.5, 23, 4.2, 12, 1.2, 2.4, mat='marble', tex='plain', role='wall', contour=True)
    s.box(23, 26.5, 5, 10, 1.2, 1.8, mat='marble', tex='plain', role='misc', contour=True)
    z = 2.4
    column(s, 6.5, 7.5, 1.3, z, z + 13)
    column(s, 12.5, 7.5, 1.3, z, z + 13)
    s.box(4.4, 15, 6, 9, z + 13, z + 15, mat='marble', tex='plain', role='misc', contour=True)
    # 기운 기둥
    s.add(M.obox((19.5, 7.5, z + 5.4), (2.5, 2.5, 11), M.rot_y(.32), mat='marble', tex='plain', role='misc', contour=True))
    # 부러진 밑동·쓰러진 토막
    s.cyl(9.5, 11, 1.2, z, z + 2.4, mat='marble', tex='plain', role='misc', contour=True)
    s.add(M.obox((24, 1.2, 1.2), (7, 2.4, 2.4), M.rot_z(.35), mat='marble', tex='plain', role='misc', contour=True))
    s.box(2, 5.5, -1, 1.8, 0, 1.8, mat='marble', tex='plain', role='misc', contour=True)
    s.add(E.Ellip(29, 9, 1, 2.2, 2, 1.6, mat='olive', tex='speck', role='misc', contour=True))
    return s


def ruin_city():
    """폼페이: 화산재 언덕에 반쯤 묻힌 지붕 없는 집 벽(붉은 벽화), 광장 기둥 줄, 뒤에 연기 뿜는 화산."""
    s = Scene()
    s.add(E.oct_pyr(50, 40, 10, 0, 17, ztrunc=12, mat='ash', tex='speck', role='wall', contour=True))
    smoke(s, 49, 40, 12.5, n=2, r0=1.8)

    def room(x, y, w, d, h, mat='marble', inner='pomp'):
        t = .9
        s.box(x, x + w, y + d - t, y + d, 0, h, mat=inner, tex='plain', role='wall', contour=True)
        s.box(x, x + t, y, y + d, 0, h * .85, mat=mat, tex='plain', role='wall', contour=True)
        s.box(x + w - t, x + w, y, y + d, 0, h * .7, mat=mat, tex='plain', role='wall', contour=True)
        s.box(x, x + w * .45, y, y + t, 0, h * .6, mat=mat, tex='plain', role='wall', contour=True)
        s.box(x + w * .7, x + w, y, y + t, 0, h * .5, mat=mat, tex='plain', role='wall', contour=True)

    room(2, 20, 13, 9, 6)
    room(16, 22, 10, 8, 5)
    room(2, 4, 12, 9, 5.5)
    room(45, 6, 12, 9, 6.5)
    room(28, 24, 10, 7, 5)
    for cx in np.arange(18, 40, 3.4):
        h = 8 if int(cx) % 2 else 5.5
        column(s, cx, 5, .9, 0, h)
    s.box(18, 41, 12, 17, 0, 3, mat='marble', tex='dress', role='wall', contour=True)
    column(s, 23, 14.5, .9, 3, 10)
    column(s, 29, 14.5, .9, 3, 8)
    column(s, 35, 14.5, .9, 3, 10)
    s.box(22, 30, 13.5, 15.5, 10, 11.2, mat='marble', tex='plain', role='misc', contour=True)
    for (cx, cy, rx, ry, rz) in ((9, 31, 9, 4, 3.2), (32, 31, 8, 4, 2.6), (55, 18, 4, 5, 2.8), (6, 2, 5, 3, 2.0), (46, 2, 6, 3, 1.8)):
        s.add(E.Ellip(cx, cy, 0, rx, ry, rz, mat='ash', tex='speck', role='misc', contour=True))
    return s


def shrine():
    """파르테논: 3단 기단, 앞 주랑 8기둥, 트리글리프 띠, 대리석 페디먼트, 테라코타 지붕, 앞 불 화로."""
    s = Scene()
    temple(s, 4, 41, 4, 25, colh=11, ncol=8, r=1.25, nsteps=3, gold=True)
    for x in (9, 36):
        s.cyl(x, -.4, 1.1, 0, 2.6, mat='bronze', tex='plain', role='misc', contour=True)
        s.add(E.Ellip(x, -.4, 3.4, 1.0, .9, .9, mat='ember', tex='plain', role='misc'))
    return s


def landmark_nature():
    """올림포스 산: 눈 덮인 세 봉우리, 허리를 감싼 구름 띠, 산기슭 작은 신전."""
    s = Scene()
    s.add(ob.Cone(22, 16, 18, 0, 29, mat='rock', tex='speck', role='wall', contour=True))
    s.add(ob.Cone(9, 10, 8.5, 0, 15, mat='rock', tex='speck', role='wall', contour=True))
    s.add(ob.Cone(35, 10, 8.5, 0, 17, mat='rock', tex='speck', role='wall', contour=True))
    s.add(ob.Cone(22, 16, 6.2, 19.0, 29.2, mat='snow', tex='plain', role='roof', contour=True))
    s.add(ob.Cone(35, 10, 3.2, 10.6, 17.2, mat='snow', tex='plain', role='roof', contour=True))
    for (cx, cy, cz, rx, ry, rz) in ((10, 7, 10, 7, 4, 2.6), (22, 5, 10.5, 9, 4, 2.8), (34, 7, 11, 7, 4, 2.6),
                                     (16, 9, 12.5, 5, 3, 2.2), (28, 9, 13, 5, 3, 2.2)):
        s.add(E.Ellip(cx, cy, cz, rx, ry, rz, mat='cloud', tex='speck', role='nocast', contour=False))
    olive(s, 3, 2, 2.0, 2.0)
    temple(s, 29, 38, -2, 3.5, colh=3.2, ncol=4, r=.6, nsteps=1, frieze=False)
    return s


def circle():
    """원형 극장: 뒤로 높아지는 반원 계단 객석, 앞 원형 무대(오케스트라)와 낮은 무대 건물."""
    s = Scene()
    cx, cy = 14, 7
    s.add(E.Ellip(cx, cy, 0, 4.6, 3.6, .6, mat='seat', tex='plain', role='ground'))
    for i, (r, h) in enumerate(((6.0, 1.2), (7.8, 2.4), (9.6, 3.6), (11.4, 4.8), (13.0, 6.0))):
        ring_segments(s, cx, cy, r, r * .85, 0, h, 9 + i * 2, thick=2.0, mat='seat', th0=-.1, th1=math.pi + .1,
                      contour=(i == 4), role='wall')
    s.box(6, 22, -2.4, -.2, 0, 2.6, mat='marble', tex='dress', role='house', contour=True,
          decals=tuple(('front', (xx, xx + 1.4, 0, 2.0, 'dark')) for xx in (8.5, 13.3, 18.1)))
    return s


def volcano():
    """베수비오: 두 겹 산(솜마 능선 + 원뿔), 화구의 붉은 불, 비탈 용암 줄기, 연기."""
    s = Scene()
    s.add(E.Ellip(8, 13, 0, 8, 6, 8, mat='ash', tex='speck', role='wall', contour=True))
    s.add(E.oct_pyr(16, 9, 12.5, 0, 19, ztrunc=12, mat='ash', tex='speck', role='wall', contour=True))
    s.add(E.oct_prism(16, 9, 4.0, 11.9, 12.5, mat='ember', tex='plain', role='misc'))
    s.add(E.Ellip(17, 2.6, 5.5, 1.1, 1.4, 5.6, mat='ember', tex='speck', role='misc'))
    smoke(s, 15, 10, 14, n=2, r0=2.0)
    return s


def floating():
    """신들의 하늘섬: 구름 위에 뜬 바위섬, 풀 덮인 윗면에 금빛 신전과 올리브·사이프러스."""
    s = Scene()
    xc, yc = 40, 18
    s.add(E.InvCone(xc, yc, 26, 0, 14, mat='rock', tex='speck', role='wall', contour=True))
    s.add(E.Ellip(xc, yc, 14.2, 28, 16, 2.0, mat='grass', tex='speck', role='ground', contour=True))
    zb = 15.6
    s.box(xc - 15, xc + 15, yc - 8, yc + 7, zb - 1.6, zb, mat='marble', tex='plain', role='misc', contour=True)
    # 신전(금 지붕)
    s.add(ob.Cyl(xc, yc, .1, zb, zb + .1, mat='marble', role='nocast'))
    ztop = None
    zz = steps(s, xc - 12, xc + 12, yc - 5, yc + 5, zb, n=2)
    s.box(xc - 10.4, xc + 10.4, yc - 2.4, yc + 4, zz, zz + 8, mat='pshade', tex='plain', role='house')
    colonnade(s, xc - 11.8, xc + 11.8, yc - 3.8, 1.0, zz, zz + 8, 6)
    ze = zz + 8
    s.box(xc - 12.2, xc + 12.2, yc - 4.8, yc + 4.8, ze, ze + 1.6, mat='gold', tex='plain', role='wall', contour=True)
    sl = 6.0 / 12.8
    s.add(E.gable_ns(xc - 12.8, xc + 12.8, yc - 4.0, yc + 5.4, ze + 1.6, sl, mat='goldroof', tex='rtile', contour=True, role='roof'))
    s.add(E.gable_ns(xc - 12.8, xc + 12.8, yc - 5.0, yc - 4.0, ze + 1.6, sl, mat='marble', tex='plain', contour=True, role='roof'))
    for (tx, ty) in ((xc - 21, yc - 1), (xc + 21, yc + 1)):
        s.add(E.Ellip(tx, ty, zb + 3.4, 2.8, 2.4, 2.2, mat='olive', tex='speck', role='misc', contour=True))
        s.cyl(tx, ty, .6, zb - 1, zb + 2, mat='wood', tex='plain', role='misc')
    cypress(s, xc - 16, yc + 7, 10, 1.3) if False else None
    s.add(E.Ellip(xc - 16, yc + 6, zb + 5, 1.4, 1.4, 5, mat='cypress', tex='speck', role='misc', contour=True))
    s.add(E.Ellip(xc + 16, yc + 6, zb + 5, 1.4, 1.4, 5, mat='cypress', tex='speck', role='misc', contour=True))
    for (cx, cy, cz, rx, ry, rz) in ((14, 12, 5, 12, 7, 4.6), (64, 10, 5, 13, 8, 4.6), (40, 6, 2.5, 18, 8, 4.2)):
        s.add(E.Ellip(cx, cy, cz, rx, ry, rz, mat='cloud', tex='speck', role='nocast', contour=False))
    return s


ORDER = [
    ('capital', '로마', 'capital', (6, 6), '콜로세움·판테온·카피톨리노 신전·수도교·붉은 지붕 집·우산소나무'),
    ('fort_city', '아크로폴리스', 'fort_city', (4, 4), '깎아지른 바위 언덕 위 성벽·문·파르테논, 언덕 아래 집들'),
    ('harbor_city', '지중해 항구', 'harbor_city', (5, 4), '돌 부두의 갤리선, 방파제 끝 등대, 창고·신전·집'),
    ('castle', '군단 요새', 'castle', (3, 3), '목책 사각 진영·문루·모서리 망루·막사 줄·본부·독수리 깃발'),
    ('castle', '미노스 궁전', 'castle_b', (3, 3), '여러 층 평지붕 테라스·아래가 가는 붉은 기둥·황소 뿔 장식'),
    ('large_town', '빌라 마을', 'large_town', (3, 3), '안뜰 있는 붉은 지붕 도무스 둘·작은 집·올리브'),
    ('village', '흰 마을', 'village', (2, 2), '비탈에 층층이 흰 상자 집·파란 돔 교회 둘'),
    ('village', '포도밭 농가', 'village_b', (2, 2), '붉은 지붕 농가·헛간·올리브·포도 덩굴 줄·항아리'),
    ('camp', '원정군 야영', 'camp', (2, 2), '가죽 천막 줄·지휘관 붉은 천막·독수리 깃발·모닥불'),
    ('tower_small', '기념 기둥', 'tower_small', (1, 2), '받침대 위 나선 부조 기둥과 꼭대기 청동상'),
    ('tower_small', '국경 감시탑', 'tower_small_b', (1, 2), '돌 몸체·목조 회랑·붉은 사각뿔 지붕·횃불'),
    ('tower_great', '파로스 등대', 'tower_great', (2, 4), '사각 기단 탑·팔각 중층·기둥 등롱의 불·청동상'),
    ('cave', '신탁 동굴', 'cave', (2, 2), '바위 절벽의 굴·입구 기둥과 박공·삼발이 향로의 김'),
    ('ruin', '무너진 신전', 'ruin', (2, 2), '부서진 기단·선 기둥 둘과 들보·기운 기둥·쓰러진 토막'),
    ('ruin_city', '폼페이', 'ruin_city', (4, 3), '화산재에 반쯤 묻힌 지붕 없는 붉은 벽 집·광장 기둥·뒤 화산'),
    ('shrine', '파르테논', 'shrine', (3, 3), '3단 기단·8기둥 주랑·트리글리프 띠·대리석 페디먼트·불 화로'),
    ('landmark_nature', '올림포스 산', 'landmark_nature', (3, 3), '눈 덮인 세 봉우리와 허리의 구름 띠, 산기슭 작은 신전'),
    ('circle', '원형 극장', 'circle', (2, 2), '뒤로 높아지는 반원 계단 객석·원형 무대·무대 건물'),
    ('volcano', '베수비오', 'volcano', (2, 2), '솜마 능선 + 원뿔 화산·화구 불·용암 줄기·연기'),
    ('floating', '신들의 하늘섬', 'floating', (5, 4), '구름 위 바위섬·금빛 지붕 신전·올리브·사이프러스'),
]
