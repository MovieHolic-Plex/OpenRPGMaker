"""조선 궁 내부 방 맵 4장 — python3 demo_palace_in.py [방id ...] [--out DIR] [--png] [-v]

demo_interior.py 와 같은 방식(평면 → interior_room.Room(kit='pal') 이 단청 천장·벽면·바닥 그늘을 유도, put 으로 기물, interior_checks 가 점검)이다.
시트는 공용 실내 키트 + 궁 키트(pal_)를 한 장으로 쌓은 PalaceSheet 하나 — 공용 실내 시트(demo_interior)의 칸 번호는 건드리지 않는다.
산출: tiledata/joseon-interior/<방id>/ {map.json, pieces.json, <id>-chipset.png, extra.json, PNG 3종}. 형식은 harness/EXTRA_FORMAT.md.
방 계획(용도·앵커·동선·문)은 tiledata/joseon-interior/PLAN.md 의 「궁 내부」 절.
"""
import json, os, sys
os.environ.setdefault('JS_PROFILE', 'interior')      # mapgate 의 실내 합격선(check_interior)
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, 'harness'))
import interior_room as IR
import interior_checks as IC
import people as PP
import palace

UP, RIGHT, FRONT, LEFT = PP.UP, PP.RIGHT, PP.FRONT, PP.LEFT
OUT = os.path.join(IR.ROOT, 'tiledata', 'joseon-interior')
ROOMS = {}


def room(fn):
    ROOMS[fn.__name__] = fn
    return fn


def PalaceSheet():
    terr = dict(IR.all_terrain()); terr.update(palace.terrain())
    objs = dict(IR.all_objects()); objs.update(palace.objects())
    return IR.Sheet(terr=terr, objs=objs)


class G:
    """평면 격자 도우미: rect 로 문자를 채우고 plan() 으로 문자열을 낸다."""

    def __init__(self, W, H, fill='#'):
        self.W, self.H = W, H
        self.g = [[fill] * W for _ in range(H)]

    def rect(self, x0, y0, x1, y1, ch):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.g[y][x] = ch
        return self

    def plan(self):
        return '\n'.join(''.join(r) for r in self.g)


@room
def joseon_in_throne():
    """정전 어좌전 24×22(+마당 2): 북쪽 넓은 아래 단과 가운데 위 어좌 단(월대) 위 어좌·일월오봉도 병풍, 카펫이 큰 계단을 타고 문까지, 붉은 기둥 두 줄과 도열(좌 문관 서안 · 우 무관 창 거치대). 출구는 남벽 x=10~13(4칸)."""
    g = G(24, 22)
    g.rect(1, 1, 22, 20, 'p')                      # 전돌 바닥(y1·y2 는 벽면 줄)
    g.rect(1, 3, 22, 10, 'w')                      # 아래 월대 윗면(y3~y10, y7 은 위 단 앞면 줄이 겹침)
    g.rect(6, 1, 17, 6, 'w')                       # 위 어좌 단(y1·y2 벽면 = 회벽, y3~y6 윗면)
    g.rect(10, 3, 13, 6, 'c'); g.rect(10, 8, 13, 10, 'c'); g.rect(10, 12, 13, 20, 'c')       # 카펫 띠(계단 칸은 기물이 덮는다)
    g.rect(10, 21, 13, 21, 'E')
    r = IR.Room('joseon_in_throne', '조선 궁 정전 어좌전(월대·어좌·카펫·붉은 기둥)', g.plan(), kit='pal')
    P = r.put
    # 월대 앞면: 위 단(y7), 아래 단(y11) — 가운데는 큰 계단
    P('pal_dais_front_l', 6, 7)
    for x in (7, 8, 9): P('pal_dais_front_m', x, 7)
    P('pal_dais_steps_4', 10, 7)
    for x in (14, 15, 16): P('pal_dais_front_m', x, 7)
    P('pal_dais_front_r', 17, 7)
    P('pal_dais_front_l', 1, 11)
    for x in range(2, 9): P('pal_dais_front_m', x, 11)
    P('pal_dais_steps_6', 9, 11)
    for x in range(15, 22): P('pal_dais_front_m', x, 11)
    P('pal_dais_front_r', 22, 11)
    # 어좌 단: 병풍 · 어좌 · 향로 한 쌍 · 큰 촛대 한 쌍
    P('pal_byeongpung_ilwol', 9, 1); P('pal_throne', 11, 4)
    P('pal_hyangro', 9, 5); P('pal_hyangro', 14, 5)
    P('pal_chotdae_tall', 7, 5); P('pal_chotdae_tall', 16, 5)
    # 아래 단 양끝: 종(서) · 큰 북(동), 호위 창 거치대, 계단 곁 등롱
    P('pal_jong', 2, 9); P('pal_buk_big', 20, 9)
    P('pal_changgeori', 2, 4); P('pal_changgeori', 20, 4)
    P('pal_deungrong', 7, 9); P('pal_deungrong', 16, 9)
    P('pal_chaekgap', 4, 6); P('pal_munseo_ham', 19, 6)
    # 붉은 기둥 두 줄(서 x=3 · 동 x=20)
    for yb in (14, 19):
        P('pal_pillar', 3, yb - 2); P('pal_pillar', 20, yb - 2)
    # 도열: 좌(문관) 서안 · 방석 / 우(무관) 방석 · 창 거치대
    P('pal_gwan_seat', 1, 13); P('pal_seoan_gwan', 1, 16); P('pal_munseo_ham', 1, 19)
    P('pal_bangseok_red', 5, 14); P('pal_bangseok_blue', 7, 16); P('pal_bangseok_red', 5, 18)
    P('pal_bangseok_blue', 18, 14); P('pal_bangseok_red', 16, 16); P('pal_bangseok_blue', 18, 18)
    P('pal_changgeori', 21, 13); P('pal_changgeori', 21, 17); P('pal_hyangro', 22, 19)
    # 문 곁: 등롱 한 쌍 · 궁녀 자리
    P('pal_deungrong', 8, 19); P('pal_deungrong', 15, 19)
    P('pal_gungnyeo_jari', 8, 12); P('pal_gungnyeo_jari', 15, 12)
    r.people += [(11, 6, 6, FRONT, 1), (8, 8, 1, FRONT, 0), (15, 8, 1, FRONT, 2),
                 (5, 14, 6, RIGHT, 1), (7, 16, 6, RIGHT, 0), (5, 18, 6, RIGHT, 2),            # 좌 문관 셋(방석 곁)
                 (18, 14, 0, LEFT, 1), (16, 16, 0, LEFT, 0), (18, 18, 0, LEFT, 2)]           # 우 무관 셋
    return r


