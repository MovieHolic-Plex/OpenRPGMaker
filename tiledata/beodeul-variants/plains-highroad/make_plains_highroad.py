# 초원 하이로드 — 72x52 JRPG 필드. 다시 돌리면 같은 그림이 나온다.   python3 make_plains_highroad.py
import sys, os, json, math, random
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from bdA import *               # 버들항 땅·나무·물 (city_v6 파이프라인)
import wl
import plains_auto as PA
import plains_pieces as PP
from plains_meta import META

W, H = 72, 52
rng = random.Random(7201)
s = Scene('plains-highroad', W, H, seed=72)

# ---------------------------------------------------------------- 오토타일 시트 (새 조각) — 지도에서도 이 시트로 깐다
SHEETS = {'dirtroad': PA.dirt_road(), 'woodfence': PA.wood_fence()}
def cell_of(sheet, n): return sheet.crop(((n % 4) * 16, (n // 4) * 16, (n % 4) * 16 + 16, (n // 4) * 16 + 16))

def nbits(mask, x, y, join=None):
    def on(xx, yy):
        return 0 <= xx < W and 0 <= yy < H and (mask[yy][xx] or (join is not None and join[yy][xx]))
    return (1 if on(x, y - 1) else 0) | (2 if on(x + 1, y) else 0) | (4 if on(x, y + 1) else 0) | (8 if on(x - 1, y) else 0)

def grid(v=False): return [[v] * W for _ in range(H)]
DIRT, STONE, FENCE, WALL, CAMP = grid(), grid(), grid(), grid(), grid()

def hline(g, y, x0, x1):
    for x in range(min(x0, x1), max(x0, x1) + 1):
        if 0 <= x < W and 0 <= y < H: g[y][x] = True
def vline(g, x, y0, y1):
    for y in range(min(y0, y1), max(y0, y1) + 1):
        if 0 <= x < W and 0 <= y < H: g[y][x] = True

# ---------------------------------------------------------------- 땅 조각(픽셀 경계가 들쭉날쭉한 덩이): 야영지·사거리·옛 뜰·밭
from scipy import ndimage as ndi
TEX = {'dirt': PP.ground_dirt(), 'gravel': PP.ground_gravel(), 'meadow': PP.ground_meadow()}
def ground_patch(mask, texname, seed, edge='dirt'):
    Wp, Hp = W * 16, H * 16
    m0 = np.kron(np.array(mask, bool), np.ones((16, 16), bool))
    Y, X = np.mgrid[0:Hp, 0:Wp]
    dx = np.rint((wl.tnoise(Wp, Hp, 8, seed) - 0.5) * 7 + (wl.tnoise(Wp, Hp, 3, seed + 1) - 0.5) * 3).astype(int)
    dy = np.rint((wl.tnoise(Wp, Hp, 8, seed + 2) - 0.5) * 7 + (wl.tnoise(Wp, Hp, 3, seed + 3) - 0.5) * 3).astype(int)
    m = m0[np.clip(Y + dy, 0, Hp - 1), np.clip(X + dx, 0, Wp - 1)]
    tex = np.array(TEX[texname].convert('RGB'))
    rgb = tex[Y % 48, X % 48].astype(np.uint8)
    inner = ndi.binary_erosion(m, iterations=1, border_value=1); inner2 = ndi.binary_erosion(m, iterations=2, border_value=1)
    out = np.dstack([rgb, np.where(m, 255, 0).astype(np.uint8)])
    if edge is None:
        return Image.fromarray(out.astype(np.uint8), 'RGBA')
    if edge == 'dirt':
        pal = wl.P('earth'); e1 = m & ~inner; e2 = inner & ~inner2
        out[e1, :3] = pal[1]; out[e2, :3] = np.where((wl.hash2(X, Y, seed + 5)[e2] > 0.45)[:, None], pal[2], rgb[e2])
    else:
        pal = wl.P('flag'); e1 = m & ~inner; e2 = inner & ~inner2
        out[e1, :3] = pal[1]; out[e2, :3] = np.where(((X + Y)[e2] % 3 == 0)[:, None], pal[5], pal[4])
    # 풀 잔털(바깥 1~2 화소)
    near = ndi.binary_dilation(m, iterations=2) & ~m
    tuft = near & (wl.hash2(X, Y, seed + 9) > 0.78)
    tc = np.array(PA.LAWN)[(wl.hash2(X, Y, seed + 10) * 6).astype(int).clip(0, 5)]
    out[tuft, :3] = tc[tuft]; out[tuft, 3] = 255
    return Image.fromarray(out.astype(np.uint8), 'RGBA')
def ref_mask(g): return [[bool(g[y][x]) for x in range(W)] for y in range(H)]

# ---------------------------------------------------------------- 하이로드: 서→동 굽이 대로(폭 2)
def smooth_runs(a, mn):
    ch = True
    while ch:
        ch = False; i = 0
        while i < len(a):
            j = i
            while j + 1 < len(a) and a[j + 1] == a[i]: j += 1
            if j - i + 1 < mn and 0 < i and j < len(a) - 1:
                for k in range(i, j + 1): a[k] = a[i - 1]
                ch = True
            i = j + 1
def road_y(x):
    if 11 <= x <= 20 or 32 <= x <= 41: return 27
    return int(round(27 + 1.7 * math.sin((x + 3) / 9.0) + 1.0 * math.sin(x / 19.0 + 1.0)))
ry = [road_y(x) for x in range(W)]
smooth_runs(ry, 4)
for x in range(W):
    DIRT[ry[x]][x] = True; DIRT[ry[x] + 1][x] = True
    if x > 0 and ry[x] != ry[x - 1]:
        for y in range(min(ry[x - 1], ry[x]), max(ry[x - 1], ry[x]) + 2): DIRT[y][x] = True
RY = ry
# 남쪽 곁길(캠프행), 농가 샛길, 연못 오솔길
vline(DIRT, 36, 29, 43); vline(DIRT, 37, 29, 44); hline(DIRT, 43, 36, 52); hline(DIRT, 44, 36, 52)
vline(DIRT, 9, 29, 31)
vline(DIRT, 52, 14, 26); hline(DIRT, 12, 50, 52); vline(DIRT, 52, 12, 14)
hline(DIRT, 12, 57, 61); vline(DIRT, 61, 9, 12)
# 동쪽 샛강(동→서, 폭 2) — 남쪽 곁길이 다리로 건넌다
def cy_of(x):
    if 32 <= x <= 41: return 33
    return 33 + int(round(1.2 * math.sin(x / 7.0 + 1.0)))
CY = [cy_of(x) for x in range(W)]
smooth_runs(CY, 4)
# 북쪽 폐허 갈래: 사거리에서 흙길이 망루 입구 계단 앞까지만(돌길·포석 뜰 없음)
RUIN_Y = 15                      # 망루·성벽 발치 줄
for y in range(RUIN_Y + 2, 27):
    DIRT[y][36] = True; DIRT[y][37] = True
# 땅 조각 마스크: 야영지 흙·사거리 자갈·옛 뜰 포석·농가 밭·풀 밝은 덩이
CAMP = grid(); GRAV = grid(); COURT = grid(); FIELD = grid(); MEAD = grid()
for y in range(36, 49):
    for x in range(46, 69):
        if ((x - 57) / 9.8) ** 2 + ((y - 42) / 5.0) ** 2 < 1.0: CAMP[y][x] = True
for y in range(24, 31):
    for x in range(33, 41):
        if ((x - 36.5) / 3.8) ** 2 + ((y - 27.5) / 2.9) ** 2 < 1.0: GRAV[y][x] = True
for y in range(33, 39):
    for x in range(5, 11):
        if ((x - 7.5) / 3.2) ** 2 + ((y - 35.5) / 2.6) ** 2 < 1.0: FIELD[y][x] = True
for (cx, cy, rx, ry_) in ((24, 18, 5, 3), (62, 24, 5, 3.4), (12, 46, 5, 3), (44, 8, 3.4, 2.4), (28, 40, 4, 2.6)):
    for y in range(int(cy - ry_) - 1, int(cy + ry_) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            if 0 <= x < W and 0 <= y < H and ((x - cx) / rx) ** 2 + ((y - cy) / ry_) ** 2 < 1.0: MEAD[y][x] = True

# ---------------------------------------------------------------- 개울 (북→남 폭 2) + 다리
def sx_of(y): return 15 + int(round(1.4 * math.sin(y / 6.5 + 0.4)))
SX = [sx_of(y) for y in range(H)]
for y in range(26, 31): SX[y] = 15
smooth_runs(SX, 4)
for y in range(H):
    for x in (SX[y], SX[y] + 1):
        s.water[y][x] = True; s.nat[y][x] = True; s.flow[y][x] = 'S'
    if y > 0 and SX[y] != SX[y - 1]:
        for x in range(min(SX[y - 1], SX[y]), max(SX[y - 1], SX[y]) + 2): s.water[y][x] = True; s.nat[y][x] = True; s.flow[y][x] = 'S'
for x in range(17, W):
    for y in (CY[x], CY[x] + 1):
        s.water[y][x] = True; s.nat[y][x] = True; s.flow[y][x] = 'W'
    if x > 17 and CY[x] != CY[x - 1]:
        for y in range(min(CY[x - 1], CY[x]), max(CY[x - 1], CY[x]) + 2): s.water[y][x] = True; s.nat[y][x] = True; s.flow[y][x] = 'W'
# 징검다리 오솔길(서쪽 숲 ↔ 동쪽 둑 ↔ 하이로드)
FY = 20; FX = SX[FY] - 1
hline(DIRT, FY, FX + 4, FX + 8); vline(DIRT, FX + 8, FY, RY[FX + 8] - 1); hline(DIRT, FY, FX - 6, FX - 2)
# 개울이 하이로드와 만나는 곳은 길 칸(흙)을 물 위로 비운다
for y in range(H):
    for x in range(W):
        if s.water[y][x]: DIRT[y][x] = False

# ---------------------------------------------------------------- 길 그리기용 마스크 → 오버레이
road_all = [[DIRT[y][x] or STONE[y][x] for x in range(W)] for y in range(H)]
def road_px():
    return np.kron(np.array(road_all, bool), np.ones((16, 16), bool))
s.road_px = road_px
bx = 14
BRIDGE = [(x, y) for x in range(bx, bx + 4) for y in (RY[15], RY[15] + 1)]
BRIDGE_V = [(x, y) for x in (36, 37) for y in range(32, 36)]
STEPS = [(36, RUIN_Y + 1), (37, RUIN_Y + 1)]          # 망루 입구 돌계단(길이 이어 붙는 칸)
JOIN = grid()
for (x, y) in BRIDGE + BRIDGE_V + STEPS: JOIN[y][x] = True
for (x, y) in BRIDGE + BRIDGE_V: DIRT[y][x] = False
JOIN_D = [[STONE[y][x] or JOIN[y][x] for x in range(W)] for y in range(H)]
JOIN_S = [[DIRT[y][x] or JOIN[y][x] for x in range(W)] for y in range(H)]
dirt_im = Image.new('RGBA', (W * 16, H * 16))
for y in range(H):
    for x in range(W):
        if DIRT[y][x]:
            dirt_im.alpha_composite(cell_of(SHEETS['dirtroad'], nbits(DIRT, x, y, JOIN_D)), (x * 16, y * 16))
for (mk, tx, sd, ed) in ((MEAD, 'meadow', 31, None), (CAMP, 'dirt', 32, 'dirt'), (FIELD, 'dirt', 33, 'dirt'), (GRAV, 'gravel', 34, 'dirt')):
    s.overlays.append((ground_patch(mk, tx, sd, ed), 0, 0))
s.overlays.append((dirt_im, 0, 0))

# ---------------------------------------------------------------- 점유 / 놓기 도우미
s.occ_ = set()
def occupy(x0, y0, x1, y1):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1): s.occ_.add((x, y))
def terrain_ok(x, y, allow_road=False):
    if not (0 <= x < W and 0 <= y < H): return False
    if s.water[y][x] or (x, y) in s.occ_: return False
    if not allow_road and road_all[y][x]: return False
    if FENCE[y][x] or WALL[y][x]: return False
    return True
def near_road(x, y, r=1):
    for j in range(-r, r + 1):
        for i in range(-r, r + 1):
            xx, yy = x + i, y + j
            if 0 <= xx < W and 0 <= yy < H and (road_all[yy][xx] or s.water[yy][xx]): return True
    return False
COUNT = {}
def put(img, cx, cy, name, block=None, canopy_rows=0, base_w=None, margin=0, allow_road=False, shadow=None, dx=0, dy=0, free=False, occ_extra=0):
    """img 바닥 왼쪽 칸 (cx,cy). block: 막을 칸 (i,j) 목록(기본 밑줄 전체). 밑줄이 비어 있고 수관이 길을 덮지 않을 때만. 성공 True."""
    wc = (img.width + 15) // 16; hc = (img.height + 15) // 16
    bw = base_w or wc
    for i in range(bw):
        if not terrain_ok(cx + i, cy, allow_road): return False
        if margin and near_road(cx + i, cy, margin): return False
    for j in range(1, min(canopy_rows, hc)):
        for i in range(wc):
            xx, yy = cx + i, cy - j
            if yy < 0 or xx >= W: return False
            if road_all[yy][xx] or s.water[yy][xx] or (xx, yy) in s.occ_: return False
    if cx < 0 or cx + wc > W or cy - hc + 1 < 0: return False
    if block is None: block = [(i, 0) for i in range(bw)]
    s.at(img, cx, cy, block=block, dx=dx, dy=dy, shadow=shadow)
    occupy(cx, cy - (hc - 1 if not free else 0), cx + bw - 1 + occ_extra, cy)
    COUNT[name] = COUNT.get(name, 0) + 1
    return True
def deco(img, cx, cy, name, dx=0, dy=0, margin=0):
    """걷는 땅 장식(막지 않음, 점유 표시도 안 해서 겹쳐도 된다). 길·물 위에는 안 놓는다."""
    if not terrain_ok(cx, cy) or (margin and near_road(cx, cy, margin)): return False
    wc = (img.width + 15) // 16
    for i in range(wc):
        if not terrain_ok(cx + i, cy): return False
    s.at(img, cx, cy, block=None, dx=dx, dy=dy, shadow=False)
    COUNT[name] = COUNT.get(name, 0) + 1
    return True

PIECE = {n: getattr(PP, n)() for n in [k for k in META if hasattr(PP, k) and not k.startswith('ground')]}
G = PIECE

# ---------------------------------------------------------------- 앵커 1: 개울 다리 (하이로드)
by = RY[15] + 1
# 다리 그림(64x32): 갑판이 아랫 두 줄 — 길 두 줄(ry, ry+1)에 맞춘다
s.at(G['bridge_h'], bx, RY[15] + 1, block=None, shadow=False)
for (x, y) in BRIDGE: s.occ_.add((x, y))
s.marks['bridge'] = (bx + 1, RY[15])
# 남쪽 곁길 세로 다리(2x4칸): 위 두 줄 길 + 아래 두 줄 길 사이 물 두 줄
G_bv = G['bridge_v']
s.at(G_bv, 36, 35, block=None, shadow=False)
for (x, y) in BRIDGE_V: s.occ_.add((x, y))
s.marks['bridge_s'] = (36, 34)
# 징검다리(48x16): 왼 둑 한 칸 + 물 두 칸
s.at(G['ford_stones'], FX, FY, block=None, shadow=False)
FORD = [(FX, FY), (FX + 1, FY), (FX + 2, FY)]
for (x, y) in FORD: s.occ_.add((x, y))
s.marks['ford'] = (FX + 3, FY)
s.marks['west_bank'] = (FX - 3, FY)

# ---------------------------------------------------------------- 앵커 2: 사거리 이정표
put(G['signpost_fork'], 34, RY[34] - 1, 'signpost_fork', block=[(0, 0)], canopy_rows=2)
put(G['waystone'], 40, RY[40] + 2, 'waystone', block=[(0, 0)])
put(G['cart_broken'], 41, RY[41] + 4, 'cart_broken', block=[(0, 0), (1, 0), (2, 0)], canopy_rows=2)
s.marks['crossroads'] = (36, RY[36])

# ---------------------------------------------------------------- 앵커 3: 무너진 망루 + 성벽 토막 + 잔해 (북쪽)
# 망루(4x7칸) 발치 줄 RUIN_Y, 좌우 성벽 토막은 망루 몸통 밑으로 1칸 겹쳐 잇고, 무너진 끝·터진 틈은 잔해 더미로 땅까지 잇는다.
TX = 35
s.at(G['watchtower_ruin'], TX, RUIN_Y, block=[(i, j) for i in range(4) for j in (-1, 0)], sorty=(RUIN_Y + 1) * 16 + 2)
occupy(TX, RUIN_Y - 6, TX + 3, RUIN_Y); COUNT['watchtower_ruin'] = 1
s.at(G['ruin_steps'], 36, RUIN_Y + 1, block=None, shadow=False)
for (x, y) in STEPS: s.occ_.add((x, y))
s.marks['tower_gate'] = (36, RUIN_Y + 1)
# 서쪽 성벽(29..35, 35 칸은 망루 밑) — 발치 줄만 막힘
s.at(G['ruin_wall_w'], TX - 6, RUIN_Y, block=[(i, 0) for i in range(6)], dy=-3, shadow=False, sorty=(RUIN_Y + 1) * 16 - 4)
occupy(TX - 6, RUIN_Y - 1, TX - 1, RUIN_Y); COUNT['ruin_wall_w'] = 1
# 동쪽 성벽(38..44, 38 칸은 망루 밑)
s.at(G['ruin_wall_e'], TX + 3, RUIN_Y, block=[(i, 0) for i in range(1, 7) if i != 4], dy=-3, shadow=False, sorty=(RUIN_Y + 1) * 16 - 4)
occupy(TX + 4, RUIN_Y - 1, TX + 9, RUIN_Y); COUNT['ruin_wall_e'] = 1
# 잔해: 서쪽 끝 큰 더미, 동쪽 터진 틈·끝 작은 더미(성벽에 겹쳐 땅까지 잇는다)
s.at(G['rubble_heap'], TX - 8, RUIN_Y + 1, block=[(0, 0), (1, 0), (2, 0)], dx=7, dy=-9, shadow=False)
occupy(TX - 8, RUIN_Y, TX - 6, RUIN_Y + 1); COUNT['rubble_heap'] = 1
s.at(G['rubble_small'], TX + 7, RUIN_Y, block=[(0, 0)], dx=-8, dy=-1, shadow=False, sorty=(RUIN_Y + 1) * 16)
s.at(G['rubble_small'], TX + 9, RUIN_Y, block=[(0, 0), (1, 0)], dx=-6, dy=1, shadow=False, sorty=(RUIN_Y + 1) * 16)
occupy(TX + 9, RUIN_Y, TX + 10, RUIN_Y); COUNT['rubble_small'] = 2
# 앞 풀밭에 떨어진 마름돌·부스러기(성벽에서 1~4칸 안, 일렬 금지)
for (x, y) in ((31, RUIN_Y + 2), (42, RUIN_Y + 2), (27, RUIN_Y + 3), (45, RUIN_Y + 1)):
    put(G['fallen_block'], x, y, 'fallen_block', block=[(0, 0)])
for (x, y) in ((33, RUIN_Y + 1), (29, RUIN_Y + 2), (39, RUIN_Y + 2), (43, RUIN_Y + 3), (34, RUIN_Y + 3), (40, RUIN_Y + 1), (26, RUIN_Y + 1)):
    deco(G['ruin_chips'], x, y, 'ruin_chips')
# 성벽 밑동을 풀밭에 묶는 덤불·키 큰 풀(앞 발치 줄, 뒤쪽 덩이)
for (x, y) in ((30, RUIN_Y + 1), (32, RUIN_Y + 1), (38, RUIN_Y + 1), (41, RUIN_Y + 1), (44, RUIN_Y + 2), (28, RUIN_Y + 2), (35, RUIN_Y + 1)):
    deco(G['tallgrass_b'] if x % 2 == 0 else G['tallgrass_a'], x, y, 'tallgrass', dy=-3)
put(G['thorn_bush'], TX - 7, RUIN_Y - 1, 'thorn_bush', block=[(0, 0)])
put(G['berry_bush'], TX + 5, RUIN_Y - 1, 'berry_bush', block=[(0, 0), (1, 0)])
mk_b = lambda x, y: (s.tree('bushC', x, y), occupy(x, y, x + 1, y), COUNT.__setitem__('bushC', COUNT.get('bushC', 0) + 1))
mk_b(TX - 4, RUIN_Y - 2); mk_b(TX + 8, RUIN_Y - 2)
put(G['dead_tree'], TX - 10, RUIN_Y + 1, 'dead_tree', block=[(0, 0)], canopy_rows=3)
put(G['dead_tree'], TX + 12, RUIN_Y, 'dead_tree', block=[(0, 0)], canopy_rows=3)
s.marks['ruin_west'] = (TX - 9, RUIN_Y + 2)
s.marks['ruin_east'] = (TX + 11, RUIN_Y + 1)

# ---------------------------------------------------------------- 앵커 4: 동쪽 연못 + 징검다리 + 선돌
pond_cx, pond_cy = 53, 14
s.at(G['pond_s'], pond_cx, pond_cy, block=[(i, j) for i in range(4) for j in (-2, -1, 0)], shadow=False)
occupy(pond_cx, pond_cy - 2, pond_cx + 3, pond_cy)
s.marks['pond_south'] = (52, 15)
for i, (x, y) in enumerate(((60, 7), (64, 8), (66, 11), (64, 14), (60, 14), (58, 11))):
    put(G['menhir'], x, y, 'menhir', block=[(0, 0)], canopy_rows=2)
put(G['cairn'], 62, 11, 'cairn', block=[(0, 0)])
s.marks['stone_circle'] = (62, 12)

# ---------------------------------------------------------------- 앵커 5: 야영지 (남동)
put(G['campfire'], 56, 42, 'campfire', block=[(0, 0), (1, 0)])
put(G['tent_a'], 49, 41, 'tent_a', block=[(i, j) for i in range(3) for j in (-1, 0)], allow_road=True, canopy_rows=0)
put(G['tent_a'], 61, 40, 'tent_a', block=[(i, j) for i in range(3) for j in (-1, 0)], allow_road=True, canopy_rows=0)
put(G['log_seat'], 53, 44, 'log_seat', block=[(0, 0), (1, 0)], allow_road=True)
put(G['log_seat'], 60, 44, 'log_seat', block=[(0, 0), (1, 0)], allow_road=True)
put(G['log_seat'], 57, 38, 'log_seat', block=[(0, 0), (1, 0)], allow_road=True)
put(G['bedroll'], 52, 39, 'bedroll', block=[], allow_road=True, free=True)
put(G['bedroll'], 64, 43, 'bedroll', block=[], allow_road=True, free=True)
put(G['tripod_pot'], 59, 41, 'tripod_pot', block=[(0, 0), (1, 0)], allow_road=True)
put(G['haybale'], 64, 38, 'haybale', block=[(0, 0), (1, 0)], allow_road=True)
put(G['rockpile'], 51, 45, 'rockpile', block=[(0, 0), (1, 0)], allow_road=True)
s.marks['camp'] = (56, 46)

# ---------------------------------------------------------------- 앵커 6: 서쪽 농가 울타리 + 문
for x in range(3, 13): FENCE[31][x] = True; FENCE[40][x] = True
for y in range(31, 41): FENCE[y][3] = True; FENCE[y][12] = True
GATE = [(8, 31), (9, 31)]
for (x, y) in GATE: FENCE[y][x] = False
fence_im = []
for y in range(H):
    for x in range(W):
        if FENCE[y][x]:
            jn = [[FENCE[yy][xx] or (xx, yy) in GATE for xx in range(W)] for yy in range(H)] if (x, y) == (0, 0) else None
FENCE_J = [[FENCE[y][x] or (x, y) in GATE for x in range(W)] for y in range(H)]
for y in range(H):
    for x in range(W):
        if FENCE[y][x]:
            im = cell_of(SHEETS['woodfence'], nbits(FENCE_J, x, y))
            s.sprite(im, x * 16, y * 16, [(x, y)], shadow=False, sorty=y * 16 + 16)
s.sprite(G['gate_wood'], 8 * 16, 31 * 16 - 8, [], shadow=False, sorty=31 * 16 + 16)   # 열린 문(걷기)
for (x, y) in GATE: s.occ_.add((x, y))
for (x, y) in ((5, 36), (6, 34), (10, 38)): pass
put(G['haystack_cone'], 4, 34, 'haystack_cone', block=[(0, 0), (1, 0)], base_w=2, allow_road=True)
put(G['haystack_cone'], 10, 38, 'haystack_cone', block=[(0, 0), (1, 0)], base_w=2, allow_road=True) if False else None
put(G['haystack_cone'], 9, 36, 'haystack_cone', block=[(0, 0), (1, 0)], base_w=2, allow_road=True)
put(G['haybale'], 4, 38, 'haybale', block=[(0, 0), (1, 0)], allow_road=True)
put(G['haybale'], 9, 39, 'haybale', block=[(0, 0), (1, 0)], allow_road=True)
put(G['scarecrow_b'], 6, 36, 'scarecrow_b', block=[(0, 0)], allow_road=True)
s.marks['farm_gate'] = (9, 30)
s.marks['farm_inside'] = (7, 35)


# ---------------------------------------------------------------- 식생: 나무(고목·참나무)·덤불 덩이
OAK = PP.oak_old()
def mk_oak_old(x, y):
    return put(OAK, x, y, 'oak_old', block=[(1, 0)], base_w=3, canopy_rows=4)
def mk_oakA(x, y):
    if not all(terrain_ok(x + i, y) for i in range(4)): return False
    for j in range(1, 5):
        for i in range(4):
            if y - j < 0 or road_all[y - j][x + i] or s.water[y - j][x + i] or (x + i, y - j) in s.occ_: return False
    if x + 4 > W or y - 4 < 0: return False
    s.tree('oakA', x, y); occupy(x, y, x + 3, y); COUNT['oakA'] = COUNT.get('oakA', 0) + 1; return True
def mk_oakB(x, y):
    if not all(terrain_ok(x + i, y) for i in range(3)): return False
    for j in range(1, 4):
        for i in range(3):
            if y - j < 0 or road_all[y - j][x + i] or s.water[y - j][x + i] or (x + i, y - j) in s.occ_: return False
    if x + 3 > W or y - 3 < 0: return False
    s.tree('oakB', x, y); occupy(x, y, x + 2, y); COUNT['oakB'] = COUNT.get('oakB', 0) + 1; return True
def mk_bush(kind, w):
    def f(x, y):
        if x + w > W or not all(terrain_ok(x + i, y) for i in range(w)): return False
        s.tree(kind, x, y); occupy(x, y, x + w - 1, y); COUNT[kind] = COUNT.get(kind, 0) + 1; return True
    return f
B_c, B_d, B_e = mk_bush('bushC', 2), mk_bush('bushD', 3), mk_bush('bushE', 2)
def mk_thorn(x, y): return put(G['thorn_bush'], x, y, 'thorn_bush', block=[(0, 0)])
def mk_berry(x, y): return put(G['berry_bush'], x, y, 'berry_bush', block=[(0, 0), (1, 0)])
def mk_rockpile(x, y): return put(G['rockpile'], x, y, 'rockpile', block=[(0, 0), (1, 0)])
def mk_boulder(x, y): return put(G['boulder'], x, y, 'boulder', block=[(0, 0), (1, 0)], canopy_rows=0)
def mk_stump(x, y): return put(G['stump_s'], x, y, 'stump_s', block=[(0, 0)])
def mk_log(x, y): return put(G['log_fallen'], x, y, 'log_fallen', block=[(0, 0), (1, 0)])
def mk_cairnS(x, y): return put(PP.rocks_small(), x, y, 'rocks_small', block=[], free=True)
def mk_mush(x, y): return deco(G['mushrooms'], x, y, 'mushrooms')

def cluster(cx, cy, rx, ry_, n, makers, tries=14):
    placed = 0
    for _ in range(n * tries):
        if placed >= n: break
        a = rng.random() * 6.2832; d = math.sqrt(rng.random())
        x = int(round(cx + math.cos(a) * rx * d)); y = int(round(cy + math.sin(a) * ry_ * d))
        if not (0 <= x < W and 4 <= y < H): continue
        if rng.choice(makers)(x, y): placed += 1
    return placed

cluster(6, 8, 6, 3.5, 8, [mk_oak_old, mk_oakA, mk_oakB, B_c, B_e, mk_thorn])
cluster(20, 6, 5, 2.5, 6, [mk_oakB, B_c, B_d, mk_oak_old, mk_berry])
cluster(62, 5, 4, 2.2, 3, [mk_oakB, B_c, mk_thorn])
cluster(69, 14, 3, 5, 7, [mk_oakA, mk_oakB, B_c, mk_thorn, B_e])
cluster(68, 30, 3, 5, 7, [mk_oakB, mk_oak_old, B_c, B_d, mk_berry])
cluster(68, 46, 4, 3.5, 7, [mk_oakA, mk_oakB, B_c, mk_stump])
cluster(40, 47, 4, 2.5, 4, [mk_oakB, B_c, B_e, mk_thorn, mk_berry])
cluster(3, 46, 3, 4, 5, [mk_oakA, mk_oakB, B_c])
cluster(46, 28, 3, 1.2, 3, [B_c, B_e, mk_thorn])
cluster(24, 28, 3, 1.2, 3, [B_c, B_e, mk_berry])
cluster(50, 6, 3, 2, 3, [mk_boulder, mk_rockpile, mk_thorn])
cluster(10, 15, 4, 2, 4, [mk_rockpile, mk_boulder, B_c])
cluster(66, 22, 3, 2, 4, [mk_boulder, mk_rockpile, B_c])
cluster(48, 31, 3, 1.5, 3, [mk_rockpile, mk_mush])

# ---------------------------------------------------------------- 빈 바닥 채우기: 숲 가장자리 덩이 + 풀꽃 덩어리밭(채움)
FL = [G['flowers_red'], G['flowers_yellow'], G['flowers_white'], G['flowers_blue']]
TG = [G['tallgrass_a'], G['tallgrass_b'], G['tallgrass_c']]
DECAL_IDS = set(id(i) for i in FL + TG + [G['mushrooms'], G['bedroll']])
FILL = set()
_ALPHA = {}
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
            e[y, x] = not (cov[y, x] >= 0.2 or road_all[y][x] or s.water[y][x] or WALL[y][x] or FENCE[y][x] or CAMP[y][x] or COURT[y][x]
                           or FIELD[y][x] or GRAV[y][x] or (x, y) in FILL or (x, y) in s.occ_ and cov[y, x] >= 0.05)
    return e
def worst_window(e, step=2):
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
            if rng.random() < 0.68:
                t = rng.choice(TG)
                if t.width > 16 and not terrain_ok(x + 1, y): t = TG[0]
                deco(t, x, y, 'tallgrass', dx=rng.randrange(-2, 3), dy=rng.randrange(-1, 2))
            if rng.random() < 0.55 or d < 0.35:
                kc = rng.randrange(4) if d < 0.5 else (cx.__int__() // 3 + int(cy) // 3) % 4
                deco(FL[kc], x, y, 'flowers', dx=rng.randrange(-3, 4), dy=rng.randrange(-3, 4))
    return n
TREEMK = [mk_oak_old, mk_oakA, mk_oakB, mk_oakB, B_c, B_d, B_e]
def grove(cx, cy):
    return cluster(cx, cy, 2.6, 1.8, 3, TREEMK + [mk_berry, mk_stump, B_c])
def rocks(cx, cy):
    return cluster(cx, cy, 2.6, 1.8, 3, [mk_rockpile, mk_boulder, mk_cairnS, mk_thorn])
# 가장자리 숲 띠(맵을 둘러싼 틀)
for (cx, cy, rx, ry_, n) in ((1, 20, 2, 9, 5), (70, 20, 2, 8, 5), (36, 1, 14, 1.5, 4), (60, 1, 6, 1.5, 3), (8, 50, 6, 1.5, 3), (66, 50, 6, 1.5, 4), (30, 50, 6, 1.5, 3)):
    cluster(cx, cy, rx, ry_, n, [mk_oak_old, mk_oakA, mk_oakB, B_c, B_d, mk_thorn], tries=18)
# 큰 빈 창부터 하나씩 메운다
for it in range(140):
    e = empty_cells(); r, wx, wy = worst_window(e, 1)
    if r <= 0.385:
        print('fill iterations', it, 'worst', round(float(r), 3)); break
    best = None
    for y in range(wy + 2, wy + 13):
        for x in range(wx + 2, wx + 18):
            if e[y, x]:
                sc = e[max(0, y - 2):y + 3, max(0, x - 2):x + 3].sum()
                if best is None or sc > best[0]: best = (sc, x, y)
    if best is None: break
    _, bx_, by_ = best
    pick = rng.random()
    if pick < 0.74: n = meadow(bx_, by_, rng.uniform(1.8, 3.2))
    elif pick < 0.92: n = grove(bx_, by_)
    else: n = rocks(bx_, by_)
    if n == 0: s.occ_.add((bx_, by_)); FILL.add((bx_, by_))   # 놓을 수 없는 칸(길 곁 등)은 건너뜀
# 작은 얼룩 풀밭(드문드문)
for _ in range(14):
    x, y = rng.randrange(2, W - 2), rng.randrange(4, H - 2)
    if rng.random() < 0.5 and terrain_ok(x, y): meadow(x, y, rng.uniform(1.0, 1.6))

# ---------------------------------------------------------------- 통행 · 밀도 · 저장
BRIDGE_CELLS = set(BRIDGE) | set(FORD) | set(BRIDGE_V)
_wg = s.walk_grid
def walk_grid():
    g = _wg()
    for (x, y) in BRIDGE_CELLS: g[y][x] = True
    # 문 칸·돌담 사이 틈은 걷기
    return g
s.walk_grid = walk_grid
# 막힘 보정: 울타리 칸은 막힘, 열린 문은 걷기
def run():
    im = s.render()
    reach = {}
    for st in ('west_exit', 'east_exit'):
        r = s.bfs(s.marks[st]); reach[st] = {k: (v in r) for k, v in s.marks.items()}
    e = empty_cells(); w = worst_window(e, 1)
    return im, reach, (float(w[0]), (w[1], w[2]), float(e.mean()))
s.marks['west_exit'] = (0, RY[0]); s.marks['east_exit'] = (W - 1, RY[W - 1])
s.fill = ()

def export(im, reach, dens):
    from wl import Parts
    Pq = Parts(HERE)
    for n in list(META):
        if n.startswith('autotile-'):
            sh = {'autotile-dirtroad': SHEETS['dirtroad'], 'autotile-woodfence': SHEETS['woodfence']}[n]
            img = sh; pad = False
        elif n.startswith('ground_'):
            img = TEX[{'ground_meadow': 'meadow', 'ground_dirt': 'dirt', 'ground_gravel': 'gravel'}[n]]; pad = False
        else:
            img = getattr(PP, n)(); pad = True
        md = META[n]
        Pq.add(n.replace('_', '-') if n.startswith('ground_') else n, img, md['kind'], md['ko'], md['desc'], md['rules'], md.get('brows'), md.get('layer'), md.get('role'), pad=pad)
    cnt = Pq.finish('초원 하이로드 (plains-highroad)')
    im.convert('RGB').save(HERE + '/render-1x.png')
    im.convert('RGB').resize((im.width * 2, im.height * 2), Image.NEAREST).save(HERE + '/render-2x.png')
    wg = s.walk_grid()
    json.dump({'w': W, 'h': H, 'tile': 16, 'rows': [''.join('.' if wg[y][x] else '#' for x in range(W)) for y in range(H)], 'legend': {'.': 'walkable', '#': 'blocked'},
               'marks': {k: list(v) for k, v in s.marks.items()}, 'reach': {k: all(v.values()) for k, v in reach.items()},
               'empty_window': [dens[0], list(dens[1])], 'count': COUNT}, open(HERE + '/grid.json', 'w'), ensure_ascii=False)
    return cnt

if __name__ == '__main__':
    im, reach, dens = run()
    print(im.size, 'reach W', all(reach['west_exit'].values()), 'E', all(reach['east_exit'].values()), {k: v for k, v in reach['west_exit'].items() if not v}, 'density', dens)
    print(COUNT)
    print('parts', export(im, reach, dens))
