# 원시 시대 마을 + 화산 계곡 입구 (prehistoric-village) — 72x52 필드. 다시 돌리면 같은 그림.   python3 make_prehistoric_village.py
# 버들항 파이프라인(_lib-5/bd5.Scene = city_v6 잔디·물·절벽·그림자)으로 깔고, 새 조각은 pv_dwell / pv_props / pv_flora / pv_ground.
# 동선: 남쪽 어귀(엄니 문) → 마당 → 모닥불 광장 → 토템 사이 북쪽 길 → 개울 징검돌 → 북쪽 둑 → 화산 계곡 어귀(돌탑 한 쌍) → 산 밑동.
# 곁길: 마당 서쪽 → 고사리 숲 공룡 뼈 발굴터 / 마당 동쪽 → 벽화 바위.
import os, sys, json, math, random
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from pv_base import *
import pv_dwell as PD, pv_props as PR, pv_flora as PF, pv_ground as PG
import plains_pieces as PP                # 초원 하이로드 바위·돌무더기(지도에만 쓰고 다시 내보내지 않는다)
import vf_pieces as VP, vf_mountain as VM # 화산 지대 필드 산·연기·현무암·김(지도에만 쓰고 다시 내보내지 않는다)
from vf_base import recolor_tile
from scipy import ndimage as ndi
from pv_meta import META

W, H = 72, 52
rng = random.Random(7201)
s = Scene('prehistoric-village', W, H, seed=72)


def grid(v=False): return [[v] * W for _ in range(H)]
DIRT, YARD, FENCE, ASH, DARK, LITTER = grid(), grid(), grid(), grid(), grid(), grid()


def rect(g, x0, x1, y0, y1, v=True):
    for y in range(max(0, y0), min(H - 1, y1) + 1):
        for x in range(max(0, x0), min(W - 1, x1) + 1): g[y][x] = v


def ell(g, cx, cy, rx, ry, seed, jag=0.25, v=True):
    for y in range(H):
        for x in range(W):
            d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2
            if d < 1 + (vnoise(x, y, 2.5, seed) - 0.5) * jag * 2: g[y][x] = v


# ---------------------------------------------------------------- 높이: 북쪽 고원(높이 1) + 가운데 화산 분지(높이 0)
BX0, BX1 = 27, 44                                     # 분지(산 밑) 동서 끝
def edge_of(x):
    return 9 + int(round(1.1 * math.sin(x / 5.1 + 0.4) + 0.7 * math.sin(x / 2.3 + 1.7)))
EDGE = [edge_of(x) for x in range(W)]
for x in range(W):
    inb = BX0 <= x <= BX1
    for y in range(H):
        if not inb and y <= EDGE[x]: s.lev[y][x] = 1
# 분지 어귀 좁히기: 분지 양옆 두 칸은 고원이 조금 더 내려온다(계곡 어귀 목)
for x in (BX0, BX0 + 1, BX1 - 1, BX1):
    for y in range(0, 6): s.lev[y][x] = 1
F_ = terrain.faces(s.lev)

# ---------------------------------------------------------------- 개울(서→동 전 폭, 폭 2) + 징검돌
def sy_of(x):
    if 31 <= x <= 40: return 19
    return 19 + int(round(1.3 * math.sin(x / 6.3 + 0.9)))
SY = [sy_of(x) for x in range(W)]
for x in range(W):
    for y in (SY[x], SY[x] + 1):
        s.water[y][x] = True; s.nat[y][x] = True; s.flow[y][x] = 'W'
    if x > 0 and SY[x] != SY[x - 1]:
        for y in range(min(SY[x - 1], SY[x]), max(SY[x - 1], SY[x]) + 2): s.water[y][x] = True; s.nat[y][x] = True; s.flow[y][x] = 'W'
STONES = [(35, 19, 'b'), (35, 20, 'a')]
WALK_FORCE = {(x, y) for (x, y, _) in STONES}

# ---------------------------------------------------------------- 길·마당
ell(YARD, 36.0, 34.2, 13.6, 7.4, 11, 0.20)
for y in range(H):
    for x in range(W):
        if YARD[y][x] and (y < 27 or y > 42): YARD[y][x] = False
