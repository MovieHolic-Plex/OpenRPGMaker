"""경사 투영 렌더러 — 3/4 시점을 「그림 솜씨」가 아니라 투영 규칙으로 보장한다.

월드 좌표: x 오른쪽, y 안쪽(뒤), z 위. 1 단위 = 1 화면 픽셀(1칸=16px=1m).
화면(오른쪽 u, 위 v):   u = x + KX·y ,  v = z + KY·y        (KX=.28, KY=.5)
 → 뒤(y↑)로 갈수록 화면에서 위·오른쪽으로 밀린다 ⇒ 보이는 면은 윗면(z+) · 앞면(y−) · 오른쪽면(x+) 뿐이다.
 → 윗면의 화면 높이는 깊이 × KY, 오른쪽면의 화면 너비는 깊이 × KX 로 구조적으로 생긴다.

렌더링은 화면 픽셀마다 한 줄 광선(방향 D=(−KX, 1, −KY), y 가 작을수록 가깝다)을 쏴서
볼록 입체(직육면체·지붕·원통·원뿔)와 교차시키는 레이캐스트다(벡터화). 면 밝기는 법선으로 자동 결정:
  s = .28 + .72·max(0, n·L),  L = (−.5, −.35, .8)/|…|   (빛은 왼쪽 위·앞)
  → 윗면 .85 / 앞면 .53 / 오른쪽면 .28 / 원통 왼쪽 .64.
색은 전부 원본 EasyRPG World.png 램프(어둠→밝음)에서 고른다(새 색 0개). 벽돌 줄눈·창·문은 면 위에 규칙으로 얹는다.
땅 그림자는 지면 점에서 빛 쪽(−.45, .35, 1)으로 쏜 광선이 입체에 닿는지로 정한다(키색 254,103,139).
"""
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE.parent.parent))
import numpy as np  # noqa: E402
from icons_v9_lib import (STONE, VOLC, ROCK, RED, WOOD, LAVA, LEAF, WSTONE, SAND, GOLD, BLUE, WATER, GREY,  # noqa: E402
                          KEY, SHADOW, P, H)

KX, KY = 0.28, 0.5
D_VIEW = np.array([-KX, 1.0, -KY])
D_SUN = np.array([-0.45, 0.35, 1.0])
_L = np.array([-.5, -.35, .8])
LIGHT = _L / np.linalg.norm(_L)
INF = 1e9

MAT = {
    'stone': [STONE[1], STONE[2], STONE[3], STONE[4], STONE[5], STONE[6], STONE[7]],
    'sand': [ROCK[3], ROCK[4], ROCK[5], ROCK[6], ROCK[7], ROCK[8], ROCK[9]],
    'basalt': [STONE[0], STONE[1], VOLC[1], VOLC[2], VOLC[3], VOLC[4], VOLC[5]],
    'redroof': [RED[1], RED[2], RED[3], RED[4], RED[5], RED[6]],
    'wood': [WOOD[1], WOOD[2], WOOD[3], WOOD[4], WOOD[5], WOOD[6]],
    'plaster': [WSTONE[1], WSTONE[2], WSTONE[3], WSTONE[4], WSTONE[5]],
    'lava': [LAVA[0], LAVA[1], LAVA[2], LAVA[3], LAVA[4], LAVA[5]],
    'grass': [LEAF[1], LEAF[2], LEAF[3], LEAF[4], LEAF[5]],
    'dirt': [ROCK[5], ROCK[6], ROCK[7], ROCK[8], ROCK[9]],
    'gold': [GOLD[0], GOLD[1], GOLD[2], GOLD[3], GOLD[4]],
    'cloth': [RED[2], RED[3], RED[4], RED[5]],
    'sail': [WSTONE[3], WSTONE[4], WSTONE[5], WSTONE[5]],
}


def _norm(n):
    n = np.array(n, float)
    return n / np.linalg.norm(n)


def hsh(a, b, s=0):
    return H(np.floor(a).astype(np.int64), np.floor(b).astype(np.int64), s)


# ══════════════════════════════════════════════ 입체 ══════════════════════════════════════════════
class Prim:
    mat = 'stone'
    tex = 'brick'
    role = 'misc'
    contour = False
    decals = ()
    fn = None            # 평면 패치의 색 함수 fn(x, y) -> (n,3)

    def ray(self, O, D):
        raise NotImplementedError


