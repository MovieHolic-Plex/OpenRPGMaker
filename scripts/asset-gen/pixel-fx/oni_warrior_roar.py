"""oni_warrior_roar: 오니의 함성(시전자, 128). 가운데 두 뿔 문장이 부풀고, 톱니 고리 세 겹이 차례로 퍼지며 금빛 방사선이 뻗는다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'oni_warrior_roar', 128, 10, 'user'
PAL = pal(ONI, pick(GOLD, 'y1', 'y2', 'y3'))


def draw(c, f):
    cx, cy = 64, 66
    for j in range(3):
        t = (f - j * 2) / 6
        if not 0 <= t <= 1:
            continue
        r = 12 + ease(t) * 48
        n = 18
        pts = [pol(cx, cy, r * (1.0 if i % 2 == 0 else 0.86), i * math.pi / n + j * 0.3, 0.8) for i in range(n * 2)]
        c.line(pts + [pts[0]], ['o3', 'o2', 'o1'][min(2, int(t * 3))], 2 if t < 0.5 else 1)
    if 1 <= f <= 6:
        c.rays(cx, cy, 12, 14 + f * 3, 26 + f * 6, 'y2' if f % 2 else 'y1', 1, rot=f * 0.13, squash=0.8)
    if f <= 7:
        s = 1 + min(f, 3) * 0.25
        for sg in (-1, 1):
            c.poly([(cx + sg * 6 * s, cy - 4), (cx + sg * 14 * s, cy - 22 * s), (cx + sg * 10 * s, cy - 2)], 'o2')
            c.line([(cx + sg * 7 * s, cy - 5), (cx + sg * 13 * s, cy - 20 * s)], 'y3')
        c.disc(cx, cy, 7 * s, 'o1')
        c.disc(cx, cy, 5 * s, 'o3')
        c.line([(cx - 4 * s, cy + 1), (cx + 4 * s, cy + 1)], 'o0', 2)        # 벌린 입
        c.disc(cx, cy - 3 * s, 1.5, 'y3')
    if f >= 6:
        spark_burst(c, cx, cy, (f - 5) / 5, 20, 11, ['y3', 'y2', 'o3', 'o2'], spd=(20, 56), squash=0.8)


if __name__ == '__main__':
    run(globals())

