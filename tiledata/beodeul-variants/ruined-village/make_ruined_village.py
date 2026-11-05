# 폐허 마을·유령 마을 (ruined-village) — 64x48 야외. 다시 돌리면 같은 그림.   python3 make_ruined_village.py
# 버들항 파이프라인(_lib-5/bd5.Scene = city_v6 잔디·그림자·나무)으로 깔고, 새 조각은 rv_build / rv_props / rv_ground.
# 동선: 남쪽 무너진 문기둥(마을 어귀) → 잡초 먹은 흙길 → 마른 우물 광장 → 불탄 교회 → 뒤편 묘지 → 지하 묘소 입구.
import os, sys, json, math, random
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from rv_base import *
from rv_base import _hash
import rv_build as RB, rv_props as RP, rv_ground as RG
import plains_ruin as PR
import plains_pieces as PP                 # 초원 하이로드 소품(돌무더기·풀) — 지도에만 쓰고 다시 내보내지 않는다
from scipy import ndimage as ndi
from rv_meta import META

W, H = 64, 48
rng = random.Random(6401)
s = Scene('ruined-village', W, H, seed=64)

def grid(v=False): return [[v] * W for _ in range(H)]
DIRT, PAVE, FENCE, DRY, ASHG, FIELD = grid(), grid(), grid(), grid(), grid(), grid()
def rect(g, x0, x1, y0, y1, v=True):
    for y in range(max(0, y0), min(H - 1, y1) + 1):
        for x in range(max(0, x0), min(W - 1, x1) + 1): g[y][x] = v
def ell(g, cx, cy, rx, ry, seed, jag=0.25):
    for y in range(H):
        for x in range(W):
            d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2
            if d < 1 + (vnoise(x, y, 2.5, seed) - 0.5) * jag * 2: g[y][x] = True

# ---------------------------------------------------------------- 길·광장
# 광장(금 간 포석): 우물 둘레 들쭉날쭉한 타원. 동쪽·남서쪽 가장자리는 풀이 먹었다
ell(PAVE, 31.0, 26.0, 9.6, 5.4, 11, 0.22)
for y in range(H):
    for x in range(W):
        if PAVE[y][x] and ((x >= 39 and y >= 29) or (x <= 22 and y >= 29) or (x <= 21 and y <= 22)): PAVE[y][x] = False
rect(PAVE, 31, 33, 17, 21)                         # 교회 문 앞 포석 길
for (x0, x1, y0, y1) in ((24, 25, 24, 25), (36, 37, 26, 26), (33, 34, 30, 30), (27, 27, 28, 29), (38, 39, 23, 23)):   # 포석을 뚫고 올라온 풀 섬
    rect(PAVE, x0, x1, y0, y1, False)
# 흙길: 남쪽 어귀 → 광장 (폭 3, 살짝 굽음)
for y in range(31, H):
    x0 = 30 if y >= 38 else 29
    for x in range(x0, x0 + 3): DIRT[y][x] = True
for y in (37, 38): DIRT[y][29] = True; DIRT[y][32] = True
# 집 앞 샛길
rect(DIRT, 12, 22, 24, 25)                         # 서쪽 반목조 폐가 → 광장
rect(DIRT, 18, 18, 31, 32); rect(DIRT, 18, 22, 31, 31)
rect(DIRT, 4, 17, 32, 33)                          # 창백한 불탄 집 → 박공 폐가 앞
rect(DIRT, 40, 47, 23, 24)                         # 광장 동쪽 → 불탄 돌집
rect(DIRT, 39, 53, 31, 32)                         # 광장 남동 → 돌벽 폐가
rect(DIRT, 43, 43, 33, 39); rect(DIRT, 33, 43, 36, 37)
rect(DIRT, 9, 9, 33, 42)                           # 남서 통나무집
rect(DIRT, 52, 55, 33, 37)                         # 남동 버려진 밭 입구
# 교회 동쪽으로 돌아 묘지로: 광장 북동 → 북쪽 → 동쪽
rect(DIRT, 38, 39, 9, 21)
rect(DIRT, 39, 55, 8, 9)
rect(DIRT, 55, 56, 8, 8)
for y in range(H):
    for x in range(W):
        if PAVE[y][x]: DIRT[y][x] = False
ROAD = [[DIRT[y][x] or PAVE[y][x] for x in range(W)] for y in range(H)]

