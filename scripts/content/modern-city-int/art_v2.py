"""modern_city 실내 — 3/4 관문(object-gate) 1차 불합격 36점 다시 그림(Opus 2026-10-14).
1차 판정 사유: 「정면 입면도 · 윗면 0~2행」. 고친 원칙(완화가 아니라 그림을 바꾼다):
  · 윗면을 7행 이상, 그 물건에서 가장 밝은 단으로 칠하고 앞면은 2~3단 어둡게(앞면이 윗면보다 밝으면 안 된다).
  · 윗면 위 물건은 자기 윗면·앞면을 가진 작은 상자로(납작한 색 판 금지).
  · 의자는 앉는 판(윗면)을 8행 이상, 등받이는 낮게·얇게 — 등받이가 앉는 판을 가리지 않는다.
art_furn.py / art_small.py 의 같은 이름 함수를 대신한다(그 파일 끝에서 덮어쓴다)."""
import math
from mpx import C, rnd, h32, slab, panel, glass, screen, plant, knob, legs, NT, MI


def _ol(c, x, y, w, h, t=1):
    c.HL(x, y, w, 'ink', t); c.HL(x, y + h - 1, w, 'ink', 0); c.VL(x, y, h, 'ink', t); c.VL(x + w - 1, y, h, 'ink', t)


def _box(c, x, y, w, top, front, mat, tt=None, ft=None):
    """작은 상자(윗면 밝음 · 앞면 어둡게 · ink 테)."""
    n = NT[MI[mat]]
    tt = n - 1 if tt is None else tt
    ft = max(0, tt - 3) if ft is None else ft
    c.R(x, y, w, top, mat, tt); c.R(x, y + top, w, front, mat, ft)
    c.HL(x, y + top, w, mat, max(0, ft - 1))
    _ol(c, x, y, w, top + front)


def _tops(c, x, y, w, h, s=0, mats=('red', 'amber', 'leaf', 'blue', 'white', 'teal', 'plum')):
    """위에서 본 상품 덩이: 3×2 상자(윗면 밝음 1행 + 몸 1행), 사이 틈 1px."""
    for j in range(0, h - 1, 3):
        for i in range(0, w - 2, 4):
            m = mats[h32(i + x, j + y, s) % len(mats)]
            n = NT[MI[m]]
            c.R(x + i, y + j, 3, 1, m, n - 1); c.R(x + i, y + j + 1, 3, 1, m, max(0, n - 3))


def _front_goods(c, x, y, w, h, s=0, mats=('red', 'amber', 'leaf', 'blue', 'navy', 'white', 'plum', 'teal')):
    """선반 단 안 상품 앞면(1~3px 폭, 높이 변주, 윗면 1px)."""
    i = 0; k = 0
    while i < w:
        bw = 1 + h32(k, 1, s) % 3
        bh = max(2, h - (h32(k, 2, s) % 3))
        m = mats[h32(k, 3, s) % len(mats)]
        n = NT[MI[m]]
        for q in range(bw):
            if i + q >= w: break
            c.VL(x + i + q, y + h - bh, bh, m, max(0, n - 3) if q == bw - 1 and bw > 1 else max(0, n - 2))
            c.P(x + i + q, y + h - bh, m, n - 1)
        i += bw; k += 1


# ═══════════════ 의자 ═══════════════
def _seat(c, x, y, w, top, front, mat, tt, ft, legs_at=None, leg_h=0, leg_mat=('dark', 3)):
    n = NT[MI[mat]]
    c.R(x, y, w, top, mat, tt)
    c.HL(x + 1, y + 1, w - 2, mat, min(n - 1, tt + 1))
    c.HL(x, y + top - 1, w, mat, min(n - 1, tt + 1))
    c.R(x, y + top, w, front, mat, ft)
    _ol(c, x - 1, y - 1, w + 2, top + front + 2)
    if legs_at:
        for lx in legs_at: c.VL(lx, y + top + front + 1, leg_h, *leg_mat); c.P(lx, y + top + front + leg_h, 'ink', 0)


def _office_base(c):
    c.VL(7, 24, 3, 'dark', 4); c.VL(8, 24, 3, 'dark', 2)
    c.HL(2, 27, 12, 'dark', 3); c.HL(3, 28, 10, 'dark', 1)
    for x in (2, 7, 13): c.R(x, 29, 2, 2, 'ink', 1)


def chair_office_s(c):
    """사무용 의자 남향: 낮은 둥근 등받이(윗면 4행) 뒤, 넓은 앉는 판 윗면 8행, 별 다리 바퀴."""
    _office_base(c)
    m = 'navy'
    c.R(4, 7, 8, 9, m, 2)                                 # 등받이 앞면
    c.R(4, 4, 8, 4, m, 5); c.HL(5, 4, 6, m, 6)            # 등받이 윗면
    c.VL(4, 8, 8, m, 3); c.HL(4, 15, 8, m, 1)
    _ol(c, 3, 3, 10, 14)
    c.P(3, 3, None); c.P(12, 3, None)
    _seat(c, 2, 15, 12, 8, 2, m, 4, 1)
    c.R(1, 17, 1, 4, 'dark', 3); c.R(14, 17, 1, 4, 'dark', 2)


def chair_office_n(c):
    """사무용 의자 북향: 앉는 판 윗면(뒤 7행 보임) + 남쪽 낮은 등받이 뒷면(윗면 3행)."""
    _office_base(c)
    m = 'navy'
    _seat(c, 2, 8, 12, 9, 2, m, 4, 1)
    c.R(3, 13, 10, 3, m, 5); c.HL(4, 13, 8, m, 6)         # 등받이 윗면
    c.R(3, 16, 10, 7, m, 2); c.VL(3, 16, 7, m, 3); c.VL(8, 17, 5, m, 1)
    _ol(c, 2, 12, 12, 12)
    c.P(2, 12, None); c.P(13, 12, None)


def chair_wood(c, facing='s'):
    """나무 의자. s = 북쪽 등받이(가로대 둘, 기둥 사이로 벽 보임) + 앉는 판 윗면 8행. n = 앉는 판 뒤쪽 + 남쪽 등받이 가로대."""
    m = 'wood'
    if facing == 's':
        for x in (3, 12): c.VL(x, 5, 12, m, 2); c.VL(x + 1 if x == 3 else x - 1, 5, 12, m, 1)
        c.R(3, 4, 10, 3, m, 5); c.HL(3, 6, 10, m, 3); _ol(c, 2, 3, 12, 5)
        c.R(4, 10, 8, 2, m, 4); c.HL(4, 11, 8, m, 2)
        for x in (2, 13): c.VL(x, 7, 9, 'ink', 1)
        _seat(c, 2, 16, 12, 8, 2, m, 4, 2, legs_at=(3, 12), leg_h=4, leg_mat=(m, 1))
    else:
        _seat(c, 2, 9, 12, 9, 2, m, 4, 2, legs_at=(3, 12), leg_h=8, leg_mat=(m, 1))
        c.R(2, 15, 12, 2, m, 5); c.HL(2, 17, 12, m, 3); _ol(c, 1, 14, 14, 5)
        for x in (3, 12): c.R(x, 19, 1, 6, m, 3); c.P(x - (1 if x == 3 else -1), 19, 'ink', 1)


def chair_wood_s(c): chair_wood(c, 's')
def chair_wood_n(c): chair_wood(c, 'n')


def cafe_chair(c, facing='e'):
    """카페 의자 옆향: 앉는 판 윗면 9행 + 한쪽 등받이(윗면 띠가 남북으로 보임) + 쇠 다리. e = 동쪽을 봄."""
    m = 'wood'
    _seat(c, 3, 13, 10, 9, 2, m, 4, 2, legs_at=(4, 11), leg_h=5)
    bx = 1 if facing == 'e' else 12
    c.R(bx, 5, 3, 18, 'dark', 2); c.VL(bx + 1, 5, 17, 'dark', 5); c.VL(bx, 6, 16, 'dark', 3)
    c.R(bx, 5, 3, 2, 'dark', 5)
    _ol(c, bx - 1, 4, 5, 20)


def cafe_chair_e(c): cafe_chair(c, 'e')
def cafe_chair_w(c): cafe_chair(c, 'w')


def wait_bench(c):
    """대기 의자 셋: 낮은 등받이(윗면 3행) + 넓은 앉는 판 윗면 8행 + 쇠 들보·다리."""
    for k in range(3):
        x = 2 + k * 16
        c.R(x + 1, 5, 10, 3, 'teal', 4); c.R(x + 1, 8, 10, 5, 'teal', 2); c.HL(x + 1, 12, 10, 'teal', 1)
        _ol(c, x, 4, 12, 10)
        _seat(c, x, 13, 12, 8, 2, 'teal', 4, 1)
    c.R(1, 25, 46, 2, 'grey', 4); c.HL(1, 26, 46, 'grey', 1)
    for x in (4, 23, 43): c.VL(x, 27, 3, 'grey', 3); c.P(x, 30, 'ink', 0)


