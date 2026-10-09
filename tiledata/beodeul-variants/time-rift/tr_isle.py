# 떠 있는 돌(부유 섬) 그리기: 윗면(걷는 면) + 남쪽 가장자리 앞면 띠 + 밑면 바위 뿌리(허공으로 가늘어지며 매달린다).
#  - 윗면 판석: 버들항 광장 판석 roman.tex_flag(돌 램프 ST) 그대로, 허공 빛에 아주 조금 식혔다.
#  - 앞면·뿌리: 버들항 절벽(terrain.render)의 칩셋 바위 타일 + 갈빗대 결(왼쪽 밝고 오른쪽 그늘, 사이 틈)을 같은 식으로,
#    밝기 순위를 돌 램프 ST(사이 단 하나 더한 8단)로 옮긴다. 뿌리 끝은 어두워지고, 왼쪽 아래 가장자리에 틈빛(푸른 반사).
#  - 중앙 돌 단: 앞면은 줄눈 없는 매끈한 대리석 띠(버들항 TRV), 원통 명암 + 몰딩 한 줄. 윗면은 동심 고리 판석 + 빛 상감 고리.
# 3/4 시점: 앞면은 가장자리 아래 칸(막힘)에 보인다. 걷는 칸 안에는 두께 띠(LIP px)만 보인다. 빛 왼쪽 위.
import numpy as np
from scipy import ndimage as ndi
from tr_base import *

LIP = 5                      # 걷는 칸 안에 보이는 남쪽 두께 띠(px)
_ROCK = [np.array(terrain.CH.crop((x, y, x + 16, y + 16)).convert('RGB')).astype(float) for (x, y) in ((336, 336), (352, 352), (352, 336))]
def _lum(a): return .30 * a[..., 0] + .59 * a[..., 1] + .11 * a[..., 2]
_RL = []
for t in _ROCK:
    l = _lum(t); v = np.unique(l); _RL.append(np.searchsorted(v, l) / max(1, len(v) - 1))   # 칩셋 바위 타일 밝기 순위 0..1


def rock_rank(X, Y, cx, cy):
    t = _RL[1 + int(_hash(cx, cy, 5) * 2)]
    return t[Y % 16, (X + cx * 5) % 16]


