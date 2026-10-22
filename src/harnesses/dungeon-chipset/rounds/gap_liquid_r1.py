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
    p0, land, water = side[:3]
    landk = side[3] if len(side) > 3 else {}   # 열쇠별 땅 층 바꿔치기(용암 뜨거운 자리의 바닥 빛 번짐)
    assert len(wob) == 16 and all(wob[i] == 0 for i in (0, 7, 8, 15)), wob
    assert len(keys) == 16 and all(keys[i] == 'w' for i in (0, 7, 8, 15)), keys
    out = []
    for dv, kc in zip(wob, keys):
        d = max(1, p0 + dv)
        ld, wt = landk.get(kc, land_at(land, d)), water[kc]
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


def roll_rows(rows, rx, ry):
    rows = rows[-ry:] + rows[:-ry] if ry else list(rows)
    return [r[-rx:] + r[:-rx] if rx else r for r in rows]


# ================================================================================================ 줄 재료
LIQ = {'A': ['tide'], 'B': ['pool'], 'C': ['tide']}


def water_leg(line):
    """q 가장 짙은 그늘 · a 깊은 바탕 · b 얕은 바탕 · c 물결 마루·잠긴 돌 · d 작은 반짝임.
    A·C = 버들항 바다 굴 웅덩이(parts/water_tide)와 같은 청록 tide 램프(0·1단 반반, 2단 드문 마루, 4단 반짝임).
    B = 고인 물(청록) — 0단이 거의 검어 그늘(q)에만 쓰고 한 단 올려 쓴다."""
    if line == 'B':
        return legend(q=('pool', 0), a=('pool', 1), b=('pool', 2), c=('pool', 4), d=('pool', 5))
    return legend(q=('tide', 0), a=('tide', 0), b=('tide', 1), c=('tide', 2), d=('tide', 4))


def edge_leg(line, n):
    """물가 틀의 물 글자 — 물금(d)·얕은 턱(c)은 물 안쪽의 밝은 선이 되어 스티커 테두리로 읽혀서
    바탕 단으로 녹인다(<줄>1 = 바탕 b, <줄>2 = 얕은 턱 b 한 단 띠). 젖음은 둑 쪽 젖은 띠(m n)가 맡는다."""
    L = water_leg(line)
    return dict(L, d=L['b'], c=L['b'])


LIP = {'A': ('cfloor', 5), 'B': ('cfloor', 3), 'C': ('cata', 5)}     # 둑 위 턱 빛

# 둑 앞면 층(물 쪽 → 위): J 물에 닿은 젖은 밑단 · H 가운데 · F 위 · (그 위 T 턱 빛). x = 바탕 단, y = 섞인 단(돌 알갱이·금).
BANK = {
    'A': {'F': ('cfloor', 3, 4, 'xxyxxxxyxxxyxxxx'), 'H': ('cfloor', 1, 2, 'xxxyxxyxxxxxyxxx'), 'J': ('cfloor', 0, 1, 'xyxxxxxxyxxxxxyx')},
    'B': {'F': ('cfloor', 2, 1, 'xyyxxxyxxxyyxxxx'), 'H': ('cfloor', 1, 0, 'xxxyxxxxyxxxxyxx'), 'J': ('rim', 1, 0, 'xxyxxxxyxxxxyxxx')},
    'C': {'F': ('cata', 3, 4, 'xxxxyyxxxxxxyyxx'), 'H': ('cata', 1, 2, 'xxyxxxxxxyxxxxxx'), 'J': ('cata', 0, 1, 'xxxxxyxxxxxxxxyx')},
}


def bank_tex(line):
    return {ch: rowtex(pat, legend(x=(r, t0), y=(r, t1))) for ch, (r, t0, t1, pat) in BANK[line].items()}


