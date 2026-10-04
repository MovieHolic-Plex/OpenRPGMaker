"""dragonewt_venom: 독무 브레스. 녹색 독안개가 소용돌이로 뭉게뭉게 퍼지고 그 속에 보라 거품과 해골빛 불똥이 떠오른다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'dragonewt_venom', 64, 10, 'target'
PAL = pal(VENOM, pick(NIGHTV, 'n2', 'n3'), pick(BONEW, 'w2'))


def draw(c, f):
    cx, cy = 32, 36
    g = ease(min(1.0, (f + 1) / 5))
    fade = 1.0 if f < 8 else (10 - f) / 2.5
    R = 22 * g
    r = rng(4)
    for i in range(7):
        a = i * 0.9 + f * 0.35
        d = R * (0.3 + 0.55 * ((i * 37) % 10) / 10)
        x, y = cx + math.cos(a) * d, cy + math.sin(a) * d * 0.75
        rad = (9 + (i % 3) * 3) * g * max(0.4, fade)
        c.ddisc(x, y, rad + 2, 'v0', squash=0.9, parity=i % 2)
        c.ddisc(x, y, rad, 'v1', squash=0.9, parity=(i + f) % 2)
        c.ddisc(x - 2, y - 2, rad * 0.55, 'v2', squash=0.85, parity=(i + f + 1) % 2)
    swirl(c, cx, cy, 3, R, 1.0, ['v3', 'v2'], f / 10, n=2, squash=0.75)
    for k in range(6):
        bx = cx + r.uniform(-16, 16)
        by = 52 - ((f * 5 + k * 9) % 38)
        if f >= 2:
            c.ring(bx, by, 2.5 + (k % 2), 'n3', 1)
            c.px(bx - 1, by - 1, 'w2')
    if 2 <= f <= 5:
        c.spark(cx, cy - 4, 6 - (f - 2), 'v3', 'v2')
    for k in range(4):
        rr = rng(20 + k)
        if f >= 3:
            c.px(cx + rr.uniform(-18, 18), cy + rr.uniform(-20, 12) + (f % 3), 'n2')


if __name__ == '__main__':
    run(globals())