rect(DIRT, 35, 37, 45, H - 1)                          # 남쪽 어귀 → 엄니 문
rect(DIRT, 35, 36, 41, 44)                             # 엄니 문 → 마당 남쪽
rect(DIRT, 35, 36, 22, 27)                             # 마당 북쪽 → 개울
rect(DIRT, 35, 36, 13, 18)                             # 북쪽 둑 → 계곡 어귀
for y in range(39, 41):                                 # 서쪽 곁길(마당 → 공룡 뼈 발굴터): 한 칸씩 굽는다
    for x in range(10, 24): DIRT[y][x] = True
for (x, y) in ((16, 41), (17, 41), (13, 38), (14, 38), (10, 41), (11, 41)): DIRT[y][x] = True
for (x, y) in ((16, 39), (17, 39)): DIRT[y][x] = False
for y in range(34, 36):                                 # 동쪽 곁길(마당 → 벽화 바위)
    for x in range(49, 60): DIRT[y][x] = True
for (x, y) in ((54, 33), (55, 33), (56, 36), (57, 36), (52, 35)): DIRT[y][x] = not DIRT[y][x] if (x, y) == (52, 35) else True
for y in range(H):
    for x in range(W):
        if YARD[y][x] or s.water[y][x]: DIRT[y][x] = False
ROAD = [[DIRT[y][x] or YARD[y][x] for x in range(W)] for y in range(H)]

# 땅 덮개 마스크: 분지·북쪽 둑 어귀 화산재, 숲 바닥 고사리 낙엽, 마을 둘레·발굴터 짙은 흙
for y in range(H):
    for x in range(W):
        if BX0 - 1 <= x <= BX1 + 1 and y <= 15 and s.lev[y][x] == 0: ASH[y][x] = True
ell(ASH, 35.5, 16.5, 8.5, 2.2, 31, 0.35)
ell(LITTER, 6.0, 31.0, 7.5, 9.0, 32, 0.3); ell(LITTER, 7.0, 48.5, 8.0, 3.2, 33, 0.3); ell(LITTER, 66.0, 27.0, 6.5, 4.6, 34, 0.3)
ell(LITTER, 64.0, 46.0, 7.5, 4.5, 35, 0.3)
ell(DARK, 6.0, 43.0, 6.4, 3.6, 36, 0.3)                # 공룡 뼈 발굴터
ell(DARK, 62.5, 37.0, 5.5, 3.0, 37, 0.3)               # 벽화 바위 앞
ell(DARK, 20.0, 34.5, 5.0, 3.6, 38, 0.3); ell(DARK, 52.5, 37.0, 4.6, 4.4, 39, 0.3); ell(DARK, 36, 46.5, 4.0, 1.6, 40, 0.4)
for g_ in (ASH, LITTER, DARK):
    for y in range(H):
        for x in range(W):
            if s.water[y][x] or F_[y][x] or s.lev[y][x] == 1: g_[y][x] = False
for y in range(H):
    for x in range(W):
        if ASH[y][x]: LITTER[y][x] = DARK[y][x] = False
        if DARK[y][x]: LITTER[y][x] = False

# ---------------------------------------------------------------- 점유 / 놓기
OCC = set(); COUNT = {}
def occupy(x0, y0, x1, y1):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1): OCC.add((x, y))
def terrain_ok(x, y, allow_road=False, lev=None):
    if not (0 <= x < W and 0 <= y < H): return False
    if (x, y) in OCC or FENCE[y][x] or s.water[y][x] or F_[y][x]: return False
    if lev is not None and s.lev[y][x] != lev: return False
    if not allow_road and ROAD[y][x]: return False
    return True
def near_road(x, y, r=1):
    for j in range(-r, r + 1):
        for i in range(-r, r + 1):
            xx, yy = x + i, y + j
            if 0 <= xx < W and 0 <= yy < H and (ROAD[yy][xx] or s.water[yy][xx]): return True
    return False
