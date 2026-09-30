"""월드맵 설계 3단계 — 고지대(고원) 층.

원본 EasyRPG World 의 절벽 킷 문법(둥근 윗면 패널 + 얇은 어두운 외곽선 + 아래쪽 헤링본 절벽 벽)을 따라
고원의 윗면·테두리·절벽 앞면·양끝·계단·경사로를 좌표로 명시해 손으로 찍는다. 색은 원본 World 시트의 색만 쓴다.
생성 이미지·트레이싱 없음. 무작위 없음(칸 좌표 해시).

  · 윗면 3변형 x (풀·흙)  · N/W/E 얇은 절벽 테두리 · 앞면(3/4 절벽) 3변형 + 좌/우 끝 마감
  · 계단 칸(양옆은 절벽) · 경사로 칸(흙 사다리꼴) · 벽 밑 그림자(디더)
"""
import numpy as np
from terrain_lib import hh, hx, BAYER, GRASS, DIRT, SEA, RIVER, FOREST, MOUNT, SFOREST, SMOUNT, SAND, SNOW, MARSH

PAL = dict(o='271313', p='3e210d', q='4b3025', r='411e05', s='291010', a='4f2e21', b='65442a', c='8c5a21',
           d='a77b4b', l='689e4e', m='529543', n='44884a', h='8abe4c', e='ab8760', f='9f7b53', g='90704d',
           u='6b4f31', v='855c2e')
C = {k: np.array(hx(v), np.uint8) for k, v in PAL.items()}

# ── 배치(설계) ────────────────────────────────────────────────────────────────
# 층(tier)은 줄마다 (x시작, x끝) 구간으로 적은 불규칙 윗면. 벽은 각 열의 맨 아래 윗면 칸 바로 밑 칸, 그림자는 그 밑 칸.
# 뒤에 적힌 층이 위 층(고지대 2단).
def R(y0, spans):
    return {y0 + i: sp for i, sp in enumerate(spans)}


PLATEAUS = [
    dict(name='서쪽 2단 고원', top='grass', tiers=[
        R(15, [(11, 14), (9, 15), (8, 15), (8, 15), (8, 15), (8, 15), (8, 15)]),
        R(15, [(11, 14), (10, 14), (10, 14), (10, 14)])]),
    dict(name='중앙 고원', top='grass', tiers=[
        R(15, [(40, 45), (39, 46), (39, 46), (39, 46), (39, 47)])]),
    dict(name='사막 흙 고원', top='dirt', tiers=[
        R(32, [(10, 13), (9, 13), (9, 13)])]),
]
# 벽 칸에 놓는 통로: kind 'stair'(계단) | 'ramp'(경사로). name 은 길찾기용 가짜 장소 이름.
STAIRS = [
    ('stair_w1', 'stair', 11, 22),   # 서쪽 1단 앞면
    ('stair_w2', 'stair', 11, 19),   # 서쪽 2단 앞면(1단 윗면에서 2단 윗면으로)
    ('stair_c1', 'stair', 42, 20),   # 중앙 고원 앞면
    ('ramp_d1', 'ramp', 11, 35),     # 사막 고원 앞면(경사로)
]
# 윗면 위 길(칸): 계단 윗칸에서 고원 위 장소 발치까지(손으로 지정)
TOP_PATH = [(11, 21), (11, 20), (12, 21), (13, 21), (11, 18), (12, 18), (42, 19), (42, 18), (43, 18), (11, 34), (12, 34)]
# 고원 위 장소가 놓일 자리 확보를 위해 이 사각형(칸)은 풀로 되돌린다(숲·산·모래를 지움).
CLEAR_EXTRA = [(37, 21, 46, 23)]   # 중앙 고원 발치 숲을 풀 통로로


def tier_cells(tier):
    return {(x, y) for y, (xa, xb) in tier.items() for x in range(xa, xb + 1)}


def tier_walls(tier):
    m = tier_cells(tier)
    return {(x, y + 1) for (x, y) in m if (x, y + 1) not in m}


def feet_sites():
    """길찾기용 가짜 장소: 계단·경사로 벽 칸(1x1). 발치 = 그 아래 줄 칸."""
    return {n: (x, y, 1, 1) for n, k, x, y in STAIRS}


def stair_cells():
    return {(x, y) for n, k, x, y in STAIRS}


def block_mask(shape):
    """길이 지나면 안 되는 칸: 윗면 + 벽 줄(계단 칸은 따로 연결)."""
    m = np.zeros(shape, bool)
    for pl in PLATEAUS:
        for tier in pl['tiers']:
            for (x, y) in tier_cells(tier) | tier_walls(tier):
                m[y, x] = True
    return m


