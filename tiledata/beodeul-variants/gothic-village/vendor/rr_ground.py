# (동결 사본) rain-ruin-town/rr_ground.py — 고딕 마을이 그리기 함수를 쓰려고 복사. 경로는 gv_base 가 잡는다.
# 비 내리는 수직 폐허 도시 — 바닥·오토타일. 결정적.
# 바닥은 버들항 재료 그대로(판석 = roman.tex_flag 톤·줄눈 규칙, 자갈 = 칩셋 (160,96), 잔디 = 칩셋 (0,128))를 낮 재료로 깔고
# night_arr() 로 밤비 톤에 옮긴 뒤, 젖음을 「판석 단위」로 얹는다(판석마다 젖은 정도·윗모 하늘빛 맺힘·줄눈에 고인 물 줄).
# 노이즈 얼룩으로 바닥을 새로 만들지 않는다. 오토타일 번호 = 위1 + 오른2 + 아래4 + 왼8.
from rr_base import *
import terrain
from wl import edge_depth, sheet_from_cells, N_, E_, S_, W_, autotile_composed, tnoise

def chip(x, y): return np.array(terrain.CH.crop((x, y, x + 16, y + 16)).convert('RGB')).astype(np.float64)
COBBLE = chip(160, 96); LAWNT = chip(0, 128)
STA = np.array(ST, np.float64)
SHA = np.array(SHEEN, np.float64); PDA = np.array(PUD, np.float64); IRA = np.array(IRON, np.float64)
NMA = np.array(NMOSS, np.float64)

def _t(T, X, Y): return T[Y % 16, X % 16]

