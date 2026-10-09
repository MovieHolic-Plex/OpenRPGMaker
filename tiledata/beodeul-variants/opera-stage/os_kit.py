# 극장(opera-stage) 공용 재료.
# airship 의 as_kit(→ tower-interior ti_kit → graveyard-crypt gc_kit → _lib3 dlib)을 읽기만 하고, 버들항 나무 램프(terrain.WD)·
# 칩셋 널판 결(as_kit.grain)·버들항 금(castle6.GOLD)·회벽 크림(castle6.CRM)·돌 ST·쇠 IR·놋쇠 BR 을 그대로 쓴다.
# 새 재료(붉은 벨벳·짙은 무대 널·대리석 로비·객석 쪽마루·벽지·검은 막·무대 앞판·벽돌·대들보 아래 무대 깊이)는
# 같은 7단 규칙(0 윤곽 .. 6 밝음)으로 칠한다. 3/4 시점, 빛 왼쪽 위, 1칸 = 16px.
import os, sys, math
_ME = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(_ME, '..', 'airship'))
from as_kit import *                                    # noqa (T, ST, WD, BR, IR, I7, GLD, CRM, SL, RD, MAH, CNV, ROPE, Cv, Mk, vol, fin, Kit, KMap, foot, wbox, vcyl, hcyl, line, rope_line …)
from as_kit import _hash, _pn1
import as_kit as AK
import dlib, terrain, pz
HERE = _ME

# ------------------------------------------------------------------ 팔레트 (7단: 0 윤곽 .. 6 밝음)
VEL = [(38, 10, 26), (72, 14, 34), (106, 20, 38), (140, 28, 40), (176, 44, 46), (206, 76, 62), (232, 128, 104)]   # 붉은 벨벳(버들항 RD 쪽 진홍)
GLT = list(GLD)                                                                                                     # 버들항 금 7단
MRB = [(58, 46, 54), (120, 108, 104), (170, 160, 150), (204, 196, 184), (226, 220, 206), (240, 236, 224), (250, 248, 240)]  # 크림 대리석(버들항 회벽 CRM 쪽)
VEIN = (150, 138, 132)
NOIR = [(14, 10, 18), (22, 16, 28), (32, 24, 40), (44, 34, 54), (58, 46, 70), (74, 60, 88), (96, 80, 110)]         # 검은 막(무대 가림막)
BRK = [(40, 22, 24), (70, 38, 34), (100, 56, 46), (126, 74, 56), (148, 94, 70), (174, 122, 92), (202, 156, 122)]    # 무대 뒤 벽돌
EBN = [WD[0], (36, 22, 20), (52, 32, 24), (70, 44, 28), (88, 58, 36), (110, 74, 44), (140, 96, 56)]                 # 짙은 무대 널(버들항 나무를 한 단 어둡게)
GRN = [(18, 30, 24), (30, 52, 36), (44, 76, 48), (64, 102, 58), (92, 132, 70), (128, 162, 86), (172, 196, 120)]     # 그림판 물감 초록
BLU = [(20, 26, 52), (34, 48, 92), (52, 76, 132), (80, 112, 170), (120, 156, 206), (170, 200, 232), (220, 236, 250)]

def R7(r, k): return r[clamp(k, 0, len(r) - 1)]

# ------------------------------------------------------------------ 바닥 3종 (48x48 주기 표본, 3x3 이어 붙여도 이음새 없음)
def stage_px(X, Y):
    """무대 널: 동서로 누운 6px 짙은 널(5 + 이음 1), 48px 마다 마디가 줄마다 어긋나고 마디 곁 못 둘. 칩셋 널판 결로 ±1 단,
    오래 밟혀 반들거리는 밝은 줄, 분필 표시 점(무대 위치 표시)은 드물게."""
    row = Y // 6; ly = Y % 6
    off = int(_hash(row % 8, 0, 901) * 48)
    xx = (X + off) % 48
    if ly == 5: return EBN[1]
    if xx == 0: return EBN[1]
    h = _hash(row % 8, 0, 902)
    t = 4 if h < .55 else (3 if h < .85 else 5)
    g = grain(Y % 6 * 8 + row * 3, X + row * 27) - 3
    if g >= 2: t += 1
    elif g <= -2: t -= 1
    if ly == 0: t = min(6, t + 1)
    if ly == 4: t = max(1, t - 1)
    c = EBN[clamp(t, 1, 6)]
    if xx in (2, 45) and ly == 2: c = EBN[1]                                         # 못
    if ly == 1 and (X * 7 + row * 13) % 41 == 0: c = EBN[6]                          # 반들거림
    if pn(X, Y, 8, 905) > .82: c = mix(c, EBN[2], .35)                                # 밟힌 얼룩
    return c
