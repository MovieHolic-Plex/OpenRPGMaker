# ------------------------------------------------------------------ 콘크리트 판 (r59)
# 깨진 옛 도시 콘크리트(보도·광장·도로판). 판 한 장 = 8×8칸(128화소), 짜임표 한 글자 = 4화소(행 문자열 SLAB_LAYOUTS, 글자 하나 = 판 하나).
# 이음 배치 셋: A(slab-a/b/c 가 같이 쓴다) · D(slab-d) · E(slab-e). 맵(slabAt)은 8×8칸 덩이마다 배치 하나를 해시로 고르고(각 1/3),
# A 덩이 안 칸은 같은 (x mod 8, y mod 8) 자리의 slab-a/b/c 를 2:4:4 로 섞는다.
# 덩이 경계 띠(가장자리 8화소)는 세 배치가 화소까지 같다: 경계를 건너는 이음(포트)은 위·아래 x = 4·SLAB_PORTS, 왼·오른 y = 4·SLAB_PORTS 뿐이고
# 경계를 따라 눕는 이음은 없다(경계를 건너는 판은 이웃 덩이의 판 반쪽과 한 장으로 이어진다 — 128화소 격자 줄이 생기지 않는다).
# 짜임표 규칙(검사 _slab_check): 0~2행·29~31행·0~2열·29~31열은 포트 자리에서만 글자가 바뀐다. 판은 네모, 안쪽 판은 16화소 이상.
# 띠 안 얼룩은 공용 씨앗, 띠에 닿는 판의 단 차이는 포트 구간마다 고정(_SEG_TONE) — 덩이가 바뀌어도 경계 양쪽 판 반쪽이 같은 값.
# 그림: 몸 = body 회색 램프(흙물 든 판은 roof 갈회), 판마다 ±1~2단, 4화소 덩이의 부드러운 얼룩(±1단)·넓게 젖은 자리, 위·왼 모서리 빛, 아래 모서리 그늘.
# 이음 = roof[1] 따뜻한 짙은 회색(곳곳 2화소·흙 낀 토막). 금 = body[0]/slate[2] 차가운 회색 — 이음 색과 다르다. 낱화소 흰 점·갈색 점 결은 없다.
# 표시(구멍·기름·잡초·벗겨짐·금·깨진 모서리·들뜬 판)는 모두 한 칸 안(칸 가장자리 1화소 안쪽)에만 — 칸마다 a/b/c 를 바꿔 끼워도 잘리지 않는다.
SP = 128
SLAB_PORTS = (4, 12, 20, 28)
SLAB_BAND = 8
SLAB_LAYOUTS = {}
@@LAYOUTS@@

BODY = [S['body'][i] for i in range(7)]                                   # 차가운 콘크리트 몸(어두움 → 밝음)
WARM = [S['roof'][2], S['roof'][3], S['roof'][4], S['body'][3], S['body'][4], S['body'][5], S['body'][6]]   # 흙물 든 판
J_CORE, J_DEEP = S['roof'][1], S['roof'][0]                               # 이음
J_DIRT, J_DIRT2 = S['bark'][2], S['bark'][1]                              # 흙 낀 이음
CR_CORE, CR_DEEP = S['body'][0], S['slate'][2]                            # 금(이음과 다른 차가운 회색)
OIL = [S['slate'][1], S['slate'][2], S['body'][0], S['body'][1]]          # 기름 얼룩 짙음 → 옅음
_SEG_TONE = {0: (0, 0), 1: (1, 0), 2: (-1, 1), 3: (0, 0)}                 # 포트 구간 k → (단 차이, 흙물) — 구간 0 = 모서리(감김)


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


_SLAB_INFO = {}


