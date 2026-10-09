# 빙하기 설원 필드 (ice-age-field) — 72x52 JRPG 필드. 다시 돌리면 같은 그림이 나온다.   python3 make_ice_age_field.py [--draft]
# 동선: 남쪽 입구 → 엄니 문 → 모피 천막 야영지 → 북쪽 호숫가(쓰러진 표지) → 언 호수 위 눈길 → 얼음 다리로 물길 건넘 → 북쪽 물가 → 빙벽 동굴 입구.
#       곁길: 야영지 서쪽 → 눈 덮인 침엽수 숲의 설동 / 야영지 동쪽 → 거대 짐승 뼈 벌판.
import sys, os, json, math, random
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import numpy as np
from PIL import Image
from iaf_base import hash2
from iaf_scene import Scene
import iaf_pieces as A, iaf_props as B, iaf_ground as G
import iaf_props2 as Q, iaf_face2 as F2, iaf_auto2 as AU

W, H = 72, 52
rng = random.Random(5201)
s = Scene(W, H, seed=52)
MF = os.path.join(HERE, '..', 'mountain-fortress', 'parts')            # 이미 공용에 있는 눈 전나무·눈 바위(다시 내보내지 않는다)
def mf(n): return Image.open(os.path.join(MF, n + '.png')).convert('RGBA')

# ================================================================ 빙하(북쪽): 윗면 마지막 줄 GT, 앞면 5줄
FHc = 5
GT = []
for x in range(W):
    g = 5
    if x < 6: g = 6
    elif x < 16: g = 5
    elif x < 30: g = 4                                                     # 짐승이 갇힌 높은 앞면
    elif x < 40: g = 5
    elif x < 50: g = 5                                                     # 동굴 자리
    elif x < 60: g = 6
    else: g = 5
    GT.append(g)
FH = [10 - GT[x] for x in range(W)]                                     # 앞면 밑줄은 10줄로 고르다(처마만 들쭉날쭉)
s.set_glacier(GT, FH)

# ================================================================ 언 호수 · 물길
LCX, LCY = 37.0, 23.5
for y in range(H):
    for x in range(W):
        a = math.atan2(y - LCY, x - LCX)
        rx = 26.5 + 2.5 * math.sin(a * 3 + 0.6) + 1.5 * math.sin(a * 5 + 2.0)
        ry = 8.6 + 1.2 * math.sin(a * 2 + 1.3) + 0.8 * math.sin(a * 4)
        if ((x - LCX) / rx) ** 2 + ((y - LCY) / ry) ** 2 <= 1 and y >= s.ground_y0(x) + 3: s.lake.add((x, y))
# 물길: 서→동 맵을 가로지른다(호수 안은 얼음 틈 물길, 밖은 눈 둑 사이 개울). 폭 2~3, 다리 자리 3
YT = {}
for x in range(W):
    yc = 22.0 + 1.3 * math.sin(x / 7.5 + 0.4) + 0.6 * math.sin(x / 3.1)
    yt = int(round(yc))
    if 32 <= x <= 38: yt = 22
    wdt = 3 if (x, yt) in s.lake else 2
    if 32 <= x <= 38: wdt = 3
    YT[x] = (yt, wdt)
    for y in range(yt, yt + wdt): s.water.add((x, y))
s.lake -= s.water

# ================================================================ 길(눈길 발자국)
def add_path(pts, wid=2):
    """점들을 한 칸씩 굽어 잇는 폭 2 길."""
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = max(abs(x1 - x0), abs(y1 - y0)) * 2 + 1
        prev = None
        for i in range(n + 1):
            t = i / n; x = int(round(x0 + (x1 - x0) * t)); y = int(round(y0 + (y1 - y0) * t))
            for k in range(wid):
                if abs(x1 - x0) >= abs(y1 - y0): s.path.add((x, y + k))
                else: s.path.add((x + k, y))
            if prev and prev[0] != x and prev[1] != y: s.path.add((x, prev[1])); s.path.add((x + 1, prev[1]))
            prev = (x, y)
