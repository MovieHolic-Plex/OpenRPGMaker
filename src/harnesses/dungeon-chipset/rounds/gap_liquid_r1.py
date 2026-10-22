"""gap-liquid-r1 — 물·용암 ↔ 동굴 바닥 둥근 가장자리 오토타일(+4장면). 항목 2 × 줄 × 후보 2.

조수 던전 시험(~/claude-viz/assistant-dungeons-1/dg-r3-dg-lava-cave-0 · flooded-temple-0)에서 나온 문제를 고친다:
  - 용암 웅덩이가 칸마다 계단처럼 꺾인 네모 도장으로 보이고, 1칸 용암 줄기는 바닥과 끊긴 주황 막대처럼 보였다.
  - 물에 잠긴 방의 물이 네모 수조로 읽혔다.
바닥은 gap-rock-r1 과 같은 cave-r1 <줄><번호> 바닥(칸 자리 결 그대로)이라 한 지도에 이음 없이 섞인다.

3/4 비대칭 물가(1차 검수 반영):
  - 북(먼 둑): 바닥 윗면 끝의 밝은 턱 밑으로 둑 **앞면이 2~4줄** 떨어지고, 그 밑 물에 그늘. 앞면 높이는 굴곡 따라 오르내린다.
  - 남(가까운 물가): 젖은 바닥 1px 턱만 — 물이 바로 닿는다. 서·동: 젖은 띠 1~3px(중간).
  - 굴곡은 변마다 다른 손 표(-2~+3px, 2px 넘게 머무는 단), 열마다 층도 바뀐다(물금 끊김·빛 띠 끊김·껍질 혀).
  - 바깥 모서리는 사분면 8px 전체를 쓰는 큰 호, 안 모서리는 넓은 필렛(둑 앞면이 비스듬히 줄어들며 돈다).
  - 용암: 그을린 바닥(두 단) → 식은 화산암 껍질(두께가 열마다 다름, 혀처럼 용암으로 튀어나옴) → **끊긴** 빛 띠
    (뜨거운 곳만 노랑, 나머지 주황, 식은 곳은 껍질이 바로 닿음) → 몸통.
  - 몸통: 손으로 적은 16×16 결을 장면마다 통째로 밀어(물결 4px · 느린 용암 4px · 빠른 용암 8px) 1배·3fps 에서 흐름이 읽히고,
    가운데 고정 그림이 다른 변형 셋(엔진 interiorVariants)으로 16px 반복을 깬다.

후보 1·2 는 다른 물건이다(색만 바꾼 것 아님):
  물 <줄>1 「맑은 얕은 웅덩이」 — 물 1단 바탕에 잠긴 바닥 돌, 촘촘한 물결 획, 가는 밝은 물금. 둑 앞면 2~3줄.
  물 <줄>2 「깊고 어두운 웅덩이」 — 물 0단(B 는 1단) 바탕, 물가 얕은 턱 띠(밝음→어두움), 둑 앞면 3~4줄 + 진한 그늘.
  용암 <줄>1 「껍질 낀 느린 흐름」 — 붉은 용암에 크기 다른 검은 껍질 판이 떠 흐름, 두꺼운 껍질 테두리, 숨 쉬는 분출구.
  용암 <줄>2 「밝고 빠른 강」 — 붉은 바탕에 주황 대리석 결, 노랑은 굽이치는 흐름 줄에만, 얇은 껍질 턱.
모든 화소는 이 파일의 행 문자열에서 오거나, cave-r1 바닥·style-r1 결을 자리만 옮기고 램프 단만 내린 것이다.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dot  # noqa: E402
import cave_r1 as CR  # noqa: E402  줄 바닥(gap-rock-r1 과 같은 바닥)·장면 렌더
import edges_r1 as ER  # noqa: E402  틀 채우기·A2 시트·Actor1 자리
import style_r1 as SR  # noqa: E402
from cave_r1 import autotile_cv, check_frame, frame, hcat, mirror_h, shift, variants_sheet  # noqa: E402
from dot import Cv, grid, legend, stamp  # noqa: E402

WAVE = 'gap'
T = 16
NF = 4


# ================================================================================================ 도구
def soak(cv, table):
    """손 도트 cv 의 화소를 램프 단 표대로 내린다(젖은 흙·그을린 바닥). table = {램프: [단 0→, 단 1→, …]}. 새 모양을 짓지 않는다."""
    out = Cv(cv.w, cv.h)
    out.a[:] = cv.a
    for y in range(cv.h):
        for x in range(cv.w):
            if not cv.a[y, x, 3]:
                continue
            c = tuple(int(v) for v in cv.a[y, x, :3])
            for r, tb in table.items():
                t = ER.ramp_of(c, r)
                if t is not None:
                    out.a[y, x, :3] = dot.RAMPS[r][tb[t]]
                    break
    return out


WET = {'cfloor': [0, 0, 1, 1, 1, 2, 3, 4], 'stone': [0, 0, 1, 2, 2, 3], 'cata': [0, 0, 1, 1, 2, 3, 4],
       'crock': [0, 1, 1, 2, 3, 4, 5]}
WET2 = {'cfloor': [0, 0, 0, 0, 0, 1, 1, 2], 'stone': [0, 0, 0, 1, 1, 2], 'cata': [0, 0, 0, 0, 1, 1, 2],
        'crock': [0, 1, 1, 1, 2, 3, 4]}
# B 줄 바닥은 이미 짙은 흙(cfloor 1)이라 한 단 내리면 0단 — 마른 쪽 띠는 돌 알갱이만 내린다.
WET_B = {'cfloor': [0, 0, 1, 2, 3, 4, 5, 6], 'stone': [0, 0, 1, 1, 2, 3]}
WET2_B = {'cfloor': [0, 0, 0, 1, 1, 2, 3, 4], 'stone': [0, 0, 0, 1, 1, 2]}


def floor_body(line, n):
    return CR.part(line, n, 'floor').body


def floor_tex(line, n):
    fl = floor_body(line, n)
    wet, wet2 = (WET_B, WET2_B) if line == 'B' else (WET, WET2)
    return {',': fl, 'm': soak(fl, wet), 'n': soak(fl, wet2)}


def rowtex(pattern, leg):
    """층 결 — 손으로 적은 16글자 한 줄을 모든 행에 깐다. 둑 앞면·껍질 앞면은 굴곡 따라 행이 오르내리므로
    한 층(글자)은 행과 상관없이 같은 가로 결을 가져야 층이 끊기지 않는다."""
    assert len(pattern) == 16
    return grid([pattern] * 16, leg, 16, 16)


def tr(rows, table):
    return [''.join(table.get(c, c) for c in r) for r in rows]


# ------------------------------------------------------------------------------------------------ 변 띠
# 변(side) 설계 = (p0, land{깊이: 층}, water{열쇠: 층}). 깊이 = 바깥 끝에서 물이 시작하는 화소 수(굴곡 표가 정함).
# land 층은 물가에서 바깥쪽으로(첫 글자가 물에 닿음), 그 뒤는 ','(마른 바닥). water 층은 물가에서 안쪽으로, 그 뒤는 '.'(몸통).
# 열쇠 = 열마다 다른 물가 층(물금이 끊긴 곳·빛 띠가 뜨거운 곳·껍질 혀). 사분면 경계(0·7·8·15)는 기본 'w' — 모서리와 맞물린다.
def land_at(land, d):
    ks = sorted(land)
    k = max([x for x in ks if x <= d] or [ks[0]])
    return land[k]


def side_strips(side, wob, keys):
    p0, land, water = side
    assert len(wob) == 16 and all(wob[i] == 0 for i in (0, 7, 8, 15)), wob
    assert len(keys) == 16 and all(keys[i] == 'w' for i in (0, 7, 8, 15)), keys
    out = []
    for dv, kc in zip(wob, keys):
        d = max(1, p0 + dv)
        ld, wt = land_at(land, d), water[kc]
        s = ''
        for i in range(8):
            if i < d:
                j = d - 1 - i
                s += ld[j] if j < len(ld) else ','
            else:
                j = i - d
                s += wt[j] if j < len(wt) else '.'
        out.append(s)
    return out


def default_strip(side):
    return side_strips(side, [0] * 16, 'w' * 16)[0]


def bank_frame(d, wob, keys):
    """설계 d(변 셋·모서리 넷) + 줄 굴곡·열쇠 → 32×32 기호 틀, 16×16 안 모서리. 동쪽은 서쪽 설계를 굴곡·열쇠만 바꿔 쓴다."""
    n = side_strips(d['N'], wob['N'], keys['N'])
    s = side_strips(d['S'], wob['S'], keys['S'])
    w = side_strips(d['W'], wob['W'], keys['W'])
    e = side_strips(d['W'], wob['E'], keys['E'])
    fr = frame(d['NW'], mirror_h(d['NW']), d['SW'], mirror_h(d['SW']), n, s, w, e)
    inn = [d['INW'][y] + d['INW'][y][::-1] for y in range(8)] + [d['ISW'][y] + d['ISW'][y][::-1] for y in range(8)]
    return fr, inn


def check_design(name, d):
    """모서리 넷이 변 기본 띠와 맞물리는지(굴곡 0 · 열쇠 'w' 로 틀을 지어 사분면 경계 검사)."""
    f, i = bank_frame(d, {k: [0] * 16 for k in 'NSWE'}, {k: 'w' * 16 for k in 'NSWE'})
    check_frame(name, f, i)


def make_body(base, statics, layer, leg, k, sprites, step, flick=None):
    """몸통 장면 k: 바탕 + 가운데 고정 그림(변형마다 다름, 둘레 2px 밖; 장면 그림 넷이면 제자리에서 숨 쉼)
    + 결 층 layer(16×16, '.' 투명)를 (dx·k, dy·k) 감아 민 것. 결 층은 모든 변형이 같아 칸 경계에서 이어진다."""
    cv = grid(base, leg, 16, 16)
    for nm, x, y, ph in statics:
        rows = sprites[nm]
        if isinstance(rows[0], list):
            rows = rows[(k + ph) % NF]
        assert 2 <= x and x + len(rows[0]) <= 14 and 2 <= y and y + len(rows) <= 14, f'고정 그림 {nm} ({x},{y}) 이 둘레 2px 에 닿는다'
        stamp(cv, rows, leg, x, y)
    dx, dy = step
    for y, r in enumerate(layer):
        for x, ch in enumerate(r):
            if ch != '.':
                cv.put((x + dx * k) % 16, (y + dy * k) % 16, leg[ch])
    return cv


# ================================================================================================ 줄 재료
LIQ = {'A': 'water', 'B': 'pool', 'C': 'water'}


def water_leg(line):
    """q 가장 짙은 그늘 · a 깊은 바탕 · b 얕은 바탕 · c 물결 마루·잠긴 돌 · d 물금·반짝임.
    B 줄 고인 물(pool)은 0단이 거의 검어 구덩이로 읽혀서 한 단 올려 쓴다(q 만 0단)."""
    if line == 'B':
        return legend(q=('pool', 0), a=('pool', 1), b=('pool', 2), c=('pool', 4), d=('pool', 5))
    return legend(q=('water', 0), a=('water', 0), b=('water', 1), c=('water', 2), d=('water', 3))


LIP = {'A': ('cfloor', 5), 'B': ('stone', 3), 'C': ('cata', 5)}     # 둑 위 턱 빛

# 둑 앞면 층(물 쪽 → 위): J 물에 닿은 젖은 밑단 · H 가운데 · F 위 · (그 위 T 턱 빛). x = 바탕 단, y = 섞인 단(돌 알갱이·금).
BANK = {
    'A': {'F': ('cfloor', 3, 4, 'xxyxxxxyxxxyxxxx'), 'H': ('cfloor', 1, 2, 'xxxyxxyxxxxxyxxx'), 'J': ('cfloor', 0, 1, 'xyxxxxxxyxxxxxyx')},
    'B': {'F': ('stone', 2, 3, 'xyyxxxyxxxyyxxxx'), 'H': ('stone', 1, 2, 'xxxyxxxxyxxxxyxx'), 'J': ('stone', 0, 1, 'xxyxxxxyxxxxyxxx')},
    'C': {'F': ('cata', 3, 4, 'xxxxyyxxxxxxyyxx'), 'H': ('cata', 1, 2, 'xxyxxxxxxyxxxxxx'), 'J': ('cata', 0, 1, 'xxxxxyxxxxxxxxyx')},
}


def bank_tex(line):
    return {ch: rowtex(pat, legend(x=(r, t0), y=(r, t1))) for ch, (r, t0, t1, pat) in BANK[line].items()}


# 줄 굴곡 표(변마다 손으로, 사분면 경계 0). 북은 -2~+2(앞면 높이가 바뀜), 남은 -1~+2, 서·동은 -2~+3.
WOB = {
    'A': {'N': [0, 1, 1, 2, 2, 2, 1, 0, 0, 0, -1, -1, -2, -1, 0, 0], 'S': [0, 0, 1, 2, 2, 1, 1, 0, 0, -1, -1, 0, 0, 1, 0, 0],
          'W': [0, 1, 2, 3, 3, 2, 1, 0, 0, 0, -1, -1, -1, 0, 0, 0], 'E': [0, -1, -1, 0, 1, 2, 1, 0, 0, 1, 2, 2, 3, 2, 1, 0]},
    'B': {'N': [0, 0, -1, -2, -2, -1, 0, 0, 0, 1, 2, 2, 2, 1, 1, 0], 'S': [0, 1, 1, 0, 0, -1, 0, 0, 0, 1, 2, 2, 1, 1, 0, 0],
          'W': [0, 0, 1, 1, 2, 3, 2, 0, 0, -1, -2, -1, 0, 1, 0, 0], 'E': [0, 1, 2, 2, 1, 0, 0, 0, 0, 0, 1, 2, 3, 3, 1, 0]},
    'C': {'N': [0, 1, 2, 2, 1, 0, -1, 0, 0, -1, -2, -2, -1, 1, 1, 0], 'S': [0, 0, 1, 1, 2, 2, 1, 0, 0, 0, 0, -1, -1, 0, 1, 0],
          'W': [0, -1, -2, -1, 0, 1, 1, 0, 0, 1, 2, 3, 3, 2, 1, 0], 'E': [0, 1, 1, 2, 3, 2, 1, 0, 0, -1, -1, 0, 1, 1, 0, 0]},
}
# 열쇠 표 — w 기본 · h 뜨거움/밝음(물금 두껍게·노란 빛) · c 식음/끊김(물금 없음·껍질 혀).
KEYS = {
    'A': {'N': 'wwhhwwcwwhhhwcww', 'S': 'wcwwhhwwwwccwhww', 'W': 'wwhhhwcwwcwwhhww', 'E': 'whhwwccwwwhhwwww'},
    'B': {'N': 'wcwhhhwwwwwcchww', 'S': 'whhwwwcwwhwwccww', 'W': 'wwccwhhwwhhhwcww', 'E': 'wwhwwcwwwccwhhhw'},
    'C': {'N': 'whhwcwwwwwchhwww', 'S': 'wwcchwwwwhhwwcww', 'W': 'wchhwwwwwwhhccww', 'E': 'wwhhcwwwwhwwcchw'},
}
# 용암 1칸 줄기는 북·남 띠가 한 칸에 겹친다 — 북·남 굴곡을 ±1 로 줄여 줄기가 구슬 꿴 사슬처럼 조이지 않게.
LAVA_WOB = {ln: {k: ([max(-1, min(v, 1)) for v in vs] if k in 'NS' else vs) for k, vs in w.items()} for ln, w in WOB.items()}
for _ln in 'ABC':
    for _s in 'NSWE':
        assert len(KEYS[_ln][_s]) == 16 and len(WOB[_ln][_s]) == 16, (_ln, _s)


# ================================================================================================ 물 설계
# 기호: ',' 마른 바닥 · 'm' 젖은 바닥 · 'n' 더 젖은 바닥(물에 닿음) · 'T' 둑 위 턱 빛 · 'F' 'H' 'J' 둑 앞면 층 · 'q'~'d' 물 · '.' 몸통.
WATER_DESIGN = {
    1: dict(   # 맑은 얕은 웅덩이 — 둑 앞면 2~3줄, 물 그늘 a 한 줄, 남·서·동은 젖은 턱 + 가는 물금 d
        N=(4, {2: 'JT', 3: 'JHT', 5: 'JHFT', 7: 'JJHFT'}, {'w': 'a', 'h': 'a', 'c': 'a'}),
        S=(2, {1: 'n', 3: 'nm', 5: 'nmm'}, {'w': 'd', 'h': 'dc', 'c': ''}),
        W=(2, {1: 'n', 3: 'nm', 5: 'nmm'}, {'w': 'd', 'h': 'dc', 'c': ''}),
        NW=[',,,,,,,,',
            ',,,,,TTT',
            ',,,TTHHH',
            ',,THHJJJ',
            ',,THJaaa',
            ',nTJa...',
            ',nJa....',
            ',nd.....'],
        SW=[',nd.....',
            ',nd.....',
            ',nnd....',
            ',,nd....',
            ',,nnd...',
            ',,,nnddd',
            ',,,,,nnn',
            ',,,,,,,,'],
        INW=[',nd.....',
             'Tnnd....',
             'HTnd....',
             'JHTnd...',
             'aJHTd...',
             '.aJJa...',
             '..aa....',
             '........'],
        ISW=['........',
             '........',
             '........',
             '........',
             '..d.....',
             'ddnd....',
             'nnnd....',
             ',nd.....'],
    ),
    2: dict(   # 깊고 어두운 웅덩이 — 둑 앞면 3~4줄 + 진한 그늘 q, 물가 얕은 턱 띠 d→c→b 뒤 깊은 바탕 a
        N=(5, {2: 'JT', 3: 'JHT', 5: 'JJHT', 6: 'JJHFT', 8: 'JJJHFT'}, {'w': 'q', 'h': 'qq', 'c': 'q'}),
        S=(2, {1: 'n', 3: 'nm', 5: 'nmm'}, {'w': 'dc', 'h': 'dcb', 'c': 'c'}),
        W=(3, {1: 'n', 3: 'nm', 5: 'nmm'}, {'w': 'dcb', 'h': 'dcbb', 'c': 'cb'}),
        NW=[',,,,,,,,',
            ',,,,,TTT',
            ',,,TTHHH',
            ',,THHJJJ',
            ',mTHJJJJ',
            ',mTJJqqq',
            ',mnJqb..',
            ',mndcb..'],
        SW=[',mndcb..',
            ',mndcb..',
            ',mnndcb.',
            ',,mnndc.',
            ',,,mnndc',
            ',,,,mnnd',
            ',,,,,,nn',
            ',,,,,,,,'],
        INW=[',mndcb..',
             'Tmndcb..',
             'HTnndcb.',
             'JHTTdcb.',
             'JJHJqcb.',
             'qJJqqbb.',
             '.qq.....',
             '........'],
        ISW=['........',
             '........',
             '........',
             '........',
             'cbb.....',
             'ddcb....',
             'nnndcb..',
             ',mndcb..'],
    ),
}
for _n, _d in WATER_DESIGN.items():
    check_design(f'물 {_n}', _d)

# 몸통 결 층(장면마다 4px 오른쪽으로 감아 흐름). <줄>1: 바탕 b 에 마루 c · 골 a 획, 드문 반짝임 d. <줄>2: 바탕 a 에 길고 성긴 b 너울, 드문 c.
RIPPLE = {
    1: ['.ccc.......aaa..',
        '......aaaa......',
        'cc.........cccc.',
        '....aaa.........',
        '.........aa..d..',
        'aaa.........aaa.',
        '.....cccc.......',
        '..........aaa...',
        '.cc....d........',
        '.....aaa....cccc',
        '................',
        'cc...aa......aa.',
        '.......aaaaa....',
        '..aa.........cc.',
        '........ccc.....',
        '...........aa...'],
    2: ['..........bbbb..',
        '.bbb............',
        '......bb....b...',
        'bb.........bbbbb',
        '....bbb.........',
        '..........c.....',
        '.bbbb......bbb..',
        '................',
        '.......bbbbb....',
        'bb..............',
        '....c......bbb..',
        '..bbb...........',
        '.........bbbb...',
        'b...............',
        '.....bbb.....bb.',
        '................'],
}
# 고정 그림: <줄>1 잠긴 바닥 돌(밝은 c 덩이 + 아래 그늘 a, 위로 물결이 지나간다) · <줄>2 물속 너울 턱(b).
W_SPR = {
    'p1': ['.cc.', 'ccca', '.aa.'], 'p2': ['.ccc..', 'ccccc.', 'cccca.', '.aaa..'], 'p3': ['cc', 'ca'],
    'p4': ['.cccc.', 'ccccca', '.aaaa.'],
    'sw': ['..bbb.', '.bbbbb', 'bbbb..'], 'sl': ['...bbb..', '.bbbbbb.', 'bbbbb...'], 'ss': ['.bb', 'bbb'],
}
W_STATICS = {
    1: [[('p2', 3, 3), ('p1', 9, 9), ('p3', 6, 10)], [('p1', 9, 3), ('p4', 3, 9)], [('p3', 4, 5), ('p4', 7, 8), ('p3', 11, 11)], [('p2', 8, 4)]],
    2: [[('sw', 3, 4)], [('sl', 6, 8), ('ss', 3, 3)], [('ss', 9, 5), ('sw', 4, 10)], [('sl', 4, 4), ('ss', 9, 10)]],
}
W_STEP = {'A': (4, 0), 'B': (4, 0), 'C': (-4, 0)}


def place(layouts, sprites, line):
    """줄마다 고정 그림 자리를 바꾼다(B 위아래 뒤집기 · C 좌우 뒤집기) — 줄끼리 같은 그림이 겹치지 않게."""
    out = []
    for lay in layouts:
        L = []
        for nm, x, y in lay:
            rows = sprites[nm][0] if isinstance(sprites[nm][0], list) else sprites[nm]
            w, h = len(rows[0]), len(rows)
            if line == 'B':
                y = 16 - y - h
            elif line == 'C':
                x = 16 - x - w
            L.append((nm, x, y, (x * 3 + y) % NF))
        out.append(L)
    return out


def water(line, n):
    d = WATER_DESIGN[n]
    leg = dict(water_leg(line), T=dot.C(*LIP[line]))
    tex = dict(floor_tex(line, n), **bank_tex(line))
    fr_rows, inn_rows = bank_frame(d, WOB[line], KEYS[line])
    check_frame(f'물 {line}{n} 틀', fr_rows, inn_rows)
    fr, inn = ER.fill(fr_rows, inn_rows, leg, tex)
    base = [('b' if n == 1 else 'a') * 16] * 16
    layer = RIPPLE[n] if line != 'C' else mirror_h(RIPPLE[n])
    lays = place(W_STATICS[n], W_SPR, line)
    out = []
    for k in range(NF):
        bodies = [make_body(base, lay, layer, leg, k, W_SPR, W_STEP[line]) for lay in lays]
        out.append(autotile_cv(bodies[0], fr, inn, bodies[1:]))
    return out


# ================================================================================================ 용암 설계 (줄 B·C — A 는 시드 lines.A.skip)
# 기호: ',' 마른 바닥 · 'y' 그을린 바닥(한 단) · 'z' 탄 바닥(두 단) · 'C' 식은 껍질 윗면 결 · 'V' 껍질 끝(화산암 1단)
#       · 'Q' 빛 받는 껍질 턱 · 'M' 'L' 북쪽 껍질 앞면 · 'g' 앞면 밑이 용암 빛을 받음 · 'Y' 가장 뜨거움(용암 3단) · 'O' 주황(2단) · '.' 몸통.
LAVA_DESIGN = {
    1: dict(   # 껍질 낀 느린 흐름 — 두꺼운 껍질(z C V), 빛 띠는 대개 주황 1px, 뜨거운 곳만 노랑, 식은 곳은 껍질 혀
        N=(5, {2: 'gQ', 3: 'gMQ', 5: 'gMQz', 6: 'gLMQz', 7: 'gLMQzy'}, {'w': 'O', 'h': 'YO', 'c': 'V'}),
        S=(3, {1: 'V', 3: 'Vz', 4: 'VCz', 5: 'VCzy'}, {'w': 'O', 'h': 'YO', 'c': 'V'}),
        W=(4, {1: 'V', 3: 'Vz', 4: 'VCz', 5: 'VCzy', 7: 'VCCzy'}, {'w': 'O', 'h': 'YO', 'c': 'V'}),
        NW=[',,,,,,,,',
            ',,,,yzzz',
            ',,,yzQQQ',
            ',,yzQMMM',
            ',yzCQggg',
            ',zCVgYOO',
            ',zCVO...',
            ',zCVO...'],
        SW=[',zCVO...',
            ',zCVYO..',
            ',zCCVO..',
            ',yzCCVO.',
            ',,yzzCVO',
            ',,,yyzVV',
            ',,,,,yzz',
            ',,,,,,,,'],
        INW=[',zCVO...',
             'zzCVO...',
             'QzCVYO..',
             'MQCVO...',
             'gMQVO...',
             'OggVO...',
             '.OOO....',
             '........'],
        ISW=['........',
             '........',
             '........',
             '........',
             'OOO.....',
             'VVVOO...',
             'zzCVO...',
             ',zCVO...'],
    ),
    2: dict(   # 밝고 빠른 강 — 얇은 껍질 턱(Q V), 빛 띠 대개 주황 1px, 뜨거운 곳만 노랑, 식은 곳은 껍질 끝이 바로 닿음
        N=(4, {2: 'gQ', 3: 'gQ', 4: 'gMQ', 5: 'gMQz', 7: 'gLMQz'}, {'w': 'O', 'h': 'YO', 'c': 'V'}),
        S=(2, {1: 'V', 3: 'Vz', 4: 'Vzy'}, {'w': 'O', 'h': 'YO', 'c': 'V'}),
        W=(3, {1: 'V', 3: 'Vz', 4: 'Vzy', 6: 'VCzy'}, {'w': 'O', 'h': 'YO', 'c': 'V'}),
        NW=[',,,,,,,,',
            ',,,,,QQQ',
            ',,,zQMMM',
            ',,zQMggg',
            ',zVgYOOO',
            ',zVYO...',
            ',zVO....',
            ',zVO....'],
        SW=[',zVO....',
            ',zVYO...',
            ',zVVO...',
            ',,zVYO..',
            ',,zzVVO.',
            ',,,,zVVO',
            ',,,,,,VV',
            ',,,,,,,,'],
        INW=[',zVO....',
             'QzVO....',
             'MQVYO...',
             'gMVO....',
             'OggO....',
             '.OOO....',
             '........',
             '........'],
        ISW=['........',
             '........',
             '........',
             '........',
             '........',
             'OOO.....',
             'VVYO....',
             ',zVO....'],
    ),
}
for _n, _d in LAVA_DESIGN.items():
    check_design(f'용암 {_n}', _d)

LV_LEG = legend(V=('vrock', 1), Y=('lava', 3), O=('lava', 2))
# 껍질 층 결(줄마다): g 용암 빛 받는 앞면 밑단(용암 0 + 화산암 1) · L 앞면 아래(화산암 1·2) · M 앞면 위(2·3) · Q 빛 받는 턱(3·4).
CRUST_FACE = {
    'B': {'g': ('aaxaaaaxaaaxaaaa', 'lava', 0, 'vrock', 1), 'L': ('xxyxxxxxyxxyxxxx', 'vrock', 1, 'vrock', 2),
          'M': ('xyyxxxyyyxxxyyxx', 'vrock', 2, 'vrock', 3), 'Q': ('xxxyxxxxxxyxxxxx', 'vrock', 3, 'vrock', 4)},
    'C': {'g': ('aaaaxaaaaaaaxxaa', 'lava', 0, 'vrock', 1), 'L': ('xxxxxyxxxxxxxxyx', 'vrock', 1, 'cata', 1),
          'M': ('xxyyyyxxxxyyyxxx', 'vrock', 2, 'cata', 2), 'Q': ('yxxxxxxyyxxxxxxx', 'cata', 4, 'cata', 5)},
}


def crust_face(line):
    out = {}
    for ch, (pat, ra, ta, rb, tb) in CRUST_FACE[line].items():
        leg = legend(a=(ra, ta), x=(rb, tb)) if ch == 'g' else legend(x=(ra, ta), y=(rb, tb))
        out[ch] = rowtex(pat, leg)
    return out


LVR = legend(**{str(i): ('vrock', i) for i in range(5)})
# 식은 껍질 윗면 결 — 바탕 화산암 2단에 손으로 찍은 덩이(위 3 빛 · 아래 1 그늘). B 둥근 덩이 · C 납작한 층 덩이.
CRUST_LUMP = {'B': [(['.33.', '3221', '.11.'], 1, 1), (['33', '21'], 7, 3), (['.33.', '3221', '.11.'], 11, 6),
                    (['33', '21'], 4, 9), (['.33.', '3221', '.11.'], 8, 12), (['33', '21'], 14, 13), (['3', '1'], 2, 14)],
              'C': [(['3332', '2111'], 1, 2), (['332', '211'], 9, 1), (['33332', '21111'], 5, 6), (['332', '211'], 13, 8),
                    (['3332', '2111'], 2, 11), (['332', '211'], 10, 13), (['4', '1'], 7, 10)]}


def crust_tex(line):
    cv = grid(['2' * 16] * 16, LVR)
    for rows, x, y in CRUST_LUMP[line]:
        SR.wrap2(cv, rows, LVR, x, y)
    return cv


LL = legend(a=('lava', 0), b=('lava', 1), c=('lava', 2), d=('lava', 3), m=('vrock', 1), n=('vrock', 2), o=('vrock', 3))
# 몸통 결 한 장(16×16, 감아 민다). <줄>1: 붉은 용암(b)에 크기·모양이 다른 껍질 판 넷(위 빛 n o · 몸 m · 아래 달아오른 c),
# 판 둘레의 식은 어두운 용암(a), 드문 균열 c·뜨거운 점 d. <줄>2: 붉은 바탕에 주황 대리석 덩이, 노랑은 굽이치는 흐름 줄에만, 식은 점 m n.
L_PAT = {
    1: ['aaaaaaaaabaaaaaa',
        'aaaaaaaaaabaaama',
        'aanmaaaaaaabaaaa',
        'aammaaaaaaaabaaa',
        'aaaaaaaaaaaacbaa',
        'aaaaaaaaaaaaaaba',
        'baaaannnmaaaaaab',
        'abbanmmmmmmaaaaa',
        'aaacnmmmmmmmnaaa',
        'aaaaammmmmmmmaaa',
        'aaaaaaammmmmaaaa',
        'aaaaaaaaaaaaaaaa',
        'aamaaaaaaabbaaaa',
        'aaaaaaaaaaaacbaa',
        'aaaaabaaaaaaaaaa',
        'aaaaaabaaaaaaaaa'],
    2: ['bbbbcccbbbaaabbb',
        'bbbccccccbbaaaab',
        'bbcccdccccbbaabb',
        'abbccccbbccbaabb',
        'aabbbbbbbbccbabb',
        'aaabbbbbbcccccbb',
        'aabbbbbbbbccdccc',
        'abbbbbbbbbbcccbc',
        'ccbbamabbbbbbbbb',
        'cccbaaabbbbbbaac',
        'bccbbaabccbbaaab',
        'bbbbbbbcccccbaab',
        'bbbbbbbbcdcccbbb',
        'bbbbbaabbcccbbbb',
        'bbbaaaaabbbbbbbb',
        'bbbaabcccbbbbbbb'],
}
# 고정 그림 = 제자리에서 숨 쉬는 것(장면 넷). 흐르는 결 위 늘 같은 자리 — 변형마다 다른 그림이라 넓은 웅덩이가 16px 마다 같지 않다.
# <줄>1: 갈라진 틈이 달아올랐다 식음 · 분출구. <줄>2: 솟아오르는 노란 샘 · 식어 가는 검붉은 얼룩 · 길게 번지는 빛 줄.
L_SPR = {
    'vent': [['.b.', 'bcb', '.b.'], ['.c.', 'cdc', '.c.'], ['.d.', 'ddd', '.c.'], ['.c.', 'bcb', '.b.']],
    'vent_l': [['..b..', '.bcb.', '..b..'], ['..c..', '.cdc.', '..c..'], ['.cdc.', 'cdddc', '.cdc.'], ['..c..', '.cdc.', '..b..']],
    'fissure': [['bb......', '.bbcbb..', '....bbcb', '......b.'], ['bb......', '.bccbb..', '....bccb', '......b.'],
                ['bc......', '.bcdcbb.', '....bcdc', '......c.'], ['bb......', '.bccbb..', '....bbcb', '......b.']],
    'seam': [['.b...', 'bb...', '.bcb.', '...bb'], ['.b...', 'bc...', '.bcb.', '...bc'],
             ['.c...', 'cd...', '.cdc.', '...cd'], ['.b...', 'bc...', '.bbb.', '...bb']],
    'well': [['..cc...', '.cccc..', 'cccdccc', '..cccc.', '...cc..'], ['..cc...', '.ccdc..', 'ccdddcc', '..cdcc.', '...cc..'],
             ['..cdc..', '.cdddc.', 'ccdddcc', '..cddc.', '...cc..'], ['..cc...', '.ccdc..', 'cccdccc', '..cccc.', '...cc..']],
    'cool': [['.aa..', 'aaaa.', '.aaaa', '..aa.'], ['.aa..', 'amaa.', '.aaaa', '..aa.'],
             ['.aa..', 'aaaa.', '.aama', '..aa.'], ['.aa..', 'aaaa.', '.aaaa', '..aa.']],
    'flare': [['....cccc.', '.ccdddcc.', 'cc...ccc.'], ['....ccdc.', '.cdddddc.', 'cc...cdc.'],
              ['...cdddc.', '.cdddddcc', 'ccc..cdd.'], ['....cccc.', '.ccdddcc.', 'cc...ccc.']],
}
L_STATICS = {
    1: [[], [('fissure', 4, 5)], [('vent_l', 8, 3), ('seam', 3, 9)], [('vent', 3, 4), ('vent', 10, 10)]],
    2: [[], [('well', 4, 5)], [('cool', 3, 3), ('vent', 9, 9)], [('flare', 3, 7), ('cool', 9, 3)]],
}
L_STEP = {('B', 1): (4, 0), ('C', 1): (-4, 0), ('B', 2): (8, 4), ('C', 2): (-8, 4)}
# 칸 창의 위상(결을 감아 밀어 둠) — 그림은 같고 16px 창이 어디서 시작하나만 다르다. 흐르며 결의 진한 경계가 칸 경계에 겹치면
# 칸 격자가 드러나서(관문 S) 그런 위상을 피했다.
L_PHASE = {('B', 1): (1, 2), ('C', 1): (1, 2), ('B', 2): (1, 2), ('C', 2): (1, 2)}


def roll_rows(rows, rx, ry):
    rows = rows[-ry:] + rows[:-ry] if ry else list(rows)
    return [r[-rx:] + r[:-rx] if rx else r for r in rows]


def lava(line, n):
    d = LAVA_DESIGN[n]
    fl = floor_body(line, n)
    tex = {',': fl, 'y': soak(fl, WET_B if line == 'B' else WET), 'z': soak(fl, WET2_B if line == 'B' else WET2),
           'C': crust_tex(line), **crust_face(line)}
    fr_rows, inn_rows = bank_frame(d, LAVA_WOB[line], KEYS[line])
    check_frame(f'용암 {line}{n} 틀', fr_rows, inn_rows)
    fr, inn = ER.fill(fr_rows, inn_rows, LV_LEG, tex)
    pat = roll_rows(L_PAT[n] if line == 'B' else mirror_h(L_PAT[n]), *L_PHASE.get((line, n), (0, 0)))
    lays = place(L_STATICS[n], L_SPR, line)
    out = []
    for k in range(NF):
        bodies = []
        for lay in lays:
            cv = make_body(['b' * 16] * 16, [], pat, LL, k, L_SPR, L_STEP[(line, n)])
            for nm, x, y, ph in lay:
                rows = L_SPR[nm][(k + ph) % NF]
                assert 2 <= x and x + len(rows[0]) <= 14 and 2 <= y and y + len(rows) <= 14, nm
                stamp(cv, rows, LL, x, y)
            bodies.append(cv)
        out.append(autotile_cv(bodies[0], fr, inn, bodies[1:]))
    return out


# ================================================================================================ 장면
# 15×11: 벽(천장 + 앞면) 아래 바닥, 왼쪽 굽은 웅덩이(ㄴ자로 아래 오른쪽에 혹), 거기서 오른쪽 웅덩이까지 5칸 이어지는 1칸 폭 물길,
# 오른쪽 웅덩이 가운데로 동쪽에서 튀어나온 곶(2칸). 사람(Actor1)은 곶 끝에 선다. 웅덩이 윤곽은 칸마다 들쭉날쭉(네모 상자 아님).
SCENE = ['###############',
         '###############',
         '###############',
         '...............',
         '..www......ww..',
         '.wwwwwwwwwwwww.',
         '.wwww.....wwww.',
         '..www....www...',
         '..wwww...wwww..',
         '...www....ww...',
         '...............']
ACTOR_AT = (12, 7)


def scene(fs, line, n):
    g = [r.replace('w', '.') for r in SCENE]
    base = CR.render(g, line, n)
    out = []
    for f in fs:
        cv = Cv(base.w, base.h)
        cv.a[:] = base.a
        for y, row in enumerate(SCENE):
            for x, ch in enumerate(row):
                if ch == 'w':
                    t = f.tile_at(dot.mask_at(SCENE, x, y, lambda c, X, Y: c == 'w'), x, y)
                    cv.a[y * T:(y + 1) * T, x * T:(x + 1) * T] = t.a
        cv.paste(ER.actor_cv(), *ER.at_cell(*ACTOR_AT))
        out.append(cv)
    return out


def stream_strip(at):
    """1칸 폭 가로 물길 5칸(양끝 막힘) + 세로 물길 4칸 — 1칸 줄기가 끊기지 않고 이어지는지."""
    cv = Cv(7 * T, 4 * T)
    for i in range(5):
        m = (dot.E if i < 4 else 0) | (dot.W if i > 0 else 0)
        cv.paste(at.tile(m), i * T, T)
    for j in range(4):
        m = (dot.S if j < 3 else 0) | (dot.N if j > 0 else 0)
        cv.paste(at.tile(m), 6 * T, j * T)
    return cv


def cand(kind, line, n):
    def fn():
        fs = water(line, n) if kind == 'water' else lava(line, n)
        anim = scene(fs, line, n)
        liquid = [LIQ[line]] if kind == 'water' else ['lava', 'vrock']
        return ER.a2_frames(fs), {
            'kind': 'autotile', 'autotiles': {kind: fs[0]}, 'frames': {kind: fs}, 'liquid': liquid,
            'vignette': anim[0], 'anim': anim, 'note': NOTES[kind][f'{line}{n}'],
            'extras': [('몸통 4장면(본몸통)', hcat(*[f.body for f in fs]), 4),
                       ('넓은 웅덩이 몸통 8×6 — 변형 셋 섞음(장면 1)', dot.mosaic(fs[0], 8, 6), 2),
                       ('1칸 물길: 가로 5칸 · 세로 4칸', stream_strip(fs[0]), 3),
                       ('47 변형(장면 1)', variants_sheet(fs[0]), 2)]}
    return fn


NOTES = {
    'water': {
        'A1': '맑은 얕은 웅덩이 — 물 1단 바탕에 잠긴 바닥 돌, 촘촘한 물결 획이 장면마다 4px 흐름. 북쪽 흙 둑은 밝은 턱 밑 앞면 2~3줄 + 물 그늘, '
              '남쪽은 젖은 턱 1px 만, 서·동은 젖은 띠 1~3px + 가는 물금(곳곳 끊김)',
        'A2': '깊고 어두운 웅덩이 — 물 0단 바탕에 긴 너울, 물가 얕은 턱 띠(밝음→어두움). 북쪽 둑 앞면 3~4줄 + 진한 그늘',
        'B1': '맑은 얕은 고인 물(청록 2단) — 잠긴 돌, 회색 바위 둑 앞면, 젖은 흙 턱',
        'B2': '깊은 청록 웅덩이(1단 — 검은 구덩이가 아니게) — 바위 둑 앞면 3~4줄, 얕은 턱 띠, 너울',
        'C1': '맑은 얕은 물(판석 바닥) — 잠긴 돌, 회색 판석 둑 앞면, 물결이 왼쪽으로 흐름',
        'C2': '깊은 물(판석) — 판석 둑 앞면 3~4줄, 얕은 턱 띠, 너울'},
    'lava': {
        'B1': '껍질 낀 느린 흐름 — 탄 바닥(두 단) → 두꺼운 화산암 껍질(두께가 들쭉날쭉, 군데군데 용암으로 혀) → 대개 주황, 뜨거운 곳만 노란 빛 → '
              '붉은 용암에 크기 다른 껍질 판이 장면마다 4px 떠 흐르고, 변형마다 다른 자리에서 분출구가 숨 쉼',
        'B2': '밝고 빠른 강 — 얇은 껍질 턱 + 노랑·주황 빛 띠(식은 곳은 주황만), 붉은 바탕 주황 대리석 결에 노란 흐름 줄이 장면마다 (8,4)px',
        'C1': '껍질 낀 느린 흐름(심층굴) — 납작한 층 덩이 껍질, 껍질 판이 왼쪽으로 흐름',
        'C2': '밝고 빠른 강(심층굴) — 판석빛 껍질 턱, 흐름이 왼쪽 아래로 (8,4)px'},
}

CANDIDATES = {
    'gap.water_edge': {f'{ln}{n}': cand('water', ln, n) for ln in 'ABC' for n in (1, 2)},
    'gap.lava_edge': {f'{ln}{n}': cand('lava', ln, n) for ln in 'BC' for n in (1, 2)},
}