# 줄 굴곡 표(변마다 손으로, 사분면 경계 0). 북은 -2~+2(앞면 높이가 바뀜), 남은 -1~+2, 서·동은 -2~+3.
WOB = {   # 낮은 진동수·비대칭 — 사분면 경계(0·7·8·15) 둘레는 기본 깊이로 곧게 지나가고(칸마다 홈이 생기지 않게),
    #           한 변 띠에 혹 하나(±1px, 3~5px 머묾)만, 변·줄마다 자리와 방향이 다르다.
    'A': {'N': [0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, -1, 0, 0], 'S': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0],
          'W': [0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 'E': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0]},
    'B': {'N': [0, 0, -1, -1, -1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0], 'S': [0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          'W': [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0], 'E': [0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]},
    'C': {'N': [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0], 'S': [0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          'W': [0, 0, 0, 0, 1, 1, 0, 0, 0, 0, -1, -1, 0, 0, 0, 0], 'E': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0]},
}
# 열쇠 표 — w 기본 · h 뜨거움/밝음(물금 두껍게·노란 빛) · c 식음/끊김(물금·빛 띠 없음). 같은 열쇠가 3px 넘게 머문다.
KEYS = {
    'A': {'N': 'wwwhhhwwwwwcccww', 'S': 'wwwwwwwwwhhhwwww', 'W': 'wcccwwwwwwhhhwww', 'E': 'wwhhhwwwwwwcccww'},
    'B': {'N': 'wwcccwwwwwhhhhww', 'S': 'whhhwwwwwwwwcccw', 'W': 'wwwwhhhwwwcccwww', 'E': 'wcccwwwwwhhhwwww'},
    'C': {'N': 'whhhwwwwwccccwww', 'S': 'wwwwccwwwwwhhhww', 'W': 'wwhhhwwwwwwwcccw', 'E': 'wwwcccwwwhhhhwww'},
}
# 용암 1칸 줄기는 북·남 띠가 한 칸에 겹친다 — 북·남 굴곡을 ±1 로 줄여 줄기가 구슬 꿴 사슬처럼 조이지 않게.
# 용암 물가 굴곡·열쇠는 물과 따로 — 남·서·동 껍질 폭이 1~5px 로 크게 오르내리게(검수: 「고른 얇은 띠」).
# 칸 양끝 3열(0~2·13~15)은 굴곡 0·열쇠 w — 1칸 줄기가 칸 경계마다 조여 구슬 사슬로 읽히지 않게, 변화는 칸 안쪽에만.
# 남쪽엔 껍질 혀를 두지 않는다(칸마다 같은 자리 이빨 빗). 열쇠 k = 빛나는 금이 껍질 띠를 가로질러 끊는다(1~2열).
LAVA_WOB = {
    'B': {'N': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0], 'S': [0, 0, 0, 1, 1, 1, 0, 0, 0, 0, -1, -1, 0, 0, 0, 0],
          'W': [0, 0, 0, 1, 2, 1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 0], 'E': [0, 0, 0, 0, -1, 0, 0, 0, 0, 1, 2, 2, 1, 0, 0, 0]},
    'C': {'N': [0, 0, 0, 0, 0, -1, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0], 'S': [0, 0, 0, -1, -1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
          'W': [0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 2, 1, 0, 0, 0, 0], 'E': [0, 0, 1, 2, 1, 0, 0, 0, 0, 0, -1, -1, 0, 0, 0, 0]},
}
LAVA_KEYS = {
    'B': {'N': 'w' * 16, 'S': 'w' * 16, 'W': 'wwwcccwwwwkwwwww', 'E': 'wwwwwkwwwwcccwww'},
    'C': {'N': 'w' * 16, 'S': 'w' * 16, 'W': 'wwwwkwwwwcccwwww', 'E': 'wwwcccwwwwwkwwww'},
}
for _ln in 'ABC':
    for _s in 'NSWE':
        assert len(KEYS[_ln][_s]) == 16 and len(WOB[_ln][_s]) == 16, (_ln, _s)


