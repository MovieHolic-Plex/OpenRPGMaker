"""월드맵 9단계(고유 아이콘) 그리기 도구 — 원본 EasyRPG World.png(CC BY 4.0)에 있는 색만 쓰는 손 도트 캔버스.

계약(3/4 시점): 모든 구조는 윗면 T + 앞면 F, 빛은 왼쪽 위, 그림자는 오른쪽 아래(SHADOW 키 = 밑 지형을 어둡게).
테두리는 한 줄, 색은 붙은 재질의 가장 어두운 색(석재 111618 · 나무 351803 · 잎 1d2c33 · 눈 065298 ...).
생성 이미지·트레이싱 없음 — 좌표는 전부 손으로 적은 것이다.
"""
import numpy as np
from PIL import Image, ImageDraw

KEY = (255, 103, 139)
SHADOW = (254, 103, 139)


def hx(s):
    return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))


def H(x, y, s=0):
    n = (np.asarray(x, np.int64) * 374761393 + np.asarray(y, np.int64) * 668265263 + s * 2246822519) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFF) / 65535.0


# ── 원본 World.png 의 색(아이콘 영역에서 뽑은 것) ──────────────────────────────────────────────
OUT = hx('111618')
STONE = [hx(c) for c in ('111618', '363540', '493f59', '515567', '66648b', '78739c', '8f8cb5', 'aac3b5')]      # 0 테 · 1..7
WSTONE = [hx(c) for c in ('111618', '564a3e', '766e60', 'b9ab9d', 'd8cbac', 'e1d7c1')]                         # 따뜻한 돌(폐허) 0..5
WOOD = [hx(c) for c in ('351803', '411e05', '63310b', '6d3b15', '9a5435', 'b77246', 'd59147')]               # 0..6
ROCK = [hx(c) for c in ('291010', '411e05', '4f2e21', '65442a', '714e29', '8c5a21', '987046', 'a77b4b', 'b99664', 'd7aa73')]
RED = [hx(c) for c in ('351803', '690907', '931d10', 'c21919', 'd2432d', 'e87c4a', 'e99453')]
BLUE = [hx(c) for c in ('1d2c33', '065298', '086bba', '208ef8', '6fb1ff', '74d1d2')]
SNOW = [hx(c) for c in ('065298', '6fb1ff', '74d1d2', 'cfecec', 'dcf7f9', 'f0faff')]                           # 그늘 → 밝음
LEAF = [hx(c) for c in ('1d2c33', '13522e', '218238', '3d882b', '40a837', '77ac40', '7ac83c', 'b9cb45')]
VOLC = [hx(c) for c in ('111618', '464f49', '575e58', '616a62', '758276', '849c97')]
LAVA = [hx(c) for c in ('690907', '931d10', 'c21919', 'd2432d', 'e87c4a', 'e99453')]
WATER = [hx(c) for c in ('065298', '086bba', '208ef8', '6fb1ff', '74d1d2', 'cfecec')]
SAND = [hx(c) for c in ('987046', 'a77b4b', 'b99664', 'd7aa73', 'd8cbac', 'e1d7c1')]
GOLD = [hx(c) for c in ('63310b', '9a5435', 'b77246', 'd59147', 'e99453')]
GREY = [hx(c) for c in ('111618', '363540', '564a3e', '766e60', 'b9ab9d', 'd8cbac')]
PURP = [hx(c) for c in ('1d2c33', '493f59', '66648b', '78739c', '8f8cb5')]

# 재질별 테두리 색: 팔레트 안 색 → 그 재질의 가장 어두운 색
_OUT = {}


def _reg(ramp, out):
    for c in ramp:
        _OUT.setdefault(c, out)


_reg(STONE, hx('111618')); _reg(WSTONE, hx('111618')); _reg(WOOD, hx('351803')); _reg(ROCK, hx('291010'))
_reg(RED, hx('351803')); _reg(BLUE, hx('1d2c33')); _reg(SNOW, hx('065298')); _reg(LEAF, hx('1d2c33'))
_reg(VOLC, hx('111618')); _reg(LAVA, hx('351803')); _reg(WATER, hx('065298')); _reg(SAND, hx('4f2e21'))
_reg(GOLD, hx('351803')); _reg(GREY, hx('111618')); _reg(PURP, hx('111618'))
for _c in ('351803', '411e05'):
    _OUT[hx(_c)] = hx('000000')


