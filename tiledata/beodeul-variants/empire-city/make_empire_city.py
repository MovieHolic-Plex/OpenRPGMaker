# 제국 도시 (empire-city) — 80x56 JRPG 마을(강철과 석재의 군사 도시). 다시 돌리면 같은 그림이 나온다.   python3 make_empire_city.py
# 동선: 남쪽 성문(성 밖 흙길 → 성문 문길) → 철판 대로(북으로) → 광장(얼굴 없는 투구 동상·확성기 기둥) → 돌계단 → 성채 정문.
# 대로 가운데 구역: 동쪽 병기 격납고 + 보급 마당, 서쪽 병영. 서쪽 = 공장 지구(굴뚝·관·가스 탱크), 동쪽 = 주택가.
import sys, os, json, math, random
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import numpy as np
from PIL import Image
from ec_base import *
from ec_base import _hash
from ec_scene import Scene
import ec_build as B, ec_props as P
HERE = os.path.dirname(os.path.abspath(__file__))      # (ec_base 의 * 가 HERE 를 덮으므로 다시)

W, H = 80, 56
rng = random.Random(8056)
s = Scene(W, H, seed=80)
VAR = os.path.join(HERE, '..')


def reuse(path):
    """다른 장소의 조각을 지도에만 다시 쓴다(내보내지 않는다)."""
    return Image.open(os.path.join(VAR, path)).convert('RGBA')


TG = [reuse('plains-highroad/parts/tallgrass_a.png'), reuse('plains-highroad/parts/tallgrass_b.png')]
MANHOLE = reuse('future-ruins/parts/manhole.png'); VENT = reuse('future-ruins/parts/floor_vent.png')
SIGNAL_ON = reuse('future-ruins/parts/signal_post_on.png'); OIL = reuse('future-ruins/parts/oil_stain.png')
PIPE_ELBOW = reuse('future-ruins/parts/pipe_elbow.png'); VENTFAN = reuse('future-ruins/parts/vent_fan.png')
REEL = reuse('future-ruins/parts/cable_reel.png'); GIRDER = reuse('future-ruins/parts/girder_pile.png')
CONTAINER = reuse('future-ruins/parts/container.png')


def garden_tree(seed=0):
    """뒤뜰 나무(지도 전용, 내보내지 않음): 버들항 칩셋 둥근 활엽수 수관(336,512 원본) + 줄기 + 밑동 그림자."""
    tc = TC(32, 40, seed)
    for y in range(24, 39): tc.px(15, y, 'wood', 4); tc.px(16, y, 'wood', 3); tc.px(17, y, 'wood', 2)
    tc.px(14, 38, 'wood', 3); tc.px(18, 38, 'wood', 2)
    im = tc.fin(.6, shadow=(16, 38, 9, 2, 60))
    im.alpha_composite(pz.chip(336, 512, 32, 32), (0, 0))
    return im

R = s.rect


def lawn(x0, y0, x1, y1):
    """울타리 두른 화단: 둘레 칸 = 철제 울타리(오토타일), 속 = 풀(포장을 걷어낸다)."""
    for k in s.m: s.m[k][y0:y1 + 1, x0:x1 + 1] = False
    s.fence_line([(x, y) for x in range(x0, x1 + 1) for y in range(y0, y1 + 1) if x in (x0, x1) or y in (y0, y1)])
    s.block[y0 + 1:y1, x0 + 1:x1] = True                          # 화단 속은 들어가지 않는다


def put(f, x, y, block='bottom', rows=1, name=None, **kw):
    im = f if isinstance(f, Image.Image) else f
    s.at(im, x, y, block=block, rows=rows, name=name, **kw)


