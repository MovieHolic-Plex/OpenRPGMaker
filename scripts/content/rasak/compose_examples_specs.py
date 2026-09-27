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


# 밭 작물 줄: 3칸 주기로 돌리면 격자처럼 보인다(확대 QA 2026-09-27). 7칸 순열을 다른 보폭으로 읽어 이웃과 주기가 맞지 않게 한다.
CROP_ROW_A = ['crops_carrot_grown', 'crops_pumpkin_grown', 'crops_blade_crop_grown', 'crops_carrot_grown', 'crops_blade_crop_grown_b', 'crops_pumpkin_grown', 'crops_blade_crop_grown']
CROP_ROW_B = ['crops_blade_crop_grown_b', 'crops_carrot_grown', 'crops_pumpkin_flower', 'crops_blade_crop_grown', 'crops_pumpkin_flower', 'crops_carrot_grown', 'crops_blade_crop_grown_b']
BIG_TREES = ['trees_summer_oak_big', 'trees_summer_oak_big_b', 'trees_summer_fir_pair_a', 'trees_summer_fir_pair_b']
MID_TREES = ['trees_summer_tall_leafy', 'trees_summer_gnarled_leafy', 'trees_summer_fir_big', 'trees_summer_round_small',
             'trees_summer_birch_leafy_b', 'trees_summer_small_leafy_b', 'trees_summer_small_leafy_a']


def dark_grass(c, cells):
    """짙은 풀 얼룩(A2:8, 1층) + 같은 칸 전체에 밝은 풀 가장자리(A2:4, 2층).
    A2:4 는 가운데가 투명하고 바깥 둘레만 풀잎이 안쪽으로 번지는 자동타일이라, 얼룩 전체를 한 덩이로 칠해야
    둘레 모양이 얼룩 윤곽과 맞는다(둘레 한 줄만 칠하면 고리 모양으로 계산돼 밝은 띠가 생긴다).
    짙은 풀과 밝은 풀 사이에 전환 그림이 따로 없어 경계가 네모로 보이던 것을 이것으로 감춘다(확대 QA 2026-09-27 3차)."""
    c.kind(1, 'A2:8', cells)
    dv = c.ctx.key_value(c.b, 'A2:8')
    c.kind(2, 'A2:4', [(x, y) for (x, y) in cells if c.ok(x, y) and c.L[1][y * c.w + x] == dv])


def dark_grass_finish(c, cells):
    """나중에 길·물을 칠해 짙은 풀이 아니게 된 칸의 가장자리 풀(2층)을 걷어낸다 — 길 가에 밝은 풀 띠가 생긴다."""
    dv, rim = c.ctx.key_value(c.b, 'A2:8'), c.ctx.key_value(c.b, 'A2:4')
    for (x, y) in cells:
        if c.ok(x, y) and c.L[2][y * c.w + x] == rim and c.L[1][y * c.w + x] != dv:
            c.L[2][y * c.w + x] = None


def obj_rows(c, oid, x, y, r0, r1, layer=None):
    """물체의 r0..r1-1 줄만 (x,y) 에 찍는다 — 탑 몸통처럼 한 이름표 안의 위·아래를 따로 쓸 때(원뿔 지붕 + 긴 몸통)."""
    o = c.ctx.object(c.b, oid)
    ly = layer or o['layer']
    for r, row in enumerate(o['cells'][r0:r1]):
        for cc, t in enumerate(row):
            if t >= 0 and c.ok(x + cc, y + r):
                prev = c.owner.get((ly, (y + r) * c.w + x + cc))
                if prev:
                    c.errors.append(f'{oid}[{r0}:{r1}]@({x},{y}): {ly}층 ({x + cc},{y + r}) 에서 {prev} 를 덮어씀')
                c.tile(ly, t, x + cc, y + r)
                c.owner[(ly, (y + r) * c.w + x + cc)] = oid


def tower(c, x, y, roof):
    """원뿔 지붕 탑 3×8 — 지붕(3×4, y..y+3) 아래로 몸통(황토 탑 이름표의 3~5줄 = 창 있는 돌 몸통, y+4..y+6).
    예전엔 지붕 밑에 '둥근 윗면 + 몸통' 3×3 을 따로 붙여, 지붕과 탑 머리가 두 번 겹쳐 떠 보였다(적대적 QA 2026-09-27)."""
    obj_rows(c, 'castle_round_tower_tan_top', x, y + 4, 3, 6)
    c.obj(roof, x, y)


THIN_TREES = ('trees_summer_tall_leafy', 'trees_summer_gnarled_leafy')


