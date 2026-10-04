"""dragonewt_tailspin: 꼬리 회전. 초록 꼬리가 낮은 타원 궤도로 한 바퀴 휘돌아 먼지 고리를 일으키고 끝의 가시가 번뜩인다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'dragonewt_tailspin', 64, 8, 'allTargets'
PAL = pal(DRAKE, pick(DOWN, 'f1', 'f2', 'f3'), pick(SAND, 'n1', 'n2', 'n3'), pick(LEAFG, 'g3'))


def draw(c, f):
    cx, cy = 32, 46
    R = 24
    a_end = -0.6 + f * 0.9
    steps = 16
    pts = []
    for i in range(steps + 1):
        u = i / steps
        a = a_end - u * 2.6
        pts.append(pol(cx, cy, R * (0.6 + 0.4 * (1 - u * 0.3)), a, 0.32))
    # 뒷면(어두움)과 앞면
    c.line(pts, 'r0', 7)
    c.line(pts, 'r1', 5)
    c.line(pts, 'r2', 2)
    tip = pts[0]
    c.poly([(tip[0], tip[1] - 5), (tip[0] + 5, tip[1]), (tip[0], tip[1] + 5), (tip[0] - 3, tip[1])], 'f2')
    c.line([(tip[0], tip[1] - 5), (tip[0] + 5, tip[1]), (tip[0], tip[1] + 5)], 'f3')
    c.ring(cx, cy + 6, R + 4, 'n3', 1, 0.28)
    c.ring(cx, cy + 6, R - 2, 'n2', 1, 0.24)
    for i in range(5):
        dust(c, cx + math.cos(f * 0.9 + i * 1.25) * (R + 2), cy + 6 + math.sin(f * 0.9 + i * 1.25) * 7, 6, 3 + i, ['n1', 'n2', 'n3'], fade=True)
    if f in (2, 3):
        c.spark(tip[0], tip[1], 6, 'f3', 'g3', diag=True)


if __name__ == '__main__':
    run(globals())
