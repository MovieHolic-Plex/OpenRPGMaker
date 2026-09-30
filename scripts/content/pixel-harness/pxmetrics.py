# 도트 품질 지표. 입력 RGBA 배열 하나를 재서 수치와 결함 좌표를 낸다(합/불 판정은 pxlint.py 가 refmap-stats.json 범위로 한다).
# 크기에 기대는 값(띠 폭·그늘 폭·덩어리 넓이·블록 크기)은 k = tile/32 로 늘이고 줄인다. 넓이는 k² 로 32px 기준에 맞춰 보고한다.
import math
import numpy as np
from scipy import ndimage

VERSION = 1

# ------------------------------------------------------------------ 색 공간
def lum(rgb):
    return 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]

def oklab(rgb):
    c = rgb / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    l = 0.4122214708 * c[..., 0] + 0.5363325363 * c[..., 1] + 0.0514459929 * c[..., 2]
    m = 0.2119034982 * c[..., 0] + 0.6806995451 * c[..., 1] + 0.1073969566 * c[..., 2]
    s = 0.0883024619 * c[..., 0] + 0.2817188376 * c[..., 1] + 0.6299787005 * c[..., 2]
    l, m, s = np.cbrt(l), np.cbrt(m), np.cbrt(s)
    return np.stack([0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
                     1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
                     0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s], -1)

def hls_s(rgb):
    c = rgb / 255.0; mx = c.max(-1); mn = c.min(-1); l = (mx + mn) / 2
    den = 1 - np.abs(2 * l - 1)
    return np.where(den > 1e-6, (mx - mn) / np.maximum(den, 1e-6), 0.0)

NB8 = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]

def shift(a, dy, dx, fill=0):
    out = np.full_like(a, fill)
    H, W = a.shape[:2]
    ys = slice(max(0, dy), H + min(0, dy)); yd = slice(max(0, -dy), H + min(0, -dy))
    xs = slice(max(0, dx), W + min(0, dx)); xd = slice(max(0, -dx), W + min(0, -dx))
    out[yd, xd] = a[ys, xs]
    return out

def q(v, n=3):
    return None if v is None or (isinstance(v, float) and not math.isfinite(v)) else round(float(v), n)

# ------------------------------------------------------------------ 준비
class Ctx:
    def __init__(self, a, tile=32, surface=False):
        self.a = a.astype(np.float64); self.tile = tile; self.k = tile / 32.0; self.surface = surface
        self.rgb = self.a[..., :3]; self.alpha = self.a[..., 3]
        self.H, self.W = self.alpha.shape
        self.body = self.alpha >= 200
        if surface:
            self.body = self.alpha >= 1
        self.semi = (self.alpha > 0) & (self.alpha < 200)
        self.L = lum(self.rgb); self.lab = oklab(self.rgb)
        self.key = (self.a[..., 0].astype(np.int64) << 16) | (self.a[..., 1].astype(np.int64) << 8) | self.a[..., 2].astype(np.int64)
        pad = np.pad(self.body, 1)
        if surface:
            self.d = np.full(self.body.shape, 99.0); self.near = None
        else:
            d, ind = ndimage.distance_transform_edt(pad, return_indices=True)
            self.d = d[1:-1, 1:-1]; self.near = (ind[0][1:-1, 1:-1] - 1, ind[1][1:-1, 1:-1] - 1)
        self.inner = ndimage.binary_erosion(self.body, np.ones((3, 3)), border_value=0 if not surface else 1)
        self._lines = None

    def px(self):
        return int(self.body.sum())

    def lines(self):
        """어두운 선(줄눈·판 이음·윤곽 안쪽 선): 주변 중앙값보다 t 이상 어두운 화소."""
        if self._lines is None:
            s = max(3, int(round(5 * self.k)) | 1)
            Lm = np.where(self.body, self.L, np.nan)
            med = ndimage.generic_filter(Lm, np.nanmedian, size=s, mode='nearest') if self.body.sum() < 40000 else ndimage.median_filter(self.L, s)
            self._lines = self.body & (self.L < med - 14) & np.isfinite(med)
        return self._lines