def _slab_info(L):
    """배치 L: reg(판 글자) · jt(이음 화소 → 색) · jdir(이음 화소 → 'v'/'h') · tone(판 → (램프, 바탕 단)) · seed."""
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
        pts = [(c0, t) for t in range(a, b)] if o == 'v' else [(t, c0) for t in range(a, b)]
        band = any(inband(x, y) for (x, y) in pts)
        r = h2(c0 * 5 + a, b, seed + 3)
        wide = not band and (b - a) >= 12 and r % 3 == 0                 # 한 토막 통째 2화소(벌어진 이음)
        dirt = None
        if not band and (b - a) >= 12 and (r >> 3) % 3 == 0:              # 흙 낀 토막(6~12화소)
            ln = 6 + (r >> 5) % 7; st = a + 2 + (r >> 8) % max(1, (b - a) - ln - 3); dirt = (st, st + ln)
        for i, (x, y) in enumerate(pts):
            t = a + i
            ind = dirt and dirt[0] <= t < dirt[1]
            if (x, y) not in jt or ind: jt[(x, y)] = (J_DIRT if (t + (r >> 2)) % 4 else J_DIRT2) if ind else J_CORE
            jdir.setdefault((x, y), o)
            if wide:
                wx, wy = (x - 1, y) if o == 'v' else (x, y - 1)
                if (wx, wy) not in jt: jt[(wx, wy)] = J_DIRT2 if ind else J_DEEP; jdir[(wx, wy)] = o
    tone = {}
    for ch in sorted({c for row in G for c in row}):
        cells = [(i, j) for j in range(32) for i in range(32) if G[j][i] == ch]
        key = None
        for (i, j) in cells:
            if j <= 2 or j >= 29: key = _seg_of(i); break
            if i <= 2 or i >= 29: key = _seg_of(j); break
        if key is not None:
            sh, warm = _SEG_TONE[key]
        else:
            r = h2(ord(ch) * 3 + len(cells), cells[0][0] * 32 + cells[0][1], seed + 11) % 20
            sh = -1 if r < 5 else 0 if r < 12 else 1 if r < 18 else 2
            warm = 1 if h2(ord(ch), cells[0][1], seed + 13) % 5 == 0 else 0
        tone[ch] = (WARM if warm else BODY, (2 if warm else 3) + sh)
    info = dict(reg=reg, jt=jt, jdir=jdir, tone=tone, seed=seed, segs=segs)
    _SLAB_INFO[L] = info
    return info


def _mottle(x, y, seed):
    """4화소 덩이 얼룩(-1/0/+1) + 넓게 젖은 자리(-1) — 덩이 분할은 공용, 값은 seed(띠 안은 공용 씨앗 977)."""
    k = blobs(SP, 655, 4)[(x, y)][0]
    r = h2(k[0], k[1], seed) % 20
    off = -1 if r < 4 else 1 if r >= 16 else 0
    if wrapnoise(k[0] * 4 + 2, k[1] * 4 + 2, seed + 7, 32, SP) < 0.22: off -= 1
    return off


def _slab_px(I, x, y):
    """바탕 판 화소 색(표시 없음)."""
    jt = I['jt']
    if (x, y) in jt: return jt[(x, y)]
    ramp, t = I['tone'][I['reg'][y][x]]
    B = SLAB_BAND
    inb = x < B or y < B or x >= SP - B or y >= SP - B
    t += _mottle(x, y, 977 if inb else I['seed'])
    if (x, (y - 1) % SP) in jt: t += 1                                    # 위 모서리 빛
    if ((x - 1) % SP, y) in jt and (x * 3 + y) % 7: t += 1                # 왼 모서리 빛(드문드문 닳음)
    if (x, (y + 1) % SP) in jt: t -= 1                                    # 아래 모서리 그늘
    return ramp[max(0, min(len(ramp) - 1, t))]


def _ramp_t(I, x, y):
    ramp, t = I['tone'][I['reg'][y][x]]
    return ramp, t


# ---- 칸 안 표시(모두 칸 가장자리 1화소 안쪽)
def _body(I, x, y): return (x, y) not in I['jt']


def _in_cell(cx, cy, x, y, m=1): return cx * 16 + m <= x <= cx * 16 + 15 - m and cy * 16 + m <= y <= cy * 16 + 15 - m


def _spots(cx, cy, seed, m=3):
    pts = [(cx * 16 + m + i, cy * 16 + m + j) for j in range(16 - 2 * m) for i in range(16 - 2 * m)]
    return sorted(pts, key=lambda p: h2(p[0], p[1], seed))


