"""설원·북방(바이킹) 월드맵 아이콘 — 정면 카메라용 장면.
눈 덮인 지붕(윗면 흰 눈 · 처마 밑 나무색), 통나무 벽(가로 줄), 돌 성벽, 푸른 얼음, 롱하우스·용머리 배.
"""
import math
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / '_scene3d'))
import numpy as np  # noqa: E402
import oblique as ob  # noqa: E402
import east as E  # noqa: E402
import modsf_kit as M  # noqa: E402
import icons_v9_lib as L  # noqa: E402
from icons_v9_lib import SNOW, BLUE, WOOD, LEAF, STONE, RED, GOLD, ROCK, LAVA, WSTONE, hx  # noqa: E402
from oblique import Scene, box  # noqa: E402

SET = dict(id='snow-north', name='설원·북방')

# ── 재질(전부 World.png 색) ─────────────────────────────────────────────────────────────────────
ob.MAT.update({
    'snow': [SNOW[1], SNOW[2], SNOW[3], SNOW[4], SNOW[5]],
    'ice': [BLUE[1], BLUE[2], BLUE[3], BLUE[4], BLUE[5], SNOW[3], SNOW[5]],
    'darkwood': [WOOD[0], WOOD[1], WOOD[2], WOOD[3], WOOD[4]],
    'hide': [ROCK[3], ROCK[5], ROCK[6], ROCK[8], ROCK[9]],
    'aurora': [LEAF[3], LEAF[5], LEAF[6], LEAF[7]],
    'aurora2': [BLUE[3], BLUE[4], BLUE[5], SNOW[3]],
})


def _shade(ramp, s, d):
    return ob._darken(ob.MAT[ramp], s, d)


def logs_post(period=2.0, mat='wood'):
    """통나무 벽: 가로 줄(세로면)."""
    def post(tag, P, col, s, nrm):
        m = (np.abs(nrm[:, 2]) < .5) & (np.mod(P[:, 2], period) < .9)
        return np.where(m[:, None], _shade(mat, s, -1), col).astype(np.uint8)
    return post


def ice_post(mat='ice', period=5):
    """얼음: 비스듬한 밝은 결 + 드문 어두운 금."""
    def post(tag, P, col, s, nrm):
        x, y, z = P[:, 0], P[:, 1], P[:, 2]
        a = np.floor(x + z * .45 + y * .3)
        hi = np.mod(a, period) == 0
        out = np.where(hi[:, None], _shade(mat, s, 2), col)
        crack = ob.hsh(np.floor(x * .7), np.floor(z * .5), 21) > .93
        out = np.where(crack[:, None], _shade(mat, s, -1), out)
        return out.astype(np.uint8)
    return post


def stripes_post(mat_a='cloth', mat_b='snow', period=2.0):
    """돛의 세로 줄무늬."""
    def post(tag, P, col, s, nrm):
        m = np.mod(np.floor(P[:, 0] / period), 2) == 1
        return np.where(m[:, None], _shade(mat_b, s, 0), _shade(mat_a, s, 0)).astype(np.uint8)
    return post


def igloo_post(prim, mat='snow'):
    def post(tag, P, col, s, nrm):
        rel = P - prim.c[None, :]
        lat = np.degrees(np.arcsin(np.clip(rel[:, 2] / prim.r, -1, 1)))
        row = np.floor(lat / 16)
        lon = np.degrees(np.arctan2(rel[:, 1], rel[:, 0])) + row * 11
        m = (np.mod(lat, 16) < 2.6) | (np.mod(lon + 720, 22) < 2.4)
        return np.where(m[:, None], _shade(mat, s, -1), col).astype(np.uint8)
    return post


def add(s, p, post=None):
    p.post = post
    return s.add(p)


def _zlow(p):
    if hasattr(p, 'z0'):
        return p.z0
    if isinstance(p, ob.Poly):
        for n, d in zip(p.n, p.d):
            if n[2] < -.99:
                return -d
    if hasattr(p, 'c'):
        return p.c[2] - getattr(p, 'r', np.array([0, 0, 0]))[2] if np.ndim(getattr(p, 'r', 0)) else p.c[2]
    return 0


def cap_shadow(s, zmin):
    """키 큰 탑: zmin 위의 부품은 땅 그림자를 던지지 않는다(그림자가 칸 밖으로 길게 나가지 않게)."""
    for p in s.prims:
        if _zlow(p) >= zmin:
            p.role = 'nocast'
    return s


# ── 부품 ────────────────────────────────────────────────────────────────────────────────────────
def snow_gable(s, x0, x1, y0, y1, z, rise, wood='darkwood', lip=.9):
    """박공(마루 x 방향) — 밑은 나무 처마, 위는 눈 더미."""
    sl = rise / ((y1 - y0) / 2)
    s.gable(x0, x1, y0, y1, z, sl, mat=wood, tex='shingle', role='roof', contour=True)
    s.gable(x0 + .3, x1 - .3, y0 + lip, y1 - lip, z + lip * sl + .8, sl, mat='snow', tex='shingle', role='roof', contour=True)
    return z + rise + .8


def snow_gable_ns(s, x0, x1, y0, y1, z, rise, wood='darkwood', lip=.6):
    """박공(마루 y 방향) — 정면에 삼각 박공벽이 보인다. 경사면은 눈."""
    sl = rise / ((x1 - x0) / 2)
    s.add(E.gable_ns(x0, x1, y0, y1, z, sl, mat='wood', tex='plank', role='roof', contour=True))
    s.add(E.gable_ns(x0 - .4, x1 + .4, y0 + .7, y1, z + .9, sl, mat='snow', tex='speck', role='roof', contour=True))
    s.add(E.gable_ns(x0 - .4, x1 + .4, y0 + .7, y1, z + .9 - .7, sl, mat='darkwood', tex='plain', role='roof', contour=False))
    return z + rise + 1.0 - lip * sl


def loghouse(s, x, y, w, d, wh=4.0, rise=4.5, door=True, win=True, over=1.0, chimney=False):
    """통나무집: 정면에 삼각 박공벽(나무)이 보이고 양 경사는 눈."""
    dec = []
    if door:
        dec.append(('front', (x + w / 2 - 1.1, x + w / 2 + 1.1, 0, min(3.2, wh - .4), 'door')))
    if win and w >= 7:
        for fx in (.18, .82):
            wx = x + w * fx
            dec.append(('front', (wx - .6, wx + .6, wh * .45, wh * .45 + 1.2, 'lit')))
    add(s, box(x, x + w, y, y + d, 0, wh, mat='wood', tex='plain', role='house', contour=True, decals=tuple(dec)), logs_post())
    top = snow_gable_ns(s, x - over, x + w + over, y - .6, y + d + .4, wh, rise)
    if chimney:
        s.box(x + w * .68, x + w * .68 + 1.6, y + d * .6, y + d * .6 + 1.6, wh, top - .5, mat='stone', tex='brick', role='misc', contour=True)
        s.box(x + w * .68 - .3, x + w * .68 + 1.9, y + d * .6 - .3, y + d * .6 + 1.9, top - .5, top + .2, mat='snow', tex='plain', role='misc')
    return top


