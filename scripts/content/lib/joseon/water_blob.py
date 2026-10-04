"""8방향 블롭 물 오토타일(47종).

기존 ground.stream() 은 4방향 16마스크라 가장자리가 직각 계단과 돌 둑 점선으로 보였다.
여기서는 칸의 이웃 8칸으로 정해지는 47종을 쓴다. 한 칸을 네 사분면(8×8)으로 나누고, 사분면마다
(옆 변 · 위/아래 변 · 모서리) 세 이웃만 본다 — 그래서 47종으로 충분하고 이웃 칸과 경계가 이어진다.

사분면마다 「가장 가까운 뭍까지의 거리 d」를 정하고 d 로 띠를 칠한다:
    풀 → 풀 가장자리 그늘 → 흙 둑(북쪽 둑은 앞면이라 어둡다) → 모래/자갈 턱 → 얕은 물(밝음) → 중간 물 → 깊은 물(어두움)
- 변이 뭍이면 d = 변까지 거리, 뭍 두 변이 만나는 볼록 모서리는 반지름 R 로 둥글게(R 이 클수록 큰 호),
- 물 두 변 사이의 모서리가 뭍이면(오목) d = 모서리 점까지 거리(원호), 대각선은 이 둘이 이어져 굽는다.
- 모든 거리는 DEEP 에서 멈춘다(사분면 경계 8px 이내) — 그래서 사분면 사이·이웃 칸 사이가 한 화소도 어긋나지 않는다.
- 둑선의 굼실거림은 16화소 주기 함수라 이웃 칸과 이어진다. 변형 v 는 잔물결·얼룩만 바꾼다(경계는 그대로).

mask8 비트: N=1 E=2 S=4 W=8 NE=16 SE=32 SW=64 NW=128 (1 = 그 이웃이 물).
"""
import math
from tk import *

N, E, S, W = 1, 2, 4, 8
NE, SE, SW, NW = 16, 32, 64, 128
R_ROUND = 8.0          # 볼록 모서리 둥글림 반지름(칸 중심을 중심으로 한 사분원)
P_NORM = 1.2           # 2=원호, 1=45도 모따기. 사이로 잡아 대각선 굽이가 이어지게 한다
K_BULGE = 3.4          # 오목 모서리에서 뭍 모서리 부풀림(화소)
CAP = 8.0              # 사분면 안에서 볼 수 있는 최대 거리
# 띠 경계(거리, 화소): 풀 | 둑 그늘 | 흙 턱 | 모래 턱 | 얕은 물 | 중간 물 | 깊은 물
B_GRASS, B_LIP, B_SAND, B_SHAL, B_MID = 1.3, 2.3, 3.4, 6.1, 7.4
WOBBLE = 0.5


def canon(m):
    """모서리 비트는 양쪽 변이 모두 물일 때만 의미가 있다."""
    out = m & 15
    for bit, a, b in ((NE, N, E), (SE, S, E), (SW, S, W), (NW, N, W)):
        if (m & bit) and (m & a) and (m & b):
            out |= bit
    return out


ALL47 = sorted({canon(m) for m in range(256)})
INDEX47 = {m: i for i, m in enumerate(ALL47)}
assert len(ALL47) == 47


def index47(mask8):
    return INDEX47[canon(mask8)]


def _wob(x, y):
    """16 화소 주기 둑선 굼실거림(이웃 칸과 이어진다)."""
    tp = 2 * math.pi / 16
    fx = 0.6 * math.sin(tp * (x + 0.5) + 0.9) + 0.4 * math.sin(2 * tp * (x + 0.5) + 2.1)
    fy = 0.6 * math.sin(tp * (y + 0.5) + 2.6) + 0.4 * math.sin(2 * tp * (y + 0.5) + 0.4)
    return WOBBLE * (fx + fy)


