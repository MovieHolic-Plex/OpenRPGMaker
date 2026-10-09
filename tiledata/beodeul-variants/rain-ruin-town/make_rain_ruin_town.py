# 비 내리는 수직 폐허 도시 (rain-ruin-town) — 72x56 야외. 다시 돌리면 같은 그림.   python3 make_rain_ruin_town.py
# 가파른 언덕에 다섯 단(L0 선착장 · L1 아랫길 · L2 가운데 광장 · L3 윗길 · L4 언덕 위)으로 지은 유럽풍 돌 도시, 밤비.
# 땅·옹벽·계단·폭포·물은 버들항 파이프라인(bd5.Scene = city_v6 terrain/ground/water6)으로 낮 재료로 깔고 night() 로 옮긴다.
# 동선: 서쪽 선착장(L0) → 부두 → 계단 A(x13) → 아랫길 동쪽 → 계단 B(x39) → 분수 광장 → 서쪽 → 계단 C(x13) → 윗길 동쪽 → 계단 D(x38) → 언덕 위 시계탑·극장.
import os, sys, json, math, random
RR = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, RR)
from rr_base import *
from rr_base import _hash
from rr_base import H as hsh
import rr_build as RB, rr_props as RP, rr_ground as RG
from rr_meta import META
import terrain, ground, water6, v6pieces
from scipy import ndimage as ndi

W, H = 72, 56
rng = random.Random(7256)
E4, E3, E2, E1 = 12, 23, 34, 45                 # 단마다 마지막 줄(그 아래 3줄이 옹벽 앞면)
QUAY0, WATER0 = 49, 52


