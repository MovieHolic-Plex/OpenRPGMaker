# 얼음 동굴 「서리 굴」 — 48x36 던전. 다시 돌리면 같은 그림.   python3 make_ice_cave.py
import sys, os, json, math, random, collections
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from wl import *
import ice_terrain as IT
import ice_props as IP
import ice_render as IR
from scipy import ndimage as ndi

W, H = 48, 36
rng = random.Random(4801)
cy_, cx_ = np.mgrid[0:H, 0:W]
_N = {}
def _n(seed):
    if seed not in _N: _N[seed] = IT.tnoise(W * 2, H * 2, 4, seed)[::2, ::2][:H, :W] if False else tnoise(W, H, 4, seed)
    return _N[seed]
def ell(cx, cy, rx, ry, seed):
    return (((cx_ - cx) / rx) ** 2 + ((cy_ - cy) / ry) ** 2) < (0.86 + 0.30 * _n(seed))
def rct(x0, y0, x1, y1):
    m = np.zeros((H, W), bool); m[y0:y1 + 1, x0:x1 + 1] = True; return m

# ---------------------------------------------------------------- 방 배치 (plan.md 의 구역)
op = np.zeros((H, W), bool)
op |= ell(11, 28, 7.6, 4.6, 1)                 # A 입구 동굴(출구 계단·야영 자리)
op |= rct(17, 27, 22, 29)                      # A-B
op |= ell(29, 20, 10.5, 6.5, 2)                # B 얼어붙은 호수 홀
op |= ell(9, 11, 7.6, 4.6, 3)                  # D 고드름 회랑
op |= rct(13, 16, 16, 21); op |= rct(13, 19, 21, 21)   # D-B (세로로 내려와 호수 홀 서쪽으로)
op |= ell(36, 5, 8.0, 2.9, 4)                  # C 보물 방(문으로만 든다)
op |= ell(38, 30, 7.2, 3.6, 5)                 # E 뼈 쉼터·내려가는 계단
op |= rct(34, 25, 38, 28)                      # B-E
op |= rct(18, 31, 30, 33)                      # A-E 남쪽 우회로(순환)
corridor_door = rct(31, 10, 34, 14)            # B-C 막다른 복도(끝에 얼음 문)
op |= corridor_door
# 큰 홀의 바위 섬(빈 바닥을 덩이로 끊고 앞면을 만든다)
ISL = [(24, 17, 1.9, 1.8), (34, 22, 2.0, 1.7), (25, 23.5, 1.9, 1.7), (14, 27, 1.7, 1.7), (6, 14, 1.9, 1.7),
       (13, 9, 1.8, 1.7), (40, 31, 1.7, 1.6), (24, 31.5, 0.0, 0.0)]
for i, (cx, cy, rx, ry) in enumerate(ISL):
    if rx > 0: op &= ~ell(cx, cy, rx, ry, 40 + i)
op[:3, :] = False; op[:, :2] = False; op[:, W - 2:] = False; op[H - 2:, :] = False
op = IR.thicken(op, 3)
# 입구에서 이어지지 않는 조각은 메운다
op_l = op.copy(); op_l[9:11, 32:34] = True
lab, _ = ndi.label(op_l); op &= (lab == lab[31, 11])[:, :]
assert (lab == lab[31, 11])[5, 36] and (lab == lab[31, 11])[12, 9], 'C/D 가 이어지지 않음'
# 문 구멍: 복도 위(8,9행)는 닫힌 칸 그대로, 문 칸만 걷기로 따로 연다
DOOR = [(32, 8), (33, 8), (32, 9), (33, 9)]
op[7, 29:43] = op[7, 29:43]
face, f1, f2 = IR.face_mask(op)
solid = ~op

# ---------------------------------------------------------------- 바닥 종류
snow_m = np.zeros((H, W), bool)
for (cx, cy, rx, ry, sd) in ((8, 30, 4.2, 2.0, 61), (7, 11, 3.8, 2.0, 62), (41, 31, 3.0, 1.6, 63), (22, 16, 2.2, 1.3, 64), (36, 5, 2.6, 1.3, 65), (28, 28, 2.6, 1.4, 66)):
    snow_m |= ell(cx, cy, rx, ry, sd) & op