def _dist(px, py, m, right, bottom):
    """사분면(right,bottom) 안 한 점의 가장 가까운 뭍까지 거리. 뭍이 없으면 CAP."""
    h_water = bool(m & (E if right else W))
    v_water = bool(m & (S if bottom else N))
    c_bit = {(1, 0): NE, (1, 1): SE, (0, 1): SW, (0, 0): NW}[(int(right), int(bottom))]
    c_water = bool(m & c_bit)
    dh = (16 - px) if right else px
    dv = (16 - py) if bottom else py
    dh, dv = max(0.0, dh), max(0.0, dv)
    if not h_water and not v_water:
        if dh < R_ROUND and dv < R_ROUND:
            return min(CAP, R_ROUND - ((R_ROUND - dh) ** P_NORM + (R_ROUND - dv) ** P_NORM) ** (1 / P_NORM))
        return min(CAP, dh, dv)
    if not h_water:
        return min(CAP, dh)
    if not v_water:
        return min(CAP, dv)
    if not c_water:
        lo, hi = min(dh, dv), max(dh, dv, 1e-6)
        # 변 쪽(lo→0)에서는 이웃 칸과 같은 값으로 이어지고, 대각선 쪽에서는 뭍 모서리를 더 둥글게 부풀린다
        return min(CAP, (dh ** P_NORM + dv ** P_NORM) ** (1 / P_NORM) - K_BULGE * (lo / hi) ** 1.6)
    return CAP


def water47(mask8, v=0, tone='teal'):
    """mask8 의 이웃 8칸으로 정해지는 물 한 칸(16×16 불투명). tone='blue' 는 깊은 물을 청색(dblue)으로 섞는 국내성용(옛 지도는 teal 그대로)."""
    m = canon(mask8)
    c = Cv(T, T)
    w, e, st, g = RGB['water'], RGB['earth'], RGB['stone'], RGB['leaf']
    bl = RGB['dblue']
    blue = tone == 'blue'
    tt = [[0.0] * T for _ in range(T)]
    face = [[False] * T for _ in range(T)]       # 북쪽 둑(앞면이 보이는 둑)
    shade = [[False] * T for _ in range(T)]      # 빛이 왼쪽 위 → 북·서쪽 둑이 물에 그림자
    for y in range(T):
        for x in range(T):
            right, bottom = x >= 8, y >= 8
            px, py = x + 0.5, y + 0.5
            d = _dist(px, py, m, right, bottom)
            tt[y][x] = d + _wob(x, y) if d < CAP else d
            gx = (_dist(px + 1, py, m, right, bottom) - _dist(px - 1, py, m, right, bottom)) / 2
            gy = (_dist(px, py + 1, m, right, bottom) - _dist(px, py - 1, m, right, bottom)) / 2
            face[y][x] = gy > 0.4 and gy >= abs(gx) * 0.7          # 뭍이 위쪽
            shade[y][x] = (gy > 0.4 and gy >= abs(gx) * 0.5) or (gx > 0.4 and gx >= abs(gy) * 0.5)
    pb = [[0] * T for _ in range(T)]             # 자갈 자리
    for k in range(3):
        x, y = 1 + hsh(k, v, 31) % 13, 1 + hsh(v, k, 37) % 14
        if B_LIP + 0.4 < tt[y][x] < B_SAND - 0.3 and B_LIP + 0.4 < tt[y][x + 1] < B_SAND - 0.3:
            pb[y][x] = 1
    for y in range(T):
        for x in range(T):
            t = tt[y][x]
            q = rnd(x, y, 500 + v * 7 + m)
            q2 = rnd(x, y, 900 + v)
            dith = 0.32 * (1 if (x + y) & 1 else -1)
            if t < B_GRASS:
                col = g[4] if q2 > 0.22 else g[3]
                if q2 > 0.93: col = g[5]
                if face[y][x] and t > B_GRASS - 0.9: col = g[3] if q2 > 0.4 else g[2]   # 북쪽 둑 윗가장자리 그늘
            elif t < B_LIP:
                if face[y][x]: col = e[3] if q > 0.25 else e[2]                      # 북쪽 둑 앞면(어두움)
                else: col = e[5] if q > 0.3 else e[4]
            elif t < B_SAND:
                wet = t > B_SAND - 0.9                                               # 물에 닿은 젖은 모래
                if face[y][x]: col = e[4] if q > 0.25 else e[3]
                elif wet: col = e[4] if q > 0.3 else e[5]
                else: col = e[5] if q > 0.22 else e[4]
                if q < 0.07 and not face[y][x] and not wet: col = e[6]
            else:
                sd = t - B_SAND                                                       # 물가에서 안쪽으로 얼마나 들어왔나
                bay = ((0, 2), (3, 1))[y & 1][x & 1] / 4.0 + 0.125                    # 2×2 정렬 디더: 띠 사이를 무늬 없이 섞는다
                if shade[y][x] and sd < 3.2:                                         # 북·서쪽 둑 밑: 그늘 진 얕은 물
                    col = w[3] if (sd < 1.4 or bay > 0.5) else w[2]
                    if q > 0.95: col = w[2]
                    if blue and sd >= 1.4 and bay <= 0.5: col = bl[3]
                elif sd < 2.0:
                    col = w[4] if q > 0.12 else w[3]                                  # 얕은 물(가장 밝음)
                    if q > 0.97: col = w[5]
                elif sd < 3.2:
                    col = w[4] if bay > (sd - 2.0) / 1.2 else w[3]                    # 밝음 → 중간
                elif sd < 4.0:
                    col = w[3] if q > 0.1 else w[2]
                    if blue and sd > 3.5 and bay > 0.5: col = bl[3]
                elif sd < 4.6:
                    col = w[3] if bay > (sd - 4.0) / 0.6 else w[2]                    # 중간 → 깊음
                    if blue: col = bl[4] if bay > (sd - 4.0) / 0.6 and q > 0.5 else (bl[3] if bay > (sd - 4.0) / 0.6 else w[3])
                else:
                    col = w[2] if q > 0.2 else w[3]
                    if q > 0.985: col = w[1]
                    if blue: col = bl[4] if q > 0.7 else (bl[3] if q > 0.18 else bl[2])   # 깊은 물: 청색 바탕에 밝은·어두운 얼룩
            c.put(x, y, col)
    for y in range(T):                           # 자갈: 2×1 돌 한 쌍(밝은 위, 어두운 아래)
        for x in range(T - 1):
            if pb[y][x]:
                c.put(x, y, st[5]); c.put(x + 1, y, st[4])
                if y + 1 < T and tt[y + 1][x] < B_SAND: c.put(x, y + 1, st[3]); c.put(x + 1, y + 1, st[3])
    for k in range(2 if not blue else 3):       # 잔물결: 가로 3px (중간·깊은 물에만). blue 는 변형마다 자리·길이가 다르다
        x, y = 1 + hsh(k, m, v + 11) % 11, 2 + hsh(m, k, v + 13) % 12
        ln = 3 if not blue else 2 + hsh(k, v, 5) % 3
        if x + ln <= T and all(tt[y][x + i] >= B_SAND + 3.5 for i in range(ln)):
            for i in range(ln):
                c.put(x + i, y, (bl[5] if blue else w[4]) if i < ln - 1 else (bl[5] if blue else w[5]))
            if blue and ln > 2: c.put(x + 1, y, w[4])
    return c


