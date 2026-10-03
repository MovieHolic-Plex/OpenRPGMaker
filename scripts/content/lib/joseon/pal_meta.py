"""조선 궁 내부 조각(pal_)의 분류(pieces_meta.json)·통행 보정(piece-walk-overrides.json)을 덧붙이기 전용·멱등으로 쓴다.

    python3 pal_meta.py          # pal_ 조각 전부의 메타·통행·지형 정의를 두 JSON 에 덧붙인다(이미 있으면 같은 값으로 갱신)
기준 조각(refs)은 실내 v5 기물('v5:<id>')과 후보 B 조각('inb:<이름>')이다 — 같은 배율로 옆에 놓고 눈으로 본다(gate.ref_image).
통행 문자(X 막힘 / C 걸음★ 사람 위 / F 걸음): 몸통 X, 벽·벽면에 걸치는 윗부분 C, 깔개·어도·단 윗면·계단 F.
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
META_P = os.path.join(HERE, 'harness', 'pieces_meta.json')
WALK_P = os.path.join(ROOT, 'tiledata/joseon-village/piece-walk-overrides.json')
P = 'pal_'

REFS = [
    ('wall_gungho', ['inb:in_b_wall_changho_m', 'v5:window']), ('wall_gung', ['inb:in_b_wall_hoe_m', 'v5:wall:plaster']),
    ('door_gung_open', ['inb:in_b_door_open', 'v5:round door']), ('door_gung', ['inb:in_b_door_slide_l', 'v5:round door']),
    ('pillar_dan_2', ['inb:in_b_pillar_red_2', 'v5:column wood']), ('pillar_dan_3', ['inb:in_b_pillar_red_3', 'v5:column marble']),
    ('beam_dan', ['inb:in_b_beam_red_m']),
    ('dais_top', ['inb:in_b_dais_wood_m', 'v5:floor:plank']), ('dais_face', ['inb:in_b_dais_stone_m', 'v5:stairs up stone']),
    ('dais_stair', ['inb:in_b_stair_dais_3', 'v5:stairs up stone']),
    ('mat_carpet', ['v5:aisle runner', 'v5:runner']), ('mat_run', ['v5:runner', 'v5:aisle runner']),
    ('mat_gung', ['inb:in_b_mat_dot_2x2', 'v5:rug red']), ('mat_sinha', ['inb:in_b_mat_dot_2x2', 'v5:rug red']),
    ('nangan', ['v5:bench 2', 'v5:towel rail']),
    ('ilwol_byeongpung', ['inb:in_b_byeongpung_royal', 'v5:tapestry', 'v5:royal banner']), ('yongsang', ['v5:throne', 'v5:stone throne']),
    ('hyangro', ['inb:in_b_hwaro', 'v5:brazier']), ('buk_big', ['inb:in_b_buk', 'v5:barrel']), ('jong_geori', ['v5:bell rope', 'v5:column wood']),
    ('deungnong', ['inb:in_b_deungjan_stand', 'v5:hanging lantern']), ('hang_deungnong', ['v5:hanging lantern', 'v5:wall sconce']),
    ('deumeu', ['v5:water trough', 'v5:washbasin']),
    ('byeongpung_gung', ['inb:in_b_byeongpung_b', 'v5:tapestry']), ('chimgu', ['inb:in_b_ibul_r', 'v5:double bed red']),
    ('seoan', ['inb:in_b_seoan_2', 'v5:desk 2x1']), ('hwaro', ['inb:in_b_hwaro', 'v5:brazier']), ('chotdae_big', ['inb:in_b_chotdae', 'v5:candelabra']),
    ('yong_jang', ['inb:in_b_ibuljang', 'v5:wardrobe']), ('bangseok', ['inb:in_b_banseok_r', 'v5:stool']),
    ('hang_jokja', ['inb:in_b_jokja_a', 'v5:picture']),
]
WALL_PFX = ('wall_', 'door_gung')
FRONT_ONLY = WALL_PFX + ('pillar', 'beam', 'dais', 'ilwol', 'hang_', 'mat_', 'nangan', 'byeongpung_gung')
FLAT = ('mat_', 'bangseok', 'dais_top', 'dais_stair')


def short(name):
    return name[len(P):]


def refs_for(name):
    s = short(name)
    for pfx, ids in REFS:
        if s.startswith(pfx):
            return list(ids)
    return ['v5:chest']


# 게이트 T(가는 줄 비율) 예외 — 본질이 1px 가는 줄인 조각만, 이유와 함께
THIN = {}


def meta_for(name):
    s = short(name)
    m = {'cls': 'wall' if s.startswith(WALL_PFX) else 'prop', 'refs': refs_for(name)}
    if s in THIN:
        m['thin_ok'] = THIN[s]
    if s.startswith(WALL_PFX):
        m['seam_open'] = True
    if s.startswith(FRONT_ONLY):
        m['front_only'] = True
    return m


# 몸통이 바닥에 닿는 아랫줄 수(나머지 윗줄은 걸음★: 벽면에 걸치거나 사람 위에 그려지는 부분)
FOOT = {'pal_ilwol_byeongpung': 1, 'pal_byeongpung_gung': 1, 'pal_yong_jang': 1, 'pal_chotdae_big': 1,
        'pal_deungnong_a': 1, 'pal_deungnong_b': 1}


def walk_for(name, objs):
    s = short(name)
    if s.startswith(WALL_PFX) or s.startswith('dais_face') or s.startswith('nangan'):
        return {'all': 'X'}
    if s.startswith('beam'):
        return {'all': 'C'}
    if s.startswith('pillar_dan'):
        rows = int(s[len('pillar_dan_')])
        return {'grid': ['C'] * (rows - 1) + ['X']}
    if s == 'dais_stair_3':
        return {'all': 'F'}
    if s.startswith(FLAT):
        return {'all': 'F'}
    if name in FOOT:
        cv = objs[name]
        h, w = cv.h // 16, cv.w // 16
        return {'grid': [('C' * w) if r < h - FOOT[name] else ('X' * w) for r in range(h)]}
    return {'all': 'X'}


def terrain_defs(terr_names):
    out = {}
    for n in terr_names:
        s = short(n)
        if s == 'ceil47':
            out[n] = {'kind': 'blob47', 'name': '조선 궁 천장(단청 띠·벽 덩어리·어둠)', 'walk': False, 'role': 'terrain', 'connect': [n], 'edgeConnects': True}
        elif s.endswith('_sh'):
            out[n] = {'name': '조선 궁 전돌 바닥 (벽 밑 그늘 변형: 위·왼쪽·위+왼쪽)', 'walk': True}
        else:
            out[n] = {'name': '조선 궁 전돌 바닥', 'walk': True}
    return out


def build(objs, terr):
    ins = [n for n in objs if n.startswith(P)]
    meta = {n: meta_for(n) for n in ins}
    walk = {n: walk_for(n, objs) for n in ins}
    return meta, walk, terrain_defs([t for t in terr if t.startswith(P)])


def main():
    import pal_demo
    terr, objs = pal_demo.sheet_objects()
    objs = {k: v for k, v in objs.items() if k.startswith(P)}
    terr = {k: v for k, v in terr.items() if k.startswith(P)}
    meta, walk, tdef = build(objs, terr)
    pm = json.load(open(META_P))
    pm.update(meta)
    json.dump(pm, open(META_P, 'w'), ensure_ascii=False, indent=1)
    ov = json.load(open(WALK_P))
    ov['pieces'].update(walk)
    ov['terrain'].update(tdef)
    json.dump(ov, open(WALK_P, 'w'), ensure_ascii=False, indent=1)
    print('pal_ 조각 메타·통행', len(meta), '개, 지형', len(tdef), '묶음')


if __name__ == '__main__':
    main()
