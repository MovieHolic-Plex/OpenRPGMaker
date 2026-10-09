"""demon_knight_release_hit: 마검 해방 명중. 붉은 X 절단선이 폭발하며 검은 불꽃 방사와 금빛 불씨가 터진다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'demon_knight_release_hit', 64, 10, 'target'
PAL = pal(DEMON, pick(BLADE, 'k3'), pick(GOLD, 'y2', 'y3'), pick(DARKV, 'u1', 'u2'))


def draw(c, f):
    cx, cy = 32, 34
    if f <= 3:
        fr = min(1.0, (f + 1) / 2.5)
        for sg in (1, -1):
            a = math.radians(45 * sg)
            c.blade((cx - math.cos(a) * 30, cy - math.sin(a) * 30), (cx + math.cos(a) * 30, cy + math.sin(a) * 30), 3 * sg, 12, ['d1', 'd3', 'd4', 'k3'], fr)
    if 2 <= f <= 6:
        r0 = (f - 2) * 7
        c.ring(cx, cy, 4 + r0, 'd3', 2, 0.85)
        c.ring(cx, cy, 2 + r0, 'd4', 1, 0.85)
    if f in (2, 3):
        c.spark(cx, cy, 16 - (f - 2) * 4, 'y3', 'd4', diag=True)
    if f >= 3:
        for i in range(10):
            a = i * 2 * math.pi / 10 + 0.2
            L = (10 + (i % 3) * 5) * ease(min(1, (f - 2) / 4))
            x, y = pol(cx, cy, L, a, 0.85)
            flame(c, x, y + 4, 4, 8 - (f - 3) * 0.8, ['u1', 'd1', 'd2', 'd3'], seed=i, tongues=1) if f < 8 else c.px(x, y, 'u2')
    spark_burst(c, cx, cy, f / 9, 18, 5, ['y3', 'd4', 'd3', 'd2'], spd=(10, 30), size=(1, 2.2))
    if f >= 8:
        for k in range(5):
            rr = rng(20 + k + f)
            c.spark(cx + rr.uniform(-18, 18), cy + rr.uniform(-16, 14), 2 - (f - 8), 'y3', 'd4')
        c.line([(cx - 14 + (f - 8) * 6, cy + 10), (cx + 4 + (f - 8) * 6, cy + 12)], 'd2')


if __name__ == '__main__':
    run(globals())