def longhouse(s, x, y, w, d, wh=3.4, rise=5.0, horns=True, shields=False, door=True):
    """롱하우스: 낮은 통나무 벽 + 길고 높은 눈 지붕 + 양 끝 엇갈린 박공판(용머리)."""
    dec = (('front', (x + w / 2 - 1.2, x + w / 2 + 1.2, 0, wh - .2, 'door')),) if door else ()
    add(s, box(x, x + w, y, y + d, 0, wh, mat='wood', tex='plain', role='house', contour=True, decals=dec), logs_post())
    top = snow_gable(s, x - 1.2, x + w + 1.2, y - 1.5, y + d + 1.2, wh, rise)
    ym = y + d / 2 - .1
    if horns:
        for ex, dx in ((x - 1.2, -1), (x + w + 1.2, 1)):
            s.box(ex - .5, ex + .5, ym - .5, ym + .5, top - 1.2, top + 1.8, mat='darkwood', tex='plain', role='misc')
            s.box(min(ex, ex + dx * 1.6), max(ex, ex + dx * 1.6), ym - .5, ym + .5, top + .9, top + 1.8, mat='darkwood', tex='plain', role='misc')
    if shields:
        for i, sx in enumerate(np.arange(x + 1.5, x + w - 1, 2.6)):
            s.add(E.Ellip(sx, y - .3, wh * .5, 1.1, .35, 1.1, mat=('cloth' if i % 2 == 0 else 'gold'), tex='plain', role='misc', contour=True))
    return top


def pine(s, x, y, h=10, r=3.2, z=0.0):
    """눈 덮인 전나무: 줄기 + 세 단 원뿔(초록) + 위를 덮은 눈 원뿔."""
    s.cyl(x, y, .6, z, z + h * .3, mat='bark', tex='plain', role='misc')
    tiers = ((r, z + h * .2, z + h * .62), (r * .78, z + h * .42, z + h * .82), (r * .55, z + h * .62, z + h))
    for rr, z0, z1 in tiers:
        s.add(ob.Cone(x, y, rr, z0, z1, mat='leaf2', tex='speck', role='roof', contour=True))
        s.add(ob.Cone(x, y + .1, rr * .72, z0 + (z1 - z0) * .28 + .35, z1 + .35, mat='snow', tex='speck', role='roof', contour=False))


def stone_wall(s, x0, x1, y0, y1, h, edges=('front',), mat='stone'):
    s.box(x0, x1, y0, y1, 0, h, mat=mat, tex='brick', role='wall', contour=True)
    s.box(x0, x1, y0 + .4, y1 - .4, h, h + .7, mat='snow', tex='plain', role='wall')
    s.crenels(x0, x1, y0, y1, h, mat=mat, step=2.5, h=1.8, edges=edges, depth=1.3)
    for xx in np.arange(x0, x1 - 2.4, 5.0):
        if 'front' in edges:
            s.box(xx, xx + 2.5, y0, y0 + 1.3, h + 1.8, h + 2.4, mat='snow', tex='plain', role='merlon')


def round_tower(s, xc, yc, r, h, roof='snow', rise=None, mat='stone', slits=True):
    dec = (('side', (-90, .8, h * .55, h * .55 + 2.4, 'dark')),) if slits else ()
    s.add(ob.Cyl(xc, yc, r, 0, h, mat=mat, tex='brick', role='tower', contour=True, decals=dec))
    rise = rise or r * 2.2
    if roof == 'ice':
        add(s, ob.Cone(xc, yc, r + 1.1, h, h + rise, mat='ice', tex='plain', role='roof', contour=True), ice_post())
    else:
        s.add(ob.Cone(xc, yc, r + 1.3, h, h + rise * .35, mat='darkwood', tex='plain', role='roof', contour=True))
        s.add(ob.Cone(xc, yc, r + .9, h + .9, h + rise, mat='snow', tex='speck', role='roof', contour=True))
    return h + rise


def spire(s, xc, yc, r, z0, h, mat='ice'):
    add(s, E.oct_pyr(xc, yc, r, z0, z0 + h, mat=mat, tex='plain', role='roof', contour=True), ice_post())


def stake_row(s, x0, x1, y, h, step=1.9, r=.85):
    for xx in np.arange(x0, x1 + .01, step):
        hh = h + (ob.hsh(np.array([xx * 3]), np.array([y]), 4)[0] - .5) * 1.0
        add(s, ob.Cyl(xx, y, r, 0, hh, mat='wood', tex='plain', role='wall', contour=True))
        s.add(ob.Cone(xx, y, r, hh, hh + 1.8, mat='wood', tex='plain', role='wall', contour=False))


def stake_col(s, x, y0, y1, h, step=2.4, r=.85):
    for yy in np.arange(y0, y1 + .01, step):
        add(s, ob.Cyl(x, yy, r, 0, h, mat='wood', tex='plain', role='wall', contour=True))
        s.add(ob.Cone(x, yy, r, h, h + 1.8, mat='wood', tex='plain', role='wall', contour=False))


def watchtower(s, x, y, h=12, w=4.4):
    for dx in (0, w - 1):
        for dy in (0, w - 1):
            s.box(x + dx, x + dx + 1, y + dy, y + dy + 1, 0, h, mat='darkwood', tex='plain', role='tower')
    add(s, box(x - .5, x + w + .5, y - .5, y + w + .5, h - 2.4, h, mat='wood', tex='plain', role='tower', contour=True), logs_post(1.2))
    snow_gable(s, x - 1.2, x + w + 1.2, y - 1.4, y + w + 1.2, h, 3.0)


def drift(s, x, y, rx, ry, rz, z=0.0):
    s.add(E.Ellip(x, y, z, rx, ry, rz, mat='snow', tex='speck', role='misc', contour=True))


def runestone(s, x, y, w=2.6, h=7.0, d=1.6):
    cx = x + w / 2
    s.box(x, x + w, y, y + d, 0, h, mat='stone', tex='plain', role='misc', contour=True,
          decals=(('front', (cx - .5, cx + .5, h * .3, h * .78, 'red')),
                  ('front', (cx - 1.0, cx + .5, h * .62, h * .62 + .9, 'red')),
                  ('front', (cx - .5, cx + 1.0, h * .42, h * .42 + .9, 'red'))))
    s.box(x + .5, x + w - .5, y, y + d, h, h + .9, mat='stone', tex='plain', role='misc', contour=True)
    s.box(x + .3, x + w - .3, y + .2, y + d - .2, h + .9, h + 1.4, mat='snow', tex='plain', role='misc')


def longship(s, x0, x1, y0, y1, sail=True, mast_h=15, sail_mat='cloth'):
    """롱쉽: 끝이 들린 선체 + 뱃전 방패 + 용머리 이물·고물 + 줄무늬 사각돛."""
    add(s, E.hull(x0, x1, y0, y1, 0, 3.0, rise=1.1, mat='darkwood', tex='plain', role='misc', contour=True), logs_post(1.2, 'darkwood'))
    s.box(x0 + 2.5, x1 - 2.5, y0 - .2, y0 + .2, 2.6, 3.2, mat='gold', tex='plain', role='misc')
    ym = (y0 + y1) / 2
    # 이물(오른쪽) 용머리 목: 위로 굽는 상자 몇 개
    for i, (dx, z0, z1) in enumerate(((-.3, 2.0, 5.0), (.6, 4.4, 7.4), (1.3, 6.8, 9.6))):
        s.box(x1 - 1.4 + dx, x1 + dx, ym - .6, ym + .6, z0, z1, mat='darkwood', tex='plain', role='misc', contour=True)
    s.box(x1 + .6, x1 + 3.2, ym - .7, ym + .7, 8.6, 10.4, mat='gold', tex='plain', role='misc', contour=True)
    s.box(x1 + 2.4, x1 + 3.4, ym - .7, ym + .7, 8.6, 9.2, mat='cloth', tex='plain', role='misc')
    # 고물(왼쪽) 말린 꼬리
    for (dx, z0, z1) in ((0, 2.4, 5.0), (-.9, 4.4, 6.8)):
        s.box(x0 + dx, x0 + dx + 1.0, ym - .5, ym + .5, z0, z1, mat='darkwood', tex='plain', role='misc', contour=True)
    # 뱃전 방패
    for i, sx in enumerate(np.arange(x0 + 3.5, x1 - 2.5, 2.4)):
        s.add(E.Ellip(sx, y0 - .2, 2.5, 1.0, .3, 1.0, mat=('cloth' if i % 2 == 0 else 'gold'), tex='plain', role='misc', contour=True))
    if sail:
        mx = (x0 + x1) / 2
        s.box(mx - .5, mx + .5, ym - .5, ym + .5, 3, mast_h, mat='wood', tex='plain', role='misc')
        sw = (x1 - x0) * .32
        add(s, box(mx - sw, mx + sw, ym - 1.2, ym - .6, mast_h - 8.5, mast_h - 1.2, mat=sail_mat, tex='plain', role='misc', contour=True),
            stripes_post(sail_mat, 'snow', 1.6))
        s.box(mx - sw - .6, mx + sw + .6, ym - 1.3, ym - .5, mast_h - 1.4, mast_h - .6, mat='wood', tex='plain', role='misc')