mk_floor('op_stage', stage_px)

def marble_px(X, Y):
    """로비 대리석: 16px 크림 판과 반 단 어두운 판의 바둑판(대비는 약하게), 판마다 결(굽은 맥)이 다르고 잔 점,
    네 판이 만나는 점에 진홍 마름모 상감과 금 점(극장 벨벳 색)."""
    lx = X % 16; ly = Y % 16; cx = X // 16; cy = Y // 16
    light = (cx + cy) % 2 == 0
    if lx == 15 or ly == 15: c = mix(MRB[2], MRB[3], .4)
    else:
        c = MRB[4] if light else mix(MRB[3], MRB[4], .45)
        if lx == 0 or ly == 0: c = mix(c, MRB[5], .6)
        elif lx == 14 or ly == 14: c = mix(c, MRB[2], .45)
        ph = _hash(cx % 3, cy % 3, 911) * 6.28; sl = .4 + _hash(cx % 3, cy % 3, 912) * .9
        v = math.sin((lx * sl + ly) * .55 + ph + 1.6 * math.sin(ly * .35 + ph))
        if abs(v) < .1 and 0 < lx < 14 and 0 < ly < 14: c = mix(c, VEIN, .6)
        elif abs(v) < .24 and 0 < lx < 14 and 0 < ly < 14 and _hash(X, Y, 913) < .5: c = mix(c, VEIN, .3)
        r = _hash(X, Y, 914)
        if r < .03: c = mix(c, MRB[2], .5)
        elif r > .975: c = MRB[5]
    ex = (X + 1) % 16; ey = (Y + 1) % 16
    ddx = min(ex, 16 - ex); ddy = min(ey, 16 - ey)
    if (cx + cy) % 2 == 0 and ddx + ddy <= 2:
        c = VEL[3] if ddx + ddy == 2 else (VEL[2] if ddx + ddy == 1 else GLT[5])
        if ddx + ddy == 2 and ex < 8 and ey < 8: c = VEL[4]
    return c
mk_floor('op_marble', marble_px)

def parquet_px(X, Y):
    """객석 쪽마루: 8x8 칸마다 가로 널 둘 / 세로 널 둘이 번갈아 드는 바구니 짜임(마호가니 MAH), 칸 이음은 한 단 어둡다."""
    cx = X // 8; cy = Y // 8; lx = X % 8; ly = Y % 8
    horiz = (cx + cy) % 2 == 0
    a, b = (ly, lx) if horiz else (lx, ly)
    if a in (3, 7): return MAH[1]
    if lx == 7 or ly == 7: return MAH[1]
    h = _hash(cx % 6, cy % 6 * 2 + (a > 3), 921)
    t = 3 if h < .5 else (4 if h < .85 else 2)
    if a in (0, 4): t += 1
    g = grain(b * 5 + cx * 7, a * 3 + cy * 11) - 3
    if g >= 2: t += 1
    elif g <= -2: t -= 1
    c = MAH[clamp(t, 1, 6)]
    if pn(X, Y, 8, 922) > .8: c = mul(c, .9)
    return c
mk_floor('op_parquet', parquet_px)

# 무대 뒤·분장실 바닥은 버들항 널(dlib 'plank')을 그대로 쓴다(다시 내보내지 않음). 오케스트라 자리는 무대 널을 쓴다.

