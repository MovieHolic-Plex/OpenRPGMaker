"""harpy_pal_veil: 바람 장막. 깃털이 세 겹 타원 궤도로 몸을 돌며 회오리 고치를 짓고, 마지막에 반짝이며 흩어진다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'harpy_pal_veil', 64, 10, 'user'
PAL = pal(pick(AIR, 'a0', 'a1', 'a2', 'a3'), pick(LEAFG, 'g1', 'g2', 'g3'), pick(DOWN, 'f1', 'f2', 'f3'))


def draw(c, f):
    cx, cy = 32, 34
    grow = ease(min(1.0, f / 4))
    fade = 1.0 if f < 8 else 0.0
    rx = 16 * grow
    for layer, (dy, sq) in enumerate(((-16, 0.28), (-2, 0.3), (12, 0.28))):
        a_ph = f * 0.7 * (1 if layer % 2 == 0 else -1) + layer
        # 뒤쪽 반은 어둡게 먼저
        for side in (0, 1):
            for k in range(3):
                a = a_ph + k * 2.09
                s = math.sin(a)
                front = s > 0
                if front != bool(side):
                    continue
                x = cx + math.cos(a) * rx
                y = cy + dy + s * rx * sq
                if fade or f % 2:
                    col = ('g2', 'g3', 'g1') if (k + layer) % 2 else ('f2', 'f1', 'f1')
                    if not front:
                        col = ('g1', 'g1', 'g1') if col[0] == 'g2' else ('f1', 'f1', 'f1')
                    feather(c, x, y, a + math.pi / 2, 10 if front else 8, *col)
    if f in (1, 2, 3, 4):
        c.ring(cx, cy + 6, rx + 2, 'a2', 1, 0.3)
    for k in range(2):
        c.line([(cx - rx - 2, 8 + k * 24 + (f * 3) % 8), (cx - rx + 8, 6 + k * 24 + (f * 3) % 8)], 'a1')
    if f >= 8:
        spark_burst(c, cx, cy, (f - 8) / 2, 12, 4, ['a3', 'a2', 'f3'], spd=(8, 20))
    c.px(cx, cy - 26 + (f % 3) * 2, 'a3')


if __name__ == '__main__':
    run(globals())
