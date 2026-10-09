# 기계 공장 + 지하 연구소(machine-factory) 공용 재료.
# 실내 틀은 tower-interior 의 ti_kit(→ graveyard-crypt gc_kit/gc_ext/gc_map → _lib3 dlib: 바닥 3x3 표본·벽 앞면·천장·KMap·Kit)을,
# 기계 재질은 future-ruins 의 「기계 재질 규약」(fr_base 램프·fr_mat 톤 캔버스 TC·panels 판 줄눈·rustify 녹 번짐·pipe_h/pipe_v 관·
# cable 전선·box 3/4 상자·hazard 경고 띠·glass_pane 유리)을 **읽기만 하고 그대로** 쓴다. 금속판·리벳·관·녹 램프를 새로 만들지 않는다.
# 여기서 더하는 것은 실내 전용 표면(체크 철판·그레이팅·연구소 바닥·콘크리트/관/연구소 벽 앞면·강철 천장 띠·구덩이)과
# 이 화풍에 없던 재질 램프 둘(배양액 bio, 연구소 흰 판 lab) — 모두 같은 7단 규칙(0 윤곽 · 1~6 밝기, 그림자 남보라·빛 노랗게).
# 3/4 시점(윗면 + 앞면, 옆면 없음), 빛 왼쪽 위, 1칸 = 16px. 생성 이미지·트레이싱 없음.
import os, sys, math
_ME = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(_ME, '..', 'tower-interior'))
sys.path.insert(0, os.path.join(_ME, '..', 'future-ruins'))
sys.path.insert(0, _ME)
from ti_kit import *                                    # noqa (T, ST, WD, DK, Cv, new, mk, mix, mul, Kit, KMap, foot, mk_floor, SAMPLES, compose_ …)
from ti_kit import _hash
import ti_kit as TK
import dlib, pz
import numpy as np
from PIL import Image
import fr_base as FB
import fr_mat as FM
from fr_mat import TC, panels, rustify, pipe_h, pipe_v, cable, box, hazard, glass_pane, cyl_k as fcyl
from fr_base import STEEL, RUST, BRASS, CONC, CABLE, WARN, GLASS, SIGNAL, hash2, smooth, tnoise
import fr_props as FP
import fr_ground as FG
from dprops import glow
HERE = _ME

# ------------------------------------------------------------------ 새 재질 램프 두 개 (같은 7단 규칙) — fr_mat 의 재질표에 덧붙인다
BIO = [FB.hx(c) for c in ('#04140c', '#082a16', '#10461e', '#1a6a28', '#2e9236', '#66c058', '#c6f0a2')]    # 배양액(밝은 초록, 빛 노랗게)
LAB = [FB.hx(c) for c in ('#10121c', '#262a38', '#444a5a', '#687082', '#9098a8', '#bcc2cc', '#e2e6ea')]    # 연구소 흰 판(차가운 회백)
SCR = [FB.hx(c) for c in ('#04100e', '#08201c', '#0e3a30', '#16584a', '#2a8a6e', '#6cc8a0', '#d0f6e0')]    # 꺼질 듯한 초록 화면
for name, ramp in (('bio', BIO), ('lab', LAB), ('scr', SCR)):
    if name not in FM.MID:
        FM.MATS.append(name); FM.MID[name] = len(FM.MATS) - 1; FM.RAMP_OF[name] = ramp
_LUT = np.zeros((len(FM.MATS), 7, 3), np.uint8)
for n, i in FM.MID.items():
    if n in FM.RAMP_OF:
        r = FM.RAMP_OF[n]
        for k in range(7): _LUT[i, k] = r[min(k, len(r) - 1)]
FM.LUT = _LUT                                            # TC.img() 는 fr_mat.LUT 를 읽는다

def clampk(k, lo=1, hi=6): return max(lo, min(hi, int(k)))
def R(mat, k): return FM.RAMP_OF[mat][clampk(k, 0, 6)]

def tc_rgb(tc):
    a = np.array(tc.img()); return a

