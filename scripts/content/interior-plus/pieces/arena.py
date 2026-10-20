"""투기장·콜로세움 — 모래 경기장(sand)·관중석 돌계단·나무 울짱·쇠창살 문·검투사 무기 걸이·대기 감방 소품. 사암 판석(sandstone)·사암 벽(arenawall)과 함께 쓴다.
이미 v5 에 있는 화로·벽 횃불·족쇄·짚 더미·감방 침상·오물통·깃발·석상·돌 기둥은 그대로 쓴다."""
import math
from iplib import REG, K, shift, box, cyl, ring, Cv, hnoise, poly, line, barrel

TAGS = ['투기장', '콜로세움']


def slab(c, x, y, w, d, h, m, t=5, f=3):
    """3/4 판: (x,y) = 윗면 첫 줄 왼쪽. 뒤 가장자리 어두운 줄(y-1), 윗면 d 줄(t 단 고르게 — 띠 무늬 없음), 앞 입술 한 줄,
    앞면 h 줄(f 단, 세로 결), 바깥 윤곽. 윗면과 앞면은 두 단 이상 떨어진다."""
    c.hl(x, x + w - 1, y - 1, K(m, max(1, t - 3)))
    for j in range(d):
        for i in range(w):
            k = t + (1 if i < 3 and j < d - 1 else 0) - (1 if i >= w - 2 else 0)
            c.p(x + i, y + j, K(m, k))
    c.hl(x + 1, x + w - 2, y + d - 1, K(m, t + 1))
    for j in range(h):
        for i in range(w):
            k = f - (1 if j >= h - 1 and h > 2 else 0) - (1 if i >= w - 2 else 0) + (1 if i == 0 else 0)
            if i % 5 == 3 and 0 < i < w - 2: k -= 1
            c.p(x + i, y + d + j, K(m, k))
    o = K(m, 1)
    c.hl(x, x + w - 1, y + d + h, o); c.vl(x - 1, y - 1, y + d + h - 1, o); c.vl(x + w, y - 1, y + d + h - 1, o)
    c.hl(x, x + w - 1, y - 2, o)


def disc(c, cx, cy, rx, ry, h, m, t=5, f=3):
    """3/4 둥근 판(통나무 토막·둥근 받침): 앞 둘레 띠 h 줄 + 위에서 본 윗면 타원(뒤 둘레 어둡게, 나이테)."""
    for x in range(int(math.floor(cx - rx)), int(math.ceil(cx + rx)) + 1):
        u = (x - cx) / (rx + .5)
        if abs(u) > 1: continue
        yb = cy + ry * math.sqrt(1 - u * u)
        for y in range(int(round(cy)), int(round(yb)) + h + 1):
            c.p(x, y, K(m, f + (1 if u < -.5 else 0) - (1 if u > .5 else 0) - (1 if y > yb + h - 1 else 0)))
    c.ell(cx, cy, rx, ry, None, only=lambda x, y: K(m, t + (1 if x < cx - rx * .3 else 0) - (1 if y < cy - ry * .6 else 0)))
    ring(c, cx, cy, rx * .5, ry * .5, K(m, t - 1))


def top_shadow(c, x0, x1, y):
    for x in range(x0, x1 + 1):
        col = c.get(x, y)
        if col is not None: c.p(x, y, shift(col, -2))


def stone_step(c, x0, y_top, w, d, h, m='straw', t0=4, f0=3):
    box(c, x0, y_top, w, d, h, m, t0=t0, f0=f0)
    for x in range(x0 + 7, x0 + w - 1, 8): c.vl(x, y_top + d + 1, y_top + d + h - 1, K(m, f0 - 2))


@REG.piece('tier seat 3', '관중석 돌 계단(낮은 줄, 3칸)', 'arena', 'floor', 3, 1, 0, 'low_furniture',
           '사암 관중석 앞줄 — 낮은 돌 단, 윗면에 붉은 방석 둘.', TAGS + ['관중석', '의자'],
           '관중석 방 앞쪽 줄. 뒷줄(높은 단)과 위아래로 붙여 계단을 만든다. 2칸마다 통로.', ['tier back 3', 'arena fence 3'], use=('sit',))
def tier_seat3(c):
    stone_step(c, 1, 2, 46, 7, 6)
    for x0 in (6, 30): c.rect(x0, 3, x0 + 10, 6, K('red', 4)); c.hl(x0, x0 + 10, 3, K('red', 5)); c.hl(x0, x0 + 10, 7, K('red', 2))
    c.shadow(1, 13, 47, 15)
    c.outline()


