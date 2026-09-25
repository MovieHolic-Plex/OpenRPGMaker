# Rasak 마을·실내 완성 예제 명세 — compose_examples.py 가 읽는다.
# kind 번호·물체 id 는 names.json(rasak_town·rasak_interior) 기준. 조수 참고문서의 "완성 예제 배열"이 이 맵에서 잘려 나간다.
# 원칙(참고문서 규칙과 같다): 바탕은 A2 한 가지 + 얼룩, 길은 끊기지 않게 1~2칸 굽이, 물가·숲은 들쭉날쭉, 집은 A3 지붕+벽,
# 문·창은 벽 칸 위 3층, 굴뚝은 지붕 위 4층, 벽·지붕 오른쪽 칸 그림자(왼쪽 반 = 5), 소품은 덩이로.
from compose_examples import Canvas, rect, line_h, line_v

EXAMPLES = {}


def example(fn):
    EXAMPLES[fn.__name__] = fn
    return fn


def blob(cx, cy, rows):
    """들쭉날쭉한 덩이: rows = [(x 시작 오프셋, 길이), ...] 위에서 아래로."""
    return [(cx + dx + i, cy + j) for j, (dx, n) in enumerate(rows) for i in range(n)]


def path(points, width=1):
    """꺾은선 길(칸 단위). points 사이를 가로→세로 순으로 잇는다."""
    cells = []
    for (x0, y0), (x1, y1) in zip(points, points[1:]):
        for x in range(min(x0, x1), max(x0, x1) + 1):
            for k in range(width):
                cells.append((x, y0 + k))
        for y in range(min(y0, y1), max(y0, y1) + 1):
            for k in range(width):
                cells.append((x1 + k, y))
    return cells


def house(c, x, y, w, roof, wall, roof_h=3, wall_h=2, door=None, windows=(), chimney=None, dormer=None):
    """A3 집 한 채 + 문·창(3층)·굴뚝(4층)·오른쪽 그림자. door/windows 는 집 왼쪽에서 센 x 오프셋."""
    c.house(x, y, w, roof_h, wall_h, roof, wall)
    wy = y + roof_h
    if door is not None:
        c.obj('building_door_arched_plank', x + door, wy)
    for wx in windows:
        c.obj('building_window_wood_grid', x + wx, wy)
    if chimney is not None:
        c.obj('building_chimney_stone', x + chimney, y)
    if dormer is not None:
        c.obj(dormer[0], x + dormer[1], y + 1)
    for j in range(roof_h + wall_h):
        c.shadow(x + w, y + j, 5)


def tree(c, oid, x, y):
    c.obj(oid, x, y)