# ═════════════════════════════════════════════════════════════════════════════ 도시
def capital():
    """얼음 왕성: 눈 덮인 돌 성벽·둥근 탑, 안쪽 높은 기단 위 얼음 궁전(돔 + 첨탑)."""
    s = Scene()
    x0, x1, D = 6, 80, 66
    s.patch(x0, x1, 4, D - 4, lambda x, y: np.array(ob.MAT['snow'], np.uint8)[np.clip((2 + ob.hsh(x, y, 5) * 2.4).astype(int), 0, 4)], mat='snow')
    stone_wall(s, x0, x1, D - 5, D, 10)
    stone_wall(s, x0, x0 + 4, 0, D, 10)
    stone_wall(s, x1 - 4, x1, 0, D, 10)
    # 궁전 기단(높게: 앞 성벽 위로)
    cx = (x0 + x1) / 2
    s.box(cx - 21, cx + 21, 26, 50, 0, 9, mat='stone', tex='brick', role='keep', contour=True)
    s.box(cx - 21, cx + 21, 26.4, 49.6, 9, 9.6, mat='snow', tex='plain', role='keep')
    for i in range(5):
        s.box(cx - 5, cx + 5, 18 + i * 1.6, 26.5, 0, 1.8 * (i + 1), mat='stone', tex='plain', role='misc', contour=True)
    # 얼음 궁전 몸채
    add(s, box(cx - 16, cx + 16, 32, 46, 9, 21, mat='ice', tex='plain', role='keep', contour=True,
               decals=(('front', (cx - 2.4, cx + 2.4, 9, 16, 'arch')),
                       ('front', (cx - 11, cx - 8.8, 13, 18, 'glass')), ('front', (cx + 8.8, cx + 11, 13, 18, 'glass')))), ice_post())
    add(s, M.Dome(cx, 39, 21, 11, zmin=21, mat='ice', role='keep', contour=True), ice_post())
    spire(s, cx, 39, 2.2, 30, 16)
    for sx in (cx - 14, cx + 14):
        add(s, ob.Cyl(sx, 34, 3.2, 9, 30, mat='ice', tex='plain', role='tower', contour=True), ice_post())
        spire(s, sx, 34, 3.6, 30, 13)
    for sx in (cx - 19, cx + 19):
        add(s, ob.Cyl(sx, 46, 2.4, 9, 24, mat='ice', tex='plain', role='tower', contour=True), ice_post())
        spire(s, sx, 46, 2.8, 24, 10)
    # 성 안 집들(좌우로 엇갈림)
    for (hx_, hy, w, d) in ((10, 30, 7, 5), (63, 30, 7, 5), (10, 46, 7, 5), (63, 46, 7, 5), (11, 12, 9, 6), (60, 12, 9, 6)):
        loghouse(s, hx_, hy, w, d, wh=3.6, rise=3.6)
    for (tx, ty) in ((25, 14), (55, 14), (24, 56), (62, 56)):
        pine(s, tx, ty, 9, 2.8)
    # 앞 성벽 + 문루
    stone_wall(s, x0, cx - 9, 0, 5, 10, edges=('front', 'back'))
    stone_wall(s, cx + 9, x1, 0, 5, 10, edges=('front', 'back'))
    s.box(cx - 9, cx + 9, -2, 6, 0, 14, mat='stone', tex='brick', role='gate', contour=True,
          decals=(('front', (cx - 3.5, cx + 3.5, 0, 9, 'arch')),))
    s.box(cx - 9, cx + 9, -1.6, 5.6, 14, 14.7, mat='snow', tex='plain', role='gate')
    s.crenels(cx - 9, cx + 9, -2, 6, 14, mat='stone', step=2.2, h=1.8, edges=('front',), depth=1.3)
    for gx in (cx - 9, cx + 9):
        round_tower(s, gx, 1, 3.6, 17, roof='ice', rise=10)
    for (tx, ty) in ((x0 + 1, 2), (x1 - 1, 2), (x0 + 1, D - 2), (x1 - 1, D - 2)):
        round_tower(s, tx, ty, 4.2, 15, roof='snow', rise=10)
    return s


def fort_city():
    """통나무 요새 도시: 뾰족 말뚝 목책 + 롱하우스들 + 네 귀 망루 + 앞 문."""
    s = Scene()
    x0, x1, D = 5, 55, 46
    s.patch(x0, x1, 2, D - 2, lambda x, y: np.array(ob.MAT['snow'], np.uint8)[np.clip((1.6 + ob.hsh(x, y, 5) * 2.6).astype(int), 0, 4)], mat='snow')
    stake_row(s, x0, x1, D, 7)
    stake_col(s, x0, 2, D - 2, 7)
    stake_col(s, x1, 2, D - 2, 7)
    # 롱하우스(뒤는 크게, 엇갈려)
    longhouse(s, 17, 32, 22, 7, wh=3.8, rise=6.5)
    longhouse(s, 7, 21, 13, 6, wh=3.2, rise=5)
    longhouse(s, 35, 20, 13, 6, wh=3.2, rise=5)
    loghouse(s, 22, 10, 7, 5, wh=4, rise=4, chimney=True)
    s.box(36, 40, 9, 11.5, 0, 2.4, mat='wood', tex='plank', role='misc', contour=True)
    s.box(36.4, 39.6, 9.3, 11.2, 2.4, 3.0, mat='snow', tex='plain', role='misc')
    pine(s, 11, 9, 9, 2.6)
    pine(s, 48, 9, 9, 2.6)
    # 앞 목책 + 문
    stake_row(s, x0, 24.5, 0, 7)
    stake_row(s, 35.5, x1, 0, 7)
    for gx in (25.5, 34.5):
        s.box(gx - 1, gx + 1, -1, 1, 0, 11, mat='darkwood', tex='plain', role='gate', contour=True)
    add(s, box(24.5, 35.5, -1.2, 1, 9, 11, mat='wood', tex='plain', role='gate', contour=True), logs_post(1.0))
    s.box(24.5, 35.5, -1, .8, 11, 11.6, mat='snow', tex='plain', role='gate')
    for (wx, wy) in ((x0 - 1.6, -2), (x1 - 2.8, -2), (x0 - 1.6, D - 3), (x1 - 2.8, D - 3)):
        watchtower(s, wx, wy, 13, 4.4)
    return s


