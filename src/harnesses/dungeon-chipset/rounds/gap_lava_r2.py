"""gap-lava-r2 — 용암 ↔ 동굴 바닥 가장자리, 32×32 위상 몸통(+4장면). 항목 gap.lava_edge × 줄 C(심층굴)·B(산속 바위굴) × 후보 2.

gap-liquid-r1 의 용암(15판)은 엔진 오토타일 몸통이 16px 한 칸이라 웅덩이마다 16px 격자가 남아 굽지 않고 닫혔다.
이제 dot.Autotile(body32=) 가 32×32 몸통을 칸 위치 (x%2)+2*(y%2) 로 네 쪽 나눠 깐다(엔진 phaseVariants {w:2,h:2}).
그래서 몸통 = 32×32 한 장:
  - 녹은 바탕 = 버들항 화산 동굴 용암 강(kit bd-pick-volcano-cave-lava-strip, 시트 27292~ · tiledata/beodeul-variants/volcano-cave/parts/lava-strip.png)
    의 32×32 장면 넷을 그대로 행 문자열로 옮긴 것(OPRN 자체 손 도트, 잠금 팔레트 lava 0~3 단 그대로). 띠 자기 움직임이 녹은 면의 흐름이다.
  - 그 위에 손으로 적은 32×32 **껍질 판 배치**(행 문자열): 'k' 식은 껍질 · 'K' 껍질의 짙은 덩이 · 숫자 0~3 = 빛나는 금(위상).
    3/4 음영은 판 모양에서만 나온다(cave_r1.carve 와 같은 식 — 새 모양을 짓지 않는다): 북쪽이 녹은 면인 판 화소 = 빛 받는 윗턱,
    남쪽이 녹은 면인 판 화소 = 판 앞면(가장 어두운 단), 판 바로 남쪽 녹은 화소 = 판 그늘(용암 0단), 판에 닿은 녹은 화소 = 식은 테(용암 1단 이하).
  - 금 숫자 p 의 장면 k 색 = GLOW[(k - p) % 4] — 금을 따라 숫자가 늘어나므로 빛이 금을 타고 흐른다(통째로 깜빡이지 않는다).
후보:
  <줄>1 「껍질 판이 뜬 녹은 웅덩이」 — 녹은 면 6할, 크기가 다른 판 7~8 장(가장자리를 넘어 감기는 판 둘), 판마다 금 하나.
  <줄>2 「갈라진 껍질 덮개」 — 껍질 7할, 굽이치는 녹은 맥(2~5px)이 그물처럼 이어지고, 껍질 위 가는 금이 맥에서 갈라져 나온다.
가장자리(틀·안 모서리)는 gap-liquid-r1 용암 설계(북 = 빛 받는 턱 + 둑 앞면, 남·서·동 = 현무암 턱 + 검붉은 띠)를 그대로 쓴다.
껍질 색: 줄 C = vrock(푸른 검정 — 줄 C 바위와 같은 램프), 줄 B = wood(갈색 검정 현무암).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dot  # noqa: E402
import cave_r1 as CR  # noqa: E402
import edges_r1 as ER  # noqa: E402
import gap_liquid_r1 as LR  # noqa: E402  용암 가장자리 설계(틀·턱 결)
import gap_rock_r1 as GR  # noqa: E402  고른 바위 채움(줄 B2 · C2) — 장면 벽
from cave_r1 import check_frame, hcat, variants_sheet  # noqa: E402
from dot import Cv, legend  # noqa: E402

WAVE = 'gap'
T = 16
NF = 4


# ================================================================================================ 녹은 면(손) — 검붉은 바탕 위 빛나는 덩이(로브)
# 버들항 용암 강(kit bd-pick-volcano-cave-lava-strip)의 결: 검붉은(용암 1단) 맥이 주황(2단)·노랑(3단) 덩이를 감싸고, 맥 속엔 0단 점.
# 버들항 띠는 32px 로 감기지 않아(관문 S 53.8/20.7) 그대로 쓰지 않고, 손으로 그린 덩이 조각을 32 주기로 **감아** 찍는다(이음 없음).
# 움직임: 덩이마다 제 위상으로 작은 원(2~3px)을 돈다 — 이웃 덩이가 서로 다른 쪽으로 움직여 맥이 열리고 닫히며 끓는다
# (버들항 띠의 「원운동」과 같은 결). 칸 전체가 한 색으로 깜빡이거나 한 방향으로 미끄러지지 않는다.
# 껍질(후보 2)도 같은 덩이 자리에서 같이 돈다 — 굳은 판이 녹은 면 위를 떠 다닌다.
BASE_A = [   # 맥 속 0단 점(a) — 나머지는 1단 바탕
    '..a.......a.............a.......',
    '.....a......a.........a.........',
    '...........a....a...............',
    '.......a........a.......a.......',
    '............a...............a...',
    '..........a......a..............',
    '..a...............a....a........',
    '.....a.........a................',
    '...........a........a...........',
    '.a..........a...a...............',
    '........a.............a......a..',
    '...a...................a........',
    '..........a.......a.............',
    '............a...........a.......',
    '....a...a.........a.............',
    '..a................a............',
    '.......a.........a...........a..',
    '..........a..........a..........',
    '.....a.......a..........a.......',
    '..........a.........a...........',
    '.a......a........a..............',
    '.....a...............a.....a....',
    '........a......a................',
    '......a............a............',
    '.a.........a.....a.....a........',
    '........a..................a....',
    '..........a.........a...........',
    '.a............a...a...........a.',
    '......a...............a.........',
    '..a.............a........a......',
    '........a......a.............a..',
    '............a.........a.........',
]
LOBES = {   # c 주황 · d 노랑 속(덩이마다 모양·크기가 다르다)
    'LA': ['.....ccccc....',
           '..cccccccccc..',
           '.ccccdddcccccc',
           'cccdddddddcccc',
           'cccddddddddccc',
           '.ccccddddddcc.',
           '..cccccdddccc.',
           '..ccccccccccc.',
           '...ccccccccc..',
           '.....ccc......'],
    'LB': ['...cccc....',
           '.ccccccccc.',
           'cccddddcccc',
           'ccddddddccc',
           'cccdddddcc.',
           '.cccccddcc.',
           '..ccccccc..',
           '....cc.....'],
    'LC': ['..ccccc..',
           '.cccdcccc',
           'cccdddccc',
           'ccddddcc.',
           '.ccddccc.',
           '..ccccc..',
           '...cc....'],
    'LD': ['....cccccccc....',
           '.ccccccddddcccc.',
           'cccccddddddddccc',
           'ccccdddddddcccc.',
           '.ccccccddccccc..',
           '..cccccccccc....',
           '.....cccc.......'],
    'LE': ['.cccc..',
           'cccdcc.',
           'ccdddcc',
           '.cccccc',
           '..ccc..'],
    'LF': ['....cccc....',
           '..cccccccc..',
           '.cccdddcccc.',
           'cccddddddccc',
           'ccccdddddcc.',
           'cccccdddccc.',
           '.cccccccccc.',
           '..ccccccc...',
           '....ccc.....'],
}
CRUSTS = {  # 굳은 껍질 판(후보 2): k 바탕 · K 짙은 얼룩 · 숫자 = 빛이 흐르는 금 위상
    'KA': ['...kkkkkk....',
           '.kkkKkkk0kk..',
           'kkkKKkkkk1kkk',
           'kkkkkkkk2kkkk',
           '.kkk3kkkkkKkk',
           '..kk2kkKKkkk.',
           '...kk1kkkkk..',
           '.....kkkk....'],
    'KB': ['..kkkkk..',
           '.kkk0kkk.',
           'kkKkk1kkk',
           'kkkkk2kk.',
           '.kkkkkkk.',
           '...kkk...'],
    # 찢긴 껍질 띠(후보 2 — 3판 「판이 칸마다 눈알처럼 놓인다」 반려): 녹은 덩이 위에 얹히는 1~2px 굳은 막
    'RD': ['..kkkk......',
           'kkkKkkkkkk..',
           '....kkkkkkkk'],
    'RE': ['.....kkkk',
           '..kkkkk..',
           'kkkkk....',
           'kk.......'],
    'RF': ['kkk.......',
           '.kkkkKkk..',
           '.....kkkkk'],
    'RG': ['kk......',
           '.kkk....',
           '...kkk..',
           '....kKkk',
           '......kk'],
    'RH': ['....kk',
           '...kk.',
           '..kkk.',
           '.kk...',
           'kk....',
           'k.....'],
    'RI': ['.......kkk',
           '....kkkk..',
           '.kkkk.....',
           'kk........'],
    'KC': ['.kkkk...',
           'kkKk0kk.',
           'kkkkk1kk',
           '.kk3k2k.',
           '..kkkk..'],
}
# 자리(손): (조각, x, y, 위상). 후보마다 같은 자리 표를 쓰고, 후보 2 는 덩이 몇 개를 껍질 판으로 바꾼다.
PLACE = [('LA', 2, -2, 0), ('LD', 17, 2, 2), ('LE', 0, 7, 1), ('LF', 10, 7, 3), ('LB', 23, 10, 0), ('LC', 3, 14, 2),
         ('LA', 13, 14, 1), ('LE', 27, 20, 3), ('LB', 5, 20, 2), ('LF', 17, 23, 0), ('LC', -2, 26, 3), ('LE', 11, 28, 1)]
# 덩이 중심의 행이 32 안에 고르게 퍼지게(2판 「덩이가 가로 줄로 늘어서 32px 띠」 반려).
SWAP = {1: {0: 'KA', 3: 'KA', 6: 'KA', 8: 'KB', 10: 'KC', 11: 'KC'},   # 후보 1: 굳은 판이 반쯤 덮은 호수(녹은 덩이가 판 사이로 솟음)
        2: {}}                                                            # 후보 2: 녹은 덩이 위주(판 없음, 대신 OVER 의 찢긴 막)
OVER = {2: [('RD', 1, 4, 1), ('RH', 22, 5, 3), ('RF', 11, 11, 0), ('RG', 25, 18, 2), ('RI', 4, 21, 0), ('RE', 16, 26, 3)]}
# 막의 행이 16 주기로 겹치지 않게(4판 「가로 줄무늬 띠」 반려) — 가로·비스듬·가파른 막을 섞고 행을 엇갈렸다.   # 후보 2: 덩이 위를 떠 가는 찢긴 막(덩이와 다른 위상)
SWAY = [(0, 0), (1, -1), (2, 0), (1, 1)]   # 덩이 한 개가 도는 원(장면 k + 위상)


def _torus(g, rows, x, y, keep='.'):
    for dy, r in enumerate(rows):
        for dx, ch in enumerate(r):
            if ch not in keep:
                g[(y + dy) % 32][(x + dx) % 32] = ch


def surface(n, k):
    """장면 k 의 32×32 기호: a b c d 녹은 면 · k K 0~3 껍질."""
    g = [['a' if ch == 'a' else 'b' for ch in r] for r in BASE_A]
    for i, (nm, x, y, ph) in enumerate(PLACE):
        dx, dy = SWAY[(k + ph) % 4]
        cr = SWAP.get(n, {}).get(i)
        _torus(g, CRUSTS[cr] if cr else LOBES[nm], x + dx, y + dy)
    for nm, x, y, ph in OVER.get(n, ()):
        dx, dy = SWAY[(k + ph) % 4]
        _torus(g, CRUSTS[nm], x + dx, y + dy)
    return g


for _d in (LOBES, CRUSTS):
    for _nm, _r in _d.items():
        assert len({len(x) for x in _r}) == 1, _nm
assert len(BASE_A) == 32 and all(len(r) == 32 for r in BASE_A)

# 껍질 색(줄 공통 — 식은 용암 막: 용암 0단 · 보라 검정, 금은 용암 빛). 바위 색 판은 1판에서 「떠 있는 돌」로 읽혀 버렸다.
CRUST_LEG = dict(k=('lava', 0), K=('red', 0), h=('lava', 0))
GLOW = [('lava', 3), ('lava', 2), ('lava', 1), ('lava', 1)]   # 금 위상 p 의 장면 k 색 = GLOW[(k - p) % 4]


def body32(line, n, k):
    """32×32 위상 몸통 장면 k."""
    g = surface(n, k)
    leg = legend(**CRUST_LEG)
    lv = [dot.C('lava', i) for i in range(4)]
    cv = Cv(32, 32)

    def crust(x, y):
        return g[y % 32][x % 32] in 'kK0123'
    for y in range(32):
        for x in range(32):
            ch = g[y][x]
            if ch in 'abcd':
                t = 'abcd'.index(ch)
                if crust(x, y - 1) or crust(x, y + 1) or crust(x - 1, y) or crust(x + 1, y):
                    t = max(t, 2)               # 얇은 판 가장자리는 녹은 면이 비쳐 밝다(판이 돌처럼 그늘을 드리우지 않는다)
                cv.put(x, y, lv[t])
            elif ch in '0123':
                cv.put(x, y, dot.C(*GLOW[(k - int(ch)) % 4]))
            elif not crust(x, y - 1) or not crust(x, y + 1) or not crust(x - 1, y) or not crust(x + 1, y):
                cv.put(x, y, leg['h'])          # 판 둘레 = 달아오른 검붉은 테(두께 없는 막)
            else:
                cv.put(x, y, leg[ch])
    return cv


# ================================================================================================ 가장자리(새 설계 — 1판 「네 변이 같은 두께의 검은 테」 반려)
# 북(먼 둑): 바닥 끝 밝은 턱 Q 한 줄 → 둑 앞면 M·M·L(아래로 어두워짐) → 밑단 g(용암 빛을 받음) → 용암 그늘 S 한 줄.
# 남(가까운 물가): 바닥 바로 앞 검은 턱 K 1~2px + 검붉은 띠 r 한 줄뿐 — 얇다. 서·동: K·V 2~3px + r.
# 굴곡·열쇠 표는 gap-liquid-r1 의 줄 표(LAVA_WOB · LAVA_KEYS)를 쓴다.
EDGE = dict(
    N=(6, {3: 'gQ', 4: 'gLQ', 5: 'gLMQ', 6: 'gLMMQ', 7: 'gLLMMQ'}, {'w': 'S'}),
    S=(2, {1: 'K', 2: 'K', 3: 'VK', 4: 'VK'}, {'w': 'r', 'h': 'r'}),
    W=(3, {2: 'K', 3: 'VK', 4: 'VVK', 5: 'VVK'}, {'w': 'r', 'h': 'r'}),
    NW=[',,,,,,,,',
        ',,,,QQQQ',
        ',,,QMMMM',
        ',,QMMMMM',
        ',,KMLLLL',
        ',KVLgggg',
        ',KVrSSSS',
        ',KVr....'],
    SW=[',KVr....',
        ',KVr....',
        ',KVVr...',
        ',,KVr...',
        ',,KKVr..',
        ',,,KKrrr',
        ',,,,,KKK',
        ',,,,,,,,'],
    INW=[',KVr....',
         'QKVr....',
         'MQKr....',
         'MMKr....',
         'LLKr....',
         'ggrr....',
         'SSS.....',
         '........'],
    ISW=['........',
         '........',
         '........',
         '........',
         '........',
         'rrr.....',
         'KKVr....',
         ',KVr....'],
)
LR.check_design('용암 2판 물가', EDGE)
BANK = {   # 둑 앞면 결(가로 결이 칸 경계에서 끊기지 않게 한 줄 무늬, 세로 빗살 없음)
    'C': {'Q': ('xxxxxxyxxxxxxxxx', 'cata', 6, 'stone', 4), 'M': ('xxxxxxxxxxyxxxxx', 'vrock', 2, 'vrock', 3),
          'L': ('xxxxyxxxxxxxxxxx', 'vrock', 1, 'vrock', 2), 'g': ('xxxxxxxyxxxxxxxx', 'lava', 0, 'lava', 1)},
    'B': {'Q': ('xxxxxxyxxxxxxxxx', 'rim', 4, 'rim', 5), 'M': ('xxxxxxxxxxyxxxxx', 'wood', 2, 'wood', 3),
          'L': ('xxxxyxxxxxxxxxxx', 'wood', 1, 'wood', 2), 'g': ('xxxxxxxyxxxxxxxx', 'lava', 0, 'lava', 1)},
}


def edge_parts(line, fn=1):
    tex = {',': LR.floor_body(line, fn), **LR.glow_tex(), **LR.LIP_TEX[line](),
           'S': LR.rowtex('xxxxyxxxxxxxyxxx', legend(x=('lava', 0), y=('lava', 1)))}
    for ch, (pat, ra, ta, rb, tb) in BANK[line].items():
        tex[ch] = LR.rowtex(pat, legend(x=(ra, ta), y=(rb, tb)))
    fr_rows, inn_rows = LR.bank_frame(EDGE, LR.WOB[line], {s: ('w' * 16 if s == 'N' else v) for s, v in LR.LAVA_KEYS[line].items()})
    check_frame(f'용암 {line} 틀', fr_rows, inn_rows)
    return ER.fill(fr_rows, inn_rows, {}, tex)


def lava(line, n):
    fr, inn = edge_parts(line)
    q = lambda c, qx, qy: c.crop(qx * 8, qy * 8, 8, 8)  # noqa: E731
    edge = {'N': fr.crop(8, 0, 16, 8), 'S': fr.crop(8, 24, 16, 8), 'W': fr.crop(0, 8, 8, 16), 'E': fr.crop(24, 8, 8, 16)}
    outer = {'NW': q(fr, 0, 0), 'NE': q(fr, 3, 0), 'SW': q(fr, 0, 3), 'SE': q(fr, 3, 3)}
    inner = {'NW': q(inn, 0, 0), 'NE': q(inn, 1, 0), 'SW': q(inn, 0, 1), 'SE': q(inn, 1, 1)}
    out = []
    for k in range(NF):
        b32 = body32(line, n, k)
        out.append(dot.Autotile(b32.crop(0, 0, T, T), edge, outer, inner, body32=b32))
    return out


# ================================================================================================장면
# 16×14 화산 굴: 줄 바위(고른 rock_fill <줄>2) 벽 + 앞면 2단, 바닥 가운데 불규칙 용암 웅덩이(곶·만·외딴 혹), 1칸 줄기, 외딴 1칸.
POOL = ['################',
        '################',
        '################',
        '#####.....######',
        '##.............#',
        '#...wwww.......#',
        '#..wwwwwww..ww.#',
        '#..wwwwwwwwwww.#',
        '#...www.wwww...#',
        '#..wwww..www...#',
        '#...ww....w..w.#',
        '#.........w....#',
        '#..............#',
        '################']
ACTOR_AT = (14, 8)


def scene(fs, line, fn=1):
    g = [r.replace('w', '.') for r in POOL]
    assert not dot.structure_errors(g), dot.structure_errors(g)
    base = dot.render_cave(g, GR.rock(line, 2), GR.face(line, 2), CR.part(line, fn, 'floor'))
    out = []
    for f in fs:
        cv = Cv(base.w, base.h)
        cv.a[:] = base.a
        for y, row in enumerate(POOL):
            for x, ch in enumerate(row):
                if ch == 'w':
                    cv.a[y * T:(y + 1) * T, x * T:(x + 1) * T] = f.tile_at(dot.mask_at(POOL, x, y, lambda c, X, Y: c == 'w'), x, y).a
        cv.paste(ER.actor_cv(), *ER.at_cell(*ACTOR_AT))
        out.append(cv)
    return out


def stream_strip(at):
    """1칸 폭 가로 줄기 5칸 + 세로 줄기 4칸(위상 몸통이 칸 자리로 바뀌어도 이어지는지)."""
    cv = Cv(7 * T, 4 * T)
    for i in range(5):
        m = (dot.E if i < 4 else 0) | (dot.W if i > 0 else 0)
        cv.paste(at.tile_at(m, i, 1), i * T, T)
    for j in range(4):
        m = (dot.S if j < 3 else 0) | (dot.N if j > 0 else 0)
        cv.paste(at.tile_at(m, 6, j), 6 * T, j * T)
    return cv


def cand(line, n):
    def fn():
        fs = lava(line, n)
        anim = scene(fs, line)
        return ER.a2_frames(fs), {
            'kind': 'autotile', 'autotiles': {'lava': fs[0]}, 'frames': {'lava': fs}, 'liquid': ['lava', 'red', 'fire'],
            'vignette': anim[0], 'anim': anim, 'note': NOTES[f'{line}{n}'],
            'extras': [('32×32 위상 몸통 4장면', hcat(*[f.body32 for f in fs]), 4),
                       ('넓은 웅덩이 몸통 8×6(장면 1)', dot.mosaic(fs[0], 8, 6), 2),
                       ('1칸 줄기: 가로 5칸 · 세로 4칸', stream_strip(fs[0]), 3),
                       ('47 변형(장면 1, 위상 0)', variants_sheet(fs[0]), 2)]}
    return fn


NOTES = {
    'C1': '껍질 판이 뜬 녹은 웅덩이 — 버들항 용암 강 32×32(장면 넷 그대로)에 푸른 검정 화산암 판 7장(윗턱 빛 · 앞면 · 그늘), 판마다 빛이 흐르는 금. 가장자리 = gap-liquid-r1 C 용암 턱',
    'C2': '갈라진 껍질 덮개 — 푸른 검정 껍질 7할, 비스듬한 큰 맥·굽이치는 가로 맥·녹은 눈 둘(버들항 용암 강 바탕이 흐름), 맥에서 갈라진 빛 흐르는 금',
    'B1': '껍질 판이 뜬 녹은 웅덩이 — 갈색 검정 현무암 판(줄 B). 가장자리 = gap-liquid-r1 B 용암 턱',
    'B2': '갈라진 껍질 덮개 — 갈색 검정 현무암 껍질(줄 B)',
}

CANDIDATES = {'gap.lava_edge': {f'{ln}{n}': cand(ln, n) for ln in 'CB' for n in (1, 2)}}
