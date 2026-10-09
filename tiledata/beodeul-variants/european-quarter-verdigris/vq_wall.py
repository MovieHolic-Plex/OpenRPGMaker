# 녹청 지붕 저택가 벽 — 크림 마름돌 줄쌓기·모서리돌·층 띠·창·덧문·문·차양·발코니. 결정적.
# 층 규격(장르 공통): 층 높이 32, 창 유리 층 위 기준 y 3..13, 창턱 14..15, 문은 층 위 6 부터 바닥까지.
# 칸(16px)마다 한 글자로 벽을 칠한다(storey). 빛은 왼쪽 위: 돌 윗모·왼모 +1, 아랫모 −1, 창 틀 왼·위 밝음.
from vq_base import *
from vq_base import _h

def ashlar(pen, x0, y0, x1, y1, seed=1, R=None, bh=4, lens=(10, 12, 8, 14), base=4):
    """크림 마름돌 줄쌓기: 줄 bh(돌 bh-1 + 줄눈 1), 돌 길이 lens 섞임(줄마다 엇갈림), 돌마다 단(4·4·5, 드물게 3),
    윗모 +1, 오른 끝 −1, 줄눈은 3단(밝은 돌이라 줄눈이 옅다), 드문 칩셋 결 −1."""
    R = R or CREAM
    gr = chip_t(ASHLAR_AT, 0, 3)
    for y in range(int(y0), int(y1)):
        row = (y - y0) // bh; ly = (y - y0) % bh
        # 줄마다 돌 경계: 해시로 길이를 고른다
        x = x0 - int(_h(row, 0, seed) * 9); bi = 0
        while x < x1:
            L_ = lens[int(_h(row, bi, seed + 1) * len(lens))]
            hb = _h(row, bi, seed + 2)
            k0 = base + (1 if hb > .55 else 0) - (1 if hb < .04 else 0)
            for xx in range(max(x, x0), min(x + L_, x1)):
                lx = xx - x
                if ly == bh - 1 or lx == L_ - 1: k = 3 if _h(xx, y, seed + 3) > .2 else 2
                else:
                    k = k0
                    if ly == 0: k += 1
                    if lx == L_ - 2: k -= 1
                    if gr[y % 16, xx % 16] == 0 and _h(xx, y, seed + 4) > .8: k -= 1
                pen.p(xx, y, R, clamp(k, 1, 6))
            x += L_; bi += 1

