# 고딕 마을 바닥 — 버들항 칩셋 자체 타일(잔디 (0,128) · 회색 자갈 (160,96) · 흙길 (64,224))의 픽셀 결을 그대로 두고
# 밝기 순위만 고딕 램프(시든 회록 풀·청회 석재·흑회 진흙)로 옮긴다(새 노이즈로 바닥을 발명하지 않는다).
# 표본은 48 주기(3x3칸)로 이어 붙여도 이음새가 없다. 오토타일은 16변형(위1·오른2·아래4·왼8), 위층 투명 덧그림.
from gv_base import *
import terrain
from wl import edge_depth, sheet_from_cells, N_, E_, S_, W_, autotile_composed, tnoise, hash2

def chip(x, y): return np.array(terrain.CH.crop((x, y, x + 16, y + 16)).convert('RGB')).astype(np.float64)
LAWNT = chip(0, 128); COBBLE = chip(160, 96); DIRT = chip(64, 224)
def T(t, X, Y): return t[Y % 16, X % 16]
def L(a): return 0.3 * a[..., 0] + 0.59 * a[..., 1] + 0.11 * a[..., 2]
A_ = lambda R: np.array(R, np.float64)
GM, GS, MD, LR, LG, FG, BN, GP, GH = (A_(r) for r in (GMOSS, GSTONE, MUD, LEAFR, LEAFG, FOG, BONE, None or [hx('#0c0e12'), hx('#161a20'), hx('#20262e'), hx('#2c333c'), hx('#3a434e'), hx('#4e5864'), hx('#6c7682')], [hx('#2a3038'), hx('#3a424c'), hx('#4c5560'), hx('#606a76'), hx('#7a848e'), hx('#98a1aa'), hx('#b8c0c6')]))

def rank(day, lo, hi, t0=1, t1=6):
    """칩셋 화소 밝기를 램프 단(t0..t1)으로: 밝기 순위만 쓰고 색은 버린다."""
    return np.clip(np.rint(t0 + (L(day) - lo) / max(1, hi - lo) * (t1 - t0)), t0, t1).astype(int)

def _XY(n=48): return np.meshgrid(np.arange(n), np.arange(n))
def _img(rgb, a=None):
    rgb = np.clip(np.rint(rgb), 0, 255).astype(np.uint8)
    if a is None: a = np.full(rgb.shape[:2], 255, np.uint8)
    return Image.fromarray(np.dstack([rgb, a]), 'RGBA')

