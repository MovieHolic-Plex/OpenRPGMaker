"""조선 실내 방 맵 6장 — python3 demo_interior.py [방id ...] [--out DIR] [--png]

방마다 평면(문자열) → interior_room.Room 이 천장·벽면·바닥 그늘을 유도하고, 기물을 놓고(put), interior_checks 가 점검한다.
시트는 하나(공용 키트 + 모든 방의 겹침 칸)를 모든 방이 나눠 쓴다 — 방이 늘어도 기준 칸 번호는 바뀌지 않는다.
산출: tiledata/joseon-interior/<방id>/ {map.json, pieces.json, <id>-chipset.png, extra.json, PNG 3종}, 점검 결과 요약은 stdout.
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, 'harness'))
import interior_room as IR
import interior_checks as IC
import people as PP

UP, RIGHT, FRONT, LEFT = PP.UP, PP.RIGHT, PP.FRONT, PP.LEFT
OUT = os.path.join(IR.ROOT, 'tiledata', 'joseon-interior')
ROOMS = {}


def room(fn):
    ROOMS[fn.__name__] = fn
    return fn


@room
def joseon_in_house():
    """온돌 민가 15×14: 안방(북서 온돌) · 마루(북동) · 부엌+봉당(남쪽 흙바닥, 출입구). 안방 문은 칸막이 3줄 통로, 마루는 봉당으로 트인다."""
    plan = """
###############
#ooooo#mmmmmmm#
#ooooo#mmmmmmm#
#oooooommmmmmm#
#oooooommmmmmm#
#oooooommmmmmm#
#ooooo#mmmmmmm#
#######mmmmmmm#
#ddddddddddddd#
#ddddddddddddd#
#ddddddddddddd#
#ddddddddddddd#
#ddddddddddddd#
##########E####
""".strip('\n')
    r = IR.Room('joseon_in_house', '조선 민가 내부(온돌 안방·마루·부엌)', plan)
    P = r.put
    # 안방: 북벽 이불장 + 병풍, 서쪽 이불·문갑, 가운데 소반과 방석, 화로·등잔
    P('in_ibuljang', 1, 2); P('in_byeongpung_b', 3, 2)
    P('in_ibul_b', 1, 5); P('in_soban_a', 4, 4); P('in_bangseok_r', 3, 4); P('in_bangseok_b', 5, 4)
    P('in_hwaro', 5, 6); P('in_chotdae', 3, 6)
    P('in_door_sill', 6, 5)
    # 마루: 북벽 족자, 쌀뒤주·베틀, 평상
    P('in_jokja_a', 9, 1); P('in_dwiju', 8, 2); P('in_betl', 11, 2); P('in_pyeongsang_3', 9, 5)
    # 부엌(서쪽 흙바닥): 부뚜막·선반·독·물동이·장작
    P('in_bumak_2', 1, 9); P('in_seonban', 4, 8); P('in_hangari_tall', 5, 10)
    P('in_mul_dongi', 1, 12); P('in_jangjak', 3, 12); P('in_hang_sirae', 3, 8); P('in_sokuri_grain', 8, 12); P('in_soban_b', 7, 7)
    # 봉당(동쪽): 항아리·물레
    P('in_hangari_a', 12, 9); P('in_hangari_b', 13, 10); P('in_mulle', 8, 10)
    r.people += [(9, 8, 3, FRONT, 1), (3, 6, 1, RIGHT, 0)]
    return r


@room
def joseon_in_inn():
    """주막 22×14: 북서 부엌(흙) · 큰 마루 홀(주모 상 + 평상 둘 + 상) · 서남 곳간 · 동쪽 손님방 둘(온돌). 출구는 남벽 x=10."""
    plan = """
