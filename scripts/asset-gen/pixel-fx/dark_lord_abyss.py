"""dark_lord_abyss: 심연의 아가리. 발밑에 검은 구멍이 넓어지며 이빨 테두리가 드러나고, 촉수 셋이 솟았다 적을 끌어내린 뒤 닫힌다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'dark_lord_abyss', 64, 10, 'allTargets'
PAL = pal(DARKV, pick(BONEW, 'w1', 'w2'), pick(HELL, 'z2'))


def draw(c, f):
    cx, g = 32, FEET - 2
    open_ = [0.25, 0.5, 0.8, 1, 1, 1, 1, 0.8, 0.45, 0.15][f]
    rx, ry = 27 * open_, 8 * open_
    c.oval(cx, g, rx + 2, ry + 2, 'u2')
    c.oval(cx, g, rx, ry, 'u0')
    c.ddisc(cx, g, rx - 3, 'u1', squash=max(0.1, ry / max(rx, 1)), parity=f % 2)
    if open_ >= 0.5:
        n = 7
        teeth(c, (cx - rx + 3, g - ry + 2), (cx + rx - 3, g - ry + 2), n, 3 * open_, True, ['w1', 'w2'])
        teeth(c, (cx - rx + 5, g + ry - 1), (cx + rx - 5, g + ry - 1), n - 2, 3 * open_, False, ['w1', 'w2'])
        c.px(cx - 6, g, 'z2')
        c.px(cx + 6, g, 'z2')
    if 3 <= f <= 7:
        h = [18, 32, 38, 30, 14][f - 3]
        for j, x0 in enumerate((cx - 14, cx, cx + 14)):
            hh = h * (1.0 if j == 1 else 0.8)
            pts = [(x0 + math.sin(u * 3.2 + f + j) * 4 * u, g - hh * u) for u in (0, .25, .5, .75, 1)]
            c.line(pts, 'u2', 4)
            c.line(pts, 'u3', 2)
            c.px(pts[-1][0], pts[-1][1], 'u4')
            for p in pts[1:4]:
                c.px(p[0] + 2, p[1], 'u4')
    if f >= 8:
        spark_burst(c, cx, g - 4, (f - 7) / 3, 10, 3, ['u4', 'u3'], spd=(6, 18), up=0.8)


if __name__ == '__main__':
    run(globals())