def _ell(cxm, cym, rx, ry, seed):
    out = []
    for y in range(int(cym - ry - 1), int(cym + ry + 2)):
        for x in range(int(cxm - rx - 1), int(cxm + rx + 2)):
            d = ((x - cxm) / rx) ** 2 + ((y - cym) / ry) ** 2 + (h2(x, y, seed) % 4) * 0.07
            if d < 1: out.append((x, y))
    return set(out)


def _fits(I, cx, cy, pts, pad=1):
    for (x, y) in pts:
        if not _in_cell(cx, cy, x, y, 1): return False
        for dx in range(-pad, pad + 1):
            for dy in range(-pad, pad + 1):
                if not _body(I, x + dx, y + dy): return False
    return True


def m_pothole(c, I, cx, cy, s):
    """움푹 팬 구멍(가로 6~8화소): 안쪽 위는 그늘진 벽, 바닥은 흙·자갈 하나, 아래 가장자리는 빛 받는 깨진 턱."""
    for (x0, y0) in _spots(cx, cy, s, 4):
        rx, ry = 3.2 + (s % 2) * 0.6, 2.2 + (s >> 1) % 2 * 0.5
        hole = _ell(x0, y0, rx, ry, s)
        ring = {(x + dx, y + dy) for (x, y) in hole for dx in (-1, 0, 1) for dy in (-1, 0, 1, 2)} - hole
        if not _fits(I, cx, cy, hole | ring, 0): continue
        top = min(y for (_, y) in hole)
        for (x, y) in hole:
            up = (x, y - 1) not in hole; up2 = (x, y - 2) not in hole
            c.P(x, y, J_DEEP if up else S['bark'][1] if up2 else (S['bark'][2] if h2(x, y, s) % 4 else S['bark'][3]))
        px, py = x0 + (1 if s % 2 else -1), round(y0 + ry * 0.4)
        if (px, py) in hole and (px + 1, py) in hole: c.P(px, py, BODY[3]); c.P(px + 1, py, BODY[2])
        for (x, y) in ring:
            ramp, t = _ramp_t(I, x, y)
            if (x, y - 1) in hole: c.P(x, y, ramp[min(6, t + 3)])                     # 아래 깨진 턱 빛
            elif (x, y + 1) in hole and y < top + 1: c.P(x, y, ramp[max(0, t - 2)])     # 위 가장자리 그늘
            elif (x - 1, y) in hole or (x + 1, y) in hole: c.P(x, y, ramp[max(0, t - 1)])
        return True
    return False


