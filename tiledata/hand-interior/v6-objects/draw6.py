# v6 소품 다시 그리기 — 공유 색 줄 + 재질 추적 캔버스.
# 규칙 원본: gg-houses 워크트리 assistant-skills/generated-chipset-authoring/references/easyrpg-craft-study.md
# (EasyRPG 화소는 쓰지 않는다. 방법만 따른다.)
#
# 색 줄: 재질마다 한 줄, 어두운 쪽은 채도를 올리고 붉은 쪽으로, 밝은 끝은 크림. 모든 소품이 이 표만 쓴다.
# 캔버스는 칸마다 (재질, 단)을 기억한다 → 마지막에 outline() 이 실루엣 테두리를 그 재질의 가장 어두운 단으로 긋는다.
import math
from PIL import Image

def hx(s): return tuple(int(s[i:i + 2], 16) for i in (1, 3, 5)) + (255,)

RAMP = {
    # 0 = 윤곽(재질의 가장 어두운 색) … 끝 = 크림 하이라이트
    'wood':  ['#3d160a', '#62260f', '#7e3e1c', '#9c5630', '#bc7642', '#e4b47c'],
    'red':   ['#420a16', '#701424', '#9c2230', '#c03a3a', '#dc6a52', '#f4b894'],
    'blue':  ['#1c1438', '#282a6a', '#30489a', '#4068ba', '#6c98d0', '#cfe0e4'],
    'green': ['#22200c', '#2c4414', '#3e6420', '#56842c', '#80a844', '#d2dc94'],
    'linen': ['#4c3226', '#7c5e4a', '#a8886c', '#c8ae8e', '#e2d0b0', '#f8eed4'],
    'iron':  ['#120e14', '#2a2832', '#444450', '#62646e', '#8a8c94', '#cfcfcc'],   # 검정은 금속·구멍에만
    'brass': ['#4a2208', '#7c4a10', '#b07c1c', '#d8aa38', '#f6e08a'],
    'stone': ['#221c2a', '#3a3444', '#56505e', '#736c78', '#948c96', '#c4bcc0'],   # 보라 기운으로 차갑게
    'clay':  ['#40140c', '#6a2614', '#943e20', '#b85c30', '#d6844c', '#f0c08c'],
    'straw': ['#42240a', '#6c4414', '#966a22', '#bc9034', '#dab456', '#f4dea0'],
    'glass': ['#243a52', '#3e6a8a', '#70a4c4', '#acd4e2', '#eef8f4'],
}
PAL = {m: [hx(c) for c in r] for m, r in RAMP.items()}
def top(m): return len(PAL[m]) - 1

def H(x, y, s=0):
    n = (x * 374761393 + y * 668265263 + s * 1442695040888963407) & 0xffffffff
    n = (n ^ (n >> 13)) * 1274126177 & 0xffffffff
    return ((n ^ (n >> 16)) & 0xffff) / 65535

