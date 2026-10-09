# 비행선 이물(뱃머리): 칸 계단 없이 화소 곡선으로 좁아지는 갑판 + 곡선을 따라 도는 난간 + 아래로 말려 드는 선체 앞면.
# 갑판 오토타일·난간 오토타일·선체 앞면(face_hull)과 이음매가 맞도록 같은 결(deck_px·hull_px)과 같은 난간 높이를 쓴다.
from as_kit import *
from as_kit import _hash

BW, BH = 10, 14                     # 조각 크기(칸): 갑판 4줄 위(난간 줄) ~ 선체 아래까지
X0, Y0 = 0, 0
L = 148.0                           # 곡선 길이(px)
YC = 80.0                           # 조각 안 갑판 가운데 줄(px) — 갑판 난간 줄 위 끝 = YC - 80
HW0 = 80.0

PAD = 16
def hw(x):
    if x < 0: return HW0
    u = x / L
    if u >= 1: return 0.0
    return HW0 * max(0.0, 1 - u ** 2.0) ** .62

def bow_image(gx0=0, gy0=0):
    """gx0, gy0 = 이 조각 왼쪽 위의 전역 px(결을 이어 그리려고). 투명 바탕."""
    W, H = BW * T, BH * T
    cv = Cv(W + PAD, H)
    _px = cv.px
    cv.px = lambda x, y, c: _px(x + PAD, y, c)
    for x in range(-PAD, W):
        h = hw(x + .5)
        if h <= 0: continue
        yn = YC - h; ys = YC + h
        dep = max(3.0, 48.0 * max(0.0, 1 - (max(0, x) / L) ** 2.2) ** .5)
        for y in range(H):
            yy = y + .5
            if yn <= yy < ys:                                                       # 갑판 윗면
                c = deck_px((gx0 + x) % 48, (gy0 + y) % 48) if x >= 0 else WD[4]
                d = yy - yn
                if d < 1: c = WD[6]
                elif d < 2: c = mix(c, WD[6], .35)
                if ys - yy < 4:
                    k = ys - yy
                    c = BR[6] if k > 3 else (BR[4] if k > 2 else (WD[3] if k > 1 else WD[1]))
                cv.px(x, y, c)
            elif ys <= yy < ys + dep:                                               # 선체 앞면(아래로 말려 든다)
                t = (yy - ys) / dep
                c = hull_px(gx0 + x, int(t * 47.99), 48)
                if t > .9: c = mul(c, .8)
                if yy + 1 >= ys + dep: c = DK
                cv.px(x, y, c)
    # 난간: 곡선 위 같은 높이(윗 띠 +2..+4 놋쇠, +5..+6 나무, +7..+12 난간동자, +13..+14 아래 띠)
    def rail(edge_y_of, side):
        for x in range(-PAD, W):
            h = hw(x + .5)
            if h < 6: continue
            e = edge_y_of(x, h)
            for (dy, c) in ((2, BR[6]), (3, BR[5]), (4, BR[3]), (5, WD[5]), (6, WD[2]), (13, WD[4]), (14, WD[2])):
                cv.px(x, int(e + dy), c)
            if x % 4 in (1, 2):
                for dy in range(7, 13):
                    cv.px(x, int(e + dy), WD[6] if x % 4 == 1 else WD[4])
    rail(lambda x, h: YC - h, 'N')
    rail(lambda x, h: YC + h - 16, 'S')
    # 이물 끝 기둥(두 난간이 만나는 곳)
    tx = int(L - 12)
    for y in range(int(YC - 12), int(YC + 3)):
        for x in range(tx, tx + 6):
            c = WD[5] if x < tx + 2 else (WD[4] if x < tx + 4 else WD[2])
            if y < YC - 9: c = BR[6] if x < tx + 3 else BR[4]
            cv.px(x, y, c)
    return fin(cv.im, .62).crop((PAD, 0, PAD + W, H))

def bow_walk(px_cell):
    """칸 (i, j)(조각 안) 이 걷기인가: 칸 가운데가 갑판 윗면이고 난간 띠(가장자리 16px) 안쪽."""
    i, j = px_cell
    cx = i * T + 8; cy = j * T + 8
    h = hw(cx)
    return h > 0 and (YC - h + 16) <= cy < (YC + h - 16)

def bow_deck(px_cell):
    """칸이 갑판 윗면(난간 포함)에 걸치는가."""
    i, j = px_cell
    cx = i * T + 8; cy = j * T + 8
    h = hw(cx)
    return h > 0 and (YC - h) <= cy < (YC + h)
