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
# 문은 그린 돌 틀 없이 벽 자체가 틀이 된다: 나무 상인방 + 안으로 들어간 어두운 문설 안쪽(위·왼쪽이 더 어두움) + 문짝만 그리고,
# 구멍 밖 화소는 모두 투명이라 어느 굴 벽 앞면 위에 놓여도 그 벽이 둘레에 보인다.
# A1 각진 나무 상인방(윗면 밝음 · 앞면 · 어두운 밑면) + 세로 널 문짝 + 쇠띠 둘 + 쇠고리. 열림 = 문짝이 오른쪽 안으로 젖혀져 원근으로 좁아진 옆면.
# A2 껍질 붙은 통나무 상인방(잘린 끝이 양옆으로 나옴) + 끝이 뾰족한 널 문짝. 열림 = 문짝이 왼쪽 안으로 젖혀져 원근으로 좁아진 옆면.
DOOR1_SHUT = [
    '................',
    '................',
    '................',
    '.fffefffffeffff.',
    '.eedeeeedeeeede.',
    '.cdcbcdcbcdcbcb.',
    '.aaaaaaaaaaaaaa.',
    '.aaaaaaaaaaaaaa.',
    '.edcbedbedcbedb.',
    '.edcbedbeccbedb.',
    '.eccbedbedcbedb.',
    '.eccbedbedcbecb.',
    '.lkklkkkkkklkkh.',
    '.hghhhhghhhhghg.',
    '.edcbecbedcbedb.',
    '.edcbecbedcbeab.',
    '.eabbedbedcbedb.',
    '.edcbedbeccbedb.',
    '.edcbedbeccjhdb.',
    '.edcbedbedchgdb.',
    '.eccbedbedcbecb.',
    '.eccbedbedcbecb.',
    '.eccbedbedcbedb.',
    '.edcbedbeabbedb.',
    '.lkklkkkkkklkkh.',
    '.hghhhhghhhhghg.',
    '.edcbedbedcbedb.',
    '.edcbedbeccbedb.',
    '.edcbecbeccbedb.',
    '.edcbedbedcbedb.',
    '.edcbedbedcbecb.',
    '.babbabbaabbabb.',
]
DOOR2_SHUT = [
    '................',
    '................',
    '................',
    '..cdeddeeddedc..',
    '.EdcdcddcdcdcdD.',
    '.Dcbcbbcbcbbcbc.',
    '..aababaababaa..',
    '.aaaaaaaaaaaaaa.',
    '.00000dbed00000.',
    '.000bedbeccb000.',
    '.0ccbedbedcbed0.',
    '.eccbedbedcbecb.',
    '.edcbedbedcbedb.',
    '.lkklkkkkkklkkh.',
    '.hghhhhghhhhghg.',
    '.edcbecbedcbeab.',
    '.eabbedbedcbedb.',
    '.edcbedbeccbedb.',
    '.edcbedbeccbedb.',
    '.edcbedbedcjhdb.',
    '.eccbedbedchgcb.',
    '.eccbedbedcbecb.',
    '.eccbedbedcbedb.',
    '.edcbedbeabbedb.',
    '.edcbedbedcbedb.',
    '.lkklkkkkkklkkh.',
    '.hghhhhghhhhghg.',
    '.edcbedbeccbedb.',
    '.edcbecbeccbedb.',
    '.edcbedbedcbedb.',
    '.edcbedbedcbecb.',
    '.babbabbaabbabb.',
]
DOOR1_MASK = [
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
]
DOOR1_INSIDE = [
    '................',
    '................',
    '................',
    '.fffefffffeffff.',
    '.eedeeeedeeeede.',
    '.cdcbcdcbcdcbcb.',
    '.aaaaaaaaaaaaaa.',
    '.aaaaaaaaaaaaaa.',
    '.X:;;;;;;:;;fdb.',
    '.A;;:;;;;;;:fdb.',
    '.A;;;;:;;;;;fdb.',
    '.A;;;;;;:;;;fdb.',
    '.X;:;;;;;;:;lkh.',
    '.A;:;:;:;:;:fdb.',
    '.A:::::,::::fdb.',
    '.A,::::::,::fdb.',
    '.X::,::::::,fdb.',
    '.A::::,:::::fdb.',
    '.A::::::,:::fdb.',
    '.A:,:,:,:,,,fdb.',
    '.X,,,,,,,,,,fdb.',
    '.A,,,,,,,,,,fdb.',
    '.A,,,,,,,,,,fdb.',
    '.A,,,,,,,,,,fdb.',
    '.,X,X,X,X,X,lkh.',
    '.AXAAXAAXAAXfdb.',
    '.AAAAAAAAAAAfdb.',
    '.BBABBABBABBfdb.',
    '.CCCCCCCCCCCfdb.',
    '.CDDCDDCDDCDfdb.',
    '.EEEEEEEEEEEfdb.',
    '.bbbbbbbbbbbcba.',
]
DOOR2_MASK = [
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
]
DOOR2_INSIDE = [
    '................',
    '................',
    '................',
    '..cdeddeeddedc..',
    '.EdcdcddcdcdcdD.',
    '.Dcbcbbcbcbbcbc.',
    '..aababaababaa..',
    '.aaaaaaaaaaaaaa.',
    '.00f00;;;:00000.',
    '.0df:;;;;;;:000.',
    '.bdf;;:;;;;;;:0.',
    '.bdf;;;;:;;;;;X.',
    '.bdf;;;;;;:;;;a.',
    '.hkl;:;:;:;:::X.',
    '.bdf:::,::::::X.',
    '.bdf:::::,::::a.',
    '.bdf,::::::,::X.',
    '.bdf::,::::::,X.',
    '.bdf::::,:::::a.',
    '.bdf:,:,:,,,:,X.',
    '.bdf,,,,,,,,,,X.',
    '.bdf,,,,,,,,,,a.',
    '.bdf,,,,,,,,,,X.',
    '.bdf,,,,,,,,,,X.',
    '.bdfX,X,X,X,X,a.',
    '.hklAXAAXAAXAAX.',
    '.bdfAAAAAAAAAAX.',
    '.bdfBBABBABBABa.',
    '.bdfCCCCCCCCCCX.',
    '.bdfCDDCDDCDDCX.',
    '.bdfEEEEEEEEEEa.',
    '.abcbbbbbbbbbbb.',
]

# 숫자는 굴 바위(crock 1~5) — 문설 안쪽 입술과 열린 안의 바닥에만 쓴다.
DOOR_LEG = leg(**{'0': ('rim', 1)}, X=('cfloor', 0), A=('cfloor', 1), B=('cfloor', 2), C=('cfloor', 4), D=('cfloor', 6), E=('cfloor', 7))


def door(rows, mask, inside, opened):
    return g(fill_region(rows, mask, inside) if opened else rows, DOOR_LEG)


