"""병동(infirmary) — 밝은 석회색 병동 벽·아치 창·문·바닥·병상·커튼·치료 기물.
  python3 scripts/content/wizarding/pieces/infirmary.py   → 검사 + tiledata/wizarding/review/infirmary.png
"""
import os, sys, math
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from wzlib import REG, Cv, K, OL, OL2, run_module   # noqa: E402

MODULE = 'infirmary'
SP = 'infirmary'
ST = 'stone'
# 병동 석회색: 석재 램프 3~5단만 쓴다(성채 석벽보다 한 단 밝다)


def hsh(x, y, s=0):
    return (((x * 73856093) ^ (y * 19349663) ^ (s * 83492791)) & 0xffff) / 65536.0


# ───────────────────────── 벽 공통 ─────────────────────────
FACE_Y0 = 16            # 벽 정면 시작(북벽 1×4 의 1행)
FACE_H = 42             # 블록 구간 높이(y16..57), 아래 6px 는 걸레받이
COURSES = (6, 7, 6, 7, 6, 6, 4)
# 줄마다 16px 주기의 블록 경계 위치(이음새 없이 가로로 이어짐)
CUTS = ((0, 10), (5,), (0, 7), (3, 12), (0, 9), (6,), (0, 11))


def wall_face(c, x0, w, y0=FACE_Y0, courses=COURSES, cuts=CUTS, base=4, shadow_top=True):
    """밝은 석회색 큰 블록 정면. x 패턴은 전역 x 의 16 주기."""
    y = y0
    for ri, rh in enumerate(courses):
        cut = sorted(cuts[ri % len(cuts)])
        for x in range(x0, x0 + w):
            lx = x % 16
            seg = sum(1 for k in cut if lx >= k and k != 0) + (0 if 0 in cut else 0)
            start = max([k for k in cut if k <= lx] or [cut[-1] - 16])
            bid = (ri * 7 + start) % 11
            tone = base + (-1 if hsh(bid, ri, 3) < 0.28 else 0)
            for yy in range(y, y + rh):
                col = K(ST, tone)
                if yy == y: col = K(ST, tone + 1)                     # 윗 모서리 빛
                elif yy == y + rh - 1: col = K(ST, 2)                 # 아래 줄눈
                if lx == start and yy != y + rh - 1: col = K(ST, tone + 1) if yy != y else K(ST, tone + 1)
                nxt = (lx + 1) % 16
                if (nxt in cut) and yy != y + rh - 1: col = K(ST, 3) if tone >= 4 else K(ST, 2)   # 오른쪽 그늘
                c.P(x, yy, col)
            # 드문 마모점
            if hsh(x, ri, 9) < 0.035 and rh > 4:
                c.P(x, y + 2 + int(hsh(x, ri, 5) * (rh - 4)), K(ST, tone - 1))
        y += rh
    if shadow_top:
        c.HL(x0, y0, w, K(ST, 3))     # 덮개 그림자


def plinth(c, x0, w, y0=58, h=6):
    """걸레받이: 한 단 어둡고 아래가 가장 어둡다."""
    c.R(x0, y0, w, h, K(ST, 3))
    c.HL(x0, y0, w, K(ST, 4))
    for x in range(x0, x0 + w):
        if x % 16 in (5, 12): c.VL(x, y0 + 1, h - 2, K(ST, 2))
    c.HL(x0, y0 + h - 2, w, K(ST, 2)); c.HL(x0, y0 + h - 1, w, K(ST, 1))


def cap(c, x0, w, y0=0, outline_top=True):
    """벽 윗면(두께) 10px + 앞 모서리 6px."""
    c.R(x0, y0, w, 10, K(ST, 5))
    for x in range(x0, x0 + w):
        lx = x % 16
        for y in range(y0 + 1, y0 + 9):
            if hsh(lx, y, 21) < 0.07: c.P(x, y, K(ST, 4))
        if lx == 15 or lx == 7: c.VL(x, y0 + 1, 8, K(ST, 4))
        if lx == 0 and False: pass
    c.R(x0, y0 + 10, w, 1, K('linen', 4)); c.R(x0, y0 + 11, w, 4, K(ST, 4))
    c.HL(x0, y0 + 11, w, K(ST, 5))
    for x in range(x0, x0 + w):
        if x % 16 in (7, 15): c.VL(x, y0 + 12, 3, K(ST, 3))
    c.HL(x0, y0 + 14, w, K(ST, 3))
    c.HL(x0, y0 + 15, w, K(ST, 2))
    if outline_top: c.HL(x0, y0, w, K(ST, 1))


def wall_n_base(c, x0=0, w=16):
    cap(c, x0, w)
    wall_face(c, x0, w)
    plinth(c, x0, w)


# ───────────────────────── 아치 ─────────────────────────
def arch_mask(cx, y_top, w, y_bot, ah):
    """뾰족 아치 개구부: 중심 cx(반픽셀 가능), 맨 위 y_top, 폭 w, 아래 y_bot(포함), 아치 높이 ah."""
    cells = set()
    for y in range(y_top, y_bot + 1):
        r = y - y_top
        if r < ah:
            t = (r + 0.5) / ah
            hw = (w / 2) * (1 - (1 - t) ** 2) ** 0.72
        else:
            hw = w / 2
        for x in range(int(cx - w / 2 - 1), int(cx + w / 2 + 2)):
            if abs(x + 0.5 - cx) <= hw + 0.0: cells.add((x, y))
    return cells


def dilate(m, n=1):
    out = set(m)
    for _ in range(n):
        add = set()
        for (x, y) in out:
            for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1)): add.add((x + ox, y + oy))
        out |= add
    return out


