"""gap-liquid-r1 — 물·용암 ↔ 동굴 바닥 둥근 가장자리 오토타일(+4장면). 항목 2 × 줄 × 후보 2.

조수 던전 시험(~/claude-viz/assistant-dungeons-1/dg-r3-dg-lava-cave-0 · flooded-temple-0)에서 나온 문제를 고친다:
  - 용암 웅덩이가 칸마다 계단처럼 꺾인 네모 도장으로 보이고, 1칸 용암 줄기는 바닥과 끊긴 주황 막대처럼 보였다.
  - 물에 잠긴 방의 물이 네모 수조로 읽혔다.
edges-r1 의 물·용암(가장 가까운 기준)에서 지킨 것: style-r1 줄 바닥을 칸 자리대로 비쳐 넣기(fill), 사분면 경계에 묶인 굴곡 표,
몸통만 바뀌는 4장면(관문 A), 줄 돌. 고친 것:
  - **둥근 바깥 모서리**(손으로 찍은 8×8, 반지름 4~5px) · **부드러운 안 모서리**(둥근 땅 혹) — 네모 수조·계단 도장이 아니게.
  - **젖은 물가 띠**(바닥 결을 한두 단 내림 = 젖어 짙어진 흙) + 가는 밝은 물금.
  - **북쪽 둑 앞면**(3/4: 먼 둑은 바닥 윗면 밑에 앞면이 조금 보이고, 그 밑 물에 그늘 한 줄).
  - 굴곡은 0~2px 이 아니라 -1~+2px, 변마다 다른 손 표(줄마다 다른 표).
  - 용암: 바닥 쪽 그을린 바닥 → **식은 검은 화산암 껍질**(울퉁불퉁한 덩이) → **빛나는 띠**(노랑+주황) → 흐르는 몸통.
    1칸 줄기(북·남 가장자리가 한 칸에 같이)도 껍질·빛 띠·몸통이 모두 남아 이어진 물길로 읽힌다.
  - 몸통 변형(엔진 interiorVariants): 넓은 웅덩이가 16px 마다 같은 그림으로 찍히지 않게, 칸 둘레 2px 밖 가운데만 다른 변형 둘.

후보 1·2 는 다른 물건이다(색만 바꾼 것 아님):
  물 <줄>1 「맑은 얕은 웅덩이」 — 밝은 물(물 2단)에 바닥 돌이 비치고, 물결 빛이 흔들린다. 둑 앞면 2줄.
  물 <줄>2 「깊고 어두운 웅덩이」 — 짙은 물(0단)에 깊이 얼룩, 물가에 얕은 턱 띠(밝음→어두움), 둑 앞면 4줄 + 둑 바위.
  용암 <줄>1 「껍질 낀 느린 흐름」 — 어두운 붉은 용암에 검은 껍질 조각이 떠서 흐르고(장면마다 (4,4)px), 두꺼운 껍질 테두리.
  용암 <줄>2 「밝고 빠른 강」 — 주황 용암에 노란 흐름 줄이 빠르게((8,4)px) 흐름, 얇은 껍질 턱 + 두 줄 노란 빛 띠.
모든 화소는 이 파일의 행 문자열에서 오거나, style-r1·edges-r1 이 손으로 찍은 조각을 자리만 옮기고 램프 단만 내린 것이다.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dot  # noqa: E402
import edges_r1 as ER  # noqa: E402  줄 바닥·앞면 결·장면 렌더·Actor1 자리
import style_r1 as SR  # noqa: E402
from cave_r1 import autotile_cv, check_frame, frame, hcat, mirror_h, mirror_v, variants_sheet  # noqa: E402
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
# B 줄 바닥은 이미 짙은 흙(cfloor 1)이라 한 단만 내려도 0단 — 젖은 띠 둘이 같아지지 않게 B 는 마른 쪽을 덜 내린다.
WET_B = {'cfloor': [0, 0, 1, 1, 2, 3, 4, 5], 'stone': [0, 0, 1, 2, 2, 3]}
WET2_B = {'cfloor': [0, 0, 0, 1, 1, 2, 3, 4], 'stone': [0, 0, 0, 1, 1, 2]}


def strips_of(depths, land, water):
    """옆선 표 → 바깥→안쪽 8글자 띠 16개. depths[i] = 바깥 끝에서 물이 시작하는 깊이(땅 화소 수).
    land = 물가에서 바깥쪽으로 땅 층(첫 글자가 물에 닿음), 그 뒤는 ','(마른 바닥). water = 물가에서 안쪽으로 물 층, 그 뒤는 '.'(몸통)."""
    out = []
    for d in depths:
        s = ''
        for i in range(8):
            if i < d:
                j = d - 1 - i
                s += land[j] if j < len(land) else ','
            else:
                j = i - d
                s += water[j] if j < len(water) else '.'
        out.append(s)
    return out


def profile(p0, delta):
    assert len(delta) == 16 and all(delta[i] == 0 for i in (0, 7, 8, 15)), delta
    return [p0 + d for d in delta]


def tr(rows, table):
    return [''.join(table.get(c, c) for c in r) for r in rows]


def bank_frame(d, wob):
    """설계 d(모서리·안 모서리·층 표) + 줄 굴곡 표 → 32×32 기호 틀, 16×16 안 모서리."""
    n = strips_of(profile(d['pN'], wob['N']), d['landN'], d['waterN'])
    s = strips_of(profile(d['pS'], wob['S']), d['landS'], d['waterS'])
    w = strips_of(profile(d['pW'], wob['W']), d['landW'], d['waterW'])
    e = strips_of(profile(d['pW'], wob['E']), d['landW'], d['waterW'])
    em = d.get('east', {})   # 동쪽(그늘 쪽)으로 뒤집을 때 바꿔 칠할 글자
    fr = frame(d['NW'], tr(mirror_h(d['NW']), em), d['SW'], tr(mirror_h(d['SW']), em), n, s, w, [tr([x], em)[0] for x in e])
    inn = [d['INW'][y] + tr([d['INW'][y][::-1]], em)[0] for y in range(8)] + \
          [d['ISW'][y] + tr([d['ISW'][y][::-1]], em)[0] for y in range(8)]
    return fr, inn


def fill(fr_rows, inn_rows, leg, tex):
    return ER.fill(fr_rows, inn_rows, leg, tex)


def spot_ok(x, y, rows, span):
    h, w = len(rows), len(rows[0])
    assert x // 8 == (x + w - 1) // 8 and y // 8 == (y + h - 1) // 8 and x + w <= span and y + h <= span, \
        f'돌 ({x},{y}) {w}×{h} 이 사분면 경계를 넘는다 — 이웃 변형에서 반쪽이 된다'


def put_stones(fr, inn, spots, sprites, leg):
    """틀·안 모서리에 손으로 찍은 돌. spots = [('f'|'i', x, y, 이름)] — 돌 하나는 사분면 조각 하나 안에만."""
    for where, x, y, nm in spots:
        rows = sprites[nm]
        spot_ok(x, y, rows, 32 if where == 'f' else 16)
        stamp(fr if where == 'f' else inn, rows, leg, x, y)


def mirror_spots(spots, sprites):
    out = []
    for where, x, y, nm in spots:
        w = len(sprites[nm][0])
        out.append((where, (32 if where == 'f' else 16) - x - w, y, nm))
    return out


def mover(cv, rows, leg, x, y):
    SR.wrap2(cv, rows, leg, x, y)


def make_body(base, statics, movers, leg, k, sprites):
    """몸통 장면 k: 바탕 + 가운데 고정 그림(변형마다 다름, 둘레 2px 밖) + 움직이는 그림(모든 변형이 같다 → 칸 경계에서 이어짐).
    movers = [(장면 4개 그림 or 한 그림, x, y, 위상, (dx, dy))] — 장면 k 그림 (k+위상)%4 를 (x + dx·k, y + dy·k) 에 감아 찍는다."""
    cv = grid(base, leg, 16, 16)
    for nm, x, y in statics:
        rows = sprites[nm]
        assert 2 <= x and x + len(rows[0]) <= 14 and 2 <= y and y + len(rows) <= 14, f'고정 그림 {nm} ({x},{y}) 이 둘레 2px 에 닿는다'
        stamp(cv, rows, leg, x, y)
    for states, x, y, ph, (dx, dy) in movers:
        rows = states[(k + ph) % NF] if isinstance(states[0], list) else states
        mover(cv, rows, leg, x + dx * k, y + dy * k)
    return cv


def anim_autotiles(fr, inn, base, layouts, movers, leg, sprites):
    """장면 4개 오토타일 — 틀·안 모서리 한 벌(물가 화소 동일), 몸통 = 본몸통 + 변형(layouts[1:])."""
    out = []
    for k in range(NF):
        bodies = [make_body(base, lay, movers, leg, k, sprites) for lay in layouts]
        out.append(autotile_cv(bodies[0], fr, inn, bodies[1:]))
    return out


def sway(s):
    """물결 획이 0→1→2→1px 오른쪽으로 밀렸다 돌아온다(edges-r1 흐름과 같은 박자)."""
    return [['.' * d + s] for d in (0, 1, 2, 1)]


def glint(s, lit, base):
    """반짝임: 획이 밝아졌다(가운데 한 단 위) → 짧아졌다 → 바탕으로 꺼졌다 돌아온다."""
    n = len(s)
    mid = s[:n // 2] + lit + s[n // 2 + 1:]
    return [[s], [mid], ['.' + s[1:] if n > 1 else s], [base * n]]


# ================================================================================================ 줄 재료
LIQ = {'A': 'water', 'B': 'pool', 'C': 'water'}
LIQ_TONES = {'water': [0, 1, 2, 3, 4], 'pool': [0, 1, 2, 4, 5]}   # a~e 다섯 단(pool 3·5 단은 회색이라 e 만 5)
STONE_RAMP = {'A': 'crock', 'B': 'stone', 'C': 'cata'}
LIP = {'A': ('cfloor', 7), 'B': ('stone', 3), 'C': ('cata', 6)}     # 둑 위 턱 빛(줄 바닥의 가장 밝은 단 / B 는 회색 둑돌)


def water_leg(line):
    r = LIQ[line]
    return legend(**{ch: (r, t) for ch, t in zip('abcde', LIQ_TONES[r])})


def floor_tex(line):
    fl = ER.floor_body(line)
    wet, wet2 = (WET_B, WET2_B) if line == 'B' else (WET, WET2)
    return {',': fl, 'm': soak(fl, wet), 'n': soak(fl, wet2)}


def rowtex(pattern, leg):
    """층 결 — 손으로 적은 16글자 한 줄을 모든 행에 깐다. 둑 앞면·껍질 앞면은 굴곡 따라 행이 오르내리므로
    한 층(글자)은 행과 상관없이 같은 가로 결을 가져야 층이 끊기지 않는다."""
    assert len(pattern) == 16
    return grid([pattern] * 16, leg, 16, 16)


# 둑 앞면 층(물 쪽 → 위): J 물에 닿은 젖은 밑단 · H 가운데 · F 위 · (그 위 T 턱 빛). x = 바탕 단, y = 섞인 단(돌 알갱이·금).
# A 흙 둑(갈색 흙 + 어두운 흙) · B 회색 바위 둑 · C 회색 판석·화산암 층.
BANK = {
    'A': {'F': ('cfloor', 3, 4, 'xxyxxxxyxxxyxxxx'), 'H': ('cfloor', 1, 2, 'xxxyxxyxxxxxyxxx'), 'J': ('cfloor', 0, 1, 'xyxxxxxxyxxxxxyx')},
    'B': {'F': ('stone', 2, 3, 'xyyxxxyxxxyyxxxx'), 'H': ('stone', 1, 2, 'xxxyxxxxyxxxxyxx'), 'J': ('stone', 0, 1, 'xxyxxxxyxxxxyxxx')},
    'C': {'F': ('cata', 3, 4, 'xxxxyyxxxxxxyyxx'), 'H': ('cata', 1, 2, 'xxyxxxxxxyxxxxxx'), 'J': ('cata', 0, 1, 'xxxxxyxxxxxxxxyx')},
}


def bank_tex(line):
    out = {}
    for ch, (r, t0, t1, pat) in BANK[line].items():
        out[ch] = rowtex(pat, legend(x=(r, t0), y=(r, t1)))
    return out


# 줄 굴곡 표(변마다 손으로, 사분면 경계 0·안쪽 -1~+2). 줄마다 다른 표를 쓴다 — 같은 틀이 줄끼리 윤곽까지 겹치지 않게.
WOB = {   # 층마다 2px 넘게 머문다(1px 씩 오르내리면 가는 껍질·물금이 톱니처럼 보였다)
    'A': {'N': [0, 1, 1, 2, 2, 1, 1, 0, 0, 0, -1, -1, -1, 0, 0, 0], 'S': [0, 1, 1, 2, 2, 2, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0],
          'W': [0, 0, 1, 1, 2, 2, 1, 0, 0, 1, 1, 1, 1, 0, 0, 0], 'E': [0, 0, -1, -1, 0, 0, 0, 0, 0, 1, 1, 2, 2, 1, 1, 0]},
    'B': {'N': [0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 1, 2, 2, 2, 1, 0], 'S': [0, 1, 1, 1, 2, 2, 1, 0, 0, 0, 0, -1, -1, 0, 0, 0],
          'W': [0, 1, 2, 2, 3, 3, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0], 'E': [0, 1, 2, 2, 3, 2, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0]},
    'C': {'N': [0, -1, -1, 0, 0, 1, 1, 0, 0, 1, 1, 2, 2, 1, 0, 0], 'S': [0, 0, 1, 1, 1, 0, 0, 0, 0, 1, 2, 2, 3, 2, 1, 0],
          'W': [0, 1, 1, 2, 2, 1, 0, 0, 0, 0, -1, -1, 0, 1, 1, 0], 'E': [0, 0, 1, 1, 2, 2, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0]},
}
# 용암 1칸 줄기는 북·남 띠가 한 칸에 겹쳐 몸통이 좁다 — 북·남 굴곡은 +1 까지만(몸통이 사라지지 않게).
LAVA_WOB = {ln: {k: ([min(v, 1) for v in vs] if k in 'NS' else vs) for k, vs in w.items()} for ln, w in WOB.items()}


# ================================================================================================ 물 설계
# 기호: ',' 마른 바닥 · 'm' 젖은 바닥 · 'n' 더 젖은 바닥(물에 닿음) · 'T' 둑 위 턱 빛 · 'H' 'J' 'F' 둑 앞면 결(내림 1·2·0)
#       · 'a'~'e' 물(줄 램프 0~4단) · '.' 몸통. 북 = 먼 둑(앞면이 보임), 남·서·동 = 가까운/옆 물가(젖은 띠 + 밝은 물금).
WATER_DESIGN = {
    1: dict(   # 맑은 얕은 웅덩이 — 둑 앞면 2줄(H J) + 그늘 한 줄 b, 물금 d 한 줄, 몸통 c(밝은 물)
        pN=5, landN='JHTm', waterN='b', pS=3, landS='nm', waterS='d', pW=3, landW='nm', waterW='d',
        NW=[',,,,,,,,',
            ',,,,,,mm',
            ',,,,mmTT',
            ',,,mmTHH',
            ',,mmTHJJ',
            ',,mnHJbb',
            ',mnHJb..',
            ',mnd....'],
        SW=[',mnd....',
            ',mnd....',
            ',mnnd...',
            ',,mnnd..',
            ',,mmnndd',
            ',,,mmnnn',
            ',,,,,mmm',
            ',,,,,,,,'],
        INW=[',mnd....',
             'mmnd....',
             'TTnd....',
             'HHTd....',
             'JJHd....',
             'bbJd....',
             '..bb....',
             '........'],
        ISW=['........',
             '........',
             '........',
             '........',
             'dd......',
             'nnd.....',
             'mmnd....',
             ',mnd....'],
    ),
    2: dict(   # 깊고 어두운 웅덩이 — 둑 앞면 4줄(F H J J) + 짙은 그늘 a, 물가는 얕은 턱 띠 d→c→b 뒤 깊은 몸통 a
        pN=6, landN='JJHFT', waterN='a', pS=3, landS='nm', waterS='dcb', pW=3, landW='nm', waterW='dcb',
        NW=[',,,,,,,,',
            ',,,,,,TT',
            ',,,,TTFF',
            ',,,TFFHH',
            ',,TFHHJJ',
            ',mTHJJJJ',
            ',mnJJaaa',
            ',mndcb..'],
        SW=[',mndcb..',
            ',mndcb..',
            ',mnndcbb',
            ',,mnndcc',
            ',,mmnndd',
            ',,,mmnnn',
            ',,,,,mmm',
            ',,,,,,,,'],
        INW=[',mndcb..',
             'TTndcb..',
             'FFTdcb..',
             'HHFdcb..',
             'JJHdcb..',
             'JJJdcb..',
             'aaadcb..',
             '.aacbb..'],
        ISW=['........',
             '........',
             'bb......',
             'ccbb....',
             'ddccb...',
             'nnddcb..',
             'mmndcb..',
             ',mndcb..'],
    ),
}
for _n, _d in WATER_DESIGN.items():
    _f, _i = bank_frame(_d, {k: [0] * 16 for k in 'NSWE'})
    check_frame(f'물 {_n} 틀', _f, _i)

# 물가 돌 — 줄 돌 램프(A 녹회색 crock · B 회색 stone · C 회색 판석 cata). 위·왼 빛, 아래가 물에 잠겨 어둡다.
W_STONE = {'s': ['.43.', '4321', '.1a.'], 'm': ['.543.', '54321', '43211', '.aa1.'], 'f': ['.4443.', '433321', '.a11a.'],
           'b': ['.5543.', '544332', '443321', '.32211', '..aa..']}
W_STONE_LEG = {ln: {**{str(i): dot.C(STONE_RAMP[ln], i) for i in range(6)}} for ln in 'ABC'}
# <줄>1: 반쯤 잠긴 작은 돌이 물금에 걸침 · <줄>2: 둑 위 큰 둑돌(둑이 단단해 보이게)
W_SPOTS = {   # 돌은 띄엄띄엄 — 칸마다 같은 자리에 찍히므로 많으면 구슬 꿴 테두리가 된다
    1: [('f', 10, 27, 's'), ('f', 17, 5, 's'), ('i', 12, 13, 's')],
    2: [('f', 9, 0, 'b'), ('f', 25, 27, 's'), ('i', 0, 0, 's')],
}


def w_spots(line, n):
    sp = W_SPOTS[n]
    if line == 'B':
        return mirror_spots(sp, W_STONE)
    if line == 'C':   # 크기 맞바꿈(s↔m) — 같은 자리 같은 돌이면 줄끼리 윤곽이 겹친다
        sw = {'s': 'm', 'm': 's'}
        out = []
        for w, x, y, nm in sp:
            nn = sw.get(nm, nm)
            x = min(x, (x // 8) * 8 + 8 - len(W_STONE[nn][0]))
            y = min(y, (y // 8) * 8 + 8 - len(W_STONE[nn]))
            out.append((w, x, y, nn))
        return out
    return sp


# 몸통. 바닥 돌(맑은 물) = 위 빛 d · 아래 그늘 b 고리, 안은 바탕. 깊은 물 얼룩 = b 덩이. 물결 = 손으로 적은 짧은 가로 획.
W_SPR = {
    'p_big': ['.dd..', 'dcbbb', 'dbbba', '.aaa.'], 'p_med': ['.dd.', 'dbbb', '.aa.'], 'p_sml': ['db', 'ba'],
    'p_flat': ['.ddd.', 'dbbbb', '.aaaa'], 'p_long': ['.dddd..', 'dbbbbbb', '.aaaa..'],
    'swell': ['..bbb..', '.bbbbbb', 'bbbbbb.', '.bbbb..'], 'swell_s': ['.bb.', 'bbbb', '.bb.'],
    'swell_l': ['...bbb..', '.bbbbbbb', 'bbbbbbb.', '.bbbbb..', '...bb...'], 'deep': ['.aa.', 'aaaa', '.aa.'],
}
W_BODY = {   # (바탕 글자, 변형 셋의 고정 그림, 움직이는 그림)
    ('A', 1): ('c', [[('p_big', 3, 3), ('p_med', 9, 9), ('p_sml', 6, 10)],
                     [('p_med', 9, 3), ('p_flat', 3, 9)],
                     [('p_sml', 4, 5), ('p_long', 6, 8), ('p_sml', 11, 11)]],
               [('ed', 1, 1), ('dd', 9, 2), ('ded', 5, 6), ('e', 12, 7), ('dd', 0, 12), ('edd', 10, 13), ('d', 14, 4)]),
    ('B', 1): ('c', [[('p_flat', 2, 2), ('p_sml', 10, 4), ('p_big', 7, 9)],
                     [('p_long', 4, 4), ('p_sml', 3, 10), ('p_med', 10, 10)],
                     [('p_big', 8, 2), ('p_sml', 3, 8), ('p_flat', 6, 11)]],
               [('dd', 3, 0), ('d', 11, 3), ('dd', 1, 7), ('ddd', 9, 8), ('d', 6, 13), ('dd', 13, 12)]),
    ('C', 1): ('c', [[('p_long', 2, 3), ('p_flat', 8, 9)],
                     [('p_flat', 3, 2), ('p_long', 5, 8), ('p_sml', 11, 3)],
                     [('p_med', 2, 9), ('p_flat', 8, 4), ('p_sml', 11, 11)]],
               [('eddd', 0, 2), ('dd', 10, 5), ('edd', 4, 9), ('d', 13, 10), ('ddd', 7, 14), ('e', 2, 12)]),
    ('A', 2): ('a', [[('swell', 3, 3), ('swell_s', 9, 9)],
                     [('swell_l', 5, 2), ('deep', 3, 10)],
                     [('swell_s', 3, 4), ('swell', 6, 8)]],
               [('ccc', 2, 1), ('cd', 10, 4), ('ccc', 6, 7), ('cc', 13, 10), ('cdc', 1, 12), ('bb', 9, 14)]),
    ('B', 2): ('a', [[('swell_l', 2, 4), ('deep', 10, 10)],
                     [('swell_s', 4, 2), ('swell', 7, 8)],
                     [('swell', 2, 9), ('swell_s', 9, 3)]],
               [('cc', 4, 0), ('cdc', 11, 3), ('cc', 2, 8), ('ccc', 9, 11), ('bb', 14, 6), ('cd', 6, 14)]),
    ('C', 2): ('a', [[('swell', 7, 2), ('swell_l', 2, 8)],
                     [('swell_s', 3, 3), ('swell_s', 10, 9), ('deep', 6, 7)],
                     [('swell_l', 4, 5)]],
               [('cddc', 1, 1), ('cc', 9, 6), ('ccd', 3, 9), ('cc', 12, 12), ('bbb', 6, 13), ('dc', 12, 3)]),
}
PH = [0, 2, 1, 3, 3, 1, 0, 2]


def water(line, n):
    d = WATER_DESIGN[n]
    leg = dict(water_leg(line), T=dot.C(*LIP[line]))
    tex = dict(floor_tex(line), **bank_tex(line))
    fr_rows, inn_rows = bank_frame(d, WOB[line])
    check_frame(f'물 {line}{n} 틀', fr_rows, inn_rows)
    fr, inn = fill(fr_rows, inn_rows, leg, tex)
    put_stones(fr, inn, w_spots(line, n), W_STONE, dict(W_STONE_LEG[line], a=leg['a'] if n == 2 else leg['b']))
    base_ch, layouts, strokes = W_BODY[(line, n)]
    base = [base_ch * 16] * 16
    lit = {'c': 'd', 'd': 'e', 'b': 'c', 'e': 'e'}
    mv = []
    for i, (s, x, y) in enumerate(strokes):
        st = sway(s) if n == 1 else glint(s, lit[s[len(s) // 2]], base_ch)
        mv.append((st, x, y, PH[i % len(PH)], (0, 0)))
    return anim_autotiles(fr, inn, base, layouts, mv, leg, W_SPR)


# ================================================================================================ 용암 설계 (줄 B·C — A 는 시드 lines.A.skip)
# 기호: ',' 마른 바닥 · 'z' 그을린 바닥(바닥 결 한 단 내림) · 'C' 식은 껍질 윗면 결(화산암) · 'V' 껍질 끝(화산암 1단, 빛 띠에 닿음)
#       · 'Q' 빛 받는 껍질 턱(화산암 3단) · 'R' 북쪽 껍질 앞면 결(edges-r1 용암 턱 바위) · 'g' 앞면 밑이 용암 빛을 받음(용암 0단)
#       · 'Y' 가장 뜨거운 띠(용암 3단) · 'O' 그다음(용암 2단) · '.' 몸통.
LAVA_DESIGN = {
    1: dict(   # 껍질 낀 느린 흐름 — 두꺼운 껍질(z C V), 빛 띠 Y O 각 1px, 몸통은 어두운 붉은 용암
        pN=5, landN='gLMQ', waterN='YO', pS=4, landS='VCz', waterS='YO', pW=4, landW='VCz', waterW='YO',
        NW=[',,,,,,,,',
            ',,,,,,QQ',
            ',,,,zQMM',
            ',,,zCMLL',
            ',,zCVLgg',
            ',zCVgYYY',
            ',zCVYOOO',
            ',zCVYO..'],
        SW=[',zCVYO..',
            ',zCVYO..',
            ',zCCVYOO',
            ',,zCCVYY',
            ',,zzCCVV',
            ',,,zzCCC',
            ',,,,,zzz',
            ',,,,,,,,'],
        INW=[',zCVYO..',
             'QzCVYO..',
             'MQCVYO..',
             'LMQVYO..',
             'ggLVYO..',
             'YYgVYO..',
             'OOYYYO..',
             '..OOO...'],
        ISW=['........',
             '........',
             'OO......',
             'YYOO....',
             'VVYYO...',
             'CCVVYO..',
             'zzCVYO..',
             ',zCVYO..'],
    ),
    2: dict(   # 밝고 빠른 강 — 얇은 껍질 턱(Q V), 노란 빛 띠 두 줄 Y Y + 주황 O, 몸통은 밝은 주황
        pN=4, landN='gMQ', waterN='YYO', pS=3, landS='VQ', waterS='YYO', pW=3, landW='VQ', waterW='YYO',
        NW=[',,,,,,,,',
            ',,,,,QQQ',
            ',,,QQMMM',
            ',,QVMggg',
            ',QVgYYYY',
            ',QVYYYYY',
            ',QVYYOOO',
            ',QVYYO..'],
        SW=[',QVYYO..',
            ',QVYYO..',
            ',QVVYYOO',
            ',,QVVYYY',
            ',,QQVVYY',
            ',,,QQVVV',
            ',,,,,QQQ',
            ',,,,,,,,'],
        INW=[',QVYYO..',
             'QQVYYO..',
             'MMVYYO..',
             'ggYYYO..',
             'YYYYOO..',
             'YYYOO...',
             'OOO.....',
             '........'],
        ISW=['........',
             '........',
             'OO......',
             'YYOO....',
             'YYYYO...',
             'VVYYYO..',
             'QQVYYO..',
             ',QVYYO..'],
    ),
}
for _n, _d in LAVA_DESIGN.items():
    _f, _i = bank_frame(_d, {k: [0] * 16 for k in 'NSWE'})
    check_frame(f'용암 {_n} 틀', _f, _i)

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


LL = legend(a=('lava', 0), b=('lava', 1), c=('lava', 2), d=('lava', 3), k=('vrock', 0), m=('vrock', 1), n=('vrock', 2), o=('vrock', 3),
            p=('vrock', 4))
# 껍질 조각(<줄>1): 위·왼 빛 o p · 아래·오른 그늘 m · 둘레가 달아올라 c. 빛 띠 조각(<줄>2): 노란 흐름 줄 d · 어두운 소용돌이 b · 식은 점 a.
L_SPR = {
    'floe_l': ['..cccc..', '.cooonc.', 'conpnnmc', 'cnnnmmmc', '.cmmmmc.', '..cc.c..'],
    'floe_m': ['.ccc..', 'coonc.', 'cnnmmc', '.cmmc.', '..c...'], 'floe_s': ['.cc.', 'cnmc', '.cc.'],
    'floe_r': ['ccccc..', 'cooonc.', '.cnnmmc', '..cccc.'], 'floe_t': ['ccc', 'cnm', '.cc'],
    'vent': ['.c.', 'cdc', '.c.'], 'vent_l': ['..c..', '.cdc.', 'cdddc', '.cdc.'], 'hot': ['cd', 'dc'],
    'cool': ['.bb.', 'baab', '.bb.'], 'cool_l': ['..bb.', '.baab', 'baab.', '.bb..'], 'cool_s': ['bb', 'ab'],
}
# 몸통 = 손으로 적은 16×16 대리석 결(용암 0~3단의 굵은 덩이·소용돌이) 위에 껍질 조각·노란 흐름 줄을 찍은 한 장(P).
# 장면 k 는 P 를 통째로 (dx·k, dy·k) 감아 민다 — 흐르는 용암. P 는 16 주기라 밀어도 칸 경계가 이어진다.
# 변형(엔진 interiorVariants)은 그 위 가운데(둘레 2px 밖)에 고정된 솟구침(<줄>1 노란 기포 / <줄>2 식은 검붉은 점)만 다르다.
L_BASE = {
    ('B', 1): ['baaaaaaabbbbbbbb', 'aammaabbbaaabbbb', 'baaabbbbaammaabb', 'bbbbbccbbaaaabbb', 'bbbbbbbbbbccdbbb',
               'bbbbaaaabbbbbbbb', 'bbbaammaabbbbaaa', 'abbbaaabbbbbaama', 'bbbcbbbbbbbbbaab', 'bccbbbbbaaabbbbb',
               'bbbbbbbaamaabbbd', 'baaabbbbaabbbbbb', 'aamaabcdcbbbbbbb', 'baabbbbbbbbaaabb', 'bbbbbbbbbbaamaab',
               'bbbbbaabbbbaabbb'],
    ('C', 1): ['abbbbbbbbbbbbaaa', 'bbaamaaabbbbbbbb', 'bbbaamaaabbbbbbb', 'bbbbcccbbbbbbbbb', 'bbbbbbbbbbaamaaa',
               'bbbbbbbbbaamaaab', 'bbbbbbbbdbbcccbb', 'baamaabbbbbbbbbb', 'bbaamaabbbbbbbbb', 'bbbccbbbbbbbbbbb',
               'bbbbbbbbbaamaabb', 'bdbbbbbbbbaamaab', 'bbbbbbbbbbbccbbb', 'bbbaamaabbbbbbdb', 'bbbbaaabbbbbbbbb',
               'bbbbbbcccbbbaaaa'],
    ('B', 2): ['ccdddddbbccccccc', 'cdddddcbcccccddc', 'ccdddcccccbccdcc', 'cccccbbcccbbcccc', 'bccccbccddcccccc',
               'bccccccdddddcccb', 'cbcccccdddddcccc', 'ccccccccdddccbbc', 'ccdddccccccccbcc', 'ccddcccbbcccccdd',
               'dccccbabcccccddd', 'cccccbccccccacdc', 'ccccccccdddccccc', 'cccbccccddcccbcc', 'ccbbcccccccccbac',
               'ccbccddcccccccbc'],
    ('C', 2): ['cccccccbbccccccc', 'cddddddccccccccc', 'cccddddddccccccc', 'cccccccccbbbcccc', 'ccccccccccbabcdd',
               'ccccccccccccbccc', 'cccccccccddddddc', 'dccccccccccddddd', 'cccccccccccccccc', 'cbbbccccccccbbbc',
               'cccbabcccccccccc', 'ccddddddcccccccc', 'ccccdddddccccccc', 'cccccccccccccccc', 'cccccccccccdddcc',
               'ccccccbbbccccccc'],
}
L_BODY = {   # (변형 셋 고정 그림, P 에 찍는 껍질·흐름 그림 [(그림, x, y)], 장면당 밀기)
    ('B', 1): ([[]], [], (4, 4)),   # 껍질 판은 P 에 그려 넣었다 — 판 위에 고정 그림을 얹으면 판이 미끄러질 때 떠 보여 변형을 두지 않는다
    ('C', 1): ([[]], [], (4, 4)),
    ('B', 2): ([[('cool', 6, 6)], [('cool_l', 3, 8), ('cool_s', 10, 3)], [('cool_s', 4, 4), ('cool', 9, 9)]],
               [('a', 7, 10), ('n', 6, 13)], (8, 4)),
    ('C', 2): ([[('cool_l', 6, 3)], [('cool', 3, 9), ('cool_s', 10, 4)], [('cool_s', 8, 8), ('cool_s', 3, 3)]],
               [('a', 7, 2), ('n', 13, 14)], (4, 0)),
}


# 칸 창의 위상(P 를 감아 밀어 둠) — 그림은 같고 16px 창이 어디서 시작하나만 다르다. 흐르며 P 의 가로·세로 결 경계가 칸 경계에 올 때
# 진한 껍질 밑단이 칸 경계와 겹치면 칸 격자가 드러나서(관문 S) 그런 위상을 피했다.
L_PHASE = {('B', 1): (0, 1), ('B', 2): (0, 2)}


def lava_pattern(line, n):
    from cave_r1 import shift
    cv = grid(L_BASE[(line, n)], LL, 16, 16)
    for nm, x, y in L_BODY[(line, n)][1]:
        SR.wrap2(cv, L_SPR.get(nm, [nm]), LL, x, y)
    rx, ry = L_PHASE.get((line, n), (0, 0))
    return shift(cv, rx, ry) if rx or ry else cv


def lava_frames_bodies(line, n, k):
    """장면 k 의 몸통(본몸통 + 변형): P 를 통째로 밀고 가운데 고정 솟구침을 얹는다."""
    from cave_r1 import shift
    layouts, _, (dx, dy) = L_BODY[(line, n)]
    moved = shift(lava_pattern(line, n), dx * k, dy * k)
    out = []
    for lay in layouts:
        cv = Cv(16, 16)
        cv.a[:] = moved.a
        for nm, x, y in lay:
            rows = L_SPR[nm]
            assert 2 <= x and x + len(rows[0]) <= 14 and 2 <= y and y + len(rows) <= 14, nm
            stamp(cv, rows, LL, x, y)
        out.append(cv)
    return out


# 껍질 덩이 — 빛 띠를 끊고 몸통 쪽으로 튀어나온 화산암 돌(테두리가 자로 그은 줄이 아니게).
L_STONE = {'s': ['.32.', '3221', '.11.'], 'm': ['.332.', '32221', '.111.'], 'f': ['.3332.', '322221', '.1111.']}
L_SPOTS = {
    1: [('f', 10, 3, 'm'), ('f', 2, 19, 'm'), ('f', 9, 26, 'f'), ('f', 26, 12, 's')],
    2: [('f', 11, 2, 's'), ('f', 20, 27, 's')],
}


def l_spots(line, n):
    return mirror_spots(L_SPOTS[n], L_STONE) if line == 'C' else L_SPOTS[n]


def lava(line, n):
    d = LAVA_DESIGN[n]
    fl = ER.floor_body(line)
    tex = {',': fl, 'z': soak(fl, WET_B if line == 'B' else WET), 'C': crust_tex(line), **crust_face(line)}
    fr_rows, inn_rows = bank_frame(d, LAVA_WOB[line])
    check_frame(f'용암 {line}{n} 틀', fr_rows, inn_rows)
    fr, inn = fill(fr_rows, inn_rows, LV_LEG, tex)
    put_stones(fr, inn, l_spots(line, n), L_STONE, LVR)
    out = []
    for k in range(NF):
        bodies = lava_frames_bodies(line, n, k)
        out.append(autotile_cv(bodies[0], fr, inn, bodies[1:]))
    return out


# ================================================================================================ 장면
# 15×11: 벽(천장 + 앞면 2단) 아래 바닥, 왼쪽 ㄴ자 웅덩이(세로 3칸 폭 + 아래 가로 2칸 폭), 거기서 오른쪽 웅덩이까지 6칸 이어지는
# 1칸 폭 물길, 오른쪽 웅덩이 가운데로 동쪽에서 튀어나온 곶(3칸). 사람(Actor1)은 곶 끝에 선다.
SCENE = ['###############',
         '###############',
         '###############',
         '...............',
         '.www......www..',
         '.wwwwwwwwwwwww.',
         '.www......w....',
         '.www......wwww.',
         '.wwwwww...www..',
         '.wwwwww........',
         '...............']
ACTOR_AT = (12, 6)


def scene(fs, line):
    g = [r.replace('w', 'L') for r in SCENE]
    return [ER.render(g, line, {'L': f}, [(ER.actor_cv(),) + ER.at_cell(*ACTOR_AT)]) for f in fs]


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
        anim = scene(fs, line)
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
        'A1': '맑은 얕은 웅덩이 — 밝은 물에 바닥 돌(위 빛·아래 그늘 고리)이 비치고 물결 빛 획이 0→1→2→1px 흔들림. 갈색 흙 물가가 젖어 짙어지고 '
              '가는 밝은 물금, 북쪽 둑은 바위 앞면 2줄 + 물 그늘. 반쯤 잠긴 녹회색 돌',
        'A2': '깊고 어두운 웅덩이 — 짙은 물(0단)에 깊이 얼룩, 물가는 얕은 턱 띠(밝음→어두움) 뒤 깊이 꺼짐. 북쪽 둑 앞면 4줄 + 큰 둑돌. 긴 빛 획이 반짝임',
        'B1': '맑은 얕은 고인 물(검푸른 물 램프 2단) — 납작한 바닥 돌, 회색 둑돌 턱, 흐름 획',
        'B2': '깊은 검푸른 웅덩이 — 둑 앞면 4줄(바윗덩이 결), 회색 둑돌, 얕은 턱 띠, 반짝임',
        'C1': '맑은 얕은 물(판석 바닥이 비침) — 길쭉한 판돌, 밝은 회색 자갈 물가, 흐름 획',
        'C2': '깊은 물 — 화산암 층리 둑 앞면 4줄, 회색 판석 둑돌, 깊이 얼룩, 반짝임'},
    'lava': {
        'B1': '껍질 낀 느린 흐름 — 그을린 바닥 → 식은 화산암 껍질(둥근 덩이 결, 빛 띠로 튀어나온 돌) → 노랑·주황 빛 띠 1px 씩 → 어두운 붉은 용암. '
              '검은 껍질 조각이 둘레가 달아올라 장면마다 (4,4)px 떠내려가고, 변형마다 다른 자리에서 노란 기포가 솟음',
        'B2': '밝고 빠른 강 — 얇은 껍질 턱 + 노란 빛 띠 2줄 + 주황, 몸통은 밝은 주황에 노란 흐름 줄·어두운 소용돌이가 장면마다 (8,4)px 흐름',
        'C1': '껍질 낀 느린 흐름(심층굴) — 납작한 층 덩이 화산암 껍질, 각진 껍질 판이 떠내려감',
        'C2': '밝고 빠른 강(심층굴) — 층 덩이 껍질 얇은 턱, 노란 흐름 줄'},
}
NOTES_LEAD = ''

CANDIDATES = {
    'gap.water_edge': {f'{ln}{n}': cand('water', ln, n) for ln in 'ABC' for n in (1, 2)},
    'gap.lava_edge': {f'{ln}{n}': cand('lava', ln, n) for ln in 'BC' for n in (1, 2)},
}
