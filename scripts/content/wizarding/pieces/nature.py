"""nature 모듈: 숲·덤불·갈대·바위·바닥 표면. id 접두 wz-nat-.
  python3 scripts/content/wizarding/pieces/nature.py → 검사 + tiledata/wizarding/review/nature.png
"""
import os, sys, math
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from wzlib import REG, Cv, K, OL, OL2, run_module, darker, RAMPS   # noqa: E402

MODULE = 'nature'
LX, LY, LZ = -0.55, -0.65, 0.52      # 빛: 왼쪽 위


def hh(x, y, s=0):
    return ((((int(x) * 73856093) ^ (int(y) * 19349663) ^ (s * 83492791)) & 0xffff) / 65535.0)


# ───────────── 공용 도우미 ─────────────
def clumps(c, circles, m='leaf', shift=0, hi=0.74, seed=1, serr=0.30, tuft=0.05, tones=None):
    """둥근 덩이들의 합집합을 3/4 빛(왼쪽 위)으로 칠한다. circles=[(cx,cy,r)...]; 아래쪽 덩이가 앞.
    덩이 경계마다 명암이 끊겨 잎 덩어리로 읽힌다. serr: 가장자리 톱니 비율."""
    own = {}
    for (cx, cy, r) in circles:
        for y in range(int(cy - r) - 1, int(cy + r) + 2):
            for x in range(int(cx - r) - 1, int(cx + r) + 2):
                dx, dy = (x + .5 - cx) / r, (y + .5 - cy) / r
                d2 = dx * dx + dy * dy
                if d2 > 1: continue
                z = math.sqrt(1 - d2)
                key = cy + 0.25 * z * r
                if (x, y) not in own or own[(x, y)][0] < key:
                    own[(x, y)] = (key, dx, dy, z, r)
    # 톱니: 가장자리 화소를 가끔 깎는다
    for (x, y) in list(own):
        nb = sum(1 for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if (x + ox, y + oy) not in own)
        if nb and hh(x, y, seed) < serr * (0.55 if nb == 1 else 1.0) and (y > min(p[1] for p in own) + 1):
            del own[(x, y)]
    for (x, y), (key, dx, dy, z, r) in own.items():
        s = LX * dx + LY * dy + LZ * z
        t = 4 if (s > hi and r >= 5) else 3 if s > 0.30 else 2 if s > -0.18 else 1
        f = hh(x // 2, y, seed + 5)
        if f < tuft: t = min(4, t + 1) if s > 0 else max(1, t - 1)
        t = max(1, min(4, t + shift))
        c.P(x, y, K(m, t) if tones is None else tones[t - 1])
    return own


def limb(c, pts, m='wood', base=3, taper=True):
    """굽은 줄기·가지: pts=[(x,y,r),...] 사이를 원판으로 잇고 왼쪽 밝게·오른쪽 어둡게. 밝은 결 한 줄."""
    best = {}
    for i in range(len(pts) - 1):
        (x0, y0, r0), (x1, y1, r1) = pts[i], pts[i + 1]
        n = max(2, int(max(abs(x1 - x0), abs(y1 - y0)) * 2))
        for k in range(n + 1):
            t = k / n
            cx, cy, r = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r0 + (r1 - r0) * t
            for y in range(int(cy - r) - 1, int(cy + r) + 2):
                for x in range(int(cx - r) - 1, int(cx + r) + 2):
                    dx, dy = (x + .5 - cx), (y + .5 - cy)
                    d = math.hypot(dx, dy)
                    if d <= r:
                        sc = d / max(r, .5)
                        if (x, y) not in best or best[(x, y)][0] > sc: best[(x, y)] = (sc, dx / max(r, .5))
    for (x, y), (sc, u) in best.items():
        t = base + (1 if u < -0.35 else 0 if u < 0.25 else -1 if u < 0.7 else -2)
        c.P(x, y, K(m, t))
    return best


def sclump(circles):
    return circles


def tex16(base, specks, wrap=True):
    """16×16 이음새 없는 반복 바닥. base=색, specks=[(x,y,w,h,색)...] 덩이(손으로 놓은 몇 개), 가장자리는 감싼다."""
    t = Cv(16, 16); t.R(0, 0, 16, 16, base)
    for (x, y, w, h, col) in specks:
        for j in range(h):
            for i in range(w): t.P((x + i) % 16, (y + j) % 16, col)
    return t


def tier(c, cx, ytop, ybot, hw0, hw1, seed=0, m='leaf', snow=False, phase=0, depth=1):
    """침엽수 한 단: 위 반폭 hw0 → 아래 반폭 hw1, 아래 가장자리는 톱니. 왼쪽 밝고 오른쪽 어둡고 아래 그늘."""
    H = ybot - ytop
    for y in range(ytop, ybot + 1):
        f = (y - ytop) / max(1, H)
        hw = hw0 + (hw1 - hw0) * f
        for x in range(int(cx - hw), int(cx + hw) + 1):
            u = (x + .5 - cx) / max(hw, 1)
            tooth = (0, 2, 4, 3, 1, 3, 5, 2)[((x + phase) // 2) % 8] if f > 0.0 else 0
            if y > ybot - tooth: continue
            if abs(u) > 1.0: continue
            wob = hh(y, seed, 3) * 0.28
            t = 3 if u < -0.30 + wob else 2 if u < 0.28 + wob else 1
            if f > 0.72: t -= 1                      # 아래 그늘(위 단이 가린 자리)
            if f < 0.18 and u < 0.05: t += 1         # 단 윗머리 하이라이트
            if f > 0.30 and f < 0.58 and hh(x, y, seed + 9) < 0.10: t += 1 if u < 0.3 else 0
            t = max(1, min(4, t))
            col = K(m, t)
            if snow:
                cover = 0.62 - 0.22 * abs(u + 0.15) + (hh(x, seed, 5) - 0.5) * 0.25
                if f < cover and tooth < 3:
                    st = 3 if u < -0.15 else 2 if u < 0.45 else 1
                    if f > cover - 0.14: st = max(1, st - 1)
                    col = K('snow', st)
            c.P(x, y, col)


def ground_shadow(c, x, y, w, h=2):
    c.R(x, y, w, h, OL2)


def edge_cut(c, p, seed=0):
    """실루엣 가장자리 화소를 p 비율로 깎는다(톱니)."""
    rm = []
    for y in range(c.h):
        for x in range(c.w):
            if not c.opaque(x, y): continue
            if any(not c.opaque(x + ox, y + oy) for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1))) and hh(x, y, seed) < p:
                rm.append((x, y))
    for x, y in rm: c.clear(x, y)


# ───────────── 숲 바닥 표면 ─────────────
def _forest_floor_tex(variant):
    base = K('leaf', 1)
    if variant == 'a':
        sp = [(2, 3, 4, 2, K('leaf', 2)), (3, 2, 2, 1, K('leaf', 2)), (10, 9, 5, 2, K('leaf', 2)), (11, 8, 3, 1, K('leaf', 2)),
              (1, 12, 3, 2, K('dirt', 1)), (12, 2, 3, 2, K('dirt', 1)), (7, 6, 2, 1, K('leaf', 0)),
              (5, 5, 2, 1, K('leaf', 3)), (13, 12, 2, 1, K('leaf', 3)), (8, 13, 3, 1, K('leaf', 0))]
    else:
        sp = [(9, 2, 5, 2, K('leaf', 2)), (10, 1, 3, 1, K('leaf', 2)), (1, 9, 4, 2, K('leaf', 2)), (2, 8, 2, 1, K('leaf', 2)),
              (6, 12, 3, 2, K('dirt', 1)), (0, 4, 3, 2, K('dirt', 1)), (12, 8, 2, 1, K('leaf', 0)),
              (4, 14, 4, 1, K('leaf', 0)), (3, 9, 2, 1, K('leaf', 3)), (10, 5, 2, 1, K('leaf', 3)),
              (7, 3, 2, 1, K('fire', 2)), (14, 14, 2, 1, K('fire', 1))]
    return tex16(base, sp)


@REG.piece('wz-nat-forest-floor-a', '이끼 숲 바닥 A', 1, 1, ['F'], 'surfaces', 'carriage',
           desc='어두운 이끼 숲 바닥 1칸 반복. 이끼 덩이 사이에 젖은 흙·낙엽 한두 점.', rules='금지된 숲 마차장 바닥. B 와 섞어 깐다.',
           tags=['숲바닥', '이끼'], role='terrain', repeat=True)
def _ff_a(c): c.tile(_forest_floor_tex('a'), 0, 0, 16, 16)


@REG.piece('wz-nat-forest-floor-b', '이끼 숲 바닥 B', 1, 1, ['F'], 'surfaces', 'carriage',
           desc='어두운 이끼 숲 바닥 1칸 반복(A 와 다른 덩이 배치).', rules='A 와 섞어 깐다.',
           tags=['숲바닥', '이끼'], role='terrain', repeat=True)
def _ff_b(c): c.tile(_forest_floor_tex('b'), 0, 0, 16, 16)


def _grass_tex(variant):
    base = K('grass', 2)
    if variant == 'a':
        sp = [(2, 2, 5, 3, K('grass', 1)), (3, 1, 3, 1, K('grass', 1)), (10, 9, 5, 3, K('grass', 1)), (11, 8, 3, 1, K('grass', 1)),
              (9, 3, 2, 1, K('grass', 3)), (1, 10, 2, 1, K('grass', 3)), (6, 13, 2, 1, K('grass', 3)),
              (13, 4, 1, 2, K('grass', 3)), (5, 7, 1, 2, K('grass', 3))]
    else:
        sp = [(9, 2, 5, 3, K('grass', 1)), (10, 1, 3, 1, K('grass', 1)), (1, 9, 5, 3, K('grass', 1)), (2, 8, 3, 1, K('grass', 1)),
              (3, 3, 2, 1, K('grass', 3)), (12, 11, 2, 1, K('grass', 3)), (7, 14, 2, 1, K('grass', 3)),
              (14, 8, 1, 2, K('grass', 3)), (6, 5, 1, 2, K('grass', 3))]
    return tex16(base, sp)


@REG.piece('wz-nat-grass-a', '관리된 잔디 바닥 A', 1, 1, ['F'], 'surfaces', 'quidditch',
           desc='깎은 잔디 바닥 1칸 반복. 어두운 결 덩이와 밝은 풀끝 몇 개.', rules='경기장·정원 바닥. B 와 섞는다.',
           tags=['잔디', '바닥'], role='terrain', repeat=True)
def _g_a(c): c.tile(_grass_tex('a'), 0, 0, 16, 16)


@REG.piece('wz-nat-grass-b', '관리된 잔디 바닥 B', 1, 1, ['F'], 'surfaces', 'quidditch',
           desc='깎은 잔디 바닥 1칸 반복(A 와 다른 배치).', rules='A 와 섞는다.',
           tags=['잔디', '바닥'], role='terrain', repeat=True)
def _g_b(c): c.tile(_grass_tex('b'), 0, 0, 16, 16)


_E = (3, 3, 2, 2, 3, 4, 4, 3, 3, 3, 4, 3, 2, 2, 3, 3)    # 흙길 경계 들어간 깊이(16 주기)


def _dirt_tex():
    base = K('dirt', 3)
    sp = [(3, 4, 3, 2, K('dirt', 2)), (4, 3, 1, 1, K('dirt', 2)), (11, 11, 3, 1, K('dirt', 2)), (12, 12, 2, 1, K('dirt', 2)),
          (8, 7, 1, 1, K('dirt', 4)), (1, 12, 1, 1, K('dirt', 4)),
          (6, 11, 2, 1, K('stone', 2)), (6, 10, 1, 1, K('stone', 3))]
    return tex16(base, sp)


@REG.autotile('wz-nat-dirt', '숲길 흙', 'surfaces', 'carriage', desc='금지된 숲 흙길. 젖은 흙 덩이·자갈 몇 알, 바깥은 이끼 숲 바닥.',
              rules='흙길 가장자리는 이끼 바닥으로 불규칙하게 물러난다. 숲 바닥 A/B 위에 칠한다.', pc='floor', tags=['흙길'])
def _dirt():
    moss = _forest_floor_tex('a'); dirt = _dirt_tex()
    p = Cv(48, 48); p.tile(moss, 0, 0, 48, 48)
    for y in range(48):
        for x in range(48):
            et, eb, el, er = _E[x % 16], _E[x % 16], _E[y % 16], _E[y % 16]
            inside = (y >= et and y < 48 - eb and x >= el and x < 48 - er)
            if inside:
                # 바깥 모서리 둥글게
                for (qx, qy) in ((0, 0), (47, 0), (0, 47), (47, 47)):
                    if abs(x - qx) + abs(y - qy) < 7 and (x < 8 or x > 39) and (y < 8 or y > 39): inside = False
            if inside:
                p.P(x, y, dirt.get(x % 16, y % 16))
    # 경계 안쪽 1px 어두운 흙(윤곽)
    q = Cv(48, 48); q.a = p.a.copy()
    dset = set()
    for y in range(48):
        for x in range(48):
            inside = p.get(x, y) in [tuple(int(v) for v in K('dirt', i)) for i in range(6)] and not (p.get(x, y) in set(moss.get(i, j) for i in range(16) for j in range(16)))
            dset.add((x, y)) if inside else None
    for (x, y) in dset:
        edge = any((x + ox, y + oy) not in dset for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= x + ox < 48 and 0 <= y + oy < 48)
        if edge: p.P(x, y, K('dirt', 1))
    ic = Cv(16, 16); ic.tile(dirt, 0, 0, 16, 16)
    for (x, y) in ((0, 0), (1, 0), (2, 0), (0, 1), (1, 1), (0, 2)):
        for (ax, ay) in ((x, y), (15 - x, y), (x, 15 - y), (15 - x, 15 - y)): ic.P(ax, ay, moss.get(ax, ay))
    for (x, y) in ((3, 0), (0, 3)):
        for (ax, ay) in ((x, y), (15 - x, y), (x, 15 - y), (15 - x, 15 - y)): ic.P(ax, ay, K('dirt', 1))
    return p, ic


# ───────────── 나무 공용 ─────────────
def autowalk(fn, w, h, solid=()):
    """scratch 로 그려 보고 비어 있지 않은 칸은 C(사람 위), solid 칸 (tx,ty) 은 S, 빈 칸은 '.'."""
    t = Cv(w * 16, h * 16); fn(t)
    rows = []
    for ty in range(h):
        r = ''
        for tx in range(w):
            ne = bool((t.a[ty * 16:(ty + 1) * 16, tx * 16:(tx + 1) * 16, 3] > 0).any())
            r += '.' if not ne else ('S' if (tx, ty) in solid else 'C')
        rows.append(r)
    return rows


def trunk_flat(c, x0, x1, y0, y1, m='wood'):
    """곧은 줄기: 왼쪽 밝고 오른쪽 어두움 + 결 한 줄."""
    wd = x1 - x0 + 1
    for y in range(y0, y1 + 1):
        for i in range(wd):
            f = i / max(1, wd - 1)
            t = 4 if f < 0.25 else 3 if f < 0.6 else 2 if f < 0.85 else 1
            c.P(x0 + i, y, K(m, t))
        if hh(y, x0, 2) < 0.35: c.P(x0 + 1 + int(hh(y, x0, 3) * (wd - 3)), y, K(m, 2))


def auto(id, name, w, h, space, desc, rules='', tags=(), solid=(), role='prop', frames=1):
    """walk 를 scratch 그림에서 자동 계산해 등록(빈 칸 '.', 솔리드 지정 칸 S, 나머지 C)."""
    def deco(fn):
        return REG.piece(id, name, w, h, autowalk(fn, w, h, solid), 'nature', space, desc, rules=rules, tags=list(tags), role=role)(fn)
    return deco


def autof(id, name, w, h, space, desc, rules='', tags=(), role='prop', solid=()):
    """바닥 덧그림 f / 막힘 S 자동 walk: 비어 있지 않은 칸은 f(solid 지정 칸은 S)."""
    def deco(fn):
        wk = autowalk(fn, w, h, solid)
        wk = [r.replace('C', 'f') for r in wk]
        return REG.piece(id, name, w, h, wk, 'nature', space, desc, rules=rules, tags=list(tags), role=role)(fn)
    return deco


def conifer(c, cx, tiers, trunk, snow=False, seed=0):
    """tiers: 아래 단부터 (ytop,ybot,hw0,hw1). 윗단이 앞. 윗단 치마 밑에 2px 그림자 띠를 아래 단 위에 얹는다."""
    tx0, tx1, ty0, ty1 = trunk
    trunk_flat(c, tx0, tx1, ty0, ty1)
    for i, (yt, yb, h0, h1) in enumerate(tiers):
        if i > 0:
            sh = Cv(c.w, c.h)
            tier(sh, cx, yt, yb, h0, h1, seed=seed + i, phase=i * 3)
            for y in range(c.h - 3, -1, -1):
                for x in range(c.w):
                    if sh.opaque(x, y) and c.opaque(x, y + 2) and not sh.opaque(x, y + 2):
                        c.P(x, y + 2, K('leaf', 1)); 
                        if c.opaque(x, y + 3) and not sh.opaque(x, y + 3): c.P(x, y + 3, K('leaf', 1))
        tier(c, cx, yt, yb, h0, h1, seed=seed + i, snow=snow, phase=i * 3)


@auto('wz-nat-conifer-large', '큰 침엽수', 3, 4, 'carriage', '금지된 숲 짙은 녹색 큰 침엽수. 세 단 톱니 치마, 줄기 밑동만 막힘.',
      rules='밑동 한 칸만 S, 나머지 수관은 C. 숲 바닥 위에 세운다.', tags=['나무', '침엽수'], solid=[(1, 3)])
def _conifer_large(c):
    conifer(c, 24, [(26, 52, 8, 21), (13, 36, 5, 17), (2, 20, 2, 12)], (21, 26, 48, 62), seed=1)
    c.R(14, 61, 22, 2, OL2)
    c.outline()


@auto('wz-nat-conifer-small', '작은 침엽수', 2, 3, 'carriage', '작은 침엽수 두 단. 줄기 밑동 두 칸이 막힌다.',
      rules='아래 행 두 칸 S, 위 수관 C.', tags=['나무', '침엽수'], solid=[(0, 2), (1, 2)])
def _conifer_small(c):
    conifer(c, 16, [(18, 38, 5, 13), (6, 24, 2, 9)], (14, 17, 34, 46), seed=7)
    c.R(8, 45, 16, 2, OL2)
    c.outline()


@auto('wz-nat-conifer-large-snow', '눈 얹힌 큰 침엽수', 3, 4, 'postoffice', '눈이 단마다 쌓인 큰 침엽수.',
      rules='밑동 한 칸 S, 나머지 C. 눈 마을 바닥 위에 세운다.', tags=['나무', '침엽수', '눈'], solid=[(1, 3)])
def _conifer_large_snow(c):
    conifer(c, 24, [(26, 52, 8, 21), (13, 36, 5, 17), (2, 20, 2, 12)], (21, 26, 48, 62), snow=True, seed=1)
    c.R(14, 61, 22, 2, OL2)
    c.outline()


@auto('wz-nat-conifer-small-snow', '눈 얹힌 작은 침엽수', 2, 3, 'postoffice', '눈 얹힌 작은 침엽수.',
      rules='아래 행 두 칸 S, 위 C.', tags=['나무', '침엽수', '눈'], solid=[(0, 2), (1, 2)])
def _conifer_small_snow(c):
    conifer(c, 16, [(18, 38, 5, 13), (6, 24, 2, 9)], (14, 17, 34, 46), snow=True, seed=7)
    c.R(8, 45, 16, 2, OL2)
    c.outline()


# ───────────── 넓은 잎 고목 · 뒤틀린 고목 ─────────────
def under_canopy_shadow(c, x0, x1, rows=3):
    """수관 바로 밑 줄기에 어두운 그림자 띠."""
    for x in range(x0, x1 + 1):
        lo = -1
        for y in range(c.h):
            if c.opaque(x, y) and tuple(c.a[y, x, :3]) in LEAF_RGB: lo = y
        if lo < 0: continue
        for k in range(1, rows + 1):
            y = lo + k
            if y < c.h and c.opaque(x, y) and tuple(c.a[y, x, :3]) not in LEAF_RGB:
                c.P(x, y, K('wood', 1))


LEAF_RGB = {tuple(K('leaf', _t))[:3] for _t in range(0, 5)}


@auto('wz-nat-broadleaf-old', '넓은 잎 고목', 4, 4, 'carriage', '둥글게 부푼 넓은 잎 고목. 굵은 줄기와 퍼진 뿌리, 수관 네 덩이.',
      rules='밑동 두 칸 S, 수관 C. 줄기 가운데 두 칸만 막는다.', tags=['나무', '넓은잎'], solid=[(1, 3), (2, 3)])
def _broadleaf(c):
    # 줄기와 뿌리 퍼짐
    trunk_flat(c, 27, 37, 36, 61)
    for y, (a, b) in {57: (25, 39), 58: (24, 40), 59: (22, 41), 60: (21, 42), 61: (21, 42)}.items():
        for x in range(a, b + 1):
            f = (x - a) / (b - a)
            c.P(x, y, K('wood', 4 if f < .2 else 3 if f < .55 else 2 if f < .85 else 1))
    c.R(23, 55, 2, 1, K('wood', 3)); c.R(40, 55, 2, 1, K('wood', 2))
    clumps(c, [(32, 15, 14), (16, 25, 12), (48, 25, 12), (32, 29, 15), (9, 36, 8), (55, 36, 8), (22, 39, 9), (42, 39, 9)],
           seed=3, serr=0.28, shift=-1, hi=0.62)
    under_canopy_shadow(c, 24, 41, 3)
    c.R(16, 61, 34, 2, OL2)
    c.outline()


@auto('wz-nat-twisted-old', '금지된 숲 뒤틀린 고목', 4, 4, 'carriage', '비틀린 줄기와 드러난 뿌리, 성긴 어두운 잎 덩이의 금지된 숲 고목.',
      rules='밑동 두 칸 S, 가지·잎 C.', tags=['나무', '금지된숲'], solid=[(1, 3), (2, 3)])
def _twisted(c):
    # 드러난 뿌리 (아치)
    for pts in ([(30, 58, 3), (24, 59, 2), (17, 61, 1.2)], [(34, 58, 3), (41, 59, 2), (48, 61, 1.2)],
                [(31, 59, 2), (28, 62, 1.5)], [(35, 59, 2), (38, 62, 1.5)]):
        limb(c, pts, base=2)
    # 비틀린 몸통
    limb(c, [(32, 60, 6), (28, 52, 5), (34, 43, 5), (27, 33, 4.4), (32, 24, 3.6), (30, 14, 2.4)], base=2)
    # 갈라진 가지
    limb(c, [(27, 36, 2), (18, 30, 1.6), (9, 29, 1.1), (4, 24, 0.8)], base=2)
    limb(c, [(34, 38, 2), (44, 33, 1.6), (53, 34, 1.1), (59, 29, 0.8)], base=2)
    limb(c, [(31, 24, 2), (22, 18, 1.4), (14, 11, 1)], base=2)
    limb(c, [(32, 22, 2), (42, 15, 1.4), (49, 8, 1)], base=2)
    # 옹이 구멍
    c.R(30, 47, 2, 3, K('wood', 0)); c.P(30, 46, K('wood', 1))
    # 성긴 어두운 잎 덩이
    clumps(c, [(10, 24, 5), (4, 20, 3.5)], seed=9, shift=-1, serr=0.3)
    clumps(c, [(56, 28, 5), (60, 24, 3.5)], seed=11, shift=-1, serr=0.3)
    clumps(c, [(16, 9, 6), (24, 6, 5), (32, 8, 6)], seed=13, shift=-1, serr=0.3)
    clumps(c, [(46, 6, 6), (54, 11, 5)], seed=15, shift=-1, serr=0.3)
    c.R(14, 61, 36, 2, OL2)
    c.outline()


# ───────────── 덤불 · 뿌리 · 바위 ─────────────
def snowcap(c, depth=3, seed=0, solid_snow=True):
    """각 열의 가장 위 잎 화소부터 depth 줄을 눈으로 덮는다(왼쪽 밝게)."""
    W, H = c.w, c.h
    for x in range(W):
        top = next((y for y in range(H) if c.opaque(x, y)), None)
        if top is None: continue
        d = depth + (1 if hh(x, seed, 4) > 0.55 else 0) - (1 if hh(x, seed, 6) < 0.25 else 0)
        for k in range(max(1, d)):
            y = top + k
            if y < H and c.opaque(x, y):
                u = x / W
                t = 4 if (u < 0.45 and k == 0) else 3 if (u < 0.6 and k < d - 1) else 2 if k < d - 1 else 1
                c.P(x, y, K('snow', max(1, min(4, t))))


def moss_cap(c, depth=2, seed=0, ramp='grass'):
    W, H = c.w, c.h
    for x in range(W):
        top = next((y for y in range(H) if c.opaque(x, y)), None)
        if top is None: continue
        d = depth + (1 if hh(x, seed, 8) > 0.5 else 0) - (1 if hh(x, seed, 2) < 0.3 else 0)
        for k in range(max(0, d)):
            y = top + k
            if y < H and c.opaque(x, y):
                t = 4 if (k == 0 and x < W * 0.5) else 3 if k < d - 1 else 2
                c.P(x, y, K(ramp, t))


def bush_circles(w):
    if w == 1: return [(8, 8.5, 5.5), (4.5, 9.8, 3.6), (11.5, 9.8, 3.6)]
    return [(16, 7.5, 6), (8, 9, 5), (24, 9, 5), (12, 10.5, 4), (20, 10.5, 4)]


@auto('wz-nat-bush', '덤불', 1, 1, 'shared', '둥글고 짙은 덤불. 한 칸을 막는다.', rules='한 칸 S.', tags=['덤불'], solid=[(0, 0)])
def _bush(c):
    c.R(3, 13, 11, 2, OL2)
    clumps(c, bush_circles(1), seed=21, serr=0.25, shift=-1, hi=0.62)
    c.outline()


@auto('wz-nat-bush-wide', '넓은 덤불', 2, 1, 'shared', '가로로 긴 덤불. 두 칸을 막는다.', rules='두 칸 S.', tags=['덤불'], solid=[(0, 0), (1, 0)])
def _bush_wide(c):
    c.R(3, 13, 26, 2, OL2)
    clumps(c, bush_circles(2), seed=23, serr=0.25, shift=-1, hi=0.62)
    c.outline()


def snow_mounds(c, mounds, seed=0, pokes=()):
    """덤불 윗면에 얹힌 눈 덩이: mounds=[(cx,cy,rx,ry)...] 타원 덩이를 3단(흰·옅은 청회·그늘)으로 채운다.
    아래 가장자리는 덩이진 톱니(한두 칸 처짐), 눈 밑 잎에는 1px 그늘. pokes=[(x,y,t)] 눈 사이로 삐져나온 잎."""
    own = {}
    for i, (cx, cy, rx, ry) in enumerate(mounds):
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                u, v = (x + .5 - cx) / rx, (y + .5 - cy) / ry
                if u * u + v * v > 1: continue
                if (x, y) not in own or mounds[own[(x, y)][2]][1] < cy: own[(x, y)] = (u, v, i)
    # 아래 톱니: 덩이 아래 가장자리 칸마다 한 칸 처지거나 한 칸 깎인다
    bottom = {}
    for (x, y) in own: bottom[x] = max(bottom.get(x, -1), y)
    for x, yb in bottom.items():
        r = hh(x, seed, 7)
        if r < 0.28 and (x, yb - 1) in own and c.opaque(x, yb): del own[(x, yb)]
        elif r > 0.62 and c.opaque(x, yb + 1):
            u, v, i = own[(x, yb)]; own[(x, yb + 1)] = (u, 1.2, i)
    for (x, y), (u, v, i) in own.items():
        s = -0.50 * u - 0.85 * v
        t = 3 if s > 0.30 else 2 if s > -0.40 else 1      # snow 램프: 3 흰 · 2 옅은 청회 · 1 그늘
        if v > 0.62: t = 1
        c.P(x, y, K('snow', t))
    # 눈 밑 잎 그늘(눈이 잎 위에 얹혀 있음을 보인다)
    for (x, y) in list(own):
        if (x, y + 1) not in own and c.opaque(x, y + 1) and tuple(c.get(x, y + 1)) not in RAMPS['snow']:
            c.P(x, y + 1, K('leaf', 1))
    for (x, y, t) in pokes: c.P(x, y, K('leaf', t))


@auto('wz-nat-bush-snow', '눈 얹힌 덤불', 1, 1, 'postoffice', '윗면에 눈 덩이가 소복이 얹힌 덤불.', rules='한 칸 S.', tags=['덤불', '눈'], solid=[(0, 0)])
def _bush_snow(c):
    c.R(3, 13, 11, 2, OL2)
    clumps(c, bush_circles(1), seed=21, serr=0.25, shift=0, hi=0.62)
    snow_mounds(c, [(8.2, 4.7, 4.4, 2.2), (4.0, 7.1, 2.6, 1.5), (12.3, 7.3, 2.4, 1.4)], seed=3,
                pokes=[(2, 7, 3)])
    c.outline()


@auto('wz-nat-bush-wide-snow', '눈 얹힌 넓은 덤불', 2, 1, 'postoffice', '윗면에 눈 덩이 셋이 얹힌 가로 덤불. 잎이 눈 사이로 삐져나온다.', rules='두 칸 S.', tags=['덤불', '눈'], solid=[(0, 0), (1, 0)])
def _bush_wide_snow(c):
    c.R(3, 13, 26, 2, OL2)
    clumps(c, bush_circles(2), seed=23, serr=0.25, shift=0, hi=0.62)
    snow_mounds(c, [(16.0, 3.1, 5.0, 2.2), (7.8, 5.7, 4.0, 1.9), (24.4, 5.9, 3.8, 1.8)], seed=5,
                pokes=[(11, 4, 3), (12, 5, 2), (20, 4, 3), (21, 5, 2)])
    c.outline()


@auto('wz-nat-root-mass', '낮은 뿌리 덩이', 2, 1, 'carriage', '이끼 낀 낮은 뿌리 덩이. 두 칸을 막는다.', rules='두 칸 S.', tags=['뿌리'], solid=[(0, 0), (1, 0)])
def _root_mass(c):
    c.R(3, 13, 26, 2, OL2)
    # 바깥으로 뻗는 굵은 뿌리 아치 넷
    limb(c, [(1, 13, 1.2), (4, 8, 2.0), (9, 5, 2.8), (14, 5, 3.2)], base=3)
    limb(c, [(31, 13, 1.2), (28, 8, 2.0), (23, 5, 2.8), (18, 5, 3.2)], base=3)
    limb(c, [(8, 13, 1.2), (11, 10, 2.0), (14, 7, 2.6)], base=2)
    limb(c, [(24, 13, 1.2), (21, 10, 2.0), (18, 7, 2.6)], base=2)
    # 가운데 밑동 그루터기
    c.R(12, 3, 9, 8, K('wood', 3)); c.R(12, 3, 3, 8, K('wood', 4)); c.R(19, 3, 2, 8, K('wood', 2))
    c.ellipse(16, 3, 5, 2, K('wood', 5)); c.ellipse(16, 3, 2, 1, K('wood', 4))
    # 이끼 점
    for (x, y) in ((6, 5), (7, 5), (8, 4), (24, 5), (25, 6), (14, 9), (19, 8), (3, 8)):
        c.P(x, y, K('leaf', 3 if hh(x, y, 3) > 0.4 else 4))
    c.R(13, 10, 7, 1, K('wood', 1))
    c.outline()


@auto('wz-nat-rock-moss', '이끼 바위', 1, 1, 'carriage', '이끼가 덮인 작은 바위.', rules='한 칸 S.', tags=['바위'], solid=[(0, 0)])
def _rock_s(c):
    c.R(3, 13, 11, 2, OL2)
    clumps(c, [(8, 9, 5.5), (4.5, 11, 3.5), (11.5, 11, 3.5)], m='stone', seed=41, serr=0.12, hi=0.55)
    moss_cap(c, 2, seed=3)
    c.outline()


@auto('wz-nat-rock-moss-big', '큰 이끼 바위', 2, 2, 'carriage', '이끼 낀 큰 바위. 아래 줄 두 칸이 막힌다.', rules='아래 행 S, 윗부분 C.', tags=['바위'], solid=[(0, 1), (1, 1)])
def _rock_b(c):
    c.R(3, 29, 26, 2, OL2)
    clumps(c, [(16, 16, 9), (8, 23, 6.5), (25, 23, 6.5), (16, 24, 7), (21, 12, 6.5), (11, 12, 5.5)], m='stone', seed=43, serr=0.12, hi=0.5)
    moss_cap(c, 3, seed=5)
    c.outline()


# ───────────── 바닥 덧그림: 양치·버섯·낙엽·잔디 ─────────────
def frond(c, x0, y0, pts, lt=4, leaflets=True):
    """pts=[(x,y)...] 줄기 경로. 줄기는 leaf 3, 작은 잎은 양옆 한 칸씩."""
    path = []
    for i in range(len(pts) - 1):
        (ax, ay), (bx, by) = pts[i], pts[i + 1]
        n = max(abs(bx - ax), abs(by - ay), 1)
        for k in range(n):
            path.append((round(ax + (bx - ax) * k / n), round(ay + (by - ay) * k / n)))
    path.append(pts[-1])
    for i, (x, y) in enumerate(path):
        c.P(x, y, K('leaf', 3))
        if leaflets and 1 <= i < len(path) - 1:
            dx = path[i + 1][0] - path[i - 1][0]; dy = path[i + 1][1] - path[i - 1][1]
            px, py = (-dy, dx) if abs(dx) + abs(dy) else (1, 0)
            sx = 1 if px > 0 else -1 if px < 0 else 0; sy = 1 if py > 0 else -1 if py < 0 else 0
            ln = 2 if i < len(path) - 2 else 1
            for s in (-1, 1):
                for j in range(1, ln + 1):
                    if i % 2 == 0 or j == 1:
                        xx, yy = x + sx * s * j, y + sy * s * j
                        if 0 <= xx < c.w and 0 <= yy < c.h and not c.opaque(xx, yy):
                            c.P(xx, yy, K('leaf', 4 if s * sx + s * sy < 0 else 2))


def frond(c, rib, leaf_len=3, step=2):
    """깃꼴 잎: 가는 중심맥 + 비스듬히 위로 뻗는 한 줄짜리 작은잎(사이에 빈 줄)."""
    n = len(rib)
    for i, (x, y) in enumerate(rib):
        c.P(x, y, K('leaf', 2))
        if i % step == 1 and i < n - 1:
            ln = max(2, round(leaf_len * (1 - 0.6 * i / n)))
            for k in range(1, ln + 1):
                yy = y - (k + 1) // 2
                c.P(x - k, yy, K('leaf', 4 if k < ln else 3))
                c.P(x + k, yy, K('leaf', 3 if k < ln else 2))
    x, y = rib[-1]
    c.P(x, y - 1, K('leaf', 4))


def blade(c, pts):
    limb(c, pts, m='leaf', base=3)
    # 톱니 잎맥: 가장자리 한 점씩 파냄
    for (x, y, r) in pts[1:-1]:
        pass


@autof('wz-nat-fern-a', '양치 A', 1, 1, 'carriage', '위로 퍼진 양치 잎 다섯 장.', rules='바닥 덧그림.', tags=['양치'])
def _fern_a(c):
    blade(c, [(8, 14, 1.0), (8, 9, 1.4), (8, 3, .6)])
    blade(c, [(7, 14, 1.0), (4, 11, 1.4), (2, 5, .6)])
    blade(c, [(9, 14, 1.0), (12, 11, 1.4), (14, 5, .6)])
    blade(c, [(7, 14, 1.0), (3, 13, 1.1), (0, 11, .5)])
    blade(c, [(9, 14, 1.0), (13, 13, 1.1), (15, 11, .5)])
    c.outline()


def toothed_frond(c, pts, ticks=(0.38, 0.6, 0.8)):
    """양치 잎 한 장: 굽은 잎몸(limb, leaf 3단) + 잎몸 양옆으로 작은 잎 끝이 한 칸씩 비스듬히 돋는다.
    돋은 칸 사이는 윤곽이 파고들어 톱니로 읽힌다. 위·왼쪽 쪽 돋음 leaf 4, 반대쪽 leaf 3."""
    seg = []
    for i in range(len(pts) - 1):
        (x0, y0, r0), (x1, y1, r1) = pts[i], pts[i + 1]
        n = 40
        for k in range(n):
            t = k / n; seg.append((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r0 + (r1 - r0) * t))
    seg.append(pts[-1])
    limb(c, pts, m='leaf', base=3)
    N = len(seg) - 1
    for tt in ticks:
        i = int(tt * N)
        x, y, r = seg[i]
        ax, ay, _ = seg[max(0, i - 4)]; bx, by, _ = seg[min(N, i + 4)]
        dx, dy = bx - ax, by - ay; L = math.hypot(dx, dy) or 1; dx, dy = dx / L, dy / L
        for sgn in (1, -1):
            nx, ny = -dy * sgn, dx * sgn
            up = (nx * -0.5 + ny * -0.85) > 0
            col = K('leaf', 4 if up else 3)
            px, py = x + nx * (r + 1.4) + dx * 1.2, y + ny * (r + 1.4) + dy * 1.2
            q = (int(math.floor(px)), int(math.floor(py)))
            if c.opaque(*q): continue
            if not any(c.opaque(q[0] + ox, q[1] + oy) for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                m = (int(math.floor(x + nx * (r + 0.5) + dx * 0.6)), int(math.floor(y + ny * (r + 0.5) + dy * 0.6)))
                if not c.opaque(*m): c.P(m[0], m[1], col)
                if not any(c.opaque(q[0] + ox, q[1] + oy) for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1))): continue
            c.P(q[0], q[1], col)


