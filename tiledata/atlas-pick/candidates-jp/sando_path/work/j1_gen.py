import sys, os, random
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../house_roof/work'))
from j1_lib import C
OUT = os.path.dirname(os.path.dirname(__file__))
W = H = 32

def gravel(c, x0, x1, base, hi, lo, seed, rake=False, sp=0.16):
    r = random.Random(seed)
    for y in range(H):
        for x in range(x0, x1 + 1):
            v = r.random()
            t = base
            if v < sp * 0.5: t = lo
            elif v < sp: t = hi
            c.px(x, y, 'ishi', t)
    # 작은 자갈 덩이 2칸(흰 점 + 아래 그늘)
    for k in range(9):
        x = r.randint(x0, x1 - 1); y = r.randint(0, H - 2)
        c.px(x, y, 'ishi', hi + 1 if hi < 6 else 6); c.px(x + 1, y, 'ishi', hi)
        c.px(x, (y + 1) % H, 'ishi', lo); 
    if rake:
        for x in range(x0 + 1, x1, 3):
            for y in range(H):
                c.px(x, y, 'ishi', hi if y % 5 else base)

def slab(c, x, y, w, h, top, mid, low, edge, wrap=True, mossy=()):
    for j in range(h):
        for i in range(w):
            yy = (y + j) % H if wrap else y + j
            if i == 0 or j == 0: t = top
            elif i == w - 1 or j == h - 1: t = low
            else: t = mid
            c.px(x + i, yy, 'ishi', t)
    # 안쪽 윗줄 하이라이트 살짝 안쪽
    for i in range(1, w - 1):
        yy = (y + 1) % H
        c.px(x + i, yy, 'ishi', min(6, mid + 1) if top != mid else mid)

def joint(c, x, y, w, h, t, moss=()):
    for j in range(h):
        for i in range(w):
            c.px(x + i, (y + j) % H, 'ishi', t)

# ── A: 강남식. 흰 자갈, 판석 4단 톤, 틈 어둡게 + 이끼 점
a = C(W, H)
gravel(a, 0, 31, 5, 6, 4, 11)
for (xs, off) in ((7, 0), (17, 8)):
    for k in range(2):
        y = off + 16 * k
        joint(a, xs - 1, y, 11, 16, 0)     # 틈 배경
        slab(a, xs, y + 1, 9, 14, 4, 3, 2, 0)
        a.px(xs + 3, y + 8, 'ishi', 4); a.px(xs + 6, y + 5, 'ishi', 2)
# 이끼 틈
for (x, y) in ((4, 0), (4, 16), (16, 8), (16, 24), (15, 4), (27, 12), (10, 16), (22, 24)):
    a.px(x, y, 'moss', 2); a.px(x, (y + 1) % H, 'moss', 1)
a.save(os.path.join(OUT, 'j1-A.pxg'))

# ── B: 센 빛. 판석 윗면 밝게 + 오른쪽·아래 2칸 그림자 띠(어두운 돌), 자갈은 대비를 크게
b = C(W, H)
gravel(b, 0, 31, 5, 6, 3, 21, sp=0.22)
for (xs, off) in ((7, 0), (17, 8)):
    for k in range(2):
        y = off + 16 * k
        # 그림자 띠 (판석 오른쪽 2칸, 아래 1칸)
        for j in range(15):
            for i in range(9, 12):
                b.px(xs + i, (y + 1 + j + (1 if i > 9 else 0)) % H, 'ishi', 1 if i == 9 else 0)
        for i in range(0, 10):
            b.px(xs + i + 1, (y + 15) % H, 'ishi', 1)
        joint(b, xs - 1, y, 1, 16, 0)
        slab(b, xs, y + 1, 9, 14, 6, 4, 2, 0)
        b.hl(xs + 1, y + 2, 7, 'ishi', 5)
        b.px(xs + 4, y + 8, 'ishi', 3); b.px(xs + 5, y + 8, 'ishi', 3); b.px(xs + 6, y + 6, 'ishi', 5)
for (x, y) in ((4, 0), (16, 8), (15, 24), (27, 4)):
    b.px(x, y, 'moss', 3); b.px(x, (y + 1) % H, 'moss', 1)
b.save(os.path.join(OUT, 'j1-B.pxg'))

# ── C: 재해석. 크기 다른 손다듬은 돌 세 장씩 + 갈퀴 자국(세로 줄) 자갈, 틈에 이끼 띠
cc = C(W, H)
gravel(cc, 0, 31, 5, 6, 4, 31, rake=True, sp=0.08)
rows_l = [(0, 11), (11, 9), (20, 12)]    # 왼쪽 줄: 높이 11+9+12=32
rows_r = [(0, 13), (13, 10), (23, 9)]
for (xs, rws) in ((7, rows_l), (17, rows_r)):
    for (y, h) in rws:
        joint(cc, xs - 1, y, 11, h, 0)
        slab(cc, xs, y + 1, 9, h - 1, 4, 3, 2, 0)
        cc.px(xs + 3, y + h // 2, 'ishi', 2); cc.px(xs + 4, y + h // 2 + 1, 'ishi', 2)
for (xs, rws) in ((7, rows_l), (17, rows_r)):
    for (y, h) in rws:
        for i in range(0, 10, 2):
            cc.px(xs - 1 + i, y, 'moss', 2 + (i % 4 == 0))
cc.save(os.path.join(OUT, 'j1-C.pxg'))
