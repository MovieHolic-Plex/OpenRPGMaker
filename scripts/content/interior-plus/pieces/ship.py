"""배 안 — 선장실·주방·화물칸·선원 선실·조타실·포 갑판·감방. 굽은 선체 판벽(hull)·선장실 판벽(cabin)·갑판 널(deck)·화물칸 널(hold)과 함께 쓴다.
이미 v5 에 있는 해먹·조타륜·함포(정면)·선원 궤짝·밧줄 더미·닻·해도 탁자·배 종·그물 덮은 화물·그물은 그대로 쓰고 새로 그리지 않는다."""
import math
from iplib import REG, K, shift, box, cyl, ring, Cv, hnoise, poly, line, barrel, barrel_side

TAGS = ['배 안', '선실']


@REG.piece('porthole', '놋쇠 둥근 창(배)', 'ship', 'hang', 1, 0, 0, 'wall_mounted',
           '선체 벽에 낸 놋쇠 테 둥근 창, 유리 너머 바다와 하늘, 둘레 리벳.', TAGS + ['창'],
           '선체 벽면 윗줄에 2~3칸 간격으로.', ['stern windows', 'hanging lantern'], use=('light',))
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
           '선장실 가운데·선미 창 앞, 앞(남쪽)에 의자.', ['stern windows', 'chair S'], use=('read', 'search'))
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
    w = 'wood'; d = 'dwood'
    c.shadow(1, 27, 31, 31)
    # 받침(양옆 고임 다리 + 판, 윗면 보임)
    box(c, 3, 22, 26, 4, 3, d, t0=5, f0=2)
    for x0_ in (3, 24):
        box(c, x0_, 16, 5, 6, 0, d, t0=5, f0=2, rim=False)
    # 눕힌 큰 통 — 남북으로 누워 둥근 앞 마구리가 남쪽을 본다. 마구리 위로 통 몸 윗면(둥근 등)이 뒤로 물러나며 보인다.
    cx, cy, rx, ry = 16, 20, 8.5, 6.5
    sh = 11
    for x in range(int(cx - rx), int(math.ceil(cx + rx)) + 1):
        u = (x - cx) / (rx + .5)
        if abs(u) > 1: continue
        h = ry * math.sqrt(1 - u * u)
        ytop = int(round(cy - sh - h * .55))
        for y in range(ytop, int(cy) + 1):
            k = 7 if u < -.4 else 6 if u < .2 else 5 if u < .6 else 4
            c.p(x, y, K(w, k))
        c.p(x, ytop, K(w, 5 if u < .2 else 3))                     # 뒤 가장자리
    # 쇠테: 몸 윗면을 가로지르는 위로 휜 호
    for s in (4, 8):
        for x in range(int(cx - rx), int(math.ceil(cx + rx)) + 1):
            u = (x - cx) / (rx + .5)
            if abs(u) > 1: continue
            y = int(round(cy - s - ry * math.sqrt(1 - u * u) * .9))
            c.p(x, y, K('iron', 5 if u < .3 else 3))
            c.p(x, y + 1, K(w, 4 if u < .3 else 3))
    # 앞 마구리(세운 둥근 판): 통널 세로 이음, 둘레 쇠테, 아래 꼭지
    c.ell(cx, cy, rx, ry, None, only=lambda x, y: K(w, 4 if (x - cx) + (y - cy) < -3 else 3 if (x - cx) + (y - cy) < 4 else 2))
    for x in range(int(cx - rx) + 2, int(cx + rx) - 1, 3):
        for y in range(int(cy - ry) + 1, int(cy + ry)):
            if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < .8: c.p(x, y, K(w, 2))
    ring(c, cx, cy, rx, ry, K('iron', 4)); ring(c, cx, cy, rx - .6, ry - .6, K('iron', 2))
    for a in range(200, 300, 5):
        r = math.radians(a); c.p(int(round(cx + rx * math.cos(r))), int(round(cy + ry * math.sin(r))), K('iron', 6))
    c.rect(15, 23, 17, 24, K('brass', 4)); c.hl(15, 17, 23, K('brass', 6)); c.p(16, 25, K('brass', 3)); c.p(16, 26, K('brass', 3))
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


