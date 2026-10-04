#!/usr/bin/env python3
"""월드맵 4판 생성기 — 3판(worldmap3.pal 색·물)은 그대로 두고 **모양**을 다시 그린다.

  python3 scripts/content/atlas-pick/worldmap_v4_gen.py            # 전부
  python3 scripts/content/atlas-pick/worldmap_v4_gen.py mountain forest   # 일부
  → tiledata/atlas-pick/candidates-worldmap/<slug>/v4-A.pxg (그다음 worldmap_check.py 로 검사)

4판 규칙(요약, 자세히는 WORKER-WORLDMAP.md 4판 절):
- 덩이 지형(산·숲·침엽수)은 「16px 주기 바탕 + 아주 낮은 대비」 — 무늬가 튀지 않게. 되풀이를 깨는 일은 **큰 덩이 조각**
  (mountain_peaks·forest_crowns·conifer_crowns, 2×2칸 32×32 셋)을 조립기가 칸 격자에 성기게 얹어서 한다.
- 기슭선(외곽선·밝은 테·그늘 테)은 칸 안에서 해석식으로 그린다 — 변 프로필이 16px 주기(p[0]=p[15], p[7]=p[8])라
  엔진의 8px 사분면 합성에서 모서리↔변↔안쪽 모서리가 항상 이어진다.
- 해안은 흙 테를 없애고 「밝은 풀 테 → 옅은 물거품 → 물」 (FF6 해안: 얇은 밝은 테).
- 아이콘은 크기 등급(1×1 · 2×2 · 3×3 · 5×5)마다 **한 장 그림**으로 그린다 — 칸 경계에서 끊기지 않는다.
"""
import math, os, random, sys, pathlib
import numpy as np

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[2]
CAND = ROOT / 'tiledata/atlas-pick/candidates-worldmap'
sys.path.insert(0, str(HERE))
PAL_LINE = '@palette ../../palette/worldmap3.pal'
RAW = '~-%'          # 발치 그림자 · 옅은 그림자 · 하이라이트(팔레트 원시 문자)


# ------------------------------------------------------------------ 그림판 + pxg 쓰기
class Img:
    """칸마다 토큰 (램프, 번호) | '~' '-' '%' | None(투명)."""
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.g = [[None] * w for _ in range(h)]

    def get(self, x, y):
        return self.g[y][x] if 0 <= x < self.w and 0 <= y < self.h else None

    def put(self, x, y, t):
        if 0 <= x < self.w and 0 <= y < self.h: self.g[y][x] = t

    def blit(self, o, ox, oy):
        for y in range(o.h):
            for x in range(o.w):
                if o.g[y][x] is not None: self.put(ox + x, oy + y, o.g[y][x])

    def write(self, path, title):
        toks = []
        for row in self.g:
            for t in row:
                if isinstance(t, tuple) and t not in toks: toks.append(t)
        letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
        assert len(toks) <= len(letters), len(toks)
        L = {t: letters[i] for i, t in enumerate(toks)}
        out = [f'// {title}', f'@size {self.w} {self.h}', '@cell 16', PAL_LINE, '@layer main']
        out += [f'@mat {L[t]} {t[0]} {t[1]}' for t in toks]
        out.append('@mblock 0 0')
        for row in self.g:
            out.append(''.join('.' if t is None else (t if isinstance(t, str) else L[t]) for t in row))
        pathlib.Path(path).parent.mkdir(parents=True, exist_ok=True)
        pathlib.Path(path).write_text('\n'.join(out) + '\n', encoding='utf-8')


