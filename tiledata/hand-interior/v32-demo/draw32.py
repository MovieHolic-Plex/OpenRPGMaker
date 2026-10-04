# 32px 소품용 재질 캔버스 + 공통 색 줄 (v6 draw6 을 32px 로 넓힌 판).
# 규칙: easyrpg-craft-study.md (윗면 위주, 안쪽 조용, 윤곽 = 재질 0단, 원통 세로 띠, 반복 흐트러뜨림, 재질별 공통 색 줄).
# v6 색 줄(6단)에 중간 단을 끼워 7단으로 넓혔다. 모든 32px 소품·벽·바닥은 이 표만 쓴다.
import math
from PIL import Image

def hx(s): return tuple(int(s[i:i + 2], 16) for i in (1, 3, 5)) + (255,)

RAMP = {
    'wood':  ['#3d160a', '#62260f', '#7e3e1c', '#9c5630', '#b06a3a', '#c8844c', '#e4b47c'],
    'red':   ['#420a16', '#701424', '#9c2230', '#c03a3a', '#ce5046', '#dc6a52', '#f4b894'],
    'blue':  ['#1c1438', '#282a6a', '#30489a', '#4068ba', '#5480c6', '#7ca4d4', '#d4e4e4'],
    'green': ['#22200c', '#2c4414', '#3e6420', '#56842c', '#6c9838', '#8cb04c', '#cad88c'],
    'linen': ['#4c3226', '#7c5e4a', '#a8886c', '#c8ae8e', '#dcc6a4', '#ece0c4', '#fbf4e0'],
    'iron':  ['#120e14', '#2a2832', '#444450', '#62646e', '#8a8c94', '#b0b2b4', '#e0e0da'],
    'brass': ['#4a2208', '#7c4a10', '#b07c1c', '#d8aa38', '#f0cc60', '#fcf0b0'],
    'stone': ['#221c2a', '#3a3444', '#56505e', '#6a6472', '#807882', '#9a929c', '#c8c0c4'],
    'clay':  ['#40140c', '#6a2614', '#943e20', '#b85c30', '#cc7440', '#e2945c', '#f4c894'],
    'straw': ['#42240a', '#6c4414', '#966a22', '#bc9034', '#dab456', '#f4dea0'],
    'fire':  ['#5a1004', '#a42808', '#e05410', '#f88c20', '#fcc444', '#fff4b0'],
    'glass': ['#243a52', '#3e6a8a', '#70a4c4', '#acd4e2', '#eef8f4'],
}
PAL = {m: [hx(c) for c in r] for m, r in RAMP.items()}
SHADOW = (24, 10, 4, 96)          # 발치 접지 그림자 (반투명, 윤곽 대상 아님)
def top(m): return len(PAL[m]) - 1

def H(x, y, s=0):
    n = (x * 374761393 + y * 668265263 + s * 1442695040888963407) & 0xffffffff
    n = (n ^ (n >> 13)) * 1274126177 & 0xffffffff
    return ((n ^ (n >> 16)) & 0xffff) / 65535