@room
def joseon_in_corridor():
    """회랑·행각 연결 34×8(+마당 2): 북쪽 창호 벽 앞에 붉은 기둥과 등롱이 번갈아 서고, 가운데 두 줄 카펫 띠가 길을 이루며, 남쪽 줄에 서안·궁녀 자리·문서함이 듬성듬성. 북벽에 문 둘(분합문), 출구 셋: 침전 x=4~5 · 어좌전 x=15~18 · 서고 x=29~30."""
    g = G(34, 8)
    g.rect(1, 1, 32, 6, 'q')
    g.rect(1, 4, 32, 5, 'c')
    for x in (4, 5, 15, 16, 17, 18, 29, 30):
        g.g[7][x] = 'E'
    r = IR.Room('joseon_in_corridor', '조선 궁 회랑·행각(기둥·등롱·카펫 길)', g.plan(), kit='pal')
    P = r.put
    for (x0, x1) in ((8, 9), (24, 25)):               # 북벽 문 둘(붉은 문짝)
        r.wall_override[(x0, 1)] = 'hoe'; r.wall_override[(x1, 1)] = 'hoe'
        r.feat[(x0, 1)] = 'doorl'; r.feat[(x1, 1)] = 'doorr'
    # 북쪽 줄: 붉은 기둥 여덟(문 곁 둘씩) · 등롱 다섯 · 매단 등 넷
    for x in (3, 7, 10, 14, 19, 23, 26, 30):
        P('pal_pillar', x, 1)
    for x in (5, 12, 16, 21, 28):
        P('pal_deungrong', x, 2)
    for x in (6, 13, 20, 27):
        P('pal_deung_hang', x, 3)
    # 남쪽 줄: 서안·궁녀 자리·문서함·책갑·향로(양끝)
    P('pal_munseo_ham', 2, 6); P('pal_gungnyeo_jari', 8, 6); P('pal_seoan_gwan', 11, 6); P('pal_gungnyeo_jari', 22, 6)
    P('pal_gwan_seat', 24, 6); P('pal_chaekgap', 31, 6); P('pal_hyangro', 1, 5); P('pal_hyangro', 32, 5)
    r.people += [(12, 4, 1, RIGHT, 1), (21, 5, 6, LEFT, 0), (27, 4, 0, FRONT, 1)]
    return r