def harbor_city():
    """피오르 항구: 앞은 물가 — 나무 부두와 롱쉽 둘, 뒤로 롱하우스와 목책."""
    s = Scene()
    # 뒤 목책
    stake_row(s, 8, 70, 34, 6, step=2.2)
    longhouse(s, 11, 24, 20, 6, wh=3.6, rise=6)
    longhouse(s, 44, 24, 21, 6, wh=3.6, rise=6, shields=True)
    loghouse(s, 34, 14, 8, 5, wh=4.2, rise=4.4, chimney=True)
    loghouse(s, 6, 12, 7, 5, wh=4, rise=4)
    loghouse(s, 63, 12, 7, 5, wh=4, rise=4)
    pine(s, 5, 26, 10, 2.8)
    pine(s, 73, 26, 10, 2.8)
    # 부두(데크 + 말뚝 + 앞으로 뻗은 잔교 둘)
    # 물가 돌 둑 + 앞으로 뻗은 나무 잔교 셋(배는 잔교 사이에 댄다)
    s.box(6, 72, 4, 8, 0, 2.4, mat='stone', tex='brick', role='misc', contour=True)
    s.box(6, 72, 4.3, 7.7, 2.4, 3.0, mat='snow', tex='plain', role='misc')
    for (px0, px1) in ((10, 13), (43, 46), (71, 74)):
        s.box(px0, px1, -12, 4.5, 1.0, 1.8, mat='wood', tex='plank', role='misc', contour=True)
        for py in (-11.5, -5):
            s.box(px0 - .3, px0 + .7, py - .5, py + .5, -1, 2.8, mat='darkwood', tex='plain', role='misc')
            s.box(px1 - .7, px1 + .3, py - .5, py + .5, -1, 2.8, mat='darkwood', tex='plain', role='misc')
    for bx in (26, 58):
        s.box(bx, bx + 3, 4.5, 7, 3, 5, mat='wood', tex='plank', role='misc', contour=True)
        s.box(bx + .2, bx + 2.8, 4.7, 6.8, 5, 5.6, mat='snow', tex='plain', role='misc')
    longship(s, 16, 39, -12, -6, mast_h=18)
    longship(s, 50, 66, -9, -4, sail=True, mast_h=14, sail_mat='ice')
    return s


# ═════════════════════════════════════════════════════════════════════════════ 성
def castle():
    """얼음 성: 눈 언덕 위 푸른 얼음 성벽과 투명한 얼음 첨탑 무리."""
    s = Scene()
    drift(s, 22, 12, 21, 11, 4.5)
    add(s, box(5, 39, 12, 17, 0, 10, mat='ice', tex='plain', role='wall', contour=True), ice_post())
    add(s, box(6, 38, 0, 5, 0, 7, mat='ice', tex='plain', role='wall', contour=True,
               decals=(('front', (19, 25, 0, 5.4, 'arch')),)), ice_post())
    s.crenels(6, 38, 0, 5, 7, mat='ice', step=2.2, h=1.6, edges=('front',), depth=1.2)
    add(s, box(14, 30, 6, 13, 0, 17, mat='ice', tex='plain', role='keep', contour=True,
               decals=(('front', (20.8, 23.2, 10, 14, 'glass')),)), ice_post())
    spire(s, 22, 9.5, 4.6, 17, 22)
    for (sx, sy, r, z0, h) in ((15, 9, 2.6, 17, 12), (29, 9, 2.6, 17, 12)):
        spire(s, sx, sy, r, z0, h)
    for (sx, sy) in ((6, 3), (38, 3), (8, 15), (36, 15)):
        add(s, ob.Cyl(sx, sy, 3.0, 0, 13 if sy < 10 else 15, mat='ice', tex='plain', role='tower', contour=True), ice_post())
        spire(s, sx, sy, 3.4, 13 if sy < 10 else 15, 9)
    return s


def castle_b():
    """바이킹 장군 전당: 큰 롱하우스 + 앞 방패 벽 + 깃발."""
    s = Scene()
    s.box(5, 41, 8, 22, 0, 2.0, mat='stone', tex='brick', role='misc', contour=True)
    s.box(5.3, 40.7, 8.3, 21.7, 2.0, 2.6, mat='snow', tex='plain', role='misc')
    add(s, box(8.5, 37.5, 11, 20, 2, 8, mat='wood', tex='plain', role='keep', contour=True,
               decals=(('front', (20.5, 25.5, 2, 7.4, 'door')), ('front', (11, 12.4, 4.4, 6, 'lit')), ('front', (33.6, 35, 4.4, 6, 'lit')))),
        logs_post())
    for px in (8.5, 13, 19, 27, 33, 36.5):
        s.box(px, px + 1, 10.2, 11, 2, 8, mat='darkwood', tex='plain', role='misc')
    top = snow_gable(s, 7, 39, 8.5, 22, 8, 10)
    ym = 15.2
    for ex, dx in ((7, -1), (39, 1)):
        s.box(ex - .6, ex + .6, ym - .6, ym + .6, top - 2.2, top + 2.6, mat='darkwood', tex='plain', role='misc', contour=True)
        s.box(min(ex, ex + dx * 2.0), max(ex, ex + dx * 2.0), ym - .6, ym + .6, top + 1.2, top + 2.6, mat='gold', tex='plain', role='misc', contour=True)
    # 방패 벽(앞)
    s.box(5, 41, 1, 2.2, 0, 3.4, mat='darkwood', tex='plank', role='wall', contour=True)
    mats = ('cloth', 'gold', 'ice', 'cloth', 'snow', 'gold')
    for i, sx in enumerate(np.arange(6.5, 40, 3.0)):
        if 19 < sx < 27:
            continue
        s.add(E.Ellip(sx, .6, 3.0, 1.45, .4, 1.45, mat=mats[i % len(mats)], tex='plain', role='misc', contour=True))
        s.add(E.Ellip(sx, .3, 3.0, .45, .2, .45, mat='stone', tex='plain', role='misc'))
    for fx in (19, 27):
        s.box(fx - .5, fx + .5, .2, 1.2, 0, 14, mat='darkwood', tex='plain', role='misc')
        s.box(fx - .5 if fx < 23 else fx - 4.5, fx + 4 if fx < 23 else fx + .5, .2, .8, 9.5, 13.5, mat='cloth', tex='plain', role='misc', contour=True)
    return s


# ═════════════════════════════════════════════════════════════════════════════ 마을
def large_town():
    """눈 마을: 눈 쌓인 박공 통나무집 여섯·장작더미·전나무."""
    s = Scene()
    loghouse(s, 2, 22, 9, 6, wh=4.6, rise=5.5, chimney=True)
    loghouse(s, 17, 25, 10, 6, wh=5, rise=6)
    loghouse(s, 33, 22, 9, 6, wh=4.6, rise=5.5, chimney=True)
    loghouse(s, 8, 9, 9, 6, wh=4.4, rise=5)
    loghouse(s, 26, 8, 10, 6, wh=4.4, rise=5.4, chimney=True)
    # 장작더미(앞면에 통나무 끝 무늬)
    for (wx, wy, ww) in ((19, 1, 5), (2, 2, 4), (38, 2, 4)):
        s.box(wx, wx + ww, wy, wy + 2.2, 0, 2.6, mat='wood', tex='plain', role='misc', contour=True,
              decals=tuple(('front', (wx + .4 + k * 1.3, wx + 1.2 + k * 1.3, .4 + (k % 2) * 1.0, 1.2 + (k % 2) * 1.0, 'gold'))
                           for k in range(int(ww / 1.3))))
        s.box(wx + .2, wx + ww - .2, wy + .2, wy + 2.0, 2.6, 3.2, mat='snow', tex='plain', role='misc')
    pine(s, 42, 13, 10, 2.6)
    pine(s, 2.5, 14, 9, 2.4)
    return s


