"""jp_city 물·물가 손 도트 공용 그림 — 바다·강 몸통, 모래 해변·부두 안벽·자연 둑 가장자리, 부두 콘크리트 판, 등대, 폭포.

2026-10-20 사용자 승인 시안(~/claude-viz/modern-tiles-proto/water/src/{wlib,shore,props}.py)을 굽기용으로 옮긴 것이다.
시안과 달라진 점(굽기 계약 때문):
  - 물 바탕은 **16px 주기**다. 엔진(autotileEngine.cellHash)은 몸통 변형을 칸 위치 해시로 아무렇게나 고르므로
    시안의 64px 주기 잡음은 이어지지 않는다. 그래서 바탕은 모든 변형이 같은 단색(운하 쪽빛 2단)이고,
    얼룩·물결·반짝임은 칸 안쪽(가장자리 1px 이상 안)에만 그린다 → 어느 변형끼리 붙여도 이음매가 없다.
  - 사용자 지시로 어두운 얼룩을 줄였다(시안 약 30% → 칸당 0~1개, 작게).
  - 물가 흔들림·잡음은 칸 안 좌표(0..15)로 재고 주기 16 이다 → 같은 변의 칸끼리 이어진다.
  - 폭포는 강 칸을 품지 않는다(강 열은 투명). 지도 바닥의 강 오토타일이 그대로 비친다.
색: jp_city 로케일 계약 램프 J(재료, 0..4) + modern3 보조 램프(conc·soil·garasu) + sumi 윤곽. 반투명 없음.
"""
import json, math, os
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
_C = json.load(open(os.path.join(ROOT, 'tiledata', 'jp-city', 'palette-contract.json'), encoding='utf-8'))
RAMP = {m['id']: [int(h[1:], 16) for h in m['steps']] for f in _C['families'] for m in f['materials']}
OL = 0x1a1226          # modern3 sumi 1 — jp_city 윤곽
OL2 = 0x2c2538         # sumi 2
# modern3 보조 램프(계약 supportRamps — jp_city 시트에 이미 있는 색)
EXTRA = {
    'conc': [0x504f5c, 0x666775, 0x7f8191, 0x999dad, 0xb4b2c7, 0xcdc9de, 0xe3dff2],
    'soil': [0x331a18, 0x4c3027, 0x694d38, 0x876d54, 0xa68e73],
    'garasu': [0x1b2138, 0x293952, 0x39536b, 0x4a7387, 0x627ca3, 0x7d8ebf, 0x9eb0e0],
}


def J(mat, s):
    r = RAMP[mat] if mat in RAMP else EXTRA[mat]
    return r[max(0, min(len(r) - 1, s))]


def rgb(c):
    return ((c >> 16) & 255, (c >> 8) & 255, c & 255)


class Cv:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.a = np.zeros((h, w, 4), np.uint8)

    def P(self, x, y, c):
        x, y = int(x), int(y)
        if 0 <= x < self.w and 0 <= y < self.h:
            self.a[y, x] = (*rgb(c), 255)

    def get(self, x, y):
        if 0 <= x < self.w and 0 <= y < self.h and self.a[y, x, 3]:
            r, g, b = self.a[y, x, :3]
            return (int(r) << 16) | (int(g) << 8) | int(b)
        return None

    def R(self, x, y, w, h, c):
        for j in range(y, y + h):
            for i in range(x, x + w):
                self.P(i, j, c)

    def HL(self, x, y, w, c): self.R(x, y, w, 1, c)
    def VL(self, x, y, h, c): self.R(x, y, 1, h, c)

    def img(self):
        return Image.fromarray(self.a, 'RGBA')


def disc(c, cx, cy, r, col, ry=None):
    ry = r if ry is None else ry
    for y in range(int(cy - ry - 1), int(cy + ry + 2)):
        for x in range(int(cx - r - 1), int(cx + r + 2)):
            if ((x + 0.5 - cx) / r) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1.0:
                c.P(x, y, col)


def H(x, y, s=0):
    n = (x * 374761393 + y * 668265263 + s * 2246822519) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFFFF) / 0xFFFFFF


def pnoise(x, y, period=16, cell=4, s=0):
    """주기 period 로 감기는 값 잡음 0..1 (격자 cell, 부드러운 보간)."""
    n = period // cell
    gx, gy = x / cell, y / cell
    x0, y0 = int(math.floor(gx)), int(math.floor(gy))
    fx, fy = gx - x0, gy - y0
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy)
    def v(i, j): return H(i % n, j % n, s)
    a = v(x0, y0) * (1 - fx) + v(x0 + 1, y0) * fx
    b = v(x0, y0 + 1) * (1 - fx) + v(x0 + 1, y0 + 1) * fx
    return a * (1 - fy) + b * fy


