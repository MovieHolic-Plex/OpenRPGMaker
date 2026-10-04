#!/usr/bin/env python3
"""일본 세트 v35-A — 1칸=16px=1m(§12) 표준 캔버스에 손으로 다시 찍은 3/4 후보.
좌표 붓(rect/px/hline)과 손 격자 문자열로 한 화소씩 놓는다. 생성 이미지·트레이싱·h34-B 참조 없음.
  python3 scripts/content/atlas-pick/make_v35_jp.py [slug ...]      # .pxg 를 후보 폴더에 쓴다
캔버스·치수 근거는 tiledata/atlas-pick/size-audit.json 의 basis (F 앞면 · T 윗면 · wpx 폭)."""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from pxg_emit import emit
CAND = os.path.abspath(os.path.join(HERE, '..', '..', '..', 'tiledata', 'atlas-pick', 'candidates-jp'))

class G:
    def __init__(s, w, h): s.w, s.H = w, h; s.g = [['.'] * w for _ in range(h)]
    def px(s, x, y, c):
        assert 0 <= x < s.w and 0 <= y < s.H, (x, y, c); s.g[y][x] = c
    def rect(s, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): s.px(x, y, c)
    def h(s, x0, x1, y, c): s.rect(x0, y, x1, y, c)
    def v(s, x, y0, y1, c): s.rect(x, y0, x, y1, c)
    def put(s, x0, y0, rows):
        for j, r in enumerate(rows):
            for i, c in enumerate(r):
                if c != ' ': s.px(x0 + i, y0 + j, c)
    def rows(s): return [''.join(r) for r in s.g]
    def show(s): print('\n'.join(''.join(r) for r in s.g))

def write(slug, g, legend, title):
    rows = g.rows()
    txt = emit(rows, legend, title)
    p = os.path.join(CAND, slug, 'v35-A.pxg')
    open(p, 'w', encoding='utf-8').write(txt)
    print(slug, g.w, 'x', g.H, '->', p)

# ------------------------------------------------------------ 자판기 4종 16x32 (폭 16 · F28 · T4)
# 손으로 그린 틀 한 벌(식구 공통 배치: 간판 3줄 · 견본 창 3단 · 조작열 · 배출구 · 발판). 색 글자는 변형마다 범례로 바꾼다.
VEND = [
    ".oooooooooooooo.",   # T 뒤 윤곽
    "oTTTTTTTTTTTTTTo",
    "oTTTTTTTTTTTTTTo",
    "HHHHHHHHHHHHHHHK",   # T 앞 가장자리 하이라이트
    "LSSSSSSSSSSSSSSK",   # F 간판 띠 y4..6
    "LSwwwSSaaSwwwSSK",
    "LssssssssssssssK",
    "LnnnnnnnnnnnnnnK",
    "LmmmmmmmmmmmFFDK",   # y8 견본 창 위 테두리
    "LmAAgBBgCCgmkkDK",
    "LmaagbbgccgmeeDK",
    "LmnnnnnnnnnmFFDK",
    "LmCCgAAgBBgmrrDK",
    "LmccgaagbbgmFFDK",
    "LmnnnnnnnnnmuuDK",
    "LmBBgCCgAAgmFFDK",
    "LmbbgccgaagmccDK",
    "LmnnnnnnnnnmFFDK",
    "LmmmmmmmmmmmkkDK",   # y18 견본 창 아래 테두리
    "LnnnnnnnnnnnnnnK",
    "LmmmmmmmmmmmmmmK",   # y20 배출구 위
    "LFqqqqqqqqqqkkDK",
    "LFkkkkkkkkkkkkDK",
    "LFkkkkkkkkkkFFDK",
    "LFkkkkkkkkkkkkDK",
    "LFkkkkkkkkkkMMDK",
    "LFkkkkkkkkkkFFDK",
    "LmmmmmmmmmmmmmmK",
    "LDDDDDDDDDDDDDDK",
    "nnnnnnnnnnnnnnnn",   # 받침
    "nnnnnnnnnnnnnnnn",
    "zzzzzzzzzzzzzzzz",
]

