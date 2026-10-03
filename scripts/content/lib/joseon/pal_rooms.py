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


# ------------------------------------------------------------------------------------------------ 1. 정전 어좌 홀 21×22
def throne():
    g = mk(21, 22)
    rect(g, 1, 1, 19, 19, 'j')
    # 북벽 칸(y1) 의 재질로 벽면 종류가 정해진다: 칸살마다 회벽·창호벽을 번갈아 붉은 기둥이 끝마다 선다
    for (x0, x1) in ((1, 1), (4, 6), (14, 16), (19, 19)):
        hrow(g, 1, x0, x1, 'J')
    g[20][10] = 'D'
    replace = {(2, 1): 'pal_door_gung_l', (3, 1): 'pal_door_gung_r', (17, 1): 'pal_door_gung_l', (18, 1): 'pal_door_gung_r'}
    P = []
    for y in (3, 4, 5, 6):                                   # 단 윗면 4줄(맨 뒷줄은 벽 그늘)
        for x in range(6, 15):
            c = 'l' if x == 6 else ('r' if x == 14 else 'm')
            P.append(('pal_dais_top_%s_%s' % (c, 'b' if y == 3 else 'm'), x, y))
    P.append(('pal_ilwol_byeongpung', 7, 1))                 # 일월오봉도(벽면 두 줄 + 단 위 한 줄), 앞에 용상
    P.append(('pal_yongsang', 9, 4))
    for x in range(6, 15):                                   # 단 앞면 + 돌계단 3칸(어도로 이어진다)
        if 9 <= x <= 11:
            continue
        P.append(('pal_dais_face_%s' % ('l' if x == 6 else ('r' if x == 14 else 'm')), x, 7))
    P.append(('pal_dais_stair_3', 9, 7))
    P.append(('pal_chotdae_big', 6, 3)); P.append(('pal_deungnong_a', 14, 3))
    for y in range(8, 20):                                   # 어도(붉은 카펫 3칸): 연꽃·마름모 줄, 문 앞 끝은 술
        r = 's' if y == 19 else ('a' if y % 2 == 0 else 'b')
        for x, c in ((9, 'l'), (10, 'm'), (11, 'r')):
            P.append(('pal_mat_carpet_%s_%s' % (c, r), x, y))
    P.append(('pal_hyangro_a', 6, 9)); P.append(('pal_hyangro_b', 13, 9))
    for i, (nm_w, nm_e) in enumerate((('pal_mat_sinha_b1', 'pal_mat_sinha_r2'), ('pal_mat_sinha_b2', 'pal_mat_sinha_r3'), ('pal_mat_sinha_b3', 'pal_mat_sinha_r1'))):
        y = 13 + 2 * i
        P.append((nm_w, 6, y)); P.append((nm_e, 13, y))
    pil_w = ('a', 'b', 'c'); pil_e = ('c', 'a', 'b')
    for i, y in enumerate((8, 12, 16)):                      # 기둥 두 줄(머리 y, 발 y+2) + 머리를 잇는 단청 보(보는 맨 마지막에 그려 가구 위로 지난다)
        P.append(('pal_pillar_dan_3' + pil_w[i], 4, y)); P.append(('pal_pillar_dan_3' + pil_e[i], 16, y))
    for y in (8, 12, 16):
        for x in range(5, 16):
            P.append(('pal_beam_dan_' + ('l' if x == 5 else ('r' if x == 15 else 'm')), x, y))
    # 곁 공간: 서쪽 종 걸이, 동쪽 큰 북, 드므·등롱, 벽 걸이 등롱
    P += [('pal_deungnong_a', 1, 4), ('pal_deumeu_a', 1, 8), ('pal_jong_geori', 1, 12),
          ('pal_deungnong_b', 19, 4), ('pal_deumeu_b', 18, 8), ('pal_buk_big', 18, 12),
          ('pal_hang_deungnong_a', 1, 1), ('pal_hang_deungnong_b', 4, 1), ('pal_hang_deungnong_a', 16, 1), ('pal_hang_deungnong_b', 19, 1),
          ('pal_mat_gung_a', 2, 3), ('pal_mat_gung_b', 17, 3),
          # 모퉁이 대기 자리·불: 협문 앞 대기석(서 문신·동 무신)과 입구 곁 화로·등롱
          ('pal_mat_sinha_b1', 2, 6), ('pal_hwaro', 4, 6), ('pal_mat_sinha_r3', 16, 6), ('pal_hwaro', 15, 5),
          ('pal_deungnong_b', 1, 16), ('pal_hwaro', 3, 18), ('pal_deungnong_a', 19, 16), ('pal_hwaro', 17, 18),
          ('pal_bangseok_b', 4, 4), ('pal_bangseok_b', 2, 18), ('pal_bangseok_a', 18, 18), ('pal_bangseok_a', 17, 5)]
    people = [(7, 5, 2, F, 1), (13, 5, 5, F, 0), (8, 13, 3, R, 1), (15, 15, 6, L, 0), (3, 10, 1, U, 0)]
    return dict(id='joseon_in_throne', title='정전 어좌 홀', plan=rows(g), props=P, door=(10, 20), replace=replace, people=people,
                doors_extra=[dict(x=2, y=3, piece='pal_door_gung_l', kind='side'), dict(x=18, y=3, piece='pal_door_gung_r', kind='side')],
                aisle=dict(cells=[(x, y) for x in (9, 10, 11) for y in range(7, 20)], throne='pal_yongsang'))


