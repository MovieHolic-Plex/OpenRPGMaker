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

줄마다 두 벌은 서로 다른 설계다: 1 = 금 간 암반 판(A 사암 판 + 이끼 낀 금 · B 화강암 판 + 모난 틈 · C 얇은 층이 겹친 화산암 턱),
2 = 바윗덩이가 빽빽한 돌무더기(A 이끼 덮인 둥근 사암 덩이 · B 큰 회색 바윗덩이 · C 주상 절리 기둥 머리).
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
#            g n y 이끼·덧칠 · ',' 바닥 몸통(on_base) · '0' 바닥 그늘 단
LEG = {
    # A 해안 흙굴 — 따뜻한 갈색 사암(rim) + 갈색 흙 어둠(cfloor 0·1) + 이끼(moss). 바닥 cfloor 2 보다 한 단 어둡다.
    'A': legend(k=('rim', 0), d=('cfloor', 0), b=('rim', 1), c=('cfloor', 1), m=('rim', 2), l=('rim', 3), h=('rim', 4),
                w=('rim', 5), g=('moss', 3), n=('moss', 4), y=('moss', 5), **{'0': ('cfloor', 0)}),
    # B 산속 바위굴 — 회색 화강암(crock 녹회 + stone 밝은 단). 바닥 cfloor 1(갈색) 과 색상이 갈린다.
    'B': legend(k=('stone', 0), d=('crock', 2), b=('crock', 3), c=('stone', 2), m=('crock', 4), l=('crock', 5),
                h=('stone', 4), w=('stone', 5), g=('moss', 2), n=('moss', 3), y=('moss', 4), **{'0': ('cfloor', 0)}),
    # C 검푸른 심층굴 — 검푸른 화산암(vrock) + 푸른 쇠빛(iron) 결. 바닥 cata 3(차가운 회색)보다 확실히 어둡되 허공(void)은 아니다.
    'C': legend(x=('vrock', 0), k=('vrock', 1), d=('iron', 1), b=('vrock', 2), c=('iron', 2), m=('vrock', 3), l=('iron', 3),
                h=('vrock', 4), w=('iron', 4), g=('pool', 2), n=('glow', 0), y=('iron', 5), **{'0': ('cata', 0)}),
}

# 테두리 층(바깥 → 안). 북·서 = 빛 쪽, 동 = 그늘 쪽, 남 = 앞면 위 앞턱(아래 줄이 가장 밝다).
LIT = {'A': 'hlm', 'B': 'hlm', 'C': 'khl'}      # C 는 바닥(cata 3)과 밝기가 비슷해 바깥 한 줄을 어둡게 두르고 그 안을 밝힌다
SHADE = {'A': 'kd', 'B': 'kd', 'C': 'kd'}
LIP = {'A': 'wld', 'B': 'wld', 'C': 'hmk'}   # 아래(앞면 닿는 줄)부터: 가장 밝은 앞턱 · 빛 · 위쪽 그늘 홈


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


def stampl(rows, items):
    for spr, x, y in items:
        rows = blit(rows, spr, x, y)
    return rows


# ================================================================================================ 줄 A — 해안 흙굴
# 바탕 얼룩: 갈색 사암(b) 위로 옅은 판(c·m) 얼룩과 어두운 점(d). 둘레까지 결이 차 있다.
A1_BASE = [
    'bbcbbbbbbcbbbbbd', 'bcmcbbbbbbbbcbbb', 'bbcbbbdbbbbbbbbb', 'bbbbbbbbbbcmcbbb',
    'dbbbbbbbbbbcbbbb', 'bbbbcbbbbbbbbbbb', 'bbbcmcbbbdbbbbcb', 'bbbbcbbbbbbbbbbb',
    'bbbbbbbbbbbbbbbb', 'bbdbbbbbbbbcbbbb', 'bbbbbbbcbbcmcbbd', 'bcbbbbcmcbbcbbbb',
    'bbbbbbbcbbbbbbbb', 'bbbbbbbbbbbbbbbb', 'bbbbdbbbbbbbbcbb', 'bbbbbbbbbbbbcmcb']