def put(img, cx, cy, name, block=None, canopy_rows=0, base_w=None, margin=0, allow_road=False, shadow=None, dx=0, dy=0, sorty=None, lev=None):
    """img 바닥 왼쪽 칸 (cx,cy). block: 막을 칸 (i,j) 목록(기본 밑줄 전체). 성공 True."""
    wc = (img.width + 15) // 16; hc = (img.height + 15) // 16; bw = base_w or wc
    if cx < 0 or cx + wc > W or cy - hc + 1 < 0 or cy >= H: return False
    lv = s.lev[cy][cx] if lev is None else lev
    for i in range(bw):
        if not terrain_ok(cx + i, cy, allow_road, lv): return False
        if margin and near_road(cx + i, cy, margin): return False
    for j in range(1, min(canopy_rows, hc)):
        for i in range(wc):
            if ROAD[cy - j][cx + i] or (cx + i, cy - j) in OCC or F_[cy - j][cx + i]: return False
    if block is None: block = [(i, 0) for i in range(bw)]
    s.at(img, cx, cy, block=block, dx=dx, dy=dy, shadow=shadow, sorty=sorty)
    occupy(cx, cy - max(0, canopy_rows - 1), cx + bw - 1, cy)
    COUNT[name] = COUNT.get(name, 0) + 1
    return True
def deco(img, cx, cy, name, dx=0, dy=0, allow_road=False, lev=None):
    wc = (img.width + 15) // 16
    lv = s.lev[cy][cx] if (lev is None and 0 <= cy < H and 0 <= cx < W) else lev
    for i in range(wc):
        if not terrain_ok(cx + i, cy, allow_road, lv): return False
    s.at(img, cx, cy, block=None, dx=dx, dy=dy, shadow=False)
    COUNT[name] = COUNT.get(name, 0) + 1
    return True
def solid(img, cx, cy, name, rows, wide=None, extra=(), free=(), shadow=True, dy=0):
    """집·천막: 그림 왼쪽 아래 칸 (cx,cy). 아래 rows 줄이 막히고 위(지붕)는 걷기+가림."""
    wc = wide or img.width // 16; hc = (img.height + 15) // 16
    bl = [(i, -j) for i in range(wc) for j in range(rows) if (i, -j) not in free] + list(extra)
    s.at(img, cx, cy, block=bl, shadow=shadow, dy=dy)
    occupy(cx, cy - hc + 1, cx + wc - 1, cy)
    COUNT[name] = COUNT.get(name, 0) + 1

_G = {}
def g(n):
    if n not in _G:
        for mod in (PD, PR, PF):
            if hasattr(mod, n): _G[n] = pad16(getattr(mod, n)()); break
    return _G[n]
def flip(n):
    k = n + '#f'
    if k not in _G: _G[k] = g(n).transpose(Image.FLIP_LEFT_RIGHT)
    return _G[k]

# ---------------------------------------------------------------- 앵커 1: 화산 계곡 어귀 (북쪽 가운데)
MTN = VM.crater_mountain(); SMOKE = VM.smoke_column()
mx = BX0 * 16; my = 12 * 16 - MTN.height
s.sprite(MTN, mx, my, [], shadow=False, sorty=12 * 16 - 40)
a = np.array(MTN)[..., 3] > 128
for cy in range(12):
    for cx in range(18):
        blk = a[cy * 16:(cy + 1) * 16, cx * 16:(cx + 1) * 16].mean() > 0.45
        if blk: s.block[cy][BX0 + cx] = True; OCC.add((BX0 + cx, cy))
