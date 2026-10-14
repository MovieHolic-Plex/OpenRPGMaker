"""modern_city 실내 — 가구·설비 그림(코드 손 도트, Opus 2026-10-14).
캔버스 = 폭 w*16, 높이 (U+h)*16 (U = ceil(up/16)). 아래 h 줄이 발밑, 위 U 줄은 솟은 부분.
3/4: 윗면 5행 이상(밝게, 뒤 가장자리 ink, 앞 모서리 반사) + 남쪽 앞면(두 단 어둡게) + ink 접지선. 빛 왼쪽 위. 글자·상표·사람 없음."""
import math
from mpx import C, rnd, h32, slab, panel, glass, screen, plant, knob, legs, NT, MI


def ol_rect(c, x, y, w, h, t=1):
    c.HL(x, y, w, 'ink', t); c.HL(x, y + h - 1, w, 'ink', 0); c.VL(x, y, h, 'ink', t); c.VL(x + w - 1, y, h, 'ink', t)


def goods_row(c, x, y, w, h, s=0, mats=('red', 'amber', 'leaf', 'blue', 'navy', 'white', 'plum', 'teal')):
    """선반 위 포장 상품 줄: 1~3px 폭 상자, 높이 변주, 윗면 1px 밝게."""
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


def tops_grid(c, x, y, w, h, s=0, mats=('red', 'amber', 'leaf', 'blue', 'white', 'teal', 'plum')):
    """위에서 본 상품 윗면 격자(2×2 덩이)."""
    for j in range(0, h, 2):
        for i in range(0, w, 2):
            m = mats[h32(i + x, j + y, s) % len(mats)]
            n = NT[MI[m]]
            c.R(x + i, y + j, 2, 2, m, n - 2); c.P(x + i, y + j, m, n - 1)
            if h32(i, j, s + 1) % 5 == 0: c.R(x + i, y + j, 2, 2, 'dark', 3)


# ═══════════════ 사무실 ═══════════════
def office_chair(c, facing='s', ox=0, oy=0, mat='navy'):
    """사무용 의자(16×32 캔버스 아래 22행). facing s = 등받이 북쪽·앉는 판 보임, n = 등받이 남쪽이 앞을 가림."""
    x, y = ox, oy
    # 다리(별 모양) + 바퀴
    c.HL(x + 3, y + 28, 10, 'dark', 3); c.P(x + 2, y + 29, 'ink', 1); c.P(x + 13, y + 29, 'ink', 1); c.P(x + 7, y + 29, 'ink', 1)
    c.VL(x + 7, y + 24, 4, 'dark', 4); c.VL(x + 8, y + 24, 4, 'dark', 2)
    if facing == 's':
        # 등받이(뒤) — 윗면 2행 밝게
        c.R(x + 3, y + 9, 10, 9, mat, 2); c.HL(x + 3, y + 9, 10, mat, 4); c.HL(x + 3, y + 10, 10, mat, 3)
        c.VL(x + 3, y + 10, 8, mat, 3); c.VL(x + 12, y + 10, 8, mat, 1)
        ol_rect(c, x + 2, y + 8, 12, 11)
        # 앉는 판(윗면 5행)
        c.R(x + 2, y + 18, 12, 5, mat, 4); c.HL(x + 2, y + 18, 12, mat, 3); c.HL(x + 3, y + 19, 10, mat, 5)
        c.HL(x + 2, y + 23, 12, mat, 1)
        c.VL(x + 1, y + 18, 6, 'ink', 1); c.VL(x + 14, y + 18, 6, 'ink', 1); c.HL(x + 2, y + 24, 12, 'ink', 0)
        c.R(x + 1, y + 16, 2, 4, 'dark', 3); c.R(x + 13, y + 16, 2, 4, 'dark', 2)       # 팔걸이
    else:
        # 앉는 판 가장자리(양옆으로 삐져나옴) + 둥근 등받이가 앞을 가림(뒷면: 윗테 밝게, 가운데 오목)
        c.R(x + 1, y + 17, 14, 4, mat, 3); c.HL(x + 1, y + 17, 14, mat, 4); c.VL(x, y + 17, 4, 'ink', 1); c.VL(x + 15, y + 17, 4, 'ink', 1)
        c.HL(x + 1, y + 21, 14, 'ink', 0)
        c.R(x + 3, y + 8, 10, 14, mat, 2)
        c.HL(x + 4, y + 8, 8, mat, 5); c.HL(x + 3, y + 9, 10, mat, 4); c.HL(x + 3, y + 10, 10, mat, 3)
        c.VL(x + 3, y + 10, 11, mat, 3); c.VL(x + 12, y + 10, 11, mat, 1)
        c.R(x + 6, y + 13, 4, 5, mat, 1); c.HL(x + 6, y + 13, 4, mat, 0)
        c.HL(x + 4, y + 7, 8, 'ink', 1); c.P(x + 3, y + 8, 'ink', 1); c.P(x + 12, y + 8, 'ink', 1)
        c.VL(x + 2, y + 9, 13, 'ink', 1); c.VL(x + 13, y + 9, 13, 'ink', 1); c.HL(x + 3, y + 22, 10, 'ink', 0)


def chair_office_s(c): office_chair(c, 's')
def chair_office_n(c): office_chair(c, 'n')


def desk_pc(c):
    """사무 책상(2칸, 화면이 남쪽을 봄): 밝은 회색 상판 + 모니터 둘(켜진 화면) + 자판 + 서류·컵 + 앞판."""
    slab(c, 0, 14, 32, 9, 8, 'grey', tt=5, ft=3)
    c.R(2, 23, 28, 5, 'grey', 2); c.HL(2, 23, 28, 'grey', 1)           # 무릎 공간 그늘
    for mx in (3, 17):
        c.R(mx, 4, 12, 9, 'dark', 1); screen(c, mx + 1, 5, 10, 7, True); ol_rect(c, mx, 3, 12, 10)
        c.R(mx + 5, 13, 2, 2, 'dark', 3); c.R(mx + 3, 15, 6, 1, 'dark', 2)
    c.R(6, 17, 10, 3, 'dark', 3); c.HL(6, 17, 10, 'dark', 5)
    for k in range(4): c.P(7 + k * 2, 18, 'grey', 4)
    c.R(18, 18, 2, 2, 'dark', 4)
    c.R(23, 16, 6, 4, 'white', 2); c.HL(23, 19, 6, 'grey', 3); c.HL(24, 17, 4, 'grey', 4)
    c.R(1, 17, 3, 3, 'red', 4); c.P(1, 17, 'red', 6)


def desk_pc_back(c):
    """사무 책상(2칸, 화면이 북쪽 — 모니터 뒷면이 보임): 상판 + 모니터 뒤판 둘 + 서류철 + 앞판(서랍)."""
    slab(c, 0, 14, 32, 9, 8, 'grey', tt=5, ft=3)
    for mx in (3, 17):
        c.R(mx, 5, 12, 8, 'dark', 3); c.HL(mx, 5, 12, 'dark', 5); c.R(mx + 4, 8, 4, 3, 'dark', 2)
        ol_rect(c, mx, 4, 12, 10)
        c.R(mx + 5, 14, 2, 2, 'dark', 3)
    c.R(2, 18, 6, 3, 'blue', 3); c.HL(2, 18, 6, 'blue', 4)
    c.R(25, 17, 5, 4, 'white', 2); c.HL(25, 20, 5, 'grey', 3)
    panel(c, 20, 24, 10, 5, 'grey', 3); knob(c, 24, 26)
    panel(c, 2, 24, 10, 5, 'grey', 3); knob(c, 6, 26)