@autof('wz-nat-fern-b', '양치 B', 1, 1, 'carriage', '밑동 한 점에서 부채꼴로 뻗어 끝이 휘어 늘어진 톱니 양치 잎 네 장.', rules='바닥 덧그림.', tags=['양치'])
def _fern_b(c):
    toothed_frond(c, [(7, 14, 0.8), (3.5, 11.5, 1.0), (0.8, 12.8, .5)], ticks=(0.4, 0.7))      # 왼쪽 낮게 늘어진 잎
    toothed_frond(c, [(9, 14, 0.8), (12.5, 11.5, 1.0), (15.2, 12.8, .5)], ticks=(0.4, 0.7))    # 오른쪽 낮게
    toothed_frond(c, [(7.5, 14, 0.9), (5.2, 8, 1.1), (3.6, 3.2, 0.8), (1.8, 5.0, .5)], ticks=(0.3, 0.5, 0.7))   # 왼쪽 위로 휘었다 처진 잎
    toothed_frond(c, [(8.5, 14, 0.9), (10.8, 8, 1.1), (12.4, 3.2, 0.8), (14.2, 5.0, .5)], ticks=(0.3, 0.5, 0.7))  # 오른쪽 위
    c.R(7, 14, 3, 1, K('leaf', 2))
    c.outline()


