# 버들항 변형 3-② 고대 신전 폐허. 다시 돌리면 같은 그림이 나온다.
#   python3 make_temple_ruins.py   (이 폴더에 render-1x/2x.png, grid.json, parts/, parts.md 를 쓴다)
import os, sys, math
OUTD = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(OUTD, '..', '_lib3'))
from dlib import *
import dprops as D
import dcheck, dfill

W_, H_ = 58, 44
m = Map(W_, H_, 'temple-ruins'); m.ceil_seed = 23; m.band_pal = 'temple'

def B(img): return [(dx, 0) for dx in range(img.width // T)]
def BB(img): return [(dx, -dy) for dx in range(img.width // T) for dy in range(img.height // T)]
def put(x, y, img, block='bottom', layer=1):
    blk = B(img) if block == 'bottom' else (BB(img) if block == 'all' else block)
    m.props_add(x, y, img, blk, layer)
BAD = []
def face_ok(x, y, w=1, h=1):
    m.compute_faces()
    for j in range(h):
        for i in range(w):
            if (x + i, y + j) not in m.face: BAD.append((x + i, y + j))
GL = D.glow(48, (255, 176, 84), 64)
GL2 = D.glow(64, (255, 176, 84), 60)
def lit(cx, cy, big=False): m.glow_at(cx + .5, cy + .5, GL2 if big else GL)

# ---------------------------------------------------------------- 방과 복도
m.floor(21, 4, 18, 8, 'trav', 3, 'temple')                   # SA 내전
m.floor(29, 12, 2, 5, 'trav', 2, 'temple')                   # 내전 복도
m.floor(14, 17, 32, 8, 'trav', 3, 'temple')                  # NV 대신랑
m.floor(3, 17, 7, 8, 'trav', 3, 'temple')                    # WC 유물실
m.floor(10, 20, 4, 2, 'trav', 2, 'temple')
m.floor(50, 17, 6, 8, 'trav', 3, 'temple')                   # EC 서고
m.floor(46, 20, 4, 2, 'trav', 2, 'temple')
m.floor(29, 25, 2, 5, 'ruin', 2, 'temple')                   # 대신랑 → 앞뜰 복도
m.floor(20, 30, 26, 11, 'ruin', 3, 'temple')                 # FC 앞뜰
m.floor(3, 33, 11, 9, 'dirt', 3, 'temple')                   # AP 진입로
m.floor(14, 36, 6, 2, 'ruin', 2, 'temple')
m.floor(46, 34, 6, 2, 'ruin', 2, 'temple')
m.floor(52, 30, 5, 11, 'grass', 3, 'temple')                 # OG 성림

# 풀·흙 얼룩 (바깥은 덩어리로): 타원 (cx, cy, rx, ry, kind)
def blob(cx, cy, rx, ry, kind, only=('ruin', 'dirt', 'grass')):
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            if m.inb(x, y) and m.fl[y][x] in only and ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 + (hash((x, y)) % 5 - 2) * .04:
                m.fl[y][x] = kind
for (cx, cy, rx, ry) in ((23, 33, 3.2, 2), (41, 32, 3.6, 1.8), (24, 39, 4, 1.6), (43, 38, 3, 2.2), (36, 40, 2.4, 1.1), (21, 36, 1.5, 2)):
    blob(cx, cy, rx, ry, 'grass', ('ruin',))
for (cx, cy, rx, ry) in ((29.5, 36, 1.3, 4.5),):                 # 흙길 (복도에서 앞뜰 가운데로)
    blob(cx, cy, rx, ry, 'dirt', ('ruin', 'grass'))
for (cx, cy, rx, ry) in ((7, 37, 5.5, 3.4),):
    blob(cx, cy, rx, ry, 'dirt', ('dirt', 'grass'))
for (cx, cy, rx, ry) in ((4.5, 34.5, 2.5, 1.8), (12, 40.5, 2.5, 1.2), (9, 34, 2.5, 1.0)):
    blob(cx, cy, rx, ry, 'grass', ('dirt',))
blob(54, 35, 2.2, 3.6, 'dirt', ('grass',))

# ---------------------------------------------------------------- 그림 등록
mos = reg('mosaic_medallion_7x7', D.mosaic_medallion(3), '대신랑 바닥 모자이크 메달리온 (7×7칸, 원형 문양)', (7, 7))
torch = reg('torch_wall', D.torch_wall(), '벽 횃불')
archD = reg('arch_dark', D.arch_opening(2, 2, 'dark'), '벽 아치 — 막힌 어둠 (돌 쐐기 테두리)', (2, 2))
archB = reg('arch_bars', D.arch_opening(2, 2, 'bars'), '벽 아치 — 쇠창살', (2, 2))
nUrn = reg('niche_urn', D.niche('urn'), '벽감 — 항아리')
nShr = reg('niche_shroud', D.niche('shroud'), '벽감 — 수의 안치')
nSku = reg('niche_skull', D.niche('skull'), '벽감 — 해골')
vine1 = reg('vines_2', D.vines(1, 2), '앞면을 타고 내린 덩굴 (1×2)', (1, 2))
vine2 = D.vines(4, 2); vine3 = D.vines(7, 3)
def deco(img, x, y):
    face_ok(x, y, img.width // T, img.height // T)
    m.decal(x, y, img)

# 내전 SA 북벽 앞면 y1-3
for x in (23, 36): deco(torch, x, 2)
for x in (25, 27, 32, 34): deco(nUrn, x, 2)
deco(archD, 29, 2)
# 대신랑 NV 북벽 앞면 y14-16
for x in (16, 23, 36, 43): deco(torch, x, 15)
deco(archB, 19, 15); deco(archD, 39, 15); deco(archD, 26, 15); deco(archB, 32, 15)
# 유물실 WC 북벽
for x in (4, 5, 7, 8): deco(nShr, x, 15)
deco(nSku, 6, 15); deco(torch, 3, 15)
# 서고 EC 북벽
deco(torch, 51, 15); deco(torch, 54, 15); deco(nUrn, 52, 15); deco(nUrn, 53, 15)
# 바깥 벽 앞면: 덩굴
for x in (22, 25, 33, 37, 42): deco(vine1, x, 27)
for x in (23, 35, 40): deco(vine2, x, 28)
deco(archD, 27, 27); deco(archB, 32, 27)
for x in (3, 5, 9, 12): deco(vine1, x, 30)
deco(vine2, 7, 30)
for x in (52, 54, 56): deco(vine1, x, 27)
deco(vine2, 55, 28)
m.decal(26, 18, mos)

# ---------------------------------------------------------------- 소품
brz = reg('brazier', D.brazier(), '화로')
colT = reg('column_temple', D.column(2, 'temple'), '신전 돌 기둥 (1×2)', (1, 2))
colTb = reg('column_temple_broken', D.column(2, 'temple', 1), '부러진 신전 기둥 그루터기 (1×2)', (1, 2))
colT3 = reg('column_temple_tall', D.column(3, 'temple'), '키 큰 신전 기둥 (1×3)', (1, 3))
fcol = reg('fallen_column_temple', D.fallen_column(2, 'temple'), '쓰러진 신전 기둥', (2, 1))
fcol2 = D.fallen_column(2, 'temple', 3)
rub = reg('rubble_temple', D.rubble(0, 'temple'), '무너진 대리석 부스러기')
rub2 = D.rubble(5, 'temple'); rub3 = D.rubble(9, 'temple')
rwall = reg('ruined_wall_2', D.ruined_wall(2), '서 있는 낮은 폐허 벽 조각 (2×2)', (2, 2))
rwall2 = D.ruined_wall(2, 4)
tree = reg('cypress_ruin', D.tree_ruin(1), '폐허에 자란 사이프러스 (1×3)', (1, 3))
tree2 = D.tree_ruin(3)
altS = reg('altar_stone', D.altar_stone(), '내전 석제단 (2×2)', (2, 2))
sarc = reg('sarcophagus', D.sarcophagus(), '석관 (2×1.5)', (2, 2))
stairs = reg('stairs_down', D.stairs_down(), '바닥에서 아래로 내려가는 계단 한 칸')
cand = reg('candles', D.candles(3), '촛불 세 자루'); cand1 = D.candles(1, 4)
bones = reg('bones', D.bones(1, 1), '흩어진 뼈')
crate = reg('crate', D.crate(), '나무 상자'); barrel = reg('barrel', D.barrel(), '통')
bucket = reg('bucket', D.bucket(), '양동이')
lamp = reg('lantern_post', D.lantern_post(), '등불 기둥')
skulls = reg('skulls', D.skulls(2, 3), '해골 무더기')
dm = reg('door_wood', D.door(1, 2, 'wood'), '나무 문 (1×2)', (1, 2))

# ---- 내전 SA (21..38, 4..11)
mos5 = reg('mosaic_medallion_5x5', D.mosaic_medallion(2, 2), '내전 바닥 작은 모자이크 메달리온 (5×5칸)', (5, 5))
m.decal(28, 5, mos5)
put(29, 6, altS, [(0, 0), (1, 0), (0, -1), (1, -1)])
m.decal(30, 8, stairs); m.blocked.discard((30, 8))
put(27, 6, brz); lit(27, 6); put(32, 6, brz); lit(32, 6)
put(24, 5, colT, [(0, 0)]); put(35, 5, colT, [(0, 0)]); put(24, 9, colT, [(0, 0)]); put(35, 9, colT, [(0, 0)])
put(22, 5, cand); put(37, 5, cand); put(22, 10, colTb, [(0, 0)]); put(37, 10, rub2, [])
put(26, 9, cand1, []); put(33, 9, cand1, []); put(21, 7, rub, []); put(38, 8, rub2, [])
put(28, 10, sarc, [(0, 0), (1, 0)]); put(33, 10, cand)
put(22, 8, bones, []); put(36, 7, bones, [])
# ---- 내전 복도
lit(29, 12)
# ---- 대신랑 NV (14..45, 17..24)
for x in (16, 19, 22, 36, 39, 42): put(x, 19, colT, [(0, 0)])
for x in (16, 19, 22, 36, 39, 42): put(x, 23, colT if x not in (19, 39) else colTb, [(0, 0)])
put(25, 18, brz); lit(25, 18); put(34, 18, brz); lit(34, 18)
put(15, 17, rub, []); put(44, 17, rub2, []); put(14, 24, bones, []); put(45, 24, cand)
put(17, 21, cand1, []); put(41, 21, cand1, []); put(20, 21, rub3, []); put(38, 21, rub, [])
put(24, 24, fcol, [(0, 0), (1, 0)]); put(33, 24, cand); put(43, 20, rub2, [])
put(24, 22, rub, []); put(35, 23, bones, [])
# ---- 유물실 WC (3..9, 17..24)
put(4, 19, sarc, [(0, 0), (1, 0)]); put(7, 19, sarc, [(0, 0), (1, 0)])
put(4, 23, sarc, [(0, 0), (1, 0)]); put(8, 23, cand); put(3, 21, cand); put(9, 21, colTb, [(0, 0)])
put(6, 21, bones, []); put(5, 24, skulls, [])
put(7, 17, rub2, [])
# ---- 서고 EC (50..55, 17..24)
put(51, 18, cand); put(54, 18, brz); lit(54, 18)
put(51, 21, crate); put(52, 21, barrel); put(53, 21, crate); put(51, 22, barrel)
put(54, 23, cand); put(50, 24, rub2, []); put(53, 24, bones, [])
put(55, 21, colTb, [(0, 0)]); put(52, 19, bucket)
# ---- 앞뜰 FC (20..45, 30..40)
for x in (22, 25, 33, 36, 39, 42):
    put(x, 32, colT3 if x in (22, 36, 42) else colTb, [(0, 0)])
for x in (22, 25, 33, 36, 39, 42):
    put(x, 38, colTb if x in (22, 36, 42) else colT, [(0, 0)])
put(28, 32, fcol, [(0, 0), (1, 0)]) if False else None
put(26, 34, fcol, [(0, 0), (1, 0)]); put(37, 35, fcol2, [(0, 0), (1, 0)])
put(23, 30, rwall, [(0, 0), (1, 0)]); put(43, 30, rwall2, [(0, 0), (1, 0)]); put(31, 30, rwall2, [(0, 0), (1, 0)])
put(20, 34, tree, [(0, 0)]); put(45, 36, tree2, [(0, 0)]); put(20, 40, tree, [(0, 0)])
put(29, 40, brz); lit(29, 40)
for (x, y, im) in ((24, 36, rub2), (34, 39, rub), (41, 34, rub3), (27, 40, rub), (44, 32, rub2), (32, 36, rub), (38, 33, rub2), (21, 31, rub)):
    put(x, y, im, [])
put(24, 40, bones, []); put(41, 40, skulls, []); put(43, 40, cand); put(21, 38, cand)
put(35, 31, lamp, [(0, 0)]); put(27, 37, cand1, [])
# ---- 진입로 AP (3..13, 33..41)
put(4, 35, colT3, [(0, 0)]); put(5, 35, colTb, [(0, 0)]); put(11, 35, colT3, [(0, 0)])
put(12, 34, fcol, [(0, 0), (1, 0)])
put(3, 39, tree, [(0, 0)]); put(13, 40, tree2, [(0, 0)]); put(9, 40, rub2, []); put(6, 41, rub, [])
put(8, 34, rwall, [(0, 0), (1, 0)]); put(4, 38, bones, []); put(10, 38, rub3, [])
put(5, 41, bucket)
# ---- 성림 OG (52..56, 30..40)
put(53, 32, tree, [(0, 0)]); put(56, 34, tree2, [(0, 0)]); put(54, 38, tree, [(0, 0)])
put(54, 35, altS, [(0, 0), (1, 0), (0, -1), (1, -1)]); put(52, 37, cand); put(55, 37, cand)
put(56, 31, rub2, []); put(52, 40, rub, []); put(56, 40, bones, [])


# ---- 빈 바닥 채우기 (덩어리 묶음)
RES = set()
for (x0, y0, w, h) in [(29, 12, 2, 5), (10, 20, 4, 2), (46, 20, 4, 2), (29, 25, 2, 5), (14, 36, 6, 2), (46, 34, 6, 2), (28, 8, 4, 4)]:
    for yy in range(y0, y0 + h):
        for xx in range(x0, x0 + w): RES.add((xx, yy))
for (px, py) in [(6, 39), (30, 8)]:
    for yy in range(py - 1, py + 2):
        for xx in range(px - 1, px + 2): RES.add((xx, yy))
TH = {
    'trav': [[(0, 0, rub, 'n'), (1, 0, bones, 'n'), (0, -1, cand1, 'n')],
             [(0, 0, cand, 'b'), (1, 0, rub2, 'n'), (2, 0, cand1, 'n')],
             [(0, 0, colTb, 'b'), (1, 0, rub3, 'n'), (-1, 0, rub2, 'n')],
             [(0, 0, rub2, 'n'), (1, 0, rub, 'n'), (0, 1, bones, 'n'), (1, 1, cand1, 'n')]],
    'ruin': [[(0, 0, rub, 'n'), (1, 0, rub2, 'n'), (0, 1, rub3, 'n')],
             [(0, 0, colTb, 'b'), (1, 0, rub, 'n'), (-1, 0, rub3, 'n'), (0, 1, bones, 'n')],
             [(0, 0, fcol, 'b'), (0, 1, rub2, 'n'), (2, 1, rub, 'n')],
             [(0, 0, rwall2, 'b'), (2, 0, rub3, 'n'), (1, 1, bones, 'n')]],
    'grass': [[(0, 0, tree2, 't'), (1, 0, rub2, 'n'), (-1, 0, rub, 'n')],
              [(0, 0, rub2, 'n'), (1, 0, rub, 'n'), (0, 1, bones, 'n')],
              [(0, 0, tree, 't'), (0, 1, rub3, 'n')]],
    'dirt': [[(0, 0, rub2, 'n'), (1, 0, rub, 'n'), (0, 1, bones, 'n')],
             [(0, 0, colTb, 'b'), (1, 0, rub3, 'n'), (0, 1, rub, 'n')],
             [(0, 0, rwall2, 'b'), (2, 0, rub2, 'n')]],
}
n_fill = dfill.autofill(m, TH, RES, seed=3)
print('fill clusters', n_fill)

if BAD: print('앞면 아닌 장식 칸', BAD); sys.exit(1)
dcheck.reg_materials(m)
ENT = (6, 39); FIN = (30, 8)
wps = {'진입로': ENT, '앞뜰': (29, 36), '앞뜰 복도': (29, 27), '대신랑 남쪽': (30, 24), '메달리온': (29, 21),
       '유물실': (5, 21), '서고': (52, 20), '성림': (54, 33), '내전 복도': (30, 14), '내전': (30, 10), '제단 앞 계단': FIN}
emp = dcheck.emptiness(m)
data = m.export(OUTD, ENT, FIN, wps, extra=dict(emptiness=emp))
lines = dump_parts(OUTD)
dcheck.write_parts_md(OUTD, lines, '고대 신전 폐허')
print('path', data['path_len'], 'reach', data['reachable'], 'comps', data['walk_components'], data['component_sizes'])
print('wp', {k: v['reach'] for k, v in data['waypoints'].items()})
print('empty', emp); print('parts', len(lines))
