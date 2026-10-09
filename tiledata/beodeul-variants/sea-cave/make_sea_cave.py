# 버들항 변형 3-③ 바다 동굴. 다시 돌리면 같은 그림이 나온다.
#   python3 make_sea_cave.py   (이 폴더에 render-1x/2x.png, grid.json, parts/, parts.md 를 쓴다)
import os, sys, math
OUTD = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(OUTD, '..', '_lib3'))
from dlib import *
import dprops as D
import dcheck, dfill

W_, H_ = 56, 42
m = Map(W_, H_, 'sea-cave'); m.ceil_seed = 31; m.cave = True

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
GC = D.glow(48, (80, 240, 210), 50)
def lit(cx, cy): m.glow_at(cx + .5, cy + .5, GL)
def litc(cx, cy): m.glow_at(cx + .5, cy + .5, GC)

# ---------------------------------------------------------------- 방과 복도
F = 'cave'
m.set_style(0, 0, W_, H_, 3, 'cave')
m.floor(3, 5, 15, 12, 'cave', 3, F)                          # MC 이끼방
m.floor(18, 9, 2, 2, 'cave', 2, F)
m.floor(20, 6, 17, 9, 'cave', 3, F)                          # PH 기둥 홀
m.floor(37, 8, 5, 2, 'cave', 2, F)
m.floor(42, 4, 12, 10, 'cave', 3, F)                         # SC 은닉처
m.floor(28, 15, 2, 4, 'wetsand', 2, F)
m.floor(22, 19, 26, 9, 'wetsand', 3, F)                      # TG 조간대 동굴
m.floor(42, 28, 2, 4, 'wetsand', 2, F)
m.floor(34, 32, 20, 9, 'sand', 3, F)                         # BE 해변
m.floor(9, 17, 2, 6, 'cave', 2, F)
m.floor(2, 23, 16, 11, 'cave', 3, F)                         # DK 밀수 부두
m.floor(18, 26, 4, 2, 'cave', 2, F)
m.water(0, 34, 34, 8, 'sea')                                 # SEA 바다 (맵 가장자리로)
# 바다 쪽 해변: 젖은 모래 띠
for y in range(32, 41):
    for x in (34, 35): m.fl[y][x] = 'wetsand'
for x in range(34, 54): m.fl[40][x] = 'wetsand' if x < 44 else 'sand'
for x in range(36, 46): m.fl[39][x] = 'wetsand' if x < 39 else m.fl[39][x]

# 동굴 가장자리 울퉁불퉁하게: 남쪽 벽·모서리 기둥을 아래에서부터 갉아낸다 (북쪽 앞면은 건드리지 않는다)
def bite(x, y0, y1):
    for y in range(y0, y1 + 1): m.fl[y][x] = None; m.wa[y][x] = None
for x, n in ((3, 3), (4, 2), (5, 1), (7, 1), (8, 1), (12, 1), (13, 1), (15, 1), (16, 2), (17, 3)): bite(x, 17 - n, 16)
for x, n in ((20, 3), (21, 2), (22, 1), (25, 1), (26, 1), (33, 1), (34, 2), (35, 3), (36, 3), (31, 1)): bite(x, 15 - n, 14)
for x, n in ((42, 3), (43, 2), (44, 1), (47, 1), (48, 1), (51, 1), (52, 2), (53, 3)): bite(x, 14 - n, 13)
for x, n in ((22, 3), (23, 2), (24, 1), (27, 1), (31, 1), (32, 1), (36, 1), (37, 1), (46, 2), (47, 3)): bite(x, 28 - n, 27)

# 얼룩: 동굴 바닥·모래 섞기
def blob(cx, cy, rx, ry, kind, only):
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            if m.inb(x, y) and m.fl[y][x] in only and ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 + (hash((x, y)) % 5 - 2) * .04:
                m.fl[y][x] = kind
for (cx, cy, rx, ry) in ((44, 36, 6, 2.2), (50, 34, 3, 1.5)): blob(cx, cy, rx, ry, 'sand', ('sand', 'wetsand'))
for (cx, cy, rx, ry) in ((26, 22, 3, 1.5), (40, 25, 4, 1.6), (33, 20, 3, 1.2)): blob(cx, cy, rx, ry, 'cave', ('wetsand',))
for (cx, cy, rx, ry) in ((8, 8, 3, 2), (13, 13, 3, 1.6)): blob(cx, cy, rx, ry, 'wetsand', ('cave',))
for (cx, cy, rx, ry) in ((28, 11, 4, 2),): blob(cx, cy, rx, ry, 'wetsand', ('cave',))

