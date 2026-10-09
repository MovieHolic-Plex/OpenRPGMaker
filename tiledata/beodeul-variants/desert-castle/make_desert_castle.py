# 사막 성(desert-castle) — 모래 속에 반쯤 잠긴 사암 성 외관(야외 56x40) + 성 밑 지하 기계실(실내 40x30)을 한 맵(98x40)에 나란히.
# 다시 돌리면 같은 그림.  python3 make_desert_castle.py   (--noexport: 렌더만 _qa/render.png)
# 동선(야외): 남쪽 끝 길(27,39) → 화톳불 기둥 사이 → 문루(26~27, 19~23) → 안뜰 참배 길 → 본관 문 앞(27,12).
#   곁: 길 서쪽 → 오아시스(못·야자·낙타 말뚝) / 길 동쪽 → 무너진 성벽 모래 폭포 옆 모래 속 내림 계단(45~46, 25) ⇒ 지하.
# 동선(실내): 오름 계단 위(지하 x32~33, y5) → 기계실 홀(피스톤 기관·보일러·톱니 구덩이·대형 기어 문) → 남서 펌프실 / 남동 무너진 창고
#   → 남쪽 복도로 고리. 실내 칸은 맵 x58~97, y5~34.
import sys, os, json, math, random
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from dc_base import *
import dc_castle as DC, dc_court as CT, dc_mech as MC, dc_inner as IN
from dp_bd import Scene
import dp_auto as U
import ground
from scipy import ndimage as ndi
from dc_meta import META, piece
import dc_fix as FX                 # 보정 패스: 땅 덩이 오토타일 셋 + 성벽 앞면 변형 조각

OW, H = 56, 40                     # 야외
IW0 = 56                           # 실내 KMap 시작 열(맵 x56~97, 둘레는 천장)
IOX, IOY = 2, 5                    # 실내 지역 좌표 (0,0) = KMap (2,5) = 맵 (58,5)
W = 98
Wp, Hp = OW * 16, H * 16
rng = random.Random(7310)
s = Scene('desert-castle', OW, H, seed=73)
s.occ_ = set(); COUNT = {}; PLACED = {}

def grid(v=False): return [[v] * OW for _ in range(H)]
def nbits(mask, x, y):
    def on(xx, yy): return 0 <= xx < OW and 0 <= yy < H and mask[yy][xx]
    return (1 if on(x, y - 1) else 0) | (2 if on(x + 1, y) else 0) | (4 if on(x, y + 1) else 0) | (8 if on(x - 1, y) else 0)
STRUCT = grid(); COURT = grid();
def DEEP(x, y): return (y <= 2 and 2 <= x <= 53) or (y <= 23 and (x <= 3 or x >= 52)) or (x, y) in POCKET   # 성 뒤·옆 깊은 모래 언덕(막힘)
POCKET = set()
PATHC = grid(); TRAIL = grid(); DRIFT = grid(); WATER = grid(); LAWN = grid()

def G(n): return piece(n)

