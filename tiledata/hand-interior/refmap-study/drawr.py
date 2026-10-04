# REFMAP 연구판 32px 그리기 도구. 화소는 전부 여기서 수식으로 만든다(REFMAP·EasyRPG 화소를 읽지 않는다).
# STUDY.md 의 수치를 따른다:
#   - 채도 낮은 색 줄(재질 몸통 s≈0.2~0.35), 단 수 12 — 면 안은 2~3px 폭 띠로 부드럽게 넘어간다.
#   - 윤곽은 검정이 아니라 그 재질의 어두운 단(몸통 밝기의 약 55~65%). 위·왼쪽 테는 덜 어둡게(빛 받는 쪽).
#   - 그림자는 반투명: 오른쪽 아래로 드리운 그림자(알파 두 단) + 발치 접지선.
import math, colorsys
from PIL import Image

N = 12   # 재질 색 줄 단 수

def _ramp(h0, h1, s0, s1, l0, l1, n=N, sm=0.0):
    """어두운 끝(h0,s0,l0) → 밝은 끝(h1,s1,l1). 가운데 채도를 sm 만큼 올린다(가운데가 가장 색이 산다)."""
    out = []
    for i in range(n):
        u = i / (n - 1)
        dh = ((h1 - h0 + 180) % 360) - 180          # 짧은 쪽으로 돈다
        h = (h0 + dh * u) % 360
        s = s0 + (s1 - s0) * u + sm * math.sin(math.pi * u)
        l = l0 + (l1 - l0) * (u ** 0.92)
        r, g, b = colorsys.hls_to_rgb(h / 360, l, max(0, min(1, s)))
        out.append((int(r * 255 + .5), int(g * 255 + .5), int(b * 255 + .5), 255))
    return out

# 어두운 쪽은 붉게·보라로, 밝은 쪽은 누렇게 옮긴다. 몸통 채도는 REFMAP 실측(0.2~0.33) 근처.
RAMP = {
    'oak':    _ramp(8, 42, 0.30, 0.34, 0.10, 0.80, sm=0.06),    # 짙은 참나무 (가구)
    'pine':   _ramp(20, 46, 0.26, 0.42, 0.16, 0.86, sm=0.06),   # 밝은 소나무 (선반·궤짝·마루)
    'linen':  _ramp(24, 44, 0.10, 0.30, 0.22, 0.95, sm=0.04),   # 흰 천·밀가루
    'red':    _ramp(344, 12, 0.34, 0.50, 0.14, 0.82, sm=0.08),  # 붉은 천
    'teal':   _ramp(214, 176, 0.22, 0.26, 0.12, 0.80, sm=0.06), # 청록 천
    'green':  _ramp(150, 74, 0.22, 0.30, 0.10, 0.72, sm=0.08),  # 잎
    'iron':   _ramp(236, 206, 0.10, 0.08, 0.08, 0.86),          # 쇠
    'brass':  _ramp(18, 50, 0.46, 0.58, 0.14, 0.82, sm=0.08),   # 놋
    'clay':   _ramp(6, 28, 0.34, 0.42, 0.14, 0.80, sm=0.06),    # 토기
    'brick':  _ramp(354, 22, 0.24, 0.30, 0.12, 0.74, sm=0.05),  # 벽돌
    'stone':  _ramp(250, 36, 0.06, 0.08, 0.14, 0.84),           # 돌 (어두운 쪽 차갑고 밝은 쪽 따뜻)
    'straw':  _ramp(24, 50, 0.36, 0.50, 0.16, 0.84, sm=0.06),   # 짚·빵 껍질
    'crust':  _ramp(10, 36, 0.46, 0.62, 0.14, 0.78, sm=0.06),   # 구운 빵 껍질
    'fire':   _ramp(356, 54, 0.80, 1.00, 0.20, 0.90),
    'glass':  _ramp(214, 190, 0.20, 0.30, 0.20, 0.94),
    'slate':  _ramp(232, 214, 0.12, 0.10, 0.10, 0.62),          # 천장 테
}
SH_A = (72, 124)   # 드리운 그림자 알파: 바깥 번짐 / 속
SH_C = (26, 16, 20)

def H(x, y, s=0):
    n = (x * 374761393 + y * 668265263 + s * 1442695040888963407) & 0xffffffff
    n = (n ^ (n >> 13)) * 1274126177 & 0xffffffff
    return ((n ^ (n >> 16)) & 0xffff) / 65535

def clamp(v, a=0.0, b=1.0): return a if v < a else (b if v > b else v)

