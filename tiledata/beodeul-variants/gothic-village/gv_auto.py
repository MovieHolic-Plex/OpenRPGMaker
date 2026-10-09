# 고딕 마을 16변형 오토타일(칸 번호 = 위 1 + 오른쪽 2 + 아래 4 + 왼쪽 8). 위층 투명 덧그림 — 밑 땅이 비친다.
# 시그니처 땅 덩이 셋: 안개 낀 이슬 풀(dewgrass) · 진창 웅덩이(mire) · 낙엽·뼈 흩어진 땅(leafbone)
# 길: 진흙 자갈 골목(mudlane, 풀 위 길 이음) · 울타리: 창끝 검은 쇠 울타리(ironfence, 막힘)
from gv_ground import *
from gv_ground import _img, _XY
from PIL import ImageDraw

def _cells(shader, seed, inset, jag, rad):
    cells = []
    X, Y = np.meshgrid(np.arange(16), np.arange(16))
    for n in range(16):
        m, miss = edge_depth(n, inset, jag, rad, seed)
        rgb, alpha = shader(X, Y, m, n, seed)
        cells.append(_img(rgb, np.where(alpha, 255, 0).astype(np.uint8)))
    return sheet_from_cells(cells)

# ---------------------------------------------------------------- 안개 낀 이슬 풀
def dew_shader(X, Y, m, n, seed):
    """시든 풀밭 위 키 큰 이슬 풀 덩이: 한 단 밝은 청회록 바탕(안개가 내려앉아 살짝 뿌옇다) 위에 풀포기(3~4화소 세로 잎, 끝 밝고
    밑동 어둡게)가 촘촘하고, 잎끝에 이슬 흰 점. 가장자리는 풀포기가 바깥으로 삐져나와 들쭉날쭉하다(바깥 잔털)."""
    day = np.where((hash2(X // 2, Y, seed) > 0.5)[..., None], T(MEADOW, X, Y), T(LAWNT, X, Y))
    t = rank(day, 50, 170, 3, 6)
    rgb = GM[t] * 0.90 + FG[np.clip(t - 3, 0, 6)] * 0.10
    blade = (hash2(X, Y // 2, seed + 1) > 0.62)
    rgb = np.where(blade[..., None], GM[6] * 0.9 + FG[3] * 0.1, rgb)
    shade = (hash2(X, Y // 2 + 7, seed + 2) > 0.80)
    rgb = np.where(shade[..., None], GM[3] * 0.8 + FG[0] * 0.2, rgb)
    rgb = np.where((blade & (hash2(X, Y, seed + 3) > 0.95))[..., None], FG[5], rgb)
    alpha = (m >= 0) & ~((m < 1.4) & (hash2(X, Y, seed + 4) > 0.3 + 0.5 * m))
    tuft = np.zeros(X.shape, bool)
    for k in range(7):
        x0 = int(hash2(k, 1, seed) * 16); y0 = int(hash2(k, 2, seed) * 16); hgt = 3 + int(hash2(k, 3, seed) * 2)
        for j in range(hgt):
            for dx in ((0,) if j < hgt - 1 else (-1, 1)):
                x, y = (x0 + dx) % 16, (y0 - j) % 16
                mm = m[y, x]
                if mm < -2.0: continue
                if mm < 0 and hash2(k, 4, seed) > 0.6: continue
                c = GM[6] * 0.7 + FG[4] * 0.3 if j == hgt - 1 else (GM[5] if j >= hgt // 2 else GM[3])
                if j == hgt - 1 and dx == 0 and hash2(k, 5, seed) > 0.55: c = FG[6]
                rgb[y, x] = c; tuft[y, x] = True
        x, y = x0 % 16, (y0 + 1) % 16
        if m[y, x] >= 0: rgb[y, x] = GM[2]
    return rgb, alpha | tuft

def autotile_dewgrass(): return _cells(dew_shader, 101, 2.8, 3.0, 6.0)

# ---------------------------------------------------------------- 진창 웅덩이
def mire_shader(X, Y, m, n, seed):
    """질척한 진창 덩이: 속은 검은 물 막이 덮인 진흙(흐린 하늘 빛 가로 줄·거품 점), 가장자리 1~2화소는 짓이겨진 밝은 진흙 둔덕
    (윗모 밝게·아랫모 그늘), 바깥에는 튄 진흙 점. 걷기(발이 빠지는 연출은 이벤트 몫)."""
    depth = np.clip(m, 0, 9)
    rgb = np.zeros(X.shape + (3,)); rgb[:] = MD[2]
    rgb = np.where((depth >= 2.2)[..., None], np.where((hash2(X // 3, Y // 2, seed + 9) > 0.45)[..., None], MD[2], MD[3] * 0.8 + GP[3] * 0.2), rgb)
    ph = (hash2(X // 5, 0, seed) * 3).astype(int)
    streak = (depth >= 2.6) & (((Y + ph) % 4) == 1) & (hash2(X // 4, Y, seed + 1) > 0.45)
    rgb = np.where(streak[..., None], GH[3] * 0.45 + MD[2] * 0.55, rgb)
    hi = (depth >= 2.6) & (((Y + ph) % 4) == 1) & (hash2(X // 2, Y, seed + 2) > 0.86)
    rgb = np.where(hi[..., None], GH[5], rgb)
    bub = (depth >= 3) & (hash2(X, Y, seed + 3) > 0.985)
    rgb = np.where(bub[..., None], MD[5], rgb)
    rim = (depth < 2.2)
    rimc = np.where((hash2(X, Y, seed + 4) > 0.5)[..., None], MD[4], MD[5])
    rgb = np.where(rim[..., None], rimc, rgb)
    inner = (depth >= 1.4) & (depth < 2.2)
    rgb = np.where(inner[..., None], MD[3], rgb)                                         # 둔덕 안쪽 비탈 그늘
    if not (n & N_):
        top = (depth >= 2.2) & (depth < 3.2)
        rgb = np.where(top[..., None], MD[1], rgb)                                       # 북쪽 둔덕이 드리운 그늘
    alpha = m >= 0
    spl = (m < 0) & (m > -2.5) & (hash2(X, Y, seed + 5) > 0.82)
    rgb = np.where(spl[..., None], MD[3], rgb)
    return rgb, alpha | spl

def autotile_mire(): return _cells(mire_shader, 111, 2.0, 2.0, 6.0)

# ---------------------------------------------------------------- 낙엽·뼈 흩어진 땅
LEAF_SPOTS = [((i * 7 + 3) % 16, (i * 11 + 5) % 16) for i in range(16)]
def leafbone_cell(n, seed=121):
    """흙 위 썩은 낙엽 깔개: 속은 진흙이 비치는 촘촘한 갈적·회갈 낙엽(잎마다 2~4화소, 방향 제각각, 오른쪽 아래 그늘),
    드문 작은 짐승 뼈 토막. 가장자리로 갈수록 흙이 먼저 사라지고 잎이 성겨져 흩어진다(이웃 쪽은 끊김 없이 이어진다)."""
    m, miss = edge_depth(n, 2.0, 3.0, 6.0, seed)
    rgb = np.zeros((16, 16, 3)); a = np.zeros((16, 16), bool)
    X, Y = np.meshgrid(np.arange(16), np.arange(16))
    soil = ((m >= 3.0) & (hash2(X, Y, seed + 1) > 0.12)) | ((m >= 1.0) & (hash2(X, Y, seed + 1) > 0.62))
    rgb[soil] = np.where((hash2(X, Y, seed + 2) > 0.5)[..., None], MD[2], MD[3])[soil]; a |= soil
    SH = [((0, 0), (1, 0)), ((0, 0), (0, 1)), ((0, 0), (1, 0), (1, 1)), ((0, 0), (1, 0), (2, 1)), ((0, 0), (1, 1)), ((1, 0), (0, 1), (1, 1))]
    for k in range(44):
        x0 = int(hash2(k, 1, seed + 3) * 16); y0 = int(hash2(k, 2, seed + 3) * 16)
        shp = SH[int(hash2(k, 3, seed + 3) * len(SH))]
        red = hash2(k, 4, seed + 3) > 0.42
        t = 2 + int(hash2(k, 5, seed + 3) * 3.99)
        R_ = LR if red else LG
        for j, (dx, dy) in enumerate(shp):
            x, y = (x0 + dx) % 16, (y0 + dy) % 16          # 칸 안에서 감아 이음(속 칸 15 가 이어 붙는다)
            mm = m[y, x]
            if mm < -1.5 or hash2(k, 6, seed + 3) > 0.15 + 0.6 * min(1.0, (mm + 1.5) / 4.0): continue
            c = R_[t] if j == 0 else (R_[t - 1] if j == len(shp) - 1 else R_[min(6, t + 1)])
            rgb[y, x] = c; a[y, x] = True
    bx = 3 + int(hash2(n, 1, seed + 60) * 9); by = 3 + int(hash2(n, 2, seed + 61) * 9)
    if n in (0, 6, 9) and m[by, bx] >= 2:
        for (x, y, t) in ((bx - 1, by, 5), (bx, by, 6), (bx + 1, by, 5), (bx - 2, by - 1, 5), (bx - 2, by + 1, 4), (bx + 2, by - 1, 4), (bx + 2, by + 1, 3), (bx, by + 1, 2), (bx + 1, by + 1, 2)):
            if 0 <= x < 16 and 0 <= y < 16: rgb[y, x] = BN[t]; a[y, x] = True
    return _img(rgb, np.where(a, 255, 0).astype(np.uint8))

def autotile_leafbone(): return sheet_from_cells([leafbone_cell(n) for n in range(16)])

# ---------------------------------------------------------------- 진흙 자갈 골목(풀 위 길)
def lane_shader(X, Y, m, n, seed):
    """풀 위 진흙 자갈 길: 속은 ground-mudcobble 결 그대로(이어 붙임), 가장자리 2화소는 자갈이 성겨지며 진흙이 드러나고
    가장 바깥은 풀이 먹어 들어온다(투명 — 밑 풀이 비친다). 바깥으로 튄 자갈 몇 알."""
    rgb = mudcobble(X, Y, 21)
    alpha = m >= 0
    edge = (m >= 0) & (m < 2.4)
    loose = edge & (hash2(X, Y, seed + 1) > 0.25 + 0.3 * m)
    rgb = np.where(loose[..., None], MD[np.clip((hash2(X, Y, seed + 2) * 3).astype(int) + 2, 0, 6)], rgb)
    eat = (m >= 0) & (m < 1.0) & (hash2(X, Y, seed + 3) > 0.45)
    alpha = alpha & ~eat
    peb = (m < 0) & (m > -2) & (hash2(X, Y, seed + 4) > 0.9)
    rgb = np.where(peb[..., None], GS[4], rgb)
    return rgb, alpha | peb

def autotile_mudlane(): return _cells(lane_shader, 131, 2.4, 2.6, 6.0)

# ---------------------------------------------------------------- 진흙땅 덩이(풀 위 밭·뒷마당)
def mudpatch_shader(X, Y, m, n, seed):
    """풀 위 진흙땅 덩이: 속은 ground-mire 결 그대로, 가장자리 1~2화소는 흙이 얇아져 풀이 비치고 바깥엔 흙 튄 점·잔풀."""
    rgb = mire(X, Y, 31)
    alpha = (m >= 0) & ~((m < 1.6) & (hash2(X, Y, seed + 3) > 0.25 + 0.45 * m))
    rim = (m >= 0) & (m < 2.0)
    rgb = np.where(rim[..., None], rgb * 0.82 + MD[4] * 0.18, rgb)
    spl = (m < 0) & (m > -2.0) & (hash2(X, Y, seed + 4) > 0.88)
    rgb = np.where(spl[..., None], MD[3], rgb)
    return rgb, alpha | spl

def autotile_mudpatch(): return _cells(mudpatch_shader, 141, 2.6, 2.8, 6.0)

# ---------------------------------------------------------------- 창끝 검은 쇠 울타리(위층, 막힘)
def _cv32(): return Image.new('RGBA', (32, 32))
def fence_cell(n):
    """동서로 이으면 앞에서 본 쇠 울타리(위·아래 가로대 + 3화소 간격 살 + 살마다 창끝, 돌 받침), 남북으로 이으면
    3/4 로 본 울타리 윗면(가로대 줄 + 창끝 점). 모서리·끝은 굵은 네모 기둥과 공 머리. 녹 얼룩 드문드문."""
    im = _cv32(); px = im.load(); o = 8
    hasN, hasE, hasS, hasW = bool(n & N_), bool(n & E_), bool(n & S_), bool(n & W_)
    I, Ru, S_t = GIRON, RUST, GSTONE
    top = o + 1; bot = o + 12                       # 창끝 y, 받침 y
    cx = o + 7
    def P(x, y, c):
        if 0 <= x < 32 and 0 <= y < 32: px[x, y] = c + (255,)
    xs = []
    if hasW: xs += list(range(0, cx))
    if hasE: xs += list(range(cx + 2, 32))
    for x in xs:
        P(x, top + 3, I[4]); P(x, top + 4, I[1])                         # 위 가로대
        P(x, bot - 3, I[3]); P(x, bot - 2, I[1])                         # 아래 가로대
        P(x, bot, S_t[5] if x % 5 else S_t[4]); P(x, bot + 1, S_t[3]); P(x, bot + 2, S_t[1])
        if x % 3 == 1:
            for y in range(top + 1, bot): P(x, y, I[5] if y < top + 3 else I[4])
            P(x, top, I[6]); P(x - 1, top + 1, I[3]); P(x + 1, top + 1, I[2])   # 창끝
            if hash2(x, 0, 7) > 0.8: P(x, bot - 1, Ru[4])
        elif x % 3 == 2:
            for y in range(top + 2, bot): P(x, y, I[1])                       # 살 그늘
    if hasN or hasS:
        y0 = 0 if hasN else top + 3; y1 = 31 if hasS else bot
        for y in range(y0, y1 + 1):
            P(cx, y, I[5] if y % 3 else I[6]); P(cx + 1, y, I[2]); P(cx - 1, y, I[1] if y % 3 == 0 else S_t[4])
            P(cx + 2, y, S_t[2])
    for y in range(top - 1, bot + 1):                                     # 기둥(모든 칸)
        P(cx, y, I[5]); P(cx + 1, y, I[2]); P(cx - 1, y, I[3]); P(cx + 2, y, I[1])
    P(cx, top - 3, I[6]); P(cx + 1, top - 3, I[3]); P(cx - 1, top - 2, I[4]); P(cx, top - 2, I[5]); P(cx + 1, top - 2, I[2]); P(cx + 2, top - 2, I[1])
    for x in range(cx - 2, cx + 4): P(x, bot + 1, S_t[4]); P(x, bot + 2, S_t[2])
    return im

def autotile_ironfence(): return autotile_composed(fence_cell)

AUTOTILES = {'autotile-dewgrass': autotile_dewgrass, 'autotile-mire': autotile_mire, 'autotile-leafbone': autotile_leafbone,
             'autotile-mudlane': autotile_mudlane, 'autotile-mudpatch': autotile_mudpatch, 'autotile-ironfence': autotile_ironfence}

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
    rows = [('autotile-dewgrass (on ground-deadgrass)', 'autotile-dewgrass', 'ground-deadgrass'),
            ('autotile-mire (on ground-deadgrass)', 'autotile-mire', 'ground-deadgrass'),
            ('autotile-mire (on ground-mudcobble)', 'autotile-mire', 'ground-mudcobble'),
            ('autotile-leafbone (on ground-deadgrass)', 'autotile-leafbone', 'ground-deadgrass'),
            ('autotile-leafbone (on ground-mire)', 'autotile-leafbone', 'ground-mire'),
            ('autotile-mudlane (on ground-deadgrass)', 'autotile-mudlane', 'ground-deadgrass'),
            ('autotile-mudpatch (on ground-deadgrass)', 'autotile-mudpatch', 'ground-deadgrass'),
            ('autotile-ironfence (on ground-deadgrass)', 'autotile-ironfence', 'ground-deadgrass')]
    blocks = []
    for (title, an, gn) in rows:
        sh = AUTOTILES[an](); bg = ground_sample(gn)
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