@REG.piece('sack pile', '곡식 자루 더미(2칸)', 'ship', 'floor', 2, 1, 8, 'other',
           '삼베 곡식 자루 다섯을 쌓은 더미.', TAGS + ['화물칸', '주방', '자루'],
           '화물칸·주방 식료 구석.', ['barrel stack', 'crate stack'])
def sack_pile(c):
    m = 'bread'
    c.shadow(1, 26, 31, 30)
    def sack(x0, y0, w, ear):
        # 눕힌 삼베 자루: 윗면(4줄, 밝음) + 앞면(5줄, 어두움), 둥근 모서리, 한쪽 끝에 묶은 귀
        for j in range(9):
            for i in range(w):
                if (j in (0, 8)) and i in (0, w - 1): continue
                if j == 0 and i in (1, w - 2): continue
                if j < 4:
                    k = 6 if (j == 1 and i < w * .55) else 5
                    if i >= w - 2: k = 4
                else:
                    k = 4 if j == 4 else 3 if j < 7 else 2
                    if i >= w - 2: k -= 1
                if hnoise(x0 + i, y0 + j, 3) < .14: k = max(1, k - 1)       # 삼베 결
                c.p(x0 + i, y0 + j, K(m, k))
        c.hl(x0 + 1, x0 + w - 2, y0 + 4, K(m, 3))                          # 윗면/앞면 경계
        ex = x0 + w if ear > 0 else x0 - 2
        c.rect(ex, y0 + 2, ex + 1, y0 + 4, K(m, 4)); c.p(ex, y0 + 2, K(m, 6))
        c.vl(x0 + w - 1 if ear > 0 else x0, y0 + 2, y0 + 5, K('straw', 3))   # 묶은 끈
    sack(4, 9, 12, 1); sack(17, 9, 12, -1)
    sack(1, 17, 10, -1); sack(11, 17, 10, 1); sack(21, 17, 10, 1)
    c.outline()


@REG.piece('galley stove', '배 주방 화덕(쇠)', 'ship', 'wall', 2, 1, 32, 'tall_furniture',
           '벽 앞 쇠 화덕 — 불 붙은 아궁이, 위에 끓는 무쇠 솥, 천장으로 오르는 연통.', TAGS + ['주방', '화덕'],
           '주방 북쪽 벽 앞 첫 바닥 줄. 옆에 물통·조리대.', ['pot rack', 'cask rack'], use=('search',))
def galley_stove(c):
    m = 'iron'
    c.shadow(1, 43, 31, 47)
    # 화덕 몸: 윗판(9줄, 위에서 본 쇠판) + 앞면
    box(c, 1, 17, 30, 9, 15, m, t0=5, f0=2)
    # 연통(윗판 뒤 오른쪽에서 천장으로)
    for y in range(0, 21):
        for x in range(23, 28): c.p(x, y, K(m, 4 if x == 23 else 3 if x < 26 else 2 if x < 27 else 1))
    c.ell(25, 20.5, 2.5, 1, K(m, 2))
    c.hl(22, 28, 5, K(m, 5)); c.hl(22, 28, 6, K(m, 2))
    # 윗판 화구 테(가운데) + 무쇠 솥(왼쪽, 뚜껑 윗면)
    c.ell(16, 21.5, 3.5, 1.8, K(m, 3)); c.ell(16, 21.5, 2, 1, K(m, 4)); c.p(16, 21, K('orange', 5))
    c.ell(7.5, 21, 4.5, 2.6, None, only=lambda x, y: K(m, 2 if y > 21 else 3))
    c.ell(7.5, 20, 3.5, 1.6, None, only=lambda x, y: K(m, 5 if x < 7 else 4))
    c.p(7, 19, K(m, 6)); c.p(8, 19, K(m, 6))
    for x, y in ((6, 16), (8, 15), (7, 13)): c.p(x, y, K('white', 4))      # 김
    c.hl(2, 29, 25, K('brass', 5))                                           # 앞 손잡이 난간
    # 아궁이 불 · 오븐 문
    c.rect(4, 29, 13, 38, K(m, 0))
    for y in range(32, 38):
        for x in range(5, 13):
            c.p(x, y, K('orange', 5 if (x + y) % 3 else 6) if y > 33 else K('red', 3 if x % 2 else 4))
    c.hl(4, 13, 28, K(m, 4))
    c.rect(17, 29, 27, 35, K(m, 3)); c.hl(17, 27, 29, K(m, 4)); c.p(26, 32, K('brass', 5))
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


