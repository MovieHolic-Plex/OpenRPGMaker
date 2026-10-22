"""gap-props-r1 — 버들항 화풍 문·레버와 고블린 야영 소품(2026-10-23, 조수 던전 그림 부족분).

모든 화소는 이 파일의 행 문자열에서 온다(손 도트). 생성 이미지·잡음 함수·도형 마스크 본체는 없다.
외곽선 규칙(seed rules.outline): 먹 윤곽 없이 재질 명암 — 빛 받는 위·왼 가장자리는 재질의 밝은 단, 그늘 아래·오른은 어두운 단.
작은 기물(1~2칸)은 그늘 쪽을 그 재질의 가장 어두운 단 + 접지 그림자(~).

항목 여섯 모두 줄 공통(시드 common) — 후보 키 A1 A2. 장면은 props-r1 처럼 세 줄(cave-r1 1번) 방을 나란히 놓고,
천막 후보의 장면은 같은 번호의 천막·울타리·모닥불·뼈 더미를 모은 고블린 야영지(세 줄)다.

범례는 기물마다 따로 둔다(글자 뜻이 기물마다 다르다). 공통 약속:
  돌 '0'~'5' = stone 0~5 · 나무 a~f = wood 0~5 · 쇠 g~l = iron 0~5 · 뼈 s~w = bone 0~4 · 불 F G H J K L = fire 0~5
  · 붉은 S~W = red 0~4 · 발광 M~R = glow 0~5 · 깊은 청록 x = pool 0 · 흙 그늘 z = rim 0 · ';' ':' ',' = void 0~2(구조물 안쪽에만).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dot  # noqa: E402
from dot import Cv, grid, legend, stamp  # noqa: E402
import props_r1 as PR  # noqa: E402  방·사람·세 줄 장면 도우미(props-r1 과 같은 장면 규약)

WAVE = 'gap'
T = 16


def ramp_chars(ramp, chars):
    return {ch: (ramp, i) for i, ch in enumerate(chars)}


BASE = {}
for _r, _c in (('stone', '012345'), ('wood', 'abcdef'), ('iron', 'ghijkl'), ('bone', 'stuvw'), ('fire', 'FGHJKL'),
               ('red', 'STUVW'), ('glow', 'MNOPQR')):
    BASE.update(ramp_chars(_r, _c))
BASE.update(x=('pool', 0), y=('pool', 1), z=('rim', 0))
BASE.update({';': ('void', 0), ':': ('void', 1), ',': ('void', 2)})
LEG = legend(**BASE)


def leg(**over):
    d = dict(BASE)
    d.update(over)
    return legend(**d)


def g(rows, lg=None):
    return grid(rows, lg or LEG)


def put(cv, rows, lg, x, y):
    stamp(cv, rows, lg, x, y)
    return cv


hcat = PR.hcat


def fill_region(base, mask_rows, fill_rows):
    """base 행에서 mask_rows 의 'o' 자리만 fill_rows 글자로 바꾼 행(문 안쪽 갈아 끼우기). 같은 크기의 행 문자열 셋."""
    out = []
    for b, m, f in zip(base, mask_rows, fill_rows):
        out.append(''.join(fc if mc == 'o' else bc for bc, mc, fc in zip(b, m, f)))
    return out


# ================================================================================================ 문 (1×2 조각 둘: 닫힘 | 열림)
# A1 둥근 아치: 밝은 회색 다듬은 돌 아치(쐐기돌 + 방사 이음) · 2px 문설주(줄눈) · 2단 문턱. 문짝 = 세로 널 넷(널마다 왼쪽 밝음)
# + 쇠띠 둘(징) + 쇠고리 손잡이. 통로 12px(2~13열), 아치 꼭대기 3행 → 문 높이 27px.
# 열림 = 문짝이 안쪽으로 젖혀져 왼쪽 문설주 안쪽에 널 옆면(2~3열)만 보이고, 안은 위로 갈수록 짙은 어둠 + 바닥 돌이 안으로 사라진다.
DOOR1_SHUT = [
    '....45555543....',
    '..544245542321..',
    '.54324455432321.',
    '54322bccccb23210',
    '543cbdcbdcbdc210',
    '54dcbdcbdcbdcb20',
    '54edbedbedbedb20',
    '54edbedbedbedb20',
    '54edbedbedbedb20',
    '54lkkkkkkkkklj20',
    '42hhhhhhhhhhhg10',
    '54edbedbedbedb20',
    '54edbedbedbedb20',
    '54edbedbedbedb20',
    '54edbedbedbedb20',
    '54edbedbedbldb20',
    '42edbedbedkajb10',
    '54edbedbedjahb20',
    '54edbedbedbhdb20',
    '54edbedbedbedb20',
    '54edbedbedbedb20',
    '54edbedbedbedb20',
    '42edbedbedbedb10',
    '54lkkkkkkkkklj20',
    '54hhhhhhhhhhhg20',
    '54edbedbedbedb20',
    '54edbedbedbedb20',
    '54edbedbedbedb20',
    '42edbedbedbedb10',
    '54cbacbacbacba20',
    '5444444444444420',
    '1000000000000000',
]
DOOR1_MASK = [
    '................',
    '................',
    '................',
    '.....oooooo.....',
    '...oooooooooo...',
] + ['..oooooooooooo..'] * 25 + ['................'] * 2
DOOR1_INSIDE = [
    '................',
    '................',
    '................',
    '.....;;;;;;.....',
    '...;;;;;;;;;;...',
    '..db;;;;;;;;;;..',
    '..db;;;;;;;;;;..',
    '..db;;;;;;;;;;..',
    '..db;;;;;;;;;;..',
    '..kj;;;;;;;;;;..',
    '..hg;;;;;;;;;;..',
    '..db;;;;;;;;;;..',
    '..db::::::::::..',
    '..db::::::::::..',
    '..db::::::::::..',
    '..db::::::::::..',
    '..db::::::::::..',
    '..db::::::::::..',
    '..db,,,,,,,,,,..',
    '..db,,,,,,,,,,..',
    '..db,,,,,,,,,,..',
    '..db,,,,,,,,,,..',
    '..db,,,,,,,,,,..',
    '..kj,,,,,,,,,,..',
    '..hg1111111111..',
    '..db1111111111..',
    '..db1121111211..',
    '..db2222222222..',
    '..db2212222122..',
    '..ba2222222222..',
    '................',
    '................',
]

# A2 뾰족 아치 + 처마돌: 네모 실루엣. 맨 위 처마돌 윗면 2줄(밝음) + 앞 모서리 1줄, 그 밑 뾰족 아치(왼쪽 밝은 테·오른쪽 그늘 테)
# + 아치 옆 메움돌(줄눈) + 받침돌(26~29행). 문짝 = 넓은 널 셋(4px) + 긴 경첩 띠 셋(왼쪽에서 9px, 끝이 말림) + 징 두 줄 + 가운데 고리 문고리.
# 열림 = 문짝이 오른쪽 문설주 안쪽으로 젖혀져 널 옆면(12~13열)과 경첩 끝이 보이고, 안은 어둠 + 아래로 내려가는 돌계단 두 단.
DOOR2_SHUT = [
    '5555555555555554',
    '5444444444444442',
    '3222222222222210',
    '5433445ba2233210',
    '543345cbba233210',
    '54335cbbcba23210',
    '5435dcbdcbdc2210',
    '545edcbedcbed210',
    '54edcbedcbedcb20',
    '54lkkkkkkkkjcb20',
    '54hhhhhhhhhgcb20',
    '42edcbedcbedcb10',
    '54edcbedcbedcb20',
    '54edkbedkbedkb20',
    '54edcbedcbedcb20',
    '54edcbedcbedcb20',
    '42lkkkkkkkkjcb10',
    '54hhhhhhhhhgcb20',
    '54edcbedckedcb20',
    '54edcbedjahdcb20',
    '54edcbedkchdcb20',
    '42edcbedchedcb10',
    '54edkbedkbedkb20',
    '54lkkkkkkkkjcb20',
    '54hhhhhhhhhgcb20',
    '54edcbedcbedcb20',
    '55edcbedcbedcb40',
    '44cbacbacbacba30',
    '43cbacbacbacba20',
    '32babababababa10',
    '5444444444444420',
    '1000000000000000',
]
DOOR2_MASK = [
    '................',
    '................',
    '................',
    '.......oo.......',
    '......oooo......',
    '.....oooooo.....',
    '....oooooooo....',
    '...oooooooooo...',
] + ['..oooooooooooo..'] * 22 + ['................'] * 2
DOOR2_INSIDE = [
    '................',
    '................',
    '................',
    '.......;;.......',
    '......;;;;......',
    '.....;;;;;;.....',
    '....;;;;;;;;....',
    '...;;;;;;;;;;...',
    '..;;;;;;;;;;cb..',
    '..;;;;;;;;;;kj..',
    '..;;;;;;;;;;hg..',
    '..::::::::::cb..',
    '..::::::::::cb..',
    '..::::::::::kb..',
    '..::::::::::cb..',
    '..::::::::::cb..',
    '..::::::::::kj..',
    '..::::::::::hg..',
    '..,,,,,,,,,,cb..',
    '..,,,,,,,,,,cb..',
    '..,,,,,,,,,,cb..',
    '..1111111111cb..',
    '..;;;;;;;;;;kb..',
    '..1111111111kj..',
    '..::::::::::hg..',
    '..2222222222cb..',
    '..1111111111cb..',
    '..3333333333ca..',
    '..2222222222ca..',
    '..1111111111ba..',
    '................',
    '................',
]


def door(rows, mask, inside, opened):
    return g(fill_region(rows, mask, inside) if opened else rows)


# ================================================================================================ 레버 (1×1 둘: 올림 | 내림)
# A1 쇠 벽판(리벳 넷 · 가운데 굴대 머리) + 굵은 나무 자루(3px 대각) + 공 손잡이. 올림 = 자루가 왼쪽 위로, 손잡이 붉음(잠김) ·
# 내림 = 오른쪽 아래로, 손잡이가 청록으로 빛남(풀림). 벽판은 두 상태가 같다.
LEVER1_PLATE = [
    '................',
    '................',
    '................',
    '................',
    '...kllllllllj...',
    '...llljjjjjljg..',
    '...ljhjjjjjhjg..',
    '...ljjjjjjjjjg..',
    '...ljjjjkljjjg..',
    '...ljjjklljjjg..',
    '...ljjjjkihjjg..',
    '...ljjjjhhjjjg..',
    '...llljjjjjljg..',
    '...ljhjjjjjhjg..',
    '...hggggggggggg.',
    '................',
]
LEVER1_UP = [
    '.WV.............',
    'WWVU............',
    'VVUU............',
    '.UUedb..........',
    '....edb.........',
    '.....edb........',
    '......edb.......',
    '.......edb......',
]
LEVER1_DOWN = [
    '.........edb....',
    '..........edb...',
    '...........edPR.',
    '............PRPN',
    '............NPNx',
    '.............xx.',
]
# 판 오른쪽 열 그늘(g)이 판 밖으로 1px 나가 보이지 않게 판 폭을 맞춘다(아래 lever1 에서 13열까지만).

# A2 돌 받침 덩이(윗면 3줄 + 앞면 3줄 + 밑 그늘) 위에 쇠 반달 톱니 틀 + 쇠 막대 + 공 손잡이. 올림 = 막대가 곧게 서고 손잡이 붉음 ·
# 내림 = 막대가 오른쪽으로 90° 누워 톱니 틀 끝에 걸리고 손잡이가 청록으로 빛남. 받침·톱니 틀은 두 상태가 같다.
LEVER2_BASE = [
    '................',
    '................',
    '................',
    '......jkkj......',
    '....jkggggkh....',
    '...jkg....khg...',
    '...kg......hg...',
    '..jkg.......hg..',
    '..kg........hg..',
    '..555555555551..',
    '..544444444420..',
    '..444444444210..',
    '..333233332100..',
    '..333233332100..',
    '..222122221000..',
    '..100000000000..',
]
LEVER2_PIVOT = ['kllh', 'jkhg']   # (6, 9) 굴대 머리(윗면 위)
LEVER2_UP = [
    '.WV.',
    'WWVU',
    'VVUU',
    '.UU.',
    '.kg.',
    '.kg.',
    '.kg.',
    '.kg.',
    '.kg.',
]
LEVER2_DOWN = [
    '.......RP..',
    'lllllllPPNx',
    'gggggggNNxx',
    '........xx.',
]


def lever1(up):
    cv = g(LEVER1_PLATE)
    stamp(cv, LEVER1_UP if up else LEVER1_DOWN, LEG, 0, 0 if up else 10)
    return cv


def lever2(up):
    cv = g(LEVER2_BASE)
    if up:
        stamp(cv, LEVER2_UP, LEG, 6, 0)
    else:
        stamp(cv, LEVER2_DOWN, LEG, 5, 7)
    stamp(cv, LEVER2_PIVOT, LEG, 6, 9)
    return cv


# ================================================================================================ 뼈 더미 · 약탈품 더미 (1×1 둘)
# 뼈(bone s~w)는 밝은 재질이라 가장자리를 밝은 단으로 두고(바닥보다 0.2 이상 밝다) 뼈 사이 틈만 어두운 단(s·z) + 접지 그림자.
# 약탈품은 나무·쇠·삼베라 그늘 쪽을 각 재질 가장 어두운 단(a·g·z)으로.
LOOT_LEG = leg(m=('gold', 0), n=('gold', 1), o=('gold', 2), p=('gold', 3), q=('gold', 4), r=('gold', 5),
               X=('cfloor', 0), A=('cfloor', 1), B=('cfloor', 2), C=('cfloor', 4), D=('cfloor', 6), E=('cfloor', 7),
               **{'6': ('rim', 1), '7': ('rim', 2), '8': ('rim', 3), '9': ('rim', 4)})

# 뼈 조각(손 도트). 뼈 사이가 바닥으로 트여 있어 낱개 뼈가 읽힌다.
SKULL_S = [   # 작은 해골(갉힌 정수리)
    '.vwwv.',
    'vwwwwv',
    'wzwwzv',
    'wzvvzv',
    'vwwzwv',
    '.vtvt.',
]
BONE_L = [    # 긴 다리뼈(가로) — 끝 마디 둘
    'wv..........wv',
    'wwwwwwwwwwwwwv',
    'vv..........vv',
]
BONE_M = [
    'wv......wv',
    'wwwwwwwwwv',
    'vv......vv',
]
BONE_D = [    # 비스듬히 선 뼈(왼 아래 → 오른 위)
    '......wv',
    '.....wwv',
    '....wv..',
    '...wv...',
    '..wv....',
    'wwv.....',
    'vv......',
]
BONE_GNAW = [  # 이빨 자국 난 뼈(가로, 가운데가 갉혀 잘록)
    'wv.......wv',
    'wwwwvtvwwwv',
    'vv.......vv',
]
RIBS = [      # 등뼈 + 갈비 넷(위로 휜 활)
    '.v..v..v..v',
    'w..w..w..w.',
    'w..w..w..w.',
    'v..v..v..v.',
    'vwvwvwvwvwv',
]
BEAST = [     # 뿔 달린 짐승 머리뼈(정면): 옆으로 뻗다 위로 휜 굵은 뿔 · 넓은 정수리 · 눈구멍 · 긴 주둥이 · 콧구멍
    'wv..........vw',
    'wv..........vw',
    'vwv........vwv',
    '.vwwvwwwwvwwv.',
    '..vwwwwwwwwv..',
    '..wzzwwwwzzv..',
    '..vzwwwwwwzv..',
    '...vwwwwwwv...',
    '....vwwwwv....',
    '....wzwwzv....',
    '.....vwwv.....',
]


def bones1():
    """A1: 엇갈려 쌓은 긴 뼈 더미 + 갈비 + 갉힌 해골."""
    cv = Cv(T, T)
    P = lambda rows, x, y: stamp(cv, rows, LOOT_LEG, x, y)
    P(BONE_D, 8, 2)
    P(RIBS, 5, 5)
    P(BONE_GNAW, 4, 9)
    P(SKULL_S, 1, 4)
    P(BONE_L, 1, 11)
    P(['wv', 'vv'], 13, 8)
    P(['..~~~~~~~~~~~~~.'], 0, 14)
    return cv


def bones2():
    """A2: 뿔 달린 짐승 머리뼈를 얹은 높은 더미."""
    cv = Cv(T, T)
    P = lambda rows, x, y: stamp(cv, rows, LOOT_LEG, x, y)
    P(BONE_M, 0, 9)
    P(BONE_M, 6, 10)
    P(BONE_D, 0, 6)
    P(BEAST, 1, 0)
    P(BONE_L, 1, 12)
    P(['.~~~~~~~~~~~~~~.'], 0, 15)
    return cv


# A1 약탈품: 묶은 삼베 자루(왼) + 뒤의 작은 통(윗면 뚜껑 판) + 가운데 땅에 꽂힌 녹슨 칼(자루가 위) + 흘린 금화.
LOOT1 = [
    '................',
    '.......q........',
    '.......o........',
    '.......c........',
    '.....hkkkg......',
    '.......kg.......',
    '..XAX..kg.......',
    '..zbz..7g.jkkh..',
    '.BDECz.kgjfqrdg.',
    'BDEDCBz8ghiiihg.',
    'CDEDCBzkgedccba.',
    'CDDCBAzkgdccbba.',
    'BCCBAXzkgkjhhgg.',
    '.ABAXzz7gdcbbaa.',
    '..zzzz.g..aaaa..',
    '..~~~~~~~~~~~~~.',
]
# A2 약탈품: 옆으로 쓰러진 통(바닥 쪽이 왼쪽, 열린 입이 오른쪽 — 금화가 쏟아짐) + 뒤에 주저앉은 자루 + 앞에 가로로 누운 녹슨 칼.
LOOT2 = [
    '................',
    '................',
    '..........XAX...',
    '.........zBDz...',
    '........zCEDCz..',
    '.ljhhhhj.BDDCBz.',
    'kfeedcbaj.CCBAz.',
    'jedddcbai;zXzz..',
    'iedcccbah;qp....',
    'hdcbbbaag.prq...',
    '.ggggggg.qpoqpn.',
    '........opqnpon.',
    '...k.....mnmmn..',
    'qbbkllkkkkkkkh..',
    '...gg7gg8gggg...',
    '.~~~~~~~~~~~~~~.',
]


# ================================================================================================ 모닥불 (1×1 장면 넷)
# 겹 순서: 뒤(먼 돌·장작) → 불꽃(장면마다) → 앞(가까운 돌·꼬챙이 받침·꼬챙이·고기). 불꽃 밖 화소는 네 장면이 같다.
# A1 둥근 돌 고리 + 엇갈린 장작 + 양쪽 Y 받침에 걸친 가로 꼬챙이 + 구운 고깃덩이. 장면마다 불꽃과 장작 위 불씨만 바뀐다.
CF1_BACK = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '..454.4554.454..',
    '..321.3321.320..',
    '43.ced....dec.41',
    '32..bcdaadcb..30',
    '10...zabbaz...00',
    '................',
    '................',
    '................',
]
CF1_FRONT = [
    '................',
    'd.d..........d.d',
    '.d.....cdec...d.',
    '.dbbbbcdeffdbbd.',
    '.b....bdefedU.b.',
    '.b....TbdedbU.b.',
    '.b.....UbbbU..b.',
    '.b............b.',
    '.b............b.',
    '.a............a.',
    '................',
    '................',
    '.45..455.554.45.',
    '4331.3421.343210',
    '0000.0000.000000',
    '.~~~~~~~~~~~~~~.',
]
CF1_FLAMES = [
    ['................',
     '................',
     '................',
     '................',
     '................',
     '......L..K......',
     '.....KLK.L......',
     '....JKLLKJ......',
     '....HJKLKJH.....',
     '....GHJKJHG.....',
     '.....GHJHG......',
     '......FGF.......'],
    ['................',
     '................',
     '................',
     '................',
     '................',
     '.....K...L......',
     '.....KL.KLK.....',
     '....JKLLKJ......',
     '....HJKLLJH.....',
     '....GHJKJHG.....',
     '.....GHJHG......',
     '......FGF.......'],
    ['................',
     '................',
     '................',
     '................',
     '................',
     '.......L........',
     '.....KKLK.......',
     '....JKLLKJ......',
     '....HJLLKJH.....',
     '....GHJKJHG.....',
     '.....GHJHG......',
     '......FGF.......'],
    ['................',
     '................',
     '................',
     '................',
     '................',
     '......K..L......',
     '......LKKLK.....',
     '.....JKLLKJ.....',
     '....HJKLKJH.....',
     '....GHJKJHG.....',
     '.....GHJHG......',
     '......FGF.......'],
]
CF1_EMBERS = [[(5, 12, 'H'), (9, 12, 'G')], [(6, 12, 'J'), (10, 11, 'G')], [(5, 11, 'G'), (8, 12, 'H')], [(7, 12, 'H'), (10, 12, 'J')]]

# A2 굵은 바위 말굽(앞이 트임 — 재 바닥이 보임, 왼쪽 바위 위에 해골) + 세모로 세운 장작 둘 + 오른쪽 땅에 비스듬히 꽂은 긴 꼬챙이 끝에
# 뼈 달린 다리 고기가 불 위로 늘어진다. 장면마다 불꽃과 재 위 불씨만 바뀐다.
CF2_BACK = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '..451..4551..541',
    '.433214333213320',
    '.3210..2100..200',
    '451..........540',
    '433..........310',
    '320..........200',
    '00..zabaabaz..00',
    '....zzaazaaz....',
    '................',
    '................',
]
CF2_FRONT = [
    '..ts............',
    '..vtdc..........',
    '...cedTc........',
    '...cefedU.......',
    '....TdeedU......',
    '.....UbbUdb.....',
    '......dcbbdb....',
    '.....dc..cbdb...',
    '....dc....cbdb..',
    '....dc....cb.db.',
    '...dc......cb.db',
    '...dc......cb..b',
    '..eb........cb..',
    '................',
    '.~~~~~~~~~~~~~~.',
    '................',
]
CF2_FLAMES = [
    ['................',
     '................',
     '................',
     '................',
     '................',
     '................',
     '.......LK.......',
     '......JKLK......',
     '......JLLKJ.....',
     '.....HJKLKJ.....',
     '.....GJKLKH.....',
     '......HJKJG.....',
     '.......GHG......'],
    ['................',
     '................',
     '................',
     '................',
     '................',
     '................',
     '........KL......',
     '.......KLK......',
     '......JKLLJ.....',
     '.....HJLKKJH....',
     '.....GJKLKJG....',
     '......HJKJH.....',
     '.......GHG......'],
    ['................',
     '................',
     '................',
     '................',
     '................',
     '................',
     '.......K.L......',
     '......KLKLJ.....',
     '......JLLKJ.....',
     '.....HJKLLJ.....',
     '.....GJKLKH.....',
     '......HJKJG.....',
     '.......GHG......'],
    ['................',
     '................',
     '................',
     '................',
     '................',
     '................',
     '.......L........',
     '......JLK.......',
     '.....HJLLKJ.....',
     '.....HJKLKJ.....',
     '.....GJKLKH.....',
     '......HJKJG.....',
     '.......GHG......'],
]
CF2_EMBERS = [[(5, 13, 'H'), (10, 13, 'G')], [(7, 13, 'J'), (11, 12, 'H')], [(6, 13, 'G'), (9, 13, 'J')], [(4, 12, 'J'), (8, 13, 'H')]]


CF_LEG = leg(**{'0': ('crock', 0), '1': ('crock', 2), '2': ('crock', 3), '3': ('crock', 4), '4': ('crock', 5), '5': ('crock', 6)})


def campfire(back, flames, front, embers, k):
    cv = g(back, CF_LEG)
    stamp(cv, flames[k], LEG, 0, 0)
    for x, y, ch in embers[k]:
        cv.put(x, y, LEG[ch])
    stamp(cv, front, CF_LEG, 0, 0)
    return cv


# ================================================================================================ 말뚝 울타리 (1×2 조각 셋: 서끝 | 가운데 | 동끝)
# 아래 칸 = 막힘, 위 칸 = ★(말뚝 끝이 윗칸에 걸침). 가운데 조각은 16px 주기로 이어진다(관문 R·이음은 장면으로 본다).
PAL_LEG = leg(A=('cfloor', 1), B=('cfloor', 2), C=('cfloor', 4), D=('cfloor', 6), E=('cfloor', 7),
              **{'6': ('rim', 1), '7': ('rim', 2), '8': ('rim', 3)})

# A1 촘촘한 말뚝(폭 3 · 틈 1) — 끝을 깎은 면(밝은 생나무 f·e)이 위로 보이고 몸통은 껍질(d·c·a). 밧줄 두 줄이 말뚝마다 감긴다.
# 말뚝 끝 높이: 5 · 3 · 6 · 4행. 서끝 = 굵은 모서리 기둥(밧줄 매듭 + 늘어진 끝), 동끝 = 같은 기둥 거울.
PAL1_MID = [
    '................',
    '................',
    '................',
    '.....f..........',
    '....fed......f..',
    '.f..edb.....fed.',
    'fed.dca..f..edb.',
    'edb.dca.fed.dca.',
    'dca.dca.edb.dca.',
    'dca.dba.dca.dca.',
    'dba.dca.dca.dba.',
    'DECDDECDDECDDECD',
    'CBAzCBAzCBAzCBAz',
    'dca.dca.dba.dca.',
    'dca.dca.dca.dca.',
    'dca.dba.dca.dca.',
    'dba.dca.dca.dba.',
    'dca.dca.dca.dca.',
    'dca.dca.dba.dca.',
    'dca.dca.dca.dca.',
    'dca.dba.dca.dca.',
    'DECDDECDDECDDECD',
    'CBAzCBAzCBAzCBAz',
    'dca.dca.dca.dca.',
    'dba.dca.dca.dba.',
    'dca.dca.dba.dca.',
    'dca.dca.dca.dca.',
    'dca.dca.dca.dca.',
    'cba.cba.cba.cba.',
    'cba7cba7cba7cba7',
    '7876787678767876',
    'z6zzz6zzz6zzz6zz',
]
PAL1_WEST = [
    '................',
    '...f............',
    '..fed...........',
    '.fedcb..........',
    '.edcba..........',
    '.ddcba..........',
    '.ddcba......fed.',
    '.edcba..fed.edb.',
    '.ddcba..edb.dca.',
    '.ddcba..dca.dca.',
    '.dDECb..dca.dba.',
    'DEDECDDCDECDDECD',
    'CDCBAAzzCBAzCBAz',
    'BAddca..dba.dca.',
    'A.dcba..dca.dca.',
    'B.ddca..dca.dba.',
    '..ddca..dca.dca.',
    '..edca..dba.dca.',
    '..ddba..dca.dca.',
    '..ddca..dca.dca.',
    '..dDECb.dca.dca.',
    '.DEDECDDDECDDECD',
    '.CBCBAAzCBAzCBAz',
    '.Bddca..dca.dca.',
    '.Adcba..dca.dba.',
    '..ddca..dba.dca.',
    '..ddca..dca.dca.',
    '..ddca..dca.dca.',
    '..ccba..cba.cba.',
    '.7ccba77cba7cba7',
    '.787678767876787',
    '..zz6zzzz6zzz6zz',
]
PAL1_EAST = [
    '................',
    '..............f.',
    '.............fed',
    '...f........fedc',
    '..fed.......edca',
    '..edb.......ddca',
    '..dca.f.....ddca',
    '..dca.fe....edca',
    '..dba.edb...ddca',
    '..dca.dca...ddca',
    '..dca.dca...dDEz',
    'DECDDECDDECDDEDz',
    'CBAzCBAzCBAzCBAz',
    '..dca.dca...dcaz',
    '..dca.dca...dcbz',
    '..dba.dca...ddcz',
    '..dca.dba...ddca',
    '..dca.dca...edca',
    '..dca.dca...ddba',
    '..dca.dca...ddca',
    '..dba.dca..dDECa',
    'DECDDECDDECDDEDz',
    'CBAzCBAzCBAzCBAz',
    '..dca.dca...dcaz',
    '..dca.dba...dcbz',
    '..dca.dca...ddca',
    '..dca.dca...ddca',
    '..dca.dca...ddca',
    '..cba.cba...ccba',
    '7.cba7cba777ccba',
    '787678767876787z',
    'z6zzz6zzz6zzzz6.',
]

# A2 큰 말뚝(폭 4, 8px 간격, 끝 높이 1 · 3행) 사이를 가는 나뭇가지로 엮은 바자 울타리(13~29행, 위는 밝은 테 가지 한 줄).
# 가지는 말뚝 앞·뒤를 번갈아 지나간다(가지 i 가 왼 말뚝 앞이면 오른 말뚝 뒤). 끝 조각 기둥 꼭대기에 해골을 꿴다.
PAL2_MID = [
    '................',
    '..E.............',
    '.EDc............',
    '.EDcb.....E.....',
    '.fdcb....EDc....',
    '.ddba....EDcb...',
    '.edca....fdcb...',
    '.edca....edca...',
    '.edca....edca...',
    '.edca....ddba...',
    '.edca....edca...',
    '.edca....edca...',
    '.edca....edca...',
    'EfEfEfEfEfEfEfEd',
    'eeeeededdedcaddc',
    'accccaaaaedcaaaa',
    'dedcaeddeeeeedec',
    'aedcaaaaaccccaaa',
    'deeeeddedddbaedc',
    'accccaaaaedcaaaa',
    'eedcadeddeeeeddc',
    'aedcaaaaaccccaaa',
    'deeeeeddeedcadec',
    'accccaaaaedcaaaa',
    'dedcaddedeeeeedc',
    'aedcaaaaaccccaaa',
    'eeeeededdedcaddc',
    'accccaaaaddaaaaa',
    'dedcaeddeeeeedec',
    'aedcaaaaaccccaaa',
    '8777877787778776',
    'zzzzzzzzzzzzzzzz',
]
PAL2_WEST = [
    '..E.............',
    '.EDc............',
    '.EDcb...........',
    '.fdcb.....E.....',
    '.edca....EDc....',
    '.ddba....EDcb...',
    '.edca....fdcb...',
    '.edca....edca...',
    '.edca....edca...',
    '.edca....ddba...',
    '.edca....edca...',
    '.edca....edca...',
    '.edca....edca...',
    '.edcafEfEfEfEfEd',
    '.ddbadeddedcaddc',
    '.edcaaaaaedcaaaa',
    '.edcaeddeeeeedec',
    '.edcaaaaaccccaaa',
    '.edcaddedddbaedc',
    '.edcaaaaaedcaaaa',
    '.edcadeddeeeeddc',
    '.edcaaaaaccccaaa',
    '.edcaeddeedcadec',
    '.ddaaaaaaedcaaaa',
    '.edcaddedeeeeedc',
    '.edcaaaaaccccaaa',
    '.edcadeddedcaddc',
    '.edcaaaaaddaaaaa',
    '.edcaeddeeeeedec',
    '.edcaaaaaccccaaa',
    '.777877787778776',
    '.zzzzzzzzzzzzzzz',
]
PAL2_EAST = [
    '..........E.....',
    '..E......EDc....',
    '.EDc.....EDcb...',
    '.EDcb....fdcb...',
    '.fdcb....edca...',
    '.ddba....edca...',
    '.edca....edca...',
    '.edca....edca...',
    '.edca....edca...',
    '.edca....ddba...',
    '.edca....edca...',
    '.edca....edca...',
    '.edca....edca...',
    'EfEfEfEfEedca...',
    'eeeeededdedca...',
    'accccaaaaedca...',
    'dedcaeddeedca...',
    'aedcaaaaaedca...',
    'deeeeddedddba...',
    'accccaaaaedca...',
    'eedcadeddedca...',
    'aedcaaaaaedca...',
    'deeeeeddeedca...',
    'accccaaaaedca...',
    'dedcaddededca...',
    'aedcaaaaaedca...',
    'eeeeededdedca...',
    'accccaaaaddaa...',
    'dedcaeddeedca...',
    'aedcaaaaaedca...',
    '8777877787778...',
    'zzzzzzzzzzzzz...',
]
PAL_SKULL = [   # 기둥 끝에 꿴 해골(말뚝 끝이 정수리로 뚫고 나옴)
    '..E...',
    '.vwwt.',
    'vwwwvs',
    'wzwwzs',
    'wzvvzs',
    'vwwzts',
    '.tsts.',
]


def palisade(rows, skull_x=None):
    cv = g(rows, PAL_LEG)
    if skull_x is not None:
        stamp(cv, PAL_SKULL, PAL_LEG, skull_x, 0)
    return cv



# ================================================================================================ 고블린 가죽 천막 (3×3)
TENT_LEG = leg(X=('cfloor', 0), A=('cfloor', 1), B=('cfloor', 2), C=('cfloor', 4), D=('cfloor', 6), E=('cfloor', 7),
               **{'6': ('rim', 1), '7': ('rim', 2), '8': ('rim', 3), '9': ('rim', 4), '+': ('rim', 5)})
# A1 용마루 천막: 막대 셋(앞 둘이 앞 꼭짓점 위에서 X 로 엇갈리고, 뒤 하나가 뒤 꼭짓점 위로 솟음) 위에 가죽을 덮었다.
# 3/4 — 용마루(24열, 4~18행)를 사이에 두고 왼 지붕면(빛, 밝은 무두 가죽 D·E)과 오른 지붕면(그늘, X·6)이 위에서 보이고,
# 그 밑 남쪽 박공(갈색 가죽 d·e, 세로 이음 b)이 앞면이다. 박공 가운데 어두운 입구 + 왼쪽으로 묶어 젖힌 문 자락.
# 기운 자국: 왼 지붕면 갈색 가죽 조각·줄무늬 가죽 조각, 박공 점박이 가죽, 오른 지붕면 밝은 가죽 조각(꿰맨 땀 = 흰 점 w·v).
# 뼈 장식: 엇갈린 막대에 묶은 뿔 둘 · 그 밑에 매단 해골 · 박공 두 변의 이빨 줄. 붉은 발톱 칠. 밑단은 너덜너덜(뜯긴 자락).
TENT1 = [
    '........................e.......................',
    '........................d.......................',
    '........................d.......................',
    '........................d.......................',
    '........................b.......................',
    '.......................Ewz......................',
    '......................EEBzz.....................',
    '......................EEwzz.....................',
    '.....................EDEBzXz....................',
    '....................EDDEwzXXz...................',
    '....................EDDEBzXXz...................',
    '...................EXCCEwz66Xz..................',
    '.................deCXCXEBzXXXXcb................',
    '.................EdeCXCEwzXXXcbz................',
    '................EDwdeCwEBzXXcbXXz...............',
    '................ECCDdeDEwzXcbBA6z...............',
    '...............EDDDCCvwvBzvwvvwXXz..............',
    '..............EDDDDDDCwewcv6XXXXXXz.............',
    '..............EDDDDDDDDcbcXXXXXXXXz.............',
    '.............ECDDDDDDDBvwvAXXXXXXX6z............',
    '............EDwCCDDDDvwwwvAXXXXX66XXz...........',
    '...........EwbDcDCCDDwzwzvfAXX66XXXXXz..........',
    '..........EwcbcbcDDCBvwwwvdfA6XXXXXXXXz.........',
    '..........EwbcdcbDDwBftvtddbAvXXXXXXXXz.........',
    '.........EwcbccbcDDBfdeecdddfAXXXXXX66Xz........',
    '........EDwbcbcbcDBfdeeedcdddfAXXX66XXXXz.......',
    '........EDDwvwvwCwBfeeeeddcddbAv6CCCXXXXz.......',
    '.......EDDDDDDDDDBfeeeed;ddcddfAXCDCCXXXXz......',
    '......ECCDDDDDDDBfbeeede;dddcdbfACCCBXXX66z.....',
    '......EDDCCDDDDwBfbeedee;ddddcbbAvwvwX66XXz.....',
    '......EDDDDCCDDBfebedee;;;ddddbdfAXX66XXXX......',
    '......EDDDDCDCCBfebdeDX;;;cdddbcbA66XXXXXXz.....',
    '.....EEDDDCzDwBfeebeeDX;;;dcddbdcfAvXXXXXXz.....',
    '......EDDDDCzDfeedbeDX;;;;;dcdUddcfAXXXXXXzX....',
    '......ECCzDCDzfedebeDX;;;;;ddcUdUdbAXXXX66z.....',
    '.....BEDDwvwvwedeebDDX:::::dddbUdUdfAv66XXzA....',
    '....B..DDDDBfbdeeeDDX:::::::ddbUdUdbfAXXXXz.A...',
    '...B...EDDDBfbeecbbcX:::::::ddbdcddbbAXXXz...A..',
    '..B...EEDDBfdbeeebDDX:::::::cdbddcdbdfAXXz....A.',
    '.B.....EDBfdebeeDDDX:::::::::cbdddcbddfAXzX....A',
    'dc.....ECBfeebedDDDX:::::::::dbddddbddbA6z....cb',
    'ba....EEBfeeebdeDDDX,,,,,,,,,dbcdddbcddfAz....ba',
    '.......EfeeeebeDDDX,,,::,,,,,,bdcddbdcddfz......',
    '.......EfeeedbDDDDXXBC,,,,,CB,bddcdbddcdbz......',
    '.......fee.deDD.DXzXABA,,,ABAX,dd.cbd.dcdf......',
    '.......~~6~~66~~~6~~~~~~~~~~z~~z~~~z~~z~~~~~~...',
    '.......~~~~~~6~~~~~~~~~~~~~~~~~~~~~X~~~~~~~~~...',
    '............~~~~~~~~~~~~~~~~~~~~~~~~~~~~~.......',
]
# A2 원뿔 천막: 위에서 묶은 막대 셋이 꼭대기 위로 벌어져 솟고(연기 구멍), 가죽 폭을 꼭짓점에서 퍼지는 이음으로 꿰매 둘렀다.
# 3/4 — 원뿔 옆면 전체가 위에서 비스듬히 보인다(왼쪽 빛 9·+, 오른쪽 그늘 6·z), 밑단은 앞으로 휜 곡선.
# 앞 가운데 둥근 입구 + 오른쪽으로 젖힌 자락, 허리에 이빨 띠(가죽끈 b + 이빨 w·v), 꼭대기 묶음 밑 뿔 달린 머리뼈,
# 줄무늬 가죽·검은 가죽·밝은 가죽 조각을 기웠다. 밑단 뜯김.
TENT2 = [
    '..................f.....f......d................',
    '...................e....e.....t.................',
    '...................v....e....cv.................',
    '...................we...e....c..................',
    '.....................e..e...c...................',
    '.....................e..e..c....................',
    '......................e.e.c.....................',
    '.......................ee.c.....................',
    '.......................eec......................',
    '.......................;c.......................',
    '.......................:;z......................',
    '......................bcdcb.....................',
    '....................w.+876z.w...................',
    '....................vw+76zzwv...................',
    '.....................vwvwwvwv...................',
    '....................+vwvwwttz...................',
    '....................+8vwzzwvz...................',
    '..................DD897vwwvzzz..................',
    '.................DEDv8vtvvt6tz..................',
    '.................DDC8878676zzbcb................',
    '.................vw89877766z6cbcb...............',
    '.................+9v88v7766t6ztcb...............',
    '................+98987877666zwvwz...............',
    '................+98987877676z6zzz...............',
    '..........wb...+9v988v877676t6ztzz..bw..........',
    '..........v.bwbbwb9887877676z6bwbbwb.v..........',
    '.............v+9v9bwbbwbbwbbwb6vzzv.............',
    '.............+99v98vv8v77v76vt6zztzz............',
    '............+v998988788776766z6zzzzvz...........',
    '............+w9899887887767766z6zzzwz...........',
    '.........CBC999v9888v88;;;7766t6zz6zzz..........',
    '........BCzCB989988878;;;;;9z6z666;;zz..........',
    '........CzCBC98998878;;;;;;9z6z667;;;zz.........',
    '........BCBzCv99888v8;;;;;;;9z6t6z7zzzzz........',
    '.........wvw98998887;;;;;;;;99zz66zzzzzz........',
    '........+99998998887::::::::99zz66zzzzzzz.......',
    '........+999v998888v:::::::::99t66zzztzzz.......',
    '.......+999989988878:::::::::bcbz66zzzzzzz......',
    '......+999989998887::::::::::999z66zzzzzzzz.....',
    '......+9999v998888v::::::::::999t666zzztzzz.....',
    '.....+9999899988887,,,,,,,,,,9999z66zzzzzzzz....',
    '....~~~999899988887,,,,,,,,,,9999z66zzzzzz~~~~..',
    '....~~~77~.99888878,,ABA,,,,,9999z666z.66~~~~~..',
    '....~~~~~~~7788.878,BCBA,,,,,9999.z66~~~~~~~~~..',
    '.......~~~~6~~7~~788877777677766~~76~~~~~~......',
    '..........~~~~6~~~~7~~~7~~~6~~~~~~6z~~~.........',
    '.............~~~~~~6~~~~~~~z~~~~~~~~............',
    '..................~~~~~~~~~~~~~.................',
]


def tent(rows):
    return g(rows, TENT_LEG)


# ================================================================================================ 장면
room, put_actor, strip3, common_scene, actor = PR.room, PR.put_actor, PR.strip3, PR.common_scene, PR.actor
LINES = PR.LINES

CAMP = [   # 12×9 고블린 야영 굴: 천장 1 · 앞면 2 · 바닥 6
    '############',
    '############',
    '############',
    '#..........#',
    '#..........#',
    '#..........#',
    '#..........#',
    '#..........#',
    '#..........#',
]


class Set:
    """같은 번호(1·2)의 고블린 야영 소품 한 벌."""

    def __init__(s, n):
        s.n = n

    def tent(s):
        return tent(TENT1 if s.n == 1 else TENT2)

    def fire(s, k):
        return (campfire(CF1_BACK, CF1_FLAMES, CF1_FRONT, CF1_EMBERS, k) if s.n == 1
                else campfire(CF2_BACK, CF2_FLAMES, CF2_FRONT, CF2_EMBERS, k))

    def bones(s):
        return bones1() if s.n == 1 else bones2()

    def loot(s):
        return g(LOOT1 if s.n == 1 else LOOT2, LOOT_LEG)

    def pal(s):
        if s.n == 1:
            return g(PAL1_WEST, PAL_LEG), g(PAL1_MID, PAL_LEG), g(PAL1_EAST, PAL_LEG)
        return palisade(PAL2_WEST, 0), palisade(PAL2_MID), palisade(PAL2_EAST, 8)


def camp_room(line, st, k):
    cv = room(CAMP, line)
    P = cv.paste
    w, m, e = st.pal()
    P(st.tent(), 1 * T, 3 * T - 10)
    P(st.tent(), 8 * T, 3 * T - 10)
    P(st.bones(), 4 * T, 3 * T + 2)
    P(st.loot(), 7 * T, 5 * T + 2)
    P(st.loot(), 1 * T + 6, 6 * T - 4)
    P(st.bones(), 10 * T + 4, 6 * T - 2)
    P(st.fire(k), 5 * T + 8, 5 * T)
    for x, piece in ((1, w), (2, m), (3, m), (4, m), (5, e), (7, w), (8, m), (9, m), (10, e)):
        P(piece, x * T, 7 * T)
    put_actor(cv, 6, 7)
    return cv


def camp_scene(n, k):
    st = Set(n)
    return strip3(lambda ln: camp_room(ln, st, k))


# ================================================================================================ 후보
def door_cand(rows, mask, inside):
    def fn():
        a, b = door(rows, mask, inside, False), door(rows, mask, inside, True)

        def place(cv):
            cv.paste(a, 2 * T, 1 * T)
            cv.paste(b, 5 * T, 1 * T)
        v = common_scene(place, actor_at=(5, 4))
        return hcat(a, b), {'kind': 'objects', 'parts': {'닫힘': a, '열림': b}, 'vignette': v}
    return fn


def lever_cand(make):
    def fn():
        a, b = make(True), make(False)
        v = common_scene(lambda cv: (cv.paste(a, 2 * T, 2 * T), cv.paste(b, 5 * T, 2 * T)), actor_at=(4, 4))
        meta = {'kind': 'objects', 'parts': {'올림': a, '내림': b}, 'vignette': v}
        if make is lever2:
            meta['top_rows'] = {'올림': [9, 11], '내림': [9, 11]}
        return hcat(a, b), meta
    return fn


def bone_cand(n):
    def fn():
        st = Set(n)
        a, b = st.bones(), st.loot()

        def place(cv):
            cv.paste(a, 2 * T, 4 * T)
            cv.paste(a, 1 * T, 3 * T)
            cv.paste(b, 5 * T, 3 * T)
            cv.paste(b, 6 * T, 4 * T)
        v = common_scene(place, actor_at=(4, 5))
        return hcat(a, b), {'kind': 'objects', 'parts': {'뼈': a, '약탈품': b}, 'vignette': v}
    return fn


def pal_cand(n):
    def fn():
        w, m, e = Set(n).pal()

        def place(cv):
            for x, p in ((1, w), (2, m), (3, m), (4, m), (5, e)):
                cv.paste(p, x * T, 3 * T)
        v = common_scene(place, actor_at=(6, 5))
        return hcat(w, m, e), {'kind': 'objects', 'parts': {'서끝': w, '가운데': m, '동끝': e}, 'vignette': v}
    return fn


def fire_cand(n):
    def fn():
        st = Set(n)
        fs = [st.fire(k) for k in range(4)]
        anim = [common_scene(lambda cv, f=f: cv.paste(f, 3 * T, 4 * T), actor_at=(5, 4)) for f in fs]
        return hcat(*fs), {'kind': 'objects', 'parts': {f'장면{i + 1}': f for i, f in enumerate(fs)},
                           'vignette': anim[0], 'anim': anim}
    return fn


def tent_cand(n):
    def fn():
        t = Set(n).tent()
        anim = [camp_scene(n, k) for k in range(4)]
        return t, {'kind': 'object', 'parts': {'천막': t}, 'vignette': anim[0], 'anim': anim}
    return fn


NOTES_BY_ITEM = {
    'gap.door': {
        'A1': '둥근 아치 — 밝은 회색 쐐기돌 아치 + 문설주 + 2단 문턱, 세로 널 넷 문짝 + 쇠띠 둘 + 쇠고리. 열림: 문짝이 왼쪽 안으로 젖혀지고 안은 짙은 어둠 + 사라지는 바닥. 통로 12px·높이 27px',
        'A2': '뾰족 아치 + 처마돌(윗면 2줄) 네모 틀, 받침돌. 넓은 널 셋 + 긴 경첩 띠 셋 + 징 + 고리 문고리. 열림: 문짝이 오른쪽 안으로 젖혀지고 안에 내려가는 돌계단',
    },
    'gap.lever': {
        'A1': '쇠 벽판(리벳 넷·굴대 머리) + 굵은 나무 자루(3px). 올림 = 왼쪽 위 + 붉은 손잡이 · 내림 = 오른쪽 아래 + 청록으로 빛나는 손잡이',
        'A2': '벽에 붙은 돌 받침 덩이(윗면 3줄) + 쇠 반달 톱니 틀 + 쇠 막대. 올림 = 곧게 선 막대 + 붉은 공 · 내림 = 오른쪽으로 90° 누운 막대 + 청록 공',
    },
    'gap.goblin_tent': {
        'A1': '용마루 천막(막대 셋: 앞 X + 뒤 하나). 왼 지붕면 빛·오른 지붕면 그늘이 위에서 보이고 남쪽 박공이 앞면. 기운 가죽 조각 넷·꿰맨 땀·뿔·매단 해골·이빨 줄·붉은 발톱 칠·뜯긴 밑단. 장면 = 같은 번호 소품으로 꾸민 고블린 야영 굴(세 줄)',
        'A2': '원뿔 천막(막대 셋이 꼭대기 위로 벌어짐, 연기 구멍). 꼭짓점에서 퍼지는 가죽 폭 이음, 허리 이빨 띠, 꼭대기 뿔 머리뼈, 기운 조각 셋, 오른쪽으로 젖힌 입구 자락. 장면 = 같은 번호 소품의 야영 굴',
    },
    'gap.bone_pile': {
        'A1': '뼈: 엇갈린 긴 뼈 + 갈비 + 갉힌 해골 · 약탈품: 묶은 삼베 자루 + 작은 통 + 땅에 꽂힌 녹슨 칼 + 금화',
        'A2': '뼈: 뿔 달린 짐승 머리뼈를 얹은 더미 · 약탈품: 옆으로 쓰러져 금화를 쏟은 통 + 주저앉은 자루 + 누운 녹슨 칼',
    },
    'gap.palisade': {
        'A1': '촘촘한 말뚝(폭 3·틈 1, 끝 높이 넷) — 깎은 끝의 생나무 면이 위로, 밧줄 두 줄. 끝 조각 = 굵은 모서리 기둥 + 매듭',
        'A2': '큰 말뚝(8px 간격) 사이를 가지로 엮은 바자 울타리(가지가 말뚝 앞뒤를 번갈아). 끝 기둥 꼭대기에 꿴 해골',
    },
    'gap.campfire': {
        'A1': '둥근 돌 고리 + 엇갈린 장작 + 양쪽 Y 받침의 가로 꼬챙이에 구운 고깃덩이. 장면 넷 = 불꽃·불씨만',
        'A2': '큰 바위 말굽(앞이 트여 재가 보임, 바위 위 해골) + 세운 장작 + 땅에 비스듬히 꽂은 꼬챙이 끝의 뼈 달린 다리 고기. 장면 넷 = 불꽃·불씨만',
    },
}

_FNS = {
    'gap.door': {'A1': door_cand(DOOR1_SHUT, DOOR1_MASK, DOOR1_INSIDE), 'A2': door_cand(DOOR2_SHUT, DOOR2_MASK, DOOR2_INSIDE)},
    'gap.lever': {'A1': lever_cand(lever1), 'A2': lever_cand(lever2)},
    'gap.goblin_tent': {'A1': tent_cand(1), 'A2': tent_cand(2)},
    'gap.bone_pile': {'A1': bone_cand(1), 'A2': bone_cand(2)},
    'gap.palisade': {'A1': pal_cand(1), 'A2': pal_cand(2)},
    'gap.campfire': {'A1': fire_cand(1), 'A2': fire_cand(2)},
}


def _noted(fn, note):
    def g_():
        cv, meta = fn()
        meta['note'] = '줄 공통 — ' + note
        return cv, meta
    return g_


CANDIDATES = {item: {k: _noted(fn, NOTES_BY_ITEM[item][k]) for k, fn in c.items()} for item, c in _FNS.items()}