def vend_legend(body, sign, cans, glass=('mglass', 3), ctl=None):
    r, o, T, H, Lc, F, D, K = body
    L = {'o': (r, o), 'T': (r, T), 'H': (r, H), 'L': (r, Lc), 'F': (r, F), 'D': (r, D), 'K': (r, K),
         'm': ('mmetal', 3), 'M': ('mmetal', 5), 'n': ('mmetal', 1), 'z': ('mmetal', 0), 'k': ('lacq', 1), 'q': ('lacq', 2),
         'S': sign[0], 's': sign[1], 'w': sign[2], 'a': sign[3], 'g': glass, 'e': ('neonc', 4),
         'r': ('akachin', 4), 'u': ('kblue', 4), 'c': ('kgreen', 4)}
    for ch, (top, bot) in zip('ABC', cans):
        L[ch] = top; L[ch.lower()] = bot
    if ctl: L.update(ctl)
    return L

def vending(body, sign, cans, glass=('mglass', 3), ctl=None):
    g = G(16, 32)
    for y, row in enumerate(VEND):
        for x, ch in enumerate(row):
            if ch != '.': g.px(x, y, ch)
    return g, vend_legend(body, sign, cans, glass, ctl)

# 몸통 (램프, 뒤윤곽, 윗면, 앞가장자리, 왼밝은, 앞면, 오른어두운, 오른가장자리)
WHITE = ('mwhite', 0, 4, 5, 4, 2, 1, 0)
BROWN = ('sumi', 1, 5, 4, 4, 3, 1, 0)
REDB = ('mred', 1, 5, 4, 4, 3, 2, 1)
# 견본 색 (윗줄, 아랫줄)
CR = (('akachin', 5), ('akachin', 3)); CB = (('kblue', 5), ('kblue', 3)); CG = (('kgreen', 5), ('kgreen', 3))
CW = (('washi', 5), ('washi', 3)); CY = (('taxi', 5), ('taxi', 3)); CP = (('sakura', 4), ('sakura', 3)); CS = (('mglass', 6), ('mglass', 4))

def vending_drink():
    return vending(WHITE, (('kblue', 3), ('kblue', 1), ('washi', 5), ('akachin', 4)), (CR, CB, CG))
def vending_cig():
    return vending(BROWN, (('taxi', 3), ('taxi', 1), ('sumi', 1), ('akachin', 4)), (CW, CR, CY),
                   glass=('sumi', 0))
def vending_coffee():
    return vending(REDB, (('washi', 4), ('washi', 2), ('kblue', 3), ('akachin', 4)), (CW, CB, CY))
def vending_ice():
    return vending(WHITE, (('kblue', 3), ('kblue', 1), ('washi', 5), ('neonc', 4)), (CP, CS, CG),
                   glass=('mglass', 5), ctl={'u': ('kblue', 3), 'r': ('neonc', 3), 'c': ('kblue', 4)})

# ------------------------------------------------------------ 가는 기둥류 (손 격자 + 좌표 붓)
def line(g, x0, y0, x1, y1, c):
    dx, dy = abs(x1 - x0), abs(y1 - y0); sx = 1 if x0 < x1 else -1; sy = 1 if y0 < y1 else -1; e = dx - dy
    while True:
        g.px(x0, y0, c)
        if (x0, y0) == (x1, y1): break
        e2 = 2 * e
        if e2 > -dy: e -= dy; x0 += sx
        if e2 < dx: e += dx; y0 += sy

def pole(g, x, y0, y1, hi='M', mid='m', dk='n'):
    """2px 금속 기둥: 왼쪽 밝게 오른쪽 어둡게"""
    g.v(x, y0, y1, hi); g.v(x + 1, y0, y1, mid)

METAL = {'M': ('mmetal', 5), 'm': ('mmetal', 3), 'n': ('mmetal', 1), 'z': ('mmetal', 0), 'o': ('mmetal', 1)}

