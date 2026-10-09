# 미래 폐허 (future-ruins) — 72x52 JRPG 필드. 다시 돌리면 같은 그림이 나온다.   python3 make_future_ruins.py
# 동선: 서쪽 폐도로 입구 → 끊긴 고가 도로 밑 차 잔해 길 → 돔 광장(반쯤 무너진 유리 돔 · 주저앉은 거대 로봇) →
#       동쪽 강철판 마당 → 지하 공장 입구(벙커 셔터 · 내려가는 경사로).  곁: 남쪽 오염 웅덩이 황무지.
import sys, os, json, math, random
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import numpy as np
from PIL import Image
from fr_base import *
from fr_base import _hash
from fr_mat import TC, cable
from fr_scene import Scene
from fr_ground import sick_grass
import fr_props as P, fr_mech as M, fr_struct as S, fr_dome as DM

W, H = 72, 52
rng = random.Random(7203)
s = Scene(W, H, seed=72)
VAR = os.path.join(HERE, '..')


def reuse(path, sick=0.0):
    """다른 장소의 버들항 조각을 지도에만 다시 쓴다(내보내지 않는다). sick>0 이면 풀빛을 오염 풀로 옮긴다."""
    im = Image.open(os.path.join(VAR, path)).convert('RGBA')
    if sick:
        a = np.array(im); rgb = a[..., :3]
        g = (rgb[..., 1].astype(int) > rgb[..., 0].astype(int) + 8) & (rgb[..., 1].astype(int) > rgb[..., 2].astype(int))
        k = np.where(g, sick, 0.0)
        a[..., :3] = sick_grass(rgb, k)
        im = Image.fromarray(a, 'RGBA')
    return im


TG = [reuse('plains-highroad/parts/tallgrass_a.png', .85), reuse('plains-highroad/parts/tallgrass_b.png', .85), reuse('plains-highroad/parts/tallgrass_c.png', .85)]
DRY = [reuse('ruined-village/parts/drygrass_a.png'), reuse('ruined-village/parts/drygrass_b.png')]
DEADT = [reuse('ruined-village/parts/dead_tree_crooked.png'), reuse('plains-highroad/parts/dead_tree.png'), reuse('ruined-village/parts/dead_sapling.png')]
DBUSH = reuse('ruined-village/parts/dead_bush.png')
ROCKS = reuse('plains-highroad/parts/rocks_small.png')


def rect(name, x0, y0, x1, y1, v=True):
    s.m[name][y0:y1 + 1, x0:x1 + 1] = v


def blob(name, cx, cy, rx, ry, seed, rough=.35, v=True):
    """칸 단위 들쭉날쭉한 덩이."""
    for y in range(int(cy - ry - 2), int(cy + ry + 3)):
        for x in range(int(cx - rx - 2), int(cx + rx + 3)):
            if not (0 <= x < W and 0 <= y < H): continue
            d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + (vnoise(x, y, 2.2, seed) - .5) * rough * 2
            if d < 1:
                if name == 'tox': s.tox.add((x, y))
                elif name == 'crack': s.crack.add((x, y))
                elif name == 'rust': s.rust.add((x, y))
                else: s.m[name][y, x] = v


# ================================================================ 바닥
# 북쪽 건물 줄 앞 보도 · 서쪽 폐도로(아스팔트 폭 3, 가운데 차선) + 보도 · 남쪽 큰길(동서) + 보도
rect('conc', 0, 9, 26, 9); rect('conc', 47, 9, 71, 9)
rect('asph', 0, 20, 25, 22); rect('lane', 0, 21, 24, 21)
rect('conc', 0, 19, 25, 19); rect('conc', 0, 23, 25, 23)
rect('asph', 0, 40, 71, 42); rect('lane', 0, 41, 71, 41)
rect('conc', 0, 39, 71, 39); rect('conc', 0, 43, 71, 43)
for x in range(72):                                        # 남쪽 보도는 군데군데 풀에 먹혔다
    if vnoise(x, 39, 3, 81) > .7: s.m['conc'][39, x] = False
    if vnoise(x, 43, 3, 82) > .72: s.m['conc'][43, x] = False
