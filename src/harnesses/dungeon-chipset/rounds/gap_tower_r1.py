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
    # 띠(버들항 둥근 탑 윗띠처럼 둘레로 나눈 돌 덩이): w 바깥 끝 · j 덩이 이음 · l 덩이 몸 · y 엇갈린 덩이 몸 · Q 밝은 반점 · g 어두운 반점
    #   k 안쪽 그늘 줄 · W 안쪽 턱. 덩이 몸은 빛(왼쪽 위)을 따라 북서가 한 단 밝고 남동이 한 단 어둡다(band_chain 으로 옮김).
    # 앞면(벽돌): K 줄눈 · J 그늘 · B 몸 · C 밝은 반점 · D 왼 끝 빛 · X 윗줄 빛
    # 바닥(따뜻한 나무 널 — 버들항 탑 1층 서재 바닥 결): n 널 이음 · r 널 윗줄 빛 · o 몸 · p 나뭇결 · z 깊은 그늘
    # 문턱·통로(회색 깐 돌): b 줄눈 · i · G · h · a · L
    # 계단(탑 벽과 같은 회색 돌, 나무 바닥 위에서 또렷): R 디딤판 앞 턱 빛 · S 몸 · T 얼룩 · E 뒤 이음 · U 챌판 · V 챌판 밑
    'leg': legend(w=('cata', 3), j=('cata', 2), y=('cata', 4), l=('cata', 5), q=('stone', 4), Q=('stone', 5), g=('cata', 3),
                  k=('cata', 5), W=('stone', 5), f=('stone', 1),
                  K=('brick', 0), J=('brick', 1), B=('brick', 2), C=('brick', 3), D=('brick', 4), X=('brick', 5), Y=('brick', 6),
                  n=('wood', 1), r=('wood', 4), o=('wood', 3), p=('wood', 2), z=('wood', 0), s=('wood', 5),
                  b=('stone', 1), m=('cata', 0), i=('cata', 1), G=('cata', 2), h=('cata', 3), a=('cata', 5), L=('cata', 4),
                  R=('stone', 4), S=('cata', 5), T=('cata', 4), E=('cata', 3), U=('cata', 1), V=('stone', 1)),
    'chain': 'KJBCDXY',
    'band_chain': 'mijwylqQ',
    'contact': [4, 3, 2, 1, 1],   # 북 안벽 밑 둘레: 벽에서 q px 떨어진 줄을 몇 단 어둡게(맨 밑 1~2px = 접지 그늘)
    'band': [   # 0 = 바깥 끝 … 10 = 안 끝(턱). 둘레 48px 한 바퀴에 길이 7·9·5·10·9·8 의 덩이(이음 j) — 엄격히 엇갈리지 않는 한 켜
        'jjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjj',
        'jllQllljyyyyyyyyjlllljllllllllljyyyyyyyyjwwwwwww',
        'jlllllljyyyyyyyyjlllljlllgllllljyyyyyyyyjwwgwwww',
        'jlllllljyyyyQyyyjlllljllllllllljyyyyyyyyjwwwwwww',
        'jlllllljyyyyyyyyjlllljllllllllljyygyyyyyjwwwwwww',
        'jlllllljyyyyyyyyjlllljllllllllljyyyyyyyyjwwwgwww',
        'jlllglljyyyyyyyyjlllljllllllllljyyyyQyyyjwwwwwww',
        'jlllllljyyyyyyyyjllQljllllllllljyyyyyyyyjwwwwwww',
        'jlllllljyyyyyyyyjlllljllllllglljyyyyyyyyjwwwwwww',
        'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
        'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    ],
    'front': ['m', 'i'],            # 남쪽 바깥 끝 2px 턱(0 = 맨 바깥) — 남쪽을 보는 바깥 면이라 그늘
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
    'floor': [   # 세로 나무 널(버들항 탑 바닥 결): 널 4px = 이음 n + 왼 빛 열 + 몸, 널마다 색조가 다르고 맞댄 이음(z)·결(p)은 칸마다 다르다
        'nroononpnrronoop',
        'nroononpnrronzzz',
        'nrponoppnrronroo',
        'nrponoppnrronoop',
        'nrponoppnrronoop',
        'nzzznoppnrronoop',
        'nrrrnoppnrrpnoop',
        'nroonoppnrrpnoop',
        'nroononpnrrpnoop',
        'nrponoppnrronoop',
        'nrponoppnrronoop',
        'nroonoppnrronoop',
        'nroonzzznrronoop',
        'nroonroonrronoop',
        'nroonoppnrrpnoop',
        'nroonoppnrronoop',
    ],
    'floor_var': [[
        'nroonoppnrronoop',
        'nroonoppnrronoop',
        'nroonoppnrronopp',
        'nroonzzznrronopp',
        'nroonroonrronopp',
        'nropnoppnrronoop',
        'nropnoppnrronoop',
        'nropnoppnrronoop',
        'nroonoppnrronoop',
        'nroonoppnzzznoop',
        'nroonoppnrrrnopp',
        'nroonoppnroonopp',
        'nropnoppnroonoop',
        'nroonoppnroonoop',
        'nroonoppnrronzzz',
        'nroonoppnrronroo',
    ], [
        'nroonoppnrronoon',
        'nroonoppnrronoop',
        'nroonoppnzzznoop',
        'nroonoppnrrrnoop',
        'nrponoppnrronoop',
        'nrponoppnrronoop',
        'nrponoppnrronoop',
        'nrponoppnrronzzz',
        'nroonoppnnronroo',
        'nroonopnnpronoop',
        'nroonopnnrronoop',
        'nroonopnnrronoon',
        'nroonoppnrronoon',
        'nzzznoppnrronoon',
        'nrrrnoppnrronoop',
        'nroonoppnrronoop',
    ]],
    'floor_mix': [0, 1, 2, 0],
    'dark': {'s': 'r', 'r': 'o', 'o': 'p', 'p': 'n', 'n': 'z', 'z': 'z'},
    'iface_shift': 0,
    # 계단(벽을 따라 오르는 좁은 디딤판 여럿): 윗면 몸 S + 얼룩 T, 앞(남) 끝 턱 R, 뒤 이음 E, 판 두께 줄 U U V
    'tread': ['SSSTSSSSSSSSSSSS', 'SSSSSSSSSTSSSSSS', 'STSSSSSSSSSSSSTS', 'SSSSSSTSSSSSSSSS'],
    'lip': 'R', 'joint': 'E', 'slab': ['U', 'U', 'V'],
}

