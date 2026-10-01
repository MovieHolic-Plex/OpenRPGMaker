"""월드맵 설계 2단계 — 도로·다리·봉우리·바닥 변형(장식) 층.

모든 새 그림은 (a) 원본 조각 재조립(굴리기·뒤집기·팔레트 치환·원본 칸 잘라 얹기) 또는
(b) 원본 팔레트·질감·외곽선으로 좌표를 명시해 찍은 손 도트다. 생성 이미지·트레이싱 없음.
"""
import heapq
import numpy as np
from terrain_lib import *  # noqa
import terrain_lib as T
from terrain_lib import _tex_at, _fam
from terrain_render import Map, _q_iter

REG = []   # 새 칸 등록부: dict(name, prov, cells=[(rgb16, alpha16)...], layout)


def _mix(a, b, p):
    return (a.astype(float) * (1 - p) + b.astype(float) * p).round().astype(np.uint8)


def _mul(a, p):
    return np.clip(a.astype(float) * p, 0, 255).round().astype(np.uint8)


# ═════════════════════════ 도로 킷 ═════════════════════════
ROAD_PATS = [(3, 3, 3, 3), (6, 7, 7, 6)]
_RK = {}


def road_kits(style):
    if style in _RK:
        return _RK[style]
    if style == 'grass':
        fill = TEX[DIRT]
        st = dict(outline=hx('6b4f31'), holes=(hx('855c2e'), .22))
    elif style == 'sand':
        fill = _mix(TEX[DIRT], TEX[SAND], .30)
        st = dict(outline=hx('90704d'), holes=(hx('b4a581'), .22))
    elif style == 'snow':
        fill = _mul(TEX[DIRT], .86)
        st = dict(outline=hx('4b3025'), holes=(hx('6b4f31'), .22), dust=(hx('d3ecec'), .40))
    else:  # dirt 바닥 위: 한 톤 밝은 길
        fill = _mix(TEX[DIRT], np.array([0xdc, 0xbc, 0x8c], np.uint8), .55)
        st = dict(outline=hx('4b3025'), holes=(hx('ab8760'), .22))
    kits = [blob_kit(fill, None, st, m=4, r=4, pats=ROAD_PATS[v], salt=41 + v * 7, iso=(3, 4), inner_r=4)
            for v in range(len(ROAD_PATS))]
    _RK[style] = kits
    return kits


def road_style_of(g):
    return {GRASS: 'grass', MARSH: 'grass', SAND: 'sand', SNOW: 'snow', DIRT: 'dirt'}.get(g, 'grass')


# ═════════════════════════ 길찾기 ═════════════════════════
COST = {GRASS: 1, SAND: 1, SNOW: 1, DIRT: 1, MARSH: 9, FOREST: 12, SFOREST: 12, MOUNT: 45, SMOUNT: 45, RIVER: 12, ICE: 999}
DIRS = [(1, 0), (0, 1), (-1, 0), (0, -1)]


def route(t, road, foot, starts, targets, turn=2.0):
    """멀티 시작·멀티 목표 다익스트라. 강 칸은 곧게만 건넌다. targets: dict 칸->추가비용. 반환: 칸 목록 또는 None"""
    H, W = t.shape
    dist = {}
    prev = {}
    pq = []
    for s in starts:
        for d in range(4):
            dist[(s[0], s[1], d)] = 0.0
            heapq.heappush(pq, (0.0, s[0], s[1], d))
    best = None
    while pq:
        c, x, y, d = heapq.heappop(pq)
        if dist.get((x, y, d), 1e18) < c - 1e-9:
            continue
        if (x, y) in targets and t[y, x] != RIVER:
            tot = c + targets[(x, y)]
            if best is None or tot < best[0]:
                best = (tot, (x, y, d))
        if best is not None and c > best[0]:
            break
        cur_river = t[y, x] == RIVER
        for nd, (dx, dy) in enumerate(DIRS):
            if cur_river and nd != d:
                continue
            nx, ny = x + dx, y + dy
            if not (0 <= nx < W and 0 <= ny < H) or foot[ny, nx]:
                continue
            k = int(t[ny, nx])
            if k in (SEA, ICE):
                continue
            step = COST[k] if not road[ny, nx] else 0.3
            if k == RIVER:
                # 어귀(바다 접함) 회피
                if any(0 <= nx + a < W and 0 <= ny + b < H and t[ny + b, nx + a] == SEA for a, b in DIRS):
                    step += 40
            if nd != d and c > 0:
                step += turn
            nc = c + step
            key = (nx, ny, nd)
            if nc < dist.get(key, 1e18) - 1e-9:
                dist[key] = nc
                prev[key] = (x, y, d)
                heapq.heappush(pq, (nc, nx, ny, nd))
    if best is None:
        return None
    out = []
    cur = best[1]
    while cur is not None:
        out.append((cur[0], cur[1]))
        cur = prev.get(cur)
    return out[::-1]


