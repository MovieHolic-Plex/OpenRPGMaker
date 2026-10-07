"""도서관 제한 구역 + 지팡이 가게 보강 (손 도트, 코드로 찍음).
  python3 scripts/content/wizarding/pieces/library.py   → 검사 + tiledata/wizarding/review/library.png
"""
import os, sys, random
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from wzlib import REG, Cv, K, OL, OL2, run_module   # noqa: E402

MODULE = 'library'


# ───────────────────────── 공용 도우미 ─────────────────────────
def chain_line(c, x0, y0, x1, y1, step=3):
    """두 점 사이를 쇠사슬 고리로 잇는다: 고리마다 밝은 가로 고리·어두운 세로 고리를 번갈아."""
    n = max(abs(x1 - x0), abs(y1 - y0))
    k = 0
    last = None
    for i in range(0, n + 1, step):
        t = i / n if n else 0
        x = round(x0 + (x1 - x0) * t); y = round(y0 + (y1 - y0) * t)
        if k % 2 == 0:
            c.R(x - 1, y, 3, 2, K('iron', 3)); c.P(x, y, K('iron', 1)); c.P(x - 1, y, K('iron', 4))
        else:
            c.R(x, y - 1, 2, 3, K('iron', 2)); c.P(x, y, K('iron', 4)); c.P(x + 1, y + 1, K('iron', 1))
        k += 1


def padlock(c, cx, y):
    """황동 맹꽁이자물쇠: 고리 + 몸통 + 열쇠구멍."""
    c.HL(cx - 2, y, 4, K('iron', 4)); c.VL(cx - 2, y, 3, K('iron', 3)); c.VL(cx + 1, y, 3, K('iron', 2))
    c.R(cx - 3, y + 3, 6, 5, K('brass', 3)); c.HL(cx - 3, y + 3, 6, K('brass', 5)); c.VL(cx - 3, y + 3, 5, K('brass', 4))
    c.VL(cx + 2, y + 3, 5, K('brass', 1)); c.HL(cx - 3, y + 7, 6, K('brass', 1))
    c.P(cx - 1, y + 5, K('ink', 0)); c.P(cx - 1, y + 6, K('ink', 0))
    c.outline_rect(cx - 3, y + 3, 6, 5, K('brass', 0))


def stone_mass(c, x, y, w, h, seed, base=3):
    c.stone_blocks(x, y, w, h, 'stone', base, row_h=(5, 6), seed=seed)
    c.VL(x, y, h, K('stone', base + 1)); c.VL(x + w - 1, y, h, K('stone', base - 2))


def iron_bar(c, x, y, h, tip=True):
    """세로 철창 한 가닥(폭 2): 왼쪽 밝고 오른쪽 어둡다. 끝은 창끝."""
    c.R(x, y, 2, h, K('iron', 3)); c.VL(x, y, h, K('iron', 4)); c.VL(x + 1, y, h, K('iron', 2))
    if tip:
        c.P(x, y - 2, K('iron', 4)); c.P(x + 1, y - 1, K('iron', 3)); c.R(x, y - 1, 2, 1, K('iron', 4))
        c.P(x, y - 2, K('iron', 4))


def rail(c, x, y, w):
    c.R(x, y, w, 2, K('iron', 3)); c.HL(x, y, w, K('iron', 4)); c.HL(x, y + 1, w, K('iron', 1))


# ───────────────────────── 마모 포석 ─────────────────────────
def _worn_flag(c, seed, stain):
    c.stone_blocks(0, 0, 16, 16, 'stone', 2, row_h=(7, 8), seed=seed, period=16)
    rnd = random.Random(seed * 7 + 3)
    # 닳아 반들한 모퉁이 밝은 점·균열
    for _ in range(5):
        x = rnd.randrange(16); y = rnd.randrange(16)
        c.P(x, y, K('stone', 3)); c.P((x + 1) % 16, y, K('stone', 3))
    if stain == 0:
        for x, y in ((3, 4), (4, 4), (4, 5), (5, 6), (10, 11), (11, 11), (11, 12), (12, 13)): c.P(x, y, K('stone', 0))
        for x, y in ((12, 3), (13, 3), (2, 12), (3, 12)): c.P(x, y, K('stone', 4))
    else:
        for x, y in ((6, 2), (7, 2), (7, 3), (8, 4), (8, 5), (1, 10), (2, 10), (2, 11)): c.P(x, y, K('stone', 0))
        for x, y in ((11, 8), (12, 8), (12, 9), (11, 9), (5, 13), (6, 13)): c.P(x, y, K('stone', 1))   # 얼룩


@REG.piece('wz-lib-floor-worn-a', '도서관 마모 포석 A', 1, 1, ['F'], 'surfaces', 'library',
           desc='공용 포석보다 어둡고 닳은 도서관 바닥 포석. 균열이 가는 결.', rules='1×1 반복으로 도서관 바닥에 깐다. B 와 섞는다.',
           tags=['바닥', '포석', '도서관'], role='terrain', repeat=True)
def _flag_a(c):
    # 불규칙 블록(6+10, 11+5, 4+5+7) · 위 모서리만 전부 밝게 · 왼 모서리 빛은 일부 블록에만 · 줄눈 위치가 줄마다 다르다
    rows = [(0, 6, [(0, 6, 2, False), (6, 10, 1, True)]),
            (6, 5, [(0, 11, 2, True), (11, 5, 3, False)]),
            (11, 5, [(0, 4, 3, False), (4, 5, 2, False), (9, 7, 2, True)])]
    mort = K('stone', 0)
    for y, h, bl in rows:
        for x, w, t, lh in bl:
            c.R(x, y, w, h, K('stone', t)); c.HL(x, y, w, K('stone', t + 1))
            if lh: c.VL(x, y + 1, h - 3, K('stone', t + 1))
            c.HL(x, y + h - 1, w, mort); c.VL(x + w - 1, y, h, mort)
    for x, y in ((3, 4), (4, 4), (4, 5), (12, 12), (13, 12), (13, 13)): c.P(x, y, K('stone', 0))
    for x, y in ((8, 2), (9, 2), (2, 8), (14, 8)): c.P(x, y, K('stone', 4))


@REG.piece('wz-lib-floor-worn-b', '도서관 마모 포석 B', 1, 1, ['F'], 'surfaces', 'library',
           desc='A 보다 얼룩이 짙은 마모 포석. A 와 섞어 단조로움을 깬다.', rules='1×1 반복. 서가 앞 통로에 A 와 섞어 깐다.',
           tags=['바닥', '포석', '도서관'], role='terrain', repeat=True)
def _flag_b(c): _worn_flag(c, 23, 1)


