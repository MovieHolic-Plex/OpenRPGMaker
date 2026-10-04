import sys, os, math
HERE0 = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE0, '..', '..', 'forest', 'work'))
from w4lib import Cv, P, cell, inner_from_body, assemble, to_pxg

WOB = [4, 4, 5, 5, 5, 4, 4, 3, 3, 3, 3, 4, 4, 5, 5, 4]     # 변 굴곡 (16 주기)

# ---------- 16x16 주기 무늬 ----------
class T:
    def __init__(s): s.a = [[None] * 16 for _ in range(16)]
    def put(s, x, y, v): s.a[y % 16][x % 16] = v
    def get(s, x, y): return s.a[y % 16][x % 16]

def ell(t, cx, cy, rx, ry, fn):
    for y in range(int(cy - ry - 2), int(cy + ry + 3)):
        for x in range(int(cx - rx - 2), int(cx + rx + 3)):
            dx = (x + .5 - cx) / rx; dy = (y + .5 - cy) / ry; d = math.hypot(dx, dy)
            if d <= 1.0: t.put(x, y, fn(dx, dy, d))

def tex(sp):
    t = T()
    for y in range(16):
        for x in range(16): t.put(x, y, ('wbog', sp['water']))
    # 잔물결 · 물빛
    for (x, y) in sp['ripple']:
        t.put(x, y, ('wbog', sp['water'] + 1)); t.put(x + 1, y, ('wbog', sp['water'] + 1))
    for (x, y) in sp['glint']: t.put(x, y, ('wbog', sp['water'] + 2))
    # 둔덕 그림자 (남동)
    for (cx, cy, rx, ry) in sp['mounds']:
        ell(t, cx + 1.0, cy + 1.0, rx + .3, ry + .3, lambda dx, dy, d: ('wbog', sp['shadow']))
    for (cx, cy, rx, ry) in sp['mounds']:
        def fn(dx, dy, d, rx=rx, ry=ry):
            l = -(dx + dy) / 1.414
            if d > 1 - 1.0 / min(rx, ry) - .05:
                return ('wswamp', sp['rim_lit'] if l > .1 else (sp['rim_dark'] if l < -.2 else sp['rim_mid']))
            for th, tone in sp['bands']:
                if l > th: return ('wswamp', tone)
            return ('wswamp', sp['bands'][-1][1])
        ell(t, cx, cy, rx, ry, fn)
    # 갈대 세로 획
    for (x, y, h) in sp['reeds']:
        for k in range(h):
            t.put(x, y - k, ('wswamp', sp['reed_base'] if k == 0 else (sp['reed_tip'] if k == h - 1 else sp['reed_mid'])))
        t.put(x + 1, y, ('wswamp', sp['reed_base'] - 1 if sp['reed_base'] > 0 else 0))
    for (x, y) in sp.get('algae', []): t.put(x, y, ('wswamp', 1))
    return t

def sd_rrect(x, y, x0, y0, x1, y1, r):
    cx = min(max(x, x0 + r), x1 - r); cy = min(max(y, y0 + r), y1 - r)
    ox, oy = x - cx, y - cy
    if abs(x - (x0 + x1) / 2) <= (x1 - x0) / 2 - r and abs(y - (y0 + y1) / 2) <= (y1 - y0) / 2 - r: return -min(x - x0, x1 - x, y - y0, y1 - y)
    if x0 + r <= x <= x1 - r or y0 + r <= y <= y1 - r:
        return max(x0 - x, x - x1, y0 - y, y - y1)
    return math.hypot(ox, oy) - r

def region(x, y):
    """묶음 12칸 패치 (x,y) 가 늪 안인가"""
    xx, yy = x + .5, y + .5
    sd = sd_rrect(xx, yy, 16, 16, 96, 96, 10)
    w = WOB[(x if abs(xx - 56) >= abs(yy - 56) else y) % 16] if False else None
    ax, ay = abs(xx - 56), abs(yy - 56)
    w = WOB[(x % 16)] if ay >= ax else WOB[(y % 16)]
    return sd <= -(7 - w)

def patch(sp):
    t = tex(sp); cv = Cv(P, P)
    ins = [[region(x, y) for x in range(P)] for y in range(P)]
    def isin(x, y): return 0 <= x < P and 0 <= y < P and ins[y][x]
    for y in range(P):
        for x in range(P):
            if not ins[y][x]: continue
            v = t.get(x, y)
            edge = not (isin(x - 1, y) and isin(x + 1, y) and isin(x, y - 1) and isin(x, y + 1))
            if edge:
                up = not isin(x, y - 1) or not isin(x - 1, y)
                dn = not isin(x, y + 1) or not isin(x + 1, y)
                v = ('wbog', sp['rim_w_dark']) if dn else ('wbog', sp['rim_w_lit']) if up else v
            cv.put(x, y, v)
    # 번짐: 바깥 한 겹
    for y in range(P):
        for x in range(P):
            if ins[y][x]: continue
            if isin(x - 1, y) or isin(x + 1, y) or isin(x, y - 1) or isin(x, y + 1): cv.put(x, y, '-')
    return cv, t