class C:
    """재질 캔버스. g[y][x] = (재질, 단) 또는 None(투명). raw 칸은 색을 그대로(발효·불꽃 같은 원래 그림)."""
    def __init__(s, w, h):
        s.w, s.h = w, h
        s.g = [[None] * w for _ in range(h)]
    def ok(s, x, y): return 0 <= x < s.w and 0 <= y < s.h
    def set(s, x, y, m, t):
        if s.ok(x, y):
            t = max(0, min(top(m), t)); s.g[y][x] = (m, t)
    def get(s, x, y): return s.g[y][x] if s.ok(x, y) else None
    def clear(s, x, y):
        if s.ok(x, y): s.g[y][x] = None
    def rect(s, x0, y0, x1, y1, m, t):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): s.set(x, y, m, t)
    def hl(s, x0, x1, y, m, t):
        for x in range(x0, x1 + 1): s.set(x, y, m, t)
    def vl(s, x, y0, y1, m, t):
        for y in range(y0, y1 + 1): s.set(x, y, m, t)
    def shade(s, x, y, d):
        """같은 재질에서 d 단 옮김"""
        v = s.get(x, y)
        if v: s.set(x, y, v[0], v[1] + d)
    def ell(s, cx, cy, rx, ry, m, t):
        for y in range(s.h):
            for x in range(s.w):
                if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1: s.set(x, y, m, t)
    def outline(s, only=None):
        """실루엣 테두리(투명 이웃이 있는 칸)를 그 칸 재질의 0단으로. 캔버스 가장자리도 바깥으로 본다."""
        edge = []
        for y in range(s.h):
            for x in range(s.w):
                v = s.g[y][x]
                if not v: continue
                if only and v[0] not in only: continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    X, Y = x + dx, y + dy
                    if not s.ok(X, Y) or s.g[Y][X] is None: edge.append((x, y)); break
        for x, y in edge:
            m, _ = s.g[y][x]; s.g[y][x] = (m, 0)
    def img(s):
        im = Image.new('RGBA', (s.w, s.h)); px = im.load()
        for y in range(s.h):
            for x in range(s.w):
                v = s.g[y][x]
                if v: px[x, y] = PAL[v[0]][v[1]]
        return im

# ---------------- 공통 조각 ----------------
def grain(c, x0, y0, x1, y1, m, t, seed=1, dens=0.10):
    """나무 윗면 결: 가로로 긴 한 단 어두운 줄 몇 개 (디더 없음, 짧은 줄끼리 붙지 않게)"""
    for y in range(y0, y1 + 1):
        x = x0
        while x <= x1:
            if H(x // 3, y, seed) < dens:
                ln = 2 + int(H(x, y, seed + 7) * 4)
                for xx in range(x, min(x1, x + ln - 1) + 1): c.set(xx, y, m, t)
                x += ln + 3
            else: x += 1

def band_tone(u, base):
    """원통 세로 띠: 밝은 띠는 가운데보다 약간 왼쪽, 오른쪽 끝이 가장 어둡다. base = 밝은 띠의 단"""
    if u < 0.14: return base - 2
    if u < 0.30: return base - 1
    if u < 0.50: return base
    if u < 0.68: return base - 1
    if u < 0.86: return base - 2
    return base - 3

def cyl_rows(c, cx, rows, m, base, y0):
    """rows = 줄마다 반폭(half width, 소수 가능). 가운데 cx 를 기준으로 세로 띠 명암."""
    for j, hw in enumerate(rows):
        if hw <= 0: continue
        xa = int(math.floor(cx - hw + .5)); xb = int(math.ceil(cx + hw - .5)) - 1
        for x in range(xa, xb + 1):
            u = (x - xa + .5) / (xb - xa + 1)
            c.set(x, y0 + j, m, band_tone(u, base))

def ring(c, cx, cy, rx, ry, m, tone_top, tone_bot, inner=None, inner_rx=None, inner_ry=None):
    """타원 윗테. 바깥 테두리 한 줄: 윗 반은 밝게, 아랫 반은 어둡게. inner=(m,t) 는 안쪽 채움."""
    irx = inner_rx if inner_rx is not None else rx - 1.2
    iry = inner_ry if inner_ry is not None else ry - 1.0
    for y in range(c.h):
        for x in range(c.w):
            dx, dy = x + .5 - cx, y + .5 - cy
            if (dx / rx) ** 2 + (dy / ry) ** 2 > 1: continue
            if irx > 0 and iry > 0 and (dx / irx) ** 2 + (dy / iry) ** 2 <= 1:
                if inner: c.set(x, y, inner[0], inner[1])
                continue
            c.set(x, y, m, tone_top if dy < 0 else tone_bot)

def to_pix(im):
    """v5 G(상품 그림) 함수가 그릴 수 있게 v5 Pix 로 감싼다"""
    import k as K5
    p = K5.Pix(im.width, im.height); p.im.alpha_composite(im); return p