@REG.piece('tier back 3', '관중석 돌 계단(높은 뒷줄, 3칸)', 'arena', 'wall', 3, 1, 16, 'low_furniture',
           '북쪽 벽에 붙인 높은 사암 관중석 두 단 — 앞 단 윗면과 뒤 단 윗면이 계단처럼 보인다.', TAGS + ['관중석', '의자'],
           '관중석 방 북쪽 벽 앞 첫 바닥 줄. 앞에 낮은 줄(tier seat 3).', ['tier seat 3', 'arena banner'], use=('sit',))
def tier_back3(c):
    stone_step(c, 1, 1, 46, 6, 10, t0=4, f0=2)     # 뒤(높은) 단 — 앞면은 그늘
    stone_step(c, 1, 18, 46, 6, 6, t0=4, f0=3)     # 앞 단
    for x0 in (4, 20, 36): c.rect(x0, 18, x0 + 8, 21, K('red', 4)); c.hl(x0, x0 + 8, 18, K('red', 5))
    c.shadow(1, 29, 47, 31)
    c.outline()


@REG.piece('arena fence 3', '경기장 나무 울짱(3칸)', 'arena', 'floor', 3, 1, 8, 'frame',
           '모래 경기장과 관중석을 가르는 굵은 나무 울짱(쇠 띠, 위 난간). 통행을 막는다.', TAGS + ['경기장', '울타리'],
           '경기장 가장자리 줄. 문 자리는 비운다.', ['tier seat 3', 'portcullis'])
def arena_fence3(c):
    m = 'dwood'
    c.shadow(1, 22, 47, 23)
    slab(c, 1, 18, 46, 3, 1, 'wood', t=6, f=3)              # 바닥 굽(윗면 3줄)
    for x in range(3, 45, 6):                               # 기둥(굽 위, 난간 밑)
        c.rect(x, 11, x + 3, 17, K(m, 3)); c.vl(x, 11, 17, K(m, 4)); c.vl(x + 3, 11, 17, K(m, 1))
        c.hl(x, x + 3, 14, K('iron', 4)); c.p(x + 1, 14, K('iron', 6))
        top_shadow(c, x, x + 4, 18)
    slab(c, 1, 3, 46, 5, 2, 'wood', t=6, f=3)               # 위 난간 판(위에서 본 윗면 5줄)
    for x in range(4, 46, 6): c.p(x + 1, 5, K('iron', 5)); c.p(x + 2, 5, K('iron', 3))   # 윗면에 박힌 쇠 못(기둥 머리)
    c.outline()