@autof('wz-nat-mushrooms', '버섯 무리', 1, 1, 'carriage', '붉은 갓 버섯 두 송이와 작은 한 송이.', rules='바닥 덧그림.', tags=['버섯'])
def _mush(c):
    def shroom(cx, cy, rx, ry, sh):
        for y in range(cy + ry, cy + ry + sh):
            c.P(cx - 1, y, K('linen', 4)); c.P(cx, y, K('linen', 2))
        for y in range(cy - ry, cy + 1):
            for x in range(cx - rx, cx + rx + 1):
                u = (x + .5 - cx - .5) / (rx + .5); v = (y - cy) / (ry + .3)
                if u * u + v * v <= 1.0:
                    c.P(x, y, K('red', 4 if (u + v < -0.6) else 3 if (u * 0.5 + v < 0.35) else 2))
        c.R(cx - rx, cy + 1, 2 * rx + 1, 1, K('red', 1))
    shroom(5, 6, 4, 3, 5)
    shroom(12, 10, 2, 2, 3)
    c.P(4, 4, K('linen', 4)); c.P(6, 5, K('linen', 3)); c.P(12, 9, K('linen', 3))
    c.R(1, 14, 14, 1, K('leaf', 2))
    c.outline()


def leaf_shape(c, x, y, col, hi, dark, kind=0):
    if kind == 0:
        c.P(x, y, hi); c.P(x + 1, y, col); c.P(x + 1, y + 1, dark); c.P(x + 2, y + 1, dark)
    else:
        c.P(x + 1, y, hi); c.P(x, y + 1, col); c.P(x + 1, y + 1, col); c.P(x + 2, y + 1, dark)


