"""스팀펑크·마도 월드맵 아이콘 — 정면 카메라(KX=0, KY=.62)용 장면.
놋쇠·구리·녹슨 철·검댕 벽돌, 증기·톱니·굴뚝, 비행선, 기차, 마석(보라 수정).
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / '_scene3d'))
import math  # noqa: E402
import numpy as np  # noqa: E402
import oblique as ob  # noqa: E402
import east as E  # noqa: E402
import modsf_kit as M  # noqa: E402
import icons_v9_lib as L  # noqa: E402
from icons_v9_lib import STONE, ROCK, WOOD, GOLD, LAVA, BLUE, SNOW, WATER, hx  # noqa: E402
from oblique import Scene, Poly, box  # noqa: E402

SET = dict(id='steampunk', name='스팀펑크·마도')

# ── 세트 재질 ────────────────────────────────────────────────────────────────────────────────
BRASS = [WOOD[0], hx('6b5218'), hx('9c7c2a'), hx('c9a640'), hx('ecd479')]                  # 새 색 4
SOOT = [STONE[0], ROCK[0], ROCK[2], hx('6e3a2c'), hx('8c4e3a'), hx('a8664a')]               # 검댕 벽돌 새 색 3
MAGI = [hx('2a1a4a'), STONE[2], hx('8a4ad0'), hx('c07cf0'), hx('f0d0ff')]                    # 마석 새 색 4
ob.MAT.update({
    'brass': BRASS,
    'soot': SOOT,
    'magi': MAGI,
    'magiglow': [MAGI[2], MAGI[3], MAGI[3], MAGI[4], MAGI[4]],
    'copper': [ROCK[0], WOOD[2], WOOD[4], WOOD[5], GOLD[3], GOLD[4]],
    'iron': [STONE[0], STONE[1], STONE[2], STONE[3], STONE[4], STONE[5]],
    'canvas': [hx('564a3e'), hx('766e60'), hx('b9ab9d'), hx('d8cbac'), hx('e1d7c1')],
    'hole': [STONE[0], STONE[0], STONE[0]],
    'coal': [STONE[0], STONE[1], STONE[1], STONE[2]],
    'lavaglow': [LAVA[2], LAVA[3], LAVA[4], LAVA[5], LAVA[5]],
    'coil': [BLUE[1], BLUE[3], WATER[4], SNOW[3], SNOW[5]],
})
L._reg(BRASS, WOOD[0])
L._reg(SOOT, STONE[0])
L._reg(MAGI, hx('2a1a4a'))


def rs(seed):
    return np.random.RandomState(seed)


# ── 입체 ─────────────────────────────────────────────────────────────────────────────────────
def hcyl_x(x0, x1, yc, zc, r, n=12, **kw):
    """x 방향으로 누운 원통(보일러·관·포신)."""
    pl = [((-1, 0, 0), -x0, 'left'), ((1, 0, 0), x1, 'right')]
    for k in range(n):
        a = 2 * math.pi * (k + .5) / n
        nn = (0.0, math.cos(a), math.sin(a))
        pl.append((nn, nn[1] * yc + nn[2] * zc + r, 'side'))
    kw.setdefault('tex', 'plain')
    return Poly(pl, **kw)


def disc_y(cx, y0, y1, cz, r, n=14, rot=0.0, **kw):
    """앞을 보는 원판(축이 y): 톱니바퀴·시계판·외륜."""
    pl = [((0, -1, 0), -y0, 'front'), ((0, 1, 0), y1, 'back')]
    for k in range(n):
        a = 2 * math.pi * (k + .5) / n + rot
        nn = (math.cos(a), 0.0, math.sin(a))
        pl.append((nn, nn[0] * cx + nn[2] * cz + r, 'rim'))
    kw.setdefault('tex', 'plain')
    return Poly(pl, **kw)


def gear(s, cx, y, cz, r, teeth=8, th=1.6, mat='brass', hub='iron', rot=0.0, role='misc', spokes=True):
    """앞을 보는 톱니바퀴: 원판 + 톱니 + 축통."""
    ri = r * .78
    s.add(disc_y(cx, y, y + th, cz, ri, n=16, mat=mat, role=role, contour=True))
    tw = max(1.2, 2 * math.pi * ri / teeth * .45)
    for k in range(teeth):
        a = 2 * math.pi * k / teeth + rot
        c = (cx + (ri + (r - ri) / 2 - .2) * math.cos(a), y + th / 2, cz + (ri + (r - ri) / 2 - .2) * math.sin(a))
        s.add(M.obox(c, (r - ri + .6, th, tw), M.rot_y(-a), mat=mat, tex='plain', role=role, contour=True))
    if spokes and r >= 4:
        s.add(disc_y(cx, y - .2, y + th, cz, ri * .62, n=12, mat='hole', role=role))
        for k in range(4):
            a = math.pi / 4 + math.pi / 2 * k + rot
            s.add(M.obox((cx + ri * .3 * math.cos(a), y - .1, cz + ri * .3 * math.sin(a)), (ri * .7, .5, 1.1), M.rot_y(-a),
                         mat=mat, tex='plain', role=role))
    if hub:
        s.add(disc_y(cx, y - .5, y + th, cz, max(.9, r * .2), n=8, mat=hub, role=role, contour=True))


def clock(s, cx, y, cz, r, t=(-55, 80), role='misc'):
    """시계판: 놋쇠 테 + 흰 판 + 바늘(시·분 각도, 위가 90°)."""
    s.add(disc_y(cx, y, y + 1, cz, r + 1, n=16, mat='brass', role=role, contour=True))
    p = s.add(disc_y(cx, y - .3, y + 1, cz, r, n=16, mat='canvas', role=role))
    hands = [(math.radians(t[0]), r * .55), (math.radians(t[1]), r * .85)]

    def post(tag, P, col, sh, nrm):
        dx, dz = P[:, 0] - cx, P[:, 2] - cz
        m = np.zeros(len(dx), bool)
        for a, ln in hands:
            ux, uz = math.cos(a), math.sin(a)
            along = dx * ux + dz * uz
            perp = np.abs(-dx * uz + dz * ux)
            m |= (along >= -.3) & (along <= ln) & (perp < .6)
        m |= dx * dx + dz * dz < .5
        return np.where(m[:, None], np.array(STONE[0], np.uint8)[None, :], col).astype(np.uint8)
    p.post = post


def plates(mat='iron', px=5, pz=4, seed=2):
    """철판: 앞면 판 이음(어두운 줄) + 리벳(밝은 점)."""
    rp = ob.MAT[mat]

    def post(tag, P, col, s, nrm):
        x, z = P[:, 0], P[:, 2]
        front = nrm[:, 1] < -.5
        seam = front & ((np.mod(z, pz) < .9) | (np.mod(x + np.floor(z / pz) * 2, px) < .9))
        out = np.where(seam[:, None], ob._darken(rp, s, -1), col)
        riv = front & (np.mod(z, pz) >= 1.5) & (np.mod(z, pz) < 2.5) & (np.mod(x + np.floor(z / pz) * 2, px) >= 1) & (np.mod(x + np.floor(z / pz) * 2, px) < 2)
        out = np.where(riv[:, None], ob._darken(rp, s, 1), out)
        top = nrm[:, 2] > .5
        out = np.where((top & (np.mod(x, px) < .9))[:, None], ob._darken(rp, s, -1), out)
        return out.astype(np.uint8)
    return post


def env_ribs(xc, rx, n=5, mat='canvas'):
    """비행선 기낭: 세로 이음(어두운 줄)."""
    rp = ob.MAT[mat]

    def post(tag, P, col, s, nrm):
        u = (P[:, 0] - (xc - rx)) / (2 * rx) * n
        m = np.mod(u, 1.0) < .14
        return np.where(m[:, None], ob._darken(rp, s, -1), col).astype(np.uint8)
    return post


# ── 부품 ─────────────────────────────────────────────────────────────────────────────────────
def wins(x0, x1, z0, z1, n, mode='lit', w=1.6, face='front', skip=()):
    out = []
    for i in range(n):
        if i in skip:
            continue
        cx = x0 + (x1 - x0) * (i + .5) / n
        out.append((face, (cx - w / 2, cx + w / 2, z0, z1, mode)))
    return tuple(out)


def chimney(s, x, y, r, h, z0=0.0, mat='soot', steam=True, seed=1, puffs=3, pr=2.4, nocast=False):
    role = 'nocast' if nocast else 'tower'
    s.cyl(x, y, r, z0, h, mat=mat, tex='brick', role=role, contour=True)
    s.cyl(x, y, r + .5, h - 2, h - .8, mat='brass', tex='plain', role=role, contour=True)
    s.cyl(x, y, r + .6, h - .8, h, mat='iron', tex='plain', role=role, contour=True)
    s.cyl(x, y, r - .4, h - .4, h + .05, mat='hole', tex='plain', role=role)
    if steam:
        M.steam(s, x, y, h + pr * .6, rs(seed), n=puffs, r0=pr, rise=pr * .9, drift=pr * .8)


def pipe_run(s, x0, x1, y, z, r=.9, mat='copper', joints=(), contour=True):
    s.add(hcyl_x(x0, x1, y, z, r, n=8, mat=mat, role='misc', contour=contour))
    for jx in joints:
        s.add(hcyl_x(jx - .6, jx + .6, y, z, r + .45, n=8, mat='brass', role='misc'))


def vpipe(s, x, y, z0, z1, r=.8, mat='copper'):
    s.cyl(x, y, r, z0, z1, mat=mat, tex='plain', role='misc', contour=True)


def factory(s, x, y, w, d, h, bays=3, mat='soot', roof='iron', lit=True, door=True, rows=1):
    """벽돌 공장: 벽돌 몸통 + 앞을 보는 톱날 박공 지붕 줄 + 창."""
    dec = list(wins(x + 1, x + w - 1, h * .45, h * .45 + 2.4, max(2, int(w / 3.2)), 'lit' if lit else 'dark'))
    if rows == 2:
        dec += list(wins(x + 1, x + w - 1, h * .45 - 3.4, h * .45 - 1.2, max(2, int(w / 3.2)), 'dark'))
    if door:
        dec.append(('front', (x + w * .5 - 1.6, x + w * .5 + 1.6, 0, min(4, h * .5), 'gate')))
    s.box(x, x + w, y, y + d, 0, h, mat=mat, tex='brick', role='house', contour=True, decals=tuple(dec))
    bw = w / bays
    for i in range(bays):
        bx = x + i * bw
        p = E.gable_ns(bx - .2, bx + bw + .2, y - .4, y + d + .4, h, 4.2 / (bw / 2), mat=roof, tex='tile', role='roof', contour=True)
        s.add(p)


def shed(s, x, y, w, d, h, roof='rust', wall='wood', rise=3.0, door=True, win=True):
    dec = []
    if door:
        dec.append(('front', (x + w * .3 - 1, x + w * .3 + 1, 0, min(3, h - .5), 'door')))
    if win and w >= 6:
        dec.append(('front', (x + w * .68 - .8, x + w * .68 + .8, h * .4, h * .4 + 1.6, 'lit')))
    s.box(x, x + w, y, y + d, 0, h, mat=wall, tex='plank' if wall == 'wood' else 'brick', role='house', contour=True, decals=tuple(dec))
    s.add(ob.gable(x - .6, x + w + .6, y - .8, y + d + .8, h, rise / (d / 2 + .8), mat=roof, tex='shingle', role='roof', contour=True))


def rails(s, x0, x1, y, z=0.0, gauge=2.2):
    for xx in np.arange(x0 + .5, x1 - .5, 2.0):
        s.box(xx, xx + 1, y - .6, y + gauge + .6, z, z + .5, mat='wood', tex='plain', role='nocast')
    for yy in (y, y + gauge):
        s.box(x0, x1, yy - .25, yy + .25, z + .5, z + 1.0, mat='iron', tex='plain', role='nocast')


def minecart(s, x, y, z=1.0, w=4.0, ore='coal'):
    s.box(x, x + w, y, y + 2.4, z + .6, z + 2.8, mat='rust', tex='plain', role='misc', contour=True,
          decals=(('front', (x + .3, x + w - .3, z + 1.6, z + 2.0, 'dark')),))
    s.add(E.Ellip(x + w / 2, y + 1.2, z + 2.8, w * .42, 1.0, .9, mat=ore, tex='speck', role='misc'))
    for wx in (x + .9, x + w - .9):
        s.add(disc_y(wx, y - .3, y + .2, z + .7, .8, n=8, mat='iron', role='misc'))


def airship(s, xc, yc, zc, L_=26, R=5.5, mat='canvas', gondola=True, props=True, nocast=False, fins=True, tilt=None):
    """비행선: 기낭(타원체·세로 이음) + 놋쇠 띠 + 곤돌라 + 꼬리 날개 + 프로펠러."""
    role = 'nocast' if nocast else 'misc'
    env = s.add(E.Ellip(xc, yc, zc, L_ / 2, R * .9, R, mat=mat, tex='plain', role=role, contour=True))
    env.post = env_ribs(xc, L_ / 2, n=6, mat=mat)
    s.add(E.Ellip(xc, yc - .1, zc, L_ * .03 + .9, R * .92, R * 1.02, mat='brass', tex='plain', role=role))
    if fins:
        tx = xc - L_ / 2 + 1.5
        s.box(tx - 3, tx + 1.5, yc - .5, yc + .5, zc + R * .4, zc + R + 2.2, mat='cloth', tex='plain', role=role, contour=True)
        s.box(tx - 3, tx + 1.5, yc - .5, yc + .5, zc - R - 1.8, zc - R * .4, mat='cloth', tex='plain', role=role, contour=True)
    if gondola:
        gw = L_ * .42
        s.box(xc - gw / 2, xc + gw / 2, yc - 1.4, yc + 1.4, zc - R - 3.2, zc - R + .4, mat='wood', tex='plank', role=role, contour=True,
              decals=wins(xc - gw / 2 + .8, xc + gw / 2 - .8, zc - R - 2.2, zc - R - 1.0, max(2, int(gw / 3)), 'lit', w=1.2))
        s.box(xc - gw / 2 - .5, xc + gw / 2 + .5, yc - 1.8, yc + 1.8, zc - R + .4, zc - R + 1.0, mat='brass', tex='plain', role=role)
    if props:
        px = xc + L_ / 2 * .2
        for side in (-1,):
            s.box(px - .5, px + .5, yc - 1.8, yc - 1.2, zc - R - 2.6, zc - R + .2, mat='iron', tex='plain', role=role)
        s.add(disc_y(xc - L_ / 2 - .2, yc - .4, yc + .4, zc, R * .55, n=6, mat='iron', role=role, contour=True))
        s.add(M.obox((xc - L_ / 2 - .6, yc - .6, zc), (R * 1.6, .5, 1.0), M.rot_y(.7), mat='brass', tex='plain', role=role, contour=True))
        s.add(M.obox((xc - L_ / 2 - .6, yc - .6, zc), (R * 1.6, .5, 1.0), M.rot_y(-.8), mat='brass', tex='plain', role=role, contour=True))


def magicite(s, x, y, h, w=1.6, z0=0.0, glow=True, role='misc', lean=0.0):
    """마석 결정: 사각기둥 + 뾰족 끝(사각뿔). 빛나는 보라."""
    s.box(x - w / 2, x + w / 2, y - w / 2, y + w / 2, z0, z0 + h, mat='magiglow' if glow else 'magi', tex='plain', role=role, contour=True)
    s.hip(x - w / 2, x + w / 2, y - w / 2, y + w / 2, z0 + h, 2.2, mat='magiglow' if glow else 'magi', tex='plain', role=role, contour=True)


def coil(s, x, y, h, r=1.2, z0=0.0, rings=3, role='nocast'):
    """테슬라 코일: 구리 기둥 + 고리 + 빛나는 구."""
    s.cyl(x, y, r * .6, z0, z0 + h, mat='copper', tex='plain', role=role, contour=True)
    for i in range(rings):
        zz = z0 + h * (.3 + .55 * i / max(rings - 1, 1))
        s.cyl(x, y, r + .5, zz, zz + .7, mat='brass', tex='plain', role=role)
    s.add(M.Dome(x, y, z0 + h + r * .9, r * 1.1, zmin=-99, mat='coil', role=role, contour=True))


def lattice(x0, mat='iron'):
    """철골 탑 면: X 자 버팀대 무늬(앞면)."""
    rp = ob.MAT[mat]

    def post(tag, P, col, s, nrm):
        x, z = P[:, 0], P[:, 2]
        front = nrm[:, 1] < -.5
        u = np.mod(x - x0, 4.0)
        v = np.mod(z, 4.0)
        hole = front & (np.abs(u - v) > .9) & (np.abs(u - (4 - v)) > .9) & (u > .9) & (v > .9)
        return np.where(hole[:, None], np.array(STONE[0], np.uint8)[None, :], col).astype(np.uint8)
    return post


def mast(s, x, y, w, h, top=True, nocast=False):
    role = 'nocast' if nocast else 'tower'
    p = s.box(x, x + w, y, y + w, 0, h, mat='iron', tex='plain', role=role, contour=True)
    p.post = lattice(x)
    if top:
        s.box(x - 1.2, x + w + 1.2, y - 1.2, y + w + 1.2, h, h + 1.2, mat='brass', tex='plain', role=role, contour=True)


class CEllip(E.Ellip):
    """땅(zmin) 아래를 잘라 낸 타원체."""

    def __init__(self, *a, zmin=0.0, **kw):
        E.Ellip.__init__(self, *a, **kw)
        self.zmin = zmin

    def ray(self, O, D):
        t, f = E.Ellip.ray(self, O, D)
        z = O[:, 2] + np.where(t < ob.INF / 2, t, 0) * D[2]
        return np.where(z >= self.zmin - .01, t, ob.INF), f


def rock_mound(s, cx, cy, rx, ry, rz, mat='rock', z=0.0, role='wall'):
    return s.add(CEllip(cx, cy, z, rx, ry, rz, zmin=z, mat=mat, tex='speck', role=role, contour=True))


# ═════════════════════════════════════════════ 장면 ═════════════════════════════════════════════
def capital():
    """마도 제국 수도: 왼쪽 뒤 시계탑, 오른쪽 뒤 공장 굴뚝, 오른쪽 비행선 정박탑, 앞 철판 성벽과 톱니 문."""
    s = Scene()
    # 뒤줄 공장(굴뚝 셋)
    factory(s, 48, 46, 30, 10, 12, bays=4)
    chimney(s, 47, 52, 2.4, 34, seed=3, puffs=3, pr=2.4, nocast=True)
    chimney(s, 54, 54, 2.0, 38, seed=5, puffs=3, pr=2.2, nocast=True)
    # 시계탑(왼쪽 뒤)
    tx, ty = 18, 44
    s.box(tx - 6, tx + 6, ty, ty + 10, 0, 34, mat='soot', tex='brick', role='nocast', contour=True,
          decals=wins(tx - 4.5, tx + 4.5, 14, 18, 3, 'lit', w=1.4) + wins(tx - 4.5, tx + 4.5, 8, 11, 3, 'dark', w=1.4))
    s.box(tx - 7, tx + 7, ty - 1, ty + 11, 34, 35.5, mat='brass', tex='plain', role='nocast', contour=True)
    s.box(tx - 5.5, tx + 5.5, ty + .5, ty + 9.5, 35.5, 46, mat='soot', tex='brick', role='nocast', contour=True)
    clock(s, tx, ty, 41, 4.2)
    s.box(tx - 6.5, tx + 6.5, ty - .5, ty + 10.5, 46, 47.2, mat='brass', tex='plain', role='nocast', contour=True)
    s.add(M.Dome(tx, ty + 5, 47.2, 5.2, mat='copper', role='nocast', contour=True))
    s.cyl(tx, ty + 5, .7, 50, 58, mat='brass', tex='plain', role='nocast')
    # 비행선 정박탑(오른쪽) + 비행선
    mast(s, 78, 36, 4, 36, nocast=True)
    airship(s, 65, 34, 41, L_=23, R=5.0, nocast=True)
    # 가운데 줄: 관청(놋쇠 돔) + 집들
    s.box(30, 52, 26, 36, 4, 18, mat='soot', tex='brick', role='keep', contour=True,
          decals=wins(31, 51, 11, 14, 6, 'lit', w=1.6) + (('front', (39, 43, 4, 9, 'gate')),))
    s.box(28, 54, 24, 38, 0, 4, mat='iron', tex='plain', role='keep', contour=True).post = plates()
    s.box(29.4, 52.6, 25.4, 26.6, 16.6, 18, mat='brass', tex='plain', role='keep')
    s.hip(29, 53, 25, 37, 18, .55, mat='iron', tex='shingle', role='roof', contour=True)
    s.cyl(41, 31, 4.2, 21, 23, mat='brass', tex='plain', role='roof', contour=True)
    s.add(M.Dome(41, 31, 23, 4.6, mat='copper', role='roof', contour=True))
    s.cyl(41, 31, .8, 27, 31, mat='brass', tex='plain', role='misc')
    shed(s, 6, 24, 12, 7, 8, roof='iron', wall='soot', rise=4)
    shed(s, 62, 22, 12, 7, 9, roof='iron', wall='soot', rise=4)
    chimney(s, 72, 26, 1.3, 17, seed=7, puffs=2, pr=1.8)
    gear(s, 22, 21, 10, 4.2, teeth=8, mat='brass')
    pipe_run(s, 18, 30, 30, 9, joints=(24,))
    # 앞 성벽(철판) + 문루 + 모서리 포탑
    for (a, b) in ((5, 38), (54, 83)):
        w = s.box(a, b, 4, 9, 0, 10, mat='iron', tex='plain', role='wall', contour=True)
        w.post = plates()
        s.crenels(a, b, 4, 9, 10, mat='iron', step=2.5, h=1.8, edges=('front',), depth=1.4)
    g = s.box(36, 56, 1, 10, 0, 15, mat='iron', tex='plain', role='gate', contour=True,
              decals=(('front', (42, 50, 0, 8, 'gate')),))
    g.post = plates()
    s.box(35.6, 56.4, .4, 1.4, 13.4, 14.6, mat='brass', tex='plain', role='gate')
    s.crenels(36, 56, 1, 10, 15, mat='iron', step=2.5, h=1.8, edges=('front',), depth=1.4)
    gear(s, 46, 0, 11.0, 3.0, teeth=8, mat='brass', spokes=False)
    for cx in (6, 82):
        s.cyl(cx, 6, 4.2, 0, 14, mat='iron', tex='plain', role='tower', contour=True)
        s.cyl(cx, 6, 4.7, 14, 15.4, mat='brass', tex='plain', role='tower', contour=True)
        s.add(ob.Cone(cx, 6, 4.7, 15.4, 21, mat='copper', tex='plain', role='roof', contour=True))
    return s


def fort_city():
    """공업 도시: 톱날 지붕 벽돌 공장들 + 굴뚝 넷 + 가스 탱크 + 구리 증기관 + 앞 벽돌 담과 철문."""
    s = Scene()
    factory(s, 4, 30, 24, 9, 11, bays=3)
    factory(s, 34, 32, 21, 8, 13, bays=3, roof='rust')
    chimney(s, 10, 38, 2.2, 22, seed=2, puffs=3, pr=2.3, nocast=True)
    chimney(s, 26, 37, 1.8, 19, seed=4, puffs=2, pr=2.0, nocast=True)
    chimney(s, 48, 39, 2.3, 23, seed=6, puffs=3, pr=2.4, nocast=True)
    # 가스 탱크
    s.cyl(46, 20, 6, 0, 13, mat='rust', tex='plain', role='misc', contour=True).post = M.with_ramp(M.bands(2, 3.5, 1, -1, ('side',)), 'rust')
    s.add(M.Dome(46, 20, 13, 6, mat='rust', role='misc', contour=True))
    factory(s, 6, 16, 18, 8, 9, bays=2, rows=1)
    chimney(s, 21, 21, 1.4, 19, seed=8, puffs=2, pr=1.8)
    pipe_run(s, 24, 40, 18, 7, joints=(30, 36))
    vpipe(s, 39.5, 18, 0, 7.5)
    vpipe(s, 24.5, 18, 0, 7.5)
    pipe_run(s, 26, 34, 28, 9, r=.8, joints=(30,))
    # 앞 담 + 철문
    for (a, b) in ((2, 24), (38, 60)):
        s.box(a, b, 3, 7, 0, 7, mat='soot', tex='brick', role='wall', contour=True)
        s.box(a - .4, b + .4, 2.6, 7.4, 7, 8, mat='iron', tex='plain', role='wall', contour=True)
    g = s.box(23, 39, 1, 8, 0, 11, mat='iron', tex='plain', role='gate', contour=True, decals=(('front', (27, 35, 0, 7.5, 'gate')),))
    g.post = plates()
    s.box(22.4, 39.6, .4, 1.6, 9.8, 11, mat='brass', tex='plain', role='gate')
    s.crenels(23, 39, 1, 8, 11, mat='iron', step=2.4, h=1.6, edges=('front',), depth=1.3)
    gear(s, 31, .3, 9.6, 2.0, teeth=7, spokes=False)
    return s


def harbor_city():
    """증기선 항구: 외륜 증기선(굴뚝 둘·외륜) + 나무 부두 + 놋쇠 크레인 + 벽돌 창고."""
    s = Scene()
    # 창고 줄(뒤)
    factory(s, 2, 30, 20, 8, 10, bays=2, roof='iron')
    shed(s, 26, 31, 14, 7, 9, roof='rust', wall='soot', rise=4)
    factory(s, 46, 30, 18, 8, 11, bays=2, roof='rust')
    chimney(s, 58, 36, 1.6, 22, seed=3, puffs=2, pr=2.0, nocast=True)
    # 부두
    s.box(1, 72, 14, 26, 0, 2, mat='wood', tex='plank', role='misc', contour=True)
    for px in range(3, 72, 8):
        s.box(px, px + 1.4, 13, 14.4, -1, 3, mat='wood', tex='plain', role='misc')
    # 짐 더미
    for (x, y, z) in ((4, 18, 2), (8, 18, 2), (6, 18, 4.6)):
        s.box(x, x + 3.6, y, y + 3, z, z + 2.6, mat='wood', tex='plank', role='misc', contour=True)
    for x in (40, 43):
        s.cyl(x, 20, 1.3, 2, 5, mat='rust', tex='plain', role='misc', contour=True)
    # 크레인(놋쇠 데릭)
    s.box(20, 23, 18, 21, 2, 22, mat='brass', tex='plain', role='crane', contour=True).post = lattice(20, 'brass')
    s.add(M.obox((30, 19, 21), (22, 1.4, 1.6), M.rot_y(-.32), mat='brass', tex='plain', role='crane', contour=True))
    s.box(37.6, 38.2, 18.8, 19.4, 10, 24, mat='iron', tex='plain', role='nocast')
    s.box(35.8, 40, 17.6, 20, 7.6, 10, mat='wood', tex='plank', role='misc', contour=True)
    s.box(18, 25, 16.5, 22.5, 2, 4.6, mat='iron', tex='plain', role='crane', contour=True)
    # 외륜 증기선(앞)
    s.add(E.hull(20, 72, -2, 8, 0, 4.6, rise=.6, mat='iron', tex='plain', role='hull', contour=True))
    s.box(21, 69, -2.6, 8.6, 4.6, 5.4, mat='iron', tex='plain', role='hull')
    s.box(28, 61, 0, 7, 5.4, 10, mat='canvas', tex='plain', role='house', contour=True,
          decals=wins(29, 60, 6.8, 8.6, 9, 'lit', w=1.4))
    s.box(27, 62, -.6, 7.6, 10, 11, mat='wood', tex='plain', role='roof', contour=True)
    s.box(35, 51, 1.5, 6, 11, 14, mat='canvas', tex='plain', role='house', contour=True, decals=wins(36, 50, 12, 13.4, 5, 'dark', w=1.2))
    s.box(34.4, 51.6, 1, 6.5, 14, 14.8, mat='wood', tex='plain', role='roof', contour=True)
    for (cx, h) in ((40, 25), (47, 25)):
        s.cyl(cx, 4, 1.6, 14.8, h, mat='cloth', tex='plain', role='nocast', contour=True)
        s.cyl(cx, 4, 1.8, h - 1.4, h, mat='iron', tex='plain', role='nocast', contour=True)
        s.cyl(cx, 4, 1.1, h - .3, h + .05, mat='hole', tex='plain', role='nocast')
    M.steam(s, 41, 4, 27, rs(9), n=3, r0=2.2, rise=2.2, drift=2.4)
    # 외륜(뱃전 앞에 반쯤)
    gear(s, 55, -3.8, 5.6, 6.4, teeth=12, mat='wood', hub='brass', spokes=True)
    s.add(disc_y(55, -4.4, -3.6, 5.6, 1.6, n=8, mat='cloth', role='misc', contour=True))
    return s


def castle():
    """마도 요새: 리벳 철판 성벽 + 둥근 포탑(대포) + 톱니 문장 문 + 굴뚝 달린 본루."""
    s = Scene()
    # 본루(뒤, 높은 기단)
    k = s.box(12, 32, 20, 28, 0, 18, mat='iron', tex='plain', role='keep', contour=True,
              decals=wins(13.5, 30.5, 11.5, 14.5, 4, 'lit', w=1.4))
    k.post = plates()
    s.box(11.6, 32.4, 19.6, 20.8, 16.6, 18, mat='brass', tex='plain', role='keep')
    s.box(11.6, 32.4, 19.6, 28.4, 18, 19.2, mat='iron', tex='plain', role='keep', contour=True)
    s.crenels(12, 32, 20, 28, 19.2, mat='iron', step=2.2, h=1.6, edges=('front',), depth=1.2)
    chimney(s, 28, 25, 1.5, 21, seed=11, puffs=2, pr=2.0, nocast=True)
    s.add(hcyl_x(28.5, 35, 21, 15.5, 1.0, mat='iron', role='misc', contour=True))
    # 옆 벽
    for (a, b) in ((5, 10), (34, 39)):
        w = s.box(a, b, 6, 26, 0, 10, mat='iron', tex='plain', role='wall', contour=True)
        w.post = plates()
    # 앞 성벽 + 문
    w = s.box(7, 37, 4, 9, 0, 9, mat='iron', tex='plain', role='wall', contour=True)
    w.post = plates()
    s.crenels(7, 37, 4, 9, 9, mat='iron', step=2.4, h=1.6, edges=('front',), depth=1.2)
    g = s.box(15, 29, 3, 10, 0, 13, mat='iron', tex='plain', role='gate', contour=True, decals=(('front', (18.5, 25.5, 0, 7, 'gate')),))
    g.post = plates()
    s.box(14.4, 29.6, 2.4, 3.6, 11.8, 13, mat='brass', tex='plain', role='gate')
    s.crenels(15, 29, 3, 10, 13, mat='iron', step=2.3, h=1.5, edges=('front',), depth=1.2)
    gear(s, 22, 2.6, 9.8, 2.8, teeth=8, spokes=False)
    # 둥근 포탑 + 대포
    for (cx, dirn) in ((7, -1), (37, 1)):
        s.cyl(cx, 7, 3.6, 0, 13, mat='iron', tex='plain', role='tower', contour=True).post = M.with_ramp(M.bands(3, 4, 1, -1, ('side',)), 'iron')
        s.cyl(cx, 7, 4.0, 13, 14.2, mat='brass', tex='plain', role='tower', contour=True)
        s.add(M.Dome(cx, 7, 14.2, 2.8, mat='iron', role='tower', contour=True))
        bx0, bx1 = (cx - 5.2, cx - 1) if dirn < 0 else (cx + 1, cx + 5.2)
        s.add(hcyl_x(bx0, bx1, 5.5, 15.6, .9, mat='iron', role='misc' if dirn < 0 else 'nocast', contour=True))
    return s


def castle_b():
    """비행선 기지: 철골 계류탑 + 묶인 비행선 + 반원통 격납고 + 낮은 철책."""
    s = Scene()
    hg = s.add(M.prism_arch(4, 26, 20, 8, N=8, mat='rust', tex='plain', role='house', contour=True))
    hg.post = M.ribs(3, ('front',), mat='rust')
    s.box(10, 18, 11.6, 12.4, 0, 6, mat='hole', tex='plain', role='misc')
    mast(s, 37, 16, 4, 24, nocast=True)
    s.add(ob.Cone(39, 18, 2.4, 25.2, 29, mat='brass', tex='plain', role='nocast', contour=True))
    airship(s, 24, 12, 23, L_=22, R=5.0, nocast=True)
    s.box(35, 38, 15, 16, 22, 23, mat='iron', tex='plain', role='nocast')
    # 앞 철책·초소
    for xx in np.arange(3, 43, 3):
        s.box(xx, xx + .6, 2, 2.6, 0, 4.6, mat='iron', tex='plain', role='misc')
    s.box(3, 43.6, 2, 2.6, 3.6, 4.2, mat='iron', tex='plain', role='misc')
    shed(s, 30, 3, 8, 5, 6, roof='iron', wall='soot', rise=2.6)
    for x in (4, 8):
        s.cyl(x, 6, 1.4, 0, 3.4, mat='copper', tex='plain', role='misc', contour=True)
    return s


def large_town():
    """탄광 마을: 뒤 바위 언덕의 갱도 입구 + 권양탑(큰 바퀴) + 광차 레일 + 함석 오두막."""
    s = Scene()
    rock_mound(s, 13, 28, 11, 8, 15)
    s.box(7, 17, 20, 23, 0, 9, mat='wood', tex='plank', role='house', contour=True, decals=(('front', (9, 15, 0, 7, 'dark')),))
    s.box(6, 18, 19.5, 23.5, 9, 10.2, mat='wood', tex='plain', role='roof', contour=True)
    # 권양탑
    for x in (30, 38):
        s.box(x, x + 1.2, 22, 23.2, 0, 22, mat='iron', tex='plain', role='nocast', contour=True)
    s.add(M.obox((36, 23, 11), (1.0, 1.0, 22), M.rot_y(.45), mat='iron', tex='plain', role='nocast'))
    s.box(29, 40, 21.5, 23.5, 14, 15, mat='iron', tex='plain', role='nocast')
    gear(s, 34.6, 21.2, 23, 4.6, teeth=10, mat='brass', hub='iron', role='nocast')
    shed(s, 30, 25, 10, 6, 7, roof='rust', wall='soot', rise=3)
    chimney(s, 37, 29, 1.0, 14, seed=5, puffs=2, pr=1.6)
    # 레일 + 광차
    rails(s, 6, 41, 12)
    minecart(s, 14, 12.1, 1.0)
    minecart(s, 26, 12.1, 1.0, ore='coal')
    # 오두막
    shed(s, 2, 2, 10, 6, 6, roof='rust', wall='wood', rise=3.2)
    shed(s, 18, 1, 10, 6, 6.5, roof='iron', wall='wood', rise=3.2)
    shed(s, 33, 3, 9, 6, 6, roof='rust', wall='wood', rise=3.2)
    s.cyl(14.5, 2, .4, 0, 7, mat='iron', tex='plain', role='misc')
    s.add(M.Dome(14.5, 2, 7.3, .8, zmin=-99, mat='lavaglow', role='misc'))
    return s


def village():
    """철도역 마을: 시계 단 벽돌 역사 + 놋쇠 기둥 승강장 차양 + 앞 선로의 작은 증기 기관차 + 뒤 오두막."""
    s = Scene()
    shed(s, 1.5, 17, 8, 5, 5, roof='rust', wall='wood', rise=3)
    shed(s, 20.5, 18, 7.5, 4.5, 4.6, roof='iron', wall='soot', rise=2.8, win=False)
    # 역사
    s.box(6, 24, 10, 15, 0, 7, mat='soot', tex='brick', role='house', contour=True,
          decals=(('front', (13.6, 16.4, 0, 4.0, 'door')),) + wins(6.8, 13, 3, 5.2, 2, 'lit', w=1.6) + wins(17, 23.2, 3, 5.2, 2, 'lit', w=1.6))
    s.add(ob.gable(5.2, 24.8, 9.2, 15.8, 7, .85, mat='iron', tex='shingle', role='roof', contour=True))
    s.box(13, 17, 11, 13.5, 7, 11, mat='soot', tex='brick', role='house', contour=True)
    s.add(ob.gable(12.4, 17.6, 10.4, 14.1, 11, 1.1, mat='iron', tex='plain', role='roof', contour=True))
    clock(s, 15, 10.6, 9.0, 1.4)
    # 승강장 + 차양
    s.box(3, 27, 5, 10, 0, 1.2, mat='stone', tex='brick', role='misc', contour=True)
    for px in (5, 11, 19, 25):
        s.box(px - .4, px + .4, 6, 6.8, 1.2, 5.4, mat='brass', tex='plain', role='misc')
    s.box(3.6, 26.4, 5.4, 9.6, 5.4, 6.2, mat='rust', tex='plain', role='roof', contour=True)
    # 선로 + 기관차
    rails(s, 1.5, 27.5, 1.2)
    s.box(14, 27, 1.0, 4.4, 1.0, 2.6, mat='iron', tex='plain', role='misc', contour=True)
    s.add(hcyl_x(14.4, 22, 2.7, 4.5, 2.0, mat='iron', role='misc', contour=True))
    s.add(hcyl_x(18, 18.8, 2.7, 4.5, 2.2, mat='brass', role='misc'))
    s.add(disc_y(14.2, 1.0, 1.4, 4.5, 1.4, n=10, mat='steel', role='misc'))
    s.box(22, 26.8, 1.0, 4.4, 2.6, 7.4, mat='cloth', tex='plain', role='misc', contour=True, decals=(('front', (22.8, 26, 4.6, 6.4, 'lit')),))
    s.box(21.6, 27.2, .6, 4.8, 7.4, 8.2, mat='iron', tex='plain', role='roof', contour=True)
    s.cyl(16, 2.7, .9, 6, 9.2, mat='iron', tex='plain', role='misc', contour=True)
    s.cyl(16, 2.7, 1.3, 8.6, 9.4, mat='brass', tex='plain', role='misc')
    M.steam(s, 14.6, 2.7, 10.8, rs(4), n=2, r0=1.6, rise=1.6, drift=1.6)
    for wx in (16, 19.5, 22.5, 25.5):
        s.add(disc_y(wx, .6, 1.0, 1.7, 1.3, n=10, mat='cloth', role='misc', contour=True))
    return s


def village_b():
    """풍차·톱니 공방 마을: 벽돌 풍차(놋쇠 날개) + 큰 톱니를 단 공방과 굴뚝 + 오두막."""
    s = Scene()
    # 풍차
    s.add(_fr(M.Frustum(11.5, 16, 4.2, 3.0, 0, 13, mat='soot', tex='brick', role='tower', contour=True,
                    decals=(('side', (-90, 1.0, 0, 3.4, 'dark')), ('side', (-90, .8, 7, 9, 'lit'))))))
    s.add(ob.Cone(11.5, 16, 3.7, 13, 16.5, mat='copper', tex='plain', role='roof', contour=True))
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        c = (11.5 + 4.4 * math.cos(a), 11.5, 12 + 4.4 * math.sin(a))
        s.add(M.obox(c, (8.4, .5, 2.2), M.rot_y(-a), mat='brass', tex='plain', role='misc', contour=True))
    s.add(disc_y(11.5, 11, 12.4, 12, 1.1, n=8, mat='iron', role='misc', contour=True))
    # 공방
    s.box(17, 26.5, 6, 13, 0, 7.5, mat='soot', tex='brick', role='house', contour=True,
          decals=(('front', (18.5, 21, 0, 3.6, 'door')),) + wins(21.5, 26, 3.6, 5.4, 2, 'lit', w=1.6))
    s.add(ob.gable(16.4, 27.1, 5.2, 13.8, 7.5, .7, mat='rust', tex='shingle', role='roof', contour=True))
    gear(s, 23.4, 5.2, 9.0, 3.0, teeth=8, mat='brass', spokes=False)
    chimney(s, 19.5, 11, 1.1, 13, seed=2, puffs=2, pr=1.6)
    shed(s, 1.5, 1.5, 8, 5, 4.6, roof='rust', wall='wood', rise=2.6)
    s.box(10, 13, .5, 3, 0, 2.4, mat='wood', tex='plank', role='misc', contour=True)
    return s


def camp():
    """조사단 캠프: 범포 천막 둘 + 증기 기관 발전기(보일러·플라이휠·굴뚝) + 상자."""
    s = Scene()
    s.add(M.tent_ridge_y(1, 11, 10, 18, 7, mat='canvas'))
    s.add(M.tent_ridge_y(13, 21, 13, 19, 5.6, mat='canvas'))
    # 발전기
    s.box(14, 28, 1, 7, 0, 1.6, mat='iron', tex='plain', role='misc', contour=True)
    s.add(hcyl_x(15.6, 24, 4, 4.4, 2.6, mat='copper', role='misc', contour=True))
    for bx in (18, 22):
        s.add(hcyl_x(bx, bx + .7, 4, 4.4, 2.9, mat='brass', role='misc'))
    gear(s, 26.0, 1.0, 5.0, 3.2, teeth=8, mat='iron', hub='brass')
    s.cyl(17.5, 4, .9, 6, 11, mat='iron', tex='plain', role='misc', contour=True)
    M.steam(s, 17.2, 4, 12.4, rs(6), n=2, r0=1.8, rise=1.8, drift=1.6)
    # 상자·깃발
    s.box(3, 7, 2, 5.4, 0, 3, mat='wood', tex='plank', role='misc', contour=True)
    s.box(7.4, 10.4, 2.4, 5, 0, 2.2, mat='wood', tex='plank', role='misc', contour=True)
    s.box(1, 1.7, 3, 3.7, 0, 13, mat='iron', tex='plain', role='misc')
    s.box(1.7, 6, 3, 3.6, 9.6, 12.6, mat='cloth', tex='plain', role='misc')
    return s


def tower_small():
    """증기 굴뚝 탑: 놋쇠 띠를 두른 벽돌 원뿔대 + 꼭대기 증기."""
    s = Scene()
    s.box(1, 12, 0, 6, 0, 3, mat='iron', tex='plain', role='misc', contour=True).post = plates(px=4)
    s.add(_fr(M.Frustum(6.5, 3, 4.0, 2.6, 3, 20, mat='soot', tex='brick', role='nocast', contour=True,
                        decals=(('side', (-90, .7, 7, 9, 'lit')), ('side', (-90, .7, 13, 15, 'lit'))))))
    for z in (5.5, 11, 16.5):
        s.cyl(6.5, 3, 4.1 - (z - 3) * .08, z, z + .9, mat='brass', tex='plain', role='nocast')
    s.cyl(6.5, 3, 3.1, 19.4, 21, mat='iron', tex='plain', role='nocast', contour=True)
    s.cyl(6.5, 3, 2.2, 20.6, 21.05, mat='hole', tex='plain', role='nocast')
    M.steam(s, 6.5, 3, 22.2, rs(3), n=2, r0=1.7, rise=1.6, drift=1.2)
    return s


def tower_great():
    """거대 시계탑: 검댕 벽돌 몸통 3단 + 앞 큰 시계판 + 톱니 + 구리 돔과 첨탑."""
    s = Scene()
    cx, y = 14, 4
    s.box(cx - 13, cx + 13, y - 2, y + 10, 0, 4, mat='iron', tex='plain', role='keep', contour=True).post = plates()
    s.box(cx - 10.5, cx + 10.5, y, y + 8, 4, 20, mat='soot', tex='brick', role='nocast', contour=True,
          decals=(('front', (cx - 2, cx + 2, 4, 9, 'gate')),) + wins(cx - 9.5, cx + 9.5, 12, 15.5, 5, 'lit', w=1.4))
    s.box(cx - 11.5, cx + 11.5, y - 1, y + 9, 20, 21.4, mat='brass', tex='plain', role='nocast', contour=True)
    s.box(cx - 8.5, cx + 8.5, y + .5, y + 7.5, 21.4, 37, mat='soot', tex='brick', role='nocast', contour=True,
          decals=wins(cx - 6, cx + 6, 22.6, 25, 3, 'dark', w=1.2))
    clock(s, cx, y + .2, 31, 5.0, role='nocast')
    gear(s, cx - 6.4, y - .1, 23.6, 2.0, teeth=7, spokes=False, role='nocast')
    gear(s, cx + 6.4, y - .1, 23.6, 2.0, teeth=7, spokes=False, role='nocast')
    s.box(cx - 8.5, cx + 8.5, y - .5, y + 8.5, 37, 38.4, mat='brass', tex='plain', role='nocast', contour=True)
    s.box(cx - 5.5, cx + 5.5, y + 1.5, y + 6.5, 38.4, 42.4, mat='soot', tex='brick', role='nocast', contour=True,
          decals=wins(cx - 4, cx + 4, 39.4, 41.6, 2, 'lit', w=1.2))
    s.add(M.Dome(cx, y + 4, 42.4, 5.2, mat='copper', role='nocast', contour=True))
    s.cyl(cx, y + 4, .8, 46, 52, mat='brass', tex='plain', role='nocast')
    s.add(M.Dome(cx, y + 4, 50.5, 1.3, zmin=-99, mat='brass', role='nocast'))
    return s


def cave():
    """광산 갱도 입구: 바위산 + 버팀목 갱도 + 밖으로 나온 레일과 광차 + 등불."""
    s = Scene()
    s.add(E.oct_pyr(15, 13, 13, 0, 24, ztrunc=17, mat='rock', tex='speck', role='wall', contour=True))
    s.add(E.oct_pyr(4.5, 10, 5, 0, 10, ztrunc=7, mat='rock', tex='speck', role='wall', contour=True))
    s.box(9, 21, 3, 6, 0, 10, mat='wood', tex='plain', role='gate', contour=True, decals=(('front', (11, 19, 0, 8.4, 'arch')),))
    s.box(8, 22, 2.5, 6.5, 10, 11.4, mat='wood', tex='plank', role='gate', contour=True)
    for x in (9, 19.8):
        s.box(x, x + 1.2, 2.2, 3.2, 0, 10, mat='wood', tex='plain', role='misc')
    for yy in np.arange(-3, 3, 2.0):
        s.box(12, 18.4, yy, yy + .9, 0, .5, mat='wood', tex='plain', role='nocast')
    for xx in (13, 17.2):
        s.box(xx - .25, xx + .25, -3, 3, .5, 1.0, mat='iron', tex='plain', role='nocast')
    minecart(s, 21.5, -2, .2, w=4.4)
    s.cyl(6.5, 1, .35, 0, 7, mat='iron', tex='plain', role='misc')
    s.add(M.Dome(6.5, 1, 7.3, .9, zmin=-99, mat='lavaglow', role='misc'))
    return s


def ruin():
    """추락한 비행선 잔해: 주저앉은 기낭(놋쇠 이음) + 찢겨 뼈대만 남은 뒤쪽 갈비뼈 아치 + 꺾인 꼬리 날개 + 부서진 곤돌라·불씨·검은 연기."""
    s = Scene()
    env = s.add(CEllip(9.5, 13, 0, 9.5, 5.5, 6.0, zmin=0, mat='sand', tex='plain', role='misc', contour=True))
    br = ob.MAT['brass']

    def post(tag, P, col, sh, nrm):
        u = (P[:, 0] - 0) / 19 * 5
        m = np.mod(u, 1.0) < .2
        return np.where(m[:, None], ob._darken(br, sh, 0), col).astype(np.uint8)
    env.post = post
    # 뼈대만 남은 뒤쪽: 갈비뼈 아치(앞에서 보면 ∩)
    for k, x in enumerate((19, 22.3, 25.4)):
        h = (6.0, 4.8, 3.4)[k]
        hw = (2.6, 2.2, 1.8)[k]
        for side in (-1, 1):
            s.add(M.obox((x + side * hw, 11, h * .45), (.8, .8, h * .9), M.rot_y(side * .25), mat='brass', tex='plain', role='misc', contour=True))
        s.box(x - hw, x + hw, 10.6, 11.4, h * .85, h * .85 + .8, mat='brass', tex='plain', role='misc', contour=True)
    s.add(M.obox((21.5, 11, .4), (9, .8, .8), None, mat='brass', tex='plain', role='misc'))
    s.add(M.obox((1.4, 12, 7.0), (4.4, .8, 4.4), M.rot_y(.5), mat='cloth', tex='plain', role='misc', contour=True))
    s.add(M.obox((16.5, 3.6, 2.4), (9, 3.0, 3.4), M.rot_y(-.25), mat='wood', tex='plank', role='house', contour=True))
    s.box(14, 16, 1.9, 2.3, 1.8, 3.2, mat='hole', tex='plain', role='misc')
    s.box(17.8, 19.2, 1.8, 2.2, 2.6, 3.8, mat='lavaglow', tex='plain', role='misc')
    s.add(disc_y(24, 2, 2.6, 2.2, 1.9, n=6, mat='iron', role='misc', contour=True))
    s.add(M.obox((24, 1.8, 2.2), (5.0, .5, 1.0), M.rot_y(.9), mat='brass', tex='plain', role='misc', contour=True))
    M.rubble(s, rs(5), 2, 12, -2, 1.5, n=3, hmax=1.2, mats=('rust', 'wood', 'iron'))
    M.steam(s, 18, 6, 9.0, rs(2), n=3, r0=1.7, rise=1.9, drift=1.4, mat='coal')
    return s


def ruin_city():
    """마도 폭주로 무너진 공장 지대: 부서진 벽돌 공장·쓰러진 굴뚝·꺾인 관 + 터져 나온 마석 결정."""
    s = Scene()
    s.add(M.broken(2, 22, 22, 30, 16, tilts=((.4, .1), (-.6, -.1)), drops=(0, 5), mat='soot', tex='brick', role='wall', contour=True,
                   decals=wins(3, 21, 6, 9, 5, 'dark', w=1.6)))
    s.add(M.broken(38, 60, 22, 30, 13, tilts=((-.5, 0), (.5, .1)), drops=(0, 4), mat='soot', tex='brick', role='wall', contour=True,
                   decals=wins(39, 59, 5, 8, 5, 'dark', w=1.6)))
    s.cyl(28, 26, 2.4, 0, 18, mat='soot', tex='brick', role='tower', contour=True)
    s.add(M.broken(25.6, 30.4, 23.6, 28.4, 19, tilts=((.6, 0),), drops=(0,), mat='soot', tex='brick', role='tower', contour=True))
    # 쓰러진 굴뚝
    s.add(hcyl_x(30, 54, 14, 2.6, 2.4, mat='soot', role='misc', contour=True, tex='brick'))
    s.add(hcyl_x(52, 54.6, 14, 2.6, 2.8, mat='brass', role='misc'))
    # 꺾인 관
    s.add(M.obox((14, 14, 6), (14, 1.6, 1.6), M.rot_y(-.35), mat='copper', tex='plain', role='misc', contour=True))
    vpipe(s, 7.6, 14, 0, 4.4)
    # 마석 결정 (폭주)
    for (x, y, h, w) in ((28, 9, 12, 3.0), (24, 7, 7, 2.0), (32.5, 8, 8, 2.2), (46, 5, 6, 1.8), (10, 4, 5, 1.6)):
        magicite(s, x, y, h, w=w)
    M.rubble(s, rs(7), 2, 62, 0, 12, n=9, hmax=2.0, mats=('soot', 'rust', 'iron'))
    M.steam(s, 44, 26, 15, rs(3), n=2, r0=2.0, rise=2.0, drift=2.0, mat='coal')
    return s


def shrine():
    """마도 연구소: 벽돌 기단 건물 + 놋쇠 테 유리 돔 + 테슬라 코일 둘 + 증기관."""
    s = Scene()
    s.box(4, 44, 6, 22, 0, 3, mat='iron', tex='plain', role='misc', contour=True).post = plates()
    s.box(8, 40, 9, 20, 3, 12, mat='soot', tex='brick', role='house', contour=True,
          decals=(('front', (21.6, 26.4, 3, 8, 'gate')),) + wins(9.5, 20, 6.5, 9, 3, 'lit', w=1.6) + wins(28, 38.5, 6.5, 9, 3, 'lit', w=1.6))
    s.box(7.4, 40.6, 8.4, 9.6, 10.8, 12, mat='brass', tex='plain', role='house')
    s.box(7.4, 40.6, 8.4, 20.6, 12, 13.2, mat='iron', tex='plain', role='house', contour=True)
    dm = s.add(M.Dome(24, 15, 13.2, 9.2, mat='glass', role='roof', contour=True))
    dm.post = M.dome_ribs(n_lon=10, mat='brass')(dm)
    s.add(M.Dome(24, 15, 13.2, 4.0, mat='magiglow', role='misc'))
    s.cyl(24, 15, .7, 21.8, 25, mat='brass', tex='plain', role='misc')
    coil(s, 4.5, 3, 13, r=1.4)
    coil(s, 43.5, 3, 13, r=1.4)
    pipe_run(s, 5.5, 8, 4, 6, r=.7)
    pipe_run(s, 40, 42.5, 4, 6, r=.7)
    return s


def landmark_nature():
    """톱니 유적 바위산: 바위산 앞 비탈에 반쯤 묻힌 거대한 녹슨 톱니바퀴 + 꺾인 관."""
    s = Scene()
    s.add(E.oct_pyr(21, 17, 16, 0, 34, ztrunc=27, mat='stone', tex='speck', role='wall', contour=True))
    s.add(E.oct_pyr(33, 15, 9, 0, 22, ztrunc=17, mat='stone', tex='speck', role='wall', contour=True))
    s.add(E.oct_pyr(8, 12, 7, 0, 14, ztrunc=10, mat='stone', tex='speck', role='wall', contour=True))
    gear(s, 19, 3.2, 14, 10, teeth=12, mat='copper', hub='iron', spokes=True, rot=.12)
    s.add(M.obox((34, 6, 11), (1.6, 1.6, 9), M.rot_y(.5), mat='copper', tex='plain', role='misc', contour=True))
    s.add(CEllip(38, 3, 0, 4, 2.6, 2.6, mat='stone', tex='speck', role='misc', contour=True))
    s.add(CEllip(5, 3, 0, 3, 2.2, 2.0, mat='stone', tex='speck', role='misc', contour=True))
    return s


def landmark_magi():
    """마석 수정 언덕: 바위 언덕을 뚫고 솟은 보랏빛 마석 결정 무리."""
    s = Scene()
    rock_mound(s, 23, 14, 21, 9, 10)
    for (x, y, h, w) in ((23, 12, 22, 4.4), (16, 10, 15, 3.2), (30, 11, 17, 3.4), (10, 8, 9, 2.4), (36, 7, 10, 2.6), (20, 5, 7, 2.2), (28, 4, 6, 2.0)):
        magicite(s, x, y, h, w=w, z0=2.0)
    s.add(CEllip(42, 3, 0, 3, 2, 2.4, mat='rock', tex='speck', role='misc', contour=True))
    return s


def circle():
    """마석 원: 놋쇠 받침 위 빛나는 수정 기둥 다섯 + 가운데 떠 있는 마석."""
    s = Scene()
    s.cyl(15, 9, 12, 0, 1.2, mat='iron', tex='plain', role='misc', contour=True)
    s.cyl(15, 9, 10.5, 1.2, 1.6, mat='brass', tex='plain', role='misc')
    for k in range(5):
        a = math.radians(90 + 72 * k)
        x, y = 15 + 10 * math.cos(a), 9 + 6.6 * math.sin(a)
        s.cyl(x, y, 1.6, 1.6, 3.0, mat='brass', tex='plain', role='misc', contour=True)
        magicite(s, x, y, 7 + (k % 2) * 2, w=1.8, z0=3.0)
    s.add(M.obox((15, 9, 10), (3.2, 3.2, 3.2), M.rot_x(.6) @ M.rot_y(.785), mat='magiglow', tex='plain', role='nocast', contour=True))
    return s


def volcano():
    """지열 증기 화산: 현무암 화산 + 화구에 꽂힌 구리 관 셋 + 증기 + 비탈 펌프 오두막."""
    s = Scene()
    s.add(E.oct_pyr(14, 11.5, 12, 0, 19, ztrunc=11.5, mat='basalt', tex='speck', role='wall', contour=True))
    s.add(E.Ellip(14, 11, 11.7, 5.4, 4.0, .8, mat='lavaglow', tex='speck', role='misc'))
    for (x, h) in ((10.8, 15), (14, 16.5), (17.2, 14)):
        vpipe(s, x, 10, 9, h, r=.9)
        s.cyl(x, 10, 1.3, h - .8, h, mat='brass', tex='plain', role='misc')
    M.steam(s, 14, 10, 18.0, rs(1), n=2, r0=1.8, rise=1.6, drift=1.6)
    s.add(M.obox((20.5, 4, 5.5), (9, 1.3, 1.3), M.rot_y(.75), mat='copper', tex='plain', role='misc', contour=True))
    s.box(20, 26.5, 0, 4, 0, 4.6, mat='soot', tex='brick', role='house', contour=True, decals=(('front', (22.2, 24.3, 0, 3.0, 'lit')),))
    s.add(ob.gable(19.5, 27, -.6, 4.6, 4.6, .8, mat='iron', tex='shingle', role='roof', contour=True))
    return s


def floating():
    """부유 대륙: 거꾸로 선 바위섬 + 밑의 마석 부유석 + 양끝 프로펠러 + 위의 벽돌 마을과 시계탑."""
    s = Scene()
    xc, yc = 39, 18
    s.add(E.InvCone(xc, yc, 26, 0, 14, mat='rock', tex='speck', role='wall', contour=True))
    s.add(E.Ellip(xc, yc, 14.2, 28, 16, 2.4, mat='leaf2', tex='speck', role='ground', contour=True))
    for (x, y, h) in ((xc - 6, yc - 6, 6), (xc + 5, yc - 7, 5), (xc, yc - 9, 4)):
        s.box(x - 1.2, x + 1.2, y - 1.2, y + 1.2, 6 - h, 6, mat='magiglow', tex='plain', role='misc', contour=True)
    s.add(E.InvCone(xc, yc - 6, 2.4, -5, 2, mat='magiglow', tex='plain', role='misc', contour=True))
    # 프로펠러 붐
    for (bx, dirn) in ((xc - 27, -1), (xc + 27, 1)):
        x0, x1 = (bx - 3, bx + 6) if dirn < 0 else (bx - 6, bx + 3)
        s.add(hcyl_x(x0, x1, yc - 4, 10, 1.6, mat='iron', role='misc', contour=True))
        px = bx - 2 if dirn < 0 else bx + 2
        s.add(disc_y(px, yc - 6, yc - 5, 10, 1.4, n=8, mat='brass', role='misc', contour=True))
        for a in (.5, -.5 + math.pi / 2 * 0 + math.pi * .5):
            s.add(M.obox((px, yc - 6.2, 10), (11, .5, 1.4), M.rot_y(a), mat='brass', tex='plain', role='misc', contour=True))
    zb = 15.4
    # 시계탑
    s.box(xc - 5, xc + 5, yc + 2, yc + 9, zb, zb + 22, mat='soot', tex='brick', role='nocast', contour=True,
          decals=wins(xc - 3.5, xc + 3.5, zb + 6, zb + 9, 2, 'lit', w=1.4))
    clock(s, xc, yc + 1.8, zb + 16.5, 3.4)
    s.add(M.Dome(xc, yc + 5.5, zb + 22, 4.4, mat='copper', role='nocast', contour=True))
    s.cyl(xc, yc + 5.5, .6, zb + 25, zb + 30, mat='brass', tex='plain', role='nocast')
    # 집·공장(섬 윗면 높이로 올린다)
    p0 = len(s.prims)
    factory(s, xc - 23, yc + 1, 14, 7, 8, bays=2)
    shed(s, xc - 20, yc - 8, 9, 5, 5.5, roof='rust', wall='soot', rise=3)
    shed(s, xc + 9, yc - 7, 10, 5, 5.5, roof='iron', wall='soot', rise=3)
    shed(s, xc + 12, yc + 3, 9, 5, 6, roof='rust', wall='soot', rise=3)
    chimney(s, xc - 11, yc + 6, 1.2, 14, seed=4, puffs=2, pr=1.8)
    for p in s.prims[p0:]:
        _lift(p, zb)
    for p in s.prims:
        if p.role != 'steam':
            p.role = 'nocast'
    return s


def _fr(p):
    p.r = p.r0
    return p


def _lift(p, dz):
    """입체를 dz 만큼 올린다."""
    if isinstance(p, Poly):
        p.d = p.d + p.n[:, 2] * dz
    elif isinstance(p, (ob.Cyl, M.Frustum)):
        p.z0 += dz
        p.z1 += dz
        if getattr(p, 'zc', None) is not None:
            p.zc += dz
    elif isinstance(p, ob.Cone):
        p.z0 += dz
        p.zt += dz
    elif hasattr(p, 'c'):
        p.c = p.c + np.array([0, 0, dz])
        if hasattr(p, 'zmin'):
            p.zmin += dz


ORDER = [
    ('capital', '마도 제국 수도', 'capital', (6, 6), '시계탑·공장 굴뚝·비행선 정박탑·놋쇠 돔 관청·철판 성벽'),
    ('fort_city', '공업 도시', 'fort_city', (4, 4), '톱날 지붕 벽돌 공장·굴뚝 넷·가스 탱크·구리 증기관·철문'),
    ('harbor_city', '증기선 항구', 'harbor_city', (5, 4), '외륜 증기선·놋쇠 크레인·벽돌 창고·나무 부두'),
    ('castle', '마도 요새', 'castle', (3, 3), '리벳 철판 성벽·대포 포탑·톱니 문장 문·굴뚝 본루'),
    ('castle', '비행선 기지', 'castle_b', (3, 3), '철골 계류탑·묶인 비행선·반원통 격납고·철책'),
    ('large_town', '탄광 마을', 'large_town', (3, 3), '갱도 입구·권양탑 바퀴·광차 레일·함석 오두막'),
    ('village', '철도역 마을', 'village', (2, 2), '시계 단 작은 역사·선로·증기 기관차'),
    ('village', '풍차 공방 마을', 'village_b', (2, 2), '벽돌 풍차·톱니 공방·굴뚝'),
    ('camp', '조사단 캠프', 'camp', (2, 2), '범포 천막 둘·증기 기관 발전기·상자'),
    ('tower_small', '증기 굴뚝 탑', 'tower_small', (1, 2), '놋쇠 띠 벽돌 굴뚝탑과 증기'),
    ('tower_great', '거대 시계탑', 'tower_great', (2, 4), '3단 벽돌 탑·큰 시계판·톱니·구리 돔 첨탑'),
    ('cave', '광산 갱도', 'cave', (2, 2), '바위산·버팀목 갱도·레일·광차·등불'),
    ('ruin', '추락한 비행선', 'ruin', (2, 2), '꺾인 갈비뼈·찢긴 기낭·기운 곤돌라·연기'),
    ('ruin_city', '폭주 공장 지대', 'ruin_city', (4, 3), '무너진 공장·쓰러진 굴뚝·꺾인 관·터져 나온 마석'),
    ('shrine', '마도 연구소', 'shrine', (3, 3), '벽돌 연구동·유리 돔·테슬라 코일'),
    ('landmark_nature', '톱니 유적 바위산', 'landmark_nature', (3, 3), '바위산에 반쯤 묻힌 거대 녹슨 톱니'),
    ('landmark_nature', '마석 수정 언덕', 'landmark_magi', (3, 3), '바위 언덕을 뚫은 보랏빛 마석 결정 무리'),
    ('circle', '마석 원', 'circle', (2, 2), '놋쇠 받침의 수정 기둥 다섯·떠 있는 마석'),
    ('volcano', '지열 증기 화산', 'volcano', (2, 2), '화구에 꽂힌 구리 관·증기·펌프 오두막'),
    ('floating', '부유 대륙', 'floating', (5, 4), '바위섬·마석 부유석·프로펠러·벽돌 마을과 시계탑'),
]
