"""실제 지리 구조 `real` — 위·경도 범위 하나로 그 지역의 진짜 해안선·산맥·사막·고원·강·호수를 지도 칸에 옮긴다.

자료: Natural Earth(퍼블릭 도메인) — `geo/*.json.gz`, 만드는 법은 `kit/tools/pack_geo.py`.
지역마다 손으로 꼭짓점을 넣지 않는다. 조수는 지역 이름(REGIONS)이나 범위 box=[서경, 남위, 동경, 북위] 를
제 지식으로 주면 되고, 장소·장벽(여정)은 다른 구조처럼 kit_fit 이 자동으로 맞춘다.

기후는 실제 위도에서(적도 덥고 고위도 춥다), 사막 지역은 모래, 산맥·고원은 높고 차게,
산맥 지역의 긴 축은 척추 산줄기, 큰 강은 이끌린 강, 가장 큰 사막은 4막 사구 바다 자리로 넘긴다.
"""
import gzip
import json
import math
import os

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

W, H = 96, 72
GEO_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'geo')
SS = 4                                   # 칸 하나를 4×4 로 쪼개 칠한 뒤 다수결

# 자주 쓰는 지역 — 조수가 이름으로 부를 수 있다. 값: ([서경, 남위, 동경, 북위](지도 비율 4:3 으로 알아서 넓힌다), 설명, 여정 시작 땅 (경도, 위도)).
REGIONS = {
    'korea': ([119.5, 31.5, 141.5, 44.5], '한반도와 둘레(요동·만주 남부·일본 서부)', (127.5, 37.0)),
    'east-asia': ([100.0, 18.0, 150.0, 52.0], '동아시아(중국 동부·한반도·일본)', (113.0, 34.0)),
    'china': ([73.0, 17.0, 136.0, 54.0], '중국 전체(티베트·고비·황하·장강)', (112.0, 32.0)),
    'japan': ([129.0, 30.5, 142.5, 41.8], '일본 열도(규슈~혼슈 북단, 홋카이도 남단)', (137.5, 36.0)),
    'southeast-asia': ([92.0, -11.0, 141.0, 24.0], '동남아시아(인도차이나·말레이·인도네시아·필리핀)', (102.0, 15.0)),
    'india': ([60.0, 5.0, 100.0, 37.0], '인도 아대륙(히말라야·데칸·타르 사막)', (78.0, 22.0)),
    'middle-east': ([25.0, 10.0, 65.0, 42.0], '중동(아라비아·메소포타미아·페르시아)', (44.0, 33.0)),
    'mediterranean': ([-10.0, 28.0, 40.0, 48.0], '지중해 세계(이베리아~레반트·북아프리카)', (12.5, 42.5)),
    'europe': ([-11.0, 35.5, 36.0, 63.0], '유럽', (10.0, 50.0)),
    'britain': ([-11.0, 49.5, 3.0, 59.5], '브리튼·아일랜드', (-1.5, 53.0)),
    'scandinavia': ([3.0, 54.0, 32.0, 71.5], '스칸디나비아·발트', (15.0, 62.0)),
    'greece': ([18.5, 34.5, 30.0, 42.0], '그리스·에게해', (22.0, 39.5)),
    'italy': ([6.0, 36.0, 19.5, 47.5], '이탈리아 반도', (12.5, 42.5)),
    'egypt': ([24.0, 20.0, 37.5, 32.5], '이집트·나일강·시나이', (31.0, 27.0)),
    'africa': ([-20.0, -36.0, 54.0, 38.0], '아프리카 대륙', (20.0, 5.0)),
    'north-america': ([-130.0, 12.0, -55.0, 62.0], '북아메리카', (-95.0, 40.0)),
    'caribbean': ([-90.0, 8.0, -58.0, 28.0], '카리브해·서인도 제도', (-79.0, 21.7)),
    'south-america': ([-82.0, -56.0, -34.0, 13.0], '남아메리카', (-60.0, -10.0)),
    'australia': ([110.0, -45.0, 156.0, -9.0], '오스트레일리아·뉴질랜드 서부', (134.0, -25.0)),
    'iceland': ([-25.0, 62.5, -12.5, 67.0], '아이슬란드', (-19.0, 64.9)),
}