@autof('wz-nat-leaves-a', '낙엽 A', 1, 1, 'carriage', '주황·갈색 낙엽 흩뿌림.', rules='바닥 덧그림.', tags=['낙엽'])
def _leaves_a(c):
    o = (K('fire', 2), K('fire', 3), K('red', 2)); b = (K('wood', 3), K('wood', 4), K('wood', 2))
    for (x, y, k, pal) in ((1, 2, 0, o), (9, 1, 1, b), (5, 6, 1, o), (12, 7, 0, b), (2, 11, 0, b), (8, 12, 1, o)):
        leaf_shape(c, x, y, pal[0], pal[1], pal[2], k)


@autof('wz-nat-leaves-b', '낙엽 B', 1, 1, 'carriage', '황금·올리브 낙엽 흩뿌림.', rules='바닥 덧그림.', tags=['낙엽'])
def _leaves_b(c):
    g = (K('brass', 3), K('brass', 4), K('brass', 2)); l = (K('leaf', 3), K('leaf', 4), K('leaf', 2))
    for (x, y, k, pal) in ((3, 1, 1, g), (11, 3, 0, l), (0, 6, 0, g), (7, 8, 1, l), (12, 11, 1, g), (3, 12, 0, l)):
        leaf_shape(c, x, y, pal[0], pal[1], pal[2], k)


