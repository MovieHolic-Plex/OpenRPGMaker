"""oni_warrior_parade: 백귀야행(필살 배경, 화면 128). 밤안개 속을 등불 든 귀신 행렬이 오른쪽에서 왼쪽으로 지나가고,
도깨비불이 떠돌다 마지막에 땅을 푸른 불길이 쓸고 간다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'oni_warrior_parade', 128, 12, 'screen'
PAL = pal(ONI, GHOST, GOLD, INK)
OVAL = 0.4


def lantern(c, x, y, s):
    c.oval(x, y, 4 * s, 6 * s, 'o2')
    c.oval(x - 1, y - 1, 2.5 * s, 4.5 * s, 'y2')
    for k in (-1, 1):
        c.line([(x - 4 * s, y + k * 3 * s), (x + 4 * s, y + k * 3 * s)], 'o1')
    c.rect(x - 2 * s, y - 7 * s, x + 2 * s, y - 6 * s, 'k0')
    c.rect(x - 2 * s, y + 6 * s, x + 2 * s, y + 7 * s, 'k0')


def ghost(c, x, y, s, k, f):
    c.disc(x, y, 5 * s, k)
    w = f % 2
    c.poly([(x - 5 * s, y), (x + 5 * s, y), (x + 6 * s, y + 12 * s), (x + 3 * s, y + 10 * s + w), (x, y + 13 * s),
            (x - 3 * s, y + 10 * s - w), (x - 6 * s, y + 12 * s)], k)
    c.poly([(x - 3 * s, y - 4 * s), (x - 2 * s, y - 8 * s), (x - 1 * s, y - 4 * s)], 'o3')
    c.poly([(x + 1 * s, y - 4 * s), (x + 2 * s, y - 8 * s), (x + 3 * s, y - 4 * s)], 'o3')
    c.px(x - 2 * s, y - 1, 'k0')
    c.px(x - 2 * s - 1, y - 1, 'k0')
    c.px(x + 1 * s, y - 1, 'k0')


def draw(c, f):
    c.ddisc(64, 60, 62, 'h0', parity=f % 2)
    c.ddisc(64, 104, 60, 'o0', squash=0.3, parity=(f + 1) % 2)
    c.disc(90, 28, 9, 'y3')
    c.disc(94, 25, 8, 'k0')
    for i in range(8):                               # 도깨비불이 떠돈다
        x = (i * 19 - f * 5) % 150 - 10
        y = 34 + math.sin(f * 0.8 + i * 1.7) * 6 + (i % 3) * 5
        flame(c, x, y, 2, 7, ['h1', 'h2', 'h3'], seed=i + f, sway=3, tongues=1)
    for i in range(7):                               # 뒷줄: 등불 든 귀신
        x = (i * 24 - f * 8) % 168 - 20
        y = 62 + math.sin(f * 0.9 + i) * 2
        ghost(c, x, y, 1.0, 'h3' if i % 2 else 'h2', f + i)
        c.line([(x - 5, y + 4), (x - 9, y + 1)], 'k0')
        lantern(c, x - 9, y + 9, 1.0)
    for i in range(5):                               # 앞줄: 큰 귀신이 더 빨리
        x = (i * 34 - f * 12 + 10) % 170 - 20
        ghost(c, x, 84, 1.5, 'h4', f + i)
        if i % 2 == 0:
            lantern(c, x - 13, 102, 1.3)
    if f >= 8:
        a = f - 8
        front = 128 - a * 34
        for i in range(8):
            x = front + i * 7
            flame(c, x, 118, 5, 22 - i * 2, ['h1', 'h2', 'h3', 'h4'], seed=i + f * 3, sway=4, tongues=1)
        if a <= 1:
            c.spark(front, 108, 10, 'h4', 'h3', diag=True)


if __name__ == '__main__':
    run(globals())

