"""박물관·미술관 전시실 — 받침대·유리 진열장·그림(글자 없음)·조각·관람 줄·벤치·천창 빛."""
from iplib import REG, K, shift, box, cyl, ring, Cv, hnoise, poly, line, plinth_block

TAGS = ['박물관', '미술관', '전시실']


def pedestal(c, cx, base_y, m='marble', top_y=None, w=10):
    """대리석 받침대(3/4): base_y = 발밑 칸 바닥에 닿는 줄. 받침 윗면 맨 위 줄을 돌려준다."""
    x0 = cx - w // 2
    # 받침(넓은 단)
    box(c, x0 - 1, base_y - 5, w + 2, 2, 3, m, t0=5, f0=3)
    # 기둥 몸통
    top = top_y if top_y is not None else base_y - 16
    for y in range(top + 4, base_y - 6):
        for i in range(w - 2):
            k = 5 if i == 0 else 4 if i < 3 else 3 if i < w - 4 else 2
            c.p(x0 + 1 + i, y, K(m, k))
    c.vl(x0, top + 4, base_y - 7, K(m, 1)); c.vl(x0 + w - 1, top + 4, base_y - 7, K(m, 0))
    # 머리 판(윗면 4줄 + 앞면 2줄)
    box(c, x0 - 1, top, w + 2, 4, 2, m, t0=5, f0=4)
    return top


def glass_box(c, x0, y0, w, d, h, inner=None):
    """유리 덮개(3/4): 윗면 d 줄 + 앞면 h 줄. 속은 inner(c) 가 먼저 그린 것을 비치게(유리 색을 섞지 않고 반사 띠만)."""
    g = 'glass'
    # 모서리 금속 틀
    br = 'brass'
    for x in range(x0, x0 + w):
        c.p(x, y0, K(br, 5)); c.p(x, y0 + d, K(br, 4)); c.p(x, y0 + d + h, K(br, 2))
    for y in range(y0, y0 + d + h + 1):
        c.p(x0, y, K(br, 4)); c.p(x0 + w - 1, y, K(br, 2))
    # 윗면 유리: 비치는 하늘빛 + 사선 반사
    for y in range(y0 + 1, y0 + d):
        for x in range(x0 + 1, x0 + w - 1):
            if c.get(x, y) is None: c.p(x, y, K(g, 5))
            if (x - x0 + y - y0) % 7 in (2, 3): c.p(x, y, K(g, 6))
    for y in range(y0 + d + 1, y0 + d + h):
        for x in range(x0 + 1, x0 + w - 1):
            if c.get(x, y) is None: c.p(x, y, K(g, 4) if y > y0 + d + 1 else K(g, 5))
            if (x - x0 - (y - y0 - d)) % 9 == 1: c.p(x, y, K(g, 6))
    c.p(x0 + 1, y0 + d + 1, K(g, 6)); c.p(x0 + 2, y0 + d + 1, K(g, 6))


