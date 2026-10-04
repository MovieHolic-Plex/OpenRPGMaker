"""매직 미사일 착탄 — 64px 8칸. 세 발이 시차를 두고 박힌다: 별 섬광 + 고리 + 결정 파편."""
import math, random
from lib_mage import *

KEY = 'mage_missile_hit'; FRAME = 64; FRAMES = 8; ANCHOR = 'target'
PAL = Pal(A=ARCANE)
PEAK = [1, 4, 6]
HITS = [(0, 24, 36, 1.0), (2, 40, 44, 1.0), (4, 32, 38, 1.5)]   # start frame, x, y, size
_r = random.Random(7)
SHARDS = [[(_r.uniform(0, math.tau), _r.uniform(2.5, 5)) for _ in range(7)] for _ in HITS]


def hit(c, t, x, y, s, shards):
    A = PAL.A
    if t < 0: return
    if t == 0:  # streak arriving from the right + first contact
        c.line([(x + 18, y - 8), (x + 2, y - 1)], A[3], 2); c.line([(x + 14, y - 6), (x, y)], A[5])
        c.glow(x, y, 5 * s, [A[2], A[4], A[5]])
        return
    if t == 1:  # peak: big star
        c.glow(x, y, 7 * s, [A[1], A[3], A[4], A[5]])
        for k in range(4):
            a = k * math.pi / 2
            x1, y1 = orbit(x, y, 13 * s, a); nx, ny = -math.sin(a) * 2 * s, math.cos(a) * 2 * s
            c.poly([(x + nx, y + ny), (x1, y1), (x - nx, y - ny)], A[4])
        c.spark(x, y, 5 * s, A[5], diag=True)
        c.ring(x, y, 9 * s, A[6])
        return
    # afterglow: ring grows and thins, shards fly and dim
    # QA: 큰 착탄(s=1.5)의 잔광 고리가 반경 28 을 넘어 칸 아래·좌우에서 잘렸다 — 칸 안에 들어오는 반경으로 누른다.
    r = min((9 + t * 5) * s, 63 - y - 1, x - 1, 63 - x - 1, 25)
    if t <= 3:
        ringf = lambda cc: cc.ring(x, y, r, A[6] if t == 2 else A[2], 2 if t == 2 else 1)
        (ringf(c) if t == 2 else c.dither(ringf, t))
    for a, v in shards:
        d = v * (t + 1) * s
        px, py = orbit(x, y, d, a)
        if t <= 4:
            tx, ty = orbit(x, y, d - 3, a)
            c.line([(tx, ty), (px, py)], A[7] if t <= 2 else A[3])
            if t <= 2: c.px(px, py, A[5])
    if t <= 3: c.disc(x, y, 3 - t * .7, A[4])
    if 2 <= t <= 5: c.spark(x + (t - 2) * 3, y - 4 - t * 2, max(0, 3 - (t - 2)), A[4] if t < 4 else A[2])


def draw(c, f):
    for (start, x, y, s), sh in zip(HITS, SHARDS):
        hit(c, f - start, x, y, s, sh)
    A = PAL.A
    if f == 5:  # the third, larger hit throws a violet shock ring
        # QA: 반경 24 고리(중심 y38)가 칸 아래에서 잘렸다 — 가로는 그대로, 세로를 칸 안(≤62)으로 누른다.
        c.ring(32, 38, 24, A[3], 2, ry=22); c.ring(32, 38, 20, A[1], 1, ry=18)
    if f == 7:
        c.dither(lambda cc: cc.ring(32, 38, 28, A[1], 1, ry=23), 1)
        for k in range(5): c.px(18 + k * 7, 20 - (k % 2) * 4, A[4])


# QA 2026-09-28: 칸 경계에서 직선으로 잘리던 가장자리를 디더로 걷는다(fx_edge.py). 그림 수식은 위 draw 그대로.
from fx_edge import fade_edges  # noqa: E402

_draw_body = draw


def draw(c, f):
    _draw_body(c, f)
    fade_edges(c, B=3)


if __name__ == '__main__':
    make(KEY)

