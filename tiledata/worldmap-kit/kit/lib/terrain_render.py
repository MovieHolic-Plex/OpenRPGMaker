"""월드맵 설계 2단계 렌더러: 바닥 → 물체 → 물 → (도로·다리·장식·아이콘은 뒤 층)."""
import numpy as np
from collections import Counter
from terrain_lib import *  # noqa
import terrain_lib as T
from terrain_lib import _tex_at, _fam, _recolor_land, _recolor_river


HOLE_GREEN = np.array(hx('689e4e'), np.uint8)
GPRI = {GRASS: 0, SAND: 1, DIRT: 2, MARSH: 3, SNOW: 4}


class Map:
    def __init__(self, t):
        self.t = np.asarray(t)
        self.H, self.W = self.t.shape

    def k(self, x, y):
        if 0 <= x < self.W and 0 <= y < self.H:
            return int(self.t[y, x])
        return None

    def ground(self, x, y):
        k = self.k(x, y)
        return None if k is None else (None if k in WATER else ground_of(k))

    def conn_ground(self, x, y, G):
        """바닥 G 의 이어짐: 같은 바닥·물·지도 밖. 우선순위가 더 높은 이웃은 자기 쪽에서 가장자리를 그리므로
        낮은 쪽 칸은 이어진 것으로 본다(두 칸이 서로의 가장자리를 겹쳐 그리면 띠가 생긴다)."""
        k = self.k(x, y)
        if k is None or k in WATER:
            return True
        g = ground_of(k)
        return g == G or GPRI[g] > GPRI[G]

    def conn_fam(self, x, y, fam):
        k = self.k(x, y)
        if k is None:
            return False
        return _fam(k) == fam


def _q_iter():
    for qy in (0, 1):
        for qx in (0, 1):
            yield qx, qy, (-1 if qx == 0 else 1), (-1 if qy == 0 else 1)


def render_ground(M, ovr=None):
    img = np.zeros((M.H * 16, M.W * 16, 3), np.uint8)
    for y in range(M.H):
        for x in range(M.W):
            k = M.k(x, y)
            if k in WATER:
                continue
            G = ground_of(k)
            for qx, qy, sx, sy in _q_iter():
                px0, py0 = x * 16 + qx * 8, y * 16 + qy * 8
                sl = (slice(py0, py0 + 8), slice(px0, px0 + 8))
                if G == GRASS:
                    img[sl] = _tex_at(GRASS, px0, py0)
                    continue
                cn = lambda xx, yy: M.conn_ground(xx, yy, G)
                v, h, d = cn(x, y + sy), cn(x + sx, y), cn(x + sx, y + sy)
                iso = not any(M.k(x + a, y + b) is not None and (ground_of(M.k(x + a, y + b)) == G)
                              for a in (-1, 0, 1) for b in (-1, 0, 1) if (a, b) != (0, 0))
                role = 'iso' if iso else pick_role(v, h, d, qx, qy)
                if G == MARSH:
                    cell = S.kcell(MARSH, role)
                    img[sl] = cell[qy * 8:(qy + 1) * 8, qx * 8:(qx + 1) * 8]
                    continue
                # 부모 바닥: 이어지지 않은 이웃 중 최빈
                cands = []
                for (a, b, ok) in ((x, y + sy, v), (x + sx, y, h), (x + sx, y + sy, d)):
                    if not ok:
                        gg = M.ground(a, b)
                        if gg is not None and gg != G:
                            cands.append(gg)
                parent = Counter(cands).most_common(1)[0][0] if cands else GRASS
                q = _tex_at(parent, px0, py0).copy()
                if role == 'body':
                    q = _tex_at(G, px0, py0).copy()
                else:
                    kits = melt_kits(G)
                    vi = hh(x * 2 + qx, y * 2 + qy, 5 + G) % NV
                    rgb, a = kits[vi][role]
                    aq = a[qy * 8:(qy + 1) * 8, qx * 8:(qx + 1) * 8]
                    rq = rgb[qy * 8:(qy + 1) * 8, qx * 8:(qx + 1) * 8]
                    if parent != GRASS:   # 풀 비침(holes)은 풀 위에서만 뜻이 있다
                        aq = aq & ~np.all(rq == HOLE_GREEN, axis=2)
                    q[aq] = rq[aq]
                img[sl] = q
    return img