class C:
    """재질 캔버스. g[y][x] = (재질, 단) 또는 None. 'shd' = 접지 그림자."""
    def __init__(s, w, h):
        s.w, s.h = w, h; s.g = [[None] * w for _ in range(h)]
    def ok(s, x, y): return 0 <= x < s.w and 0 <= y < s.h
    def set(s, x, y, m, t=0):
        if not s.ok(x, y): return
        if m == 'shd':
            if s.g[y][x] is None: s.g[y][x] = ('shd', 0)
            return
        s.g[y][x] = (m, max(0, min(top(m), t)))
    def get(s, x, y): return s.g[y][x] if s.ok(x, y) else None
    def clear(s, x, y):
        if s.ok(x, y): s.g[y][x] = None
    def rect(s, x0, y0, x1, y1, m, t=0):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): s.set(x, y, m, t)
    def hl(s, x0, x1, y, m, t): s.rect(x0, y, x1, y, m, t)
    def vl(s, x, y0, y1, m, t): s.rect(x, y0, x, y1, m, t)
    def shade(s, x, y, d):
        v = s.get(x, y)
        if v and v[0] != 'shd': s.set(x, y, v[0], v[1] + d)
    def mat(s, x, y):
        v = s.get(x, y); return v[0] if v else None
    def ell(s, cx, cy, rx, ry, m, t):
        for y in range(s.h):
            for x in range(s.w):
                if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1: s.set(x, y, m, t)
    def rrect(s, x0, y0, x1, y1, m, t, r=2):
        """모서리를 r 칸 깎은 사각형"""
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                dx = max(x0 + r - x, 0, x - (x1 - r)); dy = max(y0 + r - y, 0, y - (y1 - r))
                if dx * dx + dy * dy <= r * r + (0 if r < 2 else r - 1): s.set(x, y, m, t)
    def shadow_ell(s, cx, cy, rx, ry):
        for y in range(s.h):
            for x in range(s.w):
                if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1: s.set(x, y, 'shd')
    def edge_cells(s, only=None):
        out = []
        for y in range(s.h):
            for x in range(s.w):
                v = s.g[y][x]
                if not v or v[0] == 'shd': continue
                if only and v[0] not in only: continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    X, Y = x + dx, y + dy
                    w = s.g[Y][X] if s.ok(X, Y) else None
                    if w is None or w[0] == 'shd': out.append((x, y)); break
        return out
    def outline(s, only=None, soft=()):
        """실루엣 테두리 = 그 재질 0단. soft 재질(잎·불꽃)은 한 단만 어둡게."""
        for x, y in s.edge_cells(only):
            m, t = s.g[y][x]
            s.g[y][x] = (m, max(0, t - 2)) if m in soft else (m, 0)
    def img(s):
        im = Image.new('RGBA', (s.w, s.h)); px = im.load()
        for y in range(s.h):
            for x in range(s.w):
                v = s.g[y][x]
                if v: px[x, y] = SHADOW if v[0] == 'shd' else PAL[v[0]][v[1]]
        return im

def grain(c, x0, y0, x1, y1, m, t, seed=1, dens=0.06, lmin=5, lmax=14, gap=6):
    """나무 결: 가로로 긴 한 단 어두운 줄. 짧은 줄끼리 붙지 않게, 줄 끝은 한 칸 비껴 자연스럽게."""
    for y in range(y0, y1 + 1):
        x = x0
        while x <= x1:
            if H(x // 4, y, seed) < dens and not any(c.get(xx, y - 1) == (m, t) for xx in range(x, x + 3)):
                ln = lmin + int(H(x, y, seed + 7) * (lmax - lmin))
                for j, xx in enumerate(range(x, min(x1, x + ln - 1) + 1)):
                    yy = y + (1 if (j > ln * 0.7 and H(x, y, seed + 3) < 0.5) else 0)
                    if yy <= y1: c.set(xx, yy, m, t)
                x += ln + gap
            else: x += 1

def band_tone(u, base):
    """원통 세로 띠 (7단 판): 밝은 띠는 가운데보다 왼쪽, 오른쪽 끝이 가장 어둡다"""
    if u < 0.08: return base - 2
    if u < 0.20: return base - 1
    if u < 0.30: return base
    if u < 0.40: return base + 1
    if u < 0.52: return base
    if u < 0.66: return base - 1
    if u < 0.82: return base - 2
    return base - 3

def cyl_rows(c, cx, rows, m, base, y0, keep=None):
    for j, hw in enumerate(rows):
        if hw <= 0: continue
        xa = int(math.floor(cx - hw + .5)); xb = int(math.ceil(cx + hw - .5)) - 1
        for x in range(xa, xb + 1):
            u = (x - xa + .5) / (xb - xa + 1)
            c.set(x, y0 + j, m, band_tone(u, base))