# ================================================================================================ 레버 (1×1 둘: 올림 | 내림)
# 둘 다 칸을 거의 다 쓰는 벽 붙박이(벽 앞면 돌·쇠 빛깔, 왼쪽 위 빗면 밝음, 오른쪽·아래 어두움) + 가운데 굴대 + 3px 자루 + 3×3 손잡이.
# A1 리벳 넷 박은 쇠 판(10×13) + 굴대 위·아래 짧은 홈. 올림 = 자루가 굴대 위로 곧게, 놋쇠 손잡이가 판 꼭대기 · 내림 = 아래로 곧게, 판 밑.
# A2 모서리 둥근 돌 덩이(12×13)에 대각선 홈을 새김. 올림 = 자루가 홈을 따라 왼쪽 위, 뼈빛 손잡이가 왼쪽 위 모서리 · 내림 = 오른쪽 아래 모서리.
LEVER1_UP_ROWS = [
    '.......qm.......',
    '...lllqrqpllg...',
    '...lkkfpobkkg...',
    '...kliffdbjlg...',
    '...khjffdbjhg...',
    '...kjjffdbjig...',
    '...kjiffdbjjg...',
    '...kjjflkbjig...',
    '...kjjjkhjjig...',
    '...kjijjjijjg...',
    '...kjjjggjjig...',
    '...kljjijjjlg...',
    '...khijjjijhg...',
    '...gggggggggg...',
    '................',
    '................',
]
LEVER1_DOWN_ROWS = [
    '................',
    '...lllllllllg...',
    '...lkkkkkkkkg...',
    '...klijjjijlg...',
    '...khjjijjjhg...',
    '...kjjjijjjig...',
    '...kjijggijjg...',
    '...kjjflkbjig...',
    '...kjjfkhbjig...',
    '...kjiffdbjjg...',
    '...kjjffdbjig...',
    '...kljffdbjlg...',
    '...khifqrbjhg...',
    '...gggmrqmggg...',
    '.......mm.......',
    '................',
]
LEVER2_UP_ROWS = [
    'WVS.............',
    'VUS.............',
    'SSS.............',
    '..eb............',
    '...ed33321......',
    '...4ed22320.....',
    '...32ed1210.....',
    '...312lkh10.....',
    '...211kjg10.....',
    '...311hgg10.....',
    '...21211210.....',
    '...21111110.....',
    '....000000......',
    '................',
    '................',
    '................',
]
LEVER2_DOWN_ROWS = [
    '................',
    '................',
    '................',
    '................',
    '....433321......',
    '...43322320.....',
    '...32121210.....',
    '...312lkh10.....',
    '...211kjg10.....',
    '...311hggdb.....',
    '...212112edb....',
    '...2111111edb...',
    '....000000.eWVS.',
    '............VUS.',
    '............SSS.',
    '................',
]


LEVER1_LEG = leg(m=('gold', 0), n=('gold', 1), o=('gold', 2), p=('gold', 3), q=('gold', 4), r=('gold', 5))


LEVER2_LEG = leg()   # 숫자 = 벽과 같은 서늘한 돌 램프


def lever1(up):
    return g(LEVER1_UP_ROWS if up else LEVER1_DOWN_ROWS, LEVER1_LEG)


def lever2(up):
    return g(LEVER2_UP_ROWS if up else LEVER2_DOWN_ROWS, LEVER2_LEG)


# ================================================================================================ 뼈 더미 · 약탈품 더미 (1×1 둘)
LOOT_LEG = leg(m=('gold', 0), n=('gold', 1), o=('gold', 2), p=('gold', 3), q=('gold', 4), r=('gold', 5),
               X=('cfloor', 0), A=('cfloor', 1), B=('cfloor', 2), C=('cfloor', 4), D=('cfloor', 6), E=('cfloor', 7),
               **{'6': ('rim', 1), '7': ('rim', 2), '8': ('rim', 3), '9': ('rim', 4)})

# 더미 둘 다 3/4 무더기: 어두운 흙·때 둔덕(rim 0~3, 그늘 쪽 가장 어두운 단) 위에 뼈·물건이 엉켜 얹혀 있다 — 둔덕 윗면은 밝은 rim 3, 밑단은 rim 0.
# 뼈는 빛 쪽 bone 4·3 → 그늘 쪽 bone 1·0 → 둔덕 그늘로 내려간다. 접지 그림자(~)를 함께 둔다.
# A1 뼈: 낮고 넓은 뼈 더미 — 굵은 긴 뼈 넷이 X 로 엇갈려 쌓이고, 왼쪽에 사람 해골(밝은 정수리 · 짙은 눈구멍)이 더미에 반쯤 묻혀 얹힘.
# 밑·오른쪽 중간 어둠 접지 그늘 + 반투명 바닥 그림자.
BONES1 = [
    '.......vwwS.....',
    '......vwwwwS....',
    '.g....waawaS....',
    '.lg...vaavasvS..',
    '..kg..avsvtswwa.',
    '..kg...tstswwa..',
    '..vdbttaavwuS...',
    '..wwwwwvvwutqS..',
    '..tuuvwvwututS..',
    '.twvtwwwvtvwaaS.',
    '.waastuwwwvwwwwS',
    'tvawtwstuwwwvuwS',
    'atavavtastuwwwwa',
    '.aroatusaavrqua.',
    '..aaaaaaaaaaaa..',
    '..~~~~~~~~~~~~~.',
]
# A1 약탈품: 띠 없는 수수한 삼베 자루(묶은 목 · 왼쪽 밝음) + 오른쪽 바닥에 따로 쏟아진 금화(밝은 점) + 앞을 가로질러 눕힌 짧은 칼(어두운 손잡이 · 놋쇠 코등이 · 위 날 밝음).
LOOT1 = [
    '...fa.a.........',
    '..adfdca........',
    '...atua......a..',
    '....ea......la..',
    '..dffeca...la...',
    '.dfffeeda..ka...',
    'dffefedcba.ka...',
    'efeffeddcbka....',
    'efefeedcbka.....',
    'eeeededcbmda....',
    'deddedcbaqrda...',
    'adcdcbbaqrqpna..',
    '.abaqrpqrqpqoma.',
    '..aapqroqpqoaa~.',
    '...~aaaaaaaa~~..',
    '....~~~~~~~~~...',
]
# A2 뼈: 받침 없이 흩어진 굵은 뼈 셋(3px 몸통 · 마디진 끝, 뼈 빛깔로만 명암) + 앞 왼쪽 바닥의 작은 해골. 밑·오른쪽은 중간 어둠 접지 그늘.
BONES2 = [
    '................',
    '..........va....',
    '.........wvwS.vS',
    '....vS...avvwwwa',
    '...wvwwS..ttvvvS',
    '...avvvwwwtatttS',
    '....tttvvvvwwwta',
    '....taattttvvva.',
    '..vwwvavaaatttS.',
    'vwwwwvwvwa.aatS.',
    'waawatavvwwwwavS',
    'vwwtwtattvvvvwwS',
    'tvtvtsatattttvva',
    'atstsa.S.aaaattS',
    '.aaaa........atS',
    '..............S.',
]
# A2 약탈품: 밝은 뚜껑 윗면(가로 널 · 위에 금화) → 짙은 앞 모서리 → 어두운 앞면(쇠 띠·자물쇠)의 궤짝 + 앞의 큰 금화 무더기 + 기댄 창.
LOOT2 = [
    '............g...',
    '............kg..',
    '..ffffffa..da...',
    '.ffffqrffa.da...',
    '.eedrqrpda.da...',
    '.ffffpofffda....',
    '.feeeeeeedda....',
    '.aaaaaaaaada....',
    '.dchbccha.rm....',
    '.dchkjchcqrrm...',
    '.dchbcchqrqrm.m.',
    '.aahabbrqprqqpm.',
    '...oqrqpqrqpqm.m',
    '~~~mnpqopqpom...',
    '.~~~mmmmmmmm....',
    '....~~~~~~~~~~..',
]


def bones1():
    return g(BONES1, LOOT_LEG)


def bones2():
    return g(BONES2, LOOT_LEG)