@example
def ex_village(ctx):
    c = Canvas(ctx, 'rasak_town', 30, 22, 'ex_village', 'Rasak 예제 · 작은 마을')
    c.kind(1, 'A2:0', rect(0, 0, 30, 22))                       # 바탕 밝은 풀
    # 짙은 풀은 나무 덩이 밑에만(숲 바닥) — 넓은 네모 얼룩은 계단처럼 보여 쓰지 않는다
    c.kind(1, 'A2:8', blob(0, 8, [(0, 2), (0, 3), (0, 3), (0, 4), (0, 3), (0, 3), (0, 2)]))
    c.kind(1, 'A2:8', blob(25, 16, [(2, 3), (1, 5), (0, 5), (0, 5), (1, 4), (2, 3)]))
    # 흙길: 아래 입구 → 광장 → 양쪽 집으로 굽는 1~2칸 길
    c.kind(1, 'A2:1', path([(13, 21), (13, 15), (12, 15), (12, 10)], 2))
    c.kind(1, 'A2:1', blob(10, 8, [(1, 7), (0, 9), (0, 9), (1, 7)]))       # 우물 앞 광장(모서리 깎음)
    c.kind(1, 'A2:1', path([(10, 9), (6, 9), (6, 7)]))                     # 왼쪽 집 문으로
    c.kind(1, 'A2:1', path([(18, 9), (23, 9), (23, 8)]))                   # 오른쪽 집 문으로
    c.kind(1, 'A2:1', path([(13, 15), (7, 15), (7, 17)]))                  # 아래 집으로
    # 연못(들쭉날쭉) + 물 장식
    c.kind(1, 'A1:0', blob(21, 13, [(1, 4), (0, 6), (0, 7), (1, 5)]))
    c.kind(2, 'A1:2', [(23, 14), (24, 14)])
    # 집 세 채
    house(c, 3, 2, 6, 'A3:0', 'A3:10', door=3, windows=(1, 5), chimney=1)
    house(c, 20, 3, 7, 'A3:16', 'A3:25', door=3, windows=(1, 5), chimney=5)
    house(c, 4, 16, 5, 'A3:4', 'A3:12', roof_h=2, door=3, windows=(1,))
    # 우물·가로등·소품 덩이
    c.obj('town_well_roofed', 13, 7)
    c.obj('town_street_lamp', 11, 12)
    c.obj('town_street_lamp', 16, 7)
    c.obj('town_bin_firewood', 9, 5)
    c.obj('town_laundry_rack', 10, 4)
    c.obj('town_stump_axe', 11, 5)
    # 밭(갈색 흙) + 작물 줄 + 울타리
    c.kind(1, 'A2:16', rect(15, 16, 6, 4))
    for i in range(6):
        c.obj('crops_carrot_grown' if i % 2 else 'crops_pumpkin_grown', 15 + i, 17)
        c.obj('crops_blade_crop_grown', 15 + i, 19)
    c.obj('town_wattle_fence_h4', 15, 15)
    c.obj('town_wattle_fence_h2', 19, 15)
    # 꽃·덤불(집 앞 덩이)
    for x, oid in [(2, 'garden_bush_roses'), (2, 'garden_bush_green')]:
        pass
    c.obj('garden_bush_roses', 2, 6)
    c.obj('garden_bush_green', 2, 5)
    c.obj('garden_bush_green', 9, 6)
    c.obj('garden_flowers_red_row', 20, 8)
    c.obj('garden_flowerbox_blue', 27, 7)
    c.obj('garden_flowerbox_red', 3, 17)
    c.obj('garden_potted_roses', 9, 19)
    # 집 옆 살림 덩이(술통·상자·자루) — 오른쪽 집 벽 옆
    for oid, x, y in [('tavern_barrel_upright', 19, 7), ('town_bin_crate', 19, 6), ('market_sacks_pile', 18, 7)]:
        try:
            c.obj(oid, x, y)
        except KeyError:
            pass
    c.obj('market_cart_empty_handle', 16, 11)
    # 나무 덩이(가장자리)
    for oid, x, y in [('trees_summer_tall_leafy', 0, 8), ('trees_summer_small_leafy_a', 2, 10), ('trees_summer_birch_leafy', 0, 12),
                      ('trees_summer_gnarled_leafy', 2, 12), ('trees_summer_small_leafy_b', 0, 15),
                      ('trees_summer_fir_big', 27, 0), ('trees_summer_fir_small', 25, 0), ('trees_summer_cypress', 18, 1), ('trees_summer_cypress', 10, 0),
                      ('trees_summer_small_leafy_b', 27, 9), ('trees_summer_tall_leafy', 28, 11),
                      ('trees_summer_gnarled_leafy', 26, 16), ('trees_summer_fir_big', 28, 17), ('trees_summer_small_leafy_a', 25, 19),
                      ('trees_summer_birch_leafy', 28, 20), ('trees_summer_small_leafy_c', 0, 19), ('trees_summer_sapling_leafy', 2, 20),
                      ('trees_summer_sapling_leafy', 22, 11), ('trees_summer_fir_seedling', 1, 1), ('trees_summer_small_leafy_a', 0, 0)]:
        tree(c, oid, x, y)
    return c


def stall(c, x, y, body, awning='market_awning_striped'):
    """시장 좌판: 차양(3×2)을 위에, 몸체(3×2)를 아래에 — 차양 아랫줄과 몸체 윗줄이 붙는다."""
    c.obj(awning, x, y)
    c.obj(body, x, y + 2)