def rib_shade(X, Y, seed=78):
    """버들항 절벽 갈빗대: 5~9px 세로 갈빗대, 왼쪽 밝고 오른쪽 그늘, 사이 어두운 틈 (terrain.render 와 같은 식)."""
    xx = X + int(3 * vnoise(0, Y * 0.08, 9, seed)); rib = int(xx / 7 + _hash(xx // 7, 0, 3) * 0.6); u = (xx % 7) / 7
    sh = 0.36 * (0.5 - u) + 0.18 * (_hash(rib, Y // 32, 4) - 0.5)
    if u > 0.86: sh = -0.5
    return sh


def path_top(X, Y, seed=5):
    """버들항 광장 판석(roman.tex_flag) — 허공 빛에 아주 조금 식히고, 드물게 금·닳은 얼룩."""
    c = roman.tex_flag(X, Y, seed)
    if vnoise(X, Y, 9, seed + 31) > .74: c = mix(c, ST[3], .22)
    if vnoise(X, Y, 3, seed + 32) > .83 and c != ST[3]: c = mix(c, ST[3], .35)
    return mix(c, (126, 136, 176), .07)


def rock_top(X, Y, seed=9):
    """다듬지 않은 바위 윗면: 칩셋 바위 타일 밝기 순위 → 돌 램프 3..6."""
    r = rock_rank(X, Y, X // 16, Y // 16)
    k = 3 + int(r * 3.2 + (vnoise(X, Y, 5, seed) - .5) * .9)
    return STM[max(3, min(7, k))]


def dais_top(X, Y, cx, cy, rx, ry, seed=21):
    """중앙 돌 단 윗면: 동심 고리 판석(고리마다 돌 수가 다르다) + 두 줄 빛 상감 고리 + 고리 사이 작은 빛 점(룬 없는 추상 무늬)."""
    u = (X + .5 - cx) / rx; v = (Y + .5 - cy) / ry; r = math.hypot(u, v); a = math.atan2(v, u)
    return r, a


class Island:
    def __init__(s, mask, style='path', body=6, root=18, seed=1, glow='blue', center=None):
        s.mask = mask; s.style = style; s.body = body; s.root = root; s.seed = seed; s.glow = glow; s.center = center


def _down_dist(M):
    """M 화소마다 아래로 첫 빈 화소까지 거리(0 = 남쪽 경계 화소)."""
    H, W = M.shape; dd = np.full((H, W), 999, int)
    nxt = np.zeros(W, bool); run = np.full(W, 999)
    for y in range(H - 1, -1, -1):
        m = M[y]; below = M[y + 1] if y + 1 < H else np.zeros(W, bool)
        run = np.where(m & ~below, 0, np.where(m, run + 1, 999)); dd[y] = run
    return dd


def _half_width(M):
    """줄마다 가로 반폭(가장 가까운 빈 화소까지 가로 거리)."""
    H, W = M.shape; out = np.zeros((H, W), int)
    for y in range(H):
        row = M[y]
        if not row.any(): continue
        l = np.zeros(W, int); c = 0
        for x in range(W): c = c + 1 if row[x] else 0; l[x] = c
        r = np.zeros(W, int); c = 0
        for x in range(W - 1, -1, -1): c = c + 1 if row[x] else 0; r[x] = c
        out[y] = np.minimum(l, r)
    return out


def render_islands(Wpx, Hpx, islands, layer_roots=None):
    """섬들을 투명 바탕 한 장에. 뿌리를 먼저(모든 섬), 그다음 윗면·앞면(북쪽 섬부터). 반환: RGBA, 종류 지도."""
    img = np.zeros((Hpx, Wpx, 4), np.uint8)
    kind = np.zeros((Hpx, Wpx), np.uint8)        # 0 없음, 1 윗면, 2 두께 띠, 3 앞면·뿌리
    prepared = []
    for isl in islands:
        M = isl.mask
        dd = _down_dist(M); hw = _half_width(M)
        bnd = M & (dd == 0)
        prepared.append((isl, M, dd, hw, bnd))
    # ---- 1) 뿌리·앞면(가장자리 아래 막힌 칸에 보이는 것) — 모든 섬 먼저
    for (isl, M, dd, hw, bnd) in prepared:
        ys, xs = np.nonzero(bnd)
        cxs = {}
        for x, y in zip(xs, ys):
            w = hw[y, x]
            jag = vnoise(x, 0, 3.0, isl.seed + 41) * .55 + vnoise(x, 0, 1.2, isl.seed + 42) * .45
            spike = 1.0 if _hash(x // 3, 0, isl.seed + 43) > .8 else 0.0
            rlen = isl.root * min(1.0, (w - 1) / max(4.0, isl.root * .9)) * (.55 + .7 * jag) + spike * isl.root * .25 * min(1, w / 8)
            body = isl.body if w > 2 else max(1, isl.body - (3 - w) * 2)
            L = int(body + max(0, rlen))
            for k in range(1, L + 1):
                yy = y + k
                if yy >= Hpx or M[yy, x]: break
                fy = LIP + k - 1                                    # 앞면 깊이(두께 띠 위 끝 = 0)
                c = _face_color(isl, x, yy, fy, k, L, body, w)
                if img[yy, x, 3] and kind[yy, x] in (1, 2): continue
                img[yy, x, :3] = c; img[yy, x, 3] = 255; kind[yy, x] = 3
    # ---- 2) 윗면 + 두께 띠
    for (isl, M, dd, hw, bnd) in sorted(prepared, key=lambda p: np.nonzero(p[1])[0].min() if p[1].any() else 0):
        ys, xs = np.nonzero(M)
        for x, y in zip(xs, ys):
            if dd[y, x] < LIP:
                fy = LIP - 1 - dd[y, x]
                c = _face_color(isl, x, y, fy, 0, isl.body, isl.body, hw[y, x]); kd = 2
            else:
                c = _top_color(isl, M, x, y); kd = 1
            img[y, x, :3] = c; img[y, x, 3] = 255; kind[y, x] = kd
    im = Image.fromarray(img, 'RGBA')
    im = _outline(im, kind)
    return im, kind


def _top_color(isl, M, x, y):
    H, W = M.shape
    st = isl.style
    if st == 'dais': c = _dais_px(isl, x, y)
    elif st == 'rock': c = rock_top(x, y, isl.seed)
    else: c = path_top(x, y, isl.seed)
    up = y > 0 and M[y - 1, x]; lf = x > 0 and M[y, x - 1]; rt = x + 1 < W and M[y, x + 1]
    up2 = y > 1 and M[y - 2, x]
    if not up: c = mix(c, ST[6], .7)                     # 북쪽 가장자리: 빛 받은 모서리
    elif not up2: c = mix(c, ST[5], .3)
    if not lf: c = mix(c, ST[6], .45)
    if not rt: c = mix(c, ST[2], .45)
    return c


def _face_color(isl, x, y, fy, k, L, body, w):
    """앞면·뿌리 화소. fy = 두께 띠 위 끝부터 아래로 깊이."""
    if isl.style == 'dais' and fy < LIP + body:
        return _dais_face(isl, x, y, fy, body)
    r = rock_rank(x, fy + 3, x // 16, isl.seed)
    sh = rib_shade(x, fy, isl.seed + 78)
    depth = max(0, fy - (LIP + body)) / max(6.0, L - body)      # 뿌리 안에서 0..1
    t = 2.6 + r * 2.2 + sh * 3.2 - depth * 2.4 - (0.5 if fy > LIP + body else 0)
    if fy == 0: t = 6.2                                          # 두께 띠 윗선: 판석 모서리 빛
    elif fy == 1: t = max(t, 4.6)
    elif fy == LIP + body - 1 and isl.body >= 4: t -= .8       # 몸통 띠 아래 그늘 한 줄
    c = STM[max(1, min(7, int(round(t))))]
    if k > 0 and k >= L - 2: c = STM[1]                          # 뿌리 끝
    # 푸른 틈빛 반사(왼쪽 아래 가장자리 = 다른 섬의 빛)
    return c


def _dais_px(isl, x, y):
    cx, cy, rx, ry = isl.center
    u = (x + .5 - cx) / rx; v = (y + .5 - cy) / ry; r = math.hypot(u, v); a = math.atan2(v, u)
    G = GLOW[isl.glow]
    # 가운데 낮은 둥근 단(높이 4px): 위로 4px 옮긴 원 안 = 단 윗면, 원래 자리 원 안 = 단 앞면
    rs = .25
    u2 = u; v2 = (y + .5 + 4 - cy) / ry
    r_top = math.hypot(u2, v2)
    if r_top < rs:
        if r_top > rs - .035: return TRV[6] if v2 < 0 else TRV[4]
        rr = r_top / rs
        c = TRV[5] if (u2 + v2) < .05 else TRV[4]
        if .48 < rr < .58: c = G[3] if _hash(int(math.degrees(math.atan2(v2, u2)) // 15), 0, 3) > .3 else G[4]
        if rr < .14: c = G[5] if rr < .07 else G[4]
        return c
    if r < rs and v > 0 or (r < rs and r_top >= rs and v > -0.1):
        # 단 앞면(원통): 왼쪽 밝음
        k = 5 if u < -.08 else (4 if u < .1 else 3)
        if (y + .5 + 1 - cy) / ry * 0 + math.hypot(u, (y + .5 + 1 - cy) / ry) >= rs: k = 2
        return TRV[k]
    # 고리 판석
    bands = [(rs, .34, 10), (.34, .40, 0), (.40, .62, 16), (.62, .68, 0), (.68, 1.01, 24)]
    for bi, (r0, r1, n) in enumerate(bands):
        if r0 <= r < r1: break
    if n == 0:                                                  # 빛 상감 고리
        mid = (r0 + r1) / 2; d = abs(r - mid) / ((r1 - r0) / 2)
        seg = (math.degrees(a) + 360) % 360
        c = G[3] if d < .45 else G[2]
        if d > .85: c = ST[3]
        if bi == 1 and int(seg) % 45 < 4: c = G[5]               # 안쪽 고리 마디 빛 점 8
        if bi == 3 and int(seg + 22.5) % 90 < 3: c = G[6]        # 바깥 고리 네 갈래 빛 점(갈래 길 쪽)
        return c
    seg = int(((a + math.pi) / (2 * math.pi)) * n + (.5 if bi == 2 else 0)) % n
    # 이웃 화소가 다른 판이면 줄눈
    def pid(xx, yy):
        uu = (xx + .5 - cx) / rx; vv = (yy + .5 - cy) / ry; rr = math.hypot(uu, vv); aa = math.atan2(vv, uu)
        for bj, (q0, q1, m) in enumerate(bands):
            if q0 <= rr < q1: break
        if m == 0: return (bj, -1)
        return (bj, int(((aa + math.pi) / (2 * math.pi)) * m + (.5 if bj == 2 else 0)) % m)
    me = (bi, seg)
    if pid(x + 1, y) != me or pid(x, y + 1) != me: return ST[3]
    h = _hash(bi, seg, isl.seed + 7)
    c = mix(ST[4], ST[5], .25 + .45 * h)
    if pid(x - 1, y) != me or pid(x, y - 1) != me: c = mix(c, ST[6], .5)
    if _hash(x, y, isl.seed + 9) < .04: c = mix(c, ST[3], .5)
    elif _hash(x, y, isl.seed + 10) > .975: c = mix(c, ST[6], .5)
    return mix(c, (140, 146, 184), .05)


def _dais_face(isl, x, y, fy, body):
    """중앙 돌 단 앞면: 줄눈 없는 매끈한 대리석 띠(원통 명암) + 윗선 갓돌 빛 + 몰딩 한 줄 + 아래 받침 턱."""
    cx, cy, rx, ry = isl.center
    u = (x + .5 - cx) / rx
    k = 5 if u < -.55 else (6 if u < -.25 else (5 if u < .1 else (4 if u < .5 else (3 if u < .82 else 2))))
    if fy == 0: k = 6
    elif fy == 1: k = min(6, k + 1)
    elif fy == LIP - 1: k = max(2, k - 2)                         # 갓돌 밑 그늘
    elif fy == LIP + 4: k = max(1, k - 2)                         # 몰딩 홈
    elif fy == LIP + 5: k = min(6, k + 1)
    if fy >= LIP + body - 3: k = max(1, k - 1 - (fy - (LIP + body - 3)))   # 받침 턱 아래로 어둡게
    if _hash(x, fy, isl.seed + 3) < .035: k = max(1, k - 1)
    return TRV[k]


def _outline(im, kind):
    """허공과 닿는 가장자리 화소를 어둡게(버들항 pz.fin 과 같은 안쪽 윤곽)."""
    a = np.array(im); al = a[..., 3] > 0
    e = al & ~(np.roll(al, 1, 0) & np.roll(al, -1, 0) & np.roll(al, 1, 1) & np.roll(al, -1, 1))
    rgb = a[..., :3].astype(float)
    rgb[e] = rgb[e] * .62; rgb[e, 2] = np.minimum(255, rgb[e, 2] * 1.1)
    a[..., :3] = rgb.astype(np.uint8)
    return Image.fromarray(a, 'RGBA')


# ---------------------------------------------------------------- 칸 → 화소 마스크
def cells_mask(cells, Wc, Hc, seed=1, round_r=4, wob=1.6, inset=0):
    """칸 집합 → 화소 마스크. 볼록 모서리는 둥글게, 가장자리는 1~2px 들쭉날쭉(안쪽으로만 깎는다)."""
    m = np.zeros((Hc * T, Wc * T), bool)
    for (x, y) in cells: m[y * T:(y + 1) * T, x * T:(x + 1) * T] = True
    H, W = m.shape
    # 둥근 모서리: 거리 변환으로 볼록 모서리를 깎는다(오목 모서리는 그대로)
    d = ndi.distance_transform_edt(m)
    op = ndi.binary_opening(m, structure=np.ones((3, 3)), iterations=round_r) if round_r else m
    m2 = m & (op | (d > round_r))
    Y, X = np.mgrid[0:H, 0:W]
    j = (tnoise(W, H, 5, seed, per=False) * .65 + tnoise(W, H, 2, seed + 1, per=False) * .35)
    m3 = m2 & ~((d <= inset + wob * j + .2) & (d <= 3))
    return m3


def ellipse_mask(Wpx, Hpx, cx, cy, rx, ry, seed=1, wob=0.0):
    Y, X = np.mgrid[0:Hpx, 0:Wpx]
    d = np.sqrt(((X + .5 - cx) / rx) ** 2 + ((Y + .5 - cy) / ry) ** 2)
    if wob:
        n = tnoise(Wpx, Hpx, 4, seed, per=False)
        return d < 1 - wob * n / max(rx, ry)
    return d < 1


def walk_cells(mask, Wc, Hc, thr=.72):
    out = set()
    for y in range(Hc):
        for x in range(Wc):
            if mask[y * T:(y + 1) * T, x * T:(x + 1) * T].mean() >= thr: out.add((x, y))
    return out
