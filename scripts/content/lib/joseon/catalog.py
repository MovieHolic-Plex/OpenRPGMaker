"""조각 목록(지형·물체). demo.py 와 harness/gate.py 가 같은 목록을 쓴다."""
import ground as G, build as B, props as P, blocks as K, props2 as Q, trees as TR, props3 as P3
_L = None


def lib():
    global _L
    if _L is None:
        _L = K.library()
    return _L



def terrain():
    return {
        'grass': [G.grass(v) for v in range(4)],
        'yard': [G.yard(v) for v in range(2)],
        'paving': [G.paving(v) for v in range(2)],
        'field': [G.field(v) for v in range(2)],
        'road16': [G.road(m) for m in range(16)],
        'yard16': [G.yard_edge(m) for m in range(16)],
        'stream16': [G.stream(m) for m in range(16)],
        'paddy16': [G.paddy_edge(m) for m in range(16)],
    }


def objects():
    return {
        'giwa_house_6': K.assemble(K.house('jo', 6, 'lwddwr', 'lfddfr', steps=(2, 3), hip=True), lib(), post=lambda cv: (K.hip_cut(cv, 0, 3, 'jo'), K.upturn(cv, 48))),
        'thatch_house_5': K.assemble(K.house('jc', 5, 'lwdwr', 'lfdfr', steps=(2,), hip=True, chimi=False), lib(), post=lambda cv: (K.hip_cut(cv, 0, 3, 'jc', wg=24), K.upturn(cv, 48, 8, 3))),
        'gate_4': K.assemble(K.house('jo', 4, 'lggr', 'lggr', rows=3, dan=False, steps=(1, 2), chimi=False, hip=True), lib(), post=lambda cv: (K.hip_cut(cv, 0, 3, 'jo', wg=20), K.upturn(cv, 48, 10, 3))),
        'pavilion_5': K.assemble(K.house('pv', 5, 'ooooo', 'kkkkk', rows=3, dan=False, steps=(2,), hip=True), lib(), post=lambda cv: (K.hip_cut(cv, 0, 3, 'pv'), K.upturn(cv, 48))),
        'thatch_house_4': K.assemble(K.house('jc', 4, 'lwdr', 'lfdr', steps=(2,), hip=True, chimi=False), lib(), post=lambda cv: (K.hip_cut(cv, 0, 3, 'jc', wg=24), K.upturn(cv, 48, 8, 3))),
        'giwa_house_5': K.assemble(K.house('jo', 5, 'lwdwr', 'lfdfr', steps=(2,), hip=True), lib(), post=lambda cv: (K.hip_cut(cv, 0, 3, 'jo'), K.upturn(cv, 48))),
        'zelkova_a': TR.zelkova(0),
        'zelkova_b': TR.zelkova(1, 1),
        'zelkova_c': TR.zelkova(2, -1),
        'pine_a': TR.pine(0),
        'pine_b': TR.pine(1, 1),
        'persimmon_a': TR.persimmon_tree(0),
        'persimmon_b': TR.persimmon_tree(1, 0),
        'willow': TR.willow(0),
        'bamboo': TR.bamboo(0),
        'bush_a': TR.bush('a', 0),
        'bush_b': TR.bush('b', 1),
        'bush_c': TR.bush('c', 2),
        'small_z_a': TR.small_tree('z', 0),
        'small_z_b': TR.small_tree('z', 1),
        'small_p': TR.small_tree('p', 0),
        'stone_bank': P3.stone_bank(),
        'reeds': P3.reeds(),
        'rocks': P3.rocks(),
        'fence_h': P3.fence_h(),
        'haystack': P3.haystack(),
        'well': Q.well(),
        'bridge': Q.bridge(),
        'jars': Q.jars(),
        'bench': Q.bench(),
        'mat_peppers': Q.mat_peppers(),
        'jangseung_m': Q.jangseung(False),
        'jangseung_f': Q.jangseung(True),
        'sotdae': Q.sotdae(),
        'lantern': Q.lantern(),
        'wall_h': Q.wall_h(),
        'wall_v': Q.wall_v(),
        'wall_corner_l': Q.wall_corner('L'),
        'wall_corner_r': Q.wall_corner('R'),
    }