# ================================================================================================ 모닥불 (1×1 장면 넷)
# 겹 순서: 뒤(먼 돌·장작) → 불꽃(장면마다) → 앞(가까운 돌·꼬챙이 받침·꼬챙이·고기). 불꽃 밖 화소는 네 장면이 같다.
# A1 작은 둥근 돌(돌마다 밝은 윗면 · 앞면 · 어두운 밑)을 3/4 타원으로 두른 고리 안에 재 바닥 · 불 밑동에 둥근 끝이 보이는 큰 장작 더미(앞 겹).
# 받침대·꼬챙이 없음. 불꽃 높이는 네 장면이 같고 혀 모양과 기울기가 바뀐다(곧음 · 왼쪽 · 오른쪽 · 세 갈래), 불티 둘.
CF1_BACK = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '......5441......',
    '..454.3322.451..',
    '..321XABBAX320..',
    '454XABTSSTBAX451',
    '332ABBSTTSBBA320',
    '010XAABBBBAAX210',
    '.00XXXXXXXXXX00.',
    '................',
    '................',
]
CF1_FRONT = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '....fe....ef....',
    '...fedc..cdef...',
    '..fedcbaabcdef..',
    '....cbaaaabc....',
    '..4554....4554..',
    '..332255543221..',
    '..211033222110..',
    '..000000000000..',
]
CF1_FLAMES = [
    [
        '.......F........',
        '.......GF.......',
        '......GJG.F.....',
        '......GJGGG.....',
        '.....GJKJJG.....',
        '.....GJKKKJG....',
        '....GJKLLKJG....',
        '....GJKLLLKG....',
        '.....GJKLKJG....',
        '......HJJJH.....',
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
    ],
    [
        '.....F..........',
        '.....GF.........',
        '.....GJG........',
        '.....GJJG.F.....',
        '....GJKJG.G.....',
        '....GJKKJGJG....',
        '....GJKLKKJG....',
        '....GJKLLLKG....',
        '.....GJKLKJG....',
        '......HJJJH.....',
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
    ],
    [
        '.........F......',
        '........FG......',
        '........GJG.....',
        '.......GJJG.....',
        '......GJKJG.....',
        '.....GJKKJGG....',
        '....GJKLLKJG....',
        '....GJKLLLKG....',
        '.....GJKLKJG....',
        '......HJJJH.....',
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
    ],
    [
        '......F...F.....',
        '......G.F.G.....',
        '.....GJ.GJG.....',
        '.....GJGJKG.....',
        '.....GJKJKJG....',
        '....GJKKKKJG....',
        '....GJKLLKJG....',
        '....GJKLLLKG....',
        '.....GJKLKJG....',
        '......HJJJH.....',
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
    ],
]
CF1_EMBERS = [[(3, 2, 'J'), (13, 0, 'H')], [(12, 1, 'J'), (2, 0, 'H')], [(3, 0, 'H'), (13, 3, 'J')], [(13, 1, 'H'), (2, 3, 'J')]]

# A2 큰 바위(바위마다 윗면 · 앞면 · 밑)를 3/4 타원으로 두른 고리 안에 구부정한 장작 세모 + 큰 불. 장작 앞다리는 불 밑동 앞에 보인다.
# 오른쪽 바위 틈에 꽂은 짧은 꼬챙이 끝에 작은 뼈 달린 고기. 장면마다 불꽃 실루엣·높이·불티가 크게 바뀐다(높이 · 낮고 넓게 · 오른쪽으로 기욺).
CF2_BACK = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '......5540......',
    '.450..43320.554.',
    '.4330.2210.4432.',
    '.3210BCDDCB3210.',
    '4554BCDTSTDCB450',
    '3322CDSTTTSDC330',
    '0211BCDDDDDCB220',
    '..00ABBBBBBBA0..',
    '................',
    '................',
]
CF2_FRONT = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '..............Tb',
    '.............UTa',
    '...f.......e..a.',
    '...ed.....ed.b..',
    '....dc.a.cd.....',
    '.....bba.ab.....',
    '.45554....45554.',
    '.03332455543320.',
    '..022133322210..',
    '...0000000000...',
]
CF2_FLAMES = [
    [
        '......F.........',
        '......GF..F.....',
        '.....GJG..G.....',
        '...F.GJG.GJ.....',
        '...G.GJKGJG.....',
        '...GJGJKKJG.....',
        '...GJKJKLKJG....',
        '...GJKKLLKJG....',
        '....GJKLLKJH....',
        '.....HJKKJH.....',
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
    ],
    [
        '........F.......',
        '....F...GF......',
        '....G..GJG......',
        '....GJ.GJG......',
        '....GJGJKG.F....',
        '...GJKJKKJGG....',
        '...GJKKLKKJG....',
        '...GJKLLLKJG....',
        '....GJKLLKJH....',
        '.....HJKKJH.....',
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
    ],
    [
        '................',
        '................',
        '.......F........',
        '....F..GF.F.....',
        '....GF.GJ.G.....',
        '...GJGGJKGJ.....',
        '...GJKJKKKJG....',
        '...GJKKLLKJG....',
        '....GJKLLKJH....',
        '.....HJKKJH.....',
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
    ],
    [
        '.........F......',
        '........FG......',
        '.......GJG......',
        '.....F.GJG.F....',
        '.....GGJKJ.G....',
        '....GJGJKJGJ....',
        '...GJKJKLKJG....',
        '...GJKKLLKJG....',
        '....GJKLLKJH....',
        '.....HJKKJH.....',
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
    ],
]
CF2_EMBERS = [[(2, 0, 'J'), (13, 2, 'H')], [(10, 0, 'J'), (2, 1, 'H'), (13, 3, 'G')], [(7, 0, 'H'), (13, 0, 'J')], [(3, 0, 'J'), (12, 0, 'H'), (2, 3, 'G')]]


CF_LEG = leg(**{'0': ('wood', 0), '1': ('rim', 1), '2': ('rim', 2), '3': ('rim', 3), '4': ('rim', 4), '5': ('rim', 5)}, X=('cfloor', 0), A=('cfloor', 1), B=('cfloor', 2), C=('cfloor', 4), D=('cfloor', 6))


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

