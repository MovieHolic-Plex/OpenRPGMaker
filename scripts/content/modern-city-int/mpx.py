"""modern_city 실내 손 도트 엔진 (2026-10-14).

팔레트 잠금: 모든 색은 번들 시트 public/assets/modern-city/modern-city-chipset.png 에 이미 있는 색이다
(modern4 팔레트 harness-data/modern-chipset/palette.pal 13램프 + 시트가 이미 쓰는 나무·베이지·회색·장미·빨강·세이지 램프).
새 계열 색을 만들지 않는다 — check_palette() 가 시트 색 집합과 대조한다.

빛은 왼쪽 위. 3/4 탑뷰 = 윗면(밝은 판, 뒤 가장자리 어두운 선) + 남쪽 앞면(두 단 어둡게) + 바닥 접지선(ink).
모든 화소는 (램프, 단)으로 기억한다 — 윤곽·그늘·접촉 그림자를 «같은 램프의 단 내리기»로 만든다. 단 0 = 가장 어두움.
"""
import math, os
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
SHEET = os.path.join(ROOT, 'public', 'assets', 'modern-city', 'modern-city-chipset.png')

# 램프(어두운 → 밝은). 전부 시트에 있는 색.
RAMPS = {
    'ink':   ['#091125', '#0b1224', '#19274a'],
    'road':  ['#0e1720', '#192737', '#283d53', '#36516a', '#436682'],
    'slate': ['#2a3539', '#3d4b51', '#516268', '#61767d', '#738a90'],
    'roof':  ['#3b3634', '#524b49', '#68605e', '#7b7270', '#8d8482'],
    'mint':  ['#5e7974', '#73908a', '#8ca29d', '#a1b2ae', '#b5c2bf'],
    'teal':  ['#0c1f22', '#17373c', '#265359', '#326c72', '#3f858a'],
    'blue':  ['#1f3052', '#2d436e', '#3d578a', '#4a6ba1', '#5e80b2'],
    'brick': ['#533020', '#70402f', '#8b4f3f', '#a35f4c', '#b27361'],
    'wine':  ['#2d010f', '#5e0a24', '#881438'],
    'amber': ['#c89a2b', '#d2a54c', '#d6b073', '#ddbf91', '#e4cfae'],
    'leaf':  ['#172e25', '#1d352c', '#2e5042', '#406958', '#4f7f69', '#5e957b'],
    'body':  ['#676a77', '#757886', '#848794', '#9496a1', '#a1a3ac', '#afb1b8', '#bcbdc3'],
    'white': ['#c1cfcc', '#e4e9e8', '#f1f3f3'],
    'wood':  ['#533020', '#8a6128', '#a67a37', '#bc9250', '#cba76c', '#ddbf91'],
    'beige': ['#7a6f5a', '#948a72', '#a8987e', '#c4b49a', '#d0c2a8', '#dccfb8'],
    'cream': ['#86765e', '#aea58b', '#c4bca4', '#d8d2bf'],
    'grey':  ['#585a64', '#6c7076', '#8d9095', '#a6a9ad', '#c6cad4', '#dde0e7', '#f3f4f7'],
    'dark':  ['#1a1b21', '#22232a', '#2a2c34', '#34363e', '#3e404a', '#4a4c56'],
    'rose':  ['#4a2b29', '#613a37', '#7a4945', '#8f5a56', '#ad938d', '#c2aaa4', '#d4c2bd'],
    'red':   ['#601e28', '#742630', '#862e38', '#983840', '#a8444a', '#b65256', '#c46264'],
    'sage':  ['#394238', '#4a5649', '#5d6b5c', '#70806f', '#8fa992', '#a5bba8', '#b9c9bb'],
    'navy':  ['#202b48', '#263456', '#2d3e64', '#3e5480', '#486090', '#6f83a0', '#8397b3'],
    'plum':  ['#613849', '#7a4a5c', '#905d70', '#a47286'],
    'tealg': ['#203b3b', '#2c4e4d', '#3a6260', '#4a7673'],
}
MATS = list(RAMPS)
MI = {m: i for i, m in enumerate(MATS)}


def _rgb(h): return (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16))


RGB = [[_rgb(c) for c in RAMPS[m]] for m in MATS]
NT = [len(RAMPS[m]) for m in MATS]
TOP = {m: NT[MI[m]] - 1 for m in MATS}


def h32(x, y, s=0):
    n = (x * 374761393 + y * 668265263 + s * 2246822519 + 0x9E3779B9) & 0xffffffff
    n = ((n ^ (n >> 13)) * 1274126177) & 0xffffffff
    return (n ^ (n >> 16)) & 0xffffffff


def rnd(x, y, s=0): return h32(x, y, s) / 4294967296.0


