# 사막 필드 + 피라미드·고분 — 재질(팔레트·바닥 질감·사암 마름돌). 결정적(같은 입력 = 같은 그림).
# 버들항 파이프라인(city_v6)의 7단 램프(0=윤곽, 1~6 밝기)·성 마름돌 그리기(castle6.ash)·칩셋 점 질감(ctex)을 그대로 쓴다.
# 모래·사암 램프는 사막 오아시스(desert-oasis, varlib)와 같은 값 — 옆에 놓아도 같은 게임으로 읽히게.
import math
import numpy as np
from PIL import Image
import dp_wl as wl                      # noqa: F401  (city_v6 경로·팔레트 등록)
from dp_wl import hx, PAL, GRAIN, tnoise, hash2
from px2 import _hash
from v6pieces import ctex
from px2 import _hash as _hash

# ---------------------------------------------------------------- 재료 (7단: 0=윤곽, 1~6) — 그림자는 붉은 보랏빛, 빛은 노란빛
PAL.update({
 'sand':   ['#5a3a26', '#936442', '#bf8e58', '#dcaf6c', '#eccb86', '#f8e2a4', '#fff6d0'],   # desert-oasis 와 같은 모래 램프
 'sstone': ['#4a2a20', '#7e4a34', '#ac7044', '#cf9558', '#e8b672', '#f6d498', '#fff0c0'],   # desert-oasis 와 같은 사암 램프
 'bedrock':['#341c18', '#5c3428', '#844c34', '#a66840', '#c28652', '#d8a468', '#ecc488'],   # 모래 밑 암반(사암보다 붉고 어둡다)
 'oasis':  ['#0a3a46', '#0e5a66', '#128282', '#22acA0', '#4cd0b8', '#8aecd4', '#d4fff0'],
 'palm':   ['#0a2410', '#14461c', '#20702a', '#34a03a', '#58c84c', '#90e864', '#d0fc90'],
 'reed':   ['#1c2410', '#38401c', '#586028', '#7c8438', '#a0a44c', '#c4c46c', '#e4e090'],
 'cactus': ['#0a1e16', '#143a24', '#1e5830', '#2e7840', '#46984e', '#6cb862', '#a6d888'],
 'dry':    ['#281a0e', '#463016', '#684c22', '#8c6a32', '#ae8a46', '#ccaa62', '#eada96'],
 'camel':  ['#2c1a10', '#56381e', '#7e5430', '#a2723e', '#c09254', '#d8b274', '#efd6a2'],
 'wool':   ['#100c0c', '#221a18', '#362a24', '#4c3c32', '#645242', '#7e6a56', '#9c8670'],   # 검은 염소털 천막
 'canvas': ['#2a2418', '#4a4230', '#6e6448', '#948a64', '#b4aa82', '#d0c8a2', '#eae4c6'],
 'indigo': ['#0c0c26', '#18204a', '#243874', '#34549e', '#5078c4', '#7ea2e0', '#bcd2f6'],
})
GRAIN.update({'sand': (0.10, 2.0), 'sstone': (0.10, 2.2), 'bedrock': (0.12, 2.0), 'oasis': (0.03, 2), 'palm': (0.2, 1.6), 'reed': (0.2, 1.4),
              'cactus': (0.10, 1.6), 'dry': (0.16, 1.4), 'camel': (0.08, 1.8), 'wool': (0.10, 1.4), 'canvas': (0.08, 1.6), 'indigo': (0.06, 1.8)})

def R(mat): return [hx(c) for c in PAL[mat]]
SA, SS, BR = R('sand'), R('sstone'), R('bedrock')
def P(mat): return np.array(R(mat), np.uint8)
def mul(c, k): return tuple(max(0, min(255, int(v * k))) for v in c[:3])
def mix(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))
SWARM = hx('#f2dca4')

