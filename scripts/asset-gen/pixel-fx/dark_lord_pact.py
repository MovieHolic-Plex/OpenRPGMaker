"""dark_lord_pact: 피의 계약. 적 가슴에 붉은 역오각 문양이 한 획씩 그어지고, 생기 방울이 오른쪽 위(시전자 쪽)로 빨려 나간다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'dark_lord_pact', 64, 10, 'target'
PAL = pal(pick(DARKV, 'u1', 'u2', 'u3'), HELL, pick(BLOOD, 'b1', 'b2', 'b3'))


def draw(c, f):
    cx, cy = CX, CY - 2
    R = 17
    pts = [pol(cx, cy, R, math.pi / 2 + i * 2 * math.pi / 5) for i in range(5)]
    order = [pts[(i * 2) % 5] for i in range(6)]
    c.ring(cx, cy, R + 3, 'u2' if f < 7 else 'u1', 1)
    if f >= 1:
        c.ring(cx, cy, R + 1, 'b1', 1)
    strokes = min(5, max(0, f))
    for i in range(strokes):
        c.line([order[i], order[i + 1]], 'z1', 2)
        c.line([order[i], order[i + 1]], 'z2' if f < 8 else 'b2', 1)
    if 1 <= f <= 5:
        c.spark(*order[strokes], 4, 'z3', 'z2')
    if f >= 5:
        c.disc(cx, cy, 3 + (f % 2), 'b2')
        c.px(cx, cy, 'z3')
        for i in range(6):
            t = ((f - 5) / 4 + i / 6) % 1.0
            p = bezier((cx, cy), (cx + 6 - i * 3, cy - 24), (66, 2), t)
            c.disc(p[0], p[1], 1.5 if i % 2 else 1, 'b3' if i % 2 else 'z3')
    if f >= 8:
        c.dring(cx, cy, R + 5 + (f - 8) * 3, 'u3', parity=f % 2)


if __name__ == '__main__':
    run(globals())

