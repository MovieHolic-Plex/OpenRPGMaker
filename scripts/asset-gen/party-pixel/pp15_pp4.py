"""pp4 — retro2003 파티원 15칸 시트 공용 빌더 (묶음 b4, Monster2).

원칙: 걷기 칩의 **왼쪽 보기 가운데 칸(24×32)** 을 정수 2배로 키운 것이 대기 칸의 밑그림이다.
  1. 칩 색을 ≤12색으로 합친다(가까운 색 쌍부터 병합 — 눈처럼 작은 튀는 색이 살아남는다).
  2. EPX(Scale2x)로 2배 — 계단 외곽선이 한 단계 둥글어지고 색은 새로 생기지 않는다.
  3. 2배가 된 2px 외곽선의 안쪽 절반을 안쪽 색으로 되돌려 **외곽선 1px**.
  4. 칸마다 부위(팔·날개·무기)를 칩에서 오려 관절 축으로 돌리고(4배 EPX 표본 회전), 몸 전체는
     행 단위 밀기(기울임·호흡)로만 바꾼다 — 픽셀을 늘리거나 새로 칠하지 않으므로 칩과 같은 캐릭터로 남는다.
  5. 합친 뒤 실루엣 둘레를 다시 외곽선으로 찍고, 왼쪽 위 안쪽 1px 은 팔레트 한 단 밝게, 오른쪽 아래는 한 단 어둡게.
  6. 효과(기·잔상·먼지)는 효과색 3색으로 외곽선 밖에 찍는다.
칩 행 순서는 RM2k 관례(0 위 · 1 오른쪽 · 2 아래 · 3 왼쪽)다 — 행 3 이 왼쪽 보기.
그림이 처음부터 왼쪽을 보므로 반전하지 않는다. 산출: public/assets/generated/party-pixel/<chip>.png (셀 64, 3×5).
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'public/assets/generated/party-pixel'
QA = ROOT / '.omo/pp4'
SRC = ROOT / 'public/assets/easyrpg/charset/Monster2.png'
NAMES = ['idle_a', 'idle_b', 'idle_c', 'windup', 'move', 'attack', 'recover', 'hit', 'dead',
         'cast_charge', 'cast_raise', 'cast_release', 'leap', 'buff', 'finisher']
BG = (32, 40, 64)


# ───────────────────────── 칩 읽기 · 감색 ─────────────────────────
def chip_frame(index, row=3, col=1, sheet=SRC):
    im = Image.open(sheet).convert('RGBA')
    a = np.array(im)
    key = a[0, 0, :3].copy()
    a[(a[:, :, :3] == key).all(2)] = 0
    bx, by = index % 4 * 72, index // 4 * 128
    return a[by + row * 32: by + row * 32 + 32, bx + col * 24: bx + col * 24 + 24].copy()


def _lum(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def quantize(rgba, n):
    """가까운 색 쌍부터 개수 가중 평균으로 합쳐 n 색 이하. 반환: (idx 배열 -1=투명, 팔레트 list[rgb])."""
    h, w = rgba.shape[:2]
    cols = {}
    for y in range(h):
        for x in range(w):
            if rgba[y, x, 3] >= 128:
                k = tuple(int(v) for v in rgba[y, x, :3])
                cols[k] = cols.get(k, 0) + 1
    groups = [[np.array(k, float), c, [k]] for k, c in cols.items()]

    def dist(a, b):
        d = a[0] - b[0]
        return (2 * d[0] ** 2 + 4 * d[1] ** 2 + 3 * d[2] ** 2) * min(a[1], b[1]) ** 0.35

    while len(groups) > n:
        best = None
        for i in range(len(groups)):
            for j in range(i + 1, len(groups)):
                d = dist(groups[i], groups[j])
                if best is None or d < best[0]:
                    best = (d, i, j)
        _, i, j = best
        gi, gj = groups[i], groups[j]
        tot = gi[1] + gj[1]
        groups[i] = [(gi[0] * gi[1] + gj[0] * gj[1]) / tot, tot, gi[2] + gj[2]]
        groups.pop(j)
    # 합친 무리의 대표색은 가장 많이 쓰인 원래 칩 색(평균이 아니라) — 칩에 없는 색을 만들지 않는다.
    pal, lut = [], {}
    for g in groups:
        rep = max(g[2], key=lambda k: cols[k])
        for k in g[2]:
            lut[k] = len(pal)
        pal.append(rep)
    idx = -np.ones((h, w), int)
    for y in range(h):
        for x in range(w):
            if rgba[y, x, 3] >= 128:
                idx[y, x] = lut[tuple(int(v) for v in rgba[y, x, :3])]
    return idx, pal


# ───────────────────────── 확대 · 외곽선 ─────────────────────────
def epx(idx):
    h, w = idx.shape
    p = np.pad(idx, 1, constant_values=-1)
    out = np.repeat(np.repeat(idx, 2, 0), 2, 1)
    for y in range(h):
        for x in range(w):
            P = p[y + 1, x + 1]
            A, B, C, D = p[y, x + 1], p[y + 1, x + 2], p[y + 1, x], p[y + 2, x + 1]
            o = out[2 * y:2 * y + 2, 2 * x:2 * x + 2]
            if C == A and C != D and A != B: o[0, 0] = A
            if A == B and A != C and B != D: o[0, 1] = B
            if D == C and D != B and C != A: o[1, 0] = C
            if B == D and B != A and D != C: o[1, 1] = D
            if P == -1 and (o != -1).sum() == 1:   # 빈 칸에 한 점만 튀어나온 EPX 모서리는 버린다
                o[:] = -1
    return out


N4 = ((1, 0), (-1, 0), (0, 1), (0, -1))


def ring_of(mask):
    h, w = mask.shape
    p = np.pad(mask, 1)
    inner = p[1:-1, 2:] & p[1:-1, :-2] & p[2:, 1:-1] & p[:-2, 1:-1]
    return mask & ~inner


class Figure:
    """칩 한 칸 → 2배 밑그림 + 팔레트. 좌표는 모두 2배 공간."""

    def __init__(self, index, ncolors=13, fx=('ffffff', 'cccccc', '888888'), cut=None, outline=None):
        src = chip_frame(index)
        if cut is not None:           # 그림자 등 칩의 몸이 아닌 픽셀 제거: cut(y, x) -> True 면 지운다
            for y in range(32):
                for x in range(24):
                    if cut(x, y):
                        src[y, x] = 0
        self.src = src
        sidx, pal = quantize(src, ncolors)
        self.pal = [tuple(c) for c in pal]
        dark = min(range(len(self.pal)), key=lambda i: _lum(self.pal[i]))
        self.outline = dark if outline is None else outline
        self.dark = {i for i, c in enumerate(self.pal) if _lum(c) < 58}
        self.dark.add(self.outline)
        self.sidx = sidx
        big = epx(sidx)
        # 2배 외곽선의 안쪽 절반 → 안쪽 색
        smask = sidx >= 0
        sring = ring_of(smask)
        fill = sidx.copy()
        for y in range(32):
            for x in range(24):
                if sring[y, x] and sidx[y, x] in self.dark:
                    c = {}
                    for dx, dy in N4:
                        xx, yy = x + dx, y + dy
                        if 0 <= xx < 24 and 0 <= yy < 32 and smask[yy, xx] and not sring[yy, xx] and sidx[yy, xx] not in self.dark:
                            c[sidx[yy, xx]] = c.get(sidx[yy, xx], 0) + 1
                    if c:
                        fill[y, x] = max(c, key=c.get)
        bring = ring_of(big >= 0)
        for y in range(64):
            for x in range(48):
                if big[y, x] >= 0 and not bring[y, x] and sring[y // 2, x // 2] and big[y, x] in self.dark:
                    # 한 겹 안쪽이 여전히 링과 붙어 있을 때만 바꾼다(가는 부위는 그대로)
                    big[y, x] = fill[y // 2, x // 2]
        self.big = big
        self.fx = [tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) for h in fx]
        self.fx_i = list(range(len(self.pal), len(self.pal) + len(self.fx)))
        self.parts = {}
        self._ramps()

    def _ramps(self):
        P = self.pal
        self.lighter, self.darker = {}, {}
        for i, c in enumerate(P):
            best_l = best_d = None
            for j, d in enumerate(P):
                if j == i or j == self.outline:
                    continue
                dl = _lum(d) - _lum(c)
                # 색상 거리(밝기 뺀 채도 차)
                ci = np.array(c, float) - _lum(c)
                dj = np.array(d, float) - _lum(d)
                hue = float(np.abs(ci - dj).sum())
                if 12 < dl < 90 and hue < 70:
                    s = hue + dl * 0.5
                    if best_l is None or s < best_l[0]:
                        best_l = (s, j)
                if -90 < dl < -12 and hue < 70:
                    s = hue - dl * 0.5
                    if best_d is None or s < best_d[0]:
                        best_d = (s, j)
            self.lighter[i] = best_l[1] if best_l else i
            self.darker[i] = best_d[1] if best_d else i

    # ── 부위 오리기 ──
    def cut_part(self, name, poly, pivot, hole=None, keep=False):
        """poly: 칩 좌표(24×32) 다각형. pivot: 칩 좌표 관절. hole: 부위가 빠진 뒤 몸으로 메울 칩 좌표 다각형(없으면 투명)."""
        m = Image.new('L', (48, 64), 0)
        ImageDraw.Draw(m).polygon([(x * 2, y * 2) for x, y in poly], fill=255)
        mask = (np.array(m) > 0) & (self.big >= 0)
        part = np.where(mask, self.big, -1)
        if keep:                      # 날개처럼 몸 뒤를 덮는 큰 부위: 원래 자리는 두고 사본만 움직인다
            self.parts[name] = (part, (pivot[0] * 2, pivot[1] * 2))
            return
        self.big = np.where(mask, -1, self.big)
        if hole:
            hm = Image.new('L', (48, 64), 0)
            ImageDraw.Draw(hm).polygon([(x * 2, y * 2) for x, y in hole], fill=255)
            need = mask & (np.array(hm) > 0)
            self.big = inpaint(self.big, need, avoid=self.dark)
        self.parts[name] = (part, (pivot[0] * 2, pivot[1] * 2))


def inpaint(img, need, avoid=()):
    img = img.copy()
    need = need.copy()
    h, w = img.shape
    for _ in range(40):
        if not need.any():
            break
        new = img.copy()
        for y, x in zip(*np.nonzero(need)):
            c = {}
            for dx, dy in N4 + ((1, 1), (-1, -1), (1, -1), (-1, 1)):
                xx, yy = x + dx, y + dy
                if 0 <= xx < w and 0 <= yy < h and img[yy, xx] >= 0 and not need[yy, xx]:
                    v = img[yy, xx]
                    c[v] = c.get(v, 0) + (0.3 if v in avoid else 1)
            if c:
                new[y, x] = max(c, key=c.get)
        need &= new < 0
        img = new
    return img


# ───────────────────────── 변형 ─────────────────────────
def rotate(part, pivot, deg, dx=0, dy=0, canvas=(128, 128), off=(40, 32)):
    """부위를 pivot 둘레로 deg 만큼 돌린다(+ = 손끝이 앞(왼쪽)·위로). 4배 EPX 표본 → 최근접.
    결과는 canvas 크기(원점 off 만큼 밀린) 배열."""
    W, H = canvas
    out = -np.ones((H, W), int)
    if deg == 0:
        ys, xs = np.nonzero(part >= 0)
        for y, x in zip(ys, xs):
            X, Y = x + off[0] + dx, y + off[1] + dy
            if 0 <= X < W and 0 <= Y < H:
                out[Y, X] = part[y, x]
        return out
    up = epx(epx(part))                     # 4배
    t = math.radians(deg)
    c, s = math.cos(t), math.sin(t)
    px, py = pivot
    hh, ww = part.shape
    Y, X = np.mgrid[0:H, 0:W]
    x = X - off[0] - dx + 0.5 - px
    y = Y - off[1] - dy + 0.5 - py
    sx = c * x + s * y + px                  # 역회전
    sy = -s * x + c * y + py
    ux = np.floor(sx * 4).astype(int)
    uy = np.floor(sy * 4).astype(int)
    ok = (ux >= 0) & (ux < ww * 4) & (uy >= 0) & (uy < hh * 4)
    out[ok] = up[uy[ok], ux[ok]]
    return out


def paste(dst, src):
    m = src >= 0
    dst[m] = src[m]
    return dst


def shear(img, pivot_y, k, top_only=True):
    """pivot_y 위쪽 행을 (pivot_y - y) * k 만큼 가로로 민다. k<0 = 앞(왼쪽)으로 기울임."""
    out = -np.ones_like(img)
    h, w = img.shape
    for y in range(h):
        d = int(round((pivot_y - y) * k)) if (y < pivot_y or not top_only) else 0
        if d >= 0:
            out[y, d:] = img[y, :w - d] if d else img[y]
        else:
            out[y, :d] = img[y, -d:]
    return out


def squash(img, rows):
    """rows(위에서부터 지울 행 번호 목록)를 지우고 위쪽을 한 칸씩 내린다 — 호흡·웅크림."""
    out = img.copy()
    for r in sorted(rows):
        out[1:r + 1] = out[0:r].copy()
        out[0] = -1
    return out


def stretch(img, rows):
    """rows 행을 한 번 더 찍고 위쪽을 한 칸씩 올린다 — 몸을 세움."""
    out = img.copy()
    for r in sorted(rows, reverse=True):
        out[0:r] = out[1:r + 1].copy()
    return out


def shift(img, dx, dy):
    out = -np.ones_like(img)
    h, w = img.shape
    ys, xs = np.nonzero(img >= 0)
    for y, x in zip(ys, xs):
        X, Y = x + dx, y + dy
        if 0 <= X < w and 0 <= Y < h:
            out[Y, X] = img[y, x]
    return out


def rot90(img, cw=True):
    return np.rot90(img, -1 if cw else 1).copy()


# ───────────────────────── 외곽선 · 빛 ─────────────────────────
def finish(fig, img):
    """실루엣 둘레 = 외곽선색, 안쪽 1px 왼쪽 위 = 한 단 밝게, 오른쪽 아래 = 한 단 어둡게."""
    img = img.copy()
    body = (img >= 0) & ~np.isin(img, fig.fx_i)
    ring = ring_of(body)
    h, w = img.shape
    out = img.copy()
    for y, x in zip(*np.nonzero(body & ~ring)):
        v = img[y, x]
        if v in fig.dark:
            continue
        up = ring[y - 1, x] if y else False
        lf = ring[y, x - 1] if x else False
        dn = ring[y + 1, x] if y + 1 < h else False
        rt = ring[y, x + 1] if x + 1 < w else False
        if (up or lf) and not (dn or rt):
            out[y, x] = fig.lighter[v]
        elif (dn or rt) and not (up or lf):
            out[y, x] = fig.darker[v]
    out[ring] = fig.outline
    # 외곽선끼리만 붙은 한 점(외곽선 가시) 제거
    for _ in range(2):
        m = out >= 0
        for y, x in zip(*np.nonzero(ring)):
            nb = [(y + dy, x + dx) for dx, dy in N4 if 0 <= y + dy < h and 0 <= x + dx < w and m[y + dy, x + dx]]
            if len(nb) <= 1 and all(out[a, b] == fig.outline for a, b in nb):
                out[y, x] = -1
    return out


# ───────────────────────── 효과 붓 ─────────────────────────
class FX:
    def __init__(self, fig, img):
        self.f, self.img = fig, img

    def px(self, x, y, k):
        h, w = self.img.shape
        x, y = int(round(x)), int(round(y))
        if 1 <= x < w - 1 and 1 <= y <= BASE and self.img[y, x] < 0:
            self.img[y, x] = self.f.fx_i[k]

    def over(self, x, y, k):
        h, w = self.img.shape
        x, y = int(round(x)), int(round(y))
        if 1 <= x < w - 1 and 1 <= y <= BASE:
            self.img[y, x] = self.f.fx_i[k]

    def spark(self, x, y, k=0, r=1, edge=1):
        for d in range(-r - 1, r + 2):
            self.px(x + d, y, edge if abs(d) > r else k)
            self.px(x, y + d, edge if abs(d) > r else k)

    def disc(self, cx, cy, r, core=0, rim=1, edge=2):
        for y in range(int(cy - r - 1), int(cy + r + 2)):
            for x in range(int(cx - r - 1), int(cx + r + 2)):
                d = math.hypot(x - cx, y - cy)
                if d <= r * 0.5:
                    self.over(x, y, core)
                elif d <= r:
                    self.over(x, y, rim)
                elif d <= r + 0.9:
                    self.px(x, y, edge)

    def arc(self, cx, cy, r, a0, a1, width=2, k=(0, 1, 2)):
        """두께 width 의 호: 안쪽 k[0] 밝게 → 바깥 k[-1]."""
        steps = int(abs(a1 - a0) * r / 12) + 8
        for i in range(steps + 1):
            a = math.radians(a0 + (a1 - a0) * i / steps)
            taper = math.sin(math.pi * i / steps)
            wv = max(1, int(round(width * taper + 0.4)))
            for j in range(wv + 1):
                kk = k[min(len(k) - 1, int(j * len(k) / (wv + 1)))]
                self.px(cx + math.cos(a) * (r + j), cy + math.sin(a) * (r + j), kk)

    def line(self, x0, y0, x1, y1, k=0):
        n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
        for i in range(n + 1):
            self.px(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, k)

    def aura(self, gap=1, k=1, spikes=(), tip=0):
        """실루엣 바깥 gap 만큼 떨어진 둘레에 기운 테두리 + 위로 솟는 불꽃 가닥."""
        body = self.img >= 0
        h, w = body.shape
        grow = body.copy()
        for _ in range(gap + 1):
            p = np.pad(grow, 1)
            grow = grow | p[1:-1, 2:] | p[1:-1, :-2] | p[2:, 1:-1] | p[:-2, 1:-1]
        ring = ring_of(grow) & ~body
        for y, x in zip(*np.nonzero(ring)):
            if (x + y) % 3 != 0:
                self.px(x, y, k)
        for sx in spikes:
            col = np.nonzero(grow[:, sx])[0]
            if len(col):
                top = col[0]
                for d in range(1, 5):
                    self.px(sx, top - d, tip if d > 2 else k)

    def dust(self, x, y, n=3, k=(1, 2)):
        for i in range(n):
            cx = x + i * 5 * (1 if n > 0 else -1)
            self.px(cx, y, k[1]); self.px(cx + 1, y, k[1]); self.px(cx + 1, y - 1, k[0]); self.px(cx + 2, y, k[1])


# ───────────────────────── 조립 · 검사 · 산출 ─────────────────────────
CELL = 64
BASE = CELL - 4
WORK = (128, 128)
OFF = (40, 32)      # 칩 2배 공간(48×64)을 작업판(128×128) 안에 놓는 자리


def rest(fig):
    """몸(부위 뺀 것)을 작업판에 놓은 배열."""
    return rotate(fig.big, (0, 0), 0, canvas=WORK, off=OFF)


def part(fig, name, deg=0, dx=0, dy=0):
    p, pv = fig.parts[name]
    return rotate(p, pv, deg, dx, dy, canvas=WORK, off=OFF)


def anchor(fig):
    """대기 칸 기준: 발끝(bbox 아래)과 가로 중심. 작업판 좌표."""
    full = fig.big.copy()
    for p, _ in fig.parts.values():
        full = np.where(p >= 0, p, full)
    ys, xs = np.nonzero(full >= 0)
    return (xs.min() + xs.max() + 1) / 2 + OFF[0], ys.max() + OFF[1]


def to_cell(fig, img, foot, cx, lift=0):
    """작업판 → 셀. 발끝 foot 이 BASE - lift 에, 가로 cx 가 셀 중심에 오도록 민다(모든 칸 같은 이동)."""
    dx = int(round(CELL / 2 - cx))
    dy = BASE - foot - lift
    out = -np.ones((CELL, CELL), int)
    ys, xs = np.nonzero(img >= 0)
    for y, x in zip(ys, xs):
        X, Y = x + dx, y + dy
        if 0 <= X < CELL and 0 <= Y < CELL:
            out[Y, X] = img[y, x]
    return out, (dx, dy)


def to_rgba(fig, idx):
    pal = fig.pal + fig.fx
    h, w = idx.shape
    a = np.zeros((h, w, 4), np.uint8)
    m = idx >= 0
    for i, c in enumerate(pal):
        sel = idx == i
        a[sel, :3] = c
        a[sel, 3] = 255
    return Image.fromarray(a, 'RGBA')


def _isolated(a):
    m = a[:, :, 3] > 0
    p = np.pad(m, 1)
    nb = p[1:-1, 2:] | p[1:-1, :-2] | p[2:, 1:-1] | p[:-2, 1:-1]
    return int((m & ~nb).sum())


def build(chip, fig, draw, flying=False, airborne_ok=('move', 'leap', 'windup', 'finisher', 'attack', 'hit')):
    frames = {}
    for n in NAMES:
        frames[n] = draw(n)
    errors, rep = [], {'chip': chip, 'cell': CELL, 'baseline': BASE, 'flying': flying, 'frames': {}}
    ims = []
    for n in NAMES:
        im = to_rgba(fig, frames[n])
        ims.append(im)
        a = np.array(im)
        box = im.getbbox()
        if not box:
            errors.append(f'{n} empty'); continue
        if not (box[0] > 0 and box[1] > 0 and box[2] < CELL and box[3] <= BASE + 1):
            errors.append(f'{n} bounds {box}')
        # 바닥선: 몸(효과 제외) 아래 끝
        body = (frames[n] >= 0) & ~np.isin(frames[n], fig.fx_i)
        bottom = int(np.nonzero(body.any(1))[0].max())
        grounded = n == 'dead' or not flying
        if grounded and n not in airborne_ok and bottom != BASE:
            errors.append(f'{n} baseline {bottom}')
        if flying and n != 'dead' and bottom > BASE - 2:
            errors.append(f'{n} not airborne ({bottom})')
        if n == 'leap' and bottom > BASE - 4:
            errors.append(f'leap not airborne ({bottom})')
        iso = _isolated(a)
        if iso:
            errors.append(f'{n} isolated px {iso}')
        rep['frames'][n] = {'bbox': list(box), 'bodyBottom': bottom}
    mind = None
    for i in range(15):
        for j in range(i + 1, 15):
            d = int((np.array(ims[i]) != np.array(ims[j])).any(2).sum())
            if d == 0:
                errors.append(f'{NAMES[i]}=={NAMES[j]}')
            if mind is None or d < mind[0]:
                mind = (d, NAMES[i], NAMES[j])
    sheet = Image.new('RGBA', (CELL * 3, CELL * 5))
    for i, im in enumerate(ims):
        sheet.paste(im, (i % 3 * CELL, i // 3 * CELL))
    palette = {c for _, c in sheet.getcolors(CELL * CELL * 15) if c[3]}
    if len(palette) > 16:
        errors.append(f'colors {len(palette)}')
    if not set(np.array(sheet)[:, :, 3].ravel().tolist()) <= {0, 255}:
        errors.append('alpha')
    if sheet.size != (CELL * 3, CELL * 5):
        errors.append(f'size {sheet.size}')
    OUT.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT / f'{chip}.png')
    with Image.open(OUT / f'{chip}.png') as saved:
        if saved.convert('RGBA').tobytes() != sheet.tobytes():
            errors.append('reload mismatch')
    rep.update(size=list(sheet.size), colors=len(palette), min_pair_diff=list(mind), errors=errors)
    qa = QA / chip
    qa.mkdir(parents=True, exist_ok=True)
    (qa / 'validation.json').write_text(json.dumps(rep, indent=2, ensure_ascii=False) + '\n')
    review(chip, fig, sheet, qa)
    print(f"{chip}: size={sheet.size} colors={len(palette)} minDiff={mind[0]}({mind[1]}/{mind[2]}) errors={errors or 'none'}")
    if errors:
        raise SystemExit(1)
    return sheet


def review(chip, fig, sheet, qa):
    """확인판 (a): 원본 걷기 칩 왼쪽 보기(4배) | 15칸(4배) — 폭 1860px 이하."""
    S = 4
    src = Image.fromarray(fig.src, 'RGBA')
    W = 24 * S + 24 + CELL * 3 * S
    H = CELL * 5 * S
    board = Image.new('RGB', (W, H), (26, 30, 44))
    d = ImageDraw.Draw(board)
    t = Image.new('RGBA', src.size, BG + (255,)); t.alpha_composite(src)
    board.paste(t.convert('RGB').resize((24 * S, 32 * S), Image.NEAREST), (0, (BASE - 30) * S - 28 * S + 32 * S - 32 * S))
    d.text((4, 4), 'chip x4', fill=(220, 220, 220))
    sh = Image.new('RGBA', sheet.size, BG + (255,)); sh.alpha_composite(sheet)
    ox = 24 * S + 24
    board.paste(sh.convert('RGB').resize((sheet.width * S, sheet.height * S), Image.NEAREST), (ox, 0))
    for i, n in enumerate(NAMES):
        x, y = ox + i % 3 * CELL * S, i // 3 * CELL * S
        d.rectangle((x, y, x + CELL * S - 1, y + CELL * S - 1), outline=(70, 80, 104))
        d.line((x + 2, y + (BASE + 1) * S, x + CELL * S - 3, y + (BASE + 1) * S), fill=(60, 74, 100))
        d.text((x + 5, y + 4), n, fill=(214, 205, 220))
    # 칩(2배 공간이 셀 기준에 오도록) 는 대기 칸 높이와 같은 눈금 — 4배 칩 = 2배 칩의 2배 표시
    board.save(qa / 'board.png')



# ───────────────────────── 표준 포즈 조립 ─────────────────────────
def marker_track(ops, pt):
    m = -np.ones((WORK[1], WORK[0]), int)
    m[int(pt[1]), int(pt[0])] = 0
    for op in ops:
        m = op(m)
    ys, xs = np.nonzero(m >= 0)
    if not len(ys):
        return pt
    return xs[0], ys[0]


def fwd_rot(pt, pivot, deg):
    t = math.radians(deg)
    c, s = math.cos(t), math.sin(t)
    x, y = pt[0] - pivot[0], pt[1] - pivot[1]
    return pivot[0] + c * x - s * y, pivot[1] + s * x + c * y


class Pose:
    """한 칸의 몸 자세: 기울기 k(− 앞), 몸 밀기 dx, 들림 lift, 눌림/세움 행, 부위 각도."""

    def __init__(self, k=0.0, dx=0, lift=0, squash=0, stretch=0, tuck=0, angles=None, shifts=None, rot=0):
        self.k, self.dx, self.lift = k, dx, lift
        self.squash, self.stretch, self.tuck = squash, stretch, tuck
        self.angles = angles or {}
        self.shifts = shifts or {}
        self.rot = rot


class Rig:
    """칩 파일이 채우는 한 캐릭터의 리그. parts: {이름: (칩 다각형, 칩 관절, 층 'back'|'front', 칩 손끝|None, 메울 다각형|None)}."""

    def __init__(self, index, parts, chest, cut=None, ncolors=13, fx=('ffffff', 'cccccc', '888888'), flying=False, outline=None):
        self.fig = Figure(index, ncolors=ncolors, fx=fx, cut=cut, outline=outline)
        self.meta = {}
        for name, spec in parts.items():
            poly, pivot, layer, tip, hole = spec[:5]
            keep = len(spec) > 5 and spec[5]
            self.fig.cut_part(name, poly, pivot, hole, keep)
            self.meta[name] = (layer, tip)
        self.flying = flying
        self.foot_x, self.foot_y = anchor(self.fig)
        self.chest = chest * 2 + OFF[1]           # 호흡 행(칩 y)
        self.pivot_y = self.foot_y

    def compose(self, pose):
        f = self.fig
        body = rest(f)
        ops = []
        if pose.tuck:
            ty = self.foot_y - pose.tuck * 3
            ops.append(lambda im, ty=ty, n=pose.tuck: squash(im, list(range(ty, ty + n))))
        if pose.squash:
            ops.append(lambda im, n=pose.squash: squash(im, list(range(self.chest, self.chest + n))))
        if pose.stretch:
            ops.append(lambda im, n=pose.stretch: stretch(im, [self.chest] * n))
        if pose.k:
            ops.append(lambda im, k=pose.k: shear(im, self.pivot_y, k))
        if pose.dx or pose.lift:
            ops.append(lambda im: shift(im, pose.dx, -pose.lift))
        for op in ops:
            body = op(body)
        tips = {}
        backs, fronts = [], []
        for name, (layer, tip) in self.meta.items():
            p, pv = f.parts[name]
            wp = (pv[0] + OFF[0], pv[1] + OFF[1])
            npv = marker_track(ops, wp)
            deg = pose.angles.get(name, 0)
            sx, sy = pose.shifts.get(name, (0, 0))
            img = rotate(p, pv, deg, npv[0] - wp[0] + sx, npv[1] - wp[1] + sy, canvas=WORK, off=OFF)
            (backs if layer == 'back' else fronts).append(img)
            if tip:
                tp = fwd_rot((tip[0] * 2, tip[1] * 2), pv, deg)
                tips[name] = (tp[0] + OFF[0] + npv[0] - wp[0] + sx, tp[1] + OFF[1] + npv[1] - wp[1] + sy)
        out = -np.ones_like(body)
        for b in backs:
            paste(out, b)
        paste(out, body)
        for fr in fronts:
            paste(out, fr)
        if pose.rot:
            out = np.rot90(out, pose.rot).copy()
        return out, tips

    def cell(self, pose, fx=None, lift=None):
        img, tips = self.compose(pose)
        img = finish(self.fig, img)
        # 바닥 맞춤: 대기 칸 발끝 기준으로 모든 칸 같은 이동. dead 는 몸 아래 끝을 바닥에 놓는다.
        cx = self.foot_x
        foot = self.foot_y
        if pose.rot:
            ys, xs = np.nonzero(img >= 0)
            foot = ys.max()
            cx = (xs.min() + xs.max() + 1) / 2
        out, (dx, dy) = to_cell(self.fig, img, foot, cx, 0)
        # 칸 맞춤: 몸이 칸 밖으로 잘리지 않게 가로로 밀고, 위가 넘치면 들림만 줄인다(바닥선은 그대로).
        ys, xs = np.nonzero(out >= 0)
        full_w = img.shape[1]
        ys2, xs2 = np.nonzero(img >= 0)
        left, right = xs2.min() + dx, xs2.max() + dx
        top = ys2.min() + dy
        mx = 0
        if left < 2:
            mx = 2 - left
        elif right > CELL - 3:
            mx = CELL - 3 - right
        my = 1 - top if top < 1 else 0
        if mx or my:
            out, (dx, dy) = to_cell(self.fig, img, foot, cx - mx, -my)
        tips = {k: (v[0] + dx, v[1] + dy) for k, v in tips.items()}
        if fx:
            b = FX(self.fig, out)
            fx(b, tips)
            out = b.img
        return clean_iso(out)


def clean_iso(img):
    img = img.copy()
    h, w = img.shape
    for _ in range(2):
        m = img >= 0
        p = np.pad(m, 1)
        nb = p[1:-1, 2:] | p[1:-1, :-2] | p[2:, 1:-1] | p[:-2, 1:-1]
        img[m & ~nb] = -1
    return img



# ───────────────────────── 15칸 기본 연기(칩 파일이 역할·효과로 조정) ─────────────────────────
def body_mask(fig, img):
    return (img >= 0) & ~np.isin(img, fig.fx_i)


def front_at(fig, img, y):
    """행 y 에서 몸의 가장 앞(왼쪽) x."""
    row = np.nonzero(body_mask(fig, img)[int(y)])[0]
    return int(row.min()) if len(row) else CELL // 2


def bbox(fig, img):
    ys, xs = np.nonzero(body_mask(fig, img))
    return xs.min(), ys.min(), xs.max(), ys.max()


def ang(roles, role, a):
    """역할(arm·wing·tail·legs·head…) 이름 목록 → 부위별 각도 dict. roles[role] = [(부위, 부호)]."""
    return {name: a * sign for name, sign in roles.get(role, [])}


def merge(*ds):
    out = {}
    for d in ds:
        out.update(d)
    return out


def standard(rig, roles, hover=0, tune=None):
    """15칸 기본 자세. roles: {'arm': [(부위, ±1)], 'wing': [...], 'tail': [...], 'legs': [...]}.
    각도 규약: arm/legs + = 앞(왼쪽)으로 휘두름, wing + = 펼쳐 올림, tail + = 치켜듦(칩 파일이 부호로 맞춘다)."""
    H = hover
    P = {
        'idle_a': Pose(lift=H),
        'idle_b': Pose(lift=H + (1 if H else 0), squash=0 if H else 1, angles=merge(ang(roles, 'wing', 5), ang(roles, 'tail', 3))),
        'idle_c': Pose(lift=H + (2 if H else 0), squash=0 if H else 2, angles=merge(ang(roles, 'wing', 10), ang(roles, 'tail', 6), ang(roles, 'arm', 3))),
        'windup': Pose(k=0.1, dx=3, lift=H, squash=1, angles=merge(ang(roles, 'arm', -55), ang(roles, 'wing', 22), ang(roles, 'tail', 14), ang(roles, 'legs', -8))),
        'move': Pose(k=-0.12, dx=-3, lift=H + 3, angles=merge(ang(roles, 'arm', -25), ang(roles, 'wing', -10), ang(roles, 'tail', -8), ang(roles, 'legs', -20))),
        'attack': Pose(k=-0.17, dx=-5, lift=H, angles=merge(ang(roles, 'arm', 95), ang(roles, 'wing', 28), ang(roles, 'tail', 16), ang(roles, 'legs', 25))),
        'recover': Pose(k=-0.07, dx=-2, lift=H, angles=merge(ang(roles, 'arm', 35), ang(roles, 'wing', 4), ang(roles, 'legs', 6))),
        'hit': Pose(k=0.15, dx=4, lift=H, squash=1, angles=merge(ang(roles, 'arm', -20), ang(roles, 'wing', -12), ang(roles, 'tail', -10), ang(roles, 'legs', 12))),
        'dead': Pose(rot=-1),
        'cast_charge': Pose(k=0.05, dx=1, lift=H, squash=2, angles=merge(ang(roles, 'arm', 25), ang(roles, 'wing', -8), ang(roles, 'tail', -6))),
        'cast_raise': Pose(k=0.03, lift=H + (2 if H else 0), stretch=1, angles=merge(ang(roles, 'arm', 150), ang(roles, 'wing', 30), ang(roles, 'tail', 18))),
        'cast_release': Pose(k=-0.12, dx=-3, lift=H, angles=merge(ang(roles, 'arm', 80), ang(roles, 'wing', 16), ang(roles, 'tail', 8))),
        'leap': Pose(k=-0.08, dx=-1, lift=H + 7, tuck=6, angles=merge(ang(roles, 'arm', 60), ang(roles, 'wing', 34), ang(roles, 'tail', 22), ang(roles, 'legs', 35))),
        'buff': Pose(k=0.0, lift=H + (1 if H else 0), stretch=1, angles=merge(ang(roles, 'arm', -30), ang(roles, 'wing', 38), ang(roles, 'tail', 24))),
        'finisher': Pose(k=-0.2, dx=-6, lift=H, squash=1, angles=merge(ang(roles, 'arm', 120), ang(roles, 'wing', 40), ang(roles, 'tail', 26), ang(roles, 'legs', 20))),
    }
    if tune:
        for n, kw in tune.items():
            for k, v in kw.items():
                if k == 'angles':
                    P[n].angles.update(v)
                else:
                    setattr(P[n], k, v)
    return P


def standard_fx(fig, style='slash', weapon=None):
    """칸별 효과. style: slash(베기 호) · claw(세 줄 할퀴기) · magic(구체·빔) · breath(불길) · punch(충격·먼지) · feather(깃털)."""

    def hand(b, tips):
        if weapon and weapon in tips:
            return tips[weapon]
        x0, y0, x1, y1 = bbox(fig, b.img)
        y = (y0 + y1) / 2
        return front_at(fig, b.img, y) - 1, y

    def speed(b, x0, y0, n=3, length=8):
        for i in range(n):
            y = y0 + i * 5
            fx_ = b.f
            row = np.nonzero(body_mask(fx_, b.img)[int(min(CELL - 1, y))])[0]
            if len(row):
                bx = row.max() + 3
                b.line(bx, y, bx + length - i * 2, y, 1 + (i % 2))

    def impact(b, x, y, big=False):
        r = 3 if big else 2
        b.spark(x, y, 0, r, 1)
        for dx, dy in ((-1, -1), (1, 1), (-1, 1), (1, -1)):
            for d in range(r + 1, r + 3):
                b.px(x + dx * d, y + dy * d, 2)

    def swing(b, x, y, r, a0, a1, w=2):
        b.arc(x, y, r, a0, a1, w, (0, 1, 2))

    def charge(b, x, y, r):
        b.disc(x, y, r)
        for a in range(0, 360, 60):
            t = math.radians(a + r * 13)
            b.px(x + math.cos(t) * (r + 4), y + math.sin(t) * (r + 4), 1 if a % 120 else 2)

    def fx(n):
        def run(b, tips):
            x0, y0, x1, y1 = bbox(fig, b.img)
            midy = (y0 + y1) / 2
            fr = front_at(fig, b.img, midy)
            hx, hy = hand(b, tips)
            if n == 'move':
                speed(b, x1, y0 + (y1 - y0) * 0.3, 3, 9)
            elif n == 'attack':
                if style == 'slash':
                    swing(b, fr + 8, midy - 2, 12, 150, 250, 2)
                elif style == 'claw':
                    for i in range(3):
                        b.line(fr - 1 - i * 3, midy - 7 + i, fr - 5 - i * 3, midy + 5 + i, 0 if i == 1 else 1)
                elif style == 'punch':
                    impact(b, fr - 2, y1 - 3, True)
                    b.dust(fr - 12, BASE, 2)
                elif style in ('magic', 'breath'):
                    impact(b, hx - 3, hy, False)
                elif style == 'feather':
                    for i in range(3):
                        b.line(fr - 2, midy + 4 + i * 3, fr - 8, midy + 2 + i * 4, i % 2)
            elif n == 'recover':
                b.dust(x1 - 2, BASE, 2) if style == 'punch' else None
            elif n == 'hit':
                impact(b, fr - 3, y0 + (y1 - y0) * 0.35, False)
            elif n == 'dead':
                b.dust(x0 - 4, BASE, 1)
            elif n == 'cast_charge':
                charge(b, hx - 1, hy, 2)
            elif n == 'cast_raise':
                charge(b, hx, hy - 3, 3)
                for i in range(3):
                    b.px(x0 - 2 + i * 7, y1 - 2 - i * 4, 2)
            elif n == 'cast_release':
                if style == 'breath':
                    for i in range(6):
                        b.disc(hx - 3 - i * 3.2, hy + i * 0.6, 1.2 + i * 0.35, 0, 1, 2)
                else:
                    b.disc(hx - 6, hy, 3)
                    b.line(hx - 1, hy, hx - 3, hy, 1)
                    b.line(hx - 11, hy - 2, hx - 14, hy - 3, 2); b.line(hx - 11, hy + 2, hx - 14, hy + 3, 2)
            elif n == 'leap':
                b.dust(x0 + 2, BASE, 3)
                for i in range(2):
                    b.line(x1 - 4 + i * 5, y1 + 3, x1 + i * 5, y1 + 7, 2)
            elif n == 'buff':
                b.aura(1, 1, spikes=(int(x0 + 3), int((x0 + x1) / 2), int(x1 - 3)), tip=0)
            elif n == 'finisher':
                if style == 'slash':
                    swing(b, fr + 12, midy, 17, 120, 260, 3)
                elif style == 'claw':
                    for i in range(4):
                        b.line(fr - i * 3, midy - 12 + i, fr - 7 - i * 3, midy + 8 + i, 0 if i in (1, 2) else 1)
                elif style == 'punch':
                    impact(b, fr - 3, y1 - 4, True)
                    b.dust(fr - 14, BASE, 2)
                    b.dust(x1 + 1, BASE, 2)
                elif style == 'breath':
                    for i in range(7):
                        b.disc(hx - 3 - i * 3.4, hy + i * 0.5, 1.5 + i * 0.45, 0, 1, 2)
                elif style == 'magic':
                    b.disc(hx - 7, hy, 5)
                    for a in range(0, 360, 45):
                        t = math.radians(a)
                        b.line(hx - 7 + math.cos(t) * 7, hy + math.sin(t) * 7, hx - 7 + math.cos(t) * 9, hy + math.sin(t) * 9, 1 if a % 90 else 0)
                elif style == 'feather':
                    for i in range(5):
                        b.line(fr - 2 - i, y0 + 8 + i * 6, fr - 10 - i, y0 + 6 + i * 7, i % 2)
                b.spark(x0 + 2, y0 + 2, 0, 1, 1)
        return run
    return {n: fx(n) for n in NAMES}


def run(chip, rig, roles, style='slash', weapon=None, hover=0, tune=None, extra_fx=None):
    poses = standard(rig, roles, hover, tune)
    fxs = standard_fx(rig.fig, style, weapon)
    if extra_fx:
        fxs.update(extra_fx(rig.fig, fxs))
    return build(chip, rig.fig, lambda n: rig.cell(poses[n], fxs.get(n)), flying=rig.flying)

