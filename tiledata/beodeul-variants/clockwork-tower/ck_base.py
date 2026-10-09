# 시계탑 내부 던전(clockwork-tower) 공용 재료 — 장르 steampunk (tiledata/beodeul-kits/genres/steampunk.md).
# machine-factory 의 mf_kit(→ tower-interior ti_kit → graveyard-crypt gc_kit/gc_map → _lib3 dlib, future-ruins fr_base/fr_mat 기계 재질 규약)을
# **읽기만 하고 그대로** 쓴다(TC 톤 캔버스·panels 판 줄눈·pipe_h/pipe_v 관·box 3/4 상자·rustify·KMap·Kit). 놋쇠 = BRASS, 구리 = RUST 톤 3~6,
# 리벳 철판 = STEEL, 목재 = 버들항 wood. 여기서 더하는 램프는 둘 — 벽돌(brick, 붉은 갈색) · 녹청(verd, 구리 녹) — 같은 7단 규칙(0 윤곽 · 1~6 밝기).
# 새 바닥(톱니 바닥판·참나무 널·벽돌 바구니 짜임·놋쇠 격자) · 벽 앞면 셋(벽돌·구리관 벽돌·리벳 기계 벽) · 천장(참나무 들보 띠) · 톱니 구덩이.
# 3/4 시점(윗면 + 앞면, 옆면 없음), 빛 왼쪽 위, 1칸 = 16px. 생성 이미지·트레이싱 없음.
import os, sys, math
_ME = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(_ME, '..', 'machine-factory'))
sys.path.insert(0, _ME)
from mf_kit import *                                    # noqa
from mf_kit import _hash
import mf_kit as MK
import numpy as np
from PIL import Image
import fr_base as FB
import fr_mat as FM
import dlib

BRICK = [FB.hx(c) for c in ('#1a0c10', '#3c1814', '#62281a', '#843a22', '#a2522e', '#c0703e', '#dc9a62')]   # 벽돌(붉은 갈색, 그림자 남보라·빛 노랗게)
VERD = [FB.hx(c) for c in ('#081614', '#10302a', '#1c4c40', '#2e6a58', '#4a8c74', '#78b298', '#b4dcc4')]    # 녹청(구리 녹)
OAK = [FB.hx(c) for c in ('#140a10', '#2a1610', '#42241a', '#5a3420', '#74462a', '#90603a', '#b48452')]     # 짙은 참나무(기름 먹인 들보·널)
for name, ramp in (('brick', BRICK), ('verd', VERD), ('oak', OAK)):
    if name not in FM.MID:
        FM.MATS.append(name); FM.MID[name] = len(FM.MATS) - 1; FM.RAMP_OF[name] = ramp
_LUT = np.zeros((len(FM.MATS), 7, 3), np.uint8)
for n, i in FM.MID.items():
    if n in FM.RAMP_OF:
        r = FM.RAMP_OF[n]
        for k in range(7): _LUT[i, k] = r[min(k, len(r) - 1)]
FM.LUT = _LUT


def Rc(mat, k): return FM.RAMP_OF[mat][clampk(k, 0, 6)]


def _tc48(seed): return TC(48, 48, seed)


