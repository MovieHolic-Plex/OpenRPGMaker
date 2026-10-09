# 사막 필드 오토타일 3종(16변형, 번호 = 위1·오른2·아래4·왼8, 0 = 외톨이, 15 = 속 칸). 모두 아래층 투명 덧그림.
#  autotile-trail    카라반 길(다져진 모래 + 발굽 자국, 가장자리는 모래 알갱이로 흩어진다)
#  autotile-bedrock  모래 위로 드러난 암반(판 조각·금, 앞(남)쪽 2px 앞면, 위·왼 모 밝게)
#  autotile-drift    포석 위로 날려 쌓인 모래(가장자리 성기게, 쌓인 마루 밝게)
import numpy as np
from PIL import Image
import dp_art as A
from dp_wl import edge_depth, sheet_from_cells, tnoise, hash2, N_, E_, S_, W_

class N16:
    def __call__(s, sc, seed): return tnoise(16, 16, sc, seed)

def _cells(shader, seed, inset, jag, rad):
    X, Y = np.meshgrid(np.arange(16), np.arange(16)); cells = []
    for n in range(16):
        m, miss = edge_depth(n, inset, jag, rad, seed)
        side = {}
        for k, bit in (('N', N_), ('E', E_), ('S', S_), ('W', W_)):
            if miss[k]: side[k] = edge_depth(15 & ~bit, inset, jag, rad, seed)[0]
        rgb, alpha = shader(X, Y, m, side, n)
        cells.append(Image.fromarray(np.dstack([rgb.astype(np.uint8), np.where(alpha, 255, 0).astype(np.uint8)]), 'RGBA'))
    return sheet_from_cells(cells)

# ---------------------------------------------------------------- 카라반 길
def trail_shader(X, Y, m, side, n):
    nz = N16()
    low = nz(8, 301) * 0.6 + nz(4, 309) * 0.4
    T = np.full(X.shape, 3, int)
    T = np.where(hash2(X, Y, 302) > 0.86, 4, T)                    # 고른 다진 모래 + 낱 알갱이(얼룩 면 금지)
    T = np.where(hash2(X, Y, 303) > 0.93, 2, T)
    # 발굽 자국: 칸마다 둘(자리를 어긋나게) — 2x1 오목(2) + 아래 1px 밝은 테(4)
    for (fx, fy) in ((3, 4), (11, 11)):
        pit = (X >= fx) & (X <= fx + 1) & (Y == fy)
        T = np.where(pit, 2, T); T = np.where((X >= fx) & (X <= fx + 1) & (Y == fy + 1), 4, T)
    # 바퀴 홈: 가로 두 줄(5·11), 토막으로 끊긴다 — 이웃 칸과 이어진다
    for (ry, sd) in ((8, 305),):
        rut = (Y == ry) & (tnoise(16, 16, 8, sd) > 0.5)
        T = np.where(rut, 2, T)
    # 가장자리: 밖으로 갈수록 듬성해지고(모래 알갱이만), 안쪽 1px 둑은 모래빛(4)
    keep = (m >= 0.9) | ((m >= 0) & (hash2(X, Y, 306) < 0.45 + m * 0.6))
    T = np.where((m >= 0) & (m < 1.4), np.where(hash2(X, Y, 307) > 0.35, 2, 3), T)        # 눌린 가장자리 띠(버들항 흙길처럼)
    T = np.where((m >= 1.4) & (m < 2.2) & (hash2(X, Y, 310) > 0.6), 4, T)
    grains = (m < 0) & (m > -1.6) & (hash2(X, Y, 308) > 0.9)
    T = np.where(grains, 3, T)
    rgb = A.P('sand')[np.clip(T, 0, 6)]
    return rgb, keep | grains

def trail(): return _cells(trail_shader, 31, 1.2, 1.1, 5.0)

# ---------------------------------------------------------------- 암반
def bedrock_shader(X, Y, m, side, n):
    T, sandy = A.bedrock_tone(X, Y, N16(), seed=511, per=16)
    # 가장자리: 위·왼 = 밝은 모, 아래(남) = 2px 앞면(어둡다) + 1px 윤곽 — 모래보다 한 뼘 솟은 판
    if 'N' in side: T = np.where((side['N'] >= 0) & (side['N'] < 1.2), 5, T)
    if 'W' in side: T = np.where((side['W'] >= 0) & (side['W'] < 1.2), np.maximum(T, 5), T)
    if 'E' in side: T = np.where((side['E'] >= 0) & (side['E'] < 1.2), 3, T)
    if 'S' in side:
        sS = side['S']
        T = np.where((sS >= 0) & (sS < 3.2), np.where(sS < 1.0, 1, np.where(sS < 2.1, 2, 3)), T)
        sandy = sandy & ~(sS < 3.2)
    T = np.where((m >= 0) & (m < 0.7), 1, T)
    sandy = sandy & (m > 1.5)
    rgb = np.where(sandy[..., None], A.P('sand')[4], A.P('bedrock')[np.clip(T, 0, 6)])
    alpha = m >= 0
    if 'S' in side:
        sh = (m < 0) & (side['S'] < 0) & (side['S'] > -1.2)
        rgb = np.where(sh[..., None], A.P('sand')[2], rgb); alpha = alpha | sh
    return rgb, alpha

def bedrock(): return _cells(bedrock_shader, 51, 1.5, 0.9, 6.5)

# ---------------------------------------------------------------- 포석 위 모래 더미
def drift_shader(X, Y, m, side, n):
    rgb = A.sand_rgb(X, Y, N16(), np.full(X.shape, 0.55), seed=71, per=16)
    T = np.zeros(X.shape, int)
    keep = (m >= 1.4) | ((m >= 0) & (hash2(X, Y, 701) < 0.25 + m * 0.45))
    lit = np.zeros(X.shape, bool); dark = np.zeros(X.shape, bool)
    for k in ('N', 'W'):
        if k in side: lit |= (side[k] >= 1.4) & (side[k] < 2.4)
    for k in ('S', 'E'):
        if k in side: dark |= (side[k] >= 1.4) & (side[k] < 2.4)
    rgb = np.where(lit[..., None], A.P('sand')[5], rgb)
    rgb = np.where(dark[..., None], A.P('sand')[3], rgb)
    grains = (m < 0) & (m > -1.5) & (hash2(X, Y, 702) > 0.82)
    rgb = np.where(grains[..., None], A.P('sand')[4], rgb)
    return rgb, keep | grains

def drift(): return _cells(drift_shader, 71, 2.6, 2.0, 6.0)
