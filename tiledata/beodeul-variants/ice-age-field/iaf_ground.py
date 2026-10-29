# 빙하기 설원 필드 — 땅·얼음·물·빙벽·오토타일. 결정적(같은 입력 = 같은 그림).
#  눈 바닥 : 버들항 칩셋 모래흙 타일(64,224)의 점 무늬(밝기 순위)를 눈 램프 4~6 으로 옮기고(칸마다 뒤집기),
#            바람에 깎인 눈 둔덕(능선 밝은 줄 + 아래 푸른 그늘), 바람 물결(mountain-fortress 눈 결), 잔 얼음 점.
#  호수 얼음: 얼음 램프 7단. 얕은 가장자리 밝고 가운데 깊어 어둡다, 판 균열(보로노이 경계 일부), 사선 반짝 결, 갇힌 기포.
#            물가: 북쪽 둑은 눈 언덕 앞면(2px), 서쪽은 둑 그늘, 남쪽은 밝은 얼음 턱.
#  물길    : 찬 물 램프. 북쪽 가장자리에 얼음판 두께(앞면 3px), 물결 줄, 떠도는 살얼음.
#  빙벽    : 윗면 = 눈 덮인 빙하(드러난 푸른 얼음·크레바스), 앞면 = 빙하 램프 세로 결 + 가로 나이테 띠 + 균열 + 처마 눈 + 고드름,
#            발치 눈 더미와 푸른 그림자.
import math
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from iaf_base import (P, RGB, SN, IC, hash2, smooth, tnoise, tnoise1, voro, shift, chip_rank, edge_depth, sheet_from_cells,
                      BAY, soft_mask)

SNa = P('snow'); ICa = P('ice'); GLa = P('glac'); CWa = P('cwater')
_RANK = chip_rank(64, 224)                      # 0 / 0.5 / 1 세 단 — 모래흙 덩이 무늬
_RANK2 = chip_rank(16, 224)                     # 점박이 흙 — 다진 눈길 점


