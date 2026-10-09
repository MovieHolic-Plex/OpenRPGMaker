# 미래 폐허 바닥 — 버들항 땅 섞기(ground.render: 칩셋 잔디·풀밭·그늘 풀·꽃 풀·밟힌 풀 타일을 덩이 잡음으로)와
# 칩셋 흙 타일(16,224)·모래흙(64,224)·잔 자갈(160,160)을 그대로 쓰고, 밝기 순위를 지킨 채 새 램프로 옮겨
# 콘크리트·아스팔트·오염 풀을 만든다(자체 노이즈 바닥 아님 — 칩셋의 점·결이 남는다).
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from fr_base import *
import ground as G
from fr_base import _hash
from fr_mat import TC, panels, rustify, MID

# ---------------------------------------------------------------- 칩셋 결을 새 램프로
_TX = {}
def tex(name):
    if name in _TX: return _TX[name]
    if name == 'conc':   rgb, t = recolor(chip_tex(64, 224), CONC, 3.3, 4.6)     # 고운 모래흙 결 → 콘크리트 면
    elif name == 'conc2': rgb, t = recolor(chip_tex(16, 224), CONC, 2.8, 4.6)    # 점박이 흙 결 → 거친 콘크리트(자갈 박힘)
    elif name == 'asph': rgb, t = recolor(chip_tex(160, 160), ASPH, 2.0, 4.4)    # 잔 자갈 포석 결 → 아스팔트 골재
    elif name == 'dirt': rgb = chip_tex(16, 224); t = None                        # 버들항 흙 그대로
    elif name == 'sand': rgb = chip_tex(64, 224); t = None
    _TX[name] = (rgb, t); return _TX[name]


def soft_mask(m, seed, sigma=3.0, warp=4.0, thr=.5):
    """칸 마스크(화소)를 화소 단위로 흔들고 둥글린다."""
    if not m.any(): return m
    H, W = m.shape
    Y, X = np.mgrid[0:H, 0:W]
    dx = np.rint((smooth(W, H, 9, seed) - 0.5) * 2 * warp).astype(int); dy = np.rint((smooth(W, H, 9, seed + 1) - 0.5) * 2 * warp).astype(int)
    mw = m[np.clip(Y + dy, 0, H - 1), np.clip(X + dx, 0, W - 1)]
    b = ndi.gaussian_filter(mw.astype(np.float64), sigma)
    return (b + (smooth(W, H, 4, seed + 2) - 0.5) * 0.25) > thr


def sick_grass(rgb, k):
    """버들항 풀 화소를 오염 풀(누런 올리브)로: 밝기 순위를 지킨 채 SICK 램프로 옮기고 k(0..1)만큼 섞는다."""
    l = lum(rgb.astype(np.float64))
    t = np.clip(((l - 55) / 120.0 * 5).astype(int) + 1, 1, 6)
    s = A(SICK)[t].astype(np.float64)
    return (rgb * (1 - k[..., None]) + s * k[..., None]).astype(np.uint8)