def window_piece(c, cx, w, y_top, y_bot, ah, panes_v=1, bars=(0.34, 0.68)):
    M = arch_mask(cx, y_top, w, y_bot, ah)
    R1 = dilate(M, 1); R2 = dilate(M, 2)
    for (x, y) in R2 - R1:                      # 바깥 둘레 돌(밝은 아치돌)
        if y <= y_bot: c.P(x, y, K(ST, 5) if (x + y) % 5 else K(ST, 4))
    for (x, y) in R1 - M:                       # 안쪽 홈(그늘)
        c.P(x, y, K(ST, 2) if (y <= y_top + ah or x > cx) else K(ST, 3))
    # 깊은 벽 두께(위·왼쪽이 그늘)
    for (x, y) in M:
        up = (x, y - 1) not in M; lf = (x - 1, y) not in M; rt = (x + 1, y) not in M
        col = None
        if up: col = K(ST, 1)
        elif (x, y - 2) not in M: col = K(ST, 2)
        elif lf: col = K(ST, 2)
        elif rt: col = K(ST, 5)
        if col: c.P(x, y, col)
    glass = set(p for p in M if (p[0], p[1] - 2) in M and (p[0] - 1, p[1]) in M and (p[0] + 1, p[1]) in M)
    if not glass: glass = M
    ys = [p[1] for p in glass]; gy0, gy1 = min(ys), max(ys)
    for (x, y) in glass:
        t = (y - gy0) / max(1, gy1 - gy0)
        c.P(x, y, K('water', 4) if t < 0.55 else K('water', 3) if t < 0.9 else K('water', 2))
    xs = [p[0] for p in glass]; gx0, gx1 = min(xs), max(xs)
    for pv in range(1, panes_v + 1):                           # 세로 문설주
        mx = gx0 + (gx1 - gx0 + 1) * pv // (panes_v + 1)
        for y in range(gy0, gy1 + 1):
            if (mx, y) in glass: c.P(mx, y, K('night', 2))
    for b in bars:                                             # 가로 납살
        by = gy0 + int((gy1 - gy0) * b)
        for x in range(gx0, gx1 + 1):
            if (x, by) in glass: c.P(x, by, K('night', 2))
    # 유리 반사선(짧은 1px)
    for k in range(panes_v + 1):
        px = gx0 + 1 + k * ((gx1 - gx0 + 1) // (panes_v + 1))
        for j in range(3):
            if (px + j, gy0 + 3 + j + 7) in glass and c.get(px + j, gy0 + 3 + j + 7) != K('night', 2):
                c.P(px + j, gy0 + 3 + j + 7, K('water', 5))
    # 창턱(깊게 튀어나옴): 윗면 2 + 앞면 2 + 그림자
    sx0, sx1 = int(cx - w / 2 - 3), int(cx + w / 2 + 3)
    c.R(sx0, y_bot + 1, sx1 - sx0, 2, K(ST, 5)); c.HL(sx0, y_bot + 1, sx1 - sx0, K('linen', 4))
    c.R(sx0, y_bot + 3, sx1 - sx0, 2, K(ST, 3)); c.HL(sx0, y_bot + 5, sx1 - sx0, K(ST, 2))


@REG.piece('wz-inf-wall-n', '병동 북벽(석회색)', 1, 4, ['S', 'S', 'S', 'S'], 'architecture', SP,
           desc='병동 북쪽 벽 1×4. 0행 윗면(두께), 1~3행 밝은 석회색 큰 블록 정면+걸레받이. 가로로 이어 칠한다.',
           rules='북쪽 0~3행에 가로로 이어 깐다. 창·문 조각과 같은 블록 줄 높이를 쓴다.', tags=['벽', '병동'], role='wall', repeat=True)
def _wall_n(c):
    wall_n_base(c)


@REG.piece('wz-inf-wall-n-window', '병동 높은 아치 창(1칸)', 1, 4, ['S', 'S', 'S', 'S'], 'architecture', SP,
           desc='1×4 좁은 뾰족 아치 창. 차가운 푸른 창빛, 납살, 깊은 창턱.', rules='북벽 사이에 끼운다. 벽 위에 직접 둔다.',
           tags=['창', '아치'], role='wall')
def _wall_win(c):
    wall_n_base(c)
    window_piece(c, 8, 8, 18, 46, 9)


@REG.piece('wz-inf-wall-n-window-big', '병동 큰 아치 창(2칸)', 2, 4, ['SS', 'SS', 'SS', 'SS'], 'architecture', SP,
           desc='2×4 큰 뾰족 아치 창. 가운데 문설주와 가로 납살, 차가운 창빛.', rules='북벽 사이에 끼운다. 병상 쌍 위에 하나씩.',
           tags=['창', '아치', '큰창'], role='wall')
def _wall_win2(c):
    wall_n_base(c, 0, 32)
    window_piece(c, 16, 18, 19, 47, 11, panes_v=1, bars=(0.28, 0.55))


# ───────────────────────── 문 3상태 ─────────────────────────
def door_frame(c):
    wall_n_base(c)
    M = arch_mask(8, 22, 12, 63, 7)
    for (x, y) in dilate(M, 2) - dilate(M, 1):
        c.P(x, y, K(ST, 5) if (x + y) % 4 else K(ST, 4))
    for (x, y) in dilate(M, 1) - M:
        c.P(x, y, K(ST, 2))
    return M


def oak_leaf(c, M, lock=False):
    for (x, y) in M:
        t = (x - 2) % 3
        col = K('wood', 4) if t == 0 else K('wood', 3) if t == 1 else K('wood', 3)
        if t == 2: col = K('wood', 2)
        if x == 2: col = K('wood', 5)
        if x == 13: col = K('wood', 2)
        if hsh(x, y, 4) < 0.04: col = K('wood', 2)
        c.P(x, y, col)
    for by in (30, 54):                                          # 철 띠
        for x in range(2, 14):
            if (x, by) in M:
                c.P(x, by, K('iron', 4)); c.P(x, by + 1, K('iron', 3)); c.P(x, by + 2, K('iron', 1))
        c.P(4, by, K('iron', 2)); c.P(9, by, K('iron', 2))
    for (x, y) in M:                                             # 아치 쪽 위 그늘
        if (x, y - 1) not in M: c.P(x, y, K('wood', 2))
    c.R(11, 45, 2, 3, K('brass', 4)); c.P(11, 45, K('brass', 5)); c.P(12, 47, K('brass', 2))   # 손잡이


@REG.piece('wz-inf-door-closed', '병동 문(닫힘)', 1, 4, ['S', 'S', 'S', 'S'], 'architecture', SP,
           desc='밝은 오크 판문 1×4, 첨두 석재 문틀. 닫힘.', rules='북벽에 끼운다. 상태 묶음 inf-door.', tags=['문'], role='wall', states='inf-door')
def _door_c(c):
    M = door_frame(c); oak_leaf(c, M)


@REG.piece('wz-inf-door-open', '병동 문(열림)', 1, 4, ['S', 'C', 'C', 'C'], 'architecture', SP,
           desc='문이 안쪽으로 열려 어두운 복도가 보인다. 통행.', rules='열린 칸은 통행. 상태 묶음 inf-door.', tags=['문'], role='wall', states='inf-door')
def _door_o(c):
    M = door_frame(c)
    for (x, y) in M:
        t = (y - 22) / 41
        c.P(x, y, K('night', 0) if y < 30 else K('night', 1))
    for x in range(3, 13):                                       # 먼 벽의 희미한 빛
        for y in range(40, 58):
            if (x, y) in M and 6 <= x <= 10: c.P(x, y, K('night', 2))
    for (x, y) in M:                                             # 바닥(문턱)
        if y >= 58: c.P(x, y, K(ST, 3))
        if y >= 62: c.P(x, y, K(ST, 4))
    for y in range(24, 63):                                      # 열린 문짝(옆면)
        if (3, y) in M or (2, y) in M:
            c.P(2, y, K('wood', 4)); c.P(3, y, K('wood', 3)); c.P(4, y, K('wood', 2)) if (4, y) in M else None
    c.R(2, 32, 3, 2, K('iron', 3)); c.R(2, 52, 3, 2, K('iron', 3))


@REG.piece('wz-inf-door-locked', '병동 문(잠김)', 1, 4, ['S', 'S', 'S', 'S'], 'architecture', SP,
           desc='닫힌 문에 쇠 가로막대와 황동 자물쇠. 잠김.', rules='상태 묶음 inf-door.', tags=['문', '잠김'], role='wall', states='inf-door')
def _door_l(c):
    M = door_frame(c); oak_leaf(c, M)
    c.R(0, 40, 16, 3, K('iron', 3)); c.HL(0, 40, 16, K('iron', 4)); c.HL(0, 42, 16, K('iron', 1))
    for x in (2, 13): c.P(x, 41, K('iron', 4))
    c.R(6, 44, 4, 5, K('brass', 3)); c.HL(6, 44, 4, K('brass', 5)); c.VL(9, 45, 4, K('brass', 1)); c.P(7, 46, K('brass', 0))
    c.R(7, 42, 2, 2, K('iron', 2))
    c.line(7, 49, 7, 52, K('iron', 3)); c.P(8, 52, K('iron', 3))


# ───────────────────────── 서·동·남 벽, 모서리 ─────────────────────────
def side_top(c, x0, y0, h, west=True):
    """서·동 벽 윗면 띠: 바깥 가장자리 유색 윤곽, 안쪽 모서리는 그늘."""
    c.R(0, y0, 16, h, K(ST, 5))
    for y in range(y0, y0 + h):
        for x in range(16):
            if hsh(x, y, 31) < 0.06: c.P(x, y, K(ST, 4))
        if y % 16 in (7, 15): c.HL(0, y, 16, K(ST, 4))
    if west:
        c.VL(0, y0, h, K(ST, 1)); c.VL(1, y0, h, K(ST, 4)); c.VL(13, y0, h, K(ST, 4)); c.VL(14, y0, h, K(ST, 3)); c.VL(15, y0, h, K(ST, 2))
    else:
        c.VL(15, y0, h, K(ST, 1)); c.VL(14, y0, h, K(ST, 3)); c.VL(0, y0, h, K(ST, 2)); c.VL(1, y0, h, K(ST, 3))
        c.VL(2, y0, h, K(ST, 5)); c.VL(13, y0, h, K(ST, 4))
        c.VL(3, y0, h, K(ST, 5))


@REG.piece('wz-inf-wall-w', '병동 서벽 윗면 띠', 1, 1, ['S'], 'architecture', SP,
           desc='서쪽 벽 윗면 띠 1×1. 세로로 이어 칠한다. 바깥은 어두운 윤곽, 안쪽은 그늘.', rules='서쪽 가장자리 열에 세로로.',
           tags=['벽'], role='wall', repeat=True)
def _wall_w(c): side_top(c, 0, 0, 16, True)


@REG.piece('wz-inf-wall-e', '병동 동벽 윗면 띠', 1, 1, ['S'], 'architecture', SP,
           desc='동쪽 벽 윗면 띠 1×1. 세로로 이어 칠한다.', rules='동쪽 가장자리 열에 세로로.', tags=['벽'], role='wall', repeat=True)
def _wall_e(c): side_top(c, 0, 0, 16, False)


def south_front(c, x0, w, y0=12, h=20):
    c.R(x0, y0, w, h, K(ST, 4))
    wall_face(c, x0, w, y0, courses=(6, 7, 7), cuts=((0, 10), (5,), (0, 7)), shadow_top=True)
    c.HL(x0, y0 + h - 2, w, K(ST, 2)); c.HL(x0, y0 + h - 1, w, K(ST, 1))


def south_cap(c, x0, w):
    c.R(x0, 0, w, 10, K(ST, 5))
    for x in range(x0, x0 + w):
        for y in range(1, 9):
            if hsh(x % 16, y, 41) < 0.07: c.P(x, y, K(ST, 4))
        if x % 16 in (7, 15): c.VL(x, 1, 8, K(ST, 4))
    c.R(x0, 10, w, 1, K('linen', 4)); c.R(x0, 11, w, 1, K(ST, 3))


@REG.piece('wz-inf-wall-s', '병동 남쪽 낮춘 벽', 1, 2, ['S', 'S'], 'architecture', SP,
           desc='남쪽 낮춘 절단벽 1×2. 0행 윗면, 1행 낮은 블록 정면.', rules='남쪽 마지막 2행에 가로로.', tags=['벽'], role='wall', repeat=True)
def _wall_s(c):
    south_cap(c, 0, 16); south_front(c, 0, 16); c.HL(0, 0, 16, K(ST, 1))


@REG.piece('wz-inf-wall-sw', '병동 남서 모서리', 1, 2, ['S', 'S'], 'architecture', SP,
           desc='남쪽 벽의 서쪽 끝 모서리 1×2.', rules='남벽 왼쪽 끝.', tags=['벽'], role='wall')
def _wall_sw(c):
    south_cap(c, 0, 16); south_front(c, 0, 16)
    c.VL(0, 0, 32, K(ST, 1)); c.VL(1, 1, 31, K(ST, 4)); c.HL(0, 0, 16, K(ST, 1))
    c.VL(1, 13, 19, K(ST, 5))


@REG.piece('wz-inf-wall-se', '병동 남동 모서리', 1, 2, ['S', 'S'], 'architecture', SP,
           desc='남쪽 벽의 동쪽 끝 모서리 1×2.', rules='남벽 오른쪽 끝.', tags=['벽'], role='wall')
def _wall_se(c):
    south_cap(c, 0, 16); south_front(c, 0, 16)
    c.VL(15, 0, 32, K(ST, 1)); c.VL(14, 1, 31, K(ST, 3)); c.HL(0, 0, 16, K(ST, 1))


@REG.piece('wz-inf-wall-nw', '병동 북서 모서리', 1, 4, ['S', 'S', 'S', 'S'], 'architecture', SP,
           desc='북쪽 벽의 서쪽 바깥 모서리 1×4. 서벽 윗면 띠가 4행 모두 이어진다.', rules='북벽 왼쪽 끝(서벽 위).', tags=['벽'], role='wall')
def _wall_nw(c):
    side_top(c, 0, 0, 64, True); c.HL(0, 0, 16, K(ST, 1))
    c.HL(2, 63, 12, K(ST, 4))


@REG.piece('wz-inf-wall-ne', '병동 북동 모서리', 1, 4, ['S', 'S', 'S', 'S'], 'architecture', SP,
           desc='북쪽 벽의 동쪽 바깥 모서리 1×4.', rules='북벽 오른쪽 끝(동벽 위).', tags=['벽'], role='wall')
def _wall_ne(c):
    side_top(c, 0, 0, 64, False); c.HL(0, 0, 16, K(ST, 1))


# ───────────────────────── 바닥 ─────────────────────────
@REG.piece('wz-inf-floor-a', '병동 바닥(큰 석판)', 1, 1, ['F'], 'surfaces', SP,
           desc='밝은 석회암 큰 석판 바닥 1×1 반복. 드문 마모점.', rules='실내 바닥 기본. b 변형과 섞는다.', tags=['바닥'], role='terrain', repeat=True)
def _floor_a(c):
    c.R(0, 0, 16, 16, K(ST, 4))
    c.R(1, 1, 7, 7, K(ST, 4)); c.R(9, 1, 6, 7, K(ST, 4))
    c.HL(0, 0, 16, K(ST, 3)); c.VL(0, 0, 16, K(ST, 3))          # 줄눈(윗·왼)
    c.VL(8, 0, 8, K(ST, 3)); c.HL(0, 8, 16, K(ST, 3))
    c.HL(1, 1, 7, K(ST, 5)); c.HL(9, 1, 6, K(ST, 5)); c.HL(1, 9, 16 - 1, K(ST, 5))
    c.VL(1, 1, 7, K(ST, 5)); c.VL(9, 1, 7, K(ST, 5))
    c.P(12, 5, K(ST, 3)); c.P(4, 12, K(ST, 3)); c.P(5, 12, K(ST, 3)); c.P(13, 12, K(ST, 5))


@REG.piece('wz-inf-floor-b', '병동 바닥(작은 석판)', 1, 1, ['F'], 'surfaces', SP,
           desc='밝은 석회암 엇갈린 작은 석판 바닥 1×1 반복. a 와 섞어 단조로움을 깬다.', rules='a 와 섞는다.', tags=['바닥'], role='terrain', repeat=True)
def _floor_b(c):
    c.R(0, 0, 16, 16, K(ST, 4))
    c.HL(0, 0, 16, K(ST, 3)); c.HL(0, 8, 16, K(ST, 3))
    c.VL(0, 0, 8, K(ST, 3)); c.VL(8, 8, 8, K(ST, 3)); c.VL(11, 0, 8, K(ST, 3)) if False else None
    c.VL(5, 0, 8, K(ST, 3)); c.VL(13, 8, 8, K(ST, 3))
    c.HL(1, 1, 4, K(ST, 5)); c.HL(6, 1, 10, K(ST, 5)); c.HL(1, 9, 12, K(ST, 5)); c.HL(9, 9, 6, K(ST, 5)) if False else None
    c.HL(14, 9, 2, K(ST, 5))
    c.P(3, 5, K(ST, 3)); c.P(10, 4, K(ST, 3)); c.P(11, 4, K(ST, 3)); c.P(4, 13, K(ST, 3)); c.P(12, 12, K(ST, 5))


@REG.piece('wz-inf-bed-shadow', '병상 아래 그림자', 2, 3, ['ff', 'ff', 'ff'], 'surfaces', SP,
           desc='병상 아래 바닥 그림자 덧그림 2×3. 병상 밑·남쪽·동쪽으로 한 단 어두운 접지 그림자.', rules='병상 조각 바로 밑에 먼저 깐다.',
           tags=['그림자'], role='prop')
def _bed_shadow(c):
    # 얇은 접지 띠: 침대 발치(남쪽)와 동쪽 가장자리에만, 나머지는 투명
    c.R(3, 45, 28, 3, K(ST, 3)); c.R(5, 47, 27, 1, K(ST, 2))
    c.R(30, 12, 2, 33, K(ST, 3)); c.VL(31, 12, 36, K(ST, 2))
    c.R(31, 45, 1, 3, K(ST, 2))
    c.R(2, 8, 1, 37, K(ST, 3))


# ───────────────────────── 병상 ─────────────────────────
def bed_frame(c):
    """철제 머리판 + 오크 틀 + 매트리스 바탕. 32×48, 머리판이 북쪽(위)."""
    # 머리판 기둥·가로대·세로살(남쪽에서 본 안쪽 면)
    for x0 in (1, 28):
        c.R(x0, 2, 3, 12, K('iron', 3)); c.VL(x0, 2, 12, K('iron', 4)); c.VL(x0 + 2, 2, 12, K('iron', 2))
        c.R(x0, 0, 3, 2, K('brass', 4)); c.P(x0, 0, K('brass', 5)); c.HL(x0, 1, 3, K('brass', 3))
    c.R(4, 3, 24, 2, K('iron', 3)); c.HL(4, 3, 24, K('iron', 4)); c.HL(4, 4, 24, K('iron', 2))
    c.R(4, 11, 24, 2, K('iron', 3)); c.HL(4, 11, 24, K('iron', 4)); c.HL(4, 12, 24, K('iron', 2))
    for x in range(6, 27, 4):
        c.VL(x, 5, 6, K('iron', 3)); c.VL(x + 1, 5, 6, K('iron', 2))
        c.P(x, 5, K('iron', 4))
    c.R(4, 5, 24, 6, K('iron', 1)) if False else None
    # 오크 틀 윗면(양 옆 레일) + 매트리스 윗면
    c.R(1, 13, 30, 28, K('wood', 4))
    c.VL(1, 13, 28, K('wood', 5)); c.VL(2, 13, 28, K('wood', 4))
    c.VL(29, 13, 28, K('wood', 3)); c.VL(30, 13, 28, K('wood', 2))
    # 푸트보드 앞면(남쪽) + 윗 모서리
    c.R(1, 41, 30, 4, K('wood', 3)); c.HL(1, 41, 30, K('wood', 5)); c.HL(1, 42, 30, K('wood', 4))
    c.VL(30, 41, 4, K('wood', 2)); c.HL(1, 44, 30, K('wood', 2))
    for x in (8, 15, 22): c.P(x, 43, K('wood', 4))
    # 다리
    for x0 in (1, 27):
        c.R(x0, 45, 4, 3, K('wood', 3)); c.VL(x0, 45, 3, K('wood', 4)); c.VL(x0 + 3, 45, 3, K('wood', 2))
        c.HL(x0, 47, 4, K('wood', 1))


def bed_pillow(c, x0=6, y0=14, w=20, h=8):
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            c.P(x, y, K('snow', 3) if (y - y0) < h - 2 and x - x0 < w - 3 else K('snow', 2))
    for (dx, dy) in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)): c.clear(x0 + dx, y0 + dy) if False else None
    c.HL(x0, y0 + h - 1, w, K('snow', 1)); c.VL(x0 + w - 1, y0 + 1, h - 1, K('snow', 1))
    c.HL(x0 + 1, y0, w - 2, K('snow', 3))
    for dx in (3, 4, w - 5): c.P(x0 + dx, y0 + 2, K('snow', 2))   # 베개 주름


