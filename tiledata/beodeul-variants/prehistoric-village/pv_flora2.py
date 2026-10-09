# 보정 패스(2026-10-08) — 숲이 같은 두 모양(나무고사리·소철)으로 반복되던 것을 깨는 변형 6종.
#   나무고사리 변형 3: tree_fern_lean(오른쪽으로 휜 줄기·처진 잎 11장), tree_fern_giant(가장 큰 키·잎 16장·왼쪽으로 살짝),
#                     tree_fern_squat(짧고 굵은 줄기·넓게 퍼진 잎 9장·마른 잎 치마 두툼)
#   야자 변형 3     : palm_lean(가는 고리 마디 줄기가 왼쪽으로 크게 휨·잎 7장·열매 송이), palm_twin(한 밑동에서 갈라진 두 줄기·잎 6+5장),
#                     palm_short(뭉툭한 줄기·잎 9장이 촘촘한 키 작은 야자)
# 획은 pv_flora 와 같다(frond 깃꼴 잎 + 묶음별 윤곽, 빛 왼쪽 위, 버들항 잎 램프). 야자 잎은 길고 가는 깃꼴 + 아치형으로 처지고,
# 줄기는 비늘이 아니라 가로 고리 마디라 나무고사리와 멀리서도 다르게 읽힌다.
from pv_base import *
from pv_flora import frond


def _trunk(c, cxf, y0, y1, r0, r1, mat='bark', seed=1, style='scale'):
    """휜 줄기: 줄 y 마다 가운데 cxf(y). style='scale' 엇갈린 비늘(나무고사리), 'ring' 가로 고리 마디(야자)."""
    c.new()
    for y in range(int(y0), int(y1) + 1):
        f = (y - y0) / max(1, (y1 - y0))
        r = r0 + (r1 - r0) * f; cx = cxf(y)
        for x in range(int(cx - r) - 1, int(cx + r) + 2):
            u = (x + 0.5 - cx) / r
            if abs(u) > 1: continue
            t = 5 if u < -0.35 else (4 if u < 0.25 else (3 if u < 0.7 else 2))
            if style == 'scale':
                a = (x + y) % 3; b = (x - y) % 3
                if a == 0 or b == 0: t -= 1
            else:
                k = (y - int(y0)) % 4
                if k == 0: t -= 1                                  # 고리 마디 홈
                elif k == 1 and u < 0.2: t += 1                    # 마디 위 볼록(빛)
                if H(x, y, seed) > 0.93: t -= 1
            c.tone(x, y, mat, max(1, min(6, t)))


def _rootmat(c, cx, base, r1, seed, mat='bark'):
    c.new()
    for y in range(base - 4, base + 1):
        for x in range(int(cx - r1 - 3), int(cx + r1 + 4)):
            dx = (x + 0.5 - cx) / (r1 + 3); dy = (y + 0.5 - (base - 1)) / 3.0
            if dx * dx + dy * dy <= 1: c.tone(x, y, mat, (4 if dx < 0 else 2) + (1 if H(x, y, seed) > 0.8 else 0))


def _bend(cx, base, top, lean, power=1.6):
    """밑동 cx 에서 꼭대기 쪽으로 lean 화소만큼 휘는 가운데 줄."""
    def f(y):
        t = (base - y) / max(1, base - top)
        return cx + lean * max(0.0, t) ** power
    return f


def fern_crown(c, tx, ty, L, n, seed, skirt=7, skirt_len=9, droop_k=1.0, spread=1.0, grp=2):
    """나무고사리 수관: 마른 잎 치마 + n 장 깃꼴 잎(뒤 어둡게·앞 밝게) + 새순 고리. pv_flora.tree_fern 과 같은 획."""
    for k in range(skirt):
        a = math.pi * (0.22 + 0.56 * k / max(1, skirt - 1)) + (H(k, seed, 5) - 0.5) * 0.2
        c.group(grp + k); frond(c, tx, ty + 2, a, skirt_len + H(k, seed) * 3, 1.8, lift=0, droop=4, mat='hide2', tone_bias=-1, seed=seed + 40 + k)
    angs = [(-math.pi / 2 + (i / n) * 2 * math.pi + (H(i, seed) - 0.5) * 0.4) for i in range(n)]
    for k, a in sorted(enumerate(angs), key=lambda t: math.sin(t[1])):
        front = math.sin(a)
        Lk = L * (0.80 + H(k, seed, 1) * 0.32) * (1 - 0.38 * max(0, front) ** 2) * (spread if abs(math.cos(a)) > 0.5 else 1.0)
        tb = -2 if front < -0.5 else (-1 if front < 0.1 else (0 if front < 0.7 else 1))
        c.group(grp + 20 + k)
        frond(c, tx, ty, a, Lk, 3.6, lift=5 + 2 * (front < 0) - 2 * max(0, front),
              droop=(7 * (1 - abs(front)) + 3 + 1.5 * max(0, front)) * droop_k, tone_bias=tb, seed=seed + k)
    c.group(grp + 60); c.new()
    for (dx, dy) in ((-1, -1), (0, -1), (1, -1), (-1, 0), (0, 0), (1, 0)): c.tone(tx + dx, ty + dy, 'leaf', 6)
    c.tone(tx - 1, ty - 2, 'leaf', 5); c.tone(tx, ty - 3, 'leaf', 5); c.tone(tx + 1, ty - 2, 'leaf', 4)