# A1 굵고 거친 말뚝(폭 5·5·4, 끝 높이 들쭉날쭉, 하나는 오른쪽·하나는 왼쪽으로 기욺 — 기운 자리는 밧줄 감김 밑에서 꺾임).
# 깎은 끝의 생나무 면(E·D)이 위로 보이고 몸통은 껍질(e~a, 결과 옹이). 밧줄은 난간이 아니라 말뚝마다 따로 감긴 매듭(높이도 제각각).
# 밑동은 흙 둔덕(rim 2~3 윗면 → rim 0) + 그림자. 가운데 조각의 한 말뚝이 16px 이음을 걸쳐(오른쪽 끝 → 다음 조각 왼쪽) 이음에 틈이 없다.
# 서끝·동끝 = 키 큰 굵은 모서리 기둥(폭 6, 매듭 둘 + 늘어진 밧줄 끝)으로 울이 끝난다.
PAL1_MID = [
    '.......D.....D..',
    '.D....DCb...DDCb',
    'DDCb.DDDb...DDCa',
    'DDCbDDCBbD..DCBa',
    'DCBaECCBaDCbbbaa',
    'bbaaEDbaaDDCcbEa',
    'cbbEEEDbaDCBcEEb',
    'cbEDEDCaabbacEEb',
    'cEEEcbbaacEbcEDb',
    'EEDCedbaaEEbccba',
    'EDDCedbaaEDaceda',
    'cbbbCCCBacbaceda',
    'ddcbAAAaadbacCCb',
    'CCcbdcbaadbacAAa',
    'AACCedbaadbacdca',
    'edAAdcbaadbaceda',
    'edcbaedbaCbadcba',
    'edcbaedbaACBedba',
    'edcbaedbacAaedba',
    'ddcbaedbadbaedba',
    'edcbadcbadbaedba',
    'ddcbaedbadbaCCba',
    'CCCCBdcbadbaAACa',
    'AAAAaedbacbadcAa',
    'edcbaedbadbaedba',
    'edcbaedbacbaedba',
    'ddcbaedbadbaedba',
    'edcbadcbadbaedba',
    'aaaaaaaaaaaaaaaa',
    '~~~~~~~~~~~~~~~~',
    '~~.~~~~..~~~~~.~',
    '....~~....~~....',
]
# 가운데 변형 둘: 이음을 걸친 말뚝은 같고, 나머지 두 말뚝의 높이·기울기·밧줄 높이가 다르다(16px 찍기 리듬을 깬다).
PAL1_MID2 = [
    '...D......D.....',
    '..DCb....DCb....',
    '.DDDb.D..DDCb...',
    'DDCBbDDCbDDCBb..',
    'DCCBaDDCbDCEBa..',
    'bbEaaDCBabEEDa..',
    'dEEDbbbaaEEEDCb.',
    'dEEDCbbbaEEDDCa.',
    'dEEDDCbbEEDDDCa.',
    'dEDDDCaEEcbbbba.',
    'dcbbbbEEDCCCcba.',
    'dedccbEDCAAACCa.',
    'dCCCCCcbbedcAAa.',
    'dAAAAAdcbedccba.',
    'deddcbedbeddcba.',
    'dedccbedbedccba.',
    'edccbaedbaeddcba',
    'edccbaCCbaedccba',
    'edccbaAACBedccba',
    'eddcbaedAaCCCCCa',
    'CCCcbadcbaAAAAAa',
    'AAACCBedbaeddcba',
    'edcAAaedbaedccba',
    'edccbaedbaeddcba',
    'edccbaedbaedccba',
    'edccbadcbaedccba',
    'eddcbaedbaedccba',
    'edccbadcbaedccba',
    'aaaaaaaaaaaaaaaa',
    '~~~~~~~~~~~~~~~~',
    '~~.~~~~..~~~~~.~',
    '....~~....~~....',
]
PAL1_MID3 = [
    '.....D..........',
    '....DCb...D.....',
    '.D.DDDCb.DDCD...',
    'DDbDDCBbDDCbDCb.',
    'DCaDCCBEDCBaDDCb',
    'baabbbEEDbaaDCBa',
    'cbadcEEEDCbabEaa',
    'EbadEEDDCbbacEEa',
    'EDbdEDDDCabaEEDa',
    'EDbdcbbbbabEEcba',
    'DCadCCCcbabEDdba',
    'bbadAAACCBbcbdba',
    'cbadedcAAabdbcba',
    'dbadedccbabdbCba',
    'CbadedccbabcbACa',
    'ACBdeddcbabCCdAa',
    'dAadedccbabAAdba',
    'edbaeddcbabdbdba',
    'edbaCCCCCBdbadba',
    'dcbaAAAAAadbacba',
    'edbaedccbadbadba',
    'dcbaedccbacbacba',
    'edbaeddcbadbadba',
    'CCCBedccbacbadba',
    'AAAaeddcbadbadba',
    'edbaedccbadbadba',
    'dcbaedccbadbacba',
    'edbaedccbadbadba',
    'aaaaaaaaaaaaaaaa',
    '~~~~~~~~~~~~~~~~',
    '~~.~~~~..~~~~~.~',
    '....~~....~~....',
]
# 울 묶음(kit): 세로(남북) 줄 — 말뚝 끝이 북쪽으로 겹겹이 쌓여 보이고 서쪽 면이 밝다(16px 열 5~10, 8px 간격, 32px 주기로 위아래 이어짐),
# 서모서리·동모서리 = 세로 줄과 같은 열(5~10)의 모서리 기둥 + 열린 쪽으로 이어지는 가로 말뚝(가운데 조각과 이음이 맞음).
# 북쪽 모서리는 기둥 밑에 세로 조각이, 남쪽 모서리는 기둥 위에 세로 조각이 붙으므로 같은 그림을 쓴다.
PAL1_VERT = [
    '....eEEDDDCaa.~.',
    '....EEDbbbbaa.~~',
    '...EEEDCbcbaa.~~',
    '...EEDDCbcba..~.',
    '...EDDDCaCEa..~~',
    '...cbbbbaEEDb.~~',
    '...CCCcbEEEDb.~.',
    '...AAACEEDDCa.~~',
    '...edEAEDDDCa.~~',
    '...eEEDbbbbba.~.',
    '...EEEDCdccba.~~',
    '..EEDDCbddcba.~~',
    '..EDDDCadcEba.~.',
    '..cbbbbadEEDa.~~',
    '..eddcbaEEEDCb~~',
    '..edccbaEEDDCa~.',
    '..edEcbaEDDDCa~~',
    '..eEEDbacbbbba~~',
    '..eEEDCbCCCCCa~.',
    '..eEEDDCbAAAAa~~',
    '..eEDDDCaEdcba~~',
    '..eCCCCCEEDbba~.',
    '..aAAAAEEEDCba~~',
    '...eddcEEDDCba~~',
    '...edcEEDDDCaa~.',
    '...edEEDbbbbaa~~',
    '...eEEEDCbcbaa~~',
    '...eEEDDCbcba.~.',
    '...eEDDECacba.~~',
    '...ecbEEDbcba.~~',
    '...aedEEDCbba.~.',
    '....aaaaaaaaa.~~',
]
PAL1_CW = [
    '....eEEDDDCaa...',
    '....EEDbbbbaa...',
    '...EEEDCbcbaa...',
    '...EEDDCbcbC..D.',
    '...EDDDCaCEDbDDb',
    '...cbbbbaEEEDDCa',
    '...edccbEEDCbbaa',
    '...CCCCCEDDCacEa',
    '...AAAAAcbbbaEEa',
    '...edccbddcbaEDa',
    '...edccbCCcbacba',
    '...edccbAACCBdba',
    '...eddcbedAAacba',
    '...edccbedcbadba',
    '...eddcbddcbaCba',
    '...edccbedcbaACa',
    '...CCCcbddcbadAa',
    '...AAACCedcbacba',
    '...edcAAedcbadba',
    '...eddcbedcbacba',
    '...edccbedcbadba',
    '...eddcbCCCCBdba',
    '...edccbAAAAadba',
    '...edccbddcbadba',
    '...CCCCCedcbacba',
    '...AAAAAedcbadba',
    '...eddcbedcbacba',
    '..~edccbedcbadba',
    '..~eddcbddcbaaaa',
    '..~edccbedcba~~~',
    '...edccbddcba~.~',
    '...aaaaaaaaaa...',
]
PAL1_CE = [
    '....eEEDDDCaa...',
    '....EEDbbbbaa...',
    '.D.EEEDCbcbaa...',
    'DDbEEDDCbcbC....',
    'DCaEDDDCaCEDb...',
    'baacbbbbaEEEb...',
    'cEaedccbEEDCa...',
    'EEbCCCCCEDDCa...',
    'EDaAAAAAcbbba...',
    'cbaedccbddcba...',
    'dbaedccbCCcba...',
    'dbaedccbAACCa...',
    'CCBeddcbedAAa...',
    'AAaedccbedcba...',
    'cbaeddcbddcba...',
    'dbaedccbedcba...',
    'dbaCCCcbddcba...',
    'dbaAAACCedcba...',
    'dbaedcAAedcba...',
    'cbaeddcbedcba...',
    'dbaedccbedcba...',
    'CbaeddcbCCCCa...',
    'ACBedccbAAAAa...',
    'dAaedccbddcba...',
    'dbaCCCCCedcba...',
    'dbaAAAAAedcba...',
    'cbaeddcbedcba...',
    'dbaedccbedcba~..',
    'aaaeddcbddcba~..',
    '~~~edccbedcba~..',
    '~~.edccbddcba~..',
    '...aaaaaaaaaa...',
]
PAL1_WEST = [
    '............D...',
    '.....E...D..DCb.',
    '...EEDb.DDCbDDCb',
    '..EEEEDCDDCbDCBa',
    '.EEEDDCbDCBabbaa',
    '.EEDDDCabbaacbEa',
    '.CCCCCCBcbbacEEb',
    '.AAAAAAacEbaEEDa',
    '.edcdcbacEDbEDCa',
    '.eedccbacEEDcbba',
    '.eedccbacEDCedba',
    '.eedccbaccbbCCba',
    '.eedccbacdcbAACa',
    '.edcdcbacCCCdcAa',
    '.eedccbacAAAedba',
    '.CCCdcbacedbdcba',
    '.AAACCCBcedbedba',
    '.eedAAAadcbaedba',
    '.eedccbaedbaedba',
    '.eedccbadcbaedba',
    '.edcdcbaedbadcba',
    '.eedccbaCCbaedba',
    '.edcdcbaAACBdcba',
    '.CCCCCCBedAaedba',
    '.AAAAAAadcbaedba',
    '.eedccbaedbaedba',
    '.eedccbadcbaedba',
    '~edcdcbaedbadcba',
    '~aaaaaaaaaaaaaaa',
    '~~~~~~~~~~~~~~~~',
    '~~.~~~~..~~~~~.~',
    '....~~....~~....',
]
PAL1_EAST = [
    '......D.........',
    '.....DDC..E.....',
    '.D..DDCbEEDb....',
    'DDCbDCBaEEEDCb..',
    'DDCbbbaaEEEDDCb.',
    'DCBacbbaEEDDDCa.',
    'bEaacbbacbbbbba.',
    'EEDacbbaCCCdcba.',
    'EDbacEbaAAACCCa.',
    'DCaaEEDbeedAAAa.',
    'bbaaEEDbeedccba.',
    'dbaaEDCaeedccba.',
    'Cbaacbbaedcdcba.',
    'ACBaedbaeedccba.',
    'cAaaedbaedcdcba.',
    'dbaadcbaeedccba.',
    'dbaaCCCBeedccba.',
    'edbaAAAaCCCCCCa.',
    'edbaedbaAAAAAAa.',
    'dcbaedbaedcdcba.',
    'edbaedbaeedccba.',
    'dcbaedbaedcdcba.',
    'CCCBdcbaeedccba.',
    'AAAaedbaeedccba.',
    'edbadcbaCCCccba.',
    'edbaedbaAAACCCa.',
    'dcbaedbaedcAAAa.',
    'edbaedbaeedccba~',
    'aaaaaaaaaaaaaaa~',
    '~~~~~~~~~~~~~~~~',
    '~~.~~~~..~~~~~.~',
    '....~~....~~....',
]

