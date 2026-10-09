"""dragonewt_inferno: 용염 대폭발(필살 배경, 화면 128). 거대한 용의 머리 실루엣이 불꽃을 토하고 화면이 불바다와 불기둥으로 뒤덮인다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'dragonewt_inferno', 128, 12, 'screen'
PAL = pal(FIRE, pick(DRAKE, 'r0', 'r1', 'r2'), pick(NIGHTV, 'n0', 'n1'), pick(GOLD, 'y3'))
OVAL = 0.4


def draw(c, f):
    cx, cy = 64, 60
    # 불타는 하늘
    for i in range(3):
        c.ddisc(cx, cy, 58 - i * 14, ['n0', 'n1', 'e0'][i], squash=0.95, parity=(f + i) % 2)
    # 오른쪽 위에서 밀려드는 용의 머리 실루엣(초록 비늘 + 벌린 턱)
    g = ease(min(1.0, (f + 1) / 4))
    hx = lerp(150, 92, g)
    hy = 30
    c.poly([(hx - 6, hy + 4), (hx - 32, hy + 6), (hx - 40, hy + 12), (hx - 30, hy + 18), (hx - 8, hy + 20), (hx + 22, hy + 24), (hx + 30, hy + 4), (hx + 20, hy - 16), (hx + 4, hy - 20)], 'r0')
    c.poly([(hx - 6, hy + 5), (hx - 30, hy + 7), (hx - 36, hy + 12), (hx - 8, hy + 12), (hx + 12, hy + 16), (hx + 24, hy + 2), (hx + 12, hy - 12)], 'r1')
    c.poly([(hx - 28, hy + 8), (hx - 6, hy + 8), (hx - 6, hy + 12), (hx - 34, hy + 12)], 'r2')
    teeth(c, (hx - 34, hy + 13), (hx - 8, hy + 13), 5, 5, False, ('f3' if False else 'e4', 'e3'))
    teeth(c, (hx - 30, hy + 5), (hx - 8, hy + 5), 4, 4, True, ('e4', 'e3'))
    c.poly([(hx + 6, hy - 6), (hx + 12, hy - 8), (hx + 10, hy - 3)], 'e4')
    c.poly([(hx + 14, hy - 14), (hx + 30, hy - 30), (hx + 22, hy - 10)], 'r2')
    # 불을 토하는 줄기: 왼쪽 아래로 퍼진다
    if f >= 2:
        t = min(1.0, (f - 1) / 4)
        for k, key in enumerate(('e1', 'e2', 'e3', 'e4')):
            w = (16 - k * 4) * t
            c.poly([(hx - 36, hy + 8), (lerp(hx - 36, 0, t), hy + 8 - w * 1.4 + 24 * t), (lerp(hx - 36, 0, t), hy + 8 + w * 1.4 + 40 * t), (hx - 36, hy + 10)], key)
    # 바닥 불바다
    if f >= 3:
        for i in range(9):
            x = 8 + i * 14
            h = [0, 0, 0, 12, 24, 36, 44, 46, 40, 30, 22, 14][f] * (0.6 + ((i * 7) % 5) / 8)
            flame(c, x, 122, 9, h, ['e1', 'e2', 'e3', 'e4'], seed=i * 3 + f, sway=(f % 3 - 1) * 2, tongues=2)
    spark_burst(c, cx, cy, f / 11, 26, 4, ['e4', 'e3', 'e2', 'e1'], spd=(20, 58), grav=-0.4, squash=0.9)
    if f in (4, 5):
        c.spark(cx - 24, cy + 12, 28 - (f - 4) * 8, 'y3', 'e4', diag=True)


if __name__ == '__main__':
    run(globals())
