"""modern_city 실내 — 앉는 기물 3/4·품질 다시 그림 (2026-10-20, interior-seats-34).

기존 디자인(색 계열·재질·칸 크기·방향 세트)을 그대로 두고 틀린 곳을 고친다:
  · 큰 부분마다 윗면: 등받이 윗테(뒤 모서리 → 밝은 판 → 앞 모서리 빛 1행, 그 밑 그늘 1행) · 팔걸이 윗면 · 앉는 판 윗면 4~6행.
  · 앞면(남쪽) 3행 이상 — 판 앞치마 · 쿠션 앞면 · 다리.
  · 동·서향 = L자 옆모습 + 판 윗면 4행 이상 + 윗면이 보이는 등받이 기둥(판에 붙어 있음). W 는 E 를 정확히 뒤집는다.
  · 북향 = 등받이 뒷면 + 윗테 4행, 판은 구멍·양옆으로 비친다.
  · 윤곽은 바깥 실루엣에만, 그 재질의 가장 어두운 단(근흑 상자 테 금지). 부품 사이 구멍에는 테를 두르지 않는다. 바닥 접지선만 ink.
  · 재질마다 5~7단 + 결·누빔·얼룩 점(넓은 단색 금지).
mci-* 가구는 mpx.RAMPS(잠금 팔레트) 그대로, r10/r11 가구(영화관·강당·휠체어·노래방·판사석·목욕 의자)는 시트에 있던 색 계열에
같은 색상의 단을 더한 램프(R10_RAMPS)를 쓴다.

DRAW = id → 그림 함수(w, h) → RGBA. 캔버스 = 사양 칸 범위(가로 칸 수×16, 세로 = 위로 솟는 줄 + 발밑 줄).
PENDING = 관문이 사람 승인 전까지 자동 통과를 주지 않는 방향(E/W/N) — 그려 두되 굽기에서 뺀다(rebake_seats34.py).
등록 조각(pieces.R: mci-armchair · mci-chair-wood-s)은 예전 그림 그대로 둔다(bake_interior 는 4096px assert 로 막혀 있어
제자리 굽기만 쓴다 — rebake_wood_seat.py 와 같은 길). r10 목욕 의자는 r10/home.py bath_stool 이 이 그림을 돌려준다(rebake_inplace 가 되돌리지 않게).
"""
import numpy as np
from mpx import RAMPS as MPX_RAMPS, h32


def _hex(h): return (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16))


# r10/r11 가구 램프(어두운 → 밝은). 시트에 있던 색을 그대로 품고 같은 색상의 단을 더했다.
R10_RAMPS = {
    'velvet': ['#3a1418', '#62141e', '#801828', '#a82030', '#be3240', '#d74b59', '#e8737e'],
    'goldw':  ['#4a3010', '#7a5418', '#a87828', '#c8962e', '#d8b048', '#ecd07a'],
    'metal':  ['#24222c', '#3a3844', '#4a4a54', '#6a6a74', '#8a8e98', '#a0a6b2', '#ccd0d8'],
    'tire':   ['#16141c', '#24222c', '#3a3844'],
    'bluef':  ['#0e1c3c', '#142a54', '#1c3c74', '#285096', '#3c6cb4', '#5a88cc', '#7aa2dc'],
    'purple': ['#2a0c32', '#3c1446', '#5a1e6e', '#6e2882', '#78288c', '#963caa', '#b05cc4', '#c878dc'],
    'brown':  ['#2a1608', '#3e2414', '#5a3822', '#644028', '#825432', '#8c6040', '#aa7850', '#c09068'],
    'leather': ['#140e10', '#1e1618', '#281e1e', '#3a2c2c', '#4e3c3a', '#66504c', '#7e6660'],
    'gold':   ['#5a3c10', '#7a5418', '#a87828', '#c8962e', '#e2b448', '#f0d278', '#fae8a8'],
    'yellow': ['#6a5420', '#8a6c28', '#a88838', '#d2aa46', '#f0c846', '#fae678', '#ffeb86'],
    'gnd':    ['#0b1224'],
    'nol':    ['#091125', '#0b1224'],                                   # 4차(2026-10-20): mci 공통 남색 바깥 윤곽(위·옆 1 · 접지 0)
    'cyan':   ['#1c4a50', '#307078', '#3c8c96', '#60bebe', '#78d2ce', '#90fcf7'],
    'paper':  ['#a0a6b2', '#ccd0d8', '#f4f6f8'],
    'lamp':   ['#c89a2b', '#f0c838', '#fae678'],
    'water':  ['#6e94b0', '#b8d6e8'],
    'redl':   ['#4a1014', '#6e1820', '#96222c', '#b42e36', '#cc343c', '#e0545a', '#ee6c6c'],
    'zpurple': ['#3e2c58', '#56407a', '#785aa0', '#8a6ab2', '#9678be', '#b49ad4'],
    'zteal':  ['#22464e', '#2e5c66', '#3c6e78', '#4c7e88', '#5a8c96', '#78aab2'],
    'tray':   ['#4a3010', '#6e4c20', '#966c34', '#b48a4c', '#cca468'],
    'tea':    ['#3e6e36', '#78b46e', '#e8c45c'],
}


class RC:
    """램프 캔버스: 화소마다 (재질, 단). 단 0 = 가장 어두움."""
    def __init__(s, w, h, ramps, outline_of=None, ground=('gnd', 0)):
        s.w, s.h, s.ramps = w, h, ramps
        s.mats = list(ramps); s.mi = {m: i for i, m in enumerate(s.mats)}
        s.m = np.full((h, w), -1, np.int16); s.t = np.zeros((h, w), np.int16)
        s.outline_of = {} if outline_of is None else outline_of; s.ground = ground

    def P(s, x, y, mat, t=None):
        x, y = int(x), int(y)
        if not (0 <= x < s.w and 0 <= y < s.h): return
        if mat is None: s.m[y, x] = -1; return
        n = len(s.ramps[mat]); t = n - 1 if t is None else max(0, min(n - 1, int(t)))
        s.m[y, x] = s.mi[mat]; s.t[y, x] = t

    def R(s, x, y, w, h, mat, t=None):
        for j in range(int(h)):
            for i in range(int(w)): s.P(x + i, y + j, mat, t)

    def HL(s, x, y, w, mat, t=None): s.R(x, y, w, 1, mat, t)
    def VL(s, x, y, h, mat, t=None): s.R(x, y, 1, h, mat, t)

    def get(s, x, y):
        if 0 <= x < s.w and 0 <= y < s.h and s.m[y, x] >= 0: return s.mats[s.m[y, x]], int(s.t[y, x])
        return None

    def speck(s, x, y, w, h, mat, base, seed=1, dens=0.16, lo=1, hi=1):
        """질감 점: 칠해진 base 단 화소 중 일부를 한 단 어둡게(lo)/밝게(hi). 가로로 이어지는 짝 점이 많아 결처럼 읽힌다."""
        for j in range(h):
            for i in range(w):
                g = s.get(x + i, y + j)
                if g != (mat, base): continue
                r = h32(x + i, y + j, seed) / 4294967296.0
                if r < dens:
                    s.P(x + i, y + j, mat, base - lo)
                    if r < dens / 2 and s.get(x + i + 1, y + j) == (mat, base): s.P(x + i + 1, y + j, mat, base - lo)
                elif r > 1 - dens / 3 and hi: s.P(x + i, y + j, mat, base + hi)

    def ink(s):
        """바깥 실루엣만: 투명 칸 중 칠해진 칸에 닿는 곳 → 닿은 재질의 가장 어두운 단(바로 위가 칠해졌으면 바닥 접지선)."""
        m = s.m >= 0; h, w = m.shape
        out = np.zeros_like(m); st = [(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)]
        while st:
            x, y = st.pop()
            if 0 <= x < w and 0 <= y < h and not m[y, x] and not out[y, x]:
                out[y, x] = True; st += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
        e = []; foot = int(np.nonzero(m.any(1))[0].max()) + 1 if m.any() else h
        for y in range(h):
            for x in range(w):
                if not out[y, x]: continue
                if y > 0 and m[y - 1, x]:
                    if y >= foot - 1: e.append((x, y, s.ground)); continue
                    mat = s.mats[s.m[y - 1, x]]; e.append((x, y, s.outline_of.get(mat, (mat, 0)))); continue
                for nx, ny in ((x, y + 1), (x - 1, y), (x + 1, y)):
                    if 0 <= nx < w and 0 <= ny < h and m[ny, nx]:
                        mat = s.mats[s.m[ny, nx]]; e.append((x, y, s.outline_of.get(mat, (mat, 0)))); break
        for x, y, (mt, t) in e: s.P(x, y, mt, t)

    def paste_flip(s, o):
        s.m = o.m[:, ::-1].copy(); s.t = o.t[:, ::-1].copy()

    def rgba(s):
        a = np.zeros((s.h, s.w, 4), np.uint8)
        rgb = [[_hex(c) for c in s.ramps[m]] for m in s.mats]
        for y in range(s.h):
            for x in range(s.w):
                i = s.m[y, x]
                if i >= 0: a[y, x, :3] = rgb[i][s.t[y, x]]; a[y, x, 3] = 255
        return a


