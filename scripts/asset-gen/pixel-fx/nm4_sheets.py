"""묶음 m4 새 이펙트 시트 16장(직업마다 대표 1 + 필살기 하늘 1). lib_nm4.sheet 로 등록한다.
64 칸: 발밑 y56, 몸 중심 (32, 40). 128 칸(screen): 무대 한가운데, fade_oval 로 둥글게 끝난다. 적은 왼쪽.
"""
import math

from lib_nm4 import sheet, ease, rng

CX, CY, GY = 32, 40, 56

# ───────── 트렌트 ─────────
TREE = {'o': '#1c1109', 'b0': '#4a2c16', 'b1': '#7a4c28', 'b2': '#a8743e', 'b3': '#cf9c5c',
        'l0': '#1d4318', 'l1': '#357326', 'l2': '#5fa83a', 'l3': '#a2d85a', 'g': '#e8ffb0', 'y': '#f4e25a'}


def root_spike(c, x, base, h, lean, w=3, cols=('b0', 'b1', 'b2')):
    if h < 1:
        return
    tip = (x + lean, base - h)
    c.poly([(x - w, base), (x + w, base), tip], cols[0])
    c.poly([(x - w + 1, base), (x, base), tip], cols[1])
    c.line([(x - w + 2, base - 1), (x + lean * 0.6, base - h * 0.6)], cols[2])


@sheet('treant_roots', 64, 10, 'target', TREE)
def _treant_roots(c, f, n):
    """뿌리가 땅을 뚫고 솟아 → 몸을 휘감아 조이고 → 풀리며 흙으로 돌아간다."""
    grow = [0.15, 0.45, 0.8, 1.0, 1.0, 1.0, 1.0, 0.8, 0.45, 0.15][f]
    # 땅 균열
    c.line([(12, GY), (20, GY - 1), (28, GY), (36, GY - 1), (44, GY), (52, GY - 1)], 'o', 1)
    if f < 3:
        for x in (16, 30, 46):
            c.px(x, GY - 2 - f, 'b2')
            c.px(x + 2, GY - 3 - f, 'b3')
    for x, h, l in ((14, 22, 6), (50, 24, -7), (24, 16, 3), (41, 18, -3)):
        root_spike(c, x, GY, h * grow, l * grow)
    if 3 <= f <= 7:
        # 휘감는 덩굴: 몸통 둘레 타원 호 두세 줄, 칸마다 조여든다
        t = (f - 3) / 4
        for k, y in enumerate((30, 40, 48)):
            rx = 16 - 3 * math.sin(t * math.pi)
            c.arc(CX, y, rx, 4, 200 - k * 10, 360 + k * 10, 'b1', 3)
            c.arc(CX, y, rx, 4, 210 - k * 10, 330, 'b2', 1)
            c.arc(CX, y, rx, 4, 20, 160, 'b0', 2)
        for x, y in ((CX - 14, 26), (CX + 13, 34), (CX - 12, 46)):
            c.px(x, y, 'l2')
            c.px(x + 1, y - 1, 'l3')
    if f == 5:
        c.spark(CX - 10, 36, 4, 'g', 'y')
        c.spark(CX + 11, 44, 3, 'g')
    if f >= 8:
        for x in (18, 32, 44):
            c.px(x, GY - 1, 'b2')
            c.px(x + 1, GY - 2, 'b1')


@sheet('treant_forest_sky', 128, 12, 'screen', TREE)
def _treant_forest(c, f, n):
    """어두운 숲 바닥에서 고목들이 차례로 솟고 → 우거진 가지가 하늘을 덮고 → 잎이 폭풍처럼 쏟아진다."""
    g = 100
    c.ell(64, g + 6, 58, 12, 'l0')
    c.ell(64, g + 4, 50, 8, 'l1')
    trees = [(22, 46, 0), (104, 50, 1), (46, 62, 2), (82, 58, 3), (64, 72, 4)]
    for x, h, d in trees:
        t = max(0.0, min(1.0, (f - d) / 4))
        if t <= 0:
            c.ell(x, g, 5, 2, 'b0')
            continue
        hh = h * ease(t)
        w = 5 if h > 60 else 4
        c.poly([(x - w - 3, g + 2), (x + w + 3, g + 2), (x + w, g - hh), (x - w, g - hh)], 'b0')
        c.poly([(x - w - 2, g + 2), (x, g + 2), (x - 1, g - hh), (x - w, g - hh)], 'b1')
        c.line([(x - w + 1, g), (x - w + 1, g - hh * 0.9)], 'b2')
        c.line([(x + 1, g - hh * 0.4), (x + 10, g - hh * 0.6)], 'b1', 2)
        c.line([(x - 1, g - hh * 0.55), (x - 11, g - hh * 0.75)], 'b1', 2)
        if t >= 0.6:
            r = 10 + h / 7
            top = g - hh
            x = x + (((f + d) % 2) * 2 - 1 if f >= 7 else 0)  # 폭풍에 우듬지가 흔들린다
            c.ell(x, top, r, r * 0.8, 'l0')
            c.ell(x - 2, top - 2, r - 2, r * 0.8 - 2, 'l1')
            c.ell(x - 4, top - 4, r * 0.45, r * 0.35, 'l2')
            c.px(x - 5, top - 6, 'l3')
            # 줄기의 눈(트렌트 얼굴)
            c.px(x - 2, g - hh * 0.5, 'y')
            c.px(x + 2, g - hh * 0.5, 'y')
    if f >= 6:
        # 잎 폭풍: 오른쪽 위에서 왼쪽 아래로 휘몰아친다(칸마다 흐른다)
        R = rng('treant_forest_sky')
        seeds = [(R.randint(0, 140), R.randint(0, 120), R.random()) for _ in range(40)]
        k = f - 6
        for i, (x, y, p) in enumerate(seeds[:16 + k * 5]):
            xx = (x - k * (10 + p * 8)) % 118 + 5
            yy = (y + k * (6 + p * 5)) % 104 + 12
            c.line([(xx, yy), (xx + 3, yy - 2)], 'l1')
            c.line([(xx, yy), (xx + 2, yy - 1)], 'l3' if i % 3 == 0 else 'l2')
        c.arc(64, 64, 44 - k * 3, 30, 190 + k * 25, 250 + k * 25, 'l3', 2)
        c.arc(64, 70, 36 + k * 2, 24, 20 + k * 25, 70 + k * 25, 'l2', 1)
    if f in (8, 9, 10):
        c.star(22, 86, 6 + (f - 8) * 2, 'g', 'y')
        c.star(104, 88, 5 + (f - 8) * 2, 'g', 'y', rot=0.4)
    if f == 11:
        c.star(64, 90, 8, 'g', 'y', rot=0.3)


