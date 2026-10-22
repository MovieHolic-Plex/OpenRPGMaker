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
    '......455z......',
    '....5442454z....',
    '..543244554320..',
    'z4322bccccb23100',
    '.43cbdcbdcbdc100',
    '54dcbdcbdcbdcb10',
    '54cdbedbedbedb10',
    '53cdbedbedbedb10',
    '54cdbedbedbedb10',
    '54lkkkkkkkkkljz.',
    '42hhhhhhhhhhhg00',
    '54cdbedbedbedb10',
    'z4cdbedbedbedb10',
    '.4cdbedbedbedb10',
    '.4cdbedbedbedb10',
    '54cdbedbedbldb10',
    '42cdbedbedkajb00',
    '54cdbedbedjahb10',
    '54cdbedbedbhdbz.',
    '54cdbedbedbedb10',
    'z4cdbedbedbedb10',
    '.4cdbedbedbedb10',
    '42cdbedbedbedb00',
    '53lkkkkkkkkklj10',
    '54hhhhhhhhhhhg10',
    '54cdbedbedbedbz.',
    '54cdbedbedbedbz.',
    '54cdbedbedbedb10',
    '42cdbedbedbedb00',
    '54cbacbacbacba10',
    '5444444444444210',
    'z000000000000000',
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
# 열림 = 문짝 하나가 왼쪽 문설주 쪽 안으로 젖혀져 원근으로 좁아진 널(2~5열, 경첩 쪽이 길고 안쪽 끝이 짧음)과 쇠띠가 보이고,
# 오른쪽 문설주 안쪽은 깨끗한 어둠. 안은 같은 높이로 이어지는 어두운 통로(바닥이 안쪽으로 사라짐).
DOOR2_SHUT = [
    '................',
    '......555z......',
    '455555544444421z',
    'z433445ba2233100',
    '.43345cbba233100',
    '54335cbbcba23100',
    '5435dcbdcbdc2100',
    '535edcbedcbed100',
    '54cdcbedcbedcb10',
    '54lkkkkkkkkjcbz.',
    '54hhhhhhhhhgcb10',
    '42cdcbedcbedcb00',
    'z4cdcbedcbedcb10',
    '.4cdkbedkbedkb10',
    '.4cdcbedcbedcb10',
    '54cdcbedcbedcb10',
    '42lkkkkkkkkjcb00',
    '54hhhhhhhhhgcb10',
    '54cdcbedckedcbz.',
    '54cdcbedjahdcb10',
    'z4cdcbedkchdcb10',
    '.2cdcbedchedcb00',
    '54cdkbedkbedkb10',
    '53lkkkkkkkkjcb10',
    '54hhhhhhhhhgcb10',
    '54cdcbedcbedcbz.',
    '55cdcbedcbedcbz.',
    '44cbacbacbacba10',
    '43cbacbacbacba10',
    '32babababababa00',
    '5444444444444210',
    'z000000000000000',
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
    '..e;;;;;;;;;;;..',
    '..ec;;;;;;;;;;..',
    '..lkh;;;;;;;;;..',
    '..ecba::::::::..',
    '..ecba::::::::..',
    '..ecba::::::::..',
    '..ecba::::::::..',
    '..ecba::::::::..',
    '..ecba::::::::..',
    '..lkhg::::::::..',
    '..ecba,,,,,,,,..',
    '..ecka,,,,,,,,..',
    '..ecba,,,,,,,,..',
    '..ecba,,,,,,,,..',
    '..ecba,,,,,,,,..',
    '..lkhg,,,,,,,,..',
    '..ecba11111111..',
    '..ecba11111111..',
    '..ecba11111111..',
    '..ecb222222222..',
    '..ec2222222222..',
    '..e22222222222..',
    '................',
    '................',
]


# 문틀은 동굴 바위(crock)로 칠한다 — 밝은 다듬은 돌이 아니라 굴 벽에 앉은 거친 바위 틀. 오른쪽 문설주가 왼쪽보다 어둡다.
DOOR_LEG = leg(**{'0': ('crock', 1), '1': ('crock', 2), '2': ('crock', 3), '3': ('crock', 4), '4': ('crock', 5), '5': ('crock', 6)})


def door(rows, mask, inside, opened):
    return g(fill_region(rows, mask, inside) if opened else rows, DOOR_LEG)


