"""theme-climate forest — 숲 던전 조각(2026-10-23): 거목·버섯 고리·이끼 바위·가시덤불·길돌.

모든 화소는 이 파일의 행 문자열에서 온다(손 도트). 수관은 손으로 그린 잎 덩이(clump) 몇 개를 손으로 고른 자리에 겹쳐 찍고,
덩이의 밝기 단은 글자 바꾸기(한 단 내리기)로만 바꾼다 — 잡음 함수·도형 마스크 본체 없음.
범례(기물마다 공통 약속):
  잎 '0'~'6' = leaf 0~6 · 나무 p q r s t u = wood 0~5 · 돌 A B C D E F = stone 0~5 · 바위 G H I J K L M = crock 0~6
  · 이끼 a b c d e f = moss 0~5 · 늪 g h i = bog 0~2 · 붉은 S T U V W = red 0~4 · 뼈 v w x y z = bone 0~4
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
_B.update(j=('iron', 1), k=('iron', 3), l=('iron', 5), m=('fire', 2), n=('fire', 4), o=('fire', 5),
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
# A1 줄기: 넓은 참나무, 판근이 양옆으로 퍼지고 가운데 뿌리 아치 굴(문 칸 = 열 3, 맨 아래 줄).
TRUNK_A1 = [
 '......................................tusrqtsrqqtusrqsrqtsrqqrqpqp',
 '......................................tusrqtsrqqtusrqsrqtsrqqrqpqp',
 '......................................utsrqtssrqqtusrqsrqtsrqrqpqp',
 '......................................utsrqqtsrqqutsrqsrqtsrqrqpqp',
 '.....................................tusrrqqtsrqqutsrqsrqqtsrqrqpqp',
 '.....................................tusrqqtssrqqutsrqqsrqtsrqqrqpp',
 '.....................................utsrqqtsrqqputsrqqsrqtsrqqrqpp',
 '.....................................utssrqqtsrqqputsrqsrrqtsrqrqpp',
 '....................................utssrqqtsrrqqputsrqsrqqtsrqrqqpp',
 '....................................utsrqtusrrqqputssrqqsrqtsrqrqqpp',
 '....................................tusrqtussrqpputssrqqsrqtsrqqrqpp',
 '...................................tusrqqtusrrqputtssrqqsrqqtsrqrqqpp',
 '...................................tusrqqtusrqrqputssrrqqsrqtsrqqrqqpp',
 '..................................utssrqqtusrqrqputssrrqqsrqtsrqqrqqqpp',
 '..................................utsrrqqtusrqrp;:putsrqqssrqtsrqqrqqqpp',
 '.................................uttsrqqtussrqp;::;pusrqqsrrqtsrqqrqqqpp',
 '.................................utssrqqtusrrp;:00:;ptsrqqsrqtsrqqrqqqqpp',
 '................................uttsrqqtussrp;:0000:;ptsrqsrrqtsrqqrqqqpp',
 '................................utssrqqtusrqp;:0000:;pusrqqsrqtsrqqrqqqqpp',
 '...............................uttsrqqtussrup;:000000:;utsrqsrrqtsrqqrqqqpp',
 '...............................utssrqqtusrrup;:000000:;utsrqqsrqqtsrqrqqqqpp',
 '..............................uttsrqqtussrrup;:000000:;utssrqsrrqtsrqqrqqqpp',
 '.............................uutssrqqtusrrup;:00000000:;utsrqqsrqtssrqqrqqqqpp',
 '............................uutsrrqqtussrrup;:00000000:;utssrqqsrqtsrqqrqqqqqpp',
 '...........................uuttsrrqqtusrrqup;:00000000:;utsrrqqssrqtsrqqrqqqqqpp',
 '.........................uuttssrrqqtussrrqup;:00000000:;utssrqqsrrqtsrqqqrqqqqqppp',
 '......................uuuttsssrrqqtusssrrqup;:00000000:;utssrqqqssrqtsrrqqrqqqqqqppp',
 '..................45uuuttssrrrqqqtussrrrqqup;:00000000:;utssrrqqssrrqtssrqqqrqqqqqqqpp',
 '...............4554uttssrrqqqqqtusrrrqqqup;:0000000000:;utsrrqqqssrrqqtsrqqqqrqqqqqqqpp45',
 '............455uuttssrrqqppp..tusrrqqqpup;:0000000000:;utsrqqp.qsrrqqqtssrqqqqqqqqqqqp545',
 '.........4554uutssrrqqppp....utsrrqqpputp;:0000000000:;uusrqp...qsrrrqqqtsrrqqqqqqqqqqqpp',
 '......45554uuttsrrqqppp.....utssrqqpp.up;:0000000000:;uusrqp.....qqssrrqqqtsrrqqqqqqqqqpp',
 '....455uuuttsrrqqqpp.......utsrrqqp..utp;:0000000000:;ussrqp......qqsssrrqqqtsrrqqqqqqppp',
 '...45uuttssrrqqppp........uttsrrqp..uutp;:0000000000:;utsrqqp.......qqsssrrqqqtsrrqqqqpppp',
 '..4uuttsrrqqpp.........45uttsrqqp..uutsp;:0000000000:;utssrqqp.........qqssrrqqqqtsrqqqppp',
 '.4uttsrqqpp..........455uutssrqp..uuttsp;:0000000000:;uttsrqqp...........qqssrrqqqqsrqqpp',
 '.utsrqqp...........45uuttsrrqp...uttssp;:0000000000:;uttssrqqp.............qqsrrqqqqrqqp',
 '.qqpp............45uuttssrqqp...uttsrqp;:0000000000:;uttssrrqqp...............qqsrqqqpp.',
 '...............45uuttssrrqp...uuttsrrqp;:0000000000:;uttsrrqqqqp................qqqqpp..',
 '.............45uuttsrrqqpp...uuttsrrqqp;:0000000000:;utssrrqqqqqpp.................pp...',
 '...........4uuttssrrqqpp...uuttssrrqqp;;:0000000000:;;utssrrqqqqqqpp...................',
 '..........uuttsrrqqpp.......pqqqqqqqp;;::00000000::;;pqqqqqqqqqqpp.....................',
]
SHADOW_A1 = [
 '.........~~~~~~~~..........~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~..............~~',
 '..............~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~.............',
]

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

# 굴 언저리 이끼(빛 쪽 판근 윗면) — 이미지 좌표에 얹는 손 조각
MOSS_A1 = [  # (x, y, 행)
    (22, 92, ['..45.', '4554.', '.43..']),
    (8, 99, ['.45', '454', '3..']),
    (36, 86, ['45', '54', '4.']),
    (64, 90, ['.4', '45', '43']),
    (84, 93, ['45.', '544', '.3.']),
    (42, 100, ['4', '5', '3']),
]
SIL_A1 = [  # 4px 덩이로 깐 수관 바탕(가장 어두운 잎) — 위 덩이들이 덮는다
    '........................',
    '........................',
    '........XXXXXXX.........',
    '......XXXXXXXXXXXX......',
    '....XXXXXXXXXXXXXXXX....',
    '..XXXXXXXXXXXXXXXXXXXX..',
    '.XXXXXXXXXXXXXXXXXXXXXX.',
    '.XXXXXXXXXXXXXXXXXXXXXX.',
    '.XXXXXXXXXXXXXXXXXXXXXX.',
    '.XXXXXXXXXXXXXXXXXXXXXX.',
    '.XXXXXXXXXXXXXXXXXXXXXX.',
    '.XXXXXXXXXXXXXXXXXXXXXX.',
    '.XXXXXXXXXXXXXXXXXXXXXX.',
    '..XXXXXXXXXXXXXXXXXXXX..',
    '..XXXXXXXXXXXXXXXXXXXX..',
    '...XXXXXXXXXXXXXXXXXX...',
    '....XXXXXXXXXXXXXXXX....',
    '.....XXXXXXXXXXXXXX.....',
]
PLAN_A1 = (
    # 뒤 테두리(두 단 어둡게)
    [('F' if (x + y) % 3 == 0 else 'A', 1, x, y) for x, y in (
        (2, 60), (16, 64), (32, 66), (48, 66), (64, 63), (78, 58), (0, 46), (80, 44), (0, 32), (82, 30),
        (6, 18), (76, 16), (18, 6), (36, 0), (54, 2), (66, 8), (0, 20), (82, 18))]
    # 가운데(한 단)
    + [(n, 1 if x >= 56 or y >= 50 else 0, x, y) for n, x, y in (
        ('A', 6, 50), ('A', 22, 54), ('A', 40, 56), ('A', 58, 52), ('A', 72, 46),
        ('F', 4, 38), ('A', 20, 42), ('A', 38, 44), ('A', 56, 40), ('A', 70, 34),
        ('A', 8, 26), ('A', 26, 30), ('F', 44, 28), ('A', 62, 24),
        ('A', 14, 14), ('A', 32, 16), ('A', 50, 12), ('B', 66, 14), ('B', 26, 4), ('B', 42, 2))]
    # 앞 밝은 덩이(위·왼 쪽으로 몰림)
    + [(n, 0, x, y) for n, x, y in (
        ('C', 10, 46), ('B', 28, 48), ('C', 48, 48), ('D', 66, 44),
        ('B', 8, 34), ('A', 24, 34), ('B', 46, 34), ('C', 64, 30),
        ('A', 12, 20), ('A', 30, 20), ('B', 50, 18), ('B', 22, 8), ('A', 34, 4), ('C', 52, 6))]
    # 빛 받는 판(위·왼) — 한 단 밝게
    + [(n, -1, x, y) for n, x, y in (('C', 16, 22), ('D', 34, 8), ('C', 26, 36), ('D', 12, 36), ('C', 40, 20))]
)


def _sil(cv, sil, x0=0, y0=0, ch='1'):
    rows = [''.join((ch if c == 'X' else '.') * 4 for c in r) for r in sil for _ in range(4)]
    put(cv, rows, x0, y0)


def tree_a1():
    cv = Cv(96, 112)
    put(cv, SHADOW_A1, 3, 108)
    put(cv, TRUNK_A1, 3, 66)
    for x, y, rows in MOSS_A1:
        put(cv, rows, x, y)
    _sil(cv, SIL_A1)
    canopy(cv, PLAN_A1)
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
 '...............5................',
 '..........5.565i5...............',
 '........56i56656i5MM............',
 '......5i6i5iii5i4LMMLL..........',
 '.....5ii5i4ii4i4LLMLMLLK........',
 '....5i5ii4i44h4LMLLLMLLLK.......',
 '...5ii4i44h4LLLLMLLLLLLKKK......',
 '...i5i44h43LLMLLLLLMLLLKLKK.....',
 '..5i4i4h4LLLLLLLLLLLLKLLKKKJ....',
 '..i4h443KKLKKLLKKLKKKKKKKKJJ....',
 '..4h43KJKKKKKKKKKKKKKKKKKJJJI...',
 '..43KJJKKKJKKKKJKKKKKJJJJJJJI...',
 '..4KJJKKKJJKKKKJJKKKJJJJJJJIIH..',
 '..3JJJJKJJJJKKJJJJJJJJIJJJIIIH..',
 '..JJKJJJJHJJJJJJIJJJJJIJJJIIIH..',
 '..4JKJJJJJHIJJJJIIJJKJIJJIIIHH..',
 '.43IJJJJJJKJHJJJJJIJJKJHJIIIHH5.',
 '.3IIJJKJJJJJHIJJJJJIJJJHIIIHH54i',
 '..IIIJJJJJJJJIHHJJJJIIHIIIHHHi43',
 '..IIIIIJJJJJJJJIIJJJJIIIIIHHG.3.',
 '..HIIIIIIIJJJJJJJIIIIIIIIHHHG~..',
 '.KHHIIIIIIIIIIIIIIIIIIIIHHHGG~..',
 'LMKHGHHIIIIIIIIIIIIIIHHHHHGG~~..',
 'KLJHG~GHHHHHHHHHHHHHHHHGGGG~~...',
 '.JHG~~~GGGGGGGGGGGGGGGG~~~~~....',
 '..~~~~~~~~~~~~~~~~~~~~~~~~~.....',
 '.....~~~~~~~~~~~~~~~~~~~........',
 '................................',
 '................................',
]

RING_A1 = [
 '................................',
 '................................',
 '................................',
 '.........VW...VWW..VW...........',
 '........VzVU.VWzWVVzVU..........',
 '........STTS.UVVUTSTTS..........',
 '.........yx..STTTS.yx...........',
 '....VW..~xw~..wyx.~xw~.VW.......',
 '...VzVU......~xw~.....VzVU......',
 '...STTS....4..........STTS......',
 '....yx...4.3.....4.4...yx.......',
 '...~xw~...........3.4.~xw~......',
 '..VWW.....................VWW...',
 '.VWzWV...4.4.......4.....VWzWV..',
 '.UVVUT....3.........3....UVVUT..',
 '.SUTTS..................SUTTS...',
 '..wyx.......4.4..........wyx....',
 '.~xxw~.......3..........~xxw~...',
 '....VWW...........4.4.....VW....',
 '...VWzWV...........3.....VzWV...',
 '...UVVUT...VWW...VWW....UVVUT...',
 '...SUTTS..VWzWV.VWWzWV..SUTTS...',
 '....wyx...UVVUT.UVVVUT...wyx....',
 '...~xxw~..SUTTS.SUTTTS..~xxw~...',
 '...........wyx...wyyx...........',
 '..........~xxw~.~xxxw~..........',
 '................................',
 '................................',
 '................................',
 '................................',
 '................................',
 '................................',
]

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
 '................................',
 '....xrTTr.........rTTr.x........',
 '...rTq..qTr.....x.rq..qTr.......',
 '..rT.x...qqT...rTTr..x.qrT......',
 '.xT.4..p..rTrxrTq.qTr....qTrTr..',
 '.rq434.prTq.pqTr.p.qTrp..prTq.qr',
 'xTq.4.rTqpp.rTqpp45pSqrTprTqpp.T',
 '.rqpprTqpSprTqp4544Sp.qTrTqpp4q.',
 '.TqprTqpSSrTqppS4pSSppqTrqp.434x',
 '.rqpTqpSSrTqppSprTTrpSprqTqSp4.r',
 '.qSrTqpSrTqpSSrTqpqTrSrTqSSprrq.',
 'xqSrqpqSrTqpSSrTqppSqTrTqSSSrTq.',
 '.pqSqpqSpqSpqSpqSppSpqSqpqSSpqp.',
 '.~ppqppqppqppqppqpppqppqppqpqp~.',
 '..~~~~~~~~~~~~~~~~~~~~~~~~~~~~..',
 '....~~~~~~~~~~~~~~~~~~~~~~~~....',
]

WAY_A1 = [
 '................',
 '................',
 '.......EF.......',
 '......DFFC......',
 '.....DEFFEDB....',
 '.....DEEEEDB....',
 '....45EEEDDCA...',
 '...4i5DDDDCCA...',
 '...i4CEDDDCCA...',
 '...4CEDDDDCCB4..',
 '...3EDDDDDDCB3..',
 '...CEDQRZRCCBA..',
 '...CEPDDDDQCBA..',
 '...CEZDRZDPCBA..',
 '...CERDQDPDCBA..',
 '...CEQDDRDQCBA..',
 '...CEDPDDDZCBA..',
 '...CEDDQRZPCBA..',
 '...CEDDDDDDCBA..',
 '...CEDDCDDCCBA..',
 '...CEDDDBDCCBA..',
 '...CDDDDCBDCBA..',
 '...4EDDDDDCCBA..',
 '..4iCDDDDDCCBA..',
 '..i45DDDDCDCBA..',
 '..44CDDDDDCCBAA.',
 '.DE3CDDDDDCCBBCA',
 'DEECBCDDDDCCBABA',
 'BDDBACCCCCCBBAAA',
 '.AAA~BBBBBBBAA~~',
 '..~~~AAAAAAAA~~.',
 '...~~~~~~~~~~...',
]

WAY_A2 = [
 '................',
 '................',
 '................',
 '.....56i5.......',
 '...5i6ii5i4.....',
 '..5i5LMMLi44....',
 '..iiLMMMMLK43...',
 '..4LMLLLLLKK3...',
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
 'LM44JKKKKJJIIH43',
 'KLJHIJJJJJIIHH32',
 '.JHG~IIIIIIHHG~3',
 '..~~~GGGGGGGG~~.',
 '...~~~~~~~~~~~..',
 '................',
]



def _small(cv, w, h, place, actor_at, trees, extra=()):
    sc = forest_scene(w, h, list(extra) + [(cv, *place)], actor_at=actor_at, trees=trees)
    return cv, {'kind': 'object', 'parts': {'piece': cv}, 'vignette': sc}


_TREES_S = [('bd-tree-a80c85', -1, -1), ('bd-tree-7ecdb8', 2, -2), ('bd-tree-3e8732', 5, -1), ('bd-tree-f4f319', 7, 2),
            ('bd-tree-cc0fcb', -1, 3)]


def _part(name, x, y):
    return (L.bd_part('deep-forest-path/' + name), x, y)


def ring(rows):
    return _small(g(rows), 8, 6, (3, 2), (6, 5), _TREES_S, [_part('fern_a', 1, 4), _part('stump', 6, 3)])


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
    'tc.fo_ring': {'A1': lambda: ring(RING_A1), 'A2': lambda: ring(RING_A2)},
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