def forest(c, cells, seed, edge=('garden_bush_green', 'garden_bush_green', 'garden_bush_roses')):
    """숲 벽: 큰 나무(4×4·3×4)를 빈틈없이 채우고(3층), 그 사이를 반 칸씩 어긋난 나무로 한 번 더 덮는다(4층 — 겹쳐 그림).
    수관까지 숲 칸 안에만 심는다(마을 물체를 덮지 않음). 가장자리 빈 칸만 초록 덤불로 마감한다.
    짙은 풀(A2:8) 네모 바닥·잎 없는 어린나무 무더기는 쓰지 않는다 — 계단 얼룩, 죽은 숲처럼 보인다."""
    import random
    rnd = random.Random(seed)
    cells = set(cells)
    taken = {3: set(), 4: set()}
    prev_in_row = {}

    def try_place(oid, x, y, layer):
        w, h = c.ctx.object(c.b, oid)['size']
        foot = {(x + i, y + j) for j in range(h) for i in range(w)}
        if not foot <= cells or foot & taken[layer]:
            return False
        c.obj(oid, x, y, layer=layer, over=True)
        taken[layer] |= foot
        return True

    xs = [x for x, _ in cells]; ys = [y for _, y in cells]
    # 왼위부터 차례로 채우면 같은 크기 나무가 격자로 나란히 선다(확대 QA 2026-09-27 2차: 맵 가장자리 나무 줄이
    # 같은 간격·같은 높이로 심은 것처럼 보임). 칸 순서를 섞고, 큰 나무는 옆 나무와 꼭짓점이 맞지 않게
    # 반 칸쯤 어긋난 자리를 먼저 고른다. 3층은 섞인 순서로 한 번, 남은 틈은 작은 나무로 다시 메운다.
    # 큰 나무부터 왼위→오른아래로 채우면 4×4 나무가 4칸 간격 격자로 줄지어 선다(확대 QA 2026-09-27 2차: 가장자리 나무 줄이
    # 같은 간격·같은 높이로 심은 것처럼 보임). 촘촘한 줄 스캔은 그대로 두되, 크기를 섞어 뽑고 나무마다 위아래로 0~1칸 흔든다.
    # 4층(덮어 그리는 나무)에 흰 줄기 자작나무를 쓰면 다른 나무 수관 한가운데 흰 기둥이 박혀 고사목처럼 보인다(적대적 QA 2026-09-27)
    cover = [t for t in MID_TREES if 'birch' not in t] + BIG_TREES[:2]
    for layer, pool, off in ((3, BIG_TREES + MID_TREES[:3], 0), (4, cover, 1)):
        for y in range(min(ys) - 1, max(ys) + 1):
            for x in range(min(xs) - off, max(xs) + 1):
                recent = prev_in_row.setdefault((layer, y), [])
                order = rnd.sample(pool, len(pool))
                # 키 큰 나무·옹이 나무(2×3)는 줄기가 길고 수관이 작아 얕은 띠(아래 칸이 숲 밖)에 줄지어 서면 기둥 울타리처럼 보인다
                # (확대 QA 2026-09-27 2차: 검은 지붕 집 위 띠) — 아래 두 칸이 숲 안일 때만 쓴다
                if not all((x + off, y + off + k) in cells for k in (3, 4, 5)):   # 얕은 띠(5줄 이하)엔 줄기 긴 나무가 기둥 줄처럼 선다
                    order = [o for o in order if o not in THIN_TREES] + [o for o in order if o in THIN_TREES][:0]
                side = {c.owner.get((ly, (y + dy) * c.w + x + dx)) for ly in (3, 4) for dx in range(-5, 6) for dy in range(-4, 3)
                        if 0 <= x + dx < c.w and 0 <= y + dy < c.h}   # 3층·4층 모두 — 층끼리 같은 나무가 겹쳐 서던 것
                # 같은 나무가 한 줄에 연달아(또는 ABAB 로) 서면 울타리처럼 보인다 — 직전 두 나무·좌우 이웃과 같은 종은 뒤로
                # 키 큰 나무·옹이 나무는 줄기 길고 수관 작은 비슷한 그림이라, 번갈아 서도 한 줄 기둥처럼 보인다 — 한 무리로 본다
                if side & set(THIN_TREES):
                    side |= set(THIN_TREES)
                order = [o for o in order if o not in recent[-2:] and o not in side] + [o for o in order if o in recent[-2:] or o in side]
                jitter = rnd.choice((0, 0, 1))
                for oid in order:
                    if try_place(oid, x + off, y + off + jitter, layer) or (jitter and try_place(oid, x + off, y + off, layer)):
                        recent.append(oid)
                        break
    # 빈틈 메우기: 섞은 순서로 심으면 큰 나무 사이에 풀밭이 남아 공원처럼 보인다 — 비어 있는 칸마다 4층에 한 번 더 심는다
    for (x, y) in sorted(cells - (taken[3] | taken[4]), key=lambda p: (p[1], p[0])):
        if (x, y) in taken[3] | taken[4]:
            continue
        pool = rnd.sample(MID_TREES, len(MID_TREES))
        for oid in pool:
            w, h = c.ctx.object(c.b, oid)['size']
            if any(try_place(oid, x - dx, y - dy, 4) for dx in range(w) for dy in range(h)):
                break
    covered = taken[3] | taken[4]
    for (x, y) in sorted(cells - covered):
        near_village = any((x + dx, y + dy) not in cells for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        if not near_village and c.L[3][y * c.w + x] is None:
            # 숲 안쪽 한 칸 틈은 나무가 안 들어가 풀밭 구멍이 된다 — 덤불로 덮는다
            nb = {c.owner.get((3, (y + dy) * c.w + x + dx)) for dx, dy in ((0, -1), (-1, 0)) if 0 <= x + dx < c.w and 0 <= y + dy < c.h}
            opts = [e for e in edge if e not in nb] or list(edge)
            c.obj(opts[rnd.randrange(len(opts))], x, y)
            continue
        if near_village and c.L[3][y * c.w + x] is None:
            # 가장자리 마감도 같은 덤불이 한 줄로 이어지지 않게 — 위·왼쪽 이웃과 다른 것을 먼저 고른다
            nb = {c.owner.get((3, (y + dy) * c.w + x + dx)) for dx, dy in ((0, -1), (-1, 0)) if 0 <= x + dx < c.w and 0 <= y + dy < c.h}
            opts = [e for e in edge if e not in nb] or list(edge)
            if rnd.random() < 0.3:          # 세 칸에 한 칸쯤은 비워 덤불 줄이 끊기게
                continue
            c.obj(opts[rnd.randrange(len(opts))], x, y)


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
    c.kind(1, 'A2:1', path([(16, 18), (22, 18), (22, 21), (22, 23)]))           # 집 D 문(22,20) 아래 — 맵 아래 끝까지(끊긴 1칸 섬 해소)
    # 집 D 문 앞 길이 마을 길과 끊긴 3칸 섬이었다(확대 QA 2026-09-27 2차) — 문 앞에서 큰길(15,21)까지 잇는다
    c.kind(1, 'A2:1', path([(16, 21), (22, 21)]))
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
    # 밭: 갈색 흙 + 작물 두 줄(가운데 흙길 한 줄) + 울타리 네 면(아래 가운데 두 칸이 입구) + 허수아비
    # 오른쪽·아래 울타리가 없어 밭이 열려 보였다(확대 QA 2026-09-27 2차)
    # 밭 4줄(y16~19) — 세로 울타리 v4(4칸)와 딱 맞게. 5줄이던 때 아래 모서리가 비어 열려 보였다.
    c.kind(1, 'A2:16', rect(4, 16, 8, 4))
    for i in range(8):
        c.obj(CROP_ROW_A[(i * 5 + 2) % 7], 4 + i, 16)
        c.obj(CROP_ROW_B[(i * 3 + 1) % 7], 4 + i, 18)
        if i not in (3, 4):
            c.obj('crops_seed_mounds_six', 4 + i, 19)
    c.obj('town_scarecrow', 8, 17)
    c.obj('town_wattle_fence_h4', 3, 15)
    c.obj('town_wattle_fence_h4', 7, 15)
    c.obj('town_wattle_fence_h2', 11, 15)
    c.obj('town_wattle_fence_v4', 3, 16)
    c.obj('town_wattle_fence_v4', 12, 16)
    c.obj('town_wattle_fence_h4', 3, 20)   # 아래 울타리 — 가운데 7·8 두 칸이 입구
    c.obj('town_wattle_fence_h4', 9, 20)
    # 연못(들쭉날쭉) + 물가 덤불·디딤돌
    c.kind(1, 'A1:0', blob(27, 13, [(2, 3), (0, 5), (1, 4)]))
    for x, y in ((26, 14), (25, 15), (26, 16)):
        c.obj('garden_stepping_stones_94', x, y)
    c.obj('garden_bush_green', 27, 13)
    c.obj('garden_bush_roses', 32, 14)
    # 풀밭 곳곳: 덤불·꽃·어린나무·열매(빈 풀밭 3×3 이 남지 않게)
    for oid, x, y in [('garden_flowers_red_row', 18, 14),
                      ('garden_bush_green', 10, 23), ('trees_summer_round_small', 4, 22), ('crops_fallen_berries_small_red', 9, 22),
                      ('garden_bush_roses', 13, 20), ('trees_summer_small_leafy_c', 12, 22), 
                      ('garden_flowers_yellow_row', 19, 12), ('garden_bush_green', 26, 5),
                      ('garden_bush_green', 15, 5), ('garden_flowerpot_red', 16, 8),
                      ('trees_summer_fruit_a', 29, 5), ('garden_bush_roses', 20, 22),
                      ('garden_stepping_stones_110', 18, 23), ('garden_bush_green', 26, 23),
                      ('trees_summer_sapling_leafy', 24, 14), ('garden_bush_green', 13, 10)]:
        c.obj(oid, x, y)
    # 애니 소품: 모닥불 · 풍경 · 그네 — 빈 풀밭에만(풍차는 6×6 이라 빈 자리가 있을 때만)
    import random as _r
    _rnd = _r.Random(9)
    road = c.ctx.key_value(c.b, 'A2:1')
    grass = c.ctx.key_value(c.b, 'A2:0')
    for oid in ('anim_windmill', 'anim_campfire', 'anim_windchime', 'anim_swing', 'anim_campfire2'):
        w_, h_ = c.ctx.object(c.b, oid)['size']
        for _ in range(200):
            x, y = _rnd.randrange(c.w), _rnd.randrange(c.h)
            # 흙길(문 앞 길 포함) 위와 바로 옆에는 놓지 않는다 — 문 앞을 막는다(확대 QA 2026-09-27)
            if any(c.ok(x + dx, y + dy) and c.L[1][(y + dy) * c.w + x + dx] == road for dx in range(-1, w_ + 1) for dy in range(-1, h_ + 1)):
                continue
            # 밭 흙(짙은 갈색) 위에도 놓지 않는다 — 풀밭 칸에만(확대 QA: 그네가 밭 위에 섬)
            if not all(c.ok(x + dx, y + dy) and c.L[1][(y + dy) * c.w + x + dx] == grass for dx in range(w_) for dy in range(h_)):
                continue
            if c.try_obj(oid, x, y):
                break
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
    # 가게 판매대 앞 길이 한 칸짜리 흙 꼬투리로만 보였다(확대 QA 2026-09-27 2차) — 판매대 앞 칸까지 두 칸 폭으로 닿게
    sx0, sy0 = store[0]
    c.kind(1, 'A2:1', rect(sx0 - 1, sy0, 2, 14 - sy0))
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
        c.obj(CROP_ROW_A[(i * 5 + 2) % 7], 5 + i, 18)
        c.obj(CROP_ROW_B[(i * 3 + 1) % 7], 5 + i, 20)
        if i not in (4, 5):
            c.obj('crops_seed_mounds_six', 5 + i, 22)
    c.obj('town_scarecrow', 9, 19)
    c.obj('town_wattle_fence_h4', 4, 17)
    c.obj('town_wattle_fence_h4', 8, 17)
    c.obj('town_wattle_fence_h2', 12, 17)
    c.obj('town_wattle_fence_v4', 4, 18)
    c.obj('town_wattle_fence_v2_l', 4, 22)
    # 오른쪽 면이 통째로 비어 밭이 덜 지은 것처럼 보였다(확대 QA 2026-09-27 2차) — 위·아래를 막고 가운데 두 칸(20·21)만 입구로
    c.obj('town_wattle_fence_v2_r', 14, 18)
    c.obj('town_wattle_fence_v2_r', 14, 22)
    c.obj('town_wattle_fence_h4', 4, 24)
    c.obj('town_wattle_fence_h4', 8, 24)
    c.obj('town_wattle_fence_h2', 12, 24)
    # 연못(들쭉날쭉) + 물가 덤불
    # 연못 동쪽 끝(27열)이 창고 가는 길을 끊어 길이 섬이 됐다(확대 QA 2026-09-27 2차) — 한 칸 줄임
    c.kind(1, 'A1:0', blob(23, 23, [(1, 3), (0, 4), (1, 3)]))
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
                      
                      ('garden_bush_green', 13, 16), ('garden_flowers_yellow_row', 25, 16), ('garden_bush_green', 36, 1)]:
        c.obj(oid, x, y)
    c.try_obj('garden_flowers_mixed_row', 11, 26) or c.try_obj('garden_flowers_mixed_row', 12, 25)   # 숲 가장자리 덤불이 먼저 서면 옆으로
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
    c.kind(1, PAVE, [(18, 15), (19, 15), (19, 16)])                          # 광장과 집 사이에 풀 3칸이 섬처럼 남던 것 메움(확대 QA 2026-09-27)
    c.kind(1, PAVE, rect(14, 4, 1, 8))                                       # 집 줄 사이 골목(뒤뜰로)
    # 골목이 풀밭 한가운데 장작 궤짝 옆에서 뚝 끊겼다(확대 QA 2026-09-27 2차) — 빨래 걸이·장작이 놓인 뒤뜰 포장으로 받는다
    c.kind(1, PAVE, rect(12, 4, 5, 2))
    # 노점 몸체 아래가 광장 바깥 풀밭이라 판매대 안쪽으로 풀이 비쳤다(확대 QA 2026-09-27 2차) — 노점 칸 전체와 한 칸 둘레를 포장
    c.kind(1, PAVE, rect(4, 17, 5, 6))
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
    # 애니 소품(Animations 시트, 2026-09-27): 괘종시계 · 등불 · 불 사발 · 어항 — 빈 바닥에만
    import random as _r
    _rnd = _r.Random(5)
    # 등불은 매단 그림이라 벽면에 건다(확대 QA: 바닥 한가운데 떠 있었음)
    c.obj('anim_lantern_3', 4, 1)
    c.obj('anim_lantern_1', 21, 1)
    for oid in ('anim_grandfather_clock', 'anim_firebowl_1', 'anim_aquarium_2'):
        for _ in range(60):
            if c.try_obj(oid, 1 + _rnd.randrange(c.w - 2), 3 + _rnd.randrange(c.h - 4)):
                break
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
    # 재봉 책상 셋이 2칸 간격 한 줄이면 도장 찍은 듯 보인다(확대 QA 2026-09-27) — 둘은 붙이고 분홍 책상은 아래 줄 창가로
    c.obj('tailor_sew_desk_beige', 15, 2)
    c.obj('tailor_sew_desk_blue', 17, 2)
    c.obj('tailor_sew_desk_pink', 20, 2)   # 셋째는 한 칸 띄워(19 비움) 간격을 깬다
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
    c.obj('crypt_wall_shelf_54', 7, 2)
    c.obj('crypt_sarcophagus_a', 2, 3)
    c.obj('crypt_sarcophagus_c', 5, 3)
    c.obj('crypt2_stone_sarcophagus_big', 7, 5)
    c.obj('crypt_tomb_tall_a', 1, 6)
    c.obj('crypt_tomb_low_b', 4, 7)
    c.obj('crypt_headstone_round_b', 10, 3)
    c.obj('crypt_urn_large_56', 9, 1)   # 겹아치 창(벽면 두 줄)
    c.obj('crypt_urn_bones_spill', 11, 2)   # 창살 창(벽 아랫줄) + 바닥 빛줄기
    c.obj('crypt_stone_post_small_blue', 3, 9)
    c.obj('crypt_urn_small_gold', 6, 1)   # 작은 불빛 창(벽 윗줄)
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
    c.obj('dungeon_candle_lit', 24, 6)
    c.obj('crypt2_skull_mossy_96', 28, 8)
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
    c.obj('crypt_urn_tall_74', 3, 11)   # 창고 벽 아치 창
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
    c.obj('crypt2_bone_long_19', 15, 12)
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
    # 왼아래 짙은 풀 얼룩이 한 줄에 한 칸씩 줄어드는 계단 모양이었다(확대 QA 2026-09-27 2차) — 줄마다 들쭉날쭉한 둥근 덩이로
    # 짙은 풀 얼룩 둘은 가장자리를 감춰도 네모 그림자 판처럼 보여(적대적 QA 2026-09-27 4차) 성 안뜰에선 쓰지 않는다
    dark = []
    # ── 북쪽 성벽(y=2..5) · 양끝 성탑
    # 적대적 QA 2026-09-27: 탑이 성벽 밖으로 삐져 해자 위에 서 있고(몸통 y4..6 이 성벽 벽면 y4..5 보다 한 줄 아래),
    # 원뿔 지붕 밑에 '둥근 윗면 + 몸통' 을 또 붙여 탑 머리가 두 번 겹쳐 떠 보였다. 흉벽은 네 칸짜리 셋이 띄엄띄엄이라 성벽 윗선이 끊겼다.
    # → 성벽은 탑 사이(3..22)만, 탑은 지붕 3×4 + 창 있는 몸통 3×3(y0..6) 으로 성벽 양끝에 붙이고, 흉벽은 성벽 윗줄 전체에 잇는다.
    rampart(c, 3, 2, 20)
    for bx in range(3, 23, 4):
        obj_rows(c, 'castle_battlement_gray', bx, 2, 0, 1) if bx + 4 <= 23 else None
    for x, o in ((5, 'castle_slit_stone_a_152'), (8, 'castle_window_wood_slit_shut_a'), (16, 'castle_slit_stone_lit_a'), (19, 'castle_window_wood_slit_dark_a_153')):
        c.obj(o, x, 4)
    # 열린 성문 그림은 큰 아치 + 작은 아치 두 개라 성문이 둘로 보였다 — 큰 아치 하나(2×2)로, 도개교(2칸) 바로 위
    c.obj('castle_wall_arch_gate_dark', 11, 4)
    tower(c, 0, 0, 'castle_tower_roof_cone_red')
    tower(c, 23, 0, 'castle_tower_roof_cone_blue')
    # 탑마다 안뜰 쪽 나무 문(몸통 맨 아랫줄) — 문 없는 탑이었다
    c.obj('castle_tower_door_wood_window_b', 1, 5, over=True)     # 성한 나무 문(이름표 교정 2026-09-27 — 예전 이름 '나무 문' 은 불빛 문간이었다)
    c.obj('castle_tower_door_wood_window_b', 24, 5, over=True)
    # 탑 문 앞 길: 서쪽 탑 문(1,6) → 해자 밖 풀밭 → 성문 앞 돌길(11,8) / 동쪽 탑 문(24,6) → 안뜰 돌길(y14)
    c.kind(1, 'A2:3', path([(1, 7), (1, 8), (10, 8)], 1) + path([(24, 7), (24, 14), (21, 14)], 1))
    # ── 해자(성벽 앞 물, 성문 앞은 도개교)
    # 성벽과 해자 사이에 풀 한 줄(y6)이 남아 도개교 사슬이 풀밭에 서 있었다(적대적 QA 2026-09-27) — 해자를 성벽 바로 밑(y6..7)으로
    # 초록 벽돌 바닥 수로(A1:8)는 물이 얕게 비쳐 빈 돌 화단처럼 보였다(적대적 QA 2026-09-27) — 청록 돌 수로(A1:10)
    c.kind(1, 'A1:10', rect(3, 6, 8, 2) + rect(13, 6, 10, 2))   # 틈 = 도개교 두 칸(11..12)
    # 도개교: 판자(아래 두 줄)는 해자 틈(11..12, 6..7)에, 사슬(위 두 줄)은 성문 아치(4..5) 위 4층 — 사슬이 풀밭에 서지 않게
    obj_rows(c, 'castle_drawbridge_chain', 11, 6, 2, 4)
    obj_rows(c, 'castle_drawbridge_chain', 11, 4, 0, 2, layer=4)
    c.kind(1, 'A5:cobble_road', rect(11, 8, 2, 1))
    # ── 안뜰 돌길(성문에서 남으로, 굽어 요새·폐허로 갈라짐)
    # 서쪽 갈래는 옛 폐허로 내려가다 풀밭에서 끊겼다 — 맵 서쪽 끝으로 나가는 길로
    road = path([(11, 8), (11, 14), (20, 14), (20, 17)], width=2) + path([(12, 14), (0, 14)], width=1)
    c.kind(1, 'A2:3', road)
    # 판석 마당(9..15,11..12)은 성문 돌길 한가운데 — A5 는 길(A2:3)과 이어 붙지 않아 길이 두 토막으로 보였다. 길 동쪽 옆으로 비킨다
    # 안뜰 소품: 나무 · 난간 · 기둥 · 잔돌 · 들풀(1~2칸마다 무엇이든 있게, 한쪽으로 치우쳐)
    c.obj('ruins2_pillar_short_grey', 16, 12)
    c.obj('ruins_pebbles_red', 14, 10)
    c.obj('trees_summer_small_leafy_a', 3, 12)
    c.obj('trees_summer_birch_leafy', 9, 15)
    c.obj('trees_summer_tall_leafy', 16, 15)
    c.obj('trees_summer_sparse_leafy', 23, 9)
    c.obj('trees_summer_fir_lone', 22, 12)
    c.obj('trees_summer_small_leafy_b', 14, 17)
    c.try_obj('trees_summer_birch_leafy_b', 16, 19) or c.try_obj('trees_summer_birch_leafy_b', 19, 20)
    c.obj('ruins_rubble_small', 18, 11)
    c.obj('ruins_pebbles_red', 22, 16)
    c.obj('trees_summer_log_moss', 19, 10)
    c.obj('trees_summer_dead_bush', 10, 9)
    c.obj('castle_wood_pole_crossbar', 8, 12)
    c.obj('trees_summer_sapling_leafy', 21, 12)
    c.kind(2, 'A2:13', [(10, 10), (15, 9), (8, 13), (17, 13), (3, 11), (13, 16), (19, 16), (11, 18)])
    # 마른 덤불(A2:5)은 한 칸짜리가 건초 더미처럼 같은 모양으로 되풀이돼 보였다(적대적 QA 2026-09-27) — 성 안뜰에선 쓰지 않는다
    c.kind(2, 'A2:7', [(2, 9), (3, 9), (18, 9), (25, 9), (26, 9), (22, 14), (7, 16)])
    c.kind(2, 'A2:7', [(15, 11), (5, 13), (13, 13), (23, 11)])     # 누런 들풀(A2:23)은 한 칸짜리 건초 더미처럼 보였다
    forest(c, blob(0, 9, [(0, 2), (0, 2), (0, 3), (0, 3), (0, 2)]), 3, edge=('trees_summer_sapling_leafy', 'trees_summer_fir_seedling', 'trees_summer_sapling_leafy'))
    # ── 동쪽 나무 요새
    # 적대적 QA 2026-09-27: 말뚝 벽 토막(27..30,3..8)·망루(31..34,1..8)·문 둘 벽(28..32,12..14)·문틀(33..35) 이 서로 떨어져
    # 공중에 뜬 조각처럼 보였고, 망루엔 문이 없고 다리 밑이 비었다. 성탑(23..25)과 요새 사이도 풀밭이라 성이 안 이어졌다.
    # → 요새 남쪽 벽 한 줄(y11..13)을 성탑 옆 x26 부터 맵 끝까지 끊김 없이: 말뚝 벽 조각 + 작은 문 둘 벽 + 열린 문틀 + 말뚝 벽 조각.
    #   요새 안(26..35, 0..10)은 흙 마당, 북동에 문 달린 망루(윗판 4×4 + 문 몸통 4×4), 문루 옆 깃대.
    c.kind(1, 'A2:16', blob(27, 0, [(0, 9), (0, 9), (-1, 10), (-1, 10), (-1, 10), (-1, 10), (-1, 10), (0, 9), (-1, 10), (0, 9), (-1, 10)]))   # 흙 마당(성탑 쪽 가장자리 들쭉날쭉)
    # 25..35 = 11칸: 말뚝 벽 판(3) + 작은 문 둘 벽(5) + 열린 문틀(3)
    # 좁은 말뚝 조각은 칸보다 가늘어 틈이 보였고, 판자 판(panel)은 윗면이 판자라 말뚝 줄과 모양이 달랐다 —
    # 문 둘 벽의 문 없는 왼쪽 말뚝 두 열을 한 번 더 이어 붙인다(같은 말뚝 그림이 끊김 없이 이어짐)
    c.obj('fort_palisade_wall_two_doors', 28, 11)
    # 왼끝 열(0)은 벽 끝 마감이라 이어 붙이면 틈이 생긴다 — 문 사이 가운데 말뚝 열(2)만 반복
    for sx in list(range(25, 29)) + [32]:   # x24 는 동쪽 탑 문 돌길 — 목책이 길을 덮지 않게                        # 24..27 이음 + 문 둘 벽의 양끝 마감 열(28·32)도 — 끝 마감 열 옆에 틈이 보였다
        for r, row in enumerate(c.ctx.object(c.b, 'fort_palisade_wall_two_doors')['cells']):
            c.L[3][(11 + r) * c.w + sx] = row[2]
            c.owner[(3, (11 + r) * c.w + sx)] = 'fort_palisade_wall_two_doors'
    c.obj('fort_gate_frame_open', 33, 11)
    obj_rows(c, 'fort_watchtower_wide', 30, 0, 0, 4)
    c.obj('fort_watchtower_front_door', 30, 4)                    # 망루 몸통 정면(가운데 작은 문) — 문 밑(32,8) 에서 흙 마당
    c.obj('fort_flag_pole', 35, 0)
    c.obj('fort_ladder_narrow', 34, 1)                             # 망루 윗판 옆에 기대 세운 사다리
    # 요새 마당: 군막 둘·무기 걸이·창 걸이·판자 수레·공성 망치 — 빈 흙바닥이 넓게 남지 않게
    for oid, x, y in (('battle_tent_beige_striped', 26, 5), ('battle_tent_dark_green', 27, 0), ('battle_weapon_rack_frame', 34, 6),
                      ('battle_spear_rack_long', 31, 9), ('battle_wood_cart_plank', 27, 9), ('battle_spear_rack_short', 35, 9),
                      ('battle_weapon_pile_tall_a', 29, 5)):
        c.obj(oid, x, y)
    # 마당 안은 이미 흙바닥 — 흙길(풀밭 위 kind)을 그으면 흙 위에 풀 테두리 띠가 생긴다(적대적 QA). 마당 안엔 길을 긋지 않는다.
    # 요새 벽 남쪽: 문틀(33..35) 성문과 작은 문 둘(29·31 열) 아래에서 흙길로 — 폐허·안뜰 돌길로 이어진다
    c.kind(1, 'A2:1', path([(34, 14), (34, 17)], 1) + path([(22, 17), (35, 17)], 1) + path([(29, 14), (29, 16)], 1) + path([(31, 14), (31, 16)], 1))
    # 요새 밖 풀밭에 홀로 선 좁은 망루는 무엇을 지키는지 알 수 없어 뺀다(적대적 QA 2026-09-27)
    # 대신 요새 성문 남쪽(27..33, 14..20) 빈 풀밭을 훈련장으로: 과녁·창 꽂힘·흩어진 창 자루·군막·무기 걸이
    for oid, x, y in (('trees_summer_target_branch', 28, 18), ('battle_spear_stuck_slanted_a', 30, 19), ('battle_spear_shafts_scatter', 26, 19),
                      ('battle_tent_dark_green', 31, 18), ('battle_arrows_broken_bent', 28, 20), ('battle_weapon_pile_tall_b', 35, 19),
                      ('battle_spear_rack_short', 27, 15), ('trees_summer_target_branch', 32, 15)):
        c.try_obj(oid, x, y)
    # ── 서남쪽 폐허: 무너진 석조 집 정면(폐허2 시트 왼위 덩이를 시트 배치 그대로 — 무너진 벽 위선·기둥 셋·아치 나무 문·창틀)
    # 적대적 QA 2026-09-27: 기둥·벽 조각·장대를 한 칸씩 흩뿌려 무엇인지 알 수 없는 잡동사니였다(문 없는 폐허).
    c.obj('ruins2_ruin_mass_grey', 1, 16)            # 무너진 예배당(고딕 창 벽 + 무너진 탑 틀)
    c.obj('ruins2_arch_gate_grey', 8, 19)            # 무너진 석조 집 정면(기둥 셋·아치 나무 문·창틀)
    c.kind(1, 'A2:3', path([(9, 24), (9, 25)], 1) + path([(4, 24), (9, 24)], 1) + path([(9, 24), (12, 24), (12, 15)], 1))   # 두 폐허 문 앞 → 안뜰 돌길(6,18)·(12,14)
    # 잔해: 이름표가 '작은 돌 조각' 이던 창틀·'돌 더미' 이던 사암 벽돌 더미를 흩뿌려 창틀이 풀밭에 떨어져 있었다(이름표 교정 2026-09-27)
    for oid, x, y in (('ruins_rubble_block', 13, 21), ('ruins_rubble_small', 14, 23), ('ruins_pebbles_red', 0, 24),
                      ('ruins_rubble_small', 7, 23), ('ruins_pebbles_red', 13, 25), ('ruins_rubble_small', 0, 15)):
        c.try_obj(oid, x, y)
    c.obj('trees_summer_gnarled_bare', 18, 22)
    c.obj('trees_summer_bare_small', 25, 19)
    # 동쪽 길 남쪽 빈 풀밭(20..24,18..22) — 낮은 아치 벽 잔해·돌멩이·들풀
    c.try_obj('ruins2_wall_arch_low_grey', 20, 18)
    c.kind(2, 'A2:13', [(22, 21), (24, 18), (19, 22), (23, 23)])
    c.kind(2, 'A2:7', [(24, 20), (21, 23)])
    c.obj('ruins_pebbles_red', 17, 21)
    c.obj('trees_summer_log_hollow', 11, 25)
    # 남동 풀밭: 숲 가장자리
    forest(c, blob(24, 21, [(2, 8), (1, 9), (0, 10), (0, 10), (0, 10)]), 7, edge=('trees_summer_sapling_leafy', 'trees_summer_fir_seedling', 'trees_summer_sapling_leafy'))
    dark_grass_finish(c, dark)
    return c