lake = ell(29, 21, 6.4, 3.4, 71) & op
snow_m &= ~lake
crack_m = np.zeros((H, W), bool)
def walk_crack(x, y, n, seed):
    r = random.Random(seed); dx, dy = r.choice([(1, 0), (-1, 0), (0, 1), (0, -1)])
    for _ in range(n):
        if 0 <= x < W and 0 <= y < H and op[y, x] and not face[y, x]: crack_m[y, x] = True
        if r.random() < 0.35: dx, dy = r.choice([(1, 0), (-1, 0), (0, 1), (0, -1)])
        x += dx; y += dy
for (x, y, n, sd) in ((22, 21, 9, 1), (35, 17, 8, 2), (12, 27, 7, 3), (8, 12, 7, 4), (37, 29, 7, 5), (30, 25, 6, 6), (26, 14, 5, 7), (20, 29, 6, 8)):
    walk_crack(x, y, n, sd)
kinds = np.zeros((H, W), int)
kinds[(~snow_m) & (tnoise(W, H, 4, 77) > 0.58)] = 1
kinds[snow_m] = 2

# ---------------------------------------------------------------- 바탕 렌더 + 오토타일 덧그림
base, meta = IR.render_cells(op, kinds, seed=1)
img = Image.fromarray(base, 'RGB').convert('RGBA')
import ice_fix_frozenlake as _FX                                     # 감사 보정 2026-10-08: 언 호수 둥근 윤곽
SH = {'lake': _FX.autotile_frozenlake(), 'snow': IT.autotile_snowdrift(), 'crack': IT.autotile_crack()}
def global_overlay(sheet, mask, tex):
    ov = IR.cell_overlay(sheet, mask)
    a = np.array(ov); alpha = a[..., 3] > 0
    inner = ndi.binary_erosion(alpha, iterations=3, border_value=0)
    Hp, Wp = alpha.shape
    a[inner, :3] = tex[inner]
    return Image.fromarray(a, 'RGBA')
_Y, _X = np.mgrid[0:H * 16, 0:W * 16]
img.alpha_composite(global_overlay(SH['snow'], snow_m & ~face, IT.paint_snow(_X, _Y, seed=9)))
img.alpha_composite(global_overlay(SH['lake'], lake & ~face, IT.paint_lake(_X, _Y, seed=5, cracks=True)))
img.alpha_composite(IR.cell_overlay(SH['crack'], crack_m & ~lake))
# 문 칸: 벽 앞면 두 줄을 문 그림이 덮는다
walk = op & ~face
for (x, y) in DOOR: walk[y, x] = True

# ---------------------------------------------------------------- 놓기
SP = {n: getattr(IP, n)() for n in ('icicle_a', 'icicle_b', 'stalagmite_ice', 'stalagmite_big', 'crystal_blue', 'crystal_cluster', 'ice_pillar', 'ice_pillar_broken',
      'ice_block', 'rubble_ice', 'frostbloom', 'frozen_puddle', 'snow_pile_s', 'snow_pile_m', 'snow_drift', 'campfire_pit', 'bones_ribs', 'bones_scatter',
      'chest_frost', 'chest_open', 'crate_frost', 'barrel_frost', 'pickaxe_stuck', 'brazier_ice', 'torch_wall', 'door_ice', 'stairs_up_face', 'stairs_down',
      'frozen_waterfall', 'snow_cap_wall')}
