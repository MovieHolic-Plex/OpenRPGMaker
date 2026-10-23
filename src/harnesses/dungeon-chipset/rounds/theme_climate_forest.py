"""theme-climate forest — 숲 던전 조각(2026-10-23): 거목·버섯 고리·이끼 바위·가시덤불·길돌.

모든 화소는 이 파일의 행 문자열에서 온다(손 도트). 수관은 손으로 그린 잎 덩이(clump) 몇 개를 손으로 고른 자리에 겹쳐 찍고,
덩이의 밝기 단은 글자 바꾸기(한 단 내리기)로만 바꾼다 — 잡음 함수·도형 마스크 본체 없음.
범례(기물마다 공통 약속):
  잎 '0'~'6' = leaf 0~6 · 나무 p q r s t u = wood 0~5 · 돌 A B C D E F = stone 0~5 · 바위 G H I J K L M = crock 0~6
  · 이끼 a b c d e f = moss 0~5 · 늪 g h i = bog 0~2 · 이끼꽃(지의류) X Y = bog 5~6 · 붉은 S T U V W = red 0~4 · 뼈 v w x y z = bone 0~4
  · 빛 N O P Q R Z = glow 0~5 · 쇠 j k l = iron 1,3,5 · 불 m n o = fire 2,4,5 · 공허 ; : = void 0,1 · '~' 접지 그림자
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dot  # noqa: E402
import theme_climate_lib as L  # noqa: E402
from dot import Cv  # noqa: E402

T = 16
_B = {}
for _r, _c in (('leaf', '0123456'), ('wood', 'pqrstu'), ('stone', 'ABCDEF'), ('crock', 'GHIJKLM'), ('moss', 'abcdef'),
               ('bog', 'ghi'), ('red', 'STUVW'), ('bone', 'vwxyz'), ('glow', 'NOPQRZ')):
    _B.update(L.ramp_chars(_r, _c))
_B.update(X=('bog', 5), Y=('bog', 6), j=('iron', 1), k=('iron', 3), l=('iron', 5), m=('fire', 2), n=('fire', 4), o=('fire', 5),
          **{';': ('void', 0), ':': ('void', 1)})
LG = L.legend(**_B)


def g(rows):
    return L.g(rows, LG)


def put(cv, rows, x, y):
    L.put(cv, rows, LG, x, y)
    return cv


def dim(rows, k=1, floor='1'):
    """잎 덩이 글자 한 단(k) 어둡게 — '6'→'5' … 바닥 floor 아래로는 안 내림. 잎 숫자 밖 글자는 그대로."""
    lo = int(floor)
    tr = {str(d): str(min(6, max(lo, d - k))) for d in range(7)}
    if k > 0:
        tr.update({str(d): str(d) for d in range(lo)})
    return [''.join(tr.get(c, c) for c in r) for r in rows]


# ================================================================================================ 잎 덩이(손 그림)
# 밝은 판(위·왼 빛). 바닥 쪽 초승달 그늘 2~1 이 아래 덩이 위에 겹쳐 '어두운 주머니'가 된다.
CL_A = [  # 18×14 큰 덩이, 혹 셋 — 가장자리 잎끝 톱니, 속은 잎 무늬 반점
    '.....5.566.5.56...',
    '...5566665665.5...',
    '..5666566665654...',
    '.5665665655565544.',
    '5.66566555665554..',
    '.565655455655443..',
    '56555456554554443.',
    '5555455454545444434',
    '45545444554444433.',
    '.45444544434443332',
    '4444434443443433332',
    '.3443443433343322.',
    '..33433333332222..',
    '...3.2222322212...',
    '.....2.2122.1.....',
]
CL_B = [  # 15×11 중간 덩이
    '....56.5.5.....',
    '..55666656554..',
    '.5665565655544.',
    '5665565455544.3',
    '.6555454554443.',
    '555545445444433',
    '4554444544433332',
    '.4443444433433.',
    '..34333433322..',
    '..3.3332222.1..',
    '....2.2212.....',
]
CL_C = [  # 11×9 작은 덩이
    '...56.6....',
    '.5566565...',
    '5665655554.',
    '.655455443.',
    '5554545433.',
    '45444443332',
    '.443433332.',
    '..332.222..',
    '...2.21....',
]
CL_D = [  # 8×7 잔 덩이(가장자리 혹)
    '..5.65..',
    '.566554.',
    '5655443.',
    '.554433.',
    '4443432.',
    '.33.22..',
    '...21...',
]
CL_E = [  # 14×10 넓적 덩이(아래 띠)
    '...5.55..5.5..',
    '.556665556554.',
    '5665565565544.',
    '.555455454443.',
    '45544454444332',
    '44434444343332',
    '.4434343333322',
    '..33.33332222.',
    '...222.22211..',
    '.....1.11.....',
]
CL_F = [  # 16×12 늘어진 덩이(빛 띠 비스듬)
    '......56.5......',
    '...5.566665.5...',
    '..5666565665....',
    '.56656555655544.',
    '565565545555443.',
    '.55545455454443.',
    '4555444544443433',
    '.444434443443332',
    '.44343434333332.',
    '..333333332322..',
    '...2.3222221....',
    '.....2.1.21.....',
]


def _norm(rows):
    w = max(len(r) for r in rows)
    return [r.ljust(w, '.') for r in rows]


CLUMPS = {k: _norm(v) for k, v in dict(A=CL_A, B=CL_B, C=CL_C, D=CL_D, E=CL_E, F=CL_F).items()}


def canopy(cv, plan):
    """plan: [(덩이, 어둡게 k, x, y)] — 뒤(먼저)→앞(나중) 순서로 손으로 고른 자리."""
    for name, k, x, y in plan:
        rows = CLUMPS[name]
        put(cv, dim(rows, k) if k else rows, x, y)
    return cv


def preview(cv, path, k=4, bg=(60, 62, 70, 255)):
    from PIL import Image
    im = cv.img()
    b = Image.new('RGBA', im.size, bg)
    b.alpha_composite(im)
    b.resize((im.width * k, im.height * k), Image.NEAREST).save(path)




# ================================================================================================ 거목 6×7 (96×112)
# A2 줄기: 비틀린 고목(나선 결), 문틀 자리 — 위에 나무 문(DOOR_A2)을 얹는다.
TRUNK_A2 = [
 '........................................tsrqqtsrrqtusrqqpqrqpp',
 '........................................usrqtsrrqqusrqqtsrqqpp',
 '.......................................tsrqqusrqqtusrqtsrqqrpp',
 '.......................................usrqtsrrqtusrqqusrqqrqpp',
 '......................................tsrqqusrqqusrqqtsrqqrqqpp',
 '......................................usrqtsrrqtusrqtusrqqrqqpp',
 '.....................................tusrqusrqqusrqqtsrqqrqqqpp',
 '.....................................usrqtsrrqtsrqqusrqqrqqqppp',
 '....................................tusrqusrqqtsrqtusrqqrqqqppp',
 '....................................usrqtsrrqtsrqqusrqqrqqqqppp',
 '...................................tusrqusrqqtsrqtusrqqrqqqqppp',
 '...................................usrqtsrrqpppppppqqrqqrqqqqpp',
 '..................................tusrqusrqppqqqqqppprqqrqqqqppp',
 '..................................usrqtsrqppqttsrrqqpprqqrqqqqpp',
 '.................................tusrqusrqpqtusrrssqqpqqrqqqqqpp',
 '.................................usrqtsrqppqtsrqtsrqqqppqrqqqqpp',
 '................................tusrqusrqpqttsrqtsrrqqqppqqrqqqpp',
 '................................usrqtsrrqpqtusrqtsrrqqqpprqqrqqqpp',
 '...............................tusrqusrqpqtusrqqtsrrqqqqpprqqqqqpp',
 '...............................usrqtsrrqpqtsrrqtsrrqqqqqpprqqrqqpp',
 '..............................tusrqusrqpqttsrqqtsrqqrqqqqpprqqqqqpp',
 '..............................usrqtsrrqpqtusrqqtsrqqrqqqqppqrqqrqqpp',
 '.............................tusrqusrqpqtrrrrrrrrrrrrrqqqqppqrqqqqqpp',
 '.............................usrqtsrrqpqttrrqtsrqqtqqqqqqppqqrqqqqqpp',
 '............................tusrqusrqpqttsrqqtsrrqqqrqqqqppqrqqrqqqqpp',
 '...........................uttsrqqsrqpqtusrqqtsrrqqqrqqqqppqqrqqqqqqpp',
 '.........................uuttsrqqtsrqpqtusrqqtsrqtrqrqqqqppqrqqqrqqqqppp',
 '......................uuuttsrrqqtusrqpqttsrqqtsrqqqqrqqqqppqqrqqqqrqqqqpp',
 '..................4545uttsrrqqqtusrrqpqtusrqqtsrrqqqrqqqqppqrqqqqqrqqqqqpp',
 '...............45uuttsrrqqp.utsrrqqpqtusrqqtsrrqqqrqqqqppqqrrqqqqqqrqqqqqpp',
 '............4uuttsrrqqpp...usrrqqqpqttsrqqtsrqqrqqqqqppqqsrrqqqqqqqqqrqqqppp',
 '.........4uuttsrqqpp.....usrrqqp.pqtrrrrrrrrrrrrrqqqqppqqp.qsrrqqqqqqqqqqqqpp',
 '......45uuttsrqqpp......utsrqqp..pqttrrqtsrqqtqqqqqqppqp....qqssrrqqqqqqqqqpp',
 '....4uuttsrrqpp........utsrqqp...pqtusrqqtsrrqqqrqqqqppp.......qqsrrrqqqqqqpp',
 '...uuttsrqqpp........45utsrqp....pqtusrqqtsrrqqqrqqqqppp.........qqssrrqqqqpp',
 '..utsrrqpp.........45uutsrqp.....pqttsrqqtsrrqqqrqqqqppp...........qqsrrqqqqpp',
 '.utsrqpp.........45uuttsrqp......pqtusrqqtsrqqrqrqqqqppp.............qqsrqqqpp.',
 '.qqpp..........45uuttssrqp.......pqtusrqqtsrqqrqrqqqqppp...............qqqqpp..',
 '.............45uuttssrqqp........pqttsrqqtsrqqrqqqqqqppp.................pp....',
 '...........4uuttssrqqpp.........ppqqqqqqqqqqqqqqqqqqqppp.......................',
 '..........uuttsrrqqpp...........;ppppppppppppppppppppp;;.......................',
]
SHADOW_A2 = [
 '........~~~~~~~~~..............~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~...',
 '.............~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~.......',
]

def _sil(cv, sil, x0=0, y0=0, ch='1'):
    rows = [''.join((ch if c == 'X' else '.') * 4 for c in r) for r in sil for _ in range(4)]
    put(cv, rows, x0, y0)


# ------------------------------------------------------------------ A1 (round 2): 버들항 d43edd 처럼 잎 송이 덩이 여럿 + 틈에 가지
# 큰 덩이 셋(MA·MB·MC)과 잔 송이(ROSETTES)를 손으로 고른 자리에 겹친다. 뒤 층은 두 단 어둡게(틈 = 어두운 잎 + 가지).
MA = [
 '.......5..5.....5.......',
 '.....4.65.66..4.65......',
 '....456665665.4666.5....',
 '..5.566666566545665654..',
 '.4656665665666566656544.',
 '..566656666566656665654.',
 '.4566665656665566565543.',
 '456656655666565655655443',
 '.4565565556556556545543.',
 '45555545655455545554443.',
 '.4545554555444554544443.',
 '.34544454544454444343432',
 '..343444343444434433332.',
 '.3.3344333443343333322..',
 '..2.333.333.333.33222...',
 '....2.22.222.22.22......',
]
MB = [
 '.....5....5..5......',
 '...4.66.4.665.65....',
 '..46665466566566....',
 '.5666656666656665.4.',
 '45665665656665665654',
 '.5666566565566566543',
 '4565656655665565554.',
 '.455655455455545543.',
 '45545454454445454433',
 '.3454444344434443432',
 '..34334343343433322.',
 '.3.33.3332.333.22...',
 '...2..2.2...2.......',
]
MC = [
 '....5..5......',
 '..4.665.65....',
 '.466656665.4..',
 '45666566665654',
 '.566565565654.',
 '45565545554543',
 '.4545454445433',
 '.3443434343432',
 '..33.333.3322.',
 '..2..2.2..2...',
]

# 잎 송이(작은 잎 다발) — 톱니 잎끝, 속에 잎 무늬. 밝은 판. 3=어두운 아래, 6=빛.
ROSETTES = {
'a': [  # 8x7
 '..5..5..',
 '.4565.4.',
 '45666654',
 '.566565.',
 '45656543',
 '.345443.',
 '..3.33..',
],
'b': [  # 6x5
 '.5.4..',
 '45665.',
 '.56654',
 '345543',
 '.3.3..',
],
'c': [  # 10x8
 '...5...5..',
 '..4664.45.',
 '.456665654',
 '45666656643',
 '.5665566543',
 '4565545543.',
 '.34544433..',
 '..3.333.3..',
],
'd': [  # 7x6
 '.4..5..',
 '.4565..',
 '4566654',
 '.456553',
 '3455443',
 '.3.33..',
],
'e': [  # 12x8 큰 송이(혹 둘)
 '..5.....5...',
 '.4664..4664.',
 '456665456654',
 '.56656666553',
 '45665565654.',
 '.4556545543.',
 '..34454433..',
 '...3.3.33...',
],
'f': [  # 5x4 잔 잎
 '.5.5.',
 '45654',
 '34543',
 '.3.3.',
],
}

LEAF = {'A': MA, 'B': MB, 'C': MC}
LEAF.update(ROSETTES)
LEAF = {k: _norm(v) for k, v in LEAF.items()}
BRANCH_Y = ['q....q', 'sq..qs', '.tq.s.', '..tsq.', '..ts..', '..tq..', '.tsq..']
BRANCH_D = ['qs....', '.tsq..', '..tsq.', '...tsq', '....tq']
CANOPY_A1_BACK = [('A',2,4,46),('A',2,30,52),('A',2,60,48),('B',2,0,30),('B',2,74,30),('A',2,20,30),('A',2,46,32),('B',2,14,14),('B',2,58,12),('A',2,34,4),('B',2,36,20),('B',2,54,20),('C',2,22,40),('B',2,44,44),('A',2,66,44),('A',2,8,56),('B',2,34,62),('B',2,62,60),('C',2,82,40),('C',2,80,20),('C',2,4,18),('C',2,28,0),('C',2,50,0),('C',2,66,2),('C',2,0,40),('C',2,84,54),('C',2,36,40),('C',2,52,52),('C',2,24,22)]
CANOPY_A1_BRANCHES = [(BRANCH_Y, 40, 22), (BRANCH_D, 22, 40), (BRANCH_Y, 48, 40), (BRANCH_D, 64, 36), (BRANCH_Y, 40, 58)]
CANOPY_A1_FRONT = [('A',1,0,54),('B',1,22,62),('C',1,46,62),('A',1,60,56),('B',1,76,50),
       ('B',0,2,40),('C',1,22,46),('A',0,62,40),('C',1,82,38),('C',0,44,46),
       ('A',0,8,24),('C',0,32,30),('B',0,50,26),('A',0,70,24),
       ('B',0,16,10),('A',0,34,12),('C',0,62,10),('B',1,76,14),
       ('C',0,26,2),('B',0,42,0),('f',0,58,4),
       ('a',0,88,30),('b',1,90,46),('d',0,0,32),('f',1,6,64),('b',1,84,62),('a',0,20,6),('f',0,70,6),('a',1,28,24),('b',0,58,22),('f',1,40,40),('a',1,74,36),('b',1,16,38),('f',0,50,58),('d',1,32,56),('b',0,8,20),('f',1,62,52),('a',0,52,8)]

# 새 줄기 A1: (x, 행) — 손으로 쓴 껍질 행을 그 줄 시작 x 에 찍는다
TRUNK3 = [
 (40, 'utsrsqrtssrqsrtsrsqqrsrqsqqrqp'),
 (40, 'tusrqrtsrrqssrsrqqsrsqrqsqrqqp'),
 (40, 'utsrsqrtsrqqstsrqsqrsrqqsrqrqp'),
 (39, 'uttsrsqrstsrqsrssrqqsrrqsqqrqqp'),
 (39, 'utsrrqsrtsqrqstsrqsrsrqqsqrqrqp'),
 (39, 'tusrsrqsrtssqrsrtsqrsrqqsqrqqrqp'),
 (38, 'uttsrrqsrtsrqprstsrqsrsrqsqqrqqqp'),
 (38, 'utssrqsrtsrqpqsrtsqsrqqsrqsqrqqqp'),
 (38, 'tusrrqssrtsrrqsrtssqrsrqqsrqsqrqqp'),
 (37, 'uttsrqsrtssrqrstsrqqsrsqrsqqrqrqqqp'),
 (37, 'utsrrqsrtsqpqrsttsrqsrrqsqqrqsqrqqqp'),
 (36, 'uttsrqssrtsqrprsrtssqrsrqqsqrqqrqqqqp'),
 (36, 'utssrrqssrtsrqrsrtsrqqsrsqqsrqqrqqqqp'),
 (35, 'uttsrrqssrtsrrqqsrtssrqsrsqqrqsqqrqqqp'),
 (34, 'uuttssrqsrtssrqpqsrtsrqqsrrqsqqrqqrqqqpp'),
 (33, 'uutssrrqssrtsrrqsqrsttsrqsrsqqrqsqrqqqqpp'),
 (32, 'uuttssrqssrtssrqqsrtsrrqsrqsqqrqqrqqrqqqpp'),
 (31, 'uutssrrqsssrtsrrqqsrtsrqsrsqrqsqqrqqrqqqqqpp'),
 (30, 'uuttssrrqssrtsrrqpqsrtssrqsrsqqrqsqrqqrqqqqqpp'),
 (29, 'uutsssrrqsssrtsrqqqsrtssrqqsrsqrqqsqrqqrqqqqqqpp'),
 (28, 'uuttssrrqqsssrtsrrqqsrtsrrqsrsqqrqsqrqqrqqqqqqqpp'),
 (27, 'uutssrrqqssssrtsrqqqsrtssrqqsrsqrqqsqrqqrqqqqqqqqpp'),
 (26, 'uuttssrqqsssrrtsrrqqqsrtssrqsrsqqrqsqqrqqrqqqqqqqqqpp'),
 (26, 'utsssrqqssrrtsrrqqqsrtsrrqqsrsqrqqsqrqqrqqqqqqqqqqpp'),
 (25, 'uttsrrqqsssrrtsrqqqsrtssrqqsrsqqrqsqrqqrqqqqqqqqqqqpp'),
 (25, 'utssrqqssrrtsrrqqqsrtsrrqqsrsqrqqsqqrqqrqqqqqqqqqqqpp'),
 (24, 'uttsrrqssrrtsrrqqqsrtssrqqsrsqqrqsqrqqrqqqqqqqqqqqqqpp'),
 (24, 'utssrqqsrrtsrrqqqqsrtsrrqqsrsqrqqsqqrqqrqqqqqqqqqqqqpp'),
 (24, 'pqqsrqqqrrqsrqqqqqqrqsrqqqqsrqqqqqqqqqrqqqqqqqqqqqqqpp'),
 (26, 'ppqqqppqqqqpqqpppqqqqqppqqqqppqqqqppqqpqqqqppqqqqppp'),
]
TRUNK3_TOP = [
 (34, 'tsq.....utsrsqrtsrqsrqq.....qsrq'),
 (35, 'tsq....tusrqrtsrrqssrqq...qsrqp'),
 (36, 'tsrq..utsrsqrtsrqqstsrqq.qsrqp'),
 (37, 'tssrqutsrrqsrtsqrqstsrqqsrqqp'),
 (38, 'utsrrtsrsqrstsrqsrssrqqsrqp'),
 (39, 'utsrsrqsrtssqrsrtsqrsrqqsqp'),
 (40, 'utsrqsrtsrqprstsrqsrsrqqsqqp'),
 (40, 'tusrqsrtsrqpqsrtsqsrqqsrqsqp'),
 (40, 'utsrssrtsrrqsrtssqrsrqqsrqsqp'),
 (40, 'utsrqsrtssrqrstsrqqsrsqrsqqrqp'),
 (40, 'tusrqsrtsqpqrsttsrqsrrqsqqrqsqp'),
 (40, 'utsrssrtsqrprsrtssqrsrqqsqrqqrqp'),
 (40, 'utsrrqssrtsrqrsrtsrqqsrsqqsrqqrqp'),
 (40, 'tusrrqssrtsrrqqsrtssrqsrsqqrqsqqrp'),
]
# 굴(문 칸): 빛 쪽 바깥 입술, 그늘진 왼 안벽, 빛 받는 오른 안벽, 위가 가장 깊고 아래로 흙바닥, 문턱 뿌리
HOLLOW3 = [
 '......tusrrq......',
 '.....tup;;;pqq....',
 '....tup;;;;;;rqq..',
 '....up;;;;;;;:sq..',
 '...tup;;;;;;;::sq.',
 '...up;;;;;;;;::rq.',
 '..tup;;;;;;;;:::sq',
 '..up;;;;;;;;;:::rq',
 '..up;;;;;;;;;::0sq',
 '..up;;;;;;;;::00rq',
 '..up;;;;;;;;:::0sq',
 '..tp;;;;;;;;::00rq',
 '..up;;;;;;;:::00sq',
 '..up;;;;;;;::00prq',
 '..tp;;;;;;:::0ppsq',
 '..up;;;;;;::0ppqrq',
 '..up;;;;;:::0pqqsq',
 '..tp;;;;:::0ppqqrq',
 '..up;;;::0ppqqqrsq',
 '..up;;::0pppqqrrsq',
 '.4tp;::0ppqqqrrssq',
 '45up::0ppqqrrssrqq',
 '.uttsstsrrqqrrsstq',
 'utsrrqrqqpqqrssttqq',
 '.pqqpp~ppppqqqqqp.',
]
# 판근(울퉁불퉁, 가늘어짐) — 왼쪽 큰 뿌리
ROOT_L1 = [
 '...........................45uts',
 '......................4..tuutssr',
 '..................45.tutsrrsqqrq',
 '...............4.tuutssrqqqqpqqp',
 '............45tuutssrqqpp.ppp...',
 '..........4tuttsrqqpp~..........',
 '.........tutssrqqpp~............',
 '.......45tuusqqp~...............',
 '.....4tuuttsrqp~................',
 '....tutsrqqqp~~.................',
 '...tusqpp~~.....................',
 '..tsqp~.........................',
 '..pp~...........................',
]
ROOT_L2 = [
 '...........tuts',
 '.......45tuutsr',
 '....4tuttsrqqqp',
 '..tuusrqqpp~~..',
 '.tsqqp~~.......',
 '.pp~...........',
]
ROOT_R1 = [
 'srrq.................',
 'tsrrqq4..............',
 'tssrrqqrq4...........',
 '.qsrrqqqrrqq.........',
 '..pqqsrqqqrrqq4......',
 '....ppqqtsrqqqqq.....',
 '.......pqssrqqqqqp...',
 '.........pqqsrqqqqp4.',
 '...........ppqsrqqqp.',
 '.............~pqqqqp4',
 '...............~ppp~.',
]
ROOT_R2 = [
 'srq.........',
 'tsrrq4......',
 '.qsrrqqq....',
 '..pqtsrqqp..',
 '...~ppqqqp4.',
 '......~pp~..',
]
GRASS_TUFTS = [  # (x, y, 행) 밑동 풀 다발
 (4, 104, ['.5.', '454', '.4.']),
 (20, 108, ['5.5', '454']),
 (84, 104, ['.6.', '545', '.4.']),
 (70, 108, ['.5', '45']),
 (40, 108, ['5.', '45']),
]


def _leaves(cv, plan):
    for n, k, x, y in plan:
        put(cv, dim(LEAF[n], k) if k else LEAF[n], x, y)


def tree_a1():
    cv = Cv(96, 112)
    put(cv, ['~' * 60], 18, 109)
    put(cv, ['~' * 44], 26, 110)
    for i, (x, r) in enumerate(TRUNK3_TOP + TRUNK3):
        put(cv, [r], x, 66 + i)
    put(cv, ROOT_L1, 2, 96)
    put(cv, ROOT_L2, 14, 103)
    put(cv, ROOT_R1, 74, 95)
    put(cv, ROOT_R2, 66, 103)
    put(cv, HOLLOW3, 46, 85)
    put(cv, LANTERN, 64, 86)
    for x, y, rows in GRASS_TUFTS:
        put(cv, rows, x, y)
    _leaves(cv, CANOPY_A1_BACK)
    for rows, x, y in CANOPY_A1_BRANCHES:
        put(cv, rows, x, y)
    _leaves(cv, CANOPY_A1_FRONT)
    return cv


# A2: 나무 문(널판 세로·쇠띠 둘·고리), 매단 등불, 늘어진 덩굴뿌리
DOOR_A2 = [
    '....pppppp....',
    '..ppqutsqupp..',
    '.ppusqutsqupp.',
    '.putsqutsqusp.',
    'pputsqutsqutsp',
    'putsqutsqutsqp',
    'plkkkkkkkkkkjp',
    'pqssqrssqrsqqp',
    'putsqutsqutsqp',
    'putsqursqutsqp',
    'putsqutsqulkqp',
    'putsqutsqukjqp',
    'putsqutsqutsqp',
    'purrqutsqutsqp',
    'putsqutsqutsqp',
    'plkkkkkkkkkkjp',
    'pqssqrssqrsqqp',
    'putsqutsqutsqp',
    'putsqutsqutsqp',
    'pppppppppppppp',
]
LANTERN = [
    '..j..',
    '..j..',
    '..k..',
    '.klk.',
    'jnonj',
    'jmonj',
    'jmnmj',
    '.jkj.',
    '..j..',
]
SIL_A2 = [  # 넓고 납작한 우산형 수관, 오른쪽으로 기울어짐
    '........................',
    '........................',
    '.........XXXXXXXXX......',
    '....XXXXXXXXXXXXXXXXX...',
    '..XXXXXXXXXXXXXXXXXXXX..',
    '.XXXXXXXXXXXXXXXXXXXXXX.',
    '.XXXXXXXXXXXXXXXXXXXXXXX',
    '.XXXXXXXXXXXXXXXXXXXXXXX',
    '..XXXXXXXXXXXXXXXXXXXXXX',
    '..XXXXXXXXXXXXXXXXXXXXX.',
    '...XXXXXXXXXXXXXXXXXXXX.',
    '....XXXXXXXXXXXXXXXXXX..',
    '......XXXXXXXXXXXXXXX...',
    '.........XXXXXXXXXX.....',
]
PLAN_A2 = (
    [('E' if (x // 2 + y) % 2 else 'F', 2 if y >= 40 else 1, x, y) for x, y in (
        (0, 40), (14, 46), (30, 48), (46, 50), (62, 48), (78, 42), (0, 26), (82, 24), (6, 12), (74, 10),
        (22, 4), (40, 2), (58, 6), (2, 18), (80, 16), (84, 30), (10, 6), (68, 4))]
    + [(n, 1, x, y) for n, x, y in (
        ('E', 4, 36), ('A', 18, 38), ('F', 36, 40), ('A', 54, 38), ('E', 70, 34), ('F', 80, 30),
        ('A', 6, 22), ('F', 24, 24), ('A', 42, 22), ('F', 60, 20), ('B', 76, 18),
        ('B', 16, 10), ('A', 32, 8), ('B', 50, 8), ('C', 66, 10))]
    + [(n, 0, x, y) for n, x, y in (
        ('D', 10, 30), ('C', 30, 30), ('D', 52, 28),
        ('B', 12, 14), ('C', 28, 14), ('B', 42, 12), ('D', 62, 14),
        ('C', 24, 6), ('B', 36, 4), ('D', 54, 6))]
)
VINES_A2 = [  # (x, y, 행) 수관 아래로 늘어진 잎 덩굴·뿌리 가닥
    (8, 58, ['3', '4', '3', '2', '3', '2', '.', '2']),
    (12, 60, ['2', '3', '2', '2', '1']),
    (24, 63, ['4', '3', '3', '2', '3', '2', '2']),
    (78, 58, ['3', '4', '3', '3', '2', '2', '1']),
    (86, 54, ['3', '2', '3', '2', '2', '1', '.', '1']),
    (66, 62, ['r', 'q', 'r', 'q', 'q', 'p']),
    (34, 64, ['r', 'q', 'q', 'p']),
]


LIMBS_A2 = [  # 줄기 위 Y 자 가지(수관 속으로)
    '..tusrqp......................................tsrqqp',
    '...tusrqp....................................tusrqp',
    '....tusrqp..................................tusrqp',
    '.....tusrqp................................tusrqqp',
    '......tusrqp..............................tusrqp',
    '.......utsrqp............................tusrqqp',
    '........utsrqp..........................tusrqp',
    '.........utsrqqp.......................tusrqqp',
    '..........utssrqp.....................tusrqp',
    '...........uttsrqp...................tusrqqp',
    '............uttsrqqp...............tussrqp',
    '..............uttsrqqp...........ttussrqp',
    '................uttssrqqp.....tttusrrqp',
    '..................uutttssrqqtusrrqqpp',
    '.....................uutsrqqtusrqqpp',
]


def tree_a2():
    cv = Cv(96, 112)
    put(cv, SHADOW_A2, 5, 108)
    put(cv, LIMBS_A2, 24, 52)
    put(cv, TRUNK_A2, 5, 67)
    put(cv, DOOR_A2, 48, 88)
    for x, y, rows in VINES_A2:
        put(cv, rows, x, y)
    put(cv, LANTERN, 28, 64)
    put(cv, LANTERN, 70, 66)
    _sil(cv, SIL_A2)
    canopy(cv, PLAN_A2)
    return cv


# ================================================================================================ 장면 도우미
GRASS = 'desert-oasis/ground-lawn'


def forest_scene(w, h, items, actor_at=None, trees=None):
    """w×h 칸 풀밭, 위·옆은 버들항 bd-tree 숲 벽. items = [(Cv, x칸, y칸)] — y 는 그림 윗변 칸."""
    cv = L.tile_fill(w, h, L.bd_part(GRASS))
    for kid, x, y in (trees or []):
        k = L.bd_kit(kid)
        cv.paste(k, x * T, y * T)
    for p, x, y in items:
        cv.paste(p, x * T, y * T)
    if actor_at:
        L.put_actor(cv, *actor_at)
    return cv


WALL = [('bd-tree-5844f6', -2, -3), ('bd-tree-a80c85', 1, -1), ('bd-tree-d61d7e', 3, -2), ('bd-tree-7ecdb8', 6, -1),
        ('bd-tree-1e09f0', 8, -2), ('bd-tree-3e8732', -1, 2), ('bd-tree-03a8f7', 8, 2), ('bd-tree-f4f319', 9, 5),
        ('bd-tree-cc0fcb', -1, 5)]


def _tree_meta(cv):
    sc = forest_scene(12, 10, [(cv, 3, 1)], actor_at=(6, 9),
                      trees=[('bd-tree-5844f6', -2, -2), ('bd-tree-d61d7e', 0, 2), ('bd-tree-b1d104', 9, -1),
                             ('bd-tree-1e09f0', 9, 4), ('bd-tree-37f48b', 1, 7), ('bd-tree-e9d9b3', 10, 8)])
    return cv, {'kind': 'object', 'parts': {'tree': cv}, 'vignette': sc}


# ================================================================================================ 작은 기물(2×2·2×1·1×2)
BOULDER_A1 = [
 '................................',
 '................................',
 '...........6.665.6..............',
 '.........566556556..............',
 '.......55656555655654...........',
 '......565555i555655544..........',
 '.....i5iihiiiiihi5ii443.........',
 '....iiiihiiihii4iiih4443........',
 '...iiihii4ii4ihhi4ii4443........',
 '...iihi4ih44ih44h4h4h44333......',
 '..iih4h44h4h44h444h44h4333CB....',
 '..i4h4h44434h434443433333DCB....',
 '..44h34333433343343333DEDDCB....',
 '.F433E343EE3434EE433EEDDDDCCB...',
 '.FE3EEDE3EDEE33EDE3EDDDDDDCCBA..',
 '.FEEEDEEDDEDDDEDDDDDDDDDDCCCBA..',
 'FEEEDDEDDDDDDDDDDDDDDDDDDCCCBBA.',
 'FEEDDDDDDDDCDDDDDDDDDDDDCCCCBBA.',
 'EEDDDDDDDDCBDDDDDDDDDDDCCCCCBBA.',
 'EEDDDDDDDDDCBDDDDDDDDDCCCCCBBBA.',
 'EDDDDDDDDDDDCBBDDDDDDCCCCCCBBBA.',
 '.EDDDDDDDDDDDDCBCCBDDCCCCCCBBAA.',
 '.DDDDDDDDDDDDDDDDCBBCCCCCCBBBA..',
 '.CDDDDDDDDDDDDDDDDCCBCCCCCBBBA..',
 '.3CDDDDDDDDDDDDDDCCCCCCCCBBBAA..',
 '435CCCDDDDDDDDDCCCCCCCCCBBBAA...',
 '35435CCCCDDDCCCCCCCCCCBBBBAA.ED.',
 '.343.4BBCCCCCCCCCCCBBBBBAAA~CDB.',
 '..3..~ABBBBBBBBBBBBBBAAAA~~~BBA~',
 '.....~~~AAAAAAAAAAAAAA~~~~~~~~~.',
 '.........~~~~~~~~~~~~~~~~~~~....',
 '................................',
]

BOULDER_A2 = [
 '................................',
 '................................',
 '................................',
 '...........6...5................',
 '.........5i65.565i5.............',
 '.......56i5665i6i5i4ML5i........',
 '......5i6i54i65i4h4LMMLi65......',
 '.....5i65i4i5i4i4h3LMKLi54K.....',
 '....5i5ih4i45h4i43LMLLKL4h3K....',
 '...56i4i54h4i4h43LLKL5i6LKLLKKJ.',
 '...i5i4h4i43h4LLMLLLK4h5LLKLKJ..',
 '..5i4ih4h43LLLKLMLLXLLKLLKLKKJg.',
 '..i4h43h3KKLKKLLKKLKLKKJKKJKJJg.',
 '..4h43KJKKLKbKKKKKLKKJKKKJKJJIg.',
 '..43KJJKKJbKKLJKKKKJKKJJKJJJJIg.',
 '..4KJJKLKJJbbKKJJKKKJJLJJIJJIIg.',
 '..3JIJJKJIJJKbJJJJIJJJIJJJIJIIg.',
 '..JJKJJJIbJJJJJJIJKJJJIJXJIJIIg.',
 '..gJKJJIJJbIJJKJIIJJKJIJJIIJHHg.',
 '.43IJJXJJJKJbJJKJJIJJKJbJIIIHHg5',
 '.3IIJIKJJJIJbIJJKJJIJJJbIJIHHg54',
 '..IIIJJIJJJJJIbbJJIJIIbIIIHHHg43',
 '..IIIKIJJIJJJJJIIJJJIIIIIIHHg.3.',
 '..gIIIJIIIJJJIJJJIIIKIIIIHHHg~..',
 '.KgHIIJIIIIHIIIIIIIIIIIIHHHHg~..',
 'LMKgIHHIIHIIIIIIIIHIIHHHHHHg~~..',
 'KLJggHHHHHHHHHHHHHHHHHHHHgg~~...',
 '.Jgg~~ggggggggggggggggggg~~~....',
 '..~~~~~~~~~~~~~~~~~~~~~~~~~.....',
 '.....~~~~~~~~~~~~~~~~~~~~.......',
 '........~~~~~~~~~~~~~~..........',
 '................................',
]

# A1 (round 4): 숲 바닥 풀·이끼 판(2×2 전체) 위 큰 버섯 일곱 — 갓 다섯 띠(밑 그늘·짙은 빨강·몸·빛·흰 테)+그늘 진 점, 줄기 세 단+밑동 짙은 풀
RING_GROUND = [
 '..........5...h...h.............',
 '...........i4.h4i.h5...4........',
 '........i..h4i5h4i45h6..h.......',
 '.....4..h4i3h4i3h4i3h45..h......',
 '......5i43h3i3h2h3i3h3i4.5i.....',
 '...h..4h3i3h43i2h3i43h3i3.45....',
 '....h5i3h3ih45i4h5i45h3i3h.i4...',
 '....h4i3h34i5h4i6h4i5h43i3h..5..',
 '..h4i3h3i45h4i5h4i45h4i5h3i3..5.',
 '...6h3i3h5i4h45i4h5i4h45i3h3i...',
 '4..h3i3h4i45h4i5h6i4h5i4h3i3h5..',
 '.45h3i3h5i4h5i4h45i4h5i45h3i3h..',
 '.5i3h3i4h45i4h5i4h5i4h45i4h3i3h.',
 '..4i3h3i5h4i45h4i5h4i5h4i5h3i3h4',
 'i5h3i3h4i45h4i5h4i45h4i5h4i3h3..',
 '.4i3h3i5h4i5h45i4h6i4h5i45h3i3h.',
 '.i5h3i3h4i5h4i5h4i5h4i45h4i3h3i.',
 '..5h3i3h45i4h5i4h45i4h5i4h3i3h4i',
 'h5i4h3i3h4i45h4i5h4i5h45i3h3i4..',
 '.i45h3i3h3i4h5i45h4i5h4i3h3i4h5.',
 '..h4i5h3i3h3i4h5i4h45i3h3i3h45i.',
 '..i6h4i5h3i3h3i3h4i3h3i3h3i45..i',
 '...i4h45i4h3i2h3i3h3i2h3i4h5i...',
 '.4..5i4h5i45h3i3h2h3i3h45i4h6i..',
 '..i..45i6h4i5h4i45h4i5h4i5h4....',
 '...5h.i5h4i45h4i5h4i45h4i5h4....',
 '....i4.5i45h4i6h4i5h4i5h45..h...',
 '.....4i.h4i5h45i4h5i4h5i45......',
 '......4..4h5i45h4i6h4i5h..5.....',
 '.......4..i4h5i45h4i5..5........',
 '........h...h4.5h4.45...........',
 '.............h...h...h..........',
]
GROUND_BITS = [  # (x, y, 행) 잎 다발·클로버·떨어진 잎·잔가지
 (2, 2, ['.6.', '656', '.4.']), (24, 1, ['5.6', '.5.']), (13, 13, ['.6.', '656', '.4.']), (18, 18, ['5.5', '.4.']),
 (27, 24, ['.6.', '656', '.4.']), (1, 23, ['6.', '45']), (14, 23, ['5.6', '454']),
 (6, 6, ['tu', 'st']), (21, 15, ['Vu', '.U']), (26, 5, ['u.', 'ts']), (3, 14, ['s', 't']), (10, 18, ['ut']),
 (17, 2, ['s..', '.s.', '..q']), (24, 20, ['..s', '.s.', 'q..']), (9, 25, ['rst']),
]
MUSH_L = [
 '...zzW...',
 '..zWWWVV.',
 '.zWzyWVVU',
 'zWWVVVVUT',
 'WWVVzyVUT',
 'VVVUVUUTT',
 'TUUUTTTTS',
 '.SSpppSS.',
 '...zyw...',
 '...zyw...',
 '.21zyw12.',
]
MUSH_M = [
 '..zWV..',
 '.zWWVU.',
 'zWzyVUT',
 'WVVVUUT',
 'TUUTTTS',
 '.SpppS.',
 '..zyw..',
 '.1zyw1.',
]
MUSH_S = [
 '.zWV.',
 'zWyUT',
 'TUUTS',
 '.SpS.',
 '.zyw.',
 '1zyw1',
]
RING_MUSH = [('S', 9, 11), ('M', 16, 10), ('S', 23, 11), ('M', 5, 20), ('M', 27, 20), ('L', 11, 30), ('L', 22, 30)]


RING_A2 = [
 '................................',
 '................................',
 '..........RZ.....ZR.............',
 '.....Z...RZQP...QZRP.....Z......',
 '........PQQPO..OPQQO............',
 '.........OzN....NyO.....RZ......',
 '....RZ....yx~..~yx....RZQP......',
 '...RZQP...~~....~~...PQQPO......',
 '..PQQPO..............OyN....Z...',
 '...OyN.....4...3.4...~yx~.......',
 '...~yx~...3.4....3...~~.........',
 '...~~..Z...................RZ...',
 '..RZ.......4.3..Z..4......RZQP..',
 '.RZQP.......3.......3....PQQPO..',
 'PQQPO....................~OyN...',
 '.OyN~.....Z....3.4........~yx~..',
 '.~yx~...........3...........~~..',
 '..~~...4.4.................RZ...',
 '....RZ..3...............RZRZQP..',
 '...RZQP.......Z.......RZQPQQPO..',
 '..PQQPO..RZ.......RZ.PQQPOOyN...',
 '...OyN..RZQP.....RZQP.OyN.~yx~..',
 '...~yx~PQQPO....PQQPO~yx~..~~...',
 '....~~..OyN......OyN.~~~........',
 '........~yx~.....~yx~...........',
 '.........~~.......~~............',
 '................................',
 '................................',
 '................................',
 '................................',
 '................................',
 '................................',
]


# 가시덤불·길돌(관문 영수증 그림에서 행으로 되살림 — 화소 그대로)
BRAMBLE_A1 = [
 '.......p.......p.......p........',
 '...p..rTq.p...rTTq..p.rTq...p...',
 '....rTrqqTrp.rTqqSTrxrTqSTq.....',
 '.prTrqSpSqrTrTrSp45qrTrpS4qTqp..',
 '..rqS45pSqprTrqp454SqrqpS45pqp..',
 'pTrpS454qpSqrqSpq4SpSqSppS4SpTqp',
 '.rqSpq4pTWSpqprTrpqpSrTrSpSqpqp.',
 'prpSpSpqUTSprTrqqrTrpqrqpqVWSpqp',
 '.rqpSqrTrqprqSpSrTqSpSprTrSUTqp.',
 'pTrpqrqpSrTrpqpSqpS45pqrqSpSqqTp',
 '.rqSpSpqrqSrTrpqrTr454SrTrpqSqp.',
 '.prpqSprTrpqpSrqSpqS4SqpqSrTqpp.',
 '..ppSqpqSpSqpqpSqpSpqpSqpSqpqp..',
 '.~~pppppppppppppppppppppppppp~~.',
 '..~~~~~~~~~~~~~~~~~~~~~~~~~~~~~.',
 '....~~~~~~~~~~~~~~~~~~~~~~~~....',
]
BRAMBLE_A2 = [
 '......s.........s.......s.......',
 '...s.tsts....s.tsts..s.tsts.....',
 '....tsqrss..s.tsqqsts.tsprss.s..',
 '..utsr56qss.tsr63.qstsr3.qqss...',
 '..tsq4565qstsq4565tsrq4563.qqs..',
 '.usq456tsrtsrs3456tsp.qs5652.rq.',
 '.tq4565sq4srqqq45tsr3V2qs6543tq.',
 'utq25tsq46qq.tsrsq5642.4qtsrsp.q',
 'tsp.sq45654tsrs43qq456654tsq56qp',
 'sq3tsq45543sq4tsp.q345643sq4565p',
 'q2tsr345432q34srW4q2345432q3452p',
 'p23sq23422p23442pq2342322p23233p',
 '.p1q211p.p1111p.pp111.p11111.p1.',
 '..~pp~.~pp~.~~pp~~.~pp~.~~pp~~..',
 '...~~~..~~~..~~.~~~...~~~.~~~...',
 '................................',
]
WAY_A1 = [
 '................',
 '................',
 '....DEFFEEDB....',
 '..DEFFFEEEEDDB..',
 '.CEFF5iEEEEDDDB.',
 '.CEFiEEEEEDDDDB.',
 '.ACDDDDDDDDCCCA.',
 '..ABCCCCCCCBAA..',
 '....ABBBBBBA....',
 '....EDDDDDCA....',
 '....EQRZRDCA....',
 '....EPDDDQCA....',
 '....EZDRZPCA....',
 '....ERDQDPCA....',
 '....EQDDRDCA....',
 '....EDPDDZCA....',
 '....EDDQRPCA....',
 '....EDDDDDCA....',
 '...4EDDCDDCA....',
 '..4iEDDDBDCA....',
 '..34EDDDDDCBA...',
 '....CDDDDDCBA...',
 '.DEEFFEEEEEDDB..',
 '.EFFEEEEEEDDDDB.',
 '.DEEEEDEEDDDDCA.',
 '.CDDCDDDDCDDCCA.',
 '.BCCCCBCCCCCBBA.',
 '4BABBBBBBBBBBAA3',
 '43~AAAAAAAAAAA~3',
 '.~~~~~~~~~~~~~~.',
 '...~~~~~~~~~~...',
 '................',
]
WAY_A2 = [
 '................',
 '................',
 '................',
 '.....56i5.......',
 '...5i6ii5i4.....',
 '..5i5LEELi44....',
 '..iiLEEEELK43...',
 '..4LELLLLLKK3...',
 '..LLLLLLKLLKJ...',
 '.4LKKKKKKKKKJI..',
 '.3LKKKKKKKKJJI..',
 '..LKKOPQPOKJJI..',
 '..LKOQKKKQOJJI..',
 '..LKPKKZKKPJJI..',
 '..LKQKZRZKQJJI..',
 '..LKPZRKRZPJJI..',
 '..LKQKZRZKQJJI..',
 '..LKPKKZKKPJJI..',
 '..LKOQKKKQOJJI..',
 '..LKKOPQPOKJJI..',
 '..LKKKKKKKJJJI..',
 '..LKKJKKKKKJII..',
 '..KKKKJKKKJJII..',
 '..4KKKKKKJKJIH..',
 '.4iKKKKKKKJJIH..',
 '.i54KKKKJKJIIH3.',
 'LE44JKKKKJJIIH43',
 'KLJHIJJJJJIIHH32',
 '.JHG~IIIIIIHHG~3',
 '..~~~GGGGGGGG~~.',
 '...~~~~~~~~~~~..',
 '................',
]


def ring_a1():
    cv = Cv(32, 32)
    put(cv, RING_GROUND, 0, 0)
    for x, y, rows in GROUND_BITS:
        put(cv, rows, x, y)
    stamps = {'L': MUSH_L, 'M': MUSH_M, 'S': MUSH_S}
    for n, fx, fy in RING_MUSH:
        rows = stamps[n]
        put(cv, rows, fx - len(rows[0]) // 2, fy - len(rows) + 1)
    return cv




def _small(cv, w, h, place, actor_at, trees, extra=()):
    sc = forest_scene(w, h, list(extra) + [(cv, *place)], actor_at=actor_at, trees=trees)
    return cv, {'kind': 'object', 'parts': {'piece': cv}, 'vignette': sc}


_TREES_S = [('bd-tree-a80c85', -1, -1), ('bd-tree-7ecdb8', 2, -2), ('bd-tree-3e8732', 5, -1), ('bd-tree-f4f319', 7, 2),
            ('bd-tree-cc0fcb', -1, 3)]


def _part(name, x, y):
    return (L.bd_part('deep-forest-path/' + name), x, y)


def ring(rows):
    cv, meta = _small(rows if isinstance(rows, Cv) else g(rows), 8, 6, (3, 2), (6, 5), _TREES_S,
                      [_part('fern_a', 1, 4), _part('stump', 6, 3)])
    patch = L.tile_fill(4, 3, L.bd_part(GRASS))
    patch.paste(cv, 16, 8)
    meta['extras'] = [('gate patch', patch, 1)]
    return cv, meta


def boulder(rows):
    return _small(g(rows), 8, 6, (3, 2), (6, 5), _TREES_S, [_part('fern_b', 2, 4), _part('stones_b', 5, 4)])


def bramble(rows):
    # 숲 사이 길목을 가시덤불이 막는다
    trees = [('bd-tree-5844f6', -2, -3), ('bd-tree-1e09f0', 1, -2), ('bd-tree-b1d104', 5, -3), ('bd-tree-a80c85', 0, 1),
             ('bd-tree-3e8732', 5, 1), ('bd-tree-cc0fcb', -1, 3), ('bd-tree-e9d9b3', 7, 3)]
    return _small(g(rows), 8, 6, (3, 3), (4, 5), trees)


def waystone(rows):
    return _small(g(rows), 7, 6, (3, 2), (4, 5), _TREES_S, [_part('cairn', 1, 3), _part('wild_b', 5, 4)])


FNS_SMALL = {
    'tc.fo_ring': {'A1': lambda: ring(ring_a1()), 'A2': lambda: ring(RING_A2)},
    'tc.fo_boulder': {'A1': lambda: boulder(BOULDER_A1), 'A2': lambda: boulder(BOULDER_A2)},
    'tc.fo_bramble': {'A1': lambda: bramble(BRAMBLE_A1), 'A2': lambda: bramble(BRAMBLE_A2)},
    'tc.fo_waystone': {'A1': lambda: waystone(WAY_A1), 'A2': lambda: waystone(WAY_A2)},
}
NOTES_SMALL = {
    'tc.fo_ring': {'A1': '붉은 점박이 버섯 아홉이 타원 고리로, 안쪽 풀은 짙게', 'A2': '청록빛 요정 버섯 고리, 안쪽에 빛 반점'},
    'tc.fo_boulder': {'A1': '둥근 회색 바위, 윗면 이끼 융단이 앞으로 흘러내림, 갈라진 금', 'A2': '낮고 넓은 짙은 바위, 이끼는 왼쪽 어깨만, 오른쪽 아래 고사리'},
    'tc.fo_bramble': {'A1': '빽빽한 검붉은 가시 덤불 더미, 잎·붉은 열매', 'A2': '활처럼 휜 가시 줄기가 겹친 덤불 벽'},
    'tc.fo_waystone': {'A1': '뾰족한 선돌, 앞면 청록 소용돌이 무늬, 이끼·받침돌', 'A2': '둥근 머리 판석, 이끼 목도리, 빛나는 매듭 마름모'},
}

FNS = {'tc.fo_ancient_tree': {'A1': lambda: _tree_meta(tree_a1()), 'A2': lambda: _tree_meta(tree_a2())}}
NOTES_BY_ITEM = {'tc.fo_ancient_tree': {
    'A1': '넓은 참나무 거목 — 버들항 잎 덩이 화법, 판근이 양옆으로 퍼지고 가운데 뿌리 아치 굴(문 칸)',
    'A2': '비틀린 고목 — 납작한 우산 수관에 늘어진 덩굴, 밑동에 쇠띠 나무 문과 매단 등불 둘'}}
FNS.update(FNS_SMALL)
NOTES_BY_ITEM.update(NOTES_SMALL)