# ───────── 버섯 요정 ─────────
SPORE = {'o': '#2a0e12', 'r0': '#7a1622', 'r1': '#c42a30', 'w': '#fffaf0', 'y0': '#c89a2a', 'y1': '#f6e27a',
         'y2': '#fff6c0', 'g0': '#2f5a24', 'g1': '#5a9a3a', 'g2': '#9ad060', 'v0': '#6a4ab0', 'v1': '#b89af0', 'pk': '#f08a9a'}


@sheet('mushroom_spores', 64, 10, 'target', SPORE)
def _mushroom_spores(c, f, n):
    """금빛 포자가 위에서 내려앉아 → 몸을 감싸는 초록 빛 고리 → 작은 버섯이 피고 사라진다(단일 치유)."""
    R = rng('mushroom_spores')
    pts = [(R.randint(12, 52), R.randint(6, 26), R.random()) for _ in range(14)]
    fall = f / 5
    for i, (x, y, p) in enumerate(pts):
        if f > 6:
            continue
        yy = y + fall * 22 * (0.6 + p * 0.6)
        xx = x + math.sin(f * 0.9 + i) * 2 + (CX - x) * min(1, fall) * 0.35
        c.px(xx, yy, 'y1')
        if i % 3 == 0:
            c.px(xx + 1, yy, 'y2')
            c.px(xx, yy + 1, 'y0')
    if 3 <= f <= 8:
        t = (f - 3) / 5
        rx = 8 + t * 14
        c.ring(CX, GY - 2, rx, rx * 0.3, 'g1', 1)
        c.ring(CX, GY - 2 - t * 20, rx * 0.8, rx * 0.25, 'g2', 1)
        c.arc(CX, CY, 12 + t * 3, 16, 200, 340, 'y1')
    if 4 <= f <= 8:
        for k, x in enumerate((CX - 14, CX + 13, CX - 6, CX + 5)):
            h = min(4, f - 3 - k % 2)
            if h <= 0:
                continue
            c.rect(x, GY - h, x + 1, GY - 1, 'w')
            c.ell(x + 0.5, GY - h - 1, 2.5, 1.5, 'r1')
            c.px(x, GY - h - 2, 'w')
    if f in (5, 6):
        c.star(CX, CY - 4, 5 + (f - 5) * 2, 'y2', 'w')
    if f == 9:
        for x, y in ((CX - 8, 26), (CX + 6, 20), (CX, 14)):
            c.px(x, y, 'y1')
            c.px(x, y - 1, 'y2')