objs = []; blocked_obj = np.zeros((H, W), bool); occ = np.zeros((H, W), bool); COUNT = {}
RES = np.zeros((H, W), bool)            # 비워 둘 칸(복도·문 앞·출구 앞·시작점)
RES |= rct(31, 10, 34, 14); RES[8:12, 31:35] = True; RES[22:26, 11:16] = True; RES[29:33, 9:14] = True
for (x, y) in DOOR: RES[y, x] = True
for (x, y) in ((35, 30), (24, 22), (26, 14), (36, 5), (9, 12), (40, 30)): RES[y - 1:y + 2, x - 1:x + 2] = True
def put(name, cx, cy, block=None, over=False, dx=0, dy=0, free=False):
    """(cx,cy) = 그림 바닥 왼쪽 칸. block: 막을 (i,j) 목록(기본 밑줄 전체). 밑줄이 열린 칸·비어 있을 때만. over=True 면 벽 앞면 위에 얹는 조각(검사 없음)."""
    im = SP[name]; wc = (im.width + 15) // 16; hc = (im.height + 15) // 16
    if not over:
        for i in range(wc):
            xx = cx + i
            if not (0 <= xx < W and 0 <= cy < H) or not op[cy, xx] or face[cy, xx] or occ[cy, xx] or RES[cy, xx]: return False
        if block is not None:
            for (i, j) in block:
                if not (0 <= cx + i < W and 0 <= cy + j < H) or not op[cy + j, cx + i] or face[cy + j, cx + i]: return False
    if block is None: block = [(i, 0) for i in range(wc)]
    if not over:
        for (i, j) in block: blocked_obj[cy + j, cx + i] = True
        if not free:
            for i in range(wc): occ[cy, cx + i] = True
            for (i, j) in block: occ[cy + j, cx + i] = True
    objs.append(dict(img=im, x=cx * 16 + dx, y=(cy + 1) * 16 - im.height + dy, by=cy, name=name))
    COUNT[name] = COUNT.get(name, 0) + 1
    return True

def face_runs():
    out = []
    for x in range(W):
        y = 0
        while y < H:
            if face[y, x]:
                y0 = y
                while y < H and face[y, x]: y += 1
                out.append((x, y0, y - y0))
            else: y += 1
    return out
FR = face_runs()
def face_top_cell(x, near=None):
    c = [(y0, n) for (xx, y0, n) in FR if xx == x]
    if not c: return None
    return min(c, key=lambda r: abs(r[0] - near)) if near is not None else c[0]

# ---- 앵커 1: 출구 계단(A 북쪽 벽 앞면) + 횃불 + 야영 자리
ax = 13
yt = face_top_cell(ax, 24)
assert yt and yt[1] == 2, yt
put('stairs_up_face', ax, yt[0] + 1, over=True)
for (tx,) in ((9,), (17,)):
    t = face_top_cell(tx)
    if t: put('torch_wall', tx, t[0] + t[1] - 1, over=True, dx=0, dy=0)
put('campfire_pit', 9, 29)
for (nm, x, y) in (('crate_frost', 5, 27), ('barrel_frost', 6, 28), ('crate_frost', 7, 27), ('bones_scatter', 14, 30), ('pickaxe_stuck', 5, 30), ('snow_pile_m', 4, 31), ('rubble_ice', 15, 29)):
    put(nm, x, y)

# ---- 앵커 2: 호수 홀 B — 얼어붙은 폭포(북벽), 얼음 기둥, 결정, 호수
t = face_top_cell(26, 14)
if t and t[1] == 2: put('frozen_waterfall', 26, t[0] + 1, over=True)
for (x, y) in ((22, 20), (35, 20), (30, 25)): put('ice_pillar', x, y, block=[(0, 0)])
put('ice_pillar_broken', 27, 18, block=[(0, 0)]); put('ice_pillar_broken', 24, 26, block=[(0, 0)])
for (x, y) in ((22, 18), (33, 16), (36, 24), (21, 24)): put('crystal_cluster', x, y, block=[(0, 0), (1, 0)])
for (x, y) in ((20, 22), (31, 24), (38, 19), (26, 21)): put('crystal_blue', x, y, block=[(0, 0)])
for (x, y) in ((19, 21), (37, 22), (28, 15), (31, 17), (23, 25)): put('stalagmite_ice', x, y, block=[(0, 0)])
put('stalagmite_big', 38, 25, block=[(0, 0), (1, 0)]); put('stalagmite_big', 19, 18, block=[(0, 0), (1, 0)])
for (x, y) in ((30, 18), (25, 20), (33, 21)): put('ice_block', x, y, block=[(0, 0)])
for (x, y) in ((29, 22), (32, 19)): put('frozen_puddle', x, y, block=[], free=True)
put('snow_drift', 21, 16, block=[(0, 0), (1, 0)]); put('snow_pile_s', 36, 18, block=[(0, 0)])
put('brazier_ice', 31, 15, block=[(0, 0)]) if False else None
put('brazier_ice', 30, 15, block=[(0, 0)]); put('brazier_ice', 35, 15, block=[(0, 0)])

