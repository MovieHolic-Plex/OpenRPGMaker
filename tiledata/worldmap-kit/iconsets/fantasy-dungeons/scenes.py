"""판타지 던전·신전 입구 — 판타지(기본) 세트의 확장 부분 세트. 정면 카메라용 장면.

장소마다 입구가 다르다: 불(붉은 바위·용암 빛) · 물(물줄기) · 숲(거목 뿌리) · 얼음(얼음 아치) 던전,
바람(흰 기둥·회오리) · 빛(금빛 돔) · 어둠(검은 첨탑·보라 불) 신전, 모래에 묻힌 피라미드, 봉인된 돌문,
요정의 샘, 마법사의 외딴 탑, 숲 빈터의 검 대좌.
색은 EasyRPG World.png 램프 위주. 새 색은 보라 불·분홍 꽃·빛 기둥에만 쓴다.
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
from icons_v9_lib import (STONE, WSTONE, WOOD, ROCK, RED, BLUE, SNOW, LEAF, VOLC, LAVA, WATER, SAND, GOLD, PURP, hx)  # noqa: E402
from oblique import Scene, box, Cyl, Cone  # noqa: E402

SET = dict(id='fantasy-dungeons', name='판타지 던전·신전 입구', partial=True, extends='fantasy', max_new_colors=24)

# ── 재질 ──────────────────────────────────────────────────────────────────────────────────────────
PFIRE = [hx(c) for c in ('3c1460', '6a2aa8', '9a50e0', 'c890f8', 'f0d8ff')]        # 보라 불(새 색 5)
PINK = [hx(c) for c in ('a03070', 'e070b0', 'f8b0d8')]                             # 요정 꽃(새 색 3)
BEAM = [hx(c) for c in ('b8f0f8', 'e0fcff', 'fffff0', 'ffffff')]                   # 빛 기둥(새 색 4)
ob.MAT.update({
    'redrock': [ROCK[0], RED[1], RED[2], ROCK[5], RED[3], RED[4], RED[5]],
    'brock': [STONE[1], STONE[2], STONE[3], STONE[4], STONE[5], STONE[6]],
    'ice': [SNOW[0], SNOW[1], SNOW[2], SNOW[3], SNOW[4], SNOW[5]],
    'crystal': [BLUE[1], BLUE[2], BLUE[3], BLUE[4], BLUE[5], SNOW[4]],
    'water3': [WATER[0], WATER[1], WATER[2], WATER[3], WATER[4], WATER[5]],
    'obsid': [STONE[0], STONE[1], STONE[2], STONE[3], STONE[4]],
    'purp': [PURP[1], PURP[2], PURP[3], PURP[4], STONE[6]],
    'pfire': PFIRE,
    'pink': PINK,
    'beam': BEAM,
    'marble': [WSTONE[2], WSTONE[3], WSTONE[4], WSTONE[5], SNOW[5]],
    'windc': [BLUE[3], BLUE[4], BLUE[5], SNOW[3], SNOW[5]],
    'iron': [STONE[0], STONE[1], STONE[2], STONE[3], STONE[4]],
    'blade': [STONE[4], STONE[5], STONE[6], SNOW[4], SNOW[5]],
    'moss': [LEAF[1], LEAF[2], LEAF[3], LEAF[4], LEAF[5]],
    'sun': [GOLD[1], GOLD[2], GOLD[3], GOLD[4], hx('f3aa38')],
    'wizroof': [PFIRE[0], PFIRE[1], PFIRE[2], PFIRE[3]],
})
L._reg(PFIRE, hx('3c1460'))
L._reg(PINK, hx('a03070'))
L._reg(BEAM, SNOW[1])

# ── 결·데칼 확장 ─────────────────────────────────────────────────────────────────────────────────
_tex_prev = ob._tex_delta


def _tex3(p, tag, P_, face):
    x, y, z = P_[:, 0], P_[:, 1], P_[:, 2]
    if p.tex == 'falls':        # 물줄기: 세로 줄무늬가 흐른다
        d = np.zeros(len(x), int)
        h = ob.hsh(np.floor(x), np.floor((z + np.floor(x) * 1.7) / 3), 4)
        d[h > .6] += 1
        d[h < .2] -= 1
        return d
    if p.tex == 'facet':        # 얼음 면: 비스듬한 결
        d = np.zeros(len(x), int)
        k = np.mod(np.floor(x + z * .6 + y * .3), 5)
        d[k == 0] += 1
        d[ob.hsh(x, z, 2) > .9] += 1
        return d
    return _tex_prev(p, tag, P_, face)


ob._tex_delta = _tex3
_dec_prev = ob._apply_decal
ARCH_GLOW = {'arch_lava': (LAVA[2], LAVA[4]), 'arch_water': (BLUE[1], BLUE[3]), 'arch_green': (LEAF[1], LEAF[4]),
             'arch_ice': (BLUE[1], SNOW[2]), 'arch_purple': (PFIRE[0], PFIRE[2]), 'arch_gold': (GOLD[2], GOLD[4]),
             'arch_dark': (L.OUT, STONE[1])}


def _dec3(p, dc, tag, P_, col):
    kind, spec = dc[0], dc[1]
    mode = spec[4] if len(spec) > 4 else 'dark'
    if kind not in ('front',) or not (mode in ARCH_GLOW or mode in ('sigil', 'win_purple', 'slab')):
        return _dec_prev(p, dc, tag, P_, col)
    t = np.asarray(tag, dtype=object)
    a0, a1, z0, z1 = spec[:4]
    a, z = P_[:, 0], P_[:, 2]
    face = (t == 'front')
    m = face & (a >= a0) & (a <= a1) & (z >= z0) & (z <= z1)
    if mode in ARCH_GLOW:       # 아치 입구: 깊은 어둠 + 바닥에서 올라오는 빛
        glow, glow2 = ARCH_GLOW[mode]
        cx, half = (a0 + a1) / 2, (a1 - a0) / 2
        zc = z1 - half
        inside = m & ((z <= zc) | (((a - cx) ** 2 + (z - zc) ** 2) <= half * half))
        col[inside] = np.array(L.OUT, np.uint8)
        g = inside & (z < z0 + (z1 - z0) * .45)
        col[g] = np.array(glow, np.uint8)
        g2 = inside & (z < z0 + (z1 - z0) * .2) & (np.abs(a - cx) < half * .6)
        col[g2] = np.array(glow2, np.uint8)
        rim = m & ~inside & ((((a - cx) ** 2 + (z - zc) ** 2) <= (half + 1.1) ** 2) | ((np.abs(a - cx) <= half + 1.1) & (z <= zc)))
        col[rim] = np.array(ob._darken(ob.MAT[p.mat], np.full(rim.sum(), .2), 0)) if rim.any() else col[rim]
        return col
    if mode == 'win_purple':
        col[m] = np.array(PFIRE[2], np.uint8)
        col[m & (z >= z1 - 1)] = np.array(PFIRE[0], np.uint8)
        return col
    if mode == 'slab':          # 돌문 이음매(가운데 세로줄)
        cx = (a0 + a1) / 2
        col[m & (np.abs(a - cx) < .5)] = np.array(STONE[1], np.uint8)
        return col
    # sigil: 금빛 원 문장 + 가운데 삼각
    cx, cz = (a0 + a1) / 2, (z0 + z1) / 2
    r = (a1 - a0) / 2
    d = np.sqrt((a - cx) ** 2 + (z - cz) ** 2)
    ring = face & (d <= r) & (d >= r - 1.1)
    tri = face & (z >= cz - r * .45) & (z <= cz + r * .5) & (np.abs(a - cx) <= (cz + r * .5 - z) * .62)
    col[ring | tri] = np.array(GOLD[3], np.uint8)
    col[tri & (z < cz - r * .1)] = np.array(GOLD[4], np.uint8)
    return col


ob._apply_decal = _dec3


# ── 축소: 장면 전체를 k 배(질감 px 크기는 그대로) ────────────────────────────────────────────────
def _scale_decals(decals, k):
    out = []
    for kind, spec in decals:
        spec = list(spec)
        if kind == 'side':
            spec[1:4] = [v * k for v in spec[1:4]]
        else:
            spec[0:4] = [v * k for v in spec[0:4]]
        out.append((kind, tuple(spec)))
    return tuple(out)


def scale(s, k):
    for p in s.prims:
        if isinstance(p, ob.Poly):
            p.d = p.d * k
        elif isinstance(p, E.Ellip):
            p.c, p.r = p.c * k, p.r * k
        elif isinstance(p, M.Dome):
            p.c, p.r, p.zmin = p.c * k, p.r * k, p.zmin * k
        elif isinstance(p, M.Frustum):
            p.xc, p.yc, p.r0, p.r1, p.z0, p.z1 = [v * k for v in (p.xc, p.yc, p.r0, p.r1, p.z0, p.z1)]
            p.zc = None if p.zc is None else p.zc * k
        elif isinstance(p, Cone):
            p.xc, p.yc, p.r, p.z0, p.zt = [v * k for v in (p.xc, p.yc, p.r, p.z0, p.zt)]
        elif isinstance(p, Cyl):
            p.xc, p.yc, p.r, p.z0, p.z1 = [v * k for v in (p.xc, p.yc, p.r, p.z0, p.z1)]
        p.decals = _scale_decals(p.decals, k)
    return s


# ── 부품 ──────────────────────────────────────────────────────────────────────────────────────────
def lump(s, x, y, z, rx, ry, rz, mat, tex='speck', role='wall', contour=True):
    return s.add(E.Ellip(x, y, z, rx, ry, rz, mat=mat, tex=tex, role=role, contour=contour))


def flame(s, x, y, z, h=3.2, r=1.3, mat='ember'):
    """불꽃: 둥근 밑 + 뾰족한 끝. 그림자를 안 던진다."""
    s.add(E.Ellip(x, y, z + r * .7, r, r, r * .9, mat=mat, tex='plain', role='nocast'))
    s.add(Cone(x, y, r * .85, z + r * .7, z + h, mat=mat, tex='plain', role='nocast'))


def brazier(s, x, y, h=3.0, mat='basalt', fire='ember'):
    s.add(Cyl(x, y, .7, 0, h, mat=mat, tex='plain', role='misc', contour=True))
    s.add(Cyl(x, y, 1.5, h, h + 1.0, mat=mat, tex='plain', role='misc', contour=True))
    flame(s, x, y, h + .8, 3.0, 1.2, fire)


def round_tree(s, x, y, r=4.2, trunk=3.0):
    s.add(Cyl(x, y, .9, 0, trunk + r * .4, mat='bark', tex='plain', role='misc'))
    lump(s, x, y, trunk + r, r, r * .85, r * .9, 'leaf2', role='roof')


def link_chain(s, p0, p1, n, y):
    """정면(x-z 평면)에 놓인 쇠사슬: 고리 n 개를 번갈아 넓게·좁게."""
    (x0, z0), (x1, z1) = p0, p1
    ang = math.atan2(z1 - z0, x1 - x0)
    R = M.rot_y(-ang)
    for i in range(n):
        f = (i + .5) / n
        cx, cz = x0 + (x1 - x0) * f, z0 + (z1 - z0) * f
        wide = i % 2 == 0
        size = (2.0, .7, 1.3) if wide else (1.6, .9, .7)
        s.add(M.obox((cx, y, cz), size, R, mat='iron', tex='plain', role='misc', contour=True))


def cave_mound(s, mat, cx=16, top=10.5, tex='speck'):
    """동굴 언덕: 큰 덩이 + 좌우 작은 덩이."""
    lump(s, cx, 10, 5.5, 14, 6.5, top, mat, tex)
    lump(s, cx - 10, 7.5, 3.5, 5.5, 4.5, 6.2, mat, tex)
    lump(s, cx + 10, 7.5, 3.5, 5.5, 4.5, 6.8, mat, tex)


# ═══════════════════════════════════════════ 던전 입구 (cave 2x2) ═══════════════════════════════════
def cave_fire():
    """불의 던전: 붉은 바위 언덕 + 뿔 바위 + 현무암 문틀, 입구 안에서 용암 빛, 앞으로 흘러나온 용암·화로 둘."""
    s = Scene()
    cave_mound(s, 'redrock', top=9.5)
    for (x, y, r, z0, zt) in ((7, 9, 2.6, 5, 14.5), (24.5, 10, 2.8, 6, 16), (15.5, 12, 2.4, 11, 19.5)):
        s.add(Cone(x, y, r, z0, zt, mat='redrock', tex='speck', role='wall', contour=True))
    s.box(9.5, 22.5, 1.4, 4.4, 0, 10.5, mat='basalt', tex='brick', role='house', contour=True,
          decals=(('front', (12, 20, 0, 8.6, 'arch_lava')),))
    s.box(8.8, 23.2, 1.0, 4.6, 10.5, 12, mat='basalt', tex='plain', role='misc', contour=True)
    s.add(box(14.4, 17.6, -2.6, 1.6, 0, .5, mat='ember', tex='plain', role='nocast'))
    s.add(E.Ellip(16, -2.6, .1, 3.6, 1.5, .6, mat='ember', tex='plain', role='nocast'))
    brazier(s, 6.2, 1.5, 2.4)
    brazier(s, 25.8, 1.5, 2.4)
    return scale(s, 0.86)


def cave_water():
    """물의 던전: 푸른 바위 언덕(이끼 머리) + 오른쪽 물줄기, 입구 아래로 물이 흘러나와 작은 못."""
    s = Scene()
    cave_mound(s, 'brock', top=10)
    lump(s, 13, 9, 15, 7, 4, 2.4, 'moss', role='roof')
    lump(s, 22, 9.5, 13.5, 4, 3, 2.0, 'moss', role='roof')
    s.box(7.5, 18.5, 1.4, 4.4, 0, 10, mat='stone', tex='brick', role='house', contour=True,
          decals=(('front', (10, 16, 0, 8, 'arch_water')),))
    s.box(6.8, 19.2, 1.0, 4.6, 10, 11.5, mat='stone', tex='plain', role='misc', contour=True)
    s.add(box(21.5, 25.5, 1.8, 3.4, 1.0, 16.5, mat='water3', tex='falls', role='nocast'))
    s.add(E.Ellip(19, -1.4, 0, 10.5, 3.2, .9, mat='water3', tex='speck', role='nocast'))
    for (x, z) in ((21, .9), (26, 1.1), (23.5, 1.6)):
        s.add(E.Ellip(x, 1.0, z, 1.4, 1.0, 1.0, mat='cloud', tex='plain', role='nocast'))
    return scale(s, 0.88)


def cave_forest():
    """숲의 던전: 거목 밑동이 갈라진 뿌리 사이 어두운 입구(초록 빛), 위로 둥근 수관."""
    s = Scene()
    lump(s, 16, 9, 7, 8, 5.5, 10, 'bark')
    for (cx, cz, ang, ln) in ((7.5, 2.0, .55, 10), (24.5, 2.0, -.55, 10), (4, .9, .2, 7), (28, .9, -.2, 7)):
        s.add(M.obox((cx, 6, cz), (ln, 3.2, 2.6), M.rot_y(ang), mat='bark', tex='speck', role='wall', contour=True))
    s.add(M.obox((11.5, 3.2, 3.6), (3, 2.8, 8), M.rot_y(.18), mat='bark', tex='speck', role='wall', contour=True))
    s.add(M.obox((20.5, 3.2, 3.6), (3, 2.8, 8), M.rot_y(-.18), mat='bark', tex='speck', role='wall', contour=True))
    s.box(12.4, 19.6, 3.6, 5.6, 0, 9, mat='bark', tex='plain', role='house', contour=False,
          decals=(('front', (13, 19, 0, 7.6, 'arch_green')),))
    lump(s, 16, 10, 17, 12.5, 7, 5.2, 'leaf2', role='roof')
    lump(s, 7, 9, 15, 5.5, 4.5, 4, 'leaf2', role='roof')
    lump(s, 25, 9, 15, 5.5, 4.5, 4, 'leaf2', role='roof')
    lump(s, 12, 4.5, 9.5, 2.4, 1.6, 1.3, 'moss', role='misc', contour=False)
    lump(s, 21, 4.5, 8.5, 2.0, 1.6, 1.2, 'moss', role='misc', contour=False)
    for x in (10.5, 21.2):
        s.add(box(x, x + .8, 3.0, 3.6, 7.5, 13, mat='moss', tex='plain', role='nocast'))
    return scale(s, 0.8)


def cave_ice():
    """얼음 던전: 눈 언덕에 얼음 벽돌 아치, 아치 끝 고드름, 둘레에 푸른 수정 기둥."""
    s = Scene()
    cave_mound(s, 'ice', top=9.5, tex='facet')
    s.box(9.5, 22.5, 1.4, 4.4, 0, 10.5, mat='crystal', tex='brick', role='house', contour=True,
          decals=(('front', (12, 20, 0, 8.6, 'arch_ice')),))
    s.box(8.8, 23.2, 1.0, 4.6, 10.5, 12, mat='ice', tex='plain', role='misc', contour=True)
    for x in (10, 12.6, 19.4, 22):
        s.add(E.InvCone(x, 1.2, .8, 8.2, 10.5, mat='crystal', tex='plain', role='nocast'))
    for (x, y, r, z0, zt) in ((3.5, 3, 2.2, 0, 15), (7.5, .6, 1.3, 0, 5), (28.5, 3.2, 2.4, 0, 17), (24.6, .4, 1.3, 0, 5.5),
                              (16, 12, 2.2, 10, 19), (10, 10, 1.8, 7, 14.5)):
        s.add(E.oct_pyr(x, y, r, z0, zt, rot=22.5, mat='crystal', tex='facet', role='misc', contour=True))
    return scale(s, 0.88)


# ═══════════════════════════════════════════ 신전 (shrine 3x3) ═════════════════════════════════════
def stairs(s, x0, x1, y_front, z_top, n, mat='marble', run=1.4):
    """앞으로 내려오는 계단(가운데 띠). 맨 위 단이 z_top."""
    for i in range(n):
        z = z_top * (i + 1) / n
        s.box(x0, x1, y_front + (n - 1 - i) * 0 - (n - i) * run, y_front + .3, 0, z, mat=mat, tex='plain', role='misc', contour=True)


def shrine_wind():
    """바람의 신전: 흰 3단 기단과 높은 계단, 위에 흰 기둥 회랑·박공, 지붕 위 회오리 장식."""
    s = Scene()
    s.box(5, 43, 8, 22, 0, 4, mat='marble', tex='brick', role='wall', contour=True)
    s.box(9, 39, 10, 21, 4, 8, mat='marble', tex='brick', role='wall', contour=True)
    s.box(13, 35, 12, 20, 8, 12, mat='marble', tex='brick', role='wall', contour=True)
    for i in range(6):
        z = 2 * (i + 1)
        s.box(20, 28, 8 - (6 - i) * 1.25 + 2.4, 12.2, 0, z, mat='marble', tex='plain', role='misc', contour=True)
    z0 = 12
    s.box(15, 33, 14.5, 19, z0, z0 + 8, mat='brock', tex='brick', role='house', contour=True,
          decals=(('front', (22, 26, z0, z0 + 6, 'arch_dark')),))
    for i in range(5):
        x = 15.2 + i * 4.4
        s.add(Cyl(x, 12.6, 1.15, z0, z0 + 8, mat='marble', tex='plain', role='misc', contour=True))
    s.box(13.6, 34.4, 11.4, 19.6, z0 + 8, z0 + 9.4, mat='marble', tex='plain', role='misc', contour=True)
    s.add(ob.gable(13.6, 34.4, 11.4, 19.6, z0 + 9.4, 1.1, mat='windc', tex='shingle', role='roof', contour=True))
    # 회오리: 마루 위로 감아 오르는 구름 덩이
    for k in range(9):
        th = k * .9
        r = 1.6 + k * .55
        s.add(E.Ellip(24 + r * math.cos(th), 15.5 + r * .4 * math.sin(th), z0 + 15 + k * .95, 1.4 + k * .1, 1.1, .9,
                      mat='windc', tex='plain', role='nocast', contour=True))
    for x in (6.5, 41.5):
        s.add(Cyl(x, 9.5, .9, 4, 12.5, mat='marble', tex='plain', role='misc', contour=True))
        s.add(box(x + .8, x + 4, 9.2, 9.8, 9.5, 12, mat='windc', tex='plain', role='misc'))
    return s


def shrine_light():
    """빛의 신전: 넓은 흰 계단 위 흰 원통 몸체와 앞 기둥 회랑, 금빛 돔과 첨탑."""
    s = Scene()
    s.box(4, 44, 6, 22, 0, 3, mat='white', tex='brick', role='wall', contour=True)
    s.box(8, 40, 8, 21, 3, 6, mat='white', tex='brick', role='wall', contour=True)
    for i in range(4):
        z = 1.5 * (i + 1)
        s.box(15, 33, 8 - (4 - i) * 1.5 + 1.5, 9, 0, z, mat='marble', tex='plain', role='misc', contour=True)
    dec = tuple(('side', (-90 + a, 1.0, 9, 13.5, 'lit')) for a in (-40, 40))
    s.add(Cyl(24, 15, 9.5, 6, 17, mat='white', tex='plain', role='house', contour=True, decals=dec))
    s.add(Cyl(24, 15, 10.2, 17, 18.3, mat='sun', tex='plain', role='misc', contour=True))
    d = M.Dome(24, 15, 18.3, 8.6, mat='sun', role='roof', contour=True)
    d.post = M.dome_ribs(10, mat='sun')(d)
    s.add(d)
    s.add(Cyl(24, 15, 1.4, 26.4, 28.6, mat='white', tex='plain', role='misc', contour=True))
    s.add(Cone(24, 15, 1.7, 28.6, 33.5, mat='sun', tex='plain', role='roof', contour=True))
    s.box(16, 32, 7.4, 10.5, 6, 15, mat='white', tex='plain', role='house', contour=True,
          decals=(('front', (21.5, 26.5, 6, 13, 'arch_gold')),))
    for x in (16.2, 19.6, 28.4, 31.8):
        s.add(Cyl(x, 7.6, .9, 6, 15, mat='marble', tex='plain', role='misc', contour=True))
    s.box(15.2, 32.8, 6.6, 11, 15, 16.4, mat='white', tex='plain', role='misc', contour=True)
    s.add(ob.gable(15.2, 32.8, 6.6, 11, 16.4, .7, mat='sun', tex='plain', role='roof', contour=True))
    for x in (7, 41):
        s.add(Cyl(x, 7, 1.0, 3, 9, mat='white', tex='plain', role='misc', contour=True))
        s.add(E.Ellip(x, 7, 10.2, 1.5, 1.5, 1.4, mat='sun', tex='plain', role='misc', contour=True))
    return s


def shrine_dark():
    """어둠의 신전: 검은 기단 위 첨탑 셋(가운데가 높다), 보라로 빛나는 창과 입구, 앞에 보라 불 화로."""
    s = Scene()
    s.box(5, 43, 7, 20, 0, 3, mat='obsid', tex='brick', role='wall', contour=True)
    for i in range(3):
        z = (i + 1)
        s.box(19, 29, 7 - (3 - i) * 1.4 + 1.4, 8, 0, z, mat='obsid', tex='plain', role='misc', contour=True)
    s.box(15, 33, 10, 17, 3, 17, mat='obsid', tex='brick', role='house', contour=True,
          decals=(('front', (20.5, 27.5, 3, 12.5, 'arch_purple')),
                  ('front', (16.6, 18.4, 9, 13, 'win_purple')), ('front', (29.6, 31.4, 9, 13, 'win_purple'))))
    s.add(E.oct_pyr(24, 13.5, 5.2, 17, 35, mat='obsid', tex='brick', role='nocast', contour=True))
    for x in (11, 37):
        s.box(x - 3.2, x + 3.2, 9, 15, 3, 14, mat='obsid', tex='brick', role='tower', contour=True,
              decals=(('front', (x - .9, x + .9, 7, 11, 'win_purple')),))
        s.add(E.oct_pyr(x, 12, 3.6, 14, 27, mat='obsid', tex='brick', role='nocast', contour=True))
        flame(s, x, 12, 26.6, 3.4, .9, 'pfire')
    flame(s, 24, 13.5, 34.6, 3.6, 1.0, 'pfire')
    brazier(s, 16.5, 4.5, 3.2, mat='obsid', fire='pfire')
    brazier(s, 31.5, 4.5, 3.2, mat='obsid', fire='pfire')
    return scale(s, 0.92)


# ═══════════════════════════════════════════ 폐허 (ruin 2x2) ════════════════════════════════════
def ruin_desert():
    """사막 신전 입구: 모래 언덕에 반쯤 묻힌 뾰족 피라미드(금 머릿돌), 앞에 돌출한 어두운 입구."""
    s = Scene()
    s.add(ob.hip(3, 27, 5, 19, 0, 2.1, mat='sand', tex='strata', role='wall', contour=True))
    s.add(ob.hip(12.2, 17.8, 9.2, 14.8, 9.2, 2.1, mat='goldroof', tex='plain', role='roof', contour=True))
    s.box(11.5, 18.5, 2.6, 7, 0, 6.6, mat='sand', tex='strata', role='house', contour=True,
          decals=(('front', (13.4, 16.6, 0, 5.0, 'dark')),))
    s.box(11, 19, 2.2, 7, 6.6, 7.8, mat='wstone', tex='plain', role='misc', contour=True)
    lump(s, 4, 4, 0, 7, 4.5, 2.6, 'sand', role='misc')
    lump(s, 25, 4, 0, 6.5, 4.5, 3.2, 'sand', role='misc')
    lump(s, 15, 1.8, 0, 6, 1.8, 1.3, 'sand', role='misc')
    s.add(M.obox((23.5, 1, 1.0), (3.2, 2.0, 2.0), M.rot_y(.35), mat='wstone', tex='plain', role='misc', contour=True))
    return scale(s, .84)


def ruin_seal():
    """봉인된 문: 바위 절벽에 박힌 돌 문틀, 금빛 문장이 새겨진 돌문을 쇠사슬 두 줄이 X 로 묶는다."""
    s = Scene()
    lump(s, 16, 11, 5, 15, 5.5, 12, 'brock')
    lump(s, 9, 11, 15, 5, 3, 2, 'moss', role='roof')
    s.box(6.5, 25.5, 2.4, 6, 0, 15, mat='wstone', tex='brick', role='house', contour=True)
    s.box(5.8, 26.2, 2.0, 6, 15, 16.8, mat='wstone', tex='plain', role='misc', contour=True)
    s.box(9.5, 22.5, 1.6, 2.6, 0, 13, mat='stone', tex='plain', role='gate', contour=True,
          decals=(('front', (9.5, 22.5, 0, 13, 'slab')), ('front', (12.5, 19.5, 3.5, 10.5, 'sigil'))))
    link_chain(s, (8.2, 13.6), (23.8, .6), 9, .9)
    link_chain(s, (23.8, 13.6), (8.2, .6), 9, .7)
    s.box(14.6, 17.4, .2, 1.0, 5.6, 8.4, mat='goldroof', tex='plain', role='misc', contour=True)
    for i in range(2):
        s.box(8 - i, 24 + i, -1.4 - i * 1.4, 1.6, 0, 1.2 * (2 - i), mat='wstone', tex='plain', role='misc', contour=True)
    return scale(s, 0.88)


# ═══════════════════════════════════════════ 원형 성소 (circle 2x2) ══════════════════════════════════
def circle_fairy():
    """요정의 샘: 둥근 돌테 안의 맑은 못, 가운데서 솟는 빛 기둥과 반짝이, 둘레의 분홍·노랑 꽃."""
    s = Scene()
    s.add(Cyl(16, 7, 12, 0, 1.4, mat='marble', tex='brick', role='misc', contour=True))
    s.add(Cyl(16, 7, 10.4, 1.39, 1.45, mat='water3', tex='speck', role='misc'))
    s.add(Cyl(16, 7, 2.6, 1.4, 21, mat='beam', tex='plain', role='nocast'))
    s.add(Cyl(16, 7, 4.2, 1.45, 2.0, mat='beam', tex='plain', role='nocast'))
    for (x, y, z) in ((10.5, 6, 9), (21.5, 7, 12), (12, 7, 17), (20, 6, 17.5), (9, 8, 14.5), (23, 8, 6.5)):
        s.add(E.Ellip(x, y, z, .8, .8, .8, mat='beam', tex='plain', role='nocast'))
    rng = np.random.RandomState(7)
    for k in range(14):
        th = 2 * math.pi * k / 14 + .2
        x, y = 16 + 13.4 * math.cos(th), 7 + 9.4 * math.sin(th)
        if y > 12:
            continue
        mat = ('pink', 'sun', 'pink', 'marble')[k % 4]
        s.add(E.Ellip(x, y, .9, 1.4, 1.2, 1.0, mat='leaf2', tex='plain', role='misc', contour=True))
        s.add(E.Ellip(x + rng.uniform(-.4, .4), y - .4, 2.0, .9, .8, .7, mat=mat, tex='plain', role='misc'))
    return scale(s, 0.95)


def circle_sword():
    """마스터 검의 대좌: 숲 빈터(뒤 좌우 나무·덤불)에 둥근 돌 단, 문장 새긴 대좌에 꽂힌 푸른 손잡이 검."""
    s = Scene()
    round_tree(s, 5.5, 12, 4.6, 3)
    round_tree(s, 26.5, 12.5, 4.8, 3.5)
    lump(s, 3.5, 4, 1.5, 3, 2.4, 2.2, 'leaf2', role='misc')
    lump(s, 28.5, 4.5, 1.6, 3.2, 2.4, 2.4, 'leaf2', role='misc')
    s.add(Cyl(16, 6, 8.5, 0, 1.2, mat='wstone', tex='brick', role='misc', contour=True))
    s.box(11.5, 20.5, 3, 9, 1.2, 3.2, mat='stone', tex='brick', role='misc', contour=True)
    s.box(12.8, 19.2, 4, 8.4, 3.2, 5.6, mat='stone', tex='plain', role='house', contour=True,
          decals=(('front', (14.4, 17.6, 3.6, 5.4, 'gold')),))
    s.add(box(15.4, 16.6, 5.9, 6.7, 5.6, 14.5, mat='blade', tex='plain', role='misc', contour=True))
    s.add(box(12.6, 19.4, 5.6, 7.0, 14.5, 15.8, mat='cblue', tex='plain', role='misc', contour=True))
    s.add(box(15.3, 16.7, 5.8, 6.8, 15.8, 18.6, mat='purp', tex='plain', role='misc', contour=True))
    s.add(E.Ellip(16, 6.3, 19.2, .9, .7, .8, mat='sun', tex='plain', role='misc', contour=True))
    for (x, z) in ((12.2, 12), (20, 10), (13.6, 18), (18.8, 16.5)):
        s.add(E.Ellip(x, 5, z, .6, .6, .6, mat='beam', tex='plain', role='nocast'))
    return scale(s, 0.86)


# ═══════════════════════════════════════════ 작은 탑 (tower_small 1x2) ══════════════════════════════
def tower_wizard():
    """마법사의 외딴 탑: 바위 위 돌 원통 탑(불 켜진 창), 위층 난간, 보라 고깔 지붕 끝 금별."""
    s = Scene()
    lump(s, 8, 5, .5, 5.6, 3.8, 2.0, 'brock', role='misc')
    dec = tuple(('side', (-90 + a, .8, z, z + 2.2, 'lit')) for a, z in ((0, 4.5), (-25, 9.5)))
    s.add(Cyl(8, 5, 4.2, 0, 5, mat='stone', tex='brick', role='tower', contour=True,
              decals=(('side', (-90, 1.2, 0, 3, 'dark')),)))
    s.add(Cyl(8, 5, 4.2, 4.99, 14.5, mat='stone', tex='brick', role='nocast', contour=True, decals=dec))
    s.add(Cyl(8, 5, 5.2, 14.5, 15.6, mat='wood', tex='plain', role='nocast', contour=True))
    s.add(Cyl(8, 5, 3.8, 15.6, 17.6, mat='stone', tex='brick', role='nocast', contour=True,
              decals=(('side', (-90, .8, 15.9, 17.4, 'lit')),)))
    s.add(Cone(8, 5, 5.8, 17.6, 26.0, mat='wizroof', tex='shingle', role='nocast', contour=True))
    s.add(E.Ellip(8, 5, 26.6, .9, .9, .9, mat='sun', tex='plain', role='nocast', contour=True))
    return scale(s, 0.92)


ORDER = [
    ('cave', '불의 던전', 'cave_fire', (2, 2), '붉은 바위 언덕·뿔 바위, 현무암 문틀 안에서 용암 빛, 흘러나온 용암과 화로 둘'),
    ('cave', '물의 던전', 'cave_water', (2, 2), '이끼 낀 푸른 바위의 석문 입구, 옆으로 떨어지는 물줄기와 앞 못'),
    ('cave', '숲의 던전', 'cave_forest', (2, 2), '거목 밑동 뿌리 사이 어두운 입구(초록 빛)와 둥근 수관'),
    ('cave', '얼음 던전', 'cave_ice', (2, 2), '눈 언덕의 얼음 벽돌 아치·고드름, 둘레 푸른 수정 기둥'),
    ('shrine', '바람의 신전', 'shrine_wind', (3, 3), '흰 3단 기단·높은 계단, 흰 기둥 회랑과 박공 위 회오리'),
    ('shrine', '빛의 신전', 'shrine_light', (3, 3), '흰 계단 위 흰 원통 몸체·기둥 회랑, 금빛 돔과 첨탑'),
    ('shrine', '어둠의 신전', 'shrine_dark', (3, 3), '검은 기단 위 첨탑 셋, 보라 빛 창·입구와 보라 불'),
    ('ruin', '사막 신전 입구', 'ruin_desert', (2, 2), '모래에 반쯤 묻힌 금 머릿돌 피라미드와 앞 입구'),
    ('ruin', '봉인된 문', 'ruin_seal', (2, 2), '절벽의 돌문에 금빛 문장, 쇠사슬 X 와 자물쇠'),
    ('circle', '요정의 샘', 'circle_fairy', (2, 2), '돌테 안 못에서 솟는 빛 기둥·반짝이, 둘레 꽃'),
    ('tower_small', '마법사의 외딴 탑', 'tower_wizard', (1, 2), '바위 위 돌 원통 탑, 난간, 보라 고깔 지붕과 금별'),
    ('circle', '마스터 검의 대좌', 'circle_sword', (2, 2), '숲 빈터의 둥근 돌 단, 대좌에 꽂힌 푸른 손잡이 검'),
]
