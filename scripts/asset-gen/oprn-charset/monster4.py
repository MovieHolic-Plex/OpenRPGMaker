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


CHARACTERS = [treant, mushroom, kappa, kitsune, None, None, None, None]


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