# 칸보다 좁은 실제 물길(운하·해협) — 칸 그리드로 옮기면 땅으로 막힌다(경도, 위도 꺾은선). 범위 안에 있으면 늘 판다.
# 수에즈가 없으면 지중해·유럽·이집트에서 아프리카가 시나이로 아시아에 붙어 「배로 갈 땅」이 사라졌다.
CUTS = {'suez': [(32.33, 31.35), (32.4, 30.6), (32.55, 29.95), (32.9, 29.2), (33.6, 28.0), (34.1, 27.4)],   # 운하 + 수에즈 만
        'panama': [(-79.92, 9.38), (-79.7, 9.1), (-79.55, 8.9)],
        'gibraltar': [(-6.3, 35.9), (-5.6, 35.97), (-5.0, 36.05), (-4.4, 36.2)],          # 14km — 칸이 0.2° 넘으면 막혀 아프리카가 이베리아에 붙었다
        'bab-el-mandeb': [(42.9, 13.2), (43.35, 12.6), (43.6, 12.3)],
        'messina': [(15.55, 38.35), (15.65, 38.2), (15.6, 37.95)]}

_CACHE = {}


class RealGeoError(ValueError):
    pass


def _load(name):
    if name not in _CACHE:
        with gzip.open(os.path.join(GEO_DIR, name + '.json.gz'), 'rt') as f:
            _CACHE[name] = json.load(f)
    return _CACHE[name]


def fit_box(box):
    """[서경, 남위, 동경, 북위] → 지도 비율(4:3, 가운데 위도 cos 보정)에 맞게 짧은 쪽을 넓힌 범위."""
    if not (isinstance(box, (list, tuple)) and len(box) == 4):
        raise RealGeoError('box 는 [서경, 남위, 동경, 북위] 숫자 4개')
    lon0, lat0, lon1, lat1 = (float(v) for v in box)
    if not (-180 <= lon0 < lon1 <= 180 and -85 <= lat0 < lat1 <= 85):
        raise RealGeoError('box 는 -180≤서경<동경≤180, -85≤남위<북위≤85 (날짜변경선을 넘는 범위는 아직 안 된다)')
    mid = (lat0 + lat1) / 2
    c = math.cos(math.radians(mid))
    w, h = (lon1 - lon0) * c, lat1 - lat0
    if w < 3 or h < 2.2:
        raise RealGeoError('box 가 너무 좁다(가로 3° 이상) — 자료(1:5천만)가 그보다 작은 섬·만은 뭉갠다')
    want = W / H
    if w / h > want:
        dh = w / want - h
        lat0, lat1 = lat0 - dh / 2, lat1 + dh / 2
    else:
        dw = (h * want - w) / c
        lon0, lon1 = lon0 - dw / 2, lon1 + dw / 2
    return [round(lon0, 3), round(max(lat0, -85), 3), round(lon1, 3), round(min(lat1, 85), 3)]


def _proj(box):
    lon0, lat0, lon1, lat1 = box
    sx, sy = W / (lon1 - lon0), H / (lat1 - lat0)
    return lambda lon, lat: ((lon - lon0) * sx, (lat1 - lat) * sy)


def _bbox_hit(rings, box):
    lon0, lat0, lon1, lat1 = box
    pts = rings[0]
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return not (max(xs) < lon0 or min(xs) > lon1 or max(ys) < lat0 or min(ys) > lat1)


def _raster(polys, box, P):
    """다각형 목록(고리 목록들) → 칸 비율(0~1)."""
    img = Image.new('L', (W * SS, H * SS), 0)
    d = ImageDraw.Draw(img)
    for rings in polys:
        if not rings or not rings[0] or not _bbox_hit(rings, box):
            continue
        for k, ring in enumerate(rings):
            if len(ring) < 3:
                continue
            pts = [(x * SS, y * SS) for x, y in (P(a, b) for a, b in ring)]
            d.polygon(pts, fill=255 if k == 0 else 0)
    a = np.asarray(img, float).reshape(H, SS, W, SS).mean(axis=(1, 3)) / 255.0
    return a


