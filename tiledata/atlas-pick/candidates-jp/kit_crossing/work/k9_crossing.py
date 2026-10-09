#!/usr/bin/env python3
"""kit_crossing k9 — 후보 A(강남 현대 시트 결)·B(강한 명암·그림자)·C(가는 부재 실루엣) 부품 시트.
손으로 놓는 사각형·선·도안만(보간·잡음 없음). python3 k9_crossing.py [A|B|C ...] → ../k9-X.pxg
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); KIT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(HERE, '..', '..', '..', '..', '..', 'scripts', 'content', 'atlas-pick'))
from pxg_emit import emit

info = json.load(open(os.path.join(KIT, 'info.json'), encoding='utf-8'))
W, H = info['canvas']; AT = {p['slug']: (p['at'][0] * 16, p['at'][1] * 16) for p in info['parts']}
G = None

def k(r, t): return (r, t)

class P:
    def __init__(s, slug): s.ox, s.oy = AT[slug]
    def px(s, x, y, c):
        if 0 <= x < 16 and 0 <= y < (32 if s.oy < 32 and s.ox < 64 else 16): G[s.oy + y][s.ox + x] = c
    def rect(s, x, y, w, h, c):
        for j in range(y, y + h):
            for i in range(x, x + w): s.px(i, j, c)
    def art(s, x, y, rows, leg):
        for j, r in enumerate(rows):
            for i, ch in enumerate(r):
                if ch != '.': s.px(x + i, y + j, leg[ch])

# 스타일 표 ---------------------------------------------------------------
# pal[kind] = [밝음, 중간, 어두움, 윤곽]
STY = {
 'A': dict(y=[k('taxi', 4), k('taxi', 3), k('taxi', 2), k('taxi', 1)], b=[k('lacq', 3), k('lacq', 2), k('lacq', 1), k('lacq', 0)],
           per=4, pw=4, px0=6, ay0=6, ah=4, fw=3),
 'B': dict(y=[k('taxi', 5), k('taxi', 3), k('taxi', 1), k('taxi', 0)], b=[k('lacq', 4), k('lacq', 2), k('lacq', 0), k('lacq', 0)],
           per=4, pw=4, px0=6, ay0=6, ah=4, fw=3),
 'C': dict(y=[k('taxi', 4), k('taxi', 3), k('taxi', 2), k('taxi', 1)], b=[k('lacq', 3), k('lacq', 2), k('lacq', 1), k('lacq', 0)],
           per=2, pw=2, px0=7, ay0=7, ah=3, fw=2),
}

def band(S, x, y):  # 사선 줄무늬: 0 노랑 · 1 검정
    return ((x + y) // S['per']) % 2

def pole_col(S, x, y):  # 기둥(가로 pw칸) 화소 색
    i = x - S['px0']; n = S['pw']
    sh = 0 if i == 0 else (2 if i == n - 1 else 1)
    return S['y' if band(S, x, y) == 0 else 'b'][sh]

def draw_pole(S, p, y0, y1):
    for y in range(y0, y1):
        for x in range(S['px0'], S['px0'] + S['pw']): p.px(x, y, pole_col(S, x, y))

def arm_col(S, x, y):  # 팔 화소 색(줄 위=밝음, 아래=어두움)
    r = y - S['ay0']; h = S['ah']
    sh = 0 if r == 0 else (2 if r == h - 1 else 1)
    return S['y' if band(S, x, y) == 0 else 'b'][sh]

def draw_arm(S, p, x0, x1):
    for y in range(S['ay0'], S['ay0'] + S['ah']):
        for x in range(x0, x1): p.px(x, y, arm_col(S, x, y))

def vbar(S, p, x0, w, y0, y1):  # 세로로 든 팔
    for y in range(y0, y1):
        for x in range(x0, x0 + w):
            i = x - x0; sh = 0 if i == 0 else (2 if i == w - 1 else 1)
            p.px(x, y, S['y' if band(S, x, y) == 0 else 'b'][sh])

def xmark(S, p, sty):
    fw = S['fw']
    for bar in (0, 1):
        for y in range(13):
            a = y + (1 if fw == 3 else 2)
            xs = list(range(a, a + fw)); ol = [a - 1, a + fw]
            if bar: xs = [15 - x for x in xs]; ol = [15 - x for x in ol]
            kind = 'y' if ((y // 3) + bar) % 2 == 0 else 'b'
            pal = S[kind]
            for x in ol: p.px(x, y, pal[3])
            for i, x in enumerate(sorted(xs)):
                sh = 0 if i == 0 else (2 if i == fw - 1 else 1)
                if fw == 2 and i == 1: sh = 2
                p.px(x, y, pal[sh])

# ── 바닥: 자갈·침목·레일 ────────────────────────────────────────────
TOPG = ["l..d..l.", "..d..l.d", ".l..d..l", "d..l..d.", "..d..l.."]
BOTG = ["..l..d.l", "d..l..d.", ".l..d..l", "..d..l.d", "l..d..l."]

def gravel_band(p, y0, rows, base, dk, lt):
    for j, r in enumerate(rows):
        for x in range(16):
            ch = r[x % 8]
            p.px(x, y0 + j, dk if ch == 'd' else lt if ch == 'l' else base)

def rail_rows(p, under, top, bot, sh):
    for y0 in (10, 21):
        for x in range(16):
            p.px(x, y0, top); p.px(x, y0 + 1, bot)
            p.px(x, y0 + 2, under(x, y0 + 2))

def build_rail(S_name):
    p = P('rail')
    if S_name == 'A':
        base, dk, lt = k('ishi', 3), k('ishi', 2), k('ishi', 4)
        gravel_band(p, 0, TOPG, base, dk, lt); gravel_band(p, 27, BOTG, base, dk, lt)
        p.rect(0, 5, 16, 22, k('ishi', 2))
        for x in (2, 6, 11, 14): p.px(x, 7, k('ishi', 1)); p.px(x + 0, 15, k('ishi', 3)); p.px(x, 24, k('ishi', 1))
        for x0 in (0, 8):     # 침목 x0+1..x0+4
            p.rect(x0 + 1, 6, 4, 20, k('sumi', 3)); p.rect(x0 + 1, 6, 1, 20, k('sumi', 4)); p.rect(x0 + 4, 6, 1, 20, k('sumi', 2))
            p.rect(x0 + 1, 6, 4, 1, k('sumi', 4)); p.rect(x0 + 1, 25, 4, 1, k('sumi', 1))
        under = lambda x, y: k('sumi', 1) if 1 <= x % 8 <= 4 else k('ishi', 1)
        rail_rows(p, under, k('mmetal', 6), k('mmetal', 3), None)
        for x0 in (0, 8):     # 레일 고정판
            for y0 in (10, 21): p.px(x0 + 2, y0, k('mmetal', 4)); p.px(x0 + 3, y0, k('mmetal', 4))
    elif S_name == 'B':
        base, dk, lt = k('ishi', 2), k('ishi', 0), k('ishi', 4)
        gravel_band(p, 0, TOPG, base, dk, lt); gravel_band(p, 27, BOTG, base, dk, lt)
        p.rect(0, 5, 16, 22, k('ishi', 1))
        p.rect(0, 5, 16, 1, k('ishi', 2)); p.rect(0, 26, 16, 1, k('ishi', 0))
        for x in (2, 6, 11, 14): p.px(x, 8, k('ishi', 0)); p.px(x + 0, 16, k('ishi', 2)); p.px(x, 23, k('ishi', 0))
        for x0 in (0, 8):
            p.rect(x0 + 1, 6, 4, 20, k('sumi', 2)); p.rect(x0 + 1, 6, 1, 20, k('sumi', 5)); p.rect(x0 + 2, 6, 1, 20, k('sumi', 3))
            p.rect(x0 + 4, 6, 1, 20, k('sumi', 0)); p.rect(x0 + 1, 6, 4, 1, k('sumi', 5)); p.rect(x0 + 1, 25, 4, 1, k('sumi', 0))
        under = lambda x, y: k('sumi', 0) if 1 <= x % 8 <= 4 else k('ishi', 0)
        rail_rows(p, under, k('mmetal', 7), k('mmetal', 3), None)
        for y0 in (10, 21):
            for x in range(16): p.px(x, y0 + 3, k('sumi', 0) if 1 <= x % 8 <= 4 else k('ishi', 0)) if y0 + 3 < 26 else None
    else:  # C: 콘크리트 침목 + 밝은 도상 둔덕
        base, dk, lt = k('ishi', 4), k('ishi', 3), k('ishi', 5)
        gravel_band(p, 0, TOPG, k('ishi', 2), k('ishi', 1), k('ishi', 3))
        gravel_band(p, 27, BOTG, k('ishi', 2), k('ishi', 1), k('ishi', 3))
        p.rect(0, 5, 16, 22, base); p.rect(0, 5, 16, 1, k('ishi', 3)); p.rect(0, 26, 16, 1, k('ishi', 3))
        p.rect(0, 4, 16, 1, k('ishi', 3)); p.rect(0, 27, 16, 1, k('ishi', 2))
        for x in (3, 7, 12, 15): p.px(x, 8, dk); p.px(x, 17, lt); p.px(x, 24, dk)
        for x0 in (0, 8):
            p.rect(x0 + 2, 6, 3, 20, k('mconc', 4)); p.rect(x0 + 2, 6, 1, 20, k('mconc', 5)); p.rect(x0 + 4, 6, 1, 20, k('mconc', 2))
            p.rect(x0 + 2, 25, 3, 1, k('mconc', 2))
        under = lambda x, y: k('mconc', 1) if 2 <= x % 8 <= 4 else k('ishi', 2)
        for y0 in (10, 21):
            for x in range(16):
                p.px(x, y0, k('mmetal', 6)); p.px(x, y0 + 1, under(x, y0 + 1))
                p.px(x, y0 - 1, k('ishi', 3) if not (2 <= x % 8 <= 4) else k('mconc', 3))

# ── 바닥판(deck) ─────────────────────────────────────────────────────
def build_deck(S_name, slug):
    p = P(slug)
    if S_name == 'A':
        asp, hi, base, mid, dark, groove = k('masph', 3), k('mconc', 5), k('mconc', 4), k('mconc', 3), k('mconc', 2), k('masph', 0)
        p.rect(0, 0, 16, 32, asp)
        p.rect(0, 3, 16, 26, base); p.rect(0, 3, 16, 1, hi); p.rect(0, 28, 16, 1, dark)
        p.rect(0, 8, 16, 1, mid); p.rect(0, 19, 16, 1, mid); p.rect(0, 13, 16, 1, hi); p.rect(0, 24, 16, 1, hi)
        for x0 in (0, 8): p.rect(x0, 3, 1, 26, dark); p.rect(x0 + 1, 4, 1, 24, hi)
        for y0 in (9, 20):
            p.rect(0, y0, 16, 1, groove); p.rect(0, y0 + 3, 16, 1, groove)
            p.rect(0, y0 + 1, 16, 1, k('mmetal', 6)); p.rect(0, y0 + 2, 16, 1, k('mmetal', 3))
        if slug == 'deck_l':
            p.rect(0, 3, 1, 26, dark); p.rect(1, 3, 1, 26, k('mconc', 2)); p.rect(2, 4, 1, 24, hi)
            for y0 in (10, 21): p.px(0, y0, k('mmetal', 6)); p.px(1, y0, k('mmetal', 6)); p.px(0, y0 + 1, k('mmetal', 3)); p.px(1, y0 + 1, k('mmetal', 3))
        if slug == 'deck_r':
            p.rect(15, 3, 1, 26, k('mconc', 1)); p.rect(14, 3, 1, 26, k('mconc', 2)); p.rect(13, 4, 1, 24, mid)
            for y0 in (10, 21): p.px(15, y0, k('mmetal', 6)); p.px(14, y0, k('mmetal', 6)); p.px(15, y0 + 1, k('mmetal', 3)); p.px(14, y0 + 1, k('mmetal', 3))
    elif S_name == 'B':
        asp, hi, base, mid, dark, deep = k('masph', 3), k('mconc', 6), k('mconc', 4), k('mconc', 2), k('mconc', 1), k('masph', 0)
        p.rect(0, 0, 16, 32, asp); p.rect(0, 2, 16, 1, k('masph', 1))
        p.rect(0, 3, 16, 26, base); p.rect(0, 3, 16, 2, hi); p.rect(0, 27, 16, 1, dark); p.rect(0, 28, 16, 1, deep)
        p.rect(0, 29, 16, 1, k('masph', 1))
        for y0 in (5, 14, 25): pass
        p.rect(0, 7, 16, 2, mid); p.rect(0, 18, 16, 2, mid); p.rect(0, 13, 16, 1, hi); p.rect(0, 24, 16, 1, hi)
        for x0 in (0, 8): p.rect(x0, 3, 2, 25, deep); p.rect(x0 + 2, 5, 1, 22, hi)
        for y0 in (9, 20):
            p.rect(0, y0, 16, 1, deep); p.rect(0, y0 + 3, 16, 1, deep)
            p.rect(0, y0 + 1, 16, 1, k('mmetal', 7)); p.rect(0, y0 + 2, 16, 1, k('mmetal', 3))
        if slug == 'deck_l':
            p.rect(0, 3, 3, 25, deep); p.rect(3, 5, 1, 22, hi); p.rect(2, 3, 1, 25, dark)
            for y0 in (10, 21):
                for x in range(3): p.px(x, y0, k('mmetal', 7)); p.px(x, y0 + 1, k('mmetal', 3))
        if slug == 'deck_r':
            p.rect(13, 3, 3, 25, deep); p.rect(12, 5, 1, 22, mid); p.rect(13, 3, 1, 25, dark)
            for y0 in (10, 21):
                for x in range(13, 16): p.px(x, y0, k('mmetal', 7)); p.px(x, y0 + 1, k('mmetal', 3))
    else:  # C: 어두운 고무판 + 노랑 테두리 선
        rub, hi, mid, lo, line = k('masph', 4), k('masph', 5), k('masph', 3), k('masph', 2), k('taxi', 3)
        p.rect(0, 0, 16, 32, k('masph', 3))
        p.rect(0, 3, 16, 26, rub); p.rect(0, 3, 16, 1, line); p.rect(0, 28, 16, 1, k('taxi', 2))
        p.rect(0, 4, 16, 1, hi)
        p.rect(0, 15, 16, 1, mid); p.rect(0, 16, 16, 1, hi)
        for x0 in (4, 12): p.rect(x0, 4, 1, 24, lo)
        for y0 in (9, 20):
            p.rect(0, y0, 16, 1, k('masph', 1)); p.rect(0, y0 + 3, 16, 1, k('masph', 1))
            p.rect(0, y0 + 1, 16, 1, k('mmetal', 6)); p.rect(0, y0 + 2, 16, 1, k('mmetal', 4))
        if slug == 'deck_l':
            p.rect(0, 3, 1, 26, k('taxi', 2)); p.rect(1, 4, 2, 24, k('masph', 5))
            for y0 in (10, 21):
                for x in range(3): p.px(x, y0, k('mmetal', 6)); p.px(x, y0 + 1, k('mmetal', 4))
        if slug == 'deck_r':
            p.rect(15, 3, 1, 26, k('taxi', 1)); p.rect(13, 4, 2, 24, lo)
            for y0 in (10, 21):
                for x in range(13, 16): p.px(x, y0, k('mmetal', 6)); p.px(x, y0 + 1, k('mmetal', 4))

# ── 경보기·차단기 ────────────────────────────────────────────────────
LAMP = ['.oooo.', 'orRrro', 'oRrrro', 'orrrro', 'orrrro', '.oooo.']

def lamp(p, x0, y0, on, S_name):
    if on:
        fill, hi, sh = k('akachin', 5), k('akachin', 6), k('akachin', 3)
    else:
        fill, hi, sh = k('akachin', 2), k('akachin', 3), k('akachin', 1)
    ring = k('lacq', 0) if S_name != 'A' else k('lacq', 1)
    for j, r in enumerate(LAMP):
        for i, ch in enumerate(r):
            if ch == '.': continue
            c = ring if ch == 'o' else hi if ch == 'R' and on else fill if ch in 'Rr' else fill
            if ch == 'r' and j >= 4: c = sh
            if ch == 'r' and on and i >= 4: c = sh
            p.px(x0 + i, y0 + j, c)

def build_objects(S_name):
    S = STY[S_name]
    # cr_top
    p = P('cr_top'); draw_pole(S, p, 8, 16); xmark(S, p, S_name)
    # cr_lamps
    p = P('cr_lamps'); draw_pole(S, p, 0, 16)
    if S_name == 'C':
        p.rect(0, 3, 6, 1, k('lacq', 2)); p.rect(10, 3, 6, 1, k('lacq', 2))
        lamp_y = 4
        p.rect(6, 6, 1, 2, k('lacq', 1)); p.rect(9, 6, 1, 2, k('lacq', 1))
        p.rect(0, 3, 6, 1, k('lacq', 3)); p.rect(10, 3, 6, 1, k('lacq', 3))
        p.rect(0, 3, 6, 1, k('lacq', 3))
    else:
        lamp_y = 3
    lamp(p, 0, lamp_y, True, S_name); lamp(p, 10, lamp_y, False, S_name)
    if S_name == 'B':   # 켜진 등 불빛 번짐
        for (x, y) in [(6, 5), (6, 6), (6, 7), (6, 8), (6, 9)]: pass
        for x in range(0, 6): p.px(x, 9, '%') if x in (1, 2, 3, 4) else None
        p.px(0, 2, '%'); p.px(5, 2, '%')
        for y in (5, 6, 7): p.px(6 if False else 5, y, G[p.oy + y][p.ox + 5])
    # cr_pole
    p = P('cr_pole'); draw_pole(S, p, 0, 16)
    # cr_box
    p = P('cr_box')
    if S_name == 'C':
        draw_pole(S, p, 0, 6)
        draw_arm(S, p, 0, 5); draw_arm(S, p, 11, 16)
        bx0, bx1, by0 = 5, 11, 6
        p.rect(bx0, by0, bx1 - bx0, 16 - by0, k('mmetal', 4)); p.rect(bx0, by0, bx1 - bx0, 1, k('mmetal', 6))
        p.rect(bx0, by0, 1, 16 - by0, k('mmetal', 5)); p.rect(bx1 - 1, by0, 1, 16 - by0, k('mmetal', 2))
        p.rect(bx0, 15, bx1 - bx0, 1, k('mmetal', 1))
        p.rect(7, 11, 2, 2, k('akachin', 4)); p.rect(bx0, by0 + 1, bx1 - bx0, 1, k('mmetal', 5))
        p.px(bx0, by0, k('mmetal', 5))
    else:
        draw_pole(S, p, 0, 4)
        draw_arm(S, p, 0, 3); draw_arm(S, p, 13, 16)
        hi, mid, lo, dk = (6, 4, 2, 1) if S_name == 'A' else (7, 4, 1, 0)
        p.rect(3, 3, 10, 13, k('mmetal', mid)); p.rect(3, 3, 10, 1, k('mmetal', hi))
        p.rect(3, 3, 1, 13, k('mmetal', hi - 1)); p.rect(12, 3, 1, 13, k('mmetal', lo)); p.rect(3, 15, 10, 1, k('mmetal', dk))
        p.rect(5, 11, 6, 3, k('mmetal', lo)); p.rect(5, 11, 6, 1, k('mmetal', dk)); p.rect(5, 13, 6, 1, k('mmetal', mid))
        p.rect(4, 4, 8, 1, k('mmetal', hi - 1)); p.rect(4, 5, 8, 1, k('mmetal', lo + 1))
        p.rect(7, 12, 2, 1, k('akachin', 4))
        if S_name == 'B':
            for x in range(13, 16): p.px(x, 13, '-'); p.px(x, 14, '~'); p.px(x, 15, '~')
            for x in range(3, 13): pass
    # 팔
    p = P('arm_m'); draw_arm(S, p, 0, 16)
    p = P('arm_tip_r'); tip(S, p, S_name, right=True)
    p = P('arm_tip_l'); tip(S, p, S_name, right=False)
    # 올린 팔
    bw = 2 if S_name == 'C' else 4; bx = 7 if S_name == 'C' else 6
    p = P('arm_up'); vbar(S, p, bx, bw, 0, 16)
    p = P('arm_up_top'); vbar(S, p, bx, bw, 3, 16)
    cap = S['b'][3]
    p.rect(bx + 1, 2, bw - 2, 1, cap) if bw > 2 else None
    p.rect(bx, 2, bw, 1, cap) if bw == 2 else None
    if bw > 2: p.rect(bx, 3, 1, 1, cap); p.rect(bx + bw - 1, 3, 1, 1, cap)
    p.rect(bx + (0 if bw == 2 else 1), 4, 2, 2, k('akachin', 4))
    # 그림자(B)
    if S_name == 'B':
        for slug in ('arm_m',):
            q = P(slug)
            for x in range(16): q.px(x, 10, '~'); q.px(x, 11, '~'); q.px(x, 12, '-')
        q = P('arm_tip_r')
        for x in range(0, 15): q.px(x, 10, '~'); q.px(x, 11, '~'); q.px(x, 12, '-')
        q = P('arm_tip_l')
        for x in range(2, 16): q.px(x, 10, '~'); q.px(x, 11, '~'); q.px(x, 12, '-')
        q = P('arm_up')
        for y in range(16): q.px(bx + bw, y, '-')
        q = P('arm_up_top')
        for y in range(4, 16): q.px(bx + bw, y, '-')
    if S_name == 'A':
        q = P('arm_m')
        for x in range(16): q.px(x, 10, '-')
        q = P('arm_tip_r')
        for x in range(0, 14): q.px(x, 10, '-')
        q = P('arm_tip_l')
        for x in range(2, 16): q.px(x, 10, '-')

def tip(S, p, S_name, right):
    y0, h = S['ay0'], S['ah']
    x0, x1 = (0, 14) if right else (2, 16)
    if S_name == 'C': x0, x1 = (0, 14) if right else (2, 16)
    draw_arm(S, p, x0, x1)
    cap = S['b'][3]
    cx = 14 if right else 1
    for y in range(y0 + 1, y0 + h - 1): p.px(cx, y, cap)
    if S_name == 'C':
        p.px(cx, y0 + 1, cap)
    rx = (12, 13) if right else (2, 3)
    if h >= 4:
        for x in rx: p.px(x, y0 + 1, k('akachin', 4)); p.px(x, y0 + 2, k('akachin', 3))
    else:
        for x in rx: p.px(x, y0 + 1, k('akachin', 4))

def export(name):
    global G
    G = [[None] * W for _ in range(H)]
    build_rail(name)
    for s in ('deck', 'deck_l', 'deck_r'): build_deck(name, s)
    build_objects(name)
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
    out = os.path.join(KIT, f'k9-{name}.pxg')
    open(out, 'w', encoding='utf-8').write(emit(rows, legend, title=f'kit_crossing k9-{name}'))
    print(out, len(legend), '색')

if __name__ == '__main__':
    for n in (sys.argv[1:] or ['A', 'B', 'C']): export(n)
