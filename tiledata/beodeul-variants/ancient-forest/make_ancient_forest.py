# 고대 숲 (ancient-forest) — 64x48 야외 던전. 다시 돌리면 같은 그림. python3 make_ancient_forest.py
# 버들항 파이프라인(_lib-5/bd5.Scene = city_v6 땅·흙길·물·절벽/마름돌 단·그림자)으로 깔고, 새 조각은 af_art.py.
import os, sys, math, random, json
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import af_art as A
from af_art import *
from af_art import _hash
import parts5 as P5                       # 깊은 숲길(버들항 변형 5-3)의 고사리·버섯·덤불 소품 — 다시 내보내지 않는다

W, H = 64, 48
s = Scene('ancient-forest', W, H, seed=71)
rng = random.Random(7101)
_sv = terrain7.sand_variants
terrain7.sand_variants = lambda: _sv(lawn_xy=(112, 2144))        # 숲길 흙 가장자리는 그늘 풀로 번진다
terrain.MASONRY_FN = lambda X, fy: A.ruin_ash(X, fy, holes=False)
_stair = terrain.stair
def mossy_stair(px, x0, y0, w):
    """버들항 돌계단(terrain.stair)을 그린 뒤 바래고, 디딤판 가장자리·옆벽에 이끼."""
    _stair(px, x0, y0, w)
    X0, Y0 = x0 * 16, y0 * 16 - 3
    for Y in range(Y0, Y0 + 51):
        for X in range(X0, X0 + w * 16):
            c = px[X, Y][:3]; lx = X - X0
            c = A.weather(c, 1.0)
            v = vnoise(X, Y, 3.0, 97)
            if (lx < 5 or lx >= w * 16 - 5) and v > 0.55: c = A.MOSS[2] if v < 0.65 else A.MOSS[3]
            elif (Y - Y0) % 5 >= 3 and v > 0.70: c = A.MOSS[1]
            px[X, Y] = c + (255,)
terrain.stair = mossy_stair              # 유적 단의 앞면 = 이끼 낀 옛 마름돌

# ================================================================ 유적: 계단식 단 두 층 (북동)
# 바깥 단(lev1): x 41..60, y 2..12 — 북서 모서리는 무너져 숲이 먹었다(41..43, 2..5)
for y in range(2, 13):
    for x in range(41, 61):
        if x <= 43 and y <= 5: continue                               # 북서 모서리: 무너져 숲이 먹었다
        if x <= 44 and y >= 12: continue                              # 남서 모서리 한 줄 무너짐(앞면이 어긋난다)
        if x >= 58 and y >= 12: continue                              # 남동 모서리 한 줄 무너짐
        if x == 60 and (y <= 3 or y >= 10): continue                  # 동쪽 끝 들쭉날쭉
        s.lev[y][x] = 1
for y in range(3, 7):                                                 # 안쪽 제단 단(lev2): x 47..54, y 3..6
    for x in range(47, 55): s.lev[y][x] = 2
s.masonry = [[True] * W for _ in range(H)]
s.stairs = [(49, 13, 4), (50, 7, 2)]                                  # 큰 계단(4칸) · 제단 단 계단(2칸)
s.marks['altar'] = (50, 7)
s.marks['terrace'] = (50, 12)
TERR = {(x, y) for y in range(H) for x in range(W) if s.lev[y][x] >= 1}

# 단 윗면 판석: 가장자리·나무뿌리 쪽은 풀이 먹어 들어가 들쭉날쭉(경계 1화소 어두운 테)
F_ = terrain.faces(s.lev)
pav = Image.new('RGBA', (W * 16, H * 16)); pp = pav.load()
def paved(X, Y):
    cx, cy = X // 16, Y // 16
    if (cx, cy) not in TERR or F_[cy][cx]: return False
    if s.lev[cy][cx] == 2: return True
    n = vnoise(X, Y, 14, 77) * 0.75 + vnoise(X, Y, 4, 78) * 0.25
    edge = min(X - 41 * 16, 61 * 16 - X, Y - 2 * 16, 13 * 16 - Y) / 16.0
    return n + min(1.0, edge * 0.22) > 0.62
for Y in range(0, 14 * 16):
    for X in range(40 * 16, 62 * 16):
        if paved(X, Y):
            c = A.flag_tex(X, Y)
            if not (paved(X - 1, Y) and paved(X + 1, Y) and paved(X, Y - 1) and paved(X, Y + 1)): c = ST[1]
            pp[X, Y] = c + (255,)
