"""harpy_pal_shriek: 고음 비명. 오른쪽에서 밀려온 청록 음파 호가 적 머리 둘레를 톱니 고리로 조이고 어지러운 별이 돈다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'harpy_pal_shriek', 64, 8, 'allTargets'
PAL = pal(pick(AIR, 'a0', 'a1', 'a2', 'a3'), pick(DOWN, 'f2', 'f3'), pick(GOLD, 'y2', 'y3'))
HX, HY = 31, 26


def jag(c, x, y, r, n, k, amp, rot):
    pts = [pol(x, y, r + (amp if i % 2 else -amp), rot + i * 2 * math.pi / n, 0.8) for i in range(n)]
    c.line(pts + [pts[0]], k)


def draw(c, f):
    if f <= 3:                                        # 오른쪽에서 밀려오는 호
        for i in range(3):
            x = 64 - f * 13 - i * 8
            c.arc(x, HY, 8 + i * 3, 130, 230, ['a1', 'a2', 'a3'][i], 2)
    if f >= 2:
        r = 5 + (f - 2) * 4
        jag(c, HX, HY, r, 14, 'a2', 2, f * 0.3)
        jag(c, HX, HY, max(3, r - 5), 12, 'a3', 1.5, -f * 0.3)
    if 3 <= f <= 5:
        c.spark(HX, HY, 6 - (f - 3) * 2, 'f3', 'a3', diag=True)
    if f >= 4:                                         # 어지러운 별
        for k in range(3):
            a = f * 0.9 + k * 2.1
            x, y = pol(HX, HY - 6, 12, a, 0.4)
            c.spark(x, y, 2, 'y3', 'y2')
    if f >= 5:
        c.oval(HX, HY + 12, 16 - (f - 5) * 2, 4, 'a1', 1)
        for k in range(4):
            c.px(HX - 14 + k * 9, HY + 8 - (f - 5) * 2, 'a3')


if __name__ == '__main__':
    run(globals())