class Cv:
    """재질 캔버스. g[y][x] = [재질, 값 0..1] 또는 None. 값은 렌더할 때 N 단으로 끊는다."""
    def __init__(s, w, h):
        s.w, s.h = w, h; s.g = [[None] * w for _ in range(h)]; s.sh = [[0] * w for _ in range(h)]
        s.lock = set()          # 윤곽 대상에서 빼는 칸(구멍 속 등)
    def ok(s, x, y): return 0 <= x < s.w and 0 <= y < s.h
    def put(s, x, y, m, v):
        x, y = int(x), int(y)
        if s.ok(x, y): s.g[y][x] = [m, clamp(v)]
    def get(s, x, y):
        return s.g[int(y)][int(x)] if s.ok(int(x), int(y)) else None
    def add(s, x, y, d):
        c = s.get(x, y)
        if c: c[1] = clamp(c[1] + d)
    def mul(s, x, y, k):
        c = s.get(x, y)
        if c: c[1] = clamp(c[1] * k)
    def erase(s, x, y):
        if s.ok(int(x), int(y)): s.g[int(y)][int(x)] = None
    def fill(s, x0, y0, x1, y1, m, f):
        """f(x, y, u, v) -> 값 (u,v 는 상자 안 0..1)"""
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                u = (x - x0 + .5) / (x1 - x0 + 1); v = (y - y0 + .5) / (y1 - y0 + 1)
                val = f(x, y, u, v) if callable(f) else f
                if val is not None: s.put(x, y, m, val)
    def ell(s, cx, cy, rx, ry, m, f, x0=None, x1=None, y0=None, y1=None):
        for y in range(int(cy - ry - 1), int(cy + ry + 2)):
            for x in range(int(cx - rx - 1), int(cx + rx + 2)):
                dx = (x + .5 - cx) / rx; dy = (y + .5 - cy) / ry
                if dx * dx + dy * dy <= 1:
                    if (x0 is not None and x < x0) or (x1 is not None and x > x1) or (y0 is not None and y < y0) or (y1 is not None and y > y1): continue
                    s.put(x, y, m, f(x, y, dx, dy) if callable(f) else f)
    def solid(s, x, y):
        return s.ok(x, y) and s.g[y][x] is not None
    def outline(s, dark=0.56, lit=0.78, skip=()):
        """실루엣 테두리 = 그 칸 값을 낮춘 같은 재질. 바깥이 위·왼쪽이면 lit, 아래·오른쪽이면 dark."""
        todo = []
        for y in range(s.h):
            for x in range(s.w):
                c = s.g[y][x]
                if not c or c[0] in skip or (x, y) in s.lock: continue
                lo = not s.solid(x - 1, y); up = not s.solid(x, y - 1)
                ri = not s.solid(x + 1, y); dn = not s.solid(x, y + 1)
                if ri or dn: todo.append((x, y, dark))
                elif lo or up: todo.append((x, y, lit))
        for x, y, k in todo:
            c = s.g[y][x]; c[1] = c[1] * k
    def cast(s, dx=3, dy=2, rows_from=None):
        """드리운 그림자: 실루엣을 오른쪽 아래로 밀어 빈 칸에 알파 두 단. rows_from 보다 아래 칸만(바닥에 닿는 부분)."""
        base = [[s.g[y][x] is not None for x in range(s.w)] for y in range(s.h)]
        for y in range(s.h):
            for x in range(s.w):
                if base[y][x]: continue
                sx, sy = x - dx, y - dy
                if rows_from is not None and sy < rows_from: continue
                if 0 <= sx < s.w and 0 <= sy < s.h and base[sy][sx]:
                    # 가장자리(밀린 실루엣의 끝 한 줄)는 옅게
                    edge = any(not (0 <= sx + a < s.w and 0 <= sy + b < s.h and base[sy + b][sx + a]) for a, b in ((1, 0), (0, 1)))
                    s.sh[y][x] = max(s.sh[y][x], 1 if edge else 2)
    def contact(s, y, x0, x1, a=2):
        """발치 접지선 (빈 칸에만)"""
        for x in range(x0, x1 + 1):
            if s.ok(x, y) and s.g[y][x] is None: s.sh[y][x] = max(s.sh[y][x], a)
    def blob(s, cx, cy, rx, ry, a=1):
        for y in range(int(cy - ry - 1), int(cy + ry + 2)):
            for x in range(int(cx - rx - 1), int(cx + rx + 2)):
                if not s.ok(x, y) or s.g[y][x] is not None: continue
                d = ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2
                if d <= 1: s.sh[y][x] = max(s.sh[y][x], 2 if d < 0.45 and a > 1 else 1)
    def img(s):
        im = Image.new('RGBA', (s.w, s.h)); px = im.load()
        for y in range(s.h):
            for x in range(s.w):
                c = s.g[y][x]
                if c:
                    r = RAMP[c[0]]; px[x, y] = r[int(round(c[1] * (len(r) - 1)))]
                elif s.sh[y][x]:
                    px[x, y] = SH_C + (SH_A[s.sh[y][x] - 1],)
        return im

# ---------------------------------------------------------------- 명암 함수 (빛: 왼쪽 위)
def cyl(u, base, amp=0.30):
    """원통 가로 명암: 밝은 띠는 가운데보다 왼쪽(u≈0.35), 오른쪽 끝이 가장 어둡다."""
    t = math.cos((u - 0.36) * math.pi * 1.05)
    return base + amp * (t - 0.35) - (0.10 if u > 0.9 else 0)

def dome(dx, dy, base, amp=0.32):
    """둥근 덩이(자루·빵·베개): 법선 · 빛(-0.5,-0.7,0.5)"""
    z = math.sqrt(max(0.0, 1 - dx * dx - dy * dy))
    lam = (-0.45 * dx - 0.6 * dy + 0.66 * z)
    return base + amp * (lam - 0.45)

def grain(x, y, seed, amp=0.05, per=7.0, wav=0.35):
    """나무 결: 가로로 긴 물결 줄. 두 톤 차이만 낸다."""
    w = math.sin((y + math.sin(x * 0.09 + seed) * 1.6 + H(x // 11, 0, seed) * 1.2) * (2 * math.pi / per))
    return amp * (1 if w > 0.72 else (0 if w > -0.6 else -0.6)) * (1 if H(x // 5, y, seed) > wav else 0.3)
