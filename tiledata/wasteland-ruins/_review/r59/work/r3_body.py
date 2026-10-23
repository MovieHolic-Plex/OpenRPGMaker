BODY = [S['body'][i] for i in range(7)]                                   # 콘크리트 몸(어두움 → 밝음)
J_CORE, J_DARK, J_DEEP = S['roof'][2], S['roof'][1], S['roof'][0]          # 줄눈(바탕 roof[2], 때 낀 토막·만남 roof[1], 벌어진 틈 roof[0])
J_DIRT, J_DIRT2 = S['bark'][2], S['bark'][1]                              # 흙 낀 줄눈
CR_CORE, CR_DEEP = S['body'][0], S['slate'][2]                            # 금(줄눈과 다른 차가운 회색)
OIL_IN, OIL_CORE = S['slate'][4], S['slate'][3]                           # 기름 얼룩: 조금 어두운 푸른 회색 두 단(반짝이 없음)
_SEG_TONE = {0: (0, 0), 1: (1, 0), 2: (-1, 0), 3: (0, 0)}                 # 포트 구간 k → (단 차이, 0) — 구간 0 = 모서리(감김)


def _seg_of(v):
    k = sum(1 for p in SLAB_PORTS if v >= p)
    return 0 if k == len(SLAB_PORTS) else k


def _slab_check(L):
    G = SLAB_LAYOUTS[L]
    assert len(G) == 32 and all(len(r) == 32 for r in G), L
    for a, b in ((0, 1), (1, 2), (29, 30), (30, 31)):
        assert G[a] == G[b] and [r[a] for r in G] == [r[b] for r in G], (L, a, b)
    for r in (0, 31):
        assert tuple(x for x in range(1, 32) if G[r][x] != G[r][x - 1]) == SLAB_PORTS, (L, r)
        assert tuple(y for y in range(1, 32) if G[y][r] != G[y - 1][r]) == SLAB_PORTS, (L, r)
    for ch in {c for row in G for c in row}:
        cells = [(i, j) for j in range(32) for i in range(32) if G[j][i] == ch]
        xs, ys = [c[0] for c in cells], [c[1] for c in cells]
        assert (max(xs) - min(xs) + 1) * (max(ys) - min(ys) + 1) == len(cells), (L, ch, 'not a rectangle')
    for row in G:                                                          # 줄눈은 칸 경계(16화소 배수)에만
        assert all(row[x] == row[x - 1] for x in range(1, 32) if x % 4), (L, 'joint off the cell grid')


_SLAB_INFO = {}