def _axis_line(mask):
    """칸 덩이의 긴 축을 따라 마디마다 무게중심 — 굽은 산맥도 따라가는 꺾은선."""
    ys, xs = np.nonzero(mask)
    pts = np.stack([xs, ys], 1).astype(float)
    c = pts.mean(0)
    u, s, vt = np.linalg.svd(pts - c, full_matrices=False)
    ax = vt[0]
    t = (pts - c) @ ax
    span = t.max() - t.min()
    if span < 5:
        return None
    k = max(2, int(span / 5))
    edges = np.linspace(t.min(), t.max() + 1e-6, k + 1)
    line = []
    for i in range(k):
        sel = (t >= edges[i]) & (t < edges[i + 1])
        if sel.any():
            line.append(tuple(pts[sel].mean(0)))
    return line if len(line) >= 2 else None


def _elev_km(B):
    """ETOPO1(0.25°) 높이를 칸마다 — 칸 안 4×4 점 평균, km. 바다·0m 이하는 0."""
    if 'elev' not in _CACHE:
        with gzip.open(os.path.join(GEO_DIR, 'elev.npy.gz'), 'rb') as f:
            _CACHE['elev'] = np.load(f)
    q = _CACHE['elev']
    lon0, lat0, lon1, lat1 = B
    fx = (np.arange(W * SS) + .5) / (W * SS)
    fy = (np.arange(H * SS) + .5) / (H * SS)
    lons = lon0 + fx * (lon1 - lon0)
    lats = lat1 - fy * (lat1 - lat0)
    ix = np.clip(np.round((lons + 179.875) / .25).astype(int), 0, q.shape[1] - 1)
    iy = np.clip(np.round((lats + 89.875) / .25).astype(int), 0, q.shape[0] - 1)
    a = q[iy[:, None], ix[None, :]].astype(float) * .03
    return a.reshape(H, SS, W, SS).mean(axis=(1, 3))


_LAT_T = ((0, 1.0), (20, .86), (30, .70), (40, .55), (55, .41), (65, .28), (75, .12), (90, 0.0))


def _temp_of_lat(lat):
    """위도 → 키트 기온(1 적도 ~ 0 극). 띠: <.31 눈·툰드라, .31~.62 온대, .62~.8 사바나, ≥.8 열대.
    한반도(34~43°)·브리튼(50~58°)이 온대, 스칸디나비아 북부(65°~)부터 툰드라가 되게 맞춘 꺾은선."""
    a = abs(lat)
    for (l0, t0), (l1, t1) in zip(_LAT_T, _LAT_T[1:]):
        if a <= l1:
            return t0 + (t1 - t0) * (a - l0) / (l1 - l0)
    return 0.0