# ---------------------------------------------------------------- 사암 마름돌 (버들항 성 마름돌 castle6.ash 를 사암 램프로)
def sash(X, Y, k=1.0, bw=16, bh=8, seed=0, ramp=None):
    """사암 마름돌: bw x bh 돌을 엇갈려 쌓고 1px 줄눈, 돌마다 다른 바탕 톤, 위·왼 모 밝게, 아래·오른 모 어둡게, 칩셋 점 질감.
    castle6.ash 와 같은 구조 — 램프만 사암(바탕 4, 모 5·3, 줄눈 2)."""
    Q = ramp or SS
    row = Y // bh; ly = Y % bh; off = (row % 2) * (bw // 2); col = (X + off) // bw; lx = (X + off) % bw
    if ly == bh - 1 or lx == bw - 1: c = mix(Q[2], Q[1], 0.45)                       # 줄눈(성 마름돌처럼 또렷하게)
    else:
        h = _hash(col, row, seed + 41)
        base = Q[4] if h < 0.5 else (mix(Q[4], SWARM, 0.5) if h < 0.72 else (mix(Q[4], Q[3], 0.55) if h < 0.9 else mix(Q[4], Q[5], 0.5)))
        c = base
        if ly == 0 or lx == 0: c = mix(base, Q[6], 0.6)
        elif ly == bh - 2 or lx == bw - 2: c = mix(base, Q[3], 0.75)
        else:
            g = ctex(224, 160, X, Y)
            if g == (140, 108, 91) and _hash(X, Y, seed + 42) < 0.45: c = mix(base, Q[3], 0.6)
            elif g == (158, 141, 131) and _hash(X, Y, seed + 43) < 0.3: c = mix(base, Q[3], 0.3)
            elif _hash(X, Y, seed + 44) < 0.025: c = mix(base, Q[5], 0.6)
        if ly == bh - 2 and _hash(X, Y, seed + 45) < 0.12: c = SA[4]
    return mul(c, k) if k != 1.0 else c

# ---------------------------------------------------------------- 잡음(지도용 비주기 / 표본용 주기)
def vn_full(Wp, Hp, sc, seed):
    """지도 전체 크기 값 잡음(비주기). sc 화소 격자."""
    gw, gh = Wp // sc + 3, Hp // sc + 3
    g = np.random.default_rng(seed).random((gh, gw))
    xs = (np.arange(Wp) + 0.5) / sc; ys = (np.arange(Hp) + 0.5) / sc
    x0 = np.floor(xs).astype(int); y0 = np.floor(ys).astype(int); fx = xs - x0; fy = ys - y0
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy)
    a = g[np.ix_(y0, x0)]; b = g[np.ix_(y0, x0 + 1)]; c = g[np.ix_(y0 + 1, x0)]; d = g[np.ix_(y0 + 1, x0 + 1)]
    fxx = fx[None, :]; fyy = fy[:, None]
    return (a * (1 - fxx) + b * fxx) * (1 - fyy) + (c * (1 - fxx) + d * fxx) * fyy

class Noise:
    """per=None 이면 지도용 비주기, per=48 이면 표본용(48화소 주기, 이어 붙여도 이음새 없음)."""
    def __init__(s, Wp, Hp, per=None): s.W, s.H, s.per = Wp, Hp, per
    def __call__(s, sc, seed):
        if s.per: return tnoise(s.W, s.H, sc, seed)
        return vn_full(s.W, s.H, sc, seed)

def _shift(a, dx, dy):
    """a 를 (dx,dy) 만큼 감아 옮긴다(이음새 없는 주기 표본에서도 맞다)."""
    return np.roll(np.roll(a, dy, 0), dx, 1)

