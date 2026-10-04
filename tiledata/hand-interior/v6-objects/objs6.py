# v6 소품: v5 와 같은 크기·칸 점유로 다시 그린 가구·기물.
# 규칙: 윗면이 주인공 / 면 안쪽은 가까운 두 단 / 센 대비는 윤곽과 위·왼쪽 1px 하이라이트 / 윤곽 = 재질 0단 /
# 원통은 세로 띠(밝은 띠 왼쪽, 오른쪽 끝 가장 어둡게, 반사 한 점, 윗테 타원) / 반복 요소는 흐트러뜨림 / 공유 색 줄.
import math
from draw6 import C, H, grain, band_tone, cyl_rows, ring, PAL, to_pix

# ======================================================================= 나무 상자꼴 공통
def slab_top(c, x0, y0, x1, y1, m='wood', base=4, seed=1, hi=True):
    """위에서 본 윗면: base 단 + 한 단 어두운 결, 위·왼쪽 1px 하이라이트(윤곽 바로 안쪽)"""
    c.rect(x0, y0, x1, y1, m, base)
    grain(c, x0 + 2, y0 + 2, x1 - 1, y1 - 1, m, base - 1, seed)
    if hi:
        c.hl(x0 + 1, x1 - 2, y0 + 1, m, base + 1)
        c.vl(x0 + 1, y0 + 1, y1 - 1, m, base + 1)

