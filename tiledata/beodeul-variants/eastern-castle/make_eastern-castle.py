# 동양풍 성·닌자 마을 (eastern-castle) — 야외 64x48(천수각 성 + 해자 + 닌자 마을) + 실내 26x16(다다미 방 + 성 안 대청)을 한 렌더에.
# 다시 돌리면 같은 그림이 나온다.   python3 make_eastern-castle.py   (--quick = _qa/map1x.png 만)
# 동선: 남쪽 입구(38,47) → 흙길 북으로 → 해자 다리 → 성문 망루(야구라몬) 문길 → 판석 길 → 천수각 기단 문.
# 곁: 마을 동서 골목(y33~34) → 서쪽 대숲 오솔길 → 사당 돌계단 → 사당 / 동쪽 널다리 → 대숲 → 판자벽 숨은 문 → 닌자 은신 마당.
import sys, os, json, math, random
_HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, _HERE)
import numpy as np
from PIL import Image
from ek_base import *
from ek_base import _hash
from ek_scene import Scene
import ek_build as B, ek_props as P
import bdv
HERE = _HERE

OW, OH = 64, 48                     # 야외
OX, OY, IW, IH = 66, 1, 26, 16      # 실내 판 자리
W, H = OX + IW, OH
rng = random.Random(6448)
s = Scene(W, H, seed=64)
R = s.rect


def put(im, x, y, block='bottom', rows=1, name=None, **kw):
    s.at(im, x, y, block=block, rows=rows, name=name, **kw)


BUSH = bdv.trees('bush'); CANOPY = bdv.trees('canopy'); OAK = bdv.trees('oak')
TG = [Image.open(os.path.join(VAR, 'plains-highroad/parts/tallgrass_a.png')).convert('RGBA'),
      Image.open(os.path.join(VAR, 'plains-highroad/parts/tallgrass_b.png')).convert('RGBA')]

# ================================================================ 바깥 어둠(두 판 사이) + 실내 판 바탕
R('void', OW, 0, W - 1, H - 1)
R('void', OW, 0, W - 1, H - 1, False) if False else None
for y in range(H):
    for x in range(OW, W):
        inside = OX <= x < OX + IW and OY <= y < OY + IH
        s.m['void'][y, x] = not inside

# ================================================================ 물: 해자(남·서) + 개울(해자에서 남으로)
s.water[21:24, 13:OW] = True
s.water[0:21, 13:16] = True
s.water[24:OH, 46:48] = True

# ================================================================ 성 마당 바닥
R('suna', 16, 0, OW - 1, 18)
R('flag', 37, 14, 39, 18)                                        # 성문 → 천수각 판석 길
R('flag', 37, 19, 39, 20)                                        # 문길 바닥
R('raked', 51, 10, 62, 15)                                       # 마른 정원(갈퀴 모래)
for x in range(51, 63):
    for y in range(10, 16):
        if x in (51, 62) or y in (10, 15): s.hazard.add((x, y))  # 자갈 연석(정원 테)

# ================================================================ 성: 해자 둑 돌담 + 흙벽 + 망루 + 성문 + 천수각
for (x0, x1) in ((21, 35), (42, 56), (61, 64)):                  # 성 기단 남쪽 돌담 앞면(2줄) + 그 위 흙벽
    x = x0
    while x < x1:
        w = min(4, x1 - x)
        put(B.ishigaki_wall(w, 2, seed=x), x, 20, block='all', name='ishigaki_wall')
        put(B.dobei(w, seed=x), x, 18, block='bottom', name='dobei')
        x += w
for y0 in range(0, 15, 3):                                       # 서쪽 흙벽(남북, 덮개 기와 줄)
    put(B.dobei_ns(3, seed=y0), 16, y0 + 2, block='all', name='dobei_ns')
put(B.yagura(seed=3), 16, 20, block=[(i, -j) for i in range(5) for j in range(4)], name='yagura')
put(B.yagura(seed=5, flip_=True), 56, 20, block=[(i, -j) for i in range(5) for j in range(4)], name='yagura')
put(B.yaguramon(seed=2), 35, 20, block=[(i, -j) for i in range(7) for j in range(3)],
    walk=[(i, -j) for i in (2, 3, 4) for j in range(6)], name='yaguramon')
