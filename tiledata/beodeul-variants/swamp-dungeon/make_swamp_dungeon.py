# 늪 던전 (swamp-dungeon) — 64x48 야외 던전. 다시 돌리면 같은 그림. python3 make_swamp_dungeon.py
# 버들항 파이프라인(_lib-5/bd5 + city_v6 땅·물·마름돌·판석·신전·원탑·늪 마을 집)에 늪 재질(sd_terrain)과 새 조각(sd_art)을 얹는다.
# 동선: 서쪽 마른 땅 입구 → 진흙길 → 널다리 → 맹그로브 섬 → 널다리 → 안개 섬(오두막 폐허) → 긴 널다리 → 가라앉은 사당 앞 돌 단.
#       곁길: 맹그로브 섬 → 독 연못 섬 → 끊긴 널다리(가라앉은 탑 첨두가 보인다).
import os, sys, math, random, json
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import sd_art as A
from sd_art import *
from px2 import _hash, vnoise

W, H = 64, 48
s = SwampScene('swamp-dungeon', W, H, seed=83)
rng = random.Random(8301)

def blob(cx, cy, rx, ry, seed, rough=0.22):
    out = set()
    for y in range(H):
        for x in range(W):
            d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
            if d <= 1 + rough * (vnoise(x, y, 2.6, seed) - 0.5) * 2: out.add((x, y))
    return out

# ================================================================ 땅과 물
LAND = set()
for y in range(H):                                    # 서쪽 마른 땅: 물가 선이 들쭉날쭉
    edge = 9 + int(3.2 * vnoise(0, y, 5, 11) + 1.6 * vnoise(0, y, 2, 12))
    for x in range(edge): LAND.add((x, y))
ISLE_A = blob(21.5, 26, 5.9, 4.6, 21)                 # 맹그로브 섬
ISLE_B = blob(31, 9, 6.8, 4.4, 22)                    # 안개 섬(오두막 폐허)
ISLE_C = blob(32, 38.5, 7.8, 5.4, 23)                 # 독 연못 섬
ISLETS = set()
for (cx, cy, rx, ry, sd) in ((14, 11, 2.4, 1.6, 31), (13, 41, 2.6, 1.6, 32), (52, 41, 2.8, 1.8, 33), (59, 6, 2.2, 1.7, 34), (44, 5, 2.4, 1.5, 35), (60, 44, 2.8, 2.2, 36)):
    ISLETS |= blob(cx, cy, rx, ry, sd, 0.3)
LAND |= ISLE_A | ISLE_B | ISLE_C | ISLETS
POND = blob(33.5, 38.8, 3.6, 2.1, 41, 0.45)           # 독 연못(섬 안)
MUDC = set()
for (x, y) in LAND:                                   # 진흙 덩이: 물가·섬 가장자리 쪽
    near = any((x + dx, y + dy) not in LAND for dx in range(-2, 3) for dy in range(-2, 3))
    n = vnoise(x, y, 3.5, 51)
    if (near and n > 0.55) or n > 0.84: MUDC.add((x, y))
s.set_terrain(LAND, POND, MUDC)

# ================================================================ 길: 입구 진흙길 → 널다리 → 섬들 → 사당
for x in range(0, 14):
    for y in (25, 26):
        if not s.water[y][x]: s.track[y][x] = True
s.marks['entrance'] = (0, 25)
def deck(pts, w, ori=None):
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        o = ori or ('h' if y0 == y1 else 'v')
        for y in range(min(y0, y1), max(y0, y1) + 1):
            for x in range(min(x0, x1), max(x0, x1) + 1):
                for d in range(w):
                    xx, yy = (x, y + d) if o == 'h' else (x + d, y)
                    if 0 <= xx < W and 0 <= yy < H and s.water[yy][xx] and not s.poison[yy][xx]: s.deck[(xx, yy)] = o
deck([(6, 25), (19, 25)], 2)                           # 널다리 1: 서쪽 물가 → 맹그로브 섬
deck([(22, 23), (22, 15)], 2)                          # 널다리 2: 맹그로브 섬 → 북쪽
deck([(22, 13), (29, 13)], 2)                          #          → 안개 섬
deck([(36, 9), (46, 9)], 2)                            # 널다리 3: 안개 섬 → 동쪽
deck([(45, 11), (45, 19)], 2)                          #          → 사당 앞 돌 단
deck([(25, 29), (25, 37)], 1)                          # 곁 널다리: 맹그로브 섬 → 독 연못 섬(1칸 폭)
deck([(38, 37), (45, 37)], 1)                          # 독 연못 섬 동쪽: 끊긴 널다리
for y in range(20, 23):                                # 사당 앞 돌 단(물 위 판석 단, 사당 폭보다 조금 넓게)
    for x in range(46, 54):
        if s.water[y][x]: s.stone.add((x, y)); s.deck.pop((x, y), None)
