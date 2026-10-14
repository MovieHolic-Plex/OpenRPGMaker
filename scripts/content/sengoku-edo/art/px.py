"""sengoku_edo 손 도트 엔진 (전국·에도 일본, Opus 2026-10-14).

팔레트 잠금: 아래 RAMPS 만 쓴다(`tiledata/sengoku-edo/palette.json` 로 내보낸다). 반투명 없음. 램프는 어두움 → 밝음.
빛은 왼쪽 위. 3/4 탑뷰 = 윗면(밝은 슬래브, 뒤 가장자리 어두운 선) + 남쪽 앞면(한두 단 어둡게).
모든 화소는 (램프, 단) — 윤곽·그늘·접촉 그림자는 «같은 램프의 단 내리기» 또는 sumi.
"""
import os, sys, math, json
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))

RAMPS = {
    'sumi':    ['#14111a', '#231d28', '#352c38'],
    'kawara':  ['#1c2130', '#283041', '#373f53', '#4a5368', '#5f697e', '#788396', '#95a0af'],
    'dou':     ['#1b3836', '#274f4a', '#36685f', '#4a8274', '#669d8a', '#8ab8a2'],
    'kaya':    ['#3a2a18', '#55401f', '#725a2a', '#907436', '#ad8f47', '#c7a95e', '#dcc47e'],
    'ki':      ['#2c1a12', '#43281a', '#5d3a22', '#784f2d', '#95663a', '#b2814c', '#ca9d64'],
    'kuro':    ['#170f0e', '#25181a', '#362325', '#4b3131', '#634141', '#7c5551'],
    'shikkui': ['#8a8377', '#a69f90', '#c0b9a8', '#d6cfbc', '#e8e1ce', '#f5f0e1'],
    'tsuchi':  ['#4d3522', '#6a492e', '#88603b', '#a4794b', '#bd9361', '#d2ac7b'],
    'ishi':    ['#25252b', '#393940', '#4f4f57', '#67676f', '#818189', '#9c9ca2', '#b9b9bc'],
    'shu':     ['#481410', '#701c14', '#992918', '#c03b1f', '#db5930', '#ec8252'],
    'ai':      ['#121a33', '#1d2a4d', '#2b3d6a', '#405788', '#5d77a6'],
    'kaki':    ['#3b1d0e', '#5d2f14', '#82461c', '#a7622a', '#c7843f'],
    'tatami':  ['#4b4824', '#68642f', '#86803e', '#a29c51', '#bbb569', '#d1cb87'],
    'kusa':    ['#1b2d14', '#294019', '#395620', '#4c6c28', '#628433', '#7c9c42', '#98b45a'],
    'matsu':   ['#0f1e16', '#172f1f', '#20422a', '#2b5636', '#3a6c44', '#4e8355'],
    'sakura':  ['#6d394b', '#995367', '#c1798a', '#dca1ac', '#eec7cb'],
    'momiji':  ['#4e150f', '#792214', '#a4351a', '#cb5124', '#e37934'],
    'take':    ['#23321a', '#37501f', '#4e6b26', '#698930', '#86a53f', '#a6c05a'],
    'mizu':    ['#112337', '#173352', '#1f466c', '#2b5e86', '#3e7a9f', '#5b98b7', '#85b8ce'],
    'michi':   ['#493a28', '#61503a', '#7b6849', '#93805b', '#aa9870', '#c1af88'],
    'suna':    ['#6d6b65', '#87857d', '#a2a096', '#bbb9af', '#d1cfc5', '#e3e1d7'],
    'kin':     ['#593e10', '#856019', '#b08624', '#d3ac3c', '#ebcf6a'],
    'washi':   ['#b7ac8d', '#cfc5a7', '#e2dabf', '#f1ebd5'],
    'hi':      ['#79290e', '#b74914', '#e4832a', '#f6c159'],
}
MATS = list(RAMPS)
MI = {m: i for i, m in enumerate(MATS)}
RGB = [[tuple(int(h[k:k + 2], 16) for k in (1, 3, 5)) for h in RAMPS[m]] for m in MATS]
NT = [len(RAMPS[m]) for m in MATS]


def palette_json(path=None):
    path = path or os.path.join(ROOT, 'tiledata', 'sengoku-edo', 'palette.json')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    json.dump(dict(name='sengoku_edo', note='잠긴 램프(어두움→밝음). 이 밖의 색·반투명 금지.', ramps=RAMPS), open(path, 'w'), ensure_ascii=False, indent=1)


def h32(x, y, s=0):
    n = (x * 374761393 + y * 668265263 + s * 2246822519 + 0x9E3779B9) & 0xffffffff
    n = ((n ^ (n >> 13)) * 1274126177) & 0xffffffff
    return (n ^ (n >> 16)) & 0xffffffff


