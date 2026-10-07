"""온실(greenhouse) — 철제 리브·유리 지붕·석재 기단·젖은 벽돌 바닥·분갈이 작업대·맨드레이크·덩굴.
  python3 scripts/content/wizarding/pieces/greenhouse.py   → 검사 + tiledata/wizarding/review/greenhouse.png
"""
import os, sys, math
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from wzlib import REG, Cv, K, OL, OL2, run_module   # noqa: E402

MODULE = 'greenhouse'
SP = 'greenhouse'
ST = 'stone'


def hsh(x, y, s=0):
    return (((x * 73856093) ^ (y * 19349663) ^ (s * 83492791)) & 0xffff) / 65536.0


def sub(w, h):
    return Cv(w, h)


def finish(c, s, x, y, ol=True):
    """s 캔버스에 유색 윤곽을 두르고 c 의 (x,y) 에 얹는다."""
    if ol: s.outline()
    c.blit(s, x, y)


# ───────────────────────── 구조 공통 ─────────────────────────
GLASS_Y0, GLASS_Y1 = 13, 40      # 북벽 유리면(투명)
PLINTH_Y = 44                    # 석재 기단 시작


def top_cap(c, x0=0, w=16):
    """벽 윗면(두께 9px) — 밝은 석재."""
    c.R(x0, 0, w, 9, K(ST, 5))
    for x in range(x0, x0 + w):
        lx = x % 16
        if lx in (5, 12): c.VL(x, 1, 7, K(ST, 4))
        if hsh(lx, 3, 7) < 0.1: c.P(x, 2 + int(hsh(lx, 1, 3) * 5), K(ST, 4))
    c.HL(x0, 0, w, K(ST, 1)); c.HL(x0, 8, w, K(ST, 4)); c.HL(x0, 9, w, K(ST, 3))


def iron_rail(c, y, x0=0, w=16):
    c.HL(x0, y, w, K('iron', 4)); c.HL(x0, y + 1, w, K('iron', 3)); c.HL(x0, y + 2, w, K('iron', 1))


def rib(c, x, y0, y1):
    """세로 철 리브 2px: 왼쪽 빛, 오른쪽 그늘."""
    c.VL(x, y0, y1 - y0 + 1, K('iron', 4)); c.VL(x + 1, y0, y1 - y0 + 1, K('iron', 2))


def glass_pane(c, x0, y0, w, h, seed=0):
    """뒤가 보이는 유리면: 비워 두고 위 그늘 한 줄 + 짧은 1px 반사선만."""
    c.clear(x0, y0, w, h)
    c.HL(x0, y0, w, K('water', 2))
    # 짧은 대각 반사선
    ax = x0 + 2 + int(hsh(seed, 1, 2) * 3); ay = y0 + 3 + int(hsh(seed, 2, 2) * 3)
    for k in range(3): c.P(ax + k, ay + 2 - k, K('water', 5))
    bx = x0 + w - 6; by = y0 + h - 8
    if by > ay + 5:
        for k in range(2): c.P(bx + k, by + 1 - k, K('water', 4))


def plinth(c, x0=0, w=16, y0=PLINTH_Y, h=20, base=3):
    """기단: 윗단 턱(밝음) + 큰 블록 정면 + 아래 어두운 줄. 가로 16 주기."""
    c.R(x0, y0, w, 2, K(ST, 5)); c.HL(x0, y0 + 1, w, K(ST, 4))
    courses = ((6, (0, 9)), (6, (4, 12)), (6, (0, 7)))
    y = y0 + 2
    for ri, (rh, cut) in enumerate(courses):
        for x in range(x0, x0 + w):
            lx = x % 16
            start = max([k for k in cut if k <= lx] or [cut[-1] - 16])
            tone = base + (-1 if hsh(start, ri, 3) < 0.3 else 0)
            for yy in range(y, y + rh):
                col = K(ST, tone)
                if yy == y: col = K(ST, tone + 1)
                elif yy == y + rh - 1: col = K(ST, 2)
                if lx == start and yy != y + rh - 1: col = K(ST, tone + 1)
                if ((lx + 1) % 16 in cut) and yy != y + rh - 1: col = K(ST, 2)
                c.P(x, yy, col)
            if hsh(x, ri, 9) < 0.04: c.P(x, y + 2 + int(hsh(x, ri, 5) * 3), K(ST, tone - 1))
        y += rh
    c.HL(x0, y0 + h - 1, w, K(ST, 1))
    c.HL(x0, y0 + h - 2, w, K(ST, 2))
    # 습기 이끼 번짐(바닥 쪽)
    for x in range(x0, x0 + w):
        if hsh(x % 16, 2, 11) < 0.12: c.P(x, y0 + h - 3, K('leaf', 1))


def wall_n_body(c, glass=True):
    top_cap(c)
    iron_rail(c, 10)
    rib(c, 0, 13, 43)
    iron_rail(c, 41)
    if glass: glass_pane(c, 2, GLASS_Y0, 14, GLASS_Y1 - GLASS_Y0 + 1, 3)
    plinth(c)


@REG.piece('wz-gh-wall-n', '온실 북벽(철틀 유리벽)', 1, 4, ['S', 'S', 'S', 'S'], 'architecture', SP,
           desc='온실 북쪽 벽 1×4. 0행 석재 윗면, 철 리브로 나눈 유리면(뒤가 비친다), 아래는 젖은 석재 기단. 가로로 이어 깐다.',
           rules='북쪽 0~3행에 가로로 이어 깐다. 문·환기창과 같은 윗면·기단 높이를 쓴다. 지붕 행 조각(wz-gh-roof)과 번갈아 써도 된다.',
           tags=['벽', '온실', '유리'], role='wall', repeat=True)
def _wall_n(c):
    wall_n_body(c)


@REG.piece('wz-gh-roof', '온실 유리 지붕 행', 1, 4, ['S', 'S', 'S', 'S'], 'architecture', SP,
           desc='온실 북벽 위로 경사 유리 지붕이 이어지는 1×4. 용마루 철 대, 두 단의 유리 지붕면(1px 반사선·뒤가 보임), 처마 철 홈통, 아래는 낮은 유리벽과 석재 기단.',
           rules='북쪽 0~3행에 가로로 이어 깐다(wz-gh-wall-n 대신). 철 리브가 칸마다 이어진다.',
           tags=['지붕', '유리', '온실'], role='roof', repeat=True)
def _roof(c):
    # 용마루 철 대
    c.HL(0, 0, 16, K('iron', 1)); c.HL(0, 1, 16, K('iron', 4)); c.HL(0, 2, 16, K('iron', 3)); c.HL(0, 3, 16, K('iron', 1))
    for (y0, y1) in ((4, 14), (18, 27)):
        glass_pane(c, 2, y0, 14, y1 - y0 + 1, 5 + y0)
        rib(c, 0, y0, y1)
        # 더 긴 경사 반사선
        for k in range(4): c.P(4 + k, y0 + 6 - k if y0 == 4 else y0 + 5 - k, K('water', 5))
    c.HL(0, 15, 16, K('iron', 4)); c.HL(0, 16, 16, K('iron', 3)); c.HL(0, 17, 16, K('iron', 1))     # 가로 서까래
    c.VL(0, 15, 3, K('iron', 4)); c.VL(1, 15, 3, K('iron', 2))
    # 처마 홈통(철)
    c.HL(0, 28, 16, K('iron', 4)); c.R(0, 29, 16, 2, K('iron', 3)); c.HL(0, 31, 16, K('iron', 1))
    for x in (3, 11): c.P(x, 29, K('iron', 2))
    # 낮은 유리벽
    c.HL(0, 32, 16, K('iron', 4)); c.HL(0, 33, 16, K('iron', 3)); c.HL(0, 34, 16, K('iron', 1))
    glass_pane(c, 2, 35, 14, 6, 9)
    rib(c, 0, 35, 43)
    iron_rail(c, 41)
    plinth(c)


# ───────────────────────── 환기창 ─────────────────────────
@REG.piece('wz-gh-vent-closed', '온실 환기창(닫힘)', 1, 4, ['S', 'S', 'S', 'S'], 'architecture', SP,
           desc='북벽의 위쪽 유리를 철틀 환기 덧창으로 닫은 1×4. 황동 경첩과 걸쇠.', rules='북벽 사이에 끼운다. 상태 묶음 gh-vent.',
           tags=['환기창'], role='wall', states='gh-vent')