class P:
    """한 칸 = 16px. P(2,2) = 32x32."""

    def __init__(self, cw, ch):
        self.w, self.h = cw * 16, ch * 16
        self.px = np.zeros((self.h, self.w, 3), np.uint8)
        self.px[:] = KEY
        self.Y, self.X = np.mgrid[0:self.h, 0:self.w]

    # ── 기본 ──
    def dot(self, x, y, col):
        if 0 <= x < self.w and 0 <= y < self.h and col is not None:
            self.px[y, x] = col

    def get(self, x, y):
        return tuple(int(v) for v in self.px[y, x])

    def solid(self):
        return ~(np.all(self.px == np.array(KEY, np.uint8), -1) | np.all(self.px == np.array(SHADOW, np.uint8), -1))

    def rect(self, x0, y0, x1, y1, col):
        """양끝 포함."""
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.dot(x, y, col)

    def hl(self, x0, x1, y, col):
        for x in range(x0, x1 + 1):
            self.dot(x, y, col)

    def vl(self, x, y0, y1, col):
        for y in range(y0, y1 + 1):
            self.dot(x, y, col)

    def _mask(self, fn):
        im = Image.new('L', (self.w, self.h), 0)
        fn(ImageDraw.Draw(im))
        return np.array(im) > 0

    def mpoly(self, pts):
        return self._mask(lambda d: d.polygon(pts, fill=255))

    def mell(self, cx, cy, rx, ry):
        return self._mask(lambda d: d.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=255))

    def mrect(self, x0, y0, x1, y1):
        m = np.zeros((self.h, self.w), bool)
        m[max(y0, 0):y1 + 1, max(x0, 0):x1 + 1] = True
        return m

    def fill(self, mk, col):
        self.px[mk] = col

    def poly(self, pts, col):
        self.fill(self.mpoly(pts), col)

    def ell(self, cx, cy, rx, ry, col):
        self.fill(self.mell(cx, cy, rx, ry), col)

    # ── 명암 ──
    def shade(self, mk, ramp, fn, dither=True, seed=1, noise=0.0):
        """fn(X,Y) → 0..1(밝음). 계단 양자화 + 경계 체크 디더."""
        t = np.clip(fn(self.X, self.Y) + (H(self.X, self.Y, seed) - .5) * noise, 0, .9999)
        n = len(ramp)
        v = t * (n - 1)
        lo = np.floor(v).astype(int)
        fr = v - lo
        chk = ((self.X + self.Y) & 1) == 0
        idx = np.where(dither & (fr > .55) & chk, lo + 1, lo) if dither else lo
        idx = np.clip(idx, 0, n - 1)
        self.px[mk] = np.array(ramp, np.uint8)[idx][mk]

    def lit(self, mk, ramp, a=.55, b=.35, base=.55, **kw):
        ys, xs = np.nonzero(mk)
        x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
        self.shade(mk, ramp, lambda X, Y: base + a * (.5 - (X - x0) / max(x1 - x0, 1)) + b * (.5 - (Y - y0) / max(y1 - y0, 1)), **kw)

    # ── 글자판 ──
    def art(self, x0, y0, rows, key):
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch != ' ' and ch != '.' and ch in key:
                    self.dot(x0 + i, y0 + j, key[ch])

    # ── 마감 ──
    def outline(self, skip=None):
        """칠해진 픽셀의 4방향 바깥 한 줄을 그 재질의 가장 어두운 색으로."""
        allsolid = self.solid()
        m = allsolid & ~skip if skip is not None else allsolid
        out = np.zeros_like(m)
        newc = {}
        for dy, dx in ((1, 0), (0, 1), (-1, 0), (0, -1)):
            sh = np.zeros_like(m)
            ys = slice(max(dy, 0), self.h + min(dy, 0)); yd = slice(max(-dy, 0), self.h + min(-dy, 0))
            xs = slice(max(dx, 0), self.w + min(dx, 0)); xd = slice(max(-dx, 0), self.w + min(-dx, 0))
            sh[ys, xs] = m[yd, xd]
            cand = sh & ~allsolid & ~out
            for y, x in zip(*np.nonzero(cand)):
                sy, sx = y - dy, x - dx
                c = tuple(int(v) for v in self.px[sy, sx])
                newc[(y, x)] = _OUT.get(c, OUT)
            out |= cand
        for (y, x), c in newc.items():
            self.px[y, x] = c

    def shadow(self, dx=3, dy=2, mk=None, rows=None):
        """구조물 실루엣을 오른쪽 아래(dx,dy)까지 끌어 SHADOW 키로 칠한다(이미 칠해진 곳·rows 밖은 안 칠함).
        rows=(y0,y1): 그림자가 놓이는 땅 줄(건물 밑 가장자리 근처)만."""
        m = self.solid() if mk is None else mk
        s = np.zeros_like(m)
        n = max(abs(dx), abs(dy), 1)
        for k in range(1, n + 1):
            sx, sy = int(round(dx * k / n)), int(round(dy * k / n))
            s |= np.roll(np.roll(m, sy, 0), sx, 1)
        s &= (self.px == np.array(KEY, np.uint8)).all(-1)
        if rows is not None:
            s &= (self.Y >= rows[0]) & (self.Y <= rows[1])
        self.px[s] = SHADOW

    def arr(self):
        return self.px.copy()


