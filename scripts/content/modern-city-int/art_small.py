"""modern_city 실내 — 탁자(자동 조각)·탁상 물건 그림."""
from mpx import C, rnd, h32, glass, screen, NT, MI


def _table(c, w, h, mat, tt, ft, edge, legmat, counter=False, grain=False):
    """탁자 w×h 칸 전체 그림: 윗면(가장자리 1px 테·뒤 ink) + 남쪽 앞면 + 다리(또는 카운터 앞판)."""
    W, H = w * 16, h * 16
    front = 7 if counter else 4
    top_end = H - front - (0 if counter else 3)
    n = NT[MI[mat]]
    for y in range(1, top_end):
        for x in range(1, W - 1):
            t = tt
            if grain and rnd(x // 5, y, 50) < 0.12: t = tt - 1
            c.P(x, y, mat, t)
    c.HL(1, 1, W - 2, 'ink', 1); c.VL(0, 1, top_end, 'ink', 1); c.VL(W - 1, 1, top_end, 'ink', 1)
    c.HL(1, 2, W - 2, mat, min(n - 1, tt + 1)); c.VL(1, 2, top_end - 2, mat, min(n - 1, tt + 1))
    c.HL(1, top_end - 1, W - 2, edge[0], edge[1])
    if counter:
        c.R(1, top_end, W - 2, front - 1, mat, ft); c.HL(1, top_end, W - 2, mat, max(0, ft - 1))
        for x in range(16, W - 1, 16): c.VL(x, top_end + 1, front - 2, mat, max(0, ft - 1))
        c.VL(0, top_end, front, 'ink', 1); c.VL(W - 1, top_end, front, 'ink', 1); c.HL(0, H - 1, W, 'ink', 0)
    else:
        c.R(1, top_end, W - 2, 2, mat, ft); c.HL(1, top_end + 1, W - 2, mat, max(0, ft - 1))
        c.VL(0, top_end, 2, 'ink', 1); c.VL(W - 1, top_end, 2, 'ink', 1); c.HL(1, top_end + 2, W - 2, 'ink', 0)
        for x in (2, W - 4):
            c.R(x, top_end + 2, 2, H - top_end - 3, legmat[0], legmat[1]); c.P(x, H - 2, 'ink', 0); c.P(x + 1, H - 2, 'ink', 0)


def t_meeting(c, w, h): _table(c, w, h, 'grey', 5, 3, ('grey', 3), ('dark', 3))
def t_wood(c, w, h): _table(c, w, h, 'wood', 4, 2, ('wood', 2), ('wood', 1), grain=True)
def t_counter(c, w, h): _table(c, w, h, 'beige', 4, 2, ('beige', 2), ('dark', 3), counter=True)


# ═══════════════ 탁상 물건 16×16 ═══════════════
def g_laptop(c):
    """열린 노트북: 켜진 화면(뒤로 기운 판) + 자판 윗면."""
    c.R(3, 3, 10, 6, 'dark', 2); c.R(4, 4, 8, 4, 'blue', 4); c.HL(4, 4, 8, 'navy', 6)
    c.R(2, 9, 12, 4, 'grey', 4); c.HL(2, 9, 12, 'grey', 5)
    for i in range(3, 13, 2): c.P(i, 10, 'grey', 2); c.P(i, 11, 'grey', 2)
    c.HL(2, 13, 12, 'ink', 0); c.HL(3, 2, 10, 'ink', 1)


def g_coffee(c):
    """머그잔 둘(위에서 보이는 커피 면)."""
    for (x, m) in ((3, 'white'), (9, 'red')):
        c.R(x, 7, 5, 5, m, NT[MI[m]] - 2); c.ell(x + 2.5, 7.5, 2.5, 1.3, lambda X, Y, dx, dy, d: ('wood', 0) if d < 0.6 else (m, NT[MI[m]] - 1))
        c.P(x + 5, 9, m, NT[MI[m]] - 3); c.HL(x, 12, 5, 'ink', 0)


def g_papers(c):
    """서류 더미 + 집게."""
    for k in range(3): c.R(3 + k, 6 - k, 10, 6, 'white', 2 - (k == 0)); c.HL(3 + k, 11 - k, 10, 'grey', 4)
    c.HL(6, 6, 6, 'grey', 3); c.HL(6, 8, 5, 'grey', 3); c.R(9, 3, 2, 2, 'dark', 3); c.HL(3, 12, 11, 'ink', 0)


def g_phone(c):
    """사무 전화기: 몸체 윗면 + 수화기 + 단추 격자."""
    c.R(3, 7, 10, 6, 'dark', 4); c.HL(3, 7, 10, 'dark', 5)
    c.R(3, 5, 10, 2, 'dark', 3); c.HL(3, 4, 10, 'ink', 1)
    for j in range(2):
        for i in range(3): c.P(8 + i, 9 + j * 2, 'grey', 5)
    c.R(4, 9, 3, 3, 'blue', 4); c.HL(3, 13, 10, 'ink', 0)


def g_register(c):
    """카운터 계산 단말(작은 화면 + 카드 단말)."""
    c.R(2, 4, 8, 6, 'dark', 2); c.R(3, 5, 6, 4, 'blue', 4); c.HL(3, 5, 6, 'navy', 6)
    c.R(4, 10, 4, 2, 'dark', 3); c.R(11, 7, 3, 5, 'dark', 4); c.P(12, 8, 'leaf', 5)
    c.HL(2, 12, 12, 'ink', 0)


def g_espresso(c):
    """에스프레소 머신(작은 상자 + 추출구 + 컵)."""
    c.R(3, 2, 10, 10, 'grey', 5); c.HL(3, 2, 10, 'grey', 6); c.VL(12, 2, 10, 'grey', 3)
    c.R(4, 7, 8, 2, 'dark', 2); c.R(6, 10, 4, 2, 'white', 2)
    c.P(5, 4, 'red', 5); c.P(10, 4, 'leaf', 5)
    c.HL(3, 1, 10, 'ink', 1); c.HL(3, 12, 10, 'ink', 0)


def g_cake(c):
    """접시 위 케이크 조각 둘."""
    c.ell(8, 9, 6.5, 3.5, lambda x, y, dx, dy, d: ('white', 2 if dy < 0.2 else 1))
    c.R(4, 6, 4, 3, 'white', 1); c.HL(4, 6, 4, 'red', 5); c.R(9, 6, 4, 3, 'brick', 3); c.HL(9, 6, 4, 'wood', 1)
    c.HL(3, 12, 10, 'ink', 0)


def g_vase(c):
    """꽃병(꽃 세 송이)."""
    c.R(6, 8, 4, 5, 'teal', 3); c.VL(6, 8, 5, 'teal', 4); c.HL(6, 8, 4, 'teal', 4)
    for (x, y, m) in ((5, 4, 'red'), (8, 3, 'amber'), (10, 5, 'plum')): c.R(x, y, 2, 2, m, NT[MI[m]] - 1); c.P(x, y + 2, 'leaf', 3)
    c.HL(6, 13, 4, 'ink', 0)


def g_monitor(c):
    """탁상 모니터(켜진 화면)."""
    c.R(2, 1, 12, 9, 'dark', 1); c.R(3, 2, 10, 7, 'blue', 4); c.HL(3, 2, 10, 'navy', 6)
    for y in (4, 6): c.HL(4, y, 6, 'navy', 6)
    c.R(7, 10, 2, 2, 'dark', 3); c.R(5, 12, 6, 1, 'dark', 2); c.HL(2, 0, 12, 'ink', 1); c.HL(5, 13, 6, 'ink', 0)


# 3/4 관문 1차 불합격분은 art_v2.py 에서 다시 그렸다(탁상 모니터는 책 더미로 바꿨다).
from art_v2 import g_phone, g_register, g_espresso, g_cake, g_vase, g_books  # noqa: E402,F401,F811
