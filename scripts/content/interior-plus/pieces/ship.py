"""배 안 — 선장실·주방·화물칸·선원 선실·조타실·포 갑판·감방. 굽은 선체 판벽(hull)·선장실 판벽(cabin)·갑판 널(deck)·화물칸 널(hold)과 함께 쓴다.
이미 v5 에 있는 해먹·조타륜·함포(정면)·선원 궤짝·밧줄 더미·닻·해도 탁자·배 종·그물 덮은 화물·그물은 그대로 쓰고 새로 그리지 않는다."""
import math
from iplib import REG, K, shift, box, cyl, ring, Cv, hnoise, poly, line, barrel, barrel_side

TAGS = ['배 안', '선실']


@REG.piece('porthole', '놋쇠 둥근 창(배)', 'ship', 'hang', 1, 0, 0, 'wall_mounted',
           '선체 벽에 낸 놋쇠 테 둥근 창, 유리 너머 바다와 하늘, 둘레 리벳.', TAGS + ['창'],
           '선체 벽면 윗줄에 2~3칸 간격으로.', ['stern windows', 'ship lantern'], use=('light',))
def porthole(c):
    c.ell(7.5, 11, 6, 6, None, only=lambda x, y: K('brass', 5 if x + y < 17 else 4 if x + y < 22 else 2))
    c.ell(7.5, 11, 4, 4, None, only=lambda x, y: K('blue', 5) if y < 10 else K('water', 4 if (x + y) % 4 else 5))
    c.p(5, 9, K('glass', 6)); c.p(6, 8, K('glass', 6)); c.p(5, 10, K('glass', 5))
    for a in range(0, 360, 60):
        x = 7.5 + 5.2 * math.cos(math.radians(a)); y = 11 + 5.2 * math.sin(math.radians(a))
        c.p(int(round(x)), int(round(y)), K('brass', 6))
    c.outline()
    for x in range(3, 15): c.p(x, 18, (0x1c, 0x14, 0x18, 80))


@REG.piece('stern windows', '선미 격자 창(3칸)', 'ship', 'hang', 3, 0, 0, 'wall_mounted',
           '선장실 뒷벽의 넓은 격자 유리창 — 작은 유리 여럿, 나무 문설주, 바다 빛.', TAGS + ['선장실', '창'],
           '선장실 북쪽 벽면 가운데. 앞에 선장 책상.', ['captain desk', 'porthole'], use=('light',))
def stern_windows(c):
    m = 'dwood'
    c.rect(1, 2, 46, 26, K(m, 3))
    c.hl(1, 46, 2, K(m, 5)); c.hl(1, 46, 3, K(m, 4)); c.hl(1, 46, 26, K(m, 1)); c.hl(1, 46, 25, K(m, 2))
    for i in range(5):
        x0 = 3 + i * 9
        for y in range(5, 24):
            for x in range(x0, x0 + 7):
                sea = y >= 15
                col = K('water', 4 if (x + y) % 5 else 5) if sea else K('blue', 5 if y < 10 else 6)
                if (x - x0 + y) % 7 in (1, 2) and not sea: col = K('glass', 6)
                c.p(x, y, col)
        for y in range(5, 24): c.p(x0 + 3, y, K(m, 4))            # 가운데 살
        c.hl(x0, x0 + 6, 14, K(m, 4))
        c.vl(x0 - 1, 4, 24, K(m, 5)); c.vl(x0 + 7, 4, 24, K(m, 2))
    c.hl(2, 45, 24, K('brass', 4))
    c.outline()
    for x in range(1, 47): c.p(x, 28, (0x1c, 0x14, 0x18, 80))


@REG.piece('captain bed', '선장 침대(붙박이)', 'ship', 'wall', 2, 2, 8, 'low_furniture',
           '북쪽 벽에 붙인 나무 상자 침대 — 붉은 이불, 흰 베개, 아래 서랍 둘.', TAGS + ['선장실', '침대'],
           '선장실 북쪽 벽 앞 구석. 옆에 선원 궤짝.', ['sea chest', 'captain desk'], use=('sleep',))