# ───────────────────────── 도서관 아치 ─────────────────────────
@REG.piece('wz-lib-arch', '성채 도서관 아치(열린)', 2, 4, ['CC', 'CC', 'CC', 'CC'], 'architecture', 'library',
           desc='북벽에 끼우는 열린 돌 아치 2×4. 양옆 돌기둥, 위에 쐐기돌 아치, 안은 어두운 서고 복도.',
           rules='wall-n 행 0~3 에 끼운다. 아치 밑은 통행(사람이 아치 밑을 지나며 가려진다).', tags=['아치', '출입구', '도서관'], role='wall')
def _arch(c):
    W, H = 32, 64
    c.R(0, 0, W, H, K('night', 2))                        # 안쪽 어둠
    # 안쪽 복도 바닥 줄무늬(멀수록 어둡게)
    c.R(5, 40, 22, 24, K('night', 2))
    for y in range(44, 64, 4): c.HL(5, y, 22, K('night', 3))
    # 양옆 기둥
    stone_mass(c, 0, 6, 5, 58, 5); stone_mass(c, 27, 6, 5, 58, 6)
    c.VL(4, 14, 50, K('stone', 1)); c.VL(27, 14, 50, K('stone', 1))   # 안쪽 그림자
    # 기둥 머리·밑동
    for x in (0, 27): c.R(x - (0 if x == 0 else 0), 6, 5, 3, K('stone', 5)); c.HL(x, 8, 5, K('stone', 2))
    c.R(0, 60, 5, 4, K('stone', 4)); c.R(27, 60, 5, 4, K('stone', 3)); c.HL(0, 60, 5, K('stone', 5)); c.HL(27, 60, 5, K('stone', 5))
    # 아치: 위 반원(쐐기돌)
    cx, cy, ro, ri = 16, 22, 16, 10
    for y in range(0, 24):
        for x in range(0, W):
            d = ((x + 0.5 - cx) ** 2 + ((y + 0.5 - cy) * 1.0) ** 2) ** 0.5
            if y < cy and d <= ro + 0.2 and d > ri:
                ang = (x - cx) / max(1, d)
                t = 5 if ang < -0.35 else 4 if ang < 0.4 else 3
                c.P(x, y, K('stone', t))
            elif y < cy and d <= ri:
                c.P(x, y, K('night', 2))
    # 쐐기돌 줄(방사 이음)
    for a in (-0.80, -0.45, -0.12, 0.12, 0.45, 0.80):
        for r in range(ri + 1, ro):
            x = round(cx + r * a / (1 + a * a) ** 0.5 * 1.0); y = round(cy - r * (1 / (1 + a * a) ** 0.5))
            c.P(x, y, K('stone', 1))
    c.R(14, 2, 4, 6, K('stone', 5)); c.VL(14, 2, 6, K('stone', 5)); c.VL(17, 2, 6, K('stone', 3)); c.HL(14, 7, 4, K('stone', 2))   # 쐐기돌
    c.P(15, 4, K('brass', 4)); c.P(16, 4, K('brass', 3))                                             # 쐐기돌 문장 점
    # 좌우 어깨 돌
    c.R(0, 22, 5, 2, K('stone', 4)); c.R(27, 22, 5, 2, K('stone', 3))
    # 안쪽 책장 그림자가 보이는 암시: 안쪽 벽의 희미한 서가선
    for x in (9, 13, 19, 23): c.VL(x, 30, 12, K('night', 3))
    c.outline()
    # 바닥 문턱 돌(앞)
    c.R(5, 62, 22, 2, K('stone', 3)); c.HL(5, 62, 22, K('stone', 4))


# ───────────────────────── 제한 구역 철문 3상태 ─────────────────────────
def _gate_frame(c):
    W, H = 32, 64
    c.R(0, 0, W, H, K('night', 1))
    for y in range(40, 62, 4): c.HL(4, y, 24, K('night', 2))
    stone_mass(c, 0, 8, 4, 56, 3); stone_mass(c, 28, 8, 4, 56, 4)
    stone_mass(c, 0, 0, W, 10, 7, base=3)                      # 상인방
    c.HL(0, 9, W, K('stone', 1)); c.HL(0, 0, W, K('stone', 5))
    for x in range(4, 28, 8): c.VL(x + 3, 1, 8, K('stone', 1))
    c.R(0, 60, 4, 4, K('stone', 4)); c.R(28, 60, 4, 4, K('stone', 3))
    c.R(4, 62, 24, 2, K('stone', 3)); c.HL(4, 62, 24, K('stone', 4))      # 문턱


def _gate_closed_bars(c):
    rail(c, 4, 14, 24); rail(c, 4, 36, 24); rail(c, 4, 56, 24)
    for x in (6, 11, 16, 21, 25):
        iron_bar(c, x, 12, 46, tip=False)
        c.P(x, 11, K('iron', 4)); c.P(x + 1, 11, K('iron', 3)); c.P(x, 10, K('iron', 4))
    rail(c, 4, 14, 24); rail(c, 4, 36, 24); rail(c, 4, 56, 24)
    for x in (4, 26): c.R(x, 14, 2, 44, K('iron', 2)); c.VL(x, 14, 44, K('iron', 3))   # 문틀 쇠 테
    c.R(4, 14, 24, 2, K('iron', 3)); c.HL(4, 14, 24, K('iron', 4))


@REG.piece('wz-lib-gate-closed', '제한 구역 철문(닫힘)', 2, 4, ['SS', 'SS', 'SS', 'SS'], 'architecture', 'library',
           desc='돌 문틀 안에 굵은 철창 격자가 닫힌 제한 구역 출입문 2×4. 창끝 철창과 가로 쇠띠 셋.',
           rules='서가 사이 통로 입구. 닫힘=통행 불가. 상태 묶음 lib-gate.', tags=['문', '철창', '제한구역'], role='wall', states='lib-gate')
def _gate_closed(c):
    _gate_frame(c); _gate_closed_bars(c)
    c.R(14, 40, 4, 6, K('iron', 2)); c.HL(14, 40, 4, K('iron', 4)); c.VL(14, 40, 6, K('iron', 3))   # 빗장 받침
    c.outline()


@REG.piece('wz-lib-gate-open', '제한 구역 철문(열림)', 2, 4, ['CC', 'CC', 'CC', 'CC'], 'architecture', 'library',
           desc='철창 문짝이 양옆 벽 쪽으로 젖혀져 얇게 보이고 가운데가 트인 상태. 통행 가능.',
           rules='같은 자리의 닫힘과 교체. 열린 칸은 통행. 상태 묶음 lib-gate.', tags=['문', '철창', '제한구역'], role='wall', states='lib-gate')