# ================================================================ 바닥 (나중 것이 위: 풀 → 콘크리트 → 거리 돌 → 판석 → 철판)
R('soot', 0, 4, 27, 11); R('soot', 0, 16, 21, 38)                 # 공장 마당(그을린 콘크리트)
R('soot', 25, 22, 28, 36)                                          # 병영 서쪽 뒷마당(공장 마당과 이어진다)
for (x0, y0, x1, y1) in ((22, 16, 24, 40), (52, 18, 56, 28),       # 광장 서·동 연결 길
                         (22, 27, 36, 28), (52, 26, 79, 28),       # 광장 남쪽 동서 길
                         (0, 39, 36, 40), (56, 38, 79, 40),        # 가운데 남쪽 동서 길
                         (62, 26, 63, 40), (56, 29, 61, 37),       # 동쪽 남북 길 · 보급 마당
                         (0, 47, 36, 47), (44, 47, 79, 47),        # 성벽 안쪽 길
                         (36, 27, 36, 47), (44, 27, 44, 46),       # 대로 보도
                         (45, 28, 56, 37), (22, 37, 36, 38),       # 격납고 터 · 병영 앞마당
                         (0, 45, 36, 46), (44, 45, 79, 46)):       # 남쪽 집 줄 앞(문 앞 두 줄)
    R('cob', x0, y0, x1, y1)
for (x0, y0, x1, y1) in ((0, 12, 27, 15), (53, 12, 79, 17), (52, 12, 56, 17)):   # 큰 길(북쪽 거리 · 동쪽 가로수 길) = 밝은 회색 판석
    R('flag', x0, y0, x1, y1)
R('flag', 29, 15, 51, 26)                                         # 성채 앞뜰 + 광장(회색 판석)
R('flag', 46, 38, 55, 40)                                         # 격납고 앞 마당
R('plate', 37, 27, 43, 47)                                        # 철판 대로
R('plate', 39, 17, 41, 26)                                        # 광장을 가로지르는 철판 의례 길(대로 → 동상 → 계단)
R('dirt', 38, 52, 42, 55)                                         # 성 밖 흙길
for y in range(27, 48):
    for x in range(37, 44): s.curb.add((x, y))
for y in range(17, 27):
    for x in range(39, 42): s.curb.add((x, y))
for y in range(38, 41):
    for x in range(46, 56): s.hazard.add((x, y))
lawn(29, 22, 33, 26); lawn(47, 22, 51, 26)                         # 광장 화단 둘
lawn(52, 15, 56, 21)                                              # 광장 동쪽 화단(가로수)
lawn(24, 15, 28, 21)                                              # 광장 서쪽 화단(가로수)

# ================================================================ 북쪽 성벽 (지도 위 끝, y0~3)
for x0 in range(0, 28, 4): put(B.wall(4, seed=x0, banners=(1,) if x0 in (8, 20) else ()), x0, 3, block='all', name='wall')
for x0 in range(53, 80, 4): put(B.wall(min(4, 80 - x0), seed=x0, banners=(2,) if x0 in (57, 69) else ()), x0, 3, block='all', name='wall')

for x0 in range(28, 53, 4): put(B.wall(min(4, 53 - x0), seed=x0 + 1, slits=False), x0, 3, block='all', name='wall')   # 성채 뒤로 이어진 성벽
# ================================================================ 앵커 ① 성채 (x28~52, 밑줄 14) + 돌계단 + 깃대
put(B.citadel(), 28, 14, rows=9, walk=[(11, 0), (12, 0), (13, 0)], name='citadel')
s.marks['citadel_gate'] = (40, 14)
put(B.citadel_stairs(5), 38, 16, block=[(0, 0), (0, -1), (4, 0), (4, -1)], name='citadel_stairs')
for (fx, fy) in ((34, 16), (45, 16)): put(P.flagpole(seed=fx), fx, fy, block=[(0, 0)], name='flagpole')