# 큰길: 남쪽 입구(35,51) → 엄니 문(35,47) → 야영지 → 호숫가 → 호수 위 → 다리 남쪽 끝 → 다리 → 북쪽 → 동굴 앞(45,11)
add_path([(35, 51), (35, 48)])
add_path([(35, 44), (35, 40)])
add_path([(35, 38), (32, 36), (34, 33), (31, 30), (33, 28), (34, 26), (34, 25)])   # 보정 4차: 곧은 기둥이 안 되게 굽힌다
add_path([(34, 20), (36, 17), (41, 15), (44, 13), (44, 11)])
# 곁길: 야영지 서쪽 → 숲 설동, 야영지 동쪽 → 뼈 벌판
add_path([(29, 42), (22, 41), (16, 38), (11, 36), (8, 34)])
add_path([(42, 42), (48, 42), (53, 44), (56, 45)])
BRIDGE = [(x, y) for x in (34, 35, 36) for y in range(21, 26)]
s.path -= set(BRIDGE); s.path -= s.water
for c in BRIDGE: s.walk_ok.add(c)
s.join = {(34, 20), (35, 20), (34, 26), (35, 26)}
# 다진 눈(야영지)
for y in range(35, 47):
    for x in range(25, 47):
        if ((x - 35.5) / 6.8) ** 2 + ((y - 41.5) / 4.0) ** 2 <= 1: s.packed.add((x, y))
s.path -= s.packed
add_path([(35, 46), (35, 48)])

# ================================================================ 놓기 도우미
P_ = {}
for n in ['fur_tent_cone', 'fur_tent_dome', 'hide_windbreak', 'campfire_snow', 'hide_rack_fur', 'sled_loaded', 'firewood_snow', 'supply_bundles',
          'cook_tripod', 'marker_fallen', 'marker_standing', 'marker_stub', 'fir_laden', 'fir_buried', 'frost_snag', 'frozen_grass', 'tracks_beast',
          'ice_crack', 'frozen_reeds', 'fur_pile']:
    P_[n] = getattr(B, n)()
for n in ['mammoth_ribs', 'mammoth_skull', 'tusk_arch', 'bone_scatter', 'ice_shards', 'serac', 'rock_rimed', 'rocks_snowy', 'drift_big', 'drift_small',
          'snow_den', 'ice_floe', 'pressure_ridge', 'tusk_single']:
    P_[n] = getattr(A, n)()
P_['ice_floe_s'] = A.ice_floe('s', 3)
for n in ['rock_heads', 'rock_outcrop', 'frozen_bush', 'snowshoe_trail', 'ice_pillar', 'mammoth_skeleton', 'cairn_spear', 'ice_fishing_hole']:
    P_[n] = getattr(Q, n)()
for n in ['fir_snow_l', 'fir_snow_m', 'fir_snow_s', 'fir_dusted', 'snowrock_l', 'snowrock_m', 'snowrock_s', 'juniper']: P_[n] = mf(n)
NOFLIP = {'snow_den', 'tusk_arch', 'fur_tent_cone', 'fur_tent_dome', 'drift_big', 'rock_outcrop', 'rock_heads', 'ice_pillar', 'snowshoe_trail'}
def img_of(n): return P_[n].transpose(Image.FLIP_LEFT_RIGHT) if (rng.random() < 0.5 and n not in NOFLIP) else P_[n]

def put(n, x, y, block=None, margin=0, on_lake=False, allow_path=False, im=None):
    """그림 밑 왼쪽 칸 (x,y). block: 막는 상대 칸(기본 밑줄 전체). 덮는 칸이 다 비어야 놓는다."""
    im = im or img_of(n); wc = im.width // 16; hc = im.height // 16
    if x < 0 or x + wc > W or y - hc + 1 < 0 or y >= H: return False
    for i in range(wc):
        for j in range(hc):
            if not s.cell_ok(x + i, y - j, path_margin=(margin if j == 0 else 0), allow_path=(allow_path or j > 0), on_lake=on_lake if j == 0 else None) \
                    and not (j > 0 and _upper_ok(x + i, y - j)): return False
    bl = [(i, 0) for i in range(wc)] if block is None else block
    s.at(im, x, y, block=bl, name=n)
    s.reserve(x, y - hc + 1, x + wc - 1, y)
    return True

def _upper_ok(x, y):
    """키 큰 물체 윗칸: 길·호수·물 위로 걸쳐도 된다(빙하·다른 물체만 피한다)."""
    return 0 <= x < W and 0 <= y < H and not s.gl[y, x] and not s.face[y, x] and (x, y) not in s.occ and not s.block[y, x]

# cell_ok 의 on_lake=None 은 '호수 여부 상관없음'
_orig_cell_ok = s.cell_ok
def _cell_ok(x, y, path_margin=0, allow_path=False, on_lake=False):
    if on_lake is None:
        return _orig_cell_ok(x, y, path_margin, allow_path, (x, y) in s.lake)
    return _orig_cell_ok(x, y, path_margin, allow_path, on_lake)