# 가게 줄 뒤 주차장 터(아스팔트, 가장자리가 풀에 먹혔다)
blob('asph', 13.5, 33.2, 6.2, 2.6, 13, rough=.25)
# 돔 광장: 돔을 두른 고리 + 남쪽으로 넓어지는 마당(가장자리는 깨져 풀에 먹혔다)
blob('conc', 37, 11, 11.5, 6.5, 11, rough=.25)
blob('conc', 37, 25, 12.0, 9.0, 12, rough=.30)
rect('conc', 26, 19, 51, 23)
# 광장에서 남쪽 큰길로, 큰길에서 남쪽 끝으로 내려가는 갈라진 도로(세로 차선)
rect('asph', 35, 34, 37, 51); rect('lane_v', 36, 35, 36, 39); rect('lane_v', 36, 44, 36, 51)
# 광장 → 공장 마당(강철판)
rect('plate', 52, 22, 66, 30)
rect('conc', 53, 33, 63, 37)                               # 뒷마당 하역장(콘크리트 판)
for (x, y) in ((53, 33), (63, 33), (53, 37), (63, 37), (62, 37)): s.m['conc'][y, x] = False
for (x, y) in ((66, 30), (65, 30), (66, 29), (52, 30), (52, 29)): s.m['plate'][y, x] = False
# 오염(풀빛): 남쪽 · 공장 둘레가 짙다
for (x0, y0, x1, y1) in ((0, 30, 71, 51), (52, 10, 71, 38)): s.m['sick'][y0:y1 + 1, x0:x1 + 1] = 1.0
# 드러난 흙(덩이)
for (cx, cy, rx, ry, sd) in ((11, 28, 3, 2, 27), (20, 35, 2.5, 1.8, 28), (64, 12, 2.5, 1.6, 29), (10, 12, 3, 1.8, 30),
                            (4, 32, 2.6, 1.6, 31), (14, 37, 3, 1.4, 32), (57, 37, 2.6, 1.4, 33), (27, 37, 2.2, 1.4, 34)):
    blob('dirt', cx, cy, rx, ry, sd)
# 깨진 포장(덩이) — 길·광장·보도
for (cx, cy, rx, ry, sd) in ((8, 21, 1.6, 1.2, 31), (17, 20, 1.3, .9, 32), (31, 28, 1.6, 1.3, 33), (44, 33, 1.5, 1.2, 34), (40, 22, 1.4, .9, 35),
                            (48, 17, 1.3, 1.0, 36), (29, 12, 1.4, 1.0, 37), (24, 32, 1.4, 1.1, 40), (50, 25, 1.2, 1.4, 41), (2, 21, 1.4, 1.0, 42),
                            (12, 41, 1.6, 1.0, 43), (25, 40, 1.3, 1.0, 44), (49, 41, 1.6, 1.1, 45), (61, 42, 1.4, 1.0, 46), (36, 48, 1.2, 1.5, 47),
                            (68, 40, 1.2, 1.0, 48), (5, 9, 1.4, .8, 49), (55, 9, 1.4, .8, 50), (9, 33, 1.3, 1.0, 57), (17, 32, 1.2, .9, 58)):
    blob('crack', cx, cy, rx, ry, sd, rough=.5)
# 녹 번짐(강철판 위·잔해 곁)
for (cx, cy, rx, ry, sd) in ((56, 26, 1.6, 1.2, 51), (62, 28, 1.5, 1.2, 52), (58, 23, 1.2, .8, 53), (65, 25, 1.2, 1.4, 54), (27, 33, 1.5, 1.0, 55),
                            (61, 34, 1.4, 1.0, 56)):
    blob('rust', cx, cy, rx, ry, sd, rough=.5)
