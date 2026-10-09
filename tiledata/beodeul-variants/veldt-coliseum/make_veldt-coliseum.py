# 대초원·투기장 (veldt-coliseum) — 80x61 JRPG 필드(대초원 80x48) + 투기장 지하 대기실(40x11). 다시 돌리면 같은 그림이 나온다.
#   python3 make_veldt-coliseum.py
# 동선: 서쪽 끝 짐승 길 / 남쪽 끝 옛 돌길 → 투기장 앞마당(깃대·화로·승리 기둥·노점) → 정문 아치(문길 2칸, 가림) → 경기장 모래
#       → 북쪽 지도자 발코니 아래 쇠창살 문 = 지하 대기실 계단(LINKS). 곁: 북서 바위 언덕·고목, 남서 야영 흔적, 남동 물웅덩이·짐승 뼈.
import sys, os, json, math, random
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from vc_base import *
from vc_base import _dry_col
from bdA import _tint
import vc_coliseum as VC, vc_veldt as VV, vc_props as VP, vc_under as VU, vc_auto as VA
from scipy import ndimage as ndi

W, H = 80, 61
HF = 48                                   # 야외(필드) 줄 수
RX0, RY0 = 20, 49                         # 지하 실내 원점(칸)
rng = random.Random(8061)
s = Scene('veldt-coliseum', W, H, seed=86)
VAR = os.path.join(HERE, '..')
def reuse(path): return Image.open(os.path.join(VAR, path)).convert('RGBA')
LOG_SEAT = reuse('plains-highroad/parts/log_seat.png')                  # 다른 장소 조각(지도에만)

def grid(v=False): return [[v] * W for _ in range(H)]
TRAIL, PAVE, ARENA, DRYG, NOGO = grid(), grid(), grid(), grid(), grid()

# ================================================================ 투기장 자리
CO_X, CO_Y = 40, 1                         # 외피 왼쪽 위 칸
OX, OY = CO_X * 16, CO_Y * 16
def co_rho(cx, cy):
    r, th = VC.rho_th(cx * 16 + 8 - OX, cy * 16 + 8 - OY); return r, th
GATE_X = (55, 56)
lay, _lab = VC.coliseum_layers()
extras = VC.coliseum_extras()
shell_full = Image.new('RGBA', (VC.W, VC.H))
for (img, x, y, sy) in sorted(lay + extras, key=lambda t: t[3]): shell_full.alpha_composite(img, (max(0, x), max(0, y)))
SA = np.array(shell_full)[:, :, 3]
for (img, x, y, sy) in lay + extras:
    s.sprite(img, OX + x, OY + y, [], shadow=False, sorty=OY + sy)
