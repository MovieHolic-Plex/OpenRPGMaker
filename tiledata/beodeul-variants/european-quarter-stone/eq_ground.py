# 석조 유럽 시가지 바닥 — 버들항 칩셋 자체 타일(회색 자갈 (160,96) · 흙 (64,224) · 마름돌 (224,160))의 화소 결을 그대로 두고
# 밝기 순위만 이 장소 램프(회색 포석·판석·자갈·물)로 옮긴다. 표본은 48 주기(3x3칸)로 이어 붙여도 이음새가 없다.
# 오토타일 16변형(위1·오른2·아래4·왼8), 위층 투명 덧그림(밑 땅이 비친다). 가장자리는 둥글고 들쭉날쭉(직각 금지).
from eq_base import *

A_ = lambda R: np.array(R, np.float64)
CB, FL, GV, PD, SN, LF, LY, IR, TR, AS = (A_(r) for r in (COB, FLAG, GRAV, PUD, SNOW, LEAFF, LEAFY, IRON, TRIM, ASH))
COBBLE = chip(*COBBLE_AT); DIRT = chip(*DIRT_AT); ASHL = chip(*ASHLAR_AT)
def T(t, X, Y): return t[Y % 16, X % 16]
def _XY(n=48): return np.meshgrid(np.arange(n), np.arange(n))