@sheet('mushroom_ring_sky', 128, 12, 'screen', SPORE)
def _mushroom_ring(c, f, n):
    """밤 숲 바닥에 요정 버섯 고리가 차례로 피고 → 고리 가운데서 포자 기둥 → 금빛·보라 포자가 하늘 가득."""
    g = 92
    c.ell(64, g, 56, 18, 'g0')
    c.ell(64, g - 2, 50, 14, 'g1')
    # 바닥의 빛 고리가 칸마다 안에서 밖으로 번진다
    pr = 10 + (f % 4) * 11
    c.ring(64, g - 2, pr, pr * 0.3, 'g2')
    if f < 5:
        for i in range(4 + f * 2):
            a = i * 1.7 + f * 0.5
            c.px(64 + math.cos(a) * (8 + f * 6), g - 6 - (i * 3 + f * 4) % 30, 'y1')
    N = 12
    shown = min(N, f * 2 + 1)
    for i in range(N):
        a = math.pi * 2 * i / N
        x = 64 + math.cos(a) * 42
        y = g + math.sin(a) * 12
        if i >= shown:
            c.px(x, y, 'g2')
            continue
        s = 3 if math.sin(a) > 0 else 2
        c.rect(x - 1, y - s * 2, x + s - 2, y, 'w')
        c.ell(x, y - s * 2 - 1, s + 2, s, 'r1')
        c.ell(x - 1, y - s * 2 - 2, s, s * 0.5, 'r0' if i % 2 else 'r1')
        c.px(x - 1, y - s * 2 - 2, 'w')
        c.px(x + 1, y - s * 2 - 1, 'w')
    if f >= 5:
        t = min(1, (f - 5) / 4)
        top = g - 10 - t * 70
        w = 10 + t * 6 + (f % 2) * 2
        c.poly([(64 - w, g - 6), (64 + w, g - 6), (64 + w * 0.5, top), (64 - w * 0.5, top)], 'v0')
        c.poly([(64 - w * 0.6, g - 6), (64 + w * 0.2, g - 6), (64, top), (64 - w * 0.3, top)], 'v1')
        c.line([(64, g - 8), (64, top)], 'y1')
    if f >= 7:
        R = rng('mushroom_ring_sky', f)
        for i in range(34 + (f - 7) * 8):
            x = R.randint(12, 116)
            y = R.randint(10, 84)
            col = ('y1', 'v1', 'y2', 'pk')[i % 4]
            c.px(x, y, col)
            if i % 5 == 0:
                c.px(x + 1, y, col)
                c.px(x, y + 1, col)
    if f in (8, 9, 10):
        c.star(64, 22, 8 + (f - 8) * 3, 'y2', 'w')


# ───────── 갓파 ─────────
WATER = {'o': '#0d1e2e', 'd0': '#1a3e7a', 'd1': '#2a6ab8', 'w1': '#5ab8e8', 'w2': '#a8e4ff', 'w3': '#f2fcff',
         'k0': '#1f5a34', 'k1': '#3a8a48', 'k2': '#6cc060', 'pl': '#e6eef2', 'e1': '#f2c83a'}


@sheet('kappa_water_jet', 32, 4, 'projectile', WATER)
def _kappa_jet(c, f, n):
    """물대포 머리(왼쪽) + 뒤로 흩어지는 물보라. 네 칸이 도는 루프."""
    y = 16 + (1 if f % 2 else 0)
    c.ell(8, y, 6, 5, 'd1')
    c.ell(8, y, 5, 4, 'w1')
    c.ell(6, y - 1, 2, 2, 'w2')
    c.px(5, y - 2, 'w3')
    c.poly([(10, y - 4), (29, y - 2 - f % 2), (29, y + 2 + f % 2), (10, y + 4)], 'd1')
    c.poly([(11, y - 2), (28, y - 1), (28, y + 1), (11, y + 2)], 'w1')
    c.line([(12, y - 1), (26, y - 1)], 'w2')
    for k in range(3):
        x = 14 + ((k * 6 + f * 3) % 14)
        c.px(x, y - 5 - k % 2, 'w2')
        c.px(x + 1, y + 5 + k % 2, 'w1')


@sheet('kappa_flood_sky', 128, 12, 'screen', WATER)
def _kappa_flood(c, f, n):
    """하늘에 거대한 접시가 떠 → 기울며 물을 쏟고 → 강물 파도가 오른쪽→왼쪽으로 쓸고 간다."""
    # 접시
    tilt = min(1, max(0, (f - 2) / 3)) * 0.5
    px_, py = 88, 24 + [8, 4, 1][f] if f <= 2 else 24  # 처음엔 위에서 내려온다
    if f <= 8:
        rx, ry = 22, 7
        pts = []
        for i in range(24):
            a = math.pi * 2 * i / 24
            x = math.cos(a) * rx
            y = math.sin(a) * ry
            pts.append((px_ + x * math.cos(tilt) - y * math.sin(tilt), py + x * math.sin(tilt) + y * math.cos(tilt)))
        c.poly(pts, 'pl')
        inner = [((x - px_) * 0.8 + px_, (y - py) * 0.7 + py) for x, y in pts]
        c.poly(inner, 'w1')
        c.px(px_ - 8, py - 3, 'w3')
    # 쏟아지는 물줄기
    if 3 <= f <= 8:
        lx = px_ - 20
        c.poly([(lx - 3, py + 8), (lx + 4, py + 6), (lx - 4 - (f - 3) * 3, 100), (lx - 14 - (f - 3) * 3, 100)], 'd1')
        c.poly([(lx - 1, py + 8), (lx + 2, py + 7), (lx - 7 - (f - 3) * 3, 100), (lx - 10 - (f - 3) * 3, 100)], 'w1')
    # 처음 세 칸은 접시에 물이 넘실댄다
    if f <= 2:
        for i in range(3 + f * 2):
            c.px(px_ - 16 + i * 5, py - 4 - (i + f) % 3, 'w2')
            c.px(px_ - 15 + i * 5, py + 8 + f * 2, 'w1')
    # 강물 파도: f 5~11 오른쪽에서 왼쪽으로
    if f >= 5:
        t = (f - 5) / 6
        front = 104 - t * 88
        for k, (base, col) in enumerate(((96, 'd0'), (86, 'd1'), (78, 'w1'))):
            pts = [(118, 104)]
            for x in range(124, int(front) - 1, -4):
                pts.append((min(118, x), base - 6 * math.sin((x + f * 7 + k * 9) / 9) - (10 if x < front + 14 else 0)))
            pts.append((front, 104))
            c.poly(pts, col)
        # 파도 머리 거품
        for i in range(6):
            x = front + 2 + i * 3
            y = 66 - i % 2 * 3 + t * 4
            c.px(x, y, 'w3')
            c.px(x + 1, y + 1, 'w2')
        c.arc(front + 10, 74, 12, 10, 180, 300, 'w3', 2)
    if f in (6, 7, 8):
        for x, y in ((24, 60), (40, 50), (58, 66)):
            c.px(x, y - (f - 6) * 3, 'w2')
            c.px(x, y - (f - 6) * 3 - 1, 'w3')