# A1 사암 판: 칸마다 다른 금 그물(손으로 고른 꼭짓점). 긴 금은 칸 끝까지 가로질러 나가고(이웃이 안 이으면 거기서 끝난 금),
# 금 양이 칸마다 다르다(긴 금 셋 · 갈래 금 · 짧은 금 · 거의 통판). 금 둘레 판은 옅은 면(PATCH), 금 따라 이끼 뭉치.
A1_NETS = [
    [[(0, 4), (4, 5), (7, 4), (10, 6), (15, 6)], [(7, 4), (6, 9), (8, 12), (8, 15)], [(10, 6), (13, 10)]],
    [[(3, 0), (4, 4), (2, 8), (3, 12), (0, 14)], [(4, 4), (9, 5), (12, 3)], [(9, 5), (11, 10), (15, 12)]],
    [[(0, 10), (5, 11), (9, 9), (13, 10)], [(9, 9), (10, 4), (8, 0)]],
    [[(15, 2), (11, 3), (8, 7)], [(2, 15), (4, 12), (8, 11)]],
    [[(5, 2), (6, 5)], [(9, 13), (12, 12), (13, 10)]],
]
A_PATCH = ['..ccc.', '.cmcmc', 'cmmcc.', '.ccc..']
A_PATCH2 = ['.cc..', 'cmmc.', '.cmcc', '..cc.']
A_TUFT = ['.n.', 'gng', '.g.']
A_TUFT2 = ['gn', '.g']
A1_DECO = [
    ((A_PATCH, 1, 0), (A_PATCH2, 10, 9), (A_TUFT, 5, 4), (A_TUFT2, 11, 6)),
    ((A_PATCH, 7, 7), (A_TUFT, 3, 3), (A_TUFT2, 10, 9)),
    ((A_PATCH2, 2, 2), (A_PATCH, 9, 12), (A_TUFT2, 8, 8), (A_TUFT, 4, 10)),
    ((A_PATCH, 3, 4), (A_PATCH2, 11, 10), (A_TUFT2, 9, 2)),
    ((A_PATCH, 6, 6), (A_PATCH2, 1, 11), (A_TUFT, 11, 11), (A_TUFT2, 4, 1)),
]
A1_PROF = {
    'N': [(2, 5), (2, 5), (1, 4), (1, 4), (1, 4), (2, 5), (3, 6), (2, 5), (2, 5), (3, 6), (4, 7), (4, 7), (3, 6), (2, 5), (1, 4), (2, 5)],
    'W': [(2, 5), (3, 6), (3, 6), (2, 5), (1, 4), (1, 4), (1, 4), (2, 5), (2, 5), (2, 5), (1, 4), (0, 3), (0, 3), (1, 4), (2, 5), (2, 5)],
    'E': [(2, 4), (1, 3), (1, 3), (2, 4), (3, 5), (4, 6), (3, 5), (2, 4), (2, 4), (2, 4), (1, 3), (1, 3), (2, 4), (3, 5), (3, 5), (2, 4)],
    'S': [(0, 3), (0, 3), (0, 4), (0, 4), (0, 3), (0, 2), (0, 3), (0, 3), (0, 3), (0, 4), (0, 5), (0, 4), (0, 3), (0, 3), (0, 2), (0, 3)],
}