def rnd(x, y, s=0):
    return h32(x, y, s) / 4294967296.0


class C:
    """캔버스. m = 램프 번호(-1 = 투명), t = 단."""
    def __init__(s, w, h):
        s.w, s.h = w, h
        s.m = np.full((h, w), -1, np.int16)
        s.t = np.zeros((h, w), np.int16)
        s.ox = s.oy = 0                # 세계 좌표 오프셋(무늬 주기용)

    # ── 기본 ──
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
        """다각형 채움(짝홀). fn(x,y)->(mat,t)."""
        ys = [p[1] for p in pts]
        for y in range(max(0, int(min(ys))), min(s.h, int(math.ceil(max(ys))) + 1)):
            xs = []
            yc = y + 0.5
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

    # ── 단 조정 ──
    def shift(s, x, y, dt, keep=('sumi',)):
        g = s.get(x, y)
        if g and g[0] not in keep: s.P(x, y, g[0], g[1] + dt)

    def shift_rect(s, x, y, w, h, dt):
        for j in range(h):
            for i in range(w): s.shift(x + i, y + j, dt)

    def outline(s, mat=None, t=0, bottom=('sumi', 1), sides=True):
        """실루엣 가장자리 화소(4이웃 중 투명)를 자기 램프 0단(또는 mat,t)으로. 아래 가장자리는 bottom(접지 선)."""
        m0 = s.m.copy(); edge = []
        for y in range(s.h):
            for x in range(s.w):
                if m0[y, x] < 0: continue
                up = y == 0 or m0[y - 1, x] < 0
                dn = y == s.h - 1 or m0[y + 1, x] < 0
                lf = x == 0 or m0[y, x - 1] < 0
                rt = x == s.w - 1 or m0[y, x + 1] < 0
                if dn and bottom: edge.append((x, y, bottom))
                elif up or ((lf or rt) and sides): edge.append((x, y, None))
        for x, y, b in edge:
            if b: s.P(x, y, *b)
            elif mat: s.P(x, y, mat, t)
            else:
                g = s.get(x, y); s.P(x, y, g[0], min(g[1], 0 if NT[MI[g[0]]] <= 5 else 1))

    def paste(s, o, x, y):
        for j in range(o.h):
            for i in range(o.w):
                if o.m[j, i] >= 0 and 0 <= x + i < s.w and 0 <= y + j < s.h:
                    s.m[y + j, x + i] = o.m[j, i]; s.t[y + j, x + i] = o.t[j, i]

    def flipx(s):
        o = C(s.w, s.h); o.m = s.m[:, ::-1].copy(); o.t = s.t[:, ::-1].copy(); return o

    def crop(s, x, y, w, h):
        o = C(w, h); o.m = s.m[y:y + h, x:x + w].copy(); o.t = s.t[y:y + h, x:x + w].copy(); return o

    # ── 출력 ──
    def rgba(s):
        a = np.zeros((s.h, s.w, 4), np.uint8)
        for y in range(s.h):
            for x in range(s.w):
                i = s.m[y, x]
                if i >= 0:
                    a[y, x, :3] = RGB[i][s.t[y, x]]; a[y, x, 3] = 255
        return a

    def img(s): return Image.fromarray(s.rgba(), 'RGBA')


def from_rgba(a):
    """modern3 색으로만 된 RGBA 배열을 C 로(ikit 캔버스 연동)."""
    lut = {}
    for i, m in enumerate(MATS):
        for k, c in enumerate(RGB[i]): lut.setdefault(c, (i, k))
    h, w = a.shape[:2]; o = C(w, h)
    for y in range(h):
        for x in range(w):
            if a[y, x, 3] == 255:
                i, k = lut[tuple(int(v) for v in a[y, x, :3])]; o.m[y, x] = i; o.t[y, x] = k
    return o




def save(c_or_img, path, scale=1):
    im = c_or_img.img() if isinstance(c_or_img, C) else c_or_img
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if scale != 1: im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
    im.save(path)


def check_palette(img):
    """그림 색이 잠긴 팔레트 안이고 알파가 0/255 뿐인지. 위반 목록."""
    allowed = {c for r in RGB for c in r}
    a = np.asarray(img.convert('RGBA'))
    bad = []
    al = a[..., 3]
    if ((al != 0) & (al != 255)).any(): bad.append('반투명')
    cols = {tuple(int(v) for v in p[:3]) for p in a[al == 255].reshape(-1, 4)}
    out = cols - allowed
    if out: bad.append('팔레트 밖 %d색' % len(out))
    return bad
