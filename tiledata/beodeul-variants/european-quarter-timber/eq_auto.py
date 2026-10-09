# 목골 구시가 16변형 오토타일(칸 번호 = 위 1 + 오른쪽 2 + 아래 4 + 왼쪽 8). 위층 투명 덧그림 — 밑 땅이 비친다.
# 길: 연석 두른 붉은 벽돌 거리(brickstreet — 가장자리 황갈 연석 띠, 바깥 모서리는 둥글게)
# 시그니처 땅 덩이: 비 고인 웅덩이(puddle) · 이끼 낀 포석(mossy) · 꽃밭(flowerbed) · 가로수 밑 낙엽(leaves)
from eq_ground import *
from eq_ground import _img, _XY
from PIL import ImageDraw

def _cells(shader, seed, inset, jag, rad):
    cells = []
    X, Y = np.meshgrid(np.arange(16), np.arange(16))
    for n in range(16):
        m, miss = edge_depth(n, inset, jag, rad, seed)
        rgb, alpha = shader(X, Y, m, n, seed)
        cells.append(_img(rgb, np.where(alpha, 255, 0).astype(np.uint8)))
    return sheet_from_cells(cells)

# ---------------------------------------------------------------- 연석 두른 벽돌 거리
def street_shader(X, Y, m, n, seed):
    """속은 ground-brickpave 결 그대로(이어 붙임). 이웃이 없는 쪽 가장자리 3화소는 황갈 사암 연석(윗모 밝게, 바깥 한 줄 그늘),
    연석 안쪽 한 줄은 벽돌이 반 장 세로로 놓인 마감줄. 가장자리 흔들림은 아주 작다(만든 길이라 곧다)."""
    rgb = brickpave(X, Y)
    curb = (m >= 0) & (m < 3.0)
    t = np.where(m < 1.0, 2, np.where(m < 2.0, 5, 4))
    rgb = np.where(curb[..., None], OCHRE[t], rgb)
    seam = curb & (m >= 1.0) & (hash2(X // 3, Y // 3, seed) > 0.8)
    rgb = np.where(seam[..., None], OCHRE[3], rgb)
    trim = (m >= 3.0) & (m < 4.0)
    rgb = np.where(trim[..., None], BR[2], rgb)
    return rgb, m >= 0

def autotile_brickstreet(): return _cells(street_shader, 201, 0.6, 0.35, 3.0)

# ---------------------------------------------------------------- 비 고인 웅덩이
SKYW = A_([hx(c) for c in ('#1a2430', '#2a3a4a', '#3e5466', '#58707e', '#7890a0', '#9cb0be', '#c4d2dc')])
def puddle_shader(X, Y, m, n, seed):
    """얕은 빗물 웅덩이: 속은 흐린 하늘을 비춘 회청 물(가로 반사 줄·흰 빛점), 가장자리 1화소는 젖어 거뭇한 땅 테(아래 땅이 어둡게 비친다),
    북쪽 기슭 한 줄은 그늘. 바깥은 투명이라 벽돌·자갈·흙 어디에나 앉는다. 걷기."""
    depth = np.clip(m, 0, 9)
    rgb = np.zeros(X.shape + (3,)); rgb[:] = SKYW[2] * 0.85 + SKYW[1] * 0.15
    rgb = np.where((depth >= 2.5)[..., None], np.where((hash2(X // 4, Y // 2, seed + 9) > 0.6)[..., None], SKYW[3], SKYW[2] * 0.5 + SKYW[3] * 0.5), rgb)
    ph = (hash2(X // 5, 0, seed) * 3).astype(int)
    streak = (depth >= 2.0) & (((Y + ph) % 6) == 2) & (hash2(X // 3, Y, seed + 1) > 0.55)
    rgb = np.where(streak[..., None], SKYW[4], rgb)
    hi = (depth >= 2.5) & (hash2(X, Y, seed + 2) > 0.988)
    rgb = np.where(hi[..., None], SKYW[6], rgb)
    rim = depth < 1.2
    rgb = np.where(rim[..., None], SKYW[0] * 0.5 + EARTH[1] * 0.5, rgb)
    if not (n & N_):
        top = (depth >= 1.2) & (depth < 2.4) & (Y < 9)
        rgb = np.where(top[..., None], SKYW[2], rgb)
    alpha = m >= 0
    drop = (m < 0) & (m > -1.8) & (hash2(X, Y, seed + 5) > 0.86)            # 튄 물 자국(한 화소 거뭇)
    rgb = np.where(drop[..., None], SKYW[1], rgb)
    return rgb, alpha | drop

def autotile_puddle(): return _cells(puddle_shader, 211, 2.0, 2.2, 6.0)

# ---------------------------------------------------------------- 이끼 낀 포석
MOS = A_(MOSS)
def mossy_shader(X, Y, m, n, seed):
    """포석·벽돌 줄눈과 모서리로 번진 이끼 덩이: 속은 이끼가 돌을 거의 덮고(짙은 녹·밝은 녹 점), 가장자리로 갈수록 이끼가 줄눈만 따라
    가늘게 남는다(돌 표면은 투명 — 밑 바닥이 비친다). 걷기."""
    lane = (hash2(X // 2, Y, seed) > 0.5)
    cover = np.clip(m / 4.0, 0, 1)
    pick = hash2(X, Y, seed + 1) < 0.25 + 0.7 * cover
    alpha = (m >= 0) & pick
    t = np.where(hash2(X, Y // 2, seed + 2) > 0.7, 5, np.where(lane, 3, 4))
    rgb = MOS[t].copy()
    rgb = np.where((hash2(X, Y, seed + 3) > 0.9)[..., None], LF[5], rgb)
    rgb = np.where((hash2(X, Y, seed + 4) > 0.88)[..., None], MOS[2], rgb)
    spot = (m < 0) & (m > -2.0) & (hash2(X, Y, seed + 5) > 0.9)
    rgb = np.where(spot[..., None], MOS[3], rgb)
    return rgb, alpha | spot

def autotile_mossy(): return _cells(mossy_shader, 221, 2.4, 2.8, 6.0)

# ---------------------------------------------------------------- 꽃밭
def flower_cell(n, seed=231):
    """잔디 위 꽃밭 덩이: 둘레 1~2화소 짙은 흙 테(윗모 밝게), 속은 잎 덤불 위로 빨강·노랑·보라·흰 꽃송이(2~3화소, 위 밝음)가 촘촘하다.
    가장자리는 잎이 흙 테 위로 비죽 나오고 테 바깥에 잔풀. 걷기(밟으면 연출은 이벤트 몫)."""
    m, miss = edge_depth(n, 2.2, 2.4, 6.0, seed)
    X, Y = np.meshgrid(np.arange(16), np.arange(16))
    rgb = np.zeros((16, 16, 3)); a = m >= 0
    soil = (m >= 0) & (m < 2.0)
    rgb[:] = LF[2]
    leaf = hash2(X, Y // 2, seed + 1) > 0.45
    rgb = np.where(leaf[..., None], LF[3], rgb)
    rgb = np.where((hash2(X, Y, seed + 2) > 0.82)[..., None], LF[4], rgb)
    rgb = np.where(soil[..., None], np.where((m < 1.0)[..., None], EARTH[2], EARTH[3]), rgb)
    rgb = np.where((soil & ~np.roll(soil, 1, 0) & (m >= 1.0))[..., None], EARTH[4], rgb)
    cols = ['red', 'yel', 'vio', 'wht', 'red', 'yel']
    for k in range(30):
        x0 = int(hash2(k, 1, seed) * 16); y0 = int(hash2(k, 2, seed) * 16)
        Fl = A_(FLWR[cols[int(hash2(k, 3, seed) * 6)]])
        shp = ((0, 0, 5), (1, 0, 3), (0, 1, 2)) if hash2(k, 4, seed) > 0.5 else ((0, 0, 6), (0, 1, 3))
        for (dx, dy, t) in shp:
            x, y = (x0 + dx) % 16, (y0 + dy) % 16
            if m[y, x] < 2.2: continue
            rgb[y, x] = Fl[t]
    stray = (m < 0) & (m > -1.6) & (hash2(X, Y, seed + 7) > 0.8)
    rgb = np.where(stray[..., None], LF[4], rgb)
    return _img(rgb, np.where(a | stray, 255, 0).astype(np.uint8))

def autotile_flowerbed(): return sheet_from_cells([flower_cell(n) for n in range(16)])

# ---------------------------------------------------------------- 가로수 밑 낙엽
LV = [A_([hx(c) for c in ('#2a140a', '#4a2610', '#6e3a16', '#92521e', '#b06e2a', '#c88c3c', '#dcac5a')]),
      A_([hx(c) for c in ('#2a240a', '#4a4012', '#6e5e1c', '#8e7a26', '#aa9432', '#c2ae48', '#d8c66a')])]
def leaves_cell(n, seed=241):
    """마른 잎 깔개(가로수·광장 나무 밑): 갈색·황갈 잎 2~3화소가 방향 제각각으로 흩어지고 오른쪽 아래 한 화소 그늘. 속은 촘촘, 가장자리로 갈수록 성기다. 걷기."""
    m, miss = edge_depth(n, 2.0, 3.0, 6.0, seed)
    rgb = np.zeros((16, 16, 3)); a = np.zeros((16, 16), bool)
    for k in range(42):
        x0 = int(hash2(k, 1, seed) * 16); y0 = int(hash2(k, 2, seed) * 16)
        R_ = LV[int(hash2(k, 4, seed) > 0.55)]; t = 3 + int(hash2(k, 5, seed) * 2.5)
        horiz = hash2(k, 3, seed) > 0.5
        pts = ((0, 0, t), (1, 0, t - 1)) if horiz else ((0, 0, t), (0, 1, t - 1))
        pts = pts + ((1, 1, 1),) if horiz else pts + ((1, 1, 1),)                     # 잎 오른쪽 아래 한 화소 그늘(땅에 붙은 잎)
        for (dx, dy, tt) in pts:
            x, y = (x0 + dx) % 16, (y0 + dy) % 16; mm = m[y, x]
            if mm < -1.0 or hash2(k, 6, seed) > 0.15 + 0.7 * min(1.0, (mm + 1.0) / 4.0): continue
            if tt == 1: rgb[y, x] = EARTH[1]; a[y, x] = True if not a[y, x] else a[y, x]
            else: rgb[y, x] = R_[tt]; a[y, x] = True
    return _img(rgb, np.where(a, 255, 0).astype(np.uint8))

def autotile_leaves(): return sheet_from_cells([leaves_cell(n) for n in range(16)])

AUTOTILES = {'autotile-brickstreet': autotile_brickstreet, 'autotile-puddle': autotile_puddle, 'autotile-mossy': autotile_mossy,
             'autotile-flowerbed': autotile_flowerbed, 'autotile-leaves': autotile_leaves}
_AC = {}
def autotile(name):
    if name not in _AC: _AC[name] = grade(AUTOTILES[name]())
    return _AC[name]

# ---------------------------------------------------------------- 시험 그림
SHAPES = {
 'blob5': ["........", "..XXX...", ".XXXXX..", ".XXXXXX.", ".XXXXX..", "..XXXX..", "...X....", "........"],
 'spiral': ["..........", ".XXXXXXX..", ".X.....X..", ".X.XXX.X..", ".X.X.X.X..", ".X.X...X..", ".X.XXXXX..", ".X........", ".XXXXXXXX.", ".........."],
 'nose_L': ["..........", ".XXX......", ".XXX......", ".XXXX.....", ".XXXXXXXX.", "XXXXXXXXXX", ".XXXXXXX..", "..XX......", ".........."],
}
def stamp(sheet, rows, bg):
    h = len(rows); w = len(rows[0]); out = Image.new('RGBA', (w * 16, h * 16))
    for y in range(0, h * 16, 48):
        for x in range(0, w * 16, 48): out.alpha_composite(bg, (x, y))
    on = lambda x, y: 0 <= x < w and 0 <= y < h and rows[y][x] == 'X'
    for y in range(h):
        for x in range(w):
            if not on(x, y): continue
            k = (1 if on(x, y - 1) else 0) | (2 if on(x + 1, y) else 0) | (4 if on(x, y + 1) else 0) | (8 if on(x - 1, y) else 0)
            out.alpha_composite(sheet.crop(((k % 4) * 16, (k // 4) * 16, (k % 4) * 16 + 16, (k // 4) * 16 + 16)), (x * 16, y * 16))
    return out

def check_sheet(path, scale=3):
    rows = [('autotile-brickstreet (on ground-cobble)', 'autotile-brickstreet', 'ground-cobble'),
            ('autotile-brickstreet (on ground-lawn)', 'autotile-brickstreet', 'ground-lawn'),
            ('autotile-puddle (on ground-brickpave)', 'autotile-puddle', 'ground-brickpave'),
            ('autotile-puddle (on ground-cobble)', 'autotile-puddle', 'ground-cobble'),
            ('autotile-mossy (on ground-setts)', 'autotile-mossy', 'ground-setts'),
            ('autotile-mossy (on ground-cobble)', 'autotile-mossy', 'ground-cobble'),
            ('autotile-flowerbed (on ground-lawn)', 'autotile-flowerbed', 'ground-lawn'),
            ('autotile-leaves (on ground-brickpave)', 'autotile-leaves', 'ground-brickpave'),
            ('autotile-leaves (on ground-lawn)', 'autotile-leaves', 'ground-lawn')]
    blocks = []
    for (title, an, gn) in rows:
        sh = autotile(an); bg = grade(ground_sample(gn))
        raw = Image.new('RGBA', (76, 76), (40, 40, 46, 255)); raw.alpha_composite(bg.crop((0, 0, 64, 64)), (6, 6)); raw.alpha_composite(sh, (6, 6))
        blocks.append((title, [raw] + [stamp(sh, SHAPES[k], bg) for k in ('blob5', 'spiral', 'nose_L')]))
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
    check_sheet(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'check-autotile.png'))
