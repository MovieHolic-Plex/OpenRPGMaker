"""vampire_bloodburst: 핏빛 구슬 착탄. 구슬이 터져 선홍 왕관 모양 핏방울이 솟았다가 떨어지고 바닥에 웅덩이가 퍼진다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'vampire_bloodburst', 64, 8, 'target'
PAL = pal(BLOOD, pick(BONEW, 'w2'))


def draw(c, f):
    cx, cy = 32, 38
    t = f / 7
    if f <= 2:
        orb(c, cx, cy, 8 - f * 2, ('b0', 'b2', 'b3', 'b4'))
        c.ring(cx, cy, 10 + f * 6, 'b3', 1)
    if f >= 1:
        # 왕관 모양으로 솟구친 핏줄기들
        n = 9
        for i in range(n):
            a = math.radians(200 + (i / (n - 1)) * 140)
            L = (10 + (i % 3) * 5) * ease(min(1, f / 3.5))
            hx, hy = cx + math.cos(a) * L, cy + math.sin(a) * L * 1.15 + max(0, f - 3) ** 2 * 1.4
            c.line([(cx + math.cos(a) * 4, cy + math.sin(a) * 4), (hx, hy)], 'b2', 2)
            c.disc(hx, hy, 2 if f < 5 else 1.4, 'b3')
            c.px(hx - 1, hy - 1, 'b4')
    if f >= 2:
        spark_burst(c, cx, cy, (f - 2) / 5, 12, 6, ['b4', 'b3', 'b2', 'b1'], spd=(8, 24), grav=1.1, size=(1, 2))
    if f >= 3:
        w = 6 + (f - 3) * 5
        c.oval(cx, 54, w, 2 + (f - 3) * 0.8, 'b2')
        c.oval(cx - 1, 53, w * 0.7, 1 + (f - 3) * 0.5, 'b3')
        if f >= 5:
            for k in range(3):
                drip(c, cx - 12 + k * 12, 44, 3 + (f - 5) * 2, ('b3', 'b4'))
    if f == 7:
        c.px(cx + 6, 52, 'w2')


if __name__ == '__main__':
    run(globals())