GY_P = OY + VC.CY - VC.RY * VC.RHO_A                  # 북쪽 경기장 담 줄(px)
G_ROW = int(GY_P // 16)                               # 쇠창살 문 앞 칸 줄
TUN_TOP = int((OY + VC.CY + VC.RY * VC.RHO_A) // 16)  # 문길 북쪽 끝(남쪽 경기장 담)
TUN_BOT = int((OY + VC.CY + VC.RY) // 16)             # 문길 남쪽 끝(외벽 발치)
for cy in range(0, HF):
    for cx in range(CO_X, CO_X + VC.W // 16):
        lx, ly = cx * 16 + 8 - OX, cy * 16 + 8 - OY
        if not (0 <= lx < VC.W and 0 <= ly < VC.H): continue
        r, th = co_rho(cx, cy)
        covered = SA[ly, lx] > 0
        if r < VC.RHO_A - 0.02: ARENA[cy][cx] = True
        if r < VC.RHO_A + 0.01: ARENA_PAINT = True
        if covered and not (cx in GATE_X and TUN_TOP - 1 <= cy <= TUN_BOT):
            s.block[cy][cx] = True; NOGO[cy][cx] = True
        elif r <= 1.0 and not ARENA[cy][cx] and not (cx in GATE_X and cy >= TUN_TOP - 1):
            s.block[cy][cx] = True; NOGO[cy][cx] = True
        if r <= 1.04: NOGO[cy][cx] = True
for cy in (G_ROW, G_ROW + 1):
    for cx in GATE_X: s.block[cy][cx] = False
for cy in range(int((OY + VC.CY) // 16), TUN_BOT + 1):                 # 문길(정문 → 경기장, 외피에 가린다)
    for cx in GATE_X: s.block[cy][cx] = False
s.marks['arena_gate'] = (55, G_ROW)
s.marks['arena_center'] = (56, int((OY + VC.CY) // 16))
s.marks['gate_out'] = (55, TUN_BOT + 1)

# 경기장 모래(아래층): 타원 안쪽 전부(외피가 가장자리를 덮는다)
SAND = VA.ground_sand()
sand_im = Image.new('RGBA', (W * 16, H * 16)); sp = sand_im.load(); st = SAND.load()
for y in range(OY, OY + VC.H):
    for x in range(OX, OX + VC.W):
        r, th = VC.rho_th(x - OX, y - OY)
        if r < VC.RHO_A + 0.02:
            c = st[x % 48, y % 48]
            if r > VC.RHO_A - 0.05: c = mul(c, 0.78) + (255,)          # 담 발치 그늘
            sp[x, y] = c
        elif r <= 1.0 and VC.CY < y - OY and abs(x - OX - VC.CX) < 24:
            sp[x, y] = mul(st[x % 48, y % 48], 0.5) + (255,)                # 문길 바닥(어둠)
s.overlays.append((sand_im, 0, 0))
# 외벽 발치 그림자(남쪽 반)
shade = Image.new('RGBA', (W * 16, H * 16)); shp = shade.load()
for y in range(OY + int(VC.CY), OY + VC.H + 8):
    for x in range(OX, OX + VC.W):
        r, th = VC.rho_th(x - OX, y - OY)
        if 1.0 < r < 1.05: shp[x, y] = (20, 18, 6, int(110 * (1.05 - r) / 0.05))
s.overlays_after = [(shade, 0, 0)]

# ================================================================ 길: 앞마당 판석 + 옛 돌길(남·서), 짐승 흙길
PLAZA = [(x, y) for x in range(47, 66) for y in range(27, 33) if not (y == 32 and (x < 49 or x > 63))]
for (x, y) in PLAZA: PAVE[y][x] = True
for x in range(22, 47):
    for y in (29, 30): PAVE[y][x] = True
for y in range(29, HF):
    for x in (21, 22): PAVE[y][x] = True
for y in range(TUN_BOT, 27):
    for x in GATE_X: PAVE[y][x] = True
def polyline(g, pts, w=1):
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        x, y = x0, y0
        while (x, y) != (x1, y1):
            for i in range(w):
                for j in range(w):
                    if 0 <= x + i < W and 0 <= y + j < HF: g[y + j][x + i] = True
            if abs(x1 - x) >= abs(y1 - y) and x != x1: x += 1 if x1 > x else -1
            elif y != y1: y += 1 if y1 > y else -1
            else: x += 1 if x1 > x else -1
        for i in range(w):
            for j in range(w):
                if 0 <= x1 + i < W and 0 <= y1 + j < HF: g[y1 + j][x1 + i] = True
polyline(TRAIL, [(0, 18), (5, 19), (9, 22), (14, 23), (18, 25), (21, 27), (26, 28)], 2)              # 서쪽 짐승 길 → 돌길
polyline(TRAIL, [(34, 31), (37, 34), (42, 36), (48, 37), (55, 38), (60, 40)], 2)                      # 돌길 → 물웅덩이
polyline(TRAIL, [(13, 0), (14, 4), (16, 8), (18, 12), (18, 17), (17, 21), (16, 23)], 1)               # 북쪽 짐승 길
polyline(TRAIL, [(20, 36), (16, 37), (13, 38)], 1)                                                    # 돌길 → 야영지
polyline(TRAIL, [(66, 33), (70, 30), (74, 28), (79, 27)], 1)                                          # 앞마당 동쪽 → 동쪽 끝
for y in range(HF):
    for x in range(W):
        if PAVE[y][x] or NOGO[y][x]: TRAIL[y][x] = False
pave_im = VA.paving_soft(PAVE, joins=TRAIL)
TS = VA.game_trail()
def cell_of(sheet, n): return sheet.crop(((n % 4) * 16, (n // 4) * 16, (n % 4) * 16 + 16, (n // 4) * 16 + 16))
def nbits(mask, x, y, join=None):
    def on(xx, yy): return 0 <= xx < W and 0 <= yy < HF and (mask[yy][xx] or (join is not None and join[yy][xx]))
    return (1 if on(x, y - 1) else 0) | (2 if on(x + 1, y) else 0) | (4 if on(x, y + 1) else 0) | (8 if on(x - 1, y) else 0)
# 지도에서는 짐승 길을 화소 단위로 흔든 흙 덩이로 깐다(대각 굽이의 계단 모양을 없앤다). 붓·조수용은 autotile-gametrail.
TRAIL_D = [[TRAIL[y][x] or (PAVE[y][x] and any(0 <= y + j < H and 0 <= x + i < W and TRAIL[y + j][x + i] for i in (-1, 0, 1) for j in (-1, 0, 1))) for x in range(W)] for y in range(H)]
s.overlays.append((VA.earth_patch(TRAIL_D, 61, amp=6, open_r=0), 0, 0))
s.overlays.append((pave_im, 0, 0))
road_all = [[TRAIL[y][x] or PAVE[y][x] for x in range(W)] for y in range(H)]
s.road_px = lambda: np.kron(np.array(road_all, bool), np.ones((16, 16), bool))

# 밟혀 드러난 흙 덩이: 야영지·물웅덩이 둘레·짐승 뼈 자리
BARE = grid()
for (cx_, cy_, rx_, ry_) in ((10.5, 37.5, 6.0, 4.0), (65.5, 39.0, 6.5, 3.6), (60, 43, 4.0, 2.2), (7, 12.5, 4.5, 2.6)):
    for y in range(HF):
        for x in range(W):
            if ((x - cx_) / rx_) ** 2 + ((y - cy_) / ry_) ** 2 < 1 and not PAVE[y][x] and not NOGO[y][x]: BARE[y][x] = True
s.overlays.insert(1, (VA.earth_patch(BARE, 51), 0, 0))

# ================================================================ 점유·놓기
s.occ_ = set()
def occupy(x0, y0, x1, y1):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1): s.occ_.add((x, y))
def terrain_ok(x, y, allow_road=False):
    if not (0 <= x < W and 0 <= y < HF): return False
    if s.water[y][x] or (x, y) in s.occ_ or NOGO[y][x] or s.block[y][x]: return False
    if not allow_road and road_all[y][x]: return False
    return True
def near_road(x, y, r=1):
    for j in range(-r, r + 1):
        for i in range(-r, r + 1):
            xx, yy = x + i, y + j
            if 0 <= xx < W and 0 <= yy < H and road_all[yy][xx]: return True
    return False
COUNT = {}
def put(img, cx, cy, name, block=None, canopy_rows=0, base_w=None, allow_road=False, dx=0, dy=0, free=False, shadow=None):
    if shadow is None: shadow = img.height >= 40 and name not in ('booth', 'chariot_broken')
    wc = (img.width + 15) // 16; hc = (img.height + 15) // 16
    bw = base_w or wc
    for i in range(bw):
        if not terrain_ok(cx + i, cy, allow_road): return False
    for j in range(1, min(canopy_rows, hc)):
        for i in range(wc):
            xx, yy = cx + i, cy - j
            if yy < 0 or xx >= W: return False
            if road_all[yy][xx] or (xx, yy) in s.occ_ or s.block[yy][xx]: return False
    if cx < 0 or cx + wc > W or cy - hc + 1 < 0: return False
    if block is None: block = [(i, 0) for i in range(bw)]
    s.at(img, cx, cy, block=block, dx=dx, dy=dy, shadow=shadow)
    occupy(cx, cy - (hc - 1 if not free else 0), cx + bw - 1, cy)
    COUNT[name] = COUNT.get(name, 0) + 1
    return True
def deco(img, cx, cy, name, dx=0, dy=0, allow_road=False, arena=False):
    wc = (img.width + 15) // 16
    for i in range(wc):
        ok = (ARENA[cy][cx + i] and (cx + i, cy) not in s.occ_) if arena else terrain_ok(cx + i, cy, allow_road)
        if not ok: return False
    s.at(img, cx, cy, block=None, dx=dx, dy=dy, shadow=False)
    COUNT[name] = COUNT.get(name, 0) + 1
    return True

G = {n: getattr(VV, n)() for n in ('flowers_dry', 'drygrass_a', 'drygrass_b', 'drygrass_tall', 'tuft_low', 'tuft_seed', 'tracks', 'acacia', 'dead_snag', 'thornbush_dry',
                                    'kopje', 'boulder_flat', 'rocks_s', 'termite_mound', 'skull_horned', 'ribcage', 'bones_scatter', 'tent_hide',
                                    'firepit_cold', 'hide_rack', 'bedroll_hide', 'reeds')}
G['waterhole'] = VV.waterhole()
for n in ('weapon_rack', 'armor_stand', 'shields_stack', 'training_dummy', 'brazier', 'banner_tall', 'booth', 'bench_stone', 'spear_barrel',
          'victor_column', 'grindstone', 'chariot_broken', 'sand_marks', 'dropped_shield'):
    G[n] = getattr(VP, n)()
FLIP = lambda im: im.transpose(Image.FLIP_LEFT_RIGHT)

# ================================================================ 앵커: 앞마당 (정문 앞)
put(G['banner_tall'], 53, 27, 'banner_tall', block=[(0, 0)], allow_road=True)
put(G['banner_tall'], 58, 27, 'banner_tall', block=[(0, 0)], allow_road=True)
put(G['brazier'], 52, 28, 'brazier', block=[(0, 0)], allow_road=True)
put(G['brazier'], 59, 28, 'brazier', block=[(0, 0)], allow_road=True)
put(G['victor_column'], 48, 28, 'victor_column', block=[(0, 0)], allow_road=True)
put(G['victor_column'], 64, 28, 'victor_column', block=[(0, 0)], allow_road=True)
put(G['booth'], 48, 32, 'booth', block=[(0, 0), (1, 0), (2, 0)], allow_road=True)
put(G['weapon_rack'], 61, 31, 'weapon_rack', block=[(0, 0), (1, 0)], allow_road=True)
put(G['armor_stand'], 63, 31, 'armor_stand', block=[(0, 0)], allow_road=True, dx=2)
put(G['shields_stack'], 64, 30, 'shields_stack', block=[(0, 0), (1, 0)], allow_road=True)
put(G['bench_stone'], 51, 31, 'bench_stone', block=[(0, 0), (1, 0)], allow_road=True)
put(G['spear_barrel'], 60, 31, 'spear_barrel', block=[(0, 0)], allow_road=True, dx=-3)
put(G['training_dummy'], 66, 30, 'training_dummy', block=[(0, 0)])
put(G['training_dummy'], 67, 32, 'training_dummy', block=[(0, 0)])
put(G['chariot_broken'], 43, 33, 'chariot_broken', block=[(0, 0), (1, 0), (2, 0)])
s.marks['plaza'] = (55, 30)

# ================================================================ 앵커: 경기장 안
for (x, y) in ((50, 14), (60, 13), (54, 18), (62, 17), (47, 17), (57, 20), (52, 21), (59, 16)):
    deco(G['sand_marks'], x, y, 'sand_marks', arena=True)
deco(G['dropped_shield'], 49, 19, 'dropped_shield', arena=True)
deco(G['dropped_shield'], 61, 19, 'dropped_shield', arena=True)
if all(ARENA[16][x] for x in range(62, 65)):
    s.at(FLIP(G['chariot_broken']), 62, 16, block=[(0, 0), (1, 0), (2, 0)], shadow=False); occupy(62, 15, 64, 16)
s.at(G['spear_barrel'], 59, 12, block=[(0, 0)], shadow=False); occupy(59, 12, 59, 12)

# ================================================================ 앵커: 남동 물웅덩이 + 짐승 뼈
WH = G['waterhole']
s.at(WH, 63, 40, block=[(i, j) for i in range(6) for j in (-3, -2, -1, 0) if not (j in (-3, 0) and i in (0, 5))], shadow=False)
occupy(63, 37, 68, 40)
for (x, y) in ((62, 39), (69, 38)): put(G['reeds'], x, y, 'reeds', block=[], free=True)
put(G['ribcage'], 59, 43, 'ribcage', block=[(0, 0), (1, 0), (2, 0)])
put(G['skull_horned'], 62, 44, 'skull_horned', block=[(0, 0)])
for (x, y) in ((57, 41), (63, 42), (70, 41), (56, 44)): deco(G['bones_scatter'], x, y, 'bones_scatter')
for (x, y) in ((61, 41), (66, 42), (70, 40), (58, 39), (71, 37)): deco(G['tracks'], x, y, 'tracks')
put(G['acacia'], 70, 36, 'acacia', block=[(1, 0), (2, 0)], base_w=4, canopy_rows=3)
s.marks['waterhole'] = (63, 40)

# ================================================================ 앵커: 남서 야영 흔적
put(G['tent_hide'], 8, 37, 'tent_hide', block=[(i, j) for i in range(3) for j in (-1, 0)], canopy_rows=0)
put(FLIP(G['tent_hide']), 13, 34, 'tent_hide', block=[(i, j) for i in range(3) for j in (-1, 0)], canopy_rows=0)
put(G['firepit_cold'], 11, 39, 'firepit_cold', block=[(0, 0), (1, 0)])
put(G['hide_rack'], 5, 41, 'hide_rack', block=[(0, 0), (1, 0)])
put(G['bedroll_hide'], 13, 41, 'bedroll_hide', block=[], free=True)
put(LOG_SEAT, 9, 41, 'log_seat', block=[(0, 0), (1, 0)])
put(G['skull_horned'], 16, 36, 'skull_horned', block=[(0, 0)])
for (x, y) in ((10, 37), (15, 40), (7, 39)): deco(G['tracks'], x, y, 'tracks')
s.marks['camp'] = (11, 37)

# ================================================================ 앵커: 북서 바위 언덕 + 고목
put(G['kopje'], 4, 11, 'kopje', block=[(i, j) for i in range(4) for j in (-1, 0)])
put(G['boulder_flat'], 9, 12, 'boulder_flat', block=[(0, 0), (1, 0)])
put(G['dead_snag'], 8, 9, 'dead_snag', block=[(0, 0)], canopy_rows=3)
put(G['termite_mound'], 2, 14, 'termite_mound', block=[(0, 0)])
put(G['rocks_s'], 10, 14, 'rocks_s', block=[], free=True)
put(G['acacia'], 11, 8, 'acacia', block=[(1, 0), (2, 0)], base_w=4, canopy_rows=3)
s.marks['kopje'] = (7, 13)

# ================================================================ 흩어진 나무·바위·개미탑 (덩이, 일렬 금지)
VARS = {}
def variant(name):
    if name not in VARS:
        b0 = G[name]
        VARS[name] = [b0, FLIP(b0), _tint(b0, 0.02, 1.06), FLIP(_tint(b0, -0.018, 0.92))]
    return rng.choice(VARS[name])
def mk(name, block, base_w=None, canopy=0, flip=False):
    def f(x, y):
        im = G[name] if not flip else variant(name)
        return put(im, x, y, name, block=block, base_w=base_w, canopy_rows=canopy)
    return f
ACA = mk('acacia', [(1, 0), (2, 0)], 4, 3, True)
SNAG = mk('dead_snag', [(0, 0)], None, 3, True)
THORN = mk('thornbush_dry', [(0, 0), (1, 0)], None, 0, True)
BOUL = mk('boulder_flat', [(0, 0), (1, 0)], None, 0, True)
ROCK = mk('rocks_s', [], None, 0, True)
TERM = mk('termite_mound', [(0, 0)], None, 2, True)
def cluster(cx, cy, rx, ry_, n, makers, tries=16):
    placed = 0
    for _ in range(n * tries):
        if placed >= n: break
        a = rng.random() * 6.2832; d = math.sqrt(rng.random())
        x = int(round(cx + math.cos(a) * rx * d)); y = int(round(cy + math.sin(a) * ry_ * d))
        if not (0 <= x < W and 3 <= y < HF): continue
        if rng.choice(makers)(x, y): placed += 1
    return placed
cluster(28, 9, 5, 3, 3, [ACA, THORN, BOUL])
cluster(31, 20, 4, 2.5, 3, [ACA, THORN, TERM])
cluster(4, 27, 3, 3, 3, [ACA, SNAG, THORN])
cluster(33, 42, 4, 3, 4, [ACA, BOUL, THORN, TERM])
cluster(74, 45, 4, 2, 3, [ACA, THORN, ROCK])
cluster(76, 33, 3, 3, 3, [SNAG, BOUL, THORN])
cluster(26, 37, 2.5, 2, 2, [TERM, ROCK])
cluster(45, 42, 3, 2.5, 3, [BOUL, THORN, SNAG])
cluster(36, 3, 3, 2, 2, [SNAG, BOUL])
cluster(74, 4, 4, 3, 3, [ACA, THORN, BOUL])
cluster(14, 45, 4, 2, 3, [ACA, THORN, TERM])

# ================================================================ 키 큰 마른 풀 덩이(오토타일) + 억새 장식
DG = VA.dry_grass()
NOISE = value_noise(8101, W, HF, 7)
KEEP = set()
for k in ('waterhole', 'camp', 'kopje', 'plaza'):
    mx, my = s.marks[k]
    for j in range(-4, 5):
        for i in range(-6, 7): KEEP.add((mx + i, my + j))
for (x0, y0) in ((57, 41), (60, 43)):
    for j in range(-2, 3):
        for i in range(-3, 5): KEEP.add((x0 + i, y0 + j))
for y in range(3, HF):
    for x in range(W):
        if NOISE[y][x] > 0.68 and terrain_ok(x, y) and not near_road(x, y, 1) and (x, y) not in KEEP: DRYG[y][x] = True
lab_, nlab = ndi.label(np.array(DRYG))
for k in range(1, nlab + 1):                                     # 너무 작은 덩이는 지운다
    if (lab_ == k).sum() < 5: DRYG = [[DRYG[y][x] and lab_[y, x] != k for x in range(W)] for y in range(H)]
s.overlays.append((VA.grass_patch(DRYG, 31), 0, 0))
TALL = [G['drygrass_tall'], FLIP(G['drygrass_tall']), G['drygrass_b'], FLIP(G['drygrass_b'])]
for y in range(HF):
    for x in range(W):
        if DRYG[y][x] and rng.random() < 0.30:
            t = rng.choice(TALL)
            if t.width > 16 and not (x + 1 < W and DRYG[y][x + 1]): t = TALL[0]
            deco(t, x, y, 'drygrass_tall', dx=rng.randrange(-6, 7), dy=rng.randrange(-4, 3))

# ================================================================ 빈 바닥: 잔 풀 덩이로 채움(풀밭 = 장식, 걷기)
TF = [G['tuft_low'], G['tuft_low'], G['tuft_seed'], G['drygrass_a'], G['drygrass_b']]
FILL = set()
_ALPHA = {}
DECAL = set(id(i) for i in TF + TALL + [G['flowers_dry'], G['drygrass_tall'], G['tracks'], G['bones_scatter'], G['sand_marks'], G['dropped_shield']])
def cov_grid():
    cov = np.zeros((H, W))
    for (sy, x, y, im, sh) in s.objs:
        if id(im) in DECAL: continue
        if id(im) not in _ALPHA: _ALPHA[id(im)] = np.array(im)[:, :, 3] > 128
        a = _ALPHA[id(im)]; h, w = a.shape
        x0, y0 = max(0, x), max(0, y); x1, y1 = min(W * 16, x + w), min(H * 16, y + h)
        if x1 <= x0 or y1 <= y0: continue
        full = np.zeros((H * 16, W * 16), bool); full[y0:y1, x0:x1] = a[y0 - y:y1 - y, x0 - x:x1 - x]
        cov = np.maximum(cov, full.reshape(H, 16, W, 16).mean(axis=(1, 3)))
    return cov
COV = [None]
def empty_cells(recalc=True):
    if recalc or COV[0] is None: COV[0] = cov_grid()
    cov = COV[0]; e = np.zeros((HF, W), bool)
    for y in range(HF):
        for x in range(W):
            e[y, x] = not (cov[y, x] >= 0.2 or road_all[y][x] or NOGO[y][x] or ARENA[y][x] or DRYG[y][x] or BARE[y][x] or (x, y) in FILL or s.water[y][x])
    return e
def worst_window(e, step=1):
    best = (0, 0, 0)
    for y in range(0, HF - 15 + 1, step):
        for x in range(0, W - 20 + 1, step):
            r = e[y:y + 15, x:x + 20].mean()
            if r > best[0]: best = (r, x, y)
    return best
def meadow(cx, cy, r):
    n = 0
    for y in range(int(cy - r) - 1, int(cy + r) + 2):
        for x in range(int(cx - r * 1.3) - 1, int(cx + r * 1.3) + 2):
            if not (0 <= x < W and 0 <= y < HF): continue
            d = ((x - cx) / (r * 1.3)) ** 2 + ((y - cy) / r) ** 2
            if d > 0.9 + (rng.random() - 0.5) * 0.5: continue
            if not terrain_ok(x, y): continue
            FILL.add((x, y)); n += 1
            if rng.random() < 0.8:
                t = rng.choice(TF)
                if t.width > 16 and not terrain_ok(x + 1, y): t = TF[0]
                deco(t, x, y, 'tuft', dx=rng.randrange(-3, 4), dy=rng.randrange(-2, 3))
            if rng.random() < 0.35:
                deco(rng.choice(TF[:3]), x, y, 'tuft', dx=rng.randrange(-5, 6), dy=rng.randrange(-5, 2))
            if d < 0.3 and rng.random() < 0.45:
                deco(G['flowers_dry'], x, y, 'flowers_dry', dx=rng.randrange(-3, 4), dy=rng.randrange(-3, 3))
    return n
for it in range(160):
    e = empty_cells(recalc=(it % 6 == 0)); r, wx, wy = worst_window(e, 1)
    if r <= 0.30: break
    best = None
    for y in range(wy + 1, wy + 14):
        for x in range(wx + 1, wx + 19):
            if e[y, x]:
                sc = e[max(0, y - 2):y + 3, max(0, x - 2):x + 3].sum()
                if best is None or sc > best[0]: best = (sc, x, y)
    if best is None: break
    _, bx_, by_ = best
    pk = rng.random()
    if pk < 0.82: n = meadow(bx_, by_, rng.uniform(1.6, 2.8))
    else: n = cluster(bx_, by_, 2.2, 1.6, 2, [ACA, THORN, ROCK, BOUL, TERM])
    if n == 0: FILL.add((bx_, by_))
print('fill done', it, 'worst', round(float(r), 3))
for _ in range(140):
    x, y = rng.randrange(1, W - 1), rng.randrange(3, HF - 1)
    if terrain_ok(x, y) and (x, y) not in FILL: deco(rng.choice(TF[:3]), x, y, 'tuft', dx=rng.randrange(-4, 5), dy=rng.randrange(-3, 3))

# ================================================================ 지하 대기실(아래 띠)
ROOM, RWALK, RMARK, RUPS = VU.room()

# ================================================================ 통행 · 렌더 · 저장
_wg = s.walk_grid
def walk_grid():
    g = _wg()
    for y in range(HF, H):
        for x in range(W): g[y][x] = False
    for y in range(VU.RH):
        for x in range(VU.RW): g[RY0 + y][RX0 + x] = RWALK[y][x]
    return g
s.walk_grid = walk_grid
for k, (x, y) in RMARK.items(): s.marks['room_' + k] = (RX0 + x, RY0 + y)
s.marks['west_exit'] = (0, 18); s.marks['south_exit'] = (21, HF - 1); s.marks['east_exit'] = (W - 1, 27)
LINKS = [{'from': list(s.marks['arena_gate']), 'to': list(s.marks['room_stairs_top']), 'note': '경기장 북쪽 쇠창살 문 ↔ 지하 대기실 계단 위'}]

def run():
    im = s.render()
    for (sh, x, y) in getattr(s, 'overlays_after', []): pass
    # 실내 띠: 검은 바탕 + 방 + 위층 소품
    blk = Image.new('RGBA', (W * 16, (H - HF) * 16), (8, 8, 12, 255)); im.alpha_composite(blk, (0, HF * 16))
    room = ROOM.copy()
    for (u, x, y, sy) in sorted(RUPS, key=lambda t: t[3]): room.alpha_composite(u, (x, y))
    im.alpha_composite(room, (RX0 * 16, RY0 * 16))
    wg = s.walk_grid()
    reach = {}
    for st in ('west_exit', 'south_exit', 'east_exit'):
        rr = s.bfs(s.marks[st], wg)
        reach[st] = {k: (v in rr) for k, v in s.marks.items() if not k.startswith('room_')}
    rr = s.bfs(s.marks['room_stairs_top'], wg)
    reach['room'] = {k: (v in rr) for k, v in s.marks.items() if k.startswith('room_')}
    e = empty_cells(); w = worst_window(e, 1)
    return im, reach, (float(w[0]), (w[1], w[2]), float(e.mean()))

# 그림자 덧그림을 물체 아래(땅 위)에 넣으려고 Scene.render 의 overlays 끝에 붙인다
s.overlays.extend(s.overlays_after)

# ================================================================ 조각 내보내기
def export(im, reach, dens):
    import vc_meta
    Pq = Parts(HERE)
    for n, md in vc_meta.META.items():
        img, pad = vc_meta.image_of(n)
        Pq.add(n, img, md['kind'], md['ko'], md['desc'], md['rules'], md.get('brows'), md.get('layer'), md.get('role'), pad=pad)
    for n, md in vc_meta.META.items():
        for k in ('walk', 'anchor'):
            if k in md: Pq.meta[n][k] = md[k]
    cnt = Pq.finish('대초원·투기장 (veldt-coliseum)')
    im.convert('RGB').save(HERE + '/render-1x.png')
    im.convert('RGB').resize((im.width * 2, im.height * 2), Image.NEAREST).save(HERE + '/render-2x.png')
    wg = s.walk_grid()
    json.dump({'w': W, 'h': H, 'tile': 16, 'rows': [''.join('.' if wg[y][x] else '#' for x in range(W)) for y in range(H)],
               'legend': {'.': 'walkable', '#': 'blocked'}, 'field_rows': HF, 'room_origin': [RX0, RY0],
               'marks': {k: list(v) for k, v in s.marks.items()}, 'links': LINKS,
               'reach': {k: all(v.values()) for k, v in reach.items()}, 'unreached': {k: [m for m, ok in v.items() if not ok] for k, v in reach.items()},
               'empty_window': [dens[0], list(dens[1])], 'count': COUNT}, open(HERE + '/grid.json', 'w'), ensure_ascii=False, indent=0)
    return cnt

if __name__ == '__main__':
    im, reach, dens = run()
    print(im.size, {k: [m for m, ok in v.items() if not ok] for k, v in reach.items()}, 'density', dens)
    print(COUNT)
    if '--no-export' not in sys.argv: print('parts', export(im, reach, dens))
    else: im.save(HERE + '/_qa/render-try.png')

def _dbg():
    wg = s.walk_grid()
    for y in list(range(8, 30)) + list(range(HF, H)):
        print('%2d ' % y + ''.join(('G' if (x, y) == s.marks['arena_gate'] else ('.' if wg[y][x] else '#')) for x in range(18 if y >= HF else 40, 61 if y >= HF else 72)))
if '--dbg' in sys.argv: _dbg()