# 조수 웅덩이 (조간대) — 둘레는 젖은 모래
for (x0, y0, w, h) in ((25, 21, 3, 2), (32, 24, 3, 2), (39, 20, 3, 2), (43, 24, 2, 2)):
    for y in range(y0 - 1, y0 + h + 1):
        for x in range(x0 - 1, x0 + w + 1):
            if m.inb(x, y) and m.fl[y][x] in ('cave', 'sand'): m.fl[y][x] = 'wetsand'
    m.water(x0, y0, w, h, 'tide')
# 기둥 홀 가운데 웅덩이, 이끼방 작은 웅덩이
m.water(26, 9, 6, 3, 'tide')
for y in range(8, 13):
    for x in range(25, 33):
        if m.inb(x, y) and m.fl[y][x] == 'cave': m.fl[y][x] = 'wetsand'
m.water(7, 9, 3, 2, 'tide')
for y in range(8, 12):
    for x in range(6, 11):
        if m.inb(x, y) and m.fl[y][x] == 'cave': m.fl[y][x] = 'wetsand'
# 부두 바다 쪽: 널판 잔교 (걸을 수 있다)
for x in range(6, 12):
    for y in range(29, 34): m.fl[y][x] = 'plank'
for x in (9, 10):
    for y in range(34, 39): m.wa[y][x] = None; m.fl[y][x] = 'plank'
for x in range(2, 6): m.fl[33][x] = 'wetsand'
for x in range(12, 18): m.fl[33][x] = 'wetsand'

# ---------------------------------------------------------------- 그림 등록
moss = reg('glow_moss_floor', D.glow_moss('floor', 0), '발광 이끼 — 바닥 얼룩')
moss2 = D.glow_moss('floor', 3); moss3 = D.glow_moss('wall', 5)
mush = reg('glow_mushroom', D.glow_mushroom(), '발광 버섯')
stg = reg('stalagmite_1', D.stalagmite(1), '석순 (1×1.5)', (1, 2)); stg2 = D.stalagmite(1, 4); stg3 = D.stalagmite(1, 7)
rp = reg('rock_pillar_2', D.rock_pillar(2), '바위 기둥 (천장까지 이어진 2칸 높이)', (1, 2)); rp2 = D.rock_pillar(2, 5)
dw = reg('driftwood', D.driftwood(), '유목 (2×1)', (2, 1)); dw2 = D.driftwood(3)
dp = reg('dock_post', D.dock_post(), '부두 말뚝'); dp2 = D.dock_post(2)
boat = reg('boat', D.boat(), '작은 배 (2×1.5)', (2, 2))
net = reg('fish_net', D.fish_net(), '말리는 그물')
lamp = reg('lantern_post', D.lantern_post(), '등불 기둥')
crate = reg('crate', D.crate(), '나무 상자'); crate2 = D.crate(3, 2)
barrel = reg('barrel', D.barrel(), '통'); barrel2 = D.barrel(4)
rub = reg('rubble_cave', D.rubble(0, 'sewer'), '바위 부스러기'); rub2 = D.rubble(5, 'sewer'); rub3 = D.rubble(9, 'sewer')
bones = reg('bones', D.bones(1, 1), '흩어진 뼈')
torch = reg('torch_wall', D.torch_wall(), '벽 횃불')
vine = reg('vines_2', D.vines(2, 2), '늘어진 덩굴 (1×2)', (1, 2))
chain = reg('chains', D.chains(), '벽 쇠사슬')
arch = reg('arch_dark', D.arch_opening(2, 2, 'dark'), '동굴 안쪽으로 이어지는 어두운 구멍 (2×2)', (2, 2))
bkt = reg('bucket', D.bucket(), '양동이')

