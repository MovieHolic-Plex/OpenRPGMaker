# 원시 마을 바닥 — 버들항 칩셋 자체 타일을 바탕으로 한다(새 노이즈로 바닥을 발명하지 않는다).
#   짙은 흙·자갈 : 칩셋 점박이 흙 (16,224) + 칩셋 자갈 (112,288) 을 밝기 순서 그대로 흙빛 사암 램프로 옮긴 덩이 + 잔풀
#   다져진 마당 : 칩셋 고운 흙 (64,224) 을 한 단 어둡게 다진 흙 + 잔돌 + 숯 부스러기
#   고사리 숲 바닥: 점박이 흙 + 떨어진 고사리 잎 조각 + 이끼 점
#   화산재 땅   : 점박이 흙 → 화산재 램프(화산 지대 필드와 같은 재칠) + 붉은 자갈 알·불씨
# 오토타일 16변형(위1·오른2·아래4·왼8): 흙길(아래층 투명 덧그림), 마당 가장자리(풀↔흙), 뾰족 말뚝 울타리(위층).
from pv_base import *
from vf_base import recolor_tile, ground_tex as vf_ground_tex


def chip(x, y): return np.array(terrain.CH.crop((x, y, x + 16, y + 16)).convert('RGB')).astype(int)
DARK = chip(16, 224)          # 버들항 점박이 흙(잔풀 섞임)
SAND = chip(64, 224)          # 버들항 고운 흙
LAWNT = chip(0, 128)          # 버들항 잔디
GRAV, _ = recolor_tile(chip(112, 288).astype(np.uint8), 'rock', 1.2, 4.8)     # 버들항 자갈 → 사암빛 자갈
GRAV = GRAV.astype(int)
LAWN_ = np.array(LAWN)


def _tile(T, X, Y): return T[Y % 16, X % 16]


def _darker(rgb, k):
    """밝기 순위는 그대로, 전체를 어둡고 붉은 흙빛으로(다져진 흙)."""
    return np.clip(rgb * np.array([k, k * 0.96, k * 0.9]), 0, 255).astype(int)


# ---------------------------------------------------------------- 표본 텍스처(48 주기, 이어 붙여도 이음새 없음)
def tex_darkearth(X, Y, seed=301):
    rgb = _tile(DARK, X, Y).copy()
    n = tnoise(48, 48, 16, seed)[Y % 48, X % 48] * 0.7 + tnoise(48, 48, 8, seed + 1)[Y % 48, X % 48] * 0.3
    grav = n > 0.60
    rgb = np.where(grav[..., None], _tile(GRAV, X, Y), rgb)
    # 자갈 덩이 가장자리 1화소는 흙과 섞인다(디더)
    edge = (n > 0.56) & (n <= 0.60) & (hash2(X, Y, seed + 2) > 0.5)
    rgb = np.where(edge[..., None], _tile(GRAV, X, Y), rgb)
    sprig = (hash2(X, Y, seed + 3) > 0.975) & ~grav
    rgb = np.where(sprig[..., None], LAWN_[(hash2(X, Y, seed + 4) * 3).astype(int) + 2], rgb)
    rgb = np.where(np.roll(sprig, -1, 0)[..., None] & (hash2(X, Y, seed + 5) > 0.4), LAWN_[1], rgb)
    return rgb


