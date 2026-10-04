"""도쿄 지구 부품 3: 담·계단·네온·진열·강. modern3 램프만."""
from parts_tokyo2 import *

def wall_tsuiji():
    """築地塀 1칸 x 2칸: 위에 기와 지붕, 흙벽에 가로 기와 줄무늬."""
    c = Cv(16, 32)
    for j in range(7): c.HL(0, 2 + j, 16, K('tairu', (2 if j < 2 else -1 if j >= 6 else 0) + (0 if (j + 0) % 2 else 0)))
    for i in range(0, 16, 4): c.VL(i, 3, 5, K('tairu', -2))
    c.R(0, 9, 16, 20, K('kinari', 1)); shade(c, 0, 9, 16, 3, -1, ('kinari',))
    for y in (13, 17, 21, 25): c.HL(0, y, 16, K('shiro', 3)); c.HL(0, y + 1, 16, K('kinari', -1))
    c.HL(0, 29, 16, K('conc', 1)); c.HL(0, 30, 16, K('hodo', -1))
    return c
def wall_block():
    """블록 담 1x1: 회색 콘크리트 블록."""
    c = Cv(16, 16)
    c.R(0, 3, 16, 12, K('conc', 2)); c.HL(0, 3, 16, K('conc', 4)); c.HL(0, 14, 16, K('conc', -1))
    for x in (7,): c.VL(x, 4, 5, K('conc', 0))
    c.HL(0, 8, 16, K('conc', 0)); c.VL(3, 9, 5, K('conc', 0)); c.VL(11, 9, 5, K('conc', 0))
    return c
def wall_hedge():
    c = Cv(16, 32)
    for j in range(8, 31):
        for i in range(16):
            if j > 28 - (1 if i % 5 == 0 else 0) and False: continue
            t = 0 if (i * 3 + j * 2) % 5 else 1
            if j < 12: t += 1
            elif j > 25: t -= 1
            c.P(i, j, K('midori', t))
    c.HL(0, 30, 16, K('soil', 0)); c.HL(0, 31, 16, K('hodo', 0))
    return c
def wall_board():
    """판자 담."""
    c = Cv(16, 32)
    c.R(0, 10, 16, 20, K('ita', 0))
    for x in range(0, 16, 4): c.VL(x, 10, 20, K('ita', -2)); c.VL(x + 1, 10, 20, K('ita', 2))
    c.HL(0, 9, 16, K('ita', 3)); c.HL(0, 29, 16, K('ita', -3)); c.HL(0, 30, 16, K('hodo', -1))
    return c