A2 = {
    'name': 'A2',
    # 띠(거친 갓돌, 밝은 회색): a~e crock 2~6, 턱 f(stone 5). 앞면 막돌(어둡게): A~G brick 0~5
    # 바닥·둘레(닳은 베이지 판돌): P 줄눈 · M 그늘 · N 몸 · R 엇갈린 몸 · O 판 윗·왼 가장자리 빛
    # 계단(나무 디딤판 + 막돌 몸): I 디딤판 앞 턱 · H 몸 · J 나뭇결 · K 챌판 위 · V 챌판 · Z 밑 · 몸 앞면 a·b
    'leg': legend(a=('crock', 2), b=('crock', 3), c=('crock', 4), d=('crock', 5), e=('crock', 6), f=('stone', 5),
                  A=('brick', 0), B=('brick', 1), D=('brick', 2), E=('brick', 3), F=('brick', 4), G=('brick', 5),
                  P=('cfloor', 0), M=('cfloor', 1), N=('cfloor', 3), R=('cfloor', 2), O=('cfloor', 5), Q=('cfloor', 6),
                  I=('wood', 5), H=('wood', 4), J=('wood', 3), K=('wood', 2), V=('wood', 1), Z=('wood', 0),
                  x=('crock', 1), z=('crock', 0),
                  S=('iron', 4), T=('iron', 3), U=('iron', 2), W=('iron', 5), Y=('iron', 1)),
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
    'floor': [   # 닳은 큰 판돌 — 칸마다 나눔이 다르다(셋 중 하나). 판 윗·왼 가장자리 O, 몸 N·R, 얼룩 M, 줄눈 P
        'OOOOOOOOOPOOOOOP',
        'ONNNNNNNNPORRRRP',
        'ONNNNNNNNPORRRRP',
        'ONNNMNNNNPORRRRP',
        'ONNNNNNNNPORRMRP',
        'ONNNNNNNNPORRRRP',
        'ONNNNNNNNPORRRRP',
        'PPPPPPPPPPORRRRP',
        'OOOOOPOOOPORRRRP',
        'ORRRRPONNPPPPPPP',
        'ORRRRPONNPOOOOOP',
        'ORRMRPONNPONNNNP',
        'ORRRRPONNPONNNNP',
        'ORRRRPONMPONNNNP',
        'ORRRRPONNPONNNNP',
        'PPPPPPPPPPPPPPPP',
    ],
    'floor_var': [[
        'OOOOOPOOOOOOOOOP',
        'ONNNNPORRRRRRRRP',
        'ONNNNPORRRRRRRRP',
        'ONMNNPORRRRRMRRP',
        'ONNNNPORRRRRRRRP',
        'ONNNNPPPPPPPPPPP',
        'ONNNNPOOOOOOOOOP',
        'ONNNNPONNNNNNNNP',
        'ONNNNPONNNNNNNNP',
        'PPPPPPONNNNMNNNP',
        'OOOOOPONNNNNNNNP',
        'ORRRRPONNNNNNNNP',
        'ORRRRPONNNNNMNNP',
        'ORMRRPONNNNNNNNP',
        'ORRRRPONNNNNNNNP',
        'PPPPPPPPPPPPPPPP',
    ], [
        'OOOOOOOOOOOOOOOP',
        'ONNNNNNNNNNNNNNP',
        'ONNNNNNRRNNNNNNP',
        'ONNNNNNNRNNNNNNP',
        'ONNNNMNNNNNNNNNP',
        'ONNNNNMNNNNNNNNP',
        'ONNNNNNMMNNNNNNP',
        'ONNNNNNNNMNNNNNP',
        'ONNRNNNNNNMNNNNP',
        'ONNNNNNNNNNMNNNP',
        'ONNNNNNNNNNNNNNP',
        'ONNNNNNNNNNNRNNP',
        'ONNNNNNNNNNNNNNP',
        'ONNNNNNNNNNNNNNP',
        'ONNNNNNNNNNNNNNP',
        'PPPPPPPPPPPPPPPP',
    ]],
    'floor_mix': [0, 1, 2, 0, 1],
    'iface_shift': 0,
    'dark': {'Q': 'O', 'O': 'N', 'N': 'R', 'R': 'M', 'M': 'P', 'P': 'P'},
    # 나선 계단(버들항 나선 계단 말): 나무 디딤판 — 앞 끝 턱 I · 몸 H · 결 J · 뒤 이음 K · 판 두께 V V Z
    'tread': ['HHHHJHHHHHHHHHHH', 'HHHHHHHHHHHJHHHH', 'JHHHHHHHHHHHHHHH', 'HHHHHHHJHHHHHHHH'],
    'lip': 'I', 'joint': 'K', 'slab': ['V', 'V', 'Z'],
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
                ti = int(math.floor(arc_t(sx, sy, stx, sty, north, x, y, Ro - BAND / 2))) % len(c['band'][0])
                if not north and (y == cy or y == cy + Ly) and sty is None or (sty == 0):
                    ti = 0                                    # 북·남 반원(또는 세로 이음)이 만나는 줄 = 갓돌 이음
                ch = c['band'][s][ti]
                bc = c.get('band_chain')
                if bc and s <= 9 and ch in bc:   # 빛(왼쪽 위): 북서 덩이 한 단 밝게, 남동 한 단 어둡게
                    vx, vy = (sx if stx is None else 0.0), (sy if sty is None else 0.0)
                    d = (-vx - vy) / (math.sqrt(2) * max(1e-6, math.hypot(vx, vy)))
                    ch = _shift(ch, 1 if d > 0.35 else -2 if d < -0.55 else -1 if d < -0.15 else 0, bc)   # 북서 한 단 밝게 · 남동 두 단 어둡게
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
                # 둘레 = 바닥 결 그대로(바닥 타일 0번과 같은 자리 글자) + 벽 밑 그늘: 북 안벽 밑은 2단·1단 띠, 다른 곳은 1px 옅게
                if geo[x, y, 'cc'] == 'top':
                    r = abs(sy) if stx is not None else abs(sx) if sty is not None else math.hypot(sx, sy)
                    q = int(Ri - r)
                    steps = 1 if q < 2 else 0
                else:
                    r = abs(sy - wh) if stx is not None else math.hypot(sx, sy - wh)
                    q = int(Ri - r)
                    cs = c.get('contact', [2, 2, 1, 1, 1])
                    steps = cs[q] if 0 <= q < len(cs) else 0
                ch = c['floor'][y % 16][x % 16]
                for _ in range(steps):
                    ch = c['dark'].get(ch, ch)
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
    tiles = [grid(c['floor'], c['leg'])] + [grid(v, c['leg']) for v in c.get('floor_var', [])]
    return [tiles[i] for i in c.get('floor_mix', [0, 0, 1])]


def under(kind, w, h, c, ox=0, oy=0):
    """링 아래층(칸마다 바닥 또는 어둠)."""
    cells = floor_cells(kind)
    fl = floor_tiles(c)
    base = grid(c['floor'], c['leg'])
    edge = {(x // T, y // T) for (x, y), k in kind.items() if k == 'course'}   # 둘레가 든 칸은 바닥 0번(둘레 결과 이어지게)
    out = Cv(w, h)
    for j in range(h // T):
        for i in range(w // T):
            if cells.get((i, j)) != 'floor':
                t = VOID
            elif (i, j) in edge:
                t = base
            else:
                t = fl[dot.cell_hash(i + ox, j + oy) % len(fl)]
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
        'lit': _win(_E + ['....XXXXXX....', '...XCYYYYCJ...', '...XCYvvYCJ...']
                    + ['...XYvuuvYJ...'] * 15 + ['...XCYvvYCJ...', '...XCYYYYCJ...',
                                                 '...XYYYYYYJ...', '...XYYXYYYJ...', '...XYYYYXYJ...',
                                                 '...JJJJJJJJ...'] + ['..............'] * 5),
    },
    'A2': {
        'dark': _win(_E + ['....ffffff....', '...fBAAADEA...', '...FBA;ADEA...']
                     + ['...FBA;DEFA...', '...EBA;DEFB...'] * 7 + ['...FBA;DEFA...', '...EBA;DEFB...',
                                                                   '...FBBADEFA...', '...FEEEEEEA...', '...FFFFFFFA...',
                                                                   '...FFGFFFFA...', '...AAAAAAAA...'] + ['..............'] * 6),
        'lit': _win(_E + ['....ffffff....', '...fDGGGGDA...', '...FDGvvGFA...']
                    + ['...FGvuuvGA...', '...EGvuuvGB...'] * 7 + ['...FGvuuvGA...', '...FDGvvGFA...', '...EDGGGGFB...',
                                                                  '...FGGGGGGA...', '...FGGFGGGA...',
                                                                  '...FGGGGFGA...', '...AAAAAAAA...'] + ['..............'] * 6),
    },
}
SILL = {'A1': [22, 24], 'A2': [22, 24]}   # 창 밑 비탈 윗면 행(3줄) — 그 밑 줄이 비탈 끝(어두움)
WIN_LEG = {';': ('void', 0), ',': ('void', 2), 'u': ('water', 4), 'v': ('water', 3)}   # 빛 틈 = 하늘빛(물 램프의 옅은 하늘색)
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
    carve(cv, kind, geo, Ro, WIN[key][look], u0, overlay_leg(c), v0=2)   # 띠 밑 4px 아래부터 — 벽 윗면 띠에 닿지 않게


COOL = __import__('numpy').array(dot.C('water', 4), dtype=float)


def light_patch(sc, kind, c, Ro, u0, top=0):
    """빛 드는 창 밑 바닥에 짧은 빛 쐐기: 바닥 글자를 한 단 밝게(c['dark'] 의 거꾸로). 끝 쪽은 엇갈려(바둑) 흐려진다."""
    Ri = Ro - BAND
    lm = {}
    for ch, d in c['dark'].items():
        if d != ch:
            lm[tuple(c['leg'][d])] = tuple(c['leg'][ch])
    sx = Ri * math.sin(u0 / Ri)
    x0 = Ro + sx
    y0 = top + Ro + WALL_H - math.sqrt(Ri * Ri - sx * sx)
    for d in range(2, 21):                    # 가는 빛 부채: 창 밑에서 넓어지다 끝이 둥글게 줄어든다(한 단, 바둑 없음)
        y = int(y0 + d)
        hw = 1.0 + min(d, 14) * 0.32 - max(0, d - 14) * 0.7
        xc = x0 + d * 0.3
        for x in range(int(xc - hw) - 1, int(xc + hw) + 2):
            if kind.get((x, y)) not in ('floor', 'course') or abs(x + 0.5 - xc) > hw:
                continue
            sc.a[y, x, :3] = (sc.a[y, x, :3] * 0.8 + COOL * 0.2).astype('uint8')   # 창 빛과 같은 차가운 하늘빛을 엷게 섞는다(장면 전용)


# ------------------------------------------------------------------------------------------------ 계단(12칸 링 북서)
# 3/4 쌓기 그리개: 바닥면의 발자국 화소마다 (들림 e, 판 두께) 를 주면 북 → 남 순으로 (x, y-e) 에 윗면, 그 밑 판 두께 줄을 찍는다.
# 남쪽(화면 아래) 것이 나중에 덮으므로 남쪽을 보는 면(챌판)만 남고 북·동·서를 보는 옆면은 저절로 가려진다.
# 판 두께가 얇아(3) 단 사이 챌판 띠는 2~3줄, 방 쪽 끝은 판 끝만 보이고 밑 바닥에 그림자가 진다.
#   A1 = 벽을 따라 오르는 좁은 돌 디딤판 7 + 계단참(설계 2): 단마다 둘레 6°(약 7px 깊이), 2px 씩 오르고, 계단참 옆 안벽에 문틀 문.
#   A2 = 쇠 기둥을 도는 나무 나선 계단(설계 1, 버들항 나선 계단 말): 둥근 돌 받침 위 디딤판 7(40° 씩, 3px 씩), 북쪽 맨 위 판이 벽에 닿는다.
STAIR_RO = 96
RUN = {'A1': {'steps': 5, 'a_lo': 84, 'deg': 8, 'rise': 3, 'land': 14, 'w': 11,
              # 단마다 (몸, 어두운 얼룩·이음, 밝은 얼룩, 앞 턱) — 벽 돌의 어두운 가운데 색조, 이웃 단은 엇갈린 색조
              'tones': [('w', 'j', 'y', 'l'), ('y', 'w', 'l', 'l'), ('w', 'j', 'y', 'l'), ('y', 'w', 'l', 'l'),
                        ('w', 'j', 'y', 'l'), ('y', 'w', 'l', 'l')],
              'riser': ['j', 'j', 'i'],    # 챌판 3줄: 디딤판(w·y)보다 두 단 이상 어둡다
              'side': ['m', 'i'],          # 챌판 밑 돌 몸: 몸 m(가장 어두운 돌) + 세로 이음 i
              # 계단참 뒤 안벽 문(16열): 돌 문설주(왼 l·y, 오른 y·w, 4줄마다 이음) + 2줄 상인방 + 어두운 문 안(K 그늘 · D 빛)
              'door': ['.llllllwlllllll.', '.yyyyyywyyyyyyy.', '.lyKKKKKKKKKKyw.', '.lyK,,,,,,,,Dyw.',
                       '.lyK;;;;;;;;Dyw.', '.wyK;;;;;;;;Dyw.', '.lyK;;;;;;;;Dyw.', '.lyK;;;;;;;;Dyw.',
                       '.lyK;;;;;;;;Dyw.', '.wyK;;;;;;;;Dyw.', '.lyK;;;;;;;;Dyw.', '.lyK;;;;;;;;Dyw.']}}
SPIRAL = {'A2': {'ang': 50, 'off': 21, 'R': 18, 'n': 7, 'span': 40, 'start': 100, 'rise': 3, 'post': 2}}


def _frame(c, n_open):
    """문틀(16열): 상인방 3줄 + 문 안 n_open 줄 + 문턱 1줄. 문 안 어둠 10px, 왼 문설주 빛 · 오른 문설주 그늘."""
    if c['name'] == 'A1':
        rows = ['.WWWWWWWWWWWWWW.', 'Wllllllyyllllllj', 'WjjjjjjjjjjjjjjL',
                'WlJ,,,,,,,,,,lLj'] + ['WlJ;;;;;;;;;;lLj'] * (n_open - 1) + ['WkkkkkkkkkkkkkkL']
    else:
        rows = ['.ffffffffffffff.', 'feeeeeedeeeeeeec', 'ecccccccccccccbb',
                'edA,,,,,,,,,,ecb'] + ['edA;;;;;;;;;;ecb'] * (n_open - 1) + ['eccccccccccccccb']
    assert all(len(r) == 16 for r in rows)
    return rows


def _poly_fill(pts):
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    out = set()
    for y in range(int(min(ys)) - 1, int(max(ys)) + 2):
        for x in range(int(min(xs)) - 1, int(max(xs)) + 2):
            n, ok, X, Y = len(pts), False, x + 0.5, y + 0.5
            for i in range(n):
                x1, y1 = pts[i]
                x2, y2 = pts[(i + 1) % n]
                if (y1 > Y) != (y2 > Y) and X < x1 + (Y - y1) * (x2 - x1) / (y2 - y1):
                    ok = not ok
            if ok:
                out.add((x, y))
    return out


def _sector(px, a0, a1, rin, rout, n=12):
    """px(r, a) → 바닥면 점. a0~a1 각, rin~rout 반지름의 쐐기 발자국 화소."""
    pts = [px(rout, a0 + (a1 - a0) * k / n) for k in range(n + 1)]
    pts += [px(rin, a0 + (a1 - a0) * k / n) for k in range(n, -1, -1)]
    return _poly_fill(pts)


def _stack(cv, kind, items, leg):
    """items = [(발자국 set, 들림, 두께, 글자 고르개 f(fx, fy, k, fp))]. 북 → 남, 같은 줄은 낮은 것 먼저."""
    order = sorted(((fy, e, n, fx) for n, (fp, e, th, f) in enumerate(items) for (fx, fy) in fp))
    owner = {}
    for fy, e, n, fx in order:
        fp, e, th, f = items[n]
        for k in range(th, -1, -1):
            y = fy - e + k
            if kind.get((fx, y)) in ('band', 'out', None):
                continue
            ch = f(fx, fy, k, fp)
            if ch:
                cv.put(fx, y, leg[ch])
                owner[fx, y] = n
    return owner


def _tread_fn(c, i):
    def f(fx, fy, k, fp):
        if k > 0:
            return c['slab'][min(k, len(c['slab'])) - 1]
        if (fx, fy + 1) not in fp:
            return c['lip']                       # 앞(남) 끝 턱 — 가장 밝다
        if (fx, fy - 1) not in fp:
            return c['joint']                     # 뒤 이음 — 위 단과 갈라 보이게
        return c['tread'][fy % len(c['tread'])][(fx + 5 * i) % 16]
    return f


def _run_fn(P, i, fcx, fcy, a0, a1, rin, rout, e):
    """벽 계단 단 i: 윗면(몸 + 얼룩, 앞 끝 턱, 뒤 끝 이음, 가운데 둘레 이음 하나 = 두 돌) + 밑 챌판 3줄 + 그 밑 몸 줄(3줄 켜)."""
    body, dk, lt, lip = P['tones'][i]
    am = (a0 + a1) / 2 + (2 if i % 2 else -2)

    def f(fx, fy, k, fp):
        if k > 0:
            if k <= 3 and k < e:
                return P['riser'][k - 1]
            # 챌판보다 낮은 돌 몸(동쪽을 보는 그늘): 가로 줄무늬 없이 어두운 몸 + 엇갈린 세로 돌 이음
            return P['side'][1] if (fx + 3 * ((k - 1) // 3)) % 7 == 0 else P['side'][0]
        if (fx, fy + 1) not in fp:
            return lip
        if (fx, fy - 1) not in fp:
            return dk
        r = math.hypot(fx + 0.5 - fcx, fy + 0.5 - fcy)
        a = math.degrees(math.atan2(fcx - fx - 0.5, fcy - fy - 0.5))
        if int(r * math.radians(a)) == int(r * math.radians(am)):
            return dk                                 # 돌 이음(벽에서 방 쪽으로)
        h = (fx * 7 + fy * 13 + i * 5) % 11
        return dk if h == 0 else lt if h == 5 else body
    return f


def _cast(cv, kind, fps, skip):
    """디딤판 발자국 자리(들기 전 바닥)와 그 오른쪽 아래 1px 에 반투명 그림자 — 바닥·둘레 자리, 아무것도 안 찍힌 곳만."""
    for fp in fps:
        for (fx, fy) in fp:
            for p in ((fx, fy), (fx + 1, fy), (fx + 1, fy + 1)):
                if p not in skip and kind.get(p) in ('floor', 'course') and cv.a[p[1], p[0], 3] == 0:
                    cv.shadow(*p)


def stair_layer(key, c):
    """12칸 링 좌표의 계단 그림(투명 바탕)."""
    Ro = STAIR_RO
    Ri = Ro - BAND
    rv, kind, geo, top = ring(c, Ro)
    fcx, fcy = Ro, top + Ro + WALL_H
    leg = overlay_leg(c)
    cv = Cv(rv.w, rv.h)
    if key in RUN:
        P = RUN[key]
        px = lambda r, a: (fcx - r * math.sin(math.radians(a)), fcy - r * math.cos(math.radians(a)))
        rout, rin = Ri + 1, Ri - P['w']               # 좁은 띠(11px) — 벽 밑선에 딱 붙인다
        items = []
        n = P['steps']
        for i in range(n + 1):
            a0 = P['a_lo'] - i * P['deg']
            a1 = P['land'] if i == n else a0 - P['deg']
            fp = _sector(px, a0, a1, rin, rout)
            e = P['rise'] * (i + 1)
            items.append((fp, e, e, _run_fn(P, i, fcx, fcy, a0, a1, rin, rout, e)))   # 바닥까지 찬 돌 단(쌓은 돌)
        am = math.radians((P['a_lo'] - n * P['deg'] + P['land']) / 2)   # 문: 계단참 한가운데 뒤 안벽
        u_door = -Ri * math.asin(min(1.0, math.sin(am) * (Ri + 1) / Ri))
        e = P['rise'] * (n + 1)
        door = P['door']
        carve(cv, kind, geo, Ro, door, u_door, leg, v0=WALL_H - e - len(door) + 1)
        owner = _stack(cv, kind, items, leg)
        for (x, y) in list(owner):                    # 남동쪽 바닥 그림자 2px(돌 몸 밖, 바닥 자리에만)
            for p in ((x + 1, y), (x + 1, y + 1), (x + 2, y + 1), (x, y + 1)):
                if p not in owner and kind.get(p) in ('floor', 'course') and cv.a[p[1], p[0], 3] == 0:
                    cv.shadow(*p)
        return cv
    P = SPIRAL[key]
    am = math.radians(P['ang'])
    scx = fcx - (Ri - P['off']) * math.sin(am)
    scy = fcy - (Ri - P['off']) * math.cos(am)
    sp = lambda r, b: (scx + r * math.sin(math.radians(b)), scy + r * math.cos(math.radians(b)))
    R = P['R']
    items, fps = [], []
    plinth = _poly_fill([sp(R + 2, b) for b in range(0, 360, 6)])
    under_tread = set()
    tread_fp = []
    for i in range(P['n']):
        b0 = P['start'] - i * P['span']
        fp = _sector(sp, b0, b0 - P['span'] + 2, P['post'] + 1, R)
        tread_fp.append((fp, 2 + P['rise'] * (i + 1), i))
        under_tread |= fp

    def plinth_f(fx, fy, k, fp):              # 둥근 돌 받침: 윗면 c(디딤판 밑은 그늘 a), 바깥 테 d, 앞면 b·a
        if k > 0:
            return 'b' if k == 1 else 'a'
        if (fx, fy) in under_tread:
            return 'a'
        r = math.hypot(fx + 0.5 - scx, fy + 0.5 - scy)
        return 'd' if r > R else 'c'
    items.append((plinth, 2, 2, plinth_f))
    for fp, e, i in tread_fp:
        items.append((fp, e, 3, _tread_fn(c, i)))
        fps.append(fp)
    top_e = 2 + P['rise'] * P['n'] + 6
    post = {(int(math.floor(scx)) + dx, int(math.floor(scy))) for dx in (-1, 0, 1)}

    def post_f(fx, fy, k, fp):                # 쇠 기둥: 왼 빛 W·S, 가운데 T, 오른 그늘 U, 머리 W
        if k == 0:
            return 'W'
        return {-1: 'S', 0: 'T', 1: 'U'}[fx - int(math.floor(scx))]
    items.append((post, top_e, top_e - 2, post_f))
    owner = _stack(cv, kind, items, leg)
    _cast(cv, kind, fps, set(owner))
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
PASS_HALF = 13    # 남 통로: 가운데에서 좌우 13px 띠를 끊는다(통로 26px). 끝 2px = 띠 마구리(밝은 끝)
THRESH = {   # 통로 문턱 판석(띠 자리, 16열 × 띠 깊이 11줄, 0 = 바깥) — 띠보다 한 단 낮고 어둡게, 판석 이음
    'A1': ['bbbbbbbbbbbbbbbb', 'biiiiiiibiiiiiii', 'bGGGGGGGbGGGiGGG', 'bGGiGGGGbGGGGGGG', 'bGGGGGGGbGGGGGGG',
           'bGGGGGhGbGGGGGGG', 'bGGGGGGGbGGGGhGG', 'biiiiiiibiiiiiii', 'bbbbbbbbbbbbbbbb', 'aiiiiiiiaiiiiiii', 'bbbbbbbbbbbbbbbb'],
    'A2': ['PPPPPPPPPPPPPPPP', 'POOOOOOOPOOOOOOO', 'PNNNNNNNPNNNRNNN', 'PNNRNNNNPNNNNNNN', 'PNNNNNNNPNNNNNNN',
           'PNNNNNRNPNNNNNNN', 'PNNNNNNNPNNNNRNN', 'PMMMMMMMPMMMMMMM', 'PPPPPPPPPPPPPPPP', 'OMMMMMMMOMMMMMMM', 'PPPPPPPPPPPPPPPP'],
}
JAMB = {'A1': {'top': 'q', 'edge': 'W', 'reveal': 'j', 'front': ['l', 'y', 'j']},
        'A2': {'top': 'e', 'edge': 'f', 'reveal': 'c', 'front': ['d', 'c', 'b']}}


def cut_door(cv, kind, geo, Ro, c):
    carve(cv, kind, geo, Ro, _frame(c, WALL_H - 4), 0.0, overlay_leg(c))   # 북 안벽 가운데 문: 문틀 + 바닥까지 문 안


def cut_passage(cv, kind, geo, Ro, c):
    """남쪽 띠 가운데를 끊어 문턱 판석을 깔고, 양옆에 띠 위로 3px 솟은 문설주 돌(윗면 + 남쪽 앞면)을 세운다."""
    leg = c['leg']
    J = JAMB[c['name']]
    posts = []
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
        elif abs(sx) < PASS_HALF + 5:
            posts.append((y, x, int(abs(sx) - PASS_HALF), s))
    for y, x, col, s in sorted(posts):
        for k in range(3, 0, -1):
            cv.put(x, y - 3 + k, leg[J['front'][min(k, 3) - 1]])
        ch = J['reveal'] if col == 0 else J['edge'] if s in (0, BAND - 1) or col == 4 else J['top']
        cv.put(x, y - 3, leg[ch])


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
    """조각 dict, 조립 키트 판(링 통째), 칸 나눔 키트 판(후보 그림 — 16px 칸마다 2px 띄움)."""
    parts, comps, ups = {}, {}, {}
    for n, (Ro, lab) in enumerate(SIZES):
        rv, kind, geo, top = ring(c, Ro)
        _check_cells(kind)
        mid = top + Ro
        parts[f'{lab} 북서'] = rv.crop(0, 0, Ro, mid)
        parts[f'{lab} 북동'] = rv.crop(Ro, 0, Ro, mid)
        parts[f'{lab} 남서'] = rv.crop(0, mid, Ro, rv.h - mid)
        parts[f'{lab} 남동'] = rv.crop(Ro, mid, Ro, rv.h - mid)
        comps[Ro], ups[Ro] = _comp(c, rv, kind, 20 * n), rv
    L2 = 2 * T   # 이음은 2칸 단위 — 세 크기 링이 같이 쓴다(가운데 열·행 단면이 띠 11 + 앞면 32 + 판석 8 로 같다)
    rx, kx, _, _ = ring(c, 64, Lx=L2)
    ry, ky, _, _ = ring(c, 64, Ly=L2)
    _check_cells(kx)
    _check_cells(ky)
    cx_, cy_ = _comp(c, rx, kx, 70), _comp(c, ry, ky, 80)
    con = {'북 이음(가로 반복)': (rx, cx_, 64, 0, L2, 64), '남 이음(가로 반복)': (rx, cx_, 64, rx.h - 32, L2, 32),
           '서 이음(세로 반복)': (ry, cy_, 0, 64, 32, L2), '동 이음(세로 반복)': (ry, cy_, ry.w - 32, 64, 32, L2)}
    # 문: 10칸 링 북쪽 가운데 2×4칸 / 통로: 8칸 링 남쪽 가운데 2×2칸 (다른 크기도 같은 cut_door·cut_passage 로 판다)
    r10, k10, g10, _ = ring(c, 80)
    cut_door(r10, k10, g10, 80, c)
    r8, k8, g8, _ = ring(c, 64)
    cut_passage(r8, k8, g8, 64, c)
    con['10칸 북 문(가운데 2칸)'] = (r10, _comp(c, r10, k10, 90), 80 - T, 0, 2 * T, 64)
    con['8칸 남 통로(가운데 2칸)'] = (r8, _comp(c, r8, k8, 95), 64 - T, 128 - 32, 2 * T, 32)
    for nm, (up, cp, x, y, w, h) in con.items():
        parts[nm] = up.crop(x, y, w, h)
    # 조립 판(extras): 12칸 | 10칸 | 8칸 | 이음·문 열
    W = (12 + 1 + 10 + 1 + 8 + 1 + 4) * T
    board = Cv(W, 12 * T)
    x = 0
    for Ro, _ in SIZES:
        board.paste(ups[Ro], x, 0)
        x += 2 * Ro + T
    for nm, (bx, by) in (('북 이음(가로 반복)', (0, 0)), ('10칸 북 문(가운데 2칸)', (2, 0)), ('남 이음(가로 반복)', (0, 5)),
                         ('8칸 남 통로(가운데 2칸)', (2, 5)), ('서 이음(세로 반복)', (0, 8)), ('동 이음(세로 반복)', (2, 8))):
        board.paste(parts[nm], x + bx * T, by * T)
    # 칸 나눔 판: 링마다 사분면 넷(사분면 사이 6px, 칸 사이 2px) · 오른쪽 열 = 이음 넷 + 문 · 통로(조각마다 8px 띄움)
    pieces = []
    for Ro, _ in SIZES:
        n = 2 * Ro // T
        pieces.append(_explode(comps[Ro], ups[Ro], split=(n // 2, n // 2)))
    col = []
    for nm in ('북 이음(가로 반복)', '10칸 북 문(가운데 2칸)', '남 이음(가로 반복)', '8칸 남 통로(가운데 2칸)',
               '서 이음(세로 반복)', '동 이음(세로 반복)'):
        up, cp, x, y, w, h = con[nm]
        col.append(_explode(cp.crop(x, y, w, h), up.crop(x, y, w, h)))
    return parts, board, pieces, col


def _comp(c, up, kind, ox):
    """칸마다 아래층(바닥 타일 또는 어둠) 위에 링 조각을 얹은 그림 — 칸 나눔 판에서 한 칸이 지도에서 보이는 그대로."""
    s = under(kind, up.w, up.h, c, ox, 0)
    o = Cv(up.w, up.h)
    o.a = up.a.copy()
    o.a[o.a[:, :, 3] < 255] = 0          # 반투명 그림자는 판에서 뺀다(팔레트 밖 섞인 색이 생긴다)
    s.paste(o, 0, 0)
    return s


def _explode(comp, up, split=None, gap=2, sg=6):
    """16px 칸마다 gap 띄운 그림(위층 화소가 있는 칸만). split = (열, 행) 그 앞에 sg 더 띄운다(사분면 경계)."""
    nx, ny = comp.w // T, comp.h // T
    ex = lambda i, s_: i * (T + gap) + (sg if split and i >= s_ else 0)
    out = Cv(ex(nx, split[0] if split else 0) - gap, ex(ny, split[1] if split else 0) - gap)
    for j in range(ny):
        for i in range(nx):
            if not up.a[j * T:(j + 1) * T, i * T:(i + 1) * T, 3].any():
                continue
            out.paste(comp.crop(i * T, j * T, T, T), ex(i, split[0] if split else 0), ex(j, split[1] if split else 0))
    return out


def _board(groups, col, extra=None, pad=12, sep=16):
    """칸 나눔 판: 링 셋을 가로로, 그 오른쪽에 이음·문 열. extra = 8칸 링 밑에 놓을 그림(지붕층)."""
    x, place = pad, []
    hmax = 0
    for k, g in enumerate(groups):
        place.append((g, x, pad))
        h = g.h
        if extra is not None and k == len(groups) - 1:
            place.append((extra, x, pad + g.h + sep))
            h += sep + extra.h
        hmax = max(hmax, h)
        x += g.w + sep
    cy = pad
    cw = max(p.w for p in col)
    for k in range(0, len(col), 2):
        a_, b_ = col[k], col[k + 1]
        place.append((a_, x, cy))
        place.append((b_, x + a_.w + 8, cy))
        cy += max(a_.h, b_.h) + 8
    W = x + 2 * cw + 8 + pad
    H = max(hmax + 2 * pad, cy + pad)
    W, H = -(-W // T) * T, -(-H // T) * T
    out = Cv(W, H)
    out.a[:, :, :3] = dot.C('void', 1)
    out.a[:, :, 3] = 255
    for g, gx, gy in place:
        out.paste(g, gx, gy)
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
    light_patch(s12, kind, c, 96, 36)
    s12.paste(stair_layer(key, c), *((5, 5) if key in SPIRAL else (0, 0)))   # 장면에서만 나선 받침을 벽에서 띄운다
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
        parts, board, pieces, col = kit(c)
        top_rows = {'북 이음(가로 반복)': [0, BAND - 1], '남 이음(가로 반복)': [32 - BAND + 2, 32 - 3]}
        extras = [('조립한 키트 판 — 링 셋 통째(12칸 · 10칸 · 8칸) + 이음 · 문 · 통로', board, 2)]
        roof = None
        if key == 'A1':
            rp, rv = roof_parts(c)
            parts.update(rp)
            _, kind, _, _ = ring(c, 64, roof=True)
            roof = _explode(_comp(c, rv, kind, 99), rv, split=(4, 5))
            r = under(kind, rv.w, rv.h, c)
            r.paste(rv, 0, 0)
            extras.append(('지붕층 변형(성가퀴, 8칸) 2배', r, 2))
        img = _board(pieces, col, roof)
        return img, {'kind': 'objects', 'parts': parts, 'top_rows': top_rows, 'vignette': tower_scene(key, c), 'extras': extras}
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
    'gap.tower_wall': {'A1': '후보 그림 = 칸 나눔 키트 판(16px 칸마다 2px 띄움): 12·10·8칸 링 사분면 + 이음 넷 + 북 문·남 통로(솟은 문설주) + 지붕층 성가퀴. 북서가 밝은 둘레 돌 덩이 띠, 어두운 벽돌 안벽, 따뜻한 나무 널 바닥',
                       'A2': '같은 칸 나눔 판: 밝은 거친 갓돌 띠, 어두운 막돌 안벽, 베이지 큰 판돌 바닥, 벽 밑은 깨끗한 그늘 띠'},
    'gap.tower_stair': {'A1': '설계 2 — 북서 안벽을 따라 오르는 좁은 회색 돌 디딤판 7(2px 씩) + 계단참, 남쪽 챌판 띠만, 바닥 그림자, 계단참 옆 문틀 문',
                        'A2': '설계 1 — 쇠 기둥을 도는 나무 나선 계단 7단(버들항 나선 계단 말), 둥근 돌 받침, 디딤판 밑 그늘'},
    'gap.tower_window': {'A1': '벽돌에 판 사선 화살 구멍(어두움: 1px 틈 + 십자) | 빛: 하늘빛 틈 + 빛 받은 창 옆면, 장면에서 바닥에 짧은 빛 쐐기', 'A2': '막돌 테 사선 구멍 | 하늘빛 + 바닥 빛 쐐기'},
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
