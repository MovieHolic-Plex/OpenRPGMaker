"""vampire_drain: 생명 흡수. 적에게서 피 구슬 여러 개가 곡선 길을 타고 오른쪽 시전자 쪽으로 빨려 올라간다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'vampire_drain', 64, 10, 'target'
PAL = pal(BLOOD, pick(BONEW, 'w2'), pick(NIGHTV, 'n2', 'n3'))


def draw(c, f):
    cx, cy = 30, 36
    # 적 몸에 붉은 균열 고리
    if f <= 6:
        r0 = 6 + f * 2
        c.dring(cx, cy, r0, 'b3', parity=f % 2, squash=1.2)
        c.dring(cx, cy, r0 - 4, 'b2', parity=(f + 1) % 2, squash=1.2)
    # 피 구슬이 곡선 길을 따라 오른쪽으로
    for i in range(7):
        st = i * 0.9
        t = (f - st) / 5.0
        if not (0 <= t <= 1):
            continue
        p0 = (cx + (i % 3 - 1) * 5, cy + (i % 4 - 1.5) * 6)
        p1 = (cx + 20, cy - 26 - (i % 3) * 4)
        p2 = (66, cy - 8 + (i % 2) * 6)
        tt = ease(t) if t < 0.5 else t
        x, y = bezier(p0, p1, p2, tt)
        # 꼬리
        for k in range(1, 5):
            xk, yk = bezier(p0, p1, p2, max(0, tt - k * 0.05))
            c.disc(xk, yk, max(0.6, 2.2 - k * 0.4), 'b2' if k % 2 else 'b1')
        c.disc(x, y, 2.5, 'b3')
        c.px(x - 1, y - 1, 'b4')
    if f in (0, 1):
        c.spark(cx, cy, 8 - f * 3, 'b4', 'b3', diag=True)
    # 시전자 쪽 빨려 드는 반짝임
    if f >= 5:
        c.spark(62, 26 + (f % 3) * 2, 3 + (f % 2), 'w2', 'b4')
    # 적이 시들며 색을 잃는 체커
    if f >= 4:
        for yy in range(20, 54):
            for xx in range(cx - 12, cx + 13):
                if (xx + yy + f) % 6 == 0 and ((xx - cx) / 12.0) ** 2 + ((yy - 40) / 17.0) ** 2 <= 1:
                    c.px(xx, yy, 'n2')


if __name__ == '__main__':
    run(globals())