def gate_iron(open_=False):
    c = Cv(16, 32)
    c.R(0, 8, 2, 22, K('tekko', 1)); c.R(14, 8, 2, 22, K('tekko', 1))
    if not open_:
        for x in range(3, 14, 2): c.VL(x, 10, 19, K('tekko', 3 if (x // 2) % 2 else 1))
        c.HL(2, 10, 12, K('tekko', 3)); c.HL(2, 26, 12, K('tekko', 3)); c.R(11, 17, 2, 3, K('daidai', 1)); c.HL(2, 28, 12, K('daidai', -1))
    c.HL(0, 30, 16, K('hodo', -1))
    return c
def sanmon(w=6):
    """사찰 산문: w칸 x 5칸, 맞배 기와 + 두 기둥 + 가운데 통로."""
    W = 16 * w; H = 80; c = Cv(W, H)
    for j in range(26):
        inset = max(0, 8 - j // 3)
        for i in range(inset, W - inset):
            c.P(i, 2 + j, K('tairu', (0 if ((i + (j // 3) * 2) // 4) % 2 else -1) + (2 if j < 3 else -2 if j >= 24 else 0)))
    c.R(6, 28, W - 12, 5, K('ita', -2)); c.HL(6, 28, W - 12, K('ita', 0))
    for x in (8, W - 18): c.R(x, 33, 10, 44, K('ita', -1)); c.VL(x, 33, 44, K('ita', 1)); c.VL(x + 9, 33, 44, K('ita', -3))
    c.R(20, 36, W - 40, 6, K('ita', -2)); c.HL(20, 36, W - 40, K('ita', 0))
    c.R(4, 74, W - 8, 6, K('conc', 3)); c.HL(4, 74, W - 8, K('shiro', 3))
    return ink(c)
def stone_stairs(w=15, h=5):
    """돌계단 (아래로 널찍): w칸 x h칸. 디딤판 줄 + 양옆 철제 난간 + 옹벽."""
    W = 16 * w; H = 16 * h; c = Cv(W, H)
    c.R(0, 0, W, H, K('conc', 3))
    for y in range(0, H, 5): c.HL(6, y, W - 12, K('shiro', 3)); c.R(6, y + 1, W - 12, 3, K('conc', 2)); c.HL(6, y + 4, W - 12, K('conc', -1))
    for x0 in (0, W - 6): c.R(x0, 0, 6, H, K('conc', 1)); c.VL(x0, 0, H, K('conc', 3)); c.VL(x0 + 5, 0, H, K('conc', -2))
    for x in (7, W - 8): c.VL(x, 0, H, K('tekko', 2)); c.VL(x + 1, 0, H, K('tekko', 0))
    return ink(c)
def iron_stair(flip=False):
    """외부 철제 계단 2칸 x 4칸(층 사이 갈지자)."""
    c = Cv(32, 64)
    c.R(0, 0, 4, 64, K('tekko', 1)); c.VL(0, 0, 64, K('tekko', 3)); c.R(28, 0, 4, 64, K('tekko', 1)); c.VL(31, 0, 64, K('tekko', -1))
    for k in range(4):
        y = 14 + k * 12
        for s in range(10):
            xx = 4 + s * 2 if k % 2 == 0 else 26 - s * 2
            c.R(xx, y + s, 4, 2, K('tekko', 3)); c.HL(xx, y + s, 4, K('tekko', 5 if False else 3))
        c.HL(4, y - 2, 24, K('tekko', 2)) if k % 2 == 0 else None
    c.HL(0, 0, 32, K('tekko', 3)); c.HL(0, 31, 32, K('tekko', 3)); c.HL(0, 62, 32, K('tekko', 3)); c.R(0, 62, 32, 2, K('hodo', -1))
    out = ink(c)
    if flip: out.a[:] = out.a[:, ::-1]
    return out
def tin_roof(n=4):
    """함석 지붕(처마 + 세로 홈) n칸 x 1칸."""
    c = Cv(16 * n, 16)
    for i in range(16 * n):
        for j in range(16):
            t = 0 if (i // 2) % 2 else 1
            if j < 2: t += 1
            elif j > 12: t -= 2
            c.P(i, j, K('renga' if False else 'hodo', t) if (i // 16) % 3 else K('renga', t - 1))
    return c
def corrugated_cover(n=4):
    c = Cv(16 * n, 32)
    for i in range(16 * n):
        for j in range(32):
            base = 'hodo' if ((i // 32) % 2) else 'renga'
            t = (1 if (i // 2) % 2 else 0) + (1 if j < 2 else -1 if j > 27 else 0) - (1 if base == 'renga' else 0) + 1
            c.P(i, j, K(base, t))
    for i in range(0, 16 * n, 16): c.R(i, 28, 3, 4, K('ita', -2))
    return ink(c)
def neon_stack(h=8, seed=0, w=1):
    """세로 네온 袖看板 적층 (w칸 x h칸). 글자 없이 색 판과 점멸 램프."""
    rng = random.Random(seed * 7 + 3); c = Cv(16 * w, 16 * h)
    W = 16 * w
    c.R(0, 0, W, 16 * h, K('tekko', -2)); c.VL(0, 0, 16 * h, K('tekko', 1)); c.VL(W - 1, 0, 16 * h, K('tekko', -3))
    y = 2
    while y < 16 * h - 14:
        hh = rng.choice([14, 18, 22, 26]); hh = min(hh, 16 * h - 2 - y)
        col = rng.choice(['aka', 'neonP', 'neonC', 'kii', 'sora', 'midori', 'daidai', 'murasaki'])
        ramp = col
        hi, mid, lo = (K(col, 1), K(col, 0), K(col, -1)) if len(RAMPS[col]) == 3 else (K(col, 3), K(col, 1), K(col, -1))
        c.R(2, y, W - 4, hh, mid); c.HL(2, y, W - 4, hi); c.HL(2, y + hh - 1, W - 4, lo)
        n = rng.randint(2, 3)
        for k in range(n):
            gy = y + 3 + k * ((hh - 5) // n); c.R(5, gy, W - 10, max(2, (hh - 6) // n - 2), K('shiro', 4) if len(RAMPS['shiro']) == 5 else K('shiro', 3))
        for k in range(0, W - 4, 4): c.P(2 + k, y, K('kii', 4))
        y += hh + 2
    return ink(c)
def facade_ad(w=10, h=8, kind=0):
    """건물 정면을 덮는 광고 래핑 (w칸 x h칸)."""
    c = vision(kind, w, h)
    W, H = c.w, c.h
    for x in range(4, W - 4, 16): c.VL(x, 3, H - 6, K('tekko', -2))
    return c
def barricade(n=3):
    c = Cv(16 * n, 16)
    for k in range(n):
        x = k * 16
        c.R(x + 1, 4, 14, 3, K('kii', 3)); c.HL(x + 1, 4, 14, K('kii', 4))
        for i in range(2, 14, 4): c.R(x + i, 4, 2, 3, K('sumi', 1))
        c.R(x + 3, 7, 2, 7, K('tekko', 2)); c.R(x + 11, 7, 2, 7, K('tekko', 2)); c.HL(x + 2, 14, 4, K('hodo', -1)); c.HL(x + 10, 14, 4, K('hodo', -1))
    return ink(c)
def cone():
    c = Cv(16, 16)
    for j in range(10):
        w = 2 + j // 2; c.HL(8 - w, 4 + j, 2 * w, K('daidai', 2 if j % 4 < 2 else 4) if j % 5 != 2 else K('shiro', 4))
    c.R(3, 13, 10, 2, K('daidai', 0)); return ink(c)
def ad_truck(flip=False):
    c = Cv(96, 48)
    c.R(2, 4, 62, 32, K('shiro', 3)); c.HL(2, 4, 62, K('shiro', 4)); c.VL(2, 5, 31, K('shiro', 4))
    c.R(5, 7, 56, 26, K('sora', 0))
    for i in range(56): 
        for j in range(26):
            if (i // 8 + j // 6) % 3 == 0: c.P(5 + i, 7 + j, K('pinku', 2) if j > 13 else K('sora', 2))
    c.R(65, 14, 26, 22, K('tekko', 2)); c.R(68, 17, 14, 9, K('garasu', 2)); c.R(68, 17, 14, 2, K('garasu', 4)); c.HL(65, 14, 26, K('tekko', 4))
    c.R(2, 36, 90, 4, K('tekko', 0)); c.HL(2, 36, 90, K('tekko', 3))
    for x in (16, 78):
        for yy in range(-6, 7):
            for xx in range(-6, 7):
                if xx * xx + yy * yy <= 36: c.P(x + xx, 38 + yy, K('sumi', 0) if xx * xx + yy * yy > 10 else K('conc', 1))
    out = ink(c)
    if flip: out.a[:] = out.a[:, ::-1]
    return out
def water_cell(kind='a'):
    c = cell()
    for y in range(16):
        for x in range(16):
            t = 0 + (1 if (x + y * 2) % 9 == 0 else 0) - (1 if y > 12 else 0)
            c.P(x, y, K('sora', t - 1))
    for (x, y) in ((3, 4), (10, 9), (6, 13), (13, 2)): c.HL(x, y, 3, K('sora', 2))
    return c
def quay_cell(kind='top'):
    c = cell()
    for y in range(16):
        for x in range(16): c.P(x, y, K('conc', 2))
    c.HL(0, 0, 16, K('shiro', 3)); c.HL(0, 1, 16, K('conc', 4))
    for x in range(0, 16, 8): c.VL(x, 2, 14, K('conc', 0))
    for y in (6, 11): c.HL(0, y, 16, K('conc', 0))
    c.HL(0, 15, 16, K('conc', -2))
    return c
def bridge_rail(n=6):
    c = Cv(16 * n, 16)
    c.HL(0, 3, 16 * n, K('tekko', 3)); c.HL(0, 4, 16 * n, K('tekko', 1))
    for x in range(0, 16 * n, 8): c.R(x, 4, 2, 10, K('tekko', 2)); c.VL(x, 4, 10, K('tekko', 4))
    c.HL(0, 9, 16 * n, K('tekko', 1)); c.HL(0, 14, 16 * n, K('hodo', -1))
    return c
def rack(kind=0):
    """옷걸이 랙 2x1: 색 옷."""
    rng = random.Random(kind * 11 + 4); c = Cv(32, 32)
    c.HL(2, 10, 28, K('tekko', 3)); c.VL(2, 10, 20, K('tekko', 2)); c.VL(29, 10, 20, K('tekko', 0)); c.HL(1, 30, 30, K('hodo', -1))
    cols = [('sora', 1), ('aka', 1), ('kinari', 3), ('midori', 1), ('kii', 2), ('kon', 2), ('pinku', 2), ('daidai', 1), ('shiro', 3), ('murasaki', 1)]
    x = 4
    while x < 28:
        col, t = rng.choice(cols); w = rng.choice([3, 3, 4]); h = rng.randint(10, 16)
        c.R(x, 11, w, h, K(col, t)); c.VL(x, 11, h, K(col, min(t + 1, 2))); c.P(x + w // 2, 10, K('tekko', 4)); x += w
    return ink(c)
def record_wagon():
    c = Cv(32, 32)
    c.R(2, 14, 28, 14, K('ita', 0)); c.HL(2, 14, 28, K('ita', 3)); c.VL(2, 15, 13, K('ita', 2)); c.VL(29, 15, 13, K('ita', -2)); c.HL(2, 27, 28, K('ita', -3))
    cols = ['aka', 'sora', 'kii', 'midori', 'shiro', 'kon', 'pinku', 'daidai']
    for k in range(7): c.R(4 + k * 4, 8 + (k % 3), 3, 7, K(cols[k % 8], 1 if cols[k % 8] != 'shiro' else 3))
    for x in (4, 24): c.R(x, 28, 3, 2, K('tekko', -1))
    return ink(c)
def mural(kind=0, w=6, h=6):
    """벽화 패널 (기하/캐릭터 풍). 글자·상표 없음."""
    rng = random.Random(kind * 17 + 9); c = Cv(16 * w, 16 * h); W, H = c.w, c.h
    base = [('sora', 0), ('kii', 1), ('pinku', 0), ('midori', 0)][kind % 4]
    c.R(0, 0, W, H, K(base[0], base[1]))
    cols = ['aka', 'kii', 'sora', 'midori', 'shiro', 'daidai', 'murasaki', 'pinku', 'kon']
    for _ in range(14):
        col = rng.choice(cols); t = rng.choice([0, 1, 2]) if len(RAMPS[col]) == 5 else 0; kindp = rng.choice('crt')
        x = rng.randrange(0, W - 10); y = rng.randrange(0, H - 10); s = rng.randrange(6, 22)
        for j in range(s):
            for i in range(s):
                if kindp == 'r' or (kindp == 'c' and (i - s / 2) ** 2 + (j - s / 2) ** 2 <= s * s / 4) or (kindp == 't' and abs(i - s / 2) <= j / 2):
                    if x + i < W and y + j < H: c.P(x + i, y + j, K(col, t))
    if kind % 2 == 0:                     # 얼굴(추상 캐릭터)
        cx, cy = W // 2, H // 2 - 4
        for j in range(-18, 19):
            for i in range(-16, 17):
                if (i / 16) ** 2 + (j / 18) ** 2 <= 1: c.P(cx + i, cy + j, K('daidai', 3))
        c.R(cx - 9, cy - 6, 5, 5, K('sumi', 1)); c.R(cx + 4, cy - 6, 5, 5, K('sumi', 1)); c.R(cx - 6, cy + 8, 12, 3, K('aka', 0))
    return c
def theatre_front(w=8):
    """소극장 정면 장식 띠(차양 + 출연자 입간판 + 공연 포스터 칸). w칸 x 3칸."""
    c = Cv(16 * w, 48); W = c.w
    c.R(0, 0, W, 10, K('tekko', -1)); c.HL(0, 0, W, K('tekko', 2))
    for x in range(4, W - 4, 12): c.R(x, 3, 8, 4, K('kii', 3 if (x // 12) % 2 else 1))
    for x in range(8, W - 24, 28):
        pc = ['aka', 'sora', 'kii', 'midori', 'pinku'][(x // 28) % 5]
        c.R(x, 16, 20, 28, K(pc, 0)); c.HL(x, 16, 20, K(pc, 2)); c.R(x + 3, 20, 14, 10, K('shiro', 3)); c.R(x + 3, 33, 14, 3, K('shiro', 2)); c.R(x + 3, 38, 9, 2, K('shiro', 2))
    return ink(c)