def quoins(pen, x, y0, y1, side=1, R=None):
    """모서리돌: 4px 줄마다 폭 5·3 엇갈림, 밝은 돌(TRIM), 윗모 6, 아랫모 2. side=1 왼쪽 모서리, −1 오른쪽 모서리."""
    R = R or TRIM
    for q in range(0, int(y1 - y0), 4):
        w = 5 if (q // 4) % 2 == 0 else 3
        for yy in range(int(y0) + q, min(int(y1), int(y0) + q + 4)):
            ly = yy - y0 - q
            for i in range(w):
                xx = x + i if side > 0 else x - i
                k = 6 if ly == 0 else (4 if ly < 3 else 2)
                if side < 0 and i == 0: k -= 1
                if side > 0 and i == 0: k = min(6, k + 1)
                pen.p(xx, yy, R, k)

def course(pen, x0, x1, y, R=None, deep=False):
    """층 띠(돌림 띠): 위 6 · 5 · 아래 3 · 그늘 2 (deep 이면 한 줄 더 — 처마 코니스)."""
    R = R or TRIM
    for x in range(int(x0), int(x1)):
        pen.p(x, y, R, 6 if x > x0 else 5); pen.p(x, y + 1, R, 4)
        if deep: pen.p(x, y + 2, R, 5 if (x - x0) % 4 else 3); pen.p(x, y + 3, R, 2)
        else: pen.p(x, y + 2, R, 2)

def wall_shadow(pen, x0, x1, y, rows=3, k=(.6, .72, .85)):
    """처마·차양·발코니 아래 그늘."""
    for j in range(rows):
        for x in range(int(x0), int(x1)): pen.dark(x, y + j, k[min(j, len(k) - 1)])

def window(pen, x, y, w=8, h=11, kind='w', seed=1, lit=False):
    """창: 밝은 돌 틀(왼·위 5·6, 오른·아래 3), 어두운 유리(위 2 · 아래 1, 왼쪽 위 하늘 반짝), 가운데 창살 + 가로 창살,
    위 상인방(돌 3px, 가운데 쐐기돌), 아래 창턱(2px, 양쪽 1px 튀어나옴).
    kind: w 유리창 · S 닫힌 덧문(회록 겹친 살) · H 반쯤 열린 덧문(양쪽으로 접힌 덧문 + 유리) · A 아치 창(둥근 위)."""
    T_ = TRIM
    for yy in range(y - 1, y + h + 1):
        for xx in range(x - 1, x + w + 1):
            if x <= xx < x + w and y <= yy < y + h: continue
            pen.p(xx, yy, T_, 5 if (xx < x or yy < y) else 3)
    if kind == 'A':
        r = w / 2.0
        for yy in range(y - int(r) - 1, y):
            for xx in range(x - 1, x + w + 1):
                d = math.hypot(xx + .5 - (x + r), yy + .5 - y)
                if d <= r - .2: pen.p(xx, yy, GLASS, 2)
                elif d <= r + 1.1: pen.p(xx, yy, T_, 5 if xx < x + r else 3)
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            if kind in 'S':
                ly = (yy - y) % 2
                k = 4 if ly == 0 else 2
                if xx == x + w // 2 or xx == x + w // 2 - 1: k = 1 if xx == x + w // 2 else 3
                if xx == x: k += 1
                pen.p(xx, yy, SHUT, clamp(k, 1, 6))
            elif kind == 'L':
                pen.p(xx, yy, AMBER, 4 if yy < y + h // 2 else 3)
            else:
                pen.p(xx, yy, GLASS, 2 if yy < y + h * .45 else 1)
    if kind not in 'SL':
        pen.p(x, y + 1, GLASS, 5); pen.p(x + 1, y + 1, GLASS, 4); pen.p(x, y + 2, GLASS, 4)
        if kind == 'A': pen.p(x + 1, y - 2, GLASS, 4)
    if kind == 'L':
        pen.p(x, y, AMBER, 6); pen.p(x + 1, y, AMBER, 5)
    if kind in 'wAHL':
        for yy in range(y, y + h): pen.p(x + w // 2, yy, T_, 3 if kind != 'L' else 2)
        for xx in range(x, x + w): pen.p(xx, y + h // 2 - 1, T_, 3 if kind != 'L' else 2)
    if kind == 'H':                                                       # 접힌 덧문(창 양옆 벽 위)
        for yy in range(y - 1, y + h + 1):
            for j, xx in enumerate((x - 4, x - 3, x - 2)):
                pen.p(xx, yy, SHUT, (3, 4, 2)[j] if (yy - y) % 2 == 0 else (2, 3, 1)[j])
            for j, xx in enumerate((x + w + 1, x + w + 2, x + w + 3)):
                pen.p(xx, yy, SHUT, (4, 3, 1)[j] if (yy - y) % 2 == 0 else (3, 2, 1)[j])
    for xx in range(x - 2, x + w + 2):                                      # 상인방
        if kind == 'A': break
        pen.p(xx, y - 3, T_, 6 if xx < x + w // 2 else 5); pen.p(xx, y - 2, T_, 4)
    if kind != 'A':
        for xx in (x + w // 2 - 1, x + w // 2):
            pen.p(xx, y - 4, T_, 6); pen.p(xx, y - 3, T_, 6)
    for xx in range(x - 2, x + w + 2):                                      # 창턱
        pen.p(xx, y + h + 1, T_, 6 if xx < x + w else 5); pen.p(xx, y + h + 2, T_, 3)
    for xx in range(x - 1, x + w + 1): pen.dark(xx, y + h + 3, .72)

def flowerbox(pen, x, y, w, seed=1, R=None):
    """창턱 아래 꽃상자: 짙은 나무 상자(3px) + 위로 둥근 잎 덩이와 붉은/누른 꽃점."""
    R = R or FLOWR
    for xx in range(x, x + w):
        pen.p(xx, y, WOOD, 4 if xx < x + w - 1 else 2); pen.p(xx, y + 1, WOOD, 3); pen.p(xx, y + 2, WOOD, 2)
    for xx in range(x, x + w):
        hh = 2 + int(_h(xx, seed, 7) * 2.5)
        for j in range(hh):
            pen.p(xx, y - 1 - j, LEAF, 4 if j == hh - 1 else 3)
        if _h(xx, seed, 8) > .55: pen.p(xx, y - hh, R, 5 if _h(xx, seed, 9) > .4 else 6)
        if _h(xx, seed, 10) > .75: pen.p(xx, y - 1, R, 4)

def door(pen, x, y, w=12, h=26, kind='double', seed=1):
    """문: 돌 문틀(3px, 위 상인방) + 문짝. double 쌍여닫이 패널 문(회갈 나무, 위 유리 채광) ·
    grand 큰 문(아치 채광창 + 쌍문 + 쇠 손잡이) · gate 아치 마차 문(널빤지 + 쇠 띠) · glass 가게 유리문."""
    T_ = TRIM
    for yy in range(y - 2, y + h):                                       # 문틀
        pen.p(x - 2, yy, T_, 5); pen.p(x - 1, yy, T_, 4); pen.p(x + w, yy, T_, 3); pen.p(x + w + 1, yy, T_, 2)
    if kind in ('grand', 'gate'):
        r = (w + 2) / 2.0; cx = x + w / 2.0
        for yy in range(y - int(r) - 3, y + 1):
            for xx in range(x - 3, x + w + 3):
                d = math.hypot(xx + .5 - cx, yy + .5 - y)
                if d <= r - 1: pen.p(xx, yy, GLASS if kind == 'grand' else DARK, 2 if kind == 'grand' else 2)
                elif d <= r + 1.2: pen.p(xx, yy, T_, 6 if xx < cx else 3)
        pen.p(int(cx) - 1, y - int(r) - 2, T_, 6); pen.p(int(cx), y - int(r) - 2, T_, 6)
        if kind == 'grand':
            for a in range(-2, 3):
                xx = int(cx + a * r * .4); pen.p(xx, y - 2, T_, 3); pen.p(xx, y - 3, T_, 3)
    else:
        for xx in range(x - 2, x + w + 2): pen.p(xx, y - 3, T_, 6 if xx < x + w // 2 else 5); pen.p(xx, y - 2, T_, 4)
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            lx = xx - x; ly = yy - y
            if kind == 'glass':
                k = 2 if ly < h * .5 else 1
                pen.p(xx, yy, GLASS, k)
                if lx in (0, w - 1) or ly in (0, h - 1) or lx == w // 2: pen.p(xx, yy, WOOD, 3)
                continue
            if kind == 'gate':
                k = 3 + (1 if (lx % 4) == 0 else 0) - (1 if (lx % 4) == 3 else 0)
                if ly in (4, h - 6): k = 2 if lx % 6 else 4
                pen.p(xx, yy, WOOD, k) if ly not in (4, h - 6) else pen.p(xx, yy, IRON, k)
                continue
            half = w // 2
            k = 3
            if kind == 'double' and ly < 6:
                pen.p(xx, yy, GLASS, 2 if ly < 3 else 1)
                if lx == half or ly == 5: pen.p(xx, yy, WOOD, 2)
                continue
            px_ = lx if lx < half else lx - half; hw = half
            if px_ == 0: k = 5
            elif px_ == hw - 1: k = 2
            elif ly in (8, 9, h - 9, h - 8) or ((ly > 9 and ly < h - 9 or ly > h - 8 and ly < h - 2) and px_ in (2, hw - 3)): k = 2 if ly in (9, h - 8) or px_ == hw - 3 else 4
            pen.p(xx, yy, WOOD, k)
    if kind in ('double', 'grand'):
        pen.p(x + w // 2 - 2, y + h // 2 + 2, TRIM, 6); pen.p(x + w // 2 + 1, y + h // 2 + 2, TRIM, 6)
    for xx in range(x - 3, x + w + 3):                                     # 문턱 돌
        pen.p(xx, y + h - 1, PLIN, 5 if xx < x + w // 2 else 4)

def awning(pen, x0, x1, y, depth=8, seed=1):
    """줄무늬 차양(녹색·크림, 줄 4px): 위 쇠 막대, 비스듬히 내려오는 천(위 밝게·아래 그늘), 아래 물결 끝단, 아래 벽에 그늘."""
    for xx in range(x0 - 1, x1 + 1): pen.p(xx, y, IRON, 4 if xx < (x0 + x1) // 2 else 2)
    for j in range(1, depth + 1):
        for xx in range(x0 - (j // 3), x1 + (j // 3)):
            stripe = ((xx - x0 + 40) // 4) % 2
            R = AWNG if stripe == 0 else AWNC
            k = 5 if j < 3 else (4 if j < depth - 2 else 3)
            if xx < x0 + 1: k += 1
            pen.p(xx, y + j, R, k)
    yb = y + depth + 1
    for xx in range(x0 - depth // 3, x1 + depth // 3):
        stripe = ((xx - x0 + 40) // 4) % 2; R = AWNG if stripe == 0 else AWNC
        lx = (xx - x0 + 40) % 4
        pen.p(xx, yb, R, 3)
        if lx in (1, 2): pen.p(xx, yb + 1, R, 2)
    wall_shadow(pen, x0, x1, yb + 2, 3, (.55, .66, .8))

def balcony(pen, x0, x1, yfloor, h=8):
    """쇠 발코니: 아래 돌 판(윗면 TRIM 6·5 + 앞모 3·2, 밑 그늘), 위 난간(가로대 2 + 살 2px 간격 + 끝 기둥 공 머리)."""
    for xx in range(x0 - 1, x1 + 1):
        pen.p(xx, yfloor, TRIM, 6 if xx > x0 else 5); pen.p(xx, yfloor + 1, TRIM, 5); pen.p(xx, yfloor + 2, TRIM, 3); pen.p(xx, yfloor + 3, TRIM, 2)
    wall_shadow(pen, x0, x1, yfloor + 4, 2, (.6, .78))
    top = yfloor - h
    for xx in range(x0, x1):
        pen.p(xx, top, IRON, 5); pen.p(xx, top + 1, IRON, 2)
        pen.p(xx, yfloor - 2, IRON, 4)
        if (xx - x0) % 2 == 0:
            for yy in range(top + 2, yfloor - 1): pen.p(xx, yy, IRON, 4 if yy < top + 4 else 3)
        if (xx - x0) % 6 == 3: pen.p(xx, top + 4, IRON, 5); pen.p(xx - 1, top + 5, IRON, 4); pen.p(xx + 1, top + 5, IRON, 4)
    for xx in (x0, x1 - 1):
        for yy in range(top - 1, yfloor): pen.p(xx, yy, IRON, 5 if xx == x0 else 3)
        pen.p(xx, top - 2, IRON, 6)

def balconette(pen, x, y, w=10):
    """창 앞 작은 쇠 난간(창턱 위 6px): 살 + 가운데 고리 무늬."""
    for xx in range(x, x + w):
        pen.p(xx, y, IRON, 5); pen.p(xx, y + 5, IRON, 4)
        if (xx - x) % 2 == 0:
            for yy in range(y + 1, y + 5): pen.p(xx, yy, IRON, 3)
    cx = x + w // 2
    for (dx, dy) in ((-1, 2), (0, 1), (1, 2), (0, 3)): pen.p(cx + dx, y + dy, IRON, 5)

def storey(pen, x0, ytop, kinds, seed=1, ground=False, lit=(), boxes=(), quoin=(True, True)):
    """한 층(높이 32)을 칠한다. kinds: 칸마다 한 글자.
    p 민벽 · w 유리창 · S 덧문 닫힌 창 · H 덧문 열린 창 · A 아치 창 · F 창+꽃상자 · B 창+쇠 난간 · L 불 켜진 창
    d 쌍문(2칸에 걸쳐 가운데) · G 큰 문(아치 채광창) · C 마차 문(아치, 2칸) · s 가게 진열창 · g 가게 유리문 · n 벽감(빈 벽 조각 장식)"""
    wc = len(kinds); x1 = x0 + wc * 16; yb = ytop + 32
    ashlar(pen, x0, ytop, x1, yb, seed=seed + ytop)
    if ground:                                                            # 1층 받침
        ashlar(pen, x0, yb - 8, x1, yb, seed=seed + 77, R=PLIN, bh=4, lens=(16, 12, 20))
        for xx in range(x0, x1): pen.p(xx, yb - 9, PLIN, 6); pen.p(xx, yb - 1, PLIN, 2)
    i = 0
    while i < wc:
        k = kinds[i]; cx = x0 + i * 16
        if k in 'wSHAL': window(pen, cx + 4, ytop + 3, 8, 11, k, seed + i)
        elif k == 'F':
            window(pen, cx + 4, ytop + 3, 8, 11, 'w', seed + i); flowerbox(pen, cx + 3, ytop + 17, 10, seed + i + ytop)
        elif k == 'B':
            window(pen, cx + 4, ytop + 3, 8, 13, 'w', seed + i); balconette(pen, cx + 3, ytop + 10, 10)
        elif k == 'd':
            door(pen, cx + 10, ytop + 6, 12, 26, 'double', seed + i); i += 1
        elif k == 'G':
            door(pen, cx + 9, ytop + 9, 14, 23, 'grand', seed + i); i += 1
        elif k == 'C':
            door(pen, cx + 5, ytop + 11, 22, 21, 'gate', seed + i); i += 1
        elif k == 'g':
            door(pen, cx + 3, ytop + 8, 10, 24, 'glass', seed + i)
        elif k == 's':
            for yy in range(ytop + 8, yb - 9):
                for xx in range(cx + 1, cx + 15):
                    lx = xx - cx
                    if lx in (1, 14) or yy in (ytop + 8, yb - 10): pen.p(xx, yy, WOOD, 4 if lx == 1 or yy == ytop + 8 else 2)
                    else:
                        pen.p(xx, yy, GLASS, 2 if yy < ytop + 14 else 1)
                        if lx == 8: pen.p(xx, yy, WOOD, 3)
            pen.p(cx + 2, ytop + 9, GLASS, 5); pen.p(cx + 3, ytop + 9, GLASS, 4); pen.p(cx + 2, ytop + 10, GLASS, 4)
            for xx in range(cx + 3, cx + 13, 3):                          # 진열 상품(그림 기호: 병·빵·꽃 점)
                pen.p(xx, yb - 12, AMBER, 4); pen.p(xx, yb - 13, AMBER, 5); pen.p(xx + 1, yb - 12, FLOWR, 4)
        elif k == 'n':
            for yy in range(ytop + 4, ytop + 18):
                for xx in range(cx + 5, cx + 11):
                    d = yy - (ytop + 4)
                    if d < 3 and abs(xx + .5 - (cx + 8)) > 1.5 + d: continue
                    pen.p(xx, yy, CREAM, 2 if xx < cx + 7 else 3)
            pen.p(cx + 7, ytop + 12, TRIM, 6); pen.p(cx + 8, ytop + 12, TRIM, 5); pen.p(cx + 7, ytop + 13, TRIM, 5); pen.p(cx + 8, ytop + 13, TRIM, 3)
        i += 1
    if quoin[0]: quoins(pen, x0, ytop, yb, 1)
    if quoin[1]: quoins(pen, x1 - 1, ytop, yb, -1)
