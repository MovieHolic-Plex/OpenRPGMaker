"""사막·동양풍 확장 — oblique.py(경사 투영 레이캐스터)에 동양식 입체를 더한다.

oblique.py 는 그대로 쓴다(복사본). 여기서 더하는 것:
  • 입체: Ellip(타원체: 구름·수관·무덤), InvCone(거꾸로 원뿔: 떠 있는 섬 밑), 팔각기둥·팔각뿔(oct_prism / oct_roof)
  • 지붕: tile_roof — 처마가 낮고 마루가 가파른 「오목 지붕」(완만한 절두 우진각 + 가파른 우진각을 합집합) + 네 귀 추녀 끝
  • 재질: 모두 원본 EasyRPG World.png 에 있는 색(새 색 0개) — tile(청회 기와) · jade(청자 기와) · thatch(초가) · cloud
  • 결: 'tile'(내림마루 줄무늬) · 'speck'(잎·구름 점)
모든 면은 투영 규칙(윗면 / 앞면 / 오른쪽면)으로만 나온다 — 손으로 윗면을 그리지 않는다.
"""
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import numpy as np  # noqa: E402
import oblique as ob  # noqa: E402
from oblique import Scene, Poly, Prim, Cone, Cyl, INF, finish, hsh  # noqa: E402
import icons_v9_lib as L  # noqa: E402
from icons_v9_lib import (STONE, WSTONE, WOOD, ROCK, RED, BLUE, SNOW, LEAF, VOLC, LAVA, WATER, SAND, GOLD, GREY, hx)  # noqa: E402

# ── 재질(전부 World.png 색) ───────────────────────────────────────────────────────────────────────
TILE = [hx(c) for c in ('2c3738', '445353', '475b63', '5d6869', '6e7d91', '8192a7')]            # 청회 기와
JADE = [hx(c) for c in ('13522e', '2c634c', '308050', '53856c', '61a080', '7f9d8a')]            # 청자(옥색) 기와
THATCH = [hx(c) for c in ('65442a', '77693c', '9d8e5c', 'b99664', 'cdc286', 'd5d288')]          # 초가·짚
CLOUD = [hx(c) for c in ('6fb1ff', '98d0f0', 'c8ebff', 'cfecec', 'dcf7f9', 'f0faff')]          # 구름
FELT = [hx(c) for c in ('564a3e', '766e60', 'b9ab9d', 'd8cbac', 'e1d7c1', 'e9dec3')]           # 흰 펠트(게르)
BARK = [hx(c) for c in ('411e05', '5f4324', '75472d', '8b7465', '9a8b60', 'b79d79')]           # 바오바브 줄기
ob.MAT.update({'wstone': [WSTONE[1], WSTONE[2], WSTONE[3], WSTONE[4], WSTONE[5]],
               'greywall': [hx('363540'), hx('564a3e'), hx('766e60'), hx('b9ab9d'), hx('d8cbac')],
               'tile': TILE, 'jade': JADE, 'thatch': THATCH, 'cloud': CLOUD, 'felt': FELT, 'bark': BARK,
               'goldroof': [GOLD[0], GOLD[1], GOLD[2], GOLD[3], GOLD[4], hx('f3aa38')],
               'redwall': [RED[1], RED[2], RED[3], RED[4], RED[5], RED[6]],
               'leaf2': [LEAF[1], LEAF[2], LEAF[3], LEAF[4], LEAF[5], LEAF[6]],
               'rock': [ROCK[1], ROCK[2], ROCK[3], ROCK[4], ROCK[5], ROCK[6], ROCK[7]],
               'ember': [LAVA[0], LAVA[1], LAVA[2], LAVA[3], LAVA[4], LAVA[5]]})
for _r, _o in ((TILE, '1d2c33'), (JADE, '13522e'), (THATCH, '411e05'), (CLOUD, '6fb1ff'), (FELT, '564a3e'), (BARK, '291010')):
    L._reg(_r, hx(_o))


def _n(v):
    v = np.array(v, float)
    return v / np.linalg.norm(v)