def konbini_pole():
    """편의점 간판 기둥 16x64: 폭 8 · 윗면 2 · 앞면 62 (간판 상자 34줄 + 기둥 + 받침)"""
    g = G(16, 64)
    g.h(5, 10, 0, 'o'); g.h(4, 11, 1, 'H')                      # 윗면: 뒤 윤곽 / 앞 가장자리 하이라이트
    g.rect(4, 2, 11, 35, 'w'); g.h(4, 11, 2, 'W')               # 상자 틀(흰) 
    bands = [(3, 13, 'a', 'A', 'B'), (15, 24, 'c', 'C', 'E'), (26, 33, 'g', 'G', 'F')]
    for a, b, m, hi, dk in bands:
        g.rect(5, a, 10, b, m); g.v(5, a, b, hi); g.v(10, a, b, dk)
    g.h(4, 11, 14, 'W'); g.h(4, 11, 25, 'W')                    # 띠 사이 흰 테두리
    g.v(11, 2, 35, 'D'); g.v(4, 2, 35, 'L')
    g.h(6, 9, 7, 'x'); g.h(6, 9, 9, 'x')                        # 파랑 띠: 로고 막대 둘
    g.h(6, 9, 19, 'x'); g.h(6, 9, 20, 'x')                      # 주황 띠: 막대
    g.h(6, 9, 29, 'x')                                          # 초록 띠: 막대
    g.h(4, 11, 34, 'D'); g.h(4, 11, 35, 'N')                    # 상자 밑판
    pole(g, 7, 36, 57)
    g.h(6, 9, 36, 'n')                                          # 상자 밑 연결쇠
    g.h(5, 10, 58, 'M'); g.h(5, 10, 59, 'm')                    # 받침판
    g.h(4, 11, 60, 'n'); g.h(4, 11, 61, 'z')
    g.h(3, 12, 62, '~'); g.h(5, 12, 63, '-')
    L = dict(METAL); L.update({'H': ('mwhite', 5), 'W': ('mwhite', 4), 'w': ('mwhite', 4), 'D': ('mwhite', 1), 'L': ('mwhite', 5), 'N': ('mwhite', 0),
        'a': ('kblue', 3), 'A': ('kblue', 4), 'B': ('kblue', 2), 'c': ('korange', 3), 'C': ('korange', 4), 'E': ('korange', 2),
        'g': ('kgreen', 3), 'G': ('kgreen', 4), 'F': ('kgreen', 2), 'x': ('mwhite', 5)})
    return g, L

def ped_signal():
    """보행자 신호 16x48: 폭 6 · 윗면 3 · 앞면 40 (기둥 위 함 · 빨간 사람/초록 사람)"""
    g = G(16, 48); oy = 48 - 43
    g.h(6, 9, oy, 'o'); g.h(5, 10, oy + 1, 'H'); g.h(5, 10, oy + 2, 'U')   # 윗면 3줄
    top = oy + 3
    g.rect(5, top, 10, top + 17, 'k'); g.v(5, top, top + 17, 'L'); g.v(10, top, top + 17, 'D')
    g.h(5, 10, top, 'U')                                                  # 위 챙
    g.h(5, 10, top + 8, 'D'); g.h(5, 10, top + 17, 'D')                   # 칸 사이 · 밑판
    red = ["..rr", "..rr", ".rrr"[:0] or "rrrr", ".rr.", ".rr.", "r..r"]
    man = [".rr.", ".rr.", "rrrr", ".rr.", ".rr.", "r..r"]
    walk = [".bb.", ".bb.", "bbbb", ".bb.", "b.b.", "b..b"]
    g.put(6, top + 1, ["".join('r' if ch == 'r' else ' ' for ch in r) for r in man])
    g.put(6, top + 10, ["".join('b' if ch == 'b' else ' ' for ch in r) for r in walk])
    pole(g, 7, top + 18, 47 - 4)
    g.h(5, 10, 44, 'M'); g.h(5, 10, 45, 'n'); g.h(3, 11, 46, '~'); g.h(5, 12, 47, '-')
    L = dict(METAL); L.update({'H': ('mmetal', 5), 'U': ('mmetal', 4), 'k': ('sumi', 0), 'L': ('mmetal', 4), 'D': ('mmetal', 1),
        'r': ('akachin', 5), 'b': ('kgreen', 5)})
    return g, L