def m_flake(c, I, cx, cy, s):
    """겉면이 벗겨진 얕은 자리(6~9×3~5): 한 단 어둡고 거친 속(2화소 덩이), 위·왼 안쪽 테두리 그늘, 아래·오른 테두리 빛."""
    for (x0, y0) in _spots(cx, cy, s + 1, 4):
        A = _ell(x0, y0, 3.0 + s % 2, 1.8, s) | _ell(x0 + 2 - 4 * (s % 2), y0 + 1, 2.2, 1.5, s + 5)
        if not _fits(I, cx, cy, A, 1): continue
        for (x, y) in A:
            ramp, t = _ramp_t(I, x, y)
            edge_tl = (x, y - 1) not in A or (x - 1, y) not in A
            edge_br = (x, y + 1) not in A or (x + 1, y) not in A
            if edge_tl: col = ramp[max(0, t - 2)]
            elif edge_br: col = ramp[min(6, t + 1)]
            else: col = ramp[max(0, t - 1 - (1 if h2(x // 2, y, s) % 3 == 0 else 0))]
            c.P(x, y, col)
        return True
    return False


def m_oil(c, I, cx, cy, s):
    """기름 얼룩(7~10×4~6): 짙은 속, 옅어지는 테, 밖으로 한 단 어두운 번짐 — 낱점 없이 덩이로."""
    for (x0, y0) in _spots(cx, cy, s + 2, 4):
        core = _ell(x0, y0, 2.2 + s % 2, 1.4, s) | _ell(x0 + 2, y0 + 1, 1.6, 1.2, s + 1)
        mid = _ell(x0 + 0.5, y0 + 0.4, 3.6 + s % 2, 2.4, s + 3) - core
        halo = _ell(x0 + 0.5, y0 + 0.5, 4.8 + s % 2, 3.2, s + 4) - core - mid
        if not _fits(I, cx, cy, core | mid | halo, 0): continue
        for (x, y) in halo:
            ramp, t = _ramp_t(I, x, y); c.P(x, y, ramp[max(0, t - 1)])
        for (x, y) in mid: c.P(x, y, OIL[2] if (x + y + s) % 5 else OIL[3])
        for (x, y) in core: c.P(x, y, OIL[0] if h2(x, y, s) % 3 else OIL[1])
        return True
    return False


def m_weed(c, I, cx, cy, s):
    """이음에서 자란 풀 포기(키 4~6)."""
    js = [(x, y) for (x, y) in I['jt'] if _in_cell(cx, cy, x, y, 2) and y >= cy * 16 + 7]
    js.sort(key=lambda p: h2(p[0], p[1], s))
    for (x, y) in js:
        fan(c, x, min(y, cy * 16 + 13), 4 + s % 3, 'grass' if s % 3 else 'dry', s, 5, 2)
        return True
    return False


def m_crack(c, I, cx, cy, s, long=False):
    """머리카락 금: 비스듬히 8~13화소 굽이치는 차가운 회색 선(이음 색이 아니다) + 아래 한 화소 빛 턱, 짧은 가지 하나. 이음에 닿으면 멈춘다."""
    for (x0, y0) in _spots(cx, cy, s + 3, 3):
        if not _body(I, x0, y0): continue
        dx = 1 if s % 2 else -1
        pts = [(x0, y0)]; x, y = x0, y0
        n = (11 if long else 8) + s % 3
        for k in range(n):
            if h2(k, s, 71) % 3: x += dx
            if h2(k, s, 73) % 2 or k % 3 == 0: y += 1
            if not _in_cell(cx, cy, x, y, 1) or not _body(I, x, y): break
            pts.append((x, y))
        if len(pts) < 6: continue
        br = pts[len(pts) // 2]; bx, by = br
        for k in range(3):
            bx -= dx; by += 1 if k else 0
            if _in_cell(cx, cy, bx, by, 1) and _body(I, bx, by): pts.append((bx, by))
            else: break
        for i, (x, y) in enumerate(pts):
            c.P(x, y, CR_DEEP if long and 2 <= i <= 5 else CR_CORE)
        for (x, y) in pts:
            if (x, y + 1) not in pts and _body(I, x, y + 1) and _in_cell(cx, cy, x, y + 1, 1) and h2(x, y, s) % 3:
                ramp, t = _ramp_t(I, x, y + 1); c.P(x, y + 1, ramp[min(6, t + 1)])
        return True
    return False


def m_corner(c, I, cx, cy, s):
    """깨진 판 모서리: 이음이 만나는 자리 옆 판 귀퉁이가 3~4화소 떨어져 흙이 보인다(위 그늘·깨진 빗변 빛)."""
    jt = I['jt']
    cands = [(x, y) for (x, y) in jt if _in_cell(cx, cy, x, y, 3) and sum((x + a, y + b) in jt for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1))) >= 3]
    cands.sort(key=lambda p: h2(p[0], p[1], s))
    for (jx, jy) in cands:
        for (qx, qy) in sorted(((1, 1), (-1, 1), (1, -1), (-1, -1)), key=lambda q: h2(q[0], q[1], s)):
            n = 3 + s % 2
            tri = [(jx + qx * (1 + i), jy + qy * (1 + j)) for i in range(n) for j in range(n) if i + j < n]
            if not all(_body(I, x, y) and _in_cell(cx, cy, x, y, 1) for (x, y) in tri): continue
            for (x, y) in tri:
                i, j = abs(x - jx) - 1, abs(y - jy) - 1
                c.P(x, y, J_DEEP if (y - 1, ) and (x, y - 1) not in tri and qy > 0 and j == 0 else S['bark'][2] if (x + y) % 3 else S['bark'][1])
            for (x, y) in tri:                                            # 빗변 바깥 판 화소 = 깨진 턱
                for (ex, ey) in ((x + qx, y), (x, y + qy)):
                    if (ex, ey) not in tri and _body(I, ex, ey) and _in_cell(cx, cy, ex, ey, 1):
                        ramp, t = _ramp_t(I, ex, ey); c.P(ex, ey, ramp[min(6, t + 2)] if ey >= y else ramp[max(0, t - 1)])
            return True
    return False


def m_heave(c, I, cx, cy, s):
    """들뜬 판: 가로 이음 한 토막(8~11화소)에서 위 판의 아래 끝이 들려 빛 받는 턱 + 1화소 앞면 + 그 밑 그늘 틈."""
    jt, jd = I['jt'], I['jdir']
    rows = {}
    for (x, y) in jt:
        if jd.get((x, y)) == 'h' and _in_cell(cx, cy, x, y, 2) and _in_cell(cx, cy, x, y - 1, 1) and _in_cell(cx, cy, x, y + 1, 1):
            rows.setdefault(y, []).append(x)
    for y in sorted(rows, key=lambda v: h2(v, s, 5)):
        xs = sorted(rows[y])
        run = [x for x in xs if _body(I, x, y - 1) and _body(I, x, y + 1)]
        if len(run) < 8: continue
        a = run[0] + (s % 2); b = min(run[-1], a + 10)
        for x in range(a, b + 1):
            end = x - a < 2 or b - x < 2
            ramp, t = _ramp_t(I, x, y - 1)
            c.P(x, y - 1, ramp[min(6, t + (1 if end else 3))])
            if not end:
                c.P(x, y, BODY[1]); c.P(x, y + 1, J_CORE)
        return True
    return False


_MARKS = dict(pothole=m_pothole, flake=m_flake, oil=m_oil, weed=m_weed, crack=m_crack, corner=m_corner, heave=m_heave,
              lcrack=lambda c, I, cx, cy, s: m_crack(c, I, cx, cy, s, long=True))
# 칸 (cx, cy) → 표시. b·c 는 서로 다른 칸, 이음 박자와 안 맞게 흩었다. 큰 표시(긴 금·들뜬 판)는 slab-a 에만, slab-a 는 표시가 적다.
SLAB_MARKS = {
    'a': [(2, 1, 'lcrack'), (5, 5, 'lcrack'), (1, 6, 'crack'), (6, 2, 'heave'), (3, 3, 'corner'), (7, 7, 'corner')],
    'b': [(1, 1, 'pothole'), (6, 4, 'pothole'), (3, 6, 'pothole'), (4, 0, 'weed'), (0, 3, 'weed'), (7, 6, 'weed'), (2, 4, 'weed'),
          (5, 2, 'flake'), (1, 7, 'flake'), (6, 0, 'flake')],
    'c': [(2, 2, 'oil'), (7, 3, 'oil'), (4, 5, 'oil'), (0, 6, 'oil'), (5, 1, 'weed'), (3, 3, 'weed'), (6, 7, 'weed'),
          (1, 5, 'flake'), (4, 7, 'flake'), (7, 1, 'pothole')],
    'd': [(1, 2, 'crack'), (6, 6, 'crack'), (4, 4, 'corner'), (2, 6, 'weed'), (5, 0, 'weed'), (7, 3, 'oil'), (0, 1, 'flake')],
    'e': [(3, 1, 'crack'), (5, 6, 'crack'), (1, 4, 'corner'), (6, 3, 'corner'), (4, 7, 'weed'), (2, 5, 'pothole'), (7, 0, 'flake')],
}
SLAB_MISSED = []


def _slab_draw(L, var):
    def draw(c):
        I = _slab_info(L)
        for y in range(SP):
            for x in range(SP): c.P(x, y, _slab_px(I, x, y))
        for k, (cx, cy, kind) in enumerate(SLAB_MARKS[var]):
            if not _MARKS[kind](c, I, cx, cy, h2(cx, cy, I['seed'] + 31 * k) % 997 + k):
                SLAB_MISSED.append((var, cx, cy, kind))
    return draw


def _slab_maps():
    """slab-edge 호환: (이음, 금, 구멍, 내려앉음) — 이음 = A 배치 이음 화소, 나머지는 비었다(표시는 칸 안에만 있다)."""
    return set(_slab_info('a')['jt']), set(), set(), set()


_SLAB_MAPS = None


def slab_board(seed, w=24, h=16):
    """맵 slabAt 과 같은 섞기: 8×8칸 덩이마다 배치(A 무리 · D · E 각 1/3), A 덩이 안 칸은 slab-a/b/c 를 2:4:4 로."""
    R = {k: render(PIECES['slab-' + k]) for k in 'abcde'}
    a = np.zeros((h * 16, w * 16, 4), np.uint8)
    for y in range(h):
        for x in range(w):
            lay = h2(x // 8, y // 8, seed) % 3
            if lay == 1: k = 'd'
            elif lay == 2: k = 'e'
            else:
                r = h2(x, y, seed + 101) % 10
                k = 'a' if r < 2 else 'b' if r < 6 else 'c'
            cx, cy = x % 8, y % 8
            a[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16] = R[k][cy * 16:(cy + 1) * 16, cx * 16:(cx + 1) * 16]
    return a


def _board_seed(start):
    """덩이 6개에 세 배치가 다 나오는 첫 씨앗."""
    s = start
    while len({h2(bx, by, s) % 3 for bx in range(3) for by in range(2)}) < 3: s += 1
    return s


_SLAB_EN = ('broken old city concrete pavement seen from above, flat ground: big rectangular cast slabs of different sizes, '
            'each slab a slightly different grey with soft damp stains, thin dark joints with dirt in places and a few wider gaps, '
            'lit top edges, hairline cracks in a lighter grey than the joints, a few broken corners showing earth, a seamless 8x8-tile field')
_SLAB_SUB = {'a': ', with a few long hairline cracks, one heaved slab edge and two broken corners',
             'b': ', with a few small potholes showing earth, weeds growing from joints and flaked patches',
             'c': ', with a few dark oil stains, weeds growing from joints, flaked patches and a small pothole',
             'd': ' (second joint layout), with hairline cracks, a broken corner, weeds, an oil stain and a flaked patch',
             'e': ' (third joint layout), with hairline cracks, broken corners, a weed tuft, a small pothole and a flaked patch'}
_SLAB_KO = {'a': '금 간 콘크리트 판 A', 'b': '금 간 콘크리트 판 B', 'c': '금 간 콘크리트 판 C', 'd': '금 간 콘크리트 판 D(둘째 짜임)', 'e': '금 간 콘크리트 판 E(셋째 짜임)'}
_SLAB_DESC = {
    'a': 'A 짜임 바탕 + 큰 표시(긴 금·들뜬 판 끝·깨진 모서리)가 몇 칸에만.',
    'b': 'A 짜임 + 칸 안 표시(작은 구멍·이음 잡초·벗겨진 자리) — slab-a 와 같은 자리 칸을 바꿔 끼운다.',
    'c': 'A 짜임 + 칸 안 표시(기름 얼룩·이음 잡초·벗겨진 자리·작은 구멍, B 와 다른 칸) — slab-a 와 같은 자리 칸을 바꿔 끼운다.',
    'd': '둘째 이음 짜임(변형 없음). 덩이 경계 띠의 이음은 A 와 화소까지 같아 A·D·E 덩이를 아무렇게나 섞어도 이어진다.',
    'e': '셋째 이음 짜임(변형 없음). 덩이 경계 띠의 이음은 A 와 화소까지 같아 A·D·E 덩이를 아무렇게나 섞어도 이어진다.'}
for _i, _v in enumerate('abcde'):
    _L = 'a' if _v in 'abc' else _v
    piece('slab-' + _v, _SLAB_KO[_v], 8, 8, TERRAIN, en=_SLAB_EN + _SLAB_SUB[_v],
          group='ground', tags=['콘크리트', '광장', '보도', '바닥'],
          desc='깨진 옛 도시 콘크리트 판(보도·광장, 8×8칸·주기 128화소). 맵 칸 (x,y) 에는 판의 (x mod 8, y mod 8) 칸을 깐다 — 8×8칸 덩이마다 짜임 하나(A 무리·D·E), '
               'A 덩이 안 칸은 slab-a/b/c 를 2:4:4 로 섞는다. ' + _SLAB_DESC[_v],
          sample=(lambda s: (lambda f=0: slab_board(_board_seed(s))))(1100 + 37 * _i))(_slab_draw(_L, _v))