def _walls():
    out = set()
    for pl in PLATEAUS:
        for tier in pl['tiers']:
            out |= tier_walls(tier)
    return out


def apply_terrain(t):
    """고원 밑 바닥 정리(숲·산 등을 지우고 윗면 바닥 코드로). 반환 lv: 0 땅, 1/2 윗면 층, -1 벽."""
    H, W = t.shape
    lv = np.zeros((H, W), np.int8)
    for (x0, y0, x1, y1) in CLEAR_EXTRA:
        blk = t[y0:y1 + 1, x0:x1 + 1]
        blk[np.isin(blk, (FOREST, MOUNT, SFOREST, SMOUNT, MARSH))] = GRASS
    for pl in PLATEAUS:
        g = GRASS if pl['top'] == 'grass' else DIRT
        for i, tier in enumerate(pl['tiers']):
            for (x, y) in tier_cells(tier):
                if t[y, x] in (SEA, RIVER):
                    continue
                t[y, x] = g
                lv[y, x] = i + 1
            for (x, y) in tier_walls(tier) | {(x, y + 1) for (x, y) in tier_walls(tier)}:
                if y < H and t[y, x] in (FOREST, MOUNT, SFOREST, SMOUNT, MARSH):
                    t[y, x] = GRASS
    for (x, y) in _walls():
        lv[y, x] = -1
    return lv


# ── 손 도트 타일 ───────────────────────────────────────────────────────────────
GR_A = ["..m.....h...m...", "....n.m.....n...", "h.....n...h.....", ".m..h.....m..n..",
        "......m.n.......", "n..m.......h..m.", "...........n....", ".h...m..h.....m.",
        "....n.......m...", "m.......m..h....", "..n..h.......n..", "......m.n.....m.",
        ".m.h............", "....m....n..h...", "n.......h....m..", "..m..n.......n.."]
GR_B = [".n....h....m...n", "....m........h..", ".h..n.m.....n...", "......h...m....m",
        "m..n........n...", "....h..m........", ".n.......h..m..n", "..m..n..........",
        "h....m..h...n...", "....n.......m..h", ".m.....h..n.....", "n....m..........",
        "..h.....n..m.h..", ".....n..h.......", "m..h.......n..m.", "...n..m.....h..."]


def _surface(kind, var):
    """윗면 16x16. 풀: 689e4e 바탕 + 529543/44884a 점 + 8abe4c 빛. 흙: ab8760 바탕 + 9f7b53/90704d 점."""
    src = GR_A if var == 0 else GR_B
    if var == 2:
        src = [r[5:] + r[:5] for r in GR_A[7:] + GR_A[:7]]
        src = [r[::-1] for r in src]
    if kind == 'grass':
        base, mp = 'l', dict(m='m', n='n', h='h')
    else:
        base, mp = 'e', dict(m='f', n='g', h='e')
    rgb = np.zeros((16, 16, 3), np.uint8)
    for y in range(16):
        for x in range(16):
            ch = src[y][x]
            c = base if ch == '.' else mp[ch]
            if kind == 'grass' and c == 'l' and hh(x, y, 40 + var) % 100 < 24:
                c = 'h'          # 윗면은 주변 풀보다 한 톤 밝게(8abe4c 빛 점을 촘촘히)
            if kind == 'dirt' and c == 'e' and hh(x, y, 40 + var) % 100 < 22:
                c = 'd'
            rgb[y, x] = C[c]
    return rgb


