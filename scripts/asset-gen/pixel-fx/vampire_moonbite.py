"""vampire_moonbite: 붉은 달의 물기. 붉은 달빛 기둥이 내리꽂히고 그 속에서 커다란 송곳니 자국 두 개가 꽝 찍혀 핏줄기가 솟는다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'vampire_moonbite', 64, 8, 'target'
PAL = pal(BLOOD, pick(BONEW, 'w1', 'w2'), pick(NIGHTV, 'n1', 'n2'))


def draw(c, f):
    cx, cy = 32, 34
    if f <= 3:                                              # 붉은 달빛 기둥
        w = [4, 8, 12, 10][f]
        for k, key in enumerate(('b1', 'b2', 'b3')):
            ww = w - k * 3
            if ww > 0:
                c.rect(cx - ww, 0, cx + ww, 56, key)
        for i in range(6):
            c.px(cx - w + 2 + (i * 5 + f * 3) % (2 * w - 3 + 1), (f * 9 + i * 11) % 56, 'b4')
    if f >= 2:
        s = min(1.0, (f - 1) / 3)
        L = 24 * s
        for sx in (-8, 8):
            x = cx + sx
            c.poly([(x - 5, cy - 16), (x + 5, cy - 16), (x + 1, cy - 16 + L * 1.3), (x - 1, cy - 16 + L * 1.3)], 'w2')
            c.line([(x - 4, cy - 16), (x, cy - 16 + L * 1.25)], 'w1')
            c.line([(x + 5, cy - 16), (x + 1, cy - 16 + L * 1.3)], 'b1')
        if f >= 4:
            for sx in (-8, 8):
                drip(c, cx + sx, cy + 14, 5 + (f - 4) * 4, ('b3', 'b4'))
    if f in (3, 4):
        c.spark(cx, cy + 12, 10 - (f - 3) * 3, 'b4', 'b3', diag=True)
    if f >= 3:
        spark_burst(c, cx, cy + 10, (f - 3) / 4, 14, 7, ['b4', 'b3', 'b2', 'b1'], spd=(8, 26), grav=1.0, size=(1, 2))
        c.oval(cx, 55, 6 + (f - 3) * 5, 1 + (f - 3) * 0.7, 'b2')


if __name__ == '__main__':
    run(globals())