# ------------------------------------------------------------------ 1. 외톨이 화소
def orphans(c, t=0.075):
    """8 이웃 모두와 OKLab 거리 t 넘게 다르고, 이웃끼리는 고른(이웃 퍼짐 < 거리의 절반) 화소 = 고른 면 위에 떨어진 점.
    붓 그림의 잔 무늬(이웃도 제각각)는 외톨이가 아니다. 반투명 곁 화소는 뺀다."""
    inner = c.inner & ~ndimage.binary_dilation(c.semi, np.ones((3, 3)))
    nbs = [np.stack([shift(c.lab[..., i], dy, dx) for i in range(3)], -1) for dy, dx in NB8]
    mind = np.min([np.linalg.norm(c.lab - nb, axis=-1) for nb in nbs], axis=0)
    mean = np.mean(nbs, axis=0)
    spread = np.mean([np.linalg.norm(nb - mean, axis=-1) for nb in nbs], axis=0)
    o = inner & (mind > t) & (spread < 0.5 * mind)
    ys, xs = np.nonzero(o)
    n = max(1, int(inner.sum()))
    return dict(rate=q(o.sum() / n, 4), count=int(o.sum()), defects=[[int(x), int(y)] for y, x in zip(ys, xs)])

# ------------------------------------------------------------------ 2. 들쭉날쭉 선 / 계단 규칙성
def _profile_defects(p, t0, axis, side):
    """p: 연속 줄의 가장자리 좌표. 모서리(|d|>3)에서 끊고, 노치(1줄 들어갔다 나옴)와 불규칙 계단(가운데 run 이 튐)을 찾는다."""
    out = []; triples = 0; regular = 0
    p = np.asarray(p); d = np.diff(p)
    segs = []; start = 0
    for i, v in enumerate(d):
        if abs(v) > 3:
            segs.append((start, i)); start = i + 1
    segs.append((start, len(p) - 1))
    for s0, s1 in segs:
        if s1 - s0 < 3: continue
        dd = d[s0:s1]
        notches = [i for i in range(len(dd) - 1) if dd[i] != 0 and dd[i + 1] == -dd[i] and abs(dd[i]) == 1]
        if len(notches) <= max(1, 0.2 * len(dd)):      # 노치(한 줄짜리 혹/홈). 잦으면 술·톱니 같은 무늬라 뺀다
            for i in notches:
                out.append((t0 + s0 + i + 1, int(p[s0 + i + 1]), 'notch'))
        steps = [i for i, v in enumerate(dd) if v != 0]
        runs = []  # (길이, 부호, 시작 위치)
        for a, b in zip(steps, steps[1:]):
            runs.append((b - a, int(np.sign(dd[b])), s0 + a + 1))
        for (ra, sa, _), (rb, sb, pb), (rc, sc, _) in zip(runs, runs[1:], runs[2:]):
            if not (sa == sb == sc) or max(ra, rb, rc) > 8: continue
            triples += 1
            ext = rb > max(ra, rc) or rb < min(ra, rc)
            if ext and max(ra, rb, rc) - min(ra, rb, rc) >= 2:
                mid = pb + rb // 2
                out.append((t0 + mid, int(p[min(mid, len(p) - 1)]), 'stair'))
            else:
                regular += 1
    res = []
    for t, v, kind in out:
        x, y = (v, t) if axis == 'row' else (t, v)
        res.append((x, y, kind))
    return res, triples, regular

def _mask_jaggies(m, c):
    ys, xs = np.nonzero(m)
    if len(ys) == 0: return [], 0, 0
    defects = []; tri = reg = 0
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    for axis in ('row', 'col'):
        rng = range(y0, y1 + 1) if axis == 'row' else range(x0, x1 + 1)
        lo, hi, idx = [], [], []
        def flush():
            nonlocal tri, reg
            if len(idx) >= 5:
                for prof, side in ((lo, 'lo'), (hi, 'hi')):
                    r, t_, g_ = _profile_defects(prof, idx[0], axis, side); defects.extend(r); tri += t_; reg += g_
        for t in rng:
            line = m[t, :] if axis == 'row' else m[:, t]
            nz = np.nonzero(line)[0]
            if len(nz) == 0 or (idx and t != idx[-1] + 1):
                flush(); lo, hi, idx = [], [], []
                if len(nz) == 0: continue
            lo.append(int(nz[0])); hi.append(int(nz[-1])); idx.append(t)
        flush()
    return defects, tri, reg

