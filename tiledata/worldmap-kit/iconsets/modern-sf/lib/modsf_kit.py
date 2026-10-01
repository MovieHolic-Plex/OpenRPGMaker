"""현대·SF 아이콘용 입체·재질·부품. oblique.py(경사 투영 레이캐스터)에 덧붙인다 — 렌더러 규칙은 건드리지 않는다.

월드 좌표: x 오른쪽, y 안쪽(뒤), z 위. 1 단위 = 화면 1px = 1m.  보이는 면은 윗면·앞면(y−)·오른쪽면(x+) 뿐.
색: 원본 EasyRPG World.png 의 색 + EXTRA(세트 전용 보조색 ≤12, manifest 에 16진수로 명시).
"""
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import numpy as np  # noqa: E402
import oblique as ob  # noqa: E402
from oblique import Prim, Poly, Scene, box, render, finish, hsh, INF  # noqa: E402
from icons_v9_lib import (STONE, GREY, WSTONE, ROCK, RED, WOOD, LEAF, GOLD, BLUE, SNOW, WATER, SAND, LAVA, VOLC,  # noqa: E402
                          KEY, SHADOW, hx)

# ── 세트 전용 보조색(≤12) ────────────────────────────────────────────────────────────────────
EXTRA_HEX = ['2c3440', '4a5668', '6e7c90', '9aa8ba', 'c6d2de',      # 강철 5단(차가운 회색 금속)
             '0d2147',                                                # 유리·태양광 가장 어두운 남색
             '3b6a9c', '8fc0e4',                                      # 유리 중간·밝음(채도 낮은 청회색)
             '2ae0d8',                                                # 네온 청록(추진기·표지등)
             'ffe28a',                                                # 켜진 창
             'f0a030']                                                # 산업 주황(크레인·컨테이너·경고 띠)
STEEL = [hx(c) for c in EXTRA_HEX[:5]]
NAVY, GLASS_M, GLASS_L, NEON, LITWIN, ORANGE = [hx(c) for c in EXTRA_HEX[5:]]

ob.MAT.update({
    'concrete': STEEL,
    'steel': [STONE[0], STONE[1], STONE[2], STONE[4], STONE[5], STONE[6]],
    'oldgrey': [GREY[1], GREY[2], GREY[3], GREY[4], GREY[5]],
    'orange': [ROCK[2], GOLD[1], GOLD[2], GOLD[3], ORANGE, LITWIN],
    'glass': [NAVY, BLUE[1], GLASS_M, GLASS_L, SNOW[3]],
    'solar': [NAVY, BLUE[1], BLUE[2], GLASS_M, GLASS_L],
    'white': [STONE[3], STONE[5], SNOW[3], SNOW[4], SNOW[5]],
    'cred': [RED[0], RED[1], RED[2], RED[3], RED[4], RED[5]],
    'cblue': [BLUE[0], BLUE[1], BLUE[2], BLUE[3], BLUE[4]],
    'cgreen': [LEAF[0], LEAF[1], LEAF[2], LEAF[3], LEAF[4], LEAF[5]],
    'cyellow': [GOLD[1], GOLD[2], GOLD[3], ORANGE, LITWIN],
    'rust': [ROCK[0], ROCK[1], ROCK[2], ROCK[3], ROCK[5], ROCK[7]],
    'roofred': [RED[1], RED[2], RED[3], RED[4], RED[5]],
    'roofgrey': [STONE[1], STONE[2], STONE[3], STONE[4], STONE[5]],
    'asphalt': [GREY[0], GREY[1], STONE[1], STONE[2]],
    'neon': [NEON, NEON, NEON, NEON],
    'cwater': [BLUE[1], BLUE[2], BLUE[2], BLUE[3], BLUE[3]],
    'cloud': [SNOW[1], SNOW[2], SNOW[3], SNOW[4], SNOW[5]],
    'dirtg': [ROCK[3], ROCK[4], ROCK[5], ROCK[6], ROCK[7]],
    'rock': [ROCK[1], ROCK[2], ROCK[3], ROCK[4], ROCK[5], ROCK[6]],
    'leafm': [LEAF[1], LEAF[2], LEAF[3], LEAF[4], LEAF[5]],
    'plaster': [WSTONE[1], WSTONE[2], WSTONE[3], WSTONE[4], WSTONE[5]],
    'plastbl': [STONE[2], STONE[3], STONE[4], STONE[5], STONE[6]],
})