def site_ring(foot_box, t, foot):
    """장소 발치 목표: 아래줄 0, 옆 +2, 위 +4 (땅인 칸만)"""
    x, y, w, h = foot_box
    H, W = t.shape
    res = {}
    for i in range(-1, w + 1):
        for j, extra in ((h, 0), (-1, 4)):
            c = (x + i, y + j)
            if i in (-1, w):
                continue
            if 0 <= c[0] < W and 0 <= c[1] < H and t[c[1], c[0]] not in (SEA, RIVER, ICE) and not foot[c[1], c[0]]:
                # 아래줄은 가운데 가까울수록 싸게
                mid = abs((i - (w - 1) / 2))
                res[c] = min(res.get(c, 9), extra + mid * 0.6)
    for j in range(h):
        for i, extra in ((-1, 2), (w, 2)):
            c = (x + i, y + j)
            if 0 <= c[0] < W and 0 <= c[1] < H and t[c[1], c[0]] not in (SEA, RIVER, ICE) and not foot[c[1], c[0]]:
                res[c] = min(res.get(c, 9), extra + (0 if j == h - 1 else 1))
    return res


def plan_roads(t, icon_cells, routes, block=None):
    """routes: [(이름, 장소A, 장소B, [via...])]. 반환 road bool, bridge dict{(x,y):'h'|'v'}, foot bool, 경로 목록"""
    H, W = t.shape
    foot = np.zeros((H, W), bool)
    for (x, y, w, h) in icon_cells.values():
        foot[y:y + h, x:x + w] = True
    road = np.zeros((H, W), bool)
    bridge = {}
    paths = []
    fb = foot if block is None else (foot | block)   # 길찾기용(막힌 칸 포함)
    for name, a, b, vias in routes:
        pts = [('site', a)] + [('cell', v) for v in vias] + [('site', b)]
        full = []
        for (ka, va), (kb, vb) in zip(pts, pts[1:]):
            starts = list(site_ring(icon_cells[va], t, fb).keys()) if ka == 'site' else [va]
            if ka == 'site' and full:
                starts = [full[-1]]
            tg = site_ring(icon_cells[vb], t, fb) if kb == 'site' else {vb: 0}
            if ka == 'site' and not full:
                # 출발 장소: 발치 칸 중 아래줄 우선(시작 비용에 반영하지 않고 후보로만)
                pass
            p = route(t, road, fb, starts, tg)
            if p is None:
                raise RuntimeError('no route ' + name)
            full += p if not full else p[1:]
        # 강 건널목 표시
        for i, (x, y) in enumerate(full):
            road[y, x] = True
            if t[y, x] == RIVER:
                px, py = full[i - 1]
                nx, ny = full[i + 1] if i + 1 < len(full) else (x, y)
                bridge[(x, y)] = 'h' if (px != x or nx != x) and (py == y) else 'v'
        paths.append((name, full))
    return road, bridge, foot, paths


# ═════════════════════════ 그리기: 도로 ═════════════════════════
def render_roads(M, img, road, bridge, foot, skip=()):
    H, W = M.H, M.W
    R = road | foot
    for y in range(H):
        for x in range(W):
            if not road[y, x] or (x, y) in bridge or (x, y) in skip:
                continue
            g = ground_of(M.k(x, y))
            style = road_style_of(g)
            kit = road_kits(style)[hh(x, y, 31) % len(ROAD_PATS)]

            def rr(a, b):
                return 0 <= a < W and 0 <= b < H and bool(R[b, a])
            iso = not any(rr(x + a, y + b) for a in (-1, 0, 1) for b in (-1, 0, 1) if (a, b) != (0, 0))
            for qx, qy, sx, sy in _q_iter():
                role = 'iso' if iso else pick_role(rr(x, y + sy), rr(x + sx, y), rr(x + sx, y + sy), qx, qy)
                rgb, a = kit[role]
                aq = a[qy * 8:(qy + 1) * 8, qx * 8:(qx + 1) * 8]
                rq = rgb[qy * 8:(qy + 1) * 8, qx * 8:(qx + 1) * 8]
                px0, py0 = x * 16 + qx * 8, y * 16 + qy * 8
                dst = img[py0:py0 + 8, px0:px0 + 8]
                dst[aq] = rq[aq]
    return img