# 오염 웅덩이(막힘): 큰길 네거리가 꺼진 싱크홀 · 광장 둘 · 공장 뒷마당 · 서쪽 빈터
blob('tox', 36.2, 41.4, 3.4, 1.9, 61, rough=.3)
blob('tox', 33, 25, 1.3, .9, 62, rough=.2)
blob('tox', 47.5, 30.5, 1.4, 1.0, 63, rough=.2)
blob('tox', 65.6, 36.6, 2.4, 1.3, 64, rough=.3)
blob('tox', 7, 34, 2.0, 1.2, 65, rough=.3)
for c in list(s.tox): s.crack.discard(c)
for (x, y) in [(x, y) for (x, y) in s.tox if 32 <= x <= 40 and 38 <= y <= 45]:   # 싱크홀 둘레 = 깨진 포장
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
        c = (x + dx, y + dy)
        if c not in s.tox and 0 <= c[0] < W and 0 <= c[1] < H and (s.m['asph'][c[1], c[0]] or s.m['conc'][c[1], c[0]]): s.crack.add(c)

# ================================================================ 앵커
# ① 반쯤 무너진 유리 돔 (11x10, 밑줄 18)
dome = DM.dome()
DX, DY = 31, 18
s.at(dome, DX, DY, block=None, name='glass_dome')
top_px = (DY + 1) * 16 - dome.height
cyd = top_px + (dome.height - int(0.5 * 80) - 3)        # 받침 바닥 원 중심(화면 y)
for y in range(DY - 6, DY + 1):
    for x in range(DX, DX + 11):
        ccx = x * 16 + 8 - (DX * 16 + dome.width / 2.0); ccy = y * 16 + 8 - cyd
        if (ccx / 80.0) ** 2 + (ccy / 40.0) ** 2 <= 1.0 or (y == DY and DX + 4 <= x <= DX + 6): s.block[y, x] = True
s.walk_ok.add((DX + 5, DY)); s.marks['dome_door'] = (DX + 5, DY)
s.at(S.dome_rubble(), 42, 18, block='all', name='dome_rubble')
s.decal(P.glass_shards(1), 43, 19); s.decal(P.glass_shards(2), 41, 20); s.decal(P.glass_shards(3), 46, 17); s.decal(P.glass_shards(4), 44, 16)
# ② 주저앉은 거대 로봇 + 떨어진 팔 (광장 남서)
s.at(M.robot_hulk(), 25, 33, block='bottom', rows=2, name='robot_hulk')
s.at(M.robot_arm(), 30, 34, block='bottom', name='robot_arm')
s.marks['robot_hulk'] = (27, 34)
# ③ 끊긴 고가 도로 (북서) — 교각 + 상판 단면 + 무너진 틈의 떨어진 상판 + 홀로 남은 교각
s.at(S.overpass_span(), 0, 16, block=[(1, 0), (2, 0), (6, 0), (7, 0), (8, 0), (9, 0), (8, -1), (9, -1)], name='overpass_span')
s.at(S.deck_fallen(), 10, 18, block='all', name='deck_fallen')
s.at(P.rubble_conc(4), 12, 16, block='bottom', name='rubble_conc')
s.at(S.overpass_pier(), 14, 16, block=[(1, 0)], name='overpass_pier')
s.marks['overpass'] = (5, 18)
# ④ 지하 공장 입구 (동쪽 벙커, 밑줄 21) + 강철판 마당
gate = S.factory_gate()
GX, GY = 56, 21
s.at(gate, GX, GY, block=[(i, -j) for i in range(8) for j in range(4) if not (2 <= i <= 5 and j == 0)], name='factory_gate')
for i in range(2, 6): s.walk_ok.add((GX + i, GY))
s.marks['factory_door'] = (GX + 3, GY)
# ⑤ 전봇대·전선·깜빡이는 표지·경고등
def wires(a, b, sag):
    (ax, ay), (bx, by) = a, b
    x0 = ax * 16; y0 = (ay + 1) * 16 - 64; x1 = bx * 16; y1 = (by + 1) * 16 - 64
    w = abs(x1 - x0) + 40; h = 64 + sag + abs(y1 - y0)
    tc = TC(w, h)
    ox = min(x0, x1) - 8; oy = min(y0, y1) - 8
    for (dx0, sg) in ((4.5, sag), (15.5, sag + 4), (25.5, sag + 2)):
        cable(tc, x0 + dx0 - ox, y0 + 6 - oy, x1 + dx0 - ox, y1 + 6 - oy, sag=sg)
    s.topimg(tc.img(), ox, oy)