# ================================================================ 북서: 공장 A · 굴뚝 · 가스 탱크 · 관 다리
put(B.factory(9, seed=1), 1, 12, rows=4, walk=[(3, 0), (4, 0), (5, 0)], name='factory')
s.marks['factory_a_door'] = (5, 12)
put(B.smokestack(seed=2), 10, 12, block=[(0, 0), (1, 0)], name='smokestack')
put(P.gas_tank(seed=3), 13, 11, rows=2, name='gas_tank')
put(P.gas_tank(seed=4, h=36), 18, 11, rows=2, name='gas_tank')
put(P.valve_station(seed=5), 22, 11, name='valve_station')
put(P.transformer(seed=6), 24, 11, name='transformer')
put(P.coal_pile(seed=8), 26, 12, block='all', name='coal_pile')
put(P.pipe_bridge(6, seed=7), 13, 16, block=[(0, 0), (5, 0)], name='pipe_bridge')
put(VENTFAN, 22, 12, name='vent_fan')

# ================================================================ 북동: 장교 주택 줄 (밑줄 11) — 골목·마당을 사이에
put(B.house(4, 2, seed=11, lit=((0, 1),)), 53, 11, rows=4, name='house')
put(P.lamp_iron(seed=57), 57, 11, block=[(0, 0)], name='lamp_iron')
put(B.house_tall(seed=13, roof='roofb'), 58, 11, rows=6, name='house_tall')
put(flip(B.house(3, 2, seed=12, ends=False)), 61, 11, rows=4, name='house')
put(P.crate_single(seed=64), 64, 11, block='all', name='crate_single')
put(B.house_wide(seed=14), 65, 11, rows=4, name='house_wide')
put(flip(B.house(4, 2, seed=15, lit=((0, 2),))), 70, 11, rows=4, name='house')
put(P.lamp_iron(seed=74), 74, 11, block=[(0, 0)], name='lamp_iron')
put(B.house_tall(seed=17), 75, 11, rows=6, name='house_tall')
put(P.crates_stack(seed=78), 78, 11, name='crates_stack')

# ================================================================ 광장 (앵커 ⑤)
put(P.statue(), 38, 24, block=[(i, -j) for i in range(5) for j in range(2)], name='statue')
s.marks['statue'] = (40, 25)
for (lx, ly, sd) in ((29, 19, 1), (50, 19, 2), (34, 25, 3), (45, 25, 4)):
    put(P.loudspeaker(seed=sd), lx, ly, block=[(1, 0)], name='loudspeaker')
for (fx, fy) in ((34, 21), (45, 21)): put(P.flagpole(seed=fx + 3), fx, fy, block=[(0, 0)], name='flagpole')
for (lx, ly) in ((36, 16), (44, 16)): put(P.lamp_iron(seed=lx + ly), lx, ly, block=[(0, 0)], name='lamp_iron')
for (bx, by) in ((31, 20), (48, 20)): put(P.bench_iron(seed=bx), bx, by, block='all', name='bench_iron')
for (tx, ty) in ((25, 20), (53, 20), (30, 25), (48, 25)): put(P.tree_ironplanter(seed=tx), tx, ty, block=[(0, 0), (1, 0)], name='tree_ironplanter')
put(P.hedge_trough(2, seed=3), 25, 16, block='bottom', name='hedge_trough'); put(P.hedge_trough(2, seed=4), 54, 16, block='bottom', name='hedge_trough')
for (tx, ty) in ((58, 17), (66, 16), (73, 17)): put(P.tree_ironplanter(seed=tx), tx, ty, block=[(0, 0), (1, 0)], name='tree_ironplanter')
for (x, y, sd) in ((33, 18, 1), (47, 18, 2), (40, 26, 3)): s.decal(P.drain_grate(sd), x, y, name='drain_grate')