# ═════════════════════════ 다리 ═════════════════════════
def _c(s):
    return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))


BR = dict(rail=_c('4b3025'), railhi=_c('855c2e'), p1=_c('9f7b53'), p2=_c('ab8760'), gap=_c('6b4f31'),
          post=_c('3e210d'), posthi=_c('855c2e'))


def bridge_sprite(first, last):
    """가로 다리 한 칸(16x16). 반환 rgb, alpha, shadow(bool: 물 위 그림자 행). 세로는 전치."""
    rgb = np.zeros((16, 16, 3), np.uint8)
    a = np.zeros((16, 16), bool)
    sh = np.zeros((16, 16), bool)
    # 상판 y=4..11
    for x in range(16):
        for y in range(4, 12):
            col = BR['p1'] if (x // 4) % 2 == 0 else BR['p2']
            if x % 4 == 3:
                col = BR['gap']
            if (x + y) % 7 == 0 and x % 4 != 3:
                col = BR['gap']          # 나뭇결 점
            rgb[y, x] = col
            a[y, x] = True
    # 난간 y=3, 12 (윗줄 밝은 테)
    for x in range(16):
        rgb[3, x] = BR['railhi']; a[3, x] = True
        rgb[12, x] = BR['rail']; a[12, x] = True
        rgb[2, x] = BR['rail']; a[2, x] = True
        sh[13, x] = True
        sh[14, x] = (x % 2 == 0)
    # 말뚝: 첫 칸 왼끝·마지막 칸 오른끝, 안쪽 이음은 8px 중간
    posts = []
    if first:
        posts.append(0)
    if last:
        posts.append(14)
    posts.append(7)
    for px in posts:
        for y in range(1, 5):
            for dx in (0, 1):
                rgb[y, px + dx] = BR['post'] if dx else BR['posthi']; a[y, px + dx] = True
        for y in range(11, 15):
            for dx in (0, 1):
                rgb[y, px + dx] = BR['post']; a[y, px + dx] = True
    return rgb, a, sh


def render_bridges(M, img, bridge):
    for (x, y), ori in bridge.items():
        def isb(a, b, o=ori):
            return bridge.get((a, b)) == o
        if ori == 'h':
            first, last = not isb(x - 1, y), not isb(x + 1, y)
            rgb, a, sh = bridge_sprite(first, last)
        else:
            first, last = not isb(x, y - 1), not isb(x, y + 1)
            rgb, a, sh = bridge_sprite(first, last)
            rgb, a, sh = rgb.transpose(1, 0, 2), a.T, sh.T
        dst = img[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16]
        dst[sh] = _mul(dst[sh], .62)
        dst[a] = rgb[a]
    return img


# ═════════════════════════ 봉우리 · 피라미드 ═════════════════════════
def _keyed(c, r, w, h):
    blk = S.a[r * 16:(r + h) * 16, c * 16:(c + w) * 16].copy()
    a = ~np.all(blk == KEY, axis=2)
    return blk, a


PEAK_BROWN = _keyed(26, 0, 2, 1)
PEAK_SNOW = _keyed(28, 0, 2, 1)
PEAK_GREEN = _keyed(24, 0, 2, 1)
PYR_BROWN = _keyed(18, 12, 2, 2)


def _snow_pyr():
    """갈색 피라미드 → 눈 산 팔레트로 명도 순위 치환(손 도트 팔레트 치환)."""
    rgb, a = PYR_BROWN
    out = rgb.copy()
    src = np.unique(rgb[a].reshape(-1, 3), axis=0)
    lum = lambda c: 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]
    ramp_snow = [hx(s) for s in ('291010', '4f2e21', '606278', '74d1d2', 'cfecec', 'dcf7f9', 'f0faff')]
    order = sorted(src.tolist(), key=lum)
    # 가장 어두운 것은 외곽선(291010 유지), 나머지를 눈 램프에 균등 매핑
    mp = {}
    for i, c in enumerate(order):
        j = 0 if i == 0 else 2 + int((i - 1) * (len(ramp_snow) - 3) / max(1, len(order) - 2))
        mp[tuple(c)] = ramp_snow[min(j, len(ramp_snow) - 1)]
    for c, v in mp.items():
        m = np.all(rgb == np.array(c, np.uint8), axis=2) & a
        out[m] = v
    return out, a


