"""gargoyle_pal_tail: 꼬리 후려치기. 돌 꼬리가 낮게 호를 그리며 쓸고 지나가 먼지 띠와 튀는 돌조각을 남긴다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'gargoyle_pal_tail', 64, 8, 'target'
PAL = pal(STONE, pick(SAND, 'n1', 'n2', 'n3'), pick(GOLD, 'y3'))


def draw(c, f):
    cx, cy = 32, 40
    if f == 0:
        c.spark(58, 30, 5, 'y3', 's4')
        c.poly([(64, 26), (56, 30), (64, 34)], 's2')
        c.line([(64, 26), (56, 30), (64, 34)], 's4')
    if 1 <= f <= 4:
        fr = min(1.0, f / 3)
        c.blade((64, 30), (4, 50), -12, 13, ['s0', 's1', 's2', 's3'], fr)
        # 꼬리 끝 촉
        t = fr
        tx, ty = lerp(64, 4, t), lerp(30, 50, t) + math.sin(t * math.pi) * 10
        if f <= 3:
            c.poly([(tx + 3, ty - 4), (tx - 5, ty), (tx + 3, ty + 4), (tx + 1, ty)], 's3')
            c.line([(tx + 3, ty - 4), (tx - 5, ty), (tx + 3, ty + 4)], 's4')
    if f >= 2:
        for k in range(4):
            dust(c, 56 - k * 14 - (f - 2) * 3, 55 - (k % 2), 7 + (f - 2), 3 + k, ['n1', 'n2', 'n3'], fade=f >= 6)
    if 2 <= f <= 4:
        c.spark(cx - 4, cy - 2, 7 - (f - 2) * 2, 'y3', 's4', diag=True)
    if f >= 3:
        r = rng(6)
        for k in range(8):
            a = r.uniform(3.4, 6.0)
            d = r.uniform(6, 24) * ease((f - 2) / 5)
            rock(c, cx + math.cos(a) * d, 48 + math.sin(a) * d * 0.9 + (f - 3) ** 2 * 0.7, 1.8, ['s0', 's2', 's3'], k, 5)


if __name__ == '__main__':
    run(globals())
