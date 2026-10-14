"""pirate_isles 자연 — 야자·열대 나무·덤불·바위·산호·해변 잔해.

나무는 바닥 그림자를 굽지 않는다(모래·풀 어디에나 선다). 밑동 칸만 막힘, 수관 칸은 ★(사람 위에 그려짐).
물 위 조각(바위섬·산호)은 둘레 물거품 고리를 그리므로 물 위에만 둔다.
"""
import math
from pi_core import *


# ------------------------------------------------------------------ 야자
def palm_trunk(c, pts, w0=5, w1=3, mat='sand'):
    """줄기: 점 목록(아래 → 위)을 따라 굵기 w0→w1, 3px 마디(밝은 왼쪽·어두운 오른쪽·마디 밑 그늘)."""
    n = len(pts)
    for k, (x, y) in enumerate(pts):
        f = k / max(1, n - 1)
        w = w0 + (w1 - w0) * f
        a = x - w / 2
        seg = (n - 1 - k) % 3
        for i in range(int(round(w))):
            u = i / max(1, w - 1)
            t = 0 if u < .3 else -1 if u < .7 else -2
            if seg == 0: t -= 1
            elif seg == 2 and u < .6: t += 1
            c.P(int(round(a + i)), y, K(mat, t))


def frond(c, x0, y0, ang, L, droop, tone=0, width=3.0, mat='leaf', s=0, lift=0.0):
    """야자잎 한 장(띠): 휘는 잎줄기 위로 밝은 윗가장자리, 아래로 톱니 잎끝(어두운 밑면). ang 0=오른쪽, 세로 원근 0.6.
    lift = 처음에 위로 솟는 정도(뒤쪽 잎)."""
    steps = int(L * 2.2) + 2
    pts = []
    for k in range(steps + 1):
        t = k / steps
        x = x0 + math.cos(ang) * L * t
        y = y0 + math.sin(ang) * L * t * 0.6 - lift * math.sin(math.pi * t) + droop * t * t
        pts.append((x, y, t))
    for (x, y, t) in pts:
        hw = width * math.sin(math.pi * min(1.0, 0.15 + t)) * (1.0 - 0.25 * t) + 0.5
        n = max(1, int(round(hw)))
        serr = (int(t * L * 1.4) % 2 == 0)
        for j in range(-1, n + (2 if serr else 1)):
            # j<0 = 윗가장자리(밝음), 0 = 잎줄기, j>0 아래 잎
            yy = y + j
            if j < 0: col = K(mat, tone + 2)
            elif j == 0: col = K(mat, tone + 1)
            elif j <= n // 2 + 1: col = K(mat, tone)
            else: col = K(mat, tone - 1)
            if j >= n + (1 if serr else 0): col = K(mat, tone - 2)
            c.P(round(x), round(yy), col)


def palm(c, base, top, fr, seed=0, nuts=True, w0=5, w1=3):
    (bx, by), (tx, ty) = base, top
    pts = []
    for y in range(by, ty - 1, -1):
        f = (by - y) / max(1, by - ty)
        x = bx + (tx - bx) * (f ** 1.6)
        pts.append((x, y))
    palm_trunk(c, pts, w0, w1)
    c.HL(int(bx - w0 / 2 - 1), by, w0 + 2, K('sand', -2)); c.HL(int(bx - w0 / 2), by - 1, w0, K('sand', -1))
    back = [a for a in fr if math.sin(a[0]) < -0.3]
    front = [a for a in fr if math.sin(a[0]) >= -0.3]
    for (a, L, d) in back: frond(c, tx, ty, a, L, d, tone=-1, s=seed, lift=3, width=2.6)
    if nuts:
        for (dx, dy) in ((-2, 2), (1, 3), (-1, 4), (2, 2)):
            lit_blob(c, tx + dx + .5, ty + dy + .5, 1.7, 1.7, 'wood', -1, s=seed)
    for (a, L, d) in sorted(front, key=lambda q: math.sin(q[0])):
        tone = 1 if math.cos(a) < -0.3 else 0 if math.cos(a) < 0.4 else -1
        frond(c, tx, ty, a, L, d, tone=tone, s=seed, lift=1.5)
    c.P(tx, ty - 1, K('leaf', 3)); c.P(tx - 1, ty, K('leaf', 2)); c.P(tx + 1, ty - 1, K('leaf', 2))


@piece('palm', 'coconut palm tree with curved ringed trunk and drooping fronds', 2, 3, 'organic', group='nature', solid=[(0, 2)], tags=['야자', '나무'],
       desc='야자수(코코넛). 밑동 칸만 막힘, 잎은 사람 위에 그려진다. 모래·풀 어디에나.')
