# 녹청 지붕 저택가 바닥 표본 — 48 주기(3x3칸)로 이어 붙여도 이음새가 없다(세계 좌표 셰이더, 감김 잡음).
# 버들항 칩셋 바닥 칸(회색 자갈 160,96 · 흙 64,224 · 잔디 0,128 · 초원 점 304,304)의 결을 밝기 순위대로 옮기고,
# 이 장소의 새 바닥(둥근 자갈 광장·크림 보도 판석·젖은 각석)은 같은 7단 규칙(위·왼 모 밝게, 아래·오른 모 그늘, 줄눈 1~2단)으로 손 도트.
from vq_base import *

COBBLE = chip(160, 96); DIRT = chip(64, 224); LAWNT = chip(0, 128); MEADOW = chip(304, 304)
def T(t, X, Y): return t[Y % 16, X % 16]
PER = 48
def XY(n=PER): return np.meshgrid(np.arange(n), np.arange(n))
CB, FG, WT, PD, MS, LW, GV, SN, CR, TR, IR = (A_(r) for r in (COB, FLAG, WET, PUD, MOSS, LAWN, GRAV, SNOW, CREAM, TRIM, IRON))

# ---------------------------------------------------------------- 둥근 자갈(감김 보로노이 — 돌마다 한 덩이)
def _stones(per, cell, seed, jit=0.34):
    """per 주기 격자에 cell 간격으로 돌 중심을 흔들어 둔다(행마다 반 칸 엇갈림)."""
    pts = []
    n = per // cell
    for j in range(n):
        for i in range(n):
            ox = (cell / 2.0) if j % 2 else 0.0
            x = (i * cell + ox + (_h(i, j, seed) - .5) * 2 * jit * cell) % per
            y = (j * cell + (_h(i, j, seed + 1) - .5) * 2 * jit * cell * .8) % per
            pts.append((x, y, _h(i, j, seed + 2), _h(i, j, seed + 3)))
    return pts

_VOR = {}
def voronoi(per, cell, seed, sx=1.0, sy=1.0):
    """반환 (id, d1, d2, dx, dy): 가장 가까운 돌 번호, 거리 둘, 돌 중심에서의 상대 위치(감김)."""
    key = (per, cell, seed, sx, sy)
    if key in _VOR: return _VOR[key]
    X, Y = XY(per); pts = _stones(per, cell, seed)
    d1 = np.full(X.shape, 1e9); d2 = np.full(X.shape, 1e9); idx = np.zeros(X.shape, int); DX = np.zeros(X.shape); DY = np.zeros(X.shape)
    for k, (px_, py_, _, _) in enumerate(pts):
        ddx = (X + .5 - px_ + per / 2) % per - per / 2; ddy = (Y + .5 - py_ + per / 2) % per - per / 2
        d = np.hypot(ddx * sx, ddy * sy)
        closer = d < d1
        d2 = np.where(closer, d1, np.minimum(d2, d))
        idx = np.where(closer, k, idx); DX = np.where(closer, ddx, DX); DY = np.where(closer, ddy, DY)
        d1 = np.where(closer, d, d1)
    _VOR[key] = (idx, d1, d2, DX, DY, pts)
    return _VOR[key]

def cobble(X, Y, seed=11, R=None, cell=6, gapw=1.15):
    """둥근 자갈 광장: 돌마다 기본 단(3·4·4·5), 돌 안 위·왼쪽 빛(+1, 6), 아래·오른쪽 그늘(−1), 돌 틈 1~2단.
    버들항 칩셋 자갈 결(160,96)을 화소마다 드물게 섞어 같은 잔결을 낸다. 큰 덩이(24px)로 한 단씩 바래고 짙어진다."""
    R = CB if R is None else R
    idx, d1, d2, DX, DY, pts = voronoi(PER, cell, seed)
    x, y = X % PER, Y % PER
    base = np.array([3 + (1 if p[2] > .3 else 0) + (1 if p[2] > .86 else 0) for p in pts])[idx[y, x]]
    k = base.copy()
    r = d1[y, x]; dx = DX[y, x]; dy = DY[y, x]
    lit = (dx + dy) < -1.2
    k = np.where(lit, k + 1, k)
    k = np.where(lit & (r > 1.2) & (r < 2.4) & (dx < 0) & (dy < 0), 6, k)
    k = np.where((dx + dy) > 1.6, k - 1, k)
    gap = (d2[y, x] - d1[y, x]) < gapw
    k = np.where(gap, np.where(hash2(x, y, seed + 4) > .45, 2, 1), k)
    gl = chip_t(COBBLE_AT, 1, 6)[Y % 16, X % 16]
    k = np.where(~gap & (gl <= 1) & (hash2(x, y, seed + 5) > .55), k - 1, k)
    big = tnoise(PER, PER, 24, seed + 6)[y, x]
    k = np.where(~gap & (big > .8) & (hash2(x, y, seed + 7) > .5), k - 1, k)
    return R[np.clip(k, 1, 6)]

