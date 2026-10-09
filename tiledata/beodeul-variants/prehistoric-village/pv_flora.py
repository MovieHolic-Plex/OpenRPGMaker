# 원시 숲: 나무고사리(큰·작은), 소철(큰·어린), 땅고사리(큰 포기·작은 포기), 속새, 부들, 거대 공룡 뼈(등뼈·갈비·머리뼈),
# 뿔 달린 머리뼈, 거대 딱정벌레 빈 껍질, 징검돌 둘. 3/4 시점, 빛 왼쪽 위. 잎은 버들항 잎 램프(leaf), 소철은 새 cycad 램프.
from pv_base import *


# ---------------------------------------------------------------- 깃꼴 잎 한 장(채운 모양: 가장자리 톱니, 가운데 잎줄, 윗면 밝음)
def frond(c, x0, y0, ang, L, w0, lift, droop, mat='leaf', tone_bias=0, notch=2, seed=1, rigid=False):
    """(x0,y0)에서 화면 각도 ang(라디안, 0=오른쪽, +=아래)로 길이 L. lift=처음 들림, droop=끝 처짐(화소).
    톱니: notch 화소마다 폭이 줄어든다. 잎줄은 한 단 밝다. tone_bias: 뒤 잎 -1~-2, 앞 잎 +0~+1."""
    c.new()
    dx, dy = math.cos(ang), math.sin(ang) * 0.55
    nx, ny = -dy, dx
    nn = math.hypot(nx, ny) or 1; nx /= nn; ny /= nn
    steps = int(L * 2.2) + 2
    pts = []
    for i in range(steps + 1):
        t = i / steps
        x = x0 + dx * L * t
        y = y0 + dy * L * t - lift * 4 * t * (1 - t) + droop * t * t
        pts.append((x, y, t))
    for i, (x, y, t) in enumerate(pts):
        w = w0 * (math.sin(math.pi * min(1.0, 0.12 + t * 0.95)) ** (0.9 if rigid else 0.6)) * (1 - 0.35 * t)
        k = int(t * L / notch)
        if k % 2 == 1: w *= (0.55 if not rigid else 0.35)
        for s in np.arange(-w, w + 0.01, 0.5):
            xx = int(round(x + nx * s)); yy = int(round(y + ny * s))
            up = s * ny < 0            # 잎의 위쪽 반(화면 위를 향한 쪽)
            tt = 4 + tone_bias + (1 if up else -1)
            if abs(s) < 0.6: tt = 5 + tone_bias          # 잎줄
            if t > 0.85: tt -= 1
            c.tone(xx, yy, mat, max(1, min(6, tt)))


def _scaly_trunk(c, cx, y0, y1, r0, r1, mat='bark', seed=1, pine=False):
    """비늘 줄기: 잎 떨어진 자국이 마름모로 엇갈린다(왼쪽 밝음). pine=True 면 소철의 굵은 비늘."""
    c.new()
    for y in range(int(y0), int(y1) + 1):
        f = (y - y0) / max(1, (y1 - y0))
        r = r0 + (r1 - r0) * f
        for x in range(int(cx - r) - 1, int(cx + r) + 2):
            u = (x + 0.5 - cx) / r
            if abs(u) > 1: continue
            t = 5 if u < -0.35 else (4 if u < 0.25 else (3 if u < 0.7 else 2))
            p = 4 if pine else 3
            a = (x + y) % p; b = (x - y) % p
            if a == 0 or b == 0: t -= 1                    # 비늘 틈
            elif pine and a == 1 and b == 1: t += 1          # 비늘 가운데 볼록
            c.tone(x, y, mat, max(1, min(6, t)))


def _dead_skirt(c, cx, y, r, n, seed):
    """나무고사리 수관 밑에 처진 마른 잎(갈색 치마)."""
    for i in range(n):
        a = math.pi * (0.1 + 0.8 * i / max(1, n - 1))
        x0 = cx + math.cos(a) * r * 0.6; L = 7 + H(i, seed) * 5
        c.new()
        for j in range(int(L)):
            x = int(round(x0 + math.cos(a) * j * 0.25)); yy = int(y + j)
            c.tone(x, yy, 'hide2', 3 if j < L * 0.6 else 2)
            if j % 2 == 0: c.tone(x + (1 if math.cos(a) > 0 else -1), yy, 'hide2', 2)


