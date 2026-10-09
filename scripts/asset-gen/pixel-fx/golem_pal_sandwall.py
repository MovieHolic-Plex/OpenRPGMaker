"""golem_pal_sandwall: 모래 방벽. 아군 뒤로 황토색 모래 소용돌이가 세로 기둥으로 솟아 두꺼운 벽을 이루고 모래알이 흐른다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'golem_pal_sandwall', 64, 10, 'allAllies'
PAL = pal(CLAY, pick(GOLD, 'y3'))


def draw(c, f):
    gy = 56
    g = ease(min(1.0, (f + 1) / 4))
    fade = 1.0 if f < 8 else (10 - f) / 2.5
    H = 46 * g * max(0.25, fade)
    # 세로 나선 결
    for j in range(4):
        pts = []
        for i in range(17):
            u = i / 16
            y = gy - u * H
            x = 32 + math.sin(u * 7 + f * 0.9 + j * 1.6) * (14 - u * 3) * (0.6 + 0.4 * (1 - u * 0.4))
            pts.append((x, y))
        c.line(pts, ['c1', 'c2', 'c3', 'c2'][j], 2 if j % 2 == 0 else 1)
    # 벽 몸통: 점선 채움
    for yy in range(int(gy - H), gy):
        half = 14 + math.sin((yy + f * 3) * 0.3) * 2
        for xx in range(int(32 - half), int(32 + half) + 1):
            if (xx + yy + f) % 3 == 0:
                c.px(xx, yy, 'c2' if (xx * 7 + yy) % 4 else 'c3')
    for k in range(10):
        r = rng(9 + k)
        c.px(32 + r.uniform(-16, 16), gy - ((f * 5 + k * 7) % 46), 'c4')
    c.oval(32, gy, 18, 2.5, 'c1', 1)
    if f in (3, 4):
        c.spark(32, gy - H * 0.5, 7, 'y3', 'c4', diag=True)
    for k in range(3):
        dust(c, 14 + k * 18, gy + 1, 7 + f * 0.4, 20 + k, ['c1', 'c2', 'c3'], fade=f >= 7)


if __name__ == '__main__':
    run(globals())