def sheet_block(c, slot, x, y, sx0=0, sy0=0, sw=16, sh=16, deck_floor=(), layer=3):
    """시트 영역(sx0..,sy0..,sw×sh)의 비지 않은 칸을 그대로 맵 (x,y) 에 3층으로 옮긴다 — 두 시트에 걸친 배 선체처럼
    조각 이름표보다 원래 그림 배치가 중요한 경우. deck_floor = 1층으로 까는 이름표 물체 id(갑판)들."""
    st = next(s['start'] for s in c.ctx.man[c.b]['sections'] if s['slot'] == slot)
    floor_ids = set()
    for oid in deck_floor:
        o = c.ctx.object(c.b, oid)
        floor_ids |= {v for row in o['cells'] for v in row if v >= 0}
    ents = c.ctx.man[c.b]['entries']
    for yy in range(sh):
        for xx in range(sw):
            gx, gy = sx0 + xx, sy0 + yy
            t = st + (gx // 8) * 128 + gy * 8 + gx % 8
            if not ents[t]:
                continue
            mx, my = x + xx, y + yy
            if not c.ok(mx, my):
                c.errors.append(f'sheet_block {slot}({gx},{gy})→({mx},{my}): 맵 밖으로 잘림')
                continue
            if t in floor_ids:
                c.tile(1, t, mx, my)
            else:
                c.tile(layer, t, mx, my)
                c.owner[(layer, my * c.w + mx)] = f'sheet:{slot}'


@example
def ex_elf_village(ctx):
    """엘프 숲 마을 36×26 — 거대 엘프 나무 둘(수관은 4층) · 초록·붉은 목조 집(완성 물체)과 A3 조립 집 · 나무 위 오두막 ·
    흰 돌 가로등 줄 · 흙길 · 연못 · 사냥꾼 야영지(움막·건조대·매단 사냥감). 좌우 대칭 금지."""
    c = Canvas(ctx, 'rasak_forestfolk', 36, 26, 'ex_elf_village', 'Rasak 예제 · 엘프 숲 마을(거대 나무·목조 집·사냥꾼 야영지)')
    c.kind(1, 'A2:0', rect(0, 0, 36, 26))
    dark = blob(0, 0, [(0, 9), (0, 8), (0, 7), (0, 5), (0, 4)]) + blob(27, 18, [(2, 7), (1, 8), (0, 9), (0, 9), (0, 9), (0, 9), (0, 9), (0, 9)])
    dark_grass(c, dark)
    # ── 거대 엘프 나무 둘: 시트 왼쪽 세로줄이 한 그루(수관 0,0 · 윗줄기 1,6 · 껍질 머리 0,9 · 밑동 2,13) — 그 상대 위치 그대로 쌓는다
    def elf_tree(x, y, col_slot='X1', sx0=0, top=9):
        # 시트 8열 16줄이 나무 한 그루(수관 위 → 줄기 → 밑동·뿌리). 원본 배치 그대로 옮긴다:
        # 윗 top 줄(수관·줄기 윗부분)은 4층 = 캐릭터 위로 덮고, 나머지(밑동·뿌리)는 3층 = 막힘.
        sheet_block(c, col_slot, x, y, sx0, 0, 8, top, layer=4)
        sheet_block(c, col_slot, x, y + top, sx0, top, 8, 16 - top)
    elf_tree(0, 0)                       # 초록 배치1(둥근 수관 나무) — 맵 밖으로 잘리지 않게 (0,0)
    elf_tree(26, 1, 'X10')               # 노랑 배치1(오른끝 맵 안) — 색·높이 다르게
    # 수관 그늘 밑 풀숲(2층) — 수관은 4층이라 밑이 비면 빈 땅이 된다
    c.kind(2, 'A2:7', blob(1, 1, [(0, 5), (1, 4), (0, 5), (1, 3)]) + blob(30, 1, [(0, 5), (1, 4), (0, 5), (1, 3)]))
    # ── 흙길(가운데 굽이) · 집마다 문 앞에서 끝남
    road = path([(0, 16), (8, 16), (8, 14), (20, 14), (20, 17), (35, 17)], width=2)
    c.kind(1, 'A2:1', road)
    c.kind(1, 'A2:1', path([(12, 14), (12, 12)], 1) + path([(24, 14), (24, 11)], 1))   # (17,17~20) 옛 문길은 지붕 위에 1칸 섬만 남겨 지움(확대 QA 2026-09-27)
    # ── 완성 목조 집 둘(색 다름) · A3 조립 집 하나
    c.obj('elf_green_house_gable_a', 9, 6)
    c.obj('elf_red_house_large', 20, 6)
    house(c, 13, 18, 7, 'A3:16', 'A3:25', roof_h=3, wall_h=2, door=None)
    c.obj('elf_red_wall_door', 17, 22, over=True)
    c.kind(1, 'A2:1', path([(17, 24), (17, 25)], 1) + path([(17, 23), (17, 22)], 1))   # 문 아래 길(확대 QA: 끊긴 1칸 섬 → 문 앞 줄과 이음)
    # 문 앞 길이 맵 아래 끝으로만 나가고 마을 길과는 끊겨 있었다(확대 QA 2026-09-27 2차) — 집 동쪽으로 돌아 큰길(21,18)에 잇는다
    c.kind(1, 'A2:1', path([(17, 24), (21, 24), (21, 19)], 1))
    c.obj('elf_green_treehouse_ladder', 5, 17)
    c.obj('elf_yellow_treehouse_short', 25, 19)
    # ── 흰 돌 가로등(길 한쪽만, 간격 다르게)
    for x, o in ((6, 'elf_green_lamp_post_r'), (15, 'elf_green_lamp_post_l'), (22, 'elf_green_lamp_post_r'), (27, 'elf_green_lamp_post_l')):
        c.try_obj(o, x, 12 if x < 20 else 15)
    # ── 연못
    c.kind(1, 'A1:0', blob(6, 20, [(1, 3), (0, 5), (-1, 7), (0, 6), (2, 3)]))
    # ── 사냥꾼 야영지(오른쪽 아래 숲가)
    c.obj('hunter_tent_white_cone', 29, 20)
    c.obj('hunter_hut_leaf_cone', 32, 19)
    c.obj('hunter_rack_hide', 28, 23)
    c.obj('hunter_fork_hang_carcass', 33, 22)
    c.obj('hunter_fork_hang_small_leaf', 31, 23)
    c.obj('hunter_buckets_pair', 27, 21)
    # ── 남서 숲가: 무너진 옛 엘프 사원 돌기둥 무리 · 연못가 사냥 장대 덩이
    for oid, x, y in (('outtemple_obelisk_ruin', 1, 21), ('outtemple_column_seg_a', 3, 20), ('outtemple_obelisk_short', 4, 23),
                      ('outtemple_pillar_block_l', 0, 17), ('hunter_pole_leafy_bundle_a', 12, 21), ('hunter_rack_empty', 12, 23),
                      ('hunter_stack_goods', 14, 22), ('hunter_fork_post_leaf', 22, 21), ('hunter_buckets_pair', 24, 22)):
        c.try_obj(oid, x, y)
    # ── 숲 가장자리·흩뿌림
    c.kind(2, 'A2:13', [(10, 13), (18, 12), (26, 13), (3, 18), (14, 16), (22, 20), (11, 20), (29, 14), (6, 9), (15, 4)])
    c.kind(2, 'A2:7', [(8, 3), (9, 3), (17, 5), (25, 5), (4, 15), (19, 23), (12, 25), (26, 25)])
    c.kind(2, 'A2:23', [(12, 3), (21, 4), (34, 13), (2, 20), (16, 11)])
    c.kind(2, 'A2:13', [(9, 15), (11, 17), (14, 18), (18, 15), (20, 13), (22, 16), (16, 19), (19, 20), (13, 20), (9, 19), (8, 12), (25, 16), (33, 17), (30, 16), (9, 22), (0, 15), (17, 8), (1, 21), (4, 24), (16, 25), (19, 25), (11, 0), (18, 0), (35, 7), (15, 23)])
    dark_grass_finish(c, dark)
    return c



@example
def ex_snow_village(ctx):
    """설원 바이킹 마을 36×26 — 눈밭 · 얼어붙은 물가 · 눈 덮인 A3 긴 집 셋(지붕 종류·폭 다름) + A자 박공 회관 ·
    용머리 들보 · 나무 단 부두 · 야만족 가죽 천막 야영지 · 목책 · 앙상한 나무. 좌우 대칭 금지."""
    c = Canvas(ctx, 'rasak_snow', 36, 26, 'ex_snow_village', 'Rasak 예제 · 설원 바이킹 마을(긴 집·박공 회관·천막 야영지·얼어붙은 물가)')
    SNOW, DIRT, GRAVEL = 'A2:16', 'A2:18', 'A2:17'
    c.kind(1, SNOW, rect(0, 0, 36, 26))
    # 얼어붙은 물가(남쪽) — 들쭉날쭉
    c.kind(1, 'A1:0', blob(0, 21, [(0, 9), (0, 12), (0, 16), (0, 20), (0, 24)]) + blob(22, 22, [(2, 6), (0, 11), (-1, 15), (-2, 16)]))
    # 흙길(북 → 남 부두, 동쪽 갈래)
    c.kind(1, DIRT, path([(14, 0), (14, 9), (19, 9), (19, 19)], width=2) + path([(20, 13), (34, 13)], width=1) + path([(6, 12), (14, 12)], width=1))
    # ── 긴 집 셋(눈 지붕·짚 지붕·낡은 지붕, 폭 다름) — 문 아래 칸까지 길
    house(c, 2, 3, 8, 'A3:7', 'A3:10', roof_h=3, wall_h=2)
    c.obj('vikingsnow_beam_dragon_shields', 3, 5, over=True)
    house(c, 3, 13, 6, 'A3:2', 'A3:9', roof_h=2, wall_h=2)
    house(c, 24, 4, 9, 'A3:0', 'A3:14', roof_h=3, wall_h=2)
    c.obj('vikingsnow_beam_two_shields', 29, 6, over=True)
    # 긴 집마다 문(벽 아래 두 줄)·창 둘(민벽 칸) + 문 아래에서 시작하는 길
    # 문은 방패 들보(첫 집 3..7열, 셋째 집 29..30열) 아래를 피한다 — 들보 아랫줄을 문이 덮으면 들보가 반쪽이 된다(확대 QA 2026-09-27)
    for hx, hy, hw, rh, door, wins in ((2, 3, 8, 3, 6, (1, 3)), (3, 13, 6, 2, 2, (4,)), (24, 4, 9, 3, 3, (1, 7))):
        base = hy + rh + 1
        c.obj('snowvillage_door_arch', hx + door, base - 1, over=True)
        for wx in wins:
            c.obj('snowvillage_window_shutter', hx + wx, base, over=True)
    c.kind(1, DIRT, path([(8, 9), (8, 12)], 1) + path([(5, 17), (5, 20), (10, 20), (10, 12)], 1) + path([(27, 10), (27, 13)], 1))
    # ── A자 박공 회관(마을 가운데에서 비킴)
    c.obj('vikingsnow_timber_frame_post', 21, 15)
    # ── 부두(나무 단)와 난간
    c.obj('vikingsnow_plank_deck', 11, 17)
    c.obj('vikingsnow_rail_posts', 20, 20)
    # ── 야만족 천막 야영지(동남)
    c.obj('barbarian_hide_teepee_tall', 30, 14)
    c.obj('barbarian_hide_tent_a', 26, 20)
    c.obj('barbarian_hide_drying_rack', 33, 18)
    c.obj('barbarian_pole_trophies', 29, 17)
    c.obj('barbarian_plank_table', 22, 21)
    c.obj('barbarian_spear_hide_shield', 34, 10)
    # ── 앙상한 나무·말뚝·난간(한쪽으로 치우쳐)
    for (x, y, o) in [(0, 8, 'vikingsnow_bare_tree_brown'), (11, 3, 'vikingsnow_bare_tree_grey'), (17, 1, 'vikingsnow_bare_tree_brown'),
                      (21, 2, 'vikingsnow_bare_tree_grey'), (33, 0, 'vikingsnow_bare_tree_brown'), (0, 15, 'vikingsnow_bare_tree_grey'),
                      (9, 11, 'vikingsnow_bare_tree_brown'), (23, 9, 'vikingsnow_bare_tree_grey')]:
        c.obj(o, x, y)
    c.obj('vikingsnow_picket_rail', 7, 10)
    c.obj('vikingsnow_beam_h_a', 20, 7)
    # 박공 회관(북서 공터) · 목책 · 흩뿌린 앙상한 나무(빈 자리에만)
    c.try_obj('vikingsnow_aframe_gable_grey', 9, 0) or c.try_obj('vikingsnow_aframe_gable_grey', 17, 0)
    c.try_obj('barbarian_log_palisade', 27, 0) or c.try_obj('barbarian_log_palisade', 20, 0)
    import random
    rnd = random.Random(11)
    trees = ['vikingsnow_bare_tree_grey', 'vikingsnow_bare_tree_brown']
    placed = 0
    for _ in range(400):
        if placed >= 14:
            break
        x, y = rnd.randrange(0, 35), rnd.randrange(0, 19)
        # 나무끼리 3칸 이상 띄운다 — 줄지어 선 숲 벽처럼 보이지 않게
        if any((x + dx, y + dy) in {(k % c.w, k // c.w) for (ly, k), o in c.owner.items() if ly == 3 and o.startswith('vikingsnow_bare')} for dx in range(-3, 4) for dy in range(-2, 3)):
            continue
        placed += c.try_obj(trees[rnd.randrange(2)], x, y)
    # 2층 흩뿌림: 눈 더미 · 흙 얼룩 · 마른 덤불 · 자갈 조각 — 빈 눈밭 칸의 1/4 정도
    for _ in range(500):
        x, y = rnd.randrange(0, 36), rnd.randrange(0, 26)
        i = y * c.w + x
        if c.ground(x, y) == 'floor' and c.L[3][i] is None and c.L[2][i] is None and isinstance(c.L[1][i], tuple) and c.L[1][i][1] == 'A2' and rnd.random() < 0.12:
            c.kind(2, ['A2:28', 'A2:20', 'A2:13', 'A2:29'][rnd.randrange(4)], [(x, y)])
    c.try_obj('barbarian_wood_stake_tall_80', 11, 14)
    c.try_obj('vikingsnow_picket_rail', 30, 11)
    # 눈 더미·덤불·자갈 얼룩(2층)
    c.kind(2, 'A2:28', [(5, 10), (13, 16), (24, 12), (34, 16), (27, 19), (9, 8), (17, 9), (12, 11), (2, 11), (35, 12), (21, 18), (8, 15), (30, 9), (25, 15)])
    c.kind(2, 'A2:13', [(3, 9), (7, 12), (19, 4), (23, 7), (31, 5), (14, 19), (6, 20), (28, 13), (33, 13), (10, 20), (17, 18), (22, 3)])
    c.kind(2, 'A2:28', [(1, 1), (12, 7), (22, 11), (35, 5), (9, 16), (17, 14), (31, 11), (3, 20), (25, 1), (13, 3), (19, 7), (1, 11), (35, 22)])
    c.kind(2, 'A2:20', [(8, 1), (23, 13), (11, 10), (16, 16), (33, 8), (6, 18), (29, 21), (21, 5)])
    c.kind(2, 'A2:29', [(4, 11), (18, 3), (27, 11), (12, 14), (32, 3), (1, 18), (24, 18), (16, 11)])
    return c



def sheet_obj(c, oid, slot, x, y, layer=None):
    """시트 속 좌표를 그대로 맵에 옮겨 찍는다(여러 조각이 한 그림인 배 선체용). (x,y) = 시트 (0,0) 이 올 맵 칸."""
    o = c.ctx.object(c.b, oid)
    st = next(s['start'] for s in c.ctx.man[c.b]['sections'] if s['slot'] == slot)
    ox = oy = None
    for r, row in enumerate(o['cells']):
        for cc, v in enumerate(row):
            if v >= 0:
                n = v - st
                sx, sy = n % 8 + (n // 128) * 8, (n % 128) // 8
                ox = sx - cc if ox is None else min(ox, sx - cc)
                oy = sy - r if oy is None else min(oy, sy - r)
    c.obj(oid, x + ox, y + oy, layer=layer)


@example
def ex_port(ctx):
    """항구 36×24 — 바다(A1) · 돌 포장 부두(북) · 나무 잔교 둘 · 정박한 배 한 척(왼쪽 선체 시트 16열 + 오른쪽 선체 시트 고물 10열, 위 9줄) ·
    돛대 둘은 갑판 위 · 창고 둘(문·문 앞 길) · 화물은 덩이로 · 동쪽 해변(야자수·초가·통나무배). 좌우 대칭 금지."""
    c = Canvas(ctx, 'rasak_port', 36, 21, 'ex_port', 'Rasak 예제 · 항구(정박한 배·부두·창고·해변)')
    c.ctx.load('rasak_port')
    c.kind(1, 'A1:0', rect(0, 0, 36, 21))
    PAVE = 'A5#16'
    c.kind(1, PAVE, rect(0, 0, 30, 8))                       # 북쪽 부두
    c.kind(1, 'A5#16', rect(30, 0, 6, 21))                   # 동쪽 뭍
    c.kind(1, 'A2:3', rect(8, 8, 2, 3) + rect(20, 8, 2, 3))   # 잔교 둘(배 난간까지)
    # ── 배: 위 9줄 = 선체. 갑판(y+3..y+6)만 1층, 나머지 3층
    X, Y = 0, 10
    # 선체는 시트 위 9줄. 10번째 줄은 휜 목재·쇠띠 기둥 같은 **낱개 부품**이라 옮기면 바다에 떠 있다(확대 QA 2026-09-27 확인).
    sheet_block(c, 'B', X, Y, 0, 0, 16, 9, deck_floor=('ship_l_deck',))
    sheet_block(c, 'C', X + 16, Y, 6, 0, 10, 9, deck_floor=('ship_r_deck',))
    # 돛대 둘: 밑동이 갑판 가운데 줄에 오게(돛은 4층으로 선체·바다 위로)
    # 돛대는 돛 시트(E) 왼쪽의 돛대 두 벌(0..3열 0..10줄 / 4..6열 0..9줄)을 원본 그대로 4층에 — 밑동이 갑판 가운데 줄
    sheet_block(c, 'E', X + 6, Y + 5 - 10, 0, 0, 3, 11, layer=4)
    sheet_block(c, 'E', X + 15, Y + 5 - 9, 4, 0, 3, 10, layer=4)
    # 갑판 소품은 갑판 칸에만, 소수
    for oid, dx, dy in (('shipdeco_steering_wheel', 22, 4), ('shipdeco_barrel_stack', 3, 4), ('shipdeco_rope_coils', 11, 5)):
        c.try_obj(oid, X + dx, Y + dy)
    # ── 창고 둘(폭·지붕 다름) + 문 + 문 앞에서 끝나는 길
    house(c, 1, 0, 7, 'A3:0', 'A3:10', roof_h=2, wall_h=2)
    house(c, 13, 0, 6, 'A3:16', 'A3:25', roof_h=2, wall_h=2)
    c.obj('shipdeco_cabin_door', 4, 1, over=True)
    c.obj('shipdeco_cabin_door', 15, 1, over=True)
    c.kind(1, 'A2:3', path([(4, 5), (4, 7)], 1) + path([(15, 5), (15, 7)], 1) + path([(0, 7), (29, 7)], 1))
    # ── 화물은 덩이 셋(창고 옆·잔교 머리·동쪽)
    for oid, x, y in (('shipdeco_cargo_crates', 9, 1), ('shipdeco_sacks_row', 9, 4), ('shipdeco_barrel_stack_b', 20, 1), ('shipdeco_crate_table', 19, 4),
                      ('shipdeco_anchor', 27, 5), ('shipdeco_rope_coils', 21, 4), ('beach_rope_fence', 11, 6)):
        c.try_obj(oid, x, y)
    # 부두 물가 계류 말뚝 줄(잔교 자리는 비움) · 서쪽 부두 화물 · 갑판 해치·대포·화물
    for x in (0, 11, 14, 24):
        c.try_obj('beach_rope_fence', x, 7)
    for oid, x, y in (('shipdeco_cargo_crates', 0, 4), ('shipdeco_sacks_row', 26, 5) , ('shipdeco_barrel_stack', 12, 5)):
        c.try_obj(oid, x, y)
    for oid, dx, dy in (('ship_l_hatch_open_a', 6, 4), ('shipdeco_cannon_row', 17, 5), ('shipdeco_cargo_crates', 13, 3), ('shipdeco_barrel_stack_b', 20, 3)):
        c.try_obj(oid, X + dx, Y + dy)
    # ── 동쪽 해변(모래 섬 위): 야자수 무리 · 초가 · 통나무배
    for (x, y, o) in [(31, 1, 'beach_palm_tall'), (34, 3, 'beach_palm_leaning'), (32, 9, 'beach_palm_small'), (34, 12, 'beach_palm_bush'),
                      (31, 16, 'beach_palm_tall_b'), (34, 17, 'beach_palm_small_b')]:
        c.try_obj(o, x, y)
    c.try_obj('beach_thatch_hut_small', 31, 5)
    c.try_obj('beach_thatch_hut_front', 31, 12) or c.try_obj('beach_thatch_hut_front', 33, 14)
    c.obj('beach_dugout_canoe', 27, 19)
    # 셋째 창고(동쪽 부두) + 문 + 길
    house(c, 23, 0, 6, 'A3:1', 'A3:9', roof_h=2, wall_h=2)
    c.obj('shipdeco_cabin_door', 25, 1, over=True)
    c.kind(1, 'A2:3', path([(25, 5), (25, 7)], 1))
    # 애니 소품: 배 등불(갑판·부두) · 깃발
    import random as _r
    _rnd = _r.Random(3)
    # 배 갑판 A5 칸엔 대포·문양이 바닥 그림에 박혀 있어 흩뿌리면 덮는다(확대 QA) — 셋째 등불은 부두 돌바닥 고정 칸
    c.try_obj('anim_shiplanterns_3', 17, 6)
    for oid in ('anim_shiplanterns_1', 'anim_shiplanterns_2', 'anim_flagsleft_1'):
        for _ in range(200):
            if c.try_obj(oid, _rnd.randrange(c.w), _rnd.randrange(c.h)):
                break
    return c



@example
def ex_autumn_forest(ctx):
    """가을 숲 오솔길 34×24 — 단풍 든 숲(큰 참나무·전나무 쌍·자작·과실수 섞음) · 굽은 흙 오솔길 · 연못과 개울 · 작은 A3 오두막 하나(문·창·장작) ·
    숲 바닥은 가을 낙엽·버섯·고사리(2층·3층). 나무는 덩이로 모으고 오솔길 양옆은 비운다. 좌우 대칭 금지."""
    c = Canvas(ctx, 'rasak_seasons', 34, 24, 'ex_autumn_forest', 'Rasak 예제 · 가을 숲 오솔길(단풍 숲·연못·오두막)')
    c.kind(1, 'A2:8', rect(0, 0, 34, 24))                                   # 짙은 풀밭(가을 숲 바닥)
    c.kind(1, 'A2:16', blob(2, 2, [(0, 6), (-1, 8), (0, 7), (1, 5)]) + blob(22, 15, [(1, 7), (0, 9), (0, 10), (1, 8), (2, 6)]))   # 흙 숲바닥 얼룩
    trail = path([(0, 12), (6, 12), (9, 9), (15, 9), (18, 13), (25, 13), (28, 10), (33, 10)], width=2)
    c.kind(1, 'A2:9', trail)
    c.kind(1, 'A1:0', blob(10, 16, [(1, 4), (0, 6), (-1, 7), (0, 6), (2, 3)]))   # 연못
    c.kind(1, 'A1:0', path([(13, 21), (14, 23)], 1))                          # 개울(맵 밖으로)
    # 오두막(문·창·장작) — 오솔길 북쪽
    # 오두막에 문이 없었다(적대적 QA 2026-09-27) — 계절 묶음에 마을 건물 부품 시트(T1)를 붙여 문·창을 단다. 문 아래 길은 원래 있던 22열 흙길
    house(c, 19, 2, 6, 'A3:18', 'A3:25', roof_h=2, wall_h=2, door=3, windows=(1,))
    c.kind(1, 'A2:9', path([(22, 6), (22, 12)], 1))
    # 오두막 앞마당: 쓰러진 통나무 · 그루터기 · 버섯 무리 · 낙엽 덩이(길 양옆)
    for oid, x, y in (('trees_fall_log_diag', 19, 9), ('trees_fall_broken_stump', 24, 8), ('trees_fall_hollow_base', 19, 11),
                      ('floor_fall_stump_moss', 24, 11), ('trees_fall_log_moss', 20, 12), ('floor_fall_mushrooms_scatter', 23, 10)):
        c.try_obj(oid, x, y)
    c.kind(2, 'A2:13', [(20, 8), (21, 8), (23, 8), (20, 10), (24, 10), (21, 11), (23, 12), (18, 10), (25, 9)])
    # 숲 덩이: 큰 나무를 먼저 네 무리로, 오솔길·연못·오두막 앞은 비움
    import random
    rnd = random.Random(21)
    groves = [(0, 0, 9, 8), (26, 0, 8, 9), (0, 15, 8, 9), (24, 16, 10, 8), (12, 0, 6, 6), (16, 17, 7, 7), (10, 11, 5, 3), (28, 12, 6, 3)]
    bigs = ['trees_fall_oak_big', 'trees_fall_fir_pair_a', 'trees_fall_fir_pair_b', 'trees_fall_gnarled_leafy', 'trees_fall_tall_leafy']
    mids = ['trees_fall_birch_leafy', 'trees_fall_round_small', 'trees_fall_small_leafy_a', 'trees_fall_small_leafy_b', 'trees_fall_sparse_leafy', 'trees_fall_fruit_a']
    for gx, gy, gw, gh in groves:
        for _ in range(40):
            c.try_obj(bigs[rnd.randrange(len(bigs))], gx + rnd.randrange(gw), gy + rnd.randrange(gh))
        for _ in range(60):
            c.try_obj(mids[rnd.randrange(len(mids))], gx + rnd.randrange(gw), gy + rnd.randrange(gh))
    # 숲 바닥 소품: 낙엽·버섯·고사리 — 나무 무리 가장자리에 덩이로
    floor = [o['id'] for o in c.ctx.names['bundles'][c.b]['objects'] if o['id'].startswith('floor_fall_') and o['size'] in ([1, 1], [2, 1], [1, 2])]
    for _ in range(260):
        x, y = rnd.randrange(34), rnd.randrange(24)
        near_tree = any((3, (y + dy) * c.w + x + dx) in c.owner for dx in (-2, -1, 1, 2) for dy in (-1, 0, 1) if 0 <= x + dx < 34 and 0 <= y + dy < 24)
        if near_tree and rnd.random() < 0.6:
            c.try_obj(floor[rnd.randrange(len(floor))], x, y)
    # 낙엽(2층)은 오솔길 가장자리와 나무 사이 빈 풀에 덩이로 — 1칸씩 흩지 않고 3~5칸 붙여서
    for cx, cy in [(3, 10), (8, 14), (12, 7), (16, 11), (21, 15), (26, 11), (30, 8), (6, 6), (18, 5), (25, 7), (2, 14), (31, 15)]:
        c.kind(2, 'A2:13', [(cx + dx, cy + dy) for dx, dy in ((0, 0), (1, 0), (0, 1), (-1, 0), (1, 1)) if 0 <= cx + dx < 34 and 0 <= cy + dy < 24 and c.ground(cx + dx, cy + dy) == 'floor'])
    return c



@example
def ex_mushroom_forest(ctx):
    """버섯 숲 32×22 — 짙은 숲바닥 · 거대 버섯(색 다른 무리) · 분홍 꿈 꽃나무 한 구석 · 거목 그루터기 · 굽은 오솔길 · 작은 연못.
    버섯은 색끼리 무리 짓고, 1칸 버섯은 큰 버섯 발치에만. 좌우 대칭 금지."""
    c = Canvas(ctx, 'rasak_seasons', 32, 22, 'ex_mushroom_forest', 'Rasak 예제 · 버섯 숲(거대 버섯·분홍 꽃나무·거목 그루터기)')
    c.kind(1, 'A2:8', rect(0, 0, 32, 22))                  # 짙은 풀 숲바닥
    c.kind(1, 'A2:16', blob(0, 0, [(0, 8), (0, 7), (0, 6), (0, 4)]) + blob(10, 14, [(1, 7), (0, 9), (0, 9), (1, 8), (2, 6), (3, 4), (4, 2)]))  # 흙 얼룩(버섯 무리 밑)
    c.kind(1, 'A2:0', blob(18, 0, [(0, 9), (-2, 12), (-3, 14), (-2, 13), (0, 10), (3, 6)]))   # 밝은 풀 덩이(분홍 꿈 구석)
    c.kind(1, 'A2:17', path([(0, 10), (7, 10), (11, 7), (19, 7), (23, 12), (31, 12)], width=2))
    c.kind(1, 'A1:6', blob(4, 15, [(1, 4), (0, 6), (0, 5), (2, 2)]))
    import random
    rnd = random.Random(8)
    BIG = ['mushroom_brown_mound_a', 'mushroom_brown_mound_b', 'mushroom_brown_mound_c', 'mushroom_brown_mound_d', 'mushroom_yellow_cap_lean', 'mushroom_yellow_cap_tall', 'mushroom_yellow_cap_cluster', 'mushroom_blue_cap_lean', 'mushroom_blue_cap_tall', 'mushroom_blue_cap_cluster', 'mushroom_orange_cap_lean', 'mushroom_orange_cap_tall', 'mushroom_orange_cap_cluster', 'mushroom_green_cap_lean', 'mushroom_green_cap_tall', 'mushroom_green_cap_cluster', 'mushroom_giant_brown_pair', 'mushroom_brown_mush_2x2', 'mushroom_brown_mush_2x3', 'mushroom_giant_brown_a', 'mushroom_giant_brown_b', 'mushroom_spore_ring', 'mushroom_spore_ring_stone', 'mushroom_spore_ring_red', 'mushroom_spore_ring_blue', 'mushroom_brown_mush_patch']
    SMALL = ['mushroom_shadow_4', 'mushroom_shadow_11', 'mushroom_shadow_12', 'mushroom_shadow_13', 'mushroom_shadow_19', 'mushroom_shadow_20', 'mushroom_shadow_21', 'mushroom_pale_mush_a', 'mushroom_pale_mush_shadow', 'mushroom_pale_mush_b', 'mushroom_pale_mush_c', 'mushroom_pale_mush_d', 'mushroom_pale_mush_e', 'mushroom_pale_mush_f', 'mushroom_pale_mush_g', 'mushroom_pale_mush_h', 'mushroom_pale_mush_i', 'mushroom_brown_lump', 'mushroom_brown_lump_flat', 'mushroom_brown_lump_b', 'mushroom_purple_mush_pair', 'mushroom_blue_mush_pair', 'mushroom_green_mush_pair', 'mushroom_purple_mush_38', 'mushroom_purple_mush_39', 'mushroom_purple_mush_46', 'mushroom_purple_mush_47', 'mushroom_purple_mush_54', 'mushroom_blue_mush_55', 'mushroom_blue_mush_70', 'mushroom_blue_mush_71', 'mushroom_blue_mush_78', 'mushroom_blue_mush_79', 'mushroom_green_mush_86', 'mushroom_green_mush_87', 'mushroom_green_mush_102', 'mushroom_green_mush_103', 'mushroom_green_mush_111', 'mushroom_stalk_base_a', 'mushroom_stalk_base_b', 'mushroom_brown_mush_small_a', 'mushroom_brown_mush_small_b', 'mushroom_brown_cap_flat', 'mushroom_brown_mush_thin', 'mushroom_brown_mush_bunch', 'mushroom_blue_lamp_mush', 'mushroom_orange_lamp_mush', 'mushroom_green_lamp_mush', 'mushroom_brown_twig', 'mushroom_brown_mush_stub', 'mushroom_orange_mush_glow', 'mushroom_green_mush_glow', 'mushroom_blue_mush_glow', 'mushroom_brown_mush_tiny', 'mushroom_brown_mush_cluster', 'mushroom_brown_mush_group', 'mushroom_brown_mush_group_b', 'mushroom_brown_speck', 'mushroom_red_mush_a', 'mushroom_red_mush_b', 'mushroom_red_mush_tiny', 'mushroom_red_mush_c', 'mushroom_red_mush_d', 'mushroom_yellow_mush_tiny']
    # 색 무리: 무리마다 한 색 계열만(이름의 색 낱말로 고름)
    for (gx, gy, gw, gh, colour) in [(0, 0, 9, 8, 'orange'), (9, 12, 9, 10, 'blue'), (24, 14, 8, 8, 'yellow'), (11, 0, 7, 6, 'purple')]:
        pool = [b for b in BIG if colour in b] or BIG
        for _ in range(60):
            c.try_obj(pool[rnd.randrange(len(pool))], gx + rnd.randrange(gw), gy + rnd.randrange(gh))
        spool = [s_ for s_ in SMALL if colour in s_] or SMALL
        for _ in range(80):
            x, y = gx + rnd.randrange(gw), gy + rnd.randrange(gh)
            if any((3, (y + dy) * c.w + x + dx) in c.owner for dx in (-1, 0, 1) for dy in (-1, 1) if 0 <= x + dx < c.w and 0 <= y + dy < c.h):
                oid = spool[rnd.randrange(len(spool))]
                # 같은 1칸 버섯이 네 이웃에 또 있으면 건너뛴다 — 한 종류가 줄·격자로 늘어서면 도장 찍은 듯 보인다(확대 QA 2026-09-27)
                if any(c.owner.get((3, (y + dy) * c.w + x + dx)) == oid for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1), (2, 0), (-2, 0), (0, 2), (0, -2)) if 0 <= x + dx < c.w and 0 <= y + dy < c.h):
                    continue
                c.try_obj(oid, x, y)
    # 분홍 꿈 구석(북동): 꽃나무 셋(색 다름) + 꽃 덤불
    for oid, x, y in (('pinkdream_tree_magenta_a', 20, 0), ('pinkdream_cherry_pink_a', 26, 1), ('pinkdream_cherry_red', 22, 4),
                      ('pinkdream_bush_pink_small_b', 18, 4), ('pinkdream_bush_pink_small_b', 29, 5), ('pinkdream_tree_magenta_b', 27, 7)):
        c.try_obj(oid, x, y)
    # 거목 그루터기 둘(오솔길 옆)
    stumps = [o['id'] for o in c.ctx.names['bundles'][c.b]['objects'] if o['id'].startswith('gianttree_stump')]
    for i, (x, y) in enumerate([(13, 9), (1, 12), (26, 15), (18, 17), (5, 18)]):
        if stumps: c.try_obj(stumps[i % len(stumps)], x, y)
    # 2층 덩이: 낙엽·풀숲을 버섯 무리 가장자리와 오솔길 양옆에 3~5칸씩
    for cx, cy in [(8, 8), (3, 12), (15, 10), (20, 9), (25, 10), (29, 14), (22, 17), (13, 19), (6, 21), (28, 20), (17, 13), (1, 8)]:
        c.kind(2, 'A2:13' if (cx + cy) % 2 else 'A2:7', [(cx + dx, cy + dy) for dx, dy in ((0, 0), (1, 0), (0, 1), (-1, 0), (1, 1)) if 0 <= cx + dx < c.w and 0 <= cy + dy < c.h and c.ground(cx + dx, cy + dy) == 'floor' and c.L[3][(cy + dy) * c.w + cx + dx] is None])
    return c



def shop_row(c, specs, door_obj, base_y):
    """집 줄: specs = [(x, w, roof, wall, door_dx, sign)] — 벽 아랫줄 = base_y. 문은 벽 두 줄에(벽 아랫줄에 놓는 문 물체), 간판은 문 옆 벽걸이."""
    for x, w, roof, wall, ddx, sign in specs:
        house(c, x, base_y - 5, w, roof, wall, roof_h=3, wall_h=2)     # 벽 맨 아랫줄 = base_y - 1 (길 바로 윗줄)
        c.obj(door_obj, x + ddx, base_y - 2, over=True)
        if sign:
            c.obj(sign, x + ddx + 1, base_y - 2, over=True)


@example
def ex_winter_market(ctx):
    """겨울 장터 광장 34×24 — 판타지 도시 A3 집 줄(비늘 기와 색 다름, 문·간판) · 판석 큰길과 치우친 광장 ·
    줄무늬 지붕 노점 셋 + 선물 더미 · 크리스마스 나무 · 장식 가로등(한쪽) · 남쪽 가죽 공방 뒤뜰(빨랫줄·무두질 통·가죽 틀). 좌우 대칭 금지."""
    c = Canvas(ctx, 'rasak_town2', 34, 21, 'ex_winter_market', 'Rasak 예제 · 겨울 장터 광장(판타지 도시·노점·가죽 공방)')
    PAVE = 'A2:19'
    c.kind(1, 'A2:8', rect(0, 0, 34, 21))
    c.kind(1, PAVE, rect(0, 5, 34, 3))                                                   # 큰길
    c.kind(1, PAVE, blob(9, 8, [(0, 12), (-1, 14), (0, 13), (2, 10), (4, 6)]))           # 광장(남쪽으로 치우침)
    c.kind(1, 'A2:16', rect(20, 14, 14, 7))                                              # 공방 뒤뜰 흙
    c.kind(1, PAVE, rect(5, 8, 1, 5) + rect(26, 8, 1, 6))                              # 골목
    shop_row(c, [(0, 6, 'A3:3', 'A3:25', 2, 'town_sign_inn'), (6, 5, 'A3:0', 'A3:9', 1, 'town_sign_item'),
                 (11, 7, 'A3:17', 'A3:27', 3, 'town_sign_tavern'), (18, 6, 'A3:1', 'A3:12', 2, 'town_sign_armor'),
                 (24, 5, 'A3:19', 'A3:26', 1, None), (29, 5, 'A3:4', 'A3:8', 2, 'town_sign_jewel')], 'market_door_frame_wood', 5)
    # 남서 집(광장 옆) — 문이 광장을 본다
    house(c, 1, 13, 5, 'A3:18', 'A3:28', roof_h=3, wall_h=2)
    c.obj('market_door_frame_wood', 3, 16, over=True)
    c.kind(1, PAVE, rect(3, 18, 1, 3) + rect(4, 20, 16, 1))   # 문길을 광장 쪽으로 이어 1×3 섬이 되지 않게(확대 QA 2026-09-27)
    # 문길·아랫길(y20)이 광장·큰길 어디와도 안 닿는 19칸 섬이었다(확대 QA 2026-09-27 2차) — 집 동쪽 골목(6열)으로 광장(y12)까지 올린다
    c.kind(1, PAVE, rect(6, 12, 1, 8))
    # 광장: 노점 셋(색·물건 다름) · 선물 더미 · 크리스마스 나무 · 우물 · 긴 의자 · 장식 가로등(서쪽 줄만)
    for oid, x, y in (('market_stall_striped_open', 8, 9), ('market_stall_striped_backwall', 14, 9), ('xmas_stall_counter', 17, 13),
                      ('xmas_gift_pile', 12, 15), ('xmas_xmas_tree_small', 20, 9), ('town_well_roofed', 9, 15), ('town_log_bench', 15, 17),
                      ('market_crates_pile_bread', 12, 12), ('market_crates_pile_mixed', 22, 12), ('xmas_snowman_sled', 6, 14)):
        c.try_obj(oid, x, y)
    for x, y in ((7, 8), (19, 8), (24, 10)):
        c.try_obj('xmas_lamp_post_garland', x, y)
    # 남동 가죽 공방 뒤뜰: 빨랫줄 · 무두질 통 · 가죽 틀 · 이젤
    for oid, x, y in (('tannery_laundry_line_long', 25, 14), ('tannery_tanning_vat', 21, 17), ('tannery_hide_rack_row', 27, 18),
                      ('tannery_hide_stretch_a', 21, 14), ('tannery_washtub', 24, 18), ('tannery_easel_a', 31, 15)):
        c.try_obj(oid, x, y)
    # 광장 보강: 노점 몸체 둘(과일·물약) · 수레 · 상자 · 게시 기둥
    for oid, x, y in (('market_stall_body_fruit', 17, 10), ('market_stall_body_potions', 14, 15), ('market_cart_empty_handle', 19, 17),
                      ('market_crates_pile_grapes', 11, 18), ('town_notice_pole', 23, 8), ('market_crates_empty_stack', 21, 15)):
        c.try_obj(oid, x, y)
    # 큰길 동쪽 끝·뒤뜰 북쪽 빈 곳: 우물·장작·나무 울타리·널판 더미
    for oid, x, y in (('town_well_plain', 28, 9), ('town_bin_firewood', 31, 9), ('town_planks_stacked', 25, 11), ('town_wattle_fence_h4', 29, 12),
                      ('town_planks_scattered', 32, 11), ('tannery_laundry_line_a', 27, 16), ('tannery_tanning_vat_b', 30, 19), ('town_wattle_fence_v4', 33, 14)):
        c.try_obj(oid, x, y)
    # 남서 풀밭: 울타리 두른 텃밭(흙) + 빨래 걸이
    c.kind(1, 'A2:16', rect(0, 10, 4, 3))
    for oid, x, y in (('town_wattle_fence_h4', 0, 9), ('town_laundry_rack', 4, 10), ('town_wattle_fence_h3', 6, 19), ('town_planks_upright', 8, 20)):
        c.try_obj(oid, x, y)
    # 뒤뜰 울타리(돌 울타리 kind, 2층) · 길 결
    c.kind(2, 'A2:4', [(20, y) for y in range(14, 21)])
    # 큰길·광장 결: 돌 조각 무더기(2층)를 길 가장자리에 2~3칸 덩이로
    for cx, cy in [(1, 7), (9, 5), (15, 7), (22, 6), (30, 7), (13, 11), (8, 16), (17, 17), (24, 12)]:
        c.kind(2, 'A2:20' if cx % 2 else 'A2:28', [(cx + dx, cy) for dx in (0, 1) if c.ground(cx + dx, cy) == 'floor' and c.L[3][cy * c.w + cx + dx] is None])
    return c



@example
def ex_garden_village(ctx):
    """정원 마을 34×22 — 막돌 포장 길 · 가운데 생울타리 정원(분수·화단·가지친 나무·정원 탁자) · 집 셋(A3, 문·창) 각각 앞마당 텃밭 ·
    잔디 깎기·갈퀴·낙엽 더미 같은 정원 일 소품 · 가장자리 여름 나무. 좌우 대칭 금지."""
    c = Canvas(ctx, 'rasak_garden', 34, 22, 'ex_garden_village', 'Rasak 예제 · 정원 마을(생울타리 정원·화단·텃밭)')
    c.kind(1, 'A2:0', rect(0, 0, 34, 22))
    c.kind(1, 'A2:2', path([(0, 9), (33, 9)], width=2) + path([(16, 10), (16, 21)], width=2))
    # 집 셋(문·창) — 길 북쪽 둘, 남동 하나
    house(c, 2, 1, 7, 'A3:3', 'A3:9', roof_h=3, wall_h=2, door=3, windows=(1, 5))
    house(c, 22, 2, 8, 'A3:5', 'A3:13', roof_h=2, wall_h=2, door=2, windows=(5,))
    house(c, 25, 13, 6, 'A3:1', 'A3:11', roof_h=3, wall_h=2, door=3, windows=(1,))
    c.kind(1, 'A2:2', path([(5, 6), (5, 8)], 1) + path([(24, 6), (24, 8)], 1) + path([(28, 18), (28, 21)], 1) + path([(18, 20), (28, 20)], 1))
    # 앞마당 텃밭(흙 밭 2층 + 작물) — 집마다 옆
    c.kind(2, 'A2:22', rect(10, 3, 4, 3)); c.kind(2, 'A2:23', [(10, 3), (12, 4), (13, 3)])
    c.kind(2, 'A2:30', rect(19, 3, 3, 3)); c.kind(2, 'A2:31', [(19, 4), (21, 3)])
    c.kind(2, 'A2:22', rect(20, 14, 3, 3))
    # 가운데 생울타리 정원(길 남서): 생울타리 벽 · 분수 · 화단 · 가지친 나무 · 정원 탁자
    c.kind(1, 'A2:18', rect(2, 12, 11, 8))                             # 정원 판석 마당
    for oid, x, y in (('garden_hedge_wide', 2, 12), ('garden_hedge_wide', 10, 12), ('garden_hedge_column', 2, 14), ('garden_hedge_column', 12, 14),
                      ('garden_hedge_u', 5, 17), ('garden_table_set_four', 8, 16), ('garden_topiary_column', 5, 13), ('garden_topiary_column', 9, 13),
                      ('garden_planter_stone_long', 5, 14)):
        c.try_obj(oid, x, y)
    c.obj('garden_wall_fountain_water', 28, 4, over=True)          # 벽걸이 분수 = 동쪽 집 벽면
    # 집 앞 꽃 화단 줄·낙엽·장작 덩이 · 정원 남쪽 채움
    for oid, x, y in (('garden_flowers_yellow_row', 6, 7), ('garden_flowers_red_row', 26, 7), ('garden_planter_stone_row', 9, 7),
                      ('garden_hedge_block_small', 1, 1), ('garden_hedge_block_small', 31, 1), ('garden_leaf_pile_low', 20, 7),
                      ('garden_hedge_t_maze', 20, 17), ('garden_table_round', 13, 13), ('garden_planter_stone_tall_b', 10, 20),
                      ('garden_flowers_blue_row', 3, 20), ('garden_mower_up', 24, 19), ('garden_leaf_pile_big', 12, 18)):
        c.try_obj(oid, x, y)
    for oid, x, y in ():
        c.try_obj(oid, x, y)
    for oid, x, y, ly in (('garden_flowers_red_row', 5, 14, 4),):
        c.try_obj(oid, x, y)
    # 정원 일 소품: 잔디 깎기·갈퀴·낙엽 더미·호스·물통
    for oid, x, y in (('garden_mower_right', 13, 7), ('garden_rake_standing', 23, 7), ('garden_leaf_pile_big', 30, 7), ('garden_hose_stand', 1, 7),
                      ('garden_leaf_pile_rake', 18, 16), ('garden_planter_stone_row', 18, 12), ('garden_trough_stone_horizontal', 22, 11)):
        c.try_obj(oid, x, y)
    # 꽃 줄(세로) · 가지친 나무 화분 — 길 가장자리 한쪽
    for oid, x, y in (('garden_flowers_blue_vertical', 14, 11), ('garden_flowers_yellow_vertical', 14, 16), ('garden_topiary_in_planter', 19, 11),
                      ('garden_flowers_mixed_vertical', 31, 10), ('garden_planter_stone_tall_a', 23, 12)):
        c.try_obj(oid, x, y)
    # 가장자리 여름 나무 무리(북서·남서·동)
    import random
    rnd = random.Random(4)
    trees = [o['id'] for o in c.ctx.names['bundles'][c.b]['objects'] if o['id'].startswith('trees_summer') and o['size'][0] >= 2 and 'bare' not in o['id']]
    for gx, gy, gw, gh in [(0, 18, 2, 4), (31, 13, 3, 9), (11, 0, 10, 3), (0, 10, 2, 5), (18, 12, 5, 4)]:
        for _ in range(30):
            c.try_obj(trees[rnd.randrange(len(trees))], gx + rnd.randrange(gw), gy + rnd.randrange(gh))
    # 남동 무리(26~30열)가 집 문(28,17) 앞 길 위에 나무를 세웠다(확대 QA 2026-09-27 2차) — 문길(28열) 동쪽으로만
    for gx, gy, gw, gh in [(33, 0, 1, 10), (29, 18, 2, 4)]:
        for _ in range(20):
            c.try_obj(trees[rnd.randrange(len(trees))], gx + rnd.randrange(gw), gy + rnd.randrange(gh))
    # 잔디 결: 풀·흙 얼룩(2층) 덩이 — 길 가장자리와 빈 잔디에
    for cx, cy in [(10, 7), (21, 7), (3, 20), (14, 20), (23, 18), (30, 11), (5, 10), (11, 10), (17, 10), (27, 10), (8, 20), (29, 19), (26, 0)]:
        c.kind(2, 'A2:13', [(cx + dx, cy + dy) for dx, dy in ((0, 0), (1, 0), (0, 1)) if c.ok(cx + dx, cy + dy) and c.ground(cx + dx, cy + dy) == 'floor' and c.L[3][(cy + dy) * c.w + cx + dx] is None])
    return c



@example
def ex_desert_town(ctx):
    """서부 사막 마을 34×22 — 노란 모래 바탕 · 흙 큰길(동서) · 길 북쪽 목조 건물 정면 둘(서부 조립 판을 시트 배치 그대로) + A3 판자 집 둘(문·창) ·
    물탱크 탑 · 풍차 · 짐수레 · 나무 보도 난간 · 선인장 무리(가장자리) · 바위·마른 덤불. 좌우 대칭 금지."""
    c = Canvas(ctx, 'rasak_desert', 34, 22, 'ex_desert_town', 'Rasak 예제 · 서부 사막 마을(목조 정면·물탱크·선인장)')
    c.kind(1, 'A2:0', rect(0, 0, 34, 22))
    c.kind(1, 'A2:2', path([(0, 11), (33, 11)], width=3) + path([(21, 14), (21, 21)], width=2))
    # 목조 건물 정면(서부 조립 판 = B 시트 안): 판 두 덩이를 원본 배치 그대로(아랫줄이 큰길 바로 위)
    # 서부 시트 위쪽은 정면이 아니라 판벽·지붕·계단 조각 모음이라 통째로 옮기면 뒤죽박죽이 된다 — 집은 A3 로 짓고 시트에서는 소품만 쓴다.
    # 집 넷 모두 문이 없었다(적대적 QA 2026-09-27) — 사막 묶음에 문·창 그림이 없어 마을 건물 부품 시트를 T1 로 붙이고 문·창을 단다
    house(c, 1, 3, 7, 'A3:7', 'A3:13', roof_h=3, wall_h=3, door=3, windows=(1, 5), upper_windows=(1, 5))
    house(c, 9, 5, 6, 'A3:21', 'A3:29', roof_h=3, wall_h=2, door=2, windows=(4,))
    # A3 판자 집 둘(문·창) — 폭·지붕 다르게
    house(c, 18, 5, 6, 'A3:3', 'A3:24', roof_h=3, wall_h=2, door=3, windows=(1,))
    house(c, 26, 15, 7, 'A3:2', 'A3:11', roof_h=3, wall_h=2, door=2, windows=(4, 5))
    # 문 밑에서 큰길(y11..13)까지 — 남동 집(26..32,15..19)은 문(28,19) 밑에서 동쪽 갈래 길로
    c.kind(1, 'A2:2', path([(4, 9), (4, 10)], 1) + path([(11, 10), (11, 10)], 1) + path([(21, 10), (21, 10)], 1) + path([(28, 20), (28, 21)], 1) + path([(22, 21), (28, 21)], 1))
    # 문이 생긴 뒤 의자·난간이 문 바로 앞을 막았다 — 문 옆으로 비킨다(문 칸 4·11·21·28)
    for oid, x, y in (('wildwest_porch_awning', 19, 8), ('wildwest_porch_awning', 5, 7), ('wildwest_boardwalk_rail', 12, 10), ('wildwest_bench_long', 22, 10), ('wildwest_bench_long', 0, 10)):
        c.try_obj(oid, x, y)
    # 물탱크 탑 · 풍차 · 짐수레 · 상자·통 덩이(큰길 남쪽)
    for oid, x, y in (('wildwest_water_tower', 3, 14), ('wildwest_windmill_frame', 29, 1), ('wildwest_wagon', 10, 15), ('wildwest_crates_stack', 14, 15),
                      ('wildwest_barrels_pair', 16, 15), ('wildwest_hitching_post_tall', 8, 14), ('wildwest_fence_rail', 23, 15)):
        c.try_obj(oid, x, y)
    # 선인장 무리·바위·마른 덤불(가장자리, 무리로)
    import random
    rnd = random.Random(9)
    for gx, gy, gw, gh in [(0, 18, 9, 4), (12, 18, 8, 4), (25, 0, 4, 5), (30, 7, 4, 3), (0, 0, 2, 3), (15, 0, 3, 5), (23, 16, 3, 6)]:
        for _ in range(20):
            c.try_obj(('wildwest_cactus_big', 'wildwest_cactus_tall')[rnd.randrange(2)], gx + rnd.randrange(gw), gy + rnd.randrange(gh))
    smalls = [o['id'] for o in c.ctx.names['bundles'][c.b]['objects'] if o['id'].startswith(('wildwest_post_prop', 'wildwest_small_prop'))]
    for cx, cy in [(6, 14), (13, 13), (24, 13), (31, 13), (9, 20), (17, 20), (27, 10)]:
        for dx, dy in ((0, 0), (1, 0), (0, 1)):
            c.try_obj(smalls[rnd.randrange(len(smalls))], cx + dx, cy + dy)
    # 북쪽 모래 언덕(짙은 모래 땅 덩이 + 바위) · 큰길 남쪽 우물터 · 동쪽 집 앞 울타리 마당
    c.kind(1, 'A2:3', blob(4, 0, [(0, 6), (-1, 7), (1, 5)]) + blob(20, 0, [(0, 4), (-1, 5), (0, 4)]))
    for oid, x, y in (('wildwest_crates_stack', 10, 3), ('wildwest_barrels_pair', 12, 3), ('wildwest_fence_rail', 26, 13), ('wildwest_fence_rail', 29, 13),
                      ('wildwest_hitching_post_tall', 17, 11), ('wildwest_wagon', 1, 12), ('wildwest_bench_long', 29, 20), ('wildwest_crates_stack', 31, 20)):
        c.try_obj(oid, x, y)
    for cx, cy in [(2, 12), (8, 9), (16, 13), (25, 12), (30, 11), (5, 17), (19, 18), (28, 20), (12, 1), (22, 2), (5, 1), (8, 3), (20, 13), (0, 7), (15, 8), (24, 8), (32, 16)]:
        c.kind(2, ('A2:13', 'A2:5', 'A2:4')[(cx + cy) % 3], [(cx + dx, cy + dy) for dx, dy in ((0, 0), (1, 0), (0, 1)) if c.ok(cx + dx, cy + dy) and c.ground(cx + dx, cy + dy) == 'floor' and c.L[3][(cy + dy) * c.w + cx + dx] is None])
    return c



@example
def ex_skull_crypt(ctx):
    """해골 지하묘지 30×20 — 회색 돌·검갈색 흙벽(A4, 방마다 다름) · 모자이크 바닥 · 벽감 석관 묘실 / 뼈 무더기 납골실 / 붉은 살덩이 혼돈의 방 / 입구 복도.
    바닥 격자 덮개·모자이크 조각은 2층 덩이로. 좌우 대칭 금지."""
    c = Canvas(ctx, 'rasak_crypt', 30, 20, 'ex_skull_crypt', 'Rasak 예제 · 해골 지하묘지(묘실·납골실·혼돈의 방)')
    TOP = 'A4:0'
    interior(c, TOP, [
        (1, 1, 12, 9, 'A4:27', 'A2:0'),     # 벽감 묘실(회색 돌)
        (14, 1, 28, 8, 'A4:11', 'A2:1'),    # 납골실(검갈색)
        (1, 11, 11, 18, 'A4:43', 'A2:2'),   # 혼돈의 방(짙은 벽돌)
        (13, 10, 28, 18, 'A4:25', 'A2:3'),  # 입구 복도
    ], doors=door_v(13, 5, 'A2:0') + door_h(6, 10, 'A2:2') + door_h(20, 9, 'A2:1') + door_v(12, 14, 'A2:3') + [(20, 19, 'A2:3')])
    import random
    rnd = random.Random(13)
    ids = sorted({o['id'] for o in c.ctx.names['bundles'][c.b]['objects']})   # set 순회는 실행마다 순서가 달라 결과가 흔들린다
    pick = lambda pre: [i for i in ids if i.startswith(pre)]
    # 벽감 묘실: 석관 줄 · 묘비 · 유골 단지 · 벽 선반
    for oid, x, y in (('crypt_sarcophagus_a', 2, 3), ('crypt_sarcophagus_c', 5, 3), ('crypt2_stone_sarcophagus_big', 8, 5), ('crypt_tomb_tall_a', 1, 6),
                      ('crypt_headstone_round_b', 11, 3), ('crypt_urn_large_56', 9, 3), ('crypt_bones_pile_a', 5, 7), ('crypt_wall_shelf_38', 2, 2), ('crypt_wall_shelf_54', 8, 2)):
        oid in ids and c.try_obj(oid, x, y)
    # 납골실: 관 더미 · 뼈 무더기 · 해골 선반 · 촛불
    for oid, x, y in (('crypt2_coffin_stack_wood', 15, 3), ('crypt2_coffin_lid_open', 19, 3), ('crypt2_skeleton_sitting', 23, 3), ('dungeon_candle_lit', 26, 3),
                      ('crypt_bones_pile_a', 17, 6), ('crypt2_bone_long_18', 22, 6), ('crypt_urn_bones_spill', 25, 6)):
        oid in ids and c.try_obj(oid, x, y)
    # 혼돈의 방: 붉은 살덩이·가시·알
    chaos = sorted(pick('chaos_'), key=lambda i: -c.ctx.object(c.b, i)['size'][0] * c.ctx.object(c.b, i)['size'][1])
    for _ in range(80):
        if not chaos: break
        c.try_obj(chaos[rnd.randrange(min(12, len(chaos)))], 2 + rnd.randrange(9), 12 + rnd.randrange(6))
    # 입구 복도: 석상 · 촛대 · 뼈 조각 · 핏자국
    for oid, x, y in (('crypt_dark_statue_a', 14, 11), ('crypt_dark_statue_b', 27, 11), ('dungeon_candle_lit', 17, 12), ('dungeon_candle_unlit', 24, 12),
                      ('dungeon_blood_pool', 21, 15), ('crypt_bones_pile_a', 15, 16), ('dungeon_skull_small', 26, 16)):
        oid in ids and c.try_obj(oid, x, y)
    # 방마다 소품 풀에서 무리로 채운다(없는 id 는 건너뜀)
    def fill(pools, box, n):
        x0, y0, x1, y1 = box
        items = [i for pre in pools for i in ids if i.startswith(pre)]
        for _ in range(n):
            if items: c.try_obj(items[rnd.randrange(len(items))], x0 + rnd.randrange(x1 - x0), y0 + rnd.randrange(y1 - y0))
    # 통로(문과 문을 잇는 줄)는 비운다 — 먼저 표시해 두고 채운 뒤 다시 비운다
    lanes = {(x, 5) for x in range(2, 29)} | {(6, y) for y in range(3, 18)} | {(20, y) for y in range(3, 19)} | {(x, 14) for x in range(2, 29)}
    for (lx, ly) in lanes:
        c.owner.setdefault((3, ly * c.w + lx), '__lane__')
    fill(('crypt_urn_', 'crypt_bones_pile', 'crypt_tomb', 'crypt_headstone', 'crypt_sarcophagus', 'crypt2_stone_sarcophagus'), (2, 3, 12, 9), 25)
    fill(('crypt2_coffin_', 'crypt2_skeleton_', 'crypt2_torch', 'crypt_bones_pile'), (15, 3, 28, 8), 22)
    fill(('crypt2_candle_skull', 'crypt_dark_statue', 'crypt2_torch', 'crypt_urn_tall'), (14, 11, 28, 18), 14)
    for k_ in [k_ for k_, v in c.owner.items() if v == '__lane__']:
        del c.owner[k_]
    small = [i for i in pick('dungeon_pebble') + pick('crypt_pebbles') + pick('dungeon_blood_spots') + pick('crypt2_bone') if c.ctx.object(c.b, i)['size'] == [1, 1]]
    for _ in range(120):
        x, y = rnd.randrange(30), rnd.randrange(20)
        if small and rnd.random() < 0.4: c.try_obj(small[rnd.randrange(len(small))], x, y)
    for cx, cy in [(3, 8), (9, 7), (16, 5), (25, 5), (18, 14), (23, 16)]:
        c.kind(2, ('A2:4', 'A2:7')[(cx + cy) % 2], [(cx + dx, cy + dy) for dx, dy in ((0, 0), (1, 0), (0, 1), (1, 1)) if c.ok(cx + dx, cy + dy) and c.ground(cx + dx, cy + dy) == 'floor' and c.L[3][(cy + dy) * c.w + cx + dx] is None])
    return c



@example
def ex_temple_hall(ctx):
    """사암 신전·동양 실내 30×20 — 사암 벽(A4) · 방마다 다른 판석 바닥 · 옥좌가 있는 본전(붉은 융단·기둥 줄·제단) / 회색 돌 명상실(돌 옥좌·탁자) /
    다다미 객실(장지문 벽·이불·낮은 탁자) / 입구 회랑(기둥·등). 기둥은 줄로, 융단은 본전 가운데 길에만. 좌우 대칭 금지."""
    c = Canvas(ctx, 'rasak_temple', 30, 20, 'ex_temple_hall', 'Rasak 예제 · 사암 신전과 동양 실내(본전·명상실·다다미 객실)')
    interior(c, 'A4:0', [
        (1, 1, 15, 11, 'A4:27', 'A2:0'),    # 본전
        (17, 1, 28, 8, 'A4:24', 'A2:16'),   # 회색 돌 명상실
        (17, 10, 28, 18, 'A4:40', 'A2:8'),  # 다다미 객실
        (1, 13, 15, 18, 'A4:10', 'A2:1'),   # 입구 회랑
    ], doors=door_v(16, 5, 'A2:0') + door_h(8, 12, 'A2:0') + door_v(16, 15, 'A2:1') + door_h(22, 9, 'A2:16') + [(8, 19, 'A2:1')])
    ids = sorted({o['id'] for o in c.ctx.names['bundles'][c.b]['objects']})   # set 순회는 실행마다 순서가 달라 결과가 흔들린다
    put = lambda oid, x, y: oid in ids and c.try_obj(oid, x, y)
    # 본전: 가운데 붉은 융단 길(2층) · 기둥 줄 양옆(간격 다르게) · 옥좌 · 제단 · 향로
    c.kind(2, 'A2:7', [(8, y) for y in range(4, 12)] + [(7, y) for y in range(4, 12)])
    for x, y in ((3, 4), (3, 8), (12, 4), (12, 7)):
        put('temple_pillar_wood_a' if 'temple_pillar_wood_a' in ids else 'temple2_pillar_stone_a', x, y)
    for oid, x, y in (('temple_throne_altar', 6, 1), ('temple_table_long_runner', 10, 2), ('temple_bench_low', 2, 2), ('temple_table_round', 12, 9)):
        put(oid, x, y)
    # 명상실(회색 돌): 돌 옥좌 · 돌 탁자 · 돌 기둥 · 돌 난간
    for oid, x, y in (('temple2_throne_altar', 21, 1), ('temple2_table_plain', 18, 4), ('temple2_pillar_stone_a', 26, 3), ('temple2_railing_stone', 24, 6), ('temple2_bench_low', 18, 7)):
        put(oid, x, y)
    # 다다미 객실: 장지문 벽(북쪽 벽 아래) · 이불 · 낮은 탁자 · 걸어 둔 천
    jp = sorted(i for i in ids if i.startswith('japanese_'))
    for oid, x, y in (('japanese_shoji_wall_a', 18, 11), ('japanese_futon_folded', 18, 14), ('japanese_futon_h', 21, 16), ('japanese_lacquer_wide', 24, 14),
                      ('japanese_wood_rack_wide', 26, 16)):
        put(oid, x, y)
    import random
    rnd = random.Random(17)
    smalls = [i for i in jp if c.ctx.object(c.b, i)['size'] == [1, 1] and c.ctx.object(c.b, i)['layer'] == 3]
    for _ in range(25):
        if smalls: c.try_obj(smalls[rnd.randrange(len(smalls))], 18 + rnd.randrange(10), 13 + rnd.randrange(5))
    # 입구 회랑: 기둥 줄 · 등 · 붉은 끈
    for x in (3, 7, 11, 14):
        put('temple2_post_stone_short_a', x, 14)
    for oid, x, y in (('temple_cord_red_long', 5, 13), ('temple_cord_red_long', 12, 13)):
        put(oid, x, y)
    # 방별 풀 채우기 — 문을 잇는 통로는 예약해 비운다
    lanes = {(x, 5) for x in range(2, 29)} | {(8, y) for y in range(3, 19)} | {(22, y) for y in range(3, 18)} | {(x, 15) for x in range(2, 29)}
    for (lx, ly) in lanes:
        c.owner.setdefault((3, ly * c.w + lx), '__lane__')
    def fill(pools, box, n):
        x0, y0, x1, y1 = box
        items = [i for pre in pools for i in ids if i.startswith(pre) and c.ctx.object(c.b, i)['layer'] == 3]
        for _ in range(n):
            if items: c.try_obj(items[rnd.randrange(len(items))], x0 + rnd.randrange(x1 - x0), y0 + rnd.randrange(y1 - y0))
    fill(('temple_table', 'temple_bench', 'temple_post', 'temple_pillar_wood', 'temple_railing', 'temple_stand', 'temple_frame'), (2, 3, 15, 11), 45)
    fill(('temple2_table', 'temple2_bench', 'temple2_post', 'temple2_pillar', 'temple2_stand', 'temple2_railing'), (18, 3, 28, 8), 35)
    fill(('japanese_',), (18, 12, 28, 18), 45)
    fill(('temple_post', 'temple2_post', 'temple_bench', 'temple_stand'), (2, 14, 15, 18), 25)
    for k_ in [k_ for k_, v in c.owner.items() if v == '__lane__']:
        del c.owner[k_]
    # 바닥 결: 사암 네모 판(2층) 덩이
    for cx, cy in [(2, 10), (13, 11), (19, 6), (25, 3), (5, 16), (12, 16)]:
        c.kind(2, 'A2:5', [(cx + dx, cy) for dx in (0, 1) if c.ok(cx + dx, cy) and c.ground(cx + dx, cy) == 'floor' and c.L[3][cy * c.w + cx + dx] is None])
    return c



@example
def ex_skull_ossuary(ctx):
    """해골 납골당 28×20 — 벽 전체가 해골이 박힌 납골 벽(A4 변형판). 굽은 복도 + 크기가 다른 방 넷(큰 납골실·관 창고·제단 굴·막다른 뼈 구덩이).
    통로 칸을 먼저 예약하고 방별 소품 풀로 채운다. 좌우 대칭 금지."""
    c = Canvas(ctx, 'rasak_crypt_skulls', 28, 20, 'ex_skull_ossuary', 'Rasak 예제 · 해골 납골당(해골 박힌 벽)')
    interior(c, 'A4:0', [
        (1, 1, 13, 8, 'A4:8', 'A2:0'),      # 큰 납골실
        (15, 1, 26, 6, 'A4:24', 'A2:1'),    # 관 창고
        (1, 10, 8, 18, 'A4:40', 'A2:2'),    # 막다른 뼈 구덩이
        (10, 10, 26, 18, 'A4:11', 'A2:3'),  # 제단 굴
    ], doors=door_v(14, 4, 'A2:0') + door_h(5, 9, 'A2:2') + door_v(9, 14, 'A2:3') + door_h(20, 7, 'A2:1') + [(18, 19, 'A2:3')])
    import random
    rnd = random.Random(29)
    ids = sorted({o['id'] for o in c.ctx.names['bundles'][c.b]['objects']})   # set 순회는 실행마다 순서가 달라 결과가 흔들린다
    lanes = {(x, 4) for x in range(2, 26)} | {(5, y) for y in range(3, 18)} | {(x, 14) for x in range(2, 26)} | {(20, y) for y in range(3, 19)}
    for (lx, ly) in lanes:
        c.owner.setdefault((3, ly * c.w + lx), '__lane__')
    def fill(pools, box, n):
        x0, y0, x1, y1 = box
        items = [i for pre in pools for i in ids if i.startswith(pre) and c.ctx.object(c.b, i)['layer'] == 3 and '벽걸이' not in c.ctx.object(c.b, i)['name']]
        for _ in range(n):
            if items: c.try_obj(items[rnd.randrange(len(items))], x0 + rnd.randrange(x1 - x0), y0 + rnd.randrange(y1 - y0))
    fill(('crypt_urn_', 'crypt_bones_pile', 'crypt_sarcophagus', 'crypt2_stone_sarcophagus', 'crypt_tomb'), (2, 3, 13, 8), 45)
    fill(('crypt2_coffin_', 'crypt2_skeleton_'), (16, 3, 26, 6), 30)
    fill(('crypt_bones_pile', 'crypt2_skeleton_', 'crypt_urn_bones'), (2, 12, 8, 18), 28)
    fill(('crypt_dark_statue', 'crypt2_candle_skull', 'crypt2_torch', 'chaos_'), (11, 12, 26, 18), 55)
    for k_ in [k_ for k_, v in c.owner.items() if v == '__lane__']:
        del c.owner[k_]
    for cx, cy in [(3, 7), (11, 6), (23, 5), (3, 16), (13, 16), (24, 12)]:
        c.kind(2, ('A2:4', 'A2:7')[(cx + cy) % 2], [(cx + dx, cy + dy) for dx, dy in ((0, 0), (1, 0), (0, 1), (1, 1)) if c.ok(cx + dx, cy + dy) and c.ground(cx + dx, cy + dy) == 'floor' and c.L[3][(cy + dy) * c.w + cx + dx] is None])
    return c


@example
def ex_stone_temple(ctx):
    """회색 돌 신전 28×20 — 회색 돌 A4 변형판. 북동 큰 성소(남색 융단·돌 기둥·제단) / 서쪽 좁은 수도사 방(이불·낮은 탁자) / 남쪽 넓은 회랑(돌 말뚝·등) / 남동 작은 보물실.
    통로 예약 후 방별 풀. 좌우 대칭 금지."""
    c = Canvas(ctx, 'rasak_temple2', 28, 20, 'ex_stone_temple', 'Rasak 예제 · 회색 돌 신전(성소·수도사 방·회랑)')
    interior(c, 'A4:0', [
        (9, 1, 26, 10, 'A4:27', 'A2:16'),   # 성소
        (1, 1, 7, 10, 'A4:8', 'A2:24'),     # 수도사 방
        (1, 12, 18, 18, 'A4:40', 'A2:16'),  # 회랑
        (20, 12, 26, 18, 'A4:14', 'A2:24'), # 보물실
    ], doors=door_v(8, 6, 'A2:16') + door_h(4, 11, 'A2:24') + door_h(15, 11, 'A2:16') + door_v(19, 15, 'A2:16') + [(10, 19, 'A2:16')])
    import random
    rnd = random.Random(41)
    ids = sorted({o['id'] for o in c.ctx.names['bundles'][c.b]['objects']})   # set 순회는 실행마다 순서가 달라 결과가 흔들린다
    c.kind(2, 'A2:23', [(15, y) for y in range(4, 11)] + [(16, y) for y in range(4, 11)])
    lanes = {(15, y) for y in range(3, 12)} | {(16, y) for y in range(3, 12)} | {(x, 6) for x in range(2, 10)} | {(x, 15) for x in range(2, 26)} | {(4, y) for y in range(3, 16)} | {(10, y) for y in range(12, 19)}
    for (lx, ly) in lanes:
        c.owner.setdefault((3, ly * c.w + lx), '__lane__')
    def fill(pools, box, n):
        x0, y0, x1, y1 = box
        items = [i for pre in pools for i in ids if i.startswith(pre) and c.ctx.object(c.b, i)['layer'] == 3 and '벽걸이' not in c.ctx.object(c.b, i)['name']]
        for _ in range(n):
            if items: c.try_obj(items[rnd.randrange(len(items))], x0 + rnd.randrange(x1 - x0), y0 + rnd.randrange(y1 - y0))
    for oid, x, y in (('temple2_throne_altar', 14, 1), ('temple2_pillar_stone_a', 12, 4), ('temple2_pillar_stone_a', 19, 5), ('temple2_pillar_stone_b', 23, 3)):
        oid in ids and c.try_obj(oid, x, y)
    fill(('temple2_table', 'temple2_bench', 'temple2_stand', 'temple2_railing', 'temple2_post'), (10, 3, 26, 10), 22)
    fill(('japanese_',), (2, 3, 7, 10), 34)
    fill(('temple2_',), (2, 13, 18, 18), 60)
    # 오른아래 납골 곁방: 벽에는 아치 창(벽걸이), 바닥에는 돌 궤·묘표·기둥·촛대
    for oid, x, y in (('crypt_urn_large_72', 21, 12), ('crypt_urn_tall_76', 25, 12)):
        oid in ids and c.obj(oid, x, y)
    fill(('crypt_stone_chest', 'crypt_stone_post', 'crypt_headstone_round', 'crypt_stone_pillar', 'crypt_niche_candle', 'crypt_dark_statue'), (20, 14, 26, 18), 40)
    for k_ in [k_ for k_, v in c.owner.items() if v == '__lane__']:
        del c.owner[k_]
    return c