s.marks['castle_gate'] = (38, 19)
put(B.bridge_ns(3, 3, seed=1), 37, 23, block=None, walk=[(i, -j) for i in range(3) for j in range(3)], name='bridge_ns', sorty=21 * 16)
s.marks['moat_bridge'] = (38, 22)
put(B.tenshu(seed=1), 33, 13, block=[(i, -j) for i in range(11) for j in range(5)], walk=[(5, 0)], name='tenshu')
s.marks['keep_door'] = (38, 13)
# 성 마당 소품: 판석 길 양옆 돌 등롱, 소나무, 곳간, 마른 정원
for (x, y) in ((36, 15), (40, 15), (36, 17), (40, 17)): put(P.toro(seed=x + y), x, y, block=[(0, 0)], name='toro')
put(P.matsu(seed=1), 18, 8, block=[(1, 0), (2, 0)], name='matsu')
put(P.matsu(seed=4, flip_=True), 26, 15, block=[(1, 0), (2, 0)], name='matsu')
put(P.matsu(seed=7), 45, 6, block=[(1, 0), (2, 0)], name='matsu')
put(P.kura(4, seed=2), 21, 12, rows=2, name='kura')
put(P.kura(4, seed=6), 50, 8, rows=2, name='kura')
put(P.kura(3, seed=9), 57, 8, rows=2, name='kura')
for (x, y, sd) in ((53, 12, 1), (57, 13, 2), (60, 11, 3)): put(P.garden_rock(seed=sd, w=2), x, y, block='bottom', name='garden_rock')
for (x, y) in ((55, 14), (52, 15), (59, 14)): put(P.azalea(seed=x), x, y, block=[(0, 0), (1, 0)], name='azalea')
put(P.azalea(seed=3), 29, 15, block=[(0, 0), (1, 0)], name='azalea'); put(P.azalea(seed=9), 44, 15, block=[(0, 0), (1, 0)], name='azalea')
put(P.tawara(seed=1), 25, 13, block='all', name='tawara'); put(P.taru(seed=2), 27, 13, block=[(0, 0)], name='taru')
put(P.tawara(seed=4), 54, 9, block='all', name='tawara')
put(P.weapon_rack(seed=3), 30, 11, block=[(0, 0), (1, 0)], name='weapon_rack')
put(P.toro(seed=9), 47, 13, block=[(0, 0)], name='toro'); put(P.toro(seed=11), 31, 6, block=[(0, 0)], name='toro')
put(P.matsu(seed=10, flip_=True), 59, 4, block=[(1, 0), (2, 0)], name='matsu')
put(P.matsu(seed=12), 23, 4, block=[(1, 0), (2, 0)], name='matsu')
for (x, y) in ((19, 16), (46, 2), (30, 2), (62, 17)): put(P.azalea(seed=x * 3), x, y, block=[(0, 0), (1, 0)], name='azalea')

# ================================================================ 북서: 사당 언덕(돌 기단 위) + 돌계단 + 도리이
R('flag', 6, 5, 7, 8)                                           # 사당 앞 판석
for (x0, w) in ((0, 4), (4, 1), (8, 4)):
    put(B.ishigaki_wall(w, 2, seed=x0 + 40), x0, 10, block='all', name='ishigaki_wall')
put(P.stone_steps(3, 2, seed=2), 5, 10, block=None, name='stone_steps')
put(B.hokora(seed=1), 5, 4, block='bottom', rows=2, name='hokora')
s.marks['shrine'] = (6, 5)
put(P.saisen_box(seed=1), 6, 5, block='all', name='saisen_box') if False else None
put(P.komainu(seed=1), 4, 7, block=[(0, 0)], name='komainu'); put(P.komainu(seed=2, flip_=True), 8, 7, block=[(0, 0)], name='komainu')
put(P.toro(seed=21), 3, 8, block=[(0, 0)], name='toro'); put(P.toro(seed=22), 9, 8, block=[(0, 0)], name='toro')
put(P.chozubachi(seed=1), 1, 7, block=[(0, 0), (1, 0)], name='chozubachi')
put(P.ema_rack(seed=1), 9, 4, block=[(0, 0), (1, 0)], name='ema_rack')
put(P.matsu(seed=13), 0, 3, block=[(1, 0), (2, 0)], name='matsu')
put(P.bamboo(seed=31, n=5, w=2, h=5), 10, 2, block=[(0, 0), (1, 0)], name='bamboo')
put(P.bamboo(seed=32, n=4, w=2, h=5), 11, 6, block=[(0, 0), (1, 0)], name='bamboo')
put(P.azalea(seed=41), 1, 9, block=[(0, 0), (1, 0)], name='azalea')
put(B.torii(seed=1), 4, 12, block=[(0, 0), (3, 0)], name='torii')