def bed_sheet(c):
    c.R(3, 13, 26, 28, K('snow', 2))
    c.VL(3, 13, 28, K('snow', 3)); c.VL(28, 13, 28, K('snow', 1))


def bed_blanket(c, y0, patient):
    # 이불 끝단(시트가 접힌 흰 단) + 담요
    c.R(3, y0, 26, 3, K('snow', 3)); c.HL(3, y0 + 2, 26, K('snow', 1)); c.HL(3, y0, 26, K('snow', 3))
    c.R(3, y0 + 3, 26, 41 - (y0 + 3), K('water', 4))
    c.VL(3, y0 + 3, 41 - (y0 + 3), K('water', 5)); c.VL(28, y0 + 3, 41 - (y0 + 3), K('water', 3))
    c.HL(3, 40, 26, K('water', 3)); c.HL(3, 39, 26, K('water', 3))
    # 격자 무늬 한 줄(가장자리 띠)
    c.HL(4, y0 + 4, 24, K('water', 3))
    for x in (9, 16, 23):
        c.VL(x, y0 + 6, 41 - (y0 + 8), K('water', 3))


@REG.piece('wz-inf-bed-empty', '병상(빈 침대)', 2, 3, ['SS', 'SS', 'SS'], 'furniture', SP,
           desc='철제 머리판·오크 틀·흰 린넨 시트와 베개, 발치에 개켜 둔 푸른 담요. 비어 있는 병상 2×3.',
           rules='병상 그림자 위에 둔다. 머리판이 북쪽. 환자 병상과는 다른 물건(상태 아님).', tags=['병상', '침대', '빈'], role='prop')