@REG.piece('cannon north', '포문 보는 함포(북쪽 선체 벽)', 'ship', 'floor', 1, 1, 16, 'other',
           '바퀴 달린 나무 포가 위 무쇠 함포를 위에서 내려다본다 — 포신이 북쪽 선체 벽 포문으로 뻗고 약실 꼭지가 보는 쪽에 있다.', TAGS + ['포 갑판', '대포'],
           '포 갑판 북쪽 벽면 바로 아래 첫 바닥 줄, 그 위 벽면 윗줄에 포문(gunport)을 건다. 2~3칸 간격으로 줄 세운다.', ['gunport', 'cannonball pile', 'powder keg'], facing='N')
def cannon_north(c):
    """위에서 내려다본 함포: 넓은 포가(좌우 볼 윗면 3px 밝게 · 가운데 바닥판 윗면 · 앞면 3줄)와 앞 바퀴 둘(윗면 볕 + 둥근 앞면).
    포신은 포가 위에 눕혀 북쪽(벽 포문 쪽)으로 뻗고, 둥근 등 가운데 줄이 볕을 받는다. 포구 구멍은 벽을 향해 보이지 않는다."""
    m = 'iron'; w = 'wood'; d = 'dwood'
    c.shadow(0, 28, 15, 31)
    # 포가: 윗면 y14..23(10줄) — 좌우 볼(밝은 윗면, 가운데로 그늘 1줄) + 가운데 낮은 바닥판(조금 어둡게)
    for y in range(14, 24):
        for x in range(1, 15):
            if x in (1, 2, 3) or x in (12, 13, 14):
                k = 7 if (x in (1, 12) or y == 14) else 6
                if x in (3, 14): k = 5
            elif x in (4, 11): k = 3                                         # 볼 안쪽 그늘
            else: k = 4 if (y - 14) % 4 else 3
            c.p(x, y, K(w, k))
    for x in range(1, 15): c.p(x, 24, K(w, 7 if x not in (4, 11) else 5))    # 앞 모서리 볕
    for y in (25, 26, 27):
        for x in range(1, 15): c.p(x, y, K(d, 3 if y == 25 else 2 if y == 26 else 1))   # 포가 앞면
    # 앞 바퀴(포가 앞 모서리 양옆 아래): 윗면 볕 + 둥근 앞면
    for x0 in (0, 12):
        for x in range(x0, x0 + 4):
            c.p(x, 24, K(d, 5)); c.p(x, 25, K(d, 4)); c.p(x, 26, K(d, 3)); c.p(x, 27, K(d, 2))
        c.p(x0 + 1, 26, K(m, 5))
    # 포신
    for y in range(5, 24):
        t = (y - 5) / 18
        r = 1.2 + 1.3 * t
        for x in range(int(round(7.5 - r)), int(round(7.5 + r)) + 1):
            u = (x - (7.5 - r)) / (2 * r)
            k = 4 if u < .15 else 7 if u < .45 else 5 if u < .65 else 3 if u < .85 else 2
            c.p(x, y, K(m, k))
    for y in (9, 14, 19):
        t = (y - 5) / 18; r = 1.6 + 1.3 * t
        for x in range(int(round(7.5 - r)), int(round(7.5 + r)) + 1): c.p(x, y, K(m, 6 if x < 8 else 4))
    c.hl(6, 9, 4, K(m, 5)); c.hl(7, 8, 3, K(m, 6))                           # 둥근 포구 끝(윗면)
    c.ell(7.5, 24, 1.5, 1.1, None, only=lambda x, y: K(m, 6 if y < 24 else 3))   # 약실 꼭지
    c.outline()


