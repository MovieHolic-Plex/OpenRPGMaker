# 목골 구시가 데모 맵(64x54) — 광장 하나, 거기서 뻗는 남북 벽돌 거리·동서 큰길, 북쪽 골목 거리·남쪽 뒷골목·맨 아래 텃밭 골목.
# 칠하는 순서(조수가 따라 할 순서): ① 맨 바탕 표본 → ② 오토타일 덩이(벽돌 거리·이끼·웅덩이·낙엽·꽃밭) → ③ 건물·소품 → ④ 벽 덧그림(간판·배수관).
from eq_map import *

W_, H_ = 64, 54
# 건물 줄: (이름, 왼쪽 x) — 바닥 y 는 줄마다 같다. 이웃 집과 옆벽을 맞대 촘촘히.
ROW1_Y, ROW1 = 13, [('house-gable-wide', 0), ('house-eave-dormer', 6), ('house-gable-narrow', 12), ('house-gable-tall', 15), ('house-gable-narrow', 19),
                    ('inn', 42), ('bakery', 49), ('house-gable-tall', 54), ('house-eave-dormer', 58)]
ROW2_Y, ROW2 = 26, [('house-crossgable', 0), ('house-gable-tall', 7), ('house-gable-narrow', 11), ('house-gable-oriel', 15),
                    ('house-gable-wide', 44), ('house-eave-jetty', 50), ('house-gable-tall', 55), ('house-gable-oriel', 59)]
ROW3_Y, ROW3 = 40, [('house-eave-dormer', 0), ('bakery', 6), ('house-crossgable', 13), ('house-eave-jetty', 20), ('smithy', 25),
                    ('house-eave-jetty', 34), ('house-eave-dormer', 39), ('house-crossgable', 47), ('cottage-low', 54), ('house-eave-jetty', 58)]
ROW4_Y, ROW4 = 52, [('cottage-low', 4), ('cottage-low', 20), ('cottage-low', 40), ('cottage-low', 56)]