def _bed_empty(c):
    bed_frame(c); bed_sheet(c); bed_pillow(c)
    # 시트 주름(드문 짧은 선)
    c.HL(7, 26, 5, K('snow', 1)); c.HL(18, 28, 6, K('snow', 3)); c.HL(9, 30, 4, K('snow', 3))
    # 발치에 개킨 담요
    c.R(3, 32, 26, 9, K('water', 4)); c.HL(3, 32, 26, K('water', 5)); c.HL(3, 33, 26, K('water', 5))
    c.HL(3, 35, 26, K('water', 3)); c.HL(3, 38, 26, K('water', 3)); c.HL(3, 39, 26, K('water', 2)); c.HL(3, 40, 26, K('water', 2))
    c.VL(28, 32, 9, K('water', 3)); c.VL(3, 32, 9, K('water', 5))
    c.HL(3, 31, 26, K('snow', 1))
    for x in (10, 20): c.VL(x, 36, 2, K('water', 3))
    c.outline()


@REG.piece('wz-inf-bed-patient', '병상(환자)', 2, 3, ['SS', 'SS', 'SS'], 'furniture', SP,
           desc='환자가 베개에 머리를 누이고 담요를 가슴까지 덮은 병상 2×3. 어깨·몸·발의 담요 굴곡이 보인다.',
           rules='빈 침대와 다른 물건. 병동 안쪽 줄에 한두 개만 둔다.', tags=['병상', '침대', '환자'], role='prop')