# ── 새 입체 ───────────────────────────────────────────────────────────────────────────────────────
class Ellip(Prim):
    def __init__(self, xc, yc, zc, rx, ry, rz, mat='stone', tex='plain', role='misc', contour=False, decals=()):
        self.c = np.array([xc, yc, zc], float)
        self.r = np.array([rx, ry, rz], float)
        self.mat, self.tex, self.role, self.contour, self.decals = mat, tex, role, contour, decals

    def ray(self, O, D):
        o = (O - self.c) / self.r
        d = D / self.r
        a = float(d @ d)
        b = 2 * (o @ d)
        cc = (o * o).sum(1) - 1
        disc = b * b - 4 * a * cc
        ok = disc >= 0
        t = (-b - np.sqrt(np.where(ok, disc, 0))) / (2 * a)
        return np.where(ok, t, INF), np.zeros(len(t), int)

    def normal(self, face, P_):
        n = (P_ - self.c) / self.r ** 2
        nn = np.linalg.norm(n, axis=1)
        nn[nn == 0] = 1
        return n / nn[:, None]

    def tag_of(self, face):
        return np.array(['side'] * len(face), dtype=object)


class InvCone(Cone):
    """꼭짓점이 아래인 원뿔(떠 있는 섬의 밑, 바위 기둥). 위에서 z 를 뒤집어 Cone 레이로 푼다."""

    def __init__(self, xc, yc, r, zb, zt, mat='rock', tex='speck', role='misc', contour=False, decals=()):
        # 거울 공간: 꼭짓점이 위(−zb), 밑면이 −zt
        Cone.__init__(self, xc, yc, r, -zt, -zb, mat=mat, tex=tex, role=role, contour=contour, decals=decals)
        self.zb, self.zt_ = zb, zt

    @staticmethod
    def _mir(a):
        a = np.array(a, float)
        a[..., 2] *= -1
        return a

    def ray(self, O, D):
        return Cone.ray(self, self._mir(O), self._mir(D))

    def normal(self, face, P_):
        n = Cone.normal(self, face, self._mir(P_))
        n[:, 2] *= -1
        return n

    def tag_of(self, face):
        return np.array(['slope', 'top'], dtype=object)[face]


def _tag(nx, ny):
    if abs(ny) >= abs(nx) * 0.99 or (abs(nx) > .3 and abs(ny) > .3):
        return 'front' if ny < 0 else 'back'
    return 'right' if nx > 0 else 'left'


def oct_prism(xc, yc, r, z0, z1, rot=0.0, **kw):
    """팔각기둥. r = 변까지의 거리(apothem). 앞면 정면이 평평하다."""
    pl = []
    for k in range(8):
        th = math.radians(-90 + 45 * k + rot)
        n = (math.cos(th), math.sin(th), 0)
        pl.append((n, n[0] * xc + n[1] * yc + r, _tag(*n[:2])))
    pl += [((0, 0, 1), z1, 'top'), ((0, 0, -1), -z0, 'bottom')]
    return Poly(pl, **kw)


def oct_pyr(xc, yc, r, z0, zt, ztrunc=None, rot=0.0, **kw):
    """팔각뿔(지붕). 밑 변거리 r, 꼭짓점 zt. ztrunc 가 있으면 그 높이에서 자른다."""
    s = r / (zt - z0)
    pl = []
    for k in range(8):
        th = math.radians(-90 + 45 * k + rot)
        n = (math.cos(th), math.sin(th), s)
        dirn = 'F' if math.sin(th) < -.3 else 'B' if math.sin(th) > .3 else ('R' if math.cos(th) > 0 else 'L')
        pl.append((n, n[0] * xc + n[1] * yc + s * zt, 'slope' + dirn))
    pl.append(((0, 0, -1), -z0, 'bottom'))
    if ztrunc is not None:
        pl.append(((0, 0, 1), ztrunc, 'top'))
    return Poly(pl, **kw)


def hip_t(x0, x1, y0, y1, z0, s, ztrunc=None, **kw):
    """우진각(사각뿔대). 면 이름 slopeF/B/L/R (기와 줄무늬 방향용)."""
    pl = [((0, -s, 1), z0 - s * y0, 'slopeF'), ((-s, 0, 1), z0 - s * x0, 'slopeL'),
          ((s, 0, 1), z0 + s * x1, 'slopeR'), ((0, s, 1), z0 + s * y1, 'slopeB'), ((0, 0, -1), -z0, 'bottom')]
    if ztrunc is not None:
        pl.append(((0, 0, 1), ztrunc, 'top'))
    kw.setdefault('tex', 'tile')
    kw.setdefault('mat', 'tile')
    return Poly(pl, **kw)