@autof('wz-nat-leaves-c', '낙엽 C', 1, 1, 'carriage', '붉은 낙엽과 젖은 갈색 잎.', rules='바닥 덧그림.', tags=['낙엽'])
def _leaves_c(c):
    r = (K('red', 3), K('red', 4), K('red', 2)); w = (K('wood', 2), K('wood', 3), K('wood', 1))
    for (x, y, k, pal) in ((6, 0, 0, r), (0, 4, 1, w), (10, 5, 1, r), (5, 9, 0, w), (12, 12, 0, r), (1, 13, 1, r)):
        leaf_shape(c, x, y, pal[0], pal[1], pal[2], k)


@autof('wz-nat-grass-tuft', '관리된 잔디 덩어리', 1, 1, 'quidditch', '짧게 다듬은 잔디 한 포기.', rules='잔디 바닥 위 덧그림.', tags=['잔디'])
def _tuft(c):
    for (x, top, lean) in ((2, 7, -1), (5, 3, 0), (8, 5, 0), (11, 7, 1), (13, 10, 1)):
        for y in range(top, 14):
            f = (14 - y) / (14 - top)
            xo = x + (round(lean * f * f * 2))
            wdt = 1 if y == top else 2
            for i in range(wdt):
                c.P(xo + i, y, K('grass', 4 if (i == 0 and y < 10) else 3 if y < 12 else 2) if i == 0 else K('grass', 2 if y < 12 else 1))
    c.R(3, 13, 11, 1, K('grass', 2))
    c.outline()


