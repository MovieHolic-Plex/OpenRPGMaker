# 보정 패스(2026-10-08) — 시그니처 땅 덩이 오토타일 3종. 16변형(4x4, 위1·오른2·아래4·왼8), 위층 투명 덧그림.
#   autotile-lavapool : 검붉은 화산암(스코리아) 덩이 둑 ↔ 흐르는 용암(밝은 띠·식은 껍질 판·거품). 막힘.
#                       결은 화산 지대 필드 용암(vendor/vf_lava.paint, 주기 16)을 그대로 쓰고 둑 돌만 검붉은 램프로 바꾼다.
#   autotile-bogpool  : 고사리 늪 웅덩이 — 탁한 올리브 물(잔물결·개구리밥·수련 잎) ↔ 젖은 진흙 테 ↔ 고사리 풀 둑. 막힘.
#   autotile-ashsoil  : 화산재 흙 덩이 — 재 흙(붉은 자갈 알·불씨) 가 가장자리에서 잔디 위로 흩뿌려지듯 엷어진다. 걷기.
# 가장자리는 wl.edge_depth(이웃 없는 쪽만 inset±jag 출렁임, 볼록 모서리는 둥글게)라 이어 붙이면 둥근 덩이가 된다.
from pv_base import *
import vf_lava
from vf_base import ground_tex as vf_ground_tex, LAV

SCORIA = [hx(c) for c in ('#120707', '#2a100d', '#431a15', '#5c271e', '#77382a', '#93503b', '#ad6a50')]   # 검붉은 화산암 7단
PAL['scoria'] = ['#%02x%02x%02x' % c for c in SCORIA]
GRAIN['scoria'] = (0.12, 1.8)
BOG = [hx(c) for c in ('#0e130c', '#1a2414', '#24321a', '#2f4120', '#3d5228', '#526a34', '#6f8644')]       # 탁한 늪물 7단
MUD = [hx(c) for c in ('#140e08', '#251a10', '#362618', '#47331f', '#5a4428', '#6e5634', '#846a42')]       # 젖은 진흙 7단
DUCK = [hx(c) for c in ('#3e5a1c', '#5f8226', '#86a836', '#b0c84e')]                                       # 개구리밥 4단
LAWNT = np.array(terrain.CH.crop((0, 128, 16, 144)).convert('RGB')).astype(int)                          # 버들항 잔디 칸
SHADET = np.array(terrain.CH.crop((112, 2144, 128, 2160)).convert('RGB')).astype(int)                    # 버들항 그늘 잔디
L6 = np.array(LAWN)
X16, Y16 = np.meshgrid(np.arange(16), np.arange(16))


def _cells(fn, seed, inset, jag, rad):
    cells = []
    for n in range(16):
        m, miss = edge_depth(n, inset, jag, rad, seed)
        rgb, alpha = fn(X16, Y16, m, n, seed)
        a = np.where(alpha, 255, 0).astype(np.uint8)
        cells.append(Image.fromarray(np.dstack([np.asarray(rgb).clip(0, 255).astype(np.uint8), a]), 'RGBA'))
    return sheet_from_cells(cells)


# ---------------------------------------------------------------- A. 용암 웅덩이·용암 강
def autotile_lavapool(seed=83):
    old = vf_lava.OB
    vf_lava.OB = [tuple(int(v) for v in c) for c in SCORIA]
    try:
        sh = vf_lava.lava_sheet(seed)
    finally:
        vf_lava.OB = old
    return sh


