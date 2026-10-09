# 목골 구시가 바닥 — 버들항 칩셋 자체 타일(잔디 (0,128) · 회색 자갈 (160,96) · 흙길 (64,224))의 픽셀 결을 그대로 두고
# 밝기 순위만 이 장소 램프로 옮긴다(새 노이즈로 바닥을 발명하지 않는다). 벽돌 포장·큰 포석은 버들항 판석 줄눈 규칙(위·왼 모 밝음, 줄눈 한 줄)으로 손 도트.
# 표본은 48 주기(3x3칸)로 이어 붙여도 이음새가 없다.
from eq_base import *

def chip(x, y): return np.array(terrain.CH.crop((x, y, x + 16, y + 16)).convert('RGB')).astype(np.float64)
LAWNT = chip(0, 128); COBBLE = chip(160, 96); DIRT0 = chip(64, 224); MEADOW = chip(304, 304)
def T(t, X, Y): return t[Y % 16, X % 16]
def L(a): return 0.3 * a[..., 0] + 0.59 * a[..., 1] + 0.11 * a[..., 2]
A_ = lambda Rm: np.array(Rm, np.float64)
BR, SN, PLA, BM, LF, TL = A_(BRICK), A_(STN), A_(PLAS), A_(BEAM), A_(LEAF), A_(TILE)
EARTH = A_([hx(c) for c in ('#1c140e', '#33261a', '#4a3826', '#5f4a33', '#755d42', '#8c7254', '#a48a6a')])    # 다져진 흙(바랜 갈색)
OCHRE = A_([hx(c) for c in ('#2a1e0c', '#4c3816', '#6e5222', '#8e6c30', '#a88640', '#c2a258', '#d8bc7a')])    # 연석 띠(황갈 사암)

def rank(day, lo, hi, t0=1, t1=6):
    return np.clip(np.rint(t0 + (L(day) - lo) / max(1, hi - lo) * (t1 - t0)), t0, t1).astype(int)
def _XY(n=48): return np.meshgrid(np.arange(n), np.arange(n))
def _img(rgb, a=None):
    rgb = np.clip(np.rint(rgb), 0, 255).astype(np.uint8)
    if a is None: a = np.full(rgb.shape[:2], 255, np.uint8)
    return Image.fromarray(np.dstack([rgb, a]), 'RGBA')