######################
#dddddd#mmmmmmmm#oooo#
#dddddd#mmmmmmmm#oooo#
#dddddd#mmmmmmmm#oooo#
#dddddddmmmmmmmmooooo#
#dddddddmmmmmmmmooooo#
#dddddddmmmmmmmmooooo#
#dddddd#mmmmmmmm######
########mmmmmmmmooooo#
#ddddddmmmmmmmmmooooo#
#ddddddmmmmmmmmmooooo#
#ddddddmmmmmmmmm#oooo#
#ddddddmmmmmmmmm#oooo#
##########E###########
""".strip('\n')
    r = IR.Room('joseon_in_inn', '조선 주막 내부(마루 홀·부엌·손님방)', plan)
    P = r.put
    # 부엌
    P('in_bumak_3', 1, 3); P('in_dok_row', 5, 3); P('in_mul_dongi', 6, 5); P('in_sang_2', 2, 6)
    P('in_jangjak', 4, 5); P('in_door_sill', 7, 6)
    # 곳간(서남): 독·곡식·메주 매달기
    P('in_dok_row', 1, 11); P('in_sokuri_grain', 5, 11); P('in_hangari_a', 6, 11); P('in_sokuri_veg', 1, 12); P('in_hangari_b', 9, 12); P('in_sokuri_fruit', 13, 12); P('in_hang_meju', 2, 9); P('in_hang_gochu', 4, 9)
    # 홀 북쪽: 주모 상 + 술독 + 선반
    P('in_seonban_bottles', 10, 1); P('in_jokja_a', 13, 1)
    P('in_jumak_counter', 9, 4); P('in_suldok', 8, 3); P('in_dok_row', 14, 3)
    # 홀: 평상 둘 + 상 둘
    P('in_pyeongsang_3', 8, 7); P('in_pyeongsang_3', 12, 7)
    P('in_sang_2', 9, 10); P('in_sang_2', 13, 10); P('in_bangseok_r', 12, 10)
    # 손님방 A (북동)
    P('in_ibuljang', 17, 2); P('in_byeongpung_s', 19, 2); P('in_ibul_r', 19, 5); P('in_soban_b', 18, 5); P('in_door_sill', 16, 6)
    # 손님방 B (동남)
    P('in_jokja_b', 17, 8); P('in_ibuljang', 19, 9); P('in_ibul_r', 19, 11); P('in_hwaro', 17, 12); P('in_door_sill', 16, 10)
    r.people += [(10, 3, 5, FRONT, 1), (13, 9, 2, LEFT, 0), (9, 9, 4, RIGHT, 1)]
    return r


@room
def joseon_in_smith():
    """대장간 14×10: 돌벽 + 흙바닥. 북벽 가운데 화덕(풀무 붙임), 모루·담금 통, 숯더미, 연장 걸이, 문 곁 판매 상. 출구는 남벽 x=6."""
    plan = """
##############
#dddddddddddd#
#dddddddddddd#
#dddddddddddd#
#dddddddddddd#
#dddddddddddd#
#dddddddddddd#
#dddddddddddd#
#dddddddddddd#
######E#######
""".strip('\n')
    r = IR.Room('joseon_in_smith', '조선 대장간 내부(화덕·모루·판매 상)', plan, wall_of={'d': 'dol'})
    P = r.put
    # 북벽: 연장 걸이 둘, 화덕 + 풀무
    P('in_tool_rack', 2, 1); P('in_tool_rack', 9, 1)
    P('in_hwadeok', 5, 2); P('in_pulmu', 7, 3)
    # 작업 삼각: 화덕 – 모루 – 담금 통
    P('in_morus', 5, 5); P('in_tub', 7, 5); P('in_charcoal', 3, 3); P('in_ingots', 10, 4)
    P('in_hoechori', 3, 6)
    # 곁: 작업대·숯 더미, 판매 상(문 곁)
    P('in_workbench', 10, 6); P('in_charcoal', 1, 7); P('in_sang_2', 8, 8); P('in_geolsang', 11, 7)
    r.people += [(6, 5, 6, FRONT, 0), (9, 7, 3, LEFT, 1)]
    return r


@room
def joseon_in_pharmacy():
    """약방 12×10: 마루방. 북벽 약장 둘 + 선반·약초 걸이, 약연·약탕관 화로, 동쪽 온돌 진료 자리(상 + 방석). 출구는 남벽 x=6."""
    plan = """
