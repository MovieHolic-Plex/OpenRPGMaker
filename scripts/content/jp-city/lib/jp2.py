"""일본 골목 v2 — 3/4 계약(건물 = 윗면 D×16 + 앞면 층×32, 소품도 윗면) + 랜덤 노이즈 제거, 손으로 배치한 기와·나마코벽."""
import os, sys, random, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jp import *
import jp, post
from PIL import Image

def tiles_roof(c, x, y, w, h, mat, inset, bands=None, ridge=True, hip=True):
    """3/4 윗면 기와: 능선(밝은 2줄 + 마루 기와) → 기와 줄(높이 4, 폭 6, 줄마다 3px 엇갈림). 기와 한 장 = 왼쪽 빛 1px · 몸통 · 오른쪽 그늘 1px · 아래 겹침 그늘 1px.
    값은 줄 번호로만 정한다(난수 없음): 능선 쪽이 밝고 처마 쪽이 어둡다. 우진각 끝(좌 밝음 / 우 어두움)은 가장자리 6px."""
    rows = h // 4
    for j in range(h):
        ins = int(inset * (1 - j / max(h - 1, 1))) if hip else 0
        r = j // 4
        base = 3 if r < rows * .25 else 2 if r < rows * .6 else 1
        if r >= rows - 1: base = 0
        for i in range(ins, w - ins):
            off = 3 if r % 2 else 0
            u = (i + off) % 6; v = j % 4
            t = base
            if hip and i < ins + 6 and ins > 0: t += 1
            if hip and i >= w - ins - 6 and ins > 0: t -= 1
            if v == 3: col = K(mat, t - 2)
            elif u == 0: col = K(mat, t + 1)
            elif u == 5: col = K(mat, t - 1)
            elif v == 0: col = K(mat, t + 1) if u < 3 else K(mat, t)
            else: col = K(mat, t)
            c.P(x + i, y + j, col)
    if ridge:
        for i in range(inset, w - inset):
            c.P(x + i, y, K(mat, 5)); c.P(x + i, y + 1, K(mat, 4)); c.P(x + i, y + 2, K(mat, 0) if i % 6 else K(mat, 2))
        for i in range(inset + 1, w - inset, 6): c.R(x + i, y - 1, 4, 2, K(mat, 4)); c.HL(x + i, y - 1, 4, K(mat, 5))
    # 처마 끝: 앞으로 2px 더 나온 어두운 줄 + 아래 그림자 벽
    c.HL(x - 2, y + h - 1, w + 4, K(mat, -3)); c.HL(x - 2, y + h - 2, w + 4, K(mat, -2))
    for k in range(3): c.HL(x, y + h + k, w, K('conc', -3 + k // 2) if k < 2 else K('conc', -2))

def wall_plain(c, x, y, w, h, mat='kinari', stains=()):
    """회벽: 면 한 장 + 왼쪽 빛줄 + 오른쪽 그늘줄 + 미리 정한 자리의 때 덩이(2×1)."""
    c.R(x, y, w, h, K(mat, 1)); c.VL(x, y, h, K(mat, 2)); c.VL(x + w - 1, y, h, K(mat, -1))
    for (sx, sy, sw) in stains: c.HL(x + sx, y + sy, sw, K(mat, 0)); c.HL(x + sx + 1, y + sy + 1, max(sw - 2, 1), K(mat, 0))
    # 밑동 때: 고른 톱니 경계 한 줄
    for i in range(w):
        d = 3 + (i * 7 % 5 == 0) * 1
        c.R(x + i, y + h - d - 4, 1, d + 4, K(mat, 0))

def namako(c, x, y, w, h):
    """나마코벽: 어두운 타일 8×8 + 흰 사선 줄눈(45° 대신 가로세로 줄눈 2px 흰색)·위 줄눈 그림자."""
    for j in range(h):
        for i in range(w):
            col = K('tairu', 0)
            if j % 8 in (0, 1): col = K('shiro', 3) if j % 8 == 0 else K('shiro', 1)
            elif ((i + ((j // 8) % 2) * 4) % 8) in (0, 1): col = K('shiro', 3) if ((i + ((j // 8) % 2) * 4) % 8) == 0 else K('shiro', 1)
            elif j % 8 in (2, 3): col = K('tairu', 1) if i % 8 > 1 else col
            c.P(x + i, y + j, col)

def vending2(c, x, base):
    """자판기 3/4: 윗면 T=7(밝은 면 + 앞 모서리 2px) + 앞면 F=24(상품창·버튼·배출구) + 오른쪽 그늘 2px + 바닥 타원 그림자."""
    T, F = 7, 24; y = base - T - F
    c.R(x + 1, y, 16, T, K('shiro', 3)); c.HL(x + 1, y, 16, K('shiro', 4)); c.VL(x + 1, y, T, K('shiro', 4)); c.R(x + 1, y + T - 2, 16, 2, K('shiro', 2)); c.HL(x + 1, y + T - 1, 16, K('shiro', 0))
    c.R(x, y + T, 18, F, K('aka', 1)); c.VL(x, y + T, F, K('aka', 3)); c.VL(x + 17, y + T, F, K('aka', -1)); c.VL(x + 16, y + T, F, K('aka', 0))
    c.R(x + 2, y + T + 2, 12, 11, K('tekko', -1)); c.R(x + 2, y + T + 2, 12, 1, K('tekko', 1))
    for k in range(9):
        cc = ('sora', 'kii', 'midori', 'aka', 'daidai', 'sora', 'kii', 'midori', 'aka')[k]
        c.R(x + 3 + (k % 3) * 4, y + T + 4 + (k // 3) * 3, 3, 2, K(cc, 2)); c.P(x + 3 + (k % 3) * 4, y + T + 4 + (k // 3) * 3, K(cc, 4))
    for k in range(3): c.R(x + 3 + k * 4, y + T + 15, 3, 2, K('kii', 3) if k == 1 else K('tekko', 3))
    c.R(x + 3, y + T + 19, 10, 4, K('tekko', -2)); c.HL(x + 3, y + T + 19, 10, K('tekko', 0))
    c.R(x + 15, y + T + 15, 2, 2, K('shiro', 3))
    c.HL(x, y + T + F - 1, 18, K('aka', -3))
    for j in range(3):
        c.HL(x + 1 - j, base + j, 20 + j, K('conc', -2 + (j == 2)))

def block_wall2(c, x, y, w, h):
    """블록담 3/4: 윗면 T=6(캡 블록, 앞 모서리 밝음) + 앞면 h(구멍 블록 16×8 줄눈) + 아래 그림자."""
    T = 6
    c.R(x, y, w, T, K('conc', 4)); c.HL(x, y, w, K('conc', 5)); c.R(x, y + T - 2, w, 2, K('conc', 3)); c.HL(x, y + T - 1, w, K('conc', 1))
    for j in range(h):
        for i in range(w):
            c.P(x + i, y + T + j, K('conc', 2))
    for j in range(0, h, 8):
        c.HL(x, y + T + j, w, K('conc', 4)); c.HL(x, y + T + j + 7 if j + 7 < h else y + T + h - 1, w, K('conc', 0))
        for i in range(((j // 8) % 2) * 8, w, 16):
            c.VL(x + i, y + T + j, 8, K('conc', 0)); c.VL(x + i + 1, y + T + j + 1, 6, K('conc', 4))
            c.R(x + i + 5, y + T + j + 3, 6, 2, K('conc', 0)); c.HL(x + i + 5, y + T + j + 5, 6, K('conc', 4))
    for k in range(3): c.HL(x + 1, y + T + h + k, w, K('conc', -2 + (k == 2)))

def house(W_, H_, seed, lit=False):
    """기와 단층집(깊이 D=3 → 지붕판 48): 지붕 + 회벽 + 나마코 아랫벽 + 격자창 + 미닫이 + 툇마루."""
    c = Cv(W_, H_); T = 48
    tiles_roof(c, 4, 0, W_ - 8, T, 'kawara', 14)
    wy = T + 4; wh = H_ - wy - 6
    wall_plain(c, 4, wy, W_ - 8, wh, 'kinari', stains=((18, 8, 4), (48, 14, 3)))
    timber(c, 4, wy, wh); timber(c, W_ - 7, wy, wh)
    c.R(4, wy + 4, W_ - 8, 3, K('ita', 0)); c.HL(4, wy + 4, W_ - 8, K('ita', 2)); c.HL(4, wy + 6, W_ - 8, K('ita', -2))
    namako(c, 7, H_ - 6 - 20, W_ - 14, 20)
    c.R(7, H_ - 6 - 22, W_ - 14, 2, K('ita', 1)); c.HL(7, H_ - 6 - 22, W_ - 14, K('ita', 3)); c.HL(7, H_ - 6 - 21, W_ - 14, K('ita', -1))
    lattice_win(c, 12, wy + 12, 22, 16, lit=lit)
    slide_door(c, W_ - 40, wy + 10, 28, 26)
    c.R(0, H_ - 6, W_, 6, K('conc', 2)); c.HL(0, H_ - 6, W_, K('conc', 5)); c.HL(0, H_ - 1, W_, K('conc', -2))
    return c

def shopflat(W_, H_, seed):
    """2층 상가(깊이 2 → 옥상 32): 옥상판(안쪽 면·바닥·앞 캡) + 실외기·안테나 + 앞면 2층 + 기와 차양 + 노렌·제등·세로간판."""
    c = Cv(W_, H_); T = 32
    c.R(0, 0, W_, T, K('conc', 1)); c.R(0, 0, W_, 5, K('conc', 0)); c.HL(0, 0, W_, K('conc', 3)); c.HL(0, 5, W_, K('conc', -1))
    for j in range(7, T - 5): c.HL(0, j, W_, K('conc', 1 if j % 8 else 0))
    for i in range(0, W_, 16): c.VL(i, 7, T - 12, K('conc', 0))
    jp.ac_unit(c, 8, 7); c.R(34, 8, 3, 14, K('tekko', 1)); c.HL(31, 8, 9, K('tekko', 3)); c.HL(32, 12, 7, K('tekko', 3))
    c.R(52, 10, 14, 6, K('tairu', 3)); c.HL(52, 10, 14, K('tairu', 5)); c.R(52, 16, 14, 3, K('tairu', 1)); c.R(66, 11, 3, 8, K('conc', -1))
    c.HL(0, T - 5, W_, K('conc', 5)); c.R(0, T - 4, W_, 2, K('conc', 3)); c.HL(0, T - 2, W_, K('conc', 1)); c.HL(0, T - 1, W_, K('conc', -2))
    y2 = T
    wall_plain(c, 0, y2, W_, 34, 'shiro', stains=((30, 14, 3),))
    for k in range(3): c.HL(0, y2 + k, W_, K('conc', -2 + k))
    lattice_win(c, 10, y2 + 8, 20, 16, lit=True); lattice_win(c, W_ - 46, y2 + 8, 20, 16)
    c.R(W_ - 50, y2 + 26, 28, 2, K('tekko', 2)); c.HL(W_ - 50, y2 + 26, 28, K('tekko', 4))
    for i in range(W_ - 50, W_ - 22, 3): c.VL(i, y2 + 28, 5, K('tekko', 1))
    y1 = y2 + 34
    c.HL(0, y1, W_, K('conc', 5)); c.R(0, y1 + 1, W_, 2, K('conc', 3)); c.HL(0, y1 + 3, W_, K('conc', -1)); c.HL(0, y1 + 4, W_, K('conc', -3))
    wall_plain(c, 0, y1 + 5, W_, H_ - y1 - 5, 'shiro', stains=())
    for k in range(3): c.HL(0, y1 + 5 + k, W_, K('conc', -2 + k))
    eave(c, 3, y1 + 8, W_ - 6, 'kawara', 10)
    noren(c, 18, y1 + 24, W_ - 50, 22, 'sora')
    chochin(c, 4, y1 + 28); chochin(c, W_ - 32, y1 + 28)
    c.R(0, H_ - 6, W_, 6, K('hodo', 2)); c.HL(0, H_ - 6, W_, K('hodo', 5)); c.HL(0, H_ - 1, W_, K('hodo', -1))
    vsign(c, W_ - 18, y2 + 4, 12, 40, 'aka')
    return c

def aptflat(W_, H_, seed):
    """연립(깊이 2 → 옥상 32, 물탱크·실외기 얹음) + 타일 벽 2층 + 난간 베란다·빨래 + 1층 출입구."""
    c = Cv(W_, H_); T = 32
    c.R(0, 0, W_, T, K('conc', 1)); c.R(0, 0, W_, 5, K('conc', 0)); c.HL(0, 0, W_, K('conc', 3)); c.HL(0, 5, W_, K('conc', -1))
    for j in range(7, T - 5): c.HL(0, j, W_, K('conc', 1 if j % 8 else 0))
    for i in range(0, W_, 16): c.VL(i, 7, T - 12, K('conc', 0))
    tx = 10  # 물탱크
    c.R(tx, 10, 14, 10, K('tairu', 2)); c.R(tx, 10, 4, 10, K('tairu', 3)); c.R(tx + 10, 10, 4, 10, K('tairu', 0)); c.HL(tx, 8, 14, K('shiro', 2)); c.R(tx, 8, 14, 3, K('tairu', 4)); c.HL(tx, 15, 14, K('tairu', 0))
    c.R(tx + 14, 11, 3, 11, K('conc', -1)); c.HL(tx, 21, 17, K('conc', -2))
    jp.ac_unit(c, 52, 7)
    c.HL(0, T - 5, W_, K('conc', 5)); c.R(0, T - 4, W_, 2, K('conc', 3)); c.HL(0, T - 2, W_, K('conc', 1)); c.HL(0, T - 1, W_, K('conc', -2))
    y2 = T; h2 = 36
    c.R(0, y2, W_, h2, K('tairu', 2))
    for j in range(0, h2, 6):
        c.HL(0, y2 + j, W_, K('tairu', 0))
        for i in range(((j // 6) % 2) * 6, W_, 12): c.VL(i, y2 + j, 6, K('tairu', 0))
    for k in range(3): c.HL(0, y2 + k, W_, K('tairu', -2 + k))
    for x in (6, 40):
        c.R(x - 1, y2 + 7, 26, 22, K('tairu', -3)); c.R(x, y2 + 8, 24, 20, K('garasu', 1)); c.R(x, y2 + 8, 24, 3, K('garasu', 0)); c.VL(x + 12, y2 + 8, 20, K('tekko', 1))
        for k in range(8): c.P(x + 3 + k, y2 + 24 - k, K('garasu', 4))
        c.R(x - 2, y2 + 26, 28, 10, K('tekko', 1)); c.HL(x - 2, y2 + 26, 28, K('tekko', 4)); c.R(x - 2, y2 + 34, 28, 2, K('tekko', 3))
        for i in range(x - 1, x + 26, 4): c.VL(i, y2 + 28, 6, K('tekko', 0))
    c.R(9, y2 + 29, 12, 5, K('shiro', 3)); c.HL(9, y2 + 29, 12, K('tekko', 2)); c.R(11, y2 + 30, 4, 4, K('sora', 2)); c.R(16, y2 + 31, 3, 3, K('aka', 2))
    y1 = y2 + h2
    c.HL(0, y1, W_, K('conc', 5)); c.R(0, y1 + 1, W_, 2, K('conc', 3)); c.HL(0, y1 + 3, W_, K('conc', -1)); c.HL(0, y1 + 4, W_, K('tairu', -3))
    c.R(0, y1 + 5, W_, H_ - y1 - 5, K('conc', 2))
    for j in range(0, H_ - y1 - 5, 8):
        c.HL(0, y1 + 5 + j, W_, K('conc', 0))
        for i in range(((j // 8) % 2) * 8, W_, 16): c.VL(i, y1 + 5 + j, 8, K('conc', 0))
    for k in range(3): c.HL(0, y1 + 5 + k, W_, K('conc', -3 + k))
    slide_door(c, W_ - 34, y1 + 14, 24, 34, True)
    c.R(W_ - 36, y1 + 10, 28, 3, K('tekko', 2)); c.HL(W_ - 36, y1 + 10, 28, K('tekko', 4)); c.HL(W_ - 36, y1 + 13, 28, K('conc', -3))
    c.R(0, H_ - 6, W_, 6, K('hodo', 2)); c.HL(0, H_ - 6, W_, K('hodo', 5)); c.HL(0, H_ - 1, W_, K('hodo', -1))
    return c

def woodshop(W_, H_, seed):
    """목조 가게(깊이 3 → 지붕 48): 기와 윗면 + 널판 벽 + 간판 + 줄무늬 차양(윗면+앞 가장자리+그림자) + 진열창."""
    c = Cv(W_, H_); T = 48
    tiles_roof(c, 2, 0, W_ - 4, T, 'kawara', 10)
    y = T + 4
    c.R(0, y, W_, H_ - y, K('ita', 1))
    for x in range(0, W_, 6):
        c.VL(x, y, H_ - y, K('ita', -1)); c.VL(x + 1, y, H_ - y, K('ita', 2))
    for k in range(3): c.HL(0, y + k, W_, K('ita', -3 + k))
    c.R(4, y + 6, W_ - 8, 10, K('kinari', 2)); c.HL(4, y + 6, W_ - 8, K('kinari', 4)); c.HL(4, y + 15, W_ - 8, K('ita', -2)); c.HL(3, y + 5, W_ - 6, K('ita', 3)); c.HL(4, y + 16, W_ - 8, K('ita', -3))
    xx = 9
    for n in (4, 5, 4, 5):
        c.R(xx, y + 9, n, 4, K('aka', 1)); c.HL(xx, y + 9, n, K('aka', 3)); xx += n + 4
    # 차양: 윗면 5 + 앞 가장자리 3 + 벽 그림자 2
    ay = y + 20
    for i in range(3, W_ - 3):
        stripe = ((i - 3) // 6) % 2
        c.R(i, ay, 1, 5, K('shiro', 4) if stripe else K('aka', 3))
        c.R(i, ay + 5, 1, 3, K('shiro', 3) if stripe else K('aka', 2))
        c.P(i, ay + 8, K('shiro', 1) if stripe else K('aka', 0))
        c.P(i, ay + 9, K('ita', -3)); c.P(i, ay + 10, K('ita', -3)) if i % 2 == 0 else None
    c.R(6, ay + 12, W_ - 12, 30, K('ita', -3)); c.R(8, ay + 14, W_ - 16, 26, K('mado', 1)); c.R(8, ay + 14, W_ - 16, 4, K('mado', 0))
    for i in range(12, W_ - 14, 12):
        c.R(i, ay + 28, 8, 2, K('ita', 1)); c.VL(i + 3, ay + 30, 8, K('ita', -2)); c.R(i + 1, ay + 25, 3, 3, K('kii', 2)); c.R(i + 5, ay + 25, 3, 3, K('daidai', 2))
    c.R(4, ay + 42, W_ - 8, 3, K('ita', 3)); c.HL(4, ay + 42, W_ - 8, K('ita', 5)); c.HL(4, ay + 45, W_ - 8, K('ita', -2))
    c.R(0, H_ - 6, W_, 6, K('hodo', 2)); c.HL(0, H_ - 6, W_, K('hodo', 5)); c.HL(0, H_ - 1, W_, K('hodo', -1))
    return c

def put2(sc, cv, x, y):
    import tune
    a = tune.ink(post.contour(cv.a), edge=3, inner=2, soft=1)
    for j in range(a.shape[0]):
        for i in range(a.shape[1]):
            if a[j, i, 3] and 0 <= x + i < sc.w and 0 <= y + j < sc.h: sc.a[y + j, x + i] = a[j, i]

def build():
    sc = Cv(W, H)
    for y in range(0, 46):
        for x in range(W):
            t = 5 - y // 14; sc.P(x, y, K('garasu', t))
    for x0, w0, h0 in ((0, 38, 26), (52, 30, 34), (130, 46, 22), (232, 34, 30), (290, 50, 24)):
        sc.R(x0, 46 - h0, w0, h0, K('tairu', 3)); sc.R(x0, 46 - h0, w0, 2, K('tairu', 4))
        for i in range(x0 + 4, x0 + w0 - 4, 7): sc.R(i, 46 - h0 + 6, 3, 3, K('tairu', 1))
    sc.R(0, 46, W, ROAD0 - 46, K('conc', 0))
    # 앞뒤 단차: 집은 2px·가게는 4px 물러서게(지붕 y 를 달리) — 지면선은 같지만 높이 H 로 키가 다르다
    bl = [(house(88, 128, 1, True), 0), (shopflat(84, 124, 2), 92), (aptflat(88, 124, 3), 180), (woodshop(72, 124, 4), 272)]
    for cv, x in bl:
        yy = ROAD0 - cv.h
        put2(sc, cv, x, yy); jp.cast(sc, x, yy, cv.w, cv.h, tall=40)
    road(sc); sidewalk_south(sc)
    vending2(sc, 184, ROAD0 - 1); vending2(sc, 204, ROAD0 - 1)
    bike(sc, 36, ROAD0 - 1)
    block_wall2(sc, 0, ROAD1 + 10, 140, 18); block_wall2(sc, 196, ROAD1 + 10, 140, 18)
    for x0 in (22, 70, 226, 290):
        for j in range(14):
            for i in range(26):
                if (i - 13) ** 2 + (j - 9) ** 2 * 1.7 <= 120:
                    t = 4 if j < 3 else 3 if j < 6 else 2 if j < 9 else 1
                    if (i + j * 2) % 6 == 0: t += 1
                    sc.P(x0 + i, ROAD1 - 6 + j, K('ki', t))
        for i in range(26): sc.P(x0 + i, ROAD1 + 9, K('conc', -2))
    pole(sc, 256, ROAD1 + 34, top=8)
    wires(sc, [-10, 256, 350], 18, sag=8, n=4)
    wires(sc, [256, 350], 30, sag=4, n=2, col=K('tekko', 0))
    for k in range(18): sc.P(264 + k, ROAD1 + 32 + k // 6, K('conc', -2))
    hero(sc, 132, ROAD1 - 38)
    return sc

if __name__ == '__main__':
    sc = build(); im = sc.img(); im.save('out/jp2.png'); im.resize((im.width * 3, im.height * 3), Image.NEAREST).save('out/jp2-3x.png')