def _gate_open(c):
    _gate_frame(c)
    # 안쪽: 복도 바닥 선이 보이도록 한 단 밝게
    c.R(8, 12, 16, 48, K('night', 1))
    for y in range(44, 60, 4): c.HL(8, y, 16, K('night', 3))
    # 젖혀진 문짝(양쪽, 폭 6): 굵은 기둥 2 + 가로대 + 쇠 판 띠, 경첩
    for x0 in (4, 22):
        c.R(x0, 11, 6, 50, K('iron', 2))
        c.R(x0, 11, 2, 50, K('iron', 3)); c.VL(x0, 11, 50, K('iron', 4))
        c.R(x0 + 4, 11, 2, 50, K('iron', 1)); c.VL(x0 + 5, 11, 50, K('iron', 0))
        c.VL(x0 + 2, 11, 50, K('iron', 2)); c.VL(x0 + 3, 11, 50, K('night', 0))
        for y in (11, 24, 38, 52):
            c.R(x0, y, 6, 3, K('iron', 3)); c.HL(x0, y, 6, K('iron', 5)); c.HL(x0, y + 2, 6, K('iron', 0))
        c.R(x0, 11, 6, 1, K('iron', 5))
    for y in (16, 46):                                      # 황동 경첩(벽쪽)
        c.R(3, y, 2, 4, K('brass', 3)); c.P(3, y, K('brass', 5)); c.R(27, y, 2, 4, K('brass', 2)); c.P(27, y, K('brass', 4))
    c.outline()



@REG.piece('wz-lib-gate-locked', '제한 구역 철문(잠김)', 2, 4, ['SS', 'SS', 'SS', 'SS'], 'architecture', 'library',
           desc='닫힌 철창 위로 굵은 쇠사슬 X 자를 감고 가운데 황동 맹꽁이자물쇠를 채운 상태. 통행 불가.',
           rules='닫힘과 같은 자리 교체. 잠김=열쇠 이벤트 필요. 상태 묶음 lib-gate.', tags=['문', '철창', '잠금', '제한구역'], role='wall', states='lib-gate')
def _gate_locked(c):
    _gate_frame(c); _gate_closed_bars(c)
    chain_line(c, 5, 18, 26, 44, step=2); chain_line(c, 26, 18, 5, 44, step=2)
    c.R(12, 27, 8, 4, K('iron', 2)); c.HL(12, 27, 8, K('iron', 4))
    padlock(c, 16, 28)
    c.outline()


# ───────────────────────── 철제 울타리 ─────────────────────────
def _fence(c, end=False):
    # 16×32: 윗 가로대 y 8, 아랫 가로대 y 24, 철창 8px 주기
    xs = (3, 11) if not end else (11,)
    for x in xs:
        iron_bar(c, x, 6, 24, tip=False)
        c.P(x, 5, K('iron', 4)); c.P(x + 1, 5, K('iron', 3)); c.P(x, 4, K('iron', 4))     # 창끝
    if not end:
        rail(c, 0, 10, 16); rail(c, 0, 24, 16)
    else:
        rail(c, 0, 10, 12); rail(c, 0, 24, 12)
        # 끝 기둥(왼쪽에 서 있는 굵은 기둥은 오른쪽 끝에 붙는다 → 이 조각은 오른쪽 끝)
        c.R(12, 7, 4, 25, K('iron', 3)); c.VL(12, 7, 25, K('iron', 4)); c.VL(15, 7, 25, K('iron', 1))
        c.R(11, 4, 5, 3, K('iron', 4)); c.HL(11, 4, 5, K('iron', 5)); c.VL(15, 4, 3, K('iron', 2)); c.P(13, 2, K('iron', 4)); c.R(12, 3, 3, 1, K('iron', 3))
        c.R(11, 30, 5, 2, K('stone', 3)); c.HL(11, 30, 5, K('stone', 5))
    c.outline()


@REG.piece('wz-lib-fence', '제한 구역 철제 울타리', 1, 2, ['S', 'S'], 'architecture', 'library',
           desc='창끝 철창과 가로대 둘의 철제 울타리 1×2. 좌우로 이어 깔면 끊김 없이 이어진다.', rules='가로로 반복해 제한 구역을 두른다. 끝은 wz-lib-fence-end.',
           tags=['울타리', '철창', '제한구역'], role='fence', repeat=True)
def _fence_mid(c): _fence(c)


@REG.piece('wz-lib-fence-end', '제한 구역 철제 울타리 끝', 1, 2, ['S', 'S'], 'architecture', 'library',
           desc='울타리의 오른쪽 끝: 굵은 쇠기둥에 둥근 머리쇠.', rules='울타리 오른쪽 끝에 놓는다. 왼쪽 끝은 좌우 반전 사용.',
           tags=['울타리', '철창', '제한구역'], role='fence')
def _fence_end(c): _fence(c, end=True)



# ───────────────────────── 쇠사슬 서가 ─────────────────────────
BOOK_COLORS = [('red', 2), ('violet', 2), ('leaf', 2), ('brass', 3), ('linen', 2), ('water', 2), ('red', 3), ('choc', 2)]


def book(c, x, ybot, w, h, col, tier):
    """책 한 권: 등 w×h, 왼쪽 밝고 오른쪽 어둡고 띠 하나."""
    y = ybot - h
    c.R(x, y, w, h, K(col, tier)); c.VL(x, y, h, K(col, tier + 1)); c.VL(x + w - 1, y, h, K(col, tier - 1))
    c.HL(x, y, w, K(col, tier + 1))
    c.HL(x, y + 2, w, K('brass', 3)) if w >= 3 else None
    c.HL(x, ybot - 2, w, K('brass', 2))
    c.outline_rect(x, y, w, h, K(col, 0)) if False else None
    return y


def _chained_row2(c, x0, x1, ytop, ybot, seed):
    """쇠사슬 칸: 위 판 밑 황동 가로대 + 책마다 2×2 황동 고리, 고리에서 책 앞면을 가로지르는 밝은 쇠사슬(2폭, 밝은 고리·어두운 틈 교대)."""
    rnd = random.Random(seed)
    c.HL(x0, ytop, x1 - x0, K('brass', 2))
    x = x0 + 1
    while x + 4 <= x1:
        col, t = BOOK_COLORS[rnd.randrange(len(BOOK_COLORS))]
        h = rnd.choice((6, 7))
        book(c, x, ybot, 4, h, col, t)
        cx = x + 1
        for yy in range(ytop + 2, ybot):
            if (yy - ytop) % 2 == 0:
                c.P(cx, yy, K('iron', 6)); c.P(cx + 1, yy, K('iron', 5))
            else:
                c.P(cx, yy, K('iron', 1)); c.P(cx + 1, yy, K('iron', 1))
        c.R(cx, ytop, 2, 2, K('brass', 5)); c.P(cx + 1, ytop + 1, K('brass', 3))
        x += 5