def tree_fern(W=48, Hh=80, cx=24, base=78, top=28, L=20, n=11, seed=1001, r0=2.6, r1=3.4):
    c = C(W, Hh, seed=seed); c.shadow(cx + 3, base - 1, 9, 2.4, 100)
    c.group(1); _scaly_trunk(c, cx, top + 2, base - 2, r0, r1, 'bark', seed)
    c.new()                                                                 # 밑동 뿌리 덩이
    for y in range(base - 4, base + 1):
        for x in range(int(cx - r1 - 3), int(cx + r1 + 4)):
            dx = (x + 0.5 - cx) / (r1 + 3); dy = (y + 0.5 - (base - 1)) / 3.0
            if dx * dx + dy * dy <= 1 and c.m[y][x] is None or (dx * dx + dy * dy <= 1 and y > base - 3): c.tone(x, y, 'bark', 4 if dx < 0 else 2)
    c.group(2); _dead_skirt(c, cx, top + 3, 8, 6, seed + 3)
    # 잎: 뒤(위쪽으로 뻗는 것) 먼저 어둡게, 앞(아래로 늘어지는 것) 나중에 밝게
    c.group(3)
    angs = [(-math.pi / 2 + (i / n) * 2 * math.pi + (H(i, seed) - 0.5) * 0.4) for i in range(n)]
    for k, a in sorted(enumerate(angs), key=lambda t: math.sin(t[1])):
        front = math.sin(a)
        Lk = L * (0.82 + H(k, seed, 1) * 0.3)
        tb = -2 if front < -0.4 else (-1 if front < 0.2 else 0)
        frond(c, cx, top, a, Lk, 3.0, lift=4 + 2 * (front < 0), droop=7 + 4 * (front > 0), tone_bias=tb, seed=seed + k)
    c.group(4); c.new()
    for (dx, dy) in ((-1, -1), (0, -1), (1, -1), (-1, 0), (0, 0), (1, 0), (0, 1)): c.tone(cx + dx, top + dy, 'leaf', 6)   # 새순 고리
    c.tone(cx - 1, top - 2, 'leaf', 5); c.tone(cx + 1, top - 2, 'leaf', 4)
    im = F(c, 0.7); px = im.load()
    tufts(px, W, Hh, int(cx - 8), int(cx + 9), base, seed + 9, 0.5, 3)
    return im


def tree_fern_tall(): return tree_fern()
def tree_fern_short(): return tree_fern(48, 56, 24, 54, 22, 18, 10, 1011, 2.4, 3.0)


def cycad(W=48, Hh=48, cx=24, base=46, top=26, L=17, n=12, seed=1021, r=5.6):
    c = C(W, Hh, seed=seed); c.shadow(cx + 3, base - 1, 10, 2.6, 100)
    c.group(1); _scaly_trunk(c, cx, top + 1, base - 1, r * 0.85, r, 'bark', seed, pine=True)
    c.group(3)
    angs = [(-math.pi / 2 + (i / n) * 2 * math.pi + (H(i, seed) - 0.5) * 0.3) for i in range(n)]
    for k, a in sorted(enumerate(angs), key=lambda t: math.sin(t[1])):
        front = math.sin(a)
        tb = -2 if front < -0.4 else (-1 if front < 0.2 else 0)
        frond(c, cx, top, a, L * (0.85 + H(k, seed) * 0.25), 2.6, lift=6 + 3 * (front < 0), droop=3 + 2 * (front > 0),
              mat='cycad', tone_bias=tb, notch=1, seed=seed + k, rigid=True)
    c.group(4); c.new(); c.ellipsoid(cx, top - 1, 3.4, 3.0, 'clay', amb=0.3, bias=-0.05, bump=0.3)          # 가운데 솔방울
    for (dx, dy) in ((-1, -2), (1, -1), (0, 0), (-2, 0)): c.tone(cx + dx, top - 1 + dy, 'gold', 5)
    im = F(c, 0.7); px = im.load()
    tufts(px, W, Hh, int(cx - 9), int(cx + 10), base, seed + 9, 0.5, 3)
    return im