def tomare_sign():
    """멈춤(止まれ) 표지 16x48: 폭 10 · 윗면 2 · 앞면 40 (뒤집힌 삼각 표지 + 기둥)"""
    g = G(16, 48); oy = 48 - 42
    g.h(3, 12, oy, 'e'); g.h(3, 12, oy + 1, 'W')                            # 윗면: 판 윗 모서리
    tri = [(3, 12), (3, 12), (3, 12), (3, 12), (4, 11), (4, 11), (5, 10), (5, 10), (6, 9), (7, 8), (7, 8)]
    y = oy + 2
    for i, (a, b) in enumerate(tri):
        for x in range(a, b + 1):
            edge = (x in (a, b)) or i == 0 or i >= 9
            g.px(x, y + i, 'w' if edge else 'r')
        if not (i == 0 or i >= 9):
            g.px(a + 1, y + i, 'R') if a + 1 < b else None                  # 왼쪽 안쪽은 밝게
            g.px(b - 1, y + i, 'q') if b - 1 > a else None                  # 오른쪽 안쪽은 어둡게
    g.h(5, 10, y + 3, 'w')                                                  # 글자 대신 흰 막대 하나(요점만)
    pole(g, 7, y + len(tri), 47 - 3)
    g.h(5, 10, 45, 'n'); g.h(4, 11, 46, '~'); g.h(6, 12, 47, '-')
    L = dict(METAL); L.update({'e': ('washi', 3), 'W': ('washi', 5), 'w': ('washi', 5), 'r': ('akachin', 3), 'R': ('akachin', 4), 'q': ('akachin', 2)})
    return g, L

def jp_signal():
    """가로형 신호등 48x80: 폭 40 · 윗면 2 · 앞면 78 (기둥 + 팔 + 신호 머리)"""
    g = G(48, 80)
    g.h(5, 43, 0, 'o'); g.h(4, 43, 1, 'H')                                # 팔 윗면
    g.h(4, 43, 2, 'M'); g.h(4, 43, 3, 'm'); g.h(4, 43, 4, 'n')             # 팔 앞면 3줄
    g.rect(4, 5, 6, 76, 'm'); g.v(4, 5, 76, 'M'); g.v(6, 5, 76, 'n')       # 기둥 3폭
    for yy in (24, 25, 52, 53): g.h(3, 7, yy, 'n')                         # 고정 띠
    line(g, 7, 5, 11, 9, 'm'); line(g, 7, 6, 11, 10, 'n')                  # 팔 받침대
    # 신호 머리 (x22..41, y5..16)
    g.rect(22, 5, 41, 17, 's')
    g.h(21, 42, 5, 'v'); g.h(22, 41, 6, 'S')                                # 챙(밝음)
    g.v(22, 5, 17, 'S'); g.v(41, 5, 17, 'k')
    for cx, col, hi in ((25, 'c', 'C'), (31, 'y', 'Y'), (37, 'r', 'R')):
        g.rect(cx, 8, cx + 3, 13, col); g.px(cx, 8, ' ') if False else None
        g.px(cx, 8, 's'); g.px(cx + 3, 8, 's'); g.px(cx, 13, 's'); g.px(cx + 3, 13, 's')
        g.px(cx + 1, 9, hi)
    g.h(22, 41, 16, 'k'); g.h(22, 41, 17, 'k')
    g.h(24, 25, 18, 'n'); g.h(38, 39, 18, 'n')                              # 걸이쇠
    g.h(2, 8, 74, 'M'); g.h(2, 8, 75, 'n'); g.h(2, 8, 76, 'z')            # 받침
    g.h(1, 10, 77, '~'); g.h(3, 12, 78, '-'); g.h(5, 12, 79, '-')
    L = dict(METAL); L.update({'H': ('mmetal', 5), 's': ('sumi', 0), 'S': ('sumi', 3), 'v': ('sumi', 4), 'k': ('sumi', 1),
        'c': ('neonc', 3), 'C': ('neonc', 5), 'y': ('taxi', 3), 'Y': ('taxi', 5), 'r': ('akachin', 3), 'R': ('akachin', 5)})
    return g, L

# ------------------------------------------------------------ 자전거 · 집하장 · 부스 · 표지 · 고마이누
WHEEL = ["...ttttt...", "..tt...tt..", ".tt.....tt.", ".t...r...t.", "t....r....t", "t..rrhrr..t", "t....r....t", ".t...r...t.", ".tt.....tt.", "..tt...tt..", "...ttttt..."]

