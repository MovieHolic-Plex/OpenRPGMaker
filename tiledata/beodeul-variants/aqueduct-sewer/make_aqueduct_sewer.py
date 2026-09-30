# 버들항 변형 3-① 지하 수도교·하수도. 다시 돌리면 같은 그림이 나온다.
#   python3 make_aqueduct_sewer.py   (이 폴더에 render-1x/2x.png, grid.json, parts/, parts.md 를 쓴다)
import os, sys
OUTD = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(OUTD, '..', '_lib3'))
from dlib import *
import dprops as D
import dcheck

W_, H_ = 60, 44
m = Map(W_, H_, 'aqueduct-sewer'); m.ceil_seed = 11

def B(img): return [(dx, 0) for dx in range(img.width // T)]
def BB(img): return [(dx, -dy) for dx in range(img.width // T) for dy in range(img.height // T)]
OCC = set()
N0 = None
MOVED = []
def _land(x, y):
    return m.inb(x, y) and m.fl[y][x] is not None and m.wa[y][x] is None and not m.br[y][x]
def _fits(x, y, w, h, rows):
    for dy in range(rows):
        for dx in range(w):
            if not _land(x + dx, y - dy) or (x + dx, y - dy) in OCC: return False
    return True
def put(x, y, img, block='bottom', layer=1):
    blk = B(img) if block == 'bottom' else (BB(img) if block == 'all' else block)
    w, h = img.width // T, img.height // T
    rows = h if block == 'all' else 1
    if not _fits(x, y, w, h, rows) and block != []:
        best = None
        for r in range(1, 4):
            for dy in range(-r, r + 1):
                for dx in range(-r, r + 1):
                    if max(abs(dx), abs(dy)) != r: continue
                    if _fits(x + dx, y + dy, w, h, rows):
                        d = dx * dx + dy * dy
                        if best is None or d < best[0]: best = (d, x + dx, y + dy)
            if best: break
        if best: MOVED.append(((x, y), (best[1], best[2]))); x, y = best[1], best[2]
        else: MOVED.append(((x, y), None)); return
    if block != []:
        for dy in range(rows):
            for dx in range(w): OCC.add((x + dx, y - dy))
    global N0
    if N0 is None: N0 = len(m.components())
    before_blk = set(m.blocked); n_before = len(m.props)
    m.props_add(x, y, img, blk, layer)
    if blk and len(m.components()) > N0:
        m.blocked = before_blk; del m.props[n_before:]
        for dy in range(rows):
            for dx in range(w): OCC.discard((x + dx, y - dy))
        MOVED.append(((x, y), 'sealed'))
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
# E 입구 홀, C 본수로 홀 ...
m.floor(3, 34, 9, 8, 'sewer', 3, 'sewer')                    # E
m.floor(6, 18, 44, 8, 'sewer', 3, 'sewer')                  # C (물은 아래서 덮는다)
m.water(2, 20, 50, 4, 'sew')                                 # 물길: 양끝은 어둠 속으로
m.floor(8, 5, 14, 8, 'sewer', 3, 'sewer')                    # V
m.floor(26, 5, 19, 8, 'sewer', 3, 'sewer')                   # CI
m.water(30, 7, 11, 4, 'sew')
m.floor(18, 34, 13, 8, 'plank', 3, 'sewer')                  # S
m.floor(36, 34, 13, 8, 'sewer', 3, 'sewer')                  # W
m.water(39, 34, 4, 4, 'sew'); m.water(37, 38, 8, 3, 'sew')
m.floor(52, 18, 6, 8, 'cata', 2, 'cata')                    # CA
m.floor(48, 5, 10, 10, 'darkcata', 3, 'cata')                # AR
m.floor(52, 36, 6, 6, 'bone', 3, 'cata')                     # R
# 복도 (폭 2)
for (x0, y0, w, h) in [(14, 13, 2, 5), (35, 13, 2, 5), (8, 26, 2, 8), (24, 26, 2, 8), (44, 26, 2, 8),
                        (12, 36, 6, 2), (31, 37, 5, 2), (49, 37, 3, 2), (50, 18, 2, 2)]:
    m.floor(x0, y0, w, h, 'sewer', 2, 'sewer')
# 섬 (밸브 대) 와 다리
m.floor(26, 21, 4, 2, 'sewer')
for y in range(20, 24):
    for x in (15, 16, 38, 39): m.br[y][x] = True
for (x, y) in ((27, 20), (27, 23)): m.br[y][x] = True
for x in range(30, 41): m.br[8][x] = True                    # 저수조 긴 다리
for y in range(34, 38):
    pass
for x in range(39, 43): m.br[36][x] = True                   # 수문실 짧은 다리

# 모서리를 계단식으로 깎아 네모를 깬다 (k=3 이면 3,2,1 칸)
def chamfer(x0, y0, w, h, k=3, which='NW NE SW SE'):
    for c in which.split():
        for i in range(k):
            n = k - i
            xs = x0 if 'W' in c else x0 + w - n
            ys = y0 + i if 'N' in c else y0 + h - 1 - i
            m.cut(xs, ys, n, 1)
chamfer(3, 34, 9, 8, 3, 'SW SE NW')                           # E (북동은 복도가 닿는다)
chamfer(8, 5, 14, 8, 3, 'NW NE SW')                          # V
chamfer(26, 5, 19, 8, 3)                                     # CI
chamfer(18, 34, 13, 8, 3, 'NW SW SE')                        # S
chamfer(36, 34, 13, 8, 3, 'NE SE SW')                        # W
chamfer(48, 5, 10, 10, 3)                                    # AR
chamfer(52, 36, 6, 6, 2, 'SW SE NE')                         # R
chamfer(52, 18, 6, 8, 2, 'NE SE SW')                         # CA

# 비밀문 통로: 표시는 벽, 통행은 가능
SECRET = [(54, 15), (54, 16), (54, 17)]
for c in SECRET: m.hidden.add(c)

# ---------------------------------------------------------------- 다리 그림
bns = reg('bridge_ns_stone', D.bridge_tile('ns', 'stone'), '돌다리 남북 방향 한 칸 (양 난간)')
bew = reg('bridge_ew_stone', D.bridge_tile('ew', 'stone'), '돌다리 동서 방향 한 칸 (위아래 난간)')
for y in range(20, 24):
    for x in (15, 16, 38, 39, 27):
        if m.br[y][x]: m.decal(x, y, bns)
m.decal(27, 20, bns); m.decal(27, 23, bns)
for x in range(30, 41): m.decal(x, 8, bew)
for x in range(39, 43): m.decal(x, 36, bew)

# ---------------------------------------------------------------- 앞면 위 장식 (decal)
torch = reg('torch_wall', D.torch_wall(), '벽 횃불 (앞면에 붙는 쇠걸이 + 불꽃)')
archD = reg('arch_dark', D.arch_opening(2, 2, 'dark'), '벽 아치 — 어둠 (돌 쐐기 테두리)', (2, 2))
archW = reg('arch_water', D.arch_opening(2, 2, 'water'), '벽 아치 — 수로 출구 (물이 쏟아진다)', (2, 2))
archB = reg('arch_bars', D.arch_opening(2, 2, 'bars'), '벽 아치 — 쇠창살', (2, 2))
pipe = reg('pipe_copper', D.pipe_h(), '벽 앞면을 가로지르는 구리 관 한 칸')
pipeE = reg('pipe_copper_elbow', D.pipe_h('down'), '구리 관 — 오른쪽에서 꺾여 바닥으로 내려가는 곳')
pipeL = reg('pipe_copper_leak', D.pipe_h(leak=True), '구리 관 — 새는 이음매 (물방울)')
stairs = reg('stairs_up_face', D.stairs_up_face(1), '벽 앞면에서 올라가는 계단 (대로로) 1×2', (1, 2))
sdoor = reg('secret_door', D.secret_door(1, 2), '비밀문 — 이음매 한 줄과 닳은 돌 (앞면 위)', (1, 2))
banner = reg('banner_cult', D.banner_cult(), '교단 깃발 (어두운 자주 천, 눈 문양)', (1, 2))
chain = reg('chains', D.chains(), '벽에 걸린 사슬·수갑')

def deco(img, x, y, w=None, h=None):
    m.compute_faces()
    iw, ih = img.width // T, img.height // T
    def ok(xx): return all((xx + i, y + j) in m.face for i in range(iw) for j in range(ih))
    if not ok(x):
        for r in range(1, 7):
            cand = [xx for xx in (x - r, x + r) if ok(xx) and xx not in DECX.get(y, ())]
            if cand: x = cand[0]; break
    DECX.setdefault(y, set()).update(range(x, x + iw))
    face_ok(x, y, iw, ih)
    m.decal(x, y, img)
DECX = {}

# E 입구
deco(stairs, 7, 32)
deco(torch, 5, 32); deco(torch, 10, 32)
# C 본수로 북벽 (앞면 y15-17)
for x in (9, 17, 24, 34, 41, 47): deco(torch, x, 16)
deco(archW, 30, 16); deco(archB, 12, 16); deco(archD, 20, 16); deco(archD, 44, 16)
deco(chain, 27, 16)
# V 밸브실 북벽 (y2-4)
for x in (9, 20): deco(torch, x, 3)
for x in range(10, 18): deco(pipe, x, 4)
deco(pipeE, 18, 4)
# CI 저수조 북벽 (y2-4)
for x in (28, 32, 36, 40): deco(archD, x, 3)
for x in (27, 43): deco(torch, x, 3)
# S 창고 북벽 (y31-33)
deco(torch, 20, 32); deco(torch, 28, 32)
# W 수문실
deco(archW, 40, 32); deco(torch, 37, 32); deco(torch, 47, 32)
# CA 교단 전실 북벽 (y16-17): 비밀문 = (54,16)-(54,17)
for x in (52, 57): deco(banner, x, 16)
deco(sdoor, 54, 16)
# AR 제단 북벽 (y2-4)
for x in (49, 52, 55): deco(banner, x, 3)
for x in (50, 54): deco(torch, x, 3)
# R
deco(torch, 54, 33)

# ---------------------------------------------------------------- 바닥 소품
brz = reg('brazier', D.brazier(), '화로 (쇠 삼발이 + 숯불)')
wheel = reg('valve_wheel', D.valve_wheel(), '바닥에서 솟은 배관 + 밸브 바퀴 (1×2)', (1, 2))
mani = reg('manifold_3', D.manifold(3), '방을 가로지르는 큰 구리 매니폴드 + 밸브 3×2', (3, 2))
col = reg('column_sewer', D.column(2, 'sewer'), '벽 앞에 선 돌 기둥 (1×2)', (1, 2))
colb = reg('column_sewer_broken', D.column(2, 'sewer', 1), '부러진 돌 기둥 그루터기 (1×2)', (1, 2))
rub = reg('rubble', D.rubble(0, 'sewer'), '무너진 돌 부스러기')
rub2 = D.rubble(5, 'sewer')
# 사용자가 rubble 조각을 BEFORE 로 골랐으면 같은 종류의 두 번째 돌무더기도 그 판(좌우만 뒤집어 변화)을 쓴다.
_rb = D.pick_before('aqueduct-sewer', rub)
if _rb is not rub: rub2 = _rb.transpose(Image.FLIP_LEFT_RIGHT)
barrel = reg('barrel', D.barrel(), '통')
crate = reg('crate', D.crate(), '나무 상자'); crate2 = reg('crate_stack', D.crate(2, 2), '쌓은 나무 상자', (1, 1))
bucket = reg('bucket', D.bucket(), '양동이')
bed = reg('straw_bed', D.straw_bed(), '짚 침상')
cand = reg('candles', D.candles(3), '촛불 세 자루')
cand1 = D.candles(1, 4)
bones = reg('bones', D.bones(1, 1), '흩어진 뼈')
skulls = reg('skulls', D.skulls(2, 3), '해골 무더기')
bheap = reg('bone_heap', D.bone_heap(), '뼈 더미 (2×1.5)', (2, 2))
grate = reg('grate_floor', D.grate_floor(), '바닥 쇠창살 (배수구)')
altar = reg('altar_cult', D.altar_cult(), '교단 제단 (검붉은 천, 눈 문양)', (2, 2))
coffin = reg('coffin', D.coffin(), '관 (2×1.5)', (2, 2))
fcol = reg('fallen_column', D.fallen_column(2, 'sewer'), '쓰러진 돌 기둥', (2, 1))
lamp = reg('lantern_post', D.lantern_post(), '등불 기둥')

# E 입구 홀 (3..11, 34..41)
put(4, 35, barrel); put(5, 35, barrel); put(4, 36, crate)
put(10, 35, brz); lit(10, 35)
put(9, 40, bucket); put(10, 40, rub); put(3, 40, crate2)
m.decal(7, 39, grate)
# C 본수로 홀
for x in (10, 21, 33, 46): put(x, 18, col, [(0, 0)])
put(13, 19, rub); put(14, 19, rub2, [])
put(9, 24, barrel); put(10, 24, barrel); put(9, 25, crate); put(41, 25, crate2); put(42, 25, barrel)
put(18, 19, colb, [(0, 0)]); put(19, 19, rub, [])
put(18, 25, bones); put(19, 24, skulls)
put(28, 21, wheel, [(0, 0)]); put(26, 22, brz); lit(26, 22)
m.decal(37, 19, grate); m.decal(36, 25, grate); m.decal(12, 25, grate)
put(47, 25, fcol, [(0, 0), (1, 0)]); put(48, 19, bucket)
put(44, 24, bones)
# V 밸브실 (8..21, 5..12)
put(11, 9, mani, BB(mani))
put(9, 8, wheel, [(0, 0)]); put(19, 8, wheel, [(0, 0)]); put(16, 11, wheel, [(0, 0)])
put(10, 12, barrel); put(11, 12, barrel); put(9, 12, crate)
put(20, 11, brz); lit(20, 11)
put(13, 6, bucket, [(0, 0)]); put(20, 6, rub)
m.decal(18, 9, grate); m.decal(14, 11, grate); m.decal(15, 11, grate)
# CI 저수조 (26..44, 5..12)
for (x, y) in ((28, 7), (42, 7), (28, 11), (42, 11)): put(x, y, col, [(0, 0)])
put(26, 11, rub); put(44, 6, rub2, []); put(35, 6, brz); lit(35, 6)
put(35, 12, bones); put(27, 6, bucket)
m.decal(29, 10, grate); m.decal(41, 9, grate)
# S 창고 (18..30, 34..41)
put(19, 36, barrel); put(20, 36, barrel); put(19, 37, barrel); put(21, 35, crate2)
put(22, 35, crate); put(28, 36, crate2); put(29, 36, crate); put(29, 37, crate)
put(28, 40, bed); put(29, 40, cand1); put(24, 40, barrel)
put(19, 40, crate); put(20, 40, crate2); put(20, 41, barrel)
put(25, 38, bucket)
# W 수문실 (36..48, 34..41)
put(37, 35, rub); put(46, 35, barrel); put(47, 35, barrel); put(47, 36, crate)
put(46, 40, bones); put(45, 41, skulls); put(36, 41, rub2, [])
put(36, 36, lamp, [(0, 0)]); put(47, 40, colb, [(0, 0)])
# CA 教壇 전실 (52..57, 18..27)
put(53, 19, brz); lit(53, 19); put(56, 19, brz); lit(56, 19)
put(53, 24, cand); put(56, 23, cand); put(54, 21, cand1, [])
put(52, 25, skulls); put(57, 25, bones); put(55, 24, bucket)
m.decal(54, 23, grate)
# AR 숨은 제단 (48..57, 5..14)
put(52, 8, altar, [(0, 0), (1, 0), (0, -1), (1, -1)])
put(51, 9, cand); put(54, 9, cand); put(49, 7, brz); lit(49, 7); put(56, 7, brz); lit(56, 7)
put(50, 13, skulls); put(56, 12, bones); put(52, 13, cand); put(53, 12, cand1, [])
put(49, 11, coffin, [(0, 0), (1, 0)])
# R 폐기 구덩이
put(52, 38, bheap, [(0, 0), (1, 0)]); put(56, 40, skulls); put(54, 41, bones); put(57, 37, bones)
m.decal(55, 38, grate); m.decal(53, 40, grate)


# ---- 2차: 빈 바닥 줄이기 (덩어리로)
put(50, 9, col, [(0, 0)]); put(55, 9, col, [(0, 0)]); put(50, 12, col, [(0, 0)]); put(55, 12, col, [(0, 0)])
put(56, 6, coffin, [(0, 0), (1, 0)]); put(56, 10, coffin, [(0, 0), (1, 0)])
put(48, 14, skulls); put(56, 14, skulls)
put(49, 5, cand1, []); put(57, 5, cand1, []); put(51, 6, cand); put(54, 6, cand)
put(57, 12, cand1); put(53, 10, cand1, [])
put(27, 8, brz); lit(27, 8); put(27, 9, barrel);
put(43, 9, crate2); put(44, 9, barrel); put(43, 10, crate); put(44, 11, rub2, []); put(42, 6, barrel)
put(31, 12, crate2); put(32, 12, barrel); put(38, 12, skulls); put(39, 11, bones)
put(31, 5, rub2, []); put(39, 5, bucket)
put(7, 18, barrel); put(8, 18, crate)
put(30, 19, crate2); put(31, 19, barrel); put(30, 18, barrel)
put(42, 18, crate2); put(43, 19, rub, []); put(25, 18, barrel)
put(53, 22, coffin, [(0, 0), (1, 0)]); put(56, 21, cand); put(52, 23, cand1, [])

put(14, 24, barrel); put(15, 24, crate2); put(14, 25, barrel, []) ; put(30, 24, crate); put(31, 24, barrel); put(31, 25, bones, [])
put(22, 25, rub2, []); put(34, 25, skulls, [])
put(10, 37, barrel); put(11, 37, crate); put(3, 37, crate); put(8, 40, bones, []); put(6, 41, cand1)
put(5, 38, col, [(0, 0)]); put(11, 41, rub)
put(35, 39, barrel); put(6, 25, rub, []); put(7, 25, bones, []); put(12, 24, bucket); put(17, 24, cand1, []); put(21, 24, barrel); put(22, 24, crate); put(34, 39, crate2)
put(9, 6, crate2); put(10, 6, barrel); put(9, 7, barrel); put(18, 9, rub2, []); put(19, 9, bones, []); put(17, 11, barrel); put(18, 11, crate)
put(8, 10, bucket); put(15, 9, cand1, []); put(21, 8, crate2); put(21, 9, barrel)
put(9, 24, crate); put(10, 24, barrel); put(19, 25, bones, []); put(24, 24, crate2); put(25, 25, rub2, [])
put(8, 36, crate2); put(9, 36, barrel); put(4, 40, barrel); put(9, 40, crate); put(4, 35, rub2, []); put(24, 36, barrel); put(25, 36, crate)
put(9, 29, bones, []); put(8, 31, rub2, []); put(12, 26, cand1, [])
put(26, 39, crate2); put(27, 39, barrel); put(22, 40, rub2, []); put(23, 41, bones, [])

print('moved', len(MOVED))
if BAD: print('앞면 아닌 장식 칸', BAD); sys.exit(1)
# 방 사이 빈 어둠(가림 천장) 5줄 중 3줄을 들어낸다 -> 2줄 남김
CUT_A, CUT_B = 27, 30
m.delete_rows(CUT_A, CUT_B)
def sh(p): return (p[0], p[1] - (CUT_B - CUT_A)) if p[1] >= CUT_B else p
# ---------------------------------------------------------------- 부품 표본 + 내보내기
dcheck.reg_materials(m)
for name, kind, r in (('mosaic', None, None),):
    pass
ENT = sh((7, 35)); FIN = sh((52, 10))
wps0 = {'입구 홀': (7, 35), '본수로 남 보도': (20, 25), '동쪽 다리 남끝': (38, 24), '동쪽 다리 북끝': (38, 19),
       '교단 전실': (54, 20), '제단': (53, 11), '밸브실': (14, 8), '저수조': (35, 5), '창고': (24, 39),
       '수문실': (46, 38), '폐기 구덩이': (55, 40), '섬(밸브 대)': (27, 22)}
wps = {k: sh(v) for k, v in wps0.items()}
emp = dcheck.emptiness(m)
data = m.export(OUTD, ENT, FIN, wps, extra=dict(emptiness=emp, secret_door_cells=[list(c) for c in SECRET]))
lines = dump_parts(OUTD)
dcheck.write_parts_md(OUTD, lines, '지하 수도교·하수도')
print('path', data['path_len'], 'reach', data['reachable'], 'w/o hidden', data['reachable_without_hidden'], 'comps', data['walk_components'], data['component_sizes'])
print('wp', {k: v['reach'] for k, v in data['waypoints'].items()})
print('empty', emp); print('parts', len(lines))