# ───────────── 물가: 갈대 · 젖은 바위 · 부유 수초 ─────────────
def reeds(c, ox, oy, stalks, base_w):
    """stalks=[(x,top,lean)] 줄기는 2px 폭, 끝에 부들 머리. 바닥에서 oy."""
    for (x, top, lean) in stalks:
        h = oy - top
        for y in range(top, oy):
            f = (oy - y) / h
            xo = x + (round(lean * f * f) if lean else 0)
            c.P(xo, y, K('leaf', 4 if y % 7 else 3)); c.P(xo + 1, y, K('leaf', 3 if y % 7 else 2))
        xt = x + (round(lean) if lean else 0)
        for y in range(top, top + 4):
            c.P(xt, y, K('wood', 4)); c.P(xt + 1, y, K('wood', 2))
        c.P(xt, top - 1, K('wood', 3)); c.P(xt + 1, top - 1, K('wood', 2))


@auto('wz-nat-reeds', '갈대 군락', 1, 2, 'boathouse', '물가 갈대 한 무더기. 부들 머리가 달린 줄기.', rules='아래 칸 S, 위 칸 C. 물 가장자리에 둔다.', tags=['갈대', '물가'], solid=[(0, 1)])
def _reeds(c):
    c.R(2, 28, 12, 1, K('water', 4)); c.R(4, 30, 8, 1, K('water', 3))
    reeds(c, 0, 28, [(3, 8, -1), (6, 3, 0), (9, 10, 1), (12, 14, 1), (1, 17, -1)], 12)
    c.outline()