def gable_ns(x0, x1, y0, y1, z0, s, **kw):
    """박공(마루가 y 방향, 즉 정면에서 보아 마루가 안쪽으로 달린다)."""
    pl = [((-s, 0, 1), z0 - s * x0, 'slopeL'), ((s, 0, 1), z0 + s * x1, 'slopeR'),
          ((0, -1, 0), -y0, 'front'), ((0, 1, 0), y1, 'back'), ((0, 0, -1), -z0, 'bottom')]
    kw.setdefault('tex', 'tile')
    kw.setdefault('mat', 'tile')
    return Poly(pl, **kw)


def gable_ew(x0, x1, y0, y1, z0, s, **kw):
    """박공(마루가 x 방향) — 앞 경사 slopeF 와 뒤 경사. 좌우는 박공벽."""
    pl = [((0, -s, 1), z0 - s * y0, 'slopeF'), ((0, s, 1), z0 + s * y1, 'slopeB'),
          ((-1, 0, 0), -x0, 'left'), ((1, 0, 0), x1, 'right'), ((0, 0, -1), -z0, 'bottom')]
    kw.setdefault('tex', 'tile')
    kw.setdefault('mat', 'tile')
    return Poly(pl, **kw)


# ── 결 ────────────────────────────────────────────────────────────────────────────────────────────
_orig_tex = ob._tex_delta
_orig_decal = ob._apply_decal


def _tex_delta2(p, tag, P_, face):
    t = np.asarray(tag, dtype=object)
    x, y, z = P_[:, 0], P_[:, 1], P_[:, 2]
    if p.tex == 'tile':
        d = np.zeros(len(x), int)
        sl = np.array([str(v).startswith('slope') for v in t])
        fb = np.array([str(v) in ('slopeF', 'slopeB') for v in t])
        a = np.where(fb, x, y)
        d[sl & (np.mod(np.floor(a), 2) == 0)] -= 1
        return d
    if p.tex == 'speck':
        d = np.zeros(len(x), int)
        h = hsh(x * 1.0, y + z, 9)
        d[h > .86] += 1
        d[h < .12] -= 1
        return d
    if p.tex == 'strata':       # 사암 지층(가로 띠)
        d = np.zeros(len(x), int)
        row = np.floor(z / 2.5)
        d[(np.mod(z, 2.5) < .9) & (hsh(row, 0, 3) > .3)] -= 1
        d[(np.mod(z, 2.5) > 1.7) & (hsh(row, 1, 4) > .6)] += 1
        h = hsh(x, y + z, 8)
        d[h > .93] += 1
        return d
    if p.tex == 'ribs':         # 돛 살(가로 대나무)
        d = np.zeros(len(x), int)
        d[np.mod(np.floor(z), 3) == 0] -= 1
        return d
    if p.tex == 'plank':        # 세로 널(문·목재벽)
        d = np.zeros(len(x), int)
        d[np.mod(np.floor(x), 3) == 0] -= 1
        return d
    if p.tex == 'adobe':        # 흙벽돌 — 줄눈 대신 성긴 점
        d = np.zeros(len(x), int)
        h = hsh(x, z + y, 5)
        d[h > .9] += 1
        d[h < .08] -= 1
        return d
    return _orig_tex(p, tag, P_, face)


ob._tex_delta = _tex_delta2


