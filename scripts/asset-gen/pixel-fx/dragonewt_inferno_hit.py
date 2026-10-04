"""dragonewt_inferno_hit: 용염 대폭발 명중. 불기둥이 솟는 화염 폭발과 용의 발톱 자국 세 줄, 그을음 연기와 불똥."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'dragonewt_inferno_hit', 64, 8, 'allTargets'
PAL = pal(FIRE, pick(NIGHTV, 'n1', 'n2'), pick(DRAKE, 'r0', 'r2'))


def draw(c, f):
    cx, gy = 32, 54
    if f <= 2:
        c.ring(cx, 34, 4 + f * 10, 'e3', 2, 0.9)
        c.spark(cx, 34, 14 - f * 3, 'e4', 'e3', diag=True)
    for i, dx in enumerate((-16, -6, 6, 16)):
        h = [0, 14, 30, 44, 46, 34, 20, 8][f] * (1 - (i % 2) * 0.2)
        flame(c, cx + dx, gy, 9, max(3, h), ['e1', 'e2', 'e3', 'e4'], seed=i * 7 + f, sway=(f % 3 - 1) * 2, tongues=2)
    if 2 <= f <= 5:
        for i in range(3):
            o = (i - 1) * 10
            c.blade((cx + o + 8, 10), (cx + o - 8, 50), 4, 5, ['r0', 'r2', 'e4'], min(1.0, (f - 1) / 2))
    spark_burst(c, cx, 36, f / 7, 16, 7, ['e4', 'e3', 'e2', 'e1'], spd=(8, 28), grav=-0.4, size=(1, 2.2))
    if f >= 4:
        for k in range(3):
            c.ddisc(cx - 12 + k * 12, 14 - (f - 4) * 3 - k, 6 + (f - 4), 'n2', squash=0.9, parity=k % 2)


if __name__ == '__main__':
    run(globals())