@auto('wz-nat-reeds-big', '큰 갈대 군락', 2, 2, 'boathouse', '넓게 우거진 갈대 군락.', rules='아래 행 S, 위 행 C.', tags=['갈대', '물가'], solid=[(0, 1), (1, 1)])
def _reeds_big(c):
    c.R(2, 28, 28, 1, K('water', 4)); c.R(5, 30, 22, 1, K('water', 3))
    reeds(c, 0, 28, [(3, 12, -1), (7, 5, -1), (11, 9, 0), (15, 2, 0), (19, 8, 1), (23, 4, 1), (27, 13, 1), (13, 15, 0), (21, 16, 0)], 28)
    c.outline()


@auto('wz-nat-rock-wet', '젖은 바위', 1, 1, 'boathouse', '물 위로 솟은 젖은 바위. 둘레에 잔물결.', rules='한 칸 S. 물 타일 위에 둔다.', tags=['바위', '물가'], solid=[(0, 0)])
def _rock_wet(c):
    c.R(1, 12, 14, 1, K('water', 4)); c.R(0, 13, 4, 1, K('water', 3)); c.R(12, 13, 4, 1, K('water', 3)); c.R(3, 14, 10, 1, K('water', 3))
    clumps(c, [(8, 8, 5), (4.5, 10, 3.3), (11.5, 10, 3.3)], m='stone', seed=51, serr=0.1, hi=0.5)
    c.R(5, 11, 6, 1, K('water', 2)); c.R(3, 12, 3, 1, K('water', 2)); c.R(11, 12, 3, 1, K('water', 2))
    c.P(6, 4, K('water', 5) if len(__import__('wzlib').RAMPS['water']) > 5 else K('water', 4))
    c.outline()