def cabinet_base(c, x0, y0, w, h, m='dwood', d=2):
    """진열장 아래 나무 받침(윗면 d 줄 + 앞면 h 줄, 서랍 테)."""
    box(c, x0, y0, w, d, h, m, t0=5, f0=4)
    for x in range(x0 + 2, x0 + w - 2): c.p(x, y0 + d + 2, K(m, 2))
    c.p(x0 + w // 2, y0 + d + h // 2 + 1, K('brass', 5))


# ───────── 받침대 위 유물 ─────────
@REG.piece('plinth', '빈 대리석 받침대', 'museum', 'floor', 1, 1, 16, 'column',
           '흰 대리석 전시 받침대(빈 것). 위에 아무것도 없다 — 전시실 줄 세우기·빈 자리 표시.', TAGS + ['받침대'],
           '전시실 바닥, 벽에서 1칸 띄워 2~4개를 같은 간격으로.', ['rope barrier 2', 'plinth amphora'])
def plinth(c):
    plinth_block(c, 8, 30, 12); c.shadow(3, 27, 15, 31); c.outline()


@REG.piece('plinth amphora', '받침대 위 고대 항아리', 'museum', 'floor', 1, 1, 16, 'column',
           '대리석 받침대에 얹은 붉은 흙빛 고대 항아리(검은 띠 무늬, 글자 없음).', TAGS + ['유물', '항아리'],
           '전시실 바닥 가운데 줄이나 벽 앞 1칸 띄워.', ['plinth helmet', 'rope barrier 2'])
def plinth_amphora(c):
    t = plinth_block(c, 8, 30, 14); c.shadow(3, 27, 15, 31)
    m = 'clay'
    prof = [2, 2, 2, 3, 4, 5, 5, 5, 5, 4, 4, 3, 3, 2]
    for j, r in enumerate(prof):
        y = 2 + j
        for x in range(8 - r, 8 + r):
            u = (x - (8 - r)) / max(1, 2 * r)
            c.p(x, y, K(m, 5 if u < .25 else 4 if u < .55 else 3 if u < .8 else 2))
    c.hl(6, 9, 1, K(m, 5)); c.hl(7, 8, 2, K(m, 1)); c.p(6, 2, K(m, 3)); c.p(9, 2, K(m, 2))      # 아가리(속이 보인다)
    for y in (5, 6, 7): c.p(4 if y > 5 else 5, y, K(m, 3)); c.p(11 if y > 5 else 10, y, K(m, 1))   # 손잡이
    for x in range(4, 12): c.p(x, 9, K('black', 2)); c.p(x, 10, K('black', 3) if x % 2 else K(m, 4))
    c.hl(5, 10, 12, K('black', 2))
    c.p(5, 6, K(m, 6)); c.p(5, 7, K(m, 6)); c.p(6, 6, K(m, 6))
    c.outline()


@REG.piece('plinth helmet', '받침대 위 고대 투구', 'museum', 'floor', 1, 1, 16, 'column',
           '대리석 받침대에 얹은 녹슨 청동 투구(볏 장식).', TAGS + ['유물', '무구'],
           '전시실 바닥, 다른 받침대와 같은 줄.', ['plinth amphora', 'case sword'])
def plinth_helmet(c):
    plinth_block(c, 8, 30, 14); c.shadow(3, 27, 15, 31)
    m = 'brass'
    prof = [3, 4, 5, 5, 5, 5, 5, 5, 4, 4, 4]
    for j, r in enumerate(prof):
        y = 5 + j
        for x in range(8 - r, 8 + r):
            u = (x - (8 - r)) / max(1, 2 * r)
            c.p(x, y, K(m, 5 if u < .3 else 4 if u < .6 else 3 if u < .85 else 2))
    for x in range(5, 11): c.p(x, 3, K('red', 4)); c.p(x, 4, K('red', 3))
    c.hl(6, 9, 2, K('red', 5)); c.p(11, 4, K('red', 2)); c.p(4, 4, K('red', 3))
    c.rect(6, 10, 9, 10, K('black', 1)); c.rect(7, 11, 8, 15, K('black', 1))
    c.p(5, 7, K(m, 6)); c.p(5, 8, K(m, 6)); c.p(10, 13, K('teal', 3)); c.p(11, 11, K('teal', 3))
    c.outline()


@REG.piece('plinth fossil', '받침대 위 암모나이트 화석', 'museum', 'floor', 1, 1, 16, 'column',
           '대리석 받침대에 세운 나선 껍데기 암모나이트 화석(누런 돌).', TAGS + ['유물', '화석'],
           '자연사 전시실 바닥, 큰 용 두개골 곁.', ['dragon skull', 'plinth'])
def plinth_fossil(c):
    plinth_block(c, 8, 30, 14); c.shadow(3, 27, 15, 31)
    m = 'linen'
    # 암모나이트 화석(나선 껍데기) — 세워 둔 원판, 앞으로 살짝 기울어 윗 가장자리가 보인다
    import math
    c.ell(7.5, 9, 5.5, 5.5, None, only=lambda x, y: K(m, 5 if x + y < 15 else 4 if x + y < 19 else 3))
    for t in range(0, 300):
        a = t * .06; r = 1 + a * .62
        if r > 5.2: break
        x = 7.5 + r * math.cos(a); y = 9 + r * math.sin(a)
        c.p(int(round(x)), int(round(y)), K(m, 2))
    for a in range(0, 360, 30):
        x = 7.5 + 4.3 * math.cos(math.radians(a)); y = 9 + 4.3 * math.sin(math.radians(a))
        c.p(int(round(x)), int(round(y)), K(m, 6 if a in (180, 210, 240, 270) else 3))
    c.p(4, 6, K(m, 6)); c.p(5, 5, K(m, 6))
    c.outline()

# ───────── 유리 진열장 ─────────
def case1(c, inner):
    cabinet_base(c, 2, 16, 12, 9)
    inner(c)
    glass_box(c, 2, 5, 12, 4, 7)
    c.shadow(2, 29, 15, 31)
    c.outline()


@REG.piece('case gem', '보석 유리 진열장', 'museum', 'floor', 1, 1, 8, 'box',
           '나무 받침 위 유리 덮개 진열장, 붉은 방석 위 큰 보석.', TAGS + ['진열장', '보석'],
           '전시실 가운데 줄, 진열장끼리 1칸 띄워.', ['case crown', 'rope barrier 2'], use=('search',))
def case_gem(c):
    def inner(c):
        c.rect(4, 13, 11, 15, K('red', 3)); c.hl(4, 11, 13, K('red', 4))
        c.ell(8, 11, 2, 2, None, only=lambda x, y: K('teal', 5 if x < 8 and y < 11 else 4 if x < 9 else 2))
        c.p(7, 10, K('teal', 6))
    case1(c, inner)


@REG.piece('case crown', '왕관 유리 진열장', 'museum', 'floor', 1, 1, 8, 'box',
           '나무 받침 위 유리 덮개 진열장, 벨벳 방석 위 금관.', TAGS + ['진열장', '왕관', '보물'],
           '전시실 가장 안쪽 가운데(눈길 끝), 양옆에 받침대.', ['case gem', 'plinth'], use=('search',))
def case_crown(c):
    def inner(c):
        c.rect(4, 13, 11, 15, K('purple', 3)); c.hl(4, 11, 13, K('purple', 4))
        for x in range(5, 11):
            c.p(x, 12, K('gold', 4 if x < 8 else 3)); c.p(x, 11, K('gold', 5 if x < 8 else 4))
        for x in (5, 7, 8, 10): c.p(x, 10, K('gold', 5))
        c.p(5, 9, K('gold', 6)); c.p(10, 9, K('gold', 4)); c.p(7, 9, K('gold', 6)); c.p(8, 9, K('gold', 5))
        c.p(7, 11, K('red', 4)); c.p(9, 11, K('blue', 4))
    case1(c, inner)


def case2(c, inner):
    cabinet_base(c, 2, 16, 28, 9)
    inner(c)
    glass_box(c, 2, 6, 28, 4, 6)
    c.shadow(2, 29, 31, 31)
    c.outline()


@REG.piece('case sword', '검 유리 진열장(2칸)', 'museum', 'floor', 2, 1, 8, 'box',
           '긴 유리 진열장, 푸른 천 위에 옛 장검을 가로로 눕혔다.', TAGS + ['진열장', '무구', '검'],
           '전시실 가운데·벽 앞 1칸 띄워, 관람 줄을 앞에.', ['plinth helmet', 'rope barrier 3'], use=('search',))
def case_sword(c):
    def inner(c):
        c.rect(4, 13, 27, 15, K('blue', 2)); c.hl(4, 27, 13, K('blue', 3))
        for x in range(10, 26): c.p(x, 12, K('iron', 6 if x < 18 else 5)); c.p(x, 13, K('iron', 4))
        c.p(26, 12, K('iron', 4))
        c.rect(8, 10, 8, 15, K('gold', 4)); c.p(8, 10, K('gold', 6))    # 코등이
        c.hl(5, 7, 12, K('dwood', 4)); c.hl(5, 7, 13, K('dwood', 3)); c.p(4, 12, K('gold', 5)); c.p(4, 13, K('gold', 3))
    case2(c, inner)


@REG.piece('case scroll', '두루마리 유리 진열장(2칸)', 'museum', 'floor', 2, 1, 8, 'box',
           '긴 유리 진열장, 펼친 옛 두루마리(무늬 그림, 읽는 글자 없음)와 봉인.', TAGS + ['진열장', '문서'],
           '전시실·기록관 가운데 줄.', ['case gem', 'bench museum'], use=('search', 'read'))
def case_scroll(c):
    def inner(c):
        c.rect(4, 13, 27, 15, K('red', 2)); c.hl(4, 27, 13, K('red', 3))
        c.rect(8, 10, 23, 13, K('linen', 6)); c.hl(8, 23, 13, K('linen', 4))
        for x in (7, 24): c.vl(x, 9, 14, K('dwood', 4)); c.p(x, 9, K('dwood', 6))
        for x in range(10, 22, 3): c.p(x, 11, K('linen', 3)); c.p(x + 1, 11, K('linen', 3))
        c.p(15, 12, K('red', 4)); c.p(16, 12, K('red', 3))
    case2(c, inner)


@REG.piece('relic cabinet', '유물 벽 진열장', 'museum', 'wall', 1, 1, 24, 'tall_furniture',
           '키 큰 나무 진열장, 유리문 속 선반 셋에 단지·조각상·접시.', TAGS + ['진열장', '벽'],
           '북쪽 벽 앞 첫 바닥 줄, 2~3개 나란히.', ['wide cabinet', 'case gem'], use=('search',))
def relic_cabinet(c):
    m = 'dwood'
    # 윗면(3줄) + 앞면
    box(c, 1, 2, 14, 3, 33, m, t0=5, f0=3)
    for y in range(7, 34):
        for x in range(3, 13):
            c.p(x, y, K('glass', 1) if (x + y) % 5 else K('glass', 2))
    for sy in (13, 21, 29):   # 선반
        c.hl(3, 12, sy, K(m, 5)); c.hl(3, 12, sy + 1, K(m, 2))
    # 물건들
    c.ell(5.5, 10, 1.5, 2, None, only=lambda x, y: K('clay', 5 if x < 6 else 3)); c.p(5, 8, K('clay', 2))
    c.rect(9, 9, 10, 12, K('marble', 5)); c.p(9, 8, K('marble', 6)); c.p(10, 12, K('marble', 3))
    c.ell(7.5, 19, 2.5, 1.2, None, only=lambda x, y: K('blue', 5 if x < 8 else 3)); c.p(11, 19, K('gold', 5)); c.p(11, 20, K('gold', 3))
    c.rect(4, 26, 5, 28, K('teal', 4)); c.p(4, 25, K('teal', 5)); c.ell(9.5, 27, 2, 1.5, None, only=lambda x, y: K('gold', 5 if x < 10 else 3))
    for y in range(7, 34):
        if (y % 6) in (1, 2): c.p(3, y, K('glass', 5))
    c.vl(8, 7, 33, K(m, 3))   # 두 문짝 사이
    c.p(7, 20, K('brass', 5)); c.p(9, 20, K('brass', 5))
    c.shadow(1, 36, 15, 39)


@REG.piece('wide cabinet', '넓은 유물 벽 진열장(2칸)', 'museum', 'wall', 2, 1, 24, 'tall_furniture',
           '넓은 나무 진열장, 유리문 속 선반에 그릇·투구·작은 상.', TAGS + ['진열장', '벽'],
           '북쪽 벽 앞 첫 바닥 줄.', ['relic cabinet', 'bench museum'], use=('search',))
def wide_cabinet(c):
    m = 'dwood'
    box(c, 1, 2, 30, 3, 33, m, t0=5, f0=3)
    for y in range(7, 34):
        for x in range(3, 29):
            c.p(x, y, K('glass', 1) if (x + y) % 5 else K('glass', 2))
    for sy in (15, 26):
        c.hl(3, 28, sy, K(m, 5)); c.hl(3, 28, sy + 1, K(m, 2))
    c.vl(15, 7, 33, K(m, 3)); c.vl(16, 7, 33, K(m, 4))
    # 위 칸: 접시 셋(세워 둔)
    for cx in (6, 11, 21, 26):
        c.ell(cx, 11, 2, 2.5, None, only=lambda x, y, cx=cx: K('white', 5 if x < cx else 3)); c.p(cx, 11, K('blue', 4))
    # 가운데 칸: 투구·항아리
    c.ell(7, 22, 2.5, 2.5, None, only=lambda x, y: K('iron', 5 if x < 7 else 3)); c.hl(5, 9, 24, K('iron', 2))
    c.ell(12, 22, 1.5, 2.5, None, only=lambda x, y: K('clay', 5 if x < 12 else 3))
    c.ell(20, 23, 2, 1.5, None, only=lambda x, y: K('gold', 5 if x < 20 else 3)); c.rect(24, 19, 26, 24, K('teal', 4)); c.hl(24, 26, 19, K('teal', 5))
    # 아래 칸: 작은 상·책
    c.rect(5, 29, 6, 33, K('marble', 5)); c.p(5, 28, K('marble', 6))
    for i, col in enumerate(('red', 'green', 'blue')): c.rect(10 + i * 2, 29, 11 + i * 2, 33, K(col, 3)); c.p(10 + i * 2, 29, K(col, 4))
    c.ell(23, 31, 3, 1.5, None, only=lambda x, y: K('clay', 4 if x < 23 else 2))
    for y in range(7, 34):
        if (y % 6) in (1, 2): c.p(3, y, K('glass', 5)); c.p(17, y, K('glass', 5))
    c.p(14, 21, K('brass', 5)); c.p(18, 21, K('brass', 5))
    c.shadow(1, 36, 31, 39)


# ───────── 그림(벽 걸이, 글자 없음) ─────────
def frame(c, x0, y0, x1, y1, m='gold'):
    for x in range(x0, x1 + 1):
        c.p(x, y0, K(m, 5)); c.p(x, y0 + 1, K(m, 4)); c.p(x, y1, K(m, 2)); c.p(x, y1 - 1, K(m, 3))
    for y in range(y0, y1 + 1):
        c.p(x0, y, K(m, 5)); c.p(x0 + 1, y, K(m, 4)); c.p(x1, y, K(m, 2)); c.p(x1 - 1, y, K(m, 3))
    c.p(x0, y0, K(m, 6)); c.p(x1, y1, K(m, 1))
    for x in range(x0 + 1, x1 + 1): c.p(x, y1 + 1, (0x1c, 0x14, 0x18, 90))   # 벽에 지는 그늘


@REG.piece('painting landscape', '풍경화(2칸)', 'museum', 'hang', 2, 0, 0, 'wall_mounted',
           '금 액자 풍경화 — 푸른 산·호수·초록 들(글자 없음).', TAGS + ['그림'],
           '벽면 윗줄에 건다. 그림끼리 1칸 띄워 같은 높이로.', ['painting sea', 'bench museum'], use=('read',))
def painting_landscape(c):
    frame(c, 2, 3, 29, 25)
    for y in range(5, 24):
        for x in range(4, 28):
            sky = y < 12
            col = K('blue', 5 if y < 8 else 6) if sky else None
            c.p(x, y, col if col else K('green', 3))
    # 먼 산
    for x in range(4, 28):
        top = 12 - int(4 * max(0, 1 - abs(x - 11) / 7)) - int(3 * max(0, 1 - abs(x - 22) / 6))
        for y in range(top, 15): c.p(x, y, K('purple', 4) if y < top + 2 and x < 13 else K('blue', 3))
        c.p(x, top, K('white', 6) if top < 10 else K('blue', 4))
    for x in range(4, 28):   # 호수·들
        for y in range(15, 18): c.p(x, y, K('water', 5) if (x + y) % 6 else K('water', 6))
        for y in range(18, 24): c.p(x, y, K('green', 4 if y < 20 else 3) if hnoise(x, y) > .15 else K('green', 5))
    c.ell(24, 7, 1.5, 1.5, K('yellow', 6))
    for x, y in ((8, 20), (9, 19), (9, 20), (10, 20)): c.p(x, y, K('leaf', 2))


@REG.piece('painting sea', '바다 그림', 'museum', 'hang', 1, 0, 0, 'wall_mounted',
           '금 액자 작은 바다 그림 — 돛배와 파도(글자 없음).', TAGS + ['그림', '배'],
           '벽면 윗줄. 선장실 벽에도 어울린다.', ['painting landscape', 'porthole'], use=('read',))
def painting_sea(c):
    frame(c, 1, 4, 14, 20)
    for y in range(6, 19):
        for x in range(3, 13):
            c.p(x, y, K('blue', 5 if y < 10 else 6) if y < 12 else K('water', 3 if (x + 2 * y) % 5 else 5))
    c.vl(8, 7, 12, K('dwood', 3)); c.rect(6, 8, 7, 11, K('white', 6)); c.rect(9, 9, 10, 11, K('white', 5))
    c.hl(5, 11, 12, K('dwood', 3)); c.hl(6, 10, 13, K('dwood', 2))


@REG.piece('painting still life', '정물화', 'museum', 'hang', 1, 0, 0, 'wall_mounted',
           '검은 바탕 정물화 — 과일 그릇과 병(글자 없음).', TAGS + ['그림'],
           '벽면 윗줄. 미술관·식당 벽.', ['painting landscape'], use=('read',))
def painting_still(c):
    frame(c, 1, 3, 14, 21, 'gold')
    for y in range(5, 20):
        for x in range(3, 13): c.p(x, y, K('black', 2 if y < 15 else 3))
    c.hl(3, 12, 15, K('dwood', 4)); c.hl(3, 12, 16, K('dwood', 3))
    c.ell(6, 13, 1.5, 1.5, None, only=lambda x, y: K('red', 5 if x < 6 else 3))
    c.ell(8.5, 13.5, 1.5, 1, None, only=lambda x, y: K('yellow', 5 if x < 9 else 3))
    c.rect(10, 8, 11, 14, K('green', 3)); c.p(10, 8, K('green', 5)); c.vl(10, 9, 13, K('green', 4)); c.rect(10, 6, 11, 7, K('green', 2))
    c.p(5, 12, K('red', 6))


@REG.piece('painting grand', '큰 풍경화(3칸)', 'museum', 'hang', 3, 0, 0, 'wall_mounted',
           '넓은 금 액자 그림 — 노을 진 성과 언덕길·나무·강(사람·글자 없음).', TAGS + ['그림', '큰 그림'],
           '전시실 가장 긴 북쪽 벽 가운데. 앞에 벤치.', ['bench museum', 'rope barrier 3'], use=('read',))
def painting_grand(c):
    frame(c, 1, 2, 46, 27)
    for y in range(4, 26):
        for x in range(3, 45):
            t = (y - 4) / 12
            c.p(x, y, K('orange', 6) if y < 8 else K('orange', 5) if y < 11 else K('pink', 4) if y < 14 else K('green', 2))
    # 성 실루엣
    for x in range(26, 40):
        top = 9 if x in (27, 28, 37, 38) else 11 if 29 <= x <= 36 else 13
        if x == 32 or x == 33: top = 7
        for y in range(top, 18): c.p(x, y, K('purple', 2))
    c.p(32, 6, K('red', 3)); c.p(33, 6, K('red', 4))
    c.p(30, 13, K('yellow', 5)); c.p(35, 12, K('yellow', 5))
    # 언덕·행렬
    for x in range(3, 45):
        hy = 16 + int(2 * abs(((x * 7) % 13) / 13 - .5))
        for y in range(hy, 26): c.p(x, y, K('green', 2 if y < 20 else 1))
    # 앞 언덕의 길·나무 몇 그루(사람 없음)
    for x in range(5, 26):
        y = 22 - (x - 5) // 4
        c.p(x, y, K('straw', 4)); c.p(x, y + 1, K('straw', 3))
    for tx in (7, 15, 41):
        c.ell(tx, 17, 2, 2.4, None, only=lambda x, y: K('leaf', 3 if x < tx else 1)); c.vl(tx, 19, 21, K('dwood', 2))
    for x in range(3, 45):   # 강물 빛
        if 23 <= x <= 36: c.p(x, 24, K('orange', 5) if x % 3 else K('pink', 5))
    c.ell(13, 6, 2, 2, K('yellow', 6))


# ───────── 조각 ─────────
@REG.piece('bronze warrior', '청동 전사 상', 'museum', 'floor', 1, 1, 32, 'figure',
           '대리석 받침 위 창과 둥근 방패를 든 청동 전사 상(녹청).', TAGS + ['조각', '석상'],
           '전시실 가운데·현관 홀 양옆. 주변 1칸 비운다.', ['plinth', 'rope barrier 2'])
def winged_statue(c):
    m = 'teal'
    box(c, 2, 34, 12, 4, 7, 'marble', t0=5, f0=3)
    c.shadow(2, 44, 15, 47)
    # 다리·치마
    for y in range(29, 36): c.p(6, y, K(m, 4)); c.p(7, y, K(m, 3)); c.p(9, y, K(m, 3)); c.p(10, y, K(m, 2))
    for y in range(21, 30):
        hw = 3 + (y - 21) // 4
        for x in range(8 - hw, 8 + hw):
            u = (x - (8 - hw)) / (2 * hw)
            c.p(x, y, K(m, 5 if u < .3 else 4 if u < .6 else 3 if u < .85 else 2))
        if y % 3 == 0: c.p(7, y, K(m, 2)); c.p(9, y, K(m, 2))
    # 몸통·어깨
    for y in range(13, 21):
        hw = 3 if y > 13 else 2
        for x in range(8 - hw, 8 + hw):
            u = (x - (8 - hw)) / (2 * hw)
            c.p(x, y, K(m, 5 if u < .3 else 4 if u < .65 else 3))
    c.hl(5, 10, 20, K('brass', 4))     # 허리띠
    # 머리·투구
    c.ell(8, 10, 2, 2.4, None, only=lambda x, y: K(m, 5 if x < 8 else 3))
    c.hl(6, 9, 8, K(m, 6)); c.hl(7, 9, 7, K(m, 5)); c.p(8, 6, K('red', 3)); c.p(9, 6, K('red', 4)); c.p(10, 7, K('red', 3))
    c.p(7, 11, K(m, 2))
    # 오른손 창(세로)
    for y in range(2, 36): c.p(12, y, K('dwood', 4) if y > 5 else K('iron', 6 if y < 4 else 5))
    c.p(12, 1, K('iron', 6)); c.p(11, 4, K('iron', 4)); c.p(13, 4, K('iron', 3))
    c.p(10, 14, K(m, 3)); c.p(11, 15, K(m, 3)); c.p(11, 16, K(m, 2))
    # 왼팔 둥근 방패(몸 앞)
    c.ell(4, 19, 3.4, 4, None, only=lambda x, y: K(m, 1))
    c.ell(4, 19, 2.4, 3, None, only=lambda x, y: K(m, 6 if x < 4 and y < 18 else 5 if x + y < 23 else 4))
    c.p(4, 19, K('brass', 6)); c.p(5, 19, K('brass', 4)); c.p(4, 20, K('brass', 3))
    c.outline()


@REG.piece('stone sphere', '돌 구 조각', 'museum', 'floor', 1, 1, 16, 'figure',
           '네모 받침 위 매끈한 검은 돌 구(현대풍 조각이 아닌 고대 의례 돌).', TAGS + ['조각'],
           '전시실 바닥, 다른 조각과 1칸 띄워.', ['bronze warrior', 'plinth'])
def stone_sphere(c):
    box(c, 2, 20, 12, 3, 7, 'stone', t0=5, f0=3)
    c.ell(7.5, 13, 5, 5, None, only=lambda x, y: K('black', 6 if (x - 6) ** 2 + (y - 11) ** 2 < 3 else 5 if x + y < 19 else 4 if x + y < 23 else 3))
    c.p(5, 10, K('white', 4))
    c.shadow(2, 29, 15, 31)
    c.outline()


@REG.piece('lion statue', '사자 석상(2칸)', 'museum', 'floor', 2, 1, 16, 'figure',
           '긴 받침 위 엎드린 돌 사자 석상.', TAGS + ['조각', '석상'],
           '전시실 가운데·입구 홀 양옆(좌우 한 쌍).', ['bronze warrior', 'rope barrier 2'])
def lion_statue(c):
    box(c, 1, 21, 30, 4, 4, 'marble', t0=4, f0=3)
    c.shadow(1, 28, 31, 31)
    m = 'stone'
    sh = lambda x, y: K(m, 6 if y < 11 else 5 if y < 15 else 4 if y < 19 else 3)
    # 엎드린 몸(등선 → 엉덩이)
    poly(c, [(9, 11), (16, 10), (24, 11), (28, 14), (29, 22), (9, 22)], sh)
    c.hl(16, 27, 11, K(m, 6))
    # 갈기(톱니 가장자리 큰 덩이)
    pts = []
    import math
    for a in range(0, 360, 20):
        r = 5.8 if (a // 20) % 2 else 4.9
        pts.append((7.5 + r * math.cos(math.radians(a)), 12.5 + r * 1.05 * math.sin(math.radians(a))))
    poly(c, pts, lambda x, y: K(m, 4 if x + y < 19 else 3 if x + y < 24 else 2))
    # 얼굴(앞을 본다)
    c.ell(7, 13, 3, 3.2, None, only=lambda x, y: K(m, 6 if y < 12 else 5 if y < 15 else 4))
    c.p(5, 12, K('black', 1)); c.p(8, 12, K('black', 1)); c.hl(6, 7, 14, K(m, 2)); c.p(6, 15, K(m, 3)); c.p(7, 16, K(m, 3))
    c.p(4, 8, K(m, 5)); c.p(10, 8, K(m, 3))   # 귀
    # 앞발 둘
    c.rect(3, 19, 8, 21, K(m, 5)); c.hl(3, 8, 19, K(m, 6)); c.p(5, 21, K(m, 2)); c.p(7, 21, K(m, 2))
    c.rect(10, 19, 14, 21, K(m, 4)); c.p(12, 21, K(m, 2))
    # 꼬리(받침 위로 말림)
    for x, y in ((28, 20), (29, 19), (30, 18), (30, 17), (29, 16)): c.p(x, y, K(m, 3))
    c.p(28, 16, K(m, 2))
    c.outline()

# ───────── 관람 줄·벤치·천창 ─────────
def stanchion(c, x, y_floor):
    c.vl(x, y_floor - 13, y_floor - 2, K('brass', 4)); c.vl(x + 1, y_floor - 13, y_floor - 2, K('brass', 2))
    c.ell(x + .5, y_floor - 14, 1.2, 1, None, only=lambda a, b: K('brass', 6 if a <= x else 4))
    c.ell(x + .5, y_floor - 1, 2.2, 1, None, only=lambda a, b: K('brass', 5 if a <= x else 3))


def rope(c, x0, x1, y):
    for x in range(x0 + 2, x1):
        t = (x - x0) / (x1 - x0)
        sag = int(round(3.2 * 4 * t * (1 - t)))
        c.p(x, y + sag, K('red', 4)); c.p(x, y + sag + 1, K('red', 2))


@REG.piece('rope barrier 2', '관람 줄(2칸)', 'museum', 'floor', 2, 1, 8, 'frame',
           '놋쇠 기둥 둘 사이에 붉은 벨벳 줄을 늘어뜨린 관람 경계. 통행을 막는다.', TAGS + ['관람 줄', '경계'],
           '유물·그림 앞 1칸에 가로로. 통로는 2칸 이상 남긴다.', ['case sword', 'painting grand'])
def rope_barrier2(c):
    for x in (3, 27): stanchion(c, x, 22)
    rope(c, 4, 27, 10)
    c.shadow(1, 20, 31, 23)
    c.outline()


@REG.piece('rope barrier 3', '관람 줄(3칸)', 'museum', 'floor', 3, 1, 8, 'frame',
           '놋쇠 기둥 셋 사이 붉은 벨벳 줄 두 구간. 통행을 막는다.', TAGS + ['관람 줄', '경계'],
           '큰 그림·긴 진열장 앞 1칸에 가로로.', ['painting grand', 'case scroll'])
def rope_barrier3(c):
    for x in (3, 23, 43): stanchion(c, x, 22)
    rope(c, 4, 23, 10); rope(c, 24, 43, 10)
    c.shadow(1, 20, 47, 23)
    c.outline()


@REG.piece('rope post', '관람 줄 기둥', 'museum', 'floor', 1, 1, 8, 'column',
           '놋쇠 관람 줄 기둥 하나(줄 끝·모서리).', TAGS + ['관람 줄'],
           '관람 줄 끝이나 모서리.', ['rope barrier 2'])
def rope_post(c):
    stanchion(c, 7, 22)
    for x in range(9, 12): c.p(x, 11 + (x - 9), K('red', 4)); c.p(x, 12 + (x - 9), K('red', 2))
    c.shadow(4, 20, 12, 23)
    c.outline()


@REG.piece('bench museum', '관람 벤치(2칸)', 'museum', 'floor', 2, 1, 0, 'seat',
           '가죽 방석을 댄 등받이 없는 긴 관람 벤치(짙은 나무 다리).', TAGS + ['벤치', '의자'],
           '큰 그림 앞 2~3칸 떨어진 가운데. 양옆 통로를 남긴다.', ['painting grand', 'painting landscape'], use=('sit',))
def bench_museum(c):
    m = 'red'
    for x in range(2, 30):
        for y in range(3, 8): c.p(x, y, K(m, 4 if y > 3 else 5))
    c.hl(3, 28, 4, K(m, 5)); c.hl(2, 29, 8, K(m, 2))
    for x in range(4, 29, 4): c.p(x, 5, K(m, 2)); c.p(x + 1, 6, K(m, 5))   # 단추
    c.rect(2, 9, 29, 10, K('dwood', 4)); c.hl(2, 29, 10, K('dwood', 2))
    for x in (3, 4, 27, 28): c.vl(x, 11, 14, K('dwood', 3 if x in (3, 27) else 2))
    c.shadow(2, 12, 31, 15)
    c.outline()


@REG.piece('skylight light', '천창 빛(2×2)', 'museum', 'flat', 2, 2, 0, 'flat',
           '천장 유리창으로 떨어진 밝은 빛 무늬(격자 그림자). 밟을 수 있다.', TAGS + ['천창', '빛'],
           '큰 전시실 바닥 가운데, 조각 둘레.', ['bronze warrior', 'stone sphere'], use=('walk',))
def skylight_light(c):
    for y in range(2, 30):
        for x in range(3, 30):
            if x in (16, 17) or y in (15, 16) or x in (3, 29) or y in (2, 29): c.p(x, y, (0xff, 0xf8, 0xd0, 60)); continue
            c.p(x, y, (0xff, 0xf4, 0xb8, 104 if (x + y) % 2 else 96))


@REG.piece('dragon skull', '용 두개골(2칸)', 'museum', 'floor', 2, 1, 16, 'figure',
           '낮은 돌 받침 위 거대한 용 두개골 화석(뿔·이빨).', TAGS + ['유물', '화석', '용'],
           '자연사 전시실 가운데, 관람 줄로 둘러싼다.', ['plinth fossil', 'rope barrier 3'])
def dragon_skull(c):
    box(c, 1, 21, 30, 4, 4, 'stone', t0=4, f0=3)
    c.shadow(1, 28, 31, 31)
    m = 'linen'
    sh = lambda x, y: K(m, 6 if y < 7 and x < 20 else 5 if y < 10 else 4 if y < 13 else 3)
    # 뿔 두 개(뒤로 휘어 오른다)
    poly(c, [(17, 6), (21, 2), (26, 0), (29, 1), (24, 3), (21, 7)], lambda x, y: K(m, 5 if y < 2 else 4))
    poly(c, [(21, 8), (25, 5), (29, 5), (30, 7), (26, 7), (23, 10)], lambda x, y: K(m, 3))
    # 위턱·머리뼈
    poly(c, [(2, 12), (2, 10), (5, 8), (10, 7), (14, 5), (18, 4), (22, 5), (26, 8), (27, 12), (24, 15), (4, 15)], sh)
    # 아래턱(살짝 벌림)
    poly(c, [(4, 17), (18, 16), (23, 14), (26, 15), (23, 20), (6, 20), (3, 19)], lambda x, y: K(m, 4 if y < 18 else 3))
    c.hl(4, 22, 16, K(m, 1))
    for x in range(5, 21, 2): c.p(x, 15, K(m, 6)); c.p(x, 16, K(m, 5))       # 윗니
    for x in range(6, 19, 3): c.p(x, 17, K(m, 6))                             # 아랫니
    c.ell(17, 8, 1.6, 1.2, K('black', 1)); c.p(16, 8, K('black', 3))         # 눈구멍
    c.ell(21.5, 10, 1.2, 1.6, K('black', 2))                                  # 관자 구멍
    c.p(4, 10, K('black', 1)); c.p(5, 10, K('black', 2))                      # 콧구멍
    c.hl(8, 13, 9, K(m, 6)); c.hl(15, 19, 6, K(m, 6))
    c.outline()


@REG.piece('plaque stand', '설명판 받침', 'museum', 'floor', 1, 1, 8, 'frame',
           '놋쇠 다리 위 비스듬한 설명판(무늬 테만, 읽는 글자 없음).', TAGS + ['설명판'],
           '유물 받침대 바로 옆이나 앞 모서리.', ['plinth amphora', 'case gem'], use=('read',))
def plaque_stand(c):
    c.vl(7, 14, 29, K('brass', 4)); c.vl(8, 14, 29, K('brass', 2))
    c.ell(7.5, 29, 3, 1, None, only=lambda x, y: K('brass', 5 if x < 8 else 3))
    # 비스듬한 판(윗면이 크게 보인다)
    for y in range(6, 14):
        for x in range(3 - (y - 6) // 4, 13 + (y - 6) // 4):
            c.p(x, y, K('dwood', 5 if y < 8 else 4))
    c.rect(5, 8, 11, 12, K('linen', 5)); c.hl(5, 11, 8, K('linen', 6))
    for x in range(6, 11, 2): c.p(x, 10, K('linen', 3))
    c.hl(2, 13, 14, K('dwood', 2))
    c.shadow(4, 28, 12, 31)
    c.outline()


@REG.piece('geode stand', '자수정 정동 받침', 'museum', 'floor', 1, 1, 8, 'container',
           '나무 받침 위 반으로 가른 자수정 정동(속에 보라 결정).', TAGS + ['광물', '유물'],
           '자연사 전시실 바닥, 화석 곁.', ['plinth fossil', 'dragon skull'], use=('search',))
def geode_stand(c):
    box(c, 2, 21, 12, 3, 6, 'dwood', t0=5, f0=3)
    c.shadow(2, 29, 15, 31)
    c.ell(7.5, 15, 6, 5, None, only=lambda x, y: K('stone', 4 if x < 7 else 3))
    c.ell(7.5, 14, 4.5, 3.5, None, only=lambda x, y: K('purple', 1 + int(3 * hnoise(x, y, 3))))
    for x, y in ((6, 13), (8, 12), (9, 14), (5, 15), (10, 15)): c.p(x, y, K('purple', 6))
    for x, y in ((7, 14), (9, 13)): c.p(x, y, K('purple', 5))
    c.outline()


@REG.piece('shield display', '청동 원형 방패 걸이', 'museum', 'hang', 1, 0, 0, 'wall_mounted',
           '벽에 건 둥근 청동 방패(가운데 돌기, 무늬 띠).', TAGS + ['무구', '방패'],
           '벽면 윗줄. 검 진열장 위 벽.', ['case sword', 'plinth helmet'])
def shield_display(c):
    c.ell(7.5, 13, 6.5, 6.5, None, only=lambda x, y: K('brass', 5 if x + y < 18 else 4 if x + y < 23 else 3))
    ring(c, 7.5, 13, 5, 5, K('brass', 2))
    c.ell(7.5, 13, 2, 2, None, only=lambda x, y: K('brass', 6 if x < 8 and y < 13 else 4))
    for a in range(0, 360, 45):
        import math
        c.p(int(round(7.5 + 3.5 * math.cos(math.radians(a)))), int(round(13 + 3.5 * math.sin(math.radians(a)))), K('teal', 4))
    c.outline()
    for x in range(3, 15): c.p(x, 21, (0x1c, 0x14, 0x18, 80))


@REG.piece('mosaic panel', '고대 모자이크 벽판(2칸)', 'museum', 'hang', 2, 0, 0, 'wall_mounted',
           '벽에 건 돌 테 모자이크 — 물결·마름모 기하 무늬(글자·사람 없음).', TAGS + ['유물', '모자이크'],
           '벽면 윗줄, 그림과 그림 사이.', ['painting grand', 'plinth amphora'], use=('read',))
def mosaic_panel(c):
    c.rect(2, 4, 29, 25, K('stone', 3))
    c.hl(2, 29, 4, K('stone', 5)); c.vl(2, 4, 25, K('stone', 5)); c.hl(2, 29, 25, K('stone', 1)); c.vl(29, 4, 25, K('stone', 1))
    cols = [K('clay', 4), K('linen', 6), K('teal', 4), K('gold', 5), K('red', 3), K('blue', 4)]
    for y in range(6, 24):
        for x in range(4, 28):
            dx, dy = abs(x - 15.5), abs(y - 14.5)
            band = int(dx / 3 + dy / 3)
            k = band % 4
            col = cols[(k + (1 if (x // 2 + y // 2) % 2 else 0)) % len(cols)] if band < 6 else (cols[1] if (x + y) % 4 else cols[0])
            if (x + y) % 2 == 0 and band >= 6: col = cols[1]
            c.p(x, y, col)
    for x in range(4, 28):   # 위·아래 물결 띠
        c.p(x, 6 + (1 if (x // 3) % 2 else 0), K('blue', 4)); c.p(x, 23 - (1 if (x // 3) % 2 else 0), K('blue', 4))
    c.outline()
    for x in range(3, 31): c.p(x, 27, (0x1c, 0x14, 0x18, 80))


@REG.piece('painted sarcophagus', '채색 석관(2칸)', 'museum', 'floor', 2, 1, 8, 'box',
           '닫힌 돌 석관 — 뚜껑에 청록·금 띠 무늬, 낮은 받침.', TAGS + ['유물', '석관'],
           '고대 유물 전시실 가운데, 관람 줄로 두른다.', ['rope barrier 3', 'plinth amphora'], use=('search',))
def sarcophagus(c):
    c.shadow(1, 21, 31, 23)
    box(c, 1, 16, 30, 2, 4, 'stone', t0=4, f0=3)           # 받침
    box(c, 2, 4, 28, 7, 6, 'linen', t0=5, f0=3)             # 관(뚜껑 윗면 7줄)
    for x in range(4, 28):
        c.p(x, 6, K('teal', 4)); c.p(x, 8, K('gold', 5) if x % 3 else K('teal', 3))
    for x in range(6, 26, 4): c.p(x, 13, K('teal', 3)); c.p(x + 1, 13, K('gold', 4)); c.p(x, 14, K('teal', 3))
    c.vl(10, 5, 9, K('gold', 4)); c.vl(21, 5, 9, K('gold', 4))
    c.outline()


@REG.piece('map case', '옛 지도 진열대(2칸)', 'museum', 'floor', 2, 1, 0, 'low_furniture',
           '비스듬한 유리 덮개 아래 펼친 옛 지도(땅·바다 그림, 글자 없음)를 둔 나무 진열대.', TAGS + ['진열장', '지도'],
           '전시실·기록관 가운데.', ['case scroll', 'bench museum'], use=('read',))
def map_case(c):
    c.shadow(1, 13, 31, 15)
    box(c, 1, 2, 30, 7, 3, 'dwood', t0=4, f0=3)
    for y in range(3, 9):
        for x in range(3, 29):
            land = hnoise(x // 3, y // 2, 41) > .55
            c.p(x, y, K('straw', 5) if land else K('linen', 6))
    for x, y in ((8, 5), (9, 5), (20, 6), (21, 6), (22, 5)): c.p(x, y, K('leaf', 3))
    line(c, 5, 7, 26, 4, K('red', 3))
    for y in range(3, 9):
        for x in range(3, 29):
            if (x + y) % 9 in (0, 1): c.p(x, y, K('glass', 6))
    for x in (3, 4, 27, 28): c.vl(x, 13, 14, K('dwood', 2))
    c.outline()
