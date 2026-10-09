# 사막 성 보정 패스(2026-10-08, WAVE-BRIEF-4) — 시그니처 땅 덩이 오토타일 셋 + 성벽 앞면 변형 조각 셋 + 윤곽 고르기 도우미.
#   autotile-oasis-pond  : 오아시스 연못(물 ↔ 젖은 모래 기슭 ↔ 풀 술), 막힘. 북쪽 둑은 3/4 로 흙 앞면이 보이고 물에 그늘, 남쪽은 밝은 물가.
#   autotile-oasis-grass : 야자 밑 풀 덩이(모래 위), 걷기. 속은 버들항 풀 칩(ground lawn·meadow), 가장자리는 풀잎 술·남쪽 두께 그늘.
#   autotile-dune-crest  : 모래 언덕 덩이(모래 위에 솟은 바람 언덕), 걷기. 북·서 가장자리 밝은 마루, 남쪽 바람그늘 비탈, 동쪽 그늘.
#                          sand_spill(바닥 위로 새어 든 얇은 모래 — 바닥이 비친다)과 달리 모래 땅 위의 「높이」를 그린다.
# 칸 번호 = 위 1 + 오른쪽 2 + 아래 4 + 왼쪽 8 (dp_wl.edge_depth 규약, 기존 autotile-sand-spill 과 같다). 결정적.
import math
from dc_base import *
import ground

OA = [tuple(int(v) for v in c) for c in A.P('oasis')]          # 오아시스 물 7단(desert-pyramid 와 같은 청록)
LAWN_T = ground.tex(*ground.TEX['lawn']); MEAD_T = ground.tex(*ground.TEX['meadow']); SHADE_T = ground.tex(*ground.TEX['shade'])
LF = [hx(c) for c in PAL['leaf']]                               # 버들항 잎 램프(풀 술·그늘)
GDARK, GMID, GLIT, GTIP = LF[3], LF[4], LF[5], LF[6]

def edge_taper(n, inset, jag, rad, seed, size=16, foot=0.4, ramp=4.5):
    """dp_wl.edge_depth 와 같은 규약이지만 물가 들어감(inset+jag)이 칸 모서리로 갈수록 foot 까지 줄어든다.
    4비트 오토타일은 대각 이웃을 모르므로, 오목한 모서리에서 「이웃이 다 있는」 칸의 모서리가 inset 만큼 네모 혹으로 튀어나온다.
    모서리 쪽 들어감을 거의 0 으로 만들어 그 혹을 없앤다(물가 굴곡은 칸 가운데에서 낸다)."""
    X, Y = np.meshgrid(np.arange(size), np.arange(size))
    miss = {'N': not (n & 1), 'E': not (n & 2), 'S': not (n & 4), 'W': not (n & 8)}
    j = {k: wl.tnoise1(size, 4, seed + i + 1) for i, k in enumerate('NSWE')}
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
    return m, miss

def side_m(n, side, inset, jag, rad, seed, fn=None):
    """이웃 없는 한쪽(side)만 본 가장자리 깊이(같은 잡음이라 combined m 과 이어진다). 그쪽에 이웃이 있으면 99."""
    bit = {'N': 1, 'E': 2, 'S': 4, 'W': 8}[side]
    if n & bit: return np.full((16, 16), 99.0)
    m, _ = (fn or wl.edge_depth)(15 & ~bit, inset, jag, rad, seed)
    return m

def nearest(n, inset, jag, rad, seed, fn=None):
    """화소마다 가장 가까운 빈 쪽(N/E/S/W 또는 '' = 속)과 그 거리."""
    ms = {k: side_m(n, k, inset, jag, rad, seed, fn) for k in 'NESW'}
    st = np.stack([ms[k] for k in 'NESW']); idx = st.argmin(0); dmin = st.min(0)
    lab = np.array(list('NESW'))[idx]; lab = np.where(dmin >= 50, '', lab)
    return lab, ms

