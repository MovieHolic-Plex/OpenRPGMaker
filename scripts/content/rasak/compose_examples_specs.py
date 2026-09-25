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


def forest(c, cells, seed):
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
            c.obj(['garden_bush_green', 'garden_bush_green', 'garden_bush_roses'][rnd.randrange(3)], x, y)


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