def _vent_c(c):
    wall_n_body(c)
    # 덧창 틀(안쪽 한 겹 더)
    c.R(3, 15, 12, 2, K('iron', 3)); c.HL(3, 15, 12, K('iron', 4)); c.HL(3, 16, 12, K('iron', 2))
    c.R(3, 29, 12, 2, K('iron', 3)); c.HL(3, 30, 12, K('iron', 1))
    c.VL(3, 15, 16, K('iron', 4)); c.VL(14, 15, 16, K('iron', 1))
    c.VL(8, 17, 12, K('iron', 2))
    for (a, b) in ((4, 8), (9, 14)):
        pass
    c.P(5, 21, K('water', 5)); c.P(6, 20, K('water', 5)); c.P(11, 24, K('water', 4)); c.P(12, 23, K('water', 4))
    c.R(4, 15, 2, 2, K('brass', 4)); c.P(4, 15, K('brass', 5))
    c.R(12, 15, 2, 2, K('brass', 4)); c.P(12, 15, K('brass', 5))
    c.R(7, 29, 3, 2, K('brass', 4)); c.P(7, 29, K('brass', 5))        # 걸쇠


@REG.piece('wz-gh-vent-open', '온실 환기창(열림)', 1, 4, ['S', 'S', 'S', 'S'], 'architecture', SP,
           desc='환기 덧창이 바깥으로 들려 열린 1×4. 비스듬한 창짝과 받침대, 열린 틈으로 바깥이 보인다.', rules='상태 묶음 gh-vent.',
           tags=['환기창', '열림'], role='wall', states='gh-vent')
def _vent_o(c):
    wall_n_body(c)
    # 덧창이 위로 들림: 위쪽에 얇은 평행사변형 창짝
    s = sub(16, 14)
    for y in range(0, 5):
        for x in range(3 + (4 - y), 15):
            s.P(x, y, K('iron', 3))
    s.HL(3, 4, 12, K('iron', 1))
    for x in range(7, 15): s.P(x, 1, K('iron', 4))
    s.P(8, 3, K('water', 5)); s.P(9, 2, K('water', 5)); s.P(12, 3, K('water', 4))
    c.blit(s, 0, 14)
    # 받침대(쇠막대)
    c.line(13, 19, 11, 30, K('iron', 4)); c.line(14, 19, 12, 30, K('iron', 1))
    c.R(4, 28, 2, 2, K('brass', 4)); c.P(4, 28, K('brass', 5))
    c.HL(3, 31, 12, K('iron', 2))


# ───────────────────────── 문 3상태 ─────────────────────────
def door_base(c):
    top_cap(c)
    iron_rail(c, 10)
    c.R(0, 13, 16, 51, K('iron', 3))
    c.clear(2, 13, 12, 49)
    # 문틀 기둥
    c.VL(0, 13, 51, K('iron', 4)); c.VL(1, 13, 51, K('iron', 2))
    c.VL(14, 13, 51, K('iron', 3)); c.VL(15, 13, 51, K('iron', 1))
    # 문턱 돌
    c.R(0, 60, 16, 4, K(ST, 4)); c.HL(0, 60, 16, K(ST, 5)); c.HL(0, 62, 16, K(ST, 2)); c.HL(0, 63, 16, K(ST, 1))
    # 철 상인방(인방) 띠: 문짝 높이를 사람 키 수준으로 줄인다
    c.R(2, 13, 12, 9, K('iron', 3))
    c.HL(2, 13, 12, K('iron', 4)); c.HL(2, 21, 12, K('iron', 1))
    for x in (4, 7, 10): c.VL(x, 15, 5, K('iron', 2))
    c.P(11, 17, K('water', 5)); c.P(5, 16, K('iron', 4))


def door_leaf(c):
    c.R(2, 22, 12, 38, K('iron', 3))
    c.VL(2, 22, 38, K('iron', 4)); c.VL(13, 22, 38, K('iron', 2))
    c.HL(2, 22, 12, K('iron', 4))
    for (y0, y1) in ((24, 33), (37, 46), (49, 58)):
        glass_pane(c, 4, y0, 4, y1 - y0 + 1, y0)
        glass_pane(c, 9, y0, 3, y1 - y0 + 1, y0 + 3)
    c.VL(8, 24, 35, K('iron', 2))
    for y in (34, 35, 47, 48, 59):
        c.HL(2, y, 12, K('iron', 3 if y % 2 else 1))
    c.HL(2, 34, 12, K('iron', 4))
    # 손잡이
    c.R(11, 40, 2, 3, K('brass', 4)); c.P(11, 40, K('brass', 5)); c.P(12, 42, K('brass', 2))


@REG.piece('wz-gh-door-closed', '온실 문(닫힘)', 1, 4, ['S', 'S', 'S', 'S'], 'architecture', SP,
           desc='철틀 유리문 1×4, 석재 문턱. 문짝이 닫혀 막혀 있다. 상태 묶음 gh-door.', rules='북벽에 끼운다. 상태 묶음 gh-door.',
           tags=['문', '유리문'], role='wall', states='gh-door')
def _door_c(c):
    door_base(c); door_leaf(c)


@REG.piece('wz-gh-door-open', '온실 문(열림)', 1, 4, ['S', 'C', 'C', 'C'], 'architecture', SP,
           desc='문짝이 안쪽으로 열려 문틀 안이 비어 있다. 통행. 상태 묶음 gh-door.', rules='열린 칸은 통행. 상태 묶음 gh-door.',
           tags=['문', '열림'], role='wall', states='gh-door')
def _door_o(c):
    door_base(c)
    # 접힌 문짝: 왼쪽에 얇게
    c.R(2, 22, 3, 38, K('iron', 3)); c.VL(2, 22, 38, K('iron', 4)); c.VL(4, 22, 38, K('iron', 1))
    for y0 in (24, 37, 49): c.clear(3, y0, 1, 9); c.P(3, y0 + 3, K('water', 5))
    c.R(4, 40, 1, 3, K('brass', 4))
    # 바닥 쪽 문턱 그림자 없음(통행)


@REG.piece('wz-gh-door-locked', '온실 문(잠김)', 1, 4, ['S', 'S', 'S', 'S'], 'architecture', SP,
           desc='닫힌 유리문에 쇠사슬과 황동 자물쇠. 상태 묶음 gh-door.', rules='상태 묶음 gh-door.',
           tags=['문', '잠김'], role='wall', states='gh-door')
def _door_l(c):
    door_base(c); door_leaf(c)
    c.line(2, 36, 13, 46, K('iron', 4)); c.line(2, 37, 13, 47, K('iron', 1))
    c.line(13, 36, 2, 46, K('iron', 4)); c.line(13, 37, 2, 47, K('iron', 1))
    c.R(6, 40, 4, 5, K('brass', 4)); c.HL(6, 40, 4, K('brass', 5)); c.HL(6, 44, 4, K('brass', 2))
    c.VL(6, 40, 5, K('brass', 5)); c.P(8, 42, K('ink', 0)); c.P(8, 43, K('ink', 0))
    c.HL(5, 39, 6, K('brass', 1)); c.HL(5, 45, 6, K('brass', 1)); c.VL(5, 39, 7, K('brass', 1)); c.VL(10, 39, 7, K('brass', 1))


# ───────────────────────── 모서리·옆벽·남벽 ─────────────────────────
def corner_n(c, left=True):
    wall_n_body(c)
    # 모서리 기둥: 폭 5px, 꼭대기부터 바닥까지
    x0 = 0 if left else 11
    c.R(x0, 0, 5, 64, K(ST, 4))
    c.HL(x0, 0, 5, K(ST, 1)); c.R(x0, 1, 5, 8, K(ST, 5))
    c.VL(x0 if left else x0 + 4, 9, 55, K(ST, 5) if left else K(ST, 2))
    c.VL(x0 + 4 if left else x0, 9, 55, K(ST, 2) if left else K(ST, 5))
    for y in range(10, 62, 8): c.HL(x0, y, 5, K(ST, 2))
    c.HL(x0, 62, 5, K(ST, 2)); c.HL(x0, 63, 5, K(ST, 1))
    c.R(x0, 10, 5, 2, K('iron', 3)); c.R(x0, 41, 5, 3, K('iron', 3)); c.HL(x0, 43, 5, K('iron', 1))