# ---------------------------------------------------------------- 땅 조각 마스크(마른 풀·재·밭)
for (cx, cy, rx, ry, sd) in ((12, 10, 10, 6, 21), (50, 40, 11, 6, 22), (8, 37, 7, 6, 23), (47, 16, 8, 4, 24), (24, 40, 6, 4, 25), (58, 22, 5, 7, 26), (30, 5, 8, 3, 27)):
    ell(DRY, cx, cy, rx, ry, sd, 0.3)
for (cx, cy, rx, ry, sd) in ((47, 21.4, 4.0, 2.0, 31), (5, 30.6, 3.2, 1.8, 32), (27.6, 18.4, 3.4, 1.3, 33), (35.4, 18.6, 2.4, 1.1, 34)):
    ell(ASHG, cx, cy, rx, ry, sd, 0.5)
ell(FIELD, 57.5, 41.2, 4.6, 3.6, 28, 0.2)

def ground_patch(mask, img, seed, edge='dirt', tuft=True):
    Wp, Hp = W * 16, H * 16
    m0 = np.kron(np.array(mask, bool), np.ones((16, 16), bool))
    Y, X = np.mgrid[0:Hp, 0:Wp]
    dx = np.rint((wl.tnoise(Wp, Hp, 8, seed) - 0.5) * 7 + (wl.tnoise(Wp, Hp, 4, seed + 1) - 0.5) * 3).astype(int)
    dy = np.rint((wl.tnoise(Wp, Hp, 8, seed + 2) - 0.5) * 7 + (wl.tnoise(Wp, Hp, 4, seed + 3) - 0.5) * 3).astype(int)
    m = m0[np.clip(Y + dy, 0, Hp - 1), np.clip(X + dx, 0, Wp - 1)]
    tex = np.array(img.convert('RGB'))
    rgb = tex[Y % 48, X % 48].astype(np.uint8)
    out = np.dstack([rgb, np.where(m, 255, 0).astype(np.uint8)])
    inner2 = ndi.binary_erosion(m, iterations=2, border_value=1)
    band = m & ~inner2 & (hash2(X, Y, seed + 21) > 0.5)                  # 가장자리 2화소: 반은 비워 잔디와 섞인다
    out[band, 3] = 0
    if edge == 'dirt':
        inner = ndi.binary_erosion(m, iterations=1, border_value=1)
        e1 = m & ~inner; out[e1, :3] = np.array(PAL_E1)
    if tuft:
        near = ndi.binary_dilation(m, iterations=2) & ~m
        t = near & (hash2(X, Y, seed + 9) > 0.80)
        tc = np.array(LAWN)[(hash2(X, Y, seed + 10) * 6).astype(int).clip(0, 5)]
        out[t, :3] = tc[t]; out[t, 3] = 255
    return Image.fromarray(out.astype(np.uint8), 'RGBA')
PAL_E1 = hx('#4c3b30')

