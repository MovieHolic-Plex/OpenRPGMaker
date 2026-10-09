# 자연 숲 마당 16변형 오토타일(칸 번호 = 위 1 + 오른쪽 2 + 아래 4 + 왼쪽 8, 왼쪽 위 칸이 0, 가로 4칸씩 증가).
#  autotile-canopy-wall  수관 벽 바깥 테(막힘·위층): 둥근 잎 덩이 끝(밝은 회록) → 중간 잎 → 짙은 잎 — 속 칸(15)은 짙은 잎 결.
#  autotile-canopy-core  수관 벽 속 어둠(막힘·위층): 짙은 잎 끝 테 → 검정. canopy-wall 덩이 안쪽에 1~2칸 줄여 겹쳐 칠하면
#                        「밝은 잎 → 중간 → 짙은 → 검정」 4겹 깊이가 된다(맵 바깥 미탐색 어둠).
#  autotile-dirt-path    맨땅 길 얼룩(걷기·아래층): 다진 흙 속 ↔ 얼룩지게 흩어지는 가장자리 ↔ 풀 위 흙 점.
#  autotile-pond         돌 가장자리 연못(막힘·아래층): 짙은 청록 물 ↔ 갈색 돌 띠(북쪽 둑은 3/4 로 돌 앞면 + 물에 그늘).
#  autotile-tallgrass    짙은 풀숲 덩이(걷기·아래층): 빽빽한 풀 포기, 가장자리 잎끝이 삐죽, 남쪽 두께 그늘.
#  autotile-garden-fence 채소밭 말뚝 울타리(막힘·위층, 곧은 것이 맞는 구조물).
# 덩이형 가장자리는 bleak-moor/desert-castle 의 edge_taper 식(nfc_base 사본) 또는 칸 끝이 맞물리는 덩이 윤곽(_lobe_prof)을 쓴다. 결정적.
import math
from nfc_base import *
from px2 import _hash
import nfc_ground as G

GR = R7('nfgrass'); DI = R7('nfdirt'); CA = R7('nfcan'); RI = R7('nfrim'); WA = R7('nfwater'); PL = R7('nfplank'); BK = R7('nfbark')
X16, Y16 = np.meshgrid(np.arange(16), np.arange(16))


# ================================================================ 덩이 윤곽(칸 끝이 맞물리는 잎 덩이)
# 이웃 없는 변의 윤곽 깊이 e(t): 칸 끝(t=0·15)은 얕게(≈1.2px, 이웃 칸·속 칸과 높이가 맞는다 → 오목한 모서리에 계단이 거의 없다),
# 칸 안 두 곳(t≈4.5, ≈11)에 깊은 홈 → 칸 경계를 넘는 8px 덩이 + 가운데 6px 덩이가 번갈아 이어진다. 변마다 홈 깊이·자리 조금 다름.
def _lobe_prof(side, seed, size=16):
    t = np.arange(size) + 0.5
    k = {'N': 0, 'E': 1, 'S': 2, 'W': 3}[side]
    p1 = 4.4 + (_hash(k, 1, seed) - 0.5) * 1.2; p2 = 11.2 + (_hash(k, 2, seed) - 0.5) * 1.2
    d1 = 4.6 + _hash(k, 3, seed) * 1.6; d2 = 5.2 + _hash(k, 4, seed) * 1.6
    w1 = 2.3 + _hash(k, 5, seed) * 0.6; w2 = 2.5 + _hash(k, 6, seed) * 0.6
    e = 1.2 + d1 * np.exp(-((t - p1) / w1) ** 2) + d2 * np.exp(-((t - p2) / w2) ** 2)
    e += (tnoise1(size, 2, seed + 10 + k) - 0.5) * 1.0 * np.sin(np.pi * t / size)   # 잔 잎 톱니(칸 끝은 0)
    return e


def lobe_field(n, seed, rad=6.0, size=16):
    """m(<0 칸 밖, >=0 덩이 안 깊이 px)와 가장 가까운 빈 변 이름."""
    X, Y = np.meshgrid(np.arange(size), np.arange(size))
    miss = {'N': not (n & 1), 'E': not (n & 2), 'S': not (n & 4), 'W': not (n & 8)}
    d = {'N': Y - _lobe_prof('N', seed)[X], 'S': (size - 1 - Y) - _lobe_prof('S', seed)[X],
         'W': X - _lobe_prof('W', seed)[Y], 'E': (size - 1 - X) - _lobe_prof('E', seed)[Y]}
    m = np.full((size, size), 99.0); lab = np.full((size, size), '', dtype='<U1')
    for k in 'NESW':
        if miss[k]:
            sel = d[k] < m; m = np.where(sel, d[k], m); lab = np.where(sel, k, lab)
    for a, b in (('N', 'W'), ('N', 'E'), ('S', 'W'), ('S', 'E')):
        if miss[a] and miss[b]:
            da, db = d[a], d[b]; sel = (da < rad) & (db < rad)
            m = np.where(sel, np.minimum(m, rad - np.hypot(rad - da, rad - db)), m)
    return m, lab