def _rim_side(kind, right, wob=0):
    """좌/우 가장자리: 검은 외곽선 1줄 + 흙 비탈 2줄(4b3025/65442a, 위·아래로 굵기가 흔들림) + 안쪽 그림자 점."""
    rgb = np.zeros((16, 16, 3), np.uint8)
    m = np.zeros((16, 16), bool)
    sh = 'n' if kind == 'grass' else 'g'
    for y in range(16):
        w = 2 + (1 if hh(0, y // 2, 5) % 3 == 0 else 0)          # 비탈 폭 2~3
        off = 1 if (wob and 4 <= y <= (9 if wob == 1 else 11)) else 0   # 가운데가 안으로 한 칸 들어간 변형
        for x in range(4):
            if x < off:
                continue
            x0_ = x - off
            if x0_ == 0:
                ch = 'o'
            elif x0_ <= w:
                ch = 'q' if (x0_ == 1 or hh(x0_, y, 6) % 2) else 'b'
                if x0_ == w and hh(x0_, y, 7) % 3 == 0:
                    ch = 'c'
            else:
                ch = sh if (x0_ == w + 1 and hh(x0_, y, 8) % 2 == 0) else None
            if ch:
                rgb[y, x] = C[ch]
                m[y, x] = True
    if right:
        rgb, m = rgb[:, ::-1].copy(), m[:, ::-1].copy()
    return rgb, m


def _rim_north(kind):
    """뒤쪽 가장자리: 얇은 외곽선 + 안쪽 그림자 점(뒷면은 보이지 않는다)."""
    sh = 'n' if kind == 'grass' else 'g'
    rgb = np.zeros((16, 16, 3), np.uint8)
    m = np.zeros((16, 16), bool)
    for x in range(16):
        rgb[0, x] = C['o'] if hh(x, 0, 9) % 6 else C['p']
        m[0, x] = True
        rgb[1, x] = C['p'] if hh(x, 1, 10) % 3 else C['q']
        m[1, x] = True
        if hh(x, 2, 11) % 3 == 0:
            rgb[2, x] = C[sh]
            m[2, x] = True
    return rgb, m


def _lip(x, y, salt):
    """앞면 윗머리: 윗면 풀이 늘어진 자리 + 어두운 처마"""
    return


def _wall(phase, salt, lcap=False, rcap=False):
    """3/4 절벽 앞면 16x16 + 구멍(땅이 비치는 곳)"""
    rgb = np.zeros((16, 16, 3), np.uint8)
    hole = np.zeros((16, 16), bool)
    cols = ['c', 'b', 'a']
    for y in range(16):
        for x in range(16):
            u = (x + phase) % 8
            k = int(abs(u - 3.5))
            h_ = hh(x, y, salt)
            if y == 0:
                ch = 'l' if h_ % 5 in (0, 1) else ('n' if h_ % 5 == 2 else 'o')
            elif y == 1:
                ch = 'o' if h_ % 4 else 'p'
            elif y == 2:
                ch = 'p' if h_ % 3 else 'r'
            elif y < 13:
                idx = ((y + k) // 2) % 3
                ch = cols[idx]
                if y >= 10:
                    ch = {'c': 'b', 'b': 'a', 'a': 's'}[ch]
                elif idx == 0 and h_ % 9 == 0:
                    ch = 'd'
                if h_ % 13 == 0:
                    ch = 's'
            elif y == 13:
                ch = 's' if h_ % 3 else 'r'
            elif y == 14:
                ch = 's' if h_ % 4 else 'o'
            else:
                ch = 'o'
                if h_ % 4 == 0:
                    hole[y, x] = True
            rgb[y, x] = C[ch]
    if lcap:
        for y in range(16):
            rgb[y, 0] = C['o']
            if 1 < y < 14:
                rgb[y, 1] = C['p']
        hole[14:, 0] = True
        hole[15, 1] = True
    if rcap:
        for y in range(16):
            rgb[y, 15] = C['o']
            if 1 < y < 14:
                rgb[y, 14] = C['p']
        hole[14:, 15] = True
        hole[15, 14] = True
    return rgb, hole


def _stairs(phase, salt, lcap=False, rcap=False):
    rgb, hole = _wall(phase, salt, lcap, rcap)
    treads = [(0, 1), (3, 4), (6, 7), (9, 10), (12, 13), (15, 15)]
    for y in range(16):
        rgb[y, 2:14] = C['u']
    for y in range(16):
        for x in range(3, 13):
            tread = any(a <= y <= b for a, b in treads)
            h_ = hh(x, y, salt + 3)
            if tread:
                ch = 'e' if h_ % 5 else 'f'
                if y in (0, 3, 6, 9, 12, 15) and h_ % 3 == 0:
                    ch = 'e'
            else:
                ch = 'u' if h_ % 4 else 'g'
            rgb[y, x] = C[ch]
    for y in range(16):
        rgb[y, 2] = C['o']
        rgb[y, 13] = C['o']
        if y >= 3:
            rgb[y, 3] = C['g'] if y % 3 != 2 else C['u']
    hole[:, 2:14] = False
    return rgb, hole


def _ramp(phase, salt):
    """경사로: 위 8px 폭에서 아래 16px 폭으로 벌어지는 흙 사다리꼴, 양옆 절벽이 빗변으로 잘린다."""
    wr, _ = _wall(phase, salt)
    rgb = wr.copy()
    hole = np.zeros((16, 16), bool)
    for y in range(16):
        ext = (y * 4) // 15   # 0..4
        lo, hi = 4 - ext, 11 + ext
        for x in range(16):
            if lo <= x <= hi:
                h_ = hh(x, y, salt + 5)
                edge = x in (lo, hi)
                if edge and y > 0:
                    ch = 'o'
                elif x in (lo + 1, hi - 1) and y > 0:
                    ch = 'u' if y % 2 else 'g'
                else:
                    ch = 'e' if h_ % 4 else 'f'
                    if y > 11 and h_ % 3 == 0:
                        ch = 'f'
                rgb[y, x] = C[ch]
    return rgb, hole


_CACHE = {}


def tiles():
    if _CACHE:
        return _CACHE
    T = _CACHE
    for kind in ('grass', 'dirt'):
        T['surf_' + kind] = [_surface(kind, v) for v in range(3)]
        T['rimN_' + kind] = _rim_north(kind)
        T['rimW_' + kind] = [_rim_side(kind, False, v) for v in range(3)]
        T['rimE_' + kind] = [_rim_side(kind, True, v) for v in range(3)]
    T['wall'] = [_wall(p, s) for p, s in ((0, 71), (3, 72), (5, 73))]
    T['wallL'] = [_wall(p, s, lcap=True) for p, s in ((0, 71), (3, 72), (5, 73))]
    T['wallR'] = [_wall(p, s, rcap=True) for p, s in ((0, 71), (3, 72), (5, 73))]
    T['wallLR'] = [_wall(p, s, lcap=True, rcap=True) for p, s in ((0, 71), (3, 72), (5, 73))]
    T['cvxL'], T['cvxR'] = _corner('convex', False), _corner('convex', True)
    T['ccvL'], T['ccvR'] = _corner('concave', False), _corner('concave', True)
    T['stair'] = _stairs(0, 71)
    T['ramp'] = _ramp(0, 71)
    return T


def tile_catalog():
    """타일 시트용: [(이름, 출처, 그룹, rgb16, alpha16), ...]. alpha 는 구멍을 뺀 불투명 영역(윗면·앞면은 전부 불투명)."""
    T = tiles()
    out = []
    for kind in ('grass', 'dirt'):
        for v, (rgb) in enumerate(T['surf_' + kind]):
            out.append((f'highland_top_{kind}_{v}', 'hand-pixel', 'highland', rgb, np.ones((16, 16), bool)))
        rgb, m = T[f'rimN_{kind}']
        out.append((f'highland_rimN_{kind}', 'hand-pixel', 'highland', rgb, m))
        for nm in ('W', 'E'):
            for v in range(3):
                rgb, m = T[f'rim{nm}_{kind}'][v]
                out.append((f'highland_rim{nm}_{kind}_{v}', 'hand-pixel', 'highland', rgb, m))
    for key, nm in (('wall', 'front'), ('wallL', 'front_left'), ('wallR', 'front_right'), ('wallLR', 'front_both')):
        for v, (rgb, hole) in enumerate(T[key]):
            out.append((f'highland_{nm}_{v}', 'hand-pixel', 'highland', rgb, ~hole))
    for nm, key in (('corner_round_left', 'cvxL'), ('corner_round_right', 'cvxR'),
                    ('corner_notch_left', 'ccvL'), ('corner_notch_right', 'ccvR')):
        rgb, paint, clear = T[key]
        out.append((f'highland_{nm}', 'hand-pixel', 'highland', rgb, paint))
    rgb, hole = T['stair']
    out.append(('highland_stair', 'hand-pixel', 'highland', rgb, ~hole))
    rgb, hole = T['ramp']
    out.append(('highland_ramp', 'hand-pixel', 'highland', rgb, ~hole))
    return out


# ── 모서리 (윗면 둥근 모서리 / 오목 모서리) ───────────────────────────────────
def _corner(kind_c, right):
    """반환 (rgb16, paint_mask, clear_mask). kind_c 'convex'|'concave'. right=True 면 좌우 반전."""
    rgb = np.zeros((16, 16, 3), np.uint8)
    paint = np.zeros((16, 16), bool)
    clear = np.zeros((16, 16), bool)
    if kind_c == 'convex':
        for (x, y) in ((0, 0), (1, 0), (0, 1)):
            clear[y, x] = True
        for (x, y) in ((2, 0), (1, 1), (0, 2)):
            rgb[y, x] = C['o']
            paint[y, x] = True
        for (x, y) in ((3, 1), (2, 1), (1, 2), (1, 3)):
            rgb[y, x] = C['p']
            paint[y, x] = True
    else:
        for (x, y) in ((0, 0), (1, 0), (0, 1), (1, 1)):
            rgb[y, x] = C['o'] if (x + y) < 2 else C['p']
            paint[y, x] = True
        for (x, y) in ((2, 1), (1, 2)):
            rgb[y, x] = C['n']
            paint[y, x] = True
    if right:
        rgb, paint, clear = rgb[:, ::-1].copy(), paint[:, ::-1].copy(), clear[:, ::-1].copy()
    return rgb, paint, clear


# ── 그리기 ────────────────────────────────────────────────────────────────────
def _put(img, prev, x, y, rgb, hole=None):
    reg = rgb.copy()
    if hole is not None and hole.any():
        pv = prev[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16]
        reg[hole] = pv[hole]
    img[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16] = reg


def _rim_over(img, x, y, rim):
    rgb, m = rim
    reg = img[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16]
    reg[m] = rgb[m]


def _corner_over(img, prev, x, y, cn):
    rgb, paint, clear = cn
    reg = img[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16]
    pv = prev[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16]
    reg[clear] = pv[clear]
    reg[paint] = rgb[paint]


def _shadow(img, x, y, strength=0.74):
    """벽 밑 그림자: 위 2줄은 온전히, 그 밑은 디더로 점점 옅게(총 7줄)."""
    reg = img[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16].astype(float)
    for j in range(7):
        for i in range(16):
            if j >= 2:
                thr = (j - 1) / 6.0
                if BAYER[j % 4, i % 4] / 16.0 >= 1 - thr:
                    continue
            reg[j, i] = reg[j, i] * strength
    img[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16] = np.clip(reg, 0, 255).round().astype(np.uint8)


def render_top(img):
    T = tiles()
    stairs = {(x, y): k for n, k, x, y in STAIRS}
    for pl in PLATEAUS:
        kind = pl['top']
        for tier in pl['tiers']:
            prev = img.copy()
            cells = tier_cells(tier)
            walls = tier_walls(tier)
            for (x, y) in sorted(cells, key=lambda c: (c[1], c[0])):
                _put(img, prev, x, y, T['surf_' + kind][hh(x, y, 61) % 3])
                n, w, e = (x, y - 1) in cells, (x - 1, y) in cells, (x + 1, y) in cells
                if not n:
                    _rim_over(img, x, y, T['rimN_' + kind])
                wv = (0, 0, 1, 2)[hh(x, y, 63) % 4]
                if not w:
                    _rim_over(img, x, y, T['rimW_' + kind][wv if n and (x, y + 1) in cells else 0])
                if not e:
                    _rim_over(img, x, y, T['rimE_' + kind][wv if n and (x, y + 1) in cells else 0])
                if not n and not w:
                    _corner_over(img, prev, x, y, T['cvxL'])
                if not n and not e:
                    _corner_over(img, prev, x, y, T['cvxR'])
                if n and w and (x - 1, y - 1) not in cells:
                    _corner_over(img, prev, x, y, T['ccvL'])
                if n and e and (x + 1, y - 1) not in cells:
                    _corner_over(img, prev, x, y, T['ccvR'])
            for (x, wy) in sorted(walls, key=lambda c: (c[1], c[0])):
                var = hh(x, wy, 62) % 3
                l, r = (x - 1, wy) not in walls, (x + 1, wy) not in walls
                key = 'wallLR' if (l and r) else 'wallL' if l else 'wallR' if r else 'wall'
                rgb, hole = T[key][var]
                if (x, wy) in stairs:
                    rgb, hole = T['stair'] if stairs[(x, wy)] == 'stair' else T['ramp']
                _put(img, prev, x, wy, rgb, hole)
    return img


def render_shadow(img, t):
    """길·다리 뒤, 장소 아이콘 앞에 부른다. 벽 바로 밑 한 줄(+오른쪽 한 칸 옅게)."""
    H, W = t.shape
    done = set()
    for pl in PLATEAUS:
        for tier in pl['tiers']:
            allc = tier_cells(tier)
            for (x, wy) in tier_walls(tier):
                sy = wy + 1
                if sy >= H or (x, sy) in allc:
                    continue
                for xx, f in ((x, 0.74), (x + 1, 0.86)):
                    if xx < W and (xx, sy) not in done and (xx, sy) not in allc and (xx, sy - 1) not in allc \
                            and t[sy, xx] not in (SEA, RIVER):
                        if f == 0.86 and (x + 1, wy) in tier_walls(tier):
                            continue
                        _shadow(img, xx, sy, f)
                        done.add((xx, sy))
    return img


def export():
    """map.json 용 고원 설계 요약."""
    out = []
    for pl in PLATEAUS:
        out.append(dict(name=pl['name'], top=pl['top'], tiers=[
            {str(y): list(sp) for y, sp in tier.items()} for tier in pl['tiers']]))
    return dict(plateaus=out, passages=[dict(name=n, kind=k, x=x, y=y) for n, k, x, y in STAIRS],
                topPath=[list(c) for c in TOP_PATH])
