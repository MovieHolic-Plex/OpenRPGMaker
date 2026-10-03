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
    rect(g, 1, 1, 3, 6, 'e'); rect(g, 5, 1, 8, 8, 'o'); rect(g, 10, 1, 13, 8, 'k')
    rect(g, 4, 4, 4, 6, 'm')                     # 부엌 ↔ 안방 문(북 막힘 3칸 → 벽면 2 + 걷는 줄 1 = (4,6))
    rect(g, 9, 5, 9, 7, 'm')                     # 안방 ↔ 마루 문(걷는 줄 (9,7))
    g[9][11] = 'D'
    props = P([
        # 부엌(흙바닥, 회벽): 부뚜막이 북벽, 곁에 땔감, 시래기·메주, 구석에 독·항아리·물동이
        ('bumak_2', 1, 2), ('jangjak', 3, 3), ('hang_sirae', 1, 1), ('hang_meju', 2, 1), ('mat_jip_2x2', 2, 4),
        ('dok_big', 1, 5), ('hangari_s', 2, 6), ('muldongi', 1, 4),
        # 안방(온돌, 회벽): 북벽에 이불장·병풍, 가운데 돗자리에 앉은뱅이 상과 방석(둘레로 걷는다), 남쪽에 문갑·반닫이·개킨 이불
        ('ibuljang', 5, 2), ('byeongpung_2', 7, 2), ('jokja_a', 5, 1), ('jokja_c', 7, 1),
        ('mat_dot_2x2', 6, 5), ('sang_low_2', 6, 5), ('banseok_r', 6, 6), ('banseok_b', 7, 6),
        ('hwaro', 8, 4), ('banseok_g', 5, 7),
        ('bandaji_1', 5, 8), ('munggap', 6, 8), ('ibul_folded', 7, 7), ('ibul_folded', 8, 8),
        # 마루(창호벽): 길쌈 — 베틀, 곁에 물레·반짇고리, 쌀뒤주, 평상, 앞 짚자리
        ('betul', 10, 2), ('ssal_dwiju', 13, 2), ('mulle', 10, 4), ('sewing', 10, 5), ('geolsang_2', 12, 5),
        ('deungjan_stand', 13, 7), ('mat_jip_2x2', 10, 7), ('soban_a', 13, 6),
    ])
    return dict(id='joseon_in_house_b', title='온돌 민가', plan=rows(g), props=props, door=(11, 9),
                replace={(3, 1): 'in_b_win_hoe', (4, 4): 'in_b_door_open', (9, 5): 'in_b_door_slide_open_l'},
                people=[(6, 7, 0, F, 1), (12, 7, 3, U, 0)])


# ------------------------------------------------------------------------------------------------ 2. 주막 22×14
def inn():
    g = mk(22, 14)
    rect(g, 1, 1, 5, 5, 'e')                     # 부엌
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
        # 술청: 북벽 앞 주모 자리(상·술독), 평상 넷(널 결이 다른 세 가지)에 상, 문 앞 벽쪽 걸상
        ('byeongpung_a', 8, 2), ('jokja_a', 12, 1), ('jokja_c', 14, 1), ('juga_3', 12, 3), ('suldok', 15, 3), ('hwaro', 7, 3),
        ('pyeongsang_3b', 8, 6), ('soban_a', 9, 5), ('pyeongsang_3', 13, 7), ('soban_b', 14, 6), ('pyeongsang_2c', 8, 8), ('soban_c', 10, 8),
        ('geolsang_2', 8, 10), ('pyeongsang_2b', 14, 9), ('stool', 13, 10), ('mat_jip_3x2', 11, 5), ('mat_jip_3x2', 10, 9),
        # 객실 1: 이불장, 붉은 이불과 푸른 이불을 깐 잠자리(머리맡 베개)
        ('ibuljang', 17, 2), ('jokja_a', 19, 1), ('jokja_b', 20, 1), ('ibul_r', 19, 3), ('ibul_b', 20, 3), ('banseok_g', 18, 5),
        # 객실 2: 농과 반닫이, 붉은 이불 잠자리와 개킨 이불
        ('nong_2', 17, 8), ('jokja_c', 19, 7), ('ibul_r', 19, 9), ('ibul_b', 20, 9), ('bandaji_1', 18, 10),
    ])
    return dict(id='joseon_in_inn_b', title='주막', plan=rows(g), props=props, door=(11, 12),
                replace={(6, 3): 'in_b_door_open', (6, 9): 'in_b_door_plank', (16, 3): 'in_b_door_slide_open_l', (16, 9): 'in_b_door_slide_open_r'},
                people=[(12, 8, 2, R, 1), (12, 4, 5, L, 1), (8, 4, 4, F, 0)])