# ---------------------------------------------------------------- 벽 앞면 장식
# 이끼방 MC 북벽 y2-4
for x in (4, 6, 9, 12, 15): deco(moss3, x, 3)
for x in (5, 10, 13): deco(moss3, x, 4)
deco(vine, 8, 3); deco(vine, 16, 3)
# 기둥 홀 PH 북벽 y3-5
for x in (22, 25, 30, 34): deco(moss3, x, 4)
deco(arch, 27, 4); deco(torch, 21, 4); deco(torch, 35, 4)
# 은닉처 SC 북벽 y1-3
for x in (44, 47, 51): deco(torch, x, 2)
deco(chain, 45, 3); deco(chain, 49, 3); deco(moss3, 52, 3)
# 조간대 TG 북벽 y16-18
for x in (24, 26, 36, 40, 45): deco(moss3, x, 17)
deco(moss3, 33, 18); deco(vine, 22, 17); deco(vine, 43, 17)
# 해변 BE 북벽 y29-31
for x in (36, 38, 46, 49, 52): deco(moss3, x, 30)
deco(vine, 47, 30); deco(vine, 37, 30); deco(torch, 45, 30)
# 부두 DK 북벽 y20-22
for x in (3, 5, 13, 15): deco(moss3, x, 21)
deco(torch, 4, 21); deco(torch, 14, 21); deco(chain, 6, 22); deco(chain, 12, 22)
# 바다 위 북벽 y31-33
for x in (19, 22, 26, 30): deco(moss3, x, 32)
deco(vine, 24, 32); deco(vine, 28, 32)

# ---------------------------------------------------------------- 소품
# MC 이끼방: 이끼 무리와 버섯 (발광)
for (x, y) in ((4, 8), (5, 8), (4, 9), (13, 6), (14, 6), (14, 7), (5, 14), (6, 14), (14, 13), (15, 13), (15, 14), (11, 15), (12, 5)):
    m.decal(x, y, moss if (x + y) % 2 else moss2)
put(6, 7, mush, []); put(5, 9, mush, []); put(14, 8, mush, []); put(15, 6, mush, []); put(13, 14, mush, []); put(6, 15, mush, [])
put(4, 6, stg, [(0, 0)]); put(16, 7, stg2, [(0, 0)]); put(4, 13, stg3, [(0, 0)]); put(16, 14, stg, [(0, 0)]); put(11, 8, stg2, [(0, 0)])
put(9, 14, rub, []); put(12, 12, rub2, [])
for (x, y) in ((6, 8), (14, 7), (6, 14), (14, 13)): litc(x, y)
# PH 기둥 홀
for (x, y, im) in ((22, 8, rp), (23, 13, rp2), (34, 7, rp2), (34, 13, rp), (26, 13, rp), (31, 13, rp2), (30, 7, rp), (24, 7, rp2)):
    put(x, y, im, [(0, 0)])
put(21, 12, mush, []); put(35, 11, mush, []); put(24, 10, stg2, [(0, 0)]); put(33, 10, stg, [(0, 0)])
put(27, 8, rub2, []); put(30, 12, rub3, []); put(22, 14, bones, [])
litc(21, 12); litc(35, 11)
# SC 은닉처 (최종 47,8)
put(43, 6, crate2, [(0, 0)]); put(44, 6, crate, [(0, 0)]); put(43, 7, barrel, [(0, 0)]); put(52, 6, barrel2, [(0, 0)]); put(52, 7, barrel, [(0, 0)]); put(51, 6, crate, [(0, 0)])
put(43, 12, crate, [(0, 0)]); put(44, 12, crate2, [(0, 0)]); put(52, 12, barrel, [(0, 0)]); put(46, 6, lamp, [(0, 0)]); lit(46, 6)
put(50, 6, lamp, [(0, 0)]); lit(50, 6)
put(47, 7, crate2, [(0, 0)]); put(48, 7, crate, [(0, 0)]); put(46, 10, bkt, [])
put(50, 11, net, []); put(44, 10, bones, [])
# TG 조간대: 버섯·유목·석순
put(24, 20, mush, []); put(37, 21, mush, []); put(46, 21, mush, []); put(28, 25, mush, []); put(44, 26, mush, [])
put(23, 24, stg, [(0, 0)]); put(37, 26, stg3, [(0, 0)]); put(46, 19, stg2, [(0, 0)]); put(29, 21, stg, [(0, 0)])
put(34, 20, dw, [(0, 0), (1, 0)]); put(24, 26, dw2, [(0, 0), (1, 0)]); put(39, 26, rub, []); put(31, 26, rub2, [])
litc(24, 20); litc(37, 21); litc(46, 21)
# BE 해변
put(46, 37, boat, [(0, 0), (1, 0)]); put(41, 34, dw, [(0, 0), (1, 0)]); put(52, 38, dw2, [(0, 0), (1, 0)])
put(37, 34, dp, [(0, 0)]); put(37, 38, dp2, [(0, 0)]); put(38, 36, net, []); put(50, 34, rub3, []); put(44, 39, rub, []); put(51, 34, stg2, [(0, 0)])
put(35, 39, stg, [(0, 0)]); put(53, 36, stg3, [(0, 0)]); put(42, 35, bones, [])
# DK 부두
for (x, y) in ((8, 34), (11, 34), (8, 37), (11, 36)): put(x, y, dp if (x + y) % 2 else dp2, [])
put(11, 38, boat, []); put(3, 25, crate2, [(0, 0)]); put(4, 25, barrel, [(0, 0)]); put(16, 25, barrel2, [(0, 0)]); put(15, 25, crate, [(0, 0)])
put(3, 30, net, []); put(13, 30, net, []); put(4, 31, crate, [(0, 0)]); put(14, 31, barrel, [(0, 0)])
put(7, 26, lamp, [(0, 0)]); lit(7, 26); put(12, 26, lamp, [(0, 0)]); lit(12, 26)
put(3, 28, rub, []); put(16, 29, rub2, []); put(14, 28, bkt, [])