def iso(sp, t):
    cv = Cv(16, 16)
    cx, cy, rx, ry = 8, 8.5, 6.2, 4.6
    inn = set()
    for y in range(16):
        for x in range(16):
            dx = (x + .5 - cx) / rx; dy = (y + .5 - cy) / ry
            if math.hypot(dx, dy) <= 1.0 - (0.03 if (x * 3 + y) % 5 == 0 else 0): inn.add((x, y))
    for (x, y) in inn:
        v = t.get(x + 5, y + 7)      # 몸통 무늬 옮겨 쓰기
        edge = not all(((x + a, y + b) in inn) for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        if edge:
            dn = (x, y + 1) not in inn or (x + 1, y) not in inn
            up = (x, y - 1) not in inn or (x - 1, y) not in inn
            v = ('wbog', sp['rim_w_dark']) if dn else ('wbog', sp['rim_w_lit']) if up else v
        cv.put(x, y, v)
    for y in range(16):
        for x in range(16):
            if (x, y) in inn: continue
            if any(((x + a, y + b) in inn) for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1))) and cv.get(x, y) is None: cv.put(x, y, '-')
    return [cv.a[y][:] for y in range(16)]

SP = {}
SP['A'] = dict(water=1, shadow=0, ripple=[(9, 14), (1, 9), (6, 12)], glint=[(14, 6)],
    mounds=[(4.5, 4.5, 4.6, 3.4), (11.5, 11, 4.0, 3.0), (12, 3, 2.4, 1.8)],
    bands=[(.35, 4), (-.15, 3), (-9, 2)], rim_lit=3, rim_mid=2, rim_dark=1,
    reeds=[(3, 4, 3), (12, 10, 3), (13, 3, 2)], reed_base=2, reed_mid=3, reed_tip=4,
    rim_w_dark=0, rim_w_lit=1, title='강남 결: 어두운 물 60%·이끼 둔덕 40%, 저대비, 갈대 세 다발')
SP['B'] = dict(water=0, shadow=0, ripple=[(9, 14), (1, 9), (6, 13), (14, 1)], glint=[(14, 6), (3, 12)],
    mounds=[(4.5, 4.5, 4.6, 3.4), (11.5, 11, 4.0, 3.0), (12, 3, 2.4, 1.8)],
    bands=[(.55, 5), (.2, 4), (-.2, 3), (-.55, 2), (-9, 1)], rim_lit=4, rim_mid=2, rim_dark=0,
    reeds=[(3, 4, 4), (12, 10, 4), (13, 3, 3), (7, 13, 3)], reed_base=1, reed_mid=3, reed_tip=5,
    rim_w_dark=0, rim_w_lit=2, title='빛·볼륨: 둔덕 5단 명암, 물은 짙게, 물빛 반짝 점, 갈대 네 다발')
SP['C'] = dict(water=1, shadow=0, ripple=[(2, 3), (10, 7), (5, 14), (13, 12)], glint=[(9, 8)],
    mounds=[(5.5, 10.5, 5.6, 3.0), (13.5, 4, 1.8, 1.4), (10.5, 2.2, 1.5, 1.2)],
    bands=[(.35, 4), (-.15, 3), (-9, 2)], rim_lit=3, rim_mid=2, rim_dark=1,
    reeds=[(3, 9, 5), (5, 9, 4), (8, 10, 3), (13, 4, 4), (0, 3, 3)], reed_base=2, reed_mid=3, reed_tip=4,
    algae=[(2, 6), (11, 14), (14, 9), (8, 5), (0, 14)],
    rim_w_dark=0, rim_w_lit=1, title='재해석: 물 75% 넓은 웅덩이에 긴 진흙 턱 하나·작은 둔덕·갈대 무리와 부유 이끼점')

def mk(X):
    sp = SP[X]
    cv, t = patch(sp)
    roles = {'body': cell(cv, 3, 3), 'edge_n': cell(cv, 3, 1), 'edge_s': cell(cv, 3, 5), 'edge_w': cell(cv, 1, 3), 'edge_e': cell(cv, 5, 3),
             'corner_nw': cell(cv, 1, 1), 'corner_ne': cell(cv, 5, 1), 'corner_sw': cell(cv, 1, 5), 'corner_se': cell(cv, 5, 5)}
    # body_alt: 무늬 4칸 옮겨 다른 배치
    alt = [[t.get(x + 8, y + 8) for x in range(16)] for y in range(16)]
    roles['body_alt'] = alt
    roles['inner'] = inner_from_body(roles['body'], dict(ramp='wbog', rim_lit=sp['rim_w_dark'] + 1, rim_dark=sp['rim_w_dark'], notch=5.4))
    roles['isolated'] = iso(sp, t)
    open(os.path.join(HERE0, '..', f'w4-{X}.pxg'), 'w').write(to_pxg(assemble(roles), 'swamp ' + X + ' — ' + sp['title']))

for X in 'ABC': mk(X)