def village():
    """이글루 마을: 눈 벽돌 이글루 셋(굴 입구)과 썰매."""
    s = Scene()
    for (x, y, r) in ((9, 10, 7.2), (23, 13, 6.0), (17, 2, 5.0)):
        d = M.Dome(x, y, 0, r, zmin=0, mat='snow', role='house', contour=True)
        add(s, d, igloo_post(d))
        s.box(x - 1.8, x + 1.8, y - r - 1.6, y - r + 1.4, 0, 3.2, mat='snow', tex='plain', role='house', contour=True,
              decals=(('front', (x - 1.0, x + 1.0, 0, 2.6, 'arch')),))
    s.box(2, 7, -1, 1, .6, 1.4, mat='wood', tex='plain', role='misc', contour=True)
    s.box(2, 7.6, -1.2, -.8, 0, .6, mat='darkwood', tex='plain', role='misc')
    s.box(6.6, 7.6, -1.2, 1, .6, 2.4, mat='darkwood', tex='plain', role='misc')
    return s


def village_b():
    """롱하우스 마을: 롱하우스 둘 + 작은 창고 + 전나무."""
    s = Scene()
    longhouse(s, 3.5, 13, 15, 6, wh=3.2, rise=5)
    longhouse(s, 11, 1, 13, 5, wh=3.0, rise=4.4)
    s.box(1.5, 6, 1, 5, 0, 3, mat='wood', tex='plank', role='house', contour=True)
    snow_gable(s, .8, 6.7, .4, 5.4, 3, 2.4)
    pine(s, 23.8, 13, 9, 2.2)
    return s


def tent_post(z0, h):
    def post(tag, P, col, s, nrm):
        z = P[:, 2]
        band = (z > z0 + h * .26) & (z < z0 + h * .36)
        smoke = z > z0 + h * .76
        out = np.where(band[:, None], _shade('darkwood', s, 1), col)
        return np.where(smoke[:, None], _shade('darkwood', s, 0), out).astype(np.uint8)
    return post


def camp():
    """순록 유목 천막: 가죽 원뿔 천막 둘(장대 끝·검은 입구·띠) + 썰매 + 순록."""
    s = Scene()
    for (x, y, r, h) in ((11, 11, 6.2, 17), (23.4, 9, 4.7, 13.5)):
        add(s, ob.Cone(x, y, r, 0, h, mat='hide', tex='speck', role='house', contour=True), tent_post(0, h))
        s.box(x - 1.2, x + 1.2, y - r - .2, y - r + 1.2, 0, h * .3, mat='darkwood', tex='plain', role='misc', contour=True,
              decals=(('front', (x - .7, x + .7, 0, h * .3 - .6, 'dark')),))
        for dx in (-1.3, 1.3):
            s.box(x + dx - .5, x + dx + .5, y - .5, y + .5, h - 1.6, h + 2.4, mat='darkwood', tex='plain', role='misc')
        drift(s, x + r * .55, y - r * .75, 2.2, 1.3, 1.1)
    # 썰매(짐을 실은)
    s.box(14.5, 20.5, -1.4, 1.2, .8, 1.8, mat='wood', tex='plank', role='misc', contour=True)
    s.box(13.9, 20.9, -1.6, -1.1, 0, .8, mat='darkwood', tex='plain', role='misc')
    s.box(20, 21, -1.6, 1.2, 0, 3.0, mat='darkwood', tex='plain', role='misc')
    s.box(15.1, 19, -1, .8, 1.8, 3.4, mat='hide', tex='speck', role='misc', contour=True)
    # 순록(왼쪽 앞)
    q = 2.0
    s.add(E.Ellip(5 + q, -.6, 4.0, 2.8, 1.2, 1.6, mat='hide', tex='plain', role='misc', contour=True))
    for lx in (3.0, 4.2, 6.0, 7.0):
        s.box(lx + q - .5, lx + q + .5, -.9, -.2, 0, 3.0, mat='darkwood', tex='plain', role='misc')
    s.box(1.4 + q, 2.6 + q, -1.0, -.2, 4.2, 6.4, mat='hide', tex='plain', role='misc', contour=True)
    s.add(E.Ellip(1.2 + q, -.7, 6.6, 1.2, .9, .9, mat='hide', tex='plain', role='misc', contour=True))
    for ax in (.2, 2.2):
        s.box(ax + q - .5, ax + q + .5, -.6, 0, 7.2, 9.8, mat='darkwood', tex='plain', role='misc')
    s.box(-.6 + q, 3.4 + q, -.6, 0, 9.0, 9.8, mat='darkwood', tex='plain', role='misc')
    s.box(3.8 + q, 6.4 + q, -1.0, .2, 5.3, 5.9, mat='snow', tex='plain', role='misc')
    return s


# ═════════════════════════════════════════════════════════════════════════════ 탑
def tower_small():
    """봉화탑: 눈 덮인 돌 원탑 + 꼭대기 불."""
    s = Scene()
    s.add(ob.Cyl(6, 3, 3.6, 0, 2.6, mat='stone', tex='brick', role='tower', contour=True))
    s.add(ob.Cyl(6, 3, 3.8, 2.0, 2.8, mat='snow', tex='plain', role='tower'))
    s.add(ob.Cyl(6, 3, 3.1, 2.6, 16, mat='stone', tex='brick', role='tower', contour=True,
                 decals=(('side', (-90, .8, 8, 10.5, 'dark')), ('side', (-90, 1.0, 2.6, 5.6, 'door')))))
    s.add(ob.Cyl(6, 3, 3.4, 16, 18, mat='stone', tex='brick', role='tower', contour=True))
    s.ring_crenels(6, 3, 3.4, 18, mat='stone', n=6, size=1.6, h=1.5)
    s.add(ob.Cyl(6, 3, 3.1, 18, 18.6, mat='snow', tex='plain', role='tower'))
    s.add(ob.Cyl(6, 3, 1.8, 18, 19.6, mat='darkwood', tex='plain', role='misc', contour=True))
    s.add(E.Ellip(6, 3, 21.0, 1.7, 1.3, 2.4, mat='ember', tex='speck', role='misc'))
    s.add(E.Ellip(6, 2.8, 22.2, .8, .7, 1.5, mat='ember', tex='plain', role='misc'))
    return cap_shadow(s, 14)


def tower_great():
    """얼음 첨탑: 눈 바위 위로 솟은 팔각 얼음 기둥과 주위 얼음 결정."""
    s = Scene()
    drift(s, 15, 8, 10, 6, 3.4)
    s.add(E.Ellip(15, 9, 2, 9.5, 5.5, 4.0, mat='rock', tex='speck', role='misc', contour=True))
    drift(s, 15, 8, 11, 6, 2.0, z=3.8)
    add(s, E.oct_prism(15, 9, 5.6, 2, 25, mat='ice', tex='plain', role='tower', contour=True,
                       decals=(('front', (13.6, 16.4, 4, 9, 'arch')),)), ice_post())
    add(s, E.oct_prism(15, 9, 4.0, 25, 35, mat='ice', tex='plain', role='tower', contour=True), ice_post())
    spire(s, 15, 9, 4.6, 35, 14)
    for (x, y, r, z0, h) in ((8.5, 7, 2.4, 0, 17), (21.5, 7, 2.4, 0, 15), (10, 3, 1.8, 0, 10), (20.5, 3, 2.0, 0, 12), (15, 13, 2.6, 22, 13)):
        spire(s, x, y, r, z0, h)
    for z in (17, 25):
        s.add(E.oct_prism(15, 9, 6.2 if z == 17 else 4.8, z, z + 1.2, mat='snow', tex='plain', role='tower', contour=True))
    return cap_shadow(s, 30)


