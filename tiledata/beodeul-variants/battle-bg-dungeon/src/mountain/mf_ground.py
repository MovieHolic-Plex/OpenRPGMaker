# 산악 요새 — 땅·절벽·오토타일. 버들항 파이프라인(city_v6) 재료로만 그린다. 결정적(같은 입력 = 같은 그림).
#   암반 바닥: 칩셋 돌 램프(terrain.ST, 7단)로 판돌 모양 암반(줄눈=균열, 윗왼 밝은 모·아래오른 어두운 모, 잔돌·잔 풀·이끼 점).
#   자갈길: 흙(PAL dirt) 위 자갈 알(돌 램프). 풀: 버들항 칩셋 풀 타일(0,128)·(304,304). 눈: varlib 눈 램프(7단).
#   절벽 앞면: terrain.render 의 바위 버팀(세로 갈비) 결을 돌 램프로 — 지층 금, 턱에 쌓인 눈, 발치 잔돌.
import os, sys, math
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '..', '..', '..'))
import numpy as np
from PIL import Image
import mfwl as wl                       # city_v6 경로·팔레트 등록 (초원 하이로드 wl 사본)
from mfwl import hash2, tnoise, tnoise1, edge_depth, sheet_from_cells
import terrain, pz
from roman import ST, mul, mix
import varlib                          # noqa: F401  (눈 램프 등록)
from px2 import PAL, hx

SN = [hx(c) for c in PAL['snow']]
LAWN = [(63, 122, 44), (75, 130, 50), (87, 159, 53), (88, 160, 53), (115, 184, 62), (143, 210, 74)]
MOSS = [(28, 38, 38), (20, 58, 39), (32, 80, 48), (89, 85, 19), (75, 130, 50), (157, 156, 51)]
DIRT = [hx(c) for c in ('#2d231e', '#4c3b30', '#6e5b49', '#816a56', '#8a745c', '#9e8b64', '#bcab82')]   # 버들항 흙길 흙(초원 하이로드 earth 램프)
A = lambda c: np.array(c, np.uint8)
STa = np.array(ST, np.uint8)
# 산 바위(새 재료, 7단: 0=윤곽, 1~6): 칩셋 돌 램프와 같은 밝기 간격, 푸른 그늘·누런 빛 쪽으로 아주 조금 옮긴 회색
MR = [hx(c) for c in ('#1a1d24', '#2c3038', '#43474c', '#5d605f', '#7e7f7a', '#a2a199', '#c7c4b8')]
MRa = np.array(MR, np.uint8)
PAL['mrock'] = ['#1a1d24', '#2c3038', '#43474c', '#5d605f', '#7e7f7a', '#a2a199', '#c7c4b8']
CHIP = np.array(terrain.CH.convert('RGB'))
def chiptex(tx, ty): return CHIP[ty:ty + 16, tx:tx + 16]

