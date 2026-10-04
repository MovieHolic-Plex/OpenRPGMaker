"""월드맵 설계 데모 4단계 — 지형 어휘 확장 엔진.

원칙(1~3단계와 동일): 원본 EasyRPG World 팔레트·외곽선 결로만 손 도트. 생성 이미지·트레이싱 없음.
 - 바닥: 원본 풀/모래/흙/눈 질감을 명도 순위로 다른 팔레트에 옮긴 질감(단계 수·결 그대로) + 8x8 사분면 오토타일
 - 고원: 높이 0~2 격자. 윗면은 두꺼운 바위 테두리 덩이, 절벽 면은 2~3칸 두께로 열마다 들쭉날쭉하게 자동 유도
 - 물: 원본 물가 킷 + 해안거리 기반 3단 수심(베이어 디더) + 용암/독수 팔레트
 - 물체: 원본 숲·산 킷을 색조만 바꿔 활엽/침엽/정글/고사목, 갈색/눈/화산/붉은 산 계열
"""
import colorsys
import numpy as np
from collections import Counter
from PIL import Image
import scipy.ndimage as ndi
import terrain_lib as T
from terrain_lib import hx, hh, rnd, S, blob_kit, pick_role, NV, PATS, BAYER, _fam
import terrain_lib as TL

# ── 코드 ──
SEA, RIVER, LAVA, TOXIC = 0, 1, 2, 3
(GRASS, FARM, SAVANNA, SAND, DUNE, DIRT, BADLANDS, ASH, BASALT, SWAMP, MARSH, TUNDRA, SNOW, GLACIER,
 JUNGLE, CHASM, CRATER, CROP) = range(10, 28)
(NONE, BROAD, CONIFER, JUNGLEF, DEAD, SNOWF, MOUNT, SMOUNT, VOLC, MESA) = range(10)
FORESTS = (BROAD, CONIFER, JUNGLEF, DEAD, SNOWF)
MOUNTS = (MOUNT, SMOUNT, VOLC, MESA)

NAMES = {
    GRASS: '초원', FARM: '밀밭', CROP: '푸른 밭', SAVANNA: '사바나', SAND: '사막', DUNE: '모래언덕', DIRT: '황무지',
    BADLANDS: '붉은 협곡토', ASH: '화산재', BASALT: '현무암·용암지대', SWAMP: '늪', MARSH: '독 늪', TUNDRA: '툰드라',
    SNOW: '설원', GLACIER: '빙하', JUNGLE: '정글 바닥', CHASM: '균열 협곡', CRATER: '분화구',
}


def _lum(c):
    return 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]


def remap(cell, pal):
    """cell 의 색을 명도 순위로 pal(어두운→밝은 3~색)에 옮긴다."""
    flat = cell.reshape(-1, 3)
    uniq = sorted({tuple(c) for c in flat}, key=_lum)
    k = len(uniq)
    out = np.zeros_like(flat)
    lut = {}
    for i, u in enumerate(uniq):
        f = i / max(k - 1, 1) * (len(pal) - 1)
        lo = int(f)
        hi = min(lo + 1, len(pal) - 1)
        p = f - lo
        lut[u] = tuple(int(round(a * (1 - p) + b * p)) for a, b in zip(pal[lo], pal[hi]))
    for i, c in enumerate(flat):
        out[i] = lut[tuple(c)]
    return out.reshape(cell.shape)


def _p(*hexes):
    return [tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) for h in hexes]


PAL = {
    JUNGLE: _p('1e5a34', '266938', '347c3e'),
    SAVANNA: _p('96863e', 'ac9e48', 'c4b65c'),
    TUNDRA: _p('62745c', '74866a', '8c9c7e'),
    SWAMP: _p('2c5446', '366250', '467458'),
    DUNE: _p('cec084', 'dcd094', 'ecdfae'),
    BADLANDS: _p('8c422c', 'a65436', 'be6c44'),
    ASH: _p('4a464a', '5c585c', '747074'),
    BASALT: _p('241e26', '322a34', '463c48'),
    GLACIER: _p('96c4de', 'bae0f0', 'def4fc'),
    CHASM: _p('160e18', '221822', '34263a'),
    CRATER: _p('3a302c', '4a3e38', '60524a'),
}


def _stripe_tex(a, b, furrow, salt):
    t = np.zeros((16, 16, 3), np.uint8)
    for y in range(16):
        for x in range(16):
            r = y % 4
            c = furrow if r == 3 else (b if r == 2 else a)
            if r < 2 and hh(x, y, salt) % 11 == 0:
                c = b
            t[y, x] = c
    return t