############
#mmmmmmmmmm#
#mmmmmmmmmm#
#mmmmmmmmmm#
#mmmmmmmmmm#
#mmmmmmoooo#
#mmmmmmoooo#
#mmmmmmoooo#
#mmmmmmoooo#
######E#####
""".strip('\n')
    r = IR.Room('joseon_in_pharmacy', '조선 약방 내부(약장·약탕 화로·진료 자리)', plan)
    P = r.put
    # 북벽: 약장 둘 · 선반 · 약초 걸이
    P('in_yakjang', 2, 2); P('in_yakjang', 4, 2); P('in_seonban_bottles', 6, 1); P('in_herb_hang', 8, 1)
    # 약 짓는 자리: 약상 + 약연 + 약탕관 화로
    P('in_yak_table', 2, 5); P('in_yakyeon', 6, 4); P('in_yakhwa', 2, 7); P('in_sokuri_grain', 10, 3); P('in_hangari_b', 1, 5)
    # 진료 자리: 상 + 방석 둘 + 안석
    P('in_sang_2', 8, 6); P('in_bangseok_r', 7, 6); P('in_bangseok_b', 10, 6); P('in_ansuk', 9, 8)
    r.people += [(9, 5, 3, FRONT, 1), (4, 6, 6, UP, 0)]
    return r


@room
def joseon_in_school():
    """서당 18×12: 창호 벽 마루방. 북쪽에 온돌 단(훈장 자리: 서가·병풍·훈장 상·방석), 앞으로 학동 책상 두 줄. 출구는 남벽 x=9."""
    plan = """
##################
#mmmmmmmmmmmmmmmm#
#mmmmmmmmmmmmmmmm#
#mmmmoooooooommmm#
#mmmmoooooooommmm#
#mmmmmmmmmmmmmmmm#
#mmmmmmmmmmmmmmmm#
#mmmmmmmmmmmmmmmm#
#mmmmmmmmmmmmmmmm#
#mmmmmmmmmmmmmmmm#
#mmmmmmmmmmmmmmmm#
#########E########
""".strip('\n')
    r = IR.Room('joseon_in_school', '조선 서당 내부(훈장 단·학동 책상)', plan, wall_of={'m': 'chang'})
    P = r.put
    # 훈장 단: 앞면 + 가운데 계단 두 칸, 서가·병풍·훈장 상
    P('in_dais_front_l', 5, 5); P('in_dais_steps', 8, 5); P('in_dais_steps', 9, 5)
    for x in (6, 7, 10, 11):
        P('in_dais_front_m', x, 5)
    P('in_dais_front_r', 12, 5)
    P('in_seoga', 5, 2); P('in_byeongpung_s', 8, 2); P('in_seoga', 11, 2)
    P('in_bangseok_r', 8, 4); P('in_hunjang_sang', 11, 4)
    # 벽: 족자 둘, 회초리 통
    P('in_jokja_a', 2, 1); P('in_jokja_b', 15, 1); P('in_gonjang_rack', 3, 3)
    # 학동 책상 두 줄 (앞에 방석)
    for y in (7, 9):
        for i, x in enumerate((3, 6, 11, 14)):
            P('in_hakdong_sang', x, y); P(('in_bangseok_r', 'in_bangseok_g', 'in_bangseok_b', 'in_bangseok_r')[(i + (y == 9)) % 4], x, y + 1)
    P('in_hwaro', 2, 6); P('in_hwaro', 15, 6); P('in_soban_c', 9, 6)
    r.people += [(9, 4, 1, FRONT, 1), (6, 8, 0, UP, 1), (11, 10, 2, UP, 0)]
    return r


@room
def joseon_in_office():
    """관아 동헌 19×15: 전돌 바닥 마루 + 북쪽 원님 단(壇: 병풍·의자·책상·북·호피·촛대, 가운데 3칸 계단). 서쪽 형틀·곤장 틀, 동쪽 서리 책상, 중앙 붉은 깔개, 기둥 넷. 출구는 남벽 x=9."""
    plan = """
