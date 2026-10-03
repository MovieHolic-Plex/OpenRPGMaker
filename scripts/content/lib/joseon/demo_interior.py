"""조선 실내 방 맵 6장 — python3 demo_interior.py [방id ...] [--out DIR] [--png]

방마다 평면(문자열) → interior_room.Room 이 천장·벽면·바닥 그늘을 유도하고, 기물을 놓고(put), interior_checks 가 점검한다.
시트는 하나(공용 키트 + 모든 방의 겹침 칸)를 모든 방이 나눠 쓴다 — 방이 늘어도 기준 칸 번호는 바뀌지 않는다.
산출: tiledata/joseon-interior/<방id>/ {map.json, pieces.json, <id>-chipset.png, extra.json, PNG 3종}, 점검 결과 요약은 stdout.
"""
import json, os, sys
os.environ.setdefault('JS_PROFILE', 'interior')      # mapgate 의 실내 합격선(check_interior)
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
    """온돌 민가 15×13: 안방(북서 온돌) · 마루(북동) · 부엌(서남 흙바닥) · 봉당(동남 흙마당, 장독대·물레·절구). 안방 문은 칸막이 3줄 통로(문틀), 마루는 봉당으로 트인다. 출구는 남벽 x=10."""
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
##########E####
""".strip('\n')
    r = IR.Room('joseon_in_house', '조선 민가 내부(온돌 안방·마루·부엌·봉당)', plan)
    P = r.put
    # 안방: 북벽 이불장 + 병풍, 서쪽 이불, 가운데 소반·방석 둘, 화로
    P('in_ibuljang', 1, 2); P('in_byeongpung_b', 3, 2)
    P('in_ibul_b', 1, 5); P('in_soban_a', 4, 4); P('in_bangseok_r', 3, 4); P('in_bangseok_b', 5, 4)
    P('in_hwaro', 5, 6); P('in_chotdae', 3, 6)
    P('in_doorway', 6, 5)
    # 마루: 북벽 족자, 쌀뒤주·베틀, 평상 하나
    P('in_jokja_a', 9, 1); P('in_dwiju', 8, 2); P('in_betl', 11, 2); P('in_pyeongsang_3', 10, 5); P('in_soban_a', 8, 4); P('in_bangseok_g', 8, 5)
    # 부엌(서쪽 흙바닥): 부뚜막·선반·물동이·밥상 — 부뚜막 곁에 땔감, 독은 벽 쪽
    P('in_bumak_2', 1, 9); P('in_seonban', 4, 8); P('in_hang_sirae', 3, 8); P('in_jangjak', 3, 10)
    P('in_mul_dongi', 1, 11); P('in_soban_b', 5, 10); P('in_hangari_b', 7, 11)
    # 봉당(동쪽): 장독대(큰 독 · 중간 · 작은 독 비스듬히), 물레, 절구통(쌀)
    P('in_hangari_tall', 13, 9); P('in_hangari_a', 12, 10); P('in_sokuri_grain', 8, 9); P('in_mulle', 9, 11)
    r.people += [(9, 7, 0, FRONT, 1)]                                   # 마루에 선 평민 하나(안방 방석·촛대 위에 겹치지 않게)
    return r


@room
def joseon_in_inn():
    """주막 22×14: 북서 부엌(흙) · 큰 마루 홀(주모 상 + 평상 + 상 둘) · 서남 곳간 · 동쪽 손님방 둘(온돌, 서로 다른 세간). 출구는 남벽 x=10."""
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
    # 부엌: 부뚜막(곁에 땔감·솥), 술독, 상, 물동이
    P('in_bumak_3', 1, 3); P('in_suldok', 5, 3); P('in_mul_dongi', 6, 5); P('in_sang_2', 2, 6)
    P('in_jangjak', 4, 5); P('in_doorway', 7, 6)
    # 곳간(서남, 바닥 두 줄): 독·곡식·채소 — 서로 다른 그릇, 벽에는 메주·고추
    P('in_dok_row', 1, 11); P('in_sokuri_grain', 4, 11); P('in_hangari_a', 6, 11)
    P('in_hang_meju', 2, 9); P('in_hang_gochu', 4, 9)
    # 홀 북쪽: 주모 상 + 술독 + 선반
    P('in_seonban_bottles', 10, 1); P('in_jokja_a', 13, 1)
    P('in_jumak_counter', 9, 4); P('in_hangari_a', 8, 3); P('in_hangari_b', 14, 3)
    # 홀: 큰 평상(남서) · 상 둘(동·남, 엇갈리게) · 방석
    P('in_pyeongsang_3', 9, 8); P('in_sang_2', 13, 7); P('in_bangseok_r', 12, 7); P('in_sang_jumak', 12, 10); P('in_bangseok_b', 14, 10)
    P('in_sokuri_fruit', 14, 12); P('in_hangari_tall', 15, 8); P('in_hangari_b', 9, 12); P('in_soban_a', 12, 5); P('in_bangseok_g', 11, 5)
    # 손님방 A (북동): 이불장·병풍·이불·소반
    P('in_ibuljang', 17, 2); P('in_byeongpung_s', 19, 2); P('in_ibul_r', 19, 5); P('in_soban_b', 17, 5); P('in_doorway', 16, 6)
    # 손님방 B (동남): 족자 · 장롱 · 푸른 이불 · 화로
    P('in_jokja_b', 17, 8); P('in_mungap', 19, 10); P('in_ibul_b', 19, 11); P('in_hwaro', 17, 12); P('in_doorway', 16, 10)
    r.people += [(13, 9, 0, LEFT, 0), (11, 7, 6, RIGHT, 1)]
    return r


@room
def joseon_in_smith():
    """대장간 12×8: 돌벽 + 흙바닥. 북벽 가운데 화덕(풀무 붙임, 곁에 숯), 모루는 화덕 바로 앞에 붙이고 담금 통 곁, 연장 걸이·작업대·판매 상은 벽 쪽으로. 출구는 남벽 x=5."""
    plan = """
