"""demon_knight_flamespin: 흑염 회전베기. 검은 불꽃 고리가 두 겹으로 돌며 안쪽 붉은 원반 참격이 함께 퍼진다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'demon_knight_flamespin', 64, 10, 'allTargets'
PAL = pal(DEMON, pick(DARKV, 'u0', 'u1', 'u2', 'u3'), pick(GOLD, 'y3'))


def draw(c, f):
    cx, cy = 32, 36
    g = ease(min(1.0, (f + 1) / 4))
    fade = 1.0 if f < 8 else (10 - f) / 2.5
    R = 26 * g * max(0.3, fade)
    # 검은 불꽃 띠(위쪽이 앞)
    for j in range(3):
        for i in range(16):
            a = f * 0.75 + i * math.pi / 8 + j * 0.3
            x, y = pol(cx, cy, R - j * 2, a, 0.45)
            if math.sin(a) < -0.1 and j:
                continue
            flame(c, x, y + 2, 4, 9 - j * 2, ['u1', 'd1', 'd2', 'd3'][j:j + 2] if j < 3 else ['u1', 'd1'], seed=i, tongues=1)
    # 붉은 원반 참격
    c.blade(pol(cx, cy, R, f * 0.9, 0.45), pol(cx, cy, R, f * 0.9 + 2.9, 0.45), 4, 6, ['d2', 'd3', 'd4'], 1.0)
    c.blade(pol(cx, cy, R * 0.7, f * 0.9 + 3.1, 0.45), pol(cx, cy, R * 0.7, f * 0.9 + 6.0, 0.45), 3, 4, ['d1', 'd3', 'd4'], 1.0)
    if f in (1, 2, 3):
        c.spark(cx, cy, 10 - f * 2, 'y3', 'd4', diag=True)
    spark_burst(c, cx, cy, f / 9, 12, 5, ['d4', 'd3', 'u3', 'u2'], spd=(10, 28), squash=0.6)


if __name__ == '__main__':
    run(globals())
