"""wv5 도우미 — 손으로 그린 수관/나무 도장(글자 격자)을 16px 주기 격자에 찍어 묶음 12칸(48x64)을 만든다.
모양·명암은 전부 손으로 적은 도장 표. 난수·수식 명암 없음. 남동 그림자는 덩이 가장자리 규칙(코드)으로만."""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, *(['..'] * 5)))
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'content', 'atlas-pick'))
from pxg_emit import emit
import math

P = 112

class Cv:
    def __init__(s, w, h): s.w, s.h = w, h; s.a = [[None] * w for _ in range(h)]
    def put(s, x, y, v):
        if 0 <= x < s.w and 0 <= y < s.h: s.a[y][x] = v
    def get(s, x, y): return s.a[y][x] if 0 <= x < s.w and 0 <= y < s.h else None
    def solid(s, x, y):
        v = s.get(x, y); return v is not None and not isinstance(v, str)

def parse(rows, ramp, anchor=None, maps=None):
    """도장: 숫자 = 램프 단, 글자(a-f 이외) 는 maps 로. '.' = 투명. 반환 (폭, 높이, {(x,y):(램프,단)}, 앵커)"""
    w = len(rows[0]); assert all(len(r) == w for r in rows), rows
    px = {}
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch == '.': continue
            if maps and ch in maps: px[(x, y)] = maps[ch]
            else: px[(x, y)] = (ramp, int(ch, 16))
    if anchor is None: anchor = (w // 2, len(rows) // 2)
    return dict(w=w, h=len(rows), px=px, anchor=anchor)

def stamp(cv, st, cx, cy, over=True):
    ax, ay = st['anchor']
    for (x, y), v in st['px'].items():
        X, Y = cx - ax + x, cy - ay + y
        if over or cv.get(X, Y) is None: cv.put(X, Y, v)

def trunk(cv, cx, cy, px_list, only_empty=True):
    for (dx, dy, v) in px_list:
        if not only_empty or cv.get(cx + dx, cy + dy) is None: cv.put(cx + dx, cy + dy, v)

def shadow_pass(cv, near=((1, 1), (1, 2), (2, 1), (1, 0), (0, 1)), far=((2, 2), (3, 2), (2, 3), (3, 3)), region=None):
    """덩이(불투명 화소)의 남동쪽 투명 칸에 반투명: 가까운 쪽 ~, 먼 쪽 -"""
    mask = [[cv.solid(x, y) for x in range(cv.w)] for y in range(cv.h)]
    add = {}
    for y in range(cv.h):
        for x in range(cv.w):
            if mask[y][x] or cv.a[y][x] is not None: continue
            hit = 0
            for (dx, dy) in near:
                if 0 <= x - dx < cv.w and 0 <= y - dy < cv.h and mask[y - dy][x - dx]: hit = 2; break
            if not hit:
                for (dx, dy) in far:
                    if 0 <= x - dx < cv.w and 0 <= y - dy < cv.h and mask[y - dy][x - dx]: hit = 1; break
            if hit: add[(x, y)] = '~' if hit == 2 else '-'
    for (x, y), c in add.items(): cv.a[y][x] = c

def cell(cv, cx, cy):
    return [[cv.a[cy * 16 + y][cx * 16 + x] for x in range(16)] for y in range(16)]

def notch_inner(body, radius=5.4, rim_dn=0, rim_up=0, ramp='wleaf'):
    rows = [r[:] for r in body]; gone = set()
    for (ox, oy) in ((0, 0), (16, 0), (0, 16), (16, 16)):
        for y in range(16):
            for x in range(16):
                if math.hypot(x + .5 - ox, y + .5 - oy) < radius: gone.add((x, y))
    for (x, y) in gone: rows[y][x] = None
    for y in range(16):
        for x in range(16):
            if rows[y][x] is None: continue
            up = (x, y - 1) in gone; lf = (x - 1, y) in gone; dn = (x, y + 1) in gone; rt = (x + 1, y) in gone
            if dn or rt: rows[y][x] = (ramp, rim_dn)
            elif up or lf: rows[y][x] = (ramp, rim_up)
    return rows

LAYOUT = [['isolated', 'body_alt', 'inner'], ['corner_nw', 'edge_n', 'corner_ne'],
          ['edge_w', 'body', 'edge_e'], ['corner_sw', 'edge_s', 'corner_se']]

def assemble(roles):
    rows = []
    for lr in LAYOUT:
        for y in range(16):
            row = []
            for r in lr: row += roles[r][y]
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

def roles_from_patch(cv, cv2, iso, inner_kw):
    r = {'body': cell(cv, 3, 3), 'edge_n': cell(cv, 3, 1), 'edge_s': cell(cv, 3, 5), 'edge_w': cell(cv, 1, 3), 'edge_e': cell(cv, 5, 3),
         'corner_nw': cell(cv, 1, 1), 'corner_ne': cell(cv, 5, 1), 'corner_sw': cell(cv, 1, 5), 'corner_se': cell(cv, 5, 5)}
    r['body_alt'] = cell(cv2, 3, 3)
    r['inner'] = notch_inner(r['body'], **inner_kw)
    r['isolated'] = iso
    return r

def write(path, roles, title, note):
    open(path, 'w').write(to_pxg(assemble(roles), title))
    open(path[:-4] + '.note', 'w').write(note.strip() + '\n')

# ---- 격자 패치 ----
LAT_X = (19.4, 92.6)

def lattice_pos(rows_y, x_lo=19.4, x_hi=92.6):
    """rows_y: [(y, [x mod16 ...])] 를 패치 좌표(0..112)로 펼친다. 16px 주기."""
    out = []
    for (yb, xs) in rows_y:
        for ky in range(-1, 8):
            y = yb + ky * 16
            if not (19.4 <= y <= 92.6): continue
            for xb in xs:
                for kx in range(-1, 8):
                    x = xb + kx * 16
                    if x_lo <= x <= x_hi: out.append((x, y, xb, yb))
    return sorted(out, key=lambda t: (t[1], t[0]))

def render_patch(items, pick, ground, y_max, trunkfn=None, r0=24, r1=88, r1y=None):
    """items = lattice_pos 결과, pick(xb,yb)->도장. ground=(램프,단). y_max 이하 중심만."""
    cv = Cv(P, P)
    r1y = r1y or r1
    for y in range(r0, r1y):
        for x in range(r0, r1): cv.put(x, y, ground)
    its = [t for t in items if t[1] <= y_max]
    if trunkfn:
        for (x, y, xb, yb) in its: trunkfn(cv, x, y, xb, yb)
    for (x, y, xb, yb) in its: stamp(cv, pick(xb, yb), x, y)
    return cv

def iso_cell(specs, trunkfn=None):
    cv = Cv(16, 16)
    if trunkfn:
        for (st, x, y) in specs: trunkfn(cv, x, y, None, None)
    for (st, x, y) in specs: stamp(cv, st, x, y)
    return cv

def build_bundle(out_dir, name, rows_def, pick, pick2, iso_specs, trunkfn, ground, title, note, y_max=84, inner_kw=None, shadow=True, r1y=None, iso_fn=None):
    it = lattice_pos(rows_def)
    cv = render_patch(it, pick, ground, y_max, trunkfn, r1y=r1y)
    cv2 = render_patch(it, pick2, ground, y_max, trunkfn, r1y=r1y)
    iso = iso_cell(iso_specs, trunkfn)
    if shadow:
        shadow_pass(cv); shadow_pass(cv2); shadow_pass(iso)
    roles = roles_from_patch(cv, cv2, [r[:] for r in iso.a], inner_kw or dict(radius=5.4, rim_dn=0, rim_up=1))
    write(os.path.join(out_dir, f'wv5-{name}.pxg'), roles, title, note)
    return cv
