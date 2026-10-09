"""dragonewt_wingcrash: 날개 급습. 펼친 초록 날개 그림자가 위에서 덮쳐 내리는 U자 궤적을 그리며 충격 파문과 바람 줄이 터진다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'dragonewt_wingcrash', 64, 8, 'target'
PAL = pal(DRAKE, pick(AIR, 'a1', 'a2', 'a3'), pick(DOWN, 'f1', 'f2', 'f3'), pick(GOLD, 'y3'))


def draw(c, f):
    cx, cy = 32, 36
    if f <= 3:
        t = (f + 1) / 4
        # 양날개가 위에서 벌어진 채 내려온다
        for s in (-1, 1):
            base = (cx + s * 2, lerp(0, 32, t * t))
            tip = (cx + s * (10 + t * 22), base[1] - 10 + t * 12)
            m = (cx + s * (5 + t * 14), base[1] + 6)
            c.poly([base, (tip[0], tip[1]), (cx + s * (12 + t * 26), base[1] + 10), m, (cx + s * 3, base[1] + 12)], 'r1')
            c.line([base, tip], 'r2', 2)
            c.line([base, m], 'r0')
            c.line([(tip[0], tip[1]), (cx + s * (12 + t * 26), base[1] + 10)], 'r2')
    if f >= 3:
        u = (f - 3) / 4
        c.spark(cx, cy, 12 - (f - 3) * 3, 'y3', 'f3', diag=True)
        c.oval(cx, 52, 6 + u * 24, 2 + u * 5, 'a2', 1)
        c.oval(cx, 52, 3 + u * 14, 1 + u * 3, 'a3', 1)
        for k in range(6):
            a = math.radians(200 + k * 28)
            L = 10 + u * 20
            c.line([pol(cx, 50, 6, a, 0.5), pol(cx, 50, L, a, 0.5)], 'a1' if k % 2 else 'a2')
        for k in range(4):
            feather(c, cx + math.cos(k * 1.7 + u * 3) * (10 + u * 16), 34 + math.sin(k * 1.7) * 10 - u * 8, k * 1.4 + u * 4, 8, 'f2', 'f1', 'f1')
    if f == 0:
        c.line([(cx - 20, 4), (cx - 14, 10)], 'a2'); c.line([(cx + 20, 4), (cx + 14, 10)], 'a2')


if __name__ == '__main__':
    run(globals())
