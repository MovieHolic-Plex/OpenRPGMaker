# 극장 보정 패스(2026-10-08, WAVE-BRIEF-4) — 시그니처 땅 덩이 오토타일 셋 + 약한 곳 보정 조각.
#   autotile-spotlight-pool : 무대 위 스포트라이트 빛 웅덩이(무대 널 위 반투명 덧그림, 걷기). 바깥 점 무늬 번짐 → 주황 테 → 밝은 초점 테 → 속 빛.
#   autotile-stage-shadow   : 무대 날개·구석·무대 뒤의 어둠 덩이(반투명 남보라 그늘, 걷기). 빛 웅덩이와 짝을 이뤄 무대 명암을 만든다.
#   autotile-rose-petals    : 커튼콜에 던진 장미 꽃잎 덩이(무대 앞 바닥, 걷기). 가장자리로 갈수록 성기다.
# 칸 번호 = 위 1 + 오른쪽 2 + 아래 4 + 왼쪽 8 (os_auto·as_kit autotile_sheet 와 같은 규약). 결정적.
# 가장자리 깊이장은 desert-castle dc_fix.edge_taper 규약(물가 들어감이 칸 모서리로 갈수록 줄어 오목 모서리 네모 혹이 없다)을 이 폴더에 옮긴 것.
import math
import numpy as np
from PIL import Image
from os_kit import *
from os_kit import _hash
import os_hall as A2, os_stage as A1

# ------------------------------------------------------------------ 잡음·가장자리 깊이장(이 폴더 사본)
def hash2(X, Y, s):
    X = np.asarray(X).astype(np.int64) & 0xffffffff; Y = np.asarray(Y).astype(np.int64) & 0xffffffff
    h = (X * 374761393 + Y * 668265263 + (s * 982451653 & 0xffffffff)) & 0xffffffff
    h = ((h ^ (h >> 13)) * 1274126177) & 0xffffffff
    return ((h ^ (h >> 16)) & 0xffff) / 65535.0