def _bed_patient(c):
    bed_frame(c); bed_sheet(c); bed_pillow(c)
    # 머리: 머리카락(위) + 얼굴(감은 눈·입)
    for y in range(14, 22):
        for x in range(11, 21):
            r = (x - 15.5) ** 2 / 25 + (y - 17.5) ** 2 / 16
            if r <= 1.0:
                c.P(x, y, K('hair_dark', 3) if y <= 15 else K('skin', 3))
    c.HL(12, 15, 8, K('hair_dark', 2)); c.HL(13, 14, 6, K('hair_dark', 3))
    c.HL(12, 16, 8, K('hair_dark', 2)); c.P(11, 17, K('skin', 2)); c.P(20, 17, K('skin', 1)); c.P(20, 18, K('skin', 1))
    c.P(13, 18, K('hair_dark', 1)); c.P(14, 18, K('hair_dark', 1)); c.P(17, 18, K('hair_dark', 1)); c.P(18, 18, K('hair_dark', 1))
    c.HL(15, 20, 2, K('skin', 1)); c.HL(13, 17, 2, K('skin', 4)); c.P(12, 19, K('skin', 4))
    c.HL(13, 21, 5, K('skin', 2))
    # 담요: 가슴께부터 덮음, 몸 굴곡
    y0 = 24
    bed_blanket(c, y0, True)
    # 어깨 굴곡(담요 위쪽이 더 밝고 솟음) + 몸 중앙 능선
    c.HL(8, y0 + 3, 16, K('water', 5)); c.HL(7, y0 + 4, 18, K('water', 4))
    c.VL(11, y0 + 5, 9, K('water', 3)); c.VL(20, y0 + 5, 9, K('water', 3))
    c.VL(15, y0 + 4, 8, K('water', 5)); c.VL(16, y0 + 4, 8, K('water', 5)) if False else None
    # 팔: 담요 위의 손 하나
    c.R(7, y0 + 5, 3, 3, K('skin', 3)); c.HL(7, y0 + 5, 3, K('skin', 4)); c.VL(7, y0 + 7, 1, K('skin', 2))
    # 발치 두 덩이
    c.R(10, 36, 4, 3, K('water', 5)); c.R(18, 36, 4, 3, K('water', 5))
    c.HL(10, 38, 4, K('water', 3)); c.HL(18, 38, 4, K('water', 3))
    c.outline()


# ───────────────────────── 침상 커튼 · 칸막이 · 치료 카트 ─────────────────────────
def curtain_rail(c, x0=0, x1=16):
    c.R(x0, 0, x1 - x0, 3, K('iron', 3)); c.HL(x0, 0, x1 - x0, K('iron', 4)); c.HL(x0, 2, x1 - x0, K('iron', 1))
    c.P(x0, 0, K('brass', 5)); c.P(x1 - 1, 0, K('brass', 5))