class Poly(Prim):
    """볼록 다면체: 평면 목록 (법선 n, 오프셋 d, 이름) 에서 n·p <= d."""

    def __init__(self, planes, mat='stone', tex='brick', role='misc', contour=False, decals=()):
        self.n = np.array([_norm(p[0]) for p in planes])
        self.d = np.array([p[1] / np.linalg.norm(p[0]) for p in planes])
        self.tag = [p[2] for p in planes]
        self.mat, self.tex, self.role, self.contour, self.decals = mat, tex, role, contour, decals

    def ray(self, O, D):
        N = O.shape[0]
        enter = np.full(N, -INF)
        exit_ = np.full(N, INF)
        face = np.zeros(N, int)
        ok = np.ones(N, bool)
        for i in range(len(self.n)):
            nd = float(self.n[i] @ D)
            num = self.d[i] - O @ self.n[i]
            if abs(nd) < 1e-9:
                ok &= num >= 0
                continue
            t = num / nd
            if nd < 0:
                m = t > enter
                enter = np.where(m, t, enter)
                face = np.where(m, i, face)
            else:
                exit_ = np.minimum(exit_, t)
        ok &= enter <= exit_
        return np.where(ok, enter, INF), face

    def normal(self, face, P_):
        return self.n[face]

    def tag_of(self, face):
        return np.array(self.tag, dtype=object)[face]


def box(x0, x1, y0, y1, z0, z1, **kw):
    return Poly([((1, 0, 0), x1, 'right'), ((-1, 0, 0), -x0, 'left'), ((0, 1, 0), y1, 'back'),
                 ((0, -1, 0), -y0, 'front'), ((0, 0, 1), z1, 'top'), ((0, 0, -1), -z0, 'bottom')], **kw)


def hip(x0, x1, y0, y1, z0, s, **kw):
    """우진각/사각뿔 지붕: 밑 사각형 (x0..x1, y0..y1), 경사 s = 높이/수평거리. 정사각이면 사각뿔."""
    kw.setdefault('tex', 'shingle')
    kw.setdefault('mat', 'redroof')
    return Poly([((0, -s, 1), z0 - s * y0, 'slope'), ((-s, 0, 1), z0 - s * x0, 'slope'),
                 ((s, 0, 1), z0 + s * x1, 'slope'), ((0, s, 1), z0 + s * y1, 'slope'), ((0, 0, -1), -z0, 'bottom')], **kw)


def gable(x0, x1, y0, y1, z0, s, **kw):
    """박공 지붕(마루가 x 방향)."""
    kw.setdefault('tex', 'shingle')
    kw.setdefault('mat', 'redroof')
    return Poly([((0, -s, 1), z0 - s * y0, 'slope'), ((0, s, 1), z0 + s * y1, 'slope'),
                 ((-1, 0, 0), -x0, 'left'), ((1, 0, 0), x1, 'right'), ((0, 0, -1), -z0, 'bottom')], **kw)


class Cyl(Prim):
    def __init__(self, xc, yc, r, z0, z1, mat='stone', tex='brick', role='misc', contour=False, decals=()):
        self.xc, self.yc, self.r, self.z0, self.z1 = xc, yc, r, z0, z1
        self.mat, self.tex, self.role, self.contour, self.decals = mat, tex, role, contour, decals

    def ray(self, O, D):
        dx, dy = O[:, 0] - self.xc, O[:, 1] - self.yc
        a = D[0] ** 2 + D[1] ** 2
        b = 2 * (dx * D[0] + dy * D[1])
        c = dx * dx + dy * dy - self.r ** 2
        disc = b * b - 4 * a * c
        ok = disc >= 0
        sq = np.sqrt(np.where(ok, disc, 0))
        t1, t2 = (-b - sq) / (2 * a), (-b + sq) / (2 * a)
        ta = (self.z0 - O[:, 2]) / D[2]
        tb = (self.z1 - O[:, 2]) / D[2]
        s_in, s_out = np.minimum(ta, tb), np.maximum(ta, tb)
        enter = np.maximum(t1, s_in)
        exit_ = np.minimum(t2, s_out)
        ok &= enter <= exit_
        face = np.where(t1 >= s_in, 0, np.where(D[2] < 0, 1, 2))      # 0 옆면 1 윗면 2 밑면
        return np.where(ok, enter, INF), face

    def normal(self, face, P_):
        n = np.zeros((len(face), 3))
        s = face == 0
        n[s, 0] = (P_[s, 0] - self.xc) / self.r
        n[s, 1] = (P_[s, 1] - self.yc) / self.r
        n[face == 1, 2] = 1
        n[face == 2, 2] = -1
        return n

    def tag_of(self, face):
        return np.array(['side', 'top', 'bottom'], dtype=object)[face]


