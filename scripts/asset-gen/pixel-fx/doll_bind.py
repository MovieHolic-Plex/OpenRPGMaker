import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib_nm5 import *  # noqa

"""저주 인형 실 묶기 — 흰 실이 사방에서 날아와 대상을 칭칭 감고 붉은 매듭으로 조인다. 64×10, target."""
KEY, SIZE, FRAMES = 'doll_bind', 64, 10
PAL = ['1a0e16', 'ece4f4', 'b8b0c8', '9a2034', 'd05a6a', 'ffffff']
O, S, SD, R, RL, W = range(1, 7)


def draw(c, f, t):
    n = min(f + 1, 6)
    for k in range(n):
        y = 18 + k * 6
        prog = min((f - k) / 3 + .34, 1) if f >= k else 0
        if prog <= 0:
            continue
        x0 = 4 if k % 2 == 0 else 60
        x1 = x0 + (32 - x0) * 2 * prog
        c.line([(x0, y - 8 + k), (x1, y + (2 if k % 2 else -2))], S if k % 2 else SD)
    if f >= 5:
        tight = min(f - 5, 3)
        for k in range(5):
            y = 20 + k * 7
            rx = 12 - tight - (k == 2)
            c.arc(32, y, rx, 200, 340, S, 1)
            c.arc(32, y + 1, rx, 20, 160, SD, 1)
        c.rect(30, 34, 34, 37, R)
        c.px(31, 35, RL)
        c.line([(34, 37), (37, 42)], R)
        c.line([(30, 37), (28, 43)], R)
    if f == 9:
        c.star(46, 18, 3, W, S)


run(globals())