# ---------------------------------------------------------------- B. 고사리 늪 웅덩이
def _bog_water(X, Y, m, seed):
    n = tnoise(16, 16, 8, seed)[Y, X] * 0.6 + tnoise(16, 16, 4, seed + 1)[Y, X] * 0.4
    t = np.where(n > 0.62, 3, np.where(n > 0.38, 2, 2))
    t = np.where((hash2(X // 3, Y, seed + 2) > 0.80) & ((X + Y) % 3 == 0) & (n > 0.45), 4, t)        # 가로로 끊긴 잔물결 빛
    t = np.where(m < 3.4, np.minimum(t, 1), t)                                                       # 둑 밑 그늘(가장 어두움)
    t = np.where((m >= 3.4) & (m < 4.4), np.minimum(t, 2), t)
    rgb = np.array(BOG)[t]
    # 개구리밥 덩이(성긴 4화소 무리) — 주기 16 해시라 칸끼리 이어진다
    dk = (hash2(X // 4, Y // 4, seed + 3) > 0.72) & (hash2(X, Y, seed + 4) > 0.45) & (m >= 3.6)
    rgb = np.where(dk[..., None], np.array(DUCK)[(hash2(X, Y, seed + 5) * 3).astype(int) + 1], rgb)
    rgb = np.where((np.roll(dk, -1, 0) & ~dk & (m >= 3.6))[..., None], np.array(DUCK[0]), rgb)
    # 수련 잎 하나(칸 가운데 안쪽에만, 둥근 잎 + 쪼갠 홈)
    lx, ly = 9, 9
    pad = (((X - lx) ** 2 + ((Y - ly) * 1.5) ** 2) <= 7.5) & (m >= 5) & ~((X >= lx) & (Y == ly))
    rgb = np.where(pad[..., None], np.array(DUCK[2]), rgb)
    rgb = np.where((pad & ((X - lx) + (Y - ly) * 1.5 < -1.8))[..., None], np.array(DUCK[3]), rgb)
    rgb = np.where((np.roll(pad, -1, 0) & ~pad & (m >= 5))[..., None], np.array(BOG[0]), rgb)
    return rgb


def bog_shader(X, Y, m, n, seed):
    rgb = _bog_water(X, Y, m, seed)
    if (m >= 90).all(): return rgb, np.ones_like(m, bool)
    grass = _tile(LAWNT, X, Y)
    # 진흙 테: 물가에 1~2화소, 물 쪽 끝은 짙은 줄(젖은 선)
    mud = (m >= 1.2) & (m < 2.9)
    mt = np.where(m < 2.0, 4, 3) - (hash2(X, Y, seed + 7) > 0.7)
    rgb = np.where(mud[..., None], np.array(MUD)[mt.clip(1, 6)], rgb)
    wet = (m >= 2.9) & (m < 3.4)
    rgb = np.where(wet[..., None], np.array(MUD[1]), rgb)
    # 둑 풀: 잔디 + 고사리 잎 획(비스듬한 2~3화소, 밝은 잎 끝)
    bank = (m >= 0) & (m < 1.2)
    rgb = np.where(bank[..., None], grass, rgb)
    leaf = (m > -1.6) & (m < 2.2) & (hash2(X, Y, seed + 8) > 0.70)
    rgb = np.where((leaf & (m < 1.2))[..., None], L6[(hash2(X, Y, seed + 9) * 3).astype(int) + 2], rgb)
    tip = leaf & (m >= 1.2)                                                     # 진흙 위로 늘어진 잎 끝(밝음)
    rgb = np.where(tip[..., None], L6[4], rgb)
    rgb = np.where((np.roll(tip, -1, 0) & ~leaf & (m >= 1.2) & (m < 3.0))[..., None], L6[0], rgb)   # 잎 끝 밑 그늘
    tuft = (m < 0) & (m > -1.6) & (hash2(X, Y, seed + 10) > 0.74)
    rgb = np.where(tuft[..., None], L6[(hash2(X, Y, seed + 11) * 6).astype(int).clip(0, 5)], rgb)
    return rgb, (m >= 0) | tuft


def _tile(T, X, Y): return T[Y % 16, X % 16]


def autotile_bogpool(seed=93): return _cells(bog_shader, seed, 2.6, 2.4, 6.5)


# ---------------------------------------------------------------- C. 화산재 흙 덩이
def ash_shader(X, Y, m, n, seed):
    ash, _ = vf_ground_tex('ash'); fine, _ = vf_ground_tex('fine')
    rgb = _tile(ash.astype(int), X, Y).copy()
    nn = tnoise(16, 16, 8, seed)[Y, X]
    rgb = np.where((nn > 0.62)[..., None], _tile(fine.astype(int), X, Y), rgb)                     # 바람에 쌓인 밝은 재
    grit = (hash2(X // 2, Y // 2, seed + 1) > 0.93) & ((X * 3 + Y) % 2 == 0)
    rgb = np.where(grit[..., None], np.array(RGB('scoria', 4)), rgb)                                # 붉은 자갈 알
    rgb = np.where((np.roll(grit, -1, 0) & ~grit)[..., None], np.array(RGB('scoria', 1)), rgb)
    ember = hash2(X, Y, seed + 2) > 0.992
    rgb = np.where(ember[..., None], np.array(LAV[3]), rgb)
    if (m >= 90).all(): return rgb, np.ones_like(m, bool)
    grass = _tile(LAWNT, X, Y)
    # 가장자리: 재가 잔디 위로 흩뿌려진다(안쪽일수록 재 화소가 많다), 풀 쪽 끝은 재에 덮인 잿빛 풀
    p = np.clip(m / 3.2, 0, 1)
    keep = hash2(X, Y, seed + 3) < (0.25 + 0.75 * p)
    ashed = (m >= 0) & keep
    dull = (m >= 0) & ~keep
    gray = (grass * 0.55 + np.array(RGB('vash', 3)) * 0.45).astype(int)
    rgb = np.where(dull[..., None], gray, rgb)
    dust = (m < 0) & (m > -2.2) & (hash2(X, Y, seed + 4) > 0.80)                                 # 둘레 잿가루 점
    rgb = np.where(dust[..., None], np.array(RGB('vash', 2 + int(hash2(1, 2, seed) * 2))), rgb)
    return rgb, ashed | dull | dust


def autotile_ashsoil(seed=103): return _cells(ash_shader, seed, 1.8, 2.6, 6.0)


SHEETS2 = {'lavapool': autotile_lavapool, 'bogpool': autotile_bogpool, 'ashsoil': autotile_ashsoil}


# ---------------------------------------------------------------- 시험 그림: 4x4 원판 + 이어 붙인 덩이(5x5, 나선, 코 튀어나온 L자, 강줄기)
def stamp(mask, sheet, bg=None):
    Hh, W = len(mask), len(mask[0])
    im = blank(W * 16, Hh * 16) if bg is None else bg.copy()
    on = lambda x, y: 0 <= x < W and 0 <= y < Hh and mask[y][x]
    for y in range(Hh):
        for x in range(W):
            if mask[y][x]:
                k = (1 if on(x, y - 1) else 0) | (2 if on(x + 1, y) else 0) | (4 if on(x, y + 1) else 0) | (8 if on(x - 1, y) else 0)
                im.alpha_composite(cell_of(sheet, k), (x * 16, y * 16))
    return im


def _m(rows): return [[c == '#' for c in r] for r in rows]
TESTS = [
    ('5x5 blob', _m(['.......', '.#####.', '.#####.', '.#####.', '.#####.', '.#####.', '.......'])),
    ('spiral', _m(['.........', '.#######.', '.#.....#.', '.#.###.#.', '.#.#.#.#.', '.#.#...#.', '.#.#####.', '.........'])),
    ('L + nose', _m(['........', '.##.....', '.###....', '.##.....', '.##.....', '.######.', '.#####..', '........'])),
    ('river', _m(['..........', '.##.......', '..###.....', '....##....', '....###...', '......###.', '.......##.', '..........'])),
]


def bg_tile(T, w, h):
    a = np.zeros((h * 16, w * 16, 3), int)
    for y in range(h):
        for x in range(w): a[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16] = T
    return Image.fromarray(a.astype(np.uint8), 'RGB').convert('RGBA')


def check_sheet(path):
    from PIL import ImageDraw
    rows = []
    for name, fn in SHEETS2.items():
        sh = fn()
        bgT = LAWNT if name != 'lavapool' else np.array(vf_ground_tex('ash')[0]).astype(int)
        raw = bg_tile(bgT, 4, 4); raw.alpha_composite(sh)
        tiles = [raw]
        for tn, msk in TESTS:
            tiles.append(stamp(msk, sh, bg_tile(bgT, len(msk[0]), len(msk))))
        rows.append((name, tiles))
    S = 2; pad = 10
    Wt = sum(t.width * S + pad for t in rows[0][1]) + pad
    Ht = sum(max(t.height for t in ts) * S + 24 for _, ts in rows) + pad
    o = Image.new('RGB', (Wt, Ht), (28, 28, 34)); d = ImageDraw.Draw(o); y = pad
    for name, ts in rows:
        x = pad
        labels = ['autotile-' + name + ' (4x4, n=N1+E2+S4+W8)'] + [t for t, _ in TESTS]
        for t, lb in zip(ts, labels):
            d.text((x, y), lb, fill=(230, 230, 230)); o.paste(t.convert('RGB').resize((t.width * S, t.height * S), Image.NEAREST), (x, y + 12))
            x += t.width * S + pad
        y += max(t.height for t in ts) * S + 24
    o.save(path); return o.size


if __name__ == '__main__':
    import sys
    print(check_sheet(os.path.join(HERE, sys.argv[1] if len(sys.argv) > 1 else '_look/check-autotile.png')))
