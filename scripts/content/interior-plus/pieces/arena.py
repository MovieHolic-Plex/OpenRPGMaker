"""투기장·콜로세움 — 모래 경기장(sand)·관중석 돌계단·나무 울짱·쇠창살 문·검투사 무기 걸이·대기 감방 소품. 사암 판석(sandstone)·사암 벽(arenawall)과 함께 쓴다.
이미 v5 에 있는 화로·벽 횃불·족쇄·짚 더미·감방 침상·오물통·깃발·석상·돌 기둥은 그대로 쓴다."""
import math
from iplib import REG, K, shift, box, cyl, ring, Cv, hnoise, poly, line, barrel

TAGS = ['투기장', '콜로세움']


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
    c.shadow(1, 21, 47, 23)
    for x in range(2, 46, 6):
        c.rect(x, 9, x + 4, 22, K(m, 4)); c.vl(x, 9, 22, K(m, 5)); c.vl(x + 4, 9, 22, K(m, 2))
        c.hl(x, x + 4, 22, K(m, 1)); c.p(x + 2, 8, K(m, 5))
    box(c, 1, 5, 46, 3, 2, m, t0=5, f0=3)
    c.hl(1, 46, 16, K('iron', 4)); c.hl(1, 46, 17, K('iron', 2))
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
    m = 'dwood'
    c.shadow(1, 28, 15, 31)
    # 두 기둥 + 가로 굴대(감긴 쇠사슬) + 손잡이 바퀴
    for x in (2, 12):
        box(c, x, 12, 3, 2, 14, m, t0=5, f0=3)
    c.rect(4, 15, 12, 19, K(m, 3)); c.hl(4, 12, 15, K(m, 5))
    for i in range(4, 13): c.p(i, 16 + (i % 2), K('iron', 5 if i % 2 else 3)); c.p(i, 18 - (i % 2), K('iron', 4))
    ring(c, 8, 17, 4, 4.5, K('dwood', 5))
    for a in range(0, 360, 60):
        r = math.radians(a); line(c, 8, 17, int(round(8 + 4 * math.cos(r))), int(round(17 + 4.5 * math.sin(r))), K('dwood', 4))
    c.p(8, 17, K('iron', 5))
    for y in range(0, 12, 2): c.p(7, y, K('iron', 4)); c.p(7, y + 1, K('iron', 2))   # 위로 오르는 사슬
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
    c.shadow(3, 28, 14, 31)
    box(c, 4, 25, 8, 2, 3, 'dwood', t0=4, f0=3)
    c.vl(7, 8, 25, K('dwood', 4)); c.vl(8, 8, 25, K('dwood', 2))
    c.ell(7.5, 17, 4, 5.5, None, only=lambda x, y: K('straw', 5 if x < 7 and y < 17 else 4 if x < 9 else 3))
    for y in (14, 19): c.hl(4, 11, y, K('dwood', 2))          # 묶은 끈
    c.hl(0, 15, 12, K('dwood', 4)); c.hl(0, 15, 13, K('dwood', 2))   # 팔 막대(몸 앞)
    for x in (0, 15): c.vl(x, 11, 15, K('straw', 4))           # 손 짚
    c.ell(7.5, 6, 2.6, 2.8, None, only=lambda x, y: K('straw', 5 if x < 7 and y < 6 else 4 if x < 9 else 3))   # 짚 뭉치 머리(얼굴 없음)
    for y in range(4, 9, 2): c.hl(6, 9, y, K('straw', 2))
    c.p(7, 2, K('straw', 4)); c.p(8, 2, K('straw', 3)); c.hl(5, 10, 9, K('dwood', 2))
    c.outline()


@REG.piece('archery target', '짚 과녁', 'arena', 'floor', 1, 1, 16, 'frame',
           '나무 세 다리 위 둥근 짚 과녁(빨강·흰 고리), 화살 하나 꽂힘.', TAGS + ['연습장'],
           '연습장 끝 벽 쪽, 앞 3칸 비운다.', ['training dummy', 'arrow barrel'])
