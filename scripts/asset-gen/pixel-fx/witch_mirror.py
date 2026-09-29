"""거울 장막(시전자 층) — 64px 10칸. 보라 빛가루가 원을 그리며 모이고 → 육각 거울 조각들이 날아와 시전자 둘레에 맞물려 장막이 되며 섬광·광택이 사선으로 쓸고 → 장막이 한 번 맥동해 반사광을 튕긴 뒤 조각이 투명해지며 반짝이만 남음. 가운데는 비워 배틀러가 보인다."""
import math
from lib_druid import *

KEY = 'witch_mirror'; FRAME = 64; FRAMES = 10; ANCHOR = 'user'
PAL = Pal(H=HEX[:6], G=GLASS, W=['#ffffff'], T=TOXIC[3:4])
PEAK = [3, 5, 7]
_r = rng(KEY)
N = 10
SHARDS = [(k * math.tau / N - math.pi / 2, _r.uniform(-1.4, 1.4)) for k in range(N)]
RX, RY, OY = 19, 24, CY - 4


def shard(c, x, y, a, s, lit, shine, dim=False):
    H, G, W = PAL.H, PAL.G, PAL.W
    pts = [(x + math.cos(a + k * math.pi / 3) * 5 * s, y + math.sin(a + k * math.pi / 3) * 5 * s) for k in range(6)]
    c.poly(pts, H[1] if dim else H[2])
    inner = [(lerp(x, px_, .7), lerp(y, py_, .7)) for px_, py_ in pts]
    c.poly(inner, H[2] if dim else (G[1] if lit else G[0]))
    if not dim:
        c.line([inner[3], inner[4]], G[2])
        if shine: c.line([inner[0], inner[3]], W[0]); c.px(x, y, W[0])


def pos(k, f):
    a0, sp = SHARDS[k]
    fly = [0, 1, .5, 0, 0, 0, 0, 0, 0, 0][f]
    a = a0 + sp * fly
    return CX + math.cos(a) * RX * (1 + fly * .8), OY + math.sin(a) * RY * (1 + fly * .5), a


def draw(c, f):
    H, G, W, T = PAL.H, PAL.G, PAL.W, PAL.T
    if f == 0:   # glitter circle
        for k in range(20):
            x, y = orbit(CX, OY, RX + 6, k * math.tau / 20, RY + 6)
            c.px(x, y, H[4] if k % 2 else G[1])
            if k % 5 == 0: c.spark(x, y, 2, G[2], W[0])
        c.ring(CX, GY, 16, H[3], 1, 4)
        return
    pulse = [0, 0, 0, 0, 0, 0, 1, 0, 0, 0][f]
    sweep = [None, None, None, None, -1.3, 0, 1.3, None, None, None][f]
    dim = f >= 8
    def ring(cc):
        for k in sorted(range(N), key=lambda k: math.sin(SHARDS[k][0])):
            x, y, a = pos(k, f)
            if pulse: x, y = orbit(CX, OY, RX + 3, a, RY + 3)
            shine = sweep is not None and abs(math.cos(a) * RX - sweep * 13) < 6
            shard(cc, x, y, a * .5 + f * .1 * (f < 3), 1.0, math.cos(a) < .2, shine, dim)
    if f >= 3 and f <= 7:   # lattice lines join the shards
        for k in range(N):
            x0, y0, _ = pos(k, f); x1, y1, _ = pos((k + 1) % N, f)
            c.line([(x0, y0), (x1, y1)], H[3] if f != 3 else G[1])
    fade(c, f == 9, ring, f)
    if f == 3:   # lock flash
        c.ring(CX, OY, RX + 7, W[0], 1, RY + 7); c.ring(CX, OY, RX + 9, H[4], 1, RY + 9)
        for k in range(N):
            x, y, a = pos(k, f)
            c.spark(*orbit(CX, OY, RX + 7, a + math.pi / N, RY + 7), 2, G[2], W[0])
    if f == 6:   # reflected bolts glance off to the left
        for k, dy in enumerate((-14, -2, 10)):
            x0, y0 = CX - RX - 4, OY + dy
            c.line([(x0, y0), (x0 - 10, y0 - 4 + k * 2), (x0 - 18, y0 - 8 + k * 4)], G[1], 2)
            c.line([(x0, y0), (x0 - 10, y0 - 4 + k * 2)], W[0])
            c.spark(x0, y0, 3, G[2], W[0])
    if f >= 7:   # sparkle rain
        u = f - 7
        for k in range(12):
            a = k * math.tau / 12 + u * .4
            x, y = orbit(CX, OY + u * 5, RX + 2 + (k % 3) * 3, a, RY + (k % 3) * 2)
            if (k + u) % 3 == 0: c.spark(x, y, 1 + (k % 2), G[2] if k % 2 else H[5])
            else: c.px(x, y, G[1] if k % 2 else T[0])


if __name__ == '__main__':
    make(KEY)