s.top_overlays.append((SMOKE, mx + 144 - SMOKE.width // 2 + 6, max(-40, my - SMOKE.height + 26)))
s.marks['valley_mouth'] = (35, 13)
put(g('ochre_cairn'), 33, 15, 'ochre_cairn', block=[(0, 0)], allow_road=False)
put(flip('ochre_cairn'), 38, 15, 'ochre_cairn', block=[(0, 0)], allow_road=False)
# 분지 둘레 현무암·김·용암 틈(화산 지대 필드 조각 재사용)
BAS = [VP.basalt_boulder(), VP.basalt_columns_low(), VP.basalt_rocks(), VP.obsidian_cluster()]
for (x, y, k) in ((28, 12, 0), (29, 15, 2), (42, 12, 1), (40, 15, 2), (31, 13, 3), (43, 15, 0)):
    put(BAS[k], x, y, 'basalt', block=[(0, 0), (1, 0)] if BAS[k].width > 16 else [(0, 0)])
for (x, y) in ((32, 11), (39, 12)): deco(VP.fumarole_crack(), x, y, 'fumarole')
for (x, y) in ((30, 10), (40, 10), (37, 11)): s.top_overlays.append((VP.steam_wisp(), x * 16, (y + 1) * 16 - 32))
deco(VP.sulfur_vent(), 34, 11, 'sulfur_vent') if False else None

# ---------------------------------------------------------------- 앵커 2: 모닥불 광장(마당 한가운데)
solid(g('hearth_spit'), 34, 34, 'hearth_spit', 1, extra=[(1, -1)])
s.marks['hearth'] = (35, 35)
put(g('stone_seat'), 30, 35, 'stone_seat', allow_road=True)
put(flip('stone_seat'), 39, 33, 'stone_seat', allow_road=True)
put(g('stone_seat'), 32, 38, 'stone_seat', allow_road=True)
put(g('meat_rack'), 39, 38, 'meat_rack', block=[(0, 0), (1, 0), (2, 0)], allow_road=True)
deco(g('bone_pile'), 42, 39, 'bone_pile', allow_road=True)
put(g('hide_frame'), 27, 40, 'hide_frame', allow_road=True)
put(flip('hide_frame'), 45, 36, 'hide_frame', allow_road=True)
put(g('pottery_group'), 28, 32, 'pottery_group', allow_road=True)
put(g('firewood_pile'), 31, 31, 'firewood_pile', allow_road=True)
put(g('hide_drum'), 38, 36, 'hide_drum', block=[(0, 0)], allow_road=True)
put(g('quern_stone'), 30, 38, 'quern_stone', allow_road=True)
put(g('totem_carved'), 33, 28, 'totem_carved', block=[(0, 0)], allow_road=True)
put(g('totem_bone'), 38, 28, 'totem_bone', block=[(0, 0)], allow_road=True)
s.marks['plaza'] = (36, 31)

# ---------------------------------------------------------------- 앵커 3: 가죽·뼈대 천막과 움집(마당 둘레, 문은 남쪽 = 마당 쪽)
solid(g('hide_tent_large'), 24, 30, 'hide_tent_large', 2); s.marks['tent_w'] = (25, 31)
solid(g('pit_house_large'), 40, 29, 'pit_house_large', 2); s.marks['pit_n'] = (42, 30)
solid(g('hide_tent_small'), 45, 31, 'hide_tent_small', 2); s.marks['tent_ne'] = (46, 32)
solid(g('pit_house_small'), 17, 37, 'pit_house_small', 2); s.marks['pit_w'] = (18, 38)
solid(flip('hide_tent_small'), 20, 33, 'hide_tent_small', 2); s.marks['tent_w2'] = (20, 34)
solid(flip('hide_tent_large'), 51, 32, 'hide_tent_large', 2); s.marks['tent_e'] = (52, 33)
solid(g('pit_house_small'), 54, 41, 'pit_house_small', 2); s.marks['pit_se'] = (55, 42)
put(g('fur_bedding'), 27, 31, 'fur_bedding', block=[], allow_road=True)
put(g('storage_jar'), 44, 29, 'storage_jar', block=[(0, 0)])
put(g('storage_jar'), 16, 37, 'storage_jar', block=[(0, 0)])
put(g('spear_rack'), 22, 37, 'spear_rack', allow_road=True)
put(g('campfire_small'), 50, 38, 'campfire_small', allow_road=True)
put(g('firewood_pile'), 57, 40, 'firewood_pile')
put(g('pottery_group'), 21, 31, 'pottery_group') if False else None

# ---------------------------------------------------------------- 남쪽 어귀: 엄니 문 + 뾰족 말뚝 울타리(군데군데 무너짐)
solid(g('tusk_arch'), 34, 46, 'tusk_arch', 1, wide=5, free=[(1, 0), (2, 0), (3, 0)])
s.marks['south_gate'] = (36, H - 1)
for x in list(range(19, 34)) + list(range(39, 55)): FENCE[46][x] = True
for y in range(40, 47): FENCE[y][19] = True; FENCE[y][54] = True
for (x, y) in ((25, 46), (26, 46), (47, 46), (19, 42), (54, 44)): FENCE[y][x] = False      # 무너진 자리
for y in range(H):
    for x in range(W):
        if ROAD[y][x] or (x, y) in OCC: FENCE[y][x] = False
s.marks['fence_gap_w'] = (25, 47)

# ---------------------------------------------------------------- 앵커 4: 공룡 뼈 발굴터(서쪽 고사리 숲)
put(g('dino_skeleton'), 2, 44, 'dino_skeleton', block=[(i, 0) for i in range(6)] + [(i, -1) for i in range(1, 5)])
put(g('horned_skull'), 8, 47, 'horned_skull', block=[(0, 0), (1, 0), (2, 0)])
put(g('bone_pile'), 9, 42, 'bone_pile', block=[]) if False else deco(g('bone_pile'), 8, 42, 'bone_pile')
s.marks['dig_site'] = (9, 40)
put(g('beetle_husk'), 12, 27, 'beetle_husk')
s.marks['beetle'] = (13, 28)

# ---------------------------------------------------------------- 앵커 5: 벽화 바위(동쪽)
put(g('painted_rock'), 60, 36, 'painted_rock', block=[(i, 0) for i in range(4)] + [(i, -1) for i in range(4)])
put(g('painted_stone'), 65, 38, 'painted_stone')
put(g('ochre_bowls'), 59, 37, 'ochre_bowls', allow_road=True)
s.marks['painted_rock'] = (61, 37)
# 절벽 앞면 벽화(분지 서쪽·동쪽 절벽)
for (x0, side) in ((21, 'w'), (49, 'e')):
    fy = EDGE[x0] + 1
    s.overlays_paint = getattr(s, 'overlays_paint', [])
    s.overlays_paint.append((g('cliff_paint') if side == 'w' else flip('cliff_paint'), x0 * 16, fy * 16 + 6))

# ---------------------------------------------------------------- 숲(고사리·소철): 고원 위 빽빽한 숲 + 서·동 낮은 숲 + 개울가
def mk(name, block, base_w=None, canopy=0, lev=None, flipok=True):
    def f(x, y):
        im = flip(name) if (flipok and H(x, y, 7) > 0.5) else g(name)
        return put(im, x, y, name, block=block, base_w=base_w, canopy_rows=canopy, lev=lev)
    return f
TF = mk('tree_fern_tall', [(1, 0)], base_w=3); TS = mk('tree_fern_short', [(1, 0)], base_w=3)
CY = mk('cycad_large', [(1, 0)], base_w=3); CYy = mk('cycad_young', [(0, 0), (1, 0)])
FC = mk('fern_clump', [(0, 0), (1, 0)])
def FS(x, y): return deco(g('fern_small') if H(x, y, 3) > 0.5 else flip('fern_small'), x, y, 'fern_small')
def HT(x, y): return deco(g('horsetail'), x, y, 'horsetail')
def RD(x, y): return deco(g('reeds'), x, y, 'reeds')
def ROCK(x, y): return put(PP.rockpile(), x, y, 'rockpile', block=[(0, 0), (1, 0)])
def BOUL(x, y): return put(PP.boulder(), x, y, 'boulder', block=[(0, 0), (1, 0)])
def cluster(cx, cy, rx, ry_, n, makers, tries=16, ymin=2):
    placed = 0
    for _ in range(n * tries):
        if placed >= n: break
        a_ = rng.random() * 6.2832; d = math.sqrt(rng.random())
        x = int(round(cx + math.cos(a_) * rx * d)); y = int(round(cy + math.sin(a_) * ry_ * d))
        if not (0 <= x < W and ymin <= y < H): continue
        if rng.choice(makers)(x, y): placed += 1
    return placed
BIG = [TF, TS, CY, TS, CY]
LOW = [FC, CYy, FC]
# 고원 숲(맨 위 가장자리에서 수관이 잘리지 않게 밑동 4줄 아래부터)
for (cx, cy, rx, ry_, n) in ((5, 7, 6, 3, 7), (16, 7, 6, 3, 6), (23, 8, 3, 2, 3), (52, 7, 4, 3, 4), (61, 7, 6, 3, 6), (69, 7, 3, 3, 3)):
    cluster(cx, cy, rx, ry_, n, BIG, ymin=4)
for (cx, cy, rx, ry_, n) in ((10, 8, 9, 2, 6), (58, 8, 10, 2, 6), (24, 9, 3, 1, 2), (47, 9, 2, 1, 2)):
    cluster(cx, cy, rx, ry_, n, LOW + [FS], ymin=3)
# 서쪽 낮은 숲·남서·동쪽 숲
for (cx, cy, rx, ry_, n, mks) in ((5, 28, 5, 5, 8, BIG), (13, 33, 3, 3, 3, BIG), (4, 37, 3, 2, 2, BIG), (14, 46, 3, 3, 3, BIG), (5, 50, 5, 1.5, 4, BIG),
                                   (27, 50, 6, 1.5, 4, BIG), (45, 50, 6, 1.5, 4, BIG), (62, 49, 8, 2.5, 6, BIG), (66, 28, 5, 4, 6, BIG),
                                   (68, 41, 3, 4, 4, BIG), (57, 25, 3, 2, 3, BIG), (23, 25, 4, 2, 3, BIG), (49, 25, 2, 1.5, 2, BIG)):
    cluster(cx, cy, rx, ry_, n, mks)
for (cx, cy, rx, ry_, n) in ((9, 34, 6, 6, 7), (12, 49, 4, 2, 3), (60, 44, 6, 3, 5), (66, 33, 4, 3, 4), (30, 48, 4, 1.5, 3), (44, 48, 4, 1.5, 3),
                              (57, 30, 3, 2, 3), (16, 26, 4, 2, 3), (29, 25, 3, 1.5, 2), (44, 25, 3, 1.5, 2)):
    cluster(cx, cy, rx, ry_, n, LOW + [FS, FS])
# 개울가: 부들·속새·작은 고사리 + 바위
for x in range(0, W):
    for yy in (SY[x] - 1, SY[x] + 2):
        if 33 <= x <= 38: continue
        r_ = H(x, yy, 11)
        if r_ < 0.26: RD(x, yy)
        elif r_ < 0.40: HT(x, yy)
        elif r_ < 0.48: FS(x, yy)
cluster(18, 16, 6, 1.5, 3, [ROCK, BOUL, FC]); cluster(54, 16, 6, 1.5, 3, [ROCK, BOUL, FC])
cluster(8, 15, 6, 1.5, 4, [FC, CYy, ROCK]); cluster(63, 15, 6, 1.5, 4, [FC, CYy, ROCK])
cluster(24, 15, 2, 1, 2, [CYy, FC]); cluster(47, 15, 2, 1, 2, [CYy, FC])

# ---------------------------------------------------------------- 빈 바닥 채우기(고사리·속새 덩이)
FILL = set(); _ALPHA = {}
DECAL_NAMES = {'fern_small', 'horsetail', 'reeds', 'bone_pile', 'fur_bedding', 'fumarole'}
def cov_grid():
    cov = np.zeros((H, W))
    for (sy_, x, y, im, sh) in s.objs:
        if id(im) not in _ALPHA: _ALPHA[id(im)] = np.array(im)[:, :, 3] > 128
        a_ = _ALPHA[id(im)]; h, w = a_.shape
        for cy in range(max(0, y // 16), min(H, (y + h - 1) // 16 + 1)):
            for cx in range(max(0, x // 16), min(W, (x + w - 1) // 16 + 1)):
                x0, y0 = max(cx * 16, x), max(cy * 16, y); x1, y1 = min(cx * 16 + 16, x + w), min(cy * 16 + 16, y + h)
                if x1 > x0 and y1 > y0: cov[cy, cx] = max(cov[cy, cx], a_[y0 - y:y1 - y, x0 - x:x1 - x].sum() / 256.0)
    return cov
def empty_cells():
    cov = cov_grid(); e = np.zeros((H, W), bool)
    for y in range(H):
        for x in range(W):
            e[y, x] = not (cov[y, x] >= 0.2 or ROAD[y][x] or FENCE[y][x] or s.water[y][x] or F_[y][x] or (x, y) in FILL or ASH[y][x] or DARK[y][x])
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
            if rng.random() < 0.40:
                pk = rng.random()
                if pk < 0.55: FS(x, y)
                elif pk < 0.8: HT(x, y)
                else: deco(PP.tallgrass_a() if rng.random() < 0.5 else PP.tallgrass_b(), x, y, 'tallgrass', dx=rng.randrange(-2, 3))
    return n
for it in range(200):
    e = empty_cells(); r_, wx, wy = worst_window(e, 1)
    if r_ <= 0.36: print('fill iterations', it, 'worst', round(float(r_), 3)); break
    best = None
    for y in range(wy + 2, wy + 13):
        for x in range(wx + 2, wx + 18):
            if e[y, x]:
                sc = e[max(0, y - 2):y + 3, max(0, x - 2):x + 3].sum()
                if best is None or sc > best[0]: best = (sc, x, y)
    if best is None: break
    _, bx_, by_ = best
    pk = rng.random()
    if pk < 0.6: n = meadow(bx_, by_, rng.uniform(1.6, 2.8))
    elif pk < 0.85: n = cluster(bx_, by_, 2.4, 1.6, 2, LOW + BIG[:2])
    else: n = cluster(bx_, by_, 2.4, 1.6, 1, [ROCK, BOUL])
    if n == 0: OCC.add((bx_, by_)); FILL.add((bx_, by_))

# ---------------------------------------------------------------- 바닥 덮개 → 길·마당 오토타일 → 울타리 → 징검돌
SHEETS = {'path': PG.autotile_dirtpath(), 'yard': PG.autotile_yardedge(), 'stake': PG.autotile_stakefence()}
def nbits(mask, x, y, join=None):
    def on(xx, yy): return 0 <= xx < W and 0 <= yy < H and (mask[yy][xx] or (join is not None and join[yy][xx]))
    return (1 if on(x, y - 1) else 0) | (2 if on(x + 1, y) else 0) | (4 if on(x, y + 1) else 0) | (8 if on(x - 1, y) else 0)
def mpx(m): return np.kron(np.array(m, bool), np.ones((16, 16), bool))
s.overlays.append((PG.ground_layer('fernlitter', mpx(LITTER), 41), 0, 0))
s.overlays.append((PG.ground_layer('darkearth', mpx(DARK), 42, edge='tuft'), 0, 0))
s.overlays.append((PG.ground_layer('ashgrit', mpx(ASH), 43), 0, 0))
road_im = blank(W * 16, H * 16)
WJ = [[s.water[y][x] or (x, y) in WALK_FORCE for x in range(W)] for y in range(H)]
for y in range(H):
    for x in range(W):
        if YARD[y][x]: road_im.alpha_composite(cell_of(SHEETS['yard'], nbits(YARD, x, y)), (x * 16, y * 16))
JOIN_D = [[YARD[y][x] or WJ[y][x] for x in range(W)] for y in range(H)]
for y in range(H):
    for x in range(W):
        if DIRT[y][x]:
            n = nbits(DIRT, x, y, JOIN_D)
            if y == H - 1: n |= 4
            road_im.alpha_composite(cell_of(SHEETS['path'], n), (x * 16, y * 16))
s.overlays.append((road_im, 0, 0))
for y in range(H):
    for x in range(W):
        if FENCE[y][x]:
            s.sprite(cell_of(SHEETS['stake'], nbits(FENCE, x, y)), x * 16, y * 16, [(x, y)], shadow=False, sorty=y * 16 + 16)
for (x, y, k) in STONES:
    s.sprite(g('stepping_stone_' + k), x * 16, y * 16, [], shadow=False, sorty=y * 16 + 1)
def road_px(): return mpx(ROAD) | mpx(DARK)
s.road_px = road_px

# ---------------------------------------------------------------- 절벽: 버들항 절벽(앞면 3줄·갈빗대 결·윗턱)을 그린 뒤 밝기 순위로 응회암·현무암 지층에 옮긴다(윗턱 풀은 그대로)
_orig_render = terrain.render
def volcanic_cliffs(E, masonry=None, stairs=(), falls=(), frame=0):
    im = _orig_render(E, masonry, stairs, falls, frame)
    a = np.array(im).astype(np.float64)
    Fk = np.kron(np.array(terrain.faces(E)), np.ones((16, 16), int))
    Y, X = np.mgrid[0:H * 16, 0:W * 16]
    fy = (Y % 16) + (Fk - 1) * 16
    face = (a[..., 3] > 0) & (Fk > 0)
    l = 0.30 * a[..., 0] + 0.59 * a[..., 1] + 0.11 * a[..., 2]
    lo_, hi_ = np.percentile(l[face], 3), np.percentile(l[face], 97)
    t = np.clip(np.rint(0.7 + (l - lo_) / max(1, hi_ - lo_) * 4.9), 1, 6).astype(int)
    from vf_base import smooth, P as VPAL
    wob = (smooth(W * 16, H * 16, 18, 5) - 0.5) * 6
    mid = 20 + wob * 1.4; th = 6 + smooth(W * 16, H * 16, 24, 6) * 5
    tuff = face & ~((fy >= mid) & (fy < mid + th))           # 붉은 응회암이 바탕, 가운데 출렁이는 현무암 띠 하나
    bas = face & ~tuff
    out = a.copy()
    out[..., :3] = np.where(tuff[..., None], VPAL('tuff')[np.clip(t, 1, 6)], out[..., :3])
    out[..., :3] = np.where(bas[..., None], VPAL('basalt')[np.clip(t, 1, 6)], out[..., :3])
    e1 = face & (fy >= mid - 1) & (fy < mid); out[e1, :3] = VPAL('basalt')[1]
    e2 = face & (fy >= mid + th) & (fy < mid + th + 1); out[e2, :3] = VPAL('tuff')[5]
    res = Image.fromarray(out.astype(np.uint8), 'RGBA')
    for im_, x_, y_ in getattr(s, 'overlays_paint', []): res.alpha_composite(im_, (x_, y_))
    return res
terrain.render = volcanic_cliffs


# ---------------------------------------------------------------- 통행 · 저장
_wg = s.walk_grid
def walk_grid():
    wg = _wg()
    for (x, y) in WALK_FORCE: wg[y][x] = True
    for y in range(H):
        for x in range(W):
            if FENCE[y][x]: wg[y][x] = False
    return wg
s.walk_grid = walk_grid


def run():
    im = s.render()
    reach = s.bfs(s.marks['south_gate'], s.walk_grid())
    res = {k: (tuple(v) in reach) for k, v in s.marks.items()}
    e = empty_cells(); w = worst_window(e, 1)
    return im, res, (float(w[0]), (w[1], w[2]), float(e.mean())), reach


def part_img(n):
    if n.startswith('autotile-'): return {'autotile-dirtpath': SHEETS['path'], 'autotile-yardedge': SHEETS['yard'], 'autotile-stakefence': SHEETS['stake']}[n], False
    if n.startswith('ground-'): return PG.ground_sample(n[7:]), False
    return g(n), True


def export(im, res, dens):
    Pq = wl.Parts(HERE)
    for f in os.listdir(Pq.dir):
        if f.endswith('.png'): os.remove(os.path.join(Pq.dir, f))
    for n, md in META.items():
        img, pad = part_img(n)
        Pq.add(n, img, md['kind'], md['ko'], md['desc'], md['rules'], md.get('brows'), md.get('layer'), md.get('role'), pad=pad)
    cnt = Pq.finish('원시 시대 마을 + 화산 계곡 (prehistoric-village)')
    im.convert('RGB').save(HERE + '/render-1x.png')
    im.convert('RGB').resize((im.width * 2, im.height * 2), Image.NEAREST).save(HERE + '/render-2x.png')
    wg = s.walk_grid()
    json.dump({'w': W, 'h': H, 'tile': 16, 'rows': [''.join('.' if wg[y][x] else '#' for x in range(W)) for y in range(H)],
               'legend': {'.': 'walkable', '#': 'blocked'}, 'levels': [''.join(str(s.lev[y][x]) for x in range(W)) for y in range(H)],
               'marks': {k: list(v) for k, v in s.marks.items()}, 'reach_from_south_gate': res,
               'empty_window': [dens[0], list(dens[1])], 'empty_mean': dens[2], 'count': COUNT},
              open(HERE + '/grid.json', 'w'), ensure_ascii=False)
    return cnt


if __name__ == '__main__':
    im, res, dens, reach = run()
    print(im.size, 'reach all', all(res.values()), {k: v for k, v in res.items() if not v}, 'density', dens)
    print(COUNT)
    os.makedirs(HERE + '/_look', exist_ok=True)
    if '--no-export' not in sys.argv: print('parts', export(im, res, dens))
    else: im.convert('RGB').save(HERE + '/_look/map.png')
