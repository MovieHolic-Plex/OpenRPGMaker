"""golem_pal_avalanche: 산사태(필살 배경, 화면 128). 능선 위에서 바윗덩이와 흙더미가 쏟아져 화면 가득 굴러 내리고 먼지벽이 밀려온다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'golem_pal_avalanche', 128, 12, 'screen'
PAL = pal(CLAY, pick(GOLD, 'y3'))
OVAL = 0.42


def draw(c, f):
    # 능선(위쪽 오른쪽이 높다)
    for x in range(0, 128, 2):
        y = 10 + (128 - x) * 0.12 + math.sin(x * 0.11) * 4
        c.line([(x, y), (x, y + 6)], 'c1', 2)
        c.px(x, y, 'c3')
    # 굴러 내리는 바위들
    r = rng(8)
    for i in range(16):
        ph = r.uniform(0, 1)
        sp = 0.06 + r.uniform(0, 0.05)
        t = (f * sp * 1.6 + ph) % 1.0
        x = lerp(120 - r.uniform(0, 30), 14 + r.uniform(0, 60), t)
        y = lerp(18, 108, t * t * 0.4 + t * 0.6)
        rad = 4 + (i % 4) * 2.4
        rock(c, x, y, rad, ['c0', 'c2', 'c3', 'c4'], i, 8)
        if t < 0.9:
            for k in range(1, 3):
                c.line([(x + rad + k * 4, y - k * 3), (x + rad + k * 4 + 3, y - k * 3 - 1)], 'c2')
    # 먼지벽
    for i in range(9):
        y = 52 + (i % 3) * 18
        x = 128 - ((f + 1) * 12 + i * 20) % 170
        dust(c, x, y + 6, 15 + (i % 3) * 3, 40 + i, ['c1', 'c2', 'c3', 'c4'], fade=f >= 9)
    if f in (3, 4):
        c.spark(64, 64, 22 - (f - 3) * 6, 'y3', 'c4', diag=True)
    for k in range(18):
        rr = rng(70 + k)
        c.px(rr.uniform(4, 124), (f * 9 + rr.uniform(0, 100)) % 110 + 8, 'c3')
    if f >= 6:
        for x in range(0, 128, 4):
            c.line([(x, 122), (x + 3, 118 + (x * 3 + f) % 4)], 'c1')


if __name__ == '__main__':
    run(globals())
