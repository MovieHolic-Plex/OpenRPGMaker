import sys, os, math
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../house_roof/work'))
from j1_lib import C
OUT = os.path.dirname(os.path.dirname(__file__))
W = H = 16
CX = CY = 7.5
def d(x, y): return math.hypot(x - CX, y - CY)

def sidewalk(c, dark=False):
    for y in range(H):
        for x in range(W):
            k = (x * 5 + y * 7) % 11
            t = 5 if k == 0 else (3 if k in (4, 8) else 4)
            if dark: t -= 1
            c.px(x, y, 'mpave', t)
    for i in range(W):                                   # 보도블록 줄눈: 아래·오른쪽 끝
        c.px(i, 15, 'mpave', 1); c.px(15, i, 'mpave', 1)
        c.px(i, 0, 'mpave', 6 if not dark else 5); c.px(0, i, 'mpave', 6 if not dark else 5)
    c.px(15, 15, 'mpave', 0)

# 꽃 마스크: 다섯 잎(원 5개) + 가운데
PET = [(0, -2.7), (2.6, -0.8), (1.6, 2.2), (-1.6, 2.2), (-2.6, -0.8)]
def _perp(x, y, ang):
    dx, dy = x - CX, y - CY
    ux, uy = math.cos(ang), math.sin(ang)
    along = dx * ux + dy * uy
    return abs(-dx * uy + dy * ux), along
def flower_mask(R=4.7):
    m = set()
    for y in range(H):
        for x in range(W):
            r = d(x, y)
            if r > R or r < 1.3: continue
            cut = False
            for k in range(5):
                p, al = _perp(x, y, math.radians(-54 + 72 * k))
                if al > 1.6 and p < 0.62: cut = True          # 잎 사이 틈
                p, al = _perp(x, y, math.radians(-90 + 72 * k))
                if al > R - 1.05 and p < 0.45: cut = True      # 잎 끝 홈
            if not cut: m.add((x, y))
    return m
def grooves():
    return {(7, 7), (8, 8)}

def lid(c, field, ring_hi, ring_lo, groove, flower, fl_hi, fl_lo, rim_out, rim_hi, strong=False):
    for y in range(H):
        for x in range(W):
            r = d(x, y)
            if r > 6.9: continue
            ul = (x - CX) + (y - CY) < 0
            if r > 6.0: t = rim_out                                   # 바깥 테두리 어두운 단
            elif r > 5.0: t = ring_hi if ul else ring_lo               # 테두리 띠
            elif r > 4.4: t = groove                                  # 안쪽 홈
            else: t = field
            c.px(x, y, 'mmetal', t)
    if strong:
        for (x, y) in ((3, 4), (4, 3), (5, 2), (4, 4), (2, 5)): c.px(x, y, 'mmetal', rim_hi)
    m = flower_mask()
    for (x, y) in m:
        up = (x, y - 1) not in m; lf = (x - 1, y) not in m
        dn = (x, y + 1) not in m; rt = (x + 1, y) not in m
        if up or lf: t = fl_hi
        elif dn or rt: t = fl_lo
        else: t = flower
        c.px(x, y, 'mmetal', t)
    for (x, y) in ((7, 7), (8, 7), (7, 8), (8, 8)): c.px(x, y, 'mmetal', fl_lo if (x, y) != (7, 7) else fl_lo)
    c.px(7, 7, 'mmetal', field)

# A
c = C(W, H); sidewalk(c)
for y in range(H):                                             # 뚜껑 오른쪽·아래 바깥 그림자
    for x in range(W):
        if 6.9 < d(x, y) <= 7.8 and (x - CX) + (y - CY) > 1: c.px(x, y, 'mpave', 2)
lid(c, 2, 5, 2, 2, 4, 6, 2, 1, 6)
c.save(os.path.join(OUT, 'j1-A.pxg'))

# B: 센 빛
c = C(W, H); sidewalk(c, True)
for y in range(H):
    for x in range(W):
        if 6.9 < d(x, y) <= 8.4 and (x - CX) + (y - CY) > 0: c.px(x, y, 'mpave', 0 if d(x, y) < 7.6 else 1)
lid(c, 1, 6, 1, 1, 4, 7, 2, 0, 7, strong=False)
c.save(os.path.join(OUT, 'j1-B.pxg'))

# C: 새기(음각) + 미끄럼 방지 홈띠
c = C(W, H); sidewalk(c)
for y in range(H):
    for x in range(W):
        if 6.9 < d(x, y) <= 7.8 and (x - CX) + (y - CY) > 1: c.px(x, y, 'mpave', 2)
for y in range(H):
    for x in range(W):
        r = d(x, y)
        if r > 6.9: continue
        ul = (x - CX) + (y - CY) < 0
        if r > 6.0: t = 1
        elif r > 4.6: t = (5 if (x + y) % 2 == 0 else 3) if ul else (3 if (x + y) % 2 == 0 else 2)   # 격자 홈띠
        elif r > 4.0: t = 1
        else: t = 4 if ul else 3                                          # 가운데 메달리온
        c.px(x, y, 'mmetal', t)
m = flower_mask()
for (x, y) in m:
    up = (x, y - 1) not in m; lf = (x - 1, y) not in m
    dn = (x, y + 1) not in m; rt = (x + 1, y) not in m
    t = 1 if (up or lf) else (5 if (dn or rt) else 2)                     # 음각: 위·왼쪽이 어둡고 아래·오른쪽이 밝다
    c.px(x, y, 'mmetal', t)
for (x, y) in ((7, 7), (8, 7), (7, 8)): c.px(x, y, 'mmetal', 6)
c.px(8, 8, 'mmetal', 6)
c.save(os.path.join(OUT, 'j1-C.pxg'))
