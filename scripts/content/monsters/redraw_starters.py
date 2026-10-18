"""첫 지역 스타터 세 종(토리프 leafling · 파이린 sparkit · 아쿠링 aqualing)의 64×64 전투 앞·뒷모습을 손 도트로 그린다.

사용자 반려(c-1792294716295, 2026-10-18): 생성 그림을 64칸으로 줄인 하네스 스프라이트는 외곽선이 점선처럼 끊기고
잎맥이 계단으로 깨지고 발이 한 덩어리로 뭉개졌다. 축소·추적 없이 부위 마스크를 직접 래스터화한다.

규칙(하네스 checks.ts 계약과 같다):
- 64×64 RGBA, 알파 0/255, 발 외곽선이 맨 아랫줄(y=63)에 닿는다, 몸은 긴 변 56 이내, 색 20개 이하.
- 부위마다 4방향 1px 외곽선 고리(끊김 없음) → 왼쪽 위 빛 기준 3단 셀 명암(그늘·중간·빛).
- 앞모습은 왼쪽(상대 쪽)을 본다. 뒷모습은 오른쪽 위로 등을 보인다. 뒷모습에는 눈을 그리지 않는다.
- 앞모습 눈: 어두운 눈동자 ≥12칸 + 2×2 흰 반짝임, 외곽선과 떨어져 있다.

출력은 harness-data/monster-collect-species/authored/<종>-<면>.png. ledger 의 pick.authored 가 이 파일을 가리키면
`npm run harness -- monster-collect-species build` 가 격자 축소 대신 이 그림을 번들에 쓰고 대기 스트립을 다시 굽는다.

    python3 scripts/content/monsters/redraw_starters.py            # 여섯 장 쓰기
    python3 scripts/content/monsters/redraw_starters.py --preview  # /tmp/redraw-starters.png 8배 확인 시트
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pixel_lib import ROOT, bezier, blank, ellipse, poly, tapered  # noqa: E402

S = 64
OUT = ROOT / "harness-data/monster-collect-species/authored"


# ── 마스크 ───────────────────────────────────────────────────

def M(img):
    return np.array(img) > 0


def ell(c, rx, ry):
    return M(ellipse(blank(S), c, rx, ry))


def pol(pts):
    return M(poly(blank(S), pts))


def taper(a, b, wa, wb, bulge=0.0, mid=0.5):
    return pol(tapered(a, b, wa, wb, bulge, mid))


def curve_leaf(base, ctrl, tip, width, n=10):
    """곡선 잎: base→ctrl→tip 2차 곡선을 따라 가운데가 가장 넓은 잎."""
    pts = bezier(base, ctrl, tip, n)
    left, right = [], []
    for i, p in enumerate(pts):
        q = pts[min(i + 1, n)] if i < n else pts[i]
        o = pts[max(i - 1, 0)] if i > 0 else pts[i]
        dx, dy = q[0] - o[0], q[1] - o[1]
        ln = (dx * dx + dy * dy) ** 0.5 or 1
        nx, ny = -dy / ln, dx / ln
        t = i / n
        w = width * (4 * t * (1 - t)) ** 0.8 / 2 + (0.8 if t < 0.15 else 0)
        left.append((p[0] + nx * w, p[1] + ny * w))
        right.append((p[0] - nx * w, p[1] - ny * w))
    return pol(left + right[::-1]), pts


def shift(m, dx, dy):
    """out[y, x] = m[y - dy, x - dx] (밖은 False)."""
    out = np.zeros_like(m)
    h, w = m.shape
    ys, yd = (slice(0, h - dy), slice(dy, h)) if dy >= 0 else (slice(-dy, h), slice(0, h + dy))
    xs, xd = (slice(0, w - dx), slice(dx, w)) if dx >= 0 else (slice(-dx, w), slice(0, w + dx))
    out[yd, xd] = m[ys, xs]
    return out


def n4(m):
    return shift(m, 1, 0).astype(int) + shift(m, -1, 0) + shift(m, 0, 1) + shift(m, 0, -1)


def tidy(m):
    """한 칸 가시(4방향 이웃 1개 이하)를 깎고 세 방향이 막힌 한 칸 구멍을 메운다 — 계단 잡티 제거."""
    m = m.copy()
    for _ in range(4):
        n = n4(m)
        nxt = (m & (n >= 2)) | (~m & (n >= 3))
        if (nxt == m).all():
            break
        m = nxt
    return m


# ── 캔버스 ───────────────────────────────────────────────────

class Sprite:
    def __init__(self, ink):
        self.ink = ink
        self.rgb = np.zeros((S, S, 3), np.uint8)
        self.a = np.zeros((S, S), bool)
        self.body = np.zeros((S, S), bool)

    def fill(self, m, color):
        self.rgb[m] = color
        self.a |= m

    def px(self, x, y, color):
        self.rgb[y, x] = color
        self.a[y, x] = True

    def part(self, m, ramp, light=(1, 2), dark=(1, 2), spot=None, ink=None):
        """외곽선 고리 + 3단 셀 명암. ramp=(그늘, 중간, 빛). 빛은 왼쪽 위, 그늘은 오른쪽 아래 가장자리 띠."""
        m = tidy(m)
        if not m.any():
            return m
        ring = (shift(m, 1, 0) | shift(m, -1, 0) | shift(m, 0, 1) | shift(m, 0, -1)) & ~m
        self.fill(ring, ink or self.ink)
        sh = m & ~shift(m, -dark[0], -dark[1])  # 오른쪽 아래로 dark 만큼 밖이면 그늘
        hi = m & ~shift(m, light[0], light[1]) & ~sh  # 왼쪽 위로 light 만큼 밖이면 빛
        sh, hi = tidy(sh) & m, tidy(hi) & m & ~sh
        self.fill(m, ramp[1])
        self.fill(sh, ramp[0])
        self.fill(hi, ramp[2])
        if spot is not None:
            self.fill(spot & m & ~sh, ramp[2])
        self.body |= m
        return m

    def line(self, pts, color, clip=None):
        im = blank(S)
        ImageDraw.Draw(im).line([(round(x), round(y)) for x, y in pts], fill=255, width=1)
        m = M(im)
        if clip is not None:
            m &= clip
        self.fill(m, color)

    def eye(self, x, y, w, h, dark, white, iris=None):
        """둥근 눈: w×h 어두운 덩어리(모서리 깎음) + 왼쪽 위 흰 반짝임 + 오른쪽 아래 홍채.
        양쪽 눈이 같은 방향(왼쪽 위)을 보도록 작은 눈(w=4)도 왼쪽 위(xx=1, yy=1..2)에 반짝임을 둔다."""
        for yy in range(h):
            for xx in range(w):
                corner = (yy in (0, h - 1)) and (xx in (0, w - 1))
                if not corner:
                    self.px(x + xx, y + yy, dark)
        if iris:
            ix0 = 2 if w >= 5 else 1
            for xx in range(ix0, w - 1):
                self.px(x + xx, y + h - 2, iris)
        if w >= 5:
            for yy in (1, 2):
                for xx in (1, 2):
                    self.px(x + xx, y + yy, white)
        else:
            self.px(x + 1, y + 1, white)
            self.px(x + 1, y + 2, white)
    def image(self):
        """잉크를 가로 가운데로 옮긴다(정수 칸 이동 — 화소는 그대로)."""
        cols = np.nonzero(self.a.any(axis=0))[0]
        dx = (S - (cols[0] + cols[-1] + 1)) // 2 if len(cols) else 0
        out = np.zeros((S, S, 4), np.uint8)
        out[..., :3] = self.rgb
        out[..., 3] = np.where(self.a, 255, 0)
        out = np.roll(out, dx, axis=1)
        return Image.fromarray(out, "RGBA")


def toes(sp, paw_m, color, gaps=2):
    """발 앞쪽 아래에 짧은 발가락 금(외곽선 색)을 긋는다."""
    ys, xs = np.nonzero(paw_m)
    if not len(xs):
        return
    bottom = ys.max()
    x0, x1 = xs[ys == bottom].min(), xs[ys == bottom].max()
    for k in range(1, gaps + 1):
        x = x0 + round((x1 - x0) * k / (gaps + 1))
        sp.px(x, bottom, color)
        sp.px(x, bottom - 1, color)


# ── 토리프 (leafling) ───────────────────────────────────────

LEAF_INK = (30, 44, 26)
FUR = ((72, 128, 60), (112, 172, 78), (160, 210, 108))
LEAF = ((64, 138, 42), (122, 194, 60), (184, 230, 96))
VEIN = (50, 106, 34)
CREAM = ((206, 192, 146), (244, 236, 200), (255, 252, 232))
ACORN = ((100, 58, 28), (150, 94, 46), (204, 144, 78))
EYE_D, EYE_W, EYE_I = (40, 28, 26), (255, 255, 255), (76, 48, 28)
BLUSH = (238, 150, 138)


def acorn_cap(sp, c, rx, ry):
    cap = ell(c, rx, ry) & (np.indices((S, S))[0] <= c[1] + 1)
    cap |= ell((c[0], c[1] + 1), rx + 1, 1.2)
    sp.part(cap, ACORN, light=(1, 1), dark=(1, 1))
    ys, xs = np.nonzero(tidy(cap))
    for y, x in zip(ys, xs):  # 깍정이 비늘: 마름모 격자 점
        if y < c[1] and (x + 2 * y) % 4 == 0 and (x - 2 * y) % 4 == 0 and tidy(cap)[y - 1, x] and tidy(cap)[y + 1, x]:
            sp.px(x, y, ACORN[0])
    stem = pol([(c[0] - 1, c[1] - ry - 3), (c[0] + 1, c[1] - ry - 3), (c[0] + 1, c[1] - ry + 1), (c[0] - 1, c[1] - ry + 1)])
    sp.part(stem, ACORN, light=(1, 1), dark=(1, 1))


def leaf_part(sp, base, ctrl, tip, width):
    """잎: 외곽선 + 3단 명암 + 가운데 잎맥 한 줄. 곁맥은 64칸에서 계단 잡티가 되어 긋지 않는다."""
    m, pts = curve_leaf(base, ctrl, tip, width)
    m = sp.part(m, LEAF, light=(1, 2), dark=(2, 1))
    sp.line(pts[2:-2], VEIN, clip=m & shift(m, 1, 0) & shift(m, -1, 0) & shift(m, 0, 1) & shift(m, 0, -1))
    return m


def leafling_front():
    sp = Sprite(LEAF_INK)
    leaf_part(sp, (44, 50), (54, 45), (54, 29), 10)  # 꼬리 잎
    far = ((72, 128, 60), (92, 150, 68), (128, 186, 90))
    for a, b in (((25, 49), (26, 59)), ((42, 51), (43, 59))):
        sp.part(taper(a, b, 5, 5) | ell((b[0], b[1] + 1), 3, 2), far)
    sp.part(ell((34, 49), 11, 8), FUR)
    hind = sp.part(ell((40, 52), 5.5, 5.5) | taper((39, 54), (38, 60), 6, 6) | ell((37, 60), 3.5, 2), FUR)
    front = sp.part(taper((21, 50), (20, 60), 6, 6) | ell((19, 60), 3.5, 2), FUR)
    toes(sp, hind & (np.indices((S, S))[0] >= 59), LEAF_INK)
    toes(sp, front & (np.indices((S, S))[0] >= 59), LEAF_INK)
    sp.part(ell((25, 48), 6, 5) | pol([(20, 51), (23, 55), (25, 51), (28, 55), (30, 50)]), CREAM)
    leaf_part(sp, (18, 30), (7, 25), (9, 10), 12)  # 왼쪽 잎 귀
    leaf_part(sp, (28, 28), (38, 23), (43, 10), 12)  # 오른쪽 잎 귀
    head = sp.part(ell((22, 39), 11.5, 9.5) | ell((16, 42), 5.5, 4.5), FUR, spot=ell((19, 33), 3, 1.5))
    sp.fill(tidy(head & ell((18, 46), 6.5, 3)) & head, CREAM[1])
    acorn_cap(sp, (23, 29), 7.5, 4)
    sp.eye(13, 38, 4, 5, EYE_D, EYE_W, EYE_I)
    sp.eye(21, 38, 5, 6, EYE_D, EYE_W, EYE_I)
    sp.px(17, 42, LEAF_INK)
    sp.px(18, 42, LEAF_INK)
    for x, y in ((16, 44), (17, 45), (18, 45), (19, 45), (20, 44)):
        sp.px(x, y, LEAF_INK)
    for x in (11, 12, 26, 27):
        sp.px(x, 43, BLUSH)
    return sp.image()


def leafling_back():
    sp = Sprite(LEAF_INK)
    far = ((72, 128, 60), (92, 150, 68), (128, 186, 90))
    for c in ((44, 59), (22, 59)):
        sp.part(ell(c, 4, 3.5), far)
    body = sp.part(ell((34, 50), 15, 9.5), FUR)
    for c in ((25, 60), (42, 60)):
        paw = sp.part(ell(c, 4.5, 3), FUR)
        sp.fill(ell((c[0], c[1] + 0.5), 2, 1.2) & paw, CREAM[1])
    leaf_part(sp, (26, 28), (12, 24), (10, 10), 13)
    leaf_part(sp, (38, 27), (51, 24), (54, 10), 13)
    sp.part(ell((33, 35), 12.5, 10.5), FUR, spot=ell((28, 30), 4, 2))
    sp.fill(tidy(ell((36, 45), 7, 2.5)) & body & ~ell((33, 35), 13.5, 11.5), FUR[0])
    acorn_cap(sp, (33, 26), 8, 4.5)
    leaf_part(sp, (26, 55), (12, 54), (10, 38), 11)  # 꼬리 잎(앞쪽)
    return sp.image()


# ── 파이린 (sparkit) ─────────────────────────────────────────

FIRE_INK = (44, 22, 18)
EMBER = ((198, 84, 34), (238, 128, 48), (255, 176, 88))
STRIPE = (150, 46, 30)
BELLY = ((222, 186, 128), (250, 226, 170), (255, 244, 210))
ROCK = ((40, 36, 40), (70, 62, 66), (104, 94, 96))
LAVA = ((236, 120, 30), (255, 196, 54), (255, 240, 150))
F_EYE_D, F_EYE_I = (36, 24, 30), (96, 52, 40)


def lava_ball(sp, c, r):
    m = sp.part(ell(c, r, r), ROCK, light=(1, 2), dark=(2, 2))
    cracks = [
        [(c[0] - r + 2, c[1] - 1), (c[0] - 2, c[1] - 2), (c[0] + 1, c[1] + 1), (c[0] + r - 2, c[1])],
        [(c[0] - 2, c[1] - 2), (c[0] - 3, c[1] - r + 2)],
        [(c[0] + 1, c[1] + 1), (c[0], c[1] + r - 2)],
        [(c[0] + 3, c[1] + 0.5), (c[0] + 4, c[1] - r + 3)],
    ]
    inner = m & shift(m, 1, 0) & shift(m, -1, 0) & shift(m, 0, 1) & shift(m, 0, -1)
    for cr in cracks:
        sp.line(cr, LAVA[1], clip=inner)
    return m


def flame_tuft(sp, base, h, lean=1):
    outer = pol([(base[0] - 4, base[1]), (base[0] - 3, base[1] - h * 0.5), (base[0] - 1, base[1] - h * 0.65),
                 (base[0] + lean, base[1] - h), (base[0] + 2, base[1] - h * 0.55), (base[0] + 4, base[1] - h * 0.7),
                 (base[0] + 4, base[1])])
    m = sp.part(outer, (LAVA[0], LAVA[0], LAVA[1]), light=(1, 1), dark=(1, 1))
    core = pol([(base[0] - 2, base[1]), (base[0], base[1] - h * 0.55), (base[0] + 2, base[1])]) & m
    sp.fill(tidy(core) & m, LAVA[2])
    return m


def sparkit_front():
    sp = Sprite(FIRE_INK)
    tail = sp.part(taper((42, 52), (49, 46), 7, 5, bulge=0.5), EMBER)
    lava_ball(sp, (53, 42), 8)
    flame_tuft(sp, (54, 35), 12)
    far = ((168, 66, 30), (204, 100, 40), (236, 140, 64))
    for a, b in (((26, 51), (26, 59)), ((42, 52), (43, 59))):
        sp.part(taper(a, b, 5, 5) | ell((b[0], b[1] + 1), 3, 2), far)
    body = sp.part(ell((34, 50), 12, 7.5), EMBER)
    for x0 in (31, 37):
        sp.line([(x0, 43), (x0 + 2, 47)], STRIPE, clip=body)
        sp.line([(x0 + 1, 43), (x0 + 3, 47)], STRIPE, clip=body)
    hind = sp.part(ell((41, 54), 5, 4.5) | taper((40, 55), (39, 60), 6, 6) | ell((38, 60), 3.5, 2), EMBER)
    front = sp.part(taper((23, 52), (22, 60), 6, 6) | ell((21, 60), 3.5, 2), EMBER)
    rows = np.indices((S, S))[0]
    toes(sp, hind & (rows >= 59), FIRE_INK)
    toes(sp, front & (rows >= 59), FIRE_INK)
    sp.part(ell((28, 52), 7, 4), BELLY)
    head = sp.part(ell((22, 39), 12, 9.5) | ell((16, 42), 6, 4.5), EMBER, spot=ell((18, 33), 4, 1.5))
    sp.fill(tidy(head & ell((19, 46), 7.5, 3.5)) & head, BELLY[1])
    sp.eye(13, 38, 4, 5, F_EYE_D, (255, 255, 255), F_EYE_I)
    sp.eye(21, 38, 5, 6, F_EYE_D, (255, 255, 255), F_EYE_I)
    sp.px(17, 42, FIRE_INK)
    sp.px(18, 42, FIRE_INK)
    for x, y in ((16, 44), (17, 45), (18, 45), (19, 45), (20, 45), (21, 44)):
        sp.px(x, y, FIRE_INK)
    for x in (11, 12, 26, 27):
        sp.px(x, 43, (250, 104, 78))
    sp.line([(25, 30), (26, 28)], STRIPE, clip=head)
    sp.line([(29, 31), (31, 29)], STRIPE, clip=head)
    return sp.image()


def sparkit_back():
    sp = Sprite(FIRE_INK)
    far = ((168, 66, 30), (204, 100, 40), (236, 140, 64))
    for c in ((46, 59), (26, 59)):
        sp.part(ell(c, 4, 3.5), far)
    body = sp.part(ell((36, 50), 15, 9.5), EMBER)
    for x0 in (30, 36, 42):
        sp.line([(x0, 42), (x0 + 1, 52)], STRIPE, clip=body)
        sp.line([(x0 + 1, 42), (x0 + 2, 52)], STRIPE, clip=body)
    for c in ((28, 60), (45, 60)):
        sp.part(ell(c, 4.5, 3), EMBER)
    head = sp.part(ell((38, 33), 12.5, 10), EMBER, spot=ell((33, 28), 4, 2))
    sp.line([(36, 24), (37, 28)], STRIPE, clip=head)
    sp.line([(41, 24), (41, 28)], STRIPE, clip=head)
    sp.part(taper((26, 54), (18, 52), 7, 5), EMBER)
    lava_ball(sp, (13, 47), 8.5)
    flame_tuft(sp, (13, 39), 13, lean=-1)
    return sp.image()


# ── 아쿠링 (aqualing) ───────────────────────────────────────

WATER_INK = (22, 34, 70)
BLUE = ((70, 132, 206), (110, 172, 236), (168, 214, 250))
PALE = ((206, 216, 222), (240, 244, 236), (255, 255, 250))
GILL = ((214, 92, 104), (244, 138, 140), (255, 192, 186))
W_EYE_D, W_EYE_I = (24, 30, 56), (38, 56, 98)


def gill(sp, base, tip, width):
    m, pts = curve_leaf(base, ((base[0] + tip[0]) / 2, (base[1] + tip[1]) / 2 - 1), tip, width, n=8)
    # 깃털 톱니: 양쪽 가장자리를 2칸마다 한 칸씩 파낸다
    edge = m & ~(shift(m, 1, 0) & shift(m, -1, 0) & shift(m, 0, 1) & shift(m, 0, -1))
    ys, xs = np.nonzero(edge)
    notch = np.zeros_like(m)
    for y, x in zip(ys, xs):
        if (x + y) % 3 == 0:
            notch[y, x] = True
    m = sp.part(m & ~notch, GILL, light=(1, 1), dark=(1, 1))
    sp.line(pts[1:-2], GILL[0], clip=m)
    return m


def aqualing_front():
    sp = Sprite(WATER_INK)
    tail = sp.part(curve_leaf((40, 54), (52, 56), (60, 46), 9)[0], BLUE)
    sp.fill(tidy(tail & ~shift(tail, 0, -2) & ~shift(tail, 1, 0)) & tail, PALE[1])
    gill(sp, (16, 30), (8, 16), 6)  # 먼 쪽 아가미
    gill(sp, (20, 29), (18, 13), 6)
    far = ((52, 108, 180), (86, 148, 214), (130, 186, 236))
    for a, b in (((25, 52), (25, 59)), ((41, 53), (42, 59))):
        sp.part(taper(a, b, 5, 5) | ell((b[0], b[1] + 1), 3, 2), far)
    sp.part(ell((34, 51), 12, 7), BLUE)
    hind = sp.part(ell((40, 55), 5, 4) | taper((39, 56), (38, 60), 6, 6) | ell((37, 60), 3.5, 2), BLUE)
    front = sp.part(taper((22, 53), (21, 60), 6, 6) | ell((20, 60), 3.5, 2), BLUE)
    rows = np.indices((S, S))[0]
    toes(sp, hind & (rows >= 59), WATER_INK)
    toes(sp, front & (rows >= 59), WATER_INK)
    sp.part(ell((28, 54), 7, 3.5), PALE)
    gill(sp, (31, 33), (44, 21), 7)  # 가까운 쪽 아가미 셋
    gill(sp, (33, 37), (48, 33), 7)
    gill(sp, (32, 41), (45, 46), 6)
    head = sp.part(ell((21, 40), 12.5, 9.5), BLUE, spot=ell((16, 34), 4, 1.5))
    sp.fill(tidy(head & ell((19, 47), 7.5, 3)) & head, PALE[1])
    sp.eye(13, 38, 4, 5, W_EYE_D, (255, 255, 255), W_EYE_I)
    sp.eye(22, 38, 5, 6, W_EYE_D, (255, 255, 255), W_EYE_I)
    for x, y in ((17, 44), (18, 45), (19, 45), (20, 45), (21, 44)):
        sp.px(x, y, WATER_INK)
    for x in (11, 12, 27, 28):
        sp.px(x, 43, (238, 150, 160))
    return sp.image()


def aqualing_back():
    sp = Sprite(WATER_INK)
    far = ((52, 108, 180), (86, 148, 214), (130, 186, 236))
    for c in ((46, 59), (24, 59)):
        sp.part(ell(c, 4, 3.5), far)
    sp.part(ell((35, 50), 13, 9), BLUE)
    for c in ((26, 60), (44, 60)):
        sp.part(ell(c, 4.5, 3), BLUE)
    for base, tip in (((25, 30), (8, 18)), ((24, 34), (6, 32)), ((25, 38), (9, 45))):
        gill(sp, base, tip, 7)
    for base, tip in (((44, 29), (58, 15)), ((45, 33), (60, 30)), ((44, 37), (57, 43))):
        gill(sp, base, tip, 7)
    sp.part(ell((35, 34), 12.5, 10), BLUE, spot=ell((30, 28), 4, 2))
    tail = sp.part(curve_leaf((28, 56), (16, 58), (8, 47), 10)[0], BLUE)
    sp.fill(tidy(tail & ~shift(tail, 0, -2) & ~shift(tail, -1, 0)) & tail, PALE[1])
    return sp.image()


DRAW = {
    "leafling": (leafling_front, leafling_back),
    "sparkit": (sparkit_front, sparkit_back),
    "aqualing": (aqualing_front, aqualing_back),
}


def main(argv):
    images = {(sp, side): fn() for sp, fns in DRAW.items() for side, fn in zip(("front", "back"), fns)}
    if "--preview" in argv:
        k = 8
        sheet = Image.new("RGBA", (3 * (S * k + 16), 2 * (S * k + 16)), (214, 228, 200, 255))
        for i, sp in enumerate(DRAW):
            for j, side in enumerate(("front", "back")):
                sheet.alpha_composite(images[(sp, side)].resize((S * k, S * k), Image.NEAREST), (i * (S * k + 16), j * (S * k + 16)))
        sheet.save("/tmp/redraw-starters.png")
        print("/tmp/redraw-starters.png")
        return
    OUT.mkdir(parents=True, exist_ok=True)
    for (sp, side), im in images.items():
        path = OUT / f"{sp}-{side}.png"
        im.save(path, optimize=True)
        colors = len({tuple(c) for c in np.array(im).reshape(-1, 4) if c[3]})
        print(path.relative_to(ROOT), im.getbbox(), colors, "colors")


if __name__ == "__main__":
    main(sys.argv[1:])