# ═════════════════════════════════════════════════════════════════════════════ 지형·폐허
def cave():
    """얼음 동굴: 눈 덮인 바위 언덕에 푸른 얼음 입구와 고드름."""
    s = Scene()
    s.add(E.Ellip(15, 9, 4, 12.6, 8, 11, mat='rock', tex='speck', role='wall', contour=True))
    s.add(E.Ellip(15, 9.5, 8.6, 11.4, 7.4, 7.6, mat='snow', tex='speck', role='wall', contour=True))
    s.add(E.Ellip(5.5, 6, 2, 4.4, 4, 5, mat='rock', tex='speck', role='wall', contour=True))
    s.add(E.Ellip(5.5, 6.4, 4.5, 3.7, 3.4, 3, mat='snow', tex='speck', role='wall', contour=False))
    add(s, box(8.5, 21.5, -1, 3, 0, 11, mat='ice', tex='plain', role='house', contour=True,
               decals=(('front', (11, 19, 0, 8.8, 'arch')),)), ice_post())
    for (ix, ln) in ((11.6, 2.4), (13.4, 3.4), (15.2, 2.2), (17, 3.0), (18.6, 1.8)):
        s.add(E.InvCone(ix, -1.1, .55, 8.8 - ln, 8.8, mat='ice', tex='plain', role='misc'))
    s.box(8.2, 21.8, -.8, 2.6, 11, 11.8, mat='snow', tex='plain', role='misc')
    spire(s, 7.5, 1, 1.8, 0, 8)
    spire(s, 22.8, 1, 1.6, 0, 6)
    return s


def ruin():
    """룬석 무덤: 돌 입구가 난 눈 덮인 봉분 + 앞에 붉은 룬을 새긴 선돌."""
    s = Scene()
    s.add(E.Ellip(13, 12, 0, 11, 7.5, 8.5, mat='snow', tex='speck', role='wall', contour=True))
    s.add(E.Ellip(13, 12, 0, 11.4, 7.9, 2.2, mat='rock', tex='speck', role='wall', contour=True))
    s.add(E.Ellip(26, 14, 0, 4.6, 3.8, 5, mat='snow', tex='speck', role='wall', contour=True))
    s.box(10, 16, 4, 6.5, 0, 5.4, mat='stone', tex='plain', role='house', contour=True,
          decals=(('front', (11.6, 14.4, 0, 3.8, 'dark')),))
    s.box(9.4, 16.6, 3.6, 6.5, 5.4, 6.6, mat='stone', tex='plain', role='house', contour=True)
    s.box(9.6, 16.4, 3.8, 6.4, 6.6, 7.2, mat='snow', tex='plain', role='misc')
    runestone(s, 3, 1, 2.6, 8)
    runestone(s, 22, 3, 2.6, 9.5)
    drift(s, 19, 1, 2.6, 1.6, 1.2)
    return s


def ruin_city():
    """얼어붙은 폐허 도시: 눈에 묻힌 지붕들·부서진 돌담·얼음 기둥."""
    s = Scene()
    # 부서진 돌담(높이 들쭉날쭉)
    for (x0, x1, y0, y1, h) in ((2, 16, 26, 30, 8), (22, 32, 26, 30, 5), (40, 60, 26, 30, 9), (2, 6, 4, 26, 6), (56, 60, 6, 26, 4)):
        s.box(x0, x1, y0, y1, 0, h, mat='stone', tex='brick', role='wall', contour=True)
        s.box(x0, x1, y0 + .3, y1 - .3, h, h + .8, mat='snow', tex='plain', role='wall')
    # 눈에 묻힌 지붕(벽은 안 보이고 지붕만)
    for (x, y, w, d, rise) in ((9, 14, 13, 7, 4.5), (36, 15, 14, 7, 5.0), (24, 4, 12, 6, 4.0)):
        snow_gable(s, x, x + w, y, y + d, 0, rise)
        s.box(x + w * .6, x + w * .6 + 1.6, y + d * .3, y + d * .3 + 1.2, 0, rise * .9, mat='darkwood', tex='plain', role='misc')
    # 얼음 기둥
    for (x, y, r, h) in ((19, 20, 2.0, 18), (31, 13, 2.4, 22), (48, 8, 2.0, 15), (11, 4, 1.6, 12), (52, 20, 1.8, 16)):
        add(s, E.oct_prism(x, y, r, 0, h, mat='ice', tex='plain', role='tower', contour=True), ice_post())
        spire(s, x, y, r + .4, h, 4)
    # 눈 더미
    for (cx, cy, rx, ry, rz) in ((15, 8, 9, 5, 3), (46, 4, 10, 4, 2.6), (30, 22, 8, 4, 2.4), (55, 12, 5, 4, 2.8)):
        drift(s, cx, cy, rx, ry, rz)
    return s


def wood_gable(s, x0, x1, y0, y1, z, rise, mat='darkwood'):
    """눈이 적은 검은 널 지붕(마루 x) + 마루에만 눈 띠."""
    sl = rise / ((y1 - y0) / 2)
    s.gable(x0, x1, y0, y1, z, sl, mat=mat, tex='shingle', role='roof', contour=True)
    ym = (y0 + y1) / 2
    s.box(x0 + .4, x1 - .4, ym - 1.4, ym + 1.4, z + rise - 1.4, z + rise + .5, mat='snow', tex='plain', role='roof', contour=True)
    return z + rise


def dragon(s, x, y, z, dy=-1, h=3.0):
    """박공 꼭대기에서 앞으로 굽어 나온 용머리."""
    s.box(x - .5, x + .5, y - .9, y + .2, z - .5, z + h * .6, mat='darkwood', tex='plain', role='misc', contour=True)
    s.box(x - .6, x + .6, y - 2.2, y - .6, z + h * .5, z + h, mat='gold', tex='plain', role='misc', contour=True)


