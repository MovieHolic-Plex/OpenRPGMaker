import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib_nm5 import *  # noqa

"""미믹 보물 미끼 — 시전자 둘레에 금화·보석이 반짝이며 떠올라 적을 끄는 금빛 고리. 64×8, user."""
KEY, SIZE, FRAMES = 'mimic_pal_lure', 64, 8
PAL = ['5a3a08', 'b8801c', 'ffd44a', 'fff6b8', 'ffffff', 'e03048', '40c0f0', '1c100c']
GD, G, GM, GL, W, RUBY, SAPH, O = range(1, 9)


def draw(c, f, t):
    c.ring(32, 52, 18 + f, 4, G, 1, gap=6, phase=f * .4)
    for k in range(6):
        a = k * math.pi / 3 + f * .35
        x = 32 + math.cos(a) * 17
        y = 40 - ((f * 3 + k * 7) % 22) + math.sin(a) * 3
        if k % 3 == 2:
            c.poly([(x, y - 2), (x + 2, y), (x, y + 2), (x - 2, y)], RUBY if k == 2 else SAPH)
            c.px(x - .5, y - 1, W)
        else:
            c.ell(x, y, 2.2, 2.2, GM)
            c.px(x - .5, y - .8, GL)
            c.outline(O, [GM])
    if f % 3 == 1:
        c.star(32 + (f - 4) * 3, 18, 3, GL, W)
    c.star(18 + (f % 4) * 9, 28 + (f % 2) * 6, 1, W)


run(globals())