class Cone(Prim):
    def __init__(self, xc, yc, r, z0, zt, mat='redroof', tex='shingle', role='roof', contour=False, decals=()):
        self.xc, self.yc, self.r, self.z0, self.zt = xc, yc, r, z0, zt
        self.k = r / (zt - z0)
        self.mat, self.tex, self.role, self.contour, self.decals = mat, tex, role, contour, decals

    def ray(self, O, D):
        k = self.k
        dx, dy = O[:, 0] - self.xc, O[:, 1] - self.yc
        hz = self.zt - O[:, 2]
        a = D[0] ** 2 + D[1] ** 2 - k * k * D[2] ** 2
        b = 2 * (dx * D[0] + dy * D[1] + k * k * hz * D[2])
        c = dx * dx + dy * dy - k * k * hz * hz
        disc = b * b - 4 * a * c
        ok = disc >= 0
        sq = np.sqrt(np.where(ok, disc, 0))
        t1, t2 = (-b - sq) / (2 * a), (-b + sq) / (2 * a)
        lo, hi = np.minimum(t1, t2), np.maximum(t1, t2)
        ta = (self.z0 - O[:, 2]) / D[2]
        tb = (self.zt - O[:, 2]) / D[2]
        s_in, s_out = np.minimum(ta, tb), np.maximum(ta, tb)
        if a > 0:                                   # f<=0 은 두 근 사이(한 쪽 원뿔면 안)
            enter = np.maximum(lo, s_in)
            exit_ = np.minimum(hi, s_out)
            ok &= enter <= exit_
            face = np.where(lo >= s_in, 0, 1)
            return np.where(ok, enter, INF), face
        # a<0 (광선이 가파름): 원뿔 안은 (-inf, lo] 와 [hi, inf) 두 조각 — 윗·아랫 원뿔, 슬랩으로 자른다
        eA, xA = s_in, np.minimum(lo, s_out)
        eB, xB = np.maximum(hi, s_in), s_out
        vA, vB = ok & (eA <= xA), ok & (eB <= xB)
        enter = np.where(vA, eA, eB)
        ok = vA | vB
        face = np.where(vA, np.where(lo <= s_in, 1, 0), np.where(hi >= s_in, 0, 1))
        return np.where(ok, enter, INF), face

    def normal(self, face, P_):
        n = np.zeros((len(face), 3))
        s = face == 0
        n[s, 0] = P_[s, 0] - self.xc
        n[s, 1] = P_[s, 1] - self.yc
        n[s, 2] = self.k ** 2 * (self.zt - P_[s, 2])
        n[face == 1, 2] = -1
        nn = np.linalg.norm(n, axis=1)
        nn[nn == 0] = 1
        return n / nn[:, None]

    def tag_of(self, face):
        return np.array(['slope', 'bottom'], dtype=object)[face]