def foot_cells(img, cx, cy, brows):
    a = np.array(img)[:, :, 3] > 128; h, w = a.shape; wc = (w + 15) // 16; out = []
    for j in range(brows):
        for i in range(wc):
            y1 = h - j * 16; y0 = max(0, y1 - 16); x0 = i * 16; x1 = min(w, x0 + 16)
            cell = a[y0:y1, x0:x1]
            if j == 0: ok = cell[cell.shape[0] // 2:].mean() > 0.25 if cell.size else False
            else: ok = cell.mean() > 0.3 if cell.size else False
            if ok: out.append((cx + i, cy - j))
    return out

def struct(img, cx, cy, block='all', sorty=None, name=None, keep_open=()):
    """구조물(벽·탑·문루·본관): 칸 전체 막힘(keep_open 칸 제외)."""
    wc = (img.width + 15) // 16; hc = (img.height + 15) // 16
    cells = [(cx + i, cy - j) for i in range(wc) for j in range(hc)] if block == 'all' else block
    cells = [c for c in cells if c not in keep_open and 0 <= c[0] < OW and 0 <= c[1] < H]
    s.at(img, cx, cy, block=[(x - cx, y - cy) for (x, y) in cells], shadow=False, sorty=sorty)
    for (x, y) in cells: STRUCT[y][x] = True; s.occ_.add((x, y))
    if name: COUNT[name] = COUNT.get(name, 0) + 1

def free(x, y, allow_path=False):
    if not (0 <= x < OW and 0 <= y < H) or STRUCT[y][x] or WATER[y][x] or (x, y) in s.occ_: return False
    if not allow_path and (TRAIL[y][x] or PATHC[y][x]): return False
    if DUNEM[y][x]: return False
    return True

FLIP_OK = {'column_broken_tall', 'dry_planter', 'amphora_rack', 'sand_heap_s', 'sand_heap_l', 'machine_wreck', 'palm_tall', 'palm_short', 'palm_young', 'camel_lying', 'camel_standing', 'sand_boulder', 'sand_boulder_s', 'scrub', 'cactus_column', 'cactus_branch'}
FLIPPED = {}
def put(n, cx, cy, brows=None, allow_path=False, force=False, flip=None, dx=0, dy=0, occ_rows=None, sorty=None):
    img = G(n); md = META[n]
    if flip is None: flip = n in FLIP_OK and wl.hash2(cx, cy, 5) > 0.5
    if flip: img = FLIPPED.setdefault(n, img.transpose(Image.FLIP_LEFT_RIGHT))
    br = md.get('brows', 0) if brows is None else brows
    wc = (img.width + 15) // 16; hc = (img.height + 15) // 16
    if cx < 0 or cx + wc > OW or cy - hc + 1 < 0 or cy >= H: return False
    cells = foot_cells(img, cx, cy, br) if br else []
    base = cells if cells else [(cx + i, cy) for i in range(wc)]
    if not force:
        for (x, y) in base:
            if not free(x, y, allow_path): return False
    s.at(img, cx, cy, block=[(x - cx, y - cy) for (x, y) in cells], dx=dx, dy=dy, shadow=False, sorty=sorty)
    for i in range(wc):
        for j in range(occ_rows if occ_rows is not None else max(1, br)): s.occ_.add((cx + i, cy - j))
    COUNT[n] = COUNT.get(n, 0) + 1; PLACED.setdefault(n, []).append((cx, cy))
    return True
def deco(n, cx, cy, dx=None, dy=None, on_path=False, sorty=None):
    img = G(n); wc = (img.width + 15) // 16
    if dx is None: dx = int(wl.hash2(cx, cy, 31) * 7) - 3
    if dy is None: dy = int(wl.hash2(cx, cy, 32) * 5) - 2
    for i in range(wc):
        x = cx + i
        if not (0 <= x < OW) or STRUCT[cy][x] or WATER[cy][x] or (not on_path and (TRAIL[cy][x] or PATHC[cy][x])) or (x, cy) in s.occ_: return False
    s.at(img, cx, cy, block=None, dx=dx, dy=dy, shadow=False, sorty=(cy + 1) * 16 - 15 if sorty is None else sorty)
    COUNT[n] = COUNT.get(n, 0) + 1
    return True

# ================================================================ 야외: 성 구조물
KEEP_X, KEEP_B = 19, 11                       # 본관 18x12: x19~36, y0~11
NW_B, FW_B = 7, 23                            # 북쪽 성벽 아랫줄, 앞 성벽 아랫줄
# 본관
kd = [(KEEP_X + c, KEEP_B) for c in DC.keep_door_cols()]
struct(G('keep_hall'), KEEP_X, KEEP_B, name='keep_hall', sorty=(KEEP_B + 1) * 16 - 2)
s.marks['keep_door'] = (KEEP_X + 8, KEEP_B + 1)
# 북쪽 성벽(본관 양옆) — 앞면에 붉은 천
struct(FX.decorate(DC.wall_front(13, 11, banners=((52, 'crimson'), (148, 'indigo'))), [('wall_face_crack', 1), ('wall_face_lattice', 5), ('wall_face_repair', 10)]), 6, NW_B, name='wall_front', sorty=(NW_B + 1) * 16 - 4)
struct(FX.decorate(DC.wall_front(14, 12, banners=((60, 'indigo'), (156, 'crimson'))), [('wall_face_repair', 1), ('wall_face_crack', 7), ('wall_face_lattice', 11)]), 37, NW_B, name='wall_front', sorty=(NW_B + 1) * 16 - 4)
# 옆 성벽 통로(위에서 본 띠)
struct(DC.wall_side(11, 5, 'W'), 4, 18, name='wall_side', sorty=8 * 16)
struct(DC.wall_side(11, 6, 'E'), 50, 18, name='wall_side', sorty=8 * 16)
# 앞 성벽: 서쪽은 모래 언덕에 묻혔고, 동쪽은 무너져 모래 폭포
west_bury = lambda x: max(0, int(30 - 0.085 * x + 6 * math.sin(x / 11.0 + 1.0) + 2 * math.sin(x / 3.3)))
struct(DC.wall_front(17, 21, buried=west_bury), 6, FW_B, name='wall_front_buried', sorty=(FW_B + 1) * 16 - 4)
BR_X0, BR_X1 = 7 * 16, 14 * 16                 # 무너진 폭(동쪽 성벽 안 화소) → 맵 x38~44
ew = FX.decorate(DC.wall_front(19, 31, breach=(BR_X0, BR_X1)), [('wall_face_repair', 1), ('wall_face_crack', 4), ('wall_face_lattice', 15)]); ep = Px(ew.width, ew.height); ep.paste(ew, 0, 0)
DC._sandfall(ep, BR_X0 + 6, BR_X1 - 6, 14, 80, 33)
struct(ep.im, 31, FW_B, name='wall_front_breach', sorty=(FW_B + 1) * 16 - 4)
# 문루(8x9, x23~30): 가운데 두 열(26·27)이 통로
GH_X = 23
gh = G('gatehouse'); ghc = []
for i in range(8):
    for j in range(9):
        if i in (3, 4): continue
        if j >= 7: continue
        ghc.append((GH_X + i, FW_B - j))
for i in (3, 4):
    for j in range(5, 9):
        pass
struct(gh, GH_X, FW_B, block=ghc + [(GH_X + 3 + k, FW_B - j) for k in (-1,) for j in ()], name='gatehouse', sorty=(FW_B + 1) * 16)
for x in (26, 27):
    for y in range(15, 24): STRUCT[y][x] = False; s.occ_.discard((x, y)); PATHC[y][x] = True
# 둥근 탑 넷
struct(G('round_tower'), 2, NW_B, name='round_tower', sorty=(NW_B + 1) * 16 + 2)
struct(DC.round_tower(seed=9, flip=True), 50, NW_B, name='round_tower', sorty=(NW_B + 1) * 16 + 2)
struct(G('round_tower_buried'), 2, FW_B, name='round_tower_buried', sorty=(FW_B + 1) * 16 + 2)
struct(DC.round_tower(seed=11, flip=True, bury=lambda x: int(10 + 6 * math.sin(x / 7.0))), 50, FW_B, name='round_tower', sorty=(FW_B + 1) * 16 + 2)

# ================================================================ 야외: 땅 마스크
for y in range(8, 19):
    for x in range(6, 50):
        if not STRUCT[y][x]: COURT[y][x] = True
for y in range(12, 19):
    for x in (26, 27): PATHC[y][x] = True
# 안뜰 동쪽 모래 몸(무너진 틈으로 쏟아질 만큼 쌓였다): 칸 마스크 → 화소 단위로 흔든 경계
SANDB = grid()
for y in range(8, 19):
    for x in range(38, 50):
        x0 = 40.5 - 1.6 * math.sin(y / 2.3 + 0.7) - (1.5 if y >= 16 else 0)
        if COURT[y][x] and x >= x0: SANDB[y][x] = True
for x in range(38, 45): SANDB[18][x] = True
# 안뜰 모래 번짐: 동쪽(무너진 틈으로 쏟아질 만큼 쌓였다)·서쪽 구석·벽 밑
for y in range(8, 19):
    for x in range(6, 50):
        if not COURT[y][x] or PATHC[y][x] or SANDB[y][x]: continue
        v = 0.0
        if x >= 37: v = 0.35 if x < 40 else -9
        elif x <= 9: v = 0.45 + (0.3 if y >= 15 else 0)
        if y == 8 and wl.hash2(x, y, 2) > 0.55: v += 0.6
        if wl.hash2(x, y, 3) * 0.6 + v > 0.75: DRIFT[y][x] = True
# 성문 앞 길·오아시스 갈래·계단 갈래(폭 2)
def path(pts, wid=2):
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = max(abs(x1 - x0), abs(y1 - y0)) * 2 + 1
        for i in range(n + 1):
            t = i / n; xi = int(round(x0 + (x1 - x0) * t)); yi = int(round(y0 + (y1 - y0) * t))
            for dx in range(wid):
                for dy in range(wid):
                    if 0 <= xi + dx < OW and 0 <= yi + dy < H: TRAIL[yi + dy][xi + dx] = True
path([(26, 24), (26, 28), (27, 32), (27, 36), (27, 38)])
path([(26, 31), (22, 32), (19, 33)])
path([(28, 26), (34, 27), (40, 28), (44, 29), (45, 29)])
for y in range(H):
    for x in range(OW):
        if STRUCT[y][x] or COURT[y][x]: TRAIL[y][x] = False
# 오아시스(화소 모양)
def blob_px(cx, cy, rx, ry, seed, rough):
    Yy, Xx = np.mgrid[0:Hp, 0:Wp]
    X = (Xx + 0.5) / 16.0; Yc = (Yy + 0.5) / 16.0
    ang = np.arctan2(Yc - cy, X - cx)
    r = 1 + rough * (np.sin(ang * 3 + seed) * 0.6 + np.sin(ang * 5 + seed * 2.1) * 0.4) + (A.vn_full(Wp, Hp, 20, seed + 9) - 0.5) * 0.12
    return ((X - cx) / rx) ** 2 + ((Yc - cy) / ry) ** 2 < r * r
LAWN_PX = blob_px(11.5, 33.5, 9.0, 5.2, 2, 0.14)
WATER_PX = blob_px(11.0, 33.8, 4.6, 2.4, 5, 0.12)
def px_to_cells(m, th):
    c = m.reshape(H, 16, OW, 16).mean(axis=(1, 3)); return [[bool(c[y, x] >= th) for x in range(OW)] for y in range(H)]
LAWN = px_to_cells(LAWN_PX, 0.5); WATER = px_to_cells(WATER_PX, 0.45)
# 보정: 오아시스는 화소 덩이가 아니라 칸 마스크 + 16변형 오토타일(조수가 붓으로 칠하는 것과 같은 모양)로 그린다.
POND_ROWS = {30: (11, 12), 31: range(9, 15), 32: range(7, 16), 33: range(6, 16), 34: range(6, 15), 35: (7, 8, 9, 10, 11, 13, 14), 36: (8, 9, 10)}
WATER = [[False] * OW for _ in range(H)]
for yy_, xs_ in POND_ROWS.items():
    for xx_ in xs_: WATER[yy_][xx_] = True                              # 손으로 그린 못 칸(북쪽 혹·남쪽 만·남동 코): 타원·네모가 아니게
for y in range(H):
    for x in range(OW):
        if any(0 <= y + dy < H and 0 <= x + dx < OW and WATER[y + dy][x + dx] for dx in (-2, -1, 0, 1, 2) for dy in (-2, -1, 0, 1, 2) if abs(dx) + abs(dy) <= 3): LAWN[y][x] = True
for (x, y) in ((1, 31), (2, 30), (20, 30), (21, 31), (22, 33), (12, 39), (13, 39)): LAWN[y][x] = True
# 모래 언덕 덩이(autotile-dune-crest, 걷기): 남동 사막·성 앞 서쪽 빈 모래
DUNEM = [[False] * OW for _ in range(H)]
for (cx_, cy_, rx_, ry_, sd_) in ((38.5, 34.2, 4.3, 2.0, 1), (14.0, 25.6, 3.6, 1.4, 2)):
    for y in range(H):
        for x in range(OW):
            a_ = math.atan2(y - cy_, x - cx_); r_ = 1 + 0.22 * math.sin(a_ * 3 + sd_) + 0.12 * math.sin(a_ * 5 + sd_ * 2)
            if ((x - cx_) / rx_) ** 2 + ((y - cy_) / ry_) ** 2 < r_ * r_ and not LAWN[y][x]: DUNEM[y][x] = True
for y in range(H):
    for x in range(OW):
        if WATER[y][x]: TRAIL[y][x] = False
        if DUNEM[y][x] and TRAIL[y][x]: DUNEM[y][x] = False

# ================================================================ 야외: 안뜰 앵커
# 마른 분수(서쪽, 참배 길 옆)
put('dry_fountain', 14, 16, brows=4)
s.marks['fountain'] = (17, 17)
# 기둥열: 참배 길 양옆(한 기둥은 부러졌다)
for (n, x, y) in (('column', 24, 14), ('column', 29, 14), ('column', 24, 17), ('column_broken_tall', 29, 17)):
    put(n, x, y)
put('brazier_bowl', 25, 12); put('brazier_bowl', 30, 12)
# 주랑(북쪽 성벽 서쪽 앞) + 그늘 천막(동쪽)
put('stoa', 7, 10, brows=1)
put('stoa', 37, 10, brows=1, flip=True)
put('shade_canopy', 32, 16, brows=1)
put('amphora_rack', 36, 15)
deco('court_rug', 9, 13, dx=0, dy=0)
put('stone_bench', 8, 15); put('dry_planter', 11, 18); put('dry_planter', 6, 11)
put('banner_pole', 21, 13); put('banner_pole', 32, 12)
put('column_toppled', 42, 13); put('column_broken_tall', 46, 11); put('banner_pole', 44, 16)
put('stone_bench', 33, 18); put('gear_crate', 38, 16) if False else None
put('dry_planter', 15, 10); put('amphora_rack', 17, 10); put('stone_bench', 12, 9) if False else None
put('well', 21, 18); put('dry_planter', 33, 13); put('stone_bench', 38, 12); deco('sand_heap_s', 19, 12)
deco('court_rug', 31, 18) if False else None
s.marks['court_east'] = (42, 16); s.marks['court_west'] = (10, 16)

# ================================================================ 야외: 성 밖 앵커
# 모래 폭포 발치 둔덕 + 모래 속 내림 계단
put('sand_cone', 39, 25, brows=2, force=True)
for (x, y) in [(x, y) for x in range(39, 43) for y in (24, 25)]: s.block[y][x] = True; s.occ_.add((x, y))
SW_X, SW_B = 44, 28
swi = G('sand_stairwell'); swc = []
for i in range(4):
    for j in range(4):
        if i in (0, 3): swc.append((SW_X + i, SW_B - j))
struct(swi, SW_X, SW_B, block=swc, name='sand_stairwell', sorty=(SW_B + 1) * 16 - 8)
for (x, y) in [(SW_X + i, SW_B - j) for i in (1, 2) for j in range(4)]: s.occ_.add((x, y))
s.marks['stair_down'] = (SW_X + 1, SW_B - 3)
# 길 표지 화톳불 기둥(성문 앞)
assert put('road_pylon', 24, 29) and put('road_pylon', 30, 29)
# 오아시스: 야자·갈대·낙타 말뚝·물통
for (n, x, y) in (('palm_tall', 3, 33), ('palm_lean', 6, 30), ('palm_short', 15, 31), ('palm_tall', 16, 37), ('palm_young', 4, 37), ('palm_young', 9, 37), ('palm_short', 2, 38)):
    put(n, x, y)
for y in range(H):
    for x in range(OW):
        if WATER[y][x] or not LAWN[y][x]: continue
        near = any(0 <= x + dx < OW and 0 <= y + dy < H and WATER[y + dy][x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        if near and wl.hash2(x, y, 11) > 0.5: deco('reeds', x, y, dy=-2)
put('hitch_rail', 19, 35); put('camel_lying', 20, 37); put('camel_standing', 17, 34) if False else put('camel_standing', 22, 36)
put('trough', 18, 31)
s.marks['oasis'] = (17, 33)
# 바깥 망루 잔해(남동) + 잔해
put('watchtower_stump', 46, 36, brows=3)
put('rubble_sand', 42, 38) if 'rubble_sand' in META else None
s.marks['watchtower'] = (47, 37)
s.marks['south_entry'] = (27, H - 1)
# 성벽 밑 모래 비탈(서쪽 언덕이 성벽·탑을 덮는다)
put('sand_heap_l', 0, 25, force=True, sorty=26 * 16); put('sand_heap_l', 6, 25, sorty=26 * 16)
# 성벽 윗면을 넘어온 모래(성 뒤·서쪽 언덕이 통로 위까지 덮었다) — 구조물 위에 덧그림(막힘은 구조물이 이미 막는다)
for (n, x, y, fl) in (('sand_heap_l', 7, 4, False), ('sand_heap_s', 14, 4, True), ('sand_heap_l', 43, 4, True), ('sand_heap_s', 39, 4, False),
                      ('sand_heap_l', 3, 14, False), ('sand_heap_s', 4, 11, True), ('sand_heap_s', 50, 9, False), ('sand_heap_s', 21, 3, True)):
    im_ = G(n).transpose(Image.FLIP_LEFT_RIGHT) if fl else G(n)
    s.at(im_, x, y, block=[], shadow=False, sorty=(y + 1) * 16 + 40); COUNT[n] = COUNT.get(n, 0) + 1
for (mx, my) in list(s.marks.values()):
    for (ddx, ddy) in ((0, 0), (1, 0), (-1, 0), (0, 1)): s.occ_.add((mx + ddx, my + ddy))

# ================================================================ 야외: 빈 사막 채우기(언덕 능선·바위·마른 덤불 덩이)
DUNES = []; DUNE_OCC = set(); DUNE_COV = np.zeros((H, OW)); _DN = [0]
def gen_dune(wc, hc):
    _DN[0] += 1; sd = 900 + _DN[0]; Wd, Hd = wc * 16, hc * 16
    base = Hd * (0.55 + rng.random() * 0.1); amp = Hd * (0.18 + rng.random() * 0.14)
    skew = 0.35 + rng.random() * 0.3; ph = rng.random() * 6.28; wa = 0.6 + rng.random() * 1.2
    pts = []
    for x in range(2, Wd - 1, 3):
        t = (x - 2) / (Wd - 4); arch = math.sin(math.pi * (t ** (math.log(0.5) / math.log(skew))))
        pts.append((x, base - amp * arch + wa * math.sin(x / 9.0 + ph)))
    return PP._dune(Wd, Hd, pts, sd)
def dune(img, cx, cy, flip=False):
    if flip: img = img.transpose(Image.FLIP_LEFT_RIGHT)
    wc = (img.width + 15) // 16; hc = (img.height + 15) // 16
    if cx < 0 or cx + wc > OW or cy - hc + 1 < 0 or cy >= H: return False
    for j in range(hc):
        for i in range(wc):
            x, y = cx + i, cy - j
            if STRUCT[y][x] or COURT[y][x] or WATER[y][x] or TRAIL[y][x] or LAWN[y][x] or DUNEM[y][x] or (x, y) in s.occ_ or (x, y) in DUNE_OCC: return False
    DUNES.append((img, cx * 16, (cy + 1) * 16 - img.height))
    for j in range(hc):
        for i in range(1, wc - 1): DUNE_OCC.add((cx + i, cy - j))
    a = np.array(img)[:, :, 3] > 0
    for j in range(hc):
        for i in range(wc):
            y0 = img.height - (j + 1) * 16; blk = a[max(0, y0):y0 + 16, i * 16:i * 16 + 16]
            DUNE_COV[cy - j, cx + i] = max(DUNE_COV[cy - j, cx + i], blk.mean() if blk.size else 0)
    COUNT['dune'] = COUNT.get('dune', 0) + 1; return True
# 성 뒤·옆 깊은 모래 언덕(능선 장식만, 막힘)
for (wc, hc, x, y) in ((5, 2, 7, 2), (6, 3, 12, 2), (4, 2, 38, 2), (6, 3, 43, 2), (3, 2, 53, 6), (3, 2, 53, 13), (3, 2, 53, 21), (3, 2, -1, 10), (3, 2, -1, 15)):
    im_ = gen_dune(wc, hc); DUNES.append((im_, x * 16, (y + 1) * 16 - im_.height))
mk = lambda n, **k: (lambda x, y: put(n, x, y, **k))
mkd = lambda n: (lambda x, y: deco(n, x, y))
def cluster(cx, cy, rx, ry, n, makers, tries=16):
    placed = 0
    for _ in range(n * tries):
        if placed >= n: break
        ang = rng.random() * 6.2832; d = math.sqrt(rng.random())
        x = int(round(cx + math.cos(ang) * rx * d)); y = int(round(cy + math.sin(ang) * ry * d))
        if 0 <= x < OW and 0 <= y < H and not DEEP(x, y) and rng.choice(makers)(x, y): placed += 1
    return placed
for (cx, cy) in ((36, 33), (52, 30), (7, 26), (33, 38), (51, 39), (20, 27)):
    cluster(cx, cy, 2.5, 1.6, 3, [mk('sand_boulder'), mk('sand_boulder_s'), mkd('pebbles'), mk('scrub'), mkd('dry_tuft'), mk('cactus_column'), mk('cactus_barrel')])
for (wc, hc, x, y) in ((6, 3, 32, 33), (5, 2, 48, 32), (6, 3, 37, 38), (4, 2, 0, 28), (5, 3, 20, 30), (4, 2, 51, 27), (6, 3, 8, 40 - 1)):
    dune(gen_dune(wc, hc), x, y, flip=rng.random() < 0.4)

def cov_grid():
    cov = np.zeros((H, OW))
    for (sy, x, y, im, sh) in s.objs:
        if im.width * im.height > 30000: continue
        al = np.array(im)[:, :, 3] > 128; h, w = al.shape
        for cy in range(max(0, y // 16), min(H, (y + h - 1) // 16 + 1)):
            for cx in range(max(0, x // 16), min(OW, (x + w - 1) // 16 + 1)):
                x0, y0 = max(cx * 16, x), max(cy * 16, y); x1, y1 = min(cx * 16 + 16, x + w), min(cy * 16 + 16, y + h)
                if x1 > x0 and y1 > y0: cov[cy, cx] = max(cov[cy, cx], al[y0 - y:y1 - y, x0 - x:x1 - x].sum() / 256.0)
    return cov
def empty_cells():
    cov = cov_grid(); e = np.zeros((H, OW), bool)
    for y in range(H):
        for x in range(OW):
            e[y, x] = not (DEEP(x, y) or cov[y, x] >= 0.2 or DUNE_COV[y, x] >= 0.15 or TRAIL[y][x] or PATHC[y][x] or WATER[y][x] or STRUCT[y][x] or DRIFT[y][x] or SANDB[y][x] or DUNEM[y][x] or (x, y) in s.occ_)
            if COURT[y][x] and not DRIFT[y][x] and not SANDB[y][x] and not PATHC[y][x] and cov[y, x] < 0.2 and (x, y) not in s.occ_: e[y, x] = True
    return e
def worst(e):
    best = (0, 0, 0)
    for y in range(0, H - 15 + 1):
        for x in range(0, OW - 20 + 1):
            r = e[y:y + 15, x:x + 20].mean()
            if r > best[0]: best = (r, x, y)
    return best
TRIED = set(); DONE = set()
for it in range(400):
    e = empty_cells(); bw = (0, 0, 0)
    for y in range(0, H - 15 + 1):
        for x in range(0, OW - 20 + 1):
            if (x, y) in DONE: continue
            r_ = e[y:y + 15, x:x + 20].mean()
            if r_ > bw[0]: bw = (r_, x, y)
    r, wx, wy = bw
    if r <= 0.36: break
    best = None
    for y in range(wy, wy + 15):
        for x in range(wx, wx + 20):
            if e[y, x] and (x, y) not in TRIED and not COURT[y][x]:
                sc = e[max(0, y - 2):y + 3, max(0, x - 3):x + 4].sum() + rng.random() * 0.5
                if best is None or sc > best[0]: best = (sc, x, y)
    if best is None: DONE.add((wx, wy)); continue
    _, bx, by = best; TRIED.add((bx, by)); ok = False
    if LAWN[by][bx]: ok = cluster(bx, by, 1.5, 1.0, 1, [mk('palm_young'), mk('palm_short')])
    if not ok:
        for (ddx, ddy) in ((-2, 1), (-3, 0), (-1, 2), (-2, -1), (-1, 0)):
            wc = rng.randrange(4, 8); hc = 2 if wc < 6 else 3
            if dune(gen_dune(wc, hc), bx + ddx, by + ddy, flip=rng.random() < 0.4): ok = True; break
    if not ok:
        for (ddx, ddy) in ((-1, 0), (0, 1), (-1, -1), (0, 0)):
            if dune(gen_dune(3, 2), bx + ddx, by + ddy, flip=rng.random() < 0.4): ok = True; break
    if not ok: ok = cluster(bx, by, 1.2, 0.8, 1, [mk('sand_boulder_s'), mk('scrub'), mk('cactus_barrel')])
    if ok and rng.random() < 0.3: cluster(bx, by, 1.6, 1.0, 1, [mkd('dry_tuft'), mkd('pebbles')])
E_OUT = empty_cells(); WORST_OUT = worst(E_OUT)

# ================================================================ 야외 그리기
def perturb(mask_cells, seed, amp=6):
    m0 = np.kron(np.array(mask_cells, bool), np.ones((16, 16), bool))
    Yy, Xx = np.mgrid[0:Hp, 0:Wp]
    dx = np.rint((wl.tnoise(Wp, Hp, 8, seed) - 0.5) * amp + (wl.tnoise(Wp, Hp, 4, seed + 1) - 0.5) * 3).astype(int)
    dy = np.rint((wl.tnoise(Wp, Hp, 8, seed + 2) - 0.5) * amp + (wl.tnoise(Wp, Hp, 4, seed + 3) - 0.5) * 3).astype(int)
    return m0[np.clip(Yy + dy, 0, Hp - 1), np.clip(Xx + dx, 0, Wp - 1)]
def cell_of(sheet, n): return sheet.crop(((n % 4) * 16, (n // 4) * 16, (n % 4) * 16 + 16, (n // 4) * 16 + 16))
SPILL = IN.sand_spill_sheet(); RAIL = IN.brass_rail_sheet()
POND_AT = FX.pond_sheet(); GRASS_AT = FX.grass_sheet(); DUNE_AT = FX.dune_sheet()
def render_out():
    img, lab = ground.render(Wp, Hp, [], np.zeros((Hp, Wp), bool), s.seed)
    Yy, Xx = np.mgrid[0:Hp, 0:Wp]
    nz = A.Noise(Wp, Hp)
    ripc = np.full((H, OW), 0.4)
    for y in range(H):
        for x in range(OW):
            if LAWN[y][x] or COURT[y][x]: ripc[y, x] = 0.0
            elif y < 3 or x < 3 or x > 52: ripc[y, x] = 0.9
    ripc = ndi.gaussian_filter(ripc, 1.6)
    rip = np.kron(ripc, np.ones((16, 16))) * (0.6 + 0.6 * A.vn_full(Wp, Hp, 40, 7))
    sand = A.sand_rgb(Xx, Yy, nz, rip, seed=731)
    img.alpha_composite(Image.fromarray(np.dstack([sand.astype(np.uint8), np.full((Hp, Wp), 255, np.uint8)]), 'RGBA'))
    lay = Image.new('RGBA', (Wp, Hp))                                   # 보정: 오아시스 풀 덩이·모래 언덕 덩이 오토타일
    for y in range(H):
        for x in range(OW):
            if LAWN[y][x]: lay.alpha_composite(cell_of(GRASS_AT, nbits(LAWN, x, y)), (x * 16, y * 16))
            if DUNEM[y][x]: lay.alpha_composite(cell_of(DUNE_AT, nbits(DUNEM, x, y)), (x * 16, y * 16))
    img.alpha_composite(lay)
    # 안뜰 판석
    lay = Image.new('RGBA', (Wp, Hp))
    CF = IN.SAMPLES['dc_court']
    for y in range(H):
        for x in range(OW):
            if COURT[y][x] or (PATHC[y][x] and y < 24):
                lay.alpha_composite(CF.crop((x % 3 * 16, y % 3 * 16, x % 3 * 16 + 16, y % 3 * 16 + 16)), (x * 16, y * 16))
    img.alpha_composite(lay)
    # 참배 길: 작은 사암 벽돌 판석(dp flag) + 양옆 연석
    pm = np.kron(np.array([[PATHC[y][x] and 12 <= y <= 18 for x in range(OW)] for y in range(H)], bool), np.ones((16, 16), bool))
    pr = A.flag_rgb(Xx, Yy, seed=47)
    edge = pm & ~ndi.binary_erosion(pm, iterations=2, border_value=0)
    pr = np.where(edge[..., None], np.where(((Xx % 32) < 16)[..., None], A.P('sstone')[5], A.P('sstone')[4]), pr)
    pr = np.where((pm & ~ndi.binary_erosion(pm, iterations=1, border_value=0))[..., None], A.P('sstone')[2], pr)
    img.alpha_composite(Image.fromarray(np.dstack([pr.astype(np.uint8), np.where(pm, 255, 0).astype(np.uint8)]), 'RGBA'))
    # 안뜰 동쪽 모래 몸: 화소 경계, 모래 결·잔물결, 왼·위 가장자리 밝은 턱, 아래·오른 가장자리 그늘, 언덕 마루 둘
    cpx = np.kron(np.array(COURT, bool), np.ones((16, 16), bool))
    sbm = perturb(SANDB, 61, 12) & cpx
    sbm = ndi.binary_closing(ndi.binary_opening(sbm, iterations=2), iterations=2) & cpx
    srgb = A.sand_rgb(Xx, Yy, nz, np.full((Hp, Wp), 0.85), seed=761)
    left = np.zeros_like(sbm); left[:, 1:] = sbm[:, :-1]
    up = np.zeros_like(sbm); up[1:] = sbm[:-1]
    dn = np.zeros_like(sbm); dn[:-1] = sbm[1:]
    srgb = np.where((sbm & ~left)[..., None] | (sbm & ~up)[..., None], A.P('sand')[6], srgb)
    srgb = np.where((sbm & ~dn)[..., None], A.P('sand')[2], srgb)
    img.alpha_composite(Image.fromarray(np.dstack([srgb.astype(np.uint8), np.where(sbm, 255, 0).astype(np.uint8)]), 'RGBA'))
    shd = np.zeros((Hp, Wp, 4), np.uint8); below = np.zeros_like(sbm); below[1:3] = 0
    b1 = np.zeros_like(sbm); b1[1:] = sbm[:-1]; b2 = np.zeros_like(sbm); b2[2:] = sbm[:-2]
    shd[(b1 | b2) & ~sbm & cpx] = (60, 30, 14, 80)
    img.alpha_composite(Image.fromarray(shd, 'RGBA'))
    for (dw, dh, dxp, dyp) in ((6, 3, 41 * 16, 9 * 16 + 4), (5, 2, 43 * 16 + 6, 14 * 16 + 4)):
        dimg = gen_dune(dw, dh); da = np.array(dimg); sub = sbm[dyp:dyp + da.shape[0], dxp:dxp + da.shape[1]]
        da[:sub.shape[0], :sub.shape[1], 3] = np.where(sub, da[:sub.shape[0], :sub.shape[1], 3], 0)
        img.alpha_composite(Image.fromarray(da, 'RGBA'), (dxp, dyp))
    # 벽 그늘(안뜰): 북쪽 벽 밑 4px, 서쪽 띠 동쪽 3px
    sh = np.zeros((Hp, Wp, 4), np.uint8)
    for y in range(H):
        for x in range(OW):
            if not COURT[y][x]: continue
            if y > 0 and STRUCT[y - 1][x]: sh[y * 16:y * 16 + 4, x * 16:x * 16 + 16] = (60, 30, 14, 70)
            if x > 0 and STRUCT[y][x - 1] and x - 1 in (4, 5): sh[y * 16:y * 16 + 16, x * 16:x * 16 + 3] = (60, 30, 14, 60)
    img.alpha_composite(Image.fromarray(sh, 'RGBA'))
    # 오토타일: 길·모래 번짐
    TR = U.trail(); lay = Image.new('RGBA', (Wp, Hp))
    for y in range(H):
        for x in range(OW):
            if TRAIL[y][x]: lay.alpha_composite(cell_of(TR, nbits(TRAIL, x, y)), (x * 16, y * 16))
            if DRIFT[y][x]: lay.alpha_composite(cell_of(SPILL, nbits(DRIFT, x, y)), (x * 16, y * 16))
    img.alpha_composite(lay)
    for (im, x, y) in DUNES: img.alpha_composite(im, (x, y))
    # 오아시스 못
    lay = Image.new('RGBA', (Wp, Hp))                                   # 보정: 오아시스 못 = autotile-oasis-pond(막힘)
    for y in range(H):
        for x in range(OW):
            if WATER[y][x]: lay.alpha_composite(cell_of(POND_AT, nbits(WATER, x, y)), (x * 16, y * 16))
    img.alpha_composite(lay)
    for sy, x, y, im, shd in sorted(s.objs, key=lambda o: (o[0], o[1])):
        if x >= 0 and y >= 0: img.alpha_composite(im, (x, y))
        else: img.alpha_composite(im.crop((max(0, -x), max(0, -y), im.width, im.height)), (max(0, x), max(0, y)))
    # 앞으로 나온 탑·문루·본관이 오른쪽 성벽 앞면에 드리운 그늘(빛 왼쪽 위)
    arr = np.array(img).astype(np.float32)
    for (xe, y0, y1) in ((6 * 16, 5 * 16 + 2, 8 * 16 - 2), (6 * 16, 21 * 16 + 2, 24 * 16 - 2), (31 * 16, 21 * 16 + 2, 24 * 16 - 2), (37 * 16, 5 * 16 + 2, 8 * 16 - 2)):
        for k in range(7):
            yy1 = y1
            if xe == 6 * 16 and y0 > 20 * 16: yy1 = min(y1, (FW_B + 1) * 16 - west_bury(k))   # 보정: 묻힌 성벽 앞 모래 비탈엔 그늘을 드리우지 않는다
            arr[y0:yy1, xe + k, :3] *= 0.70 + 0.042 * k
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGBA')

def walk_out():
    deep = DEEP
    return [[(not s.block[y][x]) and (not WATER[y][x]) and (not STRUCT[y][x]) and not deep(x, y) for x in range(OW)] for y in range(H)]

# ================================================================ 실내: 지하 기계실 (KMap)
class IMap(IN.KMap):
    pass
km = IMap(W - IW0, H, 'desert-castle-cellar')
km.ceil_fn = IN.ceiling
def L(x, y): return (x + IOX, y + IOY)
def floor(x0, y0, w, h, kind='dc_cellar'):
    km.floor(x0 + IOX, y0 + IOY, w, h, kind, wh=3, sty='dcastle')
floor(6, 5, 25, 10)                  # 기계실 홀 x6~30, y5~14
floor(30, 5, 6, 5)                   # 북동 계단 자리
floor(8, 8, 20, 7, 'dc_plate')       # 기계 쇠판
floor(3, 19, 11, 7)                  # 남서 펌프실 y19~25
floor(20, 19, 15, 7)                 # 남동 무너진 창고
floor(7, 15, 2, 4); floor(24, 15, 2, 4)        # 홀 ↔ 남쪽 방 통로(벽 두께 4줄 = 윗면 1 + 앞면 3)
floor(14, 23, 6, 3)                  # 남쪽 복도(두 방을 고리로 잇는다)
km.cut(3 + IOX, 19 + IOY, 1, 2); km.cut(34 + IOX, 19 + IOY, 1, 3)   # 방 모서리 깎기(네모 깨기)
def iput(n, x, y, rows=None, soft=None, img=None, flip=False):
    im = img or G(n)
    if flip: im = im.transpose(Image.FLIP_LEFT_RIGHT)
    md = META.get(n, {}); br = md.get('brows', 1) if rows is None else rows
    sft = md.get('soft', False) if soft is None else soft
    gx, gy = L(x, y)
    if br == 0: km.props_add(gx, gy, im, [], 1)
    else: km.put(gx, gy, im, rows=br, soft=sft)
    COUNT[n] = COUNT.get(n, 0) + 1
def idecal(n, x, y, img=None):
    gx, gy = L(x, y); km.decal(gx, gy, img or G(n)); COUNT[n] = COUNT.get(n, 0) + 1
# 북쪽 벽 앞면(y2~4)
idecal('wall_gear', 6, 2); idecal('pipe_wall_v', 10, 2); idecal('pipe_wall_v', 13, 2); idecal('wall_lamp', 11, 3)
iput('gear_vault_door', 14, 5, rows=4)                # 앞면 3줄 + 문턱(막힘, 여는 이벤트)
idecal('gauge_panel', 21, 2); idecal('pipe_wall_v', 24, 2); idecal('wall_lamp', 26, 3); idecal('wall_lamp', 29, 3)
idecal('stair_arch_sand', 31, 2)
iput('stair_up_sand', 31, 8, rows=0)
km.blocked.update({L(31, y) for y in range(5, 9)} | {L(34, y) for y in range(5, 9)})
# 홀 바닥: 서쪽 피스톤 기관, 가운데 톱니 구덩이(난간), 동쪽 보일러 쌍·관성 바퀴, 북쪽 기어 문 앞 조종대
iput('lever_console', 20, 7, rows=2); iput('workbench', 23, 7, rows=2)
iput('pipe_floor_h', 7, 5, rows=1); iput('pipe_floor_h', 26, 5, rows=1)
iput('gear_train', 7, 8, rows=2)
iput('piston_engine', 6, 13, rows=2)
iput('floor_gear_pit', 15, 12, rows=2)
RAILC = {L(x, y) for (x, y) in [(14, 10), (15, 10), (16, 10), (17, 10), (18, 10), (14, 11), (18, 11), (14, 12), (18, 12), (14, 13), (15, 13), (16, 13), (17, 13), (18, 13)]}
km.over.append((RAILC, RAIL)); km.blocked.update(RAILC)
iput('boiler', 22, 10, rows=2); iput('boiler', 25, 10, rows=2)
iput('pipe_floor_h', 22, 12, rows=1)
iput('flywheel_stand', 27, 14, rows=2)
iput('oil_drums', 12, 10); iput('oil_drums', 27, 9); iput('oil_drums', 21, 14)
iput('valve_post', 12, 9); iput('valve_post', 20, 12)
iput('gear_crate', 11, 6); iput('gear_crate', 12, 6); iput('gear_crate', 29, 11); iput('gear_crate', 13, 14)
iput('chain_hook', 12, 7, rows=0); iput('chain_hook', 23, 13, rows=0)
idecal('steam_grate', 21, 12); idecal('steam_grate', 9, 14); idecal('steam_grate', 25, 13); idecal('steam_grate', 8, 16); idecal('steam_grate', 16, 7)
# 계단 밑 모래 번짐(위에서 새어 든 모래가 홀 동쪽으로 퍼진다)
SPILLC = {L(x, y) for (x, y) in [(30, 9), (31, 9), (32, 9), (33, 9), (34, 9), (35, 9), (29, 9), (29, 8), (28, 9), (29, 10), (30, 10), (30, 11), (28, 10),
                                 (30, 12), (29, 12), (30, 13), (26, 9), (27, 10), (28, 11)]}
# 남서 펌프실(y19~25)
idecal('wall_gear', 4, 16); idecal('gauge_panel', 11, 16); idecal('wall_lamp', 9, 17); idecal('pipe_wall_v', 6, 16)
iput('pump_engine', 10, 23, rows=2); iput('cistern_well', 4, 25, rows=2)
iput('lever_console', 4, 21, rows=2); iput('valve_post', 6, 21)
iput('pipe_floor_h', 9, 25, rows=1); iput('gear_crate', 10, 20); iput('oil_drums', 11, 19); iput('gear_crate', 12, 25)
idecal('steam_grate', 6, 23); iput('gear_crate', 13, 21)
# 남동 창고(모래가 샌다)
iput('sand_leak', 28, 19, rows=0)
iput('machine_wreck', 30, 22, rows=1); iput('gear_crate', 21, 20); iput('gear_crate', 22, 20); iput('gear_crate', 21, 21); iput('gear_crate', 33, 20)
iput('sand_heap_l', 31, 25, rows=0); iput('sand_heap_s', 26, 23, rows=0); iput('flywheel_stand', 21, 25, rows=2, flip=True)
idecal('wall_lamp', 23, 17); idecal('pipe_wall_v', 32, 16); idecal('wall_gear', 20, 16)
iput('chain_hook', 25, 21, rows=0); iput('oil_drums', 23, 23)
for y in range(19, 26):
    for x in range(20, 35):
        if km.open(*L(x, y)) and (abs(x - 28.5) / 6.5 + abs(y - 20) / 4.5 < 1.0 + 0.35 * wl.hash2(x, y, 9) or (x >= 29 and y >= 22)):
            SPILLC.add(L(x, y))
SPILLC |= {L(24, 18), L(25, 18), L(25, 17), L(24, 17)}
SPILLC = {c for c in SPILLC if km.open(*c)}
km.under.append((SPILLC, SPILL))
km.marks['stair_top'] = L(32, 5); km.marks['vault_door'] = L(16, 6); km.marks['engine'] = L(9, 14)
km.marks['pump_room'] = L(8, 23); km.marks['store_room'] = L(26, 25); km.marks['corridor'] = L(17, 24)

def interior_empty():
    """20x15 창 빈 바닥 비율(물체가 덮지 않은 바닥 칸, 모래 번짐·창살은 채움)."""
    cov = np.zeros((km.H, km.W))
    for (x, y, img, w, h, layer) in km.props:
        al = np.array(img)[:, :, 3] > 128
        for j in range(h):
            for i in range(w):
                blk = al[img.height - (j + 1) * 16:img.height - j * 16, i * 16:i * 16 + 16]
                if blk.size and 0 <= y - j < km.H and 0 <= x + i < km.W: cov[y - j, x + i] = max(cov[y - j, x + i], blk.mean())
    for (x, y, img) in km.decals:
        for j in range(img.height // 16):
            for i in range(img.width // 16):
                if 0 <= y + j < km.H and 0 <= x + i < km.W: cov[int(y) + j, int(x) + i] = max(cov[int(y) + j, int(x) + i], 0.5)
    e = np.zeros((km.H, km.W), bool)
    for y in range(km.H):
        for x in range(km.W):
            if km.fl[y][x] and cov[y, x] < 0.2 and (x, y) not in SPILLC and (x, y) not in RAILC: e[y, x] = True
    open(HERE + '/_qa/inner_empty.txt', 'w').write('\n'.join(''.join('e' if e[y, x] else ('.' if km.fl[y][x] else ' ') for x in range(km.W)) for y in range(km.H)))
    best = (0, 0, 0)
    for y in range(IOY, IOY + 30 - 15 + 1):
        for x in range(IOX, IOX + 40 - 20 + 1):
            r = e[y:y + 15, x:x + 20].mean()
            if r > best[0]: best = (r, x, y)
    return best

# ================================================================ 합치기 · 통행 · 내보내기
def compose():
    out = Image.new('RGBA', (W * 16, H * 16), (0, 0, 0, 255))
    out.alpha_composite(render_out(), (0, 0))
    out.alpha_composite(km.render(), (IW0 * 16, 0))
    return out

def walk_all():
    wo = walk_out(); g = [[False] * W for _ in range(H)]
    for y in range(H):
        for x in range(OW): g[y][x] = wo[y][x]
        for x in range(km.W): g[y][IW0 + x] = km.is_walk(x, y)
    return g

def bfs(g, start):
    from collections import deque
    seen = {start}; q = deque([start])
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (x + dx, y + dy)
            if 0 <= n[0] < W and 0 <= n[1] < H and n not in seen and g[n[1]][n[0]]: seen.add(n); q.append(n)
    return seen

def all_marks():
    m = {k: tuple(v) for k, v in s.marks.items()}
    for k, v in km.marks.items(): m['cellar_' + k] = (v[0] + IW0, v[1])
    return m

if __name__ == '__main__':
    im = compose()
    g = walk_all(); M = all_marks()
    r0 = bfs(g, M['south_entry']) | bfs(g, M['cellar_stair_top'])
    for y in range(H):                                                  # 남은 1~2칸 주머니(야자·갈대에 갇힌 칸)는 덤불로 막힘 처리
        for x in range(OW):
            if g[y][x] and (x, y) not in r0: POCKET.add((x, y)); g[y][x] = False
    print('pockets', sorted(POCKET))
    r_out = bfs(g, M['south_entry']); r_in = bfs(g, M['cellar_stair_top'])
    reach = {k: (v in r_out or v in r_in) for k, v in M.items()}
    link_ok = M['stair_down'] in r_out and M['cellar_stair_top'] in r_in
    wi = interior_empty()
    walk_cells = sum(1 for y in range(H) for x in range(W) if g[y][x]); isolated = walk_cells - len(r_out | r_in)
    print(im.size, 'unreached', [k for k, v in reach.items() if not v], 'link', link_ok, 'isolated', isolated,
          'worst empty out', [round(float(WORST_OUT[0]), 3), WORST_OUT[1], WORST_OUT[2]], 'in', [round(float(wi[0]), 3), wi[1] + IW0, wi[2]])
    if '--noexport' in sys.argv:
        os.makedirs(HERE + '/_qa', exist_ok=True); im.convert('RGB').save(HERE + '/_qa/render.png')
        json.dump({'rows': [''.join('.' if g[y][x] else '#' for x in range(W)) for y in range(H)], 'empty': [''.join('e' if E_OUT[y, x] else '.' for x in range(OW)) for y in range(H)]}, open(HERE + '/_qa/grid.json', 'w'))
    else:
        import dc_export
        dc_export.export(im, g, M, reach, link_ok, isolated, WORST_OUT, wi, COUNT, W, H, IW0)
