"""조선 나무 — 버들항 나무와 같은 방식(잎 덩이를 뒤에서 앞으로 겹쳐 칠하고, 덩이마다 왼쪽 위 빛, 사이사이 어두운 틈,
가지가 잎 사이로 보이고, 줄기는 밑동이 퍼진다)으로 그린다. 잎 질감은 버들항 정글 칩의 잎 조각에서 가져와 7톤 램프에 맞춘다.
모든 색은 tk.RGB 램프(= 버들항 시트 잠금 팔레트)에서만 나온다.
"""
import math, os
from PIL import Image
from tk import *
from build import outline

_HERE = os.path.dirname(os.path.abspath(__file__))
_CHIP = os.path.join(_HERE, '..', 'city_v6', 'assets', 'jungle-chipset-v6.png')
LEAF = RGB['leaf']                       # 어두움→밝음 7톤
WOOD = RGB['wood']
_TEX = None


def _tex():
    """버들항 칩 잎 조각 32×32 → 톤 번호(1..6)."""
    global _TEX
    if _TEX is None:
        im = Image.open(_CHIP).convert('RGB').crop((232, 524, 264, 556))
        px = im.load()
        t = [[1] * 32 for _ in range(32)]
        for y in range(32):
            for x in range(32):
                c = px[x, y]
                t[y][x] = 1 + min(range(1, 7), key=lambda i: sum((c[j] - LEAF[i][j]) ** 2 for j in range(3))) - 1
        _TEX = t
    return _TEX


class Crown:
    """톤 버퍼에 잎 덩이를 쌓은 뒤 색으로 굽는다."""

    def __init__(s, w, h, seed=0, ramp=None, shift=0):
        s.w, s.h, s.seed, s.shift = w, h, seed, shift
        s.ramp = ramp or LEAF
        s.t = [[None] * w for _ in range(h)]
        s.cl = []

    def clump(s, cx, cy, rx, ry, dark=0, rim=True):
        s.cl.append((cx, cy, rx, ry, dark, rim))

    def paint(s):
        T = _tex()
        for i, (cx, cy, rx, ry, dark, rim) in enumerate(sorted(s.cl, key=lambda c: (c[1] + c[3] * 0.3, c[0]))):
            for y in range(int(cy - ry) - 2, int(cy + ry) + 3):
                for x in range(int(cx - rx) - 2, int(cx + rx) + 3):
                    if not (0 <= x < s.w and 0 <= y < s.h):
                        continue
                    dx = (x + 0.5 - cx) / rx
                    dy = (y + 0.5 - cy) / ry
                    r = dx * dx + dy * dy
                    wob = (rnd(x, y, s.seed + i * 7) - 0.5) * 0.45
                    if r > 1 + wob:
                        continue
                    lit = -(dx * 0.55 + dy * 0.85)
                    sh = 2 if lit > 0.5 else (1 if lit > 0.15 else (0 if lit > -0.3 else (-1 if lit > -0.65 else -2)))
                    if rim and r > 0.72 and lit < 0.05:
                        sh -= 1                                   # 덩이 아래·오른쪽 가장자리는 어둡게 → 덩이가 갈라져 보인다
                    base = T[(y + s.seed * 5) % 32][(x + s.seed * 7) % 32]
                    q = rnd(x, y, s.seed + 11)
                    spk = -1 if q < 0.34 else (1 if q > 0.62 else 0)          # 1px 잎 얼룩 −1/0/+1
                    tone = base - 2 + int(round(sh * 0.5)) + 1 + spk - dark + s.shift
                    s.t[y][x] = max(1, min(6, tone))

    def edge_dark(s):
        """실루엣 안쪽 1px 를 가장 어두운 톤으로(버들항 잎 가장자리)."""
        out = [row[:] for row in s.t]
        for y in range(s.h):
            for x in range(s.w):
                if s.t[y][x] is None:
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    X, Y = x + dx, y + dy
                    if not (0 <= X < s.w and 0 <= Y < s.h) or s.t[Y][X] is None:
                        out[y][x] = 1 if (dy > 0 or dx > 0) else min(3, s.t[y][x])
                        break
        s.t = out

    def bake(s, cv, ox=0, oy=0):
        for y in range(s.h):
            for x in range(s.w):
                if s.t[y][x] is not None:
                    cv.put(ox + x, oy + y, s.ramp[s.t[y][x]])


