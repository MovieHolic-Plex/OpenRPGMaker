"""gap-ice-r1 — 얼음 동굴 두 조각(줄 공통). 항목 gap.ice_floor(얼음 바닥 ↔ 얼음굴 바닥) · gap.ice_rock(얼음 바위 채움: 서리 윗면 + 언 바위 앞면).

조수는 지금 버들항 칩셋으로 얼음 동굴을 아예 못 짓는다(거부한다). 이 판의 두 조각 + 얼음굴 바닥(얼음 바닥 오토타일의 바깥,
meta 'autotiles' 의 ground)으로 얼음 동굴 한 벌이 된다. 얼음은 세 줄 어디에도 속하지 않는 별도 재료(설원 얼음)라 후보는 A1·A2 두 벌.

  A1 「빙하」 — 바닥 = 서리 낀 푸른 회색 자갈(stone 3 · iron 3·4, 서리 I·눈 S). 얼음 = 옅은 빙하 얼음(ice 2 바탕, 부드러운 밝은 판 c,
                기포·실금·반사 획은 몸통 변형에만). 벽 윗면 = 결 촘촘한 회색 바위(crock 1~6, 금 속에 눈) · 앞면 = 언 회색 바위에
                푸른 회색 얼음막(iron 3·4)이 세로로 흘러내리고 길이·간격이 제각각인 고드름, 위가 밝고 아래로 어두워짐.
  A2 「청빙」 — 바닥 = 검푸른 화산암 자갈(vrock 2). 얼음 = 단단한 푸른 얼음(ice 1 바탕, 깊은 자리 d, 하얀 균열면 c, 갇힌 하얀 공기 W,
                비스듬한 반사 b). 벽 윗면 = 결 촘촘한 검푸른 화산암(금을 따라 서리 h) · 앞면 = 거친 검푸른 바위에 크기가 다른 푸른 결정
                무리가 엇갈려 박혔다.

  가장자리(검수 1차 반영): 얼음 둘레에 하얀 띠를 두르지 않는다. 바깥 2px = 얇아진 얼음 너머로 바닥이 비침(T 결, 서리는 띄엄띄엄),
  북·서 = 얼음 자신의 밝은 끝(L, 끊김), 남·동 = 어두운 끝(M). 벽 윗면도 북·서만 밝은 끝, 동은 어두운 단, 남(처마) 끝은 빛 받는 턱.
  앞면 밑은 띠·고드름 줄 없이 어두운 접지 그늘 + 잔돌 + 서리.

모든 화소는 이 파일의 행 문자열에서 온다(손 도트). 조립 도구(틀·옆선 표·굴곡·47 변형)는 cave-r1·edges-r1 것을 그대로 쓴다.
  - 틀 = 32×32 기호 틀(모서리 8×8 손 도트 + 변 띠) + 16×16 안 모서리 + 16×16 몸통. ',' = 그 칸 자리의 얼음굴 바닥 화소,
    대문자 결 글자(T L M)는 칸 좌표 16×16 결 표의 그 자리 화소(edges_r1.fill).
  - 몸통 변형 = 본몸통 + 손으로 찍은 덧그림 하나(둘레 2px 밖, with_sprites) — 변형끼리 아무 순서로 붙어도 이어진다.
    두드러진 것(바윗덩이·결정·눈 더미·반사 획)은 변형에만 두고 본몸통은 잔잔하게 — 칸마다 같은 덩이가 찍히면 16px 격자 무늬가 된다.
  - 가장자리는 손으로 적은 굴곡 표(0~2px, 사분면 경계·끝 0)만큼 들쭉날쭉(edges_r1.wobble). 벽 윗면의 남변(처마)은 굽히지 않는다.
  - 3/4: 바위 윗면 → 남쪽 앞면 2단(32px)이 그 아래. 옆면 없음. 빛은 왼쪽 위. 먹 윤곽 없이 재질 명암.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dot  # noqa: E402
from cave_r1 import (autotile_cv, check_frame, face_run, floor_frame, frame, hcat,  # noqa: E402
                     strips, variants_sheet, a2_plus)
from edges_r1 import WOB, fill, inner4, uni, wobble  # noqa: E402
from dot import Cv, grid, legend  # noqa: E402

WAVE = 'gap'
T = 16


# ================================================================================================ 도구
def with_sprites(main, sprites):
    """본몸통 행 + 덧그림 [(행 문자열, x, y)] ('.' = 그대로). 덧그림은 둘레 2px 밖(2~13)에만 — 변형끼리 이어지게."""
    g = [list(r) for r in main]
    for rows, x, y in sprites:
        for dy, r in enumerate(rows):
            for dx, ch in enumerate(r):
                if ch == '.':
                    continue
                X, Y = x + dx, y + dy
                assert 2 <= X <= 13 and 2 <= Y <= 13, f'덧그림 ({X},{Y}) 이 둘레 2px 에 들어갔다'
                g[Y][X] = ch
    return [''.join(r) for r in g]


def with_core(main, core):
    """본몸통 둘레 2px 는 두고 가운데 12×12 를 core 로(얼음 속 돌 칸)."""
    assert len(core) == 12 and all(len(r) == 12 for r in core), '가운데는 12×12'
    rows = list(main)
    for i, r in enumerate(core):
        rows[2 + i] = main[2 + i][:2] + r + main[2 + i][14:]
    return rows


def bodies(main, sprite_sets, leg):
    return [grid(main, leg)] + [grid(with_sprites(main, s), leg) for s in sprite_sets]


def no_s(prof):
    out = dict(prof)
    out['S'] = [0] * 32
    return out


def rev(prof):
    return {k: v[::-1] for k, v in prof.items()}


def face_from(mid, left, right, leg):
    """앞면 가운데 16×32(16칸 주기) + 끝 마구리 덮개 → dot.Face. 왼끝 바탕 = 가운데 0~7, 오른끝 바탕 = 가운데 8~15."""
    cv = Cv(32, 32)
    p = grid(mid, leg, 16, 32)
    cv.paste(p, 8, 0)
    cv.paste(p.crop(0, 0, 8, 32), 0, 0)
    cv.paste(p.crop(8, 0, 8, 32), 24, 0)
    for side, cols in ((0, left), (1, right)):
        for x, col in cols.items():
            assert len(col) == 32, (side, x, len(col))
            for y, ch in enumerate(col):
                if ch != '.':
                    cv.put(x if side == 0 else 31 - x, y, leg[ch])
    return dot.Face(cv)


def ground_at(rows, pebbles, leg):
    cv = grid(rows, leg)
    for sp, x, y in pebbles:
        for dy, r in enumerate(sp):
            for dx, ch in enumerate(r):
                if ch != '.':
                    cv.put((x + dx) % 16, (y + dy) % 16, leg[ch])
    return cv


# ------------------------------------------------------------------------------------------------ 얼음 바닥 틀(두 후보 같은 모양, 결·굴곡이 다름)
# 바깥 → 안: ',' 바닥 · 'T' 얇아진 얼음(바닥이 비침, 서리 띄엄띄엄) 2px · 'L' 북·서 밝은 끝 / 'M' 남·동 어두운 끝 · 몸통. 모서리는 둥글게(반지름 5~6).
IF_N = ',TTL....'
IF_S = ',TTM....'
IF_NW = [',,,,,,,,', ',,,,,,TT', ',,,,TTTT', ',,,TTTLL', ',,TTLL..', ',TTL....', ',TTL....', ',TTL....']
IF_NE = [',,,,,,,,', 'TT,,,,,,', 'TTTT,,,,', 'LLTTT,,,', '..MMTT,,', '....MTT,', '....MTT,', '....MTT,']
IF_SW = [',TTL....', ',TTL....', ',TTL....', ',,TTL...', ',,TTMMMM', ',,,TTTTT', ',,,,,TTT', ',,,,,,,,']
IF_SE = ['....MTT,', '....MTT,', '....MTT,', '...MTT,,', 'MMMMTT,,', 'TTTTT,,,', 'TTT,,,,,', ',,,,,,,,']
IF_FRAME = frame(IF_NW, IF_NE, IF_SW, IF_SE, uni(IF_N), uni(IF_S), uni(IF_N), uni(IF_S))
IF_INNER = inner4([',TTL....', 'TTL.....', 'TL......', 'L.......'] + ['........'] * 4,
                  ['....MTT,', '.....MTT', '......MT', '.......L'] + ['........'] * 4,
                  ['........'] * 4 + ['M.......', 'TM......', 'TTL.....', ',TTL....'],
                  ['........'] * 4 + ['.......M', '......MT', '.....MTT', '....MTT,'])
check_frame('얼음 바닥 틀', IF_FRAME, IF_INNER, strict_inner=False)

# ================================================================================================ A1 「빙하」
# 글자: 얼음 d m b c W = ice 0~4 · 눈 S = rim 6 · 바위 1 e r t y u = crock 1~6 · 바닥 g = stone 3 · h i I = iron 3~5
L1 = legend(d=('ice', 0), m=('ice', 1), b=('ice', 2), c=('ice', 3), W=('ice', 4), S=('rim', 6),
            **{'1': ('crock', 1)}, e=('crock', 2), r=('crock', 3), t=('crock', 4), y=('crock', 5), u=('crock', 6),
            g=('stone', 3), h=('iron', 3), i=('iron', 4), I=('iron', 5))

# ---- 얼음굴 바닥 — 서리 낀 푸른 회색 자갈: 바탕 i(iron 4), 회색 얼룩 g, 짙은 얼룩 h, 서리 I·눈 S, 회색 자갈(u y r).
G1_BASE = [
    'iiiiggiiiiiiihii', 'iiigggiiiiiiiihi', 'iiiigiiiiiiiiiii', 'iiiiiiiihhiiiiii',
    'hiiiiiiiiiiiigii', 'hhiiiigiiiiiiggi', 'hiiigggiiiiiiiii', 'iiiiiigiiiihiiii',
    'iiiiiiiiiiihhiii', 'iigiiiiiiiiiiiih', 'igggiiiiiiiiiiii', 'iigiiiiiihhiiiii',
    'iiiiiihiiihhiiii', 'iiiiiihhiiiiiiig', 'ihiiiiiiiiiiiigg', 'ihhiiiigiiiiiiii']
PEB1 = ['.u.', 'uyr', '.rh']
PEB1S = ['y.', 'rh']
FROST1 = ['I']
G1_SPOTS = [(PEB1, 5, 2), (PEB1S, 12, 6), (PEB1, 2, 10), (PEB1S, 9, 12), (FROST1, 9, 1), (['S'], 1, 5),
            (FROST1, 14, 9), (FROST1, 6, 14), (['IS'], 11, 3)]
G1_V1 = [(PEB1S, 3, 3), (PEB1, 10, 8), (['SI'], 7, 5), (FROST1, 13, 13), (FROST1, 2, 12), (['.I', 'SS'], 5, 9)]
G1_V2 = [(PEB1, 7, 4), (PEB1S, 2, 12), (PEB1S, 12, 11), (FROST1, 4, 7), (['S'], 13, 2), (FROST1, 9, 14)]
G1_N = [3, 3, 3, 4, 4, 3, 3, 3, 3, 4, 3, 3, 2, 2, 3, 3, 3, 3, 2, 2, 3, 4, 4, 3, 3, 3, 3, 2, 2, 3, 3, 3]
G1_W = [2, 2, 2, 2, 2, 1, 1, 2, 2, 2, 2, 1, 1, 2, 2, 2, 2, 2, 1, 1, 2, 2, 3, 2, 2, 2, 2, 2, 1, 1, 2, 2]
G_INNER = (['12......' + '....2111', '22......' + '......22', '2.......' + '.......2']
           + ['.' * 16] * 10 + ['.' * 16, '1.......' + '.' * 8, '12......' + '.' * 8])

# ---- 얼음 가장자리 결 — T 얇은 얼음(바닥 g·옅은 i 가 비치고 얼음 b 가 섞임, 서리 S 덩이 띄엄띄엄) · L 밝은 끝(c, 끊김 b) · M 어두운 끝(m, 끊김 b)
T1_TEX = [
    'igibiigiibigiiig', 'giiigbiigiiibgii', 'ibiSSigibigiigib', 'iigiSiiigiibigii',
    'gibiigiibiigiibg', 'iiigibigiigbiiii', 'bigiiiigbiiiSSig', 'iigbigiiigibSiib',
    'giiiibigiibiigii', 'ibgiigiibgiiigbi', 'iiibgiSSiiigbiig', 'gbiiiiSigbiiiiib',
    'iigibgiiiigbigii', 'biiigiibgiiiibig', 'igbiigiiiibgiiii', 'iiigbiigbiiigiSb']
L1_TEX = ['ccbcccbccccbccbc', 'cccbccccbcccbccc', 'bccccbcccbccccbc', 'ccbccccbccccbccc'] * 4
M1_TEX = ['mmbmmmmbmmbmmmmb', 'mmmmbmmmmmmbmmmm', 'bmmmmmbmmmmmmbmm', 'mmmbmmmmbmmmmmbm'] * 4

# ---- 얼음 몸통 — 옅은 빙하 얼음: 바탕 b + 부드러운 밝은 판 c. 반사 획·기포·실금은 변형에만.
ICE1_MAIN = [
    'bbbbbbbbbbbbbbbb', 'bbbbbbbcbbbbbbbb', 'bbbbbbbbbbbbbbbb', 'bbcbbbbbbbbbbbbb',
    'bbbbbbbbbbbcbbbb', 'bbbbbbbbbbbbbbbb', 'bbbbbcbbbbbbbbbb', 'bbbbbbbbbbbbbbbb',
    'bbbbbbbbbbbbbbcb', 'bbbbbbbbmbbbbbbb', 'bbbbbbbbbbbbbbbb', 'bcbbbbbbbbbbbbbb',
    'bbbbbbbbbbbcbbbb', 'bbbbbbbbbbbbbbbb', 'bbbbbcbbbbbbbbbb', 'bbbbbbbbbbbbbbbb',
]
ICE1_SPRITES = [
    [(['....Wc', '...Wc.', '..Wc..', '.Wc...', 'Wc....'], 3, 4)],                               # 반사 획 하나
    [(['cW', 'mc'], 4, 5), (['W', 'm'], 9, 4), (['Wc', 'mm'], 7, 10), (['c'], 11, 8)],             # 갇힌 기포
    [(['m.....', 'cm....', '.cmm..', '...cmm', '.....c'], 3, 6), (['m', 'c'], 10, 11)],           # 갈라진 실금(아래 빛 c)
    [(['...Wc..W', '..Wc..Wc', '.Wc..Wc.', 'Wc......'], 5, 7)],                                  # 겹친 반사 획 둘
]
ICE1_FROZEN = [
    [   # 큰 돌 — 얼음 아래 회색 돌(위 밝음 u y · 아래 그늘 r e), 둘레 얼음 그늘 m, 반사 획 W
        'bbbccccbbbbc', 'bbbbbbbbbbbc', 'bbbmmmmmmbbb', 'bbmyuuyytmbb', 'bmyuyyyyttmb', 'bmyyyyWttrmb',
        'bmtyyWtttrmb', 'bmtttttrrrmb', 'bmrrtrrreemb', 'bbmeeeeeemcb', 'bbbmmmmmmcbb', 'bbbbbbbbbbbb'],
    [   # 작은 돌 둘
        'bbbccccbbbbc', 'bbbbbbbbbbbc', 'bmmmmbbbbbbb', 'myuytmbbbbbb', 'mtyWrmbbbbbb', 'mrrrembbbbbb',
        'bmmmmbbbbbbb', 'bbbbbbmmmmmb', 'bbbbbmyuyytm', 'bbbbbmtyWtrm', 'bbbbbmreeerm', 'bbbbbbmmmmmb'],
]

# ---- 바위 윗면 — 결 촘촘한 회색 바위(t 바탕 · y 밝은 결 · r 그늘 결 · e 1 금). 눈 더미·눈 모자 바윗덩이·눈 든 긴 금은 변형에만.
TOP1_MAIN = [
    'tyttrtytttrttyrt', 'ytrttytrtyttrtty', 'ttyrttttertrtytr', 'rtttyrtteeetttyt',
    'tytrttrtte1rtrtt', 'ttrtytttrteyttyr', 'yttrttyrtttrttrt', 'trtyttrttytttyrt',
    'tteerttytrttrtty', 'te1eetrtttyrtttr', 'ytrteertytttrtyt', 'trttrtyttrtytrtt',
    'ttyrttttyttrtyrt', 'rtttytrtttrtttyt', 'tytrttytrtyttrtt', 'ttrttrtttyrtttrt',
]
TOP1_SPRITES = [
    [(['..WWW...', '.WSSSWW.', 'WSSSSSSc', 'cSSSScc.', '.cccc...'], 3, 5)],                       # 눈 더미
    [(['..SSS....', '.SSSSSy..', 'uyyyyyyt.', 'yyyyyttrt', 'tytttrrre', '.rrreee1.', '..e111e..'], 3, 3)],   # 눈 모자 바윗덩이
    [(['e.........', 'Se........', '.1Se......', '..e1Se....', '....ee1S..', '.......e1.', '........Se',
       '.........e'], 2, 3)],                                                                    # 긴 금 + 금 속 눈
    [(['SS....', 'cS...W', '....SS', '.....c'], 4, 7)],                                          # 눈 조각
]
# 틀: 북·서 = 바닥 홈 , → 밝은 끝 u → y → 몸통(빛 받는 쪽만 밝다). 동 = 바닥 → 그늘 r → t. 남(처마) = 바깥에서 처마 밑 e → y → u → y.
_TN1 = lambda k, m: 'u' if k == 0 else 'y'  # noqa: E731
_TE1 = lambda k, m: 'r' if k == 0 else 't'  # noqa: E731
_TS1 = lambda k, m: 'eyuy'[k] if k < 4 else 'y'  # noqa: E731
TOP1_N = strips([(2, 4), (1, 3), (1, 4), (2, 4), (1, 3), (0, 3), (1, 3), (2, 4),
                 (2, 4), (2, 4), (2, 5), (1, 4), (1, 3), (0, 2), (1, 3), (2, 4)], _TN1, ',')
TOP1_W = strips([(1, 3), (1, 3), (2, 4), (2, 4), (1, 3), (1, 3), (0, 3), (1, 3),
                 (1, 3), (1, 4), (2, 4), (1, 3), (0, 2), (1, 3), (2, 4), (1, 3)], _TN1, ',')
TOP1_E = strips([(1, 3), (1, 3), (1, 3), (2, 4), (2, 4), (1, 3), (0, 2), (1, 3),
                 (1, 3), (1, 3), (2, 4), (2, 5), (1, 4), (1, 3), (1, 3), (1, 3)], _TE1, ',')
TOP1_S = strips([(0, 4), (0, 4), (0, 5), (0, 5), (0, 4), (0, 4), (0, 5), (0, 4),
                 (0, 4), (0, 5), (0, 5), (0, 4), (0, 4), (0, 4), (0, 5), (0, 4)], _TS1, ',')
TOP1_NW = [',,,,,,,,', ',,,,,,,,', ',,,,uuuu', ',,,uyyyy', ',,uy....', ',uy.....', ',uy.....', ',uy.....']
TOP1_NE = [',,,,,,,,', ',,,,,,,,', 'uuuu,,,,', 'yyyyr,,,', '....tr,,', '.....tr,', '.....tr,', '.....tr,']
TOP1_SW = [',uy.....', ',uy.....', ',uy.....', ',uy.....', ',uyyyyyy', ',uuuuuuu', ',yyyyyyy', ',eeeeeee']
TOP1_SE = ['.....tr,', '.....tr,', '.....tr,', '.....tr,', 'yyyyytr,', 'uuuuutr,', 'yyyyyre,', 'eeeeee,,']
TOP1_FRAME = frame(TOP1_NW, TOP1_NE, TOP1_SW, TOP1_SE, TOP1_N, TOP1_S, TOP1_W, TOP1_E)
TOP1_INNER = inner4([',uy.....', 'uy......', 'y.......'] + ['........'] * 5,
                    ['.....tr,', '......ru', '.......y'] + ['........'] * 5,
                    ['........'] * 4 + ['y.......', 'uy......', 'yuy.....', 'euy.....'],
                    ['........'] * 4 + ['.......y', '......yy', '.....yuy', '....eeee'])
check_frame('A1 바위 윗면 틀', TOP1_FRAME, TOP1_INNER, strict_inner=False)

# ---- 앞면 — 언 회색 바위(t r e 1, 위가 밝은 y). 푸른 회색 얼음막(h 바탕 · i 빛 받는 왼 끝)이 두 갈래로 고르지 않게 흘러내리고,
# 짧은 막(행 3~14)과 긴 막(행 6~26). 고드름(I i h)은 길이·굵기·간격이 제각각. 밑동은 어두운 접지 그늘(1) + 잔돌(y t) + 서리(I).
FACE1_MID = [
    'eeieeeeieeeeiiei',   # 0  처마 밑 그늘 + 고드름 뿌리
    'tyItytyityttIiti',   # 1
    'ytItyythtytyIith',   # 2
    'tyitiihytrtyIity',   # 3  얼음막 A 시작(열 4~6)
    'ttitihhtrtytIirt',
    'trhtihhrtyttihtr',
    'tthiihhrtrtgihrt',   # 6  얼음막 B 시작(열 11)
    'rtriihhertgiihrt',
    'trtihhhrtgiihtre',
    'rteihhhrtgiihhrt',
    'trtihhhetgiihhte',
    'rteihhhrrgihhhrt',
    'tretihhrtgihhhrt',
    'rtrtihrertgihhte',
    'trrethrrtrgihhrt',   # 14 얼음막 A 끝(짧은 막)
    '1111trrrtrgihhre',   # 15 가로 금
    'rteretrrrrgihhrt',   # 16 아랫단
    'treretrrrrgihhtr',
    'rterretrrtgihhre',
    'trertrrertgihhrt',
    'rteretrrerghhhet',
    'ertrrtrertghhrer',
    'treretrerrghhter',
    'rerte1rererhhrer',
    'ertrerrererhhere',
    'reree1rereehrere',   # 25 얼음막 B 끝
    'erereereerheeree',
    'reeereeree1eeree',
    'eereeeereeeeeree',
    'e1eeeeee1eeee1ee',
    '1te11e1yt11e1I11',   # 30 접지 그늘 + 잔돌 + 서리
    '11111I11111111e1',   # 31
]
FACE1_L = {0: 'e' + 'y' * 15 + 't' * 14 + '11'}
FACE1_R = {0: 'e' + '1' * 31, 1: '.' + 'e' * 29 + '..'}

# ================================================================================================ A2 「청빙」
# 글자: 얼음 d m b c W = ice 0~4 · 물빛 k = water 1 · 화산암 1~4 = vrock 1~4 · 쇠빛 서리 h i = iron 3·4
L2 = legend(d=('ice', 0), m=('ice', 1), b=('ice', 2), c=('ice', 3), W=('ice', 4), k=('water', 1),
            h=('iron', 3), i=('iron', 4), **{str(i): ('vrock', i) for i in range(1, 5)})

# ---- 얼음굴 바닥 — 검푸른 화산암 자갈. 바탕 2, 어두운 1, 밝은 3, 쇠빛 서리 h·i.
G2_BASE = [
    '2222212222222122', '2122222232222222', '2222232222222221', '2222222222212222',
    '1222222212222222', '2223222222222322', '2222222222122222', '2212222322222222',
    '2222222222222212', '2222122222322222', '3222222221222222', '2222232222222222',
    '2212222222222232', '2222222212222222', '2232222222212222', '2222212222222222']
PEB2 = ['.43.', '4332', '.21.']
PEB2S = ['43', '21']
FR2 = ['h']
FR2B = ['.i', 'h.']
G2_SPOTS = [(PEB2, 3, 3), (PEB2S, 11, 1), (PEB2, 10, 10), (PEB2S, 2, 12), (FR2, 7, 6), (FR2B, 13, 6), (FR2, 6, 13)]
G2_V1 = [(PEB2S, 5, 2), (PEB2, 8, 7), (PEB2S, 13, 12), (FR2B, 2, 9), (FR2, 11, 3)]
G2_V2 = [(PEB2, 2, 6), (PEB2S, 9, 3), (PEB2S, 7, 12), (FR2, 13, 9), (FR2B, 4, 13), (FR2, 10, 15)]
G2_N = [3, 3, 4, 4, 3, 3, 2, 3, 3, 3, 3, 4, 4, 3, 2, 2, 3, 3, 4, 3, 3, 3, 2, 2, 3, 3, 4, 4, 3, 3, 3, 3]
G2_W = [2, 2, 1, 1, 2, 2, 2, 3, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1, 1, 2, 2, 2, 3, 2, 2, 2, 1, 2, 2, 2]

# ---- 얼음 가장자리 결 — T 얇은 얼음(바닥 3·서리 h 가 비치고 얼음 d 가 섞임) · L 밝은 끝(b, 끊김 c·m) · M 어두운 끝(d, 끊김 m)
T2_TEX = [
    'd3dhd3ddd3hd3dd3', '3dd3dd3hdd3dd3dd', 'dhd3dd3dd3ddhd3d', 'd3ddd3dhd3d3ddd3',
    '3dd3hdd3ddd3dd3d', 'dd3dd3ddh3dd3ddh', 'd3dhd3dd3ddd3h3d', '3ddd3dd3dd3hddd3',
    'dd3dd3hd3dd3dd3d', 'h3dd3ddd3d3ddhdd', 'd3d3dd3hdd3dd3d3', '3dhdd3dd3hddd3dd',
    'dd3dd3dd3dd3hd3d', 'd3dd3hd3ddd3dd3d', '3dd3dd3dd3hdd3dh', 'dhd3dd3dd3dd3dd3']
L2_TEX = ['bbcbbbmbbbcbbbmb', 'bcbbbbbmbbbbcbbb', 'bbbmbbcbbbbmbbcb', 'mbbbcbbbbcbbbbbm'] * 4
M2_TEX = ['ddmddddmdddmdddd', 'dddddmddddddmddd', 'mddddddmddmddddm', 'ddmdddddddddddmd'] * 4

# ---- 얼음 몸통 — 단단한 푸른 얼음: 바탕 m(ice 1) + 젖빛 판 b. 깊은 자리·하얀 균열면·갇힌 공기·반사 획은 변형에만.
ICE2_MAIN = [
    'mmmmmmmmmmmmmmmm', 'mmmmmmmmmmmbmmmm', 'mmmdmmmmmmmmmmmm', 'mmddmmmmmmmmmmmm',
    'mmmmmmmmmmmmmmmm', 'mmmmmmmmmmmmmdmm', 'mmmmmmbmmmmmmmmm', 'mmmmmmmmmmmmmmmm',
    'mmmmmmmmmmmmmmmm', 'mbmmmmmmmmmmmmmm', 'mmmmmmdmmmmmmmmm', 'mmmmmddmmmmmmmbm',
    'mmmmmmmmmmmmmmmm', 'mmmmmmmmmmbmmmmm', 'mmmmmmmmmmmmmmmm', 'mmmmmmmmmmmmmmmm',
]
ICE2_SPRITES = [
    [(['c.........', 'dc........', '.dc.......', '..dcc.....', '...ddcW...', '.....dcc..', '......ddc.',
       '........dc', '.........d'], 3, 3)],                                                       # 하얀 균열면(c) + 아래 그늘(d)
    [(['.bb.', 'bWWb', 'bWb.', '.b..'], 3, 4), (['.b.', 'bWb', '.b.'], 9, 6), (['.b.', 'bWb', '.b.'], 5, 10)],   # 갇힌 하얀 공기
    [(['......cb', '.....cb.', '....cb..', '...cb..c', '..cb..cb', '.cb..cb.', 'cb..cb..', '...cb...'], 4, 3)],  # 반사 획 둘
    [(['..dddd..', '.dddddd.', 'dddddddd', '.dddddd.', '...dd...'], 3, 5), (['b'], 10, 11)],      # 깊은 자리(맑아 깊이 보임)
]
ICE2_FROZEN = [
    [   # 큰 화산암 덩이가 얼음 속에(둘레 깊은 자리 d)
        'mmmmmmmmmmbb', 'mdmmmmmmmmmm', 'mmmddddddmmm', 'mmd344443dmm', 'md34443W32dm', 'md3443W332dm',
        'md23333321dm', 'md12222211dm', 'mmd111111dmm', 'mmmddddddmmm', 'mmbmmmmmmmmm', 'mmmmmmmmmmmm'],
    [   # 작은 덩이 둘
        'mmmmmmmmmmbb', 'mdmmmmmmmmmm', 'ddddmmmmmmmm', 'd3443dmmmmmm', 'd23W2dmmmmbm', 'md111dmmmbmm',
        'mmddddmmmmmm', 'mmmmmddddddm', 'mmmmd34443dm', 'mmmmd2W332dm', 'mmmmmd1111dm', 'mmmmmmddddmm'],
]

# ---- 바위 윗면 — 결 촘촘한 검푸른 화산암(3 바탕 · 2 · 4 빛 결 · 1 금, 금을 따라 서리 h). 결정·긴 금·서리 덩이는 변형에만.
TOP2_MAIN = [
    '3233423323243323', '2342332423323432', '3323243332h22333', '4232332423h12324',
    '3323423321232332', '2343232332323423', '3232332423342332', '2323243332323243',
    '3h22323232343232', '3h12342323232333', '2321232343232423', '3232423232423232',
    '4323323423232343', '2332342323343232', '3243232332323423', '2323423233242332']
TOP2_SPRITES = [
    [(['..W....', '.mck.W.', '.mdkmck', 'mbdkmdk', 'mddk2kk', '2kk1121', '.1111..'], 4, 4)],        # 반쯤 묻힌 푸른 결정 무리
    [(['1h........', '.1h.......', '..11h.....', '....1hh...', '......11h.', '........1h'], 2, 4)],   # 긴 금 + 서리
    [(['.hh.', 'hiih', '.hih', '..h.'], 5, 6)],                                                     # 서리 덩이
    [(['4.', '.3'], 8, 9), (['h'], 4, 4)],                                                          # 거의 맨 바위
]
# 틀: 북·서 = 바닥 홈 , → 밝은 끝 4 → 3 → 몸통. 동 = 바닥 → 그늘 1 → 2. 남(처마) = 바깥에서 처마 밑 1 → 3 → 빛 받는 끝 4 → 3.
_TN2 = lambda k, m: '4' if k == 0 else '3'  # noqa: E731
_TE2 = lambda k, m: '1' if k == 0 else '2'  # noqa: E731
_TS2 = lambda k, m: '1343'[k] if k < 4 else '3'  # noqa: E731
TOP2_N = strips([(2, 4), (2, 4), (1, 4), (1, 3), (1, 3), (0, 3), (1, 3), (2, 4),
                 (2, 4), (1, 3), (2, 5), (3, 5), (2, 4), (1, 3), (0, 3), (2, 4)], _TN2, ',')
TOP2_W = strips([(1, 3), (1, 3), (0, 3), (1, 3), (2, 4), (3, 5), (2, 4), (1, 3),
                 (1, 3), (2, 4), (2, 4), (1, 3), (1, 3), (0, 3), (1, 4), (1, 3)], _TN2, ',')
TOP2_E = strips([(1, 3), (2, 4), (3, 5), (2, 4), (1, 3), (1, 3), (0, 2), (1, 3),
                 (1, 3), (1, 3), (1, 3), (2, 4), (2, 4), (1, 3), (1, 3), (1, 3)], _TE2, ',')
TOP2_S = strips([(0, 4), (0, 5), (0, 5), (0, 4), (0, 4), (0, 4), (0, 5), (0, 4),
                 (0, 4), (0, 4), (0, 5), (0, 5), (0, 4), (0, 4), (0, 4), (0, 4)], _TS2, ',')
TOP2_NW = [',,,,,,,,', ',,,,,,,,', ',,,,4444', ',,,43333', ',,43....', ',43.....', ',43.....', ',43.....']
TOP2_NE = [',,,,,,,,', ',,,,,,,,', '4444,,,,', '33331,,,', '....21,,', '.....21,', '.....21,', '.....21,']
TOP2_SW = [',43.....', ',43.....', ',43.....', ',43.....', ',4333333', ',4444444', ',3333333', ',1111111']
TOP2_SE = ['.....21,', '.....21,', '.....21,', '.....21,', '3333321,', '4444421,', '3333311,', '111111,,']
TOP2_FRAME = frame(TOP2_NW, TOP2_NE, TOP2_SW, TOP2_SE, TOP2_N, TOP2_S, TOP2_W, TOP2_E)
TOP2_INNER = inner4([',43.....', '43......', '3.......'] + ['........'] * 5,
                    ['.....21,', '......14', '.......3'] + ['........'] * 5,
                    ['........'] * 4 + ['3.......', '43......', '343.....', '1343....'],
                    ['........'] * 4 + ['.......3', '......34', '.....343', '....1111'])
check_frame('A2 바위 윗면 틀', TOP2_FRAME, TOP2_INNER, strict_inner=False)

# ---- 앞면 — 거친 검푸른 바위(위 3·4 밝음 → 아래 2·1). 크기가 다른 푸른 결정(m 빛 면 · d · k 그늘 면 · b c W 빛)이 엇갈려 박혔다:
# 윗단 왼쪽에 키 큰 결정 + 기운 짧은 결정 + 작은 결정, 오른쪽 위 외톨이 작은 결정, 아랫단 오른쪽에 둘. 밑동은 접지 그늘 + 잔돌 + 서리.
FACE2_MID = [
    '11h1111h1111h111',   # 0  처마 밑 그늘 + 서리
    '2321233322232232',
    '3432334323432343',
    '23323W2323323323',   # 3  큰 결정 끝(열 5)
    '3242mck342423324',
    '2333mbk332332423',
    '3223mdk233423W33',   # 6  외톨이 결정 끝(열 13)
    '23c2mdk423323mk2',   # 7  왼 결정 끝(열 2)
    '3mbkmdk332432mk3',
    '2mdkmbk2332332k2',
    '3mdkmdkW23423323',   # 10 오른 작은 결정 끝(열 7)
    '2mdkmdkmk3324322',
    '3mdkmdkmk2332343',
    '2mdkmdkmk3233232',
    '12kkmdkmk2322321',
    '2121mkkkk1221222',
    '1212111121112121',   # 16 아랫단
    '2212322121232212',
    '1223212212322122',
    '2122221232212212',
    '221231221223W122',   # 20 아랫 결정 끝(열 12)
    '12212321221mck21',
    '21221212212mdk12',
    '122121212c2mdk21',
    '212212121mkmbk12',
    '121121212mkmdk21',
    '211212121kkkkk21',
    '1211211211211121',
    '2111211121112112',
    '1121111211121111',
    '1131h11141113h11',   # 30 접지 그늘 + 잔돌 + 서리
    '111111h111111111',
]
FACE2_L = {0: '1' + '3' * 15 + '2' * 14 + '11'}
FACE2_R = {0: '1' * 32}

for _n, _m in (('A1', FACE1_MID), ('A2', FACE2_MID)):
    assert len(_m) == 32 and all(len(r) == 16 for r in _m), (_n, [len(r) for r in _m])


# ================================================================================================ 조립
WOB1 = no_s(WOB)            # 바위 윗면 A1: 북·서·동 굴곡, 남(처마) 곧게
WOB2 = no_s(rev(WOB))       # A2 는 표를 뒤집어 쓴다(같은 굴곡이면 두 후보 윤곽이 겹친다)
WOB_ICE1 = WOB
WOB_ICE2 = {'N': WOB['S'], 'S': WOB['N'], 'W': WOB['E'], 'E': WOB['W']}


def ground(n):
    """얼음굴 바닥 오토타일(벽 밑 그늘 북·서) + 몸통 변형 둘."""
    if n == 1:
        rows, spots, vs, leg, N_, W_ = G1_BASE, G1_SPOTS, (G1_V1, G1_V2), L1, G1_N, G1_W
        shade = legend(**{'1': ('iron', 2), '2': ('iron', 3)})
    else:
        rows, spots, vs, leg, N_, W_ = G2_BASE, G2_SPOTS, (G2_V1, G2_V2), L2, G2_N, G2_W
        shade = legend(**{'1': ('vrock', 1), '2': ('vrock', 1)})
    body = ground_at(rows, spots, leg)
    var = [ground_at(rows, v, leg) for v in vs]
    fr = grid(floor_frame(N_, W_, '1', '2'), shade, 32, 32)   # 첫 줄 '1', 나머지 '2'
    inn = grid(G_INNER, shade, 16, 16)
    return autotile_cv(body, fr, inn, var)


def ice_floor(n):
    g = ground(n)
    if n == 1:
        leg, tex, prof, main, sp = L1, (T1_TEX, L1_TEX, M1_TEX), WOB_ICE1, ICE1_MAIN, ICE1_SPRITES
    else:
        leg, tex, prof, main, sp = L2, (T2_TEX, L2_TEX, M2_TEX), WOB_ICE2, ICE2_MAIN, ICE2_SPRITES
    tx = {',': g.body, 'T': grid(tex[0], leg), 'L': grid(tex[1], leg), 'M': grid(tex[2], leg)}
    fr, inn = fill(IF_FRAME, IF_INNER, leg, tx)
    wobble(fr, g.body, prof)
    bs = bodies(main, sp, leg)
    return autotile_cv(bs[0], fr, inn, bs[1:])


def frozen_tiles(n):
    main, fz, leg = (ICE1_MAIN, ICE1_FROZEN, L1) if n == 1 else (ICE2_MAIN, ICE2_FROZEN, L2)
    return [grid(with_core(main, c), leg) for c in fz]


def rock_top(n):
    g = ground(n)
    leg = L1 if n == 1 else L2
    fr_rows, inn_rows, prof = (TOP1_FRAME, TOP1_INNER, WOB1) if n == 1 else (TOP2_FRAME, TOP2_INNER, WOB2)
    fr, inn = fill(fr_rows, inn_rows, leg, {',': g.body})
    wobble(fr, g.body, prof)
    main, sp = (TOP1_MAIN, TOP1_SPRITES) if n == 1 else (TOP2_MAIN, TOP2_SPRITES)
    bs = bodies(main, sp, leg)
    return autotile_cv(bs[0], fr, inn, bs[1:])


def ice_face(n):
    if n == 1:
        return face_from(FACE1_MID, FACE1_L, FACE1_R, L1)
    return face_from(FACE2_MID, FACE2_L, FACE2_R, L2)


# ================================================================================================ 장면 — 얼음 동굴 두 방(14×10)
# '#' 얼음 바위 · '.' 얼음굴 바닥 · 'i' 얼음 바닥. 가운데 바위 곶이 두 방을 나누고 남쪽으로 이어진다. 오른 방 북벽에 작은 바위 턱.
# 얼음판은 2칸 넘는 둥근 덩이만(1칸 줄기 없음). 왼 얼음판 안쪽 칸에 얼음 속 돌.
SCENE = [
    '##############',
    '##############',
    '##############',
    '#.....###.##.#',
    '#iiii.###.##.#',
    '#iiiii###....#',
    '#iiiii###.ii.#',
    '#.iii....iiii#',
    '##......iiii.#',
    '##############',
]
FROZEN_AT = [(2, 5, 0), (3, 6, 1)]   # (칸 x, 칸 y, 얼음 속 돌 번호) — 안쪽(마스크 255) 칸만
ACTOR_AT = (10, 5)


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
    'A1': '「빙하」 — 옅은 빙하 얼음(가장자리는 얇아져 바닥이 비침, 밝은 끝은 북·서만) · 서리 낀 푸른 회색 자갈 바닥 · '
          '결 촘촘한 회색 바위 윗면(금 속 눈) + 푸른 회색 얼음막이 흘러내린 언 바위 앞면',
    'A2': '「청빙」 — 단단한 푸른 얼음(하얀 균열면·갇힌 공기·반사 획·깊은 자리) · 검푸른 화산암 자갈 바닥 · '
          '결 촘촘한 검푸른 화산암 윗면(금 따라 서리) + 크기가 다른 결정이 엇갈려 박힌 거친 바위 앞면',
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
            'note': NOTES[f'A{n}'] + ' — 원본 = 얼음 바닥 A2(+몸통 변형 4) | 얼음굴 바닥 A2(+변형 2)',
            'extras': [('얼음 몸통 8×8 (변형 4 섞음)', dot.mosaic(at, 8, 8), 2), ('바닥 몸통 8×8 (변형 2 섞음)', dot.mosaic(gr, 8, 8), 2),
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
            'extras': [('윗면 몸통 8×8 (변형 4 섞음)', dot.mosaic(at, 8, 8), 2), ('앞면 6칸 이어 붙임(끝 마구리 포함)', face_run(f), 3),
                       ('윗면 47 변형', variants_sheet(at), 2)]}
    return fn


CANDIDATES = {
    'gap.ice_floor': {'A1': cand_ice_floor(1), 'A2': cand_ice_floor(2)},
    'gap.ice_rock': {'A1': cand_ice_rock(1), 'A2': cand_ice_rock(2)},
}

SCENE_LEAD = ('같은 번호의 얼음 바위(윗면·앞면)·얼음 바닥·얼음굴 바닥만으로 깐 14×10 얼음 동굴 — 두 방, 가운데 바위 곶, 북벽 바위 턱, '
              '얼음판 안 얼음 속 돌, Actor1. 맵 가장자리는 잘린 것(맵이 이어진다고 본다).')