def a1_bodies():
    out = []
    for i, (net, deco) in enumerate(zip(A1_NETS, A1_DECO)):
        rows = stampl(turn(A1_BASE, i % 4), [d for d in deco if d[0] in (A_PATCH, A_PATCH2)])
        rows = cut(rows, net, dark='k', shade='d', lit='m')
        rows = stampl(rows, [d for d in deco if d[0] in (A_TUFT, A_TUFT2)])
        out.append(rows)
    return out


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
# 덩이 자리: 변형마다 다른 덩이는 1~14열 안에만(가로로 칸 끝을 넘지 않음 — 변형끼리 만나는 세로 변에서 덩이가 잘리지 않게),
# 세로로는 감아 넘어도 된다. 모든 변형이 같이 갖는 「이음 조약돌」(PORTS) 둘만 가로 칸 끝을 넘는다 — 칸 끝 틈이 곧은 세로 띠로
# 이어지지 않게 끊어 준다(모든 변형에 같은 자리라 어느 변형끼리 붙어도 잘리지 않는다). 마지막 = 본몸통.
A2_PORTS = ((A2_PEB, 14, 3), (A2_PEB, 14, 11))
A2_LAYOUT = [
    ((A2_BIG, 1, 0), (A2_MED, 7, 6), (A2_SML, 10, 0), (A2_LONG, 1, 10), (A2_SML, 10, 12)),
    ((A2_LONG, 4, 0), (A2_MED, 1, 4), (A2_BIG, 4, 7), (A2_PEB, 11, 2)),
    ((A2_MED, 1, 1), (A2_SML, 10, 1), (A2_LONG, 5, 6), (A2_MED, 1, 10), (A2_SML, 9, 11)),
    ((A2_SML, 1, 0), (A2_BIG, 4, 1), (A2_MED, 1, 8), (A2_LONG, 5, 10), (A2_PEB, 11, 14)),
    ((A2_MED, 1, 1), (A2_SML, 9, 0), (A2_SML, 10, 6), (A2_MED, 4, 8), (A2_PEB, 1, 11), (A2_SML, 10, 12)),
]
A2_PROF = {
    'N': [(2, 5), (1, 4), (1, 4), (2, 5), (3, 6), (3, 6), (2, 5), (2, 5), (2, 5), (1, 4), (1, 4), (2, 5), (3, 6), (4, 7), (3, 6), (2, 5)],
    'W': [(2, 5), (2, 5), (1, 4), (1, 4), (2, 5), (3, 6), (3, 6), (2, 5), (2, 5), (1, 4), (2, 5), (3, 6), (4, 7), (3, 6), (2, 5), (2, 5)],
    'E': [(2, 4), (3, 5), (4, 6), (3, 5), (2, 4), (1, 3), (1, 3), (2, 4), (2, 4), (1, 3), (2, 4), (3, 5), (3, 5), (2, 4), (1, 3), (2, 4)],
    'S': [(0, 3), (0, 4), (0, 4), (0, 3), (0, 3), (0, 2), (0, 3), (0, 3), (0, 3), (0, 3), (0, 4), (0, 4), (0, 3), (0, 2), (0, 2), (0, 3)],
}


def a2_bodies():
    return [pile(A2_GRIT, A2_PORTS + lay) for lay in A2_LAYOUT]   # 틈 바탕은 한 장(돌리지 않음) — 칸 끝 틈이 그대로 이어진다


# ================================================================================================ 줄 B — 산속 바위굴
# 화강암 바탕: 녹회 바탕(b) 에 검은 알갱이(k)·흰 알갱이(w) 점 — 화강암 결. 모난 틈은 B1 만.
B1_BASE = [
    'bbbbcbbbbkbbbmbb', 'bmbbbbbbdbbbbbbb', 'bbbbblbbbbbbbbcb', 'bbbcbbbmbbbkbbbb',
    'dbbbbbbbbbbbdbbl', 'bbkbbbbbcbbbbbbb', 'bbmbbbbbbbbbbbmb', 'bbbbbdbbbblcbbbb',
    'bbbbbbbbbbbbbbbb', 'bcbbbbkbmbbbbbbd', 'bbbbbbbbbbbbbkbb', 'bblbbmbbbbdbbcbb',
    'bbdbbbbbbbbbbbbb', 'bbbbbbbbbcbblbbb', 'bmbbbkbbbbbbbmbb', 'bbbbbcbbdbbbbbbb']
