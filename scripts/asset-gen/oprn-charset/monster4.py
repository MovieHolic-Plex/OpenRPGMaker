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
    pts = [(11, 16 + oy), (11 + na * 2, 19 + oy), (11 + na * 3, 22 + oy)]
    c.line(pts, 'b1', 2)
    c.line(pts[:2], 'b2', 1)
    c.pxs([(11 + na * 3 - 1, 24 + oy), (11 + na * 3 + 1, 24 + oy)], 'b0')
    c.px(12 + na, 17 + oy, 'l2')


@mirror
def treant(d, p):
    c = Cel(PAL_TREANT)
    if d in (UP, DOWN):
        _treant_front(c, p, back=d == UP)
    else:
        _treant_side(c, p)
    return to_rgba(c.finish(), PAL_TREANT)


CHARACTERS = [treant, None, None, None, None, None, None, None]


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