# ---------------------------------------------------------------- 바닥 셰이더(세계 좌표, 48 주기)
def setts(X, Y, seed=11):
    """회색 포석 거리: 버들항 회색 자갈 칸 결(잔 돌·줄눈)을 그대로 COB 2~5단으로. 돌마다 아주 드물게 한 단 밝은 새 돌,
    밝은 돌 윗점에 흐린 빛. 넓은 얼룩(위장무늬)은 넣지 않는다."""
    day = T(COBBLE, X, Y); l = L(day)
    t = rank(day, 60, 165, 2, 5)
    rgb = CB[t]
    gap = l < 78
    rgb = np.where(gap[..., None], CB[1], rgb)
    glint = (l > 150) & (hash2(X % 48, Y % 48, seed + 2) > 0.75)
    rgb = np.where(glint[..., None], CB[6], rgb)
    worn = (hash2(X % 48 // 3, Y % 48 // 3, seed + 3) > 0.93) & ~gap
    rgb = np.where(worn[..., None], CB[np.clip(t + 1, 2, 6)], rgb)
    return rgb

def wetsetts(X, Y, seed=21):
    """비에 젖은 포석: 같은 자갈 결을 두 단 어둡게(물빛 섞음), 돌 윗면에 흐린 하늘빛 맺힘(짧은 가로 줄), 틈에 고인 물."""
    day = T(COBBLE, X, Y); l = L(day)
    t = rank(day, 60, 165, 1, 4)
    rgb = CB[t] * 0.72 + PD[t] * 0.28
    gap = l < 78
    rgb = np.where(gap[..., None], PD[1], rgb)
    sheen = (l > 125) & (hash2(X % 48 // 2, Y % 48, seed) > 0.5)
    rgb = np.where(sheen[..., None], PD[5] * 0.65 + CB[4] * 0.35, rgb)
    pool = gap & (hash2(X % 48, Y % 48 // 2, seed + 1) > 0.62)
    rgb = np.where(pool[..., None], PD[3], rgb)
    return rgb

def flagstone(X, Y, seed=31):
    """보도 판석: 16x16 네모 판석(엇갈림 없음 — 벽돌 쌓기처럼 보이지 않게). 판석마다 3~4단(낮은 대비), 위·왼 모만 아주 옅게 밝음,
    줄눈 1화소(2단), 마름돌 칸 얼룩 결을 옅게, 드문 금 간 판석·작은 패인 점."""
    x, y = X % 48, Y % 48
    col = x // 16; row = y // 16; u = x % 16; v = y % 16
    base = 3 + (hash2(col, row, seed) > 0.62).astype(int)
    grain = rank(T(ASHL, X, Y), 120, 230, 0, 2)
    t = base - np.where((grain == 0) & (hash2(x, y, seed + 3) > 0.6), 1, 0)
    t = np.where(((v == 0) | (u == 0)) & (hash2(x, y, seed + 6) > 0.35), np.minimum(t + 1, 5), t)
    rgb = FL[np.clip(t, 2, 5)]
    joint = (v == 15) | (u == 15)
    rgb = np.where(joint[..., None], FL[2], rgb)
    crack = (hash2(col, row, seed + 7) > 0.9) & (np.abs(u - (v * 0.6 + 3).astype(int)) == 0) & (v > 2) & (v < 13)
    rgb = np.where(crack[..., None], FL[1], rgb)
    pit = (hash2(x, y, seed + 5) > 0.988) & ~joint
    rgb = np.where(pit[..., None], FL[2], rgb)
    return rgb

def gravel(X, Y, seed=41):
    """안마당 자갈: 칩셋 흙 결 → 회갈 GRAV, 그 위에 1~2화소 자갈 알(밝은 윗점 + 그늘 아랫점)."""
    day = T(DIRT, X, Y)
    t = rank(day, 70, 150, 2, 4)
    rgb = GV[t]
    x, y = X % 48, Y % 48
    peb = hash2(x // 2, y // 2, seed) > 0.72
    rgb = np.where((peb & ((x + y) % 2 == 0))[..., None], GV[5], rgb)
    rgb = np.where((np.roll(peb, 1, 0) & ~peb)[..., None], GV[1], rgb)
    sp = hash2(x, y, seed + 2) > 0.97
    rgb = np.where(sp[..., None], GV[6], rgb)
    return rgb

def fanplaza(X, Y, seed=51):
    """광장 부채꼴 포석: 반지름 12 부채꼴이 비늘처럼 겹친 줄(24x12 주기), 부채마다 돌 줄이 둥글게, 테두리 돌은 한 단 밝다."""
    x, y = X % 48, Y % 48
    row = y // 12; off = np.where(row % 2 == 1, 12, 0)
    cx = ((x + off) // 24) * 24 + 12 - off; cy = row * 12 + 12
    dx = x - cx; dy = y - cy
    r = np.hypot(dx, dy * 1.0)
    ring = (r // 3).astype(int)
    ang = np.arctan2(dy, dx)
    seg = ((ang + np.pi) * (ring + 2) / 1.6).astype(int)
    t = 3 + (hash2(seg, ring + row * 7, seed) > 0.5).astype(int) - (hash2(seg, ring, seed + 1) > 0.85).astype(int)
    t = np.where(r >= 10.5, 5, t)
    rgb = CB[np.clip(t, 2, 5)]
    joint = ((r % 3) < 0.8) | (hash2(seg, ring, seed + 2) > 0.94)
    rgb = np.where(joint[..., None], CB[2] * 0.5 + CB[1] * 0.5, rgb)
    return rgb

GROUNDS = {'ground-setts': setts, 'ground-wetsetts': wetsetts, 'ground-flagstone': flagstone, 'ground-gravel': gravel, 'ground-fanplaza': fanplaza}
def ground_sample(name):
    X, Y = _XY(48); return arr_img(GROUNDS[name](X, Y))

# ---------------------------------------------------------------- 16변형 오토타일
def _cells(shader, seed, inset, jag, rad):
    cells = []
    X, Y = np.meshgrid(np.arange(16), np.arange(16))
    for n in range(16):
        m, miss = edge_depth(n, inset, jag, rad, seed)
        rgb, alpha = shader(X, Y, m, n, seed)
        cells.append(arr_img(rgb, alpha))
    return sheet_from_cells(cells)

def puddle_shader(X, Y, m, n, seed):
    """포석 위 빗물 웅덩이: 속은 흐린 하늘을 비춘 짙은 물(가로로 끊긴 빛 줄 · 물에 잠긴 돌 윤곽이 희미하게), 물가 1~2화소는
    젖어 검어진 포석(한 단 더 어둡게)이 테를 두르고, 북쪽 물가 바로 밑은 돌 그림자. 걷기(물 튀김은 이벤트 몫)."""
    depth = np.clip(m, 0, 9)
    under = rank(T(COBBLE, X, Y), 60, 160, 2, 4)
    rgb = PD[np.clip(under, 2, 4)] * 0.7 + CB[np.clip(under, 2, 4)] * 0.3
    ph = (hash2(X // 5, 0, seed) * 3).astype(int)
    streak = (depth >= 2.4) & (((Y + ph) % 5) == 1) & (hash2(X // 3, Y, seed + 1) > 0.40)
    rgb = np.where(streak[..., None], PD[5], rgb)
    hi = streak & (hash2(X, Y, seed + 2) > 0.80)
    rgb = np.where(hi[..., None], PD[6], rgb)
    rim = depth < 1.6
    wet = CB[np.clip(rank(T(COBBLE, X, Y), 60, 160, 1, 3), 1, 3)] * 0.6 + PD[2] * 0.4
    rgb = np.where(rim[..., None], wet, rgb)
    if not (n & N_):
        top = (depth >= 1.6) & (depth < 2.6)
        rgb = np.where(top[..., None], PD[2], rgb)
    alpha = m >= 0
    drops = (m < 0) & (m > -2.0) & (hash2(X, Y, seed + 5) > 0.86)
    rgb = np.where(drops[..., None], wet * 0.9, rgb)
    return rgb, alpha | drops
def autotile_puddle(): return _cells(puddle_shader, 211, 3.2, 2.6, 7.0)

def slush_shader(X, Y, m, n, seed):
    """녹는 눈 덩이: 속은 회백 눈(작은 덩이 결, 위 모 밝고 아래 그늘), 군데군데 녹아 포석이 비치는 구멍, 가장자리는 회갈로
    더러워진 눈 테와 그 바깥 젖은 검은 자국(물이 번진 자리)."""
    n1 = tnoise(16, 16, 4, seed + 7)[Y % 16, X % 16]
    rgb = SN[np.clip(3 + (n1 > 0.45).astype(int) + (hash2(X, Y, seed + 1) > 0.86).astype(int), 0, 6)].copy()
    lump = (hash2(X, Y, seed + 2) > 0.80) & (n1 < 0.55)
    rgb = np.where(lump[..., None], SN[2], rgb)
    under = np.roll(lump, -1, 0) & ~lump
    rgb = np.where(under[..., None], SN[5], rgb)
    hole = (m > 3.0) & (hash2(X, Y, seed + 3) > 0.965)
    rgb = np.where(hole[..., None], SN[1] * 0.5 + PD[3] * 0.5, rgb)
    dirty = (m >= 0) & (m < 1.8)
    rgb = np.where(dirty[..., None], SN[1] * 0.55 + GV[3] * 0.45, rgb)
    alpha = (m >= 0) & ~((m < 1.2) & (hash2(X, Y, seed + 4) > 0.35 + 0.5 * m))
    wetring = (m < 0) & (m > -2.2) & (hash2(X, Y, seed + 5) > 0.35)
    rgb = np.where(wetring[..., None], PD[2], rgb)
    return rgb, alpha | wetring
def autotile_slush(): return _cells(slush_shader, 221, 2.6, 2.8, 6.0)

LSH = [((0, 0), (1, 0)), ((0, 0), (0, 1)), ((0, 0), (1, 0), (1, 1)), ((0, 0), (1, 0), (2, 1)), ((0, 0), (1, 1)), ((1, 0), (0, 1), (1, 1))]
def leaves_cell(n, seed=231):
    """포석 위 낙엽 더미: 촘촘한 갈색·누른 잎(잎마다 2~3화소, 방향 제각각, 아래 그늘). 속은 잎이 겹쳐 땅이 거의 안 보이고,
    가장자리로 갈수록 성겨져 흩어진다(이웃 쪽은 끊김 없이 이어진다). 걷기."""
    m, miss = edge_depth(n, 2.0, 3.0, 6.0, seed)
    rgb = np.zeros((16, 16, 3)); a = np.zeros((16, 16), bool)
    X, Y = np.meshgrid(np.arange(16), np.arange(16))
    mat = (m >= 2.6) & (hash2(X, Y, seed + 1) > 0.10)
    rgb[mat] = np.where((hash2(X, Y, seed + 2) > 0.5)[..., None], LF[3], LF[4] * 0.5 + LY[3] * 0.5)[mat]; a |= mat
    for k in range(52):
        x0 = int(hash2(k, 1, seed + 3) * 16); y0 = int(hash2(k, 2, seed + 3) * 16)
        shp = LSH[int(hash2(k, 3, seed + 3) * len(LSH))]
        yel = hash2(k, 4, seed + 3) > 0.55
        t = 3 + int(hash2(k, 5, seed + 3) * 2.99)
        R_ = LY if yel else LF
        for j, (dx, dy) in enumerate(shp):
            x, y = (x0 + dx) % 16, (y0 + dy) % 16
            mm = m[y, x]
            if mm < -1.5 or hash2(k, 6, seed + 3) > 0.15 + 0.6 * min(1.0, (mm + 1.5) / 4.0): continue
            c = R_[t] if j == 0 else (R_[t - 1] if j == len(shp) - 1 else R_[min(6, t + 1)])
            rgb[y, x] = c; a[y, x] = True
    return arr_img(rgb, a)
def autotile_leaves(): return sheet_from_cells([leaves_cell(n) for n in range(16)])

def sidewalk_shader(X, Y, m, n, seed):
    """보도 연석: 속은 투명(밑에 ground-flagstone 을 깐다 — 판석 결이 48 주기로 이어진다). 이웃 없는 쪽만 밝은 연석 2화소(윗면 밝음)
    + 1화소 턱 그늘로 끝나고, 연석 모퉁이는 둥글게 깎였다. 걷기(연석은 낮은 턱)."""
    rgb = np.zeros(X.shape + (3,)); rgb[:] = TR[4]
    kerb = (m >= -0.5) & (m < 1.6)
    rgb = np.where(kerb[..., None], TR[5] * 0.6 + FL[5] * 0.4, rgb)
    inner = (m >= 1.0) & (m < 1.6)
    rgb = np.where(inner[..., None], TR[4], rgb)
    lip = (m >= -0.5) & (m < 0.5)
    rgb = np.where(lip[..., None], TR[3], rgb)
    if not (n & S_):
        sh = lip & (Y >= 12)
        rgb = np.where(sh[..., None], CB[1], rgb)
    nick = kerb & (hash2(X, Y, seed + 1) > 0.9)
    rgb = np.where(nick[..., None], TR[3], rgb)
    return rgb, kerb
def autotile_sidewalk(): return _cells(sidewalk_shader, 241, 3.0, 0.4, 3.0)

def rail_cell(n):
    """검은 쇠 난간(위층, 막힘): 동서로 이으면 앞에서 본 난간(윗대·아랫대 + 2화소 간격 살 + 살 끝 공), 남북으로 이으면 3/4 로 본
    난간 윗대 줄. 모서리·끝은 네모 기둥과 공 머리, 돌 받침 턱."""
    im = Image.new('RGBA', (32, 32)); px = im.load(); o = 8
    hasN, hasE, hasS, hasW = bool(n & N_), bool(n & E_), bool(n & S_), bool(n & W_)
    I, S_t = IRON, TRIM
    top = o + 2; bot = o + 12; cx = o + 7
    def P(x, y, c):
        if 0 <= x < 32 and 0 <= y < 32: px[x, y] = tuple(c) + (255,)
    xs = []
    if hasW: xs += list(range(0, cx))
    if hasE: xs += list(range(cx + 2, 32))
    for x in xs:
        P(x, top, I[5]); P(x, top + 1, I[2])
        P(x, bot - 2, I[3]); P(x, bot - 1, I[1])
        P(x, bot, S_t[5] if x % 6 else S_t[4]); P(x, bot + 1, S_t[3]); P(x, bot + 2, S_t[1])
        if x % 2 == 0:
            for y in range(top + 2, bot - 2): P(x, y, I[4] if y < top + 5 else I[3])
            if x % 4 == 0: P(x, top + 6, I[5]); P(x, top + 7, I[2])
    if hasN or hasS:
        y0 = 0 if hasN else top; y1 = 31 if hasS else bot
        for y in range(y0, y1 + 1):
            P(cx, y, I[5] if y % 2 else I[4]); P(cx + 1, y, I[2]); P(cx - 1, y, S_t[4]); P(cx + 2, y, S_t[2])
    for y in range(top - 1, bot + 1):
        P(cx, y, I[5]); P(cx + 1, y, I[2]); P(cx - 1, y, I[3]); P(cx + 2, y, I[1])
    P(cx, top - 3, I[6]); P(cx + 1, top - 3, I[3]); P(cx - 1, top - 2, I[4]); P(cx, top - 2, I[5]); P(cx + 1, top - 2, I[2]); P(cx + 2, top - 2, I[1])
    for x in range(cx - 2, cx + 4): P(x, bot + 1, S_t[4]); P(x, bot + 2, S_t[2])
    return im
def autotile_ironrail(): return autotile_composed(rail_cell)

AUTOTILES = {'autotile-puddle': autotile_puddle, 'autotile-leaves': autotile_leaves, 'autotile-slush': autotile_slush,
             'autotile-sidewalk': autotile_sidewalk, 'autotile-ironrail': autotile_ironrail}

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
    from PIL import ImageDraw
    rows = [('autotile-puddle (on ground-setts)', 'autotile-puddle', 'ground-setts'),
            ('autotile-puddle (on ground-fanplaza)', 'autotile-puddle', 'ground-fanplaza'),
            ('autotile-leaves (on ground-setts)', 'autotile-leaves', 'ground-setts'),
            ('autotile-leaves (on ground-gravel)', 'autotile-leaves', 'ground-gravel'),
            ('autotile-slush (on ground-setts)', 'autotile-slush', 'ground-setts'),
            ('autotile-slush (on ground-flagstone)', 'autotile-slush', 'ground-flagstone'),
            ('autotile-sidewalk (on ground-flagstone)', 'autotile-sidewalk', 'ground-flagstone'),
            ('autotile-ironrail (on ground-flagstone)', 'autotile-ironrail', 'ground-flagstone')]
    blocks = []
    for (title, an, gn) in rows:
        sh = AUTOTILES[an](); bg = ground_sample(gn)
        raw = Image.new('RGBA', (76, 76), (40, 40, 46, 255)); raw.alpha_composite(bg.crop((0, 0, 64, 64)) if False else Image.new('RGBA', (64, 64)), (6, 6))
        bgt = Image.new('RGBA', (64, 64))
        for yy in (0, 48):
            for xx in (0, 48): bgt.alpha_composite(bg, (xx, yy))
        raw.alpha_composite(bgt, (6, 6)); raw.alpha_composite(sh, (6, 6))
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
    check_sheet(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'check-autotile.png'))
