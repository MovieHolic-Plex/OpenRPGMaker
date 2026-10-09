# 버들항 변형 3-④ 성 지하 감옥·카타콤. 다시 돌리면 같은 그림이 나온다.
#   python3 make_castle_catacombs.py   (이 폴더에 render-1x/2x.png, grid.json, parts/, parts.md 를 쓴다)
import os, sys, random
OUTD = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(OUTD, '..', '_lib3'))
from dlib import *
import dprops as D
import dcheck, dfill

W_, H_ = 56, 42
m = Map(W_, H_, 'castle-catacombs'); m.ceil_seed = 47; m.cave = False

def B(img): return [(dx, 0) for dx in range(img.width // T)]
def put(x, y, img, block='bottom', layer=1):
    blk = B(img) if block == 'bottom' else block
    m.props_add(x, y, img, blk, layer)
BAD = []
def face_ok(x, y, w=1, h=1):
    m.compute_faces()
    for j in range(h):
        for i in range(w):
            if (x + i, y + j) not in m.face: BAD.append((x + i, y + j))
def deco(img, x, y):
    face_ok(x, y, img.width // T, img.height // T); m.decal(x, y, img)
GL = D.glow(48, (255, 176, 84), 64)
GL2 = D.glow(64, (255, 176, 84), 60)
def lit(cx, cy, big=False): m.glow_at(cx + .5, cy + .5, GL2 if big else GL)

# ---------------------------------------------------------------- 방과 복도
# 감방동 CB : 감방 셋(칸막이 벽 사이) + 간수 자리 + 홀
for x0 in (3, 8, 13):
    m.floor(x0, 20, 4, 4, 'cell', 3, 'castle')
m.floor(18, 20, 7, 4, 'castle', 3, 'castle')
m.floor(3, 24, 22, 6, 'castle', 3, 'castle')
m.floor(3, 6, 28, 8, 'cata', 3, 'cata')                       # NG 벽감 회랑
m.floor(36, 4, 18, 12, 'bone', 3, 'cata')                     # BC 뼈의 방
m.floor(30, 20, 24, 10, 'darkcata', 3, 'castle')              # TR 고문실
m.floor(20, 35, 16, 6, 'castle', 3, 'castle')                 # E 입구 계단실
m.floor(3, 35, 13, 6, 'castle', 3, 'castle')                  # GR 간수 대기실
m.floor(38, 34, 16, 7, 'darkcata', 3, 'cata')                 # OS 납골당
# 복도 (폭 2)
m.floor(22, 14, 2, 6, 'castle', 2, 'castle')                  # NG → 간수 자리
m.floor(31, 9, 5, 2, 'cata', 2, 'cata')                       # NG → BC
m.floor(45, 16, 2, 4, 'darkcata', 2, 'cata')                  # BC → TR
m.floor(25, 25, 5, 2, 'castle', 2, 'castle')                  # CB → TR
m.floor(23, 30, 2, 5, 'castle', 2, 'castle')                  # CB → E
m.floor(31, 30, 2, 5, 'castle', 2, 'castle')                  # TR → E
m.floor(16, 37, 4, 2, 'castle', 2, 'castle')                  # E → GR
m.floor(36, 37, 2, 2, 'darkcata', 2, 'cata')                  # E → OS
m.floor(44, 30, 2, 4, 'darkcata', 2, 'cata')                  # TR → OS

# ---------------------------------------------------------------- 그림 등록
torch = reg('torch_wall', D.torch_wall(), '벽 횃불')
chains = reg('chains', D.chains(1), '벽에 걸린 쇠사슬 (앞면 위)')
chains2 = D.chains(5)
cage = reg('cage_hanging', D.cage_hanging(), '매달린 새장 (앞면 1×2)', (1, 2))
banner = reg('banner_cult', D.banner_cult(), '의식 깃발 (앞면 1×2)', (1, 2))
nSku = reg('niche_skull', D.niche('skull'), '벽감 — 해골')
nShr = reg('niche_shroud', D.niche('shroud'), '벽감 — 수의 안치')
nUrn = reg('niche_urn', D.niche('urn'), '벽감 — 항아리')
stairs = reg('stairs_up_face', D.stairs_up_face(1), '성으로 오르는 계단 (앞면 1×2)', (1, 2))
bed = reg('straw_bed', D.straw_bed(1), '볏짚 침상')
bed2 = D.straw_bed(4)
bucket = reg('bucket', D.bucket(), '양동이')
brazier = reg('brazier', D.brazier(), '화로')
rack = reg('rack_32', D.rack(), '고문대 (2×2)', (2, 2))
rack2 = D.rack(3)
maiden = reg('iron_maiden', D.iron_maiden(), '강철 처녀 (1×2)', (1, 2))
anvil = reg('anvil_table', D.anvil_table(), '모루 탁자 (2×1.5)', (2, 2))
grate = reg('grate_floor', D.grate_floor(), '바닥 배수 창살')
coffin = reg('coffin', D.coffin(), '관 (2×1.5)', (2, 2))
coffin2 = D.coffin(4)
sarc = reg('sarcophagus', D.sarcophagus(), '석관 (2×1.5)', (2, 2))
sarc2 = D.sarcophagus(5)
bones = reg('bones', D.bones(1, 1), '뼈')
bones2 = D.bones(3, 2)
skulls = reg('skulls', D.skulls(2, 3), '해골 무더기')
skulls2 = D.skulls(6, 2)
heap = reg('bone_heap', D.bone_heap(), '뼈 더미 (2×1.5)', (2, 2))
heap2 = D.bone_heap(4)
altar = reg('altar_stone', D.altar_stone(), '돌 제단 (2×2)', (2, 2))
cand = reg('candles', D.candles(3, 1), '촛불 세 자루')
cand2 = D.candles(2, 6)
col = reg('column_cata', D.column(2, 'cata'), '카타콤 기둥 (1×2)', (1, 2))
colb = D.column(2, 'cata', broken=1, seed=3)
rub = reg('rubble', D.rubble(1, 'cata'), '돌무더기')
rub2 = D.rubble(4, 'cata'); rub3 = D.rubble(7, 'cata')
barrel = reg('barrel', D.barrel(), '술통')
barrel2 = D.barrel(3)
crate = reg('crate', D.crate(1, 1), '상자'); crate2 = D.crate(4, 2)

# ---------------------------------------------------------------- 앞면 장식
rng = random.Random(9)
# 감방 뒷벽 (앞면 y17-19)
for x0 in (3, 8, 13):
    deco(chains if x0 != 8 else chains2, x0 + 1, 19)
    deco(chains2 if x0 != 8 else chains, x0 + 3, 18)
for (x, y) in ((7, 22), (12, 22), (17, 22)): deco(torch, x, y)   # 칸막이 앞면
for x in (18, 20): deco(torch, x, 18)
deco(chains, 24, 19)
# 벽감 회랑 북벽 (앞면 y3-5)
niche_x = [4, 5, 7, 8, 10, 12, 13, 15, 16, 18, 19, 21, 23, 24, 26, 27, 29]
for i, x in enumerate(niche_x):
    deco((nSku, nShr, nUrn)[(i * 7 + (i // 3)) % 3], x, 5)
for x in (6, 11, 17, 22, 28): deco(torch, x, 4); lit(x, 4)
for x in (9, 14, 20, 25): deco(nSku, x, 4)
# 뼈의 방 북벽 (앞면 y1-3)
for x in (38, 40, 42, 47, 49, 51): deco(nSku if x % 4 == 2 else nShr, x, 3)
for x in (37, 52): deco(torch, x, 2); lit(x, 2)
deco(banner, 43, 2); deco(banner, 47, 2)
for x in (44, 45, 46): deco(nSku if x != 45 else nUrn, x, 3)
# 고문실 북벽 (앞면 y17-19)
for x in (32, 38, 51): deco(torch, x, 18); lit(x, 18)
deco(cage, 35, 18); deco(cage, 49, 18)
for x in (33, 41, 43, 52): deco(chains if x % 2 else chains2, x, 19)
deco(chains2, 37, 18)
# 납골당 북벽 (앞면 y31-33)
for x in (38, 39, 40, 41, 42, 43, 47, 48, 50, 51, 52, 53): deco((nShr, nUrn, nSku)[x % 3], x, 33)
for x in (40, 49): deco(torch, x, 32); lit(x, 32)
for x in (39, 42, 48, 52): deco(nSku, x, 32)
# 입구 계단실 북벽 (앞면 y32-34)
deco(stairs, 27, 33)
for x in (25, 29): deco(torch, x, 33); lit(x, 33)
deco(chains, 26, 32); deco(chains2, 28, 32)
# 간수 대기실 북벽
for x in (5, 12): deco(torch, x, 33); lit(x, 33)
deco(chains, 8, 33)

# ---------------------------------------------------------------- 소품
# 감방: 침상·양동이·뼈
for i, x0 in enumerate((3, 8, 13)):
    put(x0, 22, bed if i != 1 else bed2, [(0, 0)])
    put(x0 + 3, 21, bucket, [(0, 0)])
put(4, 23, bones, []); put(10, 21, bones2, []); put(14, 22, skulls, [])
# 간수 자리 (탁자·상자·화로)
put(20, 22, anvil, B(anvil)); put(18, 21, crate, [(0, 0)]); put(19, 21, barrel, [(0, 0)])
put(18, 23, brazier, [(0, 0)]); lit(18, 23)
put(20, 20, cand, [])
# 감방동 홀
put(3, 26, brazier, [(0, 0)]); lit(3, 26); put(24, 28, brazier, [(0, 0)]); lit(24, 28)
put(6, 28, bed2, []); put(7, 28, bones, []); put(15, 27, bucket, []); put(16, 26, rub, []); put(11, 29, rub2, [])
put(20, 29, crate2, [(0, 0)]); put(21, 29, barrel2, [(0, 0)])
m.decal(12, 27, grate); m.decal(13, 27, grate); m.decal(12, 28, grate)
# 입구 계단실
put(21, 36, brazier, [(0, 0)]); lit(21, 36); put(34, 36, brazier, [(0, 0)]); lit(34, 36)
put(22, 39, barrel, [(0, 0)]); put(23, 39, crate, [(0, 0)]); put(33, 39, barrel2, [(0, 0)]); put(32, 40, crate2, [(0, 0)])
put(29, 38, rub, []); put(24, 37, bucket, [])
m.decal(27, 38, grate)
# 간수 대기실
put(5, 38, anvil, B(anvil)); put(8, 38, cand, []); put(4, 40, crate, [(0, 0)]); put(5, 40, barrel, [(0, 0)])
put(11, 37, rack, [(0, 0), (1, 0)]); put(14, 37, bed, [(0, 0)]); put(13, 40, bed2, [(0, 0)]); put(9, 40, bucket, [])
put(3, 36, brazier, [(0, 0)]); lit(3, 36)
# 벽감 회랑: 기둥·관·석관·촛불
for x in (7, 13, 19, 26): put(x, 11, col, [(0, 0)])
put(10, 12, colb, [(0, 0)]) 
put(5, 9, coffin, B(coffin)); put(9, 8, coffin2, B(coffin)); put(15, 9, sarc, B(sarc)); put(24, 9, coffin, B(coffin)); put(28, 9, sarc2, B(sarc))
put(6, 12, cand, []); put(16, 11, cand2, []); put(25, 12, cand, []); put(11, 8, skulls, []); put(19, 8, bones, []); put(12, 13, bones2, [])
put(4, 13, rub, []); put(28, 13, rub2, []); put(14, 13, rub3, [])
# 뼈의 방
put(38, 8, heap, B(heap)); put(50, 10, heap2, B(heap)); put(39, 13, heap2, B(heap)); put(51, 14, heap, B(heap)); put(48, 6, heap, B(heap))
put(44, 7, altar, B(altar)); put(43, 7, cand, []); put(47, 7, cand2, [])
for (x, y) in ((37, 5), (52, 5), (41, 11), (49, 13)): put(x, y, skulls if (x + y) % 2 else skulls2, [])
for (x, y) in ((42, 9), (47, 9), (40, 14), (44, 13), (53, 8)): put(x, y, bones if (x + y) % 2 else bones2, [])
put(36, 15, col, [(0, 0)]); put(53, 15, col, [(0, 0)])
put(37, 12, brazier, [(0, 0)]); lit(37, 12); put(53, 5, brazier, [(0, 0)]); lit(53, 5)
# 고문실
put(33, 24, rack, B(rack)); put(49, 27, rack2, B(rack)); put(37, 22, maiden, [(0, 0)]); put(52, 23, maiden, [(0, 0)])
put(40, 26, anvil, B(anvil)); put(31, 21, brazier, [(0, 0)]); lit(31, 21); put(52, 21, brazier, [(0, 0)]); lit(52, 21)
put(36, 28, brazier, [(0, 0)]); lit(36, 28); put(51, 28, brazier, [(0, 0)]); lit(51, 28)
m.decal(42, 24, grate); m.decal(43, 24, grate); m.decal(42, 25, grate)
put(35, 27, bucket, []); put(48, 24, bones2, []); put(38, 25, bones, []); put(33, 28, bed2, []); put(50, 25, skulls, []); put(39, 21, bucket, [])
put(30, 28, rub, []); put(53, 29, rub2, [])
# 납골당
put(40, 37, sarc, B(sarc)); put(49, 36, sarc2, B(sarc)); put(51, 40, sarc, B(sarc)); put(42, 40, sarc2, B(sarc))
for x in (38, 47, 53): put(x, 35, col, [(0, 0)])
put(48, 39, cand, []); put(41, 35, cand2, []); put(52, 37, bones, []); put(43, 38, skulls2, []); put(39, 40, bones2, [])
put(46, 40, rub, []); put(53, 40, rub3, [])

# ---------------------------------------------------------------- 빈 바닥 자동 채움 (덩이 소품)
RES = set()
def res(x0, y0, w, h):
    for yy in range(y0, y0 + h):
        for xx in range(x0, x0 + w): RES.add((xx, yy))
res(22, 14, 2, 6); res(31, 9, 5, 2); res(45, 16, 2, 4); res(25, 25, 5, 2); res(23, 30, 2, 5); res(31, 30, 2, 5)
res(16, 37, 4, 2); res(36, 37, 2, 2); res(44, 30, 2, 4); res(44, 20, 3, 10); res(22, 24, 3, 2); res(45, 34, 2, 4)
res(31, 29, 2, 1); res(23, 24, 2, 6); res(3, 24, 2, 6)
TH = {
    'cata': [[(0, 0, rub, 'n'), (1, 0, bones, 'n'), (0, 1, skulls, 'n')],
             [(0, 0, cand, 'n'), (1, 1, rub2, 'n')],
             [(0, 0, bones2, 'n'), (2, 0, rub3, 'n'), (1, 1, bones, 'n')]],
    'bone': [[(0, 0, bones, 'n'), (1, 0, skulls2, 'n')], [(0, 0, skulls, 'n'), (1, 1, bones2, 'n'), (2, 0, rub, 'n')]],
    'darkcata': [[(0, 0, rub, 'n'), (1, 0, bones2, 'n')], [(0, 0, cand2, 'n'), (1, 1, skulls, 'n')],
                 [(0, 0, bucket, 'n'), (1, 0, rub3, 'n'), (0, 1, bones, 'n')]],
    'castle': [[(0, 0, rub, 'n'), (1, 0, bones, 'n')], [(0, 0, bucket, 'n'), (1, 1, rub2, 'n')],
               [(0, 0, barrel, 'b'), (1, 0, crate, 'b')], [(0, 0, bed, 'n'), (1, 0, bones2, 'n')]],
    'cell': [[(0, 0, rub, 'n'), (1, 0, bones2, 'n')]],
}
n_fill = dfill.autofill(m, TH, RES, seed=4, lim=.40)
print('fill clusters', n_fill)

if BAD: print('앞면 아닌 장식 칸', BAD); sys.exit(1)
dcheck.reg_materials(m)
ENT = (27, 38); FIN = (45, 9)
wps = {'입구 계단실': ENT, '간수 복도': (23, 32), '감방동 홀': (20, 27), '간수 자리': (21, 21), '벽감 복도': (22, 17),
       '벽감 회랑': (22, 10), '뼈의 방 복도': (33, 9), '뼈의 방': (40, 9), '제단 앞': FIN,
       '고문실': (40, 24), '납골당': (44, 37), '간수 대기실': (8, 37)}
emp = dcheck.emptiness(m)
data = m.export(OUTD, ENT, FIN, wps, extra=dict(emptiness=emp))
lines = dump_parts(OUTD)
dcheck.write_parts_md(OUTD, lines, '성 지하 감옥·카타콤')
print('path', data['path_len'], 'reach', data['reachable'], 'comps', data['walk_components'], data['component_sizes'])
print('wp', {k: v['reach'] for k, v in data['waypoints'].items()})
print('empty', emp); print('parts', len(lines))
