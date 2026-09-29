"""vampire_bats: 박쥐 떼. 오른쪽 위에서 몰려온 박쥐 무리가 적 머리 둘레를 돌며 날개를 퍼덕이고 붉은 눈만 남기며 흩어진다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'vampire_bats', 64, 10, 'allTargets'
PAL = pal(pick(NIGHTV, 'n0', 'n1', 'n2', 'n3'), pick(BLOOD, 'b3', 'b4'))


def draw(c, f):
    cx, cy = 32, 26
    r = rng(9)
    for i in range(9):
        ph = r.uniform(0, 6.28)
        sz = 5 + (i % 3) * 2
        if f < 3:                                          # 오른쪽 위에서 날아옴
            t = (f + 1) / 4
            x = lerp(70 + i * 3, cx + math.cos(ph) * 16, t)
            y = lerp(-6 + i * 3, cy + math.sin(ph) * 9, t)
        elif f < 8:                                        # 머리 둘레를 돈다
            a = ph + (f - 3) * 0.75
            x = cx + math.cos(a) * (17 + (i % 3) * 4)
            y = cy + math.sin(a) * (7 + (i % 2) * 5)
        else:                                              # 날아가며 흩어짐
            t = (f - 7) / 3
            a = ph + 5 * 0.75
            x = cx + math.cos(a) * (17 + t * 22)
            y = cy + math.sin(a) * 9 - t * 26
        flap = math.sin(f * 2.4 + i * 1.3)
        if f == 9 and i % 2:
            c.px(x - 1, y, 'b3'); c.px(x + 1, y, 'b3')
            continue
        bat(c, x, y, sz, 'n1' if i % 2 else 'n2', flap, hi='b3')
    if 3 <= f <= 7:
        c.spark(cx, cy + 2, 4 - abs(f - 5), 'b4', 'b3')
        for k in range(3):
            c.px(cx - 6 + k * 6, cy - 4 + (f % 2), 'b3')


if __name__ == '__main__':
    run(globals())