def jaggies(c):
    """실루엣(물체) 또는 어두운 선 덩이(표면)의 가장자리 계단. 반투명 번짐(AA)이 곁에 있는 곳은 부드럽게 보이므로 뺀다."""
    masks = []
    if not c.surface:
        lab, n = ndimage.label(c.body)
        for i in range(1, n + 1):
            m = lab == i
            if m.sum() >= 12: masks.append(m)
    ln = c.lines() if c.surface else np.zeros_like(c.body)   # 물체 속 선(책 사이 틈 등)은 설계 무늬라 재지 않는다
    lab, n = ndimage.label(ln, np.ones((3, 3)))
    for i, sl in enumerate(ndimage.find_objects(lab), 1):
        m = lab == i; ys, xs = np.nonzero(m)
        if len(ys) < 8: continue
        ev = np.linalg.eigvalsh(np.cov(np.stack([xs, ys]).astype(float)) + 1e-6 * np.eye(2))
        if ev[1] / max(ev[0], 1e-3) >= 12:            # 곧은 선 덩이만(돌 줄눈 같은 불규칙 선은 원래 삐뚤다)
            masks.append(m)
    soft = ndimage.binary_dilation(c.semi, np.ones((3, 3)))
    defs = []; tri = reg = 0
    for m in masks:
        d, t_, g_ = _mask_jaggies(m, c); tri += t_; reg += g_
        defs.extend([(x, y, k) for x, y, k in d if 0 <= y < c.H and 0 <= x < c.W and not soft[y, x]])
    perim = 0
    for m in masks:
        perim += int((m & ~ndimage.binary_erosion(m)).sum())
    seen = set(); uniq = []
    for x, y, k in defs:
        if (x, y) not in seen: seen.add((x, y)); uniq.append([x, y, k])
    return dict(per100=q(100 * len(uniq) / max(1, perim), 2), count=len(uniq), perimeter=perim,
                stair_regular=q(reg / tri, 3) if tri else None, triples=tri, defects=uniq)

# ------------------------------------------------------------------ 3. 명암 띠(banding)
def banding(c, nmin=4, smin=5.0, smax=26.0):
    """가로·세로 줄의 같은 색 run 이 한 방향으로 smin~smax 씩 nmin 번 넘게 이어 밝아지거나 어두워지고,
    가운데 run 들이 좁은 고원(폭 ≤ 6k, 두 개 이상 폭 ≥ 2)이면 계단 띠. 붓 그림 그라데이션(폭 1, 매 화소 조금씩)과 가른다."""
    wmax = max(2, int(round(6 * c.k)))
    mark = np.zeros(c.body.shape, bool); segs = []
    def scan(key, L, body, transpose):
        H, W = key.shape
        for y in range(H):
            runs = []; x = 0
            while x < W:
                if not body[y, x]:
                    x += 1; runs.append(None); continue
                x2 = x
                while x2 + 1 < W and body[y, x2 + 1] and key[y, x2 + 1] == key[y, x]: x2 += 1
                runs.append((x, x2 - x + 1, L[y, x])); x = x2 + 1
            seq = []
            def close(seq):
                if len(seq) < nmin: return
                mid = seq[1:-1]
                if not mid or max(r[1] for r in mid) > wmax or sum(r[1] >= 2 for r in mid) < 2: return
                for r in seq:
                    if transpose: mark[r[0]:r[0] + r[1], y] = True
                    else: mark[y, r[0]:r[0] + r[1]] = True
                xa, xb = seq[0][0], seq[-1][0] + seq[-1][1] - 1
                segs.append([y, xa, y, xb] if transpose else [xa, y, xb, y])
            for r in runs:
                if r is None:
                    close(seq); seq = []; continue
                if seq:
                    dl = r[2] - seq[-1][2]
                    ok = smin <= abs(dl) <= smax and (len(seq) < 2 or np.sign(dl) == np.sign(seq[-1][2] - seq[-2][2]))
                    if not ok:
                        close(seq); seq = [seq[-1]] if smin <= abs(dl) <= smax else []
                seq.append(r)
            close(seq)
    scan(c.key, c.L, c.body, False)
    scan(c.key.T, c.L.T, c.body.T, True)
    n = max(1, c.px())
    return dict(ratio=q(mark.sum() / n, 4), segments=len(segs), defects=segs[:600])

