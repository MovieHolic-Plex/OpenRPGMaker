"""신의 심판 화면 층 — 128px 12칸. 하늘이 갈라지며 빛이 쏟아짐 → 거대한 성십자가 내려와 적진(왼쪽)에 꽂힘·백색 섬광 → 빛살과 잔광. cleric_judgment_hit 과 같은 HOLY."""
import math, random
from lib_mage import *

KEY = 'cleric_judgment_cross'; FRAME = 128; FRAMES = 12; ANCHOR = 'screen'
PAL = Pal(H=HOLY, D=['#1a1428', '#3a2c4a'], R=['#c8402a'])
PEAK = [4, 6, 8]
CX = 48         # the cross lands over the enemy side (left of centre)
LAND = 104      # foot of the cross when planted
_r = random.Random(21)
MOTES = [(_r.uniform(0, 128), _r.uniform(0, 128), _r.randint(0, 2)) for _ in range(26)]


def holy_cross(c, top, s, lit):
    H = PAL.H
    stem_w, arm = 9 * s, 30 * s
    arm_y = top + 22 * s
    bottom = top + 88 * s
    # dark outline, gold body, bright bevel, white core
    c.rect(CX - stem_w / 2 - 1, top - 1, CX + stem_w / 2 + 1, bottom, H[0])
    c.rect(CX - arm - 1, arm_y - stem_w / 2 - 1, CX + arm + 1, arm_y + stem_w / 2 + 1, H[0])
    c.rect(CX - stem_w / 2, top, CX + stem_w / 2, bottom, H[2])
    c.rect(CX - arm, arm_y - stem_w / 2, CX + arm, arm_y + stem_w / 2, H[2])
    c.rect(CX - stem_w / 2 + 1, top + 1, CX - 1, bottom - 2, H[3 if not lit else 4])
    c.rect(CX - arm + 1, arm_y - stem_w / 2 + 1, CX + arm - 1, arm_y - 1, H[3 if not lit else 4])
    c.rect(CX - 1, top + 2, CX, bottom - 4, H[5]) if lit else c.rect(CX - 1, top + 2, CX, bottom - 4, H[4])
    # flared ends
    for ex, ey in ((CX - arm, arm_y), (CX + arm, arm_y), (CX, top)):
        c.disc(ex, ey, stem_w * .75, H[3])
        c.disc(ex, ey, stem_w * .4, H[5] if lit else H[4])
    # ring behind the crossing
    c.ring(CX, arm_y, 16 * s, H[4], 2)
    c.ring(CX, arm_y, 16 * s - 3, H[1], 1)
    # pointed foot
    c.poly([(CX - stem_w / 2, bottom), (CX + stem_w / 2, bottom), (CX, bottom + 8 * s)], H[3])


def rays(c, cx, cy, n, r0, r1, col, phase=0, w=1):
    for k in range(n):
        a = phase + k * math.tau / n
        c.line([orbit(cx, cy, r0, a), orbit(cx, cy, r1, a)], col, w)


def draw(c, f):
    H, D = PAL.H, PAL.D
    if f <= 2:  # sky darkens at the top, a crack of light opens
        h = [14, 24, 30][f]
        c.disc(64, -12, 66, D[0], h + 12); c.dither(lambda cc: cc.disc(64, -12, 70, D[0], h + 18), f)
        w = [8, 26, 44][f]
        c.disc(CX, 6, w, H[2], 6); c.disc(CX, 6, w * .7, H[4], 4); c.disc(CX, 6, w * .35, H[5], 2)
        for k in range(5):
            x = CX - 30 + k * 15
            c.line([(x, 8), (x - 4 + (k - 2) * 3, 8 + [20, 50, 90][f])], H[3] if k % 2 else H[4])
        return
    if f <= 4:  # cross descends through the opening
        top = [-60, -20][f - 3]
        c.disc(64, -12, 66, D[0], 42); c.dither(lambda cc: cc.disc(64, -12, 70, D[0], 48), f)
        c.disc(CX, 6, 50, H[2], 7); c.disc(CX, 6, 34, H[4], 4)
        c.poly([(CX - 26, 10), (CX + 26, 10), (CX + 40, 127), (CX - 40, 127)], H[1]) if f == 4 else None
        c.poly([(CX - 14, 10), (CX + 14, 10), (CX + 22, 127), (CX - 22, 127)], H[2])
        holy_cross(c, top, 1.0, lit=(f == 4))
        for k in range(6):   # speed lines alongside
            x = CX - 36 + k * 14 + (k > 2) * 2
            c.line([(x, top + 10 + k * 7), (x, top + 50 + k * 7)], H[4])
        return
    if f == 5:  # impact: white-out around the planted cross
        c.disc(CX, LAND, 70, H[3], 36); c.disc(CX, LAND, 52, H[4], 26); c.disc(CX, LAND, 34, H[5], 16)
        rays(c, CX, LAND, 16, 30, 110, H[5], .1, 2)
        holy_cross(c, LAND - 88, 1.0, lit=True)
        return
    t = f - 6   # 0..5
    # shock ring expanding along the ground
    rr = 26 + t * 16
    ring = lambda cc: (cc.ring(CX, LAND, rr, H[4] if t < 2 else H[2], 3 if t < 2 else 2, rr * .22))
    (ring(c) if t < 3 else c.dither(ring, t))
    if t <= 3:
        rays(c, CX, LAND - 66, 12, 20 + t * 4, 60 + t * 12, H[4] if t < 2 else H[2], t * .13)
    for x0, y0, k in MOTES:
        y = (y0 - t * 12) % 128
        if y > LAND or (t >= 4 and k): continue
        c.spark(x0, y, 1 if k else 2, H[5] if k == 0 else H[3])
    if t < 3:
        holy_cross(c, LAND - 88, 1.0, lit=(t == 0))
    elif t < 5:   # the cross dissolves upward into light: dithered and rising
        c.dither(lambda cc: holy_cross(cc, LAND - 88 - (t - 2) * 6, 1.0, False), t)
    else:
        c.dither(lambda cc: cc.rect(CX - 3, 20, CX + 3, LAND - 30, H[3]), t)


# QA 2026-09-28: 칸 경계에서 직선으로 잘리던 가장자리를 디더로 걷는다(fx_edge.py). 그림 수식은 위 draw 그대로.
from fx_edge import fade_edges  # noqa: E402

_draw_body = draw


def draw(c, f):
    _draw_body(c, f)
    # 위쪽 빛 원반은 원래 칸 안에 있다 — 위는 가장자리 한두 줄만 걷고, 아래·좌우 빛 웅덩이를 디더로 걷는다.
    fade_edges(c, T=3, B=10, L=10, R=10)


if __name__ == '__main__':
    make(KEY)

