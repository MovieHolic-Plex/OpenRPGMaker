"""dragonewt_flame_hit: 화염 브레스 착탄. 불덩이가 퍼져 불기둥 세 갈래로 치솟고 불똥과 그을음 연기가 오른다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'dragonewt_flame_hit', 64, 10, 'target'
PAL = pal(FIRE, pick(NIGHTV, 'n1', 'n2'))


def draw(c, f):
    cx, gy = 32, 54
    t = f / 9
    if f <= 2:
        c.disc(cx + 8 - f * 6, gy - 14, 8 - f, 'e2'); c.disc(cx + 8 - f * 6, gy - 14, 5 - f, 'e4')
    n = 1 if f < 2 else 3
    h = [0, 0, 20, 34, 42, 38, 30, 20, 12, 6][f]
    for i, dx in enumerate((-12, 0, 12)[:n + (2 if f >= 2 else 0)] if f >= 2 else (0,)):
        flame(c, cx + dx, gy, 9, max(4, h * (1 - (i % 2) * 0.25)), ['e1', 'e2', 'e3', 'e4'], seed=i * 5 + f, sway=(f % 3 - 1) * 2, tongues=2)
    if f in (2, 3):
        c.spark(cx, gy - 8, 12 - (f - 2) * 4, 'e4', 'e3', diag=True)
    spark_burst(c, cx, gy - 8, t, 14, 3, ['e4', 'e3', 'e2', 'e1'], spd=(6, 26), grav=-0.3, size=(1, 2))
    if f >= 5:
        for k in range(3):
            c.ddisc(cx - 10 + k * 10, 22 - (f - 5) * 3 - k * 2, 5 + (f - 5), 'n2', squash=0.9, parity=k % 2)
    c.oval(cx, gy + 1, 8 + t * 14, 2, 'e1', 1)


if __name__ == '__main__':
    run(globals())