# ---------------------------------------------------------------- 바닥 셰이더(세계 좌표, 48 주기)
MEADOW = chip(304, 304); SHADE = chip(112, 2144); WORN = chip(16, 1776)
def _nz(seed, sc): return tnoise(48, 48, sc, seed)
def deadgrass(X, Y, seed=11):
    """시든 회록 풀: 버들항 잔디 칸(거의 평평한 결)을 GMOSS 4~5단 사이로 부드럽게 옮기고(칩 결 그대로, 과장 없음),
    초원 칸의 점 무늬를 화소마다 드문드문 섞어 잔점만 남긴다. 아주 큰 덩이(24화소)로 마른 기운이 옅게 돈다. 바랜 이삭 점."""
    x, y = X % 48, Y % 48
    l = L(T(LAWNT, X, Y)); MID = np.rint(GM[4] * 0.5 + GM[5] * 0.5)
    rgb = np.where((l < 124)[..., None], GM[4], np.where((l > 128)[..., None], MID * 0.5 + GM[5] * 0.5, MID))
    md = L(T(MEADOW, X, Y)); pick = hash2(x // 2, y, seed) > 0.80
    rgb = np.where((pick & (md < 110))[..., None], GM[3], rgb)
    rgb = np.where((pick & (md > 140))[..., None], GM[5] * 0.6 + GM[6] * 0.4, rgb)
    dry = (tnoise(48, 48, 24, seed + 1)[y, x] + (hash2(x, y, seed + 6) - 0.5) * 0.25) > 0.62
    rgb = np.where(dry[..., None], np.rint(rgb * 0.8 + LG[4] * 0.2), rgb)
    stub = hash2(x, y, seed + 3) > 0.988
    rgb = np.where(stub[..., None], LG[6], rgb)
    rgb = np.where(np.roll(stub, 1, 0)[..., None], GM[2], rgb)
    return rgb

def mudcobble(X, Y, seed=21):
    """질척한 검은 자갈길: 칩셋 자갈 결 → 청회 석재(한 단 어둡게), 돌 틈은 흑회 진흙, 틈 몇 곳에 고인 물빛, 진흙이 번진 덩이."""
    day = T(COBBLE, X, Y); l = L(day)
    t = rank(day, 60, 160, 3, 6)
    rgb = GS[t].copy()
    gap = l < 82
    rgb = np.where(gap[..., None], MD[np.clip(t - 2, 1, 2)], rgb)
    wet = gap & (hash2(X % 48 // 2, Y % 48, seed) > 0.72)
    rgb = np.where(wet[..., None], GP[3], rgb)
    smear = (tnoise(48, 48, 8, seed + 1)[Y % 48, X % 48] > 0.66) & (hash2(X % 48, Y % 48, seed + 5) > 0.45)
    rgb = np.where((smear & ~gap)[..., None], GS[t] * 0.5 + MD[np.clip(t, 1, 6)] * 0.5, rgb)
    glint = (l > 175) & (hash2(X % 48, Y % 48, seed + 2) > 0.93)
    rgb = np.where(glint[..., None], GH[5], rgb)
    return rgb

def mire(X, Y, seed=31):
    """진흙땅(걷는 평지): 칩셋 흙 결 → 흑회 진흙 램프, 젖은 윗모 빛 줄, 작은 조약돌."""
    day = T(DIRT, X, Y); t = rank(day, 60, 170, 1, 5)
    rgb = MD[t].copy()
    sheen = (t >= 4) & (hash2(X % 48 // 3, Y % 48, seed) > 0.80)
    rgb = np.where(sheen[..., None], GH[3], rgb)
    dk = (tnoise(48, 48, 6, seed + 1)[Y % 48, X % 48] > 0.6) & (hash2(X % 48, Y % 48, seed + 6) > 0.25)
    rgb = np.where(dk[..., None], MD[t] * 0.6 + MD[np.clip(t - 1, 1, 6)] * 0.4, rgb)
    peb = (hash2(X % 48, Y % 48, seed + 2) > 0.992)
    rgb = np.where(peb[..., None], GS[5], rgb)
    rgb = np.where(np.roll(peb, -1, 0)[..., None], GS[2], rgb)
    return rgb

def churchflag(X, Y, seed=41, per=16):
    """교회 앞 청회 판석: 한 칸에 두 줄(8px), 반 장 엇갈림, 위·왼 모 밝게, 줄눈에 이끼(버들항 판석 줄눈 규칙)."""
    row = Y // 8; ly = Y % 8
    off = np.where(row % 2 == 1, 5, 0)
    xo = (X + off) % per
    wid = np.where(xo < 10, 10, 6); col = np.where(xo < 10, 0, 1); lx = np.where(xo < 10, xo, xo - 10)
    hb = hash2((X + off) // per * 2 + col, row % 6, seed)
    face = GS[4] * (1 - (0.15 + 0.45 * hb))[..., None] + GS[5] * (0.15 + 0.45 * hb)[..., None]
    rgb = face.copy()
    rgb = np.where(((ly == 0) | (lx == 0))[..., None], face * 0.6 + GS[6] * 0.4, rgb)
    rgb = np.where((hash2(X % 48, Y % 48, seed + 3) < 0.04)[..., None], face * 0.7 + GS[3] * 0.3, rgb)
    joint = (ly == 7) | (lx == wid - 1)
    rgb = np.where(joint[..., None], GS[2], rgb)
    moss = joint & (tnoise(48, 48, 12, seed + 5)[Y % 48, X % 48] > 0.55) & (hash2(X % 48, Y % 48, seed + 6) > 0.35)
    rgb = np.where(moss[..., None], GM[(hash2(X % 48, Y % 48, seed + 7) * 3).astype(int) + 2], rgb)
    return rgb

def leafmold(X, Y, seed=51):
    """낙엽 썩은 흙(묘지·고목 밑 평지): 진흙 바탕에 갈적·회갈 낙엽 결이 촘촘."""
    rgb = mire(X, Y, seed)
    lf = hash2(X % 48 // 2, Y % 48, seed + 1)
    k = (lf > 0.45)
    t = (hash2(X % 48, Y % 48 // 2, seed + 2) * 4).astype(int) + 2
    pick = hash2(X % 48 // 3, Y % 48 // 2, seed + 3) > 0.5
    leaf = np.where(pick[..., None], LR[t], LG[t])
    rgb = np.where(k[..., None], leaf, rgb)
    rgb = np.where((k & ~np.roll(k, 1, 0))[..., None], leaf * 0.7 + 255 * 0.0 + LR[6] * 0.3 * pick[..., None] + LG[6] * 0.3 * (~pick)[..., None], rgb)
    return rgb

GROUNDS = {'ground-deadgrass': deadgrass, 'ground-mudcobble': mudcobble, 'ground-mire': mire, 'ground-churchflag': churchflag}
def ground_sample(name):
    X, Y = _XY(); return _img(GROUNDS[name](X, Y))
