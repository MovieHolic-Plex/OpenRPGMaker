"""oni_warrior_twinslash: 쌍도 연참. 붉은 칼과 강철 칼이 번갈아 세 번 초승달을 긋고 금빛 불똥이 터진다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'oni_warrior_twinslash', 64, 8, 'target'
PAL = pal(ONI, pick(BLADE, 'k1', 'k2', 'k3'), pick(GOLD, 'y2', 'y3'))
STROKES = [((52, 10), (12, 52), 8, ['o1', 'o2', 'o3', 'k3']),
           ((12, 12), (52, 50), -8, ['k1', 'k2', 'k3', 'y3']),
           ((56, 28), (8, 38), 6, ['o1', 'o2', 'o3', 'y3'])]


def draw(c, f):
    for i, (p0, p1, b, keys) in enumerate(STROKES):
        age = f - i * 2
        if age < 0 or age > 3:
            continue
        if age == 0:
            c.blade(p0, p1, b, 5, keys, 0.55)
        elif age == 1:
            c.blade(p0, p1, b, 6, keys, 1.0)
            c.spark((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, 7, 'y3', 'y2', diag=True)
        else:
            c.blade(p0, p1, b, 5 - age, keys[:4 - age], 1.0)
    if f >= 5:
        spark_burst(c, 32, 32, (f - 4) / 4, 12, 7, ['y3', 'y2', 'o3', 'o2'], spd=(6, 24))


if __name__ == '__main__':
    run(globals())