# 단 앞 광장(lev0, y 16..21): 깨진 판석 몇 무더기
for Y in range(16 * 16, 22 * 16):
    for X in range(44 * 16, 58 * 16):
        n = vnoise(X, Y, 12, 81) * 0.7 + vnoise(X, Y, 3, 82) * 0.3
        d = abs(X / 16 - 51) / 7 + max(0, Y / 16 - 18) / 5
        if n - d * 0.35 > 0.42:
            pp[X, Y] = A.flag_tex(X, Y, seed=6) + (255,)
for Y in range(16 * 16, 22 * 16):
    for X in range(44 * 16, 58 * 16):
        if pp[X, Y][3] and not all(pp[X + dx, Y + dy][3] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))): pp[X, Y] = ST[1] + (255,)
s.overlays.append((pav, 0, 0))
_pa = np.array(pav)[:, :, 3] > 0
s.fill = {(x, y) for y in range(H) for x in range(W) if _pa[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16].mean() > 0.5}   # 판석 면 = 구조(길·광장처럼)

# ================================================================ 길 (흙길 2칸 폭)
def lay(pts, w=2):
    """직교 마디로 잇는 흙길(폭 w). 1칸 어긋남(jog)이 길의 굽이 — 대각 계단 무늬가 생기지 않는다."""
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        for x in range(min(x0, x1), max(x0, x1) + 1):
            for y in range(min(y0, y1), max(y0, y1) + 1):
                for dx in range(w):
                    for dy in range(w):
                        if 0 <= x + dx < W and 0 <= y + dy < H and s.lev[y + dy][x + dx] == 0: s.track[y + dy][x + dx] = True
MAIN = [(9, 47), (9, 41), (10, 41), (10, 34), (16, 34), (16, 33), (24, 33), (24, 32), (31, 32), (31, 33), (37, 33), (37, 28), (38, 28),
        (38, 24), (43, 24), (43, 23), (49, 23), (49, 16)]
lay(MAIN)
for y in range(16, 18):                                               # 큰 계단 앞: 길이 계단 폭(4칸)으로 넓어진다
    for x in (49, 50, 51, 52): s.track[y][x] = True
lay([(10, 34), (10, 31), (9, 31), (9, 29)])                           # 서쪽 곁길 → 버섯 공터
lay([(38, 33), (41, 33), (41, 35)])                                   # 동쪽 곁길 → 샘 공터
s.marks['entrance'] = (9, 47); s.marks['plaza'] = (50, 18)

# ================================================================ 샘·개울 (남동, 칩셋 물 파이프라인)
for y in range(H):
    for x in range(W):
        if ((x - 47.5) / 4.3) ** 2 + ((y - 40.6) / 2.7) ** 2 <= 1 + 0.25 * vnoise(x, y, 2.0, 99) - 0.12: s.water[y][x] = True; s.nat[y][x] = True
for y in range(42, H):                                                # 샘에서 남쪽 끝으로 흐르는 개울(2칸)
    bx = 48 + (1 if 44 <= y <= 45 else 0)
    for x in (bx, bx + 1): s.water[y][x] = True; s.nat[y][x] = True; s.flow[y][x] = 'S'
s.track_water_join = False
s.marks['spring'] = (43, 39)

# ================================================================ 공터 정의(예약)
def ell(cx, cy, rx, ry): return {(x, y) for y in range(H) for x in range(W) if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1}
GLADE_M = ell(8, 25, 6.2, 4.6)        # 버섯 공터
GLADE_S = ell(45, 38, 5.6, 3.8)       # 샘 공터
PLAZA = {(x, y) for y in range(16, 23) for x in range(44, 58)}
for c in GLADE_M | GLADE_S | PLAZA | TERR: s.reserve(*c, *c)
for y in range(13, 16):
    for x in range(41, 61): s.reserve(x, y, x, y)                     # 단 앞면
s.marks['glade_mushroom'] = (9, 27); s.marks['glade_spring'] = (41, 38)

