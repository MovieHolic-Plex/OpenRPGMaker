# 빙하기 설원 보정 패스 — 빙벽 앞면 변형 4종(같은 빙벽이 되풀이되지 않게 구간마다 얹는다). 결정적.
#  face_icewall_icicles  : 처마에서 길게 늘어진 고드름 발(가운데가 긴 커튼), 그 밑 녹아 언 물줄기 결, 발치에 떨어진 고드름 조각.
#  face_icewall_crack    : 앞면을 위에서 아래까지 쪼갠 갈지자 큰 균열(속 짙푸름·오른 속벽 밝음), 곁 금, 턱에 낀 눈, 처마의 V 홈, 발치 얼음 부스러기.
#  face_icewall_snowload : 처마 위로 두껍게 얹혀 늘어진 눈 처마 덩이 + 그 밑 그늘, 앞면으로 흘러내린 눈 줄, 턱에 얹힌 눈, 발치의 큰 눈 더미.
#  face_icewall_rubble   : 앞면 한 덩이가 떨어져 나간 흉터(새 얼음 면) + 발치에 쌓인 모난 얼음 덩이(윗면 눈가루·앞면·오른 그늘).
# 모두 glacier_layer 가 그린 빙벽 그림(im)·앞면 마스크·처마(lip)·밑줄(bot) 위에 x0~x1(화소) 구간만 덧그린다. 앞면 칸은 원래 막힘.
import math
import numpy as np
from PIL import Image
from iaf_base import P, hash2, tnoise1, BAY
import iaf_ground as G

SNa = P('snow'); ICa = P('ice'); GLa = P('glac')


def _c(a): return tuple(int(v) for v in a) + (255,)


class _Pen:
    def __init__(s, im, face_m):
        s.im = im; s.px = im.load(); s.W, s.H = im.size; s.f = face_m
    def put(s, x, y, c, face_only=False):
        if 0 <= x < s.W and 0 <= y < s.H and (not face_only or s.f[y, x]): s.px[x, y] = _c(c)
    def get(s, x, y): return s.px[x, y]
    def mul(s, x, y, k):
        if 0 <= x < s.W and 0 <= y < s.H:
            r, g, b, a = s.px[x, y]
            if a: s.px[x, y] = (int(r * k[0]), int(g * k[1]), int(b * k[2]), a)


def _win(x, x0, x1):
    f = (x + 0.5 - x0) / max(1, x1 - x0)
    return max(0.0, math.sin(math.pi * min(1, max(0, f))))


