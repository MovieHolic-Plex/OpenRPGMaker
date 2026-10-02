"""성계 지도(starmap) 월드맵 아이콘 — 정면 카메라용 우주 장면.
우주라 땅 그림자가 없다: 모든 입체의 role 을 'nocast' 로 둔다(fin() 이 마지막에 일괄로 바꾼다).
행성은 화면에서 둥글게 보이도록 y·z 반지름을 1/√(1+KY²) 로 줄인 타원체(경사 투영이 세로로 늘리는 만큼 미리 줄인다).
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
from icons_v9_lib import (STONE, WSTONE, WOOD, ROCK, RED, BLUE, SNOW, LEAF, VOLC, LAVA, SAND, GOLD, GREY, PURP, hx)  # noqa: E402
from oblique import Scene, Poly, Prim, box, INF  # noqa: E402

SET = dict(id='starmap', name='성계 지도', kind='space')

KY = .62
SQ = 1 / math.sqrt(1 + KY * KY)          # 구가 화면에서 둥글게 보이게 y·z 반지름을 줄이는 비

# ── 새 재질(세트 전용 색) ──────────────────────────────────────────────────────────────────────
NEB = [hx(c) for c in ('2a1438', '4a2163', '74318a', 'a24ca8', 'd07bc8')]        # 성운 자주(새 색 5)
ob.MAT.update({
    'ocean': [BLUE[0], BLUE[1], BLUE[2], BLUE[3], BLUE[4], BLUE[5]],
    'land': [LEAF[1], LEAF[2], LEAF[3], LEAF[4], LEAF[5], LEAF[6]],
    'cloudw': [SNOW[1], SNOW[2], SNOW[3], SNOW[4], SNOW[5]],
    'ice': [SNOW[0], SNOW[1], SNOW[2], SNOW[3], SNOW[4], SNOW[5]],
    'moon': [STONE[1], STONE[2], STONE[3], STONE[4], STONE[5], STONE[6], STONE[7]],
    'rockp': [ROCK[1], ROCK[2], ROCK[3], ROCK[4], ROCK[5], ROCK[6], ROCK[7]],
    'basalt': [STONE[0], STONE[1], VOLC[1], VOLC[2], VOLC[3], VOLC[4]],
    'lavaglow': [LAVA[1], LAVA[2], LAVA[3], LAVA[4], LAVA[5], hx('ffe28a')],
    'gasA': [ROCK[3], ROCK[5], ROCK[7], ROCK[8], ROCK[9], SAND[4]],
    'gasB': [WOOD[2], WOOD[3], WOOD[4], WOOD[5], WOOD[6], GOLD[4]],
    'gasC': [WSTONE[1], WSTONE[2], WSTONE[3], WSTONE[4], WSTONE[5], SNOW[5]],
    'gasR': [RED[1], RED[2], RED[3], RED[4], RED[5], RED[6]],
    'neb': NEB,
    'sun': [GOLD[3], GOLD[4], hx('f0a030'), hx('ffe28a'), SNOW[5]],
    'relic': [PURP[0], PURP[1], PURP[2], PURP[3], PURP[4], STONE[7]],
    'hullgrey': [STONE[0], STONE[1], STONE[2], STONE[3], STONE[4], STONE[5], STONE[6]],
    'enemy': [STONE[0], STONE[1], VOLC[1], VOLC[2], VOLC[3], VOLC[5]],
    'lit': [hx('ffe28a')] * 4,
    'goldm': [GOLD[0], GOLD[1], GOLD[2], GOLD[3], GOLD[4], hx('ffe28a')],
})
L._reg(NEB, NEB[0])
NEON = np.array(hx('2ae0d8'), np.uint8)
LIT = np.array(hx('ffe28a'), np.uint8)
ORANGE = np.array(hx('f0a030'), np.uint8)
REDL = np.array(RED[4], np.uint8)


def dk(mat, s, d=0):
    return ob._darken(ob.MAT[mat], s, d)


def fin(s):
    """우주: 그림자를 던지지 않는다."""
    for p in s.prims:
        p.role = 'nocast'
    return s


# ── 잡음 ───────────────────────────────────────────────────────────────────────────────────────
def vnoise(q, seed=0):
    i = np.floor(q).astype(np.int64)
    f = q - i
    f = f * f * (3 - 2 * f)
    out = 0
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                h = L.H(i[:, 0] + dx + 101 * (i[:, 2] + dz), i[:, 1] + dy - 57 * (i[:, 2] + dz), seed)
                w = (f[:, 0] if dx else 1 - f[:, 0]) * (f[:, 1] if dy else 1 - f[:, 1]) * (f[:, 2] if dz else 1 - f[:, 2])
                out = out + h * w
    return out


def fbm(q, seed=0):
    return .62 * vnoise(q, seed) + .38 * vnoise(q * 2.1 + 7.3, seed + 3)


# ══════════════════════════════════ 새 입체 ══════════════════════════════════════════════════
class Chunk(Prim):
    """타원체 ∩ 반공간들(n·p <= d). 구 껍질 면은 'crust', 자른 면은 'cut'. 행성·위성·쪼개진 조각."""

    def __init__(self, c, r, planes=(), mat='moon', tex='plain', contour=True):
        self.c = np.array(c, float)
        self.r = np.array(r, float)
        self.pn = [np.array(p[0], float) / np.linalg.norm(p[0]) for p in planes]
        self.pd = [p[1] / np.linalg.norm(p[0]) for p in planes]
        self.mat, self.tex, self.role, self.contour, self.decals = mat, tex, 'nocast', contour, ()
        self.post = None

    def ray(self, O, D):
        o = (O - self.c) / self.r
        d = D / self.r
        a = float(d @ d)
        b = 2 * (o @ d)
        cc = (o * o).sum(1) - 1
        disc = b * b - 4 * a * cc
        ok = disc >= 0
        sq = np.sqrt(np.where(ok, disc, 0))
        enter = (-b - sq) / (2 * a)
        exit_ = (-b + sq) / (2 * a)
        face = np.zeros(len(O), int)
        for i, (n, dd) in enumerate(zip(self.pn, self.pd)):
            nd = float(n @ D)
            num = dd - O @ n
            if abs(nd) < 1e-9:
                ok &= num >= 0
                continue
            t = num / nd
            if nd < 0:
                m = t > enter
                enter = np.where(m, t, enter)
                face = np.where(m, i + 1, face)
            else:
                exit_ = np.minimum(exit_, t)
        ok &= enter <= exit_
        return np.where(ok, enter, INF), face

    def normal(self, face, P_):
        n = (P_ - self.c) / self.r ** 2
        for i, pn in enumerate(self.pn):
            n[face == i + 1] = pn
        nn = np.linalg.norm(n, axis=1)
        nn[nn == 0] = 1
        return n / nn[:, None]

    def tag_of(self, face):
        return np.where(face == 0, 'crust', 'cut').astype(object)

    def unit(self, P_):
        return (P_ - self.c) / self.r


def basis(axis, ref=(1, 0, 0)):
    w = np.array(axis, float)
    w /= np.linalg.norm(w)
    u = np.array(ref, float)
    u = u - (u @ w) * w
    if np.linalg.norm(u) < 1e-6:
        u = np.array([0, 1.0, 0]) - w[1] * w
    u /= np.linalg.norm(u)
    v = np.cross(w, u)
    return np.stack([u, v, w], 1)


class Ring(Prim):
    """두꺼운 고리(원환 판) — 축 axis, 안 반지름 ri, 바깥 ro, 두께 h. a0..a1(도)를 주면 부채꼴 조각.
    면: 0 윗면 1 밑면 2 바깥벽 3 안벽 4·5 끝면. ri=0 이면 원판."""

    def __init__(self, c, axis, ri, ro, h, a=None, ref=(1, 0, 0), mat='concrete', tex='plain', contour=True):
        self.c = np.array(c, float)
        self.R = basis(axis, ref)
        self.ri, self.ro, self.h = ri, ro, h
        self.a = None if a is None else (math.radians(a[0]), math.radians(a[1]))
        self.mat, self.tex, self.role, self.contour, self.decals = mat, tex, 'nocast', contour, ()
        self.post = None

    def local(self, P_):
        return (P_ - self.c) @ self.R

    def _ang_ok(self, p):
        if self.a is None:
            return np.ones(len(p), bool)
        th = np.arctan2(p[:, 1], p[:, 0])
        a0, a1 = self.a
        return np.mod(th - a0, 2 * math.pi) <= (a1 - a0)

    def ray(self, O, D):
        Ol = (O - self.c) @ self.R
        Dl = D @ self.R
        N = len(O)
        best = np.full(N, INF)
        face = np.zeros(N, int)
        hz = self.h / 2

        def take(t, valid, f):
            nonlocal best, face
            m = valid & (t < best)
            best = np.where(m, t, best)
            face = np.where(m, f, face)

        if abs(Dl[2]) > 1e-9:
            for zc, f in ((hz, 0), (-hz, 1)):
                t = (zc - Ol[:, 2]) / Dl[2]
                p = Ol + t[:, None] * Dl
                r = np.hypot(p[:, 0], p[:, 1])
                take(t, (r >= self.ri) & (r <= self.ro) & self._ang_ok(p), f)
        a = Dl[0] ** 2 + Dl[1] ** 2
        if a > 1e-12:
            for rr, f in ((self.ro, 2), (self.ri, 3)):
                if rr <= 0:
                    continue
                b = 2 * (Ol[:, 0] * Dl[0] + Ol[:, 1] * Dl[1])
                cc = Ol[:, 0] ** 2 + Ol[:, 1] ** 2 - rr * rr
                disc = b * b - 4 * a * cc
                okd = disc >= 0
                sq = np.sqrt(np.where(okd, disc, 0))
                for t in ((-b - sq) / (2 * a), (-b + sq) / (2 * a)):
                    p = Ol + t[:, None] * Dl
                    take(t, okd & (np.abs(p[:, 2]) <= hz) & self._ang_ok(p), f)
        if self.a is not None:
            for th, f in ((self.a[0], 4), (self.a[1], 5)):
                n = np.array([-math.sin(th), math.cos(th), 0.0])
                dirv = np.array([math.cos(th), math.sin(th), 0.0])
                nd = float(Dl @ n)
                if abs(nd) < 1e-9:
                    continue
                t = -(Ol @ n) / nd
                p = Ol + t[:, None] * Dl
                rr = p @ dirv
                take(t, (rr >= self.ri) & (rr <= self.ro) & (np.abs(p[:, 2]) <= hz), f)
        return best, face

    def normal(self, face, P_):
        p = self.local(P_)
        n = np.zeros_like(p)
        n[face == 0] = (0, 0, 1)
        n[face == 1] = (0, 0, -1)
        r = np.hypot(p[:, 0], p[:, 1])
        r[r == 0] = 1
        for f, sg in ((2, 1), (3, -1)):
            m = face == f
            n[m, 0] = sg * p[m, 0] / r[m]
            n[m, 1] = sg * p[m, 1] / r[m]
        if self.a is not None:
            a0, a1 = self.a
            n[face == 4] = (math.sin(a0), -math.cos(a0), 0)
            n[face == 5] = (-math.sin(a1), math.cos(a1), 0)
        return n @ self.R.T

    def tag_of(self, face):
        return np.array(['top', 'bottom', 'outer', 'inner', 'end', 'end'], dtype=object)[face]


def rpoly(planes, R, center, **kw):
    """평면 목록(n, d, 이름)을 center 기준 회전 R 로 돌린 볼록 다면체."""
    c = np.array(center, float)
    out = []
    for n, d, nm in planes:
        n = np.array(n, float)
        n2 = R @ n
        out.append((tuple(n2), float(n2 @ c + (d - n @ c)), nm))
    return Poly(out, **kw)


def ship_poly(x0, x1, y0, y1, z0, z1, bow=8.0, up=.5, flip=False, **kw):
    zm = z0 + (z1 - z0) * up
    ym = (y0 + y1) / 2
    hzu, hzd, hy = z1 - zm, zm - z0, (y1 - y0) / 2
    sgn = -1 if flip else 1
    tip = x0 if flip else x1
    # 뱃머리: x 가 tip 에 다가갈수록 위·아래·앞뒤 반폭이 줄어 0 이 된다(쐐기).
    pl = [((sgn * hzu / bow, 0, 1), sgn * hzu / bow * tip + zm, 'top'),
          ((sgn * hzd / bow, 0, -1), sgn * hzd / bow * tip - zm, 'bottom'),
          ((sgn * hy * .55 / bow, 1, 0), sgn * hy * .55 / bow * tip + ym + hy * .45, 'back'),
          ((sgn * hy * .55 / bow, -1, 0), sgn * hy * .55 / bow * tip - ym + hy * .45, 'front'),
          ((0, 0, 1), z1, 'top'), ((0, 0, -1), -z0, 'bottom'), ((0, 1, 0), y1, 'back'), ((0, -1, 0), -y0, 'front'),
          ((1, 0, 0), x1, 'right') if flip else ((-1, 0, 0), -x0, 'left')]
    return Poly(pl, **kw)


# ══════════════════════════════════ 면 무늬(post) ═══════════════════════════════════════════
def planet_post(prim, kind='earth', seed=1, scale=2.2, land=.52, clouds=.70, ice=.82, night=False, spot=None):
    def post(tag, P, col, s, nrm):
        u = prim.unit(P)
        crust = np.asarray(tag, dtype=object) == 'crust'
        out = col.copy()
        q = u * scale
        n = fbm(q + seed * 3.1, seed)
        if kind == 'earth':
            out = dk('ocean', s, 0)
            ln = n > land
            out = np.where(ln[:, None], dk('land', s, 0), out)
            coast = (n > land - .025) & ~ln
            out = np.where(coast[:, None], dk('ocean', s, 1), out)
            if ice:
                pole = np.abs(u[:, 2]) > ice + (n - .5) * .2
                out = np.where(pole[:, None], dk('ice', s, 0), out)
            if clouds:
                cn = fbm(u * np.array([2.0, 2.0, 5.0]) + 11 + seed, seed + 9)
                cl = cn > clouds
                out = np.where(cl[:, None], dk('cloudw', s, 0), out)
            if night:
                lights = ln & (s < .42) & (L.H(np.floor(P[:, 0]), np.floor(P[:, 2] + P[:, 1] * .62), seed + 4) > .78)
                out = np.where(lights[:, None], LIT[None, :], out)
        elif kind == 'gas':
            lat = u[:, 2] + (n - .5) * .16
            band = np.floor((lat + 1) * 4.6).astype(int)
            mats = ['gasC', 'gasA', 'gasB', 'gasA', 'gasC', 'gasB', 'gasA', 'gasC', 'gasB', 'gasA']
            for k, m in enumerate(mats):
                sel = band == k
                if sel.any():
                    out[sel] = dk(m, s[sel], 0)
            if spot is not None:
                du = (u[:, 0] - spot[0]) / spot[2]
                dz = (u[:, 2] - spot[1]) / (spot[2] * .55)
                sp = du * du + dz * dz < 1
                out = np.where(sp[:, None], dk('gasR', s, 0), out)
                ed = (du * du + dz * dz < 1.6) & ~sp
                out = np.where(ed[:, None], dk('gasB', s, -1), out)
        elif kind == 'lava':
            out = dk('basalt', s, 0)
            cr = np.abs(n - .5) < .045
            cr |= np.abs(fbm(q * 1.7 + 4, seed + 5) - .5) < .03
            out = np.where(cr[:, None], dk('lavaglow', np.clip(.55 + .45 * s, 0, 1), 0), out)
            pool = n > .70
            out = np.where(pool[:, None], dk('lavaglow', np.clip(.35 + .5 * s, 0, 1), 0), out)
        elif kind == 'ice':
            out = dk('ice', s, 0)
            cr = np.abs(n - .5) < .03
            out = np.where(cr[:, None], dk('ocean', s, 1), out)
            pt = n > .72
            out = np.where(pt[:, None], dk('ice', s, -1), out)
        elif kind == 'moon':
            out = dk('moon', s, 0)
            mare = n > .62
            out = np.where(mare[:, None], dk('moon', s, -1), out)
        elif kind == 'rock':
            out = dk('rockp', s, 0)
            out = np.where((n > .64)[:, None], dk('rockp', s, -1), out)
            out = np.where((L.H(np.floor(P[:, 0]), np.floor(P[:, 2] * 1.3 + P[:, 1]), seed) > .9)[:, None], dk('rockp', s, 1), out)
        return np.where(crust[:, None], out, col).astype(np.uint8)
    return post


def craters(prim, mat, items, base=None):
    """구 위 크레이터: items=[(방향 벡터, 각 반지름(라디안))]. 안은 한 단 어둡고 빛 쪽 테는 한 단 밝다."""
    dirs = [(np.array(d, float) / np.linalg.norm(d), r) for d, r in items]

    def post(tag, P, col, s, nrm):
        if base is not None:
            col = base(tag, P, col, s, nrm)
        u = prim.unit(P)
        un = u / np.linalg.norm(u, axis=1)[:, None]
        crust = np.asarray(tag, dtype=object) == 'crust'
        out = col
        for d, r in dirs:
            ang = np.arccos(np.clip(un @ d, -1, 1))
            inn = crust & (ang < r)
            # 안쪽: 빛 반대편 벽이 밝다 — 오목
            off = (un - d[None, :])
            lit = off @ ob.LIGHT
            v = np.where(lit < 0, 1, -1)
            out = np.where(inn[:, None], dk(mat, s, 0), out)
            out = np.where((inn & (v > 0))[:, None], dk(mat, s, -1), out)
            rim = crust & (ang >= r) & (ang < r * 1.3)
            out = np.where(rim[:, None], dk(mat, s, 1), out)
        return out.astype(np.uint8)
    return post


def lights(p_lit=.12, period=(3, 2), seed=1, color=None, faces=None, mat='concrete'):
    """금속 면 위 불 켜진 창 점: 격자 칸마다 해시로."""
    colr = LIT if color is None else color
    px, pz = period

    def post(tag, P, col, s, nrm):
        x, y, z = P[:, 0], P[:, 1], P[:, 2]
        a = x + y * .37
        cell_a, cell_z = np.floor(a / px), np.floor((z + y * .62) / pz)
        win = (np.mod(a, px) < 1) & (np.mod(z + y * .62, pz) < 1)
        h = L.H(cell_a.astype(np.int64), cell_z.astype(np.int64), seed)
        out = np.where((win & (h > .45))[:, None], dk(mat, s, -1), col)
        out = np.where((win & (h > 1 - p_lit))[:, None], colr[None, :], out)
        return out.astype(np.uint8)
    return post


def stripes(axis=0, period=6, width=2, mat='cred', z0=0):
    def post(tag, P, col, s, nrm):
        m = np.mod(P[:, axis] - z0, period) < width
        return np.where(m[:, None], dk(mat, s, 0), col).astype(np.uint8)
    return post


def chain(*posts):
    def post(tag, P, col, s, nrm):
        for p in posts:
            col = p(tag, P, col, s, nrm)
        return col
    return post


def glow(mat='sun', lo=.55):
    """스스로 빛나는 면: 그늘에서도 밝다."""
    def post(tag, P, col, s, nrm):
        return dk(mat, np.clip(lo + (1 - lo) * s, 0, 1), 0)
    return post


# ── 부품 ───────────────────────────────────────────────────────────────────────────────────────
def planet(s, x, y, z, r, kind='earth', mat='ocean', planes=(), **kw):
    p = Chunk((x, y, z), (r, r * SQ, r * SQ), planes=planes, mat=mat)
    p.post = planet_post(p, kind, **kw)
    s.add(p)
    return p


def moon(s, x, y, z, r, mat='moon', kind='moon', seed=3, cr=None):
    p = Chunk((x, y, z), (r, r * SQ, r * SQ), mat=mat)
    base = planet_post(p, kind, seed=seed)
    p.post = craters(p, mat, cr, base) if cr else base
    s.add(p)
    return p


def add(s, p, post=None):
    p.post = post
    p.role = 'nocast'
    s.add(p)
    return p


def bx(s, x0, x1, y0, y1, z0, z1, mat='concrete', post=None, contour=True, tex='plain'):
    return add(s, box(x0, x1, y0, y1, z0, z1, mat=mat, tex=tex, contour=contour), post)


def ob_(s, c, size, R=None, mat='concrete', post=None, contour=True):
    return add(s, M.obox(c, size, R, mat=mat, tex='plain', contour=contour), post)


def sph(s, x, y, z, r, mat='concrete', post=None, contour=True):
    return add(s, Chunk((x, y, z), (r, r * SQ, r * SQ), mat=mat, contour=contour), post)


def beam(s, a, b, w=1.2, mat='concrete', post=None, contour=True):
    """두 점 사이 각기둥(골조·줄·팔)."""
    a, b = np.array(a, float), np.array(b, float)
    d = b - a
    Ln = np.linalg.norm(d)
    R = basis(d, (0, -1, 0) if abs(d[1]) < .9 * Ln else (1, 0, 0))
    R = R[:, [0, 1, 2]]
    return ob_(s, (a + b) / 2, (w, w, Ln), R, mat=mat, post=post, contour=contour)


def lamp(s, x, y, z, r=1.0, color='neon'):
    return add(s, box(x - r / 2, x + r / 2, y - .2, y + .2, z - r / 2, z + r / 2, mat=color, tex='plain', contour=False))


# ══════════════════════════════════ 장면 ═══════════════════════════════════════════════════
def capital():
    """모항성계 수도: 대양·대륙·구름의 푸른 큰 행성 + 바위 고리 + 기울어진 궤도 도시 고리(모듈·불빛) + 작은 위성."""
    s = Scene()
    c = (0, 60, 0)
    planet(s, *c, 26, 'earth', seed=4, land=.53, night=True)
    # 자연 고리(흐린 바위·얼음 띠)
    rg = Ring((0, 60, 0), (0, -.10, 1), 31, 41, 1.0, mat='gasC')
    rg.post = lambda tag, P, col, s_, n: np.where(
        (np.mod(np.hypot(*(rg.local(P)[:, :2].T)), 3.2) < 1.1)[:, None], dk('gasC', s_, -1), col).astype(np.uint8)
    add(s, rg, rg.post)
    # 궤도 도시 고리: 반대로 기운 금속 고리 + 위의 모듈
    ax = (.32, -.18, 1)
    cr = Ring((0, 60, 0), ax, 43.5, 46.5, 2.6, mat='concrete')
    add(s, cr, lights(.22, (3, 2), seed=7))
    R = basis(ax)
    for k in range(14):
        th = 2 * math.pi * k / 14 + .2
        p = np.array([math.cos(th), math.sin(th), 0]) * 45
        wc = np.array(c) + R @ (p + np.array([0, 0, 2.6]))
        Rk = R @ M.rot_z(th)
        h = 3.0 + 2.2 * ((k * 7) % 3)
        ob_(s, wc + R[:, 2] * (h / 2 - 1), (2.4, 3.2, h), Rk, mat='white' if k % 3 else 'steel', post=lights(.3, (2, 2), seed=k))
    moon(s, 37, 30, 30, 5.5, cr=[((-.4, -.6, .5), .35), ((.5, -.7, -.2), .25)])
    return fin(s)


def fort_city():
    """요새 정거장: 정면을 보는 바퀴 고리 + 바퀴살 + 가운데 축 + 네 방위 포대(포신)."""
    s = Scene()
    c = np.array([0, 40, 0.0])
    ax = np.array([.10, -.49, 1.0])
    R = basis(ax, (1, 0, 0))
    add(s, Ring(c, ax, 15.5, 21, 6, mat='concrete'), chain(lights(.18, (3, 2), seed=2), stripes(2, 9, 1.2, 'cred', 3)))
    add(s, Ring(c, ax, 13.5, 16.2, 3, mat='steel'))
    add(s, Ring(c + R[:, 2] * 2, ax, 0, 6.5, 10, mat='white'), lights(.3, (2, 2), seed=9))
    add(s, Ring(c + R[:, 2] * 8, ax, 0, 3.5, 4, mat='steel'))
    lamp(s, *(c + R[:, 2] * 10.5), r=2.2)
    for k in range(6):
        th = 2 * math.pi * k / 6 + math.pi / 6
        dvec = R @ np.array([math.cos(th), math.sin(th), 0])
        beam(s, c + dvec * 6, c + dvec * 14, 2.0, 'steel')
    for k in range(4):
        th = 2 * math.pi * k / 4 + math.pi / 2
        dvec = R @ np.array([math.cos(th), math.sin(th), 0])
        base = c + dvec * 22
        Rk = R @ M.rot_z(th)
        ob_(s, base + R[:, 2] * 1, (4.4, 4.2, 6.5), Rk, mat='enemy')
        beam(s, base + dvec * 1.5 + R[:, 2] * 1.5, base + dvec * 5.5 + R[:, 2] * 1.5, 1.3, 'steel')
        beam(s, base + dvec * 1.5 - R[:, 2] * .5, base + dvec * 5.0 - R[:, 2] * .5, 1.3, 'steel')
    return fin(s)


def harbor_city():
    """우주 조선소: 골조 도크 안에서 건조 중인 함선(뒤쪽은 철판, 앞쪽은 늑골만) + 크레인 팔 + 관제동."""
    s = Scene()
    y = 30
    # 도크 골조: 위·아래 들보, 뒤 기둥
    for z in (2, 38):
        bx(s, -38, 34, y + 10, y + 13, z, z + 2.6, 'orange', post=stripes(0, 4, 1, 'steel'))
    for x in (-36, -16, 4, 24):
        bx(s, x, x + 2.4, y + 12, y + 15, 2, 40, 'orange', post=stripes(2, 4, 1, 'steel'))
    # 함선(뱃머리 오른쪽)
    add(s, ship_poly(-12, 32, y - 6, y + 8, 12, 28, bow=14, up=.55, mat='hullgrey'),
        chain(lights(.14, (4, 3), seed=3, mat='hullgrey'), stripes(0, 11, 1, 'steel')))
    bx(s, -6, 10, y - 2, y + 5, 28, 32, 'hullgrey', post=lights(.3, (2, 2), seed=5, mat='hullgrey'))
    # 앞쪽: 늑골만(건조 중)
    for x in range(-32, -12, 4):
        bx(s, x, x + 1.4, y - 5, y - 3.6, 13, 27, 'steel')
        bx(s, x, x + 1.4, y + 6, y + 7.4, 13, 27, 'steel')
        bx(s, x, x + 1.4, y - 5, y + 7.4, 26, 27.4, 'steel')
    bx(s, -34, -12, y + 1, y + 3, 13, 15, 'steel')                       # 용골
    bx(s, -34, -12, y + 1, y + 3, 26.5, 28, 'steel')
    # 크레인 팔(위 들보에 매달림) + 용접 불빛
    for x, zz in ((-26, 30), (-8, 33), (14, 33.5)):
        bx(s, x, x + 1.4, y + 4, y + 5.4, zz, 38, 'orange')
        bx(s, x - 2, x + 3.4, y + 3, y + 6, zz - 1.6, zz, 'steel')
        lamp(s, x + .7, y + 2.6, zz - 2.6, 1.6, 'neon')
    # 관제동(왼쪽 아래 앞)
    bx(s, -40, -28, y - 14, y - 6, 0, 9, 'white', post=lights(.35, (2, 2), seed=8, mat='white'))
    bx(s, -38, -30, y - 13, y - 7, 9, 12, 'steel')
    beam(s, (-34, y - 10, 12), (-34, y - 10, 18), 1, 'steel')
    lamp(s, -34, y - 10.4, 18.6, 1.4, 'neon')
    return fin(s)


def castle():
    """적 기함: 붉은 띠의 검은 거대 전함(쐐기 선체·층진 상부·함교탑·포탑) + 뒤 추진 불꽃."""
    s = Scene()
    y = 20
    add(s, ship_poly(-15, 22, y - 6, y + 6, 6, 16, bow=16, up=.45, mat='enemy'),
        chain(lights(.10, (4, 3), seed=2, mat='enemy', color=REDL), stripes(2, 20, 1.3, 'cred', 10.5)))
    add(s, ship_poly(-14, 12, y - 3, y + 4, 16, 21, bow=10, up=.2, mat='enemy'), lights(.2, (3, 2), seed=4, mat='enemy'))
    bx(s, -10, -3, y - 1, y + 3, 21, 29, 'enemy', post=lights(.35, (2, 2), seed=6, mat='enemy', color=REDL))
    bx(s, -11.5, -1.5, y - 1.5, y + 3.5, 29, 31, 'steel')
    beam(s, (-6.5, y + 1, 31), (-6.5, y + 1, 36), .8, 'steel')
    lamp(s, -6.5, y + .6, 36.4, 1.2, 'lavaglow')
    for x in (0, 7):
        add(s, Ring((x, y, 21), (0, 0, 1), 0, 2.2, 1.6, mat='steel'))
        beam(s, (x, y - .5, 21.8), (x + 6, y - .5, 22.6), .9, 'steel')
    # 추진기 불꽃(왼쪽으로)
    for zz in (9, 13):
        bx(s, -17, -15, y - 5, y - 2, zz - 1.6, zz + 1.6, 'steel')
        add(s, Chunk((-19.5, y - 4, zz), (3.2, 1.4, 1.5), mat='lavaglow', contour=False), glow('lavaglow', .6))
    return fin(s)


def castle_fortmoon():
    """군 요새 위성: 회색 위성 + 적도 참호(불빛) + 거대 포구 접시 + 꼭대기 포탑·안테나."""
    s = Scene()
    c = (0, 30, 0)
    p = Chunk(c, (21, 21 * SQ, 21 * SQ), mat='moon')
    base = planet_post(p, 'moon', seed=5)

    def trench(tag, P, col, s_, n):
        col = base(tag, P, col, s_, n)
        u = p.unit(P)
        tr = np.abs(u[:, 2] - .08) < .055
        col = np.where(tr[:, None], dk('moon', s_, -2), col)
        lt = tr & (L.H(np.floor(P[:, 0] / 2).astype(np.int64), 3, 1) > .6) & (np.abs(u[:, 2] - .08) < .02)
        col = np.where(lt[:, None], LIT[None, :], col)
        pan = (np.mod(np.floor((u[:, 2] + 1) * 7), 2) == 0) & ~tr & (L.H(np.floor(P[:, 0] / 3).astype(np.int64), np.floor(u[:, 2] * 7).astype(np.int64), 2) > .8)
        col = np.where(pan[:, None], dk('moon', s_, -1), col)
        return col
    dish_d = np.array([-.45, -.75, .48])
    cr = craters(p, 'moon', [((.6, -.7, -.3), .12), ((.1, -.9, -.4), .1)], trench)
    dn = dish_d / np.linalg.norm(dish_d)

    def dish(tag, P, col, s_, n):
        col = cr(tag, P, col, s_, n)
        u = p.unit(P)
        un = u / np.linalg.norm(u, axis=1)[:, None]
        ang = np.arccos(np.clip(un @ dn, -1, 1)) / .40
        lit = (un - dn) @ ob.LIGHT
        bowl = ang < 1
        sh = np.clip(.15 + .55 * ang + np.where(lit < 0, .25, -.1) * ang, 0, 1)
        col = np.where(bowl[:, None], dk('moon', sh, 0), col)
        col = np.where((bowl & (np.abs(ang - .55) < .07))[:, None], dk('moon', s_, -2), col)
        col = np.where(((ang >= 1) & (ang < 1.15))[:, None], dk('moon', s_, 2), col)
        return col.astype(np.uint8)
    p.post = dish
    s.add(p)
    # 포구 가운데 빛
    dd = dish_d / np.linalg.norm(dish_d)
    ctr = np.array(c) + dd * np.array([21, 21 * SQ, 21 * SQ]) * 1.0
    add(s, Chunk(ctr, (1.8, 1.8 * SQ, 1.8 * SQ), mat='neon', contour=False))
    # 꼭대기 포탑·안테나
    top = np.array(c) + np.array([4, 0, 21 * SQ * .97])
    bx(s, top[0] - 3, top[0] + 3, top[1] - 2, top[1] + 2, top[2] - 2, top[2] + 2, 'enemy')
    beam(s, (top[0], top[1], top[2] + 1), (top[0] + 6, top[1] - 1, top[2] + 3), .9, 'steel')
    beam(s, (top[0] - 9, top[1], top[2] - 3), (top[0] - 9, top[1], top[2] + 6), .8, 'steel')
    lamp(s, top[0] - 9, top[1] - .4, top[2] + 6.6, 1.2, 'lavaglow')
    return fin(s)


def large_town():
    """개척 행성: 초록 대륙의 행성 + 작은 회색 위성 + 궤도 개척 정거장."""
    s = Scene()
    planet(s, -2, 30, 0, 18, 'earth', seed=11, land=.44, clouds=.73, ice=.86)
    moon(s, 19, 10, 13, 4.6, cr=[((-.3, -.7, .5), .4)])
    st = np.array([-17.0, 12, 14])
    add(s, Ring(st, (0, -.3, 1), 2.4, 4.0, 1.2, mat='white'), lights(.3, (2, 2), seed=4, mat='white'))
    sph(s, *st, 1.8, 'steel')
    return fin(s)


def village():
    """소행성 채굴촌: 울퉁불퉁한 바위 소행성 + 유리·흰 돔 + 채굴 탑과 팔."""
    s = Scene()
    for (x, y, z, rx, ry, rz, sd) in ((0, 20, 0, 12, 7, 6, 1), (-6, 22, 2, 7, 6, 5.5, 2), (7, 21, -1, 7, 6, 5, 3), (2, 24, 3.5, 8, 5, 4.2, 4)):
        p = Chunk((x, y, z), (rx, ry, rz), mat='rockp')
        p.post = planet_post(p, 'rock', seed=sd, scale=1.6)
        s.add(p)
    d1 = M.Dome(-4, 22, 7.2, 4.2, mat='glass', contour=True)
    d1.post = M.dome_panels(6, 2, 'glass')(d1)
    add(s, d1, d1.post)
    d2 = M.Dome(4, 23, 6.6, 3.0, mat='white', contour=True)
    add(s, d2, M.dome_door(4, 1.6, 8.4))
    bx(s, 7.5, 9.5, 21, 23, 5, 15, 'orange', post=stripes(2, 3, 1, 'steel'))
    beam(s, (8.5, 21.5, 14.5), (13.5, 21, 10), 1, 'orange')
    bx(s, 7, 10, 20.5, 23.5, 15, 16.5, 'steel')
    lamp(s, 8.5, 20.4, 17.3, 1.2, 'neon')
    lamp(s, -4, 17.6, 6.6, 1, 'lit')
    return fin(s)


def village_ice():
    """얼음 위성: 푸른 금이 간 흰 얼음 구 + 표면 기지 돔·안테나."""
    s = Scene()
    c = (0, 20, 0)
    p = planet(s, *c, 12, 'ice', mat='ice', seed=6, scale=2.6)
    top = np.array([-3, 20, 12 * SQ * .93])
    d = M.Dome(top[0], top[1], top[2], 3.4, zmin=top[2] - 1.2, mat='white', contour=True)
    add(s, d, M.dome_ribs(6, mat='white')(d))
    bx(s, 1, 4.5, 18.5, 21.5, top[2] - 1.5, top[2] + 1.5, 'steel', post=lights(.5, (2, 2), seed=3, mat='steel'))
    beam(s, (5.5, 20, top[2] - 2), (5.5, 20, top[2] + 3.5), .8, 'steel')
    lamp(s, 5.5, 19.6, top[2] + 4, 1.2, 'neon')
    return fin(s)


def camp():
    """보급선 정박지: 가운데 연료 탱크 정박탑 + 양쪽에 붙은 작은 보급선 둘."""
    s = Scene()
    y = 20
    add(s, Ring((0, y + 3, 8), (0, 0, 1), 0, 3.0, 10, mat='white'), stripes(2, 4, 1.4, 'orange', 1))
    sph(s, 0, y + 3, 13.2, 2.8, 'white')
    beam(s, (0, y + 3, 15), (0, y + 3, 18), .8, 'steel')
    lamp(s, 0, y + 2.6, 18.5, 1.2, 'neon')
    beam(s, (-9, y, 9), (9, y, 9), 1.2, 'steel')
    add(s, ship_poly(-14, -3, y - 3, y + 3, 4, 11, bow=6, up=.5, flip=True, mat='white'),
        chain(stripes(0, 6, 1.6, 'orange', 1), lights(.3, (3, 2), seed=1, mat='white')))
    add(s, ship_poly(3, 14, y - 2.6, y + 2.6, 7, 13, bow=5, up=.5, mat='hullgrey'),
        chain(stripes(0, 5, 1.4, 'cblue', 1), lights(.3, (3, 2), seed=2, mat='hullgrey')))
    lamp(s, -14.6, y - 3.2, 7.5, 1.0, 'neon')
    lamp(s, 14.2, y - 2.8, 10, 1.0, 'neon')
    return fin(s)


def tower_small():
    """항법 부표: 가는 돛대 + 태양 날개 + 꼭대기에서 빛나는 비콘(빛살)."""
    s = Scene()
    y = 10
    add(s, Ring((0, y, 3), (0, 0, 1), 0, 3.2, 4, mat='steel'), stripes(2, 2, 1, 'cred', 1.5))
    bx(s, -.8, .8, y - .8, y + .8, 5, 20, 'white', post=stripes(2, 4, 2, 'cred', 6))
    bx(s, -6.5, -1, y - .4, y + .4, 11, 14.5, 'solar', post=M.solar_cells(2, 2))
    bx(s, 1, 6.5, y - .4, y + .4, 11, 14.5, 'solar', post=M.solar_cells(2, 2))
    sph(s, 0, y, 22.5, 2.6, 'neon', post=glow('sun', .65))
    for a, b in (((0, y - 3, 26.4), (0, y - 3, 28.4)), ((-4.6, y - 3, 22.5), (-3.4, y - 3, 22.5)), ((3.4, y - 3, 22.5), (4.6, y - 3, 22.5))):
        beam(s, a, b, .9, 'neon', contour=False)
    return fin(s)


def tower_great():
    """궤도 엘리베이터: 아래 행성 지평선에서 뻗은 줄 + 오르내리는 승강기 + 중간 정거장 + 꼭대기 고리 정거장·평형추."""
    s = Scene()
    y = 30
    r = 17
    zc = -r * SQ
    planet(s, 0, y, zc, r, 'earth', seed=2, land=.5, clouds=.72, ice=False,
           planes=[((0, 0, -1), 6.5)])
    zt = 0
    bx(s, -2.2, 2.2, y - 2, y + 2, zt - 1.5, zt + 2.5, 'concrete')
    bx(s, -.6, .6, y - .6, y + .6, zt + 2.5, zt + 41, 'steel', contour=False)
    for zz in (zt + 8, zt + 26):
        bx(s, -1.6, 1.6, y - 1.6, y + 1.2, zz, zz + 3, 'orange')
        lamp(s, 0, y - 1.9, zz + 1.5, 1.0, 'lit')
    zm = zt + 17
    add(s, Ring((0, y, zm), (0, -.15, 1), 1, 5, 2, mat='white'), lights(.35, (2, 2), seed=3, mat='white'))
    zs = zt + 35
    add(s, Ring((0, y, zs), (0, -.2, 1), 6.5, 10.5, 2.6, mat='concrete'), lights(.25, (2, 2), seed=6))
    for k in range(4):
        th = math.pi / 4 + k * math.pi / 2
        beam(s, (0, y, zs), (7.5 * math.cos(th), y + 7.5 * math.sin(th), zs), 1, 'steel')
    sph(s, 0, y, zs, 3.4, 'white', post=lights(.4, (2, 2), seed=1, mat='white'))
    p = Chunk((0, y, zt + 44), (3.4, 2.8, 2.6), mat='rockp')
    p.post = planet_post(p, 'rock', seed=7)
    s.add(p)
    lamp(s, 0, y - 3.4, zt + 44, 1.0, 'neon')
    return fin(s)


def cave():
    """점프 게이트: 빛 마디가 박힌 금속 고리 문 + 안에 소용돌이치는 웜홀 + 세 갈래 기둥."""
    s = Scene()
    c = np.array([0, 20, 0.0])
    ax = np.array([.0, -.49, 1.0])
    R = basis(ax, (1, 0, 0))

    def seg(tag, P, col, s_, n):
        p = (P - c) @ R
        th = np.degrees(np.arctan2(p[:, 1], p[:, 0]))
        m = (np.mod(th + 360, 30) < 6) & (np.asarray(tag, dtype=object) == 'top')
        return np.where(m[:, None], NEON[None, :], col).astype(np.uint8)
    add(s, Ring(c, ax, 9, 12.5, 4, mat='concrete'), seg)

    def swirl(tag, P, col, s_, n):
        p = (P - c) @ R
        r = np.hypot(p[:, 0], p[:, 1]) / 9
        th = np.arctan2(p[:, 1], p[:, 0])
        v = np.mod(th / (2 * math.pi) * 3 + np.log(r + .05) * 1.3, 1.0)
        idx = np.clip((v * 3 + (1 - r) * 2.4).astype(int), 0, 4)
        out = np.array(NEB, np.uint8)[idx]
        out = np.where((r < .22)[:, None], np.array(SNOW[5], np.uint8)[None, :], out)
        out = np.where(((r >= .22) & (r < .36))[:, None], NEON[None, :], out)
        return out.astype(np.uint8)
    add(s, Ring(c + R[:, 2] * .6, ax, 0, 9.2, .6, mat='neb', contour=False), swirl)
    for k in range(3):
        th = math.pi / 6 + k * 2 * math.pi / 3
        dv = R @ np.array([math.cos(th), math.sin(th), 0])
        beam(s, c + dv * 12, c + dv * 14.5, 2.4, 'steel')
        lamp(s, *(c + dv * 14.8 + R[:, 2] * 1.5), r=1.2)
    return fin(s)


def ruin():
    """함선 잔해: 두 동강 난 선체 — 오른쪽 뱃머리 토막은 아래로, 왼쪽 고물 토막(꺼진 추진기)은 위로 기울고 그 사이로 늑골이 삐져나온다 + 떠도는 파편."""
    s = Scene()
    y = 20
    bow = ship_poly(2, 14, y - 3.5, y + 3.5, 0, 9, bow=8, up=.5, mat='hullgrey')
    P1 = rpoly(list(zip(bow.n, bow.d, bow.tag)), M.rot_y(.32), (2, y, 4.5), mat='hullgrey', tex='plain', contour=True)
    add(s, P1, chain(stripes(2, 20, 1.2, 'cred', 3.5), lights(.0, (3, 2), seed=3, mat='hullgrey')))
    Rs = M.rot_y(-.28)
    ob_(s, (-7.5, y, 6.5), (10, 7, 8.4), Rs, mat='hullgrey', post=chain(stripes(2, 20, 1.2, 'cred', 6), lights(.0, (3, 2), seed=4, mat='hullgrey')))
    ob_(s, (-13.5, y - .5, 7.6), (2.4, 4.5, 5), Rs, mat='rust')
    for dz in (-1.6, 1.6):
        p = np.array([-14.6, y - 1, 7.6]) + Rs @ np.array([0, 0, dz])
        ob_(s, p, (1.6, 2.4, 2.0), Rs, mat='basalt')
    # 끊긴 자리: 양쪽에서 삐져나온 늑골
    for zz, ln in ((2.2, 3.5), (5.0, 2.6), (7.8, 3.2)):
        a0 = np.array([-2.6, y - 3.6, zz + 3.2])
        beam(s, a0, a0 + np.array([ln, 0, -.8]), .8, 'steel')
        b0 = np.array([2.2, y - 3.6, zz - .6])
        beam(s, b0, b0 + np.array([-ln * .8, 0, .9]), .8, 'steel')
    lamp(s, 0, y - 4.2, 6.4, 1.2, 'lavaglow')
    lamp(s, -1.4, y - 4.2, 3.2, .9, 'lit')
    for (x, z, w, a) in ((-11, 15.5, 2.0, .6), (9, 14.5, 1.6, -.4), (1, 15.5, 1.3, .9), (12.5, 1.5, 1.8, .3), (-4, -1.5, 1.4, -.7)):
        ob_(s, (x, y - 2, z), (w, w * .8, w * .7), M.rot_y(a) @ M.rot_z(a), mat='rust' if a > 0 else 'hullgrey')
    return fin(s)


def ruin_city():
    """파괴된 행성: 다섯 조각으로 쪼개져 바깥으로 흩어지는 행성 껍질(속은 녹은 암석) + 빛나는 핵 + 부스러기."""
    s = Scene()
    c = np.array([0, 30, 0.0])
    r = 14.5
    vz = np.array([.45, -.35, 1.0])
    vz /= np.linalg.norm(vz)                                  # 쪼갠 축 — 시선과 어긋나야 자른 면(녹은 속)이 보인다
    ex = np.array([1.0, 0, 0]) - vz[0] * vz
    ex /= np.linalg.norm(ex)
    ey = np.cross(vz, ex)
    angs = [20, 110, 200, 290]
    add(s, Chunk(c, (4.6, 4.6 * SQ, 4.6 * SQ), mat='lavaglow', contour=False), glow('sun', .55))
    for i, a0 in enumerate(angs):
        a1 = angs[(i + 1) % len(angs)] + (360 if i == len(angs) - 1 else 0)
        mid = math.radians((a0 + a1) / 2)
        dmid = math.cos(mid) * ex + math.sin(mid) * ey
        off = dmid * (5.2 + 1.6 * (i % 2)) + vz * (1.0 if i % 2 else -.8)
        cc = c + off
        pl = []
        for a, sg in ((a0, 1), (a1, -1)):
            ar = math.radians(a)
            dvec = math.cos(ar) * ex + math.sin(ar) * ey
            nrm = -np.cross(vz, dvec) * sg            # 조각 안쪽이 음수가 되게
            pl.append((tuple(nrm), float(nrm @ cc)))
        pl.append((tuple(-dmid), float(-dmid @ cc - 3.0)))   # 안쪽(핵 쪽) 3px 을 깎는다
        p = Chunk(cc, (r, r * SQ, r * SQ), planes=pl, mat='rockp')
        crust = planet_post(p, 'earth', seed=8, land=.47, clouds=.78, ice=False)

        def post(tag, P, col, s_, n, p=p, crust=crust):
            out = crust(tag, P, col, s_, n)
            cut = np.asarray(tag, dtype=object) == 'cut'
            rr = np.linalg.norm(p.unit(P), axis=1)
            hot = np.clip(1.25 - rr, 0, 1)
            mag = dk('lavaglow', np.clip(hot * 1.1 + .1 * s_, 0, 1), 0)
            rock = dk('rockp', s_, 0)
            m = np.where((rr < .84)[:, None], mag, rock)
            m = np.where(((rr >= .84) & (rr < .92))[:, None], dk('rockp', s_, -1), m)
            return np.where(cut[:, None], m, out).astype(np.uint8)
        p.post = post
        s.add(p)
    rng = np.random.RandomState(4)
    for k in range(9):
        th = rng.uniform(0, 2 * math.pi)
        rad = rng.uniform(22, 25)
        pos = c + (math.cos(th) * ex * 1.25 + math.sin(th) * ey * .7) * rad
        w = rng.uniform(1.3, 2.6)
        ob_(s, pos, (w, w * .9, w * .8), M.rot_y(th) @ M.rot_x(th * .7), mat='rockp')
    return fin(s)


def shrine():
    """고대 외계 유물: 떠 있는 자줏빛 팔면체(빛 문자) + 둘레를 도는 금 고리 + 네 개의 떠 있는 돌기둥."""
    s = Scene()
    c = np.array([0, 24, 0.0])
    hw, hz = 8.5, 15

    def glyph(tag, P, col, s_, n):
        q = P - c
        g = (np.mod(np.floor(q[:, 2] / 2.0), 3) == 0) & (L.H(np.floor(q[:, 0] / 1.5).astype(np.int64), np.floor(q[:, 2] / 2.0).astype(np.int64), 3) > .55)
        return np.where(g[:, None], NEON[None, :], col).astype(np.uint8)
    pl = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            for sz in (-1, 1):
                nrm = np.array([sx / hw, sy / hw, sz / hz])
                pl.append((tuple(nrm), float(nrm @ c + 1), 'f'))
    add(s, Poly(pl, mat='relic', tex='plain', contour=True), glyph)
    add(s, Ring(c, (0, -.12, 1), 13, 15.5, 1.2, mat='goldm'),
        lambda tag, P, col, s_, n: np.where((np.mod(np.degrees(np.arctan2(P[:, 1] - c[1], P[:, 0] - c[0])) + 360, 24) < 3)[:, None],
                                            dk('goldm', s_, -2), col).astype(np.uint8))
    for k, (ang, zz) in enumerate(((200, -3), (-20, 1), (110, 6), (290, -6))):
        th = math.radians(ang)
        pos = c + np.array([math.cos(th) * 19, math.sin(th) * 10, zz])
        ob_(s, pos, (2.6, 2.6, 9 + (k % 2) * 3), M.rot_y(.12 * (1 if k % 2 else -1)), mat='relic', post=glyph)
    return fin(s)


def landmark_nature():
    """가스 거인: 갈색·주황·흰 띠 줄무늬 큰 행성 + 붉은 대폭풍 눈 + 작은 위성."""
    s = Scene()
    planet(s, 0, 30, 0, 22, 'gas', mat='gasA', seed=2, scale=3.0, spot=(-.25, -.32, .22))
    moon(s, -19, 6, 15, 3.6, mat='ice', kind='ice', seed=2)
    return fin(s)


def circle():
    """소행성 고리: 작은 얼음 왜행성 둘레를 도는 크고 작은 바위 덩이들."""
    s = Scene()
    c = np.array([0, 20, 0.0])
    planet(s, *c, 4.2, 'ice', mat='ice', seed=3)
    rng = np.random.RandomState(7)
    n = 17
    for k in range(n):
        th = 2 * math.pi * k / n + rng.uniform(-.12, .12)
        rad = 12.2 + rng.uniform(-1.0, 1.0)
        pos = c + np.array([math.cos(th) * rad, math.sin(th) * rad * 1.05, rng.uniform(-1, 1) - math.sin(th) * 1.2])
        rr = rng.uniform(1.4, 2.5) if k % 3 else rng.uniform(2.4, 3.0)
        p = Chunk(pos, (rr, rr * rng.uniform(.6, .9), rr * rng.uniform(.6, .8)), mat='rockp')
        p.post = planet_post(p, 'rock', seed=k, scale=1.2)
        s.add(p)
    return fin(s)


def volcano():
    """용암 행성: 검은 현무암 껍질에 빛나는 용암 균열·호수 + 분출 기둥."""
    s = Scene()
    planet(s, 0, 20, 0, 13, 'lava', mat='basalt', seed=5, scale=2.4)
    top = np.array([3, 20 - 2, 13 * SQ * .9])
    for i, (dx, dz, rr) in enumerate(((0, 1.5, 1.6), (1.2, 4, 1.3), (2.6, 6.2, 1.0))):
        add(s, Chunk(top + np.array([dx, -1, dz]), (rr, rr * SQ, rr * SQ), mat='lavaglow', contour=False), glow('lavaglow', .5 + .1 * i))
    return fin(s)


def floating():
    """다이슨 고리 조각: 별 위를 활처럼 감싼 거대한 고리 판 조각(안쪽은 태양판, 바깥 면에는 탑·불빛, 끊긴 끝은 골조) + 가운데 별."""
    s = Scene()
    c = np.array([0, 20, 0.0])
    ax = np.array([0, -.49, 1.0])
    R = basis(ax, (1, 0, 0))
    arc = Ring(c, ax, 34, 38.5, 10, a=(22, 158), mat='concrete')

    def panels(tag, P, col, s_, n):
        tg = np.asarray(tag, dtype=object)
        inner = tg == 'inner'
        q = arc.local(P)
        th = np.degrees(np.arctan2(q[:, 1], q[:, 0]))
        cell = (np.mod(th, 3.0) < .7) | (np.mod(q[:, 2] + 5, 2.5) < .8)
        out = np.where(inner[:, None], dk('solar', s_, 0), col)
        out = np.where((inner & cell)[:, None], dk('solar', s_, -1), out)
        top = tg == 'top'
        lt = top & (np.mod(th, 5) < 1.0) & (np.mod(np.floor(np.hypot(q[:, 0], q[:, 1])), 2) == 0) & (L.H(np.floor(th / 5).astype(np.int64), 1, 2) > .35)
        out = np.where(lt[:, None], LIT[None, :], out)
        rib = (tg == 'outer') & (np.mod(th, 9) < 1.2)
        out = np.where(rib[:, None], dk('concrete', s_, -1), out)
        return out.astype(np.uint8)
    add(s, arc, panels)
    for a, h in ((48, 5), (74, 8), (106, 5), (132, 7)):
        th = math.radians(a)
        Rk = R @ M.rot_z(th)
        base = c + R @ np.array([math.cos(th) * 36.2, math.sin(th) * 36.2, 5 + h / 2])
        ob_(s, base, (2.8, 2.8, h), Rk, mat='white', post=lights(.4, (2, 2), seed=a, mat='white'))
        lamp(s, *(c + R @ np.array([math.cos(th) * 36.2, math.sin(th) * 36.2, 5 + h + .7])), r=1.1)
    for a in (22, 158):
        th = math.radians(a)
        for dz in (-3.5, 0, 3.5):
            th2 = th + math.radians(-6 if a == 22 else 6)
            p0 = c + R @ np.array([math.cos(th) * 36.2, math.sin(th) * 36.2, dz])
            p1 = c + R @ np.array([math.cos(th2) * 36.2, math.sin(th2) * 36.2, dz + 1])
            beam(s, p0, p1, 1.2, 'steel')
    sph(s, *c, 9.5, 'sun', post=glow('sun', .5))
    for k in range(8):                                        # 홍염: 별 둘레의 짧은 불꽃 혀
        th = 2 * math.pi * (k + .5) / 8
        dv = R @ np.array([math.cos(th), math.sin(th), 0])
        add(s, Chunk(c + dv * 9.6 + R[:, 2] * -1, (1.6, 1.6, 1.6), mat='lavaglow', contour=False), glow('lavaglow', .7))
    return fin(s)


ORDER = [
    ('capital', '모항성 수도', 'capital', (6, 6), '대양·대륙의 푸른 큰 행성 + 바위 고리 + 기울어진 궤도 도시 고리 + 위성'),
    ('fort_city', '요새 정거장', 'fort_city', (4, 4), '정면을 보는 바퀴 고리 정거장 + 바퀴살 + 네 방위 포대'),
    ('harbor_city', '우주 조선소', 'harbor_city', (5, 4), '골조 도크 안 건조 중인 함선(뒤 철판·앞 늑골) + 크레인 + 관제동'),
    ('castle', '적 기함', 'castle', (3, 3), '붉은 띠의 검은 쐐기 전함 + 함교탑·포탑 + 추진 불꽃'),
    ('castle', '군 요새 위성', 'castle_fortmoon', (3, 3), '적도 참호·거대 포구 접시·꼭대기 포탑이 있는 회색 위성'),
    ('large_town', '개척 행성', 'large_town', (3, 3), '초록 대륙의 행성 + 작은 위성 + 개척 정거장'),
    ('village', '소행성 채굴촌', 'village', (2, 2), '바위 소행성 + 유리·흰 돔 + 채굴 탑'),
    ('village', '얼음 위성', 'village_ice', (2, 2), '푸른 금이 간 얼음 구 + 기지 돔·안테나'),
    ('camp', '보급선 정박지', 'camp', (2, 2), '연료 탱크 정박탑 + 양쪽에 붙은 작은 보급선 둘'),
    ('tower_small', '항법 부표', 'tower_small', (1, 2), '돛대 + 태양 날개 + 빛나는 비콘'),
    ('tower_great', '궤도 엘리베이터', 'tower_great', (2, 4), '행성 지평선에서 뻗은 줄 + 승강기 + 중간·꼭대기 정거장 + 평형추'),
    ('cave', '점프 게이트', 'cave', (2, 2), '빛 마디 금속 고리 문 + 소용돌이 웜홀'),
    ('ruin', '함선 잔해', 'ruin', (2, 2), '두 동강 난 선체 + 드러난 늑골 + 파편'),
    ('ruin_city', '파괴된 행성', 'ruin_city', (4, 3), '다섯 조각으로 흩어지는 행성 껍질 + 녹은 속 + 빛나는 핵'),
    ('shrine', '고대 외계 유물', 'shrine', (3, 3), '떠 있는 빛 문자 팔면체 + 금 고리 + 떠 있는 돌기둥'),
    ('landmark_nature', '가스 거인', 'landmark_nature', (3, 3), '줄무늬 큰 행성 + 붉은 대폭풍 + 얼음 위성'),
    ('circle', '소행성 고리', 'circle', (2, 2), '작은 얼음 왜행성을 도는 바위 덩이 고리'),
    ('volcano', '용암 행성', 'volcano', (2, 2), '용암 균열·호수의 현무암 행성 + 분출'),
    ('floating', '다이슨 고리 조각', 'floating', (5, 4), '별 위를 활처럼 감싼 거대 고리 판 조각(안쪽 태양판·바깥 탑·끊긴 골조) + 홍염 별'),
]
