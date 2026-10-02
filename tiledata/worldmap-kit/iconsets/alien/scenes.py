"""외계 행성 월드맵 아이콘 — 정면 카메라용 3D 장면.
보라 식물·청록 수정·주황 바위 지표 위에 이주민 돔 기지(현대·SF 재질)와 외계 원주민 구조물이 섞인다.
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
from icons_v9_lib import hx, ROCK, GOLD, SNOW, STONE, VOLC  # noqa: E402
from oblique import Scene, box, Poly  # noqa: E402

SET = dict(id='alien', name='외계 행성')

# ── 이 세트의 새 재질 ────────────────────────────────────────────────────────────────────────────
PURP = [hx(c) for c in ('2a1240', '4e2272', '7a3aa0', 'a45cc8', 'cc8ee6')]           # 외계 식물·유기물 보라(새 5)
CRYS = [hx(c) for c in ('0f4a52', '1f8a88', '3fc8b8')] + [SNOW[2], SNOW[3], SNOW[5]]  # 청록 수정(새 3)
PINK = hx('ff6ad0')                                                                     # 생물 발광(새 1)
ob.MAT.update({
    'purp': PURP,
    'chitin': [PURP[0], hx('493f59'), PURP[1], PURP[2], PURP[3]],
    'crys': CRYS,
    'pink': [PINK, PINK, PINK, PINK],
    'orock': [ROCK[2], ROCK[5], GOLD[2], GOLD[3], GOLD[4], ROCK[9]],
    'pale': [hx('766e60'), hx('b9ab9d'), hx('d8cbac'), hx('e1d7c1'), SNOW[5]],
    'ice': [SNOW[0], SNOW[1], SNOW[2], SNOW[3], SNOW[4], SNOW[5]],
    'basalt2': [STONE[0], STONE[1], VOLC[1], VOLC[2], VOLC[3], VOLC[4]],
})
L._reg(PURP, hx('111618'))
L._reg(CRYS, hx('1d2c33'))
L._reg([PINK], hx('2a1240'))

NEON = M.NEON


def _u(v):
    v = np.array(v, float)
    return v / np.linalg.norm(v)


# ═══════════════════════════════ 부품 ═══════════════════════════════════════════════════════════
def crystal(s, base, axis, L_, r, tip=None, mat='crys', spin=45, role='misc'):
    """길쭉한 사각 쌍뿔 수정. base=밑 중심, axis=길이 방향, L_=길이, r=반폭."""
    ax = _u(axis)
    ref = np.array([0, 1.0, 0]) if abs(ax[1]) < .9 else np.array([1.0, 0, 0])
    e1 = _u(np.cross(ref, ax))
    e2 = np.cross(ax, e1)
    a = math.radians(spin)
    e1, e2 = e1 * math.cos(a) + e2 * math.sin(a), -e1 * math.sin(a) + e2 * math.cos(a)
    c = np.array(base, float) + ax * L_ / 2
    tip = tip or r * 1.6
    k = r / tip
    pl = []
    for n in (e1, -e1, e2, -e2):
        pl.append((tuple(n), float(n @ c + r), 'side'))
        nt = n + k * ax
        pl.append((tuple(nt), float(nt @ c + r + k * (L_ / 2 - tip)), 'tip'))
        nb = n - k * ax
        pl.append((tuple(nb), float(nb @ c + r + k * (L_ / 2 - tip * .4)), 'tip'))
    return s.add(Poly(pl, mat=mat, tex='plain', role=role, contour=True))


def cluster(s, x, y, z=0.0, size=1.0, n=5, seed=1, mat='crys'):
    rng = np.random.RandomState(seed)
    for i in range(n):
        ang = 2 * math.pi * i / n + rng.uniform(-.3, .3)
        lean = .35 if i else 0.0
        ax = (math.cos(ang) * lean, math.sin(ang) * lean * .6, 1.0)
        L_ = size * (10 if i == 0 else rng.uniform(5, 8))
        crystal(s, (x + math.cos(ang) * size * (0 if i == 0 else 1.2), y + math.sin(ang) * size * (0 if i == 0 else .8), z),
                ax, L_, size * (1.7 if i == 0 else 1.2), mat=mat)


def sphere(s, x, y, z, r, mat='pink', role='misc', contour=True):
    return s.add(M.Dome(x, y, z, r, zmin=-99, mat=mat, role=role, contour=contour))


def glass_dome(s, x, y, r, z=0.0, base=1.6, n_lon=8, mat='glass', ring='white'):
    """유리 돔: 흰 받침 고리 + 패널 줄 돔."""
    s.add(M.Frustum(x, y, r + .6, r + .6, z, z + base, mat=ring, role='house', contour=True))
    d = M.Dome(x, y, z + base, r, mat=mat, role='house', contour=True)
    d.post = M.dome_panels(n_lon, 3, mat)(d)
    s.add(d)
    return z + base + r


def white_dome(s, x, y, r, z=0.0, door=True, mat='white'):
    d = M.Dome(x, y, z, r, zmin=z, mat=mat, role='house', contour=True)
    posts = [M.dome_panels(8, 2, mat)(d)]
    if door:
        posts.append(M.dome_door(x, r * .45, z + r * .5))
    d.post = M.chain(*posts)
    s.add(d)


def pad(s, x, y, r, mat='concrete', h=1.0, mark=True):
    """착륙장: 팔각 판 + 가운데 표지."""
    s.add(E.oct_prism(x, y, r, 0, h, mat=mat, tex='plain', role='pad', contour=True))
    if mark:
        p = E.oct_prism(x, y, r * .62, h, h + .05, mat='orange', tex='plain', role='pad')
        s.add(p)
        s.add(E.oct_prism(x, y, r * .48, h + .05, h + .1, mat=mat, tex='plain', role='pad'))


def lander(s, x, y, z=0.0, k=1.0, body='white'):
    """착륙선: 다리 넷 + 몸통 + 유리창 + 추진기 고리."""
    for dx, dy in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
        c = np.array([x + dx * 3.2 * k, y + dy * 2.2 * k, z + 1.6 * k])
        R = M.rot_y(-dx * .5) @ M.rot_x(dy * .4)
        s.add(M.obox(c, (.9 * k, .9 * k, 4.2 * k), R, mat='steel', role='misc'))
        s.add(box(c[0] - .9 * k + dx * 1.0 * k, c[0] + .9 * k + dx * 1.0 * k, c[1] - .7 * k, c[1] + .7 * k, z, z + .6 * k, mat='steel', tex='plain', role='misc'))
    s.add(M.Frustum(x, y, 2.6 * k, 3.6 * k, z + 1.6 * k, z + 3.0 * k, mat='steel', role='misc', contour=True))
    s.add(M.Frustum(x, y, 3.8 * k, 2.6 * k, z + 3.0 * k, z + 7.0 * k, mat=body, role='house', contour=True))
    d = M.Dome(x, y, z + 7.0 * k, 2.6 * k, mat=body, role='house', contour=True)
    s.add(d)
    s.add(box(x - 1.4 * k, x + 1.4 * k, y - 3.7 * k, y - 3.0 * k, z + 4.4 * k, z + 6.0 * k, mat='glass', tex='plain', role='misc'))
    s.add(box(x - .4 * k, x + .4 * k, y - .4 * k, y + .4 * k, z + 9.4 * k, z + 11.5 * k, mat='steel', tex='plain', role='misc'))
    s.add(box(x - .5 * k, x + .5 * k, y - .5 * k, y + .5 * k, z + 11.5 * k, z + 12.3 * k, mat='neon', tex='plain', role='misc'))


def spot_post(prim, mat, spot='pink', density=.10, seed=3, scale=1.6):
    """둥근 면 위 점박이(버섯 갓 반점·발광 점)."""
    rp = ob.MAT[mat]
    sc = np.array(ob.MAT[spot][-1], np.uint8)

    def post(tag, P, col, s, nrm):
        cx = np.floor(P[:, 0] / scale)
        cy = np.floor((P[:, 2] + P[:, 1] * .62) / scale)
        h = ob.hsh(cx, cy, seed)
        m = (h > 1 - density) & (nrm[:, 2] > -.2)
        out = np.where(m[:, None], sc[None, :], col)
        rim = (h > 1 - density * 1.8) & ~m & (nrm[:, 2] > -.2)
        out = np.where(rim[:, None], M._idx(rp, s, 1), out)
        return out.astype(np.uint8)
    return post


def mushroom(s, x, y, stem_r, h, cap_r, cap_h, cap='purp', stem='pale', door=True, wins=True, seed=1):
    dec = []
    if door:
        dec.append(('side', (-90, stem_r * .55, 0, min(3.4, h * .55), 'dark')))
    if wins and h > 7:
        dec.append(('side', (-90 + 38, .8, h * .55, h * .55 + 1.6, 'lit')))
        dec.append(('side', (-90 - 40, .8, h * .38, h * .38 + 1.6, 'lit')))
    s.add(ob.Cyl(x, y, stem_r, 0, h, mat=stem, tex='plain', role='house', contour=True, decals=tuple(dec)))
    s.add(ob.Cyl(x, y, stem_r + .9, 0, 1.0, mat=stem, tex='plain', role='house', contour=True))
    c = E.Ellip(x, y, h, cap_r, cap_r * .8, cap_h, mat=cap, role='roof', contour=True)
    c.post = spot_post(c, cap, 'pale', .09, seed, 1.8)
    s.add(c)
    # 갓 아래 주름(밝은 띠)
    s.add(E.Ellip(x, y, h - cap_h * .15, cap_r * .92, cap_r * .74, cap_h * .35, mat='chitin', role='roof'))


def tentacle(s, pts, r0, r1, mat='purp', tip='pink', n=None):
    """구슬 사슬 촉수: pts(제어점) 를 따라 반지름 r0→r1 구를 촘촘히."""
    pts = np.array(pts, float)
    seg = np.linalg.norm(np.diff(pts, axis=0), axis=1)
    tot = seg.sum()
    n = n or max(4, int(tot / max(.7, (r0 + r1) * .35)))
    cum = np.concatenate([[0], np.cumsum(seg)])
    for i in range(n + 1):
        t = tot * i / n
        j = min(np.searchsorted(cum, t, side='right') - 1, len(seg) - 1)
        f = (t - cum[j]) / seg[j]
        p = pts[j] + (pts[j + 1] - pts[j]) * f
        r = r0 + (r1 - r0) * i / n
        sphere(s, *p, r, mat=mat, contour=(i % 2 == 0))
    if tip:
        sphere(s, *pts[-1], max(r1 * 1.5, 1.2), mat=tip)


def plant(s, x, y, h=6, r=1.0, seed=1, glow=True):
    """작은 외계 식물: 휘어진 보라 줄기 + 끝 발광 구슬."""
    rng = np.random.RandomState(seed)
    bend = rng.uniform(-1, 1) * h * .35
    tentacle(s, [(x, y, 0), (x + bend * .3, y, h * .55), (x + bend, y, h)], r, r * .55, tip='pink' if glow else None)


def frond(s, x, y, h=5, seed=2):
    """키 낮은 보라 덤불(타원 덩이 셋)."""
    rng = np.random.RandomState(seed)
    for i in range(3):
        dx = (i - 1) * h * .45 + rng.uniform(-.4, .4)
        c = E.Ellip(x + dx, y + rng.uniform(-.5, .5), h * (.45 if i == 1 else .32), h * .42, h * .32, h * (.5 if i == 1 else .38),
                    mat='purp', tex='speck', role='misc', contour=True)
        s.add(c)


def boulder(s, x, y, r, mat='orock', h=None, seed=0):
    s.add(E.Ellip(x, y, 0, r, r * .8, h or r * .9, mat=mat, tex='speck', role='misc', contour=True))


def glyph_post(mat, period=3, seed=4, density=.45, col=None):
    """앞면 문양: 세로 주기 줄마다 짧은 빛 획."""
    gc = np.array(col if col is not None else NEON, np.uint8)

    def post(tag, P, c, s, nrm):
        front = nrm[:, 1] < -.4
        x, z = P[:, 0], P[:, 2]
        row = np.floor(z / period)
        cx = np.floor(x / 2)
        h = ob.hsh(cx, row, seed)
        m = front & (np.mod(z, period) < 1) & (h < density)
        m |= front & (np.mod(x, 2) < 1) & (np.mod(z, period) < 2) & (ob.hsh(cx, row, seed + 3) < density * .5)
        return np.where(m[:, None], gc[None, :], c).astype(np.uint8)
    return post


def ring_v(s, xc, yc, zc, R, thick=1.2, nseg=16, mat='neon', yaw=0.0):
    """세운 고리(x-z 평면). yaw 로 수직축 회전."""
    for k in range(nseg):
        th = 2 * math.pi * (k + .5) / nseg
        Rm = M.rot_z(yaw) @ M.rot_y(math.pi / 2 - th)
        off = M.rot_z(yaw) @ np.array([R * math.cos(th), 0, R * math.sin(th)])
        seg = 2 * R * math.sin(math.pi / nseg) + .5
        s.add(M.obox((xc + off[0], yc + off[1], zc + off[2]), (seg, thick, thick), Rm, mat=mat, role='misc', contour=False))


def ring_h(s, xc, yc, zc, R, thick=1.2, nseg=18, mat='neon'):
    """누운 고리(x-y 평면)."""
    for k in range(nseg):
        th = 2 * math.pi * (k + .5) / nseg
        seg = 2 * R * math.sin(math.pi / nseg) + .5
        s.add(M.obox((xc + R * math.cos(th), yc + R * math.sin(th), zc), (seg, thick, thick * .8), M.rot_z(th + math.pi / 2),
                     mat=mat, role='misc', contour=False))


def antenna(s, x, y, z0, h, w=1.4):
    p = box(x - w / 2, x + w / 2, y - w / 2, y + w / 2, z0, z0 + h, mat='white', tex='plain', role='tower', contour=True)
    p.post = M.band_swap(z0, 3, 'orange')
    s.add(p)
    s.add(box(x - .5, x + .5, y - .5, y + .5, z0 + h, z0 + h + 1.2, mat='neon', tex='plain', role='misc'))


# ═══════════════════════════════ 장면 ═══════════════════════════════════════════════════════════
def capital():
    """이주민 돔 도시: 뒤 가운데 큰 유리 돔 + 오른쪽 관측탑 + 왼쪽 앞 착륙장·착륙선 + 작은 돔·통로 + 외계 식물."""
    s = Scene()
    # 큰 돔
    glass_dome(s, 46, 56, 25, base=3, n_lon=10)
    # 돔 안 탑 끝(돔 꼭대기 위로 첨탑)
    s.add(box(45.3, 46.7, 55.3, 56.7, 28, 36, mat='steel', tex='plain', role='misc'))
    s.add(box(45.2, 46.8, 55.2, 56.8, 36, 37.4, mat='neon', tex='plain', role='misc'))
    # 관측탑(오른쪽 뒤)
    M.watch_tower(s, 5, 54, 6, 34, cabin=1.7)
    # 왼쪽 뒤 작은 돔 둘
    glass_dome(s, 82, 60, 8, base=2)
    white_dome(s, 15, 38, 7)
    # 통로
    s.add(box(11, 24, 54, 58, 0, 3.2, mat='white', tex='plain', role='misc', contour=True))
    s.add(box(68, 78, 58, 62, 0, 3.2, mat='white', tex='plain', role='misc', contour=True))
    # 앞 줄: 착륙장(왼쪽) + 거주동 + 오른쪽 돔
    pad(s, 18, 14, 12)
    lander(s, 18, 15, z=1.0, k=1.15)
    M.bldg(s, 34, 14, 22, 9, 9, mat='white', win=True, seed=3, lit_p=.15)
    s.add(box(33.5, 56.5, 13.5, 23.5, 9, 10, mat='steel', tex='plain', role='roof', contour=True))
    M.rooftop(s, 34, 14, 22, 9, 10, 'ac2')
    white_dome(s, 70, 20, 9)
    M.dish(s, 82, 30, 12, 4.0, tilt=.8, n=10)
    # 식물·수정
    plant(s, 61, 8, 9, 1.0, seed=2)
    plant(s, 6, 34, 8, .9, seed=5)
    frond(s, 30, 4, 4.5, seed=3)
    frond(s, 66, 6, 4.0, seed=7)
    cluster(s, 60, 34, size=.8, n=4, seed=3)
    cluster(s, 30, 30, size=.7, n=4, seed=8)
    return s


def fort_city():
    """방어 기지: 앞 방벽+강철 문, 네 귀 포탑, 가운데 돔, 레이더 접시."""
    s = Scene()
    x0, x1, y0, y1 = 5, 55, 2, 50
    H = 8
    # 안 돔·건물(기단 높여 방벽 위로)
    glass_dome(s, 24, 30, 12, base=3)
    M.bldg(s, 38, 30, 12, 9, 13, mat='concrete', seed=2)
    M.rooftop(s, 38, 30, 12, 9, 13, 'mast')
    M.dish(s, 44, 18, 13, 4.0, tilt=.7)
    # 방벽
    M.wall_run(s, x0, x1, y1 - 3, y1, H)
    M.wall_run(s, x0, x0 + 3, y0, y1, H)
    M.wall_run(s, x1 - 3, x1, y0, y1, H)
    M.wall_run(s, x0, 23, y0, y0 + 3, H)
    M.wall_run(s, 37, x1, y0, y0 + 3, H)
    s.add(box(23, 37, y0, y0 + 3, 7, H + 2, mat='concrete', tex='plain', role='gate', contour=True))
    M.steel_door(s, 24, 36, y0, 7)
    for wx in (9, 46):
        s.add(box(wx, wx + 6, y0 - .2, y0, 3, 4.2, mat='orange', tex='plain', role='misc'))
    # 포탑
    for tx, ty in ((x0 + 1.5, y0 + 1.5), (x1 - 1.5, y0 + 1.5), (x0 + 1.5, y1 - 1.5), (x1 - 1.5, y1 - 1.5)):
        s.add(ob.Cyl(tx, ty, 4.0, 0, H + 4, mat='concrete', tex='plain', role='tower', contour=True))
        s.add(M.Dome(tx, ty, H + 4, 3.4, mat='steel', role='tower', contour=True))
        s.add(M.obox((tx, ty - 3.6, H + 6), (1.0, 5, 1.0), M.rot_x(-.35), mat='steel', role='misc'))
        s.add(box(tx - .5, tx + .5, ty - .5, ty + .5, H + 7.2, H + 8, mat='neon', tex='plain', role='misc'))
    return s


def harbor_city():
    """우주항: 로켓 발사대(왼쪽 뒤) · 연료 탱크(가운데) · 격납고 · 앞 착륙장의 착륙선."""
    s = Scene()
    # 발사탑 + 로켓
    rx, ry = 13, 30
    s.add(box(rx - 9, rx + 9, ry - 7, ry + 7, 0, 3, mat='concrete', tex='plain', role='pad', contour=True))
    tw = box(rx + 5, rx + 9, ry - 2, ry + 2, 3, 40, mat='orange', tex='plain', role='tower', contour=True)
    tw.post = M.with_ramp(M.bands(3, 4, 1, -2, ('front', 'right')), 'orange')
    s.add(tw)
    for zz in (14, 26, 36):
        s.add(box(rx + 1.6, rx + 5, ry - .6, ry + .6, zz, zz + 1, mat='steel', tex='plain', role='misc'))
    body = M.Frustum(rx, ry, 3.4, 3.4, 6, 33, mat='white', role='tower', contour=True)
    body.post = M.band_swap(10, 6, 'steel')
    s.add(body)
    s.add(ob.Cone(rx, ry, 3.4, 33, 41, mat='white', tex='plain', role='roof', contour=True))
    s.add(ob.Cone(rx, ry, 1.2, 38.8, 41.6, mat='cred', tex='plain', role='roof'))
    s.add(M.Frustum(rx, ry, 2.2, 3.0, 3, 6, mat='steel', role='misc', contour=True))
    for dx in (-1, 1):
        s.add(Poly([((0, -1, 0), -(ry - .4), 'front'), ((0, 1, 0), ry + .4, 'back'), ((0, 0, -1), -4, 'bottom'),
                    ((-dx, 0, 0), -dx * (rx + dx * 3.2), 'in'), ((dx * 9, 0, 6), dx * 9 * (rx + dx * 6.6) + 6 * 4, 'out')],
                   mat='cred', tex='plain', role='misc', contour=True))
    # 연료 탱크
    for (x, y, r, h) in ((36, 44, 5.0, 14), (48, 46, 4.0, 11)):
        tk = M.Frustum(x, y, r, r, 0, h, mat='white', role='tank', contour=True)
        tk.post = M.with_ramp(M.bands(2, 4, 1, -1, ('side',)), 'white')
        s.add(tk)
        s.add(M.Dome(x, y, h, r, mat='white', role='tank', contour=True))
    s.add(box(32, 52, 37, 39, 3, 4.4, mat='steel', tex='plain', role='misc'))
    # 격납고(오른쪽 뒤)
    s.add(M.prism_arch(56, 74, 40, 8, N=8, mat='concrete', tex='plain', role='house', contour=True))
    s.add(box(60, 70, 31.6, 32.2, 0, 6, mat='steel', tex='plain', role='gate', contour=True))
    antenna(s, 73, 30, 0, 16)
    # 앞 착륙장 + 착륙선 둘
    pad(s, 36, 14, 12)
    lander(s, 36, 15, z=1.0, k=1.1)
    pad(s, 63, 12, 9)
    lander(s, 63, 13, z=1.0, k=.8, body='orange')
    # 식물
    plant(s, 4, 10, 7, .9, seed=3)
    frond(s, 72, 4, 3.6, seed=4)
    cluster(s, 50, 4, size=.6, n=4, seed=9)
    return s


def castle():
    """외계 여왕 둥지: 휘어진 키틴 첨탑 다발 + 둥근 알주머니 + 발광 입구."""
    s = Scene()
    cx, cy = 21, 16
    # 몸통 언덕
    hill = E.Ellip(cx, cy, 0, 15, 10, 7, mat='chitin', tex='speck', role='wall', contour=True)
    s.add(hill)
    # 첨탑(가운데가 가장 높다)
    for (x, y, r, h, lean) in ((cx, cy + 3, 3.6, 30, 0), (cx - 8, cy + 2, 2.8, 24, -.2), (cx + 8, cy + 4, 3.0, 25, .18),
                               (cx - 12, cy - 1, 2.0, 17, -.22), (cx + 12, cy, 2.0, 17, .22),
                               (cx - 5, cy - 4, 2.2, 19, -.12), (cx + 5, cy - 5, 2.0, 17, .15)):
        pts = [(x, y, 3), (x + lean * h * .3, y, h * .5), (x + lean * h * .8, y, h * .85), (x + lean * h * 1.1, y, h)]
        tentacle(s, pts, r, r * .3, mat='chitin', tip=None)
    # 갈비 같은 곁가지
    for side in (-1, 1):
        tentacle(s, [(cx + side * 3, cy + 1, 16), (cx + side * 7, cy, 19), (cx + side * 10, cy - 1, 23)], 1.2, .5, mat='purp', tip='pink')
    # 알주머니
    for (x, y, r) in ((cx - 14, cy - 5, 3.0), (cx + 14, cy - 4, 2.6), (cx - 9, cy - 9, 2.2), (cx + 9, cy - 9, 2.4)):
        e = E.Ellip(x, y, r * .8, r, r * .8, r * 1.1, mat='purp', role='misc', contour=True)
        e.post = spot_post(e, 'purp', 'pink', .14, 5, 1.4)
        s.add(e)
    # 발광 입구
    gate = E.Ellip(cx, cy - 10.4, 2.0, 3.2, .8, 3.8, mat='pink', role='gate')
    s.add(gate)
    sphere(s, cx, cy + 3, 31, 1.7, mat='pink')
    return s


def castle_b():
    """군 전초기지: 콘크리트 사령동 + 감시탑 + 모래주머니 방벽 + 접시 안테나."""
    s = Scene()
    M.bldg(s, 14, 20, 22, 11, 11, mat='concrete', seed=5, lit_p=.2)
    s.add(box(13.5, 36.5, 19.5, 31.5, 11, 12, mat='steel', tex='plain', role='roof', contour=True))
    M.rooftop(s, 14, 20, 22, 11, 12, 'ac')
    M.watch_tower(s, 4, 26, 5, 15, cabin=1.8)
    M.dish(s, 34, 13, 8, 3.2, tilt=.75)
    # 방벽(앞)
    M.wall_run(s, 1, 30, 4, 7, 5)
    M.steel_door(s, 12, 19, 4, 4.4)
    for x in (2, 25):
        s.add(box(x, x + 4, 1, 3.4, 0, 2.2, mat='dirtg', tex='plain', role='misc', contour=True))
    # 깃발
    s.add(box(40, 40.8, 6, 6.8, 0, 11, mat='steel', tex='plain', role='misc'))
    s.add(box(36, 40, 6.2, 6.6, 7.6, 10.6, mat='orange', tex='plain', role='misc'))
    s.add(box(38, 42, 30, 33, 0, 3, mat='cgreen', tex='plain', role='cargo', contour=True))
    return s


def large_town():
    """원주민 버섯 마을: 큰 버섯 집 셋(문·불빛 창) + 작은 버섯."""
    s = Scene()
    mushroom(s, 12, 26, 4.0, 14, 10, 6.5, cap='purp', seed=1)
    mushroom(s, 34, 30, 3.4, 12, 9, 5.5, cap='orock', seed=2)
    mushroom(s, 25, 8, 3.4, 10, 9, 5.5, cap='purp', seed=3)
    mushroom(s, 41, 9, 1.6, 5, 4.5, 3, cap='crys', door=False, seed=4)
    mushroom(s, 6, 7, 1.3, 4, 3.6, 2.4, cap='orock', door=False, seed=5)
    plant(s, 42, 22, 5, .7, seed=6)
    return s


def capsule(s, x, y, w, r, mat='white', stripe='orange'):
    """누운 캡슐 주거: 반원통 몸 + 양끝 반구 + 창 띠."""
    p = M.prism_arch(x, x + w, y, r, N=8, mat=mat, tex='plain', role='house', contour=True)
    p.post = M.windows(x + 1.5, y - r, z0=r * .45, ztop=r * .75 + .5, px=3, pz=3, lit_p=.3, ramp='glass', band_right=False, seed=int(x))
    s.add(p)
    for ex in (x, x + w):
        d = M.Dome(ex, y, 0, r, zmin=0, mat=mat, role='house', contour=True)
        s.add(d)
    s.add(box(x + w * .4, x + w * .4 + 2.2, y - r - .2, y - r + .4, 0, 3.2, mat='steel', tex='plain', role='gate'))
    s.add(box(x - r * .3, x + w + r * .3, y - .5, y + .5, r - .1, r + .5, mat=stripe, tex='plain', role='misc'))


def village():
    """정착 캡슐 마을: 누운 캡슐 셋 + 급수탑 + 보라 식물."""
    s = Scene()
    capsule(s, 7, 20, 12, 4.4)
    capsule(s, 5, 6, 9, 4.0, stripe='cblue')
    capsule(s, 19.5, 8, 6.5, 3.6, mat='white', stripe='orange')
    s.add(M.Frustum(25, 21, 1.8, 1.8, 0, 9, mat='steel', role='tank', contour=True))
    s.add(M.Dome(25, 21, 9, 2.6, zmin=-99, mat='white', role='tank', contour=True))
    plant(s, 4, 15, 6, .7, seed=2)
    return s


def village_b():
    """수정 마을: 주황 바위 둥근 움집 + 지붕에 박힌 청록 수정."""
    s = Scene()
    for (x, y, r, h, sd) in ((9, 16, 7, 8, 1), (22, 18, 6, 7, 2), (16, 4, 5.5, 6, 3)):
        e = E.Ellip(x, y, 0, r, r * .8, h, mat='orock', tex='speck', role='house', contour=True)
        dk = np.array(STONE[0], np.uint8)
        lit = np.array(ob.MAT['crys'][2], np.uint8)

        def post(tag, P, c, s_, nrm, x=x, h=h):
            m = (nrm[:, 1] < -.3) & (np.abs(P[:, 0] - x) < 1.4) & (P[:, 2] < h * .42)
            return np.where(m[:, None], dk[None, :], c).astype(np.uint8)
        e.post = post
        s.add(e)
        cluster(s, x + 1, y + 1, z=h * .7, size=.75, n=3, seed=sd)
    cluster(s, 28, 6, size=.65, n=4, seed=7)
    return s


def camp():
    """조사 캠프: 주황 돔 텐트 둘 + 6륜 탐사차 + 작은 접시."""
    s = Scene()
    white_dome(s, 8, 20, 6.4, mat='orange')
    white_dome(s, 20, 22, 5.0, mat='white')
    # 탐사차
    x, y = 14, 4
    s.add(box(x, x + 13, y, y + 6, 2.2, 5.6, mat='white', tex='plain', role='house', contour=True))
    s.add(box(x + 8.5, x + 13, y - .2, y + 6, 5.6, 8.0, mat='white', tex='plain', role='house', contour=True))
    s.add(box(x + 9.2, x + 12.4, y - .4, y, 6.0, 7.6, mat='glass', tex='plain', role='misc'))
    s.add(box(x + .5, x + 7.5, y - .3, y, 3.2, 4.4, mat='orange', tex='plain', role='misc'))
    for wx in (x + .4, x + 5, x + 9.6):
        s.add(box(wx, wx + 3.0, y - 1.0, y + .2, 0, 3.0, mat='basalt2', tex='plain', role='misc', contour=True))
    s.add(box(x + 2, x + 2.8, y + 3, y + 3.8, 5.6, 11, mat='steel', tex='plain', role='misc'))
    s.add(box(x + 1.9, x + 2.9, y + 2.9, y + 3.9, 11, 12, mat='neon', tex='plain', role='misc'))
    M.dish(s, 4, 6, 5.5, 2.6, tilt=.8)
    s.add(box(26, 30, 12, 15, 0, 2.6, mat='cyellow', tex='plain', role='cargo', contour=True))
    return s


def tower_small():
    """통신 안테나: 적백(주황) 줄 격자탑 + 위 접시 + 표지등."""
    s = Scene()
    s.add(box(-3.5, 3.5, 0, 5, 0, 2, mat='concrete', tex='plain', role='misc', contour=True))
    add = s.add(M.Frustum(0, 2.5, 2.3, 1.0, 2, 17, mat='white', role='tower', contour=True))
    add.post = M.band_swap(2, 3, 'orange')
    M.dish(s, 0, 2.5, 14.5, 3.6, tilt=.85, mast=False)
    s.add(box(-.5, .5, 2, 3, 17, 21, mat='steel', tex='plain', role='misc'))
    s.add(box(-.7, .7, 1.8, 3.2, 21, 22.4, mat='neon', tex='plain', role='misc'))
    return s


def tower_great():
    """고대 외계 오벨리스크: 계단 기단 + 검은 사각 첨탑(빛나는 청록 문양) + 떠 있는 꼭대기 수정."""
    s = Scene()
    xc, yc = 0, 6
    s.box(xc - 11, xc + 11, yc - 6, yc + 6, 0, 2.4, mat='orock', tex='brick', role='wall', contour=True)
    s.box(xc - 8, xc + 8, yc - 4.5, yc + 4.5, 2.4, 4.6, mat='orock', tex='brick', role='wall', contour=True)
    for z0, z1, role in ((4.6, 18, 'tower'), (18, 39, 'nocast')):
        ob_ = E.hip_t(xc - 6.5, xc + 6.5, yc - 3.4, yc + 3.4, 4.6, 12.0, ztrunc=z1, mat='basalt2', tex='plain', role=role, contour=False)
        ob_.planes_cut = z0
        ob_.n = np.vstack([ob_.n, [0, 0, -1.0]])
        ob_.d = np.append(ob_.d, -z0)
        ob_.tag.append('bottom')
        ob_.post = glyph_post('basalt2', 3, 4, .5)
        s.add(ob_)
    s.add(E.hip_t(xc - 3.2, xc + 3.2, yc - 1.5, yc + 1.5, 39, 2.4, mat='basalt2', tex='plain', role='nocast', contour=True))
    crystal(s, (xc, yc, 43), (0, 0, 1), 6.5, 1.8, tip=2.6, role='nocast')
    sphere(s, xc - 7, yc - 5, 6.5, 1.0, mat='neon', contour=False)
    sphere(s, xc + 7, yc - 5, 6.5, 1.0, mat='neon', contour=False)
    return s


def cave():
    """수정 동굴: 주황 바위 언덕의 어두운 입구 + 입구 둘레와 꼭대기에 돋은 청록 수정."""
    s = Scene()
    cx = 14
    e = E.Ellip(cx, 12, 0, 13, 8, 11.5, mat='orock', tex='speck', role='wall', contour=True)
    dk = np.array(STONE[0], np.uint8)
    dk2 = np.array(hx('0f4a52'), np.uint8)

    def post(tag, P, c, s_, nrm):
        dx = P[:, 0] - cx
        arch = (nrm[:, 1] < -.25) & (np.abs(dx) < 5.0) & (P[:, 2] < 6 + np.sqrt(np.clip(25 - dx * dx, 0, None)) * .6)
        out = np.where(arch[:, None], dk[None, :], c)
        inner = arch & (P[:, 2] < 4.5) & (np.abs(dx) < 3.2)
        return np.where(inner[:, None], dk2[None, :], out).astype(np.uint8)
    e.post = post
    s.add(e)
    for (x, y, z, ax, Ln, r) in ((cx - 6, 4, 0, (-.5, 0, 1), 8, 1.5), (cx + 6, 4, 0, (.5, 0, 1), 9, 1.6),
                                 (cx - 8.5, 5, 0, (-.8, 0, 1), 5, 1.1), (cx + 9.5, 6, 0, (.9, 0, 1), 5.5, 1.1),
                                 (cx, 3.6, 0, (0, -.1, 1), 3.2, 1.0)):
        crystal(s, (x, y, z), ax, Ln, r)
    cluster(s, cx + 3, 12, z=9, size=.8, n=4, seed=4)
    return s


def ruin():
    """추락한 우주선: 비스듬히 박힌 선체 + 꺾인 날개 + 깨진 창 + 연기 + 흩어진 파편."""
    s = Scene()
    rng = np.random.RandomState(3)
    R = M.rot_z(.12) @ M.rot_y(.32)
    hull = M.obox((15, 12, 5.5), (22, 9, 7), R, mat='steel', tex='plain', role='house', contour=True)
    s.add(hull)
    s.add(M.obox((23.5, 11, 9.6), (5, 8, 4.6), R, mat='white', tex='plain', role='house', contour=True))
    s.add(M.obox((24.6, 7.2, 10.2), (3.4, .6, 2.2), R, mat='glass', tex='plain', role='misc'))
    s.add(M.obox((12, 4, 2.2), (12, 7, 1.2), M.rot_z(-.25) @ M.rot_x(.35), mat='white', tex='plain', role='misc', contour=True))
    s.add(M.obox((5, 15, 4), (5, 6, 6), R, mat='rust', tex='plain', role='misc', contour=True))
    s.add(box(1.5, 4, 12, 18, 2.4, 5.5, mat='orange', tex='plain', role='misc'))
    s.add(M.obox((8, 14, 11), (5, 1.2, 6), M.rot_y(.5), mat='white', tex='plain', role='misc', contour=True))
    s.add(M.obox((14, 7.4, 6.8), (16, .5, 1.2), R, mat='orange', tex='plain', role='misc'))
    s.add(M.Dome(2.6, 15, 3.6, 1.6, zmin=-99, mat='neon', role='misc', contour=False))
    M.steam(s, 19, 16, 12, rng, n=2, r0=2.2, rise=3.0, drift=1.6)
    for (x, y, w, h) in ((23.5, 2, 3, 1.4), (2, 2, 2.4, 1.2), (19, 1, 2, 1.0)):
        s.add(box(x, x + w, y, y + 1.8, 0, h, mat='steel', tex='plain', role='misc', contour=True))
    boulder(s, 24, 16, 2.0)
    return s


def curved_pillar(s, x, y, h, bend, r=1.8, mat='orock', top=True):
    pts = [(x, y, 0), (x + bend * .15, y, h * .45), (x + bend * .55, y, h * .82), (x + bend, y, h)]
    tentacle(s, pts, r, r * .7, mat=mat, tip=None)
    if top:
        sphere(s, x + bend, y, h + .4, r * .9, mat='crys')


def ruin_city():
    """고대 외계 문명 유적: 휘어진 기둥 열 + 무너진 아치 + 계단 단 + 수정 + 식물."""
    s = Scene()
    # 계단 단(뒤)
    s.box(24, 52, 26, 38, 0, 3, mat='orock', tex='brick', role='wall', contour=True)
    s.box(28, 48, 28, 36, 3, 6, mat='orock', tex='brick', role='wall', contour=True)
    # 큰 아치(두 기둥이 서로를 향해 휜다)
    curved_pillar(s, 31, 32, 22, 6, r=2.2, top=False)
    curved_pillar(s, 45, 32, 22, -6, r=2.2, top=False)
    sphere(s, 38, 32, 23.4, 2.6, mat='crys')
    # 앞 기둥 열(일부 부러짐)
    for (x, y, h, b, top) in ((5, 18, 20, 4, True), (15, 14, 14, -3, False), (53, 18, 19, -4, True), (58, 28, 13, -2, False)):
        curved_pillar(s, x, y, h, b, r=1.9, top=top)
    # 쓰러진 기둥 토막
    for (x, y, rr) in ((24, 6, 2.0), (28, 5, 1.8), (32, 6.5, 1.6)):
        sphere(s, x, y, rr * .8, rr, mat='orock')
    s.box(40, 50, 4, 9, 0, 2.6, mat='orock', tex='brick', role='misc', contour=True)
    # 문양 판
    p = box(8, 18, 34, 36, 0, 9, mat='basalt2', tex='plain', role='misc', contour=True)
    p.post = glyph_post('basalt2', 3, 6, .5)
    s.add(p)
    cluster(s, 18, 24, size=.7, n=4, seed=11)
    frond(s, 45, 16, 4, seed=5)
    plant(s, 2, 6, 6, .7, seed=4)
    return s


def shrine():
    """외계 신전: 계단 기단 + 가운데 수정 기둥 + 떠 있는 고리 둘 + 빛 구슬 + 양옆 첨석."""
    s = Scene()
    cx, cy = 22, 16
    s.box(cx - 20, cx + 20, cy - 12, cy + 12, 0, 2.4, mat='pale', tex='brick', role='wall', contour=True)
    s.box(cx - 15, cx + 15, cy - 9, cy + 9, 2.4, 4.8, mat='pale', tex='brick', role='wall', contour=True)
    s.box(cx - 4, cx + 4, cy - 15, cy - 12, 0, 1.6, mat='pale', tex='brick', role='misc', contour=True)
    s.box(cx - 9, cx + 9, cy - 5, cy + 5, 4.8, 7, mat='basalt2', tex='plain', role='wall', contour=True)
    # 떠 있는 고리
    ring_v(s, cx, cy, 20, 11, thick=1.4, nseg=20, mat='crys')
    ring_v(s, cx, cy, 20, 7.5, thick=1.0, nseg=16, mat='neon', yaw=0.0)
    ring_h(s, cx, cy, 11, 9, thick=1.0, mat='pink')
    sphere(s, cx, cy, 20, 3.4, mat='pink')
    crystal(s, (cx, cy, 7), (0, 0, 1), 9, 1.6, tip=2.2)
    for sx in (-1, 1):
        crystal(s, (cx + sx * 16, cy - 3, 4.8), (sx * .1, 0, 1), 16, 1.8, mat='basalt2', tip=3)
        sphere(s, cx + sx * 16, cy - 3, 23, 1.2, mat='neon', contour=False)
    return s


def landmark_nature():
    """거대 외계 식물: 뿌리 촉수가 퍼진 굵은 보라 줄기 + 위로 솟아 바깥으로 말린 촉수 가지 부채 + 끝마다 발광 구슬."""
    s = Scene()
    cx, cy = 20, 14
    s.add(M.Frustum(cx, cy, 4.6, 2.8, 0, 16, mat='chitin', role='tower', contour=True))
    for a, r in ((-.5, 1.8), (.4, 1.8), (2.7, 1.5), (3.6, 1.4)):
        tentacle(s, [(cx, cy, 3), (cx + math.cos(a) * 6, cy + math.sin(a) * 3, 1.0), (cx + math.cos(a) * 10, cy + math.sin(a) * 5, .3)],
                 r, .6, mat='chitin', tip=None)
    # 촉수 가지: 줄기 끝에서 위·바깥으로 솟았다가 끝이 말려 내려온다
    arms = [(-1.0, 0.0, 15, 28, 22), (1.0, 0.0, 15, 29, 23), (-.6, .4, 10, 32, 27), (.6, .4, 10, 31, 26),
            (-.25, -.5, 7, 30, 25), (.3, -.5, 8, 29, 24), (0, .6, 3, 34, 31)]
    for dx, dy, reach, top, end in arms:
        pts = [(cx, cy, 15), (cx + dx * reach * .35, cy + dy * reach * .3, top - 3), (cx + dx * reach * .75, cy + dy * reach * .5, top),
               (cx + dx * reach, cy + dy * reach * .6, end), (cx + dx * reach * .85, cy + dy * reach * .5, end - 4)]
        tentacle(s, pts, 2.2, .9, mat='purp', tip='pink')
    e = E.Ellip(cx, cy, 20, 5, 4, 5, mat='chitin', role='roof', contour=True)
    e.post = spot_post(e, 'chitin', 'pink', .14, 7, 1.5)
    s.add(e)
    return s


def circle():
    """공명석 원: 둥글게 떠 있는 검은 돌 여섯 + 가운데 빛 수정 + 바닥 빛 고리."""
    s = Scene()
    cx, cy = 14, 11
    for k in range(7):
        th = 2 * math.pi * k / 7 + .2
        x, y = cx + 11 * math.cos(th), cy + 8 * math.sin(th)
        h = 10 if math.sin(th) > 0 else 8
        crystal(s, (x, y, 2.2), (0, 0, 1), h, 1.6, mat='basalt2', tip=2.4, spin=20)
        sphere(s, x, y, 2.2 + h + 1.2, .8, mat='neon', contour=False)
    ring_h(s, cx, cy, .6, 6, thick=1.0, nseg=16, mat='neon')
    crystal(s, (cx, cy, 2), (0, 0, 1), 10, 1.8, tip=2.6)
    return s


def volcano():
    """얼음 화산: 검은 현무암 밑동 + 얼음 덮인 원뿔 + 청록 수정 줄기 + 꼭대기 청록 분출."""
    s = Scene()
    cx, cy = 14, 10
    s.add(M.Frustum(cx, cy, 12, 8.4, 0, 6, mat='basalt2', role='wall', contour=True))
    ice = M.Frustum(cx, cy, 9.4, 3.6, 5.6, 15, mat='ice', role='wall', contour=True)
    cr = np.array(ob.MAT['crys'][1], np.uint8)

    def streak(tag, P, c, s_, nrm):
        ang = np.degrees(np.arctan2(P[:, 1] - cy, P[:, 0] - cx))
        m = (np.abs(nrm[:, 2]) < .9) & (np.mod(ang + 400, 40) < 6) & (P[:, 2] > 7 + ob.hsh(np.floor(ang / 40), 0, 2) * 4)
        return np.where(m[:, None], cr[None, :], c).astype(np.uint8)
    ice.post = streak
    s.add(ice)
    s.add(M.Frustum(cx, cy, 3.2, 3.2, 14.6, 15.3, mat='crys', role='misc'))
    for (x, y, ax, Ln) in ((cx - 10, 3, (-.6, 0, 1), 5), (cx + 10, 4, (.6, 0, 1), 4.5), (cx + 4, 1.5, (.2, 0, 1), 3.4)):
        crystal(s, (x, y, 0), ax, Ln, 1.1)
    for i in range(2):
        r = 2.0 + i * .7
        s.add(M.Dome(cx + (i % 2 - .5) * 1.6, cy, 16.5 + i * 2.6, r, zmin=-99, mat='crys', role='steam', contour=True))
    s.add(M.Dome(cx, cy, 15.8, 1.8, zmin=-99, mat='neon', role='steam', contour=False))
    for (x, z) in ((cx - 4.5, 19), (cx + 5, 20)):
        s.add(M.Dome(x, cy, z, .9, zmin=-99, mat='crys', role='steam'))
    return s


def floating():
    """중력 이상 부유섬: 거꾸로 선 주황 바위섬(위에 보라 숲·작은 돔 관측소·수정) + 떠도는 바위 조각."""
    s = Scene()
    xc, yc = 38, 16
    zb = 24
    s.add(E.InvCone(xc, yc, 22, zb - 18, zb, mat='orock', tex='speck', role='wall', contour=True))
    s.add(E.Ellip(xc, yc, zb, 23, 13, 2.4, mat='purp', tex='speck', role='ground', contour=True))
    crystal(s, (xc - 6, yc, zb - 16), (.2, 0, -1), 6, 1.4, tip=2.4)
    glass_dome(s, xc + 6, yc + 2, 7, z=zb + 1, base=1.6)
    antenna(s, xc + 15, yc + 4, zb + 1, 10, w=1.2)
    for (x, y, h, sd) in ((xc - 15, yc - 2, 9, 1), (xc - 9, yc + 5, 11, 2), (xc - 18, yc + 4, 7, 3)):
        tentacle(s, [(x, y, zb + 1), (x + 1, y, zb + h * .6), (x + 2.4, y, zb + h)], 1.2, .7, mat='purp', tip='pink')
    frond(s, xc - 4, yc - 8, 4, seed=8)
    cluster(s, xc + 16, yc - 6, z=zb + 1, size=.7, n=3, seed=5)
    # 떠도는 조각
    for (x, y, z, r) in ((8, 10, 18, 5), (70, 12, 26, 4.5), (64, 6, 8, 3), (14, 6, 4, 2.6)):
        s.add(E.InvCone(x, y, r, z - r * 1.4, z, mat='orock', tex='speck', role='misc', contour=True))
        s.add(E.Ellip(x, y, z, r, r * .7, .9, mat='purp', role='misc', contour=True))
    crystal(s, (70, 12, 26.5), (.1, 0, 1), 5, 1.0)
    for p in s.prims:
        p.role = 'nocast'
    return s


ORDER = [
    ('capital', '이주민 돔 도시', 'capital', (6, 6), '큰 유리 돔·관측탑·착륙장과 착륙선·작은 돔과 통로·보라 식물'),
    ('fort_city', '방어 기지', 'fort_city', (4, 4), '콘크리트 방벽·강철 문·네 귀 포탑·유리 돔·레이더 접시'),
    ('harbor_city', '우주항', 'harbor_city', (5, 4), '로켓 발사탑·연료 탱크·격납고·착륙장의 착륙선 둘'),
    ('castle', '여왕 둥지', 'castle', (3, 3), '휘어진 키틴 첨탑 다발·알주머니·발광 입구'),
    ('castle', '군 전초기지', 'castle_b', (3, 3), '사령동·감시탑·방벽과 강철 문·접시 안테나·깃발'),
    ('large_town', '버섯 마을', 'large_town', (3, 3), '거대 버섯 집 셋(문·불빛 창)과 작은 버섯'),
    ('village', '캡슐 마을', 'village', (2, 2), '누운 캡슐 주거 셋·급수탑'),
    ('village', '수정 마을', 'village_b', (2, 2), '주황 바위 움집과 지붕에 박힌 청록 수정'),
    ('camp', '조사 캠프', 'camp', (2, 2), '돔 텐트 둘·6륜 탐사차·작은 접시'),
    ('tower_small', '통신 안테나', 'tower_small', (1, 2), '줄무늬 격자탑·접시·표지등'),
    ('tower_great', '고대 오벨리스크', 'tower_great', (2, 4), '계단 기단·청록 문양이 빛나는 검은 첨탑·꼭대기 수정'),
    ('cave', '수정 동굴', 'cave', (2, 2), '주황 바위 언덕 입구와 둘레의 청록 수정'),
    ('ruin', '추락한 우주선', 'ruin', (2, 2), '비스듬히 박힌 선체·꺾인 날개·연기·파편'),
    ('ruin_city', '고대 문명 유적', 'ruin_city', (4, 3), '휘어진 기둥 열·무너진 아치·문양 판·수정'),
    ('shrine', '외계 신전', 'shrine', (3, 3), '계단 기단·수정 기둥·떠 있는 고리·빛 구슬'),
    ('landmark_nature', '촉수 나무', 'landmark_nature', (3, 3), '굵은 줄기와 휘어 늘어진 촉수 가지·발광 구슬'),
    ('circle', '공명석 원', 'circle', (2, 2), '둥글게 선 검은 돌과 가운데 수정·바닥 빛 고리'),
    ('volcano', '얼음 화산', 'volcano', (2, 2), '얼음 원뿔과 청록 분출'),
    ('floating', '중력 이상 부유섬', 'floating', (5, 4), '거꾸로 선 바위섬·보라 숲·관측 돔·떠도는 조각'),
]
