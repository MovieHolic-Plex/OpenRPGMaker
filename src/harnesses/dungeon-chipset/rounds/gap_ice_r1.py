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
ICE2_FROZEN = [
    sq(['bbbbbbbbbbbb', 'bbbbmmmmbbbb', 'bbbm2222mbbb', 'bbm234432mbb', 'bm23443321mb', 'bm2343W321mb',
        'bm22332211mb', 'bbm122211mbb', 'bbbm1111mbbb', 'bbbbmmmmbbbb', 'bbbbbbbbbbbb', 'bbbbbbbbbbbb'], 12, 12),
    sq(['bbbbbbbbbbbb', 'bbbbbbbbbbbb', 'bbbbbbbbbbbb', 'bbbbbmmmmbbb', 'bbbbm2344mbb', 'bbbbm3W32mbb',
        'bbbbm2221mbb', 'bbbbbmmmmbbb', 'bbbbbbbbbbbb', 'bbbbbbbbbbbb', 'bbbbbbbbbbbb', 'bbbbbbbbbbbb'], 12, 12),
]

# ---- 얼음 가장자리 A2 — 평평하게: 북·서 = 1px 빛 테 P(W·c), 남·동 = 1px 어두운 턱 D(m, 드문 d). 부풀거나 물결진 테·물방울 없음.
P2_TEX = ['WcWWcWWWcWWcWWWc', 'cWWcWWcWWWcWWcWW', 'WWcWWWWcWcWWWWcW', 'WcWWcWWWWWWcWcWW'] * 4
D2_TEX = ['mmmmmmmdmmmmmmmm', 'mmmdmmmmmmmmmmmm', 'mmmmmmmmmmmdmmmm', 'mmmmmmmmmmmmmmmd'] * 4
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
TOP2_E = strips([(1, 2), (1, 2), (0, 1), (0, 1), (1, 2), (1, 2), (1, 2), (1, 2),
                 (1, 2), (1, 2), (2, 3), (2, 3), (1, 2), (1, 2), (1, 2), (1, 2)], _TE1, ',')
