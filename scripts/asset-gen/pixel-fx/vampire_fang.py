"""vampire_fang: 송곳니 물기. 위아래 턱이 창백한 이빨로 다물리며 목덜미에 두 구멍을 내고 핏방울이 흘러내린다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'vampire_fang', 64, 8, 'target'
PAL = pal(BLOOD, BONEW, pick(NIGHTV, 'n0', 'n1'))


def draw(c, f):
    cx, cy = 32, 34
    open_ = [17, 12, 6, 1, 0, 3, 6, 8][f]
    if f <= 5:
        # 위턱/아래턱: 이빨 열이 마주 닫힌다
        top_y, bot_y = cy - open_ - 3, cy + open_ + 3
        c.line([(cx - 18, top_y - 3), (cx + 18, top_y - 3)], 'n1', 3)
        c.line([(cx - 18, bot_y + 3), (cx + 18, bot_y + 3)], 'n1', 3)
        teeth(c, (cx - 17, top_y - 1), (cx + 17, top_y - 1), 7, 5, True, ('w2', 'w1'))
        teeth(c, (cx - 17, bot_y + 1), (cx + 17, bot_y + 1), 7, 5, False, ('w2', 'w1'))
        fang(c, cx - 5, top_y - 1, 10, 2, True, 'w2', 'w1', 'b0')
        fang(c, cx + 6, top_y - 1, 10, 2, True, 'w2', 'w1', 'b0')
        # 벌린 입 속 그림자(체커)
        for yy in range(int(top_y), int(bot_y) + 1):
            for xx in range(cx - 14, cx + 15):
                if (xx + yy) % 2 == 0:
                    c.px(xx, yy, 'b1')
    if f == 3 or f == 4:
        c.spark(cx, cy, 9 if f == 3 else 6, 'b4', 'b3', diag=True)
    if f >= 3:
        for k, x in enumerate((cx - 5, cx + 6)):
            drip(c, x, cy - 3 if f < 5 else cy - 1, 4 + (f - 3) * 3 + k * 2, ('b3', 'b4'))
    if f >= 4:
        spark_burst(c, cx, cy, (f - 4) / 4, 10, 13, ['b4', 'b3', 'b2', 'b1'], spd=(6, 20), grav=0.9, size=(1, 2))
    if f >= 6:
        c.oval(cx, cy + 10, 3 + (f - 6) * 3, 1 + (f - 6), 'b2')


if __name__ == '__main__':
    run(globals())