def build_tex():
    grass = TL.TEX[TL.GRASS]
    tex = {GRASS: grass, SAND: TL.TEX[TL.SAND], DIRT: TL.TEX[TL.DIRT], SNOW: TL.TEX[TL.SNOW], MARSH: TL.TEX[TL.MARSH]}
    for g, pal in PAL.items():
        if g in (DUNE,):
            tex[g] = remap(TL.TEX[TL.SAND], pal)
        elif g in (BADLANDS,):
            tex[g] = remap(TL.TEX[TL.DIRT], pal)
        else:
            tex[g] = remap(grass, pal)
    tex[FARM] = _stripe_tex((196, 172, 72), (172, 148, 56), (124, 96, 40), 3)
    tex[CROP] = _stripe_tex((84, 150, 64), (66, 128, 58), (40, 92, 44), 5)
    return tex


TEX = build_tex()
# 우선순위: 큰 쪽의 가장자리가 작은 쪽 위에 덮인다
PRI = {GRASS: 0, JUNGLE: 1, FARM: 2, CROP: 2, SAVANNA: 3, TUNDRA: 4, SWAMP: 5, DIRT: 6, SAND: 7, DUNE: 8, BADLANDS: 9,
       ASH: 10, BASALT: 11, MARSH: 12, SNOW: 13, GLACIER: 14, CRATER: 15, CHASM: 16}
GROUNDS = tuple(PRI)


