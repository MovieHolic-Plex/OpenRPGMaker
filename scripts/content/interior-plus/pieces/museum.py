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


def slab(c, x, y, w, d, h, m, t=5, f=3):
    """3/4 판(윗면이 뚜렷한 면): (x,y) = 윗면 첫 줄 왼쪽. 뒤 가장자리 어두운 줄(y-1), 윗면 d 줄(t 단, 왼쪽 밝게·오른쪽 한 단 어둡게),
    윗면 끝 밝은 입술 한 줄, 앞면 h 줄(f 단 → 아래 한 단 어둡게), 바깥 윤곽 0단. 윗면과 앞면은 두 단 이상 떨어진다."""
    c.hl(x, x + w - 1, y - 1, K(m, max(0, t - 3)))
    for j in range(d):
        for i in range(w):
            k = t + (1 if i < 3 and j < d - 1 else 0) - (1 if i >= w - 2 else 0)
            c.p(x + i, y + j, K(m, k))
    c.hl(x + 1, x + w - 2, y + d - 1, K(m, t + 1))                      # 앞 입술(빛)
    for j in range(h):
        for i in range(w):
            k = f - (1 if j >= h - 1 and h > 2 else 0) - (1 if i >= w - 2 else 0) + (1 if i == 0 else 0)
            c.p(x + i, y + d + j, K(m, k))
    o = K(m, 0)
    c.hl(x, x + w - 1, y + d + h, o); c.vl(x - 1, y - 1, y + d + h - 1, o); c.vl(x + w, y - 1, y + d + h - 1, o)
    c.hl(x, x + w - 1, y - 2, o)


def plinth3(c, cx=8, w=14, top=12, d=7, m='marble'):
    """박물관 받침대(3/4, 윗면 큰 판): 머리 판 윗면 d 줄(top..top+d-1) + 앞면 3줄, 홈 판 몸, 넓은 받침 단. 바닥은 29줄, 그림자 30~31."""
    x0 = cx - w // 2
    fy = top + d + 3                         # 머리 판 앞면 아래 윤곽 줄
    # 몸(홈 기둥)
    for y in range(fy + 1, 26):
        for i in range(w - 4):
            k = 4 if i < 2 else 3 if i < w - 7 else 2
            if i in (3, 6, 9) : k -= 1
            c.p(x0 + 2 + i, y, K(m, k))
    c.vl(x0 + 1, fy + 1, 25, K(m, 1)); c.vl(x0 + w - 2, fy + 1, 25, K(m, 0))
    slab(c, x0, 26, w, 1, 2, m, t=5, f=3)          # 받침 단
    slab(c, x0, top, w, d, 3, m, t=5, f=2)          # 머리 판 — 윗면 5~6단, 앞면 2~1단(분명히 다른 면)
    c.shadow(x0, 29, x0 + w, 31)
    return top


def slab2(c, x, y, w, d, h, m, t=5, f=3, ins=1):
    """slab 의 원근판: 윗면은 줄마다 명암(뒤 한 단 어둡게 → 앞 입술 한 단 밝게, 세로 띠 없음)이고 뒤 가장자리가 ins 칸씩 좁아
    양옆 모서리가 비스듬하다(위에서 내려다본 판). 앞면은 f 단 평면, 오른쪽 끝만 한 단 어둡게."""
    o = K(m, 0)
    for j in range(d):
        a = int(round(ins * (d - 1 - j) / max(1, d - 1)))
        k = t - 1 if j == 0 else t + 1 if j == d - 1 else t
        c.hl(x + a, x + w - 1 - a, y + j, K(m, k))
        c.p(x + a - 1, y + j, o); c.p(x + w - a, y + j, o)
    c.hl(x + ins, x + w - 1 - ins, y - 1, o)
    for j in range(h):
        for i in range(w):
            k = f - (1 if j >= h - 1 and h > 2 else 0) - (1 if i >= w - 1 else 0) + (1 if i == 0 else 0)
            c.p(x + i, y + d + j, K(m, k))
    c.hl(x, x + w - 1, y + d + h, o); c.vl(x - 1, y + d, y + d + h - 1, o); c.vl(x + w, y + d, y + d + h - 1, o)


def plinth4(c, cx=8, w=14, top=12, d=7, m='marble'):
    """plinth3 과 같은 받침대지만 머리 판을 원근판(slab2)으로 — 윗면이 줄 명암 + 비스듬한 옆 모서리."""
    x0 = cx - w // 2
    fy = top + d + 3
    for y in range(fy + 1, 26):
        for i in range(w - 4):
            k = 4 if i < 2 else 3 if i < w - 7 else 2
            if i in (3, 6, 9): k -= 1
            c.p(x0 + 2 + i, y, K(m, k))
    c.vl(x0 + 1, fy + 1, 25, K(m, 1)); c.vl(x0 + w - 2, fy + 1, 25, K(m, 0))
    slab2(c, x0, 26, w, 1, 2, m, t=5, f=3, ins=0)
    slab2(c, x0, top, w, d, 3, m, t=5, f=2, ins=1)
    c.shadow(x0, 29, x0 + w, 31)
    return top


