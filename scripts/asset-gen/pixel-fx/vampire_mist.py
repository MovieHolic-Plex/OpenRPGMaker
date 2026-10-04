"""vampire_mist: 안개 변신. 몸이 붉은 안개 구름으로 풀어지며 박쥐 세 마리로 갈라졌다 다시 모인다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'vampire_mist', 64, 10, 'user'
PAL = pal(pick(BLOOD, 'b0', 'b1', 'b2', 'b3', 'b4'), pick(NIGHTV, 'n0', 'n1', 'n2', 'n3', 'n4'), pick(BONEW, 'w2'))


def draw(c, f):
    cx, cy = 32, 36
    spread = math.sin(min(1.0, f / 9.0) * math.pi)              # 0 → 1 → 0
    r = rng(4)
    for i in range(6):
        ox = (r.uniform(-1, 1)) * 18 * spread
        oy = (r.uniform(-1, 1)) * 20 * spread * 0.8
        rad = 8 + (i % 3) * 3 + spread * 4
        c.ddisc(cx + ox, cy + oy, rad + 2, 'n1', squash=0.85, parity=i % 2)
        c.ddisc(cx + ox, cy + oy, rad, 'b1' if i % 2 else 'n2', squash=0.85, parity=(i + f) % 2)
        c.ddisc(cx + ox - 2, cy + oy - 2, rad * 0.55, 'b2' if i % 2 else 'n3', squash=0.8, parity=1)
    if 3 <= f <= 6:                                               # 박쥐 세 마리
        for k in range(3):
            a = -1.2 + k * 1.2 + (f - 3) * 0.4
            bat(c, cx + math.cos(a) * 14, cy - 8 + math.sin(a) * 8 - k * 2, 6 + (k == 1) * 2, 'n0', math.sin(f * 2.5 + k), hi='b3')
    if f in (2, 7):
        c.spark(cx, cy - 4, 7, 'b4', 'b3', diag=True)
    for k in range(5):
        px = cx - 18 + k * 9 + math.sin(f * 0.8 + k) * 2
        c.px(px, 54 - (f * 3 + k * 5) % 22, 'b3')
    if f >= 8:
        c.ring(cx, cy, 6 + (f - 8) * 6, 'b2', 1, 1.2)


if __name__ == '__main__':
    run(globals())
