"""castle_kit — 성채 건축·바닥 키트(공용 wz-castle-*). 옛 이끼 낀 어두운 성 석재."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from wzlib import REG, Cv, K, OL, OL2, run_module   # noqa: E402

MODULE = 'castle_kit'
SP = 'shared'
ST = 'stone'


def hsh(x, y, s=0):
    return (((x * 73856093) ^ (y * 19349663) ^ (s * 83492791)) & 0xffff) / 65536.0


# ───────────────────────── 벽 공통 도우미 ─────────────────────────
FACE_Y0 = 16
COURSES = (6, 7, 6, 7, 6, 6, 4)
CUTS = ((0, 10), (5,), (0, 7), (3, 12), (0, 9), (6,), (0, 11))


def wall_face(c, x0, w, y0=FACE_Y0, courses=COURSES, cuts=CUTS, base=3, shadow_top=True, moss=0.0, seed=0):
    """실내 쪽 벽 정면: 큰 비정형 블록 단. 16 주기."""
    y = y0
    for ri, rh in enumerate(courses):
        cut = sorted(cuts[ri % len(cuts)])
        for x in range(x0, x0 + w):
            lx = x % 16
            start = max([k for k in cut if k <= lx] or [cut[-1] - 16])
            bid = (ri * 7 + start) % 11
            tone = base + (-1 if hsh(bid, ri, 3 + seed) < 0.28 else (1 if hsh(bid, ri, 8 + seed) > 0.86 else 0))
            for yy in range(y, y + rh):
                col = K(ST, tone)
                if yy == y:
                    col = K(ST, tone + 1)
                elif yy == y + rh - 1:
                    col = K(ST, 1)
                if lx == start and yy != y + rh - 1:
                    col = K(ST, tone + 1)
                nxt = (lx + 1) % 16
                if (nxt in cut) and yy != y + rh - 1:
                    col = K(ST, 2)
                c.P(x, yy, col)
            if hsh(x, ri, 9 + seed) < 0.035 and rh > 4:
                c.P(x, y + 2 + int(hsh(x, ri, 5) * (rh - 4)), K(ST, tone - 1))
            if moss and hsh(lx, ri, 33 + seed) < moss:        # 줄눈 이끼
                c.P(x, y + rh - 1, K('leaf', 2))
                if hsh(lx, ri, 44 + seed) < 0.6 and rh > 4:
                    c.P(x, y + rh - 2, K('leaf', 1 + int(hsh(lx, ri, 55) * 2)))
        y += rh
    if shadow_top:
        c.HL(x0, y0, w, K(ST, 2))


def plinth(c, x0, w, y0=58, h=6):
    c.R(x0, y0, w, h, K(ST, 3)); c.HL(x0, y0, w, K(ST, 4))
    for x in range(x0, x0 + w):
        if x % 16 in (5, 12):
            c.VL(x, y0 + 1, h - 2, K(ST, 2))
    c.HL(x0, y0 + h - 2, w, K(ST, 2)); c.HL(x0, y0 + h - 1, w, K(ST, 1))


def cap(c, x0, w, y0=0, outline_top=True):
    """북벽 윗면(두께 10px) + 앞 모서리."""
    c.R(x0, y0, w, 10, K(ST, 4))
    for x in range(x0, x0 + w):
        lx = x % 16
        for y in range(y0 + 1, y0 + 9):
            h = hsh(lx, y, 21)
            if h < 0.06:
                c.P(x, y, K(ST, 3))
            elif h > 0.96:
                c.P(x, y, K(ST, 5))
        if lx in (15, 7):
            c.VL(x, y0 + 1, 8, K(ST, 3))
    c.HL(x0, y0 + 1, w, K(ST, 5))
    c.R(x0, y0 + 10, w, 1, K(ST, 5))
    c.R(x0, y0 + 11, w, 4, K(ST, 3)); c.HL(x0, y0 + 11, w, K(ST, 4))
    for x in range(x0, x0 + w):
        if x % 16 in (7, 15):
            c.VL(x, y0 + 12, 3, K(ST, 2))
    c.HL(x0, y0 + 14, w, K(ST, 2)); c.HL(x0, y0 + 15, w, K(ST, 1))
    if outline_top:
        c.HL(x0, y0, w, K(ST, 1))


def wall_n_base(c, x0=0, w=16, moss=0.0, seed=0):
    cap(c, x0, w); wall_face(c, x0, w, moss=moss, seed=seed); plinth(c, x0, w)


def arch_mask(cx, y_top, w, y_bot, ah):
    cells = set()
    for y in range(y_top, y_bot + 1):
        r = y - y_top
        if r < ah:
            t = (r + 0.5) / ah
            hw = (w / 2) * (1 - (1 - t) ** 2) ** 0.72
        else:
            hw = w / 2
        for x in range(int(cx - w / 2 - 1), int(cx + w / 2 + 2)):
            if abs(x + 0.5 - cx) <= hw:
                cells.add((x, y))
    return cells


def dilate(m, n=1):
    out = set(m)
    for _ in range(n):
        add = set()
        for (x, y) in out:
            for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                add.add((x + ox, y + oy))
        out |= add
    return out


def side_top(c, x0, y0, h, west, w=16):
    """서/동 벽 윗면 띠(세로). 폭 w."""
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            col = K(ST, 4)
            hv = hsh(x - x0, y % 16, 61 if west else 62)
            if hv < 0.06:
                col = K(ST, 3)
            elif hv > 0.96:
                col = K(ST, 5)
            if y % 16 in (7, 15) and x - x0 not in (0, w - 1):
                col = K(ST, 3)
            c.P(x, y, col)
    if west:
        c.VL(x0, y0, h, K(ST, 1)); c.VL(x0 + 1, y0, h, K(ST, 5))
        c.VL(x0 + w - 3, y0, h, K(ST, 3)); c.VL(x0 + w - 2, y0, h, K(ST, 2)); c.VL(x0 + w - 1, y0, h, K(ST, 1))
    else:
        c.VL(x0 + w - 1, y0, h, K(ST, 1)); c.VL(x0 + w - 2, y0, h, K(ST, 3))
        c.VL(x0, y0, h, K(ST, 1)); c.VL(x0 + 1, y0, h, K(ST, 2)); c.VL(x0 + 2, y0, h, K(ST, 3))
        c.VL(x0 + 3, y0, h, K(ST, 5))


def south_cap(c, x0, w):
    c.R(x0, 0, w, 10, K(ST, 4))
    for x in range(x0, x0 + w):
        lx = x % 16
        for y in range(1, 9):
            h = hsh(lx, y, 71)
            if h < 0.06:
                c.P(x, y, K(ST, 3))
            elif h > 0.96:
                c.P(x, y, K(ST, 5))
        if lx in (15, 7):
            c.VL(x, 1, 8, K(ST, 3))
    c.HL(x0, 0, w, K(ST, 5)); c.HL(x0, 1, w, K(ST, 5))
    c.HL(x0, 10, w, K(ST, 5)); c.HL(x0, 11, w, K(ST, 3))


def south_front(c, x0, w, y0=12, h=20):
    c.R(x0, y0, w, h, K(ST, 3))
    wall_face(c, x0, w, y0=y0, courses=(6, 7, 7), cuts=((0, 10), (5,), (0, 7)), shadow_top=False)
    c.HL(x0, y0, w, K(ST, 2))
    c.HL(x0, y0 + h - 2, w, K(ST, 2)); c.HL(x0, y0 + h - 1, w, K(ST, 1))


def window_piece(c, cx, w, y_top, y_bot, ah, panes_v=1, bars=(0.34, 0.68), cw=None):
    cw = cw or c.w if hasattr(c, 'w') else 16
    M = arch_mask(cx, y_top, w, y_bot, ah)
    ring = dilate(M, 2) - dilate(M, 1)
    for (x, y) in ring:
        if y <= y_bot and 0 <= x < cw:
            c.P(x, y, K(ST, 5) if (x + y) % 4 else K(ST, 4))
    groove = dilate(M, 1) - M
    for (x, y) in groove:
        if y <= y_bot + 1 and 0 <= x < cw:
            c.P(x, y, K(ST, 2) if (x < cx or y < y_top + ah) else K(ST, 3))
    gcells = []
    for (x, y) in M:
        if (x, y - 1) not in M:
            c.P(x, y, K(ST, 1))
        elif (x, y - 2) not in M:
            c.P(x, y, K(ST, 2))
        elif (x - 1, y) not in M:
            c.P(x, y, K(ST, 2))
        elif (x + 1, y) not in M:
            c.P(x, y, K(ST, 5))
        else:
            gcells.append((x, y))
    if not gcells:
        return
    gy0 = min(y for _, y in gcells); gy1 = max(y for _, y in gcells)
    gx0 = min(x for x, _ in gcells); gx1 = max(x for x, _ in gcells)
    for (x, y) in gcells:
        f = (y - gy0) / max(1, gy1 - gy0)
        c.P(x, y, K('water', 4 if f < 0.55 else (3 if f < 0.9 else 2)))
    gset = set(gcells)
    for pv in range(1, panes_v + 1):
        mx = gx0 + (gx1 - gx0 + 1) * pv // (panes_v + 1)
        for y in range(gy0, gy1 + 1):
            if (mx, y) in gset:
                c.P(mx, y, K('night', 2))
    for b in bars:
        by = gy0 + int((gy1 - gy0) * b)
        for x in range(gx0, gx1 + 1):
            if (x, by) in gset:
                c.P(x, by, K('night', 2))
    for (x, y) in gcells:                                  # 짧은 반사
        if (x - gx0, y - gy0) in ((1, 3), (1, 4), (2, 2)) and (x, y) in gset and c.get(x, y) == K('water', 4):
            c.P(x, y, K('water', 5))
    sx0 = max(0, int(cx - w / 2 - 3)); sx1 = min(cw - 1, int(cx + w / 2 + 3))
    sw = sx1 - sx0 + 1
    c.R(sx0, y_bot + 1, sw, 2, K(ST, 5)); c.HL(sx0, y_bot + 1, sw, K(ST, 5))
    c.R(sx0, y_bot + 3, sw, 2, K(ST, 3)); c.HL(sx0, y_bot + 5, sw, K(ST, 2))
    c.P(sx0, y_bot + 1, K(ST, 4)); c.P(sx1, y_bot + 1, K(ST, 3))


# ───────────────────────── 북쪽 벽 ─────────────────────────
@REG.piece('wz-castle-wall-n', '성채 북벽(직선)', 1, 4, ['S', 'S', 'S', 'S'], 'architecture', SP,
           desc='성채 북쪽 벽 1칸. 0행은 벽 윗면(두께), 1~3행은 실내 쪽 큰 석재 정면. 가로로 이어 칠한다.',
           rules='북쪽 0~3행에 가로로 이어 칠한다. 창·문·기둥 조각으로 군데군데 바꾼다.', tags=['성벽', '북벽'], role='wall', repeat=True)
def _wall_n(c):
    wall_n_base(c)
    c.outline()


@REG.piece('wz-castle-wall-n-repair', '성채 북벽(수선 흔적)', 1, 4, ['S', 'S', 'S', 'S'], 'architecture', SP,
           desc='보수한 북벽. 새 석재가 끼어 색이 밝다.', rules='직선 북벽 사이에 섞어 낡은 분위기를 낸다. 이어 칠하기 가능.',
           tags=['성벽', '수선'], role='wall', repeat=True)
def _wall_n_repair(c):
    wall_n_base(c, seed=3)
    # 새로 끼운 석재 2개: wall_face 의 단(course)·줄눈 칸에 정확히 맞춘 블록을 밝은 새 돌로 교체.
    # (x0, x1) = 그 단의 줄눈 사이, (y0, y1) = 단 윗줄 ~ 줄눈 바로 위. 둘레 줄눈은 새 회반죽(한 단 밝은 K2)으로.
    for (x0, x1, y0, y1) in ((3, 12, 35, 41), (0, 9, 42, 47)):
        for y in range(y0 - 1, y1 + 1):                     # 새 회반죽 줄눈 테
            for x in (x0 - 1, x1):
                c.P(x % 16, y, K(ST, 2))
        c.HL(x0, y0 - 1, x1 - x0, K(ST, 2)); c.HL(x0, y1, x1 - x0, K(ST, 2))
        for y in range(y0, y1):
            for x in range(x0, x1):
                col = K(ST, 4)
                if y == y0 or x == x0:
                    col = K(ST, 5)
                elif x == x1 - 1 or y == y1 - 1:
                    col = K(ST, 3)
                c.P(x, y, col)
    c.P(5, 44, K(ST, 3))                                    # 새 돌의 정 자국 하나
    c.outline()


@REG.piece('wz-castle-wall-n-moss', '성채 북벽(이끼 줄눈)', 1, 4, ['S', 'S', 'S', 'S'], 'architecture', SP,
           desc='줄눈에 이끼가 낀 북벽.', rules='직선 북벽 사이에 섞는다. 이어 칠하기 가능.', tags=['성벽', '이끼'], role='wall', repeat=True)
def _wall_n_moss(c):
    wall_n_base(c, moss=0.45, seed=5)
    for x in (3, 4, 11):
        c.P(x, 57, K('leaf', 2))
    c.outline()


@REG.piece('wz-castle-wall-n-window', '성채 북벽 납살 창', 1, 4, ['S', 'S', 'S', 'S'], 'architecture', SP,
           desc='첨두 아치 납살 유리창과 깊은 창턱이 있는 북벽 1칸.', rules='직선 북벽 사이에 넣는다.', tags=['창', '북벽'], role='wall')
def _wall_n_window(c):
    wall_n_base(c)
    window_piece(c, 8, 8, 18, 46, 9, cw=16)
    c.outline()


@REG.piece('wz-castle-wall-n-window2', '성채 북벽 쌍창(2칸 폭)', 2, 4, ['SS', 'SS', 'SS', 'SS'], 'architecture', SP,
           desc='깊은 창턱의 넓은 납살 창 2칸 폭.', rules='2칸 폭 북벽 자리에 넣는다.', tags=['창', '북벽'], role='wall')
def _wall_n_window2(c):
    wall_n_base(c, 0, 32)
    window_piece(c, 16, 18, 19, 47, 11, panes_v=2, bars=(0.28, 0.55), cw=32)
    c.outline()


@REG.piece('wz-castle-wall-n-pillar', '성채 북벽 버트레스', 1, 4, ['S', 'S', 'S', 'S'], 'architecture', SP,
           desc='벽 앞으로 튀어나온 돌 벽기둥. 윗면이 보인다.', rules='북벽 사이에 일정 간격으로 넣는다.', tags=['기둥', '버트레스'], role='wall')
def _wall_n_pillar(c):
    wall_n_base(c)
    x0, x1 = 2, 13
    w = x1 - x0 + 1
    # 기둥 윗면
    c.R(x0, 14, w, 8, K(ST, 4)); c.HL(x0, 14, w, K(ST, 1)); c.HL(x0, 15, w, K(ST, 5)); c.VL(x0, 15, 7, K(ST, 5))
    c.VL(x1, 15, 7, K(ST, 3))
    c.P(6, 18, K(ST, 3)); c.P(9, 17, K(ST, 5))
    # 앞면
    c.R(x0, 22, w, 36, K(ST, 3))
    wall_face(c, x0, w, y0=22, courses=(6, 6, 7, 6, 6, 5), cuts=((0, 8), (4, 12), (0, 6)), base=3, shadow_top=False, seed=2)
    c.HL(x0, 22, w, K(ST, 2))
    c.VL(x1 - 1, 23, 35, K(ST, 2)); c.VL(x1, 23, 35, K(ST, 1)); c.VL(x0, 22, 36, K(ST, 4))
    plinth(c, 1, 14)
    c.outline()


@REG.piece('wz-castle-wall-n-buttress-ext', '성채 외벽 버트레스(바깥쪽)', 1, 4, ['S', 'S', 'S', 'S'], 'architecture', SP,
           desc='성 바깥에서 본 벽에 붙은 계단식 버트레스. 위로 갈수록 좁다.', rules='성 밖 공간의 외벽에 쓴다.', tags=['버트레스', '외벽'], role='wall')
def _wall_buttress_ext(c):
    wall_n_base(c, moss=0.2, seed=7)
    for (y0, y1, xa, xb) in ((16, 28, 4, 11), (28, 44, 3, 12), (44, 58, 2, 13)):
        c.R(xa, y0, xb - xa + 1, y1 - y0, K(ST, 3))
        wall_face(c, xa, xb - xa + 1, y0=y0, courses=(6, 6, 6, 6, 4)[: max(1, (y1 - y0) // 6)], cuts=((0, 8), (4, 12)), shadow_top=False, seed=4)
        c.HL(xa, y0, xb - xa + 1, K(ST, 5))
        c.VL(xa, y0, y1 - y0, K(ST, 4)); c.VL(xb, y0, y1 - y0, K(ST, 1))
        c.HL(xa, y1 - 1, xb - xa + 1, K(ST, 2))
    plinth(c, 1, 14)
    c.outline()


# ───────────────────────── 모서리·끝·T ─────────────────────────
@REG.piece('wz-castle-wall-nw', '성채 북서 바깥 모서리', 1, 4, ['S', 'S', 'S', 'S'], 'architecture', SP,
           desc='북쪽 벽과 서쪽 벽이 만나는 모서리. 서벽 윗면 띠가 아래로 이어진다.', rules='서쪽 열 맨 위(0~3행).', tags=['모서리'], role='wall')
def _wall_nw(c):
    side_top(c, 0, 0, 64, True)
    c.HL(0, 0, 16, K(ST, 1)); c.HL(1, 1, 14, K(ST, 5))
    c.HL(0, 15, 16, K(ST, 2))              # 모서리 돌 이음
    c.outline()


@REG.piece('wz-castle-wall-ne', '성채 북동 바깥 모서리', 1, 4, ['S', 'S', 'S', 'S'], 'architecture', SP,
           desc='북쪽 벽과 동쪽 벽이 만나는 모서리.', rules='동쪽 열 맨 위(0~3행).', tags=['모서리'], role='wall')
def _wall_ne(c):
    side_top(c, 0, 0, 64, False)
    c.HL(0, 0, 16, K(ST, 1)); c.HL(4, 1, 11, K(ST, 5))
    c.HL(0, 15, 16, K(ST, 2))
    c.outline()


@REG.piece('wz-castle-wall-w', '성채 서벽 윗면 띠', 1, 1, ['S'], 'architecture', SP,
           desc='서쪽 벽 윗면 띠 1칸. 세로로 이어 칠한다.', rules='서쪽 가장자리 열에 세로로 이어 칠한다.', tags=['서벽'], role='wall', repeat=True)
def _wall_w(c):
    side_top(c, 0, 0, 16, True)


@REG.piece('wz-castle-wall-e', '성채 동벽 윗면 띠', 1, 1, ['S'], 'architecture', SP,
           desc='동쪽 벽 윗면 띠 1칸. 세로로 이어 칠한다.', rules='동쪽 가장자리 열에 세로로 이어 칠한다.', tags=['동벽'], role='wall', repeat=True)
def _wall_e(c):
    side_top(c, 0, 0, 16, False)


@REG.piece('wz-castle-wall-s', '성채 남쪽 낮춘 벽', 1, 2, ['S', 'S'], 'architecture', SP,
           desc='남쪽 낮춘 절단벽. 0행 윗면, 1행 낮은 정면.', rules='실내 남쪽 마지막 2행에 가로로 이어 칠한다.', tags=['남벽'], role='wall', repeat=True)
def _wall_s(c):
    south_cap(c, 0, 16); south_front(c, 0, 16)
    c.outline()


@REG.piece('wz-castle-wall-sw', '성채 남서 모서리', 1, 2, ['S', 'S'], 'architecture', SP,
           desc='남쪽 낮춘 벽의 서쪽 끝 모서리.', rules='서쪽 열 맨 아래 2행.', tags=['모서리'], role='wall')
def _wall_sw(c):
    south_cap(c, 0, 16); south_front(c, 0, 16)
    c.VL(0, 0, 32, K(ST, 1)); c.VL(1, 2, 28, K(ST, 4)); c.VL(2, 12, 18, K(ST, 4))
    c.outline()


@REG.piece('wz-castle-wall-se', '성채 남동 모서리', 1, 2, ['S', 'S'], 'architecture', SP,
           desc='남쪽 낮춘 벽의 동쪽 끝 모서리.', rules='동쪽 열 맨 아래 2행.', tags=['모서리'], role='wall')
def _wall_se(c):
    south_cap(c, 0, 16); south_front(c, 0, 16)
    c.VL(15, 0, 32, K(ST, 1)); c.VL(14, 2, 28, K(ST, 3)); c.VL(13, 12, 18, K(ST, 2))
    c.outline()


def _n_end(c, left):
    wall_n_base(c)
    if left:
        c.VL(0, 0, 64, K(ST, 1)); c.VL(1, 1, 57, K(ST, 4)); c.VL(2, 12, 46, K(ST, 4)); c.VL(3, 16, 42, K(ST, 3))
    else:
        c.VL(15, 0, 64, K(ST, 1)); c.VL(14, 1, 57, K(ST, 2)); c.VL(13, 12, 46, K(ST, 2)); c.VL(12, 16, 42, K(ST, 2))
    c.outline()


@REG.piece('wz-castle-wall-n-end-l', '성채 북벽 왼쪽 끝', 1, 4, ['S', 'S', 'S', 'S'], 'architecture', SP,
           desc='북벽이 왼쪽에서 끝나는 마감.', rules='벽 왼쪽 끝/열린 통로 왼쪽.', tags=['끝마감'], role='wall')
def _n_end_l(c): _n_end(c, True)


@REG.piece('wz-castle-wall-n-end-r', '성채 북벽 오른쪽 끝', 1, 4, ['S', 'S', 'S', 'S'], 'architecture', SP,
           desc='북벽이 오른쪽에서 끝나는 마감.', rules='벽 오른쪽 끝/열린 통로 오른쪽.', tags=['끝마감'], role='wall')
def _n_end_r(c): _n_end(c, False)


@REG.piece('wz-castle-wall-t-w', '성채 T접합(서쪽 칸막이)', 1, 4, ['S', 'S', 'S', 'S'], 'architecture', SP,
           desc='북벽에서 남쪽으로 내려가는 칸막이 벽의 서쪽 면(윗면 띠가 아래로 이어짐).', rules='칸막이 벽이 북벽과 만나는 칸의 왼쪽.', tags=['T접합'], role='wall')
def _t_w(c):
    _t_junction(c, True)


def _t_junction(c, west):
    """북벽 윗면(0행 위 10px)이 좌우로 이어지고, 같은 칸에서 칸막이 윗면 띠가 아래로 내려간다.
    띠는 wall-w/-e 와 같은 side_top(폭 16, 같은 x·윤곽)이라 아래 칸과 이음새 없이 이어진다."""
    cap(c, 0, 16)
    side_top(c, 0, 10, 54, west)
    c.outline()


@REG.piece('wz-castle-wall-t-e', '성채 T접합(동쪽 칸막이)', 1, 4, ['S', 'S', 'S', 'S'], 'architecture', SP,
           desc='북벽에서 남쪽으로 내려가는 칸막이 벽의 동쪽 면.', rules='칸막이 벽이 북벽과 만나는 칸의 오른쪽.', tags=['T접합'], role='wall')
def _t_e(c):
    _t_junction(c, False)



# ───────────────────────── 바닥 질감(16 주기) ─────────────────────────
FLAG_V = {
    'a': (((0, 7), (0, 9)), ((4, 12), (0, 8)), 11),
    'b': (((0, 5), (5, 6), (11, 5)), ((0, 8), (3, 11), (6, 13)), 23),
    'c': (((0, 9), (9, 7)), ((5,), (0, 10)), 37),
}


def slab_tile(m, variant='a', worn=False, base=3):
    courses, cutsets, seed = FLAG_V[variant]
    cs = (courses, cutsets)
    c = Cv(16, 16)
    rows = [(0, 7), (7, 9)] if variant == 'a' else ([(0, 5), (5, 6), (11, 5)] if variant == 'b' else [(0, 9), (9, 7)])
    cuts_per = {'a': ((0, 9), (4, 12)), 'b': ((0, 8), (3, 11), (6, 13)), 'c': ((5,), (0, 10))}[variant]
    c.R(0, 0, 16, 16, K(m, base - 2))
    for ri, (y0, h) in enumerate(rows):
        cuts = sorted(cuts_per[ri])
        n = len(cuts)
        for si in range(n):
            a = cuts[si]; b = cuts[(si + 1) % n] + (16 if si == n - 1 else 0)
            tone = base + (1 if hsh(si, ri, seed) > 0.75 else (-1 if hsh(si, ri, seed + 5) > 0.82 else 0))
            tone = max(2, min(4, tone))
            for yy in range(y0, y0 + h):
                for xx in range(a, b):
                    x = xx % 16
                    t = tone
                    if yy == y0 or xx == a:
                        t = tone + 1
                    if yy == y0 + h - 1 or xx == b - 1:
                        t = base - 2
                    elif yy == y0 + h - 2 or xx == b - 2:
                        t = tone - 1 if (yy != y0 and xx != a) else t
                    c.P(x, yy % 16, K(m, t))
            for k in range(3):
                px = a + 2 + int(hsh(si + k, ri, seed + 9) * max(1, b - a - 4))
                py = y0 + 2 + int(hsh(k, si + ri, seed + 3) * max(1, h - 4))
                if hsh(px, py, seed) < 0.55:
                    c.P(px % 16, py % 16, K(m, tone + 1 if k else tone - 1))
    if worn == 'light':                                     # 닳음 약하게: 금 1~2개 + 닳은 자국 몇 점
        for (x, y) in ((5, 6), (6, 7), (7, 7), (8, 8)):         # 가운데 판석의 긴 금(밝은 테두리 없음)
            c.P(x, y, K(m, 1))
        for (x, y) in ((14, 12), (15, 13)):                     # 짧은 잔금
            c.P(x, y, K(m, 1))
        for (x, y) in ((11, 2), (12, 2), (2, 13), (3, 13)):     # 밟혀 파인 자리
            c.P(x, y, K(m, base - 1))
    elif worn:
        for (wx, wy) in ((3, 3), (11, 5), (6, 11), (13, 13), (1, 9)):
            for (dx, dy, dt) in ((0, 0, -1), (1, 0, -1), (0, 1, -1), (-1, 0, 1)):
                px, py = (wx + dx) % 16, (wy + dy) % 16
                c.P(px, py, K(m, max(1, base - 1 + dt)))
        for (wx, wy) in ((8, 2), (2, 14), (12, 10)):
            c.P(wx, wy, K(m, base + 2)); c.P((wx + 1) % 16, wy, K(m, base + 1))
        a0 = {'a': (5, 1), 'b': (10, 7), 'c': (1, 11)}[variant]
        for k in range(5):
            c.P((a0[0] + k) % 16, (a0[1] + k // 2) % 16, K(m, 1))
    return c


OAK_V = {'a': ((3,), (11,), (7,), (14,)), 'b': ((9,), (2,), (13,), (5,)), 'c': ((6,), (14,), (1,), (10,))}


def oak_tile(variant='a'):
    c = Cv(16, 16)
    for j in range(4):
        y0 = j * 4
        tone = 3 + (1 if hsh(j, 0, ord(variant)) > 0.7 else (-1 if hsh(j, 1, ord(variant)) > 0.8 else 0))
        c.R(0, y0, 16, 4, K('wood', tone))
        c.HL(0, y0, 16, K('wood', tone + 1))
        c.HL(0, y0 + 3, 16, K('wood', 1))
        for cx in OAK_V[variant][j]:
            c.VL(cx, y0, 3, K('wood', 2)); c.VL((cx + 1) % 16, y0, 3, K('wood', tone + 1))
        for k in range(2):                                  # 긴 결
            gx = int(hsh(j, k, ord(variant) + 4) * 14)
            c.HL(gx, y0 + 1 + k, 4 + k * 2, K('wood', tone - 1) if (gx + j) % 2 else K('wood', tone + 1))
        if hsh(j, 3, ord(variant)) > 0.7:
            c.P(2 + j * 3, y0 + 2, K('wood', 1))
    return c


def _floor(id, name, tile, desc, tags, variant_note=''):
    @REG.piece(id, name, 1, 1, ['F'], 'surfaces', SP, desc=desc, rules='3×3 이상 반복해도 이음새가 없는 16 주기 바닥. 가장자리는 벽·문턱 조각으로 마감.',
               tags=tags, role='terrain', repeat=True)
    def _fn(c):
        c.blit(tile(), 0, 0)
    return _fn


for _v, _n in (('a', ''), ('b', '-b'), ('c', '-c')):
    _floor('wz-castle-floor-flag' + _n, '성채 포석 바닥' + (_v.upper() if _n else ''), (lambda v=_v: slab_tile(ST, v)),
           '마른 석재 포석 1칸. 비정형 큰 판석 두 줄.', ['바닥', '포석'])
    _floor('wz-castle-floor-flag-worn' + _n, '성채 닳은 포석' + (_v.upper() if _n else ''),
           (lambda v=_v: slab_tile(ST, v, worn=('light' if v == 'b' else True))),
           '오래 밟혀 가운데가 닳고 금이 간 포석.', ['바닥', '포석', '닳음'])
    _floor('wz-castle-floor-oak' + _n, '성채 오크 마루' + (_v.upper() if _n else ''), (lambda v=_v: oak_tile(v)),
           '긴 결의 오크 널마루 1칸.', ['바닥', '오크', '마루'])


# ───────────────────────── 오토타일 ─────────────────────────
def _corner_cut(p, x0, y0, x1, y1, col):
    for (cx, cy, dx, dy) in ((x0, y0, 1, 1), (x1 - 1, y0, -1, 1), (x0, y1 - 1, 1, -1), (x1 - 1, y1 - 1, -1, -1)):
        p.P(cx, cy, col); p.P(cx + dx, cy, col); p.P(cx, cy + dy, col)


@REG.autotile('wz-castle-flag', '성채 포석(오토타일)', 'surfaces', SP, desc='마른 석재 포석. 바깥은 어두운 틈과 그늘.',
              rules='속은 포석 질감이 이어지고 가장자리는 어두운 틈 + 밝은 모서리 판석.', tags=['바닥', '포석'])
def _at_flag():
    t = slab_tile(ST, 'a')
    p = Cv(48, 48)
    for y in range(48):
        for x in range(48):
            h = hsh(x, y, 4)
            p.P(x, y, K(ST, 0) if h > 0.12 else K(ST, 1))
    p.tile(t, 3, 3, 42, 42)
    _corner_cut(p, 3, 3, 45, 45, K(ST, 0))
    p.HL(3, 3, 42, K(ST, 5)); p.VL(3, 3, 42, K(ST, 5))
    p.HL(3, 44, 42, K(ST, 1)); p.VL(44, 3, 42, K(ST, 1))
    p.HL(1, 46, 46, K(ST, 1))
    p.outline_rect(2, 2, 44, 44, K(ST, 0))
    p.HL(3, 3, 3, K(ST, 0)); p.VL(3, 3, 3, K(ST, 0))
    ic = Cv(16, 16); ic.tile(t, 0, 0, 16, 16)
    for (x, y, dx, dy) in ((0, 0, 1, 1), (15, 0, -1, 1), (0, 15, 1, -1), (15, 15, -1, -1)):
        ic.P(x, y, K(ST, 0)); ic.P(x + dx, y, K(ST, 1)); ic.P(x, y + dy, K(ST, 1))
    return p, ic


@REG.autotile('wz-castle-oak', '성채 오크 마루(오토타일)', 'surfaces', SP, desc='오크 널마루. 바깥은 석재 포석.',
              rules='속은 오크 결, 가장자리는 석재와 맞닿는 어두운 이음 + 밝은 널.', tags=['바닥', '오크', '마루'])
def _at_oak():
    st = slab_tile(ST, 'a'); ot = oak_tile('a')
    p = Cv(48, 48); p.tile(st, 0, 0, 48, 48)
    p.tile(ot, 3, 3, 42, 42)
    _corner_cut(p, 3, 3, 45, 45, K(ST, 3))
    p.outline_rect(2, 2, 44, 44, K('wood', 0))
    p.HL(3, 3, 42, K('wood', 5)); p.VL(3, 3, 42, K('wood', 4))
    p.HL(3, 44, 42, K('wood', 1)); p.VL(44, 3, 42, K('wood', 1))
    p.HL(3, 46, 43, K(ST, 1)); p.VL(46, 3, 43, K(ST, 1))
    ic = Cv(16, 16); ic.tile(ot, 0, 0, 16, 16)
    for (x, y, dx, dy) in ((0, 0, 1, 1), (15, 0, -1, 1), (0, 15, 1, -1), (15, 15, -1, -1)):
        ic.P(x, y, K(ST, 1)); ic.P(x + dx, y, K('wood', 1)); ic.P(x, y + dy, K('wood', 1))
    return p, ic


# ───────────────────────── 문틀·문 ─────────────────────────
DOOR_YT, DOOR_YB = 22, 61          # 개구부 40px(y=22..61) — 문 높이 기준 32~40


def door_frame(c, cx, w, ah=None):
    ah = ah or int(w * 0.62)
    M = arch_mask(cx, DOOR_YT, w, DOOR_YB, ah)
    ring = dilate(M, 3) - dilate(M, 1)
    for (x, y) in ring:
        if y <= DOOR_YB + 1 and 0 <= x < c.w:
            fa = (x + y) % 5
            c.P(x, y, K(ST, 5) if fa else K(ST, 4))
    for (x, y) in dilate(M, 2) - dilate(M, 1):
        if 0 <= x < c.w and y <= DOOR_YB + 1:
            c.P(x, y, K(ST, 4) if (x >= cx or y < DOOR_YT + ah) else K(ST, 5))
    for (x, y) in dilate(M, 3) - dilate(M, 2):
        if 0 <= x < c.w and y <= DOOR_YB + 1:
            c.P(x, y, K(ST, 2))
    for (x, y) in dilate(M, 1) - M:
        if 0 <= x < c.w and y <= DOOR_YB + 1:
            c.P(x, y, K(ST, 1))
    # 쐐기돌
    kx = int(cx)
    ytop = DOOR_YT - 3
    for dy in range(-1, 3):
        c.R(kx - 1, ytop + dy, 2, 1, K(ST, 5 if dy < 1 else 4))
    # 문턱
    x0 = max(0, int(cx - w / 2 - 3)); x1 = min(c.w, int(cx + w / 2 + 3))
    c.HL(x0, DOOR_YB + 1, x1 - x0, K(ST, 5)); c.R(x0, DOOR_YB + 2, x1 - x0, 1, K(ST, 4)); c.HL(x0, DOOR_YB + 3, x1 - x0, K(ST, 2))
    return M


def _bounds(M):
    xs = [x for x, _ in M]; ys = [y for _, y in M]
    return min(xs), max(xs), min(ys), max(ys)


def door_leaf(c, M, cx, double):
    gx0, gx1, gy0, gy1 = _bounds(M)
    for (x, y) in M:
        i = (x - gx0) // 4
        tone = (3, 4, 3, 3, 4, 3)[i % 6]
        if (x - gx0) % 4 == 3:
            tone = 2
        if x == gx0:
            tone = 4
        if x == gx1 or (x - gx0) % 4 == 3 and x > gx1 - 4:
            tone = 2
        c.P(x, y, K('wood', tone))
        if (x - gx0) % 4 == 1 and hsh(x, y, 17) > 0.86:
            c.P(x, y, K('wood', 2))
    for (x, y) in M:                                           # 아치 안쪽 그림자
        if (x, y - 1) not in M or (x, y - 2) not in M:
            c.P(x, y, K('wood', 1))
    hgt = gy1 - gy0
    for sy in (gy0 + int(hgt * 0.30), gy0 + int(hgt * 0.74)):
        for x in range(gx0, gx1 + 1):
            if (x, sy) in M:
                c.P(x, sy, K('iron', 3))
            if (x, sy + 1) in M:
                c.P(x, sy + 1, K('iron', 2))
            if (x, sy + 2) in M:
                c.P(x, sy + 2, K('iron', 1))
            if (x, sy - 1) in M and x == gx0:
                pass
        for x in range(gx0 + 1, gx1, 4):
            c.P(x, sy, K('iron', 4))
    if double:
        sx = int(cx)
        for (x, y) in M:
            if x in (sx - 1,):
                c.P(x, y, K('wood', 0))
            if x == sx:
                c.P(x, y, K('wood', 1))
        for hx in (sx - 4, sx + 2):
            _handle(c, hx, gy0 + int(hgt * 0.56))
    else:
        _handle(c, gx1 - 4, gy0 + int(hgt * 0.56))


def _handle(c, x, y):
    c.R(x, y, 3, 3, K('brass', 3)); c.P(x, y, K('brass', 5)); c.P(x + 2, y + 2, K('brass', 1))
    c.HL(x, y + 4, 3, K('brass', 4)); c.VL(x, y + 4, 3, K('brass', 4)); c.VL(x + 2, y + 4, 3, K('brass', 2))
    c.HL(x, y + 6, 3, K('brass', 2))


def door_locked_extra(c, M, cx):
    gx0, gx1, gy0, gy1 = _bounds(M)
    by = gy0 + int((gy1 - gy0) * 0.48)
    x0 = max(0, gx0 - 3); x1 = min(c.w - 1, gx1 + 3)
    for x in range(x0, x1 + 1):
        c.P(x, by, K('iron', 4)); c.P(x, by + 1, K('iron', 3)); c.P(x, by + 2, K('iron', 1))
        if (x, by + 3) in M:
            c.P(x, by + 3, K('wood', 1))
    for bx in (x0, x1 - 1):
        c.R(bx, by - 1, 2, 5, K('iron', 2)); c.P(bx, by - 1, K('iron', 4)); c.P(bx, by, K('brass', 4))
    kx = int(cx)
    c.R(kx - 3, by + 3, 7, 7, K('brass', 3)); c.HL(kx - 3, by + 3, 7, K('brass', 5)); c.VL(kx - 3, by + 4, 6, K('brass', 4))
    c.VL(kx + 3, by + 4, 6, K('brass', 2)); c.HL(kx - 3, by + 9, 7, K('brass', 1))
    c.R(kx - 2, by - 2, 5, 1, K('iron', 4)); c.VL(kx - 2, by - 1, 2, K('iron', 3)); c.VL(kx + 2, by - 1, 2, K('iron', 2))
    c.P(kx, by + 5, K('ink', 0)); c.VL(kx, by + 6, 2, K('ink', 0))
    for (x, y) in ((kx - 3, by + 3), (kx + 3, by + 3), (kx - 3, by + 9), (kx + 3, by + 9)):
        c.P(x, y, K('brass', 2))


def door_open_fill(c, M, cx, leaves, back=1):
    gx0, gx1, gy0, gy1 = _bounds(M)
    for (x, y) in M:
        c.P(x, y, K(ST, back))
    for yy in range(gy0 + 2, gy1 - 9, 6):                       # 안쪽 벽 이음
        for x in range(gx0, gx1 + 1):
            if (x, yy) in M:
                c.P(x, yy, K(ST, back - 1 if back else 0))
    fy = gy1 - 9
    for (x, y) in M:
        if y >= fy:
            t = 3 if (y - fy) < 8 else 2
            c.P(x, y, K(ST, t))
            if (y - fy) in (0,):
                c.P(x, y, K(ST, 5))
            elif (y - fy) in (4,) or (x - gx0) % 7 == 3:
                c.P(x, y, K(ST, 2))
        elif y >= fy - 1:
            c.P(x, y, K(ST, 0))
    for (x, y) in M:                                           # 문틀 안쪽 그림자
        if x - gx0 < 2 or (x, y - 1) not in M:
            if y < fy:
                c.P(x, y, K(ST, 0))
    for side in leaves:
        lw = 3 if cx < 12 else 4
        for i in range(lw):
            x = gx0 + i if side == 'l' else gx1 - i
            ys = sorted(y for (xx, y) in M if xx == x)
            if not ys: continue
            top = ys[0] + i + 1; bot = min(ys[-1], gy1) - i
            for y in range(top, bot + 1):
                t = (2, 3, 4, 5)[i] if side == 'l' else (2, 3, 4, 5)[i]
                if side == 'r':
                    t = (2, 3, 3, 4)[i]
                c.P(x, y, K('wood', t))
            if i == lw - 1:
                c.VL(x, top, bot - top + 1, K('wood', 5) if side == 'l' else K('wood', 4))
            if i == 0:
                c.VL(x, top, bot - top + 1, K('wood', 1))
        sx = gx0 + 1 if side == 'l' else gx1 - 1
        for hy in (gy0 + int((gy1 - gy0) * 0.28), gy0 + int((gy1 - gy0) * 0.74)):
            c.R(sx, hy, 2, 3, K('iron', 3)); c.P(sx, hy, K('iron', 4))


def _door(id, name, w_tiles, state, group, desc):
    w = 12 if w_tiles == 1 else 24
    @REG.piece(id, name, w_tiles, 4, ['S' * w_tiles, 'S' * w_tiles, ('C' * w_tiles if state == 'open' else 'S' * w_tiles),
                                      ('F' * w_tiles if state == 'open' else 'S' * w_tiles)],
               'architecture', SP, desc=desc, rules='북벽 1~3행 자리에 끼운다(0행은 벽 윗면). 세 상태는 크기·피벗이 같다: 열림은 통행, 닫힘·잠김은 막힘.',
               tags=['문', '오크', '성채'], role='wall', states=group)
    def _fn(c):
        wall_n_base(c, 0, c.w)
        cx = c.w / 2
        M = door_frame(c, cx, w)
        if state == 'open':
            door_open_fill(c, M, cx, ('l',) if w_tiles == 1 else ('l', 'r'))
        else:
            door_leaf(c, M, cx, w_tiles == 2)
            if state == 'locked':
                door_locked_extra(c, M, cx)
        c.outline()


for _wt, _g, _nm in ((1, 'castle-door1', '1칸 오크 문'), (2, 'castle-door2', '2칸 오크 문')):
    for _st, _kn in (('closed', '닫힘'), ('open', '열림'), ('locked', '잠김')):
        _door('wz-castle-door%d-%s' % (_wt, _st), '성채 %s(%s)' % (_nm, _kn), _wt, _st, _g,
              '첨두 석재 문틀의 %s, %s 상태. %s' % (_nm, _kn, {'closed': '오크 판에 쇠 띠와 황동 손잡이.',
                                                          'open': '문짝이 안쪽으로 젖혀져 문틀 안 바닥이 보인다. 통행 가능.',
                                                          'locked': '닫힘 위에 쇠 빗장과 황동 자물쇠가 가로지른다.'}[_st]))


@REG.piece('wz-castle-passage1', '성채 첨두 아치 통로 1칸', 1, 4, ['S', 'S', 'C', 'F'], 'architecture', SP,
           desc='문짝 없는 첨두 아치 통로. 뒤쪽 바닥이 보이고 통행 가능.', rules='북벽 중간에 끼워 복도로 이어진다.',
           tags=['아치', '통로'], role='wall')
def _passage1(c):
    wall_n_base(c, 0, c.w)
    M = door_frame(c, c.w / 2, 12)
    door_open_fill(c, M, c.w / 2, (), back=2)
    c.outline()


@REG.piece('wz-castle-passage2', '성채 첨두 아치 통로 2칸', 2, 4, ['SS', 'SS', 'CC', 'FF'], 'architecture', SP,
           desc='문짝 없는 넓은 첨두 아치 통로. 뒤쪽 바닥이 보이고 통행 가능.', rules='북벽 중간에 끼워 복도·홀 입구로 쓴다.',
           tags=['아치', '통로'], role='wall')
def _passage2(c):
    wall_n_base(c, 0, c.w)
    M = door_frame(c, c.w / 2, 24)
    door_open_fill(c, M, c.w / 2, (), back=2)
    c.outline()


@REG.piece('wz-castle-door-s', '성채 남벽 출입구(문턱)', 1, 2, ['FF'.replace('FF', 'F'), 'F'], 'architecture', SP,
           desc='낮춘 남쪽 절단벽의 출입구. 양옆 문설주 윗면, 가운데 문턱 돌이 놓여 통행 가능.',
           rules='남쪽 마지막 2행 `-s` 사이에 끼운다.', tags=['문턱', '출입구'], role='wall')
def _door_s(c):
    # 바닥: 주변 포석(wz-castle-floor-flag)과 같은 16 주기로 칸 전체를 깐다 → 가운데 통로로 바닥이 이어져 보인다.
    t = slab_tile(ST, 'a')
    c.tile(t, 0, 0, 16, 32)
    # 양옆 문설주 = 남벽(wall-s) 절단면 2px(윤곽 포함). wall-s 와 같은 그림에서 잘라 와 옆 칸과 이음새 없이 이어진다.
    w = Cv(16, 32)
    south_cap(w, 0, 16); south_front(w, 0, 16)
    for x in (0, 1, 14, 15):
        for y in range(32):
            c.P(x, y, w.get(x, y))
    c.VL(1, 0, 32, K(ST, 1)); c.VL(0, 12, 18, K(ST, 2))       # 왼쪽 문설주 끝(그늘 쪽)
    c.VL(14, 0, 32, K(ST, 1)); c.VL(15, 2, 8, K(ST, 5))       # 오른쪽 문설주 끝(빛 받는 윗면 모서리)
    # 통로 바닥: 왼쪽 문설주가 오른쪽으로 드리운 그늘(빛은 왼쪽 위)
    c.VL(2, 0, 27, K(ST, 2))
    # 문턱 판석: 벽 밑선에 밝은 판석 한 줄(2px) + 아래 그늘
    c.HL(2, 27, 12, K(ST, 5)); c.HL(2, 28, 12, K(ST, 4)); c.HL(2, 29, 12, K(ST, 2))
    c.P(8, 28, K(ST, 3))
    c.outline()


# ───────────────────────── 계단 ─────────────────────────
@REG.piece('wz-castle-stair-up', '성채 돌계단(오름)', 2, 2, ['FF', 'FF'], 'architecture', SP,
           desc='북쪽으로 오르는 돌계단 4단. 단마다 밝은 디딤면과 어두운 챌면, 양옆 난간 돌벽.',
           rules='위층 바닥 아래 가장자리에 놓는다. 위쪽 끝은 위층 바닥과 이어진다.', tags=['계단', '오름'], role='prop')
def _stair_up(c):
    c.R(0, 0, 32, 32, K(ST, 3))
    for k in range(4):
        y0 = k * 8
        c.R(3, y0, 26, 3, K(ST, 5 - (1 if k == 0 else 0)))
        c.HL(3, y0, 26, K(ST, 5))
        c.R(3, y0 + 3, 26, 5, K(ST, 3 if k % 2 == 0 else 3))
        c.HL(3, y0 + 3, 26, K(ST, 4)); c.HL(3, y0 + 7, 26, K(ST, 2))
        for x in range(3, 29):
            if (x + k * 5) % 13 == 4:
                c.VL(x, y0 + 4, 3, K(ST, 2))
    for xs, lit in ((0, True), (29, False)):
        c.R(xs, 0, 3, 32, K(ST, 4 if lit else 3))
        c.VL(xs, 0, 32, K(ST, 5 if lit else 2)); c.VL(xs + 2, 0, 32, K(ST, 3 if lit else 1))
        for y in range(4, 32, 8):
            c.HL(xs, y, 3, K(ST, 2))
    c.HL(0, 31, 32, K(ST, 1))
    c.outline()


@REG.piece('wz-castle-stair-down', '성채 돌계단(내림)', 2, 2, ['FF', 'FF'], 'architecture', SP,
           desc='아래층으로 내려가는 돌계단. 디딤면이 안쪽으로 갈수록 어두워지고 끝은 어둠.',
           rules='바닥에 구멍처럼 박는다. 남쪽 끝이 현재 층 바닥과 이어진다.', tags=['계단', '내림'], role='prop')
def _stair_down(c):
    c.R(0, 0, 32, 32, K(ST, 1))
    tones = (1, 2, 2, 3)
    for k in range(4):
        y0 = k * 8
        t = tones[k]
        c.R(3, y0, 26, 8, K(ST, t))
        c.HL(3, y0 + 7, 26, K(ST, t + 2 if k else 4))
        c.HL(3, y0 + 6, 26, K(ST, t + 1))
        c.HL(3, y0, 26, K(ST, max(0, t - 1)))
        for x in range(3, 29):
            if (x + k * 7) % 11 == 3:
                c.VL(x, y0 + 1, 5, K(ST, max(0, t - 1)))
    for xs, lit in ((0, True), (29, False)):
        c.R(xs, 0, 3, 32, K(ST, 4 if lit else 3))
        c.VL(xs, 0, 32, K(ST, 5 if lit else 2)); c.VL(xs + 2, 0, 32, K(ST, 3 if lit else 1))
    c.R(3, 0, 26, 3, K(ST, 0))
    c.HL(0, 31, 32, K(ST, 2))
    c.outline()


@REG.piece('wz-castle-floor-stair', '성채 계단 디딤면 바닥', 1, 1, ['F'], 'surfaces', SP,
           desc='가로 디딤 두 단이 이어지는 계단 바닥 1칸(디딤 8px).', rules='세로로 이어 칠해 긴 계단 바닥으로 쓴다.',
           tags=['계단', '바닥'], role='terrain', repeat=True)
def _floor_stair(c):
    for k in range(2):
        y0 = k * 8
        c.R(0, y0, 16, 8, K(ST, 4))
        c.HL(0, y0, 16, K(ST, 5)); c.HL(0, y0 + 1, 16, K(ST, 5))
        c.HL(0, y0 + 5, 16, K(ST, 3)); c.HL(0, y0 + 6, 16, K(ST, 2)); c.HL(0, y0 + 7, 16, K(ST, 1))
        for x in range(16):
            if (x + k * 6) % 9 == 3:
                c.VL(x, y0 + 2, 3, K(ST, 3))


@REG.piece('wz-castle-threshold-stone-oak', '성채 문턱 전이(석재→오크)', 1, 1, ['F'], 'surfaces', SP,
           desc='왼쪽 포석과 오른쪽 오크 마루를 잇는 황동 띠 문턱.', rules='석재 바닥과 오크 바닥이 만나는 세로 경계에 놓는다.',
           tags=['문턱', '전이'], role='terrain')
def _thr_so(c):
    c.tile(slab_tile(ST, 'a'), 0, 0, 7, 16)
    c.tile(oak_tile('a'), 9, 0, 7, 16)
    c.VL(7, 0, 16, K('brass', 4)); c.VL(8, 0, 16, K('brass', 2))
    c.VL(6, 0, 16, K(ST, 1)); c.VL(9, 0, 16, K('wood', 1))
    for y in (2, 13):
        c.P(7, y, K('brass', 5))


@REG.piece('wz-castle-threshold-oak-stone', '성채 문턱 전이(오크→석재)', 1, 1, ['F'], 'surfaces', SP,
           desc='왼쪽 오크 마루와 오른쪽 포석을 잇는 황동 띠 문턱.', rules='오크 바닥과 석재 바닥이 만나는 세로 경계에 놓는다.',
           tags=['문턱', '전이'], role='terrain')
def _thr_os(c):
    c.tile(oak_tile('a'), 0, 0, 7, 16)
    c.tile(slab_tile(ST, 'a'), 9, 0, 7, 16)
    c.VL(8, 0, 16, K('brass', 4)); c.VL(7, 0, 16, K('brass', 2))
    c.VL(9, 0, 16, K(ST, 1)); c.VL(6, 0, 16, K('wood', 1))
    for y in (2, 13):
        c.P(8, y, K('brass', 5))


# ───────────────────────── 난간 ─────────────────────────
@REG.piece('wz-castle-rail-h', '성채 돌난간(가로)', 1, 1, ['S'], 'architecture', SP,
           desc='위층 가장자리의 가로 돌난간. 윗면 갓돌과 작은 기둥.', rules='위층 바닥 가장자리를 따라 가로로 잇는다. 막힘.',
           tags=['난간'], role='fence', repeat=True)
def _rail_h(c):
    c.R(0, 3, 16, 4, K(ST, 5)); c.HL(0, 3, 16, K(ST, 5)); c.HL(0, 6, 16, K(ST, 4))
    c.R(0, 7, 16, 2, K(ST, 3)); c.HL(0, 7, 16, K(ST, 4)); c.HL(0, 8, 16, K(ST, 2))
    for bx in (1, 6, 11):
        c.R(bx, 9, 4, 6, K(ST, 4)); c.VL(bx, 9, 6, K(ST, 5)); c.VL(bx + 3, 9, 6, K(ST, 2))
        c.R(bx + 1, 9, 2, 6, K(ST, 3))
        c.HL(bx, 14, 4, K(ST, 2))
    c.outline()


@REG.piece('wz-castle-rail-v', '성채 돌난간(세로)', 1, 1, ['S'], 'architecture', SP,
           desc='위층 가장자리의 세로 돌난간. 갓돌 윗면과 한쪽 옆면, 16px 마다 기둥.', rules='위층 바닥 가장자리를 따라 세로로 잇는다. 막힘.',
           tags=['난간'], role='fence', repeat=True)
def _rail_v(c):
    c.R(5, 0, 5, 16, K(ST, 5)); c.VL(5, 0, 16, K(ST, 5)); c.VL(9, 0, 16, K(ST, 4))
    c.R(10, 0, 2, 16, K(ST, 3)); c.VL(11, 0, 16, K(ST, 2))
    c.R(4, 6, 8, 4, K(ST, 5)); c.R(4, 6, 8, 1, K(ST, 5)); c.R(4, 9, 8, 1, K(ST, 4)); c.R(12, 7, 1, 3, K(ST, 2))
    c.HL(4, 10, 8, K(ST, 3))
    c.R(13, 0, 1, 16, 0) if False else None
    c.outline()


@REG.piece('wz-castle-rail-end', '성채 돌난간(끝 기둥)', 1, 1, ['S'], 'architecture', SP,
           desc='돌난간 끝을 막는 네모 기둥.', rules='난간 줄의 끝·모서리에 둔다. 막힘.', tags=['난간', '기둥'], role='fence')
def _rail_end(c):
    c.R(4, 2, 8, 4, K(ST, 5)); c.HL(4, 2, 8, K(ST, 5)); c.HL(4, 5, 8, K(ST, 4))
    c.R(5, 6, 6, 8, K(ST, 4)); c.VL(5, 6, 8, K(ST, 5)); c.VL(10, 6, 8, K(ST, 2)); c.R(6, 6, 4, 8, K(ST, 3))
    c.HL(5, 6, 6, K(ST, 4)); c.HL(5, 13, 6, K(ST, 2))
    c.R(3, 14, 10, 2, K(ST, 4)); c.HL(3, 14, 10, K(ST, 5)); c.HL(3, 15, 10, K(ST, 2))
    c.outline()


# ───────────────────────── 벽 등잔 ─────────────────────────
@REG.piece('wz-castle-sconce', '성채 황동 벽 촛대', 1, 1, ['S'], 'architecture', SP,
           desc='벽 정면에 박는 황동 촛대. 불꽃 없이 정적(불꽃은 효과 모듈이 따로).', rules='북벽 정면 석재 위에 겹쳐 놓는다.',
           tags=['촛대', '황동'], role='prop')
def _sconce(c):
    c.R(6, 3, 4, 5, K('brass', 3)); c.VL(6, 3, 5, K('brass', 5)); c.VL(9, 3, 5, K('brass', 2)); c.HL(6, 3, 4, K('brass', 4)); c.HL(6, 7, 4, K('brass', 1))
    c.P(7, 4, K('brass', 5)); c.P(8, 5, K('brass', 4))
    c.R(7, 8, 2, 2, K('brass', 3)); c.P(7, 8, K('brass', 4))
    c.R(4, 10, 8, 2, K('brass', 4)); c.HL(4, 10, 8, K('brass', 5)); c.HL(4, 11, 8, K('brass', 2))
    c.R(5, 12, 6, 2, K('brass', 3)); c.HL(5, 13, 6, K('brass', 1))
    c.R(7, 5, 2, 5, K('linen', 3)); c.VL(7, 5, 5, K('linen', 4)); c.VL(8, 5, 5, K('linen', 2)); c.P(7, 5, K('linen', 4))
    c.P(7, 4, K('ink', 1)); c.P(8, 4, K('ink', 1))
    c.outline()




@REG.piece('wz-castle-wall-s-window', '성채 남벽 창', 1, 2, ['S', 'S'], 'architecture', SP,
           desc='남쪽 낮춘 벽에 낸 작은 첨두 납살 창.', rules='남쪽 마지막 2행의 `-s` 사이에 끼운다.', tags=['창', '남벽'], role='wall')
def _wall_s_window(c):
    south_cap(c, 0, 16); south_front(c, 0, 16)
    window_piece(c, 8, 6, 15, 28, 5, bars=(0.5,), cw=16)
    c.outline()


# ───────────────────────── 예제 ─────────────────────────
def _hall():
    pl = []
    nx = {2: 'wall-n-window', 4: 'wall-n-pillar', 5: 'wall-n-window', 8: 'wall-n-window', 9: 'wall-n-pillar', 11: 'wall-n-window'}
    pl.append(('wz-castle-wall-nw', 0, 0)); pl.append(('wz-castle-wall-ne', 13, 0))
    for x in range(1, 13):
        if x in (6, 7): continue
        pl.append(('wz-castle-' + nx.get(x, 'wall-n'), x, 0))
    pl.append(('wz-castle-door2-closed', 6, 0))
    for x in (3, 10):
        pl.append(('wz-castle-sconce', x, 2))
    for y in range(4, 8):
        pl.append(('wz-castle-wall-w', 0, y)); pl.append(('wz-castle-wall-e', 13, y))
    for yy in range(4, 6):
        for x in range(4, 10):
            pl.append(('wz-castle-floor-oak', x, yy))
    for x in (3, 10):
        for yy in (4, 5):
            pl.append(('wz-castle-floor-flag-worn', x, yy))
    pl.append(('wz-castle-stair-up', 11, 4))
    pl.append(('wz-castle-wall-sw', 0, 8)); pl.append(('wz-castle-wall-se', 13, 8))
    for x in range(1, 13):
        if x == 6: continue
        pl.append(('wz-castle-wall-s-window' if x in (3, 10) else 'wz-castle-wall-s', x, 8))
    pl.append(('wz-castle-door-s', 6, 8))
    return pl


REG.example('wz-castle-example-hall', '성채 대회랑', 'shared', 14, 10, 'wz-castle-floor-flag', _hall(),
            desc='북벽에 창·기둥·2칸 문, 서·동 벽, 남벽 출입구, 오른쪽 위로 오르는 계단, 가운데 오크 마루 단.')


def _corridor():
    pl = [('wz-castle-wall-nw', 0, 0), ('wz-castle-wall-ne', 7, 0)]
    for x in range(1, 7):
        pl.append(('wz-castle-wall-n', x, 0))
    pl.append(('wz-castle-passage1', 3, 0))
    # T 접합: 북벽(0~3행)에서 칸막이 두 줄이 남쪽으로 내려간다. T 조각 아래는 같은 열에 -w/-e 를 이어 칠한다.
    pl += [('wz-castle-wall-t-w', 2, 0), ('wz-castle-wall-t-e', 5, 0)]
    for y in range(4, 10):
        pl.append(('wz-castle-wall-w', 0, y)); pl.append(('wz-castle-wall-e', 7, y))
        pl.append(('wz-castle-wall-w', 2, y)); pl.append(('wz-castle-wall-e', 5, y))
    pl.append(('wz-castle-wall-sw', 0, 10)); pl.append(('wz-castle-wall-se', 7, 10))
    for x in range(1, 7):
        pl.append(('wz-castle-door-s' if x == 3 else 'wz-castle-wall-s', x, 10))
    pl.append(('wz-castle-sconce', 4, 2))
    for y in range(4, 10):
        pl.append(('wz-castle-floor-oak', 1, y))
    return pl


REG.example('wz-castle-example-corridor', '성채 세로 복도', 'shared', 8, 12, 'wz-castle-floor-flag-worn', _corridor(),
            desc='세로 복도. 위쪽 첨두 아치 통로, 북벽에서 T 접합으로 내려가는 칸막이 두 줄, 아래 남벽 출입구.')


if __name__ == '__main__':
    sys.exit(1 if run_module(MODULE) else 0)