# ---------------------------------------------------------------- 밤 덧칠 도우미(지도 렌더)
def paved_layer(s):
    """젖은 자갈(cobble)·젖은 판석(flags) 바닥(밤 공간). 포장이 풀·물과 만나는 쪽에 버들항 연석(밝은 돌 2px + 어두운 줄눈 1px),
    연석 윗모에 빗물 맺힘. 자갈↔판석·계단은 연석 없이 이어진다."""
    W_, H_ = s.W, s.H; Wp, Hp = W_ * 16, H_ * 16
    Y, X = np.mgrid[0:Hp, 0:Wp]
    cob = RG.wet_cobble(X, Y, 73); flg = RG.wet_flag(X, Y, 71)[0]
    out = np.zeros((Hp, Wp, 4), np.float64)
    sc = s.stair_cells()
    def pav(x, y): return 0 <= x < W_ and 0 <= y < H_ and (s.cobble[y][x] or s.flags[y][x] or (x, y) in sc or (x, y) in s.deck)
    NS = [np.array(N(c), np.float64) for c in ST]
    for cy in range(H_):
        for cx in range(W_):
            if not (s.cobble[cy][cx] or s.flags[cy][cx]): continue
            sl = (slice(cy * 16, cy * 16 + 16), slice(cx * 16, cx * 16 + 16))
            t = (flg if s.flags[cy][cx] else cob)[sl].copy()
            n_, s_, w_, e_ = pav(cx, cy - 1), pav(cx, cy + 1), pav(cx - 1, cy), pav(cx + 1, cy)
            ly, lx = np.mgrid[0:16, 0:16]
            d = np.full((16, 16), 99)
            if not n_: d = np.minimum(d, ly)
            if not s_: d = np.minimum(d, 15 - ly)
            if not w_: d = np.minimum(d, lx)
            if not e_: d = np.minimum(d, 15 - lx)
            alt = (((cx * 16 + lx) // 5 + (cy * 16 + ly) // 5) % 2).astype(bool)
            t = np.where((d == 0)[..., None], NS[1], t)
            t = np.where(((d > 0) & (d < 3))[..., None], np.where(alt[..., None], NS[5], NS[4]) * 0.82, t)
            top = (d == 1) & (~n_ if False else True) & (hash2(cx * 16 + lx, cy * 16 + ly, 5) < 0.4)
            t = np.where(top[..., None], t * 0.5 + np.array(SHEEN[5], np.float64) * 0.5, t)
            out[sl[0], sl[1], :3] = t; out[sl[0], sl[1], 3] = 255
    return Image.fromarray(np.clip(np.rint(out), 0, 255).astype(np.uint8), 'RGBA')

def water_sheen(im, WA, s):
    """밤 물낯: 드문 하늘빛 잔물결 점과 짧은 가로 반사 줄(정지)."""
    a = np.array(im).astype(np.float64); surf = WA.surf
    Y, X = np.mgrid[0:a.shape[0], 0:a.shape[1]]
    dot = surf & (hash2(X, Y, 91) > 0.994)
    a[dot, :3] = a[dot, :3] * 0.4 + np.array(SHEEN[5]) * 0.6
    strk = surf & ((Y % 7) == 3) & (hash2(X // 4, Y, 92) > 0.86)
    a[strk, :3] = a[strk, :3] * 0.6 + np.array(SHEEN[4]) * 0.4
    im.paste(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA'))

def face_weather(tr, s):
    """옹벽 앞면(밤): 갓돌 밑으로 흘러내린 빗물 얼룩(세로 줄), 아랫단 이끼 덩이, 갓돌 윗모 빛 맺힘. 계단·폭포 칸은 건드리지 않는다."""
    F = s.faces(); sc = s.stair_cells(); fc = {(x + i, y + j) for x, y, w in s.falls for i in range(w) for j in (0, 1, 2)}
    px = tr.load(); Wp, Hp = tr.size
    for cy in range(s.H):
        for cx in range(s.W):
            k = F[cy][cx]
            if not k or (cx, cy) in sc or (cx, cy) in fc: continue
            mas = s.masonry[cy][cx]
            for ly in range(16):
                fy = ly + (k - 1) * 16
                for lx in range(16):
                    X, Y = cx * 16 + lx, cy * 16 + ly
                    q = px[X, Y]
                    if q[3] < 200: continue
                    c = q[:3]
                    if mas and 6 <= fy < 40 and hsh(X, 7) < 0.16 and fy < 6 + 34 * hsh(X, 8):
                        c = mul(c, 0.84)
                    if fy >= 33 and vnoise(X, Y, 3.5, 31) > 0.55 - 0.012 * (fy - 33) and hsh(X, Y, 32) < 0.7:
                        c = mix(c, NMOSS[2 + int(hsh(X, Y, 33) * 3)], 0.7)
                    if mas and fy == 0 and hsh(X, 34) < 0.45: c = mix(c, SHEEN[5], 0.55)
                    px[X, Y] = c + (255,)

def light_pools(img, lights):
    """가로등 불빛 웅덩이: 땅 위 둥근(납작한) 따뜻한 번짐, 4단 계단식(뭉개지지 않게)."""
    a = np.array(img).astype(np.float64); Hp, Wp = a.shape[:2]
    L = np.array(LIT[4], np.float64)
    for (lx, ly, r) in lights:
        x0, x1 = max(0, int(lx - r)), min(Wp, int(lx + r) + 1); y0, y1 = max(0, int(ly - r * 0.6)), min(Hp, int(ly + r * 0.6) + 1)
        Y, X = np.mgrid[y0:y1, x0:x1]
        d = np.hypot((X + 0.5 - lx) / r, (Y + 0.5 - ly) / (r * 0.6))
        f = np.clip(1 - d, 0, 1); f = np.floor(f * 4) / 4 * 0.30
        f = f + (hash2(X, Y, 93) - 0.5) * 0.04 * (f > 0)
        a[y0:y1, x0:x1, :3] = a[y0:y1, x0:x1, :3] * (1 - f[..., None]) + L * f[..., None]
    img.paste(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA'))

class RScene(Scene):
    """bd5.Scene 과 같은 순서로 깔되, 낮 재료 층(땅·자갈·물·옹벽)을 밤비 톤으로 옮긴 뒤 밤 덧칠·물체를 올린다."""
    deck = set()
    def walk_grid(s):
        F = s.faces(); sc = s.stair_cells()
        return [[((not s.block[y][x]) and (not s.water[y][x] or (x, y) in s.deck) and (not F[y][x] or (x, y) in sc)) for x in range(s.W)] for y in range(s.H)]
    def render(s, frame=0):
        W_, H_ = s.W, s.H; Wp, Hp = W_ * 16, H_ * 16
        pav = np.kron(np.array(s.cobble, bool) | np.array(s.flags, bool), np.ones((16, 16), bool))
        img, lab = ground.render(Wp, Hp, s.canopies, pav, s.seed)
        img = night(img)
        img.alpha_composite(paved_layer(s))
        for im, x, y in s.overlays: img.alpha_composite(im, (x, y))
        if any(any(r) for r in s.water):
            wl_ = Image.new('RGBA', (Wp, Hp))
            wl_.alpha_composite(v6pieces.canal6(s.water, s.nat))
            WA = water6.Water(s.water, s.flow, natural=s.nat)
            wl_.alpha_composite(Image.fromarray(WA.frame(frame), 'RGBA'))
            wl_ = night(wl_); water_sheen(wl_, WA, s)
            img.alpha_composite(wl_)
        tr = terrain.render(s.lev, s.masonry, s.stairs, s.falls, frame=0)
        tr = night(tr); face_weather(tr, s)
        img.alpha_composite(tr)
        for im, x, y in s.low_overlays: img.alpha_composite(im, (x, y))
        light_pools(img, s.lights)
        mask = Image.new('L', img.size, 0)
        for sy, x, y, im, sh in s.objs:
            if sh and im.height >= 40: mask.paste(255, (x + 5, y + 3), im.split()[3].point(lambda v: 255 if v > 128 else 0))
        SH = np.array(mask) > 0
        A = np.array(img).astype(np.float64); A[SH, :3] = np.floor(A[SH, :3] * np.array((0.72, 0.74, 0.80))); img = Image.fromarray(A.astype(np.uint8), 'RGBA')
        for sy, x, y, im, sh in sorted(s.objs, key=lambda o: (o[0], o[1])):
            img.alpha_composite(im, (x, y)) if (x >= 0 and y >= 0) else img.alpha_composite(im.crop((max(0, -x), max(0, -y), im.width, im.height)), (max(0, x), max(0, y)))
        for im, x, y in s.top_overlays: img.alpha_composite(im, (x, y))
        s.img = img
        return img

s = RScene('rain-ruin-town', W, H, seed=72)
def G(v=False): return [[v] * W for _ in range(H)]
s.flags = G(); s.low_overlays = []; s.lights = []
s.masonry = [[(4 <= x <= 64) for x in range(W)] for y in range(H)]
terrain.MASONRY_FN = RG.face_day

# ---------------------------------------------------------------- 단 높이(끝줄). 마을 안은 계단·물길·광장 둘레를 곧게, 군데군데 한 줄씩 들고 난다.
RIVER = (46, 47)
def prof(base, jogs):
    out = [base] * W
    for (x0, x1, d) in jogs:
        for x in range(x0, x1 + 1): out[x] = base + d
    return out
e4 = prof(E4, ((0, 7, 0), (8, 11, -1), (54, 62, -1)))
e3 = prof(E3, ((0, 3, -1), (22, 29, -1), (50, 64, -1), (66, 71, -2)))       # 동쪽 둑은 한 줄씩 높다(강 건너 단이 엇갈린다)
e2 = prof(E2, ((0, 3, 1), (4, 9, -1), (50, 64, -1), (65, 71, 0)))
e1 = prof(E1, ((0, 3, -1), (50, 64, -1), (66, 71, -2)))
STAIRS = [(13, e1[13] + 1, 2), (39, e2[39] + 1, 2), (13, e3[13] + 1, 2), (38, E4 + 1, 2), (56, e2[56] + 1, 2), (61, e3[61] + 1, 2)]
for y in range(H):
    for x in range(W):
        top4 = True
        if top4 and y <= e4[x]: s.lev[y][x] = 4
        elif y <= e3[x]: s.lev[y][x] = 3
        elif y <= e2[x]: s.lev[y][x] = 2
        elif y <= e1[x]: s.lev[y][x] = 1
        else: s.lev[y][x] = 0
s.stairs = list(STAIRS)
s.falls = [(46, E4 + 1, 2), (46, E3 + 1, 2), (46, E2 + 1, 2), (46, E1 + 1, 2)]
FACE_ROWS = set()
for e in (E4, E3, E2, E1): FACE_ROWS |= {e + 1, e + 2, e + 3}

# ---------------------------------------------------------------- 물: 강(x46~47) · 항구 물 · 하수구 밑 물 홈
def wat(x, y, f='S'):
    s.water[y][x] = True; s.flow[y][x] = f
for y in range(H):
    if y in FACE_ROWS: continue
    for x in RIVER: wat(x, y)
for y in range(WATER0, H):
    for x in range(W): wat(x, y, 'still')
for y in range(QUAY0, WATER0):
    for x in range(27, 33): wat(x, y, 'still')            # 하수구 밑: 옹벽 바로 아래까지 물
s.nat = G(False)

# ---------------------------------------------------------------- 바닥: 마을 안(x4~64)은 전부 포장 — 길은 젖은 자갈, 광장은 큰 판석. 바깥은 젖은 풀(나무·바위)
F_ = s.faces()
TOWN = lambda x: 4 <= x <= 64
def lv(x, y): return s.lev[y][x]
def rect(g, x0, x1, y0, y1, v=True):
    for y in range(max(0, y0), min(H - 1, y1) + 1):
        for x in range(max(0, x0), min(W - 1, x1) + 1): g[y][x] = v
def walkable_cell(x, y): return not s.water[y][x] and not F_[y][x]
HILL = G()                                                  # 언덕 꼭대기 숲(포장 안 함): L4 극장·시계탑 뒤, 바깥 가장자리
for y in range(H):
    for x in range(W):
        if not walkable_cell(x, y): continue
        if lv(x, y) == 4 and (y <= E4 - 4 or x < 14 or x >= 48): HILL[y][x] = True; continue
        if lv(x, y) == 3 and y <= E4: HILL[y][x] = True; continue
        if not TOWN(x): HILL[y][x] = True; continue
        plaza = (lv(x, y) == 2 and 16 <= x <= 44) or (lv(x, y) == 4 and 14 <= x <= 44)
        (s.flags if plaza else s.cobble)[y][x] = True
for y in range(QUAY0, WATER0):                              # 부두는 바깥까지 이어진다
    for x in range(W):
        if walkable_cell(x, y): s.cobble[y][x] = True; HILL[y][x] = False

# ---------------------------------------------------------------- 점유 / 놓기
s.occ_ = set(); COUNT = {}
def occupy(x0, y0, x1, y1):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1): s.occ_.add((x, y))
def free(x, y):
    if not (0 <= x < W and 0 <= y < H): return False
    return (x, y) not in s.occ_ and not s.water[y][x] and not F_[y][x] and (x, y) not in s.stair_cells()
def put(img, cx, cy, name, block=None, dx=0, dy=0, shadow=None, sorty=None, need=None):
    wc = (img.width + 15) // 16
    cells = need if need is not None else [(i, 0) for i in range(wc)]
    for (i, j) in cells:
        if not free(cx + i, cy + j): return False
    if block is None: block = [(i, 0) for i in range(wc)]
    s.at(img, cx, cy, block=block, dx=dx, dy=dy, shadow=shadow, sorty=sorty)
    for (i, j) in cells: s.occ_.add((cx + i, cy + j))
    COUNT[name] = COUNT.get(name, 0) + 1
    return True
def deco(img, cx, cy, name, dx=0, dy=0):
    """바닥 덧그림(걷기, 물체 아래)."""
    s.low_overlays.append((img, cx * 16 + dx, (cy + 1) * 16 - img.height + dy))
    COUNT[name] = COUNT.get(name, 0) + 1
def wallpiece(img, x, y, name, sorty):
    """벽에 붙이는 조각(벽 등·홈통·간판·담쟁이): 화소 좌표, 막힘 없음, 붙은 건물과 같은 정렬 줄."""
    s.objs.append((sorty, x, y, img, False)); COUNT[name] = COUNT.get(name, 0) + 1
HOUSES = []
def building(img, cx, cy, name, rows=2):
    """건물: 그림 왼쪽 아래 칸 (cx,cy). 아래 rows 줄(벽)만 막히고 그 위(지붕·처마)는 걷기+가림."""
    wc = img.width // 16; hc = (img.height + 15) // 16
    bl = [(i, -j) for i in range(wc) for j in range(rows)]
    s.at(img, cx, cy, block=bl, shadow=False)
    occupy(cx, cy - hc + 1, cx + wc - 1, cy)
    COUNT[name] = COUNT.get(name, 0) + 1
    HOUSES.append((name, cx, cy, wc, hc, img))
    return (cx, cy, wc, hc)
def lamp(cx, cy, kind='post'):
    im = {'post': RP.lamppost_lit(), 'double': RP.lamp_double_lit()}[kind]
    ok = put(im, cx, cy, 'lamppost_lit' if kind == 'post' else 'lamp_double_lit', block=[(0, 0)] if kind == 'post' else [(0, 0), (1, 0)])
    if ok: s.lights.append((cx * 16 + (8 if kind == 'post' else 16), (cy + 1) * 16 - 3, 36 if kind == 'post' else 44))
    return ok
P_ = {}
def p(n):
    if n not in P_: P_[n] = getattr(RP, n)()
    return P_[n]
HB = {}
def hb(key, fn, **k):
    if key not in HB: HB[key] = fn(**k)
    return HB[key]
def flip(im): return im.transpose(Image.FLIP_LEFT_RIGHT)

# 나무(밤 등급 버들항 나무·덤불)
NT = {}
def ntree(kind, look):
    if (kind, look) not in NT: NT[(kind, look)] = night(tree_look(kind, look))
    return NT[(kind, look)]
def tree(kind, cx, cy):
    x, y, w, h = TREES[kind]
    for i in range(w):
        if not free(cx + i, cy) or not HILL[cy][cx + i]: return False
    for j in range(1, h):
        for i in range(w):
            if cy - j >= 0 and (cx + i, cy - j) in s.occ_: return False
    look = int(_hash(cx, cy, 5) * 4)
    im = ntree(kind, look)
    mid = [(cx + w // 2 - 1, cy), (cx + w // 2, cy)] if kind.startswith('oak') and w % 2 == 0 else ([(cx + w // 2, cy)] if kind.startswith('oak') else [(cx + i, cy) for i in range(w)])
    s.sprite(im, cx * 16, (cy + 1) * 16 - im.height, mid, shadow=kind.startswith('oak'))
    for i in range(w): s.occ_.add((cx + i, cy))
    COUNT[kind] = COUNT.get(kind, 0) + 1
    return True

# ======================================================================== L4 언덕 위: 극장 · 시계탑 · 언덕 광장
building(hb('theatre', RB.theatre_ruin), 17, E4 - 3, 'theatre_ruin')
s.marks['theatre_door'] = (21, E4 - 2)
building(hb('clock', RB.clock_tower), 30, E4 - 2, 'clock_tower')
s.marks['clock_tower'] = (31, E4 - 1)
building(hb('ruinL4', RB.ruin_house, seed=33, wc=4), 35, E4 - 3, 'ruin_house')
put(p('rubble_masonry'), 39, E4 - 2, 'rubble_masonry', block=[(0, 0), (1, 0)]) if False else None
building(hb('gableL4', RB.gable_tall, seed=24, wc=3, balcony=False, storeys=2), 40, E4 - 3, 'gable_tall')
put(p('statue_weathered'), 27, E4 - 1, 'statue_weathered', block=[(0, 0), (1, 0)])
lamp(17, E4 - 1); lamp(34, E4 - 1); lamp(43, E4 - 1)
put(p('bench_wet'), 23, E4 - 1, 'bench_wet', block=[(0, 0), (1, 0)])
put(p('column_fallen'), 14, E4 - 2, 'column_fallen', block=[(0, 0), (1, 0)])
put(p('rubble_masonry'), 26, E4 - 2, 'rubble_masonry', block=[(0, 0), (1, 0)])
s.marks['hilltop'] = (29, E4 - 1)
put(p('iron_gate'), 11, E4 - 1, 'iron_gate', block=[(0, 0), (2, 0)], need=[(0, 0), (1, 0), (2, 0)])
s.marks['hill_gate'] = (12, E4 - 1)

# ======================================================================== L3 윗길
def L3b(x): return e3[x] - 3
building(hb('gableL3x', RB.gable_tall, seed=34, wc=4, roof='tim', lit=((1, 2),)), 6, L3b(6), 'gable_tall')
put(p('planter_cypress'), 4, L3b(4), 'planter_cypress', block=[(0, 0)])
put(p('rain_barrel'), 5, L3b(5), 'rain_barrel', block=[(0, 0)])
building(hb('gableL3w', RB.gable_tall, seed=32, wc=3, storeys=2, lit=()), 11, L3b(11), 'gable_tall')
building(hb('shopL3', RB.shop_house, seed=42, wc=4, st='sto'), 15, L3b(15), 'shop_house')
building(hb('gableL3a', RB.gable_tall, seed=22, wc=3, storeys=2, lit=()), 19, L3b(19), 'gable_tall')
building(hb('ruinL3', RB.ruin_house, seed=34, wc=5, st='tim'), 22, L3b(22), 'ruin_house')
building(hb('gableL3b', RB.gable_tall, seed=25, wc=4, storeys=2, balcony=True, roof='tim'), 27, L3b(27), 'gable_tall')
building(hb('shopL3c', RB.shop_house, seed=47, wc=5, lit=()), 31, L3b(31), 'shop_house')
building(hb('shopL3b', RB.shop_house, seed=43, wc=4, st='sto'), 41, L3b(41), 'shop_house')
building(hb('stairL3e', RB.stair_house, seed=14, wc=6, st='sto', lit_idx=((0, 3),)), 49, L3b(49), 'stair_house')
building(hb('gableL3e', RB.gable_tall, seed=27, wc=4, st='sto'), 56, L3b(56), 'gable_tall')
building(hb('ruinL3e', RB.ruin_house, seed=38, wc=4, st='sto'), 61, L3b(61), 'ruin_house')
s.marks['upper_street'] = (25, E3 - 2)

# ======================================================================== L2 서쪽 집 · 가운데 광장 · 동쪽 둑
def L2b(x): return e2[x] - 3
building(hb('shopL2w', RB.shop_house, seed=48, wc=5, lit=()), 4, L2b(4), 'shop_house')
building(hb('gableL2w', RB.gable_tall, seed=21, wc=3, storeys=2, roof='tim'), 9, L2b(9) + 1, 'gable_tall')
building(hb('shopL2', RB.shop_house, seed=44, wc=5), 17, E2 - 4, 'shop_house')
building(hb('ruinL2', RB.ruin_house, seed=35, wc=4), 35, E2 - 4, 'ruin_house')
put(p('fountain_rain'), 27, E2 - 2, 'fountain_rain', block=[(0, 0), (1, 0), (2, 0), (0, -1), (1, -1), (2, -1)], need=[(0, 0), (1, 0), (2, 0), (0, -1), (1, -1), (2, -1)])
s.marks['plaza'] = (30, E2 - 1)
def inlay_ring(cx, cy, r0, r1):
    """광장 판석 무늬: 분수 둘레 밝은 돌 고리(쐐기 줄눈 8px 간격) — 바닥이 그냥 넓은 판이 되지 않게."""
    im = Image.new('RGBA', (W * 16, H * 16)); px = im.load(); NS_ = [N(c) for c in ST]
    for y in range(int(cy - r1 - 1), int(cy + r1 + 2)):
        for x in range(int(cx - r1 - 1), int(cx + r1 + 2)):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            if not (r0 <= d <= r1): continue
            if not s.flags[y // 16][x // 16]: continue
            ang = math.atan2(y + 0.5 - cy, x + 0.5 - cx); arc = ang * d
            c = NS_[5] if (d - r0) < 1.2 else (NS_[4] if (d - r0) < (r1 - r0) - 1 else NS_[2])
            if int((arc + 400) // 9) != int((arc + 400 - 1) // 9): c = NS_[2]
            if (d - r0) < 1.2 and hsh(x, y, 4) < 0.4: c = mix(c, SHEEN[5], 0.5)
            px[x, y] = c + (255,)
    s.low_overlays.append((im, 0, 0))
inlay_ring(27 * 16 + 24, (E2 - 2) * 16 + 14, 38, 44)
put(p('notice_column'), 23, E2 - 3, 'notice_column', block=[(0, 0)])
lamp(21, E2 - 1, 'double'); lamp(34, E2 - 1, 'double')
put(p('bench_wet'), 31, E2 - 4, 'bench_wet', block=[(0, 0), (1, 0)])
put(flip(p('bench_wet')), 24, E2, 'bench_wet', block=[(0, 0), (1, 0)])
put(p('planter_cypress'), 16, E2 - 1, 'planter_cypress', block=[(0, 0)])
put(p('planter_cypress'), 43, E2 - 1, 'planter_cypress', block=[(0, 0)])
put(p('planter_cypress'), 40, E2 - 5, 'planter_cypress', block=[(0, 0)])
put(p('cart_tarp'), 41, E2 - 3, 'cart_tarp', block=[(0, 0), (1, 0)])
deco(p('umbrella_dropped'), 26, E2, 'umbrella_dropped')
building(hb('gableL2e', RB.gable_tall, seed=26, wc=3, st='sto', storeys=2, lit=()), 49, L2b(49), 'gable_tall')
building(hb('shopL2e', RB.shop_house, seed=45, wc=4, lit=((1, 1),)), 52, L2b(52), 'shop_house')
building(hb('ruinL2e', RB.ruin_house, seed=36, wc=3, st='tim'), 57, L2b(57), 'ruin_house')

# ======================================================================== L1 아랫길
def L1b(x): return e1[x] - 3
building(hb('stairL1w', RB.stair_house, seed=16, wc=6, lit_idx=((1, 1),)), 4, L1b(4), 'stair_house')
building(hb('ruinL1w', RB.ruin_house, seed=39, wc=4, st='tim'), 10, L1b(10), 'ruin_house')
building(hb('shopL1', RB.shop_house, seed=46, wc=5, st='sto', roof='tim'), 15, L1b(15), 'shop_house')
building(hb('gableL1', RB.gable_tall, seed=23, wc=4, balcony=True, storeys=2), 20, L1b(20), 'gable_tall')
building(hb('ruinL1', RB.ruin_house, seed=37, wc=5), 24, L1b(24) - 1, 'ruin_house')
building(hb('shopL1c', RB.shop_house, seed=49, wc=4, lit=()), 29, L1b(29), 'shop_house')
building(hb('gableL1b', RB.gable_tall, seed=28, wc=3, storeys=2, lit=((1, 1),)), 34, L1b(34), 'gable_tall')
building(hb('gableL1c', RB.gable_tall, seed=31, wc=4, storeys=2, st='sto', lit=()), 41, L1b(41), 'gable_tall')
building(hb('stairL1e', RB.stair_house, seed=17, wc=6, st='sto', roof='tim'), 49, L1b(49), 'stair_house')
building(hb('gableL1e', RB.gable_tall, seed=29, wc=4), 59, L1b(59), 'gable_tall')
s.marks['lower_street'] = (28, E1 - 1)
s.marks['east_lane'] = (55, e2[55] - 1)

# ======================================================================== L0 부두 · 선착장 · 하수구 · 배
dock = p('dock_planks')
s.at(dock, 3, WATER0 + 2, block=[], shadow=False, sorty=(WATER0 - 1) * 16)
for y in range(WATER0, WATER0 + 3):
    for x in range(3, 6): s.deck.add((x, y))
COUNT['dock_planks'] = 1
s.marks['dock'] = (4, WATER0 + 2)
s.at(p('rowboat'), 7, WATER0 + 1, block=None, shadow=False, sorty=(WATER0 + 1) * 16); COUNT['rowboat'] = 1
s.at(p('sewer_outlet'), 29, E1 + 3, block=None, shadow=False, sorty=(E1 + 1) * 16 + 2); COUNT['sewer_outlet'] = 1
s.marks['sewer'] = (26, QUAY0)
for (x, y) in ((2, QUAY0 + 2), (8, QUAY0 + 2), (22, QUAY0 + 2), (36, QUAY0 + 2), (54, QUAY0 + 2), (67, QUAY0 + 2)):
    put(p('bollard_stone'), x, y, 'bollard_stone', block=[(0, 0)])
put(p('crates_tarp'), 16, QUAY0 + 1, 'crates_tarp', block=[(0, 0), (1, 0)])
put(p('barrels_wet'), 19, QUAY0 + 1, 'barrels_wet', block=[(0, 0), (1, 0)])
put(flip(p('crates_tarp')), 57, QUAY0 + 1, 'crates_tarp', block=[(0, 0), (1, 0)])
put(p('rain_barrel'), 12, QUAY0, 'rain_barrel', block=[(0, 0)])
lamp(10, QUAY0); lamp(25, QUAY0); lamp(41, QUAY0); lamp(61, QUAY0)

# ---------------------------------------------------------------- 다리(강 위 걷는 칸)
def bridge(row, name):
    im = p('arch_footbridge')
    s.at(im, RIVER[0] - 1, row, block=[], dy=30, shadow=False, sorty=(row + 1) * 16 + 4)
    for x in RIVER: s.deck.add((x, row))
    COUNT[name] = COUNT.get(name, 0) + 1
    s.lights.append(((RIVER[0] - 1) * 16 + 4, row * 16 + 10, 26)); s.lights.append(((RIVER[1] + 1) * 16 + 12, row * 16 + 10, 26))
bridge(QUAY0, 'arch_footbridge'); bridge(E1 - 2, 'arch_footbridge'); bridge(E3 - 2, 'arch_footbridge')
s.marks['high_walkway'] = (RIVER[0], E3 - 2)

# ---------------------------------------------------------------- 집 둘레 덧붙임: 벽 등 · 홈통 · 간판 · 빨랫줄 · 꽃상자
for k, (name, cx, cy, wc, hc, img) in enumerate(HOUSES):
    sy = (cy + 1) * 16 + 1
    x0 = cx * 16; ybase = (cy + 1) * 16
    if name == 'shop_house': wallpiece(p('sign_bracket'), x0 + 16 + 12, ybase - 46, 'sign_bracket', sy)
    if k % 3 == 0 and name not in ('theatre_ruin', 'clock_tower'): wallpiece(p('downpipe'), x0 + wc * 16 - 12, ybase - 48, 'downpipe', sy)
    if k % 4 == 1 and name in ('gable_tall', 'ruin_house', 'shop_house'):
        wallpiece(p('lamp_wall'), x0 + wc * 16 - 20, ybase - 34, 'lamp_wall', sy)
        s.lights.append((x0 + wc * 16 - 10, ybase + 6, 26))
# 빨랫줄: 이웃 두 집 사이 골목(틈 1~3칸) 위층에 건다
PAIRS = []
HS = sorted([(cy, cx, wc, name) for (name, cx, cy, wc, hc, img) in HOUSES])
for i in range(len(HS)):
    for j in range(len(HS)):
        a_, b_ = HS[i], HS[j]
        if a_[0] == b_[0] and 1 <= b_[1] - (a_[1] + a_[2]) <= 3: PAIRS.append((a_, b_))
for (a_, b_) in PAIRS:
    gap0 = (a_[1] + a_[2]) * 16 - 8; ybase = (a_[0] + 1) * 16
    wallpiece(p('laundry_line'), gap0, ybase - 92, 'laundry_line', ybase + 2)
s.lights.sort()

# ---------------------------------------------------------------- 쇠 난간(위층 오토타일): 광장·윗길·아랫길 끝줄(계단·다리 칸 비움)
RAIL = G()
SC = s.stair_cells()
def rail_run(y, x0, x1, gaps=()):
    for x in range(x0, x1 + 1):
        if x in gaps or (x, y) in s.occ_ or (x, y + 1) in SC or s.water[y][x] or F_[y][x] or (x, y) in s.deck: continue
        RAIL[y][x] = True
rail_run(E4, 15, 44, gaps=(38, 39))
rail_run(E2, 16, 44, gaps=(39, 40))
for x0, x1 in ((4, 12), (16, 37), (48, 60)):
    for x in range(x0, x1 + 1):
        if (x, e3[x] + 1) not in SC and not RAIL[e3[x]][x]: RAIL[e3[x]][x] = True
for x0, x1 in ((4, 11), (17, 26), (34, 44), (49, 64)):
    for x in range(x0, x1 + 1):
        if (x, e1[x] + 1) not in SC: RAIL[e1[x]][x] = True
for y in range(H):
    for x in range(W):
        if RAIL[y][x] and ((x, y) in s.occ_ or s.water[y][x] or (x, y) in s.deck or F_[y][x]): RAIL[y][x] = False

# ---------------------------------------------------------------- 웅덩이·배수로 마스크(포장 위, 걷기)
PUDL = G(); GUT = G()
def blob(cx, cy, n, seed):
    """웅덩이 덩이: 동서로 길쭉하게(낮은 곳을 따라 고인 물), 3칸 이상이면 가운데 줄 아래위로 한 칸씩만."""
    r = random.Random(seed); w = max(1, (n + 1) // 2 + 1)
    cells = [(cx + i, cy) for i in range(w)]
    if n >= 4: cells += [(cx + 1 + i, cy + (1 if r.random() < 0.5 else -1)) for i in range(max(1, w - 2))]
    for (x, y) in cells:
        if 0 <= x < W and 0 <= y < H and (s.cobble[y][x] or s.flags[y][x]) and (x, y) not in SC and (x, y) not in s.occ_ and not RAIL[y][x]:
            PUDL[y][x] = True
for (cx, cy, n, sd) in ((22, E2 - 1, 4, 1), (37, E2 - 2, 3, 2), (30, E2 - 6, 2, 3), (18, E1 - 1, 3, 4), (33, E1 - 1, 4, 5), (44, E1 - 1, 2, 6),
                        (8, E3 - 1, 3, 7), (34, E3 - 1, 3, 8), (53, E3 - 1, 2, 9), (20, E4 - 1, 3, 10), (40, E4 - 1, 2, 11),
                        (31, QUAY0 - 0, 2, 12), (50, QUAY0 + 1, 3, 13), (14, QUAY0 + 1, 2, 14), (58, E2 - 1, 3, 15), (8, E2 - 1, 2, 16)):
    blob(cx, cy, n, sd)
for x in range(16, 38):                                      # 아랫길 집 앞 배수로(처마 낙수 줄)
    y = e1[x] - 2
    if s.cobble[y][x] and (x, y) not in SC and (x, y) not in s.occ_: GUT[y][x] = True
for x in range(5, 13):
    y = e3[x] - 2
    if s.cobble[y][x] and (x, y) not in s.occ_: GUT[y][x] = True
for y in range(H):
    for x in range(W):
        if GUT[y][x]: PUDL[y][x] = False
def nb4(mask, x, y):
    def on(xx, yy): return 0 <= xx < W and 0 <= yy < H and mask[yy][xx]
    return (1 if on(x, y - 1) else 0) | (2 if on(x + 1, y) else 0) | (4 if on(x, y + 1) else 0) | (8 if on(x - 1, y) else 0)
SHEET = {'puddle': RG.autotile_puddle(), 'gutter': RG.autotile_gutter(), 'rail': RG.autotile_ironrail()}
def cell_of(sh, n): return sh.crop(((n % 4) * 16, (n // 4) * 16, (n % 4) * 16 + 16, (n // 4) * 16 + 16))
lay = Image.new('RGBA', (W * 16, H * 16))
for y in range(H):
    for x in range(W):
        if PUDL[y][x]: lay.alpha_composite(cell_of(SHEET['puddle'], nb4(PUDL, x, y)), (x * 16, y * 16))
        if GUT[y][x]: lay.alpha_composite(cell_of(SHEET['gutter'], nb4(GUT, x, y)), (x * 16, y * 16))
s.low_overlays.insert(0, (lay, 0, 0))
for x in (38, 4, 13):                                         # 배수로 끝 배수구
    pass
deco(p('drain_grate'), 38, e1[38] - 2, 'drain_grate'); deco(p('drain_grate'), 13, e3[13] - 2, 'drain_grate')
deco(p('drain_grate'), 29, E2 - 1, 'drain_grate'); deco(p('drain_grate'), 52, E1 - 1, 'drain_grate')
for y in range(H):
    for x in range(W):
        if RAIL[y][x]:
            s.sprite(cell_of(SHEET['rail'], nb4(RAIL, x, y)), x * 16, y * 16, [(x, y)], shadow=False, sorty=y * 16 + 16)
            s.occ_.add((x, y))
# 등불 비친 웅덩이: 가로등 바로 아래 길에
for (lx, ly, r) in list(s.lights):
    cx, cy = int(lx // 16), int(ly // 16) + 1
    if r >= 36 and 0 <= cy < H and cx + 1 < W and all((s.cobble[cy][cx + i] or s.flags[cy][cx + i]) and (cx + i, cy) not in s.occ_ and not PUDL[cy][cx + i] for i in (0, 1)) and _hash(cx, cy, 3) < 0.6:
        deco(p('puddle_lamp'), cx, cy, 'puddle_lamp', dx=-8)

# ---------------------------------------------------------------- 바닥 덧그림: 낙엽 · 슬레이트 조각 · 이끼 틈 · 작은 웅덩이 · 잡동사니
DEC = [('leaves_wet', 0.5), ('slates_fallen', 0.6), ('moss_stones', 0.7), ('puddle_small', 0.6)]
r_ = random.Random(91)
cand = [(x, y) for y in range(H) for x in range(W) if (s.cobble[y][x] or s.flags[y][x]) and (x, y) not in s.occ_ and not PUDL[y][x] and not GUT[y][x] and (x, y) not in SC]
r_.shuffle(cand)
placed = set()
for (x, y) in cand[:110]:
    if any((x + i, y + j) in placed for i in (-1, 0, 1) for j in (-1, 0, 1)): continue
    nearwall = any((x + i, y - 1) in s.occ_ for i in (-1, 0, 1)) or F_[max(0, y - 1)][x]
    k = r_.random()
    if nearwall and k < 0.45: n = 'moss_stones' if r_.random() < 0.5 else 'leaves_wet'
    elif any(HS_[1] <= x < HS_[1] + HS_[2] and HS_[0] + 1 == y for HS_ in HS) and k < 0.6: n = 'slates_fallen'
    elif k < 0.2: n = 'puddle_small'
    elif k < 0.35: n = 'leaves_wet'
    else: continue
    deco(p(n), x, y, n); placed.add((x, y))
# 거리 잡동사니(덩이로): 상자·통·빗물통·벽 담쟁이
for (x, y, n, bl) in ((10, E1 - 1, 'rain_barrel', [(0, 0)]), (37, E1 - 1, 'barrels_wet', [(0, 0), (1, 0)]), (46 + 3, E1 - 0, 'rain_barrel', [(0, 0)]),
                      (11, E3 - 1, 'crates_tarp', [(0, 0), (1, 0)]), (39, E3 - 1, 'rain_barrel', [(0, 0)]), (55, E3 - 1, 'barrels_wet', [(0, 0), (1, 0)]),
                      (13, E2 - 1, 'rain_barrel', [(0, 0)]), (62, E2 - 1, 'crates_tarp', [(0, 0), (1, 0)]), (44, E1 - 1, 'bench_wet', [(0, 0), (1, 0)])):
    put(p(n), x, y, n, block=bl)
lamp(37, E1 - 1); lamp(7, E2 - 0); lamp(52, E3 - 1); lamp(9, E3 - 1); lamp(58, E1 - 1); lamp(18, E3 - 1)
s.lights.sort()
for (x, y) in ((13, E3 + 1), (58, E2 + 1), (66, E1 + 1), (33, E1 + 1), (23, E3 + 1)):     # 옹벽 앞면 담쟁이
    if F_[y][x] and (x, y) not in SC: wallpiece(p('ivy_wall'), x * 16 - 8, y * 16, 'ivy_wall', (y + 3) * 16)

def empty_cells():
    """빈 바닥: 물체 덮임 0.2 미만이고 길·광장·물·옹벽·계단·난간·나무 아닌 칸(포장된 길·광장은 목적 있는 바닥이라 빈칸이 아니다)."""
    cov = s.coverage(); F = s.faces(); sc = s.stair_cells(); e = np.zeros((H, W), bool)
    for y in range(H):
        for x in range(W):
            e[y, x] = not (cov[y, x] >= 0.2 or s.cobble[y][x] or s.flags[y][x] or s.water[y][x] or F[y][x] or (x, y) in sc or RAIL[y][x] or (x, y) in s.occ_)
    return e
def worst_window(e):
    best = (0, 0, 0)
    for y in range(0, H - 15 + 1):
        for x in range(0, W - 20 + 1):
            r = e[y:y + 15, x:x + 20].mean()
            if r > best[0]: best = (r, x, y)
    return best

# ---------------------------------------------------------------- 언덕 숲 · 바깥 가장자리(밤 나무·덤불·바위)
def cluster(cx, cy, rx, ry, n, kinds, tries=16):
    k = 0
    for _ in range(n * tries):
        if k >= n: break
        a = rng.random() * 6.2832; d = math.sqrt(rng.random())
        x = int(round(cx + math.cos(a) * rx * d)); y = int(round(cy + math.sin(a) * ry * d))
        if 0 <= x < W and 2 <= y < H and tree(rng.choice(kinds), x, y): k += 1
    return k
for (cx, cy, rx, ry, n, ks) in ((4, 6, 4, 6, 6, ('oakA', 'oakB', 'bushD')), (12, 5, 4, 3, 4, ('oakB', 'bushC', 'bushD')), (52, 5, 6, 4, 6, ('oakA', 'oakB', 'bushC')),
                                (60, 7, 3, 3, 3, ('oakB', 'bushD')), (68, 6, 3, 6, 5, ('oakA', 'oakB', 'bushD')), (27, 3, 2, 2, 2, ('bushC', 'bushE')),
                                (1, 20, 2, 3, 2, ('bushC', 'bushD')), (69, 20, 2, 3, 3, ('oakB', 'bushC')), (1, 31, 2, 2, 2, ('bushC',)), (69, 31, 2, 2, 3, ('oakB', 'bushD', 'bushC')),
                                (1, 42, 2, 2, 2, ('bushC', 'bushE')), (69, 42, 2, 2, 3, ('bushD', 'bushC')), (37, 4, 3, 2, 2, ('bushC', 'bushE')), (44, 4, 2, 3, 2, ('oakB', 'bushC')),
                                (56, 10, 5, 2, 4, ('bushC', 'bushD', 'oakB')), (50, 9, 2, 2, 2, ('bushC', 'bushE')), (62, 3, 4, 3, 4, ('oakA', 'oakB', 'bushD')), (8, 10, 3, 2, 3, ('bushC', 'bushD'))):
    cluster(cx, cy, rx, ry, n, ks)
# 언덕 숲 빈 풀밭 메우기: 가장 빈 창부터 덤불·나무 덩이(나무 줄기 칸만 막힘)
for it in range(60):
    e = empty_cells(); r, wx, wy = worst_window(e)
    if r <= 0.36: break
    best = None
    for y in range(wy + 2, wy + 13):
        for x in range(wx + 2, wx + 18):
            if e[y, x] and HILL[y][x]:
                sc_ = e[max(0, y - 2):y + 3, max(0, x - 2):x + 3].sum()
                if best is None or sc_ > best[0]: best = (sc_, x, y)
    if best is None: break
    if cluster(best[1], best[2], 2.5, 1.8, 2, ('bushC', 'bushD', 'oakB', 'bushE')) == 0: s.occ_.add((best[1], best[2]))

# ---------------------------------------------------------------- 통행 · 저장
import wl
def run():
    im = s.render()
    reach = s.bfs(s.marks['dock'])
    res = {k: (v in reach) for k, v in s.marks.items()}
    e = empty_cells(); w = worst_window(e)
    return im, res, (float(w[0]), (w[1], w[2]), float(e.mean()))

def part_img(n):
    if n.startswith('autotile-'): return SHEET[{'autotile-puddle': 'puddle', 'autotile-gutter': 'gutter', 'autotile-ironrail': 'rail'}[n]], False
    if n.startswith('ground-'): return RG.tex(n[7:]), False
    if n == 'face_mossy_retaining': return RG.face_sample(), False
    if n == 'stair_house': return RB.stair_house(), True
    if n == 'gable_tall': return RB.gable_tall(), True
    if n == 'gable_low': return RB.gable_tall(seed=23, wc=4, storeys=2, lit=((1, 1),)), True
    if n == 'ruin_house': return RB.ruin_house(), True
    if n == 'shop_house': return RB.shop_house(), True
    if n == 'clock_tower': return HB['clock'], True
    if n == 'theatre_ruin': return HB['theatre'], True
    return p(n), True

def export(im, res, dens):
    Pq = wl.Parts(RR)
    for n, md in META.items():
        img, pad = part_img(n)
        Pq.add(n, img, md['kind'], md['ko'], md['desc'], md['rules'], md.get('brows'), md.get('layer'), md.get('role'), pad=pad)
    cnt = Pq.finish('비 내리는 수직 폐허 도시 (rain-ruin-town)')
    im.convert('RGB').save(RR + '/render-1x.png')
    im.convert('RGB').resize((im.width * 2, im.height * 2), Image.NEAREST).save(RR + '/render-2x.png')
    wg = s.walk_grid()
    json.dump({'w': W, 'h': H, 'tile': 16, 'rows': [''.join('.' if wg[y][x] else '#' for x in range(W)) for y in range(H)], 'legend': {'.': 'walkable', '#': 'blocked'},
               'levels': [''.join(str(s.lev[y][x]) for x in range(W)) for y in range(H)], 'stairs': [list(t) for t in s.stairs], 'falls': [list(t) for t in s.falls],
               'marks': {k: list(v) for k, v in s.marks.items()}, 'reach_from_dock': res, 'empty_window': [dens[0], list(dens[1])], 'empty_total': dens[2], 'count': COUNT},
              open(RR + '/grid.json', 'w'), ensure_ascii=False)
    return cnt

if __name__ == '__main__':
    im, res, dens = run()
    print(im.size, 'reach all', all(res.values()), {k: v for k, v in res.items() if not v}, 'density', dens)
    print(COUNT)
    if '--no-export' not in sys.argv: print('parts', export(im, res, dens))
    elif os.path.isdir(RR + '/_look'): im.convert('RGB').save(RR + '/_look/map.png')

def door_report():
    """집마다 문 칸(1층 문 열) 바로 앞 칸이 선착장에서 걸어서 닿는지 — QA 기록용."""
    reach = s.bfs(s.marks['dock']); out = []
    for (name, cx, cy, wc, hc, img) in HOUSES:
        ok = any((cx + i, cy + 1) in reach for i in range(wc))
        out.append((name, cx, cy, ok))
    return out
if __name__ == '__main__' and '--doors' in sys.argv:
    for r in door_report(): print(r)