def flagstone(X, Y, seed=21):
    """크림 보도 판석: 한 줄 8px, 판 길이 16·12·20 섞임(줄마다 엇갈림), 판마다 단(4·5), 위·왼 모 밝게(6), 아래 모 3, 줄눈 2.
    판 몇 장은 금이 가고(1px 대각 3단) 몇 장은 얼룩 진다. 칩셋 흙 결을 판 위에 아주 옅게."""
    x, y = X % PER, Y % PER
    row = y // 8; ly = y % 8
    off = np.array([0, 7, 3, 11, 5, 13])[row % 6]
    xo = (x + off) % PER
    # 줄마다 판 경계 위치: 0,16,28,48 / 0,12,32,48 … (48 안에서 닫힌다)
    cuts = [(0, 16, 28), (0, 12, 32), (0, 20, 36), (0, 14, 30), (0, 18, 34), (0, 10, 26)]
    k = np.zeros(X.shape, int); lx = np.zeros(X.shape, int); wid = np.zeros(X.shape, int); pid = np.zeros(X.shape, int)
    for r in range(6):
        sel = (row % 6) == r
        c = cuts[r] + (48,)
        for i in range(3):
            s2 = sel & (xo >= c[i]) & (xo < c[i + 1])
            lx = np.where(s2, xo - c[i], lx); wid = np.where(s2, c[i + 1] - c[i], wid); pid = np.where(s2, r * 4 + i, pid)
    hb = hash2(pid, row, seed)
    k = np.where(hb > .6, 5, 4)
    k = np.where(hb < .12, 3, k)
    k = np.where((ly == 0) | (lx == 0), k + 1, k)
    k = np.where(ly == 6, k - 1, k)
    grain = rank(T(DIRT, X, Y), 60, 170, 0, 2)
    k = np.where((grain == 0) & (hash2(x, y, seed + 2) > .6), k - 1, k)
    crack = (hash2(pid, row, seed + 3) > .82) & (np.abs((lx - 3) - (ly * 1.4)).astype(int) == 0) & (ly > 0) & (ly < 6)
    k = np.where(crack, 2, k)
    joint = (ly == 7) | (lx == wid - 1)
    k = np.where(joint, 2, k)
    k = np.where(joint & (hash2(x, y, seed + 4) > .8), 1, k)
    return FG[np.clip(k, 1, 6)]

def wetstone(X, Y, seed=31):
    """젖은 각석 골목(비 갠 뒤): 8x5 각석이 줄마다 반 장 엇갈림, 청회 램프(WET) 3·4단, 윗모 하늘빛 맺힘(PUD 5),
    줄눈에 고인 물(PUD 2), 큰 덩이(16px)로 물기가 더 짙은 자리. 위·왼 빛."""
    x, y = X % PER, Y % PER
    row = y // 5 if False else y // 6; ly = y % 6
    off = np.where(row % 2 == 1, 4, 0)
    xo = (x + off) % PER; lx = xo % 8; col = xo // 8
    hb = hash2(col, row % 8, seed)
    k = np.where(hb > .55, 4, 3); k = np.where(hb > .9, 5, k)
    k = np.where((ly == 0) | (lx == 0), k + 1, k)
    k = np.where((ly == 4) | (lx == 6), k - 1, k)
    rgb = WT[np.clip(k, 1, 6)]
    wet = tnoise(PER, PER, 16, seed + 1)[y, x] > .55
    rgb = np.where((wet & (ly != 5) & (lx != 7))[..., None], rgb * .78 + PD[2] * .22, rgb)
    sheen = (ly == 1) & (lx >= 1) & (lx <= 4) & (hash2(col, row, seed + 2) > .55)
    rgb = np.where(sheen[..., None], PD[5] * .7 + WT[5] * .3, rgb)
    joint = (ly == 5) | (lx == 7)
    rgb = np.where(joint[..., None], np.where((hash2(x, y, seed + 3) > .5)[..., None], PD[2], WT[1]), rgb)
    rgb = np.where((joint & wet & (hash2(x, y, seed + 5) > .6))[..., None], PD[4], rgb)
    return rgb