def mamachari():
    """마마차리 32x32: 폭 29 · 윗면 5(안장·바구니 윗면·손잡이) · 앞면 16(바퀴 11 + 프레임) — 아래 21줄"""
    g = G(32, 32)
    for cx in (2, 19):                                             # 뒷바퀴 x2..12 / 앞바퀴 x19..29
        for j, r in enumerate(WHEEL):
            for i, ch in enumerate(r):
                if ch != '.': g.px(cx + i, 20 + j, ch)
    # 윗면 5줄(y11..15): 안장 윗면 · 바구니 윗면(밝은 안쪽) · 손잡이 막대
    g.h(8, 13, 13, 'O'); g.h(7, 13, 14, 'P'); g.h(7, 12, 15, 'P')            # 안장 윗면 / 앞 하이라이트
    g.rect(23, 12, 30, 12, 'O'); g.rect(23, 13, 30, 15, 'Q'); g.h(23, 30, 15, 'c')   # 바구니 윗면: 뒤 윤곽 · 안쪽 · 앞 테
    g.h(19, 22, 14, 'M'); g.px(19, 15, 'k'); g.px(18, 15, 'k')                  # 손잡이 막대 + 그립
    # 앞면 16줄(y16..31)
    g.h(6, 12, 16, 'S'); g.h(6, 12, 17, 's')                                    # 안장 앞
    for y in range(18, 20): g.px(10, y, 'B')                                     # 시트 튜브 시작
    line(g, 10, 18, 14, 26, 'B'); line(g, 11, 18, 15, 26, 'b')                    # 시트 튜브
    line(g, 10, 18, 22, 20, 'B')                                                 # 톱 튜브
    line(g, 14, 26, 22, 21, 'B'); line(g, 15, 26, 23, 21, 'b')                    # 다운 튜브
    line(g, 14, 26, 7, 25, 'B'); line(g, 10, 19, 7, 25, 'B')                      # 뒤 스테이
    line(g, 22, 20, 20, 16, 'C'); g.px(21, 20, 'C')                              # 스템 위로
    line(g, 23, 21, 25, 25, 'C'); line(g, 24, 21, 26, 25, 'C')                    # 앞 포크
    g.rect(23, 16, 30, 19, 'K')                                                  # 바구니 앞면(그물)
    for x in range(23, 31, 2): g.v(x, 16, 19, 'k')
    g.h(23, 30, 19, 'k')
    g.rect(13, 27, 16, 28, 'n')                                                  # 페달·체인링
    g.h(11, 12, 24, 'C')                                                         # 짐받이 없음: 체인 커버
    g.h(6, 12, 20, 'F'); g.h(7, 11, 21, 'F')                                     # 뒷 흙받이
    g.h(3, 30, 31, '~')                                                          # 접지 그림자
    L = {'t': ('lacq', 1), 'r': ('mmetal', 4), 'h': ('mmetal', 5), 'B': ('mblue', 3), 'b': ('mblue', 4), 'C': ('mmetal', 3), 'M': ('mmetal', 4),
         'k': ('lacq', 2), 'O': ('lacq', 2), 'P': ('lacq', 4), 'S': ('lacq', 3), 's': ('lacq', 2), 'Q': ('mmetal', 5), 'c': ('mmetal', 5), 'K': ('mmetal', 3),
         'n': ('lacq', 1), 'F': ('mblue', 2)}
    return g, L

