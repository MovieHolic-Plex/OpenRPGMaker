"""허니듀크 지하 창고(honeydukes) — 거친 지하 석벽·오크 보·계단·비밀 패널·설탕 판재 바닥·과자 포장 기물.
  python3 scripts/content/wizarding/pieces/honeydukes.py   → 검사 + tiledata/wizarding/review/honeydukes.png
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from wzlib import REG, Cv, K, OL, OL2, darker, run_module   # noqa: E402

MODULE = 'honeydukes'
SP = 'honeydukes'
ST = 'stone'


def hsh(x, y, s=0):
    return (((x * 73856093) ^ (y * 19349663) ^ (s * 83492791)) & 0xffff) / 65536.0


# ───────────────────────── 지하 석벽 공통 ─────────────────────────
# 줄 높이와 줄마다 16px 주기 블록 경계(가로로 이음새 없이 이어진다)
COURSES = (7, 6, 8, 6, 7, 6, 8, 6)
CUTS = ((0, 9), (4, 12), (0, 6), (3, 10), (0, 11), (5,), (2, 9), (0, 7))
BEAM_Y, BEAM_H = 8, 10


def blocks16(c, y0, y1, base=3, seed=0):
    y = y0
    ri = 0
    while y < y1:
        rh = COURSES[ri % len(COURSES)]
        rh = min(rh, y1 - y)
        cut = sorted(CUTS[ri % len(CUTS)])
        for x in range(c.w):
            lx = x % 16
            starts = [k for k in cut if k <= lx]
            start = starts[-1] if starts else cut[-1] - 16
            bid = (ri * 7 + start + seed) % 13
            tone = base + (1 if hsh(bid, ri, 3 + seed) < 0.22 else (-1 if hsh(bid, ri, 5 + seed) < 0.3 else 0))
            nxt = (lx + 1) % 16
            for yy in range(y, y + rh):
                col = K(ST, tone)
                if yy == y: col = K(ST, tone + 1)
                elif yy == y + rh - 1: col = K(ST, 1)
                elif lx == start % 16: col = K(ST, tone + 1)
                elif nxt in cut: col = K(ST, tone - 1)
                c.P(x, yy, col)
            # 드문 마모점·긁힘
            if hsh(x, ri, 9 + seed) < 0.03 and rh > 5:
                c.P(x, y + 2 + int(hsh(x, ri, 5) * (rh - 4)), K(ST, tone - 1))
        y += rh
        ri += 1


def plinth(c, y0=58, h=6):
    c.R(0, y0, c.w, h, K(ST, 2))
    c.HL(0, y0, c.w, K(ST, 3))
    for x in range(c.w):
        if x % 16 in (6, 13): c.VL(x, y0 + 1, h - 2, K(ST, 1))
    c.HL(0, y0 + h - 2, c.w, K(ST, 1)); c.HL(0, y0 + h - 1, c.w, K(ST, 0))


def beam_h(c, y=BEAM_Y, h=BEAM_H, x0=0, w=None):
    """가로 오크 보 정면(위 밝고 아래 어둡다) — 16 주기로 이어지는 결."""
    w = w if w is not None else c.w
    c.R(x0, y, w, h, K('wood', 3))
    c.HL(x0, y, w, K('wood', 5)); c.HL(x0, y + 1, w, K('wood', 4))
    c.HL(x0, y + h - 2, w, K('wood', 2)); c.HL(x0, y + h - 1, w, K('wood', 1))
    for i in range(w):
        gx = (x0 + i) % 16
        for j in range(2, h - 2):
            v = hsh(gx, j, 4)
            if v < 0.12 and (gx + j) % 3: c.P(x0 + i, y + j, K('wood', 4))
            elif v < 0.30 and j % 2 == 0: c.P(x0 + i, y + j, K('wood', 2))
    # 보 아래 벽에 드리운 그림자
    for i in range(w):
        for j in (0, 1):
            cc = c.get(x0 + i, y + h + j)
            if cc[3]: c.P(x0 + i, y + h + j, darker(cc, 1 + j))


def ceiling_shade(c, rows=4):
    for j in range(rows):
        for x in range(c.w):
            cc = c.get(x, j)
            if cc[3]: c.P(x, j, darker(cc, 2 if j < rows // 2 else 1))


def wall_shelf(c, y=34):
    """벽에 박은 오크 선반 널(16 주기): 윗면 2px 밝게, 앞면 2px, 아래 돌에 그림자, 칸마다 까치발 둘."""
    c.HL(0, y, c.w, K('wood', 5)); c.HL(0, y + 1, c.w, K('wood', 4))
    c.HL(0, y + 2, c.w, K('wood', 3)); c.HL(0, y + 3, c.w, K('wood', 1))
    for x in range(c.w):
        cc = c.get(x, y + 4)
        if cc[3]: c.P(x, y + 4, darker(cc, 1))
    for x in range(c.w):
        if x % 16 in (3, 12):
            c.VL(x, y + 4, 3, K('wood', 2)); c.VL(x + 1, y + 4, 2, K('wood', 1))


def wall_base(c, with_beam=True, shelf=False):
    blocks16(c, 0, 58)
    ceiling_shade(c, 4)
    if with_beam: beam_h(c)
    if shelf: wall_shelf(c)
    plinth(c)


# ───────────────────────── 벽 ─────────────────────────
@REG.piece('wz-hd-wall-n', '지하 창고 북벽(오크 보)', 1, 4, ['S', 'S', 'S', 'X'], 'architecture', SP,
           desc='거친 큰 석재 블록 지하 벽 1×4. 위쪽에 오크 보, 가운데에 벽에 박은 오크 선반 널(까치발), 아래는 걸레받이. 바닥 석판보다 훨씬 밝다.',
           rules='북쪽 가장자리에 가로로 이어 붙인다(16px 주기 이음새 없음). 열린 통로·비밀 패널은 같은 높이 조각으로 바꿔 끼운다.',
           tags=['벽', '지하', '석벽', '보', '선반'], role='wall', repeat=True)
def _wall_n(c):
    wall_base(c, shelf=True)


@REG.piece('wz-hd-beam-h', '천장 오크 보(가로)', 1, 1, ['C'], 'architecture', SP,
           desc='사람 위로 지나가는 천장 오크 보 가로 띠 1×1(위층 C).', rules='가로로 이어 깔면 한 줄 보가 된다.',
           tags=['천장', '보'], role='prop')
def _beam_h(c):
    y = 4
    c.R(0, y, 16, 3, K('wood', 5)); c.HL(0, y, 16, K('wood', 5))
    c.R(0, y + 3, 16, 5, K('wood', 3)); c.HL(0, y + 3, 16, K('wood', 4))
    c.HL(0, y + 6, 16, K('wood', 2)); c.HL(0, y + 7, 16, K('wood', 1))
    for x in range(16):
        if hsh(x, 1, 8) < 0.22: c.P(x, y + 4, K('wood', 2))
        if hsh(x, 2, 8) < 0.18: c.P(x, y + 1, K('wood', 4))
    c.HL(0, y - 1, 16, K('wood', 0)); c.HL(0, y + 8, 16, K('wood', 0))
    c.R(0, y + 9, 16, 1, K('night', 1))


@REG.piece('wz-hd-beam-v', '천장 오크 보(세로)', 1, 1, ['C'], 'architecture', SP,
           desc='천장 오크 보 세로 띠 1×1(위층 C).', rules='세로로 이어 깔면 한 줄 보가 된다.',
           tags=['천장', '보'], role='prop')
def _beam_v(c):
    x = 4
    c.R(x, 0, 3, 16, K('wood', 5)); c.R(x + 3, 0, 4, 16, K('wood', 3)); c.R(x + 7, 0, 1, 16, K('wood', 1))
    c.VL(x + 3, 0, 16, K('wood', 4)); c.VL(x + 6, 0, 16, K('wood', 2))
    for y in range(16):
        if hsh(1, y, 8) < 0.2: c.P(x + 4, y, K('wood', 2))
        if hsh(2, y, 8) < 0.18: c.P(x + 1, y, K('wood', 4))
    c.VL(x - 1, 0, 16, K('wood', 0)); c.VL(x + 8, 0, 16, K('wood', 0))
    c.VL(x + 9, 0, 16, K('night', 1))


@REG.piece('wz-hd-beam-x', '천장 오크 보(교차)', 1, 1, ['C'], 'architecture', SP,
           desc='천장 오크 보 교차 1×1(위층 C). 가로·세로 보가 만나는 곳.', rules='보 가로·세로 끝이 만나는 자리에 놓는다.',
           tags=['천장', '보'], role='prop')
def _beam_x(c):
    _beam_h(c)
    # 세로 보를 위에 겹친다
    x = 4
    c.R(x, 0, 3, 16, K('wood', 5)); c.R(x + 3, 0, 4, 16, K('wood', 3)); c.R(x + 7, 0, 1, 16, K('wood', 1))
    c.VL(x + 3, 0, 16, K('wood', 4)); c.VL(x + 6, 0, 16, K('wood', 2))
    c.VL(x - 1, 0, 16, K('wood', 0)); c.VL(x + 8, 0, 16, K('wood', 0))
    c.R(x - 1, 6, 10, 1, K('wood', 0))
    c.R(x, 7, 3, 1, K('wood', 4)); c.R(x + 3, 7, 4, 1, K('wood', 3))
    c.P(x + 3, 11, K('iron', 3)); c.P(x + 3, 4, K('iron', 3))   # 보 이음 쇠못


# ───────────────────────── 비밀 패널 3상태 ─────────────────────────
def _panel_wall(c):
    wall_base(c)


@REG.piece('wz-hd-panel-closed', '비밀 패널(닫힘)', 1, 4, ['S', 'S', 'S', 'X'], 'architecture', SP,
           desc='석벽처럼 보이는 비밀 패널 1×4. 가장자리에 머리카락 같은 틈과 닳은 누름돌이 있다.',
           rules='북벽 가운데 한 칸 자리에 놓는다. 이동·열림 상태와 크기·기준점이 같다.',
           tags=['비밀', '패널', '벽'], role='wall', states='hd-secret-panel')
def _panel_closed(c):
    _panel_wall(c)
    c.HL(0, 22, 16, K(ST, 1)); c.HL(0, 57, 16, K(ST, 1))
    c.VL(1, 23, 34, K(ST, 1)); c.VL(14, 23, 34, K(ST, 1))
    c.R(10, 38, 3, 3, K(ST, 4)); c.HL(10, 38, 3, K(ST, 5)); c.HL(10, 40, 3, K(ST, 2))   # 닳은 누름돌


@REG.piece('wz-hd-panel-moving', '비밀 패널(이동 중)', 1, 4, ['S', 'S', 'S', 'X'], 'architecture', SP,
           desc='석벽 패널이 오른쪽으로 반쯤 밀려 왼쪽에 어둠이 드러난 상태 1×4.',
           rules='열림 상태로 가는 중간 프레임(통행 불가).', tags=['비밀', '패널', '벽'], role='wall', states='hd-secret-panel')
def _panel_moving(c):
    _panel_wall(c)
    x0, y0, y1 = 1, 22, 58
    c.R(x0, y0, 8, y1 - y0, K('night', 0))
    for y in range(y0, y1):
        t = (y - y0) / (y1 - y0)
        if t > 0.72: c.HL(x0, y, 8, K('night', 1))
    c.HL(x0, y0, 8, K('stone', 0)); c.HL(x0, y0 + 1, 8, K('night', 1))
    # 어둠 속 통로 바닥 암시
    c.HL(x0, 52, 8, K('night', 1)); c.HL(x0 + 1, 53, 6, K('night', 2)); c.HL(x0, 54, 8, K('night', 1))
    # 밀려난 패널 판(오른쪽 8px)
    c.R(9, 22, 6, 36, K(ST, 3))
    c.VL(9, 22, 36, K(ST, 5)); c.VL(10, 22, 36, K(ST, 4)); c.VL(14, 22, 36, K(ST, 2))
    c.HL(9, 22, 6, K(ST, 4)); c.HL(9, 57, 6, K(ST, 1))
    for yy in (30, 40, 49): c.HL(10, yy, 4, K(ST, 2))
    c.VL(8, 23, 34, K('night', 0))
    # 판이 드리운 그림자(어둠 쪽)
    c.VL(7, 23, 33, K('night', 0))


@REG.piece('wz-hd-panel-open', '비밀 패널(열림)', 1, 4, ['S', 'S', 'F', 'F'], 'architecture', SP,
           desc='패널이 옆으로 비켜 석재 통로 입구가 드러난 상태 1×4. 안쪽은 어둡고 바닥은 돌 포석, 걸어 들어갈 수 있다.',
           rules='열림 상태는 통행(아래 두 칸 F). 아래쪽은 석재 통로 문턱 조각과 이어진다.',
           tags=['비밀', '통로', '입구'], role='wall', states='hd-secret-panel')
def _panel_open(c):
    _panel_wall(c)
    x0, x1, y0 = 2, 14, 22
    c.R(x0, y0, x1 - x0, 64 - y0, K('night', 0))
    # 안쪽 뒷벽(어두운 블록 결)과 바닥
    for y in range(y0 + 2, 42):
        for x in range(x0, x1):
            if (y - y0) % 7 == 2: c.P(x, y, K('night', 1))
            elif (x + (y // 7) * 5) % 9 == 0: c.P(x, y, K('night', 1))
    for y in range(42, 64):
        for x in range(x0, x1):
            t = K(ST, 2) if y < 50 else K(ST, 3)
            c.P(x, y, t)
        if (y - 42) % 7 == 0: c.HL(x0, y, x1 - x0, K(ST, 1))
    for y in range(42, 64):
        for x in (x0 + 5, x0 + 10): c.P(x, y, K(ST, 1)) if (y - 42) // 7 % 2 == 0 else None
    c.R(x0, 42, x1 - x0, 1, K('night', 1))
    # 문틀 안쪽 그림자·문설주
    c.HL(x0, y0, x1 - x0, K(ST, 0)); c.HL(x0, y0 + 1, x1 - x0, K('night', 1)); c.HL(x0, y0 + 2, x1 - x0, K('night', 1))
    c.VL(x0 - 1, y0, 42, K(ST, 1)); c.VL(x0, y0 + 2, 40, K(ST, 1))
    # 오른쪽에 비켜 있는 패널 가장자리
    c.R(14, 22, 2, 42, K(ST, 4)); c.VL(14, 22, 42, K(ST, 5)); c.VL(15, 22, 42, K(ST, 2))
    c.HL(14, 22, 2, K(ST, 5)); c.R(14, 58, 2, 6, K(ST, 3)); c.HL(14, 58, 2, K(ST, 4))
    # 문턱 바닥 앞 가장자리(행 3 맨 아래)
    c.HL(x0, 62, x1 - x0, K(ST, 4)); c.HL(x0, 63, x1 - x0, K(ST, 3))
    c.R(0, 58, 2, 6, K(ST, 2)); c.HL(0, 58, 2, K(ST, 3))


# 석재 통로 입구·문턱(1×2)
@REG.piece('wz-hd-passage-threshold', '석재 통로 문턱', 1, 2, ['F', 'F'], 'surfaces', SP,
           desc='비밀 통로 입구 앞뒤를 잇는 석재 포석 1×2. 위쪽은 어두운 통로 바닥, 아래쪽은 닳은 문턱 돌.',
           rules='열린 패널 아래 두 칸 자리에 깐다.', tags=['문턱', '통로', '바닥'], role='terrain')
def _threshold(c):
    c.R(0, 0, 16, 32, K(ST, 2))
    for y in range(0, 32):
        if y % 8 == 0: c.HL(0, y, 16, K(ST, 1))
        off = 5 if (y // 8) % 2 == 0 else 11
        if y % 8 != 0: c.P(off, y, K(ST, 1))
    for y in range(0, 8):
        c.HL(0, y, 16, K(ST, 1) if y < 3 else K(ST, 2))
    c.R(0, 18, 16, 14, K(ST, 3)); c.HL(0, 18, 16, K(ST, 4))
    for y in range(18, 32):
        if (y - 18) % 7 == 0 and y > 18: c.HL(0, y, 16, K(ST, 2))
    c.VL(7, 19, 6, K(ST, 2)); c.VL(11, 26, 6, K(ST, 2))
    # 문턱 돌(앞쪽 올림)
    c.R(0, 26, 16, 6, K(ST, 4)); c.HL(0, 26, 16, K(ST, 5)); c.HL(0, 31, 16, K(ST, 3))
    c.VL(8, 27, 4, K(ST, 3)); c.P(3, 28, K(ST, 3)); c.P(12, 29, K(ST, 3))
    c.HL(0, 24, 16, K(ST, 3)); c.HL(0, 25, 16, K(ST, 2))
    # 통로 안쪽(위 칸)은 더 어둡고 양옆 벽 그림자가 진다
    c.R(0, 0, 16, 14, K(ST, 1))
    for (x, y, w) in ((2, 3, 6), (9, 7, 5), (3, 11, 7)): c.HL(x, y, w, K(ST, 2))
    c.HL(0, 14, 16, K(ST, 0)); c.HL(0, 15, 16, K(ST, 1))
    c.R(0, 0, 2, 24, K(ST, 0)); c.R(14, 0, 2, 24, K(ST, 0))
    c.VL(2, 0, 14, K(ST, 1)); c.VL(13, 0, 14, K(ST, 1))



# ───────────────────────── 바닥 ─────────────────────────
def stone_flags(c, seed):
    """어둡고 닳은 지하 석판(16 주기). 바탕 stone1 한 톤, 줄눈 stone0, 왼위 모서리·닳은 자리만 드문 stone2. 3톤."""
    c.R(0, 0, 16, 16, K(ST, 1))
    if seed == 0:
        rows = ((0, 7, (9,)), (7, 9, (4, 13)))           # (y, 높이, 세로 줄눈 x)
        wear = ((11, 3, 3), (6, 11, 2))
    else:
        rows = ((0, 9, (2, 11)), (9, 7, (7,)))
        wear = ((4, 4, 3), (12, 12, 2))
    for y, h, cuts in rows:
        c.HL(0, y + h - 1, 16, K(ST, 0))                # 가로 줄눈
        for x in cuts:
            c.VL(x, y, h - 1, K(ST, 0))                  # 세로 줄눈
            c.P((x + 1) % 16, y, K(ST, 2))               # 석판 왼위 모서리의 작은 빛
    for x, y, w in wear:                                  # 발길에 닳은 자리
        c.HL(x, y, w, K(ST, 2))


@REG.piece('wz-hd-floor-sugar-a', '설탕 판재 바닥 A', 1, 1, ['F'], 'surfaces', SP,
           desc='지하 창고의 어둡고 닳은 큰 석판 바닥 1×1(이름의 설탕 가루는 포장 바닥 덧그림으로 얹는다). 낮은 대비 줄눈, 드문 닳은 자리.',
           rules='이음새 없이 반복. B와 섞어 깐다. 밝은 석벽·오크 선반과 확실히 구분된다.',
           tags=['바닥', '석판', '지하'], role='terrain', repeat=True)
def _fa(c): stone_flags(c, 0)


@REG.piece('wz-hd-floor-sugar-b', '설탕 판재 바닥 B', 1, 1, ['F'], 'surfaces', SP,
           desc='줄눈 위치가 다른 어두운 석판 바닥 1×1.', rules='이음새 없이 반복. A와 섞어 깐다.',
           tags=['바닥', '석판', '지하'], role='terrain', repeat=True)
def _fb(c): stone_flags(c, 1)


@REG.piece('wz-hd-floor-packing', '포장 작업 바닥(끈·종이 조각)', 1, 1, ['f'], 'surfaces', SP,
           desc='바닥 위에 흩어진 끈 조각과 포장지 부스러기 덧그림 1×1(투명 바탕).', rules='판재 바닥 위 작업대 주변에 듬성듬성 얹는다.',
           tags=['바닥', '덧그림', '포장'], role='terrain')
def _fp(c):
    # 끈 조각(굽은 선)
    for (x, y) in ((2, 3), (3, 3), (4, 4), (5, 4), (6, 3)): c.P(x, y, K('linen', 3))
    for (x, y) in ((2, 4), (6, 4)): c.P(x, y, K('linen', 1))
    # 종이 부스러기(붉은·베이지)
    for (x, y, col) in ((10, 8, K('red', 3)), (11, 8, K('red', 3)), (10, 9, K('red', 2)), (11, 9, K('red', 2)), (12, 9, K('red', 1))):
        c.P(x, y, col)
    c.R(3, 11, 3, 2, K('linen', 4)); c.HL(3, 13, 3, K('linen', 2)); c.P(5, 11, K('linen', 3))
    for (x, y) in ((12, 3), (13, 3), (13, 4)): c.P(x, y, K('linen', 3))
    c.P(8, 14, K('linen', 3)); c.P(9, 14, K('linen', 3)); c.P(9, 13, K('brass', 4))


# ───────────────────────── 계단 2×3 ─────────────────────────
@REG.piece('wz-hd-stairs-down', '창고 내려오는 나무 계단', 2, 3, ['SS', 'FF', 'FF'], 'architecture', SP,
           desc='위층 가게에서 내려오는 나무 계단 2×3. 위쪽은 어두운 계단통 입구, 아래로 갈수록 디딤판이 바닥에 가까워진다.',
           rules='북벽 앞에 놓는다. 위 한 줄은 막히고 아래 두 줄로 걸어 오른다.',
           tags=['계단', '내림', '나무'], role='prop')
def _stairs(c):
    W = 32
    # 위쪽 석벽·계단통 입구
    blocks16(c, 0, 16)
    ceiling_shade(c, 3)
    c.R(3, 0, 26, 14, K('night', 0))
    c.HL(3, 12, 26, K('night', 1)); c.HL(3, 13, 26, K('night', 2))
    c.R(0, 0, 3, 16, K(ST, 2)); c.R(29, 0, 3, 16, K(ST, 2))
    c.VL(2, 0, 16, K(ST, 0)); c.VL(29, 0, 16, K(ST, 0))
    # 위쪽 보 멍에
    c.R(3, 0, 26, 3, K('wood', 3)); c.HL(3, 2, 26, K('wood', 1)); c.HL(3, 0, 26, K('wood', 4))
    # 디딤판 6단: 각 8px = 윗면 3 + 챌판 5, 아래로 갈수록 밝고(가까움) 약간 넓다
    for i in range(5):
        y = 16 + i * 6 if False else 14 + i * 7
        x0, x1 = 3, 29
        top_h, ris_h = 3, 4
        c.R(x0, y, x1 - x0, top_h, K('wood', 5)); c.HL(x0, y, x1 - x0, K('wood', 5))
        c.HL(x0, y + 1, x1 - x0, K('wood', 5)); c.HL(x0, y + 2, x1 - x0, K('wood', 4))
        c.R(x0, y + top_h, x1 - x0, ris_h, K('wood', 2)); c.HL(x0, y + top_h, x1 - x0, K('wood', 1))
        c.HL(x0, y + top_h + ris_h - 1, x1 - x0, K('wood', 0))
        for x in range(x0, x1):
            if hsh(x, i, 6) < 0.16: c.P(x, y + 1, K('wood', 4))
            if hsh(x, i, 7) < 0.14: c.P(x, y + top_h + 1, K('wood', 1))
        # 못
        c.P(x0 + 2, y + top_h + 2, K('iron', 3)); c.P(x1 - 3, y + top_h + 2, K('iron', 3))
    # 마지막 단 아래 바닥 그림자
    c.R(3, 49, 26, 1, K('wood', 1))
    # 양옆 난간 기둥·손잡이 줄
    for xs in (0, 29):
        c.R(xs, 14, 3, 34, K('wood', 3)); c.VL(xs, 14, 34, K('wood', 4)); c.VL(xs + 2, 14, 34, K('wood', 1))
    for y in (15, 30, 44):
        c.R(0, y - 1, 3, 3, K('wood', 5)); c.HL(0, y + 1, 3, K('wood', 2))
        c.R(29, y - 1, 3, 3, K('wood', 5)); c.HL(29, y + 1, 3, K('wood', 2))
    # 계단통에 번지는 위층 불빛(작은 덩이 둘)
    c.R(10, 4, 12, 2, K('fire', 1)); c.R(8, 6, 16, 3, K('fire', 1)); c.R(11, 5, 10, 3, K('fire', 2)); c.R(14, 6, 4, 1, K('fire', 3))
    c.R(6, 9, 20, 3, K('night', 1))
    c.outline()



# ───────────────────────── 가구·소품 공용 도우미 ─────────────────────────
def slab(c, x, y, w, top_h, front_h, m='wood', base=3, seed=0):
    """3/4 직육면체: 윗면(밝음) + 앞면(한 단 어두움) + 오른쪽 모서리(가장 어둠)."""
    c.R(x, y, w, top_h, K(m, base + 1))
    c.HL(x, y, w, K(m, base + 2))
    for xx in range(x, x + w):
        v = hsh(xx, seed, 3)
        if v < 0.2 and top_h > 3: c.P(xx, y + 1 + int(v * 30) % (top_h - 2), K(m, base))
    c.R(x, y + top_h, w, front_h, K(m, base))
    c.HL(x, y + top_h, w, K(m, base + 1) if base + 1 < 6 else K(m, base))
    c.HL(x, y + top_h + front_h - 1, w, K(m, base - 2))
    c.VL(x + w - 1, y + top_h, front_h, K(m, base - 1))
    c.VL(x + w - 1, y, top_h, K(m, base))
    for xx in range(x + 1, x + w - 1):
        if hsh(xx, seed, 5) < 0.18 and front_h > 3: c.P(xx, y + top_h + 1 + int(hsh(xx, 1, seed) * (front_h - 3)), K(m, base - 1))


def candy_box(c, x, y, w, top_h, front_h, col='red', band='brass', seed=0):
    """과자 상자 한 개: 윗면 + 앞면 + 가운데 띠/상표."""
    slab(c, x, y, w, top_h, front_h, col, 3, seed)
    c.HL(x, y, w, K(col, 4))
    # 뚜껑 띠
    c.HL(x, y + top_h, w, K(band, 4))
    if w >= 8:
        mx = x + w // 2
        c.R(mx - 1, y + top_h + 1, 3, max(1, front_h - 3), K(band, 3))
        c.P(mx, y + top_h + 1, K(band, 5))


# ───────────────────────── 작업대 3×2 ─────────────────────────
@REG.piece('wz-hd-workbench', '과자 포장 작업대', 3, 2, ['SSS', 'SSS'], 'furniture', SP,
           desc='과자를 포장하는 큰 오크 작업대 3×2. 윗면에 포장지·끈·반쯤 싼 상자가 놓여 있고 아래에 널 선반이 있다.',
           rules='창고 가운데에 놓는다. 위에 끈 뭉치·저울·상자를 따로 얹을 수 있게 윗면 일부는 비어 있다.',
           tags=['작업대', '포장', '과자'], role='prop')
def _workbench(c):
    # 다리(앞 두 개, 뒤 두 개 일부)
    for lx in (2, 42):
        c.R(lx, 15, 4, 16, K('wood', 3)); c.VL(lx, 15, 16, K('wood', 4)); c.VL(lx + 3, 15, 16, K('wood', 1))
        c.R(lx - 1, 29, 6, 2, K('wood', 2)); c.HL(lx - 1, 29, 6, K('wood', 3))
    for lx in (7, 37):
        c.R(lx, 14, 3, 11, K('wood', 2)); c.VL(lx, 14, 11, K('wood', 3))
    # 아래 선반(앞 가로대 + 판)
    c.R(6, 23, 36, 3, K('wood', 2)); c.HL(6, 23, 36, K('wood', 3)); c.HL(6, 25, 36, K('wood', 1))
    # 선반 위 상자 두 개 숨김 느낌
    c.R(10, 19, 8, 4, K('red', 2)); c.HL(10, 19, 8, K('red', 3))
    c.R(30, 20, 7, 3, K('linen', 3)); c.HL(30, 20, 7, K('linen', 4))
    # 윗판
    slab(c, 0, 2, 48, 9, 5, 'wood', 3, 2)
    c.HL(0, 6, 48, K('wood', 4)) if False else None
    # 판 이음
    for x in (16, 32): c.VL(x, 3, 8, K('wood', 3))
    # 윗면 위 물건: 펼친 포장지(붉은 종이)
    c.R(4, 4, 14, 6, K('red', 3)); c.HL(4, 4, 14, K('red', 4)); c.HL(4, 9, 14, K('red', 2))
    for x in range(6, 17, 3): c.P(x, 6, K('brass', 4)); c.P(x + 1, 7, K('brass', 4))
    # 반쯤 싼 상자(가운데)
    candy_box(c, 22, 3, 10, 3, 5, 'violet', 'brass', 4)
    c.P(24, 3, K('linen', 4)); c.P(25, 3, K('linen', 3))
    # 끈 한 가닥과 가위
    c.HL(35, 5, 7, K('linen', 3)); c.P(41, 6, K('linen', 3)); c.HL(34, 8, 6, K('linen', 4))
    c.P(43, 4, K('iron', 4)); c.P(44, 5, K('iron', 3)); c.P(43, 6, K('iron', 2)); c.P(45, 4, K('iron', 4))
    c.outline()


# ───────────────────────── 저울 (f) ─────────────────────────
@REG.piece('wz-hd-scale', '놋쇠 저울', 1, 1, ['f'], 'furniture', SP,
           desc='과자 무게를 다는 놋쇠 접시 저울 1×1. 작업대 위나 바닥에 얹는 덧그림.', rules='작업대 위에 얹는다(통행 영향 없음).',
           tags=['저울', '놋쇠', '소품'], role='prop')
def _scale(c):
    # 받침대
    c.R(4, 13, 8, 2, K('brass', 3)); c.HL(4, 13, 8, K('brass', 5)); c.HL(4, 14, 8, K('brass', 1))
    c.R(7, 5, 2, 8, K('brass', 4)); c.VL(7, 5, 8, K('brass', 5)); c.VL(8, 5, 8, K('brass', 2))
    # 가로대
    c.HL(2, 4, 12, K('brass', 5)); c.HL(2, 5, 12, K('brass', 2)); c.P(7, 3, K('brass', 5)); c.P(8, 3, K('brass', 3))
    # 줄과 접시
    c.VL(3, 6, 4, K('iron', 3)); c.VL(12, 6, 4, K('iron', 3))
    c.R(1, 10, 5, 1, K('brass', 5)); c.R(1, 11, 5, 1, K('brass', 3)); c.R(2, 12, 3, 1, K('brass', 1))
    c.R(10, 10, 5, 1, K('brass', 5)); c.R(10, 11, 5, 1, K('brass', 3)); c.R(11, 12, 3, 1, K('brass', 1))
    # 접시 위 젤리빈
    c.P(2, 9, K('red', 4)); c.P(3, 9, K('leaf', 4)); c.P(4, 9, K('red', 3))
    c.outline()


# ───────────────────────── 사탕 항아리 3색 ─────────────────────────
def jar(c, col):
    cx = 8
    # 몸통(유리): 가운데 밝은 줄, 안쪽 사탕
    c.R(3, 6, 10, 8, K('water', 1))
    c.R(4, 7, 8, 7, K('water', 2))
    # 사탕 채움
    for y in range(8, 14):
        for x in range(4, 12):
            if (x * 3 + y * 5) % 4 == 0: c.P(x, y, K(col, 4))
            elif (x + y * 2) % 3 == 0: c.P(x, y, K(col, 3))
            else: c.P(x, y, K(col, 2))
    c.HL(4, 13, 8, K(col, 1))
    # 유리 윤곽/반사
    c.VL(3, 7, 7, K('water', 4)); c.VL(4, 7, 3, K('snow', 3)); c.P(4, 11, K('snow', 2))
    c.VL(12, 7, 7, K('water', 2))
    # 어깨 + 목 + 뚜껑
    c.R(4, 5, 8, 1, K('water', 3)); c.R(5, 4, 6, 1, K('water', 3))
    c.R(4, 2, 8, 2, K('brass', 4)); c.HL(4, 2, 8, K('brass', 5)); c.HL(4, 3, 8, K('brass', 2))
    c.P(7, 1, K('brass', 5)); c.P(8, 1, K('brass', 4))
    c.R(2, 14, 12, 1, K('wood', 2)) if False else None
    c.outline()


@REG.piece('wz-hd-jar-red', '사탕 항아리(빨강)', 1, 1, ['S'], 'furniture', SP,
           desc='딸기맛 빨간 사탕이 가득한 유리 항아리 1×1, 놋쇠 뚜껑.', rules='선반·작업대·바닥 어디에나.',
           tags=['항아리', '사탕', '유리'], role='prop')
def _jar_red(c): jar(c, 'red')


@REG.piece('wz-hd-jar-green', '사탕 항아리(초록)', 1, 1, ['S'], 'furniture', SP,
           desc='박하맛 초록 사탕이 가득한 유리 항아리 1×1.', rules='선반·작업대·바닥 어디에나.',
           tags=['항아리', '사탕', '유리'], role='prop')
def _jar_green(c): jar(c, 'leaf')


@REG.piece('wz-hd-jar-violet', '사탕 항아리(보라)', 1, 1, ['S'], 'furniture', SP,
           desc='포도맛 보라 사탕이 가득한 유리 항아리 1×1.', rules='선반·작업대·바닥 어디에나.',
           tags=['항아리', '사탕', '유리'], role='prop')
def _jar_violet(c): jar(c, 'violet')


# ───────────────────────── 상자들 ─────────────────────────
@REG.piece('wz-hd-box-frog', '초콜릿 개구리 상자', 1, 1, ['S'], 'furniture', SP,
           desc='초콜릿 개구리가 든 오각형 포장 상자 1×1. 앞면에 초록 개구리 얼굴이 그려져 있다.',
           rules='선반·작업대·바닥 어디에나.', tags=['상자', '초콜릿', '개구리'], role='prop')
def _box_frog(c):
    # 윗면(뚜껑 능선)
    c.R(3, 3, 10, 2, K('choc', 4)); c.HL(3, 3, 10, K('choc', 4))
    c.R(2, 5, 12, 2, K('choc', 3)); c.HL(2, 5, 12, K('choc', 4))
    # 앞면 오각형(집 모양)
    c.R(2, 7, 12, 7, K('choc', 2)); c.VL(13, 7, 7, K('choc', 1)); c.HL(2, 13, 12, K('choc', 1))
    c.HL(2, 7, 12, K('choc', 3))
    # 개구리 얼굴
    c.R(5, 9, 6, 4, K('leaf', 3)); c.HL(5, 9, 6, K('leaf', 4)); c.HL(5, 12, 6, K('leaf', 2))
    c.R(5, 8, 2, 2, K('leaf', 4)); c.R(9, 8, 2, 2, K('leaf', 4))
    c.P(5, 8, K('snow', 4)); c.P(10, 8, K('snow', 4)); c.P(6, 9, OL); c.P(9, 9, OL)
    c.HL(6, 11, 4, K('leaf', 1))
    # 금빛 모서리 띠
    c.VL(2, 7, 7, K('brass', 3)); c.P(2, 7, K('brass', 5))
    c.outline()


@REG.piece('wz-hd-box-beans', '백미향 젤리빈 상자', 1, 1, ['S'], 'furniture', SP,
           desc='온갖 맛 젤리빈이 든 줄무늬 상자 1×1. 알록달록 세로 줄무늬와 열린 뚜껑.', rules='선반·작업대·바닥 어디에나.',
           tags=['상자', '젤리빈', '줄무늬'], role='prop')
def _box_beans(c):
    # 윗면: 뚜껑 열려 젤리빈이 보인다
    c.R(2, 3, 12, 4, K('linen', 3)); c.HL(2, 3, 12, K('linen', 4))
    for (x, y, col) in ((4, 4, 'red'), (6, 5, 'leaf'), (8, 4, 'brass'), (10, 5, 'violet'), (12, 4, 'red'), (5, 6, 'violet')):
        c.P(x, y, K(col, 4)); c.P(x + 1, y, K(col, 3))
    # 앞면 세로 줄무늬
    cols = ['red', 'brass', 'leaf', 'violet', 'red', 'brass']
    for i, col in enumerate(cols):
        x = 2 + i * 2
        c.R(x, 7, 2, 7, K(col, 3)); c.VL(x, 7, 7, K(col, 4)); c.HL(x, 13, 2, K(col, 1))
    c.R(12, 7, 2, 7, K('brass', 2)); c.VL(13, 7, 7, K('brass', 1)); c.HL(12, 13, 2, K('brass', 1))
    c.HL(2, 7, 12, K('linen', 4))
    c.outline()


@REG.piece('wz-hd-stack-1x2', '완성 과자 상자 적치(1×2)', 1, 2, ['S', 'S'], 'furniture', SP,
           desc='포장을 마친 과자 상자를 세 단으로 쌓은 더미 1×2. 맨 위 상자 윗면이 보인다.', rules='벽 앞이나 작업대 옆에 놓는다.',
           tags=['상자', '적치', '과자'], role='prop')
def _stack12(c):
    candy_box(c, 1, 14, 14, 3, 6, 'linen', 'red', 1)
    candy_box(c, 2, 8, 12, 2, 6, 'red', 'brass', 2)
    candy_box(c, 1, 2, 13, 3, 5, 'violet', 'brass', 3)
    # 맨 아래 상자는 바닥까지 -> 아래 칸
    candy_box(c, 0, 20, 15, 3, 8, 'wood', 'linen', 4)
    candy_box(c, 1, 22, 14, 2, 8, 'linen', 'red', 5) if False else None
    c.outline()


@REG.piece('wz-hd-stack-2x2', '완성 과자 상자 적치(2×2)', 2, 2, ['SS', 'SS'], 'furniture', SP,
           desc='포장을 마친 과자 상자를 피라미드처럼 쌓은 더미 2×2.', rules='벽 앞에 놓는다.',
           tags=['상자', '적치', '과자'], role='prop')
def _stack22(c):
    # 아래줄 3개
    candy_box(c, 0, 18, 11, 3, 10, 'wood', 'linen', 1)
    candy_box(c, 10, 18, 11, 3, 10, 'red', 'brass', 2)
    candy_box(c, 21, 18, 11, 3, 10, 'linen', 'violet', 3)
    # 중간줄 2개
    candy_box(c, 4, 9, 11, 3, 9, 'violet', 'brass', 4)
    candy_box(c, 16, 9, 11, 3, 9, 'leaf', 'linen', 5)
    # 꼭대기 1개
    candy_box(c, 10, 1, 12, 3, 8, 'red', 'linen', 6)
    c.outline()


# ───────────────────────── 선반 2×3 ─────────────────────────
@REG.piece('wz-hd-shelf', '과자 상자 선반', 2, 3, ['SS', 'SS', 'SS'], 'furniture', SP,
           desc='과자 상자와 항아리로 가득한 나무 선반 2×3. 세 단.', rules='북벽·측벽에 붙여 놓는다.',
           tags=['선반', '과자', '상자'], role='prop')
def _shelf(c):
    W, H = 32, 48
    # 뒷판(어두운 널)
    c.R(0, 4, W, 43, K('wood', 1))
    for x in range(0, W, 5): c.VL(x, 4, 43, K('wood', 0))
    # 옆 기둥
    for xs in (0, 29):
        c.R(xs, 4, 3, 44, K('wood', 3)); c.VL(xs, 4, 44, K('wood', 4)); c.VL(xs + 2, 4, 44, K('wood', 1))
    # 맨 위 판(윗면 보임)
    slab(c, 0, 0, W, 4, 3, 'wood', 3, 7)
    # 칸별 선반판 + 물건
    plan = (
        (4, 15, [('red', 'brass', 6), ('violet', 'brass', 7), ('leaf', 'linen', 6), ('linen', 'red', 7)]),
        (19, 30, [('jar', 'red', 0), ('box', 'frog', 0), ('jar', 'violet', 0), ('red', 'brass', 6)]),
        (34, 45, [('leaf', 'brass', 7), ('linen', 'violet', 7), ('red', 'linen', 7), ('violet', 'brass', 6)]),
    )
    for (y0, y1, items) in plan:
        # 칸 안쪽 그림자
        c.R(3, y0, 26, y1 - y0, K('wood', 0))
        c.R(3, y0 + 2, 26, y1 - y0 - 2, K('wood', 1))
        x = 4
        for (a, b, hgt) in items:
            if a == 'jar':
                c.R(x + 1, y1 - 8, 5, 7, K(b, 3)); c.HL(x + 1, y1 - 8, 5, K('water', 4)); c.VL(x + 1, y1 - 7, 5, K('snow', 2))
                c.R(x, y1 - 10, 7, 2, K('brass', 4)); c.HL(x, y1 - 10, 7, K('brass', 5))
                x += 7
            elif a == 'box':
                c.R(x, y1 - 8, 7, 7, K('choc', 2)); c.HL(x, y1 - 8, 7, K('choc', 4)); c.R(x + 2, y1 - 6, 3, 3, K('leaf', 3)); c.P(x + 2, y1 - 6, K('snow', 4)); c.P(x + 4, y1 - 6, K('snow', 4))
                x += 7
            else:
                hh = 7 if hgt == 6 else 8
                bx = x
                c.R(bx, y1 - hh - 1, 6, hh, K(a, 3)); c.HL(bx, y1 - hh - 1, 6, K(a, 4))
                c.VL(bx + 5, y1 - hh, hh - 1, K(a, 1)); c.R(bx + 2, y1 - hh + 1, 2, hh - 3, K(b, 3))
                x += 6
        # 선반판
        slab(c, 0, y1 - 1, W, 2, 3, 'wood', 3, y0)
    c.outline()


# ───────────────────────── 두루마리·끈 뭉치 (f) ─────────────────────────
@REG.piece('wz-hd-paper-roll', '포장지 두루마리', 1, 1, ['f'], 'furniture', SP,
           desc='바닥이나 작업대에 눕혀 놓은 붉은 포장지 두루마리 1×1.', rules='작업대 옆 바닥에 얹는다.',
           tags=['포장지', '두루마리'], role='prop')
def _paper_roll(c):
    # 몸통(누운 원통): 윗면 밝음
    c.R(3, 6, 10, 6, K('red', 3)); c.HL(3, 6, 10, K('red', 4)); c.HL(3, 7, 10, K('red', 4)); c.HL(3, 11, 10, K('red', 1))
    for x in (6, 9): c.VL(x, 8, 3, K('red', 2))
    # 띠
    c.R(7, 6, 2, 6, K('brass', 3)); c.VL(7, 6, 6, K('brass', 5))
    # 왼쪽 단면(소용돌이)
    c.ellipse(3, 9, 2, 3, K('linen', 4)); c.ellipse(3, 9, 1, 2, K('linen', 2)); c.P(3, 9, K('linen', 1))
    c.P(12, 9, K('red', 1)); c.VL(12, 7, 4, K('red', 1))
    # 늘어진 종이 한 장
    c.R(10, 12, 4, 2, K('red', 3)); c.HL(10, 13, 4, K('red', 2)); c.P(13, 12, K('red', 4))
    c.outline()


@REG.piece('wz-hd-twine-ball', '끈 뭉치', 1, 1, ['f'], 'furniture', SP,
           desc='둥글게 감아 놓은 노끈 뭉치 1×1.', rules='작업대 위나 바닥 어디에나.',
           tags=['끈', '뭉치'], role='prop')
def _twine(c):
    # 황마색 노끈 공: 몸통 + 비스듬히 감긴 줄 + 위쪽 밝은 면
    c.ellipse(8, 9, 5, 5, K('brass', 2))
    c.ellipse(8, 8, 4, 4, K('brass', 3))
    c.ellipse(7, 7, 2, 2, K('brass', 4))
    # 감긴 줄(왼위→오른아래 사선 띠 두 겹)
    for i in range(9):
        x, y = 4 + i, 5 + i
        if 3 <= x <= 13 and 4 <= y <= 13:
            c.P(x, y, K('brass', 2))
    for i in range(7):
        x, y = 4 + i, 8 + i
        c.P(x, y, K('brass', 2))
    for i in range(6):
        c.P(6 + i, 4 + i, K('brass', 4))
    c.HL(5, 13, 7, K('brass', 1))
    # 늘어진 끝
    c.P(12, 11, K('brass', 3)); c.P(13, 12, K('brass', 3)); c.P(13, 13, K('brass', 2)); c.P(14, 13, K('brass', 2))
    c.outline()


# ───────────────────────── 술통형 사탕 통 ─────────────────────────
@REG.piece('wz-hd-tub', '술통형 사탕 통', 1, 1, ['S'], 'furniture', SP,
           desc='윗면이 열린 작은 술통에 알록달록한 사탕이 가득 담겼다 1×1.', rules='선반 옆·벽 앞에.',
           tags=['통', '사탕', '술통'], role='prop')
def _tub(c):
    # 몸통
    c.R(2, 6, 12, 8, K('wood', 3))
    for x in range(2, 14):
        if x % 3 == 0: c.VL(x, 6, 8, K('wood', 2))
    c.VL(3, 6, 8, K('wood', 4)); c.VL(13, 6, 8, K('wood', 1))
    # 테
    c.HL(2, 8, 12, K('iron', 3)); c.HL(2, 12, 12, K('iron', 3)); c.HL(2, 9, 12, K('iron', 1)); c.HL(2, 13, 12, K('iron', 1))
    c.HL(2, 13, 12, K('wood', 1)) if False else None
    # 위 타원(열린 입구) + 사탕
    c.ellipse(8, 5, 6, 3, K('wood', 4))
    c.ellipse(8, 5, 5, 2, K('wood', 1))
    for (x, y, col) in ((5, 4, 'red'), (7, 3, 'leaf'), (9, 4, 'violet'), (11, 5, 'red'), (6, 6, 'brass'), (9, 6, 'leaf'), (7, 5, 'violet'), (4, 5, 'leaf'), (10, 3, 'brass')):
        c.P(x, y, K(col, 4))
    c.outline()


# ───────────────────────── 예제: 지하 창고 ─────────────────────────
_pl = []
for _x in range(12):
    _pl.append(('wz-hd-wall-n', _x, 0))
_pl += [('wz-hd-panel-closed', 3, 0), ('wz-hd-panel-open', 6, 0), ('wz-hd-passage-threshold', 6, 4),
        ('wz-hd-stairs-down', 9, 1)]
_pl += [('wz-hd-floor-packing', 4, 6), ('wz-hd-floor-packing', 7, 7), ('wz-hd-floor-packing', 3, 8)]
_pl += [('wz-hd-shelf', 0, 4), ('wz-hd-stack-2x2', 10, 6), ('wz-hd-stack-1x2', 2, 7), ('wz-hd-tub', 11, 5),
        ('wz-hd-workbench', 4, 6),
        ('wz-hd-jar-red', 4, 6), ('wz-hd-jar-green', 6, 6), ('wz-hd-jar-violet', 7, 6),
        ('wz-hd-scale', 5, 7), ('wz-hd-box-frog', 5, 6), ('wz-hd-paper-roll', 7, 7),
        ('wz-hd-box-beans', 8, 8), ('wz-hd-twine-ball', 3, 8), ('wz-hd-paper-roll', 4, 9)]
_pl += [('wz-hd-beam-h', _x, 4) for _x in range(0, 12)]
REG.example('wz-hd-example-cellar', '허니듀크 지하 창고', 'honeydukes', 12, 10, 'wz-hd-floor-sugar-a', _pl,
            desc='위층 가게에서 계단으로 내려오는 12×10 지하 창고. 북벽에 비밀 패널, 가운데 포장 작업대, 한쪽에 완성 과자 상자 적치.')

if __name__ == '__main__':
    sys.exit(1 if run_module(MODULE) else 0)
