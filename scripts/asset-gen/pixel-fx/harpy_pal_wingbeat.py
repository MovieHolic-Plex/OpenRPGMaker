"""harpy_pal_wingbeat: 날개 연타. 좌우로 번갈아 후려치는 큰 바람 초승달과 튀어 오르는 깃털."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'harpy_pal_wingbeat', 64, 8, 'target'
PAL = pal(pick(AIR, 'a0', 'a1', 'a2', 'a3'), pick(DOWN, 'f1', 'f2', 'f3'), pick(LEAFG, 'g2', 'g3'))


def draw(c, f):
    cx, cy = 32, 32
    # 두 개의 초승달: 짝수 칸은 오른쪽 위→왼쪽 아래, 홀수 칸은 반대
    for k in range(2):
        st = k * 2 + 1
        if not (st <= f <= st + 2):
            continue
        fr = min(1.0, (f - st + 1) / 2)
        if k == 0:
            p0, p1 = (52, 8), (10, 52)
        else:
            p0, p1 = (10, 10), (54, 54)
        c.blade(p0, p1, 9 if k == 0 else -9, 8, ['a0', 'a1', 'a2', 'a3'], fr)
        if f == st:
            c.spark(p0[0] * 0.5 + p1[0] * 0.5, p0[1] * 0.5 + p1[1] * 0.5, 5, 'f3', 'a3')
    for i in range(5):
        r = rng(40 + i)
        a = r.uniform(0, 2 * math.pi)
        d = (6 + r.uniform(0, 8)) + f * r.uniform(2.0, 3.4)
        x, y = cx + math.cos(a) * d, cy + math.sin(a) * d * 0.8 - f * 0.6
        if f >= 1 and d < 30:
            feather(c, x, y, a + f * 0.6, 9, 'f2', 'f1', 'f3' if i % 2 else 'g2')
    if f >= 5:
        streak_lines(c, 8, 56, [16, 26, 40, 48], 'a1', f)
    c.spark(cx, cy, max(2, 6 - abs(f - 3) * 2), 'f3', 'a2')


if __name__ == '__main__':
    run(globals())