# ------------------------------------------------------------------ 4·8. 베개 명암 / 빛 방향
def _shade(d, near, L, m, r):
    """조각 하나(m)의 가장자리 띠에서 면별 어두워짐과 빛 벡터."""
    yy, xx = np.nonzero(m)
    if len(yy) < 20: return None
    ny = near[0][yy, xx] - yy; nx = near[1][yy, xx] - xx
    nn = np.hypot(nx, ny); nn[nn == 0] = 1; nx = nx / nn; ny = ny / nn
    dv = d[yy, xx]; Lv = L[yy, xx]
    band = dv <= 1.5 + r; shade = (dv > 1.5) & (dv <= 1.5 + r); core = dv > 1.5 + r
    res = {}
    if band.sum() >= 12:
        A = np.stack([np.ones(band.sum()), nx[band], ny[band]], 1)
        coef, *_ = np.linalg.lstsq(A, Lv[band], rcond=None)
        res['bx'], res['by'] = float(coef[1]), float(coef[2])
        res['Lband'] = float(Lv[band].mean())
    if core.sum() >= 6 and shade.sum() >= 12:
        Lc = float(Lv[core].mean()); drops = {}
        for name, sel in (('top', ny < -0.6), ('bottom', ny > 0.6), ('left', nx < -0.6), ('right', nx > 0.6)):
            s = shade & sel
            if s.sum() >= 4: drops[name] = (Lc - float(Lv[s].mean())) / max(1.0, Lc)
        if len(drops) >= 3:
            res['pillow'] = min(drops.values()); res['drops'] = drops
    res['Lmean'] = float(Lv.mean()); res['n'] = int(len(yy))
    return res

def _radial(d, L, m, k):
    """베개 명암 점수 = spearman(밝기, 가장자리 거리) − |pearson(밝기, 왼쪽 위 방향 위치)|.
    윤곽을 따라 고르게 어두워지고(첫 항 큼) 빛 방향 기울기가 없으면(둘째 항 작음) 크다."""
    sel = m & (d > 1.5)
    ys, xs = np.nonzero(sel)
    if len(ys) < 20: return None
    Lv = L[sel]; dv = np.minimum(d[sel], 6 * k)
    if np.ptp(Lv) < 1 or np.ptp(dv) < 1: return None
    rd = _spearman(Lv, dv)
    proj = -((xs - xs.mean()) + (ys - ys.mean())) / math.sqrt(2)
    rl = float(np.corrcoef(Lv, proj)[0, 1]) if np.ptp(proj) > 0 else 0.0
    return rd - abs(rl), rd, rl

def _spearman(a, b):
    ra = np.argsort(np.argsort(a, kind='stable'), kind='stable').astype(float)
    rb = np.argsort(np.argsort(b, kind='stable'), kind='stable').astype(float)
    # 같은 값은 평균 순위로
    for arr_, r in ((a, ra), (b, rb)):
        u, inv = np.unique(arr_, return_inverse=True)
        sums = np.bincount(inv, weights=r); cnt = np.bincount(inv); r[:] = (sums / cnt)[inv]
    return float(np.corrcoef(ra, rb)[0, 1])

def _pieces(c):
    """어두운 선으로 나눈 조각(판·돌·면). 물체는 실루엣 안에서 나눈다."""
    rp = max(1, int(round(2 * c.k)))
    m = c.body & ~c.lines() & (c.d > 1.0)
    lab, n = ndimage.label(m)
    out = []
    for i, sl in enumerate(ndimage.find_objects(lab), 1):
        pm = lab[sl] == i
        if pm.sum() < 40 * c.k * c.k: continue
        # 표면: 잘라 낸 가장자리는 조각의 끝이 아니다(이웃 칸으로 이어진다) → 바깥을 조각으로 채워 거리에서 뺀다
        edge_val = c.surface
        pad = np.pad(pm, 1, constant_values=edge_val)
        if edge_val:
            y0, x0 = sl[0].start, sl[1].start
            if y0 > 0: pad[0, :] = False
            if x0 > 0: pad[:, 0] = False
            if sl[0].stop < c.H: pad[-1, :] = False
            if sl[1].stop < c.W: pad[:, -1] = False
            if pad.all(): continue
        d, ind = ndimage.distance_transform_edt(pad, return_indices=True)
        d = d[1:-1, 1:-1]; near = (ind[0][1:-1, 1:-1] - 1, ind[1][1:-1, 1:-1] - 1)
        res = _shade(d, near, c.L[sl], pm, rp)
        if res:
            rr = _radial(d, c.L[sl], pm, c.k)
            res['radial'] = rr[0] if rr else None
            res['box'] = [sl[1].start, sl[0].start, sl[1].stop, sl[0].stop]; out.append(res)
    return out