@autof('wz-nat-water-lilies', '부유 수초', 1, 1, 'boathouse', '수면에 누운 납작한 수련 잎 세 장(V 홈)과 분홍 꽃 한 송이.', rules='물 타일 위 덧그림.', tags=['수초', '물가', '수련'])
def _lilies(c):
    W = lambda t: K('water', t)
    PADS = ((12.0, 4.3, 3.3, 2.2, 200), (12.9, 12.4, 2.2, 1.5, -100), (5.4, 9.6, 4.7, 3.1, -40))   # 뒤 → 앞
    # 수면 조각: 물 타일 바탕색(water 2). 물 위에 얹으면 녹아들고, 따로 보면 잎 둘레의 물로 읽힌다
    for (cx, cy, rx, ry, _) in PADS:
        c.ellipse(cx + 0.4, cy + 0.4, rx + 2.0, ry + 1.8, W(2))
    for (x, y, n) in ((1, 4, 3), (8, 1, 2), (8, 14, 3), (15, 8, 1), (2, 14, 2)):
        c.R(x, y, n, 1, W(3))
    c.P(2, 4, W(4)); c.P(9, 14, W(4))

    def pad(cx, cy, rx, ry, notch):
        """납작한 수련 잎: 몸 leaf 3, 위·왼쪽 테 leaf 4, 아래·오른쪽 테 leaf 2 + V 홈 + 윤곽 leaf 1 + 물 위 그림자."""
        nx, ny = math.cos(math.radians(notch)), math.sin(math.radians(notch))
        cells = set()
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                u, v = (x + .5 - cx) / rx, (y + .5 - cy) / ry
                d = math.hypot(u, v)
                if d > 1: continue
                if d > 0.10 and (u * nx + v * ny) / d > 0.80: continue          # V 홈
                cells.add((x, y))
        def leafy(q): return tuple(c.get(*q)) in RAMPS['leaf']
        for (x, y) in cells:
            t = 3
            if (x, y - 1) not in cells or (x - 1, y) not in cells: t = 4
            if (x, y + 1) not in cells or (x + 1, y) not in cells: t = 2 if t == 3 else 3
            c.P(x, y, K('leaf', t))
        for (x, y) in cells:                                                     # 유색 윤곽(물 쪽에만) — 물에 뜬 잎 아래쪽은 물 그늘
            for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                q = (x + ox, y + oy)
                if q not in cells and not leafy(q): c.P(q[0], q[1], K('leaf', 1) if oy <= 0 else W(1))

    for pd in PADS: pad(*pd)
    # 분홍 꽃(큰 잎 위에 작게): 흰 꽃잎 + 분홍 끝 + 노란 속, 밑에 꽃 그림자
    for (x, y, col) in ((3, 7, K('red', 3)), (5, 7, K('red', 3)), (3, 8, K('linen', 4)), (4, 8, K('brass', 4)),
                        (5, 8, K('linen', 4)), (2, 8, K('red', 3)), (6, 8, K('red', 3)), (4, 7, K('linen', 4)),
                        (3, 9, K('linen', 3)), (4, 9, K('linen', 4)), (5, 9, K('linen', 3)), (4, 10, K('leaf', 1))):
        c.P(x, y, col)


# ───────────── 예제 ─────────────
def _example_forest_edge():
    road = [('wz-nat-dirt', x, y) for y in (7, 8) for x in range(16)]
    flat = [('wz-nat-leaves-a', 3, 7), ('wz-nat-leaves-b', 10, 8), ('wz-nat-leaves-c', 6, 8), ('wz-nat-leaves-a', 13, 7),
            ('wz-nat-fern-a', 4, 6), ('wz-nat-fern-b', 10, 6), ('wz-nat-mushrooms', 12, 5), ('wz-nat-mushrooms', 3, 9),
            ('wz-nat-grass-tuft', 14, 6), ('wz-nat-grass-tuft', 1, 6), ('wz-nat-fern-a', 11, 10), ('wz-nat-leaves-c', 8, 9)]
    solid = [('wz-nat-broadleaf-old', 0, 0), ('wz-nat-conifer-large', 5, 0), ('wz-nat-twisted-old', 12, 0),
             ('wz-nat-conifer-small', 9, 2), ('wz-nat-conifer-small', 2, 4), ('wz-nat-rock-moss-big', 13, 4),
             ('wz-nat-bush-wide', 6, 6), ('wz-nat-root-mass', 7, 5), ('wz-nat-rock-moss', 9, 6),
             ('wz-nat-conifer-small', 0, 9), ('wz-nat-conifer-small', 13, 9), ('wz-nat-bush', 4, 10),
             ('wz-nat-bush-wide', 6, 10), ('wz-nat-rock-moss', 3, 11)]
    solid.sort(key=lambda t: (t[2] + REG.pieces[t[0]]['h'] if hasattr(REG, 'pieces') and t[0] in REG.pieces else t[2], t[1]))
    return road + flat + solid


REG.example('wz-nat-example-forest-edge', '숲 가장자리 예제', 'carriage', 16, 12, 'wz-nat-forest-floor-a', _example_forest_edge(),
            desc='금지된 숲 가장자리. 흙길이 가운데를 가로지르고 위쪽에 고목·침엽수, 아래쪽에 작은 침엽수·덤불. 수관 행 C, 밑동 S.')


if __name__ == '__main__':
    sys.exit(1 if run_module(MODULE) else 0)
