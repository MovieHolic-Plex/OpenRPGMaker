# 버들항 장르 웨이브 6 — 비행선 정박 부두(airship-dock, steampunk). 다시 돌리면 같은 그림이 나온다.
#   python3 make_airship_dock.py → parts/, partmeta.json, parts.md, render-1x/2x.png, grid.json, check-autotile.png
# 맵 64×44: 서쪽 = 고지 풀밭·석탄 창고 마당·포석 길, 가운데 = 관제 오두막·부두 널 마당·기낭 걸이, 동쪽·남쪽 = 구름 낀 낭떠러지와 잔교 둘·정박한 비행선.
# 칠하는 순서(조수가 따라 할 순서): ① 맨 바탕 표본(ground-*) → ② 땅 덩이 오토타일(낭떠러지·석탄 가루·빗물) → ③ 잔교·건물·소품 → ④ 위층(구름·줄 깃발).
import os, sys, json, math
from collections import deque
OUT = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, OUT)
from ad_base import *
import ad_ground as G, ad_auto as AU, ad_parts as AP
assert OUT.endswith('airship-dock')

W, H = 54, 36
PT, I = AP.register(OUT)
NPARTS = PT.finish('비행선 정박 부두(airship-dock, steampunk)')
META = PT.meta

# ================================================================ ① 지형: 낭떠러지 덩이
XE = [44, 44, 43, 43, 42, 41, 41, 41, 42, 42, 42, 41, 41, 41, 41, 42, 43, 43, 44, 43, 42, 41, 41, 40, 40, 40, 40, 41, 42, 43,
      42, 41, 41, 41, 41, 41]
def ys(x): return 31 + int(round(1.5 * math.sin(x * .41 + .5) + 1.0 * math.sin(x * 1.13)))
abyss = [[False] * W for _ in range(H)]
for y in range(H):
    for x in range(W):
        if x >= XE[y]: abyss[y][x] = True
        if x >= 15 and y >= ys(x): abyss[y][x] = True
for _ in range(2):                                                         # 1칸 혹·틈 지우기
    for y in range(H):
        for x in range(W):
            nb = [abyss[yy][xx] if 0 <= xx < W and 0 <= yy < H else True for xx, yy in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1))]
            if abyss[y][x] and sum(nb) <= 1: abyss[y][x] = False
            elif not abyss[y][x] and sum(nb) >= 3 and 0 < x < W - 1: abyss[y][x] = True
def is_ab(x, y): return True if not (0 <= x < W and 0 <= y < H) else abyss[y][x]
def edge_x(y):
    for x in range(W):
        if abyss[y][x]: return x
    return W
RA, RB = 11, 23                                                            # 잔교 데크 윗줄(A 북쪽 큰 비행선, B 남쪽 비행정)
XA = max(edge_x(RA), edge_x(RA + 1)); XB = max(edge_x(RB), edge_x(RB + 1))

# ---- 바닥 표본 칸
ground = [['ground-highland-grass'] * W for _ in range(H)]
def blob(name, x0, y0, x1, y1, seed):
    """사각형이 아니게: 행마다 양 끝을 0~2칸 들쭉날쭉, 위·아래 줄은 한 칸 더 들인다."""
    for y in range(y0, y1 + 1):
        a = x0 + int(hash2(y, 1, seed) * 2.2) - (1 if hash2(y, 3, seed) > .8 else 0)
        b = x1 - int(hash2(y, 2, seed) * 2.2) + (1 if hash2(y, 4, seed) > .8 else 0)
        if y in (y0, y1): a += 1; b -= 1
        for x in range(max(0, a), min(W, b + 1)): ground[y][x] = name
blob('ground-cliff-rock', 30, 0, 44, 6, 11)
blob('ground-cliff-rock', 2, 27, 20, 35, 12)
blob('ground-cliff-rock', 21, 24, 36, 32, 13)
blob('ground-cinder-yard', 1, 1, 14, 11, 14); blob('ground-cinder-yard', 16, 1, 25, 9, 17); blob('ground-cinder-yard', 16, 10, 23, 14, 16)
blob('ground-dock-planks', XA - 10, 8, XA, 28, 15)
for y in range(17, 20):                                                    # 포석 길(서쪽 들머리 → 부두 널 마당)
    for x in range(0, XA - 9): ground[y][x] = 'ground-cobble-road'