LIGHT_REF = 125.0      # 기준 빛: 왼쪽 위(수학 각도, 0=오른쪽 90=위)
LIGHT_TOL = 100.0      # 이만큼 넘게 벗어나면 반대쪽 빛
LIGHT_MIN = 0.06       # 이보다 약한 기울기는 방향 없음으로 본다

def shading(c):
    """베개 명암·빛 방향. 물체: 실루엣 전체로 베개 점수, 빛은 실루엣 가장자리 회귀. 표면: 조각별 점수를 넓이로 평균."""
    r = max(1, int(round(3 * c.k)))
    pieces = _pieces(c)
    out = dict(pieces=len(pieces))
    bad = []
    if not c.surface:
        rr = _radial(c.d, c.L, c.body, c.k)
        out['pillow'] = q(rr[0]) if rr else None
        out['pillow_rd'] = q(rr[1]) if rr else None
        out['pillow_rl'] = q(rr[2]) if rr else None
        whole = _shade(c.d, c.near, c.L, c.body, r)
        pp = [p for p in pieces if 'bx' in p]
        # 조각(한 재질 면)으로 재면 재질 밝기 차(흰 받침돌 등)가 빛으로 오인되지 않는다. 조각이 몸의 30% 미만이면 실루엣 전체로.
        if sum(p['n'] for p in pp) >= 0.3 * max(1, c.px()): src = pp
        else: src = [whole] if whole and 'bx' in whole else []
    else:
        rs = [(p['radial'], p['n']) for p in pieces if p.get('radial') is not None]
        out['pillow'] = q(np.average([v for v, _ in rs], weights=[n for _, n in rs])) if rs else None
        src = [p for p in pieces if 'bx' in p]
    for p in pieces:
        if (p.get('radial') or -1) > 0.45: bad.append(p['box'] + ['pillow'])
    if src:
        w = [p['n'] for p in src]
        bx = np.average([p['bx'] for p in src], weights=w); by = np.average([p['by'] for p in src], weights=w)
        Lm = np.average([p['Lmean'] for p in src], weights=w)
        ang = (math.degrees(math.atan2(-by, bx)) + 360) % 360; st = math.hypot(bx, by) / max(1.0, Lm)
        out['light_angle'] = q(ang, 1); out['light_strength'] = q(st)
        out['light_dev'] = q(abs((ang - LIGHT_REF + 180) % 360 - 180), 1)
    else:
        out['light_angle'] = out['light_strength'] = out['light_dev'] = None
    # 조각끼리 빛 방향이 기준에서 벗어난 넓이 비율(표면·물체 공통, 약한 조각은 뺀다)
    mis = []
    for p in pieces:
        if 'bx' not in p: continue
        st = math.hypot(p['bx'], p['by']) / max(1.0, p['Lmean'])
        if st < LIGHT_MIN: continue
        a2 = (math.degrees(math.atan2(-p['by'], p['bx'])) + 360) % 360
        off = abs((a2 - LIGHT_REF + 180) % 360 - 180) > LIGHT_TOL
        mis.append((off, p['n']))
        if off: bad.append(p['box'] + ['light'])
    out['light_inconsistent'] = q(sum(n for o, n in mis if o) / sum(n for _, n in mis)) if mis else None
    out['defects'] = bad
    return out