POLES = [(3, 19, 0.0, False), (12, 19, 0.0, False), (21, 19, 0.10, True), (50, 21, 0.0, False),
         (8, 39, 0.0, False), (17, 39, 0.0, False), (26, 39, -.12, True), (46, 39, 0.0, False), (55, 39, 0.0, False), (64, 39, 0.0, False)]
for i, (px_, py_, ln, br) in enumerate(POLES):
    s.at(P.power_pole(seed=i, lean=ln, broken=br), px_, py_, block=[(0, 0), (1, 0)] if ln else [(0, 0)], name='power_pole_broken' if br else 'power_pole')
for (a, b, sg) in (((3, 19), (12, 19), 14), ((8, 39), (17, 39), 13), ((46, 39), (55, 39), 15), ((55, 39), (64, 39), 12)):
    wires(a, b, sg)
s.at(P.sign_blink(True, 1), 23, 19, block=[(0, 0), (1, 0)], name='sign_blink_on')
s.at(P.sign_blink(False, 2), 39, 38, block=[(0, 0), (1, 0)], name='sign_blink_off')
s.at(P.signal_post(True, 1), 53, 22, name='signal_post_on')
s.at(P.signal_post(False, 2), 66, 21, name='signal_post_off')
s.at(P.signal_post(True, 3), 32, 39, name='signal_post_on')
s.at(P.signal_post(False, 4), 40, 43, name='signal_post_off')

# ================================================================ 북쪽 건물 줄(밑줄 8) + 밑동 잔해
s.at(S.ruin_block(4, 3, .6, seed=1, tank=True), 0, 8, block='bottom', rows=7, name='ruin_block_tall')
s.at(P.rubble_conc(5), 5, 8, block='bottom', name='rubble_conc')
s.at(S.ruin_block(3, 2, .5, seed=3, wall='plaster'), 7, 8, block='bottom', rows=6, name='ruin_block_low')
s.at(S.ruin_wall(3, 1), 11, 8, block='bottom', name='ruin_wall')
s.at(S.ruin_block(5, 3, .7, seed=9), 14, 8, block='bottom', rows=8, name='ruin_block_tall')
s.at(S.ruin_block(3, 2, .45, seed=4, tank=True, wall='paint'), 19, 8, block='bottom', rows=6, name='ruin_block_low')
s.at(P.girder_pile(2), 23, 8, block='bottom', name='girder_pile')
s.at(S.ruin_block(4, 3, .55, seed=10, tank=True), 47, 8, block='bottom', rows=7, name='ruin_block_tall')
s.at(flip(S.ruin_wall(3, 2)), 52, 8, block='bottom', name='ruin_wall')
s.at(S.ruin_block(5, 4, .65, seed=11, wall='plaster'), 55, 8, block='bottom', rows=8, name='ruin_block_tall')
s.at(flip(S.ruin_block(3, 2, .55, seed=5, wall='paint')), 61, 8, block='bottom', rows=5, name='ruin_block_low')
s.at(S.ruin_block(3, 2, .4, seed=6, tank=True), 65, 8, block='bottom', rows=6, name='ruin_block_low')
s.at(P.rubble_conc(6), 69, 8, block='bottom', name='rubble_conc')
s.at(P.rubble_small(11), 13, 10, block='all', name='rubble_small')
s.at(P.rubble_small(12), 53, 10, block='all', name='rubble_small')
# 북쪽 끝 뒤줄(돔 뒤·건물 틈): 낮은 그루터기와 잔해
s.at(S.ruin_block(2, 2, .5, seed=25, wall='plaster'), 27, 4, block='bottom', rows=4, name='ruin_block_low')
s.at(S.ruin_wall(3, 11), 31, 3, block='bottom', name='ruin_wall')
s.at(flip(S.ruin_block(2, 3, .6, seed=26, wall='paint')), 42, 4, block='bottom', rows=4, name='ruin_block_low')
s.at(P.rubble_conc(12), 39, 3, block='bottom', name='rubble_conc')
s.at(DEADT[0], 12, 6, block=[(0, 0)], name='dead_tree')
s.at(P.rubble_conc(13), 24, 5, block='bottom', name='rubble_conc')
s.at(DEADT[1], 35, 4, block=[(0, 0)], name='dead_tree')
# 공장 북쪽: 저장 탱크 둘 + 관
s.at(S.storage_tank(1), 67, 15, block='bottom', rows=2, name='storage_tank')
s.at(S.storage_tank(2, h=40), 63, 15, block='bottom', rows=2, name='storage_tank')
s.at(P.pipe_run(3), 59, 13, block='bottom', name='pipe_run')
s.at(P.girder_pile(4), 55, 14, block='bottom', name='girder_pile')