for (x, y) in list(s.deck):                            # 돌 단에 닿는 널다리 칸은 돌 단 위로
    if (x, y) in s.stone: s.deck.pop((x, y))
s.marks['shrine_door'] = (49, 20)
s.marks['isle_a'] = (21, 26); s.marks['isle_b_hut'] = (31, 11); s.marks['isle_c_pond'] = (29, 38); s.marks['broken_deck_end'] = (45, 37)

# ================================================================ 섬 위 오솔길: 널다리 끝과 섬 안 목적지를 최단으로 잇는 밟힌 진흙길(이 칸에는 아무것도 놓지 않는다)
from collections import deque
def carve(a, b):
    ok = lambda x, y: 0 <= x < W and 0 <= y < H and (not s.water[y][x] or (x, y) in s.deck or (x, y) in s.stone)
    prev = {a: None}; q = deque([a])
    while q:
        c = q.popleft()
        if c == b: break
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (c[0] + dx, c[1] + dy)
            if n not in prev and ok(*n): prev[n] = c; q.append(n)
    if b not in prev: print('carve: no path', a, b); return []
    path = []; c = b
    while c: path.append(c); c = prev[c]
    for (x, y) in path:
        if not s.water[y][x] and not s.track[y][x]: s.trail.add((x, y)); s.reserve(x, y, x, y)
    return path
carve((13, 25), (22, 21)); carve((22, 26), (25, 31))                      # 맹그로브 섬: 서쪽 널다리 → 북쪽 널다리 · 남쪽 곁 널다리
carve((27, 13), (31, 10)); carve((31, 10), (38, 9))                       # 안개 섬: 널다리 → 오두막 문 앞 → 동쪽 널다리
carve((25, 34), (29, 38)); carve((29, 38), (40, 37))                      # 독 연못 섬: 곁 널다리 → 연못가 → 끊긴 널다리

# ================================================================ 조각 놓기 도우미
def obj(im, cx, cy, block='bottom', **k): s.at(im, cx, cy, block=block, **k)
def tree(im, cx, cy, mid, canopy=True, shadow=True):
    s.sprite(im, cx * 16, (cy + 1) * 16 - im.height, mid, shadow=shadow)
    if canopy: s.canopies.append((cx * 16, (cy + 1) * 16 - im.height, im.width, im.height))
def reserve(x0, y0, x1, y1): s.reserve(x0, y0, x1, y1)
def is_land(x, y): return 0 <= x < W and 0 <= y < H and not s.water[y][x]

# ================================================================ 앵커 ② 가라앉은 옛 사당 + 탑 첨두 + 잠긴 기둥 줄
SHRINE = A.shrine_sunken()
obj(SHRINE, 47, 19, block=None)
for x in range(47, 53):
    for y in range(17, 20): s.block[y][x] = True
reserve(43, 13, 56, 24)
obj(A.spire_sunken(), 57, 33, block=None)               # 남동쪽 물 위로 솟은 탑 첨두
obj(A.sunken_arch(), 38, 21, block=None)                # 사당 서쪽 물에 잠긴 아치
for (x, y, k, sd) in ((43, 16, 0, 3), (55, 18, 1, 5), (56, 23, 2, 7), (42, 26, 1, 9), (54, 27, 0, 11), (59, 14, 2, 13), (40, 14, 2, 15)):
    if s.water[y][x] and (x, y) not in s.deck and (x, y) not in s.stone: obj(A.pillar_water(k, sd), x, y, block=None)
obj(A.stone_lantern(21), 47, 22, block=[(0, 0)])        # 돌 단 앞 양쪽 돌 등롱
obj(A.stone_lantern(22, lean=2), 53, 22, block=[(0, 0)])

