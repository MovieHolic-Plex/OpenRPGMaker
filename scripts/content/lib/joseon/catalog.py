"""조각 목록(지형·물체). demo.py 와 harness/gate.py 가 같은 목록을 쓴다."""
import ground as G, build as B, props as P


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
        'giwa_house_7': B.giwa_house(7),
        'thatch_house': P.thatch_house(),
        'gate_6': P.gate(6),
        'pavilion': P.pavilion(),
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
