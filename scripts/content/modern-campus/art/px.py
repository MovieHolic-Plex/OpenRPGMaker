"""modern_campus 손 도트 엔진 (Opus 다시 그리기, 2026-10-14).

팔레트 잠금: modern3 램프만(`tiledata/atlas-pick/palette/modern3.pal`, jp_city 와 같은 계열). 반투명 없음.
빛은 왼쪽 위. 3/4 탑뷰 = 윗면(밝은 슬래브, 뒤 가장자리 어두운 선) + 남쪽 앞면(한두 단 어둡게).
모든 화소는 (램프, 단) 으로 기억한다 — 윤곽·그늘·접촉 그림자를 «같은 램프의 단 내리기»로 만든다.

단(t)은 램프 안 절대 번호 0(가장 어두움)…n-1. 7단 램프: yoru hodo conc tairu ita garasu kawara renga tekko ki,
5단: mado kinari shiro aka daidai kii midori sora pinku soil yuka kokuban lino murasaki kon, 3단: sumi neonP neonC.
"""
import os, sys, math
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'content', 'atlas-pick'))
from modern3_check import load_pal   # noqa: E402

RAMPS = load_pal()
MATS = list(RAMPS)
MI = {m: i for i, m in enumerate(MATS)}
RGB = [[((c >> 16) & 255, (c >> 8) & 255, c & 255) for c in RAMPS[m]] for m in MATS]
NT = [len(RAMPS[m]) for m in MATS]


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


# ═══════════════════════ 재질 무늬(세계 좌표) ═══════════════════════
def tex_brick(wx, wy, base=4, mat='renga', mortar=('renga', 1), course=4, blen=8, s=3):
    """가로 벽돌: 코스 높이 course(줄눈 1px 포함), 길이 blen, 엇갈림."""
    row = wy // course; yy = wy % course
    xs = wx + (blen // 2 if row % 2 else 0); col = xs // blen; xx = xs % blen
    if yy == course - 1 or xx == blen - 1: return mortar
    v = (h32(col, row, s) % 5)
    t = base + (-1 if v == 0 else 1 if v == 4 else 0)
    if yy == 0 and xx < 3 and v != 0: t += 1
    return (mat, t)


def tex_speckle(wx, wy, mat, base, s=1, lo=0.10, hi=0.08):
    r = rnd(wx, wy, s)
    if r < lo: return (mat, base - 1)
    if r > 1 - hi: return (mat, base + 1)
    return (mat, base)


def tex_cluster(wx, wy, mat, base, s=2, scale=3, amt=0.28):
    """덩이 얼룩(흰 잡음이 아니라 2~3px 덩이)."""
    cx, cy = wx // scale, wy // scale
    r = rnd(cx, cy, s); r2 = rnd(wx, wy, s + 7)
    if r < amt * 0.5 and r2 < 0.8: return (mat, base - 1)
    if r > 1 - amt * 0.5 and r2 < 0.7: return (mat, base + 1)
    return (mat, base)


def tex_grass(wx, wy, s=5, base=4):
    """잔디: 덩이 명암 + 풀잎 하이라이트·그늘 짝(ki 램프)."""
    cx, cy = (wx + (wy // 3) % 2) // 3, wy // 3
    r = rnd(cx, cy, s)
    t = base - 1 if r < 0.22 else base + (1 if r > 0.86 else 0)
    q = rnd(wx, wy, s + 11)
    if q < 0.07: t = base + 1
    elif q < 0.11: t = base - 1
    # 풀잎: 밝은 점 바로 밑에 어두운 점
    if rnd(wx, wy - 1, s + 11) < 0.07: t = base - 1
    return ('ki', t)


def window(c, x, y, w, h, frame=('conc', 5), sill=('conc', 6), glass_mat='garasu', lit=False, mullion=True, s=0, curtain=None):
    """창: 틀 1px(위·좌 밝게) · 유리(위 반사 밝게 → 아래 어둡게, 사선 반사) · 아래 창턱(윗면 밝게 + 밑 그늘)."""
    # 안쪽 그늘(창 깊이): 위 1px 어두운 띠
    c.R(x, y, w, h, *frame)
    gx, gy, gw, gh = x + 1, y + 1, w - 2, h - 2
    for j in range(gh):
        for i in range(gw):
            t = 4 if j == 0 else 3 if j < gh * 0.45 else 2
            if j == 0: t = 1          # 상인방 밑 그늘
            d = (i + j + s) % 9
            if j > 0 and (d == 0 or d == 1) and i < gw - 1: t = 5          # 사선 반사
            c.P(gx + i, gy + j, glass_mat, t)
    if lit:
        for j in range(1, gh):
            for i in range(gw): c.P(gx + i, gy + j, 'mado', 3 if j < gh - 1 else 2)
    if curtain:
        cm, ct = curtain
        cw = max(1, gw // 3)
        c.R(gx, gy + 1, cw, gh - 1, cm, ct); c.VL(gx + cw - 1, gy + 1, gh - 1, cm, ct - 1)
    if mullion and gw >= 6:
        mx = gx + gw // 2
        c.VL(mx, gy, gh, frame[0], frame[1] - 1)
    c.HL(x, y, w, frame[0], frame[1] + 1); c.VL(x, y, h, frame[0], frame[1] + 1)
    c.VL(x + w - 1, y, h, frame[0], frame[1] - 1)
    # 창턱: 윗면 1 밝게 + 앞면 1 + 밑 그늘
    if sill:
        c.HL(x - 1, y + h, w + 2, sill[0], sill[1])
        c.HL(x - 1, y + h + 1, w + 2, sill[0], sill[1] - 2)


def box3(c, x, y, w, top, front, mat, tt=None, ft=None, back=True, edge=True):
    """3/4 상자: 윗면 top 행(밝음, 뒤 가장자리 어두운 선, 앞 모서리 하이라이트) + 앞면 front 행(왼쪽 빛·오른쪽 그늘·밑 그늘)."""
    n = NT[MI[mat]]
    tt = n - 2 if tt is None else tt
    ft = tt - 2 if ft is None else ft
    c.R(x, y, w, top, mat, tt)
    if back: c.HL(x, y, w, mat, tt - 2)
    c.HL(x, y + top - 1, w, mat, tt + 1)                # 앞 모서리 반사
    c.R(x, y + top, w, front, mat, ft)
    c.HL(x, y + top, w, mat, ft - 1)                    # 모서리 밑 그늘(윗면과 앞면을 가른다)
    if front > 2: c.HL(x, y + top + front - 1, w, mat, ft - 2)
    if edge:
        c.VL(x, y, top, mat, tt - 1); c.VL(x + w - 1, y, top, mat, tt - 2)
        c.VL(x, y + top, front, mat, ft + 1); c.VL(x + w - 1, y + top, front, mat, ft - 2)


def save(c_or_img, path, scale=1):
    im = c_or_img.img() if isinstance(c_or_img, C) else c_or_img
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if scale != 1: im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
    im.save(path)
