"""gap-tower-r1 — 둥근 탑 조각 판(gap 묶음). 항목 3 × 줄 공통 후보 2(A1 A2). 2차(적대 검수 1회차 지적 11건 반영).

조수가 지은 3층 탑이 네모난 지하 감옥으로 읽혔다(http://mdc-server:18301/assistant-dungeons-1.html, dg-r3-dg-tower3).
이 판은 **둥근 탑 방 안**을 위에서(3/4) 둥글게 읽히게 하는 조각을 그린다. 버들항 실내 관례를 따른다:
북쪽 호 = 벽 윗면 띠 + 그 밑 안벽 앞면 2단(32px) · 남쪽 호 = 벽 윗면 띠만(바깥 2px 턱) · 동·서 끝 = 안벽이 어두워지며 사라진다
(옆면을 그리지 않는다). 탑 바깥 벽(둥근 드럼)은 그리지 않는다 — 걷는 방 안에서는 탑 바깥이 안 보인다.

  - gap.tower_wall  둥근 탑 둘레 벽 **칸 단위 키트**. 지름 8칸·12칸 링을 칸 경계(가운데 열·가운데 행)에서 사분면 넷으로 자른 조각
                    + 두 크기가 같이 쓰는 이음 넷(북 1×4 · 남 1×2 가로 반복, 서·동 2×1 세로 반복) + 문 이음 둘(북 안벽 아치 문 · 남 띠 끊은 통로).
                    사분면만 = 둥근 방, 가로 이음 k 개 = 가로로 긴 방, 세로 이음 k 개 = 세로로 긴 방(가로보다 높은 방).
                    띠 안쪽 8px 는 **둘레 판석 한 줄**(벽을 따라 휘는 깐 돌) — 네모난 바닥 격자를 원이 자른 것처럼 보이지 않게 한다.
                    띠 11px + 둘레 판석 8px = 19px 라 한 칸 안에 「보이는 바닥」 과 「링 바깥」 이 같이 들지 않는다(모듈을 읽을 때 검사).
                    → 아래층은 칸마다 하나: 바닥이 보이는 칸은 바닥 타일, 나머지는 어둠.
                    A1 은 따로 **지붕층 변형**(성가퀴: 크기·닳음이 다른 세 가지 머리, 8칸 링)을 둔다 — 보통 층은 평평한 벽 윗면.
  - gap.tower_stair 12칸 링 서쪽 안벽에 붙어 북쪽으로 오르는 돌계단 5단 + 계단참, 계단참 뒤 안벽에 벽 속으로 이어지는 아치.
                    디딤판 윗면 + 남쪽 챌판만 그린다(옆면 없음). 서쪽 끝은 벽 윗면 띠 밑으로 들어가 벽 곡선을 그대로 따른다.
  - gap.tower_window 화살 구멍. 안벽 앞면 결(벽돌)에 **파 넣은** 구멍 — 비스듬한 창 옆면, 위 상인방, 창턱 윗면. 장면에서는 앞면과 같은
                    둘레 좌표(u, v)로 붙여 벽 곡선을 따라 휘고 좁아진다. 두 모습: 어두운 구멍 / 빛이 드는 구멍(유리 없음, 옆면이 밝고
                    밑 바닥에 엷은 빛 자리).

손 도트 원칙: 모든 화소 색은 이 파일의 **행 문자열 결 표**(띠·앞면·둘레 판석·바닥·디딤판·창·아치·성가퀴)에서 온다.
링의 모양은 손으로 적은 **반너비 표**(`TAB`, 반지름별 행마다 반너비 px)이고, 결 표를 그 모양 위에 자리만 옮겨 붙인다 —
띠·둘레 판석은 둘레 길이 t × 안쪽 깊이 s, 앞면·창은 둘레 길이 u × 띠 아래 깊이 v. 둘레 길이는 원의 각도로 재므로 동·서로 돌아가는
곳의 돌이 좁아지고 앞면 줄눈이 띠를 따라 휜다. 잡음 함수·생성 이미지는 없다. 명암은 결 표 글자를 후보의 명암 사슬(`chain`)에서
한두 단 옮기는 것만.

A1 = 버들항 지하묘지 결(밝은 반점 벽 윗면 띠 + 흰 턱, 어두운 녹회색 벽돌 앞면, 밝고 어두운 벽돌이 엇갈리는 판석 바닥)
A2 = 어두운 거친 막돌(울퉁불퉁한 갓돌 띠 + 밝은 턱, 크기가 제각각인 막돌 앞면, 닳은 넓은 판돌 바닥, 둥근 자갈 둘레).
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dot  # noqa: E402
from dot import Cv, grid, legend, stamp  # noqa: E402

WAVE = 'gap'
T = 16
BAND = 11          # 벽 윗면 띠 너비
COURSE = 8         # 둘레 판석 너비
WALL_H = 32        # 안벽 앞면 높이(2단)
FACE_END = 0.94    # 안벽 앞면이 보이는 범위: |sx|/Ri < 이 값(그 밖은 서·동을 보는 옆면이라 그리지 않는다)

# ------------------------------------------------------------------------------------------------ 링 모양(손 표)
# 반지름 R 원의 행 d(중심에서 d+0.5 px 떨어진 행) 반너비. 12칸 링 = 바깥 96 · 안 85 · 판석 안 77, 8칸 링 = 64 · 53 · 45.
TAB = {
    80: [80, 80, 80, 80, 80, 80, 80, 80, 80, 79, 79, 79, 79, 79, 79, 78, 78, 78, 78, 78, 77, 77, 77, 76, 76, 76, 75, 75, 75, 74, 74, 74, 73, 73, 72, 72, 71, 71, 70, 70, 69, 68, 68, 67, 66, 66, 65, 64, 64, 63, 62, 61, 60, 59, 59, 58, 57, 56, 55, 53, 52, 51, 50, 49, 47, 46, 44, 43, 41, 40, 38, 36, 34, 32, 29, 26, 23, 20, 15, 9],
    69: [69, 69, 69, 69, 69, 69, 69, 69, 68, 68, 68, 68, 68, 68, 67, 67, 67, 67, 66, 66, 66, 66, 65, 65, 65, 64, 64, 63, 63, 62, 62, 61, 61, 60, 60, 59, 59, 58, 57, 57, 56, 55, 54, 54, 53, 52, 51, 50, 49, 48, 47, 46, 45, 44, 42, 41, 40, 38, 37, 35, 33, 31, 29, 27, 25, 22, 18, 14, 8],
    61: [61, 61, 61, 61, 61, 61, 61, 61, 60, 60, 60, 60, 60, 59, 59, 59, 59, 58, 58, 58, 57, 57, 57, 56, 56, 55, 55, 54, 54, 53, 53, 52, 52, 51, 50, 50, 49, 48, 47, 46, 46, 45, 44, 43, 42, 41, 39, 38, 37, 36, 34, 33, 31, 29, 27, 25, 23, 20, 17, 13, 8],
    96: [96, 96, 96, 96, 96, 96, 96, 96, 96, 96, 95, 95, 95, 95, 95, 95, 95, 94, 94, 94, 94, 94, 93, 93, 93, 93, 92, 92, 92, 91, 91, 91, 90, 90, 90, 89, 89, 88, 88, 87, 87, 87, 86, 86, 85, 85, 84, 83, 83, 82, 82, 81, 80, 80, 79, 78, 78, 77, 76, 75, 75, 74, 73, 72, 71, 70, 69, 68, 67, 66, 65, 64, 63, 62, 61, 59, 58, 57, 55, 54, 52, 51, 49, 47, 46, 44, 42, 39, 37, 35, 32, 29, 26, 22, 17, 10],
    85: [85, 85, 85, 85, 85, 85, 85, 85, 85, 84, 84, 84, 84, 84, 84, 84, 83, 83, 83, 83, 82, 82, 82, 82, 81, 81, 81, 80, 80, 80, 79, 79, 79, 78, 78, 77, 77, 76, 76, 75, 75, 74, 74, 73, 72, 72, 71, 70, 70, 69, 68, 68, 67, 66, 65, 64, 64, 63, 62, 61, 60, 59, 58, 57, 55, 54, 53, 52, 50, 49, 47, 46, 44, 43, 41, 39, 37, 35, 33, 30, 27, 24, 20, 16, 9],
    77: [77, 77, 77, 77, 77, 77, 77, 77, 77, 76, 76, 76, 76, 76, 76, 75, 75, 75, 75, 74, 74, 74, 74, 73, 73, 73, 72, 72, 72, 71, 71, 70, 70, 69, 69, 68, 68, 67, 67, 66, 65, 65, 64, 64, 63, 62, 61, 61, 60, 59, 58, 57, 56, 55, 54, 53, 52, 51, 50, 49, 48, 46, 45, 44, 42, 40, 39, 37, 35, 33, 31, 29, 26, 23, 19, 15, 9],
    64: [64, 64, 64, 64, 64, 64, 64, 64, 63, 63, 63, 63, 63, 63, 62, 62, 62, 62, 61, 61, 61, 60, 60, 60, 59, 59, 58, 58, 57, 57, 56, 56, 55, 55, 54, 53, 53, 52, 51, 50, 50, 49, 48, 47, 46, 45, 44, 43, 42, 41, 39, 38, 37, 35, 34, 32, 30, 28, 26, 24, 21, 18, 14, 8],
    53: [53, 53, 53, 53, 53, 53, 53, 52, 52, 52, 52, 52, 52, 51, 51, 51, 50, 50, 50, 49, 49, 48, 48, 48, 47, 46, 46, 45, 45, 44, 43, 43, 42, 41, 40, 39, 38, 37, 36, 35, 34, 33, 32, 30, 29, 27, 25, 24, 21, 19, 16, 13, 7],
    45: [45, 45, 45, 45, 45, 45, 45, 44, 44, 44, 44, 44, 43, 43, 43, 42, 42, 41, 41, 41, 40, 40, 39, 38, 38, 37, 36, 36, 35, 34, 33, 32, 31, 30, 29, 28, 26, 25, 23, 22, 20, 17, 15, 12, 7],
}


def _in(R, sx, sy):
    d = int(abs(sy))
    t = TAB[R]
    return d < len(t) and int(abs(sx)) < t[d]


# ------------------------------------------------------------------------------------------------ 후보별 결 표
A1 = {
    'name': 'A1',
    # 띠(밝은 반점 돌): w 바깥 끝 · l 몸 · Q 밝은 반점 · g 어두운 반점 · k 안쪽 줄 · W 흰 턱
    # 앞면(벽돌): K 줄눈 · J 그늘 · B 몸 · C 밝은 반점 · D 왼 끝 빛 · X 윗줄 빛
    'leg': legend(w=('cata', 3), l=('cata', 4), k=('cata', 5), Q=('stone', 5), g=('stone', 2), W=('stone', 5), f=('stone', 1),
                  K=('brick', 0), J=('brick', 1), B=('brick', 2), C=('brick', 3), D=('brick', 4), X=('brick', 5), Y=('brick', 6),
                  a=('cata', 6), h=('cata', 5), G=('cata', 4), i=('cata', 3), L=('cata', 2), m=('cata', 1), b=('stone', 1),
                  p=('rim', 6), o=('stone', 5), n=('stone', 4)),
    'chain': 'KJBCDXY',
    'band': [   # 0 = 바깥 끝 … 10 = 안 끝(흰 턱). 0열 = 갓돌 이음
        'wwwwwwwwwwwwwwww',
        'glllllQlllllllgl',
        'wllgllllllllQlll',
        'wlllllllglllllll',
        'wQlllllllllllllQ',
        'wllllllgllllllll',
        'wlllQllllllllgll',
        'wlglllllllQlllll',
        'wllllllllllllllg',
        'kkkkkkkkkkkkkkkk',
        'WWWWWWWWWWWWWWWW',
    ],
    'front': ['g', 'w'],            # 남쪽 바깥 끝 2px 턱(0 = 맨 바깥)
    'face': [   # 버들항 지하묘지 벽돌: 층 8줄, 벽돌 윗줄 빛 X, 왼 끝 D, 몸 B + 반점, 아래 J, 줄눈 K. 0~1행 = 띠 밑 그늘
        'JJJJJJJKJJJJJJJJ',
        'BBBBCBBKJBBBBBBB',
        'BCBBBBBKDBBBBCBB',
        'BBBBBBBKDBBBBBBB',
        'BBBJBBBKDBBCBBBB',
        'BBBBBBCKDBBBBBBJ',
        'JJJJJJJKJJJJJJJJ',
        'KKKKKKKKKKKKKKKK',
        'XXXXXXXXXXXXXXXK',   # 8
        'DBBBBBBCBBBBBBBK',
        'DBBCBBBBBBBBBCBK',
        'DBBBBBBBBBJBBBBK',
        'DBBBBBBBBBBBBBBK',
        'DBBBBCBBBBBBBBBK',
        'JJJJJJJJJJJJJJJK',
        'KKKKKKKKKKKKKKKK',
        'XXXXXXXKXXXXXXXX',   # 16
        'BBBBBBBKDBBBCBBB',
        'BCBBBBBKDBBBBBBB',
        'BBBBBJBKDBBBBBBB',
        'BBBBBBBKDBBBBBCB',
        'BBBCBBBKDBBBBBBB',
        'JJJJJJJKJJJJJJJJ',
        'KKKKKKKKKKKKKKKK',
        'XXXXXXXXXXXXXXXK',   # 24
        'DBBBBCBBBBBBBBBK',
        'DBBBBBBBBBBCBBBK',
        'DBCBBBBBBBBBBBBK',
        'DBBBBBBBJBBBBBBK',
        'JJJJJJJJJJJJJJJK',
        'JJJJJJJJJJJJJJJJ',
        'KKKKKKKKKKKKKKKK',
    ],
    'course': [   # 둘레 판석(벽에 붙은 깐 돌 한 줄): 0 = 벽 쪽. 판석 길이 16(둘레), 이음 b
        'biiiiiiiiiiiiiii',
        'bahhhhhhhhhhhhhh',
        'bhGGGGGGhGGGGGGG',
        'bhGGGGGGGGGGiGGG',
        'bhGGhGGGGGGGGGGG',
        'bhGGGGGGGGGhGGGG',
        'biiiiiiiiiiiiiii',
        'bbbbbbbbbbbbbbbb',
    ],
    'floor': [   # 버들항 floor_cata 짜임: 밝은 벽돌(G) 층 / 어두운 벽돌(i) 층이 엇갈리고 반점
        'aaaaaaaaaaabaaaa',
        'GGGGGGGGGGGbGGGG',
        'GhGGGGGGGGGbGGGG',
        'GGGGGiGGGGGbGGiG',
        'GGGGGGGGGGGbGGGG',
        'GGiGGGGGGhGbGGGG',
        'GGGGGGGGGGGbGGGG',
        'bbbbbbbbbbbbbbbb',
        'GGGGGGbGGGGGGGGG',
        'iiiiiibiiiiiiiii',
        'iiihiibiiiiiiiii',
        'iiiiiibiimiiiiii',
        'iiiiiibiiiiiiiii',
        'imiiiibiiiihiiii',
        'iiiiiibiiiiiiiii',
        'bbbbbbbbbbbbbbbb',
    ],
    'floor_var': [[
        'aaaaaaaaaaabaaaa',
        'GGGGGGGGGGGbGGGG',
        'GGGiGGGGGGGbGGGG',
        'GGGGiGGGGGGbGGGG',
        'GGGGGiiGGGGbGGGG',
        'GGGGGGGiGhGbGGGG',
        'GGGGGGGGGGGbGGGG',
        'bbbbbbbbbbbbbbbb',
        'hhhhhhbGGGGGGGGG',
        'GGGGGGbiiiiiiiii',
        'GGhGGGbiiiiiiiii',
        'GGGGGGbiimiiiiii',
        'GGGGGGbiiiiiiiii',
        'GGGGiGbiiiihiiii',
        'GGGGGGbiiiiiiiii',
        'bbbbbbbbbbbbbbbb',
    ]],
    'iface_shift': 0,
    # 디딤판: 0행 = 앞 끝 닳은 턱(밝음), 몸은 다듬은 돌 n + 닳아 밝은 자리 o + 얼룩 h·G — 판마다 다른 자리(x % 16 이 단마다 밀린다)
    'tread': ['aaaanaaaaaaaanaa', 'hhhGhhhhahhhhhhh', 'hhhhhhGhhhhhihhh', 'hGhhhhhhhhhhhhGh', 'hhhhhahhhhGhhhhh',
              'hhihhhhhhhhhhhhh', 'hhhhhhhhGhhhhahh', 'hhhhGhhhhhhhhhhh', 'hhhhhhhhhhhihhhh', 'Ghhhhhhhhhhhhhhh'],
    'riser': ['i', 'L', 'm', 'b'],                       # 챌판 줄(위 → 아래): 디딤판 끝 바로 밑이 가장 밝다
    'support': 'L',
}

A2 = {
    'name': 'A2',
    # 띠(거친 갓돌): a~f crock 1~6, 턱 F(brick 5)·G(brick 6). 앞면 막돌: A~G brick 1~6
    'leg': legend(a=('crock', 1), b=('crock', 2), c=('crock', 3), d=('crock', 4), e=('crock', 5), f=('crock', 6),
                  A=('brick', 1), B=('brick', 2), D=('brick', 3), E=('brick', 4), F=('brick', 5), G=('brick', 6),
                  n=('cata', 1), m=('cata', 2), l=('cata', 3), L=('cata', 4), o=('stone', 1), q=('stone', 2),
                  p=('rim', 5), r=('stone', 5), s=('stone', 4)),
    'chain': 'ABDEFG',
    'band': [   # 갓돌 길이가 4~9열로 제각각, 줄눈 b, 위·왼 빛 e·f, 아래 그늘 c, 9 = 안쪽 빛 턱 줄, 10 = 턱 끝
        'cbccccbcccbcccbc',
        'deeeeffeedeeeefe',
        'cbdeeeeedbdeeedd',
        'cbdeedeedbcdeeec',
        'bccddddcbbbccdcb',
        'dfeeebdeeeeedbde',
        'deeedbdeeefeebde',
        'dddecbcdeedeebcd',
        'bbbcbbbccccdcbbb',
        'eeeeeeeeeeeeeeee',
        'ffffffffffffffff',
    ],
    'front': ['b', 'c'],
    'face': [   # 어두운 막돌 쌓기: 층 높이가 다르고(4·5·5·6·6·…) 돌 길이도 다르다
        'AAAAAAAAAAAAAAAA',
        'BEEEFEBDEEEEFEBD',
        'BEEEEEBDEFEEEEBD',
        'BDEEEDBBDEEEEDBB',
        'ABBBBBAABBBBBBAA',
        'EFFEEBDEEEEFEEEB',
        'EEEEEBDEEFEEEEDB',
        'EEFEEBDEEEEEEEDB',
        'DEEEDBBDEEEEEDBB',
        'BBBBBAABBBBBBBBA',
        'EEBDEEEFEEEBDEEE',
        'EEBDEEEEEEEBDEFE',
        'EEBDEFEEEEDBBDEE',
        'DDBBDEEEEDDBBDDD',
        'BBAABBBBBBBAABBB',
        'FEEEEBDEEEEEEBDF',
        'EEEEDBDEEFEEEBDE',
        'EFEEDBDEEEEEDBDE',
        'EEEEDBBDEEEEDBBE',
        'DDDDBAABDDDDBAAD',
        'BBBBAABBBBBBAABB',
        'EEBDEEEEFEEEEEBD',
        'EFBDEEEEEEEFEEBD',
        'EEBDEEEFEEEEEDBD',
        'EDBBDEEEEEEEDBBD',
        'DBBADDDDDDDDBBAD',
        'BAABBBBBBBBBAABB',
        'EEEEEFEBDEEEEEEE',
        'EEFEEEEBDEEFEEEE',
        'DEEEEEDBBDEEEEED',
        'BDDDDDBBABDDDDDB',
        'AAAAAAAAAAAAAAAA',
    ],
    'course': [   # 둥근 자갈 둘레: 크기가 다른 자갈 셋, 사이 흙 o
        'oqqqoooqqqqooqqo',
        'qedeqoqeeddqoqed',
        'qddcqoqedddcqqdd',
        'oqcqoqqddcdcqocq',
        'oooooqedcqqqoooo',
        'qqeqoqdcqoqqeeqo',
        'qedcqoqqoqeddcqo',
        'oqqooooooqqqqqoo',
    ],
    'floor': [   # 닳은 판돌: 8줄 두 층, 위층 이음 0열 · 아래층 8열, 판 모서리는 닳아 둥글다(n)
        'olllllllllllllll',
        'olmmmmmmmlmmmmmm',
        'olmmmmmmmmmmmlmm',
        'olmmlmmmmmmmmmmm',
        'olmmmmmmmmmmmmmm',
        'olmmmmmmmmmlmmmm',
        'nmmmmmmmmmmmmmmn',
        'oonnnnnnnnnnnnno',
        'llllllllolllllll',
        'mmmmmmmnolmmmmmm',
        'mmlmmmmnolmmmmlm',
        'mmmmmmmnolmmmmmm',
        'mmmmmmmnolmmlmmm',
        'mlmmmmmnolmmmmmm',
        'mmmmmmmmnmmmmmmm',
        'nnnnnnnnonnnnnnn',
    ],
    'floor_var': [[
        'olllllllllllllll',
        'olmmmmmmmlmmmmmm',
        'olmmmmnmmmmmmlmm',
        'olmmmmmnmmmmmmmm',
        'olmmmmmmnnmmmmmm',
        'olmmmmmmmmnmmmmm',
        'nmmmmmmmmmmmmmmn',
        'oonnnnnnnnnnnnno',
        'llllllllolllllll',
        'mmmmmmmnolmmmmmm',
        'mLLlmmmnolmmmmlm',
        'mLLLmmmnolmmmmmm',
        'mmLmmmmnolmmlmmm',
        'mlmmmmmnolmmmmmm',
        'mmmmmmmmnmmmmmmm',
        'nnnnnnnnonnnnnnn',
    ]],
    'iface_shift': 0,
    'tread': ['ffffffffffffffff', 'eedeeeefeeedeeee', 'deeeeedeeeeeedee', 'eeeceeeeedeeeeed', 'edeeeeeeeeeceeee',
              'eeeeedeeeeeeedee', 'deeeeeeeceeeeeee', 'eeeedeeeeeedeeec', 'eceeeeeeeeeeeeee', 'eeeeeeedeeeeeeee'],
    'riser': ['c', 'b', 'a', 'a'],
    'support': 'b',
}

# A1 지붕층 성가퀴: 바깥 끝 5행에 서는 머리. 세 가지 — 곧은 머리 · 귀 떨어진 머리 · 낮게 닳은 머리. '.' = 총안(낮은 띠 그대로)
MERLONS = [
    {'top': ['.QQQQQQQQQk.....', '.lllllQllll.....', '.llgllllllw.....', '.llllllglll.....', '.wwwwwwwwww.....'],
     'face': ['.DBBBBBBBBJ.....', '.DBBCBBBBBJ.....', '.JBBBBBBBJJ.....', '.KJJJJJJJJK.....'], 'raise': 4},
    {'top': ['...QQQQQQQk.....', '..Qllllllll.....', '.wllQllllgw.....', '.lllllllllw.....', '.wwwwwwwwww.....'],
     'face': ['...BBBBBBBJ.....', '..DBBBBCBBJ.....', '.DBBBBBBBBJ.....', '.KJJJJJJJJK.....'], 'raise': 4},
    {'top': ['.QQQQQQQ.........', '.lllglllQ........', '.llllllll.......', '.lQlllllw.......', '.wwwwwwww.......'],
     'face': ['.DBBBBBBJ.......', '.KJJJJJJK.......'], 'raise': 2},
    {'top': ['.QQQQQQQQQQk....', '.llllllgllll....', '.lQllllllllw....', '.llllllllgll....', '.wwwwwwwwwww....'],
     'face': ['.DBBBBBBBBBJ....', '.DBBBBCBBBBJ....', '.DBBBBBBBBBJ....', '.KJJJJJJJJJK....'], 'raise': 4},
]
for _m in MERLONS:
    _m['top'] = [r[:16].ljust(16, '.') for r in _m['top']]

# 띠 + 판석 = 19px 이므로 한 칸에 바닥과 링 바깥이 같이 들지 않는다 — 아래 _check_cells 가 모듈 읽을 때 확인한다.


# ------------------------------------------------------------------------------------------------ 링 렌더
def _shift(ch, k, chain):
    if k == 0 or ch not in chain:
        return ch
    return chain[max(0, min(len(chain) - 1, chain.index(ch) + k))]


def ring(c, Ro, Lx=0, Ly=0, roof=False):
    """후보 c, 바깥 반지름 Ro(64 = 8칸 · 96 = 12칸), 가로 이음 Lx · 세로 이음 Ly px. 반환 (Cv, 화소 종류 dict, 기하 dict, top 여백).
    종류: band 띠 · face 안벽 앞면 · course 둘레 판석 · floor 보이는 바닥(투명) · out 링 바깥(투명)."""
    Ri, Rc = Ro - BAND, Ro - BAND - COURSE
    top = T if roof else 0
    wh = 10 if roof else WALL_H      # 지붕층: 안벽 대신 낮은 성가퀴 안쪽 면(10px)
    W, H = 2 * Ro + Lx, top + 2 * Ro + Ly
    cx, cy = Ro, top + Ro
    leg, chain = c['leg'], c['chain']
    cv = Cv(W, H)
    kind, geo = {}, {}
    for y in range(H):
        for x in range(W):
            stx = sty = None
            if x < cx:
                sx = x + 0.5 - cx
            elif x >= cx + Lx:
                sx = x + 0.5 - cx - Lx
            else:
                sx, stx = 0.0, x - cx
            if y < cy:
                sy = y + 0.5 - cy
            elif y >= cy + Ly:
                sy = y + 0.5 - cy - Ly
            else:
                sy, sty = 0.0, y - cy
            north = y < cy
            if _in(Ro, sx, sy) and not _in(Ri, sx, sy):
                k = 'band'
            elif _in(Ri, sx, sy):
                infl = _in(Ri, sx, sy - wh)
                if north and not infl and abs(sx) < FACE_END * Ri:
                    k = 'face'
                elif not _in(Rc, sx, sy):
                    k = 'course'
                    geo[x, y, 'cc'] = 'top'
                elif north and abs(sx) < FACE_END * Ri and infl and not _in(Rc, sx, sy - wh):
                    k = 'course'
                    geo[x, y, 'cc'] = 'floor'
                else:
                    k = 'floor'
            else:
                k = 'out'
            kind[x, y] = k
            geo[x, y] = (sx, sy, stx, sty, north)
    itop = {}
    for x in range(W):
        for y in range(H):
            if kind[x, y] in ('face', 'floor', 'course') and y < cy:
                itop[x] = y
                break

    def arc_t(sx, sy, stx, sty, north, x, y, R):
        if stx is not None:
            return stx
        if sty is not None:
            return sty
        th = math.atan2(sx, -sy) if north else math.atan2(sx, sy)
        return R * th

    for y in range(H):
        for x in range(W):
            k = kind[x, y]
            sx, sy, stx, sty, north = geo[x, y]
            if k == 'band':
                r = abs(sy) if stx is not None else abs(sx) if sty is not None else math.hypot(sx, sy)
                s = max(0, min(BAND - 1, int(Ro - r)))
                ti = int(math.floor(arc_t(sx, sy, stx, sty, north, x, y, Ro - BAND / 2))) % 16
                if not north and (y == cy or y == cy + Ly) and sty is None or (sty == 0):
                    ti = 0                                    # 북·남 반원(또는 세로 이음)이 만나는 줄 = 갓돌 이음
                ch = c['band'][s][ti]
                south_front = (not north and sty is None and (stx is not None or abs(sx) < 0.8 * Ro))
                if south_front and s < len(c['front']):
                    ch = c['front'][s]                        # 남쪽 바깥 끝 턱
                cv.put(x, y, leg[ch])
            elif k == 'face':
                v = y - itop[x]
                u = stx if stx is not None else Ri * math.asin(max(-1.0, min(1.0, sx / Ri)))
                ch = c['face'][min(v, 31)][int(math.floor(u)) % 16]
                f = sx / Ri if stx is None else 0.0
                sh = (-2 if f < -0.82 else -1 if f < -0.62 else 0) if f < 0 else (-1 if f > 0.85 else 0)
                cv.put(x, y, leg[_shift(ch, sh + c['iface_shift'], chain)])
            elif k == 'course':
                if geo[x, y, 'cc'] == 'top':
                    r = abs(sy) if stx is not None else abs(sx) if sty is not None else math.hypot(sx, sy)
                    q = int(Ri - r)
                    t = arc_t(sx, sy, stx, sty, north, x, y, Ri - 4)
                else:
                    r = abs(sy - wh) if stx is not None else math.hypot(sx, sy - wh)
                    q = int(Ri - r)
                    t = stx if stx is not None else (Ri - 4) * math.atan2(sx, -(sy - wh))
                ch = c['course'][max(0, min(COURSE - 1, q))][int(math.floor(t)) % 16]
                cv.put(x, y, leg[ch])
    if roof:
        cells = []
        for (x, y), k in list(kind.items()):
            if k != 'band':
                continue
            sx, sy, stx, sty, north = geo[x, y]
            r = abs(sy) if stx is not None else abs(sx) if sty is not None else math.hypot(sx, sy)
            s = int(Ro - r)
            if s >= 5:
                continue
            t = arc_t(sx, sy, stx, sty, north, x, y, Ro - BAND / 2)
            blk = int(math.floor(t / 16))
            m = MERLONS[(blk * 5 + blk // 3 + (2 if north else 0)) % len(MERLONS)]
            ti = int(math.floor(t)) % 16
            if m['top'][s][ti] == '.':
                continue
            cells.append((y, x, s, ti, m))
        for y, x, s, ti, m in sorted(cells, key=lambda e: (e[0], e[1])):
            R = m['raise']
            for kk in range(R):
                fch = m['face'][R - 1 - kk][ti] if R - 1 - kk < len(m['face']) else '.'
                if fch != '.':
                    cv.put(x, y - kk, leg[fch])
            cv.put(x, y - R, leg[m['top'][s][ti]])
    # 안벽·둘레 판석 밑 접지 그림자: 앞면 바로 밑 바닥 2px(윗층 반투명, 투명 자리에만)
    for x in range(W):
        for y in range(1, H):
            if kind[x, y] == 'floor' and kind[x, y - 1] in ('face', 'course'):
                cv.shadow(x, y)
    return cv, kind, geo, top


def floor_cells(kind):
    """칸 → 아래층 종류. 'floor' 화소가 하나라도 있으면 바닥 타일, 아니면 어둠."""
    cells = {}
    for (x, y), k in kind.items():
        key = (x // T, y // T)
        if k == 'floor':
            cells[key] = 'floor'
        elif k == 'out':
            cells.setdefault(key + ('out',), True)
    return cells


def _check_cells(kind):
    f = floor_cells(kind)
    bad = [k for k, v in f.items() if v == 'floor' and (k[0], k[1], 'out') in f]
    if bad:
        raise AssertionError(f'한 칸에 바닥과 링 바깥이 같이 든다: {bad[:4]}')


VOID = grid(['aaaaaaaaaaaaaaaa', 'aaaaaaaaaaaaabaa', 'aaaaaaaaaaaaaaaa', 'aaaabaaaaaaaaaaa',
             'aaaaaaaaaaaaaaaa', 'aaaaaaaaaaaaaaaa', 'aaaaaaaaaabaaaaa', 'aaaaaaaaaaaaaaaa',
             'aaaaaaaaaaaaaaaa', 'abaaaaaaaaaaaaaa', 'aaaaaaaaaaaaaaaa', 'aaaaaaaaaaaaaaba',
             'aaaaaaabaaaaaaaa', 'aaaaaaaaaaaaaaaa', 'aaaaaaaaaaaaaaaa', 'aaaaaaaaaaaaaaaa'],
            legend(a=('void', 0), b=('void', 1)))


def floor_tiles(c):
    """바닥 몸통 둘 : 변형 하나(변형이 반이면 금이 무늬처럼 반복된다). 장면은 dot.cell_hash 로 고른다."""
    base = grid(c['floor'], c['leg'])
    return [base, base] + [grid(v, c['leg']) for v in c.get('floor_var', [])]


def under(kind, w, h, c, ox=0, oy=0):
    """링 아래층(칸마다 바닥 또는 어둠)."""
    cells = floor_cells(kind)
    fl = floor_tiles(c)
    out = Cv(w, h)
    for j in range(h // T):
        for i in range(w // T):
            t = fl[dot.cell_hash(i + ox, j + oy) % len(fl)] if cells.get((i, j)) == 'floor' else VOID
            out.a[j * T:(j + 1) * T, i * T:(i + 1) * T] = t.a
    return out


def actor():
    return Cv.of(dot.actor1_frame(1, 0, 0))


# 앞면 좌표(u: 둘레 길이, v: 띠 아래 깊이) 표. '.' = 앞면 결 그대로. 가운데 열 = u0. 장면에서는 그 자리 앞면 화소를 바꾼다.
# ------------------------------------------------------------------------------------------------ 화살 구멍 창
# 14열 × 32행(앞면 v, 0 = 띠 바로 밑). 바깥(앞) 너비 8px 의 벌어진 창 옆면이 안쪽 1px 틈으로 좁아진다(사선 구멍, 받침돌 없음).
# 왼 옆면(동쪽을 봄 — 그늘) K J · 틈 ; · 오른 옆면(서쪽을 봄 — 빛) B C D · 위 상인방 X · 밑 비탈(창턱 비탈 윗면 3줄) · 비탈 끝 J.
# 빛 모습: 틈 안이 바깥 하늘빛(쇠 램프의 옅은 청회색 u v) — 유리가 아니라 열린 틈, 양쪽 옆면이 빛을 받는다.
def _win(rows):
    assert len(rows) <= 32 and all(len(r) == 14 for r in rows), [len(r) for r in rows]
    return rows + ['.' * 14] * (32 - len(rows))


_E = ['..............'] * 2
WIN = {
    'A1': {
        'dark': _win(_E + ['....XXXXXX....', '...XJKKKBCJ...', '...XJK;KBCJ...']
                     + ['...XJK;BCDJ...'] * 6 + ['...XJ;;;;DJ...', '...XK;;;;CJ...']
                     + ['...XJK;BCDJ...'] * 8 + ['...XJJKBCDJ...', '...XDDDDDDJ...', '...XXXXXXXJ...', '...XYXXXXXJ...',
                                                 '...JJJJJJJJ...'] + ['..............'] * 5),
        'lit': _win(_E + ['....XXXXXX....', '...XCBBBXYJ...', '...XCBuvXYJ...']
                    + ['...XCBvuXYJ...'] * 6 + ['...XCvuuuYJ...', '...XCuuuvXJ...']
                    + ['...XCBvuXYJ...'] * 8 + ['...XCCvXYYJ...', '...XYYYYYYJ...', '...XYYXYYYJ...', '...XYYYYXYJ...',
                                                '...JJJJJJJJ...'] + ['..............'] * 5),
    },
    'A2': {
        'dark': _win(_E + ['....ffffff....', '...fBAAADEA...', '...FBA;ADEA...']
                     + ['...FBA;DEFA...', '...EBA;DEFB...'] * 7 + ['...FBA;DEFA...', '...EBA;DEFB...',
                                                                   '...FBBADEFA...', '...FEEEEEEA...', '...FFFFFFFA...',
                                                                   '...FFGFFFFA...', '...AAAAAAAA...'] + ['..............'] * 6),
        'lit': _win(_E + ['....ffffff....', '...fDBBBFGA...', '...FDBuvFGA...']
                    + ['...FDBvuFGA...', '...EDBvuFGB...'] * 7 + ['...FDBvuFGA...', '...EDBvuFGB...',
                                                                  '...FDDvFGGA...', '...FGGGGGGA...', '...FGGFGGGA...',
                                                                  '...FGGGGFGA...', '...AAAAAAAA...'] + ['..............'] * 6),
    },
}
SILL = {'A1': [22, 24], 'A2': [22, 24]}   # 창 밑 비탈 윗면 행(3줄) — 그 밑 줄이 비탈 끝(어두움)
WIN_LEG = {';': ('void', 0), ',': ('void', 2), 'u': ('iron', 5), 'v': ('iron', 4)}
# 계단참 뒤 안벽 문(14열): 상인방 끝 X·f, 문설주, 문 안 어둠 8px × 16줄 — 1배에서 문으로 읽히게 띠 바로 밑부터 계단참까지
ARCH = {
    'A1': ['.XXXXXXXXXXXX.', 'XDDDDDDDDDDDDJ', 'XJK,,,,,,,,KJJ'] + ['XJ;;;;;;;;;;JJ'] * 14 + ['XJJJJJJJJJJJJJ'],
    'A2': ['.ffffffffffffe', 'feeeeeeeeeeedA', 'EDB,,,,,,,,BDA'] + ['FDB;;;;;;;;BBA', 'EDB;;;;;;;;BDA'] * 7 + ['FBBBBBBBBBBBBA'],
}


def overlay_leg(c):
    leg = dict(c['leg'])
    leg.update(legend(**WIN_LEG))
    return leg


def carve(cv, kind, geo, Ro, rows, u0, leg, only='face', v0=0):
    """앞면 좌표 표 rows 를 둘레 u0 자리에 붙인다(그 자리 앞면 화소만 바꾼다). v0 = 표 첫 줄이 놓이는 앞면 깊이."""
    Ri = Ro - BAND
    w = len(rows[0])
    itop = {}
    for (x, y), k in kind.items():
        if k == 'face':
            itop[x] = min(itop.get(x, y), y)
    for (x, y), k in kind.items():
        if k != only:
            continue
        sx, sy, stx, sty, north = geo[x, y]
        u = stx if stx is not None else Ri * math.asin(max(-1.0, min(1.0, sx / Ri)))
        col = int(math.floor(u - u0 + w / 2))
        v = y - itop[x] - v0
        if 0 <= col < w and 0 <= v < len(rows) and rows[v][col] != '.':
            cv.put(x, y, leg[rows[v][col]])


def window(key, c, look):
    """한 모습 16×32: 앞면 위에 그대로 얹는 평평한 판(0~31행 = 앞면 2단)."""
    cv = Cv(T, 32)
    stamp(cv, WIN[key][look], overlay_leg(c), 1, 0)
    return cv


def place_window(cv, kind, geo, Ro, key, c, look, u0):
    carve(cv, kind, geo, Ro, WIN[key][look], u0, overlay_leg(c))


# ------------------------------------------------------------------------------------------------ 벽 계단(12칸 링 북서 안벽, 돌아 오르는 쐐기 디딤판)
# 벽에 박아 내민 쐐기 디딤판. 손 표: 단마다 (벽 쪽 시작 각, 끝 각, 안쪽 반지름, 높이 px) — 각은 북쪽에서 서쪽으로 잰 도(90 = 정서).
# 디딤판은 바닥 원(안벽 밑선, 중심 = 링 중심에서 32px 아래) 위의 쐐기 — 벽 쪽(바깥 반지름 Ri+3)이 넓고 방 쪽으로 좁아진다 —
# 를 높이만큼 위로 올려 그린다. 서쪽(낮음)에서 북쪽(높음)으로 감아 오르므로 단마다 조금씩 돌아간다.
# 그리는 것: 디딤판 윗면 + 아래 단 쪽 지름 변 밑 챌판(단 높이 3줄, 남서를 봄) + 방 쪽 끝 2줄 판 두께 + 바닥·벽에 지는 그림자.
# 받침 덩어리·옆면 없음. 맨 위 계단참 뒤 안벽에 문(ARCH)을 판다 — 문 밑이 계단참 높이.
RISE = 3
STEPS = {
    'A1': [(90, 79, 66, 3), (79, 68, 66, 6), (68, 57, 66, 9), (57, 46, 66, 12), (46, 24, 62, 15)],
    'A2': [(90, 78, 65, 3), (78, 67, 67, 6), (67, 56, 65, 9), (56, 45, 67, 12), (45, 23, 62, 15)],
}
STAIR_RO = 96


def _wedge(fcx, fcy, a0, a1, rin, rout, e, n=8):
    pts = []
    for k in range(n + 1):
        a = math.radians(a0 + (a1 - a0) * k / n)
        pts.append((fcx - rout * math.sin(a), fcy - rout * math.cos(a) - e))
    for k in range(n, -1, -1):
        a = math.radians(a0 + (a1 - a0) * k / n)
        pts.append((fcx - rin * math.sin(a), fcy - rin * math.cos(a) - e))
    return pts


def _inside(pts, x, y):
    n, ok = len(pts), False
    for i in range(n):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % n]
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
            ok = not ok
    return ok


def _fill(pts):
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    out = set()
    for y in range(int(min(ys)) - 1, int(max(ys)) + 2):
        for x in range(int(min(xs)) - 1, int(max(xs)) + 2):
            if _inside(pts, x + 0.5, y + 0.5):
                out.add((x, y))
    return out


def stair_layer(key, c):
    """12칸 링 좌표의 계단 그림(투명 바탕). 계단참 뒤 문은 안벽 앞면에 파 넣은 것까지 포함."""
    Ro = STAIR_RO
    Ri = Ro - BAND
    rv, kind, geo, top = ring(c, Ro)
    fcx, fcy = Ro, top + Ro + WALL_H
    leg = c['leg']
    cv = Cv(rv.w, rv.h)
    steps = STEPS[key]
    a0, a1, _, e = steps[-1]
    am = math.radians(a1 - 5)                     # 문은 계단참 동쪽 끝 바로 옆 — 앞을 가리는 디딤판이 없어 1배에서 문으로 읽힌다
    u_door = Ri * math.asin(-math.sin(am) * (Ri + 3) / Ri if math.sin(am) * (Ri + 3) < Ri else -1)
    carve(cv, kind, geo, Ro, ARCH[key], u_door, overlay_leg(c), v0=WALL_H - e - len(ARCH[key]))
    tread = c['tread']
    painted = {}
    for i in range(len(steps) - 1, -1, -1):
        a0, a1, rin, e = steps[i]
        rout = Ri + 3
        top_px = _fill(_wedge(fcx, fcy, a0, a1, rin, rout, e))
        # 챌판: 아래 단 쪽(a0) 지름 변을 높이 e-RISE … e 로 쓸어 내린 띠(남서를 보는 면). 위 줄일수록 밝다.
        riser = {}
        a = math.radians(a0)
        for q in range(0, 81):
            r = rin + (rout - rin) * q / 80
            fx, fy = fcx - r * math.sin(a), fcy - r * math.cos(a)
            for k in range(0, RISE + 1):
                p = (int(math.floor(fx)), int(math.floor(fy - e + k)))
                riser[p] = min(riser.get(p, 9), k)
        # 방 쪽 판 두께 2줄(안쪽 호 밑)
        edge = set()
        for k in (1, 2):
            for (x, y) in _fill(_wedge(fcx, fcy, a0, a1, rin, rin + 1.5, e - k)):
                edge.add((x, y))
        for (x, y) in sorted(set(riser) | edge):
            if (x, y) in top_px or kind.get((x, y)) in ('band', 'out', None):
                continue
            if (x, y) in riser:
                ch = c['riser'][min(len(c['riser']) - 1, riser[x, y])]
            else:
                ch = c['riser'][1]
            cv.put(x, y, leg[ch])
            painted[x, y] = i
        for (x, y) in top_px:
            if kind.get((x, y)) in ('band', 'out', None):
                continue
            below = (x, y + 1) not in top_px
            ch = c['tread'][0][(x + 5 * i) % 16] if below else tread[1 + (y % (len(tread) - 1))][(x + 5 * i) % 16]
            cv.put(x, y, leg[ch])
            painted[x, y] = i
    # 그림자: 디딤판 밑 바닥(디딤판 높이만큼 아래로, 방 쪽) — 반투명, 바닥 자리에만
    for (x, y), i in list(painted.items()):
        e = steps[i][3]
        for d in range(1, e + 1):
            yy = y + d
            if (x, yy) not in painted and kind.get((x, yy)) == 'floor' and cv.a[yy, x, 3] == 0:
                cv.shadow(x, yy)
                break
    return cv


def stair_box(key, c):
    import numpy as np
    cv = stair_layer(key, c)
    ys, xs = np.nonzero(cv.a[:, :, 3])
    bx, by = (xs.min() // T) * T, (ys.min() // T) * T
    bw = ((xs.max() - bx) // T + 1) * T
    bh = ((ys.max() - by) // T + 1) * T
    return cv, bx, by, bw, bh


def stair(key, c):
    cv, bx, by, bw, bh = stair_box(key, c)
    return cv.crop(bx, by, bw, bh), bx, by


# ------------------------------------------------------------------------------------------------ 문·통로(원 가운데 칸)
DOOR_N = {   # 북쪽 안벽 가운데 아치 문(16열, 앞면 v 0~31). 문 안 어둠 10px
    'A1': ['..XXXXXXXXXXXX..', '.XDDDDDDDDDDDDJ.', '.XJK,,,,,,,,KJJ.'] + ['.XJ;;;;;;;;;;JJ.'] * 29,
    'A2': ['.fffffffffffffe.', 'feeeeeeeeeeeeedA', 'EDB,,,,,,,,,,BDA'] + ['FDB;;;;;;;;;;BBA', 'EDB;;;;;;;;;;BDA'] * 14 + ['FDB;;;;;;;;;;BBA'],
}
PASS_HALF = 13    # 남 통로: 가운데에서 좌우 13px 띠를 끊는다(통로 26px). 끝 2px = 띠 마구리(밝은 끝)
THRESH = {   # 통로 문턱 판석(띠 자리, 16열 × 띠 깊이 11줄, 0 = 바깥) — 띠보다 한 단 낮고 어둡게, 판석 이음
    'A1': ['bbbbbbbbbbbbbbbb', 'biiiiiiibiiiiiii', 'bGGGGGGGbGGGiGGG', 'bGGiGGGGbGGGGGGG', 'bGGGGGGGbGGGGGGG',
           'bGGGGGhGbGGGGGGG', 'bGGGGGGGbGGGGhGG', 'biiiiiiibiiiiiii', 'bbbbbbbbbbbbbbbb', 'aiiiiiiiaiiiiiii', 'bbbbbbbbbbbbbbbb'],
    'A2': ['oooooooooooooooo', 'olllllllolllllll', 'ommmmmmmommmlmmm', 'ommlmmmmommmmmmm', 'ommmmmmmommmmmmm',
           'ommmmmlmommmmmmm', 'ommmmmmmommmmlmm', 'onnnnnnnonnnnnnn', 'oooooooooooooooo', 'lnnnnnnnlnnnnnnn', 'oooooooooooooooo'],
}
JAMB = {'A1': 'W', 'A2': 'f'}


def cut_door(cv, kind, geo, Ro, c):
    carve(cv, kind, geo, Ro, DOOR_N[c['name']], 0.0, overlay_leg(c))


def cut_passage(cv, kind, geo, Ro, c):
    """남쪽 띠 가운데를 끊어 문턱 판석을 깐다. 끊긴 띠 끝 2px 는 밝은 마구리."""
    leg = c['leg']
    for (x, y), k in kind.items():
        if k != 'band':
            continue
        sx, sy, stx, sty, north = geo[x, y]
        if north or sty is not None:
            continue
        r = math.hypot(sx, sy) if stx is None else abs(sy)
        s = max(0, min(BAND - 1, int(Ro - r)))
        if abs(sx) < PASS_HALF:
            cv.put(x, y, leg[THRESH[c['name']][s][int(x) % 16]])
        elif abs(sx) < PASS_HALF + 2:
            cv.put(x, y, leg[JAMB[c['name']]])


def corridor(c, Ro, n=2):
    """남 통로 밖으로 이어지는 복도 한 자락(장면용): 바닥 타일 2칸 폭 + 좌우 세로 띠(서·동 이음의 띠)."""
    ry, ky, _, _ = ring(c, Ro, Ly=n * T)
    w = 2 * Ro
    out = Cv(w, n * T)
    fl = floor_tiles(c)
    for j in range(n):
        for i in range(w // T):
            t = fl[dot.cell_hash(i, j + 50) % len(fl)] if abs(i * T + 8 - Ro) < T else VOID
            out.a[j * T:(j + 1) * T, i * T:(i + 1) * T] = t.a
    wb = ry.crop(0, Ro, BAND, n * T)          # 서쪽 세로 띠(바깥 = 왼쪽)
    eb = ry.crop(ry.w - BAND, Ro, BAND, n * T)
    out.paste(wb, Ro - PASS_HALF - BAND + 2, 0)
    out.paste(eb, Ro + PASS_HALF - 2, 0)
    return out


# ------------------------------------------------------------------------------------------------ 키트
SIZES = ((96, '12칸'), (80, '10칸'), (64, '8칸'))


def kit(c):
    """조각 dict 와 키트 판 그림(12칸 | 10칸 | 8칸 링 | 이음·문)."""
    parts = {}
    rings = {}
    for Ro, lab in SIZES:
        rv, kind, geo, top = ring(c, Ro)
        _check_cells(kind)
        rings[Ro] = rv
        mid = top + Ro
        parts[f'{lab} 북서'] = rv.crop(0, 0, Ro, mid)
        parts[f'{lab} 북동'] = rv.crop(Ro, 0, Ro, mid)
        parts[f'{lab} 남서'] = rv.crop(0, mid, Ro, rv.h - mid)
        parts[f'{lab} 남동'] = rv.crop(Ro, mid, Ro, rv.h - mid)
    L2 = 2 * T   # 이음은 2칸 단위 — 세 크기 링이 같이 쓴다(가운데 열·행 단면이 띠 11 + 앞면 32 + 판석 8 로 같다)
    rx, kx, _, _ = ring(c, 64, Lx=L2)
    ry, ky, _, _ = ring(c, 64, Ly=L2)
    _check_cells(kx)
    _check_cells(ky)
    parts['북 이음(가로 반복)'] = rx.crop(64, 0, L2, 64)
    parts['남 이음(가로 반복)'] = rx.crop(64, rx.h - 32, L2, 32)
    parts['서 이음(세로 반복)'] = ry.crop(0, 64, 32, L2)
    parts['동 이음(세로 반복)'] = ry.crop(ry.w - 32, 64, 32, L2)
    # 문: 10칸 링 북쪽 가운데 2×4칸 / 통로: 8칸 링 남쪽 가운데 2×2칸 (다른 크기도 같은 cut_door·cut_passage 로 판다)
    r10, k10, g10, _ = ring(c, 80)
    cut_door(r10, k10, g10, 80, c)
    parts['10칸 북 문(가운데 2칸)'] = r10.crop(80 - T, 0, 2 * T, 64)
    r8, k8, g8, _ = ring(c, 64)
    cut_passage(r8, k8, g8, 64, c)
    parts['8칸 남 통로(가운데 2칸)'] = r8.crop(64 - T, 128 - 32, 2 * T, 32)
    # 키트 판(조각을 칸 경계 그대로 붙인 그림): 12칸 | 10칸 | 8칸 | 이음·문 열(4칸)
    W = (12 + 1 + 10 + 1 + 8 + 1 + 4) * T
    board = Cv(W, 12 * T)
    x = 0
    for Ro, _ in SIZES:
        board.paste(rings[Ro], x, 0)
        x += 2 * Ro + T
    board.paste(parts['북 이음(가로 반복)'], x, 0)
    board.paste(parts['10칸 북 문(가운데 2칸)'], x + 2 * T, 0)
    board.paste(parts['남 이음(가로 반복)'], x, 5 * T)
    board.paste(parts['8칸 남 통로(가운데 2칸)'], x + 2 * T, 5 * T)
    board.paste(parts['서 이음(세로 반복)'], x, 8 * T)
    board.paste(parts['동 이음(세로 반복)'], x + 2 * T, 8 * T)
    return parts, board


def exploded(cv, gap=2):
    """16px 칸마다 gap px 띄운 그림 — 조각이 칸 단위라는 것을 보이는 격자 보기(빈 칸은 뺀다)."""
    nx, ny = cv.w // T, cv.h // T
    out = Cv(nx * (T + gap) + gap, ny * (T + gap) + gap)
    out.a[:, :, :3] = dot.C('void', 2)
    out.a[:, :, 3] = 255
    for j in range(ny):
        for i in range(nx):
            cell = cv.a[j * T:(j + 1) * T, i * T:(i + 1) * T]
            X, Y = gap + i * (T + gap), gap + j * (T + gap)
            if cell[:, :, 3].any():
                out.a[Y:Y + T, X:X + T, :3] = dot.C('void', 0)
                c2 = Cv(T, T)
                c2.a[:] = cell
                out.paste(c2, X, Y)
    return out


def roof_parts(c):
    rv, kind, _, top = ring(c, 64, roof=True)
    mid = top + 64
    return {'지붕층 8칸 북서': rv.crop(0, 0, 64, mid), '지붕층 8칸 북동': rv.crop(64, 0, 64, mid),
            '지붕층 8칸 남서': rv.crop(0, mid, 64, rv.h - mid), '지붕층 8칸 남동': rv.crop(64, mid, 64, rv.h - mid)}, rv


# ------------------------------------------------------------------------------------------------ 장면
def hcat(cvs, gap=T):
    w = sum(c.w for c in cvs) + gap * (len(cvs) + 1)
    h = max(c.h for c in cvs) + 2 * T
    out = Cv(w, h)
    for j in range(h // T):
        for i in range(w // T):
            out.a[j * T:(j + 1) * T, i * T:(i + 1) * T] = VOID.a
    x = gap
    for c in cvs:
        out.paste(c, x, T)
        x += c.w + gap
    return out


def tower_scene(key, c):
    """세 항목 공통 장면: 참 원 셋. 12칸(돌아 오르는 계단·화살 구멍 둘·사람) | 10칸(북 문) | 8칸(남 통로 + 복도)."""
    rv, kind, geo, top = ring(c, 96)
    place_window(rv, kind, geo, 96, key, c, 'dark', 2)
    place_window(rv, kind, geo, 96, key, c, 'lit', 36)
    s12 = under(kind, rv.w, rv.h, c)
    s12.paste(rv, 0, 0)
    s12.paste(stair_layer(key, c), 0, 0)
    s12.paste(actor(), 100, 110)
    r10, k10, g10, _ = ring(c, 80)
    cut_door(r10, k10, g10, 80, c)
    s10 = under(k10, r10.w, r10.h, c, 20, 0)
    s10.paste(r10, 0, 0)
    s10.paste(actor(), 76, 44)
    r8, k8, g8, _ = ring(c, 64)
    cut_passage(r8, k8, g8, 64, c)
    s8 = under(k8, r8.w, r8.h, c, 40, 0)
    s8.paste(r8, 0, 0)
    cor = corridor(c, 64)
    s8b = Cv(s8.w, s8.h + cor.h)
    s8b.paste(s8, 0, 0)
    s8b.paste(cor, 0, s8.h)
    s8b.paste(actor(), 52, 112)
    return hcat([s12, s10, s8b])


def c_wall(key, c):
    def fn():
        parts, board = kit(c)
        top_rows = {'북 이음(가로 반복)': [0, BAND - 1], '남 이음(가로 반복)': [32 - BAND + 2, 32 - 3]}
        extras = [('조각 격자 보기 — 16px 칸마다 띄움(12칸 · 10칸 · 8칸 링 · 이음 · 문·통로)', exploded(board), 2)]
        if key == 'A1':
            rp, rv = roof_parts(c)
            parts.update(rp)
            sc, kind, _, _ = ring(c, 64, roof=True)
            r = under(kind, sc.w, sc.h, c)
            r.paste(sc, 0, 0)
            extras.append(('지붕층 변형(성가퀴, 8칸) 2배', r, 2))
            out = Cv(board.w, board.h + T + rv.h)
            out.paste(board, 0, 0)
            out.paste(rv, 0, board.h + T)
            board = out
        return board, {'kind': 'objects', 'parts': parts, 'top_rows': top_rows, 'vignette': tower_scene(key, c), 'extras': extras}
    return fn


def c_stair(key, c):
    def fn():
        s, bx, by = stair(key, c)
        return s, {'kind': 'objects', 'parts': {'계단': s}, 'vignette': tower_scene(key, c)}
    return fn


def c_window(key, c):
    def fn():
        d, l = window(key, c, 'dark'), window(key, c, 'lit')
        out = Cv(32, 32)
        out.paste(d, 0, 0)
        out.paste(l, 16, 0)
        tr = SILL[key]
        return out, {'kind': 'objects', 'parts': {'어두운 구멍': d, '빛 드는 구멍': l}, 'vignette': tower_scene(key, c),
                     'top_rows': {'어두운 구멍': tr, '빛 드는 구멍': tr}}
    return fn


NOTES = {
    'gap.tower_wall': {'A1': '버들항 지하묘지 결: 반점 띠 + 옅은 턱, 어두운 벽돌 안벽, 둘레 판석. 12·10·8칸 사분면 + 이음 넷 + 북 문·남 통로 + 지붕층 성가퀴 변형',
                       'A2': '거친 막돌: 갓돌 띠 + 밝은 턱, 막돌 안벽, 자갈 둘레. 같은 조각 나눔(지붕층 없음)'},
    'gap.tower_stair': {'A1': '12칸 링 북서 안벽을 돌아 오르는 쐐기 디딤판 4단 + 계단참, 뒤 안벽 문. 디딤판 + 챌판 + 판 두께만', 'A2': '막돌 쐐기 디딤판, 갓돌 상인방 문'},
    'gap.tower_window': {'A1': '벽돌에 판 사선 화살 구멍(1px 틈, 십자) | 하늘빛 드는 같은 구멍', 'A2': '막돌 테 사선 구멍 | 하늘빛'},
}


def _noted(fn, note):
    def g():
        cv, meta = fn()
        meta['note'] = note
        return cv, meta
    return g


CANDIDATES = {
    'gap.tower_wall': {k: _noted(c_wall(k, c), NOTES['gap.tower_wall'][k]) for k, c in (('A1', A1), ('A2', A2))},
    'gap.tower_stair': {k: _noted(c_stair(k, c), NOTES['gap.tower_stair'][k]) for k, c in (('A1', A1), ('A2', A2))},
    'gap.tower_window': {k: _noted(c_window(k, c), NOTES['gap.tower_window'][k]) for k, c in (('A1', A1), ('A2', A2))},
}
