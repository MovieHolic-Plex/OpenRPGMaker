"""일본 전국(sengoku) 월드맵 아이콘 — 정면 카메라용 장면.
흰 회벽·검은(짙은 회흑) 기와·천수각·경사진 돌 축대(이시가키)·붉은 도리이·신사·벚나무.
조선·중국풍과 섞이지 않게: 지붕은 짙은 회흑, 용마루 끝 금색 샤치호코, 축대는 비스듬히 기운 돌벽.
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
from icons_v9_lib import STONE, WSTONE, WOOD, ROCK, RED, SNOW, LEAF, VOLC, LAVA, WATER, GOLD, hx  # noqa: E402
from oblique import Scene, Poly, box  # noqa: E402

SET = dict(id='sengoku', name='일본 전국')

# ── 재질 ───────────────────────────────────────────────────────────────────────────────────────────
KURO = [hx(c) for c in ('1d2c33', '2c3738', '445353', '475b63', '5d6869', '6e7d91')]     # 회흑 기와(World 색)
SAKURA = [hx(c) for c in ('8c3a52', 'b9587a', 'd9849e', 'eeb0c2', 'fad6e0')]              # 벚꽃(새 색 5)
ob.MAT.update({
    'kuro': KURO,
    'shiro': [WSTONE[1], WSTONE[2], WSTONE[3], WSTONE[4], WSTONE[5], WSTONE[5]],                          # 흰 회벽
    'ishi': [STONE[0], hx('363540'), hx('564a3e'), hx('766e60'), hx('b9ab9d'), hx('d8cbac')],  # 축대 돌
    'shu': [RED[1], RED[2], RED[3], RED[4], RED[5], RED[6]],                               # 주칠(도리이)
    'sumi': [STONE[0], hx('1d2c33'), hx('2c3738'), hx('445353'), hx('475b63')],            # 숯·탄 기둥
    'ash': [VOLC[0], VOLC[1], VOLC[2], VOLC[3], VOLC[4], VOLC[5]],                         # 화산재·연기
    'sakura': SAKURA,
    'fuji': [hx('1d2c33'), STONE[2], STONE[3], STONE[4], STONE[5], STONE[6]],             # 설산 몸통(청회)
    'snow': [SNOW[1], SNOW[2], SNOW[3], SNOW[4], SNOW[5]],
    'mwater': [WATER[0], WATER[1], WATER[2], WATER[3], WATER[4]],
    'kaya': [hx(c) for c in ('65442a', '77693c', '9d8e5c', 'b99664', 'cdc286')],            # 초가
})
L._reg(KURO, hx('111618'))
L._reg(SAKURA, hx('5a2238'))
L._reg(ob.MAT['fuji'], hx('111618'))


# ── 결: 이시가키(크기 다른 돌 줄) ─────────────────────────────────────────────────────────────
_prev_tex = ob._tex_delta


def _tex3(p, tag, P_, face):
    if p.tex == 'ishi':
        t = np.asarray(tag, dtype=object)
        x, y, z = P_[:, 0], P_[:, 1], P_[:, 2]
        d = np.zeros(len(x), int)
        vert = np.isin(t, ['front', 'back', 'left', 'right'])
        a = np.where(np.isin(t, ['front', 'back']), x, y)
        row = np.floor(z / 2.0)
        off = ob.hsh(row, 3, 7) * 4
        d[vert & (np.mod(z, 2.0) < .75)] -= 1
        d[vert & (np.mod(a + off + row * 1.7, 3.5) < .8)] -= 1
        d[vert & (ob.hsh(np.floor((a + off) / 3.5), row, 5) > .75) & (np.mod(z, 2.0) >= .75)] += 1
        top = t == 'top'
        d[top & (ob.hsh(x, y, 9) > .9)] -= 1
        return d
    if p.tex == 'kawara':          # 기와 골: 경사면 세로 줄 + 처마 끝 한 줄 밝게
        t = np.asarray(tag, dtype=object)
        x, z = P_[:, 0], P_[:, 2]
        d = np.zeros(len(x), int)
        sl = np.array([str(v).startswith('slope') for v in t])
        d[sl & (np.mod(np.floor(x), 2) == 0)] -= 1
        return d
    return _prev_tex(p, tag, P_, face)


ob._tex_delta = _tex3


# ── 부품 ───────────────────────────────────────────────────────────────────────────────────────
def ishigaki(s, x0, x1, y0, y1, h, bat=.35, mat='ishi', role='wall', faces='flrb'):
    """비스듬히 기운 돌 축대(위로 갈수록 안으로 들어간다)."""
    bf = bat if 'f' in faces else 0
    bl = bat if 'l' in faces else 0
    br = bat if 'r' in faces else 0
    bb = bat if 'b' in faces else 0
    pl = [((0, -1, bf), -y0, 'front'), ((-1, 0, bl), -x0, 'left'), ((1, 0, br), x1, 'right'), ((0, 1, bb), y1, 'back'),
          ((0, 0, 1), h, 'top'), ((0, 0, -1), 0, 'bottom')]
    return s.add(Poly(pl, mat=mat, tex='ishi', role=role, contour=True))


def shachi(s, xa, xb, y, z):
    """용마루 양 끝 금색 샤치호코."""
    for x in (xa, xb):
        s.box(x - .6, x + .6, y - .5, y + .5, z - .3, z + 1.6, mat='goldroof', tex='plain', role='roof')


def roof(s, x0, x1, y0, y1, z, rise, tips=1.0, mat='kuro', sh=False):
    E.tile_roof(s, x0, x1, y0, y1, z, rise, mat=mat, tips=tips, tex='kawara')
    if sh:
        dd = (y1 - y0) / 2
        shachi(s, x0 + dd + .4, x1 - dd - .4, (y0 + y1) / 2, z + rise)


def hafu(s, xc, y, w, z, h, mat='kuro'):
    """지붕 앞 삼각 박공(치도리하후): 흰 삼각 면 + 검은 기와 테."""
    s.add(E.gable_ns(xc - w / 2, xc + w / 2, y, y + 3.0, z, h / (w / 2), mat=mat, tex='kawara', contour=True, role='roof'))
    s.add(E.gable_ns(xc - w / 2 + .9, xc + w / 2 - .9, y - .3, y + 2.0, z + .2, h / (w / 2), mat='shiro', tex='plain', contour=False, role='roof'))


def wins(x0, x1, z0, z1, step=3.0, w=1.2):
    out = []
    n = max(1, int((x1 - x0 - 1) // step))
    span = n * step
    st = x0 + (x1 - x0 - span) / 2 + (step - w) / 2
    for i in range(n):
        out.append(('front', (st + i * step, st + i * step + w, z0, z1, 'dark')))
    return tuple(out)


def tenshu(s, xc, yc, z0, w, d, n=5, h=3.6, rise=2.4, dw=2.6, dd=1.6, over=1.8, top_rise=4.0, hafu_at=(), win=True, black=False):
    """천수각: 층마다 흰 회벽 + 검은 기와 처마. 맨 위는 샤치호코."""
    z = z0
    for i in range(n):
        ww, dp = w - dw * i, d - dd * i
        x0, x1, y0, y1 = xc - ww / 2, xc + ww / 2, yc - dp / 2, yc + dp / 2
        last = i == n - 1
        hh = h * (1.05 if last else 1)
        dec = wins(x0 + .8, x1 - .8, z + hh * .45, z + hh * .72, step=3.2 if ww > 9 else 2.8, w=1.0) if win else ()
        s.box(x0, x1, y0, y1, z, z + hh, mat='kuro' if black else 'shiro', tex='plank' if black else 'plain', role='keep', contour=True, decals=dec)
        r = top_rise if last else rise
        roof(s, x0 - over, x1 + over, y0 - over, y1 + over, z + hh, r, tips=1.0, sh=last)
        if i in hafu_at and not last:
            hafu(s, xc, y0 - over + .2, min(ww * .55, 7), z + hh + .2, r + 1.0)
        z += hh + r * .5
    return z


def wood_wall_fence(s, x0, x1, y, h=2.6, mat='shiro'):
    """흰 담(塀) + 기와 갓."""
    s.box(x0, x1, y, y + 1.2, 0, h, mat=mat, tex='plain', role='wall', contour=True)
    s.box(x0 - .4, x1 + .4, y - .5, y + 1.7, h, h + .9, mat='kuro', tex='plain', role='misc', contour=True)


def yagura(s, x, y, w, d, z0, h=3.4, rise=2.6, floors=2):
    """모서리 망루(스미야구라)."""
    z = z0
    for i in range(floors):
        ww, dp = w - 1.6 * i, d - 1.0 * i
        cx, cy = x + w / 2, y + d / 2
        s.box(cx - ww / 2, cx + ww / 2, cy - dp / 2, cy + dp / 2, z, z + h, mat='shiro', tex='plain', role='tower', contour=True,
              decals=wins(cx - ww / 2 + .4, cx + ww / 2 - .4, z + h * .4, z + h * .75, step=2.6))
        roof(s, cx - ww / 2 - 1.3, cx + ww / 2 + 1.3, cy - dp / 2 - 1.3, cy + dp / 2 + 1.3, z + h, rise, tips=.8, sh=(i == floors - 1 and ww > 7))
        z += h + rise * .5
    return z


def machiya(s, x, y, w, d=5.0, h1=3.2, h2=2.6, rise=2.4, two=True, noren=None):
    """마치야: 아래 나무 격자 가게 + 차양 + 위 흰 벽(무시코창) + 박공 기와."""
    dec = [('front', (x + .6, x + w - .6, .4, h1 - .5, 'lat'))]
    if noren:
        dec.append(('front', (x + w / 2 - 1.2, x + w / 2 + 1.2, h1 - 1.4, h1 - .4, noren)))
    s.box(x, x + w, y, y + d, 0, h1, mat='wood', tex='plank', role='house', contour=True, decals=tuple(dec))
    if two:
        s.box(x - .2, x + w + .2, y - 1.1, y + .6, h1 - .2, h1 + .6, mat='kuro', tex='plain', role='misc', contour=True)
        s.box(x, x + w, y + .5, y + d, h1, h1 + h2, mat='shiro', tex='plain', role='house', contour=True,
              decals=(('front', (x + w / 2 - 1.4, x + w / 2 + 1.4, h1 + .9, h1 + h2 - .7, 'lat')),))
        zt = h1 + h2
        y0 = y + .5
    else:
        zt = h1
        y0 = y
    s.add(E.gable_ew(x - .6, x + w + .6, y0 - 1.0, y + d + .8, zt, rise / ((y + d + .8 - y0 + 1.0) / 2), mat='kuro', tex='kawara', contour=True, role='roof'))


def kura(s, x, y, w, d, h=5.0, rise=2.6):
    """흰 창고(도조): 흰 벽, 아래 검은 띠(나마코 벽 대신), 작은 창, 박공 기와."""
    s.box(x, x + w, y, y + d, 0, h, mat='shiro', tex='plain', role='house', contour=True,
          decals=(('front', (x, x + w, 0, 1.2, 'dark')), ('front', (x + w / 2 - .8, x + w / 2 + .8, h * .55, h * .8, 'dark')),
                  ('front', (x + w / 2 - 1.1, x + w / 2 + 1.1, 0, 2.6, 'door'))))
    s.add(E.gable_ew(x - .7, x + w + .7, y - .9, y + d + .9, h, rise / (d / 2 + .9), mat='kuro', tex='kawara', contour=True, role='roof'))


def minka(s, x, y, w, d, wh=3.4, rise=5.2, wall='wood'):
    """초가 농가(가파른 우진각 초가)."""
    s.box(x, x + w, y, y + d, 0, wh, mat=wall, tex='plank', role='house', contour=True,
          decals=(('front', (x + w * .3, x + w * .3 + 2.2, 0, 2.8, 'dark')), ('front', (x + w * .62, x + w * .85, 1.2, 2.6, 'lat'))))
    sl = rise / (min(w, d) / 2 + 1.3)
    s.add(E.hip_t(x - 1.3, x + w + 1.3, y - 1.3, y + d + 1.3, wh, sl, ztrunc=wh + rise * .92, mat='kaya', tex='speck', contour=True, role='roof'))
    s.box(x + w * .2, x + w * .8, y + d / 2 - .6, y + d / 2 + .6, wh + rise * .9, wh + rise + .4, mat='kuro', tex='plain', role='roof')


def torii(s, xc, y, w, h, r=.7, big=False):
    """붉은 도리이: 기둥 둘 + 누키 + 검은 가사기."""
    for px in (xc - w / 2, xc + w / 2):
        s.cyl(px, y, r, 0, h, mat='shu', tex='plain', role='misc', contour=True)
        if big:
            s.cyl(px, y, r + .4, 0, 1.0, mat='sumi', tex='plain', role='misc')
    t = .8 if not big else 1.0
    s.box(xc - w / 2 - r - .8, xc + w / 2 + r + .8, y - .45, y + .45, h * .74, h * .74 + t, mat='shu', tex='plain', role='misc', contour=True)
    s.box(xc - w / 2 - r - 1.4, xc + w / 2 + r + 1.4, y - .6, y + .6, h - .2, h + t * .9, mat='shu', tex='plain', role='misc', contour=True)
    s.box(xc - w / 2 - r - 2.0, xc + w / 2 + r + 2.0, y - .8, y + .8, h + t * .9, h + t * .9 + (1.0 if big else .8), mat='kuro', tex='plain', role='misc', contour=True)
    if big:
        s.box(xc - .7, xc + .7, y - .5, y + .5, h * .74 + t, h - .2, mat='shu', tex='plain', role='misc')


def lantern(s, x, y, h=4.0):
    """석등."""
    s.cyl(x, y, .7, 0, h * .55, mat='ishi', tex='plain', role='misc', contour=True)
    s.box(x - 1.1, x + 1.1, y - 1.0, y + 1.0, h * .55, h * .8, mat='ishi', tex='plain', role='misc', contour=True,
          decals=(('front', (x - .5, x + .5, h * .6, h * .75, 'lit')),))
    s.add(E.hip_t(x - 1.6, x + 1.6, y - 1.5, y + 1.5, h * .8, .7, mat='ishi', tex='plain', contour=True, role='misc'))


def sakura(s, x, y, h=7.0, r=3.4, trunk=.8):
    s.cyl(x, y, trunk, 0, h * .55, mat='bark', tex='plain', role='misc')
    s.add(E.Ellip(x, y, h * .78, r, r * .8, r * .8, mat='sakura', tex='speck', role='misc', contour=True))


def pine(s, x, y, h=7.0, r=3.0):
    """소나무(층진 납작 수관)."""
    s.cyl(x, y, .6, 0, h * .7, mat='bark', tex='plain', role='misc')
    for k, (zz, rr) in enumerate(((h * .55, r), (h * .78, r * .8), (h * .98, r * .55))):
        s.add(E.Ellip(x + (k % 2) * .6 - .3, y, zz, rr, rr * .7, rr * .4 + .6, mat='leaf2', tex='speck', role='misc', contour=True))


def cedar(s, x, y, h=10.0, r=2.6):
    """삼나무(뾰족 원뿔)."""
    s.cyl(x, y, .5, 0, h * .3, mat='bark', tex='plain', role='misc')
    s.add(ob.Cone(x, y, r, h * .2, h, mat='leaf2', tex='speck', role='misc', contour=True))


def nobori(s, x, y, h=11.0, mat='shu', w=1.6):
    """노보리 깃발: 장대 + 세로 긴 천."""
    s.box(x, x + .5, y, y + .5, 0, h, mat='wood', tex='plain', role='misc')
    s.box(x + .5, x + .5 + w, y, y + .4, h * .4, h - .4, mat=mat, tex='plain', role='misc', contour=True)
    s.box(x + .5, x + .5 + w + .3, y, y + .4, h - .8, h - .3, mat='wood', tex='plain', role='misc')


def lift(p, dz):
    if isinstance(p, ob.Cyl):
        p.z0 += dz
        p.z1 += dz
    else:
        p.d = p.d + p.n[:, 2] * dz
    return p


def ellip(s, x, y, z, rx, ry, rz, mat, tex='speck', role='misc', contour=True):
    return s.add(E.Ellip(x, y, z, rx, ry, rz, mat=mat, tex=tex, role=role, contour=contour))


def smoke(s, x, y, z, n=4, r0=2.2, rise=3.2, drift=2.0, mat='ash'):
    for i in range(n):
        r = r0 * (1 + .22 * i)
        dx = (drift * i * .7) + (.8 if i % 2 else -.4)
        s.add(M.Dome(x + dx, y + (i % 2) * .5, z + rise * i * (1 + .08 * i), r, zmin=-99, mat=mat, role='steam', contour=True))


def water_fn(x, y):
    w = np.array(ob.MAT['mwater'], np.uint8)
    t = np.clip((1.6 + ob.hsh(np.floor(x / 3), y, 4) * 1.6).astype(int), 0, 4)
    t = np.where(np.mod(np.floor(y) + np.floor(x / 4), 5) == 0, 3, t)
    return w[t]


def paddy_fn(x, y):
    w = np.array(ob.MAT['mwater'], np.uint8)
    g = np.array(ob.MAT['grass'], np.uint8)
    rice = (np.mod(np.floor(x), 2) == 0) & (ob.hsh(x, y, 3) > .25)
    return np.where(rice[:, None], g[np.clip((2 + ob.hsh(x, y, 8) * 2.4).astype(int), 0, 4)], w[np.clip((1 + ob.hsh(x, y, 6) * 2).astype(int), 0, 4)])


def court_fn(seed=13, stone=False):
    dirt = np.array(ob.MAT['dirt'], np.uint8)
    stn = np.array(ob.MAT['ishi'], np.uint8)

    def fn(x, y):
        if stone:
            return stn[np.clip((3 + ob.hsh(x, y, seed) * 2.2).astype(int), 0, 5)]
        return dirt[np.clip((2 + ob.hsh(x, y, seed) * 2.2).astype(int), 0, 4)]
    return fn


def moat(s, x0, x1, y0, y1, w=4.0):
    """해자: 물 띠(앞·좌·우). 뒤는 성이 가린다."""
    s.patch(x0, x1, y0, y0 + w, water_fn, z=-.6, h=.6, mat='mwater')
    s.patch(x0, x0 + w, y0, y1, water_fn, z=-.6, h=.6, mat='mwater')
    s.patch(x1 - w, x1, y0, y1, water_fn, z=-.6, h=.6, mat='mwater')


# ── 칸 맞춤 보정: 장면 전체를 고르게 늘이고 줄인다(넘치면 줄이고, 가로가 덜 차면 키운다) ─────────────
def _scale_prim(p, k):
    if isinstance(p, Poly):
        p.d = p.d * k
    elif isinstance(p, M.Frustum):
        p.xc, p.yc, p.r0, p.r1, p.z0, p.z1 = [v * k for v in (p.xc, p.yc, p.r0, p.r1, p.z0, p.z1)]
        if p.zc is not None:
            p.zc *= k
    elif isinstance(p, E.InvCone):
        p.xc, p.yc, p.r, p.z0, p.zt, p.zb, p.zt_ = [v * k for v in (p.xc, p.yc, p.r, p.z0, p.zt, p.zb, p.zt_)]
    elif isinstance(p, ob.Cone):
        p.xc, p.yc, p.r, p.z0, p.zt = [v * k for v in (p.xc, p.yc, p.r, p.z0, p.zt)]
    elif isinstance(p, ob.Cyl):
        p.xc, p.yc, p.r, p.z0, p.z1 = [v * k for v in (p.xc, p.yc, p.r, p.z0, p.z1)]
    elif isinstance(p, E.Ellip):
        p.c, p.r = p.c * k, p.r * k
    elif isinstance(p, M.Dome):
        p.c, p.r, p.zmin = p.c * k, p.r * k, p.zmin * k
    if p.fn is not None:
        f0 = p.fn
        p.fn = lambda x, y, f0=f0: f0(x / k, y / k)
    dec = []
    for face, spec in p.decals:
        if face == 'side':
            spec = (spec[0], spec[1] * k, spec[2] * k, spec[3] * k) + tuple(spec[4:])
        else:
            spec = tuple(v * k for v in spec[:4]) + tuple(spec[4:])
        dec.append((face, spec))
    p.decals = tuple(dec)


def _measure(s):
    import buildset
    buildset.camera()
    arr, _ = ob.render(s, 320, 320, ox=100, oy=240, stats=False)
    arr = ob.finish(arr)
    ys, xs = np.nonzero(~np.all(arr == buildset.KEY, -1))
    return xs.max() - xs.min() + 1, ys.max() - ys.min() + 1


def fitto(s, W, H, lo=.9):
    """W×H px 칸에 맞춘다: 넘치면 줄이고, 가로가 lo 미만이면 높이가 허락하는 만큼 키운다."""
    for _ in range(6):
        w, h = _measure(s)
        if w <= W and h <= H - 1 and w >= lo * W - 1:
            return s
        if w <= W and h <= H - 1:
            k = min((W - .5) / w, (H - 1.5) / h)
            if k <= 1.005:
                return s
        else:
            k = min((W - .5) / w, (H - 1.5) / h) * .99
        for p in s.prims:
            _scale_prim(p, k)
    return s


# ═══════════════════════════════════════════════════════════════════ 성
def castle():
    """천수각 성: 경사 돌 축대 위 5층 천수각, 앞 흰 담과 모서리 망루."""
    s = Scene()
    ishigaki(s, 3, 43, 2, 20, 7.5, bat=.4)
    s.patch(6, 40, 5, 19, court_fn(stone=True), z=7.5, h=.2, mat='ishi')
    # 앞 흰 담(축대 앞 가장자리)
    wood_wall_fence(s, 8, 38, 5.0, h=2.0)
    yagura(s, 4.5, 4.0, 8, 6, 7.5, h=3.0, rise=2.2, floors=1)
    yagura(s, 33.5, 4.0, 8, 6, 7.5, h=3.0, rise=2.2, floors=1)
    # 천수대(한 단 더 높은 축대)
    ishigaki(s, 13, 33, 9, 19, 11.5, bat=.3, role='keep')
    tenshu(s, 23, 14, 11.5, 17, 8.5, n=5, h=4.0, rise=1.8, dw=2.6, dd=1.0, over=1.4, top_rise=3.2, hafu_at=())
    return s


def castle_b():
    """산성: 숲 언덕 위 목책과 나무 망루, 산꼭대기 본채."""
    s = Scene()
    ellip(s, 23, 12, 0, 21, 11, 7, 'leaf2', role='wall')
    ellip(s, 23, 14, 4, 13, 7, 6, 'leaf2', role='wall')
    for (tx, ty, h) in ((3, 4, 9), (43, 4, 9), (8, 1, 7), (38, 1, 7)):
        cedar(s, tx, ty, h, 2.2)
    # 목책(뾰족 말뚝 줄)
    for i, x in enumerate(np.arange(8, 38.5, 1.3)):
        u = (x - 23) / 15
        zb = 5.5 + 1.5 * (1 - u * u)
        yy = 4.0 + 5 * u * u
        s.box(x, x + 1.0, yy, yy + .9, zb - 3, zb + 3.2 + (i % 2) * .6, mat='wood', tex='plain', role='wall', contour=True)
    # 목문 + 작은 지붕
    s.box(19.5, 26.5, 3.4, 5.0, 1, 10.5, mat='wood', tex='plank', role='gate', contour=True, decals=(('front', (21.3, 24.7, 1, 7.6, 'dark')),))
    s.add(E.gable_ew(18.5, 27.5, 2.4, 6, 10.5, 1.2, mat='kuro', tex='kawara', contour=True, role='roof'))
    # 나무 망루(높은 다리 + 작은 방)
    for (bx, by) in ((8.5, 9.0), (33.5, 9.0)):
        for px in (bx, bx + 3.6):
            s.box(px, px + .8, by, by + .8, 4, 15, mat='wood', tex='plain', role='tower')
        s.box(bx, bx + 3.6, by, by + .5, 9, 9.8, mat='wood', tex='plain', role='misc')
        s.box(bx - .6, bx + 5.0, by - .6, by + 3.2, 15, 18.6, mat='wood', tex='plank', role='tower', contour=True,
              decals=(('front', (bx + .7, bx + 3.7, 16.2, 17.8, 'dark')),))
        s.add(E.hip_t(bx - 1.8, bx + 6.2, by - 1.8, by + 4.4, 18.6, .95, mat='kaya', tex='speck', contour=True, role='roof'))
    # 산꼭대기 본채(높은 돌 기단 위)
    ishigaki(s, 14, 32, 16, 24, 9, bat=.3, role='keep')
    s.box(16, 30, 18, 23, 9, 14, mat='shiro', tex='plain', role='keep', contour=True, decals=wins(16.5, 29.5, 10.8, 12.6, 3.2, w=1.0))
    roof(s, 14.4, 31.6, 16.4, 24.6, 14, 4.0, tips=1.0, sh=True)
    nobori(s, 31.5, 15, 15, mat='shu')
    nobori(s, 13, 15, 14, mat='shiro')
    return s


# ═══════════════════════════════════════════════════════════════════ 도시
def capital():
    """교토풍 수도: 해자 두른 큰 축대 위 대천수각, 둘레 망루, 앞에 성하 마을 두 줄과 오층탑."""
    s = Scene()
    # 해자(축대 앞·좌·우)
    moat(s, 14, 82, 40, 84, w=4.5)
    # 큰 축대
    ishigaki(s, 18, 78, 44, 84, 9, bat=.45)
    s.patch(22, 74, 48, 83, court_fn(stone=False), z=9, h=.2, mat='dirt')
    wood_wall_fence(s, 26, 70, 48.5, h=2.2)
    yagura(s, 19, 47, 9, 6, 9, h=3.0, rise=2.2, floors=2)
    yagura(s, 68, 47, 9, 6, 9, h=3.0, rise=2.2, floors=2)
    # 오테몬(정문 망루) 가운데 앞
    s.box(43, 53, 46.5, 50, 9, 13, mat='shiro', tex='plain', role='gate', contour=True, decals=wins(43.5, 52.5, 10.2, 12, 2.6))
    roof(s, 41.5, 54.5, 45.2, 51.3, 13, 2.4, tips=.8)
    # 본마루 천수대 + 대천수
    ishigaki(s, 33, 63, 60, 80, 15, bat=.32, role='keep')
    tenshu(s, 48, 69, 15, 23, 12, n=5, h=4.6, rise=2.2, dw=3.4, dd=1.4, over=1.8, top_rise=4.0, hafu_at=())
    # 소천수(왼쪽 뒤)
    ishigaki(s, 23, 33, 66, 80, 12, bat=.3, role='keep')
    tenshu(s, 28, 73, 12, 9, 7, n=2, h=3.4, rise=2.2, dw=2.0, dd=1.0, over=1.5, top_rise=3.0, hafu_at=())
    # 성하 마을(앞) — 큰길 좌우 두 줄, 엇갈림
    xs = [(2, 7), (10, 7), (18, 8), (27, 7), (56, 7), (64, 8), (73, 7), (81, 7)]
    for i, (x, w) in enumerate(xs):
        machiya(s, x, 2, w, 5, h1=3.0, h2=2.4, rise=2.2, two=(i % 3 != 1), noren='red' if i in (2, 5) else None)
    for i, (x, w) in enumerate(((5, 8), (14, 7), (23, 8), (60, 8), (69, 7), (78, 8))):
        machiya(s, x, 17, w, 5, h1=3.0, h2=2.4, rise=2.2, two=(i % 2 == 0))
    # 큰길 끝(가운데) 다리
    s.box(43, 53, 33, 44, 0, 1.0, mat='wood', tex='plank', role='misc', contour=True)
    s.box(43, 43.6, 33, 44, 1.0, 2.2, mat='shu', tex='plain', role='misc')
    s.box(52.4, 53, 33, 44, 1.0, 2.2, mat='shu', tex='plain', role='misc')
    # 오층탑(오른쪽 뒤)
    pagoda(s, 87, 60, scale=.62)
    # 벚나무
    for (tx, ty) in ((38, 6), (58, 26), (6, 30), (37, 26)):
        sakura(s, tx, ty, 6.5, 3.0)
    return s


def fort_city():
    """성하 마을: 돌 축대 위 천수각 + 둘레 마치야."""
    s = Scene()
    ishigaki(s, 16, 48, 22, 48, 8, bat=.4)
    s.patch(19, 45, 25, 47, court_fn(), z=8, h=.2, mat='dirt')
    wood_wall_fence(s, 21, 43, 25.5, h=2.0)
    ishigaki(s, 23, 41, 33, 46, 11.5, bat=.3, role='keep')
    tenshu(s, 32, 39.5, 11.5, 15, 8, n=4, h=4.0, rise=1.8, dw=2.8, dd=1.2, over=1.4, top_rise=3.2, hafu_at=())
    yagura(s, 16.5, 24.5, 7, 5, 8, h=2.8, rise=2.0, floors=1)
    yagura(s, 40.5, 24.5, 7, 5, 8, h=2.8, rise=2.0, floors=1)
    # 둘레 마치야(앞 두 줄, 옆)
    for i, (x, w) in enumerate(((1, 7), (9, 7), (17, 7), (40, 7), (48, 7), (56, 7))):
        machiya(s, x, 2, w, 5, h1=3.0, h2=2.4, rise=2.2, two=(i % 2 == 0), noren='red' if i == 2 else None)
    for i, (x, w) in enumerate(((3, 7), (11, 7), (46, 7), (54, 7))):
        machiya(s, x, 13, w, 5, h1=3.0, h2=2.4, rise=2.2, two=(i % 2 == 1))
    for (x, y) in ((2, 26), (54, 26)):
        machiya(s, x, y, 7, 5, h1=3.0, h2=2.4, rise=2.2, two=True)
    sakura(s, 29, 8, 6, 2.8)
    sakura(s, 36, 13, 5.5, 2.5)
    return s


def harbor_city():
    """나가사키풍 무역항: 앞 부두에 아타케부네, 뒤에 흰 창고 줄과 상관."""
    s = Scene()
    for i, x in enumerate((3, 13, 52, 62)):
        kura(s, x, 20 + (i % 2) * 2, 8, 6, h=5.0 + (i % 2) * .6, rise=2.6)
    ishigaki(s, 24, 50, 24, 36, 4, bat=.4)
    s.box(27, 47, 27, 34, 4, 9, mat='shiro', tex='plain', role='house', contour=True, decals=wins(27.5, 46.5, 5.8, 7.8, 3))
    roof(s, 25.3, 48.7, 25.3, 35.7, 9, 3.6, tips=1.0, sh=False)
    nobori(s, 49, 30, 13, mat='shiro')
    machiya(s, 4, 8, 8, 5, h1=3.0, h2=2.4, rise=2.2)
    kura(s, 15, 8, 7, 5, h=4.6)
    machiya(s, 25, 9, 8, 5, h1=3.0, h2=2.4, rise=2.2, two=False)
    # 돌 안벽(낮고 얕게) + 나무 잔교
    ishigaki(s, 0, 44, 1, 6, 1.6, bat=.5, faces='flr')
    s.box(30, 37, -12, 1, .6, 1.4, mat='wood', tex='plank', role='misc', contour=True)
    for px in (30, 35.8):
        for py in (-11.5, -6, -1):
            s.box(px, px + 1.2, py, py + 1.2, -1, .6, mat='wood', tex='plain', role='misc')
    # 아타케부네: 상자 선체 + 검은 판벽 상갑 2단 + 작은 천수 누각 + 깃발
    s.add(E.hull(40, 78, -10, 1, 0, 3.4, rise=.9, mat='wood', tex='plank', role='misc', contour=True))
    s.box(43, 75, -9, 0, 3.4, 8.0, mat='kuro', tex='plank', role='house', contour=True,
          decals=wins(43.5, 74.5, 5.2, 6.6, 2.4, w=1.0))
    s.box(42.6, 75.4, -9.4, .4, 8.0, 8.6, mat='kuro', tex='plain', role='misc', contour=True)
    s.box(47, 71, -7.5, -1.5, 8.6, 12.0, mat='kuro', tex='plank', role='house', contour=True,
          decals=wins(47.5, 70.5, 9.8, 11.0, 2.4, w=1.0))
    s.box(46.6, 71.4, -7.9, -1.1, 12.0, 12.6, mat='shu', tex='plain', role='misc')
    s.box(54, 64, -6.5, -2.5, 12.6, 16.2, mat='shiro', tex='plain', role='house', contour=True, decals=wins(54.5, 63.5, 13.8, 15.0, 2.6, w=1.0))
    roof(s, 52.6, 65.4, -7.8, -1.2, 16.2, 2.6, tips=.8, sh=True)
    for (nx, m) in ((43, 'shu'), (73, 'shiro'), (77, 'shu')):
        nobori(s, nx, -4, 11 + (nx % 3), mat=m, w=1.3)
    # 작은 배(왼쪽 앞)
    s.add(E.hull(6, 24, -12, -6, 0, 2.2, rise=.9, mat='wood', tex='plank', role='misc', contour=True))
    s.box(14.6, 15.4, -9.5, -8.7, 2.2, 13, mat='wood', tex='plain', role='misc')
    s.box(10.6, 19.4, -9.5, -8.9, 5, 12, mat='shiro', tex='ribs', role='misc', contour=True)
    return s


def large_town():
    """역참 마을: 길 양쪽 마치야 두 줄, 가운데 큰 2층 여관(붉은 등)."""
    s = Scene()
    # 뒤 줄(엇갈림)
    machiya(s, 1, 18, 8, 5, h1=3.0, h2=2.4, rise=2.2, two=True)
    machiya(s, 38, 18, 8, 5, h1=3.0, h2=2.4, rise=2.2, two=True)
    # 여관(가운데 뒤, 큰 2층)
    s.box(12, 35, 14, 22, 0, 4.0, mat='wood', tex='plank', role='house', contour=True,
          decals=(('front', (13, 34, .4, 3.4, 'lat')), ('front', (21.5, 25.5, 0, 3.0, 'dark'))))
    s.box(11.6, 35.4, 12.8, 14.8, 3.8, 4.7, mat='kuro', tex='plain', role='misc', contour=True)
    s.box(12.5, 34.5, 14.6, 22, 4.0, 7.4, mat='shiro', tex='plain', role='house', contour=True,
          decals=wins(13, 34, 5.0, 6.6, 3.0, w=2.0))
    roof(s, 10.4, 36.6, 12.6, 23.4, 7.4, 3.6, tips=1.0)
    for lx in (16.5, 30.5):
        s.box(lx, lx + 1.2, 12.4, 13.2, 1.6, 3.4, mat='shu', tex='plain', role='misc', contour=True)
    # 앞 줄
    for i, (x, w) in enumerate(((0, 7), (8, 7), (31, 7), (39, 7))):
        machiya(s, x, 2, w, 5, h1=3.0, h2=2.4, rise=2.2, two=(i % 2 == 0), noren='red' if i == 1 else None)
    # 길목 표지·소나무
    pine(s, 23, 4, 7, 2.8)
    s.box(17, 18, 0, 1, 0, 5, mat='wood', tex='plain', role='misc')
    s.box(16.4, 18.6, -.2, 1.2, 3.2, 4.8, mat='shiro', tex='plain', role='misc', contour=True)
    return s


def village():
    """농촌: 초가 농가 둘, 논 둑, 물레방아."""
    s = Scene()
    # 논(앞 왼쪽) — 둑으로 나뉜 물 논
    s.patch(1, 15, 0, 9, paddy_fn, z=-.3, h=.3, mat='mwater')
    s.box(0.3, 15.7, 4.2, 5.0, 0, .7, mat='dirt', tex='plain', role='misc')
    s.box(7.6, 8.4, 0, 9, 0, .7, mat='dirt', tex='plain', role='misc')
    minka(s, 16, 1, 10, 6, wh=3.0, rise=5.0)
    minka(s, 3, 13, 10, 6, wh=3.0, rise=5.4)
    # 물레방아(오른쪽 뒤 집 옆): 나무 바퀴
    ellip(s, 26.6, 9.5, 4.2, 3.6, .7, 3.6, 'wood', tex='plank')
    s.box(26.0, 27.2, 8.7, 8.9, 1.0, 7.4, mat='wood', tex='plain', role='misc')
    s.box(23.0, 30.2, 8.7, 8.9, 3.6, 4.8, mat='wood', tex='plain', role='misc')
    s.box(26.0, 27.2, 8.6, 8.8, 3.6, 4.8, mat='sumi', tex='plain', role='misc')
    s.box(22, 31, 7, 12, -.4, .2, mat='mwater', tex='plain', role='ground')
    cedar(s, 17, 16, 9, 2.0)
    return s


def village_b():
    """닌자 마을: 삼나무 숲 속에 검은 지붕만 드러난 집들과 망보는 나무 대."""
    s = Scene()
    for (tx, ty, h, r) in ((2.5, 15, 13, 2.6), (28, 16, 14, 2.8), (15, 22, 15, 3.0), (8, 21, 12, 2.4), (22, 20, 12, 2.4)):
        cedar(s, tx, ty, h, r)
    # 숲 속 집 셋(검은 판벽·짙은 지붕)
    for (x, y, w) in ((2, 6, 9), (18, 9, 10)):
        s.box(x, x + w, y, y + 5, 0, 3.0, mat='sumi', tex='plank', role='house', contour=True,
              decals=(('front', (x + w / 2 - 1, x + w / 2 + 1, 0, 2.2, 'dark')),))
        s.add(E.gable_ew(x - .8, x + w + .8, y - 1.0, y + 6.0, 3.0, 3.6 / 3.5, mat='kaya', tex='speck', contour=True, role='roof'))
    # 앞 덤불(집 밑을 가린다)
    for (bx, by, rx) in ((5, 2, 5.0), (16, 1.5, 3.4), (26, 3, 4.6), (12, 4.5, 2.6)):
        ellip(s, bx, by, 1.2, rx, 2.6, 2.6, 'leaf2')
    # 망보는 대(나무 사다리 탑)
    for px in (12.0, 14.4):
        s.box(px, px + .6, 13, 13.6, 0, 12, mat='wood', tex='plain', role='tower')
    s.box(11.4, 15.6, 12.5, 14.5, 12, 13.6, mat='wood', tex='plank', role='tower', contour=True)
    s.add(E.hip_t(10.6, 16.4, 12, 15, 13.6, .7, mat='kaya', tex='speck', contour=True, role='roof'))
    return s


def camp():
    """전장 진지: 흰 바탕 검은 문장 띠 막(장막)을 둘러치고 노보리 깃발을 세운다."""
    s = Scene()
    # 뒤 장막 + 양옆 장막 (흰 천 + 가운데 검은 띠 + 문장)
    def maku(x0, x1, y0, y1, h=4.2):
        s.box(x0, x1, y0, y1, .6, h, mat='shiro', tex='plain', role='wall', contour=True,
              decals=(('front', (x0, x1, h * .42, h * .62, 'dark')), ('front', ((x0 + x1) / 2 - .8, (x0 + x1) / 2 + .8, h * .7, h * .9, 'dark'))))
        for px in np.arange(x0, x1 + .01, 4):
            s.box(px - .3, px + .3, y0 - .3, y0 + .3, 0, h + .6, mat='wood', tex='plain', role='misc')
    maku(4, 28, 12, 12.6)
    maku(1, 9, 3, 3.6, 3.8)
    maku(23, 31, 3, 3.6, 3.8)
    # 노보리(뒤에 줄지어)
    for i, x in enumerate((5, 10, 15.5, 21, 26)):
        nobori(s, x, 15 + (i % 2), 13 + (i % 2), mat='shu' if i % 2 == 0 else 'kuro', w=1.6)
    # 걸상과 대장 깃발
    s.box(13.5, 18.5, 6, 7.4, 0, 1.6, mat='wood', tex='plank', role='misc', contour=True)
    s.box(15.6, 16.4, 4, 4.8, 0, 6, mat='wood', tex='plain', role='misc')
    s.add(E.Ellip(16, 4.4, 6.6, 1.6, .5, 1.6, mat='goldroof', tex='plain', role='misc', contour=True))
    return s


# ═══════════════════════════════════════════════════════════════════ 탑
def tower_small():
    """망루(야구라): 작은 돌 축대 위 2층 흰 망루."""
    s = Scene()
    ishigaki(s, 3, 12, 1, 7, 7, bat=.35)
    z = 7
    for (w, d, h, rise, sh) in ((7, 4.4, 5.0, 1.6, False), (5.4, 3.4, 4.4, 2.6, True)):
        x0, x1, y0, y1 = 7.5 - w / 2, 7.5 + w / 2, 4 - d / 2, 4 + d / 2
        s.box(x0, x1, y0, y1, z, z + h, mat='shiro', tex='plain', role='tower', contour=True,
              decals=wins(x0 + .3, x1 - .3, z + h * .45, z + h * .72, 2.6, w=1.0))
        roof(s, x0 - 1.0, x1 + 1.0, y0 - 1.0, y1 + 1.0, z + h, rise, tips=.6, sh=sh)
        z += h + rise * .5
    return s


def pagoda(s, xc, yc, scale=1.0):
    """오층탑: 좁은 붉은 나무 몸 + 넓은 회흑 처마 + 상륜."""
    k = scale
    s.box(xc - 6 * k, xc + 6 * k, yc - 6 * k, yc + 6 * k, 0, 2.2 * k, mat='ishi', tex='ishi', role='wall', contour=True)
    z = 2.2 * k
    for i in range(5):
        hw = (4.2 - .4 * i) * k
        h = (4.4 if i == 0 else 3.4) * k
        s.box(xc - hw, xc + hw, yc - hw, yc + hw, z, z + h, mat='shu', tex='plain', role='tower', contour=True,
              decals=(('front', (xc - 1.0 * k, xc + 1.0 * k, z, z + h * .7, 'dark')),) if i == 0 else
              (('front', (xc - .6 * k, xc + .6 * k, z + h * .3, z + h * .7, 'dark')),))
        ov = (3.4 - .2 * i) * k
        roof(s, xc - hw - ov, xc + hw + ov, yc - hw - ov, yc + hw + ov, z + h, 2.0 * k, tips=.8 * k)
        z += h + 1.0 * k
    # 상륜(구륜)
    s.box(xc - 1.2 * k, xc + 1.2 * k, yc - 1.2 * k, yc + 1.2 * k, z - .6, z + 1.0 * k, mat='kuro', tex='plain', role='roof', contour=True)
    s.cyl(xc, yc, .45, z, z + 9 * k, mat='sumi', tex='plain', role='roof')
    for j in range(5):
        zz = z + (2.0 + j * 1.3) * k
        s.cyl(xc, yc, .8 * k + .1, zz, zz + .6, mat='kuro', tex='plain', role='roof')
    s.add(E.Ellip(xc, yc, z + 9.3 * k, .8, .8, .9, mat='goldroof', tex='plain', role='roof'))
    return z + 9 * k


def tower_great():
    """오층탑."""
    s = Scene()
    pagoda(s, 15, 7, scale=1.0)
    return s


# ═══════════════════════════════════════════════════════════════════ 신앙·자연
def shrine():
    """신사: 큰 붉은 도리이, 참배길 석등, 붉은 배전과 뒤 본전(치기·가쓰오기)."""
    s = Scene()
    # 본전(뒤, 높은 기단, 박공 + 치기)
    s.box(17, 31, 22, 30, 0, 3.0, mat='ishi', tex='ishi', role='misc', contour=True)
    s.box(19, 29, 23.5, 28.5, 3, 8, mat='shu', tex='plain', role='house', contour=True,
          decals=(('front', (22.6, 25.4, 3, 7, 'dark')),))
    s.add(E.gable_ew(17.4, 30.6, 21.6, 30.4, 8, 5.2 / 4.4, mat='bark', tex='kawara', contour=True, role='roof'))
    for x in (17.6, 30.4):          # 치기(X자 끝장식)
        s.box(x - .4, x + .4, 25.6, 26.4, 11, 15, mat='bark', tex='plain', role='roof')
    for x in (21, 24, 27):          # 가쓰오기
        s.box(x - .8, x + .8, 25.3, 26.7, 12.9, 13.9, mat='goldroof', tex='plain', role='roof')
    # 배전(앞, 넓은 붉은 기둥 + 회흑 지붕)
    s.box(10, 38, 10, 18, 0, 1.6, mat='ishi', tex='ishi', role='misc', contour=True)
    s.box(12, 36, 11.5, 17, 1.6, 6.4, mat='shiro', tex='plain', role='house', contour=True,
          decals=(('front', (20.5, 27.5, 1.6, 5.6, 'dark')),))
    E.pillars(s, 11.6, 36.4, 11.5, 1.6, 6.4, 6, mat='shu', w=1.3, d=1.0)
    s.add(ob.box(11.2, 36.8, 10.2, 17.4, 5.4, 6.4, mat='shu', tex='plain', role='misc'))
    roof(s, 8.6, 39.4, 8.8, 19.6, 6.4, 4.2, tips=1.2)
    s.box(23.0, 25.0, 9.0, 9.6, 4.2, 5.6, mat='goldroof', tex='plain', role='misc')     # 방울
    # 석등·참배길
    for x in (15.5, 32.5):
        lantern(s, x, 4.5, 4.4)
    # 큰 도리이(앞)
    torii(s, 24, 1.0, 16, 13, r=.9, big=True)
    # 신목
    pine(s, 4, 16, 9, 3.4)
    sakura(s, 43, 17, 8, 3.4)
    return s


def landmark_nature():
    """벚나무 거목: 굵은 줄기·금줄과 분홍 꽃 구름."""
    s = Scene()
    s.cyl(24, 9, 3.4, 0, 10, mat='bark', tex='speck', role='wall', contour=True)
    s.cyl(24, 9, 3.7, 5.0, 6.2, mat='shiro', tex='plain', role='misc')
    for x in (21.4, 24, 26.6):
        s.box(x - .3, x + .3, 5.2, 5.6, 2.6, 5.0, mat='shiro', tex='plain', role='misc')
    # 굵은 가지
    s.box(16, 24, 8, 10, 12, 14, mat='bark', tex='plain', role='misc')
    s.box(24, 33, 8, 10, 13, 15, mat='bark', tex='plain', role='misc')
    for (x, y, z, rx, ry, rz) in ((24, 11, 22, 14, 8, 8), (12, 9, 17, 8, 6, 6), (36, 10, 17.5, 8, 6, 6),
                                  (24, 9, 28, 9, 6, 5.5), (17, 8, 13.5, 6, 5, 4), (31, 8, 14, 6, 5, 4)):
        ellip(s, x, y, z, rx, ry, rz, 'sakura', role='roof')
    # 떨어진 꽃잎 덤불(땅 위 낮은)
    for (x, y, r) in ((8, 1, 2.2), (40, 2, 2.4), (30, 0, 1.6)):
        ellip(s, x, y, .6, r, 1.4, 1.0, 'sakura', role='misc')
    lantern(s, 13, 1, 4.0)
    return s


def landmark_fuji():
    """후지풍 설산: 넓은 청회 원뿔 + 눈 덮인 꼭대기, 허리에 구름."""
    s = Scene()
    xc, yc = 24, 14
    s.add(ob.Cone(xc, yc, 23, 0, 30, mat='fuji', tex='speck', role='wall', contour=True))
    s.add(ob.Cone(xc, yc - .3, 9.6, 17.6, 30.4, mat='snow', tex='speck', role='roof', contour=False))
    # 눈 골짜기 줄기
    for (dx, z0, z1) in ((-4.6, 13, 19), (-1.4, 11.5, 19), (2.4, 12.5, 19), (5.6, 14, 19)):
        s.add(ob.Cone(xc + dx, yc - 9.8 + abs(dx) * .4, 1.2, z0, z1, mat='snow', tex='plain', role='roof', contour=False))
    # 산정 분화구 틈
    s.box(xc - 1.6, xc + 1.6, yc - .5, yc + .5, 28.8, 29.6, mat='fuji', tex='plain', role='misc')
    # 허리 구름
    for (cx, cy, cz, rx, rz) in ((8, 3, 8, 7, 2.6), (40, 4, 7, 7, 2.6), (24, 1, 5, 6, 2.0)):
        ellip(s, cx, cy, cz, rx, 3, rz, 'cloud', role='nocast', contour=False)
    return s


def circle():
    """도리이 길: 작은 붉은 도리이가 굽은 참배길을 따라 줄지어 선다."""
    s = Scene()
    pts = [(9, 26), (13, 20), (17, 14.5), (19.5, 9), (20.5, 3.5)]
    for (xc, y) in pts:
        torii(s, xc, y, 7.6, 8.0, r=.65)
    lantern(s, 4, 1.5, 4.2)
    lantern(s, 29, 6, 4.0)
    s.box(5.5, 9.5, 29, 31, 0, 3.6, mat='shu', tex='plain', role='house', contour=True, decals=(('front', (6.6, 8.4, 0, 2.6, 'dark')),))
    s.add(E.gable_ew(4.6, 10.4, 28.2, 31.8, 3.6, 1.2, mat='kuro', tex='kawara', contour=True, role='roof'))
    return s


def cave():
    """산속 동굴 사당: 바위산 동굴 입구, 금줄과 작은 도리이·석등."""
    s = Scene()
    ellip(s, 16, 12, 6, 14, 9, 11, 'rock', role='wall')
    ellip(s, 6, 10, 3, 6, 6, 6, 'rock', role='wall')
    ellip(s, 26, 11, 3, 6, 6, 6.5, 'rock', role='wall')
    cedar(s, 25, 18, 13, 2.6)
    pine(s, 8, 17, 15, 2.6)
    # 동굴 입구 면(바위에 파묻힌 어두운 아치)
    s.box(10, 21, 1.0, 4.5, 0, 9, mat='rock', tex='speck', role='house', contour=True,
          decals=(('front', (12.2, 18.8, 0, 7.6, 'arch')),))
    s.box(11.5, 19.5, .8, 1.3, 7.4, 8.0, mat='shiro', tex='plain', role='misc')     # 금줄
    for x in (13, 15.5, 18):
        s.box(x - .3, x + .3, .7, 1.1, 5.8, 7.4, mat='shiro', tex='plain', role='misc')
    torii(s, 15.5, -3.0, 7.2, 6.4, r=.6)
    lantern(s, 5, -2, 3.6)
    return s


def ruin():
    """무너진 성 축대: 이가 빠진 돌 축대, 굴러떨어진 돌, 그을린 기둥."""
    s = Scene()
    ishigaki(s, 3, 15, 8, 18, 9, bat=.4, faces='flb')
    ishigaki(s, 15, 22, 9, 18, 5, bat=.4, faces='fb')
    ishigaki(s, 22, 29, 7, 16, 7, bat=.4, faces='frb')
    # 무너져 내린 돌(앞 비탈)
    for (x, y, w, h) in ((14, 4, 4, 2.0), (18.5, 5, 3, 1.6), (9, 2, 3, 1.4), (24, 2, 3.4, 2.0), (16, .5, 2.4, 1.2), (4, 3, 2.6, 1.6)):
        s.box(x, x + w, y, y + w * .7, 0, h, mat='ishi', tex='ishi', role='misc', contour=True)
    # 축대 위 그을린 기둥·풀
    for (x, y, h) in ((6, 13, 14), (9.5, 14, 11.5), (25, 12, 11)):
        s.box(x, x + 1.2, y, y + 1.2, 6, h, mat='sumi', tex='plain', role='misc', contour=True)
    s.add(E.hip_t(5, 12, 10, 16, 9, .5, ztrunc=10.2, mat='kuro', tex='kawara', contour=True, role='misc'))
    for (x, y, r) in ((20, 13, 2.2), (27, 10, 1.6), (12, 1.5, 1.6)):
        ellip(s, x, y, 5.6 if y > 8 else .6, r, 1.6, 1.4, 'leaf2')
    return s


def ruin_city():
    """불탄 성하 마을: 숯이 된 기둥, 내려앉은 검은 지붕, 그을린 흰 벽 조각과 연기, 뒤에 무너진 축대."""
    s = Scene()
    ishigaki(s, 16, 48, 22, 34, 7, bat=.4)
    ishigaki(s, 23, 39, 27, 34, 10.5, bat=.35, role='keep')
    s.box(25, 34, 28.5, 32.5, 10.5, 12.0, mat='shiro', tex='plain', role='wall', contour=True, decals=(('front', (27, 31, 10.5, 12, 'dark')),))
    for (x, y, h) in ((26, 29, 17), (31, 29.5, 15), (36, 29, 16)):
        s.box(x, x + 1.4, y, y + 1.4, 10, h, mat='sumi', tex='plain', role='misc', contour=True)
    # 마을 잔해 — 길 양쪽 두 줄
    blocks = ((1, 2), (10, 3), (19, 2), (37, 2), (46, 3), (55, 2), (3, 13), (12, 14), (44, 14), (53, 13))
    for k, (x, y) in enumerate(blocks):
        w = 7
        s.box(x, x + w, y + 3, y + 4.2, 0, 2.0 + (k % 3) * 1.0, mat='shiro', tex='plain', role='wall', contour=True,
              decals=(('front', (x + 1 + (k % 2), x + 4 + (k % 2), 0, 1.4 + (k % 3) * .6, 'dark')),))
        for j, px in enumerate((x, x + 3, x + w - 1)):
            hh = 3.0 + ((k * 3 + j * 5) % 7) * .6
            s.box(px, px + 1.0, y + .4, y + 1.4, 0, hh, mat='sumi', tex='plain', role='misc', contour=True)
        s.add(E.hip_t(x - .6, x + w + .6, y + 1.0, y + 5.0, 0, .55, ztrunc=1.5, mat='kuro', tex='kawara', contour=True, role='misc'))
    # 가는 연기 몇 가닥
    for (x, y, z) in ((13, 6, 4), (49, 7, 4), (32, 31, 17)):
        for i in range(3):
            s.add(E.Ellip(x + i * 1.3, y, z + i * 3.0, 1.4 + i * .5, 1.0, 1.3 + i * .3, mat='ash', tex='speck', role='steam', contour=True))
    for (x, y) in ((6, 5), (24, 5), (50, 16), (15, 17)):
        s.add(E.Ellip(x, y, .5, 1.3, .8, .8, mat='ember', tex='plain', role='misc'))
    return s


def volcano():
    """화산: 검은 비탈의 화구에서 붉은 용암, 위로 회색 분연."""
    s = Scene()
    s.add(E.oct_pyr(15, 10, 14, 0, 20, ztrunc=12.5, mat='basalt', tex='speck', role='wall', contour=True))
    s.add(E.oct_prism(15, 10, 4.6, 12.4, 13.0, mat='ember', tex='plain', role='misc'))
    s.add(E.Ellip(15, 9.4, 13.0, 4.6, 3.4, .9, mat='ember', tex='speck', role='misc'))
    s.add(E.Ellip(13.6, 3.6, 7.0, 1.3, 1.0, 4.4, mat='ember', tex='speck', role='misc'))
    s.add(E.Ellip(18.4, 5.0, 8.6, 1.0, .9, 2.8, mat='ember', tex='speck', role='misc'))
    smoke(s, 14.5, 10.5, 16, n=3, r0=3.0, rise=3.6, drift=2.2)
    return s


def floating():
    """구름 위 신의 섬: 거꾸로 선 바위 밑동, 풀 윗면, 붉은 도리이와 신사, 벚나무, 아래 구름."""
    s = Scene()
    xc, yc = 38, 18
    s.add(E.InvCone(xc, yc, 22, 0, 12, mat='rock', tex='speck', role='wall', contour=True))
    s.add(E.Ellip(xc, yc, 12.2, 24, 15, 2.0, mat='leaf2', tex='speck', role='ground', contour=True))
    s.patch(xc - 20, xc + 20, yc - 12, yc + 12,
            lambda x, y: np.array(ob.MAT['grass'], np.uint8)[np.clip((ob.hsh(x, y, 5) * 4.2).astype(int), 0, 4)], z=12.0, h=1.0, mat='grass')
    zb = 13.0
    # 본전(뒤)
    s.box(xc - 9, xc + 9, yc + 1, yc + 9, zb, zb + 1.8, mat='ishi', tex='ishi', role='misc', contour=True)
    z0 = zb + 1.8
    s.box(xc - 6.5, xc + 6.5, yc + 2.5, yc + 8, z0, z0 + 5, mat='shu', tex='plain', role='house', contour=True,
          decals=(('front', (xc - 1.6, xc + 1.6, z0, z0 + 4, 'dark')),))
    s.add(E.gable_ew(xc - 8.6, xc + 8.6, yc + .6, yc + 9.9, z0 + 5, 5.4 / 4.6, mat='bark', tex='kawara', contour=True, role='roof'))
    for x in (xc - 8.4, xc + 8.4):
        s.box(x - .4, x + .4, yc + 4.9, yc + 5.7, z0 + 8.4, z0 + 12.4, mat='bark', tex='plain', role='roof')
    for x in (xc - 3, xc, xc + 3):
        s.box(x - .8, x + .8, yc + 4.6, yc + 6.0, z0 + 10.3, z0 + 11.3, mat='goldroof', tex='plain', role='roof')
    # 도리이(앞) — 섬 윗면 높이로 올려 세운다
    s2 = Scene()
    torii(s2, xc, yc - 6, 11, 9.5, r=.7, big=True)
    for p in s2.prims:
        lift(p, zb)
        s.add(p)
    for (lx, ly) in ((xc - 12, yc - 7), (xc + 12, yc - 7)):
        s.box(lx - 1, lx + 1, ly - 1, ly + 1, zb, zb + 3.0, mat='ishi', tex='plain', role='misc', contour=True)
        s.add(E.hip_t(lx - 1.5, lx + 1.5, ly - 1.5, ly + 1.5, zb + 3, .7, mat='ishi', tex='plain', contour=True, role='misc'))
    # 벚나무·소나무
    for (tx, ty, mat) in ((xc - 17, yc + 2, 'sakura'), (xc + 17, yc + 3, 'sakura')):
        s.cyl(tx, ty, .8, zb, zb + 4.5, mat='bark', tex='plain', role='misc')
        s.add(E.Ellip(tx, ty, zb + 6.5, 4.4, 3.4, 3.4, mat=mat, tex='speck', role='roof', contour=True))
    # 구름
    for (cx, cy, cz, rx, ry, rz) in ((14, 10, 5, 12, 7, 4.5), (62, 9, 4, 13, 7, 4.5), (38, 6, 2.5, 18, 7, 4.0)):
        s.add(E.Ellip(cx, cy, cz, rx, ry, rz, mat='cloud', tex='speck', role='nocast', contour=False))
    return s


ORDER = [
    ('capital', '교토풍 수도', 'capital', (6, 6), '해자 두른 큰 축대 위 대천수각·소천수·망루, 앞에 성하 마을 두 줄, 옆 오층탑'),
    ('fort_city', '성하 마을', 'fort_city', (4, 4), '돌 축대 위 4층 천수각과 흰 담, 둘레 마치야 줄'),
    ('harbor_city', '나가사키풍 무역항', 'harbor_city', (5, 4), '돌 안벽·잔교에 아타케부네와 작은 배, 뒤에 흰 창고 줄과 상관'),
    ('castle', '천수각 성', 'castle', (3, 3), '경사 돌 축대 + 천수대 위 5층 천수각, 앞 흰 담과 망루 둘'),
    ('castle', '산성', 'castle_b', (3, 3), '숲 언덕 위 목책·나무 망루 둘·목문, 산꼭대기 본채'),
    ('large_town', '역참 마을', 'large_town', (3, 3), '마치야 두 줄 사이 큰 2층 여관(붉은 등), 소나무와 길 표지'),
    ('village', '농촌', 'village', (2, 2), '초가 농가 둘, 둑으로 나뉜 논, 물레방아'),
    ('village', '닌자 마을', 'village_b', (2, 2), '삼나무 숲 속 초가 지붕과 망보는 나무 대'),
    ('camp', '전장 진지', 'camp', (2, 2), '검은 띠 흰 장막을 둘러치고 노보리 깃발 줄, 대장 걸상'),
    ('tower_small', '망루', 'tower_small', (1, 2), '작은 돌 축대 위 2층 흰 야구라'),
    ('tower_great', '오층탑', 'tower_great', (2, 4), '붉은 나무 몸과 넓은 회흑 처마 다섯 층, 금색 상륜'),
    ('cave', '산속 동굴 사당', 'cave', (2, 2), '바위산 동굴 입구에 금줄, 앞에 작은 도리이와 석등'),
    ('ruin', '무너진 성 축대', 'ruin', (2, 2), '이가 빠진 돌 축대, 굴러떨어진 돌, 그을린 기둥'),
    ('ruin_city', '불탄 성하 마을', 'ruin_city', (4, 3), '숯 기둥·내려앉은 지붕·그을린 벽과 연기, 뒤에 무너진 축대'),
    ('shrine', '신사', 'shrine', (3, 3), '큰 붉은 도리이·석등, 붉은 기둥 배전과 뒤 본전(치기·가쓰오기)'),
    ('landmark_nature', '벚나무 거목', 'landmark_nature', (3, 3), '금줄 두른 굵은 줄기와 분홍 꽃 구름'),
    ('landmark_nature', '후지풍 설산', 'landmark_fuji', (3, 3), '넓은 청회 원뿔과 눈 덮인 꼭대기, 허리 구름'),
    ('circle', '도리이 길', 'circle', (2, 2), '참배길을 따라 줄지어 선 작은 붉은 도리이, 양옆 석등'),
    ('volcano', '화산', 'volcano', (2, 2), '검은 비탈 화구의 용암과 회색 분연'),
    ('floating', '신의 섬', 'floating', (5, 4), '구름 위 바위섬에 붉은 도리이·본전·석등·벚나무'),
]


def _wrap():
    g = globals()
    for role, name, fn, (cw, ch), desc in ORDER:
        f = g[fn]

        def w(f=f, cw=cw, ch=ch):
            return fitto(f(), cw * 16, ch * 16)
        w.__doc__ = f.__doc__
        g[fn] = w


_wrap()