# ---------------------------------------------------------------- 오토타일 덮기
SHEETS = {'dirt': RG.autotile_weedydirt(), 'pave': RG.autotile_crackedpave(), 'fence': RG.autotile_brokenfence()}
def cell_of(sheet, n): return sheet.crop(((n % 4) * 16, (n // 4) * 16, (n % 4) * 16 + 16, (n // 4) * 16 + 16))
def nbits(mask, x, y, join=None):
    def on(xx, yy): return 0 <= xx < W and 0 <= yy < H and (mask[yy][xx] or (join is not None and join[yy][xx]))
    return (1 if on(x, y - 1) else 0) | (2 if on(x + 1, y) else 0) | (4 if on(x, y + 1) else 0) | (8 if on(x - 1, y) else 0)

# ---------------------------------------------------------------- 점유 / 놓기
s.occ_ = set()
COUNT = {}
def occupy(x0, y0, x1, y1):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1): s.occ_.add((x, y))
def terrain_ok(x, y, allow_road=False):
    if not (0 <= x < W and 0 <= y < H): return False
    if (x, y) in s.occ_ or FENCE[y][x]: return False
    if not allow_road and (ROAD[y][x] or FIELD[y][x]): return False
    return True
def near_road(x, y, r=1):
    for j in range(-r, r + 1):
        for i in range(-r, r + 1):
            xx, yy = x + i, y + j
            if 0 <= xx < W and 0 <= yy < H and ROAD[yy][xx]: return True
    return False
def put(img, cx, cy, name, block=None, canopy_rows=0, base_w=None, margin=0, allow_road=False, shadow=None, dx=0, dy=0, sorty=None):
    wc = (img.width + 15) // 16; hc = (img.height + 15) // 16; bw = base_w or wc
    if cx < 0 or cx + wc > W or cy - hc + 1 < 0 or cy >= H: return False
    for i in range(bw):
        if not terrain_ok(cx + i, cy, allow_road): return False
        if margin and near_road(cx + i, cy, margin): return False
    for j in range(1, min(canopy_rows, hc)):
        for i in range(wc):
            if ROAD[cy - j][cx + i] or (cx + i, cy - j) in s.occ_: return False
    if block is None: block = [(i, 0) for i in range(bw)]
    s.at(img, cx, cy, block=block, dx=dx, dy=dy, shadow=shadow, sorty=sorty)
    occupy(cx, cy - max(0, canopy_rows - 1), cx + bw - 1, cy)
    COUNT[name] = COUNT.get(name, 0) + 1
    return True
def deco(img, cx, cy, name, dx=0, dy=0, allow_road=False):
    wc = (img.width + 15) // 16
    for i in range(wc):
        if not terrain_ok(cx + i, cy, allow_road): return False
    s.at(img, cx, cy, block=None, dx=dx, dy=dy, shadow=False)
    COUNT[name] = COUNT.get(name, 0) + 1
    return True
def building(img, cx, cy, name, rows, extra_block=(), free=()):
    """건물: 그림 왼쪽 아래 칸 (cx,cy). 아래 rows 줄(벽)이 막히고 그 위(지붕·뒷벽)는 걷기+가림."""
    wc = img.width // 16; hc = (img.height + 15) // 16
    bl = [(i, -j) for i in range(wc) for j in range(rows) if (i, -j) not in free] + list(extra_block)
    s.at(img, cx, cy, block=bl, shadow=True)
    occupy(cx, cy - hc + 1, cx + wc - 1, cy)
    COUNT[name] = COUNT.get(name, 0) + 1

B = {n: getattr(RB, n)() for n in RB.BUILDINGS}
G = {}
def g(n):
    if n not in G: G[n] = getattr(RP, n)() if hasattr(RP, n) else getattr(RG, n)()
    return G[n]

# ---------------------------------------------------------------- 앵커 1: 불탄 교회 + 떨어진 종 (북쪽 가운데)
CX, CY = 26, 16
building(B['church_ruin'], CX, CY, 'church_ruin', 3)
s.marks['church_door'] = (32, 17)
RUB_S, RUB_H = PR.rubble_small(), PR.rubble_heap()
s.at(g('rubble_church'), 34, 17, block=[(0, 0), (1, 0), (2, 0)], dy=-7, shadow=False, sorty=17 * 16 + 4); occupy(34, 16, 36, 17); COUNT['rubble_church'] = 1   # 무너진 박공 어깨 밑 잔해
put(g('bell_fallen'), 23, 18, 'bell_fallen', block=[(0, 0), (1, 0)])
put(g('beams_charred'), 37, 18, 'beams_charred', block=[(0, 0), (1, 0)], allow_road=False)
deco(g('tile_debris'), 28, 17, 'tile_debris')
deco(g('ash_scatter'), 30, 18, 'ash_scatter'); deco(g('ash_scatter'), 34, 18, 'ash_scatter', dx=4)

# ---------------------------------------------------------------- 앵커 2: 마른 우물 광장 + 넘어진 시장
put(g('well_dry'), 30, 26, 'well_dry', block=[(0, 0), (1, 0)], allow_road=True)
s.marks['well'] = (30, 27)
deco(g('bucket_tipped'), 32, 27, 'bucket_tipped', allow_road=True, dx=2)
put(g('stall_tattered'), 35, 24, 'stall_tattered', block=[(0, 0), (1, 0), (2, 0)], allow_road=True)
put(g('stall_collapsed'), 35, 30, 'stall_collapsed', block=[(0, 0), (1, 0), (2, 0)], allow_road=True)
put(g('crate_broken'), 38, 26, 'crate_broken', allow_road=True)
put(g('barrel_tipped'), 37, 27, 'barrel_tipped', block=[(0, 0), (1, 0)], allow_road=True)
put(g('barrel_broken'), 34, 25, 'barrel_broken', allow_road=True)
deco(g('sack_torn'), 38, 28, 'sack_torn', allow_road=True)
put(g('cart_overturned'), 22, 28, 'cart_overturned', block=[(0, 0), (1, 0), (2, 0)], allow_road=True)
deco(g('sack_torn'), 21, 27, 'sack_torn', allow_road=True)
put(g('notice_torn'), 25, 22, 'notice_torn', block=[(0, 0), (1, 0)], allow_road=True)
put(g('lamppost_bent'), 27, 30, 'lamppost_bent', block=[(0, 0)], allow_road=True)
put(g('lamppost_bent'), 36, 21, 'lamppost_bent', block=[(0, 0)], allow_road=True, dx=4)
put(g('bench_broken'), 26, 26, 'bench_broken', block=[(0, 0), (1, 0)], allow_road=True)
s.marks['plaza'] = (31, 28)

# ---------------------------------------------------------------- 앵커 3: 폐가들(광장 둘레)
building(B['ruin_house_a'], 9, 23, 'ruin_house_a', 2); s.marks['house_a'] = (12, 24)
building(B['gable_ruin_a'], 16, 30, 'gable_ruin_a', 2); s.marks['house_b'] = (18, 31)
building(B['burnt_house_pale'], 3, 31, 'burnt_house_pale', 2); s.marks['burnt_pale'] = (4, 32)
building(B['burnt_house'], 45, 22, 'burnt_house', 2); s.marks['burnt'] = (47, 23)
building(B['ruin_house_b'], 51, 30, 'ruin_house_b', 2); s.marks['house_c'] = (53, 31)
building(B['gable_ruin_log'], 7, 41, 'gable_ruin_log', 2); s.marks['house_log'] = (8, 42)
building(B['gable_ruin_stone'], 42, 38, 'gable_ruin_stone', 2); s.marks['house_d'] = (44, 39)
# 집 둘레 잔해
deco(g('tile_debris'), 15, 23, 'tile_debris'); deco(g('tile_debris'), 50, 31, 'tile_debris', dy=-2)
put(g('beams_charred'), 50, 22, 'beams_charred', block=[(0, 0), (1, 0)])
deco(g('ash_scatter'), 44, 21, 'ash_scatter'); deco(g('ash_scatter'), 2, 32, 'ash_scatter')
put(g('stump_burnt'), 7, 30, 'stump_burnt')
put(g('crate_broken'), 15, 22, 'crate_broken')
put(g('barrel_broken'), 20, 29, 'barrel_broken')
put(g('crows_ground'), 24, 31, 'crows_ground', block=[]) if False else deco(g('crows_ground'), 23, 31, 'crows_ground')
deco(g('crows_ground'), 40, 27, 'crows_ground', allow_road=True)

# ---------------------------------------------------------------- 앵커 4: 남쪽 마을 어귀(무너진 문기둥) + 끊긴 울타리
building_y = 44
s.at(g('gate_post_ruin'), 29, building_y, block=[(0, 0), (4, 0)], shadow=False)
occupy(29, building_y - 2, 29, building_y); occupy(33, building_y - 1, 33, building_y); COUNT['gate_post_ruin'] = 1
s.marks['south_gate'] = (31, H - 1)
for x in list(range(2, 28)) + list(range(35, 50)):
    FENCE[44][x] = True
for x in (6, 7, 8, 15, 16, 22, 40, 41, 46):                        # 끊긴 자리(빠진 칸)
    FENCE[44][x] = False
for y in range(36, 44): FENCE[y][2] = True
for x in range(52, 63): FENCE[37][x] = True                       # 버려진 밭 울타리(위·오른쪽, 끊긴 자리 둠)
for y in range(37, 46): FENCE[y][62] = True
for (x, y) in ((58, 37), (59, 37), (62, 41)): FENCE[y][x] = False
FENCE[36][3] = True; FENCE[36][4] = True
for y in range(H):
    for x in range(W):
        if ROAD[y][x]: FENCE[y][x] = False
for (x, y) in ((6, 45), (15, 46), (40, 45), (58, 36)):
    deco(g('fence_fallen'), x, y, 'fence_fallen')

# ---------------------------------------------------------------- 앵커 5: 남동 버려진 밭 + 누더기 허수아비
put(g('scarecrow_tattered'), 57, 41, 'scarecrow_tattered', block=[(0, 0)], allow_road=True)
put(g('crow_post'), 60, 39, 'crow_post', block=[(0, 0)], allow_road=True)
put(g('crow_post'), 54, 43, 'crow_post', block=[(0, 0)], allow_road=True)
for y in range(38, 46):
    for x in range(52, 63, 2):
        if FIELD[y][x] and FIELD[y][min(W - 1, x + 1)] and (x, y) not in s.occ_ and (x + 1, y) not in s.occ_ and _hash(x, y, 9) > 0.15:
            s.at(g('crops_dead'), x, y, block=None, shadow=False); COUNT['crops_dead'] = COUNT.get('crops_dead', 0) + 1
s.marks['field'] = (56, 40)

# ---------------------------------------------------------------- 앵커 6: 교회 뒤 묘지 + 지하 묘소 입구 (북동)
put(g('crypt_entrance'), 54, 6, 'crypt_entrance', block=[(0, 0), (0, -1), (0, -2), (2, 0), (2, -1), (2, -2), (1, -2)], allow_road=True)
s.marks['crypt'] = (55, 7)
for (x, y) in ((55, 6), (55, 5)): s.occ_.add((x, y))
# 묘지 담(남쪽, 길 틈 38..39 남김): 담 토막은 서로 잇고, 터진 틈·끝은 잔해 더미로 땅까지 묻는다(떠 있는 토막 금지)
s.at(RUB_S, 40, 13, block=[(0, 0), (1, 0)], dx=4, dy=-1, shadow=False, sorty=14 * 16 + 1); occupy(40, 13, 41, 13)
s.at(g('grave_wall_long'), 42, 13, block=[(i, 0) for i in range(6)], shadow=False); occupy(42, 12, 47, 13)
s.at(g('grave_wall_broken'), 48, 13, block=[(0, 0), (1, 0), (3, 0), (4, 0)], shadow=False); occupy(48, 12, 52, 13)
s.at(RUB_S, 49, 13, block=[], dx=8, dy=1, shadow=False, sorty=14 * 16 + 1)
s.at(g('grave_wall_long'), 53, 13, block=[(i, 0) for i in range(6)], shadow=False); occupy(53, 12, 58, 13)
s.at(g('grave_wall_end'), 59, 13, block=[(0, 0), (1, 0)], shadow=False); occupy(59, 12, 61, 13)
s.at(RUB_S, 61, 13, block=[(0, 0), (1, 0)], dx=-6, dy=1, shadow=False, sorty=14 * 16 + 1); occupy(61, 13, 62, 13)
COUNT['grave_wall'] = 4
TOMBS = []
for (y, xs) in ((4, (42, 44, 47, 49, 52, 58, 61)), (6, (41, 45, 48, 51, 59)), (11, (43, 46, 49, 52, 55, 58, 60)), (2, (45, 50, 57))):
    for i, x in enumerate(xs): TOMBS.append((x + (1 if _hash(x, y, 4) > 0.7 else 0), y + (1 if y in (2, 4) and _hash(x, y, 5) > 0.75 else 0)))
for i, (x, y) in enumerate(TOMBS):
    k = ('tomb_cracked', 'cross_crooked', 'tomb_broken')[(i * 7 + x) % 3]
    put(g(k), x, y, k, block=[(0, 0)])
put(g('dead_tree_crooked'), 56, 12, 'dead_tree_crooked', block=[(0, 0)], canopy_rows=3, base_w=1, dx=-8) if False else None
put(g('dead_tree_large'), 46, 7, 'dead_tree_large', block=[(1, 0)], base_w=3, canopy_rows=0)
put(g('dead_tree_crooked'), 59, 7, 'dead_tree_crooked', block=[(0, 0)], base_w=2, canopy_rows=0)
deco(g('crows_ground'), 51, 6, 'crows_ground')
s.marks['graveyard'] = (50, 8)

# ---------------------------------------------------------------- 북서: 마른 과수원(죽은 과일나무 줄이 흐트러졌다)
for (x, y) in ((4, 6), (9, 4), (15, 7), (20, 5), (5, 11), (12, 9), (19, 11), (23, 9)):
    put(g('dead_tree_large') if (x + y) % 3 == 0 else (g('dead_tree_crooked') if (x + y) % 3 == 1 else g('dead_sapling')), x, y,
        'dead_tree', block=[(1, 0)] if (x + y) % 3 == 0 else [(0, 0)], base_w=1, canopy_rows=0)

# ---------------------------------------------------------------- 가장자리 숲(살아 있는 버들항 나무·덤불) + 고목 덩이
def mk_oakA(x, y):
    if x + 4 > W or y - 4 < 0 or not all(terrain_ok(x + i, y) for i in range(4)): return False
    for j in range(1, 5):
        for i in range(4):
            if ROAD[y - j][x + i] or (x + i, y - j) in s.occ_: return False
    s.tree('oakA', x, y); occupy(x, y, x + 3, y); COUNT['oakA'] = COUNT.get('oakA', 0) + 1; return True
def mk_oakB(x, y):
    if x + 3 > W or y - 3 < 0 or not all(terrain_ok(x + i, y) for i in range(3)): return False
    for j in range(1, 4):
        for i in range(3):
            if ROAD[y - j][x + i] or (x + i, y - j) in s.occ_: return False
    s.tree('oakB', x, y); occupy(x, y, x + 2, y); COUNT['oakB'] = COUNT.get('oakB', 0) + 1; return True
def mk_bush(kind, w):
    def f(x, y):
        if x + w > W or not all(terrain_ok(x + i, y) for i in range(w)): return False
        s.tree(kind, x, y); occupy(x, y, x + w - 1, y); COUNT[kind] = COUNT.get(kind, 0) + 1; return True
    return f
B_c, B_d = mk_bush('bushC', 2), mk_bush('bushD', 3)
def mk_dead_big(x, y): return put(g('dead_tree_large'), x, y, 'dead_tree_large', block=[(1, 0)], base_w=3)
def mk_dead_c(x, y): return put(g('dead_tree_crooked'), x, y, 'dead_tree_crooked', block=[(0, 0)], base_w=2)
def mk_sap(x, y): return put(g('dead_sapling'), x, y, 'dead_sapling', block=[(0, 0)])
def mk_dbush(x, y): return put(g('dead_bush'), x, y, 'dead_bush', block=[(0, 0)])
def mk_stumpb(x, y): return put(g('stump_burnt'), x, y, 'stump_burnt', block=[(0, 0)])
def mk_rock(x, y): return put(PP.rockpile(), x, y, 'rockpile', block=[(0, 0), (1, 0)])
def mk_block(x, y): return put(PP.fallen_block(), x, y, 'fallen_block', block=[(0, 0)])
def mk_log(x, y): return put(PP.log_fallen(), x, y, 'log_fallen', block=[(0, 0), (1, 0)])
def cluster(cx, cy, rx, ry_, n, makers, tries=14):
    placed = 0
    for _ in range(n * tries):
        if placed >= n: break
        a = rng.random() * 6.2832; d = math.sqrt(rng.random())
        x = int(round(cx + math.cos(a) * rx * d)); y = int(round(cy + math.sin(a) * ry_ * d))
        if not (0 <= x < W and 3 <= y < H): continue
        if rng.choice(makers)(x, y): placed += 1
    return placed
LIVE = [mk_oakA, mk_oakB, mk_oakB, B_c, B_d]
DEAD = [mk_dead_big, mk_dead_c, mk_sap, mk_dbush]
for (cx, cy, rx, ry_, n, mk) in ((1, 22, 2, 8, 5, LIVE), (62, 26, 2, 8, 5, LIVE), (3, 46, 3, 2, 3, LIVE), (60, 47, 4, 1.5, 3, LIVE), (21, 47, 5, 1.2, 3, LIVE),
                                 (42, 47, 4, 1.2, 3, LIVE), (62, 15, 1.6, 4, 3, LIVE), (1, 3, 3, 2, 3, LIVE), (36, 3, 4, 2, 3, LIVE + DEAD),
                                 (20, 19, 3, 2, 3, DEAD), (42, 18, 2, 2, 2, DEAD), (57, 18, 4, 3, 4, DEAD + LIVE), (24, 36, 3, 2, 3, DEAD),
                                 (37, 41, 3, 2, 3, DEAD), (14, 37, 3, 2, 3, DEAD), (50, 35, 2, 1.5, 2, DEAD), (61, 34, 2, 3, 3, LIVE)):
    cluster(cx, cy, rx, ry_, n, mk)
cluster(12, 18, 6, 2, 4, [mk_rock, mk_block, mk_dbush])
cluster(53, 19, 4, 2, 3, [mk_rock, mk_block, mk_log])
cluster(36, 44, 4, 1.5, 3, [mk_rock, mk_dbush, mk_log])

# ---------------------------------------------------------------- 빈 바닥 채우기(마른 풀·쐐기풀·덤불 덩이)
FILLD = [g('drygrass_a'), g('drygrass_b'), g('nettles'), PP.tallgrass_a(), PP.tallgrass_b()]
DECAL_IDS = set(id(i) for i in FILLD + [g('ash_scatter'), g('tile_debris'), g('crows_ground'), g('sack_torn'), g('fence_fallen'), g('bucket_tipped'), g('ivy_ground'), g('weeds_crack')])
FILL = set(); _ALPHA = {}
def cov_grid():
    cov = np.zeros((H, W))
    for (sy, x, y, im, sh) in s.objs:
        if id(im) in DECAL_IDS: continue
        if id(im) not in _ALPHA: _ALPHA[id(im)] = np.array(im)[:, :, 3] > 128
        a = _ALPHA[id(im)]; h, w = a.shape
        for cy in range(max(0, y // 16), min(H, (y + h - 1) // 16 + 1)):
            for cx in range(max(0, x // 16), min(W, (x + w - 1) // 16 + 1)):
                x0, y0 = max(cx * 16, x), max(cy * 16, y); x1, y1 = min(cx * 16 + 16, x + w), min(cy * 16 + 16, y + h)
                if x1 > x0 and y1 > y0: cov[cy, cx] = max(cov[cy, cx], a[y0 - y:y1 - y, x0 - x:x1 - x].sum() / 256.0)
    return cov
def empty_cells():
    cov = cov_grid(); e = np.zeros((H, W), bool)
    for y in range(H):
        for x in range(W):
            e[y, x] = not (cov[y, x] >= 0.2 or ROAD[y][x] or FENCE[y][x] or FIELD[y][x] or (x, y) in FILL or ((x, y) in s.occ_ and cov[y, x] >= 0.05))
    return e
def worst_window(e, step=1):
    best = (0, 0, 0)
    for y in range(0, H - 15 + 1, step):
        for x in range(0, W - 20 + 1, step):
            r = e[y:y + 15, x:x + 20].mean()
            if r > best[0]: best = (r, x, y)
    return best
def meadow(cx, cy, r):
    n = 0
    for y in range(int(cy - r) - 1, int(cy + r) + 2):
        for x in range(int(cx - r * 1.3) - 1, int(cx + r * 1.3) + 2):
            if not (0 <= x < W and 0 <= y < H): continue
            d = ((x - cx) / (r * 1.3)) ** 2 + ((y - cy) / r) ** 2
            if d > 0.9 + (rng.random() - 0.5) * 0.5: continue
            if not terrain_ok(x, y) or near_road(x, y, 0): continue
            FILL.add((x, y)); n += 1
            if rng.random() < 0.45:
                t = FILLD[rng.choice((0, 0, 1, 2, 3, 0))]
                if t.width > 16 and not terrain_ok(x + 1, y): t = FILLD[0]
                deco(t, x, y, 'fillgrass', dx=rng.randrange(-2, 3), dy=rng.randrange(-1, 2))
    return n
for it in range(160):
    e = empty_cells(); r, wx, wy = worst_window(e, 1)
    if r <= 0.38: print('fill iterations', it, 'worst', round(float(r), 3)); break
    best = None
    for y in range(wy + 2, wy + 13):
        for x in range(wx + 2, wx + 18):
            if e[y, x]:
                sc = e[max(0, y - 2):y + 3, max(0, x - 2):x + 3].sum()
                if best is None or sc > best[0]: best = (sc, x, y)
    if best is None: break
    _, bx_, by_ = best
    pk = rng.random()
    if pk < 0.72: n = meadow(bx_, by_, rng.uniform(1.6, 3.0))
    elif pk < 0.9: n = cluster(bx_, by_, 2.4, 1.6, 2, DEAD + [mk_dbush, mk_stumpb])
    else: n = cluster(bx_, by_, 2.4, 1.6, 2, [mk_rock, mk_block, mk_log])
    if n == 0: s.occ_.add((bx_, by_)); FILL.add((bx_, by_))
DECO_LOW = []
# 광장 포석 틈 잡초·땅 덩굴(걷기)
for (x, y) in ((24, 24), (28, 23), (33, 28), (26, 28), (37, 23), (29, 20), (32, 22), (35, 27), (23, 26), (39, 25)):
    if not ((x, y) in s.occ_): s.at(g('weeds_crack'), x, y, block=None, shadow=False)
for (x, y) in ((25, 25), (34, 23), (28, 29), (37, 29), (32, 20), (24, 27)):
    if not ((x, y) in s.occ_): DECO_LOW.append((g('pave_crack'), x * 16, y * 16))
for (x, y) in ((27, 24), (32, 29), (22, 25), (35, 22)):
    DECO_LOW.append((g('pave_hole'), x * 16, y * 16))
for (x, y) in ((21, 24), (40, 22), (31, 35), (29, 40), (32, 43)):
    if not ((x, y) in s.occ_): s.at(g('ivy_ground'), x, y, block=None, shadow=False)

# ---------------------------------------------------------------- 땅 덮개 → 길 → 울타리 → 안개
s.overlays.append((ground_patch(DRY, RG.tex('drygrass'), 41, edge=None, tuft=False), 0, 0))
s.overlays.append((ground_patch(FIELD, RG.tex('dirt'), 42, edge='dirt'), 0, 0))
s.overlays.append((ground_patch(ASHG, RG.tex('ash'), 43, edge=None, tuft=True), 0, 0))
road_im = Image.new('RGBA', (W * 16, H * 16))
JOIN_PD = [[PAVE[y][x] for x in range(W)] for y in range(H)]
for y in range(H):
    for x in range(W):
        if DIRT[y][x]:
            n = nbits(DIRT, x, y, JOIN_PD)
            if y == H - 1: n |= 4
            road_im.alpha_composite(cell_of(SHEETS['dirt'], n), (x * 16, y * 16))
for y in range(H):
    for x in range(W):
        if PAVE[y][x]: road_im.alpha_composite(cell_of(SHEETS['pave'], nbits(PAVE, x, y)), (x * 16, y * 16))
s.overlays.append((road_im, 0, 0))
s.overlays.extend(DECO_LOW)
for y in range(H):
    for x in range(W):
        if FENCE[y][x]:
            s.sprite(cell_of(SHEETS['fence'], nbits(FENCE, x, y)), x * 16, y * 16, [(x, y)], shadow=False, sorty=y * 16 + 16)
FOG = [(23, 25, 'fog_bank'), (33, 30, 'fog_bank'), (27, 21, 'fog_small'), (44, 9, 'fog_bank'), (52, 12, 'fog_bank'), (57, 5, 'fog_small'),
       (48, 4, 'fog_small'), (8, 12, 'fog_bank'), (18, 9, 'fog_small'), (37, 34, 'fog_small'), (12, 27, 'fog_small'), (55, 25, 'fog_small')]
for (x, y, k) in FOG:
    im = g(k); s.top_overlays.append((im, x * 16, (y + 1) * 16 - im.height))

# ---------------------------------------------------------------- 통행 · 저장
def run():
    im = s.render()
    reach = s.bfs(s.marks['south_gate'])
    res = {k: (v in reach) for k, v in s.marks.items()}
    e = empty_cells(); w = worst_window(e, 1)
    return im, res, (float(w[0]), (w[1], w[2]), float(e.mean()))

PART_SRC = {}
def part_img(n):
    if n.startswith('autotile-'): return {'autotile-weedydirt': SHEETS['dirt'], 'autotile-crackedpave': SHEETS['pave'], 'autotile-brokenfence': SHEETS['fence']}[n], False
    if n.startswith('ground-'): return RG.tex({'ground-drygrass': 'drygrass', 'ground-ash': 'ash', 'ground-crackedflag': 'flag', 'ground-weedydirt': 'dirt'}[n]), False
    if n in B: return B[n], True
    return g(n), True

def export(im, res, dens):
    Pq = wl.Parts(HERE)
    for n, md in META.items():
        img, pad = part_img(n)
        Pq.add(n, img, md['kind'], md['ko'], md['desc'], md['rules'], md.get('brows'), md.get('layer'), md.get('role'), pad=pad)
    cnt = Pq.finish('폐허 마을·유령 마을 (ruined-village)')
    im.convert('RGB').save(HERE + '/render-1x.png')
    im.convert('RGB').resize((im.width * 2, im.height * 2), Image.NEAREST).save(HERE + '/render-2x.png')
    wg = s.walk_grid()
    json.dump({'w': W, 'h': H, 'tile': 16, 'rows': [''.join('.' if wg[y][x] else '#' for x in range(W)) for y in range(H)], 'legend': {'.': 'walkable', '#': 'blocked'},
               'marks': {k: list(v) for k, v in s.marks.items()}, 'reach_from_south_gate': res, 'empty_window': [dens[0], list(dens[1])], 'count': COUNT},
              open(HERE + '/grid.json', 'w'), ensure_ascii=False)
    return cnt

if __name__ == '__main__':
    im, res, dens = run()
    print(im.size, 'reach all', all(res.values()), {k: v for k, v in res.items() if not v}, 'density', dens)
    print(COUNT)
    if '--no-export' not in sys.argv: print('parts', export(im, res, dens))
    else: im.convert('RGB').save(HERE + '/_look/map.png')
