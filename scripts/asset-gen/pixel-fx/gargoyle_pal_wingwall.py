"""gargoyle_pal_wingwall: 돌 날개 방벽. 아군 양옆에서 돌 박쥐 날개가 솟아 펼쳐지고 방벽 고리가 파문처럼 퍼진다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'gargoyle_pal_wingwall', 64, 10, 'allAllies'
PAL = pal(STONE, pick(GOLD, 'y2', 'y3'))


def wing(c, x, y, span, hgt, flip, k):
    """뼈대 세 줄과 막이 있는 돌 박쥐 날개. (x, y)는 어깨쪽 뿌리."""
    s = -1 if flip else 1
    tips = [(x + s * span, y - hgt), (x + s * span * 0.95, y - hgt * 0.15), (x + s * span * 0.62, y + hgt * 0.4)]
    pts = [(x, y), (x + s * span * 0.35, y - hgt * 0.72), tips[0], (x + s * span * 0.82, y - hgt * 0.5), tips[1],
           (x + s * span * 0.7, y + hgt * 0.05), tips[2], (x + s * span * 0.3, y + hgt * 0.32)]
    c.poly(pts, k[0])
    inner = [(x + s * 1, y - 1)] + [(px - s * 0 + (x - px) * 0.14, py + (y - py) * 0.14) for px, py in pts[1:]]
    c.poly(inner, k[1])
    for t in tips:
        c.line([(x, y), t], k[2])
    c.line([(x, y), (x + s * span * 0.35, y - hgt * 0.72), tips[0]], k[3], 2)


def draw(c, f):
    cx = 32
    g = ease(min(1.0, (f + 0.5) / 5))
    span, hgt = 22 * g, 30 * g
    fade = f >= 8
    if g > 0.1:
        for flip in (False, True):
            wing(c, cx + (5 if not flip else -5), 46, span, hgt, flip, ['s0', 's1', 's3', 's4'] if not fade else ['s0', 's1', 's2', 's3'])
    if f >= 3:
        r = 8 + (f - 3) * 3
        c.arc(cx, 36, r + 8, 200, 340, 'y2', 1, 1.3)
        if f % 2:
            c.arc(cx, 36, r + 3, 205, 335, 'y3', 1, 1.3)
    if f in (3, 4):
        c.spark(cx, 30, 6 - (f - 3) * 2, 'y3', 'y2', diag=True)
    for k in range(4):
        r = rng(7 + k)
        c.px(cx + r.uniform(-24, 24), 56 - (f * 2 + k * 5) % 14, 's3')
    if f >= 8:
        spark_burst(c, cx, 36, (f - 8) / 2, 10, 3, ['s4', 's3', 'y3'], spd=(10, 24))


if __name__ == '__main__':
    run(globals())
