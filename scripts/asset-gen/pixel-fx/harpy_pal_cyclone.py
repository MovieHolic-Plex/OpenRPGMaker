"""harpy_pal_cyclone: 회오리 날갯짓. 위가 넓은 회오리 깔때기가 적을 휘감고 깃털과 흰 바람 줄기가 함께 돈다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'harpy_pal_cyclone', 64, 10, 'allTargets'
PAL = pal(pick(AIR, 'a0', 'a1', 'a2', 'a3'), pick(LEAFG, 'g1', 'g2', 'g3'), pick(DOWN, 'f1', 'f2', 'f3'))


def draw(c, f):
    cx = 32
    grow = ease(min(1.0, (f + 1) / 5))
    shrink = 1.0 if f < 8 else (10 - f) / 3
    top, bot = 4, 56
    steps = 9
    for i in range(steps):
        u = i / (steps - 1)
        y = lerp(top, bot, u)
        rx = lerp(26, 6, u) * grow * shrink
        ph = f * 0.55 + i * 0.75
        x = cx + math.sin(ph) * 3
        k = 'a1' if i % 3 == 0 else ('a2' if i % 3 == 1 else 'a3')
        # 두 겹 타원(뒤쪽 반이 어둡다)
        c.arc(x, y, rx, 0, 180, 'a0', 2, 0.22)
        c.arc(x, y, rx, 180, 360, k, 1, 0.22)
    r = rng(12)
    for j in range(7):
        u = (j / 7 + f * 0.09) % 1.0
        y = lerp(top + 4, bot - 4, u)
        rx = lerp(24, 5, u) * grow * shrink
        a = f * 0.8 + j * 2.4
        x = cx + math.cos(a) * rx
        yy = y + math.sin(a) * rx * 0.22
        if math.sin(a) > -0.2:
            col = ('g2', 'g3', 'g1') if j % 2 else ('f2', 'f1', 'f1')
            feather(c, x, yy, a + math.pi / 2, 9, *col)
    c.spark(cx + math.sin(f) * 3, bot - 1, 3, 'a3', 'a2')
    for k in range(3):
        c.line([(2 + k * 28, 10 + (f * 4 + k * 9) % 40), (10 + k * 28, 10 + (f * 4 + k * 9) % 40)], 'a1')


if __name__ == '__main__':
    run(globals())
