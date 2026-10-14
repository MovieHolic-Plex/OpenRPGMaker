"""snow_north 손 도트 엔진 — 캔버스·재질 무늬·3/4 도형 도우미.

모든 화소는 (재질, 단)으로 기억한다(palette.RAMPS). 윤곽·그늘·접촉 그림자는 «같은 재질의 단 내리기»로 만든다.
3/4 탑뷰: 윗면(밝은 슬래브, 뒤 가장자리 어두운 선, 앞 모서리 반사) + 남쪽 앞면(왼쪽 빛·오른쪽 그늘·밑 그늘). 빛은 왼쪽 위.
"""
import os, math
import numpy as np
from PIL import Image
from palette import RAMPS, MATS, RGB

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
MI = {m: i for i, m in enumerate(MATS)}
NT = [len(RAMPS[m]) for m in MATS]
RGBI = [RGB[m] for m in MATS]


def h32(x, y, s=0):
    n = (x * 374761393 + y * 668265263 + s * 2246822519 + 0x9E3779B9) & 0xffffffff
    n = ((n ^ (n >> 13)) * 1274126177) & 0xffffffff
    return (n ^ (n >> 16)) & 0xffffffff


def rnd(x, y, s=0):
    return h32(x, y, s) / 4294967296.0


def top(mat):
    return NT[MI[mat]] - 1


class C:
    """캔버스. m = 재질 번호(-1 = 투명), t = 단."""
    def __init__(s, w, h):
        s.w, s.h = w, h
        s.m = np.full((h, w), -1, np.int16)
        s.t = np.zeros((h, w), np.int16)
        s.ox = s.oy = 0

    def P(s, x, y, mat, t):
        x, y = int(x), int(y)
        if 0 <= x < s.w and 0 <= y < s.h:
            if mat is None: s.m[y, x] = -1; return
            i = MI[mat]; s.m[y, x] = i; s.t[y, x] = max(0, min(NT[i] - 1, int(t)))

    def on(s, x, y):
        return 0 <= x < s.w and 0 <= y < s.h and s.m[y, x] >= 0

    def get(s, x, y):
        if not s.on(x, y): return None
        return MATS[s.m[y, x]], int(s.t[y, x])

    def R(s, x, y, w, h, mat, t):
        for j in range(int(h)):
            for i in range(int(w)): s.P(x + i, y + j, mat, t)

    def HL(s, x, y, w, mat, t): s.R(x, y, w, 1, mat, t)
    def VL(s, x, y, h, mat, t): s.R(x, y, 1, h, mat, t)

    def clear(s, x, y, w, h):
        for j in range(int(h)):
            for i in range(int(w)): s.P(x + i, y + j, None, 0)

    def F(s, x, y, w, h, fn):
        """fn(wx, wy, lx, ly) -> (mat, t) | None. wx/wy = 세계 좌표(오프셋 포함)."""
        for j in range(int(h)):
            for i in range(int(w)):
                r = fn(x + i + s.ox, y + j + s.oy, i, j)
                if r is not None: s.P(x + i, y + j, *r)

    def line(s, x0, y0, x1, y1, mat, t):
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for k in range(n + 1):
            s.P(round(x0 + (x1 - x0) * k / n), round(y0 + (y1 - y0) * k / n), mat, t)

    def poly(s, pts, fn):
        ys = [p[1] for p in pts]
        for y in range(max(0, int(min(ys))), min(s.h, int(math.ceil(max(ys))) + 1)):
            xs = []; yc = y + 0.5
            for k in range(len(pts)):
                (x0, y0), (x1, y1) = pts[k], pts[(k + 1) % len(pts)]
                if (y0 <= yc < y1) or (y1 <= yc < y0):
                    xs.append(x0 + (yc - y0) * (x1 - x0) / (y1 - y0))
            xs.sort()
            for a, b in zip(xs[0::2], xs[1::2]):
                for x in range(int(math.ceil(a - 0.5)), int(math.floor(b - 0.5)) + 1):
                    r = fn(x, y)
                    if r is not None: s.P(x, y, *r)

    def ell(s, cx, cy, rx, ry, fn):
        for y in range(int(cy - ry - 1), int(cy + ry + 2)):
            for x in range(int(cx - rx - 1), int(cx + rx + 2)):
                dx = (x + 0.5 - cx) / max(rx, 0.01); dy = (y + 0.5 - cy) / max(ry, 0.01)
                d = dx * dx + dy * dy
                if d <= 1.0:
                    r = fn(x, y, dx, dy, d)
                    if r is not None: s.P(x, y, *r)

    def shift(s, x, y, dt, keep=('ink',)):
        g = s.get(x, y)
        if g and g[0] not in keep: s.P(x, y, g[0], g[1] + dt)

    def shift_rect(s, x, y, w, h, dt):
        for j in range(h):
            for i in range(w): s.shift(x + i, y + j, dt)

    def outline(s, bottom=('ink', 1), sides=True, topline=True):
        """실루엣 가장자리(4이웃 투명)를 자기 재질 가장 어두운 단으로. 아래 가장자리는 bottom(접지 선)."""
        m0 = s.m.copy(); edge = []
        for y in range(s.h):
            for x in range(s.w):
                if m0[y, x] < 0: continue
                up = y == 0 or m0[y - 1, x] < 0
                dn = y == s.h - 1 or m0[y + 1, x] < 0
                lf = x == 0 or m0[y, x - 1] < 0
                rt = x == s.w - 1 or m0[y, x + 1] < 0
                if dn and bottom: edge.append((x, y, bottom))
                elif (up and topline) or ((lf or rt) and sides): edge.append((x, y, None))
        for x, y, b in edge:
            if b: s.P(x, y, *b)
            else:
                g = s.get(x, y)
                if g[0] == 'ink': continue
                s.P(x, y, g[0], 0)

    def ink_outline(s, t=1):
        """실루엣 바깥 1px 을 먹 선으로(캔버스 안 투명 칸에 덧그린다)."""
        m0 = s.m.copy(); pts = []
        for y in range(s.h):
            for x in range(s.w):
                if m0[y, x] >= 0: continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    X, Y = x + dx, y + dy
                    if 0 <= X < s.w and 0 <= Y < s.h and m0[Y, X] >= 0: pts.append((x, y)); break
        for x, y in pts: s.P(x, y, 'ink', t)

    def paste(s, o, x, y):
        for j in range(o.h):
            for i in range(o.w):
                if o.m[j, i] >= 0 and 0 <= x + i < s.w and 0 <= y + j < s.h:
                    s.m[y + j, x + i] = o.m[j, i]; s.t[y + j, x + i] = o.t[j, i]

    def flipx(s):
        o = C(s.w, s.h); o.m = s.m[:, ::-1].copy(); o.t = s.t[:, ::-1].copy(); return o

    def crop(s, x, y, w, h):
        o = C(w, h); o.m = s.m[y:y + h, x:x + w].copy(); o.t = s.t[y:y + h, x:x + w].copy(); return o

    def rgba(s):
        a = np.zeros((s.h, s.w, 4), np.uint8)
        for y in range(s.h):
            for x in range(s.w):
                i = s.m[y, x]
                if i >= 0:
                    a[y, x, :3] = RGBI[i][s.t[y, x]]; a[y, x, 3] = 255
        return a

    def img(s): return Image.fromarray(s.rgba(), 'RGBA')