# ================================================================ 서쪽 공장 지구 (앵커 ③)
put(B.factory(9, seed=21, stacks=(1, 7)), 1, 26, rows=4, walk=[(3, 0), (4, 0), (5, 0)], name='factory')
s.marks['factory_b_door'] = (5, 26)
put(B.smokestack(seed=22, h=96), 10, 25, block=[(0, 0), (1, 0)], name='smokestack')
put(P.steam_engine(seed=23), 12, 25, rows=2, name='steam_engine')
put(P.gas_tank(seed=24, h=40), 16, 25, rows=2, name='gas_tank')
put(P.valve_station(seed=25), 20, 22, name='valve_station')
put(P.transformer(seed=28), 20, 25, name='transformer')
put(P.coal_pile(seed=26), 13, 20, block='all', name='coal_pile')
put(REEL, 23, 19, name='cable_reel'); put(GIRDER, 23, 23, name='girder_pile')
put(P.drums_fuel(seed=27), 16, 19, name='drums_fuel')
# 공장 C (아래 줄)
put(B.factory(9, seed=31, stacks=(3,)), 1, 38, rows=4, walk=[(3, 0), (4, 0), (5, 0)], name='factory')
s.marks['factory_c_door'] = (5, 38)
put(B.smokestack(seed=32), 10, 38, block=[(0, 0), (1, 0)], name='smokestack')
put(P.gas_tank(seed=33), 12, 36, rows=2, name='gas_tank')
put(P.pipe_bridge(5, seed=34), 16, 33, block=[(0, 0), (4, 0)], name='pipe_bridge')
put(CONTAINER, 17, 38, rows=2, name='container')
put(P.drums_fuel(seed=36), 13, 31, name='drums_fuel')
put(P.steam_engine(seed=35), 22, 32, rows=2, name='steam_engine')
put(P.coal_pile(seed=37), 22, 37, block='all', name='coal_pile')

# ================================================================ 대로 가운데 구역 (앵커 ②): 서쪽 병영 · 동쪽 격납고 + 보급 마당
put(B.barracks(10, seed=41), 26, 36, rows=4, walk=[(4, 0), (5, 0)], name='barracks')
s.marks['barracks_door'] = (30, 36)
put(B.hangar(10, seed=42), 46, 37, rows=4, walk=[(i, 0) for i in range(2, 8)], name='hangar')
s.marks['hangar_door'] = (50, 37)
put(SIGNAL_ON, 45, 38, block=[(0, 0)], name='signal_post_on')
put(SIGNAL_ON, 56, 38, block=[(0, 0)], name='signal_post_on')
put(B.warehouse(6, seed=55), 56, 34, rows=3, walk=[(2, 0), (3, 0)], name='warehouse')
s.marks['warehouse_door'] = (58, 34)
for (x, y, f) in ((56, 37, P.crates_stack), (60, 37, P.ammo_boxes), (60, 36, P.drums_fuel), (61, 35, P.crate_single), (56, 35, P.crate_single)):
    put(f(seed=x * 3 + y), x, y, name=f.__name__)
for (x, y, f) in ((24, 35, P.crates_stack), (22, 40, P.ammo_boxes), (35, 39, P.crate_single)):
    put(f(seed=x + y), x, y, name=f.__name__)
put(P.supply_cart(seed=9), 26, 40, name='supply_cart')
for (lx, ly) in ((36, 30), (44, 33), (36, 36), (44, 42), (36, 42)):
    put(P.lamp_iron(seed=lx + ly), lx, ly, block=[(0, 0)], name='lamp_iron')
put(P.loudspeaker(seed=9), 35, 44, block=[(1, 0)], name='loudspeaker')
for (x, y, sd) in ((40, 31, 1), (39, 39, 2), (41, 44, 3)): s.decal(MANHOLE if sd % 2 else VENT, x, y, name='manhole')
for (x, y) in ((38, 34), (42, 42)): s.decal(OIL, x, y, name='oil_stain')

