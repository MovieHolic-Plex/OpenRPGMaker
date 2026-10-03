"""도쿄 지구 확장 부품 — 거리 칸·군중·가로수·비전 벽·하치코·센터가이 아치·지하철 출입구·고가·열차. 모든 색은 modern3 램프 안."""
import random
from paint2 import *
import tune, post as _post
import numpy as _np

def ink(c, edge=3, inner=2, soft=1):
    """밑그림 Cv 를 윤곽 처리한 새 Cv. 가장자리에 1px 투명 여백이 있어야 한다."""
    o = Cv(c.w, c.h); o.a[:] = tune.ink(_post.contour(c.a), edge=edge, inner=inner, soft=soft); return o

def autoshade(c, mask, ramp, hi=1, lo=-1, base=0, only=None):
    """mask(bool 배열) 안을 램프로 칠한다. 왼쪽/위가 비면 밝게, 오른쪽/아래가 비면 어둡게."""
    h, w = mask.shape
    for y in range(h):
        for x in range(w):
            if not mask[y, x]: continue
            t = base
            if x == 0 or not mask[y, x - 1] or y == 0 or not mask[y - 1, x]: t += hi
            if x == w - 1 or not mask[y, x + 1] or y == h - 1 or not mask[y + 1, x]: t += lo
            c.P(x, y, K(ramp, t))

def bayer(x, y): return ((0, 8, 2, 10), (12, 4, 14, 6), (3, 11, 1, 9), (15, 7, 13, 5))[y % 4][x % 4]
def dith(c, x0, y0, w, h, ca, cb, vertical=True, t0=0.0, t1=1.0):
    """ca→cb 순서 디더 그라데이션(세로면 위→아래, 아니면 왼→오)."""
    for j in range(h):
        for i in range(w):
            t = (j / max(h - 1, 1)) if vertical else (i / max(w - 1, 1))
            t = t0 + (t1 - t0) * t
            c.P(x0 + i, y0 + j, cb if t * 16 > bayer(x0 + i, y0 + j) else ca)

# ───────── 거리 칸 ─────────
def diag_zebra():
    """대각 횡단: 줄이 차 진행과 평행하게 '\\' 방향으로 달린다. (x-y) 주기 16 이라 칸 이어붙임이 맞는다."""
    c = road_cell('c')
    for y in range(16):
        for x in range(16):
            if 3 <= (x - y) % 16 <= 9: c.P(x, y, K('shiro', 3) if (x - y) % 16 != 3 else K('shiro', 4))
    return c