@REG.piece('wz-gh-corner-nw', '온실 북서 모서리', 1, 4, ['S', 'S', 'S', 'S'], 'architecture', SP,
           desc='북벽 서쪽 끝 1×4. 석재 모서리 기둥에 철띠가 두른다.', rules='북벽 왼쪽 끝 0~3행.', tags=['모서리'], role='wall')
def _nw(c): corner_n(c, True)


@REG.piece('wz-gh-corner-ne', '온실 북동 모서리', 1, 4, ['S', 'S', 'S', 'S'], 'architecture', SP,
           desc='북벽 동쪽 끝 1×4. 석재 모서리 기둥에 철띠가 두른다.', rules='북벽 오른쪽 끝 0~3행.', tags=['모서리'], role='wall')
def _ne(c): corner_n(c, False)


def side_strip(c, left=True):
    """옆벽 1×1: 폭 6px 석재 기둥 사이에 유리 틈. 세로로 이어 깐다."""
    xs = range(0, 6) if left else range(10, 16)
    for x in xs:
        d = x if left else 15 - x            # 0=바깥 가장자리
        col = K(ST, 5) if d in (1,) else K(ST, 4) if d in (2, 3) else K(ST, 3) if d == 4 else K(ST, 2)
        if d == 0: col = K(ST, 2)
        for y in range(16):
            c.P(x, y, col)
    # 유리 틈(비침): 한 칸 가운데
    gx = (2, 3) if left else (12, 13)
    c.clear(gx[0], 3, 2, 8)
    for y in (2, 11):
        for x in xs: c.P(x, y, K('iron', 3))
    c.P(gx[0], 5, K('water', 5)); c.P(gx[0] + 1 if left else gx[0], 4, K('water', 4))
    for y in range(16):
        if hsh(y, 4, 2 if left else 3) < 0.1: c.P(xs[1], y, K(ST, 4))


@REG.piece('wz-gh-side-w', '온실 서쪽 옆벽', 1, 1, ['S'], 'architecture', SP,
           desc='서쪽 가장자리 옆벽 1×1. 왼쪽 석재 기둥에 유리 틈. 세로로 이어 깐다.', rules='서쪽 열에 세로로 깐다.',
           tags=['벽', '옆벽'], role='wall', repeat=True)
def _sw_(c): side_strip(c, True)


@REG.piece('wz-gh-side-e', '온실 동쪽 옆벽', 1, 1, ['S'], 'architecture', SP,
           desc='동쪽 가장자리 옆벽 1×1. 오른쪽 석재 기둥에 유리 틈. 세로로 이어 깐다.', rules='동쪽 열에 세로로 깐다.',
           tags=['벽', '옆벽'], role='wall', repeat=True)
def _se_(c): side_strip(c, False)


def south_wall(c, corner=None):
    """남쪽 낮은 벽 1×2: 위 12px 는 바깥에서 본 윗면 아님 — 낮은 벽의 윗면(밝음)과 정면 석재."""
    y0 = 8
    c.R(0, y0, 16, 9, K(ST, 5))
    for x in range(16):
        if x in (5, 12): c.VL(x, y0 + 1, 7, K(ST, 4))
        if hsh(x, 3, 5) < 0.1: c.P(x, y0 + 1 + int(hsh(x, 1, 9) * 6), K(ST, 4))
    c.HL(0, y0, 16, K(ST, 1)); c.HL(0, y0 + 8, 16, K(ST, 4))
    plinth_front(c, y0 + 9, 15)
    if corner in ('w', 'e'):
        x0 = 0 if corner == 'w' else 13
        c.R(x0, 4, 3, 28, K(ST, 4))                 # 폭 3px 모서리 기둥(상판 위부터 바닥까지)
        c.VL(x0 + (0 if corner == 'w' else 2), 4, 28, K(ST, 5))   # 하이라이트
        c.VL(x0 + (2 if corner == 'w' else 0), 4, 28, K(ST, 2))   # 그늘
        for yy in (12, 20, 28): c.HL(x0, yy, 3, K(ST, 2))
        c.HL(x0, 4, 3, K(ST, 6)); c.HL(x0, 31, 3, K(ST, 1))


def plinth_front(c, y0, h):
    courses = ((5, (0, 8)), (5, (4, 12)), (5, (0, 8)))
    y = y0
    for ri, (rh, cut) in enumerate(courses):
        for x in range(16):
            start = max([k for k in cut if k <= x] or [cut[-1] - 16])
            tone = 3 + (-1 if hsh(start, ri, 6) < 0.3 else 0)
            for yy in range(y, min(y0 + h, y + rh)):
                col = K(ST, tone)
                if yy == y: col = K(ST, tone + 1)
                elif yy == y + rh - 1: col = K(ST, 2)
                if x == start and yy != y + rh - 1: col = K(ST, tone + 1)
                if (x + 1) % 16 in cut and yy != y + rh - 1: col = K(ST, 2)
                c.P(x, yy, col)
        y += rh
    c.HL(0, y0 + h - 1, 16, K(ST, 1))
    for x in range(16):
        if hsh(x, 5, 11) < 0.12: c.P(x, y0 + h - 2, K('leaf', 1))


@REG.piece('wz-gh-wall-s', '온실 남쪽 낮은 벽', 1, 2, ['S', 'S'], 'architecture', SP,
           desc='남쪽 낮은 기단 벽 1×2. 윗면이 밝은 석재, 정면은 젖은 큰 블록과 이끼.', rules='남쪽 마지막 2행에 가로로 깐다.',
           tags=['벽', '낮은벽'], role='wall', repeat=True)
def _ws(c): south_wall(c)


@REG.piece('wz-gh-corner-sw', '온실 남서 모서리', 1, 2, ['S', 'S'], 'architecture', SP,
           desc='남쪽 낮은 벽 서쪽 끝 1×2.', rules='남쪽 왼쪽 끝.', tags=['모서리'], role='wall')
def _csw(c): south_wall(c, 'w')


@REG.piece('wz-gh-corner-se', '온실 남동 모서리', 1, 2, ['S', 'S'], 'architecture', SP,
           desc='남쪽 낮은 벽 동쪽 끝 1×2.', rules='남쪽 오른쪽 끝.', tags=['모서리'], role='wall')
def _cse(c): south_wall(c, 'e')


# ───────────────────────── 바닥 ─────────────────────────
def brick_floor(c, seed, variant):
    """젖은 벽돌 8×4 엇갈림. 16 주기."""
    tones = (2, 3, 3, 4)
    for r in range(4):
        y0 = r * 4
        off = 0 if r % 2 == 0 else 4
        for x in range(16):
            bx = (x + off) % 8
            bi = (x + off) // 8
            t = tones[int(hsh(bi + r * 3, r, seed) * 4)]
            for yy in range(4):
                y = y0 + yy
                col = K(ST, t)
                if yy == 0: col = K(ST, t + 1)           # 윗 모서리 빛
                if yy == 3 or bx == 7: col = K(ST, 1)    # 줄눈
                if bx == 0 and yy < 3: col = K(ST, t + 1)
                c.P(x, y, col)
    # 젖은 얼룩(물 램프 어두운 칸)과 이끼
    for i in range(3 if variant == 0 else 4):
        x = int(hsh(i, 1, seed) * 12) + 1; y = int(hsh(i, 2, seed) * 12) + 1
        c.P(x, y, K('water', 2)); c.P(x + 1, y, K('water', 2))
    for i in range(2):
        x = int(hsh(i, 5, seed + 3) * 15); y = (int(hsh(i, 6, seed + 3) * 4)) * 4 + 3
        c.P(x, y, K('leaf', 1 if variant == 0 else 2))
    if variant == 1:
        c.P(6, 5, K('water', 4)); c.P(7, 5, K('water', 3))


