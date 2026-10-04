#!/usr/bin/env python3
"""여정 자동 맞춤 — 생성된 땅(kit_gen)에 5막 여정(장소·장벽 4개)을 놓는다.

막(幕)과 땅의 짝:
  1막(걷기)   시작 대륙의 A 쪽      — 시작 마을·수도·항구·관문 요새·통행증 동굴·사구 바다 입구 마을 …
  2막(통행증) 시작 대륙의 B 쪽      — A 와 산벽(두께 3칸)으로 갈리고, 틈은 관문 요새 하나
  3막(배)     다른 땅 덩이들        — 시작 대륙과 바다 4칸 이상 떨어진 땅, 항구가 맞닿은 바다로 이어진 것
  4막(사막선) A 쪽 먼 끝의 사구 바다 — 걸어서 못 건너는 사구, 그 속 섬에 4막 장소
  5막(비공정) 바다 위 천공섬
첫 화면(시작 지점 기준 20x15칸)에 관문·항구·2막의 먼 곳(거대한 탑)이 보여야 한다 — 그래서 관문·시작·항구·탑을 한 묶음으로 먼저 고른다.
같은 seed·salt 면 같은 배치. 실패하면 FitError(무엇이 모자란지 문장).
"""
import heapq
import math

import numpy as np
import scipy.ndimage as ndi

import make_map_v4 as M4
from kit_gen import GenError, HOME_GAP, comps, fbm, line_cells

W, H = M4.W, M4.H
WALL_T = 3.0            # 산벽 두께(칸)
B_FRAC = .27            # 시작 대륙 중 2막(관문 너머) 몫
FAMILY = {
    'SNOW': (M4.SNOW, M4.TUNDRA, M4.GLACIER), 'SAND': (M4.SAND, M4.DUNE, M4.SAVANNA), 'JUNGLE': (M4.JUNGLE,),
    'ASH': (M4.ASH, M4.BASALT), 'SAVANNA': (M4.SAVANNA, M4.GRASS), 'BADLANDS': (M4.BADLANDS, M4.DIRT), 'DIRT': (M4.DIRT, M4.BADLANDS, M4.GRASS),
    'GRASS': (M4.GRASS, M4.FARM, M4.CROP, M4.SAVANNA), 'MARSH': (M4.MARSH, M4.SWAMP), 'SWAMP': (M4.SWAMP, M4.MARSH),
}


class FitError(GenError):
    pass


# ───────────────────────────── 도구 ─────────────────────────────
def geodesic(mask, sources):
    """마스크 안 8방향 최단 거리(대각 √2)."""
    dist = np.full((H, W), np.inf)
    pq = []
    for x, y in sources:
        if 0 <= x < W and 0 <= y < H and mask[y, x]:
            dist[y, x] = 0.0
            pq.append((0.0, x, y))
    heapq.heapify(pq)
    R2 = math.sqrt(2)
    while pq:
        d, x, y = heapq.heappop(pq)
        if d > dist[y, x]:
            continue
        for dx, dy, c in ((1, 0, 1), (-1, 0, 1), (0, 1, 1), (0, -1, 1), (1, 1, R2), (1, -1, R2), (-1, 1, R2), (-1, -1, R2)):
            a, b = x + dx, y + dy
            if 0 <= a < W and 0 <= b < H and mask[b, a] and d + c < dist[b, a]:
                dist[b, a] = d + c
                heapq.heappush(pq, (d + c, a, b))
    return dist


def _sat(mask):
    return np.pad(mask.astype(np.int32), ((1, 0), (1, 0))).cumsum(0).cumsum(1)


def rect_sum(S, w, h, ox=0, oy=0):
    """윗왼쪽이 (x+ox, y+oy) 인 w×h 상자의 합을 (x,y) 자리에. 지도 밖은 0 으로 센다."""
    out = np.zeros((H, W), np.int32)
    for y in range(H):
        y0, y1 = min(max(y + oy, 0), H), min(max(y + oy + h, 0), H)
        if y1 <= y0:
            continue
        xs = np.arange(W)
        x0 = np.clip(xs + ox, 0, W)
        x1 = np.clip(xs + ox + w, 0, W)
        out[y] = S[y1, x1] - S[y0, x1] - S[y1, x0] + S[y0, x0]
    return out


def fits(mask, w, h):
    """윗왼쪽 (x,y) 에 w×h 가 마스크 안에 통째로 들어가는가."""
    ok = rect_sum(_sat(mask), w, h) == w * h
    ok[H - h + 1:, :] = False
    ok[:, W - w + 1:] = False
    return ok


def rect_mask(x, y, w, h, pad=0):
    m = np.zeros((H, W), bool)
    m[max(y - pad, 0):y + h + pad, max(x - pad, 0):x + w + pad] = True
    return m


