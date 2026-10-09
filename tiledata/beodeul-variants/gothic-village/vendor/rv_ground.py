# (동결 사본) ruined-village/rv_ground.py — 고딕 마을이 그리기 함수를 쓰려고 복사. 경로는 gv_base 가 잡는다.
# 폐허 마을 바닥 — 버들항 칩셋 자체 타일(회색 자갈 포석 (160,96) · 흙길 (64,224) · 잔디 (0,128))을 바탕으로
# 금·빠진 돌·돌 틈 잡초·마른 풀·재를 얹는다(새 노이즈로 바닥을 발명하지 않는다). 오토타일은 16변형(위1·오른2·아래4·왼8).
from rv_base import *
import terrain
from wl import edge_depth, sheet_from_cells, N_, E_, S_, W_, Cv, autotile_composed

def chip(x, y): return np.array(terrain.CH.crop((x, y, x + 16, y + 16)).convert('RGB')).astype(int)
COBBLE = chip(160, 96)      # 버들항 회색 자갈 포석
DIRT = chip(64, 224)        # 버들항 흙길
LAWNT = chip(0, 128)        # 버들항 잔디
LAWN_ = np.array(LAWN)
HAYA = np.array(HAY)

def _tile(T, X, Y): return T[Y % 16, X % 16]

def _dry(rgb, k):
    """잔디 화소를 마른 풀 쪽으로: 밝기 순위를 지킨 채 누런 7단 램프로 옮긴다."""
    l = (0.3 * rgb[..., 0] + 0.59 * rgb[..., 1] + 0.11 * rgb[..., 2])
    t = np.clip(((l - 60) / 120.0 * 5).astype(int) + 1, 1, 6)
    dry = HAYA[t]
    return (rgb * (1 - k[..., None]) + dry * k[..., None]).astype(int)

def _cracks(X, Y, seed, per=48):
    """주기(48) 안에서 이어지는 가는 금: 계단꼴 1화소 선 몇 가닥."""
    m = np.zeros(X.shape, bool)
    rng = np.random.default_rng(seed)
    for _ in range(1 if per <= 16 else 3):
        x, y = rng.integers(0, per), rng.integers(0, per)
        for _k in range(rng.integers(5, 8) if per <= 16 else rng.integers(8, 14)):
            m |= ((X % per) == x % per) & ((Y % per) == y % per)
            if rng.random() < 0.55: x += 1 if rng.random() < 0.6 else -1
            else: y += 1
    return m