for y in range(10, 17):
    for x in (13, 14): ground[y][x] = 'ground-cobble-road'
for y in range(20, 23):                                                    # 남쪽 기낭 마당으로 가는 갈래
    for x in (21, 22): ground[y][x] = 'ground-cobble-road'
for y in range(RA, RA + 5):
    for x in range(XA - 4, XA): ground[y][x] = 'ground-iron-deck'
for y in range(19, 22):
    for x in range(XA - 4, XA): ground[y][x] = 'ground-iron-deck'

# ---- 땅 덩이 오토타일(셀 집합)
auto = {'autotile-cloud-cliff': {(x, y) for y in range(H) for x in range(W) if abyss[y][x]},
        'autotile-coal-dust': set(), 'autotile-plank-puddle': set(), 'autotile-iron-railing': set()}
def blobset(name, rows):
    for (y, a, b) in rows:
        for x in range(a, b + 1): auto[name].add((x, y))
blobset('autotile-coal-dust', [(8, 4, 8), (9, 3, 10), (10, 5, 11), (11, 7, 10)])
blobset('autotile-coal-dust', [(6, 11, 13), (7, 10, 13), (8, 11, 12)])
blobset('autotile-plank-puddle', [(15, XA - 8, XA - 6), (16, XA - 9, XA - 5), (17, XA - 8, XA - 6)])
blobset('autotile-plank-puddle', [(25, XA - 7, XA - 5), (26, XA - 8, XA - 4), (27, XA - 7, XA - 6)])
PIER_ROWS = set(range(RA - 1, RA + 4)) | set(range(RB - 1, RB + 4))
for y in range(H):
    for x in range(30, W):                                                 # 난간은 부두 쪽 낭떠러지 턱에만(자연 절벽은 바위·풀로 끝난다)
        if abyss[y][x] or y in PIER_ROWS: continue
        if any(is_ab(xx, yy) and 0 <= xx < W and 0 <= yy < H for xx, yy in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1))):
            auto['autotile-iron-railing'].add((x, y))