def ring4(x, y, w, h):
    """상자에 4방향으로 맞닿은 바깥 칸."""
    out = []
    for i in range(w):
        out += [(x + i, y - 1), (x + i, y + h)]
    for j in range(h):
        out += [(x - 1, y + j), (x + w, y + j)]
    return [(a, b) for a, b in out if 0 <= a < W and 0 <= b < H]


def intersects(r, box):
    x, y, w, h = r
    x0, y0, x1, y1 = box
    return x < x1 + 1 and x + w > x0 and y < y1 + 1 and y + h > y0


# ───────────────────────────── 맞춤 ─────────────────────────────
class Fit:
    def __init__(self, land, ground, journey, roles, pins, overrides, salt, seed):
        self.land = land.copy()
        self.G = ground
        self.j = journey
        self.roles = roles
        self.pins = dict(pins)
        self.ov = overrides
        self.salt = int(salt)
        self.rng = np.random.default_rng(int(seed) * 7907 + int(salt) * 31 + 5)
        self.jit = fbm(2.1, 5000 + int(seed) * 7 + int(salt) * 101, 1)
        self.P = {p['id']: p for p in journey['places']}
        self.size = {p['id']: tuple(roles[p['role']]['cells']) for p in journey['places']}
        self.rect = {}
        self.occ = np.zeros((H, W), bool)          # 놓은 상자 + 둘레 2칸(길 자리)
        self.vocc = np.zeros((H, W), bool)         # 화산 둘레 4칸(화산 고리가 다른 장소를 가두지 않게)
        bar = {b['means']: b for b in journey['barriers']}
        self.gate = bar['pass']['gate']
        self.harbour = bar['ship']['gate']
        self.dune_gate = bar['skiff']['gate'] if 'skiff' in bar else None
        self.start = journey['start']['place']
        self.sky = [p['id'] for p in journey['places'] if p['role'] == 'floating'][0]
        self.far = list(journey.get('checks', {}).get('opening_far', []))
        self.acts = {}
        for p in journey['places']:
            self.acts.setdefault(p['act'], []).append(p['id'])
        self.ship_entry = set(journey.get('entries', {}).get('ship', []))
        aff = {}
        for r in journey.get('roads', []):
            a, b = r['from'], r['to']
            if a in self.P and b in self.P:
                aff.setdefault(a, set()).add(b)
                aff.setdefault(b, set()).add(a)
        self.aff = aff
        self.notes = []
        self.strict_pole = False
        av = overrides.get('avoid')
        self.avoid = av.copy() if av is not None else np.zeros((H, W), bool)   # 지리 구조의 척추·강: 장소를 비켜 놓는다(지나가는 길은 괜찮다)

    # ── 땅 정리 ──
    def prepare(self):
        lab, n = comps(self.land)
        if n == 0:
            raise FitError('땅이 하나도 없다 — continents 의 land 를 올려라')
        sz = ndi.sum(self.land, lab, range(1, n + 1))
        self.home = lab == (int(np.argmax(sz)) + 1)
        hp = self.ov.get('home_pole')                  # 실제 지리: 사용자가 말한 땅(일본이면 혼슈)을 시작 대륙으로 — 가장 큰 덩이가 아니어도
        if hp is not None:
            hx, hy = int(hp[0]), int(hp[1])
            ys, xs = np.nonzero(self.land)
            i = int(np.argmin((xs - hx) ** 2 + (ys - hy) ** 2))
            k = int(lab[ys[i], xs[i]])
            if sz[k - 1] >= 120:
                self.home = lab == k
            else:
                self.notes.append('시작 땅으로 고른 곳이 너무 작아(%d칸) 가장 큰 땅에서 시작한다' % int(sz[k - 1]))
        d = ndi.distance_transform_edt(~self.home)
        gap = float(self.ov.get('home_gap', HOME_GAP))   # 실제 지리는 좁게 — 4.6칸이면 0.7°/칸 유럽에서 잉글랜드가 거의 다 바다가 됐다
        near = self.land & ~self.home & (d <= gap)
        if near.any():
            self.land &= ~near
            self.notes.append('시작 대륙에 바다 %.1f칸보다 가까운 땅 %d칸을 바다로 깎았다(배 장벽)' % (gap, int(near.sum())))
        lab, n = comps(self.land)
        for i in range(1, n + 1):
            m = lab == i
            if m.sum() < 10 and not (m & self.home).any():
                self.land &= ~m
        self.lab, self.n = comps(self.land)
        self.home_id = int(self.lab[self.home][0]) if self.home.any() else 1
        # 배가 다니는 바다: 시작 대륙과 맞닿고, 다른 땅과 가장 많이 맞닿은 바다 덩이
        slab, sn = comps(~self.land)
        best, bv = 1, -1
        dil_home = ndi.binary_dilation(self.home)
        other = self.land & ~self.home
        dil_other = ndi.binary_dilation(other)
        for i in range(1, sn + 1):
            m = slab == i
            if not (m & dil_home).any():
                continue
            v = int((m & dil_other).sum())
            if v > bv:
                best, bv = i, v
        self.ocean = slab == best
        reach_land = ndi.binary_dilation(self.ocean) & other
        ids = set(np.unique(self.lab[reach_land])) - {0}
        self.ship_lands = sorted(ids, key=lambda i: -int((self.lab == i).sum()))
        if self.home.sum() < 600:
            raise FitError('시작 대륙이 %d칸뿐이다 — 1·2막 장소·산벽·사구 바다를 놓으려면 600칸 이상이어야 한다. '
                           'continents 의 land 를 올리거나 count 를 줄여라(실제 지리 real 이면 box 를 좁혀 그 땅을 크게 그려라 — 또는 home 을 더 큰 땅으로)' % int(self.home.sum()))
        if not self.ship_lands:
            raise FitError('배로 갈 땅(시작 대륙과 바다로 떨어진 다른 땅)이 없다 — continents count 를 2 이상으로 하거나 island 를 더하라'
                           '(실제 지리 real 이면 바다 건너 땅이 들어오게 box 를 넓히거나, 지협·운하 자리를 sea{poly} 로 끊어라 — 예: 수에즈)')
        self.dco = ndi.distance_transform_edt(self.land)

    # ── 산벽 ──
    def wall_options(self):
        if self.ov.get('wall'):
            return [self._wall_from_line(self.ov['wall'])]
        ys, xs = np.nonzero(self.home)
        poles = []
        for k in range(12):
            th = 2 * math.pi * k / 12 + self.salt * .37
            v = xs * math.cos(th) + ys * math.sin(th)
            i = int(np.argmax(v))
            p = (int(xs[i]), int(ys[i]))
            if all(abs(p[0] - q[0]) + abs(p[1] - q[1]) > 6 for q in poles):
                poles.append(p)
        order = list(self.rng.permutation(len(poles)))
        out = []
        for i in order:
            o = self._wall_from_pole(poles[i])
            if o:
                out.append(o)
        hp = self.ov.get('wall_pole')
        if hp is not None:                                  # 지리 구조가 바라는 극(예: 북쪽 장성 너머 = 2막)을 먼저
            ys, xs = np.nonzero(self.home)
            i = int(np.argmin((xs - hp[0]) ** 2 + (ys - hp[1]) ** 2))
            o = self._wall_from_pole((int(xs[i]), int(ys[i])))
            if o:
                o['score'] += 60
                out.append(o)
        out.sort(key=lambda o: -o['score'])
        return out

    def _split(self, B):
        home = self.home
        B = self._largest(B)
        band = home & ~B & (ndi.distance_transform_edt(~B) <= WALL_T)
        A = self._largest(home & ~B & ~band)
        return A, B, band

    @staticmethod
    def _largest(m):
        lab, n = comps(m)
        if n == 0:
            return m.copy()
        sz = ndi.sum(m, lab, range(1, n + 1))
        return lab == (int(np.argmax(sz)) + 1)

    def _wall_from_pole(self, pole):
        g = geodesic(self.home, [pole])
        nz = (fbm(7, 4100 + self.salt * 13) - .5) * 3.2
        f = np.where(self.home, g + nz, np.inf)
        tot = int(self.home.sum())
        vals = np.sort(f[self.home])
        t = vals[int(B_FRAC * tot)]
        A, B, band = self._split(self.home & (f < t))
        if B.sum() < 110 or A.sum() < .45 * tot:
            return None
        lost = int((self.home & ~A & ~B & ~band).sum())
        return dict(A=A, B=B, band=band, pole=pole, score=-lost + float(self.rng.uniform(0, 30)))

    def _wall_from_line(self, line):
        pts = M4.dense([tuple(p) for p in line], .4)
        band = np.zeros((H, W), bool)
        for x, y in pts:
            M4.disc(band, x, y, 1.6)
        band &= self.home
        lab, n = comps(self.home & ~band)
        if n < 2:
            raise FitError('wall 선이 시작 대륙을 둘로 가르지 못한다 — 해안에서 해안까지 그어라')
        sz = sorted([(int((lab == i).sum()), i) for i in range(1, n + 1)], reverse=True)
        A, B = lab == sz[0][1], lab == sz[1][1]
        ap = self.ov.get('a_pole')
        if ap is not None:                                  # 지리 구조: 1막 쪽(반도)을 정해 준다 — 큰 쪽(만주)이 1막이 되지 않게
            ia = int(lab[int(ap[1]), int(ap[0])])
            if ia and ia != sz[0][1]:
                B = lab == sz[0][1]
                A = lab == ia
        if self.start in self.pins:
            sx, sy = self.pins[self.start]
            if B[sy, sx]:
                A, B = B, A
        return dict(A=A, B=B, band=band, pole=None, score=0)

    def gate_options(self, wo):
        gw, gh = self.size[self.gate]
        A, B, band = wo['A'], wo['B'], wo['band']
        okm = fits(self.home, gw, gh)
        cand = []
        if self.gate in self.pins:
            ys, xs = [self.pins[self.gate][1]], [self.pins[self.gate][0]]
        else:
            touch = rect_sum(_sat(band), gw, gh) > 0
            ys, xs = np.nonzero(okm & touch)
        for x, y in zip(xs, ys):
            x, y = int(x), int(y)
            nb = ring4(x, y, gw, gh)
            if sum(1 for a, b in nb if A[b, a]) < 2 or sum(1 for a, b in nb if B[b, a]) < 2:   # 관문 양쪽에 문간이 두 칸 이상(한 칸이면 길이 못 붙었다)
                continue
            if x < 2 or y < 2 or x + gw > W - 2 or y + gh > H - 2:
                continue
            r = rect_mask(x, y, gw, gh)
            if (r & self.avoid).any():
                continue
            wall = band & ~r
            lab, _ = comps(self.home & ~wall & ~r)
            ia = np.unique(lab[A])
            ib = np.unique(lab[B])
            if set(ia) & set(ib) - {0}:
                continue
            c = float(self.dco[y + gh // 2, x + gw // 2])
            v = min(c, 6) + float(self.rng.uniform(0, 1.5))
            dp = self.ov.get('dune_pole')
            if dp is not None:                              # 첫 화면 묶음이 사구 바다 자리(지리 구조의 사막)를 차지하지 않게
                v += min(math.hypot(x - dp[0], y - dp[1]), 36) * .6
            cand.append((v, x, y))
        cand.sort(reverse=True)
        return cand[:24]

    # ── 첫 화면 묶음: 관문·시작·항구·먼 곳 ──
    def cluster(self, wo):
        A, B, band = wo['A'], wo['B'], wo['band']
        sw, sh = self.size[self.start]
        hw, hh = self.size[self.harbour]
        far = [f for f in self.far if f in self.P and self.P[f]['act'] == 1] or []
        A_in = A & ~ndi.binary_dilation(band, iterations=1)
        startfit = fits(A_in, sw, sh)
        harbfit = fits(A, hw, hh)
        for gscore, gx, gy in self.gate_options(wo):
            gw, gh = self.size[self.gate]
            occ_g = rect_mask(gx, gy, gw, gh, 2) | self.avoid
            gc = (gx + gw / 2, gy + gh / 2)
            if self.start in self.pins:
                sc = [tuple(self.pins[self.start])]
            else:
                ys, xs = np.nonzero(startfit)
                sc = []
                for x, y in zip(xs, ys):
                    if rect_mask(int(x), int(y), sw, sh)[occ_g].any():
                        continue
                    d = math.hypot(x + sw / 2 - gc[0], y + sh / 2 - gc[1])
                    if 4.5 <= d <= 12.5:
                        sc.append((int(x), int(y)))
                self.rng.shuffle(sc)
                sc.sort(key=lambda p: abs(math.hypot(p[0] + sw / 2 - gc[0], p[1] + sh / 2 - gc[1]) - 7.5))
            for sx, sy in sc[:40]:
                S = (sx + sw // 2, sy + sh // 2)
                box = (S[0] - 7, S[1] - 7, S[0] + 12, S[1] + 7)
                if not intersects((gx, gy, gw, gh), box):
                    continue
                occ = occ_g | rect_mask(sx, sy, sw, sh, 2)
                hp = self._harbour_spot(harbfit, occ, box)
                if hp is None:
                    continue
                occ2 = occ | rect_mask(hp[0], hp[1], hw, hh, 2)
                fs = {}
                ok = True
                for fid in far:
                    fw, fh = self.size[fid]
                    Bin = B & ~ndi.binary_dilation(band, iterations=1)
                    fm = fits(Bin, fw, fh) & ~(rect_sum(_sat(occ2), fw, fh) > 0)
                    ys, xs = np.nonzero(fm)
                    c = [(int(x), int(y)) for x, y in zip(xs, ys) if intersects((int(x), int(y), fw, fh), box)]
                    if fid in self.pins:
                        c = [tuple(self.pins[fid])] if tuple(self.pins[fid]) in c else []
                    if not c:
                        ok = False
                        break
                    c.sort(key=lambda p: math.hypot(p[0] - gc[0], p[1] - gc[1]))
                    fs[fid] = c[min(len(c) - 1, 2)]
                    occ2 |= rect_mask(fs[fid][0], fs[fid][1], fw, fh, 2)
                if not ok:
                    continue
                self.put(self.gate, gx, gy)
                self.put(self.start, sx, sy)
                self.put(self.harbour, hp[0], hp[1])
                for fid, (x, y) in fs.items():
                    self.put(fid, x, y)
                return True
        return False

    def _harbour_spot(self, harbfit, occ, box):
        hw, hh = self.size[self.harbour]
        if self.harbour in self.pins:
            x, y = self.pins[self.harbour]
            return (x, y) if harbfit[y, x] else None
        ys, xs = np.nonzero(harbfit & ~(rect_sum(_sat(occ), hw, hh) > 0))
        best, bv = None, -1
        for x, y in zip(xs, ys):
            x, y = int(x), int(y)
            if not intersects((x, y, hw, hh), box):
                continue
            nb = ring4(x, y, hw, hh)
            sea = [(a, b) for a, b in nb if self.ocean[b, a]]
            if len(sea) < 3:
                continue
            south = sum(1 for a, b in sea if b == y + hh)
            v = len(sea) + south * 1.5 + float(self.rng.uniform(0, 1))
            if v > bv:
                best, bv = (x, y), v
        return best

    def put(self, pid, x, y):
        w, h = self.size[pid]
        self.rect[pid] = (int(x), int(y), w, h)
        self.occ |= rect_mask(int(x), int(y), w, h, 2)

    # ── 사구 바다 ──
    def dune(self, wo):
        A = wo['A']
        act3 = [p for p in self.acts.get(3, [])]
        if not act3:
            self.D = np.zeros((H, W), bool)
            return True
        if self.ov.get('dune_sea'):
            Ds = [M4.polymask([tuple(p) for p in self.ov['dune_sea']], 1.2, 4400, minsize=4) & A & ~self.occ]
        elif self.ov.get('dune_pole') is not None:          # 지리 구조가 바라는 곳(북서 사막 …): 그 극에서 가까운 A 땅부터
            ys, xs = np.nonzero(A)
            px, py = self.ov['dune_pole']
            i = int(np.argmin((xs - px) ** 2 + (ys - py) ** 2))
            Ad = A
            if self.ov.get('dune_coast'):                   # 해안을 따라 붙는 띠(갯벌) — 반도를 가로질러 퍼지지 않게
                Ad = A & (self.dco <= float(self.ov['dune_coast']))
                ys, xs = np.nonzero(Ad)
                i = int(np.argmin((xs - px) ** 2 + (ys - py) ** 2))
            gp = geodesic(Ad, [(int(xs[i]), int(ys[i]))])
            tot = int(self.home.sum()) if not self.ov.get('wall') else int(A.sum() * .75)   # 손으로 그은 산벽이면 2막 땅이 아주 클 수 있다 — 1막 땅 기준(사구가 반도 절반을 덮었다)
            Ds = []
            fr = (.15, .19, .12, .24) if not self.ov.get('dune_small') else (.07, .09, .11, .14, .19)   # 실제 지리: 작은 것부터(혼슈 서쪽 절반이 통째로 모래가 됐다)
            for frac in fr:
                vals = np.sort(gp[A & np.isfinite(gp)])
                if len(vals) < 50:
                    break
                D = self._largest(A & (gp <= vals[min(int(frac * tot), len(vals) - 1)]))
                if (D & self.occ & ~self.avoid).any():
                    D = D & ~ndi.binary_dilation(self.occ & ~self.avoid, iterations=3)
                    D = self._largest(D)
                if D.sum() < 60:
                    continue
                rest = A & ~ndi.binary_dilation(D, iterations=3)       # 사구가 1막 땅을 둘로 가르면 길이 못 이어진다(적대 시험: 무협 대륙)
                lab, n = comps(rest)
                if n > 1:                                       # 놓인 장소(시작·관문·항구)가 모두 한 덩이에, 그 덩이가 1막 땅 대부분
                    sz = ndi.sum(rest, lab, range(1, n + 1))
                    big = lab == (int(np.argmax(sz)) + 1)
                    placed = np.zeros((H, W), bool)
                    for r in self.rect.values():
                        placed |= rect_mask(*r)
                    if sz.max() < .85 * rest.sum() or (placed & A & ~big).any():
                        continue
                Ds.append(D)
            sx, sy, sw, sh = self.rect[self.start]
            gs = geodesic(A, [(sx + sw // 2, sy + sh // 2)])
            for frac in (.15, .19) if not self.strict_pole else ():   # 극 쪽이 안 되면 늘 하던 먼 끝(엄격 단계에서는 안 쓴다)
                vals = np.sort(gs[A & np.isfinite(gs)])
                if len(vals) < 50:
                    break
                D = self._largest(A & (gs >= vals[max(0, len(vals) - int(frac * tot))]))
                if not (D & self.occ & ~self.avoid).any():
                    Ds.append(D)
        else:
            sx, sy, sw, sh = self.rect[self.start]
            gs = geodesic(A, [(sx + sw // 2, sy + sh // 2)])
            tot = int(self.home.sum())
            Ds = []
            for frac in (.15, .19, .24, .12, .29):
                vals = np.sort(gs[A & np.isfinite(gs)])
                if len(vals) < 50:
                    break
                k = max(0, len(vals) - int(frac * tot))
                D = self._largest(A & (gs >= vals[k]))
                if (D & self.occ & ~self.avoid).any():
                    continue
                Ds.append(D)
        for k, D in enumerate(Ds):
            if self._dune_places(A, D, act3):
                self.D = D
                return True
        return False

    def _dune_places(self, A, D, act3):
        saved = (dict(self.rect), self.occ.copy())
        inner = ndi.binary_erosion(D, iterations=2, border_value=0)
        for pid in sorted(act3, key=lambda p: -self.size[p][0] * self.size[p][1]):
            w, h = self.size[pid]
            fm = fits(inner, w, h) & ~(rect_sum(_sat(self.occ), w, h) > 0)
            if not self._choose(pid, fm):
                self.rect, self.occ = saved
                return False
        if self.dune_gate:
            w, h = self.size[self.dune_gate]
            Ad = A & ~D
            fm = fits(Ad, w, h) & ~(rect_sum(_sat(self.occ), w, h) > 0)
            fm &= rect_sum(_sat(D), w + 2, h + 2, -1, -1) > 0
            if not self._choose(self.dune_gate, fm):
                self.rect, self.occ = saved
                return False
        return True

    # ── 점수로 고르기 ──
    def _choose(self, pid, fm, region_lab=None, prefer_empty=False):
        if pid in self.pins:
            x, y = self.pins[pid]
            if not (0 <= x < W and 0 <= y < H) or not fm[y, x]:
                raise FitError('move_place %s (%d,%d): 그 자리는 %s 이 놓일 수 없다 — %s' % (pid, x, y, pid, self._where(pid)))
            self.put(pid, x, y)
            return True
        if not fm.any():
            return False
        w, h = self.size[pid]
        p = self.P[pid]
        ys, xs = np.mgrid[0:H, 0:W]
        cx, cy = xs + w / 2, ys + h / 2
        sc = np.zeros((H, W))
        placed = np.zeros((H, W), bool)
        for r in self.rect.values():
            placed |= rect_mask(*r)
        if placed.any():
            d = ndi.distance_transform_edt(~placed)
            sc += np.minimum(d[np.clip(cy.astype(int), 0, H - 1), np.clip(cx.astype(int), 0, W - 1)], 11) * .45
        fam = FAMILY.get((p.get('ground') or '').upper())
        if fam:
            gm = np.isin(self.G, fam)
            sc += rect_sum(_sat(gm), w + 2, h + 2, -1, -1) / float((w + 2) * (h + 2)) * 5
            if fam[0] == M4.SNOW:
                sc += (1 - cy / H) * 3
            if fam[0] in (M4.SAND, M4.JUNGLE):
                sc += (cy / H) * 2
        sc += rect_sum(_sat(self.land), w + 2, h + 2, -1, -1) / float((w + 2) * (h + 2)) * 1.5
        if pid in self.ship_entry:
            sc += (rect_sum(_sat(self.ocean), w + 2, h + 2, -1, -1) > 0) * 3.0
        for q in sorted(self.aff.get(pid, ())):          # 정렬: 점수 합의 순서가 프로세스마다 같게
            if q in self.rect:
                qx, qy, qw, qh = self.rect[q]
                dq = np.hypot(cx - (qx + qw / 2), cy - (qy + qh / 2))
                same = self.lab[np.clip(cy.astype(int), 0, H - 1), np.clip(cx.astype(int), 0, W - 1)] == self.lab[qy, qx]
                sc += ((dq >= 4) & (dq <= 12) & same) * 3.0 - (dq > 20) * 1.0
        if prefer_empty:
            used = {int(self.lab[r[1], r[0]]) for r in self.rect.values()}
            li = self.lab[np.clip(cy.astype(int), 0, H - 1), np.clip(cx.astype(int), 0, W - 1)]
            sc += (~np.isin(li, list(used))) * 4.0
        sc += self.jit * 1.2
        sc[~fm] = -1e9
        i = int(np.argmax(sc))
        y, x = divmod(i, W)
        self.put(pid, x, y)
        return True

    def _where(self, pid):
        a = self.P[pid]['act']
        return {0: '1막 장소는 시작 대륙의 관문 앞쪽(산벽 바깥) 땅', 1: '2막 장소는 산벽 너머 땅', 2: '3막 장소는 배로 가는 다른 땅 덩이',
                3: '4막 장소는 사구 바다 속(사구 2칸 이상 안쪽)', 4: '5막 장소(천공섬)는 땅에서 3칸 이상 떨어진 바다 위'}.get(a, '?')

    def place_rest(self, wo):
        A, B, band = wo['A'], wo['B'], wo['band']
        nb = ndi.binary_dilation(band, iterations=1)
        regions = {0: A & ~ndi.binary_dilation(self.D, iterations=3) & ~nb, 1: B & ~nb}     # 1막 장소는 사구 바다에서 3칸 떨어진다(바닥 무리가 사구를 덮지 않게)
        ship = np.isin(self.lab, self.ship_lands)
        regions[2] = ship
        order = []
        for a in (0, 1, 2):
            rest = [p for p in self.acts.get(a, []) if p not in self.rect and self.P[p]['role'] != 'floating']
            rest.sort(key=lambda p: (-(self.P[p]['role'] == 'volcano'), -self.size[p][0] * self.size[p][1]))
            order += [(a, p) for p in rest]
        for a, pid in order:
            w, h = self.size[pid]
            reg = regions[a]
            fm = fits(reg, w, h) & ~(rect_sum(_sat(self.occ | self.vocc), w, h) > 0)
            if self.P[pid]['role'] == 'volcano':           # 화산 고리(반지름 3.6칸)가 땅 위에 서도록 안쪽 땅을 먼저, 없으면 점점 해안 쪽으로
                vocc = np.zeros((H, W), bool)
                for r in self.rect.values():
                    vocc |= rect_mask(*r, 4)
                fm &= ~(rect_sum(_sat(vocc), w, h) > 0)
                dl = ndi.distance_transform_edt(self.land)
                for need in (4.6, 3.6, 2.6, 1.5):
                    fv = fm & fits(reg & (dl > need), w, h)
                    if fv.any():
                        fm = fv
                        break
            empty = a == 2 and not self.aff.get(pid)
            if not fm.any():                               # 빈 땅이 모자라면 장소 사이 길 자리를 2칸 → 1칸으로 좁혀 다시
                tight = self.avoid.copy()
                for r in self.rect.values():
                    tight |= rect_mask(*r, 1)
                fm = fits(reg, w, h) & ~(rect_sum(_sat(tight | self.vocc), w, h) > 0)
            if not self._choose(pid, fm, prefer_empty=empty):
                raise FitError('%s(%dx%d칸)을 놓을 자리가 없다 — %s에 빈 땅이 모자란다. land 를 올리거나 count 를 줄여라'
                               % (pid, w, h, self._where(pid)))
            if self.P[pid]['role'] == 'volcano':
                self.vocc |= rect_mask(*self.rect[pid], 4)
        # 천공섬: 열린 바다
        w, h = self.size[self.sky]
        dsea = ndi.distance_transform_edt(~self.land)
        open_sea = self.ocean & (dsea >= 3.0)
        fm = fits(open_sea, w, h)
        if not fm.any():
            fm = fits(self.ocean & (dsea >= 2.0), w, h)
        if self.sky not in self.pins and fm.any():
            # 시작 대륙과 다른 땅 사이 열린 바다, 지도 끝은 피한다(천공섬이 구석에 붙어 보였다)
            ys, xs = np.mgrid[0:H, 0:W]
            cx, cy = xs + w / 2, ys + h / 2
            dh = ndi.distance_transform_edt(~self.home)
            dl = dsea
            edge = np.minimum(np.minimum(cx, W - cx), np.minimum(cy, H - cy))
            ci, ri = np.clip(cy.astype(int), 0, H - 1), np.clip(cx.astype(int), 0, W - 1)
            # 발자국 전체에서 가장 가까운 땅까지 — 가운데 한 점만 보면 해협·내해 한복판에 떴다(적대 QA: 고리 내해·군도 해협)
            pad = np.pad(dl, ((0, h), (0, w)), constant_values=0)
            win = np.lib.stride_tricks.sliding_window_view(pad, (h, w))[:H, :W].min(axis=(2, 3))
            enclosed = ndi.uniform_filter(self.land.astype(np.float32), 29, mode='constant')[ci, ri]   # 둘레 땅 비율 — 내해·해협 벌점
            sc = np.minimum(win, 8) * 1.2 - np.abs(dh[ci, ri] - 10) * .25 - (edge < 8) * 4 - (edge < 5) * 20 - enclosed * 10 + self.jit * .8
            sc[~fm] = -1e9
            y, x = divmod(int(np.argmax(sc)), W)
            self.put(self.sky, x, y)
        elif not self._choose(self.sky, fm):
            raise FitError('천공섬(%dx%d칸)을 띄울 열린 바다가 없다 — 땅에서 2칸 이상 떨어진 바다가 필요하다. land 를 내려라' % (w, h))

    # ── 길 ──
    def roads(self, wo):
        groups = []
        a0 = [p for p in self.acts.get(0, []) if p in self.rect]
        a1 = [p for p in self.acts.get(1, []) if p in self.rect] + [self.gate]
        groups.append(a0)
        groups.append(a1)
        by_land = {}
        for p in self.acts.get(2, []):
            x, y, w, h = self.rect[p]
            by_land.setdefault(int(self.lab[y, x]), []).append(p)
        groups += list(by_land.values())
        edges = []
        for g in groups:
            edges += self._mst(g)
        return edges

    def _mst(self, names):
        if len(names) < 2:
            return []
        c = {n: (self.rect[n][0] + self.rect[n][2] / 2, self.rect[n][1] + self.rect[n][3] / 2) for n in names}
        done = {names[0]}
        out = []
        while len(done) < len(names):
            best = None
            for a in [n for n in names if n in done]:       # 문자열 집합을 그대로 돌면 해시 무작위화로 동률 순서가 프로세스마다 달라졌다(같은 사양 ≠ 같은 세계)
                for b in names:
                    if b in done:
                        continue
                    d = math.hypot(c[a][0] - c[b][0], c[a][1] - c[b][1])
                    if best is None or d < best[0]:
                        best = (d, a, b)
            done.add(best[2])
            out.append((best[1], best[2]))
        return out

    def run(self):
        self.prepare()
        tried = 0
        opts = self.wall_options()
        passes = (True, False) if self.ov.get('dune_pole') is not None else (False,)
        for strict in passes:                  # 지리 구조의 사막 자리: 먼저 모든 산벽 후보에서 그 자리를 찾고, 없을 때만 먼 끝
            self.strict_pole = strict
            for wo in opts:
                tried += 1
                self.rect, self.occ, self.vocc = {}, self.avoid.copy(), np.zeros((H, W), bool)
                if not self.cluster(wo):
                    continue
                if not self.dune(wo):
                    continue
                self.place_rest(wo)
                self.wo = wo
                return self._result()
        if tried == 0:
            raise FitError('시작 대륙을 산벽으로 가를 자리가 없다 — 시작 대륙이 너무 가늘거나 작다(land 를 올리거나 style 을 바꿔라)')
        raise FitError('첫 화면 묶음(시작 마을 둘레 20x15칸 안에 관문 요새·항구·관문 너머 탑)과 사구 바다를 함께 놓을 자리가 없다 — '
                       '시작 대륙이 바다에 너무 적게 닿거나 가늘다. land 를 올리거나 seed 를 바꿔라')

    def _result(self):
        wo = self.wo
        foot = np.zeros((H, W), bool)
        for r in self.rect.values():
            foot |= rect_mask(*r)
        gx, gy, gw, gh = self.rect[self.gate]
        wall = wo['band'] & ~rect_mask(gx, gy, gw, gh)
        edges = self.roads(wo)
        corr = np.zeros((H, W), bool)
        cen = {k: (r[0] + r[2] / 2 - .5, r[1] + r[3] / 2 - .5) for k, r in self.rect.items()}
        seg = []
        for a, b in edges:
            for x, y in line_cells(cen[a], cen[b]):
                if 0 <= x < W and 0 <= y < H:
                    corr[y, x] = True
            seg.append((cen[a], cen[b]))
        corr = ndi.binary_dilation(corr, iterations=1) & self.land
        protect = ndi.binary_dilation(rect_mask(gx, gy, gw, gh), iterations=3)
        hx, hy, hw, hh = self.rect[self.harbour]
        protect |= rect_mask(hx, hy, hw, hh, 3)
        places = []
        for pid, r in self.rect.items():
            p = self.P[pid]
            places.append(dict(id=pid, rect=r, kind=p['kind'], act=p['act'], role=p['role'], dune=p['act'] == 3))
        return dict(rect=self.rect, foot=foot, corridor=corr, edges=seg, edge_names=edges, dune=self.D, wall_mask=wall,
                    wall=[(int(x), int(y)) for y, x in zip(*np.nonzero(wall))], A=wo['A'], B=wo['B'], home=self.home,
                    ocean=self.ocean, land=self.land, places=places, protect=protect, notes=self.notes,
                    gate=self.gate, harbour=self.harbour, start=self.start, sky=self.sky, avoid=self.ov.get('avoid'))


def fit(land, ground, journey, roles, pins=None, overrides=None, salt=0, seed=1):
    return Fit(land, ground, journey, roles, pins or {}, overrides or {}, salt, seed).run()