# B1 화강암 판: 곧고 모난 틈(꺾임이 각지다, 칸을 가로지르는 긴 틈 + 짧은 갈래) + 틈 아래·오른 빛 턱(m), 지의류 뭉치(g n).
B1_NETS = [
    [[(0, 9), (5, 9), (8, 6), (15, 9)], [(8, 6), (8, 0)]],
    [[(3, 15), (3, 11), (9, 11), (12, 15)], [(9, 11), (11, 5), (15, 3)]],
    [[(0, 3), (6, 3), (6, 8)], [(11, 15), (12, 12), (15, 12)]],
    [[(5, 0), (7, 4), (13, 4)], [(1, 15), (2, 10), (7, 9)]],
    [[(15, 10), (10, 10), (8, 14)]],
]
B_LICHEN = ['.n', 'gn']
B_LICHEN2 = ['gn.', '.ng']
B1_DECO = [((B_LICHEN, 2, 2), (B_LICHEN2, 11, 12)), ((B_LICHEN2, 5, 6),), ((B_LICHEN, 10, 7), (B_LICHEN, 2, 12)),
           ((B_LICHEN2, 10, 9),), ((B_LICHEN, 4, 4), (B_LICHEN2, 11, 1))]
B1_PROF = {
    'N': [(2, 5), (2, 5), (2, 5), (1, 4), (1, 4), (1, 4), (2, 5), (2, 5), (2, 5), (3, 6), (3, 6), (4, 7), (4, 6), (3, 5), (2, 5), (2, 5)],
    'W': [(2, 5), (2, 5), (3, 6), (4, 7), (4, 6), (3, 5), (2, 5), (2, 5), (2, 5), (1, 4), (1, 4), (1, 4), (2, 5), (2, 5), (2, 5), (2, 5)],
    'E': [(2, 4), (2, 4), (1, 3), (1, 3), (1, 3), (2, 4), (3, 5), (2, 4), (2, 4), (3, 5), (4, 6), (4, 6), (3, 5), (2, 4), (2, 4), (2, 4)],
    'S': [(0, 3), (0, 3), (0, 3), (0, 4), (0, 5), (0, 4), (0, 3), (0, 3), (0, 3), (0, 2), (0, 2), (0, 3), (0, 4), (0, 4), (0, 3), (0, 3)],
}


def b1_bodies():
    out = []
    for i, (net, deco) in enumerate(zip(B1_NETS, B1_DECO)):
        rows = cut(turn(B1_BASE, i % 4), net, dark='k', shade='d', lit='m')
        out.append(stampl(rows, deco))
    return out


# B2 큰 회색 바윗덩이: 넓고 밝은 윗면(w h l)이 위로 둥글고 아래로 그늘(b d)·밑 틈(k)이 지는 큰 덩이가 빽빽이 쌓였다.
# A2 보다 덩이가 크고 수가 적으며 모가 살짝 진다(윗면 평평한 덩이·모난 조각 섞임). 이끼 없음.
B2_GRIT = [
    'dddkdddcdddddkdd', 'dcddddddddkddddd', 'ddddkdddcdddddcd', 'kddddddddddddddd',
    'ddcddddkdddcdddd', 'dddddcdddddddkdd', 'ddddddddddkddddd', 'dkddcdddddddddcd',
    'ddddddddcddddddd', 'dddddkdddddkdddd', 'cddddddddddddddc', 'dddcddddkddddddd',
    'ddddddkdddddcddd', 'dkdddddddcdddddk', 'ddddcdddddddddkd', 'ddddddddkddddddd']
B2_BIG = ['....whh.....', '..wwhhhll...', '.whhhllllm..', 'whhlllllmmb.', 'hhllllmmmbbd', 'hllmmmmmbbbd',
          '.lmmmmbbbbd.', '..mbbbbbddk.', '...kbbbddk..', '.....kkk....']