# ================================================================ ③ 물체 배치
OBJ = []           # (name, cx, cy_bottom, dx, dy, flipx) — cy_bottom None 이면 dx, dy 가 px 좌표
def put(name, cx, cyb, dx=0, dy=0, flipx=False): OBJ.append((name, cx, cyb, dx, dy, flipx))
# 잔교 A(북쪽, 큰 비행선)
BA = RA + 2
put('pier_root', XA, BA)
nA = XA + 2
while nA + 4 <= W - 4: put('pier_span', nA, BA); nA += 4
put('pier_head', nA, BA); HEAD_A = nA
put('bollard', HEAD_A + 1, RA + 1); put('bollard', HEAD_A + 1, RA, dy=-2); put('gas_lamp', HEAD_A, RA)
# 계류 탑(땅) + 정박 비행선(하늘): 기수 끝을 탑 원뿔에, 곤돌라 밑을 잔교 북쪽 줄 바로 위에
MX = XA - 3
air_y = RA * 16 - 104
mast_top = air_y + 34 - 10
mast_bot = (mast_top + 144) // 16 - 1
put('mooring_mast', MX, mast_bot)
air_x = MX * 16 + 40
OBJ.append(('airship_moored', air_x // 16, None, air_x, air_y, False))
put('mooring_winch', XA - 4, RA + 5)
# 잔교 B(남쪽, 소형 비행정)
BB = RB + 2
put('pier_root', XB, BB)
nB = XB + 2
for _ in range(2): put('pier_span', nB, BB); nB += 4
put('pier_head', nB, BB); HEAD_B = nB
put('bollard', HEAD_B + 1, RB + 1); put('gas_lamp', HEAD_B + 2, RB)
OBJ.append(('airship_skiff', 0, None, (XB + 4) * 16, (BB + 1) * 16 - 6, False))
put('signal_lamp', XB - 1, RB - 1); put('signal_lamp', XB - 1, BB + 2)
# 짐 기중기 + 둘레(부두 널 마당)
put('cargo_crane', XA - 4, 21)
put('cargo_net', XA - 2, 18); put('crate_pair', XA - 7, 21); put('steam_pipe_h', XA - 8, 16)
put('boiler_small', XA - 9, 14); put('pressure_post', XA - 6, 14)
put('water_tank', XA - 10, 11)
put('crate_stack', XA - 9, 26); put('crate_single', XA - 6, 26); put('sack_pile', XA - 3, 28)
put('barrel_pair', XA - 9, 29); put('hand_truck', XA - 4, 25); put('sandbag_ballast', XA - 6, 24)
put('flag_pole', XA - 2, mast_bot - 6); put('windsock', XA - 6, 6)
put('searchlight', XA - 8, 7); put('telescope', XA - 10, 7); put('rope_coil', XA - 1, BA + 3)
# 관제 오두막(길 북쪽, 창이 부두를 본다)
HX = XA - 15
put('control_hut', HX, 16); put('flag_pole_drab', HX - 2, 16); put('bench_iron', HX + 5, 15)
put('gas_lamp', HX - 4, 16); put('gas_lamp', 5, 16); put('gas_lamp', 17, 21)
# 석탄 창고 마당(북서)
put('coal_shed', 3, 7); put('coal_heap', 10, 5); put('coal_cart', 9, 11)
put('coal_scatter', 12, 9); put('coal_scatter', 3, 10); put('barrel_single', 1, 5); put('barrel_pair', 0, 11)
put('boiler_small', 15, 5); put('valve_stand', 14, 8); put('crate_single', 1, 8)
put('steam_tractor', 18, 12); put('crate_pair', 21, 13); put('barrel_single', 17, 13); put('coal_scatter', 20, 11)
# 남쪽 기낭 마당
put('gasbag_cradle', 14, 30); put('propeller_spare', 23, 29); put('gas_bottles', 24, 26); put('hose_reel', 26, 26)
put('tool_rack', 11, 27); put('sandbag_ballast', 18, 32); put('gear_spare', 8, 30); put('pallet', 23, 31)
put('telescope', 31, 31); put('rock_large', 28, 33); put('rock_small', 33, 30); put('crate_pair', 9, 33)
# 자연: 서쪽·북쪽·절벽 가장자리 덩이
for (n, cx, cyb, fl) in (('pine_windswept', 0, 3, False), ('pine_windswept', 18, 4, True), ('pine_windswept', 23, 3, False),
                         ('pine_windswept', 0, 25, False), ('pine_windswept', 1, 31, True), ('pine_windswept', 5, 39, False),
                         ('pine_windswept', 27, 6, True), ('pine_windswept', 12, 37, True), ('shrub_windswept', 21, 6, False),
                         ('shrub_windswept', 3, 22, False), ('pine_windswept', 6, 24, False), ('pine_windswept', 9, 27, True), ('shrub_windswept', 11, 25, False),
                         ('pine_windswept', 26, 24, True), ('shrub_windswept', 29, 26, False), ('rock_large', 16, 9, False), ('shrub_windswept', 9, 36, True), ('shrub_windswept', 25, 10, False),
                         ('shrub_windswept', 34, 9, True), ('shrub_windswept', 6, 25, True), ('shrub_windswept', 30, 23, False),
                         ('rock_large', 36, 3, False), ('rock_small', 40, 1, False), ('rock_moss', 31, 2, False), ('rock_small', 4, 28, False),
                         ('rock_moss', 15, 38, False), ('rock_large', 1, 37, False), ('rock_moss', 19, 24, False), ('rock_small', 37, 31, False),
                         ('rock_small', 20, 34, False), ('rock_moss', 26, 34, False), ('rock_small', 10, 23, False), ('rock_moss', 28, 21, False)):
    put(n, cx, cyb, flipx=fl)
for (n, cx, cyb, fl) in (('pine_windswept', 3, 28, True), ('pine_windswept', 9, 22, False), ('shrub_windswept', 1, 20, True),
                         ('shrub_windswept', 13, 23, False), ('shrub_windswept', 7, 29, False), ('rock_large', 12, 26, False),
                         ('rock_small', 0, 23, False), ('pine_windswept', 27, 26, False), ('shrub_windswept', 31, 21, True),
                         ('rock_moss', 25, 21, False), ('shrub_windswept', 6, 15, False), ('coal_heap', 9, 15, False), ('sack_pile', 12, 14, False),
                         ('crate_single', 2, 15, False), ('shrub_windswept', 25, 1, True), ('rock_small', 27, 0, False),
                         ('shrub_windswept', 33, 13, False), ('pine_windswept', 21, 9, False), ('shrub_windswept', 25, 13, True), ('rock_moss', 29, 4, False),
                         ('shrub_windswept', 14, 2, False), ('barrel_pair', 12, 3, False), ('rock_small', 31, 9, False), ('gas_bottles', 17, 8, False), ('hose_reel', 19, 8, False),
                         ('crate_stack', 21, 3, False), ('barrel_single', 24, 3, False), ('shrub_windswept', 30, 13, True), ('rock_moss', 33, 7, False)):
    put(n, cx, cyb, flipx=fl)
for i in range(240):                                                        # 풀포기 덩이(2~4개씩 무리)
    g = i // 3
    x = int(hash2(g, 1, 991) * W) + (i % 3) - 1; y = int(hash2(g, 2, 991) * H) + (1 if i % 3 == 2 else 0)
    if 0 <= x < W and 0 <= y < H and ground[y][x] == 'ground-highland-grass' and not abyss[y][x]:
        put('grass_tuft' if i % 2 else 'grass_tuft_b', x, y)
# 남쪽 마당·남쪽 가장자리 물체는 4줄 위로(맵 높이를 40 → 36 으로 줄였다 — 빈 바닥은 메우지 않고 줄인다)
SOUTH_ZONE = {'gasbag_cradle', 'propeller_spare', 'gas_bottles', 'hose_reel', 'tool_rack', 'gear_spare', 'pallet', 'telescope'}
for i, (n, cx, cyb, dx, dy, fl) in enumerate(OBJ):
    if cyb is not None and cx < XA - 10 and (cyb >= 28 or (n in SOUTH_ZONE and cyb >= 24)): OBJ[i] = (n, cx, cyb - 4, dx, dy, fl)
OBJ[:] = [o for o in OBJ if o[2] is None or o[2] < H]
# 위층: 떠도는 구름(낭떠러지 하늘)
for (n, cx, cy) in (('cloud_puff', 45, 15), ('cloud_puff_wide', 47, 29), ('cloud_puff', 38, 36), ('cloud_puff_small', 50, 3),
                    ('cloud_puff_small', 44, 20), ('cloud_puff_wide', 24, 37), ('cloud_puff', 49, 34), ('cloud_puff_small', 47, 1),
                    ('cloud_puff_wide', 42, 38), ('cloud_puff', 51, 20), ('cloud_puff_small', 31, 38), ('cloud_puff', 17, 37)):
    if cy > 30: cy -= 4
    OBJ.append((n, cx, None, cx * 16 + int(hash2(cx, cy, 5) * 8), cy * 16 + int(hash2(cy, cx, 6) * 8), False))

# ================================================================ 통행(걸음/막힘)
blocked = [[abyss[y][x] for x in range(W)] for y in range(H)]
for (x, y) in auto['autotile-iron-railing']: blocked[y][x] = True
SPECIAL = {'gasbag_cradle': [(0, 0), (1, 0), (4, 0), (5, 0)], 'windsock': [(0, 0)], 'flag_pole': [(0, 0)], 'flag_pole_drab': [(0, 0)],
           'shrub_windswept': [(0, 0)], 'pine_windswept': [(1, 0)], 'airship_moored': [], 'airship_skiff': []}
walkover = []
def foot(name, cx, cyb, flipx):
    im = I[name]; wc, hc = im.width // 16, im.height // 16; m = META[name]
    if m['kind'] == 'walk':
        rows = hc if name == 'gangway' else 2
        top = cyb - hc + 1
        return [], [(cx + i, top + j) for i in range(wc) for j in range(rows)]
    if m['kind'] in ('decal', 'autotile', 'floor'): return [], []
    if name in SPECIAL: rel = SPECIAL[name]
    else: rel = [(i, j) for i in range(wc) for j in range(m.get('brows', 1))]
    if flipx: rel = [(wc - 1 - i, j) for i, j in rel]
    return [(cx + i, cyb - j) for i, j in rel], []
for (n, cx, cyb, dx, dy, fl) in OBJ:
    if cyb is None: continue
    b, w = foot(n, cx, cyb, fl)
    walkover += w
    for (x, y) in b:
        if 0 <= x < W and 0 <= y < H: blocked[y][x] = True
for (x, y) in walkover:
    if 0 <= x < W and 0 <= y < H: blocked[y][x] = False

# ================================================================ 그리기
def sheet_cell(sheet, k): return sheet.crop(((k % 4) * 16, (k // 4) * 16, (k % 4) * 16 + 16, (k // 4) * 16 + 16))
def mask_of(cells, x, y, outside):
    def on(a, b): return outside if not (0 <= a < W and 0 <= b < H) else (a, b) in cells
    return (1 if on(x, y - 1) else 0) | (2 if on(x + 1, y) else 0) | (4 if on(x, y + 1) else 0) | (8 if on(x - 1, y) else 0)
def render():
    im = Image.new('RGBA', (W * 16, H * 16), (0, 0, 0, 255))
    for y in range(H):                                                     # ① 맨 바탕 표본
        for x in range(W):
            g = I[ground[y][x]]
            im.alpha_composite(g.crop(((x % 3) * 16, (y % 3) * 16, (x % 3) * 16 + 16, (y % 3) * 16 + 16)), (x * 16, y * 16))
    for name in ('autotile-coal-dust', 'autotile-plank-puddle', 'autotile-cloud-cliff'):   # ② 땅 덩이
        sh = I[name]; cells = auto[name]; outside = name == 'autotile-cloud-cliff'
        for (x, y) in cells: im.alpha_composite(sheet_cell(sh, mask_of(cells, x, y, outside)), (x * 16, y * 16))
    flat, objs, upper = [], [], []
    for (n, cx, cyb, dx, dy, fl) in OBJ:
        pic = I[n].transpose(Image.FLIP_LEFT_RIGHT) if fl else I[n]
        if cyb is None: px, py = dx, dy
        else: px, py = cx * 16 + dx, (cyb + 1) * 16 - pic.height + dy
        k = META[n]['kind']
        if n.startswith('cloud_puff') or n == 'pennant_line': upper.append((py, px, pic))
        elif k in ('walk', 'decal'): flat.append((py + pic.height, px, pic))
        else: objs.append((py + pic.height, px, pic))
    rs = I['autotile-iron-railing']; rc = auto['autotile-iron-railing']
    for (x, y) in rc: objs.append(((y + 1) * 16, x * 16, sheet_cell(rs, mask_of(rc, x, y, False))))
    for L in (flat, objs, upper):                                          # ③ 잔교·바닥 장식 → 물체(아래 끝 순) → ④ 위층
        for (key, px, pic) in sorted(L, key=lambda t: (t[0], t[1])):
            im.alpha_composite(pic, (px, key) if L is upper else (px, key - pic.height))
    return im

def bfs(start):
    seen = {start}; q = deque([start])
    while q:
        x, y = q.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < W and 0 <= ny < H and not blocked[ny][nx] and (nx, ny) not in seen: seen.add((nx, ny)); q.append((nx, ny))
    return seen

if __name__ == '__main__':
    img = render()
    img.convert('RGB').save(os.path.join(OUT, 'render-1x.png'))
    img.resize((img.width * 2, img.height * 2), Image.NEAREST).convert('RGB').save(os.path.join(OUT, 'render-2x.png'))
    START = (0, 18)
    MARKS = {'west_entry': START, 'hut_door_front': (HX + 2, 17), 'coal_shed_mouth': (6, 8), 'pier_a_head': (HEAD_A + 1, RA + 1),
             'pier_b_head': (HEAD_B + 1, RB + 1), 'cradle_front': (17, 27), 'crane_yard': (XA - 5, 22),
             'mast_base_front': (MX - 1, mast_bot), 'south_rocks': (27, 27)}
    seen = bfs(START)
    reach = {k: (v in seen) for k, v in MARKS.items()}
    rows = [''.join('#' if blocked[y][x] else '.' for x in range(W)) for y in range(H)]
    json.dump({'w': W, 'h': H, 'legend': {'.': 'walk', '#': 'blocked'}, 'rows': rows, 'marks': MARKS, 'reach_from_west_entry': reach},
              open(os.path.join(OUT, 'grid.json'), 'w'), ensure_ascii=False, indent=1)
    import _qa_auto; _qa_auto.check(os.path.join(OUT, 'check-autotile.png'))
    print('parts', NPARTS, 'XA', XA, 'XB', XB, 'reach', reach)