# ================================================================ 서쪽 대숲(사당 → 마을 오솔길 x5~7)
for y in range(11, 34): s.curb.add((6, y))                        # 판석 오솔길(1칸, 오토타일)
for y in range(13, 24): s.curb.add((5, y)) if y % 4 == 0 else None
BAMB_W = [(0, 16, 2), (2, 19, 2), (0, 22, 3), (9, 16, 3), (8, 19, 2), (10, 22, 2), (3, 14, 1), (1, 25, 2), (10, 25, 2)]
for i, (x, y, w) in enumerate(BAMB_W):
    if w == 1: put(P.bamboo_young(seed=60 + i), x, y, block=[(0, 0)], name='bamboo_young')
    else: put(P.bamboo(seed=50 + i, n=4 + w, w=w + 1 if w == 2 else 3, h=5 + (i % 2)), x, y, block=[(0, 0), (1, 0)], name='bamboo')
for (x, y) in ((4, 18), (8, 22), (4, 23), (8, 14)): put(P.bamboo_young(seed=x * 7 + y), x, y, block=[(0, 0)], name='bamboo_young')

# ================================================================ 마을 길
R('dirt', 37, 24, 39, OH - 1)                                    # 남북 큰 길
R('dirt', 0, 33, 45, 34)                                         # 동서 골목
R('dirt', 19, 31, 29, 32)                                        # 도장 앞 수련 마당
R('dirt', 40, 31, 44, 32)                                        # 물레방아 앞
R('dirt', 49, 33, 52, 34); R('dirt', 52, 34, 53, 39)              # 동쪽 대숲 길(널다리 → 숨은 문)
R('dirt', 53, 38, 56, 39)
R('dirt', 49, 42, 62, 44)                                        # 은신 마당

# ================================================================ 마을 북줄(y25~32): 민가 둘 · 도장 · 물레방아
put(B.minka(5, seed=1, roof='thatch', door=2), 1, 30, rows=2, walk=[(2, 0)], name='minka_thatch')
s.marks['house_a_door'] = (3, 30)
put(B.minka(4, seed=2, roof='plank', door=1), 9, 30, rows=2, walk=[(1, 0)], name='minka_plank')
s.marks['house_b_door'] = (10, 30)
put(B.dojo(seed=1), 20, 30, rows=3, walk=[(3, 0), (4, 0)], name='dojo')
s.marks['dojo_door'] = (24, 30)
for (x, y, f) in ((19, 32, P.makiwara), (21, 32, P.makiwara), (28, 32, P.mokujin), (29, 31, P.target_board)):
    put(f(seed=x), x, y, block=[(0, 0)], name=f.__name__)
put(P.weapon_rack(seed=7), 30, 30, block=[(0, 0), (1, 0)], name='weapon_rack')
put(P.chochin_post(seed=1), 32, 30, block=[(0, 0)], name='chochin_post')
put(P.chochin_post(seed=2), 36, 26, block=[(0, 0)], name='chochin_post')
put(B.mill_hut(seed=1), 41, 30, rows=2, walk=[(1, 0)], name='mill_hut')
s.marks['mill_door'] = (42, 30)
put(B.water_wheel(seed=1), 45, 31, block=None, dx=8, name='water_wheel')
put(P.firewood(seed=3), 6, 31, block='all', name='firewood') if False else None
put(P.tawara(seed=7), 14, 30, block='all', name='tawara')
put(P.taru(seed=5), 16, 30, block=[(0, 0)], name='taru')
put(P.drying_rack(seed=1), 33, 27, block=[(0, 0), (1, 0)], name='drying_rack')
put(P.firewood(seed=2), 17, 27, block='all', name='firewood')