def chained_row(c, x0, x1, ytop, ybot, seed, chained=True, pitch=5):
    """칸 안: ytop(위 판 밑)~ybot(아래 판 윗면). 책 폭 3~4, 사슬은 위 판의 쇠고리에서 책 윗면으로."""
    if chained: return _chained_row2(c, x0, x1, ytop, ybot, seed)
    rnd = random.Random(seed)
    x = x0 + 1
    i = 0
    while x + 3 <= x1:
        w = 4 if rnd.random() < 0.4 else 3
        if x + w > x1: break
        col, t = BOOK_COLORS[rnd.randrange(len(BOOK_COLORS))]
        h = rnd.choice((5, 6)) if chained else rnd.choice((8, 9, 10, 11))
        if chained:
            h = min(h, ybot - ytop - 5)
        yt = book(c, x, ybot, w, h, col, t)
        if chained:
            # 사슬: 위 판(ytop) 밑 고리 → 책 윗면. 고리 하나(황동 2픽셀), 사슬 한 줄(어두움·밝음 교대), 책 윗면에 갈고리 점
            cx = x + w // 2
            for yy in range(ytop, yt):
                k = yy - ytop
                if k == 0:
                    c.R(cx - 1, yy, 3, 1, K('brass', 4)); continue
                if k % 2:
                    c.R(cx - 1, yy, 2, 1, K('iron', 5)); c.P(cx + 1, yy, K('iron', 2))
                else:
                    c.P(cx, yy, K('iron', 3)); c.P(cx - 1, yy, K('iron', 1))
            c.R(cx - 1, yt, 3, 1, K('brass', 3))                 # 책 윗면 걸이
        x += w + 1
        i += 1


def shelf(c, W, H, rows, chained, seed, top_h=5, base_h=4):
    """다칸 오크 서가. W,H = 픽셀. rows = 칸 수."""
    # 몸체 판
    c.R(0, 0, W, H, K('wood', 1))
    c.planks(0, 0, W, H, 'wood', 2, horizontal=False, width=4, seed=seed)
    # 안쪽 어둠
    ix0, ix1 = 4, W - 4
    avail = H - top_h - base_h
    ch = avail // rows
    for r in range(rows):
        y0 = top_h + r * ch
        y1 = y0 + ch
        c.R(ix0, y0, ix1 - ix0, ch, K('wood', 0))
        c.R(ix0, y0, ix1 - ix0, 1, K('wood', 1))
        # 아래 판: 윗면 밝고 앞면 어둡다
        c.R(ix0, y1 - 3, ix1 - ix0, 3, K('wood', 3)); c.HL(ix0, y1 - 3, ix1 - ix0, K('wood', 5)); c.HL(ix0, y1 - 1, ix1 - ix0, K('wood', 2))
        chained_row(c, ix0, ix1, y0 + 1, y1 - 3, seed * 31 + r, chained)
        # 칸 사이 중간 기둥(너무 넓을 때)
    # 좌우 기둥: 왼쪽 밝게, 오른쪽 어둡게
    for xx, t in ((0, 4), (1, 3)): c.VL(xx, 3, H - 3, K('wood', t))
    c.VL(2, 3, H - 3, K('wood', 3)); c.VL(3, 3, H - 3, K('wood', 2))
    c.VL(W - 4, 3, H - 3, K('wood', 2)); c.VL(W - 3, 3, H - 3, K('wood', 3)); c.VL(W - 2, 3, H - 3, K('wood', 2)); c.VL(W - 1, 3, H - 3, K('wood', 1))
    # 윗 코니스(윗면 밝게 + 앞 띠)
    c.R(0, 0, W, 2, K('wood', 5)); c.HL(0, 0, W, K('wood', 5)); c.R(0, 2, W, 3, K('wood', 3)); c.HL(0, 4, W, K('wood', 1))
    c.HL(1, 1, W - 2, K('wood', 5))
    # 밑동 받침
    c.R(0, H - base_h, W, base_h, K('wood', 2)); c.HL(0, H - base_h, W, K('wood', 4)); c.HL(0, H - 1, W, K('wood', 0))
    c.outline()


@REG.piece('wz-lib-shelf-chain-2x3', '쇠사슬 서가 2×3', 2, 3, ['CC', 'SS', 'SS'], 'furniture', 'library',
           desc='사람 키를 넘는 오크 서가. 책마다 가는 쇠사슬이 윗 판의 고리에서 내려와 책 위에 걸려 있다. 위 행은 사람 머리 위로 지난다.',
           rules='제한 구역 벽면에 줄지어 놓는다. 위 행 C, 아래 S. 3×3 과 섞는다.', tags=['서가', '쇠사슬', '제한구역'])
def _shelf23c(c): shelf(c, 32, 48, 3, True, 5)


@REG.piece('wz-lib-shelf-chain-3x3', '쇠사슬 서가 3×3', 3, 3, ['CCC', 'SSS', 'SSS'], 'furniture', 'library',
           desc='넓은 쇠사슬 서가. 책마다 개별 쇠사슬이 윗 판 고리에 걸려 있다.', rules='위 행 C, 아래 S. 2×3 과 이어 벽면을 채운다.',
           tags=['서가', '쇠사슬', '제한구역'])
def _shelf33c(c): shelf(c, 48, 48, 3, True, 9)


@REG.piece('wz-lib-shelf-plain-2x3', '일반 서가 2×3', 2, 3, ['CC', 'SS', 'SS'], 'furniture', 'library',
           desc='쇠사슬이 없는 일반 오크 서가. 책이 빽빽하게 꽂혀 있다.', rules='일반 열람 구역에 쓴다. 위 행 C, 아래 S.', tags=['서가', '도서관'])
def _shelf23p(c): shelf(c, 32, 48, 3, False, 14)


# ───────────────────────── 탁상 f 조각 ─────────────────────────
@REG.piece('wz-lib-grimoire-locked', '잠금 마법서', 1, 1, ['f'], 'furniture', 'library',
           desc='탁자 위에 놓인 두꺼운 가죽 마법서. 쇠 띠 둘이 가로질러 감기고 가운데 황동 자물쇠가 걸려 있다.',
           rules='책상 윗면 위에 덧놓는다(f).', tags=['마법서', '잠김', '소품'])
def _grim_locked(c):
    # 윗면 12×7, 앞 두께 3
    c.R(2, 4, 12, 7, K('red', 2)); c.HL(2, 4, 12, K('red', 3)); c.VL(2, 4, 7, K('red', 3)); c.VL(13, 4, 7, K('red', 1))
    c.R(2, 11, 12, 3, K('linen', 2)); c.HL(2, 11, 12, K('linen', 1)); c.HL(3, 12, 10, K('linen', 3)); c.HL(2, 13, 12, K('red', 0))   # 쪽 가장자리+표지 밑면
    c.R(2, 11, 1, 3, K('red', 2)); c.R(13, 11, 1, 3, K('red', 1))
    for x in (4, 10):
        c.R(x, 3, 2, 9, K('iron', 3)); c.VL(x, 3, 9, K('iron', 4)); c.VL(x + 1, 3, 9, K('iron', 1)); c.P(x, 11, K('iron', 1)); c.P(x + 1, 11, K('iron', 0))
    c.R(7, 5, 3, 4, K('brass', 3)); c.HL(7, 5, 3, K('brass', 5)); c.VL(7, 5, 4, K('brass', 4)); c.P(8, 7, K('ink', 0)); c.HL(7, 8, 3, K('brass', 1))
    c.outline()