# ═══════════════════════════ 물 몸통(16px 주기, 칸 안 디테일) ═══════════════════════════
# 바다 몸통 6벌(v0 = gnd/sea, v1~v5 = jp:sea-body; 2026-10-20 둘째 판). 칸 둘레 1px 는 모두 바탕 단색이라 어느 두 벌이 붙어도 이음매가 같다.
# 넓은 바다에서 16px 격자가 읽히지 않게 벌마다 밀도·줄(행) 위치를 일부러 다르게 둔다 — 거의 빈 칸, 엇갈린 짝, 한 줄 긴 물결, 반짝임,
# 옅은 누운 덩이(얕은 물 garasu 2, 납작하게). 흰 반짝임은 넓은 바다에 격자로 찍혀 보여 몸통에는 두지 않는다. 같은 행에 물결이 두 벌 넘게 오지 않는다.
#   dash = (x, y, 길이, 밝기 단 3|4) — 아래 행 x+1 부터 그늘 1px.  light = (중심x, 중심y, 반지름x, 반지름y).
SEA_BODY = {
    0: dict(light=[], dark=[], dash=[(3, 5, 4, 3), (9, 11, 3, 3)], glint=None),
    1: dict(light=[], dark=[], dash=[(10, 3, 3, 3)], glint=None),
    2: dict(light=[(7.5, 9.0, 3.6, 0.85)], dark=[], dash=[(2, 13, 4, 3)], glint=None),
    3: dict(light=[], dark=[], dash=[(2, 6, 3, 3), (7, 8, 5, 3)], glint=None),
    4: dict(light=[], dark=[], dash=[(4, 10, 3, 3), (11, 4, 2, 4)], glint=None),
    5: dict(light=[(5.0, 6.5, 2.6, 0.8)], dark=[], dash=[(1, 2, 3, 3), (8, 12, 5, 4)], glint=None),
}


def _features(kind, v):
    """변형 v 의 칸 안 디테일 목록. 모두 칸 가장자리 1px 안쪽에 머문다(바탕 단색 테두리 → 어느 변형끼리도 이음매 없음).
    v >= 100 은 물가 가장자리 칸용(디테일을 줄인다 — 같은 마스크 칸이 물가를 따라 되풀이되므로)."""
    edge = v >= 100
    rnd = lambda k, s: H(v * 7 + 3, k, s + (0 if kind == 'sea' else 50))
    f = dict(light=[], dark=[], dash=[], glint=None)
    if kind == 'sea' and not edge and v in SEA_BODY:
        return {k: (list(x) if isinstance(x, list) else x) for k, x in SEA_BODY[v].items()}
    if kind == 'sea':
        # 얕은 물 덩이(garasu 2)는 가로로 눕힌 물결 덩이, 깊은 물(canal 1)은 사용자 지시로 줄여 가는 골 한 줄만(변형 셋에 하나)
        if rnd(1, 1) < (0.35 if edge else 0.55):
            f['light'].append((5.0 + rnd(2, 1) * 6, 4.0 + rnd(3, 1) * 8, 2.8 + rnd(4, 1) * 1.6, 1.1 + rnd(5, 1) * 0.6))
        if not edge and v % 3 == 1:
            f['dark'].append((5.0 + rnd(6, 1) * 6, 4.0 + rnd(7, 1) * 8, 2.6 + rnd(8, 1) * 1.2, 0.75))
        nd = 1 if edge else 1 + int(rnd(10, 1) * 2.4)
        for k in range(nd):
            L = 3 + int(rnd(20 + k, 1) * 3)
            f['dash'].append((1 + int(rnd(30 + k, 1) * (14 - L)), 2 + int(rnd(40 + k, 1) * 11), L, 4 if (not edge and rnd(50 + k, 1) > 0.82) else 3))
        if v in (2, 5):
            f['glint'] = (3 + int(rnd(60, 1) * 10), 3 + int(rnd(61, 1) * 10))
    else:  # 강: 세로 물살 줄(흐름 남북) + 옅은 얼룩
        if rnd(1, 1) < 0.4:
            f['light'].append((4.5 + rnd(2, 1) * 7, 4.5 + rnd(3, 1) * 7, 1.3 + rnd(4, 1) * 0.6, 2.8 + rnd(5, 1) * 1.4))
        nd = 1 if edge else 1 + int(rnd(10, 1) * 2.6)
        xs = []
        for k in range(nd):
            L = 4 + int(rnd(20 + k, 1) * 4)
            x0 = 2 + int(rnd(30 + k, 1) * 11)
            if any(abs(x0 - q) < 3 for q in xs): continue
            xs.append(x0)
            f['dash'].append((x0, 1 + int(rnd(40 + k, 1) * (12 - L)), L, 4 if (not edge and rnd(50 + k, 1) > 0.85) else 3))
        # 흰 반짝임은 두지 않는다(2026-10-20 둘째 판) — 강 몸통 4벌이 위치 해시로 섞여도 반짝임 칸이 격자로 읽혔다.
    return f


_FEAT = {}


def water_px(kind, x, y, v=0, calm=False):
    """물 한 화소(칸 안 좌표 x,y). kind 'sea'|'river'. calm=True 면 물결·반짝임 없이(안벽 밑 그늘 물)."""
    key = (kind, v)
    if key not in _FEAT: _FEAT[key] = _features(kind, v)
    f = _FEAT[key]
    col = J('canal_indigo', 2)
    if calm: return col
    def inside(e, sx, sy):
        ex, ey, rx, ry = e
        wob = (pnoise(sx * 2, sy * 2, 16, 4, 77 + v) - 0.5) * 0.5
        return ((x + 0.5 - ex) / rx) ** 2 + ((y + 0.5 - ey) / ry) ** 2 <= 1.0 + wob
    for e in f['light']:
        if inside(e, x, y): col = J('garasu', 2)
    for e in f['dark']:
        if inside(e, x, y): col = J('canal_indigo', 1)
    if kind == 'sea':
        for dx, dy, L, tone in f['dash']:
            if y == dy and dx <= x < dx + L: return J('canal_indigo', tone)
            if y == dy + 1 and dx + 1 <= x < dx + L: return J('canal_indigo', 1)
    else:
        for dx, dy, L, tone in f['dash']:
            if x == dx and dy <= y < dy + L + 2:
                k = y - dy
                return J('canal_indigo', 4) if k == 1 and tone == 4 else J('canal_indigo', 3) if k < L else J('garasu', 3)
            if x == dx + 1 and dy + 1 <= y < dy + L: return J('canal_indigo', 1)
    if f['glint']:
        gx0, gy0 = f['glint']
        if (x, y) == (gx0, gy0): return J('vending_cool_white', 4)
        if (x, y) in ((gx0 - 1, gy0), (gx0 + 1, gy0)): return J('garasu', 4)
    return col


