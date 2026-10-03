"""조선 실내 조각의 메타(pieces_meta.json)·통행 보정(piece-walk-overrides.json) 표. in_register.py 가 두 JSON 에 멱등으로 합친다.

통행 문자: X 막힘 / C 걸음★(사람 위에 그려짐) / F 걸음(바닥). 자동 규칙(walk.py)은 「불투명 화소 30 이상인 칸 = X」라서
가는 소품(촛대·회초리 통)이 걸어지는 칸이 되는 것을 막으려고 기본을 `all: X` 로 둔다. 걷는 바닥 장식·문턱·출구·계단 디딤만 예외.
"""
import interior_room as IR

FLOOR_NAMES = {
    'in_floor_ondol': '조선 실내 온돌 장판', 'in_floor_maru': '조선 실내 마루', 'in_floor_dirt': '조선 실내 흙바닥',
    'in_floor_stone': '조선 실내 돌바닥(박석)', 'in_floor_jeondol': '조선 실내 전돌 바닥',
}
TERRAIN = {k: {'name': v, 'walk': True, 'role': 'terrain'} for k, v in FLOOR_NAMES.items()}
TERRAIN['in_ceil47'] = {'kind': 'blob47', 'name': '조선 실내 천장 (기와 단면 림)', 'walk': False, 'role': 'terrain',
                        'connect': ['in_ceil47'], 'edgeConnects': True}

F_ALL = ('in_door_sill', 'in_exit_door', 'in_exit_door2', 'in_stairs_down', 'in_dais_steps', 'in_jipjari_1', 'in_jipjari_2',
         'in_bangseok_r', 'in_bangseok_b', 'in_bangseok_g', 'in_mat_hopi', 'in_mat_dot_2x2', 'in_runner_m', 'in_runner_n')
GRIDS = {
    'in_stairs_wood_3': ['XXX', 'FFF', 'FFF'], 'in_stairs_stone_3': ['XXX', 'FFF', 'FFF'], 'in_stairs_wood_2': ['XX', 'FF', 'FF'],
    'in_pillar': ['C', 'X'], 'in_pillar_3': ['C', 'C', 'X'], 'in_ladder_loft': ['X', 'X', 'F'],
}
C_ALL = ('in_ceil_beam_m', 'in_ceil_beam_l', 'in_ceil_beam_r')
# 벽·천장에 걸리는 조각(벽면 두 줄 위에만 놓는다): 놓는 자리 검사에 쓴다
HUNG = ('in_jokja_a', 'in_jokja_b', 'in_herb_hang', 'in_tool_rack', 'in_seonban', 'in_seonban_bottles', 'in_hang_sirae', 'in_hang_gochu', 'in_hang_meju', 'in_hang_bagaji')
THIN = {'in_betl': '날실이 폭 1px 실이다(베틀의 본질) — 실 한 가닥을 2px 로 그리면 천이 판자로 읽힌다', 'in_mulle': '바퀴 살·테가 폭 1px 가늘다(물레의 본질) — 2px 로 굵히면 바퀴가 접시로 읽힌다'}
REFS = ['table_mugs', 'fish_barrel', 'bench_wood']


def meta_and_walk():
    objs = IR.all_objects()
    meta, walk = {}, {}
    for n in objs:
        if n.startswith('in_wall_'):
            meta[n] = {'cls': 'wall', 'refs': ['castle.wall_h', 'estate.wall'], 'seam_open': True, 'front_only': True,
                       'kit': 'interior_kit.walls — 벽면 1×2 (끝 변형 m/l/r/lr), 방 빌더가 평면도에서 놓는다'}
            walk[n] = {'all': 'X'}
        else:
            meta[n] = {'cls': 'prop', 'refs': REFS, 'interior': True}
            if n in THIN:
                meta[n]['thin_ok'] = THIN[n]
            if n in GRIDS:
                walk[n] = {'grid': GRIDS[n]}
            elif n in F_ALL:
                walk[n] = {'all': 'F'}
            elif n in C_ALL:
                walk[n] = {'all': 'C'}
            else:
                walk[n] = {'all': 'X'}
    return meta, walk