def real(rng, salt, count, target, box=None, region=None, home=None, beyond=None, sands=None):
    if region:
        if region not in REGIONS:
            raise RealGeoError('region 은 %s 중 하나(또는 box 로 범위를 직접)' % ', '.join(REGIONS))
        raw = REGIONS[region][0]
        if home is None:
            home = REGIONS[region][2]
    if not region and box is not None:
        raw = box
    elif not region:
        raise RealGeoError('style real 은 region(지역 이름) 이나 box [서경, 남위, 동경, 북위] 가 있어야 한다')
    B = fit_box(raw)
    P = _proj(B)
    land_f = _raster(_load('land'), B, P)
    land = land_f >= .5
    lakes = [lk for lk in _load('lakes') if (lk.get('rank') or 9) <= 6]
    lake_f = _raster([r for lk in lakes for r in lk['polys']], B, P) if lakes else np.zeros((H, W))
    land &= ~(lake_f >= .5)
    for c in CUTS:                                       # 운하 — 범위 안에 있으면 늘 판다(칸 하나 폭 물길)
        pts = [P(a, b) for a, b in CUTS[c]]
        for i in range(len(pts) - 1):
            (x0, y0), (x1, y1) = pts[i], pts[i + 1]
            n = int(max(abs(x1 - x0), abs(y1 - y0)) * 3) + 2
            for t in np.linspace(0, 1, n):
                x, y = int(round(x0 + (x1 - x0) * t)), int(round(y0 + (y1 - y0) * t))
                if 0 <= x < W and 0 <= y < H:
                    land[y, x] = False
    frac = land.mean()
    if frac < .06:
        raise RealGeoError('이 범위(%s)는 거의 바다다(땅 %.0f%%) — 해안·섬이 들어오게 옮기거나 넓혀라' % (B, frac * 100))
    if frac > .93:
        raise RealGeoError('이 범위(%s)는 거의 땅이다(땅 %.0f%%) — 배 장벽(바다)이 들어갈 해안이 보이게 넓혀라' % (B, frac * 100))

    # 지역(산맥·고원·사막·…) — 칸 비율이 25% 넘는 칸
    kinds = {k: np.zeros((H, W), bool) for k in ('range', 'plateau', 'desert', 'tundra', 'wetland', 'basin', 'plain')}
    named = []
    span_deg = B[2] - B[0]
    max_rank = 5 if span_deg < 25 else 4 if span_deg < 50 else 3
    for rg in _load('regions'):
        if (rg.get('rank') or 9) > max_rank + (1 if rg['kind'] in ('range', 'desert') else 0):
            continue
        f = _raster(rg['polys'], B, P)
        m = (f >= .25) & land
        if m.sum() < 3:
            continue
        kinds[rg['kind']] |= m
        named.append(dict(kind=rg['kind'], name=rg.get('name_ko') or rg['name'], cells=int(m.sum())))

    # 강 — 바다 쪽 끝을 어귀로(자료의 선 방향은 믿지 않는다), 길이 긴 순서로 6줄
    sea_d = ndi.distance_transform_edt(land)
    cand = []
    for rv in _load('rivers'):
        if (rv.get('rank') or 9) > max_rank + 2:
            continue
        for ln in rv['lines']:
            pts = [P(a, b) for a, b in ln]
            inside = [(x, y) for x, y in pts if 0 <= x < W and 0 <= y < H]
            if len(inside) < 3:
                continue
            L = sum(math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]) for i in range(len(pts) - 1))
            if L < 8:
                continue
            d = lambda p: sea_d[min(H - 1, max(0, int(p[1]))), min(W - 1, max(0, int(p[0])))]
            if d(pts[0]) < d(pts[-1]):
                pts = pts[::-1]
            cand.append((L, rv.get('name'), pts))
    cand.sort(key=lambda c: -c[0])
    rivers = [(pts, .45 if i < 2 else .6) for i, (_, _, pts) in enumerate(cand[:6])]
    named += [dict(kind='river', name=n) for _, n, _ in cand[:6] if n]

    # 높이(ETOPO1) — 산은 둘레보다 솟은 곳(고원 한가운데는 평평해서 산이 아니다) + 이름난 산맥
    alt = _elev_km(B) * land
    relief = alt - ndi.gaussian_filter(alt, 2.5)
    peak = land & (((alt >= .9) & (relief >= .22)) | ((alt >= 2.2) & (relief >= .12)) | (alt >= 5.0))
    mtn = ndi.binary_opening(peak | kinds['range'], iterations=1) | (peak & kinds['range'])
    spines = []
    ml, mn = ndi.label(mtn)
    for k in range(1, mn + 1):
        part = ml == k
        if part.sum() < 6:
            continue
        if part.sum() > 90:                          # 큰 산지(히말라야·알프스)는 긴 축으로 두 줄
            ys, xs = np.nonzero(part)
            c = np.array([xs.mean(), ys.mean()])
            pts = np.stack([xs, ys], 1) - c
            v = np.linalg.svd(pts, full_matrices=False)[2][1]
            side = pts @ v >= 0
            for half in (side, ~side):
                hm = np.zeros_like(part)
                hm[ys[half], xs[half]] = True
                if hm.sum() >= 6:
                    line = _axis_line(hm)
                    if line:
                        spines.append(line)
            continue
        line = _axis_line(part)
        if line:
            spines.append(line)

    # 기후 — 실제 위도 + 높이(1km 에 .08 — 고원은 툰드라, 큰 산은 눈), 사막은 마르게(그리고 모래로), 습지는 젖게
    lat_top, lat_bot = B[3], B[1]
    temp = -.05 * alt - .2 * kinds['tundra']                # 높이 냉각은 여기 .05/km + climate 의 .22×elev(.55×alt/3.5) ≈ .085/km
    moist = (-.55 * ndi.gaussian_filter(kinds['desert'].astype(float), 1.0) + .35 * kinds['wetland'] - .15 * kinds['basin']
             - .25 * np.clip((alt - 2.5) / 2, 0, 1))
    elev = .55 * np.clip(alt / 3.5, 0, 1)
    paint = [(kinds['desert'], 'SAND')]
    clim = dict(t0=_temp_of_lat(lat_top), t1=_temp_of_lat(lat_bot), temp=temp, moist=moist, elev=elev, paint=paint, measured=True)

    # 4막 사구 바다 — 가장 큰 사막(없으면 맞춤이 먼 쪽을 고른다)
    dune = None
    dl, dn = ndi.label(kinds['desert'])
    if dn:
        sz = ndi.sum(kinds['desert'], dl, range(1, dn + 1))
        i = int(np.argmax(sz))
        if sz[i] >= 25:
            ys, xs = np.nonzero(dl == i + 1)
            dune = (int(xs.mean()), int(ys.mean()))
    if sands is not None:                                # 4막 사구 자리를 직접(예: 돗토리 사구)
        sx, sy = P(float(sands[0]), float(sands[1]))
        dune = (int(round(sx)), int(round(sy)))
    lab, n = ndi.label(land)
    home_cell = None
    if home is not None:
        hx, hy = P(float(home[0]), float(home[1]))
        home_cell = (int(round(hx)), int(round(hy)))
    if n:
        if home_cell is not None:
            ys, xs = np.nonzero(land)
            i = int(np.argmin((xs - home_cell[0]) ** 2 + (ys - home_cell[1]) ** 2))
            big = lab == lab[ys[i], xs[i]]
        else:
            big = lab == (int(np.argmax(ndi.sum(land, lab, range(1, n + 1)))) + 1)
        if dune is not None and sands is None and not (0 <= dune[0] < W and 0 <= dune[1] < H and big[dune[1], dune[0]]):
            dune = None                                  # 사막이 시작 땅 밖(바다 건너)이면 4막 사구가 될 수 없다
        if dune is None:                                 # 사막이 없는 땅: 시작 땅에서 해안에서 가장 먼 내륙 — 「먼 끝」은 반도 하나를 통째로 모래로 덮었다
            dc = ndi.distance_transform_edt(big)
            yy, xx = np.unravel_index(int(np.argmax(dc)), dc.shape)
            dune = (int(xx), int(yy))

    info = dict(edge_land=True, real=dict(box=B, asked=list(map(float, raw)), region=region, named=named[:24]),
                hint_clim=clim, hint_spines=spines, hint_rivers=rivers, hint_auto=0.0, hint_home_gap=2.6, hint_dune_small=True, hint_dune_rim=(1.0, 1.0))
    if dune:
        info['hint_dune'] = dune
    if home_cell is not None:
        info['hint_home'] = home_cell
    if beyond is not None:                               # 관문 너머(2막) 땅 쪽 — 산벽이 이쪽을 떼어 낸다
        bx, by = P(float(beyond[0]), float(beyond[1]))
        info['hint_pole'] = (int(round(bx)), int(round(by)))
    return land, info
