#!/usr/bin/env python3
"""kit_pole v34-A (3/4 재작도, k10-A 기반) — 부품 11개. 윗면(밝은 단)+앞면(본색)+밑 그림자.
원본 k10: 단은 손으로 놓는다(보간·잡음 없음).
  python3 tiledata/atlas-pick/candidates-jp/kit_pole/work/v34_draw.py   # → ../v34-A.pxg
계약: 기둥 x=6..10 (모든 기둥 부품 같은 명암) · 전선 y=4/7/10 (arm_l·arm_r·wire_m) · wire_dip 끝 높이 같음.
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); KIT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(HERE, '..', '..', '..', '..', '..', 'scripts', 'content', 'atlas-pick'))
from pxg_emit import emit

info = json.load(open(os.path.join(KIT, 'info.json'), encoding='utf-8'))
W, H = info['canvas']; AT = {p['slug']: (p['at'][0] * 16, p['at'][1] * 16) for p in info['parts']}

def k(r, t): return (r, t)

# 기둥 열별 명암(왼쪽 위 빛). 모든 기둥 부품이 같은 표를 쓴다.
SH = {'A': {6: 4, 7: 3, 8: 3, 9: 2, 10: 1},
      'B': {6: 5, 7: 4, 8: 2, 9: 1, 10: 0},
      'C': {6: 3, 7: 5, 8: 4, 9: 2, 10: 1}}
# 전선 높이
WY = (4, 7, 10)

def build(V):
    G = [[None] * W for _ in range(H)]
    T = SH[V]

    class P:
        def __init__(s, slug): s.ox, s.oy = AT[slug]
        def px(s, x, y, c):
            if 0 <= x < 16 and 0 <= y < 16 or (0 <= x < 16 and slug_tall(s)): G[s.oy + y][s.ox + x] = c
        def rect(s, x, y, w, h, c):
            for j in range(y, y + h):
                for i in range(x, x + w): s.px(i, j, c)
        def hl(s, x0, x1, y, c):
            for i in range(x0, x1 + 1): s.px(i, y, c)
        def vl(s, x, y0, y1, c):
            for j in range(y0, y1 + 1): s.px(x, j, c)
    def slug_tall(s): return getattr(s, 'tall', False)

    def shaft(p, y0, y1):
        for y in range(y0, y1 + 1):
            for x in range(6, 11): p.px(x, y, k('pole', T[x]))

    def insul(p, x, y, big=False):
        """애자: 2칸 폭. 왼쪽 밝고 오른쪽 어둡다. (x,y)=좌상단, 높이 2."""
        p.px(x, y, k('mwhite', 5)); p.px(x + 1, y, k('mwhite', 3))
        p.px(x, y + 1, k('mwhite', 2)); p.px(x + 1, y + 1, k('mwhite', 0 if V != 'B' else 0))
        if big:
            p.px(x, y - 1, k('mwhite', 3)); p.px(x + 1, y - 1, k('mwhite', 1))

    def arm(p, x0, x1, y, thick=2):
        """가로대: 윗줄 밝고 아랫줄 어둡다."""
        hi, lo = (7, 3)
        p.hl(x0, x1, y, k('mmetal', hi))
        p.hl(x0, x1, y + 1, k('mmetal', lo))
        if thick == 3:
            p.hl(x0, x1, y + 2, k('mmetal', 1))

    # ── pole_top ──
    p = P('pole_top')
    # 끝 마개
    if V == 'C':
        p.px(8, 0, k('pole', 3)); p.hl(7, 9, 1, k('pole', 4)); p.px(7, 1, k('pole', 5)); p.px(9, 1, k('pole', 2))
        p.hl(6, 10, 2, None)
        for x in range(6, 11): p.px(x, 2, k('pole', T[x]))
    else:
        # 3/4: 기둥 머리 = 윗면 판(밝은 단, 뒤 끝선) + 앞 모서리 + 립 그림자
        for x in range(7, 10): p.px(x, 0, k('pole', 2))
        for x in range(6, 10): p.px(x, 1, k('pole', 5)); p.px(x, 2, k('pole', 5 if x < 9 else 4))
        p.px(10, 1, k('pole', 3)); p.px(10, 2, k('pole', 3))
        for x in range(6, 11): p.px(x, 3, k('pole', 1))
    shaft(p, 4, 15)
    # 가로대 (윗대 y=5..6 · 아랫대 y=8..9) — 좌우 끝까지(arm_l/arm_r 로 이어진다)
    arm(p, 0, 15, 5)
    if V != 'C':
        arm(p, 0, 15, 8)
    else:
        # C: 아랫대 없이 버팀 사선
        for i, (x, y) in enumerate(((5, 7), (4, 8), (3, 9))): p.px(x, y, k('mmetal', 3))
        for i, (x, y) in enumerate(((11, 7), (12, 8), (13, 9))): p.px(x, y, k('mmetal', 2))
        for x, y in ((5, 8), (4, 9)): p.px(x, y, k('mmetal', 1))
        for x, y in ((11, 8), (12, 9)): p.px(x, y, k('mmetal', 0))
    # 볼트
    p.px(8, 5, k('mmetal', 1)); p.px(8, 6, k('mmetal', 0))
    if V != 'C': p.px(8, 8, k('mmetal', 1)); p.px(8, 9, k('mmetal', 0))
    # 정수리 애자(가운데 핀 애자)
    if V == 'A':
        pass

    # ── arm_l / arm_r (over) ──
    def arms(slug, right):
        p = P(slug)
        def X(x): return 15 - x if right else x
        def hline(xa, xb, y, c):
            a, b = sorted((X(xa), X(xb)))
            p.hl(a, b, y, c)
        def wire(y, xa, xb):
            wc = {'A': k('lacq', 3), 'B': k('lacq', 2), 'C': k('lacq', 3)}[V]
            hline(xa, xb, y, wc)
            if V == 'C':
                hline(xa, xb, y + 1, k('lacq', 1))
            if V == 'B':
                for x in range(min(xa, xb), max(xa, xb) + 1):
                    if x % 8 == 3: p.px(X(x), y, k('lacq', 5))
        def ins(x, y, big=False):
            # 애자 x 는 안쪽(기둥 쪽) 열, 폭 2. 왼쪽 밝은 화소가 왼쪽에 오도록 실제 좌표로.
            a = X(x) if not right else X(x) - 1
            insul(p, a, y, big)
        # 가로대 (기둥 쪽 끝 = x 큰 쪽)
        if V == 'C':
            arm_rng_u = (6, 15); arm_rng_l = None
        else:
            arm_rng_u = (9, 15); arm_rng_l = (11, 15)
        def armseg(a, b, y, th=2):
            aa, bb = sorted((X(a), X(b)))
            arm(p, aa, bb, y, th)
        armseg(*arm_rng_u, 5)
        if arm_rng_l: armseg(*arm_rng_l, 8)
        # 애자·전선
        if V == 'C':
            wire(4, 0, 7); ins(6, 3)
            wire(7, 0, 10); ins(9, 7)
            wire(10, 0, 13); ins(12, 7); p.px(X(12) if not right else X(12) - 1, 9, k('mwhite', 3))
            # 매단 줄(애자 열)
            xs = (X(12), X(13)); 
            a = X(12) if not right else X(12) - 1
            p.px(a, 9, k('mwhite', 3)); p.px(a + 1, 9, k('mwhite', 1)); p.px(a, 10, k('mwhite', 2)); p.px(a + 1, 10, k('mwhite', 0))
            wire(10, 0, 13 if not right else 13)
        else:
            wire(4, 0, 10); ins(9, 3)
            wire(7, 0, 10); ins(9, 7)
            wire(10, 0, 12); ins(11, 10)
        return p
    arms('arm_l', False)
    arms('arm_r', True)

    # ── pole (repeat y) ──
    p = P('pole')
    shaft(p, 0, 15)
    # 발판 볼트: 오른쪽 y=4, 왼쪽 y=11 (위아래 끝 줄은 매끈)
    p.px(11, 4, k('pole', 1)); p.px(12, 4, k('pole', 0 if V == 'B' else 1))
    p.px(5, 11, k('pole', 4 if V != 'B' else 5)); p.px(4, 11, k('pole', 3))
    if V == 'B':
        p.px(11, 3, k('pole', 3))      # 볼트 머리 빛
    if V == 'C':
        # 콘크리트 이음 고리: 굵은 줄(y=8)
        for x in range(6, 11): p.px(x, 8, k('pole', max(0, T[x] - 1)))

    # ── trans ──
    p = P('trans')
    shaft(p, 0, 15)
    # 변압기 통: x=11..15
    def tank(y0, y1, tone_cols):
        for y in range(y0, y1 + 1):
            for i, x in enumerate(range(11, 16)): p.px(x, y, k('mmetal', tone_cols[i]))
    if V == 'A':
        # 3/4: 뚜껑 윗면(y3~5 밝은 판, 뒤 끝선 y2) → 앞 모서리 하이라이트 y6 → 판 밑 그림자 y7 → 앞면 y8~13 → 밑선 y14
        tank(8, 13, [5, 4, 4, 3, 1])
        p.hl(11, 15, 14, k('mmetal', 0)); p.hl(12, 14, 2, k('mmetal', 1))
        for y in (3, 4, 5):
            for x in range(11, 16): p.px(x, y, k('mmetal', 7 if x < 15 else 5))
        p.hl(11, 15, 6, k('mmetal', 6)); p.px(15, 6, k('mmetal', 4))
        p.hl(11, 15, 7, k('mmetal', 1))
        for x in range(11, 16): p.px(x, 10, k('mmetal', 2 if x < 15 else 0))
        p.px(13, 0, k('mwhite', 5)); p.px(13, 1, k('mwhite', 3)); p.px(13, 2, k('mwhite', 1))
        p.hl(12, 15, 15, '~')
    elif V == 'B':
        tank(3, 12, [7, 5, 3, 2, 1])
        p.hl(12, 14, 2, k('mmetal', 5))
        p.hl(11, 15, 3, k('mmetal', 7)); p.hl(11, 15, 12, k('mmetal', 0))
        for x in range(11, 16): p.px(x, 7, k('mmetal', max(0, [7, 5, 3, 2, 1][x - 11] - 2)))
        p.px(13, 1, k('mwhite', 5)); p.px(13, 2, k('mwhite', 2))
        # 그림자 (통 밑·오른쪽)
        p.hl(12, 15, 13, '~'); p.hl(13, 15, 14, '-')
    else:
        # C: 키 큰 항아리형 — 뚜껑 넓게, 리브 3줄
        tank(3, 13, [6, 6, 4, 3, 1])
        p.hl(11, 15, 2, k('mmetal', 5)); p.hl(11, 15, 3, k('mmetal', 7))
        p.hl(12, 14, 1, k('mmetal', 4)); p.px(13, 0, k('mwhite', 3)); p.px(13, 1, k('mmetal', 3))
        for y in (6, 8, 10):
            for x in range(11, 16): p.px(x, y, k('mmetal', max(0, [6, 6, 4, 3, 1][x - 11] - 3)))
        p.hl(11, 15, 13, k('mmetal', 0)); p.hl(12, 14, 14, k('mmetal', 1))

    # ── pole_tag ──
    p = P('pole_tag')
    shaft(p, 0, 15)
    # 이름판 x=7..9,y=2..4
    p.rect(7, 2, 3, 3, k('ai', 3)); p.hl(7, 9, 2, k('ai', 6)); p.vl(7, 3, 4, k('ai', 4)); p.hl(7, 9, 4, k('ai', 2)); p.vl(9, 3, 4, k('ai', 1)); p.hl(7, 9, 1, k('ai', 0)); p.px(9, 2, k('ai', 4))
    p.px(8, 3, k('mwhite', 5))
    if V == 'B': p.px(7, 2, k('mwhite', 5))
    # 노랑·검정 띠 y=8..13
    yl = {6: 5, 7: 4, 8: 4, 9: 3, 10: 2}; bk = {6: 4, 7: 3, 8: 3, 9: 2, 10: 1}
    if V == 'B': yl = {6: 5, 7: 5, 8: 3, 9: 2, 10: 1}; bk = {6: 3, 7: 2, 8: 1, 9: 1, 10: 0}
    for y in range(8, 14):
        for x in range(6, 11):
            if V == 'C':
                on = ((x + y) // 3) % 2 == 0
            else:
                on = ((x + y) // 2) % 2 == 0
            p.px(x, y, k('taxi', yl[x]) if on else k('lacq', bk[x]))

    # ── pole_lamp ──
    p = P('pole_lamp')
    shaft(p, 0, 15)
    if V == 'A':
        # 3/4: 갓 윗면(밝은 판 2행 + 뒤 끝선) → 갓 앞면 → 등 유리
        p.hl(12, 14, 1, k('mmetal', 1))
        p.hl(11, 14, 2, k('mmetal', 7)); p.hl(11, 15, 3, k('mmetal', 7)); p.px(15, 3, k('mmetal', 5))
        p.hl(11, 15, 4, k('mmetal', 6)); p.px(15, 4, k('mmetal', 4))
        p.hl(11, 15, 5, k('mmetal', 3)); p.px(15, 5, k('mmetal', 1))
        p.hl(12, 15, 6, k('washi', 5)); p.hl(12, 15, 7, k('washi', 4)); p.hl(12, 15, 8, k('mmetal', 2))
        p.px(15, 6, k('washi', 3)); p.px(15, 7, k('washi', 2))
        for x, y in ((12, 9), (13, 9), (14, 9), (15, 9), (13, 10), (14, 10), (15, 10), (14, 11)): p.px(x, y, '%')
    elif V == 'B':
        p.hl(11, 14, 3, k('mmetal', 6)); p.hl(11, 14, 4, k('mmetal', 2))
        p.hl(12, 15, 5, k('mmetal', 5)); p.hl(12, 15, 6, k('washi', 5)); p.hl(12, 15, 7, k('washi', 3)); p.hl(12, 15, 8, k('mmetal', 1))
        p.px(15, 5, k('mmetal', 1)); p.px(15, 6, k('washi', 2)); p.px(15, 7, k('washi', 1))
        for y, xs in ((9, range(11, 16)), (10, range(11, 16)), (11, range(12, 16)), (12, range(12, 16)), (13, range(13, 16)), (14, range(14, 16))):
            for x in xs: p.px(x, y, '%')
        # 기둥 쪽 벽에 번지는 빛
        p.px(11, 6, '%'); p.px(11, 7, '%')
    else:
        # C: 백조목 팔 + 원뿔 갓
        p.px(11, 3, k('mmetal', 4)); p.hl(11, 13, 2, k('mmetal', 5)); p.px(14, 3, k('mmetal', 3)); p.px(14, 4, k('mmetal', 2))
        p.hl(11, 15, 5, k('mmetal', 5)); p.hl(12, 15, 6, k('mmetal', 3)); p.hl(13, 15, 7, k('mmetal', 1))
        p.hl(12, 15, 8, k('washi', 4)); p.hl(13, 15, 9, k('washi', 3))
        for x, y in ((12, 10), (13, 10), (14, 10), (15, 10), (13, 11), (14, 11), (15, 11)): p.px(x, y, '%')

    # ── pole_base ──
    p = P('pole_base')
    if V == 'A':
        # 3/4: 콘크리트 받침 = 윗면 판(y8~10, 가장 밝음) + 앞 모서리 하이라이트 y11 + 앞면 y12~14 + 밑선 y15 + 바닥 그림자
        shaft(p, 0, 8)
        for x in range(4, 13): p.px(x, 7 if False else 9, k('pole', 5 if x < 11 else 4))
        for x in range(4, 13): p.px(x, 10, k('pole', 5 if x < 11 else 4))
        for x in range(5, 12): p.px(x, 8, k('pole', 2))          # 뒤 끝선: 기둥이 판에 박히는 자리
        p.hl(3, 12, 11, k('pole', 5)); p.px(12, 11, k('pole', 4))
        for x in range(3, 13): p.px(x, 12, k('pole', 3 if x < 6 else 2 if x < 12 else 1))
        for x in range(3, 13): p.px(x, 13, k('pole', 3 if x < 6 else 2 if x < 12 else 1))
        for x in range(3, 13): p.px(x, 14, k('pole', 1))
        for x in range(3, 13): p.px(x, 15, k('pole', 0))
        for x in range(4, 13): p.px(x, 9, k('pole', 5 if x < 11 else 4))
        for x, y in ((13, 14), (14, 14), (13, 15), (14, 15), (15, 15)): p.px(x, y, '~')
    elif V == 'B':
        shaft(p, 0, 11)
        for x in range(5, 12): p.px(x, 12, k('pole', {5: 5, 6: 5, 7: 4, 8: 2, 9: 1, 10: 0, 11: 0}[x]))
        for x in range(4, 13): p.px(x, 13, k('pole', {4: 5, 5: 5, 6: 4, 7: 4, 8: 2, 9: 1, 10: 0, 11: 0, 12: 0}[x]))
        for x in range(4, 13): p.px(x, 14, k('pole', 0))
        for y, xs in ((13, range(13, 16)), (14, range(13, 16)), (15, range(6, 16))):
            for x in xs: p.px(x, y, '~')
        for x in range(2, 6): p.px(x, 15, '-')
    else:
        shaft(p, 0, 9)
        # 이중 받침
        for x in range(5, 12): p.px(x, 10, k('pole', {5: 3, 6: 5, 7: 4, 8: 3, 9: 2, 10: 1, 11: 0}[x]))
        for x in range(3, 14): p.px(x, 11, k('pole', 4 if x < 6 else 3 if x < 9 else 1 if x < 12 else 0))
        for x in range(3, 14): p.px(x, 12, k('pole', 3 if x < 6 else 2 if x < 9 else 1))
        for x in range(2, 15): p.px(x, 13, k('pole', 3 if x < 5 else 2 if x < 9 else 1 if x < 13 else 0))
        for x in range(2, 15): p.px(x, 14, k('pole', 2 if x < 5 else 1 if x < 12 else 0))
        for x, y in ((14, 15), (15, 15), (15, 14)): p.px(x, y, '~')

    # ── wire_m (repeat x): 직선 세 줄 ──
    p = P('wire_m')
    for y in WY:
        for x in range(16):
            if V == 'A': c = k('lacq', 3)
            elif V == 'B': c = k('lacq', 5) if x % 8 == 3 else k('lacq', 2)
            else: c = k('lacq', 3)
            p.px(x, y, c)
            if V == 'C': p.px(x, y + 1, k('lacq', 1))

    # ── wire_dip (repeat x): 가운데 처짐 ──
    # 처짐 표: x → 아래로 내려가는 화소 (1~2)
    dip = [0, 0, 0, 1, 1, 1, 1, 2, 2, 1, 1, 1, 1, 0, 0, 0]
    p = P('wire_dip')
    for y in WY:
        for x in range(16):
            yy = y + dip[x]
            if V == 'A': c = k('lacq', 3)
            elif V == 'B': c = k('lacq', 5) if x % 8 == 3 else k('lacq', 2)
            else: c = k('lacq', 3)
            p.px(x, yy, c)
            if V == 'C': p.px(x, yy + 1, k('lacq', 1))

    # ── stay (16x48): 버팀줄(위 왼쪽에서 아래 오른쪽) + 아래 노란 덮개 ──
    p = P('stay'); p.tall = True
    # 사선 줄: 손으로 놓은 단 [(y0,y1,x)]
    steps = [(2, 4, 0), (5, 8, 1), (9, 12, 2), (13, 16, 3), (17, 20, 4), (21, 24, 5), (25, 28, 6), (29, 32, 7)]
    if V == 'C': steps = [(1, 3, 0), (4, 6, 1), (7, 9, 2), (10, 12, 3), (13, 15, 4), (16, 18, 5), (19, 21, 6), (22, 24, 7), (25, 27, 8), (28, 30, 9)]
    wl, wd = {'A': (4, 2), 'B': (5, 1), 'C': (4, 2)}[V]
    for y0, y1, x in steps:
        for y in range(y0, y1 + 1):
            p.px(x, y, k('lacq', wl)); p.px(x + 1, y, k('lacq', wd))
    # 덮개(아래 칸 y=32..47): 노란 관 + 검정 띠
    gx0, gx1 = 8, 12
    if V == 'C': gx0, gx1 = 9, 14
    top = 30 if V != 'C' else 30
    lit = {'A': [5, 4, 4, 3, 2], 'B': [5, 5, 3, 2, 1], 'C': [5, 5, 4, 3, 2, 1]}[V]
    dk = {'A': [4, 3, 3, 2, 1], 'B': [3, 2, 1, 1, 0], 'C': [4, 3, 3, 2, 1, 0]}[V]
    for y in range(top + 1, 44):
        for i, x in enumerate(range(gx0, gx1 + 1)):
            if V == 'C':
                on = ((y + (x - gx0)) // 3) % 2 == 0
            else:
                on = ((y - 30) // 3) % 2 == 0
            p.px(x, y, k('taxi', lit[i]) if on else k('lacq', dk[i]))
    # 줄이 덮개 위로 들어감
    p.hl(gx0, gx1, top - 3, k('mmetal', 1))                                 # 덮개 머리: 뒤 끝선
    for y in (top - 2, top - 1): p.hl(gx0 - 1, gx1 + 1, y, k('mmetal', 7))   # 윗면(가장 밝음)
    p.px(gx1 + 1, top - 2, k('mmetal', 5)); p.px(gx1 + 1, top - 1, k('mmetal', 5))
    p.hl(gx0 - 1, gx1 + 1, top, k('mmetal', 3))
    # 바닥 판(콘크리트 받침): 윗면 y44~45 · 앞 모서리 y46 · 앞면 y47
    for y in (44, 45):
        for x in range(gx0 - 2, gx1 + 3): p.px(x, y, k('mconc', 6 if x < gx1 + 2 else 4))
    p.hl(gx0 - 2, gx1 + 2, 46, k('mconc', 3)); p.hl(gx0 - 2, gx1 + 2, 47, k('mconc', 1))
    if V == 'B':
        for x in range(gx1 + 2, min(16, gx1 + 5)): p.px(x, 46, '~'); p.px(x, 47, '~')
        for x in range(gx0 - 2, gx1 + 2): p.px(x, 47, '-') if False else None
    if V == 'C':
        # 가운데 죔쇠(턴버클)
        p.hl(4, 6, 20, None)

    return G

def export(V):
    G = build(V)
    POOL = [c for c in 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@$^&*()[]{}<>?/=+:;,' if c not in '.~-%#']
    legend, rev, rows = {}, {}, []
    for r in G:
        line = ''
        for c in r:
            if c is None: line += '.'
            elif isinstance(c, str): line += c
            else:
                if c not in rev: ch = POOL[len(rev)]; rev[c] = ch; legend[ch] = c
                line += rev[c]
        rows.append(line)
    out = os.path.join(KIT, f'v34-{V}.pxg')
    title = 'kit_pole v34-A'
    open(out, 'w', encoding='utf-8').write(emit(rows, legend, title=title))
    print(out, len(legend), '색')

if __name__ == '__main__':
    export('A')