# ══════════════════════════════════════════════ 장면 ══════════════════════════════════════════════
class Scene:
    def __init__(self):
        self.prims = []

    def add(self, p):
        self.prims.append(p)
        return p

    def box(self, *a, **kw):
        return self.add(box(*a, **kw))

    def hip(self, *a, **kw):
        return self.add(hip(*a, **kw))

    def gable(self, *a, **kw):
        return self.add(gable(*a, **kw))

    def cyl(self, *a, **kw):
        return self.add(Cyl(*a, **kw))

    def cone(self, *a, **kw):
        return self.add(Cone(*a, **kw))

    def patch(self, x0, x1, y0, y1, fn, z=0.0, h=0.5, mat='grass'):
        """지면 패치(위에서 보이는 평면). fn(x, y) → (n,3) 색."""
        p = box(x0, x1, y0, y1, z, z + h, mat=mat, tex='fn', role='ground')
        p.fn = fn
        return self.add(p)

    # ── 부품 ──
    def crenels(self, x0, x1, y0, y1, z, mat='stone', step=3, h=2, edges=('front', 'back'), depth=2):
        """직육면체 위 흉벽: 가장자리를 따라 step 폭 이빨, step 폭 틈."""
        if 'front' in edges:
            for x in np.arange(x0, x1 - step + 0.01, step * 2):
                self.add(box(x, x + step, y0, y0 + depth, z, z + h, mat=mat, tex='brick', role='merlon'))
        if 'back' in edges:
            for x in np.arange(x0, x1 - step + 0.01, step * 2):
                self.add(box(x, x + step, y1 - depth, y1, z, z + h, mat=mat, tex='brick', role='merlon'))
        if 'right' in edges:
            for y in np.arange(y0 + step, y1 - step - depth, step * 2):
                self.add(box(x1 - depth, x1, y, y + step, z, z + h, mat=mat, tex='brick', role='merlon'))
        if 'left' in edges:
            for y in np.arange(y0 + step, y1 - step - depth, step * 2):
                self.add(box(x0, x0 + depth, y, y + step, z, z + h, mat=mat, tex='brick', role='merlon'))

    def ring_crenels(self, xc, yc, r, z, mat='stone', n=9, size=2.2, h=2):
        for i in range(n):
            th = 2 * math.pi * (i + .5) / n
            cx, cy = xc + (r - size / 2 - .3) * math.cos(th), yc + (r - size / 2 - .3) * math.sin(th)
            self.add(box(cx - size / 2, cx + size / 2, cy - size / 2, cy + size / 2, z, z + h, mat=mat, tex='brick', role='merlon'))

    def round_tower(self, xc, yc, r, z1, mat='stone', roof=None, roof_h=None, slits=(), n=9, role='tower', contour=True, lit='dark'):
        dec = tuple(('side', (-90 + a, 1.0, zz, zz + 3, lit)) for a, zz in slits)
        self.add(Cyl(xc, yc, r, 0, z1, mat=mat, role=role, contour=contour, decals=dec))
        if roof:
            rh = roof_h or r * 2.4
            self.add(Cone(xc, yc, r + 1.3, z1, z1 + rh, mat=roof, contour=contour))
        else:
            self.ring_crenels(xc, yc, r, z1, mat=mat, n=n)

    def house(self, x, y, w, d, wall_h, mat='plaster', roof='redroof', rs=.7):
        self.box(x, x + w, y, y + d, 0, wall_h, mat=mat, tex='plain', role='house', contour=True,
                 decals=(('front', (x + w / 2 - 1.2, x + w / 2 + 1.2, 0, 3.4, 'door'),),))
        self.hip(x - 1, x + w + 1, y - 1, y + d + 1, wall_h, rs, mat=roof, contour=True)


# ═══════════════════════════════════════ 래스터라이즈 ════════════════════════════════════════════
def _darken(ramp, s, delta):
    n = len(ramp)
    i = np.clip(np.rint(s * (n - 1)).astype(int) + delta, 0, n - 1)
    return np.array(ramp, np.uint8)[i]


def _tex_delta(p, tag, P_, face):
    """면 위 결(줄눈 등). 반환 정수 delta(−1 이 줄눈)."""
    x, y, z = P_[:, 0], P_[:, 1], P_[:, 2]
    n = len(x)
    delta = np.zeros(n, int)
    if p.tex in ('plain', 'fn'):
        return delta
    t = np.asarray(tag, dtype=object)
    if isinstance(p, Cyl):
        side = t == 'side'
        arc = np.arctan2(y - p.yc, x - p.xc) * p.r
        a, b = arc, z
    else:
        side = np.isin(t, ['front', 'back'])
        a = np.where(side, x, np.where(np.isin(t, ['left', 'right']), y, x))
        b = np.where(side | np.isin(t, ['left', 'right']), z, y)
    if p.tex == 'brick':
        if isinstance(p, Cyl):
            row = np.floor(b / 3)
            col = np.mod(np.floor(a + (row % 2) * 3), 6)
            mortar = ((np.mod(b, 3) < 1) | (col < 1)) & side
            delta[mortar] -= 1
            delta[(hsh(a, b, 3) > .94) & side] += 1
            top = t == 'top'
            delta[top & ((np.mod(x, 8) < 1) | (np.mod(y, 4) < 1))] -= 1
            delta[top & (hsh(x, y, 5) > .92)] += 1
        else:
            vert = np.isin(t, ['front', 'back', 'left', 'right'])
            row = np.floor(b / 3)
            col = np.mod(np.floor(a + (row % 2) * 3), 6)
            mortar = ((np.mod(b, 3) < 1) | (col < 1)) & vert
            delta[mortar] -= 1
            delta[(hsh(a, b, 3) > .94) & vert] += 1
            top = t == 'top'
            delta[top & ((np.mod(x, 8) < 1) | (np.mod(y, 4) < 1))] -= 1
            delta[top & (hsh(x, y, 5) > .92)] += 1
    elif p.tex == 'shingle':
        sl = np.isin(t, ['slope'])
        # 기와 줄: 높이 2px 마다 한 줄. 줄마다 엇갈린 짧은 세로 이음
        row = np.floor(z / 2)
        delta[sl & (np.mod(z, 2) < 1)] -= 1
        col = np.mod(np.floor(x + y * .5 + (row % 2) * 2), 4)
        delta[sl & (col < 1) & (np.mod(z, 2) >= 1)] -= 1
    return delta


