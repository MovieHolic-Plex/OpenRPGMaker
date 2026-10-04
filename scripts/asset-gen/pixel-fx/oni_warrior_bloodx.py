"""oni_warrior_bloodx: 피갈이 X참. 두 획이 차례로 X 를 새기고 번쩍인 뒤, 획이 핏빛으로 식으며 방울이 흘러내린다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'oni_warrior_bloodx', 64, 10, 'target'
PAL = pal(ONI, pick(BLOOD, 'b1', 'b2', 'b4'), pick(BLADE, 'k3'))
S1, S2 = ((54, 8), (10, 56)), ((10, 8), (54, 56))


def draw(c, f):
    if f == 9:
        c.ddisc(32, 32, 10, 'b1')
    if f <= 2:
        c.blade(*S1, 5, 5, ['o1', 'o2', 'o3', 'k3'], [0.4, 0.8, 1.0][f])
    elif f <= 8:
        c.blade(*S1, 5, max(2, 5 - (f - 3) // 2), ['b1', 'b2'] if f > 5 else ['o1', 'o2', 'o3'], 1.0)
    if 3 <= f <= 5:
        c.blade(*S2, -5, 5, ['o1', 'o2', 'o3', 'k3'], [0.4, 0.8, 1.0][f - 3])
    elif 6 <= f <= 8:
        c.blade(*S2, -5, max(2, 4 - (f - 6)), ['b1', 'b2'], 1.0)
    if f in (5, 6):
        c.spark(32, 32, 13 if f == 5 else 8, 'k3', 'b4', diag=True)
    if f >= 6:
        for i, (x, y) in enumerate([(22, 20), (40, 20), (24, 42), (42, 44), (32, 32), (16, 48)]):
            drip(c, x, y, (f - 5) * 2 + i % 3, ['b2', 'b4'])


if __name__ == '__main__':
    run(globals())

