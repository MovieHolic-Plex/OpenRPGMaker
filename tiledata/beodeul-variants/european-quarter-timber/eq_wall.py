# 목골 구시가 벽 그리기 — 층(32px)마다 칸(16px) 문자열로 벽을 칠한다. 결정적.
# 바탕 결은 버들항 칩셋 벽 칸(pj.tex 'tim.wall' 회벽 · 'sto.wall' 돌)을 그대로 쓰고 밝기 순위만 새 램프(PLAS·STN)로 옮긴다.
# 목골 들보는 pj 기둥 규칙(3화소, 왼쪽 밝음 4·3·1단)을 적갈 램프 BEAM 으로, 벽돌은 4화소 줄·8화소 길이 엇갈림.
# 층 규격(장르 공통): 층 높이 32, 창 유리 y 3..14(층 위 기준), 창턱 14..15, 문은 층 위 6 부터 바닥까지.
from eq_base import *
EARTH_D = [hx(c) for c in ('#1c140e', '#33261a', '#4a3826', '#5f4a33', '#755d42', '#8c7254', '#a48a6a')]

_TX = {}
def _tex(key, W, Hh):
    k = (key, W, Hh)
    if k not in _TX:
        if key == 'plaster':
            im = pj.tex('tim.wall', W, Hh); recolor(im, lambda r, g, b: True, PLAS)
        elif key == 'stone':
            im = pj.tex('sto.wall', W, Hh); recolor(im, lambda r, g, b: True, STN)
        _TX[k] = im
    return _TX[k].copy()

def brick_fill(px, W, Hh, x0, y0, x1, y1, seed, R_=None, mortar=None):
    """붉은 벽돌 쌓기: 줄 4px(벽돌 3 + 줄눈 1), 벽돌 길이 8, 줄마다 4 엇갈림. 벽돌마다 단 하나씩 다르고 윗모 밝게·오른 끝 그늘."""
    R_ = R_ or BRICK; mortar = mortar or PLAS[2]
    for y in range(y0, y1):
        row = (y - y0) // 4; ly = (y - y0) % 4; off = 4 if row % 2 else 0
        for x in range(x0, x1):
            lx = (x - x0 + off) % 8; bi = (x - x0 + off) // 8
            if ly == 3 or lx == 7: c = mortar if H(bi, row, seed + 3) > 0.15 else PLAS[1]
            else:
                t = 3 + int(H(bi, row, seed) * 2.6)
                if ly == 0: t = min(6, t + 1)
                if lx == 6: t = max(1, t - 1)
                if H(x, y, seed + 9) > 0.93: t = max(1, t - 1)
                c = R_[t]
            put(px, W, Hh, x, y, c)

def post(px, W, Hh, x, y0, y1, R_=None):
    """세로 들보 3화소: 왼 밝음."""
    R_ = R_ or BEAM
    for y in range(y0, y1):
        put(px, W, Hh, x, y, R_[5]); put(px, W, Hh, x + 1, y, R_[4]); put(px, W, Hh, x + 2, y, R_[2])
def rail(px, W, Hh, x0, x1, y, R_=None, thick=2):
    R_ = R_ or BEAM
    for x in range(x0, x1):
        put(px, W, Hh, x, y, R_[5] if thick > 1 else R_[4])
        if thick > 1: put(px, W, Hh, x, y + 1, R_[2])
        if thick > 2: put(px, W, Hh, x, y + 2, R_[1])
def brace(px, W, Hh, xa, ya, xb, yb, R_=None):
    """빗 들보 2화소(아래·오른 쪽 그늘)."""
    R_ = R_ or BEAM
    n = max(abs(xb - xa), abs(yb - ya))
    for j in range(n + 1):
        x = xa + round((xb - xa) * j / n); y = ya + round((yb - ya) * j / n)
        put(px, W, Hh, x, y, R_[4]); put(px, W, Hh, x + 1, y, R_[2])