@REG.piece('wz-gh-floor-brick-a', '온실 젖은 벽돌 바닥 A', 1, 1, ['F'], 'surfaces', SP,
           desc='습기로 어둡게 젖은 회색 벽돌 바닥. 8×4 벽돌이 엇갈려 반복되고 물기 얼룩과 이끼 한두 점.', rules='온실 바닥 기본. B 와 섞어 깐다.',
           tags=['바닥', '벽돌'], role='terrain', repeat=True)
def _fa(c): brick_floor(c, 3, 0)


@REG.piece('wz-gh-floor-brick-b', '온실 젖은 벽돌 바닥 B', 1, 1, ['F'], 'surfaces', SP,
           desc='A 와 이어지는 다른 젖은 벽돌 배치. 물방울 반사 한 점.', rules='A 와 섞어 깐다.', tags=['바닥', '벽돌'],
           role='terrain', repeat=True)
def _fb(c): brick_floor(c, 11, 1)


@REG.piece('wz-gh-floor-dirt', '온실 흙 바닥', 1, 1, ['F'], 'surfaces', SP,
           desc='화단 쪽 고운 흙 바닥. 돌 조각 몇 점, 결이 완만하다.', rules='화단·재배 구역 바닥.', tags=['바닥', '흙'],
           role='terrain', repeat=True)
def _fd(c):
    c.R(0, 0, 16, 16, K('dirt', 3))
    for x in range(16):
        for y in range(16):
            h = hsh(x, y, 21)
            if h < 0.045: c.P(x, y, K('dirt', 2))
            elif h > 0.975: c.P(x, y, K('dirt', 4))
    # 어두운 음영 얼룩 둘
    for (x, y, w, h) in ((2, 9, 5, 3), (9, 2, 4, 3)):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                if hsh(xx, yy, 33) < 0.8 and not (xx in (x, x + w - 1) and yy in (y, y + h - 1)):
                    c.P(xx, yy, K('dirt', 2))
        c.HL(x + 1, y + h - 1, w - 2, K('dirt', 1))
    # 회색 돌 세 점만(비대칭)
    for (x, y) in ((11, 11), (4, 3), (13, 5)):
        c.P(x, y, K('stone', 4)); c.P(x + 1, y, K('stone', 3)); c.P(x, y + 1, K('stone', 2))


def puddle(c, spec):
    for (cx, cy, rx, ry) in spec:
        for y in range(cy - ry, cy + ry + 1):
            for x in range(cx - rx, cx + rx + 1):
                d = ((x - cx) / (rx + .5)) ** 2 + ((y - cy) / (ry + .5)) ** 2
                if d <= 1 and 0 <= x < 16 and 0 <= y < 16:
                    c.P(x, y, K('water', 2) if d > 0.55 else K('water', 3))
        c.P(cx - rx + 2, cy - 1, K('water', 5)); c.P(cx - rx + 3, cy - 1, K('water', 4))
        c.P(cx + 1, cy + 1, K('water', 4))
        c.HL(cx - rx + 1, cy + ry, 2, K('water', 1))


@REG.piece('wz-gh-water-a', '흘린 물 A', 1, 1, ['f'], 'surfaces', SP,
           desc='바닥에 흘러 고인 물 덧그림(f). 큰 물웅덩이 하나에 반사 한 점.', rules='바닥 위에 덧그린다.', tags=['물', '덧그림'], role='terrain')
def _wa(c): puddle(c, [(8, 8, 5, 3)])


@REG.piece('wz-gh-water-b', '흘린 물 B', 1, 1, ['f'], 'surfaces', SP,
           desc='물뿌리개에서 번진 작은 물웅덩이 둘(f).', rules='바닥 위에 덧그린다.', tags=['물', '덧그림'], role='terrain')
def _wb(c): puddle(c, [(5, 5, 3, 2), (11, 11, 3, 2)])


def soil_scatter(c, seed, spec):
    for (cx, cy, rx, ry) in spec:
        for y in range(cy - ry, cy + ry + 1):
            for x in range(cx - rx, cx + rx + 1):
                d = ((x - cx) / (rx + .5)) ** 2 + ((y - cy) / (ry + .5)) ** 2
                if d <= 1 and 0 <= x < 16 and 0 <= y < 16 and hsh(x, y, seed) < 0.78:
                    c.P(x, y, K('dirt', 2) if d > 0.5 else K('dirt', 3))
        c.P(cx - 1, cy - 1, K('dirt', 4)); c.P(cx + 1, cy, K('dirt', 4)); c.P(cx, cy + ry, K('dirt', 1))


@REG.piece('wz-gh-soil-a', '흩어진 분갈이 흙 A', 1, 1, ['f'], 'surfaces', SP,
           desc='바닥에 쏟아진 흙더미 덧그림(f). 가운데가 높고 가장자리가 부서진다.', rules='바닥 위에 덧그린다.', tags=['흙', '덧그림'], role='terrain')
def _sa(c): soil_scatter(c, 5, [(8, 8, 5, 3)]); c.P(3, 3, K('dirt', 3)); c.P(13, 12, K('dirt', 3))


@REG.piece('wz-gh-soil-b', '흩어진 분갈이 흙 B', 1, 1, ['f'], 'surfaces', SP,
           desc='작은 흙 부스러기 둘(f).', rules='바닥 위에 덧그린다.', tags=['흙', '덧그림'], role='terrain')
def _sb(c): soil_scatter(c, 9, [(4, 5, 3, 2), (11, 11, 3, 2)])


# ───────────────────────── 소품 공통 ─────────────────────────
def terra(c, x, y, w, h, full=False, empty_dark=False):
    """화분: 윗 테두리 림 + 몸통(위가 넓음) + 흙."""
    # 림
    c.R(x, y, w, 3, K('wood', 3)); c.HL(x, y, w, K('fire', 2)); c.HL(x, y + 2, w, K('wood', 2))
    c.P(x, y + 1, K('wood', 4)); c.VL(x + w - 1, y + 1, 2, K('wood', 2))
    # 몸통
    for yy in range(y + 3, y + h):
        ins = 1 if yy > y + 3 else 0
        c.HL(x + ins, yy, w - 2 * ins, K('wood', 3))
        c.P(x + ins, yy, K('wood', 4)); c.P(x + w - 1 - ins, yy, K('wood', 2))
    c.HL(x + 1, y + h - 1, w - 2, K('wood', 2))
    # 흙(림 위에 보이는 윗면)
    c.R(x + 1, y - 1, w - 2, 2, K('dirt', 2) if not empty_dark else K('dirt', 1))
    if full:
        c.HL(x + 2, y - 1, w - 4, K('dirt', 3))


def leaf_tuft(c, cx, by, h=5):
    """작은 잎 다발."""
    for k, (dx, dy) in enumerate(((-2, 1), (2, 1), (-1, 0), (1, 0), (0, -1))):
        c.P(cx + dx, by - h + 3 + dy, K('leaf', 3))
    c.P(cx, by - h + 2, K('leaf', 4)); c.P(cx - 1, by - h + 2, K('leaf', 4))
    c.P(cx, by - 1, K('leaf', 2))


# ───────────────────────── 분갈이 작업대 3×2 ─────────────────────────
@REG.piece('wz-gh-workbench', '분갈이 작업대', 3, 2, ['SSS', 'SSS'], 'furniture', SP,
           desc='온실 분갈이 작업대 3×2. 윗면에 흙 더미, 화분과 모종삽이 놓이고 아래는 선반이 있는 나무 다리.',
           rules='북벽 앞이나 온실 한가운데 가로로 놓는다. 위의 화분 칸은 맨드레이크 뽑힘(f) 조각을 겹칠 수 있다.',
           tags=['작업대', '분갈이'], role='prop')
