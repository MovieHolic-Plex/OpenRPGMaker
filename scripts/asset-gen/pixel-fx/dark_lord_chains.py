"""dark_lord_chains: 어둠의 사슬. 발밑에 보라 문양이 열리고 사슬 네 줄이 솟아 적에게 X 로 감긴 뒤 조여 흩어진다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'dark_lord_chains', 64, 10, 'target'
PAL = pal(DARKV, pick(BLADE, 'k1', 'k2'))
ENDS = [((6, 60), (56, 14)), ((58, 60), (8, 14)), ((2, 40), (62, 30)), ((62, 44), (2, 26))]


def draw(c, f):
    cx = 32
    if f <= 8:
        r = min(22, 8 + f * 5)
        c.ring(cx, FEET, r, 'u2', 1, 0.28)
        c.ring(cx, FEET, r - 4, 'u3', 1, 0.28)
        for i in range(6):
            a = i * math.pi / 3 + f * 0.2
            c.px(*pol(cx, FEET, r - 2, a, 0.28), 'u4')
    for i, (p0, p1) in enumerate(ENDS):
        t = (f - 1 - i * 0.7) / 3
        if t <= 0 or f == 9:
            continue
        t = min(1.0, t)
        tight = 0 if f < 6 else (f - 5)
        end = (lerp(p0[0], p1[0], t), lerp(p0[1], p1[1], t))
        n = max(2, int(10 * t))
        chain(c, p0, end, n, 'k2' if i < 2 else 'u3', 'u4' if f >= 6 else 'k1', sag=(3 - tight) if i >= 2 else 0)
    if f in (6, 7):
        c.spark(cx, 34, 10 - (f - 6) * 4, 'u4', 'u3', diag=True)
    if f >= 8:
        spark_burst(c, cx, 34, (f - 7) / 3, 16, 5, ['u4', 'u3', 'k2', 'u2'], spd=(6, 26))


if __name__ == '__main__':
    run(globals())