# ------------------------------------------------------------------ 벽 앞면 (dlib.face_px 에 끼운다)
def damask(X, Y):
    """붉은 벽지: 16x16 마다 꽃잎 마름모 무늬(한 단 밝음)와 작은 점, 바탕은 결 고운 벨벳 두 단."""
    lx = X % 16; ly = Y % 16
    c = VEL[2] if (X + Y * 2) % 7 else mix(VEL[2], VEL[3], .5)
    dx = abs(lx - 7.5); dy = abs(ly - 7.5)
    if abs(dx * 1.2 + dy - 5.4) < .7: c = VEL[3]                                     # 마름모 테
    if dx < 1 and dy < 2.2: c = VEL[4]                                               # 가운데 잎
    if dx < 2.2 and dy < 1: c = mix(VEL[3], VEL[4], .5)
    if (lx, ly) in ((0, 0), (1, 0), (0, 1)): c = GLT[3]                              # 모서리 금점
    return c

def hall_face(X, Y, H):
    """객석 벽: 위 금빛 처마 몰딩 → 붉은 벽지 → 금 그림 띠 → 짙은 나무 징두리 판(들어간 판) → 걸레받이."""
    if Y < 4:
        return (GLT[5], GLT[4], CRM[4], GLT[3])[Y] if not (Y == 2 and X % 4 == 0) else GLT[2]
    rail = H - 15
    if Y < rail:
        return damask(X, Y)
    ly = Y - rail
    if ly == 0: return GLT[5] if X % 6 else GLT[4]
    if ly == 1: return GLT[3]
    if ly == 2: return MAH[1]
    if ly >= 12: return MAH[2] if ly < 13 else MAH[1]
    px_ = X % 24; py = ly - 3
    if px_ < 2 or px_ > 21 or py < 1 or py > 7:
        c = MAH[3]
        if px_ == 0: c = MAH[4]
    else:
        c = MAH[4] if px_ < 12 else MAH[3]
        if px_ == 2 or py == 1: c = MAH[1]
        elif px_ == 21 or py == 7: c = MAH[5]
        elif px_ == 3 or py == 2: c = MAH[2]
        elif (px_, py) == (11, 4): c = GLT[4]
    return c

