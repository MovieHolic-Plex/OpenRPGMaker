"""oni_warrior_whirl: 귀문 회전베기. 푸른 귀화 여섯 개가 적 둘레 타원 궤도를 돌고, 붉은 칼·푸른 칼 궤적이 함께 회전하다 흩어진다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'oni_warrior_whirl', 64, 10, 'allTargets'
PAL = pal(GHOST, pick(ONI, 'o1', 'o2', 'o3'), pick(BLADE, 'k3'))


def draw(c, f):
    cx, cy = 32, 36
    rot = f * 0.7
    R = 22 if f < 8 else 22 + (f - 7) * 4
    order = sorted(range(6), key=lambda i: math.sin(rot + i * math.pi / 3))
    for i in order:                              # 뒤쪽 불부터
        if f >= 8 and i % 2:
            continue
        a = rot + i * math.pi / 3
        x, y = pol(cx, cy, R, a, 0.42)
        front = math.sin(a) > 0
        flame(c, x, y + 4, 3, 10 if front else 6, ['h1', 'h2', 'h3'] if front else ['h0', 'h1'], seed=i + f, sway=-math.cos(a) * 3, tongues=1)
    if f <= 8:
        for j in range(2):
            a0 = rot * 1.3 + j * math.pi
            c.blade(pol(cx, cy, 24, a0, 0.5), pol(cx, cy, 24, a0 + 1.9, 0.5), 6, 4, ['o1', 'o2', 'o3', 'k3'] if j == 0 else ['h1', 'h2', 'h4'], 1.0)
    if f in (3, 6):
        c.spark(cx, cy - 4, 8, 'h4', 'h3', diag=True)
    if f >= 8:
        spark_burst(c, cx, cy, (f - 7) / 3, 14, 5, ['h4', 'h3', 'h2'], spd=(8, 24), up=0.5)


if __name__ == '__main__':
    run(globals())