@REG.piece('cannonball pile', '포탄 더미', 'ship', 'floor', 1, 1, 0, 'other',
           '나무 테두리 안에 피라미드로 쌓은 무쇠 포탄.', TAGS + ['포 갑판', '대포'],
           '함포 옆 1칸.', ['cannon north', 'powder keg'])
def cannonball_pile(c):
    w = 'pine'
    c.shadow(1, 13, 15, 15)
    # 낮은 나무 받침 상자: 위에서 본 윗판 7줄(남북으로 깐 널 — 세로 이음) + 밝은 앞 모서리 + 앞면 3줄(가로 널)
    for y in range(4, 11):
        for x in range(1, 15):
            k = 6 if y == 4 else 5
            if x in (5, 10): k = 4
            if x >= 13: k -= 1
            c.p(x, y, K(w, k))
    c.hl(1, 14, 10, K(w, 6))
    for y in range(11, 14):
        for x in range(1, 15): c.p(x, y, K(w, 3 if y == 11 else 2) if x < 13 else K(w, 1))
    c.hl(1, 14, 12, K(w, 1))
    pal = {'a': K('iron', 6), 'b': K('iron', 5), 'c': K('iron', 3), 'd': K('iron', 1), 's': K(w, 3)}
    ballrows = ['.ab.', 'abbc', 'bbcd', '.cd.']
    c.sprite(6, 1, ballrows, pal)
    for x0 in (4, 8): c.sprite(x0, 3, ballrows + ['.ss.'], pal)
    c.outline()


@REG.piece('powder keg', '화약 통', 'ship', 'floor', 1, 1, 0, 'round_body',
           '검게 칠한 작은 화약 통(붉은 띠).', TAGS + ['포 갑판', '화물칸', '통'],
           '함포 뒤·화약고 벽 앞에 2~3개.', ['cannon north', 'cannonball pile'])
def powder_keg(c):
    c.shadow(2, 12, 15, 15)
    barrel(c, 8, 1, rx=5, ry=2.4, h=9, m='black', hoop='red')
    c.p(8, 3, K('black', 1)); c.p(7, 3, K('linen', 5))
    c.outline()


@REG.piece('gunport', '포문(열림)', 'ship', 'hang', 1, 0, 0, 'wall_mounted',
           '선체 벽의 네모 포문 — 뚜껑을 위로 들어 올려 바다가 보인다.', TAGS + ['포 갑판', '창'],
           '포 갑판 벽면 윗줄, 함포 바로 위 벽.', ['cannon north', 'porthole'], use=('light',))
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
    cx = 7.5
    def arc(y0, rx, ry, col_l, col_r, below=True):
        """둥근 몸을 감는 띠 — 아래로 휜 타원 앞쪽 반."""
        for x in range(int(cx - rx), int(math.ceil(cx + rx)) + 1):
            u = (x - cx) / (rx + .5)
            if abs(u) > 1: continue
            y = int(round(y0 + ry * math.sqrt(1 - u * u)))
            c.p(x, y, col_l if u < .3 else col_r)
    # 받침 칼라(둥근 나무 받침): 윗면 타원 7줄
    cyl(c, cx, 33, 7, 3.5, 7, 'dwood', t0=5, body=(4, 4, 3, 2, 1))
    c.ell(cx, 36.5, 7, 3.5, None, only=lambda x, y: K('dwood', 6 if x < cx - 2 and y < 36 else 5))
    ring(c, cx, 36.5, 7, 3.5, K('dwood', 3))
    arc(40, 7, 3.5, K('iron', 5), K('iron', 2))
    # 돛대 몸(둥근 기둥) — 칼라 가운데로 들어간다
    for y in range(3, 38):
        for x in range(4, 12):
            u = (x - 4) / 8
            yb = 36.5 + 1.6 * math.sqrt(max(0, 1 - ((x - cx) / 4.5) ** 2))
            if y > yb: continue
            c.p(x, y, K(m, 5 if u < .25 else 4 if u < .5 else 3 if u < .8 else 2))
    arc(36.5, 4, 1.6, K('dwood', 1), K('dwood', 1))
    # 쇠테(아래로 휜 호)
    for y0 in (12, 24):
        arc(y0, 4, 1.6, K('iron', 5), K('iron', 3)); arc(y0 + 1, 4, 1.6, K('iron', 3), K('iron', 1))
    # 위 끝 자른 면(위에서 본 타원 5줄, 나이테)
    c.ell(cx, 3, 4, 2.2, None, only=lambda x, y: K(m, 6 if x < cx and y < 3 else 5))
    ring(c, cx, 3, 4, 2.2, K(m, 3))
    ring(c, cx, 3, 2, 1, K(m, 4)); c.p(7, 3, K(m, 3)); c.p(8, 3, K(m, 3))
    # 칼라 위 걸이 핀 둘
    for x in (2, 13): c.vl(x, 33, 36, K('pine', 5)); c.p(x, 33, K('pine', 6))
    c.outline()