def _palm(c):
    fr = [(math.pi * 1.0, 14, 9), (math.pi * 0.78, 12, 11), (math.pi * 1.25, 11, 6), (math.pi * 1.5, 7, 5), (math.pi * 1.75, 11, 6),
          (0.0, 14, 9), (math.pi * 0.22, 12, 11), (math.pi * 0.52, 7, 8)]
    palm(c, (9, 46), (16, 13), fr, seed=1)
    c.outline()


@piece('palm-lean', 'leaning coconut palm tree bending toward the sea', 2, 3, 'organic', group='nature', solid=[(0, 2)], tags=['야자', '나무'],
       desc='바다 쪽으로 휜 야자수. 해변 가장자리에 둔다(밑동 칸만 막힘).')
def _palm_lean(c):
    fr = [(math.pi * 1.0, 12, 9), (math.pi * 0.8, 10, 10), (math.pi * 1.3, 10, 6), (math.pi * 1.7, 10, 6),
          (0.05, 11, 9), (math.pi * 0.25, 10, 10), (math.pi * 0.55, 6, 7)]
    palm(c, (6, 46), (19, 16), fr, seed=2, w0=5, w1=3)
    c.outline()


@piece('palm-young', 'young short palm tree', 1, 2, 'organic', group='nature', solid=[(0, 1)], tags=['야자', '나무'],
       desc='어린 야자(1칸 폭). 길가·집 옆에.')
def _palm_young(c):
    fr = [(math.pi * 1.0, 7, 6), (math.pi * 0.75, 6, 7), (math.pi * 1.3, 6, 4), (math.pi * 1.7, 6, 4), (0.0, 7, 6), (math.pi * 0.25, 6, 7)]
    palm(c, (8, 30), (8, 12), fr, seed=3, nuts=False, w0=4, w1=3)
    c.outline()


@piece('palm-pair', 'twin coconut palm trees from one clump', 2, 3, 'organic', group='nature', solid=[(0, 2), (1, 2)], tags=['야자', '나무'],
       desc='한 덩이에서 자란 쌍둥이 야자. 밑동 두 칸 막힘.')
def _palm_pair(c):
    fr1 = [(math.pi * 1.0, 9, 8), (math.pi * 0.78, 8, 8), (math.pi * 1.3, 8, 5), (math.pi * 1.7, 7, 5), (0.1, 6, 6)]
    fr2 = [(math.pi * 1.15, 8, 6), (math.pi * 1.5, 7, 5), (math.pi * 1.8, 9, 5), (0.0, 11, 8), (math.pi * 0.22, 10, 9), (math.pi * 0.55, 6, 7)]
    palm(c, (12, 46), (8, 22), fr1, seed=4, w0=4, w1=3)
    palm(c, (19, 46), (22, 11), fr2, seed=5, w0=5, w1=3)
    c.outline()


# ------------------------------------------------------------------ 넓은잎 열대 나무·덤불
def canopy(c, lumps, mat='grass', s=0):
    """잎 덩이 여러 개(뒤 → 앞): (cx, cy, rx, ry, tone). 덩이마다 왼쪽 위 빛·오른쪽 아래 짙은 테로 덩이가 갈린다."""
    for k, (cx, cy, rx, ry, t) in enumerate(lumps):
        def f(x, y, nx, ny, d, t=t, k=k):
            if 1 - d < 0.12 and hsh(x, y, s + k) % 3 == 0: return None
            nz = math.sqrt(max(0.0, 1 - d))
            li = -0.5 * nx - 0.65 * ny + 0.55 * nz
            tt = 2 if li > .95 else 1 if li > .7 else 0 if li > .38 else -1 if li > .05 else -2
            if d > .78 and (nx + ny) > 0.3: tt = min(tt, -2)
            q = hsh(x, y, s + 31) % 9
            if q == 0 and tt < 2: tt += 1                     # 잎 반짝
            elif q == 1 and tt > -2: tt -= 1
            return K(mat, t + tt)
        c.ellf(cx, cy, rx, ry, f)


@piece('tree-broad', 'broadleaf tropical tree with layered round canopy and short trunk', 2, 3, 'organic', group='nature', solid=[(0, 2), (1, 2)], tags=['나무', '밀림'],
       desc='넓은잎 열대 나무(짙은 수관). 밀림·마을 뒤. 밑동 두 칸 막힘.')