def _style(g):
    t = TEX[g]
    flat = t.reshape(-1, 3)
    uniq = sorted({tuple(c) for c in flat}, key=_lum)
    dark, light, mid = np.array(uniq[0], np.uint8), np.array(uniq[-1], np.uint8), np.array(uniq[len(uniq) // 2], np.uint8)
    st = dict(rim=(dark, .55), dust=(light, .35), spray=(mid, .10))
    if g == SNOW:
        return TL.SNOW_STYLE
    if g == CHASM:
        st = dict(outline_out=hx('0c060e'), rim=(hx('c89c60'), .55), dust=(hx('4a3a36'), .30))
    if g == CRATER:
        st = dict(outline_out=hx('2a201c'), rim=(hx('a89c90'), .60), dust=(hx('5a4c44'), .30))
    if g == GLACIER:
        st = dict(rim=(hx('6ea6cc'), .60), dust=(hx('f0fbff'), .40), spray=(hx('cfeaf6'), .10))
    return st


_KITS = {}


def ground_kits(g):
    if g not in _KITS:
        _KITS[g] = [blob_kit(TEX[g], None, _style(g), m=5, r=4, pats=PATS[v % 6], salt=11 + v * 5 + g * 3, iso=(3, 6))
                    for v in range(NV)]
    return _KITS[g]


# ═════════════ 바위 팔레트(절벽 면) ═════════════
ROCK = {
    'brown': _p('271313', '3e210d', '604530', '855c2e', 'b98a4c'),
    'grey': _p('1c1a22', '302c38', '4e4858', '746e80', 'a8a2b4'),
    'red': _p('321210', '561e14', '842e20', 'b04a2c', 'de7c50'),
    'dark': _p('0c0a10', '1a1620', '2e2632', '463a48', '685a6a'),
    'ice': _p('24405e', '386490', '5c96c0', '96cce4', 'e0f4fc'),
}
ROCK = {k: [np.array(c, np.uint8) for c in v] for k, v in ROCK.items()}
ROCK_OF = {GRASS: 'brown', JUNGLE: 'brown', FARM: 'brown', CROP: 'brown', SAVANNA: 'brown', TUNDRA: 'grey', SWAMP: 'brown',
           DIRT: 'brown', SAND: 'brown', DUNE: 'brown', BADLANDS: 'red', ASH: 'dark', BASALT: 'dark', MARSH: 'grey',
           SNOW: 'ice', GLACIER: 'ice', CRATER: 'dark', CHASM: 'dark'}

_PKITS = {}


def plateau_kits(g, rock):
    key = (g, rock)
    if key not in _PKITS:
        P = ROCK[rock]
        st = dict(outline_out=P[0], outline=P[1], holes=(P[2], .9), rim=(P[1], .9), spray=(P[1], .30))
        lit = np.clip(TEX[g].astype(np.float32) * 1.13 + 4, 0, 255).astype(np.uint8)
        _PKITS[key] = [blob_kit(lit, None, st, m=6, r=5, pats=PATS[(v + 2) % 6], salt=71 + v * 5 + g, iso=(3, 6))
                       for v in range(NV)]
    return _PKITS[key]


# ═════════════ 지도 ═════════════
class Map4:
    def __init__(self, G, O=None, Hh=None, R=None, RAMP=None):
        self.G = np.asarray(G, np.int16)
        self.H, self.W = self.G.shape
        z = lambda v: np.zeros((self.H, self.W), np.int16) if v is None else np.asarray(v, np.int16)
        self.O, self.Hh, self.RAMP = z(O), z(Hh), (np.zeros((self.H, self.W), bool) if RAMP is None else np.asarray(RAMP, bool))
        self.R = R   # dict (x,y)->rock 이름(없으면 바닥에서 유도)
        self.face = {}
        self._compute_faces()

    def inb(self, x, y):
        return 0 <= x < self.W and 0 <= y < self.H

    def iswater(self, x, y):
        return not self.inb(x, y) or self.G[y, x] < 10

    def rock_at(self, x, y):
        if self.R and (x, y) in self.R:
            return self.R[(x, y)]
        return ROCK_OF.get(int(self.G[y, x]), 'brown')

    def _compute_faces(self):
        H, W = self.H, self.W
        for x in range(W):
            for y in range(H - 1):
                a, b = self.Hh[y, x], self.Hh[y + 1, x]
                if b < a and self.G[y, x] >= 10 and not self.RAMP[y + 1, x] and self.G[y + 1, x] >= 10 and (x, y + 1) not in self.face:
                    n = 3 if (a - b == 1 and hh(x // 4, y // 3, 71) % 5 < 2) else 2
                    cells = []
                    for j in range(n):
                        yy = y + 1 + j
                        if yy >= H or self.Hh[yy, x] != b or self.G[yy, x] < 10 or self.RAMP[yy, x]:
                            break
                        cells.append((x, yy))
                    if len(cells) >= 1:
                        rock = self.rock_at(x, y)
                        for j, c in enumerate(cells):
                            self.face[c] = (j, len(cells), rock)

    def is_face(self, x, y):
        return (x, y) in self.face


def _q_iter():
    for qy in (0, 1):
        for qx in (0, 1):
            yield qx, qy, (-1 if qx == 0 else 1), (-1 if qy == 0 else 1)


def _tex_at(g, x0, y0):
    t = TEX[g]
    return t[np.ix_((np.arange(8) + y0) % 16, (np.arange(8) + x0) % 16)]


def _pconn(M, x, y, a, b, south):
    """고원 연결: (a,b) 이웃이 나와 같은 윗면으로 이어지는가."""
    if not M.inb(a, b):
        return True
    lv = M.Hh[y, x]
    if M.G[b, a] < 10:
        return lv == 0
    ln = M.Hh[b, a]
    if ln >= lv:
        return True
    return bool(south and (M.is_face(a, b) or M.RAMP[b, a]))


def _lit(t):
    return np.clip(t.astype(np.float32) * 1.13 + 4, 0, 255).astype(np.uint8)


def ground_quadrant(M, x, y, qx, qy, sx, sy):
    g = int(M.G[y, x])
    lv = int(M.Hh[y, x])
    px0, py0 = x * 16 + qx * 8, y * 16 + qy * 8
    nbs = ((x, y + sy), (x + sx, y), (x + sx, y + sy))
    if lv > 0 and False:
        pass
    if lv > 0:
        v, h, d = (_pconn(M, x, y, a, b, sy == 1 and a == x) for (a, b) in nbs)
        if sy == 1 and v:
            d = h
        if not (v and h and d):
            role = 'iso' if (not v and not h and not d and False) else pick_role(v, h, d, qx, qy)
            cands = []
            for (a, b), ok in zip(nbs, (v, h, d)):
                if not ok and M.inb(a, b) and M.G[b, a] >= 10:
                    cands.append(int(M.G[b, a]))
            parent = Counter(cands).most_common(1)[0][0] if cands else g
            if role == 'body':
                return _lit(_tex_at(g, px0, py0))
            q = _tex_at(parent, px0, py0).copy()
            kits = plateau_kits(g, M.rock_at(x, y))
            vi = hh(x * 2 + qx, y * 2 + qy, 5 + g) % NV
            rgb, a = kits[vi][role]
            aq = a[qy * 8:(qy + 1) * 8, qx * 8:(qx + 1) * 8]
            rq = rgb[qy * 8:(qy + 1) * 8, qx * 8:(qx + 1) * 8]
            q[aq] = rq[aq]
            return q
    if g == GRASS:
        return _lit(_tex_at(GRASS, px0, py0)) if lv > 0 else _tex_at(GRASS, px0, py0).copy()

    def cn(a, b):
        if not M.inb(a, b) or M.G[b, a] < 10:
            return True
        gg = int(M.G[b, a])
        if M.Hh[b, a] != lv:
            return True
        return gg == g or PRI[gg] > PRI[g]
    v, h, d = (cn(a, b) for (a, b) in nbs)
    iso = not any(M.inb(x + a, y + b) and M.G[y + b, x + a] == g for a in (-1, 0, 1) for b in (-1, 0, 1) if (a, b) != (0, 0))
    role = 'iso' if iso else pick_role(v, h, d, qx, qy)
    cands = []
    for (a, b), ok in zip(nbs, (v, h, d)):
        if not ok and M.inb(a, b) and M.G[b, a] >= 10 and int(M.G[b, a]) != g:
            cands.append(int(M.G[b, a]))
    parent = Counter(cands).most_common(1)[0][0] if cands else GRASS
    if role == 'body':
        return _lit(_tex_at(g, px0, py0)) if lv > 0 else _tex_at(g, px0, py0).copy()
    q = _tex_at(parent, px0, py0).copy()
    rgb, a = ground_kits(g)[hh(x * 2 + qx, y * 2 + qy, 5 + g) % NV][role]
    aq = a[qy * 8:(qy + 1) * 8, qx * 8:(qx + 1) * 8]
    rq = rgb[qy * 8:(qy + 1) * 8, qx * 8:(qx + 1) * 8]
    if parent != GRASS:
        aq = aq & ~np.all(rq == hx('689e4e'), axis=2)
    q[aq] = rq[aq]
    return _lit(q) if lv > 0 else q


def render_ground(M):
    img = np.zeros((M.H * 16, M.W * 16, 3), np.uint8)
    for y in range(M.H):
        for x in range(M.W):
            if M.G[y, x] < 10:
                continue
            for qx, qy, sx, sy in _q_iter():
                px0, py0 = x * 16 + qx * 8, y * 16 + qy * 8
                img[py0:py0 + 8, px0:px0 + 8] = ground_quadrant(M, x, y, qx, qy, sx, sy)
    return img


# ═════════════ 절벽 면 ═════════════
def face_tile(rock, x, y, j, n, capL, capR):
    P = ROCK[rock]
    D = n * 16
    salt = 7 + (x // 11)
    rgb = np.zeros((16, 16, 3), np.uint8)
    alpha = np.ones((16, 16), bool)
    R = 6 + hh(x, y, 77) % 4
    for py in range(16):
        d = j * 16 + py
        for px in range(16):
            xa = x * 16 + px
            wave = 2.4 * np.sin(xa * 0.41 + salt) + 1.6 * np.sin(xa * 0.17 + 2 * salt)
            zz = abs((xa % 10) - 5) * 0.55
            u = d - 3 + wave + zz
            k = int(np.floor(u / 6.0))
            pos = u - 6 * k
            if pos < 1:
                c = P[1]
            elif pos < 2.3:
                c = P[3] if (k % 2 == 0) else P[2]
                if pos < 1.6:
                    c = P[3]
            else:
                c = P[2] if (k % 2 == 0) else P[3]
            r = hh(xa, d, 91) % 100
            if r < 7:
                c = P[1]
            elif r > 94:
                c = P[4]
            if (hh(xa // 1, 3, 55) % 13 == 0) and 2 < d < D - 2 and (d + hh(xa, 1, 57) % 5) % 9 < 5:
                c = P[1]   # 세로 금
            if d == 0:
                c = P[0]
            elif d == 1:
                c = P[4]
            elif d == 2:
                c = P[3]
            if d >= D - 4:
                c = P[1] if (d >= D - 2) else (P[2] if r < 55 else P[1])
            rgb[py, px] = c
            # 밑 울퉁불퉁(부스러기 무더기)
            s = 1 + int(1.6 * (0.5 + 0.5 * np.sin(xa * 0.9 + salt * 1.3))) + (hh(xa, 2, 61) % 3 == 0)
            if d >= D - s:
                alpha[py, px] = False
            # 둥근 끝
            for cap, ux in ((capL, px), (capR, 15 - px)):
                if cap and ux < R and d > D - R:
                    cxx, cyy = R, D - R
                    if (ux + .5 - cxx) ** 2 + (d + .5 - cyy) ** 2 > R * R:
                        alpha[py, px] = False
    # 외곽선
    out = rgb.copy()
    for py in range(16):
        for px in range(16):
            if not alpha[py, px]:
                continue
            edge = False
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                qx_, qy_ = px + dx, py + dy
                if 0 <= qx_ < 16 and 0 <= qy_ < 16 and not alpha[qy_, qx_]:
                    edge = True
            if capL and px == 0 or capR and px == 15:
                edge = True
            if edge:
                out[py, px] = P[0]
    for cap, cols in ((capL, (1,)), (capR, (14,))):
        if cap:
            for cx in cols:
                for py in range(16):
                    if alpha[py, cx] and not np.array_equal(out[py, cx], P[0]):
                        out[py, cx] = P[1]
    return out, alpha


def render_faces(M, img):
    for (x, y), (j, n, rock) in M.face.items():
        capL = (x - 1, y) not in M.face or M.face[(x - 1, y)][1] != n and False
        capL = (x - 1, y) not in M.face
        capR = (x + 1, y) not in M.face
        # 열 두께가 다른 이웃은 계단이 되므로 그 줄이 끝난 쪽만 둥글게(맨 아랫줄)
        if not capL and j == n - 1 and False:
            pass
        rgb, a = face_tile(rock, x, y, j, n, capL, capR)
        dst = img[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16]
        dst[a] = rgb[a]
        # 바닥 그림자: 맨 아랫줄 바로 밑 칸 위쪽 4px
        if j == n - 1 and M.inb(x, y + 1) and (x, y + 1) not in M.face and M.G[y + 1, x] >= 10:
            sh = img[(y + 1) * 16:(y + 1) * 16 + 4, x * 16:(x + 1) * 16]
            sh[:] = (sh.astype(float) * np.array([.80, .78, .82])[None, None, :]).astype(np.uint8)
    return img


def render_ramps(M, img):
    for y in range(M.H):
        for x in range(M.W):
            if not M.RAMP[y, x]:
                continue
            cell = img[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16]
            for sy in (3, 8, 13):
                cell[sy, 2:14] = (cell[sy, 2:14].astype(float) * .72).astype(np.uint8)
                cell[sy + 1 if sy < 15 else sy, 2:14] = np.minimum(cell[sy + 1, 2:14].astype(int) + 26, 255).astype(np.uint8)
    return img


# ═════════════ 물체(숲·산) 색조 계열 ═════════════
def tint(rgb, dh=0.0, sm=1.0, vm=1.0, keep_dark=42):
    a = rgb.astype(np.float32) / 255.0
    mx, mn = a.max(-1), a.min(-1)
    v = mx
    s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    d = np.maximum(mx - mn, 1e-6)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) / 6.0
    h = (h + dh) % 1.0
    s2 = np.clip(s * sm, 0, 1)
    v2 = np.clip(v * vm, 0, 1)
    i = np.floor(h * 6).astype(int) % 6
    f = h * 6 - np.floor(h * 6)
    p, q, t = v2 * (1 - s2), v2 * (1 - f * s2), v2 * (1 - (1 - f) * s2)
    ch = [(v2, t, p), (q, v2, p), (p, v2, t), (p, q, v2), (t, p, v2), (v2, p, q)]
    out = np.zeros_like(a)
    for k in range(6):
        m = i == k
        for c in range(3):
            out[..., c] = np.where(m, ch[k][c], out[..., c])
    out = (out * 255 + .5).astype(np.uint8)
    dark = (rgb.astype(int).sum(-1) / 3 < keep_dark)
    res = np.where(dark[..., None], (rgb.astype(np.float32) * np.array([1, 1, 1]) * min(vm, 1.0)).astype(np.uint8), out)
    return res.astype(np.uint8)


OBJ_SRC = {BROAD: (TL.FOREST, 0, 1, 1), CONIFER: (TL.FOREST, .06, .95, .70), JUNGLEF: (TL.FOREST, -.03, 1.35, 1.0),
           DEAD: (TL.FOREST, -.10, .40, .92), SNOWF: (TL.SFOREST, 0, 1, 1), MOUNT: (TL.MOUNT, 0, 1, 1),
           SMOUNT: (TL.SMOUNT, 0, 1, 1), VOLC: (TL.MOUNT, .72, .35, .60), MESA: (TL.MOUNT, -.035, 1.55, 1.05)}
_OC = {}


def obj_cell4(k, role):
    key = (k, role)
    if key not in _OC:
        src, dh, sm, vm = OBJ_SRC[k]
        rgb, a = TL.obj_cell(src, role)
        _OC[key] = (tint(rgb, dh, sm, vm) if (dh, sm, vm) != (0, 1, 1) else rgb, a)
    return _OC[key]


def render_objects(M, img):
    def conn(x, y, fam):
        if not M.inb(x, y):
            return True
        o = int(M.O[y, x])
        if M.G[y, x] < 10:
            return False
        return (o in FORESTS) if fam == 'f' else (o in MOUNTS)
    for y in range(M.H):
        for x in range(M.W):
            k = int(M.O[y, x])
            if k == NONE or M.G[y, x] < 10 or M.is_face(x, y):
                continue
            fam = 'f' if k in FORESTS else 'm'
            iso = not any(conn(x + a, y + b, fam) for a in (-1, 0, 1) for b in (-1, 0, 1) if (a, b) != (0, 0))
            for qx, qy, sx, sy in _q_iter():
                role = 'iso' if iso else pick_role(conn(x, y + sy, fam), conn(x + sx, y, fam), conn(x + sx, y + sy, fam), qx, qy)
                rgb, a = obj_cell4(k, role)
                aq = a[qy * 8:(qy + 1) * 8, qx * 8:(qx + 1) * 8]
                rq = rgb[qy * 8:(qy + 1) * 8, qx * 8:(qx + 1) * 8]
                px0, py0 = x * 16 + qx * 8, y * 16 + qy * 8
                dst = img[py0:py0 + 8, px0:px0 + 8]
                dst[aq] = rq[aq]
    return img


# ═════════════ 물 ═════════════
WPAL = [hx(c) for c in ('14386f', '1a4182', '195790', '19487d', '1f70b1', '3b95ec', '43a9e2', '60c1ed')]
LAVA_R = [hx(c) for c in ('3a0808', '5a0a0a', '7c1208', 'a01c0c', 'c8340e', 'e04a10', 'ff9a20', 'ffd060')]
TOXIC_R = [hx(c) for c in ('1e2a14', '2e3a1e', '3a4a22', '4a5e26', '647e28', '7a9a2c', '98b834', 'b8d840')]
_LAND_G = TL._LAND_G
_LAND_SH = TL._LAND_SH


def _recolor_land(q, g, px0, py0):
    if g == GRASS:
        return q
    tex = _tex_at(g, px0, py0)
    out = q.copy()
    for c in _LAND_G:
        m = np.all(q == c, axis=2)
        out[m] = tex[m]
    m = np.all(q == _LAND_SH, axis=2)
    out[m] = (tex[m] * (0.80 if g in (SNOW, GLACIER, DUNE, SAND) else 0.72)).astype(np.uint8)
    if g in (SNOW, GLACIER):
        for c, r in TL._SNOW_EDGE.items():
            out[np.all(q == np.array(c, np.uint8), axis=2)] = r
    return out


def _wg(M, x, y, sx, sy):
    for a, b in ((x, y + sy), (x + sx, y), (x + sx, y + sy)):
        if M.inb(a, b) and M.G[b, a] >= 10:
            return int(M.G[b, a])
    for a in (-1, 0, 1):
        for b in (-1, 0, 1):
            if M.inb(x + a, y + b) and M.G[y + b, x + a] >= 10:
                return int(M.G[y + b, x + a])
    return GRASS


def _ramp_recolor(q, ramp):
    out = q.copy()
    for c, r in zip(WPAL, ramp):
        out[np.all(q == c, axis=2)] = r
    return out


def water_tile(M, x, y, kind):
    tile = np.zeros((16, 16, 3), np.uint8)
    s2 = lambda a, b: (not M.inb(a, b)) or M.G[b, a] < 10
    for qx, qy, sx, sy in _q_iter():
        v, h, d = s2(x, y + sy), s2(x + sx, y), s2(x + sx, y + sy)
        row = 0 if (not v and not h) else 2 if not v else 1 if not h else 3 if not d else 4
        src = S.cell(0, row)[qy * 8:(qy + 1) * 8, qx * 8:(qx + 1) * 8]
        px0, py0 = x * 16 + qx * 8, y * 16 + qy * 8
        if row < 4:
            src = _recolor_land(src, _wg(M, x, y, sx, sy), px0, py0)
        if kind == RIVER:
            src = TL._recolor_river(src)
        elif kind == LAVA:
            src = _ramp_recolor(src, LAVA_R)
        elif kind == TOXIC:
            src = _ramp_recolor(src, TOXIC_R)
        tile[qy * 8:(qy + 1) * 8, qx * 8:(qx + 1) * 8] = src
    return tile


def render_water(M, img):
    for y in range(M.H):
        for x in range(M.W):
            k = int(M.G[y, x])
            if k >= 10:
                continue
            tile = water_tile(M, x, y, k)
            if k == RIVER:
                fr = np.zeros((16, 16))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    if M.inb(x + dx, y + dy) and M.G[y + dy, x + dx] == SEA:
                        u = np.arange(16) + .5
                        prof = (u / 16 if (dx > 0 or dy > 0) else 1 - u / 16)
                        fr = np.maximum(fr, np.tile(prof[None, :], (16, 1)) if dx else np.tile(prof[:, None], (1, 16)))
                if fr.max() > 0:
                    sea = water_tile(M, x, y, SEA)
                    bay = (BAYER[np.arange(16)[:, None] % 4, np.arange(16)[None, :] % 4] + .5) / 16
                    use = bay < (fr ** 1.3)
                    tile[use] = sea[use]
            img[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16] = tile
    return img


def sea_dist(M):
    land = (M.G >= 10) | (M.G == RIVER)
    d = ndi.distance_transform_cdt(~land, metric='chessboard').astype(np.float32)
    return d


def render_depth(M, img):
    """해안거리 → 얕은 물(청록)·깊은 물(남색) 디더. 바다 팔레트 픽셀에만."""
    d = sea_dist(M)
    d = np.where(M.G == SEA, d, 0)
    d = ndi.gaussian_filter(d, 0.6)
    big = ndi.zoom(np.pad(d, 1, mode='edge'), 16, order=1)[16 - 8:16 - 8 + M.H * 16, 16 - 8:16 - 8 + M.W * 16]
    bay = (BAYER[np.arange(M.H * 16)[:, None] % 4, np.arange(M.W * 16)[None, :] % 4] + .5) / 16
    f = big + (bay - .5) * 1.5
    seamask = np.repeat(np.repeat(M.G == SEA, 16, 0), 16, 1)
    palm = np.zeros(seamask.shape, bool)
    for c in WPAL:
        palm |= np.all(img == c, axis=2)
    palm &= seamask
    shallow = palm & (f < 2.4)
    deep = palm & (f > 6.6)
    teal = np.array([100, 210, 214], np.float32)
    img[shallow] = (img[shallow] * .62 + teal * .38).astype(np.uint8)
    img[deep] = (img[deep].astype(np.float32) * np.array([.66, .70, .86])).astype(np.uint8)
    # 산호초: 얕은 칸의 몇몇 자리
    for y in range(M.H):
        for x in range(M.W):
            if M.G[y, x] != SEA or not (1 <= d[y, x] <= 2.2) or rnd(x, y, 909) < .86:
                continue
            for i in range(5):
                cx = x * 16 + 2 + int(rnd(x, y, 910 + i) * 12)
                cy = y * 16 + 2 + int(rnd(x, y, 920 + i) * 12)
                for dx, dy, c in ((0, 0, (46, 143, 143)), (1, 0, (46, 143, 143)), (0, 1, (70, 168, 160)), (1, 1, (46, 143, 143)), (-1, 0, (196, 240, 236))):
                    if seamask[cy + dy, cx + dx] and palm[cy + dy, cx + dx]:
                        img[cy + dy, cx + dx] = c
    return img


# ═════════════ 장식 스프라이트 ═════════════
def _spr(rows, pal):
    h, w = len(rows), max(len(r) for r in rows)
    rgb = np.zeros((h, w, 3), np.uint8)
    a = np.zeros((h, w), bool)
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch in pal:
                rgb[y, x] = hx(pal[ch])
                a[y, x] = True
    return rgb, a


_SAV = dict(k='2c2a12', g='6c7c26', G='90a438', t='5a3e1c', u='7a5a2c')
_CAC = dict(k='1c3a1c', g='3a7a3c', G='5aa050', h='86c06a')
_PAL = dict(k='1c2c14', g='2c6a2c', G='4c9a3c', h='7cc45a', t='6a4a28', u='8c6a3c', c='b8843c')
_DUN = dict(l='f4e8bc', s='b4a070', d='9a8858')
_ROCK = dict(k='2a1a14', d='5a3c30', m='8a5c44', l='b08060')
_ASHR = dict(k='1c1a1e', d='3a383c', m='58555a', l='7c787c')
_LAVAC = dict(r='ff9a20', y='ffd060', o='e04a10', d='7c1208')
_PUD = dict(k='1c3a30', w='3a7a6a', h='7ac0a8')
_FLW = dict(a='f4e26a', b='f08aa0', c='ffffff', g='2c5a20')
_TUF = dict(d='2c5a30', m='44884a', l='8ac060')
_ICE = dict(k='4a86b0', w='e8fbff', c='9ad4ec')
_STUMP = dict(k='2a2018', t='6a5838', l='988660')
_BONE = dict(k='6a5c48', w='f0ead8')
_FRG = dict(k='3a3a22', a='7a8a3c', b='a0b04c')
_TOX = dict(k='1e2a14', g='7a9a2c', h='b8d840')
_SN = dict(w='ffffff', s='cfeaf6', d='9ac8dc')

SPR4 = {
    'acacia': _spr(["..kkkkkkkkk..", ".kGGgGGGGGGk.", "kGgGGGGgGGGGk", ".kkkGkkkGkkk.", ".....ktk.....", ".....ktk.....", "....kutk.....", "....kkkk....."], _SAV),
    'acacia2': _spr([".kkkkkkk.", "kGGgGGGGk", "kGGGGgGGk", ".kkkGkkk.", "....tk...", "...ktk...", "...kkk..."], _SAV),
    'cactus': _spr(["...kk...", "..kGGk..", "kk.kGk..", "kGk.kGk.", "kGGkGGk.", ".kGGGGk.", "..kGGk..", "..kGGk..", "..kkkk.."], _CAC),
    'cactus2': _spr([".kk.", "kGGk", "kGGk", "kGGk", "kkkk"], _CAC),
    'palm': _spr(["..kk.kkkk..", ".kggkgGGgk.", "kgGGgkGGgGk", ".kkGgGgkgkk", "...kgkGkk..", "....kctk...", ".....ctk...", ".....ctk...", "....kcctk..", "....kkkkk.."], _PAL),
    'dune': _spr(["...llllll...", ".lll....ssss.", "ll.......sss.", "..........ss."], _DUN),
    'dune2': _spr([".llll......", "l...ssss...", "......sss.."], _DUN),
    'rock_r': _spr([".kkk..", "kmmlk.", "kmdmkk", ".kddmk", "..kkkk"], _ROCK),
    'rock_a': _spr([".kkk..", "kmmlk.", "kmdmkk", ".kddmk", "..kkkk"], _ASHR),
    'mesa': _spr(["..kkkkk...", ".kllmmmk..", ".kmmmddk..", "kkmdddkkk.", "kdddddddk.", "kkkkkkkkk."], _ROCK),
    'lava': _spr(["..r.", "orro", ".oyr", "o.d."], _LAVAC),
    'lava2': _spr(["r..o..", ".ory.o", "o..dr.."], _LAVAC),
    'puddle': _spr([".kkkk.", "kwwwwk", "kwhwwk", ".kkkk."], _PUD),
    'flower': _spr(["a.b", ".g.", "cg."], _FLW),
    'tuft': _spr(["l.l", "mdm", ".d."], _TUF),
    'stump': _spr(["kkkk", "kllk", "ktlk", "kttk"], _STUMP),
    'bones': _spr(["w.w.", ".ww.", "w..w"], _BONE),
    'ice': _spr([".kc.", "kwck", "kwwk", "kcwk"], _ICE),
    'snowmound': _spr(["..sss..", ".swwwsd", "swwwwwd", "sdddddd"], _SN),
    'frag': _spr(["a.b", "kab", ".ka"], _FRG),
    'toxic': _spr(["gh..", "hgg.", ".kgh"], _TOX),
}
DECOR = {   # 바닥 → [(스프라이트, 확률, 배율 키)]
    GRASS: [('flower', .035), ('tuft', .05)],
    JUNGLE: [('flower', .03), ('tuft', .06)],
    SAVANNA: [('acacia', .06), ('acacia2', .05), ('tuft', .04)],
    SAND: [('cactus', .028), ('cactus2', .03), ('bones', .006)],
    DUNE: [('dune', .30), ('dune2', .18)],
    BADLANDS: [('rock_r', .08), ('mesa', .05), ('bones', .01)],
    DIRT: [('rock_r', .05), ('stump', .03)],
    ASH: [('rock_a', .08)],
    BASALT: [('lava', .22), ('lava2', .10), ('rock_a', .05)],
    SWAMP: [('puddle', .16), ('stump', .04), ('tuft', .03)],
    MARSH: [('toxic', .16), ('puddle', .05)],
    TUNDRA: [('tuft', .09), ('rock_a', .03)],
    SNOW: [('snowmound', .06), ('ice', .03)],
    GLACIER: [('ice', .12), ('snowmound', .04)],
    CRATER: [('rock_a', .10), ('lava', .05)],
    FARM: [], CROP: [], CHASM: [],
}


def render_decor(M, img, protect):
    for y in range(M.H):
        for x in range(M.W):
            g = int(M.G[y, x])
            if g < 10 or M.O[y, x] or protect[y, x] or M.is_face(x, y) or M.RAMP[y, x]:
                continue
            if rnd(x, y, 500) > .86 and False:
                continue
            u = rnd(x, y, 601)
            acc = 0
            for name, p in DECOR.get(g, []):
                acc += p
                if u < acc:
                    rgb, a = SPR4[name]
                    h, w = a.shape
                    ox = int(rnd(x, y, 602) * max(16 - w, 1))
                    oy = int(rnd(x, y, 603) * max(16 - h, 1))
                    px, py = x * 16 + ox, y * 16 + oy
                    dst = img[py:py + h, px:px + w]
                    dst[a] = rgb[a]
                    break
    return img


def render_shade4(M, img):
    """산·숲 아래(남쪽) 그림자 — 밝기 저역 노이즈는 쓰지 않고 칸 단위 그림자만."""
    return img


# ═════════════ 길 ═════════════
ROAD_STYLE = {GRASS: 'grass', JUNGLE: 'grass', FARM: 'grass', CROP: 'grass', SAVANNA: 'sand', SWAMP: 'grass', MARSH: 'grass', TUNDRA: 'grass',
              SAND: 'sand', DUNE: 'sand', DIRT: 'dirt', BADLANDS: 'dirt', ASH: 'snow', BASALT: 'snow', SNOW: 'snow', GLACIER: 'snow',
              CRATER: 'dirt', CHASM: 'dirt'}


def render_roads(M, img, road, bridge, foot, skip=()):
    import terrain_extra as X
    H, W = M.H, M.W
    R = road | foot
    for y in range(H):
        for x in range(W):
            if not road[y, x] or (x, y) in bridge or (x, y) in skip:
                continue
            style = ROAD_STYLE.get(int(M.G[y, x]), 'grass')
            kit = X.road_kits(style)[hh(x, y, 31) % len(X.ROAD_PATS)]
            rr = lambda a, b: 0 <= a < W and 0 <= b < H and bool(R[b, a])
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


def old_grid(M):
    """길찾기용: v4 코드를 terrain_lib 옛 코드로 환산."""
    t = np.full((M.H, M.W), TL.GRASS, np.int16)
    for y in range(M.H):
        for x in range(M.W):
            g = int(M.G[y, x]); o = int(M.O[y, x])
            if g == SEA: c = TL.SEA
            elif g == RIVER: c = TL.RIVER
            elif g in (LAVA, TOXIC, CHASM): c = TL.ICE
            elif o in FORESTS: c = TL.FOREST
            elif o in MOUNTS: c = TL.MOUNT
            elif g in (SNOW, GLACIER): c = TL.SNOW
            elif g in (SAND, DUNE): c = TL.SAND
            elif g in (DIRT, BADLANDS, ASH, BASALT, CRATER): c = TL.DIRT
            elif g in (SWAMP, MARSH): c = TL.MARSH
            else: c = TL.GRASS
            t[y, x] = c
    return t


def road_block(M):
    """고원 높이가 다른 이웃과 붙은 칸은 경사로가 아니면 막는다."""
    b = np.zeros((M.H, M.W), bool)
    for y in range(M.H):
        for x in range(M.W):
            if M.is_face(x, y):
                b[y, x] = True
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                a, c = x + dx, y + dy
                if M.inb(a, c) and M.G[c, a] >= 10 and M.Hh[c, a] != M.Hh[y, x] and not (M.RAMP[y, x] or M.RAMP[c, a]):
                    b[y, x] = True
    return b