class C:
    """캔버스. m = 램프 번호(-1 = 투명), t = 단."""
    def __init__(s, w, h):
        s.w, s.h = w, h
        s.m = np.full((h, w), -1, np.int16)
        s.t = np.zeros((h, w), np.int16)

    def P(s, x, y, mat, t=None):
        x, y = int(x), int(y)
        if not (0 <= x < s.w and 0 <= y < s.h): return
        if mat is None: s.m[y, x] = -1; return
        i = MI[mat]
        if t is None: t = NT[i] - 1
        s.m[y, x] = i; s.t[y, x] = max(0, min(NT[i] - 1, int(t)))

    def on(s, x, y): return 0 <= x < s.w and 0 <= y < s.h and s.m[y, x] >= 0

    def get(s, x, y):
        if not s.on(x, y): return None
        return MATS[s.m[y, x]], int(s.t[y, x])

    def R(s, x, y, w, h, mat, t=None):
        for j in range(int(h)):
            for i in range(int(w)): s.P(x + i, y + j, mat, t)

    def HL(s, x, y, w, mat, t=None): s.R(x, y, w, 1, mat, t)
    def VL(s, x, y, h, mat, t=None): s.R(x, y, 1, h, mat, t)

    def F(s, x, y, w, h, fn):
        for j in range(int(h)):
            for i in range(int(w)):
                r = fn(x + i, y + j, i, j)
                if r is not None: s.P(x + i, y + j, *r)

    def line(s, x0, y0, x1, y1, mat, t=None):
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for k in range(n + 1): s.P(round(x0 + (x1 - x0) * k / n), round(y0 + (y1 - y0) * k / n), mat, t)

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

    def outline(s, mat='ink', t=1, bottom=('ink', 0)):
        """실루엣 가장자리(4이웃 중 투명) → ink. 아래 가장자리는 bottom(접지선)."""
        m0 = s.m.copy(); edge = []
        for y in range(s.h):
            for x in range(s.w):
                if m0[y, x] < 0: continue
                up = y == 0 or m0[y - 1, x] < 0
                dn = y == s.h - 1 or m0[y + 1, x] < 0
                lf = x == 0 or m0[y, x - 1] < 0
                rt = x == s.w - 1 or m0[y, x + 1] < 0
                if dn and bottom: edge.append((x, y, bottom))
                elif up or lf or rt: edge.append((x, y, (mat, t)))
        for x, y, b in edge: s.P(x, y, *b)

    def paste(s, o, x, y):
        for j in range(o.h):
            for i in range(o.w):
                if o.m[j, i] >= 0 and 0 <= x + i < s.w and 0 <= y + j < s.h:
                    s.m[y + j, x + i] = o.m[j, i]; s.t[y + j, x + i] = o.t[j, i]

    def flipx(s):
        o = C(s.w, s.h); o.m = s.m[:, ::-1].copy(); o.t = s.t[:, ::-1].copy(); return o

    def rgba(s):
        a = np.zeros((s.h, s.w, 4), np.uint8)
        for y in range(s.h):
            for x in range(s.w):
                i = s.m[y, x]
                if i >= 0: a[y, x, :3] = RGB[i][s.t[y, x]]; a[y, x, 3] = 255
        return a

    def img(s): return Image.fromarray(s.rgba(), 'RGBA')