DEEP_MASK = 255


def water_deep_set(n=8):
    """깊은 물(이웃 8칸이 전부 물) 한 칸의 변형 n 종: 물결 자리·길이·방향이 모두 달라 같은 무늬가 격자로 반복되지 않는다. 가장자리가 없어 이웃 칸과 항상 이어진다."""
    out = []
    bl = RGB['dblue']; w = RGB['water']
    for v in range(n):
        c = water47(DEEP_MASK, 100 + v, 'blue')
        # 추가 물결: 변형마다 다른 곳에 짧은 가로 줄과 어두운 얼룩 덩이
        for k in range(1 + v % 3):
            x, y = 1 + hsh(k, v, 61) % 11, 1 + hsh(v, k, 67) % 13
            ln = 2 + hsh(k, v, 71) % 4
            for i in range(ln):
                if x + i < T:
                    c.put(x + i, y, bl[5] if i % 2 == 0 or ln < 4 else w[4])
        if v % 2:
            x, y = 3 + hsh(v, 3, 73) % 8, 4 + hsh(v, 5, 79) % 8
            for dx, dy in ((0, 0), (1, 0), (2, 0), (1, 1)):
                c.put(x + dx, y + dy, bl[1])
        out.append(c)
    return out


def water47_set(variants=2):
    """시트에 넣을 순서: 변형 0 의 47칸, 변형 1 의 47칸 …  (INDEX47[canon(mask)] + 47*v)"""
    return [water47(m, v) for v in range(variants) for m in ALL47]


if __name__ == '__main__':
    from PIL import Image
    tiles = water47_set()
    cols = 12
    rows = (len(tiles) + cols - 1) // cols
    im = Image.new('RGBA', (cols * T * 4, rows * T * 4), (0, 0, 0, 0))
    for i, t in enumerate(tiles):
        im.alpha_composite(t.img().resize((T * 4, T * 4), Image.NEAREST), ((i % cols) * T * 4, (i // cols) * T * 4))
    im.save('/tmp/vqa20/water47_sheet.png')
    print(len(tiles), 'tiles; violations', len(VIOLATIONS))