def sofa(c, w=3, mat='navy'):
    """소파 남향: 등받이 윗면 5행 + 팔걸이 윗면(넓게) + 쿠션 윗면 8행 + 앞면 + 짧은 다리."""
    W = w * 16
    n = NT[MI[mat]]
    aw = 5 if w > 1 else 3
    c.R(aw - 1, 3, W - 2 * aw + 2, 5, mat, n - 2); c.HL(aw, 3, W - 2 * aw, mat, n - 1)
    c.R(aw - 1, 8, W - 2 * aw + 2, 5, mat, 2)
    for k in range(1, w): c.VL(aw - 1 + k * (W - 2 * aw + 2) // w, 8, 5, mat, 1)
    for ax, lt in ((0, 0), (W - aw, 1)):
        c.R(ax, 7, aw, 14, mat, n - 2 - lt); c.HL(ax, 7, aw, mat, n - 1 - lt)
        c.R(ax, 21, aw, 6, mat, 2 - lt)
    cw = (W - 2 * aw) // w
    for k in range(w):
        x = aw + k * cw
        c.R(x, 13, cw, 8, mat, n - 3); c.HL(x, 13, cw, mat, n - 2); c.VL(x, 14, 7, mat, n - 2); c.VL(x + cw - 1, 13, 8, mat, 3)
        c.R(x, 21, cw, 5, mat, 3); c.HL(x, 21, cw, mat, 2)
    c.HL(0, 26, W, mat, 1)
    c.outline()
    for x in (2, W - 3): c.R(x, 28, 1, 2, 'wood', 1)


def sofa3(c): sofa(c, 3)


def armchair(c): sofa(c, 1, 'rose')


# ═══════════════ 사무실 ═══════════════
def partition(c):
    """칸막이(2칸): 두꺼운 알루미늄 갓(윗면 5행) + 천 판 + 받침 발 둘(윗면 보임)."""
    c.R(0, 8, 32, 5, 'grey', 6); c.HL(0, 12, 32, 'grey', 5); c.HL(1, 9, 30, 'grey', 6)
    for y in range(13, 26):
        for x in range(1, 31): c.P(x, y, 'slate', 3 if rnd(x, y // 2, 40) > 0.25 else 2)
    c.HL(1, 13, 30, 'slate', 1); c.VL(1, 13, 13, 'slate', 4); c.VL(30, 13, 13, 'slate', 1); c.VL(16, 13, 13, 'grey', 3)
    _ol(c, 0, 7, 32, 20)
    for x in (3, 25):
        c.R(x, 25, 4, 3, 'grey', 5); c.R(x, 28, 4, 1, 'grey', 2); _ol(c, x - 1, 24, 6, 6)


def copier(c):
    """복합기(1칸): 윗면 10행(원고 덮개·조작판·나온 종이) + 앞면 용지함 셋."""
    slab(c, 0, 3, 16, 10, 18, 'grey', tt=6, ft=3)
    c.R(2, 5, 8, 6, 'grey', 5); c.HL(2, 5, 8, 'grey', 6); c.HL(2, 10, 8, 'grey', 4); _ol(c, 1, 4, 10, 8)
    c.R(11, 5, 4, 4, 'dark', 3); c.R(12, 6, 2, 2, 'blue', 4); c.P(13, 9, 'leaf', 5)
    c.R(11, 10, 4, 2, 'white', 2)
    for k in range(3):
        y = 15 + k * 5
        panel(c, 2, y, 12, 4, 'grey', 2); c.HL(6, y + 2, 4, 'dark', 3)


def server_rack(c):
    """서버 랙 둘(2칸, 벽 가구): 밝은 금속 윗면 7행(환기 틈) + 어두운 앞문 속 장비 줄·불빛."""
    for k in range(2):
        x = k * 16
        slab(c, x, 0, 16, 7, 24, 'dark', tt=5, ft=1)
        c.R(x + 2, 2, 12, 3, 'grey', 3)
        for i in range(3, 13, 2): c.P(x + i, 3, 'dark', 2)
        for r in range(6):
            y = 9 + r * 3
            c.HL(x + 2, y, 12, 'dark', 3); c.HL(x + 2, y + 1, 12, 'dark', 2)
            for i in range(3):
                if h32(r, i + k * 7, 41) % 3: c.P(x + 3 + i * 2, y + 1, ('leaf', 'amber', 'blue')[h32(r, i, 42) % 3], 4)
        c.VL(x + 13, 10, 17, 'grey', 2)


def shelf_office(c):
    """서가(2칸, 벽 가구): 나무 윗면 7행 위 눕힌 책·상자 + 앞 세 단 서류철."""
    slab(c, 0, 0, 32, 7, 24, 'wood', tt=5, ft=1)
    _box(c, 3, 1, 9, 2, 2, 'white', tt=2, ft=0)
    _box(c, 17, 2, 8, 2, 2, 'blue', tt=4, ft=1)
    for r in range(3):
        y = 8 + r * 7
        c.R(2, y, 28, 6, 'wood', 0)
        _front_goods(c, 3, y + 1, 26, 5, s=r, mats=('blue', 'navy', 'red', 'white', 'amber', 'teal', 'grey'))
        c.HL(1, y + 6, 30, 'wood', 3)


# ═══════════════ 편의점 ═══════════════
def gondola(c):
    """진열대(2칸, 양면): 넓은 윗면 10행(가운데 칸막이 + 양쪽 상품 덩이) + 앞 세 단 상품."""
    c.R(0, 2, 32, 10, 'grey', 6)
    c.R(2, 3, 28, 8, 'grey', 4)
    _tops(c, 3, 4, 26, 3, s=3); _tops(c, 3, 8, 26, 3, s=5)
    c.HL(2, 7, 28, 'grey', 6)
    c.R(0, 12, 32, 18, 'grey', 2)
    for r in range(3):
        y = 13 + r * 6
        c.R(2, y, 28, 5, 'dark', 2)
        _front_goods(c, 2, y, 28, 5, s=r + 7)
        c.HL(1, y + 5, 30, 'white', 1)
    c.VL(1, 12, 18, 'grey', 3); c.VL(30, 12, 18, 'grey', 1)
    _ol(c, 0, 1, 32, 31)


def gondola_v(c):
    """세로 진열대(1×2): 남북으로 긴 윗면(테 + 가운데 칸막이 + 두 줄 상품 덩이) + 남쪽 끝 면."""
    c.R(0, 3, 16, 33, 'grey', 6)
    c.R(2, 4, 12, 31, 'grey', 4)
    c.VL(7, 4, 31, 'grey', 6); c.VL(8, 4, 31, 'grey', 5)
    for j in range(5, 34, 3):
        for (x, s) in ((3, 11), (10, 12)):
            m = ('red', 'amber', 'leaf', 'blue', 'white', 'teal', 'plum')[h32(x, j, s) % 7]
            n = NT[MI[m]]
            c.R(x, j, 3, 1, m, n - 1); c.R(x, j + 1, 3, 1, m, max(0, n - 3))
    c.R(0, 36, 16, 10, 'grey', 2)
    c.R(2, 37, 12, 3, 'dark', 2); _front_goods(c, 2, 37, 12, 3, s=13); c.HL(2, 40, 12, 'white', 1)
    c.R(2, 41, 12, 3, 'dark', 2); _front_goods(c, 2, 41, 12, 3, s=14)
    _ol(c, 0, 2, 16, 45)


def cooler(c):
    """음료 냉장고(2칸, 벽 가구): 밝은 금속 윗면 7행(환기 틈) + 어두운 틀 유리문 둘 속 병 줄."""
    slab(c, 0, 0, 32, 7, 24, 'grey', tt=6, ft=1)
    for i in range(4, 28, 3): c.HL(i, 3, 2, 'grey', 3)
    for k in range(2):
        x = 2 + k * 15
        c.R(x, 8, 13, 20, 'white', 1)
        for r in range(4):
            y = 9 + r * 5
            for i in range(6):
                m = ('red', 'amber', 'leaf', 'blue', 'teal', 'plum')[h32(i, r + k * 4, 44) % 6]
                n = NT[MI[m]]
                c.VL(x + 1 + i * 2, y + 1, 3, m, n - 2); c.P(x + 1 + i * 2, y, 'grey', 4)
            c.HL(x, y + 4, 13, 'grey', 3)
        c.VL(x + (11 if k == 0 else 1), 13, 8, 'grey', 6)
        _ol(c, x - 1, 7, 15, 22)
    c.HL(0, 30, 32, 'ink', 0)


def magazine_rack(c):
    """잡지 진열대(2칸, 벽 가구): 낮은 선반 윗면 8행에 눕힌 잡지 + 앞 두 단 경사 표지."""
    slab(c, 0, 8, 32, 8, 14, 'grey', tt=6, ft=2)
    for k, m in enumerate(('blue', 'red', 'amber', 'leaf')):
        x = 2 + k * 7
        c.R(x, 9 + (k % 2), 6, 5, m, NT[MI[m]] - 2); c.HL(x, 9 + (k % 2), 6, m, NT[MI[m]] - 1); c.R(x + 1, 11 + (k % 2), 3, 1, 'white', 2)
    for r in range(2):
        y = 17 + r * 6
        for k in range(5):
            m = ('red', 'blue', 'amber', 'leaf', 'plum')[(k + r * 2) % 5]
            c.R(2 + k * 6, y, 5, 4, m, NT[MI[m]] - 3); c.HL(2 + k * 6, y, 5, m, NT[MI[m]] - 1)
        c.HL(1, y + 4, 30, 'grey', 4)


def atm(c):
    """ATM(1칸, 벽 가구): 밝은 윗면 8행 + 앞쪽으로 기운 조작부(화면·숫자판·구멍)."""
    slab(c, 0, 2, 16, 8, 20, 'grey', tt=6, ft=2)
    c.R(3, 4, 10, 3, 'leaf', 4); c.HL(3, 4, 10, 'leaf', 5)
    c.R(2, 11, 12, 7, 'dark', 1); c.R(3, 12, 10, 5, 'blue', 4); c.HL(3, 12, 10, 'navy', 6)
    c.R(2, 19, 12, 5, 'grey', 4); c.HL(2, 19, 12, 'grey', 5)
    for j in range(2):
        for i in range(4): c.P(3 + i * 2, 20 + j * 2, 'dark', 2)
    c.R(11, 20, 2, 1, 'dark', 1); c.R(4, 26, 8, 1, 'dark', 1)


def basket_stack(c):
    """장바구니 더미(1칸): 맨 위 바구니 아가리(안쪽 바닥 격자 8행) + 손잡이 + 아래 겹친 테."""
    c.R(1, 6, 14, 11, 'red', 5)
    c.R(3, 8, 10, 8, 'red', 1)
    for j in range(9, 16, 2):
        for i in range(4, 13, 2): c.P(i, j, 'red', 0)
    c.HL(3, 8, 10, 'red', 0)
    c.VL(1, 6, 11, 'red', 6); c.HL(1, 6, 14, 'red', 6)
    c.HL(3, 3, 3, 'dark', 3); c.HL(10, 3, 3, 'dark', 3); c.VL(3, 4, 3, 'dark', 3); c.VL(12, 4, 3, 'dark', 3)
    for k in range(3): c.HL(1, 17 + k * 2, 14, 'red', 4 - k); c.HL(1, 18 + k * 2, 14, 'red', 1)
    _ol(c, 0, 5, 16, 18)


def wardrobe(c):
    """옷장(2칸, 벽 가구): 밝은 나무 윗면 8행 위 수납 상자 + 문짝 둘(결) + 아래 서랍."""
    slab(c, 0, 0, 32, 8, 23, 'wood', tt=5, ft=2, grain='wood')
    _box(c, 5, 1, 10, 3, 3, 'beige', tt=5, ft=2)
    for k in range(2):
        panel(c, 2 + k * 14, 9, 14, 14, 'wood', 2)
        for y in range(11, 22, 3): c.HL(4 + k * 14, y, 10, 'wood', 1)
    c.VL(15, 12, 6, 'amber', 4); c.VL(17, 12, 6, 'amber', 4)
    panel(c, 2, 24, 28, 5, 'wood', 2); c.HL(13, 26, 6, 'amber', 3)


def pastry_case(c):
    """진열 냉장 케이스(2칸): 위에서 들여다보는 유리 윗면 11행(케이크 셋의 윗면) + 나무 아랫장."""
    c.R(0, 3, 32, 13, 'grey', 6)
    for j in range(11):
        for i in range(28):
            c.P(2 + i, 4 + j, 'teal', 4 if (i + j) % 9 > 1 else 4)
    c.R(2, 4, 28, 11, 'white', 1)
    for k, (m, t) in enumerate((('white', 2), ('brick', 4), ('amber', 4))):
        x = 4 + k * 9
        c.R(x, 6, 7, 4, m, t); c.HL(x, 6, 7, m, min(NT[MI[m]] - 1, t)); c.R(x, 10, 7, 2, m, max(0, t - 2))
        c.P(x + 3, 6, 'red', 5); _ol(c, x - 1, 5, 9, 8)
    for i in range(0, 28, 7): c.line(2 + i, 4, 6 + i, 14, 'white', 2)
    c.HL(1, 15, 30, 'grey', 3)
    c.R(0, 16, 32, 13, 'wood', 1); c.HL(0, 16, 32, 'wood', 2)
    for k in range(2): panel(c, 2 + k * 15, 18, 13, 9, 'wood', 1)
    _ol(c, 0, 2, 32, 28)


# ═══════════════ 병원 ═══════════════
def hosp_curtain(c):
    """병상 칸막이(2칸, 접이 병풍 넷): 지그재그로 꺾인 판마다 위 테 윗면(뒤 판·앞 판 높이 차) + 연청록 천."""
    xs = (0, 8, 16, 24, 32)
    for k in range(4):
        x0, x1 = xs[k], xs[k + 1]
        back = k % 2 == 0
        top = 6 if back else 9
        bot = 25 if back else 28
        tone = (4, 3) if back else (5, 4)
        for x in range(x0, x1):
            for y in range(top + 3, bot):
                fold = (x // 2) % 2
                c.P(x, y, 'sage', tone[fold])
            c.R(x, top, 1, 3, 'grey', 6 if back else 5)
            c.P(x, top + 2, 'grey', 3)
        c.VL(x0, top, bot - top, 'grey', 3)
        c.HL(x0, bot - 1, x1 - x0, 'grey', 2)
    for k, x in enumerate(xs):
        x = min(x, 31)
        c.VL(x, 6, 23, 'grey', 4 if k % 2 == 0 else 2)
    c.outline()
    for x in (1, 15, 30): c.R(x - 1, 29, 2, 2, 'dark', 1)


def iv_stand(c):
    """링거 걸대(1칸): 위에서 보이는 큰 원형 받침(바퀴 다섯) + 굵은 기둥(꼭대기 마개 윗면) + 수액 팩."""
    c.ell(8, 25, 7, 4, lambda x, y, dx, dy, d: ('grey', 6 if dy < -0.2 else 5 if d < 0.5 else 4) if d < 0.7 else ('grey', 2))
    c.ell(8, 25, 7, 4, lambda x, y, dx, dy, d: ('ink', 1) if d > 0.85 else None)
    for (x, y) in ((2, 26), (14, 26), (8, 29), (4, 22), (12, 22)): c.R(x - 1, y, 2, 2, 'dark', 1)
    c.R(7, 5, 3, 20, 'grey', 4); c.VL(7, 5, 20, 'grey', 6); c.VL(9, 5, 20, 'grey', 2)
    c.R(6, 2, 5, 3, 'grey', 6); c.HL(6, 4, 5, 'grey', 3); _ol(c, 5, 1, 7, 5)
    c.R(10, 6, 5, 9, 'white', 2); c.R(10, 6, 5, 2, 'white', 2); c.R(11, 10, 3, 4, 'blue', 4); _ol(c, 10, 5, 5, 11)
    c.VL(12, 16, 6, 'white', 1)


def stanchion(c):
    """줄 세우기 기둥(1칸): 굵은 기둥 꼭대기 둥근 윗면(4행) + 붉은 띠 줄 + 넓은 원판 받침(윗면 5행)."""
    c.ell(7, 26, 5.5, 3, lambda x, y, dx, dy, d: ('grey', 6 if dy < 0 else 4) if d < 0.75 else ('grey', 2))
    c.ell(7, 26, 5.5, 3, lambda x, y, dx, dy, d: ('ink', 1) if d > 0.88 else None)
    c.R(5, 8, 4, 18, 'grey', 4); c.VL(5, 8, 18, 'grey', 6); c.VL(8, 8, 18, 'grey', 2)
    c.ell(7, 7, 3.2, 2.2, lambda x, y, dx, dy, d: ('grey', 6) if d < 0.6 else ('grey', 5))
    c.ell(7, 7, 3.2, 2.2, lambda x, y, dx, dy, d: ('ink', 1) if d > 0.8 else None)
    for x in range(9, 16):
        y = 12 + int(round(3 * math.sin((x - 9) / 8 * math.pi)))
        c.P(x, y, 'red', 5); c.P(x, y + 1, 'red', 2)


# ═══════════════ 로비·은행·역 ═══════════════
def _gate_body(c, x, y, w, mat='grey', pad='teal'):
    slab(c, x, y, w, 10, 12, mat, tt=6, ft=2)
    c.R(x + 2, y + 2, w - 4, 4, pad, 4); c.HL(x + 2, y + 2, w - 4, pad, 4); c.P(x + w - 3, y + 7, 'leaf', 5)


def security_gate(c):
    """출입 보안 게이트(2칸): 몸통 둘(밝은 윗면 10행·판독기) + 사이 유리 날개(위에서 보이는 얇은 판)."""
    _gate_body(c, 0, 6, 11)
    _gate_body(c, 21, 6, 11)
    c.R(11, 11, 10, 3, 'teal', 4); c.HL(11, 11, 10, 'white', 1); c.HL(11, 13, 10, 'teal', 2)
    c.R(11, 14, 10, 6, 'teal', 3); c.HL(11, 19, 10, 'ink', 0)


def ticket_gate(c):
    """개찰구(2칸): 몸통 둘(밝은 윗면 10행 · 판독 패드) + 가운데 붉은 날개(윗면 띠)."""
    _gate_body(c, 0, 4, 12)
    _gate_body(c, 20, 4, 12)
    for x in (12, 17):
        c.R(x, 11, 3, 3, 'red', 6); c.R(x, 14, 3, 5, 'red', 3); _ol(c, x, 10, 3, 10)


def planter(c):
    """긴 화분 상자(2칸): 밝은 테 윗면 + 흙 아가리(7행) 속 낮은 관목 셋 + 회색 앞면."""
    c.R(0, 9, 32, 11, 'grey', 6)
    c.R(2, 11, 28, 7, 'brick', 0)
    for i in range(28):
        if rnd(i, 1, 46) < 0.3: c.P(2 + i, 12 + h32(i, 2, 46) % 5, 'brick', 1)
    for (cx, r) in ((8, 4.5), (16, 5), (24, 4.5)):
        c.ell(cx, 13, r, 3.2, lambda x, y, dx, dy, d: ('leaf', 5 if dx + dy < -0.6 else 4 if d < 0.5 else 3 if d < 0.85 else 2))
    c.R(0, 20, 32, 9, 'grey', 3); c.HL(0, 20, 32, 'grey', 2); c.VL(1, 20, 9, 'grey', 4); c.VL(30, 20, 9, 'grey', 1)
    _ol(c, 0, 8, 32, 22)


def ticket_machine(c):
    """발권기(2칸, 벽 가구): 밝은 남색 윗면 7행 + 앞쪽 켜진 화면·동전·지폐·표 나오는 홈."""
    for k in range(2):
        x = k * 16
        slab(c, x, 0, 16, 7, 24, 'navy', tt=6, ft=2)
        c.R(x + 3, 2, 10, 2, 'navy', 4)
        c.R(x + 2, 9, 12, 8, 'dark', 1); c.R(x + 3, 10, 10, 6, 'blue', 4); c.HL(x + 3, 10, 10, 'navy', 6)
        for i in range(3): c.R(x + 4 + i * 3, 12, 2, 2, ('amber', 'leaf', 'red')[i], 4)
        c.R(x + 3, 19, 4, 1, 'dark', 1); c.R(x + 10, 19, 3, 2, 'dark', 1); c.R(x + 4, 24, 8, 2, 'dark', 1)


# ═══════════════ 창고 ═══════════════
def rack(c):
    """창고 선반(3칸, 벽 가구): 맨 윗판 윗면 7행 위 상자 윗면 + 두 단 골판지 상자(상자마다 윗면·앞면) + 주황 기둥."""
    c.R(0, 0, 48, 7, 'blue', 4); c.HL(0, 6, 48, 'blue', 2)
    for k in range(3):
        _box(c, 4 + k * 15, 1, 10, 3, 2, 'wood', tt=5, ft=3)
        c.HL(5 + k * 15, 2, 8, 'amber', 3)
    for r in range(2):
        y = 7 + r * 12
        c.R(2, y, 44, 9, 'dark', 1)
        for k in range(4):
            bx = 3 + k * 11; bw = 9 - (k % 2); bh = 7 + (k + r) % 2
            _box(c, bx, y + 9 - bh, bw, 3, bh - 3, 'wood', tt=5, ft=3)
            c.HL(bx + 1, y + 10 - bh, bw - 2, 'amber', 3)
        c.R(0, y + 9, 48, 3, 'blue', 3); c.HL(0, y + 9, 48, 'blue', 4); c.HL(0, y + 11, 48, 'blue', 1)
    for x in (0, 23, 45):
        c.R(x, 0, 3, 31, 'brick', 4); c.VL(x + 2, 0, 31, 'brick', 2)
        for y in range(2, 30, 3): c.P(x + 1, y, 'brick', 1)
    _ol(c, 0, 0, 48, 32)


def pallet_boxes(c):
    """팔레트 위 상자 더미(1칸): 아래 두 상자·위 한 상자 — 상자마다 윗면 5~6행(테이프) + 앞면 + 나무 팔레트."""
    for (x, y, w) in ((1, 12, 7), (8, 12, 7)):
        _box(c, x, y, w, 5, 6, 'wood', tt=5, ft=2); c.VL(x + w // 2, y + 1, 3, 'amber', 3)
    _box(c, 3, 3, 10, 6, 6, 'wood', tt=5, ft=2); c.VL(8, 4, 4, 'amber', 3)
    c.R(0, 23, 16, 6, 'wood', 2); c.R(0, 23, 16, 2, 'wood', 4)
    for x in (2, 7, 12): c.R(x, 26, 2, 3, 'wood', 0)
    _ol(c, 0, 23, 16, 7)


def drums(c):
    """드럼통 둘(1칸): 위에서 보이는 큰 뚜껑 타원(7행, 밝은 테·마개) + 둥근 몸통 명암·테 두 줄."""
    for (cx, m) in ((5, 'blue'), (11, 'red')):
        n = NT[MI[m]]
        for x in range(cx - 4, cx + 4):
            c.VL(x, 13, 14, m, n - 2 if x < cx - 1 else n - 4 if x < cx + 2 else 1)
        c.HL(cx - 4, 18, 8, m, 1); c.HL(cx - 4, 23, 8, m, 1)
        c.ell(cx, 12, 4.3, 3.6, lambda x, y, dx, dy, d: ('grey', 5) if d > 0.55 else (m, n - 1))
        c.R(cx, 10, 2, 1, 'grey', 6)
    c.outline()


# ═══════════════ 탁상 물건 16×16 ═══════════════
def g_phone(c):
    """사무 전화기: 넓은 몸체 윗면 7행(단추 격자) + 수화기(윗면·앞면) + 앞면 2행."""
    c.R(2, 5, 12, 7, 'dark', 5); c.R(2, 12, 12, 2, 'dark', 2)
    for j in range(2):
        for i in range(3): c.P(8 + i * 2, 8 + j * 2, 'grey', 6)
    c.R(3, 3, 4, 7, 'dark', 4); c.HL(3, 3, 4, 'dark', 5); c.R(3, 10, 4, 1, 'dark', 1)
    _ol(c, 1, 4, 14, 11)


def g_register(c):
    """계산 단말: 돈통 상자(밝은 윗면 6행) 위에 기운 작은 화면(위 테 윗면) + 카드기."""
    _box(c, 1, 6, 14, 6, 3, 'grey', tt=6, ft=3)
    c.R(3, 2, 7, 5, 'dark', 2); c.R(4, 3, 5, 3, 'blue', 4); c.HL(3, 2, 7, 'dark', 5); _ol(c, 2, 1, 9, 7)
    c.R(11, 7, 3, 4, 'dark', 4); c.HL(11, 7, 3, 'dark', 5); c.P(12, 9, 'leaf', 5)


def g_espresso(c):
    """에스프레소 머신: 밝은 윗면 6행(컵 둘 데우는 판) + 앞면 추출구 + 받침 컵."""
    _box(c, 2, 1, 12, 6, 7, 'grey', tt=6, ft=3)
    c.R(4, 2, 3, 3, 'white', 2); c.R(9, 2, 3, 3, 'white', 2); c.P(5, 3, 'brick', 1); c.P(10, 3, 'brick', 1)
    c.R(5, 8, 6, 2, 'dark', 2); c.R(6, 11, 4, 3, 'white', 2); c.HL(6, 11, 4, 'brick', 1)
    c.P(4, 9, 'red', 5); c.P(11, 9, 'leaf', 5)


def g_cake(c):
    """케이크 접시: 위에서 본 흰 접시(넓은 타원) 위 케이크 조각 둘(윗면 4행·앞면 2행)."""
    c.ell(8, 9, 7, 5, lambda x, y, dx, dy, d: ('white', 2 if d > 0.6 else 1) if d < 0.9 else ('grey', 4))
    _box(c, 3, 5, 5, 4, 3, 'white', tt=2, ft=0); c.HL(4, 6, 3, 'red', 5)
    _box(c, 9, 6, 5, 4, 3, 'brick', tt=4, ft=1); c.HL(10, 7, 3, 'wood', 5)


def g_vase(c):
    """꽃 화분: 넓은 둥근 아가리(윗면 4행, 흙) 속 꽃 셋을 위에서 + 짧은 몸통."""
    c.ell(8, 8, 6, 3.6, lambda x, y, dx, dy, d: ('teal', 4) if d > 0.55 else ('brick', 0))
    c.ell(8, 8, 6, 3.6, lambda x, y, dx, dy, d: ('ink', 1) if d > 0.85 else None)
    for (x, y, m) in ((5, 6, 'red'), (8, 7, 'amber'), (11, 6, 'plum'), (7, 9, 'leaf')):
        c.R(x - 1, y - 1, 2, 2, m, NT[MI[m]] - 1); c.P(x, y, m, NT[MI[m]] - 3)
    c.R(4, 11, 9, 3, 'teal', 2); c.VL(4, 11, 3, 'teal', 3); c.HL(4, 14, 9, 'ink', 0)


def g_books(c):
    """책 더미: 책 셋을 엇갈려 쌓음 — 맨 위 표지 윗면 5행 + 책마다 등 앞면."""
    _box(c, 1, 9, 13, 2, 3, 'red', tt=5, ft=2)
    _box(c, 3, 6, 12, 2, 3, 'blue', tt=4, ft=1)
    _box(c, 2, 1, 11, 5, 3, 'leaf', tt=5, ft=2)
    c.HL(3, 7, 9, 'white', 1); c.HL(4, 12, 9, 'white', 1)


# ═══════════════ 2차(관문 2회차 불합격 24점) ═══════════════
# 판정자 근거: 「밝은 띠가 앞판(간판)으로 읽힌다 · 선반 깊이 없음 · 원통 뚜껑 타원 없음 · 의자 뒷면 입면도」.
# 고친 원칙: 윗면은 뒤→앞 두 단 명암(뒤 어둡게 · 앞 모서리 가장 밝은 테) + 그 위에 서 있는 물건(자기 그림자 1행).
#            선반 칸은 판 윗면 2행(밝게) + 칸 안쪽 뒷벽(어둡게)으로 깊이를 준다. 원통·기둥은 위가 타원.

def top3(c, x, y, w, top, front, mat, tt=None, ft=None):
    """깊은 윗면(뒤 1/3 한 단 어둡게 · 앞 모서리 테 가장 밝게) + 앞면(2~3단 어둡게) + ink 테. 앞면 첫 행 y 를 돌려준다."""
    n = NT[MI[mat]]
    tt = n - 2 if tt is None else tt
    ft = max(0, tt - 3) if ft is None else ft
    for j in range(top):
        t = tt - 1 if j < max(1, top // 3) else tt
        if j == top - 1: t = min(n - 1, tt + 1)
        c.HL(x, y + j, w, mat, max(0, t))
    c.R(x, y + top, w, front, mat, ft)
    c.HL(x, y + top, w, mat, max(0, ft - 1))
    if front > 3: c.VL(x + 1, y + top + 1, front - 2, mat, min(n - 1, ft + 1))
    _ol(c, x, y, w, top + front)
    return y + top


def _stand(c, x, y, w, h, mat, tt=None):
    """윗면 위에 선 작은 물건(윗면 2행 + 앞면) + 바로 아래 그림자 1행."""
    n = NT[MI[mat]]
    tt = n - 1 if tt is None else tt
    c.R(x, y, w, 2, mat, tt); c.R(x, y + 2, w, h - 2, mat, max(0, tt - 3))
    _ol(c, x, y - 1, w, h + 1)


def _shelf_bay(c, x, y, w, h, s=0, mats=('red', 'amber', 'leaf', 'blue', 'navy', 'white', 'plum', 'teal'), back=('dark', 1), board='grey', bt=5):
    """선반 한 칸: 안쪽 뒷벽(어둡게) + 선 상품(윗면 1px 밝게) + 아래 판 윗면 2행."""
    c.R(x, y, w, h, *back)
    _front_goods(c, x, y + 1, w, h - 3, s=s, mats=mats)
    c.HL(x, y + h - 2, w, board, bt); c.HL(x, y + h - 1, w, board, max(0, bt - 2))


def copier(c):
    """복합기: 깊은 윗면 11행(뒤 어둡게·앞 테 밝게) 위 원고 덮개(선 상자)·조작판·나온 종이 + 앞면 용지함 셋."""
    top3(c, 0, 2, 16, 11, 18, 'grey', tt=5, ft=2)
    _stand(c, 2, 3, 8, 5, 'grey', 6)
    c.R(10, 5, 5, 4, 'dark', 3); c.HL(10, 5, 5, 'dark', 5); c.R(11, 6, 2, 1, 'blue', 4); _ol(c, 10, 4, 5, 6)
    c.R(2, 9, 7, 3, 'white', 2); c.HL(2, 9, 7, 'white', 2); c.HL(2, 12, 7, 'grey', 3)
    for k in range(3):
        yy = 15 + k * 5
        panel(c, 2, yy, 12, 4, 'grey', 2); c.HL(6, yy + 2, 4, 'dark', 3)


def server_rack(c):
    """서버 랙 둘: 깊은 금속 윗면 9행(케이블 덕트·통풍판) + 앞문 속 장비."""
    for k in range(2):
        x = k * 16
        top3(c, x, 0, 16, 9, 22, 'grey', tt=3, ft=0)
        c.R(x + 2, 2, 12, 4, 'dark', 2); c.HL(x + 2, 2, 12, 'dark', 4)
        for i in range(3, 13, 2): c.P(x + i, 4, 'dark', 0)
        c.R(x + 2, 10, 12, 19, 'dark', 1)
        for r in range(6):
            yy = 11 + r * 3
            c.HL(x + 2, yy, 12, 'dark', 3); c.HL(x + 2, yy + 1, 12, 'dark', 2)
            for i in range(3):
                if h32(r, i + k * 7, 41) % 3: c.P(x + 3 + i * 2, yy + 1, ('leaf', 'amber', 'blue')[h32(r, i, 42) % 3], 4)
        _ol(c, x, 0, 16, 31)


def gondola(c):
    """진열대(양면): 깊은 윗면 11행(가운데 칸막이 + 양쪽 위에 놓인 상품 상자) + 앞 세 칸(뒷벽·판 윗면)."""
    top3(c, 0, 1, 32, 11, 19, 'grey', tt=5, ft=2)
    c.HL(1, 6, 30, 'grey', 3)
    for i, xx in enumerate(range(2, 29, 5)):
        _stand(c, xx, 2 + (i % 2), 4, 3, ('red', 'amber', 'blue', 'leaf', 'plum', 'teal')[i % 6])
        _stand(c, xx + 1, 7 + ((i + 1) % 2), 4, 3, ('teal', 'white', 'red', 'amber', 'blue', 'leaf')[i % 6])
    for r in range(3):
        _shelf_bay(c, 2, 13 + r * 6, 28, 6, s=r + 7)
    c.HL(0, 31, 32, 'ink', 0)


def cooler(c):
    """음료 냉장고: 깊은 윗면 9행 위 상자 둘 + 어두운 틀 유리문 둘 — 칸마다 판 윗면·병 뚜껑."""
    top3(c, 0, 0, 32, 9, 22, 'grey', tt=5, ft=1)
    _stand(c, 3, 2, 9, 5, 'wood', 5); _stand(c, 19, 3, 7, 4, 'beige', 5)
    for k in range(2):
        x = 2 + k * 15
        c.R(x, 10, 13, 19, 'teal', 1)
        for r in range(3):
            yy = 10 + r * 6
            for i in range(6):
                m = ('red', 'amber', 'leaf', 'blue', 'teal', 'plum')[h32(i, r + k * 4, 44) % 6]
                n = NT[MI[m]]
                c.VL(x + 1 + i * 2, yy + 2, 2, m, n - 2); c.P(x + 1 + i * 2, yy + 1, m, n - 1)
            c.HL(x, yy + 4, 13, 'white', 2); c.HL(x, yy + 5, 13, 'grey', 4)
        c.VL(x + (11 if k == 0 else 1), 14, 8, 'grey', 6)
        _ol(c, x - 1, 9, 15, 21)


def magazine_rack(c):
    """잡지 진열대: 깊은 윗면 10행에 눕힌 잡지(겹친 판) + 앞 두 칸(뒷벽·경사 표지)."""
    top3(c, 0, 6, 32, 10, 14, 'grey', tt=5, ft=2)
    for k, m in enumerate(('blue', 'red', 'amber', 'leaf')):
        x = 2 + k * 7
        n = NT[MI[m]]
        c.R(x, 8 + (k % 2), 6, 5, m, n - 2); c.HL(x, 8 + (k % 2), 6, m, n - 1); c.HL(x, 13 + (k % 2), 6, m, max(0, n - 4))
        c.R(x + 1, 10 + (k % 2), 3, 1, 'white', 2)
    for r in range(2):
        yy = 17 + r * 6
        c.R(1, yy, 30, 5, 'dark', 1)
        for k in range(5):
            m = ('red', 'blue', 'amber', 'leaf', 'plum')[(k + r * 2) % 5]
            c.R(2 + k * 6, yy + 1, 5, 3, m, NT[MI[m]] - 3); c.HL(2 + k * 6, yy + 1, 5, m, NT[MI[m]] - 1)
        c.HL(1, yy + 4, 30, 'grey', 5)


def atm(c):
    """ATM: 깊은 윗면 9행(뒤 어둡게) 위 작은 카메라 상자 + 차양 + 기운 조작부."""
    top3(c, 0, 1, 16, 9, 21, 'grey', tt=5, ft=2)
    _stand(c, 9, 2, 4, 3, 'dark', 4)
    c.R(1, 10, 14, 2, 'leaf', 3); c.HL(1, 10, 14, 'leaf', 5)
    c.R(2, 12, 12, 6, 'dark', 1); c.R(3, 13, 10, 4, 'blue', 4); c.HL(3, 13, 10, 'navy', 6)
    c.R(2, 19, 12, 5, 'grey', 4); c.HL(2, 19, 12, 'grey', 6)
    for j in range(2):
        for i in range(4): c.P(3 + i * 2, 20 + j * 2, 'dark', 2)
    c.R(4, 26, 8, 1, 'dark', 1)


def basket_stack(c):
    """장바구니 더미: 위에서 들여다보는 큰 아가리(테 2px · 안쪽 바닥 9행이 아래로 어두워짐) + 손잡이 + 겹친 테."""
    c.R(0, 5, 16, 13, 'red', 6)
    for j in range(9):
        c.HL(2, 7 + j, 12, 'red', 3 - j // 3)
    for j in range(8, 16, 2):
        for i in range(3, 13, 3): c.P(i, j, 'red', 0)
    c.HL(2, 7, 12, 'red', 0); c.VL(2, 7, 9, 'red', 0)
    c.HL(3, 2, 3, 'dark', 3); c.HL(10, 2, 3, 'dark', 3); c.VL(3, 3, 3, 'dark', 3); c.VL(12, 3, 3, 'dark', 3)
    for k in range(2): c.HL(0, 18 + k * 2, 16, 'red', 4 - k); c.HL(0, 19 + k * 2, 16, 'red', 1)
    _ol(c, 0, 4, 16, 19)


def pastry_case(c):
    """진열 냉장 케이스: 기운 유리 윗면 12행(뒤 어둡게 → 앞 밝게) 속 접시 셋 위 케이크 + 앞 모서리 금속 테 + 나무 장."""
    for j in range(12):
        c.HL(1, 3 + j, 30, 'teal', 2 if j < 4 else 3 if j < 9 else 4)
    for k, (m, t) in enumerate((('white', 2), ('brick', 4), ('amber', 4))):
        x = 4 + k * 9
        c.ell(x + 3.5, 11, 4.5, 2, lambda X, Y, dx, dy, d: ('white', 1))
        c.R(x + 1, 6, 5, 3, m, t); c.R(x + 1, 9, 5, 2, m, max(0, t - 2)); c.P(x + 3, 6, 'red', 5); _ol(c, x, 5, 7, 7)
    for i in range(2, 28, 7): c.line(2 + i, 3, 6 + i, 14, 'white', 2)
    c.HL(0, 15, 32, 'grey', 6); c.HL(0, 16, 32, 'grey', 3)
    c.R(0, 17, 32, 12, 'wood', 1)
    for k in range(2): panel(c, 2 + k * 15, 18, 13, 9, 'wood', 2)
    _ol(c, 0, 2, 32, 28)


def _gate_body(c, x, y, w, mat='grey', pad='teal'):
    top3(c, x, y, w, 11, 11, mat, tt=5, ft=2)
    _stand(c, x + 2, y + 2, w - 4, 4, pad, 4); c.P(x + w - 3, y + 8, 'leaf', 5)


def security_gate(c):
    """보안 게이트: 몸통 둘(깊은 윗면 11행 위 판독기 상자) + 사이 유리 날개 두 장(위에서 보이는 두께 3행)."""
    _gate_body(c, 0, 5, 11)
    _gate_body(c, 21, 5, 11)
    for xx in (11, 17):
        c.R(xx, 10, 4, 3, 'teal', 4); c.HL(xx, 10, 4, 'white', 1); c.R(xx, 13, 4, 6, 'teal', 2); _ol(c, xx, 9, 4, 11)


def ticket_gate(c):
    """개찰구: 몸통 둘(깊은 윗면 11행 · 표 투입 패드 상자) + 붉은 날개(윗면 3행)."""
    _gate_body(c, 0, 3, 12)
    _gate_body(c, 20, 3, 12)
    for xx in (12, 16):
        c.R(xx, 10, 4, 3, 'red', 6); c.R(xx, 13, 4, 5, 'red', 2); _ol(c, xx, 9, 4, 10)


def ticket_machine(c):
    """발권기 둘: 깊은 윗면 9행 위 안내 상자 + 앞쪽 기운 화면·투입구."""
    for k in range(2):
        x = k * 16
        top3(c, x, 0, 16, 9, 22, 'navy', tt=5, ft=2)
        _stand(c, x + 3, 2, 10, 4, 'amber', 3)
        c.R(x + 2, 11, 12, 7, 'dark', 1); c.R(x + 3, 12, 10, 5, 'blue', 4); c.HL(x + 3, 12, 10, 'navy', 6)
        for i in range(3): c.R(x + 4 + i * 3, 14, 2, 2, ('amber', 'leaf', 'red')[i], 4)
        c.R(x + 3, 20, 4, 1, 'dark', 1); c.R(x + 10, 20, 3, 2, 'dark', 1); c.R(x + 4, 25, 8, 2, 'dark', 1)


def rack(c):
    """창고 선반: 맨 윗판 깊은 윗면 9행 위 상자 셋(윗면·앞면) + 두 칸(뒷벽 어둡게 · 판 윗면 2행 · 선 상자) + 기둥."""
    top3(c, 0, 0, 48, 9, 22, 'blue', tt=3, ft=1)
    for k in range(3): _stand(c, 4 + k * 15, 2, 10, 5, 'wood', 5); c.HL(5 + k * 15, 3, 8, 'amber', 3)
    for r in range(2):
        yy = 9 + r * 11
        c.R(1, yy, 46, 11, 'dark', 0)
        for k in range(4):
            bx = 3 + k * 11; bw = 9 - (k % 2)
            _stand(c, bx, yy + 2 + (k + r) % 2, bw, 7 - (k + r) % 2, 'wood', 5)
        c.HL(1, yy + 9, 46, 'blue', 4); c.HL(1, yy + 10, 46, 'blue', 2)
    for x in (0, 23, 45):
        c.R(x, 0, 3, 31, 'brick', 4); c.VL(x + 2, 0, 31, 'brick', 2)
    _ol(c, 0, 0, 48, 32)


def partition(c):
    """칸막이: 두꺼운 판 — 위 갓 윗면 6행(뒤 어둡게·앞 밝게, 위에 둔 작은 화분·서류) + 천 판 + 받침 발 윗면."""
    top3(c, 0, 6, 32, 6, 14, 'grey', tt=5, ft=2)
    _stand(c, 4, 7, 4, 3, 'leaf', 5); c.R(20, 8, 7, 2, 'white', 2)
    for y in range(13, 25):
        for x in range(1, 31): c.P(x, y, 'slate', 3 if rnd(x, y // 2, 40) > 0.25 else 2)
    c.VL(16, 13, 12, 'grey', 3); _ol(c, 0, 12, 32, 14)
    for x in (2, 25):
        c.R(x, 25, 5, 3, 'grey', 5); c.R(x, 28, 5, 1, 'grey', 2); _ol(c, x - 1, 24, 7, 6)


def hosp_curtain(c):
    """병상 접이 병풍: 판마다 위 테 윗면 3행이 지그재그(뒤 판 높게·앞 판 낮게) + 천 + 판 발."""
    xs = (0, 8, 16, 24, 32)
    for k in range(4):
        x0, x1 = xs[k], xs[k + 1]
        back = k % 2 == 0
        top = 5 if back else 9
        for x in range(x0, x1):
            for y in range(top + 3, top + 19):
                c.P(x, y, 'sage', (4, 3)[(x // 2) % 2] if back else (5, 4)[(x // 2) % 2])
            c.P(x, top, 'grey', 4); c.P(x, top + 1, 'grey', 5); c.P(x, top + 2, 'grey', 6)
        c.R(x0, top + 19, x1 - x0, 1, 'grey', 2)
    c.outline()
    for x in (1, 15, 30): c.R(x - 1, 29, 2, 2, 'dark', 1)


def iv_stand(c):
    """링거 걸대: 굵은 기둥 위 넓은 둥근 걸이판(윗면 타원 4행 · 고리 넷) + 수액 팩 + 큰 원형 받침(바퀴)."""
    c.ell(8, 26, 7, 4, lambda x, y, dx, dy, d: ('grey', 6 if dy < -0.2 else 5) if d < 0.65 else ('grey', 2))
    c.ell(8, 26, 7, 4, lambda x, y, dx, dy, d: ('ink', 1) if d > 0.85 else None)
    for (x, y) in ((2, 27), (14, 27), (8, 30), (4, 23), (12, 23)): c.R(x - 1, y, 2, 2, 'dark', 1)
    c.R(7, 6, 3, 20, 'grey', 4); c.VL(7, 6, 20, 'grey', 6); c.VL(9, 6, 20, 'grey', 2)
    c.ell(8, 5, 6, 3, lambda x, y, dx, dy, d: ('grey', 6 if dy < 0 else 5) if d < 0.6 else ('grey', 3))
    c.ell(8, 5, 6, 3, lambda x, y, dx, dy, d: ('ink', 1) if d > 0.8 else None)
    for x in (3, 13): c.P(x, 5, 'dark', 2)
    c.R(11, 8, 4, 8, 'white', 2); c.R(12, 11, 2, 4, 'blue', 4); _ol(c, 10, 7, 6, 10)


def stanchion(c):
    """줄 세우기 기둥: 굵은 기둥(6px) 위 둥근 머리 윗면 타원 5행 + 붉은 띠 + 넓은 원판 받침 윗면."""
    c.ell(7, 26, 6.5, 3.5, lambda x, y, dx, dy, d: ('grey', 6 if dy < 0 else 4) if d < 0.7 else ('grey', 2))
    c.ell(7, 26, 6.5, 3.5, lambda x, y, dx, dy, d: ('ink', 1) if d > 0.88 else None)
    c.R(4, 9, 6, 17, 'grey', 4); c.VL(4, 9, 17, 'grey', 6); c.VL(9, 9, 17, 'grey', 2); c.VL(3, 9, 17, 'ink', 1); c.VL(10, 9, 17, 'ink', 1)
    c.ell(7, 8, 4.5, 3, lambda x, y, dx, dy, d: ('grey', 6) if dy < 0.1 else ('grey', 5))
    c.ell(7, 8, 4.5, 3, lambda x, y, dx, dy, d: ('ink', 1) if d > 0.8 else None)
    for x in range(11, 16):
        y = 13 + int(round(2 * math.sin((x - 11) / 5 * math.pi)))
        c.P(x, y, 'red', 5); c.P(x, y + 1, 'red', 2)


def drums(c):
    """드럼통 둘: 몸통 위 큰 뚜껑 타원(회색 테 · 안쪽 색 판 · 마개) 7행 + 둥근 몸통 명암 · 테 두 줄."""
    for (cx, m) in ((5, 'blue'), (11, 'red')):
        n = NT[MI[m]]
        for x in range(cx - 4, cx + 4):
            t = n - 3 if x < cx - 1 else n - 4 if x < cx + 2 else 1
            c.VL(x, 13, 14, m, t)
        c.HL(cx - 4, 18, 8, m, 0); c.HL(cx - 4, 23, 8, m, 0)
    for (cx, m) in ((5, 'blue'), (11, 'red')):
        n = NT[MI[m]]
        c.ell(cx, 12, 4.4, 3.6, lambda x, y, dx, dy, d: ('grey', 6 if dy < 0 else 4) if d > 0.5 else (m, n - 1 if dy < 0.2 else n - 2))
        c.P(cx + 1, 11, 'dark', 2); c.P(cx + 2, 11, 'grey', 6)
    c.outline()


def chair_office_n(c):
    """사무용 의자 북향: 넓은 앉는 판 윗면(9행이 등받이 위로 보임) + 남쪽 아주 낮은 등받이(윗면 3행) + 바퀴."""
    _office_base(c)
    m = 'navy'
    _seat(c, 1, 6, 14, 12, 2, m, 4, 1)
    c.HL(2, 7, 12, m, 5)
    c.R(3, 15, 10, 3, m, 6); c.R(3, 18, 10, 4, m, 2); c.VL(8, 18, 4, m, 1)
    _ol(c, 2, 14, 12, 9)


def chair_wood_n(c):
    """나무 의자 북향: 앉는 판 윗면 10행(결) + 남쪽 낮은 등받이 가로대(윗면 2행) + 다리."""
    m = 'wood'
    _seat(c, 2, 6, 12, 10, 2, m, 4, 2, legs_at=(3, 12), leg_h=10, leg_mat=(m, 1))
    for i in range(3, 13, 3): c.VL(i, 8, 6, m, 3)
    c.R(2, 14, 12, 2, m, 5); c.R(2, 16, 12, 2, m, 2); _ol(c, 1, 13, 14, 6)
    for x in (3, 12): c.R(x, 19, 1, 3, m, 3)


def cafe_chair_w(c):
    """카페 의자 서향 — 동향 그림을 좌우로 뒤집었다."""
    t = C(16, 32); cafe_chair(t, 'e'); c.paste(t.flipx(), 0, 0)


def g_register(c):
    """계산 단말: 돈통 상자 깊은 윗면 7행(앞 테 밝게) 위에 선 화면 상자 + 카드기."""
    top3(c, 0, 5, 16, 7, 4, 'grey', tt=5, ft=2)
    _stand(c, 2, 1, 7, 7, 'dark', 4); c.R(3, 4, 5, 3, 'blue', 4)
    _stand(c, 11, 6, 3, 4, 'dark', 5); c.P(12, 8, 'leaf', 5)


def g_espresso(c):
    """에스프레소 머신: 깊은 윗면 7행(뒤 어둡게) 위 데우는 컵 둘 + 앞면 추출구·받침 컵."""
    top3(c, 1, 1, 14, 7, 7, 'grey', tt=5, ft=2)
    _stand(c, 3, 2, 3, 3, 'white', 2); _stand(c, 9, 3, 3, 3, 'white', 2)
    c.R(5, 9, 6, 2, 'dark', 2); c.R(6, 12, 4, 2, 'white', 2); c.HL(6, 12, 4, 'brick', 1)


def g_cake(c):
    """케이크 접시: 위에서 본 넓은 접시 타원 + 둥근 케이크 하나(윗면 타원 5행 · 딸기 · 옆면 크림 2행)."""
    c.ell(8, 9, 7.5, 5, lambda x, y, dx, dy, d: ('white', 2 if d > 0.6 else 1) if d < 0.9 else ('grey', 4))
    c.R(3, 8, 10, 3, 'brick', 3); c.HL(3, 10, 10, 'brick', 1)
    c.ell(8, 7, 5, 2.6, lambda x, y, dx, dy, d: ('white', 2) if d < 0.7 else ('white', 1))
    for x in (5, 8, 11): c.P(x, 7, 'red', 5)


def gondola_v(c):
    """세로 진열대(1×2): 남북으로 긴 깊은 윗면(뒤 어둡게·앞 테 밝게) 양쪽 줄에 선 상품 상자 + 남쪽 끝 두 칸(뒷벽·판)."""
    top3(c, 0, 2, 16, 34, 11, 'grey', tt=5, ft=2)
    c.VL(7, 3, 32, 'grey', 3); c.VL(8, 3, 32, 'grey', 6)
    for j, yy in enumerate(range(4, 31, 5)):
        _stand(c, 2, yy, 4, 4, ('red', 'amber', 'blue', 'leaf', 'plum', 'teal')[j % 6])
        _stand(c, 10, yy + 2, 4, 4, ('teal', 'white', 'red', 'amber', 'blue', 'leaf')[j % 6])
    _shelf_bay(c, 2, 37, 12, 4, s=13); _shelf_bay(c, 2, 41, 12, 4, s=14)


# ═══════════════ 3차(관문 3회차 불합격 20점) ═══════════════
# 통과한 이웃 칩셋(캠퍼스 자판기·배식대·사물함)과 대조한 차이: 그쪽 윗면은 «중간 밝기 + 가는 가로 결(두 행마다 한 단)» 이고
# 윗면 위 물건은 «테두리 안에 박힌 쟁반·상자»(안쪽 그늘 1px)다. 우리 윗면은 거의 흰색 띠라 «앞 간판»으로 읽혔다.

def ribtop(c, x, y, w, top, front, mat, tt, ft):
    """결 있는 윗면(뒤 1행 어둡게 · 두 행마다 한 단 · 앞 모서리 밝은 테) + 앞면 + ink 테."""
    n = NT[MI[mat]]
    for j in range(top):
        t = tt - 1 if j == 0 else (tt if j % 2 else tt - 1)
        if j == top - 1: t = min(n - 1, tt + 1)
        c.HL(x, y + j, w, mat, max(0, t))
    c.R(x, y + top, w, front, mat, ft); c.HL(x, y + top, w, mat, max(0, ft - 1))
    if front > 3: c.VL(x + 1, y + top + 1, front - 2, mat, min(n - 1, ft + 1))
    _ol(c, x, y, w, top + front)
    return y + top


def inset(c, x, y, w, h, mat, t):
    """윗면에 박힌 쟁반·물건: 안쪽 그늘(위·왼 1px ink) + 속."""
    c.R(x, y, w, h, mat, t); c.HL(x, y, w, 'ink', 1); c.VL(x, y, h, 'ink', 1)
    c.HL(x + 1, y + h - 1, w - 1, mat, min(NT[MI[mat]] - 1, t + 1))


def copier(c):
    top = ribtop(c, 0, 2, 16, 11, 17, 'grey', 3, 1)
    inset(c, 2, 4, 8, 5, 'grey', 5); inset(c, 11, 4, 4, 3, 'blue', 3); inset(c, 2, 10, 7, 2, 'white', 2)
    for k in range(3):
        yy = top + 1 + k * 5
        panel(c, 2, yy, 12, 4, 'grey', 2); c.HL(6, yy + 2, 4, 'dark', 2)


def server_rack(c):
    for k in range(2):
        x = k * 16
        top = ribtop(c, x, 0, 16, 9, 22, 'slate', 3, 0)
        inset(c, x + 3, 2, 10, 4, 'dark', 2); c.P(x + 4, 4, 'leaf', 5)
        for r in range(6):
            yy = top + 1 + r * 3
            c.HL(x + 2, yy, 12, 'dark', 3); c.HL(x + 2, yy + 1, 12, 'dark', 1)
            for i in range(3):
                if h32(r, i + k * 7, 41) % 3: c.P(x + 3 + i * 2, yy + 1, ('leaf', 'amber', 'blue')[h32(r, i, 42) % 3], 4)


def gondola_v(c):
    ribtop(c, 0, 2, 16, 34, 11, 'grey', 3, 1)
    for j, yy in enumerate(range(4, 33, 5)):
        inset(c, 2, yy, 5, 4, ('red', 'amber', 'blue', 'leaf', 'plum', 'teal')[j % 6], 3)
        inset(c, 9, yy + 2, 5, 4, ('teal', 'white', 'red', 'amber', 'blue', 'leaf')[j % 6], 2 if j % 6 == 1 else 3)
    _shelf_bay(c, 2, 37, 12, 4, s=13); _shelf_bay(c, 2, 41, 12, 4, s=14)


def cooler(c):
    top = ribtop(c, 0, 0, 32, 9, 22, 'slate', 3, 1)
    inset(c, 3, 2, 10, 5, 'wood', 3); inset(c, 18, 3, 9, 4, 'beige', 3)
    for k in range(2):
        x = 2 + k * 15
        c.R(x, top + 1, 13, 19, 'teal', 1)
        for r in range(3):
            yy = top + 1 + r * 6
            for i in range(6):
                m = ('red', 'amber', 'leaf', 'blue', 'teal', 'plum')[h32(i, r + k * 4, 44) % 6]
                n = NT[MI[m]]
                c.VL(x + 1 + i * 2, yy + 2, 2, m, n - 2); c.P(x + 1 + i * 2, yy + 1, m, n - 1)
            c.HL(x, yy + 4, 13, 'white', 1); c.HL(x, yy + 5, 13, 'grey', 3)
        c.VL(x + (11 if k == 0 else 1), top + 5, 8, 'grey', 5)
        _ol(c, x - 1, top, 15, 21)


def magazine_rack(c):
    top = ribtop(c, 0, 6, 32, 10, 14, 'grey', 3, 1)
    for k, m in enumerate(('blue', 'red', 'amber', 'leaf')):
        inset(c, 2 + k * 7, 8 + (k % 2), 6, 5, m, NT[MI[m]] - 2); c.R(3 + k * 7, 10 + (k % 2), 3, 1, 'white', 2)
    for r in range(2):
        yy = top + 1 + r * 6
        c.R(1, yy, 30, 5, 'dark', 1)
        for k in range(5):
            m = ('red', 'blue', 'amber', 'leaf', 'plum')[(k + r * 2) % 5]
            c.R(2 + k * 6, yy + 1, 5, 3, m, NT[MI[m]] - 3); c.HL(2 + k * 6, yy + 1, 5, m, NT[MI[m]] - 1)


def atm(c):
    top = ribtop(c, 0, 1, 16, 9, 21, 'grey', 3, 1)
    inset(c, 3, 3, 10, 5, 'leaf', 3)
    c.R(2, top + 1, 12, 6, 'dark', 1); c.R(3, top + 2, 10, 4, 'blue', 4)
    c.R(2, top + 8, 12, 5, 'grey', 3)
    for j in range(2):
        for i in range(4): c.P(3 + i * 2, top + 9 + j * 2, 'dark', 2)
    c.R(4, top + 15, 8, 1, 'dark', 1)


def pastry_case(c):
    top = ribtop(c, 0, 2, 32, 13, 14, 'wood', 3, 1)
    inset(c, 2, 4, 28, 9, 'teal', 3)
    for k, (m, t) in enumerate((('white', 2), ('brick', 4), ('amber', 4))):
        x = 4 + k * 9
        c.R(x + 1, 6, 5, 3, m, t); c.R(x + 1, 9, 5, 2, m, max(0, t - 2)); c.P(x + 3, 6, 'red', 5); _ol(c, x, 5, 7, 7)
    for k in range(2): panel(c, 2 + k * 15, top + 2, 13, 9, 'wood', 2)


def _gate_body(c, x, y, w, mat='grey', pad='teal'):
    ribtop(c, x, y, w, 11, 11, mat, 3, 1)
    inset(c, x + 2, y + 2, w - 4, 5, pad, 3); c.P(x + w - 3, y + 8, 'leaf', 5)


def security_gate(c):
    _gate_body(c, 0, 5, 11); _gate_body(c, 21, 5, 11)
    for xx in (11, 17):
        c.R(xx, 10, 4, 3, 'teal', 4); c.R(xx, 13, 4, 6, 'teal', 2); _ol(c, xx, 9, 4, 11)


def ticket_gate(c):
    _gate_body(c, 0, 3, 12, 'grey', 'blue'); _gate_body(c, 20, 3, 12, 'grey', 'blue')
    for xx in (12, 16):
        c.R(xx, 10, 4, 3, 'red', 5); c.R(xx, 13, 4, 5, 'red', 2); _ol(c, xx, 9, 4, 10)


def ticket_machine(c):
    for k in range(2):
        x = k * 16
        top = ribtop(c, x, 0, 16, 9, 22, 'navy', 3, 1)
        inset(c, x + 3, 2, 10, 5, 'blue', 3)
        c.R(x + 2, top + 2, 12, 7, 'dark', 1); c.R(x + 3, top + 3, 10, 5, 'blue', 4)
        for i in range(3): c.R(x + 4 + i * 3, top + 5, 2, 2, ('amber', 'leaf', 'red')[i], 4)
        c.R(x + 3, top + 11, 4, 1, 'dark', 1); c.R(x + 10, top + 11, 3, 2, 'dark', 1); c.R(x + 4, top + 16, 8, 2, 'dark', 1)


def rack(c):
    ribtop(c, 0, 0, 48, 9, 22, 'wood', 3, 1)
    for k in range(3): inset(c, 4 + k * 15, 2, 10, 5, 'amber', 2)
    for r in range(2):
        yy = 10 + r * 11
        c.R(1, yy, 46, 10, 'dark', 0)
        for k in range(4):
            bx = 3 + k * 11; bw = 9 - (k % 2)
            _stand(c, bx, yy + 2 + (k + r) % 2, bw, 7 - (k + r) % 2, 'wood', 5)
        c.HL(1, yy + 9, 46, 'blue', 4)
    for x in (0, 23, 45):
        c.R(x, 9, 3, 22, 'brick', 4); c.VL(x + 2, 9, 22, 'brick', 2)
    _ol(c, 0, 0, 48, 32)


def partition(c):
    top = ribtop(c, 0, 6, 32, 7, 13, 'grey', 3, 1)
    inset(c, 3, 8, 6, 3, 'leaf', 4); inset(c, 19, 8, 8, 3, 'white', 2)
    for y in range(top, top + 12):
        for x in range(1, 31): c.P(x, y, 'slate', 3 if rnd(x, y // 2, 40) > 0.25 else 2)
    c.VL(16, top, 12, 'grey', 3); _ol(c, 0, top, 32, 13)
    for x in (2, 25):
        ribtop(c, x, 25, 5, 3, 2, 'grey', 4, 2)


def stanchion(c):
    """줄 세우기 기둥: 넓은 원판(결 있는 윗면 타원) + 굵은 기둥 + 둥근 머리(윗면 타원) + 붉은 띠."""
    c.ell(7, 26, 6.5, 3.5, lambda x, y, dx, dy, d: ('grey', 3 if int(y) % 2 else 4) if d < 0.7 else ('grey', 1))
    c.ell(7, 26, 6.5, 3.5, lambda x, y, dx, dy, d: ('ink', 1) if d > 0.88 else None)
    c.R(4, 9, 6, 17, 'grey', 3); c.VL(4, 9, 17, 'grey', 5); c.VL(9, 9, 17, 'grey', 1); c.VL(3, 9, 17, 'ink', 1); c.VL(10, 9, 17, 'ink', 1)
    c.ell(7, 8, 4.5, 3, lambda x, y, dx, dy, d: ('grey', 3 if int(y) % 2 else 4) if d < 0.7 else ('grey', 5))
    c.ell(7, 8, 4.5, 3, lambda x, y, dx, dy, d: ('ink', 1) if d > 0.8 else None)
    for x in range(11, 16):
        y = 13 + int(round(2 * math.sin((x - 11) / 5 * math.pi)))
        c.P(x, y, 'red', 5); c.P(x, y + 1, 'red', 2)


def hosp_curtain(c):
    """병상 칸막이: 낮은 바퀴 받침대 위 천 판 셋 — 받침대 윗면(결)이 넓게 보이고 판 위 테도 윗면 3행."""
    ribtop(c, 0, 20, 32, 6, 4, 'grey', 3, 1)
    for k in range(3):
        x = 1 + k * 10
        c.R(x, 4, 10, 3, 'grey', 4); c.HL(x, 4, 10, 'grey', 3); c.HL(x, 6, 10, 'grey', 5)
        for xx in range(x, x + 10):
            for y in range(7, 21): c.P(xx, y, 'sage', (5, 4)[(xx // 2) % 2])
        _ol(c, x, 3, 10, 18)
    for x in (2, 15, 28): c.R(x - 1, 30, 2, 2, 'dark', 1)


def drums(c):
    """드럼통 둘: 뚜껑 타원 위 결(두 행마다 한 단)·마개 + 몸통."""
    for (cx, m) in ((5, 'blue'), (11, 'red')):
        n = NT[MI[m]]
        for x in range(cx - 4, cx + 4):
            t = n - 3 if x < cx - 1 else n - 4 if x < cx + 2 else 1
            c.VL(x, 13, 14, m, t)
        c.HL(cx - 4, 18, 8, m, 0); c.HL(cx - 4, 23, 8, m, 0)
    for (cx, m) in ((5, 'blue'), (11, 'red')):
        n = NT[MI[m]]
        c.ell(cx, 12, 4.4, 3.8, lambda x, y, dx, dy, d: ('grey', 4) if d > 0.55 else (m, n - 2 if int(y) % 2 else n - 1))
        c.R(cx + 1, 11, 2, 1, 'dark', 2)
    c.outline()


def g_espresso(c):
    top = ribtop(c, 1, 1, 14, 7, 7, 'grey', 3, 1)
    inset(c, 3, 2, 4, 4, 'white', 2); inset(c, 9, 3, 4, 3, 'white', 2)
    c.R(5, top + 1, 6, 2, 'dark', 2); c.R(6, top + 4, 4, 2, 'white', 2)


def g_cake(c):
    """케이크 쟁반: 결 있는 나무 쟁반 윗면 + 박힌 케이크 두 조각(위에서)."""
    top = ribtop(c, 1, 3, 14, 9, 2, 'wood', 3, 1)
    inset(c, 3, 5, 5, 5, 'white', 2); c.HL(4, 6, 4, 'red', 5)
    inset(c, 9, 5, 5, 5, 'brick', 3); c.HL(10, 6, 4, 'wood', 5)


def chair_office_n(c):
    """사무용 의자 북향: 위에서 본 큰 앉는 판(결 · 팔걸이) + 남쪽 가장자리 얇은 등받이 윗면 + 바퀴."""
    _office_base(c)
    ribtop(c, 2, 7, 12, 12, 2, 'navy', 3, 1)
    c.R(0, 10, 2, 8, 'dark', 3); c.R(14, 10, 2, 8, 'dark', 2); _ol(c, 0, 9, 2, 10); _ol(c, 14, 9, 2, 10)
    c.R(3, 17, 10, 2, 'navy', 6); c.R(3, 19, 10, 4, 'navy', 2); _ol(c, 2, 16, 12, 8)


def chair_wood_n(c):
    """나무 의자 북향: 결 있는 앉는 판 윗면 12행 + 남쪽 얇은 등받이 가로대 + 다리."""
    ribtop(c, 2, 5, 12, 12, 2, 'wood', 3, 1)
    c.R(2, 15, 12, 2, 'wood', 5); c.R(2, 17, 12, 2, 'wood', 2); _ol(c, 1, 14, 14, 6)
    for x in (3, 12): c.VL(x, 20, 9, 'wood', 1); c.P(x, 28, 'ink', 0)


def cafe_chair_w(c):
    """카페 의자 서향: 결 있는 앉는 판 윗면 9행 + 동쪽 등받이(윗면 띠) + 쇠 다리."""
    ribtop(c, 3, 13, 10, 9, 2, 'wood', 3, 1)
    for lx in (4, 11): c.VL(lx, 25, 5, 'dark', 3); c.P(lx, 29, 'ink', 0)
    bx = 12
    c.R(bx, 5, 3, 18, 'dark', 2); c.VL(bx + 1, 5, 17, 'dark', 4); c.R(bx, 5, 3, 2, 'dark', 5)
    _ol(c, bx - 1, 4, 5, 20)


# ═══════════════ 4차(마지막 — 이번에도 떨어지면 뺀다) ═══════════════
# 판정자: 「row 1 이 곧 세로 간판 상자」. 통과한 냉장고·옷장·책상은 윗면 위 물건이 몸체 윤곽 «위로 솟는다».
# 그래서 몸체를 3~4px 내리고, 윗면 뒤 모서리는 양끝 1px 씩 줄여(원근) 위에 선 물건이 윤곽 밖으로 솟게 그린다.

def body(c, x, y, w, top, front, mat, tt, ft):
    """원근 윗면(뒤 두 행은 양끝 1px 안쪽) + 결 + 앞면."""
    r = ribtop(c, x, y, w, top, front, mat, tt, ft)
    for j in range(2):
        c.P(x + j, y + j, None); c.P(x + w - 1 - j, y + j, None)
    c.P(x + 1, y + 1, 'ink', 1); c.P(x + w - 2, y + 1, 'ink', 1); c.P(x + 2, y, 'ink', 1); c.P(x + w - 3, y, 'ink', 1)
    c.P(x, y + 2, 'ink', 1); c.P(x + w - 1, y + 2, 'ink', 1)
    return r


def _riser(c, x, y, w, h, mat, tt=None):
    """윗면 위에 서서 몸체 윤곽 위로 솟는 상자(윗면 2행 + 앞면) + 발밑 그늘."""
    n = NT[MI[mat]]
    tt = n - 1 if tt is None else tt
    c.R(x, y, w, 2, mat, tt); c.R(x, y + 2, w, h - 2, mat, max(0, tt - 3))
    _ol(c, x, y - 1, w, h + 1)
    c.HL(x + 1, y + h, w, 'ink', 2)


def copier(c):
    top = body(c, 0, 5, 16, 9, 17, 'grey', 3, 1)
    _riser(c, 2, 2, 9, 5, 'grey', 5)                      # 원고 자동 급지 덮개(솟음)
    inset(c, 11, 7, 4, 3, 'blue', 3); inset(c, 2, 10, 7, 2, 'white', 2)
    for k in range(3):
        yy = top + 1 + k * 5
        panel(c, 2, yy, 12, 4, 'grey', 2); c.HL(6, yy + 2, 4, 'dark', 2)


def server_rack(c):
    for k in range(2):
        x = k * 16
        top = body(c, x, 4, 16, 8, 20, 'slate', 3, 0)
        _riser(c, x + 3, 1, 9, 5, 'dark', 4); c.P(x + 4, 3, 'leaf', 5)
        for r in range(6):
            yy = top + 1 + r * 3
            c.HL(x + 2, yy, 12, 'dark', 3); c.HL(x + 2, yy + 1, 12, 'dark', 1)
            for i in range(3):
                if h32(r, i + k * 7, 41) % 3: c.P(x + 3 + i * 2, yy + 1, ('leaf', 'amber', 'blue')[h32(r, i, 42) % 3], 4)


def gondola_v(c):
    body(c, 0, 6, 16, 30, 10, 'grey', 3, 1)
    for j, yy in enumerate(range(4, 31, 5)):
        _riser(c, 2, yy, 5, 6, ('red', 'amber', 'blue', 'leaf', 'plum', 'teal')[j % 6])
        _riser(c, 9, yy + 2, 5, 6, ('teal', 'white', 'red', 'amber', 'blue', 'leaf')[j % 6])
    _shelf_bay(c, 2, 37, 12, 4, s=13); _shelf_bay(c, 2, 41, 12, 4, s=14)


def cooler(c):
    top = body(c, 0, 4, 32, 8, 20, 'slate', 3, 1)
    _riser(c, 3, 1, 10, 7, 'wood', 5); _riser(c, 18, 3, 8, 5, 'beige', 5)
    for k in range(2):
        x = 2 + k * 15
        c.R(x, top + 1, 13, 17, 'teal', 1)
        for r in range(3):
            yy = top + 1 + r * 6
            if yy + 5 > top + 18: break
            for i in range(6):
                m = ('red', 'amber', 'leaf', 'blue', 'teal', 'plum')[h32(i, r + k * 4, 44) % 6]
                n = NT[MI[m]]
                c.VL(x + 1 + i * 2, yy + 2, 2, m, n - 2); c.P(x + 1 + i * 2, yy + 1, m, n - 1)
            c.HL(x, yy + 4, 13, 'white', 1); c.HL(x, yy + 5, 13, 'grey', 3)
        c.VL(x + (11 if k == 0 else 1), top + 5, 8, 'grey', 5)
        _ol(c, x - 1, top, 15, 19)


def magazine_rack(c):
    top = body(c, 0, 9, 32, 8, 13, 'grey', 3, 1)
    for k, m in enumerate(('blue', 'red', 'amber', 'leaf', 'plum')):
        _riser(c, 1 + k * 6, 4 + (k % 2), 5, 7, m)        # 뒤 줄에 세운 잡지(솟음)
    for r in range(2):
        yy = top + 1 + r * 6
        c.R(1, yy, 30, 5, 'dark', 1)
        for k in range(5):
            m = ('red', 'blue', 'amber', 'leaf', 'plum')[(k + r * 2) % 5]
            c.R(2 + k * 6, yy + 1, 5, 3, m, NT[MI[m]] - 3); c.HL(2 + k * 6, yy + 1, 5, m, NT[MI[m]] - 1)


def atm(c):
    top = body(c, 0, 5, 16, 8, 18, 'grey', 3, 1)
    _riser(c, 3, 1, 10, 6, 'leaf', 4)                       # 위 안내 상자(솟음)
    c.R(2, top + 1, 12, 6, 'dark', 1); c.R(3, top + 2, 10, 4, 'blue', 4)
    c.R(2, top + 8, 12, 5, 'grey', 3)
    for j in range(2):
        for i in range(4): c.P(3 + i * 2, top + 9 + j * 2, 'dark', 2)
    c.R(4, top + 14, 8, 1, 'dark', 1)


def pastry_case(c):
    top = body(c, 0, 6, 32, 10, 13, 'wood', 3, 1)
    inset(c, 2, 8, 28, 6, 'teal', 3)
    for k, m in enumerate(('white', 'brick', 'amber')):
        x = 4 + k * 9
        _riser(c, x, 3 + (k % 2), 7, 7, m, 2 if m == 'white' else None); c.P(x + 3, 3 + (k % 2), 'red', 5)
    for k in range(2): panel(c, 2 + k * 15, top + 2, 13, 8, 'wood', 2)


def ticket_machine(c):
    for k in range(2):
        x = k * 16
        top = body(c, x, 5, 16, 8, 19, 'navy', 3, 1)
        _riser(c, x + 3, 1, 10, 6, 'blue', 4)
        c.R(x + 2, top + 1, 12, 7, 'dark', 1); c.R(x + 3, top + 2, 10, 5, 'blue', 4)
        for i in range(3): c.R(x + 4 + i * 3, top + 4, 2, 2, ('amber', 'leaf', 'red')[i], 4)
        c.R(x + 3, top + 10, 4, 1, 'dark', 1); c.R(x + 10, top + 10, 3, 2, 'dark', 1); c.R(x + 4, top + 15, 8, 2, 'dark', 1)


def rack(c):
    body(c, 0, 5, 48, 7, 20, 'wood', 3, 1)
    for k in range(3): _riser(c, 4 + k * 15, 1 + (k % 2), 10, 7, 'wood', 5); c.HL(5 + k * 15, 2 + (k % 2), 8, 'amber', 3)
    for r in range(2):
        yy = 13 + r * 9
        c.R(1, yy, 46, 8, 'dark', 0)
        for k in range(4):
            bx = 3 + k * 11; bw = 9 - (k % 2)
            _stand(c, bx, yy + 2, bw, 5, 'wood', 5)
        c.HL(1, yy + 7, 46, 'blue', 4)
    for x in (0, 23, 45):
        c.R(x, 12, 3, 19, 'brick', 4); c.VL(x + 2, 12, 19, 'brick', 2)
    _ol(c, 0, 12, 48, 20)