# ───────── 구미호 ─────────
FOX = {'o': '#10103a', 'b0': '#1c2a8a', 'b1': '#3a6ad8', 'b2': '#6ab0ff', 'b3': '#b8e8ff', 'w': '#f6fcff',
       'v0': '#3a1878', 'v1': '#6a2ab8', 'v2': '#b07ae8', 'f1': '#d0741e', 'f2': '#f2a83a', 'f3': '#ffd878'}


def foxfire(c, x, y, s, lean=1.0):
    """여우불: 둥근 몸 + 오른쪽 뒤로 날리는 꼬리불(왼쪽으로 날아가는 중). s 반지름."""
    c.poly([(x, y - s), (x + s * 3.2 * lean, y - s * 0.4), (x + s * 2.4 * lean, y + s * 0.2), (x, y + s)], 'b0')
    c.ell(x, y, s, s, 'b0')
    c.ell(x, y, s - 1, s - 1, 'b1')
    c.poly([(x, y - s + 1), (x + s * 2.6 * lean, y - s * 0.3), (x, y + s - 1)], 'b1')
    c.ell(x - 1, y - 1, max(1, s - 2), max(1, s - 2), 'b2')
    c.ell(x - 1, y - 1, max(0.5, s / 3), max(0.5, s / 3), 'b3')
    c.px(x - 1, y - 1, 'w')


@sheet('kitsune_foxfire', 32, 4, 'projectile', FOX)
def _kitsune_foxfire(c, f, n):
    """푸른 여우불 한 덩이가 흔들리며 왼쪽으로 난다. 위아래 작은 불티."""
    y = 16 + [0, -1, 0, 1][f]
    foxfire(c, 9, y, 6, lean=1.0 + 0.15 * (f % 2))
    for k in range(3):
        x = 20 + ((k * 4 + f * 3) % 9)
        c.px(x, y - 7 + k * 5 + (f % 2), 'b2' if k % 2 else 'b3')


@sheet('kitsune_ninefire_sky', 128, 12, 'screen', FOX)
def _kitsune_ninefire(c, f, n):
    """보라 밤하늘에 아홉 여우불이 하나씩 켜지며 원을 이루고 → 원이 돌며 조여 → 가운데 큰 청염 폭발."""
    cx, cy = 64, 62
    # 환술 결계
    c.ring(cx, cy, 50, 44, 'v0', 2)
    if f >= 2:
        c.ring(cx, cy, 44, 38, 'v1', 1)
    lit = min(9, f + 1)
    rad = 40 if f < 7 else 40 - (f - 7) * 7
    spin = f * 0.18
    for i in range(9):
        a = -math.pi / 2 + i * math.pi * 2 / 9 + spin
        x = cx + math.cos(a) * rad
        y = cy + math.sin(a) * rad * 0.88
        if i < lit and rad > 6:
            foxfire(c, x, y, 5 if i % 2 == 0 else 4, lean=0.8)
        elif i >= lit:
            c.px(x, y, 'v2')
    # 여우 얼굴 윤곽(가운데, 흐릿하게)
    if 3 <= f <= 7:
        c.poly([(cx - 16, cy - 6), (cx - 12, cy - 24), (cx - 4, cy - 10)], 'v1')
        c.poly([(cx + 16, cy - 6), (cx + 12, cy - 24), (cx + 4, cy - 10)], 'v1')
        c.poly([(cx - 16, cy - 6), (cx + 16, cy - 6), (cx, cy + 16)], 'v0')
        c.line([(cx - 10, cy - 2), (cx - 4, cy)], 'b2', 1)
        c.line([(cx + 10, cy - 2), (cx + 4, cy)], 'b2', 1)
    if f >= 9:
        r = 10 + (f - 9) * 10
        c.ell(cx, cy, r, r * 0.9, 'b1')
        c.ell(cx, cy, r * 0.7, r * 0.6, 'b2')
        c.ell(cx, cy, r * 0.35, r * 0.3, 'b3')
        c.star(cx, cy, r + 10, 'w', 'w', rot=f * 0.3) if f == 9 else None
        for i in range(12):
            a = i * math.pi / 6 + f
            c.line([(cx + math.cos(a) * (r + 4), cy + math.sin(a) * (r + 4)), (cx + math.cos(a) * (r + 12), cy + math.sin(a) * (r + 12))], 'b3')


# ───────── 너구리 ─────────
LEAF = {'o': '#1e140c', 'l0': '#1e4a1a', 'l1': '#3a8a2a', 'l2': '#72c43a', 'l3': '#c0ec6a', 'st': '#5a3a20',
        't0': '#5a3a20', 't1': '#8a5e36', 't2': '#b8864e', 'c1': '#f0dcb4', 'sm0': '#8a84a8', 'sm1': '#d8d0e8',
        'w': '#fffaf0', 'gd': '#f2c83a'}