# A2 조잡한 방어 말뚝 벽: 짙게 바랜 가는 말뚝을 두세 개씩 덩이로 박고 덩이마다 거친 밧줄로 묶었다(높이·굵기·기울기 제각각),
# 덩이 사이 빈틈, 묶음에 매단 가죽 조각, 가로대 없음. 끝 조각 = 곧은 기둥 꼭대기에 꿴 해골. 밑동은 A1 과 같은 흙.
PAL2_MID = [
    '............D...',
    '...D......DDa...',
    '..DDb.....DCa...',
    '..DCa.....baEE..',
    '..baa.....cEEDD.',
    '..cba.....EEDDDC',
    '..cEC....EEDbDCb',
    '..EEDD...EDCaDCa',
    '.EEDDDC..cbbabba',
    'EEDbDCCb.DCCCCCb',
    'EDCaDCBa.AAAAAAa',
    'cbbabbba.edcBaca',
    'DCCCCCCa.edcadca',
    'AAAAAAAa.edcadca',
    'edcBavwa.edcadca',
    'edcadcvaedcadcba',
    'edcadcvaedcadcba',
    'edcadctsedcadcba',
    'edcadcbaedcadcba',
    'edcadcbaDCCCCCCa',
    'edcadcbaAAAAAAAa',
    'DCCCCCCBedcBacba',
    'AAAAAAAaedcadcba',
    'edcBacbaedcadcba',
    'edcadcbaedcadcba',
    'edcadcbaedcadcba',
    'edcadcbaedcadcba',
    'edcadcbaedcadcba',
    'aaaaaaaaaaaaaaaa',
    '~~~~~~~~~~~~~~~~',
    '~~.~~~~..~~~~~.~',
    '....~~....~~....',
]
# 가운데 변형 둘: 덩이 구성(셋·둘)·말뚝 높이·묶음 높이·가죽 조각 자리가 다르다.
PAL2_MID2 = [
    '..D.............',
    '.DDb..........D.',
    '.DCa....D....DDb',
    '.baa...DDb...DCa',
    '.cEC...DCa...baa',
    '.EEDD..baa...cba',
    'EEDDDC.cba...cba',
    'EDbDCCbcba.EEcba',
    'DCaDCBacbaEEDDba',
    'bbabbbacbEEDDDCa',
    'CCCCCCBcEEDbDCCa',
    'AAAAAAacEDCaDCBa',
    'dcBacbaccbbabbba',
    'dcadcbacedcadcba',
    'dcadcbacDCCCCCCa',
    'dcadcbacAAAAAAAa',
    'edcadcbaedcBa78a',
    'edcadcbaedcad676',
    'edcadcbaedcad666',
    'edcadcbaedcad6aa',
    'DCCCCCCBedcadcba',
    'AAAAAAAaedcadcba',
    'edcBacbaedcadcba',
    'edcadcbaedcadcba',
    'edcadcbaedcadcba',
    'edcadcbaedcadcba',
    'edcadcbaedcadcba',
    'edcadcbaedcadcba',
    'aaaaaaaaaaaaaaaa',
    '~~~~~~~~~~~~~~~~',
    '~~.~~~~..~~~~~.~',
    '....~~....~~....',
]
PAL2_MID3 = [
    '.......D........',
    '.....DDa........',
    '....EECa.....D..',
    '...EEDDa....DDb.',
    '..EEDDDb....DCa.',
    '.EEDbDCCb.EEbaa.',
    '.EDCaDCBaEEDDba.',
    '.cbbabbbEEDDDCa.',
    '.DCCCCCEEDbDCCa.',
    '.AAAAAAEDCaDCBa.',
    '.edcBaccbbabbba.',
    '.edcadcDCCCCCCa.',
    '.edcadcAAAAAAAa.',
    '.edcadcedcBacvt.',
    '.edcadcedcadcbs.',
    'edcadcbedcadcbs.',
    'edcadcbaedcadcts',
    'edcadcbaedcadcba',
    'DCCCCCCBedcadcba',
    'AAAAAAAaedcadcba',
    'edcBacbaedcadcba',
    'edcadcbaedcadcba',
    'edcadcbaDCCCCCCa',
    'edcadcbaAAAAAAAa',
    'edcadcbaedcBacba',
    'edcadcbaedcadcba',
    'edcadcbaedcadcba',
    'edcadcbaedcadcba',
    'aaaaaaaaaaaaaaaa',
    '~~~~~~~~~~~~~~~~',
    '~~.~~~~..~~~~~.~',
    '....~~....~~....',
]
# 울 묶음(kit): 세로(남북) 줄 — 말뚝 끝이 북쪽으로 겹겹이 쌓여 보이고 서쪽 면이 밝다(16px 열 5~10, 8px 간격, 32px 주기로 위아래 이어짐),
# 서모서리·동모서리 = 세로 줄과 같은 열(5~10)의 모서리 기둥 + 열린 쪽으로 이어지는 가로 말뚝(가운데 조각과 이음이 맞음).
# 북쪽 모서리는 기둥 밑에 세로 조각이, 남쪽 모서리는 기둥 위에 세로 조각이 붙으므로 같은 그림을 쓴다.
PAL2_VERT = [
    '...edEECaDCBaa~.',
    '...eEEDDabbbaa~~',
    '...EEDDDCCCCBa~~',
    '..EEDbDCCbAAa.~.',
    '..EDCaDCBEEba.~~',
    '..cbbabbEEDDa.~~',
    '..edcadEEDDDb.~.',
    '..DCCCEEDbDCCb~~',
    '..AAAAEECaDCBa~~',
    '..edcEEDDabbba~.',
    '..edEEDDDCdcba~~',
    '..eEEDbDCCbcba~~',
    '..eEDCaDEEacba~.',
    '..ecbbaEEDDcba~~',
    '..aedcEEDDDCba~~',
    '...edEEDbDCCba~.',
    '...edEECaDCBaa~~',
    '...eEEDDabbbaa~~',
    '...EEDDDCdcbaa~.',
    '..EEDbDCCbcba.~~',
    '..EDCaDCBEECa.~~',
    '..cbbabbEEDDa.~.',
    '..edcadEEDDDb.~~',
    '..edcaEEDbDCCb~~',
    '..edcaEECaDCBa~.',
    '..DCCEEDDabbba~~',
    '..AAEEDDDCdcba~~',
    '..eEEDbDCCbcba~.',
    '..eEDCaDEEacba~~',
    '..ecbbaEEDDcba~~',
    '..aedcEEDDDCba~.',
    '...aaaaaaaaaaa~~',
]
PAL2_CW = [
    '...edEECaDCBaa..',
    '...eEEDDabbbaa..',
    '...EEDDEECCCBa..',
    '..EEDbEEDDAAa...',
    '..EDCEEDDDCba.E.',
    '..aaEEDbDCCbaEEb',
    '....EDCaDCBa.EDa',
    '....cbbabbba.cba',
    '....edcadcba.cba',
    '....DCCCCCCa.dba',
    '....AAAAAAAa.cba',
    '....edcBacba.dba',
    '....edcadcba.CCa',
    '....edcadcba.AAa',
    '....edcadcba.dba',
    '....edcadcba.cba',
    '....edcadcba.dba',
    '....edcadcba.cba',
    '....edcadcba.dba',
    '....edcadcba.dba',
    '....DCCCCCCa.CCa',
    '....AAAAAAAa.AAa',
    '....edcBacba.cba',
    '....edcadcba.dba',
    '....edcadcba.cba',
    '....edcadcba.dba',
    '....edcadcba.dba',
    '..~~edcadcba~dba',
    '..~~edcadcba~aaa',
    '..~~edcadcba~~~~',
    '...~edcadcba~~.~',
    '....aaaaaaaa....',
]
PAL2_CE = [
    '...edEECaDCBaa..',
    '...eEEDDabbbaa..',
    '...EEDDEECCCBa..',
    '..EEDbEEDDAAa...',
    '..EDCEEDDDCba...',
    '.EcaEEDbDCCba...',
    'EEa.EDCaDCBa....',
    'EDa.cbbabbba....',
    'cba.edcadcba....',
    'dba.DCCCCCCa....',
    'cba.AAAAAAAa....',
    'dba.edcBacba....',
    'cba.edcadcba....',
    'CCa.edcadcba....',
    'AAa.edcadcba....',
    'dba.edcadcba....',
    'dba.edcadcba....',
    'cba.edcadcba....',
    'dba.edcadcba....',
    'cba.edcadcba....',
    'dba.DCCCCCCa....',
    'CCa.AAAAAAAa....',
    'AAa.edcBacba....',
    'dba.edcadcba....',
    'cba.edcadcba....',
    'dba.edcadcba....',
    'cba.edcadcba....',
    'dba~edcadcba~~..',
    'aaa~edcadcba~~..',
    '~~~~edcadcba~~..',
    '~~.~edcadcba~~..',
    '....aaaaaaaa....',
]
PAL2_WEST = [
    '..vwwt..........',
    '.vwwwvs.....D...',
    '.wawwaa....DDb..',
    '.wavvaa....DCa..',
    '.vwwata....baa..',
    '.Etasab....cba..',
    'EEDbDCCb...cEC..',
    'EDCaDCBa...EEDD.',
    'cbbabbba..EEDDDC',
    'edcadcba.EEDbDCb',
    'DCCCCCCa.EDCaDCa',
    'AAAAAAAa.DCCCCCb',
    'edcBacba.AAAAAAa',
    'edcadcba.edcBaca',
    'edcadcba.edcavwa',
    'edcadcba.edcadva',
    'edcadcba.edcadva',
    'edcadcbaedcadcts',
    'edcadcbaedcadcba',
    'DCCCCCCBedcadcba',
    'AAAAAAAaedcadcba',
    'edcBacbaDCCCCCCa',
    'edcadcbaAAAAAAAa',
    'edcadcbaedcBacba',
    'edcadcbaedcadcba',
    'edcadcbaedcadcba',
    'edcadcbaedcadcba',
    'edcadcbaedcadcba',
    'aaaaaaaaaaaaaaaa',
    '~~~~~~~~~~~~~~~~',
    '~~.~~~~..~~~~~.~',
    '....~~....~~....',
]
PAL2_EAST = [
    '...D......vwwt..',
    '..DDb....vwwwvs.',
    '..DCa....wawwaa.',
    '..baa....wavvaa.',
    '..cba....vwwata.',
    '..cEC....Etasab.',
    '..EEDD..EEDbDCCb',
    '.EEDDDC.EDCaDCBa',
    'EEDbDCCbcbbabbba',
    'EDCaDCBaDCCCCCCa',
    'cbbabbbaAAAAAAAa',
    'edcadcbaedcBacba',
    'edcadcbaedcad78a',
    'DCCCCCCBedcad676',
    'AAAAAAAaedcad666',
    'edcBacbaedcad6aa',
    'edcadcbaedcadcba',
    'edcadcbaedcadcba',
    'edcadcbaDCCCCCCa',
    'edcadcbaAAAAAAAa',
    'edcadcbaedcBacba',
    'edcadcbaedcadcba',
    'DCCCCCCBedcadcba',
    'AAAAAAAaedcadcba',
    'edcBacbaedcadcba',
    'edcadcbaedcadcba',
    'edcadcbaedcadcba',
    'edcadcbaedcadcba',
    'aaaaaaaaaaaaaaaa',
    '~~~~~~~~~~~~~~~~',
    '~~.~~~~..~~~~~.~',
    '....~~....~~....',
]
PAL_SKULL = [   # 기둥 끝에 꿴 해골(말뚝 끝이 정수리로 뚫고 나옴)
    '..E...',
    '.vwwt.',
    'vwwwvs',
    'wzwwzz',
    'wzvvzz',
    'vwwztz',
    '.tzsz.',
]