# ================================================================ 고드름 발
def icicles(im, face_m, lip, bot, x0, x1, seed=1):
    p = _Pen(im, face_m)
    # 처마 눈을 한 줄 더 두껍게(무게로 처진 눈) — 아래 가장자리는 둥근 혹
    for x in range(x0, x1):
        L0 = int(lip[x]); add = 1 + int(hash2(x // 3, 1, seed) * 2.2)
        for j in range(4, 4 + add): p.put(x, L0 + j, SNa[5] if j < 3 + add else SNa[3], True)
    x = x0 + 1
    while x < x1 - 1:
        w = _win(x, x0, x1)
        L0 = int(lip[x]) + 5 + int(hash2(x // 3, 1, seed) * 2.2)
        h = int(3 + (hash2(x, 3, seed) ** 1.3) * (6 + 20 * w))
        fat = h > 12
        for j in range(h):
            y = L0 + j
            if y >= int(bot[x]) - 4 or not face_m[y, x]: break
            f = j / max(1, h)
            p.put(x, y, ICa[6] if j < h - 1 else ICa[4])
            if fat and f < 0.55: p.put(x + 1, y, ICa[5]); p.put(x + 2, y, ICa[3] if f < 0.35 else GLa[2])
            elif f < 0.4: p.put(x + 1, y, ICa[4])
            if (fat and f < 0.55): p.mul(x + 3, y + 1, (0.72, 0.76, 0.86))          # 고드름 그림자(오른쪽 아래)
            else: p.mul(x + 2 if f < 0.4 else x + 1, y + 1, (0.78, 0.82, 0.9))
        if h > 7:                                                                  # 끝에 맺힌 물방울
            p.put(x, L0 + h + 1, ICa[5]) if L0 + h + 1 < int(bot[x]) - 4 else None
        # 고드름 밑 녹아 언 물줄기(앞면 위 옅은 세로 결)
        if fat:
            for y in range(L0 + h + 2, int(bot[x]) - 6):
                if hash2(x, y // 5, seed + 2) > 0.45: p.put(x, y, GLa[5] if (y // 5) % 2 else GLa[4], True)
        x += (3 if fat else 2) + int(hash2(x, 5, seed) * 2)
    # 발치에 떨어진 고드름 조각(밝은 짧은 막대)
    for i in range(max(2, (x1 - x0) // 9)):
        bx = x0 + 3 + int(hash2(i, 7, seed) * max(1, x1 - x0 - 6)); by = int(bot[min(bx, len(bot) - 1)]) - 2 - int(hash2(i, 8, seed) * 4)
        L = 2 + int(hash2(i, 9, seed) * 3); d = 1 if hash2(i, 10, seed) > 0.5 else -1
        for k in range(L): p.put(bx + k, by + d * (k // 2), ICa[6] if k < L - 1 else ICa[4])
        p.put(bx, by + 1, SNa[3])


# ================================================================ 큰 균열
def crack(im, face_m, lip, bot, x0, x1, seed=1):
    """위가 넓게 벌어지고 아래로 가늘어지는 갈지자 균열. 속은 짙푸른 깊이(가장자리 한 단 밝다), 오른 속벽(서쪽을 봐 밝다)이 보인다."""
    p = _Pen(im, face_m)
    cx = (x0 + x1) / 2.0
    top = int(lip[int(cx)]) + 3; b = int(bot[int(cx)]) - 3
    x = cx; path = []
    for y in range(top, b):
        f = (y - top) / max(1, b - top)
        if y % 2 == 0 and hash2(y // 2, 1, seed) > 0.5:
            x += -1 if hash2(y, 2, seed) > 0.45 else 1
        if y % 11 == 6 and hash2(y // 11, 3, seed) > 0.4: x += 2 if hash2(y, 4, seed) > 0.5 else -2
        x = max(x0 + 7, min(x1 - 8, x))
        w = 1 + int(round(7.5 * (1 - f) ** 0.9 + (hash2(y // 2, 5, seed) - 0.5) * 1.4))
        el = int(round((hash2(y // 2, 6, seed) - 0.5) * 1.6)); er = int(round((hash2(y // 2, 7, seed) - 0.5) * 1.6))
        path.append((int(x), y, max(1, w), el, er))
    for (xx, y, w, el, er) in path:
        xl = xx - w // 2 + el; xr = max(xl + 1, xx + (w - w // 2) + er)
        p.put(xl - 1, y, GLa[5])                                                   # 왼쪽 바깥 입술(빛 받음)
        for k in range(xl, xr):
            d = min(k - xl, xr - 1 - k)
            p.put(k, y, GLa[0] if d >= 1 or xr - xl <= 2 else GLa[1])
        wi = xr - xl
        if wi >= 4: p.put(xr - 1, y, GLa[3]); p.put(xr - 2, y, GLa[2])               # 오른 속벽
        elif wi >= 3: p.put(xr - 1, y, GLa[2])
        p.put(xr, y, GLa[2])                                                       # 오른쪽 바깥(그늘)
    # 처마가 균열 위에서 V 로 끊긴다(눈 처마 사이 틈, 양쪽 눈은 둥글게 처진다)
    xt, _, wt, _, _ = path[0]
    for j in range(0, 4):
        half = wt // 2 + 1 - j // 2
        for dx in range(-half, half + 1): p.put(xt + dx, top - 3 + j, GLa[1] if j < 2 else GLa[0], True)
    for sgn in (-1, 1):
        ex = xt + sgn * (wt // 2 + 2)
        for j in range(4): p.put(ex, top - 3 + j, SNa[6] if sgn < 0 else SNa[4])
    # 곁 금(가는 사선 1px + 아래 밝은 턱)
    for i in range(6):
        k = int(hash2(i, 5, seed) * (len(path) * 0.7)) + 4
        xx, y, w, el, er = path[k]
        d = 1 if hash2(i, 6, seed) > 0.5 else -1; L = 5 + int(hash2(i, 7, seed) * 9)
        sx = xx + ((w - w // 2) + er + 1 if d > 0 else -w // 2 + el - 2)
        dy = 1 if hash2(i, 8, seed) > 0.4 else -1
        for j in range(L):
            X_ = sx + d * j; Y_ = y + (j // 2) * dy
            if not (0 <= Y_ < face_m.shape[0] and 0 <= X_ < face_m.shape[1]) or not face_m[Y_, X_]: break
            p.put(X_, Y_, GLa[1]); p.put(X_, Y_ + 1, GLa[5], True)
    # 틈에 낀 눈 한 줌(위쪽 넓은 곳)
    xx, y, w, el, er = path[len(path) // 4]
    for dx in range(-1, 2): p.put(xx + dx, y, SNa[6] if dx < 1 else SNa[5]); p.put(xx + dx, y + 1, SNa[3])
    # 발치 얼음 부스러기(모난 덩이 무더기)
    for i in range(8):
        bx = int(cx - 10 + hash2(i, 11, seed) * 20); by = int(bot[max(0, min(len(bot) - 1, bx))]) - int(hash2(i, 12, seed) * 4)
        r = 1 + int(hash2(i, 13, seed) * 3)
        for yy in range(by - r, by + 1):
            for xx in range(bx - r - 1, bx + r + 1):
                t = 6 if yy == by - r else (4 if xx < bx else 3)
                if xx == bx + r: t = 2
                if yy == by: t = min(t, 2)
                p.put(xx, yy, GLa[t] if t < 6 else ICa[6])


# ================================================================ 눈 얹힘
def snowload(im, face_m, lip, bot, x0, x1, seed=1):
    p = _Pen(im, face_m)
    n1 = tnoise1(max(16, x1 - x0 + 16), 5, seed)
    # 처마 위·아래로 두껍게 얹혀 처진 눈(아래 가장자리 둥근 혹 · 그 밑 2px 그늘)
    for x in range(x0, x1):
        w = _win(x, x0, x1)
        L0 = int(lip[x]); up = 2 + int(w * 3)
        th = int(4 + w * 6 + (n1[x - x0] - 0.5) * 5 + math.sin(x / 2.3) * 1.2)
        for y in range(L0 - up, L0 + th):
            j = y - (L0 - up)
            c = SNa[6] if j < 2 else (SNa[5] if y < L0 + th - 2 else SNa[4])
            p.put(x, y, c)
        p.put(x, L0 + th, SNa[3])
        for k in (1, 2): p.mul(x, L0 + th + k, (0.70, 0.74, 0.86) if k == 1 else (0.84, 0.86, 0.93))
    # 흘러내린 눈 줄(처마 밑에서 아래로, 끝이 가늘다)
    for i in range(max(2, (x1 - x0) // 10)):
        sx = x0 + 3 + int(hash2(i, 3, seed) * max(1, x1 - x0 - 6))
        L0 = int(lip[sx]) + int(4 + _win(sx, x0, x1) * 6) + 2
        L = 6 + int(hash2(i, 4, seed) * 18)
        for j in range(L):
            y = L0 + j
            if y >= int(bot[sx]) - 2: break
            wd = 2 if j < L * 0.5 else 1
            for k in range(wd): p.put(sx + k, y, SNa[5] if k == 0 else SNa[4], True)
    # 턱에 얹힌 눈(가로 혹 줄 2개)
    for i in range(max(3, (x1 - x0) // 9)):
        kk = 0.30 + hash2(i, 4, seed + 1) * 0.42
        sx = x0 + int(hash2(i, 5, seed) * max(1, x1 - x0 - 8)); L = 4 + int(hash2(i, 6, seed) * 9)
        yb = lip[sx] + (bot[sx] - lip[sx]) * kk
        for x in range(sx, min(x1, sx + L)):
            f = (x - sx) / max(1, L - 1); hgt = 1 + int(2.2 * math.sin(math.pi * f))
            y = int(yb + (x - sx) * 0.12)
            for j in range(hgt): p.put(x, y - j, SNa[6] if j == hgt - 1 else SNa[5], True)
            p.put(x, y + 1, GLa[1], True)
    # 발치 큰 눈 더미(앞면 아래 8~16px 를 덮는다, 윗줄 밝고 앞 그늘)
    for x in range(x0, x1):
        w = _win(x, x0, x1)
        h = int(5 + w * 11 + (n1[(x - x0 + 7) % len(n1)] - 0.5) * 4)
        b = int(bot[x])
        for j in range(h):
            y = b - 1 - j
            if y < 0 or not face_m[y, x]: continue
            c = SNa[6] if j >= h - 1 else (SNa[5] if j > h * 0.45 else (SNa[4] if (j > 1 or BAY[y % 4, x % 4] > 0.4) else SNa[3]))
            p.put(x, y, c)


# ================================================================ 무너진 얼음 덩이
def rubble(im, face_m, lip, bot, x0, x1, seed=1):
    p = _Pen(im, face_m)
    cx = (x0 + x1) // 2
    rs = np.random.default_rng(seed)
    # 무너진 처마: 가운데 구간의 앞면 윗부분이 떨어져 나가 처마선이 내려앉았다 — 그 자리는 빙하 윗면 눈,
    # 새 가장자리는 눈 1px + 깨진 맑은 얼음 2~3px(모난 턱), 고드름·처마 눈 없음
    xa, xb = x0 + (x1 - x0) // 5, x1 - (x1 - x0) // 5
    n1 = tnoise1(max(16, xb - xa + 16), 3, seed + 3)
    for x in range(xa, xb):
        w = _win(x, xa, xb)
        xq = xa + ((x - xa) // 3) * 3                                                # 3px 마다 꺾이는 모난 턱
        drop = int(5 + 18 * _win(xq, xa, xb) ** 0.7 + (n1[xq - xa] - 0.5) * 5)
        L0 = int(lip[x]) - 1
        for y in range(L0, L0 + drop):
            t = 5 if hash2(x, y, seed + 4) > 0.12 else 4
            if y == L0 + drop - 1: t = 6
            p.put(x, y, SNa[t])
        e = L0 + drop
        th = 2 + (1 if hash2(x // 3, 2, seed) > 0.5 else 0)
        for j in range(th): p.put(x, e + j, GLa[6] if j == 0 else GLa[5])
        p.put(x, e + th, GLa[2])
    # 발치 모난 덩이(뒤 → 앞, 윗면 눈가루 · 앞면 · 오른 그늘 · 윤곽)
    blocks = []
    for i in range(6):
        bw = int(rs.integers(8, 15)); bh = int(rs.integers(5, 9)); dt = int(rs.integers(3, 5))
        bx = int(cx - (x1 - x0) * 0.28 + rs.random() * (x1 - x0) * 0.56 - bw / 2)
        back = i < 3
        by = int(bot[max(0, min(len(bot) - 1, bx + bw // 2))]) + (- int(rs.integers(1, 3)) if back else int(rs.integers(2, 5)))
        sk = int(rs.integers(-2, 3))                                               # 기운 윗면
        blocks.append((by, bx, bw, bh, dt, sk))
    for (by, bx, bw, bh, dt, sk) in sorted(blocks):
        y0 = by - bh - dt
        for x in range(bx, bx + bw):
            yt = y0 + int(round(sk * (x - bx) / max(1, bw - 1)))
            for y in range(yt, by + 1):
                first = (x == bx or x == bx + bw - 1)
                if first and (y == yt or y == by): continue
                if y == yt or y == by or first: c = GLa[0]
                elif y < yt + dt + 1: c = SNa[6] if (x - bx) < bw * 0.55 else (SNa[5] if (x - bx) < bw * 0.8 else ICa[5])
                elif y == yt + dt + 1: c = GLa[5]
                elif x >= bx + bw - 3: c = GLa[2]
                else: c = GLa[4] if y < by - bh * 0.45 else GLa[3]
                p.put(x, y, c)
        for x in range(bx + 2, bx + bw + 2): p.mul(x, by + 1, (0.74, 0.78, 0.88))


MODS = {'icicles': icicles, 'crack': crack, 'snowload': snowload, 'rubble': rubble}


def face_variant_sample(kind, seed=113):
    """빙벽 앞면 변형 표본(4x7칸 = 64x112): 빙하 윗면 1줄 + 앞면 5줄 + 발치 눈 1줄, 가운데에 변형을 얹는다."""
    gl, fm, tm, lip, bot = G.glacier_layer([0, 0, 0, 0], [5, 5, 5, 5], 4, seed=seed)
    MODS[kind](gl, fm, lip, bot, 2, 62, seed=seed + 5)
    base = Image.new('RGBA', (64, 112))
    g = G.ground_snow()
    for y in (0, 48, 96):
        for x in (0, 48): base.alpha_composite(g.crop((0, 0, min(48, 64 - x), min(48, 112 - y))), (x, y))
    base.alpha_composite(gl.crop((0, 0, 64, 112)), (0, 0))
    return base