@example
def ex_city(ctx):
    c = Canvas(ctx, 'rasak_town', 32, 24, 'ex_city', 'Rasak 예제 · 도시 광장')
    c.kind(1, 'A2:0', rect(0, 0, 32, 24))                       # 둘레 풀
    c.kind(1, 'A2:19', rect(0, 9, 32, 7))                       # 동서 큰길(회색 막돌 포장)
    c.kind(1, 'A2:19', rect(13, 0, 6, 24))                      # 남북 큰길
    c.kind(1, 'A2:11', blob(9, 7, [(2, 10), (1, 12), (0, 14), (0, 14), (0, 14), (0, 14), (0, 14), (1, 12), (2, 10)]))  # 광장(회색 판석)
    c.kind(2, 'A2:29', rect(12, 9, 8, 5))                       # 광장 가운데 돌 테두리 선(2층)
    # 석조 건물 넷(지붕 3 + 벽 3 = 2층 집 느낌)
    house(c, 1, 1, 8, 'A3:19', 'A3:27', roof_h=3, wall_h=3, door=4, windows=(1, 2, 6, 7), chimney=2)
    house(c, 22, 1, 8, 'A3:1', 'A3:28', roof_h=3, wall_h=3, door=3, windows=(1, 5, 6), chimney=6)
    house(c, 1, 17, 7, 'A3:5', 'A3:9', roof_h=3, wall_h=2, door=3, windows=(1, 5))
    house(c, 23, 17, 7, 'A3:2', 'A3:13', roof_h=3, wall_h=2, door=3, windows=(1, 5), chimney=1)
    # 광장 가운데 기사 석상 + 둘레 화단·가로등
    c.obj('structure_statue_armored_knight', 16, 10)
    c.obj('garden_planter_stone_long', 10, 8)
    c.obj('garden_planter_stone_long', 19, 8)
    c.obj('garden_flowers_red_row', 10, 8, layer=4)
    c.obj('garden_flowers_yellow_row', 19, 8, layer=4)
    for x, y in [(12, 7), (19, 7), (12, 14), (19, 14)]:
        c.obj('town_street_lamp', x, y - 2)
    # 시장 좌판 줄(광장 아래쪽)
    stall(c, 9, 15, 'market_stall_body_weapons')
    stall(c, 20, 15, 'market_stall_bay_alchemy')
    c.obj('market_crates_pile_mixed', 12, 17)
    c.obj('market_crates_pile_bread', 18, 17)
    c.obj('market_basket_oranges', 23, 19)
    c.obj('market_cart_empty_handle', 5, 13)
    c.obj('town_log_bench', 11, 12)
    c.obj('town_log_bench', 19, 12)
    # 가로수·덤불(풀밭 가장자리)
    for oid, x, y in [('trees_summer_small_leafy_a', 9, 1), ('trees_summer_cypress', 11, 2), ('trees_summer_cypress', 20, 2),
                      ('trees_summer_small_leafy_b', 20, 5), ('trees_summer_small_leafy_a', 9, 20), ('trees_summer_cypress', 11, 21),
                      ('trees_summer_cypress', 20, 21), ('trees_summer_small_leafy_b', 20, 19)]:
        tree(c, oid, x, y)
    for x, y in [(0, 7), (31, 7), (0, 16), (31, 16), (8, 22), (21, 22)]:
        c.obj('garden_bush_green', x, y)
    return c


def room(c, x0, y0, w, h, top, wall, floor, wall_h=2, door=None):
    """실내 방 하나: 둘레 A4 윗면(천장) 1칸, 북쪽 벽면 wall_h 칸, 안쪽 바닥. door = 아래 테두리 뚫을 x."""
    c.kind(1, top, rect(x0, y0, w, h))
    c.kind(1, wall, rect(x0 + 1, y0 + 1, w - 2, wall_h))
    c.kind(1, floor, rect(x0 + 1, y0 + 1 + wall_h, w - 2, h - 2 - wall_h))
    if door is not None:
        c.kind(1, floor, [(door, y0 + h - 1)])
    for y in range(y0 + 1 + wall_h, y0 + h - 1):
        c.shadow(x0 + 1, y, 5)                                   # 서쪽 벽(천장) 오른쪽 바닥 칸 그림자 — 벽면 칸에는 안 깐다


