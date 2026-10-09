# 녹청 지붕 저택가 데모 맵 배치(48x40). 구역·앵커·동선은 plan.md. 결정적.
# 칠하는 순서(조수가 따라 할 순서): ① 맨 바탕 표본 → ② 오토타일 덩이 → ③ 건물·소품 → 쇠 난간·바닥 덧그림.
from vq_map import *

W, H = 48, 40

def blob(cx, cy, rx, ry, seed, jag=0.3, clip=None):
    out = []
    for y in range(H):
        for x in range(W):
            d = ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2
            if d < 1 + (vnoise(x, y, 2.2, seed) - .5) * jag * 2 and (clip is None or clip(x, y)): out.append((x, y))
    return out

def build():
    M = Map(W, H, 'ground-cobble'); R = M.rect
    # ================================================================ ① 맨 바탕 표본
    # 북쪽 집 줄 앞 보도(y12), 남쪽 집 줄 앞 보도(y32), 남쪽 끝 보도(y37), 분수 둘레 판석 고리
    M.paint('ground-flagstone', R(0, 12, 32, 12))
    M.paint('ground-flagstone', R(0, 32, 32, 32) + R(33, 34, 47, 34))
    M.paint('ground-flagstone', R(0, 37, 47, 37))
    M.paint('ground-flagstone', [(x, y) for (x, y) in R(12, 13, 20, 19) if ((x + .5 - 16) / 4.6) ** 2 + ((y + .5 - 16.3) / 3.6) ** 2 < 1])
    # 골목(젖은 각석): 북쪽 막다른 골목, 남쪽 집 사이 샛길 셋, 마차 차고 앞마당
    M.paint('ground-wetstone', R(9, 0, 10, 12) + R(5, 20, 6, 31) + R(14, 22, 15, 31) + R(26, 20, 27, 31))
    M.paint('ground-wetstone', R(0, 33, 6, 36))
    # 동쪽 정원(잔디) + 원형 판석 마당 + 남쪽 난간 너머 아래 단 잔디
    M.paint('ground-lawn', R(34, 0, 47, 32))
    M.paint('ground-lawn', R(0, 39, 47, 39))
    court = [(x, y) for (x, y) in R(36, 19, 46, 27) if ((x + .5 - 41) / 4.4) ** 2 + ((y + .5 - 23) / 3.4) ** 2 < 1]
    M.paint('ground-gravel', court)
    # ================================================================ ② 오토타일 덩이
    path = R(40, 14, 42, 18) + R(40, 26, 42, 32) + R(39, 33, 43, 33)
    path += [(x, y) for (x, y) in R(36, 18, 46, 28) if ((x + .5 - 41) / 5.2) ** 2 + ((y + .5 - 23) / 4.1) ** 2 < 1 and not (x, y) in court]
    M.auto_set('autotile-cobblepath', [(x, y) for (x, y) in path if M.base[y][x] == 'ground-lawn'])
    # 정원 회양목 울(길 양옆 줄, 출입구 비움)
    hedge = R(38, 15, 38, 18) + R(44, 15, 44, 18) + R(38, 27, 38, 31) + R(44, 27, 44, 31)
    M.auto_set('autotile-hedge', hedge)
    # 녹는 눈: 남쪽 집 줄 지붕 밑 그늘이 아닌 광장 남쪽 가장자리를 따라 길게(참고 그림), 정원 구석, 아래 단 잔디
    M.auto_set('autotile-slush', blob(4, 19.6, 4.2, 1.3, 11) + blob(30, 18.8, 3.0, 1.2, 12))
    M.auto_set('autotile-slush', blob(36, 30.5, 2.2, 2.0, 13, clip=lambda x, y: x >= 34 and y <= 32 and (x, y) not in path))
    M.auto_set('autotile-slush', blob(46, 4, 2.4, 3.5, 14, clip=lambda x, y: x >= 34))
    M.auto_set('autotile-slush', blob(12, 39.5, 6, 1.2, 15) + blob(30, 39.5, 5, 1.0, 16))
    # 젖은 자갈 웅덩이: 광장 낮은 곳·남쪽 거리·마차 차고 앞
    M.auto_set('autotile-puddle', blob(24.5, 16.5, 2.2, 1.3, 21) + blob(7.5, 15.2, 1.8, 1.1, 22))
    M.auto_set('autotile-puddle', blob(18, 34.8, 2.6, 1.2, 23) + blob(3, 35.3, 2.2, 1.0, 24))
    # 돌 틈 이끼: 북쪽 골목·샛길 그늘·우물 둘레·정원 북쪽 그늘
    M.auto_set('autotile-moss', blob(9.8, 4, 1.4, 3.2, 31) + blob(14.6, 25, 1.3, 3, 32) + blob(1.5, 14.5, 1.6, 1.6, 33))
    # ================================================================ ③ 건물(북쪽 줄 바닥 y11 — 광장을 향함)
    full = lambda name: pad16(KT.img(name)).height // 16 - 1        # 뒤가 막힌 줄은 지붕까지 막는다(지붕 칸은 막힘 대신 가림만 해도 되지만 뒤가 지도 밖·남의 집)
    M.put('townhouse-pair', 0, 11, block_rows=full('townhouse-pair'))
    M.put('townhouse-narrow', 6, 11, block_rows=full('townhouse-narrow'))
    M.put('mansion-grand', 11, 11, block_rows=full('mansion-grand'))
    M.put('house-gable-end', 19, 11, block_rows=full('house-gable-end'))
    M.put('shop-awning', 23, 11, block_rows=full('shop-awning'))
    M.put('townhouse-balcony', 28, 11, block_rows=full('townhouse-balcony'))
    # 남쪽 줄(바닥 y31 — 남쪽 거리를 향함, 지붕이 광장 남쪽 끝을 막는다). 사이 샛길 x5-6 · 14-15 · 26-27
    M.put('coach-house', 0, 31, block_rows=full('coach-house'))
    M.put('townhouse-narrow', 7, 31, block_rows=full('townhouse-narrow'))
    M.put('townhouse-balcony', 10, 31, block_rows=full('townhouse-balcony'), flip=False)
    M.put('house-gable-end', 16, 31, block_rows=full('house-gable-end'))
    M.put('townhouse-pair', 20, 31, block_rows=full('townhouse-pair'))
    M.put('shop-awning', 28, 31, block_rows=full('shop-awning'))
    # 정원 저택(동쪽, 바닥 y13 — 정원을 향함)
    M.put('mansion-turret', 38, 13, block_rows=full('mansion-turret'))
    # ================================================================ 쇠 난간(위층, 막힘)
    rail = R(33, 2, 33, 33) + [(x, 33) for x in range(33, 48) if x not in (40, 41, 42)]
    rail += [(x, 38) for x in range(0, 48)]
    M.auto_set('autotile-ironrail', rail)
    M.put('garden-gate-open', 40, 33, force=True, open_cols=(1,))
    # ================================================================ 광장 소품
    M.put('fountain', 14, 18)
    M.put('lamp-triple', 2, 14); M.put('lamp-triple', 30, 14); M.put('lamp-triple', 11, 19); M.put('lamp-triple', 21, 19)
    M.put('street-clock', 8, 13)
    M.put('notice-column', 20, 14)
    M.put('bench-iron', 12, 14); M.put('bench-iron', 18, 18)
    M.put('flower-cart', 24, 14)
    M.put('planter-box', 1, 13); M.put('planter-box', 29, 13); M.put('urn-planter', 10, 13)
    M.put('topiary-cone', 13, 12, force=True); M.put('topiary-cone', 16, 12, force=True)
    M.put('stoop-steps', 14, 12)
    M.put('well-stone', 1, 17)
    M.put('street-tree', 4, 17); M.put('street-tree', 25, 20)
    M.put('urn-planter', 13, 18); M.put('urn-planter', 17, 16)
    M.put('barrel', 22, 12, force=True); M.put('crates', 27, 12, force=True)
    M.put('carriage', 29, 22)
    M.put('handcart', 27, 18)
    M.put('barrel', 9, 2); M.put('barrel-stack', 9, 6); M.put('crates', 10, 9)
    M.put('snow-heap', 6, 19); M.put('snow-heap', 31, 18)
    M.put('bollard', 4, 16); M.put('bollard', 28, 16)
    M.put('manhole', 22, 17); M.put('puddle-small', 5, 13); M.put('leaves-wet', 19, 15); M.put('drain-grate', 32, 12)
    M.put('cellar-hatch', 25, 12)
    M.put('lamp-wall', 6, 9, force=True); M.put('lamp-wall', 22, 9, force=True)
    # ================================================================ 남쪽 거리
    M.put('carriage', 1, 34)
    M.put('trough', 5, 34)
    M.put('firewood', 3, 32, force=True)
    M.put('lamp-single', 9, 34); M.put('lamp-triple', 21, 34); M.put('lamp-single', 31, 34); M.put('lamp-single', 45, 36)
    M.put('bollard', 13, 33); M.put('bollard', 25, 33)
    M.put('planter-box', 29, 33); M.put('barrel', 27, 32); M.put('sacks', 28, 32, force=True)
    M.put('wheelbarrow', 36, 36)
    M.put('street-tree', 11, 37); M.put('street-tree', 23, 37); M.put('street-tree', 35, 37)
    M.put('snow-heap', 16, 36)
    M.put('manhole', 26, 35); M.put('leaves-wet', 12, 36); M.put('moss-crack', 7, 35); M.put('drain-grate', 18, 37)
    M.put('stoop-steps', 37, 33, force=True) if False else None
    # ================================================================ 정원(동쪽)
    M.put('topiary-cone', 40, 14, force=True); M.put('topiary-cone', 43, 14, force=True)
    M.put('monument-column', 40, 24)
    M.put('bench-iron', 36, 23); M.put('bench-iron', 44, 23)
    M.put('urn-planter', 37, 20); M.put('urn-planter', 45, 20); M.put('urn-planter', 37, 26); M.put('urn-planter', 45, 26)
    M.put('street-tree', 34, 18); M.put('street-tree', 45, 18); M.put('street-tree', 34, 30); M.put('street-tree', 45, 31)
    M.put('street-tree', 35, 4); M.put('street-tree', 44, 3); M.put('street-tree', 38, 2); M.put('street-tree', 36, 7); M.put('topiary-cone', 41, 4); M.put('bench-iron', 39, 6)
    M.put('hedge-short', 35, 13); M.put('hedge-short', 45, 13, force=True)
    M.put('wheelbarrow', 46, 28); M.put('leaves-wet', 39, 30); M.put('leaves-wet', 43, 20)
    # 표식(이벤트 자리)
    M.marks.update({'plaza_west': (0, 15), 'mansion_door': (14, 12), 'shop_door': (24, 12), 'fountain': (15, 19),
                    'coach_door': (2, 32), 'south_street_east': (47, 36), 'garden_gate': (41, 33), 'turret_door': (41, 14),
                    'monument': (41, 25), 'north_alley': (9, 1), 'cellar_hatch': (25, 12)})
    return M