def _tree_broad(c):
    # 줄기 + 뿌리
    for y in range(31, 46):
        w = 6 + (2 if y > 42 else 0)
        for i in range(w):
            u = i / (w - 1); c.P(16 - w // 2 + i, y, K('wood', 0 if u < .3 else -1 if u < .6 else -2 - (1 if (y + i) % 5 == 0 else 0)))
    c.line(12, 45, 8, 46, K('wood', -1)); c.line(20, 45, 24, 46, K('wood', -2))
    canopy(c, [(16, 14, 14, 10, -1), (6, 21, 6, 6, -1), (26, 21, 6, 6, -2), (16, 25, 11, 7, -1), (9, 15, 8, 7, 0), (23, 15, 8, 7, -1),
               (15, 9, 9, 6, 0), (10, 23, 6, 5, 0), (22, 24, 6, 5, -1), (12, 6, 5, 4, 1)], s=7)
    c.outline()


@piece('tree-fruit', 'mango tree with round canopy and orange fruit', 2, 3, 'organic', group='nature', solid=[(0, 2), (1, 2)], tags=['나무', '과일'],
       desc='망고 나무(주황 열매). 마을 뜰·밭가.')
def _tree_fruit(c):
    for y in range(32, 46):
        for i in range(5):
            u = i / 4; c.P(14 + i, y, K('wood', 1 if u < .3 else 0 if u < .6 else -1))
    c.HL(12, 45, 9, K('wood', -2))
    canopy(c, [(16, 17, 14, 11, -1), (8, 20, 7, 7, 0), (24, 20, 7, 7, -1), (16, 26, 10, 6, -1), (11, 12, 7, 6, 1), (21, 12, 7, 6, 0), (16, 8, 6, 4, 1)], s=9)
    for k in range(9):
        x = 6 + hsh(k, 1, 3) % 21; y = 9 + hsh(k, 2, 3) % 19
        if c.has(x, y) and c.has(x + 1, y + 1):
            c.P(x, y, K('fire', 3)); c.P(x + 1, y, K('fire', 2)); c.P(x, y + 1, K('terra', 1)); c.P(x + 1, y + 1, K('terra', 0))
    c.outline()


@piece('bush', 'round tropical bush', 1, 1, 'organic', group='nature', solid=[(0, 0)], tags=['덤불'], desc='둥근 덤불(1칸, 막힘).')
def _bush(c):
    canopy(c, [(8, 9, 7, 6, -1), (6, 7, 4, 4, 1), (11, 8, 4, 4, 0)], s=11)
    c.outline()


@piece('bush-hibiscus', 'hibiscus bush with red flowers', 1, 1, 'organic', group='nature', solid=[(0, 0)], tags=['덤불', '꽃'], desc='붉은 히비스커스 꽃 덤불.')
def _hibiscus(c):
    canopy(c, [(8, 9, 7, 6, -1), (6, 7, 4, 4, 1), (11, 8, 4, 4, 0)], s=12)
    for (x, y) in ((4, 6), (10, 4), (8, 10), (12, 9)):
        c.P(x, y, K('red', 3)); c.P(x + 1, y, K('red', 1)); c.P(x, y + 1, K('red', 0)); c.P(x + 1, y + 1, K('red', -1)); c.P(x, y - 1, K('red', 2))
        c.P(x + 1, y - 1, K('gold', 3))
    c.outline()


@piece('fern', 'low jungle fern', 1, 1, 'organic', group='nature', tags=['풀', '고사리'], desc='낮은 고사리(걸어 지나간다).')
def _fern(c):
    for (a, L, d, t) in ((math.pi * 1.05, 7, 3, 0), (math.pi * 1.35, 6, 1, 1), (math.pi * 1.65, 6, 1, 0), (math.pi * 1.95, 7, 3, -1), (math.pi * 0.85, 5, 3, 0), (math.pi * 0.15, 5, 3, -1)):
        frond(c, 8, 11, a, L, d, tone=t, width=2.2, mat='grass')
    c.outline()


@piece('banana', 'banana plant with large paddle leaves', 1, 2, 'organic', group='nature', solid=[(0, 1)], tags=['바나나', '나무'], desc='바나나 나무(큰 잎, 노란 송이).')
def _banana(c):
    for y in range(16, 31):
        c.R(6, y, 4, 1, K('leaf', -1)); c.P(6, y, K('leaf', 1)); c.P(9, y, K('leaf', -2))
    leaves = [(-1, 7, 0.95, 1), (1, 8, 0.35, -1), (-1, 5, 0.7, 0), (1, 6, 0.6, 0), (0, 3, 0.15, 1)]
    for (side, L, droop, t) in leaves:
        for k in range(L + 1):
            x = 8 + side * k if side else 8; y = 16 - (L - k) * (1 if side == 0 else 0.6) + droop * k * k / L
            if side == 0: x = 8; y = 15 - k
            for j in range(-2, 3):
                xx, yy = (x, y + j) if side else (x + j, y)
                c.P(round(xx), round(yy), K('leaf', t + (1 if j < 0 else 0) - (1 if abs(j) == 2 else 0)))
            c.P(round(x), round(y), K('leaf', t + 2))
    for (x, y) in ((7, 18), (9, 19), (8, 20)):
        c.P(x, y, K('gold', 2)); c.P(x, y + 1, K('gold', 0))
    c.outline()


# ------------------------------------------------------------------ 바위·산호·물 위 바위
def rock(c, cx, cy, rx, ry, mat='rock', s=0, cracks=True):
    lit_blob(c, cx, cy, rx, ry, mat, 0, s=s, rough=0.12)
    if cracks:
        for k in range(2):
            x = cx - rx / 2 + hsh(k, s, 1) % max(1, int(rx)); y = cy - ry / 3 + hsh(k, s, 2) % max(1, int(ry))
            c.line(int(x), int(y), int(x + 2), int(y + 3), K(mat, -2))


@piece('rock-small', 'small coastal boulder', 1, 1, 'organic', group='nature', solid=[(0, 0)], tags=['바위'], desc='작은 바위(막힘).')
def _rock_s(c):
    rock(c, 8, 9, 7, 5.5, s=1); rock(c, 12, 12, 3, 2.5, s=2, cracks=False); c.outline()


@piece('rock-large', 'large mossy coastal boulder cluster', 2, 2, 'organic', group='nature', solid=[(0, 1), (1, 1), (0, 0), (1, 0)], tags=['바위'], desc='큰 바위 덩이(2×2, 막힘).')
def _rock_l(c):
    rock(c, 13, 15, 11, 10, s=3); rock(c, 23, 21, 7, 6, s=4); rock(c, 8, 24, 6, 5, s=5)
    for k in range(14):
        x = 6 + hsh(k, 7) % 16; y = 7 + hsh(k, 8) % 5
        if c.has(x, y): c.P(x, y, K('moss', 1 + hsh(k, 9) % 2))
    c.outline()


@piece('sea-stack', 'rocky islet sea stack standing in the water with surf foam ring', 2, 2, 'organic', group='nature', solid=[(0, 1), (1, 1), (0, 0), (1, 0)],
       tags=['바위', '물'], desc='물 위 바위섬(둘레 물거품). 얕은 물·깊은 물 위에만.')
def _stack(c):
    c.ellf(16, 25, 14, 5, lambda x, y, nx, ny, d: K('shallow', 1) if d > .55 else K('shallow', -1))
    rock(c, 15, 15, 10, 11, s=6); rock(c, 22, 20, 6, 6, s=7)
    for k in range(10):
        x = 7 + hsh(k, 3) % 16; y = 6 + hsh(k, 4) % 4
        if c.has(x, y): c.P(x, y, K('bone', 2) if k % 3 else K('bone', 0))           # 새똥 흰 점(바다새 바위)
    ripple_ring(c, 16, 25, 14, 5, s=1)
    c.outline()


def coral(c, cx, cy, mat, s=0, kind='branch'):
    if kind == 'branch':
        for k in range(6):
            a = math.pi * (1.1 + 0.8 * k / 5)
            L = 4 + hsh(k, s) % 3
            x1, y1 = cx + math.cos(a) * L, cy + math.sin(a) * L * 0.9
            c.line(cx, cy, round(x1), round(y1), K(mat, 1 if k < 3 else 0))
            c.P(round(x1), round(y1), K(mat, 3)); c.P(round(x1) + 1, round(y1), K(mat, 1))
    else:
        lit_blob(c, cx, cy, 5, 3.5, mat, 0, s=s)
        for k in range(8):
            x = cx - 4 + hsh(k, s, 2) % 8; y = cy - 2 + hsh(k, s, 3) % 4
            if c.has(x, y): c.P(x, y, K(mat, -2))


@piece('coral', 'coral reef heads rising from shallow water with foam', 1, 1, 'organic', group='nature', solid=[(0, 0)], tags=['산호', '물'],
       desc='얕은 물 위 산호초(분홍·주황). 물 위에만.')
def _coral(c):
    c.ellf(8, 11, 7, 3.5, lambda x, y, nx, ny, d: K('shallow', 1))
    coral(c, 6, 11, 'coral', 1, 'branch'); coral(c, 11, 11, 'fire', 2, 'brain')
    ripple_ring(c, 8, 11, 7, 3.5, s=2)
    c.outline(K('shallow', -2))


@piece('coral-purple', 'purple fan coral and brain coral in shallow water', 1, 1, 'organic', group='nature', solid=[(0, 0)], tags=['산호', '물'],
       desc='보라·청록 산호(물 위).')
def _coral2(c):
    c.ellf(8, 11, 7, 3.5, lambda x, y, nx, ny, d: K('shallow', 1))
    coral(c, 10, 11, 'teal', 3, 'branch'); coral(c, 5, 11, 'coral', 4, 'brain')
    ripple_ring(c, 8, 11, 7, 3.5, s=3)
    c.outline(K('shallow', -2))


@piece('rock-water', 'small rocks breaking the surface of the water with foam', 1, 1, 'organic', group='nature', solid=[(0, 0)], tags=['바위', '물'],
       desc='물 위 작은 바위(물거품).')
def _rockw(c):
    c.ellf(8, 11, 7, 3.5, lambda x, y, nx, ny, d: K('shallow', 1))
    rock(c, 7, 8, 5, 4, s=8); rock(c, 12, 10, 3, 2.5, s=9, cracks=False)
    ripple_ring(c, 8, 11, 7, 3.5, s=4)
    c.outline(K('shallow', -2))


# ------------------------------------------------------------------ 해변 잔해(납작, 걸어 지나간다)
@piece('driftwood', 'bleached driftwood log lying on the sand', 2, 1, 'debris', group='nature', tags=['해변'], desc='해변 유목(눕힌 통나무, 걸어 지나간다).')
def _drift(c):
    for i in range(26):
        x = 3 + i; y = 9 + round(math.sin(i / 6) * 1.5)
        for j in range(4):
            c.P(x, y + j, K('bone', (1 if j == 0 else 0 if j < 2 else -1) - (1 if (i + j) % 7 == 0 else 0)))
    c.line(10, 9, 7, 5, K('bone', 0)); c.P(7, 5, K('bone', 1)); c.line(22, 12, 25, 14, K('bone', -1))
    c.ell(4, 10.5, 1.5, 2, K('bone', -2)); c.P(4, 10, K('bone', -3))
    c.outline()


@piece('shells', 'scattered seashells and a starfish on the sand', 1, 1, 'debris', group='nature', tags=['해변'], desc='조개·불가사리(모래 위 잔해).')
def _shells(c):
    for (x, y) in ((4, 5), (11, 4)):
        c.R(x, y, 3, 2, K('bone', 1)); c.P(x, y, K('bone', 3)); c.HL(x, y + 2, 3, K('bone', -1)); c.P(x + 1, y + 1, K('coral', 1))
    cx, cy = 9, 11
    for k in range(5):
        a = -math.pi / 2 + k * 2 * math.pi / 5
        for r in range(1, 4): c.P(round(cx + math.cos(a) * r), round(cy + math.sin(a) * r * .8), K('fire', 2 if r < 3 else 1))
    c.P(cx, cy, K('fire', 3))
    c.outline()


@piece('seaweed', 'washed-up seaweed pile on the sand', 1, 1, 'debris', group='nature', tags=['해변'], desc='밀려온 해초 더미.')
def _seaweed(c):
    for k in range(9):
        x0 = 3 + hsh(k, 1) % 10; y0 = 6 + hsh(k, 2) % 6
        for i in range(5):
            c.P(x0 + i, y0 + round(math.sin((i + k) / 1.4)), K('moss', -1 + (k % 3)))
    c.outline()


@piece('coconuts', 'pile of fallen coconuts', 1, 1, 'debris', group='nature', tags=['해변', '열매'], desc='떨어진 코코넛 더미.')
def _coco(c):
    for (x, y, r) in ((6, 10, 3), (11, 11, 2.7), (8, 6.5, 2.8)):
        lit_blob(c, x, y, r, r * .9, 'wood', -1, s=int(x))
        c.P(int(x) - 1, int(y) - 1, K('wood', 2))
    c.outline()


@piece('grass-tuft', 'tall beach grass tuft', 1, 1, 'organic', group='nature', tags=['풀'], desc='해변 억새 덤불(걸어 지나간다).')
def _tuft(c):
    for k in range(9):
        x = 3 + k * 1.2; h = 6 + hsh(k, 3) % 5; lean = (k - 4) * 0.35
        for j in range(h):
            c.P(round(x + lean * j / h * 3), 13 - j, K('leaf', (1 if j > h * .6 else 0) - (1 if k % 2 else 0)))
    c.outline()
