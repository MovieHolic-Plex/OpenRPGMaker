"""r1 자판기 식구(음료 흰·담배·커피) 2×2(32×32) 작도. 색은 (램프, 단)을 손으로 놓는다 — 계산·보간 없음.
공통 치수(r2 도 따른다):
  윤곽 위 y=0 · 윗면 판 y=1..3(3px) · 앞면 x=3..24 · 오른 옆면 x=25..28(4px) · 오른 윤곽 x=29 · 왼 윤곽 x=2
  간판 띠 y=4..6 · 견본 창 틀 x=4..17,y=7..17(유리 x=5..16,y=8..16) · 조작열 x=19..23 · 배출구 y=20..25 · 앞 아랫띠 y=26
  발판 y=27..28 · 그림자 y=29..30(B 는 29..31)
  C(실루엣 재해석)는 머리 간판 상자가 몸통보다 좌우 1px 튀어나오고(x=1..30, y=0..7, 옆면 4px 그대로) 창 2단 큰 견본.
"""
import sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'torii', 'work'))
from j3_lib import Grid, C, sh

def spec(kind, d):
    if kind == 'drink':
        s = dict(body='mwhite', F=2, T=4, S=1, O=('mwhite', 0), OD=('mmetal', 2), hdr=('kblue', 3),
                 glass=('mglass', 5), items=[('kblue', 4), ('akachin', 4), ('washi', 4), ('kgreen', 4)],
                 glow=True, panel=('mwhite', 1), plinth=2)
        if d == 'B': s.update(F=3, T=5, S=0, glass=('mglass', 6), O=('mwhite', 0), OD=('mmetal', 1))
        if d == 'C': s.update(F=2, T=4, S=1, glass=('mglass', 5))
    elif kind == 'cig':
        s = dict(body='sumi', F=2, T=3, S=1, O=('sumi', 1), OD=('sumi', 0), hdr=('taxi', 3),
                 glass=('mdglass', 3), items=[('akachin', 3), ('washi', 4), ('kblue', 3), ('taxi', 3), ('kgreen', 3)],
                 glow=False, panel=('sumi', 1), plinth=1)
        if d == 'B': s.update(F=3, T=5, S=1, glass=('mdglass', 4))
        if d == 'C': s.update(F=2, T=4, S=1)
    else:
        s = dict(body='akachin', F=3, T=4, S=2, O=('akachin', 1), OD=('akachin', 0), hdr=('washi', 4),
                 glass=('mglass', 3), items=[('lacq', 3), ('hinoki', 4), ('korange', 4)],
                 glow=True, panel=('akachin', 2), plinth=1)
        if d == 'B': s.update(F=3, T=5, S=1, O=('akachin', 1), OD=('akachin', 0))
        if d == 'C': s.update(F=3, T=4, S=2)
    s['d'] = d; s['kind'] = kind
    return s

def item(g, x, y, w, h, c, kind, big=False, neck=False):
    """견본: 위 한 줄 밝게, 아래 한 줄 어둡게. 담배는 갑(위 흰 띠)."""
    g.rect(x, y, w, h, c)
    if neck:
        g.px(x, y, None); g.px(x + w - 1, y, None)      # 병 목: 위 줄은 가운데 한 칸
        g.px(x + 1, y, sh(c, 2))
        g.px(x, y + 1, sh(c, 1))
    else:
        g.hl(x, y, w, sh(c, 1))
    g.hl(x, y + h - 1, w, sh(c, -1))
    if kind == 'cig' and h >= 3:
        g.hl(x, y + 1, w, ('washi', 4)) if big else None
    return g