@REG.piece('capstan', '닻 감는 고패', 'ship', 'floor', 1, 1, 8, 'round_body',
           '굵은 나무 원통 고패, 위에 지렛대 꽂는 구멍과 쇠 테.', TAGS + ['갑판', '조타실'],
           '배 큰 방 가운데·돛대 앞뒤 1칸 띄워.', ['mast', 'anchor'])
def capstan(c):
    c.shadow(1, 27, 15, 31)
    d = 'dwood'; cx, cy, rx, ry = 7.5, 12.5, 6.5, 3.5
    # 몸통(둥근 나무 북): 왼쪽 밝고 오른쪽 어둡게, 아래 끝은 타원 호
    for x in range(1, 15):
        u = (x - 1) / 13
        k = 5 if u < .2 else 4 if u < .45 else 3 if u < .7 else 2 if u < .9 else 1
        yb = 24 + int(round(ry * math.sqrt(max(0, 1 - ((x - cx) / (rx + .5)) ** 2))))
        for y in range(int(cy), yb + 1): c.p(x, y, K(d, k - (1 if x in (4, 7, 10, 13) and 17 < y < yb - 1 else 0)))
    for x in range(1, 15):
        yb = 24 + int(round(ry * math.sqrt(max(0, 1 - ((x - cx) / (rx + .5)) ** 2))))
        c.p(x, yb - 6, K('iron', 5 if x < 8 else 3)); c.p(x, yb - 1, K('iron', 4 if x < 8 else 2))
    # 머리 윗면(밝은 타원 8줄): 테 → 판 → 바퀴살 → 가운데 쇠 꼭지 → 지렛대 구멍 여섯
    c.ell(cx, cy, rx, ry, None, only=lambda x, y: K('pine', 3))
    c.ell(cx, cy, rx - 1, ry - .8, None, only=lambda x, y: K('pine', 6 if (x < cx - 1 and y < cy) else 5 if x < cx + 3 else 4))
    for a in range(0, 360, 60):
        r = math.radians(a + 30)
        for f in (.45, .7):
            c.p(int(round(cx + (rx - 1.5) * f * math.cos(r))), int(round(cy + (ry - 1) * f * math.sin(r))), K('pine', 3))
        c.p(int(round(cx + (rx - .6) * math.cos(r))), int(round(cy + (ry - .4) * math.sin(r))), K(d, 0))
    c.ell(cx, cy, 1.2, .6, K('iron', 5)); c.p(7, 12, K('iron', 6))
    # 꽂힌 지렛대 둘(좌우로, 윗면 밝은 줄)
    for xa, xb in ((0, 1), (14, 15)):
        c.hl(xa, xb, 12, K('pine', 6)); c.hl(xa, xb, 13, K('pine', 3))
    c.outline()


@REG.piece('ship ladder', '갑판 사다리', 'ship', 'wall', 1, 1, 32, 'frame',
           '북쪽 벽에 기대 위 갑판 승강구로 오르는 나무 사다리(위에 열린 구멍).', TAGS + ['갑판', '사다리'],
           '배 안 방 북쪽 벽 앞 첫 바닥 줄. 앞 1칸 비운다. 층 이동은 links 로 단다.', ['mast'], use=('travel',))
