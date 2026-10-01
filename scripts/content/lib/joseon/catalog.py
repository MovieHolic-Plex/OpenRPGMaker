"""조각 목록(지형·물체). demo.py 와 harness/gate.py 가 같은 목록을 쓴다."""
import ground as G, build as B, props as P, blocks as K
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
        'giwa_house_6': K.assemble(K.house('jo', 6, 'lwddwr', 'lfddfr', steps=(2, 3), hip=True), lib(), post=lambda cv: K.hip_cut(cv, 0, 3, 'jo')),
        'thatch_house_5': K.assemble(K.house('jc', 5, 'lwdwr', 'lfdfr', steps=(2,), hip=True, chimi=False), lib(), post=lambda cv: K.hip_cut(cv, 0, 3, 'jc')),
        'gate_4': K.assemble(K.house('jo', 4, 'lggr', 'lggr', rows=3, dan=True, steps=(1, 2)), lib()),
        'pavilion_5': K.assemble(K.house('pv', 5, 'ooooo', 'kkkkk', rows=3, dan=True, steps=(2,), hip=True), lib(), post=lambda cv: K.hip_cut(cv, 0, 3, 'pv')),
        'pine': P.pine(),
        'persimmon': P.persimmon(),
        'willow': P.willow(),
        'well': P.well(),
        'bridge': P.bridge(),
        'jars': P.jars(),
        'bench': P.bench(),
        'mat_peppers': P.mat_peppers(),
        'jangseung_m': P.jangseung(False),
        'jangseung_f': P.jangseung(True),
        'sotdae': P.sotdae(),
        'lantern': P.lantern(),
        'wall_h': P.wall_h(),
        'wall_v': P.wall_v(),
        'wall_corner_l': P.wall_corner('L'),
        'wall_corner_r': P.wall_corner('R'),
    }
