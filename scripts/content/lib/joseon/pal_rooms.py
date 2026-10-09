"""조선 궁 내부 방 3장 평면·배치. 계획서: tiledata/joseon-palace-int/PLAN.md.

평면은 코드로 그린다(rect·set). 평면 문자는 pal_room.py 설명 — j 전돌+회벽 J 전돌+창호벽 g 마루+회벽 G 마루+창호벽 q 온돌+회벽 Q 온돌+창호벽 D 출입구.
props 의 (이름, x, y) 는 조각 왼쪽 위 칸(이름은 전체 이름: 궁 전용 pal_, 후보 B 재사용 in_b_).
각 방 dict: id, title, plan, props, door, replace(벽면 칸을 쌍문 등으로), people, doors_extra(협문·방문 앞 칸), aisle(어좌 방: 어도 검사용).
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


def hrow(g, y, x0, x1, ch):
    for x in range(x0, x1 + 1):
        g[y][x] = ch


# ------------------------------------------------------------------------------------------------ 1. 정전 어좌 홀 21×23
def throne():
    """어도(붉은 카펫)가 있는 가운데 길은 전돌, 양 곁 행랑은 잘게 다른 박석. 서쪽은 문신(서리·장부) 자리, 동쪽은 의례 도구(향로·북·종) 자리."""
    g = mk(21, 23)
    rect(g, 1, 1, 19, 20, 'j')
    rect(g, 1, 1, 4, 20, 'p'); rect(g, 16, 1, 19, 20, 'p')
    # 북벽 칸(y1) 의 재질로 벽면 종류가 정해진다: 칸살마다 회벽·창호벽을 번갈아 붉은 기둥이 끝마다 선다
    for x0, x1, ch in ((1, 1, 'P'), (4, 4, 'P'), (5, 6, 'J'), (14, 15, 'J'), (16, 16, 'P'), (19, 19, 'P')):
        hrow(g, 1, x0, x1, ch)
    g[21][10] = 'D'
    replace = {(2, 1): 'pal_door_gung_l', (3, 1): 'pal_door_gung_r', (17, 1): 'pal_door_gung_l', (18, 1): 'pal_door_gung_r'}
    P = []
    for y in (3, 4, 5, 6):                                   # 단 윗면 4줄(맨 뒷줄은 벽 그늘)
        for x in range(6, 15):
            c = 'l' if x == 6 else ('r' if x == 14 else 'm')
            P.append(('pal_dais_top_%s_%s' % (c, 'b' if y == 3 else 'm'), x, y))
    P.append(('pal_ilwol_byeongpung', 7, 1))                 # 일월오봉도(벽면 두 줄 + 단 위 한 줄), 앞에 용상
    P.append(('pal_yongsang', 9, 4))
    for x in range(6, 15):                                   # 단 앞면 + 돌계단 3칸(돌계단만 보이고 카펫은 계단 아래에서 멈춘다)
        if 9 <= x <= 11:
            continue
        P.append(('pal_dais_face_%s' % ('l' if x == 6 else ('r' if x == 14 else 'm')), x, 7))
    P.append(('pal_dais_stair_3', 9, 7))
    P.append(('pal_chotdae_big', 6, 3)); P.append(('pal_deungnong_a', 14, 3))
    for y in range(8, 21):                                   # 어도(붉은 카펫 3칸): 연꽃·마름모 줄, 문 앞 끝은 술
        r = 's' if y == 20 else ('a' if y % 2 == 0 else 'b')
        for x, c in ((9, 'l'), (10, 'm'), (11, 'r')):
            P.append(('pal_mat_carpet_%s_%s' % (c, r), x, y))
    # 기둥 두 줄(머리 y, 발 y+2): 머리의 두공이 보 노릇을 한다(바닥에 누운 보 없음)
    pil_w = ('a', 'b', 'c'); pil_e = ('c', 'a', 'b')
    for i, y in enumerate((9, 13, 17)):
        P.append(('pal_pillar_dan_3' + pil_w[i], 4, y)); P.append(('pal_pillar_dan_3' + pil_e[i], 16, y))
    # 서쪽(왼쪽): 문신 자리 — 서리 서안 세 벌(두 가지 서안)과 장부 서가, 방석, 화로. 협문 곁에는 대기 깔개
    P += [('pal_mat_sinha_b1', 6, 10), ('pal_seoan', 6, 9), ('pal_bangseok_oa', 7, 10),
          ('pal_mat_sinha_b3', 6, 14), ('pal_seoan_b', 6, 13), ('pal_bangseok_ob', 6, 14),
          ('pal_mat_sinha_b2', 6, 18), ('pal_seoan', 6, 17), ('pal_bangseok_oc', 7, 18),
          ('pal_hwaro', 5, 12), ('pal_hwaro', 5, 16),
          ('in_b_seoga_2', 1, 12), ('pal_bangseok_c', 2, 15), ('pal_mat_gung_c', 1, 16), ('pal_hwaro', 3, 15),
          ('pal_deungnong_a', 1, 4), ('pal_deumeu_a', 1, 8), ('pal_deungnong_b', 1, 19),
          ('pal_mat_sinha_b2', 2, 6), ('pal_bangseok_oa', 2, 6), ('pal_bangseok_ob', 3, 6), ('pal_hwaro', 4, 5), ('pal_mat_gung_b', 2, 19)]
    # 동쪽(오른쪽): 의례 도구 — 어도 곁 향로 둘, 종 걸이, 큰 북
    P += [('pal_hyangro_b', 13, 9), ('pal_hyangro_a', 13, 16),
          ('pal_jong_geori', 17, 12), ('pal_buk_big', 18, 16), ('pal_deumeu_b', 18, 8), ('pal_deungnong_b', 19, 3), ('pal_deungnong_a', 17, 19),
          ('pal_mat_sinha_r2', 16, 5), ('pal_bangseok_oc', 17, 5), ('pal_seoan', 16, 4), ('pal_hwaro', 15, 6), ('in_b_gyojasang_3', 16, 6),
          ('pal_mat_gung_a', 18, 19), ('pal_hwaro', 12, 13), ('pal_bangseok_b', 14, 13), ('pal_mat_gung_c', 14, 19)]
    # 벽 걸이 등롱
    P += [('pal_hang_deungnong_a', 1, 1), ('pal_hang_deungnong_b', 4, 1), ('pal_hang_deungnong_a', 16, 1), ('pal_hang_deungnong_b', 19, 1)]
    # 협문 앞 디딤돌(문턱 노릇)
    P += [('pal_step_stone', 2, 3), ('pal_step_stone', 17, 3)]
    people = [(7, 5, 2, F, 1), (13, 5, 5, F, 0), (8, 11, 3, R, 1), (15, 15, 6, L, 0), (8, 18, 1, L, 0), (12, 19, 4, F, 0)]
    return dict(id='joseon_in_throne', title='정전 어좌 홀', plan=rows(g), props=P, door=(10, 21), replace=replace, people=people,
                doors_extra=[dict(x=2, y=4, piece='pal_door_gung_l', kind='side'), dict(x=18, y=4, piece='pal_door_gung_r', kind='side')],
                aisle=dict(cells=[(x, y) for x in (9, 10, 11) for y in range(7, 21)], throne='pal_yongsang'))


# ------------------------------------------------------------------------------------------------ 2. 회랑(행각) 32×10
def corridor():
    """북쪽 방문 다섯 칸살을 따라 걷는 긴 마루. 남쪽은 기둥(간격 4·6·5·6·4)과 난간(가운데 3칸 열림). 서쪽 끝 당직 자리, 가운데 전시 병풍, 동쪽 끝 향로."""
    g = mk(32, 10)
    rect(g, 1, 1, 30, 7, 'g')
    for (x0, x1) in ((5, 8), (17, 21), (28, 30)):          # 창호벽 칸살(나머지는 회벽)
        hrow(g, 1, x0, x1, 'G')
    g[8][15] = 'D'
    replace = {}
    doors = []
    for x0 in (3, 9, 15, 22, 27):
        op = '_open' if x0 == 15 else ''
        replace[(x0, 1)] = 'pal_door_gung%s_l' % op; replace[(x0 + 1, 1)] = 'pal_door_gung%s_r' % op
        doors.append(dict(x=x0, y=3, piece='pal_door_gung%s_l' % op, kind='room'))
    P = []
    pil = ('a', 'b', 'c')
    pillars = (3, 7, 13, 18, 24, 28)
    for i, x in enumerate(pillars):                         # 남쪽 단청 기둥 줄(머리 y5, 발 y7), 간격 4·6·5·6·4
        P.append(('pal_pillar_dan_3' + pil[(i + 1) % 3], x, 5))
    segs = [(1, 2), (4, 6), (8, 12), (17, 17), (19, 23), (25, 27), (29, 30)]   # 난간: 14~16 은 출입구 앞 3칸 열림
    for (a, b) in segs:
        for x in range(a, b + 1):
            k = 'l' if (x == a and a == 1) else ('r' if (x == b and b == 30) else 'm')
            P.append(('pal_nangan_' + k, x, 7))
    # 문 앞 문턱: 디딤돌·깔개·열린 문 앞 깔개를 섞는다
    P += [('pal_mat_gung_a', 3, 3), ('pal_step_stone', 9, 3), ('pal_mat_gung_c', 15, 3), ('pal_step_stone', 22, 3), ('pal_mat_gung_b', 27, 3)]
    # 마루깔개: 서쪽 붉은 것, 동쪽 푸른 것(같은 깔개를 두 번 쓰지 않는다)
    for (a, b, nm) in ((4, 11, 'pal_mat_run_'), (19, 23, 'pal_mat_runb_')):
        for x in range(a, b + 1):
            P.append((nm + ('l' if x == a else ('r' if x == b else 'm')), x, 5))
    # 서쪽 끝 당직 자리: 서리 서안·방석, 곁에 평상 / 가운데 전시 병풍과 화로 / 동쪽 향로·평상·드므
    P += [('pal_seoan_b', 1, 3), ('pal_mat_sinha_b3', 1, 4), ('pal_bangseok_ob', 2, 4), ('in_b_pyeongsang_3', 5, 3),
          ('pal_byeongpung_gung2', 11, 2), ('pal_hwaro', 10, 4), ('pal_hwaro', 15, 4), ('pal_mat_gung_c', 13, 5), ('pal_mat_gung_a', 16, 6),
          ('in_b_pyeongsang_2', 18, 3), ('pal_deungnong_b', 17, 3), ('pal_bangseok_oc', 20, 4),
          ('pal_deungnong_a', 24, 3), ('pal_hyangro_b', 25, 3), ('pal_deumeu_b', 29, 3),
          ('pal_hang_deungnong_a', 6, 1), ('pal_hang_deungnong_b', 19, 1), ('pal_hang_deungnong_a', 29, 1), ('pal_hang_deungnong_b', 1, 1),
          ('pal_hang_jokja_a', 24, 1), ('pal_hang_jokja_b', 7, 1)]
    people = [(2, 5, 2, F, 0), (21, 6, 0, L, 2), (29, 6, 6, F, 0)]
    return dict(id='joseon_in_corridor', title='회랑(행각)', plan=rows(g), props=P, door=(15, 8), replace=replace, people=people, doors_extra=doors)


# ------------------------------------------------------------------------------------------------ 3. 침전(왕의 침소) 20×15
def bedchamber():
    g = mk(20, 15)
    rect(g, 1, 1, 18, 6, 'q')                                # 침소(온돌)
    for (x0, x1) in ((1, 6), (11, 18)):
        hrow(g, 1, x0, x1, 'Q')
    hrow(g, 1, 7, 10, 'Q')                                   # 병풍 뒤 벽도 창호벽(흰 회벽 한 칸이 비어 보이지 않게)
    rect(g, 1, 8, 18, 12, 'g')                               # 접객 마루
    hrow(g, 8, 1, 18, 'G'); hrow(g, 9, 1, 18, 'G')
    rect(g, 9, 7, 10, 9, 'g')                                # 칸막이 틈 2칸 폭, 3줄(y7~9) — 걷는 줄 y10
    g[13][14] = 'D'
    P = [
        # 침소 — 잠자리 묶음: 병풍 앞 침구, 양옆 촛대, 발치 깔개. 왼쪽은 옷·함 묶음(용장·화로·방석), 오른쪽은 글 읽는 묶음(서안·방석·화로)
        ('pal_yong_jang', 1, 1), ('pal_byeongpung_gung', 7, 2), ('pal_chimgu', 8, 4),
        ('pal_chotdae_big', 6, 3), ('pal_chotdae_big', 11, 3), ('pal_mat_gung_a', 8, 6),
        ('pal_hang_jokja_b', 4, 1), ('pal_hang_jokja_a', 14, 1), ('pal_hang_jokja_b', 17, 1),
        ('pal_mat_sinha_b3', 2, 5), ('pal_bangseok_oa', 3, 5), ('pal_hwaro', 4, 4), ('pal_mat_gung_c', 4, 6), ('pal_bangseok_c', 5, 3), ('pal_mat_sinha_r1', 11, 5),
        ('pal_seoan', 13, 4), ('pal_mat_sinha_r2', 13, 5), ('pal_bangseok_ob', 14, 5), ('pal_hwaro', 17, 4), ('pal_mat_gung_c', 16, 5),
        # 마루 접객 칸 — 병풍(다른 그림)·교자상과 방석 셋(차 마시는 자리), 서가와 서안(글 자리), 모서리 등롱·화로. 칸막이 틈은 디딤돌
        ('pal_byeongpung_gung2', 1, 8), ('in_b_seoga_2', 12, 8), ('in_b_seoga_2', 15, 8), ('pal_step_stone', 9, 9),
        ('in_b_gyojasang_3', 3, 11), ('pal_bangseok_oa', 3, 10), ('pal_bangseok_ob', 5, 10), ('pal_bangseok_oc', 4, 12), ('pal_deungnong_a', 7, 11),
        ('pal_seoan_b', 16, 11), ('pal_mat_sinha_r1', 16, 12), ('pal_bangseok_oc', 17, 12), ('pal_hwaro', 18, 12), ('pal_deungnong_b', 18, 10), ('pal_mat_gung_a', 13, 11), ('pal_deungnong_b', 11, 11), ('pal_mat_gung_b', 9, 11),
    ]
    people = [(12, 5, 1, F, 0)]
    return dict(id='joseon_in_bedchamber', title='침전', plan=rows(g), props=P, door=(14, 13), replace={}, people=people,
                doors_extra=[dict(x=9, y=10, piece='pal_wall_gungho_m', kind='room')])


ROOMS = [throne(), corridor(), bedchamber()]