PYR_SNOW = _snow_pyr()


def place_peaks(t, protect):
    """봉우리(2x1)와 피라미드(2x2)를 산줄기 안쪽에 고른다. 반환 [(kind,x,y)] (픽셀 좌표는 x*16, y*16-8 / x*16,y*16)"""
    H, W = t.shape
    isM = np.isin(t, (MOUNT, SMOUNT))
    out = []
    taken = np.zeros((H, W), bool)
    cands = []
    for y in range(1, H - 1):
        for x in range(1, W - 2):
            blk = isM[y - 1:y + 1, x:x + 2]
            if not blk.all() or protect[y - 1:y + 1, x:x + 2].any():
                continue
            nb = isM[max(0, y - 2):y + 2, max(0, x - 1):x + 3].sum()
            cands.append((-(nb + rnd(x, y, 3) * 2.5), x, y))
    cands.sort()
    for _, x, y in cands:
        if taken[max(0, y - 2):y + 2, max(0, x - 2):x + 3].any():
            continue
        fam = SMOUNT if (t[y - 1:y + 1, x:x + 2] == SMOUNT).sum() >= 2 else MOUNT
        out.append(('peak_snow' if fam == SMOUNT else 'peak_brown', x, y))
        taken[y - 1:y + 1, x:x + 2] = True
    return out


def place_pyramids(t, protect, peaks):
    H, W = t.shape
    isM = np.isin(t, (MOUNT, SMOUNT))
    occ = np.zeros((H, W), bool)
    for k, x, y in peaks:
        occ[y - 1:y + 1, x:x + 2] = True
    out = []
    cands = []
    for y in range(0, H - 1):
        for x in range(0, W - 1):
            if not isM[y:y + 2, x:x + 2].all() or occ[max(0, y - 1):y + 2, max(0, x - 1):x + 3].any():
                continue
            if protect[y:y + 2, x:x + 2].any():
                continue
            nb = isM[max(0, y - 1):y + 3, max(0, x - 1):x + 3].sum()
            cands.append((-(nb + rnd(x, y, 9) * 3), x, y))
    cands.sort()
    for _, x, y in cands:
        if occ[max(0, y - 1):y + 2, max(0, x - 1):x + 3].any():
            continue
        fam = SMOUNT if (t[y:y + 2, x:x + 2] == SMOUNT).sum() >= 2 else MOUNT
        out.append(('pyr_snow' if fam == SMOUNT else 'pyr_brown', x, y))
        occ[y:y + 2, x:x + 2] = True
    return out


def render_peaks(img, items):
    for kind, x, y in items:
        spr, a = {'peak_brown': PEAK_BROWN, 'peak_snow': PEAK_SNOW, 'pyr_brown': PYR_BROWN, 'pyr_snow': PYR_SNOW}[kind]
        h, w = a.shape
        px, py = x * 16, (y * 16 - 8 if kind.startswith('peak') else y * 16)
        dst = img[py:py + h, px:px + w]
        dst[a] = spr[a]
    return img


# ═════════════════════════ 바닥 변형(장식) ═════════════════════════
def _spr(rows, pal):
    h, w = len(rows), max(len(r) for r in rows)
    rgb = np.zeros((h, w, 3), np.uint8)
    a = np.zeros((h, w), bool)
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch in pal:
                rgb[y, x] = hx(pal[ch]); a[y, x] = True
    return rgb, a


