"""gargoyle_pal_gaze: 석화의 눈길. 노란 눈빛 두 줄이 적을 꿰뚫자 발끝에서 머리로 돌 껍질이 올라오고 금이 간다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'gargoyle_pal_gaze', 64, 10, 'target'
PAL = pal(STONE, pick(GOLD, 'y1', 'y2', 'y3'), pick(SAND, 'n3'))


def draw(c, f):
    cx = 32
    if f <= 4:                                              # 눈빛: 오른쪽 위에서 몸으로
        for dy in (-3, 3):
            L = min(1.0, (f + 1) / 3)
            x0, y0 = 62, 14 + dy
            x1, y1 = lerp(62, cx + 4, L), lerp(14, 32, L) + dy
            c.line([(x0, y0), (x1, y1)], 'y1', 3)
            c.line([(x0, y0), (x1, y1)], 'y2', 1)
        c.spark(60, 14, 5 - f, 'y3', 'y2')
    if f >= 2:                                              # 돌 껍질이 발에서 머리로: 머리+몸통 실루엣
        h = min(1.0, (f - 1) / 6)
        top = lerp(57, 17, h)

        def inside(xx, yy):
            body = ((xx - cx) / 12.0) ** 2 + ((yy - 41) / 16.0) ** 2 <= 1
            head = ((xx - cx) / 7.5) ** 2 + ((yy - 24) / 8.0) ** 2 <= 1
            return body or head

        for yy in range(int(top), 57):
            for xx in range(cx - 14, cx + 15):
                if inside(xx, yy) and ((xx + yy + (f % 2)) % 2 == 0 or yy > top + 3):
                    k = 's1' if (xx * 3 + yy * 5) % 7 < 3 else 's2'
                    if yy < top + 2:
                        k = 's3'
                    if not inside(xx + 2, yy + 1):
                        k = 's0'
                    elif not inside(xx - 2, yy - 1):
                        k = 's3'
                    c.px(xx, yy, k)
        if f >= 6:
            for k in range(4):
                crack(c, cx - 9 + k * 6, 22 + (k % 2) * 12, 1.4 + k * 0.4, 9, 60 + k, 's0', 1.0, branch=1)
    if f >= 7:
        for k in range(5):
            r = rng(70 + k)
            c.spark(cx + r.uniform(-15, 15), 20 + r.uniform(0, 34), 2 + (f - 7) % 2, 's4', 's3')
    if f >= 8:
        c.ring(cx, 40, 20 + (f - 8) * 3, 's3', 1, 0.9)


if __name__ == '__main__':
    run(globals())