# ================================================================================================ 물 설계
# 기호: ',' 마른 바닥 · 'm' 젖은 바닥 · 'n' 더 젖은 바닥(물에 닿음) · 'T' 둑 위 턱 빛 · 'F' 'H' 'J' 둑 앞면 층 · 'q'~'d' 물 · '.' 몸통.
WATER_DESIGN = {
    1: dict(   # 맑은 얕은 웅덩이 — 둑 앞면 2~3줄, 물 그늘 a 한 줄, 남·서·동은 젖은 턱 + 가는 물금 d
        N=(6, {3: 'JHT', 4: 'JHHT', 6: 'JJHHT', 7: 'JJHHFT', 8: 'JJJHHFT'}, {'w': 'q', 'h': 'qa', 'c': 'q'}),
        S=(2, {1: 'n', 3: 'nm', 5: 'nmm'}, {'w': 'd', 'h': 'dc', 'c': ''}),
        W=(2, {1: 'n', 3: 'nm', 5: 'nmm'}, {'w': 'd', 'h': 'dc', 'c': ''}),
        NW=[',,,,,,,,',
            ',,,,,TTT',
            ',,,,THHH',
            ',,,THHHH',
            ',,nTHJJJ',
            ',nnHJJJJ',
            ',nJJqqqq',
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
             'HHTd....',
             'JHHd....',
             'JJJq....',
             'qqq.....',
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
        N=(6, {3: 'JHT', 5: 'JJHT', 6: 'JJHFT', 7: 'JJHHFT', 8: 'JJJHHFT'}, {'w': 'q', 'h': 'qq', 'c': 'q'}),
        S=(2, {1: 'n', 3: 'nm', 5: 'nmm'}, {'w': 'dc', 'h': 'dcb', 'c': 'c'}),
        W=(3, {1: 'n', 3: 'nm', 5: 'nmm'}, {'w': 'dcb', 'h': 'dcbb', 'c': 'cb'}),
        NW=[',,,,,,,,',
            ',,,,,TTT',
            ',,,,TFFF',
            ',,,TFHHH',
            ',,mTHJJJ',
            ',mnHJJJJ',
            ',mnJqqqq',
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
             'FTndcb..',
             'HFTdcb..',
             'JHHqcb..',
             'JJqqbb..',
             'qqq.....',
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
RIPPLE = {   # 결 층 — 장면마다 감아 민다. <줄>1: 바탕 b 에 촘촘한 골 a 획 + 드문 마루 c + 반짝임 d. <줄>2: 바탕 a 에 성긴 b 너울 + 드문 c·d.
    1: ['.aaa.......aaa..',
        '......cc........',
        'aa.........aaaa.',
        '....aaa.........',
        '.........aa.....',
        'aaa.........aaa.',
        '.....aaaa.......',
        '..........cc....',
        '.aa.............',
        '.....aaa....aaaa',
        '................',
        'aa...aa......cc.',
        '.......aaaaa....',
        '..aa.........aa.',
        '........aaa.....',
        '...cc......aa...'],
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
# 고정 그림: <줄>1 잠긴 바닥 돌(밝은 c 덩이 + 아래 그늘 a) · <줄>2 물속 너울 턱(b) · tw 제자리에서 반짝였다 꺼지는 빛(장면 넷).
W_SPR = {
    'p1': ['.cc.', 'ccca', '.aa.'], 'p2': ['.ccc..', 'ccccc.', 'cccca.', '.aaa..'], 'p3': ['cc', 'ca'],
    'p4': ['.cccc.', 'ccccca', '.aaaa.'],
    'sw': ['..bbb.', '.bbbbb', 'bbbb..'], 'sl': ['...bbb..', '.bbbbbb.', 'bbbbb...'], 'ss': ['.bb', 'bbb'],
    'tw': [['.c.', 'cdc', '.c.'], ['d'], ['.'], ['.']], 'tw2': [['dd'], ['cd'], ['.'], ['c']],
}
W_STATICS = {
    1: [[('p2', 3, 3), ('p1', 9, 9)], [('p1', 9, 3), ('p4', 3, 9), ('tw2', 6, 6)],
        [('p3', 4, 5), ('p4', 7, 8)], [('p2', 8, 4)], [('tw', 4, 4), ('p3', 10, 9)], [('p3', 6, 11)]],
    2: [[('sw', 3, 4)], [('sl', 6, 8), ('ss', 3, 3)], [('ss', 9, 5), ('sw', 4, 10), ('tw', 3, 3)],
        [('sl', 4, 4), ('ss', 9, 10)], [], [('ss', 6, 6)]],
}
# <줄>1 은 결을 비스듬히(4,4) 민다 — 가로 획을 옆으로만 밀면 장면이 거의 같아 보였다. <줄>2 는 너울이 옆으로 흐른다.
W_STEP = {('A', 1): (4, 4), ('B', 1): (4, 4), ('C', 1): (-4, 4), ('A', 2): (4, 0), ('B', 2): (4, 0), ('C', 2): (-4, 0)}
W_PHASE = {('A', 2): (1, 2), ('C', 2): (2, 2)}


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
    fr, inn = ER.fill(fr_rows, inn_rows, dict(edge_leg(line, n), T=leg['T']), tex)
    base = [('b' if n == 1 else 'a') * 16] * 16
    layer = roll_rows(RIPPLE[n] if line != 'C' else mirror_h(RIPPLE[n]), *W_PHASE.get((line, n), (0, 0)))
    lays = place(W_STATICS[n], W_SPR, line)
    out = []
    for k in range(NF):
        bodies = [make_body(base, lay, layer, leg, k, W_SPR, W_STEP[(line, n)]) for lay in lays]
        out.append(autotile_cv(bodies[0], fr, inn, bodies[1:]))
    return out


# ================================================================================================ 용암 설계 (줄 B·C — A 는 시드 lines.A.skip)
# 기호: ',' 마른 바닥 · 'y' 달아오른 바닥(바닥 결을 따뜻한 갈색으로) · 'z' 탄 바닥 · 'C' 식은 껍질 윗면(손 결 + 실금처럼 빛나는 금)
#       · 'V' 껍질 끝(용암에 닿음, 불씨 점) · 'Q' 북쪽 둑 빛 받는 턱 · 'M' 'L' 둑 앞면 · 'g' 앞면 밑단이 용암 빛을 받음 · '.' 몸통.
# 빛 띠는 물가에 두지 않는다(칸마다 같은 자리에 노란 막대가 찍혀 칸 격자가 드러났다) — 빛은 몸통의 흐르는 맥과 껍질 실금이 낸다.
_LN = {'w': '', 'k': ''}
_LS = {'w': '', 'k': ''}
_LX = {'w': '', 'k': '', 'c': 'VCV'}      # c 자리(칸 안쪽만)는 껍질 혀가 3px 용암으로 들어간다
_LK = {'k': 'KKz'}                         # k 자리는 빛나는 금(용암 빛)이 껍질 띠를 가로지른다 — 테두리 고리를 끊는다
LAVA_EDGE = dict(
    N=(7, {4: 'gMQ', 5: 'gLMQ', 6: 'gLMMQ', 7: 'gLMMQz', 8: 'gLMMQzy'}, _LN),   # 북: 4~5줄 둑 앞면(3/4 낙차) + 탄 바닥
    S=(3, {2: 'V', 3: 'Vz', 4: 'VCz', 5: 'VCzy'}, _LS, _LK),                        # 남: 껍질 1~3px + 탄 바닥
    W=(4, {2: 'V', 3: 'Vz', 4: 'VCz', 5: 'VCzy', 6: 'VCCzy'}, _LX, _LK),          # 서·동: 껍질 1~3px + 탄 바닥
    NW=[',,,,,,,,',
        ',,,,zzzz',
        ',,,zzQQQ',
        ',,zzQMMM',
        ',,zQMMMM',
        ',zCQMLLL',
        ',zCVLggg',
        ',zCV....'],
    SW=[',zCV....',
        ',zCV....',
        ',zCCV...',
        ',yzCV...',
        ',,yzCVV.',
        ',,,yzzVV',
        ',,,,,yzz',
        ',,,,,,,,'],
    INW=[',zCV....',
         'zzCV....',
         'QzCV....',
         'MQCV....',
         'MMQV....',
         'LMMQ....',
         'gLLg....',
         '.gg.....'],
    ISW=['........',
         '........',
         '........',
         '........',
         '........',
         'VV......',
         'zCVV....',
         ',zCV....'],
)
check_design('용암 물가', LAVA_EDGE)

# 둑·껍질 결(줄마다). B = 따뜻한 검붉은 갈색 화산 껍질(rim·cfloor 어두운 단 + 용암 불씨). C = 푸르스름한 검은 층리(vrock).
LAVA_FACE = {
    'B': {'Q': ('xxyxxxxyyxxxxyxx', 'rim', 2, 'rim', 1), 'M': ('xxyyxxxxxyxxxyyx', 'wood', 1, 'rim', 1),
          'L': ('xxxyxxxxxxyxxxxx', 'wood', 1, 'wood', 0), 'g': ('aaxaaaaxaaaxaaaa', 'lava', 0, 'wood', 1),
          'V': ('xxzxxxxzzxxxxxzx', 'wood', 2, 'lava', 1, 'rim', 2)},
    'C': {'Q': ('xxxxxxxxxyyyyyyx', 'vrock', 2, 'vrock', 3), 'M': ('yyyyxxxxxxxxyyyy', 'vrock', 2, 'vrock', 1),
          'L': ('xxxxxxxyyyyyyxxx', 'vrock', 1, 'vrock', 2), 'g': ('aaaaxxaaaaaaaxaa', 'lava', 0, 'vrock', 1),
          'V': ('zzxxxxxxxzzxxzxx', 'vrock', 2, 'lava', 1, 'vrock', 3)},
}


def lava_face(line):
    out = {}
    for ch, (pat, ra, ta, rb, tb, *rz) in LAVA_FACE[line].items():
        leg = legend(a=(ra, ta), x=(rb, tb)) if ch == 'g' else legend(x=(ra, ta), y=(rb, tb), **({'z': tuple(rz)} if rz else {}))
        out[ch] = rowtex(pat, leg)
    return out


# 식은 껍질 윗면 16×16(손). s 바탕 · r 그늘 · w 빛 받은 덩이 · k 실금(용암 0단) · h 달아오른 실금(용암 1단).
CRUST = {
    'B': (['ssrsssfsssksswss', 'swwssrsssskssssf', 'sssssfsssshkssss', 'fsssrssswssksssr', 'sssksssswwssssrw', 'sskksssswssfsssr', 'wsksssrssssssrss', 'wwsssrwwsssksssr', 'wssfsssrssskhsfs', 'ssrssssssssksssw', 'sssssskssrssssww', 'swwssshkssfssssw', 'sssrssskssssrsss', 'fsssssskssswwwss', 'ssrswsssssssrssf', 'sskswwssrfsssssr'],
          legend(s=('wood', 2), r=('wood', 1), w=('rim', 2), f=('rim', 1), k=('lava', 0), h=('lava', 1))),
    'C': (['nnnnnnnmmmmmmnnn', 'mmmmmmmmmkmmmmmm', 'nnnnooonnnknnnnn', 'mmmmmmmmmmmkmmmm', 'nnnnnnnnnnnnnooo',
           'mmmkmmmmmmmmmmmm', 'nnnkhnnnnooonnnn', 'mmmmmmmmmmmmmmmm', 'oonnnnnnnnnnkknn', 'mmmmmmmmmmmmmhmm',
           'nnnnnnoooonnnnnn', 'mmmmmmmmmmmmmmmm', 'nnnnnkknnnnnnnoo', 'mmmmmmmhmmmmmmmm', 'nnoooonnnnnnnnnn', 'mmmmmmmmmmmkmmmm'],
          legend(m=('vrock', 2), n=('vrock', 3), o=('vrock', 4), k=('lava', 0), h=('lava', 1))),
}
for _ln, (_rows, _) in CRUST.items():
    assert len(_rows) == 16 and all(len(r) == 16 for r in _rows), _ln


# 빛나는 금(K) — 껍질을 가로지르는 용암 빛 1~2열: 주황·붉음이 섞여 깊이 따라 식는다.
CRACK = ['cbcbcbbcbcbcbcbc', 'bcbbcbcbbcbbcbcb'] * 8


def crust_tex(line):
    rows, leg = CRUST[line]
    return grid(rows, leg, 16, 16)


# 바닥을 따뜻하게(달아오른 y · 탄 z): 바닥 화소의 밝기 단에 따라 rim 램프 단으로 옮긴다(모양은 그대로).
HEAT = {'y': {'cfloor': [1, 1, 2, 2, 2, 3, 3, 3], 'stone': [1, 1, 2, 2, 3, 3], 'cata': [1, 1, 2, 2, 2, 3, 3], 'crock': [1, 1, 1, 2, 2, 2, 3]},
        'z': {'cfloor': [1, 1, 1, 1, 2, 2, 2, 2], 'stone': [1, 1, 1, 2, 2, 2], 'cata': [1, 1, 1, 2, 2, 2, 2], 'crock': [1, 1, 1, 1, 2, 2, 2]}}
HEAT_RAMP = {'y': 'rim', 'z': 'wood'}   # o = 용암 빛이 번진 바닥(주황 갈색)   # 달아오른 바닥 = 따뜻한 회갈색 · 탄 바닥 = 짙은 밤색


def heat(cv, table, ramp='rim'):
    out = Cv(cv.w, cv.h)
    out.a[:] = cv.a
    for y in range(cv.h):
        for x in range(cv.w):
            c = tuple(int(v) for v in cv.a[y, x, :3])
            for r, tb in table.items():
                t = ER.ramp_of(c, r)
                if t is not None:
                    out.a[y, x, :3] = dot.RAMPS[ramp][tb[t]]
                    break
    return out


# ------------------------------------------------------------------------------------------------ 몸통: 녹은 들판(버들항 lava-strip 결)
# 몸통은 모든 칸이 같은 16×16 세계 주기 손 결 한 장이다(변형 없음 — 칸마다 고정 얼룩이 격자를 만들었다).
# 버들항 lava-strip 처럼 노랑·주황 덩이(4~8px)와 그 사이 붉은 골, 드문 검붉은 점으로 밝기 전 범위를 쓰고,
# 장면마다 세계 위치 기준으로 흐름 방향 4px 감아 민다(16px 에서 한 바퀴) + 손으로 적은 몇 덩이가 부풀고 꺼진다.
# 구조가 강한 결을 4px 미니 화소 40~60% 가 장면마다 바뀌고, 감기는 칸 경계를 지나 이어지므로 이웃 칸이 끊기지 않는다.
#   <줄>1 「끓는 덩이 들판」: 맞물린 노랑·주황·붉은 덩이, 오른쪽 아래(서쪽 줄 C 는 왼쪽 아래)로 흐름.
#   <줄>2 「굽이치는 띠」: 붉은 바탕을 노란 심 + 주황 테 띠 두 줄과 가는 주황 실띠가 휘어 지나며, 장면마다 굵기가 바뀐다.
# a 검붉은 점 · b 붉은 골 · c 주황 · d 노랑.
LAVA_FIELD1 = ['cdbcccbbbbbbccdc',
               'cccddccbbbabcddd',
               'cddddddcbbbbbcdd',
               'dddcdddccbbcdddc',
               'cddddddcdcccddcc',
               'ccdcdddcbbccdcdc',
               'cdcddcbbbcccdccc',
               'bccccbbbcdcbbccb',
               'bbbcccdddcdbbbbb',
               'bbcccddddddcbbab',
               'cbcdcddcdddcbbbb',
               'bbbbcdddddcdcbbb',
               'bbabbcdddddcccbc',
               'cbbbbccddcdccddc',
               'cbbbbbbcccccdddc',
               'ccbbbccdccdcccdc']
assert len(LAVA_FIELD1) == 16 and all(len(r) == 16 for r in LAVA_FIELD1)
# 장면마다 덩이가 부풀고 꺼지는 손 고침(결 좌표, 감기 전): (x, y, 화소 줄).
BOIL1 = [[],
         [(3, 3, 'd'), (4, 7, 'dd'), (10, 10, 'd'), (6, 6, 'b'), (13, 5, 'b'), (8, 1, 'c')],
         [(5, 1, 'c'), (2, 4, 'c'), (8, 12, 'dd'), (9, 9, 'dd'), (1, 11, 'a'), (12, 1, 'd'), (4, 14, 'b')],
         [(3, 3, 'd'), (14, 8, 'c'), (7, 13, 'c'), (4, 15, 'bb'), (11, 7, 'b'), (0, 2, 'd')]]
# <줄>2 띠: (가운데 행 16열, 심 굵기 16열, 테 굵기 16열, 장면마다 굵기 더함 4×16). 굵기 0 = 테만(띠가 가늘어짐).
RIBBONS = [
    ([2, 2, 3, 3, 4, 5, 5, 5, 4, 4, 4, 3, 2, 2, 1, 1], [1, 1, 2, 2, 3, 3, 2, 1, 1, 2, 3, 3, 2, 1, 1, 1],
     [1, 1, 1, 2, 2, 1, 1, 1, 2, 2, 1, 1, 1, 2, 2, 1], 'd',
     ['0000000000000000', '0001100000-00000', '00011-00001100-0', '0000000-00011000']),
    ([9, 9, 10, 10, 11, 11, 12, 13, 13, 13, 12, 12, 12, 11, 10, 10], [2, 1, 1, 0, 1, 2, 3, 2, 1, 1, 2, 3, 3, 2, 2, 2],
     [1, 2, 2, 2, 1, 1, 1, 1, 2, 2, 1, 1, 1, 1, 1, 1], 'd',
     ['0000000000000000', '0-001100000-1100', '00011100-000-000', '0000-0011100000-']),
    ([6, 6, 7, 7, 9, 9, 10, 9, 9, 9, 8, 8, 7, 7, 6, 6], [0, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 0],
     [1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 1], 'd',
     ['0000000000000000', '0000011000000000', '0100000001100000', '0000000000001100']),
]
RIB_SPECKS = [(3, 0), (13, 6)]


def ribbon_field(k):
    g = [['b'] * 16 for _ in range(16)]
    for cy, th, sh, core, dk in RIBBONS:
        for x in range(16):
            t = max(0, th[x] + {'0': 0, '1': 1, '-': -1}[dk[k][x]])
            top = cy[x] - t // 2
            for i in range(1, sh[x] + 1):
                g[(top - i) % 16][x] = 'c'
                g[(top + t - 1 + i) % 16][x] = 'c'
            for i in range(t):
                g[(top + i) % 16][x] = core
    for x, y in RIB_SPECKS:
        g[y][x] = 'a'
    return [''.join(r) for r in g]


LL = legend(a=('lava', 0), b=('lava', 1), c=('lava', 2), d=('lava', 3))
L_STEP = {('B', 1): (4, 4), ('C', 1): (-4, 4), ('B', 2): (4, 0), ('C', 2): (-4, 0)}
L_PHASE = {('B', 1): (0, 1), ('C', 1): (0, 1), ('B', 2): (1, 0), ('C', 2): (1, 0)}


def lava_rows(line, n, k):
    if n == 1:
        g = [list(r) for r in LAVA_FIELD1]
        for x, y, run in BOIL1[k]:
            for i, ch in enumerate(run):
                g[y % 16][(x + i) % 16] = ch
        rows = [''.join(r) for r in g]
    else:
        rows = ribbon_field(k)
    if line == 'C':
        rows = mirror_h(rows)
    rx, ry = L_PHASE.get((line, n), (0, 0))
    dx, dy = L_STEP[(line, n)]
    return roll_rows(rows, (rx + dx * k) % 16, (ry + dy * k) % 16)


def lava_body(line, n, k):
    return grid(lava_rows(line, n, k), LL, 16, 16)


def lava(line, n):
    fl = floor_body(line, n)
    tex = {',': fl, 'y': heat(fl, HEAT['y']), 'z': heat(fl, HEAT['z'], 'wood'),
           'C': crust_tex(line), 'K': grid(CRACK, LL, 16, 16), **lava_face(line)}
    if line == 'C':   # 심층굴: 탄 띠는 푸르스름한 중간 화산암 층(검정 고리가 아니게)
        tex['z'] = rowtex('2223333322223332', legend(**{'2': ('vrock', 2), '3': ('vrock', 3)}))
    fr_rows, inn_rows = bank_frame(LAVA_EDGE, LAVA_WOB[line], LAVA_KEYS[line])
    check_frame(f'용암 {line}{n} 틀', fr_rows, inn_rows)
    fr, inn = ER.fill(fr_rows, inn_rows, {}, tex)
    return [autotile_cv(lava_body(line, n, k), fr, inn) for k in range(NF)]


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
        liquid = list(LIQ[line]) if kind == 'water' else ['lava', 'vrock']
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