SNOWPAL = dict(m='d3ecec', b='7bc7c7', c='74d1d2', l='e0f7f9', w='f0faff', g='cfecec')
SPR = {
    'foot': _spr([
        "..........",
        ".mm.......",
        ".mm.......",
        ".b........",
        "....mm....",
        "....mm....",
        ".....b....",
        "........mm",
        "........mm",
        ".........b"], SNOWPAL),
    'foot2': _spr([
        "..........",
        "........mm",
        "........mm",
        ".........b",
        "....mm....",
        "....mm....",
        ".....b....",
        ".mm.......",
        ".mm.......",
        ".b........"], SNOWPAL),
    'crack': _spr([
        "..m.......",
        ".mcm......",
        "..mcm.....",
        "...mcm.mm.",
        "....mcmcm.",
        ".....mcm..",
        "......mcm.",
        ".......mc."], SNOWPAL),
    'crack2': _spr([
        "......m...",
        ".....mcm..",
        "..mm.mcm..",
        ".mcmcmcm..",
        "..mmcmm...",
        "....mcm...",
        "...mcm....",
        "..mcm.....",
        "..mm......"], SNOWPAL),
    'pile': _spr([
        "....gg....",
        "..gllllg..",
        ".gllllllmm",
        "gllllllmmm",
        "mmmmmmmmm.",
        ".bbmmmmbb."], SNOWPAL),
    'pile2': _spr([
        "...gg.....",
        ".gllllg...",
        "gllllllgg.",
        "lllllllmmg",
        "mmmmmmmmm.",
        "..bbbbb..."], SNOWPAL),
    'srock': _spr([
        "..1111....",
        ".1wwww1...",
        "1wwwlll1..",
        "1lr4444r1.",
        "1r444444r1",
        ".1rrrrrr1.",
        "..b1111b.."], dict(SNOWPAL, **{'1': '1d2c33', 'r': '475b63', '4': '354951'})),
    'drift': _spr([
        "................",
        "..mmm.....mm....",
        ".m...mmmmm..mm..",
        "m.............m.",
        "................",
        "................",
        "....mm..........",
        "..mm..mmmm..mm..",
        ".m.......mmm..m."], SNOWPAL),
}
GRPAL = dict(d='235328', m='44884a', l='689e4e', s='758276', h='8ca9a3', k='1d2c33', y='ab8760', b='90704d', c='cca77b')
SPR.update({
    'tuft': _spr([
        "...l..l...",
        "..dl.dl...",
        "..d.ld.l..",
        ".ld.dl.d..",
        "..dddddd.."], GRPAL),
    'tuft2': _spr([
        "..l.......",
        ".dl..l.l..",
        ".dl.dl.dl.",
        "..dddddd..",
        "...dd.dd.."], GRPAL),
    'gstone': _spr([
        "..kkkk..",
        ".khhssk.",
        "ksssssdk",
        ".kdddddk",
        "..dkkkd."], GRPAL),
    'gpatch': _spr([
        "..dd..dd..",
        ".dmmdddmd.",
        "dmlmmmlmmd",
        ".ddmmmddd.",
        "...dd.d..."], GRPAL),
    'pebble': _spr([
        "..bbb..",
        ".byyyb.",
        ".bccyb.",
        "..bbb.."], GRPAL),
    'pebble2': _spr([
        ".bbb.....",
        "byyyb.bb.",
        "bccyb.byb",
        ".bbb...bb"], GRPAL),
    'dunes': _spr([
        "................",
        "...bb......bb...",
        ".bb..bb..bb..bb.",
        "b......bb......b",
        "................"], dict(b='b4a581', y='c3ba89')),
    'dcrack': _spr([
        "b.......",
        ".bb.....",
        "..b..b..",
        "..bbbb.b",
        ".....b.b",
        "......b."], dict(b='6b4f31')),
})
def _pick(seq, u):
    tot = sum(w for _, w in seq)
    acc = 0
    for n, w in seq:
        acc += w / tot
        if u < acc:
            return n
    return seq[-1][0]