def render(scene, W, H_, ox, oy, shadow=True, stats=True):
    cs, rs = np.meshgrid(np.arange(W), np.arange(H_))
    u = (cs + 0.5 - ox).ravel()
    v = (oy - (rs + 0.5)).ravel()
    N = W * H_
    O = np.stack([u, np.zeros(N), v], 1)
    best_t = np.full(N, INF)
    best_id = np.full(N, -1)
    best_face = np.zeros(N, int)
    for pid, p in enumerate(scene.prims):
        t, f = p.ray(O, D_VIEW)
        m = t < best_t
        best_t = np.where(m, t, best_t)
        best_id = np.where(m, pid, best_id)
        best_face = np.where(m, f, best_face)
    hit = best_id >= 0
    img = np.zeros((N, 3), np.uint8)
    img[:] = KEY
    cls = np.full(N, '', dtype=object)       # 면 분류 (top/front/right/left)
    role_of = np.full(N, '', dtype=object)
    Pw = O + best_t[:, None] * D_VIEW[None, :]
    for pid, p in enumerate(scene.prims):
        m = best_id == pid
        if not m.any():
            continue
        P_ = Pw[m]
        f = best_face[m]
        nrm = p.normal(f, P_)
        s = np.clip(.28 + .72 * np.maximum(0, nrm @ LIGHT), 0, 1)
        tag = p.tag_of(f)
        ramp = MAT[p.mat]
        if p.tex == 'fn' and p.fn is not None:
            col = p.fn(P_[:, 0], P_[:, 1]).astype(np.uint8)
            top = tag == 'top'
            col2 = _darken(ramp, s, 0)
            col = np.where(top[:, None], col, col2)
        else:
            delta = _tex_delta(p, tag, P_, f)
            col = _darken(ramp, s, 0)
            i = np.clip(np.rint(s * (len(ramp) - 1)).astype(int) + delta, 0, len(ramp) - 1)
            col = np.array(ramp, np.uint8)[i]
        # 데칼(창·문·활창)
        for dc in p.decals:
            col = _apply_decal(p, dc, tag, P_, col)
        # [modern-sf 확장] 면 위 규칙 무늬(창 격자·태양광 셀·컨테이너 골 등): post(tag, P, col, s, nrm) -> col
        if getattr(p, 'post', None) is not None:
            col = p.post(tag, P_, col, s, nrm)
        img[m] = col
        c = np.full(len(f), 'front', dtype=object)
        c[nrm[:, 2] > .5] = 'top'
        c[(nrm[:, 2] <= .5) & (nrm[:, 0] > .3)] = 'right'
        c[(nrm[:, 2] <= .5) & (nrm[:, 0] < -.3)] = 'left'
        cls[m] = c
        role_of[m] = p.role
    # ── 입체 사이 윤곽(가까운 입체의 가장자리를 두 단 어둡게) ──
    ids = best_id.reshape(H_, W)
    tt = best_t.reshape(H_, W)
    im = img.reshape(H_, W, 3)
    edge = np.zeros((H_, W), bool)
    ip = np.pad(ids, 1, constant_values=-1)
    tp = np.pad(tt, 1, constant_values=INF)
    for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        sh_i = ip[1 + dy:1 + dy + H_, 1 + dx:1 + dx + W]
        sh_t = tp[1 + dy:1 + dy + H_, 1 + dx:1 + dx + W]
        edge |= (ids >= 0) & (sh_i >= 0) & (sh_i != ids) & (sh_t > tt + 0.5)
    for pid, p in enumerate(scene.prims):
        if not p.contour:
            continue
        m = edge & (ids == pid)
        if m.any():
            ramp = np.array(MAT[p.mat], np.uint8)
            cur = im[m]
            # 현재 색의 램프 위치에서 두 단 아래
            idx = np.array([[int(np.abs(ramp.astype(int) - c.astype(int)).sum(1).argmin())] for c in cur]).ravel()
            im[m] = ramp[np.clip(idx - 2, 0, len(ramp) - 1)]
    # ── 땅 그림자 ──
    if shadow:
        free = ~hit
        tg = v / KY
        G = np.stack([u - KX * tg, tg, np.zeros(N)], 1)
        inshadow = np.zeros(N, bool)
        idx_free = np.nonzero(free & (v > -10 * KY - 6))[0]
        Gf = G[idx_free]
        sh = np.zeros(len(idx_free), bool)
        for p in scene.prims:
            if p.role in ('ground', 'steam', 'nocast'):          # [modern-sf] steam/nocast 도 그림자를 던지지 않는다
                continue
            t, f = p.ray(Gf, D_SUN)
            sh |= (t > 0.05) & (t < INF / 2)
        inshadow[idx_free[sh]] = True
        im.reshape(-1, 3)[inshadow & free] = SHADOW
    out = im.copy()
    st = None
    if stats:
        st = {}
        for r in sorted(set(role_of.tolist()) - {''} | {'wall', 'tower', 'keep', 'gate', 'roof', 'house', 'merlon', 'misc', 'ground'}):
            for c in ('top', 'front', 'right', 'left'):
                st[(r, c)] = int(((role_of == r) & (cls == c)).sum())
        st['all'] = {c: int((cls == c).sum()) for c in ('top', 'front', 'right', 'left')}
    return out, st