# ---------------------------------------------------------------- 모래 바닥 (결·잔돌·잔물결)
def sand_rgb(X, Y, nz, rip, seed=1, per=None):
    """모래: 바탕 4단 + 밝은 결 5단 디더, 칩셋 흙결처럼 2화소 비스듬한 잔 결(3), 반짝이 알(6), 붉은 잔돌(사암 2×2),
    바람 잔물결(위 1px 밝은 마루 5·아래 1px 어두운 골 3 — 빛이 왼쪽 위라 마루 윗면이 밝다). rip = 잔물결 세기 0..1 (HxW)."""
    Hh, Ww = X.shape
    low = nz(16, seed) * 0.65 + nz(6, seed + 1) * 0.35
    hsd = hash2(X, Y, seed + 5)
    T = np.full(X.shape, 4, np.int16)
    T = np.where((low > 0.58) & (hsd > 0.86), 5, T)                     # 밝은 결(낱점으로만 — 얼룩 면 금지)
    T = np.where((low < 0.32) & (hsd > 0.90), 3, T)
    # 잔물결: 위상장 P = Y + 굽이(사인+잡음). 7px 간격. 토막(4~12px)으로 끊긴다.
    if per:
        Pp = Y + 1.6 * np.sin(X * 2 * np.pi / 48.0 * 2 + 1.0) + 1.2 * np.sin(X * 2 * np.pi / 48.0 * 3 + Y * 2 * np.pi / 48.0) + nz(16, seed + 2) * 5
        gap = 6
    else:
        Pp = Y + 2.4 * np.sin(X / 9.5 + nz(40, seed + 3) * 6.0) + nz(28, seed + 2) * 9.0
        gap = 7
    ph = np.mod(Pp, gap)
    seg = nz(9, seed + 4) > 0.30
    on = (rip > 0.05) & seg & (nz(12, seed + 6) < 0.15 + rip)
    T = np.where(on & (ph < 1.0), 5, T)
    T = np.where(on & (ph >= 1.0) & (ph < 2.0), 3, T)
    T = np.where(on & (ph >= 1.0) & (ph < 2.0) & (rip > 0.6) & (hsd > 0.55), 2, T)
    # 2화소 비스듬한 잔 결(칩셋 흙결 획)
    d1 = hash2(X, Y, seed + 7) > 0.962
    d2 = _shift(d1, 1, -1)
    T = np.where((d1 | d2) & (T == 4), 3, T)
    T = np.where((hash2(X, Y, seed + 8) > 0.986) & (T >= 4), 6, T)
    T = np.where(hash2(X, Y, seed + 9) < 0.010, 2, T)
    rgb = P('sand')[np.clip(T, 0, 6)].astype(np.uint8)
    # 사암 잔돌 2x2 (왼위 밝고 오른아래 어둡다) — 드물게
    pb = hash2(X // 2, Y // 2, seed + 11) > 0.9935
    q = (X % 2) + 2 * (Y % 2)
    ptone = np.choose(q, [5, 3, 3, 1])
    rgb = np.where(pb[..., None], P('sstone')[ptone], rgb)
    return rgb

def ground_sand():
    S = 48; X, Y = np.meshgrid(np.arange(S), np.arange(S)); nz = Noise(S, S, 48)
    rgb = sand_rgb(X, Y, nz, np.full((S, S), 0.25), seed=21, per=48)
    return Image.fromarray(rgb, 'RGB').convert('RGBA')

def ground_dune():
    S = 48; X, Y = np.meshgrid(np.arange(S), np.arange(S)); nz = Noise(S, S, 48)
    rgb = sand_rgb(X, Y, nz, np.full((S, S), 0.95), seed=22, per=48)
    return Image.fromarray(rgb, 'RGB').convert('RGBA')

# ---------------------------------------------------------------- 다져진 길 모래(카라반 길) — 바퀴 홈·발굽 자국
def packed_tone(X, Y, nz, seed=31):
    low = nz(12, seed) * 0.6 + nz(5, seed + 1) * 0.4
    T = np.full(X.shape, 3, np.int16)
    T = np.where((low > 0.5) & (hash2(X, Y, seed + 2) > 0.80), 4, T)
    T = np.where((low <= 0.5) & (hash2(X, Y, seed + 2) > 0.93), 4, T)
    # 발굽·발자국: 2x2 오목(위 어둡고 아래 밝은 테) — 흩어진 쌍
    fp = (hash2(X // 4, Y // 5, seed + 3) > 0.80)
    fx = (X % 4); fy = (Y % 5)
    pit = fp & (fx >= 1) & (fx <= 2) & (fy >= 1) & (fy <= 2)
    rim = fp & (fx >= 1) & (fx <= 2) & (fy == 3)
    T = np.where(pit, 2, T); T = np.where(rim, 5, T)
    T = np.where((hash2(X, Y, seed + 4) > 0.975), 5, T)
    T = np.where((hash2(X, Y, seed + 5) < 0.02), 2, T)
    return T

def ground_packed():
    S = 48; X, Y = np.meshgrid(np.arange(S), np.arange(S)); nz = Noise(S, S, 48)
    T = packed_tone(X, Y, nz)
    return Image.fromarray(P('sand')[np.clip(T, 0, 6)], 'RGB').convert('RGBA')

# ---------------------------------------------------------------- 사암 포석(광장) — 줄눈에 모래가 낀다
def flag_tone(X, Y, seed=41):
    """판석 엇갈림(가로 12·세로 8), 돌마다 톤, 위·왼 모 밝게, 줄눈엔 모래(sand 3), 금 가끔. 반환 (mat 배열, T 배열)."""
    row = Y // 8; xo = (X + (row % 3) * 5) % 48; col = xo // 12
    lx = xo % 12; ly = Y % 8
    hb = hash2(col + row * 7, row, seed)
    T = 4 + np.rint((hb - 0.5) * 1.8).astype(int) + np.rint((hash2(X, Y, seed + 1) - 0.5) * 0.6).astype(int)
    joint = (lx == 0) | (ly == 7)
    T = np.where((lx == 1) & ~joint, np.minimum(T + 1, 6), T)
    T = np.where((ly == 0) & ~joint, np.minimum(T + 1, 6), T)
    T = np.where((ly == 6) & ~joint & (lx > 1), np.maximum(T - 1, 2), T)
    crack = (hash2(col * 3 + 1, row + 9, seed + 2) > 0.975) & (ly == 3) & (lx > 2) & (lx < 10)
    T = np.where(crack, 1, T)
    T = np.where((hash2(X, Y, seed + 3) > 0.97) & ~joint, np.maximum(T - 1, 2), T)
    mat = np.where(joint, 1, 0)                     # 1 = 모래 줄눈
    T = np.where(joint, np.where(hash2(X, Y, seed + 4) > 0.7, 4, 3), T)
    return mat, T

def flag_rgb(X, Y, seed=41):
    mat, T = flag_tone(X, Y, seed)
    return np.where((mat == 1)[..., None], P('sand')[np.clip(T, 0, 6)], P('sstone')[np.clip(T, 0, 6)]).astype(np.uint8)

def ground_flag():
    S = 48; X, Y = np.meshgrid(np.arange(S), np.arange(S))
    return Image.fromarray(flag_rgb(X, Y), 'RGB').convert('RGBA')

# ---------------------------------------------------------------- 암반(모래 밑 평평한 바위) — 판 조각·금·패인 구멍
def bedrock_tone(X, Y, nz, seed=51, per=None):
    """평평한 사암 암반 윗면(자갈밭처럼 보이지 않게 판 금은 드물게): 바탕 4단에 밝은 결(5) 디더, 물결진 가로 지층 줄(3, 끊김),
    짧은 비스듬한 금(2)이 드문드문, 금 위 1px 밝은 모(5), 패인 점. 반환 (T, sandy)."""
    low = nz(12, seed) * 0.6 + nz(5, seed + 1) * 0.4
    T = np.full(X.shape, 4, int)
    T = np.where((low > 0.55) & (hash2(X, Y, seed + 2) > 0.55), 5, T)
    T = np.where((low < 0.3) & (hash2(X, Y, seed + 3) > 0.7), 3, T)
    if per: wav = Y + np.rint(1.2 * np.sin(X * 2 * np.pi / per * 2 + seed)).astype(int)
    else: wav = Y + np.rint(1.6 * np.sin(X / 7.0 + seed) + nz(24, seed + 4) * 3).astype(int)
    strata = (np.mod(wav, 7) == 0) & (nz(6, seed + 5) > 0.4)
    T = np.where(strata, 3, T)
    T = np.where(np.roll(strata, -1, 0) & ~strata, np.minimum(T + 1, 6), T)       # 지층 줄 위 밝은 모
    cr = (hash2(X // 4, Y // 3, seed + 6) > 0.9) & ((X % 4) == (Y % 3) + 1)
    T = np.where(cr, 2, T)
    T = np.where(hash2(X, Y, seed + 8) > 0.985, 2, T)
    T = np.where(hash2(X, Y, seed + 9) > 0.975, 6, T)
    sandy = (nz(9, seed + 10) > 0.74) & (hash2(X, Y, seed + 11) > 0.55)
    return T, sandy

def ground_bedrock():
    S = 48; X, Y = np.meshgrid(np.arange(S), np.arange(S)); nz = Noise(S, S, 48)
    T, sandy = bedrock_tone(X, Y, nz, per=48)
    rgb = np.where(sandy[..., None], P('sand')[4], P('bedrock')[np.clip(T, 0, 6)])
    return Image.fromarray(rgb.astype(np.uint8), 'RGB').convert('RGBA')

# ---------------------------------------------------------------- 벽 앞면 표본
def face_pyramid():
    """피라미드 앞면 표본(48x48): 사암 마름돌 16x8 엇갈림, 단마다 2px 윗면(디딤)."""
    o = Image.new('RGBA', (48, 48)); p = o.load()
    for y in range(48):
        for x in range(48):
            ly = y % 24
            if ly < 3: c = SS[6] if ly == 0 else (SS[5] if ly == 1 else SS[3])
            else: c = sash(x, y - 3, bw=16, bh=7, seed=3)
            p[x, y] = c + (255,)
    return o

def cliff_rgb(X, Y, fy, seed=61, per=64):
    """사암 절벽 앞면: 두께가 다른 가로 지층(3~8px, 층마다 톤 3~5, 윗줄 밝고 아랫줄 오목, 층 끝이 들쭉날쭉),
    드문드문 세로 갈라짐(층마다 끊긴다), 칩셋 점. 가로 결이 주인공이지만 통나무처럼 고른 줄무늬는 금지."""
    wob = tnoise(per, per, 8, seed + 9)[np.mod(Y, per), np.mod(X, per)]
    yy = Y + np.rint((np.sin(X * 2 * np.pi / per * 3 + 1.3) * 1.5 if per == 48 else np.sin(X / 13.0 + 1.3) * 1.5 + np.sin(X / 5.3) * 0.7) + (wob - 0.5) * 4.0).astype(int)
    # 층 경계: 누적 두께(3~8) — 층 번호 표
    edges = [0]; r = 0
    while edges[-1] < 4000:
        edges.append(edges[-1] + 3 + int(_hash(r, 7, seed) * 6)); r += 1
    edges = np.array(edges)
    li = np.searchsorted(edges, np.mod(yy, 4000), side='right') - 1
    lb = np.mod(yy, 4000) - edges[li]; th = edges[li + 1] - edges[li]
    lt = hash2(li, li * 3, seed)
    T = np.where(lt < 0.35, 2, np.where(lt < 0.8, 3, 4)).astype(int)
    T = np.where(lb == 0, np.minimum(T + 2, 6), T)
    brk = hash2(X // 5, li, seed + 11) > 0.25                    # 층 사이 오목 선은 토막으로 끊긴다(판자처럼 고른 줄 금지)
    T = np.where((lb == th - 1) & brk, np.maximum(T - 2, 1), T)
    T = np.where((lb == th - 1) & ~brk, np.maximum(T - 1, 1), T)
    T = np.where((lb == th - 2) & (th > 4) & brk, np.maximum(T - 1, 2), T)
    rough = tnoise(per, per, 4, seed + 12)[np.mod(Y, per), np.mod(X, per)]
    T = np.where((rough > 0.68) & (lb > 0), np.maximum(T - 1, 1), T)    # 바위 결 얼룩(작은 덩이)
    T = np.where((rough < 0.25) & (lb > 0) & (lb < th - 1), np.minimum(T + 1, 5), T)
    T = np.where((hash2(X // 3, li, seed + 3) > 0.8) & (lb > 0) & (lb < th - 1), np.maximum(T - 1, 2), T)   # 층 안 얼룩(낱 결)
    col = X + (np.rint(np.sin(Y * 0.07) * 1.5).astype(int) if per != 48 else 0)
    cw = 24 if per == 48 else 29
    cid = col // cw; u = np.mod(col, cw)
    grp = li // (2 + np.mod(cid, 3))
    off = np.rint(hash2(cid, grp, seed + 5) * 24).astype(int)
    on = hash2(cid, grp, seed + 6) > 0.55
    T = np.where((u == off) & on, 1, T)
    T = np.where((u == off + 1) & on, np.minimum(T + 1, 6), T)
    T = np.where(hash2(X, Y, seed + 1) > 0.975, np.maximum(T - 1, 1), T)
    T = np.where(hash2(X, Y, seed + 2) > 0.985, np.minimum(T + 1, 6), T)
    return T

def face_cliff():
    S = 48; X, Y = np.meshgrid(np.arange(S), np.arange(S))
    T = cliff_rgb(X, Y, Y, per=48)
    T = np.where(Y < 2, np.where(Y == 0, 5, 4), T)                   # 절벽 윗선(암반 윗면 끝)
    T = np.where(Y == 2, 1, T)
    rgb = P('bedrock')[np.clip(T, 0, 6)]
    rgb = np.where((Y >= 45)[..., None], P('sand')[np.where(Y == 45, 2, 3)], rgb)
    return Image.fromarray(rgb.astype(np.uint8), 'RGB').convert('RGBA')
