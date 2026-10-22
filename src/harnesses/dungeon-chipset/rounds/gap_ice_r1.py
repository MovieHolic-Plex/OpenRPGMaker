"""gap-ice-r1 — 얼음 동굴 두 조각(줄 공통). 항목 gap.ice_floor(얼음 바닥 ↔ 얼음굴 바닥) · gap.ice_rock(얼음 바위 채움: 서리 윗면 + 언 바위 앞면).

조수는 지금 버들항 칩셋으로 얼음 동굴을 아예 못 짓는다(거부한다). 이 판의 두 조각 + 얼음굴 바닥(얼음 바닥 오토타일의 바깥,
meta 'autotiles' 의 ground)으로 얼음 동굴 한 벌이 된다. 얼음은 세 줄 어디에도 속하지 않는 별도 재료라 후보는 A1·A2 두 벌.

  판 6 기법 = 버들항 설원 parts(ground-snow·ground-ice·rock): 한 칸 전체에 아주 가까운 2~3 톤의 잔 얼룩, 같은 자리 특징 없음
  (특징은 변형에만, 자리 제각각). 밝기 = 앞면(가장 어둠) < 바닥(중간) · 바위 윗면 = 서리 모자 덩이(왼·위 흰 모자, 오른·아래 그늘).
  A1 「빙하」 — 바닥 = 다진 눈 회청색(iron 5 + stone 5). 얼음 = 옅은 청록(ice 2) + 밝은 면 + 푸른 금 그물(ice 0).
                벽 윗면 = 둥근 바윗덩이 무더기(흰 서리 모자 rim 6·ice 4, 몸 iron 5·4·3, 그늘 iron 2, 틈 iron 1).
                앞면 = 어두운 청회색 바위(vrock 3 + iron 2 얼룩) + 길이 제각각 세로 균열, 고드름 무리(2·11·4·2px, 사이 틈).
  A2 「청빙」 — 바닥 = 더 어두운 바위 바닥(iron 3 + vrock 4). 얼음 = 짙고 맑은 푸른 얼음(ice 1 + water 3) + 위·아래로 크게
                물결치는 긴 균열(칸 왼·오른 변에서만 이어져 닫힌 칸 없음). 벽 윗면 = 각진 바위 토막 무더기(평평한 서리 윗면·앞 띠·그늘).
                앞면 = 가장 어두운 바위(vrock 2 + iron 1 얼룩) + 세로 균열, 굵은 고드름 하나(12px) + 짧은 둘, 넓은 틈.

모든 화소는 이 파일의 행 문자열·손으로 고른 덧그림 자리·손으로 찍은 금 꼭짓점에서 온다(손 도트). 조립 도구는 cave-r1·edges-r1 것.
  - 틀 = 32×32 기호 틀 + 16×16 안 모서리 + 16×16 몸통. ',' = 그 칸 자리의 얼음굴 바닥 화소, 대문자 결 글자는 칸 좌표 16×16 결 표.
  - 몸통 변형 = 본바탕 + 칸 경계를 넘는 공통 덧그림 + 변형마다 다른 안쪽 덧그림(둘레 밖) — 아무 순서로 붙어도 이어진다.
  - 가장자리 굴곡은 손으로 적은 표(사분면 경계 0). 한 변의 두 토막 모양을 서로 다르게 해 같은 물결이 반복돼 보이지 않게.
  - 3/4: 바위 윗면 → 남쪽 앞면 2단(32px). 옆면 없음. 빛은 왼쪽 위. 먹 윤곽 없이 재질 명암.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dot  # noqa: E402
from cave_r1 import (autotile_cv, carve, check_frame, face_run, floor_frame, frame, hcat,  # noqa: E402
                     poly, strips, variants_sheet, a2_plus)
from edges_r1 import fill, inner4, uni, wobble  # noqa: E402
from dot import Cv, grid, legend  # noqa: E402

WAVE = 'gap'
T = 16


# ================================================================================================ 도구
def sq(rows, w=16, h=16, name=''):
    assert len(rows) == h and all(len(r) == w for r in rows), (name, len(rows), [len(r) for r in rows])
    return rows


def stamp(rows, sprites, wrap=True, inner=False):
    """행 + 손 덧그림 [(행, x, y)] ('.' = 그대로). wrap = 16 주기로 감김. inner = 둘레 1px 안(1~14)에만 — 변형끼리 이어지게."""
    g = [list(r) for r in rows]
    h, w = len(g), len(g[0])
    for sp, x, y in sprites:
        for dy, r in enumerate(sp):
            for dx, ch in enumerate(r):
                if ch == '.':
                    continue
                X, Y = x + dx, y + dy
                if inner:
                    assert 1 <= X <= w - 2 and 1 <= Y <= h - 2, f'안쪽 덧그림 ({X},{Y}) 이 둘레에 닿았다'
                if wrap:
                    X, Y = X % w, Y % h
                g[Y][X] = ch
    return [''.join(r) for r in g]


def body_set(base, common, variants, leg):
    """본몸통 + 변형 — 모두 base + common(칸 경계를 넘어도 됨) 위에 각자의 안쪽 덧그림."""
    root = stamp(base, common)
    return [grid(stamp(root, v, inner=True), leg) for v in variants]


def face_from(mid, left, right, leg):
    """앞면 가운데 16×32(16칸 주기) + 끝 마구리 덧그림 [(행, x, y)](x 0~7 = 마구리 칸 안) → dot.Face."""
    sq(mid, 16, 32, 'face')
    cv = Cv(32, 32)
    p = grid(mid, leg, 16, 32)
    cv.paste(p, 8, 0)
    cv.paste(p.crop(0, 0, 8, 32), 0, 0)
    cv.paste(p.crop(8, 0, 8, 32), 24, 0)
    for ox, sps in ((0, left), (24, right)):
        for sp, x, y in sps:
            for dy, r in enumerate(sp):
                for dx, ch in enumerate(r):
                    if ch != '.':
                        assert 0 <= x + dx < 8, (x, dx)
                        cv.put(ox + x + dx, y + dy, leg[ch])
    return dot.Face(cv)


def col(s):
    return [c for c in s]


def check_wob(p):
    for k, v in p.items():
        assert len(v) == 32 and all(v[i] == 0 for i in (0, 7, 8, 15, 16, 23, 24, 31)), k
    return p


def crack_body(base, paths, kinds, facets=(), ports=None):
    """몸통: 바탕 + 면 덧그림(안쪽) + 손으로 고른 꼭짓점을 잇는 금. paths = [(꼭짓점들, 종류)], kinds = {종류: (금 글자, 위 글자, 아래 글자)}.
    이음 자리(ports)에 걸친 금만 칸 가장자리를 건넌다 — 변형마다 안쪽 길은 달라도 이웃 칸의 금과 이어진다.
    이음 자리 없는 종류(가는 금)는 칸 가장자리에 닿지 않는다."""
    g = [list(r) for r in stamp(base, list(facets), inner=True)]
    marks = []
    allpts = set()
    for pts, kind in paths:
        ps = {(x % 16, y % 16) for x, y in poly(*pts)}
        marks.append((ps, kind))
        allpts |= ps
    if ports is not None:
        edge = {(x, y) for x, y in allpts if x in (0, 15) or y in (0, 15)}
        assert edge <= ports, ('금이 정한 자리 밖에서 칸 가장자리를 건넌다', sorted(edge - ports))
    def near(x, y):
        return min(x, y, 15 - x, 15 - y) <= 2
    for ps, kind in marks:
        ch, hi, lo, *fd = kinds[kind]
        for x, y in ps:
            if fd and near(x, y):
                continue
            if hi and 0 < y - 1 and (x, y - 1) not in allpts:
                g[y - 1][x] = hi
            if lo and y + 1 < 15 and (x, y + 1) not in allpts:
                g[y + 1][x] = lo
    for ps, kind in marks:
        ch, hi, lo, *fd = kinds[kind]
        for x, y in ps:
            g[y][x] = fd[0] if fd and near(x, y) else ch
    return [''.join(r) for r in g]


def ports_of(xs, ys):
    return {(x, 0) for x in xs} | {(x, 15) for x in xs} | {(0, y) for y in ys} | {(15, y) for y in ys}


def check_ports(bodies, ports, crack_chars):
    """모든 몸통이 이음 자리마다 금을 갖는다(이웃 칸 금이 칸 경계에서 끊기지 않게)."""
    for i, b in enumerate(bodies):
        for x, y in ports:
            assert b[y][x] in crack_chars, ('이음 자리에 금이 없다', i, x, y)


# ================================================================================================ A1 「빙하」 — 버들항 설원 얼음판 말씨
# 글자표 L1 과 바닥·바위 윗면·앞면은 아래 「판 6」 절에 있다.
G1_COMMON = []
G1_N = [3, 3, 3, 4, 4, 3, 3, 3, 3, 4, 3, 3, 2, 2, 3, 3, 3, 3, 2, 2, 3, 4, 4, 3, 3, 3, 3, 2, 2, 3, 3, 3]
G1_W = [2, 2, 2, 2, 2, 1, 1, 2, 2, 2, 2, 1, 1, 2, 2, 2, 2, 2, 1, 1, 2, 2, 3, 2, 2, 2, 2, 2, 1, 1, 2, 2]
G_INNER = (['12......' + '....2111', '22......' + '......22', '2.......' + '.......2']
           + ['.' * 16] * 10 + ['.' * 16, '1.......' + '.' * 8, '12......' + '.' * 8])

# ---- 얼음 몸통 A1 — 옅은 청록(b) + 밝은 면(c) + 서리 점(W·c). 금은 세 무게: 굵은 금 d(바로 위 능선 빛 c),
#      가는 금 m(칸 안에서만), 그리고 변형마다 다른 길. 굵은 금은 위·아래 열 6, 왼·오른 행 10 에서만 칸을 건넌다.
PORTS1 = ports_of((6,), (10,))
KINDS1 = {'M': ('d', 'c', None), 'F': ('m', None, None)}
ICE1_BASE = sq([
    'bbbbbbbbbbbbbWbb', 'bbbcccbbbbbbbbbb', 'bbccccbbbbbbcccb', 'bbbbbbbbbbbccbbb',
    'bbbbbbbcbbbbbbbb', 'ccbbbbbbbbbbbbbc', 'cbbbbbccccbbbbbb', 'bbbWbbbccbbbbbbb',
    'bbbbbbbbbbbbbbbb', 'bbbbbbbbbbbbbcbb', 'bbcccbbbbbbbcccb', 'bccccbbbbWbbbbbb',
    'bbbbbbbbbbbbbbbb', 'bbbbbbbcccbbbbbb', 'bcbbbbccccbbbbbb', 'bbbbbbbbbbbbbbbb'], name='ICE1')
ICE1_PATHS = [
    [([(6, 0), (7, 4), (10, 8), (15, 10)], 'M'), ([(0, 10), (3, 12), (6, 15)], 'M'), ([(7, 4), (3, 6)], 'M'),
     ([(9, 2), (12, 3), (13, 5)], 'F'), ([(2, 3), (3, 1)], 'F')],
    [([(6, 0), (5, 5), (6, 9), (6, 15)], 'M'), ([(0, 10), (3, 9), (6, 9)], 'M'), ([(6, 9), (11, 8), (15, 10)], 'M'),
     ([(10, 2), (13, 4)], 'F'), ([(2, 12), (4, 13)], 'F')],
    [([(6, 0), (3, 4), (1, 8), (0, 10)], 'M'), ([(6, 15), (9, 11), (15, 10)], 'M'), ([(9, 11), (11, 6)], 'F'),
     ([(8, 3), (10, 2)], 'F'), ([(3, 12), (4, 14)], 'F')],
    [([(6, 0), (8, 5), (12, 7), (15, 10)], 'M'), ([(0, 10), (5, 11), (8, 13), (6, 15)], 'M'),
     ([(2, 6), (4, 8)], 'F'), ([(10, 12), (13, 13)], 'F')],
    [([(0, 10), (4, 7), (8, 7), (15, 10)], 'M'), ([(6, 0), (7, 3), (6, 7)], 'M'), ([(6, 15), (7, 11), (7, 7)], 'M'),
     ([(10, 2), (12, 4)], 'F'), ([(2, 13), (3, 11)], 'F')],
]
FACET = ['..ccc', '.ccWc', 'ccc..']
FACET_L = ['cc..', 'ccc.', '.ccW']
RING = ['.mm.', 'm..m', 'm..m', '.mm.']
ICE1_FACETS = [
    [(FACET, 10, 11), (['W'], 3, 9)],
    [(FACET_L, 9, 2), (['cW'], 2, 5)],
    [(FACET, 6, 6), (['W'], 12, 13)],
    [(RING, 2, 2), (FACET_L, 9, 2), (['W'], 11, 13)],
    [(FACET, 2, 2), (['W'], 11, 4), (['cW'], 10, 12)],
]
ICE1_BODIES = [crack_body(ICE1_BASE, p, KINDS1, f, PORTS1) for p, f in zip(ICE1_PATHS, ICE1_FACETS)]
check_ports(ICE1_BODIES, PORTS1, 'd')
ICE1_FROZEN = [
    sq(['bbbbbbbbbbbb', 'bbbbbbbbbbbb', 'bbbmmmmmmbbb', 'bbmZZZGGgmbb', 'bmZGZGGggemb', 'bmGZGGcggemb',
        'bmGGGgcgeemb', 'bmgGggggeemb', 'bbmeeeeeembb', 'bbbmmmmmmbbb', 'bbbbbbbbbcbb', 'bbbbbbbbbbbb'], 12, 12),
    sq(['bbbbbbbbbbbb', 'bbbbbbbbbbbb', 'bbbbbbbbbbbb', 'bbbbbmmmmbbb', 'bbbbmZZGgmbb', 'bbbbmGcgemcb',
        'bbbbmggeembb', 'bbbbbmmmmbbb', 'bbbbbbbbbbbb', 'bbbbbbbbbbbb', 'bbbbbbbbbbbb', 'bbbbbbbbbbbb'], 12, 12),
]

# ---- 얼음 가장자리 A1 — 선 없이: 북·서 = 서리 번짐 U(I·S·c 사이로 바닥 p 가 비침, 끊김) + 빛 받는 턱 P(W·c·b),
#      남 = 얼음판 두께 D(d) + E(m·d), 동 = 옅은 그늘 Q(m·b·d 섞임). 모서리는 작게 둥글림.
U1_TEX = ['ISpIcSIpISIcpISI', 'SpIScIpSIcISpIcS', 'IcSpISIcpSIpISIc', 'pISIcpSIScIpSIpI'] * 4
P1_TEX = ['WcWbWWcWbcWWcbWc', 'cWWcbWWcWWbcWWcW', 'WbcWWcWbWcWWbWWc', 'cWWbcWWcbWWcWbcW'] * 4
D1_TEX = ['dddddmdddddddmdd', 'ddmdddddddmddddd', 'ddddddddmddddddm', 'dmddddmddddddddd'] * 4
E1_TEX = ['mdmmdmmmdmmmmdmm', 'mmmdmmdmmmdmmmmd', 'dmmmmmmdmmmmdmmm', 'mmdmmdmmmmmmmmdm'] * 4
Q1_TEX = ['mbmmdmbmmmdmbmmm', 'bmmdmmmbmdmmmbmm', 'mmbmmdmmbmmmdmmb', 'mdmmbmmmmdmbmmmd'] * 4
IF1_N = ',UP.....'
IF1_S = ',DE.....'
IF1_E = ',Q......'
IF1_NW = [',,,,,,,,', ',,,,,UUU', ',,,UUPPP', ',,UP....', ',UP.....', ',UP.....', ',UP.....', ',UP.....']
IF1_NE = [',,,,,,,,', 'UUU,,,,,', 'PPPQ,,,,', '....Q,,,', '.....Q,,', '......Q,', '......Q,', '......Q,']
IF1_SW = [',UP.....', ',UP.....', ',UP.....', ',UP.....', ',,UE....', ',,DEEEEE', ',,,DDDDD', ',,,,,,,,']
IF1_SE = ['......Q,', '......Q,', '......Q,', '......Q,', '.....EQ,', 'EEEEEDQ,', 'DDDDDD,,', ',,,,,,,,']
IF1_FRAME = frame(IF1_NW, IF1_NE, IF1_SW, IF1_SE, uni(IF1_N), uni(IF1_S), uni(IF1_N), uni(IF1_E))
IF1_INNER = inner4([',U......', 'UP......', 'P.......'] + ['........'] * 5,
                   ['......Q,', '.......Q'] + ['........'] * 6,
                   ['........'] * 5 + ['E.......', 'DE......', ',D......'],
                   ['........'] * 5 + ['.......E', '......ED', '.....ED,'])
check_frame('A1 얼음 틀', IF1_FRAME, IF1_INNER, strict_inner=False)
WOB_ICE1 = check_wob({
    'N': [0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0],
    'S': [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    'W': [0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    'E': [0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 2, 1, 0, 0, 0, 0]})

_TN1 = lambda k, m: 'R'  # noqa: E731
_TE1 = lambda k, m: 'D'  # noqa: E731
TOP1_N = strips([(1, 2), (1, 2), (1, 2), (2, 3), (2, 3), (2, 3), (1, 2), (1, 2),
                 (1, 2), (1, 2), (0, 1), (0, 1), (1, 2), (1, 2), (2, 3), (1, 2)], _TN1, ',')
TOP1_W = strips([(1, 2), (1, 2), (2, 3), (2, 3), (1, 2), (1, 2), (1, 2), (1, 2),
                 (1, 2), (0, 1), (0, 1), (0, 1), (1, 2), (2, 3), (2, 3), (1, 2)], _TN1, ',')
TOP1_E = strips([(1, 2), (1, 2), (1, 2), (2, 3), (2, 3), (1, 2), (1, 2), (1, 2),
                 (1, 2), (1, 2), (0, 1), (0, 1), (1, 2), (1, 2), (2, 3), (1, 2)], _TE1, ',')
TOP_S0 = strips([(0, 0)] * 16, _TE1, ',')
TOP1_NW = [',,,,,,,,', ',,,,,,RR', ',,,,RRR.', ',,,R....', ',,R.....', ',R......', ',R......', ',R......']
TOP1_NE = [',,,,,,,,', 'RR,,,,,,', '..RD,,,,', '....D,,,', '.....D,,', '......D,', '......D,', '......D,']
TOP1_SW = [',R......'] * 8
TOP1_SE = ['......D,'] * 8
TOP1_FRAME = frame(TOP1_NW, TOP1_NE, TOP1_SW, TOP1_SE, TOP1_N, TOP_S0, TOP1_W, TOP1_E)
TOP1_INNER = inner4([',R......', 'R.......'] + ['........'] * 6,
                    ['......D,', '.......D'] + ['........'] * 6,
                    ['........'] * 8, ['........'] * 8)
check_frame('A1 바위 윗면 틀', TOP1_FRAME, TOP1_INNER, strict_inner=False)
WOB_TOP1 = check_wob({
    'N': [0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 1, 1, 0, 0],
    'S': [0] * 32,
    'W': [0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0],
    'E': [0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0]})

# ================================================================================================ A2 「청빙」
# 글자표 L2 와 바닥·얼음 몸통·바위 윗면·앞면은 아래 「판 6 — A2」 절에 있다.
G2_COMMON = []
G2_N = [3, 3, 4, 4, 3, 3, 2, 3, 3, 3, 3, 4, 4, 3, 2, 2, 3, 3, 4, 3, 3, 3, 2, 2, 3, 3, 4, 4, 3, 3, 3, 3]
G2_W = [2, 2, 1, 1, 2, 2, 2, 3, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1, 1, 2, 2, 2, 3, 2, 2, 2, 1, 2, 2, 2]

# ---- 얼음 속에 언 돌 A2(얼음 안쪽 칸 덧그림).
ICE2_FROZEN = [   # 얼음 속에 흐릿하게 비치는 돌 — 고르지 않은 윤곽, 둘레는 조금 짙은 얼음 w
    sq(['mmmmmmmmmmmm', 'mmmmmmmmmmmm', 'mmmmwwwmmmmm', 'mmmw2343wmmm', 'mmw234432wmm', 'mmw23W432wmm',
        'mmmw23221wmm', 'mmmmw211wmmm', 'mmmmmwwwmmmm', 'mmmmmmmmmmmm', 'mmmmmmmmmmmm', 'mmmmmmmmmmmm'], 12, 12),
    sq(['mmmmmmmmmmmm', 'mmmmmmmmmmmm', 'mmmmmmmmmmmm', 'mmmmmmwwmmmm', 'mmmmmw343wmm', 'mmmmw23W2wmm',
        'mmmmmw21wmmm', 'mmmmmmwmmmmm', 'mmmmmmmmmmmm', 'mmmmmmmmmmmm', 'mmmmmmmmmmmm', 'mmmmmmmmmmmm'], 12, 12),
]

# ---- 얼음 가장자리 A2 — 평평하게: 북·서 = 1px 빛 테 P(W·c), 남·동 = 1px 옅은 턱 D(w 바탕에 m 틈·드문 d — 곧은 검은 줄이 아니게). 부풀거나 물결진 테·물방울 없음.
P2_TEX = ['WcbbWWcbbbWcbbbW', 'cbbWcbbbWWcbbWcb', 'bWWcbbbcWbbbWcbb', 'WcbbbWcbbbcWbbbc'] * 4   # 빛 테를 b 틈으로 끊는다
D2_TEX = ['wwmwdwwmwwwmwdww', 'wmwwwmwwdwmwwwmw', 'dwwmwwwmwwwdwmww', 'wwmwwdwwmwmwwwwd'] * 4   # 끊기고 옅은 턱
E2_TEX = D2_TEX
IF2_N = ',P......'
IF2_S = ',D......'
IF2_E = ',D......'
IF2_NW = [',,,,,,,,', ',,,PPPPP', ',,P.....', ',P......', ',P......', ',P......', ',P......', ',P......']
IF2_NE = [',,,,,,,,', 'PPPP,,,,', '....D,,,', '.....D,,', '......D,', '......D,', '......D,', '......D,']
IF2_SW = [',P......', ',P......', ',P......', ',P......', ',P......', ',,D.....', ',,,DDDDD', ',,,,,,,,']
IF2_SE = ['......D,', '......D,', '......D,', '......D,', '......D,', '.....D,,', 'DDDDD,,,', ',,,,,,,,']
IF2_FRAME = frame(IF2_NW, IF2_NE, IF2_SW, IF2_SE, uni(IF2_N), uni(IF2_S), uni(IF2_N), uni(IF2_E))
IF2_INNER = inner4([',P......', 'P.......'] + ['........'] * 6,
                   ['......D,', '.......D'] + ['........'] * 6,
                   ['........'] * 6 + ['D.......', ',D......'],
                   ['........'] * 6 + ['.......D', '......D,'])
check_frame('A2 얼음 틀', IF2_FRAME, IF2_INNER, strict_inner=False)
WOB_ICE2 = check_wob({   # 1px 만, 드물게 — 평평하고 살짝만 고르지 않은 테
    'N': [0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0],
    'S': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    'W': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    'E': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]})

TOP2_N = strips([(1, 2), (1, 2), (1, 2), (1, 2), (2, 3), (2, 3), (1, 2), (1, 2),
                 (1, 2), (0, 1), (0, 1), (1, 2), (1, 2), (1, 2), (2, 3), (1, 2)], _TN1, ',')
TOP2_W = strips([(1, 2), (2, 3), (2, 3), (1, 2), (1, 2), (1, 2), (1, 2), (1, 2),
                 (1, 2), (1, 2), (1, 2), (2, 3), (2, 3), (2, 3), (1, 2), (1, 2)], _TN1, ',')
_TE2 = lambda k, m: 'D' if k == 0 else 'Q'  # noqa: E731
TOP2_E = strips([(1, 2), (1, 3), (0, 2), (0, 1), (1, 3), (1, 3), (1, 2), (1, 2),
                 (1, 2), (1, 3), (2, 4), (2, 3), (1, 2), (1, 3), (1, 3), (1, 2)], _TE2, ',')
TOP2_NW = [',,,,,,,,', ',,,,,,RR', ',,,,RR..', ',,,R....', ',,R.....', ',R......', ',R......', ',R......']
TOP2_NE = [',,,,,,,,', 'RR,,,,,,', '..RRD,,,', '.....D,,', '......D,', '......D,', '......D,', '......D,']
TOP2_FRAME = frame(TOP2_NW, TOP2_NE, TOP1_SW, TOP1_SE, TOP2_N, TOP_S0, TOP2_W, TOP2_E)
TOP2_INNER = inner4([',,R.....', ',R......', 'R.......'] + ['........'] * 5,   # 안 모서리를 비스듬히 — 직각 틀이 아니게
                    ['.....D,,', '......D,', '.......D'] + ['........'] * 5,
                    ['........'] * 8, ['........'] * 8)
check_frame('A2 바위 윗면 틀', TOP2_FRAME, TOP2_INNER, strict_inner=False)
WOB_TOP2 = check_wob({
    'N': [0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 1, 2, 1, 0, 0, 0, 0, 0, 1, 1, 2, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0],
    'S': [0] * 32,
    'W': [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    'E': [0, 1, 1, 0, 0, 1, 0, 0, 0, 0, 1, 2, 1, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 0, 1, 2, 1, 0, 0, 0]})

# ================================================================================================ 판 6 — 버들항 설원 기법
# 반복 무늬 대신 가까운 2~3 톤의 잔 얼룩(한 칸 안에 같은 자리 특징이 도드라지지 않게), 특징은 변형에만 · 자리 제각각.
# 밝기: 앞면(가장 어둠) < 바닥(중간) · 바위 윗면 = 흰 서리 모자(왼·위)와 푸른 그늘(오른·아래)을 가진 덩이들.
L1 = legend(d=('ice', 0), m=('ice', 1), b=('ice', 2), c=('ice', 3), W=('ice', 4),
            S=('rim', 6), I=('iron', 5), H=('iron', 4), h=('iron', 3), j=('iron', 2), i=('iron', 1),
            e=('stone', 1), g=('stone', 2), G=('stone', 4), Z=('stone', 5),
            k=('iron', 5), n=('stone', 5), p=('rim', 6), a=('iron', 4),
            **{str(i): ('vrock', i) for i in range(1, 5)})

# ---- 얼음굴 바닥 A1 — 다진 눈 회청색: k(iron 5) 바탕에 아주 가까운 n(stone 5) 잔 얼룩, 밝은 눈 p 드문드문.
G1_BASE = sq([
    'kknkkkknnkkkkknk',
    'knnnkkkknkkpkkkk',
    'kknkkpkkkkknnkkk',
    'kkkkknnkkknnnkkn',
    'nkkkkknkkkkknkkk',
    'nnkkkkkkpkkkkkkn',
    'knkknnkkkkkkkkkk',
    'kkkknnnkkknkkpkk',
    'kpkkknkkknnnkkkk',
    'kkkkkkkkkknkkknk',
    'kknkkkkpkkkkknnn',
    'knnnkkkkkkkkkknk',
    'kknkkknnkkpkkkkk',
    'kkkkkknnnkkkknkk',
    'kkpkkkkkkkkknnnk',
    'kkkknkkkkkkkknkk',
], name='G1')
G1_VARS = [
    [],
    [(['.p', 'pa'], 4, 9)],                    # 눈에 반쯤 묻힌 잔돌
    [(['pp', '.p'], 10, 3), (['n'], 3, 12)],   # 눈 덩이
    [(['a'], 12, 11), (['pn'], 6, 5)],
]

# ---- 바위 윗면 A1 — 바닥(밝은 눈 회색)보다 어둡고 찬 바위 윗면: H(iron 4) 바탕에 느슨한 h(iron 3) 무리(낮은 주파수 명암),
#      칸마다 2~5px 서리 앉은 돌 덩이 네 개(왼·위 S·I, 밑 h·j 그늘) — 크기·자리 제각각, 한 점에 눈이 쏠리지 않게.
#      덩이 모양은 틀이 정한다: 북·서 가장자리 = 흰 서리 모자 R(W·S), 동 가장자리 = 그늘 D(j·h, 채도 낮음). 본몸통(가장자리 칸에 쓰임)은 얼룩뿐이고,
#      굽은 틈 j(위 = 푸른 그늘 m, 아래 = 서리 턱 W)는 안쪽 칸 변형에만 — 칸 가장자리에 닿지 않아 16px 도장이 생기지 않는다.
KINDS_T1 = {'M': ('h', None, None)}   # 바탕 H 보다 한 단 어두운 회청 h, 빛·테두리 없음
TOP1_BASE = sq([
    'HHHHHhHHHHHHHHHh',
    'HHSIHHHHhhHHHHHH',
    'HIIIhHHHHhhHHHHH',
    'HHhjHHHhHHHHHSIH',
    'hHHHHHHHHHHhIIIh',
    'hhHHHhHHHHHHhhjH',
    'HhHHHHHHhHHHHHHH',
    'HHHHhHHHHHhhHHHH',
    'HHHHHHSIHHHhHHHh',
    'HhHHHIIIhHHHhHHH',
    'HHHHHHhhjHHHHHIH',
    'HHHhHHHHHHHHhHHH',
    'hhHHHHHhHHSIHHHH',
    'HhHHHHHhhIIhHHhH',
    'HHhHHHHHHHhjHHHH',
    'HHHHHHhHHHHHHHIH',
], 16, 16, 'TOP1')
TOP1_PATHS = [[([(4, 5), (6, 6), (7, 9), (9, 10)], 'M')]]
TOP1_SPECKS = [[(['hh', '.h'], 5, 3), (['I'], 11, 11)], [(['.h', 'hh'], 10, 7), (['j'], 3, 12)], [(['I.', 'hI'], 7, 12)]]
TOP1_BODIES = ([TOP1_BASE] + [crack_body(TOP1_BASE, p, KINDS_T1, (), set()) for p in TOP1_PATHS]
               + [stamp(TOP1_BASE, v, inner=True) for v in TOP1_SPECKS])
R1_TEX = ['WSWWSWWSWWWSWSWW', 'SWWSWWWSWSWWSWWS', 'WWSWSWWWSWWSWWWS', 'SWWWSWSWWWSWWSWW'] * 4
D1R_TEX = ['jhjjhjjhjjjhjhjj', 'hjjhjjjhjhjjhjjh', 'jjhjhjjjhjjhjjjh', 'jhjjjhjhjjjhjjhj'] * 4


FACE_MASK = [   # 손으로 찍은 고르지 않은 섞임 자리('#' = 그 줄의 둘째 톤) — 5×5 평면이 생기지 않게
    '..#....#..#...#.', '#...#.....#.#...', '...#..##.....#..', '.#.....#..#....#', '..#.#......#.#..',
    '#.....#.#.....#.', '..##....#..#....', '.#...#.....#..#.', '....#..#.#....#.', '#.#.....#...#...',
    '..#..#.....#..#.', '.#....#.#.....#.', '#..#.....#.#....', '...#.#..#....#.#', '.#......#..#....',
    '..#.#.#.....#..#', '#.....#..#.#....', '.#.#.....#....#.', '...#..#.#...#...', '#.#.....#.#....#',
    '..#.#..#.....#..', '.#....#...#.#...', '#..#.#.....#..#.', '..#....#.#....#.', '.#..#.....#.#...',
    '#....#.#.....#.#', '..#.#...#.#.....', '.#.....#...#.#..', '#..#.#....#....#', '.#....#.#...#...']


def face_ramp(lip, bands, mask):
    """앞면 2~31행: bands = [(첫 행, 끝 행, 바탕, 섞임)] — 위 서리 턱에서 어두운 밑동까지 이어지는 5~6 단 낙차."""
    out = list(lip)
    for y in range(2, 32):
        base, alt = next((b, a) for y0, y1, b, a in bands if y0 <= y <= y1)
        out.append(''.join(alt if m == '#' else base for m in mask[y - 2]))
    return out


def face_ledges(rows, ledges):
    """끊긴 바위 턱: ledges = [(꼭짓점들, 빛 글자, 그늘 글자)] — 턱 윗줄 한 화소는 빛, 바로 밑 한 화소는 그늘(가로 16 주기로 감김)."""
    g = [list(r) for r in rows]
    for pts, lit, dark in ledges:
        for x, y in poly(*pts):
            g[y][x % 16] = lit
            if y + 1 < len(g):
                g[y + 1][x % 16] = dark
    return [''.join(r) for r in g]


def face_strata(rows, polys, ch, lit):
    """앞면에 손으로 고른 꼭짓점의 완만하게 기운 지층 금(가로 16 주기로 감김 — 칸 이음을 건너 이어진다). lit 을 주면 바로 위 한 화소 = 빛 받는 턱."""
    g = [list(r) for r in rows]
    pts = {(x % 16, y) for p in polys for x, y in poly(*p)}
    for x, y in pts:
        if lit and (x, y - 1) not in pts:
            g[y - 1][x] = lit
    for x, y in pts:
        g[y][x] = ch
    return [''.join(r) for r in g]


# ---- 앞면 A1 — 조용한 16px 주기(dot.Face 는 가운데 한 장만 되풀이한다). 두 단 전체에 이어지는 낙차:
#      서리 턱(0~1행 S·I) → H/4 → 4/h → 3/h → j/3 → 2/j → 2/i → i/1 밑동. 줄마다 손으로 찍은 섞임 자리로 두 톤을 섞어 5×5 평면이 없다.
#      끊긴 바위 턱 여섯 토막(완만히 기움, 칸 이음을 건넘): 윗줄 한 화소는 빛, 밑 한 화소는 그늘. 가운데 고드름 없음(양 끝 마구리에만).
FACE1_BASE = sq(face_ledges(face_ramp(
    ['SSSWSSSSSSSSISSS', 'IISIIHIIIISIIHII'],
    [(2, 4, '4', 'H'), (5, 9, 'h', '4'), (10, 14, '3', 'h'), (15, 19, 'j', '3'), (20, 24, '2', 'j'), (25, 28, '2', 'i'),
     (29, 31, 'i', '1')], FACE_MASK),
    [([(1, 7), (6, 8), (9, 8)], 'H', '3'), ([(11, 5), (16, 6), (19, 6)], 'H', '3'), ([(5, 12), (10, 13), (13, 13)], '4', 'j'),
     ([(14, 17), (20, 18), (23, 18)], 'h', '2'), ([(2, 21), (7, 22)], '3', 'i'), ([(9, 25), (14, 26)], 'j', '1')]),
    16, 32, 'FACE1b')
FACE1_MID = FACE1_BASE
FACE1_L = [(col('S' + '3' * 29 + '21'), 0, 0),
           (['Wbm', 'Wbm', 'Wbm', 'Wb.', 'Wb.', 'Wb.', '.b.', '.b.', '.c.'], 2, 2), (['Wb', 'Wb', 'Wb', 'b.'], 5, 2)]
FACE1_R = [(col('3' + '2' * 29 + '11'), 7, 0), (['Wbm', 'Wb.', 'Wb.', 'Wb.', 'b..', 'c..'], 1, 2), (['Wb', 'b.'], 4, 2)]

# ================================================================================================ 판 6 — A2
L2 = legend(d=('ice', 0), m=('ice', 1), b=('ice', 2), c=('ice', 3), W=('ice', 4),
            F=('iron', 5), S=('rim', 6), G=('iron', 4), h=('iron', 3), j=('iron', 2), i=('iron', 1), w=('water', 3),
            **{str(i): ('vrock', i) for i in range(1, 5)})

# ---- 얼음굴 바닥 A2 — 더 어두운 바위 바닥: h(iron 3) 바탕에 아주 가까운 4(vrock 4) 잔 얼룩, 밝은 G · 어두운 j 점을 고르지 않게 흩는다(바닥 4단).
G2_BASE = sq([
    'hhGhh4hhhhjh4hhh',
    'h4hh444hhhhh4Ghh',
    '444hh4jhGhhGhhhh',
    'h4hhhhhhGhjhhhjh',
    'hjhhGhhh4hhGh444',
    'hhhhGhh444hhhh4h',
    'hjhhhhhh4jhhhGhh',
    'hhGh4hhjhhhGhhhh',
    'jhh444hhhhGhhh4h',
    'hGhh4hGhjhhhh44h',
    'h4hhhhhhjh4hhGhh',
    '444hjhhGhh44hhhh',
    'h4hhhhhGhhh4hGjh',
    'hhGhh4hhhhjhhhhh',
    'hhhh444hGhhh4hhh',
    'hGhjh4hhhGhh44hh',
], name='G2')
G2_VARS = [
    [],
    [(['G4', '4j'], 9, 10)],
    [(['.G', 'Gj'], 3, 4), (['j'], 12, 12)],
    [(['GG', '4j'], 11, 2)],
]

# ---- 얼음 A2 「흰 서리 더미 밑 맑고 짙은 얼음」(버들항 설원 호수 말씨) — A1 의 금 그물과 다른 생각.
#      바탕 = 맑은 푸른 얼음 m(ice 1) + 조금 짙은 물길 w(water 3) 몇 점. 그 위에 b 를 성기게 흩뿌린 넓고 흐린 서리 더미 둘이
#      칸의 약 30% 를 덮으며 칸 이음(왼·오른, 위·아래)을 건너 이어진다(본몸통엔 c·W 없음 — 대비가 낮아 되풀이가 보이지 않게).
#      변형마다 더미 속 다른 자리에 c·W 로 짙어진 서리 덩이가 생긴다.
#      금은 거의 없다 — 변형 두 개에만 칸 안의 가늘고 옅은 금 하나(d, 변에 닿지 않음). 본몸통(가장자리 칸)은 금 없는 가장 조용한 것.
KINDS2 = {'M': ('d', None, None)}
ICE2_BASE = sq([
    'mbmbmbbbmbmmmmmm',
    'bmbbbbbmbmbmmwmm',
    'mbmbbbbbmbmmmmmm',
    'bmbmbbmmbmmmmmmb',
    'mbmmbmbmmmmmmmbm',
    'mmmmmmmmmwmmmbmm',
    'mwmmmmmmmmmmbmbm',
    'bmmmmmmmmmmmmbbb',
    'mmmmmmmmmmbmbbbb',
    'bbmmmmmwmmmmmbbb',
    'bbbmmmmmmmmmbmbb',
    'mbmbmmmmmmmmmbmb',
    'mmmmmmmmmmmmmmmm',
    'mmmmmmmwmmmmmmmm',
    'mmmmmmmmmmmmbmmm',
    'mmbmbmmbmbmmmmmm',
], 16, 16, 'ICE2')
ICE2_DRIFTS = [
    [(['.bcc.', 'bcWcb', '..bb.'], 2, 1), (['bb', '.b'], 9, 12)],
    [(['bccb', '.cWcb', '..bb.'], 10, 7)],
    [(['cb', 'Wc', 'b.'], 13, 8)],
    [(['.bc', 'bcW', '.cb'], 4, 2), (['b.b', '.bb'], 6, 12)],
]
ICE2_CRACKS = [None, None, [([(3, 11), (6, 10), (9, 12), (12, 11)], 'M')], [([(9, 3), (11, 6), (10, 9)], 'M')]]
ICE2_BODIES = [ICE2_BASE] + [crack_body(stamp(ICE2_BASE, d, inner=True), c, KINDS2, (), set()) if c else stamp(ICE2_BASE, d, inner=True)
                             for d, c in zip(ICE2_DRIFTS, ICE2_CRACKS)]

# ---- 바위 윗면 A2 — 각진 큰 바위 판: 서리 앉은 윗면(F iron 5 바탕에 G iron 4 얼룩을 촘촘히, 푸른 서리 c), 칸마다 2~5px 빛 받는
#      돌 덩이 네 개(S, 밑 G·h 그늘). 동 가장자리 턱은 1~2px 로 굵기가 바뀌는 바깥 j·h + 안쪽 G·h 두 겹. 본몸통은 얼룩뿐,
#      곧게 꺾인 틈 i(위 = 푸른 그늘 m, 아래 = 북서 서리 턱 S)는 안쪽 칸 변형에만 있고 칸 가장자리에 닿지 않는다.
#      북·서 가장자리 = 서리 턱 R(S·W), 동 가장자리 = 그늘 D(j·i).
KINDS_T2 = {'M': ('G', None, None)}   # 바탕 F 보다 한 단 어두운 회청 G, 빛·테두리 없음
TOP2_BASE = sq([
    'FFGFFFFFcFGFFFFF',
    'FFSSFFGFFFFFFGFF',
    'FSSFGFFFFcFFGGFF',
    'GFGhFFFGFFFFFFFc',
    'FFFFFcFFGFFFFSSF',
    'FGFFFFFFFFGFSSFG',
    'FFFGFFGFFFFFFGhF',
    'cFFFFFFFFGFFcFFF',
    'FFGFFSSFFFFGFFFF',
    'GFFFSSSFFcFFFGFF',
    'FFcFFGGhFFFFFFGF',
    'FGFFFFFFGFGFcFFF',
    'FFGFFcFFFFFFSFFG',
    'FFFFGFFFFFFSSGFF',
    'FcFFFFGFFGFFGhFF',
    'FFFGFFFFFFFFFFcF',
], 16, 16, 'TOP2')
TOP2_PATHS = [[([(9, 3), (8, 5), (10, 6), (9, 9)], 'M')]]
TOP2_SPECKS = [[(['GG', 'G.'], 4, 9), (['S'], 12, 3)], [(['.G', 'GG'], 11, 11), (['h'], 2, 5)], [(['S.', 'GS'], 6, 6)]]
TOP2_BODIES = ([TOP2_BASE] + [crack_body(TOP2_BASE, p, KINDS_T2, (), set()) for p in TOP2_PATHS]
               + [stamp(TOP2_BASE, v, inner=True) for v in TOP2_SPECKS])
R2_TEX = ['SWSSWSSSWSSSWSWS', 'WSSSSWSWSSWSSSSW', 'SSWSSSSSSWSSWSSS', 'SWSSWSSWSSSSSWSS'] * 4
D2R_TEX = ['jhjjhjhjjhjjhjhj', 'hjjhjjjhjhjjjhjj', 'jjhjhjjjhjjhjjhj', 'jhjjjhjhjjhjhjjh'] * 4
Q2R_TEX = ['GhGGhGGhGGGhGhGG', 'hGGhGGGhGhGGhGGh', 'GGhGhGGGhGGhGGGh', 'GhGGGhGhGGhGGhGG'] * 4

# ---- 앞면 A2 — A1 보다 어둡고 반대로 기운 턱. 낙차: 서리 처마(0~1행 F·S·G) → 3/4 → j/3 → 2/3 → 2/i → i/2 → i/1 → 1/i 밑동.
#      섞임 자리는 A1 의 것을 좌우·위아래로 뒤집어 쓴다(같은 자리 무늬가 겹치지 않게). 끊긴 바위 턱 다섯 토막: 위 빛 · 밑 그늘.
#      가운데엔 짧은 고드름 하나(2px, 열 4)뿐, 굵고 긴 고드름 무리는 벽 줄 양 끝 마구리에만.
FACE2_BASE = sq(face_ledges(face_ramp(
    ['FFSFFFFFFSFFFFFF', 'GFGGGFGGGGGFGGGG'],
    [(2, 4, '3', '4'), (5, 9, 'j', '3'), (10, 14, '2', '3'), (15, 19, '2', 'i'), (20, 24, 'i', '2'), (25, 28, 'i', '1'),
     (29, 31, '1', 'i')], [r[::-1] for r in FACE_MASK[::-1]]),
    [([(2, 9), (8, 8), (12, 7)], '4', '2'), ([(13, 12), (19, 11), (22, 10)], '3', 'i'), ([(4, 17), (10, 16)], 'j', 'i'),
     ([(11, 21), (17, 20), (21, 19)], '3', '1'), ([(1, 25), (6, 24), (9, 24)], '2', '1')]),
    16, 32, 'FACE2b')
FACE2_MID = sq(stamp(FACE2_BASE, [(['Wc', 'c.'], 4, 2)], wrap=True), 16, 32, 'FACE2')
FACE2_L = [(col('F' + '3' * 29 + '21'), 0, 0),
           (['WWcb', 'WWcb', 'Wccb', 'Wcb.', 'Wcb.', 'Wcb.', 'Wc..', 'Wc..', '.c..', '.c..', '.c..', '.W..'], 2, 2),
           (['Wc', 'Wc', 'c.'], 6, 2)]
FACE2_R = [(col('G' + '1' * 29 + '11'), 7, 0), (['Wcb', 'Wc.', 'Wc.', 'Wc.', 'c..'], 0, 2), (['Wc', 'c.'], 4, 2)]


# ================================================================================================ 조립
def ground_parts(n):
    if n == 1:
        return G1_BASE, G1_COMMON, G1_VARS, L1, G1_N, G1_W, legend(**{'1': ('iron', 3), '2': ('iron', 4)})
    return G2_BASE, G2_COMMON, G2_VARS, L2, G2_N, G2_W, legend(**{'1': ('iron', 1), '2': ('iron', 2)})


def ground(n):
    """얼음굴 바닥 오토타일(벽 밑 그늘 북·서) + 몸통 변형."""
    base, common, vs, leg, N_, W_, shade = ground_parts(n)
    bs = body_set(base, common, vs, leg)
    fr = grid(floor_frame(N_, W_, '1', '2'), shade, 32, 32)
    inn = grid(G_INNER, shade, 16, 16)
    return autotile_cv(bs[0], fr, inn, bs[1:])


def ice_floor(n):
    g = ground(n)
    if n == 1:
        leg, prof, bodies_rows = L1, WOB_ICE1, ICE1_BODIES
        tx = {',': g.body, 'U': grid(U1_TEX, leg), 'P': grid(P1_TEX, leg), 'D': grid(D1_TEX, leg), 'E': grid(E1_TEX, leg),
              'Q': grid(Q1_TEX, leg)}
        fr_rows, inn_rows = IF1_FRAME, IF1_INNER
    else:
        leg, prof, bodies_rows = L2, WOB_ICE2, ICE2_BODIES
        tx = {',': g.body, 'P': grid(P2_TEX, leg), 'D': grid(D2_TEX, leg), 'E': grid(E2_TEX, leg)}
        fr_rows, inn_rows = IF2_FRAME, IF2_INNER
    fr, inn = fill(fr_rows, inn_rows, leg, tx)
    wobble(fr, g.body, prof)
    bs = [grid(r, leg) for r in bodies_rows]
    return autotile_cv(bs[0], fr, inn, bs[1:])


def frozen_tiles(n):
    main, fz, leg = (ICE1_BODIES[0], ICE1_FROZEN, L1) if n == 1 else (ICE2_BODIES[0], ICE2_FROZEN, L2)
    out = []
    for c in fz:
        rows = list(main)
        for i, r in enumerate(c):
            rows[2 + i] = main[2 + i][:2] + r + main[2 + i][14:]
        out.append(grid(rows, leg))
    return out


def rock_top(n):
    g = ground(n)
    if n == 1:
        leg, fr_rows, prof, bodies_rows = L1, TOP1_FRAME, WOB_TOP1, TOP1_BODIES
        tx = {',': g.body, 'R': grid(R1_TEX, leg), 'D': grid(D1R_TEX, leg)}
    else:
        leg, fr_rows, prof, bodies_rows = L2, TOP2_FRAME, WOB_TOP2, TOP2_BODIES
        tx = {',': g.body, 'R': grid(R2_TEX, leg), 'D': grid(D2R_TEX, leg), 'Q': grid(Q2R_TEX, leg)}
    fr, inn = fill(fr_rows, TOP1_INNER if n == 1 else TOP2_INNER, leg, tx)
    wobble(fr, g.body, prof)
    bs = [grid(r, leg) for r in bodies_rows]
    return autotile_cv(bs[0], fr, inn, bs[1:])


def ice_face(n):
    if n == 1:
        return face_from(FACE1_MID, FACE1_L, FACE1_R, L1)
    return face_from(FACE2_MID, FACE2_L, FACE2_R, L2)


# ================================================================================================ 장면 — 얼음 동굴 두 방(18×12)
# '#' 얼음 바위 · '.' 얼음굴 바닥 · 'i' 얼음 바닥. 북벽은 10칸 곧게 이어져(반복 판단용), 가운데 바위 덩이가 두 방을 나눈다.
# 왼쪽 큰 얼음판(안쪽 칸에 얼음 속 돌), 오른쪽 아래 얼음판, 왼쪽 아래 바위 턱.
SCENE = [
    '##################',
    '##################',
    '##################',
    '#..........####..#',
    '#.iiiiii...####..#',
    '#iiiiiiii..####..#',
    '#iiiiiiii..####..#',
    '#.iiiiii.........#',
    '#..ii......iiii..#',
    '###.......iiiiii.#',
    '###.......iiiii..#',
    '##################',
]
FROZEN_AT = [(3, 5, 0), (12, 9, 1)]   # (칸 x, 칸 y, 얼음 속 돌 번호) — 안쪽(마스크 255) 칸만
ACTOR_AT = (9, 5)


def actor_cv():
    return dot.Cv.of(dot.actor1_frame(1, 0, 0))


def scene(n, actor=True):
    g = [r.replace('i', 'w') for r in SCENE]
    assert not dot.structure_errors(g), dot.structure_errors(g)
    cv = dot.render_cave(g, rock_top(n), ice_face(n), ground(n), water=ice_floor(n))
    fz = frozen_tiles(n)
    for x, y, k in FROZEN_AT:
        assert dot.mask_at(g, x, y, lambda ch, X, Y: ch == 'w') == 255, (x, y)
        cv.a[y * T:(y + 1) * T, x * T:(x + 1) * T] = fz[k].a
    if actor:
        cx, cy = ACTOR_AT
        cv.paste(actor_cv(), cx * T - 4, cy * T - 14)
    return cv, g


# ================================================================================================ 후보
NOTES = {
    'A1': '「빙하」 — 버들항 설원 기법(가까운 톤 잔 얼룩, 같은 자리 특징 없음): 옅은 청록 얼음 + 푸른 금 그물, 서리 번짐 가장자리 · '
          '다진 눈 회청색 바닥 · 흰 서리 모자 둥근 바윗덩이 윗면 + 어두운 청회색 앞면(세로 균열, 고드름 무리 2·11·4·2px)',
    'A2': '「청빙」 — 짙고 맑은 푸른 얼음 + 위·아래로 물결치는 긴 균열(닫힌 칸 없음) · 더 어두운 바위 바닥 · '
          '각진 바위 토막 윗면(평평한 서리 윗면) + 가장 어두운 앞면(세로 균열, 굵은 고드름 하나 + 짧은 둘)',
}


def cand_ice_floor(n):
    def fn():
        at = ice_floor(n)
        gr = ground(n)
        v, _ = scene(n)
        fz = frozen_tiles(n)
        tiles = {f'얼음 속 돌 {i + 1}': t for i, t in enumerate(fz)}
        return hcat(a2_plus(at), a2_plus(gr)), {
            'kind': 'autotile', 'autotiles': {'ice': at, 'ground': gr}, 'tiles': tiles, 'vignette': v,
            'note': NOTES[f'A{n}'] + ' — 원본 = 얼음 바닥 A2(+몸통 변형 4) | 얼음굴 바닥 A2(+변형 3)',
            'extras': [('얼음 몸통 8×8 (변형 섞음)', dot.mosaic(at, 8, 8), 2), ('바닥 몸통 8×8 (변형 섞음)', dot.mosaic(gr, 8, 8), 2),
                       ('얼음 속 돌 칸', hcat(*fz), 4), ('얼음 바닥 47 변형', variants_sheet(at), 2)]}
    return fn


def cand_ice_rock(n):
    def fn():
        at = rock_top(n)
        f = ice_face(n)
        v, g = scene(n)
        return hcat(a2_plus(at), f.b), {
            'kind': 'autotile', 'autotiles': {'ceil': at}, 'faces': {'face': f}, 'vignette': v, 'grid': g, 'rim_check': True,
            'note': NOTES[f'A{n}'] + ' — 원본 = 바위 윗면 A2(+몸통 변형 4) | 앞면 32×32',
            'extras': [('윗면 몸통 8×8 (변형 섞음)', dot.mosaic(at, 8, 8), 2), ('앞면 8칸 이어 붙임(끝 마구리 포함)', face_run(f, 8), 3),
                       ('윗면 47 변형', variants_sheet(at), 2)]}
    return fn


CANDIDATES = {
    'gap.ice_floor': {'A1': cand_ice_floor(1), 'A2': cand_ice_floor(2)},
    'gap.ice_rock': {'A1': cand_ice_rock(1), 'A2': cand_ice_rock(2)},
}

SCENE_LEAD = ('같은 번호의 얼음 바위(윗면·앞면)·얼음 바닥·얼음굴 바닥만으로 깐 18×12 얼음 동굴 — 북벽 10칸 곧은 줄(반복 판단), '
              '가운데 바위 덩이로 나뉜 두 방, 얼음판 안 얼음 속 돌, 왼쪽 아래 바위 턱, Actor1. 맵 가장자리는 잘린 것.')