def palisade(rows, skull_x=None):
    cv = g(rows, PAL_LEG)
    if skull_x is not None:
        stamp(cv, PAL_SKULL, PAL_LEG, skull_x, 0)
    return cv



# ================================================================================================ 고블린 가죽 천막 (3×3)
TENT_LEG = leg(n=('moss', 1), o=('moss', 2), p=('moss', 4), q=('moss', 5), Y=('crock', 4), Z=('crock', 2), X=('cfloor', 0), A=('cfloor', 1), B=('cfloor', 2), C=('cfloor', 4), D=('cfloor', 6), E=('cfloor', 7),
               **{'6': ('rim', 1), '7': ('rim', 2), '8': ('rim', 3), '9': ('rim', 4), '+': ('rim', 5)})
# A1 고블린 A자 천막: 왼쪽이 높은 울퉁불퉁한 용마루 막대를 갈래 기둥 둘에 걸쳐(양끝이 삐져나옴) 가죽을 처지게 덮었다.
# 3/4 — 용마루 위 북쪽 경사면 한 줄(밝음), 서쪽 박공 세모(빛, 밝은 가죽), 남쪽 경사면(왼쪽 밝음 → 오른쪽 그늘, 깨끗한 띠), 동쪽 박공(그늘).
# 큰 덧댄 가죽 둘(이끼 낀 녹색 · 회색, 각자 명암) + 거친 땀 몇 개, 처진 주름, 뜯긴 밑단과 너덜 자락, 입구 + 말아 올린 자락,
# 왼쪽 갈래 기둥 꼭대기에 묶은 해골, 용마루에 매단 뼈, 바닥 발자국 그림자. 줄 말뚝·붉은 칠은 뺐다.
TENT1 = [
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '...........EEEE...............DDD8a.............',
    '..........EEDEEEEEDEEEEED...ED8EDDDD8a~~........',
    '..........EEwpppppwEEDEEEEEDDDD8D8DDEa~~........',
    '..........EpoooooonEEEEEDEEDDD88EDDD8a~~........',
    '.........DwpooooooonwDEEDEDwYYYYw8DDDEa~~.......',
    '...vwwt..EEEpoooonDEEEED8DDYZZZZZmDD8Da~~.......',
    '..vwwwvs.DEEEwpnnwEEE8DDDDD8wYZZZZmwDDa~~.......',
    '..wbwwbbEEEEDEEEDEDEDDDD8EDDDDYmmDED8D8a~~......',
    '..vwwbtbEDEEEEEDDEDDD8DDDDD8DDED88DDD88a~~......',
    '...tbsb.EEEEDEEEDE8DDDDD8DEDDD8D8DDEC88a~~......',
    '....d.cEEDEEEED88DDDD8EDDDD8DDDE8888888Cad.c~~..',
    '....debEEEEE8DD8DD8DDDDD8DDEDD8DDC88C888adeb~~..',
    '.....eeEEEEDDDECDDDDD8DEDDD8DDDDDB8888EEaee~~...',
    '.....bbbabEEDEEDDD8EDDDD8DDDEDC88EEEDEbbabb~~...',
    '......CBC8bbabbEEeDEEEEEDEEEEEDeEbbbabBCBa~~....',
    '......CB8CCCCCBbabbbabbbabbbabbbaBBABBCBBa~~....',
    '......CBCCCCCCBCvwBBBABBBBBCABvwBBBABCBAAa~~....',
    '.....C8BCBCCBBABBvBBBABBBBCBABBvBBBACBAAAAa~~...',
    '.....8BABBBBBBACAttBBABa;D8aABBttwBBBwAAAAa~~...',
    '.....BBAwddddwAABBBBBABa;DC8aBBBABAAAaAAAAa~~...',
    '.....BBABdccccbABBBBBABa;D888aBBwBaaawAAAAa~~...',
    '....BBBABwdcccbwBBBBBAa;;;D8C8aAAAAbAAAAAAba~~..',
    '....BBBABBBdbbAABBBBBAa;;;DC888aeAAbAAAAABba~~..',
    '....BBBABBCBBBAABBBBBAa:::AD88CacAAbAAAABAba~~..',
    '...BBBBABCBBBBAABBABAa:::::D8C88aAAbAAABAAbAa~~.',
    '...BBBBACBBBBBAAAABAAa:::::bbbbbbAAbAABAAAbAa~~.',
    '...BBBBAAAAAAAbbABAAa:::::::bAAAbAAbABAAAAbAa~~.',
    '...BBBBbAAAAAAaABAAAa,,,,,,,bAAAAbAbBAAAAAbAa~~.',
    '..ABBBAbAAAAAAaBAAAAa,,,,,,,bAAAAbAbAAAAAAbAAa~~',
    '..AABAAbAAAAAAaAAAAa,,,,,,,,,AAAAbBbAAAAAAbABa~~',
    '..ABAAAbbabAABbAAAaa,,,,,,,,,AaAABAbAAbaAAbBAa~~',
    '.bbAAAab~~~baAbAbb~,,,,,,,,,,,~bbAAbab~~bbbAAab~',
    '.~~abb~~~~~~~bba~~~~~~~bab~~~~~~~abb~~~~~~abb~~.',
    '.~~c~~~~~~~~~c~~~~~~~~~~c~~~~~~~~~c~~~~~~~~c~~~.',
    '.~~c~~~~...~~c~~~~~~~~~~c~~~~~~~~~~c~~~~~~~~c~~.',
    '..c~~~......c~~~~~.~~~~~c~~~~~~~~~~c~~~~~~~~c~~.',
    '..d.........d~~~.......~d~~~~~.~~~~~d~~~~~~~~d~.',
    '..e.........e...........e~.......~~~e~..~~~~~e~.',
    '..b.........b...........b...........b.....~~~b..',
    '................................................',
    '................................................',
]
# A2 가죽 둔덕 움막: 휜 막대 고리 셋(갈색 c·b, 매듭 뼈 w) 위에 이끼 낀 녹갈색 가죽을 덮어 꿰맨 낮은 둔덕.
# 3/4 — 둔덕 윗면이 위에서 보이고(왼쪽 위 빛 D·E, 오른쪽 아래 그늘 X·A), 앞 밑동에 반타원 입구(어둠 ; :)와 젖힌 자락.
# 덧댄 가죽 조각(갈색 무두 가죽·뼈빛 가죽, 땀 w), 꼭대기에 뿔 달린 짐승 머리뼈, 오른쪽에 막대에 꽂은 해골과 매단 뼈,
# 밑단은 뜯긴 너덜 자락, 바닥에 그림자 ~.
TENT2 = [
    '................................................',
    '...............wv...............vw..............',
    '................vw.............wv...............',
    '.................vw...........wv................',
    '..................vwv.......vwv.................',
    '...................vwwwwwwwvw...................',
    '....................wzzwwzzw....................',
    '....................vwwwwwwv....................',
    '.....................vwzzwv.....................',
    '...................EEEtvvtEDDX..................',
    '...............EEEEEEEEwvwDDDDDDDX..............',
    '.............EEEEEeeeeeeaccccccDDCCX............',
    '...........EEEEeeebbbbbbDaaaaaacccCCCX..........',
    '..........EEEEebbbEEEDEDDDDDDCDaaacCCBX.........',
    '.........EEEeebEEEEEDEDDDDDDCDCCCCaccCBX........',
    '.......EEEEebbEEEEEDeeewvwcccCCCCCCaacBBBX......',
    '.......EEEebEEEEEeeebbbbaaaaacccCCBCBacBBX......',
    '......EEEebEEEEeebbbDDDDDCDCwaaaccCBBBacBBX.....',
    '.....EEEebEEEeebbEDDDDDDCDCtuuutaaccBBBacBAX....',
    '.....EEebEEEebbDEDDDDDDCCCCwtuwBBBaacBBAacAX....',
    '....EEebEEEebEDDDDDDDDCCCCCCCCBBBBBBacABAacAX...',
    '....EEbEEEebwccbwDDDDCCCCCCCCBBBBBBBBacAAAaAX...',
    '....EeEEEebcdccccbDDCCCCCCCCBBBBBBBBABacAAAcX...',
    '...EEbEEebEccdcccbDCeeewvwcccBBBBBBABAAacAAaAX..',
    '...EEEEebEDwbccbeeeesbbbaaaasccccBABAAAAacAAAX..',
    '...EeEEbEDDDDDeebbbbsCCBCBBBsaaaaccAvwwtAaAAcX..',
    '...EbEeEDDDDeebbCCCCsCBCBBBBsBBBAaavwwwvsAcAaX..',
    '...EEDbDDDDebbDCCsCCwBCBBBBBwBBsAAAwzwwzzAaAAX..',
    '...EDeDDDDebCDCCCsCCBCBBBBBBBBAsAAAvwzwtzAAcAX..',
    '...DEbDDDebCDCCCCwCBCBBBBBBBBAAwtuuttzszAAAaAX..',
    '...EeDDDebCDCCCCCCBCBB;;;;;BAAtuuuutAdbacAAAcX..',
    '...ebccebCDCCCCCCBB76;;;;:;;AAwtuutwAdbAacAAac..',
    '...bDwebbCCCCCCCBB76;;;;;:;;;AAAAAAAAdbAAacAAa..',
    '...DDcbcbCCCCCCBBB86;;;;;:;;;ABBwBwAAdbAAAaAAX..',
    '...DDecbwCCCCCBBB76;;;;;;:;;;;BAAAAXAdbAAAAcAX..',
    '...DDbCCCCCCCBBBB76;:;:;:::;:;wBABAXBdbAAAAaAX..',
    '...DeCCCCCCCBBBB86:::::::,::::BAAABXAdbAAAAAcX..',
    '...ebCCCCBCBBBBB76:::::::,::::wABAAXAdbAAAAAac..',
    '...bCCCCBCBBBBBB76:::::X:X:X::AXXXXXAdbAAAAAAa..',
    '...AACCBCBBBBBBB86:::AXXAXXAX::AAAAAAdbAAAAAXX..',
    '...~~~AABBBBBBBB76:,:,:,:,:,:,:AABAABdbAAXX~~~..',
    '...~~~A~.AABBBBA76,,,,,,,,,,,,,BAAAAAdbX.X~~~~..',
    '...~~~~~~A~~AAA.86,,,QRQ,,,,,,,AAAX.Xdb~~~~~~~..',
    '......~~~X~~~A~~A6,,RQRQ,,,,,,,X~X~~~db~~~~.....',
    '........~~~~~~~~~~~~~~~~~~~~~~~~~~~~~db~~.......',
    '............~~~~~~~~~~~~~~~~~~~~~~~~~...........',
    '.................~~~~~~~~~~~~~~~................',
    '................................................',
]
TENT2_LEG = leg(X=('stone', 0), A=('moss', 1), B=('moss', 2), C=('moss', 3), D=('moss', 4), E=('moss', 5),
                Q=('cfloor', 1), R=('cfloor', 2), **{'6': ('rim', 1), '7': ('rim', 2), '8': ('rim', 3), '9': ('rim', 4)})