B2_MED = ['...whh...', '.wwhhll..', 'whhlllmb.', 'hhllmmmbd', 'hllmmmbbd', '.lmmbbbd.', '..kbbddk.', '....kk...']
B2_FLAT = ['.whhhlm..', 'whhllmmb.', 'hllmmbbbd', '.mmbbbddk', '...kkkk..']
B2_SHARD = ['..wh..', '.whlm.', 'whlmmb', 'lmbbdk', '..kk..']
B2_CHIP = ['.hl.', 'hlmb', '.kk.']
B2_PORTS = ((B2_CHIP, 14, 6), (B2_CHIP, 14, 13))
B2_LAYOUT = [
    ((B2_BIG, 1, 0), (B2_FLAT, 6, 10), (B2_SHARD, 9, 2), (B2_SHARD, 1, 11)),
    ((B2_MED, 6, 0), (B2_FLAT, 1, 3), (B2_MED, 4, 8), (B2_CHIP, 11, 9), (B2_SHARD, 9, 13)),
    ((B2_SHARD, 1, 0), (B2_BIG, 3, 4), (B2_SHARD, 1, 9), (B2_CHIP, 9, 1), (B2_FLAT, 6, 13)),
    ((B2_FLAT, 4, 0), (B2_MED, 1, 4), (B2_SHARD, 9, 6), (B2_FLAT, 6, 11), (B2_CHIP, 11, 2)),
    ((B2_MED, 1, 0), (B2_MED, 6, 4), (B2_SHARD, 1, 9), (B2_SHARD, 9, 12), (B2_CHIP, 11, 0)),
]
B2_PROF = {
    'N': [(2, 5), (3, 6), (3, 6), (2, 5), (1, 4), (1, 4), (2, 5), (2, 5), (2, 5), (2, 5), (1, 4), (1, 4), (2, 5), (3, 6), (3, 6), (2, 5)],
    'W': [(2, 5), (1, 4), (1, 4), (2, 5), (3, 6), (4, 7), (3, 6), (2, 5), (2, 5), (2, 5), (2, 5), (1, 4), (1, 4), (2, 5), (3, 6), (2, 5)],
    'E': [(2, 4), (2, 4), (3, 5), (3, 5), (2, 4), (1, 3), (2, 4), (2, 4), (2, 4), (1, 3), (1, 3), (2, 4), (3, 5), (4, 6), (3, 5), (2, 4)],
    'S': [(0, 3), (0, 2), (0, 3), (0, 4), (0, 4), (0, 3), (0, 3), (0, 3), (0, 3), (0, 4), (0, 3), (0, 2), (0, 3), (0, 4), (0, 4), (0, 3)],
}


def b2_bodies():
    return [pile(B2_GRIT, B2_PORTS + lay) for lay in B2_LAYOUT]


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
C2_HI = ['..hhhh..', '.hccccl.', 'hcccccbl', 'lcccbbbm', '.lbbbbm.', '.dddddd.', '.dkdddk.', '..kkkk..']   # 높은 기둥(밝은 윗면, 옆면 3줄)
C2_LO = ['..lmmm..', '.lbbbbm.', 'lbbbbbbd', 'mbbbbbdd', '.mbbbdd.', '.kkkkkk.', '..xxxx..']             # 낮은 기둥(어두운 윗면, 옆면 1줄)
C2_SM = ['.hhl.', 'hcccl', 'lcbbm', '.ddd.', '.kkk.']
C2_WD = ['..hhhhl..', '.hccccbl.', 'hccccbbbm', 'lcccbbbbm', '.lbbbbbm.', '.ddddddd.', '.dkddddk.', '..kkkkk..']
C2_PORTS = ((C2_SM, 13, 2), (C2_SM, 13, 10))
C2_LAYOUT = [
    ((C2_HI, 1, 0), (C2_LO, 7, 1), (C2_WD, 3, 8), (C2_SM, 1, 11)),
    ((C2_WD, 6, 0), (C2_HI, 1, 3), (C2_LO, 5, 9), (C2_SM, 10, 9)),
    ((C2_LO, 1, 0), (C2_SM, 9, 0), (C2_HI, 7, 5), (C2_SM, 1, 8), (C2_WD, 1, 11)),
    ((C2_SM, 1, 0), (C2_HI, 5, 0), (C2_LO, 1, 6), (C2_WD, 6, 8), (C2_SM, 10, 4)),
    ((C2_HI, 1, 1), (C2_SM, 10, 0), (C2_LO, 7, 6), (C2_HI, 2, 9), (C2_SM, 10, 12)),
]
C2_PROF = {
    'N': [(2, 5), (1, 4), (1, 4), (2, 5), (2, 5), (3, 6), (3, 6), (2, 5), (2, 5), (2, 5), (1, 4), (1, 4), (2, 5), (3, 6), (2, 5), (2, 5)],
    'W': [(2, 5), (2, 5), (3, 6), (4, 7), (3, 6), (2, 5), (1, 4), (2, 5), (2, 5), (1, 4), (1, 4), (2, 5), (2, 5), (3, 6), (3, 6), (2, 5)],
    'E': [(2, 4), (3, 5), (3, 5), (2, 4), (1, 3), (1, 3), (2, 4), (2, 4), (2, 4), (3, 5), (4, 6), (3, 5), (2, 4), (2, 4), (1, 3), (2, 4)],
    'S': [(0, 3), (0, 4), (0, 4), (0, 3), (0, 3), (0, 2), (0, 2), (0, 3), (0, 3), (0, 3), (0, 4), (0, 5), (0, 4), (0, 3), (0, 3), (0, 3)],
}