def drape_face(X, Y, H):
    """무대 뒤벽 검은 가림막: 4~5px 주름이 세로로 늘어지고(골은 어둡고 등은 밝다), 위는 걸쇠 막대, 아래는 바닥에 닿아 고인다."""
    if Y < 3: return (IR[3], IR[2], IR[1])[Y]
    per = 9
    ph = (X + int(_hash(X // per, 0, 931) * 3)) % per
    k = (1, 2, 3, 4, 4, 5, 4, 3, 2)[ph]
    if Y < 6: k = max(1, k - 1)
    if _hash(X, Y, 932) < .04: k += 1
    c = NOIR[clamp(k, 0, 6)]
    if Y >= H - 4: c = mul(c, .8)
    return c

def brick_face(X, Y, H):
    """무대 뒤 벽돌: 12x5 벽돌 어긋 쌓기(줄눈 한 단), 아래 2/3 는 검게 칠한 띠(무대 뒤 관례), 벽돌마다 톤이 다르다."""
    row = Y // 5; ly = Y % 5; off = (row % 2) * 6
    col = (X + off) // 12; lx = (X + off) % 12
    if ly == 4 or lx == 11: c = BRK[1]
    else:
        h = _hash(col, row, 941)
        c = BRK[3] if h < .45 else (BRK[4] if h < .75 else BRK[2])
        if ly == 0 or lx == 0: c = mix(c, BRK[5], .35)
        if _hash(X, Y, 942) < .05: c = BRK[2]
    band = H - 14
    if Y >= band:
        c = mix(c, NOIR[2], .72)
        if Y == band: c = NOIR[4]
    return c

def apron_face(X, Y, H):
    """무대 앞판(무대 바닥 남쪽 끝의 1줄 앞면): 위 금빛 턱 2px, 짙은 나무 들어간 판(32px 틀), 아래 그늘."""
    if Y == 0: return GLT[5]
    if Y == 1: return GLT[3]
    if Y == 2: return EBN[1]
    px_ = X % 32; py = Y - 3
    if px_ < 2 or px_ > 29 or py < 1 or py > 9:
        c = EBN[4]
        if px_ == 0: c = EBN[5]
    else:
        c = EBN[3]
        if px_ == 2 or py == 1: c = EBN[1]
        elif px_ == 29 or py == 9: c = EBN[5]
        if (px_ == 15 or px_ == 16) and 3 <= py <= 7: c = GLT[3] if px_ == 15 else GLT[2]   # 판 가운데 금 꽃
        if py == 5 and 13 <= px_ <= 18: c = GLT[3]
    return c

def box_face(X, Y, H):
    """박스석 앞면(난간 아래 1줄): 위 벨벳 쿠션 턱, 금 알 무늬 띠, 크림 판에 금 소용돌이, 아래 금 몰딩."""
    if Y < 3: return (VEL[5], VEL[4], VEL[2])[Y]
    if Y < 6:
        lx = X % 4
        return (GLT[5], GLT[4], GLT[2])[Y - 3] if lx != 3 else GLT[2]
    if Y >= 13: return (GLT[4], GLT[3], GLT[1])[Y - 13]
    lx = X % 16; ly = Y - 6
    c = CRM[4] if lx < 12 else CRM[3]
    d = math.hypot(lx - 7.5, (ly - 3.2) * 1.6)
    if 2.4 < d < 3.6 and not (lx > 8 and ly > 3): c = GLT[4]
    if 4.4 < d < 5.4 and (lx < 5 or lx > 10): c = GLT[3]
    if lx == 0: c = GLT[3]
    return c

FACES = {'op_hall': (hall_face, MAH[3]), 'op_drape': (drape_face, NOIR[3]), 'op_back': (brick_face, BRK[3]),
         'op_apron': (apron_face, EBN[3]), 'op_box': (box_face, CRM[3])}
for k, v in FACES.items(): dlib.FACE_BASE[k] = v[1]
_prev_face = dlib.face_px
def _face_px(style, X, Y, H, seed, capL, capR):
    if style not in FACES: return _prev_face(style, X, Y, H, seed, capL, capR)
    c = FACES[style][0](X, Y, H)
    if style in ('op_apron', 'op_box'):
        if Y == H - 1: c = DK
        if capL and X % 16 == 0: c = mix(c, GLT[5], .3)
        if capR and X % 16 == 15: c = mul(c, .55)
        return c
    if style != 'op_hall':
        if Y == 0: c = mix(c, (200, 190, 180), .25)
        elif Y == 1: c = mul(c, .7)
        elif Y == 2: c = mul(c, .85)
    if Y == H - 1: c = DK
    elif Y == H - 2: c = mul(c, .5)
    elif Y == H - 3: c = mul(c, .78)
    if capL and X % 16 == 0: c = mix(c, (230, 220, 210), .25)
    if capL and X % 16 == 1: c = mix(c, (230, 220, 210), .1)
    if capR and X % 16 == 15: c = mul(c, .55)
    if capR and X % 16 == 14: c = mul(c, .8)
    return c
dlib.face_px = _face_px

_oft = {}
def op_face_tile(style, x, n, capL, capR, H):
    """벽 앞면 한 칸 — 무늬(주름·벽지·판)가 세로로 이어지게 실제 칸 x 를 쓴다(dlib.face_tile 은 칸마다 가로 위치를 흔든다)."""
    if style not in FACES: return dlib.face_tile(style, None, n, int(_hash(x, n, 3) * 6), capL, capR, H)
    key = (style, x % 18, n, capL, capR, H)
    if key not in _oft: _oft[key] = mk(lambda xx, yy: dlib.face_px(style, (x % 18) * 16 + xx, n * 16 + yy, H, 3, capL, capR))
    return _oft[key]

def face_sample(style, w, h):
    return compose_(w, h, lambda i, j: op_face_tile(style, i, j, i == 0, i == w - 1, h * T))

# ------------------------------------------------------------------ 천장(벽 너머): 객석·로비 = 크림 회벽 몰딩 띠 + 금 턱, 무대 뒤 = 나무 띠(airship 것)
VOIDP = [(18, 10, 18), (24, 14, 22), (30, 20, 28)]
_oc_cache = {}
def hall_ceiling(open8, seed=0):
    key = (open8, seed % 4)
    if key in _oc_cache: return _oc_cache[key]
    N, E, S, W, NE, SE, SW, NW = open8
    t = 8
    def depth(x, y):
        best = None
        def up(d, side):
            nonlocal best
            if best is None or d < best[0]: best = (d, side)
        if N and y < t: up(y, 'N')
        if S and y >= 16 - t: up(15 - y, 'S')
        if W and x < t: up(x, 'W')
        if E and x >= 16 - t: up(15 - x, 'E')
        if not N and not W and NW and x < t and y < t: up(max(x, y), 'N')
        if not N and not E and NE and x >= 16 - t and y < t: up(max(15 - x, y), 'N')
        if not S and not W and SW and x < t and y >= 16 - t: up(max(x, 15 - y), 'S')
        if not S and not E and SE and x >= 16 - t and y >= 16 - t: up(max(15 - x, 15 - y), 'S')
        return best
    def f(x, y):
        X = x + (seed % 4) * 16; Y = y + (seed % 4) * 8
        b = depth(x, y)
        if b is None:
            r = _hash(X, Y, 951)
            return VOIDP[0] if r < .55 else (VOIDP[1] if r < .93 else VOIDP[2])
        d, side = b
        c = CRM[3] if _hash(X // 8, Y // 8, 952) < .6 else mix(CRM[3], CRM[2], .4)
        if d == 2: c = CRM[2]
        if d == 0: c = GLT[5] if side in ('N', 'W') else GLT[4]
        elif d == 1: c = mix(CRM[4], GLT[4], .3)
        if d == t - 1: c = DK
        elif d == t - 2: c = mix(c, DK, .3)
        if d in (4, 5) and (X + Y) % 4 == 0: c = mix(c, GLT[4], .5)                # 띠 속 금 점 몰딩
        return c
    im = mk(f); _oc_cache[key] = im; return im

def ceiling_sample(fn):
    def cf(i, j):
        o8 = (j > 0, i < 2, j < 2, i > 0, j > 0 and i < 2, j < 2 and i < 2, j < 2 and i > 0, j > 0 and i > 0)
        return fn((False,) * 8 if (i == 1 and j == 1) else o8, i + j)
    return compose_(3, 3, cf)

# ------------------------------------------------------------------ 대들보 통로 아래: 10m 아래 무대가 보이는 깊이
POOLS = []          # (cx, cy, rx, ry) 픽셀 — 지도가 채운다(아래 무대 조명 웅덩이)
def abyss_px(X, Y):
    """아래로 내려다본 무대: 무대 널을 절반 크기·짙은 남보라로 눌러 멀리 보이게, 조명 웅덩이 안은 따뜻하게 밝다."""
    c = stage_px((X // 2) % 48 * 1, (Y // 2 + 7) % 48)
    k = .46
    lit = 0.0
    for (cx, cy, rx, ry) in POOLS:
        d = ((X - cx) / rx) ** 2 + ((Y - cy) / ry) ** 2
        if d < 1: lit = max(lit, 1 - d)
    if lit > 0:
        q = 2 if lit > .4 else 1
        if lit < .12 and (X + Y) % 2: q = 0
        base = mix(mul(c, k), (60, 40, 34), .3)
        if q == 0: return base
        if q == 1: return mix(mul(c, .95), (170, 128, 76), .35)
        return mix(mul(c, 1.5), (236, 196, 130), .38)
    out = mix(mul(c, k), (16, 14, 30), .32)
    if _hash(X, Y, 961) < .015: out = mix(out, (60, 54, 80), .5)                  # 먼지 반짝
    return out

def abyss_sample():
    return mk(lambda x, y: abyss_px(x + 400, y + 400), 48, 48)

# ------------------------------------------------------------------ 그리기 도우미
def gilt_box(cv, x0, y0, x1, y1, top, seed=0):
    """금박 상자(윗면 top 행 + 앞면)."""
    stone_box(cv, x0, y0, x1, y1, top, GLT, seed)

def vel_pleats(cv, x0, x1, y0, y1, per=5, k0=0, seed=0, xmask=None):
    """세로 주름 벨벳(빛 왼쪽 위): 주름 등은 밝고 골은 어둡다."""
    for y in range(y0, y1):
        for x in range(x0, x1):
            if xmask and not xmask(x, y): continue
            ph = (x - x0) % per
            k = (2, 4, 5, 4, 3)[ph * 5 // per]
            if x > x1 - 3: k -= 1
            if _hash(x, y, seed + 31) < .05: k += 1
            cv.px(x, y, VEL[clamp(k + k0, 1, 6)])

def hflip(im): return im.transpose(Image.FLIP_LEFT_RIGHT)
