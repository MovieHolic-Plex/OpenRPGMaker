"""gap-ice-r1 — 얼음 동굴 두 조각(줄 공통). 항목 gap.ice_floor(얼음 바닥 ↔ 얼음굴 바닥) · gap.ice_rock(얼음 바위 채움: 서리 윗면 + 언 바위 앞면).

조수는 지금 버들항 칩셋으로 얼음 동굴을 아예 못 짓는다(거부한다). 이 판의 두 조각 + 얼음굴 바닥(얼음 바닥 오토타일의 바깥,
meta 'autotiles' 의 ground)으로 얼음 동굴 한 벌이 된다. 얼음은 세 줄 어디에도 속하지 않는 별도 재료라 후보는 A1·A2 두 벌.

  A1 「빙하」 — 버들항 설원 얼음판 말씨(tiledata/beodeul-variants/snowfield). 바닥 = 다져진 눈(rim 6, 드문 서리 그늘·눈 모자 잔돌).
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


def crack_body(base, paths, crack, under=None, facets=(), ports=None):
    """얼음 몸통: 바탕 + 면 덧그림(안쪽) + 손으로 고른 꼭짓점을 잇는 금. 금은 칸 가장자리를 정해 둔 자리(ports)에서만 건넌다 —
    변형마다 안쪽 길은 달라도 이웃 칸의 금과 이어진다. under = 금 바로 아래 화소(빛이 위에서 와 금 밑이 그늘)."""
    g = [list(r) for r in stamp(base, list(facets), inner=True)]
    pts = set()
    for p in paths:
        for x, y in poly(*p):
            pts.add((x % 16, y % 16))
    if ports is not None:
        edge = {(x, y) for x, y in pts if x in (0, 15) or y in (0, 15)}
        assert edge <= ports, ('금이 정한 자리 밖에서 칸 가장자리를 건넌다', sorted(edge - ports))
    if under:
        for x, y in pts:
            X, Y = x, (y + 1) % 16
            if (X, Y) not in pts and 0 < Y < 15:
                g[Y][X] = under
    for x, y in pts:
        g[y][x] = crack
    return [''.join(r) for r in g]


def ports_of(xs, ys):
    return {(x, 0) for x in xs} | {(x, 15) for x in xs} | {(0, y) for y in ys} | {(15, y) for y in ys}


# ================================================================================================ A1 「빙하」 — 버들항 설원 얼음판 말씨
# 글자: 얼음 d m b c W = ice 0~4 · 눈 S = rim 6 · 서리 I = iron 5 · 찬 그늘 H = iron 4
#       돌 e g G Z = stone 1·2·4·5(3e403d 595b58 929491 c4c6c3) · 앞면 바위 1~4 = iron 1~4(3a4050 5e6678 757a90 8c94a6), 5 = iron 5
L1 = legend(d=('ice', 0), m=('ice', 1), b=('ice', 2), c=('ice', 3), W=('ice', 4),
            S=('rim', 6), I=('iron', 5), H=('iron', 4),
            e=('stone', 1), g=('stone', 2), G=('stone', 4), Z=('stone', 5),
            **{str(i): ('iron', i) for i in range(1, 6)})

# ---- 얼음굴 바닥 — 다져진 눈(버들항 ground-snow 처럼 조용히). 바탕 S, 드문 서리 그늘 I. 잔돌·발자국 같은 오목은 변형에만.
G1_BASE = sq(['S' * 16] * 2 + ['SSSSSSSSSSSIISSS', 'SSSSSSSSSSSSISSS'] + ['S' * 16] * 5
             + ['SSSISSSSSSSSSSSS', 'SSIISSSSSSSSSSSS'] + ['S' * 16] * 5, name='G1')
SNOW_STONE = ['.SS.', 'SZGg', 'GGge', '.HH.']       # 눈 모자 쓴 잔돌(왼·위 눈, 아래 찬 그늘)
SNOW_STONE_S = ['SZ', 'ge', 'H.']
SNOW_DENT = ['.II', 'IIS']
G1_COMMON = []
G1_VARS = [
    [],
    [(SNOW_STONE, 4, 5)],
    [],
    [(SNOW_STONE_S, 10, 9)],
    [(['I'], 7, 6)],
]
G1_N = [3, 3, 3, 4, 4, 3, 3, 3, 3, 4, 3, 3, 2, 2, 3, 3, 3, 3, 2, 2, 3, 4, 4, 3, 3, 3, 3, 2, 2, 3, 3, 3]
G1_W = [2, 2, 2, 2, 2, 1, 1, 2, 2, 2, 2, 1, 1, 2, 2, 2, 2, 2, 1, 1, 2, 2, 3, 2, 2, 2, 2, 2, 1, 1, 2, 2]
G_INNER = (['12......' + '....2111', '22......' + '......22', '2.......' + '.......2']
           + ['.' * 16] * 10 + ['.' * 16, '1.......' + '.' * 8, '12......' + '.' * 8])

# ---- 얼음 몸통 — 옅은 청록(b) 바탕, 더 밝은 면(c), 반짝 W, 금 그물(d). 금은 위·아래 열 4·11, 왼·오른 행 6·13 에서만 칸을 건넌다.
PORTS1 = ports_of((6,), (10,))
ICE1_BASE = sq([
    'bbbbbbbbbbbbbbbb', 'bbbcccbbbbbbbbbb', 'bbccccbbbbbbcccb', 'bbbbbbbbbbbccbbb',
    'bbbbbbbbbbbbbbbb', 'ccbbbbbbbbbbbbbc', 'cbbbbbccccbbbbbb', 'bbbbbbbccbbbbbbb',
    'bbbbbbbbbbbbbbbb', 'bbbbbbbbbbbbbcbb', 'bbcccbbbbbbbcccb', 'bccccbbbbbbbbbbb',
    'bbbbbbbbbbbbbbbb', 'bbbbbbbcccbbbbbb', 'bbbbbbccccbbbbbb', 'bbbbbbbbbbbbbbbb'], name='ICE1')
ICE1_PATHS = [
    [[(6, 0), (7, 4), (10, 8), (15, 10)], [(0, 10), (3, 12), (6, 15)], [(7, 4), (3, 6)]],
    [[(6, 0), (5, 5), (6, 9), (6, 15)], [(0, 10), (3, 9), (6, 9)], [(6, 9), (11, 8), (15, 10)]],
    [[(6, 0), (3, 4), (1, 8), (0, 10)], [(6, 15), (9, 11), (15, 10)], [(9, 11), (11, 6)]],
    [[(6, 0), (8, 5), (12, 7), (15, 10)], [(0, 10), (5, 11), (8, 13), (6, 15)]],
    [[(0, 10), (4, 7), (8, 7), (15, 10)], [(6, 0), (7, 3), (6, 7)], [(6, 15), (7, 11), (7, 7)]],
]
FACET = ['..ccc', '.ccWc', 'ccc..']
FACET_L = ['cc..', 'ccc.', '.ccc']
RING = ['.dd.', 'd..d', 'd..d', '.dd.']
ICE1_FACETS = [
    [(FACET, 10, 2), (['W'], 3, 9), (['m'], 12, 13)],
    [(FACET_L, 9, 2), (['cW'], 2, 5), (['m'], 11, 12)],
    [(FACET, 6, 3), (['W'], 12, 12), (['m', 'm'], 3, 12)],
    [(RING, 2, 3), (FACET_L, 9, 11), (['W'], 11, 2)],
    [(FACET, 2, 2), (['W'], 11, 4), (['m'], 3, 12), (['cW'], 10, 12)],
]
ICE1_BODIES = [crack_body(ICE1_BASE, p, 'd', None, f, PORTS1) for p, f in zip(ICE1_PATHS, ICE1_FACETS)]
ICE1_FROZEN = [
    sq(['bbbbbbbbbbbb', 'bbbbbbbbbbbb', 'bbbmmmmmmbbb', 'bbmZZZGGgmbb', 'bmZGZGGggemb', 'bmGZGGcggemb',
        'bmGGGgcgeemb', 'bmgGggggeemb', 'bbmeeeeeembb', 'bbbmmmmmmbbb', 'bbbbbbbbbcbb', 'bbbbbbbbbbbb'], 12, 12),
    sq(['bbbbbbbbbbbb', 'bbmmmmbbbbbb', 'bmZZGgmbbbbb', 'bmGcgembbbbb', 'bmggeembbbbb', 'bbmmmmbbbbbb',
        'bbbbbbbmmmmb', 'bbbbbbmZZGgm', 'bbbbbbmGcgem', 'bbbbbbmggeem', 'bbbbbbbmmmmb', 'bbbbbbbbbbbb'], 12, 12),
]

# ---- 얼음 가장자리 A1 — 비대칭: 북·서 = 눈과 얼음 사이 가는 푸른 선 U(끊김) + 빛 받는 턱 P(W·c, 끊김),
#      남 = 얼음판 앞 두께 D(d) 두 줄(둘째 줄 E 는 d·m 섞임), 동 = 가는 그늘 D 한 줄.
U1_TEX = ['mmmbmmmmmbmmmmmb', 'mmmmmbmmmmmmbmmm', 'bmmmmmmmbmmmmmmm', 'mmbmmmmmmmmbmmmm'] * 4
P1_TEX = ['WcWbWWcWbcWWcbWc', 'cWWcbWWcWWbcWWcW', 'WbcWWcWbWcWWbWWc', 'cWWbcWWcbWWcWbcW'] * 4
D1_TEX = ['dddddmdddddddmdd', 'ddmdddddddmddddd', 'ddddddddmddddddm', 'dmddddmddddddddd'] * 4
E1_TEX = ['mdmmdmmmdmmmmdmm', 'mmmdmmdmmmdmmmmd', 'dmmmmmmdmmmmdmmm', 'mmdmmdmmmmmmmmdm'] * 4
IF1_N = ',UP.....'
IF1_S = ',DE.....'
IF1_E = ',D......'
IF1_NW = [',,,,,,,,', ',,,,,,UU', ',,,,UUPP', ',,,UPP..', ',,UP....', ',UP.....', ',UP.....', ',UP.....']
IF1_NE = [',,,,,,,,', 'UU,,,,,,', 'PPUD,,,,', '...DD,,,', '.....D,,', '......D,', '......D,', '......D,']
IF1_SW = [',UP.....', ',UP.....', ',UP.....', ',,UE....', ',,DEE...', ',,,DDEEE', ',,,,,DDD', ',,,,,,,,']
IF1_SE = ['......D,', '......D,', '......D,', '.....ED,', '....EDD,', 'EEEEDD,,', 'DDDD,,,,', ',,,,,,,,']
IF1_FRAME = frame(IF1_NW, IF1_NE, IF1_SW, IF1_SE, uni(IF1_N), uni(IF1_S), uni(IF1_N), uni(IF1_E))
IF1_INNER = inner4([',U......', 'UP......', 'P.......'] + ['........'] * 5,
                   ['......D,', '.......D'] + ['........'] * 6,
                   ['........'] * 5 + ['E.......', 'DE......', ',D......'],
                   ['........'] * 5 + ['.......E', '......ED', '.....ED,'])
check_frame('A1 얼음 틀', IF1_FRAME, IF1_INNER, strict_inner=False)
WOB_ICE1 = check_wob({
    'N': [0, 0, 1, 1, 1, 2, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 1, 0],
    'S': [0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 2, 2, 1, 0, 0, 0],
    'W': [0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 2, 2, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 1, 0, 0],
    'E': [0, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0]})

# ---- 바위 윗면 A1 — 눈 모자 쓴 바윗덩이(버들항 설원 rock 말씨): 덩이마다 왼·위 눈 S·W, 몸 Z G g, 아래 e, 덩이 사이 찬 그늘 H(서리 I).
TOP1_MAIN = sq([
    'HHHHIHHHHHHSSSHH', 'HHHSSSSHHHSWSSSH', 'HHSWSSSSSHZZSGGH', 'HSSSZZSSZHGGGGgH',
    'HZZGZGGZGgggggeH', 'HZGGGGGGggHeeeeH', 'HGGGgGgggeHHHIHH', 'HgggggggeeHHHHHH',
    'HHeeeeeeeHHHHHHH', 'HHHHHIHHHHSSSSHH', 'HSSHHHHHHSWSSZSH', 'HZGgHSSHHZGZGGgH',
    'GggeSZGgeGGGgggg', 'HeeHGgeeHgggggeH', 'HHHHHeeHHHeeeeeH', 'HHIHHHHHHHHHHIHH'], name='TOP1')
TOP1_VARS = [
    [],
    [(['.SSS.', 'SSWSS', 'ISSSI', '.III.'], 2, 9)],                                      # 눈 더미가 덩이를 덮음
    [(['e.', 'He', '.e'], 7, 3), (['S'], 12, 5)],                                        # 덩이 금 + 눈 조각
    [(['.SSSS.', 'SSWSSS', 'SSSSSI', 'ISSSII', '.IIII.'], 2, 2)],                        # 큰 덩이가 눈에 덮임
    [(['.SS', 'SZG', 'Gge'], 11, 10)],                                                   # 작은 눈 모자 덩이
]
R1_TEX = ['SWSISSWSSISWSSIS', 'WSSSWISSWSSSWISS', 'SISWSSSISWSSISWS', 'SSWSISWSSSWISSSW'] * 4
D1R_TEX = ['egeHegeegHegeegH', 'geeHegHegeeHeggH', 'eHgeegeHegegeHeg', 'HegegeHeegeHegee'] * 4
_TN1 = lambda k, m: 'R'  # noqa: E731
_TE1 = lambda k, m: 'D'  # noqa: E731
TOP1_N = strips([(1, 2), (0, 2), (0, 1), (1, 3), (2, 3), (1, 2), (2, 4), (1, 2),
                 (1, 2), (2, 3), (3, 4), (2, 4), (1, 2), (0, 1), (0, 2), (1, 2)], _TN1, ',')
TOP1_W = strips([(1, 2), (1, 3), (2, 3), (1, 2), (0, 1), (1, 2), (2, 3), (1, 2),
                 (1, 2), (0, 2), (1, 2), (2, 4), (3, 4), (2, 3), (1, 2), (1, 2)], _TN1, ',')
TOP1_E = strips([(1, 2), (1, 2), (2, 3), (2, 3), (1, 2), (0, 1), (1, 2), (1, 2),
                 (1, 2), (2, 3), (1, 3), (1, 2), (0, 2), (1, 2), (2, 3), (1, 2)], _TE1, ',')
TOP_S0 = strips([(0, 0)] * 16, _TE1, ',')
TOP1_NW = [',,,,,,,,', ',,,,,,RR', ',,,RRR..', ',,RR....', ',R......', ',R......', ',R......', ',R......']
TOP1_NE = [',,,,,,,,', 'RR,,,,,,', '..RD,,,,', '....D,,,', '.....D,,', '......D,', '......D,', '......D,']
TOP1_SW = [',R......'] * 8
TOP1_SE = ['......D,'] * 8
TOP1_FRAME = frame(TOP1_NW, TOP1_NE, TOP1_SW, TOP1_SE, TOP1_N, TOP_S0, TOP1_W, TOP1_E)
TOP1_INNER = inner4([',R......', 'R.......'] + ['........'] * 6,
                    ['......D,', '.......D'] + ['........'] * 6,
                    ['........'] * 8, ['........'] * 8)
check_frame('A1 바위 윗면 틀', TOP1_FRAME, TOP1_INNER, strict_inner=False)
WOB_TOP1 = check_wob({
    'N': [0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 2, 1, 1, 1, 0, 0],
    'S': [0] * 32,
    'W': [0, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 1, 0],
    'E': [0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0]})

# ---- 앞면 A1 — 찬 청회색 바위(iron 2·3, 덩이 왼·위 4, 그늘 1), 서리 막 5, 얼음 줄기(b·m)가 흘러내림.
#   0행 눈 처마(S W, 끊김 5), 1행 처마 밑 서리. 고드름: 열 2~4 무리(길이 4·7·2), 열 8~10 큰 것(위 세 겹 → 두 겹 → 한 겹, 19행까지
#   — 아랫단으로 내려옴), 열 13 짧게 3, 열 15 2. 왼 c·가운데 b·오른 m, 끝 W. 30~31행 접지 그늘.
FACE1_BASE = (['SWSS5SSWSSS5SWSS', '5455545545545455'] + ['3' * 16] * 8 + ['2' * 16] * 20
              + ['2111211121112121', '1111151111111111'])
FACE1_MID = sq(stamp(FACE1_BASE, [
    (['.54.', '5443', '4332', '.22.'], 0, 3), (['.54.', '5443', '4332', '.22.'], 11, 5), (['43', '32'], 6, 8),
    (['.43.', '4332', '3221', '.11.'], 5, 12), (['.43.', '4332', '3221', '.11.'], 12, 17), (['43', '21'], 1, 15),
    (['.43.', '4332', '3221', '.11.'], 2, 21), (['43', '21'], 8, 24), (['.43.', '4332', '3221', '.11.'], 11, 25),
    (['55', '5.'], 7, 10), (['5'], 13, 22), (['.5', '55'], 3, 26), (['5'], 15, 13),
    (['cm', 'bm', 'bm', 'b.', 'bm', '.bm', '.bm', '.b.', '.bm', 'bm.', 'bm.', 'b..', 'm..'], 5, 2),      # 얼음 줄기
    (['cbm', 'cbm', 'cb.', 'Wb.', '.b.', '.c.', '.W.'], 2, 1),                                          # 고드름 무리
    (['cbm', 'cbm', 'cbm', 'cbm', 'cbm', '.cm', '.cm', '.cm', '.cm', '.cm', '.cb', '.c.', '.c.', '.b.', '.c.',
      '.b.', '.c.', '.b.', '.W.'], 8, 1),                                                               # 큰 고드름
    (['c', 'b', 'W'], 13, 1), (['c', 'W'], 15, 1)], wrap=True), 16, 32, 'FACE1')
FACE1_L = [(col('S' + '5' * 9 + '4' * 20 + '21'), 0, 0)]
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

# ---- 얼음 몸통 A2 — 맑은 푸른 얼음(m 바탕) 속 깊은 자리 d, 얕은 면 b. 하얀 균열 그물(c, 바로 밑 그늘 d), 반짝 W 는 균열 위에만.
#   균열은 위·아래 열 6·13, 왼·오른 행 3·10 에서만 칸을 건넌다.
PORTS2 = ports_of((11,), (4,))
ICE2_BASE = sq([
    'mmmmmmdmmmmmmmmm', 'mmmmmddmmmmbmmmm', 'mmbmmmmmmmmbbmmm', 'mbbmmmmmmmmmmmmm',
    'mmmmmmmmmddmmmmm', 'mmmmmmmmdddmmmmm', 'dmmmmmmmmdmmmmmd', 'mmmmbmmmmmmmmmdd',
    'mmmbbmmmmmmmmmmm', 'mmmmmmmmmmmmbmmm', 'mmmmmmmdmmmbbmmm', 'mmmmmmddmmmmmmmm',
    'mmdmmmmmmmmmmmmm', 'mddmmmmmmmmmmmdm', 'mmmmmmmmbmmmmmmm', 'mmmmmmmbbmmmmmmm'], name='ICE2')
ICE2_PATHS = [
    [[(11, 0), (10, 4), (12, 9), (11, 15)], [(0, 4), (5, 6), (10, 4)]],
    [[(11, 0), (13, 3), (15, 4)], [(0, 4), (4, 8), (9, 11), (11, 15)], [(4, 8), (3, 12)]],
    [[(0, 4), (6, 3), (15, 4)], [(11, 0), (10, 3)], [(11, 15), (13, 10), (10, 6)]],
    [[(11, 0), (8, 6), (0, 4)], [(8, 6), (12, 10), (11, 15)], [(12, 10), (15, 4)]],
]
DEEP = ['.dd.', 'dddd', '.dd.']
DEEP_L = ['.ddd.', 'ddddd', '.ddd.']
SHEEN = ['..bb', '.bb.', 'bb..']
ICE2_FACETS = [
    [(DEEP, 2, 9), (SHEEN, 3, 1), (['W'], 13, 12)],
    [(DEEP_L, 7, 1), (SHEEN, 10, 8), (['W'], 2, 2)],
    [(DEEP, 3, 8), (SHEEN, 8, 9), (['W'], 6, 12)],
    [(DEEP_L, 2, 9), (SHEEN, 3, 1), (['W'], 13, 13)],
]
ICE2_BODIES = [crack_body(stamp(ICE2_BASE, []), p, 'c', 'd', f, PORTS2) for p, f in zip(ICE2_PATHS, ICE2_FACETS)]
# 반짝: 균열 위 몇 자리만 W
_SPARK = [[(12, 9), (5, 6)], [(13, 3), (9, 11)], [(6, 3), (13, 10)], [(8, 6), (12, 10)]]
for _i, _pts in enumerate(_SPARK):
    _g = [list(r) for r in ICE2_BODIES[_i]]
    for _x, _y in _pts:
        assert _g[_y][_x] == 'c', (_i, _x, _y)
        _g[_y][_x] = 'W'
    ICE2_BODIES[_i] = [''.join(r) for r in _g]
ICE2_FROZEN = [
    sq(['mmmmmmmmmmmm', 'mmmmddddmmmm', 'mmmd2222dmmm', 'mmd234432dmm', 'md23443321dm', 'md2343W321dm',
        'md22332211dm', 'mmd122211dmm', 'mmmd1111dmmm', 'mmmmddddmmmm', 'mmmmmmmmmbmm', 'mmmmmmmmmmmm'], 12, 12),
    sq(['mmmmmmmmmmmm', 'mddddmmmmmmm', 'd2343dmmmmmm', 'd34W2dmmmmmm', 'd2221dmmmmmm', 'mddddmmmmmmm',
        'mmmmmmmddddm', 'mmmmmmd2344d', 'mmmmmmd3W32d', 'mmmmmmd2221d', 'mmmmmmmddddm', 'mmmmmmmmmmmm'], 12, 12),
]

# ---- 얼음 가장자리 A2 — 북·서 = 한 줄 빛 받는 끝 P(b·c, 끊김), 남 = 얼음판 앞 두께 D D(d) + E(d·m), 동 = 그늘 D 한 줄. 테두리 고리 없음.
P2_TEX = ['bcbbcbbbcbbcbbbc', 'cbbcbbcbbbcbbcbb', 'bbcbbbbcbcbbbbcb', 'bcbbcbbbbbbcbcbb'] * 4
D2_TEX = ['dddddddmdddddddd', 'dddmdddddddddmdd', 'ddddddddddmddddd', 'dmdddddddddddddm'] * 4
E2_TEX = ['mdmmdmmmdmmmmdmm', 'mmmdmmdmmmdmmmmd', 'dmmmmmmdmmmmdmmm', 'mmdmmdmmmmmmmmdm'] * 4
IF2_N = ',P......'
IF2_S = ',DDE....'
IF2_E = ',D......'
IF2_NW = [',,,,,,,,', ',,,,,,PP', ',,,,PP..', ',,,P....', ',,P.....', ',P......', ',P......', ',P......']
IF2_NE = [',,,,,,,,', 'PP,,,,,,', '..PD,,,,', '....D,,,', '.....D,,', '......D,', '......D,', '......D,']
IF2_SW = [',P......', ',P......', ',P......', ',,P.....', ',,DEEEEE', ',,,DDDDD', ',,,,DDDD', ',,,,,,,,']
IF2_SE = ['......D,', '......D,', '......D,', '.....ED,', 'EEEEEDD,', 'DDDDDD,,', 'DDDD,,,,', ',,,,,,,,']
IF2_FRAME = frame(IF2_NW, IF2_NE, IF2_SW, IF2_SE, uni(IF2_N), uni(IF2_S), uni(IF2_N), uni(IF2_E))
IF2_INNER = inner4([',P......', 'P.......'] + ['........'] * 6,
                   ['......D,', '.......D'] + ['........'] * 6,
                   ['........'] * 5 + ['E.......', 'DE......', ',D......'],
                   ['........'] * 5 + ['.......E', '......DD', '.....DD,'])
check_frame('A2 얼음 틀', IF2_FRAME, IF2_INNER, strict_inner=False)
WOB_ICE2 = check_wob({
    'N': [0, 0, 0, 1, 2, 2, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 1, 2, 1, 0, 0, 0, 0],
    'S': [0, 0, 0, 0, 1, 1, 1, 0, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0],
    'W': [0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 2, 1, 0, 0, 0, 0],
    'E': [0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 2, 2, 1, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 1, 0, 0]})

# ---- 바위 윗면 A2 — 밝은 서리 껍질(F 바탕, 눈 S) 이 각진 금(1, 위·왼 2 · 아래·오른 빛 S)으로 갈라진 판, 드러난 바윗덩이(4 3 2 + 눈 모자).
TOP2_RAW = sq([
    'FFFSFFFFFFFSSFFF', 'FFSSFFFFFFFSFFFF', 'FFFFFGFFFFFFFFGF', 'FFFFFFFFFFFFFFFF',
    'FSFFFFFFFGFFFFFF', 'FFFFFFFFFFFFSSFF', 'FFFFGFFFFFFFFSFF', 'FFFFFFFFFFFFFFFF',
    'FFFFFFFFFFFFFFFF', 'SSFFFFFFFFGFFFFF', 'SFFFFFFFFFFFFFFF', 'FFFFFFGFFFFFFFSF',
    'FFFFFFFFFFFFFSSF', 'FFFSFFFFFFFFFFFF', 'FFSSFFFFFFFFFFFF', 'FFFFFFFFFFFGFFFF'], name='TOP2')
TOP2_MAIN = stamp(TOP2_RAW, [(['.SS.', 'S433', '4332', '.21.'], 9, 8), (['12...', '.112.', '..S11', '...S.'], 2, 3)])
TOP2_VARS = [
    [],
    [(['.SS.', 'SS43', 'S432', '.21.'], 10, 8)],                                         # 드러난 덩이
    [(['GF..', '.GG.', '..GF'], 2, 11), (['.SS.', 'S433', '4332', '.21.'], 9, 3)],       # 얕은 서리 골 + 덩이
    [(['12....', '.112..', '..S112', '...SS1'], 3, 4)],                                  # 각진 금
    [(['1.....', '21....', '.S12..', '..S.12', '.....S'], 8, 8), (['G'], 3, 3)],         # 금 + 서리 그늘
    [],
]
R2_TEX = ['SFSWSSFSSWSFSSFS', 'FSSWSFSSFSWSSFSS', 'SWSFSSSFSWSSFSSW', 'SSFSWSSFSSFSWSSF'] * 4
D2R_TEX = ['2121122121211212', '1221212112212121', '2112121221121212', '1212211212212121'] * 4
TOP2_N = strips([(1, 2), (1, 3), (2, 3), (2, 3), (1, 2), (0, 1), (0, 2), (1, 2),
                 (1, 2), (1, 2), (0, 2), (1, 2), (2, 3), (3, 4), (2, 3), (1, 2)], _TN1, ',')
TOP2_W = strips([(1, 2), (2, 3), (1, 2), (0, 1), (1, 2), (1, 3), (2, 3), (1, 2),
                 (1, 2), (1, 2), (2, 4), (2, 3), (1, 2), (0, 2), (0, 1), (1, 2)], _TN1, ',')
TOP2_E = strips([(1, 2), (0, 1), (1, 2), (2, 3), (3, 4), (2, 3), (1, 2), (1, 2),
                 (1, 2), (1, 3), (1, 2), (0, 1), (1, 2), (2, 3), (2, 3), (1, 2)], _TE1, ',')
TOP2_NW = [',,,,,,,,', ',,,,,,RR', ',,,,RR..', ',,,R....', ',,R.....', ',R......', ',R......', ',R......']
TOP2_NE = [',,,,,,,,', 'RR,,,,,,', '..RRD,,,', '.....D,,', '......D,', '......D,', '......D,', '......D,']
TOP2_FRAME = frame(TOP2_NW, TOP2_NE, TOP1_SW, TOP1_SE, TOP2_N, TOP_S0, TOP2_W, TOP2_E)
check_frame('A2 바위 윗면 틀', TOP2_FRAME, TOP1_INNER, strict_inner=False)
WOB_TOP2 = check_wob({
    'N': [0, 0, 0, 1, 1, 2, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 1, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0],
    'S': [0] * 32,
    'W': [0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 2, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0],
    'E': [0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 1, 2, 1, 0, 0]})

# ---- 앞면 A2 — 중간 밝기 화산암(3 바탕, 덩이 왼·위 4, 그늘 2), 서리 막 G. 0행 밝은 서리 처마(F S G), 1행 처마 밑.
#   굵은 고드름(왼 W · 가운데 c · 오른 m 청록 그늘, 끝 W): 열 3~6 큰 것 10행까지, 열 11~13 중간 5행, 열 9 짧게 2, 열 15 짧게 3.
#   30~31행 접지 그늘(1). 결정 무리는 왼끝 마구리에만 하나.
FACE2_BASE = (['FFGFSFFGFFFGFSFF', 'G44G4G44G4G44G44'] + ['3' * 16] * 28 + ['2112111211121121', '1111111G11111111'])
FACE2_MID = sq(stamp(FACE2_BASE, [
    (['.44.', '4332', '3322', '.22.'], 7, 4), (['43', '32'], 1, 12), (['.44.', '4332', '3222', '.22.'], 10, 9),
    (['43', '32'], 14, 15), (['.44.', '4332', '3222', '.22.'], 4, 17), (['.44.', '4332', '3222', '.22.'], 12, 21),
    (['43', '32'], 8, 24), (['.44.', '4332', '3222', '.22.'], 1, 25), (['2'], 6, 14), (['22'], 9, 19),
    (['GG', 'G.'], 9, 13), (['G'], 3, 22), (['.G', 'GG'], 14, 26),
    (['WWcm', 'Wccm', 'Wcm.', 'Wcm.', '.cm.', '.cm.', '.Wm.', '.c..', '.c..', '.W..'], 3, 1),            # 큰 고드름
    (['Wcm', 'Wcm', 'cm.', 'cm.', 'W..'], 11, 1),                                                       # 중간
    (['c', 'W'], 9, 1), (['c', 'c', 'W'], 15, 1)], wrap=True), 16, 32, 'FACE2')
CRY2 = ['..W...', '..cd..', '.Wcd.W', '.cmdcd', 'Wcmdcd', 'cmd1md', '1111d1']
FACE2_L = [(col('F' + '4' * 12 + '3' * 17 + '21'), 0, 0), (CRY2, 1, 19)]
FACE2_R = [(col('2' + '1' * 31), 7, 0), (col('.' + '2' * 29 + '..'), 6, 0)]


# ================================================================================================ 조립
def ground_parts(n):
    if n == 1:
        return G1_BASE, G1_COMMON, G1_VARS, L1, G1_N, G1_W, legend(**{'1': ('iron', 4), '2': ('iron', 5)})
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
        tx = {',': g.body, 'U': grid(U1_TEX, leg), 'P': grid(P1_TEX, leg), 'D': grid(D1_TEX, leg), 'E': grid(E1_TEX, leg)}
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
        leg, fr_rows, prof, main, vs = L1, TOP1_FRAME, WOB_TOP1, TOP1_MAIN, TOP1_VARS
        tx = {',': g.body, 'R': grid(R1_TEX, leg), 'D': grid(D1R_TEX, leg)}
    else:
        leg, fr_rows, prof, main, vs = L2, TOP2_FRAME, WOB_TOP2, TOP2_MAIN, TOP2_VARS
        tx = {',': g.body, 'R': grid(R2_TEX, leg), 'D': grid(D2R_TEX, leg)}
    fr, inn = fill(fr_rows, TOP1_INNER, leg, tx)
    wobble(fr, g.body, prof)
    bs = body_set(main, [], vs, leg)
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
FROZEN_AT = [(3, 5, 0), (6, 6, 1), (12, 9, 0)]   # (칸 x, 칸 y, 얼음 속 돌 번호) — 안쪽(마스크 255) 칸만
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
    'A1': '「빙하」 — 버들항 설원 얼음판 말씨: 옅은 청록 얼음 + 푸른 금 그물 + 밝은 면, 비대칭 가장자리 · 다져진 눈 바닥 · '
          '눈 모자 바윗덩이 윗면 + 찬 청회색 바위 앞면(서리 막·얼음 줄기·길이 제각각 고드름)',
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