def cycad_large(): return cycad()
def cycad_young(): return cycad(32, 32, 16, 30, 19, 11, 9, 1031, 3.6)


def fern_clump():
    W, Hh = 32, 24
    c = C(W, Hh, seed=1041); c.shadow(16, 21, 13, 2.2, 80)
    n = 8
    for k, a in sorted(enumerate([math.pi * (1.05 + i / (n - 1) * 0.9) + (H(i, 1041) - 0.5) * 0.2 for i in range(n)] +
                                 [math.pi * 0.25, math.pi * 0.75]), key=lambda t: math.sin(t[1])):
        front = math.sin(a)
        frond(c, 16, 19, a, 12 + H(k, 1042) * 3, 2.4, lift=5, droop=6 + 3 * (front > 0), tone_bias=(-1 if front < 0 else 0), seed=1043 + k)
    return F(c, 0.7)


def fern_small():
    W, Hh = 16, 16
    c = C(W, Hh, seed=1051)
    for k, a in enumerate((math.pi * 1.15, math.pi * 1.5, math.pi * 1.85, math.pi * 0.3, math.pi * 0.7)):
        frond(c, 8, 13, a, 7, 1.6, lift=3, droop=3, tone_bias=(-1 if math.sin(a) < 0 else 0), notch=1, seed=1052 + k)
    return F(c, 0.7)


def horsetail():
    W, Hh = 16, 32
    c = C(W, Hh, seed=1061)
    for k, (x, h) in enumerate(((4, 22), (7, 27), (10, 20), (12, 24), (6, 16))):
        c.new()
        top = 30 - h
        for y in range(top, 31):
            t = 4 if k % 2 == 0 else 3
            if (y - top) % 4 == 0: t = 1                                     # 마디
            c.tone(x, y, 'leaf', t); c.tone(x + 1, y, 'leaf', max(1, t - 1)) if k == 1 else None
            if (y - top) % 4 == 1 and y < 28:                                # 마디 돌림 잎
                c.tone(x - 1, y, 'leaf', 3); c.tone(x + 1, y, 'leaf', 2)
        c.tone(x, top - 1, 'hide', 4); c.tone(x, top - 2, 'hide', 5); c.tone(x, top - 3, 'hide', 4)    # 포자 이삭
    return F(c, 0.75)