STA = np.array(ST)
def flag_tex(X, Y, seed, per=16):
    """버들항 회색 판석(roman.tex_flag 의 톤·줄눈 규칙: 면 = ST4~5 사이 한 톤, 줄눈 ST3, 위·왼 모 밝게)을 칸 주기(per)로.
    한 칸에 판석 두 줄(8px), 줄마다 반 장 엇갈림, 판석 폭 8/16 화소."""
    row = Y // 8; ly = Y % 8
    off = np.where(row % 2 == 1, 5, 0)
    xo = (X + off) % per
    wid = np.where(xo < 10, 10, 6)
    col = np.where(xo < 10, 0, 1); lx = np.where(xo < 10, xo, xo - 10)
    hb = hash2(col + 3 * (row % (per // 8)), row % (per // 8), seed)
    face = STA[4] * (1 - (0.12 + 0.3 * hb))[..., None] + STA[5] * (0.12 + 0.3 * hb)[..., None]
    rgb = face.copy()
    hi = (ly == 0) | (lx == 0)
    rgb = np.where(hi[..., None], face * 0.65 + STA[5] * 0.35, rgb)
    rgb = np.where((hash2(X, Y, seed + 3) < 0.035)[..., None], face * 0.5 + STA[5] * 0.5, rgb)
    joint = (ly == 7) | (lx == wid - 1)
    rgb = np.where(joint[..., None], STA[3], rgb)
    return rgb, joint, col, row, lx, ly

def pave_shader(X, Y, m, n, seed, per=16):
    rgb, joint, col, row, lx, ly = flag_tex(X, Y, seed, per)
    # 금: 판석 하나에 가는 계단꼴 선 하나(드문드문)
    # 줄눈 잡초(드문드문 짧게)
    weed = joint & (hash2(X, Y, seed + 2) > 0.80) & (hash2(X // 4, Y // 4, seed + 3) > 0.5)
    rgb = np.where(weed[..., None], LAWN_[(hash2(X, Y, seed + 4) * 3).astype(int) + 1], rgb)
    if m is not None:
        # 가장자리: 테 없이 판석이 풀에 묻힌다 — 1~2화소 잔디가 판석 위로 번지고, 바깥에는 잔털
        edge = (m >= 0) & (m < 1.6)
        eat = edge & (hash2(X, Y, seed + 6) > 0.30 + 0.35 * m)
        rgb = np.where(eat[..., None], _tile(LAWNT, X, Y), rgb)
        dk = (m >= 1.0) & (m < 2.2) & ~eat
        rgb = np.where(dk[..., None], rgb * 0.82, rgb)                 # 풀 그늘에 덮인 판석 끝
        tuft = (m < 0) & (m > -1.8) & (hash2(X, Y, seed + 7) > 0.74)
        rgb = np.where(tuft[..., None], LAWN_[(hash2(X, Y, seed + 8) * 6).astype(int).clip(0, 5)], rgb)
        return rgb, (m >= 0) | tuft
    return rgb, None

def dirt_shader(X, Y, m, n, seed):
    """버들항 흙길(terrain7.sand_variants: 칩셋 흙 칸 + 1~5화소 들쭉날쭉 풀 테)에 잡초 덩이가 번졌다."""
    import terrain7
    base = np.array(terrain7.sand_variants()[n if m is not None else 15].convert('RGBA')).astype(int)
    rgb = base[..., :3]; alpha = ~np.all(rgb == _tile(LAWNT, X, Y), axis=-1)       # 풀 테 화소는 투명(아래 땅이 비친다)
    tuft = ~alpha & (hash2(X, Y, seed + 9) > 0.80)                                    # 투명 테 안쪽에 남긴 잔풀
    rgb = np.where(tuft[..., None], LAWN_[(hash2(X, Y, seed + 10) * 6).astype(int).clip(0, 5)], rgb); alpha = alpha | tuft
    weed = (hash2(X // 3, Y // 2, seed + 1) > 0.93) & (hash2(X, Y, seed + 2) > 0.3)
    rgb = np.where(weed[..., None], LAWN_[(hash2(X, Y, seed + 3) * 4).astype(int) + 1], rgb)
    dry = (hash2(X, Y, seed + 4) > 0.965)
    rgb = np.where(dry[..., None], HAYA[(hash2(X, Y, seed + 5) * 2).astype(int) + 4], rgb)
    if m is not None:
        return rgb, alpha
    return rgb, None

def _auto(shader, seed, inset, jag, rad):
    cells = []
    X, Y = np.meshgrid(np.arange(16), np.arange(16))
    for n in range(16):
        m, miss = edge_depth(n, inset, jag, rad, seed)
        rgb, alpha = shader(X, Y, m, n, seed)
        a = np.where(alpha, 255, 0).astype(np.uint8)
        cells.append(Image.fromarray(np.dstack([np.asarray(rgb).astype(np.uint8), a]), 'RGBA'))
    return sheet_from_cells(cells)

def autotile_crackedpave(): return _auto(lambda X, Y, m, n, s: pave_shader(X, Y, m, n, s), 71, 1.6, 2.0, 5.0)
def autotile_weedydirt(): return _auto(dirt_shader, 73, 2.4, 2.0, 6.0)

# ---------------------------------------------------------------- 끊긴 나무 울타리(위층)
def brokenfence_cell(n):
    """초원 하이로드 울타리와 같은 획(기둥 3화소, 레일 두 줄)에, 변형마다 정해진 자리의 레일이 부러져 빠지고 기둥이 기울었다."""
    c = Cv(); o = 8
    hasN, hasE, hasS, hasW = bool(n & N_), bool(n & E_), bool(n & S_), bool(n & W_)
    lean = 1 if n in (5, 10, 13) else 0
    px0 = o + 6
    if hasS:
        for y in range(o + 6, 32):
            if n in (4, 6) and o + 16 <= y < o + 21: continue          # 끊긴 자리
            c.set(o + 7, y, 'rot', 5); c.set(o + 8, y, 'rot', 3)
    if hasN:
        for y in range(0, o + 6):
            c.set(o + 7, y, 'rot', 5); c.set(o + 8, y, 'rot', 3)
    for x in range(px0, px0 + 3):
        for y in range(o + 2, o + 16):
            sx = x + (lean if y < o + 9 else 0)
            t = 6 if (y == o + 2 and x == px0) else (5 if y < o + 4 else (5 if x == px0 else (4 if x == px0 + 1 else 3)))
            c.set(sx, y, 'rot', t)
        c.set(x, o + 14, 'rot', 2); c.set(x, o + 15, 'rot', 1)
    xsW = list(range(0, px0)) if hasW else []
    xsE = list(range(px0 + 3, 32)) if hasE else []
    for (ry, tops) in ((o + 4, (5, 4, 3)), (o + 9, (5, 4, 3))):
        for x in xsW + xsE:
            if ry == o + 9 and x in xsE and n % 3 == 0 and x > px0 + 6: continue          # 아래 레일이 빠졌다
            if ry == o + 4 and x in xsW and n % 4 == 1 and x < px0 - 4:                    # 위 레일이 부러져 처졌다
                c.set(x, ry + 3 + (px0 - 4 - x) // 3, 'rot', 4); continue
            for k in range(3): c.set(x, ry + k, 'rot', tops[k])
    if not (hasW or hasE or hasN or hasS):
        for ry in (o + 4,):
            c.rect(px0 - 2, ry, px0 + 4, ry, 'rot', 5); c.rect(px0 - 2, ry + 1, px0 + 4, ry + 2, 'rot', 3)
    return c.img()

def autotile_brokenfence(): return autotile_composed(brokenfence_cell)

# ---------------------------------------------------------------- 바닥 표본 48x48
def _full(shader, seed):
    X, Y = np.meshgrid(np.arange(48), np.arange(48))
    rgb, _ = shader(X, Y, None, 15, seed)
    return Image.fromarray(np.asarray(rgb).astype(np.uint8), 'RGB').convert('RGBA')

def ground_crackedflag(): return _full(lambda X, Y, m, n, s: pave_shader(X, Y, m, n, s, 16), 71)
def ground_weedydirt():
    X, Y = np.meshgrid(np.arange(48), np.arange(48))
    rgb = _tile(DIRT, X, Y).copy()
    weed = (hash2(X // 3, Y // 2, 74) > 0.93) & (hash2(X, Y, 75) > 0.3)
    rgb = np.where(weed[..., None], LAWN_[(hash2(X, Y, 76) * 4).astype(int) + 1], rgb)
    return Image.fromarray(rgb.astype(np.uint8), 'RGB').convert('RGBA')

def ground_drygrass():
    """마른 풀밭: 버들항 잔디 칸을 덩이째 누렇게(밝기 순위 유지) + 마른 풀 이삭 점."""
    X, Y = np.meshgrid(np.arange(48), np.arange(48))
    rgb = _tile(LAWNT, X, Y).astype(int)
    k = 0.55 + (tnoise(48, 48, 16, 81) - 0.5) * 0.25 + (hash2(X, Y, 85) - 0.5) * 0.1
    rgb = _dry(rgb, k)
    stub = (hash2(X, Y, 83) > 0.985)
    rgb = np.where(stub[..., None], HAYA[6], rgb)
    rgb = np.where(np.roll(stub, 1, 0)[..., None], HAYA[2], rgb)
    return Image.fromarray(rgb.astype(np.uint8), 'RGB').convert('RGBA')

def ground_ash():
    """불탄 땅: 버들항 잔디 칸이 그을려 검갈색(숯 램프, 밝기 순위 유지)이 되고, 재 가루(회색 점)·숯 조각·불씨가 드문드문."""
    X, Y = np.meshgrid(np.arange(48), np.arange(48))
    rgb = _tile(LAWNT, X, Y).astype(int)
    l = 0.3 * rgb[..., 0] + 0.59 * rgb[..., 1] + 0.11 * rgb[..., 2]
    t = np.clip(((l - 70) / 90.0 * 3).astype(int) + 2, 2, 5)
    A = np.array(ASH); Cc = np.array(CH)
    rgb = (Cc[t] * 0.75 + A[t] * 0.25).astype(int)
    dust = (hash2(X, Y, 94) > 0.90) & (tnoise(48, 48, 12, 95) > 0.45)
    rgb = np.where(dust[..., None], A[5], rgb)
    bits = (hash2(X // 2, Y, 91) > 0.985) & (hash2(X, Y, 93) > 0.3)
    rgb = np.where(bits[..., None], Cc[1], rgb)
    ember = (hash2(X, Y, 92) > 0.995)
    rgb = np.where(ember[..., None], np.array(hx(PAL['fire'][4])), rgb)
    return Image.fromarray(rgb.astype(np.uint8), 'RGB').convert('RGBA')

TEX = {}
def tex(name):
    if name not in TEX: TEX[name] = {'drygrass': ground_drygrass, 'ash': ground_ash, 'flag': ground_crackedflag, 'dirt': ground_weedydirt}[name]()
    return TEX[name]

# ---------------------------------------------------------------- 포석 위 덧그림: 금 · 빠진 판석
def pave_crack():
    """판석 금(1칸, 아래층 덧그림): 판석을 가로지르는 계단꼴 금 두 줄기(어두운 선 + 아래 밝은 모)와 틈에 돋은 풀."""
    im = Image.new('RGBA', (16, 16)); p = im.load()
    for (x, y, n, d) in ((1, 4, 13, 1), (6, 9, 8, -1)):
        for i in range(n):
            put(p, 16, 16, x, y, ST[2]); put(p, 16, 16, x, y + 1, mix(ST[5], ST[6], 0.3), 200)
            x += 1
            if H(i, x, 3) > 0.55: y += d if 1 <= y + d <= 13 else 0
    for (x, y) in ((4, 5), (5, 4), (11, 8)): put(p, 16, 16, x, y, LAWN[3]); put(p, 16, 16, x, y - 1, LAWN[4])
    return im

def pave_hole():
    """빠진 판석(2x1칸, 아래층 덧그림): 판석 두어 장이 빠져 흙이 드러나고 깨진 가장자리·뒹구는 조각·잡초."""
    W_, H_ = 32, 16; im = Image.new('RGBA', (W_, H_)); p = im.load()
    for y in range(H_):
        for x in range(W_):
            d = ((x + 0.5 - 15) / 13.0) ** 2 + ((y + 0.5 - 8) / 6.0) ** 2 + (vnoise(x, y, 2.0, 61) - 0.5) * 0.6
            if d < 0.78:
                c = tuple(int(v) for v in DIRT[y % 16, x % 16])
                if d > 0.55 and y < 8: c = mul(c, 0.7)                     # 위쪽 깨진 판석이 드리운 그늘
                put(p, W_, H_, x, y, c)
            elif d < 1.0:
                put(p, W_, H_, x, y, ST[6] if y > 8 else ST[2])          # 깨진 판석 단면(아래쪽 모는 빛)
    for (x, y) in ((9, 9), (10, 9), (11, 10), (10, 10)): put(p, W_, H_, x, y, ST[5] if y == 9 else ST[3])     # 뒹구는 조각
    for (x, y) in ((20, 10), (21, 9), (22, 10), (19, 11), (6, 7)): put(p, W_, H_, x, y, LAWN[3 + (x % 2)])
    return im