# ═══════════════════════ 재질 무늬(세계 좌표) ═══════════════════════
def tex_brick(wx, wy, base=4, mat='brick', mortar=None, course=4, blen=8, s=3, var=1):
    """가로 벽돌: 코스 높이 course(줄눈 1px 포함), 길이 blen, 엇갈림. 벽돌 윗줄 왼쪽에 빛, 밑줄 줄눈 어둡게."""
    mortar = mortar or (mat, max(0, base - 3))
    row = wy // course; yy = wy % course
    xs = wx + (blen // 2 if row % 2 else 0); col = xs // blen; xx = xs % blen
    if yy == course - 1 or xx == blen - 1: return mortar
    v = h32(col, row, s) % 7
    t = base + (-var if v == 0 else var if v == 6 else 0)
    if v == 3: t = base - 1 if xx > 3 else base
    if yy == 0 and xx < 2: t += 1
    return (mat, t)


def tex_cluster(wx, wy, mat, base, s=2, scale=3, amt=0.28):
    cx, cy = wx // scale, wy // scale
    r = rnd(cx, cy, s); r2 = rnd(wx, wy, s + 7)
    if r < amt * 0.5 and r2 < 0.8: return (mat, base - 1)
    if r > 1 - amt * 0.5 and r2 < 0.7: return (mat, base + 1)
    return (mat, base)


def rivets(c, x0, y0, w, h, step, mat='iron', t_hi=None, t_lo=None, axis='h'):
    """리벳 줄: 밝은 점 + 오른쪽 아래 그늘 점."""
    n = NT[MI[mat]]
    t_hi = n - 1 if t_hi is None else t_hi; t_lo = 1 if t_lo is None else t_lo
    if axis == 'h':
        for x in range(x0, x0 + w, step):
            c.P(x, y0, mat, t_hi); c.P(x + 1, y0 + 1, mat, t_lo)
    else:
        for y in range(y0, y0 + h, step):
            c.P(x0, y, mat, t_hi); c.P(x0 + 1, y + 1, mat, t_lo)


def box3(c, x, y, w, topn, front, mat, tt=None, ft=None, back=True, edge=True, fmat=None):
    """3/4 상자: 윗면 topn 행(밝음, 뒤 가장자리 어두운 선, 앞 모서리 반사) + 앞면 front 행."""
    n = NT[MI[mat]]
    fmat = fmat or mat; fn = NT[MI[fmat]]
    tt = n - 2 if tt is None else tt
    ft = (tt - 2 if fmat == mat else fn - 3) if ft is None else ft
    c.R(x, y, w, topn, mat, tt)
    if back: c.HL(x, y, w, mat, tt - 2)
    c.HL(x, y + topn - 1, w, mat, min(n - 1, tt + 1))
    c.R(x, y + topn, w, front, fmat, ft)
    c.HL(x, y + topn, w, fmat, ft - 1)
    if front > 2: c.HL(x, y + topn + front - 1, w, fmat, ft - 2)
    if edge:
        c.VL(x, y, topn, mat, tt - 1); c.VL(x + w - 1, y, topn, mat, tt - 2)
        c.VL(x, y + topn, front, fmat, min(fn - 1, ft + 1)); c.VL(x + w - 1, y + topn, front, fmat, ft - 2)


def cyl_v(c, x, y, w, h, cap, mat, base=None, capmat=None, band=None):
    """세운 원통(통·탱크·굴뚝): 위 타원 뚜껑(cap 행) + 몸통(왼쪽 밝게 → 오른쪽 어둡게)."""
    n = NT[MI[mat]]
    base = n - 3 if base is None else base
    cx = x + w / 2
    for j in range(h):
        for i in range(w):
            u = (i + 0.5) / w
            t = base + (1 if u < 0.3 else 0 if u < 0.62 else -1 if u < 0.86 else -2)
            if u < 0.14: t = base
            c.P(x + i, y + cap // 2 + j, mat, t)
    cm = capmat or mat; cn = NT[MI[cm]]
    c.ell(cx, y + cap / 2, w / 2, cap / 2, lambda X, Y, dx, dy, d: (cm, cn - 1 if dy < -0.2 and dx < 0.3 else cn - 2 if d < 0.7 else cn - 3))
    if band:
        for by in band:
            for i in range(w): c.P(x + i, y + cap // 2 + by, mat, max(0, c.get(x + i, y + cap // 2 + by)[1] - 1 if c.on(x + i, y + cap // 2 + by) else 0))


def save(c_or_img, path, scale=1):
    im = c_or_img.img() if isinstance(c_or_img, C) else c_or_img
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if scale != 1: im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
    im.save(path)


def disc(c, cx, cy, rx, ry, mat, t, band=2, bt=None, rim=True):
    """위에서 본 원반(밝은 윗면, 왼쪽 위 더 밝게, 뒤 가장자리 먹) + 앞쪽 두께 band 행(어둡게)."""
    bt = t - 3 if bt is None else bt
    if band:
        c.ell(cx, cy + band, rx, ry, lambda x, y, dx, dy, d: (mat, bt + (1 if dx < -0.4 else 0) - (1 if dx > 0.5 else 0)) if dy > -0.2 else None)
        for k in range(band): c.ell(cx, cy + k, rx, ry, lambda x, y, dx, dy, d: (mat, bt) if dy > 0.2 else None)
    c.ell(cx, cy, rx, ry, lambda x, y, dx, dy, d: (mat, t + (1 if dx + dy < -0.6 else 0) - (1 if dy > 0.6 else 0)))
    if rim: c.ell(cx, cy, rx, ry, lambda x, y, dx, dy, d: ('ink', 1) if d > 0.8 and dy < 0.1 else None)
    if band: c.ell(cx, cy + band, rx, ry, lambda x, y, dx, dy, d: ('ink', 1) if d > 0.8 and dy > 0.3 else None)
