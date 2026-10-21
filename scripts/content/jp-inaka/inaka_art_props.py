#!/usr/bin/env python3
# noqa: SIZE_OK - jp-inaka rural vehicles/props (3/4 top-down) + seamless rural ground tiles
# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "pillow"]
# ///
# --- How to run ---
# python3 scripts/content/jp-inaka/bake_inaka.py
"""jp-inaka 소품·탈것 19종 + 시골 바닥 10종.

탈것은 jp_city parts_vehicles / vehicles/cars.py 관례: 밝은 지붕·보닛·짐칸 윗면(+2/+1) → 접힘선 → 어두운 옆면,
바퀴집은 옆면을 파고 들어간 어두운 반원, 타이어 + 휠캡, 전체 1px sumi 윤곽. 오른쪽(동)을 보고 선다.
바닥은 jp_shopstreet16 잔디/물 칩(chip)과 jp_regions_pack 의 칸 해시 클러스터(H) 관례: 16 주기 이음매 없음,
가로 줄무늬·소용돌이 없음, 대비 낮은 2~3px 덩이만.
"""
from __future__ import annotations

import collections
import math
from typing import Callable, Final


from inaka_art_houses import (  # noqa: E402
    OL, Cv, H, J, K, add_outline, canopy_clusters, disc, kit, line, plinth_34, post, rect_3d, rows, shed, stones,
)
from inaka_style import ground_shadow, tint_outlines  # noqa: E402

# ═══════════════════════════ R5 명암 도우미 ═══════════════════════════
# 색 목록은 밝음 → 어둠 순서. 단 사이는 4×4 베이어 디더로 섞는다(난수 없음, 위치 고정).
_BAYER: Final = ((0, 8, 2, 10), (12, 4, 14, 6), (3, 11, 1, 9), (15, 7, 13, 5))
SHADOW: Final = K('tairu', -2)

W_PAINT = [K('shiro', 2), K('shiro', 1), K('shiro', 0), K('conc', 1), K('shiro', -1), K('conc', -1)]
RED = [K('daidai', 2), K('aka', 2), K('aka', 1), K('aka', 0), K('aka', -1), K('aka', -2)]
ORANGE = [K('kii', 2), K('daidai', 2), K('daidai', 1), K('daidai', 0), K('daidai', -1), K('daidai', -2)]
RUBBER = [K('tekko', 0), K('tekko', -1), K('tekko', -2), K('sumi', 1)]
GLASS = [K('garasu', 3), K('garasu', 2), K('garasu', 1), K('garasu', 0), K('garasu', -1), K('garasu', -2)]
STEEL = [K('tekko', 3), K('tekko', 2), K('tekko', 1), K('tekko', 0), K('tekko', -1), K('tekko', -2)]
CONC = [K('conc', 3), K('conc', 2), K('conc', 1), K('conc', 0), K('conc', -1), K('conc', -2)]
CEDAR = [J('aged_cedar', 4), J('aged_cedar', 3), J('aged_cedar', 2), J('aged_cedar', 1), J('aged_cedar', 0), J('machiya_timber', 2)]
TIMBER = [J('machiya_timber', 4), J('machiya_timber', 3), J('machiya_timber', 2), J('machiya_timber', 1), J('machiya_timber', 0)]
STONE = [J('shrine_flagstone', 4), J('shrine_flagstone', 3), J('shrine_flagstone', 2), J('shrine_flagstone', 1), J('shrine_flagstone', 0), K('yoru', 0)]
STRAW = [J('lantern_amber', 4), J('lantern_amber', 3), J('tatami_straw', 3), J('lantern_amber', 2), J('tatami_straw', 2),
         J('tatami_straw', 1), J('lantern_amber', 1), J('lantern_amber', 0)]
LEAF = [K('ki', 3), K('ki', 2), K('ki', 1), K('ki', 0), K('ki', -1), K('ki', -2)]
SUN = [K('kii', 2), K('kii', 1), K('kii', 0), K('daidai', 0), K('kii', -1), K('kii', -2)]
SEED = [J('machiya_timber', 4), J('machiya_timber', 3), J('machiya_timber', 2), J('machiya_timber', 1), J('machiya_timber', 0)]
VERM = [J('torii_vermilion', 4), J('torii_vermilion', 3), J('torii_vermilion', 2), J('torii_vermilion', 1), J('torii_vermilion', 0)]
CREAM = [K('kinari', 2), K('kinari', 1), K('kinari', 0), K('kinari', -1), K('kinari', -2)]
GREEN_IRON = [K('midori', 2), K('midori', 1), K('midori', 0), K('kokuban', 0), K('midori', -1), K('midori', -2)]
SOIL = [K('soil', 2), K('soil', 1), K('soil', 0), K('soil', -1), K('soil', -2)]
VCW = [J('vending_cool_white', 4), J('vending_cool_white', 3), J('vending_cool_white', 2), J('vending_cool_white', 1),
       J('vending_cool_white', 0), K('conc', -1)]
INDIGO = [J('noren_indigo', 4), J('noren_indigo', 3), J('noren_indigo', 2), J('noren_indigo', 1), J('noren_indigo', 0)]
BRONZE = [J('lantern_amber', 4), J('lantern_amber', 3), J('lantern_amber', 2), J('lantern_amber', 1), J('lantern_amber', 0)]


def pick(cols, v, x, y):
    """밝기 단 v(0 = 가장 밝음, 소수 = 다음 단과 베이어 디더)."""
    n = len(cols)
    v = max(0.0, min(n - 1.0, v))
    i = int(v)
    if i + 1 < n and v - i > (_BAYER[y & 3][x & 3] + 0.5) / 16:
        i += 1
    return cols[i]


def vgrad(c, x, y, w, h, cols, v0, v1):
    for j in range(h):
        v = v0 + (v1 - v0) * (j / max(1, h - 1))
        for i in range(w):
            c.P(x + i, y + j, pick(cols, v, x + i, y + j))


def hgrad(c, x, y, w, h, cols, v0, v1):
    for i in range(w):
        v = v0 + (v1 - v0) * (i / max(1, w - 1))
        for j in range(h):
            c.P(x + i, y + j, pick(cols, v, x + i, y + j))


def cyl_lv(u, n, dark_left=1.1):
    """원통 가로 위치 u(-1 왼쪽 … 1 오른쪽) → 단. 빛은 왼쪽 위: u≈-0.45 가 가장 밝고 오른쪽으로 깊어진다."""
    if u < -0.45:
        return (-0.45 - u) / 0.55 * dark_left
    return (u + 0.45) / 1.45 * (n - 1)