def lawn(X, Y, seed=11):
    """버들항 잔디 칸 그대로(초원 점 무늬를 드문드문 섞고 아주 작은 데이지 점). 채도는 grade 가 함께 덜어 준다."""
    x, y = X % 48, Y % 48
    rgb = T(LAWNT, X, Y).copy()
    md = T(MEADOW, X, Y); pick = hash2(x // 2, y, seed) > 0.82
    rgb = np.where(pick[..., None], md, rgb)
    dk = (tnoise(48, 48, 16, seed + 1)[y, x] + (hash2(x, y, seed + 6) - 0.5) * 0.25) > 0.66
    rgb = np.where(dk[..., None], rgb * 0.9, rgb)
    fl = hash2(x, y, seed + 3) > 0.992
    rgb = np.where(fl[..., None], A_(FLWR['wht'])[5], rgb)
    return rgb

def cobble(X, Y, seed=21):
    """회색 자갈길: 버들항 자갈 칸 결 → 따뜻한 회색 돌 램프(밝기 순위만), 돌 틈 흙빛, 몇 돌은 한 단 갈색."""
    day = T(COBBLE, X, Y); l = L(day)
    t = rank(day, 55, 175, 2, 5)
    rgb = SN[t] * 0.88 + EARTH[t] * 0.12
    warm = hash2(X % 48 // 4, Y % 48 // 3, seed) > 0.78
    rgb = np.where(warm[..., None], SN[t] * 0.6 + EARTH[t] * 0.4, rgb)
    gap = l < 70
    rgb = np.where(gap[..., None], SN[2] * 0.5 + EARTH[2] * 0.5, rgb)
    top = (l > 150) & (hash2(X % 48, Y % 48, seed + 7) > 0.5)                 # 돌 윗모 빛
    rgb = np.where(top[..., None], SN[5] * 0.9 + EARTH[5] * 0.1, rgb)
    return rgb

def dirt(X, Y, seed=31):
    """다져진 흙길: 버들항 흙길 칸 결 → 바랜 갈색 흙, 바퀴·발에 닳은 밝은 점, 작은 조약돌."""
    day = T(DIRT0, X, Y); t = rank(day, 60, 175, 2, 6)
    rgb = EARTH[t].copy()
    dk = (tnoise(48, 48, 12, seed + 1)[Y % 48, X % 48] > 0.62) & (hash2(X % 48, Y % 48, seed + 6) > 0.3)
    rgb = np.where(dk[..., None], EARTH[t] * 0.7 + EARTH[np.clip(t - 1, 1, 6)] * 0.3, rgb)
    peb = hash2(X % 48, Y % 48, seed + 2) > 0.988
    rgb = np.where(peb[..., None], SN[5], rgb)
    rgb = np.where(np.roll(peb, -1, 0)[..., None], SN[2], rgb)
    return rgb

def brickpave(X, Y, seed=41):
    """붉은 벽돌 포장(위에서 본 바구니 짜임): 8x8 칸마다 가로 벽돌 둘 / 세로 벽돌 둘이 번갈아(벽돌 7x3 + 줄눈 1).
    벽돌마다 단 하나 다르고 윗모만 한 단 밝게(낮은 대비 — 벽이 아니라 바닥으로 읽히게), 몇 장은 닳아 흙빛이 돈다."""
    bx = X // 8; by = Y // 8; lx = X % 8; ly = Y % 8
    horiz = ((bx + by) % 2) == 0
    sub = np.where(horiz, ly // 4, lx // 4)                  # 블록 안 벽돌 번호(0/1)
    along = np.where(horiz, lx, ly); across = np.where(horiz, ly % 4, lx % 4)
    key = (bx % 6) * 31 + (by % 6) * 7 + sub
    hb = hash2(key, 3, seed)
    t = 2 + np.floor(hb * 2.6).astype(int)
    rgb = BR[np.clip(t, 1, 6)].copy()
    rgb = np.where((across == 0)[..., None], BR[np.clip(t + 1, 1, 6)] * 0.7 + BR[np.clip(t, 1, 6)] * 0.3, rgb)
    worn = hash2(key, 5, seed + 4) > 0.86
    rgb = np.where(worn[..., None], rgb * 0.78 + EARTH[4] * 0.22, rgb)
    spk = hash2(X % 48, Y % 48, seed + 3) > 0.93
    rgb = np.where(spk[..., None], rgb * 0.9, rgb)
    joint = (across == 3) | (along == 7)
    rgb = np.where(joint[..., None], BR[1] * 0.5 + EARTH[2] * 0.5, rgb)
    return rgb

def setts(X, Y, seed=51, per=16):
    """광장 큰 포석(사암빛 회색): 한 칸에 두 줄(8화소), 반 장 엇갈림, 위·왼 모 밝게, 줄눈 한 줄, 돌마다 단이 다르다(버들항 판석 규칙)."""
    row = Y // 8; ly = Y % 8
    off = np.where(row % 2 == 1, 5, 0)
    xo = (X + off) % per
    wid = np.where(xo < 10, 10, 6); col = np.where(xo < 10, 0, 1); lx = np.where(xo < 10, xo, xo - 10)
    hb = hash2((X + off) // per * 2 + col, row % 6, seed)
    face = SN[4] * (1 - (0.2 + 0.5 * hb))[..., None] + (SN[5] * 0.7 + OCHRE[5] * 0.3) * (0.2 + 0.5 * hb)[..., None]
    rgb = face.copy()
    rgb = np.where(((ly == 0) | (lx == 0))[..., None], face * 0.8 + SN[6] * 0.2, rgb)
    rgb = np.where((hash2(X % 48, Y % 48, seed + 3) < 0.06)[..., None], face * 0.8 + SN[3] * 0.2, rgb)
    joint = (ly == 7) | (lx == wid - 1)
    rgb = np.where(joint[..., None], SN[3] * 0.7 + EARTH[3] * 0.3, rgb)
    return rgb

GROUNDS = {'ground-brickpave': brickpave, 'ground-cobble': cobble, 'ground-dirt': dirt, 'ground-lawn': lawn, 'ground-setts': setts}
def ground_sample(name):
    X, Y = _XY(); return _img(GROUNDS[name](X, Y))