def lawn(X, Y, seed=41):
    """정원 잔디: 버들항 잔디 칸 결(0,128)을 LAWN 4~5단으로, 초원 칸 점(304,304)을 드문드문(3·6단), 큰 덩이로 한 단 바랜 자리,
    겨울 끝 마른 풀 끝(누른 점)과 작은 흰 꽃."""
    x, y = X % PER, Y % PER
    l = L(T(LAWNT, X, Y))
    rgb = np.where((l < 124)[..., None], LW[4], np.where((l > 128)[..., None], LW[5] * .5 + LW[4] * .5, LW[4] * .6 + LW[5] * .4))
    md = L(T(MEADOW, X, Y)); pick = hash2(x // 2, y, seed) > .78
    rgb = np.where((pick & (md < 110))[..., None], LW[3], rgb)
    rgb = np.where((pick & (md > 140))[..., None], LW[6], rgb)
    dry = (tnoise(PER, PER, 24, seed + 1)[y, x] + (hash2(x, y, seed + 2) - .5) * .25) > .64
    rgb = np.where(dry[..., None], rgb * .8 + GV[4] * .2, rgb)
    fl = hash2(x, y, seed + 3) > .993
    rgb = np.where(fl[..., None], SN[4], rgb)
    rgb = np.where(np.roll(fl, -1, 0)[..., None], LW[2], rgb)
    return rgb

def gravel(X, Y, seed=51):
    """정원 자갈길: 버들항 흙 칸 결(64,224) → GRAV 3~5단, 잔돌(2px, 윗점 밝게·아랫점 그늘) 촘촘, 큰 덩이로 한 단."""
    x, y = X % PER, Y % PER
    t = rank(T(DIRT, X, Y), 60, 170, 3, 5)
    rgb = GV[t].copy()
    p = hash2(x, y, seed) > .80
    rgb = np.where(p[..., None], GV[6], rgb)
    rgb = np.where(np.roll(p, -1, 0)[..., None], GV[2], rgb)
    p2 = hash2(x // 2, y // 2, seed + 1) > .9
    rgb = np.where((p2 & ~p)[..., None], GV[2] * .5 + GV[3] * .5, rgb)
    big = tnoise(PER, PER, 16, seed + 2)[y, x] > .66
    rgb = np.where(big[..., None], rgb * .88, rgb)
    return rgb

GROUNDS = {'ground-cobble': cobble, 'ground-flagstone': flagstone, 'ground-wetstone': wetstone, 'ground-lawn': lawn, 'ground-gravel': gravel}
_GS = {}
def ground_sample(name):
    if name not in _GS:
        X, Y = XY(); _GS[name] = img_of(GROUNDS[name](X, Y))
    return _GS[name]

if __name__ == '__main__':
    o = Image.new('RGBA', (len(GROUNDS) * 100, 100), (30, 30, 34, 255))
    for i, n in enumerate(GROUNDS):
        g = ground_sample(n); t = Image.new('RGBA', (96, 96))
        for yy in (0, 48):
            for xx in (0, 48): t.alpha_composite(g, (xx, yy))
        o.alpha_composite(t, (i * 100 + 2, 2))
    o.resize((o.width * 3, o.height * 3), Image.NEAREST).save(os.path.join(HERE, '_qa', 'grounds.png'))