@REG.piece('wz-lib-grimoire-open', '펼친 위험 마법서', 1, 1, ['f'], 'furniture', 'library',
           desc='펼쳐진 두꺼운 마법서. 양쪽 쪽에 어두운 보랏빛 마법진 문양이 번져 있다.', rules='책상 윗면 위에 덧놓는다(f).', tags=['마법서', '위험', '소품'])
def _grim_open(c):
    c.R(1, 3, 14, 9, K('red', 1)); c.HL(1, 3, 14, K('red', 2)); c.VL(1, 3, 9, K('red', 2))        # 표지 윗면(테두리)
    c.R(1, 12, 14, 2, K('red', 2)); c.HL(1, 13, 14, K('red', 0))                                   # 표지 앞 두께
    c.R(2, 4, 5, 6, K('linen', 4)); c.R(9, 4, 5, 6, K('linen', 3))                                 # 두 쪽
    c.HL(2, 10, 5, K('linen', 2)); c.HL(9, 10, 5, K('linen', 2))                                   # 쪽 더미 앞면
    c.R(7, 4, 2, 7, K('ink', 1)); c.VL(7, 4, 7, K('linen', 0)); c.P(8, 10, K('red', 0))            # 2폭 책등 홈
    c.P(2, 3, K('linen', 5)); c.VL(2, 4, 6, K('linen', 5)); c.P(13, 3, K('linen', 5)); c.VL(13, 4, 6, K('linen', 4))  # 바깥 모서리 말림
    for y in (5, 7, 9): c.HL(3, y, 3, K('linen', 2))                                               # 왼쪽 쪽 글줄
    c.ellipse(11.5, 6.5, 2, 2.5, K('violet', 1), fill=False)                                       # 오른쪽 쪽 마법진
    c.VL(11, 5, 5, K('violet', 0)); c.HL(9, 7, 5, K('violet', 0)); c.P(11, 6, K('violet', 3)); c.P(12, 7, K('violet', 3))
    c.outline()


@REG.piece('wz-lib-keyring', '사서 열쇠 꾸러미', 1, 1, ['f'], 'furniture', 'library',
           desc='작은 쇠고리에 길이가 다른 황동 열쇠 세 개가 매달린 사서의 열쇠 꾸러미.', rules='책상·탁자 위에 덧놓는다(f).', tags=['열쇠', '소품', '사서'])
def _keyring(c):
    # 회색 1px 쇠고리(납작한 타원) — 세 열쇠 머리 구멍을 꿰고 지나간다
    ring = [(x, 1) for x in range(5, 10)] + [(3, 2), (4, 2), (10, 2), (11, 2), (2, 3), (12, 3), (2, 4), (12, 4),
            (3, 5), (4, 5), (10, 5), (11, 5)] + [(x, 6) for x in range(5, 10)]
    for x, y in ring: c.P(x, y, K('iron', 4 if (y <= 2 or x <= 3) and x <= 9 else 3))

    def key(hx, hy, length, side):
        """3×3 머리(가운데 구멍=윤곽색) · 1px 세로 자루 · 끝에서 옆으로 난 이빨 2칸."""
        for dx in range(3):
            for dy in range(3):
                if (dx, dy) == (1, 1): c.P(hx + 1, hy + 1, K('brass', 0)); continue      # 구멍(고리가 지나는 어두운 틈)
                t = 5 if (dx == 0 or dy == 0) and (dx, dy) != (2, 2) else (3 if (dx, dy) == (2, 2) else 4)
                c.P(hx + dx, hy + dy, K('brass', t))
        sx = hx + 1
        c.VL(sx, hy + 3, length, K('brass', 4)); c.P(sx, hy + 3, K('brass', 5))           # 자루(윗부분 반사)
        end = hy + 2 + length
        for ty in (end - 2, end): c.P(sx + side, ty, K('brass', 3))                       # 이빨 2칸
    key(1, 3, 5, -1)           # 왼쪽 열쇠: 고리 왼쪽에 걸림, 짧음, 이빨 왼쪽
    key(11, 3, 6, 1)           # 오른쪽 열쇠: 고리 오른쪽에 걸림, 중간, 이빨 오른쪽
    key(6, 5, 7, 1)            # 가운데 열쇠: 고리 아래에 걸림, 가장 김
    c.outline()
    # 고리 속은 탁자가 비쳐 보이게(속을 어두운 덩어리로 채우지 않는다)
    for x in range(5, 10): c.clear(x, 2)
    for x in range(4, 11): c.clear(x, 3); c.clear(x, 4)
    c.clear(5, 5); c.clear(9, 5)


# ───────────────────────── 독서대·사다리·기록 탁자 ─────────────────────────
@REG.piece('wz-lib-lectern', '검사 열람대', 1, 2, ['S', 'S'], 'furniture', 'library',
           desc='비스듬히 기운 윗판 위에 펼친 책이 놓인 오크 독서대. 가운데 기둥과 십자 발.', rules='제한 구역 입구 앞에서 열람을 검사하는 자리.',
           tags=['독서대', '도서관'])
def _lectern(c):
    # 기운 윗판: 윗면 밝은 띠(뒤가 높음) + 앞 턱
    c.R(1, 3, 14, 9, K('wood', 4)); c.HL(1, 3, 14, K('wood', 5)); c.HL(1, 4, 14, K('wood', 5))
    for y in range(5, 11): c.HL(1, y, 14, K('wood', 4 if y < 8 else 3))
    c.R(1, 11, 14, 3, K('wood', 2)); c.HL(1, 11, 14, K('wood', 3)); c.VL(14, 3, 11, K('wood', 2))
    c.R(1, 3, 1, 11, K('wood', 5))
    # 펼친 책
    c.R(3, 4, 5, 6, K('linen', 4)); c.R(8, 4, 5, 6, K('linen', 3)); c.VL(8, 4, 6, K('linen', 1)); c.HL(3, 4, 10, K('linen', 5))
    for y in (6, 8): c.HL(4, y, 3, K('ink', 2)); c.HL(9, y, 3, K('ink', 2))
    c.HL(3, 10, 10, K('red', 2)); c.HL(3, 11, 10, K('red', 1))
    c.R(1, 12, 14, 1, K('wood', 1))
    # 기둥·발
    c.R(6, 14, 4, 12, K('wood', 3)); c.VL(6, 14, 12, K('wood', 4)); c.VL(9, 14, 12, K('wood', 2)); c.HL(5, 14, 6, K('wood', 2))
    c.R(2, 26, 12, 3, K('wood', 3)); c.HL(2, 26, 12, K('wood', 5)); c.HL(2, 28, 12, K('wood', 1)); c.R(1, 29, 3, 2, K('wood', 2)); c.R(12, 29, 3, 2, K('wood', 1))
    c.outline()