def _apply_decal2(p, dc, tag, P_, col):
    kind = dc[0]
    spec = dc[1]
    mode = spec[4] if len(spec) > 4 else 'dark'
    if kind in ('front', 'right', 'left', 'back') and mode in ('red', 'reddoor', 'win', 'shut', 'lat', 'arch', 'band', 'gold'):
        t = np.asarray(tag, dtype=object)
        a0, a1, z0, z1 = spec[:4]
        a = P_[:, 0] if kind in ('front', 'back') else P_[:, 1]
        m = (t == kind) & (a >= a0) & (a <= a1) & (P_[:, 2] >= z0) & (P_[:, 2] <= z1)
        if mode == 'red':
            col[m] = np.array(RED[3], np.uint8)
        elif mode == 'reddoor':
            col[m] = np.array(RED[2], np.uint8)
            top = m & (P_[:, 2] >= z1 - 1)
            col[top] = np.array(RED[1], np.uint8)
            stud = m & (np.mod(np.floor(a - a0), 2) == 0) & (np.abs(P_[:, 2] - (z0 + z1) / 2) < 1)
            col[stud] = np.array(GOLD[3], np.uint8)
        elif mode == 'win':
            col[m] = np.array(STONE[1], np.uint8)
            top = m & (P_[:, 2] >= z1 - 1)
            col[top] = np.array(STONE[0], np.uint8)
        elif mode == 'shut':                 # 사막 덧창(청록)
            col[m] = np.array(WATER[1], np.uint8)
            top = m & (P_[:, 2] >= z1 - 1)
            col[top] = np.array(STONE[0], np.uint8)
        elif mode == 'lat':                  # 살창
            col[m] = np.array(WOOD[1], np.uint8)
            bars = m & (np.mod(np.floor(a - a0), 2) == 0)
            col[bars] = np.array(WOOD[4], np.uint8)
        elif mode == 'arch':                 # 어두운 아치 입구
            cx = (a0 + a1) / 2
            half = (a1 - a0) / 2
            zc = z1 - half
            inside = m & ((P_[:, 2] <= zc) | (((a - cx) ** 2 + (P_[:, 2] - zc) ** 2) <= half * half))
            col[inside] = np.array(STONE[0], np.uint8)
            deep = inside & (P_[:, 2] < z0 + (z1 - z0) * .45)
            col[deep] = np.array(L.OUT, np.uint8)
        elif mode == 'band':                 # 가로띠(채색)
            col[m] = np.array(RED[2], np.uint8)
        elif mode == 'gold':
            col[m] = np.array(GOLD[3], np.uint8)
        return col
    return _orig_decal(p, dc, tag, P_, col)


ob._apply_decal = _apply_decal2


# ── 장면 부품 ─────────────────────────────────────────────────────────────────────────────────────
def tile_roof(s, x0, x1, y0, y1, z0, rise, mat='tile', fa=.42, fh=.30, tips=2.2, contour=True, role='roof', tex='tile'):
    """오목 지붕. 처마 밑변 (x0..x1, y0..y1), 높이 rise. 아래는 완만한 사각뿔대, 위는 가파른 우진각 — 합집합이라 단면이 오목하다.
    네 귀에 작은 추녀 끝(귀솟음) 을 얹는다."""
    m = min(x1 - x0, y1 - y0) / 2
    i1 = fa * m
    h1 = fh * rise
    s1 = h1 / i1
    s2 = (rise - h1) / max(m - i1, .5)
    lo = hip_t(x0, x1, y0, y1, z0, s1, ztrunc=z0 + h1, mat=mat, contour=contour, role=role, tex=tex)
    up = hip_t(x0 + i1, x1 - i1, y0 + i1, y1 - i1, z0 + h1 - .01, s2, mat=mat, contour=contour, role=role, tex=tex)
    s.add(lo)
    s.add(up)
    if tips:
        for cx in (x0, x1):
            for cy in (y0, y1):
                sx = 1 if cx == x0 else -1
                sy = 1 if cy == y0 else -1
                bx0, bx1 = (cx - .6, cx + 1.0) if sx > 0 else (cx - 1.0, cx + .6)
                by0, by1 = (cy - .6, cy + 1.0) if sy > 0 else (cy - 1.0, cy + .6)
                s.add(ob.box(bx0, bx1, by0, by1, z0 - .3, z0 + tips * .6, mat=mat, tex='plain', role=role, contour=False))


def eave_roof(s, x0, x1, y0, y1, z0, rise, mat='tile', **kw):
    tile_roof(s, x0, x1, y0, y1, z0, rise, mat=mat, **kw)


def oct_roof(s, xc, yc, r, z0, rise, mat='tile', fa=.45, fh=.28, contour=True, role='roof', tip=True):
    """팔각 오목 지붕 + 꼭대기 장식. r = 처마까지 변거리."""
    i1 = fa * r
    h1 = fh * rise
    s.add(oct_pyr(xc, yc, r, z0, z0 + h1 * r / (r - i1), ztrunc=z0 + h1, mat=mat, tex='tile', contour=contour, role=role))
    s.add(oct_pyr(xc, yc, r - i1, z0 + h1 - .01, z0 + rise, mat=mat, tex='tile', contour=contour, role=role))
    if tip:
        s.add(ob.Cyl(xc, yc, .9, z0 + rise - .2, z0 + rise + 2.6, mat='goldroof', tex='plain', role=role))