def window(px, W, Hh, x, y, w=7, h=11, frame=None, shutter=None, box=None, arch=False, lit=False, seed=1):
    """창: 테 1화소(위·왼 밝게), 유리 위 어둡고 아래·오른쪽 반사, 가운데 창살 십자. shutter=AWN 색 키, box=꽃 색 키(창 밑 화분)."""
    F = frame or BEAM
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            if arch and yy == y and (xx == x or xx == x + w - 1): continue
            t = 1 if yy < y + 4 else (2 if yy < y + 8 else 3)
            if xx >= x + w - 2 and yy > y + h // 2: t = 4
            put(px, W, Hh, xx, yy, GLASS[t])
    put(px, W, Hh, x + 1, y + 1 + (1 if arch else 0), GLASS[5]); put(px, W, Hh, x + 1, y + 2 + (1 if arch else 0), GLASS[4])
    mx = x + w // 2
    for yy in range(y, y + h): put(px, W, Hh, mx, yy, F[3])
    for xx in range(x, x + w): put(px, W, Hh, xx, y + h // 2, F[3])
    for yy in range(y - 1, y + h + 1): put(px, W, Hh, x - 1, yy, F[4]); put(px, W, Hh, x + w, yy, F[1])
    for xx in range(x - 1, x + w + 1): put(px, W, Hh, xx, y - 1, F[5] if not arch else F[4])
    for xx in range(x - 2, x + w + 2): put(px, W, Hh, xx, y + h, WD[5]); put(px, W, Hh, xx, y + h + 1, WD[2])   # 창턱
    if shutter:
        S = AWN[shutter]
        for (sx, sw) in ((x - 4, 3), (x + w + 1, 3)):
            for yy in range(y - 1, y + h + 1):
                for i in range(sw):
                    t = (5, 4, 2)[i] if sx < x else (4, 3, 1)[i]
                    if yy in (y - 1, y + h): t = 2
                    elif (yy - y) % 4 == 3: t = max(1, t - 1)
                    put(px, W, Hh, sx + i, yy, S[t])
    if box:
        flowerbox(px, W, Hh, x - 2, y + h + 2, w + 4, box, seed)

def flowerbox(px, W, Hh, x, y, w, col, seed=1):
    """창 밑 나무 화분 상자 + 꽃 덩이(꽃 위로 1~3화소 솟음, 잎 사이)."""
    Fl = FLWR[col]
    for xx in range(x, x + w):
        put(px, W, Hh, xx, y, WD[5]); put(px, W, Hh, xx, y + 1, WD[4]); put(px, W, Hh, xx, y + 2, WD[2])
    put(px, W, Hh, x, y + 1, WD[3]); put(px, W, Hh, x + w - 1, y + 1, WD[1])
    for xx in range(x, x + w):
        hgt = 1 + int(H(xx, seed, 3) * 2.5)
        for j in range(hgt):
            put(px, W, Hh, xx, y - 1 - j, LEAF[3 if j == 0 else 4] if H(xx, j, seed) > 0.45 else LEAF[2])
        if H(xx, seed, 5) > 0.4:
            yy = y - hgt - (0 if H(xx, seed, 6) > 0.5 else -1)
            put(px, W, Hh, xx, yy, Fl[5] if H(xx, seed, 7) > 0.4 else Fl[3])
            if H(xx, seed, 8) > 0.7: put(px, W, Hh, xx, yy - 1, Fl[6])

def door(px, W, Hh, x, y, w=10, h=24, kind='plank', col=None, frame=None, seed=1):
    """문: 널문(세로 널 3화소, 쇠 띠 둘, 손잡이) 또는 아치 문. 테는 돌/들보."""
    Wd = col or WD; F = frame or STN
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            if kind == 'arch' and yy < y + 3 and abs(xx + 0.5 - (x + w / 2)) > (w / 2) * (0.55 + 0.15 * (yy - y)): continue
            t = 4 if (xx - x) % 3 else 2
            if xx == x: t = 5
            if xx == x + w - 1: t = 2
            if yy > y + h - 4: t = max(1, t - 1)
            put(px, W, Hh, xx, yy, Wd[t])
    for yy in (y + 5, y + h - 7):
        for xx in range(x + 1, x + w - 1): put(px, W, Hh, xx, yy, IRON[3] if xx % 2 else IRON[2])
    put(px, W, Hh, x + w - 3, y + h // 2, GOLD[5]); put(px, W, Hh, x + w - 3, y + h // 2 + 1, GOLD[3])
    for yy in range(y - 1, y + h):
        put(px, W, Hh, x - 1, yy, F[5]); put(px, W, Hh, x - 2, yy, F[4]); put(px, W, Hh, x + w, yy, F[2]); put(px, W, Hh, x + w + 1, yy, F[1])
    for xx in range(x - 2, x + w + 2):
        if kind == 'arch': continue
        put(px, W, Hh, xx, y - 1, F[5]); put(px, W, Hh, xx, y - 2, F[4])
    for xx in range(x - 2, x + w + 2): put(px, W, Hh, xx, y + h, F[6]); put(px, W, Hh, xx, y + h + 1, F[3])     # 문턱 돌

def storey(im, x0, ytop, wc, kinds, mat='timber', seed=1, jetty=False, eave=False, pattern='x', box_col='red', shutter=None, wpx=None, base=False):
    """한 층(높이 32)을 칠한다. kinds: 칸마다 한 글자.
    목골: p 민벽(위·아래 칸막이) x 엇십자 빗대 k 시옷 빗대 m '\\' n '/' w 창 W 창+화분 S 창+덧문 B 창+화분+덧문 d 문 o 둥근 다락창
    벽돌/돌: p 민벽 w 창 W 창+화분 d 문 D 쌍문 s 가게 진열창 a 아치 창 g 아치 통로(그늘)"""
    px = im.load(); W, Hh = im.size; wpx = wpx or wc * 16; x1 = x0 + wpx; yb = ytop + 32
    if mat == 'timber':
        t = _tex('plaster', wpx, 32); im.alpha_composite(t, (x0, ytop)); px = im.load()
    elif mat == 'stone':
        t = _tex('stone', wpx, 32); im.alpha_composite(t, (x0, ytop)); px = im.load()
    else:
        brick_fill(px, W, Hh, x0, ytop, x1, yb, seed)
    if base and mat != 'timber': base_band(im, x0, x1, yb - 2); px = im.load()
    if mat == 'timber':
        rail(px, W, Hh, x0, x1, ytop, thick=2); rail(px, W, Hh, x0, x1, ytop + 18, thick=2); rail(px, W, Hh, x0, x1, yb - 2, thick=2)
        for i in range(wc + 1):
            xx = min(x0 + i * 16, x1 - 3)
            post(px, W, Hh, xx, ytop, yb)
    for i, k in enumerate(kinds):
        cx = x0 + i * 16
        if mat == 'timber':
            a0, a1 = ytop + 2, ytop + 18; b0, b1 = ytop + 20, yb - 2      # 위 칸막이 / 아래 칸막이
            if k in 'x':
                brace(px, W, Hh, cx + 3, b0, cx + 14, b1 - 1); brace(px, W, Hh, cx + 13, b0, cx + 3, b1 - 1)
                brace(px, W, Hh, cx + 3, a0, cx + 14, a1 - 1); brace(px, W, Hh, cx + 13, a0, cx + 3, a1 - 1)
            elif k == 'k':
                brace(px, W, Hh, cx + 3, a0 + 7, cx + 8, a0); brace(px, W, Hh, cx + 8, a0, cx + 13, a0 + 7)
                brace(px, W, Hh, cx + 3, b1 - 1, cx + 8, b0); brace(px, W, Hh, cx + 8, b0, cx + 13, b1 - 1)
            elif k == 'm': brace(px, W, Hh, cx + 3, a0, cx + 13, b1 - 1)
            elif k == 'n': brace(px, W, Hh, cx + 13, a0, cx + 3, b1 - 1)
            elif k in 'pP':
                if k == 'P': post(px, W, Hh, cx + 7, ytop + 2, yb - 2)
            if k in 'wWSB':
                window(px, W, Hh, cx + 5, ytop + 3, 7, 11, shutter=(shutter or 'grn') if k in 'SB' else None,
                       box=box_col if k in 'WB' else None, seed=seed + i)
                if k not in 'WB':
                    brace(px, W, Hh, cx + 3, b0, cx + 7, b1 - 1); brace(px, W, Hh, cx + 13, b0, cx + 9, b1 - 1)
            if k == 'o':
                for yy in range(ytop + 5, ytop + 14):
                    for xx in range(cx + 4, cx + 13):
                        d = (xx - cx - 8) ** 2 + (yy - ytop - 9.5) ** 2
                        if d <= 18: put(px, W, Hh, xx, yy, GLASS[2 if yy < ytop + 10 else 3])
                        elif d <= 26: put(px, W, Hh, xx, yy, BEAM[4 if xx < cx + 8 else 2])
                for yy in range(ytop + 5, ytop + 14): put(px, W, Hh, cx + 8, yy, BEAM[3])
            if k == 'd':
                door(px, W, Hh, cx + 3, ytop + 6, 10, 24, frame=BEAM, seed=seed + i)
        else:
            if k in 'wW': window(px, W, Hh, cx + 5, ytop + 3, 7, 11, frame=STN if mat == 'stone' else STN, box=box_col if k == 'W' else None, seed=seed + i)
            if k in 'wW' and mat == 'brick':                                      # 벽돌 창 위 세운 벽돌 아치(평아치)
                for xx in range(cx + 3, cx + 14): put(px, W, Hh, xx, ytop + 1, BRICK[5] if xx % 2 else BRICK[3]); put(px, W, Hh, xx, ytop + 0, BRICK[2])
            if k == 'a':
                window(px, W, Hh, cx + 5, ytop + 3, 7, 13, frame=STN, arch=True, seed=seed + i)
            if k == 'd': door(px, W, Hh, cx + 3, ytop + 6, 10, 24, seed=seed + i)
            if k == 'D' and i + 1 < len(kinds):
                door(px, W, Hh, cx + 4, ytop + 5, 12, 25, kind='arch', seed=seed + i); door(px, W, Hh, cx + 16, ytop + 5, 12, 25, kind='arch', seed=seed + i + 1)
            if k == 's':
                for yy in range(ytop + 10, yb - 4):
                    for xx in range(cx + 2, cx + 14):
                        put(px, W, Hh, xx, yy, GLASS[1 if yy < ytop + 15 else 2] if (xx - cx) % 6 else BEAM[3])
                put(px, W, Hh, cx + 3, ytop + 11, GLASS[5]); put(px, W, Hh, cx + 4, ytop + 11, GLASS[4])
                for xx in range(cx + 1, cx + 15): put(px, W, Hh, xx, yb - 4, WD[5]); put(px, W, Hh, xx, yb - 3, WD[3]); put(px, W, Hh, xx, ytop + 9, BEAM[4])
            if k == 'F' and i + 1 < len(kinds):                                   # 대장간 열린 화덕 칸(2칸 폭): 어두운 안쪽 + 화덕 불빛 + 모루
                FI = R('fire')
                for yy in range(ytop + 6, yb - 2):
                    for xx in range(cx + 2, cx + 30):
                        c = BEAM[1] if yy < ytop + 12 else BEAM[2]
                        if xx > cx + 26: c = BEAM[0]
                        put(px, W, Hh, xx, yy, c)
                for yy in range(ytop + 16, yb - 2):
                    for xx in range(cx + 18, cx + 28):
                        put(px, W, Hh, xx, yy, STN[3] if (yy + xx) % 4 else STN[2])
                for yy in range(ytop + 19, ytop + 24):
                    for xx in range(cx + 20, cx + 26):
                        put(px, W, Hh, xx, yy, FI[5 if (xx + yy) % 3 else 6] if yy < ytop + 22 else FI[3])
                for (ax, ay, t) in ((cx + 6, ytop + 22, 4), (cx + 7, ytop + 22, 5), (cx + 8, ytop + 22, 5), (cx + 9, ytop + 22, 5), (cx + 10, ytop + 22, 4), (cx + 11, ytop + 22, 3),
                                    (cx + 8, ytop + 23, 3), (cx + 9, ytop + 23, 2), (cx + 8, ytop + 24, 3), (cx + 9, ytop + 24, 2), (cx + 7, ytop + 25, 4), (cx + 8, ytop + 25, 3), (cx + 9, ytop + 25, 3), (cx + 10, ytop + 25, 2)):
                    put(px, W, Hh, ax, ay, IRON[t])
                for xx in range(cx, cx + 32): put(px, W, Hh, xx, ytop + 5, BEAM[4]); put(px, W, Hh, xx, ytop + 4, BEAM[5])
                for yy in range(ytop + 4, yb): put(px, W, Hh, cx + 1, yy, BEAM[4]); put(px, W, Hh, cx + 29, yy, BEAM[2])
            if k == 'g':
                for yy in range(ytop + 4, yb):
                    for xx in range(cx + 2, cx + 14):
                        if yy < ytop + 10 and abs(xx + 0.5 - cx - 8) > 6 * math.sqrt(max(0, 1 - ((ytop + 10 - yy) / 6.0) ** 2)): continue
                        c = BEAM[1] if yy < ytop + 14 else (BEAM[2] if yy < yb - 6 else EARTH_D[3])
                        if xx >= cx + 12: c = BEAM[0] if yy < yb - 6 else EARTH_D[2]
                        put(px, W, Hh, xx, yy, c)
                for yy in range(ytop + 4, yb): put(px, W, Hh, cx + 1, yy, STN[5]); put(px, W, Hh, cx + 14, yy, STN[2])
    if mat != 'timber':                                                           # 모서리 돌(퀸) 엇갈림
        for (qx, side) in ((x0, 1), (x1 - 4, -1)):
            for q in range(0, 32, 4):
                wq = 4 if (q // 4) % 2 else 3
                for yy in range(ytop + q, min(yb, ytop + q + 4)):
                    for xx in (range(qx, qx + wq) if side > 0 else range(qx + 4 - wq, qx + 4)):
                        put(px, W, Hh, xx, yy, STN[5] if yy == ytop + q else (STN[4] if yy < ytop + q + 3 else STN[2]))
    if jetty:                                                                     # 위층 내밀기: 아래층 윗변 그늘 + 장선 끝
        for xx in range(x0, x1):
            put(px, W, Hh, xx, yb, BEAM[1]); put(px, W, Hh, xx, yb + 1, mul(get(px, W, Hh, xx, yb + 1), 0.62))
            if xx % 4 == 1: put(px, W, Hh, xx, yb, BEAM[4])
    if eave:
        for yy in range(ytop, ytop + 5):
            k_ = 0.62 if yy < ytop + 3 else 0.82
            for xx in range(x0, x1): put(px, W, Hh, xx, yy, mul(get(px, W, Hh, xx, yy), k_))

def base_band(im, x0, x1, y):
    """기초 띠(맨 아래 2화소 돌)."""
    px = im.load(); W, Hh = im.size
    for xx in range(x0, x1):
        put(px, W, Hh, xx, y, STN[5] if xx % 8 else STN[3]); put(px, W, Hh, xx, y + 1, STN[2])