# ================================================================ 서쪽: 길 위 차·방호벽, 길 남쪽 가게 줄(밑줄 29)
s.at(P.car_wreck(1), 7, 22, block='bottom', name='car_wreck')
s.at(flip(P.car_wreck(2)), 16, 21, block='bottom', name='car_wreck')
s.at(flip(P.jersey_barrier(True, 3)), 0, 23, block='bottom', name='jersey_barrier_broken')
s.at(S.ruin_block(2, 3, .5, seed=12), 0, 29, block='bottom', rows=4, name='ruin_block_low')
s.at(S.ruin_wall(2, 3), 4, 29, block='bottom', name='ruin_wall')
s.at(S.ruin_block(3, 2, .35, seed=13, tank=True, wall='paint'), 6, 29, block='bottom', rows=5, name='ruin_block_low')
s.at(S.billboard_frame(1), 11, 29, block=[(0, 0), (2, 0)], name='billboard_frame')
s.at(S.ruin_block(2, 2, .7, seed=17, wall='plaster'), 15, 29, block='bottom', rows=3, name='ruin_block_low')
s.at(flip(S.ruin_wall(2, 4)), 19, 29, block='bottom', name='ruin_wall')
s.at(P.streetlamp_bent(4), 10, 24, block=[(0, 0)], name='streetlamp_bent')
s.at(P.jersey_barrier(True, 2), 20, 24, block='bottom', name='jersey_barrier_broken')
s.at(P.rubble_conc(10), 21, 31, block='bottom', name='rubble_conc')
s.at(S.ruin_block(2, 2, .55, seed=24, wall='plaster'), 21, 29, block='bottom', rows=3, name='ruin_block_low')
s.at(P.rubble_small(13), 10, 28, block='all', name='rubble_small')
# 가게 줄 뒤 빈터(풀·차 잔해·철망·웅덩이)
s.at(S.ruin_wall(4, 5), 1, 37, block='bottom', name='ruin_wall')
s.at(P.car_wreck(5), 11, 34, block='bottom', name='car_wreck')
s.at(flip(P.car_wreck(9)), 15, 32, block='bottom', name='car_wreck')
s.at(P.jersey_barrier(True, 9), 7, 32, block='bottom', name='jersey_barrier_broken')
s.at(P.fence_chain(3), 19, 34, block='bottom', name='fence_chain')
s.at(P.drum_single(5), 18, 36, block='all', name='drum_single')
s.at(P.cable_reel(3), 19, 37, block='bottom', name='cable_reel')
s.at(DEADT[0], 9, 37, block=[(0, 0)], name='dead_tree')
s.at(flip(DEADT[2]), 4, 33, block=[(0, 0)], name='dead_tree')

