"""gap-rock-r1 — 방 사이 바위 채움(gap.rock_fill). 줄 A·B·C × 후보 2 (A1 A2 B1 B2 C1 C2).

문제: 조수 던전은 방 사이를 납작한 검은 허공으로 메운다(화면의 45~60%가 허공 → 「텅 비었다」).
답: 걸을 수 없는 덩어리를 **결 있는 바위 윗면**(단단한 암반을 위에서 내려다본 면)으로 채우는 오토타일.
  - 동굴 문법(dot.render_cave)의 「천장」 자리에 그대로 들어간다: 바닥과 남쪽으로 닿은 바위 2칸 = 앞면(lo/hi), 나머지 바위 = 이 윗면.
  - 북·서 변 = 빛 받는 테두리(밝은 단), 동 변 = 그늘 테두리 + 바닥에 지는 그림자, 남 변 = 앞면 위로 빛나는 앞턱.
  - 옆선 표: 바닥이 0~6px 파고드는 홈이 칸 안에서 부드럽게 크게 출렁이고(불룩 나옴·깊게 물림), 변마다·설계마다 표가 다르다.
    틀 규칙상 띠 이음점(0·7·8·15번)은 한 값(홈 2)이라 바깥 북서 귀는 반지름 5 의 둥근 귀. 변 띠 변형을 cellHash 로 고르는 것은
    dot.Autotile 이 몸통에만 변형을 두므로 이 모듈로는 못 한다(변마다 표 하나).
  - 몸통 = 손으로 그린 큰 얼룩 틀(3~5px) + 손으로 고른 자리의 덩이(3~9px, 위·왼 빛·아래 그늘, 변형마다 2~8개) + 변형 8개.
    큰 꼴(금·턱·덩이·층 줄)은 몇 변형에만, 칸 안에서 시작해 칸 안에서 끝난다.
  - 홈의 바닥색은 같은 줄·같은 번호 흙바닥 몸통 화소(cave_r1.on_base). 동 변(그늘 쪽)은 홈 0~1 을 그늘(0)로 채워 동쪽 바닥의
    서쪽 그늘 줄과 한 줄 그림자가 되고, A·B 동 테두리는 윗면 재질 단 그대로(어두운 세로 획이 생기지 않게).

줄마다 두 벌은 다른 설계다: 1 = 턱 진 암반(드문 금·턱 / C1 층 줄), 2 = 돌무더기(드문 덩이·조약돌 / C2 기둥 머리 덩이). 옆선 표도 다르다.
앞면(남쪽 2단)은 후보마다 새로 그린 dot.Face — 윗면 재질이 꺾여 내려간 더 어두운 세로 벽, 윗면 턱이 열마다 0~2px 늘어져
두 면 경계가 자로 그은 줄이 되지 않고, 바닥 닿는 곳은 부스러기 + 접지 그림자. 끝 마구리는 따로 칠하지 않아(바닥 귀 2px 만 둥글게)
대각 계단 벽의 한 칸짜리 앞면들이 하나의 벼랑으로 이어진다. 줄 C 앞면은 둘 다 층벽.
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
                w=('rim', 5), g=('moss', 3), n=('moss', 4), y=('moss', 5), e=('rim', 0), q=('moss', 2),
                **{'0': ('cfloor', 0)}),
    # B 산속 바위굴 — 무채색 회색 화강암(crock 3~5 · stone 1·2 — 녹회 단은 쓰지 않는다). 바닥 cfloor 1(갈색) 과 색상이 갈린다.
    # 어두운 금·그늘 단(k e · d p)은 차가운 푸른 회색(vrock 1 · iron 1)으로 — 무채색 검정 윤곽으로 읽히지 않게(object-gate 화풍 반려, r8)
    'B': legend(k=('vrock', 1), d=('iron', 1), b=('crock', 3), c=('stone', 2), m=('crock', 4), l=('crock', 5),
                h=('stone', 4), w=('stone', 5), g=('moss', 2), n=('moss', 3), y=('moss', 4), e=('vrock', 1), p=('iron', 1), v=('stone', 3),
                **{'0': ('cfloor', 0)}),
    # C 검푸른 심층굴 — 검푸른 화산암(vrock) + 푸른 쇠빛(iron) 결. 바닥 cata 3(차가운 회색)보다 확실히 어둡되 허공(void)은 아니다.
    'C': legend(x=('vrock', 0), k=('vrock', 1), d=('iron', 1), b=('vrock', 2), c=('iron', 2), m=('vrock', 3), l=('iron', 3),
                h=('vrock', 4), w=('iron', 4), g=('pool', 2), n=('glow', 0), y=('iron', 5), e=('vrock', 1),
                **{'0': ('cata', 0)}),
}

# 테두리 층(바깥 → 안). 북·서 = 빛 쪽, 동 = 그늘 쪽, 남 = 앞면 위 앞턱(아래 줄이 가장 밝다).
LIT = {'A': 'hlm', 'B': 'hlm', 'C': 'mcb'}      # C: 먹 테두리·안쪽 밝은 띠 없이 재질 중간 단으로 — 스티커처럼 떠 보이지 않게
SHADE = {'A': 'dq', 'B': 'pc', 'C': 'kd'}   # 동 테두리 = 윗면의 어두운 단 → 중간 단(먹 아님)
LIP = {'A': 'hld', 'B': 'hmd', 'C': 'mcb'}   # 아래(앞면 닿는 줄)부터: 가장 밝은 앞턱 · 빛 · 위쪽 그늘 홈


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
# 변 띠 이음점(0·7·8·15번)은 틀 규칙상 변마다 한 값(북·서 홈 2, 동 홈 1)이다. 바깥 북서 귀는 사분면을 거의 다 쓰는 반지름 5 의 둥근 귀.
NW = [',,,,,,,,', ',,,,,,,,', ',,,,,HHH', ',,,,HLLL', ',,,HLMMM', ',,HLM...', ',,HLM...', ',,HLM...']
NE = [',,,,,,,0', ',,,,HHE0', 'HHHHLLE0', 'LLLLMDE0', 'MMMMMDE0', '.....DE0', '.....DE0', '.....DE0']   # 동북 귀 오른쪽 끝은 칸 위 1줄까지 — 동쪽 바닥 칸의 서쪽 그늘(칸 맨 위부터)이 바위 없이 홀로 서지 않게
SW = [',,HLM...', ',,HLM...', ',,HLM...', ',HLM....', ',HLM....', 'HLMRRRRR', 'HLQQQQQQ', 'PPPPPPPP']
SE = ['.....DE0', '.....DE0', '.....DE0', '.....DE0', '.....DE0', 'RRRRRDE0', 'QQQQQQDE', 'PPPPPPQD']
# 안 모서리(대각만 끊김). 북 쪽 둘은 바닥이 둥글게 파고든 오목한 귀(그늘 획 대신 윗면 입술 단으로 꺾임), 남 쪽 둘은 앞면 윗단 위로 앞턱이 꺾여 들어오는 귀.
IN_NW = [',,HLM...', ',HHLM...', 'HHLLM...', 'LLLMM...', 'MMMM....', '........', '........', '........']
IN_NE = ['.....DE0', '.....HH0', '....HHHH', '....LLLL', '....MMMM', '........', '........', '........']
IN_SW = ['........', '........', '........', '........', '........', 'RRRR....', 'QQQQR...', 'PPPQR...']
IN_SE = ['........', '........', '........', '........', '........', '....RRRR', '...RQQQQ', '...RQPPP']


def _sym(rows, line):
    lit, sh, lip = LIT[line], SHADE[line], LIP[line]
    tr = {'H': lit[0], 'L': lit[1], 'M': lit[2], 'E': sh[0], 'D': sh[1], 'P': lip[0], 'Q': lip[1], 'R': lip[2]}
    return [''.join(tr.get(c, c) for c in r) for r in rows]


def _east_notch(rows):
    """동 변 띠: 홈은 바닥 그늘('0')."""
    return rows


# A: 가장 밝은 테두리 단(h)이 칸마다 끊김 없이 돌면 대각 계단의 한 칸 단마다 밝은 테두리가 감겨 상자를 쌓은 것처럼 보인다.
# 귀(바깥·안)와 변 띠의 칸 끝(이음점 0·7·8·15번)과 몇 자리에서 h 를 한 단 낮춰(l) 테두리가 띄엄띄엄 끊긴 바위 끝으로 읽히게 한다.
LIP_FADE = {'A': {'from': 'h', 'to': 'l', 'N': (0, 1, 3, 6, 7, 8, 9, 11, 12, 14, 15), 'W': (0, 1, 4, 5, 7, 8, 12, 14, 15),
                  'S': (0, 1, 2, 5, 6, 7, 8, 9, 13, 14, 15)}}


def _fade(fr, inner, f):
    g = [list(r) for r in fr]
    a, b = f['from'], f['to']
    def sub(x, y):
        if g[y][x] == a:
            g[y][x] = b
    for y in range(32):
        for x in range(32):
            if (x < 8 or x >= 24) and (y < 8 or y >= 24):
                sub(x, y)
    for i in f['N']:
        for y in range(8):
            sub(8 + i, y)
    for i in f['W']:
        for x in range(8):
            sub(x, 8 + i)
    for i in f['S']:
        for y in range(24, 32):
            sub(8 + i, y)
    inn = [r.replace(a, b) for r in inner]
    return [''.join(r) for r in g], inn


# 동 변(바닥 쪽 그늘 옆) 바깥 열: 곧은 어둠 한 줄이 칸마다 세로로 서서 남쪽 턱에서 뚝 끊기지 않게, 행마다 어둠 깊이(0~2)를
# 바꾸고 그 안쪽 첫 화소를 밝은 테두리 R 로 둔다. 남쪽 귀 마지막 3줄은 어둠을 그늘 단으로 풀어 턱에서 끊기지 않고 사라지게.
EAST_RIM = {'A': 'm', 'B': 'b', 'C': 'b'}
EAST_DD = [1, 1, 2, 1, 0, 0, 1, 2, 1, 1, 0, 1, 2, 2, 1, 0]   # 행 8~23(띠) 어둠 깊이 — 손으로 고른 고르지 않은 출렁임
EAST_DD_CORNER = {5: 1, 6: 0, 7: 1, 24: 1, 25: 0, 26: 1}     # 북동·남동 귀 안 행


def _soft_east(fr, line):
    g = [list(r) for r in fr]
    rim, sh = EAST_RIM[line], SHADE[line]
    rows = {8 + i: d for i, d in enumerate(EAST_DD)}
    rows.update(EAST_DD_CORNER)
    for y, d in rows.items():
        for i in range(3):
            g[y][31 - i] = '0' if i < d else (rim if i == d else g[y][31 - i])
        if d == 0 and g[y][30] in '0':
            g[y][30] = sh[0]
    for y, ch in ((27, sh[0]), (28, sh[0]), (29, sh[1])):   # 남동 귀: 어둠이 턱 위 3줄에서 그늘로 풀린다
        g[y][31] = ch
        if g[y][30] == '0':
            g[y][30] = sh[0]
    return [''.join(r) for r in g]


def rock_frame(line, prof, soft=False):
    """prof = {'N','W','E','S'}: 옆선 표 16칸씩 (홈 깊이, 테두리 끝). 반환 (틀 32×32 기호, 안 모서리 16×16 기호)."""
    lit, sh, lip = LIT[line], SHADE[line], LIP[line]
    n = CR.strips(prof['N'], _layer(lit), ',')
    w = CR.strips(prof['W'], _layer(lit), ',')
    # 동 변(그늘 쪽): 동쪽 바닥 칸의 서쪽 그늘(곧은 1px, cave-r1 바닥 몫)과 떨어지지 않게 홈은 0~1 만 두고 그늘(0)로 채운다.
    # 대신 테두리 두께(1~3)를 크게 출렁여 어두운 바위 끝(윗면 어두운 단)이 혹·물림으로 보이게 한다.
    e = CR.strips(prof['E'], _layer(sh), '0')
    s = CR.strips(prof['S'], _lip(lip), ',')
    fr = CR.frame(_sym(NW, line), _sym(NE, line), _sym(SW, line), _sym(SE, line), n, s, w, e)
    inner = [a + b for a, b in zip(_sym(IN_NW, line), _sym(IN_NE, line))] + \
            [a + b for a, b in zip(_sym(IN_SW, line), _sym(IN_SE, line))]
    if line in LIP_FADE:
        fr, inner = _fade(fr, inner, LIP_FADE[line])
    CR.check_frame(f'{line} 바위 채움', fr, inner, strict_inner=False)
    if soft:
        fr = _soft_east(fr, line)
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


def quiet_first(bodies):
    """마지막에 적은 가장 조용한 몸통(금·덩이가 고른 것)을 본몸통으로 — 가장자리 47 변형은 모두 본몸통을 쓰므로
    벽을 따라 길게 이어질 때 눈에 띄는 무늬가 칸마다 되풀이되지 않게 한다."""
    return [bodies[-1]] + bodies[:-1]


def make_at(line, n, prof, bodies):
    """bodies = 16×16 행 문자열 목록(첫째가 본몸통). 바닥 = 같은 줄·같은 번호 cave-r1 흙바닥."""
    leg = LEG[line]
    floor = CR.part(line, n, 'floor')
    fr, inner = rock_frame(line, prof, soft=(line, n) not in (('B', 2), ('C', 2)))
    frc, innc = CR.on_base(floor.body, fr, inner, leg)
    cvs = [dot.grid(b, leg, 16, 16) for b in bodies]
    return CR.autotile_cv(cvs[0], frc, innc, cvs[1:])


def stampl(rows, items):
    for spr, x, y in items:
        rows = blit(rows, spr, x, y)
    return rows


# ================================================================================================ 옆선(윤곽)
# 홈 깊이 n(바닥이 바위로 파고드는 깊이)을 칸 안에서 0~6 까지 크게, 이웃 화소끼리는 1씩 부드럽게 출렁이게 — 바위가 바닥으로 불룩 나오고(0) 깊게 물리는(5~6)
# 굴곡이 칸마다 있어 방 둘레가 16px 계단으로 읽히지 않는다. 변마다 다른 표, 설계 1·2 도 다른 표.
# (변 띠 변형을 cellHash 로 고르는 것은 dot.Autotile 이 몸통(마스크 255)에만 변형을 두므로 이 모듈만으로는 못 한다.)
def _prof(ns, rim):
    return [(n, min(8, n + rim)) for n in ns]


S_PROF = [(0, 3), (0, 4), (0, 4), (0, 3), (0, 3), (0, 2), (0, 2), (0, 3), (0, 3), (0, 3), (0, 4), (0, 5), (0, 4), (0, 3), (0, 3), (0, 3)]
PROF1 = {'N': _prof([2, 1, 0, 0, 1, 1, 1, 2, 2, 3, 4, 5, 5, 4, 3, 2], 3),
         'W': _prof([2, 3, 4, 5, 6, 5, 3, 2, 2, 2, 1, 0, 0, 1, 1, 2], 3),
         'E': [(1, 3), (1, 4), (0, 4), (0, 2), (0, 1), (0, 2), (1, 4), (1, 3), (1, 3), (0, 1), (0, 1), (1, 3), (1, 5), (0, 4), (0, 2), (1, 3)], 'S': S_PROF}
PROF2 = {'N': _prof([2, 3, 4, 5, 4, 3, 2, 2, 2, 1, 0, 0, 1, 3, 3, 2], 3),
         'W': _prof([2, 1, 0, 0, 1, 2, 2, 2, 2, 3, 5, 6, 5, 4, 3, 2], 3),
         'E': [(1, 3), (0, 1), (0, 2), (1, 4), (1, 5), (0, 4), (0, 2), (1, 3), (1, 3), (1, 4), (0, 3), (0, 1), (0, 1), (1, 3), (1, 4), (1, 3)], 'S': S_PROF}


# ================================================================================================ 윗면
# 바탕 = 줄마다 손으로 찍은 잔 얼룩 암반(버들항 밀도, 4~5 단, 2~3화소 뭉치) — 조용해서 16px 되풀이가 드러나지 않는다.
# 변형 8개(마지막 = 본몸통): 바탕을 뒤집어 돌려 쓰고, 큰 꼴(턱·금·바윗덩이·기둥 머리)은 몇 변형에만 드물게 둔다.
# 금이 칸 끝을 건널 때는 정해진 자리(가로 변 y=4·11, 세로 변 x=5·12)에서만 — 이웃이 이으면 길게 이어지고, 안 이으면 거기서 끝난 금.
# 바탕 = 손으로 그린 큰 얼룩 틀(. 바탕 X · # 3~5px 얼룩 Y · + 드문 점 Z) 위에 손으로 고른 자리의 덩이(3~9px, 위·왼 빛 H ·
# 몸 B · 아래·오른 그늘 S)를 감아 찍는다. 덩이 수(2~8개)와 크기를 변형마다 달리해 고른 잡음(카펫·TV 지직임) 대신
# 크고 작은 바위 덩어리가 드문드문 모인 면으로 읽힌다.
BLOTCH = [
    '....##.....+#...', '...###.....###..', '.+..#.......##..', '.........#....+.',
    '#.......###....#', '##..+....#.....#', '#..........+....', '.....##.........',
    '..+.####....##..', '.....##....###..', '...........##.+.', '.##.....+.......',
    '.###.......#....', '..#.......###...', '.......+..##....', '....#...........']
# 줄마다 (X, Y, Z, H, B, S). A: 사암 b 바탕에 차가운 회녹 q 큰 얼룩 — 바닥(따뜻한 0.47 잔 점)과 결 크기·색온도가 다르다.
TONES = {'A': 'bqdmcd', 'B': 'bdmlmdkh', 'C': 'bkmhmkxw'}   # (X Y Z H B S [D 가장 깊은 그늘 · W 가장 밝은 점]) — B·C 덩이는 5단
CLUMPS = {   # 크기 0 작은 → 3 큰. 방향 없는 덩이(층 줄은 앞면에만)
    'ABC': (['HB', 'BS'], ['.WB.', 'HBBS', '.BS.'], ['.WHB.', 'HBBBS', 'BBBSS', '.SSD.'],
           ['..WHB.', '.HBBBB', 'HBBBBS', 'BBBBSS', '.SSSD.']),
}
CLUMP_AT = [   # 변형 8개(마지막 = 본몸통)의 (x, y, 크기)
    ((2, 1, 2), (9, 3, 1), (4, 8, 0), (11, 10, 3), (1, 12, 1)),
    ((3, 2, 3), (12, 1, 0), (9, 9, 2)),
    ((1, 1, 1), (6, 3, 0), (11, 2, 1), (3, 7, 2), (10, 7, 0), (6, 11, 1), (13, 12, 0), (1, 13, 0)),
    ((5, 4, 3), (12, 11, 1)),
    ((2, 2, 2), (10, 5, 1), (5, 10, 2), (12, 12, 0)),
    ((8, 1, 1), (2, 6, 1), (7, 7, 3), (1, 12, 0), (12, 12, 1)),
    ((4, 0, 0), (10, 2, 2), (3, 9, 1), (11, 10, 1)),
    ((3, 3, 1), (10, 8, 2), (5, 12, 0)),
]


def base_rows(line, k):
    X, Y, Z = TONES[line][:3]
    return turn([r.replace('.', X).replace('#', Y).replace('+', Z) for r in BLOTCH], k)


# B·C 는 덩이를 더 많이(작은 덩이 3~4개 덧) — 넓은 한 단 면이 남지 않게. A 는 그대로.
EXTRA_AT = [((6, 13, 0), (13, 6, 0), (7, 5, 1)), ((1, 8, 1), (6, 13, 0), (13, 7, 0), (6, 6, 0)),
            ((8, 9, 1), (13, 4, 0)), ((1, 1, 1), (9, 1, 0), (2, 11, 0), (8, 12, 0)),
            ((7, 1, 0), (1, 7, 0), (9, 12, 1)), ((12, 4, 0), (4, 1, 0), (5, 13, 0)),
            ((7, 6, 1), (1, 3, 0), (7, 13, 0), (13, 14, 0)), ((7, 1, 0), (1, 8, 0), (12, 13, 0), (13, 3, 0))]


def clumped(line, rows, at, extra=()):
    t = TONES[line]
    H, B, S = t[3:6]
    D = t[6] if len(t) > 6 else S
    W = t[7] if len(t) > 7 else H
    spr = CLUMPS['ABC']
    g = [list(r) for r in rows]
    for x, y, k in sorted(tuple(at) + tuple(extra), key=lambda t: t[1]):
        for dy, r in enumerate(spr[k]):
            for dx, ch in enumerate(r):
                if ch != '.':
                    g[(y + dy) % 16][(x + dx) % 16] = {'H': H, 'B': B, 'S': S, 'D': D, 'W': W}[ch]
    return [''.join(r) for r in g]


CRACK = {'A': ('d', 'b', 'c'), 'B': ('p', 'b', 'm'), 'C': ('k', 'd', 'm')}

# 턱(설계 1): 위 판 끝 빛 입술 → 꺾인 앞면 → 아래 판 그늘. 길이·꺾임이 다른 둘.
LEDGE = {
    'A': (['..llll......', 'llddddlll...', 'dddbbbdddlll', 'bb.....bbddd', '..........bb'],
          ['.lll....', 'lddll...', 'dbbddlll', 'b..bbddd', '......bb']),
    'B': (['...llll.....', 'lllppppll...', 'pppcccpppll.', 'cc.....ccppl', '.........ccp'],
          ['..ll....', 'llppl...', 'ppccppll', 'c..ccppp', '......cc']),
    'C': (['mmmmm..mmmm.', 'kkkkkmmkkkkm', 'ddddkkkddddk', '....ddd....d'],
          ['.mmmm...', 'mkkkkmm.', 'kddddkkm', 'd....ddk']),
}
# 덩이(설계 2): 중간 단 윗면, 위·왼 빛, 아래 그늘 — 하얗게 튀지 않는다.
BOULDER = {
    'A': (['...gnm....', '.mmcccmm..', 'mccccccccb', 'cccccccbbd', '.cbbbbbdd.', '..ddddd...'],
          ['.mgm.', 'mcccb', 'ccbbd', '.ddd.'], ['mc', 'bd']),
    'B': (['...llll...', '.llmmmmcc.', 'lmmmmmmccp', 'mmmmmmcccp', '.cmmcccpp.', '..pppppp..'],
          ['.ll.', 'lmmc', 'mmcp', '.pp.'], ['lm', 'cp']),
    'C': (['..hccm....', '.cccmmmmb.', 'ccmmmmmbbbm', '.mbbmmbbbbk', '.kkkkbbbbk.', '.....kxxk..'],   # 완만한 5단: h c m b k x
          ['.hcm.', 'hccmb', '.mbk.', '.kxk.'], ['hm', 'bk']),
}
# 층(C1): 가는 층 줄 — 위 옅은 빛(m) + 줄(k). 가로 변은 y=4·11 에서만 건넌다.
def strata_line(rows, pts):
    g = [list(r) for r in rows]
    for x, y in CR.poly(*pts):
        if 0 <= x < 16 and 1 <= y < 16:
            g[y][x] = 'k'
            if g[y - 1][x] not in 'k':
                g[y - 1][x] = 'm'
    return [''.join(r) for r in g]


def _crack(line, rows, paths):
    d, sh, li = CRACK[line]
    return cut(rows, paths, dark=d, shade=sh, lit=li)


# B·C 윗면: 조용한 바탕(같은 값 단의 색조 얼룩 X·Y + 드문 점 Z) 위에 칸마다 1~3개의 큰 덩이(5~9px)만 — 덩이 안은
# 위·왼 빛 → 몸 → 아래 그늘로 단이 이웃끼리 가깝게 이어지는 완만한 기울기(밝은 점 W·깊은 점 D 는 한 화소씩).
# 덩이 크기·자리·개수를 변형마다 고르지 않게 둔다(자갈·포석처럼 고르게 깔리지 않게).
BIG = (['.HMB.', 'HMMBS', '.BBS.', '..D..'],
       ['.WHM..', 'HHMMB.', 'MMMBBS', '.BBSS.', '..SD..'],
       ['..WHH..', '.HHMMB.', 'HMMMBBS', 'MMBBBSS', '.BBSSD.', '..SSD..'],
       ['...WHH...', '..HHMMMB.', '.HMMMMBBB', 'HMMMMBBBS', 'MMMBBBBSS', '.BBBBSSD.', '...SSSD..'])
BIG_AT = [((2, 2, 3), (11, 10, 0)), ((6, 1, 2), (1, 9, 1), (11, 12, 0)), ((3, 5, 3),), ((9, 2, 1), (2, 8, 2)),
          ((1, 1, 0), (7, 6, 3)), ((10, 3, 2), (3, 11, 0)), ((2, 3, 1), (8, 9, 2)), ((4, 4, 2),)]
BIG_AT2 = [((1, 3, 3),), ((7, 2, 3), (2, 11, 1)), ((2, 1, 2),), ((4, 6, 3), (13, 2, 0)),
           ((1, 2, 1), (3, 9, 2)), ((6, 5, 3), (1, 1, 0)), ((10, 4, 2), (2, 7, 3)), ((4, 4, 2),)]
QUIET = {   # X Y Z (바탕) · W H M B S D (덩이) · G- G^ (잔결) — B: 0.23~0.58 다섯 단, C: 0.10~0.50 다섯 단
    'B': ('b', 'm', 'd', 'h', 'l', 'm', 'b', 'd', 'k', 'd', 'm'),
    'C': ('b', 'k', 'k', 'h', 'c', 'm', 'b', 'k', 'x', 'k', 'm'),
}
# 바탕 잔결: 이웃 단 한 화소(- 한 단 어둡게 · ^ 한 단 밝게)를 고르지 않게 흩어 5×5 어디에도 같은 색 평면이 남지 않게 한다.
GRAIN = ['.-......^...-...',
     '................',
     '....-.....-....^',
     '..^.............',
     '.......-.....-..',
     '-...............',
     '...-......^.....',
     '.........-....-.',
     '.^..............',
     '.....-.....-....',
     '..............^.',
     '-.......^.......',
     '...-.........-..',
     '..........-.....',
     '.....^..........',
     '.-.........-...^']



def quiet_top(line, k, at, q=None, base=None, big=None, grain_y=False):
    X, Y, Z, W, H, M, B, S, D, G1, G2, *V = q or QUIET[line]
    big = big or BIG
    g = [list(r.replace('.', X).replace('#', Y).replace('+', Z)) for r in turn(base or BLOTCH, k)]
    for y, r in enumerate(turn(GRAIN, (k + 1) % 4)):
        for x, ch in enumerate(r):
            if ch != '.' and (g[y][x] == X or (grain_y and g[y][x] == Y)):
                g[y][x] = G1 if ch == '-' else G2
    mp = {'W': W, 'H': H, 'M': M, 'B': B, 'S': S, 'D': D, 'V': V[0] if V else H}
    for x, y, sz in sorted(at, key=lambda t: t[1]):
        for dy, r in enumerate(big[sz]):
            for dx, ch in enumerate(r):
                if ch != '.':
                    g[(y + dy) % 16][(x + dx) % 16] = mp[ch]
    return [''.join(r) for r in g]


# A1 윗면(r8): 잔 표·초승달 획을 버리고 B2 처럼 조용한 사암 바탕 + 칸마다 1~2개 큰 덩이, 몇 칸에만 짧은 금 하나.
QUIET_A1 = ('b', 'q', 'b', 'l', 'm', 'c', 'b', 'd', 'k', 'd', 'c')
AT_A1 = [((3, 2, 3),), ((1, 1, 2), (9, 8, 1)), ((5, 6, 3),), ((2, 3, 1), (8, 1, 2)), ((1, 7, 2),), ((7, 2, 3),),
         ((2, 2, 2), (9, 9, 1)), ((10, 10, 0),)]   # 마지막 = 본몸통(가장자리 47 변형이 모두 씀) → 가장 조용하게
# B1 윗면(r8): B2 와 다른 설계 — 넓고 부드러운 밝은 판(BROAD)과 칸마다 아주 큰 납작 덩이 하나(+ 가끔 작은 덩이), 금 없음.
BROAD = ['................', '..####..........', '.#######........', '.########.......', '..#######.......',
         '...#####........', '....###.........', '................', '.........###....', '........######..',
         '.......########.', '........#######.', '.........#####..', '...........##...', '................',
         '................']
BIG_B1 = (BIG[0], ['....WHHH....', '..HHHMMMMB..', '.HMMMMMMMBB.', 'HMMMMMMMBBBS', 'MMMMMMBBBBSS', '.BBBBBBBSSS.',
                   '..BSSSSSSD..', '....SSDD....'])
QUIET_B1 = ('b', 'm', 'b', 'h', 'l', 'm', 'b', 'd', 'k', 'd', 'm')
AT_B1 = [((2, 3, 1),), ((4, 6, 1), (1, 1, 0)), ((1, 1, 1), (11, 11, 0)), ((3, 8, 1),), ((0, 4, 1), (11, 1, 0)),
         ((4, 2, 1),), ((2, 7, 1), (11, 1, 0)), ((9, 10, 0),)]
# C1 윗면(r8): 바탕은 가까운 두 단(b·d)과 어두운 잔결 k 만, 덩이는 적고 크게, 가장 밝은 h 는 빼서 빛 화소를 절반으로.
QUIET_C1 = ('b', 'd', 'b', 'h', 'c', 'm', 'b', 'k', 'x', 'k', 'm')   # 가장 밝은 h 는 덩이 꼭대기 한두 화소(W)만
AT_C1 = BIG_AT[:7] + [((10, 9, 0),)]   # r7 에서 화풍을 통과한 덩이 배치 그대로, 본몸통만 조용하게


# B2 윗면(r8b): 크기·모양이 제각각인 모난 바윗덩이(조각·쐐기·납작 판·선 덩이·큰 덩이) — 둥근 도장 되풀이 대신.
# 위·왼 빛면에 한 단 더(V = stone 3, 푸른 기 도는 밝은 회색) → h v l m b d k 여섯~일곱 단. B1 의 넓은 판과 달리 바탕은 잔 얼룩 그대로.
BIG_B2 = (['.HM.', 'HMBS', '.SD.'],
          ['..VHM.', '.VHMMB', 'HMMBBS', '.BSSD.'],
          ['.WVVHH..', 'VHHMMMMB', 'HMMMMBBS', '.MBBBBSS', '...SSDD.'],
          ['..WV..', '.VHHM.', 'VHHMMB', 'HMMMBS', 'MMBBBS', '.BBSSD', '..SD..'],
          ['...WVH....', '..VHHMMM..', '.VHHMMMMB.', 'HHMMMMMBBS', '.MMMBBBBSS', '..BBBSSSD.', '.....SDD..'])
AT_B2 = [((1, 3, 4), (12, 12, 0)), ((7, 2, 2), (2, 10, 1)), ((2, 1, 3), (10, 9, 1)), ((4, 6, 4), (12, 2, 0)),
         ((1, 2, 1), (3, 9, 2), (11, 4, 0)), ((6, 5, 3), (1, 1, 0)), ((8, 3, 2), (2, 7, 4)), ((9, 9, 1),)]
QUIET_B2 = QUIET['B'] + ('v',)


def tops(line, n):
    ks = (1, 2, 3, 0, 1, 2, 3, 0) if n == 1 else (2, 3, 0, 1, 2, 3, 0, 1)
    if (line, n) == ('A', 1):
        t = [quiet_top('A', k, at, QUIET_A1) for k, at in zip(ks, AT_A1)]
        v = [t[0], _crack('A', t[1], [((10, 2), (12, 4), (13, 6))]), t[2], t[3],
             _crack('A', t[4], [((9, 2), (12, 4), (14, 8))]), t[5], _crack('A', t[6], [((2, 11), (5, 13), (7, 12))])]
        return v + [t[7]]
    if (line, n) == ('B', 1):
        t = [quiet_top('B', k, at, QUIET_B1, BROAD, BIG_B1) for k, at in zip(ks, AT_B1)]
        return t[:7] + [t[7]]
    if line == 'A':
        t = [clumped(line, base_rows(line, k), at) for k, at in zip(ks, CLUMP_AT)]
    elif (line, n) == ('C', 1):
        t = [quiet_top('C', k, at, QUIET_C1, grain_y=True) for k, at in zip(ks, AT_C1)]
    else:
        t = [quiet_top(line, k, at) for k, at in zip(ks, BIG_AT)]
    if n == 1:   # 금·턱·층 줄은 칸 안에서 시작해 칸 안에서 끝난다(이웃 칸 앞에서 잘린 금이 생기지 않게)
        big, small = LEDGE[line]
        if line == 'C':
            # 윗면은 방향 없는 갈래 금(여러 방향)과 덩이 — 가로 층 줄은 앞면에만 둔다(윗면이 물결·벽돌로 읽히지 않게)
            v = [_crack(line, t[0], [((3, 2), (5, 6), (4, 9)), ((5, 6), (9, 7))]),
                 _crack(line, t[1], [((10, 3), (8, 7), (11, 11)), ((8, 7), (5, 9))]),
                 t[2],
                 _crack(line, t[3], [((2, 10), (6, 12), (7, 14)), ((6, 12), (9, 10))]),
                 _crack(line, t[4], [((12, 2), (13, 6)), ((4, 4), (6, 3))]),
                 t[5],
                 _crack(line, t[6], [((11, 2), (11, 5), (13, 7)), ((11, 5), (8, 6))])]
        elif line == 'B':   # B1: 턱 도장 대신 길고 짧은 금만 — 큰 덩이 사이를 가르는 깨진 바위 결
            v = [_crack(line, t[0], [((2, 3), (4, 5), (7, 8), (11, 13))]),
                 _crack(line, t[1], [((3, 12), (6, 11), (8, 13))]),
                 t[2],
                 _crack(line, t[3], [((5, 2), (6, 4), (3, 8), (2, 12))]),
                 _crack(line, t[4], [((2, 2), (5, 3)), ((12, 3), (13, 6))]),
                 t[5],
                 _crack(line, t[6], [((13, 11), (11, 10), (9, 6))])]
        else:
            v = [_crack(line, t[0], [((2, 3), (4, 5), (7, 8), (11, 13))]),
                 stampl(t[1], [(big, 2, 5)]),
                 t[2],
                 _crack(line, t[3], [((5, 2), (6, 4), (3, 8), (2, 12))]),
                 _crack(line, stampl(t[4], [(small, 7, 9)]), [((2, 2), (5, 3))]),
                 t[5],
                 _crack(line, t[6], [((13, 11), (11, 10), (9, 6))])]
    elif line != 'A':   # B2·C2: 큰 덩이 자체가 둥근 바위 — 따로 찍는 평평한 바위 조각은 겹쳐 붐비게 해서 뺐다. 덩이 배치만 다르게.
        t = ([quiet_top('B', k, at, QUIET_B2, big=BIG_B2) for k, at in zip(ks, AT_B2)] if line == 'B' else
             [quiet_top(line, k, at) for k, at in zip(ks, BIG_AT2)])
        if line == 'C':   # 검은 화산암은 덩이만이면 같은 도장이 되풀이돼 보인다 — 칸 절반에 짧은 갈래 금을 섞는다
            v = [_crack(line, t[0], [((9, 10), (11, 13), (10, 15))]), t[1],
                 _crack(line, t[2], [((12, 2), (13, 5)), ((13, 5), (11, 6))]), t[3],
                 _crack(line, t[4], [((12, 10), (14, 12)), ((12, 10), (11, 13))]),
                 _crack(line, t[5], [((12, 13), (11, 11), (13, 9))]), t[6]]
        else:
            v = [t[0], t[1], t[2], t[3], t[4], _crack(line, t[5], [((12, 13), (11, 11), (13, 9))]), t[6]]
    else:
        b1, b2, peb = BOULDER[line]
        v = [stampl(t[0], [(peb, 3, 4)]),
             stampl(t[1], [(b1, 2, 4)]),
             t[2],
             t[3],
             stampl(t[4], [(b2, 9, 3), (b2, 3, 10)]),
             _crack(line, t[5], [((12, 13), (11, 11), (13, 9))]),
             t[6]]
    return v + [t[7]]


BUILD = {(ln, k): ({1: PROF1, 2: PROF2}[k], (lambda ln=ln, k=k: tops(ln, k))) for ln in 'ABC' for k in (1, 2)}
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


FACE_MOTTLE = [
    '..++.......-....', '.+++......--....', '..+.....+.......', '......-.+++.....', '.-...--..+......',
    '.--.............', '.......++....-..', '..+...+++...--..', '.+++...+........', '..+.........++..',
    '......--...+++..', '.....---....+...', '..........-.....', '.++......---....', '.+++......-.....',
    '..+...++.......-', '......+++.....--', '.-.....+........', '.--..........++.', '..........-.+++.',
    '.....++..---....', '....+++...-.....', '.....+..........', '..-.........++..', '.---.......+++..']
FACE_LADDER = {   # (바탕 글자, 표) → 바꿀 글자. 금·주름 글자(k·x)는 그대로
    'B': {('b', '+'): 'm', ('b', '-'): 'd', ('d', '+'): 'b', ('d', '-'): 'k', ('e', '+'): 'd', ('m', '+'): 'l'},
    'C': {('b', '+'): 'm', ('b', '-'): 'k', ('k', '+'): 'b', ('k', '-'): 'x', ('d', '+'): 'm', ('m', '+'): 'h'},
}


def face_cv(line, rows, left, right):
    """rows 16×32 → 32×32 표본. left/right = 끝 마구리 열 [(열0 글자열 32), …] — '.' 는 그대로."""
    leg = LEG[line]
    assert len(rows) == 32 and all(len(r) == 16 for r in rows), [len(r) for r in rows]
    if line == 'B':   # B 앞면: 윗면(≈0.36)보다 두 단 어둡게 — 위 단 d(0.25), 아래 단 e·k(0.23), 얼룩 + 만 b
        rows = [r.translate(str.maketrans('e', 'd')) if 3 <= y < 15 else r for y, r in enumerate(rows)]
    if line == 'C':   # C 앞면: 바탕 b(0.26)를 k(0.17)로 내려 윗면(≈0.28)보다 확실히 어둡게, 얼룩 + 는 b
        rows = [r.translate(str.maketrans('b', 'k')) if 3 <= y < 28 else r for y, r in enumerate(rows)]
    if line in FACE_LADDER:   # B·C: 손으로 찍은 얼룩 표로 바탕 단을 한 단 올리고(+) 내려(-) 넓은 한 단 면을 깬다 → 4~5단
        lad = FACE_LADDER[line]
        out = []
        for y, r in enumerate(rows):
            if 3 <= y < 28:
                m = FACE_MOTTLE[y - 3]
                r = ''.join(lad.get((c, mk), c) for c, mk in zip(r, m))
            out.append(r)
        rows = out
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


def _cap(lit_col=None, inner_col=None, low='0'):
    """끝 마구리: 끝 열을 따로 칠하지 않고(밝은·어두운 끝 줄이 칸마다 세로 이음처럼 서지 않게) 바닥 닿는 귀만 2px 둥글게.
    lit_col·inner_col 은 예전 호출 모양을 위해 받기만 한다."""
    return ['.' * 30 + low * 2, '.' * 31 + low]


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
    return face_cv('A', rows, _cap('c', '.'), _cap('.', '.'))


A_FST1 = ['.cm.', 'cmcb', 'bcbd', '.dd.', '..k.']
A_FST2 = ['..mc...', '.cmccb.', 'cmcccbd', 'bccbbbd', '.bbbdd.', '..ddk..']
A_FST3 = ['.mcc..', 'mcccb.', 'ccbbbd', '.bbdd.', '..kk..']
A_FST4 = ['cm', 'bd']


def face_a2():
    """사암 벼랑: 지그재그 세로 금 하나와 짧은 비스듬한 금 둘로 크기가 다른 판이 갈린다(돌 쌓기·층리가 아니다)."""
    g = _fgrid(['bbbbbbbbbbbbbbbb', 'bbbbbbbcbbbbbbbb', 'bbbcbbbbbbbbbbbb', 'bbbbbbbbbbbbbcbb'], A_FTOP, A_FBOT,
               ['dddddddbdddddddd', 'ddbddddddddddddd', 'dddddddddddddbdd'], 15)
    # r8: 16px 마다 같은 열에 서던 세로 금을 빼고, 이음을 감아 넘는 가로 층 둘 + 가운데를 벗어난 짧은 비스듬 금(가로로 눕힘)
    _beds(g, [(10, '1110000001122211'), (20, '0011222211000000')], 'k', 'd', 'c')
    _cracks(g, [((2, 14), (5, 16), (8, 17)), ((11, 23), (14, 25))], 'k', 'd', 'c')
    _specks(g, [(7, 5, 'g'), (8, 5, 'g'), (13, 6, 'c'), (1, 24, 'b'), (14, 15, 'b')])
    _lipline(g, 'A', '0000000110000000')
    rows = [''.join(r) for r in g]
    return face_cv('A', rows, _cap('c', '.'), _cap('.', '.'))


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
    """모난 화강암 판: 가로로 겹친 두꺼운 판 셋(위 b 빛 판 · 가운데 b/d 섞임 · 아래 d)이 계단처럼 꺾인 판 경계(주름 k · 위 판 밑 그늘 e ·
    아래 판 빛 턱 m)로 갈린다. 세로 금은 없다 — 판 경계의 1~2px 꺾임만 세로로 짧다(r8: 판자·문짝처럼 읽히지 않게)."""
    g = _fgrid(['bbbbbbbbbbbbbbbb', 'bbbbbbbbbmbbbbbb', 'bbbbbbbbbbbbbbbb', 'bbbmbbbbbbbbbbbb', 'bbbbbbbbbbbbbbbb'],
               B_FTOP, B_FBOT,
               ['dbddddddbbdddddd', 'dddddbdddddddbdd', 'bdddddddddbddddd', 'ddddddbddddddddb'], 15)
    _beds(g, [(9, '0000022222111111'), (16, '3333110000022222'), (23, '11.....000011222')], 'k', 'e', 'm')
    for x, y in ((3, 12), (4, 12), (12, 20), (13, 20), (6, 26)):   # 판 안 넓은 빛 면 몇 화소(위·왼)
        _fput(g, x, y, 'm')
    _specks(g, [(11, 5, 'd'), (7, 19, 'e'), (2, 21, 'b')])
    _lipline(g, 'B', '0001111100000111')
    rows = [''.join(r) for r in g]
    return face_cv('B', rows, _cap('b', '.'), _cap('.', '.'))


def face_b2():
    """모난 화강암 벼랑: 지그재그 세로 금 하나가 벽을 가르고 짧은 턱·비스듬한 금이 몇 줄 — B1 과 금 자리·기울기가 다르다."""
    g = _fgrid(['dddddddddddddddd', 'dddddbdddddddddd', 'dddddddddddbdddd'], B_FTOP, B_FBOT,
               ['eeeeeeeeeeeeeeee', 'eeedeeeeeeeeeeee', 'eeeeeeeeeedeeeee'], 15)
    _cracks(g, [((10, 3), (11, 9), (9, 15), (10, 21), (8, 27)), ((11, 9), (15, 10), (19, 9)), ((2, 17), (5, 24))],
            'k', 'e', 'b')
    _specks(g, [(3, 6, 'b'), (10, 6, 'b'), (14, 21, 'b')])
    _lipline(g, 'B', '1221000111000122')
    rows = [''.join(r) for r in g]
    return face_cv('B', rows, _cap('b', '.'), _cap('.', '.'))


# ---- 줄 C: 현무암(b 바탕 0.26 · k 그늘 · d 쇠빛 · m 빛 턱)
C_FTOP = ['kxkkxkkkxkkxkkkx', 'mmbmmbmmmbmmbmmm', 'bdbbbbdbbbdbbbbd']
C_FBOT = ['bkbdmbbkbbdmbbkb', 'kbmbkkbdmbkbbdmb', 'kkbk0kbkkbk0kkbk', '0000k0000k00000k']


def face_c1():
    """가는 현무암 층: 길게 느리게 물결치는 층 경계 다섯(간격 4~6px, 굵기·높이 들쭉날쭉), 세로 이음 없음.
    C2 의 두꺼운 턱 벽과 달리 층이 얇고 턱 그늘이 한 줄뿐이다(r8: 벽돌 쌓기로 읽히지 않게)."""
    g = _fgrid(['bbbbbbbbbbbbbbbb', 'bbbbbbdbbbbbbbbb', 'bbbbbbbbbbbbbbbb', 'bbbbbbbbbbbbdbbb', 'bbdbbbbbbbbbbbbb'],
               C_FTOP, C_FBOT,
               ['kkkkkkbkkkkkkkkk', 'kkbkkkkkkkkkkkkk', 'kkkkkkkkkkkbkkkk', 'kkkkkkkkkkkkkkkk'], 16)
    _beds(g, [(6, '0001122221100000'), (11, '2221110000011222'), (16, '0000111122222110'),
              (21, '1111000001112221'), (25, '0011111000000111')], 'x', 'k', 'm')
    _lipline(g, 'C', '0000111100000000')
    rows = [''.join(r) for r in g]
    return face_cv('C', rows, _cap('d', '.'), _cap('k', '.'))


def face_c2():
    """두꺼운 층이 턱으로 튀어나온 화산암 벽: 층마다 위 끝 빛 턱(m·c) → 몸(b) → 밑 그늘(k 두 줄, 턱 밑 오목). C1 보다 층이 두껍고
    턱이 깊어 층층이 쌓인 바위로 읽힌다(줄 C = 깊은 층 진 바위)."""
    g = _fgrid(['bbbbbbbbbbbbbbbb', 'bbdbbbbbbbbbbdbb', 'bbbbbbbmbbbbbbbb', 'bbbbdbbbbbbbbbbb'], C_FTOP, C_FBOT,
               ['kbkkkkkbkkkkkkkk', 'kkkkbkkkkkkkbkkk', 'kkkkkkkkkkkkkkkk'], 16)
    for y0, offs in ((9, '0000111222211000'), (18, '2211000000011122'), (24, '000111100000.000')):
        for x, o in enumerate(offs):
            if o == '.':
                continue
            y = y0 + int(o)
            g[y - 2][x] = 'k'      # 위 층 밑 오목 그늘
            g[y - 1][x] = 'k' if (x + y) % 5 else 'x'
            g[y][x] = 'm'          # 아래 층 위 끝 빛 턱
            g[y + 1][x] = 'c' if x % 3 else 'm'
    _joints(g, [('55', 5), ('bbb', 13), ('3', 21)], 'k', 'k', 'd')
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
    '####..######.#',
    '###....####..#',
    '##......##...#',
    '##.......#...#',
    '###..........#',
    '#####...##..##',
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
    'A1': '조용한 사암 암반 — 어두운 사암 바탕(회녹 얼룩·이웃 단 잔결)에 칸마다 큰 덩이 1~2개, 몇 칸에만 짧은 금. 계단 턱 줄은 모서리에서 끊기고 동 변은 고르지 않은 밝은 테두리. 앞면 = 물결 층리 사암',
    'A2': '사암 돌무더기 — 어두운 잔 얼룩 윗면에 작은 홈·혹·덩이. 앞면 = 이음을 감아 넘는 가로 층 둘과 가운데를 벗어난 짧은 비스듬 금(세로 금 없음), 평평한 입술',
    'B1': '넓은 회색 판 암반 — 넓고 부드러운 밝은 판 위에 칸마다 아주 큰 납작 덩이 하나(가끔 작은 덩이), 금 없음. 앞면 = 한 단 밝은 화강암, 계단처럼 꺾인 가로 판 경계(세로 금 없음)',
    'B2': '모난 회색 바윗덩이 — 조용한 잔 얼룩 바탕에 크기·모양이 제각각인 조각·쐐기·납작 판·선 덩이(위·왼 빛면 한 단 더, 푸른 회색 그늘). 앞면 = 두 단 어두운 지그재그 금 화강암 벼랑, 맨 위 밝은 턱 줄',
    'C1': '갈라진 현무암 — 가까운 두 단 바탕과 어두운 잔결에 덩이 몇 개(가장 밝은 빛은 덩이 꼭대기 한두 화소)와 갈래 금. 앞면 = 세로 이음 없는 길고 가는 물결 층 다섯',
    'C2': '현무암 바윗덩이 — 같은 바탕에 크고 고르지 않은 덩이와 짧은 금. 앞면 = 한층 어두운 두꺼운 층 턱 벽, 맨 위 밝은 턱 줄',
}

CANDIDATES = {'gap.rock_fill': {f'{ln}{n}': cand(ln, n) for ln in 'ABC' for n in (1, 2)}}