def tnoise1(N, sc, seed):
    gw = max(1, N // sc); g = np.random.default_rng(seed).random(gw)
    xs = (np.arange(N) + 0.5) / sc; x0 = np.floor(xs).astype(int); f = xs - x0; f = f * f * (3 - 2 * f)
    return g[x0 % gw] * (1 - f) + g[(x0 + 1) % gw] * f

def edge_taper(n, inset, jag, rad, seed, size=16, foot=0.5, ramp=6.0):
    """이웃 없는 쪽의 가장자리 깊이(m<0 = 덩이 밖). 들어감 inset±jag 는 칸 가운데에서 크고 칸 모서리로 갈수록 foot 까지 준다
    (4비트 오토타일의 오목 모서리 네모 혹 방지). 두 쪽이 빈 모서리는 반지름 rad 로 둥글린다. 잡음은 칸 주기라 옆 칸과 이어진다."""
    X, Y = np.meshgrid(np.arange(size), np.arange(size))
    miss = {'N': not (n & 1), 'E': not (n & 2), 'S': not (n & 4), 'W': not (n & 8)}
    j = {k: tnoise1(size, 4, seed + i + 1) for i, k in enumerate('NSWE')}
    def tap(t): return np.clip(np.minimum(t + 0.5, size - 0.5 - t) / ramp, 0, 1)
    def prof(k, t): return foot + tap(t) * (inset - foot + (j[k][t] - 0.5) * 2 * jag)
    d = {'N': Y - prof('N', X), 'S': (size - 1 - Y) - prof('S', X), 'W': X - prof('W', Y), 'E': (size - 1 - X) - prof('E', Y)}
    m = np.full((size, size), 99.0)
    for k in 'NESW':
        if miss[k]: m = np.minimum(m, d[k])
    for a, b in (('N', 'W'), ('N', 'E'), ('S', 'W'), ('S', 'E')):
        if miss[a] and miss[b]:
            da, db = d[a], d[b]; sel = (da < rad) & (db < rad)
            m = np.where(sel, np.minimum(m, rad - np.hypot(rad - da, rad - db)), m)
    return m

def sheet_of(cellfn):
    sh = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    for n in range(16): sh.alpha_composite(cellfn(n), ((n % 4) * 16, (n // 4) * 16))
    return sh

def _img(rgba): return Image.fromarray(rgba.astype(np.uint8), 'RGBA')

# ------------------------------------------------------------------ 오토타일 1: 스포트라이트 빛 웅덩이(걷기)
LIT = (255, 238, 196); LIT_HOT = (255, 248, 226); LIT_FRINGE = (255, 176, 96)
def spot_cell(n, seed=1201):
    """조명기 초점이 맞은 빛 웅덩이: 덩이 밖 1.5px 는 성긴 바둑 점 번짐(알파 28), 가장자리 1px 따뜻한 주황 테(색수차),
    다음 1.5px 밝은 초점 테, 속은 고른 크림 빛(알파 86)에 칸 주기 먼지 반짝. 아래 무대 널 결이 비쳐 보인다."""
    m = edge_taper(n, 2.6, 1.5, 7.0, seed)
    o = np.zeros((16, 16, 4))
    for y in range(16):
        for x in range(16):
            v = m[y, x]
            if v < -1.6: continue
            if v < 0:
                if (x + y) % 2 == 0 and v > -1.0: o[y, x] = LIT + (30,)
                elif (x + y) % 4 == 1 and v > -1.6: o[y, x] = LIT + (18,)
                continue
            if v < 0.9: o[y, x] = LIT_FRINGE + (72,); continue
            if v < 2.3: o[y, x] = LIT_HOT + (118,); continue
            c = LIT + (86,)
            if v < 3.4 and (x + y) % 2 == 0: c = LIT + (100,)                       # 테 안쪽 점 번짐(초점 테가 부드럽게 녹는다)
            hh = hash2(x, y, seed + 7)
            if hh > 0.975: c = LIT_HOT + (170,)                                     # 빛 속 먼지 반짝
            elif hh < 0.02: c = LIT + (64,)
            o[y, x] = c
    return _img(o)

# ------------------------------------------------------------------ 오토타일 2: 무대 어둠(걷기)
DARK = (12, 8, 22)
def shadow_cell(n, seed=1221):
    """날개·구석의 어둠: 속은 짙은 남보라 그늘(알파 132), 가장자리 3단 바둑 점으로 번진다(116 → 80 → 바둑 44)."""
    m = edge_taper(n, 3.0, 2.2, 7.5, seed, foot=0.6, ramp=5.0)
    o = np.zeros((16, 16, 4))
    for y in range(16):
        for x in range(16):
            v = m[y, x]
            if v < -1.0: continue
            if v < 0:
                if (x + y) % 2 == 0: o[y, x] = DARK + (40,)
                continue
            if v < 1.2: a = 74 if (x + y) % 2 else 96
            elif v < 2.4: a = 112
            else: a = 132
            if hash2(x, y, seed + 3) > 0.985: a -= 30                              # 먼지 낀 널이 살짝 비친다
            o[y, x] = DARK + (a,)
    return _img(o)

# ------------------------------------------------------------------ 오토타일 3: 장미 꽃잎(걷기)
PET = [(70, 10, 30), (120, 18, 40), (168, 30, 48), (206, 56, 66), (232, 98, 104), (246, 150, 150)]
LEAFG = [(26, 50, 30), (52, 92, 46), (96, 140, 66)]
PETAL_SHAPES = [((0, 0), (1, 0), (0, 1), (1, 1), (2, 1)), ((1, 0), (0, 1), (1, 1), (2, 1), (1, 2)), ((0, 0), (1, 0), (2, 0), (1, 1)),
                ((0, 0), (0, 1), (1, 1), (1, 2)), ((0, 0), (1, 0), (1, 1))]
def _petal_points(seed, k=13, dmin=3.2):
    """칸 안(14x14 안쪽) 흩은 자리 k 개 — 서로 dmin 이상 띄운다(격자 무늬가 안 보이게). 모든 변형이 같은 자리를 쓰므로 속 칸끼리 이어진다."""
    rng = np.random.default_rng(seed); pts = []
    for _ in range(400):
        if len(pts) >= k: break
        x, y = rng.integers(0, 14), rng.integers(0, 14)
        if all((x - a) ** 2 + (y - b) ** 2 >= dmin * dmin for a, b in pts): pts.append((int(x), int(y)))
    return pts
PPTS = _petal_points(1249)
def petal_cell(n, seed=1241):
    """꽃잎 덩이: 칸마다 같은 흩은 자리(PPTS)에 2~5px 꽃잎(밝은 윗가 · 짙은 아랫가 · 1px 그림자), 가끔 초록 잎.
    깊이가 얕을수록(가장자리) 성기고 작아진다 — 바닥(무대 널)이 사이로 그대로 보인다."""
    m = edge_taper(n, 3.2, 2.6, 7.0, seed, foot=0.6, ramp=5.0, sc=8)
    o = np.zeros((16, 16, 4))
    def put(x, y, c, a=255):
        if 0 <= x < 16 and 0 <= y < 16 and o[y, x, 3] == 0: o[y, x] = tuple(c) + (a,)
    for i, (px, py) in enumerate(PPTS):
        h = hash2(i, 0, seed + 1)
        v = m[min(15, py + 1), min(15, px + 1)]
        dens = 0.6 if v > 3 else (0.46 if v > 1.4 else (0.3 if v > 0 else (0.1 if v > -1.5 else 0)))
        if h > dens: continue
        if v < 0.6: shp = ((0, 0), (1, 0)) if hash2(i, 1, seed) > .5 else ((0, 0), (0, 1))  # 가장자리: 낱 잎
        else: shp = PETAL_SHAPES[int(hash2(i, 2, seed + 4) * len(PETAL_SHAPES))]
        leaf = hash2(i, 3, seed + 5) > 0.9
        tone = int(hash2(i, 4, seed + 6) * 2)
        ys = [d[1] for d in shp]
        for (dx, dy) in shp:
            top = dy == min(ys)
            if leaf: c = LEAFG[2] if top else LEAFG[1]
            else: c = PET[4 + tone] if top else PET[3 + tone - (1 if dx == max(d[0] for d in shp) else 0)]
            put(px + dx, py + dy, c)
        for (dx, dy) in shp:
            if (dx, dy + 1) not in shp: put(px + dx, py + dy + 1, (PET[0] if not leaf else LEAFG[0]), 150)
    return _img(o)

SPOT = None; SHADOW = None; PETALS = None
def sheets():
    global SPOT, SHADOW, PETALS
    if SPOT is None: SPOT = sheet_of(spot_cell); SHADOW = sheet_of(shadow_cell); PETALS = sheet_of(petal_cell)
    return SPOT, SHADOW, PETALS

# ------------------------------------------------------------------ 보정 1: 무대 널 변형(밟혀 닳은 무대 한가운데)
SPIKE = [(206, 176, 72), (214, 208, 192), (96, 128, 186), (190, 84, 70)]           # 무대 위치 표시 테이프(노랑·흰·파랑·빨강)
def stage2_px(X, Y):
    """밟혀 닳은 무대 널(무대 한가운데용): 같은 6px 널 줄(op_stage 와 줄이 맞아 이웃해도 이음새 없음) 위에
    ① 줄마다 두 번째 이음(널 길이 24/48 섞임) ② 배우 동선대로 밝게 닳은 결(주기 잡음) ③ 긁힌 자국 1px 사선
    ④ 무대 위치 표시 테이프 L 자 넷(색 넷) ⑤ 배경 칠하다 튄 물감 점 ⑥ 못 머리를 더한다."""
    c = stage_px(X, Y)
    row = Y // 6; ly = Y % 6
    off2 = int(_hash(row % 8, 3, 931) * 48)
    if ly != 5 and _hash(row % 8, 4, 932) < .5 and (X + off2) % 48 == 0: return EBN[1]          # 두 번째 이음
    if ly != 5 and _hash(row % 8, 4, 932) < .5 and (X + off2) % 48 in (2,) and ly == 2: return EBN[1]
    wear = pn(X, Y, 12, 941)
    if ly not in (5,) and wear > .6:                                                        # 닳아 반들거리는 널
        c = mix(c, EBN[5], .22 + (.16 if ly in (0, 1) else 0))
    if ly == 1 and wear > .7 and (X + row * 5) % 7 < 3: c = mix(c, EBN[6], .5)
    sc = (X * 2 + Y * 3) % 23                                                               # 긁힘(드문 1px 사선)
    if sc == 0 and pn(X, Y, 8, 945) > .74 and ly != 5: c = mix(c, EBN[1], .55)
    for i, (mx, my) in enumerate(((6, 9), (31, 3), (21, 33), (41, 27))):                   # 테이프 L 자(3x3)
        dx = X - mx; dy = Y - my
        if (dx == 0 and 0 <= dy <= 2) or (dy == 2 and 0 <= dx <= 2):
            col = SPIKE[i]
            return mix(col, (255, 255, 255), .15) if (dx == 0 and dy == 0) else col
        if (dx == 1 and 0 <= dy <= 1) or (dy == 3 and 0 <= dx <= 2) and dx >= 0:
            if (dx == 1 and 0 <= dy <= 1): c = mix(c, EBN[1], .3)
    sp = _hash(X, Y, 951)                                                                   # 튄 물감
    if sp > .9965: c = (196, 186, 160)
    elif sp < .0025: c = GRN[3]
    return c
mk_floor('op_stage2', stage2_px)

# ------------------------------------------------------------------ 보정 2: 객석 좌석 변형(반복 깨기) — 같은 seat_row 위에 놓고 간 물건을 덧그린다
def _seat_row_with(n, seed, items, worn=(), glove=()):
    im = A2.seat_row(n, '', seed, worn=worn, glove=glove)
    cv = Cv(im.width, im.height); cv.im.alpha_composite(im); cv.p = cv.im.load()
    for fn in items: fn(cv)
    return cv.im
def _tophat(x0):
    def f(cv):                                                                              # 등받이 머리 위에 얹은 높은 모자(검은 비단, 띠는 진홍)
        for y in range(3, 11):
            for x in range(x0 + 4, x0 + 10):
                if y < 4 and x in (x0 + 4, x0 + 9): continue
                cv.px(x, y, NOIR[5] if x == x0 + 4 else (NOIR[3] if x < x0 + 8 else NOIR[1]))
        for x in range(x0 + 4, x0 + 10): cv.px(x, 8, VEL[3] if x < x0 + 8 else VEL[2])
        for x in range(x0 + 2, x0 + 12): cv.px(x, 11, NOIR[4] if x < x0 + 6 else NOIR[2]); cv.px(x, 12, NOIR[0])
        for y in range(9, 30): cv.px(x0 + 13, y, EBN[2] if y > 10 else BR[5])               # 기댄 지팡이(놋쇠 머리)
        cv.px(x0 + 12, 9, BR[5]); cv.px(x0 + 13, 8, BR[6])
    return f
def _shawl(x0):
    def f(cv):                                                                              # 등받이 머리에 걸쳐 늘어진 크림 레이스 숄 자락(성긴 구멍 무늬)과 접은 부채
        for y in range(10, 19):
            xa = x0 + 3 + (1 if y > 14 else 0); xb = x0 + 9 - (1 if y > 16 else 0)
            for x in range(xa, xb):
                if y > 12 and (x + y) % 3 == 0: continue                                   # 레이스 구멍(벨벳이 비친다)
                k = 6 if y == 10 else (5 if x < xa + 3 else 4)
                cv.px(x, y, MRB[k])
        for (x, y) in ((x0 + 4, 19), (x0 + 6, 20), (x0 + 8, 19)): cv.px(x, y, MRB[4])       # 술
        for i in range(4): cv.px(x0 + 11 + (i > 1), 8 + i, GLT[5] if i < 1 else BLU[3])
    return f
def _program(x0):
    def f(cv):                                                                              # 팔걸이 머리에 얹은 접은 안내 책자(진홍 표지, 글자 없음)와 오페라 안경
        for y in range(16, 19):
            for x in range(x0 + 13, x0 + 18):
                cv.px(x, y, VEL[5] if y == 16 else (VEL[4] if x < x0 + 16 else VEL[2]))
        cv.px(x0 + 15, 17, GLT[5])
        for (x, y, c) in ((x0 + 4, 11, GLT[5]), (x0 + 5, 11, GLT[3]), (x0 + 7, 11, GLT[5]), (x0 + 8, 11, GLT[3]), (x0 + 6, 11, GLT[4]),
                          (x0 + 4, 12, BLU[5]), (x0 + 5, 12, BLU[3]), (x0 + 7, 12, BLU[5]), (x0 + 8, 12, BLU[3])): cv.px(x, y, c)
    return f
def seat_row4_hat(seed=0): return _seat_row_with(4, seed + 21, [_tophat(32)], worn=(0,))
def seat_row4_shawl(seed=0): return _seat_row_with(4, seed + 27, [_shawl(16)])
def seat_row4_program(seed=0): return _seat_row_with(4, seed + 33, [_program(0), _program(32)], worn=(3,))

# ------------------------------------------------------------------ 보정 3: 막 변형
def valance_swag_crest(seed=0):
    """막 위 주름 띠 가운데 판 3×1(48x16): 주름 띠와 이어지는 자락 둘 사이에 금 방패 판 — 희극·비극 두 탈(눈구멍과 입 모양만, 글자 없음)."""
    im = A1.valance_swag(seed)
    cv = Cv(48, 16); cv.im.alpha_composite(im); cv.p = cv.im.load()
    cx = 24
    for y in range(0, 14):
        hw = 7 if y < 9 else 7 - (y - 8) * 1.2
        for x in range(cx - 8, cx + 8):
            if abs(x + .5 - cx) > hw: continue
            edge = abs(x + .5 - cx) > hw - 1.2 or y == 0
            k = 6 if (edge and x < cx) else (4 if edge else (5 if x < cx - 2 else (4 if x < cx + 3 else 3)))
            cv.px(x, y, GLT[k])
    for (mx, sad) in ((cx - 4, False), (cx + 3, True)):                                   # 두 탈(크림 얼굴, 짙은 눈·입)
        for y in range(3, 10):
            for x in range(mx - 2, mx + 2):
                if y == 9 and x in (mx - 2, mx + 1): continue
                cv.px(x, y, MRB[5] if x < mx else MRB[3])
        cv.px(mx - 1, 5, NOIR[1]); cv.px(mx + 0, 5, NOIR[1])
        if sad: cv.px(mx - 1, 8, NOIR[2]); cv.px(mx, 8, NOIR[2]); cv.px(mx - 2, 9, NOIR[2]); cv.px(mx + 1, 9, NOIR[2])
        else: cv.px(mx - 2, 7, NOIR[2]); cv.px(mx + 1, 7, NOIR[2]); cv.px(mx - 1, 8, NOIR[2]); cv.px(mx, 8, NOIR[2])
    for y in range(13, 16): cv.px(cx - 1, y, GLT[5]); cv.px(cx, y, GLT[3])                  # 아래 술
    return fin(cv, .7)

def curtain_leg(seed=0):
    """곧게 늘어진 다리막 1×5(16x80): 무대 날개 입구를 가리는 진홍 벨벳 세로 막 — 위는 짙은 주름 머리띠, 아래 금 술 단과 바닥에 접힌 자락.
    아랫줄만 막힘(위 4줄은 걷기+가림). 걷힌 큰 막(drape_tied)과 달리 묶지 않고 곧다."""
    W, H = 16, 80; cv = Cv(W, H)
    vel_pleats(cv, 0, 16, 4, H - 2, per=4, k0=-1, seed=seed + 5)
    for y in range(0, 4):
        for x in range(16): cv.px(x, y, VEL[2] if y < 3 else GLT[3])
    for x in range(16): cv.px(x, 1, VEL[3] if x % 4 < 2 else VEL[1])
    for y in range(H - 8, H - 5):
        for x in range(16): cv.px(x, y, GLT[5] if (x + y) % 3 else GLT[3])
    for y in range(H - 5, H - 2):
        for x in range(16):
            if x % 2 == 0: cv.px(x, y, GLT[4] if y < H - 3 else GLT[2])
    for y in range(H - 2, H):
        for x in range(-1, 17): cv.px(max(0, min(15, x)), y, VEL[2] if x < 12 else VEL[1])
    for y in range(30, 60):                                                                # 접힌 주름 그늘(가운데 한 줄 깊게)
        cv.px(9, y, VEL[1])
    return shadow_under(fin(cv, .62), 8, H - 1, 8, 1.5, 70)

def drape_puddle(seed=0):
    """바닥에 고인 막 자락 2×1(32x16): 큰 막 발치나 다리막 옆에 넘쳐 고인 진홍 벨벳 자락과 금 술 끝. 걷기(낮은 천)."""
    W, H = 32, 16; cv = Cv(W, H)
    for y in range(4, 15):
        for x in range(1, 31):
            top = 4 + 3 * math.sin(x * .35) ** 2 + (2 if x > 22 else 0)
            if y < top: continue
            if abs(x - 15.5) > 15 - max(0, y - 11) * 2: continue
            ph = (x + int(2 * math.sin(y * .7))) % 6
            k = (2, 3, 5, 4, 3, 2)[ph]
            if y < top + 1.5: k += 1
            if y > 12: k -= 1
            cv.px(x, y, VEL[clamp(k, 1, 6)])
    for x in range(6, 26, 2): cv.px(x, 14, GLT[4]); cv.px(x, 15, GLT[2])
    return shadow_under(fin(cv, .62), 16, 15, 14, 1.2, 60)

# ------------------------------------------------------------------ 보정 4: 스포트라이트 빛줄기(위에서 내리꽂히는 빛 원뿔)
def spot_beam(seed=0):
    """빛줄기 3×5(48x80, 위층 반투명 덧그림 — 걷기+가림): 화면 위(천장 조명교)에서 비스듬히 내려와 아래 빛 웅덩이에 닿는 원뿔.
    가장자리 두 줄은 밝고(먼지가 빛을 받는 띠) 속은 옅은 바둑 점, 아래로 갈수록 넓고 옅어진다. 아래 끝은 웅덩이 위 1칸에서 끊긴다."""
    W, H = 48, 80; im = new(W, H); p = im.load()
    for y in range(H):
        t = y / (H - 1.0)
        cx = 30 - 8 * t; hw = 4 + 15 * t
        for x in range(W):
            d = abs(x + .5 - cx)
            if d > hw: continue
            fade = 1 - .45 * t
            if d > hw - 1.5: a = 64
            elif d > hw - 3: a = 40 if (x + y) % 2 == 0 else 22
            else: a = 30 if (x + y) % 2 == 0 else 0
            if _hash(x, y, seed + 961) > .985: a = 120                                    # 빛 속 먼지
            if y > H - 12: a = int(a * (H - y) / 12.0)
            if a: p[x, y] = (255, 236, 186, int(a * fade))
    return im

# ------------------------------------------------------------------ 오토타일 시험 그림(check-autotile.png)
SHAPES = {
 'blob5': ["........",
           "..XXX...",
           ".XXXXX..",
           ".XXXXXX.",
           ".XXXXX..",
           "..XXXX..",
           "...X....",
           "........"],
 'spiral': ["..........",
            ".XXXXXXX..",
            ".X.....X..",
            ".X.XXX.X..",
            ".X.X.X.X..",
            ".X.X...X..",
            ".X.XXXXX..",
            ".X........",
            ".XXXXXXXX.",
            ".........."],
 'nose_L': ["..........",
            ".XXX......",
            ".XXX......",
            ".XXXX.....",
            ".XXXXXXXX.",
            "XXXXXXXXXX",
            ".XXXXXXX..",
            "..XX......",
            ".........."],
}
def stamp(sheet, rows, bgfn):
    h = len(rows); w = len(rows[0]); out = Image.new('RGBA', (w * 16, h * 16))
    for y in range(h):
        for x in range(w): out.alpha_composite(bgfn(x, y), (x * 16, y * 16))
    on = lambda x, y: 0 <= x < w and 0 <= y < h and rows[y][x] == 'X'
    for y in range(h):
        for x in range(w):
            if not on(x, y): continue
            k = (1 if on(x, y - 1) else 0) | (2 if on(x + 1, y) else 0) | (4 if on(x, y + 1) else 0) | (8 if on(x - 1, y) else 0)
            out.alpha_composite(sheet.crop(((k % 4) * 16, (k // 4) * 16, (k % 4) * 16 + 16, (k // 4) * 16 + 16)), (x * 16, y * 16))
    return out

def check_sheet(path, extra=(), scale=3):
    from PIL import ImageDraw
    sp, sd, pe = sheets()
    stage = lambda x, y: dlib.floor_tile('op_stage2' if 'op_stage2' in dlib.FLOORS else 'op_stage', x, y)
    rows = [('autotile-spotlight-pool (on stage boards)', sp, stage), ('autotile-stage-shadow (on stage boards)', sd, stage),
            ('autotile-rose-petals (on stage boards)', pe, stage)] + list(extra)
    blocks = []
    for (title, sh, bg) in rows:
        raw = Image.new('RGBA', (76, 76), (40, 40, 46, 255))
        for k in range(16): raw.alpha_composite(bg(k % 4, k // 4), (6 + (k % 4) * 16, 6 + (k // 4) * 16))
        raw.alpha_composite(sh, (6, 6))
        ims = [raw] + [stamp(sh, SHAPES[k], bg) for k in ('blob5', 'spiral', 'nose_L')]
        blocks.append((title, ims))
    hgt = max(max(i.height for i in ims) for _, ims in blocks)
    W = max(sum(i.width for i in ims) + 10 * len(ims) for _, ims in blocks)
    o = Image.new('RGBA', (W * scale + 10, len(blocks) * (hgt * scale + 24) + 6), (24, 24, 28, 255)); d = ImageDraw.Draw(o)
    for r, (title, ims) in enumerate(blocks):
        y = 6 + r * (hgt * scale + 24); d.text((8, y), title + '   [16 variants | 5x5 blob | spiral | L + nose]', fill=(235, 235, 235, 255))
        x = 6
        for im in ims:
            o.alpha_composite(im.resize((im.width * scale, im.height * scale), Image.NEAREST), (x, y + 16)); x += im.width * scale + 10 * scale
    o.convert('RGB').save(path)

if __name__ == '__main__':
    import sys
    check_sheet(sys.argv[1] if len(sys.argv) > 1 else HERE + '/check-autotile.png')