TENT1_LEG = leg(Y=('crock', 5), **{'8': ('cfloor', 5)}, X=('cfloor', 0), A=('cfloor', 1), B=('cfloor', 2), C=('cfloor', 4), D=('cfloor', 6), E=('cfloor', 7),
                n=('moss', 1), o=('moss', 2), p=('moss', 4), Z=('crock', 4), m=('crock', 3), **{'6': ('rim', 1)})


def tent(rows):
    return g(rows, TENT2_LEG if rows is TENT2 else TENT1_LEG)


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
        return palisade(PAL2_WEST), palisade(PAL2_MID), palisade(PAL2_EAST)

    def kit(s):
        if s.n == 1:
            return g(PAL1_VERT, PAL_LEG), g(PAL1_CW, PAL_LEG), g(PAL1_CE, PAL_LEG)
        return palisade(PAL2_VERT), palisade(PAL2_CW), palisade(PAL2_CE)

    def mids(s):
        if s.n == 1:
            return [g(r, PAL_LEG) for r in (PAL1_MID, PAL1_MID2, PAL1_MID3)]
        return [palisade(r) for r in (PAL2_MID, PAL2_MID2, PAL2_MID3)]


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
    ms = st.mids()
    for x, piece in ((1, w), (2, ms[0]), (3, ms[1 % len(ms)]), (4, ms[2 % len(ms)]), (5, e),
                     (7, w), (8, ms[1 % len(ms)]), (9, ms[0]), (10, e)):
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