@example
def ex_house_room(ctx):
    c = Canvas(ctx, 'rasak_interior', 16, 12, 'ex_house_room', 'Rasak 예제 · 민가 방')
    room(c, 0, 0, 16, 12, 'A4:0', 'A4:27', 'A2:0', door=7)
    c.kind(1, 'A2:17', rect(5, 6, 5, 3))                        # 붉은 양탄자(1층 바닥으로 깐다)
    c.obj('living_window_red_curtain', 3, 1)                     # 벽걸이 창(벽면 두 줄)
    c.obj('living_window_red_curtain', 11, 1)
    c.obj('living_fireplace_stone', 6, 2)                        # 벽난로(윗줄은 벽, 아랫줄은 바닥)
    c.obj('tavern_bed_red', 13, 3)
    c.obj('storage_wardrobe_light', 12, 2)
    c.obj('living_bookcase_wide', 1, 2)
    c.obj('living_table_cloth', 6, 7)
    c.obj('house_place_setting', 6, 7)                           # 탁상 소품(4층)
    c.obj('tavern_wineglass', 7, 7)
    c.obj('living_chair_down', 6, 6)
    c.obj('living_chair_down', 7, 6)
    c.obj('living_chair_up', 6, 8)
    c.obj('living_chair_up', 7, 8)
    c.obj('living_plant_wicker', 1, 8)
    c.obj('living_hat_stand_straw', 10, 10)
    c.obj('storage_low_cabinet_doors_light', 14, 6)
    c.obj('living_flowerpot_orange', 14, 5, layer=4)
    return c


@example
def ex_tavern(ctx):
    c = Canvas(ctx, 'rasak_interior', 24, 16, 'ex_tavern', 'Rasak 예제 · 여관 1층')
    room(c, 0, 0, 24, 16, 'A4:3', 'A4:24', 'A2:10', door=11)
    c.kind(1, 'A2:0', rect(1, 3, 7, 5))                          # 난롯가 마루(헤링본)
    c.kind(1, 'A2:7', rect(15, 5, 7, 1))                         # 카운터(탁자형 자동타일 가로)
    c.kind(1, 'A2:7', rect(15, 6, 1, 2))
    c.kind(2, 'A2:12', rect(9, 12, 5, 3))                        # 입구 앞 무늬 깔개(2층)
    c.obj('living_fireplace_stone', 2, 2)
    c.obj('living_window_red_curtain', 7, 1)
    c.obj('living_window_red_curtain', 12, 1)
    c.obj('tavern_wall_shelf_pantry', 16, 1)                     # 카운터 뒤 벽걸이 선반
    for x in (16, 18, 20):
        c.obj('tavern_barrel_upright', x, 3)
    c.obj('tavern_barrel_lying_pair', 22, 3)
    c.obj('tavern_wineglasses_row', 17, 5)
    c.obj('tavern_setting_board_mug', 19, 5)
    c.obj('living_stairs_long', 21, 11)
    c.obj('tavern_long_table_two_benches', 2, 9)
    c.obj('tavern_long_table_two_benches', 7, 9)
    c.obj('tavern_long_table_two_benches', 15, 9)
    c.obj('tavern_setting_board_mug', 3, 10)
    c.obj('tavern_tumblers_scatter', 8, 10)
    c.obj('tavern_wineglass', 16, 10)
    c.obj('living_table_round', 5, 5)
    c.obj('living_stool_round', 4, 5)
    c.obj('living_stool_round', 6, 5)
    c.obj('living_plant_palm', 1, 12)
    c.obj('living_plant_bush', 22, 8)
    return c
