"""gap-rock-r1 — 방 사이 바위 채움(gap.rock_fill). 줄 A·B·C × 후보 2 (A1 A2 B1 B2 C1 C2).

문제: 조수 던전은 방 사이를 납작한 검은 허공으로 메운다(화면의 45~60%가 허공 → 「텅 비었다」).
답: 걸을 수 없는 덩어리를 **결 있는 바위 윗면**(단단한 암반을 위에서 내려다본 면)으로 채우는 오토타일.
  - 동굴 문법(dot.render_cave)의 「천장」 자리에 그대로 들어간다: 바닥과 남쪽으로 닿은 바위 2칸 = 앞면(lo/hi), 나머지 바위 = 이 윗면.
  - 북·서 변 = 빛 받는 테두리(밝은 단), 동 변 = 그늘 테두리 + 바닥에 지는 그림자, 남 변 = 앞면 위로 빛나는 앞턱.
  - 바닥이 1~4px 파고드는 홈(옆선 표)과 둥근 바깥/안 모서리로 윤곽이 칸 격자를 따라 네모나게 꺾이지 않는다.
  - 몸통은 본몸통 + 변형 넷(엔진 interiorVariants, cellHash 로 고름). 판 설계(1)는 둘레까지 잔 얼룩이 차 있고 금은 칸 끝에서 그냥 끝나
    (이웃이 안 이으면 거기서 끝난 금으로 읽힘) 어느 변형끼리 붙어도 이음이 결 속에 묻힌다. 덩이 설계(2)는 덩이가 가로로 칸 끝을 넘지 않고,
    모든 변형이 같이 갖는 「이음 조약돌」 둘만 넘어 칸 끝 틈이 곧은 세로 띠가 되지 않게 끊는다(틈 바탕은 한 장이라 그대로 이어짐).
    가장 고른 몸통을 본몸통으로 둔다 — 가장자리 47 변형은 모두 본몸통이라 벽을 따라 같은 무늬가 칸마다 되풀이되지 않게.
  - 홈의 바닥색은 같은 줄·같은 번호 흙바닥 몸통 화소를 칸 자리에 맞춰 비쳐 넣는다(cave_r1.on_base) — 북·서 홈은 바닥 몸통,
    동 홈은 바닥의 서쪽 그늘 단(바닥 틀이 바위 동쪽 칸에 까는 그늘과 이어짐).

줄마다 두 벌은 서로 다른 설계다: 1 = 턱 진 암반(A 납작한 사암 판이 겹겹이 · B 모난 화강암 덩이 · C 얇은 층이 겹친 화산암 판),
2 = 바윗덩이가 빽빽한 돌무더기(A 이끼 덮인 둥근 사암 덩이 · B 큰 회색 바윗덩이 · C 주상 절리 기둥 머리).
덩이 설계는 변형마다 크기 섞임을 크게 달리하고(아주 큰 덩이 하나 / 중간 둘 / 작은 무리) 배치를 세로로 밀어(VSHIFT) 줄무늬를 깬다.
앞면(남쪽 2단)은 후보마다 새로 그린 dot.Face — 윗면 재질이 그대로 꺾여 내려간 더 어두운 세로 벽(아래 단일수록 한 단 더 어둡다),
윗면 턱이 열마다 0~2px 늘어져 두 면 경계가 자로 그은 줄이 되지 않고, 바닥 닿는 곳은 부스러기 + 접지 그림자, 끝은 먹 없이 둥글게.
모든 화소는 이 파일의 행 문자열·옆선 깊이 표·손으로 고른 꼭짓점에서 온다(손 도트). 색은 잠금 팔레트 (램프, 단) 만.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dot  # noqa: E402
import cave_r1 as CR  # noqa: E402  틀 조립 도구(strips·frame·on_base·autotile_cv·poly·variants_sheet)와 줄 바닥·앞면
from dot import Cv, legend  # noqa: E402

WAVE = 'gap'
T = 16

# ================================================================================================ 범례
# 공통 글자: k 금(가장 어두운 틈) · d 어두운 얼룩 · b 바탕 · c 바탕 둘째 · m 밝은 얼룩 · l 빛 · h 가장 밝은 빛 · w 반짝 점
#            e 앞면 그늘 · g n y 이끼·덧칠 · ',' 바닥 몸통(on_base) · '0' 바닥 그늘 단
LEG = {
    # A 해안 흙굴 — 따뜻한 갈색 사암(rim) + 갈색 흙 어둠(cfloor 0·1) + 이끼(moss). 바닥 cfloor 2 보다 한 단 어둡다.
    'A': legend(k=('rim', 0), d=('cfloor', 0), b=('rim', 1), c=('cfloor', 1), m=('rim', 2), l=('rim', 3), h=('rim', 4),
                w=('rim', 5), g=('moss', 3), n=('moss', 4), y=('moss', 5), e=('rim', 0), **{'0': ('cfloor', 0)}),
    # B 산속 바위굴 — 회색 화강암(crock 녹회 + stone 밝은 단). 바닥 cfloor 1(갈색) 과 색상이 갈린다.
    'B': legend(k=('stone', 0), d=('crock', 2), b=('crock', 3), c=('stone', 2), m=('crock', 4), l=('crock', 5),
                h=('stone', 4), w=('stone', 5), g=('moss', 2), n=('moss', 3), y=('moss', 4), e=('crock', 1),
                **{'0': ('cfloor', 0)}),
    # C 검푸른 심층굴 — 검푸른 화산암(vrock) + 푸른 쇠빛(iron) 결. 바닥 cata 3(차가운 회색)보다 확실히 어둡되 허공(void)은 아니다.
    'C': legend(x=('vrock', 0), k=('vrock', 1), d=('iron', 1), b=('vrock', 2), c=('iron', 2), m=('vrock', 3), l=('iron', 3),
                h=('vrock', 4), w=('iron', 4), g=('pool', 2), n=('glow', 0), y=('iron', 5), e=('vrock', 1),
                **{'0': ('cata', 0)}),
}

# 테두리 층(바깥 → 안). 북·서 = 빛 쪽, 동 = 그늘 쪽, 남 = 앞면 위 앞턱(아래 줄이 가장 밝다).
LIT = {'A': 'hlm', 'B': 'hlm', 'C': 'khl'}      # C 는 바닥(cata 3)과 밝기가 비슷해 바깥 한 줄을 어둡게 두르고 그 안을 밝힌다
SHADE = {'A': 'kd', 'B': 'kd', 'C': 'kd'}
LIP = {'A': 'hld', 'B': 'hmd', 'C': 'hmk'}   # 아래(앞면 닿는 줄)부터: 가장 밝은 앞턱 · 빛 · 위쪽 그늘 홈


def _layer(seq):
    def f(k, m):
        if k >= len(seq):
            return seq[-1]
        if k == m - 1 and m < len(seq):
            return seq[-1]
        return seq[k]
    return f


def _lip(seq):
    def f(k, m):
        if k == 0:
            return seq[0]
        if k == m - 1:
            return seq[2]
        return seq[1]
    return f


# ================================================================================================ 틀(모서리·안 모서리)
# 기호: , 바닥 몸통 · 0 바닥 그늘 · H L M 빛 쪽 테두리 세 단 · E D 그늘 쪽 두 단 · P Q R 앞턱(아래부터).
# 표준 깊이: 북·서 (홈 2, 테두리 끝 5) · 동 (2, 4) · 남 (0, 3). 모서리 바깥 열/행은 그 표준과 같다(사분면 경계 이음).
NW = [',,,,,,,,', ',,,,,,,,', ',,,,,,HH', ',,,,,HLL', ',,,,HLMM', ',,,HLM..', ',,HLM...', ',,HLM...']
NE = [',,,,,,,0', ',,,,HHE0', 'HHHHLLE0', 'LLLLMDE0', 'MMMMMDE0', '.....DE0', '....DE00', '....DE00']   # 동북 귀는 둥글게 깎지 않고 오른쪽 끝을 칸 위 1줄까지 올린다 — 동쪽 바닥 칸의 서쪽 그늘이 칸 맨 위에서 시작하므로 깎으면 그늘이 바위 위로 삐져나온다
SW = [',,HLM...', ',,HLM...', ',,HLM...', ',HLM....', ',HLM....', ',HLRRRRR', 'HLQQQQQQ', 'PPPPPPPP']
SE = ['....DE00', '....DE00', '....DE00', '.....DE0', '.....DE0', 'RRRRRDE0', 'QQQQQQDE', 'PPPPPPQD']
# 안 모서리(대각만 끊김). 북 쪽 둘은 바닥이 둥글게 파고든 오목한 귀, 남 쪽 둘은 앞면 윗단 위로 앞턱이 꺾여 들어오는 귀.
IN_NW = [',,HLM...', ',HHLM...', 'HHLLM...', 'LLLMM...', 'MMMM....', '........', '........', '........']
IN_NE = ['....DE00', '....DE00', '....DEHH', '....DLLL', '....MMMM', '........', '........', '........']
IN_SW = ['........', '........', '........', '........', '........', 'RRRR....', 'QQQQR...', 'PPPQR...']
IN_SE = ['........', '........', '........', '........', '........', '....RRRR', '...RQQQQ', '...RQPPP']


def _sym(rows, line):
    lit, sh, lip = LIT[line], SHADE[line], LIP[line]
    tr = {'H': lit[0], 'L': lit[1], 'M': lit[2], 'E': sh[0], 'D': sh[1], 'P': lip[0], 'Q': lip[1], 'R': lip[2]}
    return [''.join(tr.get(c, c) for c in r) for r in rows]


def _east_notch(rows):
    """동 변 띠: 홈은 바닥 그늘('0')."""
    return rows


def rock_frame(line, prof):
    """prof = {'N','W','E','S'}: 옆선 표 16칸씩 (홈 깊이, 테두리 끝). 반환 (틀 32×32 기호, 안 모서리 16×16 기호)."""
    lit, sh, lip = LIT[line], SHADE[line], LIP[line]
    n = CR.strips(prof['N'], _layer(lit), ',')
    w = CR.strips(prof['W'], _layer(lit), ',')
    e = CR.strips(prof['E'], _layer(sh), '0')
    s = CR.strips(prof['S'], _lip(lip), ',')
    fr = CR.frame(_sym(NW, line), _sym(NE, line), _sym(SW, line), _sym(SE, line), n, s, w, e)
    inner = [a + b for a, b in zip(_sym(IN_NW, line), _sym(IN_NE, line))] + \
            [a + b for a, b in zip(_sym(IN_SW, line), _sym(IN_SE, line))]
    CR.check_frame(f'{line} 바위 채움', fr, inner, strict_inner=False)
    return fr, inner


# ================================================================================================ 몸통 손 도트 도구
def blit(rows, spr, x, y):
    """행 문자열 spr 를 rows 의 (x, y) 에 찍는다. '.' 투명, 칸 밖은 잘린다(감지 않는다 — 변형끼리 섞여도 반쪽이 생기지 않게 자리를 고른다)."""
    g = [list(r) for r in rows]
    for dy, r in enumerate(spr):
        for dx, ch in enumerate(r):
            X, Y = x + dx, y + dy
            if ch != '.' and 0 <= X < 16 and 0 <= Y < 16:
                g[Y][X] = ch
    return [''.join(r) for r in g]


def cut(rows, paths, dark='k', shade='d', lit='l', keep=''):
    """손으로 고른 꼭짓점을 잇는 금을 판다(감지 않음). 금 위·왼 = 그늘, 아래·오른 = 빛 받는 턱. keep 글자는 덮지 않는다."""
    P = set()
    for path in paths:
        for x, y in CR.poly(*path):
            if 0 <= x < 16 and 0 <= y < 16:
                P.add((x, y))
    g = [list(r) for r in rows]
    for x, y in P:
        if g[y][x] not in keep:
            g[y][x] = dark
    for x, y in P:
        for dx, dy, ch in ((-1, 0, shade), (0, -1, shade), (1, 0, lit), (0, 1, lit)):
            X, Y = x + dx, y + dy
            if 0 <= X < 16 and 0 <= Y < 16 and (X, Y) not in P and g[Y][X] == rows[Y][X] and g[Y][X] not in keep:
                g[Y][X] = ch
    return [''.join(r) for r in g]


def turn(rows, k):
    """바탕 얼룩을 변형마다 돌려 쓴다(0 그대로 · 1 좌우 · 2 상하 · 3 대각 뒤집기)."""
    if k == 1:
        return [r[::-1] for r in rows]
    if k == 2:
        return rows[::-1]
    if k == 3:
        return [''.join(c) for c in zip(*rows)]
    return list(rows)


def paint(rows, pts, ch):
    g = [list(r) for r in rows]
    for x, y in pts:
        g[y][x] = ch
    return [''.join(r) for r in g]


def quiet_first(bodies):
    """마지막에 적은 가장 조용한 몸통(금·덩이가 고른 것)을 본몸통으로 — 가장자리 47 변형은 모두 본몸통을 쓰므로
    벽을 따라 길게 이어질 때 눈에 띄는 무늬가 칸마다 되풀이되지 않게 한다."""
    return [bodies[-1]] + bodies[:-1]


def make_at(line, n, prof, bodies):
    """bodies = 16×16 행 문자열 목록(첫째가 본몸통). 바닥 = 같은 줄·같은 번호 cave-r1 흙바닥."""
    leg = LEG[line]
    floor = CR.part(line, n, 'floor')
    fr, inner = rock_frame(line, prof)
    frc, innc = CR.on_base(floor.body, fr, inner, leg)
    cvs = [dot.grid(b, leg, 16, 16) for b in bodies]
    return CR.autotile_cv(cvs[0], frc, innc, cvs[1:])


def blitw(rows, spr, x, y):
    """감아 찍기(16 주기) — 그 변형은 스스로 이어진다(본몸통 반복 이음). 다른 변형과 만나는 변에서는 덩이가 잘린 채 맞닿아
    빽빽한 무더기에서 덩이끼리 겹친 것처럼 읽힌다(칸 둘레에 빈 틈 띠가 생기지 않는다)."""
    g = [list(r) for r in rows]
    for dy, r in enumerate(spr):
        for dx, ch in enumerate(r):
            if ch != '.':
                g[(y + dy) % 16][(x + dx) % 16] = ch
    return [''.join(r) for r in g]


def pile(base, layout):
    """덩이를 남쪽 끝이 북쪽인 것부터 찍는다 — 남쪽(앞) 덩이가 북쪽(뒤) 덩이를 가린다(3/4)."""
    rows = list(base)
    for spr, x, y in sorted(layout, key=lambda t: (t[2] + len(t[0]), t[1])):
        rows = blitw(rows, spr, x, y)
    return rows


VSHIFT = (0, 5, 10, 3, 0)   # 변형마다 덩이 배치를 세로로 밀어(감아) 덩이 줄 높이가 칸마다 같아 가로 줄무늬가 지는 것을 깬다


def shift(layout, dy):
    return tuple((spr, x, (y + dy) % 16) for spr, x, y in layout)


def stampl(rows, items):
    for spr, x, y in items:
        rows = blit(rows, spr, x, y)
    return rows


# ================================================================================================ 줄 A — 해안 흙굴
# A1 계단진 사암 턱: 납작하고 모난 사암 판(윗면 b·c, 위·왼 턱 끝 빛 l·m)이 겹겹이 얹혀, 판마다 남쪽 아래로
# 앞 턱 그늘(d) 한 줄과 밑 그림자(k)가 진다 — 판 하나하나가 한 단 높은 바위로 읽힌다(마른 진흙 금·판석 바닥이 아니다).
# 판 사이 틈 바탕은 어두운 흙(d·k). 이끼(g n)는 판 턱 그늘 쪽에 드문드문, 자리를 변형마다 달리.
A1_GAP = [
    'bkbbdbbbbkbbbdbb', 'bbbbbbkbbbbdbbbk', 'kbbdbbbbbbbbbbbb', 'bbbbbbdbkbbbbkbb',
    'bdbbbbbbbbbdbbbb', 'bbbbkbbdbbbbbbdb', 'bbbbbbbbbkbbbbbb', 'dbbkbbbbbbbbkbbb',
    'bbbbbbdbbbbdbbbb', 'bkbbbbbbbkbbbbbd', 'bbbbdbbbbbbbkbbb', 'bbbbbbbkbbdbbbbb',
    'kbdbbbbbbbbbbkbb', 'bbbbbbkbdbbbbbbb', 'bdbbkbbbbbbkbbdb', 'bbbbbbbbkbbbbbbb']
A1_S1 = ['...lllmm.....', '.lllmcccmm...', 'lmccccbcccmm.', 'mccbccccccccd', '.ccccccbcccdd', '.ddddcccdddk.',
         '..kkkddddkk..']
A1_S2 = ['.llmm....', 'lmcccmm..', 'mccbccccd', '.ccccccdd', '.dddddddk', '..kkkkkk.']
A1_S3 = ['..lllmmm...', 'llmcccccmm.', 'mcccbcccccd', '.ddddddddk.', '..kkkkkk...']
A1_S4 = ['.llm..', 'lmccm.', 'mcbcd.', '.ddk..', '..k...']
A1_S5 = ['....llm....', '..llmccmm..', '.lmcccbccm.', 'lmcbccccccd', 'mccccccbcdd', '.ccbccccddk', '..dddddddk.',
         '...kkkkkk..']
A1_MOSS = ['gn', '.g']
A1_XL = ['....lllmmm....', '..llmcccccmm..', '.lmcccbcccccm.', 'lmcccccccbcccd', 'mccbcccccccccd', 'mcccccccbcccdd',
         '.cccbccccccdd.', '.dddcccccdddk.', '..kddddddddk..', '...kkkkkkkk...']
A1_PORTS = ((A1_S4, 13, 4), (A1_S4, 13, 12))
A1_LAYOUT = [   # 판은 1~14열 안에서만, 세로로는 감아 넘음. 크기를 칸마다 크게 섞는다. 마지막 = 본몸통
    ((A1_XL, 1, 1), (A1_S4, 2, 11), (A1_MOSS, 9, 12)),
    ((A1_S5, 2, 1), (A1_S2, 1, 9), (A1_S4, 9, 12), (A1_S4, 10, 0), (A1_MOSS, 8, 6)),
    ((A1_S4, 1, 0), (A1_S4, 6, 1), (A1_S2, 2, 5), (A1_S4, 10, 6), (A1_S3, 4, 10), (A1_MOSS, 11, 3)),
    ((A1_S2, 1, 1), (A1_XL, 1, 5), (A1_S4, 10, 1), (A1_MOSS, 5, 3)),
    ((A1_S1, 1, 1), (A1_S2, 5, 8), (A1_S4, 10, 2), (A1_MOSS, 3, 13)),
]
A1_PROF = {
    'N': [(2, 5), (2, 5), (1, 4), (1, 4), (1, 4), (2, 5), (3, 6), (2, 5), (2, 5), (3, 6), (4, 7), (4, 7), (3, 6), (2, 5), (1, 4), (2, 5)],
    'W': [(2, 5), (3, 6), (3, 6), (2, 5), (1, 4), (1, 4), (1, 4), (2, 5), (2, 5), (2, 5), (1, 4), (0, 3), (0, 3), (1, 4), (2, 5), (2, 5)],
    'E': [(2, 4), (1, 3), (1, 3), (2, 4), (3, 5), (4, 6), (3, 5), (2, 4), (2, 4), (2, 4), (1, 3), (1, 3), (2, 4), (3, 5), (3, 5), (2, 4)],
    'S': [(0, 3), (0, 3), (0, 4), (0, 4), (0, 3), (0, 2), (0, 3), (0, 3), (0, 3), (0, 4), (0, 5), (0, 4), (0, 3), (0, 3), (0, 2), (0, 3)],
}


def a1_bodies():
    return [pile(A1_GAP, A1_PORTS + shift(lay, d)) for lay, d in zip(A1_LAYOUT, VSHIFT)]


# A2 이끼 덮인 둥근 사암 덩이 무더기: 어두운 흙·자갈 틈(d k b) 위로 크기가 다른 둥근 덩이가 빽빽이 겹쳐 쌓였다
# (위·왼 빛 h l m, 아래·오른 그늘 c b d, 밑 틈 k, 머리에 이끼 n y g). 덩이 자리·크기 섞임은 변형마다 다르다.
A2_GRIT = [   # 덩이 사이 흙·자갈: 바탕(b) 덩어리와 어두운 흙(d) 덩어리가 2~3화소씩 — 덩이 그늘보다 밝아 칸 끝 틈이 검은 줄로 튀지 않는다
    'bbddbbbdbbkddbbb', 'bdddbbddbbbddbbk', 'bbdbbbdkbdbbbbdd', 'kbbbddbbbddbbdbb',
    'dbbbddbbbdbbkddb', 'ddbkbbbddbbbbddb', 'bbbbbdbbdddbbbbb', 'bddbbddbbdbbbdkb',
    'bddbbbdbbbbddbbd', 'bbbbkbbbddbbddbb', 'dbbddbbbdbbbbbdd', 'ddbbdbbkbbddbbbd',
    'bbbbbbddbbbdbkbb', 'bdkbbddbbddbbbbd', 'bddbbbbbbdbbddbb', 'bbbddbkbbbbbdbbb']
A2_BIG = ['...gnnn....', '..gnyynl...', '.hlnnllmc..', 'hllllmmmcb.', 'llmmmmmccbd', 'lmmmmcccbbd',
          '.mmcccbbbd.', '..cbbbbddk.', '....kkkk...']
A2_MED = ['..gnn...', '.hnynl..', 'hllmmmc.', 'lmmmccbd', '.mmccbd.', '..cbbdk.', '...kkk..']
A2_LONG = ['..gnnn....', '.hllnllmc.', 'hlmmmmccbd', '.mmcccbbd.', '...kkkk...']
A2_SML = ['.gn..', 'hlnm.', 'lmmcb', '.cbd.', '..k..']
A2_PEB = ['.lm.', 'lmcb', '.kk.']
A2_HUGE = ['....gnnng....', '..gnyynnnl...', '.hlnnnllmmc..', 'hllllllmmmcb.', 'llmmmmmmmccbd', 'lmmmmmmccccbd',
           'mmmmcccccbbbd', '.mcccccbbbbd.', '..ccbbbbbddk.', '...kbbbdddk..', '.....kkkk....']
# 덩이 자리: 변형마다 다른 덩이는 1~14열 안에만(가로로 칸 끝을 넘지 않음 — 변형끼리 만나는 세로 변에서 덩이가 잘리지 않게),
# 세로로는 감아 넘어도 된다. 모든 변형이 같이 갖는 「이음 조약돌」(PORTS) 둘만 가로 칸 끝을 넘는다 — 칸 끝 틈이 곧은 세로 띠로
# 이어지지 않게 끊어 준다(모든 변형에 같은 자리라 어느 변형끼리 붙어도 잘리지 않는다). 마지막 = 본몸통.
A2_PORTS = ((A2_PEB, 14, 3), (A2_PEB, 14, 11))
A2_LAYOUT = [   # 크기를 칸마다 크게 섞는다 — 큰 덩이 하나 + 조약돌 / 중간 덩이 셋 / 작은 덩이 무리
    ((A2_HUGE, 1, 1), (A2_PEB, 9, 12), (A2_SML, 1, 12)),
    ((A2_LONG, 4, 0), (A2_MED, 1, 4), (A2_BIG, 4, 7), (A2_PEB, 11, 2)),
    ((A2_SML, 1, 1), (A2_SML, 6, 0), (A2_PEB, 11, 1), (A2_MED, 3, 5), (A2_SML, 10, 7), (A2_PEB, 1, 10), (A2_SML, 5, 12),
     (A2_PEB, 10, 13)),
    ((A2_SML, 1, 0), (A2_HUGE, 2, 4), (A2_PEB, 10, 0)),
    ((A2_MED, 1, 1), (A2_SML, 9, 0), (A2_SML, 10, 6), (A2_MED, 4, 8), (A2_PEB, 1, 11), (A2_SML, 10, 12)),
]
A2_PROF = {
    'N': [(2, 5), (1, 4), (1, 4), (2, 5), (3, 6), (3, 6), (2, 5), (2, 5), (2, 5), (1, 4), (1, 4), (2, 5), (3, 6), (4, 7), (3, 6), (2, 5)],
    'W': [(2, 5), (2, 5), (1, 4), (1, 4), (2, 5), (3, 6), (3, 6), (2, 5), (2, 5), (1, 4), (2, 5), (3, 6), (4, 7), (3, 6), (2, 5), (2, 5)],
    'E': [(2, 4), (3, 5), (4, 6), (3, 5), (2, 4), (1, 3), (1, 3), (2, 4), (2, 4), (1, 3), (2, 4), (3, 5), (3, 5), (2, 4), (1, 3), (2, 4)],
    'S': [(0, 3), (0, 4), (0, 4), (0, 3), (0, 3), (0, 2), (0, 3), (0, 3), (0, 3), (0, 3), (0, 4), (0, 4), (0, 3), (0, 2), (0, 2), (0, 3)],
}


def a2_bodies():
    return [pile(A2_GRIT, A2_PORTS + shift(lay, d)) for lay, d in zip(A2_LAYOUT, VSHIFT)]   # 틈 바탕은 한 장(돌리지 않음) — 칸 끝 틈이 그대로 이어진다


# ================================================================================================ 줄 B — 산속 바위굴
# B1 모난 화강암 덩이: 윗면이 평평한(m, 얼룩 b, 위·왼 턱 끝 l) 모난 바위 덩이가 겹겹이 쌓이고, 덩이마다 남쪽으로
# 키 큰 앞면(위 끝 b · 몸 d · 세로 갈라짐 k · 그늘 e) 2~4줄이 보인다 — 칸 안의 작은 절벽들로 높이가 읽힌다(판석 바닥이 아니다).
B1_GAP = [
    'eddedkdeddddekde', 'ddeddddddeddddde', 'kdddedkdddeddkdd', 'ddeddddddddedddd',
    'dddddeddkddddded', 'edkddddeddddeddd', 'dddeddddddkddddk', 'ddddddeddeddddde',
    'kddeddddddddeddd', 'dddddkdeddddddkd', 'deddddddddedkddd', 'dddkdeddddddddde',
    'edddddddkdddeddd', 'ddeddedddddeddkd', 'dkddddddeddddddd', 'ddddkddeddkdeddd']
B1_K1 = ['..lllll.....', '.lmmmmmll...', 'lmmbmmmmmll.', 'lmmmmmmbmmmd', 'lmbmmmmmmmbd', 'bbbbbbbbbbbe',
         'ddddkdddddde', 'ddddkddddded', 'eddddddkddek', '.kkkkkkkkkk.']
B1_K2 = ['.llll...', 'lmmmmll.', 'lmmbmmmd', 'lmmmmmbd', 'bbbbbbbe', 'dddkddde', 'edddddek', '.kkkkkk.']
B1_K3 = ['...lllll..', '.llmmmmml.', 'lmmmbmmmmd', 'bbbbbbbbbe', 'dddddkddde', '.kkkkkkkk.']
B1_K4 = ['.lll.', 'lmmml', 'bbbbe', 'ddkde', '.kkk.']
B1_XL = ['...llllll.....', '.llmmmmmmlll..', 'lmmmbmmmmmmml.', 'lmmmmmmmmbmmmd', 'lmbmmmmmmmmmmd', 'lmmmmmmbmmmmbd',
         'bbbbbbbbbbbbbe', 'ddddkddddddkde', 'eddddddkdddddk', '.kkkkkkkkkkkk.']
B1_K5 = ['....lll.....', '..llmmmlll..', '.lmmmbmmmml.', 'lmmmmmmmmbmd', 'bbbbbbbbbbbe', 'ddkddddddkde',
         'eddddddddddk', '.kkkkkkkkkk.']
B1_PORTS = ((B1_K4, 13, 3), (B1_K4, 13, 11))
B1_LAYOUT = [   # 큰 덩이 하나 / 중간 둘 / 작은 덩이 무리 — 크기를 칸마다 섞는다. 마지막 = 본몸통
    ((B1_XL, 1, 1), (B1_K4, 2, 11), (B1_K4, 9, 12)),
    ((B1_K2, 1, 1), (B1_K5, 2, 7), (B1_K4, 9, 1)),
    ((B1_K4, 1, 0), (B1_K4, 6, 2), (B1_K3, 1, 5), (B1_K4, 9, 8), (B1_K2, 4, 10)),
    ((B1_K4, 1, 1), (B1_XL, 1, 5), (B1_K4, 8, 0)),
    ((B1_K1, 1, 1), (B1_K4, 2, 11), (B1_K3, 4, 10)),
]
B1_PROF = {
    'N': [(2, 5), (2, 5), (2, 5), (1, 4), (1, 4), (1, 4), (2, 5), (2, 5), (2, 5), (3, 6), (3, 6), (4, 7), (4, 6), (3, 5), (2, 5), (2, 5)],
    'W': [(2, 5), (2, 5), (3, 6), (4, 7), (4, 6), (3, 5), (2, 5), (2, 5), (2, 5), (1, 4), (1, 4), (1, 4), (2, 5), (2, 5), (2, 5), (2, 5)],
    'E': [(2, 4), (2, 4), (1, 3), (1, 3), (1, 3), (2, 4), (3, 5), (2, 4), (2, 4), (3, 5), (4, 6), (4, 6), (3, 5), (2, 4), (2, 4), (2, 4)],
    'S': [(0, 3), (0, 3), (0, 3), (0, 4), (0, 5), (0, 4), (0, 3), (0, 3), (0, 3), (0, 2), (0, 2), (0, 3), (0, 4), (0, 4), (0, 3), (0, 3)],
}


def b1_bodies():
    return [pile(B1_GAP, B1_PORTS + shift(lay, d)) for lay, d in zip(B1_LAYOUT, VSHIFT)]


# B2 큰 회색 바윗덩이: 넓고 밝은 윗면(w h l)이 위로 둥글고 아래로 그늘(b d)·밑 틈(k)이 지는 큰 덩이가 빽빽이 쌓였다.
# A2 보다 덩이가 크고 수가 적으며 모가 살짝 진다(윗면 평평한 덩이·모난 조각 섞임). 이끼 없음.
B2_GRIT = [
    'dddeddddddddeddd', 'ddddddedddddddde', 'deddddddddeddddd', 'dddddddkdddddedd',
    'ddedddddddddddd' + 'd', 'dddddeddddeddddd', 'eddddddddddddkdd', 'dddddddeddddeddd',
    'ddddeddddddddddd', 'dddddddddeddddde', 'dedddkdddddddddd', 'ddddddddddedddkd',
    'ddddddeddddddddd', 'deddddddddddeddd', 'ddddddddeddddddd', 'dddeddddddddddde']
B2_BIG = ['....llmm......', '..llmmmmmb....', '.lmmmmbmmmbb..', 'lmmmbmmmmmbbd.', 'lmmmmmmmbbbbdd', 'mmmbmmmbbbbddd',
          'bmmmmmbbbbbdde', '.bbbbbbbbddde.', '..bbbbdddeee..', '...ddddeeek...', '.....kkkk.....']
B2_MED = ['...llm....', '.llmmmbb..', 'lmmmmmbbd.', 'mmmbmbbbdd', 'bmmmbbbdde', '.bbbbddde.', '..ddeeek..', '....kk....']
B2_FLAT = ['.llmmm...', 'lmmmmbbb.', 'mmbbbbbdd', '.bbbddde.', '...kkkk..']
B2_SHARD = ['..lm..', '.lmmb.', 'lmmbbd', 'mbbdde', '..kk..']
B2_CHIP = ['.lm.', 'mmbd', '.kk.']
B2_PORTS = ((B2_CHIP, 14, 6), (B2_CHIP, 14, 13))
B2_LAYOUT = [   # 큰 덩이 하나가 칸을 거의 채우는 칸 / 중간 둘 / 납작한 것과 조각 — 크기 섞임을 칸마다 크게
    ((B2_BIG, 1, 1), (B2_CHIP, 3, 12)),
    ((B2_MED, 5, 0), (B2_FLAT, 1, 4), (B2_MED, 4, 8), (B2_CHIP, 1, 13)),
    ((B2_SHARD, 1, 0), (B2_BIG, 1, 5), (B2_CHIP, 9, 1)),
    ((B2_FLAT, 4, 0), (B2_MED, 1, 4), (B2_SHARD, 9, 6), (B2_FLAT, 5, 11), (B2_CHIP, 11, 2)),
    ((B2_MED, 1, 0), (B2_MED, 5, 4), (B2_SHARD, 1, 9), (B2_SHARD, 9, 12), (B2_CHIP, 11, 0)),
]
B2_PROF = {
    'N': [(2, 5), (3, 6), (3, 6), (2, 5), (1, 4), (1, 4), (2, 5), (2, 5), (2, 5), (2, 5), (1, 4), (1, 4), (2, 5), (3, 6), (3, 6), (2, 5)],
    'W': [(2, 5), (1, 4), (1, 4), (2, 5), (3, 6), (4, 7), (3, 6), (2, 5), (2, 5), (2, 5), (2, 5), (1, 4), (1, 4), (2, 5), (3, 6), (2, 5)],
    'E': [(2, 4), (2, 4), (3, 5), (3, 5), (2, 4), (1, 3), (2, 4), (2, 4), (2, 4), (1, 3), (1, 3), (2, 4), (3, 5), (4, 6), (3, 5), (2, 4)],
    'S': [(0, 3), (0, 2), (0, 3), (0, 4), (0, 4), (0, 3), (0, 3), (0, 3), (0, 3), (0, 4), (0, 3), (0, 2), (0, 3), (0, 4), (0, 4), (0, 3)],
}


def b2_bodies():
    return [pile(B2_GRIT, B2_PORTS + shift(lay, d)) for lay, d in zip(B2_LAYOUT, VSHIFT)]


# ================================================================================================ 줄 C — 검푸른 심층굴
# C1 층 진 현무암 판: 검푸른 바탕(b) 에 가는 층 줄(k, 4~11칸, 조금씩 물결) 이 판마다 겹겹이 지나가고, 판 사이는 깊은 금(x)
# + 금 아래·오른 빛 턱(m). 층 줄은 판(금으로 막힌 칸) 안에서 끝나 판마다 층 방향·간격이 다르다.
C1_BASE = [
    'bbbdbbbbbbbbbdbb', 'bbbbbbbcbbbbbbbb', 'bdbbbbbbbbbbbbbb', 'bbbbbbbbbdbbbcbb',
    'bbbbcbbbbbbbbbbb', 'bbbbbbbbbbbbbbbd', 'bbdbbbbbbbcbbbbb', 'bbbbbbbbbbbbbbbb',
    'bbbbbbdbbbbbbbbb', 'cbbbbbbbbbbbbdbb', 'bbbbbbbbbcbbbbbb', 'bbbdbbbbbbbbbbbb',
    'bbbbbbbbbbbbdbbb', 'bbbbbcbbbbbbbbbb', 'bdbbbbbbbbbbbbbc', 'bbbbbbbbdbbbbbbb']
C1_NETS = [
    [[(0, 7), (6, 8), (11, 6), (15, 7)], [(6, 8), (7, 15)]],
    [[(9, 0), (8, 5), (10, 9), (9, 15)], [(10, 9), (15, 11)]],
    [[(0, 12), (5, 11), (12, 13), (15, 12)], [(5, 11), (4, 4), (6, 0)]],
    [[(15, 3), (10, 4), (7, 9), (0, 10)]],
    [[(3, 0), (4, 6)], [(15, 8), (11, 9)]],
]
C1_STRATA = [   # (x, y, 길이, 꺾임) — '+' 한 줄 내려감 · '-' 올라감
    [(1, 2, 9, '0000-0000'), (2, 5, 7, '0000000'), (9, 10, 6, '00+000'), (10, 13, 5, '00000'), (1, 11, 4, '0000')],
    [(1, 2, 6, '00+000'), (0, 6, 7, '000-000'), (1, 11, 6, '000000'), (11, 3, 4, '0000'), (11, 13, 4, '0+00')],
    [(7, 2, 8, '00000+00'), (7, 6, 7, '0000000'), (6, 9, 8, '000-0000'), (0, 6, 3, '000'), (1, 14, 9, '0000-0000')],
    [(1, 2, 8, '000-0000'), (2, 5, 4, '0000'), (9, 7, 6, '0-0000'), (2, 13, 10, '00000+0000')],
    [(6, 2, 8, '0000+000'), (0, 9, 9, '000-00000'), (6, 12, 8, '00000000'), (10, 5, 5, '0+000')],
]
C1_PROF = {
    'N': [(2, 5), (2, 5), (3, 6), (3, 6), (2, 5), (1, 4), (1, 4), (2, 5), (2, 5), (1, 4), (1, 4), (2, 5), (2, 5), (3, 6), (3, 6), (2, 5)],
    'W': [(2, 5), (3, 6), (3, 6), (2, 5), (2, 5), (1, 4), (1, 4), (2, 5), (2, 5), (3, 6), (4, 7), (3, 6), (2, 5), (1, 4), (1, 4), (2, 5)],
    'E': [(2, 4), (1, 3), (1, 3), (2, 4), (2, 4), (3, 5), (3, 5), (2, 4), (2, 4), (2, 4), (3, 5), (4, 6), (3, 5), (2, 4), (1, 3), (2, 4)],
    'S': [(0, 3), (0, 3), (0, 4), (0, 3), (0, 2), (0, 3), (0, 4), (0, 3), (0, 3), (0, 4), (0, 4), (0, 3), (0, 3), (0, 2), (0, 3), (0, 3)],
}


def strata(rows, x0, y0, n, bend):
    """층 줄 하나: 가는 그늘 줄(k) + 바로 위 한 화소 옅은 빛(c, 가운데 부분만) — 양 끝은 그늘만(가늘어짐)."""
    g = [list(r) for r in rows]
    y = y0
    for i in range(n):
        if i:
            y += {'+': 1, '-': -1}.get(bend[i], 0)
        x = x0 + i
        if 0 <= x < 16 and 0 <= y < 16 and g[y][x] not in 'xm':
            g[y][x] = 'k'
            if 1 <= i < n - 1 and 0 <= y - 1 < 16 and g[y - 1][x] not in 'xmk':
                g[y - 1][x] = 'c'
    return [''.join(r) for r in g]


def c1_bodies():
    out = []
    for i, (net, st) in enumerate(zip(C1_NETS, C1_STRATA)):
        rows = turn(C1_BASE, i % 4)
        rows = cut(rows, net, dark='x', shade='k', lit='m')
        for x, y, n, bend in st:
            rows = strata(rows, x, y, n, bend)
        out.append(rows)
    return out


# C2 육각 주상 절리: 검푸른 현무암 기둥 머리(밝은 윗면 c·b, 위·왼 끝 h l) 밑으로 기둥 옆면 1~2줄(d k)이 보이고,
# 기둥끼리 높이가 달라(윗면 색 c / b) 어두운 절리 틈(x k)에 빽빽이 박혔다.
C2_GAP = [   # 절리 틈: 쇠빛 어둠(d)에 더 깊은 틈(k·x) — 기둥 옆면(d k)과 이어져 칸 끝 틈이 곧은 검은 띠로 보이지 않는다
    'dkdddkddxdddkddd', 'ddddkdddddkdddkd', 'kddxddddkddddddd', 'dddddkdddddxdkdd',
    'ddkdddddkddddddk', 'xddddkddddkddxdd', 'dddkdddxddddkddd', 'dkddddkddddddddk',
    'ddddxdddddkddkdd', 'kdddddkddxddddxd', 'dddkddddddddkddd', 'ddxddkdddkdddddk',
    'kddddddkdddxdkdd', 'ddkdxdddddddddkd', 'dddddkddkddkdddd', 'dxdkdddddxddddkd']
# 기둥 머리는 모서리를 깎은 육각: 평평한 윗면(한 톤 c) · 북서 모 빛(h l) · 남동 모 그늘(b m) · 남쪽 옆면 2~3줄(d k).
C2_XL = ['...hhhhhhl...', '..hcccccccl..', '.hcccccccccl.', 'hccccccccccbm', 'hcccccccccbbm', 'lccccccccbbbm',
         '.lccccccbbbm.', '..mbbbbbbbm..', '..ddddddddd..', '..dkdddddkd..', '...kkkkkkk...']   # 아주 굵은 기둥
C2_HI = ['..hhhhl..', '.hcccccl.', 'hcccccccm', 'hccccccbm', 'lcccccbbm', '.mbbbbbm.', '.ddddddd.', '.dkdddkd.', '..kkkkk..']
C2_WD = ['..hhhhhl...', '.hccccccl..', 'hcccccccccm', 'lccccccbbbm', '.mbbbbbbbm.', '.ddddddddd.', '..kkkkkkk..']   # 넓고 낮은
C2_LO = ['..lmmm..', '.lbbbbm.', 'lbbbbbbd', 'mbbbbbdd', '.mbbbdd.', '.kkkkkk.']             # 낮은 기둥(어두운 윗면, 옆면 1줄)
C2_SM = ['.hhl.', 'hcccl', 'lcbbm', '.ddd.', '.kkk.']
C2_PORTS = ((C2_SM, 13, 2), (C2_SM, 13, 10))
C2_LAYOUT = [   # 아주 굵은 기둥 하나 / 중간 기둥 둘 / 가는·낮은 기둥 무리 — 기둥 굵기를 칸마다 크게 섞는다. 마지막 = 본몸통
    ((C2_XL, 1, 1), (C2_SM, 2, 12), (C2_LO, 7, 12)),
    ((C2_HI, 1, 0), (C2_WD, 3, 8), (C2_SM, 10, 1)),
    ((C2_SM, 1, 0), (C2_SM, 6, 1), (C2_LO, 1, 5), (C2_SM, 9, 6), (C2_HI, 4, 9), (C2_SM, 1, 12)),
    ((C2_SM, 1, 0), (C2_XL, 1, 4), (C2_SM, 8, 0)),
    ((C2_HI, 1, 1), (C2_WD, 4, 6), (C2_SM, 10, 0), (C2_LO, 1, 10), (C2_SM, 10, 12)),
]
C2_PROF = {
    'N': [(2, 5), (1, 4), (1, 4), (2, 5), (2, 5), (3, 6), (3, 6), (2, 5), (2, 5), (2, 5), (1, 4), (1, 4), (2, 5), (3, 6), (2, 5), (2, 5)],
    'W': [(2, 5), (2, 5), (3, 6), (4, 7), (3, 6), (2, 5), (1, 4), (2, 5), (2, 5), (1, 4), (1, 4), (2, 5), (2, 5), (3, 6), (3, 6), (2, 5)],
    'E': [(2, 4), (3, 5), (3, 5), (2, 4), (1, 3), (1, 3), (2, 4), (2, 4), (2, 4), (3, 5), (4, 6), (3, 5), (2, 4), (2, 4), (1, 3), (2, 4)],
    'S': [(0, 3), (0, 4), (0, 4), (0, 3), (0, 3), (0, 2), (0, 2), (0, 3), (0, 3), (0, 3), (0, 4), (0, 5), (0, 4), (0, 3), (0, 3), (0, 3)],
}


def c2_bodies():
    return [pile(C2_GAP, C2_PORTS + shift(lay, d)) for lay, d in zip(C2_LAYOUT, VSHIFT)]


BUILD = {('A', 1): (A1_PROF, a1_bodies), ('A', 2): (A2_PROF, a2_bodies),
         ('B', 1): (B1_PROF, b1_bodies), ('B', 2): (B2_PROF, b2_bodies),
         ('C', 1): (C1_PROF, c1_bodies), ('C', 2): (C2_PROF, c2_bodies)}
_CACHE = {}


def rock(line, n):
    if (line, n) not in _CACHE:
        prof, mk = BUILD[(line, n)]
        _CACHE[(line, n)] = make_at(line, n, prof, quiet_first(mk()))
    return _CACHE[(line, n)]


# ================================================================================================ 앞면(후보마다 새로)
# 윗면 재질이 그대로 꺾여 내려간 세로 벽: 윗면보다 한두 단 어둡고(그늘 쪽 재질 단만), 맨 위 0줄 = 윗면 턱 밑 주름,
# 1~2줄 = 빛 받는 위 모서리, 가운데 = 재질별 층·결·금(금의 왼 벽 그늘 · 오른 벽 빛), 28~31줄 = 바닥에 닿는 부스러기와
# 접지 그림자(바닥 '0'). 끝 마구리는 먹 없이 둥글게(왼끝 빛 쪽 밝은 단, 오른끝 그늘 쪽 어두운 재질 단, 아래 귀는 바닥으로).
# 16칸 주기(가로로 감아 찍음) 무늬 16×32 → dot.Face 32×32.

def _fgrid(base, top, bottom, low=None, split=14):
    """위(3~split-1) 결 base · 아래(split~27) 결 low — 아래로 갈수록 한 단 어두워져 세로 벽으로 읽힌다."""
    low = low or base
    mid = [list((base if y < split else low)[y % len((base if y < split else low))]) for y in range(3, 28)]
    return [list(r) for r in top] + mid + [list(r) for r in bottom]


LIPC = {'A': ('l', 'k', 'c'), 'B': ('m', 'k', 'b'), 'C': ('m', 'k', 'd')}


def _lipline(g, line, depth):
    """윗면 턱이 앞면 위로 몇 화소 늘어진 깊이(열마다 '0'~'2') — 두 면의 경계가 자로 그은 줄이 되지 않게."""
    lip, crease, lit = LIPC[line]
    for x, d in enumerate(depth):
        d = int(d)
        for y in range(d):
            g[y][x] = lip
        g[d][x] = crease
        if g[d + 1][x] not in 'g':
            g[d + 1][x] = lit


def _fput(g, x, y, ch):
    if 3 <= y < 28 or ch in '0':
        g[y][x % 16] = ch


def _beds(g, beds, crease, under, lit):
    """층 경계: 손으로 적은 열마다 높이 오프셋(문자 '0'~'3'). 경계 줄 = 주름, 위 = 위 층 밑 그늘, 아래 = 아래 층 빛 턱."""
    for y0, offs in beds:
        for x, o in enumerate(offs):
            if o == '.':
                continue
            y = y0 + int(o)
            _fput(g, x, y - 1, under)
            _fput(g, x, y, crease)
            _fput(g, x, y + 1, lit)


def _joints(g, joints, crease, shade, lit):
    """세로 금: (열들 문자열, y0) — 열 글자 하나가 한 줄(16진 열 번호), 금 왼 = 그늘, 오른 = 빛."""
    for cols, y0 in joints:
        for dy, c in enumerate(cols):
            x = int(c, 16)
            _fput(g, x - 1, y0 + dy, shade)
            _fput(g, x, y0 + dy, crease)
            _fput(g, x + 1, y0 + dy, lit)


def _stones(g, items):
    for spr, x, y in sorted(items, key=lambda t: t[2] + len(t[0])):
        for dy, r in enumerate(spr):
            for dx, ch in enumerate(r):
                if ch != '.':
                    _fput(g, x + dx, y + dy, ch)


def _specks(g, pts):
    for x, y, ch in pts:
        _fput(g, x, y, ch)


def face_cv(line, rows, left, right):
    """rows 16×32 → 32×32 표본. left/right = 끝 마구리 열 [(열0 글자열 32), …] — '.' 는 그대로."""
    leg = LEG[line]
    assert len(rows) == 32 and all(len(r) == 16 for r in rows), [len(r) for r in rows]
    cv = Cv(32, 32)
    for y, r in enumerate(rows):
        for x in range(32):
            cv.put(x, y, leg[r[x % 16]])
    for i, col in enumerate(left):
        for y, ch in enumerate(col):
            if ch != '.':
                cv.put(i, y, leg[ch])
    for i, col in enumerate(right):
        for y, ch in enumerate(col):
            if ch != '.':
                cv.put(31 - i, y, leg[ch])
    return dot.Face(cv)


def _cap(lit_col, inner_col, low='0'):
    """둥근 끝: 바깥 열은 위 귀 한 줄·아래 귀 세 줄을 바닥으로, 안 열은 아래 귀 두 줄."""
    a = '.' + lit_col * 28 + low * 3
    b = '.' * 2 + (inner_col if inner_col != '.' else '.') * 28 + low * 2
    c = '.' * 30 + low + '.'
    return [a, b, c]


# ---- 줄 A: 사암(b 바탕 0.32 · d 그늘 · c/m 빛 턱) — 윗면(c·m 판, 평균 ≈0.37)보다 한 단 어둡다
A_FTOP = ['dkddkdddkddkdddk', 'mcgmcmmcmgcmcmmc', 'cbcbbcbbbcbbcbbb']
A_FBOT = ['bbdcmbbbbdbcmbbd', 'dcmbbddbcmcbdbcm', 'kdbd0kbdbdd0kbdd', '0000d0000k00000d']
A1_FACE_BASE = ['bbbbbbbbbbbbbbbb', 'bbbbbbbcbbbbbbbb', 'bbbcbbbbbbbbbcbb', 'bbbbbbbbbbbbbbbb',
                'bcbbbbbbbbcbbbbb', 'bbbbbbbbbbbbbbbb', 'bbbbbcbbbbbbbbbb']


A1_FACE_LOW = ['dddddddbdddddddd', 'ddbddddddddddbdd', 'dddddddddddddddd', 'dddddbdddddddddd', 'dddddddddddbdddd']


def face_a1():
    g = _fgrid(A1_FACE_BASE, A_FTOP, A_FBOT, A1_FACE_LOW, 15)
    _beds(g, [(7, '0001122333221100'), (14, '2221100.00112233'), (21, '0011.....0011222')], 'k', 'd', 'c')
    _joints(g, [('344', 3), ('bba', 16), ('dd', 23)], 'k', 'd', 'c')
    _specks(g, [(7, 5, 'd'), (12, 11, 'd'), (14, 6, 'g'), (0, 12, 'g'), (6, 13, 'g')])
    _lipline(g, 'A', '0011210001221100')
    rows = [''.join(r) for r in g]
    return face_cv('A', rows, _cap('c', '.'), _cap('d', '.'))


A_FST1 = ['.cm.', 'cmcb', 'bcbd', '.dd.', '..k.']
A_FST2 = ['..mc...', '.cmccb.', 'cmcccbd', 'bccbbbd', '.bbbdd.', '..ddk..']
A_FST3 = ['.mcc..', 'mcccb.', 'ccbbbd', '.bbdd.', '..kk..']
A_FST4 = ['cm', 'bd']


def face_a2():
    g = _fgrid(['dbdddbddddbddddb', 'ddddbdddbdddbddd', 'bdddddbdddddddbd', 'ddbdddddbddbdddd'],
               ['dkddkdddkddkdddk', 'gnmgcmngmcgnmcgm', 'cbgbbcbbgcbbcgbb'], A_FBOT)
    for y in range(15, 28):   # 아래 단은 바탕을 한 단 어둡게
        g[y] = ['k' if c == 'd' and (x * 3 + y) % 7 == 0 else 'd' if c == 'b' else c for x, c in enumerate(g[y])]
    _stones(g, [(A_FST2, 1, 4), (A_FST1, 9, 3), (A_FST4, 13, 8), (A_FST3, 6, 10), (A_FST1, 12, 12), (A_FST4, 2, 12),
                (A_FST2, 8, 16), (A_FST3, 0, 17), (A_FST1, 4, 22), (A_FST4, 13, 20), (A_FST3, 10, 22), (A_FST4, 6, 18),
                (A_FST4, 15, 25), (A_FST1, 0, 24)])
    _lipline(g, 'A', '1100012210001210')
    rows = [''.join(r) for r in g]
    return face_cv('A', rows, _cap('c', '.'), _cap('d', '.'))


# ---- 줄 B: 화강암(d 바탕 0.29 · e 그늘 · k 금 · b 빛 턱)
B_FTOP = ['ekeekeeekeekeeek', 'mbmmbmmbmmmbmbmm', 'bbbdbbbbbdbbbbdb']
B_FBOT = ['ddedbmbddedbmbdd', 'edbmbdeedbmbdedb', 'kede0kedeed0keed', '0000e0000k00000e']


def _cracks(g, paths, crease, shade, lit):
    """손으로 고른 꼭짓점을 잇는 금(가로 16 주기로 감음). 금 위·왼 = 그늘, 아래·오른 = 빛."""
    P = {((x % 16), y) for path in paths for x, y in CR.poly(*path)}
    for x, y in P:
        _fput(g, x, y, crease)
    for x, y in P:
        for dx, dy, ch in ((-1, 0, shade), (0, -1, shade), (1, 0, lit), (0, 1, lit)):
            if ((x + dx) % 16, y + dy) not in P:
                _fput(g, x + dx, y + dy, ch)


def face_b1():
    """모난 화강암 덩이: 위 단은 빛 받는 큰 덩이 면(d, 왼 위 b), 아래 단은 그늘(e). 덩이를 가르는 금은 몇 줄뿐이고 기울기가 다 다르다."""
    g = _fgrid(['dddddddddddddddd', 'ddddddddbddddddd', 'dddddddddddddddd', 'dbdddddddddddddd',
                'dddddddddddddddd'], B_FTOP, B_FBOT,
               ['eeeeeeeeeeeeeeee', 'eedeeeeeeeeeeeee', 'eeeeeeeeeeeeeeee', 'eeeeeeedeeeeeeee'], 15)
    for x, y0, y1 in ((9, 3, 11), (10, 4, 9), (2, 15, 21), (3, 16, 19)):   # 덩이 왼 위 면 빛
        for y in range(y0, y1):
            g[y][x] = 'b'
    _cracks(g, [((8, 3), (9, 8), (8, 13), (9, 15)), ((9, 15), (12, 16), (17, 16)), ((1, 14), (2, 20), (1, 27)),
                ((13, 20), (14, 27))], 'k', 'e', 'b')
    _specks(g, [(5, 6, 'b'), (13, 9, 'e'), (6, 22, 'k'), (11, 24, 'd')])
    _lipline(g, 'B', '0012221000011100')
    rows = [''.join(r) for r in g]
    return face_cv('B', rows, _cap('b', '.'), _cap('e', '.'))


B_FM1 = ['...bbbm...', '.bbmmbbbd.', 'bbmbbbbdde', 'bbbbbbddde', 'dbbbbdddde', 'ddddddddee', '.eedddeek.', '...kkkk...']
B_FM2 = ['..bmb..', '.bmbbd.', 'bbbbdde', 'dbbddde', '.eddee.', '..kkk..']
B_FM3 = ['.bmbb.', 'bbbbdd', 'ddddde', '.ekke.']


def face_b2():
    g = _fgrid(['eeeeeeeeeeeeeeee', 'eekeeeeeeeeekeee', 'eeeeeeeekeeeeeee'], B_FTOP, B_FBOT,
               ['eeekeeeeeeeeeeke', 'ekeeeeeekeeeeeee', 'eeeeeeekeeeekeee'], 16)
    _stones(g, [(B_FM1, 0, 3), (B_FM2, 9, 4), (B_FM3, 12, 10), (B_FM2, 5, 11), (B_FM1, 8, 15), (B_FM3, 1, 16),
                (B_FM2, 13, 19), (B_FM1, 2, 20), (B_FM3, 10, 23)])
    _lipline(g, 'B', '1221000111000122')
    rows = [''.join(r) for r in g]
    return face_cv('B', rows, _cap('b', '.'), _cap('e', '.'))


# ---- 줄 C: 현무암(b 바탕 0.26 · k 그늘 · d 쇠빛 · m 빛 턱)
C_FTOP = ['kxkkxkkkxkkxkkkx', 'mmbmmbmmmbmmbmmm', 'bdbbbbdbbbdbbbbd']
C_FBOT = ['bkbdmbbkbbdmbbkb', 'kbmbkkbdmbkbbdmb', 'kkbk0kbkkbk0kkbk', '0000k0000k00000k']


def face_c1():
    g = _fgrid(['bbbbbbbbbbbbbbbb', 'kkbbbbbkkkbbbbbk', 'bbbbbbbbbbbbbbbb', 'bbbbbdbbbbbbbbbb',
                'bbbkkkbbbbbbkkbb', 'bbbbbbbbbbbbbbbb'], C_FTOP, C_FBOT,
               ['kkkkkkbkkkkkkkkk', 'kkbkkkkkkkkkbkkk', 'kkkkkkkkkkkkkkkk', 'kkkkkkkkbkkkkkkk'], 16)
    _beds(g, [(7, '000000111100000.'), (12, '1111.00000001111'), (18, '000001111100.000'), (24, '11100000001111..')],
          'x', 'k', 'm')
    _joints(g, [('45', 8), ('cc', 19)], 'k', 'k', 'd')
    _lipline(g, 'C', '0001100122100010')
    rows = [''.join(r) for r in g]
    return face_cv('C', rows, _cap('d', '.'), _cap('k', '.'))


C2_FCOL = 'kmmbbbdkkmbbbbbd'   # 넓은 기둥 둘(7·9): 왼 면 빛 m → 몸 b → 오른 면 그늘 d·k, 틈은 k(먹 아님)


def face_c2():
    """주상 절리: 너비 다른 굵은 세로 기둥, 마디(가로 금)마다 기둥이 한 화소씩 어긋나 곧은 창살로 읽히지 않는다."""
    g = _fgrid([C2_FCOL], C_FTOP, C_FBOT)
    shift = {y: (0 if y < 11 else 1 if y < 19 else -1 if y < 24 else 0) for y in range(3, 28)}
    for y in range(3, 28):
        for x in range(16):
            g[y][x] = C2_FCOL[(x - shift[y]) % 16]
    for x0, x1, y in ((2, 5, 11), (10, 14, 19)):
        for x in range(x0, x1 + 1):
            g[y][x] = 'k'
            g[y + 1][x] = 'm' if x == x0 else 'b'
    _specks(g, [(x, y, 'd') for x, y in ((4, 6), (12, 13), (5, 15), (13, 21), (3, 22))])
    _lipline(g, 'C', '0110000122000110')
    rows = [''.join(r) for r in g]
    return face_cv('C', rows, _cap('d', '.'), _cap('k', '.'))


FACES = {('A', 1): face_a1, ('A', 2): face_a2, ('B', 1): face_b1, ('B', 2): face_b2, ('C', 1): face_c1, ('C', 2): face_c2}
_FCACHE = {}


def face(line, n):
    if (line, n) not in _FCACHE:
        _FCACHE[(line, n)] = FACES[(line, n)]()
    return _FCACHE[(line, n)]


# ================================================================================================장면
# 14×10: 방 셋(서쪽 큰 방 · 동북 방 · 동남 작은 방)을 굽은 통로가 잇고, 사이는 넓은 바위 덩어리. 바위 덩어리 남쪽 끝마다 앞면 2단.
VIGN_GRID = [
    '##############',
    '##############',
    '##############',
    '###...########',
    '##.....###...#',
    '##......##...#',
    '###.....##...#',
    '###...........',
    '####..####...#',
    '##############',
]
FIELD_GRID = ['#' * 20] * 15


def actor_cv():
    return dot.Cv.of(dot.actor1_frame(1, 0, 0))


def scene(line, n, at=None, fc=None):
    at = at or rock(line, n)
    cv = dot.render_cave(VIGN_GRID, at, fc or face(line, n), CR.part(line, n, 'floor'))
    cv.paste(actor_cv(), 5 * T - 4, 5 * T - 12)
    return cv


def cand(line, n):
    def fn():
        at = rock(line, n)
        before = CR.part(line, n, 'ceil')
        return CR.a2_plus(at), {
            'kind': 'autotile', 'autotiles': {'rock': at}, 'faces': {'face': face(line, n)},
            'vignette': scene(line, n), 'grid': VIGN_GRID, 'rim_check': True, 'note': NOTES[f'{line}{n}'],
            'extras': [(f'바위 몸통 20×15 (변형 {len(at.bodies) - 1} 섞음, 엔진 cellHash)', dot.mosaic(at, 20, 15), 2),
                       ('47 변형', CR.variants_sheet(at), 2),
                       (f'같은 장면, 이전 cave-r1 {line}{n} 천장(허공)', scene(line, n, before, CR.part(line, n, 'face')), 2)]}
    return fn


NOTES = {
    'A1': '사암 턱 — 모나고 납작한 사암 판(밝은 윗면, 위·왼 빛 입술, 남쪽 앞턱 그늘)이 크기를 달리해 겹겹이 얹힌 암반, 이끼 드문드문. 앞면 = 물결 층리 사암(아래로 갈수록 어두움)',
    'A2': '이끼 덮인 둥근 사암 덩이 무더기 — 아주 큰 덩이부터 조약돌까지 칸마다 크기가 다름. 앞면 = 둥근 돌이 박힌 역암 벽',
    'B1': '모난 화강암 덩이 — 평평한 윗면과 2~3줄 앞면을 가진 덩이가 크기를 달리해 쌓임. 앞면 = 비스듬한 금 몇 줄로 갈린 큰 화강암 덩이',
    'B2': '큰 회색 바윗덩이 — 하이라이트를 낮춘 큰 덩이·중간 덩이·납작한 덩이가 칸마다 다른 크기로. 앞면 = 둥글게 부푼 바위 면',
    'C1': '층 진 현무암 판 — 검푸른 암반을 깊은 금이 판으로 나누고, 판마다 가는 층 줄. 앞면 = 물결 층리(아래로 어두움)',
    'C2': '주상 절리 기둥 머리 — 모서리 깎은 육각 기둥 머리(아주 굵은 것~가는 것), 쇠빛 절리 틈. 앞면 = 마디마다 어긋나는 굵은 세로 기둥',
}

CANDIDATES = {'gap.rock_fill': {f'{ln}{n}': cand(ln, n) for ln in 'ABC' for n in (1, 2)}}