def reeds():
    W, Hh = 16, 32
    c = C(W, Hh, seed=1071)
    for k, (x, h, lean) in enumerate(((3, 18, -1), (6, 26, 0), (9, 22, 1), (12, 15, 1), (8, 12, 0))):
        c.new()
        for j in range(h):
            xx = x + (lean if j > h * 0.6 else 0); y = 30 - j
            c.tone(xx, y, 'leaf', 4 if k % 2 else 5)
        if k in (1, 2):                                                       # 부들 이삭(갈색 원통)
            xx = x + (lean if True else 0)
            for j in range(5): c.tone(xx, 30 - h + 1 + j, 'bark', 5 if j < 2 else 4); c.tone(xx + 1, 30 - h + 1 + j, 'bark', 3)
            c.tone(xx, 30 - h, 'leaf', 4)
    c.new()                                                                   # 넓은 잎 둘
    for j in range(10): c.tone(2 + j // 3, 30 - j, 'leaf', 3); c.tone(13 - j // 4, 30 - j, 'leaf', 4)
    return F(c, 0.75)


# ---------------------------------------------------------------- 거대 공룡 뼈: 반쯤 흙에 묻힌 등뼈 활 + 갈비 + 긴 머리뼈
def _bone_seg(c, x, y, r, mat='ivory', bias=0.0):
    c.new(); c.ellipsoid(x, y, r, r * 0.85, mat, amb=0.3, bias=bias, bump=0.25)


def dino_skeleton():
    W, Hh = 96, 48
    c = C(W, Hh, seed=1101); c.shadow(48, 42, 44, 4.0, 90)
    # 흙 둔덕(뼈가 박힌 자리)
    c.group(0); c.new()
    for y in range(28, 47):
        for x in range(2, 94):
            dx = (x + 0.5 - 46) / 44.0; dy = (y + 0.5 - 39) / 7.5
            wob = (vnoise(x, y, 4.0, 1102) - 0.5) * 0.35
            if dx * dx + dy * dy + wob <= 1: c.setv(x, y, 'dirt', 0.66 - 0.18 * dx - 0.22 * dy)
    # 등뼈: 꼬리(왼쪽 낮음) → 엉덩이(높음) → 목(오른쪽으로 내려간다). 척추 마디 + 위로 솟은 가시돌기
    spine = []
    for i in range(30):
        f = i / 29.0
        x = 8 + f * 66
        y = 38 - math.sin(min(1.0, f * 1.25) * math.pi) * 22 + (f > 0.8) * (f - 0.8) * 30
        spine.append((x, y, f))
    # 갈비(뒤쪽 갈비 먼저 어둡게, 앞쪽 나중에 밝게): 등뼈 가운데 마디에서 아래로 휘어 흙에 박힌다
    for side, bias, grp in ((-1, -0.25, 1), (1, 0.05, 3)):
        c.group(grp)
        for k in range(8):
            sx, sy, f = spine[9 + k * 2]
            c.new()
            L = 16 - abs(k - 3.5) * 1.6
            for j in range(int(L * 2)):
                t = j / (L * 2)
                x = sx + side * math.sin(t * math.pi * 0.9) * 6 + t * 3
                y = sy + t * L * 1.05
                if y > 41: break
                c.setv(int(round(x)), int(round(y)), 'ivory', 0.8 + bias - 0.3 * t)
                c.setv(int(round(x)) + 1, int(round(y)), 'ivory', 0.55 + bias - 0.3 * t)
    c.group(2)
    for (x, y, f) in spine:
        r = 2.2 - abs(f - 0.45) * 1.4
        _bone_seg(c, x, y, max(1.1, r))
        if 0.15 < f < 0.8:                                                     # 가시돌기
            hgt = int(3 + math.sin(f * math.pi) * 3)
            c.new()
            for j in range(hgt): c.tone(int(x), int(y - r - j), 'ivory', 5 if j < hgt - 1 else 6); c.tone(int(x) + 1, int(y - r - j), 'ivory', 3)
    # 머리뼈(오른쪽 끝, 땅에 비스듬히 놓였다): 긴 주둥이 + 아래턱 + 이빨 + 눈구멍
    c.group(4); c.new()
    sx, sy = 76, 36
    for y in range(sy - 6, sy + 6):
        for x in range(sx - 2, sx + 18):
            u = (x - (sx - 2)) / 20.0
            hh = 5.5 * (1 - 0.55 * u)
            cyy = sy - 1 + u * 2
            if abs(y + 0.5 - cyy) <= hh:
                v = 0.88 - 0.35 * (y + 0.5 - cyy) / hh - 0.15 * u
                c.setv(x, y, 'ivory', v)
    for (x, y) in ((79, 32), (80, 32), (81, 32), (79, 33), (80, 33), (81, 33), (80, 31)): c.tone(x, y, 'dark', 1)    # 눈구멍
    for (x, y) in ((86, 33), (87, 33), (88, 34), (85, 34)): c.tone(x, y, 'dark', 2)                                   # 앞 구멍
    for x in range(78, 94, 2): c.tone(x, 38 + (x - 78) // 8, 'ivory', 6); c.tone(x, 39 + (x - 78) // 8, 'dark', 1)    # 이빨 줄
    c.new()
    for x in range(76, 92):                                                    # 아래턱(살짝 벌어짐)
        y = 40 + (x - 76) // 6
        c.tone(x, y, 'ivory', 4); c.tone(x, y + 1, 'ivory', 2)
    # 흙에 반쯤 묻힌 자리: 뼈 밑동을 흙 색으로 덮고 잔돌·잔풀
    im = F(c); px = im.load()
    for x in range(4, 92):
        for y in range(40, 46):
            p = get(px, W, Hh, x, y)
            if p[3] and H(x, y, 1103) > 0.55 and y > 41: put(px, W, Hh, x, y, mul(RGB('dirt', 4), 0.9 + H(x, y, 1104) * 0.2))
    tufts(px, W, Hh, 2, 94, 45, 1105, 0.4, 3)
    return im


def horned_skull():
    """세 뿔 머리뼈: 뒤로 펼친 목 주름판(구멍 둘) + 이마 뿔 둘(앞으로 휜다) + 코뿔 + 부리. 땅에 놓였다."""
    W, Hh = 48, 32
    c = C(W, Hh, seed=1111); c.shadow(24, 28, 20, 2.8, 100)
    c.group(1); c.new()                                                        # 주름판(부채꼴, 뒤)
    for y in range(3, 24):
        for x in range(4, 44):
            dx = (x + 0.5 - 24) / 19.0; dy = (y + 0.5 - 22) / 18.0
            if dx * dx + dy * dy <= 1 and y < 22:
                v = 0.72 - 0.3 * dx - 0.15 * (1 - dy)
                # 가장자리 혹 줄
                if dx * dx + dy * dy > 0.82 and int(math.atan2(dy, dx) * 9) % 2 == 0: v += 0.15
                c.setv(x, y, 'ivory', v)
    for (hx_, hy_) in ((15, 12), (32, 12)):                                    # 주름판 구멍
        for y in range(hy_ - 2, hy_ + 3):
            for x in range(hx_ - 3, hx_ + 4):
                if ((x + 0.5 - hx_) / 3.2) ** 2 + ((y + 0.5 - hy_) / 2.4) ** 2 <= 1: c.tone(x, y, 'dark', 1 if y > hy_ - 1 else 2)
    c.group(2); c.new()                                                        # 얼굴 뼈(앞으로 좁아지는 쐐기)
    for y in range(13, 29):
        f = (y - 13) / 15.0
        r = 9 * (1 - 0.6 * f)
        for x in range(int(24 - r) - 1, int(24 + r) + 2):
            u = (x + 0.5 - 24) / max(0.8, r)
            if abs(u) <= 1: c.setv(x, y, 'ivory', 0.88 - 0.4 * (u + 1) / 2 - 0.1 * f)
    for (x, y) in ((19, 17), (20, 17), (19, 18), (28, 17), (29, 17), (29, 18)): c.tone(x, y, 'dark', 1)      # 눈구멍
    for (x, y) in ((23, 25), (25, 25)): c.tone(x, y, 'dark', 2)
    c.group(3)                                                                  # 이마 뿔 둘(앞·위로 휜 원뿔)
    for sgn in (-1, 1):
        c.new()
        for i in range(14):
            f = i / 13.0; x = 24 + sgn * (5 + f * 6); y = 15 - f * 12 + f * f * 4
            r = 1.8 * (1 - f) + 0.4
            for yy in range(int(y - r) - 1, int(y + r) + 2):
                for xx in range(int(x - r) - 1, int(x + r) + 2):
                    if math.hypot(xx + 0.5 - x, yy + 0.5 - y) <= r: c.tone(xx, yy, 'ivory', (5 if xx < x else 3) + (1 if f > 0.8 else 0))
    c.new()
    for j in range(5): c.tone(24, 24 - j, 'ivory', 5); c.tone(25, 24 - j, 'ivory', 3)       # 코뿔
    c.new()                                                                     # 부리 끝
    for (x, y) in ((23, 29), (24, 29), (25, 29), (24, 30)): c.tone(x, y, 'ivory', 3)
    im = F(c); px = im.load(); tufts(px, W, Hh, 2, 46, 30, 1112, 0.45, 3)
    return im


def beetle_husk():
    """거대 딱정벌레 빈 껍질: 반들거리는 겉날개(가운데 갈라진 줄·광택 띠), 앞가슴판, 큰턱, 꺾인 다리. 위에서 비스듬히."""
    W, Hh = 32, 32
    c = C(W, Hh, seed=1121); c.shadow(17, 28, 13, 2.4, 100)
    c.group(1)                                                                  # 다리(몸 밑에서 나온 꺾인 마디)
    for (x0, y0, x1, y1, x2, y2) in ((9, 14, 3, 12, 1, 16), (9, 19, 2, 21, 2, 26), (10, 24, 5, 28, 4, 30),
                                     (23, 14, 29, 12, 31, 16), (23, 19, 30, 21, 30, 26), (22, 24, 27, 28, 28, 30)):
        c.new(); c.line(x0, y0, x1, y1, 'shell', 2); c.line(x1, y1, x2, y2, 'shell', 1)
    c.group(2); c.new()                                                         # 겉날개
    for y in range(11, 30):
        for x in range(6, 27):
            dx = (x + 0.5 - 16) / 10.0; dy = (y + 0.5 - 20) / 9.6
            if dx * dx + dy * dy <= 1:
                v = 0.62 - 0.3 * dx - 0.2 * dy
                c.setv(x, y, 'shell', v)
    for y in range(11, 30): c.tone(16, y, 'shell', 1) if c.m[y][16] else None                # 가운데 갈라진 줄
    for (x, y) in ((10, 15), (10, 16), (11, 14), (12, 14), (20, 15), (20, 16), (21, 15), (9, 18), (19, 18)): c.tone(x, y, 'shell', 6)   # 광택
    for y in range(14, 28, 3):                                                   # 세로 홈 줄
        for x in (12, 20): c.tone(x, y, 'shell', 2) if c.m[y][x] else None
    c.group(3); c.new()                                                          # 앞가슴판
    for y in range(6, 13):
        for x in range(9, 24):
            dx = (x + 0.5 - 16) / 7.2; dy = (y + 0.5 - 9.5) / 3.6
            if dx * dx + dy * dy <= 1: c.setv(x, y, 'shell', 0.8 - 0.3 * dx - 0.15 * dy)
    c.tone(12, 8, 'shell', 6); c.tone(13, 7, 'shell', 6)
    c.group(4); c.new()                                                          # 머리 + 큰턱
    for y in range(2, 7):
        for x in range(12, 21):
            if ((x + 0.5 - 16) / 4.2) ** 2 + ((y + 0.5 - 5) / 2.4) ** 2 <= 1: c.setv(x, y, 'shell', 0.6 - 0.2 * (x - 16) / 4)
    for (x, y) in ((12, 2), (11, 1), (11, 0), (20, 2), (21, 1), (21, 0), (13, 1), (19, 1)): c.tone(x, y, 'shell', 3)
    # 빈 껍질: 겉날개 뒤쪽이 깨져 속이 비었다
    for (x, y) in ((14, 26), (15, 27), (17, 27), (18, 26), (16, 28), (15, 26), (17, 26)): c.tone(x, y, 'dark', 1)
    im = F(c); px = im.load(); tufts(px, W, Hh, 2, 31, 30, 1122, 0.45, 2)
    return im


# ---------------------------------------------------------------- 징검돌(물 칸 위): 납작한 강돌 + 젖은 테 + 물살 고리
def _stepstone(seed, lumps):
    W, Hh = 16, 16
    c = C(W, Hh, seed=seed)
    for (cx, cy, rx, ry) in lumps:
        c.new(); c.cylinder(cx, cy - 1.2, cy + 1.2, rx, 'stone', cap=True, capry=ry, amb=0.25, bias=-0.06)
    for (cx, cy, rx, ry) in lumps:
        c.tone(int(cx - rx * 0.4), int(cy - ry * 0.6), 'stone', 6); c.tone(int(cx + rx * 0.3), int(cy + 0.5), 'moss', 3)
    im = F(c); px = im.load()
    foam = (232, 244, 246)
    for (cx, cy, rx, ry) in lumps:                                             # 돌 아래쪽 물살(흰 화소 고리, 듬성)
        for i in range(12):
            a = math.pi * (0.05 + 0.9 * i / 11)
            x = int(round(cx + math.cos(a) * (rx + 1.2))); y = int(round(cy + 1.6 + math.sin(a) * (ry * 0.6 + 0.8)))
            if get(px, W, Hh, x, y)[3] == 0 and i % 2 == 0: put(px, W, Hh, x, y, foam, 230)
    return im


def stepping_stone_a(): return _stepstone(1131, ((8, 8.5, 6.2, 3.6),))
def stepping_stone_b(): return _stepstone(1132, ((6, 9, 4.4, 2.8), (11.5, 7.5, 3.6, 2.4)))