def curtain_cloth(c, xa, xb, y0, y1):
    """세로 주름 천: 4px 주기 밝음-중간-어두움-중간, 아래 단은 어두운 밑단."""
    cyc = [4, 3, 2, 3]
    for x in range(xa, xb):
        t = cyc[(x - xa) % 4]
        if x == xb - 1: t = 1
        c.VL(x, y0, y1 - y0, K('linen', t))
        c.P(x, y0, K('linen', min(4, t + 1)))
    c.HL(xa, y1 - 2, xb - xa, K('linen', 1)); c.HL(xa, y1 - 1, xb - xa, K('linen', 0))
    # 위 갈고리 단(주름이 모이는 머리띠)
    c.HL(xa, y0 + 1, xb - xa, K('linen', 2))
    for x in range(xa + 1, xb, 4): c.P(x, y0, K('brass', 4))


@REG.piece('wz-inf-curtain-closed', '침상 커튼(닫힘)', 1, 3, ['S', 'S', 'S'], 'furniture', SP,
           desc='천장 철제 레일에 걸린 베이지 린넨 커튼이 1칸 폭으로 완전히 쳐진 상태. 세로 주름과 어두운 밑단.',
           rules='병상 옆 칸에 세로로 세운다. 열림 상태와 같은 크기·피벗(상태 묶음 curtain).', tags=['커튼', '닫힘', '병상'], role='prop', states='curtain')
def _curtain_closed(c):
    curtain_rail(c, 0, 16)
    curtain_cloth(c, 1, 15, 3, 45)
    c.outline()


@REG.piece('wz-inf-curtain-open', '침상 커튼(열림)', 1, 3, ['C', 'C', 'C'], 'furniture', SP,
           desc='같은 레일의 커튼이 왼쪽 끝으로 모여 끈으로 묶인 상태. 가운데가 트여 환자와 바닥이 보인다.',
           rules='닫힘 상태와 같은 크기·피벗. 열림은 통행.', tags=['커튼', '열림', '병상'], role='prop', states='curtain')
def _curtain_open(c):
    curtain_rail(c, 0, 16)
    # 모인 천 뭉치: 위(묶음 위)는 좁고 아래로 퍼진다
    for y in range(3, 45):
        w = 5 if y < 22 else 5 + int(round(3 * ((y - 22) / 22.0) ** 1.6))
        cyc = [4, 3, 2, 3]
        for x in range(1, 1 + w):
            t = cyc[(x - 1) % 4]
            if x == w: t = 1
            c.P(x, y, K('linen', t))
    c.HL(1, 43, 8, K('linen', 1)); c.HL(1, 44, 8, K('linen', 0))
    # 묶음 끈(황동)
    c.R(1, 23, 5, 2, K('brass', 3)); c.HL(1, 23, 5, K('brass', 5)); c.P(5, 24, K('brass', 1))
    c.R(1, 25, 5, 1, K('linen', 1))
    c.outline()


# ───────────────────────── 응급 처치 칸막이 ─────────────────────────
@REG.piece('wz-inf-screen', '응급 처치 칸막이', 2, 2, ['SS', 'SS'], 'furniture', SP,
           desc='세 폭짜리 접이식 칸막이. 오크 틀에 린넨 패널, 가운데 폭이 앞으로 나와 바깥 두 폭이 뒤로 접힌 지그재그.',
           rules='병상 앞이나 응급 침대 옆에 둔다. 사람보다 한 뼘 낮은 높이(약 28px).', tags=['칸막이', '병동', '응급'], role='prop')
def _screen(c):
    def panel(x0, w, y0, y1, tone):
        # 윗면 가로대 3px
        c.R(x0, y0, w, 3, K('wood', 5)); c.HL(x0, y0, w, K('wood', 5)); c.HL(x0, y0 + 2, w, K('wood', 4))
        # 천 패널
        c.R(x0 + 1, y0 + 3, w - 2, y1 - y0 - 6, K('linen', tone))
        c.HL(x0 + 1, y0 + 3, w - 2, K('linen', 2 if tone == 4 else 1))
        for yy in (y0 + 9, y0 + 15):
            c.HL(x0 + 2, yy, w - 4, K('linen', 2 if tone == 4 else 1))
        # 틀 기둥 양쪽
        c.R(x0, y0 + 3, 1, y1 - y0 - 3, K('wood', 4)); c.R(x0 + w - 1, y0 + 3, 1, y1 - y0 - 3, K('wood', 2))
        # 아랫 가로대
        c.R(x0, y1 - 3, w, 3, K('wood', 3)); c.HL(x0, y1 - 3, w, K('wood', 4)); c.HL(x0, y1 - 1, w, K('wood', 1))
    # 바깥 두 폭은 뒤(위)로, 가운데는 앞(아래)
    panel(1, 10, 3, 27, 4)       # 왼쪽: 빛을 받아 밝다
    panel(21, 10, 3, 27, 2)      # 오른쪽: 그늘
    panel(10, 12, 5, 30, 4)      # 가운데: 앞으로 나온 폭
    # 접힘선 그림자(가운데 폭 양옆)
    c.VL(10, 8, 20, K('wood', 1)); c.VL(21, 8, 20, K('wood', 1))
    # 짧은 발
    for x0 in (2, 11, 18, 27): c.R(x0, 30, 3, 1, K('wood', 2))
    c.outline()


# ───────────────────────── 치료 카트 ─────────────────────────
@REG.piece('wz-inf-cart', '치료 카트', 1, 2, ['S', 'S'], 'furniture', SP,
           desc='바퀴 달린 황동 카트. 위 쟁반에 색색의 약병이 서 있고, 아래 선반에 붕대 두루마리가 놓였다.',
           rules='병상 사이 통로에 둔다. 약병은 자홍·청록·황.', tags=['카트', '약병', '황동'], role='prop')
