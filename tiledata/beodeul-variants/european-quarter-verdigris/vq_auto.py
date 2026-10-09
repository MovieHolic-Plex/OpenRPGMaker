# 녹청 지붕 저택가 16변형 오토타일(칸 번호 = 위 1 + 오른쪽 2 + 아래 4 + 왼쪽 8, 왼쪽 위 칸이 0). 위층 투명 덧그림 — 밑 땅이 비친다.
# 시그니처 땅 덩이 셋: 젖은 자갈 웅덩이(puddle) · 돌 틈 이끼(moss) · 녹는 눈(slush).  길: 잔디 위 자갈 골목(cobblepath).
# 울타리: 낮은 돌 받침 위 검은 쇠 난간(ironrail, 막힘) · 다듬은 회양목 울(hedge, 막힘).
# 덩이 윤곽은 공용 깊이장(vendor/autotile_edge.edge_fields — 감김 잡음 두 겹 + 둥근 볼록 모서리)을 쓴다: 직선·직각이 나오지 않는다.
# 칸 속 무늬는 16 주기(이웃 칸과 이어진다).
from vq_ground import *
from vq_base import _h
from PIL import ImageDraw

X16, Y16 = np.meshgrid(np.arange(16), np.arange(16))

def _cells(shader, seed, inset, jag, rad):
    cells = []
    for n in range(16):
        m = edge_fields(n, inset, jag, rad, seed)[0]
        rgb, alpha = shader(X16, Y16, m, n, seed)
        cells.append(img_of(rgb, alpha))
    return sheet_from_cells(cells)

# 16 주기 둥근 자갈(오토타일 속) — voronoi 를 16 주기, 한 변 3개 돌로
def _vor16(seed):
    key = ('v16', seed)
    if key in _VOR: return _VOR[key]
    pts = []
    for j in range(3):
        for i in range(3):
            ox = 2.67 if j % 2 else 0.0
            pts.append(((i * 5.333 + ox + (_h(i, j, seed) - .5) * 2.2) % 16, (j * 5.333 + (_h(i, j, seed + 1) - .5) * 1.6) % 16, _h(i, j, seed + 2)))
    d1 = np.full(X16.shape, 1e9); d2 = np.full(X16.shape, 1e9); idx = np.zeros(X16.shape, int); DX = np.zeros(X16.shape); DY = np.zeros(X16.shape)
    for k, (px_, py_, _) in enumerate(pts):
        ddx = (X16 + .5 - px_ + 8) % 16 - 8; ddy = (Y16 + .5 - py_ + 8) % 16 - 8
        d = np.hypot(ddx, ddy * 1.2); c = d < d1
        d2 = np.where(c, d1, np.minimum(d2, d)); idx = np.where(c, k, idx); DX = np.where(c, ddx, DX); DY = np.where(c, ddy, DY); d1 = np.where(c, d, d1)
    _VOR[key] = (idx, d1, d2, DX, DY, pts); return _VOR[key]

def cobble16(seed=61, R=None):
    R = CB if R is None else R
    idx, d1, d2, DX, DY, pts = _vor16(seed)
    k = np.array([4 + (1 if p[2] > .7 else 0) - (1 if p[2] < .06 else 0) for p in pts])[idx]
    lit = (DX + DY) < -1.2
    k = np.where(lit, k + 1, k)
    k = np.where(lit & (d1 > 1.2) & (d1 < 2.2) & (DX < -.5) & (DY < -.5), np.minimum(k + 1, 6), k)
    k = np.where((DX + DY) > 1.9, k - 1, k)
    gap = (d2 - d1) < 1.1
    k = np.where(gap, np.where(hash2(X16, Y16, seed + 4) > .25, 3, 2), k)
    k = np.where(~gap & ((d2 - d1) < 2.1) & ((DX + DY) > 0), k - 1, k)
    return R[np.clip(k, 1, 6)], gap