# ================================================================ 마을 남줄(y35~47)
put(B.minka(5, seed=3, roof='thatch', door=1, lit=True), 2, 41, rows=2, walk=[(1, 0)], name='minka_thatch')
s.marks['house_c_door'] = (3, 41)
put(B.minka(4, seed=4, roof='plank', door=2), 11, 40, rows=2, walk=[(2, 0)], name='minka_plank')
s.marks['house_d_door'] = (13, 40)
put(B.minka(5, seed=5, roof='thatch', door=3), 25, 42, rows=2, walk=[(3, 0)], name='minka_thatch')
s.marks['house_e_door'] = (28, 42)
put(P.kura(3, seed=11), 18, 41, rows=2, name='kura')
put(B.well(seed=1), 31, 37, block=[(0, 0), (1, 0), (2, 0), (0, -1), (1, -1), (2, -1)], name='well')
s.marks['well'] = (32, 38)
R('dirt', 30, 35, 34, 38); R('dirt', 3, 35, 3, 40); R('dirt', 13, 35, 13, 39); R('dirt', 28, 35, 28, 42); R('dirt', 1, 42, 6, 43)
R('dirt', 11, 41, 15, 42); R('dirt', 25, 43, 30, 44)
put(P.drying_rack(seed=4), 7, 39, block=[(0, 0), (1, 0)], name='drying_rack')
put(P.tawara(seed=9), 16, 40, block='all', name='tawara')
put(P.firewood(seed=5), 22, 42, block='all', name='firewood')
put(P.taru(seed=8), 24, 42, block=[(0, 0)], name='taru')
put(P.chochin_post(seed=3), 36, 36, block=[(0, 0)], name='chochin_post')
put(P.chochin_post(seed=4), 40, 41, block=[(0, 0)], name='chochin_post')
put(P.toro(seed=31), 34, 40, block=[(0, 0)], name='toro')

# ================================================================ 동쪽: 널다리 · 대숲 · 판자벽 숨은 문 · 닌자 은신 마당
put(B.plank_bridge(4, seed=1), 45, 34, block=None, walk=[(i, 0) for i in range(4)] + [(i, -1) for i in range(4)], name='plank_bridge', sorty=33 * 16 + 4)
s.marks['plank_bridge'] = (46, 34)
x = 48
while x < OW:
    w = min(4, OW - x)
    door = 0 if x == 56 else None
    put(B.plank_fence(w, seed=x, door=door), x, 40, block='bottom', walk=[(0, 0)] if door is not None else (), name='plank_fence')
    x += w
s.marks['hidden_door'] = (56, 40)
BAMB_E = [(48, 27, 3), (51, 26, 2), (54, 27, 3), (57, 25, 2), (60, 27, 3), (49, 31, 2), (55, 31, 3), (59, 32, 2), (61, 35, 2),
          (48, 38, 2), (57, 36, 3), (60, 39, 2), (49, 36, 1), (54, 36, 1), (58, 33, 1), (62, 30, 1), (52, 29, 1)]
for i, (x, y, w) in enumerate(BAMB_E):
    if w == 1: put(P.bamboo_young(seed=80 + i), x, y, block=[(0, 0)], name='bamboo_young')
    else: put(P.bamboo(seed=70 + i, n=4 + w, w=w + 1 if w == 2 else 3, h=5 + (i % 2)), x, y, block=[(0, 0), (1, 0)], name='bamboo')
# 은신 마당(판자벽 남쪽): 닌자 오두막 · 수련 기물 · 과녁 · 무기 걸이
put(B.minka(4, seed=8, roof='plank', door=1), 58, 46, rows=2, walk=[(1, 0)], name='minka_plank')
s.marks['ninja_hut_door'] = (59, 46)
for (x, y, f) in ((50, 45, P.target_board), (52, 45, P.target_board), (54, 46, P.mokujin), (49, 47, P.makiwara)):
    put(f(seed=x + y), x, y, block=[(0, 0)], name=f.__name__)
put(P.weapon_rack(seed=11), 55, 42, block=[(0, 0), (1, 0)], name='weapon_rack')
put(P.firewood(seed=9), 62, 42, block='all', name='firewood')
put(P.taru(seed=13), 49, 42, block=[(0, 0)], name='taru')
s.marks['hideout'] = (55, 44)

