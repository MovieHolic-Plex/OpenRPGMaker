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
        sag = (3 - tight) if i >= 2 else 0
        L = math.hypot(end[0] - p0[0], end[1] - p0[1]) or 1
        n = max(2, int(L / 4.5))                       # 고리 간격 4.5px: 이웃 고리가 맞물린다
        ux, uy = (end[0] - p0[0]) / L, (end[1] - p0[1]) / L
        for j in range(n + 1):
            u = j / n
            x = lerp(p0[0], end[0], u)
            y = lerp(p0[1], end[1], u) + math.sin(u * math.pi) * sag
            if j % 2:          # 옆으로 선 고리: 진행 방향 짧은 막대
                c.line([(x - ux * 3, y - uy * 3), (x + ux * 3, y + uy * 3)], 'k1', 2)
                c.line([(x - ux * 2, y - uy * 2), (x + ux * 2, y + uy * 2)], 'k2' if i < 2 else 'u3', 1)
            else:              # 정면 고리: 속이 빈 굵은 타원
                c.oval(x, y, 3, 3, 'k1', 2)
                c.oval(x, y, 3, 3, 'k2' if i < 2 else 'u3', 1)
                c.px(x - 2, y - 2, 'u4' if f >= 6 else 'k2')
        if t >= 1:             # 사슬 끝의 쇠 갈고리
            c.poly([(end[0] + ux * 5, end[1] + uy * 5), (end[0] - uy * 3, end[1] + ux * 3), (end[0] + uy * 3, end[1] - ux * 3)], 'u4')
    if f in (6, 7):
        c.spark(cx, 34, 10 - (f - 6) * 4, 'u4', 'u3', diag=True)
    if f >= 8:
        spark_burst(c, cx, 34, (f - 7) / 3, 16, 5, ['u4', 'u3', 'k2', 'u2'], spd=(6, 26))


if __name__ == '__main__':
    run(globals())