def bark_line(cv, pts, w0, w1, seed=0):
    """굵기가 변하는 가지/줄기. pts=[(x,y),...] 사이를 이어 그린다. 왼쪽 밝고 오른쪽 어둡게."""
    n = len(pts) - 1
    for k in range(n):
        (xa, ya), (xb, yb) = pts[k], pts[k + 1]
        steps = int(max(abs(xb - xa), abs(yb - ya))) + 1
        for j in range(steps + 1):
            t = j / steps
            x = xa + (xb - xa) * t
            y = ya + (yb - ya) * t
            u = (k + t) / n
            w = w0 + (w1 - w0) * u
            x0 = int(round(x - w / 2))
            for i in range(max(1, int(round(w)))):
                f = i / max(1, int(round(w)) - 1) if w > 1 else 0.5
                tone = 5 if f < 0.2 else (4 if f < 0.5 else (3 if f < 0.8 else 2))
                if rnd(int(x) + i, int(y), seed) < 0.12:
                    tone = max(2, tone - 1)
                cv.put(x0 + i, int(round(y)), WOOD[tone])


def trunk(cv, cx, y0, y1, w, flare=5, lean=0.0, seed=0, bark=None, roots=True):
    """밑동이 퍼지는 줄기. 위(y0)는 w, 아래(y1)는 w+2*flare. bark: 톤 번호 4개(밝→어두)."""
    bark = bark or (5, 4, 3, 2)
    for y in range(y0, y1):
        t = (y - y0) / max(1, y1 - y0)
        cxx = cx + lean * (1 - t) ** 1.6 * 10
        ww = w + 2 * flare * (t ** 3.2) + (1 if t > 0.55 else 0)
        xl = int(round(cxx - ww / 2))
        n = max(2, int(round(ww)))
        for i in range(n):
            f = i / (n - 1)
            k = bark[0] if f < 0.22 else (bark[1] if f < 0.52 else (bark[2] if f < 0.82 else bark[3]))
            if rnd(xl + i, y // 2, seed) < 0.16 and 0 < i < n - 1:
                k = bark[min(3, bark.index(k) + 1)] if k in bark else k   # 세로 껍질 결
            cv.put(xl + i, y, WOOD[k])
    if roots:
        for side in (-1, 1):
            for r in range(2):
                bx = int(round(cx + side * (w / 2 + flare * 0.5)))
                for k in range(flare + 3 + r * 2):
                    X = bx + side * k
                    Y = y1 - 1 - (k // 3) + (1 if r else 0)
                    cv.put(X, Y, WOOD[4 if side < 0 else 2])
                    cv.put(X, Y + 1, WOOD[3 if side < 0 else 1])


def ground_shadow(cv, cx, cy, rx, ry, al=70):
    for y in range(int(cy - ry), int(cy + ry) + 1):
        for x in range(int(cx - rx), int(cx + rx) + 1):
            if (x - cx) ** 2 / (rx * rx) + (y - cy) ** 2 / (ry * ry) <= 1:
                if 0 <= x < cv.w and 0 <= y < cv.h and cv.a[y, x, 3] == 0:
                    cv.put(x, y, SHADOW, al)



def scatter(c, cx, cy, rx, ry, n, rmin=4.0, rmax=6.0, flat=0.0, seed=0, dark_below=None):
    """타원 영역에 작은 잎 덩이를 흩어 겹친다(버들항 나무의 8~10px 덩이 결). flat>0 이면 아래쪽을 평평하게 자른다."""
    # 속이 비지 않게 가운데 큰 덩이 하나를 먼저 깐다
    c.clump(cx, cy + ry * 0.05, rx * 0.72, ry * (0.62 if flat else 0.7), dark=0)
    k = 0
    tries = 0
    while k < n and tries < n * 12:
        tries += 1
        u = rnd(tries, seed, 41) * 2 - 1
        v = rnd(tries, seed, 42) * 2 - 1
        if u * u + v * v > 1:
            continue
        if flat and v > 1 - flat:
            v = 1 - flat
        r = rmin + (rmax - rmin) * rnd(tries, seed, 43)
        dk = 1 if (dark_below is not None and cy + v * ry > dark_below) else 0
        c.clump(cx + u * (rx - r * 0.75), cy + v * (ry - r * 0.65), r * 1.12, r * 0.95, dark=dk)
        k += 1

# ---------------------------------------------------------------- 나무 종류
def zelkova(seed=0, shift=0):
    """느티나무(당산나무) 64×80: 수관이 몸집의 3/4, 줄기는 짧고 굵게 퍼진 뿌리, 잎 사이로 굵은 가지가 갈라져 보인다."""
    W, H = 64, 80
    cv = Cv(W, H)
    ground_shadow(cv, 32, 76, 24, 4)
    trunk(cv, 31, 50, 77, 10, flare=7, lean=0.03 * (-1) ** seed, seed=seed)
    bark_line(cv, [(31, 52), (22, 42), (14, 36)], 5, 3, seed)
    bark_line(cv, [(32, 52), (42, 41), (50, 35)], 5, 3, seed)
    bark_line(cv, [(31, 48), (31, 34), (28, 24)], 5, 3, seed)
    c = Crown(W, H, seed, shift=shift + 1)
    scatter(c, 32, 29, 31, 27, 78, 5.0, 8.0, flat=0.12, seed=seed, dark_below=44)
    c.paint()
    c.edge_dark()
    c.bake(cv)
    # 수관 앞으로 드러나는 가지 마디 (버들항 느티나무의 Y 가지)
    bark_line(cv, [(27, 44), (30, 38), (32, 30)], 3, 2, seed + 1)
    bark_line(cv, [(36, 44), (40, 36)], 3, 2, seed + 2)
    bark_line(cv, [(22, 38), (18, 33)], 3, 2, seed + 3)
    outline(cv)
    return cv


def pine(seed=0, shift=0):
    """소나무 64×80: 붉은 비늘 껍질 줄기가 S 자로 꺾여 올라가고, 한쪽으로 뻗은 가지 끝에 납작한 솔잎 층이 구름처럼 얹힌다."""
    W, H = 64, 80
    cv = Cv(W, H)
    ground_shadow(cv, 30, 75, 20, 3)
    bk = (5, 4, 3, 2)
    # S 자 줄기
    pts = [(28, 76), (29, 66), (33, 56), (30, 46), (27, 38), (31, 28)]
    for k in range(len(pts) - 1):
        (xa, ya), (xb, yb) = pts[k], pts[k + 1]
        for y in range(yb, ya + 1):
            t = (y - yb) / max(1, ya - yb)
            xc = xb + (xa - xb) * t
            t_all = (y - 28) / 48
            ww = 5 + 5 * max(0, (t_all - 0.7) / 0.3) ** 2 + 2 * t_all
            xl = int(round(xc - ww / 2))
            for i in range(int(round(ww))):
                f = i / max(1, int(round(ww)) - 1)
                k2 = 5 if f < 0.2 else (4 if f < 0.5 else (3 if f < 0.8 else 2))
                if (y + i * 3 + seed) % 5 == 0 and 0 < i < int(round(ww)) - 1:
                    k2 = max(2, k2 - 1)                                  # 비늘 껍질 가로 갈라짐
                cv.put(xl + i, y, WOOD[k2])
    for side in (-1, 1):                                                  # 밑동 뿌리
        for k in range(9):
            cv.put(28 + side * (5 + k), 76 - k // 3, WOOD[4 if side < 0 else 2])
            cv.put(28 + side * (5 + k), 77 - k // 3, WOOD[2 if side < 0 else 1])
    # 가지: 줄기에서 수관 층으로
    bark_line(cv, [(30, 50), (20, 46), (12, 42)], 3, 2, seed)
    bark_line(cv, [(30, 40), (42, 34), (52, 30)], 3, 2, seed)
    bark_line(cv, [(29, 32), (24, 26), (18, 22)], 3, 2, seed)
    c = Crown(W, H, seed, shift=shift + 0)
    # 납작한 구름 층 셋(가지 끝). 각 층은 가로로 넓고 아래가 평평한 솔잎 덩이들.
    for (cx, cy, rx, ry) in ((14, 42, 16, 8), (46, 29, 17, 9), (23, 17, 17, 8.5)):
        scatter(c, cx, cy, rx, ry, 24, 4.4, 6.6, flat=0.1, seed=seed + cx)
    c.paint()
    c.edge_dark()
    # 솔잎 끝이 삐죽 — 가장자리 위쪽에 1px 가시
    for y in range(c.h - 1):
        for x in range(c.w):
            if c.t[y][x] is not None and c.t[y - 1][x] is None and rnd(x, y, seed + 9) < 0.35:
                if y - 1 >= 0:
                    c.t[y - 1][x] = 2
    c.bake(cv)
    outline(cv)
    return cv


def persimmon_tree(seed=0, shift=0):
    """감나무 48×64: 둥글고 꽉 찬 수관 + 짧은 굽은 줄기, 잎 사이 주황 감."""
    W, H = 48, 64
    cv = Cv(W, H)
    ground_shadow(cv, 24, 60, 16, 3)
    trunk(cv, 24, 40, 61, 7, flare=5, lean=0.04, seed=seed, roots=True)
    bark_line(cv, [(24, 42), (16, 35)], 4, 2, seed)
    bark_line(cv, [(24, 42), (33, 34)], 4, 2, seed)
    c = Crown(W, H, seed, shift=shift + 1)
    scatter(c, 24, 23, 23, 21, 46, 4.4, 6.8, flat=0.1, seed=seed, dark_below=34)
    c.paint()
    c.edge_dark()
    c.bake(cv)
    O = RGB['persimmon']
    for k in range(14):
        fx = int(7 + rnd(k, seed, 21) * 33)
        fy = int(8 + rnd(k, seed, 22) * 28)
        if cv.a[fy, fx, 3] == 0:
            continue
        for dx, dy, tn in ((0, 0, 5), (1, 0, 4), (0, 1, 4), (1, 1, 3)):
            cv.put(fx + dx, fy + dy, O[tn])
        cv.put(fx, fy, O[6] if rnd(k, seed, 23) < 0.4 else O[5])
    outline(cv)
    return cv


def willow(seed=0, shift=0):
    """버드나무 64×80: 넓고 꽉 찬 수관, 아래로 가는 가지가 2px 리본으로 길게 늘어지고 끝이 뾰족하다."""
    W, H = 64, 80
    cv = Cv(W, H)
    ground_shadow(cv, 32, 76, 22, 4)
    trunk(cv, 31, 34, 77, 9, flare=6, lean=-0.03, seed=seed)
    bark_line(cv, [(30, 38), (20, 28), (12, 24)], 4, 3, seed)
    bark_line(cv, [(32, 38), (42, 28), (52, 24)], 4, 3, seed)
    c = Crown(W, H, seed, shift=shift + 1)
    scatter(c, 32, 19, 31, 15, 44, 4.8, 7.2, flat=0.18, seed=seed)
    c.paint()
    c.edge_dark()
    for x in range(3, 61, 3):
        top = None
        for y in range(H):
            if c.t[y][x] is not None:
                top = y
        if top is None:
            continue
        ln = int(24 + rnd(x, seed, 31) * 24 - abs(x - 32) * 0.3)
        sway = (rnd(x, seed, 32) - 0.5) * 1.6
        for j in range(ln):
            yy = top + 1 + j
            if yy >= H - 2:
                break
            xx = int(round(x + sway * math.sin(j * 0.18)))
            tone = 5 if j < ln * 0.3 else (4 if j < ln * 0.7 else 3)
            if (j + x) % 5 == 0:
                tone -= 1
            wdt = 2 if j < ln * 0.8 else 1
            for i in range(wdt):
                if c.t[yy][min(W - 1, xx + i)] is None:
                    c.t[yy][min(W - 1, xx + i)] = max(1, tone - (1 if i else 0))
    c.bake(cv)
    outline(cv)
    return cv


def bamboo(seed=0):
    """대나무 숲 32×64: 가는 마디 줄기 여섯 대와 위쪽 댓잎 가지."""
    W, H = 32, 64
    cv = Cv(W, H)
    ground_shadow(cv, 16, 61, 13, 3)
    culms = [(6, 8, 62), (11, 4, 63), (16, 6, 62), (21, 3, 63), (26, 9, 62), (13, 0, 62)]
    for i, (x, top, bot) in enumerate(culms):
        for y in range(top + 6, bot):
            node = ((y + i * 3) % 9 == 0)
            for dx, tn in ((0, 5), (1, 4), (2, 2)):
                col = LEAF[tn]
                if node:
                    col = WOOD[3] if dx < 2 else WOOD[1]
                cv.put(x + dx, y, col)
    c = Crown(W, H, seed)
    for i, (x, top, bot) in enumerate(culms):
        for k in range(3):
            c.clump(x + 1 + (k - 1) * 5 + (rnd(i, k, seed) - 0.5) * 3, top + 7 + k * 6 + (i % 2) * 2, 5, 3.2, dark=k // 2)
    c.paint()
    c.edge_dark()
    # 댓잎은 한 덩이가 아니라 비스듬한 잎 가지로 — 덩이 가장자리를 뾰족하게 깎는다
    for y in range(H):
        for x in range(W):
            if c.t[y][x] is not None and rnd(x, y, seed + 3) < 0.18 and c.t[min(H - 1, y + 1)][x] is None:
                c.t[y][x] = None
    c.bake(cv)
    outline(cv)
    return cv


def bush(kind='a', seed=0):
    """관목 32×32: a=둥근 짙은 덤불, b=연두 덤불, c=개나리(노란 꽃 점)."""
    W, H = 32, 32
    cv = Cv(W, H)
    ground_shadow(cv, 16, 27, 12, 2.5)
    c = Crown(W, H, seed, shift={'a': -1, 'b': 1, 'c': 1}[kind])
    scatter(c, 16, 15, 15, 11, 18, 4.0, 5.6, flat=0.12, seed=seed)
    c.paint()
    c.edge_dark()
    c.bake(cv)
    if kind == 'c':
        S = RGB['straw']
        for k in range(26):
            x = int(5 + rnd(k, seed, 5) * 22)
            y = int(6 + rnd(k, seed, 6) * 18)
            if cv.a[y, x, 3]:
                cv.put(x, y, S[5] if rnd(k, seed, 7) < 0.6 else S[6])
                if rnd(k, seed, 8) < 0.4:
                    cv.put(x + 1, y, S[4])
    outline(cv)
    return cv


VARIANTS = {'zelkova': zelkova, 'pine': pine, 'persimmon_tree': persimmon_tree, 'willow': willow, 'bamboo': bamboo}


def small_tree(kind='z', seed=0):
    """어린 나무 32×48: 수관 지름 약 24px, 짧은 줄기. kind z=활엽 / p=소나무형(위가 납작)."""
    W, H = 32, 48
    cv = Cv(W, H)
    ground_shadow(cv, 16, 44, 11, 2.5)
    trunk(cv, 16, 28, 45, 5, flare=3, lean=0.03, seed=seed, roots=True)
    c = Crown(W, H, seed, shift=1 if kind == 'z' else 0)
    if kind == 'z':
        scatter(c, 16, 15, 15, 13, 22, 3.6, 5.4, flat=0.15, seed=seed, dark_below=22)
    else:
        scatter(c, 16, 14, 15, 8, 16, 3.6, 5.2, flat=0.2, seed=seed)
        bark_line(cv, [(16, 30), (14, 24)], 3, 2, seed)
    c.paint()
    c.edge_dark()
    c.bake(cv)
    outline(cv)
    return cv
