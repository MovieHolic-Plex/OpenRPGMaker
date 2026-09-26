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


def house(c, x, y, w, roof, wall, roof_h=3, wall_h=2, door=None, windows=(), chimney=None, gable=None, upper_windows=()):
    """A3 집 한 채 + 문·창(3층)·굴뚝(4층)·오른쪽 그림자. door/windows 는 집 왼쪽에서 센 x 오프셋.
    문(1×2)은 벽 맨 아랫줄에 밑이 닿는다(벽이 3줄이면 윗줄은 2층 창 자리 — upper_windows).
    창은 민벽 칸에만: 양끝 모서리 칸·문 칸·문 바로 옆 칸 금지(사용자 집 외형 규칙). gable = (물체 id, x 오프셋) 박공."""
    c.house(x, y, w, roof_h, wall_h, roof, wall)
    base = y + roof_h + wall_h - 1                      # 벽 맨 아랫줄
    for wx in list(windows) + list(upper_windows):
        bad = wx <= 0 or wx >= w - 1 or (door is not None and abs(wx - door) <= 1 and wx not in upper_windows)
        if bad:
            c.errors.append(f'house@({x},{y}): 창 오프셋 {wx} 는 민벽이 아님(끝·문·문 옆)')
    if door is not None:
        c.obj('building_door_arched_plank', x + door, base - 1)
    for wx in windows:
        c.obj('building_window_wood_grid', x + wx, base)
    for wx in upper_windows:
        c.obj('building_window_wood_grid', x + wx, y + roof_h)
    if chimney is not None:
        c.obj('building_chimney_stone', x + chimney, y)
    if gable is not None:
        c.obj(gable[0], x + gable[1], y)
    for j in range(roof_h + wall_h):
        c.shadow(x + w, y + j, 5)


BIG_TREES = ['trees_summer_oak_big', 'trees_summer_oak_big_b', 'trees_summer_fir_pair_a', 'trees_summer_fir_pair_b']
MID_TREES = ['trees_summer_tall_leafy', 'trees_summer_gnarled_leafy', 'trees_summer_fir_big', 'trees_summer_round_small',
             'trees_summer_birch_leafy_b', 'trees_summer_small_leafy_b', 'trees_summer_small_leafy_a']