def _workbench(c):
    W = 48
    # 윗면(밝은 나무) y 7..18
    c.R(1, 7, W - 2, 11, K('wood', 4))
    for y in (10, 13, 16): c.HL(1, y, W - 2, K('wood', 3))
    for x in (9, 21, 30, 40):
        c.P(x, 8, K('wood', 3)); c.P(x + 1, 11, K('wood', 3)); c.P(x - 2, 14, K('wood', 3))
    c.HL(1, 7, W - 2, K('wood', 4)); c.HL(2, 7, W - 4, K('fire', 2))
    c.HL(1, 18, W - 2, K('wood', 2))
    # 앞면 y 19..24, 선반 틀
    c.R(1, 19, W - 2, 5, K('wood', 3)); c.HL(1, 19, W - 2, K('wood', 4)); c.HL(1, 23, W - 2, K('wood', 1))
    c.VL(1, 19, 5, K('wood', 4)); c.VL(W - 2, 19, 5, K('wood', 2))
    for x in (15, 31): c.VL(x, 20, 3, K('wood', 2))
    # 다리 y 24..31
    for x0 in (2, 42):
        c.R(x0, 24, 4, 7, K('wood', 3)); c.VL(x0, 24, 7, K('wood', 4)); c.VL(x0 + 3, 24, 7, K('wood', 2))
        c.HL(x0, 30, 4, K('wood', 1))
    # 아래 선반(어둡게 비침)
    c.R(6, 25, 36, 4, K('wood', 1)); c.HL(6, 25, 36, K('ink', 1))
    c.HL(6, 29, 36, K('wood', 2))
    for (x, w_) in ((9, 5), (17, 4), (30, 6)):    # 선반 위 흙 자루/화분 그림자
        c.R(x, 26, w_, 3, K('wood', 3)); c.HL(x, 26, w_, K('wood', 4))
    # 윗면 물건: 왼쪽 화분, 가운데 흙 더미, 오른쪽 화분
    mound = Cv(14, 7)
    for y in range(7):
        w2 = 14 - y * 2
        if w2 > 0:
            mound.HL(7 - w2 // 2, 6 - y, w2, K('dirt', 3 if y < 3 else 2))
    mound.HL(5, 6, 5, K('dirt', 1)); mound.P(6, 3, K('dirt', 4)); mound.P(7, 2, K('dirt', 4)); mound.P(9, 4, K('dirt', 4))
    mound.outline(); c.blit(mound, 17, 4)
    pot = Cv(11, 11); terra(pot, 1, 3, 9, 7, True); leaf_tuft(pot, 5, 3, 4); pot.outline(); c.blit(pot, 3, 5)
    pot2 = Cv(11, 11); terra(pot2, 1, 3, 9, 7, False); pot2.outline(); c.blit(pot2, 35, 7)
    # 모종삽 가로로 꽂힘
    c.HL(32, 12, 5, K('iron', 4)); c.P(37, 12, K('iron', 3)); c.HL(29, 13, 3, K('wood', 2)); c.P(31, 13, K('wood', 1))
    # 바깥 윤곽
    c.outline()


@REG.piece('wz-gh-soilbox', '흙 상자', 2, 1, ['SS'], 'furniture', SP,
           desc='분갈이용 흙을 가득 담은 나무 상자 2×1. 윗면에 부드러운 흙, 앞면은 판자와 쇠못.', rules='작업대 옆에 둔다.',
           tags=['흙상자'], role='prop')
def _soilbox(c):
    s = Cv(30, 15)
    s.R(0, 2, 30, 13, K('wood', 3))
    # 흙 윗면
    s.R(1, 0, 28, 7, K('dirt', 3))
    for x in range(1, 29):
        for y in range(0, 7):
            h = hsh(x, y, 31)
            if h < 0.12: s.P(x, y, K('dirt', 2))
            elif h > 0.9: s.P(x, y, K('dirt', 4))
    s.HL(1, 6, 28, K('dirt', 1))
    # 앞면 판자
    s.R(0, 7, 30, 8, K('wood', 3)); s.HL(0, 7, 30, K('wood', 4)); s.HL(0, 10, 30, K('wood', 2)); s.HL(0, 14, 30, K('wood', 1))
    s.VL(0, 7, 8, K('wood', 4)); s.VL(29, 7, 8, K('wood', 2))
    for x in (7, 14, 22): s.P(x, 12, K('wood', 2))
    for x in (2, 27): s.P(x, 8, K('iron', 4)); s.P(x, 13, K('iron', 4))
    s.outline()
    c.blit(s, 1, 1)


@REG.piece('wz-gh-pot-empty', '빈 화분', 1, 1, ['S'], 'furniture', SP,
           desc='흙이 없는 빈 토분 1×1. 속이 어둡다.', rules='작업대 곁 바닥.', tags=['화분'], role='prop')
def _pe(c):
    s = Cv(12, 13)
    terra(s, 1, 3, 10, 9, False, True)
    s.R(2, 2, 8, 2, K('wood', 1)); s.HL(2, 2, 8, K('ink', 1))       # 어두운 속
    s.outline(); c.blit(s, 2, 3)
    c.shadow(3, 14, 10, 1) if hasattr(c, 'shadow') else None


@REG.piece('wz-gh-pot-full', '찬 화분', 1, 1, ['S'], 'furniture', SP,
           desc='흙을 채운 토분 1×1, 새싹 한 줄기.', rules='작업대 곁 바닥.', tags=['화분'], role='prop')
def _pf(c):
    s = Cv(12, 15)
    terra(s, 1, 6, 10, 9, True)
    s.VL(6, 2, 4, K('leaf', 2)); s.P(5, 2, K('leaf', 3)); s.P(4, 3, K('leaf', 3)); s.P(7, 3, K('leaf', 4)); s.P(8, 4, K('leaf', 3))
    s.outline(); c.blit(s, 2, 1)


@REG.piece('wz-gh-shovel', '삽', 1, 1, ['f'], 'furniture', SP,
           desc='바닥에 비스듬히 눕힌 모종삽(f). 쇠날과 나무 자루.', rules='바닥이나 작업대 위에 덧그린다.', tags=['삽', '도구'], role='prop')
def _shovel(c):
    c.line(3, 4, 10, 10, K('wood', 3)); c.line(3, 5, 10, 11, K('wood', 2)); c.P(2, 4, K('wood', 4))
    for (x, y) in ((11, 10), (12, 10), (11, 11), (12, 11), (13, 12), (11, 12), (12, 12)):
        c.P(x, y, K('iron', 4))
    c.P(13, 11, K('iron', 3)); c.P(13, 13, K('iron', 1)); c.P(12, 13, K('iron', 2)); c.P(11, 13, K('iron', 2)); c.P(10, 12, K('iron', 2))
    c.P(11, 10, K('iron', 5) if False else K('iron', 4))
    c.outline()


@REG.piece('wz-gh-watercan', '물뿌리개', 1, 1, ['S'], 'furniture', SP,
           desc='철제 물뿌리개 1×1. 둥근 몸통, 위로 솟은 긴 주둥이와 손잡이 고리.', rules='화단·작업대 곁.', tags=['물뿌리개'], role='prop')
def _can(c):
    s = Cv(15, 13)
    # 몸통 원통(윗면 타원)
    s.R(2, 4, 7, 7, K('iron', 3)); s.VL(2, 4, 7, K('iron', 4)); s.VL(8, 4, 7, K('iron', 2)); s.HL(3, 10, 5, K('iron', 1))
    s.R(2, 3, 7, 2, K('iron', 4)); s.HL(3, 2, 5, K('iron', 4)); s.P(4, 3, K('water', 4)); s.P(5, 3, K('water', 3))
    # 주둥이
    s.line(9, 8, 13, 3, K('iron', 3)); s.line(9, 9, 13, 4, K('iron', 2)); s.P(13, 2, K('iron', 4)); s.P(14, 2, K('iron', 3)); s.P(14, 3, K('iron', 2))
    # 손잡이
    s.VL(1, 3, 6, K('iron', 4)); s.P(2, 2, K('iron', 4)); s.P(3, 1, K('iron', 4))
    s.outline(); c.blit(s, 0, 2)


@REG.piece('wz-gh-earmuff-rack', '귀마개 걸이', 1, 2, ['S', 'S'], 'furniture', SP,
           desc='벽에 붙은 나무 걸이대 1×2. 못에 털 귀마개 여러 개(핑크·회색·초록)가 걸려 있다.', rules='북벽 앞 벽면에 붙인다.',
           tags=['귀마개', '걸이'], role='prop')
def _rack(c):
    # 벽 판(어두운 석재 위 목판)
    c.R(0, 0, 16, 32, K('wood', 2)); c.VL(0, 0, 32, K('wood', 3)); c.VL(15, 0, 32, K('wood', 1)); c.HL(0, 0, 16, K('wood', 4)); c.HL(0, 31, 16, K('wood', 1))
    for y in (10, 21): c.HL(1, y, 14, K('wood', 1)); c.HL(1, y + 1, 14, K('wood', 3))
    cols = [('red', 3, 4, 2), ('water', 3, 5, 2), ('leaf', 3, 4, 2)]
    for r, t in enumerate((3, 14, 25)):
        m, b0, hl, sh = cols[r]
        # 못 두 개
        for nx in (6, 9):
            c.P(nx, t + 3, K('brass', 5)); c.P(nx, t + 4, K('wood', 1))
        # 머리띠 호 (철)
        c.P(3, t + 1, K('iron', 4)); c.P(4, t, K('iron', 4)); c.P(5, t - 1, K('iron', 4)); c.HL(6, t - 1, 4, K('iron', 4))
        c.P(10, t - 1, K('iron', 4)); c.P(11, t, K('iron', 3)); c.P(12, t + 1, K('iron', 3))
        c.HL(6, t, 4, K('iron', 2)); c.P(5, t, K('iron', 2)); c.P(10, t, K('iron', 2))
        # 둥근 털 귀덮개 한 쌍 (4×5, 모서리 둥글게)
        for x0 in (2, 10):
            c.R(x0, t + 3, 4, 3, K(m, b0)); c.HL(x0, t + 2, 4, K(m, b0)); c.HL(x0 + 1, t + 1, 2, K(m, b0))
            c.HL(x0 + 1, t + 6, 2, K(m, sh)); c.P(x0 + 3, t + 5, K(m, sh)); c.P(x0 + 3, t + 4, K(m, sh))
            c.P(x0, t + 2, K(m, hl)); c.P(x0 + 1, t + 1, K(m, hl)); c.P(x0 + 1, t + 3, K(m, hl))
    c.outline()


@REG.piece('wz-gh-earmuff-basket', '귀마개 바구니', 1, 1, ['S'], 'furniture', SP,
           desc='털 귀마개가 수북이 담긴 엮은 바구니 1×1.', rules='걸이 곁 바닥.', tags=['귀마개', '바구니'], role='prop')
def _bask(c):
    s = Cv(14, 13)
    # 털 더미
    for (x, y, m, t) in ((2, 1, 'red', 3), (6, 0, 'stone', 4), (9, 2, 'leaf', 3), (4, 3, 'violet', 3), (8, 4, 'stone', 3)):
        s.R(x, y, 4, 3, K(m, t)); s.HL(x, y, 3, K(m, t + 1)); s.HL(x, y + 2, 4, K(m, t - 1))
    # 바구니 몸통
    s.R(0, 6, 14, 7, K('wood', 3)); s.HL(0, 6, 14, K('wood', 4)); s.HL(0, 12, 14, K('wood', 1))
    for y in (8, 10):
        s.HL(0, y, 14, K('wood', 2))
    for x in range(1, 14, 3): s.VL(x, 7, 5, K('wood', 2))
    s.VL(0, 6, 7, K('wood', 4)); s.VL(13, 6, 7, K('wood', 2))
    s.outline(); c.blit(s, 1, 2)


# ───────────────────────── 맨드레이크 ─────────────────────────
def mand_leaves(c, cx, by, spread=1):
    """로제트 잎: 줄기 4~5장."""
    for dx, dy, t in ((-4, 2, 3), (4, 2, 3), (-3, -1, 4), (3, -1, 4), (0, -3, 4), (-1, 0, 3), (1, 0, 3)):
        x, y = cx + dx, by + dy
        c.R(x - 1, y - 1, 3, 2, K('leaf', t))
        c.P(x - 1, y - 1, K('leaf', min(t + 1, 5))); c.P(x + 1, y, K('leaf', t - 1))
    c.VL(cx, by - 1, 3, K('leaf', 2))
    c.P(cx - 2, by + 1, K('leaf', 2)); c.P(cx + 2, by + 1, K('leaf', 2))


def mand_root(c, cx, top, mouth=True, small=False):
    """사람 얼굴 모양 뿌리. 너비 9, 높이 11. 입을 벌리고 비명."""
    h = 9 if small else 11
    wid = [5, 7, 9, 9, 9, 9, 8, 7, 5, 3, 1, 1][:h + 1]
    for i, wd in enumerate(wid[:h]):
        x = cx - wd // 2
        c.HL(x, top + i, wd, K('skin', 3))
        if wd > 2:
            c.P(x, top + i, K('skin', 4)); c.P(x + wd - 1, top + i, K('skin', 1))
    # 윗 이마 밝게, 아래 그늘
    c.HL(cx - 1, top + 1, 3, K('skin', 4))
    # 녹색 잎 줄기 연결
    c.VL(cx, top - 2, 2, K('leaf', 2)); c.P(cx - 1, top - 3, K('leaf', 3)); c.P(cx + 1, top - 3, K('leaf', 3))
    c.P(cx, top - 3, K('leaf', 4))
    # 얼굴: 눈, 입
    ey = top + 3
    c.P(cx - 2, ey, K('ink', 0)); c.P(cx + 2, ey, K('ink', 0))
    c.P(cx - 3, ey - 1, K('skin', 1)); c.P(cx - 2, ey - 1, K('skin', 1)); c.P(cx + 2, ey - 1, K('skin', 1)); c.P(cx + 3, ey - 1, K('skin', 1))
    c.P(cx, ey + 1, K('skin', 2))
    if mouth:
        my = top + 6
        c.HL(cx - 1, my, 3, K('ink', 0)); c.HL(cx - 1, my + 1, 3, K('ink', 0)); c.P(cx, my + 2, K('ink', 0))
        c.P(cx, my + 1, K('red', 2))
    # 뿌리털
    if not small:
        c.P(cx - 1, top + 10, K('skin', 2)); c.P(cx - 2, top + 11, K('skin', 2)); c.P(cx + 1, top + 11, K('skin', 2))


@REG.piece('wz-gh-mandrake-pot', '맨드레이크 (화분 속)', 1, 1, ['S'], 'nature', SP,
           desc='화분에 심긴 맨드레이크. 흙 밖으로는 두터운 녹색 잎만 올라와 있다.', rules='화분 줄이나 작업대 위.',
           tags=['맨드레이크', '화분'], role='prop', states='mandrake')
def _mp(c):
    s = Cv(14, 15)
    terra(s, 1, 8, 12, 7, True)
    mand_leaves(s, 7, 6)
    s.outline(); c.blit(s, 1, 1)


@REG.piece('wz-gh-mandrake-pulled-f', '맨드레이크 (뽑힘, 덧그림)', 1, 1, ['f'], 'nature', SP,
           desc='뽑혀 올라온 맨드레이크. 사람 얼굴 모양 뿌리가 입을 벌리고 있고 잎은 위로 처졌다. 작업대 위에 겹친다(f).',
           rules='작업대 윗면 위에 덧그린다.', tags=['맨드레이크', '뽑힘'], role='prop', states='mandrake')
def _mpf(c):
    s = Cv(15, 16)
    mand_leaves(s, 7, 4)
    mand_root(s, 7, 6, True, small=True)
    s.outline(); c.blit(s, 0, 0)


@REG.piece('wz-gh-mandrake-pulled', '맨드레이크 (뽑힘, 바닥)', 1, 1, ['S'], 'nature', SP,
           desc='바닥에 뽑혀 놓인 맨드레이크. 입을 벌린 얼굴 뿌리와 흙 부스러기, 시든 잎.', rules='바닥 위, 흙 흩어짐 곁.',
           tags=['맨드레이크', '뽑힘'], role='prop', states='mandrake')
def _mps(c):
    s = Cv(15, 16)
    mand_leaves(s, 7, 3)
    mand_root(s, 7, 5, True)
    # 바닥 흙 부스러기
    for (x, y) in ((2, 13), (3, 14), (11, 13), (12, 12), (5, 15), (9, 15)):
        s.P(x, y, K('dirt', 3))
    s.P(4, 14, K('dirt', 2)); s.P(10, 14, K('dirt', 2))
    s.outline(); c.blit(s, 0, 0)


@REG.piece('wz-gh-mandrake-replant', '맨드레이크 (재식재)', 1, 1, ['S'], 'nature', SP,
           desc='다시 심기는 중인 맨드레이크. 얼굴 뿌리 위쪽 절반이 흙 밖에 나와 눈을 감고 있고 잎이 올라온다.', rules='화분 줄 자리.',
           tags=['맨드레이크', '재식재'], role='prop', states='mandrake')
def _mr(c):
    s = Cv(15, 15)
    # 흙 둔덕
    for y in range(8, 15):
        w2 = 5 + (y - 8) * 2
        w2 = min(w2, 15)
        s.HL(7 - w2 // 2, y, w2, K('dirt', 3 if y < 11 else 2))
    s.HL(0, 14, 15, K('dirt', 1)); s.P(4, 10, K('dirt', 4)); s.P(10, 11, K('dirt', 4)); s.P(7, 9, K('dirt', 4))
    # 반쯤 보이는 얼굴 (눈 감음)
    for i, wd in enumerate([5, 7, 7, 5]):
        s.HL(7 - wd // 2, 5 + i, wd, K('skin', 3)); s.P(7 - wd // 2, 5 + i, K('skin', 4)); s.P(7 + wd // 2, 5 + i, K('skin', 1))
    s.HL(5, 7, 2, K('ink', 1)); s.HL(8, 7, 2, K('ink', 1))
    s.P(7, 9, K('skin', 2))
    mand_leaves(s, 7, 3)
    s.outline(); c.blit(s, 0, 1)


@REG.piece('wz-gh-pot-row', '맨드레이크 화분 줄', 2, 1, ['SS'], 'nature', SP,
           desc='긴 목제 화분 상자에 맨드레이크 잎 세 포기가 나란히 자란다 2×1.', rules='작업대 앞이나 벽 아래 화단.',
           tags=['맨드레이크', '화분줄'], role='prop')
def _prow(c):
    s = Cv(30, 15)
    s.R(0, 6, 30, 9, K('wood', 3)); s.HL(0, 6, 30, K('wood', 4)); s.HL(0, 9, 30, K('wood', 2)); s.HL(0, 14, 30, K('wood', 1))
    s.VL(0, 6, 9, K('wood', 4)); s.VL(29, 6, 9, K('wood', 2))
    for x in (9, 20): s.VL(x, 10, 4, K('wood', 2))
    s.R(1, 4, 28, 3, K('dirt', 2)); s.HL(1, 4, 28, K('dirt', 3))
    for cx in (6, 15, 24):
        mand_leaves(s, cx, 4)
    for x in (3, 11, 19, 27): s.P(x, 8, K('iron', 4))
    s.outline(); c.blit(s, 1, 1)


# ───────────────────────── 덩굴·독초·트레이 ─────────────────────────
def vine_path(c, pts, t=3):
    for (a, b) in zip(pts, pts[1:]):
        c.line(a[0], a[1], b[0], b[1], K('leaf', 2))
    for (a, b) in zip(pts, pts[1:]):
        c.line(a[0] + 1, a[1], b[0] + 1, b[1], K('leaf', 3))


def vleaf(c, x, y, flip=False):
    d = -1 if flip else 1
    c.P(x, y, K('leaf', 4)); c.P(x + d, y, K('leaf', 4)); c.P(x + d * 2, y + 1, K('leaf', 3)); c.P(x + d, y + 1, K('leaf', 3))
    c.P(x, y + 1, K('leaf', 2)); c.P(x + d, y + 2, K('leaf', 2))


@REG.piece('wz-gh-vine-wall', '벽 타는 덩굴', 1, 3, ['C', 'C', 'C'], 'nature', SP,
           desc='온실 벽 위로 구불구불 타고 올라가는 덩굴 1×3. 벽이 뒤로 보이도록 잎 사이가 비어 있고 작은 붉은 열매가 맺혔다.',
           rules='벽 앞에 사람 뒤로 겹쳐 그린다.', tags=['덩굴', '벽'], role='prop')
def _vw(c):
    pts = [(8, 47), (7, 40), (9, 33), (7, 26), (9, 19), (8, 12), (9, 4), (8, 0)]
    for (a, b) in zip(pts, pts[1:]):
        c.line(a[0], a[1], b[0], b[1], K('leaf', 2)); c.line(a[0] + 1, a[1], b[0] + 1, b[1], K('leaf', 3))
    for i, (x, y, f) in enumerate(((8, 42, 0), (7, 36, 1), (10, 30, 0), (6, 23, 1), (10, 16, 0), (7, 9, 1), (9, 3, 0))):
        vleaf(c, x if not f else x - 1, y, bool(f))
        if f: c.P(x + 1, y + 3, K('leaf', 4))
    for (x, y) in ((11, 34), (5, 27), (11, 20)):
        c.P(x, y, K('red', 4)); c.P(x, y + 1, K('red', 2)); c.P(x + 1, y, K('red', 3))
    c.outline()


@REG.piece('wz-gh-vine-bush', '덩굴 덤불', 2, 2, ['SS', 'SS'], 'nature', SP,
           desc='얽힌 덩굴이 부풀어 오른 2×2 덤불. 잎 덩이와 어두운 틈, 작은 흰 꽃.', rules='온실 구석 화단.', tags=['덩굴', '덤불'], role='prop')
def _vb(c):
    s = Cv(30, 28)
    cl = [(8, 9, 7), (17, 7, 7), (23, 14, 6), (11, 17, 8), (19, 20, 7), (5, 20, 5)]
    for (cx, cy, r) in cl:
        for y in range(cy - r, cy + r + 1):
            for x in range(cx - r, cx + r + 1):
                d = ((x - cx) ** 2 + (y - cy) ** 2) ** .5
                if d <= r + .3 and 0 <= x < 30 and 0 <= y < 28:
                    t = 3
                    if (x - cx) + (y - cy) < -r * 0.5: t = 4
                    if (x - cx) + (y - cy) > r * 0.6: t = 2
                    s.P(x, y, K('leaf', t))
    # 얽힌 어두운 줄기
    for (a, b) in (((4, 22), (14, 14)), ((14, 14), (26, 20)), ((10, 24), (18, 10)), ((20, 8), (24, 17))):
        s.line(a[0], a[1], b[0], b[1], K('leaf', 1))
    for (x, y) in ((6, 8), (14, 5), (21, 12), (9, 15), (17, 18), (24, 20), (13, 22)):
        s.P(x, y, K('leaf', 5)); s.P(x + 1, y, K('leaf', 5)); s.P(x, y + 1, K('leaf', 4))
    for (x, y) in ((10, 11), (19, 9), (15, 21)):
        s.P(x, y, K('snow', 4)); s.P(x + 1, y, K('snow', 3)); s.P(x, y + 1, K('snow', 3)); s.P(x - 1, y, K('brass', 4))
    s.HL(3, 26, 24, K('leaf', 1))
    s.outline(); c.blit(s, 1, 3)


@REG.piece('wz-gh-toothflower', '이빨 꽃', 1, 1, ['S'], 'nature', SP,
           desc='독성 이빨 꽃 1×1. 붉은 꽃잎 입이 벌어져 흰 송곳니가 보이는 화분 식물.', rules='독초 구역.', tags=['독초', '이빨꽃'], role='prop')
def _tf(c):
    s = Cv(14, 15)
    terra(s, 2, 10, 10, 5, True)
    s.VL(7, 8, 2, K('leaf', 3)); s.P(6, 9, K('leaf', 4)); s.P(5, 9, K('leaf', 3)); s.P(8, 9, K('leaf', 2)); s.P(9, 9, K('leaf', 3))
    rows = {0: (5, 9), 1: (4, 10), 2: (3, 11), 3: (3, 11), 4: (3, 11), 5: (3, 11), 6: (4, 10), 7: (5, 9)}
    for y, (x0, x1) in rows.items():
        for x in range(x0, x1 + 1):
            edge = x in (x0, x1) or y in (0, 7)
            if edge: s.P(x, y, K('violet', 3) if (x + y) % 2 else K('red', 4))
            else: s.P(x, y, K('red', 3))
    s.P(4, 2, K('red', 4)); s.P(5, 1, K('violet', 4)); s.P(10, 5, K('red', 2)); s.P(9, 6, K('red', 2))
    # 벌어진 입
    s.HL(5, 2, 5, K('ink', 0)); s.HL(4, 3, 7, K('ink', 0)); s.HL(4, 4, 7, K('ink', 0)); s.HL(5, 5, 5, K('ink', 0))
    # 흰 이빨 4개: 위 2개 / 아래 2개 엇갈림
    for x in (5, 8): s.P(x, 2, K('snow', 4)); s.P(x, 3, K('snow', 4))
    for x in (6, 9): s.P(x, 5, K('snow', 4)); s.P(x, 4, K('snow', 4))
    s.P(7, 4, K('red', 1)); s.P(10, 3, K('red', 1))
    s.outline(); c.blit(s, 1, 1)


@REG.piece('wz-gh-purplethorn', '보라 가시', 1, 1, ['S'], 'nature', SP,
           desc='보라색 독성 가시덤불 1×1. 굽은 줄기마다 뾰족한 가시가 돋았다.', rules='독초 구역.', tags=['독초', '가시'], role='prop')
def _pt(c):
    s = Cv(14, 15)
    terra(s, 2, 10, 10, 5, True)
    for (a, b) in (((5, 10), (3, 3)), ((7, 10), (7, 1)), ((9, 10), (11, 3)), ((6, 9), (11, 7)), ((8, 9), (2, 7))):
        s.line(a[0], a[1], b[0], b[1], K('violet', 3))
    for (x, y) in ((3, 3), (7, 1), (11, 3), (11, 7), (2, 7)):
        s.P(x, y, K('violet', 5)); s.P(x, y - 1, K('violet', 4)) if y > 0 else None
    for (x, y) in ((4, 6), (6, 5), (8, 4), (9, 8), (5, 8), (7, 7), (10, 5)):
        s.P(x, y, K('violet', 4)); s.P(x - 1, y - 1, K('violet', 5))
    for (x, y) in ((4, 4), (9, 6)):
        s.P(x, y, K('leaf', 3))
    s.outline(); c.blit(s, 1, 1)


@REG.piece('wz-gh-tentaclevine', '촉수 덩굴', 1, 1, ['S'], 'nature', SP,
           desc='꿈틀대는 독성 촉수 덩굴 1×1. 어두운 녹색 줄기가 말려 올라가고 끝에 빨판이 있다.', rules='독초 구역.', tags=['독초', '촉수'], role='prop')
def _tv(c):
    s = Cv(14, 15)
    terra(s, 2, 10, 10, 5, True)

    def tent(pts):
        path = []
        for (a, b) in zip(pts, pts[1:]):
            n = max(abs(b[0] - a[0]), abs(b[1] - a[1]), 1)
            for i in range(n):
                path.append((round(a[0] + (b[0] - a[0]) * i / n), round(a[1] + (b[1] - a[1]) * i / n)))
        path.append(pts[-1])
        for i, (x, y) in enumerate(path):
            s.P(x, y, K('leaf', 4) if i % 4 else K('leaf', 3)); s.P(x + 1, y, K('leaf', 2))
        for i, (x, y) in enumerate(path):          # 안쪽(왼쪽) 빨판 점 줄
            if i % 3 == 1 and i < len(path) - 1: s.P(x, y, K('brass', 5))
    tent([(4, 10), (3, 8), (3, 6), (4, 4), (6, 3), (7, 4), (6, 5)])
    tent([(7, 10), (8, 8), (9, 6), (9, 3), (8, 1), (6, 1), (6, 2)])
    tent([(10, 10), (11, 8), (11, 6), (10, 5), (11, 3), (12, 2)])
    s.outline(); c.blit(s, 1, 1)


@REG.piece('wz-gh-seedtray', '묘목 트레이', 2, 1, ['SS'], 'nature', SP,
           desc='얕은 나무 트레이에 어린 묘목이 줄지어 자란다 2×1. 작업대 위에 놓거나 바닥에 둔다.', rules='작업대 위(f)나 바닥(S).',
           tags=['묘목', '트레이'], role='prop')
def _st(c):
    s = Cv(30, 13)
    s.R(0, 5, 30, 8, K('wood', 3)); s.HL(0, 5, 30, K('wood', 4)); s.HL(0, 7, 30, K('wood', 2)); s.HL(0, 12, 30, K('wood', 1))
    s.VL(0, 5, 8, K('wood', 4)); s.VL(29, 5, 8, K('wood', 2))
    s.R(1, 3, 28, 3, K('dirt', 2)); s.HL(1, 3, 28, K('dirt', 3))
    for x in range(4, 28, 4):
        s.VL(x, 0, 4, K('leaf', 2)); s.P(x - 1, 0, K('leaf', 4)); s.P(x + 1, 1, K('leaf', 4)); s.P(x - 1, 2, K('leaf', 3)); s.P(x, 0, K('leaf', 5))
    s.outline(); c.blit(s, 1, 2)


# ───────────────────────── 예제 ─────────────────────────
def _ex_greenhouse():
    p = []
    top = {1: 'wz-gh-wall-n', 2: 'wz-gh-roof', 3: 'wz-gh-vent-closed', 4: 'wz-gh-wall-n', 5: 'wz-gh-roof',
           6: 'wz-gh-wall-n', 7: 'wz-gh-door-closed', 8: 'wz-gh-wall-n', 9: 'wz-gh-vent-open', 10: 'wz-gh-roof',
           11: 'wz-gh-wall-n', 12: 'wz-gh-roof'}
    for x, pid in top.items(): p.append((pid, x, 0))
    p += [('wz-gh-corner-nw', 0, 0), ('wz-gh-corner-ne', 13, 0)]
    for y in range(4, 9):
        p += [('wz-gh-side-w', 0, y), ('wz-gh-side-e', 13, y)]
    for x in range(1, 13): p.append(('wz-gh-wall-s', x, 9))
    p += [('wz-gh-corner-sw', 0, 9), ('wz-gh-corner-se', 13, 9)]
    # 덧그림 바닥
    p += [('wz-gh-water-a', 6, 5), ('wz-gh-water-b', 6, 8), ('wz-gh-soil-a', 3, 6), ('wz-gh-soil-b', 10, 6), ('wz-gh-soil-a', 12, 4)]
    # 벽 덩굴·귀마개
    p += [('wz-gh-vine-wall', 1, 0), ('wz-gh-vine-wall', 12, 0), ('wz-gh-vine-wall', 5, 0), ('wz-gh-earmuff-rack', 9, 2)]
    # 작업대 첫 줄
    p += [('wz-gh-workbench', 1, 4), ('wz-gh-workbench', 4, 4), ('wz-gh-workbench', 9, 4)]
    p += [('wz-gh-mandrake-pulled-f', 5, 4), ('wz-gh-seedtray', 2, 4), ('wz-gh-earmuff-basket', 8, 4)]
    p += [('wz-gh-toothflower', 12, 5), ('wz-gh-soilbox', 1, 6), ('wz-gh-watercan', 8, 6)]
    # 둘째 줄
    p += [('wz-gh-workbench', 8, 7), ('wz-gh-pot-row', 4, 7), ('wz-gh-mandrake-replant', 6, 7),
          ('wz-gh-mandrake-pulled', 7, 8), ('wz-gh-pot-full', 2, 7), ('wz-gh-pot-empty', 3, 8), ('wz-gh-shovel', 1, 8),
          ('wz-gh-vine-bush', 11, 7), ('wz-gh-purplethorn', 12, 6), ('wz-gh-tentaclevine', 1, 7),
          ('wz-gh-mandrake-pot', 9, 7)]
    return p


REG.example('wz-gh-example-greenhouse', '온실 맨드레이크 분갈이실', 'greenhouse', 14, 11, 'wz-gh-floor-brick-a', _ex_greenhouse(),
            desc='유리 지붕 북벽 아래 분갈이 작업대 두 줄, 맨드레이크 화분과 뽑힌 뿌리, 독초, 벽을 타는 덩굴이 있는 온실 내부.')


if __name__ == '__main__':
    sys.exit(1 if run_module(MODULE) else 0)
