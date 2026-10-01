"""조각 목록(지형·물체). demo.py 와 harness/gate.py 가 같은 목록을 쓴다."""
import ground as G, build as B, props as P, blocks as K, props2 as Q
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
        'pine': Q.pine(),
        'persimmon': Q.persimmon(),
        'willow': Q.willow(),
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