s.cell_ok = _cell_ok

def deco(n, x, y, dx=0, dy=0, on_lake=False):
    im = img_of(n); wc = im.width // 16
    if not all(s.cell_ok(x + i, y, on_lake=on_lake) for i in range(wc)): return False
    s.decal(im, x, y, dx, dy, name=n)
    for i in range(wc): s.occ.add((x + i, y))
    return True

def tree(n, x, y):
    """나무: 밑동 줄은 비어야 하고(다른 나무 수관 밑은 된다 — 숲이 겹친다), 윗칸은 빙하·물체만 피한다. 줄기 칸만 막힘."""
    im = img_of(n); wc = im.width // 16; hc = im.height // 16
    if x < 0 or x + wc > W or y - hc + 1 < 0: return False
    s._tree_mode = True
    try:
        for i in range(wc):
            if not s.cell_ok(x + i, y): return False
            for j in range(1, hc):
                xx, yy = x + i, y - j
                if not (0 <= yy < H) or s.gl[yy, xx] or s.face[yy, xx] or ((xx, yy) in s.occ and (xx, yy) not in s.canopy): return False
    finally:
        s._tree_mode = False
    s.at(im, x, y, block=[(wc // 2, 0)] if wc > 1 else [(0, 0)], name=n)
    s.reserve(x, y, x + wc - 1, y)
    for i in range(wc):
        for j in range(1, hc): s.canopy.add((x + i, y - j))
    return True

def cluster(cx, cy, rx, ry, n, makers, tries=18):
    placed = 0
    for _ in range(n * tries):
        if placed >= n: break
        a = rng.random() * 6.2832; d = math.sqrt(rng.random())
        x = int(round(cx + math.cos(a) * rx * d)); y = int(round(cy + math.sin(a) * ry * d))
        if not (0 <= x < W and 1 <= y < H): continue
        if rng.choice(makers)(x, y): placed += 1
    return placed

T_fl = lambda x, y: tree('fir_snow_l', x, y); T_fm = lambda x, y: tree('fir_snow_m', x, y); T_fs = lambda x, y: tree('fir_snow_s', x, y)
T_lad = lambda x, y: tree('fir_laden', x, y); T_dus = lambda x, y: tree('fir_dusted', x, y); T_snag = lambda x, y: tree('frost_snag', x, y)
T_bur = lambda x, y: put('fir_buried', x, y, block=[(0, 0), (1, 0)])
R_l = lambda x, y: put('snowrock_l', x, y, block=[(0, 0), (1, 0), (2, 0)]); R_m = lambda x, y: put('snowrock_m', x, y, block=[(0, 0), (1, 0)])
R_rim = lambda x, y: put('rock_rimed', x, y, block=[(0, 0), (1, 0)]); R_s = lambda x, y: put('snowrock_s', x, y)
I_sh = lambda x, y: put('ice_shards', x, y, block=[(0, 0), (1, 0)]); I_ser = lambda x, y: put('serac', x, y, block=[(0, 0), (1, 0)])
D_big = lambda x, y: put('drift_big', x, y, block=[(0, 0), (1, 0), (2, 0)]); JUN = lambda x, y: put('juniper', x, y)
d_drift = lambda x, y: deco('drift_small', x, y); d_rocks = lambda x, y: deco('rocks_snowy', x, y, rng.randrange(-3, 4), rng.randrange(-2, 3))
d_grass = lambda x, y: deco('frozen_grass', x, y, rng.randrange(-3, 4), rng.randrange(-1, 2)); d_tracks = lambda x, y: deco('tracks_beast', x, y)
d_bone = lambda x, y: deco('bone_scatter', x, y, rng.randrange(-3, 4), rng.randrange(-2, 3))
l_crack = lambda x, y: deco('ice_crack', x, y, on_lake=True); l_reed = lambda x, y: deco('frozen_reeds', x, y, on_lake=True)
l_ridge = lambda x, y: put('pressure_ridge', x, y, block=[(0, 0), (1, 0), (2, 0)], on_lake=True)

# ================================================================ 앵커 1: 빙벽 · 동굴 입구 · 갇힌 짐승 · 언 폭포
CAVE_X = 44; cy_face_top = GT[CAVE_X] + 1
s.face_decal(A.glacier_cave(FH[CAVE_X]), CAVE_X * 16, cy_face_top * 16, name='glacier_cave')
DOOR = (CAVE_X + 1, 10); s.walk_ok.add(DOOR); s.walk_ok.add((CAVE_X + 2, 10)); s.marks['cave_door'] = DOOR
s.reserve(CAVE_X, 11, CAVE_X + 3, 11)
s.face_decal(A.frozen_beast(), 19 * 16, (GT[20] + 1) * 16 + 24, name='frozen_beast'); s.marks['frozen_beast'] = (22, 11)
IF = A.icefall(FH[9])
s.at(IF, 9, 11, block=[(0, 0), (1, 0)], shadow=False, sorty=(GT[9] + 1) * 16, name='icefall'); s.reserve(9, 11, 10, 11)
s.marks['icefall'] = (10, 12)
# 빙하 윗면: 세락·얼음 결정(앞 가장자리 가까이, 덩이로) — 윗면은 걷지 못한다(배경)
for (x, y, n) in ((3, 4, 'serac'), (24, 2, 'serac'), (33, 3, 'ice_shards'), (57, 3, 'ice_shards'), (55, 4, 'serac'),
                  (68, 2, 'ice_shards'), (7, 4, 'ice_shards'), (47, 2, 'ice_shards'), (14, 3, 'ice_shards'), (62, 4, 'ice_shards')):
    im = img_of(n)
    if y < GT[x]: s.at(im, x, y, block=None, name=n)

# ================================================================ 앵커 2: 얼음 다리 · 유빙 · 압력 둑
s.at(A.ice_bridge(5), 34, 25, block=None, shadow=False, sorty=21 * 16, name='ice_bridge'); s.reserve(34, 21, 36, 25)
s.marks['bridge_s'] = (35, 26); s.marks['bridge_n'] = (35, 20)
for (x, y, n) in ((14, YT[14][0] + 1, 'ice_floe_s'), (24, YT[24][0] + 2, 'ice_floe'), (46, YT[46][0] + 2, 'ice_floe'), (55, YT[55][0] + 1, 'ice_floe_s'), (61, YT[61][0] + 2, 'ice_floe_s')):
    s.at(img_of(n), x, y, block=None, shadow=False, name=n)
for (x, y) in ((18, 27), (50, 19), (55, 27), (25, 18)): l_ridge(x, y)
cluster(37, 23, 22, 7, 12, [l_crack], tries=30)
for x0 in range(12, 64, 4):                                                 # 호숫가 갈대(얼음판 가장자리)
    for y in range(H):
        if (x0, y) in s.lake and (x0, y + 1) not in s.lake and (x0, y + 1) not in s.water and rng.random() < 0.55: l_reed(x0, y); break

# ================================================================ 앵커 3: 모피 천막 야영지
s.marks['camp'] = (35, 39)
put('tusk_arch', 34, 47, block=[(0, 0), (2, 0)], allow_path=True, im=P_['tusk_arch']); s.marks['tusk_gate'] = (35, 47)
put('fur_tent_cone', 28, 40, im=P_['fur_tent_cone']); s.marks['tent_a'] = (29, 41)
put('fur_tent_dome', 39, 39, im=P_['fur_tent_dome']); s.marks['tent_b'] = (40, 40)
put('fur_tent_cone', 40, 45, im=P_['fur_tent_cone'].transpose(Image.FLIP_LEFT_RIGHT)); s.marks['tent_c'] = (41, 46)
put('fur_tent_dome', 23, 44, im=P_['fur_tent_dome']); s.marks['tent_d'] = (24, 45)
put('campfire_snow', 35, 41, allow_path=True, im=P_['campfire_snow']); s.walk_ok.discard((35, 41))
s.path -= {(35, 41)}
put('hide_windbreak', 31, 39, im=P_['hide_windbreak'])
put('cook_tripod', 37, 42, block=[(0, 0)], im=P_['cook_tripod'])
put('hide_rack_fur', 30, 45, block=[(0, 0), (1, 0)])
put('sled_loaded', 38, 44)
put('supply_bundles', 32, 43)
put('firewood_snow', 39, 41); put('firewood_snow', 29, 43); put('fur_pile', 33, 40); put('supply_bundles', 44, 40); put('hide_rack_fur', 25, 42, block=[(0, 0), (1, 0)]); put('tusk_single', 31, 46, block=[(0, 0)]); put('tusk_single', 26, 39, block=[(0, 0)]); put('fur_pile', 43, 42); put('sled_loaded', 28, 45)
for (x, y) in ((26, 44), (45, 38), (44, 42), (27, 37)): d_tracks(x, y)

# ================================================================ 앵커 4: 쓰러진 표지(호숫가 남쪽) · 선 표지
put('marker_fallen', 29, 34, im=P_['marker_fallen']); s.marks['fallen_marker'] = (30, 35)
put('marker_stub', 28, 34, im=P_['marker_stub'])
put('marker_standing', 37, 35, block=[(0, 0)], im=P_['marker_standing'])
put('marker_standing', 38, 18, block=[(0, 0)], im=P_['marker_standing'].transpose(Image.FLIP_LEFT_RIGHT))
put('marker_standing', 37, 49, block=[(0, 0)], im=P_['marker_standing'])

# ================================================================ 앵커 5: 거대 짐승 뼈 벌판(동쪽)
put('mammoth_ribs', 56, 42, block=[(i, 0) for i in range(5)], im=P_['mammoth_ribs']); s.marks['beast_bones'] = (58, 43)
put('mammoth_skull', 62, 45, block=[(0, 0), (1, 0), (2, 0)], im=P_['mammoth_skull'])
put('mammoth_skull', 51, 47, block=[(0, 0), (1, 0), (2, 0)], im=P_['mammoth_skull'].transpose(Image.FLIP_LEFT_RIGHT))
for (x, y) in ((54, 45), (61, 41), (66, 44), (53, 40)): put('tusk_single', x, y, block=[(0, 0)])
cluster(58, 44, 4.5, 2.5, 6, [d_bone, d_bone, d_grass])
cluster(64, 39, 4, 3, 3, [T_snag, R_rim, T_snag])

# ================================================================ 보정 패스(웨이브 5): 빙벽 앞면 변형 · 땅 덩이 오토타일 · 눈밭 소품
# 빙벽이 같은 모양으로 되풀이되지 않게 구간마다 앞면 변형을 얹는다(굴 입구 44~47·언 폭포 9~10·갇힌 짐승 19~24 는 피한다).
for (fn, a0, a1, sd) in ((F2.snowload, 0, 7, 501), (F2.icicles, 12, 18, 502), (F2.crack, 27, 31, 503), (F2.rubble, 35, 42, 504),
                         (F2.icicles, 49, 56, 505), (F2.crack, 60, 64, 506), (F2.snowload, 65, 72, 507)):
    s.face_mods.append((fn, a0, a1, sd)); s.count['face_' + fn.__name__] += 1
s.reserve(36, 11, 41, 11)                                                    # 무너진 처마 발치 얼음 덩이가 걸친 땅 줄

def blob(cx, cy, rx, ry, seed, margin=1, lake_gap=2):
    """불규칙한 덩이 칸(각도 잡음 반지름) — 놓을 수 있는 칸만, 이웃 2 미만 칸은 깎고, 가장 큰 덩이만 남긴다."""
    r_ = random.Random(seed); ph = [r_.uniform(0, 6.283) for _ in range(3)]
    def ok(x, y):
        if not (0 <= x < W and 0 <= y < H): return False
        if s.gl[y, x] or s.face[y, x] or (x, y) in s.occ or s.block[y, x] or (x, y) in s.packed or (x, y) in s.drift: return False
        if y <= s.ground_y0(x): return False                                    # 빙벽 발치 땅 줄은 비운다
        if (x, y) in s.pond or (x, y) in s.ridge or (x, y) in s.pit: return False
        for j in range(-margin, margin + 1):
            for i in range(-margin, margin + 1):
                if (x + i, y + j) in s.path or (x + i, y + j) in s.join or (x + i, y + j) in s.water: return False
        for j in range(-lake_gap, lake_gap + 1):
            for i in range(-lake_gap, lake_gap + 1):
                if (x + i, y + j) in s.lake: return False
        return True
    cells = set()
    # 보정 4차: 각도 잡음 반지름 타원(혹·만 셋~다섯, 살짝 기운 축) — 휜 등줄기 방식은 평행사변형·곧은 변이 남았다(적대 검수 4번)
    tilt = r_.uniform(-0.35, 0.35); ca, sa = math.cos(tilt), math.sin(tilt)
    for y in range(int(cy - max(rx, ry)) - 2, int(cy + max(rx, ry)) + 3):
        for x in range(int(cx - max(rx, ry)) - 2, int(cx + max(rx, ry)) + 3):
            u = (x - cx) * ca + (y - cy) * sa; v = -(x - cx) * sa + (y - cy) * ca
            a_ = math.atan2(v / ry, u / rx)
            wob = 1 + 0.26 * math.sin(a_ * 3 + ph[0]) + 0.13 * math.sin(a_ * 5 + ph[1]) + 0.08 * math.sin(a_ * 2 + ph[2])
            if (u / rx) ** 2 + (v / ry) ** 2 <= wob * wob and ok(x, y): cells.add((x, y))
    # 8이웃 다듬기: 이웃 3 미만 칸은 깎고, 이웃 6 이상 빈 칸은 메운다(계단 끝 낱칸·홈을 없앤다)
    for _ in range(2):
        def n8(c): return sum(((c[0] + dx, c[1] + dy) in cells) for dx in (-1, 0, 1) for dy in (-1, 0, 1) if dx or dy)
        cand = {(x + dx, y + dy) for (x, y) in cells for dx in (-1, 0, 1) for dy in (-1, 0, 1)}
        cells = {c for c in cand if (c in cells and n8(c) >= 3) or (c not in cells and n8(c) >= 6 and ok(*c))}
    for _ in range(4):
        cells = {c for c in cells if sum(((c[0] + dx, c[1] + dy) in cells) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))) >= 2}
    comp = []; seen_ = set()
    for c in sorted(cells):
        if c in seen_: continue
        st = [c]; cur = set()
        while st:
            u = st.pop()
            if u in seen_ or u not in cells: continue
            seen_.add(u); cur.add(u)
            st += [(u[0] + 1, u[1]), (u[0] - 1, u[1]), (u[0], u[1] + 1), (u[0], u[1] - 1)]
        comp.append(cur)
    return max(comp, key=len) if comp else set()

T_pil = lambda x, y: tree('ice_pillar', x, y)
O_bush = lambda x, y: put('frozen_bush', x, y, block=[(0, 0), (1, 0)])
O_crop = lambda x, y: put('rock_outcrop', x, y, block=[(0, 0), (1, 0), (2, 0)])
d_heads = lambda x, y: deco('rock_heads', x, y, rng.randrange(-2, 3), rng.randrange(-1, 2))
d_shoe = lambda x, y: deco('snowshoe_trail', x, y)

# 얼음 구덩이 균열(북쪽 물가, 막힘) + 둘레 얼음 기둥
for (cx, cy, rx, ry, sd) in ((29.5, 13.4, 4.0, 2.4, 61), (60.0, 13.6, 3.2, 2.2, 62)):
    c_ = blob(cx, cy, rx, ry, sd, margin=2, lake_gap=0)
    s.pit |= c_; s.count['autotile-icepit'] += len(c_)
_ps = sorted(s.pit); _cand = [(x, y + 1) for (x, y) in _ps if (x, y + 1) not in s.pit and 25 <= x <= 34]
s.marks['ice_pit'] = max(_cand, key=lambda c: c[1]) if _cand else (30, 16)
for (x, y) in ((26, 14), (34, 12), (25, 12), (35, 14), (64, 14), (56, 15)): T_pil(x, y)
# 큰 눈 둔덕 능선(걷기): 호수 남쪽 눈밭 · 북쪽 물가 동쪽 · 서쪽 들
for (cx, cy, rx, ry, sd) in ((48.5, 34.4, 4.4, 2.6, 71), (52.0, 13.2, 3.6, 2.1, 72), (21.6, 35.8, 4.0, 2.6, 73)):
    c_ = blob(cx, cy, rx, ry, sd, margin=1, lake_gap=1)
    s.ridge |= c_; s.count['autotile-snowridge'] += len(c_)
# 앵커 7: 선 채로 언 매머드 뼈대(호수 남쪽 눈밭 한가운데)
put('mammoth_skeleton', 39, 35, block=[(i, 0) for i in range(5)], im=P_['mammoth_skeleton']); s.marks['standing_skeleton'] = (41, 36)
# 언 연못 둘(걷기) + 낚시 구멍 · 돌무지 · 덤불 · 설피 발자국 — 앵커 8: 서쪽 언 연못 낚시터
for (cx, cy, rx, ry, sd, key) in ((14.8, 31.8, 3.3, 2.7, 81, 'pond_w'), (65.0, 17.6, 3.0, 2.4, 82, 'pond_e')):
    c_ = blob(cx, cy, rx, ry, sd, margin=1, lake_gap=2)
    s.pond |= c_; s.count['autotile-frozenpond'] += len(c_)
    inner = sorted(c for c in c_ if all((c[0] + dx, c[1] + dy) in c_ for dx in (-1, 0, 1) for dy in (-1, 0, 1)))
    if inner:
        hx_, hy_ = min(inner, key=lambda c: (c[0] - cx) ** 2 + (c[1] - cy) ** 2)
        s.at(P_['ice_fishing_hole'], hx_, hy_, block=[(0, 0)], shadow=False, name='ice_fishing_hole'); s.marks[key] = (hx_, hy_ + 1)
        s.walk_ok.discard((hx_, hy_))
put('cairn_spear', 19, 33, block=[(0, 0)]); put('cairn_spear', 61, 18, block=[(0, 0)])
for (x, y) in ((11, 30), (19, 30), (13, 35), (62, 16), (68, 19), (37, 31), (52, 31)): O_bush(x, y)
def near_try(fn, x, y, r=2):
    for d in range(r + 1):
        for dy in range(-d, d + 1):
            for dx in range(-d, d + 1):
                if max(abs(dx), abs(dy)) == d and fn(x + dx, y + dy): return True
    return False
# 설피 발자국: 야영지 → 선 뼈대 쪽, 숲 길 → 서쪽 연못 쪽 두 줄기 발길
for (x, y) in ((37, 37), (40, 36), (44, 36), (20, 37), (17, 36), (14, 35)): near_try(d_shoe, x, y)
# 바위 턱 · 바위 머리(트인 눈밭의 이름 붙일 수 있는 볼거리)
O_crop(21, 13); O_crop(44, 38); O_crop(53, 34)
for (x, y) in ((24, 14), (37, 34), (45, 31), (51, 37), (58, 16), (13, 29), (55, 19), (28, 37)): d_heads(x, y)

# ================================================================ 앵커 6: 눈 덮인 침엽수 숲 · 설동(서쪽)
put('snow_den', 6, 33, block=[(0, 0), (2, 0)], im=P_['snow_den']); s.walk_ok.add((7, 33)); s.marks['snow_den'] = (7, 34)
s.reserve(6, 34, 8, 34)
FOREST = [T_fl, T_fm, T_fm, T_fs, T_lad, T_lad, T_dus, T_fl]
cluster(6, 42, 6.5, 8.5, 70, FOREST, tries=60)
cluster(5, 24, 5.5, 6.5, 40, FOREST, tries=60)
cluster(16, 46, 6.5, 3.5, 24, FOREST, tries=50)
cluster(12, 29, 3, 3, 5, FOREST)
cluster(22, 48, 5, 2.5, 6, FOREST)
# 동쪽 가장자리 숲·바위
cluster(68, 30, 3.5, 7, 18, [T_fm, T_fs, T_lad, T_fl, R_l, T_fm], tries=50)
cluster(66, 48, 5.5, 3.5, 14, [T_fm, T_lad, T_fl, T_fs, R_m], tries=50)
cluster(50, 48, 5, 2.5, 4, [R_l, D_big, T_fs, T_fm])
# 북쪽 물가(빙벽 밑): 세락·얼음 결정·서리 바위·눈 둔덕 덩이
for (cx, cy, n) in ((5, 13, 4), (17, 12, 4), (28, 11, 3), (54, 14, 4), (63, 13, 4), (69, 14, 3)):
    cluster(cx, cy, 3, 1.6, n, [I_sh, I_ser, R_rim, D_big, R_s], tries=30)
cluster(40, 13, 2, 1, 2, [I_sh, R_s])
# 남쪽 호숫가 · 남쪽 들
for (cx, cy, n) in ((20, 33, 4), (50, 34, 4), (60, 34, 3), (13, 48, 2), (27, 48, 2), (46, 48, 2)):
    cluster(cx, cy, 3, 2.2, n, [R_rim, D_big, R_m, T_bur, T_snag, I_sh], tries=30)
for (x, y) in ((33, 50), (38, 46), (31, 36), (40, 33)): d_rocks(x, y)
s.marks['south_entrance'] = (35, 51)

# ================================================================ 눈 번짐 더미(바람에 쌓인 눈 판, 오토타일) — 호숫가·빙벽 밑·들
def driftpatch(cx, cy, r, lake_ok=True):
    n = 0
    for y in range(int(cy - r) - 1, int(cy + r) + 2):
        for x in range(int(cx - r * 1.5) - 1, int(cx + r * 1.5) + 2):
            if not (0 <= x < W and 0 <= y < H): continue
            if ((x - cx) / (r * 1.5)) ** 2 + ((y - cy) / r) ** 2 > 0.85 + (rng.random() - 0.5) * 0.4: continue
            if s.gl[y, x] or s.face[y, x] or (x, y) in s.water or (x, y) in s.path or (x, y) in s.packed or (x, y) in s.join: continue
            if (x, y) in s.lake and not lake_ok: continue
            if s.block[y, x]: continue
            s.drift.add((x, y)); n += 1
    return n
SHORE = [c for c in s.lake if any((c[0] + dx, c[1] + dy) not in s.lake and (c[0] + dx, c[1] + dy) not in s.water for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
SHORE.sort()
for c in SHORE[::9]:
    if rng.random() < 0.7: driftpatch(c[0], c[1], rng.uniform(1.0, 1.7))
# 외톨이 칸(이웃 0) 지우기
s.drift = {c for c in s.drift if sum(((c[0] + dx, c[1] + dy) in s.drift) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))) >= 1}

# ================================================================ 빈 바닥 메우기(큰 빈 창부터, 자연 덩이)
def snowfield(cx, cy, r):
    n = 0
    for y in range(int(cy - r) - 1, int(cy + r) + 2):
        for x in range(int(cx - r * 1.3) - 1, int(cx + r * 1.3) + 2):
            if not (0 <= x < W and 0 <= y < H): continue
            if ((x - cx) / (r * 1.3)) ** 2 + ((y - cy) / r) ** 2 > 0.9 + (rng.random() - 0.5) * 0.5: continue
            on_l = (x, y) in s.lake
            if not s.cell_ok(x, y, on_lake=on_l): continue
            s.filled.add((x, y)); n += 1
            k = rng.random()
            if on_l:
                if k < 0.08: l_crack(x, y)
            elif k < 0.10: d_drift(x, y)
            elif k < 0.17: d_grass(x, y)
            elif k < 0.21: d_rocks(x, y)
            elif k < 0.23: d_tracks(x, y)
            elif k < 0.26: d_heads(x, y)
    return n
for it in range(200):
    e = s.empty(); r, wx, wy = s.worst(e)
    if r <= 0.39: print('fill', it, round(float(r), 3)); break
    best = None
    for y in range(wy + 2, wy + 13):
        for x in range(wx + 2, wx + 18):
            if e[y, x]:
                sc = e[max(0, y - 2):y + 3, max(0, x - 2):x + 3].sum()
                if best is None or sc > best[0]: best = (sc, x, y)
    if best is None: break
    _, bx, by = best
    pk = rng.random()
    if pk < 0.50: n = snowfield(bx, by, rng.uniform(1.8, 2.8))
    elif pk < 0.90: n = cluster(bx, by, 2.6, 1.8, 6, [T_fm, T_fs, T_lad, T_fm, T_fl], tries=30)
    else: n = cluster(bx, by, 1.8, 1.4, 2, [R_rim, D_big, I_sh, O_bush, O_crop])
    if n == 0: s.filled.add((bx, by))

# ================================================================ 렌더 · 통행 · 저장
# 숲 속 닫힌 틈(나무에 둘러싸여 못 가는 칸)은 덤불 그늘로 막는다
_g = s.walk_grid(); _seen = s.bfs(s.marks['south_entrance'])
for y in range(H):
    for x in range(W):
        if _g[y, x] and (x, y) not in _seen: s.block[y, x] = True; s.count['closed_gap'] += 1

TRAIL = G.trail_sheet(footprints=False); PACK = G.ground_packed(footprints=False); DRIFT = G.drift_sheet()
SHEETS = {'pond': AU.frozenpond_sheet(), 'ridge': AU.snowridge_sheet(), 'pit': AU.icepit_sheet()}

def run():
    im = s.render(TRAIL, PACK, DRIFT, SHEETS)
    seen = s.bfs(s.marks['south_entrance'])
    reach = {k: (tuple(v) in seen) for k, v in s.marks.items()}
    e = s.empty(); w = s.worst(e)
    return im, reach, (float(w[0]), (w[1], w[2]), float(e.mean())), seen

if __name__ == '__main__':
    im, reach, dens, seen = run()
    g = s.walk_grid()
    print(im.size, 'reach', {k: v for k, v in reach.items() if not v} or 'all', 'density', dens)
    un = [(x, y) for y in range(H) for x in range(W) if g[y, x] and (x, y) not in seen]
    print('walkable', int(g.sum()), 'reached', len(seen), 'unreached', len(un), un[:30])
    print(dict(s.count))
    if '--draft' in sys.argv:
        im.convert('RGB').save(HERE + '/_qa/draft.png')
    else:
        import iaf_export
        print('parts', iaf_export.export(s, im, reach, dens, seen))