# ---------------------------------------------------------------- 판돌 모양 셀(주기 가능) — 암반 판·자갈·포석에 쓴다
def worley(Wp, Hp, cell, seed, per=None, jit=0.8):
    """지터 격자 보로노이. 반환 (id HxW, d1, d2). per=(px,py) 주기(cell 의 배수)면 이어 붙여도 이음새 없음."""
    gw = (per[0] if per else Wp) // cell + 2; gh = (per[1] if per else Hp) // cell + 2
    Y, X = np.mgrid[0:Hp, 0:Wp]
    gx = X // cell; gy = Y // cell
    best1 = np.full((Hp, Wp), 1e9); best2 = np.full((Hp, Wp), 1e9); bid = np.zeros((Hp, Wp), np.int64)
    for oy in (-1, 0, 1):
        for ox in (-1, 0, 1):
            cx = gx + ox; cy = gy + oy
            if per:
                kx = cx % (per[0] // cell); ky = cy % (per[1] // cell)
            else:
                kx, ky = cx, cy
            fx = (cx + 0.5 + (hash2(kx, ky, seed) - 0.5) * jit) * cell
            fy = (cy + 0.5 + (hash2(kx, ky, seed + 1) - 0.5) * jit) * cell
            d = np.hypot((X + 0.5 - fx) * 1.0, (Y + 0.5 - fy) * 1.25)          # 가로로 조금 납작한 판
            idv = kx * 7919 + ky * 104729
            m1 = d < best1
            best2 = np.where(m1, best1, np.minimum(best2, d))
            bid = np.where(m1, idv, bid); best1 = np.where(m1, d, best1)
    return bid, best1, best2

def _shift(m, dx, dy):
    o = np.zeros_like(m)
    H, W = m.shape
    ys = slice(max(0, dy), H + min(0, dy)); yd = slice(max(0, -dy), H + min(0, -dy))
    xs = slice(max(0, dx), W + min(0, dx)); xd = slice(max(0, -dx), W + min(0, -dx))
    o[ys, xs] = m[yd, xd]
    return o

def rock_floor(Wp, Hp, seed=7, per=None):
    """산 암반 바닥(산 바위 램프 MR): 넓은 바위 판(판마다 톤 4·조금 밝음·조금 어두움) 사이 일부만 금이 간다(열린 금 줄, 닫힌 판석 아님).
    금 1화소(2), 금 아래·왼 밝은 모(5), 위·오른 어두운 모(3). 박힌 돌(반지름 2~3: 윗왼 5·아래오른 3, 밑 그늘), 잔 점, 금 사이 잔 풀."""
    bid, d1, d2 = worley(Wp, Hp, 28 if not per else 24, seed, per)
    b2 = worley.second
    pair = hash2(np.minimum(bid, b2) % 100003, np.maximum(bid, b2) % 100019, seed + 77)
    Y, X = np.mgrid[0:Hp, 0:Wp]
    PX = X % per[0] if per else X; PY = Y % per[1] if per else Y
    along = hash2(PX // 6, PY // 6, seed + 78)                                   # 금이 군데군데 끊긴다
    crack = ((d2 - d1) < 1.1) & (pair > 0.55) & (along > 0.3)
    hx_ = lambda s_: hash2(PX, PY, s_)
    hb = hash2(bid, 3, seed + 2)
    m4, m3, m5 = MRa[4].astype(int), MRa[3].astype(int), MRa[5].astype(int)
    rgb = np.where((hb < 0.25)[..., None], (m4 * 0.8 + m3 * 0.2).astype(int), np.where((hb > 0.8)[..., None], (m4 * 0.8 + m5 * 0.2).astype(int), m4))
    # 판 속 결: 2x2 덩이 어둡게 + 낱 점
    g2 = hash2(PX // 2, PY // 2, seed + 6); g = hx_(seed + 5)
    rgb = np.where(((g2 > 0.92) & (g > 0.25))[..., None], (rgb * 0.88).astype(int), rgb)
    rgb = np.where((g > 0.972)[..., None], m5, rgb)
    rgb = np.where((g < 0.025)[..., None], m3, rgb)
    below = _shift(crack, 0, 1) | _shift(crack, 1, 0)
    above = _shift(crack, 0, -1) | _shift(crack, -1, 0)
    rgb = np.where((above & ~crack)[..., None], m3, rgb)
    rgb = np.where((below & ~crack & ~above)[..., None], m5, rgb)
    rgb = np.where(crack[..., None], MRa[2].astype(int), rgb)
    # 박힌 돌
    sid, s1, _ = worley(Wp, Hp, 13, seed + 30, per, jit=0.9)
    hs = hash2(sid, 1, seed + 31); rr = 1.6 + hash2(sid, 2, seed + 32) * 1.6
    stone = (s1 < rr) & (hs > 0.80) & ~crack
    st_top = stone & ~_shift(stone, 0, 1)
    st_l = stone & ~_shift(stone, 1, 0)
    st_bot = stone & ~_shift(stone, 0, -1)
    st_r = stone & ~_shift(stone, -1, 0)
    rgb = np.where(stone[..., None], MRa[4].astype(int), rgb)
    rgb = np.where((st_bot | st_r)[..., None], MRa[3].astype(int), rgb)
    rgb = np.where((st_top | st_l)[..., None], MRa[5].astype(int), rgb)
    rgb = np.where((st_top & st_l)[..., None], MRa[6].astype(int), rgb)
    sh = (_shift(stone, 0, 1) | _shift(stone, 1, 1)) & ~stone
    rgb = np.where(sh[..., None], MRa[2].astype(int), rgb)
    # 금 사이 잔 풀: 금 위로 1~3화소
    tuft = crack & (hx_(seed + 9) > 0.86)
    for j in range(3):
        t = _shift(tuft, 0, -j) & (hx_(seed + 10 + j) > 0.2 + 0.25 * j)
        rgb = np.where(t[..., None], np.array(LAWN[1 + j]), rgb)
    # 잔돌 알(2x1)
    pe = (hx_(seed + 15) > 0.988) & ~crack & ~stone
    rgb = np.where(pe[..., None], MRa[6].astype(int), rgb)
    rgb = np.where((_shift(pe, 1, 0) & ~crack)[..., None], MRa[5].astype(int), rgb)
    rgb = np.where((_shift(pe, 0, 1) | _shift(pe, 1, 1))[..., None], MRa[2].astype(int), rgb)
    return rgb.astype(np.uint8)

def gravel(Wp, Hp, seed=11, per=None):
    """자갈길: 다진 흙(dirt 3·4 덩이) 위 둥근 자갈 알(지름 2~4px, 돌 램프 3~4, 윗왼 한 화소 밝음, 아래 흙 그늘). 알은 듬성듬성(약 4할)."""
    Y, X = np.mgrid[0:Hp, 0:Wp]
    PX = X % per[0] if per else X; PY = Y % per[1] if per else Y
    n = tnoise(per[0], per[1], 8, seed)[PY, PX] if per else tnoise(Wp - Wp % 8 + 8, Hp - Hp % 8 + 8, 8, seed)[:Hp, :Wp]
    base = np.where(n > 0.5, 4, 3)
    rgb = np.array(DIRT, int)[base]
    h = hash2(PX, PY, seed + 1)
    rgb = np.where((h > 0.95)[..., None], np.array(DIRT[5]), rgb)
    rgb = np.where((h < 0.05)[..., None], np.array(DIRT[2]), rgb)
    bid, d1, d2 = worley(Wp, Hp, 5, seed + 3, per, jit=0.85)
    hs = hash2(bid, 1, seed + 4); hr = hash2(bid, 2, seed + 5)
    r = 1.1 + hr * 1.2
    stone = (d1 < r) & (hs > 0.42)
    tone = np.where(hs > 0.85, 4, 3)
    rgb = np.where(stone[..., None], STa[tone].astype(int), rgb)
    top = stone & ~_shift(stone, 0, 1) & ~_shift(stone, 1, 0)                 # 윗왼 모 밝게
    rgb = np.where(top[..., None], STa[np.clip(tone + 2, 0, 6)].astype(int), rgb)
    bot = stone & ~_shift(stone, 0, -1)                                        # 아랫줄 어둡게
    rgb = np.where(bot[..., None], STa[np.clip(tone - 1, 0, 6)].astype(int), rgb)
    sh = _shift(stone, 0, 1) & ~stone
    rgb = np.where(sh[..., None], np.array(DIRT[1]), rgb)
    return rgb.astype(np.uint8)

def lawn(Wp, Hp, seed=3):
    """버들항 칩셋 풀(0,128) + 밝은 풀(304,304) 덩이 섞기 — ground.render 와 같은 재료."""
    a = np.tile(chiptex(0, 128), (Hp // 16 + 1, Wp // 16 + 1, 1))[:Hp, :Wp]
    b = np.tile(chiptex(304, 304), (Hp // 16 + 1, Wp // 16 + 1, 1))[:Hp, :Wp]
    n = tnoise(Wp - Wp % 32 + 32, Hp - Hp % 32 + 32, 32, seed)[:Hp, :Wp]
    d = hash2(*np.mgrid[0:Hp, 0:Wp][::-1], seed + 1) * 0.12
    return np.where(((n + d) > 0.62)[..., None], b, a)

def flag_court(Wp, Hp, seed=21, per=None):
    """앞뜰 포석: 버들항 성 포석(칩셋 192,176 창백한 판석) 그대로 — 큰 판석 줄 맞춤."""
    t = chiptex(192, 176)
    return np.tile(t, (Hp // 16 + 1, Wp // 16 + 1, 1))[:Hp, :Wp]

def snow_tex(Wp, Hp, seed=31, per=None):
    """쌓인 눈: 눈 램프 5 바탕, 바람결 물결(가로 긴 4 톤 줄), 반짝 점(6), 옅은 그늘 덩이(4)."""
    Y, X = np.mgrid[0:Hp, 0:Wp]
    PX = X % per[0] if per else X; PY = Y % per[1] if per else Y
    rgb = np.zeros((Hp, Wp, 3), int) + np.array(SN[5])
    w = tnoise1(per[0] if per else Wp + 16 - Wp % 16, 16, seed)[PX]
    ripple = ((PY + np.rint(w * 6).astype(int)) % 9 == 0) & (hash2(PX // 5, PY, seed + 1) > 0.35)
    rgb = np.where(ripple[..., None], np.array(SN[4]), rgb)
    h = hash2(PX, PY, seed + 2)
    rgb = np.where((h > 0.975)[..., None], np.array(SN[6]), rgb)
    rgb = np.where((h < 0.02)[..., None], np.array(SN[4]), rgb)
    return rgb.astype(np.uint8)

# ---------------------------------------------------------------- 눈 덮개 마스크 가장자리: 아래·오른 그늘(3), 바로 안쪽 4, 밖 1화소 윤곽 없음(눈은 부드럽다)
from scipy import ndimage as ndi
def jag_mask(cellmask, seed, amp=5, fine=2, blur=6.0):
    """칸 마스크 → 화소 마스크: 칸 모양을 흐려 둥글린 뒤 잡음으로 흔든 문턱 — 네모 덩이가 아니라 자연 덩이 가장자리."""
    m0 = np.kron(np.array(cellmask, float), np.ones((16, 16))); Hp, Wp = m0.shape
    def tn(sc, s_):
        return tnoise(Wp - Wp % sc + sc, Hp - Hp % sc + sc, sc, s_)[:Hp, :Wp]
    f = ndi.gaussian_filter(m0, blur)
    n = (tn(16, seed) - 0.5) * 0.06 * amp + (tn(4, seed + 1) - 0.5) * 0.05 * fine
    return (f + n) > 0.5

def scree_layer(mask_px, seed=61):
    """자갈밭(투명 덧그림): 산 바위 잔돌(반지름 1~2, 윗왼 밝음·아래 그늘)이 빽빽한 곳. 길이 아닌 비탈의 돌 부스러기."""
    Hp, Wp = mask_px.shape
    bid, d1, d2 = worley(Wp, Hp, 5, seed, None, jit=0.9)
    hs = hash2(bid, 1, seed + 1); r = 1.0 + hash2(bid, 2, seed + 2) * 1.3
    edge = ndi.gaussian_filter(mask_px.astype(float), 3)
    stone = (d1 < r) & mask_px & (hs < 0.25 + 0.6 * edge)
    tone = np.where(hs > 0.6, 4, 3)
    rgb = MRa[tone].astype(int)
    top = stone & ~_shift(stone, 0, 1) & ~_shift(stone, 1, 0)
    rgb = np.where(top[..., None], MRa[np.clip(tone + 2, 0, 6)].astype(int), rgb)
    bot = stone & ~_shift(stone, 0, -1)
    rgb = np.where(bot[..., None], MRa[np.clip(tone - 1, 0, 6)].astype(int), rgb)
    sh = _shift(stone, 0, 1) & ~stone
    out = np.zeros((Hp, Wp, 4), np.uint8)
    out[..., :3] = np.where(sh[..., None], MRa[2], rgb).astype(np.uint8)
    out[..., 3] = np.where(stone | sh, 255, 0)
    return Image.fromarray(out, 'RGBA')

def snow_layer(mask_px, seed=41):
    """눈 덮개(RGBA): 위·왼 가장자리 밝은 테(6), 아래·오른 가장자리 그늘 띠(3→4), 속은 snow_tex."""
    Hp, Wp = mask_px.shape
    rgb = snow_tex(Wp, Hp, seed).astype(int)
    m = mask_px
    e_low = m & ~_shift(m, 0, -1)          # 아래 이웃이 없는 화소(아래 가장자리)
    e_low2 = m & ~_shift(m, 0, -2)
    e_right = m & ~_shift(m, -1, 0)
    e_top = m & ~_shift(m, 0, 1)
    rgb = np.where(e_low2[..., None], np.array(SN[4]), rgb)
    rgb = np.where((e_low | e_right)[..., None], np.array(SN[3]), rgb)
    rgb = np.where((e_top & ~e_low)[..., None], np.array(SN[6]), rgb)
    a = np.where(m, 255, 0).astype(np.uint8)
    # 아래 가장자리 밖 1화소 = 바위 위 눈 그림자(어둡게 반투명) 대신 SN[2] 점선
    out = np.dstack([rgb.astype(np.uint8), a])
    sh = _shift(m, 0, 1) & ~m
    out[sh] = np.array(list(SN[2]) + [150], np.uint8)
    return Image.fromarray(out, 'RGBA')

def lawn_layer(mask_px, seed=51):
    """풀 덩이(RGBA): 칩셋 풀, 가장자리 1화소 어두운 풀(바위와 닿는 곳), 밖으로 잔 풀잎이 솟는다."""
    Hp, Wp = mask_px.shape
    rgb = lawn(Wp, Hp, seed).astype(int)
    m = mask_px
    edge = m & ~ndi.binary_erosion(m, iterations=1, border_value=1)
    rgb = np.where(edge[..., None], np.array(LAWN[0]), rgb)
    Y, X = np.mgrid[0:Hp, 0:Wp]
    near = ndi.binary_dilation(m, iterations=2) & ~m
    tuft = near & (hash2(X, Y, seed + 1) > 0.80)
    a = np.where(m | tuft, 255, 0).astype(np.uint8)
    rgb = np.where(tuft[..., None], np.array(LAWN)[(hash2(X, Y, seed + 2) * 4).astype(int).clip(0, 3) + 1], rgb)
    return Image.fromarray(np.dstack([rgb.astype(np.uint8), a]), 'RGBA')

# ---------------------------------------------------------------- 바위 절벽 앞면
_TL = None
def _tile_tone(tx, ty):
    t = CHIP[ty:ty + 16, tx:tx + 16].astype(int)
    lum = t[..., 0] * 0.3 + t[..., 1] * 0.59 + t[..., 2] * 0.11
    return (lum - lum.mean()) / (lum.std() + 1e-6)          # 칩셋 바위 결(표준화)
ROCKT = [_tile_tone(336, 336), _tile_tone(352, 352), _tile_tone(352, 336)]
def cliff_px(X, Y, fy, FH, cx, cy, seed=5, snowy=0.0):
    """절벽 앞면 한 화소 색(산 바위 램프 MR). terrain.render 의 자연 바위와 같은 구조:
    세로 버팀 갈비(약 7px, 흔들림) — 갈비 왼쪽 밝음·오른쪽 그늘, 사이 어두운 금 — 위에 칩셋 바위 타일의 결을 약하게 얹는다.
    갈비 몇 개는 가로 금(지층)이 하나씩, 위 턱 밑 그늘 4px, 발치 어둠."""
    lx, ly = X % 16, Y % 16
    tt = ROCKT[1 + int(_hash(cx, cy, 5) * 2)][(ly + cx * 5) % 16, lx]
    xx = X + int(3 * vnoise(0, Y * 0.08, 9, 78)); rib = int(xx / 7 + _hash(xx // 7, 0, 3) * 0.6); u = (xx % 7) / 7
    shade = 0.36 * (0.5 - u) + 0.20 * (_hash(rib, cy // 2, 4) - 0.5)
    t = 3.25 + shade * 4.6 + tt * 0.55 + 0.45 * (fy / max(1, FH - 1))
    if u > 0.86: t = 1.7 + tt * 0.3
    sc = int(_hash(rib, 1, seed + 3) * 40)                   # 갈비마다 가로 금 하나(위치 다름)
    if (fy + sc) % 23 == 0 and u < 0.86: t = 2.0
    elif (fy + sc) % 23 == 1 and u < 0.86: t += 0.9
    if fy < 4: t = min(t, 1.8 + fy * 0.4)
    if fy >= FH - 3: t = 1.4 if fy == FH - 1 else t - 1.0
    c = MR[int(max(1, min(6, round(t))))]
    if fy >= FH - 3 and (X * 7 + Y * 3) % 11 < 2: c = MR[3]
    return c

def stair_rock(px, x0, y0, w, rows=3, top=0):
    """바위를 깎은 돌계단: terrain.stair 와 같은 4px 디딤판·챌판, 옆은 깎인 바위 볼(돌 램프)."""
    X0, Y0 = x0 * 16, y0 * 16 - 3; W = w * 16; Hh = rows * 16 + 3
    for Y in range(Y0, Y0 + Hh):
        for X in range(X0, X0 + W):
            lx = X - X0; s = (Y - Y0) % 5
            if lx < 3 or lx >= W - 3:
                e = lx if lx < 3 else W - 1 - lx
                c = ST[5] if e == 1 else (ST[3] if e == 2 else ST[1])
                if lx >= W - 3: c = ST[3] if e == 1 else (ST[2] if e == 2 else ST[1])
            else:
                c = ST[6] if s == 0 else (ST[5] if s < 3 else ST[2])
                if lx == 3 or lx == W - 4: c = mul(c, 0.72)
                if s in (1, 2) and wl.hash2(X, Y, 61) > 0.9: c = ST[4]
            if Y >= Y0 + Hh - 2: c = ST[1]
            px[X, Y] = tuple(c) + (255,)

# ---------------------------------------------------------------- 표본(3x3칸, 이어 붙여도 이음새 없음)
def sample(fn, seed):
    return Image.fromarray(fn(48, 48, seed, per=(48, 48)), 'RGB').convert('RGBA')

def ground_rock(): return sample(rock_floor, 7)
def ground_gravel(): return sample(gravel, 11)
def ground_snow(): return sample(snow_tex, 31)
def ground_flag():
    return Image.fromarray(flag_court(48, 48), 'RGB').convert('RGBA')

def face_cliff(w=48, rows=3, snowy=0.35):
    """절벽 앞면 표본: 위 1줄 = 바위 윗면 가장자리(암반+밝은 턱), 아래 rows 줄 앞면."""
    H = 16 + rows * 16; o = Image.new('RGBA', (w, H)); px = o.load()
    top = rock_floor(w, 16, 7, per=(48, 16))
    for y in range(16):
        for x in range(w):
            c = tuple(int(v) for v in top[y, x])
            if y >= 13: c = ST[6] if y == 13 else (ST[5] if y == 14 else ST[3])
            px[x, y] = c + (255,)
    FH = rows * 16
    for fy in range(FH):
        for x in range(w):
            c = cliff_px(x, fy, FH, snowy=snowy)
            if x < 1 or x >= w - 1: pass
            px[x, 16 + fy] = tuple(c) + (255,)
    return o

# ---------------------------------------------------------------- 16변형 오토타일
LIM = 2.0
def gravel_shader(X, Y, m, n, seed):
    """자갈길(아래층 투명 덧그림): 속 = gravel, 가장자리 테 = 어두운 흙 + 굵은 자갈, 밖으로 자갈 알이 흩어진다."""
    g = gravel(16, 16, 11, per=(16, 16)).astype(int)
    rgb = g.copy()
    rim = (m >= 0) & (m < 1.0); rim2 = (m >= 1.0) & (m < 2.0)
    rgb = np.where(rim[..., None], np.array(DIRT[1]), rgb)
    rgb = np.where((rim2 & (hash2(X, Y, seed) > 0.5))[..., None], np.array(DIRT[2]), rgb)
    out = (m < 0) & (m > -2.2) & (hash2(X, Y, seed + 7) > 0.84)                  # 밖으로 튄 자갈 알
    rgb = np.where(out[..., None], np.where((hash2(X, Y, seed + 8) > 0.5)[..., None], STa[5].astype(int), STa[4].astype(int)), rgb)
    return rgb, (m >= 0) | out

def _auto(shader, seed, inset, jag, rad):
    cells = []
    X, Y = np.meshgrid(np.arange(16), np.arange(16))
    for n in range(16):
        m, miss = edge_depth(n, inset, jag, rad, seed)
        rgb, alpha = shader(X, Y, m, n, seed)
        a = np.where(alpha, 255, 0).astype(np.uint8)
        cells.append(Image.fromarray(np.dstack([np.asarray(rgb).astype(np.uint8), a]), 'RGBA'))
    return sheet_from_cells(cells)

def autotile_gravelpath(): return _auto(gravel_shader, 17, 2.4, 1.8, 6.0)

def chasm_cell(n, seed=23):
    """골짜기(낭떠러지) 16변형. 칸 = 깊은 틈(막힘). 위 이웃 없음(북쪽이 땅) = 맞은편 바위벽이 아래로 어두워지며 보인다(3/4),
    아래 이웃 없음 = 가까운 쪽 땅의 가장자리 턱(밝은 모 + 어두운 금), 왼·오른 이웃 없음 = 깎인 바위 볼(2~4화소).
    이웃이 있는 쪽은 열려 이어진다. 바닥은 어둠 + 옅은 안개 점."""
    o = Image.new('RGBA', (16, 16)); px = o.load()
    hasN, hasE, hasS, hasW = bool(n & 1), bool(n & 2), bool(n & 4), bool(n & 8)
    jW = tnoise1(16, 4, seed + 3); jE = tnoise1(16, 4, seed + 4); jS = tnoise1(16, 4, seed + 2); jN = tnoise1(16, 4, seed + 1)
    DK = [(10, 12, 18), (16, 19, 26), (24, 28, 36), (34, 39, 48)]
    for y in range(16):
        for x in range(16):
            # 기본: 어둠(위가 열려 있으면 위쪽이 조금 밝다 — 위 칸 벽의 연속)
            c = DK[0] if hasN else DK[1]
            if (x * 7 + y * 13) % 23 == 0 and wl.hash2(x, y, seed) > 0.5: c = DK[2]          # 안개 점
            if not hasN:
                wall_h = 11 + int(round((jN[x] - 0.5) * 3))
                if y < wall_h:
                    fy = y
                    cc = cliff_px(x + 100, fy + 4, 40, seed)
                    k = 1.0 - 0.75 * (fy / wall_h) ** 1.4                                      # 아래로 어두워진다
                    c = mul(cc, k)
                    if y == 0: c = ST[5]
                    elif y == 1: c = ST[3]
            if not hasS:
                lip = 3 + int(round((jS[x] - 0.5) * 2))
                if y >= 16 - lip:
                    k = y - (16 - lip)
                    c = ST[1] if k == 0 else (ST[5] if k == 1 else ST[4])
            if not hasW:
                ew = 3 + int(round((jW[y] - 0.5) * 2))
                if x < ew: c = ST[4] if x < ew - 1 else ST[2]
                if x == 0: c = ST[5]
            if not hasE:
                ew = 3 + int(round((jE[y] - 0.5) * 2))
                if x >= 16 - ew: c = ST[3] if x > 16 - ew else ST[1]
                if x == 15: c = ST[2]
            px[x, y] = tuple(c[:3]) + (255,)
    return o

def autotile_chasm(): return sheet_from_cells([chasm_cell(n) for n in range(16)])

def railing_cell(n):
    """낭떠러지 난간(위층, 막힘): 깎은 돌 기둥(칸 가운데, 3x8) + 이웃 쪽으로 뻗는 나무 가로대 두 줄.
    가로(동서) 대는 앞에서 본 막대, 세로(남북) 대는 위에서 본 막대. 이웃 없음 = 기둥만(끝 기둥은 갓돌이 크다)."""
    c = wl.Cv(); o = 8
    hasN, hasE, hasS, hasW = bool(n & 1), bool(n & 2), bool(n & 4), bool(n & 8)
    # 가로대(동·서): 기둥 가운데(o+7)에서 이웃 칸 가운데까지
    for (on, x0, x1) in ((hasW, 0, o + 7), (hasE, o + 8, 32)):
        if not on: continue
        for x in range(x0, x1):
            c.set(x, o + 7, 'wood', 5); c.set(x, o + 8, 'wood', 3)
            c.set(x, o + 11, 'wood', 4); c.set(x, o + 12, 'wood', 2)
            if x % 6 == 0: c.set(x, o + 8, 'wood', 2)
    for (on, y0, y1) in ((hasN, 0, o + 7), (hasS, o + 8, 32)):
        if not on: continue
        for y in range(y0, y1):
            c.set(o + 6, y, 'wood', 5); c.set(o + 7, y, 'wood', 4); c.set(o + 8, y, 'wood', 3)
            if y % 6 == 0: c.set(o + 7, y, 'wood', 2)
    # 돌 기둥(앞면 3화소 + 갓돌 윗면)
    cap = 1 if (hasE or hasW or hasN or hasS) else 2
    for y in range(o + 5, o + 15):
        c.set(o + 6, y, 'stone', 5); c.set(o + 7, y, 'stone', 4); c.set(o + 8, y, 'stone', 3)
    for x in range(o + 6 - cap + 1, o + 9 + cap - 1):
        c.set(x, o + 3, 'stone', 6); c.set(x, o + 4, 'stone', 5)
    c.set(o + 9, o + 14, 'stone', 2)
    return c.img(True)

def autotile_railing(): return wl.autotile_composed(railing_cell)