@REG.piece('wz-lib-ladder', '서가 사다리', 1, 3, ['C', 'S', 'S'], 'furniture', 'library',
           desc='서가에 비스듬히 기대 세운 가는 오크 사다리. 위가 좁고 아래가 조금 넓다.', rules='쇠사슬 서가 옆에 기대 놓는다.', tags=['사다리', '도서관'])
def _ladder(c):
    for y in range(2, 46):
        t = (y - 2) / 43
        xl = round(4 - 2 * (1 - t)); xr = round(11 + 2 * t - 0)
        xl = 4 - round(2 * t) + 2; xr = 10 + round(2 * t)
        c.R(xl, y, 2, 1, K('wood', 4)); c.P(xl + 1, y, K('wood', 3))
        c.R(xr, y, 2, 1, K('wood', 3)); c.P(xr + 1, y, K('wood', 2))
    for y in range(6, 46, 6):
        t = (y - 2) / 43
        xl = 4 - round(2 * t) + 2; xr = 10 + round(2 * t)
        c.R(xl + 2, y, xr - xl - 2, 2, K('wood', 4)); c.HL(xl + 2, y, xr - xl - 2, K('wood', 5)); c.HL(xl + 2, y + 1, xr - xl - 2, K('wood', 2))
    c.R(2, 45, 3, 2, K('wood', 1)); c.R(11, 45, 3, 2, K('wood', 0))
    c.outline()


@REG.piece('wz-lib-record-table', '양피지 기록 탁자', 2, 2, ['SS', 'SS'], 'furniture', 'library',
           desc='양피지 두루마리·기록 장부·잉크병·깃펜이 펼쳐진 오크 기록 탁자 2×2.', rules='열람대 곁에 놓는다. 윗면에 소품이 이미 있다.',
           tags=['탁자', '양피지', '도서관'])
def _record_table(c):
    c.box(0, 4, 32, 20, 10, 'wood', 3)
    # 상판 위 소품: 펼친 장부, 두루마리, 잉크병, 깃펜
    c.R(3, 6, 9, 6, K('linen', 4)); c.HL(3, 6, 9, K('linen', 5)); c.VL(7, 6, 6, K('linen', 2)); c.HL(3, 11, 9, K('linen', 2))
    for y in (8, 10): c.HL(4, y, 3, K('ink', 2)); c.HL(8, y, 3, K('ink', 2))
    c.R(15, 7, 11, 3, K('snow', 2)); c.HL(15, 7, 11, K('snow', 3)); c.HL(15, 9, 11, K('linen', 1)); c.R(14, 7, 2, 3, K('linen', 2)); c.R(25, 7, 2, 3, K('linen', 2))
    c.R(17, 11, 8, 2, K('linen', 3)); c.HL(17, 12, 8, K('linen', 1))
    c.R(27, 7, 3, 4, K('night', 1)); c.HL(27, 7, 3, K('night', 3)); c.P(28, 8, K('violet', 3))
    c.line(29, 6, 26, 2, K('snow', 3)); c.P(29, 6, K('night', 1))
    # 다리
    for x in (1, 28):
        c.R(x, 24, 3, 6, K('wood', 2)); c.VL(x, 24, 6, K('wood', 3)); c.HL(x, 29, 3, K('wood', 0))
    c.outline()



# ═════════════════════════ 지팡이 가게 보강 ═════════════════════════
def _testdoor(c, state):
    W, H = 16, 64
    # 문틀(어두운 외곽 + 오렌지 갈색 틀)
    c.R(0, 0, W, H, K('wood', 1))
    c.R(1, 1, W - 2, H - 2, K('wood', 3))
    c.VL(1, 1, H - 2, K('wood', 4)); c.VL(W - 2, 1, H - 2, K('wood', 2))
    c.HL(1, 1, W - 2, K('wood', 5))
    if state == 'open':
        c.R(3, 3, W - 6, H - 5, K('wood', 0)); c.HL(3, 3, W - 6, K('wood', 1)); c.VL(3, 3, H - 5, K('wood', 1))
        c.VL(W - 4, 3, H - 5, K('wood', 0))
        # 안쪽 바닥에 희미한 빛
        for yy in range(9, H - 5, 8): c.HL(4, yy, W - 8, K('wood', 1))
        c.R(4, H - 5, W - 8, 2, K('wood', 2))
        # 젖힌 문짝 모서리가 오른쪽 틀에 얇게 보인다
        c.R(W - 3, 6, 2, H - 10, K('wood', 4)); c.VL(W - 3, 6, H - 10, K('wood', 5)); c.VL(W - 2, 6, H - 10, K('wood', 2))
        c.P(W - 3, 30, K('brass', 4))
    else:
        # 문짝: 틀 안에 판벽 두 칸(위 큼, 아래 큼)
        c.R(3, 3, W - 6, H - 5, K('wood', 4)); c.HL(3, 3, W - 6, K('wood', 5)); c.VL(3, 3, H - 5, K('wood', 5)); c.VL(W - 4, 3, H - 5, K('wood', 2)); c.HL(3, H - 3, W - 6, K('wood', 2))
        for (y0, y1) in ((7, 28), (34, 58)):
            h = y1 - y0
            c.R(5, y0, W - 10, h, K('wood', 3)); c.HL(5, y0, W - 10, K('wood', 2)); c.VL(5, y0, h, K('wood', 2))
            c.HL(5, y1 - 1, W - 10, K('wood', 5)); c.VL(W - 6, y0, h, K('wood', 5))
            c.R(6, y0 + 1, W - 12, h - 2, K('wood', 3))
        c.R(3, 30, W - 6, 2, K('wood', 2)); c.HL(3, 30, W - 6, K('wood', 5))
        # 손잡이
        c.R(W - 6, 32, 2, 3, K('brass', 4)); c.P(W - 6, 32, K('brass', 5))
        if state == 'locked':
            c.R(W - 7, 36, 4, 4, K('brass', 3)); c.HL(W - 7, 36, 4, K('brass', 5)); c.P(W - 6, 38, K('ink', 0)); c.HL(W - 7, 39, 4, K('brass', 1))
            c.P(W - 6, 35, K('iron', 4)); c.P(W - 5, 35, K('iron', 4))
    c.outline()