def pillars(s, x0, x1, y, z0, z1, n, mat='redwall', w=1.6, d=1.4):
    """앞면 기둥 n 개(양 끝 포함). y 는 벽 앞면의 y."""
    for i in range(n):
        px = x0 + (x1 - x0 - w) * i / max(n - 1, 1)
        s.add(ob.box(px, px + w, y - d, y, z0, z1, mat=mat, tex='plain', role='misc'))


def hall(s, x, y, w, d, wh, rise, plinth=2.0, plat=2.0, mat='tile', wall='plaster', npil=4, door=True, over=3.0, roofz=None,
         cap=None, role='wall', double=False, windows=True):
    """전각(기와집). 기단 + 흰 벽 + 붉은 기둥·들보 + 오목 기와지붕. 반환: 지붕 시작 z."""
    z0 = plat
    if plat > 0:
        s.box(x - 2, x + w + 2, y - 2, y + d + 2, 0, plat, mat='stone', tex='brick', role='misc', contour=True)
    decs = []
    if door:
        cx = x + w / 2
        decs.append(('front', (cx - 1.8, cx + 1.8, z0, z0 + min(wh - 1.5, 5.5), 'reddoor')))
    if windows and w >= 14:
        for fx in (.2, .8):
            wx = x + w * fx
            decs.append(('front', (wx - 1.2, wx + 1.2, z0 + wh * .45, z0 + wh * .8, 'lat')))
    s.box(x, x + w, y, y + d, z0, z0 + wh, mat=wall, tex='plain', role=role, contour=True, decals=tuple(decs))
    pillars(s, x - .3, x + w + .3, y, z0, z0 + wh, npil)
    s.add(ob.box(x - .4, x + w + .4, y - 1.4, y + d + .4, z0 + wh - 1.5, z0 + wh, mat='redwall', tex='plain', role='misc'))
    rz = z0 + wh
    tile_roof(s, x - over, x + w + over, y - over, y + d + over, rz, rise, mat=mat)
    return rz + rise


def gate_wall(s, x0, x1, y0, y1, h, mat='plaster', cap='tile', capw=1.4, role='wall', tex='plain', gate=None, ends=()):
    """기와 담장(담 + 기와 지붕선)."""
    s.box(x0, x1, y0, y1, 0, h, mat=mat, tex=tex, role=role, contour=True)
    s.add(ob.box(x0 - capw, x1 + capw, y0 - capw, y1 + capw, h, h + 1.6, mat=cap, tex='plain', role='misc', contour=True))
    s.add(ob.box(x0 - capw + 1, x1 + capw - 1, y0 - capw + 1, y1 + capw - 1, h + 1.6, h + 2.6, mat=cap, tex='plain', role='misc'))


def ground(x0, x1, y0, y1, kind='grass'):
    return None


def hull(x0, x1, y0, y1, z0, z1, rise=.5, **kw):
    """배 선체: 양 끝이 위로 들린 상자(투영 규칙으로 윗면 갑판·앞면 뱃전·오른쪽 뱃머리가 나온다)."""
    pl = [((1, 0, -rise), x1 - rise * z0, 'right'), ((-1, 0, -rise), -x0 - rise * z0, 'left'),
          ((0, 1, 0), y1, 'back'), ((0, -1, 0), -y0, 'front'), ((0, 0, 1), z1, 'top'), ((0, 0, -1), -z0, 'bottom')]
    return Poly(pl, **kw)


def sail(m, y, z0, z1, length, thick=.8, **kw):
    """삼각돛(마루 쪽이 기둥, 아래가 길다)."""
    h = z1 - z0
    pl = [((-1, 0, 0), -m, 'left'), ((0, 0, -1), -z0, 'bottom'), ((0, -1, 0), -y, 'front'), ((0, 1, 0), y + thick, 'back'),
          ((h, 0, length), h * m + length * z1, 'right')]
    kw.setdefault('tex', 'ribs')
    return Poly(pl, **kw)