# ================================================================================================ 레버 (1×1 둘: 올림 | 내림)
# 둘 다 벽면(2줄 벽)에 박힌 붙박이: 어두운 홈 + 작은 받침만 두고, 상태는 길고 밝은 자루 + 밝은 손잡이가 굴대 위로 곧게 서느냐(올림)
# 아래로 곧게 내려가느냐(내림)로만 읽힌다(대각선 아님).
# A1 쇠 테두리 홈(위·왼쪽 테 밝음, 안은 깊은 어둠) + 가운데 쇠 굴대 받침(놋쇠 핀). 밝은 나무 자루 2px + 놋쇠 손잡이.
# A2 바위에 판 좁은 홈(바위 입술) + 위·아래 쇠 멈춤쇠 + 쇠 띠 굴대. 밝은 나무 자루 3px + 뼈빛 손잡이.
LEVER1_UP_ROWS = [
    '.....g.rm.g.....',
    '....i:rqqp:g....',
    '....i:qppn;g....',
    '....i:;fd;;g....',
    '....i:;fd;;g....',
    '....i:;fd;;g....',
    '....i:;fd;;g....',
    '...klllqlkhg....',
    '...gkjjnjhgg....',
    '....i:;;;;;g....',
    '....i:;;;;;g....',
    '....i:;;;;;g....',
    '....i:;;;;;g....',
    '....i:;;;;;g....',
    '....g:;;;;;g....',
    '.....gggggg.....',
]
LEVER1_DOWN_ROWS = [
    '.....iiiiig.....',
    '....i::::::g....',
    '....i:;;;;;g....',
    '....i:;;;;;g....',
    '....i:;;;;;g....',
    '....i:;;;;;g....',
    '....i:;;;;;g....',
    '...klllqlkhg....',
    '...gkjjnjhgg....',
    '....i:;fd;;g....',
    '....i:;fd;;g....',
    '....i:;fd;;g....',
    '....i:;fd;;g....',
    '....i:rqqp;g....',
    '....g:mppm;g....',
    '.....g.mm.g.....',
]
LEVER2_UP_ROWS = [
    '.......wz.......',
    '....g4wwwv1g....',
    '.....4vvtsz.....',
    '.....4,fecz.....',
    '.....4,fecz.....',
    '.....3,fec0.....',
    '.....4,fecz.....',
    '....llllhlg.....',
    '....gjjjjjg.....',
    '.....4,;;;z.....',
    '.....3,;;;0.....',
    '.....4,;;;z.....',
    '.....4,;;;z.....',
    '.....4,;;;z.....',
    '....gz,;;;zg....',
    '......0000......',
]
LEVER2_DOWN_ROWS = [
    '......455z......',
    '....g4,;;;1g....',
    '.....4,;;;z.....',
    '.....4,;;;z.....',
    '.....4,;;;z.....',
    '.....3,;;;0.....',
    '.....4,;;;z.....',
    '....llllhlg.....',
    '....gjjjjjg.....',
    '.....4,fecz.....',
    '.....3,fec0.....',
    '.....4,fecz.....',
    '.....4,fecz.....',
    '.....4wwwvz.....',
    '....gzzvtzzg....',
    '.......zz.......',
]


LEVER1_LEG = leg(m=('gold', 0), n=('gold', 1), p=('gold', 3), q=('gold', 4), r=('gold', 5))


def lever1(up):
    return g(LEVER1_UP_ROWS if up else LEVER1_DOWN_ROWS, LEVER1_LEG)


def lever2(up):
    return g(LEVER2_UP_ROWS if up else LEVER2_DOWN_ROWS, DOOR_LEG)


# ================================================================================================ 뼈 더미 · 약탈품 더미 (1×1 둘)
LOOT_LEG = leg(m=('gold', 0), n=('gold', 1), o=('gold', 2), p=('gold', 3), q=('gold', 4), r=('gold', 5),
               X=('cfloor', 0), A=('cfloor', 1), B=('cfloor', 2), C=('cfloor', 4), D=('cfloor', 6), E=('cfloor', 7),
               **{'6': ('rim', 1), '7': ('rim', 2), '8': ('rim', 3), '9': ('rim', 4)})