def build():
    M = Map(W_, H_, 'ground-cobble')
    R = M.rect
    # ---------------- ① 맨 바탕
    M.paint('ground-setts', R(22, 19, 41, 26))                                                  # 광장
    M.paint('ground-dirt', R(0, 0, 21, 1) + R(42, 0, 63, 1))                                    # 북쪽 끝 뒷길(맵 가장자리)
    M.paint('ground-dirt', R(0, 41, 63, 42) + R(11, 31, 12, 40) + R(45, 31, 46, 40) + R(0, 53, 63, 53))   # 뒷골목·샛길·맨 아래 골목
    M.paint('ground-lawn', R(22, 0, 29, 10) + R(0, 43, 29, 52) + R(34, 43, 63, 52))             # 성당 뒤뜰·남쪽 텃밭 정원
    M.paint('ground-brickpave', R(1, 28, 62, 29) + R(31, 1, 32, 17) + R(31, 32, 32, 52))       # 벽돌 거리 속(이웃 8칸이 모두 길인 칸)
    # ---------------- ② 오토타일 덩이
    M.auto_set('autotile-brickstreet', R(0, 27, 63, 30) + R(30, 0, 33, 18) + R(30, 31, 33, 53))
    M.auto_set('autotile-mossy', [(22, 19), (23, 19), (22, 20), (23, 20), (24, 19), (22, 21), (40, 19), (41, 19), (41, 20), (40, 20), (41, 21), (39, 19),
                                  (22, 26), (23, 26), (34, 6), (35, 6), (35, 5)])
    M.auto_set('autotile-puddle', [(9, 27), (10, 27), (10, 28), (11, 27), (52, 29), (53, 29), (53, 30), (54, 29), (31, 45), (32, 45), (32, 46),
                                   (19, 41), (20, 41), (20, 42), (21, 42), (57, 41), (58, 42), (57, 42)])
    M.auto_set('autotile-flowerbed', [(2, 45), (3, 45), (4, 45), (2, 46), (3, 46), (3, 47), (14, 45), (15, 45), (16, 45), (15, 46), (16, 46), (17, 46), (16, 47),
                                      (36, 45), (37, 45), (37, 46), (38, 46), (38, 45), (50, 45), (51, 45), (52, 45), (51, 46), (52, 46), (53, 46), (51, 47),
                                      (58, 45), (59, 45), (59, 46), (60, 46), (24, 2), (25, 2), (25, 3), (26, 3),
                                      (42, 46), (43, 46), (42, 47), (43, 47), (41, 47)])
    M.auto_set('autotile-leaves', [(26, 20), (27, 20), (26, 21), (38, 26), (37, 26), (2, 31), (3, 31), (3, 32), (42, 31), (43, 31), (42, 32),
                                   (26, 46), (27, 46), (27, 47), (11, 47), (12, 47)])
    # ---------------- ③ 건물
    for rowy, row in ((ROW1_Y, ROW1), (ROW2_Y, ROW2), (ROW3_Y, ROW3), (ROW4_Y, ROW4)):
        for (n, x) in row:
            M.put(n, x, rowy, force=True)
            d = KT.binfo(n).get('door')
            if d is not None: M.marks[f'door_{n}_{x}_{rowy}'] = (x + d, rowy + 1)       # 문 앞 칸
    M.put('archway', 30, 12, force=True)                                                       # 남북 거리 북쪽 끝 다리 방 아치
    M.put('chapel', 22, 18, force=True); M.put('guild-hall', 34, 18, force=True)               # 광장 북쪽 앵커 둘
    M.marks['chapel_door'] = (27, 19); M.marks['guild_door'] = (37, 19)
    M.marks['south_lane'] = (31, 53); M.marks['north_arch'] = (31, 0); M.marks['fountain_side'] = (29, 23)
    P = lambda n, x, y, **kw: M.put(n, x, y, **kw)
    # 광장(분수·좌판·벤치·가로등·나무)
    P('fountain', 30, 23)
    P('stall-red', 23, 25); P('stall-blue', 26, 26); P('stall-green', 37, 24)
    P('bench', 28, 21); P('bench', 33, 21); P('bench', 34, 25)
    P('lamp-double', 24, 22); P('lamp-double', 38, 21)
    P('street-tree', 39, 26); P('street-tree', 22, 22)
    P('flower-cart', 35, 26); P('crates', 29, 26); P('noticeboard', 25, 21); P('banner-pole', 32, 19)
    P('bollard', 21, 26); P('bollard', 42, 26)
    # 큰길 남쪽 보도(y31~32) — 3열 지붕 꼭대기가 y33 이하인 자리만(내밀기 집 지붕 앞은 비운다)
    for (n, x, y) in (('street-tree', 1, 32), ('lamp-single', 5, 31), ('parasol-table', 7, 32), ('lamp-single', 13, 31), ('street-tree', 15, 32),
                      ('barrels', 26, 32), ('lamp-single', 29, 31), ('lamp-single', 40, 31), ('street-tree', 41, 32), ('bench', 48, 32),
                      ('street-tree', 50, 32), ('lamp-single', 55, 31), ('flower-tub-red', 56, 32), ('signpost', 34, 31)):
        P(n, x, y)
    # 북쪽 골목 거리(y14~15) — 문 앞 칸은 비운다
    for (n, x, y) in (('lamp-crook', 5, 15), ('flower-tub-yellow', 11, 14), ('rain-barrel', 14, 26), ('rain-barrel', 14, 14), ('barrels', 17, 15),
                      ('table-mugs', 45, 15), ('flower-tub-red', 48, 14), ('sacks', 53, 14), ('lamp-crook', 57, 15), ('handcart', 61, 15)):
        P(n, x, y)
    # 성당 뒤뜰·길드 마당(북쪽 끝)
    for (n, x, y) in (('tree-round', 22, 4), ('tree-round', 26, 5), ('shrub', 28, 2), ('shrub', 24, 1),
                      ('wagon', 35, 3), ('goods-pile', 38, 5), ('trough', 39, 2), ('barrels', 34, 6)):
        P(n, x, y)
    # 뒷골목·대장간 마당
    for (n, x, y) in (('woodpile', 24, 42), ('anvil', 29, 42), ('rain-barrel', 4, 42), ('crates', 8, 42), ('wagon', 15, 42),
                      ('goods-pile', 36, 42), ('rain-barrel', 44, 41), ('handcart', 50, 42), ('barrels', 61, 42)):
        P(n, x, y)
    # 텃밭 정원: 담(y43, 틈 = 문) + 나무 덩이·덤불·우물·수레
    for (n, x) in (('wall-pillar', 0), ('brick-wall', 1), ('wall-pillar', 4), ('brick-wall', 7), ('brick-wall', 10), ('wall-pillar', 13),
                   ('wall-pillar', 17), ('brick-wall', 18), ('brick-wall', 21), ('wall-pillar', 24),
                   ('wall-pillar', 34), ('brick-wall', 35), ('wall-pillar', 38), ('brick-wall', 41), ('brick-wall', 44), ('wall-pillar', 47),
                   ('wall-pillar', 51), ('brick-wall', 52), ('brick-wall', 55), ('wall-pillar', 58), ('brick-wall', 60)):
        P(n, x, 43)
    for (n, x, y) in (('tree-round', 9, 47), ('tree-round', 11, 50), ('tree-round', 26, 48), ('tree-round', 46, 47), ('tree-round', 61, 49),
                      ('shrub', 18, 48), ('shrub', 0, 48), ('shrub', 53, 48), ('shrub', 36, 49), ('shrub', 28, 51),
                      ('well-roofed', 13, 49), ('veg-cart', 25, 51), ('sacks', 17, 51), ('flower-tub-red', 39, 51), ('crate-apples', 48, 51),
                      ('flower-tub-yellow', 55, 51), ('sacks', 62, 52), ('tree-round', 49, 51), ('shrub', 44, 47), ('woodpile', 52, 52),
                      ('tree-round', 1, 51), ('shrub', 23, 46), ('shrub', 57, 48)):
        P(n, x, y)
    # ---------------- ④ 벽 덧그림(간판·배수관) — 건물 위에 그린다(막힘 없음)
    for (n, x, y) in (('wall-sign-key', 4, 25), ('wall-sign-herb', 9, 25), ('wall-sign-cloth', 47, 25), ('wall-sign-boot', 3, 39),
                      ('wall-sign-mug', 14, 39), ('wall-sign-herb', 48, 39), ('wall-sign-key', 3, 12)):
        M.put(n, x, y, force=True, overlay=True)
    for (x, y) in ((6, 13), (15, 13), (19, 13), (54, 13), (58, 13), (7, 26), (11, 26), (55, 26), (59, 26), (13, 40), (20, 40), (25, 40), (39, 40), (58, 40)):
        M.put('downpipe', x, y, force=True, overlay=True, dx=-8)
    return M
