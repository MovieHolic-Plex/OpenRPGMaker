"""golem_pal_clay: 점토 갑옷. 발밑에서 진흙 덩어리들이 차오르며 몸을 감싸고 표면이 굳어 갈라진 갑옷 껍질이 된다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'golem_pal_clay', 64, 8, 'user'
PAL = pal(CLAY, pick(GOLD, 'y3'))


def draw(c, f):
    cx, gy = 32, 56
    h = min(1.0, (f + 1) / 5) * 44
    top = gy - h
    # 몸통 실루엣 안을 진흙으로 채워 올린다
    for yy in range(int(top), gy + 1):
        u = (yy - 14) / 42
        half = 15 * math.sqrt(max(0.0, 1 - ((yy - 38) / 22.0) ** 2)) + 1
        for xx in range(int(cx - half), int(cx + half) + 1):
            if (xx + yy + f) % 2 == 0 or yy > top + 3:
                k = 'c1' if (xx + yy * 2) % 6 < 3 else 'c2'
                if yy < top + 3:
                    k = 'c3'
                if xx > cx + half - 3:
                    k = 'c0'
                if xx < cx - half + 3 and yy > top + 3:
                    k = 'c3' if k != 'c0' else k
                c.px(xx, yy, k)
    # 진흙 덩이 오르기
    for k in range(5):
        r = rng(20 + k)
        x = cx + r.uniform(-16, 16)
        y = gy - ((f * 6 + k * 9) % 34)
        c.disc(x, y, 2.2, 'c2')
        c.px(x - 1, y - 1, 'c4')
    if f >= 4:
        # 굳으며 갈라진 판 이음
        for yy in (30, 40, 48):
            c.line([(cx - 12, yy), (cx + 12, yy + 1)], 'c0')
        c.line([(cx, 22), (cx - 2, 52)], 'c0')
        c.line([(cx - 8, 26), (cx - 7, 50)], 'c1')
    if f in (4, 5):
        c.spark(cx - 6, 30, 7 - (f - 4) * 2, 'y3', 'c4', diag=True)
    if f >= 6:
        for k in range(6):
            rr = rng(60 + k)
            c.spark(cx + rr.uniform(-15, 15), 22 + rr.uniform(0, 30), 2, 'c4', 'c3')
    c.oval(cx, gy + 1, 14 + f, 2, 'c1', 1)


if __name__ == '__main__':
    run(globals())