# 더미 둘 다 3/4 무더기: 어두운 흙·때 둔덕(rim 0~3, 그늘 쪽 가장 어두운 단) 위에 뼈·물건이 엉켜 얹혀 있다 — 둔덕 윗면은 밝은 rim 3, 밑단은 rim 0.
# 뼈는 빛 쪽 bone 4·3 → 그늘 쪽 bone 1·0 → 둔덕 그늘로 내려간다. 접지 그림자(~)를 함께 둔다.
# A1 뼈: 사람 뼈 무더기 — 둔덕 위 해골(정면, 눈구멍) · 비스듬히 솟은 긴 뼈 · 앞을 가로지르는 넓적다리뼈 · 반쯤 묻힌 둘째 해골 · 갈비 조각.
BONES1 = [
    '................',
    '................',
    '............vz..',
    '...vwwz....vwz..',
    '..vwwwwz..vwz...',
    '..wzwwzz.vwz....',
    '..vwwzwu8wu88z..',
    '..8tvtv8wu887zz.',
    '.87v8v8wu8vwwvz.',
    '.78w7w7wu7wzwzsz',
    'vw77677u7vwwzwtz',
    'wwwwwwwwv6tvtvsz',
    'zu6666uu67666zzz',
    '.zzzzzzzzzzzzzz.',
    '...~~~~~~~~~~...',
    '.....~~~~~~.....',
]
# A1 약탈품: 입이 열린 밝은 삼베 자루(접힌 입술 · 안에 금화 · 묶은 끈)에서 금화가 흘러나와 앞에 무더기를 이루고,
# 오른쪽에 따로 떨어져 꽂힌 칼(밝은 날 · 코등이 · 손잡이)이 제 윤곽을 가진다. 밑은 부분 접지 그림자.
LOOT1 = [
    '................',
    '.............b..',
    '.............b..',
    '...C6.6.....hlhh',
    '.CDEEDD6.....h..',
    '.Dqrqrqz.....lh.',
    'CDEbEDDqn....lg.',
    'DEEbDDCBqn...lg.',
    'DEEDDCCzrm...lg.',
    'DEDDCCz.qrn..lg.',
    '6DDCCBqrqqm..lg.',
    '.6zCBqpqrpqn.lg.',
    '~~~nqpqropqm.hg.',
    '....nmmmmmm~~~~~',
    '..~~~~~~~~~~~...',
    '.....~~~~~......',
]
# A2 뼈: 밝은 윗면의 흙 둔덕 위에 굵은 긴 뼈 셋(2px 몸통 · 뭉툭한 끝)이 겹쳐 쌓이고, 왼쪽 위에 뿔 달린 짐승 머리뼈
# (밝은 정수리 · 눈구멍 둘 · 콧구멍 · 이빨)가 얹힌다. 밑은 부분 접지 그림자.
BONES2 = [
    '.z.......z......',
    '.zz.....sz......',
    '..vwwwwwz.......',
    '.vwwwwwwwz......',
    '.wzzwwwzzz......',
    '.zzzwwwzzzvz....',
    '..zwwzwwz.wwz...',
    '...vwzwz..vtz...',
    '...wtwtz..wsz...',
    '...zstswwwvtzz..',
    '.vz.swtwww8z.vz.',
    '.wwvttttttwvwwwz',
    '.ztt877777twwvtz',
    '..zzzzzzzzzztzz.',
    '...~~~~~~~~~z...',
    '.....~~~~~~.....',
]
# A2 약탈품: 밝은 뚜껑 윗면(3/4)이 보이는 나무 궤짝(앞면 널 · 쇠 띠 · 자물쇠) · 앞 오른쪽 금화 무더기 ·
# 궤짝 오른쪽에 기대 선 창(쇠 날이 위로) — 무기 둘레에 빈자리. 밑은 부분 접지 그림자.
LOOT2 = [
    '.............g..',
    '.............lg.',
    '.............kg.',
    '.............g..',
    '.fffffffa.....a.',
    '.feeeeeea....da.',
    '.eeeeeeea....da.',
    '.ddddddca...da..',
    '.jcccbcccg..da..',
    '.jcckhcbcg.da...',
    '.jccbccbam.da...',
    '.gbbabba..qm....',
    '..aaaaa.qrqqm...',
    '.~~~~~qpqrpom...',
    '..~~~~mmmmmm....',
    '....~~~~~~~~~...',
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
    '................',
    '...554...455....',
    '.543221zz1224z..',
    '5432zzzzzzzz332z',
    'zz10zzzzzzzz1100',
    '..zzzzzzzzzzzz..',
    '...zzzzzzzzzz...',
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
    '................',
    '....fe....ef....',
    '...fedc..cdef...',
    '..fedcbaabcdef..',
    '....cbaaaabc....',
    '544325543455543z',
    'zzz00zzz0zzzzzz0',
    '................',
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
    '................',
    '.....55..455....',
    '.5545443z34432..',
    '5443221zz11105z.',
    'z210zzzzzzzzz43z',
    '..zzzzzzzzzzz10.',
    '...zzzzzzzzzz...',
    '......zzzz......',
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
    '..............Tz',
    '.............UTa',
    '...f.......e..a.',
    '...ed.....ed.b..',
    '....dc.a.cd.....',
    '.5543bba.ab554z.',
    '54433.5554.4433z',
    'zzzz0544433zzz00',
    '.....zzzz00.....',
    '................',
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

# A1 굵고 거친 말뚝(폭 5·5·4, 끝 높이 들쭉날쭉, 하나는 오른쪽·하나는 왼쪽으로 기욺 — 기운 자리는 밧줄 감김 밑에서 꺾임).
# 깎은 끝의 생나무 면(E·D)이 위로 보이고 몸통은 껍질(e~a, 결과 옹이). 밧줄은 난간이 아니라 말뚝마다 따로 감긴 매듭(높이도 제각각).
# 밑동은 흙 둔덕(rim 2~3 윗면 → rim 0) + 그림자. 가운데 조각의 한 말뚝이 16px 이음을 걸쳐(오른쪽 끝 → 다음 조각 왼쪽) 이음에 틈이 없다.
# 서끝·동끝 = 키 큰 굵은 모서리 기둥(폭 6, 매듭 둘 + 늘어진 밧줄 끝)으로 울이 끝난다.
PAL1_MID = [
    '................',
    '.....z..........',
    '....EDa.........',
    '....EDca........',
    '....dcba.......z',
    'a...edca......Ez',
    'ca..dcca.z...EDz',
    'ba..edbaEDa..dca',
    'ba..dcbEDDca.eda',
    'ba..CDCddcba.dca',
    'ba.dzBzedbba.eda',
    'ba.edbaddcba.dca',
    'Cz.dcbaedbba.DCz',
    'zz.edcaddcba.Bzz',
    'ba.dccaDCDCz.eda',
    'ba.edbazzBzzadca',
    'ba.dcba.edbbaeda',
    'ba.edca.ddcbadca',
    'ba.dcca.edbbaeda',
    'ba.edba.ddcbadca',
    'ba.DCDz.edbbaeda',
    'ba.BzBz.ddcbadca',
    'Cz.dcca.edbbaDCz',
    'zz.edba.CDCDCBzz',
    'ba.dcba.zBzBzeda',
    'ba.edca.ddcbadca',
    'ba.dcca.edbbaeda',
    'ba.edba.ddcbadca',
    'b87dcb87edb8aeda',
    '877877877877877z',
    '666666666666666z',
    'zzzzzzzzzzzzzzzz',
]
PAL1_WEST = [
    '..Ez............',
    '.EDDa...........',
    'EDDdca..........',
    'edcbba..........',
    'eddcba.........z',
    'edccba........Ez',
    'ddcbba...z...EDz',
    'edcbba..EDa..dca',
    'DCDCDz.EDDca.eda',
    'BzBzBz.ddcba.dca',
    'dCcbba.edbba.eda',
    'eBcbba.ddcba.dca',
    'eBdcba.edbba.DCz',
    'edccba.ddcba.Bzz',
    'ddcbba.DCDCz.eda',
    'edcbba.zzBzzadca',
    'eddcba..edbbaeda',
    'edccba..ddcbadca',
    'ddcbba..edbbaeda',
    'DCDCDz..ddcbadca',
    'BzBzBz..edbbaeda',
    'eCccba..ddcbadca',
    'dBcbba..edbbaDCz',
    'eBcbba..CDCDCBzz',
    'eddcba..zBzBzeda',
    'edccba..ddcbadca',
    'ddcbba..edbbaeda',
    'edcbba..ddcbadca',
    'e8dcba87edb8aeda',
    '877877877877877z',
    '666666666666666z',
    'zzzzzzzzzzzzzzzz',
]
PAL1_EAST = [
    '..........Ez....',
    '.....z...EDDa...',
    '....EDa.EDDdca..',
    '....EDcbedcbba..',
    '....dcbaeddcba..',
    'a...edcaedccba..',
    'ca..dccaddcbba..',
    'ba..edbaedcbba..',
    'ba..dcbaDCDCDz..',
    'ba..CDCDBzBzBz..',
    'ba.dzBzzddcbCa..',
    'ba.edba.edcbBa..',
    'Cz.dcba.eddcBa..',
    'zz.edca.edccba..',
    'ba.dcca.ddcbba..',
    'ba.edba.edcbba..',
    'ba.dcba.eddcba..',
    'ba.edca.edccba..',
    'ba.dcca.ddcbba..',
    'ba.edba.DCDCDz..',
    'ba.DCDz.BzBzBz..',
    'ba.BzBz.edccCa..',
    'Cz.dcca.ddcbBa..',
    'zz.edba.edcbBa..',
    'ba.dcba.eddcba..',
    'ba.edca.edccba..',
    'ba.dcca.ddcbba..',
    'ba.edba.edcbba..',
    'b87dcb87edd8ba..',
    '8778778778778z..',
    '6666666666666z..',
    'zzzzzzzzzzzzzz..',
]

# A2 엇갈린 말뚝 울: 가는 깎은 말뚝 두 개씩이 서로 반대로 기울어 X 로 엇갈리고(끝은 V 로 벌어짐), 엇갈린 자리를 밧줄로 묶었다.
# 짝 사이로 빈틈이 보이고, 가운데 높이에 울퉁불퉁한 가로 장대 하나를 말뚝마다 묶었다. 끝 조각 = 곧은 기둥 꼭대기에 꿴 해골.
PAL2_MID = [
    '................',
    '......z.........',
    '......Dz.z......',
    '.z...edbEz......',
    'zz...edaada...z.',
    '.dcbdca..eda.Dz.',
    '.edbeda..edbeda.',
    '.edbeda..dcbdca.',
    '.edbeda..edbeda.',
    '.edbeda..edbeda.',
    '.acbdca..adbeda.',
    '..edba....edba..',
    '..edba....dcba..',
    '..edba....edba..',
    '..eCDz....eCDz..',
    '..dCDz....eCDz..',
    '..Ceda....eedbz.',
    'feDefbz...CefeDa',
    'aaBbbeDefeDbbbza',
    '..eedbzaaaBeda..',
    '..ddca....eeda..',
    '.edbeda..edbeda.',
    '.edbeda..dcbdca.',
    '.edbeda..edbeda.',
    '.edbeda..edbeda.',
    '.dcbdca..edbeda.',
    '.edaada..edaada.',
    'eda..edbdca..dca',
    'eda..edbeda..eda',
    'edb77edbedb77eda',
    '877787778777877z',
    'zzzzzzzzzzzzzzzz',
]
PAL2_WEST = [
    '..z.............',
    '.EDa............',
    '.EDca....z......',
    '.edca...Ez......',
    '.ddca...ada...z.',
    '.edba....eda.Dz.',
    '.edca....edbeda.',
    '.ddca....dcbdca.',
    '.edba....edbeda.',
    '.edca....edbeda.',
    '.ddca....adbeda.',
    '.edba.....edba..',
    '.edca.....dcba..',
    '.ddca.....edba..',
    '.edba.....eCDz..',
    '.edca.....eCDz..',
    '.dCca.....eedbz.',
    '.eDea.z...CefeDa',
    '.bBbbeDefeDbbbza',
    '.ddcbazaaaBeda..',
    '.edba.....eeda..',
    '.edca....edbeda.',
    '.ddca....dcbdca.',
    '.edba....edbeda.',
    '.edca....edbeda.',
    '.ddca....edbeda.',
    '.edba....edaada.',
    '.edca...dca..dca',
    '.ddca...eda..eda',
    '.edba777edb77eda',
    '.77787778777877z',
    '.zzzzzzzzzzzzzzz',
]
PAL2_EAST = [
    '..........z.....',
    '......z..EDa....',
    '......Dz.EDca...',
    '.z...eda.edca...',
    'zz...eda.ddca...',
    '.dcbdca..edba...',
    '.edbeda..edca...',
    '.edbeda..ddca...',
    '.edbeda..edba...',
    '.edbeda..edca...',
    '.acbdca..ddca...',
    '..edba...edba...',
    '..edba...edca...',
    '..edba...ddca...',
    '..eCDz...edba...',
    '..dCDz...edca...',
    '..Ceda...ddca...',
    'feDefbz..eCea...',
    'aaBbbeDefeDba...',
    '..eedbzaabBca...',
    '..ddca...edba...',
    '.edbeda..edca...',
    '.edbeda..ddca...',
    '.edbeda..edba...',
    '.edbeda..edca...',
    '.dcbdca..ddca...',
    '.edaada..edba...',
    'eda..eda.edca...',
    'eda..eda.ddca...',
    'edb77edb7edba...',
    '877787778777z...',
    'zzzzzzzzzzzzz...',
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
    '.............ECDDDDDDDBscfAXXXXXXX6z............',
    '............EDwCCDDDDDvwwwvXXXXX66XXz...........',
    '...........EwbDcDCCDvwwwwwvtXX66XXXXXz..........',
    '..........EwcbcbcDDCwzzwzzvtA6XXXXXXXXz.........',
    '..........EwbcdcbDDwwzzwzztsAvXXXXXXXXz.........',
    '.........EwcbccbcDDBvwwvwwtsfAXXXXXX66Xz........',
    '........EDwbcbcbcDBfdvwzwtsddfAXXX66XXXXz.......',
    '........EDDwvwvwCwBfewtwtscddbAv6CCCXXXXz.......',
    '.......EDDDDDDDDDBfeeesdsddcddfAXCDCCXXXXz......',
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
    '.......~zz6zzzz6zzzz6zzzz6zzzz6zzzzzzzzz6zzz~...',
    '.......~~~~~z6~z~~z~~z~~z~~z~~z~~z~Xz~~z~~~~~...',
    '............~~~~~~~~~~~~~~~~~~~~~~~~~~~~~.......',
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
    '...ebccebCDCCCCCCBB76;;;;;;;AAwtuutwAdbAacAAac..',
    '...bDwebbCCCCCCCBB76;;;;;;;;;AAAAAAAAdbAAacAAa..',
    '...DDcbcbCCCCCCBBB86;;;;;;;;;AAAAAAAAdbAAAaAAX..',
    '...DDecbwCCCCCBBB76;;;;;;;;;;;AAAAAAAdbAAAAcAX..',
    '...DDbCCCCCCCBBBB76;;;;;;;;;;;AAAAAAAdbAAAAaAX..',
    '...DeCCCCCCCBBBB86:::::::::::::AAAAAAdbAAAAAcX..',
    '...ebCCCCBCBBBBB76:::::::::::::AAAAAAdbAAAAAac..',
    '...bCCCCBCBBBBBB76:::::::::::::AAAAAAdbAAAAAAa..',
    '...AACCBCBBBBBBB86:::::::::::::AAAAAAdbAAAAAXX..',
    '...~~~AABBBBBBBB76:::::::::::::AAAAAAdbAAXX~~~..',
    '...~~~A~.AABBBBA76,,,,,,,,,,,,,AAAAAAdbX.X~~~~..',
    '...~~~~~~A~~AAA.86,,,QRQ,,,,,,,AAAX.Xdb~~~~~~~..',
    '......~~~X~~~A~~A6,,RQRQ,,,,,,,X~X~~~db~~~~.....',
    '........~~~~~~~~~~~~~~~~~~~~~~~~~~~~~db~~.......',
    '............~~~~~~~~~~~~~~~~~~~~~~~~~...........',
    '.................~~~~~~~~~~~~~~~................',
    '................................................',
]
TENT2_LEG = leg(X=('moss', 0), A=('moss', 1), B=('moss', 2), C=('moss', 3), D=('moss', 4), E=('moss', 5),
                Q=('cfloor', 1), R=('cfloor', 2), **{'6': ('rim', 1), '7': ('rim', 2), '8': ('rim', 3), '9': ('rim', 4)})


def tent(rows):
    return g(rows, TENT2_LEG if rows is TENT2 else TENT_LEG)


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
        'A1': '둥근 아치 — 굴 바위 틀(거친 바깥 모서리 · 오른쪽 문설주가 더 어두움 · 위로 벽 2px 남기고 쐐기돌만 솟음) + 2단 문턱, 세로 널 넷 문짝(왼쪽 들어간 그늘) + 쇠띠 둘 + 쇠고리. 열림: 문짝이 왼쪽 안으로 젖혀지고 안은 짙은 어둠 + 사라지는 바닥. 통로 12px·높이 27px',
        'A2': '뾰족 아치 + 한 줄 처마돌(위로 벽 2px) 거친 바위 틀(오른쪽 어두움), 받침돌. 넓은 널 셋 + 긴 경첩 띠 셋 + 징 + 고리 문고리. 열림: 문짝 하나가 왼쪽 문설주 쪽 안으로 젖혀져 원근으로 좁아진 널·쇠띠가 보이고 오른쪽 문설주 안쪽은 깨끗함, 안은 같은 높이의 어두운 통로(계단 없음)',
    },
    'gap.lever': {
        'A1': '벽면에 박은 쇠 테두리 홈(위·왼쪽 테 밝음, 안은 깊은 어둠) + 가운데 작은 쇠 굴대 받침. 밝은 나무 자루(2px) + 밝은 놋쇠 손잡이. 올림 = 자루가 굴대 위로 곧게 서고 손잡이가 홈 맨 위 · 내림 = 곧게 아래로, 손잡이가 홈 맨 아래',
        'A2': '바위에 판 좁은 홈(바위 입술, 안은 어둠) + 위·아래 쇠 멈춤쇠 + 가운데 쇠 띠 굴대. 밝은 나무 자루(3px) + 뼈빛 손잡이. 올림 = 곧게 위로 · 내림 = 곧게 아래로',
    },
    'gap.goblin_tent': {
        'A1': '용마루 천막(막대 셋: 앞 X + 뒤 하나). 왼 지붕면 빛·오른 지붕면 그늘이 위에서 보이고 남쪽 박공이 앞면. 기운 가죽 조각 넷·꿰맨 땀·뿔·앞 꼭짓점 밑에 매단 큰 해골·이빨 줄·붉은 발톱 칠·뜯긴 밑단. 장면 = 같은 번호 소품으로 꾸민 고블린 야영 굴(세 줄)',
        'A2': '가죽 둔덕 움막 — 휜 막대 고리 셋 위에 이끼 낀 녹갈색 가죽을 덮어 꿰맴(윗면 빛·오른쪽 아래 그늘). 덧댄 갈색·뼈빛 가죽 조각, 꼭대기 뿔 달린 짐승 머리뼈, 막대에 꽂은 해골, 입구 위에 매단 뼈, 반타원 입구, 뜯긴 밑단. 장면 = 같은 번호 소품의 야영 굴',
    },
    'gap.bone_pile': {
        'A1': '뼈: 어두운 흙 둔덕 위 사람 뼈 무더기(해골 둘·솟은 긴 뼈·넓적다리뼈·갈비) · 약탈품: 입이 열린 밝은 삼베 자루에서 금화가 흘러 앞에 무더기 + 오른쪽에 따로 꽂힌 칼. 둘 다 밑은 부분 접지 그림자',
        'A2': '뼈: 밝은 윗면 흙 둔덕 위에 굵은 긴 뼈 셋(뭉툭한 끝) + 왼쪽 위 뿔 달린 짐승 머리뼈(눈구멍 둘·콧구멍·이빨) · 약탈품: 밝은 뚜껑 윗면 궤짝(쇠 띠·자물쇠) + 금화 무더기 + 궤짝에 기댄 창. 밑은 부분 접지 그림자',
    },
    'gap.palisade': {
        'A1': '거친 고블린 말뚝 울 — 굵은 말뚝(폭 4~5), 끝 높이 들쭉날쭉, 기운 말뚝, 껍질 결, 말뚝마다 따로 감긴 밧줄, 흙 둔덕 밑동. 한 말뚝이 16px 이음을 걸쳐 이음 틈 없음. 서끝·동끝 = 키 큰 굵은 모서리 기둥(매듭 둘 + 늘어진 밧줄)',
        'A2': '엇갈린 말뚝 울 — 가는 깎은 말뚝 두 개씩이 반대로 기울어 X 로 엇갈리고(끝은 V), 엇갈린 자리를 밧줄로 묶음. 짝 사이 빈틈, 가운데 높이에 울퉁불퉁한 가로 장대 하나를 말뚝마다 묶음. 끝 기둥 꼭대기에 꿴 해골',
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