def forest(c, cells, seed, edge=('garden_bush_green', 'garden_bush_green', 'garden_bush_roses')):
    """숲 벽: 큰 나무(4×4·3×4)를 빈틈없이 채우고(3층), 그 사이를 반 칸씩 어긋난 나무로 한 번 더 덮는다(4층 — 겹쳐 그림).
    수관까지 숲 칸 안에만 심는다(마을 물체를 덮지 않음). 가장자리 빈 칸만 초록 덤불로 마감한다.
    짙은 풀(A2:8) 네모 바닥·잎 없는 어린나무 무더기는 쓰지 않는다 — 계단 얼룩, 죽은 숲처럼 보인다."""
    import random
    rnd = random.Random(seed)
    cells = set(cells)
    taken = {3: set(), 4: set()}

    def try_place(oid, x, y, layer):
        w, h = c.ctx.object(c.b, oid)['size']
        foot = {(x + i, y + j) for j in range(h) for i in range(w)}
        if not foot <= cells or foot & taken[layer]:
            return False
        c.obj(oid, x, y, layer=layer, over=True)
        taken[layer] |= foot
        return True

    xs = [x for x, _ in cells]; ys = [y for _, y in cells]
    for layer, pool, step, off in ((3, BIG_TREES + MID_TREES[:2], 1, 0), (4, MID_TREES + BIG_TREES[:2], 1, 1)):
        for y in range(min(ys), max(ys) + 1, step):
            for x in range(min(xs) - off, max(xs) + 1, step):
                big = [o for o in pool if o in BIG_TREES]
                for oid in rnd.sample(big, len(big)) + rnd.sample([o for o in pool if o not in big], len(pool) - len(big)):
                    if try_place(oid, x + off, y + off, layer):
                        break
    covered = taken[3] | taken[4]
    for (x, y) in sorted(cells - covered):
        near_village = any((x + dx, y + dy) not in cells for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        if near_village and c.L[3][y * c.w + x] is None:
            c.obj(edge[rnd.randrange(len(edge))], x, y)


@example
def ex_village(ctx):
    """시골 마을 34×24 — 숲 벽(위·왼쪽·오른아래) · 집 넷(크기·지붕·높이 다름) · 문마다 끝나는 흙길 · 울타리 두른 밭 · 들쭉날쭉 연못.
    제작자 p01·p05 처럼 빈 풀밭이 없다: 풀밭 변형 얼룩·낙엽·디딤돌·꽃·덤불이 1~2칸마다 있다. 좌우 대칭 금지."""
    c = Canvas(ctx, 'rasak_town', 34, 24, 'ex_village', 'Rasak 예제 · 숲가 마을')
    c.kind(1, 'A2:0', rect(0, 0, 34, 24))
    # 숲 벽: 위 띠(두께 3~4, 들쭉날쭉) · 왼쪽 띠 · 오른아래 덩이
    top = [(x, y) for x in range(34) for y in range(0, 4 + (x * 7 % 5 == 0) + (x % 9 == 4)) if not (16 <= x <= 25 and y >= 3)]
    left = [(x, y) for y in range(3, 15) for x in range(0, 4 + (y % 5 == 1))]
    corner = [(x, y) for y in range(17, 24) for x in range(27 + (y < 19) + (y == 17), 34)]
    forest(c, top + left + corner, seed=7)
    # 흙길: 아래 가장자리(마을 입구) → 우물 마당 → 집마다 문 바로 아래 칸에서 끝
    c.kind(1, 'A2:1', path([(15, 23), (15, 16), (14, 16), (14, 14)], 2))
    c.kind(1, 'A2:1', blob(12, 11, [(1, 6), (0, 8), (0, 8), (1, 6)]))           # 우물 마당
    c.kind(1, 'A2:1', path([(12, 12), (9, 12), (9, 10), (7, 10)]))              # 집 A 문(7,9) 아래
    c.kind(1, 'A2:1', path([(17, 11), (17, 10), (22, 10), (22, 9)]))            # 집 B 문(22,8) 아래
    c.kind(1, 'A2:1', path([(20, 13), (25, 13), (25, 12), (29, 12)]))           # 집 C 문(29,11) 아래
    c.kind(1, 'A2:1', path([(16, 18), (22, 18), (22, 21)]))                     # 집 D 문(22,20) 아래
    # 집 넷
    house(c, 6, 5, 7, 'A3:0', 'A3:10', door=1, windows=(3, 5), chimney=5, gable=('building_gable_red_window', 3))
    house(c, 17, 3, 8, 'A3:19', 'A3:27', roof_h=3, wall_h=3, door=5, windows=(1, 3), upper_windows=(1, 3, 6), chimney=2)
    house(c, 26, 8, 6, 'A3:4', 'A3:12', roof_h=2, wall_h=2, door=3, windows=(1,))
    house(c, 19, 16, 7, 'A3:16', 'A3:25', roof_h=3, wall_h=2, door=3, windows=(1, 5))
    # 우물 마당: 지붕 우물 · 긴 의자 · 게시판 · 물통
    c.obj('town_well_roofed', 14, 10)
    c.obj('town_log_bench', 17, 13)
    c.obj('town_notice_board', 5, 12)
    c.obj('town_barrel_water', 13, 12)
    c.obj('town_signpost', 17, 21)
    c.obj('town_street_lamp', 13, 17)
    # 집 A(대장·장작): 장작 칸 · 도끼 그루터기 · 톱밥 · 빨래 · 꽃상자
    c.obj('town_bin_firewood', 3 + 1, 8)
    c.obj('town_stump_axe', 4, 10)
    c.obj('garden_wood_chips', 5, 10)
    c.obj('garden_wood_chips', 3, 9)
    c.obj('town_laundry_rack', 13, 8)
    c.obj('garden_flowerbox_red', 10, 10)
    c.obj('garden_flowerbox_blue', 11, 10)
    # 집 B(2층): 앞 화단 · 술통 더미 · 손수레
    c.obj('garden_flowers_mixed_row', 18, 9)
    c.obj('town_barrels_stack', 27, 6)
    c.obj('town_handcart', 23, 11)
    c.obj('garden_potted_roses', 16, 7)
    # 집 C(연못가): 물통 · 꽃 · 상자
    c.obj('town_tub_water', 25, 11)
    c.obj('garden_flowerpots_two', 31, 12)
    c.obj('town_crate_x', 26, 12)
    # 집 D(헛간): 짚 계단 더미 · 상자 · 곡식 칸 · 짐수레
    c.obj('town_hay_steps', 25, 21)
    c.obj('town_bin_grain', 18, 19)
    c.obj('town_bin_carrot', 18, 20)
    c.obj('town_crate_low', 23, 21)
    c.obj('town_wagon', 23, 22)
    # 밭: 갈색 흙 + 작물 두 줄(가운데 흙길 한 줄) + 울타리 세 면(아래쪽이 입구) + 허수아비
    c.kind(1, 'A2:16', rect(4, 16, 8, 5))
    for i in range(8):
        c.obj(['crops_carrot_grown', 'crops_pumpkin_grown', 'crops_blade_crop_grown'][i % 3], 4 + i, 16)
        c.obj(['crops_blade_crop_grown_b', 'crops_carrot_grown', 'crops_pumpkin_flower'][i % 3], 4 + i, 18)
        if i not in (3, 4):
            c.obj('crops_seed_mounds_six', 4 + i, 20)
    c.obj('town_scarecrow', 8, 17)
    c.obj('town_wattle_fence_h4', 3, 15)
    c.obj('town_wattle_fence_h4', 7, 15)
    c.obj('town_wattle_fence_h2', 11, 15)
    c.obj('town_wattle_fence_v4', 3, 16)
    c.obj('town_wattle_fence_v4', 12, 16)
    # 연못(들쭉날쭉) + 물가 덤불·디딤돌
    c.kind(1, 'A1:0', blob(27, 13, [(2, 3), (0, 5), (1, 4)]))
    for x, y in ((26, 14), (25, 15), (26, 16)):
        c.obj('garden_stepping_stones_94', x, y)
    c.obj('garden_bush_green', 27, 13)
    c.obj('garden_bush_roses', 32, 14)
    # 풀밭 곳곳: 덤불·꽃·어린나무·열매(빈 풀밭 3×3 이 남지 않게)
    for oid, x, y in [('garden_flowers_red_row', 18, 14),
                      ('garden_bush_green', 11, 21), ('trees_summer_round_small', 7, 21), ('crops_fallen_berries_small_red', 9, 22),
                      ('garden_bush_roses', 13, 20), ('trees_summer_small_leafy_c', 12, 22), 
                      ('garden_flowers_yellow_row', 19, 12), ('garden_bush_green', 26, 5),
                      ('garden_bush_green', 15, 5), ('garden_flowerpot_red', 16, 8),
                      ('trees_summer_fruit_a', 29, 5), ('garden_bush_roses', 20, 22),
                      ('garden_stepping_stones_110', 18, 23), ('garden_bush_green', 26, 23),
                      ('trees_summer_sapling_leafy', 24, 14), ('garden_bush_green', 13, 10)]:
        c.obj(oid, x, y)
    return c


def building(c, oid, x, y):
    """특수 건물(sb_*) 한 채를 왼위 (x,y) 에 찍고 맵 좌표 입구 목록을 돌려준다. 조수는 stamp_object(kit:rasak_town/sb_*) 로 같은 일을 한다."""
    o = c.obj(oid, x, y)
    return [(x + e['x'], y + e['y']) for e in o['building']['entry']]


@example
def ex_town_buildings(ctx):
    """특수 건물 마을 40×28 — 완성 건물 넷(여관·상점·대장간·창고)을 큰길 북쪽·남쪽에 놓고, 길은 입구 바로 아래 칸에서 끝난다.
    건물 둘레 마당 투명 칸에는 땅이 먼저 깔려 있다. 숲 벽(왼쪽·아래 모서리) · 우물 광장 · 밭 · 연못 · 생활 소품 덩이."""
    c = Canvas(ctx, 'rasak_town', 40, 28, 'ex_town_buildings', 'Rasak 예제 · 특수 건물 마을')
    c.kind(1, 'A2:0', rect(0, 0, 40, 28))
    # 숲 벽: 왼쪽 띠(들쭉날쭉) · 왼아래 모서리 · 오른위 틈
    left = [(x, y) for y in range(0, 28) for x in range(0, 3 + (y % 6 == 2) + (y > 22))]
    bottom = [(x, y) for y in range(26, 28) for x in range(3, 12 + (y == 27) * 3)]
    forest(c, left + bottom, seed=11)
    # 큰길(가로 2칸) + 남쪽으로 빠지는 길
    c.kind(1, 'A2:1', path([(4, 14), (39, 14)], 2))
    c.kind(1, 'A2:1', path([(20, 16), (20, 27)], 2))
    # 북쪽 건물 셋 — 입구 바로 아래에서 큰길까지
    inn = building(c, 'sb_common_inn_small', 4, 1)
    store = building(c, 'sb_common_store_small_3', 16, 4)
    smith = building(c, 'sb_common_smith_small', 29, 5)
    for ex, ey in inn[:1] + store[:1] + smith[:1]:
        c.kind(1, 'A2:1', line_v(ex, ey + 1, 14 - (ey + 1)))
    # 남쪽 창고(데크 입구) — 큰길에서 내려와 입구 밑에서 끝
    storage = building(c, 'sb_common_storage_small_rasak', 30, 17)
    sx, sy = storage[0]
    c.kind(1, 'A2:1', path([(27, 16), (27, sy + 1), (sx, sy + 1)]))
    # 우물 광장(흙 마당 덩이) — 남쪽 길 옆, 가운데가 아닌 한쪽
    c.kind(1, 'A2:1', blob(22, 17, [(1, 4), (0, 5), (0, 5), (1, 3)]))
    c.obj('town_well_roofed', 23, 17)
    c.obj('town_log_bench', 22, 20)
    c.obj('town_barrel_water', 26, 19)
    c.obj('town_notice_board', 17, 16)
    c.obj('town_street_lamp', 15, 12)
    c.obj('town_street_lamp', 28, 12)
    c.obj('town_signpost', 38, 16)
    # 여관 마당: 술통 더미 · 짐수레 · 꽃 · 장작
    c.obj('town_barrels_stack', 3, 12)
    c.obj('town_handcart', 16, 13)
    c.obj('garden_flowerbox_red', 6, 13)
    c.obj('town_bin_firewood', 14, 9)
    # 상점 앞: 상자 · 과일 상자 · 화분
    c.obj('town_crate_x', 25, 12)
    c.obj('garden_potted_roses', 15, 6)
    c.obj('garden_flowers_mixed_row', 21, 13)
    # 대장간 둘레: 물통 · 상자 · 톱밥
    c.obj('town_tub_water', 36, 13)
    c.obj('garden_wood_chips', 30, 13)
    c.obj('town_crate_low', 38, 3)
    # 밭: 갈색 흙 + 작물 줄 + 울타리 세 면(오른쪽이 입구) + 허수아비
    c.kind(1, 'A2:16', rect(5, 18, 9, 6))
    for i in range(9):
        c.obj(['crops_carrot_grown', 'crops_pumpkin_grown', 'crops_blade_crop_grown'][i % 3], 5 + i, 18)
        c.obj(['crops_blade_crop_grown_b', 'crops_carrot_grown', 'crops_pumpkin_flower'][i % 3], 5 + i, 20)
        if i not in (4, 5):
            c.obj('crops_seed_mounds_six', 5 + i, 22)
    c.obj('town_scarecrow', 9, 19)
    c.obj('town_wattle_fence_h4', 4, 17)
    c.obj('town_wattle_fence_h4', 8, 17)
    c.obj('town_wattle_fence_h2', 12, 17)
    c.obj('town_wattle_fence_v4', 4, 18)
    c.obj('town_wattle_fence_h4', 4, 24)
    c.obj('town_wattle_fence_h4', 8, 24)
    c.obj('town_wattle_fence_h2', 12, 24)
    # 연못(들쭉날쭉) + 물가 덤불
    c.kind(1, 'A1:0', blob(23, 23, [(1, 3), (0, 5), (1, 4)]))
    c.obj('garden_bush_green', 22, 23)
    c.obj('garden_bush_roses', 28, 24)
    c.obj('garden_stepping_stones_94', 27, 22)
    # 풀밭 곳곳: 덤불·꽃·어린나무(빈 풀밭이 넓게 남지 않게, 좌우 대칭 없이)
    for oid, x, y in [('garden_bush_green', 15, 17), ('trees_summer_round_small', 16, 20), ('garden_flowers_yellow_row', 14, 25),
                      ('garden_bush_roses', 18, 24), ('trees_summer_small_leafy_b', 16, 23), ('crops_fallen_berries_small_red', 23, 26),
                      ('garden_bush_green', 39, 20), ('trees_summer_sapling_leafy', 38, 23), ('garden_bush_roses', 39, 26),
                      ('garden_bush_green', 27, 3), ('trees_summer_round_small', 26, 0), ('garden_bush_green', 15, 1),
                      ('garden_flowerpot_red', 28, 9), ('garden_bush_green', 39, 12),
                      ('trees_summer_fir_pair_a', 30, 0), ('trees_summer_round_small', 20, 0), ('garden_bush_green', 23, 2),
                      ('garden_flowers_red_row', 17, 2), ('trees_summer_tall_leafy', 33, 13), ('garden_bush_green', 38, 21),
                      ('garden_flowers_mixed_row', 11, 26), 
                      ('garden_bush_green', 13, 16), ('garden_flowers_yellow_row', 25, 16), ('garden_bush_green', 36, 1)]:
        c.obj(oid, x, y)
    return c


def stall(c, x, y, body, awning='market_awning_striped'):
    """시장 좌판: 차양(3×2)을 위에, 몸체(3×2)를 아래에 — 차양 아랫줄과 몸체 윗줄이 붙는다."""
    c.obj(awning, x, y)
    c.obj(body, x, y + 2)


@example
def ex_city(ctx):
    """도시 거리 34×24 — 큰길(3칸) 북쪽에 벽을 맞댄 집 줄(정면이 길에 바로 닿음, 골목 두 개) · 남쪽 한쪽으로 치우친 광장
    (석상·화단·긴 의자·가로등·노점 둘 + 상자) · 남동쪽 집과 문 앞 길 · 뒤뜰·가장자리 숲. 길과 광장은 같은 포장 kind(연석 선 없음)."""
    c = Canvas(ctx, 'rasak_town', 34, 24, 'ex_city', 'Rasak 예제 · 도시 거리와 광장')
    PAVE = 'A2:19'
    c.kind(1, 'A2:0', rect(0, 0, 34, 24))
    forest(c, [(x, y) for x in range(34) for y in range(0, 4 + (x % 7 == 3)) if not (9 <= x <= 13 and y >= 3)], seed=11)
    forest(c, [(x, y) for y in range(15, 24) for x in range(0, 3 + (y % 3 == 0))], seed=12)
    forest(c, [(x, y) for y in range(15, 24) for x in range(30 - (y > 19), 34)], seed=13)
    # 큰길(동서, 맵 양끝으로 나감) · 광장(치우친 들쭉날쭉) · 남동쪽 집 문 앞 길 — 모두 같은 포장
    c.kind(1, PAVE, rect(0, 12, 34, 3))
    c.kind(1, PAVE, blob(4, 15, [(0, 14), (0, 15), (1, 15), (0, 16), (0, 16), (1, 14), (2, 12), (3, 9)]))
    c.kind(1, PAVE, rect(18, 20, 9, 2))                                      # 남동쪽 집 앞마당 — 광장과 이어짐
    c.kind(1, PAVE, rect(14, 4, 1, 8))                                       # 집 줄 사이 골목(뒤뜰로)
    # 포장 결: 흙 낀 판석 조각(2층)을 드문드문
    c.kind(2, 'A2:12', [(3, 13), (9, 12), (10, 12), (21, 14), (28, 13), (7, 18), (12, 21), (16, 16)])
    # 집 줄(북쪽, 벽 맨 아랫줄 = y11 → 정면이 큰길 y12 에 바로 닿는다)
    house(c, 1, 5, 7, 'A3:19', 'A3:27', roof_h=4, wall_h=3, door=2, windows=(5,), upper_windows=(1, 3, 5), chimney=5)
    house(c, 8, 7, 6, 'A3:1', 'A3:13', roof_h=3, wall_h=2, door=3, windows=(1,), chimney=4)
    house(c, 15, 6, 8, 'A3:5', 'A3:11', roof_h=3, wall_h=3, door=1, windows=(4, 6), upper_windows=(1, 3, 6), gable=('building_gable_red_window', 4))
    house(c, 23, 6, 6, 'A3:2', 'A3:14', roof_h=4, wall_h=2, door=4, windows=(2,), chimney=1)
    house(c, 30, 7, 4, 'A3:6', 'A3:12', roof_h=3, wall_h=2, door=1)
    house(c, 20, 15, 7, 'A3:21', 'A3:10', roof_h=3, wall_h=2, door=3, windows=(1, 5), chimney=5)
    # 가게 간판(벽걸이) · 문 옆 살림
    c.obj('town_sign_inn', 4, 10)
    c.obj('town_sign_tavern', 17, 10)
    c.obj('town_sign_item', 26, 11)
    c.obj('garden_flowerbox_red', 6, 12)
    c.obj('town_barrels_stack', 19, 12)
    c.obj('garden_flowerbox_orange', 25, 12)
    c.obj('town_barrel_water', 29, 12)
    # 뒤뜰(집 줄 뒤): 빨래 · 장작 · 덤불
    c.obj('town_laundry_rack', 12, 5)
    c.obj('town_bin_firewood', 15, 4)
    c.obj('garden_bush_green', 13, 6)
    # 광장: 석상(가운데에서 비킴) · 화단 둘 · 긴 의자 · 가로등 셋 · 게시판 · 노점 둘 + 상자 · 수레
    c.obj('structure_statue_armored_knight', 10, 17)
    c.obj('garden_planter_stone_long', 7, 16)
    c.obj('garden_flowers_red_row', 7, 16, layer=4)
    c.obj('garden_planter_stone_long', 12, 20)
    c.obj('garden_flowers_yellow_row', 12, 20, layer=4)
    c.obj('town_log_bench', 9, 19)
    c.obj('town_log_bench', 12, 18)
    c.obj('town_street_lamp', 5, 15)
    c.obj('town_street_lamp', 14, 15)
    c.obj('town_street_lamp', 16, 21)
    c.obj('market_stall_striped_open', 4, 18)
    c.obj('market_crates_pile_mixed', 8, 21)
    c.obj('market_stall_striped_backwall', 15, 17)
    c.obj('market_crates_pile_bread', 18, 17)
    c.obj('market_basket_oranges', 18, 16)
    c.obj('market_cart_red_apples_a', 11, 22)
    c.obj('market_sacks_pile', 7, 22)
    # 남동쪽 집 앞 · 길가 풀밭 덤불·꽃
    c.obj('garden_potted_roses', 19, 23)
    c.obj('garden_flowerpots_two', 27, 21)
    for oid, x, y in [('garden_bush_green', 19, 15), ('garden_bush_roses', 28, 16), ('garden_flowers_mixed_row', 20, 22),
                      ('garden_bush_green', 27, 23), ('trees_summer_round_small', 24, 22), 
                      ('garden_bush_green', 29, 20), ('garden_flowers_blue_row', 12, 23)]:
        c.obj(oid, x, y)
    return c


def interior(c, top, rooms, doors=()):
    """여러 방 실내. 맵 전체를 A4 윗면(천장·벽 두께)으로 덮고 방마다 벽면 2줄 + 바닥을 판다.
    rooms = [(x0, y0, x1, y1, 벽면 kind, 바닥 kind)] — 방 안쪽 칸 범위(양끝 포함), 윗 2줄이 벽면.
    방과 방 사이에 남긴 천장 1칸이 칸막이다. doors = [(x, y, 바닥 kind)] 칸막이를 뚫은 문 칸.
    가로 칸막이 문은 천장 칸 + 아래 방 벽면 2칸을 모두 바닥으로(3칸 세로 통로) 뚫는다."""
    c.kind(1, top, rect(0, 0, c.w, c.h))
    for x0, y0, x1, y1, wall, floor in rooms:
        c.kind(1, wall, rect(x0, y0, x1 - x0 + 1, 2))
        c.kind(1, floor, rect(x0, y0 + 2, x1 - x0 + 1, y1 - y0 - 1))
    for x, y, floor in doors:
        c.kind(1, floor, [(x, y)])
    # MZ 자동 그림자: 천장(벽 두께) 바로 오른쪽 바닥 칸의 왼쪽 반. 벽면 칸에는 깔지 않는다.
    for y in range(c.h):
        for x in range(1, c.w):
            if c.ground(x, y) == 'floor' and c.ground(x - 1, y) == 'ceiling':
                c.shadow(x, y, 5)


def door_v(x, y_top, floor):
    """세로 칸막이(천장 1열)를 가로질러 여는 문 2칸(위아래)."""
    return [(x, y_top, floor), (x, y_top + 1, floor)]


def door_h(x, y_wall, floor):
    """가로 칸막이 문: 칸막이 천장 칸(y_wall) + 아래 방 벽면 2칸."""
    return [(x, y_wall + k, floor) for k in range(3)]


@example
def ex_house_room(ctx):
    """민가 한 채 22×17 — 거실·식당 / 부엌 / 침실 / 광 / 현관. 제작자 p26·p22 처럼 방을 칸막이로 나누고 방마다 할 일이 있다."""
    c = Canvas(ctx, 'rasak_interior', 22, 17, 'ex_house_room', 'Rasak 예제 · 민가 한 채(방 다섯)')
    HB, PL, FL = 'A2:0', 'A2:10', 'A2:1'   # 헤링본(거실·침실) · 짙은 세로 널(부엌·현관) · 짙은 가로 널(광)
    interior(c, 'A4:0', [
        (1, 1, 12, 8, 'A4:27', HB),     # 거실·식당(흰 회벽)
        (14, 1, 20, 8, 'A4:29', PL),    # 부엌(황토 흙벽)
        (1, 10, 8, 15, 'A4:28', HB),    # 침실(분홍 벽지)
        (10, 10, 14, 15, 'A4:30', FL),  # 광(통나무 벽)
        (16, 10, 20, 15, 'A4:27', PL),  # 현관
    ], doors=door_v(13, 5, PL) + door_h(5, 9, HB) + door_h(12, 9, FL) + door_h(18, 9, PL) + [(18, 16, PL)])
    # ── 거실·식당 ── 벽: 창 · 초상화 · 벽난로 · 벽시계 · 넓은 책장
    c.obj('living_window_red_curtain', 2, 1)
    c.obj('living_painting_portrait', 4, 2)
    c.obj('living_fireplace_stone', 5, 2)
    c.obj('living_firewood_upright', 8, 3)
    c.obj('living_wall_clock', 9, 1)
    c.obj('living_window_red_curtain', 10, 1)
    c.obj('living_bookcase_wide', 11, 2)
    # 난롯가: 무늬 깔개(2층) 위 소파 둘 + 낮은 탁자와 찻주전자
    c.kind(2, 'A2:12', rect(2, 4, 6, 2))
    c.obj('living_settle_red', 1, 3)
    c.obj('living_table_low_wood', 3, 4)
    c.obj('house_teapot', 3, 4)
    c.obj('living_cushion_red', 4, 5)
    c.obj('living_cushion_green', 6, 4)
    # 식탁: 긴 식탁 + 위아래 의자(빈틈 없이) + 음식 셋
    c.obj('living_table_long', 5, 7)
    for x in (5, 6, 7):
        c.obj('living_chair_down', x, 6)
        c.obj('living_chair_up', x, 8)
    c.obj('house_plate_roast', 5, 7)
    c.obj('house_wine_bottle_glass', 6, 7)
    c.obj('house_bread_garlic', 7, 7)
    c.obj('living_hutch_dishes', 9, 5)
    c.obj('living_chest_brown', 12, 5)
    c.obj('living_plant_palm', 1, 7)
    c.obj('living_basket_tall', 12, 8)
    c.obj('living_crate_cloth', 10, 8)
    # ── 부엌 ── 화덕 · 조리 선반 · 큰 조리대와 재료 · 솥·물통·자루
    c.obj('house_brick_hearth_pots', 14, 2)
    c.obj('tavern_wall_shelf_jars', 18, 2)
    c.obj('living_pan_spoons', 20, 2)
    c.obj('tavern_big_table', 16, 5)
    c.obj('tavern_board_fish_knife', 16, 6)
    c.obj('tavern_bowl_tomato', 17, 6)
    c.obj('tavern_carrot_pile', 18, 6)
    c.obj('tavern_cauldron_lid', 14, 4)
    c.obj('tavern_bucket_cream', 15, 8)
    c.obj('house_sacks_stacked', 20, 4)
    c.obj('tavern_barrel_upright', 20, 7)
    c.obj('house_sack_flour', 20, 8)
    c.obj('tavern_wicker_jug', 14, 8)
    # ── 침실 ── 창 · 거울 · 벽 선반, 벽에 붙인 침대 + 협탁, 옷장, 짚 깔개, 궤짝
    c.obj('living_window_brown_curtain', 2, 10)
    c.obj('living_mirror_gold', 7, 10)
    c.obj('living_wall_shelf_books', 3, 11)
    c.obj('tavern_bed_green', 1, 12)
    c.obj('living_nightstand', 3, 12)
    c.obj('living_flowerpot_orange', 4, 12)
    c.obj('living_wardrobe', 8, 11)
    c.obj('house_straw_mat_round', 4, 14)
    c.obj('living_chest_brown_b', 1, 15)
    c.obj('living_table_low_wood', 7, 14)
    c.obj('house_books_scroll', 7, 14)
    c.obj('living_stool_wood', 7, 15)
    # ── 광 ── 선반장 · 자루 더미 · 상자 · 술통 · 항아리(통로 한 줄은 비운다)
    c.obj('living_shelf_goods', 10, 11)
    c.obj('living_shelf_sacks', 11, 11)
    c.obj('living_shelf_goods_wide', 13, 11)
    c.obj('house_sacks_stacked', 10, 13)
    c.obj('living_crate_pots', 10, 15)
    c.obj('living_crate_mushrooms', 11, 15)
    c.obj('tavern_barrel_lying_pair', 13, 15)
    c.obj('tavern_barrel_upright', 14, 15)
    c.obj('house_clay_jar_covered', 14, 14)
    c.obj('living_sacks_small_three', 13, 14)
    c.kind(2, 'A2:31', [(11, 13), (12, 14)])
    # ── 현관 ── 창 · 모자걸이 · 긴 의자 · 빗자루 · 문 앞 깔개 · 화분
    c.obj('living_window_square', 20, 10)
    c.obj('living_hat_stand_black', 16, 12)
    c.obj('living_settle_green', 16, 13)
    c.obj('living_broom', 20, 12)
    c.obj('living_plant_bush', 20, 14)
    c.kind(2, 'A2:12', rect(17, 14, 3, 2))
    c.obj('living_firewood_tied', 16, 15)
    return c


@example
def ex_tavern(ctx):
    """여관 1층 30×16 — 홀(난롯가·바·식탁 셋) / 부엌 / 식료품 광 / 지하 창고 계단방. 제작자 p22 구성."""
    c = Canvas(ctx, 'rasak_interior', 30, 16, 'ex_tavern', 'Rasak 예제 · 여관 1층(방 넷)')
    HALL, KIT, STORE = 'A2:10', 'A2:9', 'A2:1'   # 짙은 세로 널 · 회색 자갈 판석 · 짙은 가로 널
    interior(c, 'A4:3', [
        (1, 1, 17, 14, 'A4:24', HALL),    # 홀(검붉은 벽지 + 징두리)
        (19, 1, 28, 7, 'A4:29', KIT),     # 부엌(황토 흙벽)
        (19, 9, 23, 14, 'A4:30', STORE),  # 식료품 광(통나무 벽)
        (25, 9, 28, 14, 'A4:30', STORE),  # 지하 창고 계단방
    ], doors=door_v(18, 6, HALL) + door_h(21, 8, STORE) + door_h(26, 8, STORE) + [(8, 15, HALL)])
    # ── 홀 벽: 창 · 벽난로 · 사슴 머리 · 풍경화 · 바 뒤 벽 선반 · 잔 걸이
    c.obj('living_window_red_curtain', 1, 1)
    c.obj('living_fireplace_stone', 3, 2)
    c.obj('house_moose_head', 7, 2)
    c.obj('living_window_red_curtain', 10, 1)
    c.obj('living_painting_mountains', 11, 2)
    c.obj('tavern_wall_shelf_pantry', 13, 2)
    c.obj('tavern_wall_rack_tankards', 13, 1)
    c.obj('tavern_wall_rack_wood_mugs_two', 16, 1)
    # 난롯가: 장작 · 무늬 깔개(2층) · 마주 보는 긴 의자 둘 + 낮은 탁자
    c.obj('living_firewood_upright', 2, 3)
    c.obj('tavern_firewood', 6, 3)
    c.kind(2, 'A2:12', rect(2, 5, 6, 3))
    c.obj('living_settle_red', 2, 5)
    c.obj('living_table_low_wood', 4, 6)
    c.obj('house_beer_two_bottles', 4, 6)
    c.obj('living_settle_green', 6, 5)
    c.obj('living_lute', 1, 5)
    # 바: 뒤쪽 술통·항아리(주인 자리 둘은 비움) · 카운터(탁자형 자동타일) · 카운터 위 잔·병 · 앞 걸상 넷
    c.obj('tavern_barrel_lying_pair', 13, 3)
    c.obj('tavern_wicker_jug_pair', 14, 3)
    c.obj('tavern_barrel_upright', 17, 3)
    c.kind(1, 'A2:7', rect(13, 4, 5, 1))
    c.obj('tavern_wineglasses_row', 13, 4)
    c.obj('house_beer_mugs_bottles', 14, 4)
    c.obj('tavern_tumblers_set', 16, 4)
    c.obj('house_wine_bottle_three', 17, 4)
    for x in (13, 14, 16, 17):
        c.obj('living_stool_round', x, 5)
    # 식탁 셋(모양 다르게): 여섯 의자 식탁 · 네 의자 세로 식탁 · 두 의자 작은 식탁, 모두 음식·잔
    c.obj('tavern_long_table_six_chairs', 2, 9)
    c.obj('house_plate_roast', 2, 10)
    c.obj('house_beer_green_bottle', 3, 10)
    c.obj('house_bread_garlic', 4, 10)
    c.obj('tavern_tall_table_four_chairs', 8, 9)
    c.obj('tavern_drumsticks', 8, 10)
    c.obj('house_wine_bottle_glass', 9, 10)
    c.obj('tavern_small_table_two_chairs', 13, 9)
    c.obj('tavern_setting_plate_glass', 13, 10)
    c.obj('tavern_pedestal_table_three_chairs', 11, 12)
    c.obj('house_plate_sausage', 11, 12)
    # 홀 바닥 흔적 · 구석 살림
    c.kind(2, 'A2:31', [(7, 13), (9, 12), (14, 7)])
    c.obj('tavern_broken_shards', 15, 12)
    c.obj('living_plant_palm', 1, 13)
    c.obj('tavern_barrel_upright', 16, 14)
    c.obj('living_crate_empty', 17, 14)
    c.obj('living_broom', 17, 11)
    c.obj('living_hat_stand_empty', 7, 14)                   # 입구 옆 모자걸이
    c.obj('living_crate_pots', 9, 14)
    # 홀 가운데·오른쪽 아래를 채우는 식탁 둘(빈 5×5 금지)
    c.obj('tavern_pedestal_table_two_chairs', 9, 6)
    c.obj('tavern_long_table_two_benches', 14, 11)
    c.obj('tavern_setting_board_mug', 14, 12)
    c.obj('house_beer_mugs_bottles', 15, 12)
    c.obj('tavern_tumblers_scatter', 16, 12)
    # ── 부엌: 화덕 · 조리 선반 · 큰 조리대와 재료 · 솥·들통·자루·술통
    c.obj('house_brick_hearth_pots', 19, 2)
    c.obj('tavern_wall_shelf_cookware', 23, 2)
    c.obj('house_herb_bundle', 28, 2)
    c.obj('tavern_big_table', 24, 4)
    c.obj('tavern_board_fish_knife', 24, 5)
    c.obj('tavern_bowl_porridge_spoon', 25, 5)
    c.obj('tavern_rolling_pin_dough', 26, 5)
    c.obj('tavern_cauldron', 19, 4)
    c.obj('tavern_pedestal_table', 21, 5)                    # 손질용 작은 탁자
    c.obj('tavern_board_sausage_knife', 21, 5)
    c.obj('tavern_bucket_cream', 20, 6)
    c.obj('tavern_bucket', 21, 7)
    c.obj('house_sacks_stacked', 28, 4)
    c.obj('tavern_barrel_upright', 28, 6)
    c.obj('tavern_wicker_jug', 28, 7)
    c.obj('house_basket_empty', 22, 7)
    # ── 식료품 광: 선반장 · 자루 · 상자 · 항아리(문 앞 한 줄은 비움)
    c.obj('living_shelf_goods', 19, 10)
    c.obj('living_shelf_sacks', 20, 10)
    c.obj('living_shelf_goods', 22, 10)
    c.obj('house_sacks_stacked', 23, 11)
    c.obj('house_sack_flour', 19, 12)
    c.obj('living_crate_pots', 19, 14)
    c.obj('living_crate_mushrooms', 20, 14)
    c.obj('tavern_barrel_lying_pair', 22, 14)
    c.obj('house_clay_jar_covered', 23, 14)
    c.obj('living_sacks_small_four', 23, 13)
    # ── 지하 창고 계단방: 내려가는 계단 · 술통 · 상자
    c.obj('tavern_wall_rack_hooks', 25, 10)
    c.obj('living_stairs_long', 27, 11)
    c.obj('tavern_barrel_upright', 25, 13)
    c.obj('tavern_barrel_lying', 25, 14)
    c.obj('living_crate_empty', 26, 14)
    return c


@example
def ex_smithy(ctx):
    """대장간 26×17 — 불 작업장(벽 속 화덕 · 화로+풀무 · 모루 셋 · 담금통 · 숫돌 · 수력 망치 · 원자재 구석) / 무기 가게(카운터·무기대·갑옷 걸이) / 창고.
    작업장은 회색 돌벽(A5 벽면)과 자갈 판석, 가게·창고는 통나무 벽과 널 마루 — 방마다 벽·바닥이 다르다."""
    c = Canvas(ctx, 'rasak_interior', 26, 17, 'ex_smithy', 'Rasak 예제 · 대장간(작업장·가게·창고)')
    STONE, PL, FL = 'A2:9', 'A2:10', 'A2:1'   # 회색 자갈 판석(작업장) · 짙은 세로 널(가게) · 짙은 가로 널(창고)
    interior(c, 'A4:33', [
        (1, 1, 13, 15, 'A5#32', STONE),   # 작업장(회색 돌 벽돌 벽)
        (15, 1, 24, 6, 'A4:30', FL),      # 창고(통나무 벽)
        (15, 8, 24, 15, 'A4:30', PL),     # 무기 가게
    ], doors=door_v(14, 12, STONE) + door_h(22, 7, PL) + [(19, 16, PL)])
    # ── 작업장 벽: 벽 속 화덕 둘 · 망치 걸이 · 공구판 · 톱 걸이 · 문장 방패
    c.obj('smith_furnace_wall_arch_lit', 2, 2)
    c.obj('smith_furnace_wall_grate_lit', 3, 2)
    c.obj('smith_hammer_rail_two', 5, 2)
    c.obj('smith_hammer_rail_one', 6, 2)
    c.obj('smith_tool_board_wide_b', 8, 1)
    c.obj('smith_pegboard_saws', 11, 1)
    c.obj('smith_pegboard_pliers', 11, 2)
    c.obj('smith_pegboard_hammers', 12, 2)
    c.obj('smith_shield_round', 13, 1)
    # 불 자리: 화로+풀무 · 석탄 구유 · 쇠막대 통 — 화덕 아래 벽을 따라
    c.obj('smith_bucket_rods', 1, 3)
    c.obj('smith_forge_basin_embers_bellows', 2, 3)
    c.obj('smith_trough_coal', 1, 4)
    c.obj('smith_trough_embers', 5, 3)
    # 모루 자리 셋(모루 + 망치 + 담금통)
    c.obj('smith_anvil_stump_dark', 6, 4)
    c.obj('smith_hammers_standing_two', 7, 5)
    c.obj('smith_quench_tub_blades', 8, 4)
    c.obj('smith_anvil_barrel_silver', 4, 8)
    c.obj('smith_quench_tub_blade3', 5, 9)
    c.obj('smith_hammer_standing', 3, 9)
    c.obj('smith_anvil_dark', 8, 11)
    c.obj('smith_quench_tub_splash', 9, 10)
    c.obj('smith_tongs', 8, 11, layer=4)
    # 숫돌 · 공구 상자 · 작업대 둘(오른쪽 벽)
    c.obj('smith_grindstone_sword_stool', 10, 3)
    c.obj('smith_iron_box_tools', 12, 3)
    c.obj('smith_workbench_saw', 11, 5)
    c.obj('smith_workbench_pliers', 11, 7)
    c.obj('smith_iron_box_red_knobs', 13, 6)
    # 수력 망치(3×3)와 돌 블록
    c.obj('smith_trip_hammer_wheel', 6, 7)
    c.obj('smith_stone_block_pallet', 9, 7)
    # 원자재 구석(왼쪽 아래): 쇠막대 다발 · 돌 블록 더미 · 판재 · 세운 판재
    c.obj('smith_iron_bars_standing', 1, 11)
    c.obj('smith_stone_cubes_pile', 1, 13)
    c.obj('smith_planks_pile_small', 3, 15)
    c.obj('smith_lumber_standing', 3, 12)
    c.obj('smith_iron_rods_bundle', 4, 13)
    c.obj('smith_log_upright_posts', 5, 12)
    c.obj('smith_planks_pile_large', 11, 14)
    c.obj('smith_barrels_pile', 7, 14)
    c.obj('smith_cart_wheel', 13, 14)
    c.obj('smith_quench_tub', 1, 8)
    c.obj('smith_iron_bars_lying', 10, 12)
    c.obj('smith_iron_box_low', 12, 11)
    # 바닥 흔적: 놋쇠 조각 · 흙 얼룩(2층)
    c.obj('smith_brass_scraps', 9, 9)
    c.obj('smith_brass_scraps', 6, 11)
    c.kind(2, 'A2:31', [(4, 6), (5, 6), (3, 7), (10, 9), (7, 12), (6, 13)])
    # ── 창고: 벽 공구판 · 세운 판재·쇠막대 · 통 피라미드 · 주괴 줄(문 앞 한 칸은 비움)
    c.obj('smith_tool_board_tall', 23, 1)
    c.obj('smith_spears_wall', 16, 1)
    c.obj('smith_barrels_pyramid_wide', 15, 3)
    c.obj('smith_lumber_standing_b', 18, 3)
    c.obj('smith_iron_rods_bundle_b', 19, 3)
    c.obj('smith_iron_rod_single', 20, 3)
    c.obj('smith_stone_block', 24, 3)
    c.obj('smith_hide_frame', 21, 3)
    c.obj('smith_barrel_tall', 24, 5)
    c.obj('smith_ingot_gold_3', 15, 6)
    c.obj('smith_ingot_silver_3', 16, 6)
    c.obj('smith_ingot_green_2', 17, 6)
    c.obj('smith_ingot_purple_1', 18, 6)
    c.obj('smith_iron_box_silver', 19, 6)
    c.obj('smith_iron_box_magnet', 20, 6)
    c.obj('smith_barrel_single', 23, 6)
    c.obj('smith_iron_bars_lying', 18, 5)
    c.kind(2, 'A2:31', [(21, 5), (20, 5)])
    # ── 무기 가게 ── 벽: 문장 방패 · 걸어 둔 창 · 검 · 문장 방패와 검
    c.obj('smith_shield_crest', 16, 8)
    c.obj('smith_spears_wall_fancy', 17, 8)
    c.obj('smith_swords_hung_two', 19, 9)
    c.obj('smith_shield_crest_swords', 20, 8)
    c.obj('smith_crossed_swords', 21, 9)
    c.obj('smith_shield_round', 23, 8)
    c.obj('smith_swords_hung_two', 24, 9)
    # 카운터 뒤: 무기대 · 갑옷 걸이 둘(주인 자리 한 칸은 비움)
    c.obj('smith_rack_swords_three', 15, 10)
    c.obj('smith_rack_spears_three', 16, 10)
    c.obj('smith_armor_stand_gold', 17, 10)
    c.obj('smith_armor_stand_steel', 20, 10)
    c.obj('smith_rack_spears_two', 21, 10)
    # 카운터(탁자형 자동타일 한 줄) 위 진열: 투구 · 장검 · 단검 · 편자
    c.kind(1, 'A2:7', rect(16, 12, 5, 1))
    c.obj('smith_helmet_gold_crest', 16, 12)
    c.obj('smith_swords_lying_two', 17, 12)
    c.obj('smith_daggers_lying_four', 19, 12)
    c.obj('smith_helmet_steel', 20, 12)
    # 오른쪽: 창고 문에서 내려오는 통로(22열)는 비우고, 벽 쪽에 무기대 · 궤짝 · 활
    c.obj('smith_rack_sword_one', 24, 10)
    c.obj('smith_rack_empty_tall', 23, 10)
    c.obj('smith_armor_stand_steel', 24, 13)
    c.obj('smith_sword_stand_two', 23, 13)
    c.obj('storage_chest_strap_dark', 23, 15)
    # 손님 쪽: 문 앞 깔개 · 검 받침 · 활과 화살통 · 통
    c.kind(2, 'A2:12', rect(17, 13, 4, 2))
    c.obj('smith_sword_stand_one', 15, 13)
    c.obj('smith_bow_quiver', 15, 15)
    c.obj('smith_quivers', 16, 15)
    c.obj('smith_bows_row', 17, 15)
    c.obj('smith_barrel_single', 21, 15)
    c.obj('smith_arrows_stuck', 22, 14)
    return c


@example
def ex_tailor(ctx):
    """재봉점 22×16 — 가게(옷 걸이 봉·큰 옷장·마네킹 줄·진열대 카운터·둥근 탁자) / 작업실(재봉 책상 셋·베틀·물레) / 탈의실(옷장·거울·마네킹)."""
    c = Canvas(ctx, 'rasak_interior', 22, 16, 'ex_tailor', 'Rasak 예제 · 재봉점(가게·작업실·탈의실)')
    HB, PL = 'A2:0', 'A2:10'   # 헤링본(가게·탈의실) · 짙은 세로 널(작업실)
    interior(c, 'A4:3', [
        (1, 1, 12, 14, 'A4:26', HB),     # 가게(초록 벽지 + 징두리)
        (14, 1, 20, 7, 'A4:29', PL),     # 작업실(황토 흙벽)
        (14, 9, 20, 14, 'A4:28', HB),    # 탈의실(분홍 벽지)
    ], doors=door_v(13, 4, HB) + door_h(17, 8, HB) + [(6, 15, HB)])
    # ── 가게 벽: 모자·외투 건 가로대 · 쇠 옷걸이 봉과 옷 · 신발 선반 · 큰 양문 옷장(열림)
    c.obj('tailor_wall_hook_rail_full', 1, 2)
    c.obj('tailor_wall_pipe_rail', 4, 1)
    for x in (4, 5, 6):
        c.obj('tailor_hanging_clothes', x, 1)
    c.obj('tailor_wall_shelf_goods', 7, 2)
    c.obj('tailor_wardrobe_big_open_full', 9, 1)
    c.obj('tailor_coat_stand_full', 12, 2)
    # 마네킹 줄(왼쪽 벽) — 정장·드레스·줄자, 모두 다른 차림
    c.obj('tailor_mannequin_suit_hat', 1, 4)
    c.obj('tailor_mannequin_dress_hat', 2, 4)
    c.obj('tailor_mannequin_tape_mirror_l', 1, 7)
    c.obj('tailor_mannequin_dress', 1, 10)
    c.obj('tailor_mannequin_suit_short', 2, 10)
    # 카운터: 판자 탁자형 자동타일 한 줄 + 위에 재봉 도구(4층) · 뒤에 걸상 · 물레 · 진열대
    c.kind(1, 'A2:15', rect(4, 6, 6, 1))
    c.obj('tailor_measuring_tape', 4, 6)
    c.obj('tailor_scissors', 5, 6)
    c.obj('tailor_sewing_box', 6, 6)
    c.obj('tailor_thread_stand_red', 7, 6)
    c.obj('tailor_pincushion_stand', 8, 6)
    c.obj('tailor_folded_stacks', 9, 6)
    c.obj('tailor_low_counter_chest', 4, 3)
    c.obj('tailor_stool_small', 6, 5)
    c.obj('tailor_spinning_wheel', 7, 4)
    # 둥근 탁자: 개킨 옷 · 모자 받침 · 반짇고리
    c.obj('tailor_round_table_gold', 8, 9)
    c.obj('tailor_folded_stacks', 8, 9)
    c.obj('tailor_hat_stand_straw_daisy', 9, 9)
    c.obj('tailor_sewing_box', 9, 10)
    c.kind(2, 'A2:12', rect(4, 9, 3, 3))
    c.obj('tailor_round_table_dark', 4, 9)
    c.obj('tailor_hat_stand_fedora', 4, 9)
    c.obj('tailor_hat_stand_witch', 5, 10)
    # 오른쪽 벽: 전신 거울 · 모자 진열대 · 옷걸이 기둥
    c.obj('tailor_mirror_tall_hat_r', 12, 6)
    c.obj('tailor_low_counter_goods', 11, 9)
    c.obj('tailor_hat_stand_black_red', 11, 9)
    c.obj('tailor_coat_stand_empty', 12, 11)
    # 문 쪽: 옷걸이대 둘과 옷 · 털실 바구니 · 신발 · 화분(문 앞 두 칸은 비움)
    c.obj('tailor_pipe_rack', 8, 13)
    c.obj('tailor_hanging_clothes', 8, 13)
    c.obj('tailor_hangers', 9, 13)
    c.obj('tailor_pipe_rack_small', 10, 13)
    c.obj('tailor_hanging_clothes', 10, 13)
    c.obj('tailor_yarn_basket', 1, 14)
    c.obj('living_crate_cloth', 2, 14)
    c.obj('living_plant_palm', 12, 13)
    c.obj('living_chest_brown', 4, 14)
    c.obj('tailor_mannequin_bare', 3, 12)
    c.obj('tailor_yarn_basket', 7, 14)
    # ── 작업실: 벽에 재봉 책상 셋(1×3 — 윗줄이 벽면) · 가로대 · 선반, 아래에 베틀 둘과 물레
    c.obj('tailor_wall_hook_rail', 14, 1)
    c.obj('tailor_sew_desk_beige', 15, 2)
    c.obj('tailor_sew_desk_blue', 17, 2)
    c.obj('tailor_sew_desk_pink', 19, 2)
    c.obj('tailor_wall_shelf_goods', 19, 1)
    c.obj('tailor_loom_blue', 14, 5)
    c.obj('tailor_loom_white', 19, 5)
    c.obj('tailor_yarn_basket', 16, 7)
    c.obj('tailor_spinning_wheel', 18, 7)
    c.obj('living_crate_cloth', 20, 7)
    c.obj('tailor_stool_small', 16, 5)
    # ── 탈의실: 열린 옷장 · 닫힌 옷장 · A자 거울 · 마네킹 거울 · 둥근 탁자와 개킨 옷
    c.obj('tailor_wardrobe_open_rail_full', 14, 9)
    c.obj('tailor_wardrobe_closed', 19, 9)
    c.obj('royal_painting_vase_oval', 16, 9)
    c.obj('tailor_mirror_aframe_tape_r', 16, 12)
    c.obj('tailor_mannequin_dress_mirror_r', 14, 13)
    c.obj('tailor_round_table_carved', 19, 13)
    c.obj('tailor_folded_red_green', 19, 13)
    c.obj('tailor_yarn_pile', 20, 14)
    c.kind(2, 'A2:12', rect(17, 13, 2, 2))
    c.obj('tailor_stool_small', 18, 12)
    return c


def castle_interior(c, top, rooms, doors=()):
    """성 실내: A4 윗면(돌 테두리 천장)으로 덮고 방마다 A5 벽면 3줄(윗줄 아치 돌벽 + 회색 돌 벽돌 2줄) + 바닥.
    벽이 3줄이라 큰 아치 창·커튼 창(3×3)이 벽면에 다 들어간다. rooms = [(x0, y0, x1, y1, 바닥 kind)]."""
    c.kind(1, top, rect(0, 0, c.w, c.h))
    for x0, y0, x1, y1, floor in rooms:
        c.kind(1, 'A5#52', rect(x0, y0, x1 - x0 + 1, 1))
        c.kind(1, 'A5#32', rect(x0, y0 + 1, x1 - x0 + 1, 2))
        c.kind(1, floor, rect(x0, y0 + 3, x1 - x0 + 1, y1 - y0 - 2))
    for x, y, floor in doors:
        c.kind(1, floor, [(x, y)])
    for y in range(c.h):
        for x in range(1, c.w):
            if c.ground(x, y) == 'floor' and c.ground(x - 1, y) == 'ceiling':
                c.shadow(x, y, 5)


def door_h3(x, y_wall, floor):
    """성 실내 가로 칸막이 문: 칸막이 천장 칸 + 아래 방 벽면 3칸."""
    return [(x, y_wall + k, floor) for k in range(4)]


@example
def ex_castle(ctx):
    """성 1층 34×22 — 알현실(붉은 융단·왕좌·기둥·깃발·아치 창) / 서재(책장·책상·천구의) / 왕의 침실 / 근위대 방 / 식당.
    제작자 p21 처럼 벽은 회색 돌(A5 벽면 3줄), 바닥은 밝은 석판. 알현실은 왕좌 축이 있어도 양옆을 다르게 채운다(대칭 금지)."""
    c = Canvas(ctx, 'rasak_interior', 34, 24, 'ex_castle', 'Rasak 예제 · 성 1층(알현실·서재·침실·근위대·식당)')
    SLAB, HB, PL = 'A5#19', 'A2:0', 'A2:10'   # 밝은 회색 석판(알현실·근위대) · 헤링본(서재·침실) · 짙은 세로 널(식당)
    castle_interior(c, 'A4:33', [
        (1, 1, 18, 14, SLAB),    # 알현실
        (20, 1, 32, 9, HB),      # 서재
        (20, 11, 32, 22, HB),    # 왕의 침실
        (1, 16, 9, 22, SLAB),    # 근위대 방
        (11, 16, 18, 22, PL),    # 식당
    ], doors=door_v(19, 7, HB) + door_h3(26, 10, HB) + door_h3(5, 15, SLAB) + door_h3(15, 15, PL) + door_v(19, 20, HB) + [(5, 23, SLAB)])
    # ── 알현실 벽: 아치 창 둘 · 깃발 · 커튼 드리운 왕좌 뒤 벽 · 초상화 · 문장 방패
    c.obj('royal_window_arch_white', 2, 1)
    c.obj('royal_banner_v', 6, 2)
    c.obj('royal_curtain_open', 8, 1)
    c.obj('royal_banner_flat', 12, 2)
    c.obj('royal_window_arch_white', 14, 1)
    c.obj('royal_painting_grey_figure', 5, 2)
    c.obj('smith_shield_crest_swords', 18, 2)
    c.obj('royal_small_frames', 13, 1)
    # 왕좌 축: 왕좌 + 발받침 + 붉은 융단(탁자형 아닌 바닥 kind rect — 가장자리 금테는 엔진이 잡는다)
    c.kind(1, 'A2:25', rect(8, 5, 3, 10))
    c.obj('royal_throne', 9, 4)
    c.obj('royal_footstool_red', 9, 6)
    c.obj('royal_velvet_pillar_l', 7, 4)
    c.obj('royal_velvet_pillar_r', 11, 4)
    c.obj('royal_banner_stand_v', 6, 5)
    # 왼쪽: 근위 — 기사상 · 갑옷 걸이 · 무기대 · 깃발 받침(오른쪽과 다르게)
    c.obj('royal_statue_knight', 1, 4)
    c.obj('smith_armor_stand_gold', 3, 4)
    c.obj('smith_armor_stand_steel', 4, 4)
    c.obj('smith_rack_spears_three', 1, 8)
    c.obj('smith_rack_swords_three', 2, 8)
    c.obj('royal_statue_goddess_r', 5, 9)
    c.obj('royal_vase_flowers_red', 1, 12)
    c.obj('living_chest_brown', 2, 13)
    c.obj('royal_banner_stand_flat', 4, 12)
    # 오른쪽: 알현 대기 — 붉은 소파 · 둥근 융단과 탁자 · 여신상 · 꽃병 · 천구의
    c.obj('royal_statue_goddess_l', 13, 4)
    c.obj('royal_vase_flowers_yellow', 16, 4)
    c.obj('royal_armillary_gold', 18, 4)
    c.obj('royal_sofa_red', 14, 7)
    c.obj('royal_rug_round_red', 14, 9)
    c.obj('tailor_round_table_gold', 14, 9)
    c.obj('royal_vase_small_purple', 14, 9)
    c.obj('royal_jewel_box_red', 15, 10)
    c.obj('living_chair_up', 14, 11)
    c.obj('living_chair_up', 15, 11)
    c.obj('royal_velvet_pillar_l', 7, 9)
    c.obj('royal_velvet_pillar_r', 11, 9)
    c.obj('royal_vase_flowers_blue', 18, 9)
    c.obj('royal_statue_knight', 17, 12)
    c.obj('royal_banner_stand_v', 12, 12)
    c.obj('royal_bear_rug_small', 5, 6)
    # ── 서재: 벽에 넓은 책장 셋 · 긴 아치 창 · 지도, 가운데 책상 둘 · 천구의 · 지구의 · 융단
    c.obj('living_bookcase_wide', 20, 3)
    c.obj('living_bookcase_wide', 22, 3)
    c.obj('royal_window_tall_white', 25, 1)
    c.obj('living_bookcase_wide', 27, 3)
    c.obj('living_bookcase', 29, 3)
    c.obj('royal_painting_landscape', 31, 2)
    c.obj('living_wall_clock', 30, 1)
    c.obj('royal_globe', 32, 4)
    c.obj('royal_desk_books_chairs', 21, 6)
    c.obj('royal_armillary_silver', 24, 6)
    c.kind(1, 'A2:26', rect(26, 6, 5, 3))
    c.obj('royal_desk_books_chair', 27, 6)
    c.obj('royal_table_square', 29, 6)
    c.obj('house_books_scroll', 30, 7, layer=4)
    c.obj('living_plant_palm', 32, 8)
    c.obj('living_chest_brown_b', 20, 9)
    c.obj('royal_vase_flowers_purple', 24, 9)
    # ── 왕의 침실: 커튼 창 · 붉은 커튼 · 금테 초상, 벽에 침대 둘을 붙여 큰 침대 · 협탁 · 옷장 · 곰 가죽 깔개 · 화장대
    c.obj('royal_window_curtain_white', 21, 11)
    c.obj('royal_portrait_tiny', 24, 12)
    c.obj('royal_banner_rod_v', 25, 12)
    c.obj('royal_window_valance_white', 27, 11)
    c.obj('tailor_wardrobe_big_closed', 30, 12)
    c.obj('living_nightstand', 20, 14)
    c.obj('royal_vase_small_red', 20, 14)
    c.obj('tavern_bed_red', 21, 14)
    c.obj('tavern_bed_red', 23, 14)
    c.obj('living_nightstand', 25, 14)
    c.obj('royal_bear_rug_big', 21, 18)
    c.obj('royal_sofa_red', 27, 19)
    c.obj('royal_table_square_cloth', 28, 15)
    c.obj('royal_vase_small_blue', 29, 16)
    c.obj('royal_jewel_box_red', 28, 16)
    c.obj('royal_footstool_red', 27, 16)
    c.obj('royal_vase_flowers_purple', 32, 15)
    c.obj('living_mirror_gold', 20, 12)
    c.obj('royal_vase_grey', 32, 18)
    c.obj('living_chest_brown', 20, 21)
    c.obj('royal_statue_goddess_l', 32, 20)
    c.obj('royal_rug_round_red_small', 25, 20)
    c.obj('royal_desk_books_chair', 29, 21)
    c.obj('royal_armillary_silver', 31, 22)
    c.obj('royal_banner_stand_flat', 23, 21)
    # ── 근위대 방: 문장 방패 · 창 걸이, 무기대 · 투구 받침 · 궤짝 · 탁자와 걸상
    c.obj('smith_shield_crest', 2, 17)
    c.obj('smith_spears_wall', 3, 18)
    c.obj('royal_pennant', 7, 17)
    c.obj('smith_shield_round', 8, 18)
    c.obj('smith_rack_sword_one', 1, 18)
    c.obj('smith_rack_spears_two', 2, 18)
    c.obj('storage_helmet_stand_plume', 3, 19)
    c.obj('tavern_bed_brown', 1, 21)
    c.obj('living_chest_brown_b', 3, 22)
    c.obj('storage_chest_strap_grey', 7, 22)
    c.obj('living_table_low_wood', 8, 20)
    c.obj('smith_daggers_lying_four', 8, 20)
    c.obj('living_stool_round', 7, 20)
    c.obj('living_stool_round', 8, 21)
    c.obj('smith_barrel_single', 9, 22)
    c.obj('smith_armor_stand_steel', 7, 19)
    # ── 식당: 러너 깐 긴 탁자 · 음식 · 촛대 벽, 찬장
    c.obj('royal_painting_vase_oval', 12, 17)
    c.obj('royal_red_cloth_panel', 16, 18)
    c.obj('royal_pennant', 17, 17)
    c.obj('royal_table_long_runner', 11, 19)
    c.obj('house_plate_roast', 12, 20)
    c.obj('house_wine_bottle_glass', 11, 20)
    c.obj('living_hutch_dishes', 17, 18)
    c.obj('tavern_barrel_upright', 18, 22)
    c.obj('royal_vase_flowers_yellow', 16, 22)
    c.obj('tavern_barrel_lying_pair', 16, 21)
    c.obj('living_crate_pots', 11, 22)
    c.obj('living_chair_left', 14, 20)
    return c



@example
def ex_dungeon(ctx):
    """지하 묘지 던전 32×22 — 입구 홀 / 석관 묘실 / 감옥(쇠창살·형틀·족쇄·핏자국) / 창고 / 의식실(제단 보석·붉은 깔개).
    벽은 회색 벽돌(A4), 바닥은 방마다 다른 돌. 뼈·핏자국·돌 부스러기는 2층으로 1~2칸마다 흩는다. 좌우 대칭 금지."""
    c = Canvas(ctx, 'rasak_dungeon', 32, 22, 'ex_dungeon', 'Rasak 예제 · 지하 묘지 던전(묘실·감옥·창고·의식실)')
    TOP, WALL, WALL2 = 'A4:0', 'A4:8', 'A4:9'
    F1, F2, F3 = 'A2:0', 'A2:1', 'A2:2'
    interior(c, TOP, [
        (1, 1, 11, 9, WALL, F1),     # 묘실
        (13, 1, 20, 8, WALL2, F2),   # 감옥
        (22, 1, 30, 10, WALL, F3),   # 의식실
        (1, 11, 9, 20, WALL2, F2),   # 창고
        (11, 10, 20, 20, WALL, F1),  # 입구 홀
        (22, 12, 30, 20, WALL2, F2), # 옆 굴
    ], doors=door_v(12, 6, F1) + door_v(21, 6, F2) + door_h(5, 10, F2) + door_h(16, 9, F1) + door_v(10, 17, F2) + door_v(21, 17, F2) + door_h(26, 11, F2) + [(15, 21, F1)])
    # ── 묘실: 석관 줄(서로 다른 모양) · 묘비 · 유골 단지 · 벽 선반
    c.obj('crypt_wall_shelf_38', 2, 2)
    c.obj('crypt_wall_shelf_54', 7, 1)
    c.obj('crypt_sarcophagus_a', 2, 3)
    c.obj('crypt_sarcophagus_c', 5, 3)
    c.obj('crypt2_stone_sarcophagus_big', 7, 5)
    c.obj('crypt_tomb_tall_a', 1, 6)
    c.obj('crypt_tomb_low_b', 4, 7)
    c.obj('crypt_headstone_round_b', 10, 3)
    c.obj('crypt_urn_large_56', 8, 3)
    c.obj('crypt_urn_bones_spill', 11, 3)
    c.obj('crypt_stone_post_small_blue', 3, 9)
    c.obj('crypt_urn_small_gold', 6, 9)
    c.obj('crypt_bones_pile_a', 5, 6)
    c.obj('crypt2_bone_long_18', 2, 5)
    c.obj('dungeon_pebble_beige_1', 10, 8)
    c.obj('crypt_pebbles', 7, 8)
    # ── 감옥: 쇠창살 칸 · 형틀 · 족쇄 · 해골 · 핏자국
    for x in (13, 14, 15, 16):
        c.obj('dungeon_iron_grate', x, 5)
    c.obj('dungeon_iron_grate_b', 16, 4)
    c.obj('dungeon_chain_hang', 14, 2)
    c.obj('crypt2_skeleton_sitting', 13, 3)
    c.obj('dungeon_shackle', 15, 3)
    c.obj('dungeon_blood_pool', 14, 4)
    c.obj('dungeon_pillory', 18, 3)
    c.obj('dungeon_blood_drip_215', 17, 6)
    c.obj('dungeon_bench_bones_212', 20, 3)
    c.obj('dungeon_stool_wood_71', 19, 7)
    c.obj('dungeon_candle_lit', 20, 8)
    c.obj('dungeon_skull_small', 13, 7)
    c.obj('dungeon_blood_spots_175', 15, 7)
    c.obj('dungeon_iron_bar_lying', 17, 8)
    # ── 의식실: 제단 보석 둘(색 다름) · 붉은 깔개 · 옥좌 · 초 · 석상
    c.obj('temple_carpet_red_v', 26, 5)
    c.obj('temple_carpet_red_v', 26, 8)
    c.obj('dungeon_frame_red_orb', 25, 3)
    c.obj('crypt_dark_statue_a', 23, 3)
    c.obj('crypt_dark_statue_b', 28, 3)
    c.obj('dungeon_frame_green_orb', 29, 6)
    c.obj('crypt2_candle_tall', 24, 6)
    c.obj('crypt2_candle_skull_52', 28, 8)
    c.obj('crypt_stone_altar_a', 22, 8)
    c.obj('crypt_bones_row_a', 29, 9)
    c.obj('dungeon_blood_smear_223', 27, 7)
    c.obj('crypt_rag_orange_c', 23, 10)
    # ── 창고: 궤·상자·자루·통나무·선반
    c.obj('dungeon_shelf_wood_low', 1, 13)
    c.obj('dungeon_cabinet_wood_157', 4, 13)
    c.obj('dungeon_cabinet_wood_red', 5, 13)
    c.obj('dungeon_chest_lock_closed', 7, 13)
    c.obj('dungeon_chest_gem_closed', 8, 13)
    c.obj('dungeon_crate_wood_224', 1, 16)
    c.obj('dungeon_crate_wood_b_240', 2, 16)
    c.obj('dungeon_sack_upright_238', 1, 18)
    c.obj('dungeon_log_lying', 4, 19)
    c.obj('dungeon_chest_plain_open', 8, 17)
    c.obj('dungeon_iron_stand_228', 6, 16)
    c.obj('crypt_urn_tall_74', 3, 17)
    c.obj('dungeon_pebble_dark_186', 6, 18)
    c.obj('crypt2_wood_planks', 8, 20)
    c.obj('dungeon_moss_speck', 4, 15)
    # ── 입구 홀: 기둥 줄(한쪽만) · 횃대 · 긴 탁자 · 흩어진 뼈
    c.obj('crypt_stone_pillar_176', 12, 13)
    c.obj('crypt_stone_pillar_192', 12, 17)
    c.obj('crypt2_torch_stand', 19, 12)
    c.obj('crypt2_wooden_table_long', 14, 14)
    c.obj('crypt2_coffin_lying_26', 18, 17)
    c.obj('crypt2_skeleton_standing_36', 20, 15)
    c.obj('crypt2_bones_heap_9', 13, 19)
    c.obj('crypt2_bones_small_1', 17, 19)
    c.obj('dungeon_crack_diag_a_130', 19, 19)
    c.obj('dungeon_blood_drop_214', 14, 18)
    c.obj('crypt_floor_stain_dark_2', 11, 15)
    c.obj('dungeon_bones_lying', 15, 12)
    # ── 옆 굴: 세운 관 · 관 더미 · 부서진 관 · 해골
    c.obj('crypt2_coffin_upright_a', 22, 14)
    c.obj('crypt2_coffin_upright_dark_a', 23, 14)
    c.obj('crypt2_coffin_upright_dark_b', 25, 14)
    c.obj('crypt2_wooden_coffin_stack', 27, 14)
    c.obj('crypt2_coffin_lying_open', 23, 18)
    c.obj('crypt2_coffin_broken', 29, 18)
    c.obj('crypt2_skeleton_standing_37', 26, 17)
    c.obj('crypt2_skull_mossy_96', 30, 17)
    c.obj('crypt2_bones_small_3', 25, 20)
    c.obj('dungeon_ribcage', 27, 19)
    c.obj('crypt_pebble_tiny', 22, 20)
    return c



def rampart(c, x, y, w, top='A4:0', face='A4:8', top_h=2, face_h=2):
    """성벽 한 토막: A4 윗면(통로) top_h 줄 + 벽면 face_h 줄. 오른쪽 칸에 그림자."""
    c.kind(1, top, rect(x, y, w, top_h))
    c.kind(1, face, rect(x, y + top_h, w, face_h))
    for j in range(top_h + face_h):
        c.shadow(x + w, y + j, 5)


@example
def ex_castle_court(ctx):
    """성 안뜰과 폐허 36×26 — 북쪽 성벽(흉벽·성탑 둘·아치 성문) / 안뜰 돌길 / 동쪽 나무 요새(망루·말뚝 벽) / 서남쪽 무너진 폐허 / 해자.
    같은 모양 되풀이 금지: 성탑은 지붕 색이 다르고, 성벽 벽면에 창·문 리듬을 넣는다."""
    c = Canvas(ctx, 'rasak_castle', 36, 26, 'ex_castle_court', 'Rasak 예제 · 성 안뜰과 폐허(성벽·성문·망루·폐허·해자)')
    c.kind(1, 'A2:0', rect(0, 0, 36, 26))
    # 들풀 얼룩과 짙은 풀
    c.kind(1, 'A2:8', blob(26, 18, [(0, 5), (-1, 7), (0, 8), (1, 6)]) + blob(0, 20, [(0, 6), (0, 7), (0, 6), (0, 5), (0, 4), (0, 3)]))
    # ── 북쪽 성벽(y=2..5) · 서쪽 탑 · 동쪽 탑
    rampart(c, 3, 2, 20)
    c.obj('castle_battlement_gray', 5, 2)
    c.obj('castle_battlement_gray', 11, 2)
    c.obj('castle_battlement_gray', 17, 2)
    for x, o in ((4, 'castle_slit_stone_a_152'), (7, 'castle_window_wood_slit_shut_a'), (15, 'castle_slit_stone_lit_a'), (19, 'castle_window_wood_slit_dark_a_153'), (21, 'castle_slit_stone_b')):
        c.obj(o, x, 4)
    c.obj('castle_wall_arch_gate_open', 11, 4)
    c.obj('castle_round_tower_gray_3', 0, 4)
    c.obj('castle_tower_roof_cone_red', 0, 0)
    c.obj('castle_round_tower_gray_3', 23, 4)
    c.obj('castle_tower_roof_cone_blue', 23, 0)
    # ── 해자(성벽 앞 물, 성문 앞은 도개교)
    c.kind(1, 'A1:8', rect(0, 7, 11, 2) + rect(14, 7, 12, 2))
    c.obj('castle_drawbridge_chain', 11, 5, over=True)
    c.kind(1, 'A5:cobble_road', rect(12, 6, 1, 3))
    # ── 안뜰 돌길(성문에서 남으로, 굽어 요새·폐허로 갈라짐)
    road = path([(12, 9), (12, 14), (20, 14), (20, 17)], width=2) + path([(12, 14), (6, 14), (6, 18)], width=1)
    c.kind(1, 'A2:3', road)
    c.kind(1, 'A5:stone_slab_floor', rect(9, 11, 7, 2))
    # 안뜰 소품: 나무 · 난간 · 기둥 · 잔돌 · 들풀(1~2칸마다 무엇이든 있게, 한쪽으로 치우쳐)
    c.obj('castle_railing_iron', 16, 10)
    c.obj('castle_railing_wood', 7, 10)
    c.obj('ruins2_pillar_short_grey', 16, 12)
    c.obj('ruins2_stone_bit_grey', 14, 10)
    c.obj('trees_summer_small_leafy_a', 3, 12)
    c.obj('trees_summer_birch_leafy', 9, 15)
    c.obj('trees_summer_tall_leafy', 16, 15)
    c.obj('trees_summer_sparse_leafy', 23, 9)
    c.obj('trees_summer_fir_lone', 24, 13)
    c.obj('trees_summer_small_leafy_b', 14, 17)
    c.obj('trees_summer_birch_leafy_b', 3, 15)
    c.obj('ruins2_stone_bit_dark', 18, 11)
    c.obj('ruins_rubble_small_69', 22, 16)
    c.obj('trees_summer_log_moss', 19, 10)
    c.obj('trees_summer_dead_bush', 10, 9)
    c.obj('castle_wood_pole_crossbar', 8, 12)
    c.obj('trees_summer_sapling_leafy', 21, 12)
    c.kind(2, 'A2:13', [(10, 10), (15, 9), (8, 13), (17, 13), (3, 11), (13, 16), (19, 16), (11, 18)])
    c.kind(2, 'A2:5', [(4, 10), (1, 12), (22, 10), (9, 17), (25, 16), (5, 17)])
    c.kind(2, 'A2:7', [(2, 9), (3, 9), (18, 9), (25, 9), (26, 9), (22, 14), (7, 16)])
    c.kind(2, 'A2:23', [(15, 11), (5, 13), (13, 13), (23, 11)])
    forest(c, blob(0, 9, [(0, 2), (0, 2), (0, 3), (0, 3), (0, 2)]), 3, edge=('trees_summer_sapling_leafy', 'trees_summer_fir_seedling', 'trees_summer_sapling_leafy'))
    # ── 동쪽 나무 요새(말뚝 벽·망루·성문)
    c.obj('fort_palisade_wall_wide', 27, 3)
    c.obj('fort_watchtower_wide', 31, 1)
    c.obj('fort_palisade_wall_two_doors', 28, 12)
    c.obj('fort_gate_frame_open', 33, 12)
    c.obj('fort_flag_pole', 26, 6)
    c.obj('fort_watchtower_narrow_a', 33, 16)
    c.obj('fort_ladder_narrow', 32, 18)
    c.kind(1, 'A2:1', path([(34, 15), (34, 24)], width=1) + path([(22, 17), (34, 17)], width=1))
    # ── 서남쪽 폐허(무너진 탑·아치 문·잔해·돌 더미)
    c.obj('ruins2_arch_gate_grey', 1, 18)
    c.obj('ruins2_wall_piece_dark', 6, 19)
    c.obj('ruins_pillar_thin', 9, 19)
    c.obj('ruins2_wall_corner_grey', 11, 20)
    c.obj('ruins_rubble_block', 8, 23)
    c.obj('ruins2_rubble_pile_dark', 13, 21)
    c.obj('ruins2_stone_bit_dark', 5, 24)
    c.obj('ruins_rubble_small_189', 10, 22)
    c.obj('ruins2_ledge_grey', 2, 23)
    c.obj('ruins2_pillar_short_dark', 18, 20)
    c.obj('ruins2_wall_arch_low_grey', 20, 20)
    c.kind(2, 'A2:13', [(7, 22), (12, 24), (17, 23), (4, 21)])
    c.kind(2, 'A2:23', [(15, 20), (19, 25), (0, 25), (25, 24), (28, 22)])
    c.obj('trees_summer_gnarled_bare', 17, 23)
    c.obj('trees_summer_bare_small', 25, 19)
    c.obj('ruins2_stone_bit_grey', 17, 22)
    c.obj('ruins_rubble_small_69', 0, 24)
    c.obj('trees_summer_log_hollow', 11, 25)
    c.kind(2, 'A2:5', [(3, 25), (9, 21), (16, 21), (21, 23)])
    # 남동 풀밭: 숲 가장자리
    forest(c, blob(24, 21, [(2, 8), (1, 9), (0, 10), (0, 10), (0, 10)]), 7, edge=('trees_summer_sapling_leafy', 'trees_summer_fir_seedling', 'trees_summer_sapling_leafy'))
    return c
