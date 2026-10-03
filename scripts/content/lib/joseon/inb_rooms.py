"""조선 실내 방 6장 평면·배치(후보 B). 계획서: tiledata/joseon-interior-b/PLAN.md.

평면은 코드로 그린다(rect·set). 평면 문자는 inb_room.py 설명 — o 온돌 c 온돌+창호벽 m 마루 k 마루+창호벽 M 마루+목재벽 d 흙+황토벽 s 돌+돌벽 b 흙+돌벽 D 출입구.
props 의 (이름, x, y) 는 조각 왼쪽 위 칸. 이름은 접두 in_b_ 를 뺀 짧은 이름으로 쓴다(N()).
"""
import people as PP

U, R, F, L = PP.UP, PP.RIGHT, PP.FRONT, PP.LEFT


def mk(w, h, fill='#'):
    return [[fill] * w for _ in range(h)]


def rect(g, x0, y0, x1, y1, ch):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            g[y][x] = ch


def rows(g):
    return [''.join(r) for r in g]


def P(items):
    """[(짧은이름, x, y)] → [(in_b_이름, x, y)]"""
    return [('in_b_' + n, x, y) for (n, x, y) in items]


# ------------------------------------------------------------------------------------------------ 1. 온돌 민가 15×11
def house():
    g = mk(15, 11)
    rect(g, 1, 1, 3, 6, 'd'); rect(g, 5, 1, 8, 8, 'o'); rect(g, 10, 1, 13, 8, 'k')
    rect(g, 4, 4, 4, 6, 'm')                     # 부엌 ↔ 안방 문(북 막힘 3칸 → 벽면 2 + 걷는 줄 1 = (4,6))
    rect(g, 9, 5, 9, 7, 'm')                     # 안방 ↔ 마루 문(걷는 줄 (9,7))
    g[9][11] = 'D'
    props = P([
        # 부엌(흙, 황토벽): 부뚜막이 북벽, 곁에 땔감, 시래기·메주, 구석에 독·항아리·물동이 — 문(4,6)에서 (3,6)·(3,5)·(3,4)·(2,4) 로 걷는 길
        ('bumak_2', 1, 2), ('mat_jip_2x2', 2, 4), ('jangjak', 3, 3), ('hang_sirae', 1, 1), ('hang_meju', 2, 1),
        ('dok_big', 1, 5), ('hangari_s', 2, 6), ('muldongi', 1, 4),
        # 안방(온돌, 회벽): 북벽에 이불장·병풍, 가운데 돗자리에 앉은뱅이 상과 방석(둘레로 걷는다), 남쪽에 문갑·반닫이·개킨 이불
        ('ibuljang', 5, 2), ('byeongpung_2', 7, 2), ('jokja_a', 5, 1), ('jokja_c', 7, 1),
        ('mat_dot_2x2', 6, 5), ('sang_low_2', 6, 5), ('banseok_r', 6, 6), ('banseok_b', 7, 6),
        ('hwaro', 8, 4), ('ibul_folded', 7, 7), ('banseok_g', 5, 7), ('bandaji_1', 5, 8), ('munggap', 6, 8), ('ibul_folded', 8, 8),
        # 마루(창호벽): 길쌈 — 베틀, 곁에 물레·반짇고리, 쌀뒤주, 평상, 앞 짚자리
        ('betul', 10, 2), ('ssal_dwiju', 13, 2), ('mulle', 10, 4), ('sewing', 10, 5), ('geolsang_2', 12, 5),
        ('deungjan_stand', 13, 7), ('mat_jip_2x2', 10, 7), ('soban_a', 13, 6),
    ])
    return dict(id='joseon_in_house_b', title='온돌 민가', plan=rows(g), props=props, door=(11, 9),
                replace={(3, 1): 'in_b_win_heuk'},
                people=[(6, 7, 0, F, 1), (12, 7, 3, U, 0)])


ROOMS = [house()]


