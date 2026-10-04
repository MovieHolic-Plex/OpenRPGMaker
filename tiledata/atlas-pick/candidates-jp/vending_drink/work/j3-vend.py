"""자판기 쌍(음료·담배) 공용 작도. 같은 방향 글자면 높이·명암 방식이 같다."""
import sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'torii', 'work'))
from j3_lib import Grid, C
def sh(c, d): return (c[0], max(0, min(len(_L[c[0]])-1, c[1]+d)))
_L = {'mwhite': range(6), 'sumi': range(6), 'mglass': range(8), 'mdglass': range(8), 'mmetal': range(8), 'lacq': range(7),
      'kblue': range(6), 'akachin': range(7), 'kgreen': range(6), 'korange': range(6), 'washi': range(6), 'taxi': range(6), 'neon': range(6), 'ai': range(7)}
CANS = [C('kblue', 4), C('akachin', 4), C('washi', 4), C('kgreen', 4)]
def can(g, x, y, c, hi=True):
    g.rect(x, y, 2, 3, c)
    g.px(x, y, sh(c, 1) if hi else c)
    g.hl(x, y+2, 2, sh(c, -1))
def pack(g, x, y, c, k):
    g.rect(x, y, 2, 2, c)
    g.px(x, y, sh(c, 1))
    if k % 3 == 0: g.px(x+1, y+1, sh(c, -2))
def machine(kind, d):
    g = Grid(16, 32)
    drink = kind == 'drink'
    body = 'mwhite' if drink else 'sumi'
    # 방향별 단
    P = {'A': dict(front=2, top=3, side=1, edge=0, lit=None),
         'B': dict(front=3, top=5, side=0, edge=0, lit=4),
         'C': dict(front=2, top=4, side=1, edge=0, lit=3)}[d]
    if not drink:
        P = {'A': dict(front=2, top=3, side=1, edge=1, lit=None),
             'B': dict(front=4, top=5, side=1, edge=1, lit=5),
             'C': dict(front=3, top=4, side=2, edge=1, lit=4)}[d]
    F = C(body, P['front']); T = C(body, P['top']); S = C(body, P['side']); O = C(body, P['edge'])
    if drink: O = C('mmetal', 2) if d == 'B' else C('mwhite', 0)
    OD = sh(O, -1) if not drink else C('mmetal', 1)   # 오른쪽·아래 윤곽은 한 단 더 어둡게
    if d == 'C':
        # 머리 간판이 몸통보다 넓은 실루엣
        x0, x1 = 2, 13   # 몸통 바깥 윤곽
        g.rect(1, 1, 14, 6, T)                    # 머리 상자
        g.hl(1, 1, 14, sh(T, 1)) if T[1] < 5 else None
        g.px(1, 1, None); g.px(14, 1, None)       # 위 모서리 깎기
        g.px(1, 2, sh(O, 0)); 
        head = [C('kblue', 4), C('washi', 4), C('akachin', 4)] if drink else [C('taxi', 3), C('sumi', 1), C('taxi', 4)]
        g.hl(2, 2, 12, head[0]); g.hl(2, 3, 12, head[1]); g.hl(2, 4, 12, head[2])
        if not drink: g.hl(2, 3, 12, C('sumi', 1))
        g.hl(1, 5, 14, C('mmetal', 2) if drink else C('sumi', 3)); g.hl(1, 6, 14, OD)
        g.vl(1, 2, 4, O); g.vl(14, 2, 4, OD)
        g.hl(2, 1, 12, O)
        fx0, fx1 = 2, 11   # 앞면
        g.rect(fx0, 7, 10, 21, F); g.rect(12, 7, 2, 21, S)
        g.vl(fx0-1, 7, 21, O); g.vl(14, 7, 21, OD)
        g.vl(fx0, 7, 21, sh(F, 1)); g.vl(13, 7, 21, sh(S, -1))
        wy0 = 8
    else:
        fx0, fx1 = 1, 12
        g.rect(1, 2, 14, 2, T); g.hl(1, 2, 14, sh(T, 1)); g.hl(1, 1, 14, O)
        g.hl(1, 3, 14, T)
        g.rect(fx0, 4, 12, 24, F); g.rect(13, 4, 2, 24, S)
        g.vl(0, 2, 28, O); g.vl(15, 2, 28, OD)
        g.vl(fx0, 4, 24, sh(F, 1) if P['lit'] is None else C(body, P['lit']))
        g.vl(14, 4, 24, sh(S, -1))
        g.px(0, 1, None); g.px(15, 1, None)
        g.hl(1, 4, 12, sh(F, -1))      # 윗단 이음선
        wy0 = 5
    # 창
    fr = C('mmetal', 2) if drink else C('mmetal', 1)
    gx0 = 3; gy0 = wy0 + 1
    rows = 3 if d != 'C' else 2
    gh = rows*4 - 1
    g.rect(gx0-1, wy0, 10, gh+2, fr)
    glass = (C('mglass', 6) if d == 'B' else C('mglass', 5)) if drink else (C('mdglass', 3) if d != 'B' else C('mdglass', 4))
    if d == 'C' and drink: glass = C('mglass', 5)
    g.rect(gx0, gy0, 8, gh, glass)
    g.hl(gx0-1, wy0, 10, sh(fr, 2))          # 창틀 윗변 밝게
    g.hl(gx0-1, wy0+gh+1, 10, sh(fr, -1))
    for r in range(rows):
        yy = gy0 + r*4
        for k in range(4):
            if drink:
                cc = CANS[(k + r) % 4]
                can(g, gx0 + k*2, yy, cc)
            else:
                pk = [C('akachin', 3), C('washi', 4), C('kblue', 3), C('taxi', 3), C('kgreen', 3)]
                pass
        if r < rows-1: g.hl(gx0, yy+3, 8, sh(fr, 1) if drink else fr)
    if not drink:
        # 담뱃갑 5열 (2×2, 사이 1칸 띄움 대신 열 붙임)
        g.rect(gx0, gy0, 8, gh, glass)
        pk = [C('akachin', 3), C('washi', 4), C('kblue', 3), C('taxi', 3), C('kgreen', 3)]
        for r in range(rows):
            yy = gy0 + r*4
            for k in range(4):
                cc = pk[(k*2 + r) % 5]
                g.rect(gx0 + k*2, yy, 2, 3, cc)
                g.px(gx0 + k*2, yy, sh(cc, 1)); g.hl(gx0 + k*2, yy+2, 2, sh(cc, -2))
                if (k + r) % 2: g.px(gx0 + k*2 + 1, yy + 1, sh(cc, -2))
            if r < rows-1: g.hl(gx0, yy+3, 8, fr)
    yb = wy0 + gh + 3
    if d == 'C':
        # 아래 몸통: 단순 — 버튼 줄 + 배출구
        by = yb
        g.rect(4, by, 2, 2, C('kblue', 3)); g.px(4, by, C('kblue', 5))
        g.rect(7, by, 2, 2, C('akachin', 3)); g.px(7, by, C('akachin', 5))
        g.rect(10, by, 1, 2, C('lacq', 2)); g.px(10, by, C('kgreen', 4)) if drink else g.px(10, by, C('taxi', 4))
        oy = 21
        g.hl(4, oy, 6, C('mmetal', 5)); g.rect(4, oy+1, 6, 3, C('lacq', 0)); g.hl(4, oy+1, 6, C('lacq', 2))
        g.rect(2, 26, 10, 2, sh(F, -1)) if False else None
        g.hl(2, 28, 12, C('mmetal', 1)); g.hl(2, 29, 12, C('mmetal', 2)); g.px(1, 28, None)
        # 발
        g.vl(1, 28, 2, O); g.vl(14, 28, 2, OD)
        by_bottom = 29
    else:
        by = 19
        # 버튼 줄
        for i, cc in enumerate([C('kblue', 3), C('akachin', 3)]):
            g.rect(3 + i*3, by, 2, 2, cc); g.px(3 + i*3, by, sh(cc, 2))
        g.rect(9, by, 3, 2, C('lacq', 1)); g.px(10, by, C('akachin', 4) if drink else C('kgreen', 4)); g.px(11, by, C('akachin', 5) if drink else C('kgreen', 4))
        # 돈 넣는 자리
        g.rect(3, 22, 5, 2, C('mmetal', 3)); g.hl(3, 22, 5, C('mmetal', 6)); g.hl(4, 23, 3, C('lacq', 0))
        g.rect(9, 22, 3, 2, C('mmetal', 3)); g.hl(9, 22, 3, C('mmetal', 6)); g.px(10, 23, C('lacq', 0))
        # 배출구
        g.hl(3, 25, 9, C('mmetal', 5)); g.rect(3, 26, 9, 2, C('lacq', 0)); g.hl(3, 26, 9, C('lacq', 2))
        g.px(3, 25, C('mmetal', 4)); 
        # 굽
        g.hl(1, 28, 14, C('mmetal', 1)); g.hl(1, 29, 14, C('mmetal', 2))
        g.vl(0, 28, 2, O); g.vl(15, 28, 2, OD)
        g.px(13, 28, C('mmetal', 0)); g.px(14, 28, C('mmetal', 0))
    # 그림자·빛
    if d == 'A':
        g.hl(2, 30, 13, '~'); g.hl(4, 31, 11, '-')
    elif d == 'B':
        if drink:
            g.hl(1, 30, 6, '%'); g.hl(2, 31, 4, '%')
            g.hl(7, 30, 9, '~'); g.hl(9, 31, 7, '-')
        else:
            g.hl(2, 30, 14, '~'); g.hl(3, 31, 12, '~'); g.hl(5, 31, 11, '-') if False else None
    else:
        g.hl(3, 30, 12, '~'); g.hl(6, 31, 9, '-')
    return g