def garbage_station():
    """쓰레기 집하장 32x32: 폭 29 · 윗면 8 · 앞면 16 — 왼쪽 그물 씌운 집하대, 오른쪽 철제 수거함"""
    g = G(32, 32); x0, x1 = 1, 29
    # 윗면 y8..15 : 그물(초록, 체크 결) / 철제 뚜껑
    g.h(2, 20, 8, 'o'); g.h(22, 29, 8, 'p')
    for y in range(9, 15):
        for x in range(1, 21): g.px(x, y, 'a' if (x + y) % 2 == 0 else 'A')
        for x in range(22, 30): g.px(x, y, 'M')
    g.h(1, 20, 15, 'E'); g.h(22, 29, 15, 'W')                                       # 앞 가장자리 하이라이트
    g.v(1, 9, 14, 'A'); g.v(21, 9, 15, 'z')                                          # 가운데 기둥
    # 앞면 y16..31
    g.h(1, 20, 16, 'g'); g.h(1, 20, 17, 'a')                                         # 그물 드리운 단
    for x in range(1, 21): g.px(x, 18, 'g' if x % 2 else 'a')
    g.h(1, 20, 19, 'F')
    bags = [(2, 5), (8, 6), (15, 5)]
    for bx, bw in bags:                                                               # 흰 봉투 셋
        g.rect(bx, 21, bx + bw - 1, 28, 'w'); g.v(bx, 21, 28, 'W'); g.v(bx + bw - 1, 21, 28, 'x')
        g.px(bx + bw // 2, 20, 'w'); g.px(bx + bw // 2, 19, 'w')                     # 매듭
        g.h(bx, bx + bw - 1, 28, 'x')
    for x in (1, 7, 14, 20): g.v(x, 19, 29, 'F')                                      # 틀 기둥
    g.h(1, 20, 29, 'F'); g.h(1, 20, 30, 'z')
    g.rect(22, 16, 29, 29, 'm'); g.v(22, 16, 29, 'M'); g.v(29, 16, 29, 'n')          # 수거함 앞면
    g.h(23, 28, 20, 'n'); g.h(23, 28, 25, 'n'); g.px(27, 22, 'W'); g.px(27, 23, 'W')  # 문 틈 · 손잡이
    g.h(22, 29, 30, 'z')
    g.h(2, 30, 31, '~')
    L = {'o': ('kgreen', 1), 'a': ('kgreen', 4), 'A': ('kgreen', 3), 'E': ('kgreen', 5), 'g': ('kgreen', 2), 'F': ('kgreen', 1),
         'p': ('mmetal', 1), 'M': ('mmetal', 5), 'W': ('mwhite', 5), 'z': ('mmetal', 0), 'm': ('mmetal', 3), 'n': ('mmetal', 1),
         'w': ('mwhite', 4), 'x': ('mwhite', 2)}
    return g, L

def phone_booth():
    """공중전화 부스 16x48: 폭 13 · 윗면 8 · 앞면 32 — 윗판 + 간판띠 + 유리 + 초록 전화기"""
    g = G(16, 48); x0, x1 = 2, 14
    g.h(3, 13, 8, 'o'); g.rect(2, 9, 14, 14, 'T'); g.h(2, 14, 9, 'U'); g.h(3, 13, 10, 'U')   # 윗판
    g.px(7, 11, 'V'); g.px(8, 11, 'V'); g.h(6, 9, 12, 'V')                          # 환기창 흔적
    g.h(2, 14, 15, 'H')                                                              # 앞 가장자리 하이라이트
    g.rect(2, 16, 14, 18, 'g'); g.h(4, 6, 17, 'w'); g.h(9, 11, 17, 'w')              # 간판띠(초록) TEL
    g.h(2, 14, 19, 'n')
    g.rect(2, 20, 14, 43, 'G'); g.v(2, 20, 43, 'L'); g.v(3, 20, 43, 'L'); g.v(13, 20, 43, 'D'); g.v(14, 20, 43, 'n')    # 유리 + 틀
    g.rect(4, 21, 12, 42, 'e')                                                       # 유리면
    for i in range(6): g.px(5 + i, 22 + i, 'f')                                      # 유리 반사 사선
    for i in range(4): g.px(7 + i, 22 + i, 'f')
    g.rect(5, 26, 11, 37, 'k'); g.v(5, 26, 37, 'K'); g.v(11, 26, 37, 'q')           # 초록 전화기 몸체
    g.rect(6, 27, 10, 29, 'w'); g.px(7, 28, 'k')                                     # 액정·동전창
    g.rect(6, 31, 9, 34, 'q'); g.px(7, 32, 'w'); g.px(9, 32, 'w'); g.px(7, 34, 'w'); g.px(9, 34, 'w')   # 키패드
    g.h(6, 10, 36, 'Y')                                                              # 수화기
    g.h(2, 14, 43, 'n'); g.h(2, 14, 44, 'M'); g.h(2, 14, 45, 'z')                    # 발판
    g.h(2, 14, 46, '~'); g.h(4, 14, 47, '-')
    L = {'o': ('mmetal', 1), 'T': ('mwhite', 5), 'U': ('mwhite', 4), 'V': ('mmetal', 3), 'H': ('mwhite', 5), 'g': ('kgreen', 3),
         'w': ('mwhite', 5), 'n': ('mmetal', 1), 'G': ('mmetal', 3), 'L': ('mmetal', 5), 'D': ('mmetal', 2), 'e': ('mglass', 3), 'f': ('mglass', 5),
         'k': ('kgreen', 2), 'K': ('kgreen', 3), 'q': ('kgreen', 1), 'Y': ('taxi', 4), 'M': ('mmetal', 4), 'z': ('mmetal', 0)}
    return g, L

def bus_stop_jp():
    """버스 정류장 표지 16x48: 폭 10 · 윗면 2 · 앞면 40 — 초록 원판(버스 그림) + 시각표 + 기둥 + 둥근 받침"""
    g = G(16, 48); oy = 6
    g.h(6, 9, oy, 'o'); g.h(5, 10, oy + 1, 'H')                                     # 윗면: 원판 윗 테
    disc = [(4, 11), (3, 12), (3, 12), (3, 12), (3, 12), (3, 12), (3, 12), (4, 11), (5, 10), (6, 9)]
    for i, (a, b) in enumerate(disc):
        y = oy + 2 + i
        for x in range(a, b + 1):
            ring = x in (a, b) or i == 0 or i >= 8
            g.px(x, y, 'w' if ring else 'g')
        if 0 < i < 8: g.px(a + 1, y, 'G')
    ic = oy + 4                                                                      # 버스 그림(흰)
    g.h(5, 10, ic, 'w')                                                              # 지붕
    for x, c in zip(range(5, 11), 'wggggw'): g.px(x, ic + 1, c)                     # 앞유리
    g.h(5, 10, ic + 2, 'w'); g.h(5, 10, ic + 3, 'w')                                 # 차체
    for x, c in zip(range(5, 11), 'gwggwg'): g.px(x, ic + 4, c)                      # 바퀴
    pole(g, 7, oy + 12, 43)
    g.rect(4, 26, 11, 33, 'W'); g.h(4, 11, 26, 'G'); g.h(4, 11, 27, 'g')             # 시각표 판
    for yy in (29, 31): g.h(5, 10, yy, 'x')
    g.h(3, 12, 43, 'M'); g.h(3, 12, 44, 'n')                                        # 받침(추)
    g.h(4, 11, 45, 'z'); g.h(3, 12, 46, '~'); g.h(5, 12, 47, '-')
    L = dict(METAL); L.update({'H': ('mwhite', 5), 'w': ('mwhite', 5), 'g': ('kgreen', 3), 'G': ('kgreen', 4), 'W': ('washi', 5), 'x': ('sumi', 3)})
    return g, L

def standing_sign():
    """입간판 16x32: 폭 10 · 윗면 5 · 앞면 16 — A형 나무틀 + 초록 칠판"""
    g = G(16, 32); oy = 11
    g.h(4, 11, oy, 'o'); g.rect(3, oy + 1, 12, oy + 3, 'T'); g.h(3, 12, oy + 4, 'H')      # 윗면(뒤판 위로 보임)
    g.h(3, 12, oy + 5, 'W')                                                              # 앞 위 레일
    g.rect(3, oy + 6, 12, oy + 16, 'w'); g.v(3, oy + 6, oy + 16, 'L'); g.v(12, oy + 6, oy + 16, 'D')
    g.rect(4, oy + 6, 11, oy + 15, 'c')                                                  # 칠판
    g.h(5, 10, oy + 8, 'x'); g.h(5, 9, oy + 10, 'y'); g.h(5, 10, oy + 12, 'x'); g.px(9, oy + 14, 'y')
    g.h(3, 12, oy + 16, 'D')
    g.v(4, oy + 17, oy + 18, 'w'); g.v(11, oy + 17, oy + 18, 'D')                         # 다리
    g.h(3, 5, 31, '~'); g.h(10, 12, 31, '~')
    L = {'o': ('mwood', 1), 'T': ('mwood', 5), 'H': ('mwood', 5), 'W': ('mwood', 4), 'w': ('mwood', 3), 'L': ('mwood', 4), 'D': ('mwood', 1),
         'c': ('moss', 1), 'x': ('washi', 5), 'y': ('sakura', 4)}
    return g, L

KOMA = [
    "....oooooo......"[:16],
]
def komainu(un):
    """고마이누 16x16: 폭 8 · 윗면 4(갈기 윗면) · 앞면 12(얼굴·가슴·받침)"""
    g = G(16, 16)
    g.h(5, 10, 0, 'o'); g.h(4, 11, 1, 'M'); g.h(4, 11, 2, 'N'); g.h(4, 11, 3, 'H')          # 갈기 윗면
    g.px(4, 1, 'o'); g.px(11, 1, 'o')
    if un:
        g.px(7, 0, 'H'); g.px(8, 0, 'H')                                                    # 뿔
    g.rect(4, 4, 11, 4, 'a'); g.h(4, 11, 4, 'a')                                            # 이마
    g.rect(4, 5, 11, 8, 'b'); g.v(4, 4, 10, 'M'); g.v(11, 4, 10, 'd')
    g.px(5, 5, 'e'); g.px(6, 5, 'e'); g.px(9, 5, 'e'); g.px(10, 5, 'e')                     # 눈썹·눈
    g.px(6, 6, 'k'); g.px(9, 6, 'k')
    g.px(7, 6, 'd'); g.px(8, 6, 'd')                                                        # 코
    if un:
        g.h(6, 9, 8, 'k'); g.h(5, 10, 7, 'a')                                               # 다문 입
    else:
        g.rect(6, 7, 9, 8, 'k'); g.px(6, 7, 'W'); g.px(9, 7, 'W')                          # 벌린 입 + 송곳니
    g.rect(5, 9, 10, 10, 'b'); g.v(7, 9, 10, 'd'); g.v(8, 9, 10, 'd')                       # 가슴 · 앞다리 틈
    g.v(5, 9, 10, 'M'); g.v(10, 9, 10, 'd')
    g.h(4, 11, 11, 'H')                                                                     # 받침 윗가장자리
    g.rect(4, 12, 11, 14, 'p'); g.v(4, 12, 14, 'q'); g.v(11, 12, 14, 'r')
    g.px(6, 13, 'v'); g.px(9, 12, 'v'); g.px(7, 14, 'v')                                    # 이끼
    g.h(4, 11, 14, 'r')
    g.h(3, 12, 15, '~')
    L = {'o': ('ishi', 1), 'M': ('ishi', 5), 'N': ('ishi', 4), 'H': ('ishi', 5), 'a': ('ishi', 3), 'b': ('ishi', 3), 'd': ('ishi', 1),
         'e': ('ishi', 2), 'k': ('sumi', 0), 'W': ('mwhite', 5), 'p': ('ishi', 3), 'q': ('ishi', 4), 'r': ('ishi', 1), 'v': ('moss', 3)}
    return g, L
def komainu_a(): return komainu(False)
def komainu_un(): return komainu(True)

ITEMS = {'vending_drink': vending_drink, 'vending_cig': vending_cig, 'vending_coffee': vending_coffee, 'vending_ice': vending_ice,
         'konbini_pole': konbini_pole, 'ped_signal': ped_signal, 'tomare_sign': tomare_sign, 'jp_signal': jp_signal,
         'mamachari': mamachari, 'garbage_station': garbage_station, 'phone_booth': phone_booth, 'bus_stop_jp': bus_stop_jp,
         'standing_sign': standing_sign, 'komainu_a': komainu_a, 'komainu_un': komainu_un}
def register(slugs):
    """size-std.json 에 v35-A 를 표준 캔버스 후보로 등록(캔버스·칸수·basis 는 size-audit.json 에서)."""
    import json
    base = os.path.abspath(os.path.join(HERE, '..', '..', '..', 'tiledata', 'atlas-pick'))
    audit = json.load(open(os.path.join(base, 'size-audit.json'), encoding='utf-8'))
    au = {x['slug']: x for x in audit['items'] if x['set'] == 'jp'}
    sp = os.path.join(base, 'size-std.json')
    std = json.load(open(sp, encoding='utf-8'))
    jp = std.setdefault('jp', {})
    for sl in slugs:
        b = au[sl]['basis']; cv = b['spec_canvas']
        e = jp.setdefault(sl, {'cells': [cv[0] // 16, cv[1] // 16], 'canvas': cv, 'tags': [],
                               'basis': {k: b[k] for k in ('W', 'D', 'H', 'wpx', 'F', 'T') if k in b}})
        e['basis'].setdefault('table', b.get('table'))
        if 'v35-A' not in e['tags']: e['tags'].append('v35-A')
    json.dump(std, open(sp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); open(sp, 'a').write('\n')

if __name__ == '__main__':
    only = sys.argv[1:] or list(ITEMS)
    for slug in only:
        g, L = ITEMS[slug]()
        if os.environ.get('SHOW'): g.show()
        write(slug, g, L, f'{slug} v35-A 3/4 (1칸=16px=1m)')
    register(only)