# ---------------------------------------------------------------- 젖은 자갈 웅덩이(시그니처 1)
def puddle_shader(X, Y, m, n, seed):
    """비 갠 뒤 자갈 바닥에 고인 얕은 물: 속은 흐린 하늘을 비춘 물(PUD 2·3, 가로 빛 줄 5, 드문 빗방울 고리),
    물가 2px 는 젖어 짙어진 자갈(젖은 돌 램프로 칠한 자갈 — 돌 머리만 물 위로), 그 바깥 1px 는 물기 번진 돌 틈(반투명 짙음).
    걷기(얕은 물). 덩이 윤곽은 둥글고 울퉁불퉁."""
    stone, gap = cobble16(seed + 3, WT)
    rgb = np.zeros(X.shape + (3,)); rgb[:] = PD[2]
    rgb = np.where((hash2(X // 3, Y // 2, seed + 1) > .55)[..., None], PD[3], rgb)
    streak = (((Y + (hash2(X // 5, 0, seed) * 3).astype(int)) % 5) == 1) & (hash2(X // 4, Y, seed + 2) > .5) & (m >= 3.0)
    rgb = np.where(streak[..., None], PD[5], rgb)
    ring = (np.abs(np.hypot(X - 9.5, Y - 6.5) - 1.5) < .5) & (n == 15)
    rgb = np.where(ring[..., None], PD[4], rgb)
    rim = (m >= 0) & (m < 2.4)
    rgb = np.where((rim & ~gap)[..., None], stone, rgb)
    rgb = np.where((rim & gap)[..., None], PD[1], rgb)
    alpha = np.where(m >= 0, 255, 0).astype(np.uint8)
    halo = (m < 0) & (m > -1.6) & (hash2(X, Y, seed + 5) > .25)
    rgb = np.where(halo[..., None], PD[1], rgb)
    alpha = np.where(halo, 110, alpha).astype(np.uint8)
    return rgb, alpha

def autotile_puddle(): return _cells(puddle_shader, 211, 3.0, 3.0, 7.0)

# ---------------------------------------------------------------- 돌 틈 이끼(시그니처 2)
def moss_shader(X, Y, m, n, seed):
    """그늘진 돌 바닥을 덮은 이끼 깔개: 속은 촘촘한 이끼(MOSS 3·4, 둥근 덩이 5 빛, 덩이 사이 2 그늘), 드문 이끼 포자 대(밝은 점),
    가장자리로 갈수록 덩이가 성겨져 돌 틈에만 남는다(바깥 2px 는 듬성듬성한 점). 걷기."""
    t = tnoise(16, 16, 4, seed)[Y % 16, X % 16] + (hash2(X, Y, seed + 1) - .5) * .35
    k = np.where(t > .55, 4, 3); k = np.where(t > .72, 5, k); k = np.where(t < .28, 2, k)
    rgb = MS[k]
    spore = hash2(X, Y, seed + 2) > .955
    rgb = np.where(spore[..., None], MS[6], rgb)
    rgb = np.where(np.roll(spore, -1, 0)[..., None], MS[2], rgb)
    alpha = (m >= 0) & ~((m < 2.0) & (hash2(X, Y, seed + 3) > .15 + .4 * m))
    dots = (m < 0) & (m > -2.2) & (hash2(X, Y, seed + 4) > .78)
    rgb = np.where(dots[..., None], MS[np.clip((hash2(X, Y, seed + 5) * 3).astype(int) + 2, 1, 6)], rgb)
    return rgb, alpha | dots

def autotile_moss(): return _cells(moss_shader, 221, 2.8, 3.4, 7.0)

# ---------------------------------------------------------------- 녹는 눈(시그니처 3)
def slush_shader(X, Y, m, n, seed):
    """늦겨울 그늘에 남은 녹는 눈 덩이: 속은 회백 눈(SNOW 5·6, 굳은 결 4, 섞인 자갈 점), 가장자리 2~3px 는 녹아 질척한 회색 물기
    (SLUSH 3·4, 반쯤 비침)로 얇아지고, 바깥에는 녹은 물 점. 덩이 북쪽 가장자리는 한 단 그늘(두께). 걷기."""
    t = tnoise(16, 16, 8, seed)[Y % 16, X % 16] + (hash2(X, Y, seed + 1) - .5) * .3
    k = np.where(t > .45, 6, 5); k = np.where(t < .25, 4, k)
    rgb = SN[k]
    crust = (hash2(X // 2, Y, seed + 2) > .85)
    rgb = np.where(crust[..., None], SN[4], rgb)
    grit = hash2(X, Y, seed + 3) > .965
    rgb = np.where(grit[..., None], CB[2], rgb)
    alpha = np.where(m >= 0, 255, 0).astype(np.uint8)
    edge = (m >= 0) & (m < 2.6)
    rgb = np.where(edge[..., None], np.where((hash2(X, Y, seed + 4) > .45)[..., None], A_(SLUSH)[4], A_(SLUSH)[3]), rgb)
    alpha = np.where(edge & (m < 1.1), 170, alpha)
    lip = (m >= 2.6) & (m < 3.6)
    rgb = np.where(lip[..., None], SN[4], rgb)
    drip = (m < 0) & (m > -2.0) & (hash2(X, Y, seed + 5) > .8)
    rgb = np.where(drip[..., None], A_(SLUSH)[2], rgb)
    alpha = np.where(drip, 140, alpha).astype(np.uint8)
    return rgb, alpha

def autotile_slush(): return _cells(slush_shader, 231, 3.2, 3.4, 7.5)

# ---------------------------------------------------------------- 잔디 위 자갈 골목(길 이음)
def cobblepath_shader(X, Y, m, n, seed):
    """정원·뒷골목 잔디 위 자갈길: 속은 둥근 자갈(16 주기, ground-cobble 과 같은 결), 가장자리 2~3px 는 자갈이 성겨지며
    틈에 흙(GRAV 3)이 드러나고 가장 바깥은 잔디가 먹어 든다(투명 — 밑 잔디가 비친다). 바깥으로 튄 자갈 몇 알."""
    stone, gap = cobble16(seed)
    rgb = stone.copy()
    edge = (m >= 0) & (m < 2.8)
    loose = edge & gap
    rgb = np.where(loose[..., None], GV[np.clip((hash2(X, Y, seed + 2) * 2).astype(int) + 2, 1, 6)], rgb)
    alpha = (m >= 0) & ~((m < 1.2) & gap) & ~((m < .6) & (hash2(X, Y, seed + 3) > .4))
    peb = (m < 0) & (m > -2) & (hash2(X, Y, seed + 4) > .9)
    rgb = np.where(peb[..., None], CB[5], rgb)
    return rgb, alpha | peb

def autotile_cobblepath(): return _cells(cobblepath_shader, 241, 2.6, 2.6, 6.5)

# ---------------------------------------------------------------- 낮은 돌 받침 + 쇠 난간(울타리, 막힘)
def _cv32(): return Image.new('RGBA', (32, 32))
def rail_cell(n):
    """동서로 이으면 앞에서 본 난간: 낮은 크림 돌 받침(갓돌 윗면 6 + 앞면 마름돌 2줄) 위 검은 쇠 난간(위 가로대 + 2px 간격 살 + 살 끝 창끝).
    남북으로 이으면 3/4 로 본 난간 윗면(갓돌 줄 + 살 점). 칸마다 가운데 굵은 네모 쇠 기둥(공 머리). 참고 그림의 낮은 담 + 철책을 일반 어휘로."""
    im = _cv32(); px = im.load(); o = 8
    hasN, hasE, hasS, hasW = bool(n & N_), bool(n & E_), bool(n & S_), bool(n & W_)
    cx = o + 7; top = o + 2; cap = o + 9; bot = o + 15
    def P(x, y, R, k):
        if 0 <= x < 32 and 0 <= y < 32: px[x, y] = R[clamp(k, 0, 6)] + (255,)
    xs = []
    if hasW: xs += list(range(0, cx))
    if hasE: xs += list(range(cx + 2, 32))
    for x in xs:
        P(x, top + 1, IRON, 5); P(x, top + 2, IRON, 2)                    # 위 가로대
        P(x, cap - 2, IRON, 3)
        if x % 2 == 0:
            for y in range(top + 3, cap - 1): P(x, y, IRON, 4)
            P(x, top, IRON, 6)
        P(x, cap, TRIM, 6 if x % 9 else 5); P(x, cap + 1, TRIM, 4)            # 갓돌
        for y in range(cap + 2, bot + 1):                                    # 돌 받침 앞면
            ly = y - cap - 2; lx = (x + (4 if ly >= 3 else 0)) % 8
            k = 3 if (ly in (2, 5) or lx == 7) else (5 if ly in (0, 3) else 4)
            if y == bot: k = 2
            P(x, y, CREAM, k)
    if hasN or hasS:
        y0 = 0 if hasN else cap; y1 = 31 if hasS else bot
        for y in range(y0, y1 + 1):
            P(cx - 2, y, TRIM, 6); P(cx - 1, y, TRIM, 5); P(cx, y, IRON, 5 if y % 2 else 4); P(cx + 1, y, IRON, 2)
            P(cx + 2, y, TRIM, 4); P(cx + 3, y, CREAM, 2)
    for y in range(top - 1, cap):                                          # 기둥
        P(cx, y, IRON, 5); P(cx + 1, y, IRON, 2); P(cx - 1, y, IRON, 3); P(cx + 2, y, IRON, 1)
    P(cx, top - 3, IRON, 6); P(cx + 1, top - 3, IRON, 3); P(cx - 1, top - 2, IRON, 4); P(cx, top - 2, IRON, 5); P(cx + 1, top - 2, IRON, 3); P(cx + 2, top - 2, IRON, 1)
    for x in range(cx - 2, cx + 4):                                         # 기둥 밑 돌 받침
        P(x, cap, TRIM, 6 if x < cx + 1 else 4); P(x, cap + 1, TRIM, 4)
        for y in range(cap + 2, bot + 1): P(x, y, CREAM, 4 if x < cx + 1 else 3)
        P(x, bot, CREAM, 2)
    return im

def autotile_ironrail():
    cells = [_cv32 and rail_cell(n).crop((8, 8, 24, 24)) for n in range(16)]
    return sheet_from_cells(cells)

# ---------------------------------------------------------------- 다듬은 회양목 울(막힘)
def hedge_shader(X, Y, m, n, seed):
    """다듬은 회양목 울타리 덩이: 윗면은 밝은 잎 결(LEAF 4·5, 잎 점 6), 남쪽 끝 칸은 앞면 그늘(아래 4px 2·1단)이 보여 두께가 선다.
    가장자리는 둥글게 다듬은 잎 톱니. 막힘(통행은 partmeta)."""
    t = hash2(X, Y, seed) + tnoise(16, 16, 4, seed + 1)[Y % 16, X % 16] * .6
    k = np.where(t > .95, 5, 4); k = np.where(t < .55, 3, k)
    rgb = A_(LEAF)[k]
    rgb = np.where((hash2(X, Y, seed + 2) > .93)[..., None], A_(LEAF)[6], rgb)
    alpha = m >= 0
    if not (n & S_):
        dS = edge_fields(n, 2.0, 1.4, 5.0, seed)[3]
        front = (dS >= 0) & (dS < 5)
        rgb = np.where(front[..., None], np.where((dS < 1.5)[..., None], A_(LEAF)[1], A_(LEAF)[2]), rgb)
    lit = (m >= 0) & (m < 1.2)
    rgb = np.where((lit & ((X + Y) < 14))[..., None], A_(LEAF)[5], rgb)
    return rgb, alpha

def autotile_hedge(): return _cells(hedge_shader, 251, 2.0, 1.4, 5.0)

AUTOTILES = {'autotile-puddle': autotile_puddle, 'autotile-moss': autotile_moss, 'autotile-slush': autotile_slush,
             'autotile-cobblepath': autotile_cobblepath, 'autotile-ironrail': autotile_ironrail, 'autotile-hedge': autotile_hedge}
_AS = {}
def sheet(name):
    if name not in _AS: _AS[name] = AUTOTILES[name]()
    return _AS[name]

# ---------------------------------------------------------------- 시험 그림
SHAPES = {
 'blob5': ["........", "..XXX...", ".XXXXX..", ".XXXXXX.", ".XXXXX..", "..XXXX..", "...X....", "........"],
 'spiral': ["..........", ".XXXXXXX..", ".X.....X..", ".X.XXX.X..", ".X.X.X.X..", ".X.X...X..", ".X.XXXXX..", ".X........", ".XXXXXXXX.", ".........."],
 'nose_L': ["..........", ".XXX......", ".XXX......", ".XXXX.....", ".XXXXXXXX.", "XXXXXXXXXX", ".XXXXXXX..", "..XX......", ".........."],
}
def stamp(sh, rows, bg):
    h = len(rows); w = len(rows[0]); out = Image.new('RGBA', (w * 16, h * 16))
    for y in range(0, h * 16, 48):
        for x in range(0, w * 16, 48): out.alpha_composite(bg, (x, y))
    on = lambda x, y: 0 <= x < w and 0 <= y < h and rows[y][x] == 'X'
    for y in range(h):
        for x in range(w):
            if not on(x, y): continue
            k = (1 if on(x, y - 1) else 0) | (2 if on(x + 1, y) else 0) | (4 if on(x, y + 1) else 0) | (8 if on(x - 1, y) else 0)
            out.alpha_composite(sh.crop(((k % 4) * 16, (k // 4) * 16, (k % 4) * 16 + 16, (k // 4) * 16 + 16)), (x * 16, y * 16))
    return out

def check_sheet(path, scale=3):
    rows = [('autotile-puddle (on ground-cobble)', 'autotile-puddle', 'ground-cobble'),
            ('autotile-puddle (on ground-wetstone)', 'autotile-puddle', 'ground-wetstone'),
            ('autotile-moss (on ground-cobble)', 'autotile-moss', 'ground-cobble'),
            ('autotile-moss (on ground-flagstone)', 'autotile-moss', 'ground-flagstone'),
            ('autotile-slush (on ground-cobble)', 'autotile-slush', 'ground-cobble'),
            ('autotile-slush (on ground-lawn)', 'autotile-slush', 'ground-lawn'),
            ('autotile-cobblepath (on ground-lawn)', 'autotile-cobblepath', 'ground-lawn'),
            ('autotile-hedge (on ground-lawn)', 'autotile-hedge', 'ground-lawn'),
            ('autotile-ironrail (on ground-cobble)', 'autotile-ironrail', 'ground-cobble')]
    blocks = []
    for (title, an, gn) in rows:
        sh = sheet(an); bg = ground_sample(gn)
        raw = Image.new('RGBA', (76, 76), (40, 40, 46, 255)); raw.alpha_composite(bg.crop((0, 0, 64, 64)) if bg.width >= 64 else bg, (6, 6))
        raw2 = Image.new('RGBA', (64, 64)); raw2.alpha_composite(bg, (0, 0)); raw2.alpha_composite(bg, (48, 0)); raw2.alpha_composite(bg, (0, 48)); raw2.alpha_composite(bg, (48, 48))
        raw.alpha_composite(raw2, (6, 6)); raw.alpha_composite(sh, (6, 6))
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
    check_sheet(os.path.join(HERE, '_qa', 'check-autotile-draft.png'), 2)