def captain_bed(c):
    m = 'dwood'
    # 머리판(벽 쪽, 8px 솟음) — 발밑 두 줄은 y 16..47
    box(c, 1, 9, 30, 2, 6, m, t0=5, f0=3)
    for x in range(4, 28, 6): c.p(x, 13, K('brass', 5))
    # 침상 틀(윗면 = 매트·이불)
    box(c, 1, 18, 30, 17, 9, m, t0=4, f0=3)
    c.rect(3, 19, 28, 33, K('linen', 5))
    c.rect(3, 25, 28, 34, K('red', 4)); c.hl(3, 28, 25, K('red', 5)); c.hl(3, 28, 34, K('red', 2))
    for x in range(5, 28, 4): c.p(x, 29, K('red', 3)); c.p(x + 2, 31, K('red', 3))
    c.rect(5, 20, 13, 23, K('white', 6)); c.hl(5, 13, 23, K('white', 4)); c.rect(18, 20, 26, 23, K('white', 6)); c.hl(18, 26, 23, K('white', 4))
    for x0 in (4, 17):
        c.rect(x0, 37, x0 + 10, 42, K(m, 4)); c.hl(x0, x0 + 10, 37, K(m, 5)); c.hl(x0, x0 + 10, 42, K(m, 2))
        c.p(x0 + 5, 39, K('brass', 5))
    c.shadow(1, 44, 31, 47)
    c.outline()


@REG.piece('captain desk', '선장 책상(2칸)', 'ship', 'floor', 2, 1, 8, 'low_furniture',
           '무거운 나무 책상 — 항해 일지, 깃펜과 잉크병, 놋쇠 나침반, 촛대.', TAGS + ['선장실', '책상'],
           '선장실 가운데·선미 창 앞, 앞(남쪽)에 의자.', ['stern windows', 'chair'], use=('read', 'search'))
def captain_desk(c):
    m = 'dwood'
    box(c, 1, 4, 30, 7, 9, m, t0=4, f0=3)
    c.hl(2, 29, 4, K(m, 6))
    # 다리 사이 그늘·서랍
    c.rect(11, 15, 20, 19, K(m, 1))
    for x0 in (3, 22):
        c.rect(x0, 14, x0 + 6, 18, K(m, 4)); c.hl(x0, x0 + 6, 14, K(m, 5)); c.p(x0 + 3, 16, K('brass', 5))
    c.vl(1, 20, 22, K(m, 2)); c.vl(30, 20, 22, K(m, 1))
    # 책상 위 물건
    c.rect(4, 5, 11, 9, K('red', 2)); c.rect(5, 5, 11, 8, K('linen', 6)); c.vl(8, 5, 8, K('linen', 3))   # 펼친 일지
    for x in (6, 10): c.p(x, 6, K('linen', 4)); c.p(x, 7, K('linen', 4))
    c.ell(15, 7, 1.5, 1, K('black', 1)); c.p(15, 6, K('black', 4)); line(c, 16, 6, 19, 2, K('white', 6))   # 잉크·깃펜
    c.ell(23.5, 7, 2.5, 1.6, None, only=lambda x, y: K('brass', 5 if x < 24 else 3)); c.p(23, 7, K('red', 4)); c.p(24, 7, K('white', 6))  # 나침반
    c.vl(28, 1, 6, K('linen', 6)); c.p(28, 0, K('orange', 6)); c.ell(28, 7, 1.5, .8, K('brass', 4))   # 촛대
    c.shadow(1, 22, 31, 23)
    c.outline()


@REG.piece('barrel stack', '통 더미(2칸)', 'ship', 'floor', 2, 1, 16, 'round_body',
           '세운 나무 통 둘 위에 하나를 더 얹은 더미(쇠테).', TAGS + ['화물칸', '통'],
           '화물칸·주방 구석, 벽에 붙여. 통로 2칸 남긴다.', ['crate stack', 'sack pile'])
def barrel_stack(c):
    c.shadow(1, 28, 31, 31)
    barrel(c, 8.5, 15, rx=6.5, ry=2.6, h=11)
    barrel(c, 23.5, 15, rx=6.5, ry=2.6, h=11)
    barrel(c, 16, 3, rx=6.5, ry=2.6, h=11)
    c.outline()


@REG.piece('cask rack', '물통 거치대(2칸)', 'ship', 'floor', 2, 1, 8, 'round_body',
           '나무 받침에 눕힌 큰 물통(꼭지 달림) — 선원 마실 물·럼.', TAGS + ['주방', '화물칸', '통'],
           '주방·화물칸 벽 앞, 꼭지 앞 1칸 비운다.', ['barrel stack', 'galley stove'], use=('search',))