def shrine():
    """오딘 신전: 검은 목조 스타브 교회 — 3단으로 겹친 널 지붕과 박공 끝 용머리, 꼭대기 첨탑."""
    s = Scene()
    s.box(6, 42, 3, 21, 0, 2.0, mat='stone', tex='brick', role='misc', contour=True)
    s.box(6.3, 41.7, 3.3, 20.7, 2.0, 2.6, mat='snow', tex='plain', role='misc')
    for i in range(3):
        s.box(20.5, 27.5, -.5 + i * 1.2, 4, 0, .7 * (i + 1), mat='stone', tex='plain', role='misc', contour=True)
    # 1단: 둘레 회랑(낮은 검은 벽 + 기둥 + 검은 널 지붕)
    add(s, box(9, 39, 6, 18, 2, 5.6, mat='darkwood', tex='plain', role='house', contour=True,
               decals=(('front', (22, 26, 2, 5.4, 'reddoor')),)), logs_post(1.4, 'darkwood'))
    for px in (9, 14, 19, 28, 33, 38):
        s.box(px, px + 1, 5.4, 6, 2, 5.6, mat='wood', tex='plain', role='misc')
    wood_gable(s, 7.5, 40.5, 4.2, 19.8, 5.6, 4.2)
    # 2단 몸채: 정면 박공
    add(s, box(14, 34, 9, 16, 6, 14, mat='darkwood', tex='plain', role='keep', contour=True,
               decals=(('front', (23.2, 24.8, 9.6, 12.4, 'lit')),)), logs_post(1.4, 'darkwood'))
    sl = 7.0 / 11
    s.add(E.gable_ns(13, 35, 8, 17, 14, sl, mat='darkwood', tex='plank', role='roof', contour=True))
    s.add(E.gable_ns(12.6, 35.4, 8.6, 17, 14.6, sl, mat='snow', tex='speck', role='roof', contour=True))
    top1 = 14 + 11 * sl
    # 3단 탑
    add(s, box(20, 28, 11, 15.5, top1 - 2.6, top1 + 3.6, mat='darkwood', tex='plain', role='keep', contour=True,
               decals=(('front', (23.4, 24.6, top1, top1 + 2.2, 'dark')),)), logs_post(1.4, 'darkwood'))
    sl2 = 5.0 / 5
    s.add(E.gable_ns(19, 29, 10, 16.4, top1 + 3.6, sl2, mat='darkwood', tex='plank', role='roof', contour=True))
    s.add(E.gable_ns(18.6, 29.4, 10.6, 16.4, top1 + 4.2, sl2, mat='snow', tex='speck', role='roof', contour=True))
    top2 = top1 + 3.6 + 5
    s.add(E.oct_pyr(24, 13.2, 2.4, top2 - 2.2, top2 + 7.5, mat='darkwood', tex='plain', role='roof', contour=True))
    s.add(ob.Cyl(24, 13.2, .4, top2 + 7, top2 + 9.5, mat='gold', tex='plain', role='roof'))
    dragon(s, 24, 8, top1)
    dragon(s, 24, 10, top2, h=2.4)
    for ex in (7.5, 40.5):
        s.box(ex - .5, ex + .5, 11.5, 12.5, 8, 12.4, mat='darkwood', tex='plain', role='misc')
        s.box(ex - .6, ex + .6, 10.2, 11.8, 10.6, 12.6, mat='gold', tex='plain', role='misc', contour=True)
    for fx in (13, 35):
        s.cyl(fx, 1, 1.4, 0, 3, mat='stone', tex='brick', role='misc', contour=True)
        s.add(E.Ellip(fx, 1, 4.0, 1.2, 1.0, 1.6, mat='ember', tex='speck', role='misc'))
    return s


def landmark_nature():
    """세계수: 눈 덮인 거대 물푸레나무 — 굵은 줄기·뻗은 뿌리·눈 얹힌 넓은 수관."""
    s = Scene()
    f, X = .86, 22

    def q(x):
        return X + (x - 23) * f
    s.cyl(q(23), 10, 4.6 * f, 0, 18 * f, mat='bark', tex='speck', role='wall', contour=True)
    s.add(E.Ellip(q(23), 10, 1, 7.6 * f, 5.2 * f, 3.0, mat='bark', tex='speck', role='wall', contour=True))
    for (rx, ry, dx) in ((14, 6, -1), (32, 6, 1), (23, 3, 0)):
        s.add(E.Ellip(q(rx), ry, .6, (3.6 if dx else 2.2) * f, 1.6, 1.4, mat='bark', tex='speck', role='misc', contour=True))
    s.box(q(17), q(17) + 1.8, 9, 11, 12 * f, 22 * f, mat='bark', tex='plain', role='misc')
    s.box(q(29) - 1.8, q(29), 9, 11, 12 * f, 22 * f, mat='bark', tex='plain', role='misc')
    for (x, y, z, rx, ry, rz) in ((23, 12, 25, 17, 8, 7.5), (11, 10, 22, 9, 5.5, 5.5), (35, 10, 22, 9, 5.5, 5.5),
                                  (17, 11, 31, 10, 6, 5.5), (30, 11, 31, 10, 6, 5.5), (23, 10, 35, 9, 5, 5)):
        x, z, rx, ry, rz = q(x), z * f, rx * f, ry * f, rz * f
        s.add(E.Ellip(x, y, z, rx, ry, rz, mat='leaf2', tex='speck', role='roof', contour=True))
        s.add(E.Ellip(x, y + .3, z + rz * .32, rx * .92, ry * .88, rz * .72, mat='snow', tex='speck', role='roof', contour=False))
    runestone(s, q(37), 1, 2.2, 5.5)
    drift(s, q(9), 4, 3.0, 2, 1.6)
    return s


def circle():
    """룬 돌원: 둥글게 선 선돌들(눈 모자)과 가운데 제단석."""
    s = Scene()
    cx, cy, rx, ry = 14.5, 10, 11, 8.5
    n = 9
    for i in range(n):
        th = 2 * math.pi * i / n - math.pi / 2
        x = cx + rx * math.cos(th)
        y = cy + ry * math.sin(th)
        h = 8.5 + 2.0 * ob.hsh(np.array([i]), np.array([1]), 3)[0]
        if y < cy - 5:
            h -= 1.5
        s.box(x - 1.3, x + 1.3, y - .7, y + .7, 0, h, mat='stone', tex='plain', role='misc', contour=True)
        s.box(x - .9, x + .9, y - .7, y + .7, h, h + .9, mat='stone', tex='plain', role='misc', contour=True)
        s.box(x - .8, x + .8, y - .5, y + .5, h + .9, h + 1.5, mat='snow', tex='plain', role='misc')
        drift(s, x, y - .6, 1.8, 1.0, .8)
    s.box(11.5, 18.5, 8, 12, 0, 2.6, mat='stone', tex='brick', role='misc', contour=True,
          decals=(('front', (13.5, 16.5, .6, 2.0, 'red')),))
    s.box(11.7, 18.3, 8.3, 11.7, 2.6, 3.2, mat='snow', tex='plain', role='misc')
    return s


def volcano():
    """설산 화산: 눈 덮인 비탈 + 붉은 화구와 흘러내린 용암."""
    s = Scene()
    s.add(E.oct_pyr(15, 9, 14, 0, 24, ztrunc=16, mat='basalt', tex='speck', role='wall', contour=True))
    s.add(E.oct_pyr(15, 9, 14 * (24.9 - 8) / 24, 8, 24.9, ztrunc=16.5, mat='snow', tex='speck', role='wall', contour=True))
    for (ax, ay, zt) in ((7.5, 5, 9), (21, 4.6, 8), (10.5, 2.5, 6.5), (19.5, 2.4, 6)):
        s.add(E.Ellip(ax, ay, zt, 1.6, 1.2, 3.2, mat='snow', tex='speck', role='wall', contour=False))
    s.add(E.oct_prism(15, 9, 3.6, 16.3, 17.0, mat='ember', tex='plain', role='misc'))
    s.add(E.Ellip(15, 8.6, 17.0, 3.6, 2.8, 1.0, mat='ember', tex='speck', role='misc'))
    s.add(E.Ellip(13.4, 3.4, 10.5, 1.1, .8, 6.0, mat='ember', tex='speck', role='misc'))
    for (x, y) in ((4, 2), (26, 3)):
        s.add(E.Ellip(x, y, .5, 3.2, 2.2, 2.0, mat='basalt', tex='speck', role='misc', contour=True))
        s.add(E.Ellip(x, y + .3, 1.6, 2.6, 1.8, 1.2, mat='snow', tex='speck', role='misc'))
    return s