def leaf_star(c, x, y, s, rot):
    """회전하는 나뭇잎 표창."""
    pts = []
    for i in range(4):
        a = rot + i * math.pi / 2
        pts += [(x + math.cos(a) * s, y + math.sin(a) * s), (x + math.cos(a + 0.8) * s * 0.35, y + math.sin(a + 0.8) * s * 0.35)]
    c.poly(pts, 'l1')
    for i in range(4):
        a = rot + i * math.pi / 2
        c.line([(x, y), (x + math.cos(a) * s * 0.8, y + math.sin(a) * s * 0.8)], 'l2')
    c.px(x, y, 'st')


@sheet('tanuki_leaf', 32, 4, 'projectile', LEAF)
def _tanuki_leaf(c, f, n):
    """빙글 도는 나뭇잎 표창(왼쪽으로). 뒤로 초록 바람 줄."""
    leaf_star(c, 10, 16, 7, f * math.pi / 8)
    c.px(9, 14, 'l3')
    for k, yy in enumerate((12, 16, 20)):
        x0 = 19 + (k + f) % 3
        c.line([(x0, yy), (x0 + 6 - k, yy)], 'l2' if k != 1 else 'l3')


@sheet('tanuki_transform_sky', 128, 12, 'screen', LEAF)
def _tanuki_transform(c, f, n):
    """펑! 연기구름 → 연기 속에서 거대한 너구리 얼굴이 떠오르고 → 배 두드리는 충격파 + 나뭇잎 폭풍."""
    cx, cy = 64, 64
    # 연기
    R = rng('tanuki_transform_sky')
    puffs = [(R.randint(26, 102), R.randint(34, 98), R.randint(8, 14)) for _ in range(9)]
    grow = min(1, (f + 1) / 3)
    fade = 1 if f < 5 else max(0, 1 - (f - 5) / 5)
    for i, (x, y, r) in enumerate(puffs):
        rr = r * grow * (0.4 + 0.6 * fade)
        if rr < 2:
            continue
        c.ell(x, y, rr, rr * 0.85, 'sm0')
        c.ell(x - rr * 0.25, y - rr * 0.25, rr * 0.7, rr * 0.6, 'sm1')
    if f == 0:
        c.star(cx, cy, 16, 'w', 'gd')
    # 거대 너구리 얼굴
    if f >= 3:
        t = min(1, (f - 3) / 3)
        s = 0.6 + 0.4 * ease(t)
        fy = cy + (1 - t) * 12
        c.ell(cx - 26 * s, fy - 28 * s, 9 * s, 9 * s, 't0')
        c.ell(cx + 26 * s, fy - 28 * s, 9 * s, 9 * s, 't0')
        c.ell(cx, fy, 34 * s, 28 * s, 't1')
        c.ell(cx - 6 * s, fy - 8 * s, 20 * s, 12 * s, 't2')
        # 눈 가면
        c.poly([(cx - 26 * s, fy - 4 * s), (cx - 6 * s, fy - 10 * s), (cx - 4 * s, fy + 4 * s), (cx - 20 * s, fy + 8 * s)], 'o')
        c.poly([(cx + 26 * s, fy - 4 * s), (cx + 6 * s, fy - 10 * s), (cx + 4 * s, fy + 4 * s), (cx + 20 * s, fy + 8 * s)], 'o')
        c.ell(cx - 12 * s, fy - 2 * s, 2.5 * s, 2.5 * s, 'w')
        c.ell(cx + 12 * s, fy - 2 * s, 2.5 * s, 2.5 * s, 'w')
        c.ell(cx, fy + 12 * s, 12 * s, 9 * s, 'c1')
        c.ell(cx, fy + 8 * s, 4 * s, 3 * s, 'o')
        # 머리 위 나뭇잎
        c.poly([(cx - 4, fy - 30 * s), (cx + 6, fy - 44 * s), (cx + 14, fy - 32 * s)], 'l1')
        c.line([(cx - 2, fy - 31 * s), (cx + 11, fy - 34 * s)], 'l3')
    # 배 두드리기 충격파
    if f >= 7:
        r = 20 + (f - 7) * 12
        c.ring(cx, cy + 20, r, r * 0.5, 'gd', 2)
        c.ring(cx, cy + 20, r - 6, r * 0.5 - 3, 'w', 1)
    if f >= 8:
        R2 = rng('tanuki_leaves', f)
        for i in range(10 + (f - 8) * 4):
            x = R2.randint(10, 118)
            y = R2.randint(14, 114)
            leaf_star(c, x, y, 4, f * 0.6 + i)


# ───────── 이끼 골렘 ─────────
STONE = {'o': '#161a1c', 's0': '#3c4448', 's1': '#666e70', 's2': '#949a96', 's3': '#c4c8c0',
         'g0': '#244a1a', 'g1': '#3f7a2a', 'g2': '#72b040', 'g3': '#b4e070', 'e1': '#7af0c8', 'e2': '#e0fff4',
         'dt': '#8a6a44', 'fl': '#f2d24a'}