# ── 큰 바닥 변형: 눈 더미·얼음 연못·바위(흙·모래)·마른 풀대 ─────────────────────
SPR.update({
    'mound': _spr([
        "......llll......",
        "....llwwwwll....",
        "..llwwwwwwwwlm..",
        ".lwwwwwwwwwwlmm.",
        "lwwwwwwwwwwwlmmm",
        "lmmmmmmmmmmmmmbb",
        ".bbbbbbbbbbbbbb."], SNOWPAL),
    'mound2': _spr([
        "....lllll.......",
        "..llwwwwwll..ll.",
        ".lwwwwwwwwwlllmm",
        "lwwwwwwwwwwwlmmm",
        "lmmmmmmmmmmmmbb.",
        ".bbbbbbbbbbbb..."], SNOWPAL),
    'pond': _spr([
        "........oooooooo........",
        "....ooooo.iiiiiii.oooo..",
        "..ooiiiiiiiiiiiiiiiiioo.",
        ".oiiiiwwiiiiiiiiiiiiiiio",
        "oiiiiwwwiiiiiiiiciiiiiio",
        "oiiiiiiiiiiiiiccciiiiiio",
        "oiiiiiiiiiiiiiiiiiiwiiio",
        ".oiiiiiiiiwwiiiiiiiiiio.",
        "..oooiiiiiiiiiiiiiiooo..",
        "....oooooiiiiiiooooo....",
        "..........oooooo........"], dict(SNOWPAL, o='7bc7c7', i='d3ecec', c='74d1d2')),
    'srock2': _spr([
        "...1111...",
        "..1wwww1..",
        ".1wwlll41.",
        "1lr44444r1",
        "1r4444444r1"[:10],
        ".1rrrrrrb.",
        "..bbbbbb.."], dict(SNOWPAL, **{'1': '1d2c33', 'r': '475b63', '4': '354951'})),
    'drock': _spr([
        "..kkkk...",
        ".kccyyk..",
        "kcyyyybk.",
        "kyyybbbbk",
        ".kbbbbbk.",
        "..kkkkk.."], dict(k='2b1d14', c='e4d2b4', y='b9a58a', b='7d6650')),
    'drock2': _spr([
        "...kkk....",
        "..kcyyk.kk",
        ".kcyyybkcbk",
        ".kyybbbkbbk",
        "..kkkkk.kk."], dict(k='2b1d14', c='e4d2b4', y='b9a58a', b='7d6650')),
    'dpebble': _spr([
        "..bbb..",
        ".byyyb.",
        ".bccyb.",
        "..bbb.."], dict(b='6b4f31', y='c39a6a', c='dcbc8c')),
    'dpebble2': _spr([
        ".bbb.....",
        "byyyb.bb.",
        "bccyb.byb",
        ".bbb...bb"], dict(b='6b4f31', y='c39a6a', c='dcbc8c')),
    'sticks': _spr([
        "..b...b...",
        ".b.b.b.b..",
        "..b.b.b.b.",
        "...bbb.b.."], dict(b='6b4f31')),
    'srock_s': _spr([
        "..kkkk...",
        ".kcccyk..",
        "kcccyyyk.",
        "kyyyyybbk",
        ".kbbbbbk.",
        "..kkkkk.."], dict(k='3a3524', c='f0ecc4', y='d8d0a0', b='9c9268')),
})
GROUND_DECOR = {
    SNOW: (0.66, [('foot', 1), ('foot2', 1), ('crack', 2), ('crack2', 1.5), ('pile', 2), ('pile2', 2), ('srock', 1.2),
                  ('srock2', 1.2), ('drift', 3), ('mound', 2.4), ('mound2', 2.4)]),
    GRASS: (0.24, [('tuft', 3), ('tuft2', 3), ('gstone', 1.2), ('gpatch', 2.4)]),
    SAND: (0.24, [('pebble', 2), ('pebble2', 2), ('dunes', 3), ('srock_s', 1.2)]),
    DIRT: (0.5, [('dpebble', 2), ('dpebble2', 2), ('dcrack', 3), ('drock', 2), ('drock2', 2), ('sticks', 3)]),
}
BIG = {'mound': 1, 'mound2': 1, 'drift': 1}   # 칸 가득 차는 스프라이트(오프셋 0)

# 바닥별 색조 사다리(밝음 → 어두움). 픽셀의 사다리 위치를 한 단 옮겨 큰 얼룩을 만든다(질감은 그대로).
TONES = {
    GRASS: ['689e4e', '529543', '44884a'],
    SNOW: ['f0faff', 'e0f7f9', 'd3ecec'],
    SAND: ['cac88b', 'c3ba89', 'b4a581'],
    DIRT: ['ab8760', '9f7b53', '90704d'],
    FOREST: ['8abe4c', '54a043', '2c7b37', '1a4e2b'],
    SFOREST: ['d3ecec', '7bc7c7', '548ca6', '295764'],
}


def _noise(H, W, seed, period):
    from scipy import ndimage
    rs = np.random.RandomState(seed)
    gh, gw = H // period + 3, W // period + 3
    g = rs.rand(gh, gw)
    z = ndimage.zoom(g, period, order=3)[:H, :W]
    return np.clip(z, 0, 1)