def outline(img, tok, diag=False):
    """불투명 화소에 이웃한 투명 화소에 tok 를 칠한다(바깥 윤곽 1px)."""
    add = []
    for y in range(img.h):
        for x in range(img.w):
            if img.g[y][x] is not None: continue
            ns = [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
            if diag: ns += [(x + 1, y + 1), (x - 1, y - 1), (x + 1, y - 1), (x - 1, y + 1)]
            if any(img.get(a, b) not in (None, '~', '-', '%') for a, b in ns): add.append((x, y))
    for x, y in add: img.g[y][x] = tok


# ------------------------------------------------------------------ 묶음(3×4) 마스크
LAYOUT = {'isolated': (0, 0), 'body_alt': (1, 0), 'inner': (2, 0),
          'corner_nw': (0, 1), 'edge_n': (1, 1), 'corner_ne': (2, 1),
          'edge_w': (0, 2), 'body': (1, 2), 'edge_e': (2, 2),
          'corner_sw': (0, 3), 'edge_s': (1, 3), 'corner_se': (2, 3)}


def make_profiles(seed, pin, lo, hi):
    """변 넷의 16px 주기 프로필: p[0]=p[15]=pin, p[7]=p[8], 이웃 열 차 ≤1, lo..hi."""
    rng = random.Random(seed)
    out = {}
    for k in 'nswe':
        for _ in range(500):
            p = [pin] * 16
            v = pin
            for i in range(1, 8):
                v = max(lo, min(hi, v + rng.choice([-1, 0, 0, 1])))
                p[i] = v
            # 후반 8..14 : p[8]=p[7] 에서 시작해 15 의 pin 으로 돌아온다
            v = p[7]; p[8] = v
            for i in range(9, 15):
                v = max(lo, min(hi, v + rng.choice([-1, 0, 0, 1])))
                p[i] = v
            if abs(p[14] - pin) <= 1 and max(p) - min(p) >= 1: break
        out[k] = p
    return out


def _nw_corner(pn, pw, pin):
    m = np.zeros((16, 16), bool)
    for y in range(16):
        for x in range(16):
            ok = y >= pn[x] and x >= pw[y]
            if ok and x <= 6 and y <= 6 and (x - pin) + (y - pin) < 3: ok = False
            m[y, x] = ok
    return m


def _inner_radius(pin):
    best = None
    for r10 in range(20, 90):
        r = r10 / 10
        d = next((y for y in range(16) if (0.5) ** 2 + (y + 0.5) ** 2 >= r * r), 16)
        if d == pin: best = r
    return best


def tile_mask(role, P, pin, seed, iso_r=6.4):
    pn, ps, pw, pe = P['n'], P['s'], P['w'], P['e']
    if role in ('body', 'body_alt'): return np.ones((16, 16), bool)
    if role == 'edge_n': return np.array([[y >= pn[x] for x in range(16)] for y in range(16)])
    if role == 'edge_s': return np.array([[y < 16 - ps[x] for x in range(16)] for y in range(16)])
    if role == 'edge_w': return np.array([[x >= pw[y] for x in range(16)] for y in range(16)])
    if role == 'edge_e': return np.array([[x < 16 - pe[y] for x in range(16)] for y in range(16)])
    if role == 'corner_nw': return _nw_corner(pn, pw, pin)
    if role == 'corner_ne': return _nw_corner(pn[::-1], pe, pin)[:, ::-1]
    if role == 'corner_sw': return _nw_corner(ps, pw[::-1], pin)[::-1]
    if role == 'corner_se': return _nw_corner(ps[::-1], pe[::-1], pin)[::-1, ::-1]
    if role == 'inner':
        r = _inner_radius(pin); m = np.ones((16, 16), bool)
        for y in range(16):
            for x in range(16):
                for cx, cy in ((0, 0), (16, 0), (0, 16), (16, 16)):
                    if (x + .5 - cx) ** 2 + (y + .5 - cy) ** 2 < r * r: m[y, x] = False
        return m
    if role == 'isolated':
        rng = random.Random(seed + 77)
        ph = [rng.random() * 6.28 for _ in range(3)]
        m = np.zeros((16, 16), bool)
        for y in range(16):
            for x in range(16):
                a = math.atan2(y - 7.5, x - 7.5)
                w = 0.9 * math.sin(2 * a + ph[0]) + 0.6 * math.sin(3 * a + ph[1]) + 0.4 * math.sin(5 * a + ph[2])
                m[y, x] = math.hypot(x - 7.5, y - 7.5) < iso_r + w * 0.75
        return m
    raise ValueError(role)


def ext_fn(role, m):
    """타일 밖 화소의 땅 여부(윤곽·테 계산용)."""
    def f(x, y):
        inx, iny = 0 <= x < 16, 0 <= y < 16
        if inx and iny: return bool(m[y, x])
        if role in ('body', 'body_alt'): return bool(m[y % 16, x % 16])
        if role == 'isolated': return False
        if role == 'inner': return bool(m[min(15, max(0, y)), min(15, max(0, x))])
        if role in ('edge_n', 'edge_s'):
            if iny is False: return (y > 15) if role == 'edge_n' else (y < 0)
            return bool(m[y, x % 16])
        if role in ('edge_w', 'edge_e'):
            if inx is False: return (x > 15) if role == 'edge_w' else (x < 0)
            return bool(m[y % 16, x])
        # 모서리: 바깥 두 변 쪽은 밖, 안쪽 두 변 쪽은 땅
        vs, hs = role.split('_')[1]
        if (x < 0 and hs == 'w') or (x > 15 and hs == 'e') or (y < 0 and vs == 'n') or (y > 15 and vs == 's'): return False
        return True
    return f


def dist_map(m, ext, lim=3):
    """땅 화소의 4방향 거리(바깥 이웃이면 1)."""
    d = np.full((16, 16), 99, int)
    for y in range(16):
        for x in range(16):
            if not m[y, x]: d[y, x] = 0; continue
            for k in range(1, lim + 1):
                hit = False
                for dx in range(-k, k + 1):
                    r = k - abs(dx)
                    for dy in ({r, -r}):
                        if not ext(x + dx, y + dy): hit = True
                if hit: d[y, x] = k; break
    return d


def facing(x, y, ext, k=2):
    """밝은 쪽(북서)에 바깥이 있으면 +, 어두운 쪽(남동)이면 −."""
    lt = sum(not ext(x + a, y + b) for a, b in ((0, -k), (-k, 0), (-k, -k), (0, -1), (-1, 0)))
    dk = sum(not ext(x + a, y + b) for a, b in ((0, k), (k, 0), (k, k), (0, 1), (1, 0)))
    return lt - dk


def paint_bundle(kind, seed, pin, lo, hi, texfn, edgefn, gaps=None, title=''):
    """3×4 묶음 그림. texfn(x,y)->토큰(몸통 바탕, 16px 주기), edgefn(role,x,y,d,m,ext)->토큰|None(=texfn)."""
    P = make_profiles(seed, pin, lo, hi)
    img = Img(48, 64)
    for role, (cx, cy) in LAYOUT.items():
        if role == 'body_alt': continue
        m = tile_mask(role, P, pin, seed)
        ext = ext_fn(role, m)
        d = dist_map(m, ext)
        for y in range(16):
            for x in range(16):
                if not m[y, x]: continue
                t = edgefn(role, x, y, int(d[y, x]), m, ext) if d[y, x] < 99 else None
                img.put(cx * 16 + x, cy * 16 + y, t if t is not None else texfn(x, y))
    return img, P


# ------------------------------------------------------------------ 산 / 숲 / 침엽수
def _ring(ramp, ol, lt, dk, mid):
    """d==1 윤곽, d==2 밝은/어두운 테."""
    def edge(role, x, y, d, m, ext):
        if d == 1: return (ramp, ol)
        if d == 2:
            f = facing(x, y, ext)
            if f > 0: return (ramp, lt)
            if f < 0: return (ramp, dk)
        return None
    return edge


def mountain_tex(seed=11):
    rng = random.Random(seed)
    cell = {}
    # 대각 능선(\ 방향) 다섯 줄 — 16px 주기, 낮은 대비
    for _ in range(5):
        x0, y0 = rng.randrange(16), rng.randrange(16)
        n = rng.choice([4, 5, 5, 6])
        for k in range(n):
            cell[((x0 + k) % 16, (y0 + k) % 16)] = 2
            cell[((x0 + k + 1) % 16, (y0 + k) % 16)] = 4 if k % 2 == 0 else 3
    for _ in range(4): cell[(rng.randrange(16), rng.randrange(16))] = 1
    for _ in range(4): cell[(rng.randrange(16), rng.randrange(16))] = 5
    return lambda x, y: ('wrock', cell.get((x, y), 3))


def gen_mountain():
    tex = mountain_tex()
    def edge(role, x, y, d, m, ext):
        return _ring('wrock', 0, 5, 1, 3)(role, x, y, d, m, ext)
    return paint_bundle('mountain', 41, 4, 3, 5, tex, edge, title='mountain v4-A')


CROWNS = [(4.0, 4.0, 4.7), (12.0, 12.0, 4.7), (12.5, 3.0, 3.4), (3.0, 12.5, 3.4)]


def _tor(a, b):
    d = abs(a - b) % 16
    return min(d, 16 - d)


def forest_tex():
    def tex(x, y):
        best = None
        for cx, cy, r in CROWNS:
            dx = ((x - cx + 8) % 16) - 8; dy = ((y - cy + 8) % 16) - 8
            n = math.hypot(dx, dy) / r
            if best is None or n < best[0]: best = (n, dx, dy, r)
        n, dx, dy, r = best
        if n > 1.0: return ('wleaf', 1)
        if n > 0.86: return ('wleaf', 1)
        s = (dx + dy) / r
        if s < -0.9: return ('wleaf', 5)
        if s < -0.25: return ('wleaf', 4)
        if s > 0.75 and n > 0.6: return ('wleaf', 2)
        return ('wleaf', 3)
    return tex


def gen_forest():
    tex = forest_tex()
    ring = _ring('wleaf', 0, 4, 1, 3)
    def edge(role, x, y, d, m, ext):
        # 남쪽 변만 줄기 3px (8px 간격)
        if d in (1, 2) and not ext(x, y + 1 if d == 1 else y + 2) and (x % 8) in (3, 4, 5):
            return ('wbark', 1 if d == 1 else 2)
        return ring(role, x, y, d, m, ext)
    return paint_bundle('forest', 52, 4, 3, 5, tex, edge, title='forest v4-A')


def conifer_tex():
    def tex(x, y):
        best = None
        for cx, top in ((4, 1), (12, 8), (4, 9)):
            dy = ((y - top + 8) % 16) - 8 + 8      # 꼭대기 기준 0..
            dx = ((x - cx + 8) % 16) - 8
            if 0 <= dy <= 7:
                hw = (dy + 1) // 2 if dy < 6 else 3
                if abs(dx) <= hw:
                    best = (dx, dy, hw); break
        if best is None: return ('wpine', 1)
        dx, dy, hw = best
        if dx < 0 and dy > 1: return ('wpine', 4)
        if dx > 0: return ('wpine', 2)
        return ('wpine', 3)
    return tex


def gen_conifer():
    tex = conifer_tex()
    ring = _ring('wpine', 0, 4, 1, 3)
    def edge(role, x, y, d, m, ext):
        if d in (1, 2) and not ext(x, y + 1 if d == 1 else y + 2) and (x % 8) in (3, 4):
            return ('wbark', 1 if d == 1 else 2)
        return ring(role, x, y, d, m, ext)
    return paint_bundle('conifer', 63, 4, 3, 5, tex, edge, title='conifer v4-A')


# ------------------------------------------------------------------ 해안 / 깊은 바다
def coast_tex():
    rng = random.Random(5)
    fl = set()
    for ty in range(0, 16, 5):
        for tx in range(0, 16, 8):
            x0 = (tx + rng.randrange(0, 4)) % 16; y0 = (ty + rng.randrange(0, 3)) % 16
            for k in range(rng.choice([2, 3])): fl.add(((x0 + k) % 16, y0))
    return lambda x, y: ('wsea', 2 if (x, y) in fl else 1)   # 3판 물 몸통 = wsea 1


def gen_coast(rim_grass=True):
    tex = coast_tex()
    def edge(role, x, y, d, m, ext):
        if d == 1: return ('wsea', 4)
        if d == 2 and (x + y) % 2 == 0: return ('wsea', 2)
        return None
    img, P = paint_bundle('coast', 74, 3, 2, 4, tex, edge, title='coast_grass v4-A')
    if rim_grass:   # 물 밖(땅) 쪽에 밝은 풀 테 1px — 물과 4방향으로 닿은 투명 화소
        add = []
        for y in range(img.h):
            for x in range(img.w):
                if img.g[y][x] is not None: continue
                if any(isinstance(img.get(a, b), tuple) for a, b in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1))):
                    if (x // 16, y // 16) == LAYOUT['body_alt']: continue   # body_alt 는 통째로 비운다
                    add.append((x, y))
        for x, y in add: img.g[y][x] = ('wgrass', 4)
        # 묶음 칸 경계 밖으로 새지 않게(다른 칸의 물과 이웃한 투명 화소는 위 검사가 이미 그 칸 안 화소로만 본다)
    return img, P


def gen_sea_deep():
    def tex(x, y): return ('wdeep', 2 if (x * 5 + y * 3) % 23 == 0 else 1)   # 3판 몸통 = wdeep 1
    def edge(role, x, y, d, m, ext):
        if d == 1: return ('wdeep', 3)
        if d == 2 and (x + y) % 2 == 0: return ('wdeep', 2)
        return None
    return paint_bundle('sea_deep', 85, 3, 2, 4, tex, edge, title='sea_deep v4-A')


# ------------------------------------------------------------------ 큰 덩이 조각(2×2칸 32×32 셋 = 96×32)
def _disc(img, cx, cy, r, f):
    for y in range(int(cy - r) - 1, int(cy + r) + 2):
        for x in range(int(cx - r) - 1, int(cx + r) + 2):
            if math.hypot(x + .5 - cx, y + .5 - cy) <= r: img.put(x, y, f(x + .5 - cx, y + .5 - cy, r))


def crown_piece(lobes, ramp='wleaf', ol=0):
    """lobes: [(cx, cy, r)] 둥근 수관 덩이. 그리는 순서 = 뒤→앞."""
    img = Img(32, 32)
    for cx, cy, r in lobes:
        tmp = Img(32, 32)
        def f(dx, dy, rr):
            s = (dx + dy) / rr; n = math.hypot(dx, dy) / rr
            if n > .88: return (ramp, 1 if s > 0 else 2)
            if s < -.95: return (ramp, 5)
            if s < -.35: return (ramp, 4)
            if s > .55: return (ramp, 2)
            return (ramp, 3)
        _disc(tmp, cx, cy, r, f)
        outline(tmp, (ramp, ol))
        img.blit(tmp, 0, 0)
    return img


def gen_forest_crowns():
    vs = [[(16, 17, 11.5), (9, 13, 6), (23, 14, 6.5), (16, 9, 6)],
          [(9, 20, 7.5), (23, 20, 7.5), (16, 11, 8)],
          [(12, 18, 9.5), (24, 22, 6), (22, 10, 6.5)]]
    out = Img(96, 32)
    for i, lobes in enumerate(vs): out.blit(crown_piece(lobes), i * 32, 0)
    return out


def gen_conifer_crowns():
    def tree(img, cx, top, h, w):
        for k in range(h):
            hw = 1 + (k * (w - 1)) // (h - 1) // 1
            hw = max(0, min(w, (k * (w + 1)) // h))
            for dx in range(-hw, hw + 1):
                t = ('wpine', 4 if dx < -hw // 3 - 0 and k > 1 else (2 if dx > hw // 3 else 3))
                img.put(cx + dx, top + k, t)
    out = Img(96, 32)
    lay = [[(16, 3, 14, 7), (8, 11, 12, 6), (24, 12, 12, 6)],
           [(10, 6, 13, 6), (22, 8, 13, 6), (16, 16, 12, 7)],
           [(16, 5, 16, 8), (6, 14, 11, 5), (26, 14, 11, 5)]]
    for i, tr in enumerate(lay):
        tmp = Img(32, 32)
        for cx, top, h, w in sorted(tr, key=lambda t: t[1] + t[2]):
            t2 = Img(32, 32); tree(t2, cx, top, h, w); outline(t2, ('wpine', 0)); tmp.blit(t2, 0, 0)
        out.blit(tmp, i * 32, 0)
    return out


def peak_piece(peaks, snow=True, seed=3):
    """peaks: [(cx, apex_y, half_w)] — 꼭대기 삼각 능선. 왼 사면 밝게·오른 사면 어둡게, 눈 덮개, 발치는 몸통색으로 풀린다."""
    rng = random.Random(seed)
    img = Img(32, 32)
    top = [99] * 32; who = [0] * 32
    for x in range(32):
        for i, (cx, ay, hw) in enumerate(peaks):
            slope = 1.55
            y = ay + abs(x + .5 - cx) * slope + (rng.random() - .5) * 1.4
            if y < top[x]: top[x] = y; who[x] = i
    top = [int(round(t)) for t in top]
    for x in range(32):
        cx, ay, hw = peaks[who[x]]
        y0 = top[x]
        if y0 > 31: continue
        for y in range(y0, 32):
            left = x + .5 < cx
            depth = y - top[x]
            if depth == 0: t = ('wrock', 0)
            elif snow and y < ay + 7 + (0 if left else 1) and depth < 8 - abs(x + .5 - cx) * .6:
                t = ('wsnow', 5 if left else 3) if depth > 0 else ('wrock', 0)
                if depth == 1: t = ('wsnow', 4 if left else 2)
            elif left: t = ('wrock', 4 if depth < 6 else 3)
            else: t = ('wrock', 2 if depth < 8 else 3)
            if y >= 27 and depth > 2: t = ('wrock', 3) if (x + y) % 4 else ('wrock', 2)    # 발치는 몸통 바탕색으로 풀림
            img.put(x, y, t)
        # 능선 그늘 줄
    return img


def gen_mountain_peaks():
    out = Img(96, 32)
    out.blit(peak_piece([(16, 4, 13)], True, 3), 0, 0)
    out.blit(peak_piece([(9, 12, 9), (22, 5, 11)], True, 4), 32, 0)
    out.blit(peak_piece([(6, 15, 7), (16, 10, 8), (26, 16, 7)], False, 5), 64, 0)
    return out


# ------------------------------------------------------------------ 실행
JOBS = {
    'mountain': (lambda: gen_mountain()[0]),
    'forest': (lambda: gen_forest()[0]),
    'conifer': (lambda: gen_conifer()[0]),
    'coast_grass': (lambda: gen_coast()[0]),
    'sea_deep': (lambda: gen_sea_deep()[0]),
    'mountain_peaks': gen_mountain_peaks,
    'forest_crowns': gen_forest_crowns,
    'conifer_crowns': gen_conifer_crowns,
}
try:
    from worldmap_v4_icons import ICON_JOBS
    JOBS.update(ICON_JOBS)
except ImportError:
    pass


def main():
    names = sys.argv[1:] or list(JOBS)
    for n in names:
        img = JOBS[n]()
        p = CAND / n / 'v4-A.pxg'
        img.write(p, f'{n} v4-A (4판: 3판 색·물 그대로, 모양 다시)')
        print('wrote', p.relative_to(ROOT))


if __name__ == '__main__':
    main()