def water_body(kind, v):
    c = Cv(16, 16)
    for y in range(16):
        for x in range(16):
            c.P(x, y, water_px(kind, x, y, v))
    return c


# ═══════════════════════════ 물가 가장자리 ═══════════════════════════
def wob(t, s):
    """주기 16(=1칸) 매끈한 흔들림 — 같은 변의 칸끼리 물가 선이 이어진다."""
    p = 2 * math.pi / 16
    return 0.75 * math.sin(p * t + s) + 0.3 * math.sin(2 * p * t + 2.1 * s)


def smin(a, b, k=2.5):
    return -k * math.log(math.exp(-a / k) + math.exp(-b / k))


def band_natural(t, side, d, x, y):
    """자연 물가 띠. t 'S' 모래 해변 / 'G' 풀·숲 둑. d = 땅 경계에서 물 쪽으로 잰 거리(px)."""
    if t == 'S':
        e = d + (pnoise(x, y, 16, 4, 31) - 0.5) * 1.6
        if e < 2.0: return J('cream_stucco', 0) if pnoise(x, y, 16, 2, 32) > 0.62 else J('cream_stucco', 1)
        if e < 3.0: return J('vending_cool_white', 4) if pnoise(x, y, 16, 2, 33) > 0.35 else J('vending_cool_white', 2)
        if e < 4.0: return J('vending_cool_white', 3) if H(x, y, 34) > 0.55 else J('onsen_mineral_teal', 4)
        if e < 6.5: return J('onsen_mineral_teal', 3) if pnoise(x, y, 16, 4, 35) > 0.45 else J('onsen_mineral_teal', 2)
        if e < 9.5: return J('garasu', 3) if pnoise(x, y, 16, 4, 36) > 0.5 else J('canal_indigo', 3)
        return None
    # G 둑(2026-10-20 둘째 판: 시안 쪽으로 두껍게) — 풀 가장자리 어두운 테 → 흙 입술(밝은 윗면·그늘) → 젖은 띠 → 얕은 물.
    # 북쪽 땅이면 흙 높이면 4px 이 보인다(3/4). 동·서·남은 같은 2px 흙 테(좌우 대칭).
    if side == 'N':
        if d < 1: return J('moss', 0)
        if d < 2: return J('soil', 3) if H(x, y, 41) > 0.25 else J('soil', 2)
        if d < 3: return J('soil', 2) if H(x, y, 42) > 0.3 else J('soil', 3)
        if d < 5: return J('soil', 1) if (d >= 4 or H(x, y, 45) > 0.35) else J('soil', 2)
        if d < 6: return J('canal_indigo', 0)
        if d < 9: return J('canal_indigo', 2) if (d >= 8 and H(x, y, 43) > 0.6) else J('canal_indigo', 1)
        return None
    if d < 1: return J('moss', 0) if side != 'S' else J('moss', 1)
    if d < 2: return J('soil', 3) if (side != 'S' and H(x, y, 46) > 0.3) else J('soil', 2)
    if d < 3: return J('soil', 1)
    if d < 4: return J('canal_indigo', 0)
    if d < 6: return J('canal_indigo', 2) if (d >= 5 and H(x, y, 44) > 0.5) else J('canal_indigo', 1)
    return None


FH = 12  # 부두 안벽 높이면(물 칸 안 px)


def quay_face_px(x, y):
    """북쪽이 부두일 때 물 칸 윗부분: 갓돌 밑 그늘 → 콘크리트 블록 높이면 → 젖은 이끼 띠 → 찰랑 거품 → 그늘 물."""
    if y == 0: return J('conc', 1)
    if y < 10:
        course = (y - 1) // 3; r = (y - 1) % 3
        off = 4 if course % 2 else 0
        vj = (x + off) % 8 == 7
        dark = 1 if y >= 7 else 0
        if r == 2: return J('conc', 1 - dark)
        if vj: return J('conc', 1 - dark)
        if (x + off) % 8 == 0 and r == 0: return J('conc', 4 - dark)
        if r == 0: return J('conc', 3 - dark)
        stain = pnoise(x, y, 16, 4, 51) > 0.72
        return J('conc', 2 - dark - (1 if stain else 0))
    edge = 10 + (1 if pnoise(x, 0, 16, 4, 52) > 0.55 else 0)
    if y < edge: return J('onsen_mineral_teal', 1) if H(x, y, 53) > 0.3 else J('moss', 1)
    if y < 12: return J('onsen_mineral_teal', 0) if H(x, y, 54) > 0.35 else OL2
    if y == 12: return J('vending_cool_white', 4) if pnoise(x, 0, 16, 2, 55) > 0.45 else J('vending_cool_white', 1)
    if y == 13: return J('canal_indigo', 0) if H(x, y, 56) > 0.3 else J('vending_cool_white', 1)
    return J('canal_indigo', 1)


DIRS = dict(N=1, E=2, S=4, W=8, NE=16, SE=32, SW=64, NW=128)