def render_shade(M, img, protect, log=None):
    """바닥 색조 얼룩: 큰 얼룩(약 3~5칸)과 작은 얼룩(약 1.5칸)을 사다리 한 단 어둡게/밝게. 경계는 체커 디더.
    가장자리 칸(다른 지형과 맞닿는 칸)에서는 서서히 0으로 줄여 이음이 안 튀게 한다."""
    from scipy import ndimage
    H, W = M.H, M.W
    hp, wp = H * 16, W * 16
    n1 = _noise(hp, wp, 11, 56)
    n2 = _noise(hp, wp, 12, 22)
    nn = 0.68 * n1 + 0.32 * n2
    nn = (nn - nn.mean()) / (nn.std() + 1e-9)          # 표준화
    yy, xx = np.mgrid[0:hp, 0:wp]
    chk = ((xx + yy) & 1) == 0
    for G, ladder in TONES.items():
        elig = np.zeros((H, W), bool)
        for y in range(H):
            for x in range(W):
                if M.k(x, y) != G or protect[y, x]:
                    continue
                if all(M.k(x + a, y + b) == G for a in (-1, 0, 1) for b in (-1, 0, 1)):
                    elig[y, x] = True
        if not elig.any():
            continue
        pm = np.kron(elig, np.ones((16, 16), bool))
        dist = ndimage.distance_transform_edt(pm)
        ramp = np.clip(dist / 14.0, 0, 1)
        v = nn * ramp
        lad = np.array([hx(c) for c in ladder], np.uint8)
        idx = np.full((hp, wp), -1, int)
        for i, c in enumerate(lad):
            idx[np.all(img == c, axis=2)] = i
        dark_t, light_t = (-0.35, 0.85) if G != SNOW else (-0.10, 9)
        if G == DIRT:
            dark_t, light_t = -0.15, 0.45
        if G in (FOREST, SFOREST):
            dark_t, light_t = -0.45, 0.75
        # 어둡게: v < dark_t (경계 ±0.12 디더), 밝게: v > light_t
        dk = (v < dark_t - 0.12) | ((v < dark_t + 0.12) & chk & (v < dark_t + 0.12) & (v >= dark_t - 0.12))
        lt = (v > light_t + 0.12) | ((v > light_t - 0.12) & chk & (v <= light_t + 0.12) & (v >= light_t - 0.12))
        dk2 = v < dark_t - 0.85                        # 더 깊은 그늘(두 단)
        shift = np.zeros((hp, wp), int)
        shift[dk] += 1
        shift[dk2] += 1
        shift[lt] -= 1
        m = pm & (idx >= 0) & (shift != 0)
        new = np.clip(idx + shift, 0, len(lad) - 1)
        img[m] = lad[new[m]]
        if log is not None:
            log['shade_' + str(G)] = int(m.sum())
    return img


def render_trails(M, img, protect, used, log=None):
    """눈밭 발자국 길: 8방향 중 하나로 5~9칸, 5px 간격 좌우 엇갈림. 눈 바탕이 3x3 모두 눈인 칸에서만."""
    H, W = M.H, M.W
    dirs = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)]
    prints = 0

    def ok(x, y):
        if not (1 <= x < W - 1 and 1 <= y < H - 1) or protect[y, x] or used[y, x]:
            return False
        return all(M.k(x + a, y + b) == SNOW and not protect[y + b, x + a] for a in (-1, 0, 1) for b in (-1, 0, 1))
    for y in range(1, H - 1):
        for x in range(1, W - 1):
            if not ok(x, y) or rnd(x, y, 90) >= 0.011:
                continue
            d = dirs[int(rnd(x, y, 91) * 8)]
            n = 5 + int(rnd(x, y, 92) * 5)
            path = [(x, y)]
            for i in range(1, n):
                c = (x + d[0] * i, y + d[1] * i)
                if not ok(*c):
                    break
                path.append(c)
            if len(path) < 4:
                continue
            for c in path:
                used[c[1], c[0]] = True
            x0, y0 = x * 16 + 8, y * 16 + 8
            L = (len(path) - 1) * 16
            norm = float(np.hypot(*d))
            ux, uy = d[0] / norm, d[1] / norm
            side = 1
            step = 0
            while step <= L:
                px = x0 + ux * step + (-uy) * 2 * side
                py = y0 + uy * step + ux * 2 * side
                ix, iy = int(round(px)), int(round(py))
                for ddx, ddy, col in ((0, 0, 'd3ecec'), (1, 0, 'd3ecec'), (0, 1, 'd3ecec'), (1, 1, '7bc7c7'), (0, 2, '7bc7c7')):
                    X, Y = ix + ddx, iy + ddy
                    if 0 <= Y < H * 16 and 0 <= X < W * 16:
                        img[Y, X] = hx(col)
                prints += 1
                side = -side
                step += 5
    if log is not None:
        log['trail_prints'] = prints
    return img