def r10(w, h): return RC(w, h, R10_RAMPS)
def mc(w, h): return RC(w, h, MPX_RAMPS, outline_of={'amber': ('wood', 0), 'dark': ('ink', 2), 'white': ('grey', 0)}, ground=('ink', 0))


class _Navy(dict):
    def get(s, k, d=None): return ('ink', 1)


def mcn(w, h):
    """mci 가구 공통 윤곽(남색 ink 1, 기준 mci-sofa · mci-wait-bench · lounge-sofa-cream) — 바깥 실루엣만."""
    return RC(w, h, MPX_RAMPS, outline_of=_Navy(), ground=('ink', 0))


def top_band(c, x, y, w, rows, mat, back, mid, edge, seed=0, speck=True):
    """윗면 띠: 뒤 모서리 1행(back) + 가운데(mid, 질감 점) + 앞 모서리 빛 1행(edge)."""
    c.HL(x, y, w, mat, back); c.R(x, y + 1, w, rows - 2, mat, mid); c.HL(x, y + rows - 1, w, mat, edge)
    if speck and rows > 2: c.speck(x, y + 1, w, rows - 2, mat, mid, seed)


# ═══════════════════════ 영화관 3연석 (뒤에서 본 붉은 의자 셋, 48×16) ═══════════════════════
def cinema_seat_row():
    """뒷모습(스크린 쪽 = 북을 본다): 둥근 등받이 윗테 4행(뒤 모서리 · 밝은 벨벳 · 앞 모서리 빛) + 그늘 1행 + 뒷면(금 좌석 번호판) ·
    등받이 양옆으로 비치는 앉는 판 · 공용 팔걸이(쇠, 윗면 3행) · 쇠 다리."""
    c = r10(48, 16); V = 'velvet'
    for x0 in (4, 18, 32):
        c.R(x0, 8, 12, 4, V, 2); c.HL(x0, 8, 12, V, 4); c.HL(x0, 9, 12, V, 3)                       # 앉는 판(양옆)
        top_band(c, x0 + 1, 1, 10, 4, V, 3, 5, 6, speck=False)
        c.P(x0 + 1, 1, None); c.P(x0 + 10, 1, None)
        c.HL(x0 + 1, 5, 10, V, 1)                                                                  # 윗테 밑 그늘
        c.R(x0 + 1, 6, 10, 5, V, 3); c.VL(x0 + 1, 6, 5, V, 4); c.VL(x0 + 10, 6, 5, V, 2)
        c.HL(x0 + 2, 6, 8, V, 4)
        c.HL(x0 + 4, 7, 4, 'goldw', 5); c.HL(x0 + 4, 8, 4, 'goldw', 3)                              # 금 번호판
        c.HL(x0 + 1, 10, 10, V, 2)
        for lx in (x0 + 2, x0 + 9): c.VL(lx, 12, 2, 'metal', 3)
    for x0 in (2, 16, 30, 44):                                                                       # 공용 팔걸이
        c.HL(x0, 5, 2, 'metal', 4); c.HL(x0, 6, 2, 'metal', 6); c.HL(x0, 7, 2, 'metal', 5)
        c.R(x0, 8, 2, 5, 'metal', 3); c.VL(x0 + 1, 8, 5, 'metal', 2); c.VL(x0, 13, 1, 'metal', 2)
    c.ink()
    return c.rgba()


# ═══════════════════════ 강당 객석 3연석 (관객 쪽을 보는 접이식 의자, 48×32) ═══════════════════════
def aud_seat_row():
    """남향 3연석: 등받이 윗테 4행 + 그늘 · 벨벳 앞면(누빔 단추 · 왼쪽 빛 오른쪽 그늘) · 앉는 판 윗면 5행 + 앞면 3행 ·
    좌석 사이 공용 금빛 나무 팔걸이(윗면 4행 · 앞면) · 쇠 받침 다리."""
    c = r10(48, 32); V = 'velvet'
    for x0 in (4, 18, 32):
        top_band(c, x0, 4, 12, 4, V, 3, 5, 6, speck=False)
        c.P(x0, 4, None); c.P(x0 + 11, 4, None)
        c.HL(x0, 8, 12, V, 2)
        c.R(x0, 9, 12, 8, V, 4); c.VL(x0, 9, 8, V, 5); c.VL(x0 + 11, 9, 8, V, 2); c.VL(x0 + 10, 9, 8, V, 3)
        c.HL(x0 + 1, 9, 10, V, 5); c.HL(x0 + 1, 15, 10, V, 3)
        for yy in (11, 14):
            for xx in (x0 + 3, x0 + 8): c.P(xx, yy, V, 2); c.P(xx, yy - 1, V, 5)
        c.HL(x0, 16, 12, V, 2)
        top_band(c, x0, 17, 12, 5, V, 3, 5, 6, speck=False); c.HL(x0 + 1, 18, 10, V, 4)            # 앉는 판 윗면
        c.HL(x0, 22, 12, V, 3); c.HL(x0, 23, 12, V, 2); c.HL(x0, 24, 12, V, 1)                      # 앞면
        for lx in (x0 + 2, x0 + 8): c.VL(lx, 25, 4, 'metal', 4); c.VL(lx + 1, 25, 4, 'metal', 2)
    for x0 in (2, 16, 30, 44):                                                                       # 팔걸이
        top_band(c, x0, 12, 2, 4, 'goldw', 3, 4, 5, speck=False)
        c.R(x0, 16, 2, 9, 'goldw', 2); c.VL(x0 + 1, 16, 9, 'goldw', 1); c.HL(x0, 24, 2, 'goldw', 1)
        c.VL(x0, 25, 4, 'metal', 3); c.VL(x0 + 1, 25, 4, 'metal', 1)
    c.ink()
    return c.rgba()