# ================================================================ 동쪽: 병영(연병장) · 주택가
put(B.barracks(10, seed=51), 57, 25, rows=4, walk=[(4, 0), (5, 0)], name='barracks')
s.marks['barracks_e_door'] = (61, 25)
put(P.flagpole(seed=52), 55, 23, block=[(0, 0)], name='flagpole')
put(P.sandbags(3, seed=53), 64, 27, block='all', name='sandbags')
put(P.bollard(1), 56, 26, block='all', name='bollard'); put(P.bollard(2), 56, 27, block='all', name='bollard')
put(B.house(4, 2, seed=61), 68, 25, rows=4, name='house')
put(P.lamp_iron(seed=72), 72, 25, block=[(0, 0)], name='lamp_iron')
put(flip(B.house_tall(seed=62)), 73, 25, rows=6, name='house_tall')
put(B.house(3, 2, seed=63, ends=False, lit=((0, 0),)), 76, 25, rows=4, name='house')
put(B.house(4, 2, seed=71), 64, 36, rows=4, name='house')
put(P.crate_single(seed=68), 68, 36, block='all', name='crate_single')
put(flip(B.house_wide(seed=72)), 69, 36, rows=4, name='house_wide')
put(P.lamp_iron(seed=74), 74, 36, block=[(0, 0)], name='lamp_iron')
put(B.house_tall(seed=74, roof='roofb'), 75, 36, rows=6, name='house_tall')
put(P.bench_iron(seed=78), 78, 36, block='all', name='bench_iron')

# ================================================================ 남쪽 단층 집 줄 (밑줄 46, 6줄) — 골목을 사이에
ROW = [(0, B.house_low(81, 4)), (4, 'lamp'), (5, B.house(5, 1, seed=82, roof='roofb', ends=False, awning=True)), (10, 'tree'),
       (12, flip(B.house_low(83, 3))), (15, B.house(4, 1, seed=84, roof='roofb')), (19, 'crate'), (20, flip(B.house(3, 1, seed=85))),
       (23, 'hedge'), (25, B.house(4, 1, seed=86, ends=False)), (29, flip(B.house_low(87, 3))),
       (47, B.house_low(91, 3)), (50, 'tree'), (52, B.house(4, 1, seed=92, roof='roofb', ends=False)), (56, 'lamp'),
       (57, flip(B.house(5, 1, seed=93))), (62, 'bench'), (64, B.house(3, 1, seed=94, ends=False)), (67, flip(B.house(4, 1, seed=95, roof='roofb'))),
       (71, 'crate'), (72, B.house_low(96, 3)), (75, 'tree')]
for (tx, ty) in ((2, 42), (9, 41), (17, 42), (27, 41), (49, 42), (59, 41), (66, 42), (74, 41)):   # 남쪽 집 뒤뜰 나무(덩이 셋씩 아님 — 드문드문)
    put(garden_tree(seed=tx), tx, ty, block=[(0, 0), (1, 0)], name='garden_tree')
for (hx_, x, y) in ((0, 13, 42), (1, 62, 42)):
    put(P.hedge_trough(2, seed=hx_ + 5), x, y, block='bottom', name='hedge_trough')
put(P.sandbags(3, seed=9), 31, 38, block='all', name='sandbags'); put(P.barricade(seed=9), 33, 40, block='all', name='barricade')
for (hx_, im) in ROW:
    if im == 'lamp': put(P.lamp_iron(seed=hx_), hx_, 45, block=[(0, 0)], name='lamp_iron')
    elif im == 'tree': put(P.tree_ironplanter(seed=hx_), hx_, 45, block=[(0, 0), (1, 0)], name='tree_ironplanter')
    elif im == 'crate': put(P.crate_single(seed=hx_), hx_, 46, block='all', name='crate_single')
    elif im == 'hedge': put(P.hedge_trough(2, seed=hx_), hx_, 46, block='bottom', name='hedge_trough')
    elif im == 'bench': put(P.bench_iron(seed=hx_), hx_, 46, block='all', name='bench_iron')
    else: put(im, hx_, 46, rows=2, name='house_low')
put(P.sentry_box(seed=101), 32, 46, rows=2, name='sentry_box')