def _apply_decal(p, dc, tag, P_, col):
    kind = dc[0]
    t = np.asarray(tag, dtype=object)
    if kind == 'side':                                      # 원통 활창: (중심각도, 반폭(px), z0, z1)
        ang, hw, z0, z1 = dc[1][:4]
        mode = dc[1][4] if len(dc[1]) > 4 else 'dark'
        th = np.degrees(np.arctan2(P_[:, 1] - p.yc, P_[:, 0] - p.xc))
        arc = np.radians(np.abs(((th - ang + 180) % 360) - 180)) * p.r
        m = (t == 'side') & (arc <= hw) & (P_[:, 2] >= z0) & (P_[:, 2] <= z1)
        col[m] = np.array(LAVA[4], np.uint8) if mode == 'lit' else np.array(STONE[0], np.uint8)
        return col
    face = kind
    spec = dc[1]
    a0, a1, z0, z1 = spec[:4]
    mode = spec[4] if len(spec) > 4 else 'dark'
    if face == 'front':
        a = P_[:, 0]
    else:
        a = P_[:, 1]
    m = (t == face) & (a >= a0) & (a <= a1) & (P_[:, 2] >= z0) & (P_[:, 2] <= z1)
    if mode == 'dark':
        col[m] = STONE[0]
    elif mode == 'lit':                                    # 불 켜진 창
        col[m] = np.array(LAVA[4], np.uint8)
    elif mode == 'glass':
        col[m] = np.array(BLUE[2], np.uint8)
    elif mode == 'door':
        col[m] = np.array(WOOD[1], np.uint8)
        top = m & (P_[:, 2] >= z1 - 1)
        col[top] = np.array(WOOD[0], np.uint8)
    elif mode == 'gate':                                    # 쇠창살 문(어두운 바탕 + 나무 살)
        col[m] = np.array(STONE[0], np.uint8)
        bars = m & (np.mod(np.floor(a - a0), 2) == 1) & (P_[:, 2] <= z1 - 1)
        col[bars] = np.array(WOOD[2], np.uint8)
        rail = m & (np.mod(np.floor(P_[:, 2]), 4) == 2) & (P_[:, 2] <= z1 - 1)
        col[rail] = np.array(WOOD[1], np.uint8)
    elif mode == 'lavagate':
        col[m] = np.array(LAVA[3], np.uint8)
        inner = m & (a >= a0 + 1) & (a <= a1 - 1) & (P_[:, 2] >= z0)
        col[inner] = np.array(LAVA[4], np.uint8)
        core = m & (a >= a0 + 2) & (a <= a1 - 2)
        col[core] = np.array(LAVA[5], np.uint8)
    return col


def finish(arr):
    """실루엣 바깥 한 줄 윤곽(재질의 가장 어두운 색). 그림자 키는 건드리지 않는다."""
    h, w = arr.shape[:2]
    c = P(w // 16, h // 16)
    c.px[:] = arr
    c.outline()
    return c.arr()


def colors_of(arr):
    s = set(map(tuple, arr.reshape(-1, 3).tolist()))
    s.discard(tuple(KEY))
    s.discard(tuple(SHADOW))
    return s