# ================================================================ 1·2. 수관 벽(테) · 수관 속 어둠
LEAFN = tnoise(16, 16, 4, 911) * 0.55 + tnoise(16, 16, 2, 912) * 0.25 + hash2(X16, Y16, 913) * 0.20   # 잎 덩이 결(16 감김)
LEAFS = LEAFN - np.roll(np.roll(LEAFN, 1, 0), 1, 1)                                                 # 왼쪽 위를 보는 잎은 +


def leaf_tone(depth, x, y, bias=0.0):
    """수관 잎 화소 톤: 윤곽에서 안으로 깊이(px)에 따라 6→1, 잎 결로 ±1, 빛 받는 잎(왼쪽 위 비탈) +1."""
    tb = 5.4 - depth * 0.62 + bias
    l = LEAFN[y % 16, x % 16]; sl = LEAFS[y % 16, x % 16]
    t = tb + (l - 0.5) * 2.0 + (0.8 if sl > 0.10 else 0) - (0.7 if sl < -0.10 else 0)
    return t


def canopy_cell(n, seed=921):
    m, lab = lobe_field(n, seed)
    rgb = np.zeros((16, 16, 3), np.uint8); al = np.zeros((16, 16), np.uint8)
    for y in range(16):
        for x in range(16):
            v = m[y, x]; sd = lab[y, x]
            if v < -1.6: continue
            if v < 0:                                                   # 덩이 밖으로 삐죽 나온 잎끝
                if hash2(x + n * 16, y, seed + 1) > 0.70 and sd != 'S':
                    rgb[y, x] = CA[5] if sd in ('N', 'W') else CA[4]; al[y, x] = 255
                elif sd == 'S' and hash2(x + n * 16, y, seed + 2) > 0.80:
                    rgb[y, x] = CA[3]; al[y, x] = 255
                continue
            bias = 0.35 if sd in ('N', 'W') else (-0.45 if sd == 'S' else 0.0)
            t = leaf_tone(min(v, 99), x, y, bias)
            if v >= 50: t = 1.5 + (LEAFN[y, x] - 0.5) * 1.6 + (0.6 if LEAFS[y, x] > 0.12 else 0)   # 속 칸: 짙은 잎 결(1~2단)
            if v < 0.8 and hash2(x, y + n * 16, seed + 3) < 0.22: continue  # 윤곽 1px 들쭉날쭉
            t = int(round(max(1, min(6, t))))
            if v < 1.0 and t > 3: t = max(3, t - 1) if sd == 'S' else t
            rgb[y, x] = CA[t]; al[y, x] = 255
    # 윤곽 바로 밖 1px 은 짙은 잎 그림자(덩이가 바닥에서 떠 보이지 않게): 남쪽만
    return Image.fromarray(np.dstack([rgb, al]), 'RGBA')


def canopy_sheet(): return sheet_from_cells([canopy_cell(n) for n in range(16)])


def core_cell(n, seed=941):
    m, lab = lobe_field(n, seed, rad=6.5)
    rgb = np.zeros((16, 16, 3), np.uint8); al = np.zeros((16, 16), np.uint8)
    for y in range(16):
        for x in range(16):
            v = m[y, x]
            if v < -1.2: continue
            if v < 0:
                if hash2(x + n * 16, y, seed + 1) > 0.72: rgb[y, x] = CA[1]; al[y, x] = 255
                continue
            # 짙은 잎 테 3px(2→1) → 검정 결(0, 드문 1)
            if v < 1.2: t = 2 if LEAFS[y, x] > -0.05 else 1
            elif v < 3.0: t = 1 if hash2(x, y, seed + 2) > 0.25 else 0
            else: t = 1 if (hash2(x, y, seed + 3) > 0.94 and LEAFS[y, x] > 0.1) else 0
            rgb[y, x] = CA[t]; al[y, x] = 255
    return Image.fromarray(np.dstack([rgb, al]), 'RGBA')


