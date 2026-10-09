# 석조 유럽 시가지 데모 맵 배치(64x48). 구역·앵커·동선은 plan.md. 결정적.
# 칠하는 순서(조수가 따라 할 순서): ① 맨 바탕 표본(포석·판석·자갈·부채꼴 광장) → ② 오토타일(보도 연석 → 웅덩이·눈·낙엽 덩이)
#   → ③ 건물·소품 → 쇠 난간(위층 오토타일) → 바닥 덧그림.
# 길: 동서 큰길(y 21~25) + 그 가운데에서 남쪽으로 내려가는 남북 거리(x 31~34) = T자 교차로. 큰길 북쪽에 건물 줄, 남서쪽 광장, 남동쪽 안마당.
from eq_map import *

W, H = 64, 48

def blob(cx, cy, rx, ry, seed, jag=0.3):
    out = []
    for y in range(H):
        for x in range(W):
            d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2
            if d < 1 + (vnoise(x, y, 2.2, seed) - 0.5) * jag * 2: out.append((x, y))
    return out

def build():
    M = Map(W, H)
    R = M.rect
    # ================================================================ ① 맨 바탕 표본
    M.paint('ground-setts', R(0, 0, W - 1, H - 1))                       # 차도·골목 기본
    M.paint('ground-gravel', R(0, 0, W - 1, 3))                           # 북쪽 뒷골목(건물 뒤 안마당 길)
    M.paint('ground-flagstone', R(0, 28, 28, 47))                         # 남서 광장 보도
    M.paint('ground-fanplaza', R(4, 31, 25, 45))                          # 부채꼴 광장(분수 둘레)
    M.paint('ground-gravel', R(37, 28, 63, 37))                           # 남동 안마당(공원)
    M.paint('ground-wetsetts', R(31, 28, 34, 47))                         # 남북 거리: 건물 그늘이라 마르지 않은 젖은 포석
    # ================================================================ ② 오토타일
    for (x0, y0, x1, y1) in ((0, 18, W - 1, 20), (0, 26, 29, 27), (35, 26, W - 1, 27), (29, 28, 30, 47), (35, 28, 36, 47)):
        M.paint('ground-flagstone', R(x0, y0, x1, y1))                    # 보도 바탕 = 판석(연석은 오토타일)
    M.auto_set('autotile-sidewalk', R(0, 18, W - 1, 20))                  # 북쪽 보도(건물 앞 3칸)
    M.auto_set('autotile-sidewalk', R(0, 26, 29, 27))                     # 남쪽 보도(광장 쪽)
    M.auto_set('autotile-sidewalk', R(35, 26, W - 1, 27))
    M.auto_set('autotile-sidewalk', R(29, 28, 30, 47))                    # 남북 거리 서쪽 보도
    M.auto_set('autotile-sidewalk', R(35, 28, 36, 47))                    # 남북 거리 동쪽 보도
    pud = blob(9, 23, 3.6, 1.9, 21) + blob(51, 23.5, 3.2, 1.7, 23) + blob(32.5, 34, 1.8, 3.0, 25) + blob(19, 42, 2.6, 1.6, 27) + blob(30, 22.5, 2.0, 1.2, 29)
    M.auto_set('autotile-puddle', pud)
    M.auto_set('autotile-leaves', blob(41, 31, 3.2, 2.2, 31) + blob(58, 30, 3.0, 2.0, 33) + blob(26, 44, 2.2, 1.8, 37))
    M.auto_set('autotile-slush', blob(61, 35, 2.6, 2.0, 41) + blob(47, 35, 2.4, 1.4, 43) + blob(1, 45, 2.0, 1.6, 45) + blob(37, 21.5, 1.8, 1.0, 47))
    # 안마당 쇠 난간 둘레(대문 자리는 비운다)
    rail = [(x, 28) for x in range(38, 63) if x not in (49, 50, 51)] + [(38, y) for y in range(28, 37)] + [(62, y) for y in range(28, 38)] + [(x, 37) for x in range(38, 63)]
    M.auto_set('autotile-ironrail', rail)
    # 뒷골목 쇠 난간(건물 사이 틈 막기 아님 — 북쪽 끝 담)
    M.auto_set('autotile-ironrail', [(x, 0) for x in range(0, W) if x not in (30, 31, 32, 33)])
    # ================================================================ ③ 건물: 북쪽 줄(밑변 y=17, 큰길을 향함)
    north = [('cobbler', 0), ('inn', 3), ('townhouse-narrow', 9), ('cafe', 12), ('low-shop', 17), ('passage-arch', 21),
             ('hotel-wing', 24), ('grand-hotel', 28), ('hotel-wing', 36), ('bakery', 40), ('townhouse-corner', 44),
             ('apothecary', 48), ('townhouse-wide', 52), ('low-shop', 57), ('cobbler', 61)]
    for name, x in north:
        M.put(name, x, 17, flip=(name == 'hotel-wing' and x > 30), force=True)
    # 남동 줄(밑변 y=47, 남쪽 바깥 거리를 향함 — 남북 거리 동쪽 보도에 붙는다)
    for name, x in [('passage-arch', 37), ('warehouse', 40), ('townhouse-narrow', 46), ('townhouse-wide', 49), ('low-shop', 54), ('townhouse-corner', 58)]:
        M.put(name, x, 47, force=True)
    M.put('court-gate', 49, 28, force=True)
    M.marks.update({'west_entry': (0, 23), 'east_entry': (63, 23), 'south_entry': (32, 47), 'back_lane': (31, 2),
                    'hotel_door_w': (29, 18), 'hotel_door_e': (34, 18), 'inn_door': (5, 18), 'cafe_door': (16, 18),
                    'arch_north': (22, 16), 'arch_south': (38, 46), 'fountain': (13, 41), 'court_gate': (50, 29), 'courtyard': (44, 33)})
    # ================================================================ 소품: 보도·카페 테라스
    for name, x in (('parasol-table', 12), ('parasol-table-green', 14), ('cafe-table', 10)):
        pass
    M.put('parasol-table', 12, 20); M.put('cafe-table', 14, 20, force=True); M.put('chalkboard', 17, 19)
    M.put('tree-planter', 10, 20)
    M.put('sign-standing', 7, 19); M.put('barrel', 2, 19); M.put('barrel', 3, 19)
    M.put('flower-planter', 26, 19); M.put('flower-planter', 36, 19)
    for x in (8, 23, 39, 55): M.put('lamp-double', x, 20)
    M.put('lamp-single', 47, 20)
    for x in (19, 44, 60): M.put('tree-street', x, 20)
    M.put('crate', 41, 19); M.put('barrel', 42, 19)
    M.put('bench-iron', 51, 20)
    M.put('carriage', 25, 25); M.put('horse-trough', 22, 27); M.put('carriage', 47, 23)
    M.put('handcart', 13, 24); M.put('pigeons', 20, 22); M.put('papers', 41, 25); M.put('leaves-scatter', 58, 22); M.put('leaves-scatter', 18, 21)
    M.put('puddle-small', 37, 24); M.put('manhole', 4, 22); M.put('drain-grate', 26, 21); M.put('drain-grate', 57, 25)
    M.put('drain-grate', 6, 25); M.put('drain-grate', 47, 25); M.put('manhole', 40, 23); M.put('manhole', 32, 30)
    # 교차로 모퉁이
    M.put('advert-column', 28, 27); M.put('lamp-double', 35, 27, force=True); M.put('street-clock', 37, 27)
    M.put('bollard', 29, 26, force=True); M.put('bollard', 34, 26, force=True)
    # ================================================================ 남서 광장
    M.put('fountain', 12, 40)
    M.put('monument', 21, 37)
    for (x, y) in ((1, 32), (1, 37)): M.put('market-stall', x, y)
    M.put('crates-stack', 1, 41); M.put('handcart', 4, 30)
    M.put('flower-cart', 24, 31)
    M.put('tree-street', 2, 47); M.put('tree-street', 26, 47); M.put('tree-planter', 7, 30)
    M.put('bench-iron', 9, 46); M.put('bench-iron', 17, 46); M.put('lamp-single', 15, 46); M.put('lamp-single', 5, 46)
    for (x, y) in ((8, 36), (17, 36)): M.put('lamp-single', x, y)
    M.put('bench-iron', 10, 35); M.put('bench-iron', 14, 44); M.put('flower-planter', 6, 44); M.put('flower-planter', 20, 44)
    M.put('tree-planter', 22, 34); M.put('barrel', 4, 41); M.put('crate', 5, 41)
    M.put('parasol-table-green', 17, 31); M.put('cafe-chair', 20, 31)
    for (x, y) in ((8, 35), (17, 39), (23, 42)): M.put('pigeons', x, y)
    M.put('puddle-small', 6, 43); M.put('papers', 27, 35); M.put('leaves-scatter', 25, 41)
    # ================================================================ 남동 안마당(공원) — 자갈, 나무 덩이, 벤치, 펌프
    M.put('tree-street', 40, 33); M.put('tree-bare', 43, 31); M.put('tree-street', 56, 32); M.put('tree-bare', 59, 34)
    M.put('bench-iron', 45, 34); M.put('bench-iron', 52, 31); M.put('water-pump', 53, 35)
    M.put('tree-street', 47, 31); M.put('tree-planter', 59, 31); M.put('flower-planter', 41, 36); M.put('flower-planter', 55, 36)
    M.put('lamp-single', 50, 34); M.put('lamp-single', 39, 31); M.put('monument', 50, 32) if False else None
    M.put('snow-heap', 60, 36); M.put('barrels-stack', 39, 36, force=True); M.put('leaves-scatter', 48, 32); M.put('leaves-scatter', 55, 34)
    # 창고 앞(남북 거리 동쪽 보도)·뒷골목
    M.put('barrel-cart', 33, 45, force=True)
    M.put('snow-heap', 29, 36, force=True)
    for (n, x, y) in (('barrels-stack', 4, 3), ('crates-stack', 12, 3), ('water-pump', 20, 2), ('crate', 26, 3), ('barrel', 27, 3),
                      ('handcart', 44, 3), ('crates-stack', 52, 3), ('barrel', 58, 3), ('lamp-single', 36, 3)):
        M.put(n, x, y, force=True)
    M.put('cellar-hatch', 4, 19); M.put('stone-steps', 46, 19)
    M.put('drain-grate', 33, 41)
    return M