def _nb_from_mask(m, water, land):
    """canon 마스크 → 이웃 문자 함수. 켜진 비트 = 물(같은 물), 꺼진 비트 = 땅."""
    def nb(dx, dy):
        name = ('N' if dy < 0 else 'S' if dy > 0 else '') + ('E' if dx > 0 else 'W' if dx < 0 else '')
        return water if m & DIRS[name] else land
    return nb


ALT_BUMP = {0: 0.0, 1: 1.7, 2: -1.4}


def _bump(t, alt):
    """곧은 물가 대체 칸의 흔들림 덧셈 — 칸 양끝(t=0·16)에서 0 이라 기본 칸·다른 대체 칸과 이어진다."""
    if not alt: return 0.0
    a = ALT_BUMP[alt]
    u = min(1.0, max(0.0, (t - 1.5) / 13.0))       # 양끝 두 화소(0·1, 14·15)는 0 — 기본 칸과 화소 그대로 같다
    env = math.sin(math.pi * u)
    return a * env + 0.35 * a * math.sin(2 * math.pi * u + 0.6 * alt) * env


def shore_cell(kind, land, m, land_px=None, v=0, alt=0):
    """물 칸 하나(16×16). kind 'sea'|'river', land 'S' 모래 · 'G' 풀/숲 둑 · 'D' 부두 안벽(땅 질감 없음),
    m = canon 8방 마스크(켜진 비트 = 물 이웃). land_px(x,y) → 자연 물가 안쪽으로 파고든 땅 화소(그 땅 몸통 칸과 같은 그림)."""
    W = 'W'
    nb = _nb_from_mask(m, W, land)
    N, S, E, Wn = nb(0, -1), nb(0, 1), nb(1, 0), nb(-1, 0)
    NW, NE, SW, SE = nb(-1, -1), nb(1, -1), nb(-1, 1), nb(1, 1)
    isl = lambda t: t != W
    c = Cv(16, 16)
    for y in range(16):
        for x in range(16):
            col = None
            if land == 'D':
                # 1) 부두 안벽(곧은 모양)
                if N == 'D' and y <= 13:
                    col = quay_face_px(x, y)
                    if E == 'D' and x == 15 and y < 10: col = J('conc', 1)
                    if Wn == 'D' and x == 0 and y < 10: col = J('conc', 2)
                elif NW == 'D' and not isl(N) and not isl(Wn) and x < 5 and y <= 13:
                    col = J('canal_indigo', 0) if x < 2 else J('canal_indigo', 1)
                if col is None and Wn == 'D':
                    if x == 0: col = OL
                    elif x < 2: col = J('canal_indigo', 0)
                    elif x < 5: col = J('canal_indigo', 1)
                if col is None and E == 'D':
                    if x == 15: col = OL
                    elif x == 14: col = J('canal_indigo', 0)
                    elif x == 13 and pnoise(0, y, 16, 4, 61) > 0.62: col = J('vending_cool_white', 2)
                if col is None and S == 'D':
                    if y == 15: col = OL
                    elif y == 14: col = J('canal_indigo', 0)
                    elif y == 13 and pnoise(x, 0, 16, 4, 62) > 0.55: col = J('vending_cool_white', 2)
                if col is None and SW == 'D' and not isl(S) and not isl(Wn) and x < 2 and y >= 14:
                    col = J('canal_indigo', 0)
                if col is not None:
                    c.P(x, y, col); continue
                c.P(x, y, water_px(kind, x, y, v if m == 255 else 100 + v, calm=(N == 'D')))
                continue
            # 2) 자연 물가: 방향별 거리 + 흔들림, 부드러운 최소
            cands = []
            if isl(N): cands.append((y + 0.5 - wob(x, 1.0) - _bump(x + 0.5, alt), 'N'))
            if isl(S): cands.append((15.5 - y - wob(x, 2.3) - _bump(x + 0.5, alt), 'S'))
            if isl(Wn): cands.append((x + 0.5 - wob(y, 3.1) - _bump(y + 0.5, alt), 'W'))
            if isl(E): cands.append((15.5 - x - wob(y, 3.1) - _bump(y + 0.5, alt), 'E'))
            for t, ddx, ddy in ((NW, -1, -1), (NE, 1, -1), (SW, -1, 1), (SE, 1, 1)):
                if isl(t) and not isl(nb(ddx, 0)) and not isl(nb(0, ddy)):
                    px = (x + 0.5) if ddx < 0 else (15.5 - x)
                    py = (y + 0.5) if ddy < 0 else (15.5 - y)
                    sd = 'N' if (ddy < 0 and py < px) else ('W' if ddx < 0 else 'E')
                    cands.append((math.hypot(px, py), sd))
            if cands:
                cands.sort(key=lambda q: q[0])
                d, side = cands[0]
                if len(cands) > 1:
                    d = smin(d, cands[1][0], 4.0)
                if d < 0:
                    c.P(x, y, land_px(x, y)); continue
                col = band_natural(land, side, d, x, y)
                if col is not None:
                    c.P(x, y, col); continue
            c.P(x, y, water_px(kind, x, y, v if m == 255 else 100 + v))
    return c