def _slab_info(L):
    """배치 L: reg(판 글자) · jt(줄눈 화소 → 색) · jdir(줄눈 화소 → 'v'/'h') · tone(판 → (램프, 바탕 단)) · seed."""
    if L in _SLAB_INFO: return _SLAB_INFO[L]
    _slab_check(L)
    G = SLAB_LAYOUTS[L]
    reg = [[G[y // 4][x // 4] for x in range(SP)] for y in range(SP)]
    segs = []
    for x in range(4, SP, 4):
        y = 0
        while y < SP:
            if reg[y][x - 1] != reg[y][x]:
                y0 = y
                while y < SP and reg[y][x - 1] != reg[y][x]: y += 1
                segs.append(('v', x, y0, y))
            else: y += 1
    for y in range(4, SP, 4):
        x = 0
        while x < SP:
            if reg[y - 1][x] != reg[y][x]:
                x0 = x
                while x < SP and reg[y - 1][x] != reg[y][x]: x += 1
                segs.append(('h', y, x0, x))
            else: x += 1
    B = SLAB_BAND
    inband = lambda x, y: x < B or y < B or x >= SP - B or y >= SP - B
    seed = {'a': 601, 'd': 613, 'e': 629}[L]
    jt, jdir = {}, {}
    for k, (o, c0, a, b) in enumerate(segs):
        for t in range(a, b):
            x, y = (c0, t) if o == 'v' else (t, c0)
            band = inband(x, y)
            sd = 977 if band else seed
            r = h2(c0 * 5 + t // 6, o == 'v', sd + 3)
            wide = not band and r % 7 == 0                                 # 6화소 토막째 벌어진 줄눈(2화소)
            dirt = not band and (r >> 4) % 6 == 0                          # 6화소 토막째 흙 낀 줄눈
            grime = h2(t // 3, c0, sd + (0 if o == 'v' else 1)) % 4 == 0
            if (x, y) not in jt or dirt:
                jt[(x, y)] = J_DIRT if dirt else (J_DARK if grime or wide else J_CORE)
            jdir.setdefault((x, y), o)
            if wide:
                wx, wy = (x - 1, y) if o == 'v' else (x, y - 1)
                if (wx, wy) not in jt: jt[(wx, wy)] = J_DIRT2 if dirt else J_CORE; jdir[(wx, wy)] = o
    for (x, y) in list(jt):
        if jt[(x, y)] == J_CORE and sum(((x + a) % SP, (y + b) % SP) in jt for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1))) >= 3: jt[(x, y)] = J_DARK
    tone = {}
    for ch in sorted({c for row in G for c in row}):
        cells = [(i, j) for j in range(32) for i in range(32) if G[j][i] == ch]
        key = None
        for (i, j) in cells:
            if j <= 2 or j >= 29: key = _seg_of(i); break
            if i <= 2 or i >= 29: key = _seg_of(j); break
        if key is not None: sh = _SEG_TONE[key][0]
        else:
            r = h2(ord(ch) * 3 + len(cells), cells[0][0] * 32 + cells[0][1], seed + 11) % 20
            sh = -1 if r < 5 else 0 if r < 14 else 1
        tone[ch] = (BODY, 3 + sh)
    box = {}
    for j in range(32):
        for i in range(32):
            ch = G[j][i]; b0 = box.get(ch, (i, j, i, j)); box[ch] = (min(b0[0], i), min(b0[1], j), max(b0[2], i), max(b0[3], j))
    info = dict(reg=reg, jt=jt, jdir=jdir, tone=tone, seed=seed, segs=segs, box=box)
    _SLAB_INFO[L] = info
    return info


def _grain(x, y, seed):
    """콘크리트 결: 넓은 부드러운 닳음·젖음 자리(±1단, 6~16화소) + 거친 자리의 2×2 덩이(±1단) + 드문 낱 골재 알(16×16 에 한둘). 낱화소 점무늬는 없다."""
    f = wrapnoise(x, y, seed + 7, 32, SP) * 0.55 + wrapnoise(x, y, seed + 9, 16, SP) * 0.45
    off = -1 if f < 0.33 else 1 if f > 0.70 else 0
    gx, gy = (x + (y // 2) % 2) // 2, y // 2
    if wrapnoise(x, y, seed + 30, 16, SP) > 0.55:                          # 거친 자리: 2×2 덩이
        r = h2(gx % (SP // 2), gy % (SP // 2), seed) % 10
        off += -1 if r < 2 else 1 if r < 3 and off <= 0 else 0
    q = h2(x, y, seed + 51) % 160
    if q == 0: off -= 1                                                    # 골재 알(어두운)
    elif q == 1: off += 1
    return off


def _slab_px(I, x, y):
    """바탕 판 화소 색(표시 없음): 판 단 + 결 + 가로 줄눈 바로 밑 한 줄 빛(판 윗끝)."""
    jt = I['jt']
    if (x, y) in jt: return jt[(x, y)]
    ramp, t = I['tone'][I['reg'][y][x]]
    B = SLAB_BAND
    inb = x < B or y < B or x >= SP - B or y >= SP - B
    t += _grain(x, y, 977 if inb else I['seed'])
    if I['jdir'].get((x, (y - 1) % SP)) == 'h': t += 1                    # 판 윗끝 빛(실선)
    return ramp[max(0, min(len(ramp) - 1, t))]


def _ramp_t(I, x, y):
    return I['tone'][I['reg'][y][x]]


# ---- 칸 안 표시(모두 한 칸 안 — 칸마다 a/b/c 를 바꿔 끼워도 잘리지 않는다. 덩이 경계 띠 8화소도 건드리지 않는다)
def _body(I, x, y): return (x, y) not in I['jt']


def _in_cell(cx, cy, x, y, m=1):
    return cx * 16 + m <= x <= cx * 16 + 15 - m and cy * 16 + m <= y <= cy * 16 + 15 - m and SLAB_BAND <= x < SP - SLAB_BAND and SLAB_BAND <= y < SP - SLAB_BAND


def _spots(cx, cy, seed, m=3):
    pts = [(cx * 16 + m + i, cy * 16 + m + j) for j in range(16 - 2 * m) for i in range(16 - 2 * m)]
    return sorted(pts, key=lambda p: h2(p[0], p[1], seed))


def _ell(cxm, cym, rx, ry, seed, jit=0.07):
    out = []
    for y in range(int(cym - ry - 1), int(cym + ry + 2)):
        for x in range(int(cxm - rx - 1), int(cxm + rx + 2)):
            d = ((x - cxm) / rx) ** 2 + ((y - cym) / ry) ** 2 + (h2(x, y, seed) % 4) * jit
            if d < 1: out.append((x, y))
    return set(out)


def _fits(I, cx, cy, pts, pad=1):
    for (x, y) in pts:
        if not _in_cell(cx, cy, x, y, 1): return False
        for dx in range(-pad, pad + 1):
            for dy in range(-pad, pad + 1):
                if not _body(I, x + dx, y + dy): return False
    return True


def _cur(c, I, x, y):
    """지금 칠한 색의 램프 단(바탕 기준)."""
    ramp, t = _ramp_t(I, x, y)
    return ramp, t


def _put_t(c, I, x, y, d):
    ramp, t = _ramp_t(I, x, y)
    c.P(x, y, ramp[max(0, min(6, t + d))])


def m_pothole(c, I, cx, cy, s):
    """팬 구멍(가로 6~9화소, 들쭉날쭉): 안쪽 윗벽이 가장 어둡고(3/4 시점), 바닥은 짙은 회색·자갈 알, 테두리엔 드러난 골재 1~2화소."""
    for (x0, y0) in _spots(cx, cy, s, 5):
        rx, ry = 3.4 + (s % 3) * 0.5, 2.3 + (s >> 2) % 2 * 0.5
        hole = _ell(x0, y0, rx, ry, s, 0.16)
        bite = _ell(x0 + (2 if s % 2 else -2), y0 - ry, 1.6, 1.2, s + 7, 0.1)     # 윗 가장자리 한쪽이 더 깨져 들어갔다
        hole = (hole | {p for p in bite if p[1] >= y0 - ry - 1}) - {(x0 + (3 if s % 2 else -3), round(y0 + ry))}
        ring = {(x + dx, y + dy) for (x, y) in hole for dx in (-1, 0, 1) for dy in (-1, 0, 1)} - hole
        if not _fits(I, cx, cy, hole | ring, 0): continue
        for (x, y) in hole:
            if (x, y - 1) not in hole: c.P(x, y, J_DEEP)                  # 안쪽 윗벽
            elif (x, y - 2) not in hole: c.P(x, y, BODY[0] if h2(x, y, s) % 3 else J_DARK)
            elif (x, y + 1) not in hole: c.P(x, y, BODY[1])               # 바닥 앞쪽
            else: c.P(x, y, BODY[1] if h2(x // 2, y, s) % 4 else (BODY[2] if h2(x, y, s + 1) % 2 else J_DIRT))
        for k, (x, y) in enumerate(sorted(ring, key=lambda p: h2(p[0], p[1], s + 3))):
            if (x, y - 1) in hole and k < 3: _put_t(c, I, x, y, 2)            # 드러난 골재(밝은 깨진 알)
            elif (x, y + 1) in hole and (x, y) not in hole and h2(x, y, s + 5) % 2: _put_t(c, I, x, y, -1)
        return True
    return False


def m_flake(c, I, cx, cy, s):
    """겉면이 얕게 벗겨진 자리(7~10×3~5): 한 단 밝은 속, 윗 가장자리만 끊긴 1화소 어두운 선."""
    for (x0, y0) in _spots(cx, cy, s + 1, 4):
        A = _ell(x0, y0, 3.2 + s % 2, 1.8, s, 0.12) | _ell(x0 + 2 - 4 * (s % 2), y0 + 1, 2.2, 1.5, s + 5, 0.12)
        if not _fits(I, cx, cy, A, 1): continue
        for (x, y) in A:
            top = (x, y - 1) not in A
            if top: _put_t(c, I, x, y, -2 if h2(x, y, s) % 4 else 0)
            else: _put_t(c, I, x, y, 1 if h2(x // 2, y // 2, s + 2) % 5 else 0)
        return True
    return False


def m_oil(c, I, cx, cy, s):
    """기름 얼룩(7~10×4~6): 조금 어두운 푸른 회색 판판한 덩이, 속 한 단 더, 가장자리는 바탕과 엇갈려 번진다."""
    for (x0, y0) in _spots(cx, cy, s + 2, 4):
        A = _ell(x0, y0, 3.4 + s % 2, 2.2, s, 0.12) | _ell(x0 + 2, y0 + 1, 2.4, 1.7, s + 1, 0.12) | _ell(x0 - 2, y0 - 1, 1.8, 1.3, s + 4, 0.1)
        core = _ell(x0 + 0.5, y0 + 0.3, 1.8, 1.1, s + 3, 0.1)
        if not _fits(I, cx, cy, A, 0): continue
        for (x, y) in A:
            edge = sum((x + a, y + b) not in A for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            if edge and (x + y) % 2: _put_t(c, I, x, y, -1); continue
            c.P(x, y, OIL_CORE if (x, y) in core else OIL_IN)
        return True
    return False


def m_weed(c, I, cx, cy, s):
    """세로 줄눈(칸 왼끝)에서 자란 작은 풀 포기(키 3~4) — 칸 안에서만."""
    x = cx * 16 + 2
    ys = [y for y in range(cy * 16 + 6, cy * 16 + 14) if (cx * 16, y) in I['jt'] and _in_cell(cx, cy, x, y, 1)]
    ys.sort(key=lambda v: h2(v, cx, s))
    for y in ys:
        fan(c, x, y, 3 + s % 2, 'grass', s, 4, 1)
        return True
    return False


def m_crack(c, I, cx, cy, s, long=False):
    """금: 칸을 비스듬히 가로지르는 들쭉날쭉 1화소 선(12~16화소, 차가운 회색 — 줄눈 색 아님) + 한쪽 1화소 빛, 긴 금엔 가지."""
    for k in range(60):
        r = h2(k, s, 81)
        sx = 1 if r % 2 else -1
        x, y = (cx * 16 + 2 + (r >> 2) % 3) if sx > 0 else (cx * 16 + 13 - (r >> 2) % 3), cy * 16 + 2 + (r >> 4) % 4
        n = (15 if long else 12) + (r >> 7) % 3
        pts = [(x, y)]
        for i in range(n):
            q = h2(i, k, s + 9) % 10
            if q < 4: x += sx
            elif q < 7: y += 1
            else: x += sx; y += 1
            if q == 9 and i > 2: x -= sx                               # 꺾임
            pts.append((x, y))
        if not all(_in_cell(cx, cy, px, py, 1) and _body(I, px, py) for (px, py) in pts): continue
        if long:
            bx, by = pts[len(pts) // 2]
            br = [(bx - sx * j, by + j + (j // 2)) for j in range(1, 5)]
            pts += [p for p in br if _in_cell(cx, cy, p[0], p[1], 1) and _body(I, p[0], p[1])]
        ps = set(pts)
        for i, (px, py) in enumerate(pts):
            c.P(px, py, CR_DEEP if long and 4 <= i <= 8 else CR_CORE)
        for (px, py) in pts:
            if (px, py + 1) not in ps and _body(I, px, py + 1) and _in_cell(cx, cy, px, py + 1, 1) and h2(px, py, s) % 4: _put_t(c, I, px, py + 1, 1)
        return True
    return False


def m_corner(c, I, cx, cy, s):
    """판 귀퉁이 떨어짐: 칸 왼위 줄눈 만남 자리 오른아래 판 귀가 2~3화소 깨져 판 그늘색으로 꺼졌다."""
    jx, jy = cx * 16, cy * 16
    if not ((jx, jy) in I['jt'] and (jx + 1, jy) in I['jt'] and (jx, jy + 1) in I['jt']): return False
    n = 3 + s % 2
    chip = [(jx + 1 + i, jy + 1 + j) for i in range(n) for j in range(n) if i + j < n - (1 if (i, j) == (n - 2, 0) else 0)]
    if not all(_body(I, x, y) and _in_cell(cx, cy, x, y, 1) for (x, y) in chip): return False
    for (x, y) in chip:
        _put_t(c, I, x, y, -3 if (x - jx) + (y - jy) <= 2 else -2)
    return True


def m_heave(c, I, cx, cy, s):
    """들뜬 판: 칸 윗줄 가로 줄눈 9~11화소에서 아래 판 윗끝이 들려 틈은 깊게, 들린 앞끝은 밝게."""
    y = cy * 16
    xs = [x for x in range(cx * 16 + 2, cx * 16 + 14) if I['jdir'].get((x, y)) == 'h' and _body(I, x, y + 1) and _body(I, x, y + 2)]
    if len(xs) < 9 or y < SLAB_BAND: return False
    a = xs[0] + (s % 2); b = min(xs[-1], a + 10)
    for x in range(a, b + 1):
        end = x - a < 2 or b - x < 2
        c.P(x, y, J_DARK if end else J_DEEP)
        _put_t(c, I, x, y + 1, 2 if end else 3)
        if not end: _put_t(c, I, x, y + 2, 1)
    return True


def m_stain(c, I, cx, cy, s):
    """넓게 젖은 얼룩(9~12×6~8): 한 단 어둡고 가장자리는 엇갈려 번진다."""
    for (x0, y0) in _spots(cx, cy, s + 6, 6):
        A = _ell(x0, y0, 4.6, 2.8, s, 0.12) | _ell(x0 + 2, y0 + 2, 3.0, 2.0, s + 1, 0.12)
        if not all(_in_cell(cx, cy, x, y, 1) for (x, y) in A): continue
        for (x, y) in A:
            if not _body(I, x, y): continue
            edge = sum((x + a, y + b) not in A for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            if edge and (x + y) % 2: continue
            _put_t(c, I, x, y, -1)
        return True
    return False


_MARKS = dict(pothole=m_pothole, flake=m_flake, oil=m_oil, weed=m_weed, crack=m_crack, corner=m_corner, heave=m_heave, stain=m_stain,
              lcrack=lambda c, I, cx, cy, s: m_crack(c, I, cx, cy, s, long=True))
# 칸 (cx, cy) → 표시. b·c 는 서로 다른 칸, 줄눈 박자와 안 맞게 흩었다. 큰 표시(긴 금·들뜬 판·젖은 얼룩)는 slab-a 에만, slab-a 는 표시가 적다.
SLAB_MARKS = {
    'a': [(2, 2, 'lcrack'), (5, 5, 'lcrack'), (1, 5, 'crack'), (2, 3, 'heave'), (3, 5, 'corner'), (5, 1, 'corner'), (6, 3, 'stain')],
    'b': [(1, 2, 'pothole'), (5, 4, 'pothole'), (3, 6, 'pothole'), (3, 1, 'weed'), (5, 6, 'weed'),
          (6, 2, 'flake'), (2, 4, 'flake'), (4, 5, 'flake'), (4, 2, 'crack'), (6, 5, 'crack')],
    'c': [(2, 3, 'oil'), (5, 2, 'oil'), (4, 6, 'oil'), (1, 4, 'weed'), (3, 5, 'weed'),
          (6, 6, 'flake'), (1, 1, 'flake'), (6, 3, 'pothole'), (3, 2, 'crack'), (5, 5, 'crack')],
    'd': [(2, 5, 'crack'), (5, 2, 'crack'), (4, 4, 'pothole'), (1, 3, 'oil'), (3, 6, 'weed'), (6, 5, 'flake'), (2, 2, 'stain')],
    'e': [(4, 3, 'crack'), (1, 6, 'crack'), (5, 5, 'oil'), (2, 2, 'pothole'), (5, 1, 'weed'), (3, 4, 'flake'), (6, 2, 'stain')],
}
SLAB_MISSED = []