# ------------------------------------------------------------------------------------------------ 2. 주막 22×14
def inn():
    g = mk(22, 14)
    rect(g, 1, 1, 5, 5, 'd')                     # 부엌
    rect(g, 1, 7, 5, 11, 'b')                    # 곳간
    rect(g, 7, 1, 15, 11, 'k')                   # 술청(마루, 창호벽)
    rect(g, 17, 1, 20, 5, 'o'); rect(g, 17, 7, 20, 11, 'o')   # 객실 둘
    rect(g, 6, 3, 6, 5, 'm'); rect(g, 6, 9, 6, 11, 'm')      # 부엌·곳간 문(걷는 줄 (6,5)·(6,11))
    rect(g, 16, 3, 16, 5, 'm'); rect(g, 16, 9, 16, 11, 'm')  # 객실 문(걷는 줄 (16,5)·(16,11))
    g[12][11] = 'D'
    props = P([
        # 부엌: 부뚜막 북벽, 땔감·독·물동이·시래기
        ('bumak_3', 1, 2), ('hang_sirae', 4, 1), ('hang_meju', 5, 1), ('jangjak', 4, 3), ('hangari_m', 5, 3),
        ('muldongi', 1, 5), ('hangari_s', 2, 5), ('sokuri_veg', 3, 5),
        # 곳간: 쌀뒤주·독·술독·항아리
        ('ssal_dwiju', 1, 8), ('dok_big', 2, 8), ('suldok', 3, 9), ('hangari_m', 4, 9), ('hangari_s', 2, 11),
        ('hang_gochu', 3, 7), ('hang_bagaji', 4, 7), ('sokuri_grain', 1, 11), ('hangari_straw', 4, 10),
        # 술청: 북벽 앞 주모 자리(상·술독), 평상 둘에 상, 문 앞 벽쪽 걸상
        ('byeongpung_a', 8, 2), ('jokja_a', 12, 1), ('jokja_c', 14, 1), ('juga_3', 12, 3), ('suldok', 15, 3), ('hwaro', 7, 3),
        ('pyeongsang_3', 8, 6), ('soban_a', 9, 5), ('pyeongsang_3', 13, 7), ('soban_b', 14, 6), ('pyeongsang_2', 8, 8), ('soban_c', 10, 8),
        ('geolsang_2', 8, 10), ('pyeongsang_2', 14, 9), ('stool', 13, 10), ('mat_jip_3x2', 11, 5), ('mat_jip_3x2', 10, 9),
        # 객실 1: 이불장·병풍, 낮은 상과 방석
        ('ibuljang', 17, 2), ('byeongpung_2', 19, 2), ('mat_dot_2x2', 19, 4), ('sang_low_2', 19, 5), ('banseok_b', 18, 4),
        # 객실 2: 농·이불장, 반닫이
        ('ibuljang', 17, 8), ('nong_2', 19, 8), ('bandaji_2', 19, 11), ('ibul_folded', 20, 10),
    ])
    return dict(id='joseon_in_inn_b', title='주막', plan=rows(g), props=props, door=(11, 12),
                people=[(12, 8, 2, R, 1), (12, 4, 5, L, 1), (8, 4, 4, F, 0)])


ROOMS += [inn()]


# ------------------------------------------------------------------------------------------------ 3. 대장간 16×12
def smith():
    g = mk(14, 10)
    rect(g, 1, 1, 7, 7, 'b')                     # 작업장(흙바닥, 돌벽)
    rect(g, 9, 1, 12, 5, 'o')                    # 장인의 작은 방
    rect(g, 8, 3, 8, 5, 'm')                     # 문(걷는 줄 (8,5))
    g[8][5] = 'D'
    props = P([
        # 북벽: 화덕·풀무, 곁에 숯더미, 벽에 연장
        ('hwadeok_3', 1, 2), ('pungmu', 4, 3), ('hang_tools', 4, 1), ('hang_tools', 6, 1), ('sutdeomi', 7, 3),
        # 작업: 모루 앞에 담금질 통, 숫돌, 작업대, 쇠 더미
        ('moru', 3, 5), ('dameum', 2, 5), ('sutdol', 7, 4), ('gongjang', 1, 7), ('cheol', 1, 4),
        ('cheol', 3, 7), ('hangari_m', 7, 6), ('mat_jip_2x2', 4, 6),
        # 방
        ('ibuljang', 9, 2), ('byeongpung_2', 11, 2), ('mat_dot_2x2', 10, 4), ('sang_low_2', 10, 5), ('banseok_r', 12, 4),
    ])
    return dict(id='joseon_in_smith_b', title='대장간', plan=rows(g), props=props, door=(5, 8), replace={},
                people=[(4, 4, 1, R, 1), (9, 4, 6, L, 0)])


ROOMS += [smith()]


# ------------------------------------------------------------------------------------------------ 4. 약방 14×10
def pharmacy():
    g = mk(14, 10)
    rect(g, 1, 1, 7, 7, 'M')                     # 약방(마루, 목재벽)
    rect(g, 9, 1, 12, 5, 'o')                    # 의원의 방
    rect(g, 8, 3, 8, 5, 'm')                     # 문(걷는 줄 (8,5))
    g[8][5] = 'D'
    props = P([
        # 북벽: 약장 둘(큰 것·작은 것), 말린 약초, 선반
        ('yakjang_2', 1, 1), ('yakjang_1', 3, 2), ('hang_yakcho', 3, 1), ('yakjang_2', 4, 1), ('seonban_2', 6, 2),
        # 약 짓는 자리: 상, 약연, 작두, 약탕, 약초 광주리
        ('yak_table', 1, 5), ('yakyeon', 3, 5), ('jakdu', 7, 4), ('yakdang', 1, 7), ('yakcho_basket', 7, 6), ('mat_jip_2x2', 3, 6), ('stool', 5, 4), ('hangari_m', 7, 7),
        # 방
        ('ibuljang', 9, 2), ('nong_1', 11, 2), ('mat_dot_2x2', 10, 4), ('sang_low_2', 10, 5), ('banseok_b', 12, 4),
    ])
    return dict(id='joseon_in_pharmacy_b', title='약방', plan=rows(g), props=props, door=(5, 8), replace={},
                people=[(3, 6, 2, R, 1), (9, 4, 6, L, 0)])


ROOMS += [pharmacy()]