def _cart(c):
    # 약병 3개(쟁반 위)
    def vial(x, y, h, col):
        c.R(x + 1, y, 2, 2, K('wood', 4)); c.HL(x + 1, y, 2, K('wood', 5))     # 코르크
        c.R(x, y + 2, 4, h - 2, K(col, 3)); c.VL(x, y + 2, h - 2, K(col, 4)); c.VL(x + 3, y + 2, h - 2, K(col, 1))
        c.P(x + 1, y + 3, K('snow', 3))
    vial(2, 3, 8, 'violet'); vial(7, 5, 6, 'glow'); vial(11, 4, 7, 'fire')
    # 쟁반(윗면 + 정면)
    c.R(0, 10, 16, 4, K('brass', 5)); c.HL(0, 10, 16, K('brass', 5)); c.HL(0, 13, 16, K('brass', 4))
    c.R(0, 14, 16, 2, K('brass', 3)); c.VL(15, 10, 6, K('brass', 2))
    # 기둥 + 아래 선반(옆에서 정면)
    for x0 in (1, 13): c.R(x0, 16, 2, 11, K('brass', 3)); c.VL(x0, 16, 11, K('brass', 4)); c.VL(x0 + 1, 16, 11, K('brass', 2))
    c.R(1, 21, 14, 3, K('brass', 4)); c.HL(1, 21, 14, K('brass', 5)); c.HL(1, 23, 14, K('brass', 2))
    # 아래 선반 위 붕대 두루마리
    c.R(4, 18, 8, 3, K('snow', 3)); c.HL(4, 18, 8, K('snow', 3)); c.HL(4, 20, 8, K('snow', 1)); c.VL(11, 18, 3, K('snow', 1))
    c.P(5, 19, K('snow', 1)); c.P(8, 19, K('snow', 2))
    # 바퀴 2개
    for cx in (3, 12):
        c.R(cx - 1, 27, 3, 4, K('iron', 3)); c.VL(cx - 1, 27, 4, K('iron', 4)); c.VL(cx + 1, 27, 4, K('iron', 1))
        c.P(cx, 29, K('brass', 4))
    c.R(1, 25, 14, 2, K('brass', 2))
    c.outline()


@REG.piece('wz-inf-bandage', '붕대 두루마리', 1, 1, ['f'], 'surfaces', SP,
           desc='바닥에 놓인 흰 붕대 두루마리. 한쪽 끝이 풀려 바닥을 따라 늘어졌다.',
           rules='병상 곁·카트 아래 바닥 덧그림. 사람 밑에 깔린다.', tags=['붕대', '바닥'], role='prop')
def _bandage(c):
    # 두루마리 몸통(위에서 보는 원통) + 왼쪽 단면 + 풀린 꼬리
    c.R(4, 5, 7, 7, K('snow', 3)); c.HL(4, 5, 7, K('snow', 3)); c.HL(4, 11, 7, K('snow', 1))
    c.HL(4, 8, 7, K('snow', 2)); c.VL(10, 5, 7, K('snow', 1))
    c.ellipse(4, 8, 3, 3.5, K('snow', 2)); c.ellipse(4, 8, 1.5, 2, K('snow', 3))
    c.P(4, 8, K('snow', 0)); c.P(4, 7, K('snow', 1))
    # 풀린 꼬리: 바닥을 따라 구불
    c.R(11, 10, 3, 2, K('snow', 3)); c.R(13, 11, 2, 2, K('snow', 3)); c.HL(11, 11, 3, K('snow', 2))
    c.HL(13, 12, 2, K('snow', 1)); c.P(14, 13, K('snow', 1))
    c.outline()


@REG.piece('wz-inf-splint', '부목', 1, 1, ['f'], 'surfaces', SP,
           desc='바닥에 놓인 나무 부목 두 장과 린넨 끈. 응급 처치용.',
           rules='카트·칸막이 곁 바닥 덧그림.', tags=['부목', '바닥'], role='prop')
def _splint(c):
    def board(x, y, w, h):
        c.R(x, y, w, h, K('wood', 4)); c.HL(x, y, w, K('wood', 5)); c.HL(x, y + h - 1, w, K('wood', 3))
        c.VL(x + w - 1, y, h, K('wood', 2))
        c.P(x + 2, y + 1, K('wood', 3)); c.P(x + w - 5, y + 2, K('wood', 3))
    board(1, 3, 14, 4); board(2, 9, 12, 4)
    # 린넨 끈(두 장을 가로지름)
    for x in (5, 10):
        c.R(x, 2, 2, 12, K('linen', 3)); c.VL(x + 1, 2, 12, K('linen', 1)); c.VL(x, 2, 12, K('linen', 4))
        c.P(x, 7, K('wood', 2)); c.P(x + 1, 7, K('wood', 2))
    c.outline()


@REG.piece('wz-inf-basin', '물 대야', 1, 1, ['S'], 'furniture', SP,
           desc='세 발 나무 받침 위에 놓인 흰 사기 대야. 맑은 물이 찰랑인다.',
           rules='병상 곁·벽 앞에 놓는다. 윗면은 3/4 타원.', tags=['대야', '물'], role='prop')
def _basin(c):
    c.R(2, 10, 2, 6, K('wood', 3)); c.VL(2, 10, 6, K('wood', 4)); c.VL(3, 10, 6, K('wood', 2))
    c.R(12, 10, 2, 6, K('wood', 3)); c.VL(12, 10, 6, K('wood', 4)); c.VL(13, 10, 6, K('wood', 2))
    c.R(7, 11, 2, 5, K('wood', 2)); c.HL(3, 12, 10, K('wood', 2))
    c.cylinder(8, 2, 7, 5, 3, 'snow', base=2)
    c.ellipse(8, 5, 5.5, 2, K('water', 3)); c.ellipse(8, 5, 5.5, 2, K('water', 2), fill=False)
    c.HL(5, 4, 3, K('water', 4)); c.P(10, 5, K('water', 5)); c.P(6, 6, K('water', 4))
    c.outline()


def bottle(c, x, bottom, h, col, w=3, neck=True):
    y = bottom - h + 1
    c.R(x, y + 2, w, h - 2, K(col, 3)); c.VL(x, y + 2, h - 2, K(col, 4)); c.VL(x + w - 1, y + 2, h - 2, K(col, 1))
    c.P(x + 1, y + 3, K('snow', 3))
    c.R(x + 1, y + 1, w - 2, 1, K(col, 2))
    c.R(x + 1, y, w - 2, 1, K('wood', 4))


@REG.piece('wz-inf-shelf', '약병 진열 선반', 2, 2, ['SS', 'SS'], 'furniture', SP,
           desc='오크 진열장. 칸마다 색색의 약병이 줄지어 서 있다. 위는 두꺼운 윗면.',
           rules='병동 벽 앞 가운데 놓는다.', tags=['선반', '약병', '진열'], role='prop')
def _shelf(c):
    c.box(0, 0, 32, 32, 5, 'wood', base=3)
    c.R(3, 8, 26, 20, K('wood', 0)); c.R(3, 8, 26, 20, K('wood', 1))
    c.HL(3, 8, 26, K('wood', 0)); c.VL(3, 8, 20, K('wood', 0))
    cols = ['violet', 'glow', 'fire', 'water', 'red', 'glow', 'violet', 'fire']
    rows = ((15, 6), (22, 5), (27, 4))
    for ri, (bottom, hh) in enumerate(rows):
        for i in range(6):
            col = cols[(i * 3 + ri * 2) % len(cols)]
            bh = hh if (i + ri) % 3 else hh - 1
            bottle(c, 4 + i * 4, bottom, bh, col)
    for y in (16, 23):
        c.R(3, y, 26, 2, K('wood', 4)); c.HL(3, y, 26, K('wood', 5)); c.HL(3, y + 1, 26, K('wood', 2))
    c.R(3, 28, 26, 1, K('wood', 3))
    c.outline()