def machine(kind, d):
    s = spec(kind, d)
    g = Grid(32, 32)
    body = s['body']; F = C(body, s['F']); T = C(body, s['T']); S = C(body, s['S'])
    O, OD = s['O'], s['OD']
    hx0, hx1 = (1, 30) if d == 'C' else (2, 29)         # 머리 상자 바깥 윤곽
    hy_sign = 4                                           # 간판 첫 줄
    hh = 4 if d == 'C' else 3                             # 간판 줄 수
    # ── 윗면 판 y=1..3, 윤곽 y=0
    g.hl(hx0 + 1, 0, hx1 - hx0 - 1, O)
    fx0 = hx0 + 1; fx1 = 24 if d != 'C' else 25            # 머리 앞면 끝
    sx0 = fx1 + 1; sx1 = 28 if d != 'C' else 29            # 옆면 x 범위(4px)
    g.hl(fx0, 1, sx1 - fx0 + 1, sh(T, 1))
    g.hl(fx0, 2, sx1 - fx0 + 1, T)
    g.hl(fx0, 3, sx1 - fx0 + 1, T)
    g.px(sx1, 1, T); g.px(sx1, 2, sh(T, -1)); g.px(sx1, 3, sh(T, -1))   # 판 오른 끝만 한 단 어둡게
    g.vl(hx0, 1, hh + 3, O); g.vl(hx1, 1, hh + 3, OD)
    # ── 간판 띠
    H = s['hdr']
    for r in range(hh):
        tone = [1, 0, -1, -2][r] if hh == 4 else [1, 0, -1][r]
        g.hl(fx0, hy_sign + r, fx1 - fx0 + 1, sh(H, tone))
        g.hl(sx0, hy_sign + r, sx1 - sx0 + 1, sh(H, -2 - (1 if r == hh - 1 else 0)))
    # 간판 안 색 띠(글자 없이 색만)
    yy = hy_sign + 1
    if kind == 'drink':
        g.hl(fx0 + 3, yy, 5, ('washi', 4)); g.hl(fx0 + 10, yy, 3, ('akachin', 4)); g.hl(fx0 + 14, yy, 4, ('washi', 4))
    elif kind == 'cig':
        g.hl(fx0 + 3, yy, 6, ('sumi', 1)); g.hl(fx0 + 11, yy, 5, ('sumi', 1)); g.hl(fx0 + 17, yy, 2, ('akachin', 3))
    else:
        g.hl(fx0 + 3, yy, 7, ('akachin', 3)); g.hl(fx0 + 11, yy, 3, ('kblue', 3)); g.hl(fx0 + 15, yy, 4, ('akachin', 3))
    # ── 몸통 앞면·옆면 (머리 아래)
    by0 = hy_sign + hh                                    # 몸통 첫 줄
    if d == 'C':
        # 머리 밑 그늘 한 줄 + 몸통은 x=2..29
        g.hl(3, by0, 22, sh(F, -2))
        g.hl(26, by0, 3, sh(S, -2))
        by0 += 1
    g.rect(3, by0, 22, 26 - by0 + 1, F)
    g.rect(25, by0, 4, 26 - by0 + 1, S)
    if d == 'C': g.hl(26, by0 - 1, 3, sh(S, -2))
    g.vl(3, by0, 26 - by0 + 1, sh(F, 1)); g.vl(24, by0, 26 - by0 + 1, sh(F, -1))   # 앞면 왼 밝게·오른 어둡게
    g.vl(25, by0, 26 - by0 + 1, sh(S, 1)); g.vl(28, by0, 26 - by0 + 1, sh(S, -1))  # 옆면 왼(모서리) 밝게·오른 어둡게
    g.vl(2, by0, 26 - by0 + 1, O); g.vl(29, by0, 26 - by0 + 1, OD)
    g.hl(3, 26, 22, sh(F, -1)); g.hl(25, 26, 4, sh(S, -1))                         # 앞 아랫띠
    # ── 발판 y=27..28
    pl = s['plinth']
    g.hl(3, 27, 22, ('mmetal', 3)); g.hl(25, 27, 4, ('mmetal', 2)); g.px(2, 27, O); g.px(29, 27, OD)
    g.hl(3, 28, 22, ('mmetal', 1)); g.hl(25, 28, 4, ('mmetal', 0)); g.px(2, 28, sh(O, -1) if d != 'C' else O); g.px(29, 28, OD)
    # ── 견본 창
    fr = ('mmetal', 3) if kind != 'cig' else ('mmetal', 2)
    wy = by0 + (0 if d == 'C' else 0)
    if d != 'C': wy = 7
    else: wy = 9 - 1 + 1 - 1 + 0 + 0
    if d == 'C': wy = 9 - 1                               # 8 → 글씨: C 는 간판이 한 줄 두꺼워 by0=9 이므로 창은 y=9 부터
    if d == 'C': wy = by0
    gh = 9
    g.rect(4, wy, 14, gh + 2, fr)
    g.hl(4, wy, 14, sh(fr, 2)); g.hl(4, wy + gh + 1, 14, sh(fr, -1)); g.vl(17, wy, gh + 2, sh(fr, -1))
    gy0 = wy + 1
    glass = s['glass']
    g.rect(5, gy0, 12, gh, glass)
    if kind == 'coffee':
        # 위 두 줄 = 차가운 칸(파란 기운), 아래 한 줄 = 따뜻한 칸(누런 바탕)
        pass
    def cols():
        return [6, 9, 12, 15]
    if d != 'C':
        for r in range(3):
            y = gy0 + r * 3
            if kind == 'coffee' and r == 2:
                g.rect(5, y, 12, 3, C('korange', 1))
            for k, x in enumerate(cols()):
                if kind == 'coffee':
                    c = [('kblue', 4), ('washi', 4), ('lacq', 3), ('hinoki', 4)][(k + r) % 4] if r < 2 else [('korange', 4), ('hinoki', 4), ('lacq', 3), ('korange', 4)][k % 4]
                else:
                    c = s['items'][(k + r) % len(s['items'])]
                item(g, x, y, 2, 3, c, kind)
                if kind == 'cig' and (k + r) % 2: g.px(x + 1, y + 1, sh(c, -2))
        # 값표 띠 y=18
        for x in range(5, 17):
            g.px(x, 18, ('washi', 3) if x % 2 else sh(F, -1))
    else:
        for r in range(2):
            y = gy0 + r * 5
            if kind == 'coffee' and r == 1:
                g.rect(5, y - 1, 12, 5, C('korange', 1))
            for k, x in enumerate([6, 10, 14]):
                if kind == 'coffee':
                    c = [('kblue', 4), ('washi', 4), ('lacq', 3)][(k + r) % 3] if r == 0 else [('korange', 4), ('hinoki', 4), ('lacq', 3)][k % 3]
                else:
                    c = s['items'][(k + r) % len(s['items'])]
                item(g, x, y, 3, 4, c, kind, big=True, neck=(kind == 'drink'))
        g.hl(5, gy0 + 4, 12, sh(fr, 1))                    # 가운데 선반 (y=gy0+4)
    # ── 조작열 x=19..23
    P = s['panel']
    cy = wy
    g.rect(19, cy, 5, 26 - cy, C(*P))
    g.vl(19, cy, 26 - cy, sh(C(*P), -1))
    disp = ('neonc', 4) if kind != 'cig' else ('kgreen', 4)
    g.rect(20, cy + 1, 3, 2, ('lacq', 1)); g.hl(20, cy + 1, 3, disp); g.px(22, cy + 2, sh(disp, -2))
    if kind == 'coffee':
        bc = [('kblue', 4), ('kblue', 4), ('akachin', 5), ('akachin', 5)]
    elif kind == 'drink':
        bc = [('kblue', 4), ('akachin', 4), ('kblue', 4), ('akachin', 4)]
    else:
        bc = [('washi', 4), ('washi', 4), ('washi', 4), ('washi', 4)]
    for i in range(4):
        bx = 20 + (i % 2) * 2; by = cy + 4 + (i // 2) * 3
        g.rect(bx, by, 2, 2, bc[i]); g.px(bx, by, sh(bc[i], 1)); g.hl(bx, by + 1, 2, sh(bc[i], -1))
    g.hl(20, cy + 10, 4, ('mmetal', 6)); g.hl(20, cy + 11, 4, ('mmetal', 3)); g.hl(21, cy + 11, 2, ('lacq', 0))   # 동전 구멍
    g.hl(20, cy + 13 if d != 'C' else cy + 13, 4, ('mmetal', 5)); g.hl(20, cy + 14, 4, ('lacq', 0))                 # 지폐 구멍
    # ── 배출구
    dy = 20
    g.hl(4, dy, 14, fr); g.hl(4, dy, 14, sh(fr, 2))
    g.rect(5, dy + 1, 12, 5, ('lacq', 0))
    g.hl(5, dy + 1, 12, ('lacq', 3)); g.hl(5, dy + 2, 12, ('lacq', 2))                  # 덮개(위로 젖힘)
    g.vl(4, dy + 1, 5, sh(fr, 1)); g.vl(17, dy + 1, 5, sh(fr, -2))
    g.rect(20, 23, 4, 3, ('lacq', 0)); g.hl(20, 23, 4, ('mmetal', 5)); g.hl(20, 24, 4, ('lacq', 2))   # 거스름돈 받침
    # ── 그림자 / 불빛
    glow = s['glow'] and d == 'B'
    if d == 'B':
        if glow:
            g.hl(4, 29, 10, '%'); g.hl(6, 30, 6, '%')
            g.hl(14, 29, 18, '~'); g.hl(12, 30, 20, '~'); g.hl(18, 31, 14, '-')
        else:
            g.hl(3, 29, 29, '~'); g.hl(5, 30, 27, '~'); g.hl(8, 31, 24, '-')
    else:
        g.hl(4, 29, 28, '~'); g.hl(6, 30, 26, '-')
    return g

NOTES = {
 ('drink', 'A'): '강남 자판기 결: 흰 몸통 앞면 2단·윗면 판 3px 4~5단·오른 옆면 4px 한 단 어둡게. 파란 간판 띠, 견본 3줄(파랑·빨강·흰·초록), 오른 조작열, 아래 배출구, 발치 그림자 2줄',
 ('drink', 'B'): '명암 강화: 앞면 3단·윗면 5단·옆면 0단, 유리 한 단 밝게, 유리 불빛 %가 왼쪽 바닥에 번지고 오른쪽에 접지 그림자 3줄',
 ('drink', 'C'): '실루엣 재해석: 파란 머리 간판 상자가 몸통보다 좌우 1px 튀어나오고 병 목이 보이는 큰 견본 2단(3×4)',
 ('cig', 'A'): '강남 자판기 결: 갈색 몸통 앞면 2단·윗면 판 3단·옆면 1단, 노란 간판 띠, 어두운 유리에 담뱃갑 3줄, 초록 표시창, 흰 버튼 4개',
 ('cig', 'B'): '명암 강화: 앞면 3단·윗면 5단, 유리 한 단 밝게, 접지 그림자 3줄(불빛 번짐 없음: 담배 자판기는 불이 죽어 있다)',
 ('cig', 'C'): '실루엣 재해석: 노란 머리 간판 상자가 좌우 1px 튀어나오고 담뱃갑 3×4 큰 견본 2단',
 ('coffee', 'A'): '강남 자판기 결: 붉은 몸통, 흰 간판 띠, 견본 위 두 줄 차가운 파란 칸·아래 한 줄 따뜻한 누런 칸, 조작열 위 파란 두 버튼·아래 붉은 두 버튼(つめた/あったか)',
 ('coffee', 'B'): '명암 강화: 붉은 앞면 3단·윗면 5단·옆면 1단, 따뜻한 칸 불빛 %가 바닥에 번지고 접지 그림자 3줄',
 ('coffee', 'C'): '실루엣 재해석: 흰 머리 간판 상자가 좌우 1px 튀어나오고 캔 3×4 큰 견본 2단(위 파랑 차가운 칸·아래 누런 따뜻한 칸)',
}
FAM = {
 'A': ' || 식구 공통(r2 는 이대로): 32×32, 윗면 판 3px(y=1..3)·앞면 x=3..24·오른 옆면 4px(x=25..28)·간판 띠 3줄(y=4..6)·견본 창 x=4..17·조작열 x=19..23·배출구 y=20..25·발판 2줄·접지 그림자 2줄',
 'B': ' || 식구 공통(r2 는 이대로): A 와 같은 치수, 그림자만 3줄(y=29..31)+왼쪽 불빛 번짐 %; 톤은 윗면 5단·앞면 3단',
 'C': ' || 식구 공통(r2 는 이대로): 머리 간판 상자 x=1..30·y=0..7(4줄), 몸통 y=9..26, 옆면 4px, 나머지 A 와 같음',
}
if __name__ == '__main__':
    slugs = {'drink': 'vending_drink', 'cig': 'vending_cig', 'coffee': 'vending_coffee'}
    kinds = sys.argv[1:] or list(slugs)
    for k in kinds:
        for d in 'ABC':
            p = os.path.abspath(os.path.join(HERE, '..', '..', slugs[k], f'r1-{d}.pxg'))
            machine(k, d).emit(p, NOTES[(k, d)] + FAM[d], header=f'{slugs[k]} r1-{d}')