# ================================================================ 앵커 물체
def obj(im, cx, cy, block='bottom', **k): s.at(im, cx, cy, block=block, **k)
# 제단 단 위
obj(A.altar_stone(), 49, 5, block=[(0, 0), (1, 0), (2, 0), (0, -1), (1, -1), (2, -1)])
obj(A.brazier_stone(), 47, 4); obj(A.brazier_stone(seed=18), 54, 4)
# 바깥 단 위: 수호상 둘(계단 위 양쪽) · 기둥 줄의 남은 기둥(온전·부러짐·토막) · 무너진 덩이
obj(A.statue_guardian(2), 45, 12, block=[(0, 0), (1, 0)]); obj(A.statue_guardian(3).transpose(Image.FLIP_LEFT_RIGHT), 55, 12, block=[(0, 0), (1, 0)])
for (x, y, kind) in ((42, 11, 'full'), (42, 8, 'b12'), (59, 9, 'full'), (59, 6, 'full'), (59, 11, 'b22'), (57, 3, 'full'), (45, 3, 'b22'), (59, 4, 'b12')):
    im = A.pillar(4) if kind == 'full' else (A.pillar(4, broken=22, seed=x + y) if kind == 'b22' else A.pillar(3, broken=12, seed=y))
    obj(im, x, y)
obj(A.pillar_drum(), 42, 6, block=[(0, 0), (1, 0)]); obj(A.pillar_drum(4), 56, 8, block=[(0, 0), (1, 0)])
obj(A.blocks_fallen(2), 56, 11, block=[(0, 0), (1, 0)]); obj(A.blocks_fallen(1, 5), 46, 9); obj(A.blocks_fallen(1, 8), 44, 4)
obj(A.rubble(19), 43, 9, block=None); obj(A.rubble(20), 55, 3, block=None)
obj(A.rubble(), 52, 10, block=None)
# 단 앞(광장): 무너진 아치 문(길이 가운데로 지난다) · 부러진 기둥 한 쌍 · 단 발치 돌무더기 · 비석
obj(A.arch_ruined(), 48, 21, block=[(0, 0), (3, 0)])
obj(A.pillar(3, broken=14, seed=9), 46, 18); obj(A.pillar(4, broken=24, seed=11), 54, 19)
obj(A.rubble(12), 43, 16, block=[(0, 0), (1, 0)]); obj(A.blocks_fallen(2, 13), 56, 16, block=[(0, 0), (1, 0)])
obj(A.blocks_fallen(1, 14), 47, 16); obj(A.pillar_drum(6), 52, 20, block=[(0, 0), (1, 0)])
obj(A.stele(), 45, 22)
# 샘 공터: 옛 돌확 · 비석 · 바위 · 종꽃
obj(A.spring_basin(), 41, 37, block=[(0, 0), (1, 0), (2, 0)])
obj(A.stele(14), 51, 36); obj(A.pillar_drum(8), 44, 35, block=[(0, 0), (1, 0)]); obj(A.blocks_fallen(1, 16), 50, 38)
obj(A.boulder_moss(), 51, 42); obj(A.boulder_moss(False, 27), 43, 43); obj(A.boulder_moss(False, 28), 52, 39)
# 버섯 공터: 거대한 그루터기 · 큰 빛 버섯 · 바위 · 통나무
obj(A.stump_giant(), 7, 25, block=[(0, 0), (1, 0), (2, 0)])
obj(A.glow_mushroom_big(), 3, 27); obj(A.glow_mushroom_big(34), 12, 23)
obj(A.boulder_moss(True, 29), 3, 23); obj(A.log_mossy(), 10, 29, block=[(0, 0), (1, 0), (2, 0)])
# 입구: 고목 아치(가운데 2칸이 길) · 길잡이 비석
obj(A.tree_arch(), 7, 44, block=[(0, 0), (1, 0), (4, 0), (5, 0)])
s.canopies.append((7 * 16, 45 * 16 - 112, 96, 112))
obj(A.stele(15), 12, 41)
for c in [(x, y) for y in range(38, 45) for x in range(6, 14)]: s.reserve(*c, *c)
# 쉼터(길 가운데쯤): 통나무·그루터기
obj(A.log_mossy(24, 2), 27, 34, block=[(0, 0), (1, 0)]); obj(P5.ALL['stump'](), 25, 35)
for c in [(x, y) for y in range(33, 36) for x in range(24, 30)]: s.reserve(*c, *c)