def _cellflip(X, Y, seed, rank, per=None):
    """칸마다 칩셋 타일을 다른 자리에서 읽는다(밀어 읽기 — 16px 반복·거울 무늬가 안 보이게). 화소별 순위 값."""
    cx = X // 16; cy = Y // 16
    if per: cx = cx % (per // 16); cy = cy % (per // 16)
    ox = (hash2(cx, cy, seed) * 16).astype(int); oy = (hash2(cx, cy, seed + 1) * 16).astype(int)
    return rank[(Y + oy) % 16, (X + ox) % 16]


def _n(W, H, sc, seed, per):
    if per: return tnoise(W, H, sc, seed)
    return smooth(W, H, sc, seed)


# ================================================================ 눈 바닥
def snow_tone(Wp, Hp, seed=31, per=None, X0=0, Y0=0):
    """눈 바닥 톤(0..6, 눈 램프). per=48 이면 주기(표본). 반환 int 배열.
    바탕 5. 칩셋 모래흙 결의 어두운 덩이는 군데군데만 4(옅은 그늘 점), 밝은 덩이는 6.
    바람에 깎인 눈 둔덕: 잡음 등고선 따라 휜 가는 능선 — 능선 1px 밝음(6), 그 아래 2~4px 그늘(4, 끝은 디더)."""
    Y, X = np.mgrid[0:Hp, 0:Wp]; X = X + X0; Y = Y + Y0
    r = _cellflip(X, Y, seed, _RANK, per)
    nl = _n(Wp, Hp, 16 if per else 30, seed + 3, per)
    nk = _n(Wp, Hp, 8 if per else 9, seed + 4, per)
    T = np.full((Hp, Wp), 5, int)
    T = np.where((r < 0.25) & (nk > 0.58), 4, T)
    # 둔덕 능선(사스트루기): 손으로 긋듯 휜 짧은 획 — 능선 1px 밝음(6), 아래 2~3px 그늘(4), 획 끝은 가늘어진다
    crest = np.zeros((Hp, Wp), bool); sh = np.zeros((Hp, Wp), bool)
    gw, gh = 40, 26
    nx_, ny_ = (per // 16 if per else Wp // gw + 2), (per // 16 if per else Hp // gh + 2)
    if per: gw = gh = 16
    dens = _n(Wp, Hp, 16 if per else 60, seed + 9, per)
    for j in range(-1, ny_ + 1):
        for i in range(-1, nx_ + 1):
            ii = i % nx_ if per else i; jj = j % ny_ if per else j
            if hash2(ii, jj, seed + 11) > (0.55 if per else 0.62): continue
            cx = (i + hash2(ii, jj, seed + 12)) * gw + X0 * 0; cy = (j + hash2(ii, jj, seed + 13)) * gh
            px_ = int(cx) % Wp if per else int(cx); py_ = int(cy) % Hp if per else int(cy)
            if not per and (0 <= py_ < Hp and 0 <= px_ < Wp) and dens[py_, px_] < 0.35: continue
            L = int(10 + hash2(ii, jj, seed + 14) * (14 if per else 26)); bend = (hash2(ii, jj, seed + 15) - 0.5) * 0.25
            lean = (hash2(ii, jj, seed + 16) - 0.5) * 0.18
            for k in range(L):
                f = k / max(1, L - 1)
                x = int(cx - L / 2 + k); y = int(round(cy + lean * (k - L / 2) + bend * (k - L / 2) ** 2 / max(1, L) * 2))
                th = 3 if 0.2 < f < 0.8 else (2 if 0.08 < f < 0.92 else 1)
                for d in range(0, th + 1):
                    yy = y + d; xx = x
                    if per: yy %= Hp; xx %= Wp
                    if 0 <= yy < Hp and 0 <= xx < Wp:
                        if d == 0: crest[yy, xx] = True
                        else: sh[yy, xx] = True
    T = np.where(sh & ~crest, 4, T)
    T = np.where(crest, 6, T)
    # 바람 물결: 가로로 휜 가는 줄(4) + 바로 위 밝은 턱(6) — 군데군데만
    wv = tnoise1(per if per else Wp + 16, 16, seed + 7)[X % per if per else X]
    ph = (Y + np.rint(wv * 6).astype(int))
    on2 = _n(Wp, Hp, 8 if per else 12, seed + 8, per) > 0.74
    rip = on2 & (ph % 9 == 0) & (hash2(X // 5, Y, seed + 10) > 0.40) & ~sh & ~crest
    T = np.where(rip, 4, T)
    T = np.where(np.roll(rip, -1, 0) & ~rip & ~sh, 6, T)
    return np.clip(T, 2, 6)


def snow_rgb(Wp, Hp, seed=31, per=None):
    T = snow_tone(Wp, Hp, seed, per)
    rgb = SNa[T].copy()
    Y, X = np.mgrid[0:Hp, 0:Wp]
    PX = X % per if per else X; PY = Y % per if per else Y
    g = hash2(PX, PY, seed + 11)
    glint = (g > 0.9965)
    rgb[glint] = ICa[5]                                                  # 잔 얼음 점(밝은 하늘빛)
    rgb[np.roll(glint, 1, 1) & ~glint] = ICa[4]
    speck = (g < 0.0035)
    rgb[speck] = SNa[3]                                                  # 잔 그늘 점
    return rgb


# ================================================================ 호수 얼음 (걷는 얼음판)
def ice_layer(mask, seed=41, per=None, X0=0, Y0=0, d_in=None):
    """mask(px) 안을 언 호수 얼음으로. 가장자리 물가 규칙 포함. RGBA."""
    Hp, Wp = mask.shape
    Y, X = np.mgrid[0:Hp, 0:Wp]; X = X + X0; Y = Y + Y0
    PX = X % per if per else X; PY = Y % per if per else Y
    if d_in is None: d_in = ndi.distance_transform_edt(mask) if not per else np.full((Hp, Wp), 30.0)
    T = np.full((Hp, Wp), 3, int)
    bay = np.tile(BAY, (Hp // 4 + 1, Wp // 4 + 1))[:Hp, :Wp]
    if per: n1 = tnoise(Wp, Hp, 16, seed)
    else: n1 = smooth(Wp, Hp, 30, seed) * 0.7 + smooth(Wp, Hp, 10, seed + 9) * 0.3
    # 얕은 물가는 밝다(4), 가운데 깊은 곳은 어둡다(2) — 경계는 디더
    sh_ = np.clip(1 - d_in / 18.0, 0, 1) * 0.8 + (n1 - 0.5) * 0.5
    T = np.where(sh_ > 0.45 + bay * 0.2, 4, T)
    dp = np.clip((d_in - 22) / 20.0, 0, 1) * 0.8 + (0.5 - n1) * 0.6
    T = np.where(dp > 0.40 + bay * 0.25, 2, T)
    # 판 균열: 큰 보로노이 경계 일부(열린 금), 금 1px 1톤, 바로 아래 1px 밝은 턱
    d1, d2, rid = voro(PX, PY, 40 if not per else 24, 28 if not per else 24, seed + 2, per)
    pair = hash2(rid % 9973, 7, seed + 3)
    along = hash2(PX // 7, PY // 7, seed + 4)
    crack = ((d2 - d1) < 0.045) & (pair > 0.55) & (along > 0.22)
    T = np.where(crack, np.maximum(1, T - 2), T)
    T = np.where(np.roll(crack, 1, 0) & ~crack, 5, T)
    # 잔 금(짧은 사선)
    seedpt = (hash2(PX // 13, PY // 11, seed + 5) > 0.80) & ((PX % 13) == 3) & ((PY % 11) == 2)
    scr = np.zeros_like(seedpt)
    for k in range(5): scr |= shift(seedpt, k, k // 2)
    T = np.where(scr & ~crack, np.maximum(1, T - 2), T)
    # 반짝 결: 짧은 흰 사선(4~7px) 드문드문 — 칸(24x16)마다 많아야 하나
    st = np.zeros((Hp, Wp), bool)
    gx_, gy_ = (PX // 24), (PY // 16)
    ox_ = (hash2(gx_, gy_, seed + 10) * 18).astype(int); oy_ = (hash2(gx_, gy_, seed + 11) * 12).astype(int)
    Ls = 4 + (hash2(gx_, gy_, seed + 12) * 4).astype(int)
    rx_ = PX % 24 - ox_; ry_ = PY % 16 - oy_
    on_ = (hash2(gx_, gy_, seed + 13) > 0.80) & (rx_ >= 0) & (rx_ < Ls) & (ry_ == -(rx_ // 2))
    st |= on_
    st &= ~crack
    T = np.where(st, 6, T)
    T = np.where(shift(st, 0, 1) & ~st & ~crack, 5, T)
    # 갇힌 기포(작은 흰 점)
    bub = (hash2(PX // 2, PY, seed + 7) > 0.994) & ~crack
    T = np.where(bub, 6, T)
    rgb = ICa[np.clip(T, 0, 6)].copy()
    # 눈가루 번짐(물가 가까이, 디더)
    dust = (_n(Wp, Hp, 10 if per else 14, seed + 8, per) * 0.5 + np.clip(1 - d_in / 9.0, 0, 1) * 0.7) > (0.66 + bay * 0.25)
    rgb = np.where(dust[..., None], SNa[5], rgb)
    rgb = np.where((dust & ~np.roll(dust, -1, 0))[..., None], SNa[4], rgb)
    # 물가 규칙
    up = shift(mask, 0, 1); up2 = shift(mask, 0, 2); dn = shift(mask, 0, -1); lf = shift(mask, 1, 0); lf2 = shift(mask, 2, 0); rt = shift(mask, -1, 0)
    north1 = mask & ~up; north2 = mask & up & ~up2
    rgb = np.where(north1[..., None], SNa[3], rgb)                       # 북쪽 둑 눈 언덕 앞면(그늘)
    rgb = np.where(north2[..., None], ICa[1], rgb)                       # 둑 밑 얼음 그늘
    west = mask & (~lf | ~lf2) & ~north1
    rgb = np.where(west[..., None], np.where((~lf)[..., None], SNa[4], ICa[2]), rgb)
    south = mask & ~dn
    rgb = np.where(south[..., None], ICa[5], rgb)
    east = mask & ~rt & ~north1 & ~south
    rgb = np.where(east[..., None], ICa[4], rgb)
    out = np.zeros((Hp, Wp, 4), np.uint8); out[..., :3] = rgb; out[..., 3] = np.where(mask, 255, 0)
    # 남쪽 둑 밖 1px: 눈 턱의 밝은 테
    sl = shift(mask, 0, 1) & ~mask
    out[sl] = list(SNa[6]) + [255]
    return Image.fromarray(out, 'RGBA').copy()


# ================================================================ 얼음 틈 물길 (막힘)
def water_layer(mask, seed=51, per=None, X0=0, Y0=0, shelf=3):
    Hp, Wp = mask.shape
    Y, X = np.mgrid[0:Hp, 0:Wp]; X = X + X0; Y = Y + Y0
    PX = X % per if per else X; PY = Y % per if per else Y
    d_in = ndi.distance_transform_edt(mask) if not per else np.full((Hp, Wp), 20.0)
    T = np.where(d_in > 12, 2, 3)
    T = np.where((d_in > 6) & (d_in <= 12) & (BAY[PY % 4, PX % 4] < 0.5), 2, T)
    T = np.where((d_in > 18) & (BAY[PY % 4, PX % 4] < 0.4), 1, T)
    wv = tnoise1(per if per else Wp + 16, 16, seed)[PX]
    rip = (((PY + np.rint(wv * 3).astype(int)) % 6) == 0) & (hash2(PX // 6, PY // 6, seed + 1) > 0.45) & ((PX % 6) < 4)
    T = np.where(rip, 4, T)
    T = np.where(np.roll(rip, -1, 0) & ~rip, np.maximum(T - 1, 0), T)
    rgb = CWa[T].copy()
    # 살얼음 조각(1~3px, 위 밝고 아래 그늘)
    sl = (hash2(PX // 3, PY // 3, seed + 2) > 0.93) & ((PX % 3) < 2) & ((PY % 3) == 1) & (d_in > 3)
    rgb[sl] = ICa[4]
    rgb[np.roll(sl, 1, 0) & ~sl] = CWa[0]
    # 가장자리: 북쪽 = 얼음판 두께(앞면) shelf px, 서쪽 = 그늘, 남·동 = 밝은 얼음 턱 + 물에 비친 줄
    ups = [shift(mask, 0, k) for k in range(1, shelf + 2)]
    for k in range(shelf, 0, -1):
        band = mask & ~ups[k - 1] if k == 1 else mask & ups[k - 2] & ~ups[k - 1]
        rgb = np.where(band[..., None], [ICa[3], ICa[2], ICa[1], ICa[1]][k - 1], rgb)
    under = mask & ups[shelf - 1] & ~ups[shelf]
    rgb = np.where(under[..., None], CWa[0], rgb)
    lf = shift(mask, 1, 0); dn = shift(mask, 0, -1); rt = shift(mask, -1, 0)
    rgb = np.where((mask & ~lf & ups[shelf])[..., None], CWa[0], rgb)
    s1 = mask & ~dn
    rgb = np.where(s1[..., None], ICa[5], rgb)
    rgb = np.where((mask & dn & ~shift(mask, 0, -2))[..., None], CWa[4], rgb)
    rgb = np.where((mask & ~rt & ups[shelf] & ~s1)[..., None], ICa[4], rgb)
    out = np.zeros((Hp, Wp, 4), np.uint8); out[..., :3] = rgb; out[..., 3] = np.where(mask, 255, 0)
    return Image.fromarray(out, 'RGBA').copy()


# ================================================================ 빙벽(빙하 윗면 + 앞면)
def glacier_layer(GT, FH, Wc, seed=61):
    """GT[x] = 빙하 윗면 마지막 칸 줄, FH[x] = 앞면 줄 수. 반환 (RGBA 지도 크기 높이는 max(GT+FH+2)칸, 앞면 화소 마스크, 윗면 마스크)."""
    Hc = max(GT[x] + FH[x] for x in range(Wc)) + 3
    Wp, Hp = Wc * 16, Hc * 16
    X = np.arange(Wp)
    # 열마다 처마 높이(화소) — 칸 경계에서 계단 지는 대신 잡음으로 들쭉날쭉
    lipc = np.array([(GT[x] + 1) * 16 for x in range(Wc)], float)
    lip = np.repeat(lipc, 16)
    lip = np.convolve(np.pad(lip, 5, mode='edge'), np.ones(11) / 11.0, mode='valid')   # 처마 높이가 바뀌는 곳은 비스듬히
    lip = lip + np.rint((tnoise1(Wp, 6, seed) - 0.5) * 5 + (tnoise1(Wp, 2, seed + 1) - 0.5) * 2)
    bot = np.repeat(np.array([(GT[x] + 1 + FH[x]) * 16 for x in range(Wc)], float), 16)
    Y = np.arange(Hp)[:, None]
    top_m = Y < lip[None, :]
    face_m = (Y >= lip[None, :]) & (Y < bot[None, :])
    rgb = np.zeros((Hp, Wp, 3), np.uint8)
    # ---- 윗면: 눈 바닥 + 드러난 푸른 얼음 + 크레바스(가로 줄)
    st = snow_tone(Wp, Hp, seed + 3)
    top = SNa[st].copy()
    Yg, Xg = np.mgrid[0:Hp, 0:Wp]
    ex = (np.array(Image.fromarray((smooth(Wp // 3 + 3, Hp, 12, seed + 4) * 255).astype(np.uint8)).resize((Wp, Hp), Image.BILINEAR)) / 255.0 * 0.8 + smooth(Wp, Hp, 7, seed + 5) * 0.2) > 0.80
    eT = np.where(smooth(Wp, Hp, 6, seed + 6) > 0.5, 4, 5)
    top = np.where(ex[..., None], GLa[eT], top)
    top = np.where((ex & ~np.roll(ex, -1, 0))[..., None], GLa[3], top)
    top = np.where((ex & ~np.roll(ex, 1, 0))[..., None], SNa[6], top)
    # 크레바스: 가로로 길게 휜 금(어두운 틈 + 위 밝은 턱 + 아래 그늘)
    for i in range(int(Wp / 70)):
        cx = (i + 0.5) * 70 + (hash2(i, 1, seed) - 0.5) * 40; L = 26 + hash2(i, 2, seed) * 30
        x0, x1 = int(cx - L / 2), int(cx + L / 2)
        if x1 < 0 or x0 >= Wp: continue
        base = lip[max(0, min(Wp - 1, int(cx)))] - 12 - hash2(i, 3, seed) * max(0, lip[max(0, min(Wp - 1, int(cx)))] - 30)
        for x in range(max(0, x0), min(Wp, x1)):
            f = (x - x0) / max(1, x1 - x0)
            w = 1 + int(2.2 * math.sin(math.pi * f))
            yc = int(base + 3 * math.sin(x / 9.0 + i))
            if yc - 2 < 0 or yc + w + 2 >= lip[x] - 4: continue
            top[yc - 1, x] = SNa[6]
            for k in range(w): top[yc + k, x] = GLa[1] if k < w - 1 else GLa[2]
            top[yc + w, x] = GLa[4]
    rgb = np.where(top_m[..., None], top, rgb)
    # ---- 앞면: 세락(얼음 덩이) 기둥들 — 덩이마다 왼쪽 2~3px 밝은 면, 몸 3~4톤 세로 잔결, 오른쪽 1~2px 그늘, 덩이 사이 어두운 틈.
    #      덩이 몇은 중간에서 한 번 물러나(턱) 밝은 턱 줄 + 턱 위 눈. 가로 나이테 띠(밝은 기포층·어두운 층), 출렁이는 흙 띠 하나.
    fy = (Y - lip[None, :])
    FHp = (bot - lip)[None, :]
    k = fy / np.maximum(1, FHp)
    rs = np.random.default_rng(seed + 10)
    edges = [0]
    while edges[-1] < Wp:
        edges.append(edges[-1] + int(rs.integers(8, 36)))
    bid = np.zeros(Wp, int); bx0 = np.zeros(Wp, int); bx1 = np.zeros(Wp, int)
    for i in range(len(edges) - 1):
        bid[edges[i]:edges[i + 1]] = i; bx0[edges[i]:edges[i + 1]] = edges[i]; bx1[edges[i]:edges[i + 1]] = min(Wp, edges[i + 1])
    nb = len(edges)
    bt = np.array([int(rs.integers(0, 3)) for _ in range(nb)])           # 덩이 밝기 -1..+1
    step = np.array([rs.uniform(0.25, 0.6) if rs.random() < 0.35 else -1 for _ in range(nb)])   # 턱 높이(비율)
    lx = X - bx0; rx = bx1 - 1 - X                                        # 덩이 안 왼쪽/오른쪽 거리
    fine = tnoise1(Wp, 2, seed + 11)
    t = 3.4 + (bt[bid] - 1) * 0.6 + (fine - 0.5) * 1.1
    t = np.broadcast_to(t[None, :], (Hp, Wp)).copy()
    t = t + (0.6 - 1.6 * k)                                               # 위 밝고 아래 어둡다
    prot = np.array([rs.random() < 0.6 for _ in range(nb)])[bid]        # 앞으로 나온 덩이만 모서리 빛·그늘
    t = np.where(((lx < 2) & prot)[None, :], t + 1.6, np.where(((lx < 4) & prot)[None, :], t + 0.7, t))
    t = np.where(((rx < 2) & prot)[None, :], t - 1.1, t)
    # 덩이 윗부분 빗면: 왼쪽 위 삼각이 밝다(빛 왼쪽 위)
    wbl = np.maximum(1, bx1 - bx0)[None, :]
    t = np.where((fy < (12 - lx[None, :] * 12 / wbl)) & prot[None, :], t + 0.9, t)
    wob = (smooth(Wp, Hp, 20, seed + 13) - 0.5) * 6 + (smooth(Wp, Hp, 5, seed + 14) - 0.5) * 2
    lay = (fy + wob)
    li = np.floor(lay / 12).astype(int)
    band_lit = (np.floor(lay) % 12 == 0) & (hash2(Xg // 6, li, seed + 15) > 0.30)
    band_dk = (np.floor(lay) % 12 == 1) & (hash2(Xg // 6, li, seed + 15) > 0.30)
    t = np.where(band_lit, t + 1.1, np.where(band_dk, t - 0.8, t))
    # 턱: 그 높이에서 1px 밝은 줄(6) + 바로 위 눈 2px, 턱 아래 1px 그늘
    stp = step[bid][None, :]
    ledge = (stp > 0) & (np.abs(k - stp) * FHp < 0.6)
    T = np.clip(np.rint(t), 1, 6).astype(int)
    fr = GLa[T].copy()
    sed = (np.abs(lay - FHp * 0.66) < 1.0) & (smooth(Wp, Hp, 11, seed + 16) > 0.62) & (T >= 3)     # 흙 띠: 군데군데 끊긴 옅은 띠
    fr = np.where(sed[..., None], GLa[2], fr)
    fr = np.where(ledge[..., None], SNa[6], fr)
    above = (stp > 0) & (((stp - k) * FHp >= 0.6) & ((stp - k) * FHp < 2.6)) & (hash2(Xg // 3, 1, seed + 17) > 0.25)
    fr = np.where(above[..., None], SNa[5], fr)
    below = (stp > 0) & (((k - stp) * FHp >= 0.6) & ((k - stp) * FHp < 2.0))
    fr = np.where(below[..., None], GLa[1], fr)
    # 덩이 사이 틈(어두운 1~2px, 위로 갈수록 좁다)
    gk = np.array([rs.uniform(0.0, 0.5) if rs.random() < 0.65 else 2.0 for _ in range(nb)])[bid][None, :]
    gap = ((lx == 0)[None, :] & (k > gk)) | (((lx == 1)[None, :]) & (k > gk + 0.3) & prot[None, :])
    fr = np.where((gap & (fy > 2))[..., None], GLa[0], fr)
    # 사선 잔 금
    cr = np.zeros((Hp, Wp), bool)
    for i in range(int(Wp / 11)):
        x0 = int(rs.integers(0, Wp - 8)); kk = rs.uniform(0.15, 0.9); L = int(rs.integers(3, 8)); d = int(rs.choice([-1, 1]))
        y0 = int(lip[x0] + kk * FHp[0, x0])
        for j in range(L):
            xx = x0 + j; yy = y0 + d * (j // 2)
            if 0 <= xx < Wp and 0 <= yy < Hp and face_m[yy, xx]: cr[yy, xx] = True
    fr = np.where(cr[..., None], GLa[1], fr)
    fr = np.where((shift(cr, 0, 1) & ~cr)[..., None], GLa[5], fr)
    # 처마: 눈 처마(윗 3~4px) + 바로 밑 그늘 줄 + 고드름
    cor = tnoise1(Wp, 4, seed + 18)
    corn_h = 3 + np.rint(cor * 2).astype(int)
    fr = np.where((fy < 1), SNa[6][None, None, :], fr) if False else fr
    for x in range(Wp):
        L0 = int(lip[x])
        for j in range(corn_h[x] + 1):
            y = L0 + j
            if 0 <= y < Hp: fr[y, x] = SNa[6] if j == 0 else (SNa[5] if j < corn_h[x] - 1 else (SNa[3] if j < corn_h[x] else GLa[1]))
    rgb = np.where(face_m[..., None], fr, rgb)
    alpha = top_m | face_m
    out = np.zeros((Hp, Wp, 4), np.uint8); out[..., :3] = rgb; out[..., 3] = np.where(alpha, 255, 0)
    im = Image.fromarray(out, 'RGBA').copy()
    px = im.load()
    # 고드름(처마 밑으로 2~10px, 왼 밝음 오른 그늘)
    x = 1
    while x < Wp - 2:
        L0 = int(lip[x]) + corn_h[x] + 1
        h = int(2 + hash2(x, 3, seed + 19) ** 2 * 10)
        if hash2(x, 4, seed + 19) < 0.62:
            for j in range(h):
                y = L0 + j
                if y >= Hp or not face_m[y, x]: break
                w2 = j < h * 0.45
                put = lambda xx, c: px.__setitem__((xx, y), tuple(int(v) for v in c) + (255,)) if 0 <= xx < Wp else None
                put(x, IC[6] if j < h - 1 else IC[4])
                if w2: put(x + 1, IC[3])
            if h > 5 and 0 <= L0 + h < Hp: px[x, L0 + h] = tuple(int(v) for v in IC[5]) + (255,)
            x += 2 + int(hash2(x, 5, seed + 19) * 3)
        else:
            x += 1 + int(hash2(x, 6, seed + 19) * 4)
    # 발치 눈 더미(앞면 맨 아래 3~8px) — 윗줄 밝고 아래 그늘
    dr = tnoise1(Wp, 7, seed + 20) * 0.7 + tnoise1(Wp, 2, seed + 21) * 0.3
    for x in range(Wp):
        h = int(2 + dr[x] * 7); b = int(bot[x])
        for j in range(h):
            y = b - 1 - j
            if y < 0 or not face_m[y, x]: continue
            c = SNa[6] if j == h - 1 else (SNa[5] if j > h * 0.4 else SNa[4])
            px[x, y] = tuple(int(v) for v in c) + (255,)
    return im, face_m, top_m, lip, bot


def glacier_shadow(bot, Wp, Hp, depth=5):
    """앞면 발치 남쪽 땅에 떨어지는 푸른 그림자 마스크(곱하기용)."""
    m = np.zeros((Hp, Wp), bool)
    for x in range(Wp):
        b = int(bot[x]); d = depth + int(hash2(x // 3, 1, 9) * 3)
        m[b:min(Hp, b + d), x] = True
    return m


# ================================================================ 오토타일 16변형
def trail_sheet(seed=7, footprints=True):
    """밟아 다진 눈길(발자국): 가장자리 1~2px 눈 둑(북쪽 안벽 그늘, 남쪽 안벽 밝음), 속 다진 눈 4톤 + 칩셋 점박이 결, 발자국 쌍."""
    cells = []
    X, Y = np.meshgrid(np.arange(16), np.arange(16))
    r2 = _RANK2
    for n in range(16):
        m = edge_depth(n, inset=2.4, jag=1.6, rad=5.0, seed=seed)
        T = np.full((16, 16), 4, int)
        T = np.where(hash2(X, Y, seed + 30) > 0.93, 5, T)
        T = np.where(hash2(X, Y, seed + 31) < 0.04, 3, T)
        # 발자국: 칸마다 두 쌍(2x3 타원), 어긋나게
        fp = np.zeros((16, 16), bool)
        if footprints:
            for k in range(2):
                fx = 3 + hash2(n, k, seed + 40) * 10; fy = 3 + k * 7 + hash2(n, k, seed + 41) * 3
                fp |= (((X - fx) / 1.1) ** 2 + ((Y - fy) / 1.6) ** 2) <= 1.0
        T = np.where(fp & (m > 1.5), 2, T)
        T = np.where(np.roll(fp, 1, 0) & ~fp & (m > 1.5), 5, T)
        # 가장자리 둑: 이웃 없는 쪽마다 m 0..1.6 띠
        nb = m < 1.6
        Tn = T.copy()
        sideN = not (n & N_); sideS = not (n & S_); sideW = not (n & W_); sideE = not (n & E_)
        dN = Y; dS = 15 - Y; dW = X; dE = 15 - X
        near = np.argmin(np.stack([np.where(sideN, dN, 99), np.where(sideE, dE, 99), np.where(sideS, dS, 99), np.where(sideW, dW, 99)]), 0)
        Tn = np.where(nb & (near == 0), 3, Tn)
        Tn = np.where(nb & (near == 2), 6, Tn)
        Tn = np.where(nb & (near == 3), 4, Tn)
        Tn = np.where(nb & (near == 1), 5, Tn)
        rgb = SNa[np.clip(Tn, 0, 6)]
        alpha = m >= 0
        # 밖으로 튄 눈 알갱이
        sp = (m < 0) & (m > -1.2) & (hash2(X, Y, seed + n + 3) > 0.86)
        rgb = np.where(sp[..., None], SNa[6], rgb)
        out = np.dstack([rgb, np.where(alpha | sp, 255, 0)]).astype(np.uint8)
        cells.append(Image.fromarray(out, 'RGBA'))
    return sheet_from_cells(cells)


N_, E_, S_, W_ = 1, 2, 4, 8


def drift_sheet(seed=9):
    """눈 번짐(얼음·바위·땅 위에 덮이는 눈): 속은 눈 바닥 결, 가장자리 들쭉날쭉 — 북·서 가장자리 밝은 테, 남·동 가장자리 그늘 2px + 밖 1px 옅은 그림자."""
    cells = []
    X, Y = np.meshgrid(np.arange(16), np.arange(16))
    st = snow_tone(16, 16, seed + 1, per=16)
    for n in range(16):
        m = edge_depth(n, inset=3.0, jag=3.0, rad=7.5, seed=seed)
        T = st.copy()
        a = m >= 0
        up = np.roll(a, 1, 0); dn = np.roll(a, -1, 0); lf = np.roll(a, 1, 1); rt = np.roll(a, -1, 1)
        if n & N_: up[0, :] = True
        else: up[0, :] = False
        if n & S_: dn[15, :] = True
        else: dn[15, :] = False
        if n & W_: lf[:, 0] = True
        else: lf[:, 0] = False
        if n & E_: rt[:, 15] = True
        else: rt[:, 15] = False
        T = np.where(a & ~up, 6, T)
        T = np.where(a & ~lf & up, np.maximum(T, 5), T)
        dn2 = np.roll(dn, -1, 0)
        if n & S_: dn2[14:, :] = True
        T = np.where(a & dn & ~dn2, 5, T)
        T = np.where(a & ~dn, 4, T)
        T = np.where(a & ~rt & dn, np.minimum(T, 4), T)
        rgb = SNa[np.clip(T, 0, 6)]
        out = np.dstack([rgb, np.where(a, 255, 0)]).astype(np.uint8)
        sh = np.roll(a, 1, 0) & ~a
        if not (n & N_): sh[0, :] = False
        out[sh] = list(SNa[3]) + [70]
        dots = (m < 0) & (m > -2.2) & (hash2(X, Y, seed + 20 + n) > 0.80) & ~sh
        out[dots] = list(SNa[5]) + [255]
        cells.append(Image.fromarray(out, 'RGBA'))
    return sheet_from_cells(cells)


def iceedge_sheet(seed=41):
    """얼음 ↔ 눈 가장자리(언 호수 얼음판을 눈 땅 위에 덧그린다). 속은 호수 얼음 결(주기 16), 가장자리는 물가 규칙."""
    cells = []
    for n in range(16):
        m = edge_depth(n, inset=1.6, jag=1.5, rad=5.0, seed=seed)
        a = m >= 0
        big = np.zeros((48, 48), bool); big[16:32, 16:32] = a
        if n & N_: big[0:16, 16:32] = True
        if n & S_: big[32:48, 16:32] = True
        if n & W_: big[16:32, 0:16] = True
        if n & E_: big[16:32, 32:48] = True
        im = ice_layer(big, seed=seed, per=16, d_in=np.where(big, 12.0, 0.0))
        cells.append(im.crop((16, 16, 32, 32)))
    return sheet_from_cells(cells)


# ================================================================ 바닥 표본(3x3 = 48x48, 이음새 없음)
def ground_snow(seed=31):
    return Image.fromarray(snow_rgb(48, 48, seed, per=48), 'RGB').convert('RGBA')


def ground_ice(seed=41):
    m = np.ones((48, 48), bool)
    Y, X = np.mgrid[0:48, 0:48]
    im = ice_layer(np.ones((48 + 96, 48 + 96), bool), seed=seed, per=48, d_in=np.full((144, 144), 16.0))
    return im.crop((48, 48, 96, 96))


def ground_glacier(seed=61):
    """빙하 윗면 표본(3x3): 눈 덮인 빙하, 드러난 푸른 얼음 덩이, 짧은 크레바스."""
    T = snow_tone(48, 48, seed + 3, per=48)
    rgb = SNa[T].copy()
    ex = tnoise(48, 48, 16, seed + 4) > 0.6
    rgb = np.where(ex[..., None], GLa[np.where(tnoise(48, 48, 8, seed + 6) > 0.5, 4, 5)], rgb)
    rgb = np.where((ex & ~np.roll(ex, -1, 0))[..., None], GLa[3], rgb)
    rgb = np.where((ex & ~np.roll(ex, 1, 0))[..., None], SNa[6], rgb)
    for (x0, y0, L) in ((6, 12, 18), (28, 34, 14)):
        for x in range(x0, x0 + L):
            f = (x - x0) / L; w = 1 + int(1.6 * math.sin(math.pi * f)); yc = y0 + int(2 * math.sin(x / 5.0))
            rgb[yc - 1, x % 48] = SNa[6]
            for k in range(w): rgb[(yc + k) % 48, x % 48] = GLa[1] if k < w - 1 else GLa[2]
            rgb[(yc + w) % 48, x % 48] = GLa[4]
    return Image.fromarray(rgb.astype(np.uint8), 'RGB').convert('RGBA')


def ground_packed(seed=7, footprints=True):
    """다진 눈 바닥(야영지 둘레, 3x3): 다진 눈 4톤 + 칩셋 점박이 결 + 엇갈린 발자국."""
    X, Y = np.meshgrid(np.arange(48), np.arange(48))
    r2 = _RANK2[Y % 16, X % 16]
    r2 = np.where(hash2(X // 16, Y // 16, seed) > 0.5, _RANK2[Y % 16, 15 - X % 16], r2)
    T = np.full((48, 48), 5, int)
    T = np.where(hash2(X, Y, seed + 3) > 0.90, 4, T)
    fp = np.zeros((48, 48), bool)
    rs = np.random.default_rng(seed)
    for i in range(9 if footprints else 0):
        fx, fy = rs.integers(2, 46), rs.integers(2, 46)
        fp |= ((((X - fx) % 48 + 24) % 48 - 24) / 1.5) ** 2 + ((((Y - fy) % 48 + 24) % 48 - 24) / 2.2) ** 2 <= 1.0
    T = np.where(fp, 3, T)
    T = np.where(np.roll(fp, 1, 0) & ~fp, 6, T)
    return Image.fromarray(SNa[T].astype(np.uint8), 'RGB').convert('RGBA')


def footprints_layer(cells, Wc, Hc, seed=71, dens=0.62):
    """지도용 발자국: 길 칸마다 전역 좌표 해시로 엇갈린 발자국 0~2개(칸 반복 무늬가 안 생긴다). RGBA."""
    im = Image.new('RGBA', (Wc * 16, Hc * 16)); px = im.load()
    for (cx, cy) in cells:
        for k in range(2):
            if hash2(cx, cy * 2 + k, seed) > dens: continue
            fx = cx * 16 + 3 + hash2(cx, cy * 2 + k, seed + 1) * 10; fy = cy * 16 + 3 + k * 7 + hash2(cx, cy * 2 + k, seed + 2) * 4
            for y in range(int(fy) - 3, int(fy) + 4):
                for x in range(int(fx) - 3, int(fx) + 4):
                    d = ((x - fx) / 1.5) ** 2 + ((y - fy) / 2.2) ** 2
                    if d <= 1 and 0 <= x < Wc * 16 and 0 <= y < Hc * 16: px[x, y] = tuple(int(v) for v in SNa[2]) + (255,)
                    elif d <= 1.8 and y > fy and 0 <= x < Wc * 16 and 0 <= y < Hc * 16: px[x, y] = tuple(int(v) for v in SNa[5]) + (255,)
    return im
