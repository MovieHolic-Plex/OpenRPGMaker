"""공용 가구(shared_furniture) — 오크·황동 가구, 같은 상판 깊이·사람 높이. id 접두 wz-furn-.
  python3 scripts/content/wizarding/pieces/shared_furniture.py   → 검사 + tiledata/wizarding/review/shared_furniture.png

축척 기준(사람 24×32, 몸 28~30px): 탁자 상판 앞 모서리~바닥 15px, 의자 좌면 앞 모서리~바닥 6~7px(16px 칸 안에서),
상판 윗면 깊이 10~11px(전체의 약 35%). 빛은 왼쪽 위. 윤곽 1px 은 `Cv.outline()` (재질 최암단).
"""
import os, sys, math
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from wzlib import REG, Cv, K, OL, OL2, CLEAR, run_module   # noqa: E402

MODULE = 'shared_furniture'
SP = 'shared'
FAM = 'furniture'


def hsh(x, y, s=0):
    return (((x * 73856093) ^ (y * 19349663) ^ (s * 83492791)) & 0xffff) / 65536.0


# ───────────────────────── 오크 공통 ─────────────────────────
def oak_top(c, x, y, w, d, seed=1, seams=True):
    """오크 상판 윗면(밝음). 긴 결 + 판재 이음 + 드문 옹이. 맨 아랫줄은 빛 받는 앞 모서리."""
    c.R(x, y, w, d, K('wood', 4))
    if seams and d >= 8:
        rows = [y + d // 3, y + (2 * d) // 3]
        for i, ry in enumerate(rows):
            c.HL(x, ry, w, K('wood', 3))
            # 판재 끝 이음(짧은 세로 선)
            jx = x + 5 + int(hsh(i, seed, 3) * (w - 10))
            c.VL(jx, ry - (d // 3 - 1), d // 3 - 1, K('wood', 3))
    # 긴 결(드문드문)
    for i in range(max(2, w // 14)):
        gy = y + 1 + int(hsh(i, seed, 5) * (d - 3)); gx = x + 2 + int(hsh(i, seed, 7) * (w - 12)); gl = 5 + int(hsh(i, seed, 9) * 6)
        if gy not in (y + d // 3, y + (2 * d) // 3):
            c.HL(gx, gy, min(gl, x + w - 2 - gx), K('wood', 3))
    for i in range(max(2, w // 18)):
        gy = y + 1 + int(hsh(i, seed, 11) * (d - 3)); gx = x + 3 + int(hsh(i, seed, 13) * (w - 10))
        if gy not in (y + d // 3, y + (2 * d) // 3):
            c.HL(gx, gy, 3 + int(hsh(i, seed, 15) * 3), K('wood', 5))
    # 옹이
    if w > 24:
        kx = x + 6 + int(hsh(seed, 1, 17) * (w - 14)); ky = y + 2
        c.P(kx, ky, K('wood', 2)); c.P(kx + 1, ky, K('wood', 3)); c.P(kx, ky + 1, K('wood', 3))
    c.VL(x, y, d, K('wood', 5))                     # 왼쪽 모서리 빛
    c.HL(x, y + d - 1, w, K('wood', 5))             # 앞 모서리(빛 받는 모)
    c.VL(x + w - 1, y, d - 1, K('wood', 3))        # 오른쪽 모서리는 한 단 어둡게


def oak_front(c, x, y, w, h, seed=1, groove=True):
    """상판 아래 앞치마(정면, 한 단 어둡게)."""
    c.R(x, y, w, h, K('wood', 3))
    c.HL(x, y, w, K('wood', 2))                    # 윗 그늘
    if groove and h >= 6:
        c.HL(x + 1, y + h // 2 + 1, w - 2, K('wood', 2))
    for i in range(max(1, w // 16)):
        gx = x + 2 + int(hsh(i, seed, 21) * (w - 10)); gy = y + 1 + int(hsh(i, seed, 23) * max(1, h - 3))
        c.HL(gx, gy, 4 + int(hsh(i, seed, 25) * 3), K('wood', 4))
    c.VL(x, y + 1, h - 1, K('wood', 4))
    c.VL(x + w - 1, y, h, K('wood', 2))
    c.HL(x, y + h - 1, w, K('wood', 2))


def leg(c, x, y0, y1, wd=3):
    """탁자 다리: 왼쪽 밝고 오른쪽 어둡다."""
    for i in range(wd):
        tone = 4 if i == 0 else (2 if i == wd - 1 else 3)
        c.VL(x + i, y0, y1 - y0 + 1, K('wood', tone))
    c.HL(x, y1, wd, K('wood', 1))


def table(c, x0, w, ty, d, ap, floor_y, seed=1, leg_w=3, mid_legs=(), stretcher=True):
    """3/4 탁자: 윗면(ty..ty+d-1) → 앞치마(ap 줄) → 앞다리 → 바닥 floor_y."""
    ay = ty + d
    fy = ay + ap
    # 아래 그늘(상판이 드리운 그림자) — 다리 사이
    c.R(x0 + leg_w, fy, w - 2 * leg_w, 2, OL2)
    legs = [x0] + [x0 + m for m in mid_legs] + [x0 + w - leg_w]
    for lx in legs:
        leg(c, lx, fy, floor_y, leg_w)
    if stretcher:
        sy = floor_y - 3
        c.R(x0 + leg_w, sy, w - 2 * leg_w, 2, K('wood', 2)); c.HL(x0 + leg_w, sy, w - 2 * leg_w, K('wood', 3))
        c.R(x0 + leg_w, sy + 2, w - 2 * leg_w, 1, OL2)
    # 발밑 그림자 한 줄
    c.R(x0 + leg_w, floor_y, w - 2 * leg_w, 1, OL2)
    oak_front(c, x0, ay, w, ap, seed)
    oak_top(c, x0, ty, w, d, seed)


# ───────────────────────── 작업대·탁자·벤치 ─────────────────────────
@REG.piece('wz-furn-bench-long', '긴 오크 작업대', 3, 2, ['SSS', 'SSS'], FAM, SP,
           desc='긴 오크 작업대 3×2칸. 윗면 10px(긴 결·판재 이음), 앞치마, 다리 사이 가로대. 상판 앞 모서리~바닥 15px.',
           rules='교실·작업실 가운데에 가로로 놓는다. 위에 탁상 소품(f)을 겹친다. 사람은 남쪽 한 칸 앞에 선다.',
           tags=['작업대', '탁자', '오크'], role='prop')
def _bench_long(c):
    table(c, 1, 46, 5, 10, 7, 30, seed=3, mid_legs=(21,))


@REG.piece('wz-furn-table-small', '작은 오크 탁자', 2, 2, ['SS', 'SS'], FAM, SP,
           desc='작은 오크 탁자 2×2칸. 상판 앞 모서리~바닥 15px.', rules='의자 둘~넷과 함께 둔다.',
           tags=['탁자', '오크'], role='prop')
def _table_small(c):
    table(c, 3, 26, 5, 10, 7, 30, seed=7)


@REG.piece('wz-furn-bench-seat', '긴 의자 벤치', 3, 1, ['SSS'], FAM, SP,
           desc='긴 의자 벤치 3×1칸. 좌면 앞 모서리~바닥 7px, 두꺼운 널·판자 다리 셋.',
           rules='식탁·작업대 옆이나 벽 앞에 가로로 놓는다.', tags=['벤치', '긴 의자'], role='prop')
def _bench_seat(c):
    # 다리(널빤지)
    for lx in (3, 22, 42):
        c.R(lx, 10, 3, 5, K('wood', 3)); c.VL(lx, 10, 5, K('wood', 4)); c.VL(lx + 2, 10, 5, K('wood', 2)); c.HL(lx, 14, 3, K('wood', 1))
    c.R(5, 15, 38, 1, OL2)
    # 좌면 앞치마
    oak_front(c, 1, 9, 46, 3, seed=5, groove=False)
    oak_top(c, 1, 4, 46, 5, seed=5, seams=False)
    # 판재 이음 한 줄
    c.HL(2, 6, 44, K('wood', 3))
    c.VL(30, 5, 1, K('wood', 3))


# ───────────────────────── 의자 ─────────────────────────
def chair_legs(c, xs, y0=12, y1=15):
    for lx in xs:
        c.R(lx, y0, 2, y1 - y0 + 1, K('wood', 3)); c.VL(lx, y0, y1 - y0 + 1, K('wood', 4))
        c.P(lx + 1, y1, K('wood', 1)); c.P(lx, y1, K('wood', 2))


@REG.piece('wz-furn-chair-back-up', '오크 의자(등받이 위)', 1, 1, ['S'], FAM, SP,
           desc='오크 의자 1칸. 등받이가 북쪽(위)에 있어 남쪽을 보고 앉는다. 좌면 앞 모서리~바닥 7px.',
           rules='탁자의 남쪽에 둔다.', tags=['의자'], states='chair', role='prop')
def _chair_up(c):
    chair_legs(c, (3, 11))
    c.R(3, 10, 10, 2, K('wood', 3)); c.HL(3, 10, 10, K('wood', 2)); c.VL(12, 10, 2, K('wood', 2))       # 앞치마
    c.R(3, 6, 10, 4, K('wood', 4)); c.HL(3, 9, 10, K('wood', 5)); c.VL(3, 6, 4, K('wood', 5)); c.VL(12, 6, 3, K('wood', 3))   # 좌면 윗면
    c.HL(5, 7, 4, K('wood', 3))
    # 등받이 기둥 + 가로살
    for px in (3, 11):
        c.R(px, 1, 2, 6, K('wood', 3)); c.VL(px, 1, 6, K('wood', 4)); c.VL(px + 1, 1, 6, K('wood', 2))
        c.P(px, 1, K('wood', 5))
    c.R(5, 2, 6, 2, K('wood', 4)); c.HL(5, 2, 6, K('wood', 5)); c.HL(5, 3, 6, K('wood', 3))
    c.R(5, 5, 6, 1, K('wood', 2))
    c.outline()


@REG.piece('wz-furn-chair-back-down', '오크 의자(등받이 아래)', 1, 1, ['S'], FAM, SP,
           desc='오크 의자 1칸. 등받이가 남쪽(아래)에 있어 북쪽을 보고 앉는다(등받이 바깥 면이 정면).',
           rules='탁자의 북쪽에 둔다(탁자 뒤편 사람).', tags=['의자'], states='chair', role='prop')
def _chair_down(c):
    # 등받이가 남쪽(앞)이라 앞다리가 곧 등받이 기둥이다. 기둥 사이로 북쪽 좌면 윗면이 들여다보인다.
    for px in (3, 11):                                                    # 등받이 기둥(= 앞다리, 위로 솟음)
        c.R(px, 1, 2, 11, K('wood', 3)); c.VL(px, 1, 11, K('wood', 4)); c.VL(px + 1, 2, 10, K('wood', 2))
        c.P(px, 1, K('wood', 5))
    chair_legs(c, (3, 11), 12, 15)                                       # 앞다리 아랫부분(바닥까지)
    c.R(5, 3, 6, 3, K('wood', 5)); c.HL(7, 4, 3, K('wood', 4))            # 좌면 윗면(밝음, 긴 결 한 줄)
    c.HL(5, 6, 6, K('wood', 4))                                           # 좌면 윗면 앞쪽(한 단 어둡게)
    c.HL(5, 7, 6, K('wood', 3)); c.P(5, 7, K('wood', 4)); c.P(10, 7, K('wood', 2))   # 가로살 하나(정면, 살)
    c.HL(5, 8, 6, K('wood', 2))                                           # 가로살이 좌면에 드리운 그늘
    c.HL(5, 9, 6, K('wood', 4))                                           # 가로살 아래로 보이는 좌면 앞끝
    c.HL(5, 10, 6, K('wood', 3)); c.HL(5, 11, 6, K('wood', 2))            # 좌면 앞 테(앞치마)
    c.outline()


@REG.piece('wz-furn-chair-back-left', '오크 의자(등받이 왼쪽)', 1, 1, ['S'], FAM, SP,
           desc='오크 의자 1칸. 등받이가 서쪽(왼쪽)에 있어 동쪽을 보고 앉는다.', rules='탁자의 서쪽에 둔다.',
           tags=['의자'], states='chair', role='prop')
def _chair_left(c):
    chair_legs(c, (4, 11))
    c.R(4, 10, 9, 2, K('wood', 3)); c.HL(4, 10, 9, K('wood', 2)); c.VL(12, 10, 2, K('wood', 2))
    c.R(4, 6, 9, 4, K('wood', 4)); c.HL(4, 9, 9, K('wood', 5)); c.VL(4, 6, 4, K('wood', 5)); c.VL(12, 6, 3, K('wood', 3))
    c.HL(7, 7, 4, K('wood', 3))
    # 등받이(옆면): 왼쪽 세로 널
    c.R(3, 1, 3, 11, K('wood', 3)); c.VL(3, 2, 10, K('wood', 4)); c.VL(5, 2, 10, K('wood', 2))
    c.HL(3, 1, 3, K('wood', 5)); c.R(4, 4, 1, 1, K('wood', 2)); c.R(4, 7, 1, 1, K('wood', 2))
    c.outline()


@REG.piece('wz-furn-chair-back-right', '오크 의자(등받이 오른쪽)', 1, 1, ['S'], FAM, SP,
           desc='오크 의자 1칸. 등받이가 동쪽(오른쪽)에 있어 서쪽을 보고 앉는다.', rules='탁자의 동쪽에 둔다.',
           tags=['의자'], states='chair', role='prop')
def _chair_right(c):
    chair_legs(c, (3, 10))
    c.R(3, 10, 9, 2, K('wood', 3)); c.HL(3, 10, 9, K('wood', 2)); c.VL(11, 10, 2, K('wood', 2))
    c.R(3, 6, 9, 4, K('wood', 4)); c.HL(3, 9, 9, K('wood', 5)); c.VL(3, 6, 4, K('wood', 5)); c.VL(11, 6, 3, K('wood', 3))
    c.HL(5, 7, 4, K('wood', 3))
    c.R(10, 1, 3, 11, K('wood', 3)); c.VL(10, 2, 10, K('wood', 4)); c.VL(12, 2, 10, K('wood', 2))
    c.HL(10, 1, 3, K('wood', 5)); c.R(11, 4, 1, 1, K('wood', 2)); c.R(11, 7, 1, 1, K('wood', 2))
    c.outline()



# ───────────────────────── 수납장 ─────────────────────────
def knob(c, x, y):
    c.P(x, y, K('brass', 4)); c.P(x + 1, y, K('brass', 3)); c.P(x, y + 1, K('brass', 3)); c.P(x + 1, y + 1, K('brass', 2))


def cab_body(c):
    """수납장 몸통(문 제외): 윗면 + 앞면 틀 + 받침."""
    c.R(3, 2, 26, 5, K('wood', 4))                       # 윗면
    c.HL(3, 4, 26, K('wood', 3)); c.HL(6, 3, 7, K('wood', 5)); c.HL(15, 5, 9, K('wood', 3))
    c.VL(3, 2, 5, K('wood', 5)); c.HL(3, 6, 26, K('wood', 5)); c.VL(28, 2, 4, K('wood', 3))
    c.R(3, 7, 26, 22, K('wood', 3))                      # 앞면 틀
    c.HL(3, 7, 26, K('wood', 2))
    c.VL(3, 8, 21, K('wood', 4)); c.VL(28, 7, 22, K('wood', 2))
    c.R(2, 29, 28, 2, K('wood', 2)); c.HL(2, 29, 28, K('wood', 3))     # 받침 몰딩
    c.R(4, 31, 3, 1, K('wood', 1)); c.R(25, 31, 3, 1, K('wood', 1))    # 발


@REG.piece('wz-furn-cabinet-closed', '오크 수납장(닫힘)', 2, 2, ['SS', 'SS'], FAM, SP,
           desc='오크 수납장 2×2칸, 문 닫힘. 윗면 5px, 두 짝 문(안쪽 판넬)과 황동 손잡이. 높이 약 30px.',
           rules='벽 앞에 둔다. 열린 상태는 wz-furn-cabinet-open.', tags=['수납장', '장'], states='cabinet', role='prop')
def _cab_closed(c):
    cab_body(c)
    for dx in (5, 17):
        c.R(dx, 9, 10, 18, K('wood', 4)); c.HL(dx, 9, 10, K('wood', 5)); c.VL(dx, 9, 18, K('wood', 5))
        c.VL(dx + 9, 9, 18, K('wood', 2)); c.HL(dx, 26, 10, K('wood', 2))
        c.R(dx + 2, 11, 6, 5, K('wood', 3)); c.HL(dx + 2, 11, 6, K('wood', 2)); c.VL(dx + 2, 11, 5, K('wood', 2))     # 오목 판넬(윗)
        c.R(dx + 2, 18, 6, 6, K('wood', 3)); c.HL(dx + 2, 18, 6, K('wood', 2)); c.VL(dx + 2, 18, 6, K('wood', 2))
        c.HL(dx + 2, 15, 6, K('wood', 4)); c.HL(dx + 2, 23, 6, K('wood', 4))
    c.VL(15, 8, 20, K('wood', 1)); c.VL(16, 8, 20, K('wood', 2))
    knob(c, 13, 17); knob(c, 18, 17)
    c.outline()


@REG.piece('wz-furn-cabinet-open', '오크 수납장(열림)', 2, 2, ['SS', 'SS'], FAM, SP,
           desc='오크 수납장 2×2칸, 문 열림. 안쪽 선반에 병과 책, 문짝은 양옆으로 젖혀져 보인다.',
           rules='닫힘 상태와 같은 칸·같은 위치. 상호작용으로 바뀐다.', tags=['수납장', '장'], states='cabinet', role='prop')
def _cab_open(c):
    cab_body(c)
    c.R(5, 8, 22, 20, K('wood', 1))                       # 속(어두움)
    c.HL(5, 8, 22, OL); c.VL(5, 8, 20, OL2)
    # 선반 둘
    for sy in (15, 22):
        c.R(5, sy, 22, 2, K('wood', 3)); c.HL(5, sy, 22, K('wood', 4)); c.HL(5, sy + 2, 22, OL2)
    # 윗칸: 병 셋
    for bx, col in ((7, 'water'), (13, 'violet'), (21, 'red')):
        c.R(bx, 10, 3, 5, K(col, 2)); c.VL(bx, 10, 5, K(col, 3)); c.P(bx + 1, 9, K('wood', 4)); c.P(bx, 10, K(col, 4))
    # 가운데칸: 책 더미
    c.R(8, 17, 8, 2, K('red', 2)); c.HL(8, 17, 8, K('red', 3)); c.R(9, 19, 7, 2, K('leaf', 2)); c.HL(9, 19, 7, K('leaf', 3))
    c.R(19, 17, 6, 4, K('linen', 2)); c.HL(19, 17, 6, K('linen', 3))
    # 아랫칸: 바구니·항아리
    c.ellipse(11, 26, 3, 1, K('brass', 2)); c.R(8, 24, 6, 2, K('brass', 3)); c.HL(8, 24, 6, K('brass', 4))
    c.R(20, 24, 4, 3, K('choc', 3)); c.HL(20, 24, 4, K('choc', 4))
    # 젖혀진 문(옆면 얇은 널)
    c.R(0, 9, 3, 19, K('wood', 3)); c.VL(0, 9, 19, K('wood', 4)); c.VL(2, 9, 19, K('wood', 2)); c.HL(0, 9, 3, K('wood', 5))
    c.R(29, 9, 3, 19, K('wood', 3)); c.VL(29, 9, 19, K('wood', 4)); c.VL(31, 9, 19, K('wood', 2)); c.HL(29, 9, 3, K('wood', 5))
    knob(c, 1, 17); c.P(30, 18, K('brass', 3))
    c.outline()


# ───────────────────────── 서가 ─────────────────────────
BOOK_COLS = ['red', 'water', 'leaf', 'violet', 'brass', 'choc', 'linen', 'red', 'leaf', 'water']


def books(c, x, y, w, h, seed=1, density=0):
    """서가 한 칸의 책 등. 높이·색이 다른 등이 가득 서 있고 일부는 기울거나 비어 있다."""
    c.R(x, y, w, h, K('wood', 1))
    bx = x; i = 0
    while bx < x + w:
        wd = 2 + int(hsh(i, seed, 31) * 2)
        if bx + wd > x + w:
            wd = x + w - bx
        # 빈 틈(드물게)
        if wd >= 2 and hsh(i, seed, 41) < 0.10 and density == 0:
            bx += 2; i += 1; continue
        bh = h - 1 - int(hsh(i, seed, 33) * 4)
        col = BOOK_COLS[int(hsh(i, seed, 35) * len(BOOK_COLS))]
        top = y + h - bh
        c.R(bx, top, wd, bh, K(col, 2))
        c.VL(bx, top, bh, K(col, 3))
        if wd >= 3:
            c.VL(bx + wd - 1, top, bh, K(col, 1))
        c.P(bx, top, K(col, 4) if col != 'linen' else K('snow', 3))
        # 등 띠
        by = top + 2 + int(hsh(i, seed, 37) * max(1, bh - 5))
        c.HL(bx, by, wd, K('brass', 4))
        if bh > 8 and hsh(i, seed, 39) > 0.5:
            c.HL(bx, top + bh - 3, wd, K('brass', 3))
        bx += wd; i += 1
    c.HL(x, y, w, OL2)    # 윗 그늘(위 선반 밑)


def shelf_frame(c, W, H, boards):
    """서가 틀: 윗면(위 5줄) + 양옆 기둥 2px + 판 + 받침."""
    c.R(0, 0, W, 5, K('wood', 4)); c.HL(0, 0, W, K('wood', 5)); c.HL(0, 2, W, K('wood', 3)); c.HL(1, 3, W, K('wood', 3))
    c.R(0, 4, W, 2, K('wood', 3)); c.HL(0, 4, W, K('wood', 5))
    c.R(0, 5, 2, H - 5, K('wood', 4)); c.R(W - 2, 5, 2, H - 5, K('wood', 2))
    c.VL(0, 5, H - 5, K('wood', 5)); c.VL(W - 1, 5, H - 5, K('wood', 1))
    for by in boards:
        c.R(2, by, W - 4, 2, K('wood', 3)); c.HL(2, by, W - 4, K('wood', 5)); c.HL(2, by + 1, W - 4, K('wood', 2))
    c.R(0, H - 2, W, 2, K('wood', 2)); c.HL(0, H - 2, W, K('wood', 3))


@REG.piece('wz-furn-bookshelf', '높은 서가', 2, 3, ['CC', 'CC', 'SS'], FAM, SP,
           desc='높은 오크 서가 2×3칸. 위 두 줄(C)은 사람 위로 겹치고 맨 아랫줄(S)만 막힌다. 세 칸에 높이·색이 다른 책 등.',
           rules='북쪽 벽 앞에 붙인다. 위 두 줄은 사람이 겹쳐 지나간다.', tags=['서가', '책장', '책'], role='prop')
def _bookshelf(c):
    shelf_frame(c, 32, 48, (20, 34))
    books(c, 2, 6, 28, 14, 3)
    books(c, 2, 22, 28, 12, 5)
    books(c, 2, 36, 28, 10, 8)
    c.outline()


@REG.piece('wz-furn-bookshelf-low', '낮은 서가', 2, 2, ['SS', 'SS'], FAM, SP,
           desc='낮은 오크 서가 2×2칸. 윗면 6px(위에 소품), 두 칸에 책 등.', rules='벽 앞이나 방 칸막이로.',
           tags=['서가', '책장'], role='prop')
def _bookshelf_low(c):
    c.R(0, 5, 32, 6, K('wood', 4)); c.HL(0, 5, 32, K('wood', 5)); c.HL(0, 7, 32, K('wood', 3)); c.HL(3, 8, 26, K('wood', 3)); c.HL(0, 10, 32, K('wood', 5))
    c.R(0, 11, 2, 20, K('wood', 4)); c.R(30, 11, 2, 20, K('wood', 2)); c.VL(0, 11, 20, K('wood', 5)); c.VL(31, 11, 20, K('wood', 1))
    c.R(2, 11, 28, 2, K('wood', 3)); c.HL(2, 11, 28, K('wood', 2))
    c.R(2, 13, 28, 15, K('wood', 1))
    books(c, 2, 13, 13, 15, 12)
    books(c, 17, 13, 13, 15, 14)
    c.R(15, 12, 2, 17, K('wood', 3)); c.VL(15, 12, 17, K('wood', 4)); c.VL(16, 12, 17, K('wood', 2))
    c.R(0, 28, 32, 3, K('wood', 2)); c.HL(0, 28, 32, K('wood', 3)); c.R(2, 31, 4, 1, K('wood', 1)); c.R(26, 31, 4, 1, K('wood', 1))
    c.outline()


# ───────────────────────── 상자·통 ─────────────────────────
def crate(c, x, y, w, kind=0):
    """w×(w) 정육면체 상자: 윗면 5px + 앞면. kind 0 = 가로판 + X 버팀, 1 = 틈 있는 살 상자."""
    top = 5; fh = w - top
    c.R(x, y, w, top, K('wood', 4)); c.HL(x, y, w, K('wood', 5)); c.VL(x, y, top, K('wood', 5)); c.VL(x + w - 1, y, top, K('wood', 3))
    c.HL(x + 1, y + 2, w - 2, K('wood', 3)); c.HL(x, y + top - 1, w, K('wood', 5))
    fy = y + top
    c.R(x, fy, w, fh, K('wood', 3))
    if kind == 0:
        c.HL(x, fy + 3, w, K('wood', 2)); c.HL(x, fy + 7, w, K('wood', 2))
        c.R(x, fy, 2, fh, K('wood', 2)); c.R(x + w - 2, fy, 2, fh, K('wood', 2)); c.VL(x, fy, fh, K('wood', 4))
        c.line(x + 2, fy + 1, x + w - 3, fy + fh - 2, K('wood', 4))
        c.line(x + 2, fy + fh - 2, x + w - 3, fy + 1, K('wood', 2))
        c.VL(x + w - 1, fy, fh, K('wood', 1))
    else:
        for i in range(0, fh, 3):
            c.HL(x + 2, fy + i, w - 4, K('wood', 4)); c.HL(x + 2, fy + i + 1, w - 4, K('wood', 3))
            c.HL(x + 2, fy + i + 2, w - 4, K('wood', 1))
        c.R(x, fy, 2, fh, K('wood', 4)); c.R(x + w - 2, fy, 2, fh, K('wood', 2)); c.VL(x, fy, fh, K('wood', 5))
        c.VL(x + w - 1, fy, fh, K('wood', 1))
    c.HL(x, fy + fh - 1, w, K('wood', 1))


@REG.piece('wz-furn-crate-a', '나무 상자(버팀)', 1, 1, ['S'], FAM, SP,
           desc='나무 상자 1칸. 윗면 5px, 앞면 널 + X 버팀.', rules='창고·부두·가게 뒷방.', tags=['상자'], role='prop')
def _crate_a(c):
    c.R(2, 15, 12, 1, OL2)
    crate(c, 1, 1, 14, 0)
    c.outline()


@REG.piece('wz-furn-crate-b', '나무 상자(살)', 1, 1, ['S'], FAM, SP,
           desc='나무 상자 1칸. 살 사이가 비어 어둡게 보이는 짐 상자.', rules='창고·부두·가게 뒷방.', tags=['상자'], role='prop')
def _crate_b(c):
    c.R(2, 15, 12, 1, OL2)
    crate(c, 1, 2, 14, 1)
    c.outline()


@REG.piece('wz-furn-crate-stack', '쌓인 상자', 2, 2, ['SS', 'SS'], FAM, SP,
           desc='상자 셋(아래 둘, 위 하나) 2×2칸.', rules='창고 구석.', tags=['상자'], role='prop')
def _crate_stack(c):
    crate(c, 0, 16, 16, 1)
    crate(c, 16, 16, 16, 0)
    crate(c, 8, 4, 16, 0)
    c.R(0, 31, 32, 1, OL2)
    c.outline()


@REG.piece('wz-furn-barrel', '나무 통', 1, 1, ['S'], FAM, SP,
           desc='나무 통 1칸. 윗면 타원, 배가 부른 몸통, 쇠테 둘.', rules='창고·부엌·부두.', tags=['통'], role='prop')
def _barrel(c):
    wid = [11, 12, 13, 14, 14, 14, 14, 14, 14, 13, 12, 11]   # 몸통 폭(y=3..14)
    for i, wd in enumerate(wid):
        y = 3 + i; x = 8 - wd // 2
        c.R(x, y, wd, 1, K('wood', 3))
        c.P(x, y, K('wood', 4)); c.P(x + 1, y, K('wood', 4)); c.P(x + wd - 1, y, K('wood', 1)); c.P(x + wd - 2, y, K('wood', 2))
        for sx in (x + 4, x + 8):
            if sx < x + wd - 1:
                c.P(sx, y, K('wood', 2))     # 널 이음(세로)
    for hy in (5, 12):
        wd = wid[hy - 3]; x = 8 - wd // 2
        c.HL(x, hy, wd, K('iron', 3)); c.HL(x, hy + 1, wd, K('iron', 1)); c.P(x, hy, K('iron', 4)); c.P(x + 1, hy, K('iron', 4))
    c.ellipse(8, 3, 5, 3, K('wood', 5)); c.ellipse(8, 3, 4, 2, K('wood', 4))
    c.HL(5, 3, 6, K('wood', 3)); c.P(7, 2, K('wood', 5)); c.P(9, 4, K('wood', 5))
    c.R(6, 15, 4, 1, OL2)
    c.outline()


# ───────────────────────── 황동 촛대·걸이 등불 ─────────────────────────
@REG.piece('wz-furn-candlestick', '황동 촛대', 1, 1, ['S'], FAM, SP,
           desc='황동 촛대 1칸. 둥근 받침, 가는 기둥, 갈래 세 개 위에 초 세 자루(정적).',
           rules='탁자나 바닥에. 불꽃 애니메이션은 효과 모듈.', tags=['촛대', '황동', '초'], role='prop')
def _candlestick(c):
    c.ellipse(8, 13, 4, 2, K('brass', 3)); c.ellipse(8, 12, 3, 1, K('brass', 4))
    c.HL(5, 14, 7, K('brass', 2))
    c.R(7, 7, 2, 6, K('brass', 3)); c.VL(7, 7, 6, K('brass', 4)); c.VL(8, 7, 6, K('brass', 2))
    c.P(7, 10, K('brass', 5))
    # 갈래
    c.HL(3, 7, 10, K('brass', 3)); c.P(3, 6, K('brass', 3)); c.P(12, 6, K('brass', 3)); c.P(3, 7, K('brass', 4)); c.P(12, 7, K('brass', 2))
    c.HL(4, 8, 8, K('brass', 2))
    for cx, top in ((2, 3), (7, 2), (12, 3)):
        c.R(cx, top, 2, 4, K('linen', 3)); c.VL(cx, top, 4, K('snow', 3)); c.VL(cx + 1, top, 4, K('linen', 1))
        c.HL(cx - 1 if cx > 2 else cx, top + 4, 3 if cx > 2 else 2, K('brass', 4))
        c.P(cx, top - 1, K('fire', 3)); c.P(cx, top - 2, K('fire', 4)); c.P(cx + 1, top - 1, K('fire', 2))
    c.outline()


@REG.piece('wz-furn-lantern-hanging', '걸이 등불', 1, 1, ['C'], FAM, SP,
           desc='걸이 등불 1칸. 쇠사슬에 매달린 황동 등. 유리창이 은은히 빛나는 정적 그림.',
           rules='천장 보·서까래 아래. 사람 머리 위로 겹친다(C).', tags=['등불', '랜턴'], role='prop')
def _lantern(c):
    for yy in range(0, 4):
        c.P(8, yy, K('iron', 3) if yy % 2 else K('iron', 2)); c.P(7 if yy % 2 else 9, yy, K('iron', 1))
    c.R(6, 4, 4, 1, K('brass', 4)); c.R(5, 5, 6, 1, K('brass', 3)); c.R(4, 6, 8, 1, K('brass', 3)); c.HL(4, 6, 8, K('brass', 4))
    c.R(4, 7, 8, 5, K('glow', 3)); c.R(5, 8, 6, 3, K('glow', 4)); c.R(7, 9, 2, 1, K('glow', 4)); c.P(5, 8, K('glow', 4))
    c.VL(4, 7, 5, K('brass', 3)); c.VL(11, 7, 5, K('brass', 1)); c.VL(7, 7, 5, K('brass', 2))
    c.R(4, 12, 8, 1, K('brass', 3)); c.R(5, 13, 6, 1, K('brass', 2)); c.R(7, 14, 2, 1, K('brass', 3))
    c.outline()


# ───────────────────────── 탁상 소품(투명 덧그림 f — 탁자 윗면 y5~14 위에 겹친다) ─────────────────────────
@REG.piece('wz-furn-prop-quill', '깃펜', 1, 1, ['f'], FAM, SP,
           desc='탁상 소품 1칸. 탁자 윗면에 비스듬히 놓인 흰 깃펜, 펜촉 쪽에 잉크 자국.',
           rules='탁자·작업대 윗면(상판 y5~14)에 겹쳐 놓는다. 사람 밑 층.', tags=['깃펜', '탁상'], role='prop')
def _quill(c):
    # 깃털(오른쪽 위) → 대 → 펜촉(왼쪽 아래)
    c.poly([(7, 9), (12, 3), (14, 4), (13, 7), (10, 10)], K('snow', 2))
    c.poly([(8, 9), (12, 4), (13, 5), (12, 8), (10, 9)], K('snow', 3))
    c.line(5, 12, 12, 4, K('linen', 2))
    c.line(7, 9, 12, 4, K('linen', 1)); c.P(13, 7, K('snow', 1)); c.P(11, 9, K('snow', 1))
    c.line(5, 12, 7, 10, K('linen', 3))
    c.P(4, 13, OL); c.P(5, 13, K('iron', 1))
    c.P(3, 14, K('water', 1)); c.P(4, 14, K('water', 2)); c.P(2, 14, K('water', 1))
    c.outline()


@REG.piece('wz-furn-prop-inkwell', '잉크병', 1, 1, ['f'], FAM, SP,
           desc='탁상 소품 1칸. 둥근 검푸른 잉크병과 황동 테두리.',
           rules='탁자 윗면에 겹친다. 깃펜·두루마리와 함께.', tags=['잉크', '탁상'], role='prop')
def _inkwell(c):
    c.ellipse(8, 11, 4, 2, K('water', 1)); c.ellipse(8, 10, 4, 2, K('water', 2))
    c.R(4, 7, 8, 4, K('water', 2)); c.VL(4, 7, 4, K('water', 3)); c.VL(5, 7, 4, K('water', 3)); c.VL(11, 7, 4, K('water', 1))
    c.P(5, 8, K('water', 5)); c.P(5, 9, K('water', 4))
    c.ellipse(8, 7, 3, 1, K('brass', 4)); c.R(5, 6, 6, 1, K('brass', 3)); c.R(6, 5, 4, 1, K('brass', 4))
    c.HL(6, 7, 4, OL)                                   # 병목 안쪽 잉크 어둠
    c.P(7, 6, K('water', 1)); c.P(8, 6, K('iron', 1))
    c.HL(5, 12, 6, K('water', 1))
    c.outline()


@REG.piece('wz-furn-prop-scroll', '양피지 두루마리', 1, 1, ['f'], FAM, SP,
           desc='탁상 소품 1칸. 붉은 끈으로 묶은 말린 양피지.',
           rules='탁자 윗면에 겹친다.', tags=['두루마리', '양피지', '탁상'], role='prop')
def _scroll(c):
    # 눕힌 원통(왼쪽 밝고 오른쪽 어둡다), 양 끝은 둥글게 말린 단면
    c.R(3, 6, 10, 6, K('linen', 3)); c.HL(3, 6, 10, K('snow', 3)); c.HL(3, 7, 10, K('linen', 3))
    c.HL(3, 10, 10, K('linen', 2)); c.HL(3, 11, 10, K('linen', 1))
    c.ellipse(3, 9, 1, 3, K('linen', 2)); c.P(3, 8, K('linen', 1)); c.P(3, 9, K('linen', 0)); c.P(3, 10, K('linen', 1))
    c.ellipse(12, 9, 1, 3, K('linen', 1)); c.P(12, 9, K('linen', 0))
    # 글줄 힌트
    c.HL(5, 8, 2, K('linen', 1)); c.HL(8, 9, 2, K('linen', 1))
    # 끈
    c.R(7, 5, 2, 8, K('red', 2)); c.VL(7, 5, 8, K('red', 3)); c.P(8, 12, K('red', 1))
    c.P(6, 13, K('red', 2)); c.P(9, 13, K('red', 1)); c.P(5, 14, K('red', 1)); c.P(10, 14, K('red', 1))
    c.outline()


@REG.piece('wz-furn-prop-bottles', '유리병 묶음', 1, 1, ['f'], FAM, SP,
           desc='탁상 소품 1칸. 코르크 마개를 한 유리병 세 개(청록·보라·호박색).',
           rules='탁자 윗면에 겹친다.', tags=['병', '유리병', '탁상'], role='prop')
def _bottles(c):
    def bottle(x, y, w, h, m, neck=2):
        c.R(x, y + 3, w, h - 3, K(m, 2)); c.VL(x, y + 3, h - 3, K(m, 3)); c.VL(x + w - 1, y + 3, h - 3, K(m, 1))
        c.R(x + (w - neck) // 2, y, neck, 4, K(m, 2))
        c.P(x + (w - neck) // 2, y, K('choc', 4)); c.P(x + (w - neck) // 2 + 1, y, K('choc', 3))   # 코르크
        c.P(x + 1, y + 4, K('snow', 3))                     # 유리 반짝임
        c.HL(x, y + h - 1, w, K(m, 1))
    bottle(2, 5, 5, 8, 'glow'); bottle(7, 3, 4, 10, 'violet', 2); bottle(10, 7, 4, 6, 'fire')
    c.HL(2, 13, 12, OL2)
    c.outline()


@REG.piece('wz-furn-prop-book-open', '펼친 책', 1, 1, ['f'], FAM, SP,
           desc='탁상 소품 1칸. 펼쳐 놓은 책: 위에서 보이는 양쪽 쪽과 글줄, 아래 갈색 표지 두께.',
           rules='탁자 윗면에 겹친다.', tags=['책', '탁상'], role='prop')
def _book_open(c):
    c.R(2, 5, 12, 8, K('linen', 3)); c.HL(2, 5, 12, K('snow', 3))
    c.R(2, 11, 12, 3, K('red', 2)); c.HL(2, 13, 12, K('red', 1)); c.VL(2, 11, 3, K('red', 3))   # 표지 두께(정면)
    c.HL(2, 11, 12, K('linen', 2))                       # 쪽 두께 선
    c.VL(8, 5, 7, K('linen', 1)); c.VL(7, 6, 5, K('linen', 2)); c.VL(9, 6, 5, K('linen', 2))      # 가운데 접힘
    for yy in (6, 8, 10):
        c.HL(3, yy, 3, K('linen', 1)); c.HL(10, yy, 3, K('linen', 1))
    c.HL(3, 7, 2, K('linen', 1)); c.HL(10, 9, 2, K('linen', 1))
    c.VL(13, 5, 6, K('linen', 2))
    c.outline()


@REG.piece('wz-furn-prop-book-closed', '덮은 책', 1, 1, ['f'], FAM, SP,
           desc='탁상 소품 1칸. 덮어 놓은 두꺼운 보라 표지 책: 윗면 표지, 정면에 쪽 단면, 왼쪽 책등 띠.',
           rules='탁자 윗면에 겹친다.', tags=['책', '탁상'], role='prop')
def _book_closed(c):
    c.R(3, 5, 10, 5, K('violet', 3)); c.HL(3, 5, 10, K('violet', 4)); c.VL(3, 5, 5, K('violet', 4))
    c.VL(12, 5, 5, K('violet', 2))
    c.R(3, 6, 2, 4, K('brass', 3)); c.VL(3, 6, 4, K('brass', 4))                               # 책등 띠
    c.R(7, 6, 4, 3, K('brass', 3)); c.P(8, 7, K('brass', 5)); c.P(9, 7, K('brass', 4)); c.P(8, 6, K('brass', 4))  # 표지 장식
    c.R(3, 10, 10, 3, K('linen', 3)); c.HL(3, 11, 10, K('linen', 2)); c.HL(3, 10, 10, K('violet', 2))
    c.VL(12, 10, 3, K('linen', 1)); c.HL(3, 12, 10, K('violet', 1))
    c.outline()


# ───────────────────────── 커튼 (붉은 천 1×3) ─────────────────────────
def curtain_rod(c, W):
    c.R(1, 0, W - 2, 3, K('brass', 3)); c.HL(1, 0, W - 2, K('brass', 4)); c.HL(1, 2, W - 2, K('brass', 2))
    for fx in (0, W - 3):
        c.R(fx, 0, 3, 3, K('brass', 4)); c.P(fx, 0, K('brass', 5)); c.VL(fx + 2, 1, 2, K('brass', 2))


@REG.piece('wz-furn-curtain-closed', '붉은 커튼(닫힘)', 1, 3, ['C', 'C', 'S'], FAM, SP,
           desc='붉은 천 커튼 1×3칸, 닫힘. 황동 봉 아래 주름 잡힌 붉은 천이 창을 가린다.',
           rules='창 위에 겹친다. 열림 조각과 states=curtain 한 묶음.', tags=['커튼', '붉은'], role='prop', states='curtain')
def _curtain_closed(c):
    W = 16
    curtain_rod(c, W)
    for y in range(3, 46):
        for x in range(1, 15):
            ph = (x - 1) % 4
            t = 3 if ph == 0 else 2 if ph in (1, 2) else 1
            c.P(x, y, K('red', t))
    # 윗부분 주름 모음(밸런스)
    c.R(1, 3, 14, 3, K('red', 2)); c.HL(1, 3, 14, K('red', 3)); c.HL(1, 5, 14, K('red', 1))
    for x in range(2, 15, 4):
        c.VL(x, 3, 3, K('red', 3))
    # 아랫단 물결
    for x in range(1, 15):
        c.P(x, 45 + (1 if (x // 2) % 2 else 0), K('red', 1))
    c.HL(1, 44, 14, K('red', 1))
    c.R(1, 46, 14, 1, CLEAR)
    for x in range(1, 15):
        if (x // 2) % 2: c.P(x, 45, K('red', 1)); c.P(x, 46, K('red', 1))
        else: c.P(x, 45, K('red', 2))
    c.R(1, 47, 14, 1, CLEAR)
    # 천 가운데 여밈선
    c.VL(8, 6, 40, K('red', 1)); c.VL(7, 6, 40, K('red', 3))
    c.outline()


@REG.piece('wz-furn-curtain-open', '붉은 커튼(열림)', 1, 3, ['C', 'C', 'C'], FAM, SP,
           desc='붉은 천 커튼 1×3칸, 열림. 두 폭이 양쪽으로 모여 황동 끈에 묶이고 가운데는 비어 창이 보인다.',
           rules='창 위에 겹친다. 닫힘 조각과 states=curtain 한 묶음.', tags=['커튼', '붉은'], role='prop', states='curtain')
def _curtain_open(c):
    W = 16
    curtain_rod(c, W)
    def width_at(y):
        if y < 10: return 5
        if y < 27: return 4
        return 4 + min(2, (y - 27) // 6)       # 끈 아래로 살짝 퍼진다
    def drape(left):
        for y in range(3, 47):
            w = width_at(y)
            for i in range(w):
                x = 1 + i if left else 14 - i
                j = i if left else w - 1 - i   # 왼쪽이 밝다
                t = 3 if j % 3 == 0 else 2 if j % 3 == 1 else 1
                if i == w - 1 and y > 6: t = 1  # 안쪽 가장자리 어둡게
                c.P(x, y, K('red', t))
        # 아랫단
        for i in range(width_at(46)):
            x = 1 + i if left else 14 - i
            c.P(x, 46, K('red', 1))
    drape(True)
    drape(False)
    # 윗부분 주름 모음(밸런스)
    c.R(1, 3, 14, 3, K('red', 2)); c.HL(1, 3, 14, K('red', 3)); c.HL(1, 5, 14, K('red', 1))
    for x in range(2, 15, 4): c.VL(x, 3, 3, K('red', 3))
    c.R(6, 6, 4, 3, CLEAR)
    # 끈
    for sx in (1, 11):
        c.R(sx, 27, 4, 2, K('brass', 3)); c.HL(sx, 27, 4, K('brass', 4)); c.HL(sx, 28, 4, K('brass', 2))
    c.outline()


# ───────────────────────── 기숙사 깃발 벽걸이 (1×2) ─────────────────────────
EMBLEMS = {
    'lion': [        # 갈기 두른 사자 얼굴
        '..#.##.#..',
        '.#.####.#.',
        '.########.',
        '##########',
        '###o##o###',
        '##########',
        '.###..###.',
        '..##oo##..',
        '..#.##.#..',
        '...#..#...',
    ],
    'snake': [       # 머리(눈·혀)가 위, 불균등한 S 몸통, 가는 꼬리
        '..####....',
        '##o####...',
        '.#####....',
        '...###....',
        '...#####..',
        '.....####.',
        '.....####.',
        '...#####..',
        '..#####...',
        '.####.....',
        '.###......',
        '..#.......',
    ],
    'eagle': [       # 날개를 편 독수리
        '#........#',
        '##..##..##',
        '###.##.###',
        '####oo####',
        '##########',
        '.########.',
        '..######..',
        '...####...',
        '....##....',
        '...#..#...',
    ],
    'badger': [      # 정면 오소리 얼굴: 귀·눈줄 검정, 가운데 밝은 줄, 코
        '##......##',
        '###....###',
        '.###..###.',
        '.###..###.',
        '.#o#..#o#.',
        '.###..###.',
        '..##..##..',
        '...#..#...',
        '....##....',
    ],
}


def banner(c, house, emb, dark_emblem=False):
    R_ = 'house_' + house
    if dark_emblem: cloth, fold, em = K(R_, 3), K(R_, 2), K(R_, 1)
    else: cloth, fold, em = K(R_, 2), K(R_, 1), K(R_, 3)
    trim = K(R_, 1) if dark_emblem else K(R_, 3)
    # 봉 + 끝 장식
    c.R(0, 0, 16, 2, K('brass', 3)); c.HL(0, 0, 16, K('brass', 4)); c.HL(0, 1, 16, K('brass', 2))
    for fx in (0, 14): c.R(fx, 0, 2, 3, K('brass', 4)); c.P(fx, 0, K('brass', 5)); c.P(fx + 1, 2, K('brass', 2))
    # 천
    c.R(2, 2, 12, 29, cloth)
    for y in range(2, 31):
        c.P(2, y, trim if False else cloth)
    c.VL(6, 4, 22, fold); c.VL(10, 4, 22, fold); c.VL(13, 3, 28, fold); c.VL(3, 3, 26, cloth)
    c.R(2, 2, 12, 2, fold); c.HL(2, 2, 12, cloth)                               # 봉에 말린 윗단
    for x in (4, 8, 12): c.P(x, 3, cloth)
    # 끝단 장식 줄
    c.HL(3, 5, 10, trim); c.HL(3, 24, 10, trim)
    # 제비꼬리
    for y in range(26, 31):
        k = (y - 24) // 2
        for x in range(8 - k, 8 + k): c.P(x, y, CLEAR)
    for y in (29, 30):
        for x in range(2, 14): pass
    # 문양
    rows = EMBLEMS[emb]; x0 = 3; y0 = 8 + (10 - len(rows)) // 2 + 1
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch == '#': c.P(x0 + i, y0 + j, em)
            elif ch == 'o': c.P(x0 + i, y0 + j, cloth)
    c.outline()


for _h, _e, _n, _d in (('g', 'lion', '그리핀도르(붉은+금, 사자)', False), ('s', 'snake', '슬리데린(녹+은, 뱀)', False),
                       ('r', 'eagle', '래번클로(청+청동, 독수리)', False), ('h', 'badger', '후플푸프(황+흑, 오소리)', True)):
    def _mk(h=_h, e=_e, d=_d):
        def fn(c): banner(c, h, e, d)
        return fn
    REG.piece('wz-furn-banner-' + _e, '기숙사 깃발 ' + _n, 1, 2, ['C', 'C'], FAM, SP,
              desc='기숙사 깃발 벽걸이 1×2칸. 황동 봉에 걸린 천 위에 ' + _n + ' 단순 실루엣, 아랫단은 제비꼬리.',
              rules='벽 앞(윗 2행 C)에 건다. 사람 머리 위로 지나가며 가리지 않는다.', tags=['깃발', '기숙사', _e], role='prop')(_mk())


# ───────────────────────── 융단 3×2 (바닥 덧그림 f) ─────────────────────────
@REG.piece('wz-furn-rug', '붉은 융단', 3, 2, ['fff', 'fff'], FAM, SP,
           desc='바닥에 까는 3×2칸 융단. 붉은 바탕에 보라 마름모 격자, 황동 테두리와 가운데 둥근 문양, 양 끝 린넨 술.',
           rules='바닥 위(사람 밑)에 깐다. 탁자·의자 아래에 둔다.', tags=['융단', '카펫'], role='prop')
def _rug(c):
    W, H = 48, 32
    # 술(짧은 쪽, 좌우)
    for y in range(4, 28):
        if y % 2 == 0:
            c.P(0, y, K('linen', 2)); c.P(1, y, K('linen', 3)); c.P(46, y, K('linen', 3)); c.P(47, y, K('linen', 2))
        else:
            c.P(1, y, K('linen', 2)); c.P(46, y, K('linen', 2))
    # 본체
    c.R(2, 2, 44, 28, K('brass', 3))                      # 황동 테두리 띠
    c.R(4, 4, 40, 24, K('red', 1))                        # 안쪽 어두운 띠
    c.R(5, 5, 38, 22, K('red', 2))                        # 바탕
    c.HL(2, 2, 44, K('brass', 4)); c.HL(2, 29, 44, K('brass', 2)); c.VL(2, 2, 28, K('brass', 4)); c.VL(45, 2, 28, K('brass', 2))
    # 마름모 격자
    for gy in range(5, 27):
        for gx in range(5, 43):
            u = (gx + gy) % 8; v = (gx - gy) % 8
            if u == 0 or v == 0: c.P(gx, gy, K('violet', 2))
    for gy in range(5, 27):
        for gx in range(5, 43):
            if ((gx + gy) % 8 == 0) and ((gx - gy) % 8 == 0): c.P(gx, gy, K('brass', 3))
    # 가운데 메달리온
    c.ellipse(24, 16, 9, 6, K('red', 1)); c.ellipse(24, 16, 8, 5, K('brass', 3)); c.ellipse(24, 16, 6, 4, K('red', 2))
    c.ellipse(24, 16, 3, 2, K('violet', 3)); c.P(24, 16, K('brass', 4)); c.P(23, 16, K('brass', 3)); c.P(25, 16, K('brass', 3))
    c.HL(18, 13, 4, K('brass', 4))
    # 테두리 어두운 선
    c.outline_rect(2, 2, 44, 28, K('red', 0))
    c.outline()


# ───────────────────────── 벽난로 3×3 (돌, 불 없음) ─────────────────────────
@REG.piece('wz-furn-fireplace', '돌 벽난로', 3, 3, ['CCC', 'SSS', 'SSS'], FAM, SP,
           desc='3×3칸 돌 벽난로, 불 없는 정적. 굴뚝 몸통 위로 오크 벽난로 선반, 가운데 검은 아궁이에 장작과 철 받침, 앞 돌 바닥판.',
           rules='북벽에 붙인다. 불꽃·빛은 효과 조각이 덧그린다.', tags=['벽난로', '돌'], role='prop')
def _fireplace(c):
    # 굴뚝 몸통
    c.stone_blocks(10, 0, 28, 14, 'stone', 3, row_h=(5, 5), seed=4)
    c.VL(10, 0, 14, K('stone', 4)); c.VL(37, 0, 14, K('stone', 2))
    # 벽난로 선반(오크, 윗면+앞면)
    c.R(5, 13, 38, 4, K('wood', 5)); c.HL(5, 13, 38, K('wood', 5)); c.HL(5, 14, 38, K('wood', 4))
    c.R(5, 17, 38, 3, K('wood', 3)); c.HL(5, 17, 38, K('wood', 4)); c.HL(5, 19, 38, K('wood', 2))
    for x in range(8, 43, 7): c.VL(x, 17, 3, K('wood', 2))
    # 돌 본체
    c.stone_blocks(6, 20, 36, 20, 'stone', 3, row_h=(5, 5), seed=7)
    c.VL(6, 20, 20, K('stone', 4)); c.VL(41, 20, 20, K('stone', 2))
    # 아궁이(어두운 안쪽, 왼쪽 벽 약간 밝음)
    c.R(14, 24, 20, 16, OL)
    c.R(15, 25, 18, 14, K('night', 0)); c.R(15, 25, 3, 14, K('stone', 1)); c.R(33, 25, 1, 14, OL)
    c.HL(15, 25, 18, K('stone', 0))
    # 아치 상인방(돌)
    c.R(13, 22, 22, 2, K('stone', 4)); c.HL(13, 22, 22, K('stone', 5)); c.HL(13, 23, 22, K('stone', 3))
    c.VL(13, 22, 18, K('stone', 4)); c.VL(34, 22, 18, K('stone', 2))
    # 재와 장작, 철 받침
    c.R(15, 37, 18, 3, K('stone', 1)); c.HL(15, 37, 18, K('stone', 2))
    c.line(17, 37, 29, 33, K('wood', 2)); c.line(17, 36, 29, 32, K('wood', 3)); c.line(18, 35, 28, 35, K('wood', 2))
    c.line(30, 37, 19, 33, K('wood', 3)); c.line(30, 36, 19, 32, K('wood', 4))
    c.P(29, 33, K('wood', 5)); c.P(19, 33, K('wood', 5)); c.P(28, 32, K('wood', 5))
    for ax in (16, 31):
        c.R(ax, 33, 2, 5, K('iron', 2)); c.P(ax, 33, K('iron', 4)); c.P(ax + 1, 38, K('iron', 1))
    c.P(23, 37, K('stone', 3)); c.P(25, 38, K('stone', 4)); c.P(21, 38, K('stone', 3))
    # 앞 돌 바닥판(윗면+앞면)
    c.R(2, 40, 44, 4, K('stone', 5)); c.HL(2, 40, 44, K('stone', 5)); c.HL(2, 41, 44, K('stone', 4))
    for x in range(8, 45, 9): c.VL(x, 41, 3, K('stone', 3))
    c.R(2, 44, 44, 4, K('stone', 3)); c.HL(2, 44, 44, K('stone', 4)); c.HL(2, 47, 44, K('stone', 1))
    for x in range(8, 45, 9): c.VL(x, 44, 4, K('stone', 2))
    c.VL(2, 40, 8, K('stone', 5)); c.VL(45, 40, 8, K('stone', 2))
    c.outline()


# ───────────────────────── 예제: 12×9 휴게실 ─────────────────────────
def _common_room():
    W = 'wz-castle-'
    pl = []
    pl += [(W + 'wall-nw', 0, 0), (W + 'wall-ne', 11, 0)]
    for x in range(1, 11):
        pl.append((W + ('wall-n-window' if x in (1, 10) else 'wall-n'), x, 0))
    for y in (4, 5, 6):
        pl += [(W + 'wall-w', 0, y), (W + 'wall-e', 11, y)]
    pl += [(W + 'wall-sw', 0, 7), (W + 'wall-se', 11, 7)]
    for x in range(1, 11): pl.append((W + 'wall-s', x, 7))
    # 바닥 덧그림
    pl.append(('wz-furn-rug', 3, 5))
    # 벽 걸이·큰 가구(뒤→앞)
    pl += [('wz-furn-curtain-open', 1, 1), ('wz-furn-curtain-closed', 10, 1),
           ('wz-furn-bookshelf', 2, 1), ('wz-furn-banner-lion', 4, 1), ('wz-furn-fireplace', 5, 1),
           ('wz-furn-banner-eagle', 8, 1), ('wz-furn-bookshelf-low', 8, 3),
           ('wz-furn-table-small', 4, 5), ('wz-furn-chair-back-left', 3, 5), ('wz-furn-chair-back-right', 6, 5),
           ('wz-furn-crate-stack', 9, 5), ('wz-furn-barrel', 1, 6), ('wz-furn-candlestick', 2, 4),
           ('wz-furn-lantern-hanging', 9, 2),
           ('wz-furn-prop-scroll', 4, 5), ('wz-furn-prop-inkwell', 5, 5), ('wz-furn-prop-quill', 5, 5)]
    return pl


REG.example('wz-furn-example-common', '기숙사 휴게실', 'shared', 12, 9, 'wz-castle-floor-flag', place=_common_room())


if __name__ == '__main__':
    sys.exit(1 if run_module(MODULE) else 0)