# ------------------------------------------------------------------------------------------------ 3. 대장간 14×9
def smith():
    g = mk(13, 9)
    rect(g, 1, 1, 6, 6, 'b')                     # 작업장(흙바닥, 돌벽)
    rect(g, 8, 1, 11, 5, 'o')                    # 장인의 작은 방
    rect(g, 7, 3, 7, 5, 'm')                     # 문(걷는 줄 (7,5))
    g[7][5] = 'D'
    props = P([
        # 북벽: 화덕·풀무, 곁에 숯더미, 벽에 연장
        ('hwadeok_3', 1, 2), ('pungmu', 4, 3), ('hang_tools', 4, 1), ('hang_tools', 6, 1), ('sutdeomi', 6, 3),
        # 작업: 화덕 앞에 담금질 통·모루, 망치 그루터기, 숫돌, 작업대, 항아리
        ('dameum', 1, 4), ('moru', 3, 4), ('mangchi_teul', 1, 5), ('sutdol', 3, 6), ('gongjang', 1, 6),
        # 장인의 방: 농 하나, 벽 족자, 펴 놓은 잠자리
        ('nong_2', 8, 2), ('jokja_b', 10, 1), ('ibul_r', 10, 3), ('ibul_b', 11, 3), ('banseok_g', 11, 5),
    ])
    return dict(id='joseon_in_smith_b', title='대장간', plan=rows(g), props=props, door=(5, 7),
                replace={(7, 3): 'in_b_door_slide_open_l'},
                people=[(4, 5, 1, R, 1), (9, 4, 6, L, 0)])


# ------------------------------------------------------------------------------------------------ 4. 약방 14×10
def pharmacy():
    g = mk(14, 10)
    rect(g, 1, 1, 7, 7, 'M')                     # 약방(마루, 목재벽)
    rect(g, 9, 1, 12, 5, 'o')                    # 의원의 방
    rect(g, 8, 3, 8, 5, 'm')                     # 문(걷는 줄 (8,5))
    g[8][5] = 'D'
    props = P([
        # 북벽: 약장 둘(큰 것·작은 것), 말린 약초, 호리병 약 선반
        ('yakjang_2', 1, 1), ('yakjang_1', 3, 2), ('hang_yakcho', 3, 1), ('yakjang_2', 4, 1), ('yakseonban_2', 6, 2),
        # 약 짓는 자리: 상, 약연, 작두, 약탕, 약초 광주리
        ('yak_table', 1, 5), ('yakyeon', 3, 5), ('jakdu', 7, 4), ('yakdang', 1, 7), ('yakcho_basket', 7, 6), ('mat_jip_2x2', 3, 6), ('stool', 5, 4), ('hangari_m', 7, 7),
        # 의원의 방: 농 하나 + 반닫이, 잠자리 하나, 족자
        ('nong_1', 9, 2), ('bandaji_2', 10, 3), ('jokja_c', 11, 1), ('ibul_r', 12, 3), ('banseok_b', 12, 5),
    ])
    return dict(id='joseon_in_pharmacy_b', title='약방', plan=rows(g), props=props, door=(5, 8),
                replace={(8, 3): 'in_b_door_slide_open_l'},
                people=[(3, 6, 2, R, 1), (9, 4, 6, L, 0)])


# ------------------------------------------------------------------------------------------------ 5. 서당 18×13
def school():
    g = mk(18, 13)
    rect(g, 1, 1, 10, 10, 'M')                   # 강당(마루, 목재벽)
    rect(g, 3, 3, 8, 4, 'c')                     # 훈장 단(온돌 장판빛의 낮은 단 — 마루와 바닥 빛이 다르다)
    rect(g, 12, 1, 16, 5, 'o'); rect(g, 11, 3, 11, 5, 'm')            # 훈장 방 + 문(걷는 줄 (11,5))
    rect(g, 12, 7, 16, 10, 'M'); rect(g, 11, 8, 11, 10, 'm')          # 서고 + 문(걷는 줄 (11,10))
    g[11][5] = 'D'
    props = P([
        # 북벽: 병풍 아래 훈장 서안(단 위), 단 앞 나무 계단과 마구리, 책장
        ('byeongpung_a', 4, 1), ('seoan_2', 5, 3), ('banseok_r', 6, 4), ('hoechori', 8, 3),
        ('dais_wood_l', 3, 5), ('dais_wood_m', 4, 5), ('stair_dais_wood_2', 5, 5), ('dais_wood_m', 7, 5), ('dais_wood_r', 8, 5),
        ('seoga_2', 9, 2), ('chaekdemi', 1, 3),
        # 학동 자리: 긴 상에 둘이 나란히, 외 서안 둘, 서안 둘 맞붙인 한 쌍 — 줄·간격을 일부러 어긋나게
        ('sang_low_2', 2, 7), ('banseok_g', 2, 8), ('banseok_b', 3, 8),
        ('seoan', 2, 9), ('banseok_r', 2, 10),
        ('seoan', 8, 6), ('banseok_r', 8, 7),
        ('seoan', 7, 8), ('seoan', 8, 8), ('banseok_g', 7, 9), ('banseok_b', 8, 9),
        ('boryo_2', 5, 7), ('mat_jip_3x2', 4, 9), ('stool', 10, 9), ('hwaro', 1, 5), ('chotdae', 3, 3), ('chotdae', 7, 3), ('deungjan_stand', 10, 5),
        # 훈장 방: 서가·농·병풍, 낮은 상과 방석, 개킨 이불
        ('seoga_1', 12, 2), ('nong_2', 13, 2), ('byeongpung_2', 15, 2), ('sang_low_2', 13, 5), ('banseok_b', 13, 4), ('ibul_folded', 16, 4),
        # 서고
        ('seoga_2', 12, 7), ('seoga_2', 14, 7), ('seoga_1', 16, 7), ('mungseo_ham', 16, 10), ('seoan_2', 13, 10),
    ])
    return dict(id='joseon_in_school_b', title='서당', plan=rows(g), props=props, door=(5, 11),
                replace={(11, 3): 'in_b_door_slide_open_l', (11, 8): 'in_b_door_plank'},
                people=[(5, 3, 3, F, 1), (3, 10, 4, U, 0), (9, 7, 2, L, 0)])


