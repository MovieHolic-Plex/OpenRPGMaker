"""마법약 교실 보강(potions_extra): native 에 없는 아치·창·연결문·후드·젖은 바닥·시약 자국·가열 솥·도구·수조·진열대·램프.
  python3 scripts/content/wizarding/pieces/potions_extra.py
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import numpy as np  # noqa: E402
from wzlib import REG, Cv, K, OL, OL2, run_module  # noqa: E402

MODULE = 'potions_extra'
SP = 'potions'


def hsh(x, y, s=0):
    return (((x * 73856093) ^ (y * 19349663) ^ (s * 83492791)) & 0xffff) / 65536.0


# ── 마스크 도우미 ──
def pointed(w, h, xl, xr, ys):
    """첨두(정삼각 아치) 열린 곳: ys 아래는 xl..xr 직선, 위는 두 원의 교집합."""
    m = np.zeros((h, w), bool)
    W = xr - xl + 1
    for y in range(h):
        for x in range(w):
            if y >= ys:
                m[y, x] = xl <= x <= xr
            else:
                d1 = (x + .5 - xl) ** 2 + (y + .5 - ys) ** 2
                d2 = (x + .5 - (xr + 1)) ** 2 + (y + .5 - ys) ** 2
                m[y, x] = d1 < W * W and d2 < W * W and xl <= x <= xr
    return m


def dil(m, n=1):
    for _ in range(n):
        p = np.pad(m, 1)
        m = m | p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]
    return m


def fill(c, m, col, ox=0, oy=0):
    for y, x in np.argwhere(m):
        c.P(x + ox, y + oy, col)


def wall(c, x, y, w, h, seed=1, cap=False):
    """native 석벽 결: 돌 블록 + (cap 이면) 위쪽 얇은 머릿돌."""
    c.stone_blocks(x, y, w, h, 'stone', 3, (5, 6), seed)
    if cap:
        c.HL(x, y, w, K('stone', 5)); c.HL(x, y + 1, w, K('stone', 4)); c.HL(x, y + 2, w, K('stone', 4))
        c.HL(x, y + 3, w, K('stone', 2))


# ═══ 건축 ═══
@REG.piece('wz-pot-vault-arch-2x4', '지하 볼트 아치(열린 통과 2×4)', 2, 4, ['SS', 'SS', 'CC', 'CC'], 'architecture', SP,
           desc='마법약 교실 지하 석조 벽에 뚫린 폭 2칸 첨두 아치 통과. 아치 아래는 바닥이 보이고 위 고리돌만 사람 위로 그려진다.',
           rules='벽 줄에 놓는다. 아래 두 줄(C)은 걸어 지나가고 위 두 줄은 벽이다.', tags=['아치', '통과', '지하'], role='wall')
def _arch2(c):
    wall(c, 0, 0, 32, 64, 3, cap=True)
    op = pointed(32, 64, 6, 25, 38)
    ringm = dil(op, 3) & ~op
    fill(c, ringm, K('stone', 4))
    # 고리돌 이음(방사선) — 아치 선을 따라 일정 간격
    for (x, y) in np.argwhere(ringm)[:, ::-1]:
        if (int(x) * 3 + int(y) * 2) % 7 == 0 and y < 40: c.P(x, y, K('stone', 2))
    # 안쪽 밝은 모서리(빛은 왼쪽 위)
    inner = dil(op, 1) & ~op
    for (x, y) in np.argwhere(inner)[:, ::-1]:
        c.P(x, y, K('stone', 5) if (x < 16 and y < 44) else K('stone', 2))
    outer = dil(op, 4) & ~dil(op, 3)
    fill(c, outer, K('stone', 1))
    # 열린 곳: 위쪽은 안쪽 어둠, 아래(걷는 높이)는 투명
    for y in range(64):
        for x in range(32):
            if not op[y, x]: continue
            if y < 40:
                # 안쪽 뒷벽: 어두운 돌 쌓기(줄눈) + 위로 갈수록 어둡게, 왼쪽 안쪽에 빛 한 단
                row = (y - 8) // 6
                seam = ((y - 8) % 6 == 0) or ((x + (row % 2) * 5) % 10 == 0)
                t = 1 if y < 26 else 2
                if seam: t = 0 if y < 30 else 1
                elif hsh(x, y, 9) < .08: t = min(3, t + 1)
                if x < 9 and y > 20 and not seam: t = min(3, t + 1)
                c.P(x, y, K('night', t))
            else:
                c.P(x, y, (0, 0, 0, 0))
    # 쐐기돌
    c.R(14, 17, 4, 5, K('stone', 5)); c.HL(14, 17, 4, K('stone', 5)); c.VL(14, 17, 5, K('stone', 5)); c.VL(17, 17, 5, K('stone', 3))
    c.HL(14, 21, 4, K('stone', 2))
    # 양쪽 기둥 밑동
    for x0, x1 in ((0, 6), (26, 32)):
        c.R(x0, 58, x1 - x0, 6, K('stone', 2)); c.HL(x0, 58, x1 - x0, K('stone', 4)); c.HL(x0, 63, x1 - x0, K('stone', 1))
    c.R(5, 58, 1, 6, K('stone', 1)); c.R(26, 58, 1, 6, K('stone', 1))
    c.VL(0, 0, 64, K('stone', 1)); c.VL(31, 0, 64, K('stone', 1))
    # 안쪽 아치 아래 그림자 한 줄(바닥 쪽으로 번짐 없이)
    for x in range(6, 26):
        if (x // 2) % 2 == 0: c.P(x, 40, K('night', 0))


@REG.piece('wz-pot-vault-arch-pillar', '지하 볼트 벽 기둥 아치(1×4)', 1, 4, ['S', 'S', 'S', 'S'], 'architecture', SP,
           desc='벽에 붙은 기둥에서 양쪽으로 갈비 아치가 뻗는 1칸 벽 기둥. 아치 통과 사이사이 벽에 세운다.',
           rules='벽 줄 위. 막힘.', tags=['아치', '기둥', '지하'], role='wall')
def _archp(c):
    wall(c, 0, 0, 16, 64, 5, cap=True)
    # 기둥: 가운데 8폭, 왼 밝음 오른 어두움
    for y in range(12, 64):
        for x in range(4, 12):
            t = 4 if x < 6 else 3 if x < 8 else 2 if x < 10 else 1
            c.P(x, y, K('stone', t))
        if y % 9 == 5:
            c.HL(4, y, 8, K('stone', 2))
    c.VL(3, 12, 52, K('stone', 1)); c.VL(12, 12, 52, K('stone', 1))
    # 기둥머리(2단 확장)
    c.R(2, 9, 12, 3, K('stone', 4)); c.HL(2, 9, 12, K('stone', 5)); c.HL(2, 11, 12, K('stone', 2))
    c.R(3, 12, 10, 2, K('stone', 3)); c.HL(3, 13, 10, K('stone', 1))
    c.VL(1, 9, 3, K('stone', 1)); c.VL(14, 9, 3, K('stone', 1))
    # 갈비 아치: 머리에서 위로 부채꼴
    for i in range(8):
        y = 8 - i
        xl = 2 - (i * 3) // 5; xr = 13 + (i * 3) // 5
        c.P(max(0, xl), y, K('stone', 5)); c.P(min(15, xr), y, K('stone', 2))
    c.R(5, 0, 6, 9, K('stone', 4)); c.VL(5, 0, 9, K('stone', 5)); c.VL(10, 0, 9, K('stone', 2))
    c.VL(4, 0, 9, K('stone', 1)); c.VL(11, 0, 9, K('stone', 1))
    c.R(0, 58, 16, 6, K('stone', 2)); c.HL(0, 58, 16, K('stone', 4)); c.HL(0, 63, 16, K('stone', 1))
    c.R(3, 54, 10, 4, K('stone', 3)); c.HL(3, 54, 10, K('stone', 5)); c.HL(3, 57, 10, K('stone', 1))
    c.VL(0, 0, 64, K('stone', 1)); c.VL(15, 0, 64, K('stone', 1))


@REG.piece('wz-pot-window-low', '낮은 납살 창(벽 위쪽 1×2)', 1, 2, ['S', 'S'], 'architecture', SP,
           desc='지하 교실 천장 가까이에 난 낮고 납작한 첨두 납살 창. 마름모 납살과 돌 문턱.', rules='벽 줄 위쪽 두 칸.', tags=['창', '납살'], role='wall')
def _win(c):
    wall(c, 0, 0, 16, 32, 7, cap=True)
    op = pointed(16, 32, 3, 12, 14)
    # 돌 문틀
    fill(c, dil(op, 2) & ~op, K('stone', 4))
    for (x, y) in np.argwhere(dil(op, 2) & ~op)[:, ::-1]:
        if x > 8 or y > 18: c.P(x, y, K('stone', 2))
    fill(c, dil(op, 3) & ~dil(op, 2), K('stone', 1))
    # 유리: 두 톤 + 납살 마름모
    for (x, y) in np.argwhere(op)[:, ::-1]:
        t = 2 if (x + y) % 11 < 6 else 1
        c.P(x, y, K('water', t))
        if (x + y) % 5 == 0 or (x - y) % 5 == 0: c.P(x, y, OL2)
    # 대각 반사 하이라이트 두 가닥
    for k in range(5): c.P(4 + k, 22 - k, K('water', 4)) if op[22 - k, 4 + k] and (4 + k + 22 - k) % 5 else None
    c.P(5, 21, K('water', 3)); c.P(6, 20, K('water', 3))
    # 문턱(앞으로 2px 나옴)
    c.R(1, 25, 14, 3, K('stone', 5)); c.HL(1, 25, 14, K('stone', 5)); c.R(1, 27, 14, 1, K('stone', 2)); c.HL(2, 28, 12, K('stone', 1))
    c.VL(1, 25, 3, K('stone', 3)); c.VL(14, 25, 3, K('stone', 2))
    c.VL(0, 0, 32, K('stone', 1)); c.VL(15, 0, 32, K('stone', 1))


# 연결문: 2×4, 평 인방(윗면 보임)·돌 문설주·오크 판문. 열린 곳 x6..25(20px) × y24..59(36px). 세 상태 같은 틀.
DX0, DX1, DY0, DY1 = 6, 25, 24, 59


def _door_base(c, state):
    wall(c, 0, 0, 32, 64, 11, cap=True)
    # 문설주(돌 블록, 왼쪽 밝음·오른쪽 어두움)
    for jx, lit in ((3, True), (26, False)):
        c.R(jx, 22, 3, 38, K('stone', 4 if lit else 3))
        for yb in (29, 37, 44, 52):
            c.HL(jx, yb, 3, K('stone', 2))
        c.VL(jx, 22, 38, K('stone', 5 if lit else 4))
        c.VL(jx + 2, 22, 38, K('stone', 3 if lit else 2))
    c.VL(2, 22, 38, K('stone', 1)); c.VL(29, 22, 38, K('stone', 1))
    # 인방: 앞으로 나온 돌 들보 — 윗면 3px(밝음) + 정면 6px, 블록 이음 2곳
    c.HL(1, 12, 30, K('stone', 1))
    c.R(2, 13, 28, 2, K('stone', 5)); c.HL(2, 15, 28, K('stone', 4))
    c.R(2, 16, 28, 6, K('stone', 3)); c.HL(2, 16, 28, K('stone', 4))
    c.HL(2, 21, 28, K('stone', 2))
    for sx in (11, 20):
        c.VL(sx, 16, 6, K('stone', 2)); c.P(sx, 14, K('stone', 4))
    c.VL(2, 13, 9, K('stone', 5)); c.VL(29, 13, 9, K('stone', 2))
    c.VL(1, 12, 11, K('stone', 1)); c.VL(30, 12, 11, K('stone', 1))
    c.HL(1, 22, 30, K('stone', 1))
    c.HL(2, 23, 28, K('stone', 1))
    c.P(6, 18, K('stone', 2)); c.P(24, 19, K('stone', 2))   # 마모점
    # 문턱: 윗면 2px + 정면 1px + 윤곽
    c.R(1, 60, 30, 2, K('stone', 5)); c.HL(1, 61, 30, K('stone', 4)); c.HL(1, 62, 30, K('stone', 3)); c.HL(0, 63, 32, K('stone', 1))
    c.VL(0, 60, 4, K('stone', 1)); c.VL(31, 60, 4, K('stone', 1))
    c.P(9, 60, K('stone', 4)); c.P(21, 61, K('stone', 3))


def _straps(c, xs, y):
    for x in xs:
        c.P(x, y, K('iron', 3)); c.P(x, y + 1, K('iron', 1))


def _leaf(c, lock):
    for y in range(DY0, DY1 + 1):
        for x in range(DX0, DX1 + 1):
            k = (x - DX0) % 4
            t = 4 if k == 0 else 3
            if k == 3: t = 1
            if k in (1, 2) and hsh(x // 1, y // 5, 7) < .18: t = 2   # 긴 결(5px 세로 줄)
            c.P(x, y, K('wood', t))
    c.VL(DX0, DY0, DY1 - DY0 + 1, K('wood', 1))                     # 문설주 그늘
    c.R(DX0, DY0, DX1 - DX0 + 1, 2, K('wood', 1))                    # 인방 그늘
    c.HL(DX0, DY1, DX1 - DX0 + 1, K('wood', 1))
    for by in (29, 52):                                              # 쇠띠 + 못
        _straps(c, range(DX0, DX1 + 1), by)
        for x in range(DX0 + 2, DX1, 4): c.P(x, by, K('iron', 4))
    # 쇠창살 들창(지하실 문)
    c.R(13, 34, 6, 6, K('iron', 2)); c.R(14, 35, 4, 4, K('ink', 0))
    c.HL(13, 34, 6, K('iron', 3)); c.HL(13, 39, 6, K('iron', 1))
    for bx in (15, 16): c.VL(bx, 35, 4, K('iron', 3)); c.P(bx, 35, K('iron', 4))
    # 황동 고리 손잡이 + 열쇠 구멍
    c.P(22, 44, K('brass', 2)); c.P(21, 45, K('brass', 4)); c.P(23, 45, K('brass', 3))
    c.P(21, 46, K('brass', 4)); c.P(23, 46, K('brass', 2)); c.P(22, 47, K('brass', 3)); c.P(22, 45, K('brass', 5))
    c.VL(22, 49, 2, K('ink', 0))
    if lock:
        for x in range(2, 30):
            c.P(x, 41, K('iron', 4)); c.P(x, 42, K('iron', 3)); c.P(x, 43, K('iron', 1))
        for bx in (3, 27):                                           # 문설주 걸쇠
            c.R(bx, 40, 2, 5, K('iron', 2)); c.HL(bx, 40, 2, K('iron', 4)); c.P(bx, 44, K('iron', 1))
        c.HL(14, 40, 4, K('iron', 4)); c.P(13, 41, K('iron', 3)); c.P(18, 41, K('iron', 3))   # 자물쇠 고리
        c.R(13, 44, 6, 6, K('brass', 3)); c.HL(13, 44, 6, K('brass', 5)); c.VL(13, 45, 5, K('brass', 4))
        c.VL(18, 45, 5, K('brass', 2)); c.HL(13, 49, 6, K('brass', 1))
        c.P(15, 46, K('ink', 0)); c.VL(15, 47, 2, K('ink', 0))
        c.HL(13, 50, 6, K('wood', 1))


@REG.piece('wz-pot-door-closed', '약실 연결문(닫힘)', 2, 4, ['SS', 'SS', 'SS', 'SS'], 'architecture', SP,
           desc='돌 인방(윗면 보임)과 문설주에 끼운 지하 약실 오크 판문. 쇠띠 두 줄·쇠창살 들창·황동 고리. 닫힘.',
           rules='북벽 줄에 2칸으로 끼운다(0행은 벽 윗면). 열림/잠김과 같은 칸 크기·같은 기준점. 문 열린 곳 20×36px.',
           tags=['문', '연결'], role='wall', states='pot-door')
def _dc(c):
    _door_base(c, 0); _leaf(c, False)


@REG.piece('wz-pot-door-open', '약실 연결문(열림)', 2, 4, ['SS', 'SS', 'CC', 'FF'], 'architecture', SP,
           desc='같은 문틀에서 문짝이 안쪽 왼쪽으로 젖혀져 저편 어두운 방과 바닥 포석이 보인다. 아래 칸으로 드나든다.',
           rules='아래 줄(F)이 드나드는 칸, 그 위 줄(C)은 사람 머리 위로 그려진다.',
           tags=['문', '연결', '열림'], role='wall', states='pot-door')
def _do(c):
    _door_base(c, 1)
    # 저편 방: 어둠 + 희미한 돌 이음
    for y in range(DY0, DY1 + 1):
        for x in range(DX0, DX1 + 1):
            t = 0 if y < 27 else 1
            if y >= 27 and ((y - 27) % 7 == 0 or (x + ((y - 27) // 7) * 5) % 9 == 0): t = 0
            c.P(x, y, K('night', t))
    # 저편 바닥 포석(멀수록 어둡게) + 이쪽 방에서 새어 든 빛
    c.HL(DX0, 48, DX1 - DX0 + 1, K('ink', 0))
    for y in range(49, DY1 + 1):
        for x in range(DX0, DX1 + 1):
            t = 1 if y < 53 else 2
            if 9 <= x <= 23 and y >= 55: t = 3
            if y in (52, 56) or (x + (3 if y > 52 else 0)) % 7 == 0: t = max(0, t - 1)
            c.P(x, y, K('stone', t))
    # 젖혀진 문짝(안쪽으로 열려 가장자리 4px, 바깥 끝이 원근으로 위로 들림)
    for i in range(4):
        x = DX0 + i
        top, bot = DY0 + 2, DY1 - i
        tone = (1, 2, 3, 5)[i]
        for y in range(top, bot + 1): c.P(x, y, K('wood', tone))
        if i == 1:
            for y in range(top, bot + 1, 6): c.P(x, y, K('wood', 1))
        for by in (29, 52):
            if by - i >= top: c.P(x, by - i, K('iron', 3 if i < 3 else 4))
    c.R(DX0, DY0, DX1 - DX0 + 1, 2, K('ink', 0))                     # 인방 그늘
    c.VL(DX1, DY0, 24, K('stone', 1))                                 # 오른 문설주 안쪽 면


@REG.piece('wz-pot-door-locked', '약실 연결문(잠김)', 2, 4, ['SS', 'SS', 'SS', 'SS'], 'architecture', SP,
           desc='닫힌 문 위로 문설주 걸쇠에 건 쇠 빗장과 황동 자물쇠. 잠김.', rules='벽 줄. 닫힘·열림과 같은 크기·기준점.',
           tags=['문', '연결', '잠김'], role='wall', states='pot-door')
def _dl(c):
    _door_base(c, 2); _leaf(c, True)


@REG.piece('wz-pot-hood', '구리 배기 후드(2×3)', 2, 3, ['CC', 'CC', 'CC'], 'architecture', SP,
           desc='가열 솥·작업대 위 벽에 매단 구리 배기 후드. 위로 황동 연통이 올라간다. 사람이 아래를 지나면 위로 그려진다.',
           rules='C 전부 — 아래를 지나다닌다.', tags=['후드', '구리', '연통'], role='prop')
def _hood(c):
    # 연통(좁은 사각 관, 위로 천장까지)
    c.R(11, 0, 10, 14, K('brass', 3))
    for y in range(0, 14):
        c.P(11, y, K('brass', 5)); c.P(12, y, K('brass', 4)); c.P(19, y, K('brass', 2)); c.P(20, y, K('brass', 1))
    c.VL(10, 0, 14, OL2); c.VL(21, 0, 14, OL)
    c.R(9, 6, 14, 2, K('brass', 4)); c.HL(9, 6, 14, K('brass', 5)); c.HL(9, 7, 14, K('brass', 1))
    # 후드 윗면(3/4 시점에서 보이는 비스듬한 윗면): 연통에서 앞쪽으로 넓어진다
    for y in range(14, 22):
        k = (y - 14) * 3 // 7
        xl, xr = 4 - k, 27 + k
        for x in range(xl, xr + 1):
            f = (x - xl) / max(1, xr - xl)
            c.P(x, y, K('wood', 5 if f < .3 else 4 if f < .75 else 3))
        c.P(xl, y, OL2); c.P(xr, y, OL)
    c.HL(1, 22, 30, OL2)
    # 앞면: 구리 판 세 장(수직 이음)
    for y in range(23, 38):
        for x in range(1, 31):
            seg = (x - 1) // 10
            f = ((x - 1) % 10) / 9
            t = 4 if f < .2 else 3 if f < .8 else 2
            if seg == 0 and f < .2: t = 5
            c.P(x, y, K('wood', t))
        c.P(0, y, OL2); c.P(31, y, OL)
    for x in (11, 21):
        c.VL(x, 23, 15, K('wood', 1))
    # 판 가장자리 리벳
    for x in (3, 8, 13, 18, 23, 28):
        c.P(x, 25, K('brass', 5)); c.P(x, 35, K('brass', 5))
    # 음영: 앞면 위쪽 윗면 접힘 그림자 한 줄
    c.HL(1, 23, 30, K('wood', 2))
    # 아랫 테두리 황동 띠(두께 있는 림) + 안쪽 어둠
    c.R(0, 38, 32, 4, K('brass', 3)); c.HL(0, 38, 32, K('brass', 5)); c.HL(0, 39, 32, K('brass', 4)); c.HL(0, 41, 32, K('brass', 1))
    c.VL(0, 38, 4, OL); c.VL(31, 38, 4, OL); c.HL(0, 42, 32, OL)
    c.R(1, 43, 30, 3, K('night', 1)); c.HL(1, 43, 30, K('night', 0))
    c.HL(2, 46, 28, OL)
    # 푸른 녹 군집
    for (x, y) in ((4, 35), (5, 35), (5, 34), (25, 30), (26, 30), (26, 29)):
        c.P(x, y, K('leaf', 3))


# ═══ 바닥 ═══
def _flags(c, seed, wet):
    """16×16 주기 석판. 위 8줄·아래 8줄 두 단, 단마다 이음이 어긋난다."""
    c.R(0, 0, 16, 16, K('stone', 3))
    for y in range(16):
        for x in range(16):
            r = hsh(x % 16, y % 16, seed)
            if r < .06: c.P(x, y, K('stone', 2))
            elif r > .96: c.P(x, y, K('stone', 4))
    # 이음: 가로 y=0, y=8; 세로 x=5(위 단), x=13(아래 단)
    for x in range(16): c.P(x, 0, K('stone', 1)); c.P(x, 8, K('stone', 1))
    for y in range(1, 8): c.P(5, y, K('stone', 1))
    for y in range(9, 16): c.P(13, y, K('stone', 1))
    # 빛 받는 모서리(위·왼 한 줄 밝게)
    for x in range(16):
        if x != 5: c.P(x, 1, K('stone', 4))
        if x != 13: c.P(x, 9, K('stone', 4))
    for y in range(2, 8): c.P(6, y, K('stone', 4))
    for y in range(10, 16): c.P(14, y, K('stone', 4)); c.P(0, y, K('stone', 4)) if False else None
    c.P(0, 1, K('stone', 4)); c.P(0, 9, K('stone', 4))
    # 붙은 석판 옆 그늘
    for y in range(1, 8): c.P(4, y, K('stone', 2))
    for y in range(9, 16): c.P(12, y, K('stone', 2))
    if wet:
        return
    return


def _wet_marks(c, spots):
    """어두운 물기 웅덩이: 덩어리 한 점마다 어두운 물 + 위쪽 한 점 반사."""
    for (x, y, w, h) in spots:
        for yy in range(h):
            for xx in range(w):
                c.P((x + xx) % 16, (y + yy) % 16, K('water', 2) if yy == h - 1 else K('water', 1))
        c.P((x + 1) % 16, y % 16, K('water', 3))
        if w > 3: c.P((x + 2) % 16, y % 16, K('water', 3))


@REG.piece('wz-pot-floor-wet-a', '젖은 석판 바닥 A', 1, 1, ['F'], 'surfaces', SP,
           desc='어두운 석판 바닥에 물기가 번쩍이는 웅덩이 자국이 드문드문 있는 젖은 바닥.', rules='1칸 반복.', tags=['바닥', '젖음'], role='terrain', repeat=True)
def _wa(c):
    _flags(c, 3, True)
    _wet_marks(c, [(2, 3, 3, 2), (9, 11, 4, 2), (10, 2, 2, 1)])


@REG.piece('wz-pot-floor-wet-b', '젖은 석판 바닥 B', 1, 1, ['F'], 'surfaces', SP,
           desc='석판 이음 따라 물기가 고인 젖은 바닥 변형. 웅덩이 위치가 A 와 다르다.', rules='1칸 반복.', tags=['바닥', '젖음'], role='terrain', repeat=True)
def _wb(c):
    _flags(c, 9, True)
    _wet_marks(c, [(7, 9, 5, 2), (1, 12, 3, 2), (11, 4, 3, 1)])


def _groove_base(c, seed):
    _flags(c, seed, True)


def _water_line_h(c, y0, x0, x1):
    for x in range(x0, x1):
        c.P(x, y0, K('stone', 1)); c.P(x, y0 + 1, K('water', 1))
        c.P(x, y0 + 2, K('water', 2) if x % 4 else K('water', 3)); c.P(x, y0 + 3, K('stone', 5) if x % 3 else K('stone', 4))


@REG.piece('wz-pot-drain-h', '배수 홈(가로)', 1, 1, ['F'], 'surfaces', SP,
           desc='석판 바닥을 가로로 가르는 낮은 배수 홈. 홈 바닥에 물이 얇게 고여 있다.', rules='홈이 이어지도록 좌우로 놓는다.', tags=['배수', '홈'], role='terrain')
def _dh(c):
    _groove_base(c, 5)
    c.R(0, 6, 16, 4, K('stone', 1))
    for x in range(16):
        c.P(x, 6, K('stone', 0)); c.P(x, 7, K('night', 1)); c.P(x, 8, K('water', 1) if x % 5 else K('water', 2)); c.P(x, 9, K('stone', 4))
    c.P(4, 8, K('water', 3)); c.P(11, 8, K('water', 3))


@REG.piece('wz-pot-drain-v', '배수 홈(세로)', 1, 1, ['F'], 'surfaces', SP,
           desc='석판 바닥을 세로로 가르는 낮은 배수 홈.', rules='홈이 이어지도록 위아래로 놓는다.', tags=['배수', '홈'], role='terrain')
def _dv(c):
    _groove_base(c, 6)
    for y in range(16):
        c.P(6, y, K('stone', 0)); c.P(7, y, K('night', 1)); c.P(8, y, K('water', 1) if y % 5 else K('water', 2)); c.P(9, y, K('stone', 1))
        c.P(10, y, K('stone', 4)) if y % 3 else None
        c.P(5, y, K('stone', 2))
    c.P(8, 4, K('water', 3)); c.P(8, 12, K('water', 3))


@REG.piece('wz-pot-drain-x', '배수 홈(교차)', 1, 1, ['F'], 'surfaces', SP,
           desc='가로·세로 배수 홈이 만나는 교차 칸. 가운데 쇠창살 배수구가 있다.', rules='가로·세로 홈이 만나는 자리.', tags=['배수', '교차'], role='terrain')
def _dx(c):
    _groove_base(c, 7)
    c.R(0, 6, 16, 4, K('stone', 1)); c.R(6, 0, 4, 16, K('stone', 1))
    for x in range(16):
        if not 6 <= x < 10:
            c.P(x, 6, K('stone', 0)); c.P(x, 7, K('night', 1)); c.P(x, 8, K('water', 1)); c.P(x, 9, K('stone', 4))
    for y in range(16):
        if not 6 <= y < 10:
            c.P(6, y, K('stone', 0)); c.P(7, y, K('night', 1)); c.P(8, y, K('water', 1)); c.P(9, y, K('stone', 1))
    c.R(5, 5, 6, 6, K('iron', 1)); c.outline_rect(5, 5, 6, 6, K('iron', 0))
    c.R(6, 6, 4, 4, K('night', 0))
    for i in (6, 8):
        c.VL(i, 6, 4, K('iron', 3)); c.HL(6, i, 4, K('iron', 2))
    c.P(6, 6, K('iron', 4))


def _stain(c, ramp, seed, cells):
    """투명 바닥 위 얼룩: cells = [(cx, cy, rx, ry)] 겹친 타원 + 안쪽 밝은 점."""
    m = np.zeros((16, 16), bool)
    for (cx, cy, rx, ry) in cells:
        for y in range(16):
            for x in range(16):
                if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1: m[y, x] = True
    for y in range(16):
        for x in range(16):
            if not m[y, x]: continue
            inner = all(0 <= x + dx < 16 and 0 <= y + dy < 16 and m[y + dy, x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            if not inner: c.P(x, y, K(ramp, 1))
            else:
                r = hsh(x, y, seed)
                c.P(x, y, K(ramp, 3) if r < .2 else K(ramp, 2))
    ys, xs = np.nonzero(m)
    # 빛 받는 한 점(위쪽 왼쪽)
    for (x, y) in sorted(zip(xs, ys), key=lambda t: t[0] + t[1])[3:5]:
        c.P(int(x), int(y), K(ramp, 4 if ramp != 'glow' else 3))


@REG.piece('wz-pot-stain-violet', '시약 자국(보라)', 1, 1, ['f'], 'surfaces', SP,
           desc='바닥에 엎질러 말라붙는 보라색 시약 얼룩 덧그림. 투명 바탕.', rules='바닥 위에 한 장 얹는다.', tags=['얼룩', '시약', '보라'], role='terrain')
def _sv(c):
    _stain(c, 'violet', 1, [(7, 8, 5, 3.5), (11, 6, 2.5, 2), (4, 11, 2.5, 2)])


@REG.piece('wz-pot-stain-green', '시약 자국(녹)', 1, 1, ['f'], 'surfaces', SP,
           desc='바닥에 번진 연둣빛 시약 얼룩 덧그림.', rules='바닥 위에 한 장 얹는다.', tags=['얼룩', '시약', '녹색'], role='terrain')
def _sg(c):
    _stain(c, 'leaf', 2, [(8, 7, 4.5, 3), (4, 10, 3, 2.5), (12, 11, 2, 2)])


@REG.piece('wz-pot-stain-teal', '시약 자국(청록)', 1, 1, ['f'], 'surfaces', SP,
           desc='바닥에 튄 청록빛 시약 얼룩 덧그림.', rules='바닥 위에 한 장 얹는다.', tags=['얼룩', '시약', '청록'], role='terrain')
def _st(c):
    _stain(c, 'glow', 3, [(7, 8, 4, 3.5), (12, 5, 2.5, 2), (11, 11, 3, 2)])


# ═══ 소품 도우미 ═══
def _pot(c, cx, ytop, rx, h, liquid, bubbles=True, ramp='iron'):
    """3/4 쇠솥: 뚜껑 타원(윗면) + 몸통 + 액체 + 거품. ytop 은 윗 타원 위쪽 끝."""
    ry = max(3, rx // 2 + 1)
    c.cylinder(cx, ytop, rx, h, ry, ramp, 2)
    cy = ytop + ry
    c.ellipse(cx, cy, rx, ry, K(ramp, 3))
    c.ellipse(cx, cy, rx, ry, K(ramp, 5), fill=False)
    c.ellipse(cx, cy + 0.5, rx - 2, ry - 1.5, K(ramp, 0))
    c.ellipse(cx, cy + 1, rx - 3, ry - 2.5, K(liquid, 2))
    c.ellipse(cx, cy + 1, rx - 4, ry - 3, K(liquid, 3))
    for x in range(int(cx - rx + 2), int(cx + rx - 2)):
        if hsh(x, 1, 11) < .5: c.P(x, int(cy), K(liquid, 4) if liquid != 'glow' else K('glow', 3))
    c.P(int(cx - rx // 2), int(cy), K(liquid, 4 if liquid != 'glow' else 4))
    if bubbles:
        for (dx, dy) in ((-rx // 2, 0), (rx // 3, 1), (0, -1)):
            x, y = int(cx + dx), int(cy + dy)
            c.P(x, y, K(liquid, 4 if liquid != 'glow' else 4)); c.P(x + 1, y, K(liquid, 4 if liquid != 'glow' else 3))
    return cy


def _bench_box(c, x, y, w, h, top=6):
    """오크 작업대 상자(3/4): 윗면 밝은 오크 + 정면 어두운 오크 + 앞판 패널 한 줄."""
    c.R(x, y, w, h, K('wood', 2))
    c.R(x, y, w, top, K('wood', 4))
    c.HL(x, y, w, K('wood', 5)); c.VL(x, y, top, K('wood', 5))
    for k in range(x + 3, x + w - 2, 4): c.P(k, y + 2 + (k % 3), K('wood', 3))
    c.HL(x, y + top, w, K('wood', 3))
    c.VL(x + w - 1, y + top, h - top, K('wood', 1))
    c.HL(x, y + top + 1, w, K('wood', 2))
    c.outline_rect(x, y, w, h, K('wood', 0))
    c.VL(x + w - 1, y, top, K('wood', 2))


@REG.piece('wz-pot-cauldron-bench-violet', '가열 가마솥 작업대(보라 약)', 2, 2, ['SS', 'SS'], 'furniture', SP,
           desc='오크 작업대 위에 쇠솥이 얹혀 보라 약이 끓고, 작업대 앞 아궁이에서 불빛이 비친다.', rules='막힘.', tags=['가마솥', '가열', '보라'], role='prop')
def _cbv(c):
    _cb(c, 'violet')


def _cb(c, liq):
    _bench_box(c, 1, 14, 30, 17, 6)
    # 아궁이 창: 앞판에 쇠 구멍 + 불
    c.R(10, 22, 12, 8, K('iron', 0)); c.outline_rect(10, 22, 12, 8, K('iron', 1))
    c.R(11, 24, 10, 5, K('fire', 0))
    for x in range(11, 21):
        h = 2 + int(hsh(x, 3, 4) * 3)
        for y in range(29 - h, 29): c.P(x, y, K('fire', 1 if y > 27 - h // 2 else 2))
    c.P(14, 25, K('fire', 3)); c.P(17, 26, K('fire', 3)); c.P(15, 27, K('fire', 4))
    c.HL(10, 22, 12, K('iron', 3))
    # 솥
    _pot(c, 16, 0, 10, 8, liq)
    c.HL(5, 12, 22, K('wood', 1))  # 솥 그림자(작업대 윗면 위)
    c.R(7, 13, 18, 1, K('wood', 2))
    # 불꽃 반사 광택
    for (x, y) in ((6, 9), (25, 9)): c.P(x, y, K('fire', 2))


@REG.piece('wz-pot-cauldron-bench-green', '가열 가마솥 작업대(녹색 약)', 2, 2, ['SS', 'SS'], 'furniture', SP,
           desc='같은 작업대의 녹색 약 변형. 청록빛 약이 끓는다.', rules='막힘.', tags=['가마솥', '가열', '녹색'], role='prop')
def _cbg(c):
    _cb(c, 'glow')


@REG.piece('wz-pot-burner', '황동 버너', 1, 1, ['S'], 'furniture', SP,
           desc='둥근 황동 받침에 가는 목이 달리고 위에서 작은 푸른 불꽃이 타는 알코올 버너.', rules='막힘.', tags=['버너', '황동'], role='prop')
def _burner(c):
    # 불꽃
    for (x, y, t) in ((7, 3, 1), (8, 3, 1), (7, 4, 2), (8, 4, 2), (6, 5, 2), (7, 5, 3), (8, 5, 3), (9, 5, 2), (7, 6, 4), (8, 6, 3), (7, 7, 4), (8, 7, 4)):
        c.P(x, y, K('fire', t))
    c.P(7, 2, K('fire', 0)); c.P(8, 2, K('fire', 1))
    # 목+심지통
    c.R(5, 8, 6, 2, K('brass', 3)); c.HL(5, 8, 6, K('brass', 5)); c.VL(10, 8, 2, K('brass', 1))
    c.R(7, 10, 2, 2, K('brass', 2))
    # 받침(원통 3/4)
    c.ellipse(8, 13, 6, 2.5, K('brass', 2))
    c.R(2, 11, 12, 3, K('brass', 3))
    for x in range(2, 14): c.P(x, 11, K('brass', 5) if x < 6 else K('brass', 4) if x < 11 else K('brass', 3))
    c.HL(2, 13, 12, K('brass', 2)); c.VL(13, 11, 3, K('brass', 1)); c.HL(3, 14, 10, K('brass', 1))
    c.outline()


@REG.piece('wz-pot-cauldron-rod', '교반봉 꽂힌 솥', 1, 1, ['S'], 'furniture', SP,
           desc='작은 쇠솥에 긴 나무 교반봉이 비스듬히 꽂혀 약이 걸쭉하게 끓는다.', rules='막힘.', tags=['솥', '교반봉'], role='prop')
def _crod(c):
    cy = _pot(c, 8, 4, 6, 6, 'leaf')
    c.R(2, 14, 12, 1, K('iron', 0))
    # 교반봉: 솥 가운데에서 오른쪽 위로
    c.line(7, 6, 12, 0, K('wood', 4)); c.line(8, 6, 13, 0, K('wood', 3))
    c.P(12, 0, K('wood', 5)); c.P(13, 0, K('wood', 2))
    c.outline()


@REG.piece('wz-pot-scale', '저울(탁상)', 1, 1, ['f'], 'furniture', SP,
           desc='황동 막대 저울: 가운데 기둥, 가로 대, 양쪽 접시. 탁상에 얹는 용도.', rules='탁상 위에 얹는다. 막지 않음.', tags=['저울', '황동'], role='prop')
def _scale(c):
    # 밑판+기둥
    c.R(5, 12, 6, 2, K('brass', 3)); c.HL(5, 12, 6, K('brass', 5)); c.HL(5, 13, 6, K('brass', 1))
    c.R(7, 4, 2, 8, K('brass', 3)); c.VL(7, 4, 8, K('brass', 5)); c.VL(8, 4, 8, K('brass', 2))
    # 대 + 줄
    c.HL(2, 4, 12, K('brass', 4)); c.HL(2, 5, 12, K('brass', 2))
    c.VL(3, 6, 4, K('iron', 3)); c.VL(12, 6, 4, K('iron', 3))
    # 접시 둘(약간 어긋나 기운다)
    c.R(1, 10, 5, 1, K('brass', 5)); c.R(1, 11, 5, 1, K('brass', 2))
    c.R(10, 9, 5, 1, K('brass', 5)); c.R(10, 10, 5, 1, K('brass', 2))
    c.P(12, 8, K('violet', 4)); c.P(13, 8, K('violet', 3)); c.P(12, 7, K('violet', 4))
    c.P(7, 3, K('brass', 5)); c.P(8, 3, K('brass', 3))
    c.outline()


@REG.piece('wz-pot-mortar', '절구와 공이(탁상)', 1, 1, ['f'], 'furniture', SP,
           desc='돌 절구에 나무 공이가 기대어 선 탁상 소품, 안에 으깬 약초.', rules='탁상 위에 얹는다. 막지 않음.', tags=['절구', '공이'], role='prop')
def _mortar(c):
    c.ellipse(7, 10, 5.5, 2.5, K('stone', 2))
    c.R(2, 8, 11, 5, K('stone', 3))
    for y in range(8, 13):
        c.P(2, y, K('stone', 4)); c.P(3, y, K('stone', 4) if y < 11 else K('stone', 3)); c.P(12, y, K('stone', 1))
    c.R(4, 13, 7, 1, K('stone', 2)); c.HL(4, 14, 7, K('stone', 1))
    c.ellipse(7, 8, 5.5, 2.2, K('stone', 5))
    c.ellipse(7, 8.5, 4, 1.4, K('leaf', 2))
    c.P(5, 8, K('leaf', 4)); c.P(8, 9, K('leaf', 3)); c.P(9, 8, K('leaf', 4))
    # 공이
    c.line(8, 8, 13, 1, K('wood', 4)); c.line(9, 8, 14, 1, K('wood', 3))
    c.R(12, 0, 3, 2, K('wood', 5)); c.P(14, 1, K('wood', 2))
    c.outline()


@REG.piece('wz-pot-knife-board', '칼과 도마(탁상)', 1, 1, ['f'], 'furniture', SP,
           desc='오크 도마 위에 손질한 뿌리 조각과 작은 칼이 놓인 탁상 소품.', rules='탁상 위에 얹는다. 막지 않음.', tags=['칼', '도마'], role='prop')
def _knife(c):
    c.R(2, 4, 12, 9, K('wood', 4))
    c.HL(2, 4, 12, K('wood', 5)); c.VL(2, 4, 9, K('wood', 5))
    c.HL(2, 12, 12, K('wood', 2)); c.VL(13, 5, 8, K('wood', 3))
    c.R(2, 13, 12, 1, K('wood', 1))
    c.P(11, 6, K('wood', 3)); c.P(10, 7, K('wood', 3))
    # 뿌리 조각(자줏빛)
    c.R(3, 6, 3, 2, K('red', 3)); c.P(3, 6, K('red', 4)); c.R(6, 7, 2, 2, K('red', 2)); c.P(6, 7, K('red', 3))
    # 칼: 날 + 손잡이
    c.line(5, 11, 11, 8, K('iron', 5)); c.line(5, 12, 11, 9, K('iron', 3))
    c.R(11, 8, 3, 2, K('wood', 2)); c.P(11, 8, K('wood', 3))
    c.outline()


@REG.piece('wz-pot-basin', '세척 수조(돌 2×2)', 2, 2, ['SS', 'SS'], 'furniture', SP,
           desc='둥근 모서리 돌 수조에 연녹색 물이 고이고, 벽 쪽에 황동 수도꼭지가 달렸다.', rules='막힘.', tags=['수조', '세척'], role='prop')
def _basin(c):
    # 몸체
    c.R(1, 8, 30, 23, K('stone', 2))
    c.outline_rect(1, 4, 30, 27, K('stone', 0))
    c.R(2, 5, 28, 6, K('stone', 5))
    c.HL(2, 5, 28, K('stone', 5)); c.VL(2, 5, 25, K('stone', 4))
    # 물 구멍
    c.R(4, 8, 24, 8, K('stone', 1))
    c.R(5, 9, 22, 6, K('glow', 1)); c.HL(5, 9, 22, K('glow', 0))
    for x in range(5, 27):
        c.P(x, 11, K('glow', 2)) if (x // 3) % 2 == 0 else None
        c.P(x, 12, K('glow', 2) if x % 4 else K('glow', 3))
    c.P(8, 11, K('glow', 4)); c.P(9, 11, K('glow', 4)); c.P(20, 13, K('glow', 4))
    # 정면 석재 이음
    for y in (21, 26): c.HL(2, y, 28, K('stone', 1))
    for x in (8, 17, 25): c.VL(x, 16, 5, K('stone', 1))
    for x in (12, 21): c.VL(x, 22, 4, K('stone', 1))
    c.R(2, 16, 28, 5, K('stone', 3))
    for x in range(2, 30): c.P(x, 16, K('stone', 4))
    c.VL(30, 5, 26, K('stone', 1))
    c.HL(2, 30, 28, K('stone', 1))
    # 수도꼭지: 뒤쪽 테두리 오른쪽에서 솟아 물구멍 위로 꺾이는 황동 목
    c.R(23, 0, 3, 8, K('brass', 3)); c.VL(23, 0, 8, K('brass', 5)); c.VL(25, 0, 8, K('brass', 1))
    c.R(15, 0, 11, 3, K('brass', 3)); c.HL(15, 0, 11, K('brass', 5)); c.HL(15, 2, 11, K('brass', 1))
    c.R(15, 3, 3, 3, K('brass', 3)); c.VL(15, 3, 3, K('brass', 5)); c.VL(17, 3, 3, K('brass', 1))
    c.R(21, 0, 1, 3, K('brass', 4)); c.R(24, 8, 3, 2, K('brass', 2))
    c.P(16, 6, K('glow', 4)); c.P(16, 7, K('glow', 3))
    c.outline()


@REG.piece('wz-pot-shelf', '재료 병 진열대(2×3)', 2, 3, ['CC', 'SS', 'SS'], 'furniture', SP,
           desc='오크 틀에 세 단 선반, 알록달록한 약병과 단지가 줄지어 놓인 재료 진열대. 윗단은 사람 뒤로 겹친다.', rules='윗줄만 C.', tags=['진열대', '병', '선반'], role='prop')
def _shelf(c):
    W, H = 32, 48
    c.R(0, 0, W, H, K('wood', 2))
    c.outline_rect(0, 0, W, H, K('wood', 0))
    c.R(1, 1, 30, 1, K('wood', 5)); c.VL(1, 1, 46, K('wood', 4)); c.VL(30, 1, 46, K('wood', 1))
    # 안쪽 그림자 뒤판
    c.R(3, 3, 26, 40, K('wood', 1))
    shelves = (14, 28, 42)
    cols = [('violet', 4), ('leaf', 4), ('red', 3), ('water', 4), ('glow', 3), ('brass', 4)]
    hs = (hsh(1, 1, 2),)
    for si, sy in enumerate(shelves):
        # 선반 판
        c.R(2, sy, 28, 3, K('wood', 4)); c.HL(2, sy, 28, K('wood', 5)); c.HL(2, sy + 2, 28, K('wood', 2)); c.HL(2, sy + 3, 28, K('wood', 0)) if sy < 42 else None
        x = 4
        k = 0
        while x < 27:
            r = hsh(si, k, 8)
            kind = int(r * 3)
            col = cols[(si * 2 + k) % len(cols)]
            if kind == 0:  # 둥근 병
                w, h = 5, 8
                for yy in range(h):
                    ww = w - 2 if yy < 2 else w
                    for xx in range(ww):
                        px = x + xx + (1 if yy < 2 else 0); py = sy - h + yy
                        cc = K(col[0], 2 if xx < ww - 1 else 1)
                        if yy >= 3: cc = K(col[0], 3 if xx < ww - 2 else 2)
                        c.P(px, py, cc)
                c.P(x + 1, sy - 4, K(col[0], 4)); c.P(x + 1, sy - 3, K(col[0], 4))
                c.R(x + 2, sy - h - 1, 1, 1, K('wood', 5)); c.P(x + 1, sy - h, K('wood', 4)); c.P(x + 2, sy - h, K('wood', 3))
            elif kind == 1:  # 키 큰 병
                w, h = 3, 10
                for yy in range(h):
                    for xx in range(w):
                        c.P(x + xx, sy - h + yy, K(col[0], 3 if xx == 0 else 2 if xx == 1 else 1))
                c.R(x + 1, sy - h - 1, 1, 1, K('wood', 4))
                c.P(x, sy - 5, K(col[0], 4))
            else:  # 단지
                w, h = 6, 6
                for yy in range(h):
                    for xx in range(w):
                        if (yy == 0 and xx in (0, w - 1)): continue
                        c.P(x + xx, sy - h + yy, K('stone', 4 if xx < 2 else 3 if xx < 4 else 2))
                c.HL(x, sy - h, w, K('stone', 5)); c.HL(x + 1, sy - h - 1, w - 2, K('stone', 2))
                c.P(x + 1, sy - 4, K(col[0], 4))
            x += w + 1 + int(hsh(si, k, 3) * 2); k += 1
    c.outline()


@REG.piece('wz-pot-bottles', '유리 시약병 묶음(탁상)', 1, 1, ['f'], 'furniture', SP,
           desc='서로 다른 색 약이 든 유리병 세 개가 나란히 선 탁상 소품.', rules='탁상 위에 얹는다. 막지 않음.', tags=['시약병', '유리'], role='prop')
def _bottles(c):
    def bottle(x, y, w, h, ramp, neck):
        for yy in range(h):
            for xx in range(w):
                c.P(x + xx, y + yy, K(ramp, 3 if xx == 0 else 2 if xx < w - 1 else 1))
        c.P(x, y + h - 2, K(ramp, 4)); c.P(x, y + 1 + neck, K(ramp, 4))
        c.R(x + w // 2, y - neck, 1, neck, K('water', 4)); c.P(x + w // 2, y - neck - 1, K('wood', 4))
    bottle(1, 8, 4, 6, 'violet', 2)
    bottle(6, 5, 3, 9, 'leaf', 2)
    bottle(10, 8, 4, 6, 'red', 2)
    c.HL(1, 14, 14, K('stone', 1))
    c.outline()


@REG.piece('wz-pot-herb-hanger', '말린 약초 다발 걸이(벽 1×2)', 1, 2, ['C', 'C'], 'furniture', SP,
           desc='벽 위쪽에 나무 막대를 걸고 끈으로 묶은 약초 다발 세 개를 거꾸로 매단 벽 장식.', rules='벽에 거는 장식, 사람 위로 그려짐.', tags=['약초', '걸이'], role='prop')
def _herb(c):
    c.R(0, 2, 16, 2, K('wood', 3)); c.HL(0, 2, 16, K('wood', 5)); c.HL(0, 3, 16, K('wood', 1))
    for (x0, ramp, ln) in ((1, 'leaf', 18), (6, 'dirt', 22), (11, 'leaf', 16)):
        c.VL(x0 + 1, 4, 2, K('linen', 2))
        c.R(x0, 6, 4, 2, K('wood', 5)); c.HL(x0, 6, 4, K('linen', 3)); c.HL(x0, 7, 4, K('linen', 1))
        for yy in range(8, 8 + ln - 4):
            wdt = 4 + (yy - 8) // 6 * 1 - (1 if yy > 8 + ln - 8 else 0)
            for xx in range(-(wdt // 2) + 2, wdt // 2 + 2 + (wdt % 2)):
                t = 4 if xx < 1 else 3 if xx < 3 else 2
                if hsh(x0 + xx, yy, 2) < .22: t -= 1
                c.P(x0 + xx, yy, K(ramp, t))
        if ramp == 'leaf': c.P(x0 + 1, 12, K('leaf', 4))
    c.outline()


@REG.piece('wz-pot-root-basket', '생재료 뿌리 바구니', 1, 1, ['S'], 'furniture', SP,
           desc='엮은 버들 바구니에 흙 묻은 뿌리와 푸른 잎이 가득 든 생재료 바구니.', rules='막힘.', tags=['바구니', '뿌리'], role='prop')
def _basket(c):
    # 뿌리·잎
    for (x, y, ramp, t) in ((4, 4, 'dirt', 5), (6, 3, 'leaf', 4), (8, 4, 'red', 3), (10, 4, 'dirt', 4), (7, 5, 'leaf', 3), (5, 5, 'leaf', 3)):
        c.R(x, y, 2, 3, K(ramp, t)); c.P(x, y, K(ramp, min(t + 1, 4)))
    c.line(6, 3, 5, 1, K('leaf', 3)); c.line(7, 3, 8, 0, K('leaf', 4)); c.line(10, 4, 11, 2, K('leaf', 2))
    # 바구니
    c.R(2, 7, 12, 7, K('wood', 3))
    for y in range(7, 14):
        for x in range(2, 14):
            if (x + y) % 2 == 0: c.P(x, y, K('wood', 4))
            if y == 7: c.P(x, y, K('wood', 5) if x % 2 == 0 else K('wood', 4))
    c.HL(2, 13, 12, K('wood', 1)); c.VL(13, 8, 5, K('wood', 2)); c.HL(3, 14, 10, K('wood', 0))
    c.HL(2, 10, 12, K('wood', 2))
    c.outline()


@REG.piece('wz-pot-wall-lamp', '벽 황동 램프(정적)', 1, 1, ['C'], 'effects', SP,
           desc='벽에 박은 황동 받침 위에서 작은 불이 켜진 램프. 불꽃은 움직이지 않는 정적 그림.', rules='벽에 거는 조명.', tags=['램프', '황동', '벽'], role='prop')
def _lamp(c):
    # 벽걸이 판
    c.R(6, 8, 4, 6, K('brass', 2)); c.VL(6, 8, 6, K('brass', 4)); c.HL(6, 8, 4, K('brass', 4))
    # 컵
    c.R(4, 6, 8, 3, K('brass', 3)); c.HL(4, 6, 8, K('brass', 5)); c.HL(4, 8, 8, K('brass', 1)); c.VL(11, 6, 3, K('brass', 2))
    c.R(7, 5, 2, 1, K('wood', 4))
    # 불꽃
    for (x, y, t) in ((7, 1, 1), (8, 1, 1), (7, 2, 2), (8, 2, 2), (6, 3, 2), (7, 3, 3), (8, 3, 3), (9, 3, 2), (7, 4, 4), (8, 4, 3)):
        c.P(x, y, K('fire', t))
    c.P(7, 0, K('fire', 1))
    c.outline()
    # 은은한 빛: 불꽃 둘레 한 겹
    for (x, y) in ((5, 3), (10, 3), (6, 1), (9, 1)):
        if not c.opaque(x, y): c.P(x, y, K('brass', 1))


@REG.piece('wz-pot-prep-bench', '재료 준비대(2×2)', 2, 2, ['SS', 'SS'], 'furniture', SP,
           desc='오크 준비대 윗면에 도마·손질한 뿌리·칼·약초 그릇이 놓인 긴 작업대.', rules='막힘.', tags=['준비대', '재료'], role='prop')
def _prep_bench(c):
    _bench_box(c, 1, 12, 30, 19, 9)
    # 도마
    c.R(4, 14, 11, 6, K('wood', 5)); c.HL(4, 14, 11, K('wood', 5)); c.HL(4, 19, 11, K('wood', 3))
    c.outline_rect(4, 14, 11, 6, K('wood', 2))
    c.R(6, 16, 3, 2, K('red', 3)); c.P(6, 16, K('red', 4)); c.R(9, 17, 2, 2, K('red', 2))
    # 칼
    c.line(12, 15, 14, 18, K('iron', 5)); c.P(14, 18, K('wood', 1))
    # 약초 그릇
    c.ellipse(23, 17, 5, 3, K('stone', 1)); c.ellipse(23, 16, 4, 2, K('leaf', 2))
    c.P(21, 15, K('leaf', 4)); c.P(24, 16, K('leaf', 3)); c.P(23, 15, K('leaf', 4))
    c.outline_rect(1, 12, 30, 19, K('wood', 0))


def _prep_place():
    pl = [('wz-castle-wall-nw', 0, 0), ('wz-castle-wall-ne', 11, 0)]
    pl += [('wz-castle-wall-n', x, 0) for x in range(1, 11)]
    for y in range(4, 7):
        pl += [('wz-castle-wall-w', 0, y), ('wz-castle-wall-e', 11, y)]
    pl += [('wz-castle-wall-sw', 0, 7), ('wz-castle-wall-se', 11, 7)]
    pl += [('wz-castle-wall-s', x, 7) for x in range(1, 11)]
    # 북벽: 볼트 아치 둘 + 기둥 아치 둘, 그 사이에 후드와 진열대
    pl += [('wz-pot-vault-arch-2x4', 1, 0), ('wz-pot-vault-arch-pillar', 3, 0),
           ('wz-pot-hood', 4, 1), ('wz-pot-vault-arch-pillar', 6, 0),
           ('wz-pot-vault-arch-2x4', 7, 0), ('wz-pot-shelf', 9, 1)]
    pl += [('wz-pot-wall-lamp', 3, 2), ('wz-pot-herb-hanger', 6, 1)]
    pl += [('wz-pot-drain-h', x, 6) for x in range(1, 11)]
    pl += [('wz-pot-stain-violet', 5, 5), ('wz-pot-stain-green', 8, 5)]
    pl += [('wz-pot-cauldron-bench-violet', 4, 4), ('wz-pot-prep-bench', 1, 4),
           ('wz-pot-basin', 9, 4), ('wz-pot-root-basket', 7, 5), ('wz-pot-bottles', 3, 5)]
    return pl


REG.example('wz-pot-example-prep', '재료 준비실', SP, 12, 9, 'wz-pot-floor-wet-a', _prep_place(),
            desc='북벽에 볼트 아치 둘·기둥 아치 둘, 사이에 후드와 약병 진열대. 준비대·가열 솥·세척 수조가 한 줄로 놓인 재료 준비실.')


if __name__ == '__main__':
    sys.exit(1 if run_module(MODULE) else 0)