# ================================================================ 나무·덤불 덩이(빈 풀밭) — 버들항 덤불·활엽수 + 소나무 + 철쭉
def tree_at(kind, x, y):
    if kind == 'bush':
        im = BUSH[(x + y) % len(BUSH)]; put(im, x, y, block=[(0, 0), (1, 0)], name='bush')
    elif kind == 'canopy':
        im = CANOPY[(x * 3 + y) % len(CANOPY)]; put(im, x, y, block=[(1, 0)], name='tree')
    elif kind == 'oak':
        im = OAK[(x + y) % len(OAK)]; put(im, x, y, block=[(1, 0)], name='tree')
    elif kind == 'matsu':
        put(P.matsu(seed=x * 5 + y, flip_=(x % 2 == 0)), x, y, block=[(1, 0), (2, 0)], name='matsu')
    elif kind == 'azalea':
        put(P.azalea(seed=x + y * 3), x, y, block=[(0, 0), (1, 0)], name='azalea')

for (k, x, y) in [('oak', 13, 28), ('bush', 15, 27), ('canopy', 7, 27), ('bush', 0, 26), ('matsu', 30, 25),
                  ('bush', 43, 26), ('canopy', 40, 37), ('bush', 42, 40), ('oak', 42, 44), ('bush', 44, 37),
                  ('azalea', 0, 38), ('bush', 18, 45), ('matsu', 20, 37),
                  ('canopy', 33, 45), ('bush', 35, 43), ('azalea', 24, 37), ('bush', 9, 37), ('azalea', 30, 47),
                  ('bush', 0, 47), ('canopy', 4, 47), ('canopy', 21, 47), ('bush', 44, 47), ('azalea', 16, 37), ('bush', 26, 47)]:
    tree_at(k, x, y)


def tuft_cluster(cx, cy, n, r):
    for i in range(n):
        a = rng.random() * 6.283; d = r * math.sqrt(rng.random())
        x = int(round(cx + math.cos(a) * d * 1.4)); y = int(round(cy + math.sin(a) * d * .7))
        if not (0 <= x < OW and 24 <= y < OH): continue
        if (x, y) in s.occ or s.block[y, x] or s.water[y, x]: continue
        if any(s.m[k][y, x] for k in ('dirt', 'suna', 'flag', 'raked')) or (x, y) in s.curb: continue
        s.decal(rng.choice(TG), x, y, name='tuft'); s.occ.add((x, y))
for (cx, cy, n, r) in ((11, 26, 6, 2), (17, 35, 6, 2), (23, 39, 6, 2), (35, 31, 5, 2), (42, 35, 5, 2), (5, 37, 5, 2),
                       (9, 46, 5, 2), (33, 42, 5, 2), (20, 44, 4, 2), (44, 29, 4, 2)):
    tuft_cluster(cx, cy, n, r)
for (x, y) in ((34, 33), (31, 33), (45, 33)): s.decal(P.stepping_stone(seed=x), x, y, name='stepping_stone') if False else None
for (x, y) in ((37, 34), (29, 36), (12, 36), (4, 36)): pass

# ================================================================ 실내: 다다미 방(서) + 성 안 대청(동)
ix = lambda x: OX + x; iy = lambda y: OY + y
R('ceil', ix(0), iy(0), ix(IW - 1), iy(0)); R('ceil', ix(0), iy(0), ix(0), iy(IH - 1)); R('ceil', ix(IW - 1), iy(0), ix(IW - 1), iy(IH - 1))
R('ceil', ix(0), iy(IH - 1), ix(IW - 1), iy(IH - 1))
R('tatami', ix(1), iy(4), ix(8), iy(14))
R('board', ix(10), iy(4), ix(24), iy(14)); R('board', ix(9), iy(12), ix(9), iy(14))
R('ceil', ix(17), iy(IH - 1), ix(18), iy(IH - 1), False); R('board', ix(17), iy(IH - 1), ix(18), iy(IH - 1))
s.marks['interior_entrance'] = (ix(17), iy(IH - 1))
# 북쪽 벽(3줄): 다다미 방 = 장지 + 도코노마, 대청 = 금 구름 맹장지
put(B.inner_wall(2, 'shoji'), ix(1), iy(3), block='all', name='inner_wall')
put(P.tokonoma(seed=1), ix(3), iy(3), block='all', name='tokonoma')
put(B.inner_wall(4, 'shoji'), ix(5), iy(3), block='all', name='inner_wall')
for x0 in (10, 13, 16, 19, 22):
    put(B.inner_wall(min(3, 25 - x0), 'fusuma', seed=x0), ix(x0), iy(3), block='all', name='inner_wall')