# ═══════════════════════════ 부두 콘크리트 판(땅 칸) ═══════════════════════════
def quay_deck_cell(m=255, v=0):
    """부두 콘크리트 칸: 칸마다 판석(가로 줄눈 y=15, 세로 줄눈 x=15 공통 — 변형끼리 이음매 없음) + 물 쪽 갓돌 테.
    m = canon 8방 마스크(켜진 비트 = 부두/땅, 꺼진 비트 = 물). v = 몸통 변형(판 밝기·가운데 줄눈·얼룩)."""
    # 세로 줄눈: v0·v3 오른쪽 끝(x=15), v1 없음(판이 옆 칸으로 이어짐), v2 가운데(x=7) — 해시로 섞이면 판 길이가 8~48px 로 흩어진다.
    tone = 4
    vj = {0: (15,), 1: (), 2: (7,), 3: (15,)}[v]
    c = Cv(16, 16)
    for y in range(16):
        for x in range(16):
            if y == 15 or x in vj:
                col = J('conc', 2)
            elif y == 0:
                col = J('conc', tone)
            else:
                h = H(x, y, 72 + v)
                col = J('conc', tone)
                if h > 0.9: col = J('conc', tone - 1)
                elif h < 0.04: col = J('conc', tone + 1)
                if v == 3 and pnoise(x, y, 16, 4, 71) > 0.66 and h > 0.45: col = J('conc', tone - 1)
            c.P(x, y, col)
    on = lambda b: bool(m & DIRS[b])
    N, E, S, Wn = on('N'), on('E'), on('S'), on('W')
    if not N:
        c.HL(0, 0, 16, OL); c.HL(0, 1, 16, J('conc', 6)); c.HL(0, 2, 16, J('conc', 5)); c.HL(0, 3, 16, J('conc', 2))
    if not Wn:
        c.VL(0, 0, 16, OL); c.VL(1, 0, 16, J('conc', 6)); c.VL(2, 0, 16, J('conc', 5)); c.VL(3, 0, 16, J('conc', 2))
    if not E:
        c.VL(15, 0, 16, OL); c.VL(14, 0, 16, J('conc', 3)); c.VL(13, 0, 16, J('conc', 4)); c.VL(12, 0, 16, J('conc', 2))
    if not S:
        c.HL(0, 12, 16, J('conc', 2)); c.HL(0, 13, 16, J('conc', 6)); c.HL(0, 14, 16, J('conc', 5)); c.HL(0, 15, 16, J('conc', 4))
        c.P(7, 14, J('conc', 3)); c.P(7, 15, J('conc', 3))
        if not E:
            for y in range(12, 16): c.P(15, y, OL)
        if not Wn:
            for y in range(12, 16): c.P(0, y, OL)
    # 안쪽 모서리(대각만 물): 이웃 두 칸의 갓돌 테가 만나는 4×4 꺾임
    if N and Wn and not on('NW'):
        c.R(0, 0, 4, 4, J('conc', 5)); c.HL(0, 0, 1, OL); c.P(0, 0, OL); c.P(1, 1, J('conc', 6)); c.P(3, 3, J('conc', 2)); c.HL(0, 3, 3, J('conc', 2)); c.VL(3, 0, 3, J('conc', 2))
    if N and E and not on('NE'):
        c.R(12, 0, 4, 4, J('conc', 4)); c.P(15, 0, OL); c.HL(12, 3, 4, J('conc', 2)); c.VL(12, 0, 4, J('conc', 2)); c.VL(14, 0, 3, J('conc', 3))
    if S and Wn and not on('SW'):
        c.R(0, 12, 4, 4, J('conc', 5)); c.HL(0, 12, 4, J('conc', 2)); c.VL(3, 12, 4, J('conc', 2)); c.HL(0, 13, 3, J('conc', 6)); c.P(0, 15, OL)
    if S and E and not on('SE'):
        c.R(12, 12, 4, 4, J('conc', 5)); c.HL(12, 12, 4, J('conc', 2)); c.VL(12, 12, 4, J('conc', 2)); c.HL(13, 13, 3, J('conc', 6)); c.P(15, 15, OL)
    return c


# ═══════════════════════════ 등대 (3×8 = 48×128) ═══════════════════════════
def _ellipse_y(x, cx, rx, ry, cy, top=False):
    t = (x + 0.5 - cx) / rx
    if abs(t) > 1: return None
    dy = ry * math.sqrt(1 - t * t)
    return cy - dy if top else cy + dy


