"""조선 월드맵 아이콘 — 정면 카메라(KX=0, KY=.62)용 장면.
청회 기와 · 초가 · 흰 회벽 + 나무 뼈대 · 붉은 기둥(관청·궁궐만) · 화강암 돌담·석축. 단청은 처마 밑 녹청 띠 한 줄로 절제.
처마 곡선은 완만하게(귀솟음 작게), 문루는 홍예(둥근 아치) 석축 위 누각, 탑은 석탑·목탑.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / '_scene3d'))
import numpy as np  # noqa: E402
import oblique as ob  # noqa: E402
import east as E  # noqa: E402
import modsf_kit as M  # noqa: E402
import parts as P  # noqa: E402
import icons_v9_lib as L  # noqa: E402
from icons_v9_lib import WATER, SNOW, WSTONE, STONE, GREY, LEAF, GOLD, RED, VOLC, hx  # noqa: E402
from oblique import Scene, box  # noqa: E402

SET = dict(id='joseon', name='조선')

# ── 재질 (전부 World.png 색) ──
ob.MAT.update({
    'granite': [STONE[1], VOLC[2], VOLC[3], VOLC[4], VOLC[5], GREY[4], GREY[5]],     # 화강암 석축·석탑(밝은 회백)
    'water': [WATER[0], WATER[1], WATER[2], WATER[3], WATER[4]],
    'snowm': [SNOW[1], SNOW[2], SNOW[3], SNOW[4], SNOW[5]],
    'pine': [LEAF[0], LEAF[1], LEAF[2], LEAF[3], LEAF[4]],                  # 소나무 짙은 잎
    'persim': [RED[2], RED[4], RED[5], GOLD[3], GOLD[4]],                    # 감
})


# ═════════════════════════════════════════ 부품 ═════════════════════════════════════════
def roof(s, x0, x1, y0, y1, z, rise, mat='tile', tips=.9, fa=.40, fh=.34):
    """완만한 조선 기와지붕(귀솟음 작게)."""
    E.tile_roof(s, x0, x1, y0, y1, z, rise, mat=mat, fa=fa, fh=fh, tips=tips)


def giwa(s, x, y, w, d, wh=4.0, rise=4.4, plinth=1.0, over=1.8, pil='wood', door=True, beam=False):
    """기와집: 낮은 돌 기단 + 흰 회벽 + 나무 기둥(관청은 붉은 기둥) + 기와지붕. 반환: 용마루 z."""
    if plinth:
        s.box(x - .9, x + w + .9, y - .9, y + d + .9, 0, plinth, mat='granite', tex='brick', role='misc', contour=True)
    z0 = plinth
    decs = []
    cx = x + w / 2
    if door:
        decs.append(('front', (cx - 1.2, cx + 1.2, z0, z0 + min(wh - .8, 3.4), 'lat')))
    if w >= 10:
        for fx in (.22, .78):
            wx = x + w * fx
            decs.append(('front', (wx - .9, wx + .9, z0 + wh * .4, z0 + wh * .75, 'win')))
    s.box(x, x + w, y, y + d, z0, z0 + wh, mat='plaster', tex='plain', role='house', contour=True, decals=tuple(decs))
    n = max(2, int(w / 4.5) + 1)
    E.pillars(s, x - .2, x + w + .2, y, z0, z0 + wh, n, mat=pil, w=1.0, d=.6)
    if beam:      # 처마 밑 녹청 단청 띠
        s.add(box(x - .3, x + w + .3, y - .7, y + d + .3, z0 + wh - .9, z0 + wh, mat='jade', tex='plain', role='misc'))
    roof(s, x - over, x + w + over, y - over, y + d + over, z0 + wh, rise)
    return z0 + wh + rise


def choga(s, x, y, w, d, wh=3.4, rise=3.6, wall='sand', door=True, ov=1.0):
    """초가: 흙벽 + 둥근 짚 지붕(낮은 처마 + 둥근 등)."""
    cx = x + w / 2
    dec = (('front', (cx - 1.0, cx + 1.0, 0, min(wh - .6, 2.8), 'door')),) if door else ()
    s.box(x, x + w, y, y + d, 0, wh, mat=wall, tex='adobe', role='house', contour=True, decals=dec)
    E.pillars(s, x - .1, x + w + .1, y, 0, wh, 2, mat='wood', w=.9, d=.5)
    X0, X1, Y0, Y1 = x - ov, x + w + ov, y - ov, y + d + ov
    hw = min(X1 - X0, Y1 - Y0) / 2
    h1 = rise * .32
    ins = hw * .30
    s.add(E.hip_t(X0, X1, Y0, Y1, wh, h1 / ins, ztrunc=wh + h1, mat='thatch', tex='speck', contour=True, role='roof'))
    ax, ay = (X1 - X0) / 2 - ins, (Y1 - Y0) / 2 - ins
    s.add(E.Ellip(cx, (Y0 + Y1) / 2, wh + h1 - .2, ax + .2, ay + .2, rise - h1 + .4, mat='thatch', tex='speck', role='roof', contour=True))


def seong(s, x0, x1, y0, y1, h, edges=('front',), mat='granite'):
    """돌 성곽 + 여장(총안 이빨)."""
    P.wall(s, x0, x1, y0, y1, h, mat=mat, edges=edges, step=2.4)


def hongye(s, xc, y, w, d, base_h, wh, rise, gate_w=5, double=False, mat='tile'):
    """홍예 문루: 석축 + 둥근 홍예 + 붉은 기둥 누각 + 기와. double 이면 2층 누각(숭례문)."""
    x0, x1 = xc - w / 2, xc + w / 2
    s.box(x0, x1, y, y + d, 0, base_h, mat='granite', tex='brick', role='gate', contour=True,
          decals=(('front', (xc - gate_w / 2, xc + gate_w / 2, 0, base_h - 1.0, 'arch')),))
    z = base_h
    m = 1.4
    s.box(x0 + m, x1 - m, y + m, y + d - m, z, z + wh, mat='plaster', tex='plain', role='tower', contour=True,
          decals=(('front', (xc - 1.4, xc + 1.4, z + .4, z + wh - .6, 'lat')),))
    E.pillars(s, x0 + m - .3, x1 - m + .3, y + m, z, z + wh, max(3, int(w / 4)), w=1.1, d=.9)
    s.add(box(x0 + m - .5, x1 - m + .5, y + m - 1.1, y + d - m + .4, z + wh - .9, z + wh, mat='jade', tex='plain', role='misc'))
    if double:
        roof(s, x0 - 1.2, x1 + 1.2, y - 1.2, y + d + 1.2, z + wh, rise * .45, tips=.8, fa=.30, fh=.7)
        z2 = z + wh + rise * .4
        m2 = m + 2.2
        s.box(x0 + m2, x1 - m2, y + m2, y + d - m2, z2, z2 + wh * .8, mat='plaster', tex='plain', role='tower', contour=True,
              decals=(('front', (xc - 1.2, xc + 1.2, z2 + .3, z2 + wh * .8 - .5, 'lat')),))
        E.pillars(s, x0 + m2 - .3, x1 - m2 + .3, y + m2, z2, z2 + wh * .8, max(3, int(w / 5)), w=1.0, d=.8)
        roof(s, x0 + m2 - 2.4, x1 - m2 + 2.4, y + m2 - 2.4, y + d - m2 + 2.4, z2 + wh * .8, rise, tips=1.0)
        return z2 + wh * .8 + rise
    roof(s, x0 - 1.6, x1 + 1.6, y - 1.6, y + d + 1.6, z + wh, rise, tips=1.0)
    return z + wh + rise


def tree(s, x, y, h=7, r=3.0, mat='leaf2'):
    s.cyl(x, y, .7, 0, h * .55, mat='bark', tex='plain', role='misc')
    s.add(E.Ellip(x, y, h * .8, r, r * .85, r * .85, mat=mat, tex='speck', role='misc', contour=True))


def pine(s, x, y, z=0.0, h=9, r=3.4):
    """조선 소나무: 붉은 줄기 + 납작한 층층 잎 덩이."""
    s.cyl(x, y, .6, z, z + h * .8, mat='bark', tex='plain', role='misc')
    s.add(E.Ellip(x - r * .35, y, z + h * .62, r * .8, r * .6, 1.3, mat='pine', tex='speck', role='misc', contour=True))
    s.add(E.Ellip(x + r * .3, y, z + h * .86, r, r * .7, 1.5, mat='pine', tex='speck', role='misc', contour=True))
    s.add(E.Ellip(x, y, z + h * 1.05, r * .6, r * .5, 1.2, mat='pine', tex='speck', role='misc', contour=True))


def gamnamu(s, x, y, h=7, r=3.0):
    """감나무: 둥근 수관 + 주황 감 점."""
    tree(s, x, y, h, r)
    zc = h * .8
    for (dx, dz) in ((-1.6, .4), (1.2, 1.4), (.2, -1.2), (1.9, -.6), (-.6, 1.9)):
        s.add(box(x + dx - .45, x + dx + .45, y - r * .82, y - r * .82 + .5, zc + dz - .45, zc + dz + .45, mat='persim', tex='plain', role='misc'))


def jangdok(s, x, y, n=3):
    """장독대: 돌 단 + 옹기 항아리."""
    s.box(x - .6, x + n * 2.2 + .2, y - .6, y + 2.6, 0, .9, mat='granite', tex='plain', role='misc', contour=True)
    for i in range(n):
        px = x + 1 + i * 2.2
        s.add(E.Ellip(px, y + 1, 2.0, 1.0, .9, 1.2, mat='bark', tex='plain', role='misc', contour=True))
        s.add(ob.Cyl(px, y + 1, .7, 2.9, 3.3, mat='bark', tex='plain', role='misc'))


def dol_dam(s, x0, x1, y0, y1, h=2.4):
    """돌담(막돌) + 기와 얹은 담 갓."""
    s.box(x0, x1, y0, y1, 0, h, mat='granite', tex='brick', role='wall', contour=True)
    s.add(box(x0 - .4, x1 + .4, y0 - .4, y1 + .4, h, h + .9, mat='tile', tex='plain', role='misc', contour=True))


def seoktap(s, xc, yc, n=3, w=4.6, body=2.6, z0=0.0, broken=0):
    """화강암 석탑: 2층 기단 + 몸돌·옥개석 n 층 + 상륜. broken 층만큼 위를 뺀다."""
    s.box(xc - w / 2 - 1.2, xc + w / 2 + 1.2, yc - w / 2 - 1.2, yc + w / 2 + 1.2, z0, z0 + 1.6, mat='granite', tex='plain', role='misc', contour=True)
    s.box(xc - w / 2 - .5, xc + w / 2 + .5, yc - w / 2 - .5, yc + w / 2 + .5, z0 + 1.6, z0 + 3.4, mat='granite', tex='plain', role='misc', contour=True)
    z = z0 + 3.4
    for i in range(n - broken):
        bw = w / 2 * (1 - .12 * i)
        bh = body * (1 if i == 0 else .62)
        s.box(xc - bw * .62, xc + bw * .62, yc - bw * .62, yc + bw * .62, z, z + bh, mat='granite', tex='plain', role='misc', contour=True)
        z += bh
        s.add(E.hip_t(xc - bw - .4, xc + bw + .4, yc - bw - .4, yc + bw + .4, z, .45, ztrunc=z + 1.0, mat='granite', tex='plain', role='misc', contour=True))
        z += 1.0
    if not broken:
        s.add(ob.Cyl(xc, yc, .45, z, z + 2.6, mat='granite', tex='plain', role='misc'))
    return z


# ═════════════════════════════════════════ 도시 ═════════════════════════════════════════
def capital():
    """한양 도성: 앞 성곽 가운데 숭례문(2층 문루), 안쪽 궁궐 담 안에 2단 월대 위 근정전, 뒤에 편전·민가, 뒤 성곽."""
    s = Scene()
    x0, x1, D = 4, 84, 80
    cx = 44
    # 북악산(뒤 솔숲 바위산)
    s.add(E.Ellip(44, D + 8, 0, 26, 8, 22, mat='pine', tex='speck', role='misc', contour=True))
    s.add(E.Ellip(20, D + 6, 0, 14, 6, 13, mat='pine', tex='speck', role='misc', contour=True))
    s.add(E.Ellip(68, D + 6, 0, 14, 6, 14, mat='pine', tex='speck', role='misc', contour=True))
    s.patch(x0 + 3, x1 - 3, 4, D - 4, P.court_fn(xr=(cx - 2, cx + 2), yr=(10, 13), grass=.25), mat='dirt')
    # 뒤·옆 성곽
    seong(s, x0, x1, D - 4, D, 6)
    seong(s, x0, x0 + 4, 0, D, 6)
    seong(s, x1 - 4, x1, 0, D, 6)
    # 궁궐 담(행각)
    ix0, ix1, iy0, iy1 = 22, 66, 36, 72
    dol_dam(s, ix0, ix1, iy1 - 2, iy1, 3.0)
    dol_dam(s, ix0, ix0 + 2, iy0, iy1, 3.0)
    dol_dam(s, ix1 - 2, ix1, iy0, iy1, 3.0)
    # 뒤 편전(사정전)
    giwa(s, 33, 62, 22, 5, wh=4, rise=4.4, plinth=1.6, pil='redwall', beam=True, over=2.0)
    # 월대 2단 + 근정전(2층)
    s.box(27, 61, 43, 60, 0, 2.0, mat='granite', tex='brick', role='misc', contour=True)
    s.box(30, 58, 45, 59, 2.0, 4.0, mat='granite', tex='brick', role='misc', contour=True)
    for i in range(3):
        s.box(cx - 3, cx + 3, 40 + i * 1.5, 45, 0, 1.3 + i * 1.3, mat='granite', tex='plain', role='misc', contour=True)
    z0 = 4.0
    s.box(32, 56, 48, 56, z0, z0 + 6, mat='plaster', tex='plain', role='house', contour=True,
          decals=(('front', (cx - 2, cx + 2, z0, z0 + 4.6, 'reddoor')), ('front', (35, 38, z0 + 1, z0 + 5, 'lat')), ('front', (50, 53, z0 + 1, z0 + 5, 'lat'))))
    E.pillars(s, 31.7, 56.3, 48, z0, z0 + 6, 6)
    s.add(box(31.4, 56.6, 47.1, 56.4, z0 + 5, z0 + 6, mat='jade', tex='plain', role='misc'))
    roof(s, 28.5, 59.5, 45, 59, z0 + 6, 3.0, fa=.3, fh=.7, tips=.8)
    z1 = z0 + 6 + 2.6
    s.box(35, 53, 49.5, 55, z1, z1 + 4.4, mat='plaster', tex='plain', role='house', contour=True,
          decals=(('front', (cx - 1.4, cx + 1.4, z1 + .4, z1 + 3.6, 'lat')),))
    E.pillars(s, 34.7, 53.3, 49.5, z1, z1 + 4.4, 5)
    s.add(box(34.5, 53.5, 48.7, 55.3, z1 + 3.6, z1 + 4.4, mat='jade', tex='plain', role='misc'))
    roof(s, 31, 57, 46, 58.5, z1 + 4.4, 7.0, tips=1.1)
    # 궁궐 앞 담 + 광화문풍 작은 문루
    dol_dam(s, ix0, cx - 6, iy0, iy0 + 2, 3.0)
    dol_dam(s, cx + 6, ix1, iy0, iy0 + 2, 3.0)
    hongye(s, cx, iy0 - 1.5, 12, 4.5, 4, 3.0, 3.8, gate_w=3.4)
    # 민가(성 안 좌우)
    for (hx_, hy, w, d) in ((9, 60, 9, 4), (9, 46, 9, 4), (70, 60, 9, 4), (70, 46, 9, 4), (10, 30, 8, 4), (72, 30, 8, 4), (24, 24, 9, 4), (56, 24, 9, 4)):
        giwa(s, hx_, hy, w, d, wh=3.0, rise=3.4, plinth=.6, over=1.4)
    for (cx2, cy2) in ((12, 17), (26, 13), (62, 13), (76, 17)):
        choga(s, cx2 - 3, cy2, 6, 3.5, wh=2.6, rise=2.8)
    for (tx, ty) in ((17, 54), (71, 54), (19, 8), (69, 8), (36, 22), (52, 22)):
        tree(s, tx, ty, 6, 2.4)
    # 앞 성곽 + 숭례문
    seong(s, x0, cx - 10, 0, 4, 6, edges=('front', 'back'))
    seong(s, cx + 10, x1, 0, 4, 6, edges=('front', 'back'))
    hongye(s, cx, -3, 22, 9, 8, 4.4, 6.6, gate_w=5.4, double=True)
    return s


def fort_city():
    """읍성: 돌 성곽 + 앞 홍예 문루 + 안의 동헌(붉은 기둥 관아) + 민가."""
    s = Scene()
    x0, x1, D = 2, 58, 46
    cx = 30
    s.patch(x0 + 3, x1 - 3, 3, D - 3, P.court_fn(xr=(cx - 1.6, cx + 1.6), grass=.3), mat='dirt')
    seong(s, x0, x1, D - 4, D, 5.5)
    seong(s, x0, x0 + 4, 0, D, 5.5)
    seong(s, x1 - 4, x1, 0, D, 5.5)
    # 동헌
    dol_dam(s, 17, 43, 40, 41.6, 2.4)
    giwa(s, 20, 30, 20, 6, wh=4.4, rise=5.0, plinth=2.0, pil='redwall', beam=True, over=2.2)
    # 민가
    giwa(s, 6, 25, 8, 4, wh=3.2, rise=3.6, plinth=.6, over=1.4)
    giwa(s, 46, 25, 8, 4, wh=3.2, rise=3.6, plinth=.6, over=1.4)
    choga(s, 7, 12, 7, 4, wh=2.8, rise=3.0)
    choga(s, 46, 12, 7, 4, wh=2.8, rise=3.0)
    gamnamu(s, 17, 16, 6.5, 2.6)
    tree(s, 43, 17, 6.5, 2.6)
    seong(s, x0, cx - 7, 0, 4, 5.5, edges=('front', 'back'))
    seong(s, cx + 7, x1, 0, 4, 5.5, edges=('front', 'back'))
    hongye(s, cx, -2, 15, 7, 6.5, 3.8, 5.0, gate_w=4.4)
    return s


def panokseon(s, x0, y0, L_=26, sails=True):
    """판옥선: 넓은 선체 위 판옥(2층 갑판 상자) + 지휘소 장대 + 네모 돛 둘."""
    x1 = x0 + L_
    s.add(E.hull(x0, x1, y0, y0 + 7, 0, 3.4, rise=.8, mat='wood', tex='plank', role='misc', contour=True,
                 decals=(('front', (x0 + 4, x1 - 4, 1.2, 1.9, 'dark')),)))
    s.box(x0 + 3, x1 - 3, y0 + .6, y0 + 6.4, 3.4, 6.4, mat='wood', tex='plank', role='misc', contour=True,
          decals=(('front', (x0 + 4, x1 - 4, 4.4, 5.6, 'lat')),))
    s.add(box(x0 + 2.4, x1 - 2.4, y0, y0 + 7, 6.4, 7.0, mat='wood', tex='plain', role='misc', contour=True))
    cxs = x0 + L_ * .5
    s.box(cxs - 3, cxs + 3, y0 + 2, y0 + 5, 7.0, 9.4, mat='redwall', tex='plain', role='misc', contour=True)
    roof(s, cxs - 4.2, cxs + 4.2, y0 + 1, y0 + 6, 9.4, 2.4, tips=.5)
    if sails:
        for mx, h in ((x0 + L_ * .25, 21), (x0 + L_ * .76, 18)):
            s.box(mx - .5, mx + .5, y0 + 3.2, y0 + 4.2, 7, h, mat='wood', tex='plain', role='misc')
            s.add(box(mx - 3.6, mx + 3.6, y0 + 2.6, y0 + 3.2, h - 9.5, h - 1, mat='thatch', tex='ribs', role='misc', contour=True))
            s.add(box(mx + .5, mx + 3, y0 + 3.4, y0 + 3.8, h - 1.6, h, mat='cloth', tex='plain', role='misc'))


def harbor_city():
    """포구 고을: 뒤·옆 돌 성곽 일부, 성 안 관아·기와집, 앞 나무 선창에 판옥선과 초가 창고."""
    s = Scene()
    x0, x1, D = 4, 74, 34
    s.patch(x0 + 3, x1 - 3, 3, D - 3, P.court_fn(grass=.3), mat='dirt')
    seong(s, x0, x1, D - 4, D, 5.5)
    seong(s, x0, x0 + 4, 4, D, 5.5)
    seong(s, x1 - 4, x1, 12, D, 4.0)
    hongye(s, 40, D - 6, 12, 6, 5.5, 3.4, 4.4, gate_w=3.6)
    giwa(s, 24, 18, 14, 5, wh=4.0, rise=4.6, plinth=1.6, pil='redwall', beam=True, over=2.0)
    giwa(s, 46, 19, 9, 4, wh=3.2, rise=3.6, plinth=.6, over=1.4)
    giwa(s, 9, 18, 9, 4, wh=3.2, rise=3.6, plinth=.6, over=1.4)
    # 창고(조창) 둘 — 판벽 + 맞배 기와
    for gx in (10, 56):
        s.box(gx, gx + 11, 5, 10, 0, 3.6, mat='wood', tex='plank', role='house', contour=True,
              decals=(('front', (gx + 4.5, gx + 6.5, 0, 2.8, 'door')),))
        s.add(E.gable_ew(gx - 1, gx + 12, 4, 11, 3.6, 3.6 / 3.5, mat='tile', tex='tile', contour=True, role='roof'))
    choga(s, 30, 6, 7, 3.5, wh=2.6, rise=2.8)
    # 선창
    s.box(8, 40, -6, 2, 0, 1.4, mat='wood', tex='plank', role='misc', contour=True)
    for px in (9, 18, 27, 36):
        s.box(px, px + 1.2, -6.8, -5.6, -1, 2.8, mat='wood', tex='plain', role='misc')
    panokseon(s, 44, -15, 28)
    return s


def castle():
    """산성: 솔숲 덮인 산등성이를 따라 오르는 석축 성벽, 앞 성벽의 낮은 암문, 꼭대기 석축 위 2층 장대."""
    s = Scene()
    s.add(M.Frustum(23, 17, 15, 8, 0, 9, mat='pine', tex='speck', role='misc', contour=True))
    s.add(M.Dome(23, 17, 5, 8.6, zmin=8.8, mat='pine', tex='speck', role='misc', contour=True))
    # 뒤 성벽(능선 위)
    seong(s, 8, 38, 25, 28, 14, mat='granite')
    # 옆 성벽: 능선 따라 계단처럼 오른다
    for k in range(4):
        y0, y1 = 3 + 5.5 * k, 8.6 + 5.5 * k
        h = 6.5 + 2.2 * k
        for (a, b) in ((3, 7.5), (38.5, 43)):
            s.box(a, b, y0, y1, 0, h, mat='granite', tex='brick', role='wall', contour=True)
            P.merlons(s, a, b, y0, y1, h, edges=('front',), mat='granite')
    # 장대(지휘 누각)
    xc = 23
    z = 12
    s.box(16, 30, 13, 20, 0, z, mat='granite', tex='brick', role='keep', contour=True)
    s.box(xc - 5.5, xc + 5.5, 14.5, 19, z, z + 3.6, mat='plaster', tex='plain', role='keep', contour=True,
          decals=(('front', (xc - 1.2, xc + 1.2, z + .3, z + 3.0, 'lat')),))
    E.pillars(s, xc - 5.8, xc + 5.8, 14.5, z, z + 3.6, 4, w=1.0, d=.8)
    s.add(box(xc - 5.9, xc + 5.9, 13.6, 19.3, z + 2.8, z + 3.6, mat='jade', tex='plain', role='misc'))
    roof(s, xc - 7.6, xc + 7.6, 12.6, 21, z + 3.6, 2.0, fa=.3, fh=.7, tips=.6)
    z2 = z + 3.6 + 1.6
    s.box(xc - 3.6, xc + 3.6, 15.3, 18.5, z2, z2 + 3.0, mat='plaster', tex='plain', role='keep', contour=True)
    E.pillars(s, xc - 3.9, xc + 3.9, 15.3, z2, z2 + 3.0, 3, w=1.0, d=.8)
    roof(s, xc - 5.6, xc + 5.6, 13.5, 20.3, z2 + 3.0, 4.6, tips=.9)
    # 앞 성벽 + 암문(문루 없는 작은 홍예)
    s.box(3, 43, 0, 3.6, 0, 6.5, mat='granite', tex='brick', role='wall', contour=True,
          decals=(('front', (12, 15.4, 0, 3.6, 'arch')),))
    P.merlons(s, 3, 43, 0, 3.6, 6.5, edges=('front',), mat='granite')
    pine(s, 35, 1, 0, 6, 2.0) if False else None
    return s


# ═════════════════════════════════════════ 마을 ═════════════════════════════════════════
def large_town():
    """양반 마을: 돌담 안 큰 안채·사랑채(기와), 솟을대문, 연못가 사모정, 소나무."""
    s = Scene()
    # 뒤 안채 (좌) · 뒤 기와집 (우, 엇갈림)
    giwa(s, 2, 34, 17, 5, wh=3.6, rise=4.6, plinth=1.4, over=1.8)
    giwa(s, 27, 38, 13, 5, wh=3.4, rise=4.2, plinth=1.2, over=1.6)
    dol_dam(s, 0, 24, 30, 31.4, 2.2)
    # 사랑채
    giwa(s, 4, 18, 12, 4.5, wh=3.2, rise=3.8, plinth=1.0, over=1.5)
    # 연못 + 사모정
    s.add(ob.Cyl(34, 14, 6.5, 0, .5, mat='water', tex='plain', role='misc', contour=True))
    s.box(30.5, 38, 18, 23, 0, 1.4, mat='granite', tex='plain', role='misc', contour=True)
    for px in (31, 36.8):
        s.box(px, px + .8, 18.4, 19.2, 1.4, 5.6, mat='redwall', tex='plain', role='misc')
    s.box(30.7, 37.8, 18.3, 22.8, 1.4, 2.2, mat='wood', tex='plain', role='misc', contour=True)
    s.add(E.hip_t(28.6, 39.8, 16.4, 25, 5.6, .8, mat='tile', tex='tile', contour=True, role='roof'))
    s.add(ob.Cyl(34.2, 20.7, .4, 8.9, 10.2, mat='tile', tex='plain', role='roof'))
    # 앞 돌담 + 솟을대문
    dol_dam(s, 0, 8, 4, 5.4, 2.2)
    dol_dam(s, 15, 24, 4, 5.4, 2.2)
    s.box(8, 15, 3.6, 5.8, 0, 3.8, mat='plaster', tex='plain', role='gate', contour=True,
          decals=(('front', (9.6, 13.4, 0, 3.2, 'door')),))
    roof(s, 7, 16, 2.4, 7, 3.8, 2.6, tips=.6)
    pine(s, 37.5, 31, 0, 10, 2.6)
    gamnamu(s, 26, 6, 6, 2.2)
    return s


def large_town_b():
    """장터 마을: 초가 사이 흰 차일 장막 셋, 주막(기와·주기 깃발), 짐."""
    s = Scene()
    choga(s, 3, 24, 9, 4.5, wh=3.2, rise=3.6)
    choga(s, 31, 25, 9, 4.5, wh=3.2, rise=3.6)
    # 주막
    giwa(s, 15, 22, 12, 5, wh=3.4, rise=3.8, plinth=.8, over=1.5)
    s.box(27.6, 28.4, 20, 20.8, 0, 11, mat='wood', tex='plain', role='misc')
    s.box(28.4, 31, 20, 20.6, 7.2, 10.6, mat='plaster', tex='plain', role='misc', contour=True,
          decals=(('front', (29.2, 30.2, 7.8, 10, 'band')),))
    # 장터 차일
    for (tx, ty, w) in ((2, 10, 9), (15, 12, 10), (30, 9, 10)):
        for px in (tx, tx + w - .8):
            s.box(px, px + .8, ty, ty + .8, 0, 4.6, mat='wood', tex='plain', role='misc')
        s.add(E.gable_ew(tx - .8, tx + w + .8, ty - 1.2, ty + 4.6, 4.6, .5, mat='sail', tex='plain', contour=True, role='roof'))
        s.box(tx + .8, tx + w - .8, ty + .4, ty + 3.2, 0, 1.6, mat='wood', tex='plank', role='misc', contour=True)
        for k in range(int(w / 3)):
            s.add(E.Ellip(tx + 2 + k * 2.8, ty + 1.8, 1.9, 1.0, .8, .6, mat=('persim', 'grass', 'thatch')[k % 3], tex='plain', role='misc'))
    # 지게 짐·항아리
    s.add(E.Ellip(11.5, 2, 1.2, 1.4, 1.1, 1.2, mat='bark', tex='plain', role='misc', contour=True))
    s.box(26, 28.4, 1, 2.6, 0, 2.2, mat='thatch', tex='speck', role='misc', contour=True)
    return s


def village():
    """초가 마을: 초가 셋, 장독대, 감나무, 싸리 울."""
    s = Scene()
    choga(s, 1, 15, 9, 4.5, wh=3.8, rise=4.2)
    choga(s, 15, 17, 8, 4.5, wh=3.6, rise=4.0)
    choga(s, 7, 3, 9, 4.5, wh=3.8, rise=4.2)
    jangdok(s, 20, 5, 2)
    gamnamu(s, 25.5, 12, 6.4, 2.4)
    s.box(0, 6, 1, 1.6, 0, 1.8, mat='thatch', tex='speck', role='misc')
    return s


def village_b():
    """어촌: 초가 둘, 그물 너는 장대, 뭍에 올린 작은 고깃배."""
    s = Scene()
    choga(s, 2, 15, 9, 4.5, wh=3.0, rise=3.5)
    choga(s, 16, 17, 8, 4, wh=2.8, rise=3.2)
    # 그물 덕장
    for px in (13, 22):
        s.box(px, px + .7, 9, 9.7, 0, 6, mat='wood', tex='plain', role='misc')
    s.box(13.7, 22, 9.1, 9.5, 1.2, 5.4, mat='thatch', tex='plain', role='misc', contour=True,
          decals=(('front', (13.7, 22, 1.2, 5.4, 'lat')),))
    # 작은 배
    s.add(E.hull(2, 15, 1, 5, 0, 2.2, rise=.9, mat='wood', tex='plank', role='misc', contour=True))
    s.box(7.2, 7.9, 2.6, 3.3, 2.2, 9, mat='wood', tex='plain', role='misc')
    s.add(box(5.4, 9.8, 2.0, 2.4, 4, 8.4, mat='sail', tex='ribs', role='misc', contour=True))
    s.add(E.Ellip(22, 3, .8, 1.3, 1.0, .9, mat='bark', tex='plain', role='misc', contour=True))
    return s


def camp():
    """보부상 야영: 흰 무명 천막 둘, 짐 진 지게, 모닥불."""
    s = Scene()
    s.add(M.tent_ridge_y(1, 11, 9, 17, 6.4, mat='sail'))
    s.add(M.tent_ridge_y(15, 23, 12, 18, 5.0, mat='sail'))
    # 지게(A자 나무틀 + 짐)
    for jx in (22, 25):
        s.box(jx, jx + .6, 4, 4.6, 0, 6, mat='wood', tex='plain', role='misc')
        s.box(jx + 1.6, jx + 2.2, 4, 4.6, 0, 6, mat='wood', tex='plain', role='misc')
        s.box(jx - .1, jx + 2.3, 4.6, 6.2, 2.2, 4.8, mat='thatch', tex='speck', role='misc', contour=True)
    # 모닥불
    s.add(ob.Cyl(14, 3, 1.8, 0, .7, mat='granite', tex='plain', role='misc', contour=True))
    s.add(ob.Cone(14, 3, 1.2, .7, 3.4, mat='ember', tex='plain', role='misc'))
    s.add(E.Ellip(5, 3, .9, 1.4, 1.0, .9, mat='bark', tex='plain', role='misc', contour=True))
    return s


# ═════════════════════════════════════════ 탑 ═════════════════════════════════════════
def tower_small():
    """봉수대: 돌로 쌓은 둥근 연대 + 꼭대기 연굴 하나에서 오르는 연기 한 줄."""
    s = Scene()
    for i, r in enumerate((5.8, 5.2, 4.6)):
        s.add(ob.Cyl(6.5, 4, r, i * 3, i * 3 + 3, mat='granite', tex='brick', role='tower', contour=True,
                     decals=(('side', (-90, 1.0, 0, 2.4, 'dark')),) if i == 0 else ()))
    s.add(ob.Cyl(6.5, 4, 2.0, 9, 11, mat='granite', tex='brick', role='tower', contour=True))
    s.add(ob.Cyl(6.5, 4, 1.0, 10.9, 11.2, mat='ember', tex='plain', role='misc'))
    M.steam(s, 6.5, 4, 13.2, None, n=3, r0=1.7, rise=3.0, drift=1.4)
    return s


def tower_great():
    """5층 목탑(팔상전풍): 돌 기단 위 층마다 줄어드는 판벽 몸 + 넓은 기와 처마, 꼭대기 상륜."""
    s = Scene()
    xc, yc = 14, 8
    s.box(xc - 9.5, xc + 9.5, yc - 6.5, yc + 6.5, 0, 1.6, mat='granite', tex='brick', role='misc', contour=True)
    s.box(xc - 3, xc + 3, yc - 9.5, yc - 7, 0, 1.0, mat='granite', tex='plain', role='misc', contour=True)
    z = 1.6
    for i in range(5):
        hw = 6.6 - .95 * i
        h = 7.0 if i == 0 else 4.8
        dec = (('front', (xc - 1.6, xc + 1.6, z, z + h - 1.0, 'lat')),) if i == 0 else (('front', (xc - 1.2, xc + 1.2, z + .4, z + h - .8, 'lat')),)
        s.box(xc - hw, xc + hw, yc - hw * .6, yc + hw * .6, z, z + h, mat='plaster', tex='plain', role='tower', contour=True, decals=dec)
        E.pillars(s, xc - hw - .2, xc + hw + .2, yc - hw * .6, z, z + h, 3 if i else 4, mat='redwall', w=1.0, d=.5)
        o = 2.6 - .2 * i
        rs = 2.4 if i < 4 else 5.0
        roof(s, xc - hw - o, xc + hw + o, yc - hw * .6 - o, yc + hw * .6 + o, z + h, rs, tips=.9, fa=.3, fh=.7 if i < 4 else .34)
        z += h + rs * .45
    s.add(ob.Cyl(xc, yc, .55, z, z + 6, mat='tile', tex='plain', role='roof'))
    for k in (1.4, 2.8, 4.0):
        s.add(E.Ellip(xc, yc, z + k, 1.4 - k * .15, 1.4 - k * .15, .5, mat='tile', role='roof'))
    return s


# ═════════════════════════════════════════ 지형 랜드마크 ═════════════════════════════════════════
def cave():
    """석굴: 화강암 바위 절벽에 판 둥근 석굴 입구 + 앞의 작은 목조 처마(전실)."""
    s = Scene()
    s.add(E.Ellip(15, 10, 8, 11.5, 7, 10, mat='granite', tex='speck', role='wall', contour=True))
    s.add(E.Ellip(6.5, 8, 4.5, 5, 5, 5.5, mat='granite', tex='speck', role='wall', contour=True))
    s.add(E.Ellip(24, 7, 4, 4.6, 4.5, 5, mat='granite', tex='speck', role='wall', contour=True))
    pine(s, 23, 9, 10, 6, 2.4)
    s.box(10, 20, 0, 3, 0, 6.6, mat='granite', tex='brick', role='house', contour=True,
          decals=(('front', (12.4, 17.6, 0, 5.8, 'arch')),))
    for px in (10.2, 18.8):
        s.box(px, px + 1.0, -2.6, -1.6, 0, 6.6, mat='redwall', tex='plain', role='misc')
    roof(s, 8.4, 21.6, -3.6, 2.6, 6.6, 2.8, tips=.7)
    return s


def ruin():
    """무너진 석탑: 기단과 1층 몸돌만 남은 3층 석탑, 땅에 떨어진 옥개석들."""
    s = Scene()
    seoktap(s, 13, 6, n=3, w=7, body=3.4, broken=2)
    # 비스듬히 남은 2층 몸돌 조각
    s.box(11.4, 14.2, 5, 7.4, 9.8, 11.4, mat='granite', tex='plain', role='misc', contour=True)
    # 흩어진 옥개석
    for (x, y, w) in ((22, 1, 6.5), (1, 0, 5.5), (19, 10, 5)):
        s.add(E.hip_t(x, x + w, y, y + w * .55, 0, .5, ztrunc=1.3, mat='granite', tex='plain', role='misc', contour=True))
    s.box(5, 7.5, 11, 13, 0, 1.6, mat='granite', tex='plain', role='misc', contour=True)
    for (x, y) in ((8, -1), (27, 7)):
        s.add(E.Ellip(x, y, .5, 1.6, 1.0, 1.4, mat='grass', tex='speck', role='misc'))
    return s


def ruin_city():
    """옛 궁터: 무너진 석축 월대, 줄지은 주춧돌, 허물어진 기와 담 조각, 잡초."""
    s = Scene()
    s.box(8, 56, 14, 36, 0, 2.4, mat='granite', tex='brick', role='misc', contour=True)
    s.patch(8.6, 55.4, 14.6, 35.4, P.court_fn(grass=.55), z=2.4, h=.3, mat='dirt')
    s.box(4, 15, 14, 20, 0, 1.4, mat='granite', tex='brick', role='misc', contour=True)
    for i in range(3):
        s.box(28, 36, 10 + i * 1.4, 14.5, 0, .8 + i * .8, mat='granite', tex='plain', role='misc', contour=True)
    # 주춧돌 줄
    for gx in range(5):
        for gy in range(3):
            if (gx, gy) in ((3, 1), (0, 2)):
                continue
            x = 15 + gx * 8.5
            y = 18 + gy * 6
            s.add(ob.Cyl(x, y, 1.3, 2.4, 3.4, mat='granite', tex='plain', role='misc', contour=True))
    # 부러진 기둥 둘
    s.add(ob.Cyl(23.5, 24, .9, 3.4, 9, mat='redwall', tex='plain', role='misc', contour=True))
    s.add(ob.Cyl(49, 18, .9, 3.4, 6, mat='redwall', tex='plain', role='misc', contour=True))
    # 무너진 담
    s.box(4, 20, 38, 40, 0, 4.4, mat='plaster', tex='plain', role='wall', contour=True)
    s.add(box(3.6, 13, 37.6, 40.4, 4.4, 5.3, mat='tile', tex='plain', role='misc', contour=True))
    s.box(38, 46, 38, 40, 0, 2.6, mat='plaster', tex='plain', role='wall', contour=True)
    s.box(58, 60, 18, 36, 0, 3.6, mat='plaster', tex='plain', role='wall', contour=True)
    s.add(box(57.6, 60.4, 26, 36, 3.6, 4.5, mat='tile', tex='plain', role='misc', contour=True))
    # 반쯤 남은 전각 한 귀(기둥 둘 위 기운 지붕 조각)
    for px in (44, 51):
        s.add(ob.Cyl(px, 31, .9, 2.4, 10.5, mat='redwall', tex='plain', role='misc', contour=True))
    s.add(E.hip_t(41, 55, 28, 34.5, 10.5, .55, ztrunc=12.8, mat='tile', tex='tile', role='misc', contour=True))
    # 떨어진 기와 더미·잡초
    s.add(E.hip_t(45, 52, 4, 8, 0, .6, ztrunc=1.6, mat='tile', tex='tile', role='misc', contour=True))
    for (x, y, r) in ((6, 8, 2.6), (19, 6, 2.0), (55, 10, 2.4), (32, 30, 1.8), (41, 26, 1.6), (12, 30, 1.8), (2, 26, 2.0)):
        s.add(E.Ellip(x, y, 2.6 if y > 13 else .6, r, r * .8, r * .7, mat='grass', tex='speck', role='misc', contour=True))
    return s


def shrine():
    """산사: 석축 위 대웅전(맞배+팔작 기와·녹청 단청), 앞마당 3층 석탑, 맨 앞 일주문, 소나무."""
    s = Scene()
    s.box(4, 44, 16, 30, 0, 4, mat='granite', tex='brick', role='wall', contour=True)
    for i in range(3):
        s.box(21, 27, 12 + i * 1.4, 16.2, 0, 1.3 + i * 1.3, mat='granite', tex='plain', role='misc', contour=True)
    z0 = 4
    s.box(10, 38, 20, 27, z0, z0 + 5.4, mat='plaster', tex='plain', role='house', contour=True,
          decals=(('front', (20, 28, z0, z0 + 4.4, 'lat')), ('front', (12, 17, z0, z0 + 4.4, 'lat')), ('front', (31, 36, z0, z0 + 4.4, 'lat'))))
    E.pillars(s, 9.7, 38.3, 20, z0, z0 + 5.4, 5)
    s.add(box(9.5, 38.5, 19.2, 27.3, z0 + 4.6, z0 + 5.4, mat='jade', tex='plain', role='misc'))
    roof(s, 6, 42, 16.8, 30, z0 + 5.4, 6.8, tips=1.1)
    seoktap(s, 14, 9, n=3, w=3.2, body=2.0)
    for tx, ty in ((40, 10), (6, 34)):
        pine(s, tx, ty, 0, 9 if ty < 20 else 12, 3.2)
    # 일주문(기둥 둘 + 다포 기와지붕)
    for px in (19.5, 27.5):
        s.box(px, px + 1.2, 0, 1.2, 0, 7, mat='redwall', tex='plain', role='misc', contour=True)
    s.add(box(19, 29.2, -.4, 1.6, 6, 7.2, mat='jade', tex='plain', role='misc'))
    roof(s, 16.8, 31.4, -1.6, 2.8, 7.2, 3.2, tips=.8)
    return s


def landmark_nature():
    """당산나무: 마을 어귀 느티나무 거목(새끼줄 금줄) + 돌무더기 서낭당."""
    s = Scene()
    s.cyl(20, 10, 3.4, 0, 11, mat='bark', tex='speck', role='wall', contour=True)
    s.add(ob.Cyl(20, 10, 3.6, 5, 5.8, mat='thatch', tex='plain', role='misc'))
    for (dx, dz) in ((-2.4, 4.4), (-.8, 4.2), (.8, 4.2), (2.4, 4.4)):      # 금줄의 흰 종이
        s.add(box(20 + dx - .35, 20 + dx + .35, 6.0, 6.6, dz - 1.6, dz, mat='sail', tex='plain', role='misc'))
    for (x, y, z, rx, ry, rz) in ((20, 12, 20, 13, 8, 7.5), (11, 10, 16, 7.5, 5.5, 5.5), (29, 11, 16.5, 8, 5.5, 5.5),
                                  (20, 9, 25.5, 8, 5.5, 5), (20, 9, 14.5, 9, 6, 4)):
        s.add(E.Ellip(x, y, z, rx, ry, rz, mat='leaf2', tex='speck', role='roof', contour=True))
    # 서낭당 돌무더기
    s.add(ob.Cone(37, 3, 4.2, 0, 6, mat='granite', tex='speck', role='misc', contour=True))
    s.add(E.Ellip(37, 3, 6.2, 1.2, 1.0, .9, mat='granite', tex='plain', role='misc', contour=True))
    s.box(32, 32.6, 1, 1.6, 0, 7, mat='wood', tex='plain', role='misc')
    s.box(32.6, 34, 1, 1.4, 4.2, 6.6, mat='cloth', tex='plain', role='misc')
    return s


def circle():
    """고인돌: 굄돌 둘 위 넓적한 덮개돌을 얹은 탁자식 고인돌 두 기."""
    s = Scene()
    for (x, y, w, h, top) in ((1, 10, 12, 5.0, 2.2), (14, 1, 13, 5.6, 2.4)):
        s.box(x + 1.4, x + 4.0, y + 1, y + 5, 0, h, mat='granite', tex='speck', role='misc', contour=True)
        s.box(x + w - 4.0, x + w - 1.4, y + 1, y + 5, 0, h, mat='granite', tex='speck', role='misc', contour=True)
        s.add(E.hip_t(x, x + w, y, y + 6, h, 1.4, ztrunc=h + top, mat='granite', tex='speck', role='misc', contour=True))
    s.add(E.Ellip(4, 3, .6, 1.6, 1.2, 1.2, mat='granite', tex='speck', role='misc', contour=True))
    return s


def volcano():
    """백두산: 눈 덮인 회색 화산 봉우리, 꼭대기 분화구에 푸른 천지."""
    s = Scene()
    s.add(E.oct_pyr(14, 10, 14, 0, 22, ztrunc=13, mat='basalt', tex='speck', role='wall', contour=True))
    s.add(E.oct_pyr(14, 10, 14 * 9 / 22 + .3, 9, 22, ztrunc=13.4, mat='snowm', tex='speck', role='wall', contour=True))
    s.add(E.oct_prism(14, 10, 4.8, 12.9, 13.6, mat='snowm', tex='plain', role='misc'))
    s.add(E.Ellip(14, 10, 13.6, 4.2, 3.4, .5, mat='water', tex='plain', role='misc'))
    # 봉우리 테두리 돌기
    for (dx, dy, r) in ((-4.6, 1, 1.4), (4.4, 0, 1.3), (-1.5, 4.2, 1.2), (2.4, 4.0, 1.4)):
        s.add(E.Ellip(14 + dx, 10 + dy, 13.8, r, r * .8, 1.3, mat='snowm', tex='speck', role='misc', contour=True))
    return s


def floating():
    """신선 봉우리: 구름 위로 솟은 바위 봉우리 셋, 가장 높은 봉우리에 육모정, 바위틈 소나무."""
    s = Scene()
    # 구름
    for (cx, cy, cz, rx, ry, rz) in ((15, 8, 4, 13, 7, 4.5), (40, 4, 3, 18, 7, 4.0), (65, 9, 4, 12, 7, 4.5), (28, 14, 6, 10, 6, 4), (54, 14, 6, 10, 6, 4)):
        s.add(E.Ellip(cx, cy, cz, rx, ry, rz, mat='cloud', tex='speck', role='misc', contour=False))
    # 봉우리 (화강암 기둥 바위)
    for (xc, yc, r, h) in ((40, 14, 9, 34), (22, 16, 7, 24), (58, 15, 7, 27)):
        s.add(ob.Cone(xc, yc, r, 2, h + 6, mat='granite', tex='speck', role='wall', contour=True))
        s.add(ob.Cyl(xc, yc, r * .3, 2, h, mat='granite', tex='speck', role='wall', contour=True))
    # 정상 평탄 바위 + 육모정
    zt = 30
    s.add(E.Ellip(40, 14, zt, 5.4, 4.2, 1.6, mat='granite', tex='speck', role='misc', contour=True))
    z0 = zt + 1.2
    for px in (36.4, 42.8):
        s.box(px, px + .8, 11, 11.8, z0, z0 + 4, mat='redwall', tex='plain', role='misc')
    s.box(36.2, 43.8, 10.8, 16, z0, z0 + .8, mat='wood', tex='plain', role='misc', contour=True)
    E.oct_roof(s, 40, 14, 5.6, z0 + 4, 4.4, mat='tile', fa=.45, fh=.3, tip=False)
    s.add(ob.Cyl(40, 14, .45, z0 + 8.2, z0 + 9.6, mat='tile', tex='plain', role='roof'))
    # 소나무
    pine(s, 26.5, 13, 18, 7, 2.8)
    pine(s, 54, 12, 21, 7, 2.8)
    pine(s, 46, 10, 10, 6, 2.4)
    return s


ORDER = [
    ('capital', '한양 도성', 'capital', (6, 6), '도성 성곽·2층 숭례문·궁궐 담 안 월대 위 근정전·민가'),
    ('fort_city', '읍성', 'fort_city', (4, 4), '돌 성곽·홍예 문루·붉은 기둥 동헌·기와집·초가'),
    ('harbor_city', '포구 고을', 'harbor_city', (5, 4), '성곽 일부·관아·조창 창고·선창·판옥선'),
    ('castle', '산성', 'castle', (3, 3), '돌산 위 석축 성벽·2층 장대·암문'),
    ('large_town', '양반 마을', 'large_town', (3, 3), '돌담 두른 기와집·솟을대문·연못가 정자·소나무'),
    ('large_town', '장터 마을', 'large_town_b', (3, 3), '초가·흰 차일 장막·주막 깃발'),
    ('village', '초가 마을', 'village', (2, 2), '초가 셋·장독대·감나무'),
    ('village', '어촌', 'village_b', (2, 2), '초가·그물 덕장·작은 고깃배'),
    ('camp', '보부상 야영', 'camp', (2, 2), '무명 천막·지게 짐·모닥불'),
    ('tower_small', '봉수대', 'tower_small', (1, 2), '돌 연대 위 연기 한 줄'),
    ('tower_great', '5층 목탑', 'tower_great', (2, 4), '팔상전풍 5층 목탑'),
    ('cave', '석굴', 'cave', (2, 2), '화강암 절벽·둥근 석굴 입구·목조 처마'),
    ('ruin', '무너진 석탑', 'ruin', (2, 2), '3층 석탑 밑동·흩어진 옥개석'),
    ('ruin_city', '옛 궁터', 'ruin_city', (4, 3), '석축 월대·주춧돌·무너진 담·잡초'),
    ('shrine', '산사', 'shrine', (3, 3), '대웅전·3층 석탑·일주문·소나무'),
    ('landmark_nature', '당산나무', 'landmark_nature', (3, 3), '느티나무 거목·금줄·서낭당 돌무더기'),
    ('circle', '고인돌', 'circle', (2, 2), '탁자식 고인돌 두 기'),
    ('volcano', '백두산', 'volcano', (2, 2), '눈 덮인 화산·천지'),
    ('floating', '신선 봉우리', 'floating', (5, 4), '구름 위 바위 봉우리·육모정·소나무'),
]