# ================================================================ 앵커 ④ 남쪽 성벽 · 성문 · 감시 포탑 · 서치라이트 (y48~51)
for x0 in range(3, 34, 4):
    put(B.wall(min(4, 34 - x0), seed=x0, banners=(1,) if x0 in (11, 23) else ()), x0, 51, block='all', name='wall')
for x0 in range(47, 77, 4):
    put(B.wall(min(4, 77 - x0), seed=x0, banners=(1,) if x0 in (51, 63) else ()), x0, 51, block='all', name='wall')
put(B.turret(seed=5), 0, 51, rows=4, name='turret')
put(B.turret(seed=6, flip=True), 77, 51, rows=4, name='turret')
put(B.turret(seed=7), 34, 51, rows=4, name='turret')
put(B.turret(seed=8, flip=True), 44, 51, rows=4, name='turret')
put(B.gatehouse(), 37, 51, rows=6, walk=[(i, -j) for i in (2, 3, 4) for j in range(6)], name='gatehouse')
s.marks['south_gate'] = (40, 51)
for (x, y, fl) in ((33, 54, False), (46, 54, True)):
    put(P.searchlight(seed=x, flip=fl), x, y, block=[(1 if not fl else 0, 0)], name='searchlight')
s.topimg(P.searchlight_beam(seed=1), 33 * 16 + 10 - 96 + 6, 54 * 16 - 80 + 12)
s.topimg(P.searchlight_beam(seed=2).transpose(Image.FLIP_LEFT_RIGHT), 46 * 16 + 22 - 6, 54 * 16 - 80 + 12)
for (x, y, f, bl) in ((35, 55, P.sandbags, 'all'), (43, 55, P.sandbags, 'all'), (30, 53, P.hedgehog, 'all'), (28, 55, P.hedgehog, 'all'),
                      (50, 53, P.hedgehog, 'all'), (52, 55, P.hedgehog, 'all'), (36, 53, P.barricade, 'all'), (43, 53, P.barricade, 'all'),
                      (48, 55, P.sentry_box, 'bottom')):
    put(f(seed=x + y), x, y, block=bl, rows=2 if f is P.sentry_box else 1, name=f.__name__)


# 풀 덩이(성 밖 풀밭·북쪽 끝 빈 땅)
def tuft_cluster(cx, cy, n, r):
    for i in range(n):
        a = rng.random() * 6.283; d = r * math.sqrt(rng.random())
        x = int(round(cx + math.cos(a) * d * 1.4)); y = int(round(cy + math.sin(a) * d * .7))
        if not (0 <= x < W and 0 <= y < H): continue
        if (x, y) in s.occ or s.block[y, x] or s.m['dirt'][y, x]: continue
        if s.m['plate'][y, x] or s.m['flag'][y, x] or s.m['cob'][y, x] or s.m['soot'][y, x]: continue
        s.decal(rng.choice(TG), x, y, name='tuft'); s.occ.add((x, y))
for (cx, cy, n, r) in ((10, 53, 9, 3), (22, 54, 9, 3), (58, 53, 9, 3), (70, 54, 9, 3), (3, 54, 5, 2), (77, 54, 5, 2)):
    tuft_cluster(cx, cy, n, r)

# ================================================================ 렌더 · 검사 · 내보내기
s.marks['south_entrance'] = (40, 55)
img = s.render()
seen = s.bfs((40, 55))
reach = {k: (tuple(v) in seen) for k, v in s.marks.items()}
e = s.empty()
(wr, wx, wy), mean = s.worst(e)
g = s.walk_grid()
print('reach', reach)
print('walkable', int(g.sum()), 'reached', len(seen), 'isolated', int(g.sum()) - len(seen))
print('empty window worst %.2f at (%d,%d), mean %.2f' % (wr, wx, wy, mean))
if __name__ == '__main__':
    if '--quick' in sys.argv:
        img.convert('RGB').save(os.path.join(HERE, '_qa', 'map1x.png'))
    else:
        import ec_export
        n = ec_export.export(s, img, reach, ((wr, (wx, wy)), mean), seen)
        print('parts', n)
