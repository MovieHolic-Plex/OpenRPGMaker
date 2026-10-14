"""modern_campus 실내 그림(Opus 다시 그리기, 2026-10-14) — campus_interior.py 의 등록(id·치수·종류)마다 그림 함수 하나.

엔진: ../art/px.py (modern3 램프 잠금). 3/4: 윗면 5행 이상(밝게, 뒤 가장자리 sumi 선) + 앞면(두 단 어둡게, 왼쪽 빛·오른쪽 그늘) + 밑 sumi 접지선.
up 8 가구는 그림 위 8px 가 비고(벽 앞에 솟는 높이), up 16 은 위 16px 이 솟는 부분이다(ikit 계약).
"""
import math, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'art'))
from px import C, rnd, h32, box3, NT, MI   # noqa: E402

ART = {}


def art(id_):
    def deco(fn): ART[id_] = fn; return fn
    return deco


# ═══════════════ 도우미 ═══════════════
def furn(c, x, y, w, h, top, mat, tt=None, ft=None, grain=None, back=True):
    """상자 가구. (x,y) 왼위, 폭 w, 전체 높이 h, 윗면 top 행. 윤곽 sumi."""
    n = NT[MI[mat]]
    tt = n - 2 if tt is None else tt
    ft = tt - 2 if ft is None else ft
    c.R(x, y, w, top, mat, tt)
    if grain == 'wood':
        for j in range(1, top - 1):
            for i in range(1, w - 1):
                r = rnd(x + i, (y + j) // 2 + (i // 5), 4)
                if r < 0.18: c.P(x + i, y + j, mat, tt - 1)
                elif r > 0.93: c.P(x + i, y + j, mat, tt + 1)
    elif grain == 'steel':
        for j in range(1, top - 1, 2): c.HL(x + 1, y + j, w - 2, mat, tt - 1)
    c.HL(x, y + 1, w, mat, tt + 1) if back else None
    c.HL(x, y + top - 1, w, mat, tt + 1)                    # 앞 모서리 반사
    c.R(x, y + top, w, h - top, mat, ft)
    c.HL(x, y + top, w, mat, ft - 1)                        # 모서리 밑 그늘
    c.VL(x + 1, y + top, h - top, mat, ft + 1); c.VL(x + w - 2, y + top, h - top, mat, ft - 1)
    # 윤곽
    c.HL(x, y, w, 'sumi', 1); c.HL(x, y + h - 1, w, 'sumi', 1)
    c.VL(x, y, h, 'sumi', 1); c.VL(x + w - 1, y, h, 'sumi', 1)
    return y + top


def drawer(c, x, y, w, h, mat, t):
    c.R(x, y, w, h, mat, t); c.HL(x, y, w, mat, t + 1); c.HL(x, y + h - 1, w, mat, t - 2); c.VL(x + w - 1, y, h, mat, t - 1)
    hx = x + w // 2 - 1
    c.HL(hx, y + h // 2, 3 if w > 6 else 2, 'tekko', 5); c.HL(hx, y + h // 2 + 1, 3 if w > 6 else 2, 'tekko', 2)


def panel(c, x, y, w, h, mat, t):
    c.R(x, y, w, h, mat, t); c.HL(x, y, w, mat, t - 1); c.VL(x, y, h, mat, t - 1); c.HL(x, y + h - 1, w, mat, t + 1); c.VL(x + w - 1, y, h, mat, t + 1)


def glass(c, x, y, w, h, t=3):
    for j in range(h):
        for i in range(w):
            tt = t + (1 if j < 2 else 0)
            if (i + j) % 7 in (0, 1) and j < h - 1: tt = t + 2
            c.P(x + i, y + j, 'garasu', tt)


def books(c, x, y, w, h, s=0, lean=True):
    """책등 줄: 1~2px 폭, 높이 h-0~2 변주, 색 램프 섞음."""
    cols = ('aka', 'sora', 'midori', 'kii', 'kon', 'daidai', 'murasaki', 'shiro', 'lino')
    i = 0; k = 0
    while i < w:
        bw = 2 if h32(k, 1, s) % 3 else 1
        bh = h - (h32(k, 2, s) % 3)
        m = cols[h32(k, 3, s) % len(cols)]
        for q in range(bw):
            if i + q < w:
                c.VL(x + i + q, y + h - bh, bh, m, 3 if q == 0 else 2)
                c.P(x + i + q, y + h - bh, m, 4)
        i += bw; k += 1
        if h32(k, 4, s) % 7 == 0 and i < w: i += 1


def shelf_box(c, x, y, w, h, top, mat='ita', tt=5, shelves=2, s=0, content='books'):
    """선반 가구: 윗면 + 앞 틀 안에 칸(뒤판 어둡게) + 내용."""
    y1 = furn(c, x, y, w, h, top, mat, tt=tt)
    inner_h = h - top - 3
    rows = shelves
    hh = inner_h // rows
    for r in range(rows):
        sy = y1 + 1 + r * hh
        c.R(x + 2, sy, w - 4, hh - 1, mat, 1)                       # 칸 안 그늘
        if content == 'books': books(c, x + 2, sy + 1, w - 4, hh - 2, s + r)
        c.HL(x + 1, sy + hh - 1, w - 2, mat, tt - 1)                 # 선반 판
    c.HL(x + 1, y + h - 2, w - 2, mat, 2)


def paper(c, x, y, w=4, h=3, t=4):
    c.R(x, y, w, h, 'shiro', t); c.HL(x, y + h - 1, w, 'shiro', t - 2)
    if w > 3: c.HL(x + 1, y + 1, w - 2, 'conc', 3)


def mug(c, x, y, m='aka'):
    c.R(x, y, 3, 3, m, 3); c.HL(x, y, 3, m, 4); c.P(x + 1, y, m, 1); c.P(x + 3, y + 1, m, 2)


def plant(c, x, y):
    c.R(x, y + 3, 4, 3, 'daidai', 2); c.HL(x, y + 3, 4, 'daidai', 3)
    for (dx, dy, t) in ((1, 0, 4), (2, 1, 3), (0, 1, 3), (3, 2, 2), (1, 2, 4), (2, 0, 3)):
        c.P(x + dx, y + dy, 'midori', t)


def laptop(c, x, y, open_=True):
    if open_:
        c.R(x, y, 7, 4, 'yoru', 2); c.R(x + 1, y + 1, 5, 2, 'sora', 2); c.P(x + 1, y + 1, 'sora', 3)
        c.R(x, y + 4, 7, 2, 'tekko', 5); c.HL(x, y + 5, 7, 'tekko', 3)
    else:
        c.R(x, y, 7, 3, 'tekko', 4); c.HL(x, y, 7, 'tekko', 6)


def lamp(c, x, y):
    c.R(x, y, 4, 2, 'kii', 4); c.HL(x, y, 4, 'kii', 4); c.HL(x, y + 2, 4, 'kii', 2)
    c.VL(x + 1, y + 3, 3, 'tekko', 3); c.R(x, y + 6, 4, 1, 'tekko', 2)


def chair_back(c, x, y, w, mat='tekko', t=4):
    """의자 등받이(책상 뒤로 보이는 위 막대)."""
    c.R(x, y, w, 3, 'yuka', 3); c.HL(x, y, w, 'yuka', 4); c.HL(x, y + 2, w, 'yuka', 1)
    c.VL(x, y + 3, 2, mat, t); c.VL(x + w - 1, y + 3, 2, mat, t - 2)
    c.HL(x - 1, y - 1, w + 2, 'sumi', 1); c.VL(x - 1, y, 3, 'sumi', 1); c.VL(x + w, y, 3, 'sumi', 1)


# ═══════════════ 바닥 (주기 그림, 세계 좌표) ═══════════════
@art('mc-floor-lino')
def _(c):
    """교실 리놀륨: 옅은 베이지 회색 + 16px 이음, 덩이 점박이."""
    for y in range(c.h):
        for x in range(c.w):
            r = rnd(x // 3, y // 3, 5); q = rnd(x, y, 6)
            t = 3
            if r < 0.10 and q < 0.5: t = 2
            if q > 0.975: t = 4
            if q < 0.012: t = 2
            c.P(x, y, 'kinari', t)
    for k in range(0, c.w, 16): c.VL(k, 0, c.h, 'kinari', 2)
    for k in range(0, c.h, 16): c.HL(0, k, c.w, 'kinari', 2)


@art('mc-floor-corridor')
def _(c):
    """복도 대형 타일(32×16 판, 엇갈림 없음): 연청회 3톤 판 + 판 가장자리 빛·그늘."""
    for ty in range(0, c.h, 16):
        for tx in range(0, c.w, 32):
            base = 3 if h32(tx // 32, ty // 16, 2) % 3 else 2
            for y in range(16):
                for x in range(32):
                    q = rnd(tx + x, ty + y, 8)
                    t = base + (1 if q > 0.98 else -1 if q < 0.02 else 0)
                    c.P(tx + x, ty + y, 'lino', t)
            c.HL(tx, ty, 32, 'lino', 1); c.VL(tx, ty, 16, 'lino', 1)
            c.HL(tx + 1, ty + 1, 30, 'lino', 4); c.VL(tx + 1, ty + 1, 14, 'lino', 4)


@art('mc-floor-parquet')
def _(c):
    """쪽마루: 4px 폭 판을 16px 길이로 엇갈려 깐 꿀색 나무(yuka)."""
    for y in range(c.h):
        row = y // 4; ly = y % 4
        for x in range(c.w):
            xs = (x + (8 if row % 2 else 0)) % c.w; k = xs // 16; lx = xs % 16
            base = (2, 3, 3, 2)[h32(k, row, 9) % 4]
            t = base
            if ly == 0: t = base + 1
            if ly == 3: t = 1
            if lx == 15: t = 1
            elif rnd(x, y // 2, 3) < 0.12 and ly in (1, 2): t = base - 1 if base > 2 else base
            c.P(x, y, 'yuka', t)


@art('mc-floor-cafe')
def _(c):
    """급식실 8px 체크(흰·연하늘) + 회색 줄눈 + 판마다 빛 점."""
    for y in range(c.h):
        for x in range(c.w):
            light = ((x // 8) + (y // 8)) % 2 == 0
            lx, ly = x % 8, y % 8
            if lx == 7 or ly == 7: c.P(x, y, 'conc', 3); continue
            if light: c.P(x, y, 'shiro', 4 if (lx, ly) in ((1, 1), (2, 1), (1, 2)) else 3)
            else: c.P(x, y, 'garasu', 5 if (lx, ly) in ((1, 1),) else 4 if rnd(x, y, 2) > 0.1 else 5)


@art('mc-floor-dorm')
def _(c):
    """기숙사 카펫: 청회(tairu) 짧은 털 결 — 2px 덩이 + 점."""
    for y in range(c.h):
        for x in range(c.w):
            r = rnd(x // 2, y // 2 + (x // 2) % 2, 12); q = rnd(x, y, 13)
            t = 3 if r < 0.55 else 2 if r < 0.85 else 4
            if q > 0.97: t = 4
            c.P(x, y, 'tairu', t)


@art('mc-floor-tile-wc')
def _(c):
    """화장실 4px 소형 타일(연녹회) + 줄눈."""
    for y in range(c.h):
        for x in range(c.w):
            lx, ly = x % 4, y % 4
            if lx == 3 or ly == 3: c.P(x, y, 'lino', 2); continue
            t = 4 if h32(x // 4, y // 4, 4) % 5 else 3
            if lx == 0 and ly == 0: t += 0
            c.P(x, y, 'lino', t)


# ═══════════════ 벽면 (32px 높이 × cols 칸) ═══════════════
def skirting(c, y, mat='yuka', t=2):
    c.HL(0, y, c.w, mat, t + 1); c.R(0, y + 1, c.w, 2, mat, t); c.HL(0, y + 3, c.w, 'sumi', 1)


@art('mc-wall-class')
def _(c):
    """교실 벽: 위 크림 칠 + 허리 아래 초록 칠(나무 몰딩 띠) + 걸레받이."""
    for y in range(0, 17):
        for x in range(c.w): c.P(x, y, 'kinari', 4 if rnd(x, y, 4) > 0.04 else 3)
    c.HL(0, 17, c.w, 'yuka', 4); c.HL(0, 18, c.w, 'yuka', 3); c.HL(0, 19, c.w, 'yuka', 1)
    for y in range(20, 28):
        for x in range(c.w): c.P(x, y, 'lino', 3 if rnd(x, y, 5) > 0.05 else 2)
    for x in range(0, c.w, 16): c.VL(x, 20, 8, 'lino', 2)
    skirting(c, 28, 'yuka', 2)


@art('mc-wall-corridor')
def _(c):
    """복도 벽: 흰 칠 + 하늘색 가로 띠 + 아래 연회 판 + 걸레받이."""
    for y in range(0, 20):
        for x in range(c.w): c.P(x, y, 'shiro', 3 if rnd(x, y, 6) > 0.03 else 2)
    c.HL(0, 12, c.w, 'garasu', 5); c.HL(0, 13, c.w, 'garasu', 4); c.HL(0, 14, c.w, 'garasu', 3)
    for y in range(20, 28):
        for x in range(c.w): c.P(x, y, 'conc', 4)
    c.HL(0, 20, c.w, 'conc', 5); c.HL(0, 21, c.w, 'conc', 2)
    for x in range(0, c.w, 16): c.VL(x + 15, 22, 6, 'conc', 3)
    skirting(c, 28, 'conc', 2)


@art('mc-wall-tile')
def _(c):
    """흰 사각 타일 벽(8px 판, 회색 줄눈, 판마다 위왼 빛) + 위 칠 띠."""
    for y in range(0, 6):
        for x in range(c.w): c.P(x, y, 'shiro', 3)
    c.HL(0, 6, c.w, 'conc', 4)
    for y in range(7, 30):
        for x in range(c.w):
            lx, ly = x % 8, (y - 7) % 8
            if lx == 7 or ly == 7: c.P(x, y, 'conc', 4); continue
            c.P(x, y, 'shiro', 4 if (lx == 0 or ly == 0) else 3)
    c.HL(0, 30, c.w, 'conc', 3); c.HL(0, 31, c.w, 'sumi', 1)


@art('mc-wall-dorm')
def _(c):
    """기숙사 벽: 옅은 베이지 벽지(가는 세로 결) + 나무 몰딩 + 걸레받이."""
    for y in range(0, 28):
        for x in range(c.w):
            t = 3 if x % 4 else 2
            if rnd(x, y, 7) < 0.04: t = 2
            c.P(x, y, 'kinari', t)
    c.HL(0, 18, c.w, 'ita', 5); c.HL(0, 19, c.w, 'ita', 3)
    skirting(c, 28, 'ita', 3)


@art('mc-wall-cafe')
def _(c):
    """급식실 벽: 연노랑 칠 + 아래 흰 타일 허리 + 걸레받이."""
    for y in range(0, 15):
        for x in range(c.w): c.P(x, y, 'kii', 4 if rnd(x, y, 8) > 0.05 else 3)
    c.HL(0, 15, c.w, 'conc', 5); c.HL(0, 16, c.w, 'conc', 3)
    for y in range(17, 29):
        for x in range(c.w):
            lx, ly = x % 8, (y - 17) % 6
            if lx == 7 or ly == 5: c.P(x, y, 'conc', 4); continue
            c.P(x, y, 'shiro', 4 if ly == 0 else 3)
    skirting(c, 28, 'conc', 2)


# ═══════════════ 벽걸이(hang, 2줄 = 벽면 높이) ═══════════════
@art('mc-board-green')
def _(c):
    # 알루미늄 틀(위 가장자리 윗면 2행) + 초록 칠판 + 분필 받침(윗면 보이는 홈통)
    c.HL(1, 2, 62, 'sumi', 1); c.HL(1, 3, 62, 'tekko', 6); c.HL(1, 4, 62, 'tekko', 4)
    for y in range(5, 22):
        for x in range(2, 62):
            r = rnd(x // 3, y // 2, 4)
            c.P(x, y, 'kokuban', 2 if r > 0.18 else 1 if r < 0.08 else 3)
    c.VL(1, 3, 20, 'tekko', 5); c.VL(62, 3, 20, 'tekko', 2)
    # 지운 분필 자국·선(글자 없음)
    for (x, y, w) in ((6, 8, 14), (6, 11, 9), (26, 8, 18), (26, 12, 12), (48, 9, 9)):
        for i in range(w):
            if rnd(x + i, y, 2) > 0.2: c.P(x + i, y, 'kokuban', 4)
    c.ell(52, 15, 4, 3, lambda x, y, dx, dy, d: ('kokuban', 4) if d > 0.6 else None)
    c.HL(1, 22, 62, 'tekko', 6); c.HL(1, 23, 62, 'tekko', 3); c.HL(1, 24, 62, 'tekko', 2); c.HL(1, 25, 62, 'sumi', 1)
    for (x, m) in ((10, 'shiro'), (13, 'kii'), (40, 'pinku')): c.R(x, 22, 2, 1, m, 4)
    c.VL(0, 2, 24, 'sumi', 1); c.VL(63, 2, 24, 'sumi', 1)


@art('mc-wall-clock')
def _(c):
    c.ell(8, 10, 6, 6, lambda x, y, dx, dy, d: ('tekko', 2) if d > 0.72 else ('shiro', 4 if dx + dy < 0 else 3))
    c.ell(8, 10, 6, 6, lambda x, y, dx, dy, d: ('sumi', 1) if d > 0.9 else None)
    for k in range(12):
        a = k / 12 * 2 * math.pi
        if k % 3 == 0: c.P(int(8 + math.cos(a) * 3.8), int(10 + math.sin(a) * 3.8), 'yoru', 1)
    c.line(8, 10, 8, 6, 'yoru', 0); c.line(8, 10, 11, 11, 'yoru', 1); c.P(8, 10, 'aka', 2)
    c.HL(4, 4, 8, 'tekko', 4)


@art('mc-screen-proj')
def _(c):
    # 말아 올린 통(윗면 보이는 원통) + 늘어뜨린 흰 막 + 아래 손잡이 막대
    c.HL(1, 1, 46, 'sumi', 1); c.HL(1, 2, 46, 'shiro', 4); c.R(1, 3, 46, 2, 'shiro', 3); c.HL(1, 5, 46, 'tekko', 2)
    c.R(0, 2, 2, 4, 'tekko', 3); c.R(46, 2, 2, 4, 'tekko', 2)
    for y in range(6, 24):
        for x in range(4, 44):
            t = 4 if x < 20 else 3
            if x in (4, 43): t = 2
            c.P(x, y, 'shiro', t)
    c.VL(3, 6, 18, 'sumi', 1); c.VL(44, 6, 18, 'sumi', 1)
    c.HL(4, 24, 40, 'yoru', 2); c.HL(4, 25, 40, 'sumi', 1); c.R(22, 26, 4, 2, 'yoru', 2)


@art('mc-cork-board')
def _(c):
    c.HL(1, 3, 30, 'sumi', 1); c.HL(1, 4, 30, 'ita', 5); c.HL(1, 5, 30, 'ita', 3)
    for y in range(6, 22):
        for x in range(3, 29):
            r = rnd(x, y, 9)
            c.P(x, y, 'yuka', 3 if r > 0.25 else 2 if r > 0.08 else 4)
    c.VL(1, 4, 20, 'ita', 4); c.VL(2, 5, 18, 'ita', 3); c.VL(29, 5, 18, 'ita', 2); c.VL(30, 4, 20, 'ita', 1)
    for x, y, w, h, m in ((4, 7, 6, 7, 'shiro'), (11, 6, 6, 5, 'kii'), (18, 8, 8, 6, 'shiro'), (6, 15, 5, 5, 'pinku'), (13, 13, 6, 7, 'sora'), (21, 16, 6, 4, 'midori')):
        c.R(x, y, w, h, m, 4 if m in ('shiro', 'kii') else 3); c.HL(x, y + h - 1, w, m, 1 if m != 'shiro' else 2)
        for j in range(y + 2, y + h - 1, 2): c.HL(x + 1, j, w - 2, 'conc', 3 if m == 'shiro' else 2) if w > 4 else None
        c.P(x + w // 2, y, 'aka', 3)
    c.HL(1, 22, 30, 'ita', 2); c.HL(1, 23, 30, 'sumi', 1); c.VL(0, 3, 21, 'sumi', 1); c.VL(31, 3, 21, 'sumi', 1)


@art('mc-eye-chart')
def _(c):
    c.R(2, 3, 12, 20, 'shiro', 4); c.HL(2, 3, 12, 'shiro', 3); c.VL(13, 3, 20, 'shiro', 2)
    for k, (w, y) in enumerate(((6, 6), (5, 9), (4, 12), (3, 15), (2, 18), (2, 20))):
        x0 = 8 - w // 2 - 1
        for i in range(0, w * 2, 2): c.P(x0 + i // 1 if i < 8 else x0 + i, y, 'yoru', 1)
    c.R(4, 6, 1, 1, 'aka', 3)
    c.HL(2, 23, 12, 'sumi', 1); c.VL(1, 3, 21, 'sumi', 1); c.VL(14, 3, 21, 'sumi', 1); c.HL(2, 2, 12, 'sumi', 1)


@art('mc-window-class')
def _(c):
    # 알루미늄 미닫이 창 2짝 + 하늘(위 밝게) + 창틀 아래 창턱 윗면(3행)
    c.HL(0, 1, 32, 'sumi', 1); c.R(0, 2, 32, 2, 'conc', 5)
    for y in range(4, 22):
        for x in range(1, 31):
            t = 4 if y < 9 else 3 if y < 16 else 2
            if (x + y) % 9 in (0, 1) and y > 4: t += 2
            c.P(x, y, 'garasu', min(6, t))
    c.R(4, 6, 6, 2, 'shiro', 4); c.R(6, 5, 3, 1, 'shiro', 4); c.R(20, 8, 5, 2, 'shiro', 3)      # 구름
    for x in (0, 15, 16, 31): c.VL(x, 2, 20, 'conc', 5 if x in (0, 16) else 3)
    c.HL(1, 12, 30, 'conc', 5)
    c.HL(0, 22, 32, 'conc', 6); c.HL(0, 23, 32, 'conc', 5); c.HL(0, 24, 32, 'conc', 3); c.HL(0, 25, 32, 'sumi', 1)
    c.VL(0, 1, 25, 'sumi', 1); c.VL(31, 1, 25, 'sumi', 1)


# ═══════════════ 교실·강의실 ═══════════════
@art('mc-desk-pair')
def _(c):
    # 의자 등받이 둘(뒤) + 책상 둘(밝은 합판 윗면 6행, 쇠 다리, 앞판)
    for k in range(2):
        x = 1 + k * 16
        c.R(x + 3, 0, 8, 2, 'yuka', 3); c.HL(x + 3, 0, 8, 'yuka', 4); c.HL(x + 2, 0, 1, 'sumi', 1); c.P(x + 11, 0, 'sumi', 1)
        y1 = furn(c, x, 2, 14, 11, 6, 'yuka', tt=4, ft=2, grain='wood')
        c.R(x + 2, y1 + 1, 10, 3, 'tekko', 2); c.HL(x + 2, y1 + 1, 10, 'tekko', 1)            # 책상 속 서랍칸(어둠)
        c.VL(x + 1, 13, 2, 'tekko', 4); c.VL(x + 12, 13, 2, 'tekko', 2); c.HL(x + 1, 15, 2, 'sumi', 1); c.HL(x + 11, 15, 2, 'sumi', 1)
    paper(c, 4, 4, 5, 3); c.R(21, 3, 6, 3, 'sora', 3); c.HL(21, 3, 6, 'sora', 4); c.VL(23, 3, 3, 'shiro', 4)   # 공책·교과서
    c.P(11, 5, 'kii', 4); c.P(12, 5, 'kii', 2)


@art('mc-lecture-bench')
def _(c):
    # 3인 긴 책상(앞판이 막힌 강의실 책상) + 뒤 의자 등받이 셋
    for k in range(3): c.R(4 + k * 15, 0, 10, 2, 'kon', 3); c.HL(4 + k * 15, 0, 10, 'kon', 4)
    y1 = furn(c, 0, 2, 48, 12, 6, 'yuka', tt=4, ft=2, grain='wood')
    for k in range(3):
        c.R(2 + k * 15 + 2, y1 + 1, 11, 3, 'yuka', 1)
    c.VL(16, y1, 6, 'yuka', 1); c.VL(32, y1, 6, 'yuka', 1)
    laptop(c, 5, 3, True); paper(c, 21, 4, 5, 3); c.R(36, 4, 5, 3, 'aka', 3); c.HL(36, 4, 5, 'aka', 4)
    c.HL(1, 15, 46, 'yoru', 1)


@art('mc-lectern')
def _(c):
    # 경사진 윗판(넓게 밝게 보이는 윗면 6행) + 앞 나무판 + 받침
    c.HL(1, 8, 14, 'sumi', 1)
    for j in range(6):
        c.HL(1, 9 + j, 14, 'ita', 5 if j < 2 else 4)
    c.HL(1, 14, 14, 'ita', 6); paper(c, 4, 10, 6, 3)
    c.R(2, 15, 12, 15, 'ita', 3); c.VL(2, 15, 15, 'ita', 4); c.VL(13, 15, 15, 'ita', 1); c.HL(2, 15, 12, 'ita', 1)
    panel(c, 4, 18, 8, 8, 'ita', 3)
    c.R(1, 30, 14, 1, 'ita', 2); c.HL(1, 31, 14, 'sumi', 1); c.VL(1, 15, 16, 'sumi', 1); c.VL(14, 15, 16, 'sumi', 1); c.VL(0, 8, 8, 'sumi', 1); c.VL(15, 8, 8, 'sumi', 1)


@art('mc-cabinet-glass')
def _(c):
    # 교재장: 윗면 6행 + 위 유리문(선반·책) + 아래 나무문
    y1 = furn(c, 0, 0, 32, 32, 6, 'yuka', tt=4, ft=2, grain='wood')
    c.P(6, 2, 'midori', 3); plant(c, 24, 0)
    for k in range(2):
        x = 2 + k * 14
        c.R(x, y1 + 1, 13, 12, 'yuka', 1)
        books(c, x + 1, y1 + 2, 11, 5, k); c.HL(x, y1 + 7, 13, 'yuka', 3); books(c, x + 1, y1 + 8, 11, 4, k + 5)
        for j in range(12):
            for i in range(13):
                if (i + j) % 8 == 0: c.P(x + i, y1 + 1 + j, 'garasu', 6)
        c.R(x, y1 + 1, 1, 12, 'yuka', 3); c.VL(x + 12, y1 + 1, 12, 'yuka', 1)
        panel(c, x + 1, y1 + 14, 11, 6, 'yuka', 2); c.P(x + (10 if k == 0 else 2), y1 + 16, 'tekko', 5)
    c.VL(16, y1, 26 - 6, 'yuka', 1)


@art('mc-pc-cart')
def _(c):
    # 노트북 충전 카트: 윗면(손잡이) + 철 몸통 + 칸에 꽂힌 노트북 + 바퀴
    y1 = furn(c, 1, 8, 14, 22, 6, 'tekko', tt=5, ft=3, grain='steel')
    c.HL(3, 9, 10, 'tekko', 2); c.HL(3, 10, 10, 'tekko', 6)
    c.R(3, y1 + 1, 10, 12, 'tekko', 1)
    for k in range(5): c.VL(4 + k * 2, y1 + 2, 10, ('tekko', 'kon', 'tekko', 'yoru', 'tekko')[k], 4 if k % 2 == 0 else 3)
    for k in range(5): c.P(4 + k * 2, y1 + 3, 'neonC', 1)
    c.R(2, 30, 3, 2, 'yoru', 1); c.R(11, 30, 3, 2, 'yoru', 1)


@art('mc-chair-stack')
def _(c):
    # 쌓은 의자 셋: 앉는 판 윗면(밝게)이 세 겹, 쇠 다리
    for k in range(3):
        y = 9 + k * 5
        c.HL(2, y, 12, 'sumi', 1)
        c.R(2, y + 1, 12, 3, 'yuka', 4); c.HL(2, y + 1, 12, 'yuka', 4); c.HL(2, y + 3, 12, 'yuka', 2)
        c.VL(1, y, 5, 'sumi', 1); c.VL(14, y, 5, 'sumi', 1)
        c.P(3, y + 4, 'tekko', 4); c.P(12, y + 4, 'tekko', 2)
    c.R(3, 4, 10, 5, 'yuka', 3); c.HL(3, 4, 10, 'yuka', 4); c.HL(2, 3, 12, 'sumi', 1)
    c.VL(3, 24, 6, 'tekko', 4); c.VL(12, 24, 6, 'tekko', 2); c.HL(2, 30, 3, 'sumi', 1); c.HL(11, 30, 3, 'sumi', 1)


def open_bin(c, cx, top, rx, ry, h, mat, liner=None):
    """위에서 아가리가 보이는 원통 통: 테(밝게) + 안쪽(어둡게, 4행 이상) + 몸통."""
    c.R(int(cx - rx), top, int(rx * 2), h, mat, 2)
    for x in range(int(cx - rx), int(cx + rx)):
        t = 3 if x < cx - rx * 0.4 else 2 if x < cx + rx * 0.4 else 1
        c.VL(x, top, h, mat, t)
    c.ell(cx, top, rx, ry, lambda x, y, dx, dy, d: (mat, 4 if dy < 0 else 3) if d > 0.55 else (liner or (mat, 0)))
    c.ell(cx, top + 0.6, rx * 0.7, ry * 0.6, lambda x, y, dx, dy, d: (liner[0], liner[1] - 1) if liner and dy > 0.3 else None)
    c.HL(int(cx - rx) + 1, top + h, int(rx * 2) - 2, 'sumi', 1)
    for y in range(int(top - ry - 1), top + h):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 1):
            if c.on(x, y) and (not c.on(x - 1, y) or not c.on(x + 1, y) or not c.on(x, y - 1)): c.P(x, y, 'sumi', 1)


@art('mc-trash-bin')
def _(c):
    open_bin(c, 8, 5, 5.5, 3.6, 9, 'sora', liner=('yoru', 2))
    paper(c, 6, 4, 3, 2)


@art('mc-bin-wide')
def _(c):
    open_bin(c, 8, 5, 6.5, 4, 9, 'kokuban', liner=('yoru', 1))
    c.P(6, 4, 'shiro', 4); c.P(7, 4, 'shiro', 3); c.P(10, 5, 'kii', 3)


@art('mc-umbrella-stand')
def _(c):
    open_bin(c, 8, 6, 5.5, 3.4, 8, 'tekko', liner=('yoru', 1))
    for x, m, h in ((6, 'kon', 7), (8, 'aka', 9), (10, 'midori', 6)):
        c.VL(x, 7 - h, h, m, 3); c.P(x, 7 - h, m, 4); c.P(x - 1, 7 - h, 'tekko', 4)
    for y in range(9, 14, 2): c.HL(3, y, 10, 'tekko', 5)


# ═══════════════ 복도·현관 ═══════════════
@art('mc-hall-locker')
def _(c):
    # 철 사물함 2×3: 윗면 6행(쇠 결) + 칸 문(환기 구멍·손잡이·이름표 자리)
    y1 = furn(c, 0, 0, 32, 32, 6, 'tairu', tt=5, ft=3, grain='steel')
    c.R(5, 2, 6, 2, 'kii', 3); c.HL(5, 2, 6, 'kii', 4)                       # 위에 얹은 상자
    for k in range(3):
        for r in range(2):
            x = 2 + k * 10; y = y1 + 1 + r * 12
            c.R(x, y, 9, 11, 'tairu', 3); c.HL(x, y, 9, 'tairu', 4); c.VL(x, y, 11, 'tairu', 4); c.VL(x + 8, y, 11, 'tairu', 2); c.HL(x, y + 10, 9, 'tairu', 1)
            for j in range(3): c.HL(x + 2, y + 2 + j * 2, 5, 'tairu', 1)
            c.R(x + 6, y + 7, 2, 2, 'tekko', 5); c.R(x + 2, y + 8, 3, 1, 'shiro', 3)


@art('mc-locker-bench')
def _(c):
    y1 = furn(c, 0, 3, 32, 9, 6, 'ita', tt=5, ft=3, grain='wood')
    for x in (3, 26):
        c.R(x, 12, 3, 3, 'tekko', 4); c.VL(x + 2, 12, 3, 'tekko', 2); c.HL(x, 15, 3, 'sumi', 1)
    c.HL(1, 13, 30, 'yoru', 1) if False else None


@art('mc-shoe-rack-low')
def _(c):
    # 실내화 선반(2단): 윗면 6행 + 칸 둘 × 실내화 짝
    y1 = furn(c, 0, 8, 32, 24, 6, 'yuka', tt=4, ft=2, grain='wood')
    for r in range(2):
        y = y1 + 1 + r * 8
        c.R(2, y, 28, 7, 'yuka', 0)
        for k in range(4):
            x = 3 + k * 7
            m = ('shiro', 'shiro', 'sora', 'shiro')[k]
            c.R(x, y + 3, 5, 3, m, 4 if m == 'shiro' else 3); c.HL(x, y + 3, 5, m, 4 if m != 'shiro' else 3)
            c.HL(x, y + 5, 5, ('aka', 'kon', 'midori', 'aka')[k], 2)
        c.HL(1, y + 7, 30, 'yuka', 3)
    c.R(4, 10, 6, 2, 'shiro', 4); c.HL(4, 12, 6, 'aka', 2)


@art('mc-water-fountain')
def _(c):
    # 스테인리스 음수대: 넓은 윗판에 대야(아가리 4행) + 몸통 + 페달
    c.HL(0, 8, 16, 'sumi', 1)
    c.R(0, 9, 16, 9, 'tekko', 5); c.HL(0, 9, 16, 'tekko', 3); c.HL(1, 10, 14, 'tekko', 6)
    c.ell(8, 13.5, 5.5, 3.2, lambda x, y, dx, dy, d: ('tekko', 2 if dy < 0.2 else 3) if d < 0.7 else ('tekko', 6))
    c.P(8, 13, 'sora', 4); c.P(8, 12, 'tekko', 6); c.HL(0, 17, 16, 'tekko', 6)
    c.R(1, 18, 14, 12, 'tekko', 3); c.VL(1, 18, 12, 'tekko', 4); c.VL(14, 18, 12, 'tekko', 1); c.HL(1, 18, 14, 'tekko', 2)
    for j in range(20, 28, 2): c.HL(3, j, 10, 'tekko', 2)
    c.R(5, 28, 6, 2, 'yoru', 2); c.HL(1, 30, 14, 'tekko', 2); c.HL(0, 31, 16, 'sumi', 1)
    c.VL(0, 8, 24, 'sumi', 1); c.VL(15, 8, 24, 'sumi', 1)


@art('mc-fire-cabinet')
def _(c):
    y1 = furn(c, 1, 0, 14, 32, 6, 'aka', tt=3, ft=2)
    c.R(3, y1 + 1, 10, 22, 'aka', 2); c.HL(3, y1 + 1, 10, 'aka', 3); c.VL(3, y1 + 1, 22, 'aka', 3); c.VL(12, y1 + 1, 22, 'aka', 1)
    c.R(4, y1 + 3, 8, 8, 'garasu', 2); c.R(6, y1 + 4, 4, 6, 'aka', 3); c.HL(6, y1 + 4, 4, 'tekko', 4)   # 유리창 속 소화기
    c.HL(3, y1 + 13, 10, 'shiro', 4); c.HL(3, y1 + 14, 10, 'shiro', 3)
    c.R(10, y1 + 17, 2, 3, 'tekko', 5)


@art('mc-vending-in')
def _(c):
    y1 = furn(c, 0, 0, 16, 32, 6, 'shiro', tt=4, ft=2)
    c.R(2, 2, 4, 2, 'aka', 3); c.R(9, 2, 4, 2, 'sora', 3)                     # 위에 얹은 상자
    c.R(1, y1, 14, 26, 'sora', 2); c.VL(1, y1, 26, 'sora', 3); c.VL(14, y1, 26, 'sora', 1); c.HL(1, y1, 14, 'sora', 1)
    c.R(3, y1 + 2, 10, 12, 'shiro', 4)
    for r in range(3):
        for k in range(4):
            m = ('aka', 'kii', 'midori', 'daidai', 'sora')[(r + k) % 5]
            c.R(4 + k * 2, y1 + 3 + r * 4, 1, 3, m, 3); c.P(4 + k * 2, y1 + 3 + r * 4, m, 4)
        c.HL(3, y1 + 6 + r * 4, 10, 'shiro', 2)
    c.R(3, y1 + 16, 6, 2, 'yoru', 2); c.R(11, y1 + 16, 2, 3, 'shiro', 3)
    c.R(3, y1 + 21, 10, 3, 'yoru', 1)


@art('mc-bulletin-stand')
def _(c):
    # 이동식 게시판: 두꺼운 틀 윗면(4행) + 코르크 판 + A자 다리(바퀴)
    c.HL(1, 0, 30, 'sumi', 1); c.R(1, 1, 30, 4, 'tekko', 5); c.HL(1, 1, 30, 'tekko', 3); c.HL(2, 2, 28, 'tekko', 6)
    c.R(1, 5, 30, 16, 'tekko', 3)
    for y in range(6, 20):
        for x in range(3, 29): c.P(x, y, 'yuka', 3 if rnd(x, y, 3) > 0.2 else 2)
    for x, y, w, h, m in ((4, 7, 7, 6, 'shiro'), (13, 8, 6, 8, 'kii'), (21, 7, 6, 5, 'pinku'), (21, 14, 6, 5, 'shiro')):
        c.R(x, y, w, h, m, 4 if m in ('shiro', 'kii') else 3); c.HL(x, y + h - 1, w, m, 2)
    c.HL(1, 21, 30, 'sumi', 1); c.VL(0, 0, 22, 'sumi', 1); c.VL(31, 0, 22, 'sumi', 1)
    c.line(6, 22, 3, 29, 'tekko', 4); c.line(25, 22, 28, 29, 'tekko', 2); c.HL(4, 26, 24, 'tekko', 3)
    c.R(2, 29, 3, 2, 'yoru', 1); c.R(27, 29, 3, 2, 'yoru', 1)


@art('mc-toilet-stall')
def _(c):
    # 칸막이 칸: 위 가로틀 윗면(5행) + 문(닫힘, 표시 손잡이) + 아래 틈
    c.HL(0, 0, 16, 'sumi', 1); c.R(0, 1, 16, 5, 'lino', 4); c.HL(0, 1, 16, 'lino', 2); c.HL(1, 2, 14, 'lino', 4)
    c.R(0, 6, 16, 22, 'lino', 2); c.VL(0, 6, 22, 'lino', 3); c.VL(15, 6, 22, 'lino', 1); c.HL(0, 6, 16, 'lino', 1)
    panel(c, 2, 8, 12, 18, 'lino', 3)
    c.R(11, 16, 2, 2, 'aka', 3)
    c.R(0, 28, 16, 3, 'lino', 1); c.VL(0, 28, 3, 'tekko', 4); c.VL(15, 28, 3, 'tekko', 2); c.HL(0, 31, 16, 'sumi', 1)
    c.VL(0, 0, 32, 'sumi', 1); c.VL(15, 0, 32, 'sumi', 1)


@art('mc-stall-block')
def _(c):
    # 칸막이 2칸 묶음(낮은 문 + 윗 틀): 틀 윗면 + 문 둘
    c.HL(0, 8, 32, 'sumi', 1); c.R(0, 9, 32, 5, 'lino', 4); c.HL(0, 9, 32, 'lino', 2); c.HL(1, 10, 30, 'lino', 4)
    for k in range(2):
        x = k * 16
        c.R(x, 14, 16, 14, 'lino', 2); c.VL(x, 14, 14, 'lino', 3); c.VL(x + 15, 14, 14, 'lino', 1)
        panel(c, x + 2, 15, 12, 11, 'lino', 3); c.R(x + 11, 19, 2, 2, ('midori', 'aka')[k], 3)
    c.R(0, 28, 32, 3, 'lino', 1); c.HL(0, 31, 32, 'sumi', 1); c.VL(0, 8, 24, 'sumi', 1); c.VL(31, 8, 24, 'sumi', 1); c.VL(16, 9, 20, 'sumi', 1)


@art('mc-sink-vanity')
def _(c):
    # 세면대 2구: 넓은 흰 상판(대야 아가리 둘 + 수도꼭지) + 아래 수납문 + 위 거울 아님(벽걸이 따로)
    c.HL(0, 8, 32, 'sumi', 1)
    c.R(0, 9, 32, 9, 'shiro', 4); c.HL(0, 9, 32, 'shiro', 2); c.HL(1, 10, 30, 'shiro', 4)
    for bx in (8, 24):
        c.ell(bx, 14, 5.5, 3, lambda x, y, dx, dy, d: ('shiro', 1 if dy < 0 else 2) if d < 0.7 else ('shiro', 4))
        c.P(bx, 14, 'conc', 2); c.R(bx - 1, 10, 3, 2, 'tekko', 5); c.P(bx, 12, 'tekko', 3)
    c.HL(0, 17, 32, 'shiro', 4)
    c.R(0, 18, 32, 12, 'lino', 3); c.VL(0, 18, 12, 'lino', 4); c.VL(31, 18, 12, 'lino', 1); c.HL(0, 18, 32, 'lino', 1)
    for k in range(2): panel(c, 2 + k * 15, 20, 13, 9, 'lino', 3); c.R(13 + k * 15 - (10 if k else 0), 24, 1, 2, 'tekko', 5)
    c.HL(0, 31, 32, 'sumi', 1); c.VL(0, 8, 24, 'sumi', 1); c.VL(31, 8, 24, 'sumi', 1)


@art('mc-clean-cart')
def _(c):
    # 청소 카트: 노랑 통(아가리 보임) + 대걸레 자루 + 바퀴
    c.VL(12, 8, 14, 'ita', 4); c.VL(13, 8, 14, 'ita', 2); c.R(11, 7, 3, 2, 'shiro', 4)
    open_bin(c, 7, 18, 6, 3.2, 9, 'kii', liner=('sora', 2))
    c.R(1, 28, 14, 2, 'tekko', 3); c.R(2, 30, 3, 2, 'yoru', 1); c.R(11, 30, 3, 2, 'yoru', 1)


@art('mc-cleaning-wagon')
def _(c):
    y1 = furn(c, 0, 8, 32, 22, 7, 'kii', tt=4, ft=2)
    open_bin(c, 9, 12, 6, 2.6, 4, 'sora', liner=('sora', 1))
    c.R(19, 10, 9, 4, 'kon', 3); c.HL(19, 10, 9, 'kon', 4); c.R(20, 9, 2, 1, 'ita', 4)     # 솔·걸레
    c.R(2, y1 + 2, 28, 8, 'kii', 1); c.R(4, y1 + 3, 6, 6, 'shiro', 3); c.R(12, y1 + 4, 5, 5, 'midori', 3); c.R(20, y1 + 3, 7, 6, 'sora', 2)
    c.R(2, 30, 4, 2, 'yoru', 1); c.R(26, 30, 4, 2, 'yoru', 1)


# ═══════════════ 급식실 ═══════════════
@art('mc-cafe-table')
def _(c):
    y1 = furn(c, 0, 1, 48, 13, 8, 'shiro', tt=4, ft=2)
    for k in range(4):
        x = 3 + k * 11
        c.R(x, 3, 8, 5, 'tekko', 5); c.HL(x, 3, 8, 'tekko', 6); c.HL(x, 7, 8, 'tekko', 3)          # 식판
        c.R(x + 1, 4, 3, 2, 'shiro', 4); c.R(x + 5, 4, 2, 2, 'daidai', 3); c.R(x + 1, 6, 6, 1, 'midori', 3)
    c.R(2, y1 + 1, 44, 2, 'shiro', 1)
    for x in (2, 44): c.R(x, 14, 2, 2, 'tekko', 3)


@art('mc-cafe-table-2')
def _(c):
    for k in range(2): c.R(4 + k * 16, 0, 8, 2, 'daidai', 3); c.HL(4 + k * 16, 0, 8, 'daidai', 4)
    y1 = furn(c, 0, 2, 32, 12, 7, 'shiro', tt=4, ft=2)
    for k in range(2):
        x = 3 + k * 15
        c.R(x, 4, 10, 4, 'tekko', 5); c.HL(x, 4, 10, 'tekko', 6); c.R(x + 1, 5, 3, 2, 'shiro', 4); c.R(x + 5, 5, 4, 2, 'aka', 3)
    for x in (2, 28): c.R(x, 14, 2, 2, 'tekko', 3)


@art('mc-serving-counter')
def _(c):
    # 배식대: 스테인리스 상판(보온통 셋 — 뚜껑 연 아가리) + 아래 철판 + 유리 칸막이 위 선
    c.HL(0, 8, 48, 'sumi', 1)
    c.R(0, 9, 48, 9, 'tekko', 5); c.HL(0, 9, 48, 'tekko', 3); c.HL(1, 10, 46, 'tekko', 6)
    fills = (('daidai', 3), ('kinari', 4), ('midori', 3))
    for k, f in enumerate(fills):
        x = 3 + k * 15
        c.R(x, 11, 12, 6, 'tekko', 2); c.R(x + 1, 12, 10, 4, *f); c.HL(x + 1, 12, 10, f[0], f[1] + 1)
        c.P(x + 3, 13, f[0], f[1] - 1); c.P(x + 7, 14, f[0], f[1] - 1)
    c.HL(0, 17, 48, 'tekko', 6)
    c.R(0, 18, 48, 12, 'tekko', 3); c.VL(0, 18, 12, 'tekko', 4); c.VL(47, 18, 12, 'tekko', 1); c.HL(0, 18, 48, 'tekko', 2)
    for k in range(3): panel(c, 2 + k * 15, 20, 14, 8, 'tekko', 3)
    c.HL(0, 31, 48, 'sumi', 1); c.VL(0, 8, 24, 'sumi', 1); c.VL(47, 8, 24, 'sumi', 1)


@art('mc-tray-cart')
def _(c):
    y1 = furn(c, 1, 8, 14, 22, 7, 'tekko', tt=5, ft=3, grain='steel')
    for k in range(3):
        c.HL(2, 9 + k, 12, 'tekko', 6 if k == 0 else 4)                      # 식판 더미(위)
    c.R(3, y1 + 1, 10, 13, 'tekko', 1)
    for k in range(4): c.HL(3, y1 + 2 + k * 3, 10, 'tekko', 5); c.HL(3, y1 + 3 + k * 3, 10, 'tekko', 3)
    c.R(2, 30, 3, 2, 'yoru', 1); c.R(11, 30, 3, 2, 'yoru', 1)


@art('mc-cafe-stool')
def _(c):
    c.ell(8, 6, 6, 4, lambda x, y, dx, dy, d: ('daidai', 4 if dx + dy < -0.2 else 3) if d < 0.75 else ('daidai', 2))
    c.R(7, 9, 2, 5, 'tekko', 4); c.VL(8, 9, 5, 'tekko', 2)
    c.ell(8, 14, 4, 1.5, lambda x, y, dx, dy, d: ('tekko', 3))
    for y in range(1, 11):
        for x in range(1, 15):
            if c.on(x, y) and (not c.on(x - 1, y) or not c.on(x + 1, y) or not c.on(x, y - 1)): c.P(x, y, 'sumi', 1)


@art('mc-fridge-counter')
def _(c):
    y1 = furn(c, 0, 8, 32, 24, 7, 'tekko', tt=5, ft=3, grain='steel')
    c.R(3, 9, 12, 5, 'shiro', 4); c.HL(3, 9, 12, 'shiro', 3); c.R(4, 10, 6, 3, 'yoru', 2); c.R(11, 10, 3, 3, 'tekko', 4)   # 전자레인지 윗면+앞
    c.R(19, 10, 8, 4, 'daidai', 3); c.HL(19, 10, 8, 'daidai', 4)
    for k in range(2):
        x = 2 + k * 15
        panel(c, x, y1 + 1, 13, 14, 'tekko', 4); c.VL(x + (11 if k == 0 else 1), y1 + 4, 7, 'tekko', 6)
    c.HL(1, 30, 30, 'tekko', 2)


@art('mc-vending-low')
def _(c):
    y1 = furn(c, 0, 8, 32, 24, 7, 'sora', tt=3, ft=2)
    for k, m in enumerate(('aka', 'kii', 'midori', 'sora')):
        c.R(4 + k * 6, 10, 3, 3, m, 3); c.HL(4 + k * 6, 10, 3, m, 4)       # 위 상자·병
    for k in range(2):
        x = 2 + k * 15
        c.R(x, y1 + 1, 13, 9, 'shiro', 4)
        for r in range(2):
            for i in range(5):
                m = ('aka', 'kii', 'midori', 'daidai', 'sora')[(i + r + k) % 5]
                c.R(x + 1 + i * 2 + (0 if i < 5 else 0), y1 + 2 + r * 4, 1, 3, m, 3)
            c.HL(x, y1 + 5 + r * 4, 13, 'shiro', 2)
        c.R(x + 3, y1 + 11, 7, 3, 'yoru', 1)


# ═══════════════ 도서관 ═══════════════
@art('mc-carrel')
def _(c):
    # 칸막이 책상 2칸: 뒤·가운데 칸막이 판(윗면 2행) + 책상 윗면 + 스탠드·책
    c.HL(0, 8, 32, 'sumi', 1); c.R(0, 9, 32, 2, 'ita', 5); c.R(0, 11, 32, 5, 'ita', 3); c.HL(0, 15, 32, 'ita', 1)
    c.R(15, 9, 2, 12, 'ita', 4); c.VL(16, 9, 12, 'ita', 2)
    y1 = furn(c, 0, 16, 32, 16, 6, 'ita', tt=5, ft=3, grain='wood', back=False)
    lamp(c, 3, 10); lamp(c, 19, 10)
    c.R(8, 17, 5, 3, 'aka', 3); c.HL(8, 17, 5, 'aka', 4); paper(c, 22, 17, 6, 3)
    c.R(3, y1 + 2, 26, 4, 'ita', 1); c.VL(16, y1, 10, 'ita', 1)
    c.VL(0, 8, 24, 'sumi', 1); c.VL(31, 8, 24, 'sumi', 1)


@art('mc-book-cart')
def _(c):
    y1 = furn(c, 1, 8, 14, 22, 6, 'ita', tt=5, ft=3, grain='wood')
    books(c, 3, 9, 10, 4, 3)
    c.R(3, y1 + 1, 10, 6, 'ita', 1); books(c, 3, y1 + 2, 10, 5, 7); c.HL(2, y1 + 7, 12, 'ita', 4)
    c.R(3, y1 + 8, 10, 6, 'ita', 1); books(c, 3, y1 + 9, 10, 5, 9)
    c.R(2, 30, 3, 2, 'yoru', 1); c.R(11, 30, 3, 2, 'yoru', 1)


@art('mc-book-trolley')
def _(c):
    y1 = furn(c, 0, 8, 32, 22, 7, 'ita', tt=5, ft=3, grain='wood')
    for k, (x, n) in enumerate(((3, 11), (17, 12))):
        c.R(x, 9, n, 4, 'ita', 2); books(c, x, 9, n, 4, k + 11)
    c.R(2, y1 + 1, 28, 6, 'ita', 1); books(c, 3, y1 + 2, 26, 5, 21)
    c.HL(1, y1 + 7, 30, 'ita', 4); c.R(2, y1 + 8, 28, 5, 'ita', 1); books(c, 3, y1 + 9, 26, 4, 23)
    c.R(2, 30, 4, 2, 'yoru', 1); c.R(26, 30, 4, 2, 'yoru', 1)


@art('mc-catalog-drawers')
def _(c):
    y1 = furn(c, 0, 0, 16, 32, 6, 'ita', tt=5, ft=3, grain='wood')
    paper(c, 3, 2, 5, 2); c.R(10, 2, 3, 3, 'kii', 3)
    for r in range(4):
        for k in range(3):
            x = 2 + k * 4; y = y1 + 1 + r * 6
            c.R(x, y, 4, 5, 'ita', 4); c.HL(x, y, 4, 'ita', 5); c.HL(x, y + 4, 4, 'ita', 1); c.VL(x + 3, y, 5, 'ita', 2)
            c.P(x + 1, y + 2, 'kii', 4); c.P(x + 2, y + 2, 'shiro', 4)


# ═══════════════ 보건실 ═══════════════
@art('mc-nurse-desk')
def _(c):
    y1 = furn(c, 0, 1, 32, 15, 8, 'shiro', tt=4, ft=2)
    c.R(3, 3, 7, 4, 'shiro', 4); c.HL(3, 3, 7, 'shiro', 3); c.R(5, 4, 3, 2, 'aka', 3)          # 약상자(빨간 십자 대신 띠)
    paper(c, 13, 3, 6, 4); c.R(22, 4, 2, 4, 'sora', 3); mug(c, 26, 3, 'sora')
    drawer(c, 2, y1 + 1, 12, 5, 'shiro', 3); drawer(c, 18, y1 + 1, 12, 5, 'shiro', 3)


@art('mc-aid-cabinet')
def _(c):
    y1 = furn(c, 0, 0, 16, 32, 6, 'shiro', tt=4, ft=2)
    c.R(3, 2, 3, 3, 'sora', 3); c.R(9, 2, 4, 3, 'shiro', 3)
    c.R(2, y1 + 1, 12, 12, 'shiro', 1)
    for j in range(12):
        for i in range(12):
            if (i + j) % 7 == 0: c.P(2 + i, y1 + 1 + j, 'garasu', 6)
    for r in range(2):
        for k in range(4):
            m = ('shiro', 'kinari', 'sora', 'kii')[(k + r) % 4]
            c.R(3 + k * 3, y1 + 2 + r * 6, 2, 4, m, 4 if m in ('shiro', 'kinari') else 3); c.P(3 + k * 3, y1 + 2 + r * 6, 'aka', 3)
        c.HL(2, y1 + 6 + r * 6, 12, 'shiro', 3)
    c.R(2, y1 + 14, 12, 4, 'aka', 3); c.HL(2, y1 + 14, 12, 'aka', 4); c.R(6, y1 + 15, 4, 2, 'shiro', 4)
    c.R(2, y1 + 19, 12, 5, 'shiro', 2); c.P(7, y1 + 21, 'tekko', 5); c.P(8, y1 + 21, 'tekko', 5)


@art('mc-aid-counter')
def _(c):
    y1 = furn(c, 0, 8, 32, 24, 7, 'shiro', tt=4, ft=2)
    for k, m in enumerate(('sora', 'kinari', 'aka', 'shiro', 'kii', 'sora')):
        x = 3 + k * 4
        c.R(x, 10, 3, 4, m, 3 if m not in ('shiro',) else 4); c.HL(x, 10, 3, m, 4); c.HL(x, 9, 3, 'shiro', 4) if k % 2 else None
    c.R(26, 10, 4, 4, 'shiro', 3)
    for k in range(2):
        x = 2 + k * 15
        drawer(c, x, y1 + 1, 13, 6, 'shiro', 3); drawer(c, x, y1 + 8, 13, 7, 'shiro', 3)


# ═══════════════ 기숙사 ═══════════════
@art('mc-dorm-bed')
def _(c):
    # 침대 1×2: 머리판(위, 윗면) + 흰 베개 + 남색 이불(주름, 위에서 본 면 넓게) + 앞 발판
    c.HL(0, 6, 16, 'sumi', 1); c.R(0, 7, 16, 4, 'ita', 5); c.HL(0, 7, 16, 'ita', 4); c.HL(0, 10, 16, 'ita', 3)
    c.R(0, 11, 16, 31, 'ita', 3)
    c.R(1, 11, 14, 29, 'shiro', 3)
    c.R(3, 12, 10, 6, 'shiro', 4); c.HL(3, 17, 10, 'shiro', 2); c.HL(3, 12, 10, 'shiro', 4); c.P(3, 12, 'shiro', 3); c.P(12, 12, 'shiro', 3)
    for y in range(19, 40):
        for x in range(1, 15):
            t = 3 if x < 5 else 2
            if (y - 19) % 7 == 0 and 2 < x < 13: t = 1
            if y == 19: t = 4
            c.P(x, y, 'kon', t)
    c.HL(1, 19, 14, 'shiro', 4)                                           # 이불 접은 흰 끝
    c.VL(1, 20, 20, 'kon', 4); c.VL(14, 20, 20, 'kon', 1)
    c.R(0, 40, 16, 6, 'ita', 3); c.HL(0, 40, 16, 'ita', 5); c.HL(0, 41, 16, 'ita', 4); c.HL(0, 45, 16, 'ita', 1)
    c.HL(0, 46, 16, 'yoru', 1); c.HL(0, 47, 16, 'sumi', 1)
    c.VL(0, 6, 41, 'sumi', 1); c.VL(15, 6, 41, 'sumi', 1)


@art('mc-dorm-desk')
def _(c):
    # 책상 + 위 선반(벽 앞에 솟음): 선반 윗면 + 책 + 책상 윗면(노트북·스탠드) + 서랍
    c.HL(1, 0, 30, 'sumi', 1); c.R(1, 1, 30, 3, 'yuka', 4); c.HL(1, 1, 30, 'yuka', 3); c.R(1, 4, 30, 1, 'yuka', 2)
    c.R(2, 5, 28, 7, 'yuka', 1); books(c, 3, 5, 14, 7, 31); plant(c, 24, 5)
    c.VL(1, 4, 9, 'yuka', 3); c.VL(30, 4, 9, 'yuka', 1); c.VL(0, 0, 13, 'sumi', 1); c.VL(31, 0, 13, 'sumi', 1)
    y1 = furn(c, 0, 12, 32, 20, 8, 'yuka', tt=4, ft=2, grain='wood', back=False)
    laptop(c, 4, 13, True); lamp(c, 25, 12); mug(c, 15, 15, 'kii'); paper(c, 18, 15, 5, 3)
    drawer(c, 20, y1 + 1, 10, 4, 'yuka', 3); drawer(c, 20, y1 + 6, 10, 5, 'yuka', 3)
    c.R(3, y1 + 1, 14, 9, 'yuka', 0); c.R(5, y1 + 4, 10, 3, 'kon', 2); c.HL(5, y1 + 4, 10, 'kon', 3)   # 의자 넣은 빈 칸


@art('mc-dorm-wardrobe')
def _(c):
    y1 = furn(c, 0, 0, 16, 32, 6, 'yuka', tt=4, ft=2, grain='wood')
    c.R(3, 1, 9, 3, 'kon', 3); c.HL(3, 1, 9, 'kon', 4)                        # 위에 얹은 가방
    for k in range(2):
        x = 2 + k * 6
        panel(c, x, y1 + 1, 6, 22, 'yuka', 2)
        c.VL(x + (5 if k == 0 else 0), y1 + 9, 4, 'tekko', 5)
    c.VL(8, y1, 24, 'yuka', 0)


@art('mc-mini-fridge')
def _(c):
    y1 = furn(c, 1, 8, 14, 24, 7, 'tekko', tt=5, ft=3, grain='steel')
    mug(c, 4, 10, 'aka'); c.R(9, 10, 3, 3, 'midori', 3)
    c.HL(2, y1 + 5, 12, 'tekko', 1)
    c.VL(12, y1 + 1, 3, 'tekko', 6); c.VL(12, y1 + 7, 5, 'tekko', 6)


@art('mc-dorm-dresser')
def _(c):
    y1 = furn(c, 0, 8, 32, 24, 7, 'yuka', tt=4, ft=2, grain='wood')
    plant(c, 3, 8); c.R(12, 10, 6, 3, 'pinku', 3); c.HL(12, 10, 6, 'pinku', 4); c.R(22, 9, 6, 4, 'shiro', 3); c.R(23, 10, 4, 2, 'garasu', 4)
    for r in range(3): drawer(c, 2, y1 + 1 + r * 5, 28, 5, 'yuka', 3)


@art('mc-lounge-sofa')
def _(c):
    # 2인 소파(남쪽을 봄): 등받이 윗면(어두운 남색, 뒤) · 방석 둘 윗면(밝게, 넓게) · 팔걸이 윗면 · 앞면(어둡게) · 나무 다리
    c.HL(3, 8, 26, 'sumi', 1); c.R(3, 9, 26, 4, 'kon', 2); c.HL(3, 9, 26, 'kon', 3); c.HL(3, 12, 26, 'kon', 1)
    for x0 in (0, 27):
        c.HL(x0, 11, 5, 'sumi', 1); c.R(x0, 12, 5, 6, 'kon', 3); c.HL(x0, 12, 5, 'kon', 4); c.R(x0, 18, 5, 9, 'kon', 1); c.HL(x0, 18, 5, 'kon', 0)
        c.VL(x0, 11, 16, 'sumi', 1); c.VL(x0 + 4, 11, 16, 'sumi', 1)
    for k in range(2):
        x = 5 + k * 11
        c.R(x, 13, 11, 8, 'kon', 3); c.HL(x, 13, 11, 'kon', 4); c.HL(x, 14, 11, 'kon', 4); c.VL(x + 10, 13, 8, 'kon', 2); c.HL(x, 20, 11, 'kon', 2)
    c.R(5, 21, 22, 6, 'kon', 1); c.HL(5, 21, 22, 'kon', 0)
    c.R(7, 10, 5, 4, 'kii', 3); c.HL(7, 10, 5, 'kii', 4); c.HL(7, 13, 5, 'kii', 1)            # 쿠션(등받이에 기댐)
    c.R(2, 27, 2, 3, 'ita', 2); c.R(28, 27, 2, 3, 'ita', 2)
    c.HL(0, 27, 32, 'sumi', 1); c.VL(2, 8, 4, 'sumi', 1); c.VL(29, 8, 4, 'sumi', 1)
    c.HL(4, 30, 24, 'yoru', 1)


@art('mc-low-table')
def _(c):
    y1 = furn(c, 0, 2, 32, 11, 7, 'yuka', tt=4, ft=2, grain='wood')
    c.R(4, 4, 7, 3, 'aka', 3); c.HL(4, 4, 7, 'aka', 4); mug(c, 15, 4, 'shiro'); c.R(22, 4, 6, 3, 'kii', 3); c.HL(22, 4, 6, 'kii', 4)
    for x in (2, 27): c.R(x, 13, 3, 3, 'yuka', 1); c.HL(x, 15, 3, 'sumi', 1)


@art('mc-bean-bag')
def _(c):
    c.ell(8, 8.5, 7, 6, lambda x, y, dx, dy, d: ('kii', 4 if dx + dy < -0.5 else 3 if dx + dy < 0.3 else 2 if d < 0.85 else 1))
    c.ell(7, 6.5, 3.5, 2, lambda x, y, dx, dy, d: ('kii', 2) if d < 0.6 else None)
    c.HL(3, 14, 10, 'yoru', 1)
    for y in range(16):
        for x in range(16):
            if c.on(x, y) and (not c.on(x - 1, y) or not c.on(x + 1, y) or not c.on(x, y - 1) or not c.on(x, y + 1)):
                c.P(x, y, 'sumi', 1) if c.get(x, y)[0] != 'yoru' else None


# ═══════════════ 동아리방·강의실 ═══════════════
@art('mc-club-table')
def _(c):
    y1 = furn(c, 0, 1, 48, 13, 8, 'shiro', tt=3, ft=2)
    laptop(c, 4, 2, True); paper(c, 14, 3, 6, 4); paper(c, 17, 5, 5, 3, 3); c.R(26, 3, 8, 3, 'murasaki', 3); c.HL(26, 3, 8, 'murasaki', 4)
    mug(c, 37, 3, 'daidai'); c.R(41, 4, 4, 3, 'kii', 4)
    for x in (2, 44): c.R(x, 14, 2, 2, 'tekko', 3)


@art('mc-easel-board')
def _(c):
    c.HL(1, 0, 14, 'sumi', 1); c.R(1, 1, 14, 3, 'tekko', 5); c.HL(1, 1, 14, 'tekko', 3)            # 위 틀 윗면
    c.R(1, 4, 14, 15, 'shiro', 4); c.VL(1, 4, 15, 'tekko', 4); c.VL(14, 4, 15, 'tekko', 2)
    c.HL(3, 7, 7, 'sora', 2); c.HL(3, 9, 9, 'sora', 2); c.HL(3, 12, 5, 'aka', 2); c.R(9, 12, 3, 3, 'midori', 2)
    c.HL(1, 19, 14, 'tekko', 6); c.HL(1, 20, 14, 'tekko', 3); c.HL(1, 21, 14, 'sumi', 1)
    c.VL(0, 0, 21, 'sumi', 1); c.VL(15, 0, 21, 'sumi', 1)
    c.line(4, 22, 2, 30, 'tekko', 4); c.line(11, 22, 13, 30, 'tekko', 2); c.line(8, 22, 8, 29, 'tekko', 3)
    c.R(1, 30, 3, 2, 'yoru', 1); c.R(12, 30, 3, 2, 'yoru', 1)


@art('mc-club-shelf')
def _(c):
    y1 = furn(c, 0, 0, 32, 32, 6, 'ita', tt=5, ft=3, grain='wood')
    c.R(3, 1, 7, 4, 'daidai', 3); c.HL(3, 1, 7, 'daidai', 4); c.R(20, 2, 8, 3, 'kon', 3)
    for r in range(2):
        y = y1 + 1 + r * 12
        c.R(2, y, 28, 11, 'ita', 1)
        books(c, 3, y + 3, 10, 8, 40 + r)
        if r == 0:
            c.ell(19, y + 7, 3, 3, lambda x, yy, dx, dy, d: ('daidai', 4 if dx + dy < 0 else 2))   # 공
            c.R(24, y + 4, 5, 7, 'murasaki', 3); c.HL(24, y + 4, 5, 'murasaki', 4)
        else:
            c.R(15, y + 5, 7, 6, 'shiro', 3); c.HL(15, y + 5, 7, 'shiro', 4); c.R(24, y + 2, 4, 9, 'aka', 2)
        c.HL(1, y + 11, 30, 'ita', 4)


@art('mc-trophy-case')
def _(c):
    y1 = furn(c, 0, 0, 32, 32, 6, 'ita', tt=5, ft=3, grain='wood')
    c.R(2, y1 + 1, 28, 22, 'ita', 1)
    for r in range(2):
        y = y1 + 2 + r * 11
        for k, x in enumerate((4, 12, 20, 26)):
            if k % 2 == 0:
                c.R(x, y + 2, 4, 3, 'kii', 4); c.HL(x, y + 2, 4, 'kii', 4); c.R(x + 1, y + 5, 2, 2, 'kii', 2); c.R(x, y + 7, 4, 2, 'ita', 3)
                c.P(x - 1, y + 3, 'kii', 3); c.P(x + 4, y + 3, 'kii', 1)
            else:
                c.R(x, y + 2, 4, 6, 'shiro', 3); c.HL(x, y + 2, 4, 'shiro', 4); c.R(x + 1, y + 4, 2, 2, 'aka', 3)
        c.HL(2, y + 9, 28, 'ita', 4)
    for j in range(22):
        for i in range(28):
            if (i + j) % 17 == 0 and i % 14 < 6: c.P(2 + i, y1 + 1 + j, 'garasu', 6)
    c.VL(16, y1, 23, 'ita', 3)


@art('mc-trophy-shelf')
def _(c):
    y1 = furn(c, 0, 8, 32, 24, 7, 'ita', tt=5, ft=3, grain='wood')
    for x in (4, 14, 24):
        c.R(x, 8, 4, 3, 'kii', 4); c.R(x + 1, 11, 2, 2, 'kii', 2); c.R(x, 13, 4, 1, 'ita', 3)
    c.R(2, y1 + 1, 28, 14, 'ita', 1)
    c.R(4, y1 + 4, 6, 8, 'shiro', 3); c.R(5, y1 + 6, 4, 3, 'aka', 3)
    c.R(13, y1 + 6, 4, 6, 'tekko', 5); c.R(20, y1 + 5, 7, 7, 'kii', 3); c.HL(20, y1 + 5, 7, 'kii', 4)


@art('mc-amp')
def _(c):
    y1 = furn(c, 1, 8, 14, 23, 7, 'yoru', tt=4, ft=2)
    c.R(3, 10, 3, 2, 'tekko', 5); c.R(8, 10, 2, 2, 'tekko', 4); c.R(11, 10, 2, 2, 'tekko', 4)
    c.HL(3, y1 + 1, 10, 'kii', 3)
    for y in range(y1 + 3, y1 + 13):
        for x in range(3, 13):
            if (x + y) % 2 == 0: c.P(x, y, 'yoru', 1)
            else: c.P(x, y, 'yoru', 3)
    c.R(3, 30, 3, 1, 'yoru', 1); c.R(10, 30, 3, 1, 'yoru', 1)


@art('mc-amp-stack')
def _(c):
    y1 = furn(c, 0, 8, 32, 24, 7, 'yoru', tt=4, ft=2)
    for x in (3, 18):
        c.R(x, 10, 11, 3, 'yoru', 5); c.HL(x, 10, 11, 'yoru', 6); c.R(x + 1, 11, 2, 1, 'tekko', 5); c.R(x + 6, 11, 4, 1, 'aka', 3)
    for k in range(2):
        x = 2 + k * 15
        c.R(x, y1 + 1, 13, 14, 'yoru', 1); c.HL(x, y1 + 1, 13, 'kii', 3)
        for y in range(y1 + 3, y1 + 14):
            for i in range(x + 1, x + 12):
                if (i + y) % 2 == 0: c.P(i, y, 'yoru', 3)


@art('mc-lecture-stool')
def _(c):
    for k in range(2):
        cx = 8 + k * 16
        c.ell(cx, 6, 6, 4, lambda x, y, dx, dy, d: ('ita', 5 if dx + dy < -0.2 else 4) if d < 0.75 else ('ita', 3))
        c.R(cx - 1, 9, 2, 5, 'tekko', 4); c.VL(cx, 9, 5, 'tekko', 2)
        c.HL(cx - 4, 12, 8, 'tekko', 4); c.HL(cx - 5, 14, 10, 'tekko', 3); c.HL(cx - 5, 15, 10, 'sumi', 1)
    for y in range(1, 11):
        for x in range(32):
            if c.on(x, y) and c.get(x, y)[0] == 'ita' and (not c.on(x - 1, y) or not c.on(x + 1, y) or not c.on(x, y - 1)): c.P(x, y, 'sumi', 1)


# ═══════════════ 3판: 관문 반려 21점 다시 그리기 (2026-10-14) ═══════════════
# 통과한 가구(사물함·유리장·책상)와 나란히 보고 고친 규칙: 윗면은 앞면과 «다른 밝기·다른 재질»로 7행 이상, 뒤 가장자리 sumi 선과
# 한 단 어두운 뒤 띠, 앞 모서리 반사 1행. 윗면 위에 «위에서 본» 물건(눕힌 책·병뚜껑·손잡이)을 얹어 면임을 보인다. 앞면은 두 단 이상 어둡게.
def topbox(c, x, y, w, h, top, tm, tt, fm=None, ft=None, grain=None):
    fm = fm or tm; nt = NT[MI[tm]]; nf = NT[MI[fm]]
    ft = max(1, tt - 3) if ft is None else ft
    c.R(x, y, w, top, tm, tt)
    if grain == 'wood':
        for j in range(2, top - 1):
            for i in range(1, w - 1):
                r = rnd(x + i, (y + j) // 2 + (i // 6), 9)
                if r < 0.16: c.P(x + i, y + j, tm, tt - 1)
    elif grain == 'steel':
        for j in range(3, top - 1, 2): c.HL(x + 2, y + j, w - 4, tm, min(nt - 1, tt + 1) if j % 4 == 1 else tt)
    c.HL(x, y + 1, w, tm, tt - 1)
    c.HL(x, y + top - 1, w, tm, min(nt - 1, tt + 1))
    c.R(x, y + top, w, h - top, fm, ft)
    c.HL(x, y + top, w, fm, max(0, ft - 1))
    if h - top > 3:
        c.VL(x + 1, y + top + 1, h - top - 2, fm, min(nf - 1, ft + 1)); c.VL(x + w - 2, y + top + 1, h - top - 2, fm, max(0, ft - 1))
    c.HL(x, y, w, 'sumi', 1); c.HL(x, y + h - 1, w, 'sumi', 1); c.VL(x, y, h, 'sumi', 1); c.VL(x + w - 1, y, h, 'sumi', 1)
    return y + top


def wheels(c, xs, y):
    for wx in xs: c.R(wx, y, 2, 2, 'yoru', 1); c.P(wx, y, 'yoru', 3)


def lying_book(c, x, y, w, m, s=0):
    """위에서 본 눕힌 책: 표지 면(밝게) + 아래 모서리 페이지(흰 1행)."""
    c.R(x, y, w, 2, m, 3); c.P(x, y, m, 4); c.HL(x, y + 2, w, 'shiro', 3)


@art('mc-pc-cart')
def _(c):
    y = topbox(c, 1, 8, 14, 22, 8, 'tekko', 6, 'kon', 2, grain='steel')
    c.R(4, 10, 8, 4, 'yoru', 2); c.HL(4, 10, 8, 'yoru', 4); c.HL(4, 13, 8, 'yoru', 1)          # 위에 놓인 닫힌 노트북(윗면)
    c.P(10, 11, 'sora', 3)
    c.R(3, y + 2, 4, 10, 'kon', 1); c.R(9, y + 2, 4, 10, 'kon', 1)
    for j in range(y + 3, y + 11, 2): c.HL(4, j, 2, 'kon', 3); c.HL(10, j, 2, 'kon', 3)
    c.VL(7, y + 4, 4, 'tekko', 5); c.VL(8, y + 4, 4, 'tekko', 5)
    wheels(c, (2, 12), 30)


@art('mc-chair-stack')
def _(c):
    # 맨 위 의자의 앉는 면(위에서 본 넓은 면) + 등받이 + 아래로 겹친 의자 가장자리 + 다리
    c.R(2, 8, 12, 4, 'sora', 2); c.HL(2, 8, 12, 'sora', 3); c.HL(2, 11, 12, 'sora', 1)
    c.HL(2, 7, 12, 'sumi', 1); c.VL(1, 7, 5, 'sumi', 1); c.VL(14, 7, 5, 'sumi', 1)
    c.R(1, 12, 14, 7, 'sora', 4); c.HL(1, 12, 14, 'sora', 3); c.HL(1, 18, 14, 'sora', 3)
    c.R(4, 14, 8, 3, 'sora', 3)
    c.VL(0, 12, 7, 'sumi', 1); c.VL(15, 12, 7, 'sumi', 1)
    for k, y in enumerate((19, 21, 23)):
        c.HL(1, y, 14, 'sora', 2 - (k > 1)); c.HL(1, y + 1, 14, 'sora', 1); c.P(0, y, 'sumi', 1); c.P(15, y, 'sumi', 1); c.P(0, y + 1, 'sumi', 1); c.P(15, y + 1, 'sumi', 1)
    for lx in (2, 12):
        c.VL(lx, 25, 6, 'tekko', 4); c.VL(lx + 1, 25, 6, 'tekko', 2)
    c.line(4, 25, 5, 30, 'tekko', 3); c.line(11, 25, 10, 30, 'tekko', 3)
    c.HL(1, 31, 14, 'sumi', 1)


def open_bin3(c, rx, ry, cy, body_mat, bt, inner='yoru'):
    """열린 둥근 통: 아가리(안쪽 어둡게, 테 밝게) ry*2 행 + 몸통."""
    c.R(8 - rx, cy, rx * 2, 15 - cy, body_mat, bt)
    for x in range(8 - rx, 8 + rx):
        t = bt + 1 if x < 6 else bt if x < 11 else bt - 1
        c.VL(x, cy, 15 - cy, body_mat, t)
    c.ell(8, cy, rx, ry, lambda x, y, dx, dy, d: (body_mat, bt + 2) if d > 0.62 else (inner, 1 if dy < 0.1 else 2))
    c.ell(8, cy, rx, ry, lambda x, y, dx, dy, d: ('sumi', 1) if d > 0.86 and dy < 0 else None)
    c.VL(8 - rx - 1 + 1, cy, 15 - cy, 'sumi', 1); c.VL(8 + rx - 1, cy, 15 - cy, 'sumi', 1); c.HL(8 - rx, 15, rx * 2, 'sumi', 1)


@art('mc-trash-bin')
def _(c):
    open_bin3(c, 6, 4, 5, 'kokuban', 2)
    for (x, y, m) in ((6, 4, 'shiro'), (7, 5, 'shiro'), (9, 4, 'kinari'), (10, 6, 'shiro')): c.P(x, y, m, 4 if m == 'shiro' else 3)
    for y in (10, 13): c.HL(3, y, 10, 'kokuban', 1)


@art('mc-umbrella-stand')
def _(c):
    open_bin3(c, 6, 4, 5, 'tekko', 3)
    for (x, y, m) in ((6, 4, 'aka'), (9, 4, 'kon'), (8, 6, 'kii'), (5, 6, 'midori')):     # 위에서 본 접은 우산 꼭지
        c.R(x, y, 2, 2, m, 3); c.P(x, y, m, 4)
    for x in range(3, 13, 3): c.VL(x, 10, 5, 'tekko', 1)
    c.HL(3, 12, 10, 'tekko', 1)


@art('mc-vending-in')
def _(c):
    y = topbox(c, 0, 0, 16, 31, 9, 'tekko', 6, 'kon', 2, grain='steel')
    c.R(2, 2, 5, 3, 'conc', 4); c.HL(2, 2, 5, 'conc', 5)                                       # 위에 놓인 상자(윗면)
    c.R(2, y + 2, 12, 10, 'shiro', 3); c.HL(2, y + 2, 12, 'shiro', 4)
    cols = ('aka', 'sora', 'kii', 'midori', 'daidai')
    for r, yy in enumerate((y + 4, y + 8)):
        for k in range(5):
            m = cols[(k + r * 2) % 5]; c.R(3 + k * 2, yy, 1, 3, m, 3); c.P(3 + k * 2, yy, m, 4)
    c.R(2, y + 14, 7, 3, 'yoru', 1); c.R(11, y + 14, 3, 4, 'tekko', 5); c.P(12, y + 15, 'yoru', 1)
    c.HL(1, 30, 14, 'sumi', 1)


@art('mc-bulletin-stand')
def _(c):
    # 두꺼운 위 틀(윗면 5행) · 코르크 판 · 다리 · 위에서 본 T 발(윗면 4행)
    topbox(c, 0, 0, 32, 7, 5, 'tekko', 6, 'tekko', 3)
    c.R(1, 7, 30, 13, 'daidai', 2); c.HL(1, 7, 30, 'daidai', 1)
    for j in range(8, 19):
        for i in range(2, 30):
            if rnd(i, j, 31) < 0.14: c.P(i, j, 'daidai', 3)
    for x, yy, w, h, m in ((3, 9, 7, 6, 'shiro'), (12, 8, 6, 8, 'kii'), (20, 9, 8, 5, 'shiro'), (21, 15, 6, 3, 'sora')):
        c.R(x, yy, w, h, m, 4 if m == 'shiro' else 3); c.HL(x, yy + h - 1, w, m, 2); c.P(x + w // 2, yy, 'aka', 3)
    c.VL(0, 7, 13, 'sumi', 1); c.VL(31, 7, 13, 'sumi', 1); c.HL(1, 20, 30, 'tekko', 2)
    for lx in (4, 26):
        c.R(lx, 21, 2, 6, 'tekko', 4); c.VL(lx + 1, 21, 6, 'tekko', 2)
        topbox(c, lx - 3, 26, 8, 5, 3, 'tekko', 6, 'tekko', 2)


@art('mc-clean-cart')
def _(c):
    # 노란 플라스틱 청소 카트: 위 쟁반(윗면 7행, 걸레 양동이 아가리) + 앞 칸 + 바퀴
    y = topbox(c, 1, 8, 14, 22, 8, 'kii', 4, 'kii', 1)
    c.ell(6, 12, 3.5, 2.3, lambda x, yy, dx, dy, d: ('sora', 4) if d > 0.55 else ('sora', 2))       # 양동이 아가리(물)
    c.R(10, 10, 3, 4, 'aka', 3); c.HL(10, 10, 3, 'aka', 4)                                        # 세제 병 윗면
    c.VL(13, 2, 9, 'ita', 4); c.VL(14, 2, 9, 'ita', 2); c.R(12, 0, 4, 3, 'shiro', 3); c.HL(12, 0, 4, 'sumi', 1)  # 걸레 자루
    c.R(3, y + 2, 10, 9, 'kii', 0); c.R(4, y + 3, 4, 7, 'kokuban', 2); c.R(9, y + 4, 3, 6, 'sora', 2)
    wheels(c, (2, 12), 30)


@art('mc-tray-cart')
def _(c):
    y = topbox(c, 0, 8, 16, 22, 9, 'tekko', 6, 'tekko', 3, grain='steel')
    for k in range(3):                                                                            # 위에서 본 식판 더미
        c.R(2 + k, 10 + k, 10, 4, 'kinari', 4 - (k == 2)); c.HL(2 + k, 13 + k, 10, 'kinari', 2)
    c.R(5, 12, 3, 2, 'kinari', 3); c.R(9, 12, 3, 2, 'kinari', 3)
    for sy in (y + 2, y + 7):
        c.R(2, sy, 12, 4, 'tekko', 1)
        for k in range(3): c.HL(3, sy + 1 + k, 10, 'kinari', 3 if k == 0 else 2)
        c.HL(1, sy + 4, 14, 'tekko', 5)
    wheels(c, (2, 12), 30)


@art('mc-book-cart')
def _(c):
    y = topbox(c, 1, 8, 14, 22, 9, 'ita', 5, 'ita', 2, grain='wood')
    lying_book(c, 3, 10, 5, 'aka'); lying_book(c, 8, 11, 5, 'sora'); lying_book(c, 4, 13, 6, 'midori')
    for k, sy in enumerate((y + 1, y + 6)):
        c.R(3, sy, 10, 4, 'ita', 0)
        books(c, 3, sy, 10, 4, s=k + 3)
        c.HL(2, sy + 4, 12, 'ita', 4)
    wheels(c, (2, 12), 30)


@art('mc-aid-cabinet')
def _(c):
    y = topbox(c, 1, 0, 14, 31, 9, 'shiro', 4, 'shiro', 2)
    c.R(3, 3, 4, 3, 'kinari', 3); c.HL(3, 3, 4, 'kinari', 4); c.R(9, 3, 3, 3, 'aka', 3); c.P(9, 3, 'aka', 4)   # 위에 둔 상자·약통
    c.R(2, y + 1, 12, 3, 'aka', 2); c.R(7, y + 1, 2, 3, 'shiro', 4); c.HL(6, y + 2, 4, 'shiro', 4)
    for gx in (3, 8):
        glass(c, gx, y + 5, 5, 9, 3)
        c.HL(gx, y + 9, 5, 'shiro', 3)
        for k in range(2): c.R(gx + 1 + k * 2, y + 6, 1, 3, ('midori', 'daidai')[k], 3)
    c.P(7, y + 10, 'tekko', 5); c.P(8, y + 10, 'tekko', 5)
    c.HL(2, 29, 12, 'shiro', 1)


@art('mc-bean-bag')
def _(c):
    def body(x, y, dx, dy, d):
        if dy > 0.35: return ('kii', 1 if dx > 0.3 else 2)
        if (dx + 0.05) ** 2 / 0.3 + (dy + 0.3) ** 2 / 0.14 < 1: return ('kii', 2 if dy < -0.35 else 3)   # 앉는 자리 오목
        return ('kii', 4 if dx + dy < -0.4 else 3)
    c.ell(8, 8.5, 7.4, 6.6, body)
    c.ell(8, 8.5, 7.4, 6.6, lambda x, y, dx, dy, d: ('sumi', 1) if d > 0.82 else None)
    c.line(4, 12, 7, 13, 'kii', 1); c.line(11, 12, 9, 13, 'kii', 1)


@art('mc-easel-board')
def _(c):
    topbox(c, 1, 0, 14, 5, 4, 'tekko', 6, 'tekko', 3)                                               # 위 틀(윗면)
    c.R(1, 5, 14, 12, 'shiro', 4); c.VL(1, 5, 12, 'sumi', 1); c.VL(14, 5, 12, 'sumi', 1)
    c.HL(3, 7, 7, 'kon', 2); c.HL(3, 9, 9, 'conc', 3); c.HL(3, 11, 5, 'aka', 2); c.R(10, 11, 3, 3, 'midori', 3)
    topbox(c, 1, 17, 14, 5, 4, 'tekko', 6, 'tekko', 2)                                              # 펜 받침(윗면)
    c.P(4, 18, 'aka', 3); c.P(6, 19, 'kon', 3); c.P(9, 18, 'midori', 3)
    c.line(4, 22, 2, 28, 'tekko', 3); c.line(11, 22, 13, 28, 'tekko', 3); c.VL(8, 22, 6, 'tekko', 2)
    topbox(c, 0, 27, 16, 5, 3, 'tekko', 5, 'tekko', 2)                                              # 바닥 받침(윗면)


@art('mc-club-shelf')
def _(c):
    y = topbox(c, 0, 0, 32, 31, 9, 'ita', 5, 'ita', 2, grain='wood')
    c.R(3, 3, 7, 4, 'conc', 4); c.HL(3, 3, 7, 'conc', 5); c.HL(3, 6, 7, 'conc', 2)                  # 위에 놓인 상자
    c.ell(15, 5, 2.6, 2.2, lambda x, yy, dx, dy, d: ('daidai', 4 if dx + dy < 0 else 2))             # 공
    lying_book(c, 20, 3, 8, 'kon'); lying_book(c, 21, 5, 6, 'kii')
    for k, sy in enumerate((y + 1, y + 11)):
        c.R(2, sy, 28, 9, 'ita', 0)
        if k == 0:
            books(c, 2, sy + 2, 12, 7, s=11); c.R(16, sy + 4, 6, 5, 'aka', 3); c.HL(16, sy + 4, 6, 'aka', 4); c.R(24, sy + 2, 5, 7, 'kii', 3)
        else:
            c.R(3, sy + 3, 8, 6, 'kokuban', 3); c.HL(3, sy + 3, 8, 'kokuban', 4); books(c, 13, sy + 2, 16, 7, s=12)
        c.HL(1, sy + 9, 30, 'ita', 4)


@art('mc-trophy-case')
def _(c):
    y = topbox(c, 0, 0, 32, 31, 9, 'ita', 5, 'ita', 2, grain='wood')
    c.R(4, 3, 9, 4, 'kinari', 4); c.HL(4, 6, 9, 'kinari', 2); c.R(6, 4, 5, 2, 'sora', 3)              # 위에 세운 액자(윗면 쪽)
    plant(c, 23, 1)
    c.R(2, y + 1, 28, 19, 'ita', 1)
    for gx in (3, 17):
        glass(c, gx, y + 2, 12, 17, 2)
        for k, sh in enumerate((y + 9, y + 18)):
            c.HL(gx, sh, 12, 'ita', 4)
            for tx in (gx + 2, gx + 7):
                c.R(tx, sh - 4, 3, 2, 'kii', 4); c.P(tx + 1, sh - 2, 'kii', 3); c.HL(tx, sh - 1, 3, 'kii', 2)
    c.VL(15, y + 1, 19, 'ita', 4); c.VL(16, y + 1, 19, 'ita', 2)


@art('mc-amp')
def _(c):
    # 기타 앰프: 위 조작판(윗면 7행, 손잡이·노브) + 검은 그릴 앞면
    y = topbox(c, 1, 8, 14, 23, 9, 'yoru', 5, 'yoru', 1)
    c.R(4, 10, 8, 2, 'yoru', 2); c.HL(4, 10, 8, 'sumi', 1)                                          # 손잡이
    for k in range(4): c.P(3 + k * 3, 14, 'kii', 4); c.P(3 + k * 3, 15, 'kii', 2)
    for j in range(y + 1, 29):
        for i in range(3, 13):
            c.P(i, j, 'yoru', 2 if (i + j) % 2 else 1)
    c.HL(3, y + 1, 10, 'tekko', 4); c.P(12, 28, 'tekko', 5)


@art('mc-book-trolley')
def _(c):
    y = topbox(c, 0, 8, 32, 22, 10, 'ita', 5, 'ita', 2, grain='wood')
    lying_book(c, 2, 10, 7, 'aka'); lying_book(c, 10, 11, 6, 'kon'); lying_book(c, 3, 14, 8, 'midori'); lying_book(c, 18, 10, 7, 'kii'); lying_book(c, 21, 14, 7, 'sora')
    for bx in (2, 17):
        c.R(bx, y + 1, 13, 8, 'ita', 0); books(c, bx, y + 2, 13, 7, s=bx)
    c.VL(15, y, 10, 'ita', 3); c.VL(16, y, 10, 'ita', 1)
    wheels(c, (2, 28), 30)


@art('mc-aid-counter')
def _(c):
    y = topbox(c, 0, 8, 32, 23, 10, 'shiro', 4, 'shiro', 2)
    for k, (bx, m) in enumerate(((3, 'daidai'), (7, 'kon'), (11, 'midori'), (15, 'shiro'))):        # 위에서 본 약병 뚜껑
        c.ell(bx + 1, 12, 1.6, 1.3, lambda x, yy, dx, dy, d, m=m: (m, 3 if dx + dy < 0 else 2))
        c.P(bx + 1, 14, m, 1)
    c.R(20, 10, 9, 5, 'kinari', 4); c.HL(20, 14, 9, 'kinari', 2); c.R(23, 11, 3, 3, 'aka', 3)       # 구급 상자 윗면
    for dx_ in (2, 17):
        c.R(dx_, y + 2, 13, 5, 'shiro', 3); c.HL(dx_, y + 6, 13, 'shiro', 1); c.HL(dx_ + 5, y + 4, 3, 'tekko', 4)
        c.R(dx_, y + 8, 13, 4, 'shiro', 3); c.HL(dx_ + 5, y + 9, 3, 'tekko', 4)
    c.HL(1, 29, 30, 'shiro', 1)


@art('mc-fridge-counter')
def _(c):
    y = topbox(c, 0, 8, 32, 23, 10, 'tekko', 6, 'tekko', 3, grain='steel')
    # 위에 놓인 전자레인지(작은 상자: 윗면 3행 + 앞면 창)
    c.HL(3, 9, 14, 'sumi', 1); c.R(3, 10, 14, 3, 'shiro', 4); c.HL(3, 12, 14, 'shiro', 3); c.R(3, 13, 14, 5, 'shiro', 2)
    c.R(4, 14, 9, 3, 'yoru', 1); c.R(14, 14, 2, 3, 'conc', 3); c.VL(2, 9, 9, 'sumi', 1); c.VL(17, 9, 9, 'sumi', 1)
    c.R(21, 11, 7, 4, 'kinari', 3); c.HL(21, 11, 7, 'kinari', 4)
    for dx_ in (2, 17):
        c.R(dx_, y + 2, 13, 9, 'tekko', 4); c.HL(dx_, y + 2, 13, 'tekko', 5); c.HL(dx_, y + 10, 13, 'tekko', 1)
        c.VL(dx_ + 11, y + 4, 4, 'tekko', 6); c.VL(dx_ + 12, y + 4, 4, 'tekko', 1)


@art('mc-amp-stack')
def _(c):
    for bx in (0, 16):
        y = topbox(c, bx, 8, 16, 23, 9, 'yoru', 5, 'yoru', 1)
        c.R(bx + 3, 10, 9, 2, 'yoru', 2); c.HL(bx + 3, 10, 9, 'sumi', 1)
        for k in range(4): c.P(bx + 3 + k * 3, 14, 'kii', 4); c.P(bx + 3 + k * 3, 15, 'kii', 2)
        for j in range(y + 1, 29):
            for i in range(bx + 2, bx + 14): c.P(i, j, 'yoru', 2 if (i + j) % 2 else 1)
        c.HL(bx + 2, y + 1, 12, 'tekko', 4)


@art('mc-stall-block')
def _(c):
    # 위에서 들여다본 두 칸(칸막이 윗면 밝은 테 + 안쪽 타일 바닥·변기 뚜껑) + 앞 문 두 짝
    c.HL(0, 8, 32, 'sumi', 1)
    c.R(0, 9, 32, 11, 'conc', 6); c.HL(0, 9, 32, 'conc', 5)
    for bx in (2, 18):
        c.R(bx, 11, 12, 7, 'tairu', 5)
        for i in range(bx, bx + 12, 4): c.VL(i, 11, 7, 'tairu', 4)
        c.ell(bx + 6, 13.5, 3, 2, lambda x, yy, dx, dy, d: ('shiro', 4 if dy < 0 else 3)); c.HL(bx + 4, 16, 5, 'shiro', 2)
        c.HL(bx, 11, 12, 'tairu', 3)
    c.HL(0, 19, 32, 'conc', 6); c.HL(0, 20, 32, 'conc', 3)
    for bx in (1, 17):
        c.R(bx, 21, 14, 8, 'midori', 2); c.VL(bx, 21, 8, 'midori', 3); c.VL(bx + 13, 21, 8, 'midori', 1); c.HL(bx, 21, 14, 'midori', 1)
        c.R(bx + 10, 24, 2, 2, 'tekko', 5)
    c.R(15, 21, 2, 8, 'conc', 4)
    c.R(1, 29, 30, 2, 'tairu', 3)
    c.HL(0, 31, 32, 'sumi', 1); c.VL(0, 8, 24, 'sumi', 1); c.VL(31, 8, 24, 'sumi', 1)


@art('mc-vending-low')
def _(c):
    y = topbox(c, 0, 8, 32, 23, 10, 'tekko', 6, 'kon', 2, grain='steel')
    c.R(3, 11, 9, 4, 'conc', 4); c.HL(3, 11, 9, 'conc', 5); c.HL(3, 14, 9, 'conc', 2)
    for gx in (2, 17):
        c.R(gx, y + 1, 13, 10, 'garasu', 3); c.HL(gx, y + 1, 13, 'garasu', 5)
        for r, yy in enumerate((y + 3, y + 7)):
            for k in range(5):
                m = ('aka', 'sora', 'kii', 'midori', 'shiro')[(k + r + gx) % 5]
                c.ell(gx + 2 + k * 2.4, yy + 1, 1, 1, lambda x, y2, dx, dy, d, m=m: (m, 4))
                c.P(int(gx + 2 + k * 2.4), yy + 2, m, 2)
    c.VL(15, y, 12, 'kon', 3); c.VL(16, y, 12, 'kon', 1); c.HL(1, 29, 30, 'kon', 1)


@art('mc-bean-bag')
def _(c):
    # 위에서 본 푸프: 넓은 둥근 윗면(밝게) 가운데 앉은 자리 오목(어둡게, 앞 테 밝게) + 앞쪽 불룩한 몸(어둡게)
    c.ell(8, 10, 7.4, 5.4, lambda x, y, dx, dy, d: ('kii', 1 if dx > 0.4 else 2))
    c.ell(8, 7.5, 7.2, 5.6, lambda x, y, dx, dy, d: ('kii', 4 if dx + dy < -0.3 else 3))
    c.ell(8, 7, 4, 2.6, lambda x, y, dx, dy, d: ('kii', 1 if dy < 0 else 2))
    c.ell(8, 7.6, 4, 2.2, lambda x, y, dx, dy, d: ('kii', 4) if dy > 0.75 else None)
    c.ell(8, 7.5, 7.2, 5.6, lambda x, y, dx, dy, d: ('sumi', 1) if d > 0.84 and dy < 0.3 else None)
    c.ell(8, 10, 7.4, 5.4, lambda x, y, dx, dy, d: ('sumi', 1) if d > 0.82 and dy > 0.3 else None)


# ═══════════════ 4판: 3판도 반려된 금속·흰 가구 — 윗면을 «뒤로 물러나는 사다리꼴»로 ═══════════════
# 판정자가 밝은 띠를 «간판 판»으로 읽었다(정면 입면도). 윗면 뒤쪽 두 줄을 양옆 1~2px 안으로 들이고 옆 모서리를 사선 sumi 로 그어
# 면이 뒤로 눕는 것을 보인다. 윗면 위 물건은 자기 윗면·앞면을 가진 상자로 둔다.
def ttop(c, x, y, w, rows, mat, t, fm=None, ft=None, h=None, grain=None):
    """사다리꼴 윗면 rows 행 + (h 가 있으면) 앞면. 반환: 앞면 첫 줄 y."""
    n = NT[MI[mat]]
    for j in range(rows):
        ins = 2 if j < 2 else 1 if j < 4 else 0
        tt = t - 1 if j == 1 else min(n - 1, t + 1) if j == rows - 1 else t
        c.HL(x + ins, y + j, w - 2 * ins, mat, tt)
        if grain == 'steel' and 2 <= j < rows - 1 and j % 2 == 0: c.HL(x + ins + 2, y + j, w - 2 * ins - 4, mat, min(n - 1, t + 1))
        c.P(x + ins, y + j, 'sumi', 1); c.P(x + w - 1 - ins, y + j, 'sumi', 1)
    c.HL(x + 2, y, w - 4, 'sumi', 1)
    if h:
        fm = fm or mat; nf = NT[MI[fm]]; ft = max(1, t - 3) if ft is None else ft
        c.R(x, y + rows, w, h - rows, fm, ft); c.HL(x, y + rows, w, fm, max(0, ft - 1))
        if h - rows > 3: c.VL(x + 1, y + rows + 1, h - rows - 2, fm, min(nf - 1, ft + 1)); c.VL(x + w - 2, y + rows + 1, h - rows - 2, fm, max(0, ft - 1))
        c.VL(x, y + rows, h - rows, 'sumi', 1); c.VL(x + w - 1, y + rows, h - rows, 'sumi', 1); c.HL(x, y + h - 1, w, 'sumi', 1)
    return y + rows


def tbox(c, x, y, w, top, front, mat, t):
    """윗면 위 작은 상자(윗면 top 행 밝게 + 앞면 front 행)."""
    c.HL(x, y, w, 'sumi', 1); c.R(x, y + 1, w, top, mat, t); c.R(x, y + 1 + top, w, front, mat, t - 2); c.HL(x, y + top, w, mat, min(NT[MI[mat]] - 1, t + 1))
    c.VL(x, y, top + front + 1, 'sumi', 1); c.VL(x + w - 1, y, top + front + 1, 'sumi', 1)


@art('mc-pc-cart')
def _(c):
    y = ttop(c, 1, 8, 14, 9, 'tekko', 5, 'kon', 2, h=22, grain='steel')
    tbox(c, 4, 10, 8, 2, 2, 'yoru', 4)
    c.R(3, y + 2, 4, 9, 'kon', 1); c.R(9, y + 2, 4, 9, 'kon', 1)
    for j in range(y + 3, y + 10, 2): c.HL(4, j, 2, 'kon', 3); c.HL(10, j, 2, 'kon', 3)
    c.VL(7, y + 4, 4, 'tekko', 5); c.VL(8, y + 4, 4, 'tekko', 5)
    wheels(c, (2, 12), 30)


@art('mc-vending-in')
def _(c):
    y = ttop(c, 0, 0, 16, 10, 'tekko', 5, 'kon', 2, h=31, grain='steel')
    tbox(c, 3, 2, 6, 2, 2, 'conc', 5)
    c.R(2, y + 2, 12, 9, 'shiro', 3); c.HL(2, y + 2, 12, 'shiro', 4)
    cols = ('aka', 'sora', 'kii', 'midori', 'daidai')
    for r, yy in enumerate((y + 3, y + 7)):
        for k in range(5):
            m = cols[(k + r * 2) % 5]; c.R(3 + k * 2, yy, 1, 3, m, 3); c.P(3 + k * 2, yy, m, 4)
    c.R(2, y + 13, 7, 3, 'yoru', 1); c.R(11, y + 13, 3, 4, 'tekko', 5)


@art('mc-tray-cart')
def _(c):
    y = ttop(c, 0, 8, 16, 10, 'tekko', 5, 'tekko', 2, h=22, grain='steel')
    tbox(c, 3, 10, 10, 2, 2, 'kinari', 4); tbox(c, 4, 12, 8, 1, 1, 'kinari', 4)
    for sy in (y + 1, y + 6):
        c.R(2, sy, 12, 4, 'tekko', 1)
        for k in range(3): c.HL(3, sy + 1 + k, 10, 'kinari', 3 if k == 0 else 2)
    wheels(c, (2, 12), 30)


@art('mc-book-cart')
def _(c):
    y = ttop(c, 1, 8, 14, 10, 'ita', 5, 'ita', 2, h=22)
    tbox(c, 4, 10, 6, 1, 1, 'aka', 3); tbox(c, 6, 13, 6, 1, 1, 'sora', 3)
    for k, sy in enumerate((y + 1, y + 6)):
        c.R(3, sy, 10, 4, 'ita', 0); books(c, 3, sy, 10, 4, s=k + 3); c.HL(2, sy + 4, 12, 'ita', 4)
    wheels(c, (2, 12), 30)


@art('mc-aid-cabinet')
def _(c):
    y = ttop(c, 1, 0, 14, 10, 'shiro', 4, 'shiro', 2, h=31)
    tbox(c, 4, 2, 5, 2, 2, 'kinari', 4); tbox(c, 10, 3, 3, 1, 2, 'aka', 3)
    c.R(2, y + 1, 12, 3, 'aka', 2); c.R(7, y + 1, 2, 3, 'shiro', 4); c.HL(6, y + 2, 4, 'shiro', 4)
    for gx in (3, 8):
        glass(c, gx, y + 5, 5, 9, 3); c.HL(gx, y + 9, 5, 'shiro', 3)
        for k in range(2): c.R(gx + 1 + k * 2, y + 6, 1, 3, ('midori', 'daidai')[k], 3)


@art('mc-amp')
def _(c):
    y = ttop(c, 1, 8, 14, 10, 'yoru', 5, 'yoru', 1, h=23)
    c.R(5, 10, 6, 2, 'yoru', 2); c.HL(5, 10, 6, 'sumi', 1)
    for k in range(4): c.P(3 + k * 3, 14, 'kii', 4); c.P(3 + k * 3, 15, 'kii', 2)
    for j in range(y + 1, 29):
        for i in range(3, 13): c.P(i, j, 'yoru', 2 if (i + j) % 2 else 1)
    c.HL(3, y + 1, 10, 'tekko', 4)


@art('mc-amp-stack')
def _(c):
    for bx in (0, 16):
        y = ttop(c, bx, 8, 16, 10, 'yoru', 5, 'yoru', 1, h=23)
        c.R(bx + 4, 10, 8, 2, 'yoru', 2); c.HL(bx + 4, 10, 8, 'sumi', 1)
        for k in range(4): c.P(bx + 3 + k * 3, 14, 'kii', 4); c.P(bx + 3 + k * 3, 15, 'kii', 2)
        for j in range(y + 1, 29):
            for i in range(bx + 2, bx + 14): c.P(i, j, 'yoru', 2 if (i + j) % 2 else 1)
        c.HL(bx + 2, y + 1, 12, 'tekko', 4)


@art('mc-fridge-counter')
def _(c):
    y = ttop(c, 0, 8, 32, 11, 'tekko', 5, 'tekko', 2, h=23, grain='steel')
    tbox(c, 4, 9, 13, 3, 5, 'shiro', 4); c.R(5, 14, 8, 3, 'yoru', 1); c.R(14, 14, 2, 3, 'conc', 3)
    tbox(c, 20, 11, 8, 2, 2, 'kinari', 4)
    for dx_ in (2, 17):
        c.R(dx_, y + 2, 13, 8, 'tekko', 3); c.HL(dx_, y + 2, 13, 'tekko', 4); c.HL(dx_, y + 9, 13, 'tekko', 1)
        c.VL(dx_ + 11, y + 4, 4, 'tekko', 6); c.VL(dx_ + 12, y + 4, 4, 'tekko', 1)


@art('mc-vending-low')
def _(c):
    y = ttop(c, 0, 8, 32, 11, 'tekko', 5, 'kon', 2, h=23, grain='steel')
    tbox(c, 4, 10, 10, 2, 2, 'conc', 5); tbox(c, 19, 11, 7, 1, 2, 'daidai', 3)
    for gx in (2, 17):
        c.R(gx, y + 1, 13, 9, 'garasu', 3); c.HL(gx, y + 1, 13, 'garasu', 5)
        for r, yy in enumerate((y + 3, y + 6)):
            for k in range(5):
                m = ('aka', 'sora', 'kii', 'midori', 'shiro')[(k + r + gx) % 5]; c.R(gx + 1 + k * 2 + (k > 2), yy, 2, 2, m, 4); c.P(gx + 1 + k * 2 + (k > 2), yy + 1, m, 2)
    c.VL(15, y, 11, 'kon', 3); c.VL(16, y, 11, 'kon', 1)


@art('mc-stall-block')
def _(c):
    # 위에서 들여다본 두 칸: 사다리꼴 칸막이 테 안에 타일 바닥·변기(윗면) + 앞 문 두 짝
    y = ttop(c, 0, 8, 32, 13, 'conc', 6, 'midori', 2, h=24)
    for bx in (3, 18):
        c.R(bx, 12, 11, 7, 'tairu', 5)
        for i in range(bx, bx + 11, 4): c.VL(i, 12, 7, 'tairu', 4)
        c.HL(bx, 12, 11, 'tairu', 3)
        c.ell(bx + 5.5, 15, 3, 2, lambda x, yy, dx, dy, d: ('shiro', 4 if dy < 0 else 3)); c.HL(bx + 3, 17, 5, 'shiro', 2)
    c.VL(15, 10, 11, 'conc', 6); c.VL(16, 10, 11, 'conc', 4)
    for bx in (2, 17):
        c.R(bx, y + 1, 13, 7, 'midori', 2); c.VL(bx, y + 1, 7, 'midori', 3); c.HL(bx, y + 1, 13, 'midori', 1); c.R(bx + 10, y + 3, 2, 2, 'tekko', 5)
    c.R(1, 29, 30, 2, 'tairu', 3)


@art('mc-bulletin-stand')
def _(c):
    ttop(c, 0, 0, 32, 7, 'ita', 5, 'ita', 2, h=9)
    tbox(c, 4, 1, 6, 2, 1, 'kii', 4); tbox(c, 20, 2, 7, 1, 1, 'shiro', 4)
    c.R(1, 9, 30, 11, 'daidai', 2); c.HL(1, 9, 30, 'daidai', 1)
    for x, yy, w, h, m in ((3, 10, 7, 6, 'shiro'), (12, 10, 6, 7, 'kii'), (20, 11, 8, 5, 'shiro')):
        c.R(x, yy, w, h, m, 4 if m == 'shiro' else 3); c.HL(x, yy + h - 1, w, m, 2); c.P(x + w // 2, yy, 'aka', 3)
    c.VL(0, 9, 11, 'sumi', 1); c.VL(31, 9, 11, 'sumi', 1); c.HL(1, 20, 30, 'ita', 1)
    for lx in (4, 26):
        c.R(lx, 21, 2, 5, 'tekko', 4); c.VL(lx + 1, 21, 5, 'tekko', 2)
        ttop(c, lx - 3, 25, 8, 4, 'tekko', 5, 'tekko', 2, h=7)


@art('mc-easel-board')
def _(c):
    ttop(c, 0, 0, 16, 6, 'tekko', 5, 'tekko', 2, h=7)
    c.R(1, 7, 14, 10, 'shiro', 4); c.VL(1, 7, 10, 'sumi', 1); c.VL(14, 7, 10, 'sumi', 1)
    c.HL(3, 9, 7, 'kon', 2); c.HL(3, 11, 9, 'conc', 3); c.R(10, 12, 3, 3, 'midori', 3)
    ttop(c, 1, 17, 14, 5, 'tekko', 5, 'tekko', 2, h=6); c.P(5, 19, 'aka', 3); c.P(8, 20, 'kon', 3)
    c.line(4, 23, 2, 27, 'tekko', 3); c.line(11, 23, 13, 27, 'tekko', 3)
    ttop(c, 0, 26, 16, 4, 'tekko', 5, 'tekko', 2, h=6)
