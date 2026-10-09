# 저택·예술 도시 바닥·오토타일. 자체 노이즈로 발명한 바닥 없음: 칩셋 타일 결(창백한 마름돌 224,160 · 풀 0,128 / 304,304)의
# 밝기를 7단 램프로 옮기고, 판·벽돌 줄눈은 규칙으로 그린다. 오토타일 칸 번호 = 위 1 + 오른쪽 2 + 아래 4 + 왼쪽 8.
from mc_base import *
from mc_base import _hash

_LT = {}
def chip_l(tx, ty):
    """칩셋 타일 16x16 밝기 → 0..1 (분위)."""
    if (tx, ty) not in _LT:
        a = np.array(terrain.CH.crop((tx, ty, tx + 16, ty + 16)).convert('RGB')).astype(float)
        l = .3 * a[..., 0] + .59 * a[..., 1] + .11 * a[..., 2]
        r = np.argsort(np.argsort(l.ravel())).reshape(l.shape) / (l.size - 1)
        _LT[(tx, ty)] = r
    return _LT[(tx, ty)]


def marble_px(X, Y, sl=32, per=96):
    """광장 대리석: 32px 크림 판(판마다 결 위치를 옮김) + 줄눈, 판 네 귀가 만나는 점(64px 마다)에 포도주 마름모 상감 + 금 점."""
    g = chip_l(248, 16)
    sx, sy = X // sl, Y // sl; lx, ly = X % sl, Y % sl
    ox = int(_hash(sx % (per // sl), sy % (per // sl), 71) * 16); oy = int(_hash(sx % (per // sl), sy % (per // sl), 72) * 16)
    v = g[(Y + oy) % 16, (X + ox) % 16]
    t = 3 if v < .2 else (4 if v < .93 else 5)
    if lx == sl - 1 or ly == sl - 1: t = 2
    elif lx == 0 or ly == 0: t = min(6, t + 1)
    elif lx == sl - 2 or ly == sl - 2: t = 3
    c = MRB[t]
    hs = _hash(sx % (per // sl), sy % (per // sl), 73)
    if hs < .22 and 2 < lx < sl - 3 and 2 < ly < sl - 3:                       # 닳은 자국(버들항 광장 판석처럼 드문 어두운 타원)
        cx_ = 6 + int(_hash(sx, sy, 74) * (sl - 14)); cy_ = 5 + int(_hash(sx, sy, 75) * (sl - 12))
        if ((lx - cx_) / 4.5) ** 2 + ((ly - cy_) / 2.2) ** 2 <= 1 and t > 2: c = mix(MRB[t], MRB[2], .45)
    ex = (X + 1) % per; ey = (Y + 1) % per
    dx = min(ex, per - ex); dy = min(ey, per - ey)
    if dx + dy <= 4:
        c = WINE[3] if dx + dy > 1 else GOLD[5]
        if dx + dy == 4: c = WINE[2]
        if dx + dy == 3 and ex < per // 2 and ey < per // 2: c = WINE[4]
    return c


def brick_px(X, Y):
    """예술 거리 벽돌(바구니 짜임): 8x8 칸마다 8x4 벽돌 둘이 가로·세로로 번갈아(바둑판), 테라코타 램프(roman.TC) 2~5단,
    줄눈 2단, 벽돌 위·왼 모 +1, 칩셋 회벽 결로 드문 ±1."""
    TCr = roman.TC
    cx, cy = X // 8, Y // 8; lx, ly = X % 8, Y % 8
    horiz = (cx + cy) % 2 == 0
    a_, b_ = (ly, lx) if horiz else (lx, ly)
    if a_ in (3, 7) or b_ == 7: return TCr[2]
    h = _hash(cx % 6, cy % 6 * 2 + (a_ > 3), 81)
    t = 4 if h < .5 else (3 if h < .85 else 5)
    if a_ in (0, 4) or b_ == 0: t += 1
    v = chip_l(248, 16)[Y % 16, X % 16]
    if v < .08: t -= 1
    return TCr[clamp(t, 2, 5)]


def gravel_px(X, Y): return roman.tex_gravel(X, Y)


def lawn_px_fn():
    lawn = terrain.CH.crop((0, 128, 16, 144)).convert('RGB').load(); mead = terrain.CH.crop((304, 304, 320, 320)).convert('RGB').load()
    def f(X, Y):
        """저택 잔디(깎은 줄): 칩셋 잔디(0,128)와 밝은 풀(304,304)을 32px 띠로 번갈아(가장자리 1px 섞임)."""
        band = (X // 32) % 2
        if X % 32 == 0 and _hash(X, Y, 91) < .5: band = 1 - band
        return (mead if band else lawn)[X % 16, Y % 16]
    return f
lawn_px = lawn_px_fn()


def sample(fn, w=48, h=48, ox=0, oy=0):
    im = new(w, h); p = im.load()
    for y in range(h):
        for x in range(w): p[x, y] = tuple(fn(x + ox, y + oy)[:3]) + (255,)
    return im


def ground_marble(): return sample(lambda X, Y: marble_px(X, Y, 24, 48), 48, 48)
def ground_brick(): return sample(brick_px)
def ground_lawn(): return sample(lawn_px)


# ------------------------------------------------------------------ 오토타일
def sheet(cell):
    sh = new(64, 64)
    for m in range(16): sh.alpha_composite(cell(m), (m % 4 * 16, m // 4 * 16))
    return sh


def gravel_cell(m):
    """자갈 정원길(아래층, 걷기): 이웃 없는 쪽은 1~3px 들쭉날쭉한 풀 가장자리 + 어두운 자갈 1px 테."""
    im = new(16, 16); p = im.load()
    for y in range(16):
        for x in range(16):
            dep = 99
            for bit, d, along, s in ((1, y, x, 1), (4, 15 - y, x, 2), (8, x, y, 3), (2, 15 - x, y, 4)):
                if not (m & bit):
                    e = 1 + int(_hash(along // 2, s, 95) * 2.6)
                    dep = min(dep, d - e)
            if dep < 0: continue
            c = gravel_px(x + 37, y + 11)
            if dep < 1: c = roman.GRV[2]
            elif dep < 2: c = roman.GRV[3]
            p[x, y] = tuple(c) + (255,)
    return im


def fence_cell(m):
    """금 꼭지 쇠 울타리(위층, 막힘): 가운데 기둥(금 공) + 이웃 쪽 살. 동서 = 앞에서 본 창살(3px 간격 살 + 금 창끝 + 가로대 둘),
    남북 = 위에서 본 가로대(살 머리 금 점)."""
    c = C(16, 16, 700 + m)
    N, E, S, W = m & 1, m & 2, m & 4, m & 8
    c.group(1); c.new()
    if E or W:
        x0 = 0 if W else 8; x1 = 16 if E else 8
        for x in range(x0, x1):
            c.tone(x, 6, 'iron', 4); c.tone(x, 12, 'iron', 3)
            if x % 3 == 1:
                for y in range(4, 15): c.tone(x, y, 'iron', 3)
                c.tone(x, 3, 'gold', 6); c.tone(x, 2, 'gold', 5)
    if N or S:
        y0 = 0 if N else 8; y1 = 16 if S else 9
        for y in range(y0, y1):
            c.tone(7, y, 'iron', 4); c.tone(8, y, 'iron', 2)
            if y % 3 == 1: c.tone(7, y, 'gold', 5)
    c.group(2); c.new()
    for y in range(3, 15): c.tone(7, y, 'iron', 4); c.tone(8, y, 'iron', 2)
    c.ellipsoid(7.8, 2.6, 1.8, 1.8, 'gold', amb=.3, bias=.1)
    return pz.fin(c)


def hedge_cell(m):
    """다듬은 회양목 생울타리(위층, 막힘): 윗면(밝음) + 남쪽 앞면(어두움, 아래 그늘). 이웃 쪽으로 이어지고 끝은 둥글게."""
    c = C(16, 16, 720 + m)
    N, E, S, W = m & 1, m & 2, m & 4, m & 8
    c.group(1); c.new()
    def inside(x, y):
        x0 = 0 if W else 2; x1 = 16 if E else 14
        y0 = 0 if N else 2; y1 = 16 if S else 15
        if not (x0 <= x < x1 and y0 <= y < y1): return False
        if not W and not N and (x - 2) + (y - 2) < 2: return False
        if not E and not N and (13 - x) + (y - 2) < 2: return False
        return True
    for y in range(16):
        for x in range(16):
            if not inside(x, y): continue
            front = (not S) and y >= 10
            v = .45 - (y - 10) * .05 if front else .9 - .12 * (y / 16) + (.08 if not inside(x, y - 1) else 0) + (.06 if not inside(x - 1, y) else 0) - (.08 if not inside(x + 1, y) else 0)
            c.setv(x, y, 'boxw', v)
    return pz.fin(c)


def autotile_gravel(): return sheet(gravel_cell)
def autotile_fence(): return sheet(fence_cell)
def autotile_hedge(): return sheet(hedge_cell)


def mask_of(cells, x, y):
    return (1 if (x, y - 1) in cells else 0) | (2 if (x + 1, y) in cells else 0) | (4 if (x, y + 1) in cells else 0) | (8 if (x - 1, y) in cells else 0)


def atile(sh, m): return sh.crop((m % 4 * 16, m // 4 * 16, m % 4 * 16 + 16, m // 4 * 16 + 16))