# ═══════════════════════ 휠체어 (남향, 16×32) ═══════════════════════
def hospital_wheelchair():
    """남향: 밀손잡이 · 등받이 윗테(4행) + 남색 천 앞면 · 앉는 판 윗면 5행 + 앞면 3행 · 양옆 큰 바퀴(타이어 · 밝은 쇠 테 · 축) ·
    앞 기둥 · 발판(윗면) · 앞바퀴."""
    c = r10(16, 32); B = 'bluef'
    for x, t in ((4, 5), (11, 3)): c.VL(x, 4, 10, 'metal', t)                                       # 밀손잡이 기둥
    c.HL(3, 3, 2, 'tire', 2); c.HL(11, 3, 2, 'tire', 2)                                              # 손잡이 고무
    top_band(c, 5, 5, 6, 4, B, 3, 5, 6, speck=False)                                                      # 등받이 윗테
    c.HL(5, 9, 6, B, 1)
    c.R(5, 10, 6, 4, B, 3); c.VL(5, 10, 4, B, 4); c.VL(10, 10, 4, B, 2); c.HL(6, 12, 4, B, 2)
    for xs, rim in ((1, 6), (12, 4)):                                                                # 큰 바퀴
        c.VL(xs, 9, 17, 'tire', 1 if xs == 1 else 2); c.VL(xs + 1, 9, 17, 'metal', rim); c.VL(xs + 2, 9, 17, 'tire', 2 if xs == 1 else 1)
        for x in (xs, xs + 2): c.P(x, 9, None); c.P(x, 25, None)
        c.P(xs + 1, 9, 'metal', rim - 1); c.P(xs + 1, 25, 'metal', rim - 2)
        c.VL(xs + 1, 16, 2, 'metal', 3)
    top_band(c, 4, 14, 8, 5, B, 2, 5, 6, speck=False); c.HL(5, 15, 6, B, 4)                                                    # 앉는 판 윗면
    c.HL(4, 19, 8, B, 3); c.HL(4, 20, 8, B, 2); c.HL(4, 21, 8, B, 1)                                  # 앞면
    for x in (5, 10): c.VL(x, 22, 3, 'metal', 3)
    for x0 in (4, 9):                                                                                 # 발판
        c.HL(x0, 24, 3, 'metal', 6); c.HL(x0, 25, 3, 'metal', 4); c.HL(x0, 26, 3, 'metal', 2)
    for x in (5, 10): c.VL(x, 27, 2, 'tire', 2)
    c.ink()
    return c.rgba()


# ═══════════════════════ 노래방 코너 소파 (ㄱ자, 보라) ═══════════════════════
def karaoke_sofa():
    """칸 (0..2,-1)(0..2,0)(0,1): 북쪽 긴 날개 + 서쪽 날개(아래로 16행 더).
    등받이 윗테 4행(가장 밝게) + 그늘 · 등 쿠션 앞면(누빔 단추 · 위가 밝다) · 앉는 판 윗면(쿠션 골 · 앞 모서리 빛) · 남쪽 앞면 4행 ·
    동쪽 팔걸이(윗면 · 앞면) · 서쪽 날개 남쪽 끝 앞면."""
    c = r10(48, 48); P_ = 'purple'
    top_band(c, 1, 2, 42, 4, P_, 4, 6, 7, speck=False)                                              # 북쪽 등받이 윗테
    c.HL(5, 6, 38, P_, 2)
    c.R(5, 7, 38, 5, P_, 4); c.HL(5, 7, 38, P_, 5); c.HL(5, 11, 38, P_, 3)                           # 등 쿠션 앞면
    for x in (16, 30): c.VL(x, 7, 5, P_, 2); c.VL(x + 1, 7, 5, P_, 5)
    for x in range(10, 42, 7): c.P(x, 9, P_, 2); c.P(x, 8, P_, 6)                                   # 누빔 단추
    c.R(1, 6, 4, 36, P_, 6); c.VL(1, 6, 36, P_, 4); c.VL(4, 6, 36, P_, 7)                           # 서쪽 등받이(윗면 = 세로 띠)
    c.VL(5, 7, 35, P_, 2)
    c.R(6, 12, 37, 8, P_, 5); c.R(6, 12, 9, 30, P_, 5)                                                # 앉는 판(한 판)
    c.HL(6, 12, 37, P_, 3); c.HL(6, 13, 37, P_, 4)
    for x in (16, 30): c.VL(x, 13, 7, P_, 3); c.VL(x + 1, 13, 7, P_, 6)
    for y in (24, 33): c.HL(6, y, 9, P_, 3); c.HL(6, y + 1, 9, P_, 6)
    c.HL(15, 19, 28, P_, 7); c.HL(6, 41, 9, P_, 7)                                                    # 판 앞 모서리 빛
    top_band(c, 43, 2, 4, 12, P_, 4, 6, 7, speck=False)                                               # 동쪽 팔걸이 윗면
    c.R(43, 14, 4, 6, P_, 4); c.VL(43, 14, 6, P_, 5); c.VL(42, 14, 6, P_, 2)
    for i, t in enumerate((4, 3, 2, 1)): c.HL(15, 20 + i, 32, P_, t)                                 # 남쪽 앞면
    c.VL(15, 20, 4, P_, 2)
    for i, t in enumerate((4, 3, 2, 1)): c.HL(1, 42 + i, 14, P_, t)                                  # 서쪽 날개 남쪽 끝 앞면
    c.VL(4, 42, 4, P_, 2)
    c.ink()
    return c.rgba()


# ═══════════════════════ 판사석 단상 (80×48) ═══════════════════════
COURT_MAP = {'b': ('leather', 2), 'c': ('brown', 6), 'd': ('gold', 4), 'e': ('brown', 4), 'f': ('brown', 0), 'g': ('brown', 2),
             'h': ('brown', 5), 'i': ('brown', 3), 'j': ('gold', 5), 'k': ('gold', 2)}