def cask_rack(c):
    c.shadow(1, 20, 31, 23)
    # 받침(X 다리)
    for x0 in (5, 22):
        line(c, x0, 21, x0 + 4, 14, K('dwood', 3)); line(c, x0 + 4, 21, x0, 14, K('dwood', 2))
    c.rect(3, 19, 28, 20, K('dwood', 3)); c.hl(3, 28, 19, K('dwood', 5))
    barrel_side(c, 6, 11, 22, 7)
    c.p(3, 12, K('brass', 5)); c.p(2, 12, K('brass', 3)); c.p(2, 13, K('brass', 4))   # 꼭지
    c.outline()


@REG.piece('crate stack', '밧줄 묶은 궤짝 더미(2칸)', 'ship', 'floor', 2, 1, 16, 'box',
           '나무 궤짝 셋을 쌓아 밧줄로 묶은 화물.', TAGS + ['화물칸', '화물'],
           '화물칸 벽·구석에 줄지어. 통로를 막지 않게.', ['barrel stack', 'cargo netted'])
def crate_stack(c):
    c.shadow(1, 28, 31, 31)
    m = 'pine'
    def crate(x, y, w, d, h):
        box(c, x, y, w, d, h, m, t0=4, f0=3)
        for i in (x + 1, x + w - 2): c.vl(i, y + d + 1, y + d + h - 1, K(m, 2))
        line(c, x + 2, y + d + 1, x + w - 3, y + d + h - 1, K(m, 2))
        c.hl(x + 1, x + w - 2, y + d // 2, K(m, 5))
    crate(1, 14, 15, 4, 11); crate(16, 14, 15, 4, 11); crate(7, 3, 16, 4, 9)
    # 밧줄
    for y in range(4, 27): c.p(15 if y < 14 else 9, y, K('straw', 4 if y % 2 else 3))
    c.hl(1, 30, 22, K('straw', 4)); c.hl(7, 22, 9, K('straw', 4))
    c.outline()


@REG.piece('sack pile', '곡식 자루 더미(2칸)', 'ship', 'floor', 2, 1, 8, 'organic',
           '삼베 곡식 자루 다섯을 쌓은 더미.', TAGS + ['화물칸', '주방', '자루'],
           '화물칸·주방 식료 구석.', ['barrel stack', 'crate stack'])
def sack_pile(c):
    c.shadow(1, 20, 31, 23)
    m = 'linen'
    def sack(cx, cy, rx, ry):
        c.ell(cx, cy, rx, ry, None, only=lambda x, y: K(m, 4 if (x - cx) + (y - cy) < -2 else 3 if (x - cx) < rx * .4 else 2))
        c.p(int(cx) - 1, int(cy - ry), K(m, 2)); c.p(int(cx), int(cy - ry) - 1, K('straw', 4)); c.p(int(cx) + 1, int(cy - ry), K(m, 2))
        c.p(int(cx), int(cy), K(m, 3))
    sack(6, 16, 5, 5); sack(16, 17, 5.5, 4.5); sack(26, 16, 5, 5); sack(11, 9, 5, 4.5); sack(21, 9, 5, 4.5)
    c.p(10, 18, K('red', 3)); c.p(22, 9, K('blue', 3))
    c.outline()


@REG.piece('galley stove', '배 주방 화덕(쇠)', 'ship', 'wall', 2, 1, 32, 'container',
           '벽 앞 쇠 화덕 — 불 붙은 아궁이, 위에 끓는 무쇠 솥, 천장으로 오르는 연통.', TAGS + ['주방', '화덕'],
           '주방 북쪽 벽 앞 첫 바닥 줄. 옆에 물통·조리대.', ['pot rack', 'cask rack'], use=('search',))
def galley_stove(c):
    m = 'iron'
    c.shadow(1, 44, 31, 47)
    # 연통(위로)
    c.rect(20, 0, 24, 18, K(m, 3)); c.vl(20, 0, 18, K(m, 4)); c.vl(24, 0, 18, K(m, 1)); c.hl(19, 25, 6, K(m, 5)); c.hl(19, 25, 7, K(m, 2))
    # 화덕 몸(벽돌 받침 위 쇠 상자)
    box(c, 1, 18, 30, 8, 18, m, t0=3, f0=2)
    for x in range(3, 29, 6): c.p(x, 20, K(m, 4)); c.p(x + 2, 23, K(m, 4))
    # 아궁이 불
    c.rect(5, 31, 14, 39, K(m, 0))
    for y in range(34, 40):
        for x in range(6, 14):
            c.p(x, y, K('orange', 5 if (x + y) % 3 else 6) if y > 35 else K('red', 3 if x % 2 else 4))
    c.hl(5, 14, 30, K(m, 5))
    c.rect(18, 31, 27, 34, K(m, 3)); c.hl(18, 27, 31, K(m, 4)); c.p(26, 32, K('brass', 5))   # 오븐 문
    # 솥(윗면 위)
    c.ell(11, 21, 6, 3, None, only=lambda x, y: K(m, 2))
    c.ell(11, 20, 5, 2, None, only=lambda x, y: K('meat', 3 if (x + y) % 3 else 4))
    for x, y in ((9, 17), (12, 16), (10, 14)): c.p(x, y, K('white', 4))      # 김
    c.outline()


@REG.piece('pot rack', '냄비 걸이(2칸)', 'ship', 'hang', 2, 0, 0, 'wall_mounted',
           '벽에 건 나무 막대에 매단 구리 냄비·국자·프라이팬.', TAGS + ['주방'],
           '주방 벽면 윗줄, 화덕 옆.', ['galley stove'])
def pot_rack(c):
    c.hl(2, 29, 4, K('dwood', 5)); c.hl(2, 29, 5, K('dwood', 2)); c.p(2, 3, K('iron', 4)); c.p(29, 3, K('iron', 4))
    # 냄비들
    for cx, r, m in ((7, 4, 'clay'), (17, 3.5, 'clay'), (26, 3, 'iron')):
        c.vl(int(cx), 6, 8, K('iron', 3))
        c.ell(cx, 12, r, r, None, only=lambda x, y, cx=cx, m=m: K(m, 5 if x < cx - 1 and y < 12 else 4 if x < cx + 1 else 2))
        c.ell(cx, 12, r - 1.5, r - 1.5, None, only=lambda x, y, m=m: K(m, 1))
    # 국자
    c.vl(12, 6, 15, K('iron', 4)); c.ell(12, 17, 1.5, 1.2, K('iron', 3))
    c.vl(21, 6, 13, K('dwood', 4)); c.rect(20, 14, 22, 15, K('dwood', 3))
    c.outline()


@REG.piece('dice barrel', '주사위 통 탁자', 'ship', 'floor', 1, 1, 8, 'round_body',
           '탁자로 쓰는 세운 통 — 윗면에 주사위 둘과 나무 잔.', TAGS + ['선원 선실', '놀이'],
           '선원 선실 가운데, 둘레에 걸상.', ['stool', 'hammock'], use=('play',))
def dice_barrel(c):
    c.shadow(2, 28, 15, 31)
    barrel(c, 8, 9, rx=6, ry=3, h=14)
    c.rect(4, 10, 5, 11, K('white', 6)); c.p(4, 10, K('black', 2)); c.rect(7, 12, 8, 13, K('white', 5)); c.p(8, 13, K('black', 2))
    c.ell(11, 10, 1.5, 1, K('pine', 4)); c.p(11, 9, K('pine', 6)); c.p(11, 10, K('bread', 2))
    c.outline()


def cannon_side(c, east=True):
    """옆을 보는 함포(포가 위): 포신이 동쪽(east) 또는 서쪽으로."""
    m = 'iron'; w = 'dwood'
    c.shadow(1, 20, 31, 23)
    # 포가(나무 받침, 바퀴)
    box(c, 4, 12, 22, 4, 4, w, t0=4, f0=3)
    for x in (7, 22):
        c.ell(x, 20, 3, 2.4, None, only=lambda a, b, x=x: K(w, 4 if a < x else 2)); c.p(x, 20, K('iron', 4))
    # 포신
    pts = [(2, 7), (26, 8), (26, 13), (2, 14)] if east else [(29, 7), (5, 8), (5, 13), (29, 14)]
    poly(c, pts, lambda x, y: K(m, 5 if y < 9 else 4 if y < 11 else 2))
    if east:
        c.rect(26, 7, 29, 14, K(m, 3)); c.ell(29, 10.5, 1.2, 3.5, K(m, 1)); c.vl(26, 7, 14, K(m, 5))
        c.ell(3, 10.5, 2, 2.5, None, only=lambda x, y: K(m, 4)); c.p(1, 10, K(m, 3))
        for x in (10, 18): c.vl(x, 7, 14, K(m, 5))
    else:
        c.rect(2, 7, 5, 14, K(m, 3)); c.ell(2, 10.5, 1.2, 3.5, K(m, 1)); c.vl(5, 7, 14, K(m, 5))
        c.ell(28, 10.5, 2, 2.5, None, only=lambda x, y: K(m, 4)); c.p(30, 10, K(m, 3))
        for x in (13, 21): c.vl(x, 7, 14, K(m, 5))
    c.hl(6, 25, 8, K(m, 6))
    c.outline()


@REG.piece('cannon east', '옆 보는 함포(동쪽 포문)', 'ship', 'floor', 2, 1, 8, 'other',
           '바퀴 달린 나무 포가 위 무쇠 함포, 포구가 동쪽(오른쪽) 선체 포문을 향한다.', TAGS + ['포 갑판', '대포'],
           '포 갑판 동쪽 벽 바로 앞, 포구 끝이 벽에 닿게. 2~3칸 간격으로 줄 세운다.', ['cannonball pile', 'powder keg'], facing='E')
def cannon_east(c): cannon_side(c, True)


@REG.piece('cannon west', '옆 보는 함포(서쪽 포문)', 'ship', 'floor', 2, 1, 8, 'other',
           '바퀴 달린 나무 포가 위 무쇠 함포, 포구가 서쪽(왼쪽) 선체 포문을 향한다.', TAGS + ['포 갑판', '대포'],
           '포 갑판 서쪽 벽 바로 앞, 포구 끝이 벽에 닿게. 2~3칸 간격으로 줄 세운다.', ['cannonball pile', 'powder keg'], facing='W')
def cannon_west(c): cannon_side(c, False)


@REG.piece('cannonball pile', '포탄 더미', 'ship', 'floor', 1, 1, 0, 'debris',
           '나무 테두리 안에 피라미드로 쌓은 무쇠 포탄.', TAGS + ['포 갑판', '대포'],
           '함포 옆 1칸.', ['cannon east', 'powder keg'])
def cannonball_pile(c):
    box(c, 1, 9, 14, 3, 3, 'dwood', t0=4, f0=3)
    for cx, cy in ((4, 9), (8, 9), (12, 9), (6, 6), (10, 6), (8, 3)):
        c.ell(cx, cy, 2.2, 2.2, None, only=lambda x, y, cx=cx, cy=cy: K('iron', 5 if x < cx and y < cy else 3 if x + y < cx + cy + 2 else 1))
    c.outline()


@REG.piece('powder keg', '화약 통', 'ship', 'floor', 1, 1, 0, 'round_body',
           '검게 칠한 작은 화약 통(붉은 띠).', TAGS + ['포 갑판', '화물칸', '통'],
           '함포 뒤·화약고 벽 앞에 2~3개.', ['cannon east', 'cannonball pile'])
def powder_keg(c):
    c.shadow(2, 12, 15, 15)
    barrel(c, 8, 1, rx=5, ry=2.4, h=9, m='black', hoop='red')
    c.p(8, 3, K('black', 1)); c.p(7, 3, K('linen', 5))
    c.outline()


@REG.piece('gunport', '포문(열림)', 'ship', 'hang', 1, 0, 0, 'wall_mounted',
           '선체 벽의 네모 포문 — 뚜껑을 위로 들어 올려 바다가 보인다.', TAGS + ['포 갑판', '창'],
           '포 갑판 벽면 윗줄, 함포 바로 위 벽.', ['cannon east', 'porthole'], use=('light',))
def gunport(c):
    c.rect(2, 9, 13, 21, K('dwood', 1))
    for y in range(10, 21):
        for x in range(3, 13): c.p(x, y, K('blue', 5) if y < 15 else K('water', 4 if (x + y) % 4 else 5))
    c.hl(2, 13, 9, K('dwood', 5)); c.vl(2, 9, 21, K('dwood', 4)); c.vl(13, 9, 21, K('dwood', 2)); c.hl(2, 13, 21, K('dwood', 2))
    # 들어 올린 뚜껑(위로 비스듬)
    for y in range(2, 8):
        for x in range(2, 14): c.p(x, y, K('dwood', 4 if y < 4 else 3))
    c.hl(2, 13, 2, K('dwood', 5)); c.p(4, 8, K('iron', 3)); c.p(11, 8, K('iron', 3))
    c.outline()


@REG.piece('mast', '돛대 밑동', 'ship', 'floor', 1, 1, 32, 'column',
           '갑판을 뚫고 오르는 굵은 둥근 돛대 — 쇠테, 둘레에 밧줄 걸이 핀.', TAGS + ['갑판', '기둥'],
           '배 안 큰 방 가운데 줄(앞뒤로). 둘레 1칸 비운다.', ['capstan', 'rope pin rail'])
def mast(c):
    m = 'pine'
    c.shadow(1, 44, 15, 47)
    # 받침 칼라(팔각 나무)
    box(c, 1, 37, 14, 3, 6, 'dwood', t0=4, f0=3)
    for y in range(0, 39):
        for x in range(4, 12):
            u = (x - 4) / 8
            c.p(x, y, K(m, 5 if u < .25 else 4 if u < .5 else 3 if u < .8 else 2))
    for y in (8, 22): c.hl(4, 11, y, K('iron', 4)); c.hl(4, 11, y + 1, K('iron', 2))
    # 핀 + 감은 밧줄
    for x, y in ((2, 33), (13, 33)): c.vl(x, y - 3, y, K('dwood', 4))
    c.ell(7.5, 31, 5.5, 2, None, only=lambda x, y: K('straw', 4 if (x + y) % 2 else 3))
    c.outline()


@REG.piece('capstan', '닻 감는 고패', 'ship', 'floor', 1, 1, 8, 'round_body',
           '굵은 나무 원통 고패, 위에 지렛대 꽂는 구멍과 쇠 테.', TAGS + ['갑판', '조타실'],
           '배 큰 방 가운데·돛대 앞뒤 1칸 띄워.', ['mast', 'anchor'])
def capstan(c):
    c.shadow(1, 28, 15, 31)
    cy = cyl(c, 8, 12, 6.5, 3, 13, 'dwood', t0=6)
    for x in range(3, 14, 3): c.vl(x, 19, 27, K('dwood', 2))
    c.ell(8, 15, 5, 2, None, only=lambda x, y: K('dwood', 6 if x < 7 else 5))
    c.hl(2, 14, 18, K('iron', 4)); c.hl(2, 14, 26, K('iron', 3))
    for x, y in ((5, 14), (8, 13), (11, 14), (8, 16)): c.p(x, y, K('dwood', 1))
    c.ell(8, 15, 1.5, .8, K('iron', 5))
    c.outline()


@REG.piece('ship ladder', '갑판 사다리', 'ship', 'wall', 1, 1, 32, 'frame',
           '북쪽 벽에 기대 위 갑판 승강구로 오르는 나무 사다리(위에 열린 구멍).', TAGS + ['갑판', '사다리'],
           '배 안 방 북쪽 벽 앞 첫 바닥 줄. 앞 1칸 비운다. 층 이동은 links 로 단다.', ['mast'], use=('travel',))
def ship_ladder(c):
    m = 'pine'
    c.rect(1, 0, 14, 5, K('black', 1)); c.hl(1, 14, 5, K('dwood', 4)); c.hl(1, 14, 0, K('dwood', 2))   # 승강구
    for x in (3, 12):
        for y in range(1, 47): c.p(x, y, K(m, 5 if x == 3 else 3)); c.p(x + 1, y, K(m, 2))
    for y in range(6, 46, 5): c.hl(4, 11, y, K(m, 5)); c.hl(4, 11, y + 1, K(m, 2))
    c.shadow(2, 44, 15, 47)
    c.outline()


@REG.piece('deck grate', '화물 승강구 창살', 'ship', 'flat', 2, 2, 0, 'flat',
           '갑판 바닥의 나무 격자 승강구 덮개 — 밟고 지나간다.', TAGS + ['갑판', '화물칸'],
           '배 큰 방 바닥 가운데.', ['mast', 'crate stack'], use=('walk',))
def cargo_hatch(c):
    m = 'dwood'
    c.rect(1, 1, 30, 30, K(m, 2))
    c.hl(1, 30, 1, K(m, 4)); c.vl(1, 1, 30, K(m, 4)); c.hl(1, 30, 30, K(m, 1)); c.vl(30, 1, 30, K(m, 1))
    for y in range(3, 29):
        for x in range(3, 29):
            gx, gy = (x - 3) % 5, (y - 3) % 5
            c.p(x, y, K(m, 5 if gy == 0 else 4) if gy <= 1 or gx <= 1 else K('black', 1))
    c.hl(1, 30, 0, K(m, 1)); c.vl(0, 0, 31, K(m, 1))


@REG.piece('binnacle', '나침반 함', 'ship', 'floor', 1, 1, 16, 'container',
           '조타륜 앞 나무 기둥 위 놋쇠 나침반 함(유리 돔 속 나침반).', TAGS + ['조타실'],
           '조타실 조타륜 바로 앞(남쪽) 1칸.', ['ship wheel', 'chart table'], use=('read',))
def binnacle(c):
    c.shadow(3, 28, 14, 31)
    box(c, 4, 15, 8, 2, 12, 'dwood', t0=5, f0=3)
    for y in (20, 25): c.hl(4, 11, y, K('brass', 4))
    # 놋쇠 그릇 + 유리 덮개(속 나침반 판이 위에서 보인다)
    c.ell(8, 12, 5.5, 3, None, only=lambda x, y: K('brass', 5 if x < 7 else 4 if x < 10 else 2))
    c.ell(8, 11, 4, 2.2, None, only=lambda x, y: K('linen', 6 if x < 8 else 5))
    c.p(6, 11, K('red', 4)); c.p(7, 11, K('red', 4)); c.p(9, 11, K('black', 3)); c.p(10, 11, K('black', 3)); c.p(8, 11, K('brass', 3))
    c.p(8, 10, K('black', 4)); c.p(8, 12, K('black', 4))
    c.hl(5, 7, 9, K('glass', 6)); c.p(9, 9, K('glass', 5))
    c.outline()


@REG.piece('instrument shelf', '항해 도구 선반(2칸)', 'ship', 'hang', 2, 0, 0, 'wall_mounted',
           '벽 선반 위 망원경·모래시계·육분의·말아 둔 해도.', TAGS + ['조타실', '선장실'],
           '조타실·선장실 벽면 윗줄.', ['chart table', 'binnacle'], use=('search',))
def instrument_shelf(c):
    m = 'dwood'
    c.hl(1, 30, 16, K(m, 5)); c.hl(1, 30, 17, K(m, 3)); c.hl(1, 30, 18, K(m, 1))
    for x in (4, 27): c.vl(x, 19, 22, K(m, 2))
    # 망원경(누운)
    c.rect(2, 13, 11, 15, K('brass', 4)); c.hl(2, 11, 13, K('brass', 6)); c.rect(9, 12, 11, 15, K('brass', 3)); c.ell(2, 14, .8, 1.5, K('glass', 5))
    # 모래시계
    c.hl(14, 18, 7, K(m, 4)); c.hl(14, 18, 15, K(m, 3))
    for y in range(8, 15):
        r = abs(y - 11) // 2 + 1
        for x in range(16 - r, 17 + r): c.p(x, y, K('glass', 5))
    for y in range(12, 15): c.p(16, y, K('straw', 5)); c.p(15, 14, K('straw', 4)); c.p(17, 14, K('straw', 4))
    c.vl(14, 7, 15, K(m, 4)); c.vl(18, 7, 15, K(m, 2))
    # 육분의
    for a in range(0, 61, 6):
        r = math.radians(a + 60); c.p(int(round(24 + 5 * math.cos(r))), int(round(9 + 5 * math.sin(r))), K('brass', 4))
    line(c, 24, 9, 21, 14, K('brass', 5)); line(c, 24, 9, 27, 14, K('brass', 3))
    # 말린 해도
    c.rect(26, 11, 29, 15, K('linen', 5)); c.hl(26, 29, 11, K('linen', 6)); c.p(29, 13, K('red', 3))
    c.outline()


@REG.piece('rope pin rail', '밧줄 걸이 핀 막대(2칸)', 'ship', 'hang', 2, 0, 0, 'wall_mounted',
           '벽에 댄 나무 막대의 걸이 핀마다 감은 밧줄 고리.', TAGS + ['갑판', '밧줄'],
           '배 벽면 윗줄. 돛대 근처 벽.', ['mast', 'rope coil'])
def rope_pin_rail(c):
    m = 'dwood'
    c.rect(1, 6, 30, 8, K(m, 4)); c.hl(1, 30, 6, K(m, 5)); c.hl(1, 30, 8, K(m, 2))
    for cx in (5, 12, 19, 26):
        c.vl(cx, 3, 6, K('pine', 5)); c.p(cx, 2, K('pine', 6))
        for y in range(9, 20):
            r = 2.5 if y < 17 else 2
            for x in (int(cx - r), int(cx + r)): c.p(x, y, K('straw', 4 if x < cx else 3))
        c.hl(cx - 2, cx + 2, 19, K('straw', 3)); c.hl(cx - 1, cx + 1, 9, K('straw', 5))
        c.p(cx, 20, K('straw', 4)); c.p(cx, 21, K('straw', 3))
    c.outline()


@REG.piece('life ring', '구명 부표', 'ship', 'hang', 1, 0, 0, 'wall_mounted',
           '벽에 건 빨강·흰 띠 구명 부표와 밧줄.', TAGS + ['갑판'],
           '배 벽면 윗줄, 문 옆.', ['porthole', 'rope pin rail'])
def life_ring(c):
    for a in range(0, 360, 4):
        r = math.radians(a)
        for rad in (4.2, 5, 5.8):
            x = int(round(7.5 + rad * math.cos(r))); y = int(round(12 + rad * math.sin(r)))
            band = (a // 45) % 2
            c.p(x, y, K('red', 4 if rad < 5.5 else 3) if band else K('white', 6 if rad < 5.5 else 4))
    c.p(7, 5, K('straw', 4)); c.p(8, 4, K('straw', 4))
    c.outline()


@REG.piece('anchor chain', '닻 쇠사슬 더미', 'ship', 'floor', 1, 1, 0, 'debris',
           '바닥에 서려 놓은 굵은 닻 쇠사슬.', TAGS + ['화물칸', '갑판'],
           '갑판·화물칸 구석, 닻 곁.', ['anchor', 'capstan'])
def anchor_chain(c):
    c.shadow(1, 10, 15, 15)
    for i, (rx, ry) in enumerate(((6, 3), (4.5, 2.2), (3, 1.4))):
        cy = 10 - i * 1.6
        for a in range(0, 360, 20):
            r = math.radians(a + i * 10)
            x = int(round(7.5 + rx * math.cos(r))); y = int(round(cy + ry * math.sin(r)))
            c.p(x, y, K('iron', 5 if (a // 20) % 2 else 2)); c.p(x + 1, y, K('iron', 3))
    c.outline()


@REG.piece('ship bunk', '선원 3층 침상', 'ship', 'wall', 1, 1, 32, 'tall_furniture',
           '벽에 붙인 좁은 나무 3층 침상 — 칸마다 회색 담요와 베개.', TAGS + ['선원 선실', '침대'],
           '선원 선실 북쪽 벽 앞 첫 바닥 줄에 2~4개 나란히.', ['hammock', 'sea chest'], use=('sleep',))
def ship_bunk(c):
    m = 'dwood'
    c.shadow(1, 44, 15, 47)
    c.vl(1, 2, 46, K(m, 4)); c.vl(14, 2, 46, K(m, 2)); c.vl(2, 2, 46, K(m, 3)); c.vl(13, 2, 46, K(m, 3))
    for k, y0 in enumerate((4, 18, 32)):
        c.rect(3, y0, 12, y0 + 9, K(m, 1))                         # 칸 속 그늘
        c.rect(3, y0 + 4, 12, y0 + 8, K('white', 3)); c.hl(3, 12, y0 + 4, K('white', 4))   # 담요 윗면
        c.rect(3, y0 + 3, 6, y0 + 5, K('white', 6))                # 베개
        c.rect(1, y0 + 10, 14, y0 + 12, K(m, 4)); c.hl(1, 14, y0 + 10, K(m, 5)); c.hl(1, 14, y0 + 12, K(m, 2))   # 판
    c.hl(1, 14, 2, K(m, 5)); c.hl(1, 14, 3, K(m, 3))
    c.outline()
