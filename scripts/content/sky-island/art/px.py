"""sky_island 손 도트 엔진 (Opus 손 도트, 2026-10-14).

팔레트 잠금: tiledata/sky-island/palette.pal 의 램프만. 반투명 없음. 빛은 왼쪽 위.
3/4 탑뷰 = 윗면(밝은 판, 뒤 가장자리 어두운 선) + 남쪽 앞면(한두 단 어둡게) + 바닥 접지 그늘.
모든 화소는 (램프, 단) 으로 기억한다 — 윤곽·그늘·접촉 그림자를 «같은 램프의 단 내리기»로 만든다.
단(t)은 램프 안 절대 번호 0(가장 어두움)…n-1.
"""
import os, sys, math, re
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
PAL = os.path.join(ROOT, 'tiledata', 'sky-island', 'palette.pal')


def load_pal(path=PAL):
    ramps = {}
    for ln in open(path, encoding='utf-8'):
        m = re.match(r'@rampc\s+(\S+)\s+(.*)', ln.strip())
        if m: ramps[m.group(1)] = [int(h, 16) for h in re.findall(r'#([0-9a-fA-F]{6})', m.group(2))]
    return ramps


RAMPS = load_pal()
MATS = list(RAMPS)
MI = {m: i for i, m in enumerate(MATS)}
RGB = [[((c >> 16) & 255, (c >> 8) & 255, c & 255) for c in RAMPS[m]] for m in MATS]
NT = [len(RAMPS[m]) for m in MATS]
ALLOWED = {c for r in RGB for c in r}


def check_palette(img):
    """팔레트 밖 색·반투명 화소 수(0 이면 통과)."""
    a = np.asarray(img.convert('RGBA'))
    op = a[..., 3] > 0
    bad = 0
    if (a[..., 3][op] < 255).any(): bad += int((a[..., 3][op] < 255).sum())
    cols = {tuple(int(v) for v in p) for p in a[..., :3][op].reshape(-1, 3)}
    return bad + len([c for c in cols if c not in ALLOWED])


def h32(x, y, s=0):
    n = (x * 374761393 + y * 668265263 + s * 2246822519 + 0x9E3779B9) & 0xffffffff
    n = ((n ^ (n >> 13)) * 1274126177) & 0xffffffff
    return (n ^ (n >> 16)) & 0xffffffff


def rnd(x, y, s=0):
    return h32(x, y, s) / 4294967296.0


def clamp(v, a, b): return a if v < a else b if v > b else v


class C:
    """캔버스. m = 램프 번호(-1 = 투명), t = 단."""
    def __init__(s, w, h):
        s.w, s.h = w, h
        s.m = np.full((h, w), -1, np.int16)
        s.t = np.zeros((h, w), np.int16)

    def P(s, x, y, mat, t):
        x, y = int(x), int(y)
        if 0 <= x < s.w and 0 <= y < s.h:
            if mat is None: s.m[y, x] = -1; return
            i = MI[mat]; s.m[y, x] = i; s.t[y, x] = clamp(int(t), 0, NT[i] - 1)

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

    def F(s, x, y, w, h, fn):
        for j in range(int(h)):
            for i in range(int(w)):
                r = fn(x + i, y + j, i, j)
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

    def shift(s, x, y, dt, keep=('sumi',)):
        g = s.get(x, y)
        if g and g[0] not in keep: s.P(x, y, g[0], g[1] + dt)

    def shift_rect(s, x, y, w, h, dt):
        for j in range(h):
            for i in range(w): s.shift(x + i, y + j, dt)

    def mask(s):
        return s.m >= 0

    def outline(s, dark=1, bottom=None, only=None):
        """실루엣 가장자리(4이웃 중 투명) 화소를 자기 램프 dark 단(최대)으로 낮춘다. bottom=(mat,t) 이면 아래 가장자리는 그 색."""
        m0 = s.m.copy(); edge = []
        for y in range(s.h):
            for x in range(s.w):
                if m0[y, x] < 0: continue
                up = y == 0 or m0[y - 1, x] < 0
                dn = y == s.h - 1 or m0[y + 1, x] < 0
                lf = x == 0 or m0[y, x - 1] < 0
                rt = x == s.w - 1 or m0[y, x + 1] < 0
                if only is not None and not only(x, y): continue
                if dn and bottom: edge.append((x, y, bottom))
                elif up or dn or lf or rt: edge.append((x, y, None))
        for x, y, b in edge:
            if b: s.P(x, y, *b)
            else:
                g = s.get(x, y); s.P(x, y, g[0], min(g[1], dark))

    def paste(s, o, x, y):
        for j in range(o.h):
            for i in range(o.w):
                if o.m[j, i] >= 0 and 0 <= x + i < s.w and 0 <= y + j < s.h:
                    s.m[y + j, x + i] = o.m[j, i]; s.t[y + j, x + i] = o.t[j, i]

    def under(s, o):
        """o 를 s 의 투명 칸에만 깐다(배경 합성)."""
        for j in range(min(s.h, o.h)):
            for i in range(min(s.w, o.w)):
                if s.m[j, i] < 0 and o.m[j, i] >= 0:
                    s.m[j, i] = o.m[j, i]; s.t[j, i] = o.t[j, i]

    def flipx(s):
        o = C(s.w, s.h); o.m = s.m[:, ::-1].copy(); o.t = s.t[:, ::-1].copy(); return o

    def crop(s, x, y, w, h):
        o = C(w, h); o.m = s.m[y:y + h, x:x + w].copy(); o.t = s.t[y:y + h, x:x + w].copy(); return o

    def copy(s):
        o = C(s.w, s.h); o.m = s.m.copy(); o.t = s.t.copy(); return o

    def rgba(s):
        a = np.zeros((s.h, s.w, 4), np.uint8)
        for y in range(s.h):
            for x in range(s.w):
                i = s.m[y, x]
                if i >= 0:
                    a[y, x, :3] = RGB[i][s.t[y, x]]; a[y, x, 3] = 255
        return a

    def img(s): return Image.fromarray(s.rgba(), 'RGBA')