############
#dddddddddd#
#dddddddddd#
#dddddddddd#
#dddddddddd#
#dddddddddd#
#dddddddddd#
#####E######
""".strip('\n')
    r = IR.Room('joseon_in_smith', '조선 대장간 내부(화덕·모루·판매 상)', plan, wall_of={'d': 'dol'})
    P = r.put
    # 북벽: 연장 걸이 둘(서·동 끝), 화덕 + 풀무 + 곁에 숯
    P('in_tool_rack', 1, 1); P('in_tool_rack', 8, 1)
    P('in_hwadeok', 4, 2); P('in_pulmu', 6, 3); P('in_charcoal', 3, 3)
    # 작업: 모루는 화덕에 바짝(앞), 담금 통은 모루 곁 / 작업대·쇳덩이는 동쪽 벽 쪽
    P('in_morus', 4, 4); P('in_tub', 2, 4); P('in_hoechori', 7, 4)
    P('in_workbench', 8, 3); P('in_ingots', 10, 3); P('in_charcoal', 1, 6); P('in_mul_dongi', 2, 6); P('in_hangari_b', 9, 5)
    # 판매 상(문 곁)
    P('in_sang_2', 8, 6); P('in_geolsang', 7, 6)
    r.people += [(7, 5, 6, UP, 1), (3, 5, 0, RIGHT, 0)]
    return r


@room
def joseon_in_pharmacy():
    """약방 12×7: 마루방. 북벽 약장(서)·서가·선반·약초 걸이, 약 짓는 자리(약상·약연·약탕 화로), 동쪽 온돌 진료 자리(상 + 방석 둘). 출구는 남벽 x=6."""
    plan = """
############
#mmmmmmmmmm#
#mmmmmmmmmm#
#mmmmmmmmmm#
#mmmmmmoooo#
#mmmmmmoooo#
#mmmmmmoooo#
######E#####
""".strip('\n')
    r = IR.Room('joseon_in_pharmacy', '조선 약방 내부(약장·약탕 화로·진료 자리)', plan)
    P = r.put
    # 북벽: 약장(서) · 서가 · 선반 · 약초 걸이
    P('in_yakjang', 1, 2); P('in_seoga', 3, 2); P('in_seonban_bottles', 6, 1); P('in_herb_hang', 8, 1)
    # 약 짓는 자리: 약상 + 약연 + 약탕 화로(약상 곁), 약초 자루
    P('in_yak_table', 1, 5); P('in_yakyeon', 3, 5); P('in_yakhwa', 5, 5); P('in_sokuri_grain', 5, 6); P('in_chaekdemi', 6, 4)
    # 진료 자리(동쪽 온돌): 상 + 방석 + 안석
    P('in_sang_2', 8, 5); P('in_bangseok_r', 7, 5); P('in_bangseok_b', 10, 5); P('in_ansuk', 9, 6)
    r.people += [(2, 4, 0, UP, 0)]
    return r


@room
def joseon_in_school():
    """서당 16×12: 창호 벽 마루방. 북쪽에 널마루 단(훈장 자리: 서가·병풍·훈장 상·방석, 앞면 + 양옆 + 가운데 2칸 계단), 앞으로 학동 책상 두 줄(엇갈리게). 출구는 남벽 x=8."""
    plan = """