if __name__ == '__main__':
    kind = sys.argv[1]
    outd = os.path.abspath(os.path.join(HERE, '..'))
    notes = {'drink': {'A': '강남 자판기 결(옆면 한 단 어둡게, 윗면 밝게, 윗단 유리 속 캔 세 줄)로 흰 몸통 음료 자판기를 찍음',
                       'B': '윗면 5단·앞면 3단·옆면 0단으로 명암 대비를 크게, 유리 불빛 %가 왼쪽 바닥에 번지고 오른쪽 아래에 접지 그림자',
                       'C': '머리 간판(파랑·흰·빨강 띠)이 몸통보다 넓은 실루엣, 캔 두 줄의 굵은 창으로 한눈에 읽게'},
             'cig': {'A': '강남 자판기 결로 갈색 몸통 담배 자판기, 견본 창은 어두운 유리에 갑 격자',
                     'B': '윗면 5단·앞면 3단·옆면 1단 명암 대비, 접지 그림자 2줄, 견본 갑 밝게',
                     'C': '노란 띠 머리 간판이 몸통보다 넓은 실루엣, 갑 두 줄의 굵은 창'}}[kind]
    slug = 'vending_drink' if kind == 'drink' else 'vending_cig'
    for d in 'ABC':
        p = os.path.join(HERE, '..', '..', slug, f'j3-{d}.pxg')
        machine(kind, d).emit(os.path.abspath(p), notes[d], header=f'{slug} j3-{d}')