# ================================================================ 광장 소품(덩이로)
s.at(P.car_wreck(3), 44, 26, block='bottom', name='car_wreck')
s.at(P.jersey_barrier(False, 4), 39, 29, block='bottom', name='jersey_barrier')
s.at(P.jersey_barrier(True, 5), 41, 30, block='bottom', name='jersey_barrier_broken')
s.at(P.streetlamp_bent(1), 27, 24, block=[(0, 0)], name='streetlamp_bent')
s.at(flip(P.streetlamp_bent(2)), 47, 23, block=[(1, 0)], name='streetlamp_bent')
s.at(P.streetlamp_bent(3), 28, 14, block=[(0, 0)], name='streetlamp_bent')
s.at(flip(P.streetlamp_bent(5)), 44, 14, block=[(1, 0)], name='streetlamp_bent')
s.at(P.toxic_drums(1), 45, 32, block='bottom', name='toxic_drums')
s.at(P.drum_single(2), 47, 33, block='all', name='drum_single')
s.at(P.drum_single(3, 'warn'), 24, 34, block='all', name='drum_single')
s.at(P.rubble_conc(1), 37, 31, block='bottom', name='rubble_conc')
s.at(P.rubble_small(2), 50, 28, block='all', name='rubble_small')
s.at(P.rubble_small(3), 29, 21, block='all', name='rubble_small')
s.at(M.sentry_wreck(1), 41, 35, block='bottom', name='sentry_wreck')
s.at(S.deck_fallen(2), 30, 37, block='all', name='deck_fallen')
for (x, y, sd) in ((33, 22, 1), (42, 24, 2), (30, 30, 3), (39, 34, 4), (43, 11, 5), (31, 9, 6), (20, 41, 7), (57, 40, 9)):
    s.decal(P.manhole(sd) if sd % 2 else P.floor_vent(sd), x, y, name='manhole' if sd % 2 else 'floor_vent')
for (x, y, sd) in ((14, 21, 1), (35, 28, 2), (49, 26, 3), (5, 41, 4), (44, 40, 5), (64, 41, 6)): s.decal(P.oil_stain(sd), x, y, name='oil_stain')

# ================================================================ 공장 마당 · 뒷마당
s.at(P.pipe_run(1), 52, 19, block='bottom', name='pipe_run')
s.at(S.ruin_block(3, 3, .45, seed=2, tank=True, wall='paint'), 66, 19, block='bottom', rows=6, name='ruin_block_low')
s.at(M.rust_machine(1), 66, 28, block='bottom', rows=2, name='rust_machine')
s.at(P.vent_fan(1), 54, 28, block='bottom', name='vent_fan')
s.at(P.vent_fan(2), 63, 25, block='bottom', name='vent_fan')
s.at(P.pipe_elbow(1), 64, 21, block='bottom', name='pipe_elbow')
for (x, y, sd) in ((57, 25, 5), (60, 27, 7), (58, 29, 9)): s.decal(P.floor_vent(sd), x, y, name='floor_vent')
s.at(P.fence_chain(1), 53, 31, block='bottom', name='fence_chain')
s.at(flip(P.fence_chain(2)), 62, 31, block='bottom', name='fence_chain')
s.at(P.container(1), 56, 35, block='bottom', rows=2, name='container')
s.at(P.girder_pile(1), 60, 37, block='bottom', name='girder_pile')
s.at(P.cable_reel(1), 69, 33, block='bottom', name='cable_reel')
s.at(P.toxic_drums(2), 67, 38, block='bottom', name='toxic_drums')
s.at(M.rust_machine(2), 52, 37, block='bottom', rows=2, name='rust_machine')
s.at(P.drum_single(6), 64, 34, block='all', name='drum_single')
s.at(flip(S.ruin_wall(3, 12)), 48, 37, block='bottom', name='ruin_wall')