def arch(c, x0, x1, top, bottom, m='straw'):
    """사암 아치 문틀(돌덩이 쐐기) — 안쪽 구멍 좌표를 돌려준다."""
    cx = (x0 + x1) / 2; r = (x1 - x0) / 2
    for y in range(top, bottom + 1):
        for x in range(x0, x1 + 1):
            c.p(x, y, K(m, 4 if (x + y // 4) % 9 else 3))
    ix0, ix1 = x0 + 4, x1 - 4
    icx = (ix0 + ix1) / 2; ir = (ix1 - ix0) / 2
    hole = []
    for y in range(top + 4, bottom + 1):
        for x in range(ix0, ix1 + 1):
            if y < top + 4 + ir and ((x - icx) / (ir + .5)) ** 2 + ((y - (top + 4 + ir)) / (ir + .5)) ** 2 > 1: continue
            hole.append((x, y))
    for a in range(0, 181, 15):   # 쐐기돌 줄눈
        r_ = math.radians(180 + a)
        line(c, int(round(icx + (ir + 1) * math.cos(r_))), int(round(top + 4 + ir + (ir + 1) * math.sin(r_))),
             int(round(icx + (r + .5) * math.cos(r_))), int(round(top + 4 + ir + (r + 2) * math.sin(r_))), K(m, 2))
    c.hl(x0, x1, top, K(m, 6)); c.hl(x0, x1, top + 1, K(m, 5))
    c.vl(x0, top, bottom, K(m, 5)); c.vl(x1, top, bottom, K(m, 2))
    return hole


@REG.piece('portcullis', '쇠창살 문(닫힘)', 'arena', 'hang', 2, 0, 0, 'wall_mounted',
           '벽면에 박힌 사암 아치 속 내려진 쇠창살 문 — 너머 어두운 통로.', TAGS + ['문', '감방'],
           '경기장·대기실 북쪽 벽면(두 줄 전체)에 건다. 앞 1~2칸 비운다.', ['gate winch', 'arena fence 3'], use=('gate',))
def portcullis(c):
    hole = arch(c, 1, 30, 0, 31)
    for x, y in hole: c.p(x, y, K('black', 1 if y < 22 else 2))
    xs = sorted({x for x, _ in hole})
    for x, y in hole:
        if (x - xs[0]) % 4 == 1: c.p(x, y, K('iron', 4))
        if (x - xs[0]) % 4 == 2: c.p(x, y, K('iron', 2))
        if (y - 8) % 7 == 0: c.p(x, y, K('iron', 5))
    for x in range(xs[0], xs[-1] + 1, 4): c.p(x + 1, 31, K('iron', 6))      # 창끝(벽 밑단에 닿는다)
    c.outline()


@REG.piece('portcullis open', '쇠창살 문(열림)', 'arena', 'hang', 2, 0, 0, 'wall_mounted',
           '벽면에 박힌 사암 아치, 쇠창살을 끌어 올려 위에 창끝만 보이고 아래는 트인 어두운 통로.', TAGS + ['문'],
           '경기장 북쪽 벽면(두 줄 전체)에 건다. 지나가는 길로 쓰려면 아래 바닥 칸에 이동 이벤트를 단다.', ['portcullis', 'gate winch'], use=('gate',))
def portcullis_open(c):
    hole = arch(c, 1, 30, 0, 31)
    for x, y in hole: c.p(x, y, K('black', 1 if y < 20 else 2 if y < 27 else 3))
    xs = sorted({x for x, _ in hole})
    for x, y in hole:
        if y < 11:
            if (x - xs[0]) % 4 in (1, 2): c.p(x, y, K('iron', 4 if (x - xs[0]) % 4 == 1 else 2))
            if y in (5, 9): c.p(x, y, K('iron', 5))
    for x in range(xs[0], xs[-1] + 1, 4): c.p(x + 1, 11, K('iron', 6))
    c.outline()


@REG.piece('gate winch', '창살 문 고패', 'arena', 'floor', 1, 1, 16, 'frame',
           '쇠창살 문을 감아 올리는 나무 고패(손잡이 바퀴·쇠사슬).', TAGS + ['문', '장치'],
           '쇠창살 문 바로 옆 1칸.', ['portcullis', 'portcullis open'], use=('switch',))
def gate_winch(c):
    """선 고패(캡스턴)를 위에서 내려다본다: 넓은 둥근 머리판(윗면 7줄)에 손잡이 막대 넷이 열십자로 꽂히고, 그 밑 짧은 북통에 쇠사슬이 감긴다."""
    m = 'dwood'
    c.shadow(1, 29, 15, 31)
    disc(c, 7.5, 27, 7, 2.6, 2, 'wood', t=6, f=3)           # 둥근 받침(위에서 본 윗면)
    cx, rx = 7.5, 5.0
    for y in range(15, 28):                                 # 짧은 북통(세로 통널), 밑은 둥글게
        for x in range(int(cx - rx), int(math.ceil(cx + rx)) + 1):
            u = (x - (cx - rx)) / (2 * rx)
            if y > 25 and ((x - cx) / (rx + .5)) ** 2 + ((y - 25) / 2) ** 2 > 1: continue
            k = 5 if u < .2 else 4 if u < .5 else 3 if u < .8 else 2
            if x in (5, 10): k -= 1
            c.p(x, y, K(m, k))
    for y in range(19, 24):                                 # 감긴 쇠사슬
        for x in range(3, 13):
            if (x + y) % 3 == 0: c.p(x, y, K('iron', 5 if x < 8 else 3))
    line(c, 12, 21, 15, 22, K('iron', 4)); c.p(15, 23, K('iron', 2))   # 문 쪽으로 나가는 사슬
    # 머리판: 앞 두께(2줄) + 위에서 본 큰 타원 윗면
    c.ell(cx, 13.4, 7.4, 3.6, K('wood', 2))                 # 머리판 앞 두께
    c.ell(cx, 12.0, 7.4, 3.6, None, only=lambda x, y: K('wood', 7 if y < 11 and x < 9 else 6 if y < 13 else 5))   # 위에서 본 납작한 둥근 윗면
    ring(c, cx, 12.0, 5.0, 2.2, K('wood', 5))               # 윗면 테 홈(타원)
    # 손잡이 막대 — 윗면 위에 눕힌 굵은 막대 하나가 좌우로 길게 지난다(볕 받는 윗면 + 그늘), 굴대 머리는 윗면 한가운데
    c.hl(0, 15, 11, K('wood', 7)); c.hl(0, 15, 12, K('wood', 3))
    c.p(0, 12, K('wood', 2)); c.p(15, 12, K('wood', 2))
    c.ell(cx, 11.6, 1.6, 1.0, K('iron', 4)); c.p(7, 11, K('iron', 6))   # 가운데 쇠 굴대 머리
    c.outline()

@REG.piece('gladiator rack', '검투사 무기 걸이(2칸)', 'arena', 'floor', 2, 1, 16, 'frame',
           '나무 걸이에 세운 삼지창·짧은 검·그물, 아래 둥근 방패 둘.', TAGS + ['무기', '대기실'],
           '대기실·무기고 벽 앞이나 경기장 출입구 곁.', ['shield rack', 'armor bench'], use=('search',))
def gladiator_rack(c):
    m = 'dwood'
    c.shadow(1, 28, 31, 31)
    box(c, 1, 23, 30, 3, 4, m, t0=4, f0=3)
    c.hl(2, 29, 8, K(m, 5)); c.hl(2, 29, 9, K(m, 2))
    for x in (2, 29): c.vl(x, 6, 23, K(m, 4 if x == 2 else 2))
    # 삼지창
    c.vl(7, 2, 23, K(m, 5)); c.hl(5, 9, 4, K('iron', 4))
    for x in (5, 7, 9): c.vl(x, 0, 4, K('iron', 6 if x == 7 else 5))
    # 짧은 검 둘
    for x in (12, 15):
        c.vl(x, 3, 15, K('iron', 6)); c.vl(x + 1, 3, 15, K('iron', 4)); c.hl(x - 1, x + 2, 16, K('brass', 5)); c.vl(x, 17, 20, K(m, 3))
    # 걸어 둔 그물
    for y in range(10, 22):
        for x in range(19, 27):
            if (x + y) % 3 == 0 or (x - y) % 3 == 0: c.p(x, y, K('straw', 4 if y < 15 else 3))
    # 둥근 방패 둘(받침 앞)
    for cx in (8, 22):
        c.ell(cx, 22, 4.5, 4, None, only=lambda x, y, cx=cx: K('red', 4 if x + y < cx + 22 else 3))
        ring(c, cx, 22, 4.5, 4, K('brass', 4)); c.p(cx, 22, K('brass', 6))
    c.outline()


@REG.piece('shield rack', '방패 걸이 벽판(2칸)', 'arena', 'hang', 2, 0, 0, 'wall_mounted',
           '벽에 건 나무판에 둥근 방패 셋(빨강·파랑·청동).', TAGS + ['무기', '대기실'],
           '대기실·무기고 벽면 윗줄.', ['gladiator rack'])
def shield_rack(c):
    c.rect(2, 6, 29, 8, K('dwood', 4)); c.hl(2, 29, 6, K('dwood', 5))
    for cx, col in ((7, 'red'), (16, 'blue'), (25, 'brass')):
        c.ell(cx, 14, 5, 5, None, only=lambda x, y, cx=cx, col=col: K(col, 5 if x + y < cx + 12 else 4 if x + y < cx + 17 else 3))
        ring(c, cx, 14, 5, 5, K('brass', 3)); c.ell(cx, 14, 1.4, 1.4, K('brass', 6))
    c.outline()


@REG.piece('arena banner', '투기장 기(월계관)', 'arena', 'hang', 1, 0, 0, 'wall_mounted',
           '벽에 늘어뜨린 길쭉한 자주 깃발 — 금 테두리와 월계관 무늬(글자 없음).', TAGS + ['장식', '깃발'],
           '관중석·경기장 벽면 윗줄에 2~3칸 간격으로.', ['tier back 3', 'portcullis'])
def arena_banner(c):
    c.hl(1, 14, 1, K('brass', 5)); c.p(0, 1, K('brass', 3)); c.p(15, 1, K('brass', 3))
    for y in range(2, 30):
        for x in range(3, 13):
            c.p(x, y, K('purple', 4 if x < 6 else 3 if x < 10 else 2))
    for y in range(2, 30): c.p(3, y, K('gold', 4)); c.p(12, y, K('gold', 3))
    for x in range(3, 13): c.p(x, 29 + (1 if x in (7, 8) else 0), K('gold', 4))
    # 월계관(둥근 잎 고리)
    for a in range(30, 331, 25):
        r = math.radians(a + 90)
        c.p(int(round(7.5 + 3.2 * math.cos(r))), int(round(14 + 3.6 * math.sin(r))), K('gold', 5))
    c.p(7, 18, K('gold', 4)); c.p(8, 18, K('gold', 4))
    c.outline()


@REG.piece('training dummy', '짚 허수아비 표적', 'arena', 'floor', 1, 1, 16, 'figure',
           '나무 기둥에 짚을 묶은 연습용 허수아비(팔 막대, 머리 자루).', TAGS + ['연습장', '대기실'],
           '대기실·연습장 바닥, 둘레 1칸 비운다.', ['gladiator rack', 'archery target'])
def training_dummy(c):
    c.shadow(1, 29, 15, 31)
    disc(c, 7.5, 24.5, 6, 2.6, 2, 'wood', t=6, f=3)         # 통나무 토막 받침(위에서 본 둥근 윗면)
    c.vl(7, 6, 24, K('dwood', 5)); c.vl(8, 6, 24, K('dwood', 3))
    c.p(9, 24, K('wood', 3)); c.p(10, 25, K('wood', 4))       # 기둥 그늘(윗면 위)
    for y in range(10, 21):                                 # 짚 다발 몸통 — 세로 결, 끝이 삐죽
        for x in range(4, 12):
            if y in (10, 20) and x % 2: continue
            k = 5 if x < 6 else 4 if x < 9 else 3
            if (x * 3 + y // 3) % 4 == 0: k -= 1
            c.p(x, y, K('straw', k))
    for y in (12, 18): c.hl(4, 11, y, K('dwood', 3))
    c.hl(0, 15, 14, K('dwood', 5)); c.hl(0, 15, 15, K('dwood', 3))
    for x in (0, 1, 14, 15): c.vl(x, 13, 16, K('straw', 4 if x < 8 else 3))
    for y in range(3, 9):                                   # 짚 자루 머리(얼굴 없음)
        for x in range(5, 11):
            if y == 3 and x in (5, 10): continue
            c.p(x, y, K('straw', 5 if x < 7 else 4 if x < 9 else 3))
    c.hl(6, 9, 8, K('dwood', 3))
    c.p(7, 1, K('straw', 5)); c.p(8, 2, K('straw', 4)); c.p(6, 2, K('straw', 4)); c.p(9, 1, K('straw', 3))
    c.outline()

@REG.piece('archery target', '짚 과녁', 'arena', 'floor', 1, 1, 16, 'frame',
           '나무 세 다리 위 둥근 짚 과녁(빨강·흰 고리), 화살 하나 꽂힘.', TAGS + ['연습장'],
           '연습장 끝 벽 쪽, 앞 3칸 비운다.', ['training dummy', 'arrow barrel'])
def archery_target(c):
    c.shadow(1, 29, 15, 31)
    disc(c, 7.5, 24.5, 6, 2.6, 2, 'wood', t=6, f=3)         # 둥근 받침 토막(위에서 본 윗면)
    line(c, 4, 24, 6, 15, K('dwood', 4)); line(c, 11, 24, 9, 15, K('dwood', 2)); c.vl(8, 16, 23, K('dwood', 3))
    c.p(12, 24, K('wood', 4)); c.p(9, 25, K('wood', 4))
    c.ell(7.5, 7.5, 6, 4.5, None, only=lambda x, y: K('straw', 6 if x < 8 else 5))   # 뒤로 기운 원판의 위 두께
    c.ell(7.5, 11.5, 6, 5, K('straw', 1))
    c.ell(7.5, 12, 5.5, 4.6, None, only=lambda x, y: K('straw', 4 if x + y < 18 else 3))
    ring(c, 7.5, 12, 3.8, 3.1, K('red', 4)); ring(c, 7.5, 12, 1.9, 1.5, K('white', 6)); c.ell(7.5, 12, .9, .6, K('red', 4))
    for x in range(3, 13, 3): c.p(x, 6, K('straw', 4)); c.p(x + 1, 8, K('straw', 4))
    line(c, 9, 11, 13, 5, K('dwood', 5)); c.p(13, 4, K('white', 6)); c.p(14, 5, K('white', 5))
    c.outline()

@REG.piece('armor bench', '갑옷 걸상(2칸)', 'arena', 'floor', 2, 1, 8, 'low_furniture',
           '나무 걸상 위 검투사 투구 둘과 정강이 받이·가죽 띠.', TAGS + ['대기실', '갑옷'],
           '대기실 벽 앞, 무기 걸이 옆.', ['gladiator rack', 'shield rack'], use=('search',))
def armor_bench(c):
    m = 'dwood'
    c.shadow(1, 20, 31, 23)
    box(c, 1, 11, 30, 5, 4, m, t0=5, f0=3)
    for x in (3, 4, 27, 28): c.vl(x, 21, 22, K(m, 2))
    # 투구 둘(챙·볏)
    for cx in (8, 18):
        c.ell(cx, 9, 4, 4, None, only=lambda x, y, cx=cx: K('iron', 5 if x < cx - 1 and y < 9 else 4 if x < cx + 1 else 2))
        c.hl(cx - 5, cx + 4, 12, K('iron', 3)); c.hl(cx - 2, cx + 1, 9, K('black', 1))
        c.hl(cx - 1, cx, 4, K('red', 4)); c.p(cx - 2, 5, K('red', 3)); c.p(cx + 1, 5, K('red', 3))
    # 정강이 받이
    c.rect(24, 8, 26, 14, K('brass', 4)); c.vl(24, 8, 14, K('brass', 6)); c.rect(27, 9, 29, 14, K('brass', 3))
    c.outline()


@REG.piece('stone bench', '돌 걸상(2칸)', 'arena', 'floor', 2, 1, 0, 'seat',
           '대기 감방·통로의 낮은 사암 걸상.', TAGS + ['감방', '대기실', '의자'],
           '감방·대기실 벽 곁.', ['training dummy', 'straw pile'], use=('sit',))
def stone_bench(c):
    stone_step(c, 2, 4, 28, 5, 5, t0=4, f0=3)
    c.shadow(2, 13, 31, 15)
    c.outline()


@REG.piece('water bucket', '물동이와 국자', 'arena', 'floor', 1, 1, 0, 'container',
           '나무 물동이(쇠테)에 물이 차 있고 국자가 걸쳐 있다.', TAGS + ['감방', '대기실'],
           '감방·대기실 구석.', ['stone bench', 'straw pile'], use=('search',))
def water_bucket(c):
    c.shadow(2, 13, 15, 15)
    barrel(c, 7.5, 3, rx=5, ry=2.4, h=7, m='dwood', lid=False)
    c.ell(7.5, 5.4, 5, 2.4, None, only=lambda x, y: K('dwood', 2))
    c.ell(7.5, 5.8, 4, 1.8, None, only=lambda x, y: K('water', 4 if x < 8 else 3))
    c.p(6, 5, K('water', 6))
    line(c, 9, 6, 13, 1, K('dwood', 5)); c.ell(8.5, 6, 1.4, .9, K('dwood', 3))
    ring(c, 7.5, 5.4, 5, 2.4, K('iron', 4))
    c.outline()


@REG.piece('beast cage', '맹수 우리(2칸)', 'arena', 'floor', 2, 1, 16, 'frame',
           '바퀴 달린 나무 우리 — 굵은 쇠창살, 바닥에 짚, 안은 비어 있다.', TAGS + ['맹수', '대기실'],
           '경기장 짐승 문 옆·대기실 구석. 앞 1칸 비운다.', ['portcullis', 'straw pile'], use=('open',))
def beast_cage(c):
    m = 'dwood'
    c.shadow(1, 29, 31, 31)
    c.rect(2, 12, 29, 22, K('black', 1))                    # 안(어둠)
    for y in range(18, 22):                                 # 우리 바닥 짚(위에서 보인다)
        for x in range(2, 30): c.p(x, y, K('straw', 4 if (x + y) % 3 else 3) if y > 18 else K('straw', 2))
    for x in range(3, 29, 4): c.vl(x, 12, 22, K('iron', 5)); c.vl(x + 1, 12, 22, K('iron', 3))
    c.vl(2, 12, 22, K(m, 4)); c.vl(29, 12, 22, K(m, 2))
    slab(c, 2, 23, 28, 2, 2, 'wood', t=5, f=3)              # 바닥 판
    for x in (7, 24):
        c.ell(x, 28, 2.5, 2, None, only=lambda a, b, x=x: K(m, 4 if a < x else 2)); c.p(x, 28, K('iron', 4))
    slab(c, 1, 3, 30, 7, 2, 'wood', t=6, f=3)               # 지붕(위에서 본 판 7줄, 몸보다 한 칸 넓다)
    # 지붕 위에 놓인 둘둘 만 밧줄과 쇠고리(윗면 위 물건 + 그늘)
    c.ell(9, 6, 3.2, 1.6, None, only=lambda x, y: K('straw', 5 if y < 6 else 3))
    c.ell(9, 6, 1.3, .6, K('straw', 2)); top_shadow(c, 7, 13, 8)
    ring(c, 22, 6, 2, 1, K('iron', 5)); c.p(23, 7, K('iron', 3)); top_shadow(c, 21, 25, 8)
    c.outline()

@REG.piece('arena emblem', '경기장 바닥 문장(2×2)', 'arena', 'flat', 2, 2, 0, 'flat',
           '모래 경기장 한가운데 사암 판에 새긴 둥근 월계관 문장(밟고 지나간다).', TAGS + ['경기장', '바닥 무늬'],
           '모래 경기장 정가운데.', ['arena fence 3', 'portcullis'], use=('walk',))
def arena_emblem(c):
    c.ell(15.5, 15.5, 14, 14, None, only=lambda x, y: K('straw', 3))
    c.ell(15.5, 15.5, 12.5, 12.5, None, only=lambda x, y: K('straw', 5 if (x // 4 + y // 4) % 2 else 4))
    ring(c, 15.5, 15.5, 12.5, 12.5, K('straw', 2))
    ring(c, 15.5, 15.5, 7, 7, K('straw', 2))
    for a in range(20, 341, 20):
        r = math.radians(a + 90)
        x = int(round(15.5 + 9.5 * math.cos(r))); y = int(round(15.5 + 9.5 * math.sin(r)))
        c.p(x, y, K('leaf', 3)); c.p(x + 1, y, K('leaf', 2))
    c.ell(15.5, 15.5, 2.5, 2.5, K('gold', 4))
    for x in range(31):
        for y in range(31):
            col = c.get(x, y)
            if col is None: continue
    c.edge_dark()


@REG.piece('war drum', '북(전투 신호)', 'arena', 'floor', 1, 1, 8, 'round_body',
           '나무 받침 위 가죽 북 — 경기 시작을 알린다(북채 둘).', TAGS + ['관중석', '경기장'],
           '관중석 끝·귀빈석 옆.', ['arena banner', 'tier back 3'], use=('play',))
def war_drum(c):
    c.shadow(1, 21, 15, 23)
    for x in (3, 12): line(c, x, 22, 8 if x == 3 else 7, 16, K('dwood', 3))
    cy = 5
    # 몸통(빨강, 왼쪽 밝음)
    for y in range(cy, 17):
        for x in range(2, 15):
            u = (x - 2) / 12
            if y > 13 and ((x - 8) / 7) ** 2 + ((y - 13) / 3.5) ** 2 > 1: continue
            c.p(x, y, K('red', 5 if u < .2 else 4 if u < .5 else 3 if u < .8 else 2))
    for x in range(3, 14, 2): line(c, x, 9, x + (1 if x < 8 else -1), 15, K('linen', 3))
    c.ell(8, cy, 6.5, 4, K('dwood', 2))                     # 테(앞쪽 둘레)
    c.ell(8, cy - .3, 5.6, 3.3, None, only=lambda x, y: K('linen', 6 if x < 7 and y < 5 else 5 if x < 11 else 4))   # 가죽 북면(위에서 본 타원)
    c.p(6, 3, K('white', 6))
    line(c, 13, 13, 15, 3, K('dwood', 5)); c.p(15, 2, K('linen', 5))   # 몸에 기댄 북채
    c.outline()


@REG.piece('laurel trophy', '월계관 우승 기둥', 'arena', 'floor', 1, 1, 16, 'column',
           '사암 기둥 받침 위 금빛 월계관과 종려 잎(우승자에게 주는 상).', TAGS + ['귀빈석', '우승'],
           '귀빈석·경기장 출입구 옆.', ['arena banner', 'war drum'], use=('search',))
def laurel_trophy(c):
    c.shadow(1, 29, 15, 31)
    m = 'straw'
    for y in range(13, 29):                                 # 둥근 사암 기둥 몸
        for x in range(2, 14):
            u = (x - 2) / 11
            if y > 26 and ((x - 7.5) / 6.5) ** 2 + ((y - 26) / 2.5) ** 2 > 1: continue
            c.p(x, y, K(m, 5 if u < .2 else 4 if u < .5 else 3 if u < .8 else 2))
    for x in (5, 9): c.vl(x, 15, 26, K(m, 2))                # 세로 홈
    c.ell(7.5, 12, 6, 3.6, K(m, 2))                         # 머리 앞 둘레
    c.ell(7.5, 11.3, 6, 3.3, None, only=lambda x, y: K(m, 6 if x < 6 else 5 if x < 11 else 4))   # 위에서 본 기둥 윗면
    c.hl(4, 11, 8, K(m, 3))                                 # 뒤 둘레
    # 윗면 위에 눕혀 놓은 금 월계관(타원 고리)과 그 그늘
    ring(c, 7.5, 11.5, 3.6, 1.7, K('gold', 4))
    for a in range(0, 360, 45):
        r = math.radians(a); c.p(int(round(7.5 + 4.3 * math.cos(r))), int(round(11.5 + 2.1 * math.sin(r))), K('gold', 6) if a < 180 else K('leaf', 4))
    c.hl(5, 10, 13, K(m, 3))
    # 뒤에 세운 종려 잎 둘
    line(c, 3, 9, 2, 1, K('leaf', 3)); line(c, 12, 9, 13, 1, K('leaf', 3))
    for y in range(2, 9, 2): c.p(1 + (y > 5), y, K('leaf', 4)); c.p(14 - (y > 5), y, K('leaf', 2))
    c.outline()

@REG.piece('curule seat', '귀빈 접이 의자', 'arena', 'floor', 1, 1, 8, 'seat',
           '귀빈석의 X자 금 다리 접이 의자, 자주 방석.', TAGS + ['귀빈석', '의자'],
           '귀빈석 높은 단 가운데, 양옆에 깃발.', ['arena banner', 'laurel trophy'], use=('sit',))
def curule_seat(c):
    c.shadow(1, 21, 15, 23)
    line(c, 2, 22, 13, 13, K('gold', 4)); line(c, 13, 22, 2, 13, K('gold', 3))
    line(c, 3, 22, 14, 13, K('gold', 2)); line(c, 12, 22, 1, 13, K('gold', 5))
    c.hl(1, 3, 22, K('gold', 4)); c.hl(12, 14, 22, K('gold', 3))
    box(c, 1, 5, 14, 5, 2, 'purple', t0=5, f0=3)            # 방석(위에서 본 면 5줄)
    c.hl(1, 14, 12, K('gold', 5)); c.hl(1, 14, 13, K('gold', 2))   # 금 틀
    c.p(7, 7, K('purple', 4)); c.p(8, 7, K('purple', 4))      # 방석 단추
    c.outline()

# ══ seats34 ══ 대기 후보(굽지 않음): 방석 윗면을 왼쪽 위에서 밝게, 단추 두 점(눈처럼 읽힘) 제거.
def curule_seat_seats34(c):
    c.shadow(1, 21, 15, 23)
    line(c, 2, 22, 13, 13, K('gold', 4)); line(c, 13, 22, 2, 13, K('gold', 3))
    line(c, 3, 22, 14, 13, K('gold', 2)); line(c, 12, 22, 1, 13, K('gold', 5))
    c.hl(1, 3, 22, K('gold', 4)); c.hl(12, 14, 22, K('gold', 3))
    for j in range(5):                                    # 방석 윗면 5줄: 위·왼쪽 밝게 → 아래·오른쪽 어둡게
        for i in range(14):
            t = 6 - (j >= 2) - (j >= 4) - (i >= 10) - (i >= 13)
            c.p(1 + i, 5 + j, K('purple', max(3, t)))
    c.hl(1, 14, 10, K('purple', 3)); c.hl(1, 14, 11, K('purple', 2))   # 방석 앞면 2줄
    c.p(14, 10, K('purple', 2)); c.p(14, 11, K('purple', 1))
    c.hl(1, 14, 4, K('purple', 1)); c.vl(0, 5, 11, K('purple', 0)); c.vl(15, 5, 11, K('purple', 0))
    c.hl(1, 14, 12, K('gold', 5)); c.hl(1, 14, 13, K('gold', 2))   # 금 틀
    c.outline()
# ══ seats34 ══
