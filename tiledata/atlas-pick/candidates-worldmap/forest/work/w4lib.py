"""w4 작업자 도우미 — 손으로 정한 나무 좌표(16px 주기 격자)를 화소로 옮겨 묶음 12칸을 만든다.
난수·노이즈 없음. 나무 위치·반지름·단 나눔은 전부 스타일 표에 손으로 적은 값이다."""
import math, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', '..', '..', '..', 'scripts', 'content', 'atlas-pick'))
from pxg_emit import emit

LAT = (19.4, 19.4, 92.6, 92.6)
P = 112            # 패치 한 변 (7칸)
R0, R1 = 24, 88    # 숲 영역 (칸 1~5 의 안쪽 절반부터)

class Cv:
    def __init__(s, w, h): s.w, s.h = w, h; s.a = [[None] * w for _ in range(h)]
    def put(s, x, y, v):
        if 0 <= x < s.w and 0 <= y < s.h: s.a[y][x] = v
    def get(s, x, y): return s.a[y][x] if 0 <= x < s.w and 0 <= y < s.h else None

def hi(x, y, m): return (x * 7 + y * 13 + x * y) % m == 0

# ---- 둥근 수관 ----
def round_tree(cv, cx, cy, rx, ry, st, trunk=True):
    ramp = st['ramp']; bands = st['bands']            # bands = [(임계, 단)...] l 큰 순
    if trunk:
        bx = int(math.floor(cx - 0.5)); by0 = int(math.floor(cy + ry - 2))
        for yy in range(by0, by0 + st.get('trunk_len', 4)):
            cv.put(bx, yy, ('wbark', 2)); cv.put(bx + 1, yy, ('wbark', 1))
        cv.put(bx, by0 + st.get('trunk_len', 4) - 1, ('wbark', 1))
    for y in range(int(cy - ry - 2), int(cy + ry + 3)):
        for x in range(int(cx - rx - 2), int(cx + rx + 3)):
            dx = (x + .5 - cx) / rx; dy = (y + .5 - cy) / ry; d = math.hypot(dx, dy)
            if d > 1.0: continue
            l = -(dx + dy) / 1.414
            rim = d > 1.0 - 1.0 / min(rx, ry)
            if rim:
                t = st['rim_lit'] if l > 0.1 else (st['rim_dark'] if l < -0.25 else st['rim_mid'])
            else:
                t = bands[-1][1]
                for th, tone in bands:
                    if l > th: t = tone; break
                if l > 0.05 and hi(x, y, st.get('speck', 11)): t = max(1, t - 1)
                if l < -0.1 and hi(x + 3, y + 5, st.get('speck2', 13)): t = min(st['top'], t + 1)
            cv.put(x, y, (ramp, t))
    # 밝은 잎 한두 점
    hx, hy = int(round(cx - rx * .38 - .5)), int(round(cy - ry * .4 - .5))
    if st.get('spark', True):
        cv.put(hx, hy, (ramp, st['top'])); cv.put(hx + 1, hy, (ramp, st['top'] - 1)); cv.put(hx, hy + 1, (ramp, st['top'] - 1))

# ---- 전나무 ----
FIR_M = {'tiers': [[1, 3, 3], [3, 5, 5], [5, 7, 7]], 'trunk': 2}
FIR_T = {'tiers': [[1, 3], [3, 5], [5, 7], [7, 9]], 'trunk': 2}     # 키 큰 4단
FIR_S = {'tiers': [[1, 3], [3, 5, 5]], 'trunk': 2}                 # 작은 2단

def fir_tree(cv, cx, by, st, shape=FIR_M):
    """cx = 중심 열, by = 몸통 맨 아래 줄. 위로 그린다."""
    ramp = st['ramp']; rows = []
    for ti, tier in enumerate(shape['tiers']):
        for ri, w in enumerate(tier): rows.append((w, ti, ri, len(tier)))
    total = len(rows) + shape['trunk']; y0 = by - total + 1
    # 몸통
    for k in range(shape['trunk']):
        yy = by - k
        cv.put(cx, yy, ('wbark', 2 if k else 1))
        if st.get('trunk2', True): cv.put(cx + 1, yy, ('wbark', 1))
    for i, (w, ti, ri, n) in enumerate(rows):
        y = y0 + i; half = (w - 1) // 2; last = (ri == n - 1)
        for x in range(cx - half, cx + half + 1):
            c = x - cx
            if x == cx - half:  t = st['edge_l']
            elif x == cx + half: t = st['edge_r']
            elif c < 0: t = st['lit']
            elif c == 0: t = st['mid']
            else: t = st['shade']
            if last and half >= 1 and x != cx - half and x != cx + half:
                t = max(st.get('floor', 0), t - st.get('under', 1))
            if ri == 0 and ti > 0 and c <= 0 and half >= 1 and x != cx - half:
                t = min(st['top'], t + st.get('tierhi', 1))
            v = (ramp, t)
            if st.get('snow') and ri < st['snow'] and x != cx + half and c <= st.get('snow_reach', 1) and (ti == 0 or ri == 0 or c < 0):
                v = ('wsnow', st['snow_tone'](c, ri, half))
            cv.put(x, y, v)
    if st.get('apex'): cv.put(cx, y0, (ramp, st['top']))