def archery_target(c):
    c.shadow(2, 28, 15, 31)
    line(c, 4, 29, 7, 14, K('dwood', 4)); line(c, 12, 29, 9, 14, K('dwood', 2)); c.vl(8, 16, 28, K('dwood', 3))
    c.ell(7.5, 11, 6, 6.5, None, only=lambda x, y: K('straw', 5 if x + y < 17 else 4 if x + y < 21 else 3))
    ring(c, 7.5, 11, 4, 4.3, K('red', 4)); ring(c, 7.5, 11, 2, 2.2, K('white', 6)); c.ell(7.5, 11, .9, .9, K('red', 4))
    line(c, 9, 10, 13, 6, K('dwood', 5)); c.p(13, 5, K('white', 6)); c.p(14, 6, K('white', 5))
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
    c.shadow(1, 28, 31, 31)
    # 지붕(윗면) + 바닥 판 + 창살
    box(c, 1, 2, 30, 5, 2, m, t0=5, f0=3)
    c.rect(2, 10, 29, 24, K('black', 1))
    for x in range(3, 29): c.p(x, 23, K('straw', 3 if x % 3 else 4)); c.p(x, 22, K('straw', 2) if x % 4 == 0 else K('black', 1))
    for x in range(3, 29, 4): c.vl(x, 10, 24, K('iron', 5)); c.vl(x + 1, 10, 24, K('iron', 3))
    c.vl(1, 2, 25, K(m, 4)); c.vl(30, 2, 25, K(m, 2))
    box(c, 1, 24, 30, 1, 2, m, t0=4, f0=3)
    for x in (6, 25):
        c.ell(x, 28, 3, 2.5, None, only=lambda a, b, x=x: K(m, 4 if a < x else 2)); c.p(x, 28, K('iron', 4))
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
    c.shadow(1, 28, 15, 31)
    for x in (3, 12): line(c, x, 29, 8 if x == 3 else 7, 21, K('dwood', 3))
    cy = cyl(c, 8, 6, 6.5, 3, 13, 'red', t0=5, cap='linen')
    for x in range(2, 15, 2): line(c, x, 10, x + (1 if x < 8 else -1), 21, K('linen', 4))
    c.hl(2, 14, 21, K('dwood', 3))
    line(c, 4, 8, 11, 5, K('dwood', 5)); line(c, 5, 5, 12, 8, K('dwood', 4))   # 북 머리 위에 엇갈려 놓은 북채
    c.p(11, 5, K('linen', 5)); c.p(12, 8, K('linen', 5))
    c.outline()


@REG.piece('laurel trophy', '월계관 우승 기둥', 'arena', 'floor', 1, 1, 16, 'column',
           '사암 기둥 받침 위 금빛 월계관과 종려 잎(우승자에게 주는 상).', TAGS + ['귀빈석', '우승'],
           '귀빈석·경기장 출입구 옆.', ['arena banner', 'war drum'], use=('search',))
def laurel_trophy(c):
    c.shadow(2, 28, 15, 31)
    box(c, 3, 16, 10, 3, 10, 'straw', t0=5, f0=3)
    c.hl(4, 11, 21, K('straw', 2))
    for a in range(0, 360, 20):
        r = math.radians(a)
        c.p(int(round(8 + 4.4 * math.cos(r))), int(round(11 + 2.2 * math.sin(r))), K('gold', 5 if a < 180 else 4))
    for a in range(10, 360, 40):
        r = math.radians(a)
        c.p(int(round(8 + 5.2 * math.cos(r))), int(round(11 + 2.8 * math.sin(r))), K('gold', 6))
    line(c, 3, 15, 1, 2, K('leaf', 3)); line(c, 13, 15, 14, 2, K('leaf', 3))
    for y in range(3, 14, 2): c.p(1 + (y > 8), y, K('leaf', 4)); c.p(14 - (y > 8), y, K('leaf', 2))
    c.outline()


@REG.piece('curule seat', '귀빈 접이 의자', 'arena', 'floor', 1, 1, 8, 'seat',
           '귀빈석의 X자 금 다리 접이 의자, 자주 방석.', TAGS + ['귀빈석', '의자'],
           '귀빈석 높은 단 가운데, 양옆에 깃발.', ['arena banner', 'laurel trophy'], use=('sit',))
def curule_seat(c):
    c.shadow(1, 28, 15, 31)
    line(c, 2, 29, 13, 17, K('gold', 4)); line(c, 13, 29, 2, 17, K('gold', 3))
    line(c, 3, 29, 14, 17, K('gold', 2)); line(c, 12, 29, 1, 17, K('gold', 5))
    c.rect(1, 12, 14, 16, K('purple', 4)); c.hl(1, 14, 12, K('purple', 5)); c.hl(2, 13, 13, K('purple', 5)); c.hl(1, 14, 16, K('purple', 2))
    c.hl(1, 14, 17, K('gold', 5)); c.p(1, 18, K('gold', 3)); c.p(14, 18, K('gold', 3))
    c.outline()
