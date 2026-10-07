"""기숙사 침실(dorm) — 호수 밑 초록·은 기숙사의 4주 침대·트렁크·협탁·옷장·거울·깔개·벽등. id 접두 wz-dorm-.
  python3 scripts/content/wizarding/pieces/dorm.py   → 검사 + tiledata/wizarding/review/dorm.png

규약: 16px 칸, 사람 24×32, 침대 2×3 = 32×48(wz-inf-bed-empty 와 같은 발자국). 빛은 왼쪽 위, 윗면 가장 밝고 앞면 한 단 어둡고
오른쪽 가장자리 가장 어둡다. 정면 고정·좌우 대칭. 윤곽 1px 은 `Cv.outline()`(재질 최암단), 42색 팔레트만.
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from wzlib import REG, Cv, K, OL, OL2, CLEAR, run_module   # noqa: E402

MODULE = 'dorm'
SP = 'shared'
FAM = 'furniture'


def W(i):
    return K('wood', i)


def B(i):
    return K('brass', i)


def I(i):
    return K('iron', i)


def S(i):
    return K('snow', i)


def hsh(x, y, s=0):
    return (((x * 73856093) ^ (y * 19349663) ^ (s * 83492791)) & 0xffff) / 65536.0


# ───────────────────────── 4주 침대 ─────────────────────────
GREEN = (K('leaf', 1), K('leaf', 2), K('leaf', 3), K('leaf', 4))
RED = (K('red', 1), K('red', 2), K('red', 3), K('red', 3))
SILVER = (I(4), I(3))
GOLD = (B(4), B(3))


def _post(c, x, y, h, left_lit):
    c.R(x, y, 3, h, W(3))
    if left_lit:
        c.VL(x, y, h, W(5)); c.VL(x + 1, y, h, W(4)); c.VL(x + 2, y, h, W(2))
    else:
        c.VL(x, y, h, W(4)); c.VL(x + 1, y, h, W(3)); c.VL(x + 2, y, h, W(2))


def _drape(c, x0, g, mirror):
    """옆 커튼: 4px 폭 주름(3·2·2·1 단), 가운데 묶음에서 잘록, 아래 물결 단."""
    g1, g2, g3, _ = g
    cyc = [g3, g2, g2, g1]
    for i in range(4):
        x = x0 + i
        col = cyc[(3 - i) if mirror else i]
        bot = 38 if i in (1, 2) else 37
        for y in range(8, bot + 1):
            if 21 <= y <= 22 and i == (0 if mirror else 3):
                continue   # 묶음: 안쪽 한 줄 비움
            c.P(x, y, col)
        c.P(x, bot, g1)
        c.P(x, 8, g1)
    # 묶음 끈
    ix = x0 + (1 if mirror else 0)
    c.R(ix, 21, 3, 2, SILVER[0] if g is GREEN else GOLD[0])
    c.HL(ix, 22, 3, SILVER[1] if g is GREEN else GOLD[1])


def _bed(c, g, trim, closed):
    g1, g2, g3, g4 = g
    t1, t2 = trim
    # 머리판 + 뒷기둥
    c.R(4, 9, 24, 6, W(3)); c.HL(4, 9, 24, W(4)); c.HL(4, 14, 24, W(2))
    c.R(8, 11, 16, 3, W(2)); c.HL(8, 11, 16, W(1))
    _post(c, 1, 1, 14, True); _post(c, 28, 1, 14, False)
    # 옆 틀 + 매트리스
    c.R(4, 15, 24, 26, W(3)); c.VL(4, 15, 26, W(4)); c.VL(27, 15, 26, W(2))
    c.R(8, 15, 16, 26, S(2))
    if not closed:
        # 베개(북쪽)
        c.R(10, 16, 12, 6, S(3)); c.HL(10, 22, 12, S(1)); c.VL(21, 16, 6, S(2)); c.VL(10, 17, 5, S(2))
        c.HL(12, 19, 8, S(2))
        # 접어 넘긴 시트 + 담요
        c.R(8, 25, 16, 3, S(3)); c.HL(8, 27, 16, S(1))
        c.R(8, 28, 16, 13, g2); c.HL(8, 28, 16, g3)
        c.VL(8, 28, 13, g3); c.VL(23, 28, 13, g1); c.HL(8, 40, 16, g1)
        c.HL(9, 33, 14, t1); c.HL(9, 34, 14, t2)           # 가로 띠
        for (x, y, n) in ((11, 30, 3), (17, 31, 4), (13, 37, 4), (19, 38, 3)):
            c.HL(x, y, n, g3)
        for (x, y, n) in ((10, 36, 3), (18, 36, 3), (15, 30, 2)):
            c.HL(x, y, n, g1)
    # 발판 + 앞기둥
    c.R(4, 41, 24, 4, W(3)); c.HL(4, 41, 24, W(5)); c.HL(4, 42, 24, W(4)); c.HL(4, 44, 24, W(2))
    for px, lit in ((1, True), (28, False)):
        _post(c, px, 33, 14, lit)
        c.R(px, 31, 3, 2, B(4)); c.HL(px, 32, 3, B(3))
        c.HL(px, 46, 3, W(1))
    # 커튼
    if closed:
        cyc = [g3, g2, g2, g1]
        for x in range(4, 28):
            col = cyc[(x - 4) % 4]
            bot = 40 if (x - 4) % 4 in (1, 2) else 39
            for y in range(10, bot + 1):
                c.P(x, y, col)
            c.P(x, bot, g1)
            if bot == 39:
                c.P(x, 40, W(2))   # 물결 사이로 매트리스가 비치지 않게 틀 그림자
        c.HL(4, 10, 24, g1); c.HL(4, 11, 24, g2)
        c.VL(15, 12, 27, K('leaf', 0)); c.VL(16, 12, 28, g3)
        for (x, y) in ((6, 20), (10, 26), (21, 22), (25, 30), (8, 33), (19, 34)):
            c.P(x, y, g3)
        for (x, y) in ((7, 18), (22, 27), (12, 31), (24, 24)):
            c.P(x, y, g1)
    else:
        _drape(c, 4, g, False); _drape(c, 24, g, True)
    # 덮개 보 + 술 달린 밸런스
    c.R(1, 1, 30, 3, W(4)); c.HL(1, 1, 30, W(5)); c.HL(1, 3, 30, W(2))
    prof = [7, 8, 9, 9, 8, 7]
    for x in range(4, 28):
        bt = prof[(x - 4) % 6]
        for y in range(4, bt + 1):
            c.P(x, y, g2)
        c.P(x, 4, t1); c.P(x, 5, g3); c.P(x, bt, t2)
        if (x - 4) % 6 in (0, 5):
            c.P(x, 6, g1)
    c.outline()


@REG.piece('wz-dorm-bed-green', '기숙사 4주 침대(초록·열림)', 2, 3, ['SS', 'SS', 'SS'], FAM, SP,
           desc='어두운 오크 4주 침대. 초록 벨벳 밸런스와 열어 모은 초록 커튼, 북쪽 흰 베개, 은 띠 두른 초록 담요. wz-inf-bed-empty 와 같은 2×3 발자국.',
           rules='머리판이 북쪽(벽 쪽). 닫힘 짝은 wz-dorm-bed-green-closed(같은 크기·같은 자리).',
           tags=['기숙사', '침대', '4주', '초록', '슬리데린풍'], role='prop', states='dorm-bed-green')
def _bed_green(c):
    _bed(c, GREEN, SILVER, False)


@REG.piece('wz-dorm-bed-green-closed', '기숙사 4주 침대(초록·닫힘)', 2, 3, ['SS', 'SS', 'SS'], FAM, SP,
           desc='열린 침대와 같은 틀. 초록 커튼을 사방으로 쳐서 앞면에 2단 주름과 가운데 틈 선이 보인다. 안이 보이지 않는다.',
           rules='열림 짝과 같은 크기·자리의 상태 그림(커튼 닫힘). 잠든 학생이 있는 침대에 쓴다.',
           tags=['기숙사', '침대', '4주', '커튼', '닫힘'], role='prop', states='dorm-bed-green')
def _bed_green_closed(c):
    _bed(c, GREEN, SILVER, True)


@REG.piece('wz-dorm-bed-red', '기숙사 4주 침대(붉은)', 2, 3, ['SS', 'SS', 'SS'], FAM, SP,
           desc='초록 침대와 같은 틀을 붉은 벨벳 밸런스·커튼과 금 띠 담요로 바꾼 4주 침대(커튼 열림).',
           rules='머리판이 북쪽. 붉은 기숙사 방에 쓴다.',
           tags=['기숙사', '침대', '4주', '붉은', '그리핀도르풍'], role='prop')
def _bed_red(c):
    _bed(c, RED, GOLD, False)


# ───────────────────────── 트렁크 · 협탁 · 옷장 ─────────────────────────
@REG.piece('wz-dorm-trunk', '기숙사 학용품 트렁크', 2, 1, ['SS'], FAM, SP,
           desc='가죽 빛 짙은 나무 트렁크. 황동 모서리 쇠와 가운데 걸쇠, 뚜껑 윗면이 보인다.',
           rules='침대 발치(남쪽)에 붙여 놓는다. 윗면 위에 작은 소품을 올릴 수 있다.',
           tags=['트렁크', '상자', '황동', '기숙사'], role='prop')
def _trunk(c):
    c.R(1, 1, 30, 5, W(4)); c.HL(1, 1, 30, W(5)); c.VL(1, 1, 5, W(5))
    for (x, n) in ((8, 6), (17, 5)):
        c.HL(x, 3, n, W(3))
    c.R(1, 6, 30, 4, W(3)); c.HL(1, 9, 30, W(1))
    c.R(1, 10, 30, 5, W(2)); c.HL(1, 14, 30, W(1))
    c.VL(30, 1, 14, W(1))
    for sx, lit in ((5, True), (25, False)):
        c.R(sx, 1, 2, 14, B(3)); c.VL(sx, 1, 14, B(4) if lit else B(3)); c.VL(sx + 1, 1, 14, B(2))
        c.HL(sx, 1, 2, B(5))
    c.R(1, 10, 3, 5, B(3)); c.HL(1, 10, 3, B(4)); c.VL(1, 10, 5, B(4))
    c.R(28, 10, 3, 5, B(2)); c.HL(28, 10, 3, B(3))
    c.R(14, 7, 4, 5, B(3)); c.HL(14, 7, 4, B(5)); c.VL(14, 7, 5, B(4)); c.VL(17, 8, 4, B(2))
    c.P(15, 9, B(0)); c.P(15, 10, B(0)); c.P(16, 9, B(0))
    c.outline()


@REG.piece('wz-dorm-nightstand', '기숙사 협탁', 1, 1, ['S'], FAM, SP,
           desc='침대 곁 오크 협탁. 윗면 아래 서랍 하나와 황동 손잡이.',
           rules='침대 사이(머리 쪽)에 둔다. 윗면에 촛대·책 같은 소품을 올린다.',
           tags=['협탁', '서랍', '오크', '기숙사'], role='prop')
def _nightstand(c):
    c.R(1, 1, 14, 5, W(4)); c.HL(1, 1, 14, W(5)); c.VL(1, 1, 5, W(5))
    c.HL(3, 3, 6, W(3)); c.HL(8, 4, 5, W(3))
    c.R(1, 6, 14, 7, W(3)); c.HL(1, 6, 14, W(2))
    c.R(3, 8, 10, 4, W(3)); c.HL(3, 8, 10, W(2)); c.VL(3, 8, 4, W(2)); c.HL(3, 11, 10, W(4)); c.VL(12, 8, 4, W(4))
    c.R(7, 9, 2, 2, B(4)); c.P(8, 10, B(2))
    c.R(1, 13, 2, 2, W(1)); c.R(13, 13, 2, 2, W(1))
    c.VL(14, 1, 12, W(1))
    c.outline()


@REG.piece('wz-dorm-wardrobe', '기숙사 옷장', 2, 3, ['CC', 'SS', 'SS'], FAM, SP,
           desc='키 큰 오크 옷장. 조각 장식 관, 판자를 끼운 두 짝 문과 황동 손잡이, 아래 받침.',
           rules='위 한 줄(관·윗면)은 사람 위로 덮인다. 벽 쪽(북쪽·옆)에 붙인다.',
           tags=['옷장', '오크', '황동', '기숙사'], role='prop')
def _wardrobe(c):
    # 윗면 + 관(조각 띠)
    c.R(3, 1, 26, 8, W(4)); c.HL(3, 1, 26, W(5)); c.VL(3, 1, 8, W(5))
    for (x, y, n) in ((7, 3, 8), (18, 5, 7), (9, 7, 6), (21, 3, 4)):
        c.HL(x, y, n, W(3))
    c.VL(28, 1, 8, W(3))
    c.R(1, 9, 30, 4, W(4)); c.HL(1, 9, 30, W(5)); c.HL(1, 12, 30, W(2))
    for x in range(3, 29, 3):
        c.R(x, 10, 2, 2, W(2))
    c.R(13, 9, 6, 4, W(5)); c.HL(13, 12, 6, W(3)); c.R(14, 10, 4, 2, W(3)); c.P(15, 10, W(5)); c.P(16, 11, W(5))
    # 몸체
    c.R(2, 13, 28, 31, W(3)); c.VL(2, 13, 31, W(4)); c.VL(3, 13, 31, W(4)); c.VL(29, 13, 31, W(2)); c.VL(28, 13, 31, W(2))
    c.HL(2, 13, 28, W(2))
    for dx in (5, 17):
        c.R(dx, 14, 10, 29, W(3))
        c.R(dx + 1, 16, 8, 13, W(3)); c.HL(dx + 1, 16, 8, W(2)); c.VL(dx + 1, 16, 13, W(2)); c.HL(dx + 1, 28, 8, W(4)); c.VL(dx + 8, 16, 13, W(4))
        c.R(dx + 1, 32, 8, 10, W(3)); c.HL(dx + 1, 32, 8, W(2)); c.VL(dx + 1, 32, 10, W(2)); c.HL(dx + 1, 41, 8, W(4)); c.VL(dx + 8, 32, 10, W(4))
        c.HL(dx, 14, 10, W(4))
    c.VL(15, 14, 29, W(1)); c.VL(16, 14, 29, W(2))
    for hx in (12, 18):
        c.R(hx, 25, 2, 6, B(3)); c.VL(hx, 25, 6, B(4)); c.P(hx, 25, B(5)); c.VL(hx + 1, 26, 5, B(2))
    # 받침
    c.R(1, 44, 30, 3, W(2)); c.HL(1, 44, 30, W(4)); c.R(1, 46, 3, 1, W(1)); c.R(28, 46, 3, 1, W(1))
    c.outline()


# ───────────────────────── 거울 ─────────────────────────
@REG.piece('wz-dorm-mirror', '기숙사 서는 거울', 1, 2, ['C', 'S'], FAM, SP,
           desc='오크 타원 틀에 연푸른 회색 유리, 짧은 사선 반사광, 가운데 기둥과 두 발이 있는 세워 두는 거울.',
           rules='위 한 칸(타원 윗부분)은 사람 위로 덮인다. 옷장 곁 벽 쪽에 둔다.',
           tags=['거울', '오크', '유리', '기숙사'], role='prop')
def _mirror(c):
    cx, cy = 8.0, 11.5
    for y in range(0, 24):
        for x in range(0, 16):
            d = ((x + 0.5 - cx) / 7.0) ** 2 + ((y + 0.5 - cy) / 10.5) ** 2
            if d > 1.0:
                continue
            g = ((x + 0.5 - cx) / 4.5) ** 2 + ((y + 0.5 - cy) / 8.5) ** 2
            nx, ny = (x + 0.5 - cx) / 7.0, (y + 0.5 - cy) / 10.5
            if g <= 1.0:
                continue
            lit = -(nx + ny) / 1.4
            t = 5 if lit > 0.5 else 4 if lit > 0.15 else 3 if lit > -0.3 else 2 if lit > -0.7 else 1
            c.P(x, y, W(t))
    for y in range(0, 24):
        for x in range(0, 16):
            g = ((x + 0.5 - cx) / 4.5) ** 2 + ((y + 0.5 - cy) / 8.5) ** 2
            if g > 1.0:
                continue
            nx, ny = (x + 0.5 - cx) / 4.5, (y + 0.5 - cy) / 8.5
            col = K('water', 3) if (nx + ny) > 0.35 else K('water', 4)
            if nx * nx + ny * ny > 0.7 and (nx + ny) < -0.3:
                col = K('water', 3)   # 틀 안쪽 그림자(왼쪽 위)
            c.P(x, y, col)
    for (x, y) in ((5, 9), (6, 8), (7, 7), (8, 6)):      # 긴 사선 반사
        c.P(x, y, K('water', 5))
    for (x, y) in ((5, 12), (6, 11), (7, 10)):
        c.P(x, y, K('water', 5))
    for (x, y) in ((9, 15), (10, 14)):
        c.P(x, y, K('water', 5))
    # 기둥·버팀대·밑판
    c.R(7, 22, 2, 5, W(3)); c.VL(7, 22, 5, W(4)); c.VL(8, 22, 5, W(2))
    for (x, y) in ((6, 23), (5, 24), (4, 25), (3, 26)):
        c.P(x, y, W(3))
    for (x, y) in ((9, 23), (10, 24), (11, 25), (12, 26)):
        c.P(x, y, W(2))
    c.R(1, 27, 14, 2, W(4)); c.HL(1, 27, 14, W(5)); c.R(1, 29, 14, 2, W(3)); c.HL(1, 30, 14, W(2)); c.VL(14, 27, 4, W(2))
    c.outline()


# ───────────────────────── 깔개 · 벽등 ─────────────────────────
FR_LIT, FR_SH = K('linen', 2), K('linen', 1)


@REG.piece('wz-dorm-rug-green', '기숙사 초록 깔개', 3, 2, ['fff', 'fff'], 'surfaces', SP,
           desc='짙은 초록 바탕에 은빛 테와 가운데 마름모 무늬, 서·동 짧은 변에 술. 침대 사이 바닥에 까는 납작한 깔개.',
           rules='바닥 위에 덧그린다. 통행, 사람 밑. 글자·문장 없음.',
           tags=['깔개', '융단', '천', '초록', '기숙사'], role='prop')
def _rug_green(c):
    x0, x1, y0, y1 = 4, 43, 2, 29
    field, field_d, field_l = K('leaf', 2), K('leaf', 1), K('leaf', 3)
    trim_lit, trim, trim_sh = S(2), I(4), I(3)
    edge = K('leaf', 0)
    c.R(x0, y0, x1 - x0 + 1, y1 - y0 + 1, field)
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            dx0, dx1, dy0, dy1 = x - x0, x1 - x, y - y0, y1 - y
            d = min(dx0, dx1, dy0, dy1)
            lit = (dy0 == d or dx0 == d) and not (dy1 == d or dx1 == d)
            if d == 0: col = edge
            elif d == 1: col = trim_lit if lit else trim_sh
            elif d == 2: col = trim
            elif d == 3: col = field_d
            else: continue
            c.P(x, y, col)
    for x in range(x0 + 6, x1 - 5):
        c.P(x, y0 + 6, field_l); c.P(x, y1 - 6, field_d)
    for y in range(y0 + 6, y1 - 5):
        c.P(x0 + 6, y, field_l); c.P(x1 - 6, y, field_d)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    for y in range(y0 + 7, y1 - 6):
        for x in range(x0 + 7, x1 - 6):
            r = abs(x - cx) / 2.0 + abs(y - cy)
            if r <= 2.5: c.P(x, y, trim)
            elif r <= 3.5: c.P(x, y, field_d)
            elif r <= 6.0: c.P(x, y, field_l if (x < cx) == (y < cy) or abs(y - cy) < 1 else field)
            elif r <= 7.0: c.P(x, y, field_d)
    c.P(int(cx), int(cy), trim_lit); c.P(int(cx) + 1, int(cy), trim_lit)
    for (x, y) in ((x0 + 9, y0 + 9), (x1 - 9, y0 + 9), (x0 + 9, y1 - 9), (x1 - 9, y1 - 9)):
        c.P(x, y, trim); c.P(x + 1, y, trim)
    for y in range(y0 + 1, y1):
        if y % 2 == 1:
            c.HL(x0 - 2, y, 2, FR_LIT); c.HL(x1 + 1, y, 2, FR_SH)


@REG.piece('wz-dorm-lamp-green', '기숙사 초록 벽등', 1, 1, ['C'], 'effects', SP,
           desc='북쪽 벽 정면에 거는 철 받침 등. 초록 유리 등롱이 정적으로 초록빛을 낸다(불꽃 움직임 없음).',
           rules='북벽 정면 석재 위에 겹쳐 놓는다. 호수 밑 방의 분위기용.',
           tags=['벽등', '초록', '등롱', '기숙사'], role='prop')
def _lamp_green(c):
    c.R(5, 1, 6, 2, I(2)); c.HL(5, 1, 6, I(4)); c.HL(5, 2, 6, I(1))
    c.R(7, 3, 2, 2, I(3)); c.P(7, 3, I(4))
    c.R(4, 5, 8, 2, I(2)); c.HL(4, 5, 8, I(3)); c.HL(4, 6, 8, I(1))
    c.R(5, 7, 6, 6, K('glow', 1)); c.R(6, 8, 4, 4, K('glow', 2)); c.R(7, 9, 2, 2, K('glow', 3))
    c.P(7, 9, K('glow', 4))
    c.VL(4, 7, 6, I(3)); c.VL(11, 7, 6, I(1))
    c.R(4, 13, 8, 1, I(2)); c.P(7, 14, I(2)); c.P(8, 14, I(1))
    c.outline()


# ───────────────────────── 예시 맵 ─────────────────────────
def _dorm_map():
    W_, H_ = 16, 12
    pl = []
    nx = {2: 'wall-n-window', 5: 'wall-n-pillar', 8: 'wall-n-window', 10: 'wall-n-pillar', 13: 'wall-n-window'}
    pl.append(('wz-castle-wall-nw', 0, 0)); pl.append(('wz-castle-wall-ne', W_ - 1, 0))
    for x in range(1, W_ - 1):
        pl.append(('wz-castle-' + nx.get(x, 'wall-n'), x, 0))
    for y in range(4, H_ - 2):
        pl.append(('wz-castle-wall-w', 0, y)); pl.append(('wz-castle-wall-e', W_ - 1, y))
    pl.append(('wz-castle-wall-sw', 0, H_ - 2)); pl.append(('wz-castle-wall-se', W_ - 1, H_ - 2))
    for x in range(1, W_ - 1):
        pl.append(('wz-castle-wall-s', x, H_ - 2))
    pl.append(('wz-dorm-rug-green', 6, 8))
    for x in (3, 6, 9, 12):
        pl.append(('wz-dorm-lamp-green', x, 2))
    for x in (3, 6, 9, 12):
        pl.append(('wz-dorm-nightstand', x, 4))
    pl.append(('wz-dorm-bed-green', 1, 4)); pl.append(('wz-dorm-bed-green-closed', 4, 4))
    pl.append(('wz-dorm-bed-green', 7, 4)); pl.append(('wz-dorm-bed-red', 10, 4))
    for x in (1, 4, 7, 10):
        pl.append(('wz-dorm-trunk', x, 7))
    pl.append(('wz-dorm-wardrobe', 13, 4))
    pl.append(('wz-dorm-mirror', 14, 8))
    return pl


REG.example('wz-dorm-example', '기숙사 침실', SP, 16, 12, 'wz-castle-floor-flag', _dorm_map(),
            desc='호수 밑 기숙사 침실: 북벽을 따라 4주 침대 넷(초록 열림·닫힘·열림, 붉은 하나)과 협탁·발치 트렁크, 동쪽 옷장·서는 거울, 가운데 초록 깔개, 벽등. 남쪽 두 줄이 통로.')


if __name__ == '__main__':
    sys.exit(1 if run_module(MODULE) else 0)
