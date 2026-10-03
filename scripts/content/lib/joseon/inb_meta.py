"""조선 실내 후보 B 조각(in_b_)의 분류(pieces_meta.json)·통행 보정(piece-walk-overrides.json)을 덧붙이기 전용·멱등으로 쓴다.

    python3 inb_meta.py          # in_b_ 조각 전부의 메타·통행·지형 정의를 두 JSON 에 덧붙인다(이미 있으면 같은 값으로 갱신)
기준 조각(refs)은 버들항 객체가 아니라 실내 v5 기물('v5:<id>', gate.ref_image 가 읽는다)이다 — 실내는 v5 와 같은 배율로 옆에 놓고 본다.
통행 문자(X 막힘 / C 걸음★ 사람 위 / F 걸음): 가구 몸통은 X, 벽에 붙는 높은 가구의 윗부분(벽면에 걸친 부분)은 C, 깔개·계단 디딤은 F.
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
META_P = os.path.join(HERE, 'harness', 'pieces_meta.json')
WALK_P = os.path.join(ROOT, 'tiledata/joseon-village/piece-walk-overrides.json')
P = 'in_b_'

REFS = [
    ('wall_hoe', ['wall:plaster', 'wall:log']), ('wall_mok', ['wall:log', 'wall:livewood']), ('wall_heuk', ['wall:rubble', 'wall:plaster']),
    ('wall_dol', ['wall:stone', 'wall:grey']), ('wall_changho', ['wall:plaster', 'window']), ('win_', ['window', 'round window']),
    ('door_slide', ['round door', 'round arch']), ('door_', ['round door', 'doormat']),
    ('pillar', ['column wood', 'column stone']), ('beam', ['column wood']), ('stair_up', ['stairs up wood', 'stairs up stone']),
    ('ladder', ['stairs up wood']), ('stair_down', ['stairs down']), ('stair_dais', ['stairs up stone']), ('dais', ['stairs up stone']),
    ('exit_mat', ['doormat']),
    ('byeongpung', ['tapestry', 'royal banner']), ('ibuljang', ['wardrobe', 'cupboard']), ('nong', ['wardrobe', 'cupboard']),
    ('bandaji', ['chest']), ('munggap', ['sideboard 2x1', 'cupboard']), ('soban', ['roundtable']), ('sang_low', ['dining 2x1', 'desk 2x1']),
    ('gyojasang', ['dining 2x1', 'tea 2x1']), ('hwaro', ['brazier']), ('deungjan', ['candle']), ('chotdae', ['candle', 'candelabra']),
    ('banseok', ['stool']), ('mat_', ['rug red', 'fur rug']), ('ibul', ['bed green', 'straw bed']), ('jokja', ['picture', 'wall map']),
    ('hang_', ['hang:herb', 'hang:onion']), ('pyeongsang', ['bench 3', 'bench 2']), ('geolsang', ['bench 2']), ('stool', ['stool']),
    ('bumak', ['kitchen range', 'stove']), ('hangari', ['pot', 'water jar']), ('dok', ['pot']), ('ssal', ['chest', 'barrel']),
    ('muldongi', ['water jar']), ('sokuri', ['basket:cabbage']), ('jangjak', ['firewood bundle']), ('seonban', ['bookshelf 2w']),
    ('betul', ['loom']), ('mulle', ['spinning wheel']), ('sewing', ['chest']), ('pungmu', ['bread oven']), ('moru', ['anvil']),
    ('sutdeomi', ['coal bin']), ('hwadeok', ['forge']), ('dameum', ['quench barrel']), ('sutdol', ['grindstone']), ('cheol', ['weapon barrel']),
    ('gongjang', ['work 2x1']), ('yakjang', ['apothecary drawers']), ('yakdang', ['cauldron']), ('yakyeon', ['mortar and pestle']),
    ('jakdu', ['chopping block']), ('yak_table', ['work 2x1', 'balance scale']), ('yakcho', ['basket:herb']), ('suldok', ['barrel']),
    ('sulsang', ['tea 2x1']), ('juga', ['counter 3x1', 'counter 2x1']), ('seoan', ['desk 1x1']), ('seoga', ['bookshelf 2w', 'bookshelf 1w']),
    ('boryo', ['runner']), ('ansuk', ['stool']), ('hoechori', ['pot']), ('chaekdemi', ['table:book+scroll']), ('gwan_desk', ['desk 3x2', 'desk 2x2']),
    ('gyoui', ['chair S', 'throne']), ('gonjang', ['bench 2']), ('buk', ['barrel']), ('mungseo', ['chest']),
]
FLAT = ('mat_', 'banseok', 'stair_down', 'stair_dais', 'exit_mat')           # 걷는 바닥 조각(F)
WALL_PFX = ('wall_', 'win_', 'door_slide', 'door_plank', 'door_open')
FRONT_ONLY = WALL_PFX + ('pillar', 'beam', 'dais', 'ladder', 'stair_up', 'byeongpung', 'jokja', 'hang_', 'mat_', 'exit_mat', 'stair_dais')


def short(name):
    return name[len(P):]


def refs_for(name):
    s = short(name)
    for pfx, ids in REFS:
        if s.startswith(pfx):
            return ['v5:' + i for i in ids]
    return ['v5:chest']


# 게이트 T(가는 줄 비율) 예외 — 본질이 1px 가는 줄인 조각만, 이유와 함께(그림을 굵히면 그 기물로 읽히지 않는다)
THIN = {
    'mulle': '물레 바퀴 살·테와 가락이 폭 1px(물레의 본질) — 2px 로 굵히면 바퀴가 접시로 읽힌다',
    'hang_meju': '메주를 매단 짚 끈이 폭 1px — 끈을 굵히면 메주가 벽에 붙은 판으로 읽힌다',
    'hang_gochu': '고추를 꿴 끈·꼭지가 폭 1px — 굵히면 고추 두름이 막대로 읽힌다',
    'hang_tools': '벽에 거는 연장의 자루·집게 날이 폭 1px — 굵히면 연장이 아니라 판자로 읽힌다',
    'hoechori': '회초리 묶음의 낱개가 폭 1px 가지 — 굵히면 다발이 덩어리로 읽힌다',
    'gonjang_teul': '곤장 틀의 결박 줄·기둥 끝이 폭 1px(경계 0.046 로 한계 0.045 바로 위)',
}


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


# 몸통이 바닥에 닿는 아랫줄 수(나머지 윗줄은 걸음★: 벽면에 걸치거나 사람 위에 그려지는 부분). 그림이 2줄 이상인 깔개·침구·상 따위는 전부 몸통.
FOOT = {
    'ibuljang': 1, 'nong_1': 1, 'nong_2': 1, 'byeongpung_a': 1, 'byeongpung_b': 1, 'byeongpung_c': 1, 'byeongpung_2': 1, 'byeongpung_royal': 1,
    'deungjan_stand': 1, 'bumak_2': 1, 'bumak_3': 1, 'ssal_dwiju': 1, 'dok_big': 1, 'seonban_2': 1, 'betul': 1, 'hwadeok_3': 1,
    'yakjang_2': 1, 'yakjang_1': 1, 'seoga_2': 1, 'seoga_1': 1, 'gyoui': 1, 'buk': 1,
}
ALL_BODY = ('ibul_r', 'ibul_b', 'pyeongsang', 'gwan_desk', 'gonjang_teul')


def walk_for(name):
    s = short(name)
    if s.startswith(WALL_PFX) or s.startswith(('pillar', 'dais')):
        return {'all': 'X'}
    if s.startswith('beam'):
        return {'all': 'C'}
    if s == 'stair_up_3':
        return {'grid': ['XXX', 'XXX', 'FFF']}
    if s == 'stair_up_2':
        return {'grid': ['XX', 'XX', 'FF']}
    if s == 'ladder_loft':
        return {'grid': ['X', 'X', 'F']}
    if s.startswith(FLAT):
        return {'all': 'F'}
    if s.startswith('pillar'):
        return {'all': 'X'}
    if s in FOOT:
        return {'foot': FOOT[s]}
    return {'all': 'X'}


def terrain_defs(terr_names):
    names = {'ondol': '온돌 장판', 'maru': '마루', 'dirt': '흙바닥', 'stone': '돌바닥'}
    out = {}
    for n in terr_names:
        s = short(n)
        if s == 'ceil47':
            out[n] = {'kind': 'blob47', 'name': '조선 실내 천장(벽 덩어리·어둠)', 'walk': False, 'role': 'terrain', 'connect': [n], 'edgeConnects': True}
        elif s.endswith('_sh'):
            out[n] = {'name': '조선 실내 ' + names[s[:-3]] + ' (벽 밑 그늘 변형: 위·왼쪽·위+왼쪽)', 'walk': True}
        else:
            out[n] = {'name': '조선 실내 ' + names[s], 'walk': True}
    return out


def build(objs, terr):
    """objs: {이름: Cv}. foot 은 여기서 격자 문자열로 풀어 쓴다(변환기 overrides 는 grid/all/passage/rect/set 만 안다)."""
    ins = [n for n in objs if n.startswith(P)]
    meta = {n: meta_for(n) for n in ins}
    walk = {}
    for n in ins:
        w = walk_for(n)
        if 'foot' in w:
            cv = objs[n]
            h, ww = cv.h // 16, cv.w // 16
            f = w['foot']
            w = {'grid': [('C' if r < h - f else 'X') * ww for r in range(h)]}
        walk[n] = w
    return meta, walk, terrain_defs([t for t in terr if t.startswith(P)])


def main():
    import catalog
    objs, terr = catalog.objects(), catalog.terrain()
    meta, walk, tdef = build(objs, terr)
    pm = json.load(open(META_P))
    pm.update(meta)
    json.dump(pm, open(META_P, 'w'), ensure_ascii=False, indent=1)
    ov = json.load(open(WALK_P))
    ov['pieces'].update(walk)
    ov['terrain'].update(tdef)
    json.dump(ov, open(WALK_P, 'w'), ensure_ascii=False, indent=1)
    print('in_b_ 조각 메타·통행', len(meta), '개, 지형', len(tdef), '묶음')


if __name__ == '__main__':
    main()