# ------------------------------------------------------------------------------------------------ 2. 회랑(행각) 32×10
def corridor():
    g = mk(32, 10)
    rect(g, 1, 1, 30, 7, 'g')
    for (x0, x1) in ((5, 8), (17, 20), (29, 30)):          # 칸살 사이 벽은 창호벽, 문 칸살은 회벽
        hrow(g, 1, x0, x1, 'G')
    g[8][15] = 'D'
    replace = {}
    doors = []
    for x0 in (3, 9, 15, 21, 27):
        op = '_open' if x0 == 15 else ''
        replace[(x0, 1)] = 'pal_door_gung%s_l' % op; replace[(x0 + 1, 1)] = 'pal_door_gung%s_r' % op
        doors.append(dict(x=x0, y=3, piece='pal_door_gung%s_l' % op, kind='room'))
    P = []
    pil = ('a', 'b', 'c')
    for i, x in enumerate((3, 8, 13, 18, 23, 28)):          # 남쪽 단청 기둥 줄(머리 y5, 발 y7), 사이는 난간
        P.append(('pal_pillar_dan_3' + pil[(i + 1) % 3], x, 5))
    segs = [(1, 2), (4, 7), (9, 12), (17, 17), (19, 22), (24, 27), (29, 30)]
    for (a, b) in segs:
        for x in range(a, b + 1):
            k = 'l' if (x == a and a == 1) else ('r' if (x == b and b == 30) else 'm')
            P.append(('pal_nangan_' + k, x, 7))
    for x in range(1, 31):                                  # 기둥 머리를 잇는 단청 보(기둥 칸 제외)
        if x in (3, 8, 13, 18, 23, 28):
            continue
        P.append(('pal_beam_dan_m', x, 5))
    for i, x in enumerate((3, 9, 15, 21, 27)):              # 문 앞 깔개
        P.append(('pal_mat_gung_' + 'ab'[i % 2], x, 3))
    # 마루깔개(긴 붉은 깔개): 걷는 줄 y5·y6 에 토막으로
    for (a, b) in ((5, 11), (17, 24)):
        for x in range(a, b + 1):
            P.append(('pal_mat_run_' + ('l' if x == a else ('r' if x == b else 'm')), x, 5))
    P += [('in_b_pyeongsang_3', 5, 3), ('pal_deungnong_b', 12, 3), ('pal_hwaro', 13, 4), ('in_b_pyeongsang_2', 18, 3),
          ('pal_deungnong_a', 24, 3), ('pal_hyangro_b', 25, 3), ('pal_deumeu_a', 1, 3), ('pal_deumeu_b', 29, 3),
          ('pal_hang_deungnong_a', 6, 1), ('pal_hang_deungnong_b', 12, 1), ('pal_hang_deungnong_a', 18, 1), ('pal_hang_deungnong_b', 24, 1),
          ('pal_hang_jokja_a', 8, 1), ('pal_hang_jokja_b', 14, 1), ('pal_hang_jokja_b', 20, 1), ('pal_hang_jokja_a', 26, 1)]
    people = [(7, 6, 3, R, 1), (20, 5, 0, L, 2), (28, 6, 6, F, 0)]
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
        # 침소: 북벽 병풍 앞 침구, 서쪽 벽 용 문양 큰 장, 침구 양옆 촛대, 동쪽 서안·방석·화로, 벽에 족자
        ('pal_yong_jang', 1, 1), ('pal_byeongpung_gung', 7, 2), ('pal_chimgu', 8, 4),
        ('pal_chotdae_big', 6, 3), ('pal_chotdae_big', 11, 3),
        ('pal_hang_jokja_b', 4, 1), ('pal_hang_jokja_a', 14, 1), ('pal_hang_jokja_b', 17, 1),
        ('pal_seoan', 13, 4), ('pal_bangseok_a', 13, 5), ('pal_hwaro', 17, 4), ('pal_bangseok_c', 16, 5),
        ('pal_mat_gung_b', 2, 5), ('pal_bangseok_b', 5, 6), ('pal_bangseok_c', 12, 6), ('pal_mat_gung_a', 8, 6), ('pal_mat_gung_b', 14, 6),
        # 마루 접객 칸: 칸막이 벽 앞 병풍·서가, 교자상에 방석, 모서리 등롱·화로. 칸막이 틈 앞 깔개
        ('pal_byeongpung_gung', 1, 8), ('in_b_seoga_2', 12, 8), ('in_b_seoga_2', 15, 8), ('pal_mat_gung_a', 9, 9),
        ('in_b_gyojasang_3', 3, 11), ('pal_bangseok_b', 3, 10), ('pal_bangseok_c', 5, 10), ('pal_bangseok_a', 4, 12),
        ('pal_deungnong_a', 7, 11), ('pal_hwaro', 17, 11), ('pal_deungnong_b', 18, 10),
        ('pal_seoan', 10, 11), ('pal_bangseok_a', 10, 12), ('pal_mat_gung_b', 13, 11), ('pal_mat_gung_a', 16, 12),
        ('pal_hwaro', 3, 4), ('pal_bangseok_b', 4, 3),
    ]
    people = [(12, 5, 4, F, 0)]
    return dict(id='joseon_in_bedchamber', title='침전', plan=rows(g), props=P, door=(14, 13), replace={}, people=people,
                doors_extra=[dict(x=9, y=10, piece='pal_wall_gungho_m', kind='room')])


ROOMS = [throne(), corridor(), bedchamber()]