for _st, _nm, _w in (('closed', '닫힘', 'SS'), ('open', '열림', 'CC'), ('locked', '잠김', 'SS')):
    def _mk(st):
        def fn(c): _testdoor(c, st)
        return fn
    REG.piece('wz-wand-testdoor-' + _st, '시험실 문(%s)' % _nm, 1, 4, [_w[0]] * 4, 'architecture', 'wandshop',
              desc='지팡이 가게 시험실 문. 오렌지빛 판벽 문짝이 틀 안에 앉는다(%s).' % _nm,
              rules='같은 크기·같은 발끝 기준으로 세 상태를 바꿔 끼운다. 열림은 지나갈 수 있다.', role='wall', states='wand-testdoor',
              tags=['문', '시험실', '지팡이가게'])(_mk(_st))


def _scorch(c, seed, kind):
    rnd = random.Random(seed)
    dark, mid = K('ink', 0), K('night', 0)
    if kind == 0:   # 이어진 불규칙 그을음 한 덩이(검은 갈색 4톤) + 가장자리 점 몇 개 + 불씨 한 개(2px)
        for y in range(16):
            for x in range(16):
                d = ((x - 7.5) / 5.2) ** 2 + ((y - 8) / 3.9) ** 2 + rnd.uniform(-0.28, 0.28)
                if d < 1.0:
                    c.P(x, y, K('ink', 0) if d < 0.22 else K('choc', 0) if d < 0.5 else K('night', 0) if d < 0.78 else K('choc', 1))
        for x, y in ((2, 5), (13, 11), (4, 12), (12, 4)):
            if not c.opaque(x, y): c.P(x, y, K('choc', 1))
        c.HL(8, 8, 2, K('fire', 3))
    elif kind == 1:  # 방사형 그을음 줄
        c.ellipse(8, 8, 2, 2, dark)
        for a in range(8):
            import math
            ang = a * math.pi / 4 + rnd.random() * 0.3
            L = rnd.randint(4, 7)
            for t in range(2, L):
                c.P(int(8 + math.cos(ang) * t), int(8 + math.sin(ang) * t * 0.8), mid if t > 3 else dark)
    else:  # 가장자리 두 덩이
        c.ellipse(4, 5, 3, 2, dark); c.ellipse(4, 5, 4, 3, mid, fill=False)
        c.ellipse(11, 11, 3, 3, dark)
        for _ in range(14):
            x = rnd.randint(2, 14); y = rnd.randint(2, 14)
            if not c.opaque(x, y): c.P(x, y, mid)
    # 불씨 몇 점
    for _ in range(0 if kind == 0 else 3):
        x = rnd.randint(3, 12); y = rnd.randint(3, 12)
        if c.opaque(x, y): c.P(x, y, K('fire', 2))


for _i, _n in enumerate(('큰 번짐', '방사 그을음', '두 덩이')):
    def _mks(i):
        def fn(c): _scorch(c, 40 + i * 7, i)
        return fn
    REG.piece('wz-wand-scorch-%d' % (_i + 1), '그을린 시험 바닥 %s' % _n, 1, 1, ['f'], 'surfaces', 'wandshop',
              desc='시험 지팡이가 남긴 검은 그을음 자국. 바닥 위에 덧그리는 투명 조각.', rules='오크 시험 바닥 위에 흩어 놓는다(f).',
              role='terrain', tags=['그을음', '시험바닥'])(_mks(_i))


@REG.piece('wz-wand-floor-oak', '오크 시험 바닥', 1, 1, ['F'], 'surfaces', 'wandshop',
           desc='지팡이 가게 시험 바닥. 어두운 적갈색 오크 판자에 가로 이음 줄.', rules='시험실 바닥에 반복해 깐다.', repeat=True, role='terrain',
           tags=['바닥', '오크', '시험실'])
def _oak_floor(c):
    c.R(0, 0, 16, 16, K('wood', 2))
    for y in (3, 11):
        c.HL(0, y, 16, K('wood', 1))
    c.HL(0, 4, 16, K('wood', 3)) if False else None
    for x in range(0, 16, 2): c.P(x, 7, K('wood', 1)) if x % 6 == 0 else None
    c.VL(10, 4, 7, K('wood', 1))
    for x, y in ((2, 5), (13, 8), (5, 14), (11, 1), (7, 9)):
        c.P(x, y, K('wood', 3))
    c.HL(3, 6, 4, K('wood', 3)); c.HL(8, 13, 5, K('wood', 3))


@REG.piece('wz-wand-box-wall', '지팡이 상자 벽', 2, 4, ['CC', 'SS', 'SS', 'SS'], 'furniture', 'wandshop',
           desc='천장까지 가는 상자가 빽빽이 쌓인 긴 지팡이 상자 벽. 상자마다 흰 이름표가 붙는다.', rules='손님 쪽 가게 안벽에 줄지어 놓는다. 위 행 C.',
           tags=['지팡이상자', '벽'])
def _wand_box_wall(c):
    W, H = 32, 64
    c.R(0, 0, W, H, K('wood', 1))
    c.R(0, 0, W, 3, K('wood', 4)); c.HL(0, 0, W, K('wood', 5)); c.HL(0, 2, W, K('wood', 2))
    rnd = random.Random(77)
    cols = [('stone', 3), ('wood', 3), ('water', 2), ('stone', 4), ('wood', 4), ('stone', 2)]
    y = 4
    r = 0
    while y + 6 <= H - 4:
        c.R(1, y, W - 2, 7, K('wood', 0))
        x = 2
        while x + 6 <= W - 2:
            w = rnd.choice((6, 7))
            if x + w > W - 2: w = W - 2 - x
            m, t = cols[rnd.randrange(len(cols))]
            c.R(x, y + 1, w, 5, K(m, t)); c.HL(x, y + 1, w, K(m, t + 1)); c.HL(x, y + 5, w, K(m, t - 2))
            c.VL(x + w - 1, y + 1, 5, K(m, t - 1))
            c.HL(x + 1, y + 3, w - 2, K('linen', 4)) if w > 3 else None
            x += w + 1
        c.HL(1, y + 7, W - 2, K('wood', 4))
        y += 8
        r += 1
    c.R(0, H - 4, W, 4, K('wood', 2)); c.HL(0, H - 4, W, K('wood', 4)); c.HL(0, H - 1, W, K('wood', 0))
    c.VL(0, 3, H - 3, K('wood', 4)); c.VL(W - 1, 3, H - 3, K('wood', 1))
    c.outline()