# ================================================================ 앵커 ⑤ 안개 섬: 오두막 폐허
HUT = A.hut_ruin()
obj(HUT, 29, 9, block=[(i, j) for i in range(HUT.width // 16) for j in (0, -1)])
reserve(28, 3, 34, 9)
obj(A.hut_debris(), 25, 10, block=[(0, 0)])
obj(A.barrel_broken(), 28, 9)
obj(A.stone_lantern(23), 34, 12, block=[(0, 0)])
tree(A.dead_tree(6), 35, 8, [(35, 8)]); reserve(35, 5, 36, 8)
tree(A.bald_cypress(4), 25, 9, [(26, 9)]); reserve(25, 4, 27, 9)
tree(A.dead_tree(9), 36, 12, [(36, 12)], canopy=False); reserve(36, 10, 37, 12)

# ================================================================ 앵커 ③ 맹그로브 섬
tree(A.mangrove(5, 6, 1), 15, 23, [(17, 23), (18, 23)]); reserve(15, 19, 20, 23)
tree(A.mangrove(3, 4, 3), 24, 23, [(25, 23)]); reserve(24, 20, 26, 23)
obj(A.skull_stake(), 20, 24, block=[(0, 0)])            # 섬 들머리 경고 말뚝
obj(A.stump_fungus(), 19, 29)
obj(A.rock_water(False, 45), 17, 28)

# ================================================================ 앵커 ④ 독 연못 섬
for (x, y, sd) in ((31, 38, 1), (35, 37, 2), (33, 40, 3), (36, 39, 4)):
    if s.poison[y][x]: obj(A.toxic_bubbles(33 + sd), x, y, block=None)
for (x, y, sd) in ((29, 36, 1), (38, 38, 2), (30, 41, 3), (37, 41, 4), (34, 35, 5)):
    if is_land(x, y): obj(A.cattail(60 + sd, 4 + sd % 2), x, y, block=[(0, 0)])
obj(A.skull_stake(38), 27, 37, block=[(0, 0)]); obj(A.skull_stake(39), 39, 36, block=[(0, 0)])
obj(A.bones(), 31, 41, block=None); obj(A.bones(36), 36, 36, block=None)
tree(A.dead_tree(11, wet=False), 28, 41, [(28, 41)], canopy=False); reserve(28, 38, 29, 41)
tree(A.dead_tree(12), 37, 34, [(37, 34)], canopy=False); reserve(37, 31, 38, 34)
obj(A.deck_broken_end(), 46, 37, block=None)
reserve(26, 34, 40, 43)

# ================================================================ 물 위: 연잎·통나무·바위·말뚝·배·고사목
for (x, y, sd) in ((10, 30, 1), (12, 18, 2), (27, 19, 3), (35, 22, 4), (42, 30, 5), (49, 33, 6), (17, 36, 7), (55, 11, 8), (8, 44, 9), (47, 44, 10), (39, 5, 11), (20, 4, 12), (61, 25, 13), (30, 28, 14)):
    if s.water[y][x] and s.water[y][min(W - 1, x + 1)] and (x, y) not in s.deck and (x + 1, y) not in s.deck: obj(A.lily_cluster(43 + sd, sd % 3 == 0), x, y, block=None)
obj(A.log_water(), 28, 18, block=None)
obj(A.sunken_boat(), 12, 33, block=None)
obj(A.rock_water(True, 41), 18, 9, block=None); obj(A.rock_water(False, 47), 39, 27, block=None); obj(A.rock_water(True, 49), 50, 30, block=None)
obj(A.stepping_stones(), 33, 30, block=None)
for (x, y, rope) in ((12, 24, False), (16, 24, True), (21, 17, False), (24, 12, True), (40, 8, False), (44, 14, True), (47, 17, False), (26, 33, False), (41, 36, True)):
    if s.water[y][x] and (x, y) not in s.deck and (x, y) not in s.stone: obj(A.deck_post(45 + x, rope), x, y, block=None)
for (x, y, sd) in ((33, 23, 21), (49, 29, 22), (8, 37, 23), (61, 32, 24), (40, 44, 25)):
    if s.water[y][x]: tree(A.dead_tree(sd, wet=True), x, y, [], canopy=False)

# ================================================================ 작은 섬: 낙우송·맹그로브·부들
tree(A.bald_cypress(7), 13, 11, [(14, 11)]); reserve(13, 6, 15, 11)
tree(A.mangrove(3, 4, 9), 51, 41, [(52, 41)]); reserve(51, 38, 53, 41)
tree(A.mangrove(4, 5, 13), 58, 44, [(59, 44), (60, 44)]); reserve(58, 40, 61, 44)
tree(A.bald_cypress(8), 43, 5, [(44, 5)]); reserve(43, 1, 45, 5)
tree(A.dead_tree(14), 59, 6, [(59, 6)], canopy=False); reserve(59, 3, 60, 6)
for (x, y) in ((12, 41), (14, 40), (15, 11), (12, 12), (60, 7), (53, 40), (45, 5), (61, 45)):
    if is_land(x, y): obj(A.cattail(70 + x + y, 3 + (x % 3)), x, y, block=[(0, 0)])

# ================================================================ 오토타일 덧그림: 물가 갈대밭(갈대 번짐) · 서쪽 땅 늪 웅덩이(물↔진흙↔풀)
import sd_parts as SPm
def lay_auto(sheet, cells):
    im = Image.new('RGBA', (W * 16, H * 16))
    on = lambda x, y: (x, y) in cells
    for (x, y) in cells:
        m = (1 if on(x, y - 1) else 0) | (2 if on(x + 1, y) else 0) | (4 if on(x, y + 1) else 0) | (8 if on(x - 1, y) else 0)
        im.alpha_composite(sheet.crop(((m % 4) * 16, (m // 4) * 16, (m % 4) * 16 + 16, (m // 4) * 16 + 16)), (x * 16, y * 16))
    return im
REEDC = set()
for y in range(H):
    for x in range(W):
        if not s.water[y][x] or s.poison[y][x] or (x, y) in s.deck or (x, y) in s.stone: continue
        if any((x + i, y + j) in s.deck or (x + i, y + j) in s.stone for i in (-1, 0, 1) for j in (-1, 0, 1)): continue
        shore = any(0 <= x + i < W and 0 <= y + j < H and not s.water[y + j][x + i] for i in (-1, 0, 1) for j in (-1, 0, 1))
        if shore and vnoise(x, y, 3.0, 97) > 0.52: REEDC.add((x, y))
s.ground_top.insert(0, (lay_auto(SPm.autotile_reeds(), REEDC), 0, 0))
PUD = set()
for (cx, cy, rx, ry, sd) in ((3.5, 33, 2.2, 1.3, 1), (5.5, 17.5, 1.8, 1.1, 2), (2.5, 41.5, 1.7, 1.0, 3)):
    for (x, y) in blob(cx, cy, rx, ry, 90 + sd, 0.3):
        if is_land(x, y) and not s.track[y][x] and all(not s.track[y + j][x] for j in (-1, 1) if 0 <= y + j < H): PUD.add((x, y))
for (x, y) in PUD: s.block[y][x] = True; s.reserve(x, y, x, y)
s.overlays.append((lay_auto(SPm.autotile_mudpool(), PUD), 0, 0))

# ================================================================ 서쪽 마른 땅: 숲 가장자리(낙우송·고사목·맹그로브·칩셋 참나무를 늪빛으로)
def oak(kind, look):
    return A._swampleaf(tree_look(kind, look), 0.9)
NZ = value_noise(8303, W, H, 7)
def clear_above(x, y, w, h):
    for j in range(1, h):
        for i in range(w):
            yy = y - j
            if yy < 0: continue
            if s.track[yy][x + i] or (x + i, yy) in s.deck: return False
    return True
def mk_tree(fn, w, h, mid):
    def f(x, y):
        if x + w > W or not clear_above(x, y, w, h): return False
        if not all(s.cell_free(x + i, y, 0) and is_land(x + i, y) for i in range(w)): return False
        im = fn(x, y)
        tree(im, x, y, [(x + m, y) for m in mid])
        for i in range(w): s.reserve(x + i, y, x + i, y)
        return True
    return f
OA = mk_tree(lambda x, y: oak('oakA', int(_hash(x, y, 3) * 4)), 4, 5, (1, 2))
OB = mk_tree(lambda x, y: oak('oakB', int(_hash(x, y, 4) * 4)), 3, 4, (1,))
CY = mk_tree(lambda x, y: A.bald_cypress(x * 7 + y), 3, 6, (1,))
DT = mk_tree(lambda x, y: A.dead_tree(x * 5 + y), 2, 4, (0,))
MG = mk_tree(lambda x, y: A.mangrove(3, 4, x + y * 3), 3, 4, (1,))
def bush(kind):
    def f(x, y):
        tx, ty, w, h = TREES[kind]
        if x + w > W or not all(s.cell_free(x + i, y, 0) and is_land(x + i, y) for i in range(w)): return False
        im = oak(kind, int(_hash(x, y, 5) * 4))
        s.sprite(im, x * 16, (y + 1) * 16 - im.height, [(x + i, y) for i in range(w)], shadow=False)
        for i in range(w): s.reserve(x + i, y, x + i, y)
        return True
    return f
BC, BD, BE = bush('bushC'), bush('bushD'), bush('bushE')
def zone(x, y):
    t = NZ[y][x]
    if t > 0.6: return [OA, CY, OB, BD, CY]
    if t > 0.4: return [OB, CY, DT, BC, OA, BE]
    return [OB, DT, MG, BC, BE, CY]
order = [(x, y) for y in range(H) for x in range(W)]; rng.shuffle(order)
for (x, y) in order:
    if not is_land(x, y) or not s.cell_free(x, y, 0): continue
    if (x, y) in ISLE_A | ISLE_B | ISLE_C | ISLETS: continue
    if any(s.track[yy][xx] for yy in range(max(0, y - 1), min(H, y + 2)) for xx in range(max(0, x - 1), min(W, x + 2))): continue
    near2 = any(s.track[yy][xx] for yy in range(max(0, y - 2), min(H, y + 3)) for xx in range(max(0, x - 2), min(W, x + 3)))
    if near2 and _hash(x, y, 31) < 0.5: continue
    for _ in range(3):
        if rng.choice(zone(x, y))(x, y): break
for (x, y) in order:                                   # 섬의 남은 땅: 덤불·부들(덩이로)
    if not is_land(x, y) or not s.cell_free(x, y, 0): continue
    if (x, y) in s.trail or any((x + i, y + j) in s.trail for i in (-1, 0, 1) for j in (0, 1)): continue
    if (x, y) in ISLE_A | ISLE_B | ISLE_C and rng.random() < 0.30:
        if rng.random() < 0.4: rng.choice([BC, BE])(x, y)
        elif s.cell_free(x, y, 0): obj(A.cattail(90 + x * 3 + y, 3 + (x + y) % 3), x, y, block=[(0, 0)]); s.reserve(x, y, x, y)

# ================================================================ 바닥 덮개(걸음 소품): 갈대 포기·독버섯·뿌리
REEDS = [A.reed_tuft(41 + i) for i in range(3)]; SHROOMS = [A.swamp_mushrooms(31 + i) for i in range(3)]
order2 = [(x, y) for y in range(H) for x in range(W)]; rng.shuffle(order2)
for (x, y) in order2:
    if s.water[y][x] or s.track[y][x] or s.block[y][x] or (x, y) in s.deck or (x, y) in s.stone: continue
    if (x, y) in s.trail and rng.random() < 0.8: continue
    if (x, y) in s._occ() and not s.cell_free(x, y): continue
    r = rng.random(); dx, dy = rng.randrange(-3, 4), rng.randrange(-2, 3)
    nearw = any(0 <= x + i < W and 0 <= y + j < H and s.water[y + j][x + i] for i in (-1, 0, 1) for j in (-1, 0, 1))
    if nearw and r < 0.30: s.at(REEDS[rng.randrange(3)], x, y, block=None, dx=dx, dy=dy)
    elif r < 0.06: s.at(SHROOMS[rng.randrange(3)], x, y, block=None, dx=dx, dy=dy)

# ================================================================ 안개·도깨비불(사람 위 덧그림)
for (x, y, w, h, sd) in ((24, 5, 6, 2, 1), (31, 2, 5, 2, 2), (32, 11, 6, 2, 3), (21, 10, 5, 2, 4), (36, 6, 5, 2, 5), (39, 16, 6, 2, 6), (53, 13, 6, 2, 7), (37, 25, 6, 2, 8), (56, 27, 5, 2, 9), (27, 8, 4, 2, 10)):
    s.top_overlays.append((A.fog_wisp(sd, w, h), x * 16, y * 16))
for (x, y, n) in ((49, 18, 1), (52, 16, 2), (30, 6, 1), (35, 39, 2), (56, 30, 1), (24, 22, 1)):
    s.top_overlays.append((A.wisp(23 + x, n), x * 16, y * 16 - 6))

# ================================================================ 실행
if __name__ == '__main__':
    im = s.render()
    reach = s.bfs(s.marks['entrance'])
    miss = {k: v for k, v in s.marks.items() if v not in reach}
    dens = s.density()
    print('size', im.size, 'unreached', miss or 'none', 'density(max window, at, all)', round(dens[0], 3), dens[1], round(dens[2], 3))
    os.makedirs(HERE + '/_qa', exist_ok=True)
    im.save(HERE + '/_qa/proto.png')
    if '--save' in sys.argv:
        s.save(HERE, extra_grid={'reach_from_entrance': {k: (v in reach) for k, v in s.marks.items()}, 'density_max_window': [round(float(dens[0]), 3), list(dens[1])],
                                 'notes': '#=막힘(물·벽·나무 밑동·물체 몸통), .=걸음(땅·진흙·널다리·돌 단). 나무 수관·지붕 윗줄은 걸음(뒤로 지나감).'})
        import sd_parts
        print('parts', sd_parts.save_parts())
