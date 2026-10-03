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
    names = args or list(ROOMS)
    out = OUT
    if '--out' in sys.argv:
        out = sys.argv[sys.argv.index('--out') + 1]; names = [a for a in names if a != out]
    sheet, res = build(names, out, png='--png' in sys.argv)
    walk = IC.piece_walk(sheet)
    for n, (r, diff) in res.items():
        rep = IC.analyze(r, sheet, walk)
        print(n, f'{r.W}x{r.H}', 'pixelDiff', diff, {k: len(v) for k, v in rep.items() if isinstance(v, list)})
        if '-v' in sys.argv:
            for k, v in rep.items():
                if isinstance(v, list) and v:
                    print('  ', k, v[:40])
