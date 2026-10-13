#!/usr/bin/env python3
"""desert_east 실내 — 바닥(16 주기 무늬) · 벽면(1×2, 위 들보·아래 징두리) · 천장 가장자리 · 가구·기물.

방 여섯 가지: 찻집 · 가게(바자르) · 궁전 · 무덤 · 목욕탕(함맘) · 여관.
3/4 탑뷰: 서 있는 기물은 윗면(밝음, 뒤 가장자리 어두운 선)과 남쪽 앞면(한두 단 어둡게)을 모두 보인다. 그릇·항아리는 아가리 안쪽(타원 ≥4줄).
빛은 왼쪽 위. 사람 16×24 기준: 탁자 윗면은 허리 높이, 침상은 한 사람 길이.
천장 가장자리: ceil-w = 방 서쪽 경계(테가 동쪽 변), ceil-e = 방 동쪽 경계(테가 서쪽 변), ceil-s = 방 남쪽 경계(테가 북쪽 변),
ceil-sw / ceil-se = 바깥 모서리(테가 북+동 / 북+서). 테는 두꺼운 벽 윗면이 밝게 보이는 줄.

  python3 interior.py [--room /tmp/de_int_room.png]   # tiledata/desert-east/interior/_gate/de-*.png + items.jsonl + preview.png
"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from px import C, rnd, h32, NT, MI, box3
from kit import Reg, contact, OUT
from bparts import arch_mask, pointed_mask, mask_border

R = Reg('interior')


def top(m): return NT[MI[m]] - 1


def cl(m, t): return (m, max(0, min(top(m), int(round(t)))))


def vnoise(x, y, s, cell=4, per=16):
    n = per // cell
    gx, gy = x / cell, y / cell
    x0, y0 = int(math.floor(gx)), int(math.floor(gy)); fx, fy = gx - x0, gy - y0
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy)
    v = lambda i, j: rnd(i % n, j % n, s)
    a = v(x0, y0) * (1 - fx) + v(x0 + 1, y0) * fx
    b = v(x0, y0 + 1) * (1 - fx) + v(x0 + 1, y0 + 1) * fx
    return a * (1 - fy) + b * fy


def G(c, x, y, rows, key):
    """행 문자열 도트. '.'/' ' = 건너뜀. key[ch] = (mat, t)."""
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch in '. ': continue
            c.P(x + i, y + j, *key[ch])


def lum(dx, dy, nz=None):
    """구면 밝기(빛 왼쪽 위) 대략 -0.8..1.0."""
    if nz is None: nz = math.sqrt(max(0.0, 1 - dx * dx - dy * dy))
    return -0.5 * dx - 0.45 * dy + 0.55 * nz


def ramp_t(L, lo, hi):
    return int(round(lo + max(0.0, min(1.0, (L + 0.45) / 1.4)) * (hi - lo)))


def cyl(c, cx, cy, rx, ry, h, top_fn, side_fn):
    """세운 원통/그릇: 윗면 타원(top_fn(x,y,dx,dy)) + 앞면 띠(side_fn(x,y,dx,depth))."""
    for y in range(int(cy - ry - 2), int(cy + ry + h + 2)):
        for x in range(int(cx - rx - 2), int(cx + rx + 2)):
            dx = (x + 0.5 - cx) / rx
            if abs(dx) > 1: continue
            e = ry * math.sqrt(1 - dx * dx); yc = y + 0.5
            if cy - e <= yc <= cy + e: r = top_fn(x, y, dx, (yc - cy) / ry)
            elif cy + e < yc <= cy + e + h: r = side_fn(x, y, dx, yc - (cy + e))
            else: continue
            if r: c.P(x, y, *r)


def flame(c, cx, ybot, h, w, s=0):
    """불꽃: 아래 넓고 위 뾰족, 가운데 밝은 심(fire 4) → 바깥 fire 2 → 끝 fire 1."""
    for j in range(h):
        y = ybot - j; u = j / max(1, h - 1)
        half = w / 2 * (1 - u ** 1.3) + 0.35
        off = math.sin(u * 4.2 + s) * 0.9 * u
        for x in range(int(cx - w), int(cx + w + 1)):
            dx = (x + 0.5 - (cx + off)) / half
            if abs(dx) > 1: continue
            if u > 0.82: t = 2 if abs(dx) < 0.5 else 1
            elif abs(dx) < 0.38 and u < 0.62: t = 4
            elif abs(dx) < 0.75: t = 3
            else: t = 2
            c.P(x, y, 'fire', t)


def coals(c, cx, cy, rx, ry, s=0):
    """그릇 아가리 안 숯불: 안쪽 뒤 벽 어둡게, 숯 덩이 + 빨간 불씨."""
    def f(x, y, dx, dy, d):
        if dy < -0.35: return ('sumi', 1)
        r = rnd(x, y, s)
        if r < 0.28: return ('fire', 2)
        if r < 0.42: return ('fire', 3)
        if r > 0.85: return ('sumi', 2)
        return ('fire', 1)
    c.ell(cx, cy, rx, ry, f)


def pot(c, x, yb, w, h, mat='adobe', band=None, mouth=True):
    """작은 항아리(선반 위 등): x = 왼쪽, yb = 바닥 줄. 몸은 구면 명암, 아가리 어두운 점."""
    cx = x + w / 2; cy = yb - h / 2 + 0.5
    n = top(mat)
    c.ell(cx, cy + 0.5, w / 2, h / 2, lambda X, Y, dx, dy, d: cl(mat, ramp_t(lum(dx, dy), 1, n - 1)))
    if mouth:
        mw = max(2, w // 2); mx = int(cx - mw / 2)
        c.HL(mx, yb - h, mw, mat, n - 1); c.HL(mx, yb - h + 1, mw, 'sumi', 1)
    if band:
        for i in range(w):
            if c.on(x + i, int(cy)): c.P(x + i, int(cy), band[0], band[1] - (1 if i > w * 0.6 else 0))
    c.HL(x + 1, yb, w - 2, mat, 0)


def tray_ell(c, cx, cy, rx, ry, mat, base, rim=True):
    def f(x, y, dx, dy, d):
        t = base
        if rim and d > 0.68:
            t = base + 1 if (dx + dy) < 0.2 else base - 1
        elif rim and d > 0.5:
            t = base - 1 if (dx + dy) < 0 else base
        if d < 0.5 and (dx * 1.4 + dy) < -0.55: t = base + 1
        return cl(mat, t)
    c.ell(cx, cy, rx, ry, f)


def glass(c, x, y, tea='red'):
    """찻잔(유리, 차가 담김) 2×4: 금 테 · 반사 · 붉은 차 · 받침."""
    G(c, x, y, ['Gg', 'wr', 'rR', 'dd'], dict(G=('gold', 5), g=('gold', 4), w=('plaster', 5), r=(tea, 3), R=(tea, 2), d=('gold', 1)))


def teapot(c, x, y, mat='marble'):
    """모로코 은 주전자 9×8(뚜껑 꼭지·손잡이·위로 휜 부리)."""
    G(c, x, y, [
        '....o....',
        '...oGo...',
        '..oGggo.o',
        'hoGgggmoo',
        'hoggggmd.',
        'hoggmmmdo',
        '.ogmmmddo',
        '..oddddo.',
    ], dict(o=(mat, 1), G=(mat, 5), g=(mat, 4), m=(mat, 3), d=(mat, 2), h=(mat, 2)))


# ═════════════════════════════ A. 바닥 ═════════════════════════════
def F1(id_, name, tags, rules, fn, **kw):
    def draw(c):
        for y in range(16):
            for x in range(16): c.P(x, y, *fn(x, y))
    R.add(id_, name, 1, 1, 'terrain', tags=tags, rules=rules, **kw)(draw)


def zellige(x, y, s=1, chip=False):
    """찻집 젤리주: 8px 팔각 유약 타일(회백, 모서리 깎임·빗면) + 줄눈 교차점마다 청록 마름모 박이(군청·금 심, 두 가지 번갈아)."""
    x %= 16; y %= 16
    u, v = x % 8, y % 8
    # 가장 가까운 줄눈 교차점((7,7) 주기 8)까지 거리
    du = ((u - 7 + 4) % 8) - 4; dv = ((v - 7 + 4) % 8) - 4
    md = abs(du) + abs(dv)
    ix, iy = ((x + 1) // 8) % 2, ((y + 1) // 8) % 2
    alt = (ix + iy) % 2
    if md == 0: return ('gold', 4) if alt == 0 else ('lapis', 3)
    if md == 1: return ('lapis', 2) if alt == 0 else ('turq', 4)
    if md == 2: return ('turq', 3) if alt == 0 else ('turq', 2)
    if md == 3: return ('plaster', 1)                       # 박이 둘레 줄눈
    if u == 7 or v == 7: return ('plaster', 1)
    t = 3 + (1 if h32(x // 8, y // 8, s) % 4 == 0 else 0)
    if u == 0 or v == 0: t += 1
    elif u == 6 or v == 6: t -= 1
    if (u, v) in ((1, 1), (2, 1), (1, 2)): t = 5
    if chip and (x // 8, y // 8) == (1, 0) and (u, v) in ((4, 4), (5, 4), (4, 5)): t = 1
    return cl('plaster', t)


def planks(x, y, s=3, knot=0.012):
    """여관 널마루: 가로 판자(높이 4, 틈 1), 판자 길이 16 · 줄마다 이음매 하나, 나뭇결 줄·옹이."""
    x %= 16; y %= 16
    row = y // 4; ly = y % 4
    if ly == 3: return ('wood', 1) if rnd(x, row, s) < 0.8 else ('dwood', 2)
    j1 = (h32(row, 0, s) % 4) * 4 + 1 + row * 5
    j1 %= 16
    if x == j1: return ('wood', 1)
    base = 3 if h32(row, 1, s + 5) % 3 else 2
    t = base
    if ly == 0: t += 1
    gx = (x - j1) % 16
    if ly == 1 and rnd(gx // 4, row, s + 4) < 0.35: t -= 1
    if ly == 2 and rnd(gx // 3 + 5, row, s + 2) < 0.4: t -= 1
    if gx == 1: t += 1
    if gx == 15: t -= 1
    if rnd(x, y, s + 9) < knot and ly in (1, 2): return ('dwood', 2)
    return cl('wood', t)


def flagstones(x, y, s=7, tone=3):
    """가게 사암 포석: 줄 높이 6·5·5, 엇갈린 큰 돌, 줄눈에 모래."""
    x %= 16; y %= 16
    rows = ((0, 6, 3, (7, 9)), (6, 5, 11, (10, 6)), (11, 5, 6, (5, 6, 5)))
    for y0, hh, off, widths in rows:
        if y0 <= y < y0 + hh: break
    ly = y - y0; xs = (x + off) % 16; acc = 0
    for i, wv in enumerate(widths):
        if xs < acc + wv: col, lx, wc = i, xs - acc, wv; break
        acc += wv
    if ly == hh - 1 or lx == wc - 1:
        return ('sand', 2) if rnd(x, y, s + 1) < 0.25 else ('stone', 1)
    v = h32(col, y0, s) % 4
    t = tone + (1 if v == 0 else -1 if v == 3 else 0)
    if ly == 0 or lx == 0: t += 1
    if ly == hh - 2 and lx > 0: t -= 1
    q = rnd(x, y, s + 3)
    if q < 0.06: t -= 1
    elif q > 0.96: t += 1
    return cl('stone', t)


def marble(x, y, s=5, inlay='gold'):
    """궁전 대리석: 8px 판 체크(밝은·덜 밝은) + 옅은 결 + 16 주기 금 상감 줄과 교차점 군청 마름모."""
    x %= 16; y %= 16
    wx = min(x, 16 - x); wy = min(y, 16 - y)
    if wx + wy <= 1: return ('lapis', 3 if (x + y) % 2 else 2)
    if x == 0 or y == 0: return (inlay, 4 if (x + y) % 3 else 5)
    if x == 1 or y == 1: return ('marble', 2)                               # 상감 옆 그늘
    if x == 8 or y == 8: return ('marble', 3)                               # 판 이음
    base = 5 if (x // 8 + y // 8) % 2 == 0 else 4
    t = base
    v = vnoise(x, y, s, 8)
    if abs(v - 0.5) < 0.035: t = base - 2
    elif abs(vnoise(x, y, s + 3, 4) - 0.5) < 0.03: t = base - 1
    if x % 8 == 2 or y % 8 == 2: t = min(t, 5)
    if (x % 8 == 7 or y % 8 == 7) and t == base: t -= 1
    return cl('marble', t)


def tombfloor(x, y, s=9, drift=False):
    """무덤 석회암 블록: 높이 8, 길이 10·6/7·9, 낮은 단, 먼지 낱알, 금 간 돌. drift = 줄눈에 모래 + 모래 덩이 하나."""
    x %= 16; y %= 16
    row = y // 8; ly = y % 8
    off = (0, 5)[row]; xs = (x + off) % 16
    widths = ((10, 6), (7, 9))[row]
    col, lx, wc = (0, xs, widths[0]) if xs < widths[0] else (1, xs - widths[0], widths[1])
    if drift:
        dx = ((x - 5 + 8) % 16) - 8; dy = ((y - 11 + 8) % 16) - 8
        e = (dx / 6.0) ** 2 + (dy / 3.6) ** 2 + (rnd(x, y, s) - 0.5) * 0.25
        if e < 1:
            t = 4 if dy < -1 and dx < 2 else 3
            if e > 0.75 and dy > 0: t = 2
            if rnd(x, y, s + 2) < 0.12: t += 1
            return cl('sand', t)
    joint = ly == 7 or lx == wc - 1
    if joint: return ('sand', 2) if (drift and rnd(x, y, s + 4) < 0.6) or rnd(x, y, s) < 0.2 else ('stone', 0)
    t = 2 + (1 if h32(col, row, s) % 3 == 0 else 0)
    if ly == 0 or lx == 0: t += 1
    if ly == 6: t -= 1
    if rnd(x, y, s + 5) < 0.05: return ('sand', 2)
    if rnd(x, y, s + 7) < 0.05: t -= 1
    if h32(col, row, s + 1) % 4 == 0 and lx == (ly + 2) % wc and 1 < ly < 6: t = 0      # 금
    return cl('stone', t)


F1('floor-zellige', '찻집 젤리주 타일 바닥', ['찻집', '바닥', '타일'], '찻집·회당 바닥. -b 와 섞어 깐다.', lambda x, y: zellige(x, y, 1))
F1('floor-zellige-b', '찻집 젤리주 타일 바닥(이 빠진)', ['찻집', '바닥', '타일'], 'floor-zellige 사이에 드문드문.', lambda x, y: zellige(x, y, 4, chip=True))
F1('floor-wood', '여관 널마루', ['여관', '바닥', '나무'], '여관·민가 방. -b 와 섞는다.', lambda x, y: planks(x, y, 3))
F1('floor-wood-b', '여관 널마루(변주)', ['여관', '바닥', '나무'], 'floor-wood 와 섞는다.', lambda x, y: planks(x, y, 17, knot=0.03))
F1('floor-flag', '가게 사암 포석', ['가게', '바닥', '포석'], '가게·바자르 실내·여관 부엌. -b 와 섞는다.', lambda x, y: flagstones(x, y, 7))
F1('floor-flag-b', '가게 사암 포석(변주)', ['가게', '바닥', '포석'], 'floor-flag 와 섞는다.', lambda x, y: flagstones(x, y, 31))
F1('floor-marble', '궁전 대리석 바닥', ['궁전', '목욕탕', '바닥', '대리석'], '궁전 홀·목욕탕. 금 상감 줄이 칸 경계에 맞물린다.', lambda x, y: marble(x, y, 5))
F1('floor-marble-b', '궁전 대리석 바닥(변주)', ['궁전', '목욕탕', '바닥', '대리석'], 'floor-marble 과 섞는다.', lambda x, y: marble(x, y, 23))
F1('floor-tomb', '무덤 석회암 바닥', ['무덤', '바닥', '돌'], '무덤·지하 묘실. -b(모래 들이침)를 문·구석 쪽에 덩이로.', lambda x, y: tombfloor(x, y, 9))
F1('floor-tomb-b', '무덤 석회암 바닥(모래 들이침)', ['무덤', '바닥', '돌', '모래'], '입구·무너진 구석에 덩이로.', lambda x, y: tombfloor(x, y, 21, drift=True))


# ═════════════════════════════ B. 벽면(1×2) ═════════════════════════════
WALL_RULE = '방 북쪽 벽 줄(천장 바로 아래 2칸). 가로로 이어 깐다. 위는 천장(ceil), 아래는 바닥.'


def W2(id_, name, tags, rules=WALL_RULE):
    return R.add(id_, name, 1, 2, 'terrain', tags=tags, rules=rules)


def wall_plaster_body(c, s=1):
    for y in range(32):
        for x in range(16):
            t = 4
            r = rnd(x, y, s)
            if r < 0.05: t = 3
            elif r > 0.97: t = 5
            if (y + h32(x // 5, 0, s) % 3) % 7 == 0 and rnd(x // 3, y, s + 3) < 0.4: t = 3
            c.P(x, y, 'plaster', t)
    # 들보(어두운 나무) + 들보 끝 그늘
    c.HL(0, 0, 16, 'dwood', 1); c.HL(0, 1, 16, 'dwood', 4); c.HL(0, 2, 16, 'dwood', 3); c.HL(0, 3, 16, 'dwood', 1)
    for x in range(16):
        if x % 8 == 3: c.P(x, 2, 'dwood', 2)
    c.HL(0, 4, 16, 'plaster', 1); c.HL(0, 5, 16, 'plaster', 3)
    # 징두리 갓돌 + 젤리주 띠
    c.HL(0, 17, 16, 'plaster', 3); c.HL(0, 18, 16, 'plaster', 5); c.HL(0, 19, 16, 'plaster', 2); c.HL(0, 20, 16, 'turq', 0)
    for y in range(21, 30):
        v = y - 21
        for x in range(16):
            u = x % 8
            if v == 4 or u == 7: c.P(x, y, 'plaster', 2); continue
            tx, ty = x // 8, v // 5; lu, lv = u, v % 5
            du, dv = lu - 3, lv - 1.5
            d = abs(du) + abs(dv)
            if (tx + ty) % 2 == 0:
                m, t = ('lapis', 2) if d <= 1.5 else ('turq', 3)
                if d < 0.6: m, t = 'gold', 4
            else:
                m, t = ('turq', 3) if d <= 1.5 else ('plaster', 4)
            if lu == 0 or lv == 0: t += 1
            elif lu == 6 or lv == 3: t -= 1
            c.P(x, y, *cl(m, t))
    c.HL(0, 30, 16, 'turq', 1); c.HL(0, 31, 16, 'sumi', 1)


W2('wall-plaster', '회칠 벽(청록 타일 징두리)', ['찻집', '여관', '벽'])(wall_plaster_body)


@W2('wall-window-plaster', '회칠 벽(나무 격자 창)', ['찻집', '여관', '벽', '창'], '회칠 벽 줄 사이에 2~4칸마다 하나. 창끼리 붙이지 않는다.')
def _(c):
    wall_plaster_body(c)
    m = pointed_mask(8, 10, rise=5)
    x0, y0 = 4, 6
    for (i, j) in m:
        for dx, dy in ((-1, 0), (1, 0), (0, -1), (-1, -1), (1, -1)):
            if (i + dx, j + dy) not in m:
                c.P(x0 + i + dx, y0 + j + dy, 'dwood', 3 if dx <= 0 else 1)
    for (i, j) in m:
        lat = (i + j) % 3 == 0 or (i - j) % 3 == 0
        if lat: c.P(x0 + i, y0 + j, 'dwood', 2 if j > 2 else 1)
        else: c.P(x0 + i, y0 + j, 'sand', 6 if i < 4 else 5)
    c.HL(x0 - 2, y0 + 10, 12, 'plaster', 5); c.HL(x0 - 2, y0 + 11, 12, 'plaster', 2); c.HL(x0 - 1, y0 + 12, 10, 'plaster', 3)


def ashlar(c, y0, y1, s=2, base=3, course=6, blen=8):
    for y in range(y0, y1):
        for x in range(16):
            row = (y - y0) // course; ly = (y - y0) % course
            xs = (x + (blen // 2 if row % 2 else 0)) % 16; col = xs // blen; lx = xs % blen
            if ly == course - 1 or lx == blen - 1: c.P(x, y, 'stone', base - 2); continue
            v = h32(col, row, s) % 5
            t = base + (1 if v == 0 else -1 if v == 4 else 0)
            if ly == 0 and lx < blen - 2: t += 1
            if lx == 0: t += 1 if ly < course - 2 else 0
            if ly == course - 2: t -= 1
            if rnd(x, y, s + 3) < 0.07: t -= 1
            c.P(x, y, *cl('stone', t))


def wall_stone_body(c, s=2):
    ashlar(c, 4, 26, s)
    c.HL(0, 0, 16, 'stone', 1); c.HL(0, 1, 16, 'stone', 6); c.HL(0, 2, 16, 'stone', 4); c.HL(0, 3, 16, 'stone', 1)
    for x in range(0, 16, 4): c.P(x, 2, 'stone', 3)
    c.HL(0, 4, 16, 'stone', 2)
    c.HL(0, 25, 16, 'stone', 1); c.HL(0, 26, 16, 'stone', 5)
    for y in range(27, 31):
        for x in range(16):
            xs = (x + 3) % 16
            t = 2 if xs not in (0, 15) else 1
            if y == 27: t = 3
            if xs == 15: t = 1
            if rnd(x, y, s + 9) < 0.08: t -= 1
            c.P(x, y, 'stone', t)
    c.HL(0, 31, 16, 'stone', 0)


W2('wall-stone', '사암 마름돌 벽', ['가게', '여관', '벽', '돌'])(wall_stone_body)


@W2('wall-niche-stone', '사암 벽(등잔 벽감)', ['가게', '여관', '벽', '등잔'], '사암 벽 줄 사이 3~5칸마다 하나. 어두운 방의 불빛 자리.')
def _(c):
    wall_stone_body(c)
    m = arch_mask(8, 12)
    x0, y0 = 4, 8
    for (i, j) in m:
        for dx, dy in ((-1, 0), (1, 0), (0, -1)):
            if (i + dx, j + dy) not in m: c.P(x0 + i + dx, y0 + j + dy, 'stone', 5 if dx <= 0 and dy <= 0 else 2)
    for (i, j) in m:
        t = 1 if j < 4 else 2
        if i == 0: t = 0
        if i == 7: t = 3
        # 등잔 불빛이 벽감 안을 데운다
        d = math.hypot(i - 3.5, j - 6)
        if d < 2.5: t += 2
        elif d < 4: t += 1
        c.P(x0 + i, y0 + j, *cl('stone', t))
    c.HL(x0 - 1, y0 + 12, 10, 'stone', 6); c.HL(x0 - 1, y0 + 13, 10, 'stone', 2)
    # 놋 등잔
    G(c, x0 + 1, y0 + 6, [
        '...f..',
        '..fFf.',
        '...f..',
        '.gGg..',
        'gGggdd',
        '.mddd.',
    ], dict(f=('fire', 2), F=('fire', 4), g=('gold', 4), G=('gold', 5), m=('gold', 3), d=('gold', 2)))


@W2('wall-palace', '궁전 대리석 벽(금테 뾰족 아치 판)', ['궁전', '벽', '대리석'])
def _(c):
    for y in range(32):
        for x in range(16):
            t = 4
            if abs(vnoise(x, y, 41, 8, 16) - 0.5) < 0.03: t = 3
            c.P(x, y, 'marble', t)
    c.HL(0, 0, 16, 'gold', 1); c.HL(0, 1, 16, 'gold', 5); c.HL(0, 2, 16, 'gold', 3); c.HL(0, 3, 16, 'gold', 1)
    for y in (4, 5, 6):
        for x in range(16):
            t = 3 if y == 4 else 2 if y == 5 else 1
            if y == 5 and x % 4 == 1: c.P(x, y, 'gold', 4); continue
            c.P(x, y, 'lapis', t)
    c.HL(0, 7, 16, 'marble', 1); c.HL(0, 8, 16, 'marble', 3)
    m = pointed_mask(10, 15, rise=7)
    x0, y0 = 3, 9
    ring1 = {(i, j) for (i, j) in m if mask_border(m, i, j)}
    for (i, j) in m:
        X, Y = x0 + i, y0 + j
        if (i, j) in ring1:
            c.P(X, Y, 'gold', 4 if (i < 5 and j < 12) else 2)
        elif mask_border({p for p in m if p not in ring1}, i, j):
            c.P(X, Y, 'lapis', 2 if i < 5 else 1)
        else:
            # 판 속: 오목한 대리석 + 군청 마름모 격자(기하 투각)
            t = 2 if j < 6 else 3
            if (i + j) % 4 == 1 and (i - j) % 4 == 1: c.P(X, Y, 'lapis', 3 if i < 5 else 2)
            elif ((i + j) % 4 == 1 or (i - j) % 4 == 1) and j > 4: c.P(X, Y, 'marble', t - 1)
            else: c.P(X, Y, 'marble', t)
    c.HL(0, 24, 16, 'marble', 2); c.HL(0, 25, 16, 'gold', 4)
    for y in range(26, 30):
        for x in range(16):
            d = abs((x % 8) - 3.5) + abs(y - 27.5)
            if d <= 1.6: c.P(x, y, 'marble', 5 if y < 28 else 4)
            else: c.P(x, y, 'lapis', 2 if y > 26 else 3)
    c.HL(0, 30, 16, 'marble', 2); c.HL(0, 31, 16, 'marble', 0)


@W2('wall-tomb', '무덤 석회암 벽(돋을새김·채색 띠)', ['무덤', '벽', '돌'])
def _(c):
    ashlar(c, 0, 32, s=8, base=3, course=8, blen=16)
    # 오목 처마(세로 잎 채색)
    c.HL(0, 0, 16, 'stone', 1)
    for y in range(1, 5):
        for x in range(16):
            k = (x // 2) % 4
            m, t = (('turq', 2), ('stone', 4), ('lapis', 2), ('stone', 4))[k]
            t += (1 if y == 1 else 0) - (1 if y == 4 else 0)
            if x % 2 == 1: t -= 1
            c.P(x, y, *cl(m, t))
    c.HL(0, 5, 16, 'stone', 5); c.HL(0, 6, 16, 'stone', 1)
    # 돋을새김 띠: 엇갈린 갈매기 홈(왼쪽 위 그늘, 오른쪽 아래 밝은 턱)
    c.HL(0, 8, 16, 'stone', 1); c.HL(0, 14, 16, 'stone', 5)
    for y in range(9, 14):
        for x in range(16):
            k = (x + abs(y - 11)) % 6
            t = 3
            if k == 0: t = 1
            elif k == 1: t = 5
            c.P(x, y, 'stone', t)
    # 채색 띠: 황토 바탕 + 청록 마름모 + 붉은 테
    c.HL(0, 16, 16, 'red', 2)
    for y in range(17, 22):
        for x in range(16):
            d = abs((x % 8) - 3.5) + abs(y - 19)
            if d <= 0.9: c.P(x, y, 'red', 3)
            elif d <= 2.6: c.P(x, y, 'turq', 3 if (x % 8) < 4 else 2)
            else: c.P(x, y, 'saffron', 3 if y < 19 else 2)
    c.HL(0, 22, 16, 'red', 2); c.HL(0, 23, 16, 'stone', 1)
    c.HL(0, 26, 16, 'stone', 4)
    for y in range(27, 31):
        for x in range(16):
            t = 2 if (x + 5) % 16 != 0 else 1
            if rnd(x, y, 3) < 0.1: t = 1
            if y >= 29 and rnd(x, y, 5) < 0.3: c.P(x, y, 'sand', 2 if y == 29 else 3); continue
            c.P(x, y, 'stone', t)
    c.HL(0, 31, 16, 'stone', 0)


@W2('wall-hammam', '목욕탕 청록 타일 벽(회칠 아치 벽감)', ['목욕탕', '벽', '타일'])
def _(c):
    for y in range(4, 26):
        for x in range(16):
            v = y - 4
            if x % 4 == 3 or v % 4 == 3: c.P(x, y, 'plaster', 2); continue
            tv = (0, 0, -1, 0, 1)[h32(x // 4, v // 4, 13) % 5]
            t = 3 + tv
            if x % 4 == 0 and v % 4 == 0: t = 5
            elif x % 4 == 2 or v % 4 == 2: t -= 1
            c.P(x, y, *cl('turq', t))
    c.HL(0, 0, 16, 'plaster', 1); c.HL(0, 1, 16, 'plaster', 5); c.HL(0, 2, 16, 'plaster', 4); c.HL(0, 3, 16, 'plaster', 1)
    m = arch_mask(8, 12)
    x0, y0 = 4, 8
    for (i, j) in m:
        for dx, dy in ((-1, 0), (1, 0), (0, -1), (-1, -1), (1, -1)):
            if (i + dx, j + dy) not in m: c.P(x0 + i + dx, y0 + j + dy, 'plaster', 5 if dx <= 0 else 3)
    for (i, j) in m:
        t = 2 if j < 3 else 3
        if i == 0: t = 2
        if i == 7: t = 4
        c.P(x0 + i, y0 + j, 'plaster', t)
    c.HL(x0 - 1, y0 + 12, 10, 'marble', 5); c.HL(x0 - 1, y0 + 13, 10, 'marble', 2)
    # 놋 대야(물 떠 붓는 그릇)
    G(c, x0 + 1, y0 + 7, ['wwwwww', 'pppppq', 'rrrrrq', 'TTTTTt', 'ttttts'], dict(w=('plaster', 5), p=('plaster', 4), q=('plaster', 2),
                                                                            r=('red', 3), T=('turq', 4), t=('turq', 2), s=('turq', 1)))
    c.HL(0, 24, 16, 'turq', 1); c.HL(0, 25, 16, 'marble', 5)
    for y in range(26, 30):
        for x in range(16):
            t = 3
            if abs(vnoise(x, y, 7, 8) - 0.5) < 0.05: t = 2
            if y == 26: t = 4
            c.P(x, y, 'marble', t)
    c.HL(0, 30, 16, 'marble', 1); c.HL(0, 31, 16, 'marble', 0)


# ═════════════════════════════ C. 천장 가장자리 ═════════════════════════════
CEIL = dict(
    warm=dict(fill=lambda x, y: ('sumi', 1) if rnd(x, y, 3) < 0.06 or (vnoise(x, y, 5, 8) > 0.72 and rnd(x, y, 4) < 0.3) else ('sumi', 0),
              trim=(('wood', 3), ('wood', 5), ('dwood', 1)), name='따뜻한 천장(집·궁전)', tags=['찻집', '가게', '여관', '궁전', '목욕탕']),
    tomb=dict(fill=lambda x, y: ('rock', 1) if vnoise(x, y, 8, 4) > 0.66 or rnd(x, y, 9) < 0.05 else ('rock', 0),
              trim=(('stone', 3), ('stone', 5), ('rock', 1)), name='무덤 천장(어두운 돌)', tags=['무덤']),
)
CEIL_SIDES = {
    'ceil': ((), '천장 속(벽 위·방 밖)', '방 바깥과 북쪽 벽 위 줄을 채운다.'),
    'ceil-w': (('e',), '천장 — 방 서쪽 경계(테 동쪽)', '방의 서쪽 가장자리 세로 줄. 바로 동쪽이 바닥.'),
    'ceil-e': (('w',), '천장 — 방 동쪽 경계(테 서쪽)', '방의 동쪽 가장자리 세로 줄. 바로 서쪽이 바닥.'),
    'ceil-s': (('n',), '천장 — 방 남쪽 경계(테 북쪽)', '방의 남쪽 가장자리 가로 줄. 바로 북쪽이 바닥. 문 자리는 비운다.'),
    'ceil-sw': (('n', 'e'), '천장 — 남서 바깥 모서리(테 북·동)', '방 남서 모서리 한 칸.'),
    'ceil-se': (('n', 'w'), '천장 — 남동 바깥 모서리(테 북·서)', '방 남동 모서리 한 칸.'),
}


def ceil_draw(tone, edges):
    T = CEIL[tone]

    def draw(c):
        for y in range(16):
            for x in range(16): c.P(x, y, *T['fill'](x, y))
        a, b, sh = T['trim']
        # 각 변에서 거리 0 = 방에 닿는 줄(앞 모서리), 1 = 밝은 윗면, 2 = 안쪽 그늘
        for y in range(16):
            for x in range(16):
                ds = []
                if 'e' in edges: ds.append(15 - x)
                if 'w' in edges: ds.append(x)
                if 'n' in edges: ds.append(y)
                if not ds: continue
                d = min(ds)
                if d == 0: c.P(x, y, *a)
                elif d == 1: c.P(x, y, *b)
                elif d == 2: c.P(x, y, *sh)
    return draw


for tone in ('warm', 'tomb'):
    for key, (edges, nm, rule) in CEIL_SIDES.items():
        R.add('%s-%s' % (key, tone) if key == 'ceil' else key.replace('ceil', 'ceil-' + tone), '%s · %s' % (CEIL[tone]['name'], nm), 1, 1, 'terrain',
              tags=CEIL[tone]['tags'] + ['천장'], rules=rule)(ceil_draw(tone, edges))


# ═════════════════════════════ D. 가구·기물 ═════════════════════════════
def P_(id_, name, w, h, kind, tags, rules, floor):
    return R.add(id_, name, w, h, kind, tags=tags, rules=rules, floor=floor)


def fin(c, outline=True):
    if outline: c.outline()


# ── 찻집 ──
@P_('tea-table', '놋쟁반 찻상', 2, 1, 'low_furniture', ['찻집'], '방석·긴 의자 앞에 놓는다. 둘레 한 칸에 방석.', 'floor-zellige')
def _(c):
    # 팔각 나무 받침(앞면, 아치 구멍 셋)
    for y in range(10, 15):
        for x in range(5, 27):
            ax = (x - 5) % 7
            if y >= 12 and 2 <= ax <= 4 and not (y == 12 and ax in (2, 4)) and 5 < x < 25: continue
            t = 3 if y == 10 else 2
            if x in (5, 6): t = 3
            if x in (25, 26): t = 1
            if y == 14: t = 1
            c.P(x, y, 'dwood', t)
    # 쟁반: 테 두께(앞) → 윗면(테 밝음·바닥 한 단 어둡게·새긴 동그라미·가운데 꽃)
    cx, cy, rx, ry = 16, 5.5, 14, 4.3
    for x in range(1, 31):
        dx = (x + 0.5 - cx) / rx
        if abs(dx) <= 1:
            yb = int(cy + ry * math.sqrt(1 - dx * dx))
            c.P(x, yb + 1, 'gold', 2 if dx < 0.4 else 1)
    def tr(X, Y, dx, dy, d):
        if d > 0.8: return ('gold', 5) if (dx + dy * 1.6) < 0.35 else ('gold', 3)
        if d > 0.66: return ('gold', 2) if dy < 0.15 else ('gold', 3)
        if abs(d - 0.34) < 0.05 and (X + Y) % 2 == 0: return ('gold', 2)
        if d < 0.06: return ('gold', 5)
        return ('gold', 4) if (dx + dy) < -0.55 else ('gold', 3)
    c.ell(cx, cy, rx, ry, tr)
    teapot(c, 12, 0)
    glass(c, 6, 4); glass(c, 22, 5); glass(c, 25, 3)
    c.HL(18, 6, 2, 'plaster', 5); c.HL(18, 7, 2, 'plaster', 3)      # 각설탕
    fin(c)


@P_('cushion', '수놓은 바닥 방석', 1, 1, 'seat', ['찻집', '궁전', '여관'], '찻상·긴 의자 앞에 1칸씩. 길목은 막지 않는다.', 'floor-zellige')
def _(c):
    for y in range(3, 15):
        for x in range(1, 15):
            if (x in (1, 14)) and (y in (3, 14)): continue
            if y <= 11:
                dx = (x - 7.5) / 7; dy = (y - 7) / 4.5
                t = ramp_t(lum(dx * 0.8, dy * 0.8, 0.6), 2, 5)
                d = abs(x - 7.5) / 4.6 + abs(y - 7) / 3.1
                if d <= 1.0:
                    t = 4 if d > 0.72 else 2
                    m = 'saffron' if d > 0.72 else 'red'
                    if d < 0.3: m, t = 'gold', 5
                    c.P(x, y, m, t); continue
                if x in (2, 13) or y in (4,): t = min(t, 3)
                c.P(x, y, 'red', t)
            else:
                t = 2 if y < 14 else 1
                if x <= 2: t += 1
                if x >= 13: t -= 1
                if y == 12 and x % 3 == 1: c.P(x, y, 'saffron', 3); continue
                c.P(x, y, 'red', t)
    for (x, y) in ((2, 4), (13, 4), (2, 11), (13, 11)): c.P(x, y, 'gold', 4)
    c.P(1, 12, 'gold', 3); c.P(14, 12, 'gold', 2)
    fin(c)


def divan(c, W, fab='red', acc='saffron', frame='dwood', back='red', cush=2):
    ft = top(frame)
    # 바탕 틀 + 치마
    for x in range(1, W - 1):
        c.P(x, 14, frame, ft - 2 if x > 1 else ft - 1)
    for y in range(11, 14):
        for x in range(1, W - 1):
            t = 3 if y < 13 else 2
            if (x % 4) == 0: t -= 1
            if y == 13 and x % 2: t -= 1
            if x <= 2: t += 1
            if x >= W - 3: t -= 1
            c.P(x, y, *cl(acc, t))
    # 앉는 면(윗면 4줄)
    for y in range(7, 11):
        for x in range(1, W - 1):
            t = 4 if y < 10 else 3
            if y == 7: t = 3
            if (x // 3 + y) % 7 == 0: t -= 1
            c.P(x, y, *cl(fab, t))
    c.HL(1, 10, W - 2, acc, 4)
    # 등 쿠션(윗면 2줄 + 앞면 4줄), cush 개
    cw = (W - 4) // cush
    for k in range(cush):
        x0 = 2 + k * cw
        for y in range(1, 7):
            for x in range(x0, x0 + cw):
                lx = x - x0
                if (lx in (0, cw - 1)) and y == 1: continue
                if y <= 2: t = 5 if y == 2 else 4
                else:
                    t = 3
                    if lx in (0, 1): t = 4
                    if lx >= cw - 2: t = 2
                    if y == 6: t = 2
                    d = abs(lx - cw / 2 + 0.5) / 3 + abs(y - 4) / 1.6
                    if d < 1: c.P(x, y, *cl(acc, 4 if d < 0.5 else 2)); continue
                c.P(x, y, *cl(back, t))
    # 베개(둥근 끝)
    for bx in (3, W - 4):
        def bf(X, Y, dx, dy, d):
            if d < 0.12: return (acc, 5)
            if d < 0.45: return cl(acc, 3 + (1 if dx + dy < 0 else 0))
            return cl(fab, ramp_t(lum(dx, dy), 1, 4))
        c.ell(bx + 0.5, 8.5, 3.3, 3.3, bf)
    fin(c)


@P_('divan', '긴 방석 의자(디완)', 2, 1, 'seat', ['찻집', '여관'], '벽 앞에 붙인다. 앞에 찻상.', 'floor-zellige')
def _(c): divan(c, 32)


@P_('tea-counter', '사모바르 찻대', 3, 1, 'low_furniture', ['찻집'], '벽 앞이나 방 구석에 길게. 뒤쪽 1칸은 차 끓이는 사람 자리.', 'floor-zellige')
def _(c):
    W = 48
    box3(c, 0, 6, W, 5, 4, 'dwood', tt=4, ft=2)
    for y in range(7, 10):
        for x in range(1, W - 1):
            if rnd(x // 4, y, 7) < 0.2: c.P(x, y, 'dwood', 3)
    for k in range(3):
        px0 = 3 + k * 15
        c.R(px0, 12, 12, 2, 'dwood', 1); c.HL(px0, 12, 12, 'dwood', 0); c.VL(px0 + 11, 12, 2, 'dwood', 3)
        for gx in (px0 + 2, px0 + 6, px0 + 9): c.P(gx, 13, 'turq', 3)
    # 사모바르(놋 단지 + 앞 꼭지 + 받침) — 위에 은 주전자
    G(c, 3, 0, [
        '....sSs.....',
        '...sSSsss.s.',
        '....ssss....',
        '...oGGgmo...',
        '..oGGgggmo..',
        '.oGGgggmmdo.',
        '.oGggggmmdo.',
        '.oGgggTmmdo.',
        '.ogggTTmddo.',
        '..ogmmTddo..',
        '...odmmdo...',
        '..oGgggmdo..',
    ], dict(o=('gold', 1), G=('gold', 5), g=('gold', 4), m=('gold', 3), d=('gold', 2), T=('dwood', 2),
            s=('marble', 3), S=('marble', 5)))
    for gx in (18, 21, 24, 27): glass(c, gx, 5)
    c.ell(33, 8, 4, 1.6, lambda X, Y, dx, dy, d: ('gold', 5) if d > 0.5 and dy < 0 else ('gold', 3))
    teapot(c, 29, 1)
    # 설탕 단지
    G(c, 39, 4, ['.pp.', 'pPPp', 'pppq', '.qq.'], dict(p=('turq', 3), P=('turq', 5), q=('turq', 1)))
    fin(c)


@P_('hookah', '물담배(시샤)', 1, 1, 'other', ['찻집'], '방석 곁에 1칸. 찻상 옆.', 'floor-zellige')
def _(c):
    G(c, 3, 0, [
        '...ff....',
        '..rRRr...',
        '..rrrq...',
        '.gGGggd..',
        '...gm....',
        '...gm.hh.',
        '...gmh..h',
        '..gGmd..h',
        '...gm...h',
        '..LLLL..h',
        '.LwLLLl.H',
        '.LLLLll.H',
        '.LLLlll..',
        '..Lll1...',
        '..dgmd...',
    ], dict(f=('fire', 3), r=('red', 3), R=('red', 4), q=('red', 1), g=('gold', 4), G=('gold', 5), m=('gold', 3), d=('gold', 2),
            h=('red', 2), H=('gold', 3), L=('lapis', 3), l=('lapis', 2), w=('lapis', 4), **{'1': ('lapis', 1)}))
    fin(c)


@P_('lantern-wall', '놋 투각 등(벽걸이)', 1, 1, 'wall_mounted', ['찻집', '궁전', '가게', '여관'], '벽면(벽 아래 칸)에 겹쳐 건다. 3~4칸마다 하나.', 'wall-plaster')
def _(c):
    G(c, 3, 0, [
        '..dGGd....',
        '...mm.....',
        '....m.....',
        '....m.....',
        '...gGm....',
        '..gGggd...',
        '.gGggggd..',
        '.gFgFgfd..',
        '.gfFgFgd..',
        '.gFgFgfd..',
        '.gfFgfgd..',
        '..gmmmd...',
        '...gmd....',
        '....d.....',
    ], dict(d=('gold', 2), G=('gold', 5), g=('gold', 4), m=('gold', 3), F=('fire', 4), f=('fire', 3)))
    fin(c)


@P_('rug-medallion', '메달리온 양탄자', 3, 2, 'flat', ['찻집', '궁전', '여관', '가게'], '방 가운데 바닥에 깐다. 위에 찻상·방석을 올려도 된다.', 'floor-zellige')
def _(c):
    W, H = 48, 32
    for y in range(H):
        for x in range(1, W - 1):
            bx = min(x - 1, W - 2 - x); by = min(y, H - 1 - y); b = min(bx, by)
            if b == 0: m, t = 'red', 1
            elif b <= 3:
                k = ((x if by > bx else y) // 2) % 3
                m, t = ('saffron', 4) if (b == 2 and k == 0) else ('lapis', 2) if b == 2 else ('saffron', 3)
                if b == 3: m, t = 'lapis', 1
            else:
                dx, dy = (x - 23.5) / 13, (y - 15.5) / 9
                d = abs(dx) + abs(dy)
                cdx, cdy = min(x - 5, W - 6 - x), min(y - 4, H - 5 - y)
                if d <= 0.25: m, t = 'red', 4
                elif d <= 0.5: m, t = 'saffron', 4
                elif d <= 0.58: m, t = 'gold', 3
                elif d <= 1.0: m, t = ('lapis', 2 if (x + y) % 4 else 3)
                elif d <= 1.08: m, t = 'saffron', 3
                elif cdx + cdy <= 4: m, t = ('lapis', 2) if cdx + cdy < 4 else ('saffron', 3)
                else:
                    m, t = 'red', 2
                    if (x % 4 == 1 and y % 4 == 1): m, t = 'red', 4
                    elif ((x + 2) % 4 == 1 and (y + 2) % 4 == 1): m, t = 'saffron', 2
            c.P(x, y, *cl(m, t))
    for y in range(1, H - 1, 2):
        c.P(0, y, 'plaster', 4); c.P(W - 1, y, 'plaster', 3)
    c.HL(1, H - 1, W - 2, 'red', 0)



@P_('rug-runner', '양탄자 길(세로)', 1, 1, 'flat', ['궁전', '복도'], '문에서 옥좌·제단으로 세로로 잇대어 깐다(위아래로 이어진다). 걸을 수 있다.', 'floor-marble')
def _(c):
    W, H = 16, 16
    for y in range(H):
        for x in range(1, W - 1):
            b = min(x - 1, W - 2 - x)
            if b == 0: m, t = 'red', 1
            elif b == 1: m, t = ('saffron', 4) if (y // 2) % 2 == 0 else ('saffron', 3)
            elif b == 2: m, t = 'lapis', 1
            else:
                dy = abs(((y + 8) % 16) - 7.5); dx = abs(x - 7.5)
                d = dx + dy * 0.8
                if d <= 1.2: m, t = 'saffron', 4
                elif d <= 3.2: m, t = 'lapis', 2
                elif d <= 4.0: m, t = 'saffron', 3
                else: m, t = 'red', 2 if (x + y) % 5 else 3
            c.P(x, y, *cl(m, t))


# ── 가게 ──
@P_('shelf-pottery', '그릇 선반', 2, 2, 'tall_furniture', ['가게', '여관'], '벽 앞에 붙인다(벽 바로 아래 줄).', 'floor-flag')
def _(c):
    W = 32
    c.R(0, 0, W, 3, 'wood', 4); c.HL(0, 0, W, 'wood', 2); c.HL(1, 2, W - 2, 'wood', 5); c.HL(0, 3, W, 'wood', 2)
    for y in range(4, 31):
        c.P(0, y, 'wood', 3); c.P(1, y, 'wood', 4); c.P(2, y, 'wood', 2)
        c.P(W - 3, y, 'wood', 3); c.P(W - 2, y, 'wood', 2); c.P(W - 1, y, 'wood', 1)
    for y in range(4, 30):
        for x in range(3, W - 3):
            c.P(x, y, 'dwood', 1 if rnd(x // 3, y, 2) > 0.2 else 2)
    for sy in (13, 22):
        c.HL(3, sy - 1, W - 6, 'dwood', 0)
        c.HL(3, sy, W - 6, 'wood', 4); c.HL(3, sy + 1, W - 6, 'wood', 3); c.HL(0, sy + 2, W, 'wood', 2)
    c.HL(3, 4, W - 6, 'dwood', 0)
    c.R(0, 29, W, 2, 'wood', 2); c.HL(0, 29, W, 'wood', 3)
    # 윗칸: 항아리 둘 + 청록 대접
    pot(c, 4, 13, 6, 8, 'adobe', band=('turq', 3))
    pot(c, 11, 13, 5, 6, 'adobe')
    c.ell(22, 11, 4.5, 1.6, lambda X, Y, dx, dy, d: ('turq', 1) if dy < 0 and d < 0.5 else ('turq', 4 if dy < 0 else 3))
    c.HL(19, 12, 7, 'turq', 2); c.HL(20, 13, 5, 'turq', 1)
    c.ell(22, 6.5, 2.5, 2.5, lambda X, Y, dx, dy, d: ('lapis', 3) if d > 0.55 else ('plaster', 5) if d < 0.2 else ('lapis', 2))
    # 가운데 칸: 세운 접시 + 주전자 둘
    for k, (m, cx) in enumerate((('lapis', 7), ('turq', 13))):
        c.ell(cx, 18.5, 3, 3, lambda X, Y, dx, dy, d, m=m: (m, 3) if d > 0.6 else ('plaster', 5 if d < 0.2 else 4) if d < 0.35 else (m, 2))
    pot(c, 18, 22, 4, 6, 'adobe')
    pot(c, 23, 22, 5, 7, 'turq')
    # 아래 칸: 큰 단지 + 작은 대접 쌓기
    pot(c, 5, 29, 8, 6, 'adobe', band=('sumi', 2))
    for k in range(3):
        c.HL(17 + k, 28 - k * 2, 8 - 2 * k, 'adobe', 4 - (k == 0)); c.HL(17 + k, 29 - k * 2, 8 - 2 * k, 'adobe', 2)
    fin(c)


@P_('sacks-spice', '열린 향신료 자루', 1, 1, 'container', ['가게', '바자르'], '가게 앞·계산대 옆에 1~3개 무리.', 'floor-flag')
def _(c):
    def sack(cx, cy, rx, ry, hgt, spice):
        sm, st = spice
        # 몸통(아래로 볼록, 접힌 주름)
        for y in range(int(cy), int(cy + hgt) + 1):
            u = (y - cy) / hgt
            half = rx * (1.0 + 0.12 * math.sin(u * math.pi)) - (1.2 * u * u)
            for x in range(int(cx - half - 1), int(cx + half + 2)):
                dx = (x + 0.5 - cx) / half
                if abs(dx) > 1: continue
                t = ramp_t(-0.55 * dx + 0.2 - 0.4 * u, 1, 4)
                if (x - int(cx)) % 3 == 0 and 0.2 < u < 0.9: t -= 1
                c.P(x, y, *cl('hide', t))
        # 말린 아가리 테 + 향신료 더미
        def f(X, Y, dx, dy, d):
            if d > 0.62: return ('hide', 5) if dy < 0.1 else ('hide', 3)
            L = -0.6 * dx - 0.7 * dy + 0.2
            if dy < -0.45: return (sm, st - 2)
            t = st + (1 if L > 0.45 else -1 if L < -0.3 else 0)
            if rnd(X, Y, 3) < 0.12: t += 1
            return cl(sm, t)
        c.ell(cx, cy, rx, ry, f)
    sack(5, 4.5, 4.3, 2.6, 7, ('red', 4))
    sack(10.5, 8.5, 4.8, 2.7, 6, ('saffron', 4))
    c.P(13, 6, 'gold', 4); c.P(14, 6, 'gold', 3)
    fin(c)


@P_('carpet-stack', '접어 쌓은 양탄자', 2, 1, 'box', ['가게', '바자르'], '가게 벽 앞·구석. 사람 다니는 줄은 비운다.', 'floor-flag')
def _(c):
    layers = (('lapis', 13, 1), ('saffron', 11, 2), ('indigo', 9, 0), ('red', 7, 1))
    for m, y0, off in layers:
        n = top(m)
        for x in range(1 + off, 31 - (2 - off)):
            for j in range(2):
                t = (n - 1) if j == 0 else (n - 2)
                if x - (1 + off) < 2: t += 1
                if x > 31 - (2 - off) - 3: t -= 1
                if j == 1 and x % 4 == 1: t = 1
                c.P(x, y0 + j, *cl(m, t))
    # 맨 위 양탄자 윗면(무늬 보임)
    for y in range(2, 7):
        for x in range(2, 30):
            b = min(x - 2, 29 - x, y - 2, 6 - y)
            if b == 0: m, t = 'red', 2
            elif b == 1: m, t = ('saffron', 4) if x % 3 else ('lapis', 2)
            else:
                d = abs(x - 15.5) / 6 + abs(y - 4)
                m, t = ('lapis', 2) if d < 1.2 else ('red', 4 if (x % 4 == 0) else 3)
            if y == 2 and b == 0: t = 1
            c.P(x, y, *cl(m, t))
    for x in range(3, 29, 2): c.P(x, 1, 'plaster', 4)          # 뒤 술
    fin(c)


def counter(c, W, top_rows=5, front=4, y0=6):
    box3(c, 0, y0, W, top_rows, front, 'dwood', tt=4, ft=2)
    for y in range(y0 + 1, y0 + top_rows - 1):
        for x in range(1, W - 1):
            if rnd(x // 4, y, 11) < 0.2: c.P(x, y, 'dwood', 3)
    for px0 in range(3, W - 6, 14):
        c.R(px0, y0 + top_rows + 1, 10, front - 2, 'dwood', 1); c.HL(px0, y0 + top_rows + 1, 10, 'dwood', 0); c.VL(px0 + 9, y0 + top_rows + 1, front - 2, 'dwood', 3)
        c.P(px0 + 4, y0 + top_rows + 2, 'gold', 4); c.P(px0 + 5, y0 + top_rows + 2, 'gold', 3)


@P_('shop-counter', '놋 저울 계산대', 2, 1, 'low_furniture', ['가게', '바자르'], '가게 안쪽에 가로로. 앞 1칸은 손님 자리로 비운다.', 'floor-flag')
def _(c):
    counter(c, 32)
    # 놋 저울: 받침 · 기둥 · 가로대 · 줄 · 접시 둘
    c.ell(16, 9.5, 3.2, 1.3, lambda X, Y, dx, dy, d: ('gold', 5) if dy < 0 and dx < 0.3 else ('gold', 3))
    c.VL(15, 1, 9, 'gold', 4); c.VL(16, 1, 9, 'gold', 2); c.P(15, 0, 'gold', 5); c.P(16, 0, 'gold', 3)
    c.HL(5, 2, 22, 'gold', 4); c.HL(5, 3, 22, 'gold', 2); c.P(15, 2, 'gold', 5)
    for ex, sgn in ((6, 1), (25, -1)):
        c.line(ex, 3, ex - 3, 6, 'gold', 2); c.line(ex, 3, ex + 3, 6, 'gold', 2)
        c.ell(ex + 0.5, 7.2, 4.3, 1.7, lambda X, Y, dx, dy, d: ('gold', 5) if d > 0.55 and dy < 0.1 else ('gold', 3) if d > 0.55 else ('gold', 2))
    G(c, 4, 5, ['.sS.', 'ssSs'], dict(s=('saffron', 3), S=('saffron', 5)))
    c.R(24, 6, 3, 1, 'gold', 5)
    # 추 둘(윗면 + 앞면)
    G(c, 26, 9, ['Gg.', 'gm.', 'md.'], dict(G=('gold', 5), g=('gold', 4), m=('gold', 3), d=('gold', 2)))
    G(c, 29, 10, ['Gg', 'md'], dict(G=('gold', 5), g=('gold', 4), m=('gold', 3), d=('gold', 2)))
    fin(c)


@P_('jar-tall', '큰 저장 항아리', 1, 1, 'container', ['가게', '여관', '무덤'], '벽 앞·구석에 1~3개.', 'floor-flag')
def _(c):
    cx = 8
    def body(X, Y, dx, dy, d):
        t = ramp_t(lum(dx, dy), 1, 5)
        if Y in (8, 9):
            if (X % 4 == 1 and Y == 8) or (X % 4 == 3 and Y == 9): return cl('plaster', 5 if dx < 0.3 else 3)
            return cl('turq', 3 if dx < 0.3 else 2)
        return cl('adobe', t)
    c.ell(cx, 10.3, 6.3, 5.3, body)
    c.R(cx - 3, 3, 6, 3, 'adobe', 3); c.VL(cx - 3, 3, 3, 'adobe', 5); c.P(cx - 2, 4, 'adobe', 4); c.VL(cx + 2, 3, 3, 'adobe', 2)
    def mouth(X, Y, dx, dy, d):
        if d > 0.42: return ('adobe', 6) if (dx + dy) < 0.3 else ('adobe', 4)
        if dy < -0.05: return ('adobe', 2)
        return ('sumi', 1)
    c.ell(cx, 3.0, 4.2, 2.3, mouth)
    fin(c)


@P_('chest-brass', '놋 띠 궤짝', 1, 1, 'box', ['가게', '여관', '궁전'], '벽 앞·침상 발치.', 'floor-flag')
def _(c):
    box3(c, 1, 4, 14, 5, 6, 'dwood', tt=4, ft=2)
    for x in (3, 12):
        c.VL(x, 4, 5, 'gold', 4); c.VL(x, 9, 6, 'gold', 3)
    c.HL(1, 8, 14, 'gold', 3)
    c.R(7, 10, 2, 3, 'gold', 4); c.P(7, 10, 'gold', 5); c.P(8, 11, 'sumi', 0)
    for (x, y) in ((2, 5), (13, 5), (2, 13), (13, 13)): c.P(x, y, 'gold', 5)
    fin(c)


# ── 궁전 ──
@P_('throne', '금 옥좌(단 위)', 2, 2, 'seat', ['궁전'], '홀 북쪽 가운데, 벽 앞. 앞 2칸은 비운다.', 'floor-marble')
def _(c):
    W = 32
    # 아랫단
    box3(c, 0, 23, W, 4, 4, 'marble', tt=5, ft=3)
    c.HL(1, 28, W - 2, 'lapis', 2)
    # 윗단
    box3(c, 4, 18, W - 8, 3, 3, 'marble', tt=5, ft=3)
    c.HL(5, 22, W - 10, 'gold', 3)
    # 등받이(뾰족 아치)
    m = pointed_mask(16, 15, rise=8)
    for (i, j) in m:
        X, Y = 8 + i, 0 + j
        if mask_border(m, i, j): c.P(X, Y, 'gold', 5 if i < 8 else 3)
        elif mask_border({p for p in m if not mask_border(m, *p)}, i, j): c.P(X, Y, 'gold', 3 if i < 8 else 2)
        else:
            t = 3 if j > 5 else 2
            if (i + j) % 4 == 0: t += 1
            c.P(X, Y, 'red', t)
    c.P(15, 0, 'gold', 5); c.P(16, 0, 'gold', 4)
    c.P(15, 6, 'lapis', 4); c.P(16, 6, 'lapis', 3); c.P(15, 7, 'lapis', 3); c.P(16, 7, 'lapis', 2)
    # 팔걸이(윗면 + 앞면)
    for ax in (5, 23):
        box3(c, ax, 9, 4, 3, 8, 'gold', tt=4, ft=3)
        c.P(ax + 1, 14, 'lapis', 3); c.P(ax + 2, 14, 'lapis', 2)
    # 앉는 면 쿠션
    for y in range(12, 17):
        for x in range(9, 23):
            t = 4 if y < 15 else 3
            if y == 12: t = 3
            if x == 9: t += 1
            c.P(x, y, *cl('red', t))
    c.HL(9, 16, 14, 'gold', 4)
    # 앞 치맛판 + 다리
    c.R(9, 17, 14, 3, 'gold', 3); c.HL(9, 17, 14, 'gold', 4); c.HL(9, 19, 14, 'gold', 2)
    for gx in (12, 16, 19): c.P(gx, 18, 'lapis', 3)
    c.R(8, 17, 2, 4, 'gold', 4); c.R(22, 17, 2, 4, 'gold', 2)
    fin(c)


@P_('column-palace', '궁전 대리석 기둥', 1, 2, 'column', ['궁전', '목욕탕'], '홀 안 2~3칸 간격으로 줄지어. 벽에서 1칸 띄운다.', 'floor-marble')
def _(c):
    shade = (3, 5, 5, 4, 4, 3, 2, 1)
    for y in range(9, 27):
        for i, t in enumerate(shade):
            tt = t
            if i in (2, 5) and y % 2 == 0: tt -= 1
            c.P(4 + i, y, 'marble', tt)
    for yb in (10, 25):
        for i, t in enumerate((3, 5, 5, 4, 4, 3, 2, 1)): c.P(4 + i, yb, 'gold', min(5, t))
    # 주두: 윗면(잘린 면) + 무카르나스 층
    c.R(1, 0, 14, 3, 'gold', 4); c.HL(1, 0, 14, 'gold', 2); c.HL(2, 1, 12, 'gold', 5); c.HL(1, 3, 14, 'gold', 2)
    for y, (x0, x1) in zip(range(4, 9), ((2, 14), (2, 14), (3, 13), (3, 13), (4, 12))):
        for x in range(x0, x1):
            t = 4 if x < 7 else 3 if x < 10 else 2
            if y in (5, 7) and (x - x0) % 3 == 1: t = 1
            c.P(x, y, 'gold', t)
    c.HL(4, 8, 8, 'lapis', 2)
    # 받침
    c.R(3, 26, 10, 1, 'marble', 4)
    box3(c, 1, 27, 14, 2, 3, 'marble', tt=5, ft=3)
    fin(c)


@P_('brazier-stand', '놋 화로대', 1, 2, 'container', ['궁전', '무덤'], '옥좌·문 양옆에 짝으로. 벽에서 1칸 띄운다.', 'floor-marble')
def _(c):
    # 세 발
    c.line(7, 23, 3, 30, 'gold', 3); c.line(8, 23, 12, 30, 'gold', 2); c.VL(7, 23, 8, 'gold', 4); c.VL(8, 23, 8, 'gold', 2)
    c.HL(2, 30, 3, 'gold', 4); c.HL(11, 30, 3, 'gold', 2); c.HL(6, 31, 4, 'gold', 3)
    # 줄기 + 마디
    c.VL(7, 15, 9, 'gold', 4); c.VL(8, 15, 9, 'gold', 2)
    c.R(6, 18, 4, 2, 'gold', 3); c.HL(6, 18, 4, 'gold', 5)
    # 그릇 몸
    cyl(c, 8, 10, 6.5, 2.6, 4,
        lambda X, Y, dx, dy: None,
        lambda X, Y, dx, dep: cl('gold', ramp_t(-0.7 * dx - 0.15 * dep, 1, 4)))
    for x in range(3, 13): c.P(x, 14, 'gold', 2 if x > 8 else 3)
    def rim(X, Y, dx, dy, d):
        if d > 0.6: return ('gold', 5) if dy < 0.15 and dx < 0.5 else ('gold', 3)
        return None
    c.ell(8, 10, 6.5, 2.6, rim)
    coals(c, 8, 10, 5.0, 1.6, 3)
    flame(c, 8, 10, 10, 6, 0.3)
    flame(c, 6, 10, 6, 3, 2.0)
    flame(c, 10.5, 10, 7, 3, 4.0)
    fin(c)


@P_('vase-tall', '군청 금테 꽃병', 1, 1, 'container', ['궁전'], '벽 앞·기둥 사이·벽감 곁.', 'floor-marble')
def _(c):
    c.ell(8, 10.6, 5.2, 4.4, lambda X, Y, dx, dy, d: ('gold', 4 if dx < 0 else 2) if Y == 9 else cl('lapis', ramp_t(lum(dx, dy), 0, 4)))
    c.R(6, 4, 4, 3, 'lapis', 2); c.VL(6, 4, 3, 'lapis', 3); c.VL(9, 4, 3, 'lapis', 1); c.HL(6, 5, 4, 'gold', 4)
    c.R(5, 14, 6, 2, 'gold', 3); c.HL(5, 14, 6, 'gold', 4)
    def mouth(X, Y, dx, dy, d):
        if d > 0.55: return ('gold', 5) if dy < 0.2 and dx < 0.5 else ('gold', 3)
        return ('lapis', 2) if dy < -0.2 else ('void', 0)
    c.ell(8, 2.6, 4.2, 2.5, mouth)
    c.P(5, 9, 'lapis', 4); c.P(5, 10, 'lapis', 4)
    fin(c)


@P_('fountain-indoor', '대리석 실내 분수', 2, 2, 'container', ['궁전', '목욕탕'], '홀·안뜰 가운데. 둘레 1칸은 비운다.', 'floor-marble')
def _(c):
    cx, cy, rx, ry, h = 16, 12.5, 15, 8.6, 7
    def side(X, Y, dx, dep):
        t = ramp_t(-0.7 * dx, 2, 4)
        if 2 <= dep < 4:
            d = abs(((X + 2) % 6) - 2.5) + abs(dep - 3)
            return ('lapis', 3) if d < 1.3 else ('turq', 3 if dx < 0.3 else 2)
        if dep >= h - 1: t = 1
        return cl('marble', t)
    def tp(X, Y, dx, dy):
        d = dx * dx + dy * dy
        if d > 0.72: return ('marble', 5) if (dy < 0.3 and dx < 0.7) else ('marble', 4)
        if d > 0.6: return ('marble', 2) if dy < 0 else ('marble', 3)
        # 물: 뒤 안쪽 벽 그늘 → 물결
        ex = math.sqrt(max(0, 0.6 - dx * dx))
        if dy < -ex + 0.3: return ('marble', 2)
        t = 2
        if (Y + (X // 4)) % 3 == 0 and rnd(X // 2, Y, 5) < 0.6: t = 3
        if (dx + 0.3) ** 2 + (dy + 0.1) ** 2 < 0.04: t = 4
        return ('water', t)
    cyl(c, cx, cy, rx, ry, h, tp, side)
    # 가운데 받침 + 작은 대접 + 물줄기
    c.R(14, 8, 4, 7, 'marble', 4); c.VL(14, 8, 7, 'marble', 5); c.VL(17, 8, 7, 'marble', 2); c.HL(14, 14, 4, 'water', 4)
    c.ell(16, 7.5, 4.3, 1.9, lambda X, Y, dx, dy, d: ('marble', 5) if d > 0.55 and dy < 0.2 else ('marble', 3) if d > 0.55 else ('water', 3))
    c.HL(13, 9, 7, 'marble', 2)
    for (x, y, t) in ((15, 2, 5), (16, 1, 5), (16, 2, 4), (15, 3, 4), (16, 3, 5), (16, 4, 4), (15, 5, 3), (17, 4, 3),
                      (13, 4, 4), (12, 6, 3), (19, 4, 4), (20, 6, 3), (11, 8, 4), (21, 8, 4)):
        c.P(x, y, 'water', t)
    fin(c)


@P_('divan-royal', '궁전 긴 의자(금틀)', 3, 1, 'seat', ['궁전'], '홀 벽 앞에 붙인다.', 'floor-marble')
def _(c): divan(c, 48, fab='lapis', acc='gold', frame='gold', back='red', cush=3)


# ── 무덤 ──
@P_('sarcophagus', '채색 석관', 2, 1, 'box', ['무덤'], '묘실 가운데. 둘레 1칸은 비운다.', 'floor-tomb')
def _(c):
    box3(c, 1, 2, 30, 7, 6, 'stone', tt=5, ft=3)
    for y in range(3, 8):
        for x in range(2, 30):
            k = (x - 2) % 7
            if k in (0, 1): c.P(x, y, 'gold', 4 if y < 6 else 3)
            elif k == 2: c.P(x, y, 'lapis', 2)
            elif y in (4, 5): c.P(x, y, 'stone', 6)
    c.HL(1, 8, 30, 'gold', 3)
    for y in range(10, 14):
        for x in range(3, 29):
            k = (x - 3) % 5
            if y in (10, 13): c.P(x, y, 'lapis', 2 if y == 10 else 1); continue
            if k == 0: c.P(x, y, 'gold', 3)
            elif k == 2 and y == 11: c.P(x, y, 'red', 3)
            elif k == 2 and y == 12: c.P(x, y, 'turq', 2)
    fin(c)


@P_('canopic-jars', '뚜껑 단지 셋(석고)', 1, 1, 'round_body', ['무덤'], '석관 머리맡·벽감 앞.', 'floor-tomb')
def _(c):
    def jar(cx, yb, rx, h):
        cy = yb - h / 2
        c.ell(cx, cy + 0.5, rx, h / 2, lambda X, Y, dx, dy, d: ('lapis', 2 if dx < 0.3 else 1) if abs(dy + 0.15) < 0.16 else cl('plaster', ramp_t(lum(dx, dy), 1, 5)))
        # 뚜껑(윗면 타원 + 꼭지)
        c.ell(cx, yb - h + 0.4, rx - 0.4, 1.4, lambda X, Y, dx, dy, d: ('gold', 5) if dy < 0 and dx < 0.4 else ('gold', 3))
        c.P(int(cx), int(yb - h - 1), 'gold', 4)
        c.HL(int(cx - rx + 1), yb, int(2 * rx) - 1, 'plaster', 0)
    jar(4.5, 10, 3.0, 7)
    jar(11.5, 10, 3.0, 7)
    jar(8, 14, 3.2, 8)
    fin(c)


@P_('guardian-statue', '좌상 사자 석상(받침)', 1, 2, 'figure', ['무덤', '궁전'], '문·석관 양옆에 짝으로. 벽 앞.', 'floor-tomb')
def _(c):
    S = C(16, 22)
    def sh(lo, hi, cx, cy, rx, ry, extra=None):
        def f(X, Y, dx, dy, d):
            t = ramp_t(lum(dx, dy), lo, hi)
            if extra: t = extra(X, Y, dx, dy, d, t)
            return cl('stone', t)
        S.ell(cx, cy, rx, ry, f)
    # 뒷다리 허리(양옆 뒤) · 꼬리
    sh(1, 4, 3.0, 15.5, 2.8, 4.8); sh(1, 3, 13.0, 15.5, 2.8, 4.8)
    for (x, y) in ((14, 19), (15, 18), (15, 17), (14, 16)): S.P(x, y, 'stone', 3)
    S.P(15, 16, 'stone', 4)
    # 가슴
    sh(2, 5, 8, 13.5, 4.8, 6.0)
    # 앞다리 둘(왼쪽 밝음) + 가운데 그늘
    for x, ts in ((5, (5, 4)), (6, (4, 4)), (9, (4, 3)), (10, (3, 2))):
        for y in range(13, 20): S.P(x, y, 'stone', ts[0] if y < 17 else ts[1])
    for y in range(15, 20): S.P(7, y, 'stone', 2); S.P(8, y, 'stone', 1)
    # 발 + 발가락
    for px0 in (4, 8):
        S.R(px0, 19, 4, 2, 'stone', 5 if px0 == 4 else 4); S.HL(px0, 20, 4, 'stone', 3)
        S.P(px0 + 1, 20, 'stone', 1); S.P(px0 + 2, 20, 'stone', 2)
    # 갈기: 들쭉날쭉한 테(가닥 결)
    def mane(X, Y, dx, dy, d, t):
        ang = math.atan2(dy, dx)
        if d > 0.78 and (int((ang + 3.2) * 4.5) % 2 == 0): return -9
        if rnd(int(ang * 6), int(d * 4), 3) < 0.35: t -= 1
        return t
    S.ell(8, 6.5, 6.7, 6.0, lambda X, Y, dx, dy, d: None if mane(X, Y, dx, dy, d, 0) == -9 else cl('stone', ramp_t(lum(dx, dy), 1, 4) + (mane(X, Y, dx, dy, d, 0))))
    # 얼굴(밝음) · 주둥이 · 코 · 눈 · 귀
    sh(3, 6, 8, 7.2, 3.7, 3.6)
    sh(5, 6, 8, 9.2, 2.2, 1.5)
    S.P(7, 8, 'rock', 1); S.P(8, 8, 'rock', 1); S.P(7, 9, 'stone', 3); S.P(8, 10, 'stone', 2)
    S.P(6, 6, 'sumi', 1); S.P(10, 6, 'sumi', 1); S.P(6, 5, 'stone', 6); S.P(10, 5, 'stone', 5)
    S.P(5, 6, 'stone', 4); S.P(11, 6, 'stone', 3)
    for (x, y, t) in ((4, 2, 4), (5, 2, 5), (11, 2, 3), (12, 2, 2)): S.P(x, y, 'stone', t)
    S.outline(bottom=None)
    c.paste(S, 0, 1)
    box3(c, 0, 22, 16, 3, 6, 'stone', tt=5, ft=3)
    c.HL(1, 27, 14, 'saffron', 2); c.HL(1, 28, 14, 'turq', 2)
    fin(c)


@P_('offering-table', '제물 돌상', 2, 1, 'low_furniture', ['무덤', '궁전'], '석관·석상 앞. 앞 1칸은 비운다.', 'floor-tomb')
def _(c):
    box3(c, 0, 5, 32, 5, 2, 'stone', tt=5, ft=3)
    c.HL(1, 11, 30, 'turq', 2)
    for x in range(1, 31):
        if x % 4 == 0: c.P(x, 11, 'saffron', 3)
    for lx in (1, 25):
        c.R(lx, 12, 6, 3, 'stone', 3); c.VL(lx, 12, 3, 'stone', 4); c.VL(lx + 5, 12, 3, 'stone', 1)
    c.HL(7, 12, 18, 'sumi', 1)
    # 금 대접 + 과일
    c.ell(8, 6.5, 4.2, 1.8, lambda X, Y, dx, dy, d: ('gold', 5) if d > 0.55 and dy < 0.1 else ('gold', 3))
    G(c, 5, 3, ['.rR.s.', 'rRrsSs', 'grrsgg'], dict(r=('red', 3), R=('red', 5), s=('saffron', 4), S=('saffron', 5), g=('grass', 3)))
    c.HL(5, 8, 7, 'gold', 2)
    # 곡식 그릇 둘
    for bx in (16, 23):
        c.ell(bx, 7, 2.8, 1.5, lambda X, Y, dx, dy, d: ('adobe', 5) if d > 0.6 and dy < 0 else ('sand', 6) if dy < 0.3 else ('sand', 4))
        c.HL(bx - 2, 8, 5, 'adobe', 3); c.HL(bx - 1, 9, 3, 'adobe', 2)
    # 빵
    G(c, 26, 3, ['.hHh', 'hHhh', 'hhhd'], dict(h=('hide', 4), H=('hide', 5), d=('hide', 2)))
    fin(c)


@P_('torch-stand', '돌 화톳대', 1, 2, 'container', ['무덤', '궁전'], '통로·묘실 모서리. 벽에서 1칸 띄운다.', 'floor-tomb')
def _(c):
    shade = (4, 5, 4, 3, 2, 1)
    for y in range(14, 27):
        for i, t in enumerate(shade): c.P(5 + i, y, 'stone', t - (1 if y % 5 == 0 else 0))
    box3(c, 2, 26, 12, 2, 3, 'stone', tt=5, ft=3)
    c.R(4, 12, 8, 2, 'stone', 4); c.HL(4, 12, 8, 'stone', 5)
    cyl(c, 8, 9, 5.6, 2.4, 3, lambda X, Y, dx, dy: None, lambda X, Y, dx, dep: cl('rock', ramp_t(-0.7 * dx, 1, 4)))
    c.ell(8, 9, 5.6, 2.4, lambda X, Y, dx, dy, d: (('rock', 5) if dy < 0.15 and dx < 0.5 else ('rock', 3)) if d > 0.55 else None)
    coals(c, 8, 9, 4.2, 1.5, 7)
    flame(c, 8, 9, 9, 5, 1.0)
    flame(c, 6.5, 9, 5, 3, 3.0)
    fin(c)


@P_('sand-pile', '들이친 모래 더미', 1, 1, 'debris', ['무덤', '폐허'], '구석·벽 밑·문 안쪽에 덩이로.', 'floor-tomb')
def _(c):
    # 둥근 모래 둔덕: 꼭대기(왼쪽 위) 밝게 → 남쪽 비탈 짙게, 바람 결 두 줄, 발치 그늘 테. 칸을 거의 채워 바닥과 확실히 구별된다.
    def hgt(X, Y):
        a = 1 - ((X + 0.5 - 7.0) / 7.2) ** 2 - ((Y + 0.5 - 8.5) / 5.6) ** 2
        b = 1 - ((X + 0.5 - 11.5) / 4.2) ** 2 - ((Y + 0.5 - 12.0) / 3.0) ** 2
        return max(a, b * 0.6)
    for Y in range(1, 16):
        for X in range(0, 16):
            h0 = hgt(X, Y) + (rnd(X, Y, 4) - 0.5) * 0.1
            if h0 <= 0.0: continue
            gx = hgt(X + 1, Y) - hgt(X - 1, Y); gy = hgt(X, Y + 1) - hgt(X, Y - 1)
            L = -gx * 3.0 - gy * 4.0 + h0 * 0.5
            t = ramp_t(L, 1, 6)
            if h0 < 0.12: t = 1                                         # 발치 테(바닥에 닿는 그늘)
            if 0.25 < h0 < 0.75 and (Y + int(2 * math.sin(X / 2.5))) % 4 == 0: t -= 1   # 바람 결
            c.P(X, Y, *cl('sand', t))
    for (X, Y) in ((1, 13), (14, 14), (3, 15), (12, 15)): c.P(X, Y, 'sand', 3)   # 흩어진 알갱이
    G(c, 11, 10, ['rR', 'rq'], dict(r=('rock', 3), R=('rock', 5), q=('rock', 1)))
    c.outline(bottom=('sand', 0))


@P_('treasure-chest', '열린 보물 궤', 1, 1, 'box', ['무덤', '궁전'], '묘실 안쪽·석관 곁. 벽 앞.', 'floor-tomb')
def _(c):
    # 열린 뚜껑(안쪽 붉은 천)
    c.R(1, 0, 14, 5, 'dwood', 3); c.HL(2, 0, 12, 'dwood', 4)
    c.R(3, 1, 10, 4, 'red', 2); c.HL(3, 1, 10, 'red', 1)
    for x in (2, 13): c.VL(x, 0, 5, 'gold', 4 if x == 2 else 3)
    # 몸통 윗테 + 금화 더미
    box3(c, 1, 5, 14, 5, 5, 'dwood', tt=4, ft=2)
    for y in range(6, 10):
        for x in range(2, 14):
            r = rnd(x, y, 8)
            L = -(x - 7.5) / 8 - (y - 6.5) / 4
            t = 4 + (1 if L > 0.25 else 0) - (1 if L < -0.45 else 0)
            if r < 0.1: t = 5
            if y == 6 and x in (2, 13): continue
            c.P(x, y, *cl('gold', t))
    c.P(5, 7, 'lapis', 4); c.P(10, 8, 'red', 5); c.P(11, 7, 'turq', 5)
    for x in (3, 12): c.VL(x, 10, 5, 'gold', 3)
    c.R(7, 11, 2, 2, 'gold', 4); c.P(8, 12, 'sumi', 0)
    fin(c)


# ── 목욕탕 ──
@P_('plunge-pool', '타일 탕(물)', 3, 2, 'container', ['목욕탕'], '목욕탕 가운데. 둘레 1칸은 비운다. 물 칸은 걸을 수 없다.', 'floor-marble')
def _(c):
    W, H = 48, 32
    # 테두리 윗면(뒤·좌·우·앞)
    for y in range(0, 27):
        for x in range(W):
            if 3 <= x < W - 3 and 3 <= y < 24: continue
            t = 5 if (x < 3 or y < 3) else 4
            if y == 0 or x == 0: t = 3
            if x == W - 1: t = 2
            if (y in (2, 24) or x in (2, W - 3)) and 2 <= y <= 24: t = 3
            c.P(x, y, 'marble', t)
    # 앞면(청록 타일 띠)
    for y in range(27, 31):
        for x in range(W):
            if y == 27: c.P(x, y, 'marble', 3); continue
            if x % 4 == 3: c.P(x, y, 'plaster', 2); continue
            c.P(x, y, *cl('turq', (3 if x % 4 == 0 else 2) - (1 if y == 30 else 0)))
    c.HL(0, 31, W, 'sumi', 1)
    # 안쪽: 북쪽 안벽(타일) + 물
    for y in range(3, 24):
        for x in range(3, W - 3):
            if y < 8:
                if x % 4 == 3 or (y - 3) % 4 == 3: c.P(x, y, 'turq', 1); continue
                c.P(x, y, 'turq', 2 if y > 4 else 1)
                continue
            t = 2
            if y == 8: t = 1
            if (y + (x // 5)) % 4 == 0 and rnd(x // 3, y, 2) < 0.55: t = 3
            if (y + (x // 5)) % 4 == 1 and rnd(x // 3, y - 1, 2) < 0.55: t = 1
            if (x - 12) ** 2 / 9 + (y - 12) ** 2 < 2: t = 4
            c.P(x, y, 'water', t)
    # 서쪽 계단(물속으로 내려감): 디딤 윗면 2줄 + 챌면 1줄, 아래로 갈수록 좁고 물에 잠김
    for k in range(4):
        y0 = 9 + k * 4; w = 7 - k
        c.R(3, y0, w, 2, 'marble', 5 if k < 2 else 4); c.HL(3, y0, w, 'marble', 4 if k else 5)
        c.HL(3, y0 + 2, w, 'marble', 2); c.HL(3, y0 + 3, w, 'water', 1)
    c.HL(3, 23, 3, 'water', 3)
    # 물 들어오는 놋 꼭지(뒤 테)
    G(c, 22, 0, ['gGGg', '.dm.', '.wd.', '.w..'], dict(g=('gold', 4), G=('gold', 5), m=('gold', 3), d=('gold', 2), w=('water', 5)))
    fin(c)


@P_('marble-bench', '대리석 걸상', 2, 1, 'low_furniture', ['목욕탕', '궁전'], '목욕탕 벽 앞·탕 둘레.', 'floor-marble')
def _(c):
    box3(c, 1, 4, 30, 6, 2, 'marble', tt=4, ft=3)
    for y in range(5, 9):
        for x in range(2, 30):
            if abs(vnoise(x, y, 31, 8, 32) - 0.5) < 0.04: c.P(x, y, 'marble', 3)
    for lx in (2, 24):
        c.R(lx, 12, 6, 3, 'marble', 3); c.VL(lx, 12, 3, 'marble', 4); c.VL(lx + 5, 12, 3, 'marble', 1)
    c.HL(8, 12, 16, 'marble', 0)
    # 접은 수건
    c.R(20, 5, 7, 3, 'plaster', 5); c.HL(20, 7, 7, 'plaster', 3); c.HL(20, 6, 7, 'turq', 3); c.HL(20, 8, 7, 'plaster', 2)
    fin(c)


@P_('basin-tap', '대리석 세면 대야(벽 꼭지)', 1, 1, 'container', ['목욕탕'], '목욕탕 벽 바로 앞(벽 아래 첫 줄)에 2~3칸 간격.', 'floor-marble')
def _(c):
    G(c, 5, 0, ['dGGd..', 'gGgd..', '.mm...', '..mm..', '...d..'], dict(d=('gold', 2), G=('gold', 5), g=('gold', 4), m=('gold', 3)))
    def bowl_side(X, Y, dx, dep):
        if dep > 3.2 - 2 * dx * dx: return None
        return cl('marble', ramp_t(-0.7 * dx - 0.2 * dep, 1, 4))
    def bowl_top(X, Y, dx, dy):
        d = dx * dx + dy * dy
        if d > 0.55: return ('marble', 5) if dy < 0.3 and dx < 0.6 else ('marble', 4)
        if dy < -0.3: return ('marble', 2)
        return ('water', 3 if (X + Y) % 5 else 4)
    cyl(c, 8, 9, 6.6, 3.0, 4, bowl_top, bowl_side)
    c.P(8, 5, 'water', 5); c.P(8, 6, 'water', 4)
    fin(c)


@P_('towel-rack', '수건걸이', 1, 1, 'frame', ['목욕탕'], '벽 앞·걸상 곁.', 'floor-marble')
def _(c):
    for x, t in ((2, 4), (3, 2), (12, 3), (13, 1)): c.VL(x, 3, 11, 'dwood', t)
    c.HL(1, 2, 14, 'wood', 5); c.HL(1, 3, 14, 'wood', 3); c.HL(1, 4, 14, 'dwood', 2)
    c.HL(2, 10, 12, 'dwood', 3)
    for fx in (1, 11): c.R(fx, 13, 4, 2, 'dwood', 3); c.HL(fx, 13, 4, 'dwood', 4)
    # 걸친 수건(줄무늬)
    for y in range(3, 10):
        for x in range(4, 12):
            m, t = 'plaster', 5 if y < 5 else 4
            if x == 11: t -= 1
            if y in (7, 8): m, t = 'red', 3 if x < 10 else 2
            c.P(x, y, *cl(m, t))
    for x in range(4, 12, 2): c.P(x, 10, 'plaster', 3)
    # 아래 칸에 접은 청록 수건
    c.R(5, 8, 6, 2, 'turq', 4); c.HL(5, 8, 6, 'turq', 5); c.HL(5, 10, 6, 'turq', 2)
    fin(c)


# ── 여관 ──
@P_('bed-mat', '낮은 나무 침상(담요)', 1, 2, 'low_furniture', ['여관', '집'], '벽 앞에 머리를 북쪽으로. 곁 1칸은 비운다.', 'floor-wood')
def _(c):
    c.R(0, 2, 16, 25, 'wood', 3); c.HL(0, 2, 16, 'wood', 2); c.VL(0, 2, 25, 'wood', 4); c.VL(15, 2, 25, 'wood', 2)
    c.HL(1, 3, 14, 'wood', 5)
    # 매트·베개
    c.R(2, 4, 12, 22, 'plaster', 4)
    for y in range(4, 9):
        for x in range(3, 13):
            t = 5 if (x < 8 and y < 7) else 4
            if y == 8 or x == 12: t = 3
            c.P(x, y, 'plaster', t)
    c.HL(3, 9, 10, 'plaster', 2)
    # 담요(킬림 줄무늬) — 접힌 윗단
    c.HL(2, 11, 12, 'plaster', 5); c.HL(2, 12, 12, 'plaster', 3)
    for y in range(13, 26):
        for x in range(2, 14):
            k = (y - 13) % 6
            if k == 0: m, t = 'saffron', 4
            elif k in (1, 2): m, t = 'indigo', 3
            elif k == 3:
                m, t = ('red', 3) if (x + y) % 4 < 2 else ('saffron', 3)
            else: m, t = 'indigo', 2
            if x == 2: t += 1
            if x == 13: t -= 1
            c.P(x, y, *cl(m, t))
    # 발치 판(앞면)
    c.R(0, 27, 16, 3, 'dwood', 3); c.HL(0, 27, 16, 'dwood', 4); c.HL(0, 29, 16, 'dwood', 2)
    c.HL(3, 28, 10, 'dwood', 2)
    c.R(0, 30, 2, 1, 'dwood', 2); c.R(14, 30, 2, 1, 'dwood', 1)
    fin(c)


@P_('tannur-oven', '흙 화덕(탄누르)', 1, 1, 'container', ['여관', '집', '부엌'], '부엌 구석·마당 벽 곁. 둘레 1칸은 비운다.', 'floor-flag')
def _(c):
    cx = 8
    for y in range(4, 15):
        u = (y - 4) / 10
        half = 5.0 + 1.9 * u
        for x in range(0, 16):
            dx = (x + 0.5 - cx) / half
            if abs(dx) > 1: continue
            t = ramp_t(-0.8 * dx + 0.15 - 0.2 * u, 2, 6)
            if (y - 4) % 3 == 0 and y > 5: t -= 1                 # 진흙 띠 이음
            if rnd(x, y, 12) < 0.06: t -= 1
            c.P(x, y, *cl('adobe', t))
    # 아가리: 둥근 테 → 안쪽 뒤 벽(불빛에 달아오름) + 벽에 붙인 빵 + 바닥 숯불
    def mouth(X, Y, dx, dy, d):
        if d > 0.58: return ('adobe', 6) if dx < 0.35 and dy < 0.5 else ('adobe', 5)
        if dy < -0.25: return ('saffron', 1) if dy < -0.55 else ('adobe', 2)
        if dy > 0.2 and abs(dx) < 0.55: return ('fire', 3) if rnd(X, Y, 5) < 0.5 else ('fire', 2)
        return ('fire', 1) if abs(dx) < 0.7 else ('sumi', 1)
    c.ell(cx, 4.2, 5.6, 2.9, mouth)
    G(c, 9, 2, ['hH', 'hh'], dict(h=('hide', 4), H=('hide', 5)))
    # 아래 작은 바람구멍
    c.R(7, 13, 2, 2, 'sumi', 0); c.P(7, 14, 'fire', 1)
    fin(c)


@P_('shelf-inn', '여관 좁은 선반', 1, 2, 'tall_furniture', ['여관'], '벽 앞에 붙인다.', 'floor-wood')
def _(c):
    W = 16
    c.R(0, 0, W, 3, 'wood', 4); c.HL(0, 0, W, 'wood', 2); c.HL(1, 1, W - 2, 'wood', 5); c.HL(0, 3, W, 'wood', 2)
    for y in range(4, 31):
        c.P(0, y, 'wood', 3); c.P(1, y, 'wood', 4); c.P(W - 2, y, 'wood', 2); c.P(W - 1, y, 'wood', 1)
    for y in range(4, 29):
        for x in range(2, W - 2): c.P(x, y, 'dwood', 1 if rnd(x // 3, y, 6) > 0.2 else 2)
    c.HL(2, 4, W - 4, 'dwood', 0)
    for sy in (12, 21):
        c.HL(2, sy - 1, W - 4, 'dwood', 0); c.HL(2, sy, W - 4, 'wood', 4); c.HL(2, sy + 1, W - 4, 'wood', 3); c.HL(0, sy + 2, W, 'wood', 2)
    c.R(0, 29, W, 2, 'wood', 2); c.HL(0, 29, W, 'wood', 3)
    # 윗칸: 갠 담요 둘
    for k, (m, y) in enumerate((('red', 9), ('indigo', 6))):
        c.R(3, y, 7, 3, m, 3); c.HL(3, y, 7, m, 4); c.HL(3, y + 2, 7, m, 1); c.VL(9, y, 3, m, 2)
    pot(c, 10, 12, 4, 6, 'adobe')
    # 가운데 칸: 대접 쌓기 + 잔
    for k in range(3): c.HL(3 + k, 20 - k * 2, 6 - 2 * k, 'adobe', 4); c.HL(3 + k, 21 - k * 2, 6 - 2 * k, 'adobe', 2)
    pot(c, 10, 21, 3, 4, 'turq')
    # 아래 칸: 바구니
    for y in range(24, 29):
        for x in range(3, 13):
            t = 4 if (x + y) % 2 else 3
            if y == 24: t = 5 if x < 10 else 4
            if x == 12: t -= 1
            c.P(x, y, *cl('hide', t))
    c.HL(4, 23, 8, 'hide', 2)
    fin(c)


# ═════════════════════════════ 미리보기 · 시연 방 ═════════════════════════════
def tile_img(id_):
    return R.render(R.by[id_]).img()


def on_floor(it, z=1):
    """조각을 제 바닥 위에 얹은 그림(벽은 아래에 바닥 한 줄을 붙인다)."""
    im = R.render(it).img()
    fl = it.get('floor')
    if it['kind'] == 'terrain' and not fl: return im
    if it['kind'] == 'wall_mounted':
        base = Image.new('RGBA', im.size)
        w = tile_img('wall-plaster')
        for x in range(0, im.width, 16): base.alpha_composite(w.crop((0, 16, 16, 32)), (x, 0))
        base.alpha_composite(im); return base
    g = tile_img(fl)
    base = Image.new('RGBA', im.size)
    for y in range(0, im.height, 16):
        for x in range(0, im.width, 16): base.alpha_composite(g, (x, y))
    base.alpha_composite(im)
    return base


def preview(path, z=4):
    ims = []
    for it in R.items:
        if it['id'].startswith('wall-'):
            im = R.render(it).img()
            fl = {'wall-plaster': 'floor-zellige', 'wall-window-plaster': 'floor-zellige', 'wall-stone': 'floor-flag', 'wall-niche-stone': 'floor-flag',
                  'wall-palace': 'floor-marble', 'wall-tomb': 'floor-tomb', 'wall-hammam': 'floor-marble'}[it['id']]
            ceil = tile_img('ceil-tomb' if 'tomb' in it['id'] else 'ceil-warm')
            S = Image.new('RGBA', (48, 64))
            for x in range(0, 48, 16):
                S.alpha_composite(ceil, (x, 0)); S.alpha_composite(im, (x, 16)); S.alpha_composite(tile_img(fl), (x, 48))
            ims.append((it['id'], S))
        elif it['id'].startswith('floor-'):
            S = Image.new('RGBA', (32, 32)); g = tile_img(it['id'])
            for p in ((0, 0), (16, 0), (0, 16), (16, 16)): S.alpha_composite(g, p)
            ims.append((it['id'], S))
        else:
            ims.append((it['id'], on_floor(it)))
    contact(ims, path, z=z, W=1900, bg=(40, 34, 38))


def demo_room(path, z=4):
    """12×9 찻집: 천장 테 + 회칠 벽 + 젤리주 바닥 + 가구."""
    W, H = 12, 9
    S = Image.new('RGBA', (W * 16, H * 16))
    for x in range(W):
        for y in range(H):
            if x == 0: tid = 'ceil-warm-sw' if y == H - 1 else 'ceil-warm-w'
            elif x == W - 1: tid = 'ceil-warm-se' if y == H - 1 else 'ceil-warm-e'
            elif y == H - 1: tid = 'ceil-warm-s' if x not in (5, 6) else 'floor-zellige'
            elif y == 0: tid = 'ceil-warm'
            elif y in (1, 2): continue
            else: tid = 'floor-zellige-b' if (x * 7 + y * 3) % 11 == 0 else 'floor-zellige'
            S.alpha_composite(tile_img(tid), (x * 16, y * 16))
    for x in range(1, W - 1):
        S.alpha_composite(tile_img('wall-window-plaster' if x in (3, 8) else 'wall-plaster'), (x * 16, 16))

    def put(id_, cx, cy):
        S.alpha_composite(tile_img(id_), (cx * 16, cy * 16))
    put('lantern-wall', 5, 2); put('lantern-wall', 10, 2)
    put('divan', 1, 3); put('divan', 3, 3)
    put('tea-counter', 6, 3); put('hookah', 9, 3); put('jar-tall', 10, 3)
    put('tea-table', 1, 4); put('tea-table', 3, 4)
    put('cushion', 1, 5); put('cushion', 4, 5); put('hookah', 5, 4)
    put('rug-medallion', 6, 5)
    put('cushion', 6, 5); put('cushion', 9, 5)
    put('tea-table', 7, 5)
    put('cushion', 7, 6); put('cushion', 8, 6)
    put('jar-tall', 10, 7); put('jar-tall', 1, 7)
    S2 = S.resize((S.width * z, S.height * z), Image.NEAREST)
    S2.save(path)
    return S2


if __name__ == '__main__':
    R.export()
    print('interior', len(R.items))
    preview(os.path.join(OUT, 'interior', 'preview.png'))
    if '--room' in sys.argv:
        demo_room(sys.argv[sys.argv.index('--room') + 1])
