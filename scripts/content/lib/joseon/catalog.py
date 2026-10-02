"""조각 목록(지형·물체). demo.py 와 harness/gate.py 가 같은 목록을 쓴다."""
import props5 as P5, structs as ST, ground as G, build as B, props as P, blocks as K, props2 as Q, trees as TR, props3 as P3, props4 as P4
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
        'giwa_house_6': K.assemble(K.house('jo', 6, 'lwddwr', 'lfddfr', steps=(2, 3), hip=True), lib(), post=lambda cv: K.roof_baram(cv, 3, 'giwa', wing=24)),
        'thatch_house_5': K.assemble(K.house('jc', 5, 'lwdwr', 'lfdfr', steps=(2,), hip=True, chimi=False), lib(), post=lambda cv: K.thatch_baram(cv, 3)),
        'gate_4': K.assemble(K.house('jo', 4, 'lggr', 'lggr', rows=3, dan=False, steps=(1, 2), chimi=False, hip=True), lib(), post=lambda cv: K.roof_baram(cv, 3, 'giwa', wing=22)),
        'pavilion_5': K.assemble(K.house('pv', 5, 'ooooo', 'kkkkk', rows=3, dan=False, steps=(2,), hip=True), lib(), post=lambda cv: (K.roof_baram(cv, 3, 'dg', wing=24), K.pavilion_open(cv, 5))),
        'thatch_house_4': K.assemble(K.house('jc', 4, 'lwdr', 'lfdr', steps=(2,), hip=True, chimi=False), lib(), post=lambda cv: K.thatch_baram(cv, 3)),
        'giwa_house_5': K.assemble(K.house('jo', 5, 'lwdwr', 'lfdfr', steps=(2,), hip=True), lib(), post=lambda cv: K.roof_baram(cv, 3, 'giwa', wing=24)),
        'zelkova_a': TR.zelkova(0),
        'zelkova_b': TR.zelkova(1, 1),
        'zelkova_c': TR.zelkova(2, -1),
        'zelkova_d': TR.zelkova(3, 0),
        'zelkova_e': TR.zelkova(4, 1),
        'pine_c': TR.pine(2, 0),
        'pine_d': TR.pine(3, 1),
        'persimmon_c': TR.persimmon_tree(2, 0),
        'pine_a': TR.pine(0),
        'pine_b': TR.pine(1, 1),
        'persimmon_a': TR.persimmon_tree(0),
        'persimmon_b': TR.persimmon_tree(1, 0),
        'willow': TR.willow(0),
        'bamboo': TR.bamboo(0),
        'bush_l_a': TR.bush_size('l', 0),
        'bush_l_b': TR.bush_size('l', 1),
        'bush_s_a': TR.bush_size('s', 0),
        'bush_s_b': TR.bush_size('s', 1),
        'bamboo_grove': TR.bamboo_grove(0),
        'bush_a': TR.bush('a', 0),
        'bush_b': TR.bush('b', 6),
        'bush_c': TR.bush('c', 0),
        'giwa_house_5b': K.assemble(K.house('jo', 5, 'lwdwr', 'lfdfr', steps=(2,), hip=True), lib(), post=lambda cv: K.roof_baram(cv, 3, 'brown', wing=24)),
        'thatch_house_3': K.assemble(K.house('jc', 3, 'ldr', 'ldr', steps=(1,), hip=True, chimi=False), lib(), post=lambda cv: K.thatch_baram(cv, 3)),
        'thatch_house_3b': K.assemble(K.house('jc', 3, 'lgr', 'lgr', steps=(1,), hip=True, chimi=False), lib(), post=lambda cv: K.thatch_baram(cv, 3)),
        'thatch_porch_5': K.assemble(K.house('jc', 5, 'lwoor', 'lfoor', steps=(2,), hip=True, chimi=False), lib(), post=lambda cv: K.thatch_baram(cv, 3)),
        'thatch_porch_4': K.assemble(K.house('jc', 4, 'lwor', 'lfor', steps=(2,), hip=True, chimi=False), lib(), post=lambda cv: K.thatch_baram(cv, 3)),
        'giwa_house_4': K.assemble(K.house('jo', 4, 'lwdr', 'lfdr', steps=(2,), hip=True), lib(), post=lambda cv: K.roof_baram(cv, 3, 'giwa', wing=22)),
        'giwa_house_3': K.assemble(K.house('jo', 3, 'ldr', 'ldr', steps=(1,), hip=True), lib(), post=lambda cv: K.roof_baram(cv, 3, 'giwa', wing=20)),
        'gwanah_7': K.assemble(K.house('gw', 7, 'lwdddwr', 'lfdddfr', steps=(3,), hip=True, chimi=False, dan=True), lib(), post=lambda cv: K.roof_baram(cv, 3, 'giwa', wing=26, trim=True)),
        'gwanah_5': K.assemble(K.house('gw', 5, 'lwdwr', 'lfdfr', steps=(2,), hip=True, chimi=False, dan=True), lib(), post=lambda cv: K.roof_baram(cv, 3, 'giwa', wing=24, trim=True)),
        'gwanah_5b': K.assemble(K.house('gw', 5, 'lwdwr', 'lfdfr', steps=(2,), hip=True, chimi=False, dan=True), lib(), post=lambda cv: K.roof_baram(cv, 3, 'giwa', wing=24, trim=True)),
        'fort_gate': ST.fort_gate(),
        'fort_wall_h': ST.fort_wall_h(0),
        'fort_wall_h1': ST.fort_wall_h(1),
        'fort_wall_h2': ST.fort_wall_h(2),
        'fort_wall_end_l': ST.fort_wall_end('l'),
        'fort_wall_end_r': ST.fort_wall_end('r'),
        'stone_pagoda': ST.stone_pagoda(),
        'hongsalmun': ST.hongsalmun(),
        'deungrong_mun': ST.deungrong_mun(),
        'market_stall': ST.market_stall(),
        'market_stall_thatch': ST.market_stall(True),
        'wondumak': ST.wondumak(),
        'nugak': ST.nugak(),
        'laundry': P4.laundry(),
        'flower_bed': P5.flower_bed(),
        'bank_stairs': P5.bank_stairs(),
        'small_z_a': TR.small_tree('z', 0),
        'small_z_b': TR.small_tree('z', 1),
        'small_p': TR.small_tree('p', 0),
        'stone_bank': P5.stone_bank(),
        'reeds': P3.reeds(),
        'rocks': P3.rocks(),
        'fence_h': P5.fence_h(),
        'haystack': P5.haystack(),
        'well': P5.well(),
        'bridge': P5.bridge(),
        'jars': P5.jars(),
        'bench': P5.bench(),
        'mat_peppers': P5.mat_peppers(),
        'jangseung_m': P4.jangseung(False),
        'jangseung_f': P4.jangseung(True),
        'sotdae': P4.sotdae(),
        'lantern': P4.lantern(),
        'wall_h': P5.wall_h2(0),
        'wall_h1': P5.wall_h2(1),
        'wall_h2': P5.wall_h2(2),
        'wall_v': P5.wall_v2(),
        'wall_corner_nw': P5.wall_corner4('NW'),
        'wall_corner_ne': P5.wall_corner4('NE'),
        'wall_corner_sw': P5.wall_corner4('SW'),
        'wall_corner_se': P5.wall_corner4('SE'),
    }
