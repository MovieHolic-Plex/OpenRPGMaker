"""gap-ice-r1 — 얼음 동굴 두 조각(줄 공통). 항목 gap.ice_floor(얼음 바닥 ↔ 얼음굴 흙) · gap.ice_rock(얼음 바위 채움: 서리 윗면 + 얼음벽 앞면).

조수는 지금 버들항 칩셋으로 얼음 동굴을 아예 못 짓는다(거부한다). 이 판의 두 조각 + 얼음굴 바닥(얼음 바닥 오토타일의 바깥 = 흙,
meta 'autotiles' 의 ground)으로 얼음 동굴 한 벌이 된다. 얼음은 세 줄 어디에도 속하지 않는 별도 재료(설원 얼음)라 후보는 A1·A2 두 벌.

  A1 「빙하」  — 옅은 빙하 얼음(ice 2·3 바탕, 비스듬한 반사 획·갇힌 기포·옅은 실금), 눈 녹은 서리 테두리가 바닥으로 번진다(평평한 빙판).
                 벽 = 눈 덮인 회색 바위 윗면(가장자리를 두른 눈 모자 + 회색 바위에 눈가루·눈 더미) + 옅은 빙하 얼음벽 앞면
                 (세로 갈라진 결, 처마 고드름, 아래 턱 밑 고드름). 바닥 = 언 갈색 흙(cfloor, 버들항 설원 길 흙 계열) + 서리 점·회색 자갈.
  A2 「청빙」  — 짙고 맑은 푸른 얼음(ice 0 바탕 + 깊은 물빛 water 2·1, 하얀 기포 고리, 깊은 금), 2px 솟은 얼음판(남쪽 두께 턱)과
                 바늘 서리(흙 위로 뻗은 하얀 결정 바늘) 테두리.
                 벽 = 서리 낀 검푸른 화산암 윗면(모난 판 + 서리 가루 + 작은 푸른 결정 끝) + 검푸른 바위에 박힌 푸른 결정 기둥 앞면(아래 턱 고드름).
                 바닥 = 검푸른 화산암 자갈(vrock) + 쇠빛 서리.

모든 화소는 이 파일의 행 문자열에서 온다(손 도트). 조립 도구(틀·옆선 표·굴곡·47 변형)는 cave-r1·edges-r1 것을 그대로 쓴다.
  - 오토타일 틀 = 32×32 기호 틀(모서리 8×8 손 도트 + 변 띠) + 16×16 안 모서리 + 16×16 몸통. ',' = 그 칸 자리의 얼음굴 흙 화소,
    대문자 결 글자(F R N)는 칸 좌표 16×16 결 표(서리 낀 흙 · 서리 테두리 · 바늘 서리)의 그 자리 화소(edges_r1.fill).
  - 몸통 변형: 본몸통의 둘레 2px 를 그대로 두고 가운데 12×12 만 손으로 다시 찍는다(with_core) — 변형끼리 아무 순서로 붙어도 이어진다.
    두드러진 것(바윗덩이·결정·눈 더미)은 변형에만 두고 본몸통은 잔잔하게 — 칸마다 같은 덩이가 찍히면 16px 격자 물방울무늬가 된다.
  - 가장자리는 손으로 적은 굴곡 표(0~2px, 사분면 경계·끝 0)만큼 들쭉날쭉(edges_r1.wobble). 벽 윗면의 남변(앞면 위 처마)은 굽히지 않는다.
  - 3/4: 바위 윗면(밝은 면) → 남쪽 앞면 2단(32px)이 그 아래. 옆면 없음. 빛은 왼쪽 위. 먹 윤곽 없이 재질 명암.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dot  # noqa: E402
from cave_r1 import (autotile_cv, check_frame, face_run, floor_frame, frame, hcat, mirror_h,  # noqa: E402
                     strips, variants_sheet, a2_plus)
from edges_r1 import WOB, fill, inner4, uni, wobble  # noqa: E402
from dot import Cv, grid, legend  # noqa: E402

WAVE = 'gap'
T = 16


# ================================================================================================ 도구
def with_core(main, core):
    """본몸통 16×16 의 둘레 2px 는 두고 가운데 12×12(행 2~13 · 열 2~13)를 core 로 바꾼다 — 몸통 변형."""
    assert len(core) == 12 and all(len(r) == 12 for r in core), '가운데는 12×12'
    rows = list(main)
    for i, r in enumerate(core):
        rows[2 + i] = main[2 + i][:2] + r + main[2 + i][14:]
    return rows


def bodies(main, cores, leg):
    return [grid(main, leg)] + [grid(with_core(main, c), leg) for c in cores]


def no_s(prof):
    """굴곡 표에서 남변을 0 으로(벽 윗면의 남변 = 앞면 위 처마는 곧게)."""
    out = dict(prof)
    out['S'] = [0] * 32
    return out


def rev(prof):
    return {k: v[::-1] for k, v in prof.items()}


def face_from(mid, left, right, leg):
    """앞면 가운데 16×32(16칸 주기) + 끝 마구리 덮개 → dot.Face. left/right = {열: 32글자 세로 문자열}(마구리 열 0·1… / 31·30…).
    왼끝 = 가운데의 왼쪽 반(0~7)을 쓰고(오른쪽으로 가운데 8열에 이어짐), 오른끝 = 가운데의 오른쪽 반(8~15)."""
    cv = Cv(32, 32)
    p = grid(mid, leg, 16, 32)
    cv.paste(p, 8, 0)                       # 가운데 = 8~23
    cv.paste(p.crop(0, 0, 8, 32), 0, 0)     # 왼끝 바탕 = 가운데 0~7 (8열의 가운데 0 과 이어짐… 아래 덮개로 끝을 둥글게)
    cv.paste(p.crop(8, 0, 8, 32), 24, 0)    # 오른끝 바탕 = 가운데 8~15
    for x, col in left.items():
        assert len(col) == 32
        for y, ch in enumerate(col):
            if ch != '.':
                cv.put(x, y, leg[ch])
    for x, col in right.items():
        assert len(col) == 32
        for y, ch in enumerate(col):
            if ch != '.':
                cv.put(31 - x, y, leg[ch])
    return dot.Face(cv)


def ground_at(rows, pebbles, leg):
    cv = grid(rows, leg)
    for sp, x, y in pebbles:
        for dy, r in enumerate(sp):
            for dx, ch in enumerate(r):
                if ch != '.':
                    cv.put((x + dx) % 16, (y + dy) % 16, leg[ch])
    return cv


# ================================================================================================ A1 「빙하」
# 글자: 얼음 d m b c W = ice 0~4 · 물빛 n k = water 2·1 · 흙 0~7 = cfloor 0~7 · 눈 S = rim 6 · 바위 e r t y u = crock 2~6
L1 = legend(d=('ice', 0), m=('ice', 1), b=('ice', 2), c=('ice', 3), W=('ice', 4), n=('water', 2), k=('water', 1),
            S=('rim', 6), e=('crock', 2), r=('crock', 3), t=('crock', 4), y=('crock', 5), u=('crock', 6),
            **{str(i): ('cfloor', i) for i in range(8)})

# ---- 얼음굴 흙(바닥) — 언 갈색 흙(버들항 설원 길 흙 계열). 바탕 4, 짙은 얼룩 2, 밝은 얼룩 6, 서리 점 S, 회색 자갈.
G1_BASE = [
    '4444664444442244', '4446664444444224', '4444644442444444', '4444444422444444',
    '2444444444444644', '2244446444444664', '2444466644444444', '4444446444424444',
    '4444444444422444', '4464444444442444', '4666444444444444', '4464444442244444',
    '4444442444224444', '4444422444444446', '4244444444444466', '4224444644444444']
PEB1 = ['.u.', 'uyr', '.r2']        # 자갈: 위·왼 빛, 아래 그늘 흙
PEB1S = ['y.', 'r2']
FROST1 = ['S']
G1_SPOTS = [(PEB1, 5, 2), (PEB1S, 12, 6), (PEB1, 2, 10), (PEB1S, 9, 12), (FROST1, 9, 1), (FROST1, 1, 5),
            (FROST1, 14, 9), (FROST1, 6, 14), (FROST1, 11, 3)]
G1_V1 = [(PEB1S, 3, 3), (PEB1, 10, 8), (FROST1, 7, 5), (FROST1, 13, 13), (FROST1, 2, 12), (['SS'], 5, 9)]
G1_V2 = [(PEB1, 7, 4), (PEB1S, 2, 12), (PEB1S, 12, 11), (FROST1, 4, 7), (FROST1, 13, 2), (FROST1, 9, 14)]
# 서리 낀 흙(F): 흙에 서리 점이 더 촘촘하다. 서리 테두리(R): 눈 녹은 띠 — 눈 S 바탕에 얼음 c W, 흙이 드문드문 비침(4).
F1_TEX = [
    '4S44S4464S444S44', '44S4444S444S4444', 'S444S4S444S44S4S', '4S4444444S4444S4',
    '444S4S4S4444S444', 'S44444444S4S444S', '44S4S44S44444S44', '4444444444S4S444',
    '4S4S4S444S444444', '444444S4444S4S4S', 'S4S44444S4444444', '444S4S444444S4S4',
    '4S444444S4S44444', '444S4S4S44444S4S', 'S44444444S4S4444', '44S4S4S444444444']
R1_TEX = [
    'SScSSWSSScSSSWSS', 'cSSSSSSWSSSSScSS', 'SSWSScSSSSWSSSSc', 'SSSSSSSScSSSSWSS',
    'WSScSSWSSSSScSSS', 'SSSSSSSSSWSSSSSc', 'ScSSWSSScSSSWSSS', 'SSSSSSSSSSSSSSSS',
    'SSWSSScSSSWSSScS', 'cSSSSSSSWSSSSSSS', 'SSSScSSSSSSScSSW', 'SWSSSSSWSScSSSSS',
    'SSSSSSSSSSSSSWSS', 'SScSSWSScSSSSSSS', 'WSSSSSSSSSSWSScS', 'SSSSSScSSSSSSSSS']
# 흙의 벽 밑 그늘(북 2~4줄 · 서 1~3열): 첫 줄 1, 나머지 2(0단은 쓰지 않는다 — 빛 쪽 0단 띠 경고).
G1_N = [3, 3, 3, 4, 4, 3, 3, 3, 3, 4, 3, 3, 2, 2, 3, 3, 3, 3, 2, 2, 3, 4, 4, 3, 3, 3, 3, 2, 2, 3, 3, 3]
G1_W = [2, 2, 2, 2, 2, 1, 1, 2, 2, 2, 2, 1, 1, 2, 2, 2, 2, 2, 1, 1, 2, 2, 3, 2, 2, 2, 2, 2, 1, 1, 2, 2]
G_INNER = (['12......' + '....2111', '22......' + '......22', '2.......' + '.......2']
           + ['.' * 16] * 10 + ['.' * 16, '1.......' + '.' * 8, '12......' + '.' * 8])

# ---- 얼음 바닥 몸통 — 옅은 빙하 얼음: 바탕 b(ice 2) + 부드러운 밝은 판 c, 비스듬한 반사 획 W·c, 옅은 실금 m, 갇힌 기포.
ICE1_MAIN = [
    'bbbbbccbbbbbbbbb', 'bbbbcccccbbbbbbb', 'bbbbbccccbbbbcbb', 'bbbbbbWcbbbbcccb',
    'bbbbbWcbbbbbbcbb', 'bbbbWcbbbbbbbbbb', 'bbbWcbbbbbbmbbbb', 'bbbbbbbbbbmbbbbb',
    'cbbbbbbbbmbbbbbc', 'ccbbbbbbmmbbbbcc', 'cccbbbbbbbbbbccc', 'ccbbbbbbbbbbWccc',
    'cbbbbbbbbbbWcbcc', 'bbbbbbbbbbWcbbbb', 'bbbbbbbbbbbbbbbb', 'bbbbbbbbbbbbbbbb']
ICE1_CORES = [
    [   # 기포 무리(하얀 점 W + 아래 그늘 m) + 짧은 실금
        'bbcccbbbbbbb', 'bbbbbbbbbbcb', 'bbbbbbbbbbbb', 'bbbcWbbbbbbb', 'bbbmcbbWbbbb', 'bbbbbbbmbbbb',
        'bbbbbbbbbbbb', 'cbbbbWbbbbbc', 'cbbbbmbbbbcc', 'bbbbbbbbbbcc', 'bbbmmbbbbbcb', 'bbbbbmmbbbbb'],
    [   # 길게 갈라진 금(m) + 금 아래 빛 받는 턱(c)
        'bbccccbbbbbb', 'bbbcbbbbbbcb', 'bbbbbbbbbbbb', 'bbmbbbbbbbbb', 'bbcmbbbbbbbb', 'bbbcmmbbbbbb',
        'bbbbbcmmbbbb', 'cbbbbbbcmbbc', 'cbbbbbbbcmcc', 'bbbbbbbbbcmc', 'bbbbbbbbbbcb', 'bbbbbbbbbbbb'],
    [   # 넓은 반사 — 겹친 획 둘
        'bbcccbbbbbbb', 'bbbbbbbbbbcb', 'bbbbbbbbbWcb', 'bbbbbbbbWcbb', 'bbbbbbbWcbWb', 'bbbbbbWcbWcb',
        'bbbbbbcbWcbb', 'cbbbbbbbcbbc', 'cbbbbbbbbbcc', 'bbbbbbbbbbcc', 'bbbbcbbbbbbb', 'bbbccbbbbbbb'],
]
# 얼음 속 돌(넓은 얼음판 안쪽에만 놓는 칸) — 얼음 아래 회색 돌이 비치고(둘레 m 얼음 그늘) 반사 획이 돌 위를 지난다.
ICE1_FROZEN = [
    [   # 큰 돌 — 얼음 아래 회색 돌(위 밝음 u y · 아래 그늘 r e), 둘레 얼음 그늘 m, 반사 획 W 가 돌 위를 지난다
        'bbcccbbbbbbb', 'bbbbbbbbbbbb', 'bbbmmmmmmbbb', 'bbmyuuyytmbb', 'bmyuyyyyttmb', 'bmyyyyWttrmb',
        'bmtyyWtttrmb', 'bmtttttrrrmb', 'bmrrtrrreemb', 'bbmeeeeeemcb', 'bbbmmmmmmcbb', 'bbbbbbbbbbbb'],
    [   # 작은 돌 둘
        'bbcccbbbbbbb', 'bbbbbbbbbbbb', 'bmmmmbbbbbbb', 'myuytmbbbbbb', 'mtyWrmbbbbbb', 'mrrrembbbbbb',
        'bmmmmbbbbbbb', 'bbbbbbmmmmmb', 'bbbbbmyuyytm', 'bbbbbmtyWtrm', 'bbbbbmreeerm', 'bbbbbbmmmmmb'],
]
# 얼음 바닥 틀(평평한 빙판 — 두께 없음): 흙 , → 서리 낀 흙 F → 눈 녹은 서리 띠 R → 얼음 밝은 끝 c → 몸통. 남·동은 끝에 그늘 m.
IF1_N = ',FRRc...'
IF1_S = ',FRm....'
IF1_NW = [',,,,,,,,', ',,,,FFFF', ',,FFRRRR', ',FFRRRRR', ',FRRcccc', ',FRRc...', ',FRRc...', ',FRRc...']
IF1_NE = [',,,,,,,,', 'FFFF,,,,', 'RRRRFF,,', 'RRRRRFF,', 'ccccmRF,', '....mRF,', '....mRF,', '....mRF,']
IF1_SW = [',FRRc...', ',FRRc...', ',FRRc...', ',FRRc...', ',FRRmmmm', ',FFRRRRR', ',,FFFFFF', ',,,,,,,,']
IF1_SE = ['....mRF,', '....mRF,', '....mRF,', '....mRF,', 'mmmmmRF,', 'RRRRRFF,', 'FFFFFF,,', ',,,,,,,,']
IF1_FRAME = frame(IF1_NW, IF1_NE, IF1_SW, IF1_SE, uni(IF1_N), uni(IF1_S), uni(IF1_N), uni(IF1_S))
IF1_INNER = inner4([',FRRc...', 'FFRc....', 'RRc.....', 'Rc......', 'c.......'] + ['........'] * 3,
                   ['....mRF,', '.....mFF', '......mR', '.......R', '.......c'] + ['........'] * 3,
                   ['........'] * 4 + ['m.......', 'Rc......', 'FRc.....', ',FRRc...'],
                   ['........'] * 4 + ['.......m', '......mR', '.....mRF', '....mRF,'])
check_frame('A1 얼음 바닥 틀', IF1_FRAME, IF1_INNER, strict_inner=False)

# ---- 바위 윗면 — 눈 덮인 회색 바위: 가장자리를 눈이 둘러 덮고(눈 모자), 가운데는 회색 바위(t y r e)에 눈가루·눈 더미.
TOP1_MAIN = [   # 회색 바위 윗면(t 바탕 · y 밝은 얼룩 · r 그늘 얼룩)에 성긴 눈가루 S. 눈 더미·금·바윗덩이는 변형에만
    'tttttttttyyttttt', 'ttttttttyyyttttt', 'tttttttttyttttrt', 'ttttrrttttttttrr',
    'tttrrtttttttSttr', 'tttttttttttttttt', 'tttttttttttttytt', 'ttttttttttttyyyt',
    'ttttttttttttytyt', 'tttttyyttttttttt', 'ttttyyyttttrrttS', 'tttttyttttttrrtt',
    'ttrttttStttttttt', 'trrttttttttttttt', 'tttttttttttttttt', 'ttttttttttyttttt',
]
TOP1_CORES = [
    [   # 바람에 길게 쌓인 눈 더미(위·왼 하얀 끝 W, 아래 푸른 그늘 c, 바위에 드리운 그늘 r)
        'tttttttttttt', 'tttttttttttt', 'ttttttWWWttt', 'ttttWWSSSWtt', 'ttWWSSSSSScr', 'tWSSSSSScccr',
        'tcSSSccccrrt', 'ttcccrrrrttt', 'tttrrttttttt', 'tttttttttytt', 'tttttttttttt', 'tttttttttttt'],
    [   # 갈라진 금(e) — 위·왼 그늘 r, 아래·오른 빛 y, 금 속 눈 S
        'tttttttttttt', 'ttrttttttttt', 'ttreyttttttt', 'tttreyttttyt', 'ttttreSyttyt', 'tttttreeeytt',
        'ttttttrrSeyt', 'tttttttttrey', 'ttStttttttre', 'tttttttttttr', 'tttttyyttttt', 'tttttttttttt'],
    [   # 눈 모자 쓴 바윗덩이
        'tttttttttttt', 'tttttttttttt', 'ttttWWWttttt', 'tttWSSSWtttt', 'ttWSSSSSScrt', 'ttyuSSSyyrtt',
        'ttuyyyyytrtt', 'ttyyyttttert', 'tttrrrrreert', 'ttttrrrrrttt', 'tttttttttttt', 'tttStttttttt'],
]
# 바위 윗면 틀: 북·서 = 흙 홈(,) → 하얀 눈 끝선 W → 눈 S → 몸통(눈 덮인 가장자리). 동 = 흙 → 푸른 눈 그늘 c → 눈. 남(앞면 위 처마) = 바깥에서
# 처마 밑 푸른 그늘 b → 눈 S → 하얀 처마 끝 W → 눈 S (눈이 처마로 둥글게 말려 넘어온다).
_TN1 = lambda k, m: 'W' if k == 0 else 'S'  # noqa: E731
_TE1 = lambda k, m: 'c' if k == 0 else 'S'  # noqa: E731
_TS1 = lambda k, m: 'bSWS'[k] if k < 4 else 'S'  # noqa: E731
TOP1_N = strips([(2, 4), (1, 3), (1, 4), (2, 4), (1, 3), (0, 3), (1, 3), (2, 4),
                 (2, 4), (2, 4), (2, 5), (1, 4), (1, 3), (0, 2), (1, 3), (2, 4)], _TN1, ',')
TOP1_W = strips([(1, 3), (1, 3), (2, 4), (2, 4), (1, 3), (1, 3), (0, 3), (1, 3),
                 (1, 3), (1, 4), (2, 4), (1, 3), (0, 2), (1, 3), (2, 4), (1, 3)], _TN1, ',')
TOP1_E = strips([(1, 3), (1, 3), (1, 3), (2, 4), (2, 4), (1, 3), (0, 2), (1, 3),
                 (1, 3), (1, 3), (2, 4), (2, 5), (1, 4), (1, 3), (1, 3), (1, 3)], _TE1, ',')
TOP1_S = strips([(0, 4), (0, 4), (0, 5), (0, 5), (0, 4), (0, 4), (0, 5), (0, 4),
                 (0, 4), (0, 5), (0, 5), (0, 4), (0, 4), (0, 4), (0, 5), (0, 4)], _TS1, ',')
TOP1_NW = [',,,,,,,,', ',,,,,,,,', ',,,,WWWW', ',,,WSSSS', ',,WS....', ',WS.....', ',WS.....', ',WS.....']
TOP1_NE = [',,,,,,,,', ',,,,,,,,', 'WWWW,,,,', 'SSSSc,,,', '....Sc,,', '.....Sc,', '.....Sc,', '.....Sc,']
TOP1_SW = [',WS.....', ',WS.....', ',WS.....', ',WS.....', ',WSSSSSS', ',WWWWWWW', ',SSSSSSS', ',bbbbbbb']
TOP1_SE = ['.....Sc,', '.....Sc,', '.....Sc,', '.....Sc,', 'SSSSSSc,', 'WWWWWSc,', 'SSSSSbb,', 'bbbbbb,,']
TOP1_FRAME = frame(TOP1_NW, TOP1_NE, TOP1_SW, TOP1_SE, TOP1_N, TOP1_S, TOP1_W, TOP1_E)
TOP1_INNER = inner4([',WS.....', 'WS......', 'S.......'] + ['........'] * 5,
                    ['.....Sc,', '......cW', '.......S'] + ['........'] * 5,
                    ['........'] * 4 + ['S.......', 'WS......', 'SWS.....', 'bWS.....'],
                    ['........'] * 4 + ['.......S', '......SS', '.....SSS', '....bbbb'])
check_frame('A1 바위 윗면 틀', TOP1_FRAME, TOP1_INNER, strict_inner=False)

# ---- 앞면 — 옅은 빙하 얼음벽(32px 2단). 바탕 b, 세로 갈라진 결 d(왼 그늘 m · 오른 빛 c), 처마 밑 고드름(W 빛 · c),
# 아래 턱(22행 c 윗면 · 23행)과 그 밑 어두운 홈(k → d) 에 매달린 고드름 줄, 바닥 닿는 곳 젖은 얼음(m d) 위 서리 점.
FACE1_MID = [
    'cWWcWWcWWWcWWWcW',   # 0  처마 밑 서리 줄
    'mWcmmmWmWcmmmWmW',   # 1  고드름 뿌리(바탕은 처마 그늘 m)
    'mWcmmmWmWcmmmWmc',
    'bWcdcbWbWcdcbWbc',   # 3  세로 결 시작(열 3 · 10)
    'bWcdcbcbWcdcbWbb',
    'bWmdcbbbWcdcbcbb',
    'bcmdcbbbWcdcbbbb',
    'bbmdcbbbWmdcbbbb',
    'bbmdcbbbcmdcbbbb',
    'bbmdcbbbbmdcbbbb',
    'bbmdcbWbbmdcbbbb',
    'bbmdcbbbbmdcbbbb',
    'bbmdcbbbbmdcbmmb',
    'bbmdcbbbbmdcbbbb',
    'bbbmdcbbbmdcbbbb',   # 14 왼 결이 한 열 옮김
    'bbbmdcbbbmdcbbWb',
    'bbbmdcbbbmdcbbbb',
    'bbbmdcbbbmdcbbbb',
    'bbbmdcbbbbmdcbbb',   # 18 오른 결이 한 열 옮김
    'bbbmdcbbbbmdcbbb',
    'mbbmdcbmbbmdcbmb',
    'mbmmdcmmbmmdcmmb',
    'ccccWcccWcccWccc',   # 22 아래 턱 윗면(빛)
    'bmbbbbmbbbbbmbbb',   # 23 턱 앞
    'kWckkkWkkWckkWkk',   # 24 턱 밑 홈(k) 에 고드름 넷(굵기·길이가 다름)
    'kWckkkckkWckkWkk',
    'kWckkkkkkWckkckk',
    'dWdddddddWdddddd',
    'dcdddddddcdddddd',
    'dddddddddddddddd',
    'mmdmmmmdmmmmdmmm',   # 30 젖은 얼음 밑동
    'bmbbcbmbbbmbcbmb']   # 31 바닥 닿는 곳 서리
# 끝 마구리: 왼끝 = 빛 받는 둥근 끝(열 0 c · 열 1 b), 오른끝 = 그늘(열 31 d · 열 30 m). 홈(k) 줄은 끝에서 얕아진다.
FACE1_L = {0: 'Wcc' + 'c' * 19 + 'bbbbbbbmmb', 1: '.' * 3 + 'b' * 11 + '.' * 8 + 'm' + 'bbd' + '.' * 6}
FACE1_R = {0: 'c' + 'd' * 21 + 'mmdddddddb', 1: '.' * 3 + 'm' * 19 + '.' * 10}

# ================================================================================================ A2 「청빙」
# 글자: 얼음 d m b c W = ice 0~4 · 물빛 j k n = water 0~2 · 화산암 1~4 = vrock 1~4 · 쇠빛 서리 h i I = iron 3~5
L2 = legend(d=('ice', 0), m=('ice', 1), b=('ice', 2), c=('ice', 3), W=('ice', 4), j=('water', 0), k=('water', 1),
            n=('water', 2), h=('iron', 3), i=('iron', 4), I=('iron', 5), **{str(i): ('vrock', i) for i in range(1, 5)})

# ---- 얼음굴 흙 — 검푸른 화산암 자갈 흙. 바탕 2, 어두운 1, 밝은 3, 쇠빛 서리 h·i.
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
# 바늘 서리(N): 흙 위에 얼음 쪽으로 뻗은 하얀 결정 바늘(c W) 과 서리 i.
N2_TEX = [
    '2c22W22c2i22c2W2', '2c2cW2cc22c2Wc22', 'cWcWbcWbcWcWbcWc', 'bcbcbcbcbcbcbcbc',
    '2i22c2i22W22c22i', '2c2c2c22cW2c2Wc2', 'cWcbWcWcbcWcbWcW', 'bcbcbcbcbcbcbcbc',
    '22W2i22c22i2W22c', '2cW22cc2Wc22c2Wc', 'WcbcWbcWbcWbcWbc', 'bcbcbcbcbcbcbcbc',
    'i22c22W22i2c22W2', '2Wc2cW22c2Wc2c22', 'cbcWcbWcWbcWcbcW', 'bcbcbcbcbcbcbcbc']
# 흙의 벽 밑 그늘(첫 줄 1, 나머지 1) — 바탕 2 보다 한 단 어둡게
G2_N = [3, 3, 4, 4, 3, 3, 2, 3, 3, 3, 3, 4, 4, 3, 2, 2, 3, 3, 4, 3, 3, 3, 2, 2, 3, 3, 4, 4, 3, 3, 3, 3]
G2_W = [2, 2, 1, 1, 2, 2, 2, 3, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1, 1, 2, 2, 2, 3, 2, 2, 2, 1, 2, 2, 2]

# ---- 얼음 바닥 몸통 — 맑은 청빙: 바탕 d(ice 0), 깊은 물빛 n·k 결(얼음 속 깊이), 하얀 기포 고리 c·W, 빛 받는 획 m.
ICE2_MAIN = [
    'ddddddnddddddddd', 'dddddnnndddddddd', 'ddddnnkndddddmdd', 'dddnnknnddddmddd',
    'dddnkndddddmdddd', 'ddddnnddddmddddd', 'dddddddddddddddd', 'ddddddddddddddnd',
    'nddddddddddddnnn', 'dddddddddddddnkn', 'dddddmdddddddnnd', 'ddddmddddddddddd',
    'dddmdddddddddddd', 'dddddddddddddddd', 'dddddddnnddddddd', 'ddddddnnnddddddd']
ICE2_CORES = [
    [   # 기포 고리 셋(c 고리 · W 빛 점)
        'nndddddddddd', 'nkndddddbddd', 'nndddddbWbdd', 'dddddddcbdmd', 'ddddddddddmd', 'dddbcddddddd',
        'ddbWbdddddnd', 'dddbddddddnn', 'ddddddddbndn', 'ddmdddddcWdd', 'dmddddddddnd', 'dddddddddddd'],
    [   # 깊은 금(k) — 금의 아래·오른쪽이 빛 받는 턱(m)
        'nndddddddddd', 'nkndddddddmd', 'nndkdddddmdd', 'ddddkmdddddd', 'ddddkkmddddd', 'dddddmkddddd',
        'ddddddkmdddn', 'dddddddkkmnn', 'ddddddddmkdn', 'ddddddddddkm', 'dddddddddddd', 'dddddddddddd'],
    [   # 넓은 깊은 물빛 웅덩이(얼음 속 깊이) + 반사 획
        'nndddddddddd', 'nkndddnnnddd', 'nnddnnknnndd', 'dddnkkkknndd', 'dddnnkknnddm', 'ddddnnnndddm',
        'ddddddddddmd', 'ddmdddddddnn', 'dmddddddddnd', 'mdddddcddddd', 'dddddcWddddd', 'ddddcddddddd'],
]
ICE2_FROZEN = [
    [   # 큰 화산암 덩이가 얼음 속에(둘레 깊은 물빛 n)
        'nndddddddddd', 'nknddddddddd', 'dddnnnnnnddd', 'ddn344443ndd', 'dn34443W32nd', 'dn3443W332nd',
        'dn23333321nd', 'dn12222211nd', 'ddn111111ndd', 'dddnnnnnnddd', 'ddmddddddddd', 'dddddddddddd'],
    [   # 작은 덩이 둘
        'nndddddddddd', 'nknddddddddd', 'nnnnnddddddd', 'n3443ndddddd', 'n23W2nddddmd', 'dn111ndddmdd',
        'ddnnnndddddd', 'dddddnnnnnnd', 'ddddn34443nd', 'ddddn2W332nd', 'dddddn1111nd', 'ddddddnnnndd'],
]
# 얼음 바닥 틀 — 2px 솟은 얼음판: 북·서 = 흙 , → 바늘 서리 N 2줄 → 빛 받는 끝 W → c → 몸통.
# 동 = 흙 → 바늘 서리 → 그늘진 끝 n. 남(앞) = 흙 → 판이 흙에 드리운 그늘 1 → 두께 턱 j k(아래가 어둡다) → 앞 끝 빛 m → 몸통.
IF2_N = ',NNWc...'
IF2_W = ',NNWc...'
IF2_E = ',NNn....'
IF2_S = ',1jkm...'
IF2_NW = [',,,,,,,,', ',,,,,NNN', ',,,NNNNN', ',,NNNWWW', ',NNWWccc', ',NNWc...', ',NNWc...', ',NNWc...']
IF2_NE = [',,,,,,,,', 'NNN,,,,,', 'NNNNN,,,', 'WWWNNN,,', 'cccnNNN,', '....nNN,', '....nNN,', '....nNN,']
IF2_SW = [',NNWc...', ',NNWc...', ',NNWc...', ',NNWmmmm', ',NNWkkkk', ',,Njjjjj', ',,,11111', ',,,,,,,,']
IF2_SE = ['....nNN,', '....nNN,', '....nNN,', 'mmmmnNN,', 'kkkkkNN,', 'jjjjjN,,', '11111,,,', ',,,,,,,,']
IF2_FRAME = frame(IF2_NW, IF2_NE, IF2_SW, IF2_SE, uni(IF2_N), uni(IF2_S), uni(IF2_W), uni(IF2_E))
IF2_INNER = inner4([',NNWc...', 'NNWc....', 'NWc.....', 'Wc......', 'c.......'] + ['........'] * 3,
                   ['....nNN,', '.....nNN', '......nN', '.......W', '.......c'] + ['........'] * 3,
                   ['........'] * 3 + ['m.......', 'km......', 'jkm.....', '1jkm....', ',1jkm...'],
                   ['........'] * 3 + ['.......m', '......mk', '.....mkj', '....mkj1', '...mkj1,'])
check_frame('A2 얼음 바닥 틀', IF2_FRAME, IF2_INNER, strict_inner=False)

# ---- 바위 윗면 — 서리 낀 검푸른 화산암: 모난 판(3 빛 면 · 2 바탕 · 1 그늘 금), 서리 가루 i I 가 빛 면 위에, 작은 푸른 결정 끝(m c W).
TOP2_MAIN = [   # 서리 낀 검푸른 화산암 — 바탕 3, 패인 점 2, 서리 알갱이 h, 빛 알갱이 4(흙 바탕 2 보다 한 단 밝다)
    '3333333233333333', '3h33333333332333', '3333323333333333', '3323333334h33333',
    '3333333333333323', '33333h3332333333', '3233333333333333', '3333333333h33343',
    '3334333323333333', '3333333333333333', '33h3332333333h33', '3333333333323333',
    '3332333h33333333', '3333333333333233', '33333h3334333333', '3233333333333333']
TOP2_CORES = [
    [   # 가는 금(2) — 금 아래·오른쪽 빛 받는 턱 4, 금을 따라 서리 알갱이 h
        '333333333333', '323333333333', '3243333h3333', '33243333333h', '333224333333', '33333243h333',
        '3h3333224333', '333333332433', '3333333h3243', '333333333324', '33h333333333', '333333333333'],
    [   # 작은 푸른 결정 무리(m 빛 면 · d · k 그늘 면 · W c 끝) — 바위에 반쯤 묻혔다
        '333333333333', '333333333333', '333333333333', '3333W3333333', '333mck3W3333', '333mdkmck333',
        '3332kk2kk333', '333322223333', '333333333h33', '333333333333', '3h3333333333', '333333333333'],
    [   # 성긴 서리 자리(h i)
        '333333333333', '333333333333', '3333h3333333', '33h33h3h3333', '333hih333h33', '3h333h3i3333',
        '333h33h33h33', '3333333h3333', '333333333333', '333333333h33', '33333333h3h3', '333333333333'],
    [   # 맨 바위(점 자리만 다름)
        '333333333333', '33333h333333', '332333333333', '333333333333', '33333333h333', '333333233333',
        '3h3333333333', '333333333333', '333333333323', '332333333333', '33333h333333', '333333333333'],
]
# 틀: 북·서 = 흙 홈 , → 서리 끝 I → 밝은 바위 4 → 몸통. 동 = 흙 → 그늘 1 → 2. 남(처마) = 바깥에서 처마 밑 1 → 서리 줄 i → 빛 받는 끝 4 → 3.
_TN2 = lambda k, m: 'I' if k == 0 else '4' if k == 1 else '3'  # noqa: E731
_TE2 = lambda k, m: '1' if k == 0 else '2'  # noqa: E731
_TS2 = lambda k, m: '1i43'[k] if k < 4 else '3'  # noqa: E731
TOP2_N = strips([(2, 4), (2, 4), (1, 4), (1, 3), (1, 3), (0, 3), (1, 3), (2, 4),
                 (2, 4), (1, 3), (2, 5), (3, 5), (2, 4), (1, 3), (0, 3), (2, 4)], _TN2, ',')
TOP2_W = strips([(1, 4), (1, 3), (0, 3), (1, 3), (2, 4), (3, 5), (2, 4), (1, 4),
                 (1, 4), (2, 4), (2, 4), (1, 3), (1, 3), (0, 3), (1, 3), (1, 4)], _TN2, ',')
TOP2_E = strips([(1, 3), (2, 4), (3, 5), (2, 4), (1, 3), (1, 3), (0, 2), (1, 3),
                 (1, 3), (1, 3), (1, 3), (2, 4), (2, 4), (1, 3), (1, 3), (1, 3)], _TE2, ',')
TOP2_S = strips([(0, 4), (0, 5), (0, 5), (0, 4), (0, 4), (0, 4), (0, 5), (0, 4),
                 (0, 4), (0, 4), (0, 5), (0, 5), (0, 4), (0, 4), (0, 4), (0, 4)], _TS2, ',')
TOP2_NW = [',,,,,,,,', ',,,,,,,,', ',,,,IIII', ',,,I4444', ',,I43...', ',I43....', ',I43....', ',I43....']
TOP2_NE = [',,,,,,,,', ',,,,,,,,', 'IIII,,,,', '44441,,,', '...21,,,', '....21,,', '.....21,', '.....21,']
TOP2_SW = [',I43....', ',I43....', ',I43....', ',I43....', ',I433333', ',I444444', ',iiiiiii', ',1111111']
TOP2_SE = ['.....21,', '.....21,', '.....21,', '.....21,', '3333321,', '4444421,', 'iiiii11,', '111111,,']
TOP2_FRAME = frame(TOP2_NW, TOP2_NE, TOP2_SW, TOP2_SE, TOP2_N, TOP2_S, TOP2_W, TOP2_E)
TOP2_INNER = inner4([',I43....', 'I43.....', '43......', '3.......'] + ['........'] * 4,
                    ['.....21,', '......1I', '.......4', '.......3'] + ['........'] * 4,
                    ['........'] * 4 + ['3.......', '43......', 'i43.....', '1i43....'],
                    ['........'] * 4 + ['.......3', '......34', '.....34i', '....3iii'])
check_frame('A2 바위 윗면 틀', TOP2_FRAME, TOP2_INNER, strict_inner=False)

# ---- 앞면 — 검푸른 바위(2 바탕 · 1 금 · 3 빛 턱)에 박힌 푸른 결정 기둥(k 그늘 면 · d 가운데 · m 빛 면 · c W 모서리 빛),
# 처마 밑 가는 고드름(c W), 아래 바위 턱(22~23행) 밑 홈(j) 에 매달린 고드름, 바닥 닿는 곳 서리(i).
FACE2_MID = [   # 큰 결정 하나(열 3~8) + 작은 결정(열 11~13), 아랫단은 자리를 엇갈려 둘
    'iIiiiIiiiIiiiIii',   # 0  처마 밑 서리 줄
    '1c11W1111c1111W1',   # 1  가는 고드름
    '2c223Wc1222322c2',   # 2  큰 결정 끝(열 5~6)
    '2W22mcdk22333222',
    '2223mbddk2343222',
    '222mbdddk1233122',
    '232mbdddk1122212',
    '332mbdddk122W222',   # 7  작은 결정 끝(열 12)
    '332mbdddk12mck22',
    '222mbdddk12mdk21',
    '212mbdddk12mdk22',
    '222mdddkk121kk12',
    '2221mkkk11233112',
    '2332111122344322',
    '2344322123433212',
    '2332112123332112',
    '1221112112211111',   # 16 아랫단
    '2222222222222mc2',   # 17 결정 C 끝
    '22322Wc2222mbdk2',   # 18 결정 D 끝
    '2332mcdk223mbddk',
    '2332mddk2332mddk',
    '1222mdkk2332mddk',
    '33443mk344433dk4',   # 22 바위 턱 윗면(빛)
    '2222222222222222',   # 23 턱 앞
    'jjcjjjjWjjjcjjjj',   # 24 턱 밑 어두운 홈(j) 에 가는 고드름 셋(길이가 다름)
    'jjcjjjjcjjjcjjjj',
    'jjcjjjjjjjjcjjjj',
    'kkckkkkkkkkWkkkk',
    'kkWkkkkkkkkkkkkk',
    'kkkkkkkkkkkkkkkk',
    '1212121112121211',   # 30 밑동
    'i1i1h1i11i1h1i11',   # 31 바닥 닿는 곳 서리
]
FACE2_L = {0: 'I' + '3' * 21 + '4' + '3' + '333322' + '2' + 'i', 1: '.' + '3' * 3 + '.' * 28}
FACE2_R = {0: 'i' + '1' * 21 + '22' + 'jjjjkk' + '11', 1: '.' * 32}

for _n, _m in (('A1', FACE1_MID), ('A2', FACE2_MID)):
    assert len(_m) == 32 and all(len(r) == 16 for r in _m), (_n, [len(r) for r in _m])


# ================================================================================================ 조립
WOB1 = no_s(WOB)            # 바위 윗면 A1: 북·서·동 굴곡, 남(처마) 곧게
WOB2 = no_s(rev(WOB))       # A2 는 표를 뒤집어 쓴다(같은 굴곡이면 두 후보 윤곽이 겹친다)
WOB_ICE1 = WOB
WOB_ICE2 = {'N': WOB['S'], 'S': [0] * 32, 'W': WOB['E'], 'E': WOB['W']}   # 솟은 판 A2 는 남(두께 턱)을 굽히지 않는다


def ground(n):
    """얼음굴 흙 오토타일(벽 밑 그늘 북·서) + 몸통 변형 둘."""
    if n == 1:
        rows, spots, vs, leg, N_, W_ = G1_BASE, G1_SPOTS, (G1_V1, G1_V2), L1, G1_N, G1_W
    else:
        rows, spots, vs, leg, N_, W_ = G2_BASE, G2_SPOTS, (G2_V1, G2_V2), L2, G2_N, G2_W
    body = ground_at(rows, spots, leg)
    var = [ground_at(rows, v, leg) for v in vs]
    shade = legend(**{'1': ('cfloor', 1), '2': ('cfloor', 2)}) if n == 1 else legend(**{'1': ('vrock', 1), '2': ('vrock', 1)})
    fr = grid(floor_frame(N_, W_, '1', '2'), shade, 32, 32)   # 첫 줄 '1', 나머지 '2' (A2 는 둘 다 vrock 1)
    inn = grid(G_INNER, shade, 16, 16)
    return autotile_cv(body, fr, inn, var)


def frost_tex(n):
    if n == 1:
        return {'F': grid(F1_TEX, L1), 'R': grid(R1_TEX, L1)}
    return {'N': grid(N2_TEX, L2)}


def ice_floor(n):
    g = ground(n)
    leg = L1 if n == 1 else L2
    fr_rows, inn_rows, prof = (IF1_FRAME, IF1_INNER, WOB_ICE1) if n == 1 else (IF2_FRAME, IF2_INNER, WOB_ICE2)
    tex = dict(frost_tex(n), **{',': g.body})
    fr, inn = fill(fr_rows, inn_rows, leg, tex)
    wobble(fr, g.body, prof)
    main, cores = (ICE1_MAIN, ICE1_CORES) if n == 1 else (ICE2_MAIN, ICE2_CORES)
    bs = bodies(main, cores, leg)
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
    main, cores = (TOP1_MAIN, TOP1_CORES) if n == 1 else (TOP2_MAIN, TOP2_CORES)
    bs = bodies(main, cores, leg)
    return autotile_cv(bs[0], fr, inn, bs[1:])


def ice_face(n):
    if n == 1:
        return face_from(FACE1_MID, FACE1_L, FACE1_R, L1)
    return face_from(FACE2_MID, FACE2_L, FACE2_R, L2)


# ================================================================================================ 장면 — 얼음 동굴 두 방(14×10)
# '#' 얼음 바위 · '.' 얼음굴 흙 · 'i' 얼음 바닥. 가운데 바위 덩이(북벽에서 내려온 곶)가 두 방을 나누고, 남쪽 통로로 이어진다.
# 오른 방 북벽에 작은 바위 턱(앞면 2단 + 윗면 1칸). 왼 방 얼음판 안쪽 칸에 얼음 속 돌.
SCENE = [
    '##############',
    '##############',
    '##############',
    '#.....###.##.#',
    '#iiiii###.##.#',
    '#iiiii###....#',
    '#iiiii###.ii.#',
    '#iiii.....iii#',
    '##.i...ii.ii.#',
    '##############',
]
FROZEN_AT = [(2, 5, 0), (4, 5, 1)]   # (칸 x, 칸 y, 얼음 속 돌 번호) — 안쪽(마스크 255) 칸만
ACTOR_AT = (10, 6)


def actor_cv():
    return dot.Cv.of(dot.actor1_frame(1, 0, 0))


def scene(n, actor=True):
    g = [r.replace('i', 'w') for r in SCENE]
    assert not dot.structure_errors(g), dot.structure_errors(g)
    ice = ice_floor(n)
    cv = dot.render_cave(g, rock_top(n), ice_face(n), ground(n), water=ice)
    fz = frozen_tiles(n)
    for x, y, k in FROZEN_AT:
        if dot.mask_at(g, x, y, lambda ch, X, Y: ch == 'w') == 255:
            cv.a[y * T:(y + 1) * T, x * T:(x + 1) * T] = fz[k].a
    if actor:
        cx, cy = ACTOR_AT
        cv.paste(actor_cv(), cx * T - 4, cy * T - 14)
    return cv, g


# ================================================================================================ 후보
NOTES = {
    'A1': '「빙하」 — 옅은 빙하 얼음(반사 획·기포·실금, 서리가 눈 녹듯 흙으로 번지는 평평한 빙판) · 눈 모자 두른 회색 바위 윗면 + 옅은 빙하 얼음벽(세로 결, 처마·턱 밑 고드름) · 언 갈색 흙',
    'A2': '「청빙」 — 짙고 맑은 푸른 얼음(깊은 물빛 결·기포 고리, 2px 솟은 판의 남쪽 두께 턱, 바늘 서리 테두리) · 서리 낀 검푸른 화산암 윗면 + 바위에 박힌 푸른 결정 기둥 앞면(턱 밑 고드름) · 검푸른 자갈 흙',
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
            'note': NOTES[f'A{n}'] + ' — 원본 = 얼음 바닥 A2(+몸통 변형 3) | 얼음굴 흙 A2(+변형 2)',
            'extras': [('얼음 몸통 8×8 (변형 3 섞음)', dot.mosaic(at, 8, 8), 2), ('흙 몸통 8×8 (변형 2 섞음)', dot.mosaic(gr, 8, 8), 2),
                       ('얼음 속 돌 칸', hcat(*fz), 4), ('얼음 바닥 47 변형', variants_sheet(at), 2)]}
    return fn


def cand_ice_rock(n):
    def fn():
        at = rock_top(n)
        f = ice_face(n)
        v, g = scene(n)
        return hcat(a2_plus(at), f.b), {
            'kind': 'autotile', 'autotiles': {'ceil': at}, 'faces': {'face': f}, 'vignette': v, 'grid': g, 'rim_check': True,
            'note': NOTES[f'A{n}'] + ' — 원본 = 바위 윗면 A2(+몸통 변형 3) | 얼음벽 앞면 32×32',
            'extras': [('윗면 몸통 8×8 (변형 3 섞음)', dot.mosaic(at, 8, 8), 2), ('앞면 6칸 이어 붙임(끝 마구리 포함)', face_run(f), 3),
                       ('윗면 47 변형', variants_sheet(at), 2)]}
    return fn


CANDIDATES = {
    'gap.ice_floor': {'A1': cand_ice_floor(1), 'A2': cand_ice_floor(2)},
    'gap.ice_rock': {'A1': cand_ice_rock(1), 'A2': cand_ice_rock(2)},
}


SCENE_LEAD = (   # 후보 장면 설명(줄 공통이라 줄별 장면은 두지 않는다 — 후보마다 장면이 같은 얼음 동굴)
    '같은 번호의 얼음 바위(윗면·앞면)·얼음 바닥·얼음굴 흙만으로 깐 14×10 얼음 동굴 — 두 방, 가운데 바위 곶, 북벽 바위 턱, '
              '얼음판 안 얼음 속 돌, Actor1. 맵 가장자리는 잘린 것(맵이 이어진다고 본다).')