def save(c_or_img, path, scale=1):
    im = c_or_img.img() if isinstance(c_or_img, C) else c_or_img
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if scale != 1: im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
    im.save(path)


# ═══════════════════════ 공용 그리기 도우미 ═══════════════════════
def blob(c, clumps, mat='leaf', base=4, s=0, rim=1, light=(-0.6, -0.8), grain=0.55):
    """잎·구름 덩이(여러 원의 합). 덩이마다 법선 명암(왼위 빛) + 2px 결, 바깥 윤곽은 rim 단. 나중 덩이가 앞."""
    n = NT[MI[mat]]
    pts = {}
    for k, (cx, cy, r) in enumerate(clumps):
        for y in range(int(cy - r - 1), int(cy + r + 2)):
            for x in range(int(cx - r - 1), int(cx + r + 2)):
                dx, dy = (x + 0.5 - cx) / r, (y + 0.5 - cy) / r
                d = dx * dx + dy * dy
                if d <= 1: pts[(x, y)] = (k, dx, dy, d)
    for (x, y), (k, dx, dy, d) in pts.items():
        nz = math.sqrt(max(0, 1 - d))
        l = -(dx * light[0] + dy * light[1]) * 0.75 + nz * 0.45
        v = l + (rnd(x // 2, y // 2, s + k) - 0.5) * grain
        t = base + (2 if v > 0.75 else 1 if v > 0.42 else 0 if v > 0.05 else -1 if v > -0.35 else -2)
        c.P(x, y, mat, clamp(t, 0, n - 1))
    for (x, y), (k, dx, dy, d) in pts.items():
        up = pts.get((x, y - 1))
        if up and up[0] < k and d > 0.6 and dy < 0:
            g = c.get(x, y - 1)
            if g and g[0] == mat: c.P(x, y - 1, mat, max(0, g[1] - 2))
    if rim is not None:
        for (x, y) in list(pts):
            if any((x + a, y + b) not in pts for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                c.P(x, y, mat, rim)
    return pts


def box3(c, x, y, w, top, front, mat, tt=None, ft=None, back=True, edge=True):
    """3/4 상자: 윗면 top 행(밝음, 뒤 가장자리 어두운 선, 앞 모서리 하이라이트) + 앞면 front 행."""
    n = NT[MI[mat]]
    tt = n - 2 if tt is None else tt
    ft = tt - 2 if ft is None else ft
    c.R(x, y, w, top, mat, tt)
    if back: c.HL(x, y, w, mat, tt - 2)
    c.HL(x, y + top - 1, w, mat, tt + 1)
    c.R(x, y + top, w, front, mat, ft)
    c.HL(x, y + top, w, mat, ft - 1)
    if front > 2: c.HL(x, y + top + front - 1, w, mat, ft - 2)
    if edge:
        c.VL(x, y, top, mat, tt - 1); c.VL(x + w - 1, y, top, mat, tt - 2)
        c.VL(x, y + top, front, mat, ft + 1); c.VL(x + w - 1, y + top, front, mat, ft - 2)


def shadow_ell(c, cx, cy, rx, ry, mat='grass', t=1, t2=2):
    """접지 그늘 타원(풀 위 그림자)."""
    c.ell(cx, cy, rx, ry, lambda x, y, dx, dy, d: (mat, t if d < 0.5 else t2))


def trunk(c, x, y0, y1, w=3, mat='wood'):
    c.R(x, y0, w, y1 - y0, mat, 3); c.VL(x, y0, y1 - y0, mat, 4); c.VL(x + w - 1, y0, y1 - y0, mat, 1)
    for k in range(y0, y1):
        if rnd(x, k, 5) < 0.25: c.P(x + 1, k, mat, 2)
    c.HL(x - 1, y1 - 1, w + 2, mat, 1); c.P(x - 1, y1 - 2, mat, 2); c.P(x + w, y1 - 2, mat, 1)
