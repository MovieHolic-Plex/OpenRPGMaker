"""선사·원시(크로노 트리거 원시 시대풍) 월드맵 아이콘 — 정면 카메라용 3D 장면.
움집(흙벽 + 짚·가죽 원뿔 지붕)·매머드 뼈·공룡 뼈대·거대 고사리·바위·화산. 흙·뼈·짐승 가죽 색.
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
from icons_v9_lib import WSTONE, ROCK, GREY, LEAF, LAVA, VOLC, WATER, WOOD, hx  # noqa: E402
from oblique import Scene, box, Cyl, Cone  # noqa: E402

SET = dict(id='prehistoric', name='선사·원시')

# ── 재질(전부 World.png 색 — 새 색 0 을 목표로) ──────────────────────────────────────────
ob.MAT.update({
    'bone': [WSTONE[1], WSTONE[2], WSTONE[3], WSTONE[4], WSTONE[5]],
    'hide': [ROCK[3], ROCK[5], ROCK[6], ROCK[7], ROCK[8], ROCK[9]],
    'mud': [ROCK[1], ROCK[2], ROCK[3], ROCK[4], ROCK[5], ROCK[6]],
    'smoke': [GREY[1], GREY[2], GREY[3], GREY[4], GREY[5]],
    'fern': [LEAF[1], LEAF[2], LEAF[3], LEAF[4], LEAF[5], LEAF[6]],
    'moss': [LEAF[2], LEAF[3], LEAF[4], LEAF[5], LEAF[7]],
    'pwater': [WATER[0], WATER[1], WATER[2], WATER[3], WATER[4]],
    'fall': [WATER[2], WATER[3], WATER[4], WATER[5], WATER[5]],
    'log': [WOOD[1], WOOD[2], WOOD[3], WOOD[4], WOOD[5]],
})


_prev_tex = ob._tex_delta


def _tex_pre(p, tag, P_, face):
    x, y, z = P_[:, 0], P_[:, 1], P_[:, 2]
    if p.tex == 'straw':        # 짚 지붕: 가로 묶음 줄 + 성긴 점
        d = np.zeros(len(x), int)
        d[np.mod(z + .5 * ob.hsh(x / 2, 0, 3), 2.4) < .9] -= 1
        h = ob.hsh(x, y + z, 9)
        d[h > .9] += 1
        return d
    if p.tex == 'logs':         # 통나무 원통 결: 세로 금
        d = np.zeros(len(x), int)
        d[ob.hsh(np.floor(z / 3), np.floor(x * 1.3), 2) > .8] -= 1
        return d
    return _prev_tex(p, tag, P_, face)


ob._tex_delta = _tex_pre


def water_fn(x, y):
    w = np.array(ob.MAT['pwater'], np.uint8)
    rip = (np.mod(np.floor(y * 1.0) + np.floor(x / 5), 4) == 0) & (ob.hsh(x, y, 3) > .55)
    i = np.where(rip, 4, np.clip((2 + ob.hsh(x / 3, y, 9) * 1.4).astype(int), 0, 4))
    return w[i]


def plaza_fn(x, y):
    d = np.array(ob.MAT['dirt'], np.uint8)
    return d[np.clip((1 + ob.hsh(x, y, 5) * 2.6).astype(int), 0, 4)]


# ══════════════════════════════════════════ 부품 ══════════════════════════════════════════
def hut(s, xc, yc, r, wh=3.8, rise=None, roof='thatch', wall='mud', door=True, poles=True):
    """움집: 낮은 흙벽 원통 + 짚(또는 가죽) 원뿔 지붕 + 꼭대기에 엇갈린 장대."""
    rise = rise or r * 1.5
    dec = (('side', (-90, 1.2, 0, wh * .95, 'dark')),) if door else ()
    s.add(Cyl(xc, yc, r, 0, wh, mat=wall, tex='speck', role='house', contour=True, decals=dec))
    s.add(Cone(xc, yc, r + .7, wh, wh + rise, mat=roof, tex='straw', role='roof', contour=True))
    if poles:
        zt = wh + rise
        for dx in (-.9, .9):
            s.box(xc + dx - .35, xc + dx + .35, yc - .3, yc + .3, zt - 1.6, zt + 1.4, mat='log', tex='plain', role='misc')
    if door:   # 문 앞 짧은 처마(어두운 입구가 1배에서도 읽히게)
        s.box(xc - 1.4, xc + 1.4, yc - r - .5, yc - r + .4, 0, wh * .9, mat='mud', tex='plain', role='misc',
              decals=(('front', (xc - .9, xc + .9, 0, wh * .8, 'dark')),))


def hide_tent(s, xc, yc, r, h, mat='hide'):
    """가죽 천막(원뿔) + 위로 삐져나온 장대 셋."""
    s.add(Cone(xc, yc, r, 0, h, mat=mat, tex='straw', role='house', contour=True))
    for dx, dy in ((-.8, 0), (.8, 0), (0, .8)):
        s.box(xc + dx - .3, xc + dx + .3, yc + dy - .3, yc + dy + .3, h - 1.5, h + 2.0, mat='log', tex='plain', role='misc')
    s.box(xc - 1.0, xc + 1.0, yc - r * .55, yc - r * .55 + .4, 0, h * .42, mat='mud', tex='plain', role='misc',
          decals=(('front', (xc - 1.0, xc + 1.0, 0, h * .42, 'dark')),))


def fire(s, x, y, r=1.6, flame=3.2):
    """모닥불: 돌 고리 + 붉은 불씨 + 불꽃 두 단."""
    for k in range(7):
        th = 2 * math.pi * k / 7
        s.add(E.Ellip(x + (r + .8) * math.cos(th), y + (r + .8) * math.sin(th), .5, .9, .8, .7, mat='stone', tex='plain', role='misc'))
    s.add(Cyl(x, y, r, 0, .7, mat='ember', tex='plain', role='misc'))
    s.add(Cone(x, y, r * .9, .5, .5 + flame, mat='ember', tex='plain', role='nocast'))
    s.add(Cone(x, y, r * .45, .7, .7 + flame * .65, mat='gold', tex='plain', role='nocast'))


def tusk_arch(s, xc, y, span, h, thick=1.1, n=9, mat='bone'):
    """매머드 엄니 한 쌍이 마주 휘어 만든 아치(앞에서 보이는 반원)."""
    for side in (-1, 1):
        for i in range(n):
            t = i / (n - 1)
            ang = math.pi * .5 * t
            x = xc + side * span / 2 * math.cos(ang)
            z = h * math.sin(ang)
            w = thick * (1.25 - .5 * t)
            s.add(E.Ellip(x, y, z + w * .5, w, w * .8, w, mat=mat, tex='plain', role='misc', contour=True))


def bone_spike(s, x, y, z, h, r=.8):
    s.add(Cone(x, y, r, z, z + h, mat='bone', tex='plain', role='misc', contour=True))


def palisade(s, x0, x1, y, h, step=2.0, r=.95, gap=None):
    """말뚝 목책: 통나무 원통 + 뾰족한 끝. 정면 가로 한 줄. gap=(a,b) 는 문 자리."""
    x = x0 + r
    i = 0
    while x <= x1 - r + .01:
        if not (gap and gap[0] < x < gap[1]):
            hh = h + (.6 if i % 2 else 0)
            s.add(Cyl(x, y, r, 0, hh, mat='log', tex='plain', role='wall', contour=True))
            s.add(Cone(x, y, r, hh, hh + 1.6, mat='log', tex='plain', role='wall'))
        x += step
        i += 1


def palisade_side(s, x, y0, y1, h, step=2.0, r=.95):
    y = y0 + r
    while y <= y1 - r + .01:
        s.add(Cyl(x, y, r, 0, h, mat='log', tex='plain', role='wall', contour=True))
        s.add(Cone(x, y, r, h, h + 1.6, mat='log', tex='plain', role='wall'))
        y += step


def watchtower(s, x, y, h=12, w=4.4):
    """망대: 네 기둥 + 가죽 지붕 망루."""
    for dx in (0, w - 1):
        for dy in (0, w - 1):
            s.box(x + dx, x + dx + 1, y + dy, y + dy + 1, 0, h, mat='log', tex='plain', role='tower', contour=True)
    s.box(x - .6, x + w + .6, y - .6, y + w + .6, h, h + 1.4, mat='log', tex='plank', role='tower', contour=True)
    s.box(x - .2, x + w + .2, y - .2, y + w + .2, h + 1.4, h + 3.2, mat='log', tex='plank', role='tower', contour=True)
    s.add(Cone(x + w / 2, y + w / 2, w * .85, h + 3.2, h + 7.5, mat='hide', tex='speck', role='roof', contour=True))


def fern(s, x, y, h=10, R=6.0, n=7, z0=0.0):
    """나무고사리: 비늘 줄기 + 둘레로 늘어진 잎 덩이(별 모양) + 가운데 새순."""
    s.add(Cyl(x, y, .9, z0, z0 + h, mat='bark', tex='speck', role='misc', contour=True))
    for k in range(n):
        th = 2 * math.pi * (k + .3) / n
        for j, (f, dz, rr) in enumerate(((.38, .3, 1.9), (.72, -.9, 1.6), (1.0, -2.4, 1.2))):
            s.add(E.Ellip(x + R * f * math.cos(th), y + R * f * .75 * math.sin(th), z0 + h + dz, rr * 1.3, rr, rr * .7,
                          mat='fern', tex='speck', role='roof', contour=True))
    s.add(E.Ellip(x, y, z0 + h + .9, 1.6, 1.4, 1.2, mat='moss', tex='speck', role='roof', contour=True))


def boulder(s, x, y, z, rx, ry, rz, mat='rock'):
    s.add(E.Ellip(x, y, z, rx, ry, rz, mat=mat, tex='speck', role='misc', contour=True))


def menhir(s, x, y, w, d, h, lean=0.0, mat='greywall'):
    s.box(x, x + w, y, y + d, 0, h, mat=mat, tex='speck', role='misc', contour=True)
    s.box(x + .4, x + w - .4, y + .3, y + d - .3, h, h + .9, mat=mat, tex='plain', role='misc', contour=True)


def skull(s, x, y, z, k=1.0, mat='bone'):
    """짐승 두개골: 둥근 머리 + 어두운 눈구멍 둘 + 짧은 뿔."""
    s.add(E.Ellip(x, y, z, 2.2 * k, 1.8 * k, 1.9 * k, mat=mat, tex='plain', role='misc', contour=True))
    for dx in (-.8, .8):
        s.box(x + dx * k - .45, x + dx * k + .45, y - 1.85 * k, y - 1.6 * k, z - .1, z + .7 * k, mat='basalt', tex='plain', role='misc')
    for dx in (-1, 1):
        s.add(Cone(x + dx * 1.9 * k, y, .6 * k, z + .6 * k, z + 2.6 * k, mat=mat, tex='plain', role='misc', contour=True))


# ══════════════════════════════════════════ 장면 ══════════════════════════════════════════
def capital():
    """부족 대마을: 앞 가운데 매머드 엄니 대문, 목책 둘레, 불 광장 둘레 움집 무리, 뒤에 족장의 큰 움집."""
    s = Scene()
    Y1 = 92
    s.patch(6, 86, 4, Y1, plaza_fn, z=0, h=.4, mat='dirt')
    # 목책(앞·뒤·좌·우)
    palisade(s, 4, 88, 2, 6.0, gap=(36, 54))
    palisade(s, 4, 88, Y1, 6.0)
    palisade_side(s, 5, 4, Y1, 6.0)
    palisade_side(s, 87, 4, Y1, 6.0)
    # 뼈 대문: 엄니 아치 두 겹 + 위 두개골
    tusk_arch(s, 45, 1.5, 18, 17, thick=1.8, n=12)
    tusk_arch(s, 45, 3.8, 13, 12.5, thick=1.3, n=10)
    skull(s, 45, 1, 19.5, 1.7)
    for x in (35, 55):
        s.cyl(x, 2, 2.0, 0, 9.5, mat='bone', tex='plain', role='misc', contour=True)
        bone_spike(s, x, 2, 9.5, 4.0, 1.5)
    # 불 광장(가운데)
    fire(s, 45, 40, r=3.0, flame=7)
    for k in range(12):
        th = 2 * math.pi * k / 12
        s.add(E.Ellip(45 + 12 * math.cos(th), 40 + 9 * math.sin(th), .7, 1.5, 1.1, .9, mat='greywall', tex='plain', role='misc'))
    # 움집 무리 — 앞줄·가운데·뒷줄을 좌우로 엇갈리게
    for (x, y, r, roof) in ((14, 13, 5.0, 'thatch'), (27, 18, 4.4, 'hide'), (64, 17, 4.4, 'thatch'), (77, 12, 5.0, 'hide'),
                            (12, 34, 4.8, 'hide'), (24, 46, 4.4, 'thatch'), (68, 44, 4.6, 'hide'), (79, 32, 4.8, 'thatch'),
                            (14, 62, 4.8, 'thatch'), (30, 70, 4.6, 'hide'), (62, 70, 4.6, 'thatch'), (77, 60, 5.0, 'hide')):
        hut(s, x, y, r, rise=r * 1.6, roof=roof)
    # 족장의 큰 움집(뒤 가운데, 가죽 지붕 + 엄니 장식)
    hut(s, 46, 80, 9.0, wh=6.0, rise=14, roof='hide')
    for x in (38, 54):
        bone_spike(s, x, 71.5, 0, 8, 1.1)
    # 뒤 양옆 고사리
    fern(s, 13, 84, h=11, R=6.5)
    fern(s, 79, 84, h=12, R=6.5)
    return s


def fort_city():
    """목책 부락: 사방 말뚝 목책, 앞 문, 두 모서리 망대, 안쪽 움집 넷(엇갈림)."""
    s = Scene()
    s.patch(4, 54, 3, 56, plaza_fn, z=0, h=.4, mat='dirt')
    palisade(s, 2, 56, 1, 6.5, gap=(23.5, 34.5))
    palisade(s, 2, 56, 57, 6.5)
    palisade_side(s, 3, 1, 57, 6.5)
    palisade_side(s, 55, 1, 57, 6.5)
    # 문: 통나무 문틀
    for x in (23, 34):
        s.box(x - 1, x + 1, 0, 2.2, 0, 10, mat='log', tex='plank', role='gate', contour=True)
    s.box(21.5, 36.5, 0, 2.2, 10, 11.8, mat='log', tex='plank', role='gate', contour=True)
    skull(s, 29, -.2, 13, 1.0)
    watchtower(s, 4, 48, h=15, w=5)
    watchtower(s, 47, 3, h=12, w=5)
    hut(s, 13, 14, 5.0, rise=8)
    hut(s, 43, 22, 5.0, rise=8, roof='hide')
    hut(s, 22, 34, 5.4, rise=8.5, roof='hide')
    hut(s, 42, 44, 4.8, rise=7.5)
    hut(s, 22, 50, 4.4, rise=7)
    fire(s, 30, 21, r=1.6, flame=3.5)
    return s


def harbor_city():
    """호숫가 수상 부락: 앞은 호수, 말뚝 위 움집 셋과 잔교, 통나무 배 둘. 뒤 기슭에 움집과 고사리."""
    s = Scene()
    s.patch(1, 75, -2, 20, water_fn, z=0, h=.3, mat='pwater')
    # 뒤 기슭 마을(바위 기슭 + 움집 + 고사리)
    hut(s, 12, 32, 5.0, rise=8)
    hut(s, 56, 32, 5.0, rise=8, roof='hide')
    hut(s, 38, 52, 6.4, wh=4.4, rise=11, roof="hide")
    fern(s, 66, 44, h=12, R=5.5)
    fern(s, 22, 50, h=10, R=5)
    # 말뚝 집
    for (x, y, r) in ((13, 9, 4.6), (37, 6, 5.0), (61, 10, 4.4)):
        for dx in (-r + .5, 0, r - .5):
            s.box(x + dx - .45, x + dx + .45, y - 3.2, y - 2.4, 0, 4.5, mat='log', tex='plain', role='misc')
        s.box(x - r - 1.5, x + r + 1.5, y - 3.5, y + r + 1, 4.0, 5.2, mat='log', tex='plank', role='misc', contour=True)
        s.add(Cyl(x, y, r, 5.2, 8.2, mat='mud', tex='speck', role='house', contour=True,
                  decals=(('side', (-90, 1.2, 5.2, 7.9, 'dark')),)))
        s.add(Cone(x, y, r + 1.1, 8.2, 8.2 + r * 1.5, mat='thatch', tex='straw', role='roof', contour=True))
    # 잔교(기슭으로)
    s.box(22, 26, 8, 24, 3.6, 4.6, mat='log', tex='plank', role='misc', contour=True)
    s.box(46, 50, 10, 24, 3.6, 4.6, mat='log', tex='plank', role='misc', contour=True)
    # 통나무 배
    for (x, y, L_) in ((4, -1, 13), (47, -2, 15)):
        s.add(E.hull(x, x + L_, y, y + 3.2, 0, 2.0, rise=.9, mat='log', tex='plank', role='misc', contour=True))
        s.box(x + 3, x + L_ - 3, y + .7, y + 2.5, 1.2, 1.8, mat='wood', tex='plain', role='misc')
    s.box(51, 51.8, -1.2, -.6, 1.8, 7, mat='log', tex='plain', role='misc')   # 노·작살
    return s


def castle():
    """공룡족 둥지 요새: 바위 탑 셋 위 뼈 가시, 가운데 짚 둥지에 알, 앞 두개골 문."""
    s = Scene()
    # 바위 벽(무른 덩이)
    for (x, y, rx, ry, rz) in ((13, 12, 9, 7, 6), (33, 12, 9, 7, 6), (23, 22, 13, 7, 7)):
        boulder(s, x, y, rz * .6, rx, ry, rz, mat='rock')
    # 바위 탑
    for (x, y, r, h) in ((8.5, 9, 4.4, 20), (37.5, 9, 4.4, 18), (23, 24, 5.6, 23.5)):
        s.add(M.Frustum(x, y, r, r * .72, 0, h, mat='basalt', tex='strata', role='tower', contour=True))
        for zz in (h * .33, h * .66):
            s.add(Cyl(x, y, r * (1 - .28 * zz / h) + .5, zz, zz + 1.4, mat='bone', tex='plain', role='misc'))
        s.add(E.Ellip(x, y, h, r * .78, r * .78, 1.2, mat='basalt', tex='speck', role='tower', contour=True))
        for k in range(5):
            th = 2 * math.pi * (k + .5) / 5
            bone_spike(s, x + r * .5 * math.cos(th), y + r * .5 * math.sin(th), h, 5.0, .95)
    # 짚 둥지 + 알
    s.add(M.Frustum(23, 13, 7.5, 9.5, 7, 11, mat='thatch', tex='speck', role='misc', contour=True))
    for (x, y) in ((20.5, 12), (25.5, 12.5), (23, 15)):
        s.add(E.Ellip(x, y, 12.3, 1.7, 1.5, 2.2, mat='bone', tex='speck', role='misc', contour=True))
    # 앞 문: 큰 두개골 입구
    s.add(E.Ellip(23, 4.5, 4.5, 6.5, 3.5, 5.0, mat='bone', tex='plain', role='gate', contour=True))
    s.box(19.8, 26.2, 1.2, 1.6, 0, 4.6, mat='basalt', tex='plain', role='gate')
    for dx in (-3.3, 3.3):
        s.box(23 + dx - .9, 23 + dx + .9, 1.6, 2.0, 6.0, 7.4, mat='basalt', tex='plain', role='gate')
    for dx in (-1.6, 0, 1.6):
        bone_spike(s, 23 + dx, 1.0, 3.2, -0.01 + 1.8, .4)
    for dx in (-1, 1):
        s.add(Cone(23 + dx * 6, 4.5, 1.1, 6.5, 12.5, mat='bone', tex='plain', role='misc', contour=True))
    return s


def castle_b():
    """매머드 뼈 전당: 가죽을 덮은 큰 돔 집을 엄니 갈비가 감싸고, 앞에 매머드 두개골 문과 늘어진 엄니."""
    s = Scene()
    s.add(M.Dome(23, 17, 0, 18, zmin=0, mat='hide', tex='speck', role='house', contour=True))
    for i, y in enumerate((4, 10, 16, 22)):
        tusk_arch(s, 23, y, 38 - abs(i - 1.5) * 3.5, 20 - abs(i - 1.5) * 2.4, thick=1.35, n=11)
    s.box(22.3, 23.7, 16.3, 17.7, 15, 26, mat='log', tex='plain', role='misc')
    s.box(23.7, 29, 16.5, 17.1, 21.5, 25, mat='cloth', tex='plain', role='misc')
    s.box(18, 28, 0, 5, 0, 7.5, mat='mud', tex='speck', role='gate', contour=True,
          decals=(('front', (19.8, 26.2, 0, 6.2, 'arch')),))
    skull(s, 23, .6, 10, 2.0)
    for side in (-1, 1):
        for i in range(7):
            t = i / 6
            s.add(E.Ellip(23 + side * (4.2 + 5 * math.sin(t * 1.4)), -1.5 - t * 2.5, 8.5 - 7.5 * t + 3.5 * t * t, 1.2, 1.0, 1.2,
                          mat='bone', tex='plain', role='misc', contour=True))
    fire(s, 6, -2, r=1.3, flame=3.2)
    fire(s, 40, -2, r=1.3, flame=3.2)
    return s

def large_town():
    """움집 마을: 움집 여덟이 세 줄로 엇갈려 모이고 가운데 모닥불, 뒤 고사리 둘."""
    s = Scene()
    for (x, y, r, roof) in ((7, 3, 4.4, 'thatch'), (22, 1, 4.0, 'hide'), (38, 4, 4.4, 'thatch'),
                            (14, 16, 4.2, 'hide'), (31, 17, 4.6, 'thatch'), (5, 26, 3.8, 'thatch'),
                            (22, 30, 4.4, 'hide'), (39, 28, 3.8, 'thatch')):
        hut(s, x, y, r, rise=r * 1.6, roof=roof)
    fire(s, 23, 10, r=1.4, flame=3)
    fern(s, 12, 38, h=9, R=4.6, n=6)
    fern(s, 33, 40, h=10, R=4.6, n=6)
    return s

def village():
    """동굴 집 마을: 큰 바위 언덕에 구멍 집 셋(가죽 문발·나무 사다리), 앞 모닥불."""
    s = Scene()
    s.add(E.Ellip(15, 13, 7, 13, 8, 9.5, mat='greywall', tex='strata', role='wall', contour=True))
    s.add(E.Ellip(6.5, 9, 4, 6, 5, 6, mat='greywall', tex='strata', role='wall', contour=True))
    s.add(E.Ellip(23.5, 8, 4, 5.5, 5, 5.5, mat='greywall', tex='strata', role='wall', contour=True))
    # 구멍 집: 바위에서 튀어나온 판석 앞면 + 어두운 아치 + 가죽 문발
    for (x, y, z, w, h, cur) in ((2.8, 1.6, 0, 6.2, 6.4, True), (19.6, 1.0, 0, 6.2, 6.4, False), (12.0, 5.6, 8.6, 5.4, 5.4, True)):
        s.box(x, x + w, y, y + 5, z, z + h, mat='sand', tex='speck', role='house', contour=True,
              decals=(('front', (x + .7, x + w - .7, z, z + h - .6, 'arch')),))
        s.box(x - .4, x + w + .4, y - .3, y + 5, z + h - .3, z + h + .8, mat='log', tex='plain', role='misc', contour=True)
        if cur:
            s.box(x + 3.4, x + w - .7, y - .3, y, z + 1.0, z + h - 1.6, mat='hide', tex='plain', role='misc')
    for dx in (11.0, 14.0):
        s.box(dx, dx + .6, 1.6, 2.2, 0, 9.4, mat='log', tex='plain', role='misc', contour=True)
    for z in (1.8, 4.2, 6.6, 8.8):
        s.box(11.0, 14.6, 1.6, 2.0, z, z + .6, mat='log', tex='plain', role='misc')
    fire(s, 26.5, -2, r=1.0, flame=2.4)
    return s

def village_b():
    """나무 위 부락: 거목 두 그루, 줄기 앞 판자 마루 위 움집, 줄사다리, 두 마루 사이 밧줄 다리."""
    s = Scene()
    for (x, y, h, hr, roof) in ((8.5, 7, 6, 3.2, 'thatch'), (20.5, 9, 8.5, 3.0, 'hide')):
        s.cyl(x, y + 1.5, 1.6, 0, h + 7.5, mat='bark', tex='speck', role='wall', contour=True)
        s.add(E.Ellip(x, y + 3, h + 9.6, 5.0, 3.6, 2.7, mat='leaf2', tex='speck', role='roof', contour=True))
        s.box(x - 4.4, x + 4.4, y - 3.5, y + 2, h, h + 1.2, mat='log', tex='plank', role='misc', contour=True)
        for dx in (-3.9, 3.3):
            s.box(x + dx, x + dx + .6, y - 3.2, y - 2.6, 0, h, mat='log', tex='plain', role='misc')
        s.add(Cyl(x, y - .5, hr, h + 1.2, h + 3.6, mat='mud', tex='speck', role='house', contour=True,
                  decals=(('side', (-90, 1.0, h + 1.2, h + 3.4, 'dark')),)))
        s.add(Cone(x, y - .5, hr + .7, h + 3.6, h + 4.0 + hr * 1.2, mat=roof, tex='straw', role='roof', contour=True))
    for z in np.arange(1.5, 7.5, 2.0):          # 줄사다리
        s.box(17.6, 19.6, 5.0, 5.4, z, z + .5, mat='hide', tex='plain', role='misc')
    for dx in (17.6, 19.1):
        s.box(dx, dx + .5, 5.0, 5.4, 0, 9, mat='hide', tex='plain', role='misc')
    s.box(12.9, 16.1, 6.0, 6.6, 7.6, 8.2, mat='log', tex='plain', role='misc')
    return s

def camp():
    """사냥 야영: 가죽 천막 둘, 모닥불 위 고기 꼬치, 세워 둔 창."""
    s = Scene()
    hide_tent(s, 8.5, 9, 5.8, 13)
    hide_tent(s, 21, 12, 4.6, 10.5, mat='felt')
    fire(s, 17, 0, r=1.3, flame=2.4)
    for x in (14.6, 19.4):
        s.box(x - .3, x + .3, -.3, .3, 0, 4.6, mat='log', tex='plain', role='misc')
    s.box(14, 20, -.3, .3, 4.0, 4.6, mat='log', tex='plain', role='misc')
    s.add(E.Ellip(17, 0, 3.6, 1.5, .8, .9, mat='redwall', tex='plain', role='misc', contour=True))
    for x in (25.5, 27):
        s.box(x, x + .5, 2, 2.5, 0, 11, mat='log', tex='plain', role='misc')
        s.add(Cone(x + .25, 2.25, .7, 11, 13.5, mat='greywall', tex='plain', role='misc'))
    s.add(E.Ellip(4, 0, 1, 2.0, 1.4, 1.1, mat='hide', tex='speck', role='misc', contour=True))
    return s


def tower_small():
    """토템 기둥: 얼굴 새긴 통나무 셋을 쌓고 날개 판과 뿔 달린 두개골."""
    s = Scene()
    x, y = 5.5, 3
    z = 0
    for i, (r, h, mat) in enumerate(((2.3, 5.5, 'log'), (2.1, 5.0, 'redwall'), (2.0, 4.6, 'log'))):
        s.add(Cyl(x, y, r, z, z + h, mat=mat, tex='plain', role='tower', contour=True,
                  decals=(('side', (-110, .7, z + h * .55, z + h * .78, 'dark')), ('side', (-70, .7, z + h * .55, z + h * .78, 'dark')),
                          ('side', (-90, 1.2, z + h * .18, z + h * .35, 'dark')))))
        z += h
        s.add(Cyl(x, y, r + .3, z - .7, z, mat='bone', tex='plain', role='misc'))
    s.box(x - 4.2, x + 4.2, y - .5, y + .5, z - 4.0, z - 2.2, mat='redwall', tex='plain', role='misc', contour=True)
    s.box(x - 3.5, x + 3.5, y - .6, y + .4, z - 2.2, z - 1.4, mat='gold', tex='plain', role='misc')
    skull(s, x, y, z + 1.5, .85)
    return s


def tower_great():
    """거대 바위 기둥: 층층이 쌓인 사암 기둥, 허리 둘레 고사리, 꼭대기에 움집과 사다리."""
    s = Scene()
    xc, yc = 11.5, 6
    s.add(E.Ellip(xc, yc, 1.5, 8.2, 5.5, 3.0, mat='rock', tex='speck', role='wall', contour=True))
    z = 0
    for (r0, r1, h, mt) in ((7.6, 6.6, 11, 'rock'), (6.2, 5.6, 10, 'sand'), (5.8, 6.6, 8, 'rock'), (6.8, 5.6, 7, 'sand')):
        s.add(M.Frustum(xc, yc, r0, r1, z, z + h, mat=mt, tex='strata', role='tower', contour=True))
        z += h
        s.add(E.Ellip(xc + .5, yc, z, r1 + .6, r1 * .8, 1.3, mat='mud', tex='speck', role='tower', contour=True))
    for (dx, zz) in ((-6.2, 12), (6.0, 23)):
        s.add(E.Ellip(xc + dx, yc - 3, zz, 2.6, 2.0, 1.6, mat='fern', tex='speck', role='misc', contour=True))
    s.add(E.Ellip(xc - 2, yc - 3, z + 1, 3.4, 2.4, 1.6, mat='moss', tex='speck', role='misc', contour=True))
    hut(s, xc + 1, yc + 1, 3.4, wh=2.4, rise=5.0, poles=True)
    for dx in (2.6, 5.0):
        s.box(xc + dx, xc + dx + .5, yc - 6.0, yc - 5.5, 17, z + .5, mat='log', tex='plain', role='misc')
    for zz in np.arange(18, z, 2.4):
        s.box(xc + 2.6, xc + 5.5, yc - 6.0, yc - 5.6, zz, zz + .5, mat='log', tex='plain', role='misc')
    return s


def cave():
    """벽화 동굴: 바위 언덕에 큰 어두운 입구, 입구 양옆 붉은 손자국·짐승 그림, 앞 횃불."""
    s = Scene()
    s.add(E.Ellip(15, 11, 7, 13, 8, 10, mat='rock', tex='strata', role='wall', contour=True))
    s.add(E.Ellip(6, 7, 4, 4.5, 4.5, 5, mat='rock', tex='strata', role='wall', contour=True))
    s.add(E.Ellip(24, 7, 4, 4.5, 4.5, 5, mat='rock', tex='strata', role='wall', contour=True))
    s.box(5.5, 26.5, 3.0, 4.5, 0, 9.5, mat='sand', tex='plain', role='house',
          decals=(('front', (11.5, 20.5, 0, 8.6, 'arch')),
                  ('front', (7.0, 8.4, 5.8, 7.4, 'red')), ('front', (9.0, 9.8, 3.8, 5.6, 'red')),
                  ('front', (6.6, 10.0, 2.0, 2.8, 'red')),
                  ('front', (22.0, 25.4, 5.0, 6.0, 'red')), ('front', (22.6, 23.4, 3.4, 5.0, 'red')),
                  ('front', (24.2, 25.0, 3.4, 5.0, 'red')), ('front', (23.0, 24.4, 7.0, 8.2, 'gold'))))
    for x in (10.2, 21.8):
        s.box(x - .35, x + .35, 2.0, 2.6, 0, 5.4, mat='log', tex='plain', role='misc')
        s.add(Cone(x, 2.3, .8, 5.4, 7.2, mat='ember', tex='plain', role='nocast'))
    return s


def ruin():
    """공룡 화석: 반쯤 묻힌 거대한 뼈대 — 등뼈 곡선, 갈비 아치, 큰 두개골."""
    s = Scene()
    # 묻힌 흙 둔덕
    s.add(E.Ellip(16.5, 8, 0, 12.5, 6.5, 2.0, mat='mud', tex='speck', role='misc', contour=True))
    # 등뼈(왼쪽 머리 → 오른쪽 꼬리)
    pts = [(9 + i * 1.65, 8 + 9 * math.sin(math.pi * min(1, (i + 1) / 9)) - (i > 8) * (i - 8) * 1.4) for i in range(13)]
    for (x, z) in pts:
        s.add(E.Ellip(x, 8, z, 1.0, 1.0, .9, mat='bone', tex='plain', role='misc', contour=True))
        s.box(x - .3, x + .3, 7.7, 8.3, z, z + 1.6, mat='bone', tex='plain', role='misc')
    # 갈비(앞에서 보이는 휜 막대) — 등뼈에서 땅으로
    for i in range(2, 8):
        x, z = pts[i]
        for k in range(5):
            t = k / 4
            s.add(E.Ellip(x + 1.2 * math.sin(t * 2.4), 8 - 4.5 * math.sin(t * 1.5), z - z * t * .95, .6, .55, .7,
                          mat='bone', tex='plain', role='misc'))
    # 두개골(왼쪽 앞, 크게)
    s.add(E.Ellip(6.5, 4, 4.2, 4.0, 3.0, 3.0, mat='bone', tex='plain', role='misc', contour=True))
    s.add(E.Ellip(3.0, 3.4, 2.3, 2.4, 2.2, 1.5, mat='bone', tex='plain', role='misc', contour=True))
    s.box(6.6, 8.4, .8, 1.2, 4.4, 6.0, mat='basalt', tex='plain', role='misc')
    for x in (1.2, 2.5, 3.8):
        s.add(Cone(x, 1.1, .45, 1.0, 2.6, mat='bone', tex='plain', role='misc'))
    s.add(Cone(5.5, 3.5, .8, 6.6, 9.4, mat='bone', tex='plain', role='misc', contour=True))
    return s


def ruin_city():
    """운석 충돌구: 깨진 바위 둘레 언덕, 가운데 검게 탄 운석(붉은 금), 피어오르는 연기, 흩어진 파편."""
    s = Scene()
    rng = np.random.RandomState(7)
    # 둘레 둑(뒤는 높고 앞은 낮게)
    for k in range(16):
        th = 2 * math.pi * k / 16
        front = math.sin(th) < -.2
        x, y = 31 + 24 * math.cos(th), 18 + 12 * math.sin(th)
        h = 3.0 if front else 5.5 + 1.5 * rng.rand()
        boulder(s, x, y, h * .4, 4.8 + rng.rand() * 1.5, 3.6, h, mat='rock')
    # 패인 바닥(어두운 흙)
    s.add(E.Ellip(31, 18, 1.0, 19.5, 10, 1.4, mat='basalt', tex='speck', role='misc'))
    # 운석
    s.add(E.Ellip(31, 18, 5.0, 7.0, 5.5, 5.0, mat='basalt', tex='speck', role='misc', contour=True))
    for (x, z, w) in ((28, 6.5, 1.0), (33.5, 4, .8), (30.5, 8.6, 2.6)):
        s.box(x - w, x + w, 12.4, 13.0, z, z + .7, mat='ember', tex='plain', role='nocast')
    s.box(26.8, 27.6, 12.6, 13.2, 3.4, 7.2, mat='ember', tex='plain', role='nocast')
    # 깨진 바위 판(튀어 오른 지층)
    for (x0, x1, y0, y1, zt, tl) in ((8, 14, 10, 15, 8, ((.5, .2), (-.3, .1))), (47, 54, 9, 14, 9, ((-.6, .1), (.2, -.2))),
                                     (40, 46, 26, 30, 7, ((.4, .3), (-.4, 0)))):
        s.add(M.broken(x0, x1, y0, y1, zt, tilts=tl, drops=(0, 2.5), mat='rock', tex='strata', role='misc', contour=True))
    # 연기
    M.steam(s, 32, 20, 11, rng, n=3, r0=2.4, rise=3.4, drift=2.4, mat='smoke')
    # 파편
    for _ in range(7):
        x, y = rng.uniform(6, 56), rng.uniform(0, 4)
        boulder(s, x, y, .6, 1.2, 1.0, 1.0, mat='basalt')
    return s


def shrine():
    """태양 제단: 세 단 돌 계단 단, 앞 가운데 큰 계단, 꼭대기 금빛 해 원반과 선돌 둘, 불 그릇."""
    s = Scene()
    z = 0
    for (x0, x1, y0, y1, h) in ((2, 44, 6, 26, 4), (7, 39, 10, 24, 4), (12, 34, 13, 23, 4)):
        s.box(x0, x1, y0, y1, z, z + h, mat='greywall', tex='brick', role='wall', contour=True)
        z += h
    for i in range(6):
        s.box(18, 28, 6 - 4 + i * 2, 13 + 0 * i, 0, 2 * (i + 1), mat='wstone', tex='plain', role='misc', contour=True)
    # 해 원반
    s.box(21.4, 24.6, 18, 19.4, z, z + 7, mat='greywall', tex='speck', role='misc', contour=True)
    s.add(E.Ellip(23, 18.4, z + 11, 6.0, .9, 6.0, mat='goldroof', tex='plain', role='misc', contour=True))
    s.add(E.Ellip(23, 17.9, z + 11, 3.6, .6, 3.6, mat='gold', tex='plain', role='misc'))
    for k in range(8):
        th = 2 * math.pi * k / 8
        cx, cz = 23 + 8 * math.cos(th), z + 11 + 8 * math.sin(th)
        s.box(cx - .8, cx + .8, 18.2, 19.0, cz - .8, cz + .8, mat='goldroof', tex='plain', role='misc')
    for x in (14, 31.5):
        menhir(s, x, 16, 2.4, 2.0, 8)
    for x in (7, 39):
        s.cyl(x, 4, 1.8, 0, 2.4, mat='greywall', tex='plain', role='misc', contour=True)
        fire(s, x, 4, r=1.0, flame=2.2) if False else s.add(Cone(x, 4, 1.3, 2.4, 5.4, mat='ember', tex='plain', role='nocast'))
    return s


def landmark_nature():
    """거대 고사리 숲: 키 다른 나무고사리 다섯, 아래 덤불·바위."""
    s = Scene()
    fern(s, 22, 16, h=21, R=9, n=8)
    fern(s, 9.5, 11, h=14, R=6.2, n=7)
    fern(s, 34, 9, h=15, R=6.2, n=7)
    fern(s, 15, 2, h=7, R=5, n=6)
    fern(s, 30, 0, h=5, R=4.6, n=6)
    boulder(s, 5, 0, .8, 2.2, 1.6, 1.6)
    s.add(E.Ellip(23, 2, 1.0, 3.2, 2, 1.8, mat='moss', tex='speck', role='misc', contour=True))
    return s


def circle():
    """선돌 원: 선돌 고리와 뒤 가운데 들보를 얹은 문 돌(돌멘)."""
    s = Scene()
    # 문 돌(뒤 가운데)
    menhir(s, 8, 12, 3.0, 2.6, 11)
    menhir(s, 18, 12, 3.0, 2.6, 11)
    s.box(6.8, 22.2, 12, 14.6, 11, 13.6, mat='greywall', tex='speck', role='misc', contour=True)
    # 고리
    for (x, y, w, h) in ((1.5, 7, 2.8, 9), (24.5, 7, 2.8, 9.5), (4.5, 1, 2.8, 7), (21.5, 0.5, 2.8, 7.5), (13.5, -1, 2.8, 5.5)):
        menhir(s, x, y, w, 2.4, h)
    s.add(E.Ellip(14.5, 5, .4, 3.0, 2.0, .8, mat='wstone', tex='plain', role='misc', contour=True))   # 가운데 제물 돌
    return s


def volcano():
    """화산: 검은 원뿔, 화구에서 넘친 용암 줄기 둘이 앞 비탈을 타고 흘러내린다, 연기."""
    s = Scene()
    xc, yc = 15, 9
    s.add(E.oct_pyr(xc, yc, 13, 0, 19, ztrunc=12.5, mat='basalt', tex='speck', role='wall', contour=True))
    s.add(E.Ellip(xc, yc - .5, 12.6, 4.2, 3.2, .9, mat='ember', tex='plain', role='misc'))
    # 용암 줄기: 앞 비탈 위를 따라 내려오는 덩이 줄
    k = 13 / (19 - 0)      # 반지름/높이
    for (dx0, wig) in ((-1.2, -1), (1.8, 1)):
        for i in range(12):
            z = 12.2 - i * 1.0
            rr = (19 - z) * k
            x = xc + dx0 + wig * .6 * math.sin(i * .9) + wig * i * .25
            y = yc - rr * .93
            s.add(E.Ellip(x, y, z, .95 + i * .03, .6, .7, mat='ember', tex='plain', role='nocast'))
    s.add(E.Ellip(xc - 3, yc - 13, .6, 2.6, 1.2, .7, mat='ember', tex='plain', role='nocast'))
    rng = np.random.RandomState(3)
    M.steam(s, xc - 1, yc + 1, 13.5, rng, n=2, r0=1.8, rise=2.4, drift=2.0, mat='smoke')
    return s


def floating():
    """떠 있는 바위섬: 아래로 뾰족한 바위 밑동(두 겹), 풀 윗면 위 움집·고사리·선돌, 가장자리 폭포와 늘어진 덩굴."""
    s = Scene()
    xc, yc = 38, 16
    s.add(E.InvCone(xc, yc, 23, -4, 17, mat='rock', tex='strata', role='wall', contour=True))
    for (dx, r, zb) in ((-15, 7, 4), (13, 6, 6), (-2, 5, 1)):
        s.add(E.InvCone(xc + dx, yc - 12, r, zb, 16.5, mat='rock', tex='strata', role='wall', contour=True))
    s.add(E.Ellip(xc, yc, 17.0, 32, 17, 2.2, mat='leaf2', tex='speck', role='ground', contour=True))
    s.patch(xc - 27, xc + 27, yc - 13, yc + 13,
            lambda x, y: np.array(ob.MAT['grass'], np.uint8)[np.clip((ob.hsh(x, y, 5) * 4.2).astype(int), 0, 4)], z=17, h=1.2, mat='grass')
    z0 = 18.2
    for (x, y, r, roof) in ((xc - 9, yc - 3, 5.4, 'thatch'), (xc + 9, yc + 5, 4.8, 'hide'), (xc - 1, yc + 9, 4.0, 'thatch')):
        s.add(Cyl(x, y, r, z0, z0 + 3.8, mat='mud', tex='speck', role='house', contour=True,
                  decals=(('side', (-90, 1.2, z0, z0 + 3.4, 'dark')),)))
        s.add(Cone(x, y, r + .7, z0 + 3.8, z0 + 3.8 + r * 1.6, mat=roof, tex='straw', role='roof', contour=True))
    fern(s, xc + 22, yc - 3, h=9, R=5.5, n=6, z0=z0)
    fern(s, xc - 23, yc + 5, h=10, R=5.5, n=6, z0=z0)
    menhir(s, xc + 2, yc - 9, 2.4, 1.8, 5.5)
    # 폭포: 앞 가장자리에서 아래로 + 물보라
    s.box(xc + 13, xc + 17, yc - 14.6, yc - 13.8, 1.0, z0 + .2, mat='fall', tex='ribs', role='nocast')
    for k in range(4):
        s.add(E.Ellip(xc + 15 + (k - 1.5) * 1.8, yc - 14.8, 1.0 - k * .1, 1.5, .8, 1.0, mat='cloud', tex='speck', role='nocast'))
    # 덩굴: 가장자리에서 늘어진 잎 덩이 줄(짧고 울퉁불퉁)
    for (x, n) in ((xc - 22, 3), (xc - 12, 2), (xc - 3, 4), (xc + 6, 2), (xc + 24, 3)):
        for j in range(n):
            s.add(E.Ellip(x + .6 * math.sin(j * 1.7), yc - 13.8 + j * .3, z0 - 1.6 - j * 1.8, 1.3 - j * .15, .8, 1.1,
                          mat='fern', tex='speck', role='nocast', contour=True))
    return s

ORDER = [
    ('capital', '부족 대마을', 'capital', (6, 6), '매머드 엄니 대문·목책 둘레·불 광장을 둘러싼 움집 무리·족장의 큰 움집'),
    ('fort_city', '목책 부락', 'fort_city', (4, 4), '말뚝 목책·통나무 문과 두개골·망대 둘·안쪽 움집 넷'),
    ('harbor_city', '호숫가 수상 부락', 'harbor_city', (5, 4), '호수 위 말뚝 움집 셋·잔교·통나무 배 둘·뒤 기슭 마을'),
    ('castle', '공룡족 둥지 요새', 'castle', (3, 3), '바위 탑 셋과 뼈 가시·짚 둥지의 알·두개골 문'),
    ('castle', '매머드 뼈 전당', 'castle_b', (3, 3), '가죽 돔을 엄니 갈비가 감싸고 매머드 두개골 문'),
    ('large_town', '움집 마을', 'large_town', (3, 3), '짚·가죽 지붕 움집 여섯과 모닥불·고사리'),
    ('village', '동굴 집 마을', 'village', (2, 2), '바위 언덕의 구멍 집 셋·사다리·모닥불'),
    ('village', '나무 위 부락', 'village_b', (2, 2), '거목 두 그루 위 판자 마루 움집·줄사다리'),
    ('camp', '사냥 야영', 'camp', (2, 2), '가죽 천막 둘·모닥불 고기 꼬치·세워 둔 창'),
    ('tower_small', '토템 기둥', 'tower_small', (1, 2), '얼굴 새긴 통나무 셋·날개 판·뿔 두개골'),
    ('tower_great', '거대 바위 기둥', 'tower_great', (2, 4), '층층 사암 기둥·꼭대기 움집과 사다리'),
    ('cave', '벽화 동굴', 'cave', (2, 2), '바위 언덕의 큰 입구·붉은 손자국 벽화·횃불'),
    ('ruin', '공룡 화석', 'ruin', (2, 2), '반쯤 묻힌 거대 뼈대(등뼈·갈비·두개골)'),
    ('ruin_city', '운석 충돌구', 'ruin_city', (4, 3), '바위 둑·탄 운석의 붉은 금·연기·깨진 지층'),
    ('shrine', '태양 제단', 'shrine', (3, 3), '세 단 돌 계단 단·금빛 해 원반·선돌·불 그릇'),
    ('landmark_nature', '거대 고사리 숲', 'landmark_nature', (3, 3), '키 다른 나무고사리 다섯'),
    ('circle', '선돌 원', 'circle', (2, 2), '선돌 고리와 들보를 얹은 문 돌'),
    ('volcano', '화산', 'volcano', (2, 2), '검은 원뿔·흘러내리는 용암 줄기 둘·연기'),
    ('floating', '떠 있는 바위섬', 'floating', (5, 4), '거꾸로 선 바위·움집·고사리·폭포·덩굴'),
]