def render_objects(M, img):
    for y in range(M.H):
        for x in range(M.W):
            k = M.k(x, y)
            if k not in OBJ:
                continue
            fam = _fam(k)
            iso = not any(M.conn_fam(x + a, y + b, fam) for a in (-1, 0, 1) for b in (-1, 0, 1) if (a, b) != (0, 0))
            for qx, qy, sx, sy in _q_iter():
                role = 'iso' if iso else pick_role(M.conn_fam(x, y + sy, fam), M.conn_fam(x + sx, y, fam),
                                                   M.conn_fam(x + sx, y + sy, fam), qx, qy)
                rgb, a = obj_cell(k, role)
                aq = a[qy * 8:(qy + 1) * 8, qx * 8:(qx + 1) * 8]
                rq = rgb[qy * 8:(qy + 1) * 8, qx * 8:(qx + 1) * 8]
                px0, py0 = x * 16 + qx * 8, y * 16 + qy * 8
                dst = img[py0:py0 + 8, px0:px0 + 8]
                dst[aq] = rq[aq]
    return img


def _water_g(M, x, y, sx, sy):
    for a, b in ((x, y + sy), (x + sx, y), (x + sx, y + sy)):
        g = M.ground(a, b)
        if g is not None:
            return g
    # 그 사분면에서 안 보이는 경우 8이웃 아무 땅
    for a in (-1, 0, 1):
        for b in (-1, 0, 1):
            g = M.ground(x + a, y + b)
            if g is not None:
                return g
    return GRASS


def water_tile(M, x, y, as_river, frame=0):
    tile = np.zeros((16, 16, 3), np.uint8)

    def s2(xx, yy):
        k = M.k(xx, yy)
        return True if k is None else k in WATER
    snow_near = any(M.ground(x + a, y + b) == SNOW for a in (-1, 0, 1) for b in (-1, 0, 1))
    for qx, qy, sx, sy in _q_iter():
        v, h, d = s2(x, y + sy), s2(x + sx, y), s2(x + sx, y + sy)
        if not v and not h:
            row = 0
        elif not v:
            row = 2
        elif not h:
            row = 1
        elif not d:
            row = 3
        else:
            row = 4
        g = _water_g(M, x, y, sx, sy) if row < 4 else GRASS
        col = frame   # 3단계: 눈 해안 전용 물 세트(col 3~5, 흰 거품 줄)는 쓰지 않는다. 풀 해안(col 0)과 같은 물가 문법 + 땅 쪽 눈 재칠
        src = S.cell(col, row)[qy * 8:(qy + 1) * 8, qx * 8:(qx + 1) * 8]
        px0, py0 = x * 16 + qx * 8, y * 16 + qy * 8
        if row < 4:
            src = _recolor_land(src, g, px0, py0)
        if as_river:
            src = _recolor_river(src)
        tile[qy * 8:(qy + 1) * 8, qx * 8:(qx + 1) * 8] = src
    return tile


def render_water(M, img, frame=0):
    for y in range(M.H):
        for x in range(M.W):
            k = M.k(x, y)
            if k not in WATER:
                continue
            tile = water_tile(M, x, y, k == RIVER, frame)
            if k == RIVER:
                # 어귀: 바다와 4방향으로 맞닿으면 디더로 섞는다
                fr = np.zeros((16, 16))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    if M.k(x + dx, y + dy) == SEA:
                        u = np.arange(16) + .5
                        if dx:
                            prof = u / 16 if dx > 0 else 1 - u / 16
                            fr = np.maximum(fr, np.tile(prof[None, :], (16, 1)))
                        else:
                            prof = u / 16 if dy > 0 else 1 - u / 16
                            fr = np.maximum(fr, np.tile(prof[:, None], (1, 16)))
                if fr.max() > 0:
                    sea = water_tile(M, x, y, False, frame)
                    # 바이어 디더로 섞으면 어두운 바다 화소가 체크무늬 네모로 떠 보였다(QA 2026-10-03, 군도 해협 어귀) —
                    # 칸 안에서 굽이치는 한 줄 경계로 가른다. 위상은 칸 좌표로 정해 이웃 어귀끼리 같은 무늬가 되지 않게.
                    yy, xx = np.mgrid[0:16, 0:16]
                    wav = .5 + .13 * np.sin((yy + y * 16) / 2.6 + x * 1.7) + .09 * np.sin((xx + x * 16) / 2.1 + y * 2.3)
                    use = fr > wav
                    tile[use] = sea[use]
            img[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16] = tile
    return img


def render_base(t, frame=0):
    M = Map(t)
    img = render_ground(M)
    render_objects(M, img)
    render_water(M, img, frame)
    return M, img
