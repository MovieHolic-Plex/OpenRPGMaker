"""gap-tower-r1 — 둥근 탑 조각 판(gap 묶음). 항목 3 × 줄 공통 후보 2(A1 A2).

조수가 지은 3층 탑이 네모난 지하 감옥으로 읽혔다(http://mdc-server:18301/assistant-dungeons-1.html, dg-r3-dg-tower3).
이 판은 **둥근 탑 방** 을 위에서(3/4) 둥글게 읽히게 하는 조각을 그린다.

  - gap.tower_wall  둥근 탑 둘레 벽 키트. 위에서 본 벽 윗면 띠가 원을 그리고, 북쪽 반원 안쪽에는 남쪽을 보는 오목한 안벽 앞면(2단 32px),
                    남쪽 반원 바깥에는 남쪽을 보는 볼록한 바깥벽 앞면(2단)이 감긴다. 앞면의 돌 층(줄눈)은 원을 따라 휜다.
                    키트 = 반지름 80px 링(지름 10칸)을 칸 경계(가운데 열 x=80, 가운데 행)에서 네 사분면으로 나눈 조각
                    + 가로로 늘이는 북·남 이음 조각(16px 열, 반복). 사분면 넷만 놓으면 지름 10칸 원, 사이에 이음을 k 개 끼우면
                    가로 10+k 칸 경기장 모양 방이 된다. 링 바깥(사분면 모서리)은 투명 — 그 칸 아래층은 어둠, 바닥 원이 걸친 칸은 바닥.
                    벽 두께 14px(안 반지름 66)로 정해 한 칸 안에 「보이는 바닥」 과 「링 바깥」 이 같이 들지 않는다(아래층을 칸마다 하나로 고를 수 있다).
  - gap.tower_stair 둥근 안벽을 따라 오르는 돌계단 한 구간(3×3). 디딤판 윗면 + 그늘 진 챌판, 열린 쪽은 받침 앞면, 꼭대기는 벽에 뚫린 어두운 아치.
  - gap.tower_window 탑 앞면에 박는 화살 구멍(1×2) 두 모습 — 어두운 구멍 / 빛이 들어오는 구멍. 비스듬한 창 옆면(깊이)과 창턱 윗면.

손 도트 원칙: 모든 화소 색은 이 파일의 **행 문자열 결 표**(띠 결·앞면 결·총안 결·바닥·계단·창)에서 온다.
링의 모양은 손으로 적은 **반너비 표**(`HO` 바깥 반지름 80 · `HI` 안 반지름 66, 행마다 반너비 px)이고, 결 표를 그 모양 위에
자리만 옮겨(띠는 둘레 방향 길이 t·안쪽 깊이 s, 앞면은 둘레 길이 u·띠 아래 깊이 v) 붙인다 — cave-r1 의 「옆선 표 + 결 표(tex_fill)」 와 같은 방식.
둘레 길이는 원의 각도로 재므로 벽 가장자리(옆으로 돌아가는 곳)의 돌이 좁아지고, 앞면 줄눈은 띠 아래 같은 깊이를 따라 휜다(3/4 원통).
잡음 함수·생성 이미지는 없다. 명암은 결 표 글자를 그 후보의 명암 사슬(`CHAIN`)에서 한두 단 옮기는 것만(원통이 빛을 받는 쪽/등지는 쪽).

A1 = 옅은 다듬은 석회암 장대석 + 여장(총안 낸 성가퀴) · A2 = 어두운 거친 막돌 + 띠 안쪽 나무 테 들보(안벽 앞면 맨 위에 들보 앞면).
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

# ------------------------------------------------------------------------------------------------ 링 모양(손 표)
# 행 d(중심에서 d+0.5 px 떨어진 행)의 반너비. 바깥 R=80, 안 R=66. 끝 몇 행은 손으로 계단을 고르게 했다.
HO = [80, 80, 80, 80, 80, 80, 80, 80, 80, 79, 79, 79, 79, 79, 79, 78, 78, 78, 78, 78, 77, 77, 77, 76, 76, 76, 75, 75, 75, 74,
      74, 74, 73, 73, 72, 72, 71, 71, 70, 70, 69, 68, 68, 67, 66, 66, 65, 64, 64, 63, 62, 61, 60, 59, 59, 58, 57, 56, 55, 53,
      52, 51, 50, 49, 47, 46, 44, 43, 41, 40, 38, 36, 34, 32, 30, 27, 24, 20, 16, 10]
HI = [66, 66, 66, 66, 66, 66, 66, 66, 65, 65, 65, 65, 65, 65, 64, 64, 64, 64, 63, 63, 63, 62, 62, 62, 61, 61, 60, 60, 60, 59,
      59, 58, 57, 57, 56, 56, 55, 54, 54, 53, 52, 51, 50, 50, 49, 48, 47, 46, 45, 44, 42, 41, 40, 39, 37, 36, 34, 32, 30, 28,
      26, 24, 21, 18, 14, 9]
RO, RI, RM = 80, 66, 73          # 바깥·안·가운데(띠 둘레 길이를 재는) 반지름
BAND = RO - RI                   # 띠 너비 14
WALL_H = 32                      # 앞면 높이(2단)


def _in(tab, sx, sy):
    d = int(abs(sy))
    return d < len(tab) and int(abs(sx)) < tab[d]


# ------------------------------------------------------------------------------------------------ 후보별 결 표
# 띠 결: 14행(0 = 바깥 가장자리 … 13 = 안 가장자리) × 16열(둘레 방향, 0열 = 줄눈). 앞면 결: 32행(띠 바로 아래 0 … 바닥 31) × 16열.
# 총안(여장) 결 A1: 윗면 6행 × 16열 + 앞면 4행 × 16열. 들보 A2 는 띠 결 안쪽 4행과 앞면 결 위 4행에 같이 그렸다.

A1 = {
    'leg': legend(H=('stone', 5), P=('stone', 4), L=('cata', 6), l=('cata', 5), m=('cata', 4), n=('cata', 3),
                  o=('cata', 2), p=('cata', 1), q=('stone', 2), r=('stone', 1), z=('stone', 0)),
    'chain': 'zrqponmlLPH',
    'band': [
        'nPPPPPPPPPPPPPPL',   # 0 바깥 끝(성가퀴가 앉는 자리)
        'oLPPPPPHPPPPPPPm',
        'oLPPPPPPPPPPPPPm',
        'oLPPPPPPPPPPLPPm',
        'oLPPPPPPPPPPPPPm',
        'onmmmmmmmmmmmmmn',   # 5 성가퀴 안쪽 낙수 홈
        'oLPPPPPPPLPPPPPm',   # 6 걷는 길 돌
        'oLPPPPPPPPPPPPPm',
        'oLPPHPPPPPPPPPPm',
        'oLPPPPPPPPPPPLPm',
        'nnmmmmmmmmmmmmmn',   # 10 길 돌 두 줄 사이 줄눈
        'oLPPPPPPPPPPPPPm',
        'oLPPPPPPPLPPPPPm',
        'oLLLLLLLLLLLLLLL',   # 13 안 가장자리
    ],
    'merlon_top': [           # 성가퀴 윗면(바깥 끝 6행을 4px 들어 올림). '.' = 그 자리 총안(낮은 띠 그대로)
        '.PHHHHHHHHL.....',
        '.PPPPPPPPPL.....',
        '.PPPPPHPPPL.....',
        '.PPPLPPPPPL.....',
        '.PPPPPPPPPm.....',
        '.LLLLLLLLLm.....',
    ],
    'merlon_face': [          # 성가퀴 남쪽 면 4행
        '.nmmmmmmmmo.....',
        '.nmmmmmnmmo.....',
        '.onnnnnnnnp.....',
        '.ooooooooop.....',
    ],
    'raise': 4,
    'band_shift': 0, 'iface_shift': -3, 'eface_shift': -1,   # 안벽은 띠 그늘 속이라 두 단 어둡게
    'face': [   # 다듬은 장대석: 8줄 층, 짝 층은 0열 · 홀 층은 8열 세로 줄눈, 층 맨 위 = 가로 줄눈, 그 아래 한 줄 빛
        'rrrrrrrrrrrrrrrr',   # 0 띠 밑 그늘
        'pqqqqqqqqqqqqqqq',
        'pmmmmmmmmmmmmmmn',
        'pmmmmmmmnmmmmmmn',
        'pmmmmmmmmmmmmmmn',
        'pmmmnmmmmmmmmmmn',
        'pnnnnnnnnnnnnnnn',
        'pppppppppppppppp',
        'nmmmmmmmpmmmmmmm',   # 8
        'mmmmmmmnplmmmmmm',
        'mmmnmmmnplmmmmmm',
        'mmmmmmmnplmmmnmm',
        'mmmmmmmnplmmmmmm',
        'mmmmmmmnplmmmmmm',
        'nnnnnnnnpnnnnnnn',
        'pppppppppppppppp',
        'plllllllllllllll',   # 16
        'plmmmmmmmmmmmmmn',
        'plmmmmmmmmnmmmmn',
        'plmmmmmmmmmmmmmn',
        'plmmmnmmmmmmmmmn',
        'plmmmmmmmmmmmmmn',
        'pnnnnnnnnnnnnnnn',
        'pppppppppppppppp',
        'lmmmmmmmplllllll',   # 24
        'mmmmmmmnplmmmmmm',
        'mmmmmmmnplmmmmmm',
        'mmnmmmmnplmmmnmm',
        'mmmmmmmnplmmmmmm',
        'nnnnnnnnpnnnnnnn',
        'oooooooooooooooo',
        'pppppppppppppppp',   # 31 바닥 닿는 줄
    ],
    'beam': None,
    'floor': [   # 지하묘지 판석(버들항 floor_cata 결): 16×8 반 엇갈림, 줄눈 o, 위 줄 빛 l, 반점
        'oooooooooooooooo',
        'mlllllllomllllll',
        'mllmlllloml.lllm',
        'mlllllllomlllllm',
        'mlllllmlomllllll',
        'mllllllloml.lllm',
        'mnmmmmmmonmmmmmm',
        'oooooooooooooooo',
        'lllomlllllllloml',
        'llloml.llllllomm',
        'lllomllllmlllomm',
        'lmlomllllllllomm',
        'lllomll.lllllomm',
        'lllomlllllllloml',
        'mmmonmmmmmmmmonm',
        'oooooooooooooooo',
    ],
    'floor_leg': legend(o=('cata', 1), n=('cata', 2), m=('cata', 3), l=('cata', 4), **{'.': ('cata', 5)}),
}
A1['floor'] = [r.replace('.', 'L') for r in A1['floor']]
A1['floor_var'] = [[   # 금 간 판석 · 닳아 밝은 판석
    'oooooooooooooooo',
    'mlllllllomllllll',
    'mlllnlllomlLLLll',
    'mllllnllomlLLLLm',
    'mllnllnlomllLLll',
    'mlllllllomlllllm',
    'mnmmmmmmonmmmmmm',
    'oooooooooooooooo',
    'lllomlllllllloml',
    'lLlomllllllnlomm',
    'LLlomlllllnllomm',
    'lLlomllllnlllomm',
    'lllomlllnllllomm',
    'lllomllllllllolL',
    'mmmonmmmmmmmmonm',
    'oooooooooooooooo',
]]
A1['floor_leg'] = legend(o=('cata', 1), n=('cata', 2), m=('cata', 3), l=('cata', 4), L=('cata', 5))

A2 = {
    'leg': legend(a=('crock', 1), b=('crock', 2), c=('crock', 3), d=('crock', 4), e=('crock', 5), f=('crock', 6),
                  A=('brick', 1), B=('brick', 2), D=('brick', 3), E=('brick', 4), F=('brick', 5), G=('brick', 6),
                  w=('wood', 1), x=('wood', 2), y=('wood', 3), u=('wood', 4), v=('wood', 5), k=('iron', 3), j=('iron', 1)),
    'chain': 'aABbDcdEeFfG',
    'band': [   # 거친 막돌: 둘레로 길이가 다른 돌(4~9열), 줄눈 b, 돌 위·왼 빛 e·f, 아래 그늘 c
        'deeeeffeedeeeefe',
        'cbdeeeeedbdeeedd',
        'cbdeedeedbcdeeec',
        'bccddddcbbbccdcb',
        'dfeeebdeeeeedbde',
        'deeedbdeeefeebde',
        'dddecbcdeedeebcd',
        'bbbcbbbccccdcbbb',
        'eeeedbdfeeeebdee',
        'deedcbdeeeedbcde',   # 9
        'xuuuuuuvuuuuuuuu',   # 10 나무 테 들보 윗면(4행) — 이음 0열, 결 줄
        'xuyyyuuuxuuyyyuu',
        'xyyyyyyyxyyyyuyy',
        'wxxxxxxxwxxxxxxx',
    ],
    'merlon_top': None,
    'merlon_face': None,
    'raise': 0,
    'band_shift': 1, 'iface_shift': -1, 'eface_shift': 0,
    'face': [   # 어두운 막돌 쌓기: 층 높이가 다르고(5·7·6·8) 돌 길이도 다르다, 맨 위 4행 = 들보 앞면(안벽에만)
        'AAAAAAAAAAAAAAAA',   # 0 들보 밑 그늘(바깥벽: 띠 밑 그늘)
        'BEEEFEBDEEEEFEBD',
        'BEEEEEBDEFEEEEBD',
        'BDEEEDBBDEEEEDBB',
        'ABBBBBAABBBBBBAA',
        'EFFEEBDEEEEFEEEB',   # 5
        'EEEEEBDEEFEEEEDB',
        'EEFEEBDEEEEEEEDB',
        'DEEEDBBDEEEEEDBB',
        'BBBBBAABBBBBBBBA',
        'EEBDEEEFEEEBDEEE',   # 10
        'EEBDEEEEEEEBDEFE',
        'EEBDEFEEEEDBBDEE',
        'DDBBDEEEEDDBBDDD',
        'BBAABBBBBBBAABBB',
        'FEEEEBDEEEEEEBDF',   # 15
        'EEEEDBDEEFEEEBDE',
        'EFEEDBDEEEEEDBDE',
        'EEEEDBBDEEEEDBBE',
        'DDDDBAABDDDDBAAD',
        'BBBBAABBBBBBAABB',   # 20
        'EEBDEEEEFEEEEEBD',
        'EFBDEEEEEEEFEEBD',
        'EEBDEEEFEEEEEDBD',
        'EDBBDEEEEEEEDBBD',
        'DBBADDDDDDDDBBAD',
        'BAABBBBBBBBBAABB',   # 26
        'EEEEEFEBDEEEEEEE',
        'EEFEEEEBDEEFEEEE',
        'DEEEEEDBBDEEEEED',
        'BDDDDDBBABDDDDDB',
        'AAAAAAAAAAAAAAAA',   # 31
    ],
    'beam_face': [   # 들보 앞면(안벽 맨 위 4행, 0열 = 이음, 8열 = 쇠못)
        'xuuuuuuukuuuuuuu',
        'xyyyyyyyjyyyyyyy',
        'wxxxxxxxxxxxxxxx',
        'wwwwwwwwwwwwwwww',
    ],
    'floor': [   # 닳은 판돌: 8줄 두 층, 위층 이음 5열 · 아래층 13열, 판 모서리는 닳아 둥글고(n) 금 하나
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
    'floor_leg': legend(o=('stone', 1), n=('cata', 1), m=('cata', 2), l=('cata', 3), L=('cata', 4)),
    'floor_var': [[   # 금 하나 · 밝게 닳은 자리
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
}


# ------------------------------------------------------------------------------------------------ 링 렌더
def _shift(ch, k, chain):
    if k == 0 or ch not in chain:
        return ch
    i = max(0, min(len(chain) - 1, chain.index(ch) + k))
    return chain[i]


def ring(c, L=0):
    """후보 c 의 둥근 탑 벽(가운데에 곧은 이음 L px). 반환 (Cv, 칸별 바닥 여부 dict, top 여백)."""
    top = T if c['raise'] else 0               # 성가퀴가 띠 위로 솟을 자리
    W, H = 2 * RO + L, top + 2 * RO + WALL_H
    cy = top + RO
    leg, chain = c['leg'], c['chain']
    cv = Cv(W, H)
    kind = {}
    geo = {}

    def coord(x, y):
        sy = y + 0.5 - cy
        if x < RO:
            return x + 0.5 - RO, sy, None
        if x >= RO + L:
            return x + 0.5 - RO - L, sy, None
        return 0.5, sy, x - RO                  # 곧은 이음(가운데 열과 같은 단면)

    for y in range(H):
        for x in range(W):
            sx, sy, st = coord(x, y)
            if _in(HO, sx, sy) and not _in(HI, sx, sy):
                kind[x, y] = 'band'
            elif _in(HI, sx, sy):
                kind[x, y] = 'floor' if _in(HI, sx, sy - WALL_H) else 'iface'
            elif sy > 0 and _in(HO, sx, sy - WALL_H):
                kind[x, y] = 'eface'
            else:
                kind[x, y] = 'out'
            geo[x, y] = (sx, sy, st)
    # 열마다 앞면 맨 윗줄(띠 바로 아래)
    itop, etop = {}, {}
    for x in range(W):
        ys = [y for y in range(H) if kind[x, y] == 'iface']
        if ys:
            itop[x] = min(y for y in range(H) if kind[x, y] in ('iface', 'floor'))
        ys = [y for y in range(H) if kind[x, y] == 'eface']
        if ys:
            etop[x] = min(ys)

    def arc_u(sx, r, st, x):
        if st is not None:
            return st
        u = r * math.asin(max(-1.0, min(1.0, sx / r)))
        return u + (L if x >= RO + L else 0)

    for y in range(H):
        for x in range(W):
            k = kind[x, y]
            sx, sy, st = geo[x, y]
            if k == 'band':
                if st is not None:
                    t, rr = st, abs(sy)
                else:
                    rr = math.hypot(sx, sy)
                    th = math.atan2(sx, -sy) if sy < 0 else math.atan2(sx, sy)
                    t = RM * th + (L if x >= RO + L else 0)
                s = max(0, min(BAND - 1, int(RO - rr)))
                ti = int(math.floor(t)) % 16
                if sy > 0 and abs(sy) < 1:      # 적도(서·동 끝): 북 반원과 남 반원 결이 만나는 곳 = 줄눈
                    ti = 0
                ch = c['band'][s][ti]
                sh = 0
                if (sy < 0 and s == BAND - 1) or (sy > 0 and s == 0):
                    sh = 1                       # 앞면으로 떨어지는 끝 = 빛 받는 턱
                if st is None and sy < 0 and sx < -0.4 * RO and s == 0:
                    sh = 1                       # 북서 바깥 끝: 빛 쪽
                if st is None and sx > 0.55 * RO and s >= BAND - 2 and sy > -RO * 0.3:
                    sh = -1                      # 동쪽 안 끝 아래: 그늘
                cv.put(x, y, leg[_shift(ch, sh + c['band_shift'], chain)])
            elif k == 'iface':
                v = y - itop[x]
                u = arc_u(sx, RI, st, x)
                ui = int(math.floor(u)) % 16
                rows = c['face']
                if c.get('beam_face') and v < 4:
                    ch = c['beam_face'][v][ui]
                else:
                    ch = rows[min(v, 31)][ui]
                f = sx / RI if st is None else 0
                sh = -2 if f < -0.8 else -1 if f < -0.5 else 1 if f > 0.6 else 0     # 오목 안벽: 서쪽은 빛을 등지고 동쪽이 빛을 받는다
                if not (c.get('beam_face') and v < 4):
                    sh += c['iface_shift']
                cv.put(x, y, leg[_shift(ch, sh, chain)])
            elif k == 'eface':
                v = y - etop[x]
                u = arc_u(sx, RO, st, x)
                ch = c['face'][min(v, 31)][int(math.floor(u)) % 16]
                f = sx / RO if st is None else 0
                sh = 1 if f < -0.55 else -2 if f > 0.8 else -1 if f > 0.4 else 0   # 볼록 바깥벽: 서쪽이 빛, 동쪽이 그늘
                cv.put(x, y, leg[_shift(ch, sh + c['eface_shift'], chain)])
    # 성가퀴(A1): 바깥 끝 6행 중 성가퀴 자리를 raise px 들어 올린다 — 남쪽(아래) 화소가 나중에 덮도록 y 순서로
    if c['merlon_top']:
        R = c['raise']
        cells = []
        for y in range(H):
            for x in range(W):
                if kind[x, y] != 'band':
                    continue
                sx, sy, st = geo[x, y]
                rr = abs(sy) if st is not None else math.hypot(sx, sy)
                s = int(RO - rr)
                if s >= len(c['merlon_top']):
                    continue
                if st is not None:
                    t = st
                else:
                    th = math.atan2(sx, -sy) if sy < 0 else math.atan2(sx, sy)
                    t = RM * th + (L if x >= RO + L else 0)
                ti = int(math.floor(t)) % 16
                if c['merlon_top'][s][ti] == '.':
                    continue
                cells.append((y, x, s, ti))
        for y, x, s, ti in sorted(cells):
            for k in range(R):
                fy = y - k
                fch = c['merlon_face'][R - 1 - k][ti]
                if fch != '.':
                    cv.put(x, fy, leg[fch])
            cv.put(x, y - R, leg[c['merlon_top'][s][ti]])
    # 안벽 앞면 밑 접지 그림자(바닥 쪽 2px, 윗층 반투명)
    for x in range(W):
        for y in range(H):
            if kind[x, y] == 'floor' and y > 0 and kind[x, y - 1] == 'iface' and cv.a[y, x, 3] == 0:
                cv.shadow(x, y)
                if y + 1 < H and kind[x, y + 1] == 'floor':
                    cv.shadow(x, y + 1)
    floor_cells = {}
    for (x, y), k in kind.items():
        if k == 'floor':
            floor_cells[x // T, y // T] = True
    return cv, floor_cells, top


def floor_tiles(c):
    """바닥 몸통 + 변형(가장자리 1px 는 몸통과 같고 안쪽만 금·닳음이 다르다). 장면은 dot.cell_hash 로 고른다."""
    out = [grid(c['floor'], c['floor_leg'])] * 2      # 몸통 둘 : 변형 하나(변형이 반이면 금이 무늬처럼 반복된다)
    for v in c.get('floor_var', []):
        out.append(grid(v, c['floor_leg']))
    return out


VOID_ROWS = [
    'aaaaaaaaaaaaaaaa', 'aaaaaaaaaaaaabaa', 'aaaaaaaaaaaaaaaa', 'aaaabaaaaaaaaaaa',
    'aaaaaaaaaaaaaaaa', 'aaaaaaaaaaaaaaaa', 'aaaaaaaaaabaaaaa', 'aaaaaaaaaaaaaaaa',
    'aaaaaaaaaaaaaaaa', 'abaaaaaaaaaaaaaa', 'aaaaaaaaaaaaaaaa', 'aaaaaaaaaaaaaaba',
    'aaaaaaabaaaaaaaa', 'aaaaaaaaaaaaaaaa', 'aaaaaaaaaaaaaaaa', 'aaaaaaaaaaaaaaaa',
]
VOID = grid(VOID_ROWS, legend(a=('void', 0), b=('void', 1)))


def actor():
    return Cv.of(dot.actor1_frame(1, 0, 0))


def wall_parts(c):
    """키트 조각: 사분면 넷 + 북·남 이음(16px 열)."""
    rv, _, top = ring(c, 0)
    r16, _, _ = ring(c, 16)
    mid = top + RO
    H = rv.h
    parts = {
        '북서 호': rv.crop(0, 0, RO, mid),
        '북동 호': rv.crop(RO, 0, RO, mid),
        '남서 호(바깥 앞면)': rv.crop(0, mid, RO, H - mid),
        '남동 호(바깥 앞면)': rv.crop(RO, mid, RO, H - mid),
        '북 이음(가로 반복)': r16.crop(RO, 0, T, mid),
        '남 이음(가로 반복)': r16.crop(RO, mid, T, H - mid),
    }
    return rv, parts, top


def room_scene(c, L=0, pad=1):
    rv, cells, top = ring(c, L)
    nx, ny = rv.w // T + 2 * pad, rv.h // T + pad
    sc = Cv(nx * T, ny * T)
    fl = floor_tiles(c)
    for j in range(ny):
        for i in range(nx):
            cx, cy = i - pad, j
            t = fl[dot.cell_hash(i, j) % len(fl)] if cells.get((cx, cy)) else VOID
            sc.a[j * T:(j + 1) * T, i * T:(i + 1) * T] = t.a
    sc.paste(rv, pad * T, 0)
    return sc, top


def exploded(parts):
    """조각을 4px 띄워 펼친 그림: 북서 | 북 이음 | 북동 / 남서 | 남 이음 | 남동."""
    nw, ne, sw, se = parts['북서 호'], parts['북동 호'], parts['남서 호(바깥 앞면)'], parts['남동 호(바깥 앞면)']
    n, s_ = parts['북 이음(가로 반복)'], parts['남 이음(가로 반복)']
    g = 4
    out = Cv(nw.w + n.w + ne.w + 2 * g, nw.h + sw.h + g)
    out.paste(nw, 0, 0)
    out.paste(n, nw.w + g, 0)
    out.paste(ne, nw.w + n.w + 2 * g, 0)
    out.paste(sw, 0, nw.h + g)
    out.paste(s_, nw.w + g, nw.h + g)
    out.paste(se, nw.w + n.w + 2 * g, nw.h + g)
    return out


def c_wall(key, c):
    def fn():
        rv, parts, top = wall_parts(c)
        sc = tower_room(key, c)
        mid = top + RO
        top_rows = {}
        # 이음 조각: 걷는 길 윗면 행 / 남 이음은 띠 윗면 행
        if c['merlon_top']:
            top_rows['북 이음(가로 반복)'] = [top + 6, top + BAND - 1]
        else:
            top_rows['북 이음(가로 반복)'] = [top, top + BAND - 1]
        top_rows['남 이음(가로 반복)'] = [RO - BAND, RO - 1 - (c['raise'] + 2 if c['raise'] else 0)]
        stretched, _ = room_scene(c, 2 * T)
        return rv, {'kind': 'objects', 'parts': parts, 'top_rows': top_rows, 'vignette': sc,
                    'extras': [('조각 펼침(사분면 4 + 북·남 이음)', exploded(parts), 2),
                               ('이음 2개 끼운 12칸 방(1배)', stretched, 1)]}
    return fn


# ------------------------------------------------------------------------------------------------ 벽 계단
# 서쪽 안벽을 따라 북서쪽으로 감아 오르는 돌계단 한 구간. 손 표 STEPS: 단마다 (벽 쪽 시작 각, 끝 각, 안쪽 반지름, 높이 px).
# 각은 북쪽에서 서쪽으로 잰 도(90 = 정서, 0 = 정북). 디딤판 바깥 끝은 안벽(반지름 66)에 붙고, 높이만큼 위로 올라 그린다.
# 마지막 단 = 계단참. 그 뒤 안벽 앞면에 벽 두께 속으로 이어지는 어두운 아치(ARCH)를 박는다(탑 계단이 벽 속으로 감겨 올라간다).
# 그리기: 높은 단(뒤)부터 낮은 단(앞)으로 — 단마다 바닥에서 높이까지 기둥(앞면)을 쌓고 맨 위에 디딤판. 앞 단이 뒤 단 받침을 가린다.
STEPS = {
    'A1': [(80, 72, 52, 4), (72, 64, 52, 8), (64, 56, 52, 12), (56, 48, 52, 16), (48, 38, 52, 20)],
    'A2': [(81, 72, 51, 4), (72, 63, 53, 8), (63, 55, 51, 12), (55, 47, 53, 16), (47, 37, 51, 20)],
}
STAIR = {
    'A1': {   # 다듬은 석회암 디딤판: 앞 끝 턱(lip) 하얗게, 몸 P, 뒤(벽 쪽) L. 앞면 = 장대석 결 두 단 어둡게
        'tread': ['HPPPPPHPPPPPPHPP', 'PPPPHPPPPPPHPPPP', 'PHPPPPPPPHPPPPPP', 'PPPPPPHPPPPPPPHP'],
        'lip': 'H', 'back': 'L', 'east': 'l',
        'riser': 'nooppqqqrrr',      # 디딤판 밑 깊이 0,1,2… 의 글자(그 아래는 마지막 글자)
        'joint': 'p', 'joint_every': 9,
        'arch': [
            '...nmLLLmn...',
            '.nmLPHHHPLmn.',
            'nLPo,,,,,oPLn',
            'mPo,;;;;;,oPn',
            'mLo;;;;;;;oLo',
            'mLo;;;;;;;oLo',
            'mLo;;;;;;;oLo',
            'mLo;;;;;;;oLo',
            'mLo;;;;;;;oLo',
            'mLo;;;;;;;oLo',
            'mLo;;;;;;;oLo',
            'mLo;;;;;;;oLo',
        ],
    },
    'A2': {   # 거친 막돌 디딤판: 끝이 들쭉날쭉(lip 자리에 e·f 섞임), 앞면 = 막돌 결. 아치 대신 나무 상인방 문
        'tread': ['edeefeedeeedfeed', 'eeedeeeeefeeedee', 'deeeeedeeeeefeed', 'eefeeedeeeedeeee'],
        'lip': 'f', 'back': 'd', 'east': 'c',
        'riser': 'cbBBBAAAAAA',
        'joint': 'A', 'joint_every': 6,
        'arch': [
            'wxxxxxxxxxxxw',
            'xuuuuuuuuuuux',
            'wyyyykyyyyyyw',
            'wwwwwwwwwwwww',
            'DEo,,,,,,,oED',
            'BDo;;;;;;;oDB',
            'DEo;;;;;;;oEB',
            'BDo;;;;;;;oDB',
            'DEo;;;;;;;oEB',
            'BDo;;;;;;;oDB',
            'DEo;;;;;;;oEB',
            'BDo;;;;;;;oDB',
        ],
    },
}
STAIR_BOX = (8, 28, 48, 80)    # 링 캔버스 좌표(성가퀴 top 여백 뺀 값)에서 잘라 낼 3×5 칸 — 계단이 차지하는 x 15~51 · y 31~103


def _quad(a0, a1, rin, rout=RI):
    """바닥 원(중심 (80, 80+32)) 위 벽 쪽 쐐기의 네 꼭짓점(링 좌표, top 여백 없음)."""
    pts = []
    for a, r in ((a0, rout), (a1, rout), (a1, rin), (a0, rin)):
        t = math.radians(a)
        pts.append((RO - r * math.sin(t), RO + WALL_H - r * math.cos(t)))
    return pts


def _inside(pts, x, y):
    n, ok = len(pts), False
    for i in range(n):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % n]
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
            ok = not ok
    return ok


def stair(key, c):
    """링 좌표계 그림(160×(160+32)) 위에 계단을 그리고 STAIR_BOX 로 잘라 돌려준다. 반환 (Cv, 붙일 자리 x, y)."""
    d = STAIR[key]
    leg = dict(c['leg'])
    leg.update(legend(**{';': ('void', 0), ',': ('void', 2)}))
    leg.setdefault('o', dot.C('stone', 1))
    W, H = 2 * RO, 2 * RO + WALL_H
    cv = Cv(W, H)
    steps = STEPS[key]
    # 아치: 계단참 가운데 각의 안벽 앞면, 앞면 맨 위(띠 바로 밑)부터 계단참 디딤판 높이까지
    a0, a1, _, e_top = steps[-1]
    am = math.radians((a0 + a1) / 2 + 2)
    fx = RO - RI * math.sin(am)
    fy = RO + WALL_H - RI * math.cos(am)          # 그 자리 앞면 밑(바닥)
    ax = int(round(fx)) - len(d['arch'][0]) // 2
    ay = int(round(fy)) - WALL_H
    stamp(cv, d['arch'], leg, ax, ay)
    for i in range(len(steps) - 1, -1, -1):
        b0, b1, rin, e = steps[i]
        q = _quad(b0, b1, rin)
        xs = [p[0] for p in q]
        ys = [p[1] for p in q]
        x0, x1 = int(min(xs)) - 1, int(max(xs)) + 2
        y0, y1 = int(min(ys)) - e - 1, int(max(ys)) + 2
        top = {}
        for y in range(y0, y1):
            for x in range(x0, x1):
                if _inside(q, x + 0.5, y + 0.5 + e):
                    top[x, y] = True
        body = {}
        for k in range(e + 1):                         # 기둥: 디딤판 모양을 바닥까지 내려 쌓은 자리
            for (x, y) in top:
                body[x, y + k] = True
        for (x, y) in sorted(body):
            if (x, y) in top:
                continue
            # 디딤판 밑 깊이(그 열에서 위쪽 디딤판 끝부터)
            k = 0
            while (x, y - k - 1) not in top and k < 40:
                k += 1
            ch = d['riser'][min(k, len(d['riser']) - 1)]
            if k > 1 and ((x * 7 + i * 3) % d['joint_every'] == 0 or (k > 4 and (k + i) % 5 == 0)):
                ch = d['joint']                        # 받침 돌 쌓기: 세로 줄눈 · 5줄마다 가로 줄눈
            cv.put(x, y, leg[ch])
        for (x, y) in top:
            ch = d['tread'][y % 4][x % 16]
            if (x, y + 1) not in top:
                ch = d['lip']                          # 앞 끝 턱
            elif (x + 1, y) not in top:
                ch = d['east']
            elif (x, y - 1) not in top or (x - 1, y) not in top:
                ch = d['back']
            cv.put(x, y, leg[ch])
    # 접지 그림자: 계단 덩어리 남·동 쪽 바닥 1px
    a = cv.a.copy()
    for y in range(1, H):
        for x in range(W - 1):
            if a[y, x, 3] == 0 and (a[y - 1, x, 3] == 255 or (x > 0 and a[y, x - 1, 3] == 255)) and y > 60:
                cv.shadow(x, y)
    bx, by, bw, bh = STAIR_BOX
    return cv.crop(bx, by, bw, bh), bx, by


def c_stair(key, c):
    def fn():
        s, bx, by = stair(key, c)
        return s, {'kind': 'objects', 'parts': {'계단': s}, 'vignette': tower_room(key, c)}
    return fn


# ------------------------------------------------------------------------------------------------ 화살 구멍 창
# 한 모습 16×32(앞면 2단 높이 그대로 — 0행이 띠 바로 밑). 두 모습: 어두운 구멍 / 빛이 들어오는 구멍. 비스듬한 창 옆면:
# 왼쪽 옆면은 동쪽을 봐서 그늘(r z / A B), 오른쪽 옆면은 서쪽(빛)을 봐서 밝다. 창턱 윗면(24~26행)은 빛 받는 면, 27행 = 창턱 앞.
WIN = {
    'A1': {   # 다듬은 석회암 테 + 십자 화살 구멍(가로 팔 = 쇠뇌 구멍)
        'dark': [
            '................',
            '................',
            '...nLLLLLLLLn...',
            '...LPHHHHHHPLz..',
            '...LPrrrrrrlPz..',
            '...LqrzzzzllPz..',
            '...Lqrz;;mllPz..',
            '...Lqrz;;mllPz..',
            '...Lqrz;;mllPz..',
            '...Lqrz;;mllPz..',
            '...Lqrz;;mllPz..',
            '...Lqz;;;;mlPz..',
            '...Lqz;;;;mlPz..',
            '...Lqrz;;mllPz..',
            '...Lqrz;;mllPz..',
            '...Lqrz;;mllPz..',
            '...Lqrz;;mllPz..',
            '...Lqrz;;mllPz..',
            '...Lqrz;;mllPz..',
            '...Lqrz;;mllPz..',
            '...Lqrz;;mllPz..',
            '...Lqrzz;mllPz..',
            '...LqrrrlmllPz..',
            '...LqqqqllllPz..',
            '..nHHHHHHHHHHPz.',
            '..nPPPPLPPPPPLz.',
            '..mLLLLLLLLLLmz.',
            '..zzzzzzzzzzzzz.',
            '...~~~~~~~~~~~~.',
            '................',
            '................',
            '................',
        ],
        'lit': [
            '................',
            '................',
            '...nLLLLLLLLn...',
            '...LPHHHHHHPLz..',
            '...LPqqqqqqPPz..',
            '...LnqmjjmPHPz..',
            '...LnmjiijPHPz..',
            '...LnmjiijPHPz..',
            '...LnmjiijPHPz..',
            '...LnmjiijPHPz..',
            '...LnmjiijPHPz..',
            '...LnjiiiijHPz..',
            '...LnjiiiijHPz..',
            '...LnmjiijPHPz..',
            '...LnmjiijPHPz..',
            '...LnmjiijPHPz..',
            '...LnmjiijPHPz..',
            '...LnmjiijPHPz..',
            '...LnmjiijPHPz..',
            '...LnmjiijPHPz..',
            '...LnmjiijPHPz..',
            '...LnmjjijPHPz..',
            '...LnmmjjPHHPz..',
            '...LmmmPPHHHPz..',
            '..nHHHHHkkHHHPz.',
            '..nPPPPHHPPPPLz.',
            '..mLLLLLLLLLLmz.',
            '..zzzzzzzzzzzzz.',
            '...~~~~~~~~~~~~.',
            '................',
            '................',
            '................',
        ],
    },
    'A2': {   # 막돌 테 + 나무 상인방, 십자 없는 곧은 틈. 테 돌은 크기가 제각각
        'dark': [
            '................',
            '................',
            '................',
            '................',
            '...wxxxxxxxxw...',
            '...xuuuuyuuuxA..',
            '...wyyyyyyyywA..',
            '..FEBAAAAAADEDA.',
            '..EDBAAAAADDEBA.',
            '..FEBAAc;cDEEDA.',
            '..EFBAA;;cDEDBA.',
            '..BDBAA;;cDEEBA.',
            '..FEDBA;;cDEDBA.',
            '..EEBAA;;cDEEDA.',
            '..DEBAA;;cDEDBA.',
            '..BBBAA;;cDEEBA.',
            '..FEDBA;;cDEDBA.',
            '..EEBAA;;cDEEDA.',
            '..DFBAA;;cDEDBA.',
            '..EEBAA;;cDEEBA.',
            '..BDBAA;;cDEDBA.',
            '..FEDBAAccDEEDA.',
            '..EEBAAAAcDDEBA.',
            '..DEBBBBBDDEDBA.',
            '.DFFFGFFFFFFFEA.',
            '.DEEFEEEEEFEEDA.',
            '.BDDDDDDDDDDDBA.',
            '.AAAAAAAAAAAAAA.',
            '..~~~~~~~~~~~~~.',
            '................',
            '................',
            '................',
        ],
        'lit': [
            '................',
            '................',
            '................',
            '................',
            '...wxxxxxxxxw...',
            '...xuuuuyuuuxA..',
            '...wyyyyyyyywA..',
            '..FEBAAAAAAFGDA.',
            '..EDBBDDDFFGEBA.',
            '..FEBDEjiFGEEDA.',
            '..EFBDjiiFGEDBA.',
            '..BDBDjiiFGEEBA.',
            '..FEDDjiiFGEDBA.',
            '..EEBDjiiFGEEDA.',
            '..DEBDjiiFGEDBA.',
            '..BBBDjiiFGEEBA.',
            '..FEDDjiiFGEDBA.',
            '..EEBDjiiFGEEDA.',
            '..DFBDjiiFGEDBA.',
            '..EEBDjiiFGEEBA.',
            '..BDBDjiiFGEDBA.',
            '..FEDDEjjFGEEDA.',
            '..EEBDEEFFGGEBA.',
            '..DEBEEFFGGEDBA.',
            '.DFFFGGkGGFFFEA.',
            '.DEEFEGGGEFEEDA.',
            '.BDDDDDDDDDDDBA.',
            '.AAAAAAAAAAAAAA.',
            '..~~~~~~~~~~~~~.',
            '................',
            '................',
            '................',
        ],
    },
}


def wleg(c):
    leg = dict(c['leg'])
    leg.update(legend(**{';': ('void', 0), ',': ('void', 2), 'i': ('ice', 3), 'j': ('ice', 2), 'k': ('ice', 4)}))
    leg.setdefault('z', dot.C('stone', 0))
    leg.setdefault('r', dot.C('stone', 1))
    return leg


def window(key, c, look):
    return grid(WIN[key][look], wleg(c))


# ------------------------------------------------------------------------------------------------탑 방 장면(세 항목 공통)
def tower_room(key, c):
    sc, top = room_scene(c)
    cy = top + RO
    s, bx, by = stair(key, c)
    for sx_c, look in ((-26, 'dark'), (22, 'lit')):
        x = T + RO + sx_c
        yy = cy - int(math.sqrt(RI * RI - (sx_c + 8) ** 2))
        sc.paste(window(key, c, look), x, yy)
    sc.paste(s, T + bx, top + by)
    sc.paste(actor(), T + 84, top + 98)
    return sc


def c_window(key, c):
    def fn():
        d, l = window(key, c, 'dark'), window(key, c, 'lit')
        out = Cv(32, 32)
        out.paste(d, 0, 0)
        out.paste(l, 16, 0)
        return out, {'kind': 'objects', 'parts': {'어두운 구멍': d, '빛 드는 구멍': l}, 'vignette': tower_room(key, c),
                     'top_rows': {'어두운 구멍': [24, 26], '빛 드는 구멍': [24, 26]}}
    return fn


CANDIDATES = {
    'gap.tower_wall': {'A1': c_wall('A1', A1), 'A2': c_wall('A2', A2)},
    'gap.tower_stair': {'A1': c_stair('A1', A1), 'A2': c_stair('A2', A2)},
    'gap.tower_window': {'A1': c_window('A1', A1), 'A2': c_window('A2', A2)},
}


NOTES = {
    'gap.tower_wall': {'A1': '옅은 다듬은 석회암 장대석 + 성가퀴(총안). 사분면 4 + 북·남 이음(가로 반복). 링 지름 10칸, 벽 두께 14px, 앞면 2단',
                       'A2': '어두운 거친 막돌 + 띠 안쪽 나무 테 들보(안벽 맨 위에 들보 앞면). 같은 링·같은 조각 나눔'},
    'gap.tower_stair': {'A1': '서쪽 안벽을 감아 오르는 다듬은 돌계단 5단(4px씩) + 계단참, 벽 속으로 이어지는 아치. 3×5칸',
                        'A2': '막돌 계단, 꼭대기는 나무 상인방 문. 3×5칸'},
    'gap.tower_window': {'A1': '석회암 테 + 십자 화살 구멍 | 빛 드는 같은 창', 'A2': '막돌 테 + 나무 상인방, 곧은 틈 | 빛 드는 같은 창'},
}
for _item, _c in CANDIDATES.items():
    for _k, _fn in list(_c.items()):
        def _wrap(fn=_fn, note=NOTES[_item][_k]):
            cv, meta = fn()
            meta['note'] = note
            return cv, meta
        _c[_k] = _wrap