# ---- 앵커 3: 얼음 문과 보물 방 C
tt = face_top_cell(32, 9)
assert tt and tt[0] == 8 and tt[1] == 2, tt
put('door_ice', 32, 9, over=True)
for (x, y) in ((33, 6), (38, 6), (40, 4)): put('crystal_cluster', x, y, block=[(0, 0), (1, 0)])
for (x, y) in ((35, 5), (37, 4)): put('ice_pillar', x, y, block=[(0, 0)])
for (nm, x, y) in (('chest_frost', 41, 5), ('chest_frost', 42, 7), ('chest_open', 30, 5), ('bones_scatter', 31, 7), ('snow_pile_s', 34, 7), ('stalagmite_ice', 39, 7)):
    put(nm, x, y, block=[(0, 0)] if nm != 'bones_scatter' and nm != 'snow_pile_s' else None)
put('brazier_ice', 29, 5, block=[(0, 0)])

# ---- 앵커 4: 고드름 회랑 D
for (nm, x, y) in (('crystal_cluster', 4, 9), ('crystal_blue', 11, 12), ('crystal_blue', 5, 12), ('stalagmite_big', 13, 14), ('stalagmite_ice', 6, 8), ('stalagmite_ice', 15, 11),
                   ('ice_block', 8, 13), ('ice_block', 11, 8), ('bones_ribs', 7, 11), ('frostbloom', 12, 11), ('frostbloom', 5, 14), ('rubble_ice', 14, 9), ('snow_drift', 3, 12), ('pickaxe_stuck', 10, 14)):
    put(nm, x, y, block=[(0, 0)] if nm in ('crystal_blue', 'stalagmite_ice', 'ice_block', 'stalagmite_ice') else ([(0, 0), (1, 0)] if nm in ('crystal_cluster', 'stalagmite_big', 'snow_drift', 'bones_ribs') else ([] if nm in ('frostbloom', 'rubble_ice') else None)),
        free=(nm in ('frostbloom',)))
put('torch_wall', 8, 8, over=True) if face_top_cell(8) else None

# ---- 앵커 5: 뼈 쉼터와 내려가는 계단 E
put('stairs_down', 40, 31, block=[], free=True) if False else None
sx, sy = 40, 30
for i in range(2): occ[sy, sx + i] = True
objs.append(dict(img=SP['stairs_down'], x=sx * 16, y=sy * 16 + 0, by=sy - 1, name='stairs_down', layer=-1)); COUNT['stairs_down'] = 1
for (nm, x, y) in (('bones_ribs', 33, 29), ('bones_scatter', 36, 31), ('bones_scatter', 34, 32), ('rubble_ice', 43, 30), ('crystal_blue', 44, 29), ('crate_frost', 36, 28),
                   ('snow_pile_m', 42, 32), ('stalagmite_ice', 32, 28), ('crystal_cluster', 37, 33), ('barrel_frost', 38, 28)):
    put(nm, x, y, block=[(0, 0), (1, 0)] if nm in ('bones_ribs', 'snow_pile_m', 'crystal_cluster') else ([(0, 0)] if nm not in ('bones_scatter', 'rubble_ice') else None))

# ---- 통로·복도 가벼운 장식
for (nm, x, y) in (('bones_scatter', 21, 28), ('stalagmite_ice', 19, 29), ('crystal_blue', 24, 32), ('snow_pile_s', 27, 32), ('stalagmite_ice', 29, 31), ('rubble_ice', 22, 32),
                   ('crate_frost', 20, 27)):
    put(nm, x, y, block=[(0, 0)] if nm in ('stalagmite_ice', 'crystal_blue', 'crate_frost', 'snow_pile_s') else None)
put('crystal_blue', 15, 13, block=[(0, 0)]) if False else None

