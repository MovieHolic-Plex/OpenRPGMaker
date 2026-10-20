#!/usr/bin/env python3
"""modern_campus 건물 — 16px 블록을 이름으로 놓아 짓는다(통짜 그림 금지). 블록은 칸 안 좌표로만 그려 어디에 놓아도 화소가 같다.

블록 이름 = '<재질>.<부위>'. 한 층 = 2줄(u 윗줄 · d 아랫줄, 32px) — 사람(16×24) 대비 문 높이 ~24px.
재질(벽): kr 흰 콘크리트 한국 학교 · br 붉은 벽돌 + 흰 석재(대학 강의동) · gl 유리 커튼월(도서관) · cr 크림 미장 + 발코니(기숙사) · gy 체육관(3줄 층)
지붕: flat(평지붕 + 파라펫, 윗면이 위에서 보인다) · hip.<색>(모임지붕, 사다리꼴 — 용마루가 실루엣 꼭대기) · gab.<색>(맞배 금속, 체육관)
레시피 = 줄 목록(각 줄 = 블록 이름 목록). bld(...) 가 폭·층수·재질로 레시피를 만든다.

  python3 buildings.py      # tiledata/modern-campus/buildings/_gate/*.png + preview
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from px import C, rnd, h32, tex_brick, window, box3
from kit import Reg, contact, OUT

B = {}          # 블록 이름 → painter(c) (c = C(16,16))


def blk(name):
    def deco(fn): B[name] = fn; return fn
    return deco


def cell(name):
    c = C(16, 16)
    for part in name.split('+'):        # 'a+b' = 겹쳐 그리기(지붕 위 설비 등)
        B[part](c)
    return c


# ═══════════════════════ 벽 재질 ═══════════════════════
def conc_wall(c, x, y, w, h, base=5, s=3, mat='conc'):
    """흰 칠 콘크리트 벽: 거의 평평 + 드문 1px 얼룩 + 아주 옅은 가로 거푸집 줄(8px 주기, 점선).
    mat='kinari'(quality-b): 미색 칠 벽 — base 는 conc 단(5/4)을 kinari 단(3/2)으로 옮긴다."""
    if mat == 'kinari':
        kb = 3
        def g(wx, wy, i, j):
            lx, ly = wx % 16, wy % 16
            q = rnd(lx, ly, s + 1); t = kb
            if q > 0.975: t = kb - 1
            elif q < 0.015 and kb < 4: t = kb + 1
            if ly % 8 == 7 and (lx + ly) % 4 == 0: t = kb - 1
            return ('kinari', t)
        c.F(x, y, w, h, g); return
    def f(wx, wy, i, j):
        lx, ly = wx % 16, wy % 16
        q = rnd(lx, ly, s + 1)
        t = base
        if q > 0.965: t = base - 1
        elif q < 0.02: t = base + 1 if base < 6 else base
        if ly % 8 == 7 and (lx + ly) % 3 != 0: t = base - 1 if q > 0.5 else t
        return ('conc', t)
    c.F(x, y, w, h, f)


def brick_wall(c, x, y, w, h):
    c.F(x, y, w, h, lambda wx, wy, i, j: tex_brick(wx % 16, wy % 16, base=3, mortar=('renga', 1), s=5))


def stucco(c, x, y, w, h, base=3):
    def f(wx, wy, i, j):
        r = rnd(wx % 16, wy % 16, 8)
        return ('kinari', base - 1 if r < 0.09 else base + 1 if r > 0.95 else base)
    c.F(x, y, w, h, f)


WALL = 'kinari'   # quality-b: 한국 학교·체육관 벽은 미색 칠(회보라 conc 는 칙칙했다)


# ── kr: 한국 학교(미색 칠 콘크리트, 띠 창) ──
def kr_storey_u(c, end=None, ground=False):
    """윗줄 0~15: 슬래브 띠 0~3 · 창 4~15(위쪽)."""
    conc_wall(c, 0, 0, 16, 16, mat=WALL)
    c.HL(0, 0, 16, 'conc', 6); c.R(0, 1, 16, 2, 'conc', 4); c.HL(0, 3, 16, 'conc', 2)
    x0, x1 = (3, 15) if end == 'L' else (1, 13) if end == 'R' else (1, 15)
    # 창 위쪽 절반(틀 + 유리) — 아랫줄에서 이어진다
    c.R(x0, 4, x1 - x0, 12, 'conc', 5)
    for j in range(5, 16):
        for i in range(x0 + 1, x1 - 1):
            t = 1 if j == 5 else 4 if j < 8 else 3
            if (i + j) % 11 in (0, 1) and j > 5: t = 5
            c.P(i, j, 'garasu', t)
    mx = (x0 + x1) // 2
    c.VL(mx, 5, 11, 'conc', 4); c.HL(x0, 4, x1 - x0, 'conc', 6); c.VL(x0, 4, 12, 'conc', 6); c.VL(x1 - 1, 4, 12, 'conc', 3)
    _kr_ends(c, end)


def kr_storey_d(c, end=None, ground=False):
    """아랫줄: 창 아래쪽 0~5 · 창턱 6~7 · 허리벽 8~15(접지층은 화강암 기단 13~15)."""
    conc_wall(c, 0, 0, 16, 16, mat=WALL)
    x0, x1 = (3, 15) if end == 'L' else (1, 13) if end == 'R' else (1, 15)
    c.R(x0, 0, x1 - x0, 6, 'conc', 5)
    for j in range(0, 5):
        for i in range(x0 + 1, x1 - 1):
            t = 2 if j > 2 else 3
            if (i + j + 16) % 11 in (0, 1): t = 4
            c.P(i, j, 'garasu', t)
    mx = (x0 + x1) // 2
    c.VL(mx, 0, 5, 'conc', 4); c.HL(x0 + 1, 2, x1 - x0 - 2, 'conc', 4)                 # 가로 창살(아래 미서기 칸)
    c.VL(x0, 0, 6, 'conc', 6); c.VL(x1 - 1, 0, 6, 'conc', 3)
    c.HL(x0 - 1 if x0 > 0 else 0, 5, x1 - x0 + (2 if x0 > 0 else 1), 'conc', 6); c.HL(x0, 6, x1 - x0, 'conc', 3)   # 창턱 윗면 + 그늘
    # 허리벽 빗물 자국
    for i in (x0 + 2, x1 - 4):
        if h32(i, 1, 7) % 2: c.VL(i, 7, 3, 'kinari', 2)
    c.HL(x0, 7, x1 - x0, 'kinari', 2)                                                  # 창턱 밑 그늘
    if ground:
        # quality-b: 1층 허리벽은 붉은 벽돌 + 화강암 기단(학교 1층의 흔한 마감)
        c.F(0, 8, 16, 4, lambda wx, wy, i, j: tex_brick(wx % 16, (wy % 16), base=4, mortar=('renga', 2), s=5))
        c.HL(0, 7, 16, 'kinari', 4); c.HL(0, 8, 16, 'renga', 2)
        c.HL(0, 12, 16, 'hodo', 5); c.R(0, 13, 16, 3, 'hodo', 3); c.HL(0, 15, 16, 'sumi', 2)
    _kr_ends(c, end)


def _kr_ends(c, end):
    if end == 'L':
        c.VL(0, 0, 16, 'sumi', 2); c.VL(1, 0, 16, 'kinari', 4)
    if end == 'R':
        c.VL(15, 0, 16, 'sumi', 2); c.VL(14, 0, 16, 'kinari', 1); c.VL(13, 0, 16, 'kinari', 2)


for e, nm in ((None, 'M'), ('L', 'L'), ('R', 'R')):
    blk('kr.w%s.u' % nm)(lambda c, e=e: kr_storey_u(c, e))
    blk('kr.w%s.d' % nm)(lambda c, e=e: kr_storey_d(c, e))
    blk('kr.g%s.u' % nm)(lambda c, e=e: kr_storey_u(c, e, True))
    blk('kr.g%s.d' % nm)(lambda c, e=e: kr_storey_d(c, e, True))


@blk('kr.pier.u')
def _(c):
    conc_wall(c, 0, 0, 16, 16, mat=WALL); c.HL(0, 0, 16, 'conc', 6); c.R(0, 1, 16, 2, 'conc', 4); c.HL(0, 3, 16, 'conc', 2)
    # 계단실 세로 창(두 줄에 걸쳐 이어진다)
    c.R(4, 5, 8, 11, 'conc', 6)
    for j in range(6, 16):
        for i in range(5, 11): c.P(i, j, 'garasu', 1 if j == 6 else 4 if j < 9 else 3)
    c.VL(11, 5, 11, 'conc', 3); c.HL(5, 11, 6, 'conc', 5)
    c.P(6, 8, 'garasu', 5); c.P(7, 9, 'garasu', 5)


@blk('kr.pier.d')
def _(c):
    conc_wall(c, 0, 0, 16, 16, mat=WALL)
    c.R(4, 0, 8, 9, 'conc', 6)
    for j in range(0, 8):
        for i in range(5, 11): c.P(i, j, 'garasu', 3 if j < 4 else 2)
    c.VL(11, 0, 9, 'conc', 3); c.HL(5, 4, 6, 'conc', 5); c.HL(3, 8, 10, 'conc', 6); c.HL(4, 9, 8, 'conc', 3)


def kr_door(c, side, row):
    """현관(2칸): 윗줄 = 슬래브 + 차양(윗면 5행 + 앞면 3행 + 그늘), 아랫줄 = 유리 양개문 + 계단."""
    L = side == 'L'
    if row == 'u':
        conc_wall(c, 0, 0, 16, 16, mat=WALL)
        c.HL(0, 0, 16, 'conc', 6); c.R(0, 1, 16, 2, 'conc', 4); c.HL(0, 3, 16, 'conc', 2)
        # 차양: 윗면(6행, 뒤 가장자리 어둡게) 앞면 3행
        c.HL(0, 5, 16, 'conc', 3); c.R(0, 6, 16, 5, 'conc', 6); c.HL(0, 10, 16, 'shiro', 4)
        c.R(0, 11, 16, 3, 'conc', 3); c.HL(0, 11, 16, 'conc', 2); c.HL(0, 13, 16, 'conc', 2)
        c.R(0, 14, 16, 2, 'yoru', 1)                                       # 차양 밑 그늘(문 위)
        if L: c.VL(0, 5, 9, 'conc', 5); c.P(0, 5, 'sumi', 1)
        else: c.VL(15, 5, 9, 'conc', 2)
        # 차양 위 학교 표식 판(글자 없음): 짙은 띠
        c.R(2 if L else 0, 7, 14, 2, 'conc', 5)
    else:
        c.R(0, 0, 16, 16, 'yoru', 1)
        # 유리문: 틀 tekko, 안쪽 어두운 유리 + 반사
        fx = 2 if L else 0
        c.R(fx, 0, 14 if L else 14, 12, 'tekko', 4)
        for j in range(1, 11):
            for i in range(fx + 1, fx + 13):
                t = 2 if j > 3 else 3
                if (i - j) % 9 in (0, 1): t = 4
                c.P(i, j, 'garasu', t)
        c.VL(15 if L else 0, 0, 12, 'tekko', 2)                           # 가운데 맞닿는 문틀
        hx = 12 if L else 3
        c.R(hx, 5, 1, 3, 'tekko', 6)                                      # 손잡이
        if L: c.R(0, 0, 2, 12, 'conc', 5); c.VL(0, 0, 12, 'sumi', 1)
        else: c.R(14, 0, 2, 12, 'conc', 3); c.VL(15, 0, 12, 'sumi', 1)
        # 계단 2단(윗면 밝게, 앞면 어둡게)
        c.HL(0, 12, 16, 'hodo', 6); c.HL(0, 13, 16, 'hodo', 3); c.HL(0, 14, 16, 'hodo', 5); c.HL(0, 15, 16, 'hodo', 2)


for sd in 'LR':
    for rw in 'ud':
        blk('kr.door%s.%s' % (sd, rw))(lambda c, sd=sd, rw=rw: kr_door(c, sd, rw))


# ── br: 붉은 벽돌 + 흰 석재(대학 강의동) ──
def br_window_u(c, x0=4, w=8):
    c.R(x0 - 1, 3, w + 2, 2, 'kinari', 3); c.HL(x0 - 1, 3, w + 2, 'kinari', 4); c.R(x0 + w // 2 - 1, 2, 2, 3, 'kinari', 4)   # 상인방 + 쐐기돌
    c.HL(x0 - 1, 5, w + 2, 'renga', 1)
    c.R(x0, 6, w, 10, 'shiro', 3)
    for j in range(7, 16):
        for i in range(x0 + 1, x0 + w - 1):
            t = 1 if j == 7 else 4 if j < 10 else 3
            if (i + j) % 7 == 0 and j > 7: t = 5
            c.P(i, j, 'garasu', t)
    c.VL(x0 + w // 2, 7, 9, 'shiro', 3); c.HL(x0 + 1, 11, w - 2, 'shiro', 3)      # 창살 십자
    c.VL(x0, 6, 10, 'shiro', 4); c.VL(x0 + w - 1, 6, 10, 'shiro', 2)


def br_window_d(c, x0=4, w=8):
    c.R(x0, 0, w, 7, 'shiro', 3)
    for j in range(0, 6):
        for i in range(x0 + 1, x0 + w - 1):
            t = 3 if j < 3 else 2
            if (i + j + 16) % 7 == 0: t = 4
            c.P(i, j, 'garasu', t)
    c.VL(x0 + w // 2, 0, 6, 'shiro', 3); c.HL(x0 + 1, 3, w - 2, 'shiro', 3)
    c.VL(x0, 0, 7, 'shiro', 4); c.VL(x0 + w - 1, 0, 7, 'shiro', 2)
    c.HL(x0 - 1, 7, w + 2, 'kinari', 4); c.HL(x0 - 1, 8, w + 2, 'kinari', 2); c.HL(x0 - 1, 9, w + 2, 'renga', 1)   # 석재 창턱 + 그늘


def br_quoin(c, end, row):
    """모퉁이 돌: 4행마다 길이 5/3 번갈아."""
    for k in range(4):
        y = k * 4; long = (k + (0 if row == 'u' else 0)) % 2 == 0
        n = 5 if long else 3
        x = 0 if end == 'L' else 16 - n
        c.R(x, y, n, 3, 'kinari', 3 if end == 'L' else 2); c.HL(x, y, n, 'kinari', 4); c.HL(x, y + 3, n, 'renga', 1)
    if end == 'L': c.VL(0, 0, 16, 'sumi', 1)
    else: c.VL(15, 0, 16, 'sumi', 1)


def br_u(c, end=None, win=True, belt=True):
    brick_wall(c, 0, 0, 16, 16)
    if belt: c.HL(0, 0, 16, 'kinari', 4); c.HL(0, 1, 16, 'kinari', 2); c.HL(0, 2, 16, 'renga', 1)   # 층 띠돌
    if win: br_window_u(c)
    if end: br_quoin(c, end, 'u')


def br_d(c, end=None, win=True, ground=False):
    brick_wall(c, 0, 0, 16, 16)
    if win: br_window_d(c)
    if ground:
        c.HL(0, 12, 16, 'hodo', 5); c.R(0, 13, 16, 3, 'hodo', 3); c.HL(0, 15, 16, 'sumi', 1)
    if end: br_quoin(c, end, 'd')
    if ground and end: c.R(0 if end == 'L' else 11, 12, 5, 3, 'hodo', 3)


for e, nm in ((None, 'M'), ('L', 'L'), ('R', 'R')):
    blk('br.w%s.u' % nm)(lambda c, e=e: br_u(c, e))
    blk('br.w%s.d' % nm)(lambda c, e=e: br_d(c, e))
    blk('br.g%s.u' % nm)(lambda c, e=e: br_u(c, e))
    blk('br.g%s.d' % nm)(lambda c, e=e: br_d(c, e, ground=True))
blk('br.pier.u')(lambda c: br_u(c, None, win=False))
blk('br.pier.d')(lambda c: br_d(c, None, win=False))


def br_door(c, side, row):
    """석재 테두리 양개 나무문(2칸) + 반원 채광창. 윗줄 = 채광창·상인방, 아랫줄 = 문짝 + 돌계단."""
    L = side == 'L'
    brick_wall(c, 0, 0, 16, 16)
    if row == 'u':
        c.HL(0, 0, 16, 'kinari', 4); c.HL(0, 1, 16, 'kinari', 2); c.HL(0, 2, 16, 'renga', 1)
        # 반원 아치 테(석재) — 두 칸에 걸친 반원, 중심 x=16(경계)
        cx = 16 if L else 0
        for y in range(4, 16):
            for x in range(16):
                d = ((x + 0.5 - cx) ** 2 + ((y + 0.5 - 16) * 1.6) ** 2) ** 0.5
                if d < 14 and d >= 11.5: c.P(x, y, 'kinari', 4 if x < 8 else 3)
                elif d < 11.5:
                    t = 4 if d > 9 else 3
                    c.P(x, y, 'garasu', t)
                    if abs((x + 0.5 - cx)) < 0.8 or (abs(d - 6) < 0.7): c.P(x, y, 'shiro', 3)
        c.R(2 if L else 0, 15, 14, 1, 'kinari', 3)
    else:
        # 문짝(초록 칠한 나무) + 판넬
        x0 = 4 if L else 0; x1 = 16 if L else 12
        c.R(x0 - 2 if L else x0, 0, x1 - x0 + 2, 12, 'kinari', 3)
        c.R(x0, 0, x1 - x0, 12, 'kokuban', 2)
        for (py, ph) in ((1, 5), (7, 4)):
            c.R(x0 + 2 if L else x0 + 1, py, x1 - x0 - 3, ph, 'kokuban', 1); c.HL(x0 + 2 if L else x0 + 1, py, x1 - x0 - 3, 'kokuban', 3)
        c.VL(15 if L else 0, 0, 12, 'kokuban', 0)
        c.R(13 if L else 2, 6, 1, 2, 'kii', 4)
        if L: c.VL(x0, 0, 12, 'kokuban', 3)
        # 돌계단 3단
        for k, (t1, t2) in enumerate(((6, 3),)):
            pass
        c.HL(0, 12, 16, 'hodo', 6); c.HL(0, 13, 16, 'hodo', 3); c.HL(0, 14, 16, 'hodo', 5); c.HL(0, 15, 16, 'hodo', 2)


for sd in 'LR':
    for rw in 'ud':
        blk('br.door%s.%s' % (sd, rw))(lambda c, sd=sd, rw=rw: br_door(c, sd, rw))


# ── gl: 유리 커튼월(도서관·학생회관) ──
def gl_u(c, end=None):
    c.R(0, 0, 16, 16, 'garasu', 3)
    c.HL(0, 0, 16, 'conc', 6); c.R(0, 1, 16, 3, 'conc', 4); c.HL(0, 4, 16, 'conc', 2)          # 층 슬래브
    for j in range(5, 16):
        for i in range(16):
            t = 4 if j < 8 else 3
            if (i * 2 + j) % 19 in (0, 1, 2) : t = 5           # 하늘 반사 사선
            c.P(i, j, 'garasu', t)
    for mx in (0, 8):
        c.VL(mx, 5, 11, 'tekko', 5); c.VL(mx + 1, 5, 11, 'tekko', 2)
    if end == 'L': c.R(0, 0, 4, 16, 'conc', 5); c.VL(0, 0, 16, 'sumi', 1); c.VL(3, 0, 16, 'conc', 3)
    if end == 'R': c.R(12, 0, 4, 16, 'conc', 3); c.VL(15, 0, 16, 'sumi', 1); c.VL(12, 0, 16, 'conc', 5)


def gl_d(c, end=None, ground=False):
    for j in range(16):
        for i in range(16):
            t = 3 if j < 6 else 2
            if (i * 2 + j + 16) % 19 in (0, 1, 2): t = 4
            c.P(i, j, 'garasu', t)
    c.HL(0, 9, 16, 'tekko', 4)                                            # 가로 무지틀
    c.R(0, 10, 16, 6, 'garasu', 1); c.HL(0, 10, 16, 'garasu', 2)          # 스팬드럴(불투명 유리)
    for mx in (0, 8):
        c.VL(mx, 0, 16, 'tekko', 5); c.VL(mx + 1, 0, 16, 'tekko', 2)
    if ground:
        c.R(0, 10, 16, 6, 'garasu', 2)
        for i in range(16): c.P(i, 11 + (i % 3 == 0), 'garasu', 3)
        c.HL(0, 13, 16, 'conc', 5); c.R(0, 14, 16, 2, 'conc', 3); c.HL(0, 15, 16, 'sumi', 1)
    if end == 'L': c.R(0, 0, 4, 16, 'conc', 5); c.VL(0, 0, 16, 'sumi', 1); c.VL(3, 0, 16, 'conc', 3)
    if end == 'R': c.R(12, 0, 4, 16, 'conc', 3); c.VL(15, 0, 16, 'sumi', 1); c.VL(12, 0, 16, 'conc', 5)


for e, nm in ((None, 'M'), ('L', 'L'), ('R', 'R')):
    blk('gl.w%s.u' % nm)(lambda c, e=e: gl_u(c, e))
    blk('gl.w%s.d' % nm)(lambda c, e=e: gl_d(c, e))
    blk('gl.g%s.u' % nm)(lambda c, e=e: gl_u(c, e))
    blk('gl.g%s.d' % nm)(lambda c, e=e: gl_d(c, e, True))
blk('gl.pier.u')(lambda c: (conc_wall(c, 0, 0, 16, 16), c.HL(0, 0, 16, 'conc', 6), c.R(0, 1, 16, 3, 'conc', 4), c.HL(0, 4, 16, 'conc', 2)))
blk('gl.pier.d')(lambda c: conc_wall(c, 0, 0, 16, 16))


def gl_door(c, side, row):
    L = side == 'L'
    if row == 'u':
        gl_u(c)
        # 돌출 캐노피: 얇은 슬래브 윗면 5행
        c.HL(0, 9, 16, 'conc', 3); c.R(0, 10, 16, 4, 'conc', 6); c.HL(0, 13, 16, 'shiro', 4); c.R(0, 14, 16, 2, 'conc', 3); c.HL(0, 15, 16, 'conc', 2)
        if L: c.VL(0, 9, 7, 'sumi', 1)
        else: c.VL(15, 9, 7, 'sumi', 1)
    else:
        c.R(0, 0, 16, 16, 'yoru', 2)
        c.R(0, 0, 16, 1, 'yoru', 0)
        for j in range(1, 13):
            for i in range(1 if L else 0, 15 if L else 15):
                t = 2 if j > 4 else 3
                if (i - j) % 10 in (0, 1): t = 4
                c.P(i, j, 'garasu', t)
        c.VL(0 if L else 15, 0, 13, 'tekko', 5); c.VL(15 if L else 0, 0, 13, 'tekko', 3)
        c.HL(0, 12, 16, 'conc', 6); c.R(0, 13, 16, 2, 'conc', 4); c.HL(0, 15, 16, 'sumi', 1)


for sd in 'LR':
    for rw in 'ud':
        blk('gl.door%s.%s' % (sd, rw))(lambda c, sd=sd, rw=rw: gl_door(c, sd, rw))


# ── cr: 크림 미장 + 발코니(기숙사) ──
def cr_u(c, end=None, cur=0):
    stucco(c, 0, 0, 16, 16)
    c.HL(0, 0, 16, 'kinari', 1); c.HL(0, 1, 16, 'kinari', 2)            # 위층 발코니 밑 그늘
    x0, x1 = 3, 13
    c.R(x0, 4, x1 - x0, 12, 'shiro', 3)
    curtains = [('pinku', 3), ('lino', 3), ('kinari', 3), ('sora', 3), ('daidai', 3)]
    cm = curtains[cur % len(curtains)]
    for j in range(5, 16):
        for i in range(x0 + 1, x1 - 1):
            t = 1 if j == 5 else 4 if j < 8 else 3
            if (i + j) % 9 == 0 and j > 5: t = 5
            c.P(i, j, 'garasu', t)
    c.R(x0 + 1, 6, 2, 10, cm[0], cm[1] - 1); c.VL(x0 + 1, 6, 10, cm[0], cm[1]); c.HL(x0 + 1, 6, 2, cm[0], cm[1] + 1)   # 커튼(양쪽, 접힌 주름)
    c.R(x1 - 3, 6, 2, 10, cm[0], cm[1] - 1); c.VL(x1 - 3, 6, 10, cm[0], cm[1]); c.HL(x1 - 3, 6, 2, cm[0], cm[1] + 1)
    c.VL(8, 5, 11, 'shiro', 2)
    c.VL(x0, 4, 12, 'shiro', 4); c.VL(x1 - 1, 4, 12, 'shiro', 2)
    if end == 'L': c.VL(0, 0, 16, 'sumi', 1); c.VL(1, 0, 16, 'kinari', 4)
    if end == 'R': c.VL(15, 0, 16, 'sumi', 1); c.VL(14, 0, 16, 'kinari', 1)


def cr_d(c, end=None, ground=False, cur=0):
    stucco(c, 0, 0, 16, 16)
    x0, x1 = 3, 13
    c.R(x0, 0, x1 - x0, 6, 'shiro', 3)
    for j in range(0, 6):
        for i in range(x0 + 1, x1 - 1): c.P(i, j, 'garasu', 2 if j > 2 else 3)
    if not ground:
        curtains = [('pinku', 3), ('lino', 3), ('kinari', 3), ('sora', 3), ('daidai', 3)]
        cm = curtains[cur % len(curtains)]
        c.R(x0 + 1, 0, 2, 4, cm[0], cm[1] - 1); c.VL(x0 + 1, 0, 4, cm[0], cm[1])
        c.R(x1 - 3, 0, 2, 4, cm[0], cm[1] - 1); c.VL(x1 - 3, 0, 4, cm[0], cm[1])
    c.VL(8, 0, 6, 'shiro', 2)
    if not ground:
        # 발코니: 난간(쇠 살) 4~10 · 바닥 슬래브 윗면 11~12 · 앞면 13~14 · 그늘 15
        c.HL(0, 4, 16, 'tekko', 5); c.HL(0, 5, 16, 'tekko', 2)
        for i in range(0, 16, 2): c.VL(i, 6, 5, 'tekko', 3)
        c.R(0, 11, 16, 2, 'conc', 6); c.R(0, 13, 16, 2, 'conc', 3); c.HL(0, 15, 16, 'kinari', 1)
    else:
        c.HL(x0 - 1, 6, x1 - x0 + 2, 'shiro', 4); c.HL(x0 - 1, 7, x1 - x0 + 2, 'kinari', 1)
        c.HL(0, 12, 16, 'hodo', 5); c.R(0, 13, 16, 3, 'hodo', 3); c.HL(0, 15, 16, 'sumi', 1)
    if end == 'L': c.VL(0, 0, 16, 'sumi', 1); c.VL(1, 0, 16, 'kinari', 4)
    if end == 'R': c.VL(15, 0, 16, 'sumi', 1); c.VL(14, 0, 16, 'kinari', 1)


for e, nm in ((None, 'M'), ('L', 'L'), ('R', 'R')):
    for k in range(3):
        blk('cr.w%s%d.u' % (nm, k))(lambda c, e=e, k=k: cr_u(c, e, k))
        blk('cr.w%s%d.d' % (nm, k))(lambda c, e=e, k=k: cr_d(c, e, cur=k))
    blk('cr.g%s.u' % nm)(lambda c, e=e: cr_u(c, e, 3))
    blk('cr.g%s.d' % nm)(lambda c, e=e: cr_d(c, e, True))


def cr_door(c, side, row):
    L = side == 'L'
    stucco(c, 0, 0, 16, 16)
    if row == 'u':
        c.HL(0, 0, 16, 'kinari', 1); c.HL(0, 1, 16, 'kinari', 2)
        c.HL(0, 7, 16, 'tekko', 2); c.R(0, 8, 16, 4, 'tekko', 5); c.HL(0, 8, 16, 'tekko', 6); c.R(0, 12, 16, 2, 'tekko', 2); c.R(0, 14, 16, 2, 'yoru', 1)
        if L: c.VL(0, 7, 7, 'sumi', 1)
        else: c.VL(15, 7, 7, 'sumi', 1)
    else:
        c.R(0, 0, 16, 12, 'yoru', 1)
        for j in range(0, 12):
            for i in range(2 if L else 0, 16 if L else 14):
                t = 2 if j > 2 else 3
                if (i - j) % 9 in (0,): t = 4
                c.P(i, j, 'garasu', t)
        c.VL(15 if L else 0, 0, 12, 'tekko', 3)
        c.R(0 if L else 14, 0, 2, 12, 'kinari', 2 if L else 1)
        c.HL(0, 12, 16, 'hodo', 6); c.HL(0, 13, 16, 'hodo', 3); c.HL(0, 14, 16, 'hodo', 5); c.HL(0, 15, 16, 'hodo', 2)


for sd in 'LR':
    for rw in 'ud':
        blk('cr.door%s.%s' % (sd, rw))(lambda c, sd=sd, rw=rw: cr_door(c, sd, rw))


# ── gy: 체육관(한 층 3줄: 높은 창 띠 · 벽 · 기단) ──
def gy_row(c, row, end=None):
    if row == 0:      # 높은 창 띠
        conc_wall(c, 0, 0, 16, 16, base=4, mat=WALL)
        c.R(1, 4, 14, 8, 'conc', 5)
        for j in range(5, 11):
            for i in range(2, 14):
                c.P(i, j, 'garasu', 1 if j == 5 else 4 if j < 8 else 3)
        c.VL(8, 5, 6, 'conc', 5); c.HL(1, 12, 14, 'conc', 6); c.HL(1, 13, 14, 'conc', 2)
    elif row == 1:    # 패널 벽
        conc_wall(c, 0, 0, 16, 16, base=4, mat=WALL)
    else:             # 기단
        conc_wall(c, 0, 0, 16, 16, base=4, mat=WALL)
        c.HL(0, 8, 16, 'hodo', 5); c.R(0, 9, 16, 7, 'hodo', 3)
        for i in range(0, 16, 8): c.VL(i, 9, 6, 'hodo', 2)
        c.HL(0, 15, 16, 'sumi', 1)
    if end == 'L': c.VL(0, 0, 16, 'sumi', 2); c.VL(1, 0, 16, 'kinari', 3)
    if end == 'R': c.VL(15, 0, 16, 'sumi', 2); c.VL(14, 0, 16, 'kinari', 1)


for e, nm in ((None, 'M'), ('L', 'L'), ('R', 'R')):
    for r in range(3):
        blk('gy.w%s.%d' % (nm, r))(lambda c, e=e, r=r: gy_row(c, r, e))


def gy_pil(c, r):
    gy_row(c, r)
    top = 13 if r == 0 else 0; bot = 16 if r < 2 else 9
    c.R(5, top, 6, bot - top, 'kinari', 3); c.VL(5, top, bot - top, 'kinari', 4); c.VL(10, top, bot - top, 'kinari', 1); c.VL(11, top, bot - top, 'kinari', 0)
    if r == 0: c.HL(4, 12, 8, 'conc', 6)


for r in range(3): blk('gy.wP.%d' % r)(lambda c, r=r: gy_pil(c, r))


def gy_door(c, side, row):
    """체육관 큰 철문(2칸 × 줄 1·2)."""
    L = side == 'L'
    if row == 1:
        conc_wall(c, 0, 0, 16, 16, base=4, mat=WALL)
        c.R(0, 4, 16, 3, 'conc', 6); c.HL(0, 4, 16, 'conc', 3); c.R(0, 7, 16, 2, 'conc', 3); c.R(0, 9, 16, 1, 'yoru', 1)
        c.R(0, 10, 16, 6, 'tekko', 4)
        for j in range(10, 16, 2): c.HL(0, j, 16, 'tekko', 3)
    else:
        c.R(0, 0, 16, 13, 'tekko', 4)
        for j in range(0, 13, 2): c.HL(0, j, 16, 'tekko', 3)
        c.HL(0, 12, 16, 'tekko', 2)
        c.HL(0, 13, 16, 'conc', 6); c.R(0, 14, 16, 1, 'conc', 4); c.HL(0, 15, 16, 'sumi', 1)
    c.VL(0 if L else 15, 0, 16, 'tekko', 2 if not L else 5)


for sd in 'LR':
    for r in (1, 2):
        blk('gy.door%s.%d' % (sd, r))(lambda c, sd=sd, r=r: gy_door(c, sd, r))


# ═══════════════════════ 지붕 ═══════════════════════
def membrane(c, x, y, w, h, s=11):
    """평지붕 방수층(quality-b): 초록 우레탄 도막(한국 학교 옥상) — 8px 판 이음(짙은 줄 + 위쪽 밝은 줄) + 닳은 자리(lino) + 얼룩.
    옛 판은 밝은 회색 단색(hodo 5)이라 옥상이 «단색 판»으로 읽혔다."""
    def f(wx, wy, i, j):
        lx, ly = wx % 16, wy % 16
        if ly % 8 == 7: return ('midori', 1) if lx % 8 != 3 else ('kokuban', 2)
        if ly % 8 == 0: return ('midori', 3) if rnd(lx, ly, s + 2) < 0.55 else ('midori', 2)
        if lx == 15 and ly % 8 in (2, 3, 4, 5): return ('midori', 1)
        r = rnd(lx // 2, ly // 2, s); q = rnd(lx, ly, s + 5)
        if r < 0.10: return ('lino', 2)
        if q > 0.97: return ('midori', 3)
        if q < 0.06: return ('midori', 1)
        return ('midori', 2)
    c.F(x, y, w, h, f)


def flat(c, row, col, wall='kr'):
    """평지붕 칸. row b(뒤)·m(가운데)·f(앞: 방수층 + 파라펫 윗면 3행 + 바깥 면 6행) · col L/M/R."""
    membrane(c, 0, 0, 16, 16)
    if row == 'b':
        c.HL(0, 0, 16, 'sumi', 2); c.R(0, 1, 16, 2, 'conc', 6); c.HL(0, 3, 16, 'conc', 4); c.R(0, 4, 16, 2, 'conc', 3)   # 뒤 파라펫: 윗면 + 안쪽 면
        c.HL(0, 6, 16, 'kokuban', 1); c.HL(0, 7, 16, 'midori', 1)                     # 뒤 파라펫이 지붕에 드리운 그늘(빛 왼위)
    if row == 'f':
        c.HL(0, 6, 16, 'midori', 3)                                     # 앞 파라펫 안쪽 면 위 빛
        c.R(0, 7, 16, 3, 'conc', 6); c.HL(0, 7, 16, 'shiro', 4); c.HL(0, 9, 16, 'conc', 5)   # 앞 파라펫 윗면(3행, 가장 밝다)
        if wall == 'kr':
            c.R(0, 10, 16, 6, 'conc', 4); c.HL(0, 10, 16, 'conc', 3); c.R(0, 12, 16, 2, 'midori', 1); c.HL(0, 12, 16, 'midori', 2); c.HL(0, 15, 16, 'conc', 3)
        elif wall == 'gl':
            c.R(0, 10, 16, 6, 'conc', 4); c.HL(0, 10, 16, 'conc', 3); c.HL(0, 14, 16, 'conc', 3); c.HL(0, 15, 16, 'conc', 2)
        elif wall == 'br':
            c.R(0, 10, 16, 6, 'kinari', 3); c.HL(0, 10, 16, 'kinari', 1); c.HL(0, 11, 16, 'kinari', 4)
            for i in range(0, 16, 4): c.R(i + 1, 13, 2, 2, 'kinari', 2)        # 덴틸
            c.HL(0, 15, 16, 'renga', 1)
        elif wall == 'cr':
            c.R(0, 10, 16, 6, 'kinari', 4); c.HL(0, 10, 16, 'kinari', 2); c.HL(0, 14, 16, 'kinari', 2); c.HL(0, 15, 16, 'kinari', 1)
    if col == 'L':
        c.R(0, 0, 3, 16 if row != 'f' else 10, 'conc', 6); c.VL(0, 0, 16, 'sumi', 2); c.VL(3, 0 if row != 'b' else 4, 16 if row != 'f' else 7, 'conc', 3)
        c.VL(4, 0 if row != 'b' else 6, 16 if row != 'f' else 6, 'midori', 1)                # 왼 파라펫 그늘
        if row == 'b': c.P(1, 1, 'shiro', 4)
    if col == 'R':
        c.R(13, 0, 3, 16 if row != 'f' else 10, 'conc', 5); c.VL(15, 0, 16, 'sumi', 2); c.VL(12, 0 if row != 'b' else 4, 16 if row != 'f' else 7, 'midori', 3)
    if col in 'LR' and row == 'f':
        c.VL(0 if col == 'L' else 15, 0, 16, 'sumi', 2)


for w in ('kr', 'gl', 'br', 'cr'):
    for r in 'bmf':
        for cl in 'LMR':
            blk('flat.%s.%s%s' % (w, r, cl))(lambda c, r=r, cl=cl, w=w: flat(c, r, cl, w))


# ── 옥상 녹화(세덤) 평지붕 — 2026-10-20 사용자 승인 시안(modern-tiles-proto ground roof-campus-green) 이식 ──
# 캠퍼스 평지붕이 모두 같은 초록 도막이라 단조롭다(현대 칩셋 적대 QA 결함 4). 파라펫은 flat() 그대로 두고 안쪽만 바꾼다:
# 파라펫 안 자갈 점검 띠 → 알루미늄 테(위·왼 밝게, 아래·오른 어둡게) → 세덤 매트(초록 ki · 연두 shiba · 붉은 kawara 덩이, 덩이마다 위 밝고 아래 어둡다)
# → 가운데 콘크리트 점검 보도판(세로 띠, 'W' 칸). 지붕 깊이 3줄(b·m·f) 기준 좌표:
#   매트 위 테 = b 줄 y10 · 아래 테 = f 줄 y2 · 왼 테 = L 칸 x9 · 오른 테 = R 칸 x9. 그 바깥(파라펫 안쪽까지)은 자갈.
# 덩이는 칸 안에 가둬(칸 경계를 넘지 않는다) 어느 변형끼리 붙여도 이음이 없다. 잎 점·자갈 결은 16 주기 공용.
GREEN_VARIANTS = 3
SEDUM = (('ki', 2, 3, 4, 5), ('shiba', 1, 2, 3, 4), ('ki', 2, 3, 4, 5), ('kawara', 2, 3, 4, 5), ('ki', 2, 3, 4, 5), ('shiba', 1, 2, 3, 4))


def _mat_box(row, col):
    """칸 안 매트 영역 (x0, y0, x1, y1) — 끝 포함 아님. 테두리는 이 상자의 가장자리 1px."""
    x0 = 9 if col == 'L' else 0
    x1 = 10 if col == 'R' else 16
    y0 = 10 if row == 'b' else 0
    y1 = 3 if row == 'f' else 16
    return x0, y0, x1, y1


def _gravel(c, x, y):
    """자갈(hodo): 알갱이 = 밝은 머리 + 아래 그늘, 16 주기."""
    lx, ly = x % 16, y % 16
    q = rnd(lx // 2, ly // 2, 71); k = rnd(lx, ly, 72)
    if k < 0.18: return ('hodo', 5)
    if k > 0.86: return ('hodo', 2)
    return ('hodo', 4) if q < 0.5 else ('hodo', 3)


def _sedum_cell(c, var, row, col, x0, y0, x1, y1):
    """매트 안을 세덤으로 채운다. 매트가 이웃 칸으로 이어지는 변은 칸 끝까지 칠한다(테는 진짜 끝에만).
    바탕 = ki 3 + 공용 잎 점(16 주기), 덩이 = 변형별 고정 배치(칸 안에 가둔다)."""
    ix0 = x0 + 1 if col == 'L' else x0
    ix1 = x1 - 1 if col == 'R' else x1
    iy0 = y0 + 1 if row == 'b' else y0
    iy1 = y1 - 1 if row == 'f' else y1
    for y in range(iy0, iy1):
        for x in range(ix0, ix1):
            k = rnd(x, y, 81)
            c.P(x, y, 'ki', 4 if k < 0.2 else 2 if k > 0.9 else 3)
    import random
    r = random.Random(4100 + var * 37 + (0 if row == 'm' else 11 if row == 'b' else 23) + (0 if col in 'MW' else 5))
    for n in range(9):
        cx = r.uniform(ix0 + 1.5, ix1 - 1.5); cy = r.uniform(iy0 + 1.5, iy1 - 1.5); rad = 2.2 + r.random() * 1.6
        mat, d0, d1, d2, d3 = SEDUM[r.randrange(len(SEDUM))]
        if mat == 'kawara' and r.random() < 0.5: mat, d0, d1, d2, d3 = SEDUM[1]
        for y in range(iy0, iy1):
            for x in range(ix0, ix1):
                dx, dy = x + 0.5 - cx, y + 0.5 - cy
                d = (dx * dx + dy * dy) ** 0.5
                if d >= rad: continue
                t = d1
                if dy < -rad * 0.3: t = d2
                if dy < -rad * 0.6 and dx < 0.5: t = d3
                if dy > rad * 0.45: t = d0
                if d > rad - 0.9 and dy > 0: t = max(d0 - 1, 0) if mat == 'ki' else d0
                c.P(x, y, mat, t)
                if rnd(x, y, 83 + var) < 0.1 and t < d3: c.P(x, y, mat, t + 1)


def flat_green(c, row, col, wall='kr', var=0):
    """옥상 녹화 칸. col 은 L/M/R/W(보도판 칸). 파라펫은 flat() 과 같고 안쪽만 자갈·테·세덤·보도판으로 바꾼다."""
    flat(c, row, 'M' if col == 'W' else col, wall)
    keep = {(x, y) for y in range(16) for x in range(16)
            if (row == 'b' and y <= 5) or (row == 'f' and y >= 7) or (col == 'L' and x <= 3) or (col == 'R' and x >= 13)}
    x0, y0, x1, y1 = _mat_box(row, col)
    for y in range(16):
        for x in range(16):
            if (x, y) in keep: continue
            c.P(x, y, *_gravel(c, x, y))
    if row == 'f':                                     # 앞 파라펫 안쪽 접힘(빛)
        for x in range(16):
            if (x, 6) not in keep: c.P(x, 6, 'hodo', 5)
    if col == 'R':                                     # 오른 파라펫 안쪽 면(빛 받음) — flat() 의 초록 도막 빛줄을 콘크리트로
        for y in range(16):
            if row == 'b' and y < 4: continue
            if (12, y) in keep: c.P(12, y, 'conc', 5)
            else: c.P(12, y, 'hodo', 5)
    # 파라펫 그늘(빛 왼위): 뒤 파라펫 밑 2줄 · 왼 파라펫 오른쪽 2줄 — 자갈 위에 한 단 어둡게
    if row == 'b':
        for x in range(16):
            if (x, 6) not in keep: c.P(x, 6, 'hodo', 1)
            if (x, 7) not in keep: c.P(x, 7, 'hodo', 2)
    if col == 'L':
        for y in range(16):
            if (4, y) not in keep: c.P(4, y, 'hodo', 1)
            if (5, y) not in keep and not (row == 'b' and y < 6): c.P(5, y, 'hodo', 2)
    _sedum_cell(c, var, row, col, x0, y0, x1, y1)
    if col == 'W':                                     # 점검 보도판: 6px 판 두 줄, 8px 마다 가로 이음
        ys0 = y0 + 1 if row == 'b' else y0
        ys1 = y1 - 1 if row == 'f' else y1
        for y in range(ys0, ys1):
            for x in range(2, 14):
                lx, ly = (x - 2) % 6, y % 8
                t = 5 if (lx == 0 or ly == 0) else 2 if (lx == 5 or ly == 7) else 3 if (lx == 4 or ly == 6) else 4
                c.P(x, y, 'conc', t)
            c.P(1, y, 'conc', 2); c.P(14, y, 'conc', 1)
    # 알루미늄 테: 위·왼 밝음, 아래·오른 어두움 (칸 경계에 걸친 쪽은 그리지 않는다 = 이웃 칸으로 이어짐)
    if row == 'b':
        for x in range(x0, x1): c.P(x, y0, 'shiro', 3)
    if row == 'f':
        for x in range(x0, x1): c.P(x, y1 - 1, 'conc', 2)
    if col == 'L':
        for y in range(y0, y1): c.P(x0, y, 'shiro', 3)
    if col == 'R':
        for y in range(y0, y1): c.P(x1 - 1, y, 'conc', 2)
    if row == 'f' and col == 'L': c.P(x0, y1 - 1, 'conc', 3)
    if row == 'b' and col == 'R': c.P(x1 - 1, y0, 'shiro', 2)


for w in ('kr', 'gl', 'br', 'cr'):
    for r in 'bmf':
        for cl in 'LRW':
            blk('flatg.%s.%s%s' % (w, r, cl))(lambda c, r=r, cl=cl, w=w: flat_green(c, r, cl, w, 0))
        for v in range(GREEN_VARIANTS):
            blk('flatg.%s.%sM%d' % (w, r, v))(lambda c, r=r, w=w, v=v: flat_green(c, r, 'M', w, v))


# 옥상 설비(얹기 — 'flat.kr.mM+rt.ac')
@blk('rt.ac')
def _(c):
    box3(c, 2, 3, 12, 6, 6, 'conc', tt=5, ft=3)
    for i in range(4, 12, 2): c.VL(i, 10, 4, 'conc', 2)
    c.ell(8, 6, 3, 2, lambda x, y, dx, dy, d: ('tekko', 2 if d > 0.5 else 1))
    c.HL(2, 15, 12, 'hodo', 3)


@blk('rt.tank')
def _(c):
    # 물탱크(FRP, 파랑): 윗면 7행 + 앞면 6행
    box3(c, 1, 1, 14, 7, 6, 'sora', tt=3, ft=2)
    c.HL(2, 4, 12, 'sora', 2); c.R(6, 2, 4, 3, 'sora', 4); c.HL(6, 2, 4, 'shiro', 4)
    for i in (5, 10): c.VL(i, 9, 4, 'sora', 1)
    c.HL(1, 14, 14, 'hodo', 3); c.HL(1, 15, 14, 'hodo', 4)


@blk('rt.vent')
def _(c):
    c.ell(8, 8, 4, 3, lambda x, y, dx, dy, d: ('tekko', 5 if dx < -0.2 else 3))
    c.R(4, 8, 8, 4, 'tekko', 3); c.VL(4, 8, 4, 'tekko', 4); c.VL(11, 8, 4, 'tekko', 2); c.HL(4, 12, 8, 'hodo', 3)
    c.ell(8, 8, 2, 1.4, lambda x, y, dx, dy, d: ('tekko', 1))


def solar(c, half):
    """태양광 판 2칸(L/R): 남쪽으로 기운 짙은 판, 윗면 크게 보인다."""
    c.R(0, 2, 16, 10, 'kon', 1)
    for j in range(3, 11):
        for i in range(16):
            t = 2 if (j + i // 2) % 7 else 3
            c.P(i, j, 'kon', t)
    for i in range(0, 16, 5): c.VL(i + (1 if half == 'L' else 0), 3, 8, 'tekko', 4)
    c.HL(0, 6, 16, 'tekko', 4); c.HL(0, 2, 16, 'tekko', 5); c.HL(0, 11, 16, 'tekko', 2)
    c.R(0, 12, 16, 2, 'tekko', 1); c.HL(0, 14, 16, 'hodo', 3)
    if half == 'L': c.VL(0, 2, 12, 'tekko', 5)
    else: c.VL(15, 2, 12, 'tekko', 1)


blk('rt.solarL')(lambda c: solar(c, 'L'))
blk('rt.solarR')(lambda c: solar(c, 'R'))


def stairhouse(c, half, row):
    """옥상 계단실 2×2: 윗줄 = 지붕 슬래브 윗면(밝게, 뒤 어두운 선), 아랫줄 = 벽 + 철문."""
    L = half == 'L'
    if row == 0:
        c.R(0, 4, 16, 12, 'conc', 6); c.HL(0, 4, 16, 'sumi', 1); c.HL(0, 5, 16, 'conc', 4)
        c.HL(0, 13, 16, 'shiro', 4); c.R(0, 14, 16, 2, 'conc', 3)
        c.VL(0 if L else 15, 4, 12, 'sumi', 1)
    else:
        conc_wall(c, 0, 0, 16, 14, base=5, mat=WALL); c.HL(0, 0, 16, 'kinari', 1)
        if L: c.R(6, 3, 8, 11, 'tekko', 4); c.VL(6, 3, 11, 'tekko', 5); c.VL(13, 3, 11, 'tekko', 2); c.P(12, 8, 'kii', 4)
        else: c.R(3, 3, 6, 4, 'conc', 5); c.R(4, 4, 4, 2, 'garasu', 3)
        c.VL(0 if L else 15, 0, 14, 'sumi', 1); c.HL(0, 14, 16, 'hodo', 3); c.HL(0, 15, 16, 'hodo', 4)


for hf in 'LR':
    for rw in (0, 1):
        blk('rt.stair%s%d' % (hf, rw))(lambda c, hf=hf, rw=rw: stairhouse(c, hf, rw))


# ── 모임지붕(사다리꼴) ──
ROOF = dict(slate=('tairu', 3), clay=('kawara', 4), green=('kokuban', 2), metal=('tekko', 4), blue=('sora', 2))


def roof_tone(mat, base, ly, D):
    """용마루 쪽 밝게 → 처마 쪽 어둡게(4px 기와 줄마다)."""
    k = ly / (16 * D)
    return base + (1 if k < 0.3 else 0 if k < 0.7 else -1)


def hip(c, color, D, row, col, seam=False):
    """D줄 모임지붕의 row 번째 줄, col L/M/R. 용마루 0~3행, 기와 4px 줄, 처마 마지막 4행(흰 처마널 + 그늘).
    양 끝(L/R) 칸: 사선 귀마루(용마루 끝 → 처마 모서리)로 잘린 사다리꼴 — 바깥은 투명, 사선 왼쪽 면(서) 밝게·오른쪽 면(동) 어둡게."""
    mat, base = ROOF[color]
    n = 7 if mat in ('tairu', 'kawara', 'tekko') else 5
    inset = 11                          # 용마루 끝이 들어간 px
    H = 16 * D
    for ly in range(16):
        gy = row * 16 + ly
        edge = inset * (1 - gy / (H - 1))           # 이 줄의 사선 x(L 칸 기준)
        for lx in range(16):
            # 기와: 4px 줄, 2px 골 엇갈림
            course = gy // 4; cy = gy % 4
            joint = ((lx + (2 if course % 2 else 0)) % 4 == 0)
            t = roof_tone(mat, base, gy, D)
            if seam:                      # 금속 골판: 세로 골(4px) + 8px 마다 가로 겹침선
                k = lx % 4
                t += (1 if k == 0 else -1 if k == 3 else 0)
                if gy % 12 == 11: t -= 1
            else:
                if cy == 0: t += 1
                elif cy == 3: t -= 1
                if joint and cy in (1, 2): t -= 1
            px = (mat, max(0, min(n - 1, t)))
            if col == 'L':
                if lx < edge - 0.5: continue
                if lx < edge + 2.5: px = (mat, min(n - 1, base + 2 - (1 if lx < edge + 0.5 else 0)))   # 서쪽 귀마루(밝은 마루기와)
            if col == 'R':
                rx = 15 - lx
                if rx < edge - 0.5: continue
                if rx < edge + 2.5: px = (mat, max(0, base - 2 + (1 if rx < edge + 0.5 else 0)))
            c.P(lx, ly, *px)
        if row == 0 and ly < 4:
            pass
    if row == 0:      # 용마루
        x0 = inset if col == 'L' else 0; x1 = 16 - inset if col == 'R' else 16
        c.HL(x0, 0, x1 - x0, 'sumi', 1); c.HL(x0, 1, x1 - x0, mat, n - 1); c.HL(x0, 2, x1 - x0, mat, base + 1); c.HL(x0, 3, x1 - x0, mat, base - 1)
    if row == D - 1:  # 처마
        c.HL(0, 12, 16, mat, max(0, base - 2)); c.R(0, 13, 16, 2, 'shiro', 3); c.HL(0, 13, 16, 'shiro', 4); c.HL(0, 15, 16, 'yoru', 1)
    # 바깥 윤곽(사선 바깥 1px)
    if col in 'LR':
        for ly in range(16):
            gy = row * 16 + ly; edge = inset * (1 - gy / (H - 1))
            x = int(round(edge - 0.5)) if col == 'L' else 15 - int(round(edge - 0.5))
            if 0 <= x < 16 and c.on(x, ly): c.P(x, ly, 'sumi', 1)
        c.VL(0 if col == 'L' else 15, max(0, 16 * (D - 1) - row * 16 + 12) if row == D - 1 else 16, 4, 'sumi', 1) if row == D - 1 else None


for color in ROOF:
    for D in (2, 3, 4):
        for r in range(D):
            for cl in 'LMR':
                blk('hip.%s.%d.%d%s' % (color, D, r, cl))(lambda c, color=color, D=D, r=r, cl=cl: hip(c, color, D, r, cl))
                blk('seam.%s.%d.%d%s' % (color, D, r, cl))(lambda c, color=color, D=D, r=r, cl=cl: hip(c, color, D, r, cl, seam=True))


# ═══════════════════════ 조립 ═══════════════════════
def assemble(rows):
    H = len(rows); W = len(rows[0])
    c = C(W * 16, H * 16)
    for y, r in enumerate(rows):
        assert len(r) == W, (y, r)
        for x, n in enumerate(r):
            if n: c.paste(cell(n), x * 16, y * 16)
    return c


def lmr(W, L, M, R, mid=None):
    out = [L] + [M] * (W - 2) + [R]
    if mid:
        for i, n in mid.items(): out[i] = n
    return out


def bld(wall, W, S, roof='flat', D=3, door=None, piers=(), rooftop=None, ground=None, color='slate', cur=None):
    """wall 재질 · 폭 W 칸 · 층 S · 지붕(flat|hip|gab) 깊이 D 줄 · door = 문 왼쪽 칸 x(2칸) · piers = 창 없는 칸 x 목록 ·
    rooftop = {x: 블록} 맨 뒷줄 다음 줄에 얹을 설비 · ground = 1층 재질(다르면 섞기, 예 'gl')."""
    rows = []
    if roof == 'flat':
        for r in range(D):
            rk = 'b' if r == 0 else 'f' if r == D - 1 else 'm'
            rows.append(lmr(W, 'flat.%s.%sL' % (wall if wall != 'gy' else 'kr', rk), 'flat.%s.%sM' % (wall if wall != 'gy' else 'kr', rk), 'flat.%s.%sR' % (wall if wall != 'gy' else 'kr', rk)))
        for (x, y), n in (rooftop or {}).items():
            rows[y][x] = rows[y][x] + '+' + n
    elif roof == 'green':                       # 옥상 녹화: rooftop = {'walk': 보도판 칸 x}
        wk = (rooftop or {}).get('walk', W // 2)
        wl = wall if wall != 'gy' else 'kr'
        for r in range(D):
            rk = 'b' if r == 0 else 'f' if r == D - 1 else 'm'
            row = ['flatg.%s.%sL' % (wl, rk)] + ['flatg.%s.%sM%d' % (wl, rk, (x * 2 + r) % GREEN_VARIANTS) for x in range(1, W - 1)] + ['flatg.%s.%sR' % (wl, rk)]
            if 0 < wk < W - 1: row[wk] = 'flatg.%s.%sW' % (wl, rk)
            rows.append(row)
    elif roof in ('hip', 'seam'):
        for r in range(D): rows.append(lmr(W, '%s.%s.%d.%dL' % (roof, color, D, r), '%s.%s.%d.%dM' % (roof, color, D, r), '%s.%s.%d.%dR' % (roof, color, D, r)))
    else:
        for r in range(D): rows.append(lmr(W, 'gab.%s.%d.%dL' % (color, D, r), 'gab.%s.%d.%dM' % (color, D, r), 'gab.%s.%d.%dR' % (color, D, r)))
    if wall == 'gy':
        for r in range(3):
            row = lmr(W, 'gy.wL.%d' % r, 'gy.wM.%d' % r, 'gy.wR.%d' % r)
            for x in range(2, W - 2, 3): row[x] = 'gy.wP.%d' % r
            if door is not None and r >= 1: row[door] = 'gy.doorL.%d' % r; row[door + 1] = 'gy.doorR.%d' % r
            rows.append(row)
        return rows
    for s in range(S):
        g = s == S - 1
        mat = (ground or wall) if g else wall
        for hf in 'ud':
            pre = 'g' if g else 'w'
            if mat == 'cr' and not g:
                k = (s * 2 + 1) % 3
                row = [('%s.%s%s%d.%s' % (mat, pre, e, (k + i) % 3, hf)) for i, e in enumerate(['L'] + ['M'] * (W - 2) + ['R'])]
            else:
                row = lmr(W, '%s.%sL.%s' % (mat, pre, hf), '%s.%sM.%s' % (mat, pre, hf), '%s.%sR.%s' % (mat, pre, hf))
            for x in piers:
                if 0 < x < W - 1 and mat in ('kr', 'br', 'gl'): row[x] = '%s.pier.%s' % (mat, hf)
            if g and door is not None:
                row[door] = '%s.doorL.%s' % (mat, hf); row[door + 1] = '%s.doorR.%s' % (mat, hf)
            rows.append(row)
    return rows


# ── 등록할 건물 표본(조각) ──
R = Reg('buildings')
LIB = []      # (id, 이름, rows, 메타)


def add_bld(id_, name, rows, door, tags, rules, kind='structure'):
    W = len(rows[0]); H = len(rows)
    meta = dict(entrance=[door, door + 1] if door is not None else [], recipe=rows)
    LIB.append((id_, name, rows, meta))
    R.add(id_, name, W, H, kind, tags=tags, rules=rules, **meta)(lambda c, rows=rows: c.paste(assemble(rows), 0, 0))


def rt(**kw): return kw


add_bld('bld-school-8', '학교 본관(흰 콘크리트 4층, 폭 8)', bld('kr', 8, 4, D=3, door=3, piers=(1,), rooftop={(5, 1): 'rt.tank', (1, 1): 'rt.ac', (2, 1): 'rt.vent'}), 3,
        ['학교', '본관', '교실동'], '한국 학교 교실동. 정문에서 보이는 자리, 남향. 현관 앞 2칸은 비우고 포석으로 잇는다.')
add_bld('bld-school-12', '학교 본관(흰 콘크리트 4층, 폭 12)', bld('kr', 12, 4, D=4, door=5, piers=(1, 10), rooftop={(2, 1): 'rt.solarL', (3, 1): 'rt.solarR', (4, 1): 'rt.solarL', (5, 1): 'rt.solarR', (8, 1): 'rt.tank', (10, 2): 'rt.ac', (9, 2): 'rt.ac'}), 5,
        ['학교', '본관', '교실동'], '큰 교실동. 운동장 북쪽에 길게.')
add_bld('bld-school-annex', '학교 별관(흰 콘크리트 3층, 폭 6)', bld('kr', 6, 3, D=3, door=2, rooftop={(1, 1): 'rt.vent', (4, 1): 'rt.ac'}), 2,
        ['학교', '별관', '특별실'], '본관 옆 별관(과학실·음악실).')
add_bld('bld-hall-9', '대학 강의동(붉은 벽돌 3층, 슬레이트 모임지붕, 폭 9)', bld('br', 9, 3, roof='hip', D=3, door=4, piers=(), color='slate'), 4,
        ['대학', '강의동', '벽돌'], '캠퍼스 중앙 잔디(쿼드) 둘레. 현관에서 쿼드로 길을 낸다.')
add_bld('bld-hall-6', '대학 강의동(붉은 벽돌 2층, 초록 모임지붕, 폭 6)', bld('br', 6, 2, roof='hip', D=3, door=2, color='green'), 2,
        ['대학', '강의동', '벽돌'], '작은 학과 건물.')
add_bld('bld-admin', '대학 본부(붉은 벽돌 3층, 평지붕 덴틸 코니스, 폭 10)', bld('br', 10, 3, roof='flat', D=3, door=4, rooftop={(2, 1): 'rt.vent', (7, 1): 'rt.ac'}), 4,
        ['대학', '본부', '벽돌'], '정문 정면, 광장 북쪽.')
add_bld('bld-library', '도서관(유리 커튼월 3층, 폭 10)', bld('gl', 10, 3, roof='flat', D=3, door=4, rooftop={(2, 1): 'rt.solarL', (3, 1): 'rt.solarR', (7, 1): 'rt.ac'}), 4,
        ['대학', '학교', '도서관'], '쿼드 끝 또는 광장 옆. 앞에 벤치·자전거 거치대.')
add_bld('bld-union', '학생회관(1층 유리 + 벽돌 2층, 폭 8)', bld('br', 8, 3, roof='flat', D=3, door=3, ground='gl', rooftop={(5, 1): 'rt.ac'}), 3,
        ['대학', '학생회관', '식당'], '식당·매점이 든 학생회관. 앞에 파라솔 탁자.')
add_bld('bld-dorm-7', '기숙사(크림 미장 4층 발코니, 붉은 기와 모임지붕, 폭 7)', bld('cr', 7, 4, roof='hip', D=3, door=3, color='clay'), 3,
        ['기숙사', '대학', '학교'], '캠퍼스 가장자리, 운동장·주차장 반대편 조용한 곳.')
add_bld('bld-dorm-flat', '기숙사(크림 미장 3층, 평지붕, 폭 6)', bld('cr', 6, 3, roof='flat', D=3, door=2, rooftop={(3, 1): 'rt.tank'}), 2,
        ['기숙사', '학교'], '기숙사 별동.')
add_bld('bld-gym', '체육관(금속 골판 모임지붕, 폭 10)', bld('gy', 10, 1, roof='seam', D=4, door=4, color='blue'), 4,
        ['체육관', '학교', '대학'], '운동장 옆. 큰 철문 앞은 비운다.')
add_bld('bld-gym-green', '강당(초록 골판 모임지붕, 폭 8)', bld('gy', 8, 1, roof='seam', D=3, door=3, color='green'), 3,
        ['강당', '체육관', '학교'], '학교 강당·체육관.')

# 변형(같은 블록, 다른 조합) — 조수가 크기·용도를 골라 쓰도록
add_bld('bld-school-6', '학교 별관(흰 콘크리트 3층, 평지붕, 폭 6)', bld('kr', 6, 3, D=3, door=2, piers=(4,), rooftop={(1, 1): 'rt.ac', (4, 1): 'rt.tank'}), 2,
        ['학교', '별관', '교실동'], '작은 교실동·특별실동. 본관과 2칸 이상 띄워 나란히.')
add_bld('bld-cafeteria', '급식동(1층 유리 + 흰 콘크리트 2층, 폭 8)', bld('kr', 8, 2, D=3, door=3, ground='gl', rooftop={(1, 1): 'rt.vent', (6, 1): 'rt.ac'}), 3,
        ['학교', '급식실', '식당'], '급식실·매점 동. 운동장 반대쪽, 본관 옆.')
add_bld('bld-lab', '연구동(유리 커튼월 2층, 폭 6)', bld('gl', 6, 2, roof='flat', D=3, door=2, rooftop={(1, 1): 'rt.solarL', (2, 1): 'rt.solarR', (4, 1): 'rt.ac'}), 2,
        ['대학', '연구동', '유리'], '작은 연구동·실험동. 쿼드 모서리.')
add_bld('bld-hall-12', '대학 대강의동(붉은 벽돌 3층, 슬레이트 모임지붕, 폭 12)', bld('br', 12, 3, roof='hip', D=4, door=5, color='slate'), 5,
        ['대학', '강의동', '벽돌'], '쿼드 북쪽 중심 건물. 현관에서 쿼드 가운데 길로 잇는다.')
add_bld('bld-hall-7', '대학 학과동(붉은 벽돌 2층, 붉은 기와 모임지붕, 폭 7)', bld('br', 7, 2, roof='hip', D=3, door=3, color='clay'), 3,
        ['대학', '학과동', '벽돌'], '쿼드 둘레 작은 학과 건물.')
add_bld('bld-dorm-5', '기숙사 소동(크림 미장 3층, 초록 모임지붕, 폭 5)', bld('cr', 5, 3, roof='hip', D=3, door=2, color='green'), 2,
        ['기숙사', '학교'], '기숙사 작은 동. 큰 기숙사 옆에 1~2동.')
# 2026-10-20 사용자 승인 시안(modern-tiles-proto ground roof-campus-green): 모든 평지붕이 같은 초록 도막인 단조로움을 깨는 대안 키트.
# 옛 bld-dorm-flat 은 그대로 둔다(관문 영수증이 있는 판 — 새 그림은 영수증을 따로 받아야 굽힌다).
add_bld('bld-dorm-flat-green', '기숙사(크림 미장 3층, 옥상 녹화 평지붕, 폭 6)', bld('cr', 6, 3, roof='green', D=3, door=2, rooftop={'walk': 3}), 2,
        ['기숙사', '학교', '옥상 녹화'], '기숙사 별동의 옥상 녹화 판: 파라펫 안 자갈 점검 띠·알루미늄 테 세덤 매트·가운데 점검 보도판. bld-dorm-flat 대신 골라 쓴다.')


def sheet(path=None, z=3):
    items = [(it['id'], R.render(it).img()) for it in R.items]
    return contact(items, path or os.path.join(OUT, 'buildings', 'preview.png'), z=z, W=2200)


if __name__ == '__main__':
    R.export(); sheet()
    print(len(R.items), 'buildings', len(B), 'blocks')
