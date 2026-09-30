#!/usr/bin/env python3
"""[3/4 재작도 V05] kit_bldg v34-A 를 (k1_paint.py 의 A 화풍 기반)  한 화소씩 손으로 찍는 도우미 (사각형·선·도안뿐, 보간·잡음 없음).
  python3 k1_paint.py A|B|C   # → ../k1-X.pxg
A = 강남풍 현대(ALC 패널·알루미늄 창틀·짙은 유리)   B = 그늘 강화(타일 외벽·깊이 들어간 창·짙은 난간 그림자)
C = 실루엣 다시 읽기(벽돌 쇼와 건물·아치 쌍창+발코니 난간·계단식 난간·원통 물탱크·초롱 세로간판)
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); KIT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(HERE, '..', '..', '..', '..', '..', 'scripts', 'content', 'atlas-pick'))
from pxg_emit import emit
S = 'A'
info = json.load(open(os.path.join(KIT, 'info.json'), encoding='utf-8'))
W, H = info['canvas']; AT = {p['slug']: (p['at'][0] * 16, p['at'][1] * 16) for p in info['parts']}
G = [[None] * W for _ in range(H)]

class P:
    def __init__(s, slug): s.ox, s.oy = AT[slug]
    def px(s, x, y, k):
        G[s.oy + y][s.ox + x] = k
    def rect(s, x, y, w, h, k):
        for j in range(y, y + h):
            for i in range(x, x + w): s.px(i, j, k)
    def art(s, x, y, rows, leg):
        for j, r in enumerate(rows):
            for i, c in enumerate(r):
                if c != '.': s.px(x + i, y + j, leg[c])
def k(r, t): return (r, t)
SL = k('mconc', 2)   # 층 이음 줄(계약)

# ───────────── 벽 재질 (16×32) — 3/4: 층마다 앞으로 튀어나온 슬래브(윗면·앞면·그늘) + 벽기둥 ─────────────
def wallpx(x, y):
    if y in (0, 31): return SL
    if y in (1, 30): return k('mconc', 3)                 # 슬래브 밑 그늘 / 슬래브 앞면 밑 그늘
    if y == 16: return k('mconc', 3)
    if y == 17: return k('mconc', 5)
    jx = 11 if y < 16 else 3
    if x == jx: return k('mconc', 3)
    if x == jx + 1: return k('mconc', 5)
    return k('mconc', 4)

def base_wall(p, x0=0, x1=16):
    for y in range(32):
        for x in range(x0, x1): p.px(x, y, wallpx(x, y))
    for x in range(x0, x1):                               # 층 슬래브: 윗면 2 + 앞 모서리 1 밝은 선 + 앞면 (아래는 이음선)
        p.px(x, 27, k('mconc', 5)); p.px(x, 28, k('mconc', 6)); p.px(x, 29, k('mconc', 4))

def pilaster(p, x0):             # 4px: 왼쪽 밝은 선 1 + 면 2 + 오른쪽 어두운 선 1
    for y in range(2, 30):
        p.px(x0, y, k('mconc', 6)); p.px(x0 + 1, y, k('mconc', 5)); p.px(x0 + 2, y, k('mconc', 5)); p.px(x0 + 3, y, k('mconc', 3))

for slug in ('wall_l', 'wall_m', 'wall_r'):
    p = P(slug); base_wall(p)
    if slug == 'wall_l': pilaster(p, 0)
    if slug == 'wall_m': pilaster(p, 6)
    if slug == 'wall_r':
        for y in range(2, 30):
            p.px(11, y, k('mconc', 3)); p.px(12, y, k('mconc', 6)); p.px(13, y, k('mconc', 5)); p.px(14, y, k('mconc', 5)); p.px(15, y, k('mconc', 3))

# ───────────── 창 (들어간 창 + 돌출 창턱) ─────────────
def glass_fill(p, kind):
    x0, y0, x1, y1 = (3, 5, 13, 25)
    w, h = x1 - x0, y1 - y0
    if kind == 'plain':
        p.rect(x0, y0, w, h, k('mdglass', 3)); p.rect(x0, y0, w, 2, k('mdglass', 5)); p.rect(x0, y0 + 2, w, 3, k('mdglass', 4))
        for i in range(6): p.px(4 + i, 13 - i, k('mdglass', 6))
        for i in range(4): p.px(9 + i, 20 - i, k('mdglass', 6))
    elif kind == 'lit':
        p.rect(x0, y0, w, h, k('hinoki', 5)); p.rect(x0, y0, w, 3, k('taxi', 5)); p.rect(x0, y0 + 3, w, 1, k('taxi', 4))
        p.rect(x0, y1 - 6, w, 6, k('hinoki', 3)); p.rect(x0, y1 - 6, w, 1, k('hinoki', 4))
        p.rect(x0 + 1, y0 + 8, 2, 8, k('akachin', 3)); p.rect(x0 + 1, y0 + 8, 1, 8, k('akachin', 4))      # 커튼
        p.rect(10, 13, 2, 2, k('sumi', 3)); p.rect(9, 15, 4, 6, k('sumi', 2)); p.rect(9, 15, 1, 6, k('sumi', 3))   # 사람 그림자
    else:                                                    # sign: 색 판 + 가나 한 자
        bg = ('akachin', 3)
        p.rect(x0, y0, w, h, k(*bg)); p.rect(x0, y0, w, 1, k(bg[0], 5)); p.rect(x0, y1 - 1, w, 1, k(bg[0], 1))
        p.rect(x0, y0, 1, h, k(bg[0], 4)); p.rect(x1 - 1, y0, 1, h, k(bg[0], 1))
        gx = x0 + (w - 6) // 2
        p.art(gx, 7, ['.####.', '......', '######', '....##', '...##.', '..##..', '##....', '......'], {'#': k('washi', 5)})
        for dx in range(gx, gx + 7, 2): p.px(dx, 17, k('taxi', 4))
        p.rect(gx, 20, 6, 1, k('washi', 3)); p.rect(gx, 22, 4, 1, k('washi', 2))

def win_A(p, kind):
    base_wall(p)
    p.rect(2, 3, 12, 1, k('mconc', 3))                       # 문미 그늘
    p.rect(2, 4, 12, 22, k('mmetal', 4))                     # 창틀(들어간 면)
    p.rect(2, 4, 12, 1, k('mmetal', 6)); p.rect(2, 4, 1, 22, k('mmetal', 5)); p.rect(13, 4, 1, 22, k('mmetal', 2)); p.rect(2, 25, 12, 1, k('mmetal', 2))
    glass_fill(p, kind)
    p.rect(3, 5, 10, 1, k('mmetal', 2))                      # 안쪽 윗 그림자(들어간 깊이)
    p.rect(7, 6, 1, 19, k('mmetal', 4)); p.rect(8, 6, 1, 19, k('mmetal', 2))
    # 돌출 창턱: 윗면 2 + 앞 모서리 1 + 벽에 진 그림자
    p.rect(1, 26, 14, 1, k('mconc', 6)); p.rect(1, 27, 14, 1, k('mconc', 5)); p.rect(1, 28, 14, 1, k('mwhite', 2))
    p.rect(2, 29, 12, 1, k('mconc', 3))
    for x in range(1, 15): p.px(x, 26, k('mconc', 6) if x < 13 else k('mconc', 5))

for slug, kind in (('win_plain', 'plain'), ('win_lit', 'lit'), ('win_sign', 'sign')):
    win_A(P(slug), kind)

# ───────────── 옥상: 위에서 본 판(뒤 난간 윗면 → 안쪽 면 2px → 바닥 → 앞 난간 윗면 → 앞 모서리 밝은 선) ─────────────
CAP = k('mconc', 5); CAPH = k('mconc', 6); INN = k('mconc', 3); FLR = k('mpave', 6); FJ = k('mpave', 2); FSH = k('mpave', 2)
def roof_px(kind, x, y, left, right, xs_first=None):
    """kind n/m/s, 타일 안 (x,y). left/right = 이 타일 왼/오른 끝에 옆 난간이 있는가."""
    side = None
    if left and x <= 2: side = 'cap'
    if right and x >= 13: side = 'cap'
    if kind == 'n':
        if y == 0: return CAPH
        if y <= 3: return CAP
        if side: return CAP
        if y in (4, 5): return INN
        if left and x == 3: return FSH
    elif kind == 's':
        if y == 11 and not side: return CAPH
        if 8 <= y <= 10: return CAP
        if y >= 12: return None                               # 앞면(파사드) — 아래에서 따로
        if side: return CAP
        if left and x == 3: return FSH
    else:
        if side: return CAP
        if left and x == 3: return FSH
    if right and x == 15: return INN
    # 바닥
    if x == 7 or (kind == 'm' and y == 14) or (kind == 'n' and y == 14): return FJ
    return FLR

def roof(slug, kind, left=False, right=False):
    p = P(slug)
    for y in range(16):
        for x in range(16):
            c = roof_px(kind, x, y, left, right)
            if c is None: continue
            if left and x == 0 and y > 0: c = CAP
            if right and x == 15: c = INN
            if kind == 'n' and y == 0 and left and x == 0: c = CAPH
            p.px(x, y, c)
    if kind == 's':                                            # 앞 난간 바깥면(입면 윗 4행)
        for x in range(16):
            p.px(x, 12, k('mconc', 3)); p.px(x, 13, k('mconc', 4)); p.px(x, 14, k('mconc', 4)); p.px(x, 15, k('mconc', 3))
        if left:
            for y in range(12, 16): p.px(0, y, k('mconc', 6) if y < 15 else k('mconc', 5)); p.px(1, y, k('mconc', 5))
        if right:
            for y in range(12, 16): p.px(14, y, k('mconc', 3)); p.px(15, y, k('mconc', 3))
        for x in range(16):                                    # 앞 모서리 밝은 선 밑 1px 그늘
            pass

roof('roof_nl', 'n', left=True); roof('roof_nm', 'n'); roof('roof_nr', 'n', right=True)
roof('roof_ml', 'm', left=True); roof('roof_mm', 'm'); roof('roof_mr', 'm', right=True)
roof('roof_sl', 's', left=True); roof('roof_sm', 's'); roof('roof_sr', 's', right=True)

# ───────────── 옥상 설비 (object, 투명 바탕) ─────────────
p = P('rt_tank')
if S in 'AB':
    d = S == 'B'
    p.rect(5, 7, 22, 15, k('mmetal', 4))                      # 몸통
    p.rect(5, 7, 22, 1, k('mmetal', 6)); p.rect(5, 8, 22, 1, k('mmetal', 5))
    p.rect(5, 7, 1, 15, k('mmetal', 5)); p.rect(26, 7, 1, 15, k('mmetal', 1 if d else 2)); p.rect(25, 8, 1, 14, k('mmetal', 2 if d else 3))
    for x in (11, 16, 21): p.rect(x, 9, 1, 12, k('mmetal', 2 if d else 3))       # 리브
    p.rect(5, 21, 22, 1, k('mmetal', 1 if d else 2))
    p.rect(4, 4, 24, 3, k('mmetal', 5)); p.rect(4, 4, 24, 1, k('mwhite', 3)); p.rect(4, 4, 1, 3, k('mwhite', 3)); p.rect(27, 4, 1, 3, k('mmetal', 2))  # 뚜껑 윗면
    p.rect(14, 1, 5, 3, k('mmetal', 3)); p.rect(14, 1, 5, 1, k('mmetal', 5)); p.rect(18, 2, 1, 2, k('mmetal', 1))   # 맨홀 뚜껑
    for x in (7, 23):                                          # 다리
        p.rect(x, 22, 2, 7, k('mmetal', 3)); p.rect(x, 22, 1, 7, k('mmetal', 5))
    p.rect(9, 25, 14, 1, k('mmetal', 3)); p.rect(9, 26, 14, 1, k('mmetal', 2))   # 가로대
    for x in range(8, 30): p.px(x, 29, '~')
    for x in range(10, 31): p.px(x, 30, '-')
    if d:
        p.rect(6, 22, 20, 2, '~')                              # 몸통 밑 그늘
else:                                                          # C: 원통 물탱크 + 뾰족 지붕
    for j, w in enumerate((2, 6, 10, 14)):
        x0 = 16 - w // 2; p.rect(x0, 2 + j * 2, w, 2, k('mmetal', 3)); p.rect(x0, 2 + j * 2, 1, 2, k('mmetal', 5)); p.rect(x0 + w - 1, 2 + j * 2, 1, 2, k('mmetal', 1))
    p.rect(9, 10, 14, 13, k('mmetal', 4)); p.rect(9, 10, 2, 13, k('mmetal', 6)); p.rect(10, 10, 1, 13, k('mmetal', 5)); p.rect(21, 10, 2, 13, k('mmetal', 2)); p.rect(22, 10, 1, 13, k('mmetal', 1))
    for y in (13, 18): p.rect(9, y, 14, 1, k('mmetal', 2))
    p.rect(9, 22, 14, 1, k('mmetal', 1))
    for x in (11, 20): p.rect(x, 23, 2, 6, k('mmetal', 3)); p.px(x, 23, k('mmetal', 5))
    p.rect(11, 26, 11, 1, k('mmetal', 2))
    for x in range(10, 28): p.px(x, 29, '~')
    for x in range(12, 29): p.px(x, 30, '-')

p = P('rt_ac')
if S in 'AB':
    p.rect(2, 3, 12, 10, k('mwhite', 2)); p.rect(2, 3, 12, 1, k('mwhite', 4)); p.rect(2, 3, 1, 10, k('mwhite', 3)); p.rect(13, 3, 1, 10, k('mwhite', 1 if S == 'A' else 0)); p.rect(2, 12, 12, 1, k('mwhite', 0))
    p.rect(4, 5, 7, 7, k('mmetal', 1)); p.rect(5, 6, 5, 5, k('mmetal', 3)); p.px(7, 8, k('mmetal', 1)); p.px(8, 8, k('mmetal', 1)); p.px(7, 7, k('mmetal', 5)); p.px(6, 9, k('mmetal', 5))
    for y in (7, 9): p.rect(5, y, 5, 1, k('mmetal', 2))
    p.rect(3, 13, 2, 1, k('mmetal', 2)); p.rect(11, 13, 2, 1, k('mmetal', 2))
    for x in range(4, 15): p.px(x, 14, '~')
    for x in range(6, 15): p.px(x, 15, '-')
else:
    p.rect(1, 4, 14, 8, k('kasa', 3)); p.rect(1, 4, 14, 1, k('kasa', 4)); p.rect(1, 4, 1, 8, k('kasa', 4)); p.rect(14, 4, 1, 8, k('kasa', 1)); p.rect(1, 11, 14, 1, k('kasa', 1))
    for x in (4, 7, 10): p.rect(x, 5, 1, 6, k('kasa', 1))
    p.rect(2, 12, 2, 2, k('mmetal', 2)); p.rect(12, 12, 2, 2, k('mmetal', 2))
    for x in range(3, 15): p.px(x, 14, '~')
    for x in range(5, 15): p.px(x, 15, '-')

# ───────────── 층 간판 (wall, 투명) ─────────────
def fsign(slug, body, x0, x1, left=False, right=False):
    p = P(slug); ba, bb = body
    for x in range(x0, x1):
        p.px(x, 3, k('washi', 5)); p.px(x, 4, k(ba, 5)); p.rect(x, 5, 1, 6, k(ba, 3)); p.px(x, 11, k(ba, 2)); p.px(x, 12, k(ba, 1))
        p.px(x, 13, '-'); p.px(x, 14, '-')
        if S == 'B': p.px(x, 15, '-')
        if x % 4 == 1: p.px(x, 7, k(ba, 5)); p.px(x, 8, k(ba, 4))     # 색전구 점
    if left:
        for y in range(3, 13): p.px(x0, y, k('washi', 5)); p.px(x0 + 1, y, k(ba, 4))
        p.px(x0, 3, None) if S == 'C' else None
        p.rect(x0 + 2, 0, 2, 3, k('mmetal', 3)); p.px(x0 + 2, 0, k('mmetal', 5))
        for y in (13, 14): p.px(x0, y, None)
    if right:
        for y in range(3, 13): p.px(x1 - 1, y, k(ba, 1)); p.px(x1 - 2, y, k(ba, 2))
        p.rect(x1 - 4, 0, 2, 3, k('mmetal', 3)); p.px(x1 - 4, 0, k('mmetal', 5))
        p.px(x1 - 1, 3, None) if S == 'C' else None
    if S == 'C':                                           # 모서리 깎기(실루엣)
        if left: p.px(x0, 12, None); p.px(x0, 3, None); p.px(x0, 4, None) if False else None
        if right: p.px(x1 - 1, 12, None); p.px(x1 - 1, 3, None)
    return p

CM = {'A': ('kblue', 'akachin'), 'B': ('korange', 'ai'), 'C': ('kgreen', 'neon')}[S]
fsign('fsign_l', (CM[0], 0), 2, 16, left=True)
fsign('fsign_m', (CM[0], 0), 0, 16)
fsign('fsign_m2', (CM[1], 0), 0, 16)
fsign('fsign_r', (CM[0], 0), 0, 14, right=True)

# ───────────── 세로 돌출 간판 ─────────────
VC = {'A': 'neonc', 'B': 'shu', 'C': 'taxi'}[S]
def vbox(p, y0, y1):
    for y in range(y0, y1):
        p.px(3, y, k('washi', 5)); p.px(4, y, k(VC, 5)); p.rect(5, y, 6, 1, k(VC, 3)); p.px(11, y, k(VC, 2)); p.px(12, y, k(VC, 1))
        p.px(13, y, '-'); p.px(14, y, '-')
p = P('vsign_t')
p.rect(7, 0, 2, 3, k('mmetal', 3)); p.px(7, 0, k('mmetal', 5)); p.px(6, 0, k('mmetal', 4)); p.px(9, 0, k('mmetal', 2))
p.rect(3, 3, 10, 1, k('washi', 5)); p.rect(4, 3, 8, 1, k(VC, 5)); p.px(3, 3, k('washi', 5)); p.px(12, 3, k(VC, 2))
vbox(p, 4, 16); p.rect(3, 15, 10, 1, k(VC, 1)); p.px(3, 15, k(VC, 2))
p.rect(6, 6, 4, 5, k(VC, 4)); p.rect(6, 6, 4, 1, k('washi', 4)); p.rect(6, 10, 4, 1, k(VC, 2))
p = P('vsign_m')
vbox(p, 0, 16); p.rect(3, 0, 10, 1, k(VC, 1)); p.rect(4, 1, 8, 1, k(VC, 5)); p.px(3, 0, k(VC, 2)); p.px(3, 1, k('washi', 5)); p.px(12, 0, k(VC, 1))
p.rect(6, 4, 4, 8, k(VC, 4)); p.rect(6, 4, 4, 1, k('washi', 4)); p.rect(6, 11, 4, 1, k(VC, 2)); p.rect(7, 6, 2, 1, k('lacq', 3)); p.rect(7, 8, 2, 1, k('lacq', 3))
p.rect(3, 15, 10, 1, k(VC, 1)); p.px(3, 15, k(VC, 2)); p.px(12, 15, k(VC, 1))
p = P('vsign_b')
p.rect(3, 0, 10, 1, k(VC, 1)); p.rect(4, 1, 8, 1, k(VC, 5)); p.px(3, 1, k('washi', 5)); p.px(3, 0, k(VC, 2))
vbox(p, 2, 10)
p.rect(6, 4, 4, 4, k(VC, 4)); p.rect(6, 4, 4, 1, k('washi', 4))
p.rect(3, 10, 10, 1, k(VC, 1)); p.rect(4, 11, 8, 1, k(VC, 0)); p.px(3, 10, k(VC, 2))
for x in range(5, 15): p.px(x, 12, '-')
for x in range(7, 15): p.px(x, 13, '-')
if S == 'C':                                       # 초롱 모양: 아랫 술
    p.rect(7, 12, 2, 3, k('lacq', 2)); p.px(7, 14, k('akachin', 3)); p.px(8, 14, k('akachin', 3))

# ───────────── 계단 입구 (16×32, 불투명) ─────────────
p = P('stair_door'); base_wall(p)
p.rect(2, 3, 12, 1, k('mconc', 2))                         # 차양 그늘줄
p.rect(2, 4, 12, 1, k('mconc', 5)); p.rect(2, 5, 12, 1, k('mconc', 3))
p.rect(3, 6, 10, 23, k('mmetal', 3)); p.rect(3, 6, 1, 23, k('mmetal', 5)); p.rect(12, 6, 1, 23, k('mmetal', 1))         # 문틀
p.rect(4, 7, 8, 21, k('masph', 0))
steps = [(8, 'masph', 1), (11, 'masph', 2), (14, 'masph', 3), (17, 'mpave', 0), (20, 'mpave', 1), (23, 'mpave', 3), (26, 'mconc', 4)]
for y, r, t in steps:
    p.rect(4, y, 8, 2, k(r, t)); p.rect(4, y, 8, 1, k(r, min(t + 2, 7) if r == 'mpave' else t + 1))
    p.rect(4, y + 2, 8, 1, k('masph', 1) if y < 20 else k('masph', 2))
p.rect(5, 7, 6, 1, k('taxi', 2)); p.rect(6, 7, 4, 1, k('taxi', 4))                # 안쪽 전등
p.rect(4, 8, 1, 19, k('mmetal', 5))                                              # 난간
if S == 'B':
    p.rect(4, 7, 8, 3, k('masph', 0)); p.rect(4, 7, 1, 21, k('masph', 0)); p.rect(4, 8, 1, 19, k('mmetal', 2))
    p.rect(3, 6, 10, 1, k('mmetal', 1))
# 층 안내판
if S == 'C':
    p.rect(13, 12, 1, 1, k('shu', 4))
else:
    pass
for y0, c in ((2, 'akachin'), (5, 'kblue')): pass
p.rect(13, 11, 1, 1, k('washi', 3))
# 바닥 문턱
p.rect(3, 29, 10, 1, k('mconc', 4)); p.rect(3, 30, 10, 1, k('mconc', 3))
for x in (0, 1, 2, 13, 14, 15):
    p.px(x, 29, wallpx(x, 29)); p.px(x, 30, wallpx(x, 30))

# ───────────── 내보내기 ─────────────
missing = []
for slug, (ox, oy) in AT.items():
    pass
POOL = [c for c in 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@$^&*()[]{}<>?/=+:;,' if c not in '.~-%#']
legend, rev, rows = {}, {}, []
for r in G:
    line = ''
    for c in r:
        if c is None: line += '.'
        elif isinstance(c, str): line += c
        else:
            if c not in rev:
                assert len(rev) < len(POOL), '색이 너무 많다'
                ch = POOL[len(rev)]; rev[c] = ch; legend[ch] = c
            line += rev[c]
    rows.append(line)
out = os.path.join(KIT, 'v34-A.pxg')
open(out, 'w', encoding='utf-8').write(emit(rows, legend, title='v34-A kit_bldg'))
print(out, len(legend), '색')