###################
#jjjjmmmmmmmmmjjjj#
#jjjjmmmmmmmmmjjjj#
#jjjjmmmmmmmmmjjjj#
#jjjjmmmmmmmmmjjjj#
#jjjjmmmmmmmmmjjjj#
#jjjjmmmmmmmmmjjjj#
#jjjjmmmmmmmmmjjjj#
#jjjjjjjjjjjjjjjjj#
#jjjjjjjjjjjjjjjjj#
#jjjjjjjjjjjjjjjjj#
#jjjjjjjjjjjjjjjjj#
#jjjjjjjjjjjjjjjjj#
#jjjjjjjjjjjjjjjjj#
#########E#########
""".strip('\n')
    r = IR.Room('joseon_in_office', '조선 관아 동헌 내부(원님 단·형틀·서리 책상)', plan, wall_of={'j': 'mok'})
    P = r.put
    # 단: 앞면(l·m·계단 3·m·r) + 병풍·의자·책상·북·호피·촛대
    P('in_dais_front_l', 5, 7)
    for x in (6, 7, 11, 12):
        P('in_dais_front_m', x, 7)
    for x in (8, 9, 10):
        P('in_dais_steps', x, 7)
    P('in_dais_front_r', 13, 7)
    P('in_byeongpung_royal', 8, 2); P('in_gwan_chair', 9, 4); P('in_chaeksang', 9, 6)
    P('in_buk', 6, 4); P('in_mat_hopi', 11, 4); P('in_chotdae', 7, 3); P('in_chotdae', 11, 3)
    # 중앙 붉은 깔개(계단에서 문까지), 기둥 넷
    P('in_runner_n', 9, 8)
    for y in range(9, 14):
        P('in_runner_m', 9, y)
    for (x, y) in ((4, 9), (14, 9), (4, 12), (14, 12)):
        P('in_pillar', x, y)
    # 서쪽: 서가·족자·형틀·곤장 틀
    P('in_seoga', 1, 2); P('in_jokja_a', 4, 1); P('in_hyeongtul', 1, 5); P('in_gonjang_rack', 3, 5)
    # 동쪽: 서가·족자·서리 책상 둘
    P('in_seoga', 16, 2); P('in_jokja_b', 14, 1); P('in_chaeksang', 16, 5); P('in_bangseok_g', 16, 6)
    P('in_chaeksang', 16, 10); P('in_bangseok_b', 16, 11); P('in_hwaro', 2, 10); P('in_hwaro', 15, 8)
    r.people += [(9, 5, 7, FRONT, 1), (16, 7, 2, LEFT, 0), (6, 11, 3, UP, 1)]
    return r


def build(names, outdir, png=False):
    sheet = IR.Sheet()
    res = {}
    for n in names:
        r = ROOMS[n]()
        diff = r.build(sheet, None)
        res[n] = (r, diff)
    for n, (r, diff) in res.items():
        r.write(sheet, os.path.join(outdir, n))
        if png:
            from PIL import Image
            im = r.direct.img(); im.resize((im.width * 3, im.height * 3), Image.NEAREST).save(os.path.join(outdir, n, n + '-x3.png'))
    return sheet, res


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('-')]
    out = OUT
    if '--out' in sys.argv:
        out = sys.argv[sys.argv.index('--out') + 1]; args = [a for a in args if a != out]
    names = args or list(ROOMS)
    sheet, res = build(names, out, png='--png' in sys.argv)
    walk = IC.piece_walk(sheet)
    for n, (r, diff) in res.items():
        rep = IC.analyze(r, sheet, walk)
        print(n, f'{r.W}x{r.H}', 'pixelDiff', diff, {k: len(v) for k, v in rep.items() if isinstance(v, list)})
        if '-v' in sys.argv:
            for k, v in rep.items():
                if isinstance(v, list) and v:
                    print('  ', k, v[:40])
