"""theme-climate desert — 피라미드 실내 구조(2026-10-23): 사암 판석 바닥 · 벽 앞면 키트 · 천장 테두리 47 · 모래 구덩이 함정.

모든 화소는 아래 행 문자열에서 온다(손 도트). 조립은 찍은 조각을 자리만 옮긴다(벽 끝 기둥 줄 바꿔 끼우기, 함정 = 바닥 칸 위에 구덩이 조각).
빛은 왼쪽 위. 색은 sand(0 어둠 → 6 밝음) · void 램프만.

후보 두 벌(같은 번호끼리 한 세트):
  A1 「큰 매끈 마름돌」 — 8줄 높이 큰 판석·큰 벽돌, 따뜻한 황갈색, 테두리 = 매끈한 한 겹 띠, 새김 = 액자 판(눈·매).
  A2 「거친 작은 켜 + 모래 쌓임」 — 5·5·6줄 작은 켜·고르지 않은 이음, 이음과 구석에 모래, 테두리 = 두 켜 띠,
       새김 = 벽을 가로지르는 띠(해 원반·물결).

pyramid_room(plan, n=1) — 형제 작업자(사막 기물)가 장면 바탕으로 쓴다. 서명 고정.

pyr_face 그림(128×48) 배치:
  x0-47   face3h  3단 키트(왼끝|가운데|오른끝) × (윗단|가운데단|아랫단)
  x48-95  y0-31   face2h  2단 키트(왼끝|가운데|오른끝) × (윗단|아랫단)
          y32-47  base3h  3단 아랫단 변형 셋(왼끝|가운데|오른끝) — A1 물결 띠 새김 / A2 벽밑 모래 쌓임
  x96-111 glyph3h 새김 가운데 3단(16×48, 가운데 단에 새김)
  x112-127 y0-31 glyph2h 새김 가운데 2단(16×32, 윗단에 새김) · y32-47 alt3h 3단 가운데단 변형(금 간 돌)
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import theme_climate_lib as lib  # noqa: E402
import dot  # noqa: E402
from theme_climate_lib import Cv, T, g, hcat, leg, ramp_chars, stamp, vcat  # noqa: E402,F401

# 글자: a~g = sand 0~6 · x y z = void 0~2
LS = leg(ramp_chars('sand', 'abcdefg'), ramp_chars('void', 'xyz'))
# A2 는 이음(줄눈)을 한 단 더 깊게 — b 를 sand0 으로
LS2 = leg(ramp_chars('sand', 'abcdefg'), ramp_chars('void', 'xyz'), b=('sand', 0), a=('sand', 0))


# 벽 앞면은 바닥보다 한 단 어둡게: 글자를 한 단씩 내려 읽고, 가장 깊은 줄눈만 cfloor 0(짙은 회갈)
LF1 = leg(ramp_chars('sand', 'abcdefg'), a=('cfloor', 0), b=('sand', 0), c=('sand', 1), d=('sand', 2), e=('sand', 3),
          f=('sand', 4), g=('sand', 5))
# A2 벽 = 먼지 앉은 사암: 몸통 sand 2, 줄눈·그늘·턱은 회갈 cfloor — A1 의 붉은 황갈 통돌과 다른 결
LF2 = leg(ramp_chars('sand', 'abcdefg'), a=('cfloor', 0), b=('cfloor', 1), c=('sand', 2), d=('cfloor', 5),
          e=('sand', 4), f=('sand', 5), g=('sand', 6))


def G(rows, lg=LS):
    return g(rows, lg)


# ================================================================================================ 바닥
# 이음 규칙(칸 경계): 모든 칸에서 가로 줄눈 줄은 같은 자리(A1 7·15 / A2 4·9·15), 세로 이음은 2~13열에만 →
# 경계 0·15열은 언제나 판석 몸통이라 어느 칸끼리 붙어도 판석이 경계를 건너 이어진다.
F1 = [
    [   # A1-0
        'eeeeefeecbeeeeee',
        'ddedddddcbeddddd',
        'dddddcddcbeddedd',
        'dddcddddcbedddcd',
        'ddcdddddcbeddcdd',
        'dddddeddcbeddded',
        'cccccccccbdccccc',
        'bbbbdbbbbbabbbbb',
        'eeecbeeeeeecbeee',
        'dddcbedddddcbedd',
        'dddcbedcdddcbedd',
        'dddcbeddddecbedd',
        'ddecbeddcddcbedd',
        'dddcbedddcdcbedd',
        'ccccbdccccccbdcc',
        'bbdbbbbbabbbbbdb',
    ],
    [   # A1-1  가운데 밝은 판석
        'eecbeeeeeecbeeee',
        'ddcbeddddecbeddd',
        'ddcbedeeddcbeddd',
        'ddcbeddeedcbedcd',
        'ddcbeddddecbeddd',
        'ddcbeddddecbedde',
        'cccbdccccccbdccc',
        'bbbabbbbbbbbdbbb',
        'eeeeeecbeeeeeeee',
        'ddddddcbedddeddd',
        'dcddddcbeddddddd',
        'ddddddcbedddcddd',
        'dddeddcbeddddddd',
        'ddddddcbeddddcdd',
        'cccccccbdccccccc',
        'bbbbdbbbbbbbbabb',
    ],
    [   # A1-2  금 간 판석 + 패인 곳에 모래
        'eeeeecbeeeeeeeee',
        'dddedcbedddddddd',
        'dddddcbeddcddddd',
        'dddddcbedddcdddd',
        'ddcddcbeddddcddd',
        'dddddcbedddddcdd',
        'ccccccbdcccccccc',
        'bbbbbbbbbdbbbbbb',
        'eecbeeeeecbeeeee',
        'ddcbedddddcbedddd'[:16],
        'ddcbeddedcbedddd',
        'ddcbedfedcbedddd',
        'ddcbeefedcbeddcd',
        'ddcbeddddcbedddd',
        'cccbdccccbdccccc',
        'bdbbbbbbbbbbbbbb',
    ],
    [   # A1-3  닳은 가운데
        'eeecbeeeeeecbeee',
        'dddcbedddddcbedd',
        'dddcbedddddcbedd',
        'dcdcbedcdddcbedd',
        'dddcbeddddecbedd',
        'dddcbedddddcbede',
        'ccccbdccccccbdcc',
        'bbbbbbbdbbbbbbbb',
        'eeeeeeeecbeeeeee',
        'ddddddddcbeddddd',
        'ddcdddddcbedddcd',
        'dddddeddcbeddddd',
        'ddddddddcbedcddd',
        'dedddddccbeddddd',
        'cccccccccbdccccc',
        'bbbbbbbbbbbbadbb',
    ],
]
F2 = [
    [   # A2-0  이음 모서리에 모래 한 줌
        'eeeecbeeeecbeeee',
        'ddcdcbedcdcbeddd',
        'ddddcbedddcbedcd',
        'cccccbdccccbdccc',
        'bbbbbbdedbbbbbbb',
        'eecbeedfdbeeeeee',
        'ddcbedeecbeddcdd',
        'ddcbedcdcbeddddd',
        'cccbdccccbdccccc',
        'bbbbbbbbbbbbebbb',
        'eeeeeecbeeeecbee',
        'ddddddcbedddcbed',
        'dcddddcbedcdcbed',
        'ddddcdcbedddcbed',
        'cccccccbdccccbdc',
        'bbabbbbbbbbbbbbb',
    ],
    [   # A2-1  이음을 덮은 모래 더미
        'eecbeeeeecbeeeee',
        'ddcbedcddcbedddd',
        'ddcbeddddcbedcdd',
        'cccbdcccccbdcccc',
        'bbbbbbbbbbbbbbbb',
        'eeeeeecbeeeecbee',
        'ddcdddcbeddccbed',
        'ddddddcbedddcbed',
        'cccccccbdccccbdc',
        'bbbbbbbbbbebbbbb',
        'eeecbeeeecbeeeee',
        'dddcbedddcbedddd',
        'dddcbeddeeffdddd',
        'dddcbedeffffeddd',
        'ccccbdcdeeeedccc',
        'bbbbbbbbddddbbbb',
    ],
    [   # A2-2
        'eeeeeeecbeeeeeee',
        'ddcddddcbeddcddd',
        'dddddcdcbedddddd',
        'ccccccccbdcccccc',
        'bbbbebbbbbbbbbbb',
        'eeecbeeeeeecbeee',
        'dddcbeddddcbeddd',
        'dddcbedcddcbeddd',
        'ccccbdcccccbdccc',
        'bbbbbbbabbbbbbbb',
        'eecbeeeecbeeeeee',
        'ddcbedddcbeddddd',
        'ddcbedcdcbeddcdd',
        'ddcbedddcbedddcd',
        'cccbdccccbdccccc',
        'bbbbbbbbbbbdbbbb',
    ],
    [   # A2-3  모서리 모래
        'eeecbeeeeeecbeee',
        'dddcbeddcddcbedd',
        'dddcbedddddcbedd',
        'ccccbdccccccbdcc',
        'bbbbbbbbbbbbbbbb',
        'eeeeeeeecbeeffee',
        'ddcdddddcbeeffed',
        'ddddddddcbdeeedd',
        'cccccccccbdccccc',
        'bbbbbbbbbbbbbbbb',
        'eeeeecbeeeeecbee',
        'dddddcbedddcbedd',
        'ddcddcbedddcbedd',
        'dddddcbedcdcbedd',
        'ccccccbdccccbdcc',
        'bbbbbbbbbbbbbbab',
    ],
]


def floor_cells(n):
    return [G(c, LS if n == 1 else LS2) for c in (F1 if n == 1 else F2)]


def floor_img(n):
    c = floor_cells(n)
    out = Cv(32, 32)
    for i, cv in enumerate(c):
        out.paste(cv, (i % 2) * T, (i // 2) * T)
    return out


def floor_fn(n):
    return lib.mix_cells(floor_cells(n))


# ================================================================================================ 벽 앞면
# A1: 8줄 켜 여섯(16칸 주기로 이음 0·8열 엇갈림), 맨 윗줄 = 천장 테두리 밑 밝은 턱, 아래로 갈수록 어둡고 맨 밑 3줄 그늘.
M1 = [
    'dddddddddddddddd',   # 0 윗단 — 테두리 밑 턱
    'addddddddddddddb',
    'adcccccccccccccb',
    'adccccbcccccdccb',
    'adcccccccccccccb',
    'adccdccccccbcccb',
    'abbbbbbbbbbbbbbb',
    'aaaaaaaaaaaaaaaa',
    'dddddddbaddddddd',   # 8
    'cccccccbadcccccc',
    'ccccdccbadccccbc',
    'cccccccbadcccccc',
    'ccbccccbadccdccc',
    'cccccccbadcccccc',
    'bbbbbbbbabbbbbbb',
    'aaaaaaaaaaaaaaaa',
    'addddddddddddddb',   # 16 가운데단
    'adcccccccbcccccb',
    'adcccccccccccccb',
    'adccbccccccccdcb',
    'adcccccccccccccb',
    'adcccccdccbccccb',
    'abbbbbbbbbbbbbbb',
    'aaaaaaaaaaaaaaaa',
    'dddddddbaddddddd',   # 24
    'cccccccbadcccccc',
    'cbcccccbadcccccc',
    'cccccccbadccbccc',
    'ccccdccbadcccccc',
    'cccccccbadccccdc',
    'bbbbbbbbabbbbbbb',
    'aaaaaaaaaaaaaaaa',
    'addddddddddddddb',   # 32 아랫단
    'adccccccccccbccb',
    'adcccbcccccccccb',
    'adcccccccdcccccb',
    'adcccccccccccbcb',
    'abbbbbbbbbbbbbbb',
    'aaaaaaaaaaaaaaaa',
    'dddddddbaddddddd',   # 39
    'cccccccbadcccccc',
    'ccbccccbadcccccc',
    'cccccccbadcccbcc',
    'cbcccbcbadcbcccb',
    'bcbbbcbbabbcbbbb',
    'bbbbbbbbabbbbbbb',
    'aaaaaaaaaaaaaaaa',
    'aaaaaaaaaaaaaaaa',
]
# 끝 기둥 줄(왼끝 0·1열, 오른끝 14·15열) — 가운데 칸 위에 찍어 모서리를 둥글게(왼 빛 / 오른 그늘)
E1L = [
    'ed', 'ed', 'ed', 'ed', 'ed', 'ed', 'dc', 'cb',
    'ed', 'ec', 'ec', 'ec', 'ec', 'ec', 'dc', 'cb',
    'ed', 'ed', 'ed', 'ed', 'ed', 'ed', 'dc', 'cb',
    'ed', 'ec', 'ec', 'ec', 'ec', 'ec', 'dc', 'cb',
    'ed', 'ed', 'ed', 'ed', 'ed', 'dc', 'cb', 'ed',
    'ec', 'ec', 'ec', 'ec', 'dc', 'cb', 'ba', 'ba',
]
E1R = [
    'cb', 'cb', 'ba', 'ba', 'ba', 'ba', 'ba', 'aa',
    'cb', 'ba', 'ba', 'ba', 'ba', 'ba', 'ba', 'aa',
    'cb', 'cb', 'ba', 'ba', 'ba', 'ba', 'ba', 'aa',
    'cb', 'ba', 'ba', 'ba', 'ba', 'ba', 'ba', 'aa',
    'cb', 'cb', 'ba', 'ba', 'ba', 'ba', 'aa', 'cb',
    'ba', 'ba', 'ba', 'ba', 'ba', 'aa', 'aa', 'aa',
]

# A2: 5·5·6줄 작은 켜, 이음 자리 제각각, 깨진 모서리, 맨 밑에 모래가 조금 쌓임.
M2 = [
    'ddddbadddddbaddd',   # 0
    'ccccbadcbccbadcc',
    'cbccbadccccbadcc',
    'bbbbbacbbbbbacbb',
    'aaaaaaaaaaaaaaaa',
    'baddddddbadddddd',   # 5
    'badcccbcbadccccc',
    'badcccccbadcccbc',
    'bacbbbbbbacbbbbb',
    'aaaaaaaaaaaaaaaa',
    'dddddbadddddbadd',   # 10
    'cccccbadcbccbadc',
    'cbcccbadccccbadc',
    'cccccbadcccbbadc',
    'cccccbadccccbadc',
    'bbbbbbacbbbbbacb',
    'aaaaaaaaaaaaaaaa',   # 16 가운데단
    'ddbaddddddbadddd',
    'ccbadcccbcbadccc',
    'bbbacbbbbbbacbbb',
    'aaaaaaaaaaaaaaaa',
    'dddddddbadddddba',   # 21
    'dccbcccbadccccba',
    'dccccccbadcbccba',
    'cbbbbbbbacbbbbba',
    'aaaaaaaaaaaaaaaa',
    'dddbaddddddbaddd',   # 26
    'cccbadcccbcbadcc',
    'cbcbadcccccbadcc',
    'cccbadccccbbadcc',
    'bbbbacbbbbbbacbb',
    'aaaaaaaaaaaaaaaa',
    'adddddbadddddddb',   # 32 아랫단
    'adcbccbadccccbcb',
    'adccccbadcbccccb',
    'acbbbbbacbbbbbbb',
    'aaaaaaaaaaaaaaaa',
    'ccccbacccccccbac',   # 37
    'bbbbbacbbbbbbbac',
    'bcbbbacbbbcbbbac',
    'bbbbbacbbbbbbbac',
    'aaaaaaaaaaaaaaaa',
    'cbacccccccbacccc',   # 42
    'bbacbbbbbbbacbbb',
    'bbacbbcbbbbacbbb',
    'aaaaaaaaaaaaaaaa',
    'aaaaaaaaaaaaaaaa',
    'aaaaaaaaaaaaaaaa',
]
E2L = [
    'ed', 'ec', 'ec', 'dc', 'ca',
    'ed', 'ec', 'ec', 'dc', 'ca',
    'ed', 'ec', 'ec', 'ec', 'ec', 'dc',
    'ca', 'ed', 'ec', 'dc', 'ca',
    'ed', 'ec', 'ec', 'dc', 'ca',
    'ed', 'ec', 'ec', 'ec', 'dc', 'ca',
    'dc', 'dc', 'dc', 'cb', 'ba',
    'dc', 'cb', 'cb', 'cb', 'ba',
    'cb', 'cb', 'cb', 'ba', 'aa', 'aa',
]
E2R = [
    'ba', 'ba', 'ba', 'ba', 'aa',
    'ba', 'ba', 'ba', 'ba', 'aa',
    'ba', 'ba', 'ba', 'ba', 'ba', 'ba',
    'aa', 'ba', 'ba', 'ba', 'aa',
    'ba', 'ba', 'ba', 'ba', 'aa',
    'ba', 'ba', 'ba', 'ba', 'ba', 'aa',
    'ba', 'ba', 'ba', 'ba', 'aa',
    'ba', 'ba', 'ba', 'ba', 'aa',
    'ba', 'ba', 'ba', 'aa', 'aa', 'aa',
]

# ------------------------------------------------------------------------------------------------ 새김(상형 그림, 글자 아님)
# A1 액자 판: 한 칸 전체가 큰 판석 하나, 테 안쪽에 그림을 파 새김(파인 선 a, 그 아래·오른쪽 빛 받는 턱 d/e).
PANEL1 = [
    'addddddddddddddb',
    'adeeeeeeeeeeeecb',
    'adeccccccccccdcb',
    'adecccccccccdcab',
    'adecccccccccccab',
    'adecccccccccccab',
    'adecccccccccccab',
    'adecccccccccccab',
    'adecccccccccccab',
    'adecccccccccccab',
    'adecccccccccccab',
    'adecccccccccccab',
    'adecccccccccccab',
    'adebbbbbbbbbbbab',
    'abaaaaaaaaaaaaaa',
    'aaaaaaaaaaaaaaaa',
]
EYE = [        # 눈(호루스의 눈 모양 그림) 10×9
    'aaaaaaaa..',
    'dddddddd..',
    '..aaaaa...',
    '.a.dbbaa..',
    'a..bbbb.aa',
    '.a.dbba.dd',
    '..aaaaa...',
    '...a.dad..',
    '..ad...aa.',
]
FALCON = [     # 매(옆모습, 서 있음) 9×10
    '...aa....',
    '..aaad...',
    '..aaa....',
    '...aaa...',
    '..aaaaa..',
    '..aaaaaa.',
    '..aaaaaaa',
    '...aaad.a',
    '...a.a...',
    '..ad.ad..',
]
WAVES = [      # 물결 띠(가로 반복 16) — 아랫단 변형 새김
    'eeeeeeeeeeeeeeee',
    'baaaaaaaaaaaaaaa',
    'cccccccccccccccc',
    'ccaacccccaacccca',
    'cadcacccadcaccad',
    'adcccacadcccacad',
    'dcccccadcccccadc',
    'cccccccccccccccc',
    'aaaaaaaaaaaaaaaa',
    'dddddddddddddddd',
]

# A2 가로 띠: 2~13줄 홈 띠가 칸을 가로질러(이웃 새김 칸과 이어진다), 띠 안에 그림을 도드라지게(d·e) 남김.
BAND2 = [
    'aaaaaaaaaaaaaaaa',
    'dddddddddddddddd',
    'aaaaaaaaaaaaaaaa',
    'bbbbbbbbbbbbbbbb',
    'bbbbbbbbbbbbbbbb',
    'bbbbbbbbbbbbbbbb',
    'bbbbbbbbbbbbbbbb',
    'bbbbbbbbbbbbbbbb',
    'bbbbbbbbbbbbbbbb',
    'bbbbbbbbbbbbbbbb',
    'bbbbbbbbbbbbbbbb',
    'bbbbbbbbbbbbbbbb',
    'dddddddddddddddd',
    'aaaaaaaaaaaaaaaa',
    'cccccccccccccccc',
    'aaaaaaaaaaaaaaaa',
]
SUNDISC = [    # 날개 단 해 원반 14×7
    '.....eee......',
    '....eeeed.....',
    'eeeeeeeeddeeee',
    '.dddeeeedddddd',
    '..dd.eedd.dd..',
    '......dd......',
    '..............',
]
STAFF = [      # 고리 지팡이(앵크 닮은 그림) + 물결 13×8
    '...ee........',
    '..e.de.......',
    '..e.dc..e.e.e',
    '.eeeddcdcdcdc',
    '...ed........',
    '...ed..e.e.e.',
    '...ed.dcdcdcd',
    '...dc........',
]

# A2 아랫단 변형: 벽 밑에 모래가 쌓여 아래 켜를 덮음(이음 위로 흘러내림). 가로 반복 16.
DRIFT2 = [
    '................',
    '................',
    '................',
    '................',
    '..........ff....',
    '.........feef...',
    '...fff..feeeef..',
    'fffeeeffeeeeeeff',
    'eeeeeeeeeeeeeeee',
    'eeddeeeeedddeeee',
    'deeeeddeeeeeddde',
    'dddddddddddddddd',
]
DRIFT2_L = [   # 왼끝 — 모래가 모서리에서 더 높이
    '................',
    '.ff.............',
    'feeff...........',
    'eeeeef..........',
    'eedeeeff........',
    'eeeeeeeef.......',
    'deeeddeeeeff....',
    'eeeeeeeeeeeeffff',
    'eeeeeeeeeeeeeeee',
    'eeddeeeeedddeeee',
    'deeeeddeeeeeddde',
    'dddddddddddddddd',
]
# A1 금 간 돌(가운데단 변형): 가운데 큰 돌에 금 — M1 16~31줄 위에 찍는다
CRACK1 = [
    '................',
    '................',
    '.......b........',
    '.......cb.......',
    '........cb......',
    '.......bcd......',
    '......b.........',
    '................',
    '................',
    '...........b....',
    '..........bd....',
    '...........b....',
    '................',
    '................',
    '................',
    '................',
]
CRACK2 = [
    '................',
    '................',
    '....cb..........',
    '.....cb.........',
    '................',
    '..........ab....',
    '.........abd....',
    '..........d.....',
    '................',
    '................',
    '..............b.',
    '...b.........bd.',
    '..bd............',
    '................',
    '................',
    '................',
]


def _cols(mid, el, er):
    """가운데 행 목록 + 끝 기둥 줄 → (왼끝, 가운데, 오른끝) 행 목록."""
    left = [e + m[2:] for m, e in zip(mid, el)]
    right = [m[:14] + e for m, e in zip(mid, er)]
    return left, mid, right


def _kit(rows3, lg):
    l, m, r = rows3
    return hcat(G(l, lg), G(m, lg), G(r, lg))


class FaceSet:
    def __init__(s, n):
        lg = LF1 if n == 1 else LF2
        M, EL, ER = (M1, E1L, E1R) if n == 1 else (M2, E2L, E2R)
        two = list(range(16)) + list(range(32, 48))
        s.face3 = _kit(_cols(M, EL, ER), lg)
        s.face2 = _kit(_cols([M[i] for i in two], [EL[i] for i in two], [ER[i] for i in two]), lg)
        s.lg = lg
        if n == 1:
            mid = G(M, lg)
            panel = Cv(16, 16)
            panel.a[:] = G(PANEL1, lg).a
            p3 = Cv(16, 16)
            p3.a[:] = panel.a
            stamp(p3, EYE, lg, 3, 3)
            p2 = Cv(16, 16)
            p2.a[:] = panel.a
            stamp(p2, FALCON, lg, 4, 2)
            s.glyph3 = vcat(mid.crop(0, 0, 16, 16), p3, mid.crop(0, 32, 16, 16))
            s.glyph2 = vcat(p2, mid.crop(0, 32, 16, 16))
            bot = _cols(M[32:48], EL[32:48], ER[32:48])
            cells = [G(r, lg) for r in bot]
            for c in cells:
                stamp(c, WAVES, lg, 0, 3)
            stamp(cells[0], ['e', 'd', 'c', 'c', 'c', 'c', 'c', 'c', 'b', 'd'], lg, 0, 3)
            stamp(cells[0], ['d', 'c', 'c', 'c', 'c', 'c', 'c', 'c', 'b', 'c'], lg, 1, 3)
            stamp(cells[2], ['b', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'b'], lg, 15, 3)
            s.base3 = hcat(*cells)
            alt = G(M[16:32], lg)
            stamp(alt, CRACK1, lg, 0, 0)
            s.alt3 = alt
        else:
            mid = G(M, lg)
            b = G(BAND2, lg)
            p3 = mid.crop(0, 16, 16, 16)
            p3.paste(b.crop(0, 0, 16, 16), 0, 0)
            stamp(p3, SUNDISC, lg, 1, 4)
            p2 = mid.crop(0, 0, 16, 16)
            p2.paste(b.crop(0, 0, 16, 16), 0, 0)
            stamp(p2, STAFF, lg, 2, 4)
            s.glyph3 = vcat(mid.crop(0, 0, 16, 16), p3, mid.crop(0, 32, 16, 16))
            s.glyph2 = vcat(p2, mid.crop(0, 32, 16, 16))
            bot = _cols(M[32:48], EL[32:48], ER[32:48])
            cells = [G(r, lg) for r in bot]
            stamp(cells[0], DRIFT2_L, LS2, 0, 4)
            stamp(cells[1], DRIFT2, LS2, 0, 4)
            stamp(cells[2], DRIFT2, LS2, 0, 4)
            s.base3 = hcat(*cells)
            alt = G(M[16:32], lg)
            stamp(alt, CRACK2, lg, 0, 0)
            s.alt3 = alt

    def image(s):
        out = Cv(128, 48)
        out.paste(s.face3, 0, 0)
        out.paste(s.face2, 48, 0)
        out.paste(s.base3, 48, 32)
        out.paste(s.glyph3, 96, 0)
        out.paste(s.glyph2, 112, 0)
        out.paste(s.alt3, 112, 32)
        return out


# ================================================================================================ 천장 테두리(47)
# 몸통 = 어둠(void 0~2 손 무늬). 띠 8줄: 바깥 턱(f, 바닥·앞면에 닿는 쪽) → 사암 윗면 → 안쪽 그늘(c) → 어둠 쪽 가장자리(b).
BODY1 = [
    'xxxxxxxxxxxxxxxx',
    'xxxxxyxxxxxxxxxx',
    'xxxxxxxxxxxxxyxx',
    'xxyxxxxxxxxxxxxx',
    'xxxxxxxxyxxxxxxx',
    'xxxxxxxxxxxxxxxx',
    'xxxxxxxxxxxzxxxx',
    'xyxxxxxxxxxxxxxx',
    'xxxxxxyxxxxxxxxx',
    'xxxxxxxxxxxxxxyx',
    'xxxxxxxxxxxxxxxx',
    'xxxzxxxxxxyxxxxx',
    'xxxxxxxxxxxxxxxx',
    'xxxxxxxxxxxxxxxx',
    'xxxxxxxyxxxxxxxx',
    'xxxxxxxxxxxxxyxx',
]
N1 = [
    'ffffffffffffffff',
    'eeefeeeeeeefeeee',
    'eeecedeeeeeceede',
    'edecee eeedeceeee'.replace(' ', '')[:16],
    'eeeceeeeeeecdeee',
    'ddddddddddddddd d'.replace(' ', '')[:16],
    'cccccccccccccccc',
    'bbbbbbbbbbbbbbbb',
]
# 왼 띠는 위 띠를 돌려 그린 손 조각(가로 이음 3·11줄)
W1 = [
    'feeeedcb',
    'feeeedcb',
    'fedeedcb',
    'fccccdcb',
    'feeeedcb',
    'feedeccb',
    'feeeedcb',
    'feeeedcb',
    'feeeedcb',
    'feeedccb',
    'feeeedcb',
    'fccccdcb',
    'fefeedcb',
    'feeeedcb',
    'feeedecb',
    'feeeedcb',
]
ON1 = [        # 바깥 모서리 NW
    'efffffff',
    'feeeeeee',
    'feeedeee',
    'feeeeeee',
    'fedeeeee',
    'feeeeedd',
    'feeeedcc',
    'feeedccb',
]
IN1 = [        # 안 모서리 NW
    'feeeedcb',
    'eeeeedcb',
    'eedeedcb',
    'eeeeedcb',
    'eeeeedcb',
    'dddddddb',
    'cccccccb',
    'bbbbbbbb',
]

BODY2 = [
    'yxxxxxxxyyxxxxxx',
    'xxxxzxxxxxxxxxyx',
    'xxxxxxxxxxyxxxxx',
    'xyxxxxxxxxxxxxxx',
    'xxxxxxxyxxxxzxxx',
    'xxxxxxxxxxxxxxxx',
    'xxzxxxxxxyxxxxxy',
    'xxxxxxxxxxxxxxxx',
    'xxxxxyxxxxxxyxxx',
    'xyxxxxxxxxxxxxxx',
    'xxxxxxxxxzxxxxxx',
    'xxxxxxxxxxxxxxyx',
    'yxxxyxxxxxxxxxxx',
    'xxxxxxxxxxxyxxxx',
    'xxxxxxzxxxxxxxxx',
    'xxyxxxxxxxxxxxxx',
]
N2 = [         # 두 켜 띠: 턱 e · 윗 켜(작은 돌, 이음 2·10) · 줄눈 a · 아랫 켜(이음 6·14) · 안쪽 가장자리 a
    'eeeeeeeeeeeeeeee',
    'ffbfffeffffbffef',
    'edbdeeeeedbdeede',
    'ddbdddcdddbddddc',
    'bbbbbbbbbbbbbbbb',
    'eeeeeebfeeeeeebf',
    'dcddddbdddcdddbd',
    'bbbbbbbbbbbbbbbb',
]
W2 = [
    'efedbedb',
    'efdcbdcb',
    'efddbddb',
    'eeddbddb',
    'efdcbddb',
    'efddbbbb',
    'bbbbbfeb',
    'efddbedb',
    'efddbdcb',
    'eeddbddb',
    'efdcbddb',
    'efddbddb',
    'efddbdbb',
    'efddbbbb',
    'bbbbbfeb',
    'efddbedb',
]
ON2 = [
    'deeeeeee',
    'eeffffbf',
    'efddedbd',
    'efdddddd',
    'efddbbbb',
    'efddbeee',
    'efddbdcd',
    'eeddbdcb',
]
IN2 = [
    'efddbedb',
    'efddbddb',
    'efddbdcb',
    'eeddbddb',
    'bbbbbbbb',
    'eeeebeeb',
    'ddcdbddb',
    'bbbbbbbb',
]


def _rot_pieces(Nrows, Wrows, ONrows, INrows, lg):
    """손으로 그린 N·W 띠와 NW 모서리에서 S·E·나머지 모서리를 뒤집어 얻는다(빛 방향이 아닌 두께 띠라 거울로 충분)."""
    vflip = lambda rs: rs[::-1]  # noqa: E731
    hflip = lambda rs: [r[::-1] for r in rs]  # noqa: E731
    edge = {'N': G(Nrows, lg), 'S': G(vflip(Nrows), lg), 'W': G(Wrows, lg), 'E': G(hflip(Wrows), lg)}
    outer = {'NW': G(ONrows, lg), 'NE': G(hflip(ONrows), lg), 'SW': G(vflip(ONrows), lg), 'SE': G(vflip(hflip(ONrows)), lg)}
    inner = {'NW': G(INrows, lg), 'NE': G(hflip(INrows), lg), 'SW': G(vflip(INrows), lg), 'SE': G(vflip(hflip(INrows)), lg)}
    return edge, outer, inner


def rim_at(n):
    if n == 1:
        lg = LS
        edge, outer, inner = _rot_pieces(N1, W1, ON1, IN1, lg)
        return dot.Autotile(G(BODY1, lg), edge, outer, inner)
    lg = LS2
    edge, outer, inner = _rot_pieces(N2, W2, ON2, IN2, lg)
    return dot.Autotile(G(BODY2, lg), edge, outer, inner)


# ================================================================================================ 방 그리기(형제 작업자용)
_FACES = {}


def face_set(n):
    if n not in _FACES:
        _FACES[n] = FaceSet(n)
    return _FACES[n]


def _wall_cells(plan):
    """lib.rooms_render 와 같은 규칙으로 벽 앞면 칸 {(x, y): (b, h)} — 새김 칸을 고르려고."""
    H, W = len(plan), len(plan[0])
    walk = lambda x, y: 0 <= x < W and 0 <= y < H and plan[y][x] != '#'  # noqa: E731
    wallB = {}
    for y in range(H):
        for x in range(W):
            if not walk(x, y) or walk(x, y - 1):
                continue
            run = 0
            while y - 1 - run >= 0 and not walk(x, y - 1 - run) and run < 4:
                run += 1
            h = min(3, 3 if run >= 4 else run - 1)
            for b in range(h):
                wallB[(x, y - 1 - b)] = (b, h)
    return wallB


def pyramid_room(plan, n=1, glyphs=True):
    """plan(행 문자열: '#' 막힘 · 그 밖 바닥) → 피라미드 방 그림 Cv. n=1 → A1 세트, n=2 → A2 세트.
    벽 가운데 칸 몇 곳(칸 해시)에 새김 칸·금 간 돌·아랫단 변형을 섞는다."""
    fs = face_set(n)
    out = lib.rooms_render(plan, rim_at(n), fs.face3, fs.face2, floor_fn(n))
    if not glyphs:
        return out
    wall = _wall_cells(plan)
    used = set()
    for (x, y), (b, h) in sorted(wall.items(), key=lambda kv: (kv[0][1], kv[0][0])):
        if b != 0:
            continue
        l = (x - 1, y) in wall and wall[(x - 1, y)][0] == 0
        r = (x + 1, y) in wall and wall[(x + 1, y)][0] == 0
        if not (l and r):
            continue
        hv = dot.cell_hash(x, y) % 7
        top = y - (h - 1)
        if hv == 0 and (x - 1, y) not in used:     # 새김 기둥(이웃끼리 붙지 않게)
            used.add((x, y))
            col = fs.glyph3 if h == 3 else fs.glyph2
            out.paste(col, x * T, top * T)
        elif hv == 3 and h == 3:
            out.paste(fs.alt3, x * T, (top + 1) * T)
        elif hv in (1, 5) and h == 3:
            out.paste(fs.base3.crop(T, 0, T, T), x * T, y * T)
    return out


# 바닥 2×2(같은 번호 바닥 0~3칸) 위에 구덩이 테두리(정지) + 모래 면(장면마다 움직임).
# 테두리: 북쪽 안벽(남향 앞면, 사암 켜 어둡게)이 보이고, 서쪽 안벽 그늘 a · 동쪽 안벽 빛 d, 남쪽 가장자리 = 빛 받는 판석 턱(e·f).
# 'o' = 모래 면 자리(장면 조각 24×18 을 x4 y9 에 찍어 덮는다 — 덮이지 않으면 오류).
PIT1 = [
    '................................',
    '................................',
    '................................',
    '...........bbbbbbbbbb...........',
    '........bbbccccccccccbbb........',
    '......bbcccbbbabbbabbcccbb......',
    '.....bccbbabbbbbabbbbabbccb.....',
    '....babbabbbbbbabbbbbbabbbcb....',
    '...baaaaaaaaaaaaaaaaaaaaaaacb...',
    '...baoooooooooooooooooooooodc...',
    '...baoooooooooooooooooooooodc...',
    '...baoooooooooooooooooooooodc...',
    '...baoooooooooooooooooooooodc...',
    '...baoooooooooooooooooooooodc...',
    '...baoooooooooooooooooooooodc...',
    '...baoooooooooooooooooooooodc...',
    '...baoooooooooooooooooooooodc...',
    '...baoooooooooooooooooooooodc...',
    '...baoooooooooooooooooooooodc...',
    '...baoooooooooooooooooooooodc...',
    '...baoooooooooooooooooooooodc...',
    '...baoooooooooooooooooooooodc...',
    '...cooooooooooooooooooooooood...',
    '....dooooooooooooooooooooooe....',
    '.....eooooooooooooooooooooe.....',
    '......eooooooooooooooooooe......',
    '.......efoooooooooooooofe.......',
    '.........eeffffffffffee.........',
    '................................',
    '................................',
    '................................',
    '................................',
]
# A2 테두리: 판석이 깨져 들쭉날쭉, 틈(금)이 바닥으로 뻗는다.
PIT2 = [
    '................................',
    '................................',
    '.........c..........cb..........',
    '.........cbbbbbbbbbbbbc.........',
    '........bbcccccbccccccbbb.......',
    '......bbcccbbbabbbabbccccbb.c...',
    '.....bccbbabbbbbabbbbabbccbcb...',
    '....babbabbbbbbabbbbbbabbbcb....',
    '...baaaaaaaaaaaaaaaaaaaaaaacb...',
    '...baoooooooooooooooooooooodc...',
    '...baoooooooooooooooooooooodc...',
    '..cbaoooooooooooooooooooooodc...',
    '..bbaoooooooooooooooooooooodcc..',
    '...baoooooooooooooooooooooodc...',
    '...baoooooooooooooooooooooodcb..',
    '...baoooooooooooooooooooooodc...',
    '...baoooooooooooooooooooooodc...',
    '..cbaoooooooooooooooooooooodc...',
    '...baoooooooooooooooooooooodc...',
    '...baoooooooooooooooooooooodc...',
    '...baoooooooooooooooooooooodc...',
    '...baooooooooooooooooooooooddc..',
    '...cooooooooooooooooooooooood...',
    '....dooooooooooooooooooooooe....',
    '.....eooooooooooooooooooooe.....',
    '......eooooooooooooooooooe......',
    '.......efoooooooooooooofe.......',
    '........deeffff.ffffffee........',
    '.......c...................c....',
    '......cb...................bc...',
    '.....c......................b...',
    '................................',
]
# A1 모래 면: 세 팔 소용돌이(홈 c · 빛 마루 f · 북쪽 그늘 d · 가운데 깔때기 a/b), 장면마다 40° 돈다.
SWIRL1 = [
    [
        '.dddddddddddddddddddddd.',
        '.dddddccccccccddddddddd.',
        '.dddddddddddddcccdddddd.',
        '.deeeeeeeeeeeeffcceeeee.',
        '.deeeeeccccceeeefcceeee.',
        '.eeeecccffffcceeefceeee.',
        '.eeeccffeeeefcceeeceeee.',
        '.eeccfeeecceefceeeceeee.',
        '.eecfeecccbaabceeeceeee.',
        '.ecfeeecffbaabfeeeceeee.',
        '.eceeeeceeeceeeeccfeeec.',
        '.eceeeeceeeccccccfeeecc.',
        '.ecceeecceeffffffeeeccf.',
        'eefceeefcceeeeeeeeeccfee',
        '.eecceeeffcccceccccffee.',
        '..efcceeeefffccffffeee..',
        '...effceeeeeeffeeeeee...',
        '.....efeeeeeeeeeeee.....',
    ],
    [
        '.ddddddddddddccdddddddd.',
        '.ddddddddddddddccdddddd.',
        '.ddddddddddddddddccdddd.',
        '.deeeeecccccceeeefcceee.',
        '.deeeccfffffccceeefceee.',
        '.eeccffeeeeeffcceeefcee.',
        '.eccfeeeecceeefceeeecee.',
        '.ccfeeeccffceeeceeeecee.',
        '.cfeeecffebaabeceeeecee.',
        '.ceeecceeebaabcceeeccee.',
        '.ceeecfeeeceeeffeeccfee.',
        '.ceeeceeeecceeeeeccfeee.',
        '.feeefceeefcccccccfeeee.',
        'eeeeeecceeefffffffeeeeee',
        '.eeeeefcceeeeeeeeeeecee.',
        '..eeeeeffccceeeeccccfe..',
        '...eeeeeefffcccccfffe...',
        '.....eeeeeeefffffee.....',
    ],
    [
        '.dddddddddddddddddddddd.',
        '.dddddddddddddddddddddd.',
        '.ddddcccccccccddddddddd.',
        '.deeccfffffffccceeeecee.',
        '.dccffeeeeeeeffcceeefce.',
        '.ccfeeeecccceeefcceeece.',
        '.cfeeecccffcceeefceeefc.',
        '.feeeccffeeffceeeceeeec.',
        '.eeecffeecbaabeeeceeecc.',
        '.eeeceeeccbaabeecfeeecf.',
        '.eeeceeecfeeecccfeeecce.',
        '.eeeceeecceeefffeeeccfe.',
        '.eeeceeefcceeeeeeeccfee.',
        'eeeefceeefcccccccccfeeee',
        '.eeeecceeefffffffffeeee.',
        '..eeefcceeeeeeeeeeeeee..',
        '...eeeffccceeeeeeeeee...',
        '.....eeefffccceeeee.....',
    ],
]
# A2 모래 면: 동심 물결 고리(북쪽 홈 c, 남쪽 빛 f)가 장면마다 한 칸씩 안으로 좁혀 든다.
RINGS2 = [
    [
        '.dddcddddddddddddddcddd.',
        '.dcddddddddddddddddddcd.',
        '.cddddddcccddcccddddddc.',
        '.eeeedceeeeeeeeeecdeeee.',
        '.eeecceeeeeeeeeeeecceee.',
        '.eecceeeddccccddeeeccee.',
        '.edceeedceeeeeecdeeecde.',
        '.eceeedceeeeeeeecdeeece.',
        '.eceeedceebaabeecdeeece.',
        '.edeeefdeebaabeedfeeede.',
        '.edeeefdeeeeeeeedfeeede.',
        '.efdeeefdeeeeeedfeeedfe.',
        '.eeddeeeffddddffeeeddee.',
        'eeeeddeeeeeeeeeeeeddeeee',
        '.eeeefdeeeeeeeeeedfeeee.',
        '..eeeeefdddeedddfeeeee..',
        '...eeeeeeeffffeeeeeee...',
        '.....eeeeeeeeeeeeee.....',
    ],
    [
        '.ddddddccddddddccdddddd.',
        '.dddccddddddddddddccddd.',
        '.ddcddddddddddddddddcdd.',
        '.dceeeedccccccccdeeeecd.',
        '.ceeeecceeeeeeeecceeeec.',
        '.eeedceeeeeeeeeeeecdeee.',
        '.eeeceeeedccccdeeeeceee.',
        '.eedceeedceeeecdeeecdee.',
        '.eedceeecebaabeceeecdee.',
        '.eefdeeedebaabedeeedfee.',
        '.eefdeeefdeeeedfeeedfee.',
        '.eeedeeeefddddfeeeedeee.',
        '.eeefdeeeeeeeeeeeedfeee.',
        'fdeeeeddeeeeeeeeddeeeedf',
        '.fdeeeefddddddddfeeeedf.',
        '..fdeeeeeeeffeeeeeeedf..',
        '...fddeeeeeeeeeeeeddf...',
        '.....ffddeeeeeeddff.....',
    ],
    [
        '.ccddddddddddddddddddcc.',
        '.ddddddcccddddcccdddddd.',
        '.ddddccddddddddddccdddd.',
        '.eedceeeeeeeeeeeeeecdee.',
        '.edceeeedccccccdeeeecde.',
        '.dceeedceeeeeeeecdeeecd.',
        '.ceeedceeeeeeeeeecdeeec.',
        '.ceeedeeeedccdeeeedeeec.',
        '.ceeeceeedbaabdeeeceeec.',
        '.deeedeeefbaabfeeedeeed.',
        '.deeefeeeefddfeeeefeeed.',
        '.deeefdeeeeeeeeeedfeeed.',
        '.fdeeefdeeeeeeeedfeeedf.',
        'eefdeeeefddddddfeeeedfee',
        '.eefdeeeeeeeeeeeeeedfee.',
        '..eefddeeeeeeeeeeddfee..',
        '...eeefdddeeeedddfeee...',
        '.....eeeeffffffeeee.....',
    ],
]


def trap_frames(n):
    lg = LS if n == 1 else LS2
    pit = PIT1 if n == 1 else PIT2
    sands = SWIRL1 if n == 1 else RINGS2
    out = []
    for sw in sands:
        f = floor_img(n)
        stamp(f, [r.replace('o', '.') for r in pit], lg, 0, 0)
        stamp(f, sw, lg, 4, 9)
        for y, row in enumerate(pit):     # 모래 면이 구덩이 자리를 빠짐없이 덮는지
            for x, ch in enumerate(row):
                if ch == 'o':
                    assert sw[y - 9][x - 4] != '.', ('모래 면 빈 곳', n, x, y)
        out.append(f)
    return out


# ================================================================================================ 장면
ROOM = [
    '##########',
    '##########',
    '##########',
    '##########',
    '##......##',
    '#........#',
    '#........#',
    '##########',
]
TEST = [
    '########################',
    '########################',
    '########################',
    '########################',
    '##......#######.......##',
    '##......#######.......##',
    '##....................##',
    '##......#######..##...##',
    '###..###########.##...##',
    '###..###########.##...##',
    '###..###########......##',
    '###..###################',
    '###..###################',
    '###..###################',
    '###.........#######...##',
    '###.........#######...##',
    '###..................###',
    '###......###########.###',
    '###......###########.###',
    '########################',
]


def room_scene(n, plan=ROOM, actor=(4, 5), who=0):
    cv = pyramid_room(plan, n)
    lib.put_actor(cv, actor[0], actor[1], who)
    return cv


def mk_floor(n):
    def run():
        img = floor_img(n)
        cells = floor_cells(n)
        e, i = lib.seam_score(cells)
        meta = {'kind': 'tile', 'vignette': room_scene(n),
                'extras': [(f'mix 6x6 seam {e:.1f}/{i:.1f}', lib.tile_fill(6, 6, lib.mix_cells(cells)), 3),
                           ('test map', pyramid_room(TEST, n), 1)]}
        return img, meta
    return run


def mk_face(n):
    def run():
        fs = face_set(n)
        img = fs.image()
        parts = {'face3h': fs.face3, 'face2h': fs.face2, 'base3h': fs.base3, 'glyph3h': fs.glyph3,
                 'glyph2h': fs.glyph2, 'alt3h': fs.alt3}
        plain = pyramid_room(ROOM, n, glyphs=False)
        wall = lib.hcat(fs.face3.crop(0, 0, 16, 48), fs.face3.crop(16, 0, 16, 48), fs.glyph3, fs.face3.crop(16, 0, 16, 48),
                        fs.alt3 and vcat(fs.face3.crop(16, 0, 16, 16), fs.alt3, fs.base3.crop(16, 0, 16, 16)),
                        fs.face3.crop(16, 0, 16, 48), fs.face3.crop(32, 0, 16, 48))
        meta = {'kind': 'tile', 'parts': parts, 'vignette': room_scene(n),
                'extras': [('wall run 3h', wall, 3), ('plain room', plain, 2), ('test map', pyramid_room(TEST, n), 1)]}
        return img, meta
    return run


def mk_rim(n):
    def run():
        at = rim_at(n)
        img = lib.atlas47(at)
        meta = {'kind': 'autotile', 'autotiles': {'rim': at}, 'vignette': room_scene(n),
                'extras': [('body 6x6', dot.mosaic(at, 6, 6), 3), ('test map', pyramid_room(TEST, n), 1)]}
        return img, meta
    return run


TRAP_PLAN = [
    '##########',
    '##########',
    '##########',
    '##########',
    '##......##',
    '#........#',
    '#........#',
    '#........#',
    '##########',
]


def mk_trap(n):
    def run():
        fr = trap_frames(n)
        img = hcat(*fr)
        base = pyramid_room(TRAP_PLAN, n)
        anim = []
        for f in fr:
            sc = lib.on(base, (f, 4 * T, 5 * T))
            lib.put_actor(sc, 2, 6)
            anim.append(sc)
        meta = {'kind': 'tile', 'parts': {f'frame{i + 1}': f for i, f in enumerate(fr)}, 'anim': anim,
                'vignette': anim[0], 'extras': [('frames 3x', lib.frames_strip(fr), 3)]}
        return img, meta
    return run


FNS = {
    'tc.pyr_floor': {'A1': mk_floor(1), 'A2': mk_floor(2)},
    'tc.pyr_face': {'A1': mk_face(1), 'A2': mk_face(2)},
    'tc.pyr_rim': {'A1': mk_rim(1), 'A2': mk_rim(2)},
    'tc.pyr_sand_trap': {'A1': mk_trap(1), 'A2': mk_trap(2)},
}
NOTES_BY_ITEM = {
    'tc.pyr_floor': {'A1': '큰 매끈 사암 판석(8줄 켜), 밝은 판·어두운 판·금 간 판 섞임, 줄눈에 모래 알갱이',
                     'A2': '거친 작은 켜(5·5·6줄), 깊은 줄눈, 이음 모서리에 모래 더미가 흘러듦'},
    'tc.pyr_face': {'A1': '큰 마름돌 벽(8줄 켜 엇쌓기), 끝 모서리 빛/그늘, 액자 판 새김(눈·매), 아랫단 물결 띠, 금 간 돌',
                    'A2': '거친 작은 켜 벽, 벽을 가로지르는 홈 띠 새김(날개 해 원반·지팡이와 물결), 벽밑 모래 쌓임, 금 간 돌'},
    'tc.pyr_rim': {'A1': '한 겹 매끈 사암 띠(밝은 턱·이음 8칸 주기), 어둠 몸통',
                   'A2': '두 켜 작은 돌 띠(엇갈린 이음), 더 짙은 안쪽 가장자리, 어둠 몸통'},
    'tc.pyr_sand_trap': {'A1': '판석이 둥글게 꺼진 구덩이, 세 팔 모래 소용돌이가 장면마다 돈다',
                         'A2': '깨진 판석 틈 구덩이, 동심 모래 물결 고리가 장면마다 안으로 좁혀 든다'},
}