def partition(c):
    """칸막이(2칸): 알루미늄 윗 레일(윗면 3행) + 청회 천 판(결) + 아래 받침."""
    c.R(0, 9, 32, 3, 'grey', 6); c.HL(0, 9, 32, 'ink', 1); c.HL(0, 11, 32, 'grey', 4)
    for y in range(12, 28):
        for x in range(1, 31):
            c.P(x, y, 'slate', 3 if rnd(x, y // 2, 40) > 0.25 else 2)
    c.VL(1, 12, 16, 'slate', 4); c.VL(30, 12, 16, 'slate', 1)
    c.HL(0, 28, 32, 'grey', 3); c.HL(0, 29, 32, 'grey', 1); c.HL(0, 30, 32, 'ink', 0)
    c.VL(0, 9, 22, 'ink', 1); c.VL(31, 9, 22, 'ink', 1); c.VL(16, 12, 16, 'grey', 4)


def copier(c):
    """복합기(1칸): 넓은 윗면(덮개·조작판 화면) + 옆 배출 받침 + 앞면 용지함 셋."""
    slab(c, 0, 4, 16, 9, 18, 'grey', tt=5, ft=3)
    c.R(2, 6, 9, 5, 'grey', 4); c.HL(2, 6, 9, 'grey', 6)                     # 원고 덮개
    c.R(11, 6, 4, 3, 'dark', 2); c.R(12, 7, 2, 1, 'blue', 4); c.P(12, 9, 'leaf', 5)   # 조작판
    c.R(1, 11, 8, 2, 'white', 2)                                              # 나온 종이
    for k in range(3):
        y = 15 + k * 5
        panel(c, 2, y, 12, 4, 'grey', 3); c.HL(6, y + 2, 4, 'dark', 3)
    c.HL(0, 31, 16, 'ink', 0)


def server_rack(c):
    """서버 랙 둘(2칸, 벽 가구): 환기 구멍 윗면 + 철망 앞문 속 장비 줄 + 초록·노랑 불빛."""
    for k in range(2):
        x = k * 16
        slab(c, x, 0, 16, 6, 25, 'dark', tt=4, ft=2)
        for i in range(2, 14, 2): c.P(x + i, 3, 'dark', 1)
        for r in range(7):
            y = 8 + r * 3
            c.HL(x + 2, y, 12, 'dark', 1); c.HL(x + 2, y + 1, 12, 'dark', 3)
            for i in range(3):
                if h32(r, i + k * 7, 41) % 3: c.P(x + 3 + i * 2, y + 1, ('leaf', 'amber', 'blue')[h32(r, i, 42) % 3], 4)
        c.VL(x + 13, 9, 18, 'grey', 3)


def filing(c):
    """낮은 서류 캐비닛(2칸, 벽 가구): 윗면에 화분·서류 더미 + 서랍 두 단."""
    slab(c, 0, 10, 32, 7, 15, 'grey', tt=4, ft=2)
    for r in range(2):
        for k in range(2):
            panel(c, 2 + k * 15, 18 + r * 6, 13, 5, 'grey', 3); knob(c, 7 + k * 15, 20 + r * 6, 3)
    plant(c, 2, 2)
    c.R(19, 9, 9, 4, 'white', 2); c.HL(19, 9, 9, 'white', 1); c.HL(19, 12, 9, 'grey', 3); c.R(20, 7, 7, 2, 'blue', 3)


def coffee_station(c):
    """탕비 카운터(2칸, 벽 가구): 상판 위 커피 머신·컵·정수기 + 아래 문짝 둘."""
    slab(c, 0, 14, 32, 7, 11, 'beige', tt=4, ft=2)
    for k in range(2): panel(c, 2 + k * 14, 22, 13, 7, 'beige', 3); c.VL(13 + k * 2, 24, 3, 'grey', 5) if k == 0 else c.VL(17, 24, 3, 'grey', 5)
    # 커피 머신
    c.R(3, 4, 9, 13, 'dark', 3); c.HL(3, 4, 9, 'dark', 5); c.R(4, 9, 7, 4, 'dark', 1); c.R(6, 11, 3, 2, 'white', 2)
    c.P(10, 6, 'red', 5); ol_rect(c, 2, 3, 11, 15)
    # 정수기(통)
    c.ell(24, 5, 4, 3, lambda x, y, dx, dy, d: ('blue', 4 if dy < 0 else 3))
    c.R(20, 6, 8, 11, 'grey', 5); c.VL(20, 6, 11, 'grey', 6); c.VL(27, 6, 11, 'grey', 3); c.R(22, 10, 4, 2, 'dark', 2)
    c.P(22, 9, 'red', 4); c.P(25, 9, 'blue', 4); ol_rect(c, 19, 5, 10, 13)
    c.R(14, 16, 3, 3, 'white', 1); c.P(14, 16, 'white', 2)


def reception(c):
    """접수 카운터(3칸): 높은 앞판(나무 + 가로 금속 띠) 뒤로 상판, 위에 모니터 뒤판·작은 화분·종."""
    slab(c, 0, 8, 48, 7, 16, 'white', tt=1, ft=0)
    for y in range(16, 30):
        for x in range(1, 47): c.P(x, y, 'wood', 3 if (x // 12 + (y > 22)) % 2 == 0 else 2)
    c.HL(1, 21, 46, 'grey', 5); c.HL(1, 22, 46, 'grey', 2)
    c.VL(1, 15, 15, 'wood', 4); c.VL(46, 15, 15, 'wood', 1)
    c.HL(0, 30, 48, 'ink', 0)
    c.R(27, 0, 12, 9, 'dark', 3); c.HL(27, 0, 12, 'dark', 5); ol_rect(c, 26, -1, 14, 11)
    plant(c, 4, 1)
    c.ell(18, 11, 2, 1.5, lambda x, y, dx, dy, d: ('amber', 4 if dy < 0 else 1)); c.P(18, 9, 'amber', 2)


def plant_tall(c):
    """키 큰 화분(1칸, 고무나무): 잎 덩이 셋(빛 왼위) + 줄기 + 원통 화분(흙 보이는 아가리)."""
    for (cx, cy, r) in ((6, 7, 5), (10, 11, 5), (6, 15, 4.5)):
        c.ell(cx, cy, r, r * 0.8, lambda x, y, dx, dy, d: ('leaf', 5 if dx + dy < -0.6 else 4 if d < 0.4 else 3 if d < 0.8 else 2))
    for k in range(9):
        c.P(3 + h32(k, 1, 43) % 10, 4 + h32(k, 2, 43) % 14, 'leaf', 1)
    c.VL(8, 17, 5, 'wood', 1)
    c.ell(8, 22, 5.5, 2.2, lambda x, y, dx, dy, d: ('grey', 6) if d > 0.55 else ('wood', 0))
    c.R(3, 22, 11, 8, 'grey', 4); c.VL(3, 22, 8, 'grey', 5); c.VL(13, 22, 8, 'grey', 2); c.HL(3, 29, 11, 'grey', 2)
    c.VL(2, 22, 8, 'ink', 1); c.VL(14, 22, 8, 'ink', 1); c.HL(3, 30, 11, 'ink', 0)


def shelf_office(c):
    """서가(2칸, 벽 가구): 윗면 + 세 단 칸에 색 서류철 줄 + 걸쇠."""
    slab(c, 0, 0, 32, 6, 25, 'wood', tt=3, ft=1)
    c.R(4, 1, 6, 3, 'white', 1)
    for r in range(3):
        y = 7 + r * 8
        c.R(2, y, 28, 7, 'wood', 0)
        goods_row(c, 3, y + 1, 26, 6, s=r, mats=('blue', 'navy', 'red', 'white', 'amber', 'teal', 'grey'))
        c.HL(1, y + 7, 30, 'wood', 3)


# ═══════════════ 편의점 ═══════════════
def gondola(c):
    """진열대(2칸, 양면): 맨 윗판에 상품 윗면 + 앞 세 단 상품 줄(가격 띠는 흰 줄) + 받침."""
    c.R(0, 6, 32, 6, 'grey', 5); c.HL(0, 6, 32, 'ink', 1)
    tops_grid(c, 2, 7, 28, 4, s=3)
    c.HL(0, 11, 32, 'grey', 6)
    c.R(0, 12, 32, 18, 'grey', 2)
    for r in range(3):
        y = 13 + r * 6
        c.R(2, y, 28, 5, 'dark', 2)
        goods_row(c, 2, y, 28, 5, s=r + 7)
        c.HL(1, y + 5, 30, 'white', 1)
    c.VL(0, 6, 25, 'ink', 1); c.VL(31, 6, 25, 'ink', 1); c.VL(1, 12, 18, 'grey', 4); c.VL(30, 12, 18, 'grey', 1)
    c.HL(0, 30, 32, 'grey', 1); c.HL(0, 31, 32, 'ink', 0)


def gondola_v(c):
    """세로 진열대(1×2, 남북으로 긴 섬): 긴 윗면 양쪽에 상품 윗면 줄 + 남쪽 끝 면(상품 단)."""
    c.R(1, 8, 14, 30, 'grey', 5); c.HL(1, 8, 14, 'ink', 1)
    tops_grid(c, 2, 9, 5, 28, s=11); tops_grid(c, 9, 9, 5, 28, s=12)
    c.VL(7, 9, 29, 'grey', 6); c.VL(8, 9, 29, 'grey', 3)
    c.R(1, 38, 14, 8, 'grey', 2)
    goods_row(c, 2, 39, 12, 3, s=13); c.HL(2, 42, 12, 'white', 1); goods_row(c, 2, 43, 12, 2, s=14)
    c.VL(0, 8, 39, 'ink', 1); c.VL(15, 8, 39, 'ink', 1); c.HL(1, 46, 14, 'ink', 0)


def cooler(c):
    """음료 냉장고(2칸, 벽 가구): 어두운 윗면 + 유리문 둘 속 밝은 칸에 병 줄 + 은색 손잡이."""
    slab(c, 0, 0, 32, 5, 26, 'grey', tt=3, ft=4)
    for k in range(2):
        x = 2 + k * 15
        c.R(x, 6, 13, 23, 'white', 2)
        for r in range(4):
            y = 7 + r * 5
            for i in range(6):
                m = ('red', 'amber', 'leaf', 'blue', 'teal', 'plum')[h32(i, r + k * 4, 44) % 6]
                n = NT[MI[m]]
                c.VL(x + 1 + i * 2, y + 1, 3, m, n - 2); c.P(x + 1 + i * 2, y, 'grey', 5)
            c.HL(x, y + 4, 13, 'grey', 4)
        for j in range(23):
            if (j + k * 3) % 9 in (0, 1): c.P(x + 2 + j // 3, 6 + j, 'white', 2)
        c.VL(x + (11 if k == 0 else 1), 12, 8, 'grey', 6)
        ol_rect(c, x - 1, 5, 15, 25)


def freezer(c):
    """아이스크림 냉동고(2칸): 낮은 흰 몸통, 미닫이 유리 뚜껑 너머 위에서 보이는 상품 상자(아가리 6행) + 앞판."""
    c.R(0, 8, 32, 13, 'grey', 6); c.HL(0, 8, 32, 'ink', 1)
    c.R(2, 10, 28, 9, 'dark', 2)
    tops_grid(c, 3, 11, 26, 7, s=21, mats=('blue', 'white', 'amber', 'red', 'plum', 'teal'))
    for j in range(9):
        for i in range(28):
            if (i + j) % 10 == 0: c.P(2 + i, 10 + j, 'white', 2)
    c.VL(16, 9, 11, 'grey', 4); c.HL(2, 10, 28, 'grey', 3)
    c.R(0, 21, 32, 9, 'grey', 4); c.HL(0, 21, 32, 'grey', 3); c.HL(2, 24, 28, 'blue', 4); c.HL(2, 25, 28, 'blue', 2)
    c.VL(0, 8, 23, 'ink', 1); c.VL(31, 8, 23, 'ink', 1); c.HL(0, 30, 32, 'ink', 0)


def counter_register(c):
    """계산대(3칸): 회색 상판(윗면 8행) 위 계산기·핫스낵 유리장·컵 + 흰 앞판에 빨강 띠."""
    slab(c, 0, 10, 48, 8, 13, 'grey', tt=5, ft=6)
    c.R(1, 18, 46, 12, 'white', 2); c.HL(1, 18, 46, 'grey', 4)
    c.R(1, 22, 46, 2, 'red', 5); c.HL(1, 24, 46, 'red', 2)
    c.HL(0, 30, 48, 'ink', 0); c.VL(0, 10, 21, 'ink', 1); c.VL(47, 10, 21, 'ink', 1)
    # 계산기
    c.R(4, 6, 10, 7, 'dark', 3); c.HL(4, 6, 10, 'dark', 5); c.R(5, 7, 5, 3, 'blue', 4); c.R(10, 8, 3, 3, 'dark', 1)
    ol_rect(c, 3, 5, 12, 9)
    c.R(5, 14, 8, 2, 'dark', 2)
    # 핫스낵 유리장
    c.R(26, 3, 16, 12, 'grey', 4); glass(c, 27, 4, 14, 6, 'teal', 4)
    for i in range(4): c.R(28 + i * 3, 9, 2, 2, 'amber', 2 + i % 2)
    c.HL(26, 11, 16, 'grey', 6); c.R(27, 12, 14, 2, 'red', 4)
    ol_rect(c, 25, 2, 18, 13)
    c.R(18, 12, 3, 3, 'white', 1); c.P(18, 12, 'white', 2)


def magazine_rack(c):
    """잡지 진열대(2칸, 벽 가구): 낮은 경사 선반 두 단에 색 표지(글자 없음) + 윗면."""
    slab(c, 0, 12, 32, 5, 14, 'grey', tt=4, ft=2)
    for r in range(2):
        y = 18 + r * 6
        for k in range(5):
            m = ('red', 'blue', 'amber', 'leaf', 'plum')[(k + r * 2) % 5]
            c.R(2 + k * 6, y, 5, 5, m, NT[MI[m]] - 2); c.HL(2 + k * 6, y, 5, m, NT[MI[m]] - 1)
            c.R(3 + k * 6, y + 2, 3, 1, 'white', 2)
        c.HL(1, y + 5, 30, 'grey', 5)
    c.R(3, 10, 8, 4, 'blue', 3); c.R(14, 10, 7, 4, 'red', 4)


def atm(c):
    """ATM(1칸, 벽 가구): 윗면 + 차양 + 켜진 화면 + 숫자판 격자 + 카드·지폐 구멍."""
    slab(c, 0, 4, 16, 6, 21, 'grey', tt=4, ft=3)
    c.R(1, 10, 14, 3, 'dark', 3); c.HL(1, 10, 14, 'dark', 5)
    c.R(3, 13, 10, 6, 'dark', 1); c.R(4, 14, 8, 4, 'blue', 4); c.HL(4, 14, 8, 'navy', 6)
    for j in range(3):
        for i in range(3): c.P(4 + i * 2, 21 + j * 2, 'grey', 6)
    c.R(11, 21, 2, 1, 'dark', 1); c.R(10, 25, 4, 1, 'dark', 1)
    c.R(2, 6, 12, 2, 'leaf', 4)


def basket_stack(c):
    """장바구니 더미(1칸): 빨강 바구니 위에서 보이는 아가리(바닥 격자) + 손잡이 + 겹친 테."""
    c.R(2, 6, 12, 9, 'red', 4); c.HL(2, 6, 12, 'red', 6)
    c.R(4, 8, 8, 6, 'red', 1)
    for j in range(8, 14, 2):
        for i in range(4, 12, 2): c.P(i, j, 'red', 0)
    c.VL(2, 6, 9, 'red', 5); c.VL(13, 6, 9, 'red', 2)
    c.HL(3, 4, 4, 'dark', 3); c.HL(9, 4, 4, 'dark', 3); c.P(3, 5, 'dark', 3); c.P(12, 5, 'dark', 3)
    for k in range(3): c.HL(2, 15 + k * 2, 12, 'red', 5 - k); c.HL(2, 16 + k * 2, 12, 'red', 2)
    ol_rect(c, 1, 5, 14, 17)


# ═══════════════ 집 ═══════════════
def bed_double(c, w=2):
    """침대(폭 w, 머리 북쪽): 나무 머리판 + 흰 베개 + 청록 이불(접힌 끝) + 나무 발판."""
    W = w * 16
    c.R(0, 2, W, 9, 'wood', 2); c.HL(0, 2, W, 'wood', 4); c.HL(0, 3, W, 'wood', 3); c.VL(1, 3, 8, 'wood', 3)
    ol_rect(c, 0, 1, W, 11)
    c.R(1, 11, W - 2, 34, 'white', 1)
    for k in range(w):
        c.R(3 + k * 15, 12, 11 if w > 1 else 10, 6, 'white', 2); c.HL(3 + k * 15, 17, 11 if w > 1 else 10, 'white', 0); c.HL(3 + k * 15, 12, 11 if w > 1 else 10, 'white', 2)
    c.R(1, 20, W - 2, 3, 'white', 2); c.HL(1, 22, W - 2, 'white', 0)
    for y in range(23, 44):
        for x in range(1, W - 1):
            t = 3 if (x // 4 + y // 4) % 2 else 4
            if x in (1, W - 2): t = 2
            c.P(x, y, 'teal', t)
    c.HL(1, 23, W - 2, 'teal', 4)
    c.R(0, 44, W, 3, 'wood', 2); c.HL(0, 44, W, 'wood', 3)
    c.VL(0, 11, 36, 'ink', 1); c.VL(W - 1, 11, 36, 'ink', 1); c.HL(0, 47, W, 'ink', 0)


def bed_single(c): bed_double(c, 1)


def sofa(c, w=3, mat='navy'):
    """소파(폭 w, 남향): 등받이(윗면 3행) + 쿠션 w 개(윗면) + 팔걸이 + 앞면 + 짧은 다리."""
    W = w * 16
    c.R(2, 6, W - 4, 10, mat, 3); c.HL(2, 6, W - 4, mat, 5); c.HL(2, 7, W - 4, mat, 4); c.HL(2, 8, W - 4, mat, 4)
    for k in range(1, w): c.VL(k * 16, 9, 7, mat, 2)
    c.R(0, 9, 4, 18, mat, 4); c.HL(0, 9, 4, mat, 6); c.R(W - 4, 9, 4, 18, mat, 2); c.HL(W - 4, 9, 4, mat, 4)
    for k in range(w):
        x = 4 + k * ((W - 8) // w)
        cw = (W - 8) // w
        c.R(x, 16, cw, 6, mat, 5); c.HL(x, 16, cw, mat, 6); c.VL(x + cw - 1, 16, 6, mat, 3)
    c.R(0, 22, W, 5, mat, 2); c.HL(0, 22, W, mat, 1)
    ol_rect(c, 0, 5, W, 23)
    for x in (2, W - 3): c.R(x, 28, 1, 2, 'wood', 1)


def sofa3(c): sofa(c, 3)


def armchair(c): sofa(c, 1, 'rose')


def coffee_table(c):
    """낮은 거실 탁자(2칸, 솟음 없음): 나무 윗면 + 아래 선반 + 잡지·컵."""
    slab(c, 1, 2, 30, 7, 4, 'wood', tt=4, ft=2, grain='wood')
    c.R(3, 13, 26, 1, 'wood', 1); c.VL(2, 13, 2, 'wood', 2); c.VL(29, 13, 2, 'wood', 1); c.HL(1, 15, 30, 'ink', 0)
    c.R(5, 3, 7, 4, 'red', 4); c.HL(5, 3, 7, 'red', 6); c.R(19, 4, 3, 3, 'white', 1); c.P(19, 4, 'white', 2)


def tv_stand(c):
    """TV 장(2칸, 벽 가구): 낮은 장(윗면·문짝 둘) 위에 평면 TV(꺼진 화면 반사) + 작은 화분."""
    slab(c, 0, 19, 32, 5, 8, 'wood', tt=2, ft=1)
    panel(c, 2, 25, 13, 4, 'wood', 1); panel(c, 17, 25, 13, 4, 'wood', 1)
    c.R(4, 2, 24, 15, 'dark', 1); c.HL(4, 2, 24, 'dark', 3)
    for y in range(4, 15):
        for x in range(6, 26): c.P(x, y, 'dark', 4 if (x + y) % 12 in (0, 1) else 2)
    ol_rect(c, 3, 1, 26, 17); c.R(14, 18, 4, 2, 'dark', 3)
    c.R(27, 15, 4, 4, 'brick', 3); c.P(28, 13, 'leaf', 4); c.P(29, 12, 'leaf', 5); c.P(30, 14, 'leaf', 3)


def kitchen(c):
    """부엌 조리대(3칸, 벽 가구): 위 찬장(문짝) + 상판(개수대 아가리·수도·인덕션 화구 둘·도마) + 아래 문짝·서랍."""
    # 위 찬장(벽면 앞)
    c.R(0, 0, 48, 9, 'white', 1); c.HL(0, 0, 48, 'ink', 1)
    for k in range(3): panel(c, 1 + k * 16, 1, 14, 7, 'white', 1); c.P(13 + k * 16, 6, 'grey', 3)
    c.HL(0, 9, 48, 'ink', 0)
    c.R(32, 9, 16, 3, 'grey', 4); c.HL(32, 11, 16, 'grey', 2)          # 후드
    # 상판
    slab(c, 0, 13, 48, 7, 11, 'grey', tt=5, ft=6)
    c.R(1, 20, 46, 10, 'white', 1); c.HL(1, 20, 46, 'grey', 4)
    for k in range(3): panel(c, 2 + k * 15, 22, 14, 7, 'white', 1); c.HL(7 + k * 15, 23, 4, 'grey', 3)
    c.HL(0, 30, 48, 'ink', 0); c.VL(0, 13, 18, 'ink', 1); c.VL(47, 13, 18, 'ink', 1)
    # 개수대
    c.R(4, 15, 11, 4, 'grey', 2); c.HL(4, 15, 11, 'grey', 1); c.R(5, 16, 9, 2, 'grey', 3); c.P(9, 17, 'dark', 2)
    c.R(8, 12, 2, 4, 'grey', 6); c.P(9, 15, 'grey', 3)
    # 도마·채소
    c.R(18, 15, 8, 4, 'wood', 4); c.HL(18, 18, 8, 'wood', 2); c.R(20, 16, 3, 2, 'leaf', 4)
    # 화구
    c.R(31, 14, 15, 6, 'dark', 2)
    for bx in (35, 42):
        c.ell(bx, 17, 2.6, 1.8, lambda x, y, dx, dy, d: ('dark', 4) if d > 0.5 else ('red', 2))
    c.R(39, 13, 3, 1, 'dark', 4)


def fridge(c):
    """냉장고(1칸, 벽 가구): 윗면에 상자 하나 + 위 냉동실·아래 냉장실 문 + 세로 손잡이."""
    slab(c, 0, 1, 16, 5, 25, 'grey', tt=5, ft=4)
    c.R(4, 0, 7, 3, 'amber', 3); c.HL(4, 0, 7, 'amber', 4); c.HL(4, 3, 7, 'amber', 1)
    c.HL(1, 13, 14, 'grey', 2); c.HL(1, 14, 14, 'grey', 6)
    c.VL(12, 8, 4, 'grey', 2); c.VL(12, 16, 9, 'grey', 2); c.VL(11, 16, 9, 'grey', 6)
    c.R(3, 18, 4, 3, 'red', 4); c.P(4, 19, 'amber', 4)


def wardrobe(c):
    """옷장(2칸, 벽 가구): 윗면 + 나무 문짝 넷(세로 결) + 손잡이 + 아래 서랍."""
    slab(c, 0, 0, 32, 5, 26, 'wood', tt=3, ft=2, grain='wood')
    c.R(6, 1, 9, 3, 'beige', 4); c.HL(6, 3, 9, 'beige', 1)
    for k in range(2):
        panel(c, 2 + k * 14, 6, 14, 17, 'wood', 2)
        for y in range(8, 22, 3): c.HL(4 + k * 14, y, 10, 'wood', 1 + (y % 2))
    c.VL(15, 10, 6, 'amber', 4); c.VL(17, 10, 6, 'amber', 4)
    panel(c, 2, 24, 28, 5, 'wood', 2); c.HL(13, 26, 6, 'amber', 3)


def chair_wood(c, facing='s'):
    """나무 의자(1칸). s = 등받이 북쪽, n = 등받이가 남쪽 앞."""
    if facing == 's':
        c.R(3, 9, 10, 2, 'wood', 4); c.HL(3, 9, 10, 'wood', 5); c.VL(3, 11, 7, 'wood', 2); c.VL(12, 11, 7, 'wood', 1)
        c.HL(3, 14, 10, 'wood', 3)
        ol_rect(c, 2, 8, 12, 4)
        c.R(2, 18, 12, 5, 'wood', 4); c.HL(2, 18, 12, 'wood', 3); c.HL(3, 19, 10, 'wood', 5); c.HL(2, 22, 12, 'wood', 2)
        c.VL(1, 18, 5, 'ink', 1); c.VL(14, 18, 5, 'ink', 1)
        legs(c, (3, 12), 23, 6, 'wood', 1)
    else:
        c.R(2, 13, 12, 4, 'wood', 4); c.HL(2, 13, 12, 'ink', 1); c.HL(3, 14, 10, 'wood', 5)
        c.VL(1, 13, 5, 'ink', 1); c.VL(14, 13, 5, 'ink', 1)
        c.R(3, 16, 10, 2, 'wood', 4); c.HL(3, 16, 10, 'wood', 5)
        c.VL(3, 18, 6, 'wood', 3); c.VL(12, 18, 6, 'wood', 2); c.HL(3, 21, 10, 'wood', 3)
        ol_rect(c, 2, 15, 12, 4)
        legs(c, (3, 12), 24, 5, 'wood', 1)


def chair_wood_s(c): chair_wood(c, 's')
def chair_wood_n(c): chair_wood(c, 'n')


def rug(c):
    """거실 깔개(3×2, 밟음): 짙은 남색 테두리 + 크림 바탕 + 기하 무늬."""
    W, H = c.w, c.h
    for y in range(2, H - 2):
        for x in range(1, W - 1):
            edge = x < 4 or x > W - 5 or y < 5 or y > H - 6
            t = ('navy', 3) if edge else ('cream', 3 if (x + y) % 2 else 2)
            if not edge and ((x - 8) % 12 in (0, 1) or (y - 8) % 10 in (0,)): t = ('rose', 4)
            c.P(x, y, *t)
    c.HL(1, 2, W - 2, 'navy', 5); c.HL(1, H - 3, W - 2, 'navy', 1)


def toilet(c):
    """양변기(1칸, 벽 가구): 벽에 붙은 물탱크(윗면) + 위에서 보이는 변기 아가리(물·테)."""
    slab(c, 2, 4, 12, 4, 5, 'white', tt=2, ft=1)
    c.R(6, 5, 4, 1, 'grey', 4)
    c.ell(8, 20, 5.5, 6, lambda x, y, dx, dy, d: ('white', 2) if d > 0.45 else ('blue', 4 if dy < 0 else 3))
    c.ell(8, 20, 5.5, 6, lambda x, y, dx, dy, d: ('ink', 1) if d > 0.85 else None)
    c.R(4, 13, 8, 2, 'white', 1)
    c.HL(5, 26, 6, 'white', 0); c.HL(5, 27, 6, 'ink', 0)


def washbasin(c):
    """세면대(1칸, 벽 가구): 벽 거울 + 흰 대야(위에서 보이는 아가리) + 수도꼭지 + 아래 장."""
    c.R(2, 0, 12, 9, 'grey', 4); glass(c, 3, 1, 10, 7, 'teal', 3); ol_rect(c, 2, 0, 12, 9)
    slab(c, 0, 12, 16, 7, 12, 'white', tt=2, ft=1)
    c.ell(8, 15.5, 5, 2.4, lambda x, y, dx, dy, d: ('grey', 4 if dy < 0 else 5) if d < 0.75 else None)
    c.R(7, 11, 2, 3, 'grey', 6); c.P(8, 14, 'grey', 3)
    panel(c, 2, 20, 12, 8, 'wood', 3); c.P(8, 24, 'grey', 6)


# ═══════════════ 카페·식당 ═══════════════
def cafe_table(c):
    """카페 원탁(1칸): 위에서 보이는 둥근 대리석 상판(테·빛) + 가운데 받침대 + 원형 다리받침."""
    c.ell(8, 16, 7, 4.5, lambda x, y, dx, dy, d: ('white', 2 if dx + dy < -0.2 else 1) if d < 0.72 else ('grey', 3))
    c.ell(8, 16, 7, 4.5, lambda x, y, dx, dy, d: ('ink', 1) if d > 0.88 else None)
    c.HL(3, 20, 10, 'grey', 2)
    c.VL(7, 21, 6, 'dark', 4); c.VL(8, 21, 6, 'dark', 2)
    c.ell(8, 28, 4, 1.5, lambda x, y, dx, dy, d: ('dark', 3))
    c.HL(5, 29, 6, 'ink', 0)


def cafe_chair(c, facing='e'):
    """카페 의자(1칸, 옆향): 앉는 판 윗면 + 한쪽 등받이 + 가는 쇠 다리. e = 동쪽을 봄(등받이 서쪽)."""
    bx = 3 if facing == 'e' else 11
    c.R(3, 16, 10, 5, 'wood', 4); c.HL(3, 16, 10, 'wood', 5); c.HL(3, 20, 10, 'wood', 2)
    ol_rect(c, 2, 15, 12, 7)
    c.R(bx, 6, 2, 12, 'dark', 3); c.VL(bx, 6, 12, 'dark', 4); c.HL(bx - 1, 5, 4, 'ink', 1)
    c.VL(bx - 1, 6, 10, 'ink', 1); c.VL(bx + 2, 6, 10, 'ink', 1)
    legs(c, (3, 12), 22, 7, 'dark', 3); c.VL(5, 22, 6, 'dark', 2); c.VL(10, 22, 6, 'dark', 2)


def cafe_chair_e(c): cafe_chair(c, 'e')
def cafe_chair_w(c): cafe_chair(c, 'w')


def bar_stool(c):
    """높은 둥근 의자(1칸): 위에서 보이는 둥근 방석 + 쇠 기둥 + 발 받침 고리."""
    c.ell(8, 12, 5, 3, lambda x, y, dx, dy, d: ('rose', 5 if dy < 0 else 4) if d < 0.7 else ('rose', 2))
    c.ell(8, 12, 5, 3, lambda x, y, dx, dy, d: ('ink', 1) if d > 0.85 else None)
    c.R(4, 14, 8, 2, 'rose', 2); c.HL(4, 16, 8, 'ink', 0)
    c.VL(7, 17, 11, 'grey', 5); c.VL(8, 17, 11, 'grey', 2)
    c.ell(8, 23, 4, 1.3, lambda x, y, dx, dy, d: ('grey', 4) if d > 0.4 else None)
    c.ell(8, 29, 4, 1.4, lambda x, y, dx, dy, d: ('dark', 3)); c.HL(5, 30, 6, 'ink', 0)


def pastry_case(c):
    """진열 냉장 케이스(2칸): 위에서 들여다보이는 유리 윗면 속 케이크 셋 + 나무 아랫장."""
    c.R(0, 4, 32, 14, 'grey', 5); c.HL(0, 4, 32, 'ink', 1)
    glass(c, 2, 5, 28, 11, 'teal', 4)
    for k, (m, t) in enumerate((('white', 2), ('brick', 3), ('amber', 4))):
        x = 4 + k * 9
        c.R(x, 8, 7, 5, m, t); c.HL(x, 8, 7, m, min(NT[MI[m]] - 1, t + 1)); c.HL(x, 12, 7, m, max(0, t - 2))
        c.P(x + 3, 7, 'red', 5)
    c.HL(1, 16, 30, 'grey', 6); c.HL(1, 17, 30, 'grey', 3)
    c.R(0, 18, 32, 12, 'wood', 1); c.HL(0, 18, 32, 'wood', 3)
    for k in range(2): panel(c, 2 + k * 15, 20, 13, 8, 'wood', 1)
    c.VL(0, 4, 27, 'ink', 1); c.VL(31, 4, 27, 'ink', 1); c.HL(0, 30, 32, 'ink', 0)


# ═══════════════ 병원 ═══════════════
def hosp_bed(c):
    """병원 침대(1×2, 머리 북쪽): 회색 머리판 + 흰 매트·베개 + 연녹 담요 + 옆 난간 + 발판 바퀴."""
    c.R(0, 4, 16, 7, 'grey', 4); c.HL(0, 4, 16, 'grey', 6); c.HL(0, 5, 16, 'grey', 5); ol_rect(c, 0, 3, 16, 9)
    c.R(1, 11, 14, 32, 'white', 2)
    c.R(3, 12, 10, 5, 'white', 2); c.HL(3, 12, 10, 'white', 2); c.HL(3, 16, 10, 'grey', 4)
    for y in range(20, 41):
        for x in range(2, 14): c.P(x, y, 'sage', 5 if (y % 6) else 4)
    c.HL(2, 20, 12, 'sage', 6); c.HL(2, 19, 12, 'white', 1)
    for y in range(14, 38, 2): c.P(0, y, 'grey', 5); c.P(15, y, 'grey', 3)
    c.VL(0, 13, 26, 'grey', 4); c.VL(15, 13, 26, 'grey', 2)
    c.R(1, 42, 14, 3, 'grey', 4); c.HL(1, 42, 14, 'grey', 6)
    c.VL(0, 11, 36, 'ink', 1); c.VL(15, 11, 36, 'ink', 1); c.HL(0, 45, 16, 'ink', 1)
    c.R(1, 46, 2, 2, 'dark', 2); c.R(13, 46, 2, 2, 'dark', 2)


def hosp_curtain(c):
    """병상 칸막이 커튼(2칸): 위 천장 레일(윗면 3행) + 주름진 연청록 커튼(아래 틈) + 고리."""
    c.R(0, 3, 32, 3, 'grey', 6); c.HL(0, 3, 32, 'ink', 1); c.HL(0, 5, 32, 'grey', 3)
    for x in range(1, 31, 4): c.P(x + 1, 6, 'grey', 2)
    for y in range(7, 27):
        for x in range(1, 31):
            fold = (x // 2) % 3
            t = (5, 4, 3)[fold]
            if y > 23 and x > 24: continue
            c.P(x, y, 'sage', t)
    c.HL(1, 26, 24, 'sage', 2); c.VL(0, 6, 21, 'ink', 1); c.VL(31, 6, 18, 'ink', 1); c.HL(1, 27, 24, 'ink', 0)


def iv_stand(c):
    """링거 걸대(1칸): 꼭대기 고리·수액 팩(윗면 빛) + 쇠 기둥 + 다섯 발 바퀴 받침(윗면 보이는 고리)."""
    c.HL(4, 2, 8, 'grey', 5); c.HL(4, 3, 8, 'grey', 2); c.P(4, 4, 'grey', 3); c.P(11, 4, 'grey', 3)
    c.R(9, 4, 5, 8, 'white', 2); c.HL(9, 4, 5, 'white', 2); c.R(10, 8, 3, 3, 'blue', 4); c.VL(13, 5, 7, 'grey', 4)
    ol_rect(c, 8, 3, 7, 10)
    c.VL(11, 12, 6, 'white', 1)
    c.VL(7, 3, 22, 'grey', 5); c.VL(8, 3, 22, 'grey', 2)
    c.ell(8, 26, 6, 2.5, lambda x, y, dx, dy, d: ('grey', 4 if dy < 0 else 2) if d > 0.45 else ('dark', 3))
    c.ell(8, 26, 6, 2.5, lambda x, y, dx, dy, d: ('ink', 1) if d > 0.85 else None)
    for x in (2, 8, 14): c.R(x - 1, 28, 2, 2, 'dark', 1)


def bedside(c):
    """침대 옆 협탁(1칸): 흰 윗면에 물컵·작은 꽃병 + 서랍 둘."""
    slab(c, 1, 9, 14, 7, 12, 'white', tt=1, ft=0)
    panel(c, 3, 17, 10, 4, 'grey', 4); panel(c, 3, 22, 10, 5, 'grey', 4); knob(c, 7, 18); knob(c, 7, 24)
    c.R(3, 8, 3, 4, 'blue', 4); c.HL(3, 8, 3, 'white', 2)
    c.R(9, 9, 3, 4, 'teal', 3); c.P(10, 7, 'red', 5); c.P(9, 6, 'red', 4); c.P(11, 7, 'leaf', 4)


def wait_bench(c):
    """대기 의자(3칸, 한 줄로 이은 의자 셋): 쇠 들보 + 청록 플라스틱 앉는 판(윗면) + 등받이."""
    for k in range(3):
        x = 1 + k * 16
        c.R(x + 1, 8, 12, 7, 'teal', 3); c.HL(x + 1, 8, 12, 'teal', 4); c.VL(x + 1, 9, 6, 'teal', 4); c.VL(x + 12, 9, 6, 'teal', 1)
        ol_rect(c, x, 7, 14, 9)
        c.R(x, 16, 14, 6, 'teal', 4); c.HL(x, 16, 14, 'teal', 3); c.HL(x + 1, 17, 12, 'teal', 4); c.HL(x, 21, 14, 'teal', 1)
        c.VL(x - 1, 16, 6, 'ink', 1); c.VL(x + 14, 16, 6, 'ink', 1); c.HL(x, 22, 14, 'ink', 0)
    c.HL(1, 24, 46, 'grey', 4); c.HL(1, 25, 46, 'grey', 1)
    for x in (4, 23, 43): c.VL(x, 26, 4, 'grey', 3); c.P(x, 30, 'ink', 0)


def med_cart(c):
    """약품 카트(1칸): 위 받침 쟁반(윗면·테) 위 약병 + 색 서랍 넷 + 바퀴."""
    slab(c, 1, 7, 14, 6, 17, 'grey', tt=5, ft=4)
    c.R(3, 6, 2, 4, 'amber', 4); c.R(6, 7, 2, 3, 'white', 2); c.R(10, 6, 3, 3, 'blue', 4)
    for k, m in enumerate(('blue', 'leaf', 'amber', 'red')):
        c.R(3, 14 + k * 2 * 2, 10, 3, m, NT[MI[m]] - 2); c.HL(3, 14 + k * 4, 10, m, NT[MI[m]] - 1); c.HL(6, 15 + k * 4, 4, 'grey', 6)
    c.R(2, 29, 2, 2, 'dark', 1); c.R(12, 29, 2, 2, 'dark', 1)


# ═══════════════ 은행·로비 ═══════════════
def teller(c):
    """은행 창구(3칸): 석재 앞판 카운터(윗면) + 위로 선 유리 칸막이(위 테 윗면, 아래 틈) + 서류 받침."""
    slab(c, 0, 14, 48, 7, 10, 'beige', tt=4, ft=2)
    for x in range(1, 47, 16): c.VL(x + 15, 21, 9, 'beige', 1)
    c.HL(0, 30, 48, 'ink', 0)
    c.R(0, 1, 48, 3, 'grey', 6); c.HL(0, 1, 48, 'ink', 1); c.HL(0, 3, 48, 'grey', 3)
    for k in range(3):
        glass(c, 2 + k * 16, 4, 12, 9, 'teal', 4, s=k)
        c.VL(1 + k * 16, 4, 10, 'grey', 5); c.VL(14 + k * 16, 4, 10, 'grey', 3)
        c.R(5 + k * 16, 13, 6, 1, 'dark', 1)
    c.VL(0, 1, 13, 'ink', 1); c.VL(47, 1, 13, 'ink', 1)
    c.R(4, 16, 6, 3, 'white', 1); c.R(36, 16, 5, 3, 'blue', 4)


def stanchion(c):
    """줄 세우기 기둥(1칸): 위가 보이는 금속 머리 + 붉은 띠 줄(동쪽으로 늘어진) + 둥근 받침."""
    c.ell(5, 8, 2.5, 1.5, lambda x, y, dx, dy, d: ('grey', 6 if dy < 0 else 4))
    c.VL(4, 9, 17, 'grey', 5); c.VL(5, 9, 17, 'grey', 3); c.VL(3, 9, 17, 'ink', 1); c.VL(6, 9, 17, 'ink', 1)
    for x in range(7, 16):
        y = 11 + int(round(3 * math.sin((x - 7) / 9 * math.pi)))
        c.P(x, y, 'red', 4); c.P(x, y + 1, 'red', 1)
    c.ell(5, 27, 4, 1.8, lambda x, y, dx, dy, d: ('grey', 4 if dy < 0 else 2))
    c.HL(2, 29, 7, 'ink', 0)


def elevator(c):
    """엘리베이터(2칸, 벽면에 선): 짙은 틀 + 스테인리스 문 두 짝(세로 결·반사) + 위 층 표시 불빛 + 옆 단추."""
    c.R(0, 0, 32, 30, 'dark', 3); c.HL(0, 0, 32, 'ink', 1); c.HL(0, 1, 32, 'dark', 5)
    c.R(10, 2, 12, 3, 'dark', 1); c.R(12, 3, 3, 1, 'amber', 4); c.R(17, 3, 3, 1, 'amber', 2)
    for k in range(2):
        x = 3 + k * 13
        for y in range(6, 30):
            for i in range(12):
                t = 5 if (i + y // 3) % 7 == 0 else 4 if i < 6 else 3
                if i == 0: t = 6
                c.P(x + i, y, 'grey', t)
    c.VL(15, 6, 24, 'ink', 1)
    c.R(29, 13, 2, 5, 'grey', 5); c.P(29, 14, 'amber', 4); c.P(29, 16, 'amber', 4)
    c.VL(0, 0, 31, 'ink', 1); c.VL(31, 0, 31, 'ink', 1); c.HL(0, 30, 32, 'grey', 6); c.HL(0, 31, 32, 'ink', 0)


def security_gate(c):
    """출입 보안 게이트(2칸): 둘씩 선 몸통(윗면에 판독기 불빛) + 사이 유리 날개."""
    for x in (1, 21):
        slab(c, x, 6, 10, 9, 15, 'grey', tt=5, ft=3)
        c.R(x + 3, 8, 4, 3, 'dark', 2); c.P(x + 4, 9, 'leaf', 5)
    glass(c, 11, 12, 10, 9, 'teal', 4)
    c.VL(11, 12, 9, 'grey', 6); c.VL(20, 12, 9, 'grey', 6); c.HL(11, 12, 10, 'grey', 6)


def planter(c):
    """긴 화분 상자(2칸): 위에서 보이는 흙 아가리 위 관목 셋 + 회색 상자 앞면."""
    for (cx, r) in ((7, 6), (16, 6.5), (25, 6)):
        c.ell(cx, 10, r, 5.2, lambda x, y, dx, dy, d: ('leaf', 5 if dx + dy < -0.6 else 4 if d < 0.5 else 3 if d < 0.85 else 2))
    for k in range(10): c.P(3 + h32(k, 3, 45) % 26, 6 + h32(k, 4, 45) % 8, 'leaf', 1)
    c.R(0, 15, 32, 3, 'grey', 6); c.HL(0, 15, 32, 'ink', 1)
    c.R(0, 18, 32, 11, 'grey', 3); c.HL(0, 18, 32, 'grey', 2); c.VL(1, 18, 11, 'grey', 4); c.VL(30, 18, 11, 'grey', 1)
    c.VL(0, 15, 15, 'ink', 1); c.VL(31, 15, 15, 'ink', 1); c.HL(0, 29, 32, 'ink', 0)


def mailboxes(c):
    """우편함(2칸, 벽 가구): 윗면 + 작은 문 4×4 격자(투입구 선·작은 손잡이)."""
    slab(c, 0, 2, 32, 5, 24, 'grey', tt=4, ft=3)
    for r in range(4):
        for k in range(4):
            x = 2 + k * 7; y = 8 + r * 5
            panel(c, x, y, 6, 4, 'grey', 4); c.HL(x + 1, y + 1, 4, 'dark', 3)


# ═══════════════ 역 대합실 ═══════════════
def ticket_gate(c):
    """개찰구(2칸): 몸통 둘(윗면 판독 패드 청록 빛) + 가운데 날개 문."""
    for x in (0, 20):
        slab(c, x, 8, 12, 9, 13, 'grey', tt=4, ft=2)
        c.R(x + 2, 10, 6, 4, 'teal', 4); c.HL(x + 2, 10, 6, 'teal', 4); c.P(x + 9, 11, 'leaf', 5)
        c.HL(x + 2, 20, 8, 'amber', 3)
    c.R(12, 14, 3, 7, 'red', 5); c.R(17, 14, 3, 7, 'red', 5); c.VL(12, 14, 7, 'ink', 1); c.VL(19, 14, 7, 'ink', 1)


def ticket_machine(c):
    """발권기(2칸, 벽 가구): 몸통 둘(윗면) + 켜진 터치 화면 + 동전·지폐 구멍 + 표 나오는 홈."""
    for k in range(2):
        x = k * 16
        slab(c, x, 0, 16, 5, 25, 'navy', tt=4, ft=2)
        c.R(x + 2, 7, 12, 8, 'dark', 1); c.R(x + 3, 8, 10, 6, 'blue', 4); c.HL(x + 3, 8, 10, 'navy', 6)
        for i in range(3): c.R(x + 4 + i * 3, 10, 2, 2, ('amber', 'leaf', 'red')[i], 4)
        c.R(x + 3, 17, 4, 1, 'dark', 1); c.R(x + 10, 17, 3, 2, 'dark', 1); c.R(x + 4, 22, 8, 2, 'dark', 1)


def bench_metal(c):
    """대합실 금속 벤치(2칸, 등받이 없음): 구멍 뚫린 앉는 판 윗면 + 다리."""
    slab(c, 0, 6, 32, 6, 3, 'grey', tt=5, ft=3)
    for x in range(2, 30, 3): c.P(x, 8, 'grey', 3); c.P(x + 1, 10, 'grey', 3)
    legs(c, (2, 3, 28, 29), 15, 1, 'dark', 3)


def tactile(c):
    """점자 블록(밟는 줄): 노란 판에 점 격자."""
    c.R(0, 0, 16, 16, 'amber', 1)
    for y in range(2, 16, 4):
        for x in range(2, 16, 4): c.P(x, y, 'amber', 4); c.P(x + 1, y + 1, 'amber', 0)
    c.VL(0, 0, 16, 'amber', 0); c.VL(15, 0, 16, 'amber', 0)


def route_map(c):
    """노선도 판(2칸, 벽걸이): 흰 판 위 색 노선 선과 역 점(글자 없음) + 짙은 틀."""
    c.R(1, 3, 30, 20, 'white', 2)
    c.HL(1, 2, 30, 'ink', 1); c.HL(1, 23, 30, 'ink', 1); c.VL(0, 3, 20, 'ink', 1); c.VL(31, 3, 20, 'ink', 1)
    c.line(3, 8, 28, 8, 'red', 4); c.line(3, 16, 12, 16, 'leaf', 4); c.line(12, 16, 20, 10, 'leaf', 4); c.line(20, 10, 28, 18, 'leaf', 4)
    c.line(9, 4, 9, 21, 'blue', 4); c.line(22, 4, 22, 21, 'amber', 1)
    for (x, y) in ((9, 8), (22, 8), (9, 16), (22, 14), (15, 8), (5, 8)): c.P(x, y, 'white', 2); c.P(x + 1, y, 'ink', 1)


def stairs_up(c):
    """오르는 계단(2칸, 벽 가구 — 북쪽 벽 속으로 오른다): 단마다 밝은 디딤판·어두운 챌판 + 양옆 난간."""
    for k in range(6):
        y = 2 + k * 5
        c.R(2, y, 28, 2, 'grey', 5 - (k // 3)); c.R(2, y + 2, 28, 3, 'grey', 2)
        c.HL(2, y, 28, 'grey', 6 if k > 2 else 4)
    c.R(0, 0, 2, 32, 'dark', 3); c.R(30, 0, 2, 32, 'dark', 2)
    c.VL(1, 0, 32, 'grey', 4); c.VL(30, 0, 32, 'grey', 4)
    c.VL(0, 0, 32, 'ink', 1); c.VL(31, 0, 32, 'ink', 1)


def stairs_down(c):
    """내려가는 계단(2×2, 바닥 구멍): 난간 테 + 아래로 어두워지는 단."""
    c.R(0, 0, 32, 32, 'dark', 1)
    for k in range(6):
        y = 4 + k * 5
        t = max(0, 5 - k)
        c.R(3, y, 26, 3, 'grey', t); c.HL(3, y, 26, 'grey', min(6, t + 1)); c.R(3, y + 3, 26, 2, 'dark', max(0, 3 - k // 2))
    c.R(0, 0, 3, 32, 'grey', 4); c.R(29, 0, 3, 32, 'grey', 3); c.R(0, 0, 32, 3, 'grey', 5)
    c.HL(0, 0, 32, 'ink', 1); c.VL(0, 0, 32, 'ink', 1); c.VL(31, 0, 32, 'ink', 1); c.HL(3, 3, 26, 'ink', 0)


# ═══════════════ 창고 ═══════════════
def rack(c):
    """창고 선반(3칸, 벽 가구): 주황 기둥·파랑 들보 + 두 단 골판지 상자 + 맨 위 들보 윗면."""
    c.R(0, 0, 48, 3, 'blue', 3); c.HL(0, 0, 48, 'ink', 1); c.HL(0, 2, 48, 'blue', 1)
    for r in range(2):
        y = 3 + r * 13
        c.R(2, y, 44, 10, 'dark', 1)
        for k in range(4):
            bx = 3 + k * 11; bw = 9 - (k % 2); bh = 7 + (k + r) % 3
            c.R(bx, y + 10 - bh, bw, bh, 'wood', 4); c.HL(bx, y + 10 - bh, bw, 'wood', 5); c.VL(bx + bw - 1, y + 10 - bh, bh, 'wood', 2)
            c.HL(bx + 1, y + 12 - bh, bw - 2, 'amber', 3)
        c.R(0, y + 10, 48, 3, 'blue', 3); c.HL(0, y + 10, 48, 'blue', 4); c.HL(0, y + 12, 48, 'blue', 1)
    for x in (0, 23, 45):
        c.R(x, 0, 3, 31, 'brick', 4); c.VL(x, 0, 31, 'brick', 4); c.VL(x + 2, 0, 31, 'brick', 2)
        for y in range(2, 30, 3): c.P(x + 1, y, 'brick', 1)
    c.VL(0, 0, 31, 'ink', 1); c.VL(47, 0, 31, 'ink', 1); c.HL(0, 31, 48, 'ink', 0)


def pallet_boxes(c):
    """팔레트 위 상자 더미(1칸): 상자 셋 쌓임(윗면 테이프) + 나무 팔레트."""
    for (x, y, w, h) in ((1, 13, 8, 9), (8, 13, 7, 9), (3, 5, 9, 8)):
        c.R(x, y, w, h, 'wood', 3); c.R(x, y, w, 3, 'wood', 5); c.HL(x, y + 1, w, 'amber', 3)
        c.VL(x + w - 1, y + 3, h - 3, 'wood', 2); ol_rect(c, x, y, w, h)
    c.R(0, 22, 16, 6, 'wood', 2); c.HL(0, 22, 16, 'wood', 4)
    for x in (2, 7, 12): c.R(x, 25, 2, 3, 'wood', 1)
    c.HL(0, 28, 16, 'ink', 0); c.VL(0, 22, 6, 'ink', 1); c.VL(15, 22, 6, 'ink', 1)


def drums(c):
    """드럼통 둘(1칸): 위에서 보이는 둥근 뚜껑(마개) + 테 두 줄 + 그늘."""
    for (cx, m) in ((5, 'blue'), (11, 'red')):
        c.R(cx - 4, 12, 8, 14, m, 3)
        for x in range(cx - 4, cx + 4):
            c.VL(x, 12, 14, m, 4 if x < cx - 1 else 3 if x < cx + 2 else 2)
        c.HL(cx - 4, 17, 8, m, 1); c.HL(cx - 4, 22, 8, m, 1)
        c.ell(cx, 12, 4, 2.4, lambda x, y, dx, dy, d: (m, 5 if NT[MI[m]] > 5 else 4) if d < 0.7 else (m, 1))
        c.P(cx + 1, 11, 'grey', 5)
        for y in range(9, 27):
            for x in range(cx - 5, cx + 5):
                if c.on(x, y) and (not c.on(x - 1, y) or not c.on(x + 1, y) or not c.on(x, y - 1)): c.P(x, y, 'ink', 1)
        c.HL(cx - 4, 26, 8, 'ink', 0)


# 3/4 관문 1차 불합격분은 art_v2.py 에서 다시 그렸다 — 같은 이름을 덮어쓴다.
from art_v2 import (chair_office_s, chair_office_n, chair_wood_s, chair_wood_n, cafe_chair_e, cafe_chair_w,  # noqa: E402,F401,F811
                    wait_bench, sofa3, armchair, partition, copier, server_rack, shelf_office, gondola, gondola_v, cooler,
                    magazine_rack, atm, basket_stack, wardrobe, pastry_case, hosp_curtain, iv_stand, stanchion, security_gate,
                    ticket_gate, planter, ticket_machine, rack, pallet_boxes, drums)