def flag_day(X, Y, seed, per=16):
    """버들항 회색 판석(낮): 판석 두 줄/칸(8px), 줄마다 엇갈림, 면 = ST4~5 사이 한 톤, 줄눈 ST3, 위·왼 모 밝게. (폐허 마을 판석과 같은 규칙)"""
    row = Y // 8; ly = Y % 8
    off = np.where(row % 2 == 1, 5, 0)
    xo = (X + off) % per
    wid = np.where(xo < 10, 10, 6)
    col = np.where(xo < 10, 0, 1); lx = np.where(xo < 10, xo, xo - 10)
    fid = col + 3 * (row % (per // 8)) + 7 * ((X + off) // per) * 0                     # 판석 번호(칸 주기 안)
    hb = hash2(col + 3 * (row % (per // 8)), row % (per // 8), seed)
    face = STA[4] * (1 - (0.12 + 0.3 * hb))[..., None] + STA[5] * (0.12 + 0.3 * hb)[..., None]
    rgb = face.copy()
    hi = (ly == 0) | (lx == 0)
    rgb = np.where(hi[..., None], face * 0.65 + STA[5] * 0.35, rgb)
    rgb = np.where((hash2(X, Y, seed + 3) < 0.035)[..., None], face * 0.5 + STA[5] * 0.5, rgb)
    joint = (ly == 7) | (lx == wid - 1)
    rgb = np.where(joint[..., None], STA[3], rgb)
    return rgb, joint, hb, lx, ly, wid

def wet_flag(X, Y, seed, moss=0.0, per=16):
    """젖은 판석(밤 공간): 판석마다 젖은 정도(어두움) · 윗모 하늘빛 맺힘 · 줄눈 몇 군데 고인 물 · 드문 반짝임. moss>0 이면 줄눈 이끼."""
    rgb, joint, hb, lx, ly, wid = flag_day(X, Y, seed, per)
    rgb = night_arr(rgb)
    wet = hash2(np.where(lx < 99, (X + np.where((Y // 8) % 2 == 1, 5, 0)) // 10, 0), Y // 8, seed + 11)
    dark = np.where(wet > 0.62, 0.74, 0.86)[..., None]
    rgb = rgb * dark
    rim = (ly == 0) & (lx >= 1) & (lx < wid - 2) & (hash2(X, Y, seed + 5) < 0.45 + 0.35 * (wet > 0.62))
    rgb = np.where(rim[..., None], rgb * 0.45 + SHA[5] * 0.55, rgb)
    rim2 = (ly == 1) & (lx >= 2) & (lx < wid - 3) & (hash2(X, Y, seed + 6) < 0.18)
    rgb = np.where(rim2[..., None], rgb * 0.6 + SHA[4] * 0.4, rgb)
    pool = joint & (hash2(X // 3, Y, seed + 7) > 0.72)
    rgb = np.where(pool[..., None], PDA[3] * 0.6 + rgb * 0.4, rgb)
    glint = (~joint) & (ly == 1) & (hash2(X, Y, seed + 8) > 0.994)
    rgb = np.where(glint[..., None], SHA[6], rgb)
    if moss:
        mj = joint & (hash2(X // 2, Y // 2, seed + 9) < moss)
        rgb = np.where(mj[..., None], NMA[(2 + hash2(X, Y, seed + 10) * 3).astype(int)], rgb)
        mf = (~joint) & (ly >= 5) & (hash2(X // 10, Y // 8, seed + 12) < moss * 0.5) & (hash2(X, Y, seed + 13) < 0.35)
        rgb = np.where(mf[..., None], rgb * 0.5 + NMA[3] * 0.5, rgb)
    return rgb, joint

def bigflag(X, Y, seed, per=None):
    """광장 큰 판석(밤 공간): 24x16 판석 엇갈려 깔기(줄마다 12px 밀림) — 옹벽 마름돌(16x8)과 크기가 달라 벽과 바닥이 섞이지 않는다.
    판석마다 톤(ST3~5), 위·왼 모 밝게, 아래·오른 모 한 줄 어둡게, 줄눈 ST2. 젖음: 판석마다 젖은 정도 · 윗모 하늘빛 · 줄눈 고인 물."""
    row = Y // 24; ly = Y % 24; off = (row % 2) * 12; col = (X + off) // 24; lx = (X + off) % 24
    if per: col = col % (per // 24); row = row % (per // 24)
    hb = hash2(col, row, seed)
    face = STA[4] * (1 - 0.35 * hb)[..., None] + STA[5] * (0.35 * hb)[..., None]          # 젖은 윗면은 하늘빛을 받아 벽보다 밝다
    rgb = face.copy()
    rgb = np.where(((ly == 0) | (lx == 0))[..., None], face * 0.6 + STA[5] * 0.4, rgb)
    rgb = np.where(((ly == 22) | (lx == 22))[..., None], face * 0.8 + STA[2] * 0.2, rgb)
    rgb = np.where((hash2(X, Y, seed + 3) < 0.05)[..., None], face * 0.6 + STA[3] * 0.4, rgb)
    crk = (hash2(col, row, seed + 13) > 0.8) & (np.abs((lx - ly * 0.7) - 4 - (hash2(col, row, seed + 14) * 10).astype(int)) < 0.6) & (ly > 3) & (ly < 20)
    rgb = np.where(crk[..., None], STA[2], rgb)
    joint = (ly == 23) | (lx == 23)
    rgb = np.where(joint[..., None], STA[2], rgb)
    rgb = night_arr(rgb)
    wet = hash2(col, row, seed + 11)
    rgb = rgb * np.where(wet > 0.6, 0.84, 0.95)[..., None]
    rim = (((ly == 1) & (lx >= 2) & (lx < 20)) | ((lx == 1) & (ly >= 2) & (ly < 12))) & (hash2(X, Y, seed + 5) < 0.3 + 0.35 * (wet > 0.6))
    rgb = np.where(rim[..., None], rgb * 0.45 + SHA[5] * 0.55, rgb)
    pool = joint & (hash2((X // 3) % 16 if per else X // 3, Y % 48 if per else Y, seed + 7) > 0.7)
    rgb = np.where(pool[..., None], PDA[3] * 0.6 + rgb * 0.4, rgb)
    glint = (~joint) & (ly == 2) & (hash2(X, Y, seed + 8) > 0.994)
    rgb = np.where(glint[..., None], SHA[6], rgb)
    return rgb

def ground_bigflag(): X, Y = _XY(); return _img(bigflag(X, Y, 75, per=48))

def wet_cobble(X, Y, seed):
    """젖은 자갈(밤 공간): 칩셋 회색 자갈 칸을 등급하고, 돌마다 밝은 윗모(칩셋 밝은 화소)를 하늘빛으로, 틈은 고인 물 빛으로."""
    day = _t(COBBLE, X, Y)
    rgb = night_arr(day)
    l = 0.3 * day[..., 0] + 0.59 * day[..., 1] + 0.11 * day[..., 2]
    top = l > 150
    rgb = np.where((top & (hash2(X, Y, seed) < 0.7))[..., None], rgb * 0.4 + SHA[5] * 0.6, rgb)
    gap = l < 70
    rgb = np.where((gap & (hash2(X // 2, Y, seed + 1) > 0.6))[..., None], rgb * 0.5 + PDA[3] * 0.5, rgb)
    rgb = np.where((top & (hash2(X, Y, seed + 2) > 0.996))[..., None], SHA[6], rgb)
    return rgb

def night_lawn(X, Y, seed):
    """젖은 잔디(밤 공간): 칩셋 잔디 칸 등급 + 잎끝 물방울 반짝임 드문드문."""
    rgb = night_arr(_t(LAWNT, X, Y))
    tip = (hash2(X, Y, seed) > 0.994) & (0.3 * _t(LAWNT, X, Y)[..., 1] > 50)
    rgb = np.where(tip[..., None], rgb * 0.5 + SHA[5] * 0.5, rgb)
    return rgb

# ---------------------------------------------------------------- 바닥 표본 48x48
def _XY(n=48): return np.meshgrid(np.arange(n), np.arange(n))
def _img(rgb, a=None):
    rgb = np.clip(np.rint(rgb), 0, 255).astype(np.uint8)
    if a is None: a = np.full(rgb.shape[:2], 255, np.uint8)
    return Image.fromarray(np.dstack([rgb, a]), 'RGBA')
def _XY(n=48): return np.meshgrid(np.arange(n), np.arange(n))

def ground_wetflag(): X, Y = _XY(); return _img(wet_flag(X, Y, 71)[0])
def ground_mossflag(): X, Y = _XY(); return _img(wet_flag(X, Y, 72, moss=0.55)[0])
def ground_wetcobble(): X, Y = _XY(); return _img(wet_cobble(X, Y, 73))
def ground_wetlawn(): X, Y = _XY(); return _img(night_lawn(X, Y, 74))

# ---------------------------------------------------------------- 웅덩이 오토타일(아래층, 투명 가장자리)
def puddle_shader(X, Y, m, n, seed):
    """판석 위 빗물 웅덩이(밤): 밖 투명 · 가장자리 1px 젖은 돌(살짝 짙음) · 안쪽은 하늘을 비춘 매끈한 물 —
    북쪽(위) 안 테에 밝은 하늘빛 한 줄, 3줄마다 가로로 길게 끌린 반사 줄(SHEEN), 그 사이 어두운 물. 이웃 칸과 이어진다."""
    rgb = np.zeros(X.shape + (3,)); alpha = m >= 0
    depth = np.clip(m, 0, 6)
    rgb[:] = PDA[3]
    rgb = np.where((depth >= 2.5)[..., None], PDA[2], rgb)
    rimc = night_arr(STA[4]) * 0.62
    rgb = np.where((depth < 1.0)[..., None], rimc, rgb)
    if not (n & N_):
        sky = (depth >= 1.0) & (depth < 2.0) & (hash2(X // 3, Y, seed + 4) > 0.55)
        rgb = np.where(sky[..., None], SHA[3] * 0.7 + PDA[3] * 0.3, rgb)
    ph = (hash2(X // 6, 0, seed + n * 0) * 3).astype(int)
    streak = (depth >= 2.0) & (((Y + ph) % 4) == 1) & (hash2(X // 5, Y, seed + 1) > 0.35)
    rgb = np.where(streak[..., None], SHA[3] * 0.6 + PDA[3] * 0.4, rgb)
    hi = (depth >= 2.0) & (((Y + ph) % 4) == 1) & (hash2(X // 3, Y, seed + 2) > 0.82)
    rgb = np.where(hi[..., None], SHA[5], rgb)
    return rgb, alpha

def _auto(shader, seed, inset, jag, rad):
    cells = []
    X, Y = np.meshgrid(np.arange(16), np.arange(16))
    for n in range(16):
        m, miss = edge_depth(n, inset, jag, rad, seed)
        rgb, alpha = shader(X, Y, m, n, seed)
        cells.append(_img(rgb, np.where(alpha, 255, 0).astype(np.uint8)))
    return sheet_from_cells(cells)

def autotile_puddle(): return _auto(puddle_shader, 81, 2.2, 0.8, 5.0)

# ---------------------------------------------------------------- 돌 배수로 오토타일(아래층, 걷기)
def _cv32():
    return Image.new('RGBA', (32, 32))
def gutter_cell(n):
    """돌 배수로: 칸 가운데를 지나는 폭 6px 홈(양쪽 돌 턱 1px — 위·왼 턱 밝음), 홈 안은 흐르는 빗물(흐름 방향 줄),
    이웃 쪽으로 홈이 이어진다. 외톨이(0)는 쇠 배수구 뚜껑(살 4줄)."""
    im = _cv32(); px = im.load(); o = 8; c0, c1 = o + 5, o + 11                      # 홈 x/y 범위 13..18
    hasN, hasE, hasS, hasW = bool(n & N_), bool(n & E_), bool(n & S_), bool(n & W_)
    NSTt = [tuple(int(v) for v in night_arr(STA[i])) for i in range(7)]
    def water(x, y, vertical):
        a_, b_ = (y, x) if vertical else (x, y)                     # a_ = 흐름 방향, b_ = 홈 가로
        t = 2
        if (a_ + b_ * 5) % 9 < 3 and b_ % 2 == 0: t = 3                # 흐름 줄(흐름 방향으로 3px 끌림)
        if (a_ + b_ * 7) % 17 == 0: t = 5
        return PUD[t]
    seg = []
    if hasN: seg.append((c0, 0, c1, c1, True))
    if hasS: seg.append((c0, c0, c1, 31, True))
    if hasW: seg.append((0, c0, c1, c1, False))
    if hasE: seg.append((c0, c0, 31, c1, False))
    if not seg:
        for y in range(o + 3, o + 13):
            for x in range(o + 3, o + 13):
                e = x in (o + 3, o + 12) or y in (o + 3, o + 12)
                c = IRON[5] if (x == o + 3 or y == o + 3) else (IRON[2] if e else (PUD[1] if (y - o) % 3 == 0 else IRON[3]))
                px[x, y] = c + (255,)
        return im
    for (x0, y0, x1, y1, v) in seg:
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                px[x, y] = water(x, y, v) + (255,)
    # 돌 턱: 홈 밖 1px — 위·왼 밝음(빛), 아래·오른 그늘
    a = np.array(im)[:, :, 3] > 0
    for y in range(32):
        for x in range(32):
            if a[y, x]: continue
            nb = [(dx, dy) for dx, dy in ((0, 1), (1, 0), (0, -1), (-1, 0)) if 0 <= x + dx < 32 and 0 <= y + dy < 32 and a[y + dy, x + dx]]
            if not nb: continue
            lit = (0, 1) in nb or (1, 0) in nb
            px[x, y] = (SHEEN[4] if lit and (x + y) % 3 else (NSTt[5] if lit else NSTt[2])) + (255,)
    return im
def autotile_gutter(): return autotile_composed(gutter_cell)

# ---------------------------------------------------------------- 쇠 난간 오토타일(위층, 막힘)
def rail_cell(n):
    """젖은 쇠 난간: 동서로 이어지면 손잡이(2px) + 아래 띠 + 살(3px 간격) + 돌 받침 턱, 남북으로 이어지면 3/4 로 본 난간 —
    세로 손잡이 줄 + 살 머리 점 + 돌 받침. 모서리·끝은 굵은 기둥과 둥근 머리. 손잡이 윗모에 빗물 맺힘."""
    im = _cv32(); px = im.load(); o = 8
    hasN, hasE, hasS, hasW = bool(n & N_), bool(n & E_), bool(n & S_), bool(n & W_)
    NSTt = [tuple(int(v) for v in night_arr(STA[i])) for i in range(7)]
    py = o + 3                                                                  # 손잡이 y (동서)
    cx = o + 7                                                                  # 기둥 x
    def P(x, y, c):
        if 0 <= x < 32 and 0 <= y < 32: px[x, y] = c + (255,)
    xs = []
    if hasW: xs += list(range(0, cx))
    if hasE: xs += list(range(cx + 2, 32))
    for x in xs:                                                                # 동서 난간
        P(x, py, SHEEN[5] if x % 4 == 0 else IRON[5]); P(x, py + 1, IRON[2])
        P(x, py + 9, IRON[3])
        if x % 3 == 1:
            for y in range(py + 2, py + 9): P(x, y, IRON[4])
        P(x, py + 10, NSTt[5]); P(x, py + 11, NSTt[4]); P(x, py + 12, NSTt[2])
    if hasN or hasS:                                                            # 남북 난간
        y0 = 0 if hasN else py; y1 = 31 if hasS else py + 10
        for y in range(y0, y1 + 1):
            P(cx, y, IRON[5] if y % 4 else SHEEN[5]); P(cx + 1, y, IRON[2])
            P(cx + 2, y, NSTt[4] if y % 2 else NSTt[3]); P(cx - 1, y, NSTt[5] if y % 5 else NSTt[3])
            if y % 4 == 2: P(cx - 1, y, IRON[3]); P(cx + 2, y, IRON[1])
    for y in range(py - 1, py + 10):                                            # 기둥(모든 칸)
        P(cx, y, IRON[5] if y < py + 1 else IRON[4]); P(cx + 1, y, IRON[2])
    P(cx, py - 2, SHEEN[5]); P(cx + 1, py - 2, IRON[4])
    for x in (cx - 1, cx, cx + 1, cx + 2): P(x, py + 10, NSTt[5]); P(x, py + 11, NSTt[3])
    return im
def autotile_ironrail(): return autotile_composed(rail_cell)

# ---------------------------------------------------------------- 옹벽 앞면(이끼 낀 젖은 마름돌) — terrain.MASONRY_FN(낮 재료)
def face_day(X, fy):
    """옹벽 낮 재료: 큰 마름돌(16x8, 줄눈 어둡게)인데 돌마다 오래된 정도가 달라 몇 개는 어둡고, 아랫단 돌 윗면에 이끼."""
    c = castle6.ash(X, fy, 0.74, bw=16, bh=8, seed=17)              # 젖은 세로 벽은 하늘을 못 받아 바닥보다 어둡다
    row = fy // 8; col = (X + (row % 2) * 8) // 16
    h = H(col, row, 23)
    if h < 0.22: c = mul(c, 0.78)
    elif h > 0.9: c = mix(c, (120, 128, 112), 0.35)
    if fy % 8 == 0 and fy > 10 and H(X // 3, row, 29) < 0.35: c = mix(c, R('moss')[4], 0.7)
    return c

def face_sample():
    """옹벽 앞면 표본 48x48(밤 공간): 갓돌 3줄 + 마름돌 + 빗물 얼룩 + 아래 이끼(terrain 옹벽과 같은 규칙)."""
    im = Image.new('RGBA', (48, 48)); px = im.load()
    for y in range(48):
        for x in range(48):
            c = face_day(x, y)
            if y < 3: c = ST[5] if y == 0 else (ST[4] if y == 1 else ST[1])
            elif y < 6: c = mul(c, 0.62)
            if y >= 45: c = ST[3] if y == 45 else ST[1]
            px[x, y] = c + (255,)
    im = night(im); p = im.load()
    drip_stains(p, 48, 48, 0, 48, 3, 44, 5, 0.2, 0.3)
    moss_foot(p, 48, 48, 0, 48, 44, 6, 10, 0.5)
    sheen_top(p, 48, 48, [(x, 0) for x in range(48) if H(x, 3) < 0.5], 1, 0.6)
    return im

TEX = {}
def tex(name):
    if name not in TEX:
        TEX[name] = {'wetflag': ground_wetflag, 'mossflag': ground_mossflag, 'wetcobble': ground_wetcobble, 'wetlawn': ground_wetlawn, 'bigflag': ground_bigflag}[name]()
    return TEX[name]
