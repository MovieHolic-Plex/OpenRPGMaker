"""vampire_claws: 핏빛 손톱. 손톱 네 줄이 엇갈려 사선으로 세 번 그어지고 핏방울이 튄다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'vampire_claws', 64, 8, 'target'
PAL = pal(BLOOD, pick(BONEW, 'w2'), pick(NIGHTV, 'n2'))


def draw(c, f):
    cx, cy = 32, 34
    if f == 0:
        for k in range(4):
            c.line([(50 + k * 2, 8 + k * 3), (56 + k * 2, 14 + k * 3)], 'b3')
        c.spark(52, 10, 4, 'b4', 'b3')
    plan = [(-32, 1), (34, 2), (-8, 3)]
    for ang, st in plan:
        if not (st <= f <= st + 2):
            continue
        fr = min(1.0, (f - st + 1) / 2)
        claw_slashes(c, cx, cy, math.radians(ang + 90), 4, 44, 5.5, 4, ['b1', 'b3', 'b4', 'w2'], fr, bulge=4 if ang > 0 else -4)
        if f == st:
            c.spark(cx + math.cos(math.radians(ang + 90)) * 20, cy + math.sin(math.radians(ang + 90)) * 20, 5, 'b4', 'b3')
    if f >= 2:
        spark_burst(c, cx, cy, (f - 2) / 5, 14, 5, ['b4', 'b3', 'b2', 'b1'], spd=(8, 26), grav=0.9, size=(1, 2))
    if f >= 4:
        for k in range(3):
            drip(c, 16 + k * 16, 22 + (k % 2) * 6, 2 + (f - 4) * 2, ('b3', 'b4'))
    if f == 6:
        c.spark(cx, cy, 4, 'w2', 'b4')


if __name__ == '__main__':
    run(globals())