# ------------------------------------------------------------------ 5. 색 수 / 램프 / 덩어리 / 색조 이동
def palette(c, radius=0.04, cover=0.95):
    b = c.body & (c.d > 0)
    keys = c.key[b]
    if len(keys) == 0: return dict(unique=0, effective=0)
    uk, inv, cnt = np.unique(keys, return_inverse=True, return_counts=True)
    rgb = np.stack([(uk >> 16) & 255, (uk >> 8) & 255, uk & 255], -1).astype(np.float64)
    lab = oklab(rgb)
    order = np.argsort(-cnt); centers = []; weight = []; assign = np.zeros(len(uk), int)
    for i in order:
        if centers:
            dist = np.linalg.norm(np.array(centers) - lab[i], axis=1); j = int(dist.argmin())
            if dist[j] < radius:
                assign[i] = j; weight[j] += cnt[i]; continue
        centers.append(lab[i]); weight.append(cnt[i]); assign[i] = len(centers) - 1
    w = np.sort(np.array(weight))[::-1]; cs = np.cumsum(w) / w.sum()
    eff = int(np.searchsorted(cs, cover) + 1)
    # 램프: 가장 큰 색조 무리(중성 포함) 안의 군집 수
    C = np.array(centers); ch = np.hypot(C[:, 1], C[:, 2]); hue = np.degrees(np.arctan2(C[:, 2], C[:, 1])) % 360
    W8 = np.array(weight, float)
    fam = np.where(ch < 0.025, -1, (hue // 30).astype(int))
    best = max(set(fam.tolist()), key=lambda f: W8[fam == f].sum())
    sel = (fam == best) & (W8 >= 0.005 * W8.sum())
    ramp = int(sel.sum())
    # 덩어리: 화소마다 군집 번호 → 연결 성분 넓이(32px 기준으로 환산)
    cl = np.full(c.body.shape, -1); cl[b] = assign[inv]
    areas = []
    for j in range(len(centers)):
        lab_, n = ndimage.label(cl == j)
        if n: areas.extend(np.bincount(lab_.ravel())[1:].tolist())
    areas = np.array(areas, float) / (c.k * c.k)
    # 색조 이동: 어두운 ⅓ 과 밝은 ⅓ 의 평균 OKLab 색상각
    Lb = c.L[b]; labb = c.lab[b]
    lo, hi = np.quantile(Lb, [1 / 3, 2 / 3])
    def hue_of(m):
        a_, b_ = labb[m, 1].mean(), labb[m, 2].mean(); return (math.degrees(math.atan2(b_, a_)) % 360, math.hypot(a_, b_))
    (hd, cd), (hl, cl_) = hue_of(Lb <= lo), hue_of(Lb >= hi)
    shift_ = (hd - hl + 180) % 360 - 180
    cool = abs((hd - 255 + 180) % 360 - 180) < abs((hl - 255 + 180) % 360 - 180)
    return dict(unique=int(len(uk)), effective=eff, ramp_steps=ramp,
                clump_median=q(np.median(areas), 2), clump_p90=q(np.quantile(areas, 0.9), 2), clump_single=q((areas <= 1.0 / (c.k * c.k) + 1e-9).mean(), 3),
                hue_shift=q(shift_, 1), hue_shift_abs=q(abs(shift_) if min(cd, cl_) > 0.02 else 0.0, 1),
                dark_cooler=bool(cool), chroma_dark=q(cd), chroma_light=q(cl_))

# ------------------------------------------------------------------ 6. 채도
def saturation(c):
    b = c.body & (c.d > 1.5)
    if b.sum() < 10: b = c.body
    s = hls_s(c.rgb)[b]; ch = np.hypot(c.lab[..., 1], c.lab[..., 2])[b]
    return dict(s_median=q(np.median(s)), s_p90=q(np.quantile(s, 0.9)), chroma_median=q(np.median(ch)), chroma_p90=q(np.quantile(ch, 0.9)))

# ------------------------------------------------------------------ 7. 윤곽선 대비 / 줄눈
def outline(c):
    out = {}
    if not c.surface:
        edge = c.body & (c.d <= 1.0); inner = c.body & (c.d >= 3)
        if edge.sum() and inner.sum():
            out['edge_ratio'] = q(c.L[edge].mean() / max(1.0, c.L[inner].mean()))
            out['edge_black'] = q((c.L[edge] < 28).mean())
            ys, xs = np.nonzero(edge & (c.L < 28))
            out['defects'] = [[int(x), int(y)] for y, x in zip(ys, xs)]
    ln = c.lines(); rest = c.body & ~ln
    out['line_frac'] = q(ln.sum() / max(1, c.px()))
    ys, xs = np.nonzero(ln); out['line_defects'] = [[int(x), int(y)] for y, x in zip(ys, xs)][:3000]
    if ln.sum() >= 4 and rest.sum() >= 4:
        mr = float(np.median(c.L[rest])); out['joint_contrast'] = q((mr - float(np.median(c.L[ln]))) / max(1.0, mr))
    else:
        out['joint_contrast'] = 0.0
    return out

# ------------------------------------------------------------------ 9. 균일 잡음 결 / 10. 디더
def noise(c):
    m = c.body & (c.d > 2.5) & ~ndimage.binary_dilation(c.lines(), np.ones((3, 3)))
    if m.sum() < 30:
        return dict(rms=None, ac1=None, block_cv=None, defects=[])
    Lf = np.where(m, c.L, 0.0); wt = m.astype(float)
    sm = ndimage.gaussian_filter(Lf, 1.0 * max(0.75, c.k)) / np.maximum(ndimage.gaussian_filter(wt, 1.0 * max(0.75, c.k)), 1e-6)
    R = np.where(m, c.L - sm, 0.0)
    rms = float(np.sqrt((R[m] ** 2).mean()))
    acs = []
    for dy, dx in ((0, 1), (1, 0)):
        a_ = R[:c.H - dy, :c.W - dx]; b_ = R[dy:, dx:]; mm = m[:c.H - dy, :c.W - dx] & m[dy:, dx:]
        if mm.sum() > 10:
            acs.append(float(np.corrcoef(a_[mm], b_[mm])[0, 1]))
    ac1 = float(np.mean(acs)) if acs else None
    bs = max(4, int(round(8 * c.k))); blocks = []; bad = []
    for y in range(0, c.H - bs + 1, bs):
        for x in range(0, c.W - bs + 1, bs):
            mb = m[y:y + bs, x:x + bs]
            if mb.mean() >= 0.5:
                v = float(np.sqrt((R[y:y + bs, x:x + bs][mb] ** 2).mean())); blocks.append(v)
                if v > 9: bad.append([x, y, x + bs, y + bs, 'noise'])
    cv = float(np.std(blocks) / max(1e-6, np.mean(blocks))) if len(blocks) >= 3 else None
    # 반점: 3×3 중앙값에서 10 넘게 튄 화소(잔 결). 블록 덮임 = 반점이 있는 블록 비율(고르게 퍼졌는가)
    med = ndimage.median_filter(c.L, 3)
    sp = m & (np.abs(c.L - med) > 10)
    cover = []
    for y in range(0, c.H - bs + 1, bs):
        for x in range(0, c.W - bs + 1, bs):
            mb = m[y:y + bs, x:x + bs]
            if mb.mean() >= 0.5: cover.append(bool(sp[y:y + bs, x:x + bs].any()))
    # 낱 반점: 같은 방향(밝게/어둡게)으로 튄 반점 중 8 이웃에 같은 방향 반점이 없는 1px 점만.
    # 손으로 놓은 붓자국 덩이(2px 이상 붙음)는 빼고 「고르게 흩은 1px 잡음」만 센다(px48 작업자 제안, 2026-09-29).
    up = sp & (c.L > med); dn = sp & (c.L < med); lone = np.zeros_like(sp)
    for part in (up, dn):
        lab, n = ndimage.label(part, structure=np.ones((3, 3)))
        if n:
            sizes = ndimage.sum(part, lab, index=np.arange(1, n + 1))
            lone |= np.isin(lab, np.nonzero(sizes == 1)[0] + 1)
    return dict(rms=q(rms, 2), ac1=q(ac1), block_cv=q(cv), blocks=len(blocks),
                speckle=q(sp.sum() / max(1, m.sum()), 4), speckle_lone=q(lone.sum() / max(1, m.sum()), 4), speckle_cover=q(np.mean(cover)) if cover else None,
                defects=[[int(x), int(y)] for y, x in zip(*np.nonzero(lone))][:600])

def dither(c):
    k = c.key; b = c.body
    a00, a01, a10, a11 = k[:-1, :-1], k[:-1, 1:], k[1:, :-1], k[1:, 1:]
    bb = b[:-1, :-1] & b[:-1, 1:] & b[1:, :-1] & b[1:, 1:]
    chk = bb & (a00 == a11) & (a01 == a10) & (a00 != a01)
    ys, xs = np.nonzero(chk)
    return dict(ratio=q(chk.sum() / max(1, bb.sum()), 4), defects=[[int(x), int(y)] for y, x in zip(ys, xs)][:400])

# ------------------------------------------------------------------ 전체
def measure(a, tile=32, surface=False):
    c = Ctx(a, tile, surface)
    return dict(version=VERSION, tile=tile, surface=bool(surface), size=[c.W, c.H], px=c.px(),
                orphans=orphans(c), jaggies=jaggies(c), banding=banding(c), shading=shading(c),
                palette=palette(c), saturation=saturation(c), outline=outline(c), noise=noise(c), dither=dither(c),
                semi_alpha=q(c.semi.sum() / max(1, int((c.alpha > 0).sum()))))