def fin_nb(im, N, E, S, W, k=.62):
    """pz.fin 과 같은 윤곽, 다만 이웃이 이어지는 칸 경계는 윤곽으로 치지 않는다(오토타일 이음매에 검은 줄이 안 생기게)."""
    p = im.load(); W_, H_ = im.size; edge = []
    for y in range(H_):
        for x in range(W_):
            if p[x, y][3] < 200: continue
            for dx, dy in ((0, 1), (1, 0), (-1, 0), (0, -1)):
                xx, yy = x + dx, y + dy
                if (xx < 0 and W) or (xx >= W_ and E) or (yy < 0 and N) or (yy >= H_ and S): continue
                if not (0 <= xx < W_ and 0 <= yy < H_) or p[xx, yy][3] < 200: edge.append((x, y)); break
    for x, y in edge:
        r, g, b, a = p[x, y]; p[x, y] = (int(r * k), int(g * k), min(255, int(b * k * 1.1)), a)
    return im

# ================================================================== 바닥 (48x48 주기 표본 = 3x3 칸 이음새 없음)
def _tc48(seed): return TC(48, 48, seed)

def checker_plate(seed=61):
    """공장 바닥 체크 철판: 규약 판 줄눈(16x16 = 한 칸, 모서리 리벳 넷) + 판 전체에 엇갈린 낟알 돌기(미끄럼 막이, 2px 돌기가
    판마다 방향을 바꾼다) + 드문 녹 번짐·기름 얼룩. future-ruins 야외 강철판보다 한 단 어둡고 녹이 적다(실내)."""
    tc = _tc48(seed)
    panels(tc, 0, 0, 48, 48, 'steel', 2, 16, 16, face='top', seed=seed, vary=0, joint=1)
    Y, X = np.mgrid[0:48, 0:48]
    hp = hash2(X // 16, Y // 16, seed + 3)
    tc.t = np.where((hp < .12) & (tc.t > 1) & (tc.t < 6), tc.t - 1, tc.t)
    lx = X % 16; ly = Y % 16
    inner = (lx > 2) & (lx < 13) & (ly > 2) & (ly < 13)
    flipd = hash2(X // 16, Y // 16, seed + 5) < .5
    a = np.where(flipd, (lx + ly) % 6, (lx - ly + 60) % 6)
    b = np.where(flipd, (lx - ly + 60) % 3, (lx + ly) % 3)
    bump = inner & (a < 2) & (b == 0)
    tc.t = np.where(bump, np.minimum(tc.t + 1, 6), tc.t)
    shd = inner & (a == 2) & (b == 1)
    tc.t = np.where(shd, np.maximum(tc.t - 1, 1), tc.t)
    # 녹 번짐(줄눈에서 조금) — tnoise 로 주기 48 유지
    n = tnoise(48, 48, 6, seed + 7) * .7 + tnoise(48, 48, 3, seed + 8) * .3
    rz = (n > .74) & ((lx >= 13) | (ly >= 13) | (n > .82)) & (tc.t < 6)
    tc.m = np.where(rz, FM.MID['rust'], tc.m)
    oil = (tnoise(48, 48, 8, seed + 9) > .8) & (hash2(X, Y, seed + 10) > .3)
    tc.t = np.where(oil & (tc.t > 1), tc.t - 1, tc.t)
    tc.grain(.03)
    return tc.img()

def grating(seed=63, depth=True):
    """격자 통로 그레이팅: 2px 강철 띠가 4px 간격 가로·세로로 엮이고(가로 띠가 위, 빛 받은 윗변) 틈 사이로 아래층 어둠과
    흐린 관 줄이 비친다. 16px 마다 받침 보(톤 한 단 진하게)."""
    tc = _tc48(seed)
    for y in range(48):
        for x in range(48):
            lx = x % 4; ly = y % 4
            if ly in (0, 1):                                                       # 가로 띠(위)
                k = 5 if ly == 0 else 3
                if x % 16 == 15: k -= 1
                tc.px(x, y, 'steel', k)
            elif lx in (0,):                                                       # 세로 띠(아래, 어두움)
                tc.px(x, y, 'steel', 2)
            else:                                                                  # 틈: 아래 어둠 + 흐린 관
                k = 1
                if depth and (y % 48) in (18, 19, 20, 21) and lx == 2: k = 2           # 아래층 관(흐린 줄)
                if depth and (x % 48) in (33, 34) and ly == 2: k = 2
                tc.px(x, y, 'dark', k + (1 if _hash(x // 4, y // 4, seed) < .18 else 0))
    for y in range(48):                                                            # 받침 보(16px 마다 세로 띠 굵게)
        for x in (15,):
            for xx in range(x, 48, 16): tc.px(xx, y, 'steel', 1 if (y % 4) > 1 else 2)
    rz = (tnoise(48, 48, 6, seed + 4) > .8)
    tc.m = np.where(rz & (tc.m == FM.MID['steel']) & (tc.t < 5), FM.MID['rust'], tc.m)
    return tc.img()

def lab_tile(seed=65):
    """연구소 바닥: 차가운 회백 비닐 판(16x16, 판마다 톤 ±1 드물게), 줄눈 1px(아래·오른쪽 어둡고 위·왼쪽 밝게), 판 안 잔 점·긁힘,
    네 판 모서리마다 작은 청록 점 판(배수 구멍 아님, 무늬)."""
    tc = _tc48(seed)
    panels(tc, 0, 0, 48, 48, 'lab', 3, 16, 16, face='top', seed=seed, vary=0, joint=2, rivets=False)
    Y, X = np.mgrid[0:48, 0:48]
    hp = hash2(X // 16, Y // 16, seed + 3)
    tc.t = np.where((hp < .15) & (tc.t > 2) & (tc.t < 6), tc.t - 1, tc.t)
    tc.grain(.06, mats=('lab',))
    lx = X % 16; ly = Y % 16
    sc = (hash2(X // 16, Y // 16, seed + 7) < .3) & (np.abs((lx - ly) - int(seed % 5)) == 0) & (lx > 3) & (lx < 12)
    tc.t = np.where(sc & (tc.t > 2), tc.t - 1, tc.t)                                # 가는 긁힘(사선)
    return tc.img()

_FLOORPX = {}
def _reg_floor(tag, im):
    a = np.array(im.convert('RGB'))
    _FLOORPX[tag] = a
    mk_floor(tag, lambda X, Y, a=a: tuple(int(v) for v in a[Y % 48, X % 48]))

_reg_floor('mf_plate', checker_plate())
_reg_floor('mf_grate', grating())
_reg_floor('mf_lab', lab_tile())
_reg_floor('mf_plate_lab', checker_plate(67))                                   # 연구소 승강기 앞(같은 철판, 다른 씨앗)

# ================================================================== 벽 앞면 세 종 (dlib.face_px 사슬에 끼운다)
_CONC_T = FG.tex('conc')[1]            # 칩셋 모래흙 결 → 콘크리트 톤 (fr_ground 와 같은 결)
def conc_wall_k(X, Y, seed):
    """노출 콘크리트 벽판(32x16 엇갈림 = 규약 벽 ���장판 크기): 칩셋 결 톤, 판 줄눈 −1, 판 안 거푸집 구멍 둘(어두운 점 + 아래 빛 점)."""
    row = Y // 16; off = (row % 2) * 16
    lx = (X + off) % 32; ly = Y % 16
    k = int(_CONC_T[Y % 16, X % 16]) - 1
    h = _hash((X + off) // 32, row, seed + 3)
    if h < .2: k -= 1
    if ly == 15 or lx == 31: k = 1
    elif ly == 0 or lx == 0: k += 1
    if ly == 8 and lx in (8, 24): k = 1                                          # 거푸집 구멍
    if ly == 9 and lx in (8, 24): k = 4
    return clampk(k, 1, 6)

def _face_common(c, X, Y, H, capL, capR, top=None):
    if Y == 0: c = top or R('conc', 5)
    elif Y == 1: c = mix(c, R('conc', 5), .3)
    elif Y == 2: c = mul(c, .66)
    elif Y == 3: c = mul(c, .8)
    elif Y == 4: c = mul(c, .9)
    if Y == H - 1: c = DK
    elif Y == H - 2: c = mul(c, .55)
    if capL and X % 16 == 0: c = mix(c, R('conc', 6), .3)
    if capL and X % 16 == 1: c = mix(c, R('conc', 6), .1)
    if capR and X % 16 == 15: c = mul(c, .55)
    if capR and X % 16 == 14: c = mul(c, .8)
    return c

def kick_plate(X, Y, H, seed, mat='steel'):
    """벽 밑 강철 걸레받이(아래 9px): 윗모 빛, 리벳 16px 마다, 맨 아래 2px 경고 띠(벗겨짐)."""
    ly = Y - (H - 9)
    if ly < 0: return None
    if ly == 0: return R(mat, 5)
    if ly == 1: return R(mat, 3)
    if ly >= 6:
        on = ((X + Y) // 4) % 2 == 0
        if _hash(X // 2, Y, seed + 41) < .12: on = not on
        return R('warn', 4 if ly == 6 else 3) if on else R('cable', 2)
    k = 3 if (X % 32) < 30 else 2
    if X % 16 == 2 and ly == 3: k = 6
    if X % 16 == 3 and ly == 4: k = 1
    return R(mat, k)

def conc_face(X, Y, H, seed):
    kp = kick_plate(X, Y, H, seed)
    if kp is not None: return kp
    k = conc_wall_k(X, Y, seed) - 1                                             # 벽은 바닥보다 어둡다
    c = R('conc', k)
    # 물 자국(위에서 흘러내린 세로 얼룩) — 칸 안에서 끝난다
    if _hash(X // 3, 0, seed + 9) < .14 and Y > 6 and _hash(X // 3, Y // 5, seed + 10) < .7 - Y / max(1, H): c = mul(c, .86)
    return c

def pipe_face(X, Y, H, seed):
    """관 벽: 콘크리트 판 앞에 가로 관 셋 — 굵은 관(지름 12, 위), 놋쇠 가는 관(지름 6), 강철 가는 관(지름 6) — 과 32px 마다 받침쇠.
    가로 관의 이음 테는 16px 마다(칸 경계와 맞아 칸을 섞어도 끊기지 않는다). 칸 씨앗 2·5 는 바닥으로 내려가는 세로 관을 하나 더한다."""
    kp = kick_plate(X, Y, H, seed)
    if kp is not None: return kp
    lx = X % 16
    def cylc(t, mat, flange):
        k = fcyl(t)
        if flange: k = clampk(k + (1 if lx == 7 else (-1 if lx == 9 else 0)), 1, 6)
        return R(mat, k)
    big0 = 6; small0 = 22; small1 = 31
    if seed % 6 in (2, 5) and 10 <= lx <= 15 and Y >= big0 + 12:                   # 세로 관(칸 안)
        t = (lx - 10 + .5) / 6
        c = cylc(t, 'steel', False)
        if (Y - (big0 + 12)) % 16 in (0, 1): c = R('steel', 5 if (Y - big0) % 16 == 0 else 2)
        return c
    if big0 <= Y < big0 + 12: return cylc((Y - big0 + .5) / 12, 'steel', lx in (7, 8, 9))
    if Y == big0 + 12: return R('conc', 1)                                       # 관 밑 그늘
    if small0 <= Y < small0 + 6: return cylc((Y - small0 + .5) / 6, 'brass', lx in (7, 8))
    if Y == small0 + 6: return R('conc', 1)
    if small1 <= Y < small1 + 6 and H > 40: return cylc((Y - small1 + .5) / 6, 'steel', lx in (7, 8))
    if Y == small1 + 6 and H > 40: return R('conc', 1)
    c = R('conc', conc_wall_k(X, Y, seed) - 2)
    if X % 32 in (14, 15, 16) and Y < big0 + 14: c = R('steel', 2 if X % 32 != 14 else 4)   # 받침쇠
    return c

def lab_face(X, Y, H, seed):
    """연구소 벽: 차가운 흰 외장판(32x16 엇갈림, 판 줄눈 규약), 가운데 청록 띠 2px + 아래 어두운 띠, 아래 걸레받이(강철)."""
    kp = kick_plate(X, Y, H, seed, 'steel')
    if kp is not None and Y >= H - 6:
        return R('lab', 2) if Y < H - 3 else R('lab', 1)
    if kp is not None: return R('lab', 3) if Y > H - 8 else R('lab', 5)
    row = Y // 16; off = (row % 2) * 16; lx = (X + off) % 32; ly = Y % 16
    k = 4 if _hash((X + off) // 32, row, seed + 3) < .7 else 3
    if ly == 15 or lx == 31: k = 2
    elif ly == 0 or lx == 0: k += 1
    if _hash(X, Y, seed + 4) < .04: k -= 1
    band = H // 2
    if Y in (band, band + 1): return R('cyan', 3 if Y == band else 2)
    if Y == band + 2: return R('lab', 2)
    return R('lab', k)

FACE_FN = {'mf_conc': conc_face, 'mf_pipe': pipe_face, 'mf_lab': lab_face}
for st in FACE_FN: dlib.FACE_BASE[st] = R('conc', 3)
_prev_face = dlib.face_px
def _face_px(style, X, Y, H, seed, capL, capR):
    if style not in FACE_FN: return _prev_face(style, X, Y, H, seed, capL, capR)
    c = FACE_FN[style](X, Y, H, seed)
    top = R('lab', 6) if style == 'mf_lab' else None
    return _face_common(c, X, Y, H, capL, capR, top)
dlib.face_px = _face_px

def face_sample(style, w, h):
    return compose_(w, h, lambda i, j: dlib.face_tile(style, None, j, int(_hash(i + 3, j, 3) * 6), i == 0, i == w - 1, h * T))

# ================================================================== 천장(벽 너머): 콘크리트 두께 띠 + 강철 모 앵글, 속은 어둠
VOID = [(10, 10, 16), (14, 14, 22), (20, 20, 30)]
_mc_cache = {}
def mf_ceiling(open8, seed=0, lab=False):
    key = (open8, seed % 4, lab)
    if key in _mc_cache: return _mc_cache[key]
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
            r = _hash(X, Y, 761)
            return VOID[0] if r < .55 else (VOID[1] if r < .93 else VOID[2])
        d, side = b
        if d <= 1:                                                                # 강철 모 앵글(빛 받는 쪽 밝게)
            k = (6 if d == 0 else 4) if side in ('N', 'W') else (4 if d == 0 else 3)
            if (X + Y) % 8 == 3 and d == 1: k = 6 if side in ('N', 'W') else 5     # 리벳
            return R('lab' if lab else 'steel', k)
        k = int(_CONC_T[Y % 16, X % 16]) - (0 if side in ('N', 'W') else 1)
        c = R('lab' if lab else 'conc', clampk(k, 2, 5))
        if d == t - 1: c = DK
        elif d == t - 2: c = mix(c, DK, .3)
        return c
    im = mk(f); _mc_cache[key] = im; return im

def ceiling_sample(lab=False):
    def cf(i, j):
        o8 = (j > 0, i < 2, j < 2, i > 0, j > 0 and i < 2, j < 2 and i < 2, j < 2 and i > 0, j > 0 and i > 0)
        return mf_ceiling((False,) * 8 if (i == 1 and j == 1) else o8, i + j, lab)
    return compose_(3, 3, cf)

# ================================================================== 구덩이(기계 구덩이): 북쪽 가장자리 = 바닥판 두께 + 안쪽 콘크리트 벽,
# 그 아래 어둠 속 아래층 관·보. 서·동 가장자리 = 1~2px 테. 걸을 수 없다.
_pit_cache = {}
def pit_tile(N, E, S, W, X0, Y0, rim_mat='steel'):
    """N/E/S/W = 그 쪽 이웃도 구덩이인가. X0,Y0 = 전역 화소 좌표(아래층 무늬 이음)."""
    key = (N, E, S, W, X0 % 48, Y0 % 48, rim_mat)
    if key in _pit_cache: return _pit_cache[key]
    tc = TC(16, 16, 7)
    for y in range(16):
        for x in range(16):
            X = X0 + x; Y = Y0 + y
            k = 1 if _hash(X, Y, 771) < .8 else 2
            mat = 'dark'
            if (Y % 32) in (20, 21, 22, 23, 24): mat, k = 'steel', (1 if (Y % 32) in (20, 24) else 2)   # 아래층 가로 관
            if (X % 48) in (10, 11, 12) and (Y % 32) > 24: mat, k = 'steel', 1                        # 세로 보
            if (Y % 32) == 22 and (X % 32) == 5: mat, k = 'steel', 3
            tc.px(x, y, mat, k)
            if not N:                                                               # 바닥판 두께 + 안쪽 벽
                if y == 0: tc.px(x, y, rim_mat, 5)
                elif y == 1: tc.px(x, y, rim_mat, 3)
                elif y == 2: tc.px(x, y, rim_mat, 2)
                elif y < 9:
                    kk = int(_CONC_T[(Y) % 16, X % 16]) - 2 - (y - 3) // 2
                    tc.px(x, y, 'conc', clampk(kk, 1, 4))
                elif y == 9: tc.px(x, y, 'dark', 1)
            if not W and x == 0: tc.px(x, y, rim_mat, 4 if N or y > 2 else 5)
            if not W and x == 1 and (N or y > 2): tc.px(x, y, 'conc', 2)
            if not E and x == 15: tc.px(x, y, rim_mat, 2)
            if not S and y == 15: tc.px(x, y, rim_mat, 3)
    im = tc.img(); _pit_cache[key] = im; return im

def pit_sample():
    cells = {(i, j) for i in range(3) for j in range(3)}
    im = new(48, 48)
    for (i, j) in cells:
        im.alpha_composite(pit_tile((i, j - 1) in cells, (i + 1, j) in cells, (i, j + 1) in cells, (i - 1, j) in cells, i * 16, j * 16), (i * 16, j * 16))
    return im

# ================================================================== 작은 도우미 (TC 위에)
def screen(tc, x0, y0, x1, y1, mat='scr', on=True, seed=0, bars=True):
    """모니터 화면(글자 없음): 어두운 바탕 + 가로 주사선 + 막대 그래프/파형 무늬. 꺼진 화면은 어두운 유리 + 빛 반사 하나."""
    for y in range(int(y0), int(y1)):
        for x in range(int(x0), int(x1)):
            if not on:
                k = 1 if (x + y - x0 - y0) != 3 else 3
                tc.px(x, y, 'glass', k); continue
            k = 2 if (y - y0) % 2 == 0 else 1
            tc.px(x, y, mat, k)
    if on:
        w = int(x1 - x0); h = int(y1 - y0)
        if bars and w >= 5:
            for i in range(1, w - 1, 2):
                bh = 1 + int(_hash(i, seed, 51) * max(1, h - 2))
                for j in range(bh): tc.px(x0 + i, y1 - 2 - j, mat, 4 if j < bh - 1 else 5)
        else:
            for i in range(w):
                yy = int(y0 + h / 2 + math.sin(i * 1.3 + seed) * (h / 2 - 1.2))
                tc.px(x0 + i, yy, mat, 5)
        tc.px(x0, y0, mat, 4)

def lamp(tc, x, y, col='redl', on=True, big=False):
    """작은 표시등 한 점(켜짐 = 5 + 빛 점 6, 꺼짐 = 2)."""
    if on:
        tc.px(x, y, col, 5); tc.px(x + 1, y, col, 4)
        if big: tc.px(x, y + 1, col, 4); tc.px(x + 1, y + 1, col, 3)
        tc.px(x, y, col, 6)
    else:
        tc.px(x, y, col, 2); tc.px(x + 1, y, col, 2)
        if big: tc.px(x, y + 1, col, 1); tc.px(x + 1, y + 1, col, 1)

def button_row(tc, x0, y, n, seed=0, step=3):
    cols = ['redl', 'amber', 'cyan', 'steel']
    for i in range(n):
        c = cols[int(_hash(i, y, seed + 61) * 4)]
        k = 5 if c != 'steel' else 4
        tc.px(x0 + i * step, y, c, k); tc.px(x0 + i * step + 1, y, c, k - 2); tc.px(x0 + i * step, y + 1, c, k - 2)

def bolt(tc, x, y, mat='steel'): tc.px(x, y, mat, 6); tc.px(x + 1, y + 1, mat, 1)

def shade_floor(im, cx, cy, rx, ry, a=70): return FB.shadow_under(im, cx, cy, rx, ry, a)

def fin(tc_or_im, k=.6, shadow=None):
    im = tc_or_im.img() if isinstance(tc_or_im, TC) else tc_or_im
    im = pz.fin(im, k)
    if shadow: im = FB.shadow_under(im, *shadow)
    return im

def pad(im): return FB.pad16(im)
def flip(im): return im.transpose(Image.FLIP_LEFT_RIGHT)