################
#mmmmmmmmmmmmmm#
#mmmmmmmmmmmmmm#
#mmmmkkkkkkmmmm#
#mmmmkkkkkkmmmm#
#mmmmkkkkkkmmmm#
#mmmmmmmmmmmmmm#
#mmmmmmmmmmmmmm#
#mmmmmmmmmmmmmm#
#mmmmmmmmmmmmmm#
#mmmmmmmmmmmmmm#
########E#######
""".strip('\n')
    r = IR.Room('joseon_in_school', '조선 서당 내부(훈장 단·학동 책상)', plan, wall_of={'m': 'chang', 'k': 'chang'})
    P = r.put
    # 훈장 단(x5..10, y3..5, 앞면 y6): 앞면 l·m·계단 둘·m·r, 양옆 side, 서가·병풍·훈장 상·방석
    P('in_dais_front_l', 5, 6); P('in_dais_front_m', 6, 6); P('in_dais_steps', 7, 6); P('in_dais_steps', 8, 6); P('in_dais_front_m', 9, 6); P('in_dais_front_r', 10, 6)
    for y in (3, 4, 5):
        P('in_dais_side_l', 5, y); P('in_dais_side_r', 10, y)
    P('in_seoga', 6, 2); P('in_byeongpung_s', 8, 2); P('in_hunjang_sang', 7, 4); P('in_bangseok_r', 8, 5)
    # 벽: 족자 둘, 회초리 통(서쪽 벽 밑), 화로, 항아리
    P('in_jokja_a', 1, 1); P('in_jokja_b', 13, 1); P('in_gonjang_rack', 2, 3); P('in_hwaro', 12, 4); P('in_hangari_b', 13, 6); P('in_soban_c', 1, 6)
    # 학동 책상 두 줄: 앞줄(y7) 네 개 · 뒷줄(y9) 네 개를 한 칸씩 엇갈리게 + 앞에 방석
    for i, x in enumerate((3, 6, 12)):
        P('in_hakdong_sang', x, 7); P(('in_bangseok_r', 'in_bangseok_g', 'in_bangseok_b')[i], x, 8)
    for i, x in enumerate((2, 9, 13)):
        P('in_hakdong_sang', x, 9); P(('in_bangseok_b', 'in_bangseok_r', 'in_bangseok_g')[i], x, 10)
    r.people += [(9, 4, 6, FRONT, 1), (6, 8, 0, UP, 1)]
    return r


@room
def joseon_in_office():
    """관아 동헌 17×13: 전돌 바닥 + 북쪽 널마루 원님 단(壇: 병풍·의자·가운데 서안·북·호피·촛대 둘, 가운데 3칸 계단). 서쪽 서가·형틀·곤장 틀·죄인 자리, 동쪽 서리 책상·문서 궤짝, 중앙 붉은 깔개, 기둥 둘. 출구는 남벽 x=8."""
    plan = """
#################
#mmmmkkkkkkkmmmm#
#mmmmkkkkkkkmmmm#
#mmmmkkkkkkkmmmm#
#mmmmkkkkkkkmmmm#
#mmmmkkkkkkkmmmm#
#mmmmkkkkkkkmmmm#
#mmmmmmmmmmmmmmm#
#mmmmmmmmmmmmmmm#
#mmmmmmmmmmmmmmm#
#mmmmmmmmmmmmmmm#
#mmmmmmmmmmmmmmm#
########E########
""".strip('\n')
    r = IR.Room('joseon_in_office', '조선 관아 동헌 내부(원님 단·형틀·서리 책상)', plan, wall_of={'m': 'mok', 'k': 'hoe'})
    P = r.put
    # 단(x5..11, y3..6, 앞면 y7): 앞면 l·m·계단 3·m·r + 양옆
    P('in_dais_front_l', 5, 7); P('in_dais_front_m', 6, 7); P('in_dais_front_m', 10, 7)
    for x in (7, 8, 9):
        P('in_dais_steps', x, 7)
    P('in_dais_front_r', 11, 7)
    for y in (3, 4, 5, 6):
        P('in_dais_side_l', 5, y); P('in_dais_side_r', 11, y)
    # 원님 자리: 일월오봉도 병풍 · 의자 · 가운데 서안 · 북 · 호피 · 촛대 둘
    P('in_byeongpung_royal', 7, 2); P('in_gwan_chair', 8, 4); P('in_seoan', 8, 6)
    P('in_buk', 6, 5); P('in_mat_hopi', 9, 5); P('in_chotdae', 6, 3); P('in_chotdae', 10, 3)
    # 중앙 붉은 깔개(계단에서 문까지), 기둥 둘
    P('in_runner_n', 8, 8)
    for y in range(9, 12):
        P('in_runner_m', 8, y)
    P('in_pillar', 4, 9); P('in_pillar', 12, 9)
    # 서쪽: 서가·족자·형틀·곤장 틀·죄인 자리
    P('in_seoga', 1, 2); P('in_jokja_a', 4, 1); P('in_hyeongtul', 1, 5); P('in_gonjang_rack', 3, 5); P('in_jipjari_2', 1, 9)
    # 동쪽: 문서 궤짝·족자·서리 책상(+방석)·반닫이
    P('in_mungap', 14, 3); P('in_jokja_b', 13, 1); P('in_gwan_desk', 13, 5); P('in_bangseok_b', 14, 6); P('in_bandaji', 14, 9)
    P('in_sokuri_fruit', 1, 11)
    r.people += [(8, 5, 6, FRONT, 1), (13, 8, 0, LEFT, 0)]
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
        import mapgate as MG
        fails, _sum = MG.check_interior(rep)
        print(n, f'{r.W}x{r.H}', 'pixelDiff', diff, 'mapgate-interior', 'PASS' if not fails else 'FAIL ' + '; '.join(fails),
              {k: len(v) for k, v in rep.items() if isinstance(v, list) and v})
        if '-v' in sys.argv:
            for k, v in rep.items():
                if isinstance(v, list) and v:
                    print('  ', k, v[:40])