# ================================================================ 남쪽 큰길(차 잔해·방호벽) + 남쪽 건물 줄(밑줄 51)
s.at(P.car_wreck(6), 4, 42, block='bottom', name='car_wreck')
s.at(flip(P.car_wreck(7)), 21, 41, block='bottom', name='car_wreck')
s.at(P.car_wreck(8), 52, 42, block='bottom', name='car_wreck')
s.at(P.jersey_barrier(False, 6), 30, 42, block='bottom', name='jersey_barrier')
s.at(P.jersey_barrier(True, 7), 41, 40, block='bottom', name='jersey_barrier_broken')
s.at(P.jersey_barrier(False, 8), 60, 40, block='bottom', name='jersey_barrier')
s.at(S.ruin_block(2, 3, .5, seed=8), 0, 51, block='bottom', rows=4, name='ruin_block_low')
s.at(S.ruin_wall(3, 6), 4, 51, block='bottom', name='ruin_wall')
s.at(S.ruin_block(4, 3, .6, seed=16, tank=True), 7, 51, block='bottom', rows=7, name='ruin_block_tall')
s.at(P.rubble_conc(7), 12, 51, block='bottom', name='rubble_conc')
s.at(S.ruin_block(3, 2, .45, seed=18, tank=True, wall='plaster'), 14, 51, block='bottom', rows=6, name='ruin_block_low')
s.at(S.ruin_block(2, 2, .6, seed=14, wall='paint'), 18, 51, block='bottom', rows=4, name='ruin_block_low')
s.at(flip(S.ruin_wall(2, 10)), 22, 51, block='bottom', name='ruin_wall')
s.at(S.ruin_block(3, 3, .5, seed=19), 24, 51, block='bottom', rows=6, name='ruin_block_low')
s.at(P.container(3), 29, 51, block='bottom', rows=2, name='container')
s.at(P.rubble_small(7), 33, 51, block='all', name='rubble_small')
s.at(S.ruin_wall(3, 7), 38, 51, block='bottom', name='ruin_wall')
s.at(S.ruin_block(4, 3, .65, seed=20, wall='paint'), 41, 51, block='bottom', rows=7, name='ruin_block_tall')
s.at(S.storage_tank(3, h=36), 46, 51, block='bottom', rows=2, name='storage_tank')
s.at(S.ruin_block(2, 2, .4, seed=21, tank=True), 50, 51, block='bottom', rows=4, name='ruin_block_low')
s.at(S.billboard_frame(2), 54, 51, block=[(0, 0), (2, 0)], name='billboard_frame')
s.at(S.ruin_block(2, 3, .5, seed=22, wall='plaster'), 58, 51, block='bottom', rows=4, name='ruin_block_low')
s.at(S.ruin_wall(3, 8), 62, 51, block='bottom', name='ruin_wall')
s.at(S.ruin_block(4, 3, .6, seed=23, tank=True), 65, 51, block='bottom', rows=7, name='ruin_block_tall')
s.at(P.rubble_conc(8), 70, 51, block='bottom', name='rubble_conc')
s.at(DEADT[1], 33, 47, block=[(0, 0)], name='dead_tree')
s.at(flip(DEADT[0]), 39, 47, block=[(1, 0)], name='dead_tree')
s.at(M.sentry_wreck(2), 13, 45, block='bottom', name='sentry_wreck')
s.at(M.robot_arm(5), 59, 46, block='bottom', name='robot_arm')
s.at(P.drum_single(4), 31, 46, block='all', name='drum_single')