def tex_yard(X, Y, seed=311):
    rgb = _darker(_tile(SAND, X, Y), 0.86)
    n = tnoise(48, 48, 12, seed)[Y % 48, X % 48]
    worn = n > 0.62                                                   # 더 다져진(밝게 닳은) 자리
    rgb = np.where(worn[..., None], _darker(_tile(SAND, X + 5, Y + 7), 0.95), rgb)
    peb = (hash2(X // 2, Y // 2, seed + 1) > 0.965) & ((X + Y) % 2 == 0)
    rgb = np.where(peb[..., None], np.array(RGB('rock', 5)), rgb)
    rgb = np.where(np.roll(peb, -1, 0)[..., None] & ~peb[..., None], np.array(RGB('rock', 2)), rgb)
    charb = (hash2(X, Y, seed + 2) > 0.988)
    rgb = np.where(charb[..., None], np.array(RGB('char', 2)), rgb)
    return rgb


def tex_fernlitter(X, Y, seed=321):
    rgb = _darker(_tile(DARK, X, Y), 0.9)
    # 떨어진 고사리 잎 조각: 짧은 비스듬한 2~3화소 획(초록·갈색)
    seedpt = (hash2(X // 4, Y // 4, seed) > 0.80)
    lx = X % 4; ly = Y % 4
    stroke = seedpt & (((lx == ly) & (hash2(X // 4, Y // 4, seed + 1) > 0.5)) | ((lx == 3 - ly) & (hash2(X // 4, Y // 4, seed + 1) <= 0.5)))
    green = hash2(X // 4, Y // 4, seed + 2) > 0.45
    rgb = np.where((stroke & green)[..., None], LAWN_[(hash2(X, Y, seed + 3) * 2).astype(int) + 1], rgb)
    rgb = np.where((stroke & ~green)[..., None], np.array(RGB('hide2', 3)), rgb)
    moss = (tnoise(48, 48, 12, seed + 4)[Y % 48, X % 48] > 0.66) & (hash2(X, Y, seed + 5) > 0.45)
    rgb = np.where(moss[..., None], np.array(RGB('moss', 3)), rgb)
    return rgb


def tex_ashgrit(X, Y, seed=331):
    ash, _ = vf_ground_tex('ash')
    rgb = _tile(ash.astype(int), X, Y).copy()
    fine, _ = vf_ground_tex('fine')
    n = tnoise(48, 48, 16, seed)[Y % 48, X % 48]
    rgb = np.where((n > 0.64)[..., None], _tile(fine.astype(int), X, Y), rgb)
    grit = (hash2(X // 2, Y // 2, seed + 1) > 0.95) & ((X * 3 + Y) % 2 == 0)
    rgb = np.where(grit[..., None], np.array(RGB('tuff', 3)), rgb)
    ember = hash2(X, Y, seed + 2) > 0.994
    rgb = np.where(ember[..., None], np.array(RGB('lava', 3)), rgb)
    return rgb


TEX = {'darkearth': tex_darkearth, 'yard': tex_yard, 'fernlitter': tex_fernlitter, 'ashgrit': tex_ashgrit}


def ground_sample(name):
    X, Y = np.meshgrid(np.arange(48), np.arange(48))
    rgb = TEX[name](X, Y)
    return Image.fromarray(np.asarray(rgb).astype(np.uint8), 'RGB').convert('RGBA')


def ground_layer(name, mask_px, seed, edge='dither'):
    """지도용 덮개: 칸 마스크(화소로 늘린 것)를 화소 단위로 흔들어 네모가 안 남게 하고, 가장자리 2화소는 반쯤 비워 잔디와 섞는다."""
    from scipy import ndimage as ndi
    Hp, Wp = mask_px.shape
    Y, X = np.mgrid[0:Hp, 0:Wp]
    dx = np.rint((tnoise(Wp, Hp, 8, seed) - 0.5) * 7 + (tnoise(Wp, Hp, 4, seed + 1) - 0.5) * 3).astype(int)
    dy = np.rint((tnoise(Wp, Hp, 8, seed + 2) - 0.5) * 7 + (tnoise(Wp, Hp, 4, seed + 3) - 0.5) * 3).astype(int)
    m = mask_px[np.clip(Y + dy, 0, Hp - 1), np.clip(X + dx, 0, Wp - 1)]
    rgb = TEX[name](X, Y)
    a = np.where(m, 255, 0).astype(np.uint8)
    inner2 = ndi.binary_erosion(m, iterations=2, border_value=1)
    band = m & ~inner2 & (hash2(X, Y, seed + 21) > 0.5)
    a[band] = 0
    if edge == 'tuft':
        near = ndi.binary_dilation(m, iterations=2) & ~m
        t = near & (hash2(X, Y, seed + 9) > 0.82)
        rgb = np.where(t[..., None], LAWN_[(hash2(X, Y, seed + 10) * 6).astype(int).clip(0, 5)], rgb); a[t] = 255
    return Image.fromarray(np.dstack([np.asarray(rgb).astype(np.uint8), a]), 'RGBA')


# ---------------------------------------------------------------- 오토타일 A: 흙길(버들항 흙길 sand_variants 의 들쭉날쭉 풀 테 + 짙은 다진 흙 + 잔돌)
def _path_tile():
    X, Y = np.meshgrid(np.arange(16), np.arange(16))
    rgb = _darker(_tile(SAND, X, Y), 0.80)
    dk = (hash2(X, Y, 341) > 0.9)
    rgb = np.where(dk[..., None], _tile(DARK, X, Y), rgb)
    peb = (hash2(X // 2, Y // 2, 342) > 0.93) & ((X + Y) % 2 == 0)
    rgb = np.where(peb[..., None], np.array(RGB('rock', 5)), rgb)
    rgb = np.where(np.roll(peb, -1, 0)[..., None] & ~peb[..., None], np.array(RGB('rock', 2)), rgb)
    return Image.fromarray(rgb.astype(np.uint8), 'RGB').convert('RGBA')


def autotile_dirtpath():
    base = _path_tile()
    SV = terrain7.sand_variants(sand_tile=base)
    cells = []
    for n in range(16):
        a = np.array(SV[n].convert('RGBA')).astype(int)
        X, Y = np.meshgrid(np.arange(16), np.arange(16))
        lawn = np.all(a[..., :3] == _tile(LAWNT, X, Y), axis=-1)
        al = np.where(lawn, 0, 255)
        # 풀 테 자리에 잔풀 몇 포기(투명 대신 초록) — 길이 풀에 묻힌다
        tuft = lawn & (hash2(X, Y, 343 + n) > 0.84)
        a[..., :3] = np.where(tuft[..., None], LAWN_[(hash2(X, Y, 344) * 6).astype(int).clip(0, 5)], a[..., :3])
        al = np.where(tuft, 255, al)
        cells.append(Image.fromarray(np.dstack([a[..., :3], al]).astype(np.uint8), 'RGBA'))
    return sheet_from_cells(cells)


# ---------------------------------------------------------------- 오토타일 B: 마당 가장자리(풀↔다진 흙). 이웃이 없는 쪽은 들쭉날쭉하게 풀이 흙 위로 번진다
def yard_shader(X, Y, m, n, seed):
    rgb = tex_yard(X, Y)
    if m is None: return rgb, None
    eat = (m >= 0) & (m < 1.8) & (hash2(X, Y, seed + 6) > 0.25 + 0.4 * m)       # 풀이 흙을 먹은 화소(잔디 그대로)
    rgb = np.where(eat[..., None], _tile(LAWNT, X, Y), rgb)
    rim = (m >= 1.0) & (m < 2.2) & ~eat
    rgb = np.where(rim[..., None], (rgb * 0.84).astype(int), rgb)                # 풀 그늘에 덮인 흙 끝(한 단 어둡게)
    tuft = (m < 0) & (m > -1.6) & (hash2(X, Y, seed + 7) > 0.78)
    rgb = np.where(tuft[..., None], LAWN_[(hash2(X, Y, seed + 8) * 6).astype(int).clip(0, 5)], rgb)
    # 흙 위로 삐친 풀잎(가장자리 2화소 안쪽, 세로 2화소 획)
    blade = (m >= 0.6) & (m < 2.6) & (hash2(X, Y, seed + 9) > 0.86)
    rgb = np.where(blade[..., None], LAWN_[4], rgb)
    rgb = np.where(np.roll(blade, 1, 0)[..., None] & (m >= 0)[..., None] & ~blade[..., None], LAWN_[2], rgb)
    return rgb, (m >= 0) | tuft


def _auto(shader, seed, inset, jag, rad):
    cells = []
    X, Y = np.meshgrid(np.arange(16), np.arange(16))
    for n in range(16):
        m, miss = edge_depth(n, inset, jag, rad, seed)
        rgb, alpha = shader(X, Y, m, n, seed)
        a = np.where(alpha, 255, 0).astype(np.uint8)
        cells.append(Image.fromarray(np.dstack([np.asarray(rgb).astype(np.uint8), a]), 'RGBA'))
    return sheet_from_cells(cells)


def autotile_yardedge(): return _auto(yard_shader, 351, 2.2, 2.2, 6.0)


# ---------------------------------------------------------------- 오토타일 C: 뾰족 말뚝 울타리(위층). 껍질 벗긴 통나무 말뚝 + 덩굴 끈 두 줄
def stake_cell(n):
    c = Cv(); o = 8
    hasN, hasE, hasS, hasW = bool(n & N_), bool(n & E_), bool(n & S_), bool(n & W_)
    def stake(x0, wtop, hgt, seed):
        """말뚝 하나: x0 왼쪽, 땅 y=o+15, 키 hgt, 뾰족한 끝 3화소. 왼쪽 밝음."""
        ybot = o + 15; ytop = ybot - hgt
        for y in range(ytop, ybot + 1):
            k = y - ytop
            for i in range(3):
                if k == 0 and i != 1: continue
                if k == 1 and i == 2: continue
                t = (5 if i == 0 else (4 if i == 1 else 3))
                if k <= 2: t += 1
                if (y + seed) % 6 == 0 and i == 1: t -= 1                  # 옹이·결
                if y >= ybot - 1: t = 2 if y == ybot - 1 else 1
                c.set(x0 + i, y, 'wood', max(1, min(6, t)))
    def rope(x0, x1, y):
        for x in range(x0, x1):
            c.set(x, y, 'rope', 4 if x % 3 else 3); c.set(x, y + 1, 'rope', 2)
    # 가로 이음(서·동): 칸 안에 말뚝 넷(키 들쭉날쭉), 이웃 쪽으로 끝까지 이어진다
    xs = [o + 0, o + 4, o + 8, o + 12]
    if not hasW: xs = [x for x in xs if x >= o + 4]
    if not hasE: xs = [x for x in xs if x <= o + 8]
    if not (hasW or hasE): xs = [o + 6]
    # 세로 이음(북·남): 말뚝이 앞뒤로 겹쳐 선다 — 가운데 기둥 줄 + 위쪽 이웃으로 이어지는 뒤 말뚝 끝
    if hasN:
        for y in range(0, o + 4):
            for i in range(3): c.set(o + 6 + i, y, 'wood', 5 - i)
        for y in range(1, o + 4, 4): c.set(o + 6, y, 'wood', 6); c.set(o + 8, y + 2, 'wood', 2)
    for k, x in enumerate(xs):
        hgt = 13 + int(hash2(x + n * 7, 1, 361) * 3)
        stake(x, 3, hgt, k + n)
    if hasS:
        for y in range(o + 15, 32):
            for i in range(3): c.set(o + 6 + i, y, 'wood', (5 - i) if y < 30 else 2)
    # 끈 두 줄(가로 이음이 있을 때만 칸 끝까지)
    if hasW or hasE:
        x0 = 0 if hasW else min(xs); x1 = 32 if hasE else max(xs) + 3
        rope(x0, x1, o + 5); rope(x0, x1, o + 10)
    elif hasN or hasS:
        for y in (o + 5, o + 10): rope(o + 5, o + 10, y)
    return c.img()


def autotile_stakefence(): return autotile_composed(stake_cell)