COURT_BASE = """
................................................................................
............aaaaaaaaaa..............aaaaaaaaaa..............aaaaaaaaaa..........
............abbbbbbbba..............abbbbbbbba..............abbbbbbbba..........
............abbbbbbbba..............abbbbbbbba..............abbbbbbbba..........
............abbbbbbbba..............abbbbbbbba..............abbbbbbbba..........
............abbbbbbbba..............abbbbbbbba..............abbbbbbbba..........
............abbbbbbbba..............abbbbbbbba..............abbbbbbbba..........
............abbbbbbbba..............abbbbbbbba..............abbbbbbbba..........
............abbbbbbbba..............abbbbbbbba..............abbbbbbbba..........
............abbbbbbbba..............abbbbbbbba..............abbbbbbbba..........
............abbbbbbbba..............abbbbbbbba..............abbbbbbbba..........
............abbbbbbbba..............abbbbbbbba..............abbbbbbbba..........
.aaaaaaaaaaaccccdcccccaaaaaaaaaaaaaaccccccccccaaaaaaaaaaaaaaccccccccccaaaaaaaaa.
.aeeeeeeeeeeeebbbbbeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeea.
.aeeeeeeeeeeeebbbbbeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeea.
.aeeeeeeeeeeeebbbbbeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeea.
.aeeeeeeeeeeeebbbbbeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeea.
.aeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeea.
.affffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffa.
.agggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggga.
.agggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggga.
.agggggggggggggggggggggggggggggggggggddddddggggggggggggggggggggggggggggggggggga.
.aggghhhhhhhhhggghhhhhhhhhggghhhhhhhddddddddhhhhhhggghhhhhhhhhggghhhhhhhhhggghha
.agggiiiiiiiiigggiiiiiiiiigggiiiiiddddddddddddiiiigggiiiiiiiiigggiiiiiiiiigggiia
.agggiiiiiiiiigggiiiiiiiiigggiiiiiddddjjjjddddiiiigggiiiiiiiiigggiiiiiiiiigggiia
.agggiiiiiiiiigggiiiiiiiiigggiiiiddddjjjjjjddddiiigggiiiiiiiiigggiiiiiiiiigggiia
.agggiiiiiiiiigggiiiiiiiiigggiiiddddjjjkkjjjddddiigggiiiiiiiiigggiiiiiiiiigggiia
.agggiiiiiiiiigggiiiiiiiiigggiiidddjjjjkkjjjjdddiigggiiiiiiiiigggiiiiiiiiigggiia
.agggiiiiiiiiigggiiiiiiiiigggiiidddjjjjkkjjjjdddiigggiiiiiiiiigggiiiiiiiiigggiia
.agggiiiiiiiiigggiiiiiiiiigggiiidddjjjjkkjjjjdddiigggiiiiiiiiigggiiiiiiiiigggiia
.agggiiiiiiiiigggiiiiiiiiigggiiidddjjjjkkjjjjdddiigggiiiiiiiiigggiiiiiiiiigggiia
.agggiiiiiiiiigggiiiiiiiiigggiiiddddjjjkkjjjddddiigggiiiiiiiiigggiiiiiiiiigggiia
.agggiiiiiiiiigggiiiiiiiiigggiiiiddddjjjjjjddddiiigggiiiiiiiiigggiiiiiiiiigggiia
.agggiiiiiiiiigggiiiiiiiiigggiiiiiddddjjjjddddiiiigggiiiiiiiiigggiiiiiiiiigggiia
.agggiiiiiiiiigggiiiiiiiiigggiiiiiddddddddddddiiiigggiiiiiiiiigggiiiiiiiiigggiia
.agggiiiiiiiiigggiiiiiiiiigggiiiiiiiddddddddiiiiiigggiiiiiiiiigggiiiiiiiiigggiia
.agggiiiiiiiiigggiiiiiiiiigggiiiiiiiiddddddiiiiiiigggiiiiiiiiigggiiiiiiiiigggiia
.agggiiiiiiiiigggiiiiiiiiigggiiiiiiiiigggiiiiiiiiigggiiiiiiiiigggiiiiiiiiigggiia
.agggiiiiiiiiigggiiiiiiiiigggiiiiiiiiigggiiiiiiiiigggiiiiiiiiigggiiiiiiiiigggiia
.agggiiiiiiiiigggiiiiiiiiigggiiiiiiiiigggiiiiiiiiigggiiiiiiiiigggiiiiiiiiigggiia
.agggiiiiiiiiigggiiiiiiiiigggiiiiiiiiigggiiiiiiiiigggiiiiiiiiigggiiiiiiiiigggiia
.agggiiiiiiiiigggiiiiiiiiigggiiiiiiiiigggiiiiiiiiigggiiiiiiiiigggiiiiiiiiigggiia
.agggiiiiiiiiigggiiiiiiiiigggiiiiiiiiigggiiiiiiiiigggiiiiiiiiigggiiiiiiiiigggiia
.agggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggga.
.agggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggga.
.agggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggga.
.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.
................................................................................
"""


def court_judge_bench():
    """예전 그림(문장 패널 · 금 문장 · 나무 단상) 위에서 고친다:
      · 의자 셋: 검은 판 → 높은 가죽 등받이(둥근 윗테 4행 + 그늘 · 누빔 단추 · 왼쪽 빛 · 오른쪽 그늘).
      · 책상 윗면 5행 → 7행 + 앞 모서리 빛 + 그늘(뒤 모서리 · 결). 문장은 한 행 아래로. 패널 결.
      · 오른쪽 끝 패널이 윤곽 밖으로 삐져나온 열 정리 · 윤곽을 근흑 → 짙은 나무색."""
    rows = COURT_BASE.strip('\n').split('\n')
    c = r10(80, 48)
    base = {}
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch in COURT_MAP: c.P(x, y, *COURT_MAP[ch]); base[(x, y)] = COURT_MAP[ch]
    c.R(0, 0, 80, 13, None)                                                                          # 의자 · 위 테는 새로 그린다
    for y in range(13, 48): c.P(79, y, None); c.P(0, y, None)
    c.HL(1, 46, 78, None); c.HL(1, 47, 78, None)
    for y in range(12, 46): c.P(78, y, 'brown', 2)                                                   # 오른쪽 끝 패널 테 정리
    # 문장(행 21..36)을 한 행 아래로
    gold = {k: v for k, v in base.items() if v[0] == 'gold' and k[1] >= 20}
    for (x, y) in gold: c.P(x, y, *base.get((x, 40), ('brown', 3)))
    for (x, y), v in gold.items(): c.P(x, y + 1, *v)
    # 패널 결: 문틀(brown 2) · 판(brown 3) 에 세로로 끊긴 짙은 결
    for y in range(24, 43):
        for x in range(1, 78):
            g = c.get(x, y)
            if g == ('brown', 3) and (x * 3) % 7 == 0 and (y + x) % 9 < 5: c.P(x, y, 'brown', 2)
    # 책상 윗면 12..20 + 그늘 21
    c.HL(1, 12, 78, 'brown', 3)
    c.R(1, 13, 78, 7, 'brown', 4)
    for y in (14, 16, 18):
        for x0 in range((y * 7) % 11, 78, 13):
            for i in range(4 + (x0 + y) % 3):
                if 1 <= x0 + i < 78: c.P(x0 + i, y, 'brown', 3)
    c.HL(1, 13, 78, 'brown', 5)
    c.HL(1, 19, 78, 'brown', 6); c.HL(1, 20, 78, 'brown', 5); c.HL(1, 21, 78, 'brown', 1)
    # 명패 · 의사봉
    c.HL(14, 14, 6, 'leather', 5); c.R(14, 15, 6, 3, 'leather', 2); c.HL(15, 16, 4, 'gold', 4)
    c.HL(23, 15, 3, 'brown', 6); c.HL(23, 16, 3, 'brown', 2); c.P(24, 14, 'brown', 5)
    # 의자 셋
    L = 'leather'
    for x0 in (13, 37, 61):
        top_band(c, x0, 1, 8, 4, L, 3, 5, 6, speck=False)
        c.P(x0, 1, None); c.P(x0 + 7, 1, None); c.HL(x0 + 2, 2, 3, L, 6)
        c.HL(x0, 5, 8, L, 1)
        c.R(x0, 6, 8, 6, L, 3); c.VL(x0, 6, 6, L, 4); c.VL(x0 + 7, 6, 6, L, 2)
        for yy in (8, 10):
            for xx in (x0 + 2, x0 + 5): c.P(xx, yy, L, 1); c.P(xx, yy - 1, L, 5)
    c.ink()
    return c.rgba()