# ======================================================================= 침대
def bed(W=16, cloth='green', seed=2):
    c = C(W, 38)
    # 머리판 (벽에 붙음): 위에서 보면 가로대 윗면 한 줄 + 낮은 앞판. 양쪽 기둥 머리는 한 단 밝게
    c.rect(0, 0, W - 1, 9, 'wood', 2)
    c.hl(1, W - 2, 1, 'wood', 4); c.hl(2, W - 3, 1, 'wood', 5)
    c.hl(1, W - 2, 2, 'wood', 3)
    c.rect(3, 4, W - 4, 7, 'wood', 3); c.hl(3, W - 4, 4, 'wood', 4)
    for x in (1, W - 2): c.vl(x, 1, 9, 'wood', 3)
    c.hl(2, W - 3, 9, 'wood', 1)
    c.rect(2, 10, W - 3, 10, 'linen', 2)                     # 요 머리 (베개 뒤 그늘)
    # 틀 옆 난간
    for y in range(10, 34):
        c.set(0, y, 'wood', 2); c.set(1, y, 'wood', 3); c.set(W - 2, y, 'wood', 2); c.set(W - 1, y, 'wood', 2)
    # 요 + 베개
    c.rect(2, 11, W - 3, 33, 'linen', 3)
    pillows = [(3, W - 4)] if W <= 16 else [(3, W // 2 - 2), (W // 2 + 1, W - 4)]
    for a, b in pillows:
        c.rect(a, 11, b, 16, 'linen', 4)
        c.hl(a + 1, b - 1, 12, 'linen', 5)
        c.hl(a, b, 16, 'linen', 3)
        for x, y in ((a, 11), (b, 11), (a, 16), (b, 16)): c.set(x, y, 'linen', 2)
        c.hl(a + 1, b - 1, 17, 'linen', 2)                    # 베개 밑 그림자 한 줄
    # 접어 내린 흰 시트
    c.rect(2, 18, W - 3, 20, 'linen', 4); c.hl(2, W - 3, 18, 'linen', 5); c.hl(2, W - 3, 20, 'linen', 3)
    # 이불: 윗면 base 3 + 한 단 어두운 접힘 몇 줄, 왼쪽 1px 밝게, 양옆은 난간 너머로 흘러내림
    c.rect(1, 21, W - 2, 33, cloth, 3)
    c.hl(2, W - 3, 21, cloth, 4)
    c.vl(2, 22, 32, cloth, 4)
    c.vl(W - 2, 21, 33, cloth, 2); c.vl(1, 21, 33, cloth, 2)
    for k in range(2):                                      # 접힘: 짧고 비스듬한 한 단 어두운 줄, 자리·길이 흐트러뜨림
        y = 26 + k * 3 + int(H(k, W, seed) * 2)
        xa = 3 + int(H(k, y, seed) * (W - 9)); ln = 2 + int(H(y, k, seed) * 3)
        for j in range(ln): c.set(xa + j, y + (j >= ln - 1), cloth, 2)
    c.hl(2, W - 3, 31, cloth, 4); c.hl(2, W - 3, 32, cloth, 2)   # 이불 끝단 (한 줄 밝게 + 한 줄 어둡게)
    # 이불 앞자락 (발치 판 위로 늘어진 앞면)
    c.rect(1, 34, W - 2, 34, cloth, 2)
    # 발치 판: 윗면 한 줄 + 앞판, 다리 사이는 비움
    c.hl(0, W - 1, 35, 'wood', 4); c.hl(1, W - 2, 35, 'wood', 4)
    c.rect(0, 36, W - 1, 36, 'wood', 2)
    for x in (0, 1, 2, W - 3, W - 2, W - 1): c.set(x, 37, 'wood', 1)
    c.outline()
    c.set(1, 35, 'wood', 5)
    return c.img()

# ======================================================================= 책장
BOOKC = ['red', 'blue', 'green', 'linen', 'clay', 'red', 'blue', 'straw']
def books(c, x0, x1, yb, hmax, seed):
    """칸 바닥 yb 위에 책: 폭 1~3, 높이·간격·기울기를 흐트러뜨림, 가끔 눕힌 책 더미와 빈 틈"""
    x = x0; k = 0; last = None
    while x <= x1:
        r = H(x, yb, seed)
        if r < 0.10 and x > x0 + 1:            # 빈 틈
            x += 1 + (H(x, 3, seed) < 0.4); continue
        if r > 0.90 and x + 4 <= x1:           # 눕힌 책 2~3권
            n = 2 + (H(x, 5, seed) < 0.5)
            for j in range(n):
                col = BOOKC[int(H(x, j, seed + 3) * len(BOOKC))]
                w = 4 + (j == 0) - (j == 2)
                xa = x + (j % 2)
                for yy in (yb - 2 * j - 1, yb - 2 * j - 2):
                    for xx in range(xa, xa + w): c.set(xx, yy, col, 3 if yy == yb - 2 * j - 1 else 4)
                c.set(xa, yb - 2 * j - 1, col, 2)
            x += 6; continue
        w = [1, 2, 2, 2, 3][int(H(x, yb + 9, seed) * 5)]
        w = min(w, x1 - x + 1)
        h = max(3, hmax - int(H(x, yb + 2, seed) * 3.4))
        col = BOOKC[int(H(x, yb + 4, seed) * len(BOOKC))]
        if col == last: col = BOOKC[(BOOKC.index(col) + 3) % len(BOOKC)]
        last = col
        lean = (H(x, yb + 6, seed) < 0.12 and w <= 2 and x + w <= x1)
        for yy in range(yb - h, yb):
            sh = 1 if (lean and yy < yb - h // 2) else 0
            for xx in range(x, x + w):
                c.set(xx + sh, yy, col, 3)
            c.set(x + sh, yy, col, 4 if w > 1 else 3)          # 등 왼쪽이 빛을 받는다
        if h >= 5 and w >= 2 and H(x, 1, seed) < 0.55:          # 제목 띠 (한 단 어둡게)
            c.hl(x + (1 if lean else 0), x + w - 1 + (1 if lean else 0), yb - h + 1, col, 2)
        x += w + (1 if lean else 0); k += 1

def bookshelf(W=16, seed=5):
    c = C(W, 38)
    c.rect(0, 0, W - 1, 37, 'wood', 2)
    slab_top(c, 0, 0, W - 1, 3, 'wood', 4, seed)             # 윗면
    c.hl(0, W - 1, 4, 'wood', 1)
    for y in range(4, 37):
        c.set(1, y, 'wood', 3); c.set(W - 2, y, 'wood', 2)
    comps = [(5, 12), (15, 21), (24, 30)]
    for a, b in comps:
        c.rect(2, a, W - 3, b, 'wood', 1)
        c.hl(2, W - 3, a, 'wood', 0)                            # 선반 밑 그림자
        books(c, 2, W - 3, b + 1, b - a, seed + a)
        c.hl(2, W - 3, b + 1, 'wood', 4); c.hl(2, W - 3, b + 2, 'wood', 2)   # 선반 판: 윗모서리 밝게
    c.rect(2, 33, W - 3, 36, 'wood', 2); c.hl(2, W - 3, 33, 'wood', 3)
    c.outline()
    return c.img()

# ======================================================================= 옷장·찬장·협탁
def wardrobe():
    c = C(16, 32)
    c.rect(0, 0, 15, 30, 'wood', 2)
    slab_top(c, 0, 0, 15, 3, 'wood', 4, 11)
    c.hl(0, 15, 4, 'wood', 1)
    for x0, x1 in ((1, 7), (8, 14)):                         # 문 두 짝: 면 2단, 안쪽 판 3단
        c.rect(x0 + 1, 7, x1 - 1, 26, 'wood', 3)
        c.hl(x0 + 1, x1 - 1, 7, 'wood', 4)
    c.vl(7, 5, 28, 'wood', 1); c.vl(8, 5, 28, 'wood', 2)
    c.set(6, 17, 'brass', 4); c.set(6, 18, 'brass', 2); c.set(9, 17, 'brass', 4); c.set(9, 18, 'brass', 2)
    c.hl(1, 14, 28, 'wood', 1); c.hl(1, 14, 29, 'wood', 3); c.hl(1, 14, 30, 'wood', 2)
    for x in (0, 1, 2, 13, 14, 15): c.set(x, 31, 'wood', 1)
    c.outline()
    return c.img()

def nightstand():
    c = C(16, 24)
    c.rect(2, 8, 13, 21, 'wood', 2)
    slab_top(c, 2, 8, 13, 12, 'wood', 4, 13)
    c.hl(2, 13, 13, 'wood', 1)
    for y0 in (14, 18):
        c.rect(4, y0, 11, y0 + 2, 'wood', 3)
        c.set(8, y0 + 1, 'brass', 4); c.set(7, y0 + 1, 'brass', 2)
    c.hl(3, 12, 21, 'wood', 1)
    for x in (2, 3, 12, 13): c.set(x, 22, 'wood', 1)
    c.outline()
    return c.img()

def cupboard():
    c = C(16, 24)
    c.rect(0, 0, 15, 21, 'wood', 2)
    slab_top(c, 0, 0, 15, 5, 'wood', 4, 17)
    c.hl(0, 15, 6, 'wood', 1)
    for y0 in (7, 12, 17):
        c.rect(2, y0, 13, y0 + 3, 'wood', 3); c.hl(2, 13, y0, 'wood', 4)
        kx = 7 + (y0 % 2)
        c.set(kx, y0 + 2, 'brass', 4); c.set(kx, y0 + 3, 'brass', 2)
    for x in (0, 1, 2, 13, 14, 15): c.set(x, 22, 'wood', 1); c.set(x, 23, 'wood', 1)
    c.outline()
    return c.img()

# ======================================================================= 시계
def clock():
    c = C(16, 32)
    c.rect(3, 3, 12, 13, 'wood', 2)                          # 머리 (문자판 상자)
    c.hl(3, 12, 4, 'wood', 4); c.hl(4, 11, 4, 'wood', 5)
    c.ell(8, 9.5, 3.6, 3.6, 'brass', 3)
    c.ell(8, 9.5, 2.7, 2.7, 'linen', 5)
    c.set(8, 8, 'iron', 1); c.set(8, 7, 'iron', 1); c.set(8, 9, 'iron', 1); c.set(9, 9, 'iron', 1); c.set(10, 9, 'iron', 1)
    c.set(6, 7, 'brass', 4)
    c.rect(5, 14, 10, 26, 'wood', 2)                         # 몸통
    c.rect(6, 16, 9, 24, 'wood', 1)                          # 유리 속 (그늘)
    c.vl(7, 16, 22, 'brass', 2); c.rect(7, 22, 8, 23, 'brass', 3); c.set(7, 22, 'brass', 4)
    c.vl(5, 14, 26, 'wood', 3)
    c.rect(4, 27, 11, 30, 'wood', 2); c.hl(4, 11, 27, 'wood', 4); c.hl(5, 10, 27, 'wood', 4)
    c.set(4, 31, 'wood', 1); c.set(5, 31, 'wood', 1); c.set(10, 31, 'wood', 1); c.set(11, 31, 'wood', 1)
    c.outline()
    c.set(4, 5, 'wood', 5)
    return c.img()

# ======================================================================= 궤짝
def chest(royal=False):
    c = C(16, 16)
    body = 'red' if royal else 'wood'
    band = 'brass' if royal else 'iron'
    c.rect(2, 3, 14, 14, body, 2)
    slab_top(c, 2, 3, 14, 8, body, 4 if not royal else 3, 21)
    c.hl(2, 14, 9, body, 1)
    c.rect(3, 10, 13, 13, body, 2 if not royal else 2)
    if not royal: c.hl(3, 13, 12, body, 1) if False else None
    for bx in (4, 12):                                       # 띠쇠: 뚜껑 위는 밝게, 앞은 어둡게
        c.vl(bx, 4, 8, band, 3); c.vl(bx, 10, 13, band, 2); c.set(bx, 4, band, 4)
    c.rect(7, 9, 9, 11, 'brass', 3); c.set(7, 9, 'brass', 4); c.set(8, 11, 'iron', 0)
    c.outline()
    return c.img()

# ======================================================================= 통
BAR_ROWS = [5.9, 6.3, 6.6, 6.8, 6.9, 6.9, 6.8, 6.6, 6.3, 5.9]
def barrel_body(c, y0, rows, hoops, cx=8.0):
    cyl_rows(c, cx, rows, 'wood', 4, y0)
    # 널 이음 두 줄 (한 단 어둡게)
    for j, hw in enumerate(rows):
        for u in (0.24, 0.62):
            x = int(cx - hw + u * 2 * hw); c.shade(x, y0 + j, -1)
    for hy in hoops:
        hw = rows[hy - y0]
        xa = int(math.floor(cx - hw + .5)); xb = int(math.ceil(cx + hw - .5)) - 1
        for x in range(xa, xb + 1):
            u = (x - xa + .5) / (xb - xa + 1); c.set(x, hy, 'iron', band_tone(u, 4))

def barrel():
    c = C(16, 16)
    barrel_body(c, 5, BAR_ROWS, (7, 12))
    ring(c, 8.0, 4.4, 6.0, 2.6, 'wood', 3, 2, inner=('wood', 4), inner_rx=4.8, inner_ry=1.6)
    c.hl(4, 11, 4, 'wood', 3)                                 # 뚜껑 널 이음
    c.outline()
    c.set(5, 3, 'wood', 5)                                    # 윗테 하이라이트
    c.set(6, 7, 'iron', 5)                                    # 반사광 한 점
    return c.img()

OPEN_ROWS = [6.0, 6.3, 6.5, 6.5, 6.4, 6.2, 5.9, 5.5, 5.1]
def open_barrel_body():
    """barrel_of 와 같은 자리: 몸통 y7..15, 윗테 중심 (8,6)"""
    c = C(16, 16)
    barrel_body(c, 7, OPEN_ROWS, (9, 13))
    ring(c, 8.0, 6.0, 6.5, 3.2, 'wood', 4, 2, inner=('wood', 1), inner_rx=5.0, inner_ry=2.0)
    c.outline()
    c.set(4, 4, 'wood', 5); c.set(5, 9, 'iron', 5)
    return c

def barrel_of(goods, seed=3):
    import prim
    c = open_barrel_body(); im = c.img(); p = to_pix(im)
    prim.heap(p, 3, 1, 10, 6, goods, seed)
    for x in range(4, 12): p.set(x, 8, PAL['wood'][2])        # 앞 테가 상품을 덮는다
    p.set(3, 8, PAL['wood'][0]); p.set(12, 8, PAL['wood'][0])
    return p.im

def quench_barrel():
    c = open_barrel_body()
    for y in range(c.h):
        for x in range(c.w):
            v = c.get(x, y)
            if v == ('wood', 1): c.set(x, y, 'blue', 3 if y >= 6 else 2)
    c.set(6, 5, 'blue', 5); c.set(9, 6, 'blue', 4); c.set(10, 6, 'blue', 4)
    return c.img()

def weapon_barrel():
    import prim
    c = open_barrel_body()
    # 칼·창 자루 세 개 (높이·기울기 다르게)
    for x, h, lean in ((5, 7, 0), (8, 9, 1), (10, 6, 0)):
        for j in range(h):
            y = 7 - j; xx = x + (1 if (lean and j > h // 2) else 0)
            c.set(xx, y, 'iron', 4 if j > 1 else 2); c.set(xx + 1, y, 'iron', 2)
        c.set(x, 8 - 0, 'wood', 1)
    c.hl(4, 11, 8, 'wood', 2)
    c.hl(4, 7, 5, 'wood', 1)
    return c.img()

# ======================================================================= 항아리
def jar(water=False):
    c = C(16, 16)
    if water:
        rows = [4.2, 5.0, 5.8, 6.2, 6.3, 6.2, 5.8, 5.2, 4.2]
        cyl_rows(c, 8.0, rows, 'clay', 4, 5)
        ring(c, 8.0, 3.6, 4.6, 2.4, 'clay', 4, 2, inner=('blue', 3), inner_rx=3.4, inner_ry=1.4)
        c.hl(6, 8, 3, 'blue', 2)
        c.outline()
        c.set(5, 2, 'clay', 5); c.set(9, 3, 'blue', 5); c.set(5, 7, 'clay', 5)
    else:
        c.rect(6, 3, 9, 4, 'clay', 3)                          # 목
        rows = [4.0, 5.2, 6.0, 6.3, 6.3, 6.0, 5.4, 4.6, 3.6]
        cyl_rows(c, 8.0, rows, 'clay', 4, 5)
        ring(c, 8.0, 2.8, 3.2, 1.5, 'clay', 4, 3, inner=('clay', 0), inner_rx=1.8, inner_ry=0.8)
        cyl_rows(c, 8.0, [2.0, 2.0], 'clay', 4, 4)
        c.hl(5, 10, 8, 'clay', 2) if False else None
        c.outline()
        c.set(6, 2, 'clay', 5); c.set(5, 7, 'clay', 5)
    return c.img()

# ======================================================================= 소파·안락의자 (천)
def upholstered(W, cloth, arm):
    """소파·안락의자: 등받이 윗면 → 등받이 앞면 그늘 한 줄 → 방석 윗면(주인공) → 앞면. 팔걸이는 윗면이 보이는 둥근 턱.
    빛은 왼쪽 위: 왼 팔걸이 안쪽 옆면(동쪽을 봄)은 어둡고, 오른 팔걸이 안쪽(서쪽을 봄)은 밝다."""
    c = C(W, 16)
    c.rect(1, 1, W - 2, 11, cloth, 2)
    c.rect(1, 1, W - 2, 3, cloth, 3); c.hl(2, W - 3, 2, cloth, 4)                                      # 등받이 윗면 하이라이트
    c.hl(arm + 1, W - arm - 2, 4, cloth, 2)                           # 등받이 앞면 그늘
    for a, b in ((1, arm), (W - 1 - arm, W - 2)):                     # 팔걸이: 윗면이 보이는 둥근 턱
        c.rect(a, 3, b, 9, cloth, 3); c.vl(a + 1, 3, 9, cloth, 4)
    c.vl(arm + 1, 4, 9, cloth, 2)                                     # 왼 팔걸이 안쪽 옆면 (어둡게)
    c.vl(W - 2 - arm, 4, 9, cloth, 3)                                 # 오른 팔걸이 안쪽 (빛을 받아 덜 어둡다)
    n = 2 if W >= 32 else 1
    x0, x1 = arm + 2, W - arm - 3
    xs = [x0 + k * (x1 - x0 + 1) // n for k in range(n + 1)]
    for k in range(n):
        a, b = xs[k], xs[k + 1] - 1
        c.rect(a, 5, b, 9, cloth, 4)
        c.hl(a, b - 1, 5, cloth, 5) if k == 0 else c.hl(a, b - 1, 5, cloth, 4)
        if k < n - 1: c.vl(b, 5, 9, cloth, 3)
    c.rect(1, 10, W - 2, 12, cloth, 2); c.hl(1, W - 2, 10, cloth, 3)  # 앞면
    for x in (2, 3, W - 4, W - 3): c.set(x, 13, 'wood', 1); c.set(x, 14, 'wood', 1)
    c.outline()
    return c

def sofa(cloth='green', W=32):
    return upholstered(W, cloth, 3).img()

def armchair(cloth='red'):
    c = upholstered(15, cloth, 2)
    out = C(16, 16); out.g = [row + [None] for row in c.g]
    return out.img()

# ======================================================================= 의자 네 방향
def chair(face='S'):
    c = C(16, 16)
    W = 'wood'
    if face == 'S':                               # 등받이는 북쪽(위), 앉는 면이 보인다
        c.vl(4, 1, 12, W, 3); c.vl(11, 1, 12, W, 2)
        c.rect(4, 1, 11, 2, W, 4); c.hl(5, 10, 1, W, 5)
        c.hl(5, 10, 5, W, 3)
        slab_top(c, 3, 8, 12, 11, W, 4, 31)
        c.hl(3, 12, 12, W, 2)
        for x in (3, 4, 11, 12): c.vl(x, 13, 15, W, 2 if x in (4, 12) else 3)
    elif face == 'N':                             # 등받이가 남쪽(앞): 앉는 면 뒤쪽이 보이고, 등판 살 사이로 바닥이 비친다
        slab_top(c, 3, 3, 12, 6, W, 4, 32)
        c.hl(3, 12, 7, W, 2)
        c.rect(3, 8, 12, 9, W, 4); c.hl(4, 11, 8, W, 5)        # 등받이 윗가로대 (윗면)
        c.hl(3, 12, 10, W, 2)
        for x in (3, 4, 5, 10, 11, 12): c.vl(x, 11, 15, W, 3 if x in (4, 11) else 2)   # 기둥 두 개 (3칸 폭: 가운데 줄이 윤곽에 먹히지 않게)
        for x in range(6, 10):
            for y in range(11, 16): c.clear(x, y)
    else:                                         # E: 등받이 서쪽 / W: 거울
        c.vl(3, 1, 12, W, 3); c.vl(4, 1, 12, W, 4); c.vl(5, 1, 12, W, 2)
        c.set(4, 1, W, 5)
        slab_top(c, 5, 8, 12, 11, W, 4, 33, hi=False); c.hl(6, 11, 9, W, 5)
        c.hl(3, 12, 12, W, 2)
        for x in (3, 4, 11, 12): c.vl(x, 13, 15, W, 2 if x in (4, 12) else 3)
        if face == 'W':
            g2 = [row[::-1] for row in c.g]
            c.g = [[None] * 16 for _ in range(16)]
            for y in range(16):
                for x in range(16):
                    v = g2[y][x]
                    if v and x - 1 >= 0: c.g[y][x - 1] = v
            # 거울 뒤에도 빛은 왼쪽 위에서: 등받이 두 줄 명암을 바꾼다
            for y in range(1, 13):
                a, b = c.get(11, y), c.get(10, y)
                if a and b: c.set(11, y, W, 2); c.set(10, y, W, 4)
                c.set(12, y, W, 3)
            for y in range(9, 12): c.set(5, y, W, 5) if False else None
    c.outline()
    return c.img()

def stool():
    c = C(16, 16)
    for x in (4, 5, 10, 11): c.vl(x, 8, 14, 'wood', 3 if x in (4, 10) else 2)
    c.hl(5, 10, 12, 'wood', 2)
    c.ell(8, 5.5, 5.0, 3.4, 'wood', 2)
    c.ell(8, 5.0, 4.6, 2.8, 'wood', 4)
    grain(c, 5, 4, 11, 6, 'wood', 3, 41)
    c.outline()
    c.set(5, 3, 'wood', 5); c.set(6, 3, 'wood', 5)
    return c.img()

def bar_stool():
    c = C(16, 16)
    c.vl(8, 7, 13, 'iron', 3); c.vl(9, 7, 13, 'iron', 2)
    c.hl(5, 12, 11, 'iron', 3); c.set(12, 11, 'iron', 2)
    c.rect(6, 14, 11, 15, 'iron', 2); c.hl(6, 11, 14, 'iron', 3)
    c.ell(8.5, 4.5, 4.4, 2.8, 'red', 2)
    c.ell(8.5, 4.0, 4.0, 2.2, 'red', 4)
    c.outline()
    c.set(6, 3, 'red', 5); c.set(8, 11, 'iron', 5)
    return c.img()

def bench(wc=2):
    Wd = wc * 16; c = C(Wd, 16)
    slab_top(c, 0, 3, Wd - 1, 9, 'wood', 4, 51)
    c.hl(2, Wd - 3, 6, 'wood', 3)                              # 두 널 이음
    c.hl(0, Wd - 1, 10, 'wood', 2); c.hl(0, Wd - 1, 11, 'wood', 2)
    for lx in (2, Wd - 5):
        c.rect(lx, 12, lx + 2, 15, 'wood', 2); c.vl(lx, 12, 15, 'wood', 3)
    c.outline()
    return c.img()

# ======================================================================= 나무 궤짝·바구니·자루
def crate():
    c = C(16, 16)
    c.rect(2, 2, 13, 14, 'wood', 2)
    slab_top(c, 2, 2, 13, 6, 'wood', 4, 61)
    c.hl(3, 12, 4, 'wood', 3)
    c.hl(2, 13, 7, 'wood', 1)
    for x in (3, 12): c.vl(x, 8, 13, 'wood', 3)
    c.hl(4, 11, 10, 'wood', 1)
    for j in range(7):                                      # 비스듬한 버팀목
        x = 4 + j; y = 13 - int(j * 5 / 7)
        c.set(x, y, 'wood', 3)
    c.outline()
    return c.img()

def crate_body(mat='wood'):
    """crate_of 자리: 윗테 y3~4, 속 y5~8, 앞판 y9~15"""
    c = C(16, 16)
    c.rect(1, 3, 14, 15, mat, 2)
    c.hl(1, 14, 3, mat, 4); c.hl(2, 13, 4, mat, 1)
    c.rect(2, 5, 13, 8, mat, 1); c.hl(2, 13, 5, mat, 0)
    c.hl(1, 14, 9, mat, 4); c.hl(1, 14, 10, mat, 2)
    c.hl(2, 13, 12, mat, 3); c.hl(2, 13, 13, mat, 3)       # 앞 널 두 장: 가운데 한 장 밝게
    c.vl(2, 11, 14, mat, 3); c.vl(13, 11, 14, mat, 1)
    c.outline()
    c.set(2, 3, mat, 5) if False else None
    return c

def crate_of(goods, seed=1):
    import prim
    c = crate_body(); p = to_pix(c.img())
    prim.heap(p, 2, 1, 12, 8, goods, seed)
    for x in range(2, 14): p.set(x, 9, PAL['wood'][4])
    p.set(1, 9, PAL['wood'][0]); p.set(14, 9, PAL['wood'][0])
    return p.im

def basket_body():
    """엮은 바구니: 세로 살(3칸마다 한 단 어둡게) + 가운데 가로 엮음 한 줄 밝게. 둥근 몸이라 오른쪽은 한 단 어둡다."""
    c = C(16, 16)
    for y in range(7, 15):
        half = 6 if y < 13 else 5
        for x in range(8 - half, 8 + half):
            u = (x - (8 - half) + .5) / (2 * half)
            t = 4 if u < 0.62 else 3
            if y >= 9 and ((x + (2 if (y // 2) % 2 else 0)) // 2) % 2: t -= 1      # 2칸씩 엇갈린 엮음
            c.set(x, y, 'straw', t)
    c.hl(3, 12, 8, 'straw', 1)
    c.outline()
    return c

def basket_of(goods, seed=2):
    import prim
    c = basket_body(); p = to_pix(c.img())
    prim.heap(p, 3, 2, 10, 7, goods, seed)
    for x in range(2, 14): p.set(x, 7, PAL['straw'][4] if (x // 2) % 2 else PAL['straw'][3])
    p.set(2, 7, PAL['straw'][0]); p.set(13, 7, PAL['straw'][0])
    return p.im

def sack_body():
    """삼베 자루: 둥근 몸 세로 띠 명암, 주름 몇 개, 입구는 말린 테 + 안쪽 그늘"""
    c = C(16, 16)
    rows = [(4, 11), (3, 12), (2, 13), (2, 13), (2, 13), (2, 13), (3, 12), (4, 11)]
    for j, (a, b) in enumerate(rows):
        for x in range(a, b + 1):
            u = (x - a + .5) / (b - a + 1)
            c.set(x, 6 + j, 'straw', band_tone(u, 4))
    c.hl(4, 11, 6, 'straw', 4); c.hl(5, 10, 7, 'straw', 1)
    for x, y in ((6, 10), (6, 11), (10, 9), (9, 12)): c.shade(x, y, -1)
    c.outline()
    return c

def sack_of(goods, seed=7):
    import prim
    c = sack_body(); p = to_pix(c.img())
    prim.heap(p, 4, 2, 8, 5, goods, seed)
    for x in range(4, 12): p.set(x, 7, PAL['straw'][4])
    return p.im

# ======================================================================= 진열 선반(열린 장)
def cabinet_of(goods, seed=5):
    from mat import G
    c = C(16, 32)
    c.rect(0, 0, 15, 31, 'wood', 1)
    slab_top(c, 0, 0, 15, 2, 'wood', 4, 71)
    c.hl(0, 15, 3, 'wood', 1)
    for y in range(3, 31): c.set(1, y, 'wood', 3); c.set(14, y, 'wood', 2)
    for a in (4, 14, 23): c.hl(2, 13, a, 'wood', 0)
    for yb in (12, 21, 29):
        c.hl(1, 14, yb, 'wood', 4); c.hl(1, 14, yb + 1, 'wood', 2)
    c.hl(1, 14, 30, 'wood', 2)
    c.outline()
    p = to_pix(c.img())
    for yb in (12, 21, 29):                                   # 상품 자리는 v5 와 같은 방식(간격을 흐트러뜨림)
        xx = 2; i = int(H(yb, 0, seed) * len(goods))
        while True:
            f, a, b = G[goods[i % len(goods)]]
            if xx + a > 14: break
            f(p, xx, yb - b); xx += a + (1 if H(xx, yb, seed) < 0.5 else 0); i += 1
    return p.im

def cake_case():
    from mat import G
    c = C(32, 24)
    c.rect(1, 2, 30, 12, 'glass', 2)                           # 유리 상자
    c.rect(2, 3, 29, 5, 'glass', 3)                            # 윗 유리 (위에서 봄)
    c.rect(2, 6, 29, 11, 'linen', 3); c.hl(2, 29, 11, 'linen', 2)     # 안 선반 (리넨 깔개)
    c.vl(1, 2, 12, 'wood', 3); c.vl(30, 2, 12, 'wood', 2); c.hl(1, 30, 2, 'wood', 3)
    c.hl(2, 29, 5, 'glass', 2)
    c.rect(0, 12, 31, 22, 'wood', 2)
    c.hl(0, 31, 12, 'wood', 4); c.hl(1, 30, 13, 'wood', 1)
    for x0, x1 in ((2, 14), (17, 29)):
        c.rect(x0, 15, x1, 20, 'wood', 3); c.hl(x0, x1, 15, 'wood', 4)
    c.set(13, 17, 'brass', 4); c.set(18, 17, 'brass', 4)
    for x in (0, 1, 30, 31): c.set(x, 23, 'wood', 1)
    c.outline()
    p = to_pix(c.img())
    for g, x in (('cake', 3), ('pie', 11), ('cake', 18), ('bun', 26)):
        f, a, b = G[g]; f(p, x, 11 - b + (1 if g == 'pie' else 0))
    img = p.im; px = img.load()
    for x, y in ((4, 3), (5, 4), (19, 3), (20, 4), (21, 5)): px[x, y] = PAL['glass'][4]   # 유리 반짝 두 줄
    return img

# ======================================================================= 화분
def pot_base(c):
    rows = [5.0, 4.6, 4.2, 3.8, 3.4]
    ring(c, 8.0, 9.5, 5.0, 1.6, 'clay', 4, 3, inner=('wood', 1), inner_rx=3.8, inner_ry=0.9)
    cyl_rows(c, 8.0, rows, 'clay', 4, 10)
    c.hl(4, 11, 11, 'clay', 2)

def potted(kind='fern'):
    c = C(16, 16)
    pot_base(c)
    c.outline()                                              # 화분만 0단 윤곽
    leaf = C(16, 16)
    if kind == 'fern':
        # 잎 다발: 가운데에서 바깥으로 휘는 잎 (두께 2, 길이·각도 흐트러뜨림), 왼쪽 위 잎이 밝다
        for ang, ln in ((-2.6, 6), (-2.15, 7), (-1.7, 7), (-1.25, 7), (-0.8, 6), (-0.4, 5), (-2.95, 4)):
            for j in range(ln):
                r = j + 0.5
                x = 8 + math.cos(ang) * r * 1.1; y = 9.2 - math.sin(-ang) * r * 0.9 + j * j * 0.07
                t = 4 if x < 8.5 else 3
                leaf.set(int(x), int(y), 'green', t); leaf.set(int(x), int(y) + 1, 'green', t - 1)
    elif kind == 'flowering':
        leaf.ell(8, 6.6, 4.9, 3.5, 'green', 3); leaf.ell(7.0, 5.8, 3.0, 2.2, 'green', 4)
        for x, y in ((5, 4), (8, 3), (11, 5), (7, 7), (4, 7), (10, 7)):     # 꽃: 자리·크기 흐트러뜨림
            leaf.set(x, y, 'red', 5); leaf.set(x + 1, y, 'red', 4); leaf.set(x, y + 1, 'red', 4)
            if (x + y) % 2: leaf.set(x + 1, y + 1, 'brass', 4)
    else:  # sapling
        c.vl(8, 5, 9, 'wood', 3); c.vl(9, 6, 9, 'wood', 2)
        leaf.ell(8.3, 3.6, 4.6, 3.6, 'green', 3); leaf.ell(7.2, 2.8, 2.6, 2.0, 'green', 4)
        leaf.hl(6, 11, 6, 'green', 2)
    # 잎 윤곽은 한 단 어둡게(1단) — 가는 잎이 윤곽에 먹혀 까매지지 않게
    edge = []
    for y in range(16):
        for x in range(16):
            v = leaf.get(x, y)
            if v and v[0] == 'green' and any(not leaf.get(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))): edge.append((x, y))
    for x, y in edge: leaf.set(x, y, 'green', 1)
    for y in range(16):
        for x in range(16):
            if leaf.get(x, y): c.g[y][x] = leaf.g[y][x]
    c.set(5, 9, 'clay', 5)
    return c.img()

# ======================================================================= 불 쓰는 기물 (불꽃은 v5 애니메이션 그대로)
def stone_blocks(c, x0, y0, x1, y1, seed, m='stone', face=3, mortar=2, bh=4):
    """돌·벽돌 쌓기: 한 장 면 = face 단, 줄눈 = 한 단 어둡게 (두 톤). 장 너비 흐트러뜨림."""
    y = y0; row = 0
    while y <= y1:
        x = x0 - (3 if row % 2 else 0)
        while x <= x1:
            w = 5 + int(H(x, y, seed) * 3)
            for yy in range(y, min(y1, y + bh - 1) + 1):
                for xx in range(max(x0, x), min(x1, x + w - 1) + 1):
                    last = (yy == y + bh - 1) or (xx == x + w - 1)
                    c.set(xx, yy, m, mortar if last else face)
            x += w
        y += bh; row += 1

def fireplace_base():
    c = C(32, 32)
    c.rect(0, 4, 31, 31, 'stone', 3)
    stone_blocks(c, 1, 5, 30, 29, 81)
    c.vl(1, 5, 29, 'stone', 4)
    # 아궁이: 안은 구멍 = 검정, 둘레 한 줄 짙게
    c.rect(9, 12, 22, 26, 'stone', 1)
    c.rect(10, 13, 21, 25, 'iron', 0)
    c.hl(10, 21, 24, 'wood', 4); c.hl(10, 21, 25, 'wood', 1)     # 장작 (paint 가 불씨를 얹는다)
    c.rect(1, 27, 30, 30, 'stone', 3); c.hl(1, 30, 27, 'stone', 4); c.hl(9, 22, 26, 'stone', 1)
    # 선반(나무): 윗면이 보인다
    c.rect(0, 0, 31, 3, 'wood', 4); c.hl(1, 30, 1, 'wood', 5); c.hl(0, 31, 3, 'wood', 2)
    grain(c, 3, 2, 29, 2, 'wood', 3, 83)
    c.hl(0, 31, 4, 'stone', 1)
    c.outline()
    return c.img()

def oven_base():
    c = C(32, 32)
    # 둥근 벽돌 가마
    for y in range(4, 28):
        t = (y - 4) / 12.0
        hw = 16 * math.sqrt(max(0, 1 - (1 - min(1, t)) ** 2)) if y < 16 else 16
        for x in range(32):
            if abs(x + .5 - 16) <= hw: c.set(x, y, 'clay', 3)
    tmp = C(32, 32); stone_blocks(tmp, 0, 4, 31, 27, 91, 'clay', 3, 2, 3)
    for y in range(32):
        for x in range(32):
            if c.get(x, y) and tmp.get(x, y): c.g[y][x] = tmp.g[y][x]
    for y in range(4, 28):                                    # 둥근 몸: 왼쪽 밝게, 오른쪽 끝 어둡게 (띠 두 개만)
        xs = [x for x in range(32) if c.get(x, y)]
        if not xs: continue
        c.shade(xs[0] + 1, y, 1)
        for x in xs[-3:]: c.shade(x, y, -1)
    # 아궁이 아치
    for y in range(15, 27):
        for x in range(10, 22):
            if y >= 18 or ((x + .5 - 16) / 6) ** 2 + ((y + .5 - 18) / 3.2) ** 2 <= 1: c.set(x, y, 'clay', 1)
    for y in range(16, 26):
        for x in range(11, 21):
            if y >= 18 or ((x + .5 - 16) / 5) ** 2 + ((y + .5 - 18) / 2.4) ** 2 <= 1: c.set(x, y, 'iron', 0)
    # 굽는 빵 한 덩이
    for x, y, t in ((14, 21, 4), (15, 20, 4), (16, 20, 5), (17, 20, 4), (18, 21, 3), (14, 22, 3), (15, 21, 4), (16, 21, 4), (17, 21, 4), (15, 22, 3), (16, 22, 3), (17, 22, 3)):
        c.set(x, y, 'straw', t)
    # 받침 돌
    c.rect(0, 27, 31, 31, 'stone', 3); c.hl(0, 31, 27, 'stone', 4); c.hl(0, 31, 28, 'stone', 3)
    c.rect(11, 26, 20, 26, 'stone', 2)
    c.outline()
    return c.img()

def stove_base():
    c = C(16, 24)
    c.rect(1, 0, 14, 22, 'iron', 2)
    c.rect(1, 0, 14, 3, 'iron', 3); c.hl(2, 13, 1, 'iron', 4)
    c.rect(4, 2, 11, 2, 'iron', 2)                            # 윗면 뚜껑 자국
    c.hl(1, 14, 4, 'iron', 1)
    c.hl(2, 13, 7, 'iron', 3)
    c.rect(4, 10, 11, 17, 'iron', 1); c.rect(5, 11, 10, 16, 'iron', 0)
    c.hl(2, 13, 20, 'iron', 1)
    c.vl(2, 5, 19, 'iron', 3)
    for x in (1, 2, 13, 14): c.set(x, 23, 'iron', 1)
    c.outline()
    c.set(3, 1, 'iron', 5)
    return c.img()

def range_frame(t):
    """kitchen_range 와 같은 자리: 굴뚝 벽돌 y0~16, 쇠 후드 y13~18, 쇠 윗판 y19~25 (윗면), 벽돌 앞 y26~39, 불 문 y29~36"""
    import kit4
    FIRE = kit4.FIRE; N = 12
    c = C(32, 40)
    c.rect(6, 0, 25, 16, 'stone', 3); stone_blocks(c, 6, 0, 25, 16, 101, 'stone', 3, 2, 4)
    c.vl(6, 0, 16, 'stone', 0); c.vl(25, 0, 16, 'stone', 0); c.vl(7, 0, 16, 'stone', 4)
    for y in range(13, 19):
        w = 13 + (y - 13)
        for x in range(16 - w, 16 + w): c.set(x, y, 'iron', 3 if y == 13 else 2)
    c.hl(16 - 18 + 1, 16 + 18 - 2, 18, 'iron', 1)
    c.rect(1, 19, 30, 25, 'iron', 2)                            # 쇠 윗판: 윗면 두 톤
    c.hl(2, 29, 20, 'iron', 3); c.vl(2, 20, 25, 'iron', 3)
    for cx in (9, 22):
        ring(c, cx + .5, 22.5, 4.2, 1.9, 'iron', 1, 3, inner=('iron', 2), inner_rx=2.6, inner_ry=0.9)
    c.rect(1, 26, 30, 39, 'stone', 3); stone_blocks(c, 1, 27, 30, 38, 103, 'stone', 3, 2, 4)
    c.hl(1, 30, 26, 'iron', 4)
    c.vl(2, 27, 38, 'stone', 4)
    c.rect(7, 29, 24, 36, 'iron', 0); c.rect(8, 30, 23, 35, 'iron', 3)
    c.outline()
    im = c.img(); px = im.load()
    for y in range(31, 36):                                     # 불 문 (v5 불꽃 공식·불 색 그대로)
        for x in range(9, 23):
            ph = math.sin(2 * math.pi * (t / N) + x * 0.7 + y * 0.4)
            col = FIRE[3] if ph > 0.3 else (FIRE[4] if ph > -0.2 else FIRE[2])
            if y == 35: col = FIRE[1]
            if (x - 8) % 3 == 0: col = PAL['iron'][1]
            px[x, y] = col
    return im

# ======================================================================= 카운터 (자동 타일 조각: 16px 주기로 칠해 L/M/R 이 이어진다)
def counter_slab(Wc):
    W = Wc * 16; c = C(W, 24)
    c.rect(0, 0, W - 1, 23, 'wood', 2)
    c.rect(0, 0, W - 1, 6, 'wood', 4)                                  # 윗면 (주인공)
    for y in range(2, 6):
        for x in range(2, W - 2):
            if H((x % 16) // 3, y, 121) < 0.12:
                for xx in range(x, min(W - 2, x + 3)): c.set(xx, y, 'wood', 3)
    c.hl(1, W - 2, 1, 'wood', 5); c.vl(1, 1, 6, 'wood', 5)
    c.hl(1, W - 2, 7, 'wood', 3); c.hl(1, W - 2, 8, 'wood', 1)           # 앞 모서리 + 그 밑 그늘
    for x in range(1, W - 1):
        lx = x % 16
        for y in range(9, 22):
            if lx == 0: t = 1
            elif 2 <= lx <= 13 and 10 <= y <= 20: t = 4 if (y == 10 and lx < 13) else 3
            else: t = 2
            c.set(x, y, 'wood', t)
    c.hl(1, W - 2, 22, 'wood', 1)
    c.outline()
    return c.img()
