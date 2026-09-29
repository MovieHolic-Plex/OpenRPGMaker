"""OPRN 자체 몬스터 걷기 칩 Monster4 (묶음 m4: 숲·요괴 8명) 생성기.

RM2K3 CharSet 288×256 RGBA. 캐릭터 8명 = 4열×2행 72×128 블록, 블록 안 3열(걷기 패턴 0·1·2, 1 = 서 있는 발) × 4행(0 위 · 1 오른쪽 · 2 아래 · 3 왼쪽).
칸 24×32. 모든 도트는 좌표·다각형·손으로 친 픽셀로 그린다(외부 그림 없음). 캐릭터마다 함수 하나: f(d, p) → 24×32 RGBA 배열.
외곽선은 칠한 뒤 한 번에 찍는다(투명 칸 중 칠한 칸과 상하좌우로 닿는 칸 → 'ol'). 왼쪽 보기(행 3)는 오른쪽 보기를 좌우 반전.

    python3 scripts/asset-gen/oprn-charset/monster4.py        # 시트 + .omo/nm4/charset-x4.png
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'public/assets/generated/charsets/Monster4.png'
QA = ROOT / '.omo/nm4'
PLACEHOLDER = QA / 'placeholder.png'
W, H = 24, 32
UP, RIGHT, DOWN, LEFT = 0, 1, 2, 3
FEET = 29  # 칠한 발의 마지막 줄(외곽선은 30, 칸 바닥 31 은 비운다)


def hexrgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


class Cel:
    """24×32 색 번호 캔버스. 0 = 투명, 1.. = 팔레트 이름 순서."""

    def __init__(self, pal):
        self.pal = pal
        self.names = list(pal)
        self.im = Image.new('P', (W, H), 0)
        self.d = ImageDraw.Draw(self.im)

    def i(self, n):
        return self.names.index(n) + 1

    def rect(self, x0, y0, x1, y1, n):
        self.d.rectangle([min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1)], fill=self.i(n))

    def ell(self, x0, y0, x1, y1, n):
        self.d.ellipse([x0, y0, x1, y1], fill=self.i(n))

    def poly(self, pts, n):
        self.d.polygon([tuple(p) for p in pts], fill=self.i(n))

    def line(self, pts, n, w=1):
        self.d.line([tuple(p) for p in pts], fill=self.i(n), width=w)

    def px(self, x, y, n):
        if 0 <= x < W and 0 <= y < H:
            self.im.putpixel((int(x), int(y)), self.i(n))

    def pxs(self, pts, n):
        for x, y in pts:
            self.px(x, y, n)

    def clear(self, x, y):
        if 0 <= x < W and 0 <= y < H:
            self.im.putpixel((int(x), int(y)), 0)

    def finish(self, outline='ol'):
        a = np.array(self.im, dtype=np.int16)
        m = a > 0
        nb = np.zeros_like(m)
        nb[1:] |= m[:-1]
        nb[:-1] |= m[1:]
        nb[:, 1:] |= m[:, :-1]
        nb[:, :-1] |= m[:, 1:]
        a[(~m) & nb] = self.i(outline)
        return a


def to_rgba(a, pal):
    cols = [(0, 0, 0, 0)] + [hexrgb(v) + (255,) for v in pal.values()]
    lut = np.array(cols, dtype=np.uint8)
    return lut[a]


def mirror(fn):
    """오른쪽 보기 함수로 왼쪽 보기를 만든다."""
    def wrapped(d, p):
        if d == LEFT:
            return np.ascontiguousarray(np.fliplr(fn(RIGHT, p)))
        return fn(d, p)
    return wrapped


# ───────────────────────── 0 트렌트 ─────────────────────────
PAL_TREANT = {
    'ol': '#1c1109', 'b0': '#4a2c16', 'b1': '#7a4c28', 'b2': '#a8743e', 'b3': '#cf9c5c',
    'l0': '#1d4318', 'l1': '#357326', 'l2': '#5fa83a', 'l3': '#a2d85a',
    'm0': '#56643a', 'm1': '#8a9a58', 'm2': '#b6c47e', 'ey': '#f4e25a',
}


def _treant_crown(c, oy, back=False, side=False):
    dx = -1 if side else 0
    bot = 15 if back else 13
    c.ell(2 + dx, 5 + oy, 7 + dx, 11 + oy, 'l0')
    c.ell(16 + dx, 5 + oy, 21 + dx, 11 + oy, 'l0')
    c.ell(3 + dx, 1 + oy, 20 + dx, bot + oy, 'l0')
    c.ell(3 + dx, 1 + oy, 18 + dx, bot - 2 + oy, 'l1')
    c.ell(2 + dx, 5 + oy, 6 + dx, 9 + oy, 'l1')
    c.ell(5 + dx, 2 + oy, 11 + dx, 6 + oy, 'l2')
    c.pxs([(6 + dx, 3 + oy), (7 + dx, 3 + oy), (8 + dx, 4 + oy)], 'l3')
    # 잎 뭉치 사이 그늘
    c.pxs([(12 + dx, 5 + oy), (13 + dx, 6 + oy), (9 + dx, 9 + oy), (10 + dx, 9 + oy), (15 + dx, 9 + oy), (5 + dx, 10 + oy)], 'l0')
    c.pxs([(14 + dx, 3 + oy), (15 + dx, 4 + oy), (4 + dx, 7 + oy)], 'l2')


def _treant_front(c, p, back):
    oy = 0 if p == 1 else -1
    lift = [-1, 0, 1][p]  # -1 왼발 들림, 1 오른발 들림
    # 뿌리 다리
    for side, x0 in ((-1, 7), (1, 13)):
        up = lift == side
        fy = FEET - 2 if up else FEET
        c.rect(x0 + 1, 24 + oy, x0 + 3, fy, 'b1')
        c.rect(x0 + 1, 24 + oy, x0 + 1, fy, 'b2')
        foot_x0 = x0 - 1 if side < 0 else x0 + 1
        c.rect(foot_x0, fy - 1, foot_x0 + 4, fy, 'b0')
        c.rect(foot_x0, fy - 1, foot_x0 + 3, fy - 1, 'b1')
    # 팔(가지)
    for side in (-1, 1):
        sw = lift * side

        def X(x):
            return x if side < 0 else 23 - x
        pts = [(X(7), 16 + oy), (X(5), 18 + oy + sw), (X(3), 21 + oy + sw)]
        c.line(pts, 'b0', 2)
        c.line(pts[:2], 'b1', 1)
        c.pxs([(X(2), 23 + oy + sw), (X(4), 23 + oy + sw), (X(2), 20 + oy + sw)], 'b0')
        c.pxs([(X(5), 17 + oy + sw), (X(4), 17 + oy + sw)], 'l1')
    # 몸통
    c.rect(7, 11 + oy, 16, 25 + oy, 'b1')
    c.rect(7, 11 + oy, 8, 25 + oy, 'b2')
    c.rect(7, 12 + oy, 7, 22 + oy, 'b3')
    c.rect(15, 11 + oy, 16, 25 + oy, 'b0')
    c.line([(11, 18 + oy), (11, 24 + oy)], 'b0')
    c.line([(13, 20 + oy), (13, 25 + oy)], 'b0')
    c.line([(9, 21 + oy), (9, 25 + oy)], 'b0')
    _treant_crown(c, oy, back=back)
    if back:
        # 등 쪽 옹이와 이끼
        c.ell(10, 17 + oy, 13, 20 + oy, 'b0')
        c.pxs([(11, 18 + oy), (12, 19 + oy)], 'b1')
        c.rect(8, 14 + oy, 15, 15 + oy, 'm1')
        c.pxs([(9, 16 + oy), (12, 16 + oy), (14, 16 + oy)], 'm0')
        return
    # 얼굴: 옹이 눈 + 이끼 수염
    c.rect(8, 14 + oy, 10, 15 + oy, 'ol')
    c.rect(13, 14 + oy, 15, 15 + oy, 'ol')
    c.px(10, 15 + oy, 'ey')
    c.px(13, 15 + oy, 'ey')
    c.line([(8, 13 + oy), (10, 13 + oy)], 'b0')
    c.line([(13, 13 + oy), (15, 13 + oy)], 'b0')
    c.poly([(8, 17 + oy), (15, 17 + oy), (14, 20 + oy), (12, 24 + oy), (11, 24 + oy), (9, 20 + oy)], 'm1')
    c.pxs([(10, 18 + oy), (10, 19 + oy), (12, 19 + oy), (12, 20 + oy), (12, 21 + oy), (14, 18 + oy)], 'm0')
    c.pxs([(9, 17 + oy), (11, 17 + oy)], 'm2')
    c.px(11, 16 + oy, 'b0')  # 입 그늘


def _treant_side(c, p):
    oy = 0 if p == 1 else -1
    st = [1, 0, -1][p]  # 가까운 다리 앞으로(+) / 뒤로(-)
    # 먼 팔(몸 뒤)
    fa = -st
    c.line([(10, 16 + oy), (10 + fa * 2, 19 + oy), (10 + fa * 3, 22 + oy)], 'b0', 2)
    # 다리: 먼 다리 먼저
    for leg, sgn in ((0, -1), (1, 1)):
        off = st * 2 * sgn
        x = 10 + off
        fy = FEET - (1 if (p != 1 and sgn * st < 0) else 0)
        col = 'b0' if leg == 0 else 'b1'
        c.rect(x, 24 + oy, x + 2, fy, col)
        c.rect(x, fy - 1, x + 4, fy, col)
        if leg == 1:
            c.rect(x, 24 + oy, x, fy - 1, 'b2')
            c.px(x + 4, fy, 'b0')
    # 몸통
    c.rect(8, 11 + oy, 15, 25 + oy, 'b1')
    c.rect(8, 11 + oy, 9, 25 + oy, 'b2')
    c.rect(8, 12 + oy, 8, 22 + oy, 'b3')
    c.rect(14, 11 + oy, 15, 25 + oy, 'b0')
    c.line([(11, 19 + oy), (11, 25 + oy)], 'b0')
    _treant_crown(c, oy, side=True)
    # 얼굴(오른쪽)
    c.rect(13, 14 + oy, 14, 15 + oy, 'ol')
    c.px(14, 15 + oy, 'ey')
    c.line([(12, 13 + oy), (15, 13 + oy)], 'b0')
    c.rect(16, 15 + oy, 16, 16 + oy, 'b1')  # 코 옹이
    c.poly([(12, 17 + oy), (16, 17 + oy), (17, 21 + oy), (15, 24 + oy), (13, 21 + oy)], 'm1')
    c.pxs([(14, 18 + oy), (14, 19 + oy), (15, 20 + oy), (15, 21 + oy)], 'm0')
    c.px(13, 17 + oy, 'm2')
    # 가까운 팔
    na = st
    pts = [(12, 16 + oy), (13 + na * 2, 19 + oy), (14 + na * 3, 22 + oy)]
    c.line(pts, 'b0', 3)
    c.line(pts, 'b2', 1)
    tx, ty = 14 + na * 3, 22 + oy
    c.pxs([(tx - 1, ty + 1), (tx, ty + 2), (tx + 1, ty + 1), (tx + 2, ty + 2)], 'b0')
    c.pxs([(12, 15 + oy), (13, 15 + oy)], 'l2')


@mirror
def treant(d, p):
    c = Cel(PAL_TREANT)
    if d in (UP, DOWN):
        _treant_front(c, p, back=d == UP)
    else:
        _treant_side(c, p)
    return to_rgba(c.finish(), PAL_TREANT)


def front_legs(c, p, xl, xr, top, w, col, foot=None, hi=None, lift=2):
    """정면·뒷면 두 다리. p0 = 왼다리 들림, p2 = 오른다리 들림."""
    up = [0, None, 1][p]
    for k, x in enumerate((xl, xr)):
        fy = FEET - (lift if up == k else 0)
        c.rect(x, top, x + w - 1, fy, col)
        if hi:
            c.rect(x, top, x, fy - 1, hi)
        if foot:
            c.rect(x - (1 if k == 0 else 0), fy, x + w - (0 if k == 0 else -0) - (0 if k == 0 else 0), fy, foot)


def side_legs(c, p, x, top, w, far, near, foot_far=None, foot_near=None, step=2, toe=1):
    """옆 보기 두 다리(오른쪽을 본다). p0 가까운 다리 앞, p2 뒤, p1 모음."""
    st = [1, 0, -1][p]
    for k, (col, fc) in enumerate(((far, foot_far), (near, foot_near))):
        sgn = -1 if k == 0 else 1
        dx = st * step * sgn
        fy = FEET - (1 if (st != 0 and dx < 0) else 0)
        c.rect(x + dx, top, x + dx + w - 1, fy, col)
        c.rect(x + dx, fy, x + dx + w - 1 + toe, fy, fc or col)


# ───────────────────────── 1 버섯 요정 ─────────────────────────
PAL_MUSH = {
    'ol': '#2a0e12', 'r0': '#7a1622', 'r1': '#c42a30', 'r2': '#f0604a', 'w0': '#e2cfa4', 'w1': '#fffaf0',
    's0': '#b8866a', 's1': '#f2c8a0', 's2': '#ffe6cc', 'g0': '#2f5a24', 'g1': '#5a9a3a', 'g2': '#9ad060', 'pk': '#f08a9a',
}


def _mush_cap(c, oy, x0=2, x1=21, spots=((5, 8, 3, 2), (11, 5, 3, 3), (17, 9, 2, 2), (8, 12, 2, 1), (14, 12, 2, 1)), gill=True):
    """갓: 큰 타원의 윗부분만 쓰고(16줄 아래는 지운다) 아랫단에 주름. 몸보다 먼저 그린다."""
    c.ell(x0, 3 + oy, x1, 26 + oy, 'r1')
    for y in range(16 + oy, 28 + oy):
        c.d.line([(0, y), (W - 1, y)], fill=0)
    c.ell(x0 + 2, 4 + oy, x0 + 8, 9 + oy, 'r2')
    c.line([(x1 - 1, 11 + oy), (x1, 15 + oy)], 'r0')
    c.line([(x1 - 3, 6 + oy), (x1 - 1, 10 + oy)], 'r0')
    for sx, sy, sw, sh in spots:
        c.rect(sx, sy + oy, sx + sw - 1, sy + sh - 1 + oy, 'w1')
        c.px(sx + sw - 1, sy + sh - 1 + oy, 'w0')
    c.rect(x0, 15 + oy, x1, 15 + oy, 'r0')
    if gill:
        c.rect(x0 + 2, 15 + oy, x1 - 2, 15 + oy, 'w0')
        for gx in range(x0 + 3, x1 - 2, 2):
            c.px(gx, 15 + oy, 's0')


def _mush_body(c, p, oy, back):
    front_legs(c, p, 9, 13, 26, 2, 's1', hi=None)
    for k, x in enumerate((8, 13)):
        fy = FEET - (2 if [0, None, 1][p] == k else 0)
        c.rect(x, fy - 1, x + 2, fy, 'r0')
    sw = [1, 0, -1][p]
    # 팔
    c.rect(6, 21 + oy + sw, 7, 24 + oy + sw, 's1')
    c.rect(16, 21 + oy - sw, 17, 24 + oy - sw, 's1')
    # 잎사귀 옷
    c.poly([(9, 20 + oy), (14, 20 + oy), (16, 26 + oy), (7, 26 + oy)], 'g1')
    c.line([(7, 26 + oy), (16, 26 + oy)], 'g0')
    c.pxs([(9, 26 + oy), (11, 25 + oy), (13, 26 + oy), (15, 25 + oy)], 'g0')
    c.line([(9, 21 + oy), (8, 24 + oy)], 'g2')
    if not back:
        c.line([(11, 21 + oy), (11, 24 + oy)], 'g0')
        c.line([(12, 21 + oy), (12, 24 + oy)], 'g0')


@mirror
def mushroom(d, p):
    c = Cel(PAL_MUSH)
    oy = 0 if p == 1 else -1
    if d in (UP, DOWN):
        back = d == UP
        if back:
            _mush_cap(c, oy, spots=((6, 7, 3, 3), (13, 6, 2, 2), (16, 10, 3, 2), (10, 11, 2, 2), (4, 12, 2, 1)), gill=False)
            _mush_body(c, p, oy, back)
            c.rect(8, 16 + oy, 15, 20 + oy, 's0')
            c.rect(9, 16 + oy, 14, 17 + oy, 's1')
        else:
            _mush_cap(c, oy)
            _mush_body(c, p, oy, back)
            c.rect(8, 16 + oy, 15, 21 + oy, 's1')
            c.rect(8, 16 + oy, 9, 18 + oy, 's2')
            c.rect(9, 18 + oy, 9, 19 + oy, 'ol')
            c.rect(14, 18 + oy, 14, 19 + oy, 'ol')
            c.px(8, 20 + oy, 'pk')
            c.px(15, 20 + oy, 'pk')
            c.rect(11, 20 + oy, 12, 20 + oy, 'r0')
    else:
        _mush_cap(c, oy, x0=3, x1=21, spots=((6, 7, 3, 2), (12, 5, 3, 3), (18, 10, 2, 2), (9, 11, 2, 1)))
        st = [1, 0, -1][p]
        for k in (0, 1):
            dx = st * 2 * (-1 if k == 0 else 1)
            fy = FEET - (1 if (st != 0 and dx < 0) else 0)
            col = 's0' if k == 0 else 's1'
            c.rect(10 + dx, 26, 11 + dx, fy, col)
            c.rect(10 + dx, fy - 1, 12 + dx, fy, 'r0')
        c.poly([(9, 20 + oy), (13, 20 + oy), (15, 26 + oy), (8, 26 + oy)], 'g1')
        c.line([(8, 26 + oy), (15, 26 + oy)], 'g0')
        c.line([(9, 21 + oy), (8, 25 + oy)], 'g2')
        c.rect(10, 16 + oy, 16, 21 + oy, 's1')
        c.rect(15, 18 + oy, 15, 19 + oy, 'ol')
        c.px(16, 20 + oy, 'pk')
        c.px(17, 19 + oy, 's1')
        c.px(10, 17 + oy, 's0')
        # 팔 앞뒤로
        c.rect(11 + st, 21 + oy, 12 + st, 24 + oy, 's2')
        c.px(12 + st * 2, 24 + oy, 's1')
    return to_rgba(c.finish(), PAL_MUSH)


# ───────────────────────── 2 갓파 ─────────────────────────
PAL_KAPPA = {
    'ol': '#0d1e14', 'k0': '#1f5a34', 'k1': '#3a8a48', 'k2': '#6cc060', 'k3': '#c2ea8e',
    'h0': '#4a3014', 'h1': '#7a5424', 'h2': '#a8803c', 'e0': '#c8901a', 'e1': '#f2c83a',
    'wa': '#5ab8e8', 'pl': '#e6eef2', 'hr': '#23402c', 'wh': '#f8f8ec',
}


def _kappa_dish(c, oy, x0=8, x1=15):
    c.ell(x0, 4 + oy, x1, 8 + oy, 'pl')
    c.ell(x0 + 1, 5 + oy, x1 - 1, 7 + oy, 'wa')
    c.px(x0 + 2, 5 + oy, 'wh')


@mirror
def kappa(d, p):
    c = Cel(PAL_KAPPA)
    oy = 0 if p == 1 else -1
    sw = [1, 0, -1][p]
    if d in (UP, DOWN):
        back = d == UP
        # 다리 + 물갈퀴 발
        up = [0, None, 1][p]
        for k, x in enumerate((8, 13)):
            fy = FEET - (2 if up == k else 0)
            c.rect(x, 24 + oy, x + 2, fy, 'k1')
            c.rect(x - 1, fy, x + 3, fy, 'k0')
            c.px(x + 1, fy, 'k2')
        # 팔
        for s, x in ((1, 5), (-1, 17)):
            ay = 18 + oy + sw * s
            c.rect(x, ay, x + 1, ay + 4, 'k1')
            c.rect(x - (1 if s > 0 else 0), ay + 4, x + 1 + (0 if s > 0 else 1), ay + 5, 'k0')
        # 몸
        c.ell(6, 16 + oy, 17, 27 + oy, 'k1')
        if back:
            # 등딱지
            c.ell(5, 14 + oy, 18, 27 + oy, 'h1')
            c.ell(6, 15 + oy, 14, 22 + oy, 'h2')
            c.line([(8, 18 + oy), (15, 18 + oy)], 'h0')
            c.line([(7, 23 + oy), (16, 23 + oy)], 'h0')
            c.line([(11, 15 + oy), (11, 26 + oy)], 'h0')
            c.pxs([(9, 20 + oy), (14, 21 + oy)], 'h0')
            c.ell(5, 5 + oy, 18, 16 + oy, 'k1')
            c.ell(5, 5 + oy, 18, 13 + oy, 'hr')
            for x in range(6, 18, 2):
                c.px(x, 14 + oy, 'hr')
            _kappa_dish(c, oy)
        else:
            c.ell(8, 17 + oy, 15, 26 + oy, 'k3')
            c.line([(9, 21 + oy), (14, 21 + oy)], 'k2')
            c.line([(9, 23 + oy), (14, 23 + oy)], 'k2')
            # 머리
            c.ell(5, 6 + oy, 18, 17 + oy, 'k2')
            c.ell(6, 7 + oy, 10, 10 + oy, 'k3')
            c.ell(5, 5 + oy, 18, 10 + oy, 'hr')
            c.rect(6, 10 + oy, 6, 12 + oy, 'hr')
            c.rect(17, 10 + oy, 17, 12 + oy, 'hr')
            c.pxs([(8, 10 + oy), (11, 10 + oy), (14, 10 + oy), (12, 10 + oy)], 'hr')
            _kappa_dish(c, oy)
            # 눈
            c.rect(8, 11 + oy, 9, 12 + oy, 'wh')
            c.rect(14, 11 + oy, 15, 12 + oy, 'wh')
            c.px(9, 12 + oy, 'ol')
            c.px(14, 12 + oy, 'ol')
            # 부리
            c.rect(10, 13 + oy, 13, 14 + oy, 'e1')
            c.rect(10, 15 + oy, 13, 15 + oy, 'e0')
            c.px(10, 13 + oy, 'wh')
    else:
        side_legs(c, p, 10, 24 + oy, 3, 'k0', 'k1', 'k0', 'k0', step=2, toe=1)
        # 먼 팔
        c.rect(12 - sw, 18 + oy, 13 - sw, 22 + oy, 'k0')
        c.ell(8, 16 + oy, 15, 27 + oy, 'k1')
        c.ell(12, 17 + oy, 16, 26 + oy, 'k3')
        # 등딱지(왼쪽 뒤)
        c.ell(4, 14 + oy, 11, 27 + oy, 'h1')
        c.ell(5, 15 + oy, 9, 21 + oy, 'h2')
        c.line([(5, 19 + oy), (10, 19 + oy)], 'h0')
        c.line([(5, 23 + oy), (10, 23 + oy)], 'h0')
        c.line([(8, 15 + oy), (8, 26 + oy)], 'h0')
        # 머리
        c.ell(6, 6 + oy, 17, 17 + oy, 'k2')
        c.ell(6, 5 + oy, 15, 10 + oy, 'hr')
        c.rect(6, 10 + oy, 8, 14 + oy, 'hr')
        c.pxs([(9, 10 + oy), (11, 11 + oy), (13, 10 + oy)], 'hr')
        _kappa_dish(c, oy, 7, 14)
        c.rect(14, 11 + oy, 15, 12 + oy, 'wh')
        c.px(15, 12 + oy, 'ol')
        c.poly([(15, 13 + oy), (20, 13 + oy), (19, 15 + oy), (15, 15 + oy)], 'e1')
        c.line([(15, 15 + oy), (19, 15 + oy)], 'e0')
        # 가까운 팔
        c.rect(12 + sw, 18 + oy, 13 + sw, 22 + oy, 'k2')
        c.rect(12 + sw, 23 + oy, 14 + sw, 23 + oy, 'k0')
    return to_rgba(c.finish(), PAL_KAPPA)


# ───────────────────────── 3 구미호 ─────────────────────────
PAL_KITSUNE = {
    'ol': '#2a1406', 'f0': '#8a3e0e', 'f1': '#d0741e', 'f2': '#f2a83a', 'f3': '#ffd878',
    'c0': '#dcc8a8', 'c1': '#fff6e6', 'rd': '#d02838', 'b0': '#3a6ad8', 'b1': '#9ad8ff',
}


def _tail(c, base, tip, w, col, tipcol, dark):
    (bx, by), (tx, ty) = base, tip
    c.line([(bx, by), ((bx + tx) / 2, (by + ty) / 2 + 1), (tx, ty)], dark, w + 1)
    c.line([(bx, by), ((bx + tx) / 2, (by + ty) / 2 + 1), (tx, ty)], col, w)
    c.px(tx, ty, tipcol)
    c.px(tx + (1 if tx < bx else -1), ty, tipcol)


def _kitsune_fan(c, cx, cy, oy, sway, back=False):
    import math
    for i in range(9):
        a = math.radians(-172 + i * 20.5 + sway * 3)
        r = 10 if i % 2 == 0 else 9
        tx = cx + math.cos(a) * r
        ty = cy + oy + math.sin(a) * r * 0.75
        col = 'f1' if i % 2 else 'f2'
        _tail(c, (cx, cy + oy), (round(tx), round(ty)), 2, col, 'c1', 'f0')


@mirror
def kitsune(d, p):
    c = Cel(PAL_KITSUNE)
    oy = 0 if p == 1 else -1
    sway = [-1, 0, 1][p]
    if d in (UP, DOWN):
        back = d == UP
        _kitsune_fan(c, 11.5, 22, oy, sway)
        up = [0, None, 1][p]
        # 뒷다리(양옆 조금)
        c.rect(7, 23 + oy, 8, FEET, 'f0')
        c.rect(15, 23 + oy, 16, FEET, 'f0')
        # 몸통
        c.ell(7, 16 + oy, 16, 26 + oy, 'f1')
        if not back:
            c.ell(9, 17 + oy, 14, 25 + oy, 'c1')
        # 앞다리
        for k, x in enumerate((9, 13)):
            fy = FEET - (2 if up == k else 0)
            c.rect(x, 22 + oy, x + 1, fy, 'f1' if back else 'f2')
            c.rect(x, fy, x + 1, fy, 'c0')
        # 머리
        hy = 8 + oy
        c.poly([(6, hy + 3), (7, hy - 3), (10, hy + 1)], 'f1')
        c.poly([(17, hy + 3), (16, hy - 3), (13, hy + 1)], 'f1')
        if not back:
            c.pxs([(7, hy), (8, hy + 1), (16, hy), (15, hy + 1)], 'f0')
        c.ell(6, hy, 17, hy + 9, 'f1')
        c.ell(7, hy, 12, hy + 3, 'f2')
        if back:
            c.pxs([(9, hy + 5), (14, hy + 5), (11, hy + 7), (12, hy + 7)], 'f0')
            c.ell(7, 16 + oy, 16, 20 + oy, 'f2')
        else:
            c.ell(8, hy + 5, 15, hy + 9, 'c1')
            c.rect(8, hy + 4, 9, hy + 4, 'ol')
            c.rect(14, hy + 4, 15, hy + 4, 'ol')
            c.px(9, hy + 3, 'rd')
            c.px(14, hy + 3, 'rd')
            c.rect(11, hy + 7, 12, hy + 7, 'ol')
            c.rect(11, hy + 1, 12, hy + 2, 'rd')
    else:
        # 옆 보기(오른쪽): 꼬리는 엉덩이 왼쪽 위로 부챗살
        import math
        for i in range(9):
            a = math.radians(-175 + i * 13 + sway * 4)
            r = 10 + (i % 3)
            tx = 7 + math.cos(a) * r
            ty = 17 + oy + math.sin(a) * r
            _tail(c, (7, 18 + oy), (round(tx), round(ty)), 2, 'f1' if i % 2 else 'f2', 'c1', 'f0')
        st = [1, 0, -1][p]
        # 먼 다리
        c.rect(8 - st, 22 + oy, 9 - st, FEET, 'f0')
        c.rect(15 + st, 22 + oy, 16 + st, FEET, 'f0')
        c.ell(6, 16 + oy, 17, 24 + oy, 'f1')
        c.ell(7, 16 + oy, 13, 19 + oy, 'f2')
        c.ell(10, 20 + oy, 16, 24 + oy, 'c1')
        # 가까운 다리
        c.rect(7 + st, 22 + oy, 8 + st, FEET - (1 if st < 0 else 0), 'f1')
        c.rect(14 - st, 22 + oy, 15 - st, FEET - (1 if st > 0 else 0), 'f2')
        c.px(9 + st, FEET - (1 if st < 0 else 0), 'c0')
        c.px(16 - st, FEET - (1 if st > 0 else 0), 'c0')
        # 머리
        hy = 8 + oy
        c.poly([(13, hy + 3), (14, hy - 3), (16, hy + 1)], 'f1')
        c.px(14, hy, 'f0')
        c.ell(12, hy, 20, hy + 8, 'f1')
        c.ell(13, hy + 1, 16, hy + 3, 'f2')
        c.poly([(18, hy + 4), (22, hy + 5), (21, hy + 7), (17, hy + 8)], 'c1')
        c.px(22, hy + 5, 'ol')
        c.rect(17, hy + 3, 18, hy + 3, 'ol')
        c.px(18, hy + 2, 'rd')
        c.ell(13, hy + 5, 17, hy + 9, 'c1')
    return to_rgba(c.finish(), PAL_KITSUNE)



# ───────────────────────── 4 너구리 둔갑사 ─────────────────────────
PAL_TANUKI = {
    'ol': '#1e140c', 't0': '#5a3a20', 't1': '#8a5e36', 't2': '#b8864e', 'bl': '#2e2420',
    'c0': '#c8b08a', 'c1': '#f0dcb4', 'lf': '#4a9a2e', 'l2': '#9ad84a', 'hat': '#7a5a30', 'h2': '#c89a4a',
    'wh': '#fffaf0', 'rd': '#c83a2a',
}


def _tanuki_leaf(c, x, y):
    c.poly([(x, y + 2), (x + 2, y - 1), (x + 5, y), (x + 3, y + 2)], 'lf')
    c.px(x + 2, y, 'l2')
    c.px(x - 1, y + 3, 't0')


@mirror
def tanuki(d, p):
    c = Cel(PAL_TANUKI)
    oy = 0 if p == 1 else -1
    sw = [1, 0, -1][p]
    if d in (UP, DOWN):
        back = d == UP
        up = [0, None, 1][p]
        if back:
            # 줄무늬 꼬리(뒤에서 보인다)
            c.ell(9, 20 + oy, 15, 28 + oy, 't1')
            c.line([(9, 23 + oy), (15, 23 + oy)], 'bl')
            c.line([(9, 26 + oy), (15, 26 + oy)], 'bl')
        for k, x in enumerate((8, 13)):
            fy = FEET - (2 if up == k else 0)
            c.rect(x, 24 + oy, x + 2, fy, 'bl')
        # 팔
        c.rect(5, 17 + oy + sw, 6, 21 + oy + sw, 'bl')
        c.rect(17, 17 + oy - sw, 18, 21 + oy - sw, 'bl')
        c.ell(6, 14 + oy, 17, 26 + oy, 't1')
        if not back:
            c.ell(8, 17 + oy, 15, 26 + oy, 'c1')  # 둥근 배
            c.px(11, 20 + oy, 'c0')
            c.px(9, 18 + oy, 'wh')
        else:
            c.ell(7, 15 + oy, 12, 19 + oy, 't2')
            c.ell(9, 20 + oy, 15, 28 + oy, 't1')
            c.line([(10, 23 + oy), (14, 23 + oy)], 'bl')
            c.line([(10, 26 + oy), (14, 26 + oy)], 'bl')
        # 머리
        c.ell(5, 6 + oy, 18, 16 + oy, 't1')
        c.ell(6, 7 + oy, 10, 10 + oy, 't2')
        c.ell(4, 3 + oy, 7, 7 + oy, 't0')
        c.ell(16, 3 + oy, 19, 7 + oy, 't0')
        # 삿갓
        c.poly([(3, 7 + oy), (11, 1 + oy), (12, 1 + oy), (20, 7 + oy)], 'hat')
        c.line([(5, 6 + oy), (11, 2 + oy)], 'h2')
        c.rect(3, 7 + oy, 20, 7 + oy, 't0')
        if back:
            _tanuki_leaf(c, 9, 0 + oy)
        else:
            # 너구리 눈 둘레 검은 가면
            c.poly([(6, 10 + oy), (10, 9 + oy), (11, 12 + oy), (7, 13 + oy)], 'bl')
            c.poly([(17, 10 + oy), (13, 9 + oy), (12, 12 + oy), (16, 13 + oy)], 'bl')
            c.px(9, 11 + oy, 'wh')
            c.px(14, 11 + oy, 'wh')
            c.ell(9, 12 + oy, 14, 16 + oy, 'c1')
            c.rect(11, 13 + oy, 12, 13 + oy, 'ol')
            c.px(11, 15 + oy, 't0')
            c.px(12, 15 + oy, 't0')
            _tanuki_leaf(c, 9, 0 + oy)
    else:
        st = [1, 0, -1][p]
        # 큰 줄무늬 꼬리(뒤, 걸음에 흔들린다)
        c.ell(1, 16 + oy + st, 8, 26 + oy + st, 't1')
        c.line([(2, 19 + oy + st), (7, 18 + oy + st)], 'bl')
        c.line([(1, 22 + oy + st), (7, 21 + oy + st)], 'bl')
        c.ell(1, 23 + oy + st, 5, 26 + oy + st, 'bl')
        side_legs(c, p, 10, 24 + oy, 3, 'ol', 'bl', 'ol', 'bl', step=2, toe=1)
        c.rect(10 - st, 17 + oy, 11 - st, 21 + oy, 'ol')
        c.ell(6, 14 + oy, 17, 26 + oy, 't1')
        c.ell(11, 17 + oy, 18, 26 + oy, 'c1')
        c.ell(7, 15 + oy, 11, 19 + oy, 't2')
        # 배 두드리는 가까운 팔
        c.line([(11, 18 + oy), (13 + st, 21 + oy)], 't0', 2)
        c.rect(14 + st, 21 + oy, 15 + st, 22 + oy, 'bl')
        # 머리
        c.ell(7, 6 + oy, 18, 16 + oy, 't1')
        c.ell(8, 3 + oy, 11, 7 + oy, 't0')
        c.poly([(14, 10 + oy), (18, 9 + oy), (18, 12 + oy), (15, 13 + oy)], 'bl')
        c.px(16, 11 + oy, 'wh')
        c.ell(16, 12 + oy, 21, 15 + oy, 'c1')
        c.rect(20, 12 + oy, 21, 13 + oy, 'ol')
        c.poly([(4, 7 + oy), (12, 1 + oy), (13, 1 + oy), (20, 7 + oy)], 'hat')
        c.line([(6, 6 + oy), (12, 2 + oy)], 'h2')
        c.rect(4, 7 + oy, 20, 7 + oy, 't0')
        _tanuki_leaf(c, 10, 0 + oy)
    return to_rgba(c.finish(), PAL_TANUKI)


# ───────────────────────── 5 이끼 골렘 ─────────────────────────
PAL_GOLEM = {
    'ol': '#161a1c', 's0': '#3c4448', 's1': '#666e70', 's2': '#949a96', 's3': '#c4c8c0',
    'g0': '#244a1a', 'g1': '#3f7a2a', 'g2': '#72b040', 'g3': '#b4e070',
    'ey': '#7af0c8', 'e2': '#e0fff4', 'fl': '#f2d24a',
}


def _moss(c, pts):
    for x, y in pts:
        c.rect(x, y, x + 2, y, 'g1')
        c.px(x + 1, y - 1, 'g2')
        c.px(x, y + 1, 'g0')


@mirror
def golem(d, p):
    c = Cel(PAL_GOLEM)
    oy = 0 if p == 1 else -1
    sw = [1, 0, -1][p]
    if d in (UP, DOWN):
        back = d == UP
        up = [0, None, 1][p]
        for k, x in enumerate((6, 13)):
            fy = FEET - (2 if up == k else 0)
            c.rect(x, 23 + oy, x + 4, fy, 's1')
            c.rect(x, 23 + oy, x + 1, fy - 1, 's2')
            c.rect(x, fy, x + 4, fy, 's0')
        # 큰 바위 주먹 팔
        for s, x in ((1, 1), (-1, 18)):
            ay = 12 + oy + sw * s
            c.rect(x, ay, x + 4, ay + 7, 's1')
            c.rect(x, ay, x + 1, ay + 6, 's2')
            c.rect(x, ay + 8, x + 4, ay + 11, 's0' if s < 0 else 's1')
            c.rect(x, ay + 8, x + 4, ay + 8, 's0')
            c.pxs([(x + 1, ay), (x + 2, ay), (x + 3, ay)], 'g2')
        # 몸통
        c.rect(5, 9 + oy, 18, 24 + oy, 's1')
        c.rect(5, 9 + oy, 7, 23 + oy, 's2')
        c.px(6, 10 + oy, 's3')
        c.rect(17, 10 + oy, 18, 24 + oy, 's0')
        c.line([(8, 17 + oy), (15, 17 + oy)], 's0')
        c.line([(12, 18 + oy), (12, 24 + oy)], 's0')
        # 머리(몸에 박힌 작은 바위) + 이끼 덮개
        c.rect(8, 4 + oy, 15, 10 + oy, 's1')
        c.rect(8, 4 + oy, 9, 9 + oy, 's2')
        c.rect(7, 3 + oy, 16, 5 + oy, 'g1')
        c.pxs([(8, 2 + oy), (10, 2 + oy), (13, 2 + oy), (15, 2 + oy)], 'g2')
        c.pxs([(7, 6 + oy), (16, 6 + oy), (11, 6 + oy)], 'g0')
        c.px(9, 3 + oy, 'g3')
        c.px(14, 2 + oy, 'fl')
        _moss(c, [(5, 9 + oy), (9, 9 + oy), (14, 9 + oy), (6, 22 + oy)])
        c.pxs([(16, 8 + oy), (17, 9 + oy)], 'g2')
        if back:
            _moss(c, [(8, 13 + oy), (13, 15 + oy), (9, 20 + oy)])
            c.px(11, 13 + oy, 'fl')
        else:
            c.rect(9, 7 + oy, 10, 7 + oy, 'ey')
            c.rect(13, 7 + oy, 14, 7 + oy, 'ey')
            c.px(9, 7 + oy, 'e2')
            c.px(13, 7 + oy, 'e2')
            # 가슴의 빛나는 룬
            c.pxs([(11, 12 + oy), (12, 12 + oy), (10, 13 + oy), (13, 13 + oy), (11, 14 + oy), (12, 14 + oy)], 'ey')
    else:
        st = [1, 0, -1][p]
        side_legs(c, p, 9, 23 + oy, 5, 's0', 's1', 's0', 's0', step=2, toe=0)
        # 먼 팔
        c.rect(9 - st * 2, 12 + oy, 12 - st * 2, 22 + oy, 's0')
        c.rect(5, 9 + oy, 17, 24 + oy, 's1')
        c.rect(5, 9 + oy, 7, 23 + oy, 's2')
        c.rect(16, 10 + oy, 17, 24 + oy, 's0')
        c.line([(8, 17 + oy), (15, 17 + oy)], 's0')
        # 등의 이끼 덩굴
        c.rect(4, 10 + oy, 6, 20 + oy, 'g1')
        c.pxs([(4, 21 + oy), (5, 22 + oy), (3, 12 + oy), (3, 15 + oy)], 'g1')
        c.pxs([(5, 11 + oy), (5, 14 + oy), (5, 17 + oy)], 'g2')
        c.px(4, 13 + oy, 'fl')
        # 머리
        c.rect(10, 4 + oy, 17, 10 + oy, 's1')
        c.rect(10, 4 + oy, 11, 9 + oy, 's2')
        c.rect(9, 3 + oy, 17, 5 + oy, 'g1')
        c.pxs([(10, 2 + oy), (13, 2 + oy), (16, 2 + oy)], 'g2')
        c.px(11, 3 + oy, 'g3')
        c.rect(15, 7 + oy, 16, 7 + oy, 'ey')
        c.px(16, 7 + oy, 'e2')
        _moss(c, [(7, 9 + oy), (12, 9 + oy)])
        # 가까운 팔(주먹 앞뒤)
        ax = 11 + st * 2
        c.rect(ax, 12 + oy, ax + 4, 20 + oy, 's1')
        c.rect(ax, 12 + oy, ax + 1, 19 + oy, 's2')
        c.rect(ax, 21 + oy, ax + 4, 24 + oy, 's1')
        c.rect(ax, 21 + oy, ax + 4, 21 + oy, 's0')
        c.pxs([(ax + 1, 12 + oy), (ax + 2, 12 + oy), (ax + 3, 12 + oy)], 'g2')
    return to_rgba(c.finish(), PAL_GOLEM)


# ───────────────────────── 6 얼음 요정 ─────────────────────────
PAL_ICE = {
    'ol': '#14244a', 'i0': '#3a64b0', 'i1': '#6ea8e8', 'i2': '#b4e0ff', 'i3': '#f2fcff',
    'sk': '#e8f0fa', 's0': '#a8bcdc', 'hr': '#dff4ff', 'h0': '#8ec8f0', 'ey': '#2a4ab0', 'pk': '#b8c8ff',
}


def _flake_wing(c, cx, cy, flap, left):
    """눈꽃 날개: 결정 가지 세 갈래. flap 0 펴짐 · 1 반 · 2 접힘."""
    s = -1 if left else 1
    spread = [6, 5, 3][flap]
    lift = [0, 2, 3][flap]
    tips = [(cx + s * spread, cy - 5 - lift), (cx + s * (spread + 1), cy - 1 - lift // 2), (cx + s * (spread - 1), cy + 3)]
    c.poly([(cx, cy - 2), tips[0], tips[1], tips[2], (cx, cy + 2)], 'i1')
    for tx, ty in tips:
        c.line([(cx, cy), (tx, ty)], 'i0', 1)
        c.px(tx, ty, 'i3')
    c.px(cx + s * 2, cy - 1, 'i3')


@mirror
def sprite_ice(d, p):
    c = Cel(PAL_ICE)
    hov = [0, 1, 0][p] - 1  # 떠다닌다: 1px 상하
    oy = -3 + hov
    flap = [0, 1, 2][p]
    if d in (UP, DOWN):
        back = d == UP
        if not back:
            _flake_wing(c, 8, 18 + oy, flap, True)
            _flake_wing(c, 15, 18 + oy, flap, False)
        # 드레스(얼음 종) — 발끝이 뾰족하다
        c.poly([(9, 16 + oy), (14, 16 + oy), (17, 26 + oy), (6, 26 + oy)], 'i1')
        c.poly([(9, 16 + oy), (11, 16 + oy), (9, 26 + oy), (6, 26 + oy)], 'i2')
        c.pxs([(6, 27 + oy), (9, 27 + oy), (11, 28 + oy), (14, 27 + oy), (17, 27 + oy)], 'i0')
        c.rect(6, 26 + oy, 17, 26 + oy, 'i0')
        c.px(8, 28 + oy, 'i2')
        c.px(15, 28 + oy, 'i2')
        # 발끝 고드름(바닥 기준: 떠 있어도 칸 아래 1~2px 위 그림자 없는 발)
        c.rect(10, 27 + oy, 10, 29 + oy + 1, 'sk')
        c.rect(13, 27 + oy, 13, 29 + oy + 1, 'sk')
        # 팔
        sw = [1, 0, -1][p]
        c.rect(7, 17 + oy + sw, 7, 20 + oy + sw, 'sk')
        c.rect(16, 17 + oy - sw, 16, 20 + oy - sw, 'sk')
        # 머리
        c.ell(6, 6 + oy, 17, 17 + oy, 'hr')
        c.ell(7, 7 + oy, 11, 10 + oy, 'i3')
        c.pxs([(6, 15 + oy), (17, 15 + oy), (6, 16 + oy), (17, 16 + oy)], 'h0')
        if back:
            c.pxs([(9, 14 + oy), (12, 15 + oy), (14, 13 + oy)], 'h0')
            _flake_wing(c, 8, 18 + oy, flap, True)
            _flake_wing(c, 15, 18 + oy, flap, False)
        else:
            c.rect(8, 11 + oy, 15, 16 + oy, 'sk')
            c.rect(8, 11 + oy, 15, 11 + oy, 'hr')
            c.pxs([(10, 12 + oy)], 'h0')
            c.rect(9, 13 + oy, 9, 14 + oy, 'ey')
            c.rect(14, 13 + oy, 14, 14 + oy, 'ey')
            c.px(8, 15 + oy, 'pk')
            c.px(15, 15 + oy, 'pk')
            c.px(11, 16 + oy, 's0')
        # 눈꽃 관
        c.pxs([(11, 3 + oy), (12, 3 + oy), (11, 5 + oy), (12, 5 + oy), (10, 4 + oy), (13, 4 + oy)], 'i1')
        c.pxs([(11, 4 + oy), (12, 4 + oy)], 'i3')
    else:
        _flake_wing(c, 10, 18 + oy, flap, True)
        c.poly([(11, 16 + oy), (15, 16 + oy), (18, 26 + oy), (8, 26 + oy)], 'i1')
        c.poly([(11, 16 + oy), (13, 16 + oy), (11, 26 + oy), (8, 26 + oy)], 'i2')
        c.rect(8, 26 + oy, 18, 26 + oy, 'i0')
        c.pxs([(8, 27 + oy), (12, 28 + oy), (15, 27 + oy), (18, 27 + oy)], 'i0')
        st = [1, 0, -1][p]
        c.rect(12 + st, 27 + oy, 12 + st, 29 + oy + 1, 'sk')
        c.rect(15 - st, 27 + oy, 15 - st, 29 + oy + 1, 's0')
        c.rect(14 + st, 17 + oy, 15 + st, 17 + oy, 'sk')
        c.rect(15 + st, 18 + oy, 16 + st, 19 + oy, 'sk')
        # 머리
        c.ell(7, 6 + oy, 18, 17 + oy, 'hr')
        c.ell(8, 7 + oy, 12, 10 + oy, 'i3')
        c.rect(12, 11 + oy, 18, 16 + oy, 'sk')
        c.rect(12, 11 + oy, 18, 11 + oy, 'hr')
        c.rect(7, 12 + oy, 11, 17 + oy, 'hr')
        c.pxs([(8, 16 + oy), (10, 17 + oy), (7, 15 + oy)], 'h0')
        c.rect(16, 13 + oy, 16, 14 + oy, 'ey')
        c.px(17, 15 + oy, 'pk')
        c.px(19, 14 + oy, 'sk')
        c.pxs([(12, 3 + oy), (13, 3 + oy), (12, 5 + oy), (13, 5 + oy), (11, 4 + oy), (14, 4 + oy)], 'i1')
        c.pxs([(12, 4 + oy), (13, 4 + oy)], 'i3')
    return to_rgba(c.finish(), PAL_ICE)


# ───────────────────────── 7 만드라고라 ─────────────────────────
PAL_MANDRAKE = {
    'ol': '#241408', 'r0': '#7a4e2a', 'r1': '#b07a44', 'r2': '#d8a868', 'r3': '#f0d09a',
    'l0': '#1e4a1a', 'l1': '#3a8a2a', 'l2': '#72c43a', 'l3': '#c0ec6a',
    'mo': '#4a0e14', 'fl': '#f0e2ff', 'f2': '#b88ae0',
}


def _mandrake_leaves(c, oy, dx=0, sway=0):
    # 머리 위 잎 세 장 + 꽃 한 송이
    c.poly([(11 + dx, 8 + oy), (5 + dx + sway, 1 + oy), (8 + dx + sway, 0 + oy), (12 + dx, 6 + oy)], 'l1')
    c.poly([(12 + dx, 8 + oy), (18 + dx + sway, 1 + oy), (15 + dx + sway, 0 + oy), (11 + dx, 6 + oy)], 'l1')
    c.poly([(11 + dx, 8 + oy), (10 + dx + sway, 1 + oy), (12 + dx + sway, -1 + oy), (13 + dx, 8 + oy)], 'l2')
    c.line([(6 + dx + sway, 1 + oy), (11 + dx, 7 + oy)], 'l0')
    c.line([(17 + dx + sway, 1 + oy), (12 + dx, 7 + oy)], 'l0')
    c.px(11 + dx + sway, 1 + oy, 'l3')
    c.px(7 + dx + sway, 1 + oy, 'l2')
    c.px(16 + dx + sway, 1 + oy, 'l2')


@mirror
def mandrake(d, p):
    c = Cel(PAL_MANDRAKE)
    oy = 0 if p == 1 else -1
    sway = [-1, 0, 1][p]
    sw = [1, 0, -1][p]
    if d in (UP, DOWN):
        back = d == UP
        oy2 = oy + 5
        up = [0, None, 1][p]
        # 잔뿌리 다리
        for k, x in enumerate((8, 13)):
            fy = FEET - (2 if up == k else 0)
            c.line([(x + 1, 22 + oy), (x + 1, fy)], 'r1', 2)
            c.px(x - 1 if k == 0 else x + 3, fy, 'r0')
            c.px(x if k == 0 else x + 2, fy, 'r0')
        # 가지 팔
        c.line([(7, 16 + oy2 - 2), (4, 14 + oy2 + sw), (3, 11 + oy2 + sw)], 'r1', 1)
        c.line([(16, 16 + oy2 - 2), (19, 14 + oy2 - sw), (20, 11 + oy2 - sw)], 'r1', 1)
        c.px(2, 11 + oy2 + sw, 'r0')
        c.px(21, 11 + oy2 - sw, 'r0')
        # 뿌리 몸(순무 모양)
        c.ell(6, 7 + oy2 - 2, 17, 20 + oy2 - 3, 'r1')
        c.poly([(8, 16 + oy2), (15, 16 + oy2), (12, 20 + oy2), (11, 20 + oy2)], 'r1')
        c.ell(7, 8 + oy2 - 2, 11, 12 + oy2 - 2, 'r2')
        c.px(8, 7 + oy2, 'r3')
        c.line([(15, 9 + oy2 - 1), (16, 13 + oy2 - 1)], 'r0')
        c.pxs([(9, 15 + oy2), (14, 13 + oy2), (13, 17 + oy2)], 'r0')
        _mandrake_leaves(c, oy + 4, 0, sway)
        if back:
            c.pxs([(10, 9 + oy2), (13, 11 + oy2), (11, 13 + oy2)], 'r0')
        else:
            # 비명 지르는 얼굴: 까만 두 눈, 벌린 입
            c.rect(8, 9 + oy2, 9, 10 + oy2, 'ol')
            c.rect(14, 9 + oy2, 15, 10 + oy2, 'ol')
            c.ell(10, 11 + oy2, 13, 14 + oy2, 'mo')
            c.px(11, 11 + oy2, 'ol')
            c.pxs([(18, 5 + oy + 4 + sway), (19, 4 + oy + 4 + sway)], 'fl')
    else:
        oy2 = oy + 5
        st = [1, 0, -1][p]
        for k in (0, 1):
            dx = st * 2 * (-1 if k == 0 else 1)
            fy = FEET - (1 if (st != 0 and dx < 0) else 0)
            col = 'r0' if k == 0 else 'r1'
            c.line([(11 + dx, 22 + oy), (11 + dx, fy)], col, 2)
            c.px(12 + dx + 1, fy, col)
        c.line([(10, 14 + oy2), (8 - st, 16 + oy2), (7 - st, 18 + oy2)], 'r0', 1)
        c.ell(6, 5 + oy2, 17, 17 + oy2, 'r1')
        c.poly([(8, 16 + oy2), (15, 16 + oy2), (12, 20 + oy2), (11, 20 + oy2)], 'r1')
        c.ell(7, 6 + oy2, 11, 10 + oy2, 'r2')
        c.px(8, 6 + oy2, 'r3')
        c.line([(7, 12 + oy2), (8, 15 + oy2)], 'r0')
        c.rect(15, 9 + oy2, 16, 10 + oy2, 'ol')
        c.ell(15, 11 + oy2, 18, 14 + oy2, 'mo')
        c.px(18, 11 + oy2, 'ol')
        c.line([(13, 14 + oy2), (16 + st, 16 + oy2), (18 + st, 15 + oy2)], 'r2', 1)
        _mandrake_leaves(c, oy + 4, -1, sway)
    return to_rgba(c.finish(), PAL_MANDRAKE)


CHARACTERS = [treant, mushroom, kappa, kitsune, tanuki, golem, sprite_ice, mandrake]


def build():
    QA.mkdir(parents=True, exist_ok=True)
    sheet = np.zeros((256, 288, 4), np.uint8)
    base = np.array(Image.open(PLACEHOLDER).convert('RGBA')) if PLACEHOLDER.exists() else None
    for ci, fn in enumerate(CHARACTERS):
        bx, by = ci % 4 * 72, ci // 4 * 128
        if fn is None:
            if base is not None:
                sheet[by:by + 128, bx:bx + 72] = base[by:by + 128, bx:bx + 72]
            continue
        for d in range(4):
            for p in range(3):
                sheet[by + d * 32: by + d * 32 + 32, bx + p * 24: bx + p * 24 + 24] = fn(d, p)
    im = Image.fromarray(sheet, 'RGBA')
    im.save(OUT)
    return im


def validate(im):
    a = np.array(im)
    errs = []
    if im.size != (288, 256):
        errs.append('size %s' % (im.size,))
    if not np.isin(a[:, :, 3], (0, 255)).all():
        errs.append('alpha not 0/255')
    for ci, fn in enumerate(CHARACTERS):
        if fn is None:
            continue
        bx, by = ci % 4 * 72, ci // 4 * 128
        blk = a[by:by + 128, bx:bx + 72]
        cols = {tuple(v) for v in blk[blk[:, :, 3] == 255][:, :3]}
        if len(cols) > 16:
            errs.append('char %d colors %d' % (ci, len(cols)))
        cells = []
        for d in range(4):
            for p in range(3):
                cell = blk[d * 32:d * 32 + 32, p * 24:p * 24 + 24]
                if not cell[:, :, 3].any():
                    errs.append('char %d empty %d,%d' % (ci, d, p))
                ys = np.nonzero(cell[:, :, 3].any(1))[0]
                if ys.size and (ys.max() > 30 or ys.max() < 27):
                    errs.append('char %d feet row %d at %d,%d' % (ci, ys.max(), d, p))
                cells.append(cell.tobytes())
        if len(set(cells)) != 12:
            errs.append('char %d duplicate cells (%d unique)' % (ci, len(set(cells))))
        print('char %d: colors %d, unique cells %d' % (ci, len(cols), len(set(cells))))
    return errs


if __name__ == '__main__':
    im = build()
    bg = Image.new('RGBA', im.size, (40, 128, 128, 255))
    bg.alpha_composite(im)
    bg.resize((im.width * 4, im.height * 4), Image.NEAREST).save(QA / 'charset-x4.png')
    errs = validate(im)
    print('OK' if not errs else '\n'.join(errs))