PEN = [   # 8×10 울 우리: 천장 1 · 앞면 2 · 바닥 7
    '########',
    '########',
    '########',
    '#......#',
    '#......#',
    '#......#',
    '#......#',
    '#......#',
    '#......#',
    '#......#',
]


def pal_cand(n):
    def fn():
        st = Set(n)
        w, m, e = st.pal()
        ms = st.mids()
        vert, cw, ce = st.kit()

        def make(line):
            cv = room(PEN, line)
            P = cv.paste
            for x, p in ((1, cw), (2, ms[0]), (3, ms[1]), (4, ms[2]), (5, ms[0]), (6, ce)):   # 북쪽 줄
                P(p, x * T, 3 * T)
            P(vert, 1 * T, 5 * T)
            P(vert, 6 * T, 5 * T)                                                                # 세로 줄
            for x, p in ((1, cw), (2, ms[1]), (3, e), (5, w), (6, ce)):                          # 남쪽 줄 + 문 틈
                P(p, x * T, 7 * T)
            put_actor(cv, 4, 8)
            return cv
        v = strip3(make)
        parts = {'서끝': w, '가운데': ms[0], '가운데2': ms[1], '가운데3': ms[2], '동끝': e,
                 '세로': vert, '서모서리': cw, '동모서리': ce}
        return hcat(w, *ms, e, vert, cw, ce), {'kind': 'objects', 'parts': parts, 'vignette': v}
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
        'A1': '벽 면 안에 앉힌 각진 나무 상인방(윗면 밝음·어두운 밑면) + 14px 세로 널 문짝·쇠띠 둘·쇠고리, 문설 띠 없음. 열림 = 바닥이 문턱까지 이어지고 문짝이 오른쪽 안으로 젖혀져 밝은 모서리가 보임',
        'A2': '벽 면 안에 앉힌 껍질 통나무 상인방(잘린 끝 나이테) + 뾰족 아치 + 14px 널 문짝·쇠띠. 열림 = 바닥이 문턱까지 이어지고 문짝이 왼쪽 안으로 젖혀져 밝은 모서리가 보임',
    },
    'gap.lever': {
        'A1': '칸을 거의 다 쓰는 리벳 넷 쇠 판(10×13, 왼쪽 위 빗면 밝음) + 가운데 굴대 + 3px 나무 자루 + 3×3 놋쇠 손잡이. 올림 = 자루가 위로 곧게, 손잡이가 판 꼭대기 · 내림 = 아래로 곧게, 판 밑(벽 밑동 위)',
        'A2': '벽 면 높이(칸 가운데 위)에 박힌 서늘한 돌 판(벽과 같은 돌 램프, 바닥 접지 그림자 없음, 왼쪽 위 빗면 밝음) + 쇠 굴대 + 긴 나무 자루 + 붉은 손잡이. 올림 = 자루가 왼쪽 위 45°로 판 밖 구석까지 · 내림 = 오른쪽 아래 45°로 판 밖 구석까지(1배에서 실루엣이 다름)',
    },
    'gap.goblin_tent': {
        'A1': '처진 가죽 A자 천막 — 갈래 기둥 둘에 걸친 처진 용마루, 먼 쪽 경사면이 윗면, 남쪽 경사면이 땅까지 내려옴(벽 띠 없음), 색이 다른 가죽을 이어 꿰맨 불규칙한 덧댐, 처진 골, 들쭉날쭉 밑단과 말뚝, 세모 입구에 접힌 자락, 기둥 위 해골·매단 뼈. 장면 = 같은 번호 소품의 야영 굴',
        'A2': '가죽 둔덕 움막 — 휜 막대 고리 셋 위에 이끼 낀 녹갈색 가죽을 덮어 꿰맴(윗면 빛·오른쪽 아래 그늘). 덧댄 갈색·뼈빛 가죽 조각, 꼭대기 뿔 달린 짐승 머리뼈, 막대에 꽂은 해골, 입구 위에 매단 뼈, 반타원 입구, 뜯긴 밑단. 장면 = 같은 번호 소품의 야영 굴',
    },
    'gap.bone_pile': {
        'A1': '뼈: 받침 없는 뼈 무더기 — 엇갈린 긴 뼈(하나는 오른쪽 위로 솟음)·갈비·꼭대기 둥근 해골과 턱·삐죽 나온 부러진 칼날·금화, 뼈 사이 어두운 틈, 밝은 윗면, 접지 그림자 · 약탈품: 묶은 목의 삼베 자루 + 앞의 금화 무더기 + 무더기에 꽂힌 칼(받침 없음)',
        'A2': '뼈: 받침 없이 흩어진 굵은 뼈 셋(3px 몸통 · 마디진 끝, 뼈 빛깔로만 명암) + 앞 왼쪽 바닥의 작은 해골, 밑·오른쪽은 중간 어둠 접지 그늘 · 약탈품: 밝은 뚜껑 윗면 궤짝 + 큰 금화 무더기 + 기댄 창',
    },
    'gap.palisade': {
        'A1': '두 줄 두께의 거친 둥근 말뚝 울 — 뒷줄 깎은 끝(한 단 어두움)이 앞줄 끝보다 4줄 위로 보여 위에서 본 빽빽한 끝 띠를 이루고, 앞줄 껍질 면에 말뚝마다 다른 높이·비스듬한 밧줄. 폭·높이·기울기·끝 위치 제각각. 세로(남북) 줄 = 끝에서 본 같은 두께의 벽: 엇갈린 두 열의 깎은 끝이 4줄마다 빽빽이 겹친 폭 10 띠, 모서리 = 두 열의 앞 말뚝이 기둥. 장면 = 우리 하나를 두른 울(문 틈)',
        'A2': '쪼갠 통나무 짝 울 — 두 반쪽이 가운데로 솟게 깎인 큰 끝·쪼갠 틈, 짝마다 높이·기울기 제각각, 짝을 묶은 밧줄 고리(높이 제각각·매듭 꼬리), 뼈·가죽 부적을 매닮, 뒷줄 가는 검은 말뚝, 문기둥 짝 위 해골. 세로 줄 = 엇갈린 두 열의 짝 끝이 빽빽이 겹친 띠, 모서리 = 큰 짝 기둥',
    },
    'gap.campfire': {
        'A1': '받침대 없음 — 작은 둥근 돌 3/4 타원 고리 + 둥근 끝이 보이는 큰 장작 더미 + 큰 불. 장면 넷 = 불꽃 높이는 같고 혀 모양·기울기가 바뀜(곧음·왼쪽·오른쪽·세 갈래) + 불티',
        'A2': '큰 바위(바위마다 윗면·앞면·밑) 3/4 타원 고리 + 구부정한 장작 세모(앞다리가 불 밑동 앞) + 큰 불. 오른쪽 바위 틈 짧은 꼬챙이의 작은 고기. 장면 넷 = 불꽃 실루엣·높이·불티가 크게 바뀜',
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