# ═══════════════════════ 목욕 의자·바가지 (16×16) ═══════════════════════
def home_bath_stool():
    """노란 플라스틱 목욕 의자(윗면 4행 + 손잡이 홈 · 앞면 · 아치 다리) + 둥근 바가지(아가리 5행: 밝은 뒤 테 · 안쪽 그늘 · 앞 테 빛 · 몸통)."""
    c = r10(16, 16); Y = 'yellow'
    top_band(c, 1, 5, 7, 4, Y, 3, 5, 6, speck=False)
    c.HL(3, 6, 3, Y, 2); c.HL(3, 7, 3, Y, 4)                                                          # 손잡이 홈
    c.R(1, 9, 7, 4, Y, 3); c.VL(1, 9, 4, Y, 4); c.VL(7, 9, 4, Y, 2); c.HL(1, 12, 7, Y, 2)
    c.R(3, 11, 3, 2, None)                                                                            # 아치 다리
    # 바가지: 아가리(뒤 테 빛 · 안쪽 그늘 · 앞 테 빛) + 몸통(왼쪽 빛)
    c.HL(10, 3, 4, Y, 6)
    c.R(9, 4, 6, 2, Y, 1); c.VL(9, 4, 2, Y, 5); c.VL(14, 4, 2, Y, 4); c.HL(10, 5, 4, Y, 2)
    c.HL(9, 6, 6, Y, 6)
    c.R(9, 7, 6, 4, Y, 4); c.VL(9, 7, 4, Y, 5); c.VL(14, 7, 4, Y, 2); c.HL(10, 11, 4, Y, 2)
    c.ink()
    return c.rgba()


# ═══════════════════════ mci-* 공용: 좌우 거울(빛은 늘 왼쪽 위) ═══════════════════════
class Side:
    """동향(e) 좌표로 그리면 서향(w)은 위치만 좌우로 뒤집는다. 세로 기둥·면의 빛 열은 늘 왼쪽(빛 = 왼쪽 위)."""
    def __init__(s, c, f): s.c, s.f, s.W = c, f, c.w
    def X(s, x, w=1): return x if s.f == 'e' else s.W - x - w
    def R(s, x, y, w, h, mat, t): s.c.R(s.X(x, w), y, w, h, mat, t)
    def HL(s, x, y, w, mat, t): s.c.HL(s.X(x, w), y, w, mat, t)
    def top(s, x, y, w, rows, mat, back, mid, edge): top_band(s.c, s.X(x, w), y, w, rows, mat, back, mid, edge, speck=False)
    def post(s, x, y, w, h, mat, tones):
        """세로 기둥(폭 w): tones = 왼쪽 → 오른쪽 단(밝음 → 그늘)."""
        x0 = s.X(x, w)
        for i in range(w): s.c.VL(x0 + i, y, h, mat, tones[i])
    def face(s, x, y, w, rows, mat, tones, lit=None, dark=None):
        """앞(남)면 띠: 행마다 tones, 왼쪽 끝 열 lit · 오른쪽 끝 열 dark(빛 = 왼쪽)."""
        x0 = s.X(x, w)
        for i, t in enumerate(tones): s.c.HL(x0, y + i, w, mat, t)
        if lit is not None: s.c.VL(x0, y, len(tones), mat, lit)
        if dark is not None: s.c.VL(x0 + w - 1, y, len(tones), mat, dark)


def grain(c, x, y, w, h, mat, t, seed=0):
    """나무 결: 두 행에 한 번, 가로로 3~5화소 이어지는 한 단 어두운 결(점 하나짜리 잡티 없음)."""
    for j in range(0, h, 2):
        st = (j * 7 + seed * 5) % max(1, w - 5); ln = 3 + (j + seed) % 3
        for i in range(ln):
            if c.get(x + st + i, y + j) == (mat, t): c.P(x + st + i, y + j, mat, t - 1)


# ═══════════════════════ 나무 의자 네 방향 (틀·판 wood 1~5, 윤곽 wood 0) ═══════════════════════
# 높이 공통: 접지 29, 다리 25..28, 판 앞면 22..24, 판 윗면 16..21 — 북향은 남쪽 등받이가 판을 가리고 구멍·양옆으로 비친다.
W_ = 'wood'


def _seat_wood(c, x, w, seed):
    top_band(c, x, 16, w, 6, W_, 2, 4, 5, speck=False); grain(c, x + 1, 17, w - 2, 4, W_, 4, seed)


def chair_wood_s(c):
    top_band(c, 3, 4, 10, 4, W_, 2, 4, 5, speck=False); grain(c, 4, 5, 8, 2, W_, 4, 1)              # 위 가로대 윗면
    c.HL(3, 8, 10, W_, 3); c.HL(3, 9, 10, W_, 2)                                                       # 가로대 앞면
    for x in (3, 11): c.VL(x, 10, 6, W_, 3); c.VL(x + 1, 10, 6, W_, 1)                               # 기둥
    c.HL(5, 12, 6, W_, 4); c.HL(5, 13, 6, W_, 2)                                                       # 가운데 살
    _seat_wood(c, 2, 12, 3)
    c.HL(2, 22, 12, W_, 3); c.HL(2, 23, 12, W_, 2); c.HL(2, 24, 12, W_, 1); c.VL(2, 22, 3, W_, 3); c.VL(13, 22, 3, W_, 1)
    for x in (2, 12): c.VL(x, 25, 4, W_, 3); c.VL(x + 1, 25, 4, W_, 1)
    c.ink()


def chair_wood_n(c):
    """북향(뒷모습): 사다리 등받이를 뒤에서 — 위 가로대(윗면 2행 밝게 + 뒷면) · 기둥 둘(다리까지) · 살 하나 · 살 아래로 판 윗면이 비친다 · 판 남쪽 모서리."""
    c.R(3, 17, 10, 5, W_, 4); c.HL(3, 21, 10, W_, 3); grain(c, 5, 18, 6, 3, W_, 4, 5)               # 판(기둥 사이로 비침)
    c.HL(3, 10, 10, W_, 5); c.HL(3, 11, 10, W_, 4); c.HL(3, 12, 10, W_, 3); c.HL(3, 13, 10, W_, 2)    # 위 가로대: 윗테 2행 + 뒷면
    for x in (3, 11): c.VL(x, 14, 15, W_, 3); c.VL(x + 1, 14, 15, W_, 1)                             # 기둥 = 뒷다리
    c.HL(5, 15, 6, W_, 4); c.HL(5, 16, 6, W_, 2)                                                       # 살
    c.HL(5, 22, 6, W_, 3); c.HL(5, 23, 6, W_, 2); c.HL(5, 24, 6, W_, 1)                                # 판 남쪽 모서리
    c.ink()


def _chair_wood_side(c, f):
    """옆모습: 등받이 기둥 3px(윗면 2행 · 왼쪽 열 밝게, 뒷다리까지) · 판과의 사이 짙은 윤곽 열 · 판 윗면(뒤 모서리 + 밝은 2행 + 앞 모서리 빛) ·
    옆 가로대 2행 · 판 밑은 비어 있고 2px 앞다리."""
    s = Side(c, f)
    s.HL(3, 4, 3, W_, 5); s.HL(3, 5, 3, W_, 4)
    s.post(3, 6, 3, 23, W_, (4, 3, 2))
    s.post(6, 16, 1, 6, W_, (1,))                                                                      # 등받이 · 판 사이 윤곽
    s.HL(7, 16, 7, W_, 3); s.HL(7, 17, 7, W_, 4); s.HL(7, 18, 7, W_, 4); s.HL(7, 19, 7, W_, 5)         # 판 윗면
    grain(c, s.X(8, 5), 17, 5, 2, W_, 4, 7)
    s.HL(7, 20, 7, W_, 2); s.HL(7, 21, 7, W_, 1)                                                       # 옆 가로대
    s.post(12, 22, 2, 7, W_, (3, 1))                                                                   # 앞다리
    c.ink()


def chair_wood_e(c): _chair_wood_side(c, 'e')
def chair_wood_w(c): _chair_wood_side(c, 'w')


