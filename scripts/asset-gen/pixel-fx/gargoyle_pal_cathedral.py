"""gargoyle_pal_cathedral: 성당 붕괴(필살 배경, 화면 128). 뾰족 아치와 첨탑이 솟았다가 금빛 색유리 파편과 함께 무너져 내린다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'gargoyle_pal_cathedral', 128, 12, 'screen'
PAL = pal(STONE, pick(SAND, 'n1', 'n2', 'n3'), pick(GOLD, 'y1', 'y2', 'y3'), pick(BLOOD, 'b3'), pick(ICE, 'i2'))
OVAL = 0.42


def arch(c, cx, base, w, h, th, k_out, k_in, drop=0.0):
    """뾰족 고딕 아치 외곽선. drop 은 위에서부터 무너진 정도(0~1)."""
    left = [(cx - w, base), (cx - w, base - h * 0.55)]
    for i in range(1, 9):
        u = i / 8
        left.append((cx - w + (w) * u * 0.98, base - h * 0.55 - h * 0.45 * math.sin(u * math.pi / 2)))
    pts = left
    right = [(2 * cx - x, y) for x, y in reversed(left)]
    full = pts + right
    if drop > 0:
        full = [(x, y + drop * 30 * ((i * 7) % 5) / 4) for i, (x, y) in enumerate(full)]
    c.line(full, k_out, th + 2)
    c.line(full, k_in, th)


def draw(c, f):
    cx = 64
    g = ease(min(1.0, (f + 1) / 4))
    drop = max(0.0, (f - 5) / 5)
    # 금빛 광선(창 사이로 들어오는 빛)
    if 2 <= f <= 8:
        for k in range(5):
            x = 34 + k * 15
            c.line([(x, 18), (x - 12 + (f % 2), 100)], 'y1')
    # 큰 아치 두 겹
    if f <= 8:
        arch(c, cx, 118 - (1 - g) * 40, 42, 90 * g, 3, 's0', 's2', drop)
        arch(c, cx, 118 - (1 - g) * 40, 28, 70 * g, 2, 's0', 's3', drop)
        # 장미창
        if g > 0.5 and f <= 6:
            c.ring(cx, 56, 11, 's0', 3)
            c.ring(cx, 56, 11, 's2', 1)
            for k in range(8):
                a = k * math.pi / 4 + f * 0.2
                c.line([pol(cx, 56, 3, a), pol(cx, 56, 10, a)], 'b3' if k % 2 else 'i2')
            c.disc(cx, 56, 2, 'y2')
    # 첨탑: 양쪽 기둥이 솟고 기운다
    for s in (-1, 1):
        x = cx + s * 46
        top = 118 - 92 * g + drop * 40
        lean = drop * 18 * s
        c.poly([(x - 5, 120), (x - 5, top + 20), (x + lean, top - 6), (x + 5, top + 20), (x + 5, 120)], 's1')
        c.line([(x - 5, 120), (x - 5, top + 20), (x + lean, top - 6)], 's3')
        c.line([(x + 5, 120), (x + 5, top + 20)], 's0', 2)
    # 무너져 내리는 돌덩이
    if f >= 5:
        r = rng(11)
        for k in range(12):
            x = 18 + r.uniform(0, 92)
            t = ((f - 5) / 6 + r.uniform(0, 0.4)) % 1.0
            y = lerp(-6, 118, t * t)
            rock(c, x, y, 3 + (k % 3) * 2, ['s0', 's2', 's3', 's4'], k, 6)
    # 색유리 파편
    if f >= 4:
        r = rng(5)
        for k in range(22):
            x = 18 + r.uniform(0, 92)
            t = ((f - 4) / 8 + r.uniform(0, 0.5)) % 1.0
            y = lerp(20, 120, t)
            kk = ['y2', 'b3', 'i2', 'y3'][k % 4]
            c.poly([(x, y - 2), (x + 2, y), (x, y + 2), (x - 1, y)], kk)
    if f >= 8:
        for k in range(6):
            dust(c, 16 + k * 19, 112, 14 + (f - 8) * 3, k + 2, ['n1', 'n2', 'n3'], fade=f >= 10)
    if f in (5, 6):
        c.spark(cx, 100, 20 - (f - 5) * 6, 's4', 'y3', diag=True)


if __name__ == '__main__':
    run(globals())