def c2_bodies():
    return [pile(C2_GAP, C2_PORTS + lay) for lay in C2_LAYOUT]


BUILD = {('A', 1): (A1_PROF, a1_bodies), ('A', 2): (A2_PROF, a2_bodies),
         ('B', 1): (B1_PROF, b1_bodies), ('B', 2): (B2_PROF, b2_bodies),
         ('C', 1): (C1_PROF, c1_bodies), ('C', 2): (C2_PROF, c2_bodies)}
_CACHE = {}


def rock(line, n):
    if (line, n) not in _CACHE:
        prof, mk = BUILD[(line, n)]
        _CACHE[(line, n)] = make_at(line, n, prof, quiet_first(mk()))
    return _CACHE[(line, n)]


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


def scene(line, n, at=None):
    at = at or rock(line, n)
    cv = dot.render_cave(VIGN_GRID, at, CR.part(line, n, 'face'), CR.part(line, n, 'floor'))
    cv.paste(actor_cv(), 5 * T - 4, 5 * T - 12)
    return cv


def cand(line, n):
    def fn():
        at = rock(line, n)
        before = CR.part(line, n, 'ceil')
        return CR.a2_plus(at), {
            'kind': 'autotile', 'autotiles': {'rock': at}, 'faces': {'face': CR.part(line, n, 'face')},
            'vignette': scene(line, n), 'grid': VIGN_GRID, 'rim_check': True, 'note': NOTES[f'{line}{n}'],
            'extras': [(f'바위 몸통 20×15 (변형 {len(at.bodies) - 1} 섞음, 엔진 cellHash)', dot.mosaic(at, 20, 15), 2),
                       ('47 변형', CR.variants_sheet(at), 2),
                       (f'같은 장면, 이전 cave-r1 {line}{n} 천장(허공)', scene(line, n, before), 2)]}
    return fn


NOTES = {
    'A1': '사암 판 — 갈색 사암 윗면을 구불거리는 금이 판으로 나누고, 금 속에 이끼. 북·서 밝은 테두리, 동 그늘, 남 앞턱',
    'A2': '이끼 덮인 둥근 사암 덩이 무더기 — 어두운 흙·자갈 틈에 크기가 다른 둥근 덩이, 머리마다 이끼',
    'B1': '화강암 판 — 회색 암반을 곧고 모난 틈이 가르고, 틈 아래 빛 받는 턱, 지의류 점',
    'B2': '큰 회색 바윗덩이 — 칸마다 넓은 윗면이 밝은 큰 덩이 하나와 납작한 덩이·조각',
    'C1': '층 진 현무암 판 — 검푸른 암반을 깊은 금(x)이 판으로 나누고, 판마다 방향·간격이 다른 가는 층 줄(k + 위 옅은 빛 c)',
    'C2': '주상 절리 기둥 머리 — 높이가 다른 현무암 기둥(밝은 윗면 + 옆면 1~3줄)이 쇠빛 절리 틈에 빽빽이 박힘',
}

CANDIDATES = {'gap.rock_fill': {f'{ln}{n}': cand(ln, n) for ln in 'ABC' for n in (1, 2)}}