# ═══════════════════════ 카페 의자 동·서 (검은 쇠 관 등받이 + 나무 앉는 판) ═══════════════════════
def _cafe_side(c, f):
    s = Side(c, f); D = 'dark'
    s.HL(4, 5, 2, D, 5)
    s.post(4, 6, 2, 23, D, (4, 2))                                                                     # 쇠 관(뒷다리까지)
    s.HL(6, 15, 8, W_, 3); s.HL(6, 16, 8, W_, 4); s.HL(6, 17, 8, W_, 4); s.HL(6, 18, 8, W_, 5)         # 판 윗면
    grain(c, s.X(7, 6), 16, 6, 2, W_, 4, 2)
    s.HL(6, 19, 8, W_, 2); s.HL(6, 20, 8, W_, 1)                                                       # 앞치마 2행
    s.post(12, 21, 2, 8, D, (4, 2))                                                                    # 앞다리 관
    c.ink()


def cafe_chair_e(c): _cafe_side(c, 'e')
def cafe_chair_w(c): _cafe_side(c, 'w')


# ═══════════════════════ 사무용 회전의자 동·서 (남색) ═══════════════════════
def _office_side(c, f):
    s = Side(c, f); N, D = 'navy', 'dark'
    s.top(2, 3, 3, 4, N, 3, 5, 6)
    s.post(2, 7, 3, 10, N, (4, 3, 2))                                                                  # 등받이 — 판 위에서 끝난다
    s.R(3, 11, 1, 1, N, 1)
    s.top(5, 13, 9, 5, N, 3, 5, 6)                                                                     # 판 윗면
    s.face(5, 18, 9, 3, N, (3, 2, 1), dark=1)
    s.post(8, 21, 2, 3, D, (4, 2))                                                                     # 가는 가스 기둥
    s.HL(3, 24, 11, D, 5); s.HL(3, 25, 11, D, 2)                                                       # 별 다리
    for x in (3, 8, 12): s.post(x, 27, 2, 1, D, (3, 1))                                               # 바퀴(다리와 한 행 띄움)
    c.ink()


def chair_office_e(c): _office_side(c, 'e')
def chair_office_w(c): _office_side(c, 'w')


# ═══════════════════════ 1인 안락의자 (장밋빛) 남·북·동·서 ═══════════════════════
RO = 'rose'


def _tufts(c, pts):
    for x, y in pts: c.P(x, y, RO, 2); c.P(x, y - 1, RO, 5)


def mci_armchair(c):
    """남향: 등받이 윗테 4행 + 그늘 · 등 쿠션(누빔) · 팔걸이 둘(윗면 4행, 오른쪽이 한 단 어둡다) · 앉는 쿠션 윗면 5행 · 앞면 6행 · 나무 발."""
    top_band(c, 3, 4, 10, 4, RO, 3, 5, 6, speck=False)
    c.HL(3, 8, 10, RO, 2)
    c.R(3, 9, 10, 5, RO, 4); c.VL(3, 9, 5, RO, 5); c.VL(12, 9, 5, RO, 3); c.HL(4, 11, 8, RO, 3)
    for x, d in ((1, 0), (12, 1)):
        top_band(c, x, 10, 3, 4, RO, 3 - d, 5 - d, 6 - d, speck=False)
        c.R(x, 14, 3, 11, RO, 4 - d); c.VL(x, 14, 11, RO, 5 - d); c.VL(x + 2, 14, 11, RO, 3 - d); c.HL(x, 24, 3, RO, 2 - d)
    top_band(c, 4, 14, 8, 5, RO, 2, 5, 6, speck=False); c.HL(4, 15, 8, RO, 4)
    for i, t in enumerate((4, 3, 3, 3, 2, 1)): c.HL(4, 19 + i, 8, RO, t)
    c.HL(5, 21, 6, RO, 2)
    for x in (2, 12): c.VL(x, 25, 2, 'wood', 2); c.VL(x + 1, 25, 2, 'wood', 1)
    c.ink()


def mci_armchair_n(c):
    """북향(뒷모습): 이어진 등판 하나 + 위 윗테 2행 밝게 + 그 밑 짙은 윤곽 · 양옆 팔걸이 머리 윗면 밝게 · 작은 나무 발(mci-sofa 처럼)."""
    for x in (1, 13):
        c.HL(x, 12, 2, RO, 6); c.HL(x, 13, 2, RO, 5)
        c.R(x, 14, 2, 11, RO, 3); c.VL(x, 14, 11, RO, 4)
    c.HL(3, 6, 10, RO, 6); c.HL(3, 7, 10, RO, 5); c.HL(3, 8, 10, RO, 2)
    c.R(3, 9, 10, 16, RO, 3); c.VL(3, 9, 16, RO, 4); c.VL(12, 9, 16, RO, 2); c.R(4, 22, 8, 3, RO, 2)
    for x in (3, 12): c.VL(x, 25, 2, 'wood', 1)
    c.ink()


def _armchair_side(c, f):
    """옆모습: 등받이(윗테 2행 · 왼쪽 열 밝게) · 밝은 앉는 판 · 짙은 안쪽 윤곽 · 가까운 팔걸이 윗면 밝게 · 하나로 이어진 옆면 · 작은 나무 발."""
    s = Side(c, f)
    s.HL(1, 5, 4, RO, 6); s.HL(1, 6, 4, RO, 5)
    s.post(1, 7, 4, 18, RO, (4, 3, 3, 2))
    s.HL(5, 9, 9, RO, 4); s.HL(5, 10, 9, RO, 5); s.HL(5, 11, 9, RO, 5)                                 # 앉는 판
    s.HL(5, 12, 9, RO, 2)                                                                              # 안쪽 윤곽
    s.HL(5, 13, 10, RO, 6); s.HL(5, 14, 10, RO, 5)                                                     # 가까운 팔걸이 윗면
    s.R(5, 15, 10, 10, RO, 3); s.R(5, 22, 10, 3, RO, 2)                                                # 옆면 하나
    for x in (3, 12): s.R(x, 25, 1, 2, 'wood', 1)
    c.ink()


def mci_armchair_e(c): _armchair_side(c, 'e')
def mci_armchair_w(c): _armchair_side(c, 'w')


# ═══════════════════════ 3인 소파 북향 (남색, 48×32) ═══════════════════════
def mci_sofa_n(c):
    """뒷모습: 윗테 2행 밝게 + 짙은 안쪽 윤곽 · 세로 등판(이음 두 줄) · 좌우 같은 팔걸이 머리 · 작은 나무 발(mci-sofa 처럼)."""
    N = 'navy'
    for x in (1, 43):
        c.HL(x, 10, 4, N, 6); c.HL(x, 11, 4, N, 5)
        c.R(x, 12, 4, 13, N, 3); c.VL(x, 12, 13, N, 4)
    c.HL(5, 4, 38, N, 6); c.HL(5, 5, 38, N, 5); c.HL(5, 6, 38, N, 1)
    c.R(5, 7, 38, 18, N, 2); c.R(5, 7, 38, 2, N, 3); c.R(5, 21, 38, 4, N, 1); c.VL(5, 7, 18, N, 3)
    for x in (17, 30): c.VL(x, 7, 14, N, 1)
    for x in (3, 44): c.VL(x, 25, 2, 'wood', 1)
    c.ink()


# ═══════════════════════ 4차(2026-10-20): 품질 불합격 6종 — 남색 바깥 윤곽 · 왼쪽 위 빛 ═══════════════════════
def r10n(w, h):
    """r10/r11 가구용이지만 mci 공통 남색 바깥 윤곽(위·옆 nol 1, 접지 nol 0)."""
    return RC(w, h, R10_RAMPS, outline_of=_NavyR(), ground=('nol', 0))