# ================================================================ 보정 4차(적대 검수 desert-castle.md 3·4·5번): 변형마다 다른 가장자리
# 옛 판은 네 변 잡음이 변형 번호와 무관(edge_taper 의 j[k] = 쪽만 보고 seed 고정)해서 16변형의 북쪽 변이 전부 같은 곡선이었고,
# tnoise1(sc=4)·칸 끝 foot 로 빠지는 들어감 탓에 칸마다 같은 톱니 셋(풀)·같은 마디(언덕 능선)가 16px 주기로 박혔다.
# 새 판: 쪽마다 칸 끝 두 점에서 같은 깊이(foot)로 고정한 「끝이 0 인 사인 1~3배음」 곡선을 변형 번호 n 과 쪽으로 씨를 갈라 만든다.
#   - 칸 끝 깊이는 모든 변형이 같으므로 어느 조합으로 붙어도 이어진다(이음 튐 ≤ 1px).
#   - 가운데 굽이는 변형마다 다르다(혹 하나·만 하나·S자 …) → 모서리·코·곧은 변 칸이 서로 다른 윤곽을 낸다.
#   - 1px 잔 털(풀잎 끝·알갱이)은 칸 안 해시로 따로 얹는다.
# 한계: 4방향 16변형은 「같은 이웃 조합 = 같은 그림」이라 곧은 변이 3칸 이상 이어지면 그 칸들은 여전히 같다. 그래서 굽이를
#   낮고 비대칭인 물결 하나로 두어(뾰족한 톱니 금지) 되풀이가 「물결」로 읽히게 하고, 배치도 덩이 외곽(pack-layout-replay rough)을
#   울퉁불퉁하게 해 곧은 변 자체를 2칸 안팎으로 끊는다.
SIDE_I = {'N': 0, 'E': 1, 'S': 2, 'W': 3}
def lobe(n, side, seed, size=16, kmax=3):
    """칸 끝 두 점에서 0 인 굽이 곡선(-1..1). 변형 n·쪽마다 다르다."""
    rng = np.random.default_rng(seed * 131 + n * 17 + SIDE_I[side] * 5 + 7)
    u = (np.arange(size) + 0.5) / size
    c = rng.uniform(-1, 1, kmax) / np.arange(1, kmax + 1) ** 0.8
    ph = rng.uniform(-0.15, 0.15, kmax)
    b = sum(c[k] * np.sin(np.pi * (k + 1) * np.clip(u + ph[k] * u * (1 - u) * 4, 0, 1)) for k in range(kmax))
    return b / max(1e-6, np.abs(b).max())

def edge_var(n, inset, jag, rad, seed, foot, ramp, size=16):
    """변형 n 의 가장자리 깊이장(m)과 쪽별 거리(d), 이웃 없는 쪽(miss). 규약은 dp_wl.edge_depth 와 같다(m<0 = 칸 밖)."""
    X, Y = np.meshgrid(np.arange(size), np.arange(size))
    miss = {'N': not (n & 1), 'E': not (n & 2), 'S': not (n & 4), 'W': not (n & 8)}
    def tap(t): return np.clip(np.minimum(t + 0.5, size - 0.5 - t) / ramp, 0, 1)
    def prof(k, t): return foot + tap(t) * (inset - foot) + lobe(n, k, seed)[t] * jag
    d = {'N': Y - prof('N', X), 'S': (size - 1 - Y) - prof('S', X), 'W': X - prof('W', Y), 'E': (size - 1 - X) - prof('E', Y)}
    m = np.full((size, size), 99.0)
    for k in 'NESW':
        if miss[k]: m = np.minimum(m, d[k])
    for a, b in (('N', 'W'), ('N', 'E'), ('S', 'W'), ('S', 'E')):
        if miss[a] and miss[b]:
            da, db = d[a], d[b]; sel = (da < rad) & (db < rad)
            m = np.where(sel, np.minimum(m, rad - np.hypot(rad - da, rad - db)), m)
    big = {k: (d[k] if miss[k] else np.full((size, size), 99.0)) for k in 'NESW'}
    st = np.stack([big[k] for k in 'NESW']); idx = st.argmin(0)
    lab = np.where(st.min(0) >= 50, '', np.array(list('NESW'))[idx])
    return m, lab, big, miss