# 풀 덩이(오염 키큰 풀 · 마른 풀 · 잡초) — 빈 땅을 자연 덩이로
def tuft_cluster(cx, cy, n, r, kinds):
    for i in range(n):
        a = rng.random() * 6.283; d = r * math.sqrt(rng.random())
        x = int(round(cx + math.cos(a) * d * 1.3)); y = int(round(cy + math.sin(a) * d * .8))
        if not (0 <= x < W and 0 <= y < H): continue
        if (x, y) in s.occ or (x, y) in s.tox or s.block[y, x]: continue
        if s.m['asph'][y, x] or s.m['plate'][y, x]: continue
        if s.m['conc'][y, x] and rng.random() < .7: continue
        im = rng.choice(kinds)
        if im.width > 16 and (x + 1 >= W or (x + 1, y) in s.occ): im = kinds[0]
        s.decal(im, x, y, name='tuft'); s.occ.add((x, y))
        if im.width > 16: s.occ.add((x + 1, y))
WEED = [P.weeds_sick(i) for i in range(4)]
NAT = TG + DRY + [DBUSH]
for (cx, cy, n, r) in ((3, 25, 6, 2), (13, 26, 6, 2), (6, 31, 9, 2.5), (2, 31, 6, 2), (9, 33, 6, 2), (22, 37, 6, 2), (24, 31, 5, 1.8), (4, 38, 5, 2), (12, 38, 5, 2), (19, 26, 4, 1.5), (14, 31, 8, 2.5), (2, 35, 7, 2), (16, 36, 8, 2.5), (22, 34, 6, 2),
                       (8, 12, 10, 3), (12, 14, 6, 2), (6, 1, 5, 2), (24, 2, 5, 2), (34, 1, 5, 2), (46, 1, 4, 1.5), (53, 3, 5, 2), (69, 2, 4, 1.5), (20, 12, 9, 2.5), (24, 11, 6, 2), (17, 17, 6, 2), (23, 16, 7, 2.5),
                       (50, 12, 8, 2.5), (53, 15, 6, 2), (70, 12, 6, 2), (70, 17, 5, 2), (48, 36, 5, 2), (27, 37, 5, 2), (45, 35, 6, 2), (51, 34, 4, 1.5),
                       (2, 46, 7, 2), (12, 47, 7, 2), (21, 47, 7, 2.5), (28, 46, 7, 2.5), (44, 46, 7, 2.5), (49, 47, 6, 2),
                       (56, 46, 7, 2.5), (63, 46, 7, 2.5), (70, 46, 5, 2), (59, 33, 4, 1.5), (68, 35, 4, 1.5)):
    tuft_cluster(cx, cy, n, r, NAT)
for (cx, cy, n, r) in ((36, 27, 4, 2), (47, 20, 3, 1.5), (29, 31, 3, 1.5), (42, 31, 4, 2), (50, 34, 3, 1.5), (26, 18, 3, 1.5),
                       (30, 7, 3, 1.5), (45, 9, 3, 1.5), (35, 50, 3, 1.5), (60, 23, 2, 1), (10, 39, 3, 1.5), (60, 43, 3, 1.5), (24, 43, 3, 1.5)):
    tuft_cluster(cx, cy, n, r, WEED)
for (x, y) in ((17, 38), (12, 31), (27, 46), (47, 37), (5, 48), (62, 44)):
    if (x, y) not in s.occ: s.decal(ROCKS, x, y, name='rocks_small'); s.occ.add((x, y))

# ================================================================ 렌더 · 검사 · 내보내기
s.path = set()
s.marks['west_entrance'] = (0, 21)
img = s.render()
seen = s.bfs((0, 21))
reach = {k: (tuple(v) in seen) for k, v in s.marks.items()}
e = s.empty()
(wr, wx, wy), mean = s.worst(e)
g = s.walk_grid()
print('reach', reach)
print('walkable', int(g.sum()), 'reached', len(seen), 'isolated', int(g.sum()) - len(seen))
print('empty window worst %.2f at (%d,%d), mean %.2f' % (wr, wx, wy, mean))
if __name__ == '__main__':
    import fr_export
    n = fr_export.export(s, img, reach, ((wr, (wx, wy)), mean), seen)
    print('parts', n)