class _NavyR(dict):
    def get(s, k, d=None): return ('nol', 1)


def bar_stool(c):
    """높은 둥근 의자: 장미색 둥근 방석(타원 윗면 4행 · 왼쪽 위 빛 · 옆 띠 2행) · 크롬 기둥(왼쪽 열 밝게) · 기둥에 붙은 발걸이 고리 · 둥근 받침."""
    R_ = 'rose'
    c.HL(5, 9, 6, R_, 5); c.HL(4, 10, 8, R_, 5); c.HL(3, 11, 10, R_, 4); c.HL(4, 12, 8, R_, 4)       # 방석 윗면(타원)
    c.HL(5, 10, 3, R_, 6); c.HL(4, 11, 2, R_, 5); c.HL(10, 11, 2, R_, 3); c.HL(9, 12, 3, R_, 3)
    c.HL(3, 13, 10, R_, 2); c.HL(4, 14, 8, R_, 1); c.P(3, 13, R_, 3)                                   # 옆 띠
    c.VL(7, 15, 11, 'grey', 5); c.VL(8, 15, 11, 'grey', 3)                                             # 크롬 기둥
    c.HL(5, 21, 6, 'grey', 6); c.HL(4, 22, 8, 'grey', 3); c.P(4, 22, 'grey', 5)                        # 발걸이 고리(기둥에 붙음)
    c.HL(5, 26, 6, 'dark', 5); c.HL(4, 27, 8, 'dark', 4); c.HL(4, 28, 8, 'dark', 1); c.P(4, 27, 'dark', 5)   # 둥근 받침
    c.ink()


def chair_office_n(c):
    """북향(뒷모습) — 남향 사무 의자와 같은 몸: 등받이 뒷면(윗테 3행 밝게 + 그늘 · 왼쪽 열 밝게) · 양옆으로 비치는 판 · 가스 기둥 · 별 다리 · 바퀴."""
    N, D = 'navy', 'dark'
    c.R(2, 13, 12, 6, N, 5); c.HL(2, 13, 12, N, 4); c.HL(2, 18, 12, N, 6)                             # 판(양옆으로 비침)
    c.HL(2, 19, 12, N, 2); c.HL(2, 20, 12, N, 1)
    c.HL(4, 7, 8, N, 6); c.HL(4, 8, 8, N, 5); c.HL(4, 9, 8, N, 5); c.HL(4, 10, 8, N, 1)               # 등받이 윗테 + 그늘
    c.R(4, 11, 8, 9, N, 3); c.VL(4, 11, 9, N, 4); c.VL(11, 11, 9, N, 2); c.HL(5, 15, 6, N, 2)          # 뒷면(가운데 이음 한 줄)
    c.HL(4, 19, 8, N, 2)
    c.VL(7, 21, 3, D, 4); c.VL(8, 21, 3, D, 2)                                                        # 가스 기둥
    c.HL(2, 24, 12, D, 5); c.HL(2, 25, 12, D, 2)                                                       # 별 다리
    for x in (2, 7, 12): c.VL(x, 27, 1, D, 3); c.VL(x + 1, 27, 1, D, 1)                               # 바퀴
    c.ink()


def _mini_wheelchair(c, x0):
    """휠체어 보관소 한 대(x0..x0+12, 행 8..27): 밀손잡이 · 등받이 윗테 · 판 윗면 4행 + 앞면 · 양옆 바퀴(타이어 · 밝은 테) · 발판."""
    B = 'bluef'
    for x, t in ((x0 + 3, 5), (x0 + 9, 3)): c.VL(x, 8, 7, 'metal', t)
    c.HL(x0 + 2, 8, 2, 'tire', 2); c.HL(x0 + 9, 8, 2, 'tire', 2)
    c.HL(x0 + 4, 9, 5, B, 6); c.HL(x0 + 4, 10, 5, B, 5); c.HL(x0 + 4, 11, 5, B, 1)
    c.R(x0 + 4, 12, 5, 3, B, 3); c.VL(x0 + 4, 12, 3, B, 4)
    for xs, rim in ((x0, 6), (x0 + 10, 4)):
        c.VL(xs, 12, 13, 'tire', 1); c.VL(xs + 1, 12, 13, 'metal', rim); c.VL(xs + 2, 12, 13, 'tire', 2)
        for x in (xs, xs + 2): c.P(x, 12, None); c.P(x, 24, None)
        c.VL(xs + 1, 17, 2, 'metal', 3)
    c.HL(x0 + 3, 15, 7, B, 2); c.HL(x0 + 3, 16, 7, B, 5); c.HL(x0 + 3, 17, 7, B, 5); c.HL(x0 + 3, 18, 7, B, 6)   # 판 윗면
    c.HL(x0 + 3, 19, 7, B, 3); c.HL(x0 + 3, 20, 7, B, 1)                                                          # 앞면
    for x in (x0 + 4, x0 + 8): c.VL(x, 21, 3, 'metal', 3)
    c.HL(x0 + 3, 23, 3, 'metal', 6); c.HL(x0 + 7, 23, 3, 'metal', 6); c.HL(x0 + 3, 24, 7, 'metal', 2)
    for x in (x0 + 4, x0 + 8): c.VL(x, 25, 2, 'tire', 2)


def wheelchair_bay():
    """휠체어 보관소(2칸): 휠체어 두 대 + 가운데 기둥에 세운 파란 휠체어 표지(떠 있지 않게 기둥 · 받침)."""
    c = r10n(32, 32)
    _mini_wheelchair(c, 1); _mini_wheelchair(c, 18)
    c.VL(15, 8, 19, 'metal', 5); c.VL(16, 8, 19, 'metal', 2)                                          # 기둥
    c.HL(13, 27, 6, 'metal', 4)
    c.R(11, 1, 10, 7, 'bluef', 4); c.HL(11, 1, 10, 'bluef', 6); c.HL(11, 7, 10, 'bluef', 2); c.VL(11, 2, 5, 'bluef', 5)   # 표지판
    for x, y in ((15, 2), (14, 3), (15, 3), (15, 4), (16, 4), (17, 4), (14, 5), (17, 5), (15, 6), (16, 6)): c.P(x, y, 'paper', 2)
    c.ink()
    return c.rgba()