def _fern_variant(W, Hh, cx, base, top, L, n, seed, r0, r1, lean, skirt=7, skirt_len=9, droop_k=1.0, spread=1.0):
    c = C(W, Hh, seed=seed); c.shadow(cx + 3, base - 1, 9, 2.4, 100)
    cf = _bend(cx, base, top, lean)
    c.group(1); _trunk(c, cf, top + 2, base - 2, r0, r1, 'bark', seed, 'scale')
    _rootmat(c, cx, base, r1, seed)
    tx = int(round(cf(top)))
    fern_crown(c, tx, top, L, n, seed, skirt, skirt_len, droop_k, spread)
    im = F(c, 0.78); px = im.load()
    tufts(px, W, Hh, int(cx - 8), int(cx + 9), base, seed + 9, 0.5, 3)
    return im


def tree_fern_lean():   return _fern_variant(48, 72, 18, 70, 26, 18, 11, 2001, 2.3, 3.2, lean=9, droop_k=1.25)
def tree_fern_giant():  return _fern_variant(48, 96, 26, 94, 30, 21, 16, 2011, 2.8, 3.8, lean=-4, skirt=9, skirt_len=10)
def tree_fern_squat():  return _fern_variant(48, 48, 24, 46, 24, 18, 9, 2021, 3.6, 4.4, lean=1, skirt=9, skirt_len=8, droop_k=0.8, spread=1.15)


# ---------------------------------------------------------------- 야자: 길고 가는 깃꼴 잎이 아치로 처지고, 고리 마디 줄기
def palm_crown(c, tx, ty, n, L, seed, grp=2, tilt=0.0, fruit=True):
    """야자 수관: n 장 긴 잎(가로로 길게 뻗어 끝이 크게 처짐), 가운데 위로 선 새 잎 하나, 잎 밑 열매 송이."""
    angs = [math.pi + (i / max(1, n - 1)) * math.pi + (H(i, seed) - 0.5) * 0.25 + tilt for i in range(n)]
    angs += [math.pi * 0.28 + tilt, math.pi * 0.72 + tilt][: max(0, n - 6)]
    if fruit:                                                                    # 열매 송이(잎 밑, 잎보다 먼저 = 뒤)
        c.group(grp); c.new()
        for (dx, dy) in ((-2, 2), (0, 3), (2, 2), (-1, 4), (1, 4), (3, 4)):
            c.ellipsoid(tx + dx, ty + dy, 1.4, 1.3, 'hide', amb=0.3, bias=0.0, bump=0.1)
    for k, a in sorted(enumerate(angs), key=lambda t: math.sin(t[1])):
        front = math.sin(a)
        side = abs(math.cos(a))
        Lk = L * (0.78 + H(k, seed, 1) * 0.3) * (1 - 0.45 * max(0, front))
        tb = -2 if front < -0.6 else (-1 if front < 0.0 else (0 if front < 0.6 else 1))
        c.group(grp + 10 + k)
        frond(c, tx, ty, a, Lk, 2.6, lift=3 + 3 * side * (front < 0.2), droop=6 + 9 * side + 3 * max(0, front),
              tone_bias=tb, notch=1, seed=seed + k)
    c.group(grp + 40)                                                            # 새 잎(위로 곧게)
    frond(c, tx, ty, -math.pi / 2 + 0.12, L * 0.42, 1.8, lift=0, droop=0, tone_bias=1, notch=1, seed=seed + 77)


def _palm(W, Hh, cx, base, top, L, n, seed, r0, r1, lean, power=1.4, tilt=0.0, fruit=True):
    c = C(W, Hh, seed=seed); c.shadow(cx + 3 + lean // 3, base - 1, 8, 2.2, 100)
    cf = _bend(cx, base, top, lean, power)
    c.group(1); _trunk(c, cf, top + 1, base - 1, r0, r1, 'bark', seed, 'ring')
    tx = int(round(cf(top)))
    palm_crown(c, tx, top, n, L, seed, tilt=tilt, fruit=fruit)
    im = F(c, 0.78); px = im.load()
    tufts(px, W, Hh, int(cx - 7), int(cx + 8), base, seed + 9, 0.5, 3)
    return im


def palm_lean():  return _palm(48, 80, 30, 78, 22, 21, 7, 2101, 1.8, 2.8, lean=-12, power=1.8, tilt=-0.12)
def palm_short(): return _palm(48, 48, 24, 46, 22, 17, 9, 2121, 2.8, 3.6, lean=1, tilt=0.0, fruit=False)


def palm_twin():
    """한 밑동에서 갈라진 두 줄기: 왼쪽 키 큰 줄기(잎 6), 오른쪽 낮은 줄기(잎 5)가 바깥으로 휜다."""
    W, Hh, cx, base, seed = 48, 80, 24, 78, 2111
    c = C(W, Hh, seed=seed); c.shadow(cx + 3, base - 1, 10, 2.4, 100)
    tops = ((0, 24, -9, 6, 19, 2.0), (1, 40, 8, 5, 16, 1.8))
    for (k, top, lean, n, L, r0) in tops[::-1]:                                  # 낮은 줄기 먼저(뒤)
        cf = _bend(cx + (1 if lean > 0 else -1), base, top, lean, 1.5)
        c.group(1 + k * 100); _trunk(c, cf, top + 1, base - 1, r0, 3.0, 'bark', seed + k, 'ring')
        palm_crown(c, int(round(cf(top))), top, n, L, seed + 10 * k, grp=2 + k * 100, tilt=0.15 if lean > 0 else -0.15, fruit=(k == 0))
    im = F(c, 0.78); px = im.load()
    tufts(px, W, Hh, cx - 8, cx + 9, base, seed + 9, 0.5, 3)
    return im