im_ = A.oak_ancient('oakA', 1, seed=5)                           # 무너진 북서 모서리에 자란 고목(단 모서리를 덮는다)
s.sprite(im_, 40 * 16, 6 * 16 - im_.height, [(41, 5), (42, 5)], shadow=True); s.canopies.append((40 * 16, 6 * 16 - im_.height, im_.width, im_.height))
for y in range(3, 6):
    for x in range(40, 44): s.reserve(x, y, x, y)
# ================================================================ 거목(앵커 나무) — 밑동 줄만 막힘
GIANTS = [((1, 2, 6, 8), 19), ((2, 31, 6, 8), 21), ((3, 55, 6, 8), 31), ((4, 17, 6, 8), 47), ((5, 35, 6, 8), 13), ((6, 57, 6, 8), 47), ((7, 24, 5, 7), 26)]
giant_imgs = {}
for (sd, x0, wc, hc), by in GIANTS:
    im = A.giant_tree(sd, wc, hc, lean=(sd % 3 - 1) * 2)
    mid = [(x0 + wc // 2 - 1, by), (x0 + wc // 2, by)]
    s.sprite(im, x0 * 16, (by + 1) * 16 - im.height, mid, shadow=True)
    s.canopies.append((x0 * 16, (by + 1) * 16 - im.height, im.width, im.height))
    for y in range(by - 2, by + 1):
        for x in range(x0, x0 + wc): s.reserve(x, y, x, y)

# ================================================================ 숲 채우기 (깊은 숲길과 같은 방법: 빈 칸마다 나무·덤불)
NZ = value_noise(7103, W, H, 8)
def clear_above(x, y, w, h):
    for j in range(1, h):
        for i in range(w):
            yy = y - j
            if yy < 0: continue
            if s.track[yy][x + i] or (x + i, yy) in TERR or (x + i, yy) in PLAZA or s.water[yy][x + i]: return False
    return True
def mk_oak(kind, w, h, ancient=False):
    def f(s_, x, y):
        if x + w > W or not clear_above(x, y, w, h): return False
        if not all(s.cell_free(x + i, y, 0) for i in range(w)): return False
        if ancient:
            im = A.oak_ancient(kind, int(_hash(x, y, 5) * 4), seed=x * 7 + y)
            mid = [(x + w // 2 - 1, y), (x + w // 2, y)] if w % 2 == 0 else [(x + w // 2, y)]
            s.sprite(im, x * 16, (y + 1) * 16 - im.height, mid, shadow=True); s.canopies.append((x * 16, (y + 1) * 16 - im.height, im.width, im.height))
        else: s.tree(kind, x, y)
        for i in range(w): s.reserve(x + i, y, x + i, y)
        return True
    return f
def mk_bush(kind, w):
    def f(s_, x, y):
        if x + w > W: return False
        return s.put_tree(kind, x, y)
    return f
OA, OB, OAa, OBa = mk_oak('oakA', 4, 5), mk_oak('oakB', 3, 4), mk_oak('oakA', 4, 5, True), mk_oak('oakB', 3, 4, True)
BC, BD, BE = mk_bush('bushC', 2), mk_bush('bushD', 3), mk_bush('bushE', 2)
def fern_g(s_, x, y): return s.put(A.fern_giant(int(_hash(x, y, 9) * 50)), x, y, fw=2)
def boulder(s_, x, y): return s.put(A.boulder_moss(False, x + y), x, y)
def zone(x, y):
    t = NZ[y][x]
    if t > 0.6: return [OAa, OBa, OA, OB, BC, BD, fern_g]
    if t > 0.4: return [OA, OB, OBa, BC, BD, BE, fern_g]
    return [OA, OB, BC, BE, BD, OA, boulder]
order = [(x, y) for y in range(H) for x in range(W)]; rng.shuffle(order)
for (x, y) in order:
    if not s.cell_free(x, y, 0, margin=0): continue
    if any(s.track[yy][xx] for yy in range(max(0, y - 1), min(H, y + 2)) for xx in range(max(0, x - 1), min(W, x + 2))): continue   # 길 곁 1칸 비움
    near2 = any(s.track[yy][xx] for yy in range(max(0, y - 2), min(H, y + 3)) for xx in range(max(0, x - 2), min(W, x + 3)))
    if near2 and _hash(x, y, 31) < 0.5: continue                          # 길 둘째 칸은 반만 — 덤불이 길 따라 줄 서지 않게
    for _ in range(3):
        if rng.choice(zone(x, y))(s, x, y): break
for (x, y) in order:                                                   # 남은 틈: 덤불·고사리·바위
    if not s.cell_free(x, y, 0): continue
    if any(s.track[yy][xx] for yy in range(max(0, y - 2), min(H, y + 3)) for xx in range(max(0, x - 2), min(W, x + 3))): continue
    if rng.random() < 0.55: rng.choice([BC, BE, fern_g, boulder, BC])(s, x, y)

# ================================================================ 바닥 덮개 (걸음 소품) — 숲은 고사리·버섯·뿌리, 공터는 빛 버섯·종꽃
FERN = [P5.ALL['fern_' + k]() for k in 'abc']; TOAD = [P5.ALL['toadstools_' + k]() for k in 'abc']
GM = [A.glow_mushrooms(31 + i, 4 + i % 3) for i in range(4)]; GB = [A.glowbells(35 + i) for i in range(3)]
RT = [A.root_tangle(39 + i) for i in range(2)]
order2 = [(x, y) for y in range(H) for x in range(W)]; rng.shuffle(order2)
for (x, y) in order2:
    if s.track[y][x] or s.water[y][x] or s.block[y][x] or (x, y) in TERR or F_[y][x]: continue
    r = rng.random(); dx, dy = rng.randrange(-3, 4), rng.randrange(-3, 4)
    if (x, y) in GLADE_M:
        if r < 0.30: s.at(GM[rng.randrange(4)], x, y, block=None, dx=dx, dy=dy)
        elif r < 0.38: s.at(FERN[rng.randrange(3)], x, y, block=None, dx=dx, dy=dy)
    elif (x, y) in GLADE_S:
        if r < 0.20: s.at(GB[rng.randrange(3)], x, y, block=None, dx=dx, dy=dy)
        elif r < 0.27: s.at(FERN[rng.randrange(3)], x, y, block=None, dx=dx, dy=dy)
    elif (x, y) in PLAZA: pass
    elif (x, y) in s._occ() and not s.cell_free(x, y): continue
    else:
        if r < 0.30: s.at(FERN[rng.randrange(3)], x, y, block=None, dx=dx, dy=dy)
        elif r < 0.34 and NZ[y][x] > 0.5: s.at(TOAD[rng.randrange(3)], x, y, block=None, dx=dx, dy=dy)
        elif r < 0.36: s.at(GB[rng.randrange(3)], x, y, block=None, dx=dx, dy=dy)
        elif r < 0.40 and x + 1 < W: s.at(RT[rng.randrange(2)], x, y, block=None, dx=dx, dy=dy)

# ================================================================ 오토타일 덧그림: 이끼 번짐(단 발치·광장 둘레) · 낙엽 자리 · 낮은 옛 돌담
def lay_auto(sheet, cells, under=True):
    im = Image.new('RGBA', (W * 16, H * 16))
    on = lambda x, y: (x, y) in cells
    for (x, y) in cells:
        m = (1 if on(x, y - 1) else 0) | (2 if on(x + 1, y) else 0) | (4 if on(x, y + 1) else 0) | (8 if on(x - 1, y) else 0)
        im.alpha_composite(sheet.crop(((m % 4) * 16, (m // 4) * 16, (m % 4) * 16 + 16, (m // 4) * 16 + 16)), (x * 16, y * 16))
    if under: s.overlays.append((im, 0, 0))
    return im
MOSSC = {(x, y) for y in range(H) for x in range(W) if not s.track[y][x] and not s.water[y][x] and not F_[y][x] and (x, y) not in TERR
         and ((16 <= y <= 18 and 41 <= x <= 60 and vnoise(x, y, 2.5, 91) > 0.42))}
lay_auto(A.autotile_moss(), MOSSC)
LITC = {(x, y) for y in range(H) for x in range(W) if not s.track[y][x] and not s.water[y][x] and (x, y) not in TERR and (x, y) not in PLAZA
        and vnoise(x, y, 3.0, 93) > 0.66 and any(s.track[yy][xx] for yy in range(max(0, y - 2), min(H, y + 3)) for xx in range(max(0, x - 2), min(W, x + 3)))}
lay_auto(A.autotile_litter(), LITC)
WALLC = {(44, y) for y in (17, 18, 19)} | {(45, 17)} | {(57, y) for y in (17, 18)} | {(56, 17)} | {(55, 17)}
for (x, y) in WALLC: s.block[y][x] = True
s.top_overlays.append((lay_auto(A.autotile_ruinwall(), WALLC, under=False), 0, 0))

# ================================================================ 조각 저장
def save_parts():
    pt = A.wl.Parts(HERE)
    for f in os.listdir(pt.dir):
        if f.endswith('.png'): os.remove(os.path.join(pt.dir, f))
    T, O, D, AU = 'tree', 'object', 'decal', 'autotile'
    add = pt.add
    add('ground-forest', A.ground_forest(), 'floor', '숲 바닥', '버들항 그늘 풀(칩셋)에 낙엽·잔가지가 흩어진 고대 숲 바닥.', '숲 속 기본 바닥. 3x3 이상 덩이로 깐다. 공터는 밝은 잔디로 바꾸고 경계는 자연스럽게 섞는다.', pad=False)
    add('ground-loam', A.ground_loam(), 'floor', '숲 흙', '버들항 흙길 흙에 낙엽이 섞인 숲 흙 바닥.', '나무 밑·공터 가장자리의 맨흙. 길은 흙길 오토타일로 깔고 이 표본은 넓은 흙 면에만.', pad=False)
    add('ground-flag', A.ground_flag(), 'floor', '이끼 낀 판석', '버들항 광장 판석이 바래고 줄눈마다 이끼가 앉은 유적 바닥.', '유적 단 윗면·광장. 가장자리는 풀이 먹어 들어가게 들쭉날쭉 끊는다(네모 반듯한 판석 면 금지).', pad=False)
    add('face_ruin', A.face_ruin_sample(), 'wall', '옛 마름돌 벽면', '이끼가 흘러내린 옛 마름돌 옹벽 앞면(3칸 높이, 윗줄 이음돌).', '유적 단의 남쪽 앞면. 단 높이 한 층 = 앞면 3줄. 계단은 앞면을 뚫고 바닥 위에 놓는다. 옆면은 그리지 않는다.', pad=False)
    add('stairs-ruin', stair_part(), 'walk', '옛 돌계단', '단 앞면을 뚫고 내려오는 이끼 낀 돌계단(2칸 폭, 앞면 3줄).', '단 앞면(3줄)에 세로로 끼운다. 위 칸은 단 윗면, 아래 칸은 바닥 길과 잇는다.', pad=False)
    add('altar-stone', A.altar_stone(), O, '고대 제단', '받침단 위 돌 제단, 덮개돌 가운데 푸른 샘물 그릇, 앞면 번개무늬 띠.', '유적 가장 안쪽(제단 단 위) 한가운데에 하나. 아래 2줄 막힘. 앞(남쪽)에 계단이나 빈 칸을 둔다.', brows=2)
    add('pillar-ancient', A.pillar(4), O, '옛 기둥', '네모 받침·세로 홈·기둥머리가 남은 온전한 옛 대리석 기둥(1x4칸).', '유적 단·광장에 줄을 이루던 자리로 2~3칸 간격, 부러진 기둥·토막과 섞는다. 밑동 1칸만 막힘.', brows=1)
    add('pillar-broken-a', A.pillar(4, broken=22, seed=2), O, '부러진 기둥(높음)', '중간에서 부러져 단면(윗면 원판)이 보이는 옛 기둥.', '온전한 기둥 사이에 섞는다. 밑동 1칸만 막힘.', brows=1)
    add('pillar-broken-b', A.pillar(3, broken=12, seed=4), O, '부러진 기둥(낮음)', '받침 위 짧게 남은 기둥 밑동.', '단 가장자리·광장. 밑동 1칸만 막힘. 가까이에 기둥 토막을 눕힌다.', brows=1)
    add('pillar-drum', A.pillar_drum(), O, '쓰러진 기둥 토막', '옆으로 누운 기둥 토막, 끝 단면에 동심 고리.', '부러진 기둥 곁에 1~2개. 2칸 모두 막힘.', brows=1)
    add('arch-ruined', A.arch_ruined(), O, '무너진 아치 문', '마름돌 두 기둥에 아치가 반쯤 남은 옛 문(오른쪽 위가 무너짐).', '길이 가운데 2칸으로 지나가게 놓는다(유적 들머리). 양쪽 기둥 밑동 칸만 막힘, 가운데는 걸어서 지난다.', brows=1)
    add('statue-guardian', A.statue_guardian(2), O, '이끼 낀 수호상', '지팡이를 든 겉옷 차림 수호상(버들항 현자 동상을 옛 돌로), 받침에 덩굴.', '계단 위·문 양옆에 마주 보게 한 쌍(하나는 좌우 뒤집기). 아랫줄 막힘.', brows=1)
    add('blocks-fallen', A.blocks_fallen(2), O, '무너진 마름돌', '단에서 떨어진 마름돌 덩이 두 개(윗면 이끼).', '단 발치·벽 곁에 덩이로. 2칸 막힘.', brows=1)
    add('block-fallen-small', A.blocks_fallen(1, 4), O, '마름돌 한 덩이', '굴러 나온 마름돌 하나.', '큰 덩이 곁에 흩어 놓는다. 1칸 막힘.', brows=1)
    add('rubble', A.rubble(), D, '돌무더기', '깨진 돌 조각이 낮게 쌓인 무더기.', '단 발치·무너진 모서리. 낮아서 걸어 지나간다(사람 아래).')
    add('stele', A.stele(), O, '옛 비석', '위가 둥근 비석, 닳은 새김 두 줄.', '길 갈림·공터 들머리·유적 앞에 하나씩. 밑동 1칸 막힘.', brows=1)
    add('spring-basin', A.spring_basin(), O, '샘 돌확', '옛 마름돌 테 안에 맑은 샘물이 고인 넓은 수반.', '샘 공터 가운데·물가. 몸통 1줄 막힘(3칸). 둘레에 종꽃·이끼.', brows=1)
    add('brazier-stone', A.brazier_stone(), O, '푸른 혼불 화로', '네모 돌 기둥 위 그릇에 푸른 불이 타는 화로.', '제단·계단 양옆에 한 쌍. 밑동 1칸 막힘.', brows=1)
    add('giant-tree-a', A.giant_tree(1, 6, 8), T, '거목 A', '넓은 참나무 수관·이끼 낀 굵은 줄기·판근·늘어진 덩굴의 고대 거목(6x8칸).', '숲의 앵커. 한 화면에 1~2그루, 길·공터를 수관이 덮지 않게. 줄기 밑 2칸만 막히고 수관 아래는 뒤로 걸어 지난다.', brows=1)
    add('giant-tree-b', A.giant_tree(2, 6, 8, -2), T, '거목 B', '거목 A 와 다른 덩이 배치·줄기 기울기.', '거목 A 와 번갈아. 같은 거목을 나란히 두지 않는다.', brows=1)
    add('giant-tree-c', A.giant_tree(7, 5, 7), T, '거목 C(작음)', '조금 작은 고목(5x7칸).', '거목 사이 틈·숲 가장자리. 밑동 1줄만 막힘.', brows=1)
    add('ancient-oak-a', A.oak_ancient('oakA', 0), T, '이끼 참나무 A', '버들항 참나무(칩셋)에 이끼·덩굴을 얹은 고목.', '숲 채움 나무. 덩이로 심고(일렬 금지) 길 곁 1칸은 비운다. 밑동 1칸 막힘.', brows=1)
    add('ancient-oak-b', A.oak_ancient('oakB', 1), T, '이끼 참나무 B', '작은 참나무에 이끼·덩굴.', '참나무 A 와 섞는다. 밑동 1칸 막힘.', brows=1)
    add('tree-arch', A.tree_arch(), T, '고목 아치', '두 고목 줄기가 기울어 수관이 하나로 맞붙은 숲 들머리 아치(6x7칸, 가운데 2칸이 길).', '숲 입구 길 위에. 양쪽 줄기 밑 2칸씩만 막히고 가운데 2칸은 길로 지난다.', brows=1)
    add('stump-giant', A.stump_giant(), O, '거대한 그루터기', '나이테·썩은 속이 보이는 잘린 고목 밑동, 뿌리·이끼.', '공터 가운데 하나(앵커). 아랫줄 3칸 막힘.', brows=1)
    add('log-mossy', A.log_mossy(), O, '이끼 통나무', '이끼가 덮인 쓰러진 통나무(3칸), 끝 단면 나이테.', '길 곁 쉼터·공터 가장자리. 3칸 막힘. 일렬로 늘어놓지 않는다.', brows=1)
    add('boulder-moss', A.boulder_moss(), O, '이끼 바위', '윗면에 이끼가 앉은 둥근 바위 두 덩이(2x2칸).', '공터 둘레·물가에 덩이로. 아랫줄 막힘.', brows=1)
    add('boulder-moss-small', A.boulder_moss(False, 26), O, '작은 이끼 바위', '이끼 모자를 쓴 작은 바위(1칸).', '큰 바위 곁·숲 바닥. 1칸 막힘.', brows=1)
    add('glow-mushroom-big', A.glow_mushroom_big(), O, '큰 빛 버섯', '청록 빛이 도는 넓은 갓의 큰 버섯과 작은 버섯들.', '버섯 공터에만 1~3개. 아랫줄 막힘. 숲 전체에 뿌리지 않는다.', brows=1)
    add('glow-mushrooms-a', A.glow_mushrooms(31, 4), D, '빛 버섯 무리 A', '청록 빛 작은 버섯 무리(바닥 소품).', '버섯 공터·거목 밑에 덩이로. 걸어서 지난다.')
    add('glow-mushrooms-b', A.glow_mushrooms(32, 6), D, '빛 버섯 무리 B', '빛 버섯 무리(더 많음).', '버섯 무리 A 와 섞는다.')
    add('glowbells', A.glowbells(), D, '푸른 종꽃', '가는 줄기에 연푸른 종 꽃이 숙인 작은 덤불.', '샘 공터·물가에 덩이로, 숲 속엔 드물게. 걸어서 지난다.')
    add('fern-giant', A.fern_giant(), O, '큰 고사리', '깃꼴 잎 일곱 장의 큰 고사리 덤불(2x2칸).', '숲 바닥 나무 사이 틈. 아랫줄만 막힘, 위는 뒤로 지난다.', brows=1)
    add('root-tangle', A.root_tangle(), D, '드러난 뿌리', '땅 위로 드러나 얽힌 뿌리 세 가닥.', '거목 곁·길가 숲 바닥. 걸어서 넘는다(사람 아래).')
    add('autotile-moss', A.autotile_moss(), AU, '이끼 번짐', '풀·판석 위로 번진 이끼 덩이(16변형, 투명 가장자리).', '아래층 덧그림, 걸음. 유적 발치·공터에 3칸 이상 덩이로 칠한다.', layer='lower', role='terrain')
    add('autotile-litter', A.autotile_litter(), AU, '낙엽 자리', '낙엽이 쌓인 자리(16변형, 가장자리는 낙엽이 성기게 흩어짐).', '아래층 덧그림, 걸음. 숲길 곁·나무 밑에 덩이로.', layer='lower', role='terrain')
    add('autotile-ruinwall', A.autotile_ruinwall(), AU, '낮은 옛 돌담', '이끼 앉은 마름돌 낮은 담(16변형, 윗면+앞면). 모든 변형 막힘.', '위층, 모든 변형 막힘. 유적 둘레에 끊긴 마디로(닫힌 네모 금지).', layer='upper', role='fence')
    return pt.finish('고대 숲 (재작업 2: 버들항 질감 기준)')

def stair_part():
    big = Image.new('RGBA', (32, 64)); bp = big.load(); terrain.stair(bp, 0, 1, 2)
    big = big.crop((0, 13, 32, 61))
    q = big.load()
    for y in range(big.height):
        for x in range(big.width):
            if q[x, y][3] and vnoise(x, y, 3, 95) > 0.66 and (x < 5 or x > 26 or y % 5 == 0): q[x, y] = A.MOSS[2 + (x + y) % 2] + (255,)
            elif q[x, y][3]: q[x, y] = A.weather(q[x, y][:3], 1) + (255,)
    return big

# ================================================================ 실행
if __name__ == '__main__':
    im = s.render()
    reach = s.bfs(s.marks['entrance'])
    miss = {k: v for k, v in s.marks.items() if v not in reach}
    dens = s.density()
    print('size', im.size, 'unreached', miss or 'none', 'density(max window, at, all)', round(dens[0], 3), dens[1], round(dens[2], 3))
    n = s.save(HERE, extra_grid={'reach_from_entrance': {k: (v in reach) for k, v in s.marks.items()}, 'density_max_window': [round(float(dens[0]), 3), list(dens[1])]})
    print('parts', save_parts())
