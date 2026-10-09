import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../house_roof/work'))
from j1_lib import C
OUT = os.path.dirname(os.path.dirname(__file__))
W, H = 32, 16

def cap(c, r, t3, y=1, rows=3):
    # 갓돌: 위 밝고 아래 어둡게. 좌우 끝은 그대로 이어지게(끝 표시 없음)
    c.hl(0, y, W, r, t3[0]); c.hl(0, y + 1, W, r, t3[1]); c.hl(0, y + 2, W, r, t3[2])
    c.hl(0, y + 3, W, r, t3[3])
    for x in range(15, W, 16): c.px(x, y + 1, r, t3[2])   # 갓돌 이음 눈금 16칸마다

def course(c, r, y, h, joints, hi, mid, lo, jt):
    for j in range(h):
        for x in range(W):
            if x in joints: t = jt
            elif j == 0: t = hi
            elif j == h - 1: t = lo
            else: t = mid
            c.px(x, y + j, r, t)
    for x in joints:                 # 줄눈 오른쪽 블록 왼쪽 면 밝게
        nx = (x + 1) % W
        for j in range(h): c.px(nx, y + j, r, hi if j == 0 else mid + 1)
        px_ = (x - 1) % W
        for j in range(h): c.px(px_, y + j, r, lo if j else mid - 1)

def shadow(c, rows):
    for y, ch in rows:
        for x in range(W): c.px(x, y, ch)

# ── A
a = C(W, H)
cap(a, 'pole', (5, 4, 3, 1))
course(a, 'pole', 5, 4, {7, 23}, 4, 3, 2, 1)
a.hl(0, 9, W, 'pole', 1)
course(a, 'pole', 10, 4, {15, 31}, 4, 3, 2, 1)
a.hl(0, 14, W, 'pole', 0)
# 구멍 무늬 블록 (가운데 x=8..22, 세 구멍 2x2)
for hx in (10, 14, 18):
    a.rect(hx, 6, 2, 2, 'pole', 0)
    a.px(hx + 1, 7, 'pole', 2)
shadow(a, [(15, '~')])
# 아래 이끼
for (x, y) in ((3, 13), (4, 13), (4, 12), (20, 13), (21, 13), (27, 13)): a.px(x, y, 'moss', 2)
a.px(3, 14, 'moss', 1); a.px(20, 14, 'moss', 1)
a.save(os.path.join(OUT, 'j1-A.pxg'))

# ── B: 센 빛 — 갓돌 아래에 처마 그늘, 블록 왼쪽 위가 강하게 밝고 오른쪽 아래는 확 어둡다, 발치 그림자 두 줄
b = C(W, H)
cap(b, 'pole', (5, 5, 3, 0))
course(b, 'pole', 5, 4, {7, 23}, 5, 3, 1, 0)
b.hl(0, 5, W, 'pole', 1); b.hl(0, 5, W, 'pole', 1)
for x in range(W):
    if x not in (7, 23): b.px(x, 5, 'pole', 2)       # 갓돌 그늘 밑 첫 줄은 짙게
b.hl(0, 9, W, 'pole', 0)
course(b, 'pole', 10, 4, {15, 31}, 5, 3, 1, 0)
b.hl(0, 14, W, 'pole', 0)
for hx in (10, 14, 18):
    b.rect(hx, 6, 2, 2, 'pole', 0)
    b.px(hx + 1, 7, 'pole', 3); b.px(hx, 6, 'pole', 0)
shadow(b, [(15, '~')])
for x in range(W):
    b.px(x, 14, 'pole', 0)
for x in range(W): b.px(x, 15, '~')
for (x, y) in ((3, 13), (4, 13), (4, 12), (20, 13), (21, 13), (27, 13)): b.px(x, y, 'moss', 3)
b.px(3, 14, 'moss', 1); b.px(20, 14, 'moss', 1)
b.save(os.path.join(OUT, 'j1-B.pxg'))

# ── C: 재해석 — 밝은 콘크리트(mconc)에 열십자 구멍 블록 한 줄(꽃블록)
cc = C(W, H)
cap(cc, 'mconc', (6, 5, 3, 1))
# 꽃블록 줄: 8칸 블록, 줄눈 x=7,15,23,31
for j in range(5):                       # y5..9
    for x in range(W):
        xm = x % 8
        if xm == 7: t = 1
        elif j == 0: t = 5 if xm == 0 else 4
        elif j == 4: t = 2
        else: t = 3 if xm else 4
        cc.px(x, 5 + j, 'mconc', t)
for bx in range(0, W, 8):
    for (dx, dy) in ((3, 6), (2, 7), (3, 7), (4, 7), (3, 8)):
        cc.px(bx + dx, dy, 'mconc', 0)
    cc.px(bx + 4, 8, 'mconc', 3)   # 안쪽 오른쪽 아래 빛 든 가장자리
cc.hl(0, 10, W, 'mconc', 1)
for j in range(3):                        # y11..13 아랫줄 (반 칸 어긋난 판)
    for x in range(W):
        xm = (x + 4) % 16
        if xm == 15: t = 1
        elif j == 0: t = 4
        elif j == 2: t = 2
        else: t = 3
        cc.px(x, 11 + j, 'mconc', t)
cc.hl(0, 14, W, 'mconc', 0)
shadow(cc, [(15, '~')])
for (x, y) in ((6, 13), (7, 13), (7, 12), (24, 13), (25, 13)): cc.px(x, y, 'moss', 2)
cc.save(os.path.join(OUT, 'j1-C.pxg'))