# ---- 앞면 위의 고드름·눈 띠(걷는 땅 위가 아니라 벽 윗선에 매단다)
for (x, y0, n) in FR:
    if n == 2 and (x % 5 in (1, 3)) and rng.random() < 0.8 and x % 2 == 0:
        nm = 'icicle_b' if (x // 5) % 2 == 0 and x + 1 < W and face[y0, x + 1] else 'icicle_a'
        objs.append(dict(img=SP[nm], x=x * 16, y=y0 * 16, by=y0, name=nm, layer=-1)); COUNT[nm] = COUNT.get(nm, 0) + 1

# ---------------------------------------------------------------- 합성
for o in sorted(objs, key=lambda o: (o.get('layer', 0), o['by'], o['x'])):
    x, y = int(o['x']), int(o['y'])
    if x < 0 or y < 0 or x + o['img'].width > img.width or y + o['img'].height > img.height:
        sub = o['img'].crop((max(0, -x), max(0, -y), min(o['img'].width, img.width - x), min(o['img'].height, img.height - y)))
        img.alpha_composite(sub, (max(0, x), max(0, y)))
    else: img.alpha_composite(o['img'], (x, y))
# 얼음 문과 계단은 앞면 위 맨 위에
for o in objs:
    if o['name'] in ('door_ice', 'stairs_up_face', 'frozen_waterfall', 'torch_wall'):
        img.alpha_composite(o['img'], (int(o['x']), int(o['y'])))

def decorated():
    d = ~op | face | lake | snow_m | crack_m
    for o in objs:
        if o['name'] in ('icicle_a', 'icicle_b'): continue
        x0 = max(0, int(o['x']) // 16); x1 = min(W - 1, (int(o['x']) + o['img'].width - 1) // 16)
        y0 = max(0, int(o['y']) // 16); y1 = min(H - 1, (int(o['y']) + o['img'].height - 1) // 16)
        d[y0:y1 + 1, x0:x1 + 1] = True
    return d

# ---- 빈 창 메우기: 걷는 자리 한 칸짜리 소품을 덩이로(막는 것은 1칸, 3x3 이 모두 열린 자리만, 지나는 길은 남긴다)
FILLERS = [('stalagmite_ice', [(0, 0)]), ('crystal_blue', [(0, 0)]), ('rubble_ice', None), ('snow_pile_s', [(0, 0)]), ('bones_scatter', None), ('ice_block', [(0, 0)]), ('crystal_cluster', [(0, 0), (1, 0)]), ('snow_drift', [(0, 0), (1, 0)])]
def free_open(x, y):
    return 1 <= x < W - 1 and 1 <= y < H - 1 and op[y - 1:y + 2, x - 1:x + 2].all() and not face[y - 1:y + 2, x - 1:x + 2].any() and blocked_obj[y - 1:y + 2, x - 1:x + 2].sum() <= 2
for _it in range(60):
    dec = decorated(); empty = ~dec
    r, wx, wy = max(((empty[y:y + 15, x:x + 20].mean(), x, y) for y in range(0, H - 14) for x in range(0, W - 19)))
    if r <= 0.37: break
    best = None
    for y in range(wy + 1, wy + 14):
        for x in range(wx + 1, wx + 19):
            if empty[y, x] and free_open(x, y) and not RES[y, x]:
                sc = empty[max(0, y - 2):y + 3, max(0, x - 2):x + 3].sum()
                if best is None or sc > best[0]: best = (sc, x, y)
    if best is None: break
    _, bx_, by_ = best; n = 0
    for _t in range(10):
        nm, blk = rng.choice(FILLERS)
        px_, py_ = bx_ + rng.randint(-2, 2), by_ + rng.randint(-1, 2)
        if 1 < px_ < W - 2 and free_open(px_, py_) and put(nm, px_, py_, block=blk): n += 1
        if n >= 3: break
    if n == 0: occ[by_, bx_] = True; RES[by_, bx_] = True

# ---------------------------------------------------------------- 통행
walk &= ~blocked_obj
for (x, y) in DOOR: walk[y, x] = True
# 내려가는 계단 칸은 걷기(밟으면 내려간다)
for i in range(2): walk[sy, sx + i] = True
marks = {'entrance': (11, 31), 'exit_up': (13, 24), 'campfire': (11, 31), 'lake_shore': (24, 22), 'waterfall_foot': (26, 14), 'door_front': (32, 10),
         'chamber': (36, 6), 'icicle_hall': (9, 12), 'bone_rest': (35, 30), 'stairs_down': (40, 30)}
def bfs(start):
    seen = {start}; q = collections.deque([start])
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            xx, yy = x + dx, y + dy
            if 0 <= xx < W and 0 <= yy < H and walk[yy, xx] and (xx, yy) not in seen: seen.add((xx, yy)); q.append((xx, yy))
    return seen
reach = bfs(marks['entrance'])
miss = [k for k, v in marks.items() if v not in reach]
print('BFS 닿지 않는 표지:', miss, '| 걸음칸', int(walk.sum()), '닿음', len(reach))

# ---------------------------------------------------------------- 빈 바닥 / 앞면 검사
dec = decorated(); empty = ~dec
worst = max(((empty[y:y + 15, x:x + 20].mean(), x, y) for y in range(0, H - 14) for x in range(0, W - 19)))
print('한 화면(20x15) 빈 바닥 최악 %.2f at (%d,%d)' % worst, '| 열린칸', int(op.sum()), '앞면칸', int(face.sum()))
print(COUNT)


# ---------------------------------------------------------------- 내보내기
def export():
    from ice_meta import META
    Pq = Parts(HERE)
    def samp(fn, w=48, h=48, **k):
        Y, X = np.mgrid[0:h, 0:w]; return Image.fromarray(fn(X, Y, **k).astype(np.uint8), 'RGB').convert('RGBA')
    def face(fn, seed, w=48, h=32):
        Y, X = np.mgrid[0:h, 0:w]; return Image.fromarray(fn(X, Y, Y, seed=seed, Hf=h).astype(np.uint8), 'RGB').convert('RGBA')
    special = {'ground_ice': lambda: samp(IT.paint_ice, seed=2), 'ground_ice_cracked': lambda: samp(IT.paint_ice, seed=3, cracks=True), 'ground_snow': lambda: samp(IT.paint_snow, seed=4),
               'ground_lake': lambda: samp(IT.paint_lake, seed=5), 'face_ice': lambda: face(IT.paint_face_ice, 11), 'face_rock': lambda: face(IT.paint_face_rock, 13),
               'ceiling_cave': lambda: samp(IT.paint_ceiling, seed=17), 'autotile-frozenlake': lambda: SH['lake'], 'autotile-snowdrift': lambda: SH['snow'], 'autotile-crack': lambda: SH['crack']}
    for n, md in META.items():
        pad = n not in special
        img = special[n]() if n in special else getattr(IP, n)()
        Pq.add(n.replace('_', '-') if n.startswith(('ground_', 'ceiling_')) else n, img, md['kind'], md['ko'], md['desc'], md['rules'], md.get('brows'), md.get('layer'), md.get('role'), pad=pad)
    cnt = Pq.finish('얼음 동굴 (ice-cave)')
    img.convert('RGB').save(HERE + '/render-1x.png') if False else None
    full = IMG_FINAL.convert('RGB')
    full.save(HERE + '/render-1x.png'); full.resize((full.width * 2, full.height * 2), Image.NEAREST).save(HERE + '/render-2x.png')
    json.dump({'w': W, 'h': H, 'tile': 16, 'rows': [''.join('.' if (x, y) in reach else '#' for x in range(W)) for y in range(H)], 'legend': {'.': 'walkable', '#': 'blocked (wall face/ceiling/object)'},
               'marks': {k: list(v) for k, v in marks.items()}, 'unreachable': miss, 'sealed_pockets': int(walk.sum()) - len(reach), 'empty_window': [float(worst[0]), [int(worst[1]), int(worst[2])]],
               'face_rows': 2, 'count': COUNT}, open(HERE + '/grid.json', 'w'), ensure_ascii=False)
    return cnt

IMG_FINAL = img
if __name__ == '__main__':
    print('parts', export())
if os.environ.get('DBG'):
    for y in range(H):
        print(''.join(('F' if face[y,x] else '#' if not op[y,x] else ('o' if blocked_obj[y,x] else '.' if walk[y,x] else 'x')) for x in range(W)))