# ================================================================== 바닥 (48x48 주기 표본)
def gear_deck(seed=11, worn=False):
    """톱니 바닥판: 24x16 리벳 철판(줄마다 반장 엇갈림, 검은 무쇠 톤 2~3)을 놋쇠 띠(판 줄눈 대신 2px 놋쇠 이음)로 묶고,
    판 몇 장(판마다 해시)에 새긴 톱니 장미 무늬(반지름 5 이빨 고리 + 굴대 점), 판 모서리 놋쇠 리벳. worn = 사람이 다니는 판:
    이음 놋쇠가 닳아 밝고, 판 가운데가 반들반들(톤 +1 덩이), 기름 얼룩."""
    tc = _tc48(seed)
    for y in range(48):
        for x in range(48):
            row = y // 16; ly = y % 16; off = (row % 2) * 12
            xx = (x + off) % 48; col = xx // 24; lx = xx % 24
            h = _hash(col, row, seed + 1)
            k = 3 if h < .55 else 2
            if ly == 15 or lx == 23:                                              # 놋쇠 이음(아래·오른쪽)
                tc.px(x, y, 'brass', 3 if not worn else 4); continue
            if ly == 0 or lx == 0:
                tc.px(x, y, 'brass', 5 if not worn else 6) if (ly == 0 and lx < 23) or (lx == 0) else None; continue
            if ly == 14 or lx == 22: k -= 1
            elif ly == 1 or lx == 1: k += 1
            if (lx in (3, 20)) and (ly in (3, 12)): tc.px(x, y, 'brass', 6); continue      # 리벳 머리
            if (lx in (4, 21)) and (ly in (4, 13)): tc.px(x, y, 'steel', 1); continue
            # 새긴 톱니 장미(판 셋 중 하나꼴)
            if _hash(col, row, seed + 3) < .4:
                cx, cy = 11.5, 7.5; dx = lx - cx; dy = ly - cy; d = math.hypot(dx, dy); a = math.atan2(dy, dx)
                r = 4.6 + (1.2 if math.cos(a * 8 + h * 6) > .3 else 0)
                if abs(d - r) < .6: k = k - 1 if dy > 0 or dx > 0 else k + 1
                if d < 1.2: tc.px(x, y, 'brass', 4 if dx < 0 else 3); continue
            if worn and 4 < lx < 19 and 3 < ly < 12 and _hash(x // 3, y // 3, seed + 5) < .5: k += 1
            if _hash(x, y, seed + 6) < .05: k += 1 if _hash(y, x, seed + 7) < .5 else -1
            tc.px(x, y, 'steel', clampk(k, 1, 5))
    n = FB.tnoise(48, 48, 8, seed + 9)
    oil = (n > (.74 if worn else .82)) & (tc.m == FM.MID['steel'])
    tc.t = np.where(oil & (tc.t > 1), tc.t - 1, tc.t)
    return tc.img()


def oak_plank(seed=21):
    """참나무 널 바닥: 가로 널(폭 8px, 길이 24·48 엇갈림, 널마다 톤 ±1), 결 줄(가는 어두운 줄이 널 따라 끊기며), 널 끝 놋쇠 못 머리 둘,
    널 사이 틈 1px(톤 1), 널 위 모 1px 밝게. 기름 먹인 짙은 갈색(oak)."""
    tc = _tc48(seed)
    for y in range(48):
        r = y // 8; ly = y % 8
        L = 24 if r % 3 != 1 else 48
        off = int(_hash(r, 0, seed) * 4) * 6
        for x in range(48):
            xx = (x + off) % 48; seg = xx // L; lx = xx % L
            h = _hash(seg, r, seed + 1)
            k = 3 + (1 if h > .62 else 0) - (1 if h < .2 else 0)
            if ly == 7 or lx == L - 1: tc.px(x, y, 'oak', 1); continue
            if ly == 0: k += 1
            if ly == 6: k -= 1
            g = (x * 3 + int(_hash(seg, r, seed + 2) * 40)) % 23
            if ly in (2, 4) and g < 9 and _hash(x // 4, y, seed + 3) < .7: k -= 1          # 결
            if lx in (2, L - 4) and ly in (2, 5): tc.px(x, y, 'brass', 5 if ly == 2 else 3); continue
            if _hash(x, y, seed + 4) < .03: k -= 1
            tc.px(x, y, 'oak', clampk(k, 1, 6))
    return tc.img()


def brick_floor(seed=31):
    """벽돌 바닥(바구니 짜임): 16x16 칸마다 벽돌 둘이 가로(16x8)·세로(8x16)로 번갈아 눕는다(체크). 줄눈 1px 회색 모르타르(stone 3),
    벽돌마다 톤 ±1, 위·왼쪽 모 밝게, 닳은 모서리 점."""
    tc = _tc48(seed)
    for y in range(48):
        for x in range(48):
            bx = x // 16; by = y // 16; lx = x % 16; ly = y % 16
            horiz = (bx + by) % 2 == 0
            if horiz: sub = ly // 8; u = lx; v = ly % 8; w_, h_ = 16, 8
            else: sub = lx // 8; u = lx % 8; v = ly; w_, h_ = 8, 16
            if u == w_ - 1 or v == h_ - 1: tc.px(x, y, 'stone', 3); continue
            hh = _hash(bx * 2 + sub, by * 3 + sub, seed + 1)
            k = 4 if hh < .5 else (3 if hh < .82 else 5)
            if u == 0 or v == 0: k += 1
            elif u == w_ - 2 or v == h_ - 2: k -= 1
            r = _hash(x, y, seed + 2)
            if r < .05: k -= 1
            elif r > .975: k += 1
            tc.px(x, y, 'brick', clampk(k, 1, 6))
    return tc.img()


def brass_grating(seed=41):
    """놋쇠 격자 통로: 2px 놋쇠 띠 가로(위, 빛 받은 윗변)·세로(아래, 어두움) 4px 간격 엮음, 틈 사이로 아래층 어둠과 흐린 톱니 줄,
    16px 마다 무쇠 받침 보."""
    tc = _tc48(seed)
    for y in range(48):
        for x in range(48):
            lx = x % 4; ly = y % 4
            if ly in (0, 1):
                k = 5 if ly == 0 else 3
                if x % 16 == 15: k -= 1
                tc.px(x, y, 'brass', k)
            elif lx == 0: tc.px(x, y, 'brass', 2)
            else:
                k = 1
                if (y % 48) in (26, 27) and lx == 2: k = 2
                if (x % 48) in (9, 10, 37, 38) and ly == 2: k = 2
                tc.px(x, y, 'dark', k + (1 if _hash(x // 4, y // 4, seed) < .15 else 0))
    for y in range(48):
        for xx in range(15, 48, 16): tc.px(xx, y, 'steel', 1 if (y % 4) > 1 else 3)
    return tc.img()


_FLOORPX = {}
def _reg_floor(tag, im):
    a = np.array(im.convert('RGB')); _FLOORPX[tag] = a
    mk_floor(tag, lambda X, Y, a=a: tuple(int(v) for v in a[Y % 48, X % 48]))
_reg_floor('ck_deck', gear_deck())
_reg_floor('ck_deck_worn', gear_deck(13, worn=True))
_reg_floor('ck_plank', oak_plank())
_reg_floor('ck_brick', brick_floor())
_reg_floor('ck_grate', brass_grating())


# ================================================================== 벽 앞면 세 종
def brick_k(X, Y, seed):
    """벽돌 벽(16x8 엇갈림 = 반장 쌓기): 줄눈 −, 벽돌마다 톤, 그을음."""
    row = Y // 8; off = (row % 2) * 8; lx = (X + off) % 16; ly = Y % 8
    if ly == 7 or lx == 15: return None
    h = _hash((X + off) // 16, row, seed + 3)
    k = 3 if h < .5 else (2 if h < .78 else 4)
    if ly == 0 or lx == 0: k += 1
    if _hash(X, Y, seed + 4) < .05: k -= 1
    return clampk(k, 1, 5)


def wainscot(X, Y, H, seed):
    """벽 밑 참나무 징두리 판(아래 10px): 윗모 놋쇠 띠 2px, 판 사이 세로 홈 32px 마다, 놋쇠 못 머리 줄."""
    ly = Y - (H - 10)
    if ly < 0: return None
    if ly == 0: return Rc('brass', 5)
    if ly == 1: return Rc('brass', 3)
    lx = X % 32
    if lx == 31: return Rc('oak', 1)
    if lx == 0: return Rc('oak', 4)
    if ly == 4 and X % 16 == 8: return Rc('brass', 5)
    k = 3 if ly < 7 else 2
    if (X * 5 + ly * 3) % 17 == 0: k -= 1
    return Rc('oak', k)


def brick_face(X, Y, H, seed):
    w = wainscot(X, Y, H, seed)
    if w is not None: return w
    if Y in (4, 5): return Rc('brass', 5 if Y == 4 else 3)                                # 윗 놋쇠 띠(갓 몰딩)
    if Y == 6: return Rc('brick', 1)
    k = brick_k(X, Y, seed)
    if k is None: return Rc('stone', 2)
    c = Rc('brick', k - (1 if Y > H - 18 else 0))
    if _hash(X // 3, 0, seed + 9) < .12 and Y > 8 and _hash(X // 3, Y // 5, seed + 10) < .6 - Y / max(1, H): c = mul(c, .82)   # 그을음 줄
    return c


def pipe_brick_face(X, Y, H, seed):
    """구리관 벽: 벽돌 벽 앞 가로 구리관(지름 8, 녹청 점) + 가는 놋쇠 관(지름 4), 32px 마다 무쇠 받침쇠. 칸 씨앗 1·4 는 세로 구리관."""
    w = wainscot(X, Y, H, seed)
    if w is not None: return w
    lx = X % 16
    def cylc(t, mat, flange):
        k = MK.fcyl(t)
        if flange: k = clampk(k + (1 if lx == 7 else (-1 if lx == 9 else 0)), 1, 6)
        return Rc(mat, k)
    big0 = 10; small0 = 22
    if seed % 6 in (1, 4) and 9 <= lx <= 14 and Y >= big0 + 8:
        c = cylc((lx - 9 + .5) / 6, 'rust', False)
        if (Y - big0) % 16 in (0, 1): c = Rc('rust', 6 if (Y - big0) % 16 == 0 else 3)
        return c
    if big0 <= Y < big0 + 8:
        c = cylc((Y - big0 + .5) / 8, 'rust', lx in (7, 8, 9))
        if _hash(X, Y, seed + 21) < .05 and Y > big0 + 4: c = Rc('verd', 3)
        return c
    if Y == big0 + 8: return Rc('brick', 1)
    if small0 <= Y < small0 + 4: return cylc((Y - small0 + .5) / 4, 'brass', lx in (7, 8))
    if Y == small0 + 4: return Rc('brick', 1)
    if X % 32 in (14, 15, 16) and big0 - 1 <= Y <= big0 + 9: return Rc('steel', 2 if X % 32 != 14 else 4)
    k = brick_k(X, Y, seed)
    return Rc('stone', 2) if k is None else Rc('brick', k - 1)


def mech_face(X, Y, H, seed):
    """기계 벽: 검은 무쇠 리벳 판(32x16 엇갈림) + 판 이음에 놋쇠 띠, 가운데 높이 놋쇠 몰딩 줄, 아래 참나무 징두리."""
    w = wainscot(X, Y, H, seed)
    if w is not None: return w
    row = Y // 16; off = (row % 2) * 16; lx = (X + off) % 32; ly = Y % 16
    k = 3 if _hash((X + off) // 32, row, seed + 3) < .6 else 2
    if ly == 15 or lx == 31: return Rc('brass', 2)
    if ly == 0 or lx == 0: return Rc('brass', 4)
    if lx in (3, 28) and ly in (3, 12): return Rc('brass', 6)
    if lx in (4, 29) and ly in (4, 13): return Rc('steel', 1)
    if _hash(X, Y, seed + 4) < .04: k -= 1
    return Rc('steel', k)


FACE_FN = {'ck_brick': brick_face, 'ck_pipe': pipe_brick_face, 'ck_mech': mech_face}
for st in FACE_FN: dlib.FACE_BASE[st] = Rc('brick', 3)
_prev_face = dlib.face_px
def _face_common(c, X, Y, H, capL, capR):
    if Y == 0: c = Rc('brass', 5)
    elif Y == 1: c = Rc('oak', 4)
    elif Y == 2: c = mul(c, .62)
    elif Y == 3: c = mul(c, .78)
    if Y == H - 1: c = DK
    elif Y == H - 2: c = mul(c, .55)
    if capL and X % 16 == 0: c = mix(c, Rc('brass', 6), .3)
    if capL and X % 16 == 1: c = mix(c, Rc('brass', 6), .1)
    if capR and X % 16 == 15: c = mul(c, .55)
    if capR and X % 16 == 14: c = mul(c, .8)
    return c
def _face_px(style, X, Y, H, seed, capL, capR):
    if style not in FACE_FN: return _prev_face(style, X, Y, H, seed, capL, capR)
    return _face_common(FACE_FN[style](X, Y, H, seed), X, Y, H, capL, capR)
dlib.face_px = _face_px


def face_sample(style, w, h):
    return compose_(w, h, lambda i, j: dlib.face_tile(style, None, j, int(_hash(i + 3, j, 3) * 6), i == 0, i == w - 1, h * T))


# ================================================================== 천장(벽 너머): 참나무 들보 두께 띠 + 놋쇠 모 앵글, 속은 어둠
VOID = [(12, 9, 14), (16, 12, 20), (22, 17, 26)]
_cc = {}
def ck_ceiling(open8, seed=0):
    key = (open8, seed % 4)
    if key in _cc: return _cc[key]
    N, E, S, W, NE, SE, SW, NW = open8
    t = 7
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
            r = _hash(X, Y, 861)
            return VOID[0] if r < .6 else (VOID[1] if r < .94 else VOID[2])
        d, side = b
        lit = side in ('N', 'W')
        if d <= 1:
            k = (6 if d == 0 else 4) if lit else (4 if d == 0 else 3)
            if (X + Y) % 8 == 3 and d == 1: k = 6 if lit else 5
            return Rc('brass', k)
        # 참나무 들보: 결 줄
        along = Y if side in ('W', 'E') else X
        k = 3 if lit else 2
        if (along * 7 + d * 3) % 11 == 0: k -= 1
        if d == 2: k += 1
        c = Rc('oak', clampk(k, 1, 5))
        if d == t - 1: c = DK
        elif d == t - 2: c = mix(c, DK, .35)
        return c
    im = mk(f); _cc[key] = im; return im


def ceiling_sample():
    def cf(i, j):
        o8 = (j > 0, i < 2, j < 2, i > 0, j > 0 and i < 2, j < 2 and i < 2, j < 2 and i > 0, j > 0 and i > 0)
        return ck_ceiling((False,) * 8 if (i == 1 and j == 1) else o8, i + j)
    return compose_(3, 3, cf)


# ================================================================== 톱니 구덩이(16변형 칸): 북쪽 = 놋쇠 테 + 3/4 로 보이는 벽돌 속 벽, 그 아래 어둠 속
# 세로 굴대 둘·가로 축 하나(칸 경계에서 이어진다)와 흐린 톱니 이빨 줄. 서·동·남 = 놋쇠 테 2px. 막힘.
_pit = {}
def pit_cell(N, E, S, W, X0=0, Y0=0):
    key = (N, E, S, W, X0 % 32, Y0 % 32)
    if key in _pit: return _pit[key]
    tc = TC(16, 16, 5)
    for y in range(16):
        for x in range(16):
            X = X0 + x; Y = Y0 + y
            k = 1 if _hash(X, Y, 871) < .82 else 2
            mat = 'dark'
            if x in (4, 5) or x in (11, 12): mat, k = 'steel', (2 if x in (4, 11) else 1)        # 세로 굴대
            if y in (10, 11): mat, k = 'brass', (2 if y == 10 else 1)                          # 가로 축(흐린 놋쇠)
            if y == 13 and (X // 2) % 2 == 0: mat, k = 'brass', 1                               # 톱니 이빨 줄(아래 깊은 곳)
            tc.px(x, y, mat, k)
            if not N:
                if y == 0: tc.px(x, y, 'brass', 5)
                elif y == 1: tc.px(x, y, 'brass', 3)
                elif y < 8:
                    kk = brick_k(X, y - 2, 5)
                    tc.px(x, y, 'brick', clampk((kk or 1) - 1 - (y - 2) // 3, 1, 4) if kk else 1)
                    if kk is None: tc.px(x, y, 'stone', 1)
                elif y == 8: tc.px(x, y, 'dark', 0)
            if not W and x == 0: tc.px(x, y, 'brass', 5 if (N or y > 1) else 6)
            if not W and x == 1 and (N or y > 1): tc.px(x, y, 'brass', 2)
            if not E and x == 15: tc.px(x, y, 'brass', 2)
            if not E and x == 14 and (N or y > 1): tc.px(x, y, 'dark', 0)
            if not S and y == 15: tc.px(x, y, 'brass', 4)
            if not S and y == 14: tc.px(x, y, 'brass', 2)
    im = tc.img(); _pit[key] = im; return im


def pit_sheet():
    sh = new(64, 64)
    for n in range(16):
        sh.alpha_composite(pit_cell(bool(n & 1), bool(n & 2), bool(n & 4), bool(n & 8)), (n % 4 * 16, n // 4 * 16))
    return sh