# ═══════════════════════════ 새 입체 ═══════════════════════════════════════════════════════
class Dome(Prim):
    """반구(또는 구). zmin 아래는 잘라낸다(밑은 받침이 가린다)."""

    def __init__(self, xc, yc, zc, r, zmin=None, mat='white', tex='plain', role='misc', contour=True, decals=()):
        self.c = np.array([xc, yc, zc], float)
        self.r = r
        self.zmin = zc if zmin is None else zmin
        self.mat, self.tex, self.role, self.contour, self.decals = mat, tex, role, contour, decals
        self.post = None

    def ray(self, O, D):
        oc = O - self.c[None, :]
        a = float(D @ D)
        b = 2 * (oc @ D)
        c = (oc * oc).sum(1) - self.r ** 2
        disc = b * b - 4 * a * c
        ok = disc >= 0
        sq = np.sqrt(np.where(ok, disc, 0))
        t1 = (-b - sq) / (2 * a)
        z1 = O[:, 2] + t1 * D[2]
        ok &= z1 >= self.zmin
        return np.where(ok, t1, INF), np.zeros(len(O), int)

    def normal(self, face, P_):
        return (P_ - self.c[None, :]) / self.r

    def tag_of(self, face):
        return np.array(['dome'], dtype=object)[face]


class Frustum(Prim):
    """원뿔대(반지름이 z 에 따라 선형으로 바뀐다). r0@z0 → r1@z1. 위가 좁으면 탑, 위가 넓으면 깔때기·냉각탑 아래 뿌리."""

    def __init__(self, xc, yc, r0, r1, z0, z1, mat='concrete', tex='plain', role='misc', contour=False, decals=()):
        self.xc, self.yc, self.r0, self.r1, self.z0, self.z1 = xc, yc, r0, r1, z0, z1
        self.m = (r1 - r0) / (z1 - z0)
        self.zc = z0 - r0 / self.m if abs(self.m) > 1e-9 else None
        self.mat, self.tex, self.role, self.contour, self.decals = mat, tex, role, contour, decals
        self.post = None

    def ray(self, O, D):
        dx, dy = O[:, 0] - self.xc, O[:, 1] - self.yc
        if self.zc is None:                                   # 원통
            r = self.r0
            a = D[0] ** 2 + D[1] ** 2
            b = 2 * (dx * D[0] + dy * D[1])
            c = dx * dx + dy * dy - r * r
        else:
            m2 = self.m ** 2
            g = O[:, 2] - self.zc
            a = D[0] ** 2 + D[1] ** 2 - m2 * D[2] ** 2
            b = 2 * (dx * D[0] + dy * D[1]) - 2 * m2 * g * D[2]
            c = dx * dx + dy * dy - m2 * g * g
        disc = b * b - 4 * a * c
        ok = disc >= 0
        sq = np.sqrt(np.where(ok, disc, 0))
        ta = (self.z0 - O[:, 2]) / D[2]
        tb = (self.z1 - O[:, 2]) / D[2]
        s_in, s_out = np.minimum(ta, tb), np.maximum(ta, tb)
        if abs(a) < 1e-12:
            return np.full(len(O), INF), np.zeros(len(O), int)
        t1, t2 = (-b - sq) / (2 * a), (-b + sq) / (2 * a)
        lo, hi = np.minimum(t1, t2), np.maximum(t1, t2)
        if a > 0:
            enter = np.maximum(lo, s_in)
            exit_ = np.minimum(hi, s_out)
            ok &= enter <= exit_
            face = np.where(lo >= s_in, 0, np.where(D[2] < 0, 1, 2))
            return np.where(ok, enter, INF), face
        # a<0: 원뿔 안쪽은 (-inf, lo] 와 [hi, inf) 두 조각 — 슬랩으로 각각 자른다
        eA, xA = s_in, np.minimum(lo, s_out)
        eB, xB = np.maximum(hi, s_in), s_out
        vA, vB = ok & (eA <= xA), ok & (eB <= xB)
        enter = np.where(vA, eA, eB)
        ok = vA | vB
        capface = np.where(D[2] < 0, 1, 2)
        faceA = np.where(lo <= s_in, capface, 0)
        faceB = np.where(hi >= s_in, 0, capface)
        face = np.where(vA, faceA, faceB)
        return np.where(ok, enter, INF), face

    def normal(self, face, P_):
        n = np.zeros((len(face), 3))
        s = face == 0
        n[s, 0] = P_[s, 0] - self.xc
        n[s, 1] = P_[s, 1] - self.yc
        if self.zc is not None:
            n[s, 2] = -(self.m ** 2) * (P_[s, 2] - self.zc)
        nn = np.linalg.norm(n, axis=1)
        nn[nn == 0] = 1
        n = n / nn[:, None]
        n[face == 1] = (0, 0, 1)
        n[face == 2] = (0, 0, -1)
        return n

    def tag_of(self, face):
        return np.array(['side', 'top', 'bottom'], dtype=object)[face]