# ═════════════ 3/4 도우미 ═════════════
def slab(c, x, y, w, top, front, mat, tt=None, ft=None, outline=True, grain=None, back=True):
    """3/4 상자: 윗면 top 행(밝음 · 뒤 가장자리 어두운 선 · 앞 모서리 반사) + 앞면 front 행(왼 빛·오른 그늘·밑 그늘).
    윤곽 ink. 돌려주는 값 = 앞면 첫 행 y."""
    n = NT[MI[mat]]
    tt = n - 2 if tt is None else tt
    ft = max(0, tt - 2) if ft is None else ft
    c.R(x, y, w, top, mat, tt)
    if grain == 'wood':
        for j in range(1, top - 1):
            for i in range(1, w - 1):
                r = rnd(x + i, (y + j) // 2 + (i // 6), 4)
                if r < 0.16: c.P(x + i, y + j, mat, tt - 1)
                elif r > 0.94: c.P(x + i, y + j, mat, tt + 1)
    elif grain == 'speck':
        for j in range(1, top - 1):
            for i in range(1, w - 1):
                if rnd(x + i, y + j, 9) < 0.06: c.P(x + i, y + j, mat, tt - 1)
    if back: c.HL(x, y + 1, w, mat, tt + 1)
    c.HL(x, y + top - 1, w, mat, min(n - 1, tt + 1))
    if front > 0:
        c.R(x, y + top, w, front, mat, ft)
        c.HL(x, y + top, w, mat, max(0, ft - 1))
        if front > 2: c.HL(x, y + top + front - 1, w, mat, max(0, ft - 1))
        c.VL(x + 1, y + top + 1, max(0, front - 2), mat, min(n - 1, ft + 1))
        c.VL(x + w - 2, y + top + 1, max(0, front - 2), mat, max(0, ft - 1))
    if outline:
        c.HL(x, y, w, 'ink', 1); c.VL(x, y, top + front, 'ink', 1); c.VL(x + w - 1, y, top + front, 'ink', 1)
        c.HL(x, y + top + front - 1, w, 'ink', 0)
    return y + top


def panel(c, x, y, w, h, mat, t):
    """앞면 패널(문짝·서랍): 위·왼 밝게, 아래·오른 어둡게."""
    n = NT[MI[mat]]
    c.R(x, y, w, h, mat, t)
    c.HL(x, y, w, mat, min(n - 1, t + 1)); c.VL(x, y, h, mat, min(n - 1, t + 1))
    c.HL(x, y + h - 1, w, mat, max(0, t - 1)); c.VL(x + w - 1, y, h, mat, max(0, t - 1))


def knob(c, x, y, w=2):
    c.HL(x, y, w, 'grey', 6); c.HL(x, y + 1, w, 'grey', 2)


def shadow_under(c, x, y, w):
    """가구 밑 접지 그림자 1행(ink 0)."""
    c.HL(x, y, w, 'ink', 0)


def legs(c, xs, y, h, mat='dark', t=3):
    for x in xs:
        c.VL(x, y, h, mat, t); c.P(x, y + h - 1, 'ink', 0)


def glass(c, x, y, w, h, mat='teal', base=3, s=0):
    """유리: 위 밝게 → 아래 어둡게 + 사선 반사."""
    n = NT[MI[mat]]
    for j in range(h):
        for i in range(w):
            t = base + (1 if j < h * 0.35 else 0) - (1 if j > h * 0.75 else 0)
            if (i + j + s) % 8 in (0, 1) and 0 < j < h - 1: t = n - 1
            c.P(x + i, y + j, mat, max(0, min(n - 1, t)))


def screen(c, x, y, w, h, lit=True):
    """모니터 화면: 어두운 테 + 밝은 청록/파랑 화면에 줄(글자 없음)."""
    c.R(x, y, w, h, 'dark', 1)
    if lit:
        c.R(x + 1, y + 1, w - 2, h - 2, 'blue', 3)
        c.HL(x + 1, y + 1, w - 2, 'blue', 4)
        for j in range(y + 2, y + h - 1, 2):
            c.HL(x + 2, j, max(1, (w - 4) * (2 + (j % 3)) // 4), 'navy', 6)
    else:
        c.R(x + 1, y + 1, w - 2, h - 2, 'dark', 3); c.P(x + 1, y + 1, 'dark', 5)


def plant(c, x, y, pot='brick', big=False):
    """화분: 잎 덩이(leaf, 빛 왼위) + 화분(윗면 보이는 테)."""
    r = 4 if big else 3
    cx, cy = x + r, y + r
    c.ell(cx, cy, r + 0.6, r, lambda X, Y, dx, dy, d: ('leaf', 4 if dx + dy < -0.4 else 3 if d < 0.55 else 2))
    for k in range(5):
        a = k * 1.3
        c.P(int(cx + math.cos(a) * r * 0.6), int(cy + math.sin(a) * r * 0.6) - 1, 'leaf', 5)
    py = cy + r - 1
    c.R(cx - r + 1, py, 2 * r - 1, 1, pot, 4)
    c.R(cx - r + 1, py + 1, 2 * r - 1, 3, pot, 2); c.VL(cx - r + 1, py + 1, 3, pot, 3)
    c.HL(cx - r + 2, py + 4, 2 * r - 3, 'ink', 0)


def save(c_or_img, path, scale=1):
    im = c_or_img.img() if isinstance(c_or_img, C) else c_or_img
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if scale != 1: im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
    im.save(path)


_SHEET_COLORS = None


def sheet_colors():
    global _SHEET_COLORS
    if _SHEET_COLORS is None:
        a = np.asarray(Image.open(SHEET).convert('RGBA'))
        v = a[a[:, :, 3] == 255][:, :3]
        _SHEET_COLORS = {tuple(int(q) for q in p) for p in np.unique(v, axis=0)}
    return _SHEET_COLORS


def check_palette():
    """모든 램프 색이 시트에 있는지(새 계열 색 금지)."""
    have = sheet_colors()
    miss = [(m, h) for m in MATS for h in RAMPS[m] if _rgb(h) not in have]
    return miss


if __name__ == '__main__':
    print('램프', len(MATS), '색', sum(NT), '시트에 없는 색', check_palette())