def cyl(c, x, y, w, h, cols, add=0.0, grain=0.0, seed=0):
    for i in range(w):
        u = (i + 0.5) / w * 2 - 1
        for j in range(h):
            g = (H(x + i, (y + j) // 3, seed) - 0.5) * grain if grain else 0.0
            c.P(x + i, y + j, pick(cols, cyl_lv(u, len(cols)) + add + g, x + i, y + j))


def ball(c, cx, cy, r, cols, ry=None, bias=0.0, mask=None):
    """빛이 왼쪽 위인 공·타원 덩이(가장자리 약간 어둡게)."""
    ry = r if ry is None else ry
    n = len(cols)
    for y in range(int(cy - ry - 1), int(cy + ry + 2)):
        for x in range(int(cx - r - 1), int(cx + r + 2)):
            u, v = (x - cx) / r, (y - cy) / ry
            if u * u + v * v > 1.0:
                continue
            if mask is not None and not mask(x, y):
                continue
            s = (u + v) * 0.62 + (u * u + v * v) * 0.35 + bias
            c.P(x, y, pick(cols, (s + 0.45) / 1.65 * (n - 1), x, y))


def speck(c, x, y, w, h, col, p, seed):
    """이미 칠한 화소 위에만 위치 해시 점(때·녹·결)."""
    for j in range(h):
        for i in range(w):
            xx, yy = x + i, y + j
            if 0 <= xx < c.w and 0 <= yy < c.h and c.a[yy, xx, 3] and H(xx, yy, seed) < p:
                c.P(xx, yy, col)


def finish(c, shadow=None):
    """윤곽 → 재질색 윤곽 → 발치 그늘(투명 칸에만)."""
    add_outline(c)
    tint_outlines(c)
    for s in (shadow or ()):
        ground_shadow(c, *s)


def _ramps():
    """색 → (램프 목록(어둠 → 밝음), 그 안 위치). 윤곽을 「이웃 재질의 몇 단 어두운 색」으로 고를 때 쓴다."""
    import json as _json
    import os as _os
    from modern3_check import load_pal
    rs = {k: list(v) for k, v in load_pal().items() if k not in ('shiba', 'neonP', 'neonC')}
    root = _os.path.abspath(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..', '..', '..'))
    with open(_os.path.join(root, 'tiledata', 'jp-city', 'palette-contract.json'), encoding='utf-8') as f:
        for fam in _json.load(f)['families']:
            for m in fam['materials']:
                rs[m['id']] = [int(h[1:], 16) for h in m['steps']]
    own = {}
    for r in rs.values():
        for i, col in enumerate(r):
            own.setdefault(col, (r, i))
    return own


_RAMP_OF: Final = _ramps()


def soft_outline(c, steps=2):
    """add_outline 대신: 투명 칸 둘레를 이웃 재질 램프의 steps 단 어두운 색으로 두른다(근흑 대신 재질 어두운 톤).
    이웃이 여럿이면 가장 많이 닿은 색, 같으면 더 어두운 색."""
    a = c.a
    h, w = a.shape[:2]
    op = a[..., 3] > 0
    out = []
    for y in range(h):
        for x in range(w):
            if op[y, x]:
                continue
            votes = {}
            for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                yy, xx = y + dy, x + dx
                if 0 <= yy < h and 0 <= xx < w and op[yy, xx]:
                    k = (int(a[yy, xx, 0]) << 16) | (int(a[yy, xx, 1]) << 8) | int(a[yy, xx, 2])
                    votes[k] = votes.get(k, 0) + 1
            if not votes:
                continue
            nb = max(votes, key=lambda k: (votes[k], -k))
            r, i = _RAMP_OF.get(nb, ([nb], 0))
            out.append((x, y, r[max(1 if len(r) > 4 else 0, i - steps)] if i - steps >= 0 else r[0]))
    for x, y, col in out:
        c.P(x, y, col)


def wheel(c, cx, cy, r=4.5, hub='conc'):
    """바퀴: 바퀴집 그늘 → 고무 4단(왼쪽 위 밝은 트레드, 바깥 둘레 깊게) → 휠 5단 + 너트."""
    disc(c, cx + 0.3, cy - 0.6, r + 1.5, K('tekko', -2))
    disc(c, cx + 0.8, cy - 0.2, r + 1.1, K('sumi', 1))
    R = r + 0.6
    hb = [K(hub, 3), K(hub, 2), K(hub, 1), K(hub, 0), K(hub, -1), K(hub, -2)]
    for y in range(int(cy - R - 1), int(cy + R + 2)):
        for x in range(int(cx - R - 1), int(cx + R + 2)):
            dx, dy = x - cx, y - cy
            d = math.hypot(dx, dy)
            if d > R:
                continue
            s = (dx + dy) / (R * 1.414)
            if d > r * 0.56:
                lv = 1.3 + s * 1.6 + (0.9 if d > R - 0.8 else 0.0)
                if d < r * 0.56 + 1.0:
                    lv += 0.8                                    # 휠 둘레 안쪽 틈
                c.P(x, y, pick(RUBBER, lv, x, y))
            else:
                lv = 1.9 + s * 2.4 + (0.9 if d > r * 0.56 - 1 else 0.0)
                c.P(x, y, pick(hb, lv, x, y))
    c.P(round(cx), round(cy), K('tekko', -1)); c.P(round(cx) + 1, round(cy), K('tekko', 0))
    c.P(round(cx - 1), round(cy - 1), K(hub, 3))
    for k in range(4):                                           # 너트 4개
        a = k * math.pi / 2 + 0.6
        c.P(round(cx + math.cos(a) * r * 0.32), round(cy + math.sin(a) * r * 0.32), hb[3])
    c.P(round(cx - r * 0.7), round(cy - r * 0.7), RUBBER[0])     # 트레드 빛


def crate(c, x, y, w, h, content):
    """나무 채소 상자(3/4): 위 테두리 → 내용물 → 앞판 나무결."""
    for j in range(h):
        for i in range(w):
            xx, yy = x + i, y + j
            if j == 0:
                col = pick(CEDAR, 0.6 + i / w * 0.8, xx, yy)
            elif j < 4:
                col = pick(CEDAR, 3.2 + (1 if i in (0, w - 1) else 0), xx, yy)
            else:
                g = (H(xx, yy // 2, 41) - 0.5) * 1.1
                col = pick(CEDAR, 1.4 + (j - 4) * 0.35 + i / w * 0.9 + g + (1.4 if j == 6 else 0), xx, yy)
            c.P(xx, yy, col)
    content(x + 1, y + 1, w - 2)


# ═══════════════════════════ 3D 밑그림 투영(box_underdraw.py 와 같은 수학) ═══════════════════════════
# 점 (x, y=북쪽, z=위) → 화면 sx = x, sy = base − 0.65·y − z. 같은 화소에서는 y − 0.65·z 가 작은 쪽이 앞.
# 탈것·망루·자전거는 이 투영으로 기본형(상자·원통·고리·사각뿔)을 깊이 버퍼에 찍은 뒤, 면마다 재질 램프로 손 칠한다.
import numpy as np  # noqa: E402

_C3: Final = 0.65
_V3: Final = np.array((0.0, -1.0, _C3)) / math.hypot(1.0, _C3)


def _v(*a):
    return np.array(a, dtype=float)


def _frame3(ox, oy, theta_deg):
    """차체 좌표(s 뒤→앞, w 왼쪽+, z 위) → 세계. θ = 앞이 동쪽에서 남쪽으로 돈 각."""
    t = math.radians(theta_deg)
    h, l = _v(math.cos(t), -math.sin(t), 0), _v(math.sin(t), math.cos(t), 0)
    o = _v(ox, oy, 0)
    return (lambda s, w, z: o + h * s + l * w + _v(0, 0, z)), h, l, _v(0, 0, 1)


def _lv3(n):
    """면 방향 → 기본 단: 윗면 0, 남향 옆면 ≈2.6, 동향(앞) 면 ≈3.4. 빛은 북서 위."""
    return max(0.0, (1 - n[2]) * 2.4 + n[0] * 1.0 - n[1] * 0.2)


class _S3:
    def __init__(self, c, base, low_z=3.0):
        self.c, self.base, self.low_z = c, base, low_z
        self.depth = np.full((c.h, c.w), np.inf)
        self.fid = np.full((c.h, c.w), -1, int)
        self.nrm = np.zeros((c.h, c.w, 3))
        self.uv = np.zeros((c.h, c.w, 2))
        self.low = np.zeros((c.h, c.w), bool)
        self.names = []

    def scr(self, p):
        return p[0], self.base - _C3 * p[1] - p[2]

    def at(self, p):
        x, y = self.scr(p)
        return int(math.floor(x)), int(math.floor(y))

    def _id(self, name):
        if name not in self.names:
            self.names.append(name)
        return self.names.index(name)

    def _put(self, p, n, fid, u, v):
        i, j = self.at(p)
        if 0 <= i < self.c.w and 0 <= j < self.c.h:
            d = p[1] - _C3 * p[2]
            if d < self.depth[j, i] - 1e-6:
                self.depth[j, i] = d; self.fid[j, i] = fid
                self.nrm[j, i] = n if np.dot(n, _V3) >= 0 else -n
                self.uv[j, i] = (u, v)
        if p[2] < self.low_z:                                         # 발치 그늘(남동으로 짧게)
            g = p + _v(0.8, -0.6, 0) * (1.0 + p[2] * 0.6)
            g[2] = 0
            gi, gj = self.at(g)
            if 0 <= gi < self.c.w and 0 <= gj < self.c.h:
                self.low[gj, gi] = True

    def _n(self, a, b):
        (x0, y0), (x1, y1) = self.scr(a), self.scr(b)
        return max(2, int(math.ceil(math.hypot(x1 - x0, y1 - y0) / 0.3)) + 1)

    def quad(self, name, p0, e1, e2, n=None):
        fid = self._id(name)
        n = np.cross(e1, e2) if n is None else n
        n = n / (np.linalg.norm(n) or 1)
        L1, L2 = np.linalg.norm(e1), np.linalg.norm(e2)
        nu, nv = self._n(p0, p0 + e1), self._n(p0, p0 + e2)
        for a in range(nu):
            for b in range(nv):
                u, v = a / (nu - 1), b / (nv - 1)
                self._put(p0 + e1 * u + e2 * v, n, fid, u * L1, v * L2)

    def tri(self, name, p0, p1, p2):
        """세모: (u, v) 는 길이가 아니라 비율(p0→p1, p0→p2)."""
        fid = self._id(name)
        e1, e2 = p1 - p0, p2 - p0
        n = np.cross(e1, e2); n = n / (np.linalg.norm(n) or 1)
        nu, nv = self._n(p0, p1), self._n(p0, p2)
        for a in range(nu):
            for b in range(nv):
                u, v = a / (nu - 1), b / (nv - 1)
                if u + v <= 1.0:
                    self._put(p0 + e1 * u + e2 * v, n, fid, u, v)

    def box(self, name, o, ex, ey, ez):
        ctr = o + (ex + ey + ez) / 2
        for (p0, a, b) in ((o, ex, ey), (o + ez, ex, ey), (o, ex, ez), (o + ey, ex, ez), (o, ey, ez), (o + ex, ey, ez)):
            n = np.cross(a, b); n = n / np.linalg.norm(n)
            if np.dot(n, p0 + (a + b) / 2 - ctr) < 0:
                n = -n
            tag = max((('top', n[2]), ('bot', -n[2]), ('s', -n[1]), ('n', n[1]), ('e', n[0]), ('w', -n[0])), key=lambda t: t[1])[0]
            self.quad(f'{name}.{tag}', p0, a, b, n)

    def _basis(self, axis):
        a = axis / np.linalg.norm(axis)
        t1 = np.cross(a, _v(0, 0, 1))
        if np.linalg.norm(t1) < 1e-6:
            t1 = np.cross(a, _v(1, 0, 0))
        t1 = t1 / np.linalg.norm(t1)
        return a, t1, np.cross(a, t1)

    def cyl(self, name, c0, axis, r, length, caps=True):
        """옆면 name.side(u 둘레 길이, v 축 길이) · 마개 name.cap(u 둘레 각 비율, v 중심에서 거리)."""
        a, t1, t2 = self._basis(axis)
        fs, fc = self._id(name + '.side'), self._id(name + '.cap')
        na = max(24, int(2 * math.pi * r / 0.3)); nl = max(2, int(length / 0.3) + 1)
        for k in range(na):
            th = 2 * math.pi * k / na
            rad = t1 * math.cos(th) + t2 * math.sin(th)
            for m in range(nl):
                self._put(c0 + a * (length * m / (nl - 1)) + rad * r, rad, fs, th * r, length * m / (nl - 1))
            if caps:
                for end in (0.0, length):
                    for m in range(max(2, int(r / 0.3) + 1)):
                        rr = r * m / max(1, int(r / 0.3))
                        self._put(c0 + a * end + rad * rr, a if end else -a, fc, k / na, rr)

    def torus(self, name, c0, axis, R, r):
        a, t1, t2 = self._basis(axis)
        fid = self._id(name)
        na, nb = max(48, int(2 * math.pi * R / 0.25)), 12
        for k in range(na):
            th = 2 * math.pi * k / na
            rad = t1 * math.cos(th) + t2 * math.sin(th)
            for m in range(nb):
                ph = 2 * math.pi * m / nb
                n = rad * math.cos(ph) + a * math.sin(ph)
                self._put(c0 + rad * R + n * r, n, fid, th * R, ph)

    def rod(self, name, p0, p1, r=0.6):
        d = p1 - p0
        self.cyl(name, p0, d, r, float(np.linalg.norm(d)), caps=False)

    def pyramid(self, name, corners, apex):
        for k in range(4):
            self.tri(f'{name}.{k}', corners[k], corners[(k + 1) % 4], apex)

    def edges(self):
        """앞 면이 뒤 면(또는 다른 면)을 가리는 경계 화소: 이 화소가 가까운 쪽일 때만."""
        h, w = self.fid.shape
        e = np.zeros((h, w), bool)
        for j in range(h):
            for i in range(w):
                f = self.fid[j, i]
                if f < 0:
                    continue
                for dj, di in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    jj, ii = j + dj, i + di
                    if 0 <= jj < h and 0 <= ii < w and self.fid[jj, ii] >= 0 and self.fid[jj, ii] != f \
                            and self.depth[jj, ii] > self.depth[j, i] + 0.6:
                        e[j, i] = True; break
        return e

    def paint(self, fn):
        """fn(name, normal, u, v, x, y, edge) → 색(None 이면 비운다)."""
        e = self.edges()
        for j in range(self.c.h):
            for i in range(self.c.w):
                f = self.fid[j, i]
                if f >= 0:
                    col = fn(self.names[f], self.nrm[j, i], self.uv[j, i, 0], self.uv[j, i, 1], i, j, bool(e[j, i]))
                    if col is not None:
                        self.c.P(i, j, col)

    def contact_shadow(self, col):
        for j in range(self.c.h):
            for i in range(self.c.w):
                if self.low[j, i] and self.c.a[j, i, 3] == 0 and (i + j) % 2 == 0:
                    self.c.P(i, j, col)


def _outline_outside(c, soft=True):
    """윤곽을 바깥 실루엣에만 두른다(격자·바퀴 고리 안 구멍은 투명으로 남긴다)."""
    op = c.a[..., 3] > 0
    outside = np.zeros_like(op)
    stack = [(y, x) for y in range(c.h) for x in (0, c.w - 1)] + [(y, x) for x in range(c.w) for y in (0, c.h - 1)]
    while stack:
        y, x = stack.pop()
        if outside[y, x] or op[y, x]:
            continue
        outside[y, x] = True
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            if 0 <= y + dy < c.h and 0 <= x + dx < c.w:
                stack.append((y + dy, x + dx))
    holes = ~op & ~outside
    if soft:
        soft_outline(c)
    else:
        add_outline(c); tint_outlines(c)
    c.a[holes] = 0


# ═══════════════════════════ 탈것 ═══════════════════════════
def _kt_pf(cols, lv, x, y):
    """평평한 단(디더 없음): 탈것 옆모습은 띠마다 한 색, 띠 사이 경계를 또렷하게."""
    return cols[max(0, min(len(cols) - 1, int(round(lv))))]


def _kt_wheel(c, cx, cy, r, rim, tread=False):
    """옆에서 본 바퀴(동·서 향 옆모습): 고무(왼쪽 위 빛) → 휠(rim 램프) → 허브. tread 면 바깥 둘레에 러그 덩이."""
    n = len(rim)
    for y in range(int(cy - r - 1), int(cy + r + 2)):
        for x in range(int(cx - r - 1), int(cx + r + 2)):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            d = math.hypot(dx, dy)
            if d > r:
                continue
            s = (dx + dy) / (r * 1.414)
            if d > r * 0.55:
                lv = 1.0 + s * 1.3 + (0.9 if d > r - 1.0 else 0.0)
                if tread and d > r - 2.2:
                    ang = math.atan2(dy, dx)
                    if int((ang + math.pi) / (2 * math.pi) * max(12, int(r * 2.2))) % 2 == 0:
                        lv -= 0.9                                            # 러그 덩이(밝다) / 골(어둡다)
                    else:
                        lv += 0.8
                if r * 0.55 < d < r * 0.55 + 1.0:
                    lv += 0.9                                                # 휠과 고무 사이 틈
                c.P(x, y, _kt_pf(RUBBER, lv, x, y))
            else:
                lv = 0.6 + s * (n - 1.6) + (1.0 if d > r * 0.55 - 1.0 else 0.0)
                c.P(x, y, _kt_pf(rim, lv, x, y))
    if r > 6:
        for k in range(16):                                                  # 허브 테 + 너트
            th = k / 16 * 2 * math.pi
            c.P(int(cx + r * 0.3 * math.cos(th)), int(cy + r * 0.3 * math.sin(th)), rim[2] if math.sin(th + 0.8) < 0 else rim[3])
    c.P(int(cx), int(cy), STEEL[4]); c.P(int(cx) - 1, int(cy) - 1, rim[0])


@kit('inaka-keitora-white', '흰 경트럭(軽トラ) - 3/4 탑뷰, 동쪽을 보는 옆모습(jp-truck-kei 와 같은 틀): 캡 지붕 윗면 9줄·기운 앞유리·문 창·짐칸 위에서 본 안쪽(먼 판 안쪽 → 골 바닥 위 채소 상자·파란 덮개 → 가까운 판 윗테)·남쪽 옆판·한 줄 바닥선 위 두 바퀴(4×3)', 4, 3, 'vehicle',
     solid=rows(4, [1, 2]), tags=['inaka', '경트럭', '軽トラ', '탈것'],
     rules='농가 마당·논두렁 옆 자갈길에 길과 나란히(동서) 세운다.', role='prop')
def keitora(c, base):
    W = W_PAINT                                                              # 0 가장 밝음 … 5 가장 어둠
    BL = [K('sora', 2), K('sora', 1), K('sora', 0), K('sora', -1), K('kon', -1)]
    BX0, BX1 = 3, 35                                                         # 짐칸 x 범위
    CX0, CX1 = 36, 61                                                        # 캡 x 범위
    # ── 짐칸: 먼 판 윗테(13~14) → 먼 판 안쪽 면(15~16, 그늘) → 골 바닥 윗면(17~22) → 가까운 판 윗테(23~24) → 옆판(25~36)
    for x in range(BX0, BX1 + 1):
        f = (x - BX0) / (BX1 - BX0)
        c.P(x, 13, _kt_pf(W, 0.2 + f * 0.9, x, 13))
        c.P(x, 14, _kt_pf(W, 1.6 + f * 0.6, x, 14))
        c.P(x, 15, W[3]); c.P(x, 16, W[5])                                   # 먼 판 안쪽 면(그늘)
        for y in range(17, 23):
            rib = (y - 17) % 2 == 1
            c.P(x, y, _kt_pf(STEEL, (2.0 if rib else 3.0) + f * 0.8 + (1.0 if y == 17 else 0), x, y))
        c.P(x, 23, _kt_pf(W, 0.0 + f * 0.8, x, 23))
        c.P(x, 24, _kt_pf(W, 2.0 + f * 0.5, x, 24))
    # 짐: 나무 채소 상자(윗면 = 채소 잎을 위에서 본 덩이, 앞판 나무결)
    for y in range(16, 23):
        for x in range(6, 16):
            if y <= 19:
                if x in (6, 15) or y == 16:
                    col = _kt_pf(CEDAR, 0.8 + (x - 6) * 0.1, x, y)             # 상자 테 윗면
                else:
                    col = LEAF[min(5, int(H(x, y, 5) * 3.2) + (1 if y == 19 else 0) + (1 if x > 12 else 0))]
            else:
                col = _kt_pf(CEDAR, 1.8 + (y - 20) * 0.4 + (x - 6) * 0.08 + (1.2 if y == 21 else 0), x, y)
            c.P(x, y, col)
    for x in (8, 11, 13):
        c.P(x, 17, K('daidai', 1) if x != 11 else K('kii', 1))               # 잎 사이 무·당근 머리
    # 짐: 파란 덮개 덩이(둥근 윗면, 왼쪽 위 빛) — 끈 두 줄
    for y in range(14, 23):
        for x in range(19, 31):
            u, v = (x + 0.5 - 25.0) / 6.1, (y + 0.5 - 20.0) / 6.0
            if v < 0 and u * u + v * v > 1.0:
                continue
            lv = 0.3 + (u + 1) * 0.9 + max(0.0, v) * 1.6 + (0.6 if y >= 21 else 0)
            c.P(x, y, _kt_pf(BL, lv, x, y))
    for x in (22, 28):
        for y in range(15, 23):
            if c.a[y, x, 3]:
                c.P(x, y, K('kii', 0) if y < 18 else K('kii', -1))
    # 옆판(남쪽 면): 위 띠 밝게 → 아래로 깊게, 판 이음·눌린 띠·후미등
    for y in range(25, 37):
        for x in range(BX0, BX1 + 1):
            lv = 0.9 + (y - 25) * 0.16 + (x - BX0) / 40 * 0.5
            if y == 30:
                lv = 3.6                                                     # 눌린 띠 그늘
            elif y == 31:
                lv = 0.4                                                     # 그 아래 빛 턱
            c.P(x, y, _kt_pf(W, lv, x, y))
    for x in (14, 25):
        c.VL(x, 25, 12, W[4])
        c.VL(x + 1, 25, 12, W[1])
    c.VL(BX0, 13, 24, W[3])                                                  # 뒷문 끝 그늘
    c.R(BX0 + 1, 26, 2, 3, RED[2]); c.P(BX0 + 1, 26, RED[0]); c.P(BX0 + 2, 28, RED[4])
    # ── 캡: 지붕 윗면(5~13, 9줄) → 앞선(14) → 옆면(15~36), 오른쪽 끝 기운 앞유리
    for y in range(5, 14):
        for x in range(CX0 + 1, 56):
            lv = 0.0 + (x - CX0) / 20 * 1.0 + (y - 5) * 0.05
            if 12 <= (x - CX0) + (y - 5) <= 13 and y < 11:
                lv = 0.0                                                     # 비스듬한 빛 줄(지붕 광택)
            c.P(x, y, _kt_pf(W, max(0.0, lv), x, y))
    c.HL(CX0 + 1, 5, 19, W[1])                                               # 지붕 뒤 끝
    c.HL(CX0 + 1, 14, 19, W[3])                                              # 지붕 앞선(윗면 끝)
    c.VL(CX0, 5, 20, W[3]); c.VL(CX0 + 1, 6, 8, W[1])                       # 캡 뒷벽 모서리
    for y in range(6, 21):                                                   # 앞유리: 위 x56 → 아래 x61 로 기운다
        xr = 56 + (y - 6) * 5 // 14
        for x in range(55, xr + 1):
            col = _kt_pf(GLASS, 1.6 + (y - 6) * 0.15 + (0.0 if x == xr else 0.7), x, y)
            if x - 55 == (y - 6) // 3 and y < 14:
                col = GLASS[0]                                               # 유리 빛 줄
            c.P(x, y, col)
        c.P(xr + 1, y, W[4])
    for y in range(15, 37):                                                  # 캡 옆면
        xr = min(CX1, 56 + max(0, y - 6) * 5 // 14) if y < 21 else CX1
        for x in range(CX0, xr + 1):
            if x >= 55 and y < 21:
                continue
            lv = 0.6 + (y - 15) * 0.09 + (x - CX0) / 30 * 0.4
            if y == 30:
                lv = 3.6
            elif y == 31:
                lv = 0.4
            c.P(x, y, _kt_pf(W, lv, x, y))
    c.HL(CX0, 15, 20, W[0])                                                  # 옆면 위 모서리 빛
    for y in range(17, 25):                                                  # 문 창(틀 → 유리, 위쪽 반사)
        for x in range(40, 54):
            if y in (17, 24) or x in (40, 53):
                col = W[4]
            else:
                col = _kt_pf(GLASS, 1.4 + (y - 18) * 0.35 + (0.9 if x > 48 else 0), x, y)
                if (x - 41) + (y - 18) in (3, 4):
                    col = GLASS[0]
            c.P(x, y, col)
    c.VL(38, 16, 21, W[4]); c.VL(55, 21, 16, W[4])                          # 문 이음
    c.HL(44, 27, 3, STEEL[3]); c.HL(44, 26, 3, W[0])                         # 문 손잡이
    c.R(59, 26, 2, 3, K('kii', 1)); c.P(59, 26, K('kii', 2)); c.P(60, 28, K('daidai', 0))   # 방향등
    c.R(57, 34, 5, 3, CONC[2]); c.HL(57, 34, 5, CONC[0]); c.HL(57, 36, 5, CONC[4])          # 앞 범퍼
    c.R(BX0, 34, 3, 3, CONC[2]); c.HL(BX0, 34, 3, CONC[0])                  # 뒤 범퍼
    c.HL(4, 37, 54, STEEL[4]); c.HL(6, 38, 50, STEEL[5])                     # 차대 그늘
    # ── 바퀴집(옆판을 파고 든 어두운 반원) → 바퀴(한 바닥선 y45)
    hub = [K('conc', 3), K('conc', 2), K('conc', 1), K('conc', 0), K('conc', -1), K('conc', -2)]
    for (wx, wy) in ((12.5, 40.0), (49.5, 40.0)):
        for y in range(31, 40):
            for x in range(int(wx - 7), int(wx + 8)):
                if math.hypot(x + 0.5 - wx, y + 0.5 - wy) < 7.0 and c.a[y, x, 3]:
                    c.P(x, y, STEEL[5] if math.hypot(x + 0.5 - wx, y + 0.5 - wy) < 6.2 else W[3])
        _kt_wheel(c, wx, wy, 5.2, hub)
    finish(c)
    ground_shadow(c, 4, 60, 45, 3, SHADOW)


@kit('inaka-red-tractor', '빨간 농기계 트랙터 - 3/4 탑뷰, 동쪽을 보는 옆모습: 차양 캐노피 지붕 윗면(7줄)·보닛 윗면(6줄)과 옆 환기 슬릿·좌석 쿠션 윗면·핸들·배기 연통 마개·흙받이 윗면·로터리 덮개 윗면, 큰 뒷바퀴와 작은 앞바퀴가 한 바닥선(4×4)', 4, 4, 'vehicle',
     solid=rows(4, [2, 3]), tags=['inaka', '트랙터', 'トラクター', '농기계'],
     rules='논 가장자리·헛간 앞. 오른쪽(동)을 보고 둔다.', role='prop')
def tractor(c, base):
    rim = [K('kii', 2), K('kii', 1), K('kii', 0), K('kii', -1), K('kii', -2)]
    # ── 1) 로터리 작업기(뒤, x1~11): 덮개 윗면 4줄 → 앞선 → 옆판 → 칼날
    for x in range(1, 12):
        f = (x - 1) / 10
        for y in range(40, 44):
            c.P(x, y, _kt_pf(ORANGE, 0.2 + f * 0.9 + (y - 40) * 0.2, x, y))
        c.P(x, 44, ORANGE[3])
        for y in range(45, 54):
            lv = 1.4 + (y - 45) * 0.25 + f * 0.6 + (1.2 if (x - 1) % 4 == 3 else 0)
            c.P(x, y, _kt_pf(ORANGE, lv, x, y))
        c.P(x, 54, ORANGE[5])
    c.HL(1, 40, 11, ORANGE[0])
    for k, x in enumerate(range(1, 12, 2)):                                 # 회전 날: 굴대 아래 엇갈려 휜 칼날
        d = 1 if k % 2 else 0
        c.P(x, 55, STEEL[1]); c.P(x + 1, 55, STEEL[3])
        c.P(x + d, 56, STEEL[2]); c.P(x + d, 57, STEEL[4])
        c.P(x + 1 - d, 58, SOIL[2] if H(x, 3, 11) < 0.5 else SOIL[3])
    for t in range(6):                                                       # 3점 링크 팔(덮개 → 뒷바퀴 축)
        c.P(11 + t, 41 + t // 2, STEEL[2]); c.P(11 + t, 42 + t // 2, STEEL[4])
    # ── 2) 큰 뒷바퀴(cx21, cy48, r13.5) → 흙받이(바퀴 위 둥근 판: 윗면 4줄 + 테)
    RX, RY, RR = 21.0, 48.0, 13.5
    _kt_wheel(c, RX, RY, RR, rim, tread=True)
    FR = 15.5
    for x in range(6, 37):
        dx = x + 0.5 - RX
        if abs(dx) >= FR:
            continue
        yt = int(round(RY - math.sqrt(FR * FR - dx * dx)))
        f = (x - 6) / 30
        for j in range(4):                                                   # 흙받이 윗면(위에서 본 넓은 판)
            c.P(x, yt + j, _kt_pf(RED, 0.4 + f * 1.0 + j * 0.25, x, yt + j))
        c.P(x, yt, RED[0] if f < 0.6 else RED[1])
        c.P(x, yt + 4, RED[4]); c.P(x, yt + 5, RED[5])                       # 흙받이 앞 테(옆면)
    # ── 3) 보닛(x33~61): 윗면 6줄(31~36, 마루 빛·환기 틈) → 앞선(37) → 옆면(38~47, 루버) → 앞 그릴
    HX0, HX1 = 33, 61
    for x in range(HX0, HX1 + 1):
        f = (x - HX0) / (HX1 - HX0)
        for y in range(31, 37):
            lv = 1.0 + f * 0.7 + (y - 31) * 0.12
            if y == 32:
                lv = 0.0 if x < 54 else 1.0                                  # 마루 빛 줄
            c.P(x, y, _kt_pf(RED, max(0.0, lv), x, y))
        c.P(x, 31, RED[1] if x < 58 else RED[2])
        c.P(x, 37, RED[4])
        for y in range(38, 48):
            lv = 3.0 + (y - 38) * 0.14 + f * 0.6
            c.P(x, y, _kt_pf(RED, lv, x, y))
    for x in range(38, 55, 3):                                               # 윗면 환기 틈(위에서 본 짧은 슬릿)
        c.P(x, 34, RED[5]); c.P(x + 1, 34, RED[5]); c.P(x, 35, RED[2])
    for y in (40, 42, 44):                                                   # 옆면 루버(그늘 줄 + 빛 턱)
        c.HL(42, y, 13, RED[5]); c.HL(42, y + 1, 13, RED[1])
    c.HL(34, 39, 6, W_PAINT[1]); c.HL(34, 40, 6, W_PAINT[3])                 # 흰 줄 상표띠(글자 없음)
    for y in range(32, 48):                                                  # 앞 그릴(동쪽 끝)
        c.P(HX1, y, STEEL[3] if y % 2 else STEEL[5])
    c.P(HX1 - 1, 33, K('shiro', 2)); c.P(HX1, 33, K('kii', 1))               # 전조등
    c.HL(HX0, 48, 28, STEEL[5])                                              # 보닛 밑 엔진 그늘
    # ── 4) 앞바퀴(cx52, cy55, r7) — 뒷바퀴와 같은 바닥선(y61)
    _kt_wheel(c, 52.0, 54.5, 7.0, rim, tread=True)
    for x in range(44, 61):                                                  # 앞 흙받이(작은 판)
        dx = x + 0.5 - 52.0
        if abs(dx) < 8.5:
            yt = int(round(54.5 - math.sqrt(8.5 * 8.5 - dx * dx)))
            if yt >= 46:
                c.P(x, yt, RED[1]); c.P(x, yt + 1, RED[2]); c.P(x, yt + 2, RED[4])
    # ── 5) 좌석: 받침(흙받이 위) → 쿠션 윗면 4줄(24~27) → 앞면 2줄 → 등받이
    for y in range(29, 33):
        c.HL(19, y, 4, STEEL[3] if y % 2 else STEEL[4])
    for y in range(24, 28):
        for x in range(15, 27):
            lv = 0.3 + (x - 15) / 11 * 1.4 + (y - 24) * 0.25
            c.P(x, y, _kt_pf([STEEL[2], STEEL[3], RUBBER[0], RUBBER[1], RUBBER[2]], lv, x, y))
    c.HL(15, 24, 12, STEEL[1])
    c.HL(15, 28, 12, RUBBER[2]); c.HL(15, 29, 12, RUBBER[3])                 # 쿠션 앞면
    for y in range(17, 28):                                                  # 등받이(서 있는 판, 왼쪽 빛)
        c.P(13, y, STEEL[2]); c.P(14, y, RUBBER[1])
    c.HL(13, 16, 2, STEEL[1])
    # ── 6) 핸들: 기둥(보닛 뒤 → 위) + 위에서 본 납작한 고리
    for t in range(7):
        c.P(32 - t // 3, 30 - t, STEEL[3]); c.P(33 - t // 3, 30 - t, STEEL[5])
    for k in range(28):
        th = k / 28 * 2 * math.pi
        x, y = round(29.5 + 3.4 * math.cos(th)), round(23 + 1.3 * math.sin(th))
        c.P(x, y, RUBBER[0] if math.sin(th) < -0.2 else RUBBER[2])
    # ── 7) 배기 연통(보닛 위 x45): 원통 + 위에서 본 마개 타원
    for y in range(21, 31):
        c.P(45, y, STEEL[1]); c.P(46, y, STEEL[2]); c.P(47, y, STEEL[4])
    c.HL(44, 19, 4, STEEL[3]); c.HL(44, 20, 4, STEEL[1]); c.P(45, 19, STEEL[5]); c.P(46, 19, STEEL[5])
    # ── 8) 차양 캐노피: 기둥 둘(→ 흙받이) → 지붕 윗면 7줄(4~10, 붉은·흰 줄, 위에서 본 판) → 앞선 → 술 2줄
    for px in (11, 31):
        for y in range(13, 34):
            c.P(px, y, W_PAINT[1]); c.P(px + 1, y, W_PAINT[4])
    CX0, CX1 = 5, 38
    for y in range(4, 11):                                                   # 지붕 윗면 7줄: 흰 FRP 판, 동서로 달리는 골(가로 줄)
        for x in range(CX0, CX1 + 1):
            if y == 4 and x in (CX0, CX1):
                continue
            lv = 0.2 + (x - CX0) / 33 * 1.6 + (y - 4) * 0.12
            if y in (6, 8):
                lv += 1.0                                                    # 골 그늘
            c.P(x, y, _kt_pf(W_PAINT, lv, x, y))
    c.HL(CX0 + 1, 4, CX1 - CX0 - 1, W_PAINT[0])                              # 지붕 뒤 끝 빛
    for x in range(CX0, CX1 + 1):                                            # 앞선 → 빨간 테 옆면 2줄
        f = (x - CX0) / 33
        c.P(x, 11, RED[1] if f < 0.5 else RED[2])
        c.P(x, 12, RED[3]); c.P(x, 13, RED[5] if x in (CX0, CX1) else RED[4])
    finish(c, [(2, 62, 62, 2, SHADOW, 1)])


@kit('inaka-single-car-train', '단량 디젤 동차(キハ40 국철색) - AU75 냉방기·물탱크·배기구 지붕 윗면·크림+주홍 투톤 차체·폴딩 도어·전조등·대차(8×3)', 8, 3, 'vehicle',
     solid=rows(8, [1, 2]), tags=['inaka', '열차', '기차', '디젤동차', 'キハ', '철도'],
     rules='시골 선로(jp-rail-h) 위에 올린다(간이역 승강장 앞).', role='prop')
def single_car_train(c, base):
    W = 128
    ROOF = [K('shiro', 2), K('shiro', 1), K('conc', 3), K('conc', 2), K('conc', 1), K('conc', 0), K('conc', -1)]
    # 3/4 지붕 윗면(y=1..17, jp-train-car-a 와 같은 비례): 뒤 어깨 그늘 → 넓은 판 → 앞 어깨 빛 → 처마로 꺾이는 그늘
    c.HL(2, 0, W - 4, OL)
    prof = (5, 4, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 1, 1, 0, 1, 3)
    for j, lv in enumerate(prof):
        y = 1 + j
        for x in range(2, W - 2):
            c.P(x, y, ROOF[lv])
    for j in (2, 9, 11, 13):                                      # 단 사이 한 줄만 디더(둥근 지붕의 부드러운 꺾임)
        y = 1 + j
        for x in range(2, W - 2):
            c.P(x, y, pick(ROOF, prof[j] - 0.5, x, y))
    for sx in range(18, W - 4, 16):                              # 지붕 판 이음(빛 쪽 밝은 턱 + 그늘 골)
        for y in range(2, 17):
            c.P(sx, y, ROOF[min(6, prof[y - 1] + 1)]); c.P(sx + 1, y, ROOF[max(0, prof[y - 1] - 1)])
    speck(c, 2, 3, W - 4, 9, ROOF[2], 0.07, 34); speck(c, 2, 3, W - 4, 9, ROOF[4], 0.05, 35)   # 지붕 도료 얼룩
    for x in range(56, 74):                                      # 배기 그을음(연통 뒤쪽으로 번짐)
        for y in range(9, 16):
            if H(x, y, 32) < 0.35 - abs(x - 64) * 0.03 - (y - 9) * 0.03:
                c.P(x, y, ROOF[5])
    c.VL(1, 1, 17, OL); c.VL(W - 2, 1, 17, OL)
    # 지붕 위 기기: 물탱크·AU75 냉방기 2기(윗면 + 앞면 그릴)
    for (bx, bw) in ((8, 14), (30, 22), (76, 22)):
        c.HL(bx, 3, bw, OL)
        for y in range(4, 9):
            for x in range(bx, bx + bw):
                c.P(x, y, pick(W_PAINT, 0.3 + (x - bx) / bw * 1.3 + (y - 4) * 0.3, x, y))
        c.HL(bx, 4, bw - 2, W_PAINT[0])
        vgrad(c, bx, 9, bw, 3, STEEL, 1.0, 4.5)
        for gx in range(bx + 3, bx + bw - 2, 4):
            c.VL(gx, 5, 3, CONC[3]); c.VL(gx + 1, 5, 3, W_PAINT[0]); c.P(gx, 10, STEEL[5])
        c.VL(bx - 1, 4, 8, OL); c.VL(bx + bw, 4, 8, OL); c.HL(bx - 1, 12, bw + 2, OL)
    # 디젤 배기 연통(원통 + 검은 구멍)
    cyl(c, 59, 3, 8, 6, STEEL); c.HL(59, 3, 8, STEEL[0])
    vgrad(c, 61, 4, 4, 3, RUBBER, 2.0, 3.0)
    c.VL(58, 3, 6, OL); c.VL(67, 3, 6, OL); c.HL(58, 9, 10, OL)
    for vx in (24, 53, 70, 102):                                 # 환기구
        hgrad(c, vx, 6, 4, 2, CONC, 0.2, 2.0); c.HL(vx, 8, 4, STEEL[4])
    for hx in (3, W - 7):                                        # 운전실 지붕 헤드라이트 포드
        cyl(c, hx, 7, 4, 4, STEEL); c.P(hx + (0 if hx < 64 else 3), 8, K('kii', 2))
    c.HL(1, 18, W - 2, K('tekko', -2)); c.HL(1, 19, W - 2, OL)    # 처마 홈통
    # 차체 옆면: 국철 크림 + 주홍 투톤 — 각 띠 위 빛 → 아래 그늘, 아래쪽은 대차 그늘로 더 깊다
    rowlv = {20: (VERM, 0), 21: (VERM, 1), 22: (VERM, 1), 23: (VERM, 2),
             24: (CREAM, 0), 25: (CREAM, 1), 26: (CREAM, 1), 27: (CREAM, 1), 28: (CREAM, 1), 29: (CREAM, 1), 30: (CREAM, 2), 31: (CREAM, 2),
             32: (VERM, 0), 33: (VERM, 1), 34: (CREAM, 1), 35: (CREAM, 3), 36: (VERM, 2), 37: (VERM, 2), 38: (VERM, 3)}
    for y, (cols, lv) in rowlv.items():
        c.HL(2, y, W - 4, cols[lv])
    for y in (23, 37):                                            # 띠 아래쪽 꺾임만 디더
        for x in range(2, W - 2):
            c.P(x, y, pick(rowlv[y][0], rowlv[y][1] - 0.5, x, y))
    for x in range(2, W - 2):                                     # 아래 때(물 흘린 자국, 세로로 짧게)
        if H(x, 0, 33) < 0.12:
            c.VL(x, 37, 2, VERM[3])
    for y in range(20, 39):
        cols, lv = rowlv[y]
        c.P(2, y, cols[max(0, lv - 1)]); c.P(W - 3, y, cols[min(len(cols) - 1, lv + 1)])
    c.VL(1, 20, 20, OL); c.VL(W - 2, 20, 20, OL)

    def pane(x, y, w, h, seed):
        for j in range(h):
            for i in range(w):
                c.P(x + i, y + j, pick(GLASS, 1.4 + j * 0.55 + (H(x, seed, 2) - 0.5) * 0.6, x + i, y + j))
        line(c, x + 1, y + h - 2, x + min(w - 1, 3), y, GLASS[0])
        if w > 4:
            c.P(x + 4, y, GLASS[1]); c.P(x + w - 1, y + h - 1, GLASS[5])
    for cx0 in (3, W - 9):                                       # 운전실 옆창
        pane(cx0, 24, 6, 6, cx0)
    ball(c, 3, 34.5, 1.5, RED[1:], ry=1.8)                         # 미등
    ball(c, W - 3.5, 34.5, 1.5, [K('shiro', 2), K('kii', 2), K('kii', 1), K('kii', 0)], ry=1.8)
    for wx in (23, 34, 45, 56, 67, 78, 89):                      # 2단 유닛 창
        vgrad(c, wx - 1, 23, 9, 8, STEEL, 1.0, 3.5)
        pane(wx, 24, 7, 3, wx); pane(wx, 28, 7, 2, wx + 1)
        c.HL(wx, 27, 7, STEEL[1])
    c.R(63, 33, 8, 3, W_PAINT[1]); c.HL(64, 34, 6, K('sora', 0)); c.HL(63, 35, 8, W_PAINT[3])   # 행선판(무늬 없음)
    c.R(99, 25, 4, 3, K('midori', 1)); c.HL(99, 25, 4, K('midori', 2)); c.HL(99, 27, 4, K('midori', 0))
    for dx in (11, 105):                                         # 폴딩 승강문
        for y in range(22, 38):                                   # 문짝은 차체보다 한 단 들어가 어둡다(줄마다 한 색)
            cols, lv = rowlv[y]
            c.HL(dx, y, 9, cols[min(len(cols) - 1, lv + 1)])
        c.HL(dx, 24, 9, CREAM[0])
        c.VL(dx, 22, 16, VERM[3]); c.VL(dx + 8, 22, 16, VERM[3])
        c.VL(dx + 4, 22, 16, K('tekko', -1)); c.VL(dx + 5, 22, 16, VERM[1])
        pane(dx + 1, 24, 3, 6, dx); pane(dx + 5, 24, 3, 6, dx + 3)
        c.HL(dx + 1, 36, 7, STEEL[1]); c.HL(dx + 1, 37, 7, STEEL[4])
    # 하부: 언더프레임 → 기기함 → 대차(강철 바퀴 공 명암) → 배장기
    vgrad(c, 2, 39, W - 4, 3, STEEL, 2.6, 5.0); c.HL(2, 39, W - 4, STEEL[2])
    vgrad(c, 4, 41, 6, 4, STEEL, 2.0, 3.6); vgrad(c, W - 10, 41, 6, 4, STEEL, 2.0, 3.6)
    for (ux, uw) in ((42, 16), (62, 14), (80, 10)):
        vgrad(c, ux, 41, uw, 3, STEEL, 2.6, 4.0); c.HL(ux + 1, 42, uw - 2, STEEL[2])
    for bx in (16, 30, 94, 108):
        c.R(bx - 4, 41, 9, 4, K('tairu', -2))
        for wx in (bx - 2, bx + 2):
            ball(c, wx, 43, 1.6, STEEL[1:], ry=1.6)
    c.HL(14, 41, 19, STEEL[3]); c.HL(92, 41, 19, STEEL[3])
    c.HL(2, 45, W - 4, OL); c.HL(3, 46, W - 6, K('tairu', -2))
    tint_outlines(c)


def _bike_tube(c, x0, y0, x1, y1, hi, mid, lo):
    """2px 관: 위 줄 밝음(빛 왼쪽 위), 아래 줄 그늘. 기울기에 상관없이 아래쪽에 그늘 1px."""
    n = max(abs(x1 - x0), abs(y1 - y0), 1)
    for i in range(n + 1):
        x = round(x0 + (x1 - x0) * i / n); y = round(y0 + (y1 - y0) * i / n)
        c.P(x, y + 1, lo)
    for i in range(n + 1):
        x = round(x0 + (x1 - x0) * i / n); y = round(y0 + (y1 - y0) * i / n)
        c.P(x, y, mid if (i % 5) else hi)


def _bike_wheel(c, cx, cy, r):
    """옆에서 본 바퀴(동서 면): 검은 고무 고리 2px(위 트레드 밝은 점·아래 접지 깊게) → 은색 림 1px → 듬성한 살 → 허브. 고리 안은 비어 풀밭이 보인다."""
    for y in range(int(cy - r - 1), int(cy + r + 2)):
        for x in range(int(cx - r - 1), int(cx + r + 2)):
            d = math.hypot(x - cx, y - cy)
            if r - 1.6 < d <= r + 0.5:
                top = (y - cy) / r
                c.P(x, y, RUBBER[1] if top < -0.8 else RUBBER[2] if top < 0.3 else RUBBER[3])
            elif r - 2.5 < d <= r - 1.6:
                lt = (x - cx) + (y - cy)
                c.P(x, y, STEEL[0] if lt < -r * 0.6 else STEEL[1] if lt < r * 0.4 else STEEL[2])
    for k in range(6):                                                       # 살 6개(점선, 은회색)
        a = k * math.pi / 3 + 0.25
        for f in (0.3, 0.5, 0.68):
            x, y = round(cx + math.cos(a) * r * f), round(cy + math.sin(a) * r * f)
            c.P(x, y, CONC[2] if k % 2 else CONC[3])
    c.R(round(cx) - 1, round(cy) - 1, 2, 2, STEEL[1]); c.P(round(cx) - 1, round(cy) - 1, STEEL[0])
    c.P(round(cx) - 2, round(cy - r) + 1, RUBBER[0]); c.P(round(cx) - 1, round(cy - r) + 1, RUBBER[0])  # 트레드 빛


def _bike_fender(c, cx, cy, r, a0, a1):
    """흙받이: 바퀴 위쪽 호(은색 1px, 윗면이 빛을 받는다)."""
    for k in range(40):
        a = a0 + (a1 - a0) * k / 39
        x, y = round(cx + math.cos(a) * (r + 1.2)), round(cy + math.sin(a) * (r + 1.2))
        c.P(x, y, CONC[1] if math.sin(a) < -0.6 else CONC[3])


@kit('inaka-bicycle-parked', '세워 둔 엄마 자전거(ママチャリ) - 3/4 탑뷰, 동쪽을 본 옆모습: 한 바닥선 위 두 바퀴·파란 틀·짐받이 윗면·안장 윗면·핸들·철망 바구니 입구 윗면(2×2)', 2, 2, 'prop',
     solid=[(0, 1), (1, 1)], tags=['inaka', '자전거', 'ママチャリ'],
     rules='가게 앞·역 앞·집 처마 밑에 옆모습(앞바퀴 동쪽)으로 길과 나란히 세운다.', role='prop')
def bicycle(c, base):
    # 옆에서 본 엄마 자전거, 앞(바구니)이 동쪽. 두 바퀴는 같은 바닥 줄(y29)에 선다. 수평면(짐받이 판·안장·바구니 입구)은 위에서 본 띠로.
    hi, mid, lo = K('sora', 3), K('sora', 1), K('sora', -1)
    RW, FW, CY, R = 8, 24, 23, 6.2
    # 1) 바퀴 둘 + 흙받이
    _bike_wheel(c, RW, CY, R); _bike_wheel(c, FW, CY, R)
    _bike_fender(c, RW, CY, R, math.pi * 1.02, math.pi * 1.75)
    _bike_fender(c, FW, CY, R, math.pi * 1.2, math.pi * 1.95)
    # 2) 체인 덮개(은색 판, 위 테 밝음) → 크랭크·페달
    for x in range(RW + 1, 17):
        c.P(x, 22, STEEL[0]); c.P(x, 23, STEEL[1]); c.P(x, 24, STEEL[2])
    c.P(RW + 1, 23, STEEL[2]); c.P(16, 24, STEEL[3])
    c.R(15, 23, 2, 2, K('tekko', -1)); c.P(15, 23, STEEL[1])
    c.R(16, 26, 3, 1, RUBBER[1]); c.P(16, 27, RUBBER[3]); c.HL(17, 27, 2, RUBBER[3])
    line(c, 16, 25, 17, 26, STEEL[3])
    # 3) 틀: 뒤 포크(허브→안장 기둥), 낮게 처진 앞 관(바닥 축→머리관), 안장 기둥, 앞 포크
    _bike_tube(c, RW + 1, CY - 1, 12, 15, hi, mid, lo)                      # 뒤 지지대
    _bike_tube(c, 13, 15, 15, 23, hi, mid, lo)                             # 안장 기둥 관
    for i, (x, y) in enumerate(((15, 22), (16, 22), (17, 21), (18, 20), (19, 18), (20, 16), (21, 14))):   # 처진 아래 관(엄마 자전거)
        c.P(x, y, mid if i % 3 else hi); c.P(x, y + 1, lo); c.P(x + 1, y + 1, lo if y < 21 else mid)
    c.VL(21, 12, 4, hi); c.VL(22, 12, 4, mid); c.P(22, 16, lo)              # 머리관
    line(c, 22, 16, FW, CY - 1, mid); line(c, 23, 16, FW + 1, CY - 1, lo)   # 앞 포크
    # 4) 받침대(뒤 허브 → 땅)
    line(c, RW, CY + 1, RW - 2, 29, STEEL[2]); c.P(RW - 3, 29, STEEL[3])
    # 5) 짐받이: 뒷바퀴 위 납작한 판(위에서 본 3줄: 먼 레일·살·가까운 레일) + 다리
    for x in range(2, 12):
        c.P(x, 13, STEEL[1])                                                 # 먼 레일
        if x % 3 == 2:
            c.P(x, 14, STEEL[2])                                             # 가로 살(사이는 비어 바퀴가 보인다)
        c.P(x, 15, STEEL[0] if x < 9 else STEEL[1]); c.P(x, 16, STEEL[3])    # 가까운 레일(윗면 빛 + 아래 그늘)
    line(c, 3, 17, RW - 1, CY - 2, STEEL[3]); line(c, 10, 17, RW + 1, CY - 2, STEEL[3])
    # 6) 안장: 위에서 본 검은 쿠션 윗면 2줄(왼쪽 빛) + 앞 테 그늘 1줄 + 기둥
    for x, y, col in ((11, 9, RUBBER[1]), (12, 9, RUBBER[0]), (13, 9, RUBBER[1]), (14, 9, RUBBER[1]),
                      (10, 10, RUBBER[1]), (11, 10, RUBBER[0]), (12, 10, RUBBER[1]), (13, 10, RUBBER[1]), (14, 10, RUBBER[2]), (15, 10, RUBBER[2]),
                      (10, 11, RUBBER[3]), (11, 11, RUBBER[3]), (12, 11, RUBBER[3]), (13, 11, RUBBER[3]), (14, 11, RUBBER[3]), (15, 11, RUBBER[3])):
        c.P(x, y, col)
    c.P(11, 9, STEEL[2])
    c.VL(13, 12, 3, STEEL[1]); c.VL(14, 12, 3, STEEL[3])
    # 7) 핸들: 기둥 → 뒤로 휜 막대(위에서 보면 먼 손잡이가 위, 가까운 손잡이가 아래)
    c.VL(21, 9, 3, STEEL[1]); c.VL(22, 9, 3, STEEL[3])
    line(c, 21, 9, 18, 8, STEEL[1]); line(c, 21, 10, 18, 11, STEEL[2])
    c.HL(16, 7, 3, RUBBER[1]); c.P(16, 7, RUBBER[0])                         # 먼 손잡이
    c.HL(16, 11, 3, RUBBER[2]); c.P(16, 12, RUBBER[3])                       # 가까운 손잡이
    c.P(19, 9, K('kii', 2)); c.P(20, 9, K('kii', 0))                        # 벨
    # 8) 철망 바구니: 위에서 본 입구(먼 테 1·안 4·가까운 테 1) → 남쪽 앞면 철망 4줄
    X0, X1 = 22, 30
    for x in range(X0, X1 + 1):
        c.P(x, 4, STEEL[0] if x < X1 else STEEL[1])
        for y in range(5, 9):
            c.P(x, y, K('tekko', -1) if (x + y) % 2 else K('tekko', -2))
        c.P(x, 9, STEEL[0] if x < 27 else STEEL[1])
        for y in range(10, 14):
            mesh = (x - X0) % 2 == 0 or y == 12
            c.P(x, y, STEEL[1] if mesh and x < 26 else STEEL[2] if mesh else K('tekko', -2))
        c.P(x, 14, STEEL[3])
    c.VL(X0, 5, 4, STEEL[0]); c.VL(X1, 5, 4, STEEL[2])
    # 바구니 속 장바구니(파 잎 끝 + 주황 꾸러미, 위에서 본 덩이)
    for x, y, col in ((24, 6, K('daidai', 3)), (25, 6, K('daidai', 1)), (24, 7, K('daidai', 1)), (25, 7, K('daidai', 0)),
                      (26, 7, K('daidai', 0)), (27, 6, K('midori', 2)), (28, 5, K('midori', 2)), (28, 6, K('midori', 0)),
                      (29, 5, K('midori', 0)), (27, 7, K('midori', 0))):
        c.P(x, y, col)
    line(c, 22, 14, 21, 12, STEEL[3])                                        # 바구니 받침
    # 9) 틀·안장·바구니 둘레만 어두운 남색 윤곽(바퀴 고리 안은 비워 둔다)
    ink = K('kon', -2)
    a = c.a
    out = []
    for y in range(c.h):
        for x in range(c.w):
            if a[y, x, 3]:
                continue
            for dy, dx in ((-1, 0), (0, -1), (0, 1), (1, 0)):
                yy, xx = y + dy, x + dx
                if 0 <= yy < c.h and 0 <= xx < c.w and a[yy, xx, 3]:
                    k = (int(a[yy, xx, 0]) << 16) | (int(a[yy, xx, 1]) << 8) | int(a[yy, xx, 2])
                    if k in (STEEL[0], STEEL[1], STEEL[2], K('tekko', -1), K('tekko', -2), RUBBER[0], RUBBER[1], RUBBER[2]) and (x >= 21 and y <= 15 or 9 <= x <= 16 and 9 <= y <= 13 or 1 <= x <= 12 and y == 12):
                        out.append((x, y)); break
    for x, y in out:
        c.P(x, y, ink)
    ground_shadow(c, RW - 5, RW + 6, 30, 2, SHADOW, 1)
    ground_shadow(c, FW - 5, FW + 6, 30, 2, SHADOW, 1)


# ═══════════════════════════ 전봇대·거리 소품 ═══════════════════════════
def _ell_fill(c, cx, cy, rx, ry, fn):
    """타원 안 화소마다 fn(x, y, u, v) 색(None 이면 건너뜀)."""
    for y in range(int(cy - ry - 1), int(cy + ry + 2)):
        for x in range(int(cx - rx - 1), int(cx + rx + 2)):
            u, v = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
            if u * u + v * v <= 1.0:
                col = fn(x, y, u, v)
                if col is not None:
                    c.P(x, y, col)


@kit('inaka-wooden-pole-transformer', '나무 전봇대와 변압기 - 위쪽 3/4: 완목 윗면(넓게)·애자·기둥 머리 둥근 윗면·변압기 통 뚜껑 타원 윗면·원통 몸(1×3)', 1, 3, 'column',
     solid=[(0, 2)], tags=['inaka', '전봇대', '電柱', '변압기'],
     rules='시골길 가장자리에 6~8칸 간격. 길 쪽 칸만 막힌다.', role='prop')
def wooden_pole(c, base):
    # 1×3(16×48). 기둥(x4..7)이 꼭대기 작은 타원 갓판까지 이어지고, 그 아래 양 끝이 둥글게 닫힌 완목(윗면 4줄 + 앞 2줄)·애자,
    # 변압기 통은 기둥 오른쪽에 매단다(타원 뚜껑 + 원통 몸). 맨 아래 근가.
    PX = 4
    # 1) 방부 나무 기둥(원통 명암 + 갈라짐)
    cyl(c, PX, 2, 4, 43, CEDAR, add=0.3, grain=1.0, seed=8)
    for y in range(30, 43, 6):
        c.P(PX + 1, y, J('aged_cedar', 0)); c.P(PX + 1, y + 1, J('aged_cedar', 1))
    for y in range(31, 38, 4):                                       # 발판 볼트(왼쪽)
        c.P(PX - 1, y, STEEL[1]); c.P(PX - 1, y + 1, STEEL[4])
    for y in range(38, 43):                                          # 노랑·검정 사선 표지 커버
        for x in range(PX, PX + 4):
            lv = cyl_lv((x - PX + 0.5) / 4 * 2 - 1, 4)
            cols = [K('kii', 2), K('kii', 1), K('kii', 0), K('kii', -1)] if ((x + y) // 2) % 2 else RUBBER
            c.P(x, y, pick(cols, lv, x, y))
    # 근가 콘크리트: 타원 윗면 + 앞면
    _ell_fill(c, 6, 45.0, 4.0, 1.6, lambda x, y, u, v: CONC[0] if u + v < -0.3 else CONC[1])
    cyl(c, PX, 42, 4, 3, CEDAR, add=0.6)
    for x in range(2, 10):
        c.P(x, 46, pick(CONC, cyl_lv((x - 1.5) / 8 * 2 - 1, 6) + 1.2, x, 46))
        c.P(x, 47, CONC[4])
    # 2) 기둥 꼭대기 작은 타원 갓판(가장 넓은 줄 위아래로 좁아진다): 밝은 윗면 + 앞 테 1줄
    def cap(x, y, u, v):
        if v > 0.45:
            return STEEL[3] if u > 0 else STEEL[2]
        return CONC[0] if u + v < -0.3 else CONC[1]
    _ell_fill(c, 6.0, 1.9, 3.2, 1.9, cap)
    c.HL(PX, 4, 4, CEDAR[4])                                         # 갓판 밑 그늘
    # 3) 완목(x2..13): 양 끝이 둥근 판 — 윗면 4줄(왼쪽 빛, 길이 방향 결) → 앞 마구리 2줄
    X0, X1, T0 = 2, 13, 7
    for y in range(T0, T0 + 6):
        for x in range(X0, X1 + 1):
            if (x in (X0, X1)) and y in (T0, T0 + 5):
                continue                                             # 둥근 모서리
            if y < T0 + 4:
                lv = 0.1 + (x - X0) / (X1 - X0) * 0.9 + (y - T0) * 0.2 + (0.6 if (x * 3 + y * 5) % 11 == 0 else 0)
                if x == X0:
                    lv -= 0.3
                col = pick(CEDAR, lv, x, y)
            else:
                col = CEDAR[3] if y == T0 + 4 else CEDAR[5]
            c.P(x, y, col)
    c.HL(X0 + 1, T0, X1 - X0 - 1, CEDAR[0])
    line(c, PX + 4, T0 + 6, PX + 6, T0 + 8, STEEL[3])                # 완금 받침(오른쪽)
    line(c, PX - 1, T0 + 6, PX - 2, T0 + 7, STEEL[3])
    # 4) 애자 셋(완목 윗면 위에 앉은 흰 사기: 둥근 윗면 → 그늘 밑동)
    for x in (3, 10):
        c.P(x, 5, W_PAINT[0]); c.P(x + 1, 5, W_PAINT[2])
        c.P(x, 6, W_PAINT[3]); c.P(x + 1, 6, W_PAINT[4])
        c.P(x + 1, 7, W_PAINT[5])
    # 5) 변압기 통(x7..14, 기둥 오른쪽에 매달림): 매단 쇠띠 → 원통 몸 → 밑 호 → 타원 뚜껑 + 부싱
    BODY = [K('tekko', 3), K('tekko', 2), K('tekko', 1), K('tekko', 0), K('tekko', -1), K('tekko', -2)]
    TX, TW, TOP, BOT = 7, 8, 20, 28
    for yy in (21, 26):                                              # 매단 쇠띠(기둥을 감는다)
        c.HL(PX, yy, 4, STEEL[3]); c.P(PX, yy, STEEL[2])
    band = (1, 0, 1, 1, 2, 2, 3, 4)
    for y in range(TOP, BOT + 2):
        for x in range(TX, TX + TW):
            u = (x + 0.5 - TX) / TW * 2 - 1
            if y > BOT and (y - BOT) > 1.6 * math.sqrt(max(0.0, 1 - u * u)):
                continue
            i = band[x - TX] + (1 if y in (23, 26) else 0) + (1 if y >= BOT else 0)
            c.P(x, y, BODY[min(5, i)])
    c.P(9, 24, K('soil', 0)); c.P(9, 25, K('soil', 0)); c.P(12, 24, K('soil', 0))
    CXT, CYT, RXT, RYT = 11.0, 19.6, 4.0, 2.6
    def lid(x, y, u, v):
        if u * u + v * v > 0.55:
            return CONC[3] if v > 0.1 else CONC[1]
        return K('shiro', 2) if u + v < -0.4 else CONC[0] if u + v < 0.4 else CONC[1]
    _ell_fill(c, CXT, CYT, RXT, RYT, lid)
    for x in range(TX, TX + TW):                                     # 뚜껑 앞 테 밑 그늘 턱
        u = (x + 0.5 - CXT) / RXT
        if abs(u) < 1:
            c.P(x, round(CYT + RYT * math.sqrt(1 - u * u)), BODY[4])
    c.P(10, 18, W_PAINT[0]); c.P(10, 19, W_PAINT[4]); c.P(12, 18, W_PAINT[1]); c.P(12, 19, W_PAINT[5])   # 부싱
    line(c, 10, 17, 8, 11, STEEL[4])                                 # 인입선(부싱 → 완목)
    finish(c, [(1, 12, 47, 1, SHADOW, 1)])


@kit('inaka-roadside-mirror', '커브 볼록거울(カーブミラー) - 위쪽 3/4: 거울 위 두꺼운 차양 윗면·눌린 둥근 거울·주황 기둥(1×2)', 1, 2, 'column',
     solid=[(0, 1)], tags=['inaka', '커브거울', 'カーブミラー'],
     rules='시골 굽은길·교차로 모서리.', role='prop')
def roadside_mirror(c, base):
    cyl(c, 6, 14, 3, 15, ORANGE, add=0.4)                            # 주황 원통 기둥
    speck(c, 6, 24, 3, 5, K('daidai', -2), 0.15, 5)
    c.HL(4, 28, 8, CONC[0]); vgrad(c, 4, 29, 8, 2, CONC, 1.5, 3.2)   # 받침(윗면 + 앞면)
    c.R(7, 13, 2, 2, STEEL[3])
    # 둥근 테 + 볼록 거울(세로로 눌린 타원: 위로 기울어 하늘을 본다)
    cx, cy, rx, ry = 8, 8.5, 6.2, 4.8
    for y in range(3, 15):
        for x in range(1, 15):
            u, v = (x - cx) / rx, (y - cy) / ry
            d = math.hypot(u, v)
            if d > 1:
                continue
            if d > 0.8:
                c.P(x, y, pick(ORANGE, 0.6 + (u + v) * 1.5, x, y))
            else:
                cols = GLASS if v < 0.15 else [K('conc', 2), K('conc', 1), K('conc', 0), K('tekko', 0), K('tekko', -1)]
                lv = 0.8 + v * 2.0 + u * 0.6 if v < 0.15 else (v - 0.15) * 4 + u * 0.4
                c.P(x, y, pick(cols, lv, x, y))
    line(c, 5, 8, 7, 6, GLASS[0]); c.P(5, 7, K('shiro', 2))
    c.HL(4, 10, 8, K('ki', 0))
    # 차양: 거울 위를 덮는 반달 판의 두꺼운 윗면(4줄, 왼쪽 빛) → 앞 테 1줄
    for y in range(0, 5):
        for x in range(2, 14):
            u, v = (x - 8) / 6.0, (y - 4.2) / 4.2
            if u * u + v * v > 1 or y > 4:
                continue
            c.P(x, y, pick(ORANGE, 0.2 + (x - 2) / 12 * 1.4 + (4 - y) * 0.1, x, y))
    c.HL(2, 4, 12, ORANGE[3]); c.HL(3, 5, 10, ORANGE[5])
    finish(c, [(4, 13, 30, 2, SHADOW, 1)])


@kit('inaka-retro-postbox-vending', '둥근 우체통과 자판기 - 위쪽 3/4: 우체통 둥근 뚜껑 타원 윗면·원통 몸·자판기 넓은 윗면(통풍 틈)·짧은 앞면 진열(2×2)', 2, 2, 'structure',
     solid=[(0, 1), (1, 1)], tags=['inaka', '우체통', '자판기', '丸ポスト'],
     rules='가게·버스 정류장 옆 길가.', role='prop')
def postbox_vending(c, base):
    # 위쪽 3/4: 화면 y = 31 - 0.5·높이 z - 북쪽 깊이 n. 윗면은 깊이 그대로, 높이는 반으로 눌린다.
    def Y(z, n):
        return 31 - 0.5 * z - n
    # 1) 자판기(x14~30, n1~10, z0~26): 넓은 윗면(통풍 틈 줄) → 짧은 앞면(머리 색띠·진열창·단추·꺼내는 곳)
    X0, X1 = 14, 30
    ty0, ty1 = round(Y(26, 10)), round(Y(26, 1))
    for y in range(ty0, ty1 + 1):
        for x in range(X0, X1 + 1):
            lv = 0.2 + (x - X0) / 16 * 1.1 + (y - ty0) * 0.06 + (0.9 if (y - ty0) % 3 == 1 and X0 + 3 <= x <= X1 - 3 else 0)
            c.P(x, y, pick(VCW, lv, x, y))
    c.HL(X0, ty0, X1 - X0 + 1, VCW[0]); c.VL(X1, ty0, ty1 - ty0 + 1, VCW[3])
    fy0, fy1 = ty1 + 1, round(Y(0, 1))
    for y in range(fy0, fy1 + 1):
        for x in range(X0, X1 + 1):
            c.P(x, y, pick(VCW, 1.4 + (y - fy0) * 0.12 + (x - X0) / 16 * 0.4, x, y))
    c.VL(X0, fy0, fy1 - fy0 + 1, VCW[0]); c.VL(X1, fy0, fy1 - fy0 + 1, VCW[4])
    hgrad(c, X0 + 1, fy0, X1 - X0 - 1, 2, [K('sora', 2), K('sora', 1), K('sora', 0), K('sora', -1)], 0.2, 2.5)   # 머리 색띠
    vgrad(c, X0 + 2, fy0 + 2, X1 - X0 - 3, 6, GLASS, 3.4, 5.0)                                                # 진열창
    for k, col in enumerate(('aka', 'sora', 'kii', 'midori', 'daidai', 'aka')):
        x = X0 + 3 + (k % 3) * 4; y = fy0 + 3 + (k // 3) * 3
        c.P(x, y, K(col, 2)); c.P(x + 1, y, K(col, 0)); c.P(x, y + 1, K(col, 1)); c.P(x + 1, y + 1, K(col, -1))
    line(c, X0 + 3, fy0 + 7, X0 + 6, fy0 + 2, GLASS[1])
    for x in range(X0 + 3, X1 - 2, 2):                                                                          # 단추 줄
        c.P(x, fy0 + 9, K('kii', 1))
    c.R(X1 - 4, fy0 + 9, 2, 2, STEEL[2])                                                                       # 동전 투입구
    vgrad(c, X0 + 3, fy1 - 2, X1 - X0 - 7, 2, RUBBER, 1.0, 3.0); c.HL(X0 + 3, fy1 - 3, X1 - X0 - 7, STEEL[1])   # 꺼내는 곳
    speck(c, X0 + 1, fy1 - 3, X1 - X0 - 1, 3, VCW[4], 0.1, 22)
    # 2) 둥근 우체통(x2~12, 축 n5, z0~24): 원통 몸(왼쪽 빛) → 둥근 뚜껑 타원 윗면(가운데 높은 돔 빛) → 투입구·흰 안내판
    cx, nc, R = 7, 5, 5.0
    top_c = Y(24, nc)
    for y in range(round(top_c), round(Y(0, nc - R)) + 1):
        for x in range(2, 13):
            u = (x - cx) / R
            if abs(u) > 1:
                continue
            yb = Y(0, nc - R * math.sqrt(1 - u * u))
            if y > yb:
                continue
            c.P(x, y, pick(RED, cyl_lv(u, 6) * 0.8 + 1.5 + (0.8 if y > yb - 2 else 0), x, y))
    for y in range(round(top_c - R) - 1, round(top_c + R) + 2):                                               # 뚜껑 타원 윗면 + 돔
        for x in range(1, 14):
            u, v = (x - cx) / (R + 0.6), (y - top_c) / (R * 0.95)
            d = u * u + v * v
            if d > 1:
                continue
            if d > 0.8 and v > 0.1:
                c.P(x, y, RED[4] if d > 0.9 else RED[3])                # 뚜껑 앞 테(몸통과 갈라지는 그늘 턱)
                continue
            lv = 0.0 + (u + v) * 1.3 + d * 0.5
            c.P(x, y, pick(RED, lv, x, y))
    c.P(cx - 2, round(top_c) - 2, K('daidai', 2)); c.P(cx - 1, round(top_c) - 2, RED[0]); c.P(cx - 2, round(top_c) - 1, RED[0])
    c.P(cx, round(top_c), RED[3]); c.P(cx + 1, round(top_c), RED[4])                                        # 꼭지
    ys = round(top_c + R) + 2
    c.HL(4, ys, 6, RUBBER[2]); c.HL(4, ys + 1, 6, RED[1])                                                   # 투입구
    vgrad(c, 5, ys + 3, 4, 3, W_PAINT, 0.4, 2.0); c.HL(5, ys + 4, 4, RED[3])                                 # 흰 안내판
    speck(c, 2, ys + 5, 10, 4, RED[5], 0.12, 21)
    finish(c, [(2, 31, 30, 2, SHADOW, 1)])


@kit('inaka-unmanned-veg-stand', '무인 채소 판매대(無人販売所) - 깊게 기운 片流れ 널판 차양 윗면·진열대 상판 위 바구니 채소·요금 통(2×3)', 2, 3, 'structure',
     solid=[(0, 1), (1, 1), (0, 2), (1, 2)], tags=['inaka', '무인판매', '野菜', '채소'],
     rules='밭 옆 길가. 앞 1칸에서 산다.', role='prop')
def veg_stand(c, base):
    # 투영: 화면 y = 46 - 높이 z - 북쪽 깊이 n
    def Y(z, n):
        return round(46 - z - n)
    # 1) 기둥 넷(먼 기둥은 진열대 뒤로 짧게, 가까운 기둥은 땅까지)
    for (x, n, add) in ((3, 13, 1.4), (27, 13, 2.0)):
        cyl(c, x, Y(30, n), 2, Y(10, n) - Y(30, n), CEDAR, add=add)
    # 2) 진열대: 상판 윗면(n2~12, z10, 가로 널 결·왼쪽 빛·차양 그늘은 뒤쪽) → 앞면 널(z0~10)
    for n in range(1, 14):
        y = Y(10, n)
        for x in range(2, 30):
            lv = 0.5 + (x - 2) / 28 * 0.8 + (H(x // 6, n, 19) - 0.5) * 0.6 + (1.3 if n % 4 == 2 else 0)
            lv += max(0, n - 7) * 0.3                                   # 차양 밑 깊은 쪽은 그늘
            c.P(x, y, pick(CEDAR, lv, x, y))
    for x in range(2, 30):
        c.P(x, Y(10, 1), CEDAR[0])
    for y in range(Y(10, 1) + 1, Y(0, 1) + 1):
        for x in range(2, 30):
            lv = 2.4 + (y - Y(10, 1)) * 0.18 + (H(x // 5, 0, 20) - 0.5) * 0.9 + (1.4 if (x - 2) % 5 == 0 else 0)
            c.P(x, y, pick(CEDAR, lv, x, y))
    c.HL(2, Y(10, 1) + 1, 28, CEDAR[4])
    # 3) 상판 위 엮은 바구니 셋(테 윗면 타원 + 안에 담긴 채소 공)
    tomato = RED[1:]
    eggplant = [K('murasaki', 1), K('murasaki', 0), K('murasaki', -1), K('kon', -1), K('kon', -2)]
    for (cx, kind) in ((7.5, 'tomato'), (15.5, 'cuke'), (23.0, 'egg')):
        cy = Y(10, 5) + 0.5
        for y in range(int(cy) - 4, int(cy) + 5):
            for x in range(int(cx) - 5, int(cx) + 6):
                u, v = (x - cx) / 3.6, (y - cy) / 2.6
                d = math.hypot(u, v)
                if d > 1:
                    continue
                lv = 1.0 + ((x + y) % 2) * 1.4 + (u + v) * 0.6 + (0.9 if d > 0.78 else 0)
                c.P(x, y, pick(STRAW, lv, x, y))
        c.P(round(cx), round(cy) + 3, J('machiya_timber', 2)); c.HL(round(cx) - 2, round(cy) + 3, 5, STRAW[4])   # 바구니 밑 그늘
        if kind == 'tomato':
            for (bx, by) in ((-1.4, -0.6), (1.4, -0.4), (0, 0.9)):
                ball(c, cx + bx, cy + by, 1.4, tomato)
                c.P(round(cx + bx), round(cy + by) - 1, LEAF[2])
        elif kind == 'cuke':
            for k in range(3):
                ball(c, cx - 1.6 + k * 1.6, cy - 0.3 + (k % 2) * 0.6, 1.5, LEAF, ry=0.9)
        else:
            for bx in (-1.3, 1.5):
                ball(c, cx + bx, cy, 1.6, eggplant, ry=1.3)
                c.P(round(cx + bx), round(cy) - 2, LEAF[3])
    # 요금 통(상판 앞 오른쪽, 뚜껑 윗면 + 앞면)
    c.HL(26, Y(10, 4) - 3, 3, STEEL[0]); c.HL(26, Y(10, 4) - 2, 3, STEEL[1])
    vgrad(c, 26, Y(10, 4) - 1, 3, 3, STEEL, 2.0, 4.2); c.P(27, Y(10, 4) - 3, RUBBER[3])
    # 4) 가까운 기둥(땅 → 처마)
    for (x, add) in ((3, 0.4), (27, 1.0)):
        cyl(c, x, Y(25, 0), 2, Y(0, 0) - Y(25, 0), CEDAR, add=add)
    # 5) 片流れ 차양: 앞 처마 z22(n0) → 뒤 용마루 z30(n16). 널판은 비탈 따라 세로 줄, 왼쪽 빛·오른쪽 그늘
    for n in range(0, 14):
        z = 25 + n * 0.4
        y = Y(z, n)
        for yy in (y, y + 1):
            for x in range(0, 32):
                pl = x // 4
                lv = 0.4 + x / 31 * 1.3 + (H(pl, 0, 31) - 0.5) * 0.8 + (H(x, yy // 2, 33) - 0.5) * 0.5
                if x % 4 == 0:
                    lv += 1.4                                            # 널 이음 그늘
                if x % 4 == 1:
                    lv -= 0.4                                            # 널 가장자리 빛
                lv += (13 - n) * 0.03
                c.P(x, yy, pick(CEDAR, lv, x, yy))
    for x in range(0, 32):                                              # 덮개 띠(용마루 쪽) + 앞 처마 마구리
        c.P(x, Y(30.2, 13), CEDAR[0] if x < 20 else CEDAR[1])
        c.P(x, Y(25, 0) + 2, CEDAR[4])
    speck(c, 1, Y(30, 13), 30, 14, LEAF[3], 0.04, 41)             # 이끼 점
    # 6) 처마 밑 가격 종이(글자 없는 색 띠)
    vgrad(c, 6, Y(25, 0) + 3, 5, 3, W_PAINT, 0.2, 1.4)
    c.HL(7, Y(25, 0) + 4, 3, K('aka', 0)); c.VL(8, Y(25, 0) + 2, 1, STEEL[3])
    finish(c, [(2, 30, 46, 2, SHADOW, 1)])



@kit('inaka-well-handpump', '우물과 작두 펌프 - 돌 우물 테 윗면(검은 물)·초록 펌프·양동이(2×2)', 2, 2, 'water',
     solid=[(0, 1), (1, 1)], tags=['inaka', '우물', '井戸', '펌프'],
     rules='농가 마당 한쪽.', role='water')
def well_pump(c, base):
    # 왼쪽: 둥근 돌 우물 테(위에서 본 고리 윗면 + 입구 안쪽: 먼 안벽 → 검은 물 5줄) → 앞면 돌 쌓기. 오른쪽: 콘크리트 받침 위 초록 작두 펌프·양동이.
    CX, CY, RX, RY, FACE = 10.0, 12.0, 9.6, 5.2, 9
    # 1) 앞면 돌 쌓기(원통: 왼쪽 셋째 열이 밝고 양 끝으로 깊어진다, 3줄 단·엇갈린 돌·짙은 줄눈)
    for x in range(1, 20):
        u = (x + 0.5 - CX) / RX
        if abs(u) >= 1:
            continue
        yt = CY + RY * math.sqrt(1 - u * u)
        for y in range(int(yt) - 1, int(yt + FACE) + 1):
            k = y - yt
            if k < -1 or k > FACE:
                continue
            row = int((k + 3) // 3)
            jy = int(k + 3) % 3
            off = (x + row * 3) % 5
            lv = 1.6 + cyl_lv(u, 4) * 0.7 + (H((x + row * 3) // 5, row, 3) - 0.5) * 0.8
            if jy == 2 or off == 4:
                col = STONE[4]
            elif jy == 0:
                col = pick(STONE, lv - 0.8, x, y)
            else:
                col = pick(STONE, lv, x, y)
            c.P(x, y, col)
    speck(c, 1, 22, 19, 5, K('ki', -1), 0.10, 4)                    # 밑동 이끼
    # 2) 테 윗면 고리(밝은 돌, 이음 줄눈) + 입구 안쪽
    IRX, IRY = 6.6, 3.5
    def rim(x, y, u, v):
        ui, vi = (x + 0.5 - CX) / IRX, (y + 0.5 - CY) / IRY
        if ui * ui + vi * vi <= 1:
            return None
        seg = int((math.atan2(v, u) + math.pi) * 7 / math.pi)
        ang = math.atan2(v, u)
        if abs(math.sin(ang * 7 + 0.4)) < 0.12:
            return STONE[3]                                          # 돌 이음
        lv = 0.4 + (u + v) * 0.7 + (H(seg, 0, 6) - 0.5) * 0.6
        return pick(STONE, max(0.0, lv), x, y)
    _ell_fill(c, CX, CY, RX, RY, rim)
    WATER = [K('garasu', -1), K('garasu', -2), K('kon', -1), K('kon', -2)]
    def inner(x, y, u, v):
        # 먼 안벽(위 두 줄, 돌 그늘) → 물(아래), 물에 하늘 반사 한 줄
        depth = (y + 0.5 - (CY - IRY))
        if depth < 2.2:
            return STONE[4] if (x + y) % 4 else STONE[5]
        if depth < 3.0:
            return K('kon', -2)
        return pick(WATER, 1.2 + u * 0.8 + v * 0.6, x, y)
    _ell_fill(c, CX, CY, IRX, IRY, inner)
    c.HL(7, 13, 3, K('garasu', 1)); c.P(8, 14, K('garasu', 0)); c.P(12, 14, K('garasu', -1))   # 물빛
    # 테 안쪽 가까운 턱(입구 앞 가장자리 1줄, 그늘)
    for x in range(int(CX - IRX) + 1, int(CX + IRX)):
        ui = (x + 0.5 - CX) / IRX
        y = int(CY + IRY * math.sqrt(max(0.0, 1 - ui * ui)))
        c.P(x, y + 1, STONE[2])
    # 3) 콘크리트 받침: 윗면 4줄(왼쪽 빛) → 앞면 3줄
    for y in range(22, 29):
        for x in range(20, 32):
            if y < 26:
                col = pick(CONC, 0.4 + (x - 20) / 11 * 1.0 + (y - 22) * 0.1, x, y)
            else:
                col = pick(CONC, 3.0 + (y - 26) * 0.6, x, y)
            c.P(x, y, col)
    c.HL(20, 22, 12, CONC[0])
    speck(c, 20, 23, 12, 3, K('ki', -1), 0.06, 11)
    # 4) 양동이(함석): 타원 테 + 물 윗면 → 원통 몸
    for y in range(18, 25):
        for x in range(26, 31):
            c.P(x, y, [STEEL[1], STEEL[0], STEEL[1], STEEL[2], STEEL[3]][x - 26] if y > 19 else STEEL[2])
    c.HL(26, 24, 5, STEEL[4])
    _ell_fill(c, 28.5, 18.6, 2.6, 1.6, lambda x, y, u, v: (STEEL[0] if v < 0 else STEEL[2]) if u * u + v * v > 0.45 else K('sora', 1))
    c.P(28, 18, K('sora', 3))
    # 5) 초록 작두 펌프: 원통 몸 → 둥근 머리 갓(타원 윗면 4줄) → 토수구(오른쪽, 양동이 위) → 손잡이 막대
    PB = [GREEN_IRON[0], GREEN_IRON[1], GREEN_IRON[2], GREEN_IRON[4], GREEN_IRON[5]]
    for y in range(10, 24):
        for i, x in enumerate(range(22, 26)):
            c.P(x, y, PB[(1, 1, 2, 3)[i] + (1 if y == 16 and i < 3 else 0)])
    c.HL(21, 23, 6, GREEN_IRON[5])                                   # 받침 고정 테
    _ell_fill(c, 23.9, 9.0, 3.2, 2.2, lambda x, y, u, v: (GREEN_IRON[4] if v > 0.2 else GREEN_IRON[2]) if u * u + v * v > 0.5 else (GREEN_IRON[0] if u + v < 0 else GREEN_IRON[1]))
    c.P(23, 8, K('midori', 3))
    c.HL(26, 13, 3, PB[2]); c.HL(26, 14, 3, PB[4]); c.P(28, 15, PB[4])   # 토수구(윗면 밝음 + 아래 그늘·입)
    c.P(28, 16, K('sora', 2))                                        # 떨어지는 물방울
    line(c, 25, 8, 30, 3, STEEL[1]); line(c, 26, 8, 30, 4, STEEL[3])  # 손잡이
    c.P(30, 2, RUBBER[1]); c.P(31, 3, RUBBER[2])
    finish(c, [(1, 31, 29, 2, SHADOW, 1)])


@kit('inaka-fire-watchtower', '소방 망루(火の見櫓) - 3/4 탑뷰: 앞뒤·좌우로 벌어진 네 다리(발 네 개가 사다리꼴 바닥을 이룬다)·X 가새·사다리·난간 안 널마루 윗면·처마가 앞으로 나온 사각뿔 지붕(앞·좌·우 세 면)·半鐘(2×4)', 2, 4, 'structure',
     solid=[(0, 3), (1, 3)], tags=['inaka', '망루', '火の見櫓', '소방'],
     rules='마을 갈림길·소방 창고 옆. 아래 두 칸만 막힌다.', role='building')
def watchtower(c, base):
    # 밑그림: scripts/content/jp-city/inaka/box_underdraw.py watchtower (같은 기본형·같은 치수)
    S = _S3(c, 62)
    cx, cy, G, T, DZ = 16.0, 13.0, 13.0, 7.0, 30.0
    corners = ((-1, -1), (1, -1), (1, 1), (-1, 1))

    def at(sx_, sy_, zz):
        g = G + (T - G) * zz / DZ
        return _v(cx + sx_ * g, cy + sy_ * g, zz)
    for (a, b) in corners:
        S.rod('leg', at(a, b, 0), at(a, b, DZ), 1.0)
        S.box('foot', _v(cx + a * G - 2, cy + b * G - 2, 0), _v(4, 0, 0), _v(0, 4, 0), _v(0, 0, 1.5))
    for k in range(4):
        a, b = corners[k], corners[(k + 1) % 4]
        for (za, zb) in ((2, 15), (15, 29)):
            if k != 2:                                                       # 먼(북) 면 가새는 그리지 않는다(앞 격자와 겹쳐 뭉개진다)
                S.rod('brace', at(*a, za), at(*b, zb), 0.45); S.rod('brace', at(*b, za), at(*a, zb), 0.45)
            S.rod('ring', at(*a, zb), at(*b, zb), 0.5)
    for w in (-2.5, 2.5):
        S.rod('ladder', _v(cx + w, cy - G + 1.5, 0), _v(cx + w, cy - T - 0.5, DZ), 0.45)
    D = 9.0
    S.box('deck', _v(cx - D, cy - D, DZ), _v(2 * D, 0, 0), _v(0, 2 * D, 0), _v(0, 0, 2))
    for (p0, e) in ((_v(cx - D, cy - D, DZ + 5.5), _v(2 * D, 0, 0)), (_v(cx - D, cy + D - 0.6, DZ + 5.5), _v(2 * D, 0, 0))):
        S.box('rail', p0, e, _v(0, 0.6, 0), _v(0, 0, 0.8))
    for (p0, e) in ((_v(cx - D, cy - D, DZ + 5.5), _v(0, 2 * D, 0)), (_v(cx + D - 0.6, cy - D, DZ + 5.5), _v(0, 2 * D, 0))):
        S.box('rail', p0, _v(0.6, 0, 0), e, _v(0, 0, 0.8))
    for (a, b) in corners:
        S.rod('post', _v(cx + a * (D - 1), cy + b * (D - 1), DZ + 2), _v(cx + a * (D - 1), cy + b * (D - 1), 42), 0.55)
    S.cyl('bell', _v(cx, cy, 36.5), _v(0, 0, 1), 1.8, 3.0)
    E = 11.0
    S.pyramid('roof', [_v(cx + a * E, cy + b * E, 42) for (a, b) in corners], _v(cx, cy, 51))

    def paint(nm, n, u, v, x, y, e):
        part, face = (nm.split('.') + [''])[:2]
        lv = _lv3(n)
        if part == 'roof':                                                    # 0 앞(남) · 1 오른(동) · 3 왼(서)
            k = int(face)
            t = u / max(0.05, 1 - v)                                          # 처마 위치 0..1 → 꼭지로 모이는 함석 골
            rib = int(t * 9 + 0.5) % 2 == 0 and v < 0.85
            lip = v < 0.07
            if lip:
                return STEEL[0] if k != 1 else STEEL[3]                       # 처마 끝 밝은 테
            base_lv = {0: 2, 1: 4, 2: 4, 3: 1}[k]
            return pick(STEEL, base_lv + (-1 if rib else 0) + (1 if e else 0), x, y)
        if part == 'bell':
            return pick(BRONZE, 0.6 + lv * 0.8, x, y)
        if part == 'deck':
            if face == 'top':
                plank = (v % 3.0) < 0.75                                      # 동서로 놓인 널, 남북으로 이음
                return pick(CEDAR, 0.6 + u / 18 * 0.7 + (1.3 if plank else 0) + (H(int(u // 6), int(v // 3), 9) - 0.5) * 0.6, x, y)
            return pick(TIMBER, 1.6 + lv * 0.4 + (0.8 if e else 0), x, y)
        if part == 'foot':
            return pick(CONC, 0.4 + lv * 0.9, x, y)
        if part == 'ladder':
            return pick(STEEL, 1.4 + lv * 0.8, x, y)
        if part in ('leg', 'post'):
            if H(x, y, 40) < 0.07:
                return K('daidai', -2)                                        # 녹
            return pick(RED, 1.2 + lv * 0.9 + (0.7 if e else 0), x, y)
        if part == 'rail':
            return RED[2] if face == 'top' else RED[3]
        if part == 'ring':
            return pick(RED, 2 + round(lv * 0.5), x, y)
        if part == 'brace':
            return pick(RED, 2.6 + lv * 0.5, x, y)
        return pick(RED, 2.0, x, y)
    S.paint(paint)
    # 사다리 디딤대(남쪽 면, 두 기둥 사이 3줄 간격)
    for zz in range(3, int(DZ), 3):
        f = zz / DZ
        yy = cy - G + 1.5 + (-T - 0.5 + G - 1.5) * f
        x0, y0 = S.at(_v(cx - 2.5, yy, zz)); x1, _ = S.at(_v(cx + 2.5, yy, zz))
        for x in range(x0 + 1, x1):
            if S.depth[y0, x] > yy - _C3 * zz - 0.5:
                c.P(x, y0, STEEL[1] if x < x0 + 3 else STEEL[2])
    tx, ty = S.at(_v(cx, cy, 51.4))                                           # 꼭지 장식
    c.P(tx, ty, RED[1]); c.P(tx, ty - 1, RED[2])
    _outline_outside(c, soft=False)
    S.contact_shadow(SHADOW)


# ═══════════════════════════ 논·밭 소품 ═══════════════════════════
STALK = [J('lantern_amber', 4), J('lantern_amber', 3), J('lantern_amber', 2), J('lantern_amber', 1), J('lantern_amber', 0)]
EAR = [K('kii', 2), K('kii', 1), K('kii', 0), K('kii', -1), K('kii', -2)]
GAP = J('machiya_timber', 2)                                      # 다발 사이 틈: 검정이 아니라 짙은 갈색


def straw_bundle(c, x, y, L, seed=0):
    """매달린 볏단(はさ掛け) 하나: 가로대 위로 나온 줄기 끝 → 목(3px) → 몸(5px, 세로 짚 결: 빛 가닥·그늘 가닥, 왼쪽 빛·오른쪽 그늘)
    → 열마다 길이가 다르고 바깥으로 벌어지는 이삭 끝(진한 금빛 + 낟알 점, 들쭉날쭉한 실루엣)."""
    for dx in (-1, 0, 1):                                         # 가로대 위 줄기 끝(자른 단면)
        if H(x + dx, 2, seed) < 0.8:
            c.P(x + dx, y - 3, STALK[1 + (dx > 0)])
    for dx in range(-3, 4):
        Lc = L + int(H(x + dx, 1, seed) * 3) - (1 if abs(dx) >= 2 else 0)
        for k in range(Lc):
            if abs(dx) == 3 and k < Lc - 2:                       # 바깥 열은 맨 끝 이삭만 벌어진다
                continue
            if abs(dx) == 2 and k < 2:
                continue
            px, py = x + dx, y + k
            edge = (0, 0, 0, 1, 2, 3, 3)[dx + 3]
            if k >= Lc - 3:                                       # 이삭
                lv = edge * 0.8 + (0 if H(px, py, seed + 1) < 0.4 else 1) + (1 if k == Lc - 1 else 0)
                c.P(px, py, EAR[min(4, round(lv))])
            else:
                hs = H(px, 0, seed)
                strand = -1 if hs < 0.3 else 1 if hs > 0.62 else 0   # 빛 가닥 / 그늘 가닥
                strand += 1 if H(px, py, seed + 3) < 0.12 else 0
                lv = edge + strand + (1 if k < 2 else 0)
                c.P(px, py, STALK[max(0, min(4, lv))])
    c.HL(x - 1, y + 1, 3, J('aged_cedar', 1)); c.P(x - 1, y + 1, J('aged_cedar', 3))   # 묶은 새끼줄


def _hasagi_sheaf(c, x, yb, L, seed=0):
    """가로대(윗면 yb..yb+2, 앞 모서리 yb+3)에 걸친 볏단 하나.
    뒤 절반: 가로대 너머로 보이는 줄기 끝 다발(위에서 본 둥근 윗면, 먼 쪽이라 한 단 어둡게) →
    안장: 가로대 윗면을 가로지르는 3px 짚 고리(윗면 빛) → 앞 절반: 앞 모서리에서 늘어진 몸(어깨 윗면 빛 → 세로 짚 결,
    왼쪽 빛·오른쪽 그늘) → 묶은 새끼줄 → 벌어진 이삭 끝."""
    for yy in range(yb - 3, yb):                                  # 뒤 절반 다발(가로대 너머)
        hw = (1, 2, 2)[yy - (yb - 3)]
        for dx in range(-hw, hw + 1):
            lv = 1.3 + dx * 0.5 + (yy - (yb - 3)) * 0.4 + (0.7 if H(x + dx, yy, seed) < 0.3 else 0)
            c.P(x + dx, yy, STALK[max(0, min(4, round(lv)))])
    for yy in range(yb, yb + 4):                                  # 안장: 가로대 윗면을 덮는 짚 고리
        for dx in (-1, 0, 1):
            lv = (yy - yb) * 0.6 + dx * 0.7 + 0.2
            c.P(x + dx, yy, STALK[max(0, min(4, round(lv)))])
    top = yb + 4
    for k in range(L):                                            # 앞 절반 몸
        hw = 1 if k == 0 else 2 if k < L - 4 else 3
        y = top + k
        for dx in range(-hw, hw + 1):
            if k >= L - 4 and abs(dx) == 3 and H(x + dx, y, seed + 2) < 0.4:
                continue
            u = dx / 2.5
            if k < 2:
                lv = 0.3 + u * 1.2 + k * 0.6                      # 어깨: 위에서 받은 빛
                c.P(x + dx, y, STALK[max(0, min(4, round(lv)))])
            elif k >= L - 4:                                      # 이삭(금빛·낟알)
                lv = 1 + u * 1.5 + (k - (L - 4)) * 0.4 + (0.8 if H(x + dx, y, seed + 1) < 0.35 else 0)
                c.P(x + dx, y, EAR[max(0, min(4, round(lv)))])
            else:
                strand = -0.8 if H(x + dx, 0, seed) < 0.3 else 0.8 if H(x + dx, 0, seed) > 0.7 else 0
                lv = 1.4 + u * 1.6 + strand
                c.P(x + dx, y, STALK[max(0, min(4, round(lv)))])
    ty = top + 3                                                  # 묶은 새끼줄
    c.HL(x - 2, ty, 5, J('aged_cedar', 2)); c.P(x - 2, ty, J('aged_cedar', 3)); c.P(x + 2, ty, J('aged_cedar', 1))


@kit('inaka-rice-rack-hasagi', '볏단 걸이(はさ掛け) - 위쪽 3/4: 둥근 장대 윗면 빛·볏단 어깨 윗면 빛·앞뒤로 발이 엇갈린 A자 장대·매달린 볏단 두 단(3×2)', 3, 2, 'structure',
     solid=[(0, 1), (1, 1), (2, 1)], tags=['inaka', '하사기', 'はさ掛け', '볏단'],
     rules='가을 황금 논(inaka-paddy-golden) 논두렁 위.', role='prop')
def hasagi(c, base):
    """はさ掛け 3/4 탑뷰: X 로 엇갈린 장대 셋(끝은 둥근 자른 면이 위로 보인다) · 그 위에 얹힌 둥근 가로대(윗면 3줄 빛 + 앞 모서리)
    · 가로대를 타고 넘은 볏단(뒤 절반 다발이 가로대 너머로, 앞 절반이 늘어짐) · 앞 다리(발 y31)와 뒤 다리(발 y27)가 엇갈린 발."""
    YB = 6                                                        # 가로대 윗면 시작 줄
    posts = (5, 24, 43)

    def pole(x0, y0, x1, y1, cols):
        n = max(abs(x1 - x0), abs(y1 - y0))
        for i in range(n + 1):
            xx = round(x0 + (x1 - x0) * i / n); yy = round(y0 + (y1 - y0) * i / n)
            c.P(xx, yy, cols[0]); c.P(xx + 1, yy, cols[1])

    for x in posts:                                               # 뒤 다리(북쪽, 어둡게, 발 y27) — 볏단 뒤
        pole(x - 3, 1, x + 4, 27, (CEDAR[3], CEDAR[4]))
    # 가로대: 먼 끝 1줄 · 윗면 빛 2줄(결) · 앞 모서리 빛 · 앞면 · 밑 그늘
    for x in range(0, 48):
        g = H(x // 3, 1, 5)
        c.P(x, YB, CEDAR[1] if g < 0.6 else CEDAR[2])
        c.P(x, YB + 1, CEDAR[0])
        c.P(x, YB + 2, CEDAR[0] if H(x, 3, 6) < 0.6 else CEDAR[1])
        c.P(x, YB + 3, CEDAR[2])
        c.P(x, YB + 4, CEDAR[4])
    for x in range(7, 48, 13):                                    # 대 마디
        c.P(x, YB + 1, CEDAR[2]); c.P(x, YB + 2, CEDAR[3]); c.P(x, YB + 3, CEDAR[4])
    c.P(0, YB + 1, CEDAR[2]); c.P(0, YB + 2, CEDAR[2]); c.P(47, YB + 1, CEDAR[3]); c.P(47, YB + 2, CEDAR[3])   # 자른 끝
    xs = [x for x in range(3, 47, 6) if all(abs(x - p) > 2 for p in posts)]
    for x in range(xs[0] - 2, xs[-1] + 3):                         # 뒤 절반(북쪽으로 늘어진 몸)이 앞 볏단 사이로 어둡게 비친다
        for y in range(YB + 5, YB + 16):
            if H(x, 0, 77) < 0.5:
                col = STALK[4] if (x + y) % 3 else GAP
            else:
                col = GAP if y < YB + 7 else STALK[4]
            c.P(x, y, col)
    for k, x in enumerate(xs):
        _hasagi_sheaf(c, x, YB, 15 + (k % 3 == 1), seed=k * 7)
    for x in posts:                                               # 앞 다리(남쪽, 밝게, 발 y31) — 볏단 앞
        pole(x + 3, 1, x - 4, 31, (CEDAR[1], CEDAR[2]))
        for (cx, cy) in ((x - 3, 0), (x + 3, 0)):                 # 장대 끝: 위에서 본 둥근 자른 면
            c.P(cx, cy, CEDAR[0]); c.P(cx + 1, cy, CEDAR[1])
        c.P(x, YB - 1, CEDAR[1]); c.P(x + 1, YB - 1, CEDAR[2])     # 엇갈림 매듭(가로대를 받친다)
        c.P(x, YB + 4, J('aged_cedar', 1)); c.P(x + 1, YB + 4, J('aged_cedar', 0))
    finish(c, [(0, 48, 28, 3, SHADOW, 0)])


def _blit(c, t):
    """임시 캔버스 t 의 불투명 픽셀을 c 위에 덮는다(add_outline 을 t 에만 두르기 위해)."""
    for y in range(c.h):
        for x in range(c.w):
            if t.a[y, x, 3]:
                c.P(x, y, (int(t.a[y, x, 0]) << 16) | (int(t.a[y, x, 1]) << 8) | int(t.a[y, x, 2]))


def scarecrow(c, t, x, y, robe='noren_indigo', obi='torii_vermilion', tilt=1):
    """3/4 허수아비(t 에 그린다, 윤곽은 호출자가 두른다): 흙 둔덕(위에서 본 윗면 3줄 빛 + 앞 테 그늘) → 대나무 기둥 →
    가로 팔 막대(윗면 빛 줄 + 앞면) 양 끝에 늘어진 소매 → 기모노 몸통(왼 빛·오른 그늘, 오비) → 자루 얼굴 →
    菅笠: 위에서 내려다본 챙 타원(넓고 납작, 앞 테가 어둡다) 위에 한 단 밝은 원뿔 윗면과 꼭지. tilt 는 팔 기울기(±1 화소)."""
    RB = [J(robe, 4), J(robe, 3), J(robe, 2), J(robe, 1), J(robe, 0)]
    OB = [J(obi, 4), J(obi, 3), J(obi, 2), J(obi, 1), J(obi, 0)]
    BB = CEDAR
    # 흙 둔덕: 위에서 본 납작한 타원 윗면(밝음) + 앞 테(어두운 흙 2줄)
    my = y + 26
    for yy in range(my - 2, my + 4):
        for xx in range(x - 6, x + 6):
            u = (xx - x + 0.5) / 5.4
            v = (yy - my) / 2.2
            if u * u + v * v > 1 and not (my < yy <= my + 2 and abs(u) <= 0.9 - (yy - my) * 0.12):
                continue
            if yy <= my:                                           # 윗면
                lv = 0.5 + u * 0.9 + (yy - my + 2) * 0.35
            else:                                                  # 앞 테
                lv = 2.6 + (yy - my) * 0.5 + u * 0.4
            t.P(xx, yy, pick(SOIL, lv, xx, yy))
    t.P(x - 4, my - 1, J('moss', 3)); t.P(x - 3, my - 2, J('moss', 4)); t.P(x + 4, my, J('moss', 2)); t.P(x + 3, my - 1, J('moss', 3))
    # 기둥(둔덕 윗면에 박힘)
    for yy in range(y + 19, my + 1):
        t.P(x - 1, yy, BB[1]); t.P(x, yy, BB[3])
    t.P(x - 1, y + 23, BB[0]); t.P(x, y + 23, BB[2])               # 마디
    # 팔 막대: 윗면 빛 줄 + 앞면(약간 기움)
    ay = y + 12
    for xx in range(x - 7, x + 8):
        d = round((xx - x) * tilt / 7)
        t.P(xx, ay - 1 - d, BB[0] if xx < x else BB[1]); t.P(xx, ay - d, BB[3] if xx < x + 3 else BB[4])
    # 소매: 팔 막대 밑으로 늘어진 천(바깥 끝은 짧고 안쪽은 몸에 붙는다)
    for side in (-1, 1):
        for i in range(3):
            xx = x + side * (4 + i)
            d = round((xx - x) * tilt / 7)
            top = ay + 1 - d
            drop = 5 - (i == 2) - (i == 1 and side * tilt > 0)
            for j in range(drop):
                lv = 0.6 + (side > 0) * 1.3 + j * 0.35 + (1.4 if j == drop - 1 else 0)
                t.P(xx, top + j, pick(RB, lv, xx, top + j))
    # 몸통: 왼 빛 → 오른 그늘, 세로 주름, 밑단
    for k in range(9):
        hw = 3 if k < 7 else 2
        for dx in range(-hw, hw + 1):
            px, py = x + dx, ay + 1 + k
            lv = 1.3 + dx / 3 * 1.5 + (0.9 if k >= 7 else 0) + (0.8 if dx == 1 and k > 4 else 0)
            t.P(px, py, pick(RB, lv, px, py))
    t.P(x - 1, ay + 1, CREAM[0]); t.P(x, ay + 2, CREAM[1]); t.P(x + 1, ay + 1, CREAM[2])   # 깃(V)
    for dx in range(-3, 4):                                        # 오비
        t.P(x + dx, ay + 5, OB[1] if dx < 1 else OB[2]); t.P(x + dx, ay + 6, OB[2] if dx < 1 else OB[3])
    # 자루 얼굴
    for yy in range(y + 8, y + 12):
        for dx in range(-2, 3):
            if yy == y + 11 and abs(dx) == 2:
                continue
            t.P(x + dx, yy, CREAM[0 if dx < 0 else 1 if dx < 2 else 2])
    t.P(x - 1, y + 10, J('aged_cedar', 0)); t.P(x + 1, y + 10, J('aged_cedar', 0))
    t.HL(x - 2, y + 8, 5, CREAM[3])                                # 챙이 드리운 그늘
    # 菅笠: 챙 타원(위에서 본 면, rows y+2..y+8) — 앞 테 어둡게
    hx, hy, rx, ry = x - 0.5 + tilt * 0.5, y + 5.0, 6.6, 3.0
    for yy in range(y + 1, y + 9):
        for xx in range(x - 8, x + 9):
            u, v = (xx - hx) / rx, (yy - hy) / ry
            d = u * u + v * v
            if d > 1:
                continue
            lv = 3.0 + u * 1.0 + v * 1.0
            if d > 0.7 and v > 0.2:
                lv += 1.6                                          # 챙 앞 테(짙음)
            if (xx + yy) % 3 == 0 and d > 0.3:
                lv += 0.7                                          # 짚 결
            t.P(xx, yy, STRAW[max(1, min(7, round(lv)))])
    # 원뿔 윗면(한 단 밝음): 꼭지에서 왼쪽 위 빛
    cx, cy = hx - 0.3, hy - 0.9
    for yy in range(y + 2, y + 7):
        for xx in range(x - 5, x + 5):
            u, v = (xx - cx) / 3.6, (yy - cy) / 1.9
            d = u * u + v * v
            if d > 1:
                continue
            lv = 0.2 + (u + v) * 0.8 + d * 0.6
            t.P(xx, yy, STRAW[max(0, min(3, round(lv)))])
    t.P(round(cx), round(cy) - 1, J('aged_cedar', 2)); t.P(round(cx) - 1, round(cy), STRAW[0])   # 꼭지


def _ink_outline(c, k=0.3):
    """1px 실루엣 윤곽을 「이웃 재질을 k 배로 어둡게 한 색」으로 두른다(순흑 아님, tint_outlines 보다 짙은 선)."""
    from inaka_style import dark_tone
    a = c.a
    h, w = a.shape[:2]
    op = a[..., 3] > 0
    out = []
    for y in range(h):
        for x in range(w):
            if op[y, x]:
                continue
            votes = {}
            for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                yy, xx = y + dy, x + dx
                if 0 <= yy < h and 0 <= xx < w and op[yy, xx]:
                    kk = (int(a[yy, xx, 0]) << 16) | (int(a[yy, xx, 1]) << 8) | int(a[yy, xx, 2])
                    votes[kk] = votes.get(kk, 0) + 1
            if votes:
                nb = max(votes, key=lambda q: (votes[q], -q))
                out.append((x, y, dark_tone(nb, k)))
    for x, y, col in out:
        c.P(x, y, col)


@kit('inaka-scarecrow-pair', '허수아비 한 쌍(案山子) - 菅笠 원뿔 윗면·챙 그늘·소매 늘어진 기모노·대나무 기둥·흙 둔덕 그림자(2×2)', 2, 2, 'prop',
     solid=[(0, 1), (1, 1)], tags=['inaka', '허수아비', 'かかし'],
     rules='논 한가운데·논두렁.', role='prop')
def scarecrows(c, base):
    scarecrow(c, c, 8, 0, 'noren_indigo', 'torii_vermilion', tilt=1)
    scarecrow(c, c, 24, 1, 'torii_vermilion', 'tatami_straw', tilt=-1)
    _ink_outline(c, 0.2)
    for sh in ((3, 14, 30, 2, SHADOW, 0), (19, 30, 31, 1, SHADOW, 0)):
        ground_shadow(c, *sh)


def _sunflower_head(t, x, y, rx, ry, face=1):
    """3/4 해바라기 머리(위로 살짝 젖힌 납작 타원): 아래 초록 꽃받침 테 → 꽃잎 한 장씩(뒤쪽 짧고 어둡게, 앞쪽 길고 밝게)
    → 타원 씨앗판(씨 결 + 위쪽 빛 테)."""
    ball(t, x + 0.3, y + ry * 0.55, rx * 0.8, LEAF[1:], ry=ry * 0.75, bias=0.3)   # 꽃받침(밑면이 살짝 보인다)
    for k in range(14):
        a = k * math.pi / 7 + 0.2
        front = math.sin(a)                                       # +1 앞(아래), -1 뒤(위)
        pl = 1.0 + 0.45 * max(0.0, front)
        px, py = x + math.cos(a) * rx * pl, y + math.sin(a) * ry * pl
        lit = -(math.cos(a) * 0.6 + front * 0.2)
        ball(t, px, py, 1.5, SUN, ry=1.1 + 0.4 * max(0.0, front), bias=-lit * 0.5 + (0.5 if front < -0.3 else 0))
    ball(t, x, y, rx * 0.92, SUN, ry=ry * 0.92, bias=0.1)
    cx, cy = x + face * rx * 0.1, y + ry * 0.1
    sr, sry = rx * 0.6, ry * 0.6
    for yy in range(int(cy - sry - 1), int(cy + sry + 2)):
        for xx in range(int(cx - sr - 1), int(cx + sr + 2)):
            u, v = (xx - cx) / sr, (yy - cy) / sry
            if u * u + v * v > 1:
                continue
            lv = 1.6 + u * 0.8 + v * 0.5 + ((xx + 2 * yy) % 3 == 0) * 1.0
            if v < -0.55:
                lv -= 1.0                                         # 위쪽 테에 빛
            t.P(xx, yy, pick(SEED, lv, xx, yy))


def _leaf(t, x, y, side):
    """위에서 내려다본 넓은 하트꼴 잎: 밝은 윗면(왼쪽 위 빛) + 가운데 잎맥 + 잎 끝 그늘 테 - side -1 왼쪽, 1 오른쪽."""
    cx, cy = x + side * 3.5, y + 1
    for yy in range(int(cy) - 3, int(cy) + 4):
        for xx in range(int(cx) - 5, int(cx) + 6):
            u, v = (xx - cx) / 4.2, (yy - cy) / 2.2
            d = u * u + v * v
            if d > 1:
                continue
            lv = 0.4 + (u + v) * 0.9 + (1.4 if d > 0.7 and v > -0.1 else 0)
            t.P(xx, yy, pick(LEAF, lv, xx, yy))
    line(t, x + side * 1, y + 1, x + side * 6, y + 1, LEAF[3])
    t.P(x + side * 2, y, LEAF[0]); t.P(x + side * 4, y, LEAF[0])


@kit('inaka-sunflower-patch', '해바라기 밭 한 덩이 - 3/4 북돋운 흙 두둑·층층 잎 줄기·뒷줄 작고 앞줄 큰 비스듬한 꽃 머리(3×2)', 3, 2, 'tree',
     solid=[(0, 1), (1, 1), (2, 1)], tags=['inaka', '해바라기', 'ひまわり', '여름'],
     rules='밭·마당 가장자리에 2~6개 이어 붙인다.', role='prop')
def sunflowers(c, base):
    for y in range(21, 31):
        for x in range(1, 48):
            u, v = (x - 24) / 22.5, (y - 26.5) / 4.2
            if u * u + v * v > 1:
                continue
            top = ((x - 24) / 21.5) ** 2 + ((y - 25.0) / 3.0) ** 2 <= 1
            lv = (0.8 + (y - 22) * 0.35 + u * 0.6) if top else (2.6 + (y - 26) * 0.35)
            lv += (H(x, y, 50) - 0.5) * 0.9
            c.P(x, y, pick(SOIL, lv, x, y))
    for x in range(6, 43, 5):
        c.HL(x, 24, 3, SOIL[3]); c.HL(x, 25, 3, SOIL[0])
    # 머리끼리 떨어지게: 뒷줄 4송이(높고 작게) · 앞줄 3송이(낮고 크게), 앞줄은 뒷줄 사이에 둔다
    back = ((7, 6, 3.6, 1.5, 1), (19, 4, 3.8, 1.6, -1), (31, 5, 3.6, 1.5, 1), (42, 6, 3.4, 1.4, -1))
    front = ((13, 14, 4.4, 1.9, -1), (25, 13, 4.6, 2.0, 1), (37, 15, 4.3, 1.8, -1))
    for row, top_ in ((back, 22), (front, 25)):
        for (x, y, rx, ry, face) in row:
            cyl(c, x, y + 2, 2, top_ - y - 2, LEAF[1:])
            for k, ly in enumerate(range(y + 6, top_ - 2, 5)):
                _leaf(c, x + (0 if k % 2 else 1), ly, -1 if k % 2 else 1)
        for (x, y, rx, ry, face) in row:
            # 뒤에 있는 머리·잎 위로 이 머리의 그늘 테(이미 칠한 곳에만)를 먼저 깔아 머리끼리 갈라 보이게 한다
            ball(c, x + 0.6, y + 0.8, rx * 1.4 + 1.6, [LEAF[4]], ry=ry * 1.45 + 1.6, mask=lambda xx, yy: 0 <= xx < c.w and 0 <= yy < c.h and c.a[yy, xx, 3] > 0)
            _sunflower_head(c, x, y, rx, ry, face)
    soft_outline(c)
    ground_shadow(c, 6, 47, 30, 2, SHADOW, 1)


@kit('inaka-hydrangea-hedge', '수국 꽃덤불(紫陽花) - 잎 덩이 위 파랑·보라 꽃송이·낮은 돌 테(3×2)', 3, 2, 'tree',
     solid=[(0, 1), (1, 1), (2, 1)], tags=['inaka', '수국', '紫陽花', '생울타리'],
     rules='집·절 담장 앞, 돌담 위에 이어 붙인다.', role='prop')
def hydrangea(c, base):
    # 돌 테: 판석 윗면 + 앞면 돌 한 개씩
    c.R(1, 23, 46, 9, OL)
    for y in range(24, 31):
        for x in range(2, 46):
            if y < 27:
                lv = 0.3 + (y - 24) * 0.4 + (H(x // 7, 0, 60) - 0.5) * 0.8 + (1.4 if x % 7 == 0 else 0)
            else:
                st = (x + (y // 2) * 3) // 6
                lv = 2.0 + (H(st, y // 2, 61) - 0.5) * 1.2 + (y - 27) * 0.3 + (2.0 if (x + (y // 2) * 3) % 6 == 0 else 0)
            c.P(x, y, pick(STONE, lv, x, y))
    speck(c, 2, 27, 44, 4, K('ki', -1), 0.08, 62)
    # 잎 덩이(뒤 깊은 그늘 → 앞 밝은 덩이)
    blobs = ((8, 15, 8, 7), (22, 13, 9, 8), (37, 15, 9, 7), (14, 19, 7, 4), (31, 19, 7, 4))
    for bx, by, rx, ry in blobs:
        ball(c, bx + 1, by + 1.5, rx, LEAF[2:], ry=ry, bias=0.2)
    for k, (bx, by, rx, ry) in enumerate(blobs):
        for j in range(6):
            a = j * 1.1 + k
            lx, ly = bx + math.cos(a) * rx * 0.55, by + math.sin(a) * ry * 0.55
            ball(c, lx, ly, 2.6, LEAF, ry=1.9, bias=0.1 + (math.cos(a) + math.sin(a)) * 0.2)
    # 꽃송이(작은 꽃 2px 결 + 공 명암): 파랑·보라·청자
    BLUE = [K('garasu', 3), K('sora', 2), K('sora', 1), K('sora', 0), K('kon', 0), K('kon', -1)]
    VIOLET = [K('murasaki', 2), K('murasaki', 1), K('kon', 2), K('murasaki', 0), K('kon', 0), K('murasaki', -1)]
    LILAC = [K('shiro', 2), K('kon', 2), K('kon', 1), K('murasaki', 0), K('kon', 0), K('kon', -1)]
    heads = ((5, 10, 4.2), (13, 7, 4.4), (21, 12, 4.0), (28, 6, 4.6), (36, 11, 4.2), (43, 8, 3.8), (9, 17, 3.4),
             (31, 17, 3.4), (17, 17, 3.0), (40, 17, 3.0), (2, 15, 2.6), (46, 14, 2.4))
    for k, (x, y, r) in enumerate(heads):
        cols = (BLUE, VIOLET, LILAC)[k % 3]
        for yy in range(int(y - r - 1), int(y + r + 2)):
            for xx in range(int(x - r - 1), int(x + r + 2)):
                u, v = (xx - x) / r, (yy - y) / (r * 0.85)
                if u * u + v * v > 1:
                    continue
                s = (u + v) * 0.62 + (u * u + v * v) * 0.35
                fl = (xx % 3 == 0) + (yy % 3 == 0)                # 작은 꽃(4장 꽃잎) 사이 틈
                lv = (s + 0.45) / 1.65 * 5 + (0.9 if fl == 2 else 0) - (0.7 if fl == 0 and H(xx, yy, k) < 0.4 else 0)
                c.P(xx, yy, pick(cols, lv, xx, yy))
    finish(c, [(4, 47, 32, 0, SHADOW, 1)])


@kit('inaka-jizo-shrine-row', '길가 지장보살 세 분 사당 - 片流れ 나무 지붕 윗면(깊이 1.5칸)·붉은 턱받이·돌 기단(3×3)', 3, 3, 'structure',
     solid=rows(3, [1, 2]), tags=['inaka', '지장', '地蔵', '사당'],
     rules='마을 갈림길·다리 옆. 앞 1칸 비운다.', role='prop')
def jizo_row(c, base):
    D = 14                                                        # 깊어진 지붕 면만큼 지장·기단을 아래로
    v = Cv.__new__(Cv)
    v.w, v.h, v.a = c.w, c.h - D, c.a[D:]

    def front(c):
        cyl(c, 3, 9, 2, 18, CEDAR, add=0.6); cyl(c, 43, 9, 2, 18, CEDAR, add=1.2)
        # 안 벽(처마 밑이라 어둡다, 널 이음)
        for y in range(10, 24):
            for x in range(5, 43):
                lv = 3.2 + (1.0 if y < 13 else 0) + (H(x // 5, 0, 70) - 0.5) * 0.8 + (0.9 if x % 5 == 0 else 0)
                c.P(x, y, pick(CEDAR, lv, x, y))
        # 돌 기단: 윗면 판석 → 앞면 돌 한 개씩
        c.R(1, 22, 46, 9, OL)
        for y in range(23, 30):
            for x in range(2, 46):
                if y < 26:
                    lv = 0.4 + (y - 23) * 0.4 + (H(x // 8, 1, 71) - 0.5) * 0.8 + (1.5 if x % 8 == 0 else 0)
                else:
                    st = (x + (y // 2) * 4) // 7
                    lv = 2.0 + (H(st, y // 2, 72) - 0.5) * 1.2 + (y - 26) * 0.3 + (2.0 if (x + (y // 2) * 4) % 7 == 0 else 0)
                c.P(x, y, pick(STONE, lv, x, y))
        speck(c, 2, 26, 44, 4, K('ki', -1), 0.08, 73)
        for x in (12, 24, 36):
            # 몸(돌 원통 + 이끼 점) → 머리(돌 공) → 붉은 턱받이(주름 명암)
            for yy in range(11, 22):                                  # 뒤 벽에 진 지장 그림자(오른쪽)
                c.P(x + 5, yy, CEDAR[5]); c.P(x + 4, yy - 2, CEDAR[5])
            cyl(c, x - 4, 15, 9, 9, STONE, add=0.0, grain=0.8, seed=x)
            ball(c, x, 12, 3.4, STONE, bias=-0.15)
            c.HL(x - 1, 13, 3, STONE[3]); c.P(x - 1, 12, STONE[2]); c.P(x + 1, 12, STONE[2])   # 감은 눈
            speck(c, x - 4, 20, 9, 4, K('ki', -1), 0.08, x + 1)
            for j in range(5):
                hw = 3 + j // 2
                for dx in range(-hw, hw + 1):
                    px, py = x + dx, 15 + j
                    lv = 0.8 + dx / hw * 1.2 + j * 0.3 + (1.0 if (dx + j) % 3 == 0 else 0)
                    c.P(px, py, pick(VERM, lv, px, py))
            c.HL(x - 3, 15, 7, VERM[0])
            hgrad(c, x - 3, 22, 7, 1, STONE, 0.5, 2.5)
        for x in (17, 30):                                            # 공양 꽃(작은 병 + 꽃)
            cyl(c, x, 23, 2, 2, CONC); c.P(x, 22, K('kii', 2)); c.P(x + 1, 21, K('aka', 1)); c.P(x + 1, 22, LEAF[2])
    front(v)
    # 片流れ 나무 지붕 윗면(y0~21 ≈ 1.5칸): 뒤(위)가 높고 앞(아래)으로 흘러내린다.
    # 널판은 경사 따라 세로(판마다 명암·이음 그늘), 7줄마다 겹친 판 끝(빛 + 그늘), 위쪽 빛 → 처마 쪽 그늘, 이끼
    for y in range(0, 10 + D):
        for x in range(0, 48):
            pl = x // 3
            lv = 0.4 + (y * 0.07) + (H(pl, y // 7, 74) - 0.5) * 1.2 + (x / 48) * 0.6 + (1.6 if x % 3 == 2 else 0)
            if y % 7 == 6:
                lv += 1.3                                         # 겹친 판 밑 그늘
            elif y % 7 == 0 and y > 0:
                lv -= 0.6                                         # 겹친 판 끝 빛
            if y >= 8 + D:
                lv = 3.0 + (y - 8 - D) * 0.8                      # 앞 처마 판(측면 두께)
            c.P(x, y, pick(CEDAR, lv, x, y))
    c.HL(0, 0, 48, CEDAR[0])
    speck(c, 0, 1, 48, 6 + D, J('moss', 2), 0.05, 75)              # 지붕 이끼
    finish(c, [(3, 47, 31 + D, 2, SHADOW, 0)])


# ═══════════════════════════ 물·담·다리 ═══════════════════════════


import inaka_art_walls  # noqa: E402,F401  (담·울타리·물 건너기 키트 등록)
from inaka_art_ground import GROUND, GROUND_GROUPS  # noqa: E402,F401