# ---- 그림자 (남동, 투명 칸에만) ----
def foot_shadow(cv, spots, ch='~'):
    for (x, y, n) in spots:
        for k in range(n):
            if cv.get(x + k, y) is None: cv.put(x + k, y, ch)

# ---- 묶음 조립 ----
def lattice(trees, kind_fn, x0, x1, y0, y1):
    x0,y0,x1,y1=LAT
    items = []
    for kx in range(-2, 9):
        for ky in range(-2, 9):
            for t in trees:
                cx = t[0] + kx * 16; cy = t[1] + ky * 16
                if x0 <= cx < x1 and y0 <= cy < y1: items.append((cy + (t[3] if len(t) > 3 else 0), cx, t, kx, ky))
    items.sort(key=lambda z: (z[0], z[1]))
    return items

def patch_render(trees, draw, st, ground, shadow_fn=None):
    cv = Cv(P, P)
    for y in range(R0, R1):
        for x in range(R0, R1): cv.put(x, y, ground)
    for _, cx, t, kx, ky in lattice(trees, None, R0, R1, R0, R1):
        draw(cv, cx, t[1] + ky * 16, t, st)
    if shadow_fn: shadow_fn(cv)
    return cv

def cell(cv, cx, cy):
    return [[cv.a[cy * 16 + y][cx * 16 + x] for x in range(16)] for y in range(16)]

def inner_from_body(body, st):
    rows = [r[:] for r in body]
    gone = set()
    for (ox, oy) in ((0, 0), (15, 0), (0, 15), (15, 15)):
        for y in range(16):
            for x in range(16):
                if math.hypot(abs(x - ox) + .5 - .5 * 0, abs(y - oy) + .5 - .5 * 0) < st.get('notch', 5.2) - (0 if True else 0):
                    gone.add((x, y))
    # 노치: 귀 (0,0)에서 거리(화소 중심 기준)로 잘라 냄
    gone = set()
    for (ox, oy) in ((0, 0), (16, 0), (0, 16), (16, 16)):
        for y in range(16):
            for x in range(16):
                if math.hypot(x + .5 - ox, y + .5 - oy) < st.get('notch', 5.4): gone.add((x, y))
    for (x, y) in gone: rows[y][x] = None
    ramp = st['ramp']
    for (x, y) in gone:
        pass
    for y in range(16):
        for x in range(16):
            if rows[y][x] is None: continue
            up = (x, y - 1) in gone; lf = (x - 1, y) in gone; dn = (x, y + 1) in gone; rt = (x + 1, y) in gone
            if dn or rt: rows[y][x] = (ramp, st['rim_dark'])
            elif up or lf: rows[y][x] = (ramp, st['rim_lit'])
    return rows

def isolated(draw_list, st, shadow):
    cv = Cv(16, 16)
    for fn in draw_list: fn(cv, st)
    foot_shadow(cv, shadow)
    return [cv.a[y][:] for y in range(16)]

def assemble(cells_by_role):
    layout = [['isolated', 'body_alt', 'inner'], ['corner_nw', 'edge_n', 'corner_ne'],
              ['edge_w', 'body', 'edge_e'], ['corner_sw', 'edge_s', 'corner_se']]
    rows = []
    for lr in layout:
        for y in range(16):
            row = []
            for r in lr: row += cells_by_role[r][y]
            rows.append(row)
    return rows

def to_pxg(rows, title):
    letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    legend = {}; rev = {}; out = []
    for r in rows:
        s = ''
        for v in r:
            if v is None: s += '.'
            elif isinstance(v, str): s += v
            else:
                if v not in rev:
                    ch = letters[len(rev)]; rev[v] = ch; legend[ch] = v
                s += rev[v]
        out.append(s)
    return emit(out, legend, title)

def bundle(trees, draw, st, ground, iso_draw, iso_shadow, alt_st=None, shadow_fn=None, title=''):
    cv = patch_render(trees, draw, st, ground, shadow_fn)
    roles = {'body': cell(cv, 3, 3), 'edge_n': cell(cv, 3, 1), 'edge_s': cell(cv, 3, 5), 'edge_w': cell(cv, 1, 3), 'edge_e': cell(cv, 5, 3),
             'corner_nw': cell(cv, 1, 1), 'corner_ne': cell(cv, 5, 1), 'corner_sw': cell(cv, 1, 5), 'corner_se': cell(cv, 5, 5)}
    if alt_st is None: alt_st = dict(st, speck=st.get('speck', 11) + 2, speck2=st.get('speck2', 13) + 4)
    cv2 = patch_render(trees, draw, alt_st, ground)
    roles['body_alt'] = cell(cv2, 3, 3)
    roles['inner'] = inner_from_body(roles['body'], st)
    roles['isolated'] = isolated(iso_draw, st, iso_shadow)
    return roles, cv