def lighthouse():
    W, Hh = 48, 128
    c = Cv(W, Hh)
    cx = 24
    # 1. 땅 그림자(오른쪽 아래)
    disc(c, cx + 5, 121.5, 21, J('conc', 1), ry=5.5)
    for k in range(14):
        for j in range(4):
            c.P(cx + 12 + k, 112 + j + k // 3, J('conc', 1))
    # 2. 둥근 돌 기단(윗면 타원 cy=104, 앞면 높이 9)
    rx, ry, top_cy, fh = 21, 6.0, 104.0, 9
    for x in range(cx - rx - 1, cx + rx + 1):
        yt = _ellipse_y(x, cx, rx, ry, top_cy, top=True)
        yb = _ellipse_y(x, cx, rx, ry, top_cy)
        if yt is None: continue
        yt, yb = int(round(yt)), int(round(yb))
        u = (x + 0.5 - (cx - rx)) / (2 * rx)
        for y in range(yb, yb + fh):
            k = y - yb
            lv = 3 if u < 0.3 else 2 if u < 0.7 else 1
            if u > 0.9: lv = 0
            course = k // 3
            joint_h = k % 3 == 2
            sx = int((u * 2 * rx) + course * 3) % 7
            col = J('shrine_flagstone', lv)
            if joint_h or sx == 0: col = J('shrine_flagstone', max(0, lv - 1))
            elif k % 3 == 0 and sx in (1, 2): col = J('shrine_flagstone', min(4, lv + 1))
            if pnoise(x, y, 16, 4, 81) > 0.76: col = J('moss', 2 if lv >= 2 else 1)
            c.P(x, y, col)
        c.P(x, yb + fh, OL)
        for y in range(yt, yb):
            v = (y - yt) / max(1, yb - yt)
            lv = 4 if (u < 0.4 and v < 0.5) else 3
            if v > 0.82: lv = 2
            col = J('shrine_flagstone', lv)
            if (int(x * 0.5 + y) % 9 == 0) and 0.1 < v < 0.8: col = J('shrine_flagstone', lv - 1)
            c.P(x, y, col)
        c.P(x, yt - 1, OL)
    for y in range(int(top_cy), int(top_cy) + fh + 1):
        c.P(cx - rx - 1, y, OL); c.P(cx + rx, y, OL)
    # 3. 앞 계단 3단
    steps = [(cx - 9, 109, 18, 5), (cx - 10, 114, 20, 5), (cx - 11, 119, 22, 6)]
    for sx, sy, sw, sh in steps:
        c.R(sx - 1, sy - 1, sw + 2, sh + 1, OL)
        c.R(sx, sy, sw, 2, J('shrine_flagstone', 4))
        c.HL(sx, sy, sw, J('vending_cool_white', 3))
        c.R(sx, sy + 2, sw, sh - 2, J('shrine_flagstone', 2))
        c.VL(sx, sy + 2, sh - 2, J('shrine_flagstone', 3))
        c.VL(sx + sw - 1, sy, sh, J('shrine_flagstone', 1))
        c.HL(sx, sy + sh - 1, sw, J('shrine_flagstone', 1))
    # 4. 원통 탑신 y 33..104
    top_y, bot_y = 33, 104
    ramp = [J('vending_cool_white', i) for i in range(5)]
    def tower_half(y): return 9.0 + 4.0 * (y - top_y) / (bot_y - top_y)
    for y in range(top_y, bot_y + 2):
        hw = tower_half(y)
        a, b = int(round(cx - hw)), int(round(cx + hw))
        for x in range(a, b):
            u = (x + 0.5 - (cx - hw)) / (2 * hw)
            if u < 0.07: lv = 2
            elif u < 0.17: lv = 3
            elif u < 0.36: lv = 4
            elif u < 0.52: lv = 3
            elif u < 0.68: lv = 2
            elif u < 0.84: lv = 1
            elif u < 0.94: lv = 0
            else: lv = 1
            col = ramp[lv]
            if lv >= 2 and pnoise(x, y, 32, 4, 91) > 0.8: col = ramp[lv - 1]
            c.P(x, y, col)
        c.P(a - 1, y, OL); c.P(b, y, OL)
    for ring_y, thick in ((56, 1), (80, 1), (98, 3)):
        hw = tower_half(ring_y)
        for x in range(int(round(cx - hw)), int(round(cx + hw))):
            u = (x + 0.5 - (cx - hw)) / (2 * hw)
            yy = int(round(_ellipse_y(x, cx, hw, 2.2, ring_y)))
            base_lv = 3 if u < 0.36 else 2 if u < 0.6 else 1 if u < 0.84 else 0
            for k in range(thick):
                lv = max(0, base_lv - 1) if k < thick - 1 or thick == 1 else max(0, base_lv - 2)
                c.P(x, yy + k, J('concrete_grey', lv + 1) if thick == 3 else ramp[max(0, base_lv - 1)])
            if thick == 1:
                c.P(x, yy + 1, ramp[min(4, base_lv + 1)])
    for wy in (43, 66):
        wx = cx - 3
        c.R(wx - 1, wy - 1, 6, 9, OL)
        c.R(wx, wy, 4, 7, J('garasu', 1))
        c.HL(wx, wy, 4, J('garasu', 0))
        c.P(wx, wy + 1, J('garasu', 4)); c.P(wx, wy + 2, J('garasu', 3))
        c.VL(wx + 3, wy + 1, 6, J('garasu', 2))
        c.HL(wx - 1, wy + 8, 6, ramp[4]); c.HL(wx - 1, wy + 9, 6, ramp[1])
        for k in range(10, 16):
            if H(wx, wy + k, 92) > 0.35: c.P(wx + 1, wy + k, ramp[1])
    dx0, dy0, dw, dh = cx - 4, 89, 8, 14
    for y in range(dy0 - 1, dy0 + dh):
        for x in range(dx0 - 1, dx0 + dw + 1):
            r = y - dy0
            if r < 3:
                t = (x + 0.5 - cx) / (dw / 2 + 1)
                if t * t + ((3 - r) / 4.0) ** 2 > 1.0: continue
            c.P(x, y, OL)
    for y in range(dy0, dy0 + dh - 1):
        for x in range(dx0, dx0 + dw):
            r = y - dy0
            if r < 3:
                t = (x + 0.5 - cx) / (dw / 2)
                if t * t + ((3 - r) / 3.5) ** 2 > 1.0: continue
            lv = 2 if x < cx else 1
            col = J('arcade_skylight_slate', lv)
            if x == dx0: col = J('arcade_skylight_slate', 3)
            if (y - dy0) % 4 == 3 and r > 2: col = J('arcade_skylight_slate', lv - 1)
            c.P(x, y, col)
    c.P(cx + 2, dy0 + 8, J('lantern_amber', 4))
    c.HL(dx0 - 1, dy0 + dh - 1, dw + 2, J('shrine_flagstone', 4))
    # 5. 전망 데크(타원 윗면) + 받침 까치발
    gcx, gcy, grx, gry = cx, 30.0, 16, 4.5
    for x in range(cx - grx - 1, cx + grx + 1):
        yt = _ellipse_y(x, gcx, grx, gry, gcy, top=True)
        yb = _ellipse_y(x, gcx, grx, gry, gcy)
        if yt is None: continue
        yt, yb = int(round(yt)), int(round(yb))
        u = (x + 0.5 - (cx - grx)) / (2 * grx)
        for y in range(yt, yb):
            lv = 4 if u < 0.35 else 3 if u < 0.75 else 2
            c.P(x, y, J('concrete_grey', lv))
        c.P(x, yb, J('concrete_grey', 1 if u < 0.7 else 0)); c.P(x, yb + 1, J('concrete_grey', 0)); c.P(x, yb + 2, OL)
        c.P(x, yt - 1, OL)
        if (x - cx) % 4 == 0 and abs(x - cx) < 12:
            c.P(x, yb + 3, OL); c.P(x, yb + 4, OL)
            c.P(x + 1, yb + 3, J('concrete_grey', 1))
    # 6. 뒤 난간
    rail_h = 6
    for x in range(cx - grx + 1, cx + grx - 1):
        yt = _ellipse_y(x, gcx, grx - 1, gry - 1, gcy, top=True)
        if yt is None: continue
        c.P(x, int(round(yt)) - rail_h, J('kawara_dark_tile', 2))
        if (x - cx) % 4 == 2:
            for k in range(1, rail_h): c.P(x, int(round(yt)) - k, J('kawara_dark_tile', 1))
    # 7. 등실
    lx0, lx1, ly0, ly1 = cx - 8, cx + 8, 12, 27
    c.R(lx0 - 1, ly0 - 1, lx1 - lx0 + 2, ly1 - ly0 + 2, OL)
    for y in range(ly0, ly1):
        for x in range(lx0, lx1):
            u = (x - lx0 + 0.5) / (lx1 - lx0)
            if y >= ly1 - 4:
                col = J('kawara_dark_tile', 3 if u < 0.35 else 2 if u < 0.75 else 1)
                if y == ly1 - 4: col = J('kawara_dark_tile', 4)
            else:
                dxl = abs(x + 0.5 - (cx - 1)); dyl = abs(y + 0.5 - 17.5)
                r = math.hypot(dxl * 0.9, dyl * 1.2)
                if r < 2.2: col = J('vending_cool_white', 4)
                elif r < 4.0: col = J('lantern_amber', 4)
                elif r < 6.5: col = J('lantern_amber', 3)
                else: col = J('lantern_amber', 2)
                if u > 0.78: col = J('garasu', 3) if y % 5 else J('garasu', 4)
                elif u < 0.12: col = J('lantern_amber', 3)
            c.P(x, y, col)
    for gx in (lx0 + 3, cx - 1, cx + 3, lx1 - 3):
        c.VL(gx, ly0, ly1 - ly0 - 4, J('kawara_dark_tile', 0))
    c.HL(lx0, ly0 + 7, lx1 - lx0, J('kawara_dark_tile', 1))
    # 8. 앞 난간
    for x in range(cx - grx + 1, cx + grx - 1):
        yb = _ellipse_y(x, gcx, grx - 1, gry - 1, gcy)
        if yb is None: continue
        yr = int(round(yb)) - rail_h - 2
        u = (x + 0.5 - (cx - grx)) / (2 * grx)
        c.P(x, yr - 1, OL)
        c.P(x, yr, J('kawara_dark_tile', 4) if u < 0.45 else J('kawara_dark_tile', 3) if u < 0.8 else J('kawara_dark_tile', 2))
        if (x - cx) % 3 == 0:
            for k in range(1, rail_h + 2): c.P(x, yr + k, J('kawara_dark_tile', 2) if u < 0.6 else J('kawara_dark_tile', 1))
    # 9. 붉은 돔 + 처마 테 + 환기 공
    dcx, dcy, drx, dry = cx, 12.5, 10.5, 10.0
    for y in range(1, 13):
        for x in range(cx - 12, cx + 12):
            t = ((x + 0.5 - dcx) / drx) ** 2 + ((y + 0.5 - dcy) / dry) ** 2
            if t > 1.0: continue
            nx, ny = (x + 0.5 - dcx) / drx, (y + 0.5 - dcy) / dry
            lit = -0.62 * nx - 0.78 * ny
            lv = 4 if lit > 0.55 else 3 if lit > 0.2 else 2 if lit > -0.2 else 1 if lit > -0.55 else 0
            if abs(x + 0.5 - (dcx - 3)) < 0.6 and y > 4: lv = min(4, lv + 1)
            if t > 0.86: lv = max(0, lv - 1)
            c.P(x, y, J('torii_vermilion', lv))
    for x in range(cx - 12, cx + 12):
        yt = None
        for y in range(0, 13):
            t = ((x + 0.5 - dcx) / drx) ** 2 + ((y + 0.5 - dcy) / dry) ** 2
            if t <= 1.0: yt = y; break
        if yt is not None: c.P(x, yt - 1, OL)
    c.HL(cx - 12, 12, 24, OL)
    c.HL(cx - 11, 11, 22, J('torii_vermilion', 1))
    c.P(cx - 11, 11, J('torii_vermilion', 3)); c.P(cx - 10, 11, J('torii_vermilion', 2))
    c.R(cx - 2, 0, 4, 3, OL); c.P(cx - 1, 1, J('kawara_dark_tile', 4)); c.P(cx, 1, J('kawara_dark_tile', 2))
    return c


# ═══════════════════════════ 폭포 (10×6 = 160×96) ═══════════════════════════
def _block_pos(course, x):
    p = -int(H(course, 0, 103) * 12)
    k = 0
    while True:
        w = 7 + int(H(course, k, 104) * 9)
        if p + w > x: return x - p, w
        p += w; k += 1


def waterfall(side=3):
    """10×6 폭포(강 4칸 + 양옆 절벽 3칸). 강 열(3..6)은 떨어지는 물·물보라·바위 말고는 투명 — 지도 바닥의 강이 비친다."""
    W, Hh = 16 * (4 + 2 * side), 96
    X0 = side * 16 - 16
    c = Cv(W, Hh)
    top_lip = lambda x: 26 + int(round(1.5 * math.sin(x / 7.0) + (1 if H(x, 0, 101) > 0.7 else 0)))
    base_y = lambda x: 72 + int(round(1.5 * math.sin(x / 9.0 + 1)))
    def span(x):
        e = min(x, W - 1 - x)
        if e >= 12: return top_lip(x), base_y(x)
        t = (12 - e) / 12.0
        return top_lip(x) + int(round(t * t * 30)), base_y(x) - int(round(t * t * 14))
    t = Cv(W, Hh)
    for x in range(W):
        lip, by = span(x)
        if lip + 3 >= by: continue
        ft = lip + 5
        for y in range(lip, min(ft, by)):
            v = (y - lip) / 5.0
            col = J('moss', 3) if v < 0.35 else J('moss', 2)
            if pnoise(x, y, 16, 2, 102) > 0.66: col = J('moss', 1)
            if y == ft - 1: col = J('shrine_flagstone', 4)
            t.P(x, y, col)
        for y in range(ft, by):
            k = y - ft
            course = k // 8; r = k % 8
            col_in, bwid = _block_pos(course, x)
            lv = 3 if k < 10 else 2 if k < 26 else 1
            if x > X0 + 66: lv = max(0, lv - 1)
            if r == 7 or col_in == bwid - 1: col = J('shrine_flagstone', max(0, lv - 2))
            elif r == 0 or col_in == 0: col = J('shrine_flagstone', min(4, lv + 1))
            elif r == 6 or col_in == bwid - 2: col = J('shrine_flagstone', max(0, lv - 1))
            else:
                col = J('shrine_flagstone', lv)
                if pnoise(x, y, 16, 4, 105) > 0.72: col = J('moss', 2 if lv >= 2 else 1)
            t.P(x, y, col)
    al = t.a[:, :, 3] > 0
    for y in range(Hh):
        for x in range(W):
            if al[y, x]: continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                if 0 <= x + dx < W and 0 <= y + dy < Hh and al[y + dy, x + dx]:
                    t.P(x, y, OL); break
    for x in range(W):
        lip, by = span(x)
        if lip + 3 >= by or X0 + 18 <= x < X0 + 78: continue
        for k in (2, 3):
            if 6 < x < W - 6: t.P(x, by + k, J('moss', 0))
    for y in range(Hh):
        for x in range(W):
            if t.a[y, x, 3]: c.a[y, x] = t.a[y, x]
    fx0, fx1 = X0 + 22, X0 + 74
    for x in range(fx0, fx1):
        lip = top_lip(x)
        for y in range(lip - 2, 78):
            u = (x - fx0) / (fx1 - fx0)
            ph = int(H(x, 0, 111) * 23)
            cyc = (y + ph) % 13
            if y < lip + 1:
                col = J('vending_cool_white', 4) if y == lip - 2 else J('garasu', 5)
            else:
                if cyc < 4: col = J('vending_cool_white', 4 if cyc < 2 else 3)
                elif cyc < 8: col = J('garasu', 5) if u < 0.7 else J('garasu', 4)
                else: col = J('garasu', 3) if u < 0.75 else J('canal_indigo', 3)
                if u > 0.85 and cyc >= 4: col = J('canal_indigo', 2)
            c.P(x, y, col)
        if x in (fx0, fx1 - 1):
            for y in range(lip - 1, 74): c.P(x, y, J('wet_cobble', 1))
    for y in range(top_lip(fx0) - 1, 74): c.P(fx0 - 1, y, OL)
    for y in range(top_lip(fx1) - 1, 74): c.P(fx1, y, OL)
    for x in range(X0 + 14, X0 + 82):
        for y in range(68, 86):
            dx = (x + 0.5 - X0 - 48) / 34.0; dy = (y + 0.5 - 76) / 8.5
            r = dx * dx + dy * dy
            if r > 1.0: continue
            n = pnoise(x, y, 16, 4, 121)
            if r < 0.35 or n > 0.55 - 0.3 * (1 - r):
                col = J('vending_cool_white', 4) if (n > 0.6 and dy < 0.3) else J('vending_cool_white', 3) if r < 0.55 else J('vending_cool_white', 2)
                if dy > 0.55: col = J('garasu', 4) if n > 0.5 else J('garasu', 3)
                c.P(x, y, col)
    for k in range(18):
        x = int(X0 + 10 + H(k, 1, 131) * 76); y = int(60 + H(k, 2, 131) * 12)
        if c.get(x, y) is not None: c.P(x, y, J('vending_cool_white', 4))
    for bx, by, rr in ((X0 + 15, 81, 6), (X0 + 80, 80, 7), (X0 + 25, 88, 4)):
        disc(c, bx, by, rr + 1, OL, ry=rr * 0.7 + 1)
        disc(c, bx, by, rr, J('shrine_flagstone', 2), ry=rr * 0.7)
        disc(c, bx - 1, by - 1, rr * 0.6, J('shrine_flagstone', 4), ry=rr * 0.35)
        c.HL(int(bx - rr + 1), int(by + rr * 0.7), int(rr * 2 - 1), J('canal_indigo', 0))
    return c
