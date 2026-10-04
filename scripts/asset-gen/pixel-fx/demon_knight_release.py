"""demon_knight_release: 마검 해방(필살 배경, 화면 128). 화면을 가르는 붉은 거대 참격 십자와 흑염 불기둥이 솟는다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'demon_knight_release', 128, 12, 'screen'
PAL = pal(DEMON, pick(DARKV, 'u0', 'u1', 'u2'), pick(BLADE, 'k3'), pick(GOLD, 'y3'))
OVAL = 0.4


def draw(c, f):
    cx, cy = 64, 62
    # 어두운 소용돌이 배경
    if f <= 10:
        for i in range(3):
            c.ddisc(cx, cy, 58 - i * 12, ['u0', 'u1', 'u2'][i], squash=0.9, parity=(f + i) % 2)
    # 거대 검(위에서 내리침)
    if 1 <= f <= 6:
        t = min(1.0, f / 3)
        y = lerp(-40, 50, t * t)
        c.poly([(cx - 8, y - 46), (cx + 8, y - 46), (cx + 5, y + 20), (cx, y + 34), (cx - 5, y + 20)], 'd1')
        c.poly([(cx - 5, y - 44), (cx, y - 44), (cx, y + 30), (cx - 3, y + 18)], 'd3')
        c.line([(cx - 1, y - 44), (cx - 1, y + 28)], 'k3')
        c.line([(cx - 18, y - 48), (cx + 18, y - 48)], 'y3', 3)
    # 십자 참격: 착지 후 가로세로로 퍼진다
    if f >= 3:
        L = ease(min(1.0, (f - 2) / 3)) * 64
        for (dx, dy) in ((1, 0), (0, 1)):
            c.blade((cx - dx * L, cy - dy * L * 0.85), (cx + dx * L, cy + dy * L * 0.85), 4, 8, ['d1', 'd2', 'd3', 'd4'], 1.0)
    if f >= 3:
        for sg in (1, -1):
            a = math.radians(45 * sg)
            L2 = ease(min(1.0, (f - 3) / 3)) * 50
            c.line([(cx - math.cos(a) * L2, cy - math.sin(a) * L2), (cx + math.cos(a) * L2, cy + math.sin(a) * L2)], 'd3', 2)
    if 3 <= f <= 5:
        c.spark(cx, cy, 30 - (f - 3) * 8, 'y3', 'd4', diag=True)
    # 흑염 불기둥
    if f >= 4:
        for i in range(7):
            x = 14 + i * 16
            h = [0, 0, 0, 0, 16, 34, 50, 56, 48, 34, 20, 10][f] * (1 - (i % 3) * 0.2)
            flame(c, x, 118, 8, h, ['u1', 'd1', 'd2', 'd3', 'd4'], seed=i * 3 + f, sway=(f % 3 - 1) * 2, tongues=1)
    spark_burst(c, cx, cy, f / 11, 26, 9, ['d4', 'd3', 'd2', 'u2'], spd=(20, 58), squash=0.9)


if __name__ == '__main__':
    run(globals())