# ================================================================ 오토타일 1: 오아시스 연못(막힘)
DEEPN = wl.tnoise(16, 16, 8, 819)
PT = dict(foot=0.7, ramp=8.0)                                       # 못: 물가가 칸마다 낮은 물결로 굽이친다(뾰족한 혹 없음)
def _pt(n, inset, jag, rad, seed): return edge_taper(n, inset, jag, rad, seed, **PT)
def pond_cell(n, seed=811):
    inset, jag, rad = 2.9, 1.3, 7.0
    m, miss = _pt(n, inset, jag, rad, seed)
    lab, ms = nearest(n, inset, jag, rad, seed, _pt)
    rgb = np.zeros((16, 16, 3), np.uint8); al = np.zeros((16, 16), np.uint8)
    for y in range(16):
        for x in range(16):
            v = m[y, x]; sd = lab[y, x]
            if v < -1.4: continue
            if v < 0:                                                   # 칸 밖 끝: 성긴 풀잎 끝(바깥 땅이 비친다)
                if wl.hash2(x + n * 16, y, seed + 1) > 0.83 and sd != 'N': rgb[y, x] = GMID; al[y, x] = 255
                continue
            # 북쪽 둑(3/4): 물가가 흙 앞면으로 보인다 — 풀 술 1 · 젖은 모래 윗면 1 · 흙 앞면 2 · 물에 진 그늘 2
            if sd == 'N':
                if v < 0.8: c = GLIT if wl.hash2(x, y, seed + 2) > 0.45 else GMID
                elif v < 1.6: c = SA[3] if wl.hash2(x, y, seed + 3) > 0.3 else SA[4]
                elif v < 2.4: c = SA[2]
                elif v < 3.2: c = SA[1] if wl.hash2(x, y, seed + 4) > 0.25 else BR[1]
                elif v < 4.0: c = OA[1]
                elif v < 4.8: c = OA[2] if wl.hash2(x, y, seed + 5) > 0.35 else OA[1]
                else: c = None
            else:
                if v < 0.8: c = GMID if wl.hash2(x + n, y, seed + 6) > 0.4 else GDARK          # 풀 술
                elif v < 1.8: c = SA[2] if wl.hash2(x, y, seed + 7) > 0.35 else SA[3]          # 젖은 모래 기슭
                elif v < 2.5: c = OA[6] if sd in ('S', 'W') else OA[5]                         # 물가 빛 테
                elif v < 3.6: c = OA[4]
                elif v < 4.6: c = OA[3]
                else: c = None
            if c is None:                                               # 물 속: 한 톤 + 잔물결 줄(16 주기 — 속 칸끼리 이음새·계단 없음)
                c = OA[2]
                rp = (y + int(round(math.sin(2 * math.pi * x / 16) * 1.3))) % 8
                if rp == 3 and wl.hash2(x // 3, y, seed + 9) > 0.45: c = OA[3]
                elif rp == 4 and wl.hash2((x + 1) // 3, y, seed + 9) > 0.62: c = OA[1]
                if rp == 3 and wl.hash2(x, y, seed + 10) > 0.93: c = OA[5]
            rgb[y, x] = c; al[y, x] = 255
    return Image.fromarray(np.dstack([rgb, al]), 'RGBA')

def pond_sheet(): return wl.sheet_from_cells([pond_cell(n) for n in range(16)])

# ================================================================ 오토타일 2: 오아시스 풀 덩이(걷기)
# 보정 3차(조수 시험 dc3): 옛 판은 칸 모서리까지 깊이 2.4±3px 그대로(edge_depth) — 오목한 모서리에 네모 혹·곧은 세로 토막이 남았고
#   바깥 모서리 반지름 7 이 작아 덩이가 네모로 읽혔다. 새 판: 칸 모서리로 갈수록 들어감을 1px 로 모으고(edge_taper),
#   칸 가운데에서 깊이 1~7.6px 의 굵은 혹·만을 내고, 바깥 모서리 반지름 13 으로 둥글게 깎는다.
GT = dict(foot=1.0, ramp=5.5)
def _gt(n, inset, jag, rad, seed): return edge_taper(n, inset, jag, rad, seed, **GT)
def grass_cell(n, seed=821, v1=False):
    if v1:                                                          # 옛 판(비교 시트용)
        inset, jag, rad = 2.4, 3.0, 7.0
        m, miss = wl.edge_depth(n, inset, jag, rad, seed); lab, ms = nearest(n, inset, jag, rad, seed)
    else:
        inset, jag, rad = 4.2, 3.4, 13.0
        m, miss = _gt(n, inset, jag, rad, seed)
        lab, ms = nearest(n, inset, jag, rad, seed, _gt)
    meadow = wl.tnoise(16, 16, 8, seed + 1) > 0.52                    # 16 주기: 속 칸끼리 이어진다
    rgb = np.zeros((16, 16, 3), np.uint8); al = np.zeros((16, 16), np.uint8)
    for y in range(16):
        for x in range(16):
            v = m[y, x]; sd = lab[y, x]
            if v < -2.2: continue
            if v < 0:                                                   # 칸 밖: 모래 위로 삐죽 나온 풀잎(1~2px 세로)
                h = wl.hash2(x + n * 16, y, seed + 2)
                if h > 0.86: rgb[y, x] = GMID; al[y, x] = 255
                elif h > 0.80 and y < 15 and m[y + 1, x] >= 0: rgb[y, x] = GDARK; al[y, x] = 255
                continue
            c = tuple(MEAD_T[y, x]) if meadow[y, x] else tuple(LAWN_T[y, x])
            if v < 1.2:                                                 # 풀 술(들쭉날쭉, 일부는 모래가 비친다)
                h = wl.hash2(x, y + n * 16, seed + 3)
                if h < 0.28: continue
                c = GDARK if sd == 'S' else (GLIT if sd in ('N', 'W') and h > 0.7 else GMID)
            elif v < 2.2:
                if sd == 'S': c = GDARK                                 # 남쪽: 풀 깔개 두께 그늘
                elif sd in ('N', 'W'): c = GLIT if wl.hash2(x, y, seed + 4) > 0.35 else c
                elif sd == 'E': c = tuple(SHADE_T[y, x])
            elif v < 3.2 and sd == 'S':
                c = tuple(SHADE_T[y, x])
            # 속 잔 풀포기(3px V자) — 16 주기
            if v >= 3.2 and wl.hash2(x // 4, y // 4, seed + 5) > 0.72 and (x % 4, y % 4) in ((1, 1), (2, 2), (3, 1)):
                c = GLIT if (x % 4) == 1 else GDARK
            rgb[y, x] = c; al[y, x] = 255
    return Image.fromarray(np.dstack([rgb, al]), 'RGBA')

def grass_sheet(v1=False): return wl.sheet_from_cells([grass_cell(n, v1=v1) for n in range(16)])

# ================================================================ 오토타일 3: 모래 언덕 덩이(걷기)
def dune_cell(n, seed=831):
    inset, jag, rad = 2.6, 3.4, 7.5
    m, miss = edge_taper(n, inset, jag, rad, seed)
    lab, ms = nearest(n, inset, jag, rad, seed, edge_taper)
    rgb = np.zeros((16, 16, 3), np.uint8); al = np.zeros((16, 16), np.uint8)
    for y in range(16):
        for x in range(16):
            v = m[y, x]; sd = lab[y, x]
            if v < -1.8: continue
            if v < 0:                                                   # 바람에 날린 알갱이
                if wl.hash2(x + n * 16, y, seed + 1) > 0.88: rgb[y, x] = SA[5] if sd in ('N', 'W') else SA[3]; al[y, x] = 255
                continue
            # 속은 투명(바탕 모래가 그대로) — 덩이의 남·동 가장자리에만 언덕 마루(밝은 선)와 바람그늘 비탈을 그린다.
            # 그래서 덩이 모양을 칠하면 그 남쪽 윤곽을 따라 굽이치는 언덕 능선이 생긴다(성 밖 모래 언덕 물체와 같은 읽힘).
            h = wl.hash2(x + n * 16, y, seed + 2)
            if sd in ('S', 'E'):
                k = 1.0 if sd == 'S' else 0.65                          # 동쪽은 비탈이 좁다
                L = 7.0 * k + (wl.hash2(x // 5, 3, seed + 8) - 0.5) * 1.6  # 비탈 폭(밑동 → 마루), 조금씩 흔든다
                if v < 1.0:
                    if h > 0.5: continue
                    c = SA[3]
                elif v < L - 1.2: c = (SA[3] if h > 0.18 else SA[2]) if v > 2.2 else (SA[3] if h > 0.45 else SA[4])   # 바람그늘 비탈(위로 짙게)
                elif v < L: c = SA[2]                                   # 마루 바로 밑 짙은 줄
                elif v < L + 1.0: c = SA[6]                             # 날카로운 마루
                elif v < L + 3.0: c = SA[5]                             # 바람받이 밝은 비탈
                elif v < L + 5.0:
                    if h > 0.75 - (v - L - 3.0) * 0.3: continue
                    c = SA[5]
                else: continue
            else:                                                       # 속·바람받이: 성긴 잔물결 빛만
                rp = (y + int(round(math.sin(2 * math.pi * x / 16 + 0.6) * 1.0))) % 8
                if rp == 4 and wl.hash2(x // 3, y, seed + 6) > 0.55: c = SA[5]
                elif rp == 5 and wl.hash2(x // 3, y, seed + 6) > 0.55 and wl.hash2(x, y, seed + 7) > 0.4: c = SA[3]
                else: continue
            rgb[y, x] = c; al[y, x] = 255
    return Image.fromarray(np.dstack([rgb, al]), 'RGBA')

def dune_sheet(): return wl.sheet_from_cells([dune_cell(n) for n in range(16)])

# ================================================================ 오토타일 시험 그림(check-autotile.png)
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
 'block5': ["........",
            ".XXXXX..",
            ".XXXXX..",
            ".XXXXX..",
            ".XXXXX..",
            ".XXXXX..",
            "........"],
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
def stamp(sheet, rows, bg):
    h = len(rows); w = len(rows[0]); out = Image.new('RGBA', (w * 16, h * 16))
    for y in range(h):
        for x in range(w): out.alpha_composite(bg, (x * 16, y * 16))
    on = lambda x, y: 0 <= x < w and 0 <= y < h and rows[y][x] == 'X'
    for y in range(h):
        for x in range(w):
            if not on(x, y): continue
            k = (1 if on(x, y - 1) else 0) | (2 if on(x + 1, y) else 0) | (4 if on(x, y + 1) else 0) | (8 if on(x - 1, y) else 0)
            out.alpha_composite(sheet.crop(((k % 4) * 16, (k // 4) * 16, (k % 4) * 16 + 16, (k // 4) * 16 + 16)), (x * 16, y * 16))
    return out

def sand_tile():
    X, Y = np.meshgrid(np.arange(16), np.arange(16))
    nz = A.Noise(16, 16)
    s_ = A.sand_rgb(X, Y, nz, np.full((16, 16), 0.4), seed=731)
    return Image.fromarray(np.dstack([s_.astype(np.uint8), np.full((16, 16), 255, np.uint8)]), 'RGBA')
def lawn_tile(): return Image.fromarray(np.dstack([LAWN_T, np.full((16, 16), 255, np.uint8)]), 'RGBA')

def check_sheet(path, scale=3):
    from PIL import ImageDraw
    sand = sand_tile(); lawn = lawn_tile()
    rows = [('autotile-oasis-pond (on grass)', pond_sheet(), lawn), ('autotile-oasis-pond (on sand)', pond_sheet(), sand),
            ('autotile-oasis-grass (on sand)', grass_sheet(), sand), ('autotile-dune-crest (on sand)', dune_sheet(), sand)]
    blocks = []
    for (title, sh, bg) in rows:
        raw = Image.new('RGBA', (64 + 12, 64 + 12)); raw.alpha_composite(Image.new('RGBA', (76, 76), (40, 40, 46, 255)))
        for k in range(16): raw.alpha_composite(bg, (6 + (k % 4) * 16, 6 + (k // 4) * 16))
        raw.alpha_composite(sh, (6, 6))
        ims = [raw] + [stamp(sh, SHAPES[k], bg) for k in ('block5', 'blob5', 'spiral', 'nose_L')]
        blocks.append((title, ims))
    hgt = max(max(i.height for i in ims) for _, ims in blocks)
    W = max(sum(i.width for i in ims) + 10 * len(ims) for _, ims in blocks)
    o = Image.new('RGBA', (W * scale + 10, len(blocks) * (hgt * scale + 24) + 6), (24, 24, 28, 255)); d = ImageDraw.Draw(o)
    for r, (title, ims) in enumerate(blocks):
        y = 6 + r * (hgt * scale + 24); d.text((8, y), title + '   [16 variants | 5x5 block | blob | spiral | L + nose]', fill=(235, 235, 235, 255))
        x = 6
        for im in ims:
            o.alpha_composite(im.resize((im.width * scale, im.height * scale), Image.NEAREST), (x, y + 16)); x += im.width * scale + 10 * scale
    o.convert('RGB').save(path)

# ================================================================ 성벽 앞면 변형 조각(앞면이 평평하던 것 보정) — wall_front 의 앞면 줄 위에 덧그림
# wall_front 그림(80px) 좌표: 앞면 24~79, 층 띠 44~47, 화살 구멍 53~62, 받침돌 73~79. 조각은 그림 아래끝에 맞춰 찍는다
# (2x2 = 아래 2줄 = 벽 y48~79, 2x3 = 아래 3줄 = 벽 y32~79). 칸 경계(16px)에 맞추면 마름돌 줄눈(8px 줄)과 맞는다.
def _blk(X, Y, bw, bh, seed, base, lit=0.0):
    """작은 마름돌 한 화소: 줄마다 반장 어긋남, 위·왼 모 밝게, 아래·오른 모 어둡게, 돌마다 톤. 줄눈 = None."""
    row = Y // bh; off = (row % 2) * (bw // 2); xx = X + off; col = xx // bw; lx = xx % bw; ly = Y % bh
    if ly == bh - 1 or lx == bw - 1: return None
    h = H_(col, row, seed)
    c = mix(base, SS[5], 0.35 + lit) if h > 0.6 else (mix(base, SS[3], 0.25) if h < 0.25 else base)
    if ly == 0 or lx == 0: c = mix(c, SS[6], 0.45)
    elif ly == bh - 2 or lx == bw - 2: c = mix(c, SS[2], 0.3)
    if H_(X, Y, seed + 1) < 0.05: c = mix(c, SS[3], 0.5)
    return c

def wall_face_repair(seed=901):
    """2x2(아래 2줄): 무너진 자리를 작은 새 돌로 다시 쌓은 보수 자국 — 줄눈이 촘촘한 8x4 작은 마름돌(줄눈 변화), 옅은 새 석회 줄눈,
    들쭉날쭉한 둘레에 덧바른 회반죽 테, 위 귀퉁이에 옛 큰 돌 하나가 걸쳐 남았다. 받침돌은 덮지 않는다."""
    W, H = 32, 32; px = Px(W, H)
    def r(x, y):                                                        # 보수 자리 모양(불규칙 덩이, 벽 y50~72)
        cx, cy = 15.5 + 1.5 * math.sin(y / 3.0), 12.5
        rx = 12.5 + 1.6 * math.sin(y / 2.2 + 1) + (H_(y // 2, 1, seed) - 0.5) * 2
        ry = 10.5 + (H_(x // 3, 2, seed) - 0.5) * 2.4
        return ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2
    for y in range(1, 25):
        for x in range(W):
            d = r(x, y)
            if d > 1.12: continue
            if d > 1.0:                                                 # 옛 벽과 새 돌 사이 이음 금(짙은 줄 + 바깥 회반죽 점)
                px.put(x, y, SS[1] if d < 1.06 else (SA[4] if H_(x, y, seed + 2) > 0.5 else SS[2]))
                continue
            c = _blk(x, y + 2, 8, 4, seed + 3, mix(SS[4], SS[3], 0.15), -0.2)
            px.put(x, y, mul(c, 0.93) if c is not None else (SS[3] if H_(x, y, seed + 4) > 0.35 else SS[2]))   # 새 줄눈(촘촘, 옛 줄눈보다 옅다)
    for y in range(3, 10):                                              # 옛 큰 돌 하나가 걸쳐 남음(왼쪽 위)
        for x in range(3, 13):
            if r(x, y) <= 1.0:
                c = mul(stone(x, y + 24, seed=0), 0.93)
                if y == 3 or x == 3: c = mix(c, SS[6], 0.4)
                if y == 9 or x == 12: c = SS[2]
                px.put(x, y, c)
    for x in range(W):                                                  # 보수 밑 물 자국(받침돌 위로 옅은 얼룩)
        if r(x, 23) <= 1.0 and H_(x, 9, seed + 5) > 0.5: px.put(x, 24, mul(SS[3], 0.95), 160)
    return px.im

def wall_face_crack(seed=911):
    """2x3(아래 3줄): 층 띠 밑에서 받침돌까지 줄눈을 따라 계단꼴로 내려가는 큰 균열(속 어둠 1px + 오른쪽 그늘 어깨 + 왼위 밝은 입술),
    균열 곁 마름돌 모서리 하나가 떨어져 거친 속돌이 드러났고, 받침돌 위에 떨어진 돌 조각과 모래 한 줌."""
    W, H = 32, 48; px = Px(W, H)
    # 층 띠(벽 44~47) = 조각 y12~15. 균열은 y16 에서 시작해 받침돌 윗선(벽 73 = 조각 41)까지
    pts = [(21, 16), (21, 19), (17, 20), (17, 23), (18, 27), (13, 28), (13, 31), (12, 35), (8, 36), (8, 39), (6, 41)]
    path = []
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = max(abs(x1 - x0), abs(y1 - y0))
        for i in range(n + 1):
            path.append((round(x0 + (x1 - x0) * i / max(1, n)), round(y0 + (y1 - y0) * i / max(1, n))))
    seen = set()
    for (x, y) in path:
        if (x, y) in seen: continue
        seen.add((x, y))
        px.put(x, y, SS[0]); px.put(x + 1, y, SS[1] if 22 < y < 36 else SS[2], 230); px.put(x + 2, y, SS[3], 120)
        if H_(x, y, seed) > 0.5: px.put(x - 1, y, SS[6], 200)
    for (x, y) in ((22, 14), (23, 13), (22, 15)): px.put(x, y, SS[1])  # 층 띠까지 번진 실금
    # 떨어져 나간 모서리(균열 오른쪽, 벽 y57~63 = 조각 y25~31)
    for y in range(24, 32):
        for x in range(18, 27):
            u = (x - 18) + (y - 24) * 0.9
            if u > 9.5 - (H_(y, 3, seed) * 2): continue
            c = mix(SS[3], BR[3], 0.45) if H_(x // 2, y // 2, seed + 1) > 0.4 else mix(SS[2], BR[2], 0.4)
            if y == 24 or u > 8.3 - H_(y, 3, seed) * 2: c = SS[1] if y == 24 else SS[2]   # 깨진 단면 위 그늘·가장자리
            if x == 18: c = SS[2]
            px.put(x, y, c)
    for (x, y, c) in ((9, 43, SS[5]), (10, 43, SS[4]), (11, 44, SS[3]), (21, 44, SS[5]), (22, 44, SS[4]), (22, 43, SS[6]), (15, 45, SS[4])):
        px.put(x, y, c)                                                 # 떨어진 돌 조각(받침돌 위)
    for x in range(3, 14):                                              # 발치 모래 한 줌
        hh = int(2.6 - abs(x - 8) * 0.45)
        for k in range(max(0, hh)): px.put(x, 47 - k, SA[5] if k == hh - 1 else SA[4])
    return px.im

def wall_face_lattice(seed=921):
    """2x3(아래 3줄): 사막 성 앞면에 내민 나무 살창 창(덧창 상자) — 위 처마판, 마름모 격자 살(왼쪽 밝고 오른쪽 어둡다, 틈은 어둠),
    두꺼운 틀, 창턱, 두 나무 까치발, 벽에 진 그늘. 화살 구멍 자리를 덮는다. 글자·문장 없음."""
    W, H = 32, 48; px = Px(W, H)
    x0, x1, yt, yb = 6, 26, 9, 33
    for y in range(yb + 1, yb + 9):                                     # 벽에 진 그늘(오른쪽·아래, 반투명)
        for x in range(x0 + 3, x1 + 3):
            if y < yb + 3 or x in (x0 + 4, x0 + 5, x1 - 4, x1 - 3): px.put(x, y, SHADOW, 90)
    for y in range(yt + 2, yb + 2):
        for x in (x1, x1 + 1, x1 + 2): px.put(x, y, SHADOW, 90 if x < x1 + 2 else 50)
    for y in range(yt, yb + 1):
        for x in range(x0, x1):
            u = x - x0; v = y - yt
            if u < 2 or u >= x1 - x0 - 2 or v < 2 or v >= yb - yt - 1:   # 틀
                c = WOOD[4] if u < 2 or v < 2 else WOOD[2]
                if u == 0 or v == 0: c = WOOD[5]
            else:
                lit = u < (x1 - x0) * 0.45
                if v in (12, 13): c = WOOD[4] if v == 12 else WOOD[2]  # 가운데 가로대
                elif (u + v) % 6 == 0 or (u - v) % 6 == 0: c = WOOD[5] if lit else WOOD[4]   # 마름모 살(6px)
                elif (u + v) % 6 == 1 or (u - v) % 6 == 5: c = WOOD[3] if lit else WOOD[2]
                else: c = mix(DARK7[3], FIRE[2], 0.25) if lit else DARK7[2]   # 살 틈: 어두운 속(따뜻한 실내)
                if v == 2: c = WOOD[1]                                  # 처마 밑 그늘 한 줄
            px.put(x, y, c)
    for x in range(x0 - 2, x1 + 2):                                     # 처마판(내민 판: 윗면 밝음 · 앞모 · 밑 그늘)
        px.put(x, yt - 3, WOOD[6] if x < (x0 + x1) // 2 else WOOD[5]); px.put(x, yt - 2, WOOD[4]); px.put(x, yt - 1, WOOD[2])
    for x in range(x0 - 1, x1 + 1):                                     # 창턱
        px.put(x, yb + 1, WOOD[5]); px.put(x, yb + 2, WOOD[2])
    for bx in (x0 + 2, x1 - 5):                                         # 까치발(위 넓고 아래 좁은 나무 받침)
        for k in range(6):
            for j in range(max(1, 3 - k // 2)):
                px.put(bx + j, yb + 3 + k, WOOD[4] if j == 0 else WOOD[2])
    return fin_sel(px.im, 'NESW', k=0.7)

WALL_DECALS = ('wall_face_repair', 'wall_face_crack', 'wall_face_lattice')
def decorate(img, items):
    """성벽 그림에 앞면 변형 조각을 칸 열(cx) 에 맞춰 덧그린다(그림 아래끝 기준)."""
    out = img.copy()
    for (n, cx) in items:
        d = globals()[n](); out.alpha_composite(d, (cx * 16, out.height - d.height))
    return out

if __name__ == '__main__':
    import sys
    check_sheet(sys.argv[1] if len(sys.argv) > 1 else HERE + '/check-autotile.png')
