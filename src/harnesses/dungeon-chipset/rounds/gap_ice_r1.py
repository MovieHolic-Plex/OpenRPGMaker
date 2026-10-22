"""gap-ice-r1 — 얼음 동굴 두 조각(줄 공통). 항목 gap.ice_floor(얼음 바닥 ↔ 얼음굴 바닥) · gap.ice_rock(얼음 바위 채움: 서리 윗면 + 언 바위 앞면).

조수는 지금 버들항 칩셋으로 얼음 동굴을 아예 못 짓는다(거부한다). 이 판의 두 조각 + 얼음굴 바닥(얼음 바닥 오토타일의 바깥,
meta 'autotiles' 의 ground)으로 얼음 동굴 한 벌이 된다. 얼음은 세 줄 어디에도 속하지 않는 별도 재료라 후보는 A1·A2 두 벌.

  A1 「빙하」 — 버들항 설원 얼음판 말씨(tiledata/beodeul-variants/snowfield). 바닥 = 찬 청회색(vrock 2~4) + 바람에 쓸린 눈 결(iron 5).
                얼음 = 옅은 청록(ice 2) + 밝은 면(ice 3·4) + 푸른 금 그물(ice 0, 칸 경계는 정한 자리에서만 건넘).
                가장자리 = 북·서 가는 푸른 선 + 빛 받는 턱, 남 얼음판 두께 두 줄, 동 그늘 한 줄(비대칭, 끊김).
                벽 윗면 = 크기 다른 회색 바윗덩이(stone)에 눈 모자, 사이 찬 청회색 그늘(iron 4).
                앞면 = 찬 청회색 바위(iron) + 서리 막 + 흘러내린 얼음 줄기, 고드름 무리·큰 고드름은 아랫단까지.
  A2 「청빙」 — 바닥 = 어두운 화산암(vrock 2, 큰 어두운 덩이). 얼음 = 맑은 푸른 얼음(ice 1) 속 깊은 자리·얕은 면 + 하얀 균열 그물
                (금 밑 그늘, 반짝은 균열 위만). 가장자리 = 북·서 한 줄 빛 끝, 남 얼음판 두께 세 줄, 동 그늘 한 줄.
                벽 윗면 = 밝은 서리 껍질(iron 5·눈) + 각진 금 + 드러난 바윗덩이. 앞면 = 중간 밝기 화산암 + 굵은 고드름(흰 빛 면·청록 그늘),
                결정 무리는 벽 줄 왼끝 마구리에만. 밝기 = 윗면 밝음 > 앞면 중간 > 바닥 어두움.

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
    for ps, kind in marks:
        ch, hi, lo = kinds[kind]
        for x, y in ps:
            if hi and 0 < y - 1 and (x, y - 1) not in allpts:
                g[y - 1][x] = hi
            if lo and y + 1 < 15 and (x, y + 1) not in allpts:
                g[y + 1][x] = lo
    for ps, kind in marks:
        for x, y in ps:
            g[y][x] = kinds[kind][0]
    return [''.join(r) for r in g]


def ports_of(xs, ys):
    return {(x, 0) for x in xs} | {(x, 15) for x in xs} | {(0, y) for y in ys} | {(15, y) for y in ys}


def check_ports(bodies, ports, crack_chars):
    """모든 몸통이 이음 자리마다 금을 갖는다(이웃 칸 금이 칸 경계에서 끊기지 않게)."""
    for i, b in enumerate(bodies):
        for x, y in ports:
            assert b[y][x] in crack_chars, ('이음 자리에 금이 없다', i, x, y)


# ================================================================================================ A1 「빙하」 — 버들항 설원 얼음판 말씨
# 글자: 얼음 d m b c W = ice 0~4 · 눈 S = rim 6 · 서리 I = iron 5 · 찬 그늘 H = iron 4
#       돌 e g G Z = stone 1·2·4·5 · 바닥 k n p = vrock 2·3·4(384454 566577 7a7f86) · 앞면 바위 1~5 = iron 1~5
L1 = legend(d=('ice', 0), m=('ice', 1), b=('ice', 2), c=('ice', 3), W=('ice', 4),
            S=('rim', 6), I=('iron', 5), H=('iron', 4),
            e=('stone', 1), g=('stone', 2), G=('stone', 4), Z=('stone', 5),
            k=('vrock', 2), n=('vrock', 3), p=('vrock', 4),
            **{str(i): ('iron', i) for i in range(1, 6)})

# ---- 얼음굴 바닥 — 찬 청회색 동굴 바닥(p 바탕) 위로 바람에 쓸린 눈 결(I), 그늘 얼룩(n), 드문 깊은 점(k). 네 단.
G1_BASE = sq([
    'ppppppppnppppppp', 'pppIIIpppppppppp', 'ppIIIIIIpppnpppp', 'pppppIIppppnnppp',
    'pnpppppppppppppp', 'nnppppppppppIIIp', 'pppppppppIIIIIpp', 'pppknppppppIIppp',
    'ppppnpppppppppnp', 'pppppppppppppnnp', 'IIpppnpppppppppI', 'IIIIppppppppppII',
    'pIIppppppkpppppp', 'ppppppppnnpppppp', 'ppppppIIpppppnpp', 'pppnpIIIIppppppp'], name='G1')
STONE1 = ['SI.', 'pnk', '.k.']
DRIFT1 = ['..III', 'IISSI', '.III.']
G1_COMMON = []
G1_VARS = [
    [],
    [(STONE1, 4, 6)],
    [(DRIFT1, 7, 7)],
    [(['k'], 10, 9), (['n', 'k'], 4, 11)],
    [(['.II', 'III', 'n..'], 9, 2)],
]
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

# ---- 바위 윗면 A1 — 서리 앉은 회색 바위 판(G 바탕, 밝은 Z · 그늘 g 덩이), 푸르스름한 서리 모자 I, 눈 웅덩이 S·W.
#      덩이를 가르는 깊은 틈(e, 아래 찬 그늘 H)은 위·아래 열 5, 왼·오른 행 11 에서만 칸을 건너 칸보다 큰 덩이를 만든다.
#      변형마다 틈이 지나는 길이 크게 다르다(세로로만 · 가로로만 · 대각 · 두 갈래).
PORTS_T1 = ports_of((5,), (11,))
KINDS_T1 = {'M': ('e', None, 'H'), 'F': ('g', None, None)}
TOP1_BASE = sq([
    'GGGZZGGGGIIIGGGG', 'GGZZZZGGIIISIGGG', 'GGGZZGGGGIIIGGgG', 'gGGGGGGGGGGGGggg',
    'ggGGGGSSGGGGGGgG', 'GGGGGSWSIGGGGGGG', 'GGGGGGSIIGGZZGGG', 'GIIGGGGGGGZZZZGG',
    'IISIGGGGGGGZZGGg', 'GIIGGGGgGGGGGGgg', 'GGGGGGggGGGGGGGG', 'GGGZGGGGGGGGIIGG',
    'GGZZZGGGGGGISSIG', 'GGGZGGGGGGGGIIGG', 'GgGGGGGSGGGGGGGG', 'ggGGGGGIGGGGGGGg'], name='TOP1')
TOP1_PATHS = [
    [([(5, 0), (6, 6), (0, 11)], 'M'), ([(6, 6), (15, 11)], 'M'), ([(5, 15), (7, 12)], 'M'), ([(10, 2), (12, 3)], 'F')],
    [([(5, 0), (4, 7), (5, 15)], 'M'), ([(0, 11), (3, 10)], 'M'), ([(15, 11), (12, 12)], 'M'), ([(9, 4), (11, 7)], 'F')],
    [([(0, 11), (8, 9), (15, 11)], 'M'), ([(5, 0), (6, 3)], 'M'), ([(5, 15), (4, 13)], 'M'), ([(2, 4), (4, 5)], 'F')],
    [([(5, 0), (9, 5), (15, 11)], 'M'), ([(0, 11), (4, 12), (5, 15)], 'M'), ([(2, 3), (3, 6)], 'F')],
    [([(5, 0), (3, 4), (2, 9), (1, 10), (0, 11)], 'M'), ([(5, 15), (9, 12), (15, 11)], 'M'), ([(10, 3), (12, 6)], 'F')],
]
TOP1_FACETS = [[], [(['.SS.', 'SWSS', 'ISSI'], 9, 8)], [], [(['.SSS', 'SWSI', '.II.'], 3, 6)], []]
TOP1_BODIES = [crack_body(TOP1_BASE, p, KINDS_T1, f, PORTS_T1) for p, f in zip(TOP1_PATHS, TOP1_FACETS)]
check_ports(TOP1_BODIES, PORTS_T1, 'e')
R1_TEX = ['SWSISSWSSISWSSIS', 'WSSSWISSWSSSWISS', 'SISWSSSISWSSISWS', 'SSWSISWSSSWISSSW'] * 4
D1R_TEX = ['gGgHgGggHgGgGgHg', 'GggHgGHgGggHgGgH', 'gHGggGgHgGgGgHgG', 'HgGgGgHggGgHgGgg'] * 4
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

# ---- 앞면 A1 — 찬 청회색 바위(iron 2·3) + 깨진 가로 결(위 밝은 4 · 아래 틈 1, 칸을 넘어 이어짐) + 처마에서 흘러내린 서리 줄(5).
#   0행 눈 처마, 1행 처마 밑 서리. 고드름은 한 칸에 왼쪽 무리(길이 3·8·2) + 오른쪽 긴 것 하나(아랫단 20행까지) — 가운데는 비워 둠.
#   왼 c · 가운데 b · 오른 m, 끝 W. 30~31행 접지 그늘.
FACE1_BASE = (['SWS5SSWS55SWSSS5', '5455545545545455'] + ['3' * 16] * 11 + ['2' * 16] * 17
              + ['2111211121112121', '1111111111111511'])
FACE1_MID = sq(stamp(FACE1_BASE, [
    (['444..44444.4', '111..11111.1'], 3, 10), (['.444444..44', '.111111..11'], 6, 20),                    # 가로 결
    (['.54.', '5443', '4332', '.22.'], 6, 4), (['43', '32'], 14, 6),
    (['.43.', '4332', '3221', '.11.'], 1, 14), (['.43.', '4332', '3221', '.11.'], 9, 15), (['43', '21'], 13, 23),
    (['.43.', '4332', '3221', '.11.'], 3, 24), (['43', '21'], 10, 26),
    (['5', '5', '4', '5', '4', '4'], 7, 2), (['5', '4', '5'], 9, 2), (['5', '5', '4', '4'], 6, 12),           # 서리 줄
    (['ccmc', 'bcmW', 'Wcm.', '.cm.', '.cm.', '.c..', '.b..', '.W..'], 1, 1),                              # 고드름 무리
    (['cbm', 'cbm', 'cbm', 'cbm', 'cbm', 'cbm', '.cm', '.cm', '.cm', '.cm', '.cm', '.cm', '.c.', '.c.', '.c.',
      '.c.', '.b.', '.c.', '.W.'], 11, 1)], wrap=True), 16, 32, 'FACE1')
FACE1_L = [(col('S' + '5' * 9 + '4' * 20 + '21'), 0, 0), (['cm', 'cm', 'c.', 'b.', 'W.'], 3, 1)]
FACE1_R = [(col('5' + '2' * 9 + '1' * 22), 7, 0), (col('.' + '3' * 9 + '2' * 20 + '..'), 6, 0)]

# ================================================================================================ A2 「청빙」
# 글자: 얼음 d m b c W = ice 0~4 · 서리 F = iron 5 · 눈 S = rim 6 · 서리 그늘 G = iron 4 · 바위·바닥 1~4 = vrock 1~4
L2 = legend(d=('ice', 0), m=('ice', 1), b=('ice', 2), c=('ice', 3), W=('ice', 4),
            F=('iron', 5), S=('rim', 6), G=('iron', 4),
            **{str(i): ('vrock', i) for i in range(1, 5)})

# ---- 얼음굴 바닥 — 어둡고 조용한 바위 바닥(vrock 2 바탕, 큰 어두운 덩이 1). 서리 가루·잔돌은 변형에만.
G2_BASE = sq([
    '2222222222222222', '2221112222222222', '2211111222222222', '2221112222222112',
    '2222222222221111', '2222222222222112', '2222222222222222', '2222222222222222',
    '2222222211122222', '1222222111112222', '1122222211122222', '1222222222222222',
    '2222222222222222', '2222112222222222', '2221111222222222', '2222122222222222'], name='G2')
G2_COMMON = []
G2_VARS = [
    [],
    [(['.G', 'G.'], 5, 5), (['34', '21'], 11, 10)],
    [(['G.G', '.G.'], 9, 3), (['G'], 3, 11)],
    [(['.43', '432', '.1.'], 4, 6), (['G'], 12, 12)],
    [(['G', '.G'], 10, 8)],
]
G2_N = [3, 3, 4, 4, 3, 3, 2, 3, 3, 3, 3, 4, 4, 3, 2, 2, 3, 3, 4, 3, 3, 3, 2, 2, 3, 3, 4, 4, 3, 3, 3, 3]
G2_W = [2, 2, 1, 1, 2, 2, 2, 3, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1, 1, 2, 2, 2, 3, 2, 2, 2, 1, 2, 2, 2]

# ---- 얼음 몸통 A2 — 맑은 푸른 얼음(m 바탕) 속 깊은 자리 d · 얕은 면 b. 하얀 균열(c, 굵은 것) · 가는 균열(b, 칸 안에서만).
#   굵은 균열은 위·아래 열 12, 왼·오른 행 7 에서만 칸을 건넌다. 변형마다 다각형 크기·모양이 크게 다르다(긴 가로 금, V 자, 세로 금 …).
PORTS2 = ports_of((12,), (7,))
KINDS2 = {'M': ('c', None, None), 'F': ('b', None, None)}
ICE2_BASE = sq([
    'mmmmmmmmmmmmmmmm', 'mmmmmmmmmmmbmmmm', 'mmbbmmmmmmmmmmmm', 'mmmmmmmmmmmmmmmm',
    'mmmmmmmmmmmmmmmm', 'mmmmmmmmdddmmmmm', 'mmmmmmmddddmmmmm', 'mmmmmmmmddmmmmmm',
    'mmmmmmmmmmmmmmmm', 'mmmmmmmmmmmmmbbm', 'mmmmmmmmmmmmmmmm', 'mmdmmmmmmmmmmmmm',
    'mddmmmmmmmmmmmmm', 'mmmmmmmmmmmmmmmm', 'mmmmmmbmmmmmmmmm', 'mmmmmmmmmmmmmmmm'], name='ICE2')
ICE2_PATHS = [
    [([(12, 0), (10, 5), (0, 7)], 'M'), ([(10, 5), (13, 10), (12, 15)], 'M'), ([(13, 10), (15, 7)], 'M'),
     ([(3, 10), (6, 12)], 'F')],
    [([(0, 7), (7, 9), (15, 7)], 'M'), ([(12, 0), (11, 4), (7, 9)], 'M'), ([(12, 15), (10, 12)], 'M'), ([(3, 3), (6, 4)], 'F')],
    [([(12, 0), (10, 6), (12, 11), (12, 15)], 'M'), ([(0, 7), (5, 6), (10, 6)], 'M'), ([(12, 11), (15, 7)], 'M'),
     ([(4, 10), (6, 12)], 'F')],
    [([(12, 0), (14, 4), (14, 6), (15, 7)], 'M'), ([(0, 7), (4, 11), (9, 12), (12, 15)], 'M'), ([(5, 3), (8, 5)], 'F')],
    [([(0, 7), (3, 3), (11, 1), (12, 0)], 'M'), ([(15, 7), (9, 10), (12, 15)], 'M'), ([(4, 10), (6, 13)], 'F')],
]
SHEEN = ['..bb', '.bb.', 'bb..']
ICE2_FACETS = [
    [(SHEEN, 2, 1), (['W'], 13, 12)],
    [(SHEEN, 9, 9), (['W'], 6, 2)],
    [(SHEEN, 1, 10), (['W'], 13, 4)],
    [(SHEEN, 11, 3), (['W'], 6, 13)],
    [(SHEEN, 2, 10), (['W'], 10, 9)],
]
ICE2_BODIES = [crack_body(ICE2_BASE, p, KINDS2, f, PORTS2) for p, f in zip(ICE2_PATHS, ICE2_FACETS)]
check_ports(ICE2_BODIES, PORTS2, 'c')
ICE2_FROZEN = [
    sq(['mmmmmmmmmmmm', 'mmmmddddmmmm', 'mmmd2222dmmm', 'mmd234432dmm', 'md23443321dm', 'md2343W321dm',
        'md22332211dm', 'mmd122211dmm', 'mmmd1111dmmm', 'mmmmddddmmmm', 'mmmmmmmmmbmm', 'mmmmmmmmmmmm'], 12, 12),
    sq(['mmmmmmmmmmmm', 'mmmmmmmmmmmm', 'mmmmmmmmmmmm', 'mmmmmddddmmm', 'mmmmd2344dmm', 'mmmmd3W32dmm',
        'mmmmd2221dmm', 'mmmmmddddmmm', 'mmmmmmmmmmmm', 'mmmmmmmmmmmm', 'mmmmmmmmmmmm', 'mmmmmmmmmmmm'], 12, 12),
]

# ---- 얼음 가장자리 A2 — 북·서 = 한 줄 빛 받는 끝 P(b·c, 끊김), 남 = 얼음판 앞 두께 D D(d) + E(d·m), 동 = 그늘 D 한 줄.
P2_TEX = ['bcbbcbbbcbbcbbbc', 'cbbcbbcbbbcbbcbb', 'bbcbbbbcbcbbbbcb', 'bcbbcbbbbbbcbcbb'] * 4
D2_TEX = ['dddddddmdddddddd', 'dddmdddddddddmdd', 'ddddddddddmddddd', 'dmdddddddddddddm'] * 4
E2_TEX = ['mdmmdmmmdmmmmdmm', 'mmmdmmdmmmdmmmmd', 'dmmmmmmdmmmmdmmm', 'mmdmmdmmmmmmmmdm'] * 4
IF2_N = ',P......'
IF2_S = ',DDE....'
IF2_E = ',D......'
IF2_NW = [',,,,,,,,', ',,,,,PPP', ',,,PP...', ',,P.....', ',P......', ',P......', ',P......', ',P......']
IF2_NE = [',,,,,,,,', 'PPPP,,,,', '....D,,,', '.....D,,', '......D,', '......D,', '......D,', '......D,']
IF2_SW = [',P......', ',P......', ',P......', ',P......', ',,DEEEEE', ',,DDDDDD', ',,,,DDDD', ',,,,,,,,']
IF2_SE = ['......D,', '......D,', '......D,', '......D,', 'EEEEEDD,', 'DDDDDD,,', 'DDDD,,,,', ',,,,,,,,']
IF2_FRAME = frame(IF2_NW, IF2_NE, IF2_SW, IF2_SE, uni(IF2_N), uni(IF2_S), uni(IF2_N), uni(IF2_E))
IF2_INNER = inner4([',P......', 'P.......'] + ['........'] * 6,
                   ['......D,', '.......D'] + ['........'] * 6,
                   ['........'] * 5 + ['E.......', 'DE......', ',D......'],
                   ['........'] * 5 + ['.......E', '......DD', '.....DD,'])
check_frame('A2 얼음 틀', IF2_FRAME, IF2_INNER, strict_inner=False)
WOB_ICE2 = check_wob({
    'N': [0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 2, 2, 1, 0, 0],
    'S': [0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 2, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0],
    'W': [0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0],
    'E': [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 0, 0, 0, 0]})

# ---- 바위 윗면 A2 — 밝은 서리 껍질(F 바탕, 눈 S · 서리 그늘 G 얼룩). 얕은 골(G, 아래·오른쪽 빛 S)이 껍질을 각진 면으로 나누고,
#      몇 개는 깊은 금(2). 골은 위·아래 열 10, 왼·오른 행 5 에서만 칸을 건넌다. 드러난 바윗덩이(4 3 2 + 눈 모자)는 변형에만.
PORTS_T2 = ports_of((10,), (5,))
KINDS_T2 = {'M': ('G', None, 'S'), 'K': ('2', 'G', 'S')}
TOP2_BASE = sq([
    'FFFFFFFFFFFFFFFF', 'FFFSSFFFFFFFFFFF', 'FFSSSFFFFFFFFFFF', 'FFFFFFFFFFFFFFFF',
    'FFFFFFFFFFFFFFFF', 'FFFFFFFFFFFFFFFF', 'FFFFFFFFFFFFFFSF', 'FFFFFFFFFFFFFSSF',
    'FFFFFFFFFFFFFFFF', 'FSFFFFFFFFFFFFFF', 'SSFFFFFFFFFFFFFF', 'FFFFFFFFFFGFFFFF',
    'FFFFFFFFFFFFFFFF', 'FFFFFSSFFFFFFFFF', 'FFFFSSSFFFFFFFFF', 'FFFFFFFFFFFFFFFF'], name='TOP2')
TOP2_PATHS = [
    [([(10, 0), (8, 4), (0, 5)], 'M'), ([(8, 4), (15, 5)], 'M'), ([(10, 15), (11, 11)], 'M'), ([(3, 9), (5, 11)], 'M')],
    [([(10, 0), (11, 6), (10, 15)], 'M'), ([(0, 5), (4, 6), (11, 6)], 'M'), ([(15, 5), (13, 5)], 'M'),
     ([(4, 10), (5, 12)], 'M')],
    [([(0, 5), (7, 7), (15, 5)], 'M'), ([(10, 0), (9, 2)], 'M'), ([(10, 15), (8, 12), (7, 7)], 'M'),
     ([(12, 10), (13, 12)], 'M')],
    [([(10, 0), (12, 3), (15, 5)], 'M'), ([(0, 5), (5, 9), (10, 15)], 'M'), ([(6, 2), (7, 4)], 'M')],
    [([(10, 0), (10, 4), (0, 5)], 'M'), ([(15, 5), (12, 8), (10, 15)], 'M'), ([(3, 11), (5, 12)], 'M')],
]
CHUNK2 = ['.SSS.', 'SS443', 'S4433', '.333.']
TOP2_FACETS = [[], [], [(CHUNK2, 2, 9)], [(CHUNK2, 10, 8)], [(['.SS', 'S44', '433'], 3, 2)]]
TOP2_BODIES = [crack_body(TOP2_BASE, p, KINDS_T2, f, PORTS_T2) for p, f in zip(TOP2_PATHS, TOP2_FACETS)]
check_ports(TOP2_BODIES, PORTS_T2, 'G')
R2_TEX = ['SFSWSSFSSWSFSSFS', 'FSSWSFSSFSWSSFSS', 'SWSFSSSFSWSSFSSW', 'SSFSWSSFSSFSWSSF'] * 4
D2R_TEX = ['GFGGFGGFGGGFGFGG', 'FGGFGGFGFGGFGGFG', 'GGFGFGGGFGFGGFGF', 'GFGGGFGFGGFGGGFG'] * 4
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

# ---- 앞면 A2 — 밝고 찬 화산암(4 바탕, 아랫단 3), 덩이(왼·위 서리 F · 그늘 2·3), 처마에서 흘러내린 서리 줄(G·F).
#   0행 서리 처마(F S), 1행 처마 밑. 굵은 고드름: 열 2~6 다섯 겹으로 시작해 17행까지(아랫단으로 내려옴), 열 10~12 세 겹 10행, 열 14 짧게 4.
#   흰 빛 면 W · c · 청록 그늘 m. 30~31행 접지 그늘. 결정 무리는 왼끝 마구리에만 하나.
FACE2_BASE = (['FFSFSFFSFFFSFSFF', 'GFFGFGFFGFGFFGFF'] + ['4' * 16] * 28 + ['3433343334433343', '3332333233323333'])
FACE2_MID = sq(stamp(FACE2_BASE, [
    (['.F4.', 'F443', '4433', '.33.'], 7, 11), (['F4', '43'], 13, 13), (['.F4.', 'F443', '4433', '.33.'], 1, 20),
    (['.43.', '4332', '3322', '.22.'], 9, 19), (['43', '32'], 5, 25), (['.43.', '4332', '3322', '.22.'], 12, 25),
    (['G', 'F', 'G', 'G', 'F', 'G', 'G', 'G'], 8, 2), (['G', 'G', 'F', 'G', 'G', 'G', 'G'], 15, 5),     # 서리 줄
    (['WWccm', 'WWccm', 'Wccmm', 'Wccm.', '.Wcm.', '.Wcm.', '.Wcm.', '.Wcm.', '.Wm..', '.cm..', '.cm..', '.c...',
      '.c...', '.c...', '.b...', '.c...', '.W...'], 2, 1),                                              # 큰 고드름
    (['Wcm', 'Wcm', 'Wcm', 'Wm.', 'cm.', 'cm.', 'c..', 'c..', 'b..', 'W..'], 10, 1),                     # 중간
    (['c', 'c', 'b', 'W'], 14, 1)], wrap=True), 16, 32, 'FACE2')
CRY2 = ['..W...', '..cd..', '.Wcd.W', '.cmdcd', 'Wcmdcd', 'cmd1md', '1111d1']
FACE2_L = [(col('S' + 'F' * 3 + '4' * 12 + '3' * 14 + '32'), 0, 0), (CRY2, 1, 21)]
FACE2_R = [(col('3' + '2' * 29 + '11'), 7, 0), (col('.' + '3' * 29 + '..'), 6, 0)]


# ================================================================================================ 조립
def ground_parts(n):
    if n == 1:
        return G1_BASE, G1_COMMON, G1_VARS, L1, G1_N, G1_W, legend(**{'1': ('vrock', 2), '2': ('vrock', 3)})
    return G2_BASE, G2_COMMON, G2_VARS, L2, G2_N, G2_W, legend(**{'1': ('vrock', 1), '2': ('vrock', 1)})


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
    'A1': '「빙하」 — 버들항 설원 얼음판 말씨: 옅은 청록 얼음 + 푸른 금 그물 + 밝은 면, 선 없는 비대칭 가장자리(서리 번짐 · 남 두께) · 찬 청회색 바닥 + 바람 눈 결 · '
          '서리 모자 회색 바위 덩이(칸을 넘는 틈) 윗면 + 가로 결·서리 줄 청회색 앞면(고드름 무리 + 긴 것 하나)',
    'A2': '「청빙」 — 맑은 푸른 얼음 + 하얀 균열 그물(금 밑 그늘) · 어두운 화산암 바닥 · '
          '밝은 서리 껍질 윗면(각진 금·드러난 덩이) + 중간 밝기 바위 앞면(굵은 고드름, 결정은 줄 왼끝에만)',
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