@sheet('golem_moss_wall', 64, 10, 'allAllies', STONE)
def _golem_wall(c, f, n):
    """아군 앞(왼쪽)땅이 갈라져 이끼 돌벽이 솟고 → 룬이 빛나며 굳고 → 흙먼지를 털며 가라앉는다."""
    rise = [0.1, 0.4, 0.75, 1.0, 1.0, 1.0, 1.0, 1.0, 0.7, 0.35][f]
    x0, x1 = 6, 20
    h = 40 * rise
    top = GY - h
    c.line([(2, GY + 1), (26, GY + 1)], 'o')
    if h > 2:
        c.rect(x0, top, x1, GY, 's1')
        c.rect(x0, top, x0 + 3, GY, 's2')
        c.rect(x1 - 2, top, x1, GY, 's0')
        c.px(x0 + 1, top + 1, 's3')
        # 벽돌 줄
        for y in range(int(top) + 8, GY, 8):
            c.line([(x0, y), (x1, y)], 's0')
            off = 7 if (y // 8) % 2 else 3
            c.line([(x0 + off, y - 8), (x0 + off, y)], 's0')
        # 위 이끼 덮개
        c.rect(x0 - 1, top - 1, x1 + 1, top + 2, 'g1')
        for x in range(x0, x1 + 1, 3):
            c.px(x, top - 2, 'g2')
            c.px(x + 1, top + 3, 'g0')
        c.px(x0 + 2, top - 2, 'g3')
        c.line([(x0 + 2, top + 3), (x0 + 2, top + 10 * rise)], 'g1')
        c.line([(x1 - 3, top + 3), (x1 - 4, top + 14 * rise)], 'g1')
    if 3 <= f <= 7:
        k = f - 3
        cy = top + 18
        cols = ['e1', 'e2', 'e1', 'e2', 'e1']
        c.poly([(13, cy - 5), (17, cy), (13, cy + 5), (9, cy)], cols[k])
        c.poly([(13, cy - 2), (15, cy), (13, cy + 2), (11, cy)], 's0')
        if k in (1, 2, 3):
            c.ring(13, cy, 5 + k * 2, 5 + k * 2, 'e1')
        # 벽 뒤 아군 쪽 방어 막
        c.arc(CX + 6, CY, 20, 20, 150, 210, 'e1')
    if f <= 2 or f >= 8:
        for i, x in enumerate((4, 10, 18, 24)):
            c.px(x, GY - 2 - (i + f) % 3, 'dt')
            c.px(x + 1, GY - 1, 'dt')


@sheet('golem_moss_landslide_sky', 128, 12, 'screen', STONE)
def _golem_landslide(c, f, n):
    """산 능선이 금 가고 → 바위들이 굴러 떨어지며 → 땅에서 돌가시가 솟고 → 초록 룬 폭발."""
    # 산(처음 두 칸은 흔들린다)
    sh = [-2, 2, 0][f] if f <= 2 else 0
    c.poly([(8, 100), (40 + sh, 34), (58, 50), (80 + sh, 22), (120, 100)], 's0')
    # 흙먼지(칸마다 다르게 피어오른다)
    for i in range(5):
        x = 20 + i * 20 + (f * 5) % 9
        c.ell(x, 102 - (f + i) % 4, 3 + (f + i) % 3, 2, 'dt')
    c.poly([(14, 100), (40, 38), (52, 50), (46, 100)], 's1')
    c.poly([(60, 100), (80, 26), (92, 44), (84, 100)], 's1')
    c.line([(40, 34), (46, 44), (40, 56)], 's2')
    c.line([(80, 22), (86, 34), (80, 48)], 's2')
    c.poly([(36, 40), (40, 34), (46, 42)], 'g1')
    c.poly([(76, 28), (80, 22), (86, 30)], 'g1')
    if f >= 1:
        c.line([(80, 22), (76, 40), (82, 58), (74, 76)], 'o', 1)
    if f >= 2:
        c.line([(40, 34), (44, 52), (38, 70)], 'o', 1)
    # 굴러 떨어지는 바위
    if 2 <= f <= 9:
        t = (f - 2) / 7
        for k, (sx, sy, r) in enumerate(((78, 40, 8), (44, 50, 6), (96, 56, 5), (60, 44, 5))):
            x = sx - t * (40 + k * 8)
            y = sy + t * (46 - k * 4) - abs(math.sin(t * 9 + k)) * 6
            c.ell(x, y, r, r * 0.85, 's1')
            c.ell(x - r * 0.3, y - r * 0.3, r * 0.5, r * 0.4, 's2')
            c.px(x - r * 0.4, y - r * 0.5, 's3')
            c.ell(x + r * 0.3, y - r * 0.6, r * 0.4, r * 0.25, 'g1')
            c.px(x + r * 0.7, y + r * 0.9, 'dt')
    # 돌가시
    if f >= 6:
        t = min(1, (f - 6) / 3)
        for x, h in ((16, 30), (30, 44), (44, 26), (58, 38), (72, 22), (86, 34), (100, 24), (112, 30)):
            hh = h * ease(t)
            c.poly([(x - 6, 112), (x + 6, 112), (x + 1, 112 - hh)], 's1')
            c.poly([(x - 6, 112), (x, 112), (x + 1, 112 - hh)], 's2')
            c.px(x + 1, 112 - hh, 's3')
            if hh > 12:
                c.px(x - 2, 112 - hh * 0.4, 'g2')
    if f >= 9:
        r = 12 + (f - 9) * 14
        c.ring(64, 80, r, r * 0.6, 'e1', 2)
        c.ring(64, 80, r * 0.7, r * 0.42, 'e2', 1)
        c.star(64, 80, 10 + (f - 9) * 3, 'e2', 'fl')


# ───────── 얼음 요정 ─────────
ICE = {'o': '#14244a', 'i0': '#1e3a7a', 'i1': '#3a64b0', 'i2': '#6ea8e8', 'i3': '#b4e0ff', 'i4': '#f2fcff',
       'c0': '#5a8ac8', 'sn': '#dff4ff', 'pk': '#b8c8ff'}


def snowflake(c, cx, cy, r, rot, cols=('i2', 'i3', 'i4')):
    for i in range(6):
        a = rot + i * math.pi / 3
        ex, ey = cx + math.cos(a) * r, cy + math.sin(a) * r
        c.line([(cx, cy), (ex, ey)], cols[0], 2 if r > 10 else 1)
        c.line([(cx, cy), (ex, ey)], cols[1])
        for s in (0.45, 0.7):
            bx, by = cx + math.cos(a) * r * s, cy + math.sin(a) * r * s
            for d in (-0.9, 0.9):
                c.line([(bx, by), (bx + math.cos(a + d) * r * 0.25, by + math.sin(a + d) * r * 0.25)], cols[1])
        c.px(ex, ey, cols[2])
    c.ell(cx, cy, max(1, r * 0.12), max(1, r * 0.12), cols[2])


@sheet('sprite_ice_freeze', 64, 10, 'target', ICE)
def _sprite_freeze(c, f, n):
    """서리가 발밑에서 기어올라 → 얼음 결정 기둥이 몸을 가두고 → 반짝 → 금이 가며 부서진다."""
    frost = [4, 10, 18, 26, 30, 30, 30, 30, 20, 8][f]
    # 발밑 서리 바닥
    c.ell(CX, GY, 18 if f < 8 else 12, 4, 'i2')
    c.ell(CX - 2, GY - 1, 12 if f < 8 else 8, 2, 'i3')
    if f <= 7:
        top = GY - frost
        # 결정 기둥(몸 앞을 덮지 않게 가장자리 면만 굵게)
        c.poly([(CX - 16, GY), (CX - 14, top + 4), (CX - 6, top), (CX + 4, top + 2), (CX + 14, top - 2), (CX + 17, top + 6), (CX + 16, GY)], 'i2')
        c.poly([(CX - 12, GY - 2), (CX - 11, top + 6), (CX - 4, top + 3), (CX + 10, top + 2), (CX + 12, top + 7), (CX + 12, GY - 2)], 'i3')
        c.line([(CX - 13, GY - 2), (CX - 11, top + 6)], 'i4')
        c.line([(CX - 6, top), (CX - 4, top + 10)], 'i4')
        c.line([(CX + 14, top - 2), (CX + 12, top + 12)], 'c0')
        c.line([(CX + 16, top + 6), (CX + 16, GY)], 'i1')
    if f in (4, 5, 6):
        snowflake(c, CX - 8, top + 6, 4 + (f - 4) * 2, f * 0.3)
        c.spark(CX + 10 - (f - 4) * 6, top + 4 + (f - 4) * 8, 3, 'i4')
        c.line([(CX - 10, GY - 6 - (f - 4) * 7), (CX - 4, GY - 12 - (f - 4) * 7)], 'i4')
    if f >= 7:
        # 금
        c.line([(CX - 8, GY - 20), (CX - 2, GY - 12), (CX - 6, GY - 4)], 'o')
        c.line([(CX + 6, GY - 24), (CX + 2, GY - 14), (CX + 8, GY - 6)], 'o')
    if f >= 8:
        R = rng('sprite_ice_freeze', f)
        for i in range(14):
            a = R.random() * math.pi * 2
            d = 8 + (f - 8) * 10 + R.random() * 6
            x, y = CX + math.cos(a) * d, CY + math.sin(a) * d * 0.7
            c.poly([(x, y - 2), (x + 2, y), (x, y + 2), (x - 1, y)], 'i3' if i % 2 else 'i2')
            c.px(x, y, 'i4')


@sheet('sprite_ice_zero_sky', 128, 12, 'screen', ICE)
def _sprite_zero(c, f, n):
    """하늘 가운데 작은 눈꽃이 커지며 돌고 → 서리가 원형으로 번지고 → 거대 눈꽃이 번쩍 → 얼음 파편이 흩날린다."""
    cx, cy = 64, 60
    if f >= 3:
        r = min(56, 14 + (f - 3) * 9)
        c.ell(cx, cy, r, r * 0.9, 'i0')
        c.ell(cx, cy, r - 5, r * 0.9 - 5, 'i1')
        c.ring(cx, cy, r, r * 0.9, 'i2', 1)
        for i in range(12):
            a = i * math.pi / 6 + f * 0.1
            c.line([(cx + math.cos(a) * (r - 8), cy + math.sin(a) * (r - 8) * 0.9), (cx + math.cos(a) * r, cy + math.sin(a) * r * 0.9)], 'i3')
    size = [6, 10, 14, 18, 22, 26, 30, 34, 40, 44, 40, 30][f]
    snowflake(c, cx, cy, size, f * 0.22, ('i2', 'i3', 'i4') if f != 8 else ('i3', 'i4', 'i4'))
    if f == 8:
        c.star(cx, cy, 20, 'i4', 'i4', rot=0.2)
    if f >= 9:
        R = rng('sprite_ice_zero_sky')
        for i in range(24):
            a = R.random() * math.pi * 2
            d = 30 + (f - 9) * 14 + R.random() * 14
            x, y = cx + math.cos(a) * d, cy + math.sin(a) * d * 0.9
            s = 2 + R.random() * 2
            c.poly([(x, y - s), (x + s * 0.6, y), (x, y + s), (x - s * 0.6, y)], 'i3')
            c.px(x, y, 'i4')
    R = rng('snow', f)
    for i in range(20):
        x = (R.randint(8, 120) - f * 3) % 112 + 8
        y = (R.randint(8, 116) + f * 5) % 108 + 10
        c.px(x, y, 'sn')


# ───────── 만드라고라 ─────────
SCREAM = {'o': '#241408', 'r0': '#7a4e2a', 'r1': '#b07a44', 'r2': '#d8a868', 'mo': '#4a0e14',
          'p0': '#a0306a', 'p1': '#f07ab0', 'p2': '#ffc8e4', 'w': '#fff4fa', 'l1': '#3a8a2a', 'l2': '#72c43a', 'l3': '#c0ec6a'}


@sheet('mandrake_scream', 64, 10, 'allTargets', SCREAM)
def _mandrake_scream(c, f, n):
    """오른쪽에서 분홍 음파 고리가 밀려와 몸을 흔들고 → 머리 위 기절 별이 돈다."""
    for k in range(3):
        t = (f - k * 2) / 5
        if t < 0 or t > 1.2:
            continue
        x = 60 - t * 34
        r = 8 + t * 14
        col = ('p1', 'p2', 'p1')[k]
        c.arc(x, CY, r * 0.55, r, 110, 250, col, 2)
        c.arc(x + 3, CY, r * 0.45, r * 0.8, 120, 240, 'p0', 1)
    if 3 <= f <= 6:
        # 흔들림 선
        for y in (26, 36, 46):
            c.line([(CX - 16, y + (f % 2)), (CX - 12, y - 1 + (f % 2))], 'p2')
            c.line([(CX + 12, y - (f % 2)), (CX + 16, y + 1 - (f % 2))], 'p2')
    if f >= 5:
        # 기절 별 고리
        c.ring(CX, 18, 11, 3, 'p0')
        for i in range(3):
            a = f * 0.9 + i * math.pi * 2 / 3
            x, y = CX + math.cos(a) * 11, 18 + math.sin(a) * 3
            c.star(x, y, 3, 'p2', 'w', rot=f * 0.4)


@sheet('mandrake_wail_sky', 128, 12, 'screen', SCREAM)
def _mandrake_wail(c, f, n):
    """땅에서 거대한 만드라고라가 뽑혀 나오고 → 입을 크게 벌려 → 분홍 음파 고리가 겹겹이 무대를 채운다."""
    g = 104
    c.ell(64, g + 4, 40, 8, 'r0')
    c.ell(64, g + 2, 34, 5, 'o')
    rise = min(1, f / 4)
    top = g - 6 - rise * 60
    s = 26
    # 잎
    for dx, h, col in ((-14, 22, 'l1'), (14, 22, 'l1'), (0, 30, 'l2'), (-6, 26, 'l2'), (7, 24, 'l1')):
        c.poly([(64 + dx * 0.3, top + 4), (64 + dx - 4, top - h), (64 + dx + 4, top - h + 2)], col)
        c.line([(64 + dx * 0.3, top + 3), (64 + dx, top - h + 3)], 'l3')
    # 뿌리 몸
    c.ell(64, top + s, s, s * 1.05, 'r1')
    c.ell(56, top + s - 8, s * 0.45, s * 0.4, 'r2')
    c.poly([(64 - s * 0.6, top + s * 1.6), (64 + s * 0.6, top + s * 1.6), (64, g + 4)], 'r1')
    c.line([(80, top + s * 0.5), (84, top + s * 1.3)], 'r0', 2)
    # 뿌리 팔
    c.line([(64 - s, top + s), (64 - s - 12, top + s - 10 - rise * 6)], 'r1', 3)
    c.line([(64 + s, top + s), (64 + s + 12, top + s - 10 - rise * 6)], 'r1', 3)
    # 얼굴
    ey = top + s - 4
    c.ell(54, ey, 4, 3, 'o')
    c.ell(74, ey, 4, 3, 'o')
    mo = 3 + min(1, max(0, (f - 3) / 3)) * 9
    c.ell(64, ey + 12, mo * 0.8, mo, 'mo')
    c.ell(64, ey + 12 + mo * 0.3, mo * 0.5, mo * 0.4, 'p0')
    # 음파
    if f >= 5:
        for k in range(5):
            r = (f - 5) * 12 + k * 14 - 4
            if 12 < r < 70:
                c.ring(64, ey + 12, r, r * 0.8, 'p1' if k % 2 == 0 else 'p2', 2 if k % 2 == 0 else 1)
    if f in (6, 8, 10):
        for x, y in ((20, 30), (108, 34), (16, 90), (112, 88)):
            c.star(x, y, 5, 'p2', 'w')