def _wand(c, kind):
    """지팡이: 위로 비스듬히 누운 진열(왼쪽 아래 손잡이 → 오른쪽 위 끝). 16×16."""
    # 받침 천 위에 올린 모양
    c.R(1, 9, 14, 5, K('red', 1)); c.HL(1, 9, 14, K('red', 3)); c.HL(1, 13, 14, K('red', 0))
    # 몸통은 가로 막대(윗면에서 보기), 두께 3
    if kind == 0:   # 나선 장미목
        c.R(3, 5, 11, 3, K('wood', 3)); c.HL(3, 5, 11, K('wood', 5)); c.HL(3, 7, 11, K('wood', 1))
        for x in range(4, 13, 3): c.VL(x, 5, 3, K('wood', 2)); c.P(x + 1, 6, K('wood', 5))
        c.R(1, 4, 3, 5, K('wood', 4)); c.P(1, 4, K('wood', 5)); c.VL(2, 4, 5, K('wood', 5)); c.HL(1, 8, 3, K('wood', 2))
    elif kind == 1:  # 황동 둥근 머리
        c.R(5, 5, 9, 3, K('wood', 2)); c.HL(5, 5, 9, K('wood', 4)); c.HL(5, 7, 9, K('wood', 0))
        c.R(1, 4, 4, 5, K('brass', 3)); c.HL(1, 4, 4, K('brass', 5)); c.VL(1, 4, 5, K('brass', 4)); c.HL(1, 8, 4, K('brass', 1))
        c.R(4, 5, 2, 3, K('brass', 4)); c.P(4, 5, K('brass', 5))
    else:           # 뼈색 마디 손잡이
        c.R(5, 5, 9, 3, K('wood', 4)); c.HL(5, 5, 9, K('wood', 5)); c.HL(5, 7, 9, K('wood', 2))
        c.R(1, 4, 5, 5, K('linen', 3)); c.HL(1, 4, 5, K('linen', 5)); c.VL(1, 4, 5, K('linen', 4)); c.HL(1, 8, 5, K('linen', 1))
        c.P(3, 6, K('linen', 1)); c.VL(3, 4, 1, K('linen', 1))
        c.VL(5, 4, 5, K('linen', 2))
    c.P(14, 6, K('wood', 5))
    c.outline()


for _i, _n in enumerate(('나선 장미목 손잡이', '황동 둥근 손잡이', '뼈색 마디 손잡이')):
    def _mkw(i):
        def fn(c): _wand(c, i)
        return fn
    REG.piece('wz-wand-display-%d' % (_i + 1), '지팡이 진열 %s' % _n, 1, 1, ['f'], 'furniture', 'wandshop',
              desc='붉은 천 위에 누운 지팡이 하나. 손잡이 모양이 제각각이다(%s).' % _n, rules='카운터·진열대 윗면에 덧놓는다(f).',
              tags=['지팡이', '진열', '지팡이가게'])(_mkw(_i))


@REG.piece('wz-wand-tape', '황동 줄자', 1, 1, ['f'], 'furniture', 'wandshop',
           desc='둥글게 감긴 황동 줄자. 풀린 줄이 눈금을 보인다.', rules='카운터 윗면에 덧놓는다(f).', tags=['줄자', '지팡이가게'])
def _tape(c):
    c.ellipse(6, 8, 5, 4, K('brass', 3)); c.ellipse(6, 8, 5, 4, K('brass', 1), fill=False)
    c.ellipse(6, 7, 4, 3, K('brass', 4)); c.ellipse(6, 7, 2, 1, K('brass', 2))
    c.HL(4, 5, 3, K('brass', 5))
    # 풀린 줄자: 오른쪽으로, 눈금
    c.R(10, 9, 5, 2, K('linen', 4)); c.HL(10, 9, 5, K('linen', 5)); c.HL(10, 10, 5, K('linen', 2))
    for x in (11, 13): c.P(x, 10, K('ink', 1))
    c.P(14, 11, K('brass', 4))
    c.outline()



# ───────────────────────── 예제 ─────────────────────────
def _ex_restricted():
    place = []
    for x in range(0, 14): place.append(('wz-castle-wall-n', x, 0))
    place.append(('wz-castle-wall-n-pillar', 4, 0)); place.append(('wz-castle-wall-n-pillar', 9, 0))
    for y in range(4, 8):
        place.append(('wz-castle-wall-w', 0, y)); place.append(('wz-castle-wall-e', 13, y))
    for x in range(0, 14): place.append(('wz-castle-wall-s', x, 8))
    # 서가 줄(벽 앞), 사다리
    place += [('wz-lib-shelf-chain-3x3', 1, 1), ('wz-lib-ladder', 4, 1), ('wz-lib-shelf-chain-2x3', 5, 1),
              ('wz-lib-shelf-plain-2x3', 7, 1), ('wz-lib-shelf-chain-3x3', 10, 1)]
    # 제한 구역 가림: 철제 울타리 + 잠긴 철문
    for x in range(1, 6): place.append(('wz-lib-fence', x, 6))
    place.append(('wz-lib-gate-locked', 6, 4))
    for x in range(8, 12): place.append(('wz-lib-fence', x, 6))
    place.append(('wz-lib-fence-end', 12, 6))
    # 열람 도구
    place += [('wz-lib-lectern', 3, 4), ('wz-lib-record-table', 9, 4),
              ('wz-lib-grimoire-open', 9, 4), ('wz-lib-keyring', 10, 5), ('wz-lib-grimoire-locked', 2, 5)]
    return place


REG.example('wz-lib-example-restricted', '도서관 제한 구역', 'library', 14, 10, 'wz-lib-floor-worn-a', _ex_restricted(),
            desc='어두운 마모 포석 위에 쇠사슬 서가가 늘어서고 철제 울타리와 잠긴 철문이 구역을 가른다.')


def _ex_shop():
    place = []
    for x in range(0, 10): place.append(('wz-castle-wall-n', x, 0))
    place += [('wz-wand-box-wall', 0, 0), ('wz-wand-box-wall', 2, 0), ('wz-wand-box-wall', 7, 0), ('wz-wand-box-wall', 8, 0)]
    place.append(('wz-wand-testdoor-open', 4, 0))
    for y in range(4, 7):
        place.append(('wz-castle-wall-w', 0, y)); place.append(('wz-castle-wall-e', 9, y))
    for x in range(0, 10): place.append(('wz-castle-wall-s', x, 7))
    place += [('wz-wand-scorch-1', 3, 4), ('wz-wand-scorch-2', 6, 5), ('wz-wand-scorch-3', 4, 6)]
    place += [('wz-wand-display-1', 1, 4), ('wz-wand-display-2', 2, 4), ('wz-wand-display-3', 7, 4), ('wz-wand-tape', 8, 5)]
    return place


REG.example('wz-wand-example-shop', '지팡이 가게 시험실', 'wandshop', 10, 9, 'wz-wand-floor-oak', _ex_shop(),
            desc='오크 시험 바닥에 그을음이 번진 시험실, 천장까지 쌓인 지팡이 상자 벽과 시험실 문.')


if __name__ == '__main__':
    sys.exit(1 if run_module(MODULE) else 0)