def rot_x(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])


def rot_y(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


def rot_z(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


def obox(c, size, R=None, **kw):
    """회전한 직육면체. c=중심, size=(sx,sy,sz) 전체 길이, R=열이 축인 3x3 회전."""
    R = np.eye(3) if R is None else R
    c = np.array(c, float)
    planes = []
    for i, nm in enumerate(('x', 'y', 'z')):
        n = R[:, i]
        h = size[i] / 2
        planes.append((tuple(n), float(n @ c + h), '+' + nm))
        planes.append((tuple(-n), float(-n @ c + h), '-' + nm))
    return Poly(planes, **kw)


def prism_arch(x0, x1, yc, R, N=6, z0=0.0, **kw):
    """x 방향으로 누운 반원통(격납고): 단면을 N 각형으로 근사한 볼록 다면체."""
    planes = [((-1, 0, 0), -x0, 'left'), ((1, 0, 0), x1, 'right'), ((0, 0, -1), -z0, 'bottom')]
    for k in range(N + 1):
        ph = math.pi * k / N
        n = (0.0, math.cos(ph), math.sin(ph))
        planes.append((n, n[1] * yc + R + n[2] * z0, 'arch'))
    return Poly(planes, **kw)


def wedge_hull(x0, x1, y0, y1, z0, z1, bow=4.0, **kw):
    """뱃머리(오른쪽 x1 끝)가 뾰족한 선체 판: 위에서 보면 오각형 — 볼록 다면체."""
    ym = (y0 + y1) / 2
    k = (y1 - y0) / 2 / bow
    planes = [((0, -1, 0), -y0, 'front'), ((0, 1, 0), y1, 'back'), ((-1, 0, 0), -x0, 'left'),
              ((0, 0, 1), z1, 'top'), ((0, 0, -1), -z0, 'bottom'),
              ((1, k, 0), x1 + k * ym, 'bowb'), ((1, -k, 0), x1 - k * ym, 'bowf')]
    return Poly(planes, **kw)


# ═══════════════════════════ 면 무늬(post 훅) ══════════════════════════════════════════════
def _idx(ramp, s, delta):
    return ob._darken(ramp, s, delta)


def windows(x0, y0, z0=2.0, ztop=None, px=3, pz=3, lit_p=0.10, ramp='glass', xoff=0, band_right=True, missing=0.0, seed=1):
    """고층 외벽 창 격자. 앞면: 가로 px·세로 pz 주기의 (px-1)x(pz-1) 창. 오른쪽면: 가로 띠창(오른쪽면 폭이 .28/깊이 라 세로 격자는 앨리어싱)."""
    rp = ob.MAT[ramp]

    def post(tag, P, col, s, nrm):
        x, y, z = P[:, 0], P[:, 1], P[:, 2]
        front = nrm[:, 1] < -.5
        right = nrm[:, 0] > .5
        zt = ztop if ztop is not None else 1e9
        zz = z - z0
        rowi = np.floor(zz / pz)
        wz = (zz >= 0) & (z <= zt) & (np.mod(zz, pz) < pz - 1)
        ci = np.floor((x - x0 - xoff) / px)
        wx = np.mod(x - x0 - xoff, px) < px - 1
        win = front & wz & wx
        h = hsh(ci, rowi, seed)
        sv = np.where(h > 1 - lit_p, 0.0, 1.0)
        base = _idx(rp, s * 0.92, 0)
        dark = _idx(rp, s * 0.92, -1)
        out = np.where(win[:, None], np.where((h < .4)[:, None], dark, base), col)
        if missing:
            gone = win & (hsh(ci, rowi, seed + 7) < missing)
            out = np.where(gone[:, None], np.array(ob.MAT['concrete'][0], np.uint8)[None, :], out)
        lit = win & (h > 1 - lit_p)
        if lit_p:
            out = np.where(lit[:, None], np.array(LITWIN, np.uint8)[None, :], out)
        if band_right:
            wr = right & wz & (np.mod(zz, pz) < pz - 1)
            out = np.where(wr[:, None], _idx(rp, s * 0.9, -1), out)
        return out.astype(np.uint8)
    return post


def bands(z0, period=4, width=1, delta=-1, faces=('front', 'right')):
    def post(tag, P, col, s, nrm):
        z = P[:, 2]
        m = np.zeros(len(z), bool)
        if 'front' in faces:
            m |= nrm[:, 1] < -.5
        if 'right' in faces:
            m |= nrm[:, 0] > .5
        if 'side' in faces:
            m |= np.abs(nrm[:, 2]) < .5
        m &= (z >= z0) & (np.mod(z - z0, period) < width)
        return np.where(m[:, None], _idx(post.ramp, s, delta), col).astype(np.uint8)
    post.ramp = None
    return post


def with_ramp(post, mat):
    post.ramp = ob.MAT[mat]
    return post


def ribs(period=2, faces=('front',), delta=-1, mat='cred'):
    """컨테이너 세로 골: 앞면 x 주기."""
    rp = ob.MAT[mat]

    def post(tag, P, col, s, nrm):
        x, y = P[:, 0], P[:, 1]
        m = np.zeros(len(x), bool)
        if 'front' in faces:
            m |= (nrm[:, 1] < -.5) & (np.mod(np.floor(x), period) == 0)
        if 'right' in faces:
            m |= (nrm[:, 0] > .5) & (np.mod(np.floor(P[:, 2]), 2) == 0)
        return np.where(m[:, None], _idx(rp, s, delta), col).astype(np.uint8)
    return post


def solar_cells(period_x=3, period_y=2, mat='solar'):
    rp = ob.MAT[mat]

    def post(tag, P, col, s, nrm):
        top = nrm[:, 2] > .5
        line = top & ((np.mod(np.floor(P[:, 0]), period_x) == 0) | (np.mod(np.floor(P[:, 1] * 1.6), period_y) == 0))
        return np.where(line[:, None], _idx(rp, s, -1), col).astype(np.uint8)
    return post


def chain(*posts):
    def post(tag, P, col, s, nrm):
        for p in posts:
            col = p(tag, P, col, s, nrm)
        return col
    return post


def dome_panels(n_lon=8, n_lat=3, mat='white'):
    rp = ob.MAT[mat]

    def make(prim):
        def post(tag, P, col, s, nrm):
            rel = P - prim.c[None, :]
            lon = np.degrees(np.arctan2(rel[:, 1], rel[:, 0]))
            lat = np.degrees(np.arcsin(np.clip(rel[:, 2] / prim.r, -1, 1)))
            m = (np.mod(lon + 360, 360 / n_lon) < 360 / n_lon / 7) | (np.mod(lat, 90 / n_lat) < 1.4)
            return np.where(m[:, None], _idx(rp, s, -1), col).astype(np.uint8)
        return post
    return make


ob.D_SUN = np.array([-0.32, 0.22, 1.0])      # 이 세트: 해를 더 높게 — 키 큰 탑의 그림자가 칸 밖으로 안 나가게(조명 LIGHT 는 그대로)

# ═══════════════════════════ 장면 부품 ═══════════════════════════════════════════════════════
def add(s, p, post=None):
    p.post = post
    return s.add(p)


def bldg(s, x, y, w, d, h, mat='concrete', win=True, ramp='glass', role='house', post=None, lit_p=.10, z0=2.0, seed=1, contour=True, top=True):
    """직육면체 건물. win=True 면 앞·오른쪽 창 격자. 옥상 설비는 호출 쪽에서 얹는다."""
    p = box(x, x + w, y, y + d, 0, h, mat=mat, tex='plain', role=role, contour=contour)
    if post is None and win:
        post = windows(x, y, z0=z0, ztop=h - 1.5, ramp=ramp, lit_p=lit_p, seed=seed)
    p.post = post
    s.add(p)
    return p


def rooftop(s, x, y, w, d, h, kind='ac', seed=0):
    """옥상 설비. 건물 윗면 (x..x+w, y..y+d, 높이 h) 위에 얹는다."""
    if kind == 'ac':
        s.add(box(x + w * .15, x + w * .15 + max(2, w * .3), y + d * .15, y + d * .15 + max(2, d * .3), h, h + 2, mat='steel', tex='plain', role='misc', contour=True))
    elif kind == 'ac2':
        s.add(box(x + w * .1, x + w * .1 + 2.5, y + d * .55, y + d * .55 + 2, h, h + 1.6, mat='steel', tex='plain', role='misc', contour=True))
        s.add(box(x + w * .5, x + w * .5 + 3, y + d * .2, y + d * .2 + 2, h, h + 2.2, mat='white', tex='plain', role='misc', contour=True))
    elif kind == 'mast':
        cx, cy = x + w / 2, y + d / 2
        s.add(box(cx - .5, cx + .5, cy - .5, cy + .5, h, h + 8, mat='steel', tex='plain', role='misc'))
        s.add(box(cx - .5, cx + .5, cy - .5, cy + .5, h + 8, h + 9, mat='neon', tex='plain', role='misc'))
    elif kind == 'helipad':
        s.add(Frustum(x + w / 2, y + d / 2, min(w, d) * .32, min(w, d) * .32, h, h + .8, mat='white', role='misc', contour=True))
    elif kind == 'tank':
        s.add(Frustum(x + w * .3, y + d * .5, 2.2, 2.2, h, h + 3, mat='steel', role='misc', contour=True))


def tower_stack(s, x, y, w, d, tiers, mat='glass', concrete='concrete', crown='mast', seed=1, ramp='glass'):
    """setback 고층: tiers=[(높이, 줄어드는 폭)...] 누적. 각 단은 가운데 정렬로 줄어든다."""
    z = 0.0
    cx, cy = x + w / 2, y + d / 2
    ww, dd = w, d
    last = None
    for i, (hh, shrink) in enumerate(tiers):
        ww2, dd2 = ww - shrink, dd - shrink
        px_, py_ = cx - ww2 / 2, cy - dd2 / 2
        p = box(px_, px_ + ww2, py_, py_ + dd2, z, z + hh, mat=(mat if mat != 'concrete' else concrete), tex='plain', role='house', contour=True)
        if mat == 'glass':
            p.post = windows(px_, py_, z0=z + (2 if i == 0 else 1), ztop=z + hh - 1.5, ramp=ramp, seed=seed + i, lit_p=.08)
        else:
            p.post = windows(px_, py_, z0=z + 2, ztop=z + hh - 1.5, ramp='glass', seed=seed + i, lit_p=.1)
        s.add(p)
        z += hh
        ww, dd = ww2, dd2
        last = (px_, py_, ww2, dd2, z)
    if crown:
        rooftop(s, *last[:4], last[4], kind=crown)
    return last


def house_gable(s, x, y, w, d, wall_h, roof_h, wall='plaster', roof='roofred', door=True, ridge='x'):
    """박공 주택. 마루가 x 방향(앞쪽 경사가 보임)."""
    dec = ()
    if door:
        dec = (('front', (x + w / 2 - 1.1, x + w / 2 + 1.1, 0, 3.2, 'door')),)
    s.add(box(x, x + w, y, y + d, 0, wall_h, mat=wall, tex='plain', role='house', contour=True, decals=dec))
    s.add(ob.gable(x - .6, x + w + .6, y - .8, y + d + .8, wall_h, roof_h / (d / 2 + .8), mat=roof, tex='plain', role='roof', contour=True))


def house_flat(s, x, y, w, d, h, wall='plaster', trim='concrete', win=True, door=True):
    dec = ()
    if door:
        dec = (('front', (x + w * .15, x + w * .15 + 2, 0, 3.2, 'door')),)
    p = box(x, x + w, y, y + d, 0, h, mat=wall, tex='plain', role='house', contour=True, decals=dec)
    if win:
        p.post = windows(x + 1, y, z0=2.2, ztop=h - .7, px=4, pz=3, lit_p=0, seed=3, band_right=False)
    s.add(p)
    s.add(box(x - .4, x + w + .4, y - .4, y + d + .4, h, h + .8, mat=trim, tex='plain', role='roof', contour=True))


def container(s, x, y, z, color='cred', w=6.0, d=2.6, h=2.6):
    p = box(x, x + w, y, y + d, z, z + h, mat=color, tex='plain', role='cargo', contour=True)
    p.post = ribs(2, ('front', 'right'), mat=color)
    s.add(p)


def tree_round(s, x, y, r=2.6, z=0.0, mat='leafm'):
    s.add(Frustum(x, y, .6, .6, z, z + r * .9, mat='rust', role='misc'))
    s.add(Dome(x, y, z + r * 1.1, r, zmin=z + r * .45, mat=mat, role='misc', contour=True))


def dish(s, cx, cy, cz, r, tilt=.75, mat='white', mast=True, n=10, yaw=0.0):
    """접시 안테나(오목). 팔각 얇은 원반 + 안쪽 오목 명암 + 테두리 + 급전 팔 + 받침.
    tilt = 접시 면 법선이 앞(-y)쪽으로 기운 각(rad)."""
    hd = np.array([math.sin(yaw), -math.cos(yaw), 0.0])
    nrm = np.array([0.0, 0.0, 1.0]) * math.cos(tilt) + hd * math.sin(tilt)
    ex = np.cross(np.array([0.0, 0.0, 1.0]), nrm)
    ex = ex / np.linalg.norm(ex)
    ey = np.cross(nrm, ex)
    c = np.array([cx, cy, cz])
    th = max(1.2, r * .28)
    planes = [(tuple(nrm), float(nrm @ c + th / 2), 'dtop'), (tuple(-nrm), float(-nrm @ c + th / 2), 'dbot')]
    for k in range(n):
        a = 2 * math.pi * (k + .5) / n
        d = math.cos(a) * ex + math.sin(a) * ey
        planes.append((tuple(d), float(d @ c + r * math.cos(math.pi / n)), 'drim'))
    p = Poly(planes, mat=mat, tex='plain', role='dish', contour=True)
    rp = ob.MAT[mat]

    def post(tag, P, col, sh, nrm_):
        rel = P - c[None, :]
        u, v = rel @ ex, rel @ ey
        rr = np.sqrt(u * u + v * v) / r
        top = np.asarray(tag, dtype=object) == 'dtop'
        bowl = top & (rr < .82)
        # 오목: 가운데 어둡고 가장자리로 갈수록 밝다. 오른쪽 아래 안쪽 벽이 가장 밝다(빛은 왼쪽 위).
        lit = np.clip(.18 + .5 * rr + .32 * (u * .6 - v * .8) / r * rr, 0, 1)
        bc = _idx(rp, lit * .92, 0)
        out = np.where(bowl[:, None], bc, col)
        hub = top & (rr < .16)
        out = np.where(hub[:, None], np.array(ob.MAT['steel'][1], np.uint8)[None, :], out)
        rim = top & (rr >= .82)
        out = np.where(rim[:, None], _idx(rp, np.clip(sh * 1.1, 0, 1), 1), out)
        return out.astype(np.uint8)
    p.post = post
    s.add(p)
    # 급전 팔: 접시 면에서 법선 방향으로 뻗은 막대 + 끝 혼
    tip = c + nrm * (r * 1.5)
    s.add(obox((c + tip) / 2, (1.1, 1.1, r * 1.45), np.stack([ex, ey, nrm], 1), mat='steel', role='misc', contour=False))
    s.add(Dome(tip[0], tip[1], tip[2], max(1.1, r * .22), zmin=-99, mat='orange', role='misc', contour=True))
    if mast:
        s.add(box(cx - 1.1, cx + 1.1, cy - .6, cy + 1.6, 0, max(cz - th, 1), mat='steel', tex='plain', role='misc', contour=True))
    return p


def wall_run(s, x0, x1, y0, y1, h, mat='concrete', wire=True):
    s.add(box(x0, x1, y0, y1, 0, h, mat=mat, tex='plain', role='wall', contour=True))
    if wire:
        s.add(box(x0, x1, (y0 + y1) / 2 - .4, (y0 + y1) / 2 + .4, h, h + 1.2, mat='steel', tex='plain', role='misc'))


def ground(s, x0, x1, y0, y1, fn, mat='asphalt'):
    return s.patch(x0, x1, y0, y1, fn, mat=mat)


def flat_fn(mat='asphalt', lo=0, hi=None, seed=5):
    ramp = np.array(ob.MAT[mat], np.uint8)
    n = len(ramp)

    def fn(x, y):
        t = hsh(x, y, seed)
        idx = np.clip((t * (n - (hi or 0))).astype(int) + lo, 0, n - 1)
        return ramp[idx]
    return fn


def save_arr(arr, path):
    from PIL import Image
    Image.fromarray(arr).save(path)


def steel_door(s, x0, x1, y, z1, z0=0.0, mat='steel', stripe=True):
    """벽 앞면(y)에 붙는 강철 문. 세로 골 + 위 경고 띠."""
    p = box(x0, x1, y - .6, y, z0, z1, mat=mat, tex='plain', role='gate', contour=True)
    rp = ob.MAT[mat]

    def post(tag, P, col, sh, nrm):
        front = nrm[:, 1] < -.5
        m = front & (np.mod(np.floor(P[:, 0] - x0), 2) == 1)
        out = np.where(m[:, None], _idx(rp, sh, -1), col)
        if stripe:
            band = front & (P[:, 2] > z1 - 2) & (np.mod(np.floor(P[:, 0] - x0), 2) == 0)
            out = np.where(band[:, None], np.array(ob.MAT['cyellow'][3], np.uint8)[None, :], out)
        return out.astype(np.uint8)
    p.post = post
    s.add(p)
    return p


def watch_tower(s, x, y, w, h, cabin=1.6, mat='concrete', ant=True):
    """감시탑: 기둥(직육면체) + 위로 튀어나온 관제실 + 안테나."""
    p = box(x, x + w, y, y + w, 0, h, mat=mat, tex='plain', role='tower', contour=True)
    p.post = windows(x, y, z0=3, ztop=h - 2, px=4, pz=4, lit_p=0, ramp='glass', seed=2, band_right=False)
    s.add(p)
    c = w * (cabin - 1) / 2
    s.add(box(x - c, x + w + c, y - c, y + w + c, h, h + 4, mat='steel', tex='plain', role='tower', contour=True))
    s.add(box(x - c + .6, x + w + c - .6, y - c - .1, y + w + c - .6, h + 1, h + 3, mat='glass', tex='plain', role='misc'))
    s.add(box(x - c - .5, x + w + c + .5, y - c - .5, y + w + c + .5, h + 4, h + 5, mat='concrete', tex='plain', role='roof', contour=True))
    if ant:
        s.add(box(x + w / 2 - .4, x + w / 2 + .4, y + w / 2 - .4, y + w / 2 + .4, h + 5, h + 11, mat='steel', tex='plain', role='misc'))
        s.add(box(x + w / 2 - .5, x + w / 2 + .5, y + w / 2 - .5, y + w / 2 + .5, h + 11, h + 12, mat='neon', tex='plain', role='misc'))


def band_swap(z0, period, mat_b, faces=('side',), width=None):
    """z 띠마다 다른 재질(적백 줄무늬 철탑 등). faces: side=세로면 전부."""
    rb = ob.MAT[mat_b]
    width = width or period

    def post(tag, P, col, s, nrm):
        m = (np.abs(nrm[:, 2]) < .5) & (np.mod(np.floor((P[:, 2] - z0) / period), 2) == 1)
        return np.where(m[:, None], _idx(rb, s, 0), col).astype(np.uint8)
    return post


def dome_door(cx, w=2.6, h=3.4, front_only=True):
    def post(tag, P, col, s, nrm):
        m = (nrm[:, 1] < -.2) & (np.abs(P[:, 0] - cx) < w / 2) & (P[:, 2] < h)
        return np.where(m[:, None], np.array(ob.MAT['concrete'][0], np.uint8)[None, :], col).astype(np.uint8)
    return post


def broken(x0, x1, y0, y1, zt, tilts=((.35, .1), (-.5, -.15)), drops=(0.0, 3.0), **kw):
    """윗면이 비스듬히 부서진 건물 몸통."""
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    planes = [((1, 0, 0), x1, 'right'), ((-1, 0, 0), -x0, 'left'), ((0, 1, 0), y1, 'back'), ((0, -1, 0), -y0, 'front'),
              ((0, 0, -1), 0.0, 'bottom')]
    for (a, b), dr in zip(tilts, drops):
        n = np.array([a, b, 1.0])
        p0 = np.array([cx, cy, zt - dr])
        planes.append((tuple(n), float(n @ p0), 'top'))
    return Poly(planes, **kw)


def rubble(s, rng, x0, x1, y0, y1, n=8, hmax=2.4, mats=('concrete', 'oldgrey', 'rust')):
    for _ in range(n):
        w = rng.uniform(1.4, 3.6)
        d = rng.uniform(1.2, 2.6)
        h = rng.uniform(.8, hmax)
        x = rng.uniform(x0, x1 - w)
        y = rng.uniform(y0, y1 - d)
        s.add(box(x, x + w, y, y + d, 0, h, mat=mats[rng.randint(len(mats))], tex='plain', role='misc', contour=True))


def cyl_windows(xc, yc, r, z0, ztop, pz=3, cols=14, ramp='glass', lit_p=0.08, seed=1, skip_front=False):
    """원통 몸통 창 띠: 둘레를 cols 칸으로 나눠 창, 세로 pz 주기."""
    rp = ob.MAT[ramp]

    def post(tag, P, col, s, nrm):
        side = np.abs(nrm[:, 2]) < .4
        ang = np.arctan2(P[:, 1] - yc, P[:, 0] - xc)
        f = (ang / (2 * math.pi) + .5) * cols
        ci = np.floor(f)
        wx = np.mod(f, 1.0) < .62
        zz = P[:, 2] - z0
        wz = (zz >= 0) & (P[:, 2] <= ztop) & (np.mod(zz, pz) < pz - 1)
        win = side & wx & wz
        h = hsh(ci, np.floor(zz / pz), seed)
        out = np.where(win[:, None], _idx(rp, s * .9, 0), col)
        lit = win & (h > 1 - lit_p)
        out = np.where(lit[:, None], np.array(LITWIN, np.uint8)[None, :], out)
        return out.astype(np.uint8)
    return post


def hole(x0, x1, z0, z1, seed=3):
    """앞면의 무너진 구멍(어두운 속, 들쭉날쭉한 테)."""
    dk = np.array(ob.MAT['concrete'][0], np.uint8)
    dk2 = np.array(STONE[0], np.uint8)

    def post(tag, P, col, s, nrm):
        front = nrm[:, 1] < -.5
        j = hsh(np.floor(P[:, 0]), np.floor(P[:, 2]), seed) * 1.6
        inside = front & (P[:, 0] > x0 + j) & (P[:, 0] < x1 - j) & (P[:, 2] > z0 + j) & (P[:, 2] < z1 - j)
        return np.where(inside[:, None], dk2[None, :], col).astype(np.uint8)
    return post


def steam(s, x, y, z, rng, n=4, r0=3.4, rise=3.0, drift=2.6, mat='cloud'):
    """증기 기둥: 좌우로 엇갈리며 위로 커지는 구름 덩이(가장자리가 물결). 그림자를 던지지 않는다."""
    for i in range(n):
        r = r0 * (1 + .18 * i)
        dx = drift * (0.2 if i % 2 == 0 else 1.0) * (1 + .3 * i) - drift * .5
        s.add(Dome(x + dx, y + (i % 2) * .6, z + rise * i * (1 + .1 * i), r, zmin=-99, mat=mat, role='steam', contour=True))


def tent_ridge_y(x0, x1, y0, y1, h, mat='cblue', door=True):
    """A자 텐트: 마루가 앞뒤(y) 방향 — 앞은 삼각 박공(출입구), 왼쪽 경사는 밝고 오른쪽은 어둡다."""
    hw = (x1 - x0) / 2
    planes = [((-h, 0, hw), -h * x0, 'lslope'), ((h, 0, hw), h * x1, 'rslope'), ((0, -1, 0), -y0, 'front'),
              ((0, 1, 0), y1, 'back'), ((0, 0, -1), 0.0, 'bottom')]
    cx = (x0 + x1) / 2
    dec = (('front', (cx - hw * .26, cx + hw * .26, 0, h * .5, 'dark')),) if door else ()
    return Poly(planes, mat=mat, tex='plain', role='tent', contour=True, decals=dec)


def dome_ribs(n_lon=8, slit_deg=None, slit_w=11, mat='white'):
    """관측 돔: 경선 리브(어두운 줄) + 앞쪽 개구부(slit_deg 방향, 폭 slit_w°, 어두운 남색)."""
    rp = ob.MAT[mat]

    def make(prim):
        def post(tag, P, col, s, nrm):
            rel = P - prim.c[None, :]
            lon = np.degrees(np.arctan2(rel[:, 1], rel[:, 0]))
            lat = np.degrees(np.arcsin(np.clip(rel[:, 2] / prim.r, -1, 1)))
            m = np.mod(lon + 360 + 360 / n_lon / 2, 360 / n_lon) < 360 / n_lon / 9
            out = np.where(m[:, None], _idx(rp, s, -2), col)
            if slit_deg is not None:
                d = np.abs(((lon - slit_deg + 180) % 360) - 180)
                sl = (d < slit_w / 2 * (1.0 + 1.2 * (1 - lat / 90))) & (lat > 8)
                out = np.where(sl[:, None], np.array(NAVY, np.uint8)[None, :], out)
                edge = (d < slit_w / 2 * (1.0 + 1.2 * (1 - lat / 90)) + 3) & ~sl & (lat > 8)
                out = np.where(edge[:, None], _idx(rp, s, -2), out)
            return out.astype(np.uint8)
        return post
    return make