put(B.partition(8, 3), ix(9), iy(11), block=[(0, -j) for j in range(8)], name='partition')
for y in range(4, 12): s.block[iy(y), ix(9)] = True
# 다다미 방 기물
put(P.byobu(seed=1, w=3), ix(1), iy(5), block=[(0, 0), (1, 0), (2, 0)], name='byobu')
put(P.tansu(seed=1), ix(7), iy(5), block=[(0, 0), (1, 0)], name='tansu')
put(P.zen_table(seed=1), ix(3), iy(9), block=[(0, 0), (1, 0)], name='zen_table')
for (x, y) in ((3, 8), (4, 8), (3, 10), (4, 10)): s.decal(P.zabuton(seed=x + y), ix(x), iy(y), name='zabuton')
put(P.andon(seed=1), ix(1), iy(13), block=[(0, 0)], name='andon'); put(P.andon(seed=2), ix(8), iy(8), block=[(0, 0)], name='andon')
put(P.hibachi(seed=1), ix(6), iy(10), block='all', name='hibachi')
put(P.ikebana(seed=1), ix(8), iy(13), block='all', name='ikebana')
# 대청: 상단 다다미 단 + 갑옷 장식 + 칼걸이 + 기둥 + 등 + 화로 + 방석 줄
put(B.jodan(9), ix(13), iy(6), block=[(i, 0) for i in range(9)] if False else None, name='jodan', sorty=iy(4) * 16)
for i in range(9): s.block[iy(6), ix(13 + i)] = False
put(P.yoroi(seed=1), ix(10), iy(5), block=[(0, 0), (1, 0)], name='yoroi')
put(P.katana_kake(seed=1), ix(23), iy(5), block=[(0, 0), (1, 0)], name='katana_kake')
put(P.byobu(seed=4, w=3), ix(16), iy(5), block=None, name='byobu', sorty=iy(4) * 16 + 15)
s.decal(P.zabuton(seed=9, mat='gold'), ix(17), iy(5), name='zabuton')
for (x, y) in ((11, 13), (23, 13), (11, 9), (23, 9)): put(B.hashira(seed=x + y), ix(x), iy(y), block=[(0, 0)], name='hashira')
put(P.andon(seed=3), ix(13), iy(8), block=[(0, 0)], name='andon'); put(P.andon(seed=4), ix(21), iy(8), block=[(0, 0)], name='andon')
put(P.hibachi(seed=2), ix(15), iy(11), block='all', name='hibachi')
for x in (15, 16, 18, 19): s.decal(P.zabuton(seed=x), ix(x), iy(8), name='zabuton')
put(P.ikebana(seed=2), ix(24), iy(13), block='all', name='ikebana')
put(P.tansu(seed=2), ix(10), iy(14), block=[(0, 0), (1, 0)], name='tansu') if False else None

# ================================================================ 렌더 · 검사 · 내보내기
s.marks['south_entrance'] = (38, OH - 1)
img = s.render()
seen = s.bfs((38, OH - 1))
seen_in = s.bfs(s.marks['interior_entrance'])
reach = {k: (tuple(v) in (seen_in if v[0] >= OX else seen)) for k, v in s.marks.items()}
e = s.empty()
(wr, wx, wy), mean = s.worst(e, xmax=OW)
g = s.walk_grid()
print('reach', reach)
gout = g[:, :OW]; gin = g[:, OX:]
print('walkable out', int(gout.sum()), 'reached', len([c for c in seen if c[0] < OW]), '| in', int(gin.sum()), 'reached', len(seen_in))
print('empty window worst %.3f at (%d,%d), mean %.2f' % (wr, wx, wy, mean))
if __name__ == '__main__':
    os.makedirs(os.path.join(HERE, '_qa'), exist_ok=True)
    if '--quick' in sys.argv:
        img.convert('RGB').save(os.path.join(HERE, '_qa', 'map1x.png'))
    else:
        import ek_export
        n = ek_export.export(s, img, reach, ((wr, (wx, wy)), mean), seen, seen_in)
        print('parts', n)