@room
def joseon_in_bedchamber():
    """침전 16×12(+마당 2): 임금의 침실. 북벽 병풍 앞에 금침 침상(촛대 한 쌍), 서쪽 벽 장롱, 동쪽 화장대·경대, 앞쪽 궁 마루에 수라상·방석·약탕. 침실은 황장판, 앞쪽은 마루. 출구는 남벽 x=7~8."""
    g = G(16, 12)
    g.rect(1, 1, 14, 7, 'o')
    g.rect(1, 8, 14, 10, 'q')
    g.rect(7, 11, 8, 11, 'E')
    r = IR.Room('joseon_in_bedchamber', '조선 궁 침전(금침·장롱·화장대·수라상)', g.plan(), kit='pal')
    P = r.put
    # 침실: 병풍 · 침상 · 촛대 한 쌍 · 장롱 · 화장대 · 경대
    P('in_byeongpung_c', 6, 2); P('pal_chimsang', 6, 4)
    P('pal_chotdae_tall', 4, 4); P('pal_chotdae_tall', 10, 4)
    P('pal_jangnong', 1, 1); P('pal_hwajangdae', 12, 2); P('pal_gyeongdae', 11, 6)
    P('pal_hyangro', 3, 6); P('pal_bangseok_red', 5, 7); P('pal_bangseok_blue', 9, 7)
    P('in_ibul_folded', 13, 5)
    # 앞쪽 마루: 수라상 · 방석 둘 · 약탕 · 궁녀 자리 · 낮은 병풍
    P('pal_surasang', 10, 9); P('pal_bangseok_red', 9, 9); P('pal_bangseok_blue', 12, 9)
    P('pal_yaktang', 13, 8); P('pal_gungnyeo_jari', 3, 8); P('in_byeongpung_s', 1, 9)
    P('pal_deungrong', 4, 9); P('in_hwaro', 6, 8); P('pal_chaekgap', 12, 10)
    r.people += [(12, 7, 1, LEFT, 1), (8, 6, 6, UP, 1)]
    return r


@room
def joseon_in_library():
    """서고·집무 20×10(+마당 2): 북벽 따라 서가·족자·책갑·문서함, 가운데 붉은 카펫 위 서안과 교의(집무 자리), 동쪽 구석에 약탕·궁녀 자리, 서쪽에 읽는 자리와 호위 거치대. 출구는 남벽 x=9~10."""
    g = G(20, 10)
    g.rect(1, 1, 18, 8, 'q')
    g.rect(7, 4, 12, 6, 'c')
    g.rect(9, 9, 10, 9, 'E')
    r = IR.Room('joseon_in_library', '조선 궁 서고·집무(서가·서안·약탕)', g.plan(), kit='pal')
    P = r.put
    # 북벽: 서가 넷(사이에 족자·문서함·책갑)
    P('pal_seoga_tall', 1, 1); P('pal_seoga_tall', 6, 1); P('pal_seoga_tall', 12, 1); P('pal_seoga_tall', 17, 1)
    P('in_jokja_a', 4, 1); P('in_jokja_b', 9, 1); P('in_jokja_a', 15, 1)
    P('pal_munseo_ham', 3, 3); P('pal_munseo_ham', 15, 3)
    # 집무: 교의 · 서안 · 방석 · 책갑·궤
    P('pal_uija', 9, 3); P('pal_seoan_gwan', 9, 5); P('pal_bangseok_blue', 9, 6)
    P('pal_chaekgap', 7, 5); P('pal_chaekgap', 12, 6)
    # 서쪽: 읽는 자리 · 호위 창 거치대 · 화로
    P('pal_gwan_seat', 2, 5); P('pal_changgeori', 2, 7); P('in_hwaro', 6, 8)
    # 동쪽: 약탕 · 궁녀 자리 · 낮은 병풍
    P('pal_yaktang', 17, 5); P('pal_gungnyeo_jari', 16, 5); P('in_byeongpung_s', 16, 7); P('pal_munseo_ham', 13, 8); P('pal_chaekgap', 6, 7)
    r.people += [(10, 4, 6, FRONT, 1), (14, 6, 1, LEFT, 0)]
    return r


def build(names, outdir, png=False):
    sheet = PalaceSheet()
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
    import mapgate as MG
    for n, (r, diff) in res.items():
        rep = IC.analyze(r, sheet, walk)
        fails, _sum = MG.check_interior(rep)
        print(n, f'{r.W}x{r.H}', 'pixelDiff', diff, 'mapgate-interior', 'PASS' if not fails else 'FAIL ' + '; '.join(fails),
              {k: len(v) for k, v in rep.items() if isinstance(v, list) and v})
        if '-v' in sys.argv:
            for k, v in rep.items():
                if isinstance(v, list) and v:
                    print('  ', k, v[:40])