# ---------------------------------------------------------------- 콘크리트 판(32x32 줄눈) · 아스팔트 · 강철판 바닥
def concrete_px(X, Y, seed=5, per=None, slab=32):
    """콘크리트 판: 판마다 톤 ±, 줄눈(아래·오른쪽 1px 톤 2, 위·왼쪽 1px 밝은 모), 칩셋 결."""
    rgb0, t0 = tex('conc'); _, t1 = tex('conc2')
    sx = (X // slab); sy = (Y // slab); lx = X % slab; ly = Y % slab
    if per: sx = sx % (per // slab); sy = sy % (per // slab)
    h = hash2(sx, sy, seed)
    T = np.where(h < .1, t1[Y % 16, X % 16], t0[Y % 16, X % 16]).astype(int)
    T = T + np.where(h < .04, -1, 0)
    jn = ((ly == slab - 1) | (lx == slab - 1)) & (hash2(X // 4, Y // 4, seed + 6) > .12)          # 줄눈(군데군데 메워져 끊긴다)
    T = np.where(jn, np.maximum(T - 1, 2), T)
    T = np.where(((ly == 0) | (lx == 0)) & ~jn & (hash2(X // 3, Y // 3, seed + 7) > .5), np.minimum(T + 1, 6), T)
    # 가는 금(판 셋 중 하나): 판 안을 가로지르는 계단꼴 1px 선
    hc = hash2(sx, sy, seed + 11)
    u = (lx + (hc * 13).astype(int)) % slab; v = ly
    k1 = (hc < .33) & (np.abs(v - (u * (0.4 + hc) + 4 + 3 * np.sin(u / 3.0 + hc * 9)).astype(int)) == 0) & (lx > 2) & (lx < slab - 3)
    T = np.where(k1 & (ly < slab - 2), np.maximum(T - 2, 1), T)
    # 판 안 얼룩(빗물 자국): 부드러운 덩이 한 단 어둡게
    st = (vn_arr(X, Y, 4, seed + 3, per) > .84) & (hash2(X, Y, seed + 4) > .35)
    T = np.where(st & (T > 2), T - 1, T)
    return np.clip(T, 1, 6)


def vn_arr(X, Y, sc, seed, per=None):
    """vnoise 의 배열판(px2.vnoise 와 같은 값)."""
    out = np.zeros(X.shape)
    fx = X / sc; fy = Y / sc; x0 = np.floor(fx).astype(np.int64); y0 = np.floor(fy).astype(np.int64)
    tx = fx - x0; ty = fy - y0; tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty)
    if per:
        p = max(1, int(per / sc)); x1 = (x0 + 1) % p; y1 = (y0 + 1) % p; x0 = x0 % p; y0 = y0 % p
    else: x1 = x0 + 1; y1 = y0 + 1
    a = hash2(x0, y0, seed); b = hash2(x1, y0, seed); c = hash2(x0, y1, seed); d = hash2(x1, y1, seed)
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty


def asphalt_px(X, Y, seed=7, per=None):
    """아스팔트: 칩셋 잔 자갈 결을 흑회 램프로 + 군데군데 바래 밝은 덩이·기름 얼룩."""
    _, t = tex('asph')
    T = t[Y % 16, X % 16].astype(int)
    pale = (vn_arr(X, Y, 6, seed, per) > .78) & (hash2(X, Y, seed + 5) > .3)
    T = np.where(pale, T + 1, T)
    oil = vn_arr(X + 31, Y + 7, 6, seed + 1, per) > .86
    T = np.where(oil, T - 1, T)
    return np.clip(T, 1, 6)


def plate_rgb(Wp, Hp, seed=9, rust=.35, per=None):
    """강철판 바닥(16x16 판, 모서리 리벳 넷) + 녹 번짐. 반환 RGB."""
    tc = TC(Wp, Hp, seed)
    panels(tc, 0, 0, Wp, Hp, 'steel', 2, 16, 16, face='top', seed=seed, vary=0, joint=1)
    Yq, Xq = np.mgrid[0:Hp, 0:Wp]
    hp = hash2(Xq // 16, Yq // 16, seed + 3)
    tc.t = np.where((hp < .12) & (tc.t > 1) & (tc.t < 6), tc.t - 1, np.where((hp > .9) & (tc.t > 1) & (tc.t < 6), tc.t + 1, tc.t))
    # 미끄럼 막이 돌기(판 하나 걸러 사선 무늬)
    Y, X = np.mgrid[0:Hp, 0:Wp]
    tread = (hash2(X // 16, Y // 16, seed + 2) < .6) & ((X % 16) > 2) & ((X % 16) < 13) & ((Y % 16) > 2) & ((Y % 16) < 13)
    d1 = tread & ((X + Y) % 4 == 0) & ((X - Y) % 8 < 3)
    tc.t = np.where(d1, np.minimum(tc.t + 1, 6), tc.t)
    d2 = tread & ((X + Y) % 4 == 1) & ((X - Y) % 8 < 3)
    tc.t = np.where(d2, np.maximum(tc.t - 1, 1), tc.t)
    if rust: rustify(tc, 0, 0, Wp, Hp, amount=rust, seed=seed + 4, streak=False)
    tc.grain(.04)
    return np.array(tc.img())[..., :3]


# ---------------------------------------------------------------- 바닥 표본 3x3(48x48, 이음새 없음)
def ground_concrete(seed=5):
    Y, X = np.mgrid[0:48, 0:48]
    T = concrete_px(X, Y, seed, per=48, slab=16)
    a = A(CONC)[T]
    return Image.fromarray(a, 'RGB').convert('RGBA')


def ground_asphalt(seed=7):
    Y, X = np.mgrid[0:48, 0:48]
    a = A(ASPH)[asphalt_px(X, Y, seed, per=48)]
    return Image.fromarray(a, 'RGB').convert('RGBA')


def ground_steelplate(seed=9):
    return Image.fromarray(plate_rgb(48, 48, seed, rust=.12), 'RGB').convert('RGBA')


def ground_sickgrass(seed=4):
    """오염 풀(3x3): 버들항 풀밭 타일(304,304) 결을 오염 풀 램프로 + 마른 줄기 점."""
    g = tiled(chip_tex(304, 304), 48, 48).astype(np.uint8)
    a = sick_grass(g, np.full((48, 48), .9))
    Y, X = np.mgrid[0:48, 0:48]
    dot = hash2(X, Y, seed) > .975
    a = np.where(dot[..., None], A(SICK)[6], a)
    return Image.fromarray(a, 'RGB').convert('RGBA')


# ---------------------------------------------------------------- 오토타일 16변형
def autotile_crack(seed=21, pave='conc'):
    """깨진 포장 구멍: 포장(콘크리트·아스팔트) 위에 덧그린다. 속 = 드러난 흙 + 잔돌·잡초, 가장자리 = 깨진 포장 턱
    (위·왼쪽 턱은 빛 받은 콘크리트 모, 아래·오른쪽은 어두운 틈) + 바깥으로 뻗는 가는 금."""
    dirt = chip_tex(16, 224).astype(int)
    cells = []
    X, Y = np.meshgrid(np.arange(16), np.arange(16))
    for n in range(16):
        m = edge_depth(n, inset=2.6, jag=2.4, rad=5.0, seed=seed)
        rgb = dirt[Y % 16, X % 16].copy()
        rgb = (rgb * .78).astype(int)                                       # 구멍 속은 그늘
        peb = (m > 1.5) & (hash2(X, Y, seed + 3) > .86)
        rgb = np.where(peb[..., None], A(CONC)[4], rgb)
        rgb = np.where((np.roll(peb, -1, 0) & ~peb & (m > 1))[..., None], A(CONC)[2], rgb)
        weed = (m > 2.5) & (hash2(X // 2, Y // 3, seed + 4) > .8) & (hash2(X, Y, seed + 5) > .4)
        rgb = np.where(weed[..., None], A(SICK)[4], rgb)
        rgb = np.where((weed & (hash2(X, Y, seed + 6) > .6))[..., None], A(SICK)[5], rgb)
        PV = A(CONC) if pave == 'conc' else A(ASPH)
        lip_dark = (m >= 0) & (m < 1.0)
        rgb = np.where(lip_dark[..., None], PV[2] if pave == 'conc' else PV[1], rgb)
        # 깨진 턱: 구멍 밖 1~2px 띠(포장 쪽) — 빛 받은 모
        lip = (m < 0) & (m >= -1.6)
        lit = lip & ((np.roll(m, 1, 0) >= 0) | (np.roll(m, 1, 1) >= 0))
        rim = np.zeros((16, 16, 3), int); rim[:] = PV[5] if pave == 'conc' else PV[5]
        alpha = (m >= 0) | lit
        rgb = np.where((lit & (m < 0))[..., None], rim, rgb)
        # 금: 이웃 없는 쪽 가장자리에서 바깥으로 뻗는 1px 선
        crack = np.zeros((16, 16), bool)
        rng = np.random.default_rng(seed + n)
        for side in ('N', 'E', 'S', 'W'):
            bit = {'N': 1, 'E': 2, 'S': 4, 'W': 8}[side]
            if n & bit or rng.random() < .5: continue
            p = int(rng.integers(5, 11))
            for t in range(4):
                if side == 'N': crack[max(0, 2 - t), min(15, p + (t // 2))] = True
                if side == 'S': crack[min(15, 13 + t), min(15, p - (t // 2))] = True
                if side == 'W': crack[min(15, p + (t // 2)), max(0, 2 - t)] = True
                if side == 'E': crack[min(15, p - (t // 2)), min(15, 13 + t)] = True
        crack &= (m < 0)
        rgb = np.where(crack[..., None], PV[1] if pave == 'conc' else PV[0], rgb); alpha |= crack
        out = np.dstack([np.clip(rgb, 0, 255), np.where(alpha, 255, 0)]).astype(np.uint8)
        cells.append(Image.fromarray(out, 'RGBA'))
    return sheet_from_cells(cells)


def autotile_rust(seed=31):
    """녹·오염 번짐(투명 덧그림): 강철판·콘크리트 위에 붉은 갈색 녹물이 번진 자리. 속은 반투명 녹 + 진한 딱지 점,
    가장자리는 4x4 디더로 옅어지며 들쭉날쭉. 아래쪽으로 흘러내린 줄 몇 가닥."""
    BAY = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0
    cells = []
    X, Y = np.meshgrid(np.arange(16), np.arange(16))
    bay = np.tile(BAY, (4, 4))
    for n in range(16):
        m = edge_depth(n, inset=1.2, jag=2.4, rad=6.0, seed=seed)
        lvl = np.clip((m + 1.2) / 5.0, 0, 1)
        on = lvl > bay * .9 + .05
        nz = tnoise(16, 16, 4, seed + 2)
        t = np.where(nz > .55, 3, 4)
        t = np.where(hash2(X, Y, seed + 3) > .9, 2, t)
        t = np.where((hash2(X // 2, Y // 2, seed + 4) > .82) & (m > 2), 5, t)
        rgb = A(RUST)[t]
        a = np.where(on, np.where(nz > .5, 170, 120), 0)
        a = np.where(on & (hash2(X, Y, seed + 9) > .86) & (m > 1), 0, a)                  # 바탕이 비치는 구멍
        st = (hash2(X, 0, seed + 5) > .82) & (m > -3) & (m < 2.5) & (Y > 2)        # 흘러내린 줄
        a = np.where(st & ~on, 120, a); rgb = np.where((st & ~on)[..., None], A(RUST)[3], rgb)
        out = np.dstack([rgb, a]).astype(np.uint8)
        cells.append(Image.fromarray(out, 'RGBA'))
    return sheet_from_cells(cells)


def tox_px(X, Y, seed=41, per=None):
    """오염 물 속: 탁한 녹색 + 기름 무지개 막(드문 밝은 띠) + 거품 점."""
    n = vn_arr(X, Y, 7, seed, per) * .7 + vn_arr(X, Y, 3, seed + 1, per) * .3
    t = np.where(n > .64, 3, np.where(n > .38, 2, 1))
    ph = np.floor(Y + 2.0 * np.sin(X / 5.0 + vn_arr(X, Y, 10, seed + 2, per) * 6))
    on = vn_arr(X, Y, 8, seed + 3, per) > .45
    t = np.where((ph % 7 == 0) & on, 4, np.where((ph % 7 == 1) & on & (hash2(X, Y, seed + 5) > .4), 3, t))
    t = np.where((ph % 7 == 0) & on & (hash2(X // 3, Y, seed + 6) > .8), 5, t)     # 기름 막 반짝임
    bub = hash2(X, Y, seed + 4) > .985
    t = np.where(bub, 5, t)
    return t


def autotile_toxpool(seed=41):
    """오염 웅덩이(물, 막힘): 속 = 탁한 녹색 물(물결 기름띠·거품), 물가 = 진흙 턱(위·왼쪽은 그늘진 물가 앞면 2px,
    아래·오른쪽은 젖은 테) + 누런 거품 띠. 땅 위에 덧그리는 투명 가장자리."""
    cells = []
    X, Y = np.meshgrid(np.arange(16), np.arange(16))
    dirt = chip_tex(16, 224).astype(int)
    for n in range(16):
        m = edge_depth(n, inset=2.0, jag=1.8, rad=5.5, seed=seed)
        t = tox_px(X, Y, seed, per=16)
        rgb = A(TOX)[t].astype(int)
        # 북쪽 물가: 땅이 물보다 높아 앞면(진흙 벽 2px)이 보인다
        nb = (m >= 0) & (m < 2.2) & ~((n & 1) > 0) & (Y < 7)
        rgb = np.where(nb[..., None], (dirt[Y % 16, X % 16] * .55).astype(int), rgb)
        foam = (m >= 0) & (m < 1.2) & ~nb & (hash2(X, Y, seed + 7) > .3)
        rgb = np.where(foam[..., None], A(TOX)[6], rgb)
        sc = (m >= 1.2) & (m < 2.8) & ~nb & (hash2(X // 2, Y, seed + 8) > .7)            # 물가에 떠 밀린 누런 거품
        rgb = np.where(sc[..., None], A(TOX)[5], rgb)
        wet = (m < 0) & (m >= -1.4)
        rgb = np.where(wet[..., None], (dirt[Y % 16, X % 16] * .6).astype(int), rgb)
        alpha = (m >= -1.4)
        out = np.dstack([np.clip(rgb, 0, 255), np.where(alpha, 255, 0)]).astype(np.uint8)
        cells.append(Image.fromarray(out, 'RGBA'))
    return sheet_from_cells(cells)


# ---------------------------------------------------------------- 지도 바닥 합성
def compose(W, H, masks, seed=4):
    """masks: 칸 단위 bool 배열들 — 'conc','asph','plate','dirt','sick'(오염 정도 0..1 float), 'road_line'(가운데 선 칸).
    반환: RGBA Image (W*16 x H*16)."""
    Wp, Hp = W * 16, H * 16
    K = lambda m: np.kron(m, np.ones((16, 16))).astype(m.dtype if m.dtype != bool else bool)
    road = K(masks['asph'] | masks['conc'] | masks['plate'])
    grass, lab = G.render(Wp, Hp, [], road, seed=seed)
    g = np.array(grass)[..., :3]
    # 오염: 전체를 조금, sick 마스크에서 많이
    sk = ndi.gaussian_filter(K(masks['sick'].astype(float)), 14)
    k = np.clip(0.82 + sk * 0.4 + (smooth(Wp, Hp, 30, seed + 9) - .5) * .3, 0, .95)
    g = sick_grass(g, k)
    # 흙(드러난 땅)
    dm = soft_mask(K(masks['dirt']), seed + 3, 5.0, 11.0)
    d = tiled(tex('dirt')[0], Wp, Hp)
    g = np.where(dm[..., None], (d * .92).astype(np.uint8), g)
    ring = ~dm & ndi.binary_dilation(dm, iterations=3)
    Yr, Xr = np.mgrid[0:Hp, 0:Wp]
    sp = ring & (hash2(Xr, Yr, seed + 41) > .55)                                      # 흙 가장자리: 풀에 흙 알갱이가 섞인 띠
    g = np.where(sp[..., None], (d * .82).astype(np.uint8), g)
    worn = ~dm & ndi.binary_dilation(dm, iterations=6) & ~sp
    g = np.where(worn[..., None], (g * .9).astype(np.uint8), g)
    Y, X = np.mgrid[0:Hp, 0:Wp]
    out = g.copy()
    # 아스팔트
    am = K(masks['asph'])
    am = am & ~((~soft_mask(am, seed + 5, 1.2, 2.5, .5)) & (hash2(X // 2, Y // 2, seed) > .3))   # 가장자리 이빠짐
    at = asphalt_px(X, Y, seed + 7)
    out = np.where(am[..., None], A(ASPH)[at], out)
    # 콘크리트
    cm = K(masks['conc'])
    cm = cm & soft_mask(cm, seed + 6, 1.6, 4.5, .5)
    ct = concrete_px(X, Y, seed + 5)
    out = np.where(cm[..., None], A(CONC)[ct], out)
    # 줄눈에 난 오염 잡초(드문드문 짧게)
    jw = cm & (((Y % 32) == 31) | ((X % 32) == 31)) & (hash2(X // 2, Y // 2, seed + 8) > .86) & (hash2(X, Y, seed + 9) > .35)
    out = np.where(jw[..., None], A(SICK)[(3 + (hash2(X, Y, seed + 10) * 2.4)).astype(int)], out)
    # 강철판
    pm = K(masks['plate'])
    if pm.any():
        pr = plate_rgb(Wp, Hp, seed + 9, rust=.12)
        out = np.where(pm[..., None], pr, out)
    # 포장 가장자리 턱(풀 쪽으로 2px 밝은 모 + 1px 어두운 그늘)
    pav = am | cm | pm
    inner = ndi.binary_erosion(pav, iterations=1)
    edge = pav & ~inner
    below = pav & ~np.roll(pav, -1, 0)
    out = np.where(edge[..., None], A(CONC)[2], out)
    out = np.where((pav & ~np.roll(pav, 1, 0) & ~edge)[..., None], A(CONC)[5], out)
    sh = ~pav & np.roll(pav, 1, 0)                                        # 포장 아래 가장자리 밑 그림자 1px
    out = np.where(sh[..., None], (out * .7).astype(np.uint8), out)
    # 차선(가운데 점선 바랜 노랑, 가장자리 선 바랜 흰색): 칸 마스크 road_line(가로 길)
    if 'lane' in masks:
        ln = K(masks['lane']) & am
        cy = (Y % 16 == 7) | (Y % 16 == 8)
        dash = ((X // 6) % 2 == 0) & cy & ln
        worn = hash2(X, Y, seed + 21) < .32
        out = np.where((dash & ~worn)[..., None], A(WARN)[4], out)
    if 'lane_v' in masks:
        ln = K(masks['lane_v']) & am
        cx_ = (X % 16 == 7) | (X % 16 == 8)
        dash = ((Y // 6) % 2 == 0) & cx_ & ln
        worn = hash2(X, Y, seed + 22) < .32
        out = np.where((dash & ~worn)[..., None], A(WARN)[4], out)
    return Image.fromarray(out.astype(np.uint8), 'RGB').convert('RGBA'), dict(asph=am, conc=cm, plate=pm)