@REG.piece('wz-inf-chart', '환자 기록판', 1, 1, ['S'], 'furniture', SP,
           desc='벽에 걸린 오크 판. 양피지에 환자 기록과 붉은 열 곡선이 그려졌다.',
           rules='병동 북벽 정면에 건다.', tags=['기록판', '벽걸이'], role='prop')
def _chart(c):
    # 못 + 판 + 양피지 + 곡선
    c.P(7, 0, K('iron', 3)); c.P(8, 0, K('iron', 3)); c.P(7, 1, K('iron', 2)); c.P(8, 1, K('iron', 2))
    c.R(3, 2, 11, 13, K('wood', 3)); c.HL(3, 2, 11, K('wood', 5)); c.VL(3, 2, 13, K('wood', 4)); c.VL(13, 2, 13, K('wood', 2))
    c.HL(3, 14, 11, K('wood', 2))
    c.R(5, 4, 7, 9, K('linen', 3)); c.HL(5, 4, 7, K('linen', 4)); c.VL(11, 4, 9, K('linen', 2))
    c.R(6, 3, 5, 2, K('brass', 4)); c.HL(6, 3, 5, K('brass', 5)); c.HL(6, 4, 5, K('brass', 2))
    c.HL(6, 6, 4, K('night', 2)); c.HL(6, 8, 3, K('night', 2))
    for x, y in ((6, 11), (7, 10), (8, 11), (9, 9), (10, 10)): c.P(x, y, K('red', 3))
    c.outline()


@REG.piece('wz-inf-candle', '야간 촛대', 1, 1, ['S'], 'furniture', SP,
           desc='키 큰 철 촛대. 가는 기둥 위 접시에 짧은 초가 타오른다.',
           rules='병상 머리맡 통로에 둔다. 불꽃은 밤 조명 표지.', tags=['촛대', '철', '불꽃'], role='prop')
def _candle(c):
    # 불꽃 + 초 + 접시 + 기둥 + 3단 받침
    c.P(8, 0, K('fire', 3)); c.R(7, 1, 2, 2, K('fire', 2)); c.P(8, 1, K('fire', 4)); c.P(8, 2, K('fire', 3))
    c.R(7, 3, 2, 4, K('snow', 3)); c.VL(8, 3, 4, K('snow', 1)); c.P(7, 3, K('snow', 3))
    c.R(5, 7, 6, 1, K('iron', 4)); c.R(6, 8, 4, 1, K('iron', 2))
    c.R(7, 9, 2, 4, K('iron', 3)); c.VL(7, 9, 4, K('iron', 4)); c.VL(8, 9, 4, K('iron', 1))
    c.R(5, 13, 6, 1, K('iron', 4)); c.R(4, 14, 8, 2, K('iron', 3)); c.HL(4, 14, 8, K('iron', 4)); c.HL(4, 15, 8, K('iron', 1))
    c.outline()


@REG.piece('wz-inf-table', '침대 옆 탁자', 1, 1, ['S'], 'furniture', SP,
           desc='침대 곁 작은 오크 탁자. 서랍 하나와 위에 물 컵.',
           rules='병상 머리 쪽 옆에 놓는다. 윗면 5px.', tags=['탁자', '서랍', '물컵'], role='prop')
def _table(c):
    # 물 컵
    c.R(9, 1, 3, 4, K('water', 4)); c.VL(9, 1, 4, K('snow', 3)); c.VL(11, 1, 4, K('water', 2)); c.HL(9, 1, 3, K('water', 5))
    c.box(1, 4, 14, 11, 5, 'wood', base=3)
    c.R(3, 11, 10, 3, K('wood', 2)); c.HL(3, 11, 10, K('wood', 4)); c.HL(3, 13, 10, K('wood', 1))
    c.R(7, 12, 2, 1, K('brass', 4))
    c.R(1, 15, 2, 1, K('wood', 1)); c.R(13, 15, 2, 1, K('wood', 1))
    c.outline()


def _ward_place():
    pl = [('wz-inf-wall-nw', 0, 0), ('wz-inf-wall-ne', 13, 0)]
    north = {1: 'n', 2: 'big', 4: 'n', 5: 'win', 6: 'n', 7: 'door', 8: 'n', 9: 'win', 10: 'big', 12: 'n'}
    for x, k in north.items():
        pid = {'n': 'wz-inf-wall-n', 'big': 'wz-inf-wall-n-window-big', 'win': 'wz-inf-wall-n-window',
               'door': 'wz-inf-door-open'}[k]
        pl.append((pid, x, 0))
    for y in range(4, 10):
        pl += [('wz-inf-wall-w', 0, y), ('wz-inf-wall-e', 13, y)]
    pl += [('wz-inf-wall-sw', 0, 10), ('wz-inf-wall-se', 13, 10)]
    pl += [('wz-inf-wall-s', x, 10) for x in range(1, 13)]
    beds = [(1, 4, 'patient'), (4, 4, 'empty'), (8, 4, 'empty'), (1, 7, 'empty'), (4, 7, 'patient'), (8, 7, 'patient')]
    for x, y, _ in beds:
        pl.append(('wz-inf-bed-shadow', x, y))
    pl += [('wz-inf-bandage', 7, 8), ('wz-inf-splint', 7, 6)]
    for x, y, k in beds:
        pl.append(('wz-inf-bed-' + k, x, y))
    pl += [('wz-inf-curtain-closed', 3, 4), ('wz-inf-curtain-open', 3, 7), ('wz-inf-curtain-closed', 6, 4),
           ('wz-inf-curtain-open', 6, 7), ('wz-inf-curtain-open', 10, 4)]
    pl += [('wz-inf-chart', 4, 2), ('wz-inf-chart', 8, 2),
           ('wz-inf-shelf', 11, 4), ('wz-inf-table', 7, 4), ('wz-inf-candle', 7, 5),
           ('wz-inf-basin', 10, 7), ('wz-inf-table', 11, 7), ('wz-inf-cart', 12, 7),
           ('wz-inf-screen', 10, 8), ('wz-inf-candle', 12, 9)]
    return pl


REG.example('wz-inf-example-ward', '병동 예제', SP, 14, 12, 'wz-inf-floor-a', _ward_place(),
            desc='병상 6개를 두 줄로 놓고 커튼·카트·약병 선반·칸막이를 둔 병동. 북벽에 아치 창과 열린 문.')

# @@MORE@@

if __name__ == '__main__':
    sys.exit(1 if run_module(MODULE) else 0)