def render_decor(M, img, protect, log=None):
    """바닥 변형: 8이웃이 모두 같은 맨바닥인 칸에만, 칸 안쪽 여백을 두고 스프라이트를 얹는다.
    눈밭은 발자국 길·얼음 연못(2칸)을 먼저 놓고 그 칸을 비운다."""
    H, W = M.H, M.W
    used = np.zeros((H, W), bool)
    # 얼음 연못(2칸 폭): 눈 3x3 이웃이 모두 눈이고 옆 칸도 같은 조건일 때 드물게
    pw, ph = SPR['pond'][1].shape[1], SPR['pond'][1].shape[0]

    def snow_ok(x, y):
        if not (1 <= x < W - 1 and 1 <= y < H - 1) or protect[y, x] or used[y, x]:
            return False
        return all(M.k(x + a, y + b) == SNOW and not protect[y + b, x + a] for a in (-1, 0, 1) for b in (-1, 0, 1))
    for y in range(1, H - 1):
        for x in range(1, W - 2):
            if snow_ok(x, y) and snow_ok(x + 1, y) and rnd(x, y, 95) < 0.018:
                rgb, a = SPR['pond']
                dst = img[y * 16 + 2:y * 16 + 2 + ph, x * 16 + 4:x * 16 + 4 + pw]
                dst[a] = rgb[a]
                used[y, x] = used[y, x + 1] = True
                if log is not None:
                    log['pond'] = log.get('pond', 0) + 1
    render_trails(M, img, protect, used, log)
    for y in range(1, H - 1):
        for x in range(1, W - 1):
            k = M.k(x, y)
            if k not in GROUND_DECOR or protect[y, x] or used[y, x]:
                continue
            ok = True
            for a in (-1, 0, 1):
                for b in (-1, 0, 1):
                    if M.k(x + a, y + b) != k or protect[y + b, x + a]:
                        ok = False
            if not ok:
                continue
            p, seq = GROUND_DECOR[k]
            if rnd(x, y, 71) >= p:
                continue
            name = _pick(seq, rnd(x, y, 72))
            rgb, a = SPR[name]
            h, w = a.shape
            ox = 1 + int(rnd(x, y, 73) * max(1, 16 - w - 1))
            oy = 1 + int(rnd(x, y, 74) * max(1, 16 - h - 1))
            if name in BIG:
                ox = 0
                oy = min(16 - h, 2 + int(rnd(x, y, 74) * 6))
            if rnd(x, y, 75) < .5:   # 좌우 뒤집기(재조립)
                rgb, a = rgb[:, ::-1], a[:, ::-1]
            dst = img[y * 16 + oy:y * 16 + oy + h, x * 16 + ox:x * 16 + ox + w]
            dst[a] = rgb[a]
            if log is not None:
                log[name] = log.get(name, 0) + 1
    return img


def render_object_variants(M, img, protect, log=None):
    """숲·산 몸통 칸: 8이웃이 모두 같은 계열이면 좌우 뒤집기 변형(재조립)과 산 자갈 점."""
    H, W = M.H, M.W
    for y in range(1, H - 1):
        for x in range(1, W - 1):
            k = M.k(x, y)
            if k not in OBJ or protect[y, x]:
                continue
            fam = _fam(k)
            if not all(M.k(x + a, y + b) is not None and _fam(M.k(x + a, y + b)) == fam
                       for a in (-1, 0, 1) for b in (-1, 0, 1)):
                continue
            if rnd(x, y, 81) < 0.5:
                cell = img[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16]
                cell[:] = cell[:, ::-1].copy()
                if log is not None:
                    log['mirror_' + fam] = log.get('mirror_' + fam, 0) + 1
    return img