def inv_pyr(xc, yc, rx, ry, zb, zt, n=14, rot=0.0, seed=0, **kw):
    """거꾸로 선 다각뿔(위가 넓은 타원 다각형, 꼭짓점이 아래) — 떠 있는 섬의 밑동."""
    vs = []
    for k in range(n):
        th = 2 * math.pi * (k + rot) / n
        j = 1 + .12 * (ob.hsh(np.array([k]), np.array([seed]), 7)[0] - .5)
        vs.append(np.array([xc + rx * j * math.cos(th), yc + ry * j * math.sin(th), zt]))
    tip = np.array([xc, yc, zb])
    cen = np.array([xc, yc, (zb + zt) / 2])
    pl = []
    for k in range(n):
        a_, b_ = vs[k], vs[(k + 1) % n]
        nrm = np.cross(a_ - tip, b_ - tip)
        if nrm @ (cen - tip) > 0:
            nrm = -nrm
        tag = 'front' if nrm[1] < -abs(nrm[0]) * .5 else 'slope'
        pl.append((tuple(nrm), float(nrm @ tip), tag))
    pl.append(((0, 0, 1), zt, 'top'))
    return ob.Poly(pl, **kw)


def flat_ell(xc, yc, rx, ry, z0, z1, n=14, **kw):
    pl = []
    for k in range(n):
        th = 2 * math.pi * (k + .5) / n
        nn = (math.cos(th) / rx, math.sin(th) / ry, 0)
        L_ = math.hypot(*nn[:2])
        nn = (nn[0] / L_, nn[1] / L_, 0)
        d = math.cos(math.pi / n) / L_ * 1.0
        pl.append((nn, nn[0] * xc + nn[1] * yc + d, 'front' if nn[1] < -.5 else 'side'))
    pl += [((0, 0, 1), z1, 'top'), ((0, 0, -1), -z0, 'bottom')]
    return ob.Poly(pl, **kw)


ob.MAT['deepice'] = [BLUE[0], BLUE[1], BLUE[2], BLUE[3], BLUE[4], SNOW[3]]


def floating():
    """오로라 아래 떠 있는 빙산섬: 얼음 밑동 + 눈 윗면 + 롱하우스·전나무, 하늘의 초록·청록 오로라."""
    s = Scene()
    xc, yc, zt = 38, 12, 24
    add(s, inv_pyr(xc, yc, 29, 11, 0, zt, seed=1, mat='deepice', tex='plain', role='wall', contour=True), ice_post('deepice', 4))
    add(s, inv_pyr(xc - 14, yc - 2, 10, 6, 6, zt - .2, seed=2, rot=.3, mat='deepice', tex='plain', role='wall', contour=True), ice_post('deepice', 4))
    add(s, inv_pyr(xc + 15, yc - 1, 9, 6, 9, zt - .2, seed=3, rot=.6, mat='deepice', tex='plain', role='wall', contour=True), ice_post('deepice', 4))
    s.add(flat_ell(xc, yc, 29.6, 11.6, zt - 1.2, zt + 1.0, mat='snow', tex='speck', role='ground', contour=True))
    zb = zt + 1.0
    longhouse_at = (xc - 8, yc + 2, 16, 5)
    x, y, w, d = longhouse_at
    add(s, box(x, x + w, y, y + d, zb, zb + 3.4, mat='wood', tex='plain', role='house', contour=True,
               decals=(('front', (x + w / 2 - 1.2, x + w / 2 + 1.2, zb, zb + 3.0, 'door')),)), logs_post())
    top = snow_gable(s, x - 1.2, x + w + 1.2, y - 1.5, y + d + 1.2, zb + 3.4, 5.0)
    ym = y + d / 2 - .1
    for ex, dx in ((x - 1.2, -1), (x + w + 1.2, 1)):
        s.box(ex - .5, ex + .5, ym - .5, ym + .5, top - 1.2, top + 1.8, mat='darkwood', tex='plain', role='misc')
        s.box(min(ex, ex + dx * 1.6), max(ex, ex + dx * 1.6), ym - .5, ym + .5, top + .9, top + 1.8, mat='darkwood', tex='plain', role='misc')
    for (tx, ty, h) in ((xc - 20, yc + 1, 10), (xc - 15, yc - 4, 8), (xc + 17, yc + 2, 11), (xc + 22, yc - 3, 8)):
        pine(s, tx, ty, h, 2.4, z=zb)
    # 오로라: 뒤 하늘의 물결 띠(그림자 없음)
    for i in range(28):
        x = 6 + i * 2.3
        z0 = 30.5 + 2.6 * math.sin(i * .5) + (i % 3) * .5
        h = 6 + 2.2 * math.sin(i * .8 + 1)
        mat = 'aurora' if (i // 5) % 2 == 0 else 'aurora2'
        s.add(box(x, x + 2.3, 26, 26.6, z0, z0 + h, mat=mat, tex='plain', role='nocast'))
    return s


ORDER = [
    ('capital', '얼음 왕성', 'capital', (6, 6), '눈 덮인 돌 성벽·둥근 탑, 높은 기단 위 얼음 궁전 돔과 첨탑'),
    ('fort_city', '통나무 요새 도시', 'fort_city', (4, 4), '뾰족 말뚝 목책·네 귀 망루·롱하우스들'),
    ('harbor_city', '피오르 항구', 'harbor_city', (5, 4), '롱쉽(용머리 배) 둘·나무 부두·롱하우스'),
    ('castle', '얼음 성', 'castle', (3, 3), '눈 언덕 위 얼음 성벽과 푸른 얼음 첨탑'),
    ('castle', '장군 전당', 'castle_b', (3, 3), '큰 롱하우스·방패 벽·깃발'),
    ('large_town', '눈 마을', 'large_town', (3, 3), '눈 쌓인 박공 통나무집·장작더미·전나무'),
    ('village', '이글루 마을', 'village', (2, 2), '눈 벽돌 이글루 셋·썰매'),
    ('village', '롱하우스 마을', 'village_b', (2, 2), '롱하우스 둘·창고·전나무'),
    ('camp', '순록 유목 천막', 'camp', (2, 2), '가죽 원뿔 천막·썰매·순록'),
    ('tower_small', '봉화탑', 'tower_small', (1, 2), '눈 덮인 돌 원탑 꼭대기의 봉화'),
    ('tower_great', '얼음 첨탑', 'tower_great', (2, 4), '눈 바위 위 팔각 얼음 기둥과 결정'),
    ('cave', '얼음 동굴', 'cave', (2, 2), '눈 덮인 바위 언덕·푸른 얼음 입구·고드름'),
    ('ruin', '룬석 무덤', 'ruin', (2, 2), '눈 덮인 봉분과 붉은 룬 선돌'),
    ('ruin_city', '얼어붙은 폐허 도시', 'ruin_city', (4, 3), '눈에 묻힌 지붕·부서진 돌담·얼음 기둥'),
    ('shrine', '오딘 신전', 'shrine', (3, 3), '검은 목조 스타브 교회·겹 박공·용머리'),
    ('landmark_nature', '세계수', 'landmark_nature', (3, 3), '눈 덮인 거대 물푸레나무'),
    ('circle', '룬 돌원', 'circle', (2, 2), '눈 모자를 쓴 선돌 고리와 제단석'),
    ('volcano', '설산 화산', 'volcano', (2, 2), '눈 덮인 비탈과 붉은 화구'),
    ('floating', '오로라 빙산섬', 'floating', (5, 4), '오로라 아래 떠 있는 빙산섬과 롱하우스'),
]