def ship_ladder(c):
    m = 'pine'
    # 위 갑판 승강구(열린 구멍) 테
    c.rect(1, 0, 14, 5, K('black', 1)); c.hl(1, 14, 5, K('dwood', 5)); c.hl(1, 14, 0, K('dwood', 2))
    # 옆판(비스듬한 측판) — 위 모서리 밝게
    for x in (1, 13):
        for y in range(4, 46):
            c.p(x, y, K(m, 6 if x == 1 else 4)); c.p(x + 1, y, K(m, 3 if x == 1 else 2))
    # 발판: 위에서 보이는 디딤판 3줄 + 앞 모서리 1줄, 사이는 뚫린 그늘
    c.rect(3, 6, 12, 45, K('dwood', 1))
    for y0 in range(8, 42, 6):
        c.rect(3, y0, 12, y0 + 2, K(m, 5)); c.hl(3, 8, y0, K(m, 6)); c.p(12, y0 + 1, K(m, 4))
        c.hl(3, 12, y0 + 3, K(m, 2))
    c.rect(1, 44, 14, 45, K(m, 2))
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


@REG.piece('instrument shelf', '항해 도구 선반(2칸)', 'ship', 'hang', 2, 0, 0, 'low_furniture',
           '벽 선반 위 망원경·모래시계·육분의·말아 둔 해도.', TAGS + ['조타실', '선장실'],
           '조타실·선장실 벽면 윗줄.', ['chart table', 'binnacle'], use=('search',))
def instrument_shelf(c):
    m = 'dwood'
    # 벽 선반 판: 위에서 본 윗면 6줄 + 앞 모서리
    box(c, 1, 14, 30, 6, 2, m, t0=5, f0=2)
    for x in (4, 27):                                                        # 까치발
        for k in range(4): c.hl(x - 1, x + 2 - k, 22 + k, K(m, 3 if k < 2 else 2))
    # 망원경(누운, 위 밝은 띠)
    c.rect(2, 12, 11, 16, K('brass', 3)); c.rect(2, 12, 11, 13, K('brass', 5)); c.hl(3, 9, 12, K('brass', 6))
    c.rect(9, 11, 11, 16, K('brass', 4)); c.hl(9, 11, 11, K('brass', 6)); c.hl(2, 11, 16, K('brass', 2))
    c.ell(2, 14, .6, 1.8, K('glass', 5))
    # 모래시계(윗판 위에서 보인다)
    c.ell(16, 7, 2.5, 1, K(m, 5)); c.hl(14, 18, 8, K(m, 3))
    for y in range(9, 15):
        r = abs(y - 11.5) // 2 + 1
        for x in range(int(16 - r), int(17 + r)): c.p(x, y, K('glass', 5 if x < 16 else 4))
    for y in range(12, 15): c.p(16, y, K('straw', 5))
    c.vl(14, 8, 15, K(m, 4)); c.vl(18, 8, 15, K(m, 2))
    c.ell(16, 15, 2.5, 1, K(m, 4))
    # 육분의
    for a in range(0, 61, 6):
        r = math.radians(a + 60); c.p(int(round(23 + 5 * math.cos(r))), int(round(10 + 5 * math.sin(r))), K('brass', 5))
    line(c, 23, 10, 20, 15, K('brass', 5)); line(c, 23, 10, 25, 15, K('brass', 3))
    # 말린 해도(누운 두루마리, 위 밝은 띠)
    c.rect(25, 13, 29, 16, K('linen', 4)); c.hl(25, 29, 13, K('linen', 6)); c.hl(25, 29, 14, K('linen', 5)); c.p(29, 15, K('red', 3))
    c.outline()


@REG.piece('rope pin rail', '밧줄 걸이 핀 막대(2칸)', 'ship', 'hang', 2, 0, 0, 'wall_mounted',
           '벽에 댄 나무 막대의 걸이 핀마다 감은 밧줄 고리.', TAGS + ['갑판', '밧줄'],
           '배 벽면 윗줄. 돛대 근처 벽.', ['mast', 'rope coil'])
