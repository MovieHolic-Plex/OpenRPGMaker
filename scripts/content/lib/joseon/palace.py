"""조선 궁 내부 키트 묶음(`pal_` 접두) — 구조(palace_kit.py) + 기물(props_pal.py) + 메타·통행(pal_meta).

방 시트(demo_palace_in.PalaceSheet)는 공용 실내 키트(`in_`)에 이것을 더해 쌓는다 — 공용 실내 시트(demo_interior)의 칸 번호는 바뀌지 않는다.
"""
import palace_kit as _K
import props_pal as _P


def terrain():
    return _K.terrain()


def objects():
    d = dict(_K.objects())
    d.update(_P.objects())
    return d


# ------------------------------------------------------------------ 메타 · 통행(X 막힘 · C 걸음★사람 위에 그려짐 · F 걸음)
F_ALL = ('pal_bangseok_red', 'pal_bangseok_blue', 'pal_gungnyeo_jari', 'pal_exit_door', 'pal_exit_door2', 'pal_exit_door3', 'pal_exit_door4',
         'pal_dais_steps_4', 'pal_dais_steps_6')
C_ALL = ('pal_ceil_beam_m', 'pal_ceil_beam_l', 'pal_ceil_beam_r', 'pal_deung_hang')
GRIDS = {'pal_pillar': ['C', 'C', 'X'], 'pal_pillar_2': ['C', 'X']}
TERRAIN = {
    'pal_floor_jeon': '조선 궁 전돌 바닥(큰 방전)', 'pal_floor_maru': '조선 궁 마루(옻칠 넓은 널)', 'pal_floor_ondol': '조선 궁 침전 황장판',
    'pal_floor_dais': '조선 궁 월대 윗면·마당 박석', 'pal_floor_carpet': '조선 궁 붉은 카펫(4방 이음 16칸)', 'pal_ceil47': '조선 궁 단청 천장 띠(블롭 47)',
    'pal_ceil_front': '조선 궁 바깥 아랫벽(단청 윗면 + 바깥 회벽면)',
}
REFS = ['table_mugs', 'fish_barrel', 'bench_wood']
THIN = {}


def meta_and_walk():
    meta, walk = {}, {}
    for n in objects():
        if n.startswith('pal_wall_'):
            meta[n] = {'cls': 'wall', 'refs': ['castle.wall_h', 'estate.wall'], 'seam_open': True, 'front_only': True,
                       'kit': 'palace_kit.walls — 분합문·창호·회벽 1×2 (끝 변형 m/l/r/lr, 문짝 doorl/doorr), 방 빌더가 평면도에서 놓는다'}
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
    ter = {k: {'name': v, 'walk': (k != 'pal_ceil47' and k != 'pal_ceil_front'), 'role': 'terrain'} for k, v in TERRAIN.items()}
    ter['pal_ceil47'] = {'kind': 'blob47', 'name': TERRAIN['pal_ceil47'], 'walk': False, 'role': 'terrain', 'connect': ['pal_ceil47'], 'edgeConnects': True}
    return meta, walk, ter