def core_sheet(): return sheet_from_cells([core_cell(n) for n in range(16)])


# ================================================================ 시험 그림
SHAPES = {
 'blob5': ["........", "..XXX...", ".XXXXX..", ".XXXXXX.", ".XXXXX..", "..XXXX..", "...X....", "........"],
 'spiral': ["..........", ".XXXXXXX..", ".X.....X..", ".X.XXX.X..", ".X.X.X.X..", ".X.X...X..", ".X.XXXXX..", ".X........", ".XXXXXXXX.", ".........."],
 'nose_L': ["..........", ".XXX......", ".XXX......", ".XXXX.....", ".XXXXXXXX.", "XXXXXXXXXX", ".XXXXXXX..", "..XX......", ".........."],
}


def stamp(sheet, rows, bg, sheet2=None):
    h = len(rows); w = len(rows[0]); out = Image.new('RGBA', (w * 16, h * 16))
    for y in range(h):
        for x in range(w): out.alpha_composite(bg.crop(((x % 3) * 16, (y % 3) * 16, (x % 3) * 16 + 16, (y % 3) * 16 + 16)), (x * 16, y * 16))
    on = lambda x, y: 0 <= x < w and 0 <= y < h and rows[y][x] == 'X'
    for y in range(h):
        for x in range(w):
            if on(x, y): out.alpha_composite(cell_of(sheet, nb_code(on, x, y)), (x * 16, y * 16))
    if sheet2 is not None:                                              # 속 어둠: 덩이를 한 칸 줄여 겹친다
        on2 = lambda x, y: on(x, y) and on(x - 1, y) and on(x + 1, y) and on(x, y - 1) and on(x, y + 1)
        for y in range(h):
            for x in range(w):
                if on2(x, y): out.alpha_composite(cell_of(sheet2, nb_code(on2, x, y)), (x * 16, y * 16))
    return out


def check_rows():
    grass = G.ground_grass()
    return [('autotile-canopy-wall (on grass)', canopy_sheet(), grass, None),
            ('autotile-canopy-wall + autotile-canopy-core (core painted 1 cell inside)', canopy_sheet(), grass, core_sheet())]


def check_sheet(path, scale=3, rows=None):
    from PIL import ImageDraw
    rows = rows or check_rows()
    blocks = []
    for (title, sh, bg, sh2) in rows:
        raw = Image.new('RGBA', (76, 76), (40, 40, 46, 255))
        for k in range(16): raw.alpha_composite(bg.crop((0, 0, 16, 16)), (6 + (k % 4) * 16, 6 + (k // 4) * 16))
        raw.alpha_composite(sh, (6, 6))
        big = {k: (["XXXXXXXXXX"] * 1 + v + ["XXXXXXXXXX"]) for k, v in SHAPES.items()}
        shapes = SHAPES if sh2 is None else {'blob_big': ["..........", "..XXXXX...", ".XXXXXXXX.", ".XXXXXXXXX", "XXXXXXXXX.", ".XXXXXXXX.", "..XXXXXX..", "...XXX....", ".........."],
                                              'ring': ["XXXXXXXXXX", "XXXXXXXXXX", "XXX....XXX", "XX......XX", "XX.......X", "XXX.....XX", "XXXX...XXX", "XXXXXXXXXX", "XXXXXXXXXX"],
                                              'cross': ["XXXX..XXXX", "XXXX..XXXX", "XXX....XXX", "..........", "..........", "XXX....XXX", "XXXX..XXXX", "XXXX..XXXX"]}
        blocks.append((title, [raw] + [stamp(sh, v, bg, sh2) for v in shapes.values()]))
    hgt = max(max(i.height for i in ims) for _, ims in blocks)
    W = max(sum(i.width for i in ims) + 10 * len(ims) for _, ims in blocks)
    o = Image.new('RGBA', (W * scale + 10, len(blocks) * (hgt * scale + 24) + 6), (24, 24, 28, 255)); d = ImageDraw.Draw(o)
    for r, (title, ims) in enumerate(blocks):
        y = 6 + r * (hgt * scale + 24); d.text((8, y), title + '   [16 variants | shapes]', fill=(235, 235, 235, 255))
        x = 6
        for im in ims:
            o.alpha_composite(im.resize((im.width * scale, im.height * scale), Image.NEAREST), (x, y + 16)); x += im.width * scale + 10 * scale
    o.convert('RGB').save(path)


if __name__ == '__main__':
    import sys
    check_sheet(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '_qa', 'auto-wip.png'))
    print('ok')