# ── 자주 쓰는 부품 ───────────────────────────────────────────────────────────────────────────
def roof_slab(c, x0, y0, x1, y1, ramp, course=2, seed=1, tilt=0, lit_left=True):
    """앞쪽으로 흘러내리는 지붕면(3/4: 윗면 쪽). 왼쪽이 밝고 아래 가장자리가 어둡다. tilt>0 이면 아래가 넓은 사다리꼴.
    ramp 는 어둠→밝음. 층(course)마다 어두운 줄눈 + 엇갈린 짧은 세로 이음."""
    pts = [(x0 + tilt, y0), (x1 - tilt, y0), (x1, y1), (x0, y1)]
    mk = c.mpoly(pts)
    n = len(ramp)
    h = max(y1 - y0, 1)
    w = max(x1 - x0, 1)

    def f(X, Y):
        return .62 + .30 * (.5 - (X - x0) / w) - .26 * ((Y - y0) / h) + .10 * (((Y - y0) // course) % 2 == 0)
    c.shade(mk, ramp, f, dither=False, seed=seed, noise=.10)
    for y in range(y0, y1 + 1):
        row = (y - y0) // course
        if (y - y0) % course == course - 1:                    # 층 아래 줄눈
            for x in range(x0, x1 + 1):
                if mk[y, x]:
                    c.dot(x, y, ramp[max(0, int(round((n - 1) * .22)))])
        else:
            off = (row * 3 + int(H(row, 0, seed) * 3)) % 4
            for x in range(x0, x1 + 1):
                if mk[y, x] and (x + off) % 4 == 0 and (y - y0) % course == 0:
                    c.dot(x, y, ramp[max(0, int(round((n - 1) * .3)))])
    # 윗(마루) 한 줄 밝게, 처마 한 줄 어둡게
    for x in range(x0, x1 + 1):
        if mk[y0, x]:
            c.dot(x, y0, ramp[-1])
    return mk


def gable_roof(c, cx, y0, w, rise, ramp, seed=1, eave=1):
    """정면 박공 지붕: 삼각형(꼭대기 cx,y0) — 왼쪽 반이 밝고 오른쪽 반이 어둡다. 아래 가장자리에 처마 한 줄."""
    x0, x1 = cx - w // 2, cx + (w - 1) // 2
    pts = [(cx, y0), (x1 + eave, y0 + rise), (x0 - eave, y0 + rise)]
    mk = c.mpoly(pts)
    n = len(ramp)

    def f(X, Y):
        return np.where(X <= cx, .72, .38) + .16 * ((Y - y0) / max(rise, 1)) * -1 + (H(X, Y, seed) - .5) * .10
    c.shade(mk, ramp, f, dither=False)
    # 용마루 선
    for t in range(rise):
        xl = cx - int((t) * (cx - x0 + eave) / max(rise, 1))
        c.dot(xl, y0 + t, ramp[-1] if t > 0 else ramp[-1])
    return mk


def window(c, x, y, w=2, h=2, glass=None, frame=None):
    glass = glass or WATER[1]
    frame = frame or WOOD[0]
    c.rect(x, y, x + w - 1, y + h - 1, glass)
    c.dot(x, y, WATER[3])
    for i in range(w):
        c.dot(x + i, y + h, frame) if False else None


def door(c, x, y, w=3, h=4, col=None):
    col = col or WOOD[1]
    c.rect(x, y, x + w - 1, y + h - 1, col)
    c.hl(x, x + w - 1, y, WOOD[0])
    c.dot(x + w - 2, y + h // 2, GOLD[3])


def plank_wall(c, x0, y0, x1, y1, ramp=WOOD, seed=1):
    """앞면(F): 세로 널판. 왼쪽 밝고 오른쪽 어둡고 위 처마 그늘."""
    w = x1 - x0 + 1
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            u = (x - x0) / max(w - 1, 1)
            i = 4 if u < .35 else 3 if u < .75 else 2
            if (x - x0) % 3 == 2:
                i -= 1
            if y == y0:
                i = max(i - 2, 1)
            elif y == y1:
                i = max(i - 1, 1)
            c.dot(x, y, ramp[i])


def stone_wall(c, x0, y0, x1, y1, ramp=STONE, rowh=3, seed=1):
    w = x1 - x0 + 1
    for y in range(y0, y1 + 1):
        row = (y - y0) // rowh
        off = int(H(row, 0, seed) * 4)
        for x in range(x0, x1 + 1):
            u = (x - x0) / max(w - 1, 1)
            i = 5 if u < .2 else 4 if u < .55 else 3 if u < .85 else 2
            if (y - y0) % rowh == rowh - 1:
                i = max(i - 2, 1)
            elif (x + off) % 5 == 0:
                i = max(i - 1, 1)
            elif H(x, y, seed + 3) > .92:
                i = min(i + 1, len(ramp) - 1)
            if y == y0:
                i = max(i - 1, 1)
            c.dot(x, y, ramp[i])


def tree(c, cx, by, r=5, kind='broad', seed=1):
    """작은 활엽수/침엽수 한 그루. by = 줄기 밑. 원본 숲 칸과 같은 어두운 테."""
    if kind == 'pine':
        for k in range(4):
            yy = by - 3 - k * 3
            hw = 1 + (3 - k) if False else 2 + (3 - k)
            hw = 1 + k if False else (4 - k) + 1
            pts = [(cx, yy - 3), (cx + hw, yy + 2), (cx - hw, yy + 2)]
            mk = c.mpoly(pts)
            c.shade(mk, LEAF[1:6], lambda X, Y: np.where(X <= cx, .72, .36) - ((Y - yy) * .05), dither=False, seed=seed + k)
        c.rect(cx, by - 2, cx, by, WOOD[2])
        return
    m = c.mell(cx, by - r - 1, r, int(r * .85))
    c.lit(m, LEAF[1:7], a=.7, b=.6, base=.6, seed=seed)
    c.rect(cx, by - 2, cx, by, WOOD[2])


def snow_pine(c, cx, by, tiers=3, w0=3, seed=1):
    """눈 덮인 침엽수: 어두운 초록 몸통 + 윗면에 눈."""
    for k in range(tiers):
        yy = by - 2 - k * 3
        hw = w0 - k + (1 if k == 0 else 0)
        hw = max(hw, 1)
        c.poly([(cx, yy - 3), (cx + hw + 1, yy + 1), (cx - hw - 1, yy + 1)], LEAF[2])
        c.poly([(cx, yy - 3), (cx + hw, yy), (cx - hw, yy)], LEAF[3] if k else LEAF[2])
        # 눈: 왼쪽 위가 하얗다
        c.poly([(cx, yy - 3), (cx - 1, yy - 1), (cx - hw + 1, yy)], SNOW[5])
        c.dot(cx, yy - 3, SNOW[5]); c.dot(cx, yy - 2, SNOW[4])
    c.rect(cx, by - 1, cx, by, WOOD[2])


def palm(c, cx, by, h=9, seed=1, lean=0):
    """야자수: 굽은 줄기 + 윗부분 잎 다섯 가닥."""
    for t in range(h):
        c.dot(cx + (lean * t) // h, by - t, WOOD[3] if t % 2 else WOOD[4])
    tx, ty = cx + lean, by - h
    leaves = [(-4, 1), (-3, -1), (-1, -2), (1, -2), (3, -1), (4, 1), (0, 1)]
    for (dx, dy) in leaves:
        steps = max(abs(dx), 1) + 1
        for s in range(steps + 1):
            x = tx + int(round(dx * s / steps)); y = ty + int(round(dy * s / steps + (0 if dy <= 0 else 0) + (s * s) / (steps * 3)))
            c.dot(x, y, LEAF[4] if s < 2 else LEAF[3] if s < steps else LEAF[2])
    c.dot(tx, ty, LEAF[5]); c.dot(tx - 1, ty - 1, LEAF[5])
    c.dot(tx, ty + 1, WOOD[1]); c.dot(tx + 1, ty + 1, WOOD[1])


def smoke(c, x, y, n=3):
    for i in range(n):
        c.dot(x + (i % 2), y - i * 2, GREY[4] if i else GREY[5])
        c.dot(x + (i % 2) + 1, y - i * 2, GREY[3] if i else GREY[4])