TOP2_NW = [',,,,,,,,', ',,,,,,RR', ',,,,RR..', ',,,R....', ',,R.....', ',R......', ',R......', ',R......']
TOP2_NE = [',,,,,,,,', 'RR,,,,,,', '..RRD,,,', '.....D,,', '......D,', '......D,', '......D,', '......D,']
TOP2_FRAME = frame(TOP2_NW, TOP2_NE, TOP1_SW, TOP1_SE, TOP2_N, TOP_S0, TOP2_W, TOP2_E)
check_frame('A2 바위 윗면 틀', TOP2_FRAME, TOP1_INNER, strict_inner=False)
WOB_TOP2 = check_wob({
    'N': [0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0],
    'S': [0] * 32,
    'W': [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    'E': [0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0]})

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

# ---- 바위 윗면 A1 — 바닥(밝은 눈 회색)보다 어둡고 찬 바위 윗면: H(iron 4) 바탕에 고르지 않은 h(iron 3) 덩이, 드문 서리 점 S·c.
#      덩이 모양은 틀이 정한다: 북·서 가장자리 = 흰 서리 모자 R(W·S), 동 가장자리 = 그늘 D(j·h, 채도 낮음). 본몸통(가장자리 칸에 쓰임)은 얼룩뿐이고,
#      굽은 틈 j(위 = 푸른 그늘 m, 아래 = 서리 턱 W)는 안쪽 칸 변형에만 — 칸 가장자리에 닿지 않아 16px 도장이 생기지 않는다.
KINDS_T1 = {'M': ('j', 'm', 'W'), 'F': ('h', None, None)}
TOP1_BASE = sq([
    'HHHIHHHHhHHHHHHH',
    'HHSHHHHhhhHHHHHH',
    'HHHHHHHHhhHIHcHH',
    'hHHHHHIHHHHHHHHh',
    'hhHHHcHHHHHHHHHh',
    'HhHHHHHjHHhHHIHH',
    'HHIHHHHHHhhhHHHH',
    'HHHHSHHHHHhHHSHH',
    'HHHHHHHHHIHHHHHH',
    'HHhhHHHHHHjHHHIH',
    'HhhhHHHHcHHHHhHH',
    'HHhHHHIHHHHHhhHH',
    'HHHHHHHHHHHIHHHH',
    'HHHHHHhHHHHSHHjH',
    'HcHHHhhhHHHHHHHH',
    'HHIHHHhHHHHHHHHH',
], 16, 16, 'TOP1')
TOP1_PATHS = [
    [([(2, 4), (5, 6), (9, 6), (13, 10)], 'M')],
    [([(2, 12), (4, 9), (8, 8), (12, 9), (13, 12)], 'M')],
    [([(6, 2), (5, 6), (7, 10), (11, 11)], 'M')],
    [([(2, 7), (6, 5), (11, 5), (13, 3)], 'M'), ([(8, 10), (12, 12)], 'F')],
]
TOP1_BODIES = [TOP1_BASE] + [crack_body(TOP1_BASE, p, KINDS_T1, (), set()) for p in TOP1_PATHS]
R1_TEX = ['WSWWSWWSWWWSWSWW', 'SWWSWWWSWSWWSWWS', 'WWSWSWWWSWWSWWWS', 'SWWWSWSWWWSWWSWW'] * 4
D1R_TEX = ['jhjjhjjhjjjhjhjj', 'hjjhjjjhjhjjhjjh', 'jjhjhjjjhjjhjjjh', 'jhjjjhjhjjjhjjhj'] * 4


def face_strata(rows, polys, ch, lit):
    """앞면에 손으로 고른 꼭짓점의 완만하게 기운 지층 금(가로 16 주기로 감김 — 칸 이음을 건너 이어진다). 바로 위 한 화소 = 빛 받는 턱."""
    g = [list(r) for r in rows]
    pts = {(x % 16, y) for p in polys for x, y in poly(*p)}
    for x, y in pts:
        if (x, y - 1) not in pts:
            g[y - 1][x] = lit
    for x, y in pts:
        g[y][x] = ch
    return [''.join(r) for r in g]


# ---- 앞면 A1 — 조용한 16px 주기(dot.Face 는 가운데 한 장만 되풀이한다): 끊김 없는 눈 처마(0행)와 낮게 출렁이는 처마 밑(1행),
#      위에서 아래로 어두워지는 빛 낙차(4 → 3 → j → 2), 완만하게 기운 지층 토막 j(위 빛 턱 4)이 칸 이음을 건너 이어진다.
#      가운데엔 짧은 고드름 하나(3px, 가운데를 벗어난 열 10)뿐. 긴 고드름 무리는 벽 줄 양 끝 마구리에만.
#      맨 아래 두 줄 = 바닥과 닿는 어두운 밑동(2·1). 바닥 쪽 접지 그늘은 얼음굴 바닥의 북쪽 그늘 띠(iron 3·4)가 맡는다.
FACE1_BASE = sq(face_strata([
    'SSSWSSSSSSSSISSS',
    'IISIIIIIIISIIIII',
    '4444344444443444',
    '4434444443444444',
    '4444444344444434',
    '3444443444444444',
    '4434444444434443',
    '3333333343333333',
    '3343333333334333',
    '33333j3333334333',
    '33333j3333333433',
    '3343333333333333',
    '333333333j3333j3',
    '3j33333433333333',
    '3334333333333j33',
    '3333j33333433333',
    '3j333333j3333333',
    '3333333334333333',
    '3j3333433333j333',
    '33j33333333333j3',
    '3333333j33334333',
    '33j33433333j3333',
    'j333333334333333',
    '3333j33j3333j343',
    '33j33343333333jj',
    'j333j333j3j43333',
    'jj3jj3jjjjj3jj3j',
    'jjjjjjj2jjjjjj2j',
    'jjjjjjjjjjjjjjjj',
    '2222222j22222222',
    '2222j22222222j22',
    '1112222122221112',
],
    [[(3, 8), (9, 9), (13, 10)], [(10, 15), (16, 14), (22, 13)], [(1, 20), (7, 21)], [(9, 24), (15, 25), (20, 26)]], 'j', '4'),
    16, 32, 'FACE1b')
ICI_3 = ['Wb', 'Wb', 'b.']
FACE1_MID = sq(stamp(FACE1_BASE, [(ICI_3, 10, 2)], wrap=True), 16, 32, 'FACE1')
FACE1_L = [(col('S' + '4' * 29 + '32'), 0, 0),
           (['Wbm', 'Wbm', 'Wbm', 'Wb.', 'Wb.', 'Wb.', '.b.', '.b.', '.c.'], 2, 2), (['Wb', 'Wb', 'Wb', 'b.'], 5, 2)]
FACE1_R = [(col('3' + '2' * 29 + '11'), 7, 0), (['Wbm', 'Wb.', 'Wb.', 'Wb.', 'b..', 'c..'], 1, 2), (['Wb', 'b.'], 4, 2)]

# ================================================================================================ 판 6 — A2
L2 = legend(d=('ice', 0), m=('ice', 1), b=('ice', 2), c=('ice', 3), W=('ice', 4),
            F=('iron', 5), S=('rim', 6), G=('iron', 4), h=('iron', 3), j=('iron', 2), i=('iron', 1), w=('water', 3),
            **{str(i): ('vrock', i) for i in range(1, 5)})

# ---- 얼음굴 바닥 A2 — 더 어두운 바위 바닥: h(iron 3) 바탕에 아주 가까운 4(vrock 4) 잔 얼룩, 밝은 G · 어두운 j 점 드문드문.
G2_BASE = sq([
    'hhhhh4hhhhhh4hhh',
    'h4hh444hhhhh44hh',
    '444hh4hhGhhhhhhh',
    'h4hhhhhhhhjhhh4h',
    'hhhhGhhh4hhhh444',
    'hhhhhhh444hhhh4h',
    'hjhhhhhh4hhhhhhh',
    'hhhh4hhhhhhGhhhh',
    'hhh444hhhhhhhh4h',
    'hhhh4hhhjhhhh44h',
    'h4hhhhhhhh4hhhhh',
    '444hhhhGhh44hhhh',
    'h4hhhhhhhhh4hhjh',
    'hhhhh4hhhhhhhhhh',
    'hhhh444hhhhh4hhh',
    'hGhhh4hhhhhh44hh',
], name='G2')
G2_VARS = [
    [],
    [(['G4', '4j'], 9, 10)],
    [(['.G', 'Gj'], 3, 4), (['j'], 12, 12)],
    [(['GG', '4j'], 11, 2)],
]

# ---- 얼음 A2 — 짙은 얼음 청록 b(ice 2) 바탕에 고르지 않은 서리 자리 c · 드문 반짝 W. 한 장으로 이어진 각진 금 그물:
#      이음 자리를 지나는 금 m(ice 1), 그 금의 안쪽 토막 일부만 짙은 d 로 굵게(H, 변에 닿지 않음) — 무게가 다른 금. 모든 변형의 금은 칸 변의 같은 이음 자리
#      (위·아래 x 5·12, 왼·오른 y 3·10 — 모서리·가운데가 아님)에서만 나가므로 어느 변형끼리 붙어도 이어진다.
#      변형마다 이음 자리를 다르게 잇는다 — 곧게 꿰뚫는 긴 금, 일찍 멈추는 금, 크고 작은 판, 작은 조각.
PORTS2 = ports_of((5, 12), (3, 10))
KINDS2 = {'M': ('m', None, None), 'H': ('d', None, None), 'F': ('m', None, None)}
ICE2_BASE = sq([
    'bbbbbbbbbbbbbbbb',
    'bbccbbbbbbbbbbbb',
    'bcccbbbbbbbcbbbb',
    'bbccbbbbbbccccbb',
    'bbbbbbbbbbbccbbb',
    'bbbbbbWbbbbbbbbb',
    'cbbbbbbbbbbbbbbc',
    'ccbbbbbbbbbbbbcc',
    'bbbbbbbbccbbbbbb',
    'bbbbbbbcccbbbbbb',
    'bbbbbbbbcbbbbbbb',
    'bbbbbbbbbbbbbWbb',
    'bbbccbbbbbbbbbbb',
    'bbcccbbbbbbbcbbb',
    'bbbbbbbbbbbccbbb',
    'bbbbbbbbbbbbbbbb',
], 16, 16, 'ICE2')
ICE2_PATHS = [
    [([(5, 0), (7, 6), (9, 10), (12, 15)], 'M'), ([(0, 3), (7, 6)], 'M'), ([(12, 0), (14, 6), (14, 9), (15, 10)], 'M'),
     ([(15, 3), (14, 4), (14, 6)], 'M'), ([(0, 10), (4, 12), (5, 15)], 'M'), ([(6, 3), (7, 6), (9, 10), (10, 12)], 'H')],
    [([(0, 3), (8, 4), (15, 3)], 'M'), ([(5, 0), (5, 3)], 'M'), ([(12, 0), (10, 4)], 'M'), ([(0, 10), (6, 9), (15, 10)], 'M'),
     ([(5, 15), (6, 9)], 'M'), ([(12, 15), (11, 12)], 'M'), ([(2, 3), (8, 4), (12, 4)], 'H'), ([(9, 6), (10, 7)], 'F')],
    [([(5, 0), (9, 6), (15, 10)], 'M'), ([(12, 0), (13, 2), (15, 3)], 'M'), ([(0, 3), (3, 5), (9, 6)], 'M'),
     ([(0, 10), (4, 12), (5, 15)], 'M'), ([(12, 15), (10, 11), (9, 6)], 'M'), ([(7, 3), (9, 6), (13, 8)], 'H'),
     ([(3, 8), (5, 9)], 'F')],
    [([(0, 10), (7, 9), (15, 10)], 'M'), ([(5, 0), (3, 2), (0, 3)], 'M'), ([(12, 0), (8, 4), (7, 9)], 'M'),
     ([(15, 3), (12, 5)], 'M'), ([(5, 15), (7, 9)], 'M'), ([(12, 15), (13, 12)], 'M'), ([(3, 9), (7, 9), (11, 10)], 'H')],
    [([(5, 0), (6, 6), (4, 11), (5, 15)], 'M'), ([(12, 0), (11, 6), (12, 15)], 'M'), ([(0, 3), (6, 6)], 'M'),
     ([(11, 6), (15, 3)], 'M'), ([(0, 10), (4, 11)], 'M'), ([(15, 10), (12, 10)], 'M'), ([(11, 3), (11, 6), (12, 11)], 'H')],
]
ICE2_FACETS = [[], [], [], [], []]
ICE2_BODIES = [crack_body(ICE2_BASE, p, KINDS2, f, PORTS2) for p, f in zip(ICE2_PATHS, ICE2_FACETS)]
check_ports(ICE2_BODIES, PORTS2, 'm')

# ---- 바위 윗면 A2 — 각진 큰 바위 판: 서리 앉은 윗면(F iron 5 · G iron 4 얼룩 · 푸른 서리 c · 빛 S). 본몸통은 얼룩뿐,
#      곧게 꺾인 틈 i(위 = 푸른 그늘 m, 아래 = 북서 서리 턱 S)는 안쪽 칸 변형에만 있고 칸 가장자리에 닿지 않는다.
#      북·서 가장자리 = 서리 턱 R(S·W), 동 가장자리 = 그늘 D(j·i).
KINDS_T2 = {'M': ('i', 'm', 'S'), 'F': ('G', None, None)}
TOP2_BASE = sq([
    'FFFFSFFFFFFGFFFF',
    'FFFFFFcFFFGGGFFF',
    'FGFFFFFFhFFGGFFF',
    'GGGFFFFFFFFFFSFF',
    'FGGFFFFFSFFFFFFF',
    'FFFFFhFFFFFFFcFF',
    'FFFFcFFFFFSFFFFF',
    'FhFFFFFFFGGFFFFF',
    'FFFFFFFFGGGGFFFF',
    'FFSFFFFFFGFFFSFF',
    'FFFFFFFFFFFFFFcF',
    'FFFFFFcFFFhFFFFF',
    'FFSFFFFFFFFFGGFF',
    'GFFFFFFhFFFGGGFG',
    'GGFFFFFFSFFFFFhF',
    'FFFFFFFFFFFSFFFF',
], 16, 16, 'TOP2')
TOP2_PATHS = [
    [([(2, 3), (5, 5), (6, 9), (10, 11), (13, 12)], 'M'), ([(6, 9), (3, 12)], 'F')],
    [([(12, 2), (10, 6), (11, 9), (7, 12), (4, 13)], 'M')],
    [([(3, 8), (7, 6), (9, 3), (13, 2)], 'M'), ([(7, 6), (9, 10)], 'F')],
    [([(1, 12), (4, 10), (8, 11), (11, 7), (14, 6)], 'M')],
]
TOP2_BODIES = [TOP2_BASE] + [crack_body(TOP2_BASE, p, KINDS_T2, (), set()) for p in TOP2_PATHS]
R2_TEX = ['SWSSWSSSWSSSWSWS', 'WSSSSWSWSSWSSSSW', 'SSWSSSSSSWSSWSSS', 'SWSSWSSWSSSSSWSS'] * 4
D2R_TEX = ['ijijjijjiijjijij', 'jiijjjijjjiijjji', 'jjiijjjiijjjijji', 'ijjjiijjjijijjij'] * 4

# ---- 앞면 A2 — 조용한 16px 주기, A1 보다 어둡다: 끊김 없는 서리 처마(0행 F·S), 처마 밑 1행, 위에서 아래로 어두워지는 낙차(3 → 2 → i → 1),
#      A1 과 반대로(오른쪽이 높게) 완만하게 기운 지층 토막 1(위 빛 턱 3). 가운데엔 짧은 고드름 하나(2px, 열 4)뿐,
#      굵고 긴 고드름 무리는 벽 줄 양 끝 마구리에만. 맨 아래 네 줄 = 가장 어두운 밑동.
FACE2_BASE = sq(face_strata([
    'FFSFFFFFFSFFFFFF',
    'GFGGGFGGGGGFGGGG',
    '3333233333333333',
    '3233333333323333',
    '3333333233333333',
    '2333333333333323',
    '3332323333233333',
    '22232222222j2222',
    '22i2222322222222',
    '2222222222i22232',
    '2j22222223222222',
    '222222i222223222',
    '2222322222222i22',
    'i22222222j222222',
    '23222i2222223222',
    '222222j222i22222',
    '2222222222222232',
    '2i22222232222222',
    '222322222i22222i',
    '2222i222222j2222',
    '2222223222222222',
    '2j222222i2222i22',
    'i2222222222232i2',
    '222i2232i2222222',
    '2i2222222ji222i2',
    'i22i222i222i2222',
    'ii2iii2iii2iiii2',
    'iiiiiiiiiiiiiiii',
    'iiiiiiiiiiiiiiii',
    'iii1iiiiiii1iiii',
    '1i11ii1111i1i111',
    '1111111111111111',
],
    [[(2, 10), (8, 9), (12, 8)], [(11, 17), (17, 16), (24, 15)], [(4, 22), (10, 21)], [(13, 25), (19, 24), (23, 23)]], '1', '3'),
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
        tx = {',': g.body, 'R': grid(R2_TEX, leg), 'D': grid(D2R_TEX, leg)}
    fr, inn = fill(fr_rows, TOP1_INNER, leg, tx)
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
