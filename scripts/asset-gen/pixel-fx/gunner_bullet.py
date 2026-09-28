"""gunner_bullet: 조준 사격 탄: 왼쪽으로 날아가는 황동 탄환과 가는 예광 꼬리
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'gunner_bullet', 32, 4, 'projectile'
PAL = pal(STEELB, GOLDY, pick(SMOG, 'q2', 'q3'), WHITE)
EDGE = None


def draw(c, f):
    y = 16
    # 예광 꼬리: 점선처럼 끊긴 선 두 줄
    for i in range(9):
        x = 16 + i * 2 + (f % 2)
        if (i + f) % 3:
            c.px(x, y, 'y2' if i < 4 else 'y1')
    c.line([(15, y - 1), (31, y - 1)], 'q3') if f % 2 == 0 else c.line([(17, y + 1), (31, y + 1)], 'q2')
    # 탄환: 뾰족한 머리(왼쪽)
    c.rect(10, y - 1, 15, y + 1, 'y1')
    c.line([(10, y - 1), (15, y - 1)], 'y3')
    c.poly([(6, y), (10, y - 2), (10, y + 2)], 'w')
    c.px(6, y, 'y3')
    c.line([(15, y - 2), (15, y + 2)], 'b2')
    # 공기 파동
    c.arc(9, y, 6 + f % 2, 130, 230, 'q3', 1, squash=1.4)


if __name__ == '__main__':
    run(globals())
