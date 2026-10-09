"""harpy_pal_storm: 깃털 폭풍(필살 배경, 화면 128). 무대 전체를 가로지르는 바람 줄기와 커다란 깃털 소용돌이가 밀려든다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'harpy_pal_storm', 128, 12, 'screen'
PAL = pal(pick(AIR, 'a0', 'a1', 'a2', 'a3'), pick(LEAFG, 'g1', 'g2', 'g3'), pick(DOWN, 'f1', 'f2', 'f3'))
OVAL = 0.4


def draw(c, f):
    cx, cy = 64, 64
    grow = ease(min(1.0, (f + 1) / 6))
    fade = 1.0 if f < 9 else (12 - f) / 3
    # 바깥 소용돌이 줄기 세 가닥
    swirl(c, cx, cy, 6, 60 * grow, 1.15, ['a1', 'a2', 'a3'], f / 12, n=3, squash=0.85, width=2)
    swirl(c, cx, cy, 4, 44 * grow, 1.4, ['a0', 'a1'], -f / 12, n=2, squash=0.85)
    # 가로지르는 돌풍 줄
    r = rng(2)
    for k in range(14):
        y = 10 + r.uniform(0, 108)
        x0 = 128 - ((f * 21 + k * 37) % 170)
        L = r.uniform(12, 30)
        c.line([(x0, y), (x0 + L, y)], 'a2' if k % 2 else 'a1')
    # 큰 깃털들이 궤도를 돈다
    for j in range(16):
        u = j / 16
        a = f * 0.55 + u * 6.28 * 1.3
        rad = (10 + u * 46) * grow
        x = cx + math.cos(a) * rad
        y = cy + math.sin(a) * rad * 0.82
        if fade > 0.4 or j % 2:
            col = ('g2', 'g3', 'g1') if j % 2 else ('f2', 'f1', 'f1')
            feather(c, x, y, a + math.pi / 2 + 0.4, 14 if j % 3 else 18, col[0], col[1], col[2])
    if f in (2, 3, 4):
        c.spark(cx, cy, 14 - (f - 2) * 3, 'f3', 'a3', diag=True)
    spark_burst(c, cx, cy, f / 11, 24, 6, ['f3', 'a3', 'g3', 'g2'], spd=(20, 58), squash=0.85)


if __name__ == '__main__':
    run(globals())