# ------------------------------------------------------------------------------------------------ 6. 관아 동헌 21×15
def office():
    g = mk(21, 15)
    rect(g, 1, 1, 11, 12, 'S')                   # 대청(박석 바닥, 목재벽)
    rect(g, 3, 3, 9, 7, 'M')                     # 사또 단(마루 널 — 박석 바닥 위로 한 단 올라선다)
    rect(g, 13, 1, 19, 5, 'o'); rect(g, 12, 3, 12, 5, 'm')            # 서기방 + 문(걷는 줄 (12,5))
    rect(g, 13, 7, 19, 11, 'b'); rect(g, 12, 9, 12, 11, 'm')          # 곳간 + 문(걷는 줄 (12,11))
    g[13][6] = 'D'
    props = P([
        # 단 위: 일월오봉 병풍 앞에 큰 의자, 그 앞에 책상, 곁에 호피와 촛대. 앞은 목재 단 가장자리와 가운데 계단
        ('byeongpung_royal', 5, 1), ('throne', 5, 3), ('gwan_desk_2', 5, 5), ('mat_hopi', 7, 3), ('chotdae', 3, 4), ('chotdae', 9, 6), ('chotdae', 3, 6),
        ('dais_wood_l', 3, 8), ('dais_wood_m', 4, 8), ('stair_dais_wood_3', 5, 8), ('dais_wood_m', 8, 8), ('dais_wood_r', 9, 8),
        # 가운데 붉은 길 깔개와 길 양옆 기둥 두 쌍
        ('mat_carpet_v4', 6, 9), ('pillar_red_2', 3, 9), ('pillar_red_2', 9, 9), ('pillar_red_2', 3, 11), ('pillar_red_2', 9, 11),
        # 왼쪽: 서가, 곤장 틀과 걸이. 오른쪽: 서가, 아전 서안 둘, 북
        ('seoga_2', 1, 2), ('seoga_2', 10, 2), ('hang_tools', 3, 1), ('hang_tools', 9, 1),
        ('gonjang_teul', 1, 4), ('gonjang_geori', 1, 6), ('hwaro', 1, 10), ('deungjan_stand', 9, 4),
        ('seoan_2', 10, 6), ('banseok_g', 10, 7), ('seoan', 10, 9), ('banseok_b', 10, 10), ('buk', 11, 11),
        # 서기방: 서가 둘, 서안 둘(서기가 마주 앉는다), 화로
        ('seoga_2', 13, 2), ('seoga_1', 15, 2), ('jokja_a', 17, 1), ('byeongpung_2', 18, 2), ('seoan_2', 15, 4), ('banseok_r', 15, 5), ('hwaro', 19, 4),
        # 곳간: 쌀뒤주·독·문서함
        ('ssal_dwiju', 13, 8), ('dok_big', 14, 8), ('mungseo_ham', 16, 10), ('hangari_m', 18, 10), ('chaekdemi', 17, 10), ('hangari_s', 19, 9),
    ])
    return dict(id='joseon_in_office_b', title='관아 동헌', plan=rows(g), props=props, door=(6, 13),
                replace={(12, 3): 'in_b_door_plank', (12, 9): 'in_b_door_slide_open_l'},
                people=[(7, 7, 3, F, 1), (2, 8, 1, R, 0), (8, 12, 6, L, 0), (14, 3, 4, U, 0)])


ROOMS = [house(), inn(), smith(), pharmacy(), school(), office()]