# ---------------------------------------------------------------- 빈 바닥 자동 채움 (덩이 소품)
RES = set()
def res(x0, y0, w, h):
    for yy in range(y0, y0 + h):
        for xx in range(x0, x0 + w): RES.add((xx, yy))
res(18, 9, 4, 2); res(35, 8, 8, 2); res(28, 13, 3, 7); res(42, 26, 3, 7); res(18, 26, 5, 2); res(9, 15, 3, 9)
res(6, 29, 6, 6); res(46, 7, 4, 3); res(48, 37, 5, 3)
TH = {
    'cave': [[(0, 0, rub, 'n'), (1, 0, rub2, 'n'), (0, 1, bones, 'n')],
             [(0, 0, stg2, 'b'), (1, 0, rub3, 'n'), (-1, 0, rub, 'n')],
             [(0, 0, mush, 'n'), (1, 0, rub2, 'n'), (0, 1, moss, 'n')],
             [(0, 0, stg3, 'b'), (1, 1, mush, 'n'), (2, 1, rub, 'n')]],
    'wetsand': [[(0, 0, rub2, 'n'), (1, 0, mush, 'n'), (0, 1, bones, 'n')],
                [(0, 0, stg, 'b'), (1, 0, rub3, 'n')],
                [(0, 0, dw, 'n'), (0, 1, rub, 'n'), (2, 1, mush, 'n')]],
    'sand': [[(0, 0, rub, 'n'), (1, 0, rub2, 'n'), (0, 1, bones, 'n')],
             [(0, 0, stg, 'b'), (1, 0, rub3, 'n')],
             [(0, 0, dw, 'n'), (0, 1, rub3, 'n'), (2, 1, bones, 'n')],
             [(0, 0, rub3, 'n'), (2, 0, bones, 'n'), (1, 1, rub, 'n')]],
    'plank': [[(0, 0, crate, 'b'), (1, 0, barrel, 'b')]],
}
n_fill = dfill.autofill(m, TH, RES, seed=3, lim=.40)
print('fill clusters', n_fill)

if BAD: print('앞면 아닌 장식 칸', BAD); sys.exit(1)
dcheck.reg_materials(m)
ENT = (50, 38); FIN = (47, 8)
wps = {'해변': ENT, '해변 복도': (42, 30), '조간대 동굴': (34, 23), '기둥 홀 복도': (28, 16), '기둥 홀': (24, 11),
       '은닉처 복도': (39, 8), '밀수 통로': (20, 27), '밀수 부두': (9, 30), '잔교 끝': (9, 38), '이끼방 복도': (9, 19), '이끼방': (10, 6), '밀수 은닉처': FIN}
emp = dcheck.emptiness(m)
data = m.export(OUTD, ENT, FIN, wps, extra=dict(emptiness=emp))
lines = dump_parts(OUTD)
dcheck.write_parts_md(OUTD, lines, '바다 동굴')
print('path', data['path_len'], 'reach', data['reachable'], 'comps', data['walk_components'], data['component_sizes'])
print('wp', {k: v['reach'] for k, v in data['waypoints'].items()})
print('empty', emp); print('parts', len(lines))