def rope_pin_rail(c):
    m = 'dwood'
    c.rect(1, 6, 30, 8, K(m, 4)); c.hl(1, 30, 6, K(m, 5)); c.hl(1, 30, 8, K(m, 2))
    for x in (1, 30): c.vl(x, 5, 10, K(m, 2))                       # 벽에 댄 받침
    for cx in (5, 12, 19, 26):
        c.vl(cx, 3, 6, K('wood', 5)); c.p(cx + 1, 4, K('wood', 3)); c.p(cx, 2, K('wood', 6)); c.p(cx + 1, 2, K('wood', 4))
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
    c.shadow(1, 11, 15, 15)
    # 고리 하나 = 3×2 타원(가로 고리) 또는 2×3(세로 고리), 서로 엇갈려 서린다
    def link(x, y, flat):
        pts = [(0, 0), (1, 0), (2, 0), (0, 1), (2, 1)] if flat else [(0, 0), (1, 0), (0, 1), (1, 2), (0, 2), (1, 1)]
        for dx, dy in pts: c.p(x + dx, y + dy, K('iron', 5 if dy == 0 else 3))
        if flat: c.p(x + 1, y + 1, K('iron', 1))
    for i, (rx, ry, cy) in enumerate(((5.5, 2.6, 11), (4, 1.8, 8.5), (2.4, 1.1, 6.5))):
        n = 9 - i * 3
        for k in range(n):
            a = math.radians(k * 360 / n + i * 25)
            x = int(round(6.5 + rx * math.cos(a))); y = int(round(cy + ry * math.sin(a)))
            link(x, y, k % 2 == 0)
    c.p(12, 3, K('iron', 4)); c.p(12, 4, K('iron', 3)); c.p(11, 5, K('iron', 4))   # 위로 올라가는 끝
    c.outline()


@REG.piece('ship bunk', '선원 3층 침상', 'ship', 'wall', 1, 1, 32, 'tall_furniture',
           '벽에 붙인 좁은 나무 3층 침상 — 칸마다 회색 담요와 베개.', TAGS + ['선원 선실', '침대'],
           '선원 선실 북쪽 벽 앞 첫 바닥 줄에 2~4개 나란히.', ['hammock', 'sea chest'], use=('sleep',))
def ship_bunk(c):
    m = 'dwood'
    c.shadow(1, 44, 15, 47)
    # 천판(윗면 4줄) + 앞 모서리
    # 2026-10-20 3/4 재검: 호두나무 단 윗면이 앞 난간과 같은 값이라 밝은 판 램프 + 앞 입술
    c.rect(1, 1, 14, 4, K('wood', 6)); c.hl(1, 14, 1, K('wood', 5)); c.vl(14, 1, 4, K('wood', 5)); c.hl(1, 13, 4, K('wood', 7))
    c.rect(1, 5, 14, 6, K(m, 3))
    # 칸 셋: 뒤 그늘 → 매트·담요 윗면(5줄, 위에서) → 앞 난간(윗면 2줄 + 앞면 3줄)
    for y0 in (7, 19, 31):
        c.rect(3, y0, 12, y0 + 1, K(m, 1))
        c.rect(3, y0 + 2, 12, y0 + 6, K('white', 4)); c.hl(3, 12, y0 + 2, K('white', 5))
        c.rect(7, y0 + 2, 12, y0 + 6, K('blue', 4)); c.hl(7, 12, y0 + 2, K('blue', 5))      # 담요
        c.rect(3, y0 + 2, 6, y0 + 4, K('white', 6))                                           # 베개
        c.rect(1, y0 + 7, 14, y0 + 8, K(m, 6)); c.hl(1, 14, y0 + 7, K(m, 5))
        c.rect(1, y0 + 9, 14, y0 + 11, K(m, 3)); c.hl(1, 14, y0 + 11, K(m, 2))
    # 기둥(양옆) — 난간 윗면은 남긴다
    for x, k in ((1, 4), (2, 3), (13, 3), (14, 2)):
        for y in range(5, 44):
            if c.get(x, y) in (K(m, 6), K(m, 5)): continue
            c.p(x, y, K(m, k))
    c.hl(1, 14, 43, K(m, 1))
    c.outline()