def dental_chair():
    """치과 진료 의자(가로, 머리 서쪽): 긴 청록 쿠션 윗면(머리 · 등 · 다리 이음) + 앞면 · 들린 머리받침 · 크롬 받침 기둥 · 바닥 판 ·
    뒤 기둥에서 뻗은 무영등(흰 갓 · 노란 렌즈) · 가글 그릇(물이 보이는 아가리)."""
    c = r10n(32, 32); Q = 'cyan'
    c.VL(26, 4, 15, 'metal', 4); c.VL(27, 4, 15, 'metal', 2)                                         # 뒤 기둥
    c.HL(9, 4, 18, 'metal', 5); c.HL(9, 5, 18, 'metal', 3)                                            # 무영등 팔
    c.HL(4, 3, 8, 'paper', 2); c.HL(4, 4, 8, 'paper', 1); c.R(4, 5, 8, 2, 'metal', 3); c.VL(4, 5, 2, 'metal', 4)   # 갓
    c.HL(5, 7, 6, 'lamp', 2); c.HL(6, 8, 4, 'lamp', 1)                                                 # 렌즈
    c.HL(22, 8, 5, 'paper', 2); c.HL(22, 9, 5, 'water', 1); c.HL(23, 10, 3, 'water', 0); c.HL(22, 11, 5, 'paper', 1)   # 가글 그릇
    c.HL(23, 12, 3, 'paper', 0)
    c.HL(3, 11, 6, Q, 3); c.HL(3, 12, 6, Q, 5); c.HL(3, 13, 6, Q, 4)                                  # 머리받침(들림)
    c.HL(3, 14, 26, Q, 2); c.R(3, 15, 26, 3, Q, 4); c.HL(3, 18, 26, Q, 5)                              # 쿠션 윗면(뒤 모서리 · 판 · 앞 모서리 빛)
    c.HL(4, 15, 8, Q, 5)
    for x in (9, 18): c.VL(x, 14, 4, Q, 2); c.VL(x + 1, 15, 3, Q, 5)                                  # 머리 · 등 · 다리 이음
    c.HL(3, 19, 26, Q, 3); c.HL(3, 20, 26, Q, 2); c.HL(3, 21, 26, Q, 1); c.VL(3, 19, 3, Q, 3)         # 앞면
    c.HL(7, 22, 18, 'metal', 2)
    c.VL(14, 23, 4, 'metal', 5); c.R(15, 23, 3, 4, 'metal', 3); c.VL(17, 23, 4, 'metal', 2)           # 받침 기둥
    c.HL(9, 27, 14, 'metal', 5); c.HL(9, 28, 14, 'metal', 2)                                          # 바닥 판
    c.ink()
    return c.rgba()


def barber_chair():
    """이발소 의자(남향): 붉은 가죽 등받이(윗테 4행 + 그늘 · 누빔 골) · 크롬 팔걸이(윗면 밝게) · 앉는 판 윗면 5행 + 앞면 3행 · 유압 기둥 · 둥근 받침 · 발판."""
    c = r10n(16, 32); Rd = 'redl'
    c.HL(4, 3, 8, Rd, 3); c.HL(4, 4, 8, Rd, 5); c.HL(4, 5, 8, Rd, 5); c.HL(4, 6, 8, Rd, 6)
    c.HL(4, 7, 8, Rd, 1)
    c.R(4, 8, 8, 5, Rd, 4); c.VL(4, 8, 5, Rd, 5); c.VL(11, 8, 5, Rd, 2); c.HL(5, 10, 6, Rd, 3)
    for x in (2, 12):                                                                                  # 크롬 팔걸이(2px)
        c.HL(x, 11, 2, 'paper', 2 if x == 2 else 1); c.HL(x, 12, 2, 'paper', 1 if x == 2 else 0)
        c.VL(x, 13, 7, 'metal', 5 if x == 2 else 4); c.VL(x + 1, 13, 7, 'metal', 2)
    c.HL(4, 13, 8, Rd, 2); c.HL(4, 14, 8, Rd, 5); c.HL(4, 15, 8, Rd, 5); c.HL(4, 16, 8, Rd, 5); c.HL(4, 17, 8, Rd, 6)   # 판 윗면
    c.HL(5, 15, 3, Rd, 6)
    c.HL(4, 18, 8, Rd, 3); c.HL(4, 19, 8, Rd, 2); c.HL(4, 20, 8, Rd, 1)                               # 앞면
    c.VL(7, 21, 4, 'metal', 5); c.VL(8, 21, 4, 'metal', 3)                                            # 유압 기둥
    c.HL(3, 22, 10, 'paper', 2); c.HL(3, 23, 10, 'metal', 3)                                          # 발판
    c.HL(4, 25, 8, 'metal', 5); c.HL(3, 26, 10, 'metal', 4); c.HL(3, 27, 10, 'metal', 2)              # 둥근 받침
    c.ink()
    return c.rgba()


def _zabuton(c, x0, M, tie):
    """바닥 방석: 윗면(왼쪽 위 빛 · 오른쪽 아래 그늘 · 가운데 매듭) + 앞 두께 2행."""
    c.R(x0, 3, 11, 8, M, 3); c.HL(x0, 3, 11, M, 4); c.VL(x0, 3, 8, M, 4); c.HL(x0 + 1, 4, 5, M, 5)
    c.VL(x0 + 10, 4, 7, M, 2); c.HL(x0 + 1, 10, 10, M, 2)
    c.P(x0 + 5, 6, 'tea', 2); c.P(x0 + 5, 7, tie, 1)
    c.HL(x0, 11, 11, M, 1); c.HL(x0, 12, 11, M, 0)                                                    # 앞 두께
    c.P(x0, 11, M, 2)


def floor_cushions():
    """방석 둘(보라 · 청록, 앞 두께 2행) 사이 둥근 찻쟁반(테 밝게 · 찻잔 둘)."""
    c = r10n(32, 16)
    _zabuton(c, 1, 'zpurple', 'zpurple'); _zabuton(c, 20, 'zteal', 'zteal')
    c.HL(14, 5, 4, 'tray', 4); c.HL(13, 6, 6, 'tray', 3); c.HL(13, 7, 6, 'tray', 3); c.HL(14, 8, 4, 'tray', 2)   # 쟁반 윗면
    c.HL(13, 9, 6, 'tray', 1)
    c.HL(14, 6, 2, 'paper', 2); c.HL(14, 7, 2, 'paper', 1); c.P(14, 6, 'tea', 0)                    # 찻잔 하나
    c.ink()
    return c.rgba()


# ═══════════════════════ 목록 ═══════════════════════
def _mc(fn):
    def g(w, h):
        c = mc(w, h); fn(c); return c.rgba()
    g.mpx = True
    return g


def _mcn(fn):
    def g(w, h):
        c = mcn(w, h); fn(c); return c.rgba()
    g.mpx = True
    return g


def _r(fn):
    def g(w, h):
        a = fn(); assert a.shape[:2] == (h, w), (fn.__name__, a.shape, (h, w)); return a
    g.mpx = False
    return g


DRAW = {
    'cinema-seat-row': _r(cinema_seat_row),
    'aud-seat-row': _r(aud_seat_row),
    'hospital-wheelchair': _r(hospital_wheelchair),
    'karaoke-sofa': _r(karaoke_sofa),
    'court-judge-bench': _r(court_judge_bench),
    'home-bath-stool': _r(home_bath_stool),
    'mci-armchair': _mc(mci_armchair),
    'mci-chair-wood-s': _mcn(chair_wood_s),
    'mci-chair-wood-n': _mcn(chair_wood_n),
    'mci-chair-wood-e': _mcn(chair_wood_e),
    'mci-chair-wood-w': _mcn(chair_wood_w),
    'mci-cafe-chair-e': _mcn(cafe_chair_e),
    'mci-cafe-chair-w': _mcn(cafe_chair_w),
    'mci-chair-office-e': _mcn(chair_office_e),
    'mci-chair-office-w': _mcn(chair_office_w),
    'mci-armchair-n': _mcn(mci_armchair_n),
    'mci-armchair-e': _mcn(mci_armchair_e),
    'mci-armchair-w': _mcn(mci_armchair_w),
    'mci-sofa-n': _mcn(mci_sofa_n),
    'mci-bar-stool': _mcn(bar_stool),
    'mci-chair-office-n': _mcn(chair_office_n),
    'hosp-wheelchair-bay': _r(wheelchair_bay),
    'clinic-dental-chair': _r(dental_chair),
    'svc-barber-chair': _r(barber_chair),
    'home-zabuton': _r(floor_cushions),
}
PENDING = {k for k in DRAW if k.endswith(('-e', '-w', '-n'))}