def on_top_shadow(c, x0, x1, y, m='marble'):
    """판 윗면 위 물건 발밑 그늘(같은 재질 한 단 어둡게) 한 줄."""
    for x in range(x0, x1 + 1):
        col = c.get(x, y)
        if col is not None: c.p(x, y, shift(col, -1))


# ───────── 받침대 위 유물 ─────────
@REG.piece('plinth', '빈 대리석 받침대', 'museum', 'floor', 1, 1, 16, 'column',
           '흰 대리석 전시 받침대(빈 것). 위에 아무것도 없다 — 전시실 줄 세우기·빈 자리 표시.', TAGS + ['받침대'],
           '전시실 바닥, 벽에서 1칸 띄워 2~4개를 같은 간격으로.', ['rope barrier 2', 'plinth amphora'])
def plinth(c):
    plinth4(c)
    for x in range(4, 11): c.p(x, 14 + (x - 4) // 4, K('marble', 6))   # 윗면 비스듬한 빛 반사
    c.outline()


@REG.piece('plinth amphora', '받침대 위 고대 항아리', 'museum', 'floor', 1, 1, 16, 'column',
           '대리석 받침대에 얹은 붉은 흙빛 고대 항아리(검은 띠 무늬, 글자 없음).', TAGS + ['유물', '항아리'],
           '전시실 바닥 가운데 줄이나 벽 앞 1칸 띄워.', ['plinth helmet', 'rope barrier 2'])
def plinth_amphora(c):
    plinth4(c)
    on_top_shadow(c, 5, 12, 16)
    m = 'clay'
    prof = [2, 2, 3, 4, 5, 5, 5, 5, 4, 4, 3, 3, 2]
    for j, r in enumerate(prof):
        y = 3 + j
        for x in range(8 - r, 8 + r):
            u = (x - (8 - r)) / max(1, 2 * r)
            c.p(x, y, K(m, 5 if u < .25 else 4 if u < .55 else 3 if u < .8 else 2))
    # 아가리: 위에서 본 둥근 테와 속(어둡게)
    c.ell(7.5, 2, 3.4, 1.8, None, only=lambda x, y: K(m, 6 if x < 7 else 5 if x < 9 else 4))      # 넓은 아가리 테(위에서)
    c.ell(7.5, 2, 2.2, 1, None, only=lambda x, y: K(m, 0 if y <= 2 else 1))                       # 아가리 속(어둡게 2~3줄)
    for y in (6, 7): c.p(3, y, K(m, 3)); c.p(12, y, K(m, 1))                            # 손잡이
    c.p(4, 5, K(m, 4)); c.p(11, 5, K(m, 2))
    for x in range(3, 13):                                                              # 몸을 두른 띠(아래로 휜 곡선)
        sag = 2 if 6 <= x <= 9 else 1 if 4 <= x <= 11 else 0
        c.p(x, 9 + sag, K('black', 2)); c.p(x, 10 + sag, K('black', 3) if x % 2 else K(m, 4))
    for x in range(5, 11): c.p(x, 13 + (1 if 6 <= x <= 9 else 0), K('black', 2))
    c.p(5, 6, K(m, 6)); c.p(5, 7, K(m, 6)); c.p(6, 6, K(m, 6))
    c.outline()


@REG.piece('plinth helmet', '받침대 위 고대 투구', 'museum', 'floor', 1, 1, 16, 'column',
           '대리석 받침대에 얹은 녹슨 청동 투구(볏 장식).', TAGS + ['유물', '무구'],
           '전시실 바닥, 다른 받침대와 같은 줄.', ['plinth amphora', 'case sword'])
def plinth_helmet(c):
    plinth3(c)
    on_top_shadow(c, 4, 12, 15); on_top_shadow(c, 5, 11, 16)
    m = 'brass'
    prof = [3, 4, 5, 5, 5, 5, 5, 5, 4, 4, 4]
    for j, r in enumerate(prof):
        y = 4 + j
        for x in range(8 - r, 8 + r):
            u = (x - (8 - r)) / max(1, 2 * r)
            c.p(x, y, K(m, 5 if u < .3 else 4 if u < .6 else 3 if u < .85 else 2))
    for x in range(5, 11): c.p(x, 2, K('red', 4)); c.p(x, 3, K('red', 3))
    c.hl(6, 9, 1, K('red', 5)); c.p(11, 3, K('red', 2)); c.p(4, 3, K('red', 3))
    c.rect(6, 9, 9, 9, K('black', 1)); c.rect(7, 10, 8, 14, K('black', 1))
    c.p(5, 6, K(m, 6)); c.p(5, 7, K(m, 6)); c.p(10, 12, K('teal', 3)); c.p(11, 10, K('teal', 3))
    c.outline()


@REG.piece('plinth fossil', '받침대 위 암모나이트 화석', 'museum', 'floor', 1, 1, 16, 'column',
           '대리석 받침대에 세운 나선 껍데기 암모나이트 화석(누런 돌).', TAGS + ['유물', '화석'],
           '자연사 전시실 바닥, 정동 받침·유물 벽 진열장 곁.', ['geode stand', 'plinth'])
def plinth_fossil(c):
    plinth3(c)
    on_top_shadow(c, 4, 12, 15); on_top_shadow(c, 5, 11, 16)
    m = 'linen'
    import math
    c.rect(5, 13, 10, 14, K('dwood', 3)); c.hl(5, 10, 13, K('dwood', 5))          # 작은 나무 받침
    c.ell(7.5, 7.5, 5.5, 5.5, None, only=lambda x, y: K(m, 5 if x + y < 13 else 4 if x + y < 17 else 3))
    for t in range(0, 300):
        a = t * .06; r = 1 + a * .62
        if r > 5.2: break
        x = 7.5 + r * math.cos(a); y = 7.5 + r * math.sin(a)
        c.p(int(round(x)), int(round(y)), K(m, 2))
    for a in range(0, 360, 30):
        x = 7.5 + 4.3 * math.cos(math.radians(a)); y = 7.5 + 4.3 * math.sin(math.radians(a))
        c.p(int(round(x)), int(round(y)), K(m, 6 if a in (180, 210, 240, 270) else 3))
    c.p(4, 4, K(m, 6)); c.p(5, 3, K(m, 6))
    c.outline()


# ───────── 유리 진열장 ─────────
def shifted(fn, dx, dy):
    """그리기 함수 fn(c) 를 (dx,dy) 만큼 옮겨 그리는 함수로."""
    def g(c):
        t = Cv(c.w, c.h); fn(t); c.paste(t, dx, dy)
    return g


def glass_case(c, x0, w, top_inner, lid=(6, 14), insmax=1, glare=True):
    """3/4 유리 진열대(탁자형): 위에서 내려다본 큰 유리 윗면(lid 줄 — 뒤가 1칸씩 좁은 원근판, 속 물건이 위에서 보인다)
    + 놋쇠 앞 입술 + 불투명한 나무 앞면(서랍). 바닥 28줄, 그림자 29~31."""
    x1 = x0 + w - 1
    g, br, m = 'glass', 'brass', 'dwood'
    fy = lid[1] + 2                                   # 나무 앞면 첫 줄
    for y in range(fy, 28):
        for x in range(x0, x1 + 1):
            k = 3 if y < 26 else 2
            if y == fy: k = 4
            if x == x0: k += 1
            if x >= x1 - 1: k -= 1
            c.p(x, y, K(m, k))
    for x in range(x0 + 2, x1 - 1): c.p(x, fy + 2, K(m, 2)); c.p(x, fy + 7, K(m, 2))
    c.vl(x0 + 2, fy + 2, fy + 7, K(m, 2)); c.vl(x1 - 2, fy + 2, fy + 7, K(m, 2))
    c.p((x0 + x1) // 2, fy + 4, K(br, 5)); c.p((x0 + x1) // 2 + 1, fy + 4, K(br, 3))
    n = lid[1] - lid[0] + 1
    ins = lambda y: int(round(insmax * (lid[1] - y) / max(1, n - 1)))
    for y in range(lid[0], lid[1] + 1):               # 유리 윗면(속은 짙은 천 바닥)
        for x in range(x0 + 1 + ins(y), x1 - ins(y)):
            c.p(x, y, K(g, 3))
    top_inner(c)
    for y in range(lid[0], lid[1] + 1):               # 사선 반사 띠(유리 윗면)
        for x in range(x0 + 1 + ins(y), x1 - ins(y)):
            if glare and (x - x0 + (y - lid[0])) % 11 in (1, 2): c.p(x, y, K(g, 6))
    if not glare:                                     # 짧은 반짝임 둘(뒤 왼쪽 모서리)
        c.hl(x0 + 2, x0 + 3, lid[0], K(g, 6)); c.p(x0 + 2, lid[0] + 1, K(g, 6)); c.p(x1 - 2, lid[1] - 1, K(g, 5))
    c.hl(x0 + insmax, x1 - insmax, lid[0] - 1, K(br, 2))        # 뒤 가장자리
    for y in range(lid[0] - 1, lid[1] + 1):           # 비스듬한 옆 모서리
        i = ins(y) if y >= lid[0] else insmax
        c.p(x0 + i, y, K(br, 5)); c.p(x1 - i, y, K(br, 3))
    c.hl(x0, x1, lid[1] + 1, K(br, 6))                # 앞 입술(빛)
    c.shadow(x0, 28, x1 + 1, 31)
    c.outline()


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
           '전시실·기록관 가운데 줄.', ['accessory case', 'bench museum'], use=('search', 'read'))
def case_scroll(c):
    def top(c):
        c.rect(3, 7, 28, 13, K('red', 3))                                              # 붉은 천 바닥
        c.rect(8, 8, 23, 12, K('linen', 6)); c.hl(8, 23, 8, K('linen', 5)); c.hl(9, 23, 13, K('red', 2))   # 펼친 두루마리(위에서)
        for j, x in enumerate(range(10, 22, 3)): c.p(x, 9 + j % 2, K('linen', 3)); c.p(x + 1, 11 - j % 2, K('linen', 3))
        for x in (7, 24): c.vl(x, 7, 13, K('dwood', 4)); c.p(x, 7, K('dwood', 6)); c.p(x, 13, K('dwood', 2))
        c.p(15, 11, K('red', 5)); c.p(16, 11, K('red', 4))
    glass_case(c, 2, 28, top)


@REG.piece('relic cabinet', '유물 벽 진열장', 'museum', 'wall', 1, 1, 24, 'tall_furniture',
           '키 큰 나무 진열장, 유리문 속 선반 셋에 단지·조각상·접시.', TAGS + ['진열장', '벽'],
           '북쪽 벽 앞 첫 바닥 줄, 2~3개 나란히.', ['wide cabinet', 'accessory case'], use=('search',))
def relic_cabinet(c):
    m = 'dwood'
    # 윗면(3줄) + 앞면
    box(c, 1, 6, 14, 4, 29, m, t0=5, f0=3)
    # 윗면 판: 앞면 호두나무보다 확실히 밝은 판(위에서 받는 빛) + 앞 입술 — 2026-10-20 3/4 재검(윗면이 앞 기둥과 같은 값이라 띠로 읽혔다)
    c.hl(2, 13, 6, K('wood', 5)); c.hl(2, 13, 7, K('wood', 6)); c.hl(2, 13, 8, K('wood', 6)); c.hl(2, 13, 9, K('wood', 7))
    for y in range(12, 35):
        for x in range(3, 13):
            c.p(x, y, K('glass', 1) if (x + y) % 5 else K('glass', 2))
    for sy in (18, 25, 32):   # 선반
        c.hl(3, 12, sy, K(m, 5)); c.hl(3, 12, sy + 1, K(m, 2))
    # 물건들
    c.ell(5.5, 15.5, 1.5, 2, None, only=lambda x, y: K('clay', 5 if x < 6 else 3)); c.p(5, 13, K('clay', 2))
    c.rect(9, 14, 10, 17, K('marble', 5)); c.p(9, 13, K('marble', 6)); c.p(10, 17, K('marble', 3))
    c.ell(7.5, 23, 2.5, 1.2, None, only=lambda x, y: K('blue', 5 if x < 8 else 3)); c.p(11, 23, K('gold', 5)); c.p(11, 24, K('gold', 3))
    c.rect(4, 29, 5, 31, K('teal', 4)); c.p(4, 28, K('teal', 5)); c.ell(9.5, 30, 2, 1.5, None, only=lambda x, y: K('gold', 5 if x < 10 else 3))
    for y in range(12, 35):
        if (y % 6) in (1, 2): c.p(3, y, K('glass', 5))
    c.vl(8, 12, 34, K(m, 3))   # 두 문짝 사이
    c.p(7, 24, K('brass', 5)); c.p(9, 24, K('brass', 5))
    c.shadow(1, 36, 15, 39)


@REG.piece('wide cabinet', '넓은 유물 벽 진열장(2칸)', 'museum', 'wall', 2, 1, 24, 'tall_furniture',
           '넓은 나무 진열장, 유리문 속 선반에 그릇·투구·작은 상.', TAGS + ['진열장', '벽'],
           '북쪽 벽 앞 첫 바닥 줄.', ['relic cabinet', 'bench museum'], use=('search',))
def wide_cabinet(c):
    m = 'dwood'
    box(c, 1, 6, 30, 6, 27, m, t0=5, f0=3)                # 상판 윗면 6줄(위에서 본 판) + 앞면
    # 윗면 밝게(3/4 윗면) — 2026-10-20 재검: 호두나무 단으로는 앞 기둥과 같은 값이라 밝은 판 램프로
    c.hl(2, 29, 6, K('wood', 5))
    for y in (7, 8, 9, 10): c.hl(2, 29, y, K('wood', 6))
    c.hl(1, 30, 11, K('wood', 7))                           # 앞 입술(빛)
    c.hl(1, 30, 12, K(m, 2))                                # 앞면 머리 그늘

    def spr(x0, y0, rows, mat, **ex):
        """행 문자열 물건: o=재질 0단 윤곽, 1~6=재질 단, 그 밖 글자=ex 색. '.' 투명(뒤 천이 보인다)."""
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch == '.': continue
                c.p(x0 + i, y0 + j, K(mat, 0) if ch == 'o' else K(mat, int(ch)) if ch.isdigit() else ex[ch])

    def back(y0, y1):
        """칸 속 뒷벽: 회청 벨벳 — 선반 바로 밑 한 줄만 그늘, 나머지는 중간 어둠(검은 빈 곳이 아니다)."""
        for y in range(y0, y1 + 1):
            k = 1 if y == y0 else 3 if y == y1 else 2
            for x0, x1 in ((3, 14), (17, 28)):
                c.hl(x0, x1, y, K('stone', k))
        c.vl(14, y0 + 1, y1, K('stone', 1)); c.vl(28, y0 + 1, y1, K('stone', 1))

    def spr2(x0, y0, rows, mat, **ex):
        """채움만 적은 행 문자열 → 바깥 둘레에 재질 0단 윤곽을 자동으로 두른다."""
        pts = {}
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch != '.': pts[(x0 + i, y0 + j)] = K(mat, int(ch)) if ch.isdigit() else ex[ch]
        for (x, y) in pts:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                if (x + dx, y + dy) not in pts: c.p(x + dx, y + dy, K(mat, 0))
        for (x, y), col in pts.items(): c.p(x, y, col)

    def board(y):
        for x0, x1 in ((3, 14), (17, 28)):
            c.hl(x0, x1, y, K('wood', 5)); c.hl(x0, x1, y + 1, K(m, 3)); c.p(x1, y, K('wood', 4))

    def book(x, y, w, mat, band):
        """누운 책 한 권(3/4): 표지 윗면 한 줄 + 등 한 줄(금 띠 하나, 오른쪽 끝은 종이 결)."""
        c.hl(x, x + w - 1, y, K(mat, 0)); c.hl(x, x + w - 1, y + 3, K(mat, 0))
        c.vl(x, y, y + 3, K(mat, 0)); c.vl(x + w - 1, y, y + 3, K(mat, 0))
        c.hl(x + 1, x + w - 2, y + 1, K(mat, 5)); c.p(x + w - 2, y + 1, K(mat, 4))
        c.hl(x + 1, x + w - 2, y + 2, K(mat, 3)); c.p(x + band, y + 2, K('gold', 5)); c.p(x + w - 2, y + 2, K('linen', 5))

    back(13, 19); board(20); back(22, 28); board(29); back(31, 36)
    c.vl(15, 13, 38, K(m, 3)); c.vl(16, 13, 38, K(m, 4))    # 두 문짝 사이 기둥
    c.vl(2, 13, 38, K(m, 4)); c.vl(29, 13, 38, K(m, 2))
    c.rect(2, 37, 29, 38, K(m, 3)); c.hl(3, 28, 37, K(m, 4)); c.hl(4, 27, 38, K(m, 2))

    # ── 칸마다 큰 물건 하나(가운데 기둥을 넘지 않는다)
    # 왼문 위: 청동 투구(둥근 정수리 빛 → 눈 띠·코 가리개 → 뺨 가리개)
    spr2(5, 13, ["..6654..",
                 ".666543.",
                 "56655432",
                 "5kk44kk2",
                 "54k44k32",
                 "43k..k21"], 'brass', k=K('brass', 1))
    c.p(7, 13, K('brass', 6)); c.p(6, 14, K('brass', 6))
    # 오른문 위: 놋쇠 받침에 세운 흙 접시
    c.ell(22.5, 16, 3.2, 3.0, K('clay', 0))                                                                       # 붉은 흙 접시
    c.ell(22.5, 16, 2.3, 2.1, None, only=lambda x, y: K('clay', 6 if x + y < 36 else 5 if x + y < 39 else 3))       # 밝은 테
    c.ell(22.5, 16, 1.2, 1.0, None, only=lambda x, y: K('clay', 3 if x + y < 39 else 2))                           # 오목한 바닥
    c.p(20, 19, K('brass', 1)); c.p(25, 19, K('brass', 1)); c.p(19, 19, K('brass', 3)); c.p(26, 19, K('brass', 2))
    # 왼문 가운데: 뚜껑 있는 청록 유약 단지
    spr(5, 22, ["...oo...",
                "..o65o..",
                ".o6554o.",
                "..o54o..",
                "o665432o",
                "o654321o",
                ".oooooo."], 'teal')
    # 오른문 가운데: 작은 금관(뾰족 셋 + 보석 띠), 선반 위에 바로
    spr2(19, 24, ["6..5..3",
                  "6555443",
                  "5R4B3R2",
                  "4433221"], 'gold', R=K('red', 4), B=K('blue', 4))
    # ── 왼문 아래 칸: 쌓은 옛 책 셋(폭·색이 다르게)
    book(4, 33, 10, 'clay', 2)
    book(5, 31, 8, 'dwood', 5)
    # ── 오른문 아래 칸: 금 띠 두른 나무 보물함(3/4 뚜껑)
    spr(19, 31, [".oooooo.",
                 "o66g665o",
                 "o55g554o",
                 "oggggg2o",
                 "o44Y443o",
                 "o3g322go"], 'clay', g=K('gold', 4), Y=K('gold', 6))
    # 유리 반짝임: 문마다 짧은 사선 하나
    for x, y in ((13, 22), (27, 31)):
        c.p(x, y, K('glass', 4))
    c.p(15, 25, K('brass', 5)); c.p(15, 26, K('brass', 3)); c.p(16, 25, K('brass', 4)); c.p(16, 26, K('brass', 2))   # 문 손잡이(가운데 기둥 위)
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
    frame(c, 2, 4, 29, 20)
    for y in range(6, 19):
        for x in range(4, 28):
            c.p(x, y, K('blue', 5 if y < 8 else 6) if y < 10 else K('green', 3))
    # 먼 산
    for x in range(4, 28):
        top = 10 - int(3 * max(0, 1 - abs(x - 11) / 7)) - int(2 * max(0, 1 - abs(x - 22) / 6))
        for y in range(top, 12): c.p(x, y, K('purple', 4) if y < top + 2 and x < 13 else K('blue', 3))
        c.p(x, top, K('white', 6) if top < 9 else K('blue', 4))
    for x in range(4, 28):   # 호수·들
        for y in range(12, 14): c.p(x, y, K('water', 5) if (x + y) % 6 else K('water', 6))
        for y in range(14, 19): c.p(x, y, K('green', 4 if y < 16 else 3) if hnoise(x, y) > .15 else K('green', 5))
    c.ell(24, 7, 1.2, 1.2, K('yellow', 6))
    for x, y in ((8, 16), (9, 15), (9, 16), (10, 16)): c.p(x, y, K('leaf', 2))


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
    frame(c, 1, 4, 14, 20, 'gold')
    for y in range(6, 19):
        for x in range(3, 13): c.p(x, y, K('black', 2 if y < 14 else 3))
    c.hl(3, 12, 14, K('dwood', 4)); c.hl(3, 12, 15, K('dwood', 3))
    c.ell(6, 12, 1.5, 1.5, None, only=lambda x, y: K('red', 5 if x < 6 else 3))
    c.ell(8.5, 12.5, 1.5, 1, None, only=lambda x, y: K('yellow', 5 if x < 9 else 3))
    c.rect(10, 8, 11, 13, K('green', 3)); c.p(10, 8, K('green', 5)); c.vl(10, 9, 12, K('green', 4)); c.rect(10, 7, 11, 7, K('green', 2))
    c.p(5, 11, K('red', 6))


@REG.piece('painting grand', '큰 풍경화(3칸)', 'museum', 'hang', 3, 0, 0, 'wall_mounted',
           '넓은 금 액자 그림 — 노을 진 성과 언덕길·나무·강(사람·글자 없음).', TAGS + ['그림', '큰 그림'],
           '전시실 가장 긴 북쪽 벽 가운데. 앞에 벤치.', ['bench museum', 'rope barrier 3'], use=('read',))
def painting_grand(c):
    frame(c, 1, 2, 46, 22)
    for y in range(4, 21):
        for x in range(3, 45):
            c.p(x, y, K('orange', 6) if y < 7 else K('orange', 5) if y < 9 else K('pink', 4) if y < 12 else K('green', 2))
    # 성 실루엣
    for x in range(26, 40):
        top = 8 if x in (27, 28, 37, 38) else 10 if 29 <= x <= 36 else 12
        if x == 32 or x == 33: top = 6
        for y in range(top, 15): c.p(x, y, K('purple', 2))
    c.p(32, 5, K('red', 3)); c.p(33, 5, K('red', 4))
    c.p(30, 11, K('yellow', 5)); c.p(35, 10, K('yellow', 5))
    # 언덕
    for x in range(3, 45):
        hy = 13 + int(2 * abs(((x * 7) % 13) / 13 - .5))
        for y in range(hy, 21): c.p(x, y, K('green', 2 if y < 17 else 1))
    # 앞 언덕의 길·나무 몇 그루(사람 없음)
    for x in range(5, 26):
        y = 18 - (x - 5) // 5
        c.p(x, y, K('straw', 4)); c.p(x, y + 1, K('straw', 3))
    for tx in (7, 15, 41):
        c.ell(tx, 14, 2, 2.2, None, only=lambda x, y: K('leaf', 3 if x < tx else 1)); c.vl(tx, 16, 17, K('dwood', 2))
    for x in range(23, 37):   # 강물 빛
        c.p(x, 19, K('orange', 5) if x % 3 else K('pink', 5))
    c.ell(13, 6, 1.6, 1.6, K('yellow', 6))


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
    slab(c, 2, 19, 12, 6, 3, 'stone', t=5, f=3)            # 네모 받침 윗면 6줄
    for x in range(6, 13): c.p(x, 21, K('stone', 4)); c.p(x - 1, 22, K('stone', 4))   # 구가 윗면에 드리운 그늘
    c.ell(7.5, 15.5, 4.5, 4.5, None, only=lambda x, y: K('black', 6 if (x - 6) ** 2 + (y - 14) ** 2 < 3 else 5 if x + y < 21 else 4 if x + y < 25 else 3))
    c.p(5, 13, K('white', 4))
    c.shadow(2, 29, 15, 31)
    c.outline()


@REG.piece('lion statue', '사자 석상(2칸)', 'museum', 'floor', 2, 1, 16, 'figure',
           '긴 받침 위 엎드린 돌 사자 석상.', TAGS + ['조각', '석상'],
           '전시실 가운데·입구 홀 양옆(좌우 한 쌍).', ['bronze warrior', 'rope barrier 2'])
def lion_statue(c):
    slab2(c, 1, 20, 30, 6, 3, 'marble', t=5, f=2, ins=1)   # 긴 받침 윗면 6줄(원근판)
    c.shadow(1, 29, 31, 31)
    base = c; c = Cv(base.w, base.h)
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
    base.paste(c, 0, -2)
    # 앞으로 뻗은 두 앞발(윗면 위에 놓여 앞쪽으로 나온다)
    for x0, x1 in ((3, 7), (10, 13)):
        base.rect(x0, 19, x1, 22, K(m, 4)); base.hl(x0, x1, 19, K(m, 6)); base.hl(x0, x1, 20, K(m, 5))
        base.p(x0 + 1, 22, K(m, 2)); base.p(x1 - 1, 22, K(m, 2))
        base.hl(x0, x1 + 1, 23, K('marble', 3))
    base.outline()

# ───────── 관람 줄·벤치·천창 ─────────
def stanchion(c, x, y_floor):
    """놋쇠 관람 줄 기둥(3/4): 위에서 본 둥근 받침 원판(윗면 타원 + 앞 테) · 가는 기둥 · 둥근 머리(윗면 밝게)."""
    br = 'brass'; cx = x + .5
    c.ell(cx, y_floor - 1, 3.2, 1.6, None, only=lambda a, b: K(br, 2 if a <= x + 1 else 1))      # 원판 앞 테(그늘)
    c.ell(cx, y_floor - 2.5, 3.2, 1.6, None, only=lambda a, b: K(br, 6 if a < x and b < y_floor - 2 else 5 if a <= x + 1 else 4))   # 원판 윗면
    c.vl(x, y_floor - 17, y_floor - 3, K(br, 5)); c.vl(x + 1, y_floor - 17, y_floor - 3, K(br, 3))
    c.p(x, y_floor - 3, K(br, 3)); c.p(x + 1, y_floor - 3, K(br, 2))                              # 기둥 밑동 그늘
    c.ell(cx, y_floor - 18, 2.2, 1.6, None, only=lambda a, b: K(br, 3 if a <= x + 1 else 2))      # 머리 옆면(그늘)
    c.ell(cx, y_floor - 19.5, 2.2, 1.4, None, only=lambda a, b: K(br, 6 if a <= x else 5))       # 머리 윗면 타원(위에서 본 판)
    c.p(x + 1, y_floor - 20, K(br, 4))


def stanchion2(c, x, y_floor):
    """관람 줄 기둥(3/4, 납작 머리): 위에서 본 넓은 받침 원판(기둥은 원판 한가운데에 꽂힌다) · 가는 기둥 · 납작한 원통 머리(윗면 타원 3줄)."""
    br = 'brass'; cx = x + .5
    c.ell(cx, y_floor - 1, 3.6, 1.4, None, only=lambda a, b: K(br, 2 if a <= x + 1 else 1))       # 원판 앞 두께
    c.ell(cx, y_floor - 2.3, 3.6, 1.4, None, only=lambda a, b: K(br, 6 if a < x - 1 else 5 if a <= x + 1 else 4))   # 원판 윗면
    c.vl(x, y_floor - 16, y_floor - 3, K(br, 5)); c.vl(x + 1, y_floor - 16, y_floor - 3, K(br, 3))
    c.p(x, y_floor - 2, K(br, 3)); c.p(x + 1, y_floor - 2, K(br, 2))                               # 꽂힌 자리 그늘
    c.rect(x - 2, y_floor - 18, x + 3, y_floor - 17, K(br, 3)); c.p(x + 3, y_floor - 18, K(br, 2)); c.p(x + 3, y_floor - 17, K(br, 1))   # 머리 옆면
    c.ell(cx, y_floor - 19.5, 2.6, 1.3, None, only=lambda a, b: K(br, 6 if a <= x else 5))          # 머리 윗면 타원
    c.p(x + 2, y_floor - 19, K(br, 4)); c.p(x - 1, y_floor - 20, K(br, 6))


def stanchion3(c, x, y_floor):
    """관람 줄 기둥 하나(줄 끝): 넓은 받침 원판 + 가는 기둥 + 납작한 원판 머리(위에서 본 타원 윗면 3줄 + 아래 두께 2줄, 기둥보다 훨씬 넓다)."""
    br = 'brass'; cx = x + .5
    c.ell(cx, y_floor - 1, 3.6, 1.4, None, only=lambda a, b: K(br, 2 if a <= x + 1 else 1))
    c.ell(cx, y_floor - 2.3, 3.6, 1.4, None, only=lambda a, b: K(br, 6 if a < x - 1 else 5 if a <= x + 1 else 4))
    c.vl(x, y_floor - 15, y_floor - 3, K(br, 5)); c.vl(x + 1, y_floor - 15, y_floor - 3, K(br, 3))
    c.p(x, y_floor - 2, K(br, 3)); c.p(x + 1, y_floor - 2, K(br, 2))
    top = y_floor - 20                                   # 머리 원판 윗면 중심 줄
    c.ell(cx, top + 2, 3.6, 1.6, None, only=lambda a, b: K(br, 2 if a <= x + 1 else 1))           # 머리 원판 두께(그늘)
    c.ell(cx, top, 3.6, 1.8, None, only=lambda a, b: K(br, 4))                                     # 윗면 타원 테
    c.ell(cx, top, 2.6, 1, None, only=lambda a, b: K(br, 6 if a <= x else 5))                       # 윗면 안(밝게)
    c.vl(x, top + 4, top + 5, K(br, 4)); c.vl(x + 1, top + 4, top + 5, K(br, 2))


def rope(c, x0, x1, y):
    for x in range(x0 + 2, x1):
        t = (x - x0) / (x1 - x0)
        sag = int(round(3.2 * 4 * t * (1 - t)))
        c.p(x, y + sag, K('red', 4)); c.p(x, y + sag + 1, K('red', 2))


@REG.piece('rope barrier 2', '관람 줄(2칸)', 'museum', 'floor', 2, 1, 8, 'frame',
           '놋쇠 기둥 둘 사이에 붉은 벨벳 줄을 늘어뜨린 관람 경계. 통행을 막는다.', TAGS + ['관람 줄', '경계'],
           '유물·그림 앞 1칸에 가로로. 통로는 2칸 이상 남긴다.', ['case sword', 'painting grand'])
def rope_barrier2(c):
    for x in (3, 27): stanchion2(c, x, 26)
    rope(c, 4, 27, 10)
    c.shadow(0, 24, 31, 27)
    c.outline()


@REG.piece('rope barrier 3', '관람 줄(3칸)', 'museum', 'floor', 3, 1, 8, 'frame',
           '놋쇠 기둥 셋 사이 붉은 벨벳 줄 두 구간. 통행을 막는다.', TAGS + ['관람 줄', '경계'],
           '큰 그림·긴 진열장 앞 1칸에 가로로.', ['painting grand', 'case scroll'])
def rope_barrier3(c):
    for x in (3, 23, 43): stanchion(c, x, 26)
    rope(c, 4, 23, 10); rope(c, 24, 43, 10)
    c.shadow(0, 24, 47, 27)
    c.outline()


@REG.piece('bench museum', '관람 벤치(2칸)', 'museum', 'floor', 2, 1, 0, 'seat',
           '가죽 방석을 댄 등받이 없는 긴 관람 벤치(짙은 나무 다리).', TAGS + ['벤치', '의자'],
           '큰 그림 앞 2~3칸 떨어진 가운데. 양옆 통로를 남긴다.', ['painting grand', 'painting landscape'], use=('sit',))
def bench_museum(c):
    m, w = 'red', 'dwood'
    c.hl(2, 29, 1, K(m, 2))                                  # 방석 뒤 가장자리
    for y in range(2, 7):                                    # 방석 윗면 5줄(위에서 본 면)
        for x in range(2, 30):
            c.p(x, y, K(m, 6 if x < 5 else 4 if x > 27 else 5))
    for x in range(5, 28, 5): c.p(x, 3, K(m, 3)); c.p(x + 2, 5, K(m, 3))   # 단추(누빔)
    c.hl(2, 29, 6, K(m, 6))                                  # 앞 입술(빛)
    for y in (7, 8):                                         # 방석 앞면
        c.hl(2, 29, y, K(m, 3 if y == 7 else 2))
    c.rect(2, 9, 29, 10, K(w, 4)); c.hl(2, 29, 10, K(w, 2))  # 나무 틀
    for x in (3, 4, 27, 28): c.vl(x, 11, 13, K(w, 3 if x in (3, 27) else 2))
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


@REG.piece('plaque stand', '설명판 받침', 'museum', 'floor', 1, 1, 8, 'frame',
           '놋쇠 다리 위 비스듬한 설명판(무늬 테만, 읽는 글자 없음).', TAGS + ['설명판'],
           '유물 받침대 바로 옆이나 앞 모서리.', ['plinth amphora', 'accessory case'], use=('read',))
def plaque_stand(c):
    br, w = 'brass', 'dwood'
    c.ell(7.5, 28.5, 3.5, 1.6, None, only=lambda x, y: K(br, 2 if x < 9 else 1))                   # 받침 원판 앞 테
    c.ell(7.5, 27, 3.5, 1.6, None, only=lambda x, y: K(br, 6 if x < 6 and y < 27 else 5 if x < 9 else 4))   # 받침 윗면
    c.vl(7, 16, 26, K(br, 5)); c.vl(8, 16, 26, K(br, 3))
    # 비스듬히 누운 판(독서대처럼) — 위에서 본 판 윗면 7줄: 뒤 폭 8 → 앞 폭 14(옆 모서리가 비스듬), 뒤 테는 얇고 앞 입술은 두껍다
    for j in range(7):
        y = 7 + j; half = 4 + j // 2 + (1 if j == 6 else 0)
        c.hl(8 - half, 7 + half, y, K(w, 4 if j == 0 else 5))
        c.p(8 - half - 1, y, K(w, 1)); c.p(8 + half, y, K(w, 1))
    c.hl(4, 11, 6, K(w, 1))
    for j in range(1, 6):                                           # 판 위 종이(위에서 본 면, 앞쪽이 넓다)
        y = 7 + j; half = 2 + j // 2
        c.hl(8 - half, 7 + half, y, K('linen', 5 if j < 3 else 6))
    for j in (2, 4):
        half = 1 + j // 2
        for x in range(8 - half, 8 + half, 2): c.p(x, 7 + j, K('linen', 3))
    c.hl(1, 14, 14, K(w, 2)); c.hl(1, 14, 15, K(w, 1))             # 판 앞 두께
    c.shadow(3, 28, 13, 31)
    c.outline()


@REG.piece('geode stand', '자수정 정동 받침', 'museum', 'floor', 1, 1, 8, 'container',
           '나무 받침 위 반으로 가른 자수정 정동(속에 보라 결정).', TAGS + ['광물', '유물'],
           '자연사 전시실 바닥, 화석 곁.', ['plinth fossil', 'plinth'], use=('search',))
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