def pave_cell(kind='a'):
    """돌 포장(광장·경내). 8px 격자 어긋나게."""
    c = cell()
    base = K('conc', 3) if kind == 'a' else K('conc', 2)
    for y in range(16):
        for x in range(16): c.P(x, y, base)
    for y in range(16):
        for x in range(16):
            yy = y % 8; xx = (x + (4 if (y // 8) % 2 else 0)) % 8
            if yy == 0 or xx == 0: c.P(x, y, K('conc', 1))
    if kind == 'b':
        for (x, y) in ((3, 3), (11, 10), (6, 13), (13, 4)): c.P(x, y, K('conc', 4))
    return c
def lawn_cell():
    c = cell()
    for y in range(16):
        for x in range(16): c.P(x, y, K('midori', 0) if (x * 5 + y * 3) % 7 else K('midori', 1))
    for (x, y) in ((2, 3), (9, 6), (13, 12), (5, 11), (11, 1)): c.P(x, y, K('midori', 2)); c.P(x, y + 1, K('midori', -1))
    return c
def sando_cell(kind='a'):
    """참배길 — 큰 판석, 줄눈은 낮은 대비."""
    c = cell()
    for y in range(16):
        for x in range(16): c.P(x, y, K('hodo', 3))
    c.HL(0, 0, 16, K('hodo', 2)); c.VL(0, 0, 16, K('hodo', 2) if kind == 'a' else K('hodo', 3))
    for (x, y) in ((4, 5), (10, 9), (6, 12)): c.P(x, y, K('hodo', 4))
    return c
def curb_plant(kind='a'):
    """가로수 띠(식수대): 흙 + 풀."""
    c = cell()
    for y in range(16):
        for x in range(16): c.P(x, y, K('soil', 0) if (x + y) % 5 else K('soil', 1))
    c.HL(0, 0, 16, K('conc', 4)); c.HL(0, 1, 16, K('conc', 2)); c.HL(0, 15, 16, K('conc', 0))
    for (x, y) in ((3, 6), (10, 9), (7, 12), (13, 5)): c.P(x, y, K('midori', 1)); c.P(x, y - 1, K('midori', 3))
    return c
def rail_cell(kind='a'):
    """고가 위 선로: 침목 + 레일(가로 방향 열차)."""
    c = cell()
    for y in range(16):
        for x in range(16): c.P(x, y, K('hodo', -1))
    for x in range(0, 16, 4): c.R(x, 3, 2, 10, K('ita', -2))
    c.HL(0, 5, 16, K('tekko', 3)); c.HL(0, 6, 16, K('tekko', 1)); c.HL(0, 10, 16, K('tekko', 3)); c.HL(0, 11, 16, K('tekko', 1))
    return c

# ───────── 군중 ─────────
HAIR = ['sumi', 'sumi', 'soil', 'renga']
TOPS = ['sora', 'aka', 'shiro', 'midori', 'kii', 'pinku', 'murasaki', 'daidai', 'kon', 'tekko']
BOTT = ['tekko', 'kon', 'conc', 'sumi', 'sora', 'hodo']
SKIN = ['daidai', 'kinari']
BODY = ['....oooooooo....', '...ohhhhhhhho...', '..ohhhhhhhhhho..', '..ohhhhhhhhhho..', '..ohhssssssho...', '..ohsossssosho..', '..osssssssssso..', '...osssssssso...', '....oooooooo....',
        '...oottttttoo...', '..otttttttttto..', '.oottttttttttoo.', '.osttttttttttso.', '.osttttttttttso.', '.oottttttttttoo.', '..ottppppppttto.', '...oppppppppo...', '...oppppppppo...',
        '...oppp..pppo...', '...oppp..pppo...', '...oppp..pppo...', '...oppp..pppo...', '...owww..wwwo...', '...oooo..oooo...']
SKIRT = {15: '..ottpppppptto...', 16: '..oppppppppppo..', 17: '..oppppppppppo..', 18: '...osss..sssso..', 19: '...osss..sssso..', 20: '...osss..sssso..', 21: '...osss..sssso..'}
def person(variant):
    """16x24 사람. 변형 번호로 머리·윗옷·아래·치마·가방을 정한다."""
    rng = random.Random(variant * 977 + 13)
    hair = rng.choice(HAIR); top = rng.choice(TOPS); bot = rng.choice(BOTT); skin = rng.choice(SKIN); skirt = rng.random() < .35; bag = rng.random() < .4
    c = Cv(16, 32); o = K('sumi', 1)
    rows = list(BODY)
    if skirt:
        for r, s in SKIRT.items(): rows[r] = s.ljust(16, '.')[:16]
    cm = {'o': o, 'h': K(hair, -1 if hair in ('sumi',) else 0), 's': K(skin, 2), 't': K(top, 1), 'p': K(bot, 0), 'w': K('sumi', 2)}
    for j, r in enumerate(rows):
        for i, ch in enumerate(r.ljust(16, '.')[:16]):
            if ch not in cm: continue
            col = cm[ch]
            if ch == 't' and i >= 11: col = K(top, 0 if top != 'shiro' else -1)
            if ch == 'p' and i >= 8: col = K(bot, -1)
            if ch == 's' and i >= 11: col = K(skin, 1)
            if ch == 'p' and skirt and 18 <= j <= 21: col = K(skin, 2)
            c.P(i, 8 + j, col)
    if bag:
        bc = rng.choice(['soil', 'kii', 'aka', 'tekko'])
        c.R(1, 8 + 12, 3, 5, K(bc, 1)); c.VL(1, 8 + 12, 5, K(bc, 3)); c.HL(1, 8 + 16, 3, K(bc, -1))
    return c

# ───────── 가로수 ─────────
def blob_mask(w, h, circles):
    m = _np.zeros((h, w), bool)
    for (cx, cy, r) in circles:
        for y in range(h):
            for x in range(w):
                if (x - cx) ** 2 + (y - cy) ** 2 <= r * r: m[y, x] = True
    return m
def tree_street(kind='zelkova', seed=1):
    """가로수 3x5칸(48x80): 수관 덩어리 + 줄기 + 식수 틀. kind: zelkova(연두) ginkgo(노랑) sakura(분홍)."""
    c = Cv(48, 80); rng = random.Random(seed)
    circles = [(24, 22, 17), (13, 28, 11), (35, 28, 11), (24, 10, 11), (24, 34, 11), (10, 18, 8), (38, 18, 8)]
    m = blob_mask(48, 64, circles)
    ramp = {'zelkova': 'midori', 'ginkgo': 'kii', 'sakura': 'pinku'}[kind]
    for y in range(64):
        for x in range(48):
            if not m[y, x]: continue
            t = 0
            if y < 16 + (x % 5): t += 1
            if x < 18 and y < 30: t += 1
            if x > 30 or y > 42: t -= 1
            if (x * 7 + y * 11 + seed) % 9 == 0: t += 1 if (x + y) % 2 else -1
            c.P(x, y, K(ramp, max(-2, min(2, t))))
    # 줄기
    c.R(21, 52, 6, 22, K('ita', -1)); c.VL(21, 52, 22, K('ita', 1)); c.VL(26, 52, 22, K('ita', -3)); c.R(20, 70, 8, 4, K('ita', 0)); c.HL(20, 73, 8, K('ita', -3))
    c.R(21, 40, 3, 14, K('ita', -2))
    # 식수 틀
    c.R(10, 74, 28, 5, K('conc', 3)); c.HL(10, 74, 28, K('shiro', 3)); c.R(12, 75, 24, 2, K('soil', 1)); c.HL(10, 78, 28, K('conc', 0))
    return ink(c)

# ───────── 비전 벽 / LED ─────────
def vision(kind=0, w=6, h=4):
    """건물 벽면 대형 LED 화면 (w x h 칸). 틀 2px + 안쪽 디더 그라데이션 + 추상 도형. 글자·로고 없음."""
    c = Cv(16 * w, 16 * h); W, H = c.w, c.h
    c.R(0, 0, W, H, K('tekko', -2)); c.HL(0, 0, W, K('tekko', 1)); c.VL(0, 0, H, K('tekko', 0))
    x0, y0, iw, ih = 3, 3, W - 6, H - 6
    pal = [('sora', 'pinku', 'shiro'), ('kii', 'aka', 'shiro'), ('midori', 'sora', 'kii'), ('murasaki', 'neonP', 'neonC')][kind % 4]
    a, b, hi = pal
    ca = K(a, -1) if a in RAMPS and len(RAMPS[a]) == 5 else K(a, -1)
    cb = K(b, 2) if len(RAMPS[b]) == 5 else K(b, 1)
    dith(c, x0, y0, iw, ih, K(a, 0), cb, vertical=(kind % 2 == 0))
    rng = random.Random(kind * 31 + 5)
    for _ in range(4 + w // 2):          # 추상 도형: 둥근 점·띠
        cx = rng.randrange(x0 + 6, x0 + iw - 6); cy = rng.randrange(y0 + 6, y0 + ih - 6); r = rng.randrange(3, 7)
        col = K(hi, 3) if len(RAMPS[hi]) == 5 else K(hi, 1)
        for yy in range(-r, r + 1):
            for xx in range(-r, r + 1):
                if xx * xx + yy * yy <= r * r and x0 <= cx + xx < x0 + iw and y0 <= cy + yy < y0 + ih: c.P(cx + xx, cy + yy, col if (xx + yy) % 5 else K(hi, 2) if len(RAMPS[hi]) == 5 else K(hi, 0))
    for j in range(2):
        c.R(x0 + 4, y0 + ih - 8 + j * 4, iw // 2 - j * 8, 2, K('shiro', 3))
    for yy in range(y0, y0 + ih, 2):     # 주사선
        for xx in range(x0, x0 + iw, 4): pass
    c.HL(x0, y0, iw, K('shiro', 4)); c.VL(x0, y0, ih, K('shiro', 2))
    return c

# ───────── 하치코 ─────────
def hachiko():
    c = Cv(32, 48)
    # 받침(돌)
    c.R(4, 32, 24, 14, K('conc', 1)); c.HL(4, 32, 24, K('conc', 4)); c.HL(4, 33, 24, K('conc', 3)); c.VL(4, 33, 13, K('conc', 3)); c.VL(27, 33, 13, K('conc', -1)); c.HL(4, 45, 24, K('conc', -2))
    c.R(2, 43, 28, 4, K('conc', 2)); c.HL(2, 43, 28, K('conc', 4)); c.HL(2, 46, 28, K('conc', -1))
    # 개(청동색)
    rows = [
        '..........##....',
        '.........####...',
        '........#####...',
        '........######..',
        '........#.####..',
        '.......#########',
        '.......#######..',
        '......########..',
        '.....#########..',
        '....##########..',
        '...###########..',
        '...###########..',
        '...####..#####..',
        '...###...#####..']
    m = _np.zeros((14, 16), bool)
    for j, r in enumerate(rows):
        for i, ch in enumerate(r): m[j, i] = ch == '#'
    sub = Cv(16, 14); autoshade(sub, m, 'soil', hi=1, lo=-1, base=0)
    for j in range(14):
        for i in range(16):
            if sub.a[j, i, 3]: c.P(8 + i, 18 + j, tuple(sub.a[j, i, :3]) and (sub.a[j, i, 0], sub.a[j, i, 1], sub.a[j, i, 2]) and None) if False else None
    for j in range(14):
        for i in range(16):
            if sub.a[j, i, 3]: c.a[18 + j, 8 + i] = sub.a[j, i]
    c.P(18, 20, K('sumi', 1)); c.P(19, 20, K('sumi', 1))
    return ink(c)

# ───────── 센터가이 아치 ─────────
def arch_gate(text='センター街', w=10):
    """보행자 거리 입구 아치. 폭 w칸 x 4칸. 기둥 아래는 걸을 수 있다."""
    c = Cv(16 * w, 64); W = c.w
    for px in (4, W - 14):
        c.R(px, 20, 10, 42, K('tekko', 2)); c.VL(px, 20, 42, K('tekko', 4)); c.VL(px + 9, 20, 42, K('tekko', -1)); c.R(px - 2, 58, 14, 5, K('hodo', 3)); c.HL(px - 2, 58, 14, K('hodo', 5))
    c.R(2, 4, W - 4, 22, K('sora', -1)); c.HL(2, 4, W - 4, K('sora', 4)); c.VL(2, 4, 22, K('sora', 3)); c.VL(W - 3, 4, 22, K('sora', -2)); c.HL(2, 25, W - 4, K('sora', -2))
    c.R(5, 7, W - 10, 16, K('sora', 0))
    x = (W - 16 * len(text)) // 2
    for k, ch in enumerate(text): gl(c, x + k * 16, 7, ch, K('shiro', 4), bold=True)
    for i in range(10, W - 10, 8): c.R(i, 1, 4, 3, K('kii', 2))
    return ink(c)

# ───────── 지하철 출입구 ─────────
def metro_entrance(label='A8'):
    """계단 입구 4x3칸. 위쪽에 번호판."""
    c = Cv(64, 48)
    c.R(2, 6, 60, 12, K('conc', 2)); c.HL(2, 6, 60, K('conc', 4)); c.VL(2, 6, 12, K('conc', 3)); c.VL(61, 6, 12, K('conc', -1))
    c.R(8, 9, 48, 6, K('sora', 0)); c.HL(8, 9, 48, K('sora', 3)); gl(c, 24, 6, label[0], K('shiro', 4)) if False else None
    for k, ch in enumerate(label): c.P(0, 0, None)
    # 번호 글자 3x5 도트
    GLY = {'A': ['010', '101', '111', '101', '101'], '8': ['111', '101', '111', '101', '111'], '1': ['010', '110', '010', '010', '111'], '2': ['110', '001', '010', '100', '111'], '3': ['110', '001', '010', '001', '110'], '5': ['111', '100', '110', '001', '110'], 'B': ['110', '101', '110', '101', '110']}
    x = 32 - len(label) * 2
    for ch in label:
        for j, row in enumerate(GLY[ch]):
            for i, v in enumerate(row):
                if v == '1': c.P(x + i, 10 + j, K('shiro', 4))
        x += 4
    c.R(6, 20, 52, 24, K('tekko', -2)); c.HL(6, 20, 52, K('tekko', 0))
    for k in range(7):                     # 내려가는 계단: 안쪽일수록 어둡다
        c.HL(8, 22 + k * 3, 48, K('hodo', 3 - k // 2)); c.HL(8, 23 + k * 3, 48, K('hodo', 1 - k // 2))
    for rx in (6, 56): c.R(rx, 20, 2, 24, K('tekko', 3)); c.VL(rx, 20, 24, K('shiro', 3))
    c.HL(4, 44, 56, K('hodo', -1))
    return ink(c)

# ───────── JR 고가 + 열차 ─────────
def viaduct(w=6):
    """고가 정면 w칸 x 5칸: 위 레일 면, 거더, 교각 2개, 아래는 어둡다(기둥 사이는 통과)."""
    c = Cv(16 * w, 80); W = c.w
    c.R(0, 0, W, 6, K('conc', 4)); c.HL(0, 0, W, K('shiro', 4))
    for x in range(0, W, 8): c.R(x + 2, 1, 4, 4, K('conc', 2))
    c.R(0, 6, W, 12, K('conc', 1)); c.HL(0, 6, W, K('conc', 4)); c.HL(0, 7, W, K('conc', 3)); c.HL(0, 17, W, K('conc', -2)); c.R(0, 18, W, 2, K('hodo', -2))
    for rx in (6, W - 22):
        c.R(rx, 20, 16, 58, K('conc', 1)); c.VL(rx, 20, 58, K('conc', 3)); c.VL(rx + 15, 20, 58, K('conc', -2)); c.VL(rx + 1, 20, 58, K('conc', 4))
        c.R(rx - 2, 74, 20, 5, K('hodo', 2)); c.HL(rx - 2, 74, 20, K('hodo', 4)); c.HL(rx - 2, 78, 20, K('hodo', -1))
        c.HL(rx, 20, 16, K('conc', -2))
    c.R(24, 20, W - 48, 54, K('yoru', -2))
    for x in range(30, W - 30, 20): c.R(x, 40, 6, 3, K('kii', 2)); c.HL(x, 40, 6, K('kii', 4))
    return ink(c)
def train(n=8, stripe='midori'):
    """도시 순환 열차 정면(n칸 x 3칸): 은회색 차체 + 띠 + 창."""
    c = Cv(16 * n, 48); W = c.w
    c.R(1, 6, W - 2, 38, K('conc', 4)); c.HL(1, 6, W - 2, K('shiro', 4)); c.HL(1, 7, W - 2, K('shiro', 3)); c.VL(1, 7, 36, K('shiro', 3)); c.VL(W - 2, 7, 36, K('conc', 1))
    c.R(1, 36, W - 2, 3, K(stripe, 1)); c.HL(1, 36, W - 2, K(stripe, 3)); c.HL(1, 38, W - 2, K(stripe, -1))
    c.HL(1, 43, W - 2, K('conc', -1))
    for x in range(4, W - 12, 20):
        c.R(x, 12, 16, 16, K('tekko', -2)); c.R(x + 1, 13, 14, 14, K('garasu', 1)); c.R(x + 1, 13, 14, 3, K('garasu', 3)); c.VL(x + 8, 13, 14, K('conc', 2))
    for x in range(0, W, 20): c.R(x, 4, 2, 2, K('tekko', 2))
    return ink(c)

def vzebra(kind):
    """세로 줄 횡단(동서로 건너는 길): 줄이 남북 차 진행과 평행."""
    c = road_cell(kind); y0 = 3 if kind == 'n' else 0; y1 = 13 if kind == 's' else 16
    for x in range(4, 12):
        for y in range(y0, y1): c.P(x, y, K('shiro', 3))
    return c
def diag_zebra_k(kind):
    c = diag_zebra()
    return c

# ───────── 자동차 (옆모습, 오른쪽을 본다 — 왼쪽은 좌우 반전) ─────────
CAR_BODY = {'white': ('shiro', 3), 'silver': ('conc', 3), 'black': ('tekko', -1), 'red': ('aka', 1), 'blue': ('sora', 1), 'taxi': ('kii', 2), 'green': ('midori', 1), 'navy': ('kon', 1)}
def car(color='white', kind='sedan', flip=False):
    c = Cv(48, 32); ramp, t = CAR_BODY[color]; y0 = 14
    bod = K(ramp, t); hi = K(ramp, min(t + 1, 2 if len(RAMPS[ramp]) == 5 else 3)); lo = K(ramp, t - 1); dk = K(ramp, t - 2)
    if kind == 'van':
        c.R(3, y0 - 4, 40, 18, bod); c.HL(3, y0 - 4, 40, hi); c.VL(3, y0 - 3, 17, hi); c.VL(42, y0 - 3, 17, lo); c.HL(3, y0 + 13, 40, dk)
        c.R(31, y0 - 2, 10, 7, K('garasu', 2)); c.R(31, y0 - 2, 10, 2, K('garasu', 4)); c.VL(29, y0 - 3, 14, lo)
        c.R(6, y0 + 1, 3, 3, K('garasu', 1)); c.R(11, y0 + 1, 3, 3, K('garasu', 1))
        c.R(4, y0 + 9, 38, 2, K('tekko', 1))
        wx = (11, 35)
    else:
        c.R(2, y0 + 3, 42, 9, bod); c.HL(3, y0 + 2, 40, hi); c.VL(2, y0 + 3, 9, hi); c.VL(43, y0 + 3, 9, lo); c.HL(2, y0 + 12, 42, dk)
        for k in range(10):                                        # 지붕·유리
            xs, xe = 11 + k // 3, 33 - k // 2
            c.HL(xs, y0 - 7 + k, xe - xs, bod if k < 2 else K('garasu', 2))
        c.HL(13, y0 - 7, 18, hi); c.VL(21, y0 - 5, 8, bod); c.R(33, y0 + 2, 3, 2, K('kii', 3)); c.R(2, y0 + 5, 2, 3, K('aka', 1))
        c.R(4, y0 + 9, 38, 2, K('tekko', 1))
        if color == 'taxi':
            c.R(19, y0 - 10, 8, 3, K('shiro', 4)); c.HL(19, y0 - 10, 8, K('shiro', 4)); c.R(20, y0 - 9, 6, 1, K('aka', 2))
        wx = (11, 35)
    for x in wx:
        for yy in range(-4, 5):
            for xx in range(-4, 5):
                if xx * xx + yy * yy <= 16: c.P(x + xx, y0 + 12 + yy, K('sumi', 0) if xx * xx + yy * yy > 5 else K('conc', 1))
    out = ink(c)
    if flip: out.a[:] = out.a[:, ::-1]
    return out
def bus(flip=False, stripe='aka'):
    c = Cv(112, 48); y0 = 8
    c.R(2, y0, 108, 30, K('shiro', 3)); c.HL(2, y0, 108, K('shiro', 4)); c.VL(2, y0 + 1, 29, K('shiro', 4)); c.VL(109, y0 + 1, 29, K('shiro', 1)); c.HL(2, y0 + 29, 108, K('shiro', 0))
    c.R(2, y0 + 20, 108, 4, K(stripe, 1)); c.HL(2, y0 + 20, 108, K(stripe, 3))
    for x in range(8, 96, 15): c.R(x, y0 + 4, 12, 12, K('garasu', 2)); c.R(x, y0 + 4, 12, 3, K('garasu', 4))
    c.R(98, y0 + 3, 10, 18, K('garasu', 2)); c.R(98, y0 + 3, 10, 3, K('garasu', 4)); c.R(88, y0 + 4, 8, 17, K('tekko', 1))
    c.R(94, y0 + 26, 14, 2, K('kii', 2)); c.R(2, y0 - 2, 14, 2, K('conc', 2))
    for x in (22, 88):
        for yy in range(-5, 6):
            for xx in range(-5, 6):
                if xx * xx + yy * yy <= 25: c.P(x + xx, y0 + 29 + yy, K('sumi', 0) if xx * xx + yy * yy > 8 else K('conc', 1))
    out = ink(c)
    if flip: out.a[:] = out.a[:, ::-1]
    return out

def diag_cell(dk, hw=36):
    """대각 횡단 한 칸(\\ 방향 길). dk = (열-행) - 중심선 값. 줄은 걷는 방향과 직각(x+y 주기 16)."""
    c = road_cell('c')
    for y in range(16):
        for x in range(16):
            if abs(16 * dk + (x - y)) <= hw and 3 <= (x + y) % 16 <= 10:
                c.P(x, y, K('shiro', 3) if (x + y) % 16 != 3 else K('shiro', 4))
    return c
