# 등불 수향 마을 — 바닥 표본(ground-*) + 시그니처 땅 덩이 오토타일 3종.
# 풀 = 버들항 칩셋 풀 타일(잔디 0,128 · 들풀 304,304 · 그늘 풀 112,2144) 그대로, 흙 = 칩셋 흙(16,224) 그대로,
# 석판 = 버들항 돌(stone) 램프 + 칩셋 바위 결(336,336) 밝기 순위, 벽돌 = 회청 벽돌(qing) 램프, 부두 널 = 버들항 나무 램프.
# 오토타일(칸 번호 = 위 1 + 오른쪽 2 + 아래 4 + 왼쪽 8, 0 = 외톨이, 15 = 속):
#   autotile-canal          운하 물 + 들쭉날쭉한 막돌 둑(북쪽 둑은 돌 앞면이 물로 내려간다) — 막힘(아래층)
#   autotile-wet-flagstone  젖은 석판 길(빗물 웅덩이 하늘 비침), 끝은 들쭉날쭉 깨진 판 — 걷기(아래층)
#   autotile-lotus          연잎 덩이(물 위, 홈 난 둥근 잎 + 분홍 꽃) — 막힘(위층, 운하 물 위에 덧그림)
# 가장자리 들쭉날쭉은 ek_wave5.edges(16 주기 잡음, 같은 씨앗) — 이웃 칸끼리 윤곽이 이어진다. 속 결은 모두 16(표본은 48) 주기.
import numpy as np
from PIL import Image
from lr_base import *
from lr_base import _hash
import ek_wave5 as W5
import ground as G
from fr_ground import vn_arr

MIZUa = np.array(W5.MIZU, int); KOKEa = np.array(W5.KOKE, int); SOILa = np.array(W5.SOIL, int)
LEAFa = np.array(fr_mat.LEAF7, int); HASUa = np.array(HASU, int); MOMOa = np.array(MOMO, int); YANAa = np.array(YANA, int)


def _img(rgb): return Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), 'RGB').convert('RGBA')
def _cell(rgb, al): return W5._cell(rgb, al)


# ================================================================ 석판(화강암 판석) 결
def slab_k(X, Y, per=16, seed=7, rowh=8, tone48=False):
    """가로로 긴 화강암 판석을 줄마다 엇갈려 깐 결(수향 마을 골목): 줄 높이 rowh px, 판 폭은 줄마다 해시로(합 = per → per 주기, 이음새 없음).
    판 사이 줄눈 1px(톤 1), 판마다 톤 흔들림(3~5), 위·왼 모 +1 빛, 판 안 칩셋 바위 결(어두운 결 −1), 드문 금(대각 1px)."""
    X = np.asarray(X); Y = np.asarray(Y)
    Xp = X % per; Yp = Y % per
    row = Yp // rowh; ly = Yp % rowh
    T = np.zeros(X.shape, int); sid = np.zeros(X.shape, int); lxo = np.zeros(X.shape, int); wo = np.zeros(X.shape, int)
    nrows = per // rowh
    for r in range(nrows):
        # 줄마다 판 폭 나누기: per 를 2~4 장으로(폭 >= 9)
        if per == 16: cuts = [0, 16] if _hash(r, 0, seed) < .45 else [0, 7 + int(_hash(r, 1, seed) * 3), 16]
        else:
            n = 2 + int(_hash(r, 0, seed) > .75)
            ws = [16 + _hash(r, i + 1, seed) * 14 for i in range(n)]; s = sum(ws)
            acc = [0]
            for w in ws: acc.append(acc[-1] + w * per / s)
            cuts = [int(round(a)) for a in acc]; cuts[-1] = per
        off = int(_hash(r, 9, seed) * per)
        sel = row == r
        xs = (Xp + off) % per
        for i in range(len(cuts) - 1):
            a, b = cuts[i], cuts[i + 1]
            s2 = sel & (xs >= a) & (xs < b)
            sid = np.where(s2, r * 10 + i, sid); lxo = np.where(s2, xs - a, lxo); wo = np.where(s2, b - a, wo)
    if tone48: sid = sid + 100 * ((X // 16) % 3 + 3 * ((Y // 16) % 3))          # 판 모양은 16 주기, 판 톤은 48 주기(표본에서 덜 되풀이)
    h = hash2(sid, sid * 3 + 1, seed + 2)
    g = chip_tones_lin(336, 336, 2.7, 4.5)[Y % 16, X % 16]                       # 화강암 알갱이 결(칩셋 바위 결 밝기 순위)
    T = g + np.where(h > .82, 1, 0) - np.where(h < .18, 1, 0)
    T = np.where((ly == 0) & (lxo < wo - 1), np.maximum(T, 4) + (h > .4), T)   # 판 위 모(빛)
    T = np.where((lxo == 0) & (ly < rowh - 1), np.maximum(T, 4), T)
    T = np.where((ly == rowh - 2) & (lxo > 0), np.minimum(T, 3), T)            # 판 아래 모(그늘)
    crack = (hash2(sid, 7, seed + 8) > (.86 if tone48 else 2)) & (np.abs((lxo - ly * 1.4) - wo * .4) < .6) & (ly > 0) & (ly < rowh - 1)
    T = np.where(crack, 2, T)
    T = np.where((ly == rowh - 1) | (lxo == wo - 1), 1, T)
    return np.clip(T, 1, 6), lxo, ly, wo


SLAB_SEED = 7          # 판석 결 씨앗: ground-flagstone·ground-flagstone-moss·autotile-wet-flagstone·autotile-flagstone-curb 가 같은 판 줄을 쓴다(겹쳐도 이음새 없음)


def flagstone_rgb(X, Y, per=16, seed=SLAB_SEED, moss=0.0):
    T, lxo, ly, wo = slab_k(X, Y, per, seed, tone48=True)
    out = GRANa[T]
    if moss:
        joint = T == 1
        mo = joint & (hash2(X // 2, Y, seed + 21) < moss)
        out = np.where(mo[..., None], KOKEa[np.where(Y % 2 == 0, 4, 3)], out)
        near = (np.roll(mo, 1, 0) | np.roll(mo, -1, 1)) & ~joint & (hash2(X, Y, seed + 22) < moss * .8)
        out = np.where(near[..., None], KOKEa[5], out)
    return out


def brick_rgb(X, Y, seed=13):
    """회청 벽돌 마당(객잔 안마당·찻집 앞): 눕힌 벽돌(16x8)과 세운 벽돌(8x16)을 번갈아 깐 바구니 짜기(8x16 단위 두 장씩, 16 주기),
    줄눈 1px(톤 1), 벽돌마다 톤 흔들림, 위·왼 모 빛, 드문 이끼 점."""
    bx = (X // 16); by = (Y // 16); lx = X % 16; ly = Y % 16
    hor = (bx + by) % 2 == 0
    # 눕힌 칸: 위·아래 두 장(16x8) / 세운 칸: 왼·오른 두 장(8x16)
    sub = np.where(hor, ly // 8, lx // 8)
    ux = np.where(hor, lx, lx % 8); uy = np.where(hor, ly % 8, ly)
    uw = np.where(hor, 16, 8); uh = np.where(hor, 8, 16)
    h = hash2(bx * 2 + sub, by * 3 + sub, seed)
    T = np.where(h > .7, 5, np.where(h < .2, 3, 4))
    T = np.where((uy == 0) | (ux == 0), T + 1, T)
    T = np.where(hash2(X, Y, seed + 4) < .05, T - 1, T)
    T = np.where((uy == uh - 1) | (ux == uw - 1), 1, T)
    out = QINGa[np.clip(T, 1, 6)]
    mo = (T == 1) & (hash2(X // 3, Y // 2, seed + 7) > .9)
    return np.where(mo[..., None], KOKEa[4], out)


def dock_rgb(X, Y, seed=17):
    """부두 널(나무 잔교 바닥): 남북으로 긴 널(폭 6px, 길이 24~48 엇갈림), 널 사이 틈 1px 어둠(물 그늘), 널마다 톤 흔들림, 못 자리 점, 젖은 얼룩."""
    col = X // 6; lx = X % 6
    L = 48
    off = (hash2(col, 0, seed) * L).astype(int)
    seg = (Y + off) // 24; ly = (Y + off) % 24
    h = hash2(col, seg, seed + 1)
    T = np.where(h > .65, 5, np.where(h < .2, 3, 4))
    T = np.where(lx == 0, T + 1, T)
    T = np.where(lx == 4, T - 1, T)
    gr = (hash2(X, Y // 5, seed + 3) > .84) & (lx > 0) & (lx < 4)
    T = np.where(gr, T - 1, T)
    nail = ((ly == 2) | (ly == 21)) & ((lx == 1) | (lx == 3))
    T = np.where(nail, 2, T)
    T = np.where(ly == 0, 2, T)
    T = np.where(lx == 5, 1, T)
    out = WDa[np.clip(T, 1, 6)]
    wet = vn_arr(X, Y, 16, seed + 5, per=48) > .72
    return np.where((wet & (T > 1))[..., None], (out * .82).astype(int), out)


# ================================================================ 바닥 표본(48x48)
def _grid(): return np.mgrid[0:48, 0:48][::-1]


def ground_grass():
    """버들항 잔디 바탕: 칩셋 잔디(0,128)와 들풀(304,304)을 48 주기 덩이 잡음으로 화소 단위로 섞고(ground.render 와 같은 섞기를 표본 안에서),
    칸마다 다른 덧그림 — 짧은 풀잎 끝 · 클로버 덤불(9칸 중 둘) · 떨어진 잎(하나). 넓게 깔아도 한 장 무늬처럼 납작하지 않다."""
    X, Y = _grid()
    lawn = G.tiled(G.tex(0, 128), 48, 48).astype(int); mead = G.tiled(G.tex(304, 304), 48, 48).astype(int)
    nz = vn_arr(X, Y, 24, 41, per=48) * .7 + vn_arr(X, Y, 8, 42, per=48) * .3
    mix = (nz + (hash2(X, Y, 43) - .5) * .12) > .62
    base = _img(np.where(mix[..., None], mead, lawn))
    kinds = {(0, 0): 'short', (1, 0): 'clover', (2, 0): 'short', (0, 1): 'short', (1, 1): 'short', (2, 1): 'leaves', (0, 2): 'clover', (1, 2): 'short', (2, 2): 'short'}
    for (cx, cy), k in kinds.items(): base.alpha_composite(W5.grass_overlay(k, cx, cy), (cx * 16, cy * 16))
    return base


def ground_grass_meadow():
    """버들항 들풀(칩셋 304,304) + 클로버 덤불 — 운하 둑 풀밭·버드나무 밑."""
    base = _img(G.tiled(G.tex(304, 304), 48, 48))
    for cy in range(3):
        for cx in range(3):
            if (cx + cy) % 2 == 0: base.alpha_composite(W5.grass_overlay('clover', cx, cy), (cx * 16, cy * 16))
    return base


def willow_leaf_overlay(cx, cy, seed=5):
    """떨어진 버들잎(가늘고 긴 잎 3~5px, 누런 연두) 덧그림 16x16."""
    rgb = np.zeros((16, 16, 3), int); al = np.zeros((16, 16), bool)
    sd = seed + cx * 131 + cy * 71
    for i in range(2 + int(_hash(cx, cy, sd) * 3)):
        ox = 1 + int(_hash(i, 1, sd) * 11); oy = 1 + int(_hash(i, 2, sd) * 13)
        L = 3 + int(_hash(i, 3, sd) * 3); d = 1 if _hash(i, 4, sd) > .5 else -1
        for t in range(L):
            x_ = ox + t; y_ = oy + (t * d) // 3
            if 0 <= x_ < 16 and 0 <= y_ < 16:
                rgb[y_, x_] = YANAa[5 if t < L - 1 else 4]; al[y_, x_] = True
                if y_ + 1 < 16 and not al[y_ + 1, x_]: rgb[y_ + 1, x_] = LEAFa[2]; al[y_ + 1, x_] = True
    return _cell(rgb, al)


def ground_grass_shade():
    """버들항 그늘 풀(칩셋 112,2144) + 떨어진 버들잎 — 버드나무·큰 나무 밑, 집 뒤 그늘."""
    base = _img(G.tiled(G.tex(112, 2144), 48, 48))
    for cy in range(3):
        for cx in range(3): base.alpha_composite(willow_leaf_overlay(cx, cy), (cx * 16, cy * 16))
    return base


def ground_dirt():
    """흙 골목(칩셋 흙 16,224) + 작은 자갈 점(칸마다 자리 다르게)."""
    base = np.array(_img(G.tiled(G.tex(16, 224), 48, 48)))[..., :3].astype(int)
    X, Y = _grid()
    peb = (hash2(X // 2, Y // 2, 31) > .965) & (X % 2 == 0) & (Y % 2 == 0)
    base = np.where(peb[..., None], SOILa[6], base)
    sh = np.roll(peb, 1, 0) & ~peb
    base = np.where(sh[..., None], SOILa[1], base)
    return _img(base)


def ground_flagstone():
    X, Y = _grid(); return _img(flagstone_rgb(X, Y))


def ground_flagstone_moss():
    """이끼 낀 판석 — 물가·다리 끝·오래된 뒷골목(같은 판 줄이라 ground-flagstone 과 이웃해도 이음새 없음)."""
    X, Y = _grid(); return _img(flagstone_rgb(X, Y, moss=.55))


def ground_brick():
    X, Y = _grid(); return _img(brick_rgb(X, Y))


def ground_dock():
    X, Y = _grid(); return _img(dock_rgb(X, Y))


# ================================================================ ① 운하 물 + 막돌 둑 (막힘)
def canal_cell(n, seed=61):
    """운하 칸: 이웃 없는 쪽 = 크기가 제각각인 화강암 막돌 둑(돌 사이 이끼, 위 모 빛), 둑 바깥 1px 젖은 풀 점.
    북쪽 둑은 돌 윗면 뒤로 돌 앞면(2~3px, 줄눈)이 물로 내려가고 그 밑 물에 그늘 두 줄(3/4).
    남·서·동 둑은 돌 윗면 + 물 닿는 줄 젖은 어둠 + 물가 밝은 잔물결 띠. 속 = 버들항 운하 물 톤(고른 한 톤 + 드문 결).
    모서리·끝 칸에만 갈대 포기(칸마다 자리 다르게)."""
    m, mN, mS = W5.edges(n, inset=2.2, jag=2.6, rad=7.0, seed=seed)
    X, Y = X16, Y16
    rgb = np.zeros((16, 16, 3), int); al = np.zeros((16, 16), bool)
    BANK = 5.0
    north = (mN < m + 1.6) & (mN < 10)
    wstart = np.where(north, BANK + 2.6, BANK)
    water = m >= wstart
    # 물 속: 기본 톤 3, 긴 물결 잡음이 어두운 곳에 드문 톤 2 점, 가로로 끌린 잔물결(2~4px, 톤 4) 드물게
    nz = vn_arr(X, Y, 8, seed + 3, per=16)
    wt = np.full((16, 16), 3)
    wt = np.where((hash2(X // 2, Y, seed + 4) > .88) & (nz < .45), 2, wt)
    rip = (hash2(X // 3, Y, seed + 5) > .93) & (nz > .55) & (Y % 3 == 0)
    wt = np.where(rip, 4, wt)
    wt = np.where(water & (m < wstart + 1.3) & ~north, 4, wt)                   # 남·서·동 물가 밝은 띠
    wt = np.where(water & (m < wstart + .6) & ~north, 2, wt)                    # 돌 밑 젖은 줄
    wt = np.where(water & north & (m < wstart + 2.0), 1, wt)                    # 북쪽 둑 그늘
    wt = np.where(water & north & (m >= wstart + 2.0) & (m < wstart + 3.2), 2, wt)
    rgb = np.where(water[..., None], MIZUa[np.clip(wt, 1, 6)], rgb); al |= water
    # 막돌 둑(돌 크게: 칸에 2x2 개)
    ct, cid, gap = W5.cobble(X, Y, seed + 7, per=16, k=2)
    band = (m >= 0) & (m < BANK)
    st = ct.copy()
    st = np.where(m < .9, np.maximum(st - 1, 1), st)
    st = np.where((m >= BANK - 1.2) & ~north, np.maximum(st - 1, 1), st)        # 물 쪽 돌 끝 한 단 어둡게(젖음)
    moss = gap & band & (hash2(X, Y, seed + 9) > .4)
    rgb = np.where(band[..., None], STa[st], rgb); al |= band
    rgb = np.where(moss[..., None], KOKEa[np.where(Y % 2 == 0, 4, 3)], rgb)
    face = north & (m >= BANK) & (m < BANK + 2.6)                               # 북쪽 둑 돌 앞면
    ft = np.where(gap, 1, np.where(m < BANK + 1.0, 3, 2))
    rgb = np.where(face[..., None], STa[ft], rgb); al |= face
    damp = (m >= -1.2) & (m < 0) & (hash2(X, Y, seed + 11) > .5)
    rgb = np.where(damp[..., None], LEAFa[2], rgb); al |= damp
    # 갈대 포기(모서리·끝 칸): 물가 물 안에서 세로 잎 3~4 줄기(2px 아래 그늘), 끝은 누런 이삭
    if bin(n).count('1') <= 2 and _hash(n, 3, seed) > .3:
        for t in range(1 + int(_hash(n, 4, seed) * 2)):
            for tries in range(12):
                rx = 2 + int(_hash(n, 10 + t * 13 + tries, seed) * 12); ry = 5 + int(_hash(n, 30 + t * 7 + tries, seed) * 9)
                if water[ry, rx] and m[ry, rx] < wstart[ry, rx] + 2.4 and m[ry, rx] >= wstart[ry, rx] + .4: break
            else: continue
            for b, (dx, L) in enumerate(((0, 6), (2, 5), (-2, 4), (1, 7))):
                if b >= 3 + int(_hash(n, 5 + t, seed) > .5): break
                for j in range(L):
                    x_ = rx + dx + (j // 4) * (1 if dx > 0 else (-1 if dx < 0 else 0)); y_ = ry - j
                    if 0 <= x_ < 16 and 0 <= y_ < 16:
                        rgb[y_, x_] = (LEAFa[5] if j > 1 else LEAFa[3]) if j < L - 1 else np.array(GOLD[4]); al[y_, x_] = True
            for dx in (-1, 0, 1, 2):
                if 0 <= rx + dx < 16 and ry + 1 < 16 and water[ry + 1, rx + dx]: rgb[ry + 1, rx + dx] = MIZUa[1]
    return _cell(rgb, al)


def autotile_canal(): return sheet_from_cells([canal_cell(n) for n in range(16)])


# ================================================================ ② 젖은 석판 길 (걷기)
def wetflag_cell(n, seed=73):
    """젖은 석판: ground-flagstone 과 같은 판 줄(SLAB_SEED)의 판을 **한 장 단위로** 적신다 — 판 가운데가 덩이 윤곽 안이면 그 판 전체가
    한 단 어둡고(젖음) 위 모에 물기 빛 1px, 밖이면 투명(밑 마른 판이 그대로 보인다). 그래서 젖은 곳과 마른 곳의 경계가 판 줄눈을 따라
    들쭉날쭉하다(판 반쪽만 젖은 얼룩이 없다). 젖은 판 몇 장의 틈에 고인 물, 칸마다 많아야 하나 작은 빗물 웅덩이(하늘 비침 한 줄).
    흙·풀 위에 칠하면 젖은 판이 흩어진 디딤판 길이 된다."""
    m, mN, mS = W5.edges(n, inset=1.4, jag=2.2, rad=5.0, seed=seed)
    X, Y = X16, Y16
    T, lxo, ly, wo = slab_k(X, Y, per=16, seed=SLAB_SEED)
    cxs = np.clip(X - lxo + wo // 2, 0, 15); cys = np.clip(Y - ly + 3, 0, 15)
    inside = m[cys, cxs] >= 0                                                                     # 판 가운데로 판 전체를 고른다
    joint = T == 1
    rgb = np.zeros((16, 16, 3), int); al = np.zeros((16, 16), bool)
    Tw = np.where(joint, 1, np.clip(T - 1, 2, 4))
    hi = (ly == 0) & (lxo > 0) & (lxo < wo - 2) & ~joint & (hash2(lxo // 3, Y // 8, seed + 3) > .45)
    Tw = np.where(hi, 5, Tw)
    out = GRANa[Tw]
    out = np.where((joint & (hash2(X // 3, Y, seed + 4) > .8))[..., None], MIZUa[2], out)
    if _hash(n, 1, seed) > .45:
        cx = 3 + _hash(n, 2, seed) * 10; cy = 3 + _hash(n, 3, seed) * 10
        pud = (((X + .5 - cx) / 2.4) ** 2 + ((Y + .5 - cy) / 1.2) ** 2 <= 1) & inside & ~joint
        out = np.where(pud[..., None], MIZUa[4], out)
        out = np.where((pud & (Y == int(cy)) & (X < cx))[..., None], MIZUa[6], out)
    rgb = np.where(inside[..., None], out, rgb); al |= inside
    return _cell(rgb, al)


def autotile_wetflag(): return sheet_from_cells([wetflag_cell(n) for n in range(16)])


# ================================================================ ④ 판석 길 연석(걷기) — 길 이음
def curb_cell(n, seed=95):
    """판석 길 가장자리: 속 = ground-flagstone 과 같은 판 줄(SLAB_SEED, 16 주기 → 표본과 이어 붙여도 이음새 없음),
    이웃 없는 쪽 = 긴 화강암 연석(폭 3px: 윗면 빛 2px + 바깥 1px 그늘), 연석 바깥 1px 은 풀 쪽 그늘·흙 알갱이, 드문 풀 포기가 틈에서 삐친다.
    연석 선은 곧되 2~3 칸마다 한 px 오르내려 기계 직선처럼 보이지 않는다. 밑 땅(풀·흙)은 바깥에 보인다."""
    m, mN, mS = W5.edges(n, inset=.6, jag=.6, rad=3.0, seed=seed)
    X, Y = X16, Y16
    T, lxo, ly, wo = slab_k(X, Y, per=16, seed=SLAB_SEED)
    rgb = np.zeros((16, 16, 3), int); al = np.zeros((16, 16), bool)
    inside = m >= 0
    out = GRANa[T]
    kerb = inside & (m < 3.0)
    seg = (np.where(mN < m + .5, X, Y) // 6)                                      # 연석 토막(6px)
    kt = np.where(m < 1.0, 2, np.where(m < 2.0, 5, 4))
    kt = np.where(((np.where(mN < m + .5, X, Y)) % 6 == 5) & (m >= 1.0), 2, kt)      # 연석 이음 줄
    kt = np.where(hash2(seg, n, seed + 1) < .2, np.maximum(kt - 1, 1), kt)
    out = np.where(kerb[..., None], GRANa[kt], out)
    rgb = np.where(inside[..., None], out, rgb); al |= inside
    rim = (m >= -1.0) & (m < 0)
    rgb = np.where(rim[..., None], LEAFa[2], rgb); al |= rim
    for i in range(1 + int(_hash(n, 1, seed) * 2)):                                 # 틈 풀 포기
        tx = 1 + int(_hash(n, 10 + i, seed) * 14); ty = 1 + int(_hash(n, 20 + i, seed) * 14)
        if not (.5 <= m[ty, tx] < 2.5) or n == 15: continue
        for (dx, dy, k) in ((0, 0, 3), (0, -1, 5), (-1, -1, 4), (1, -2, 6)):
            x_, y_ = tx + dx, ty + dy
            if 0 <= x_ < 16 and 0 <= y_ < 16: rgb[y_, x_] = LEAFa[k]; al[y_, x_] = True
    return _cell(rgb, al)


def autotile_curb(): return sheet_from_cells([curb_cell(n) for n in range(16)])


# ================================================================ ③ 연잎 덩이 (물 위, 막힘)
def _pads(seed, per=16, k=3):
    ps = []
    sp = per / k
    for j in range(k):
        for i in range(k):
            cx = (i + .5) * sp + (_hash(i, j, seed) - .5) * sp * .7
            cy = (j + .5) * sp + (_hash(i, j, seed + 1) - .5) * sp * .7
            r = 2.3 + _hash(i, j, seed + 2) * 1.5
            ps.append((cx, cy, r, _hash(i, j, seed + 3), i * 7 + j))
    return ps


def lotus_cell(n, seed=87):
    """연잎 덩이: 16 주기로 흔든 자리의 둥근 연잎(반지름 2.3~3.8, 홈 하나, 왼쪽 위 빛 · 가장자리 어둠 · 잎맥 점)이 빽빽이,
    잎 사이는 투명(밑 운하 물이 보인다), 잎 밑 물그림자 1px. 이웃 없는 쪽은 들쭉날쭉 윤곽 바깥 잎을 지운다 —
    잎 하나가 윤곽에 걸리면 통째로 빼서 반쪽 잎이 없다. 드문 분홍 연꽃(꽃잎 5 + 노란 꽃술)과 봉오리."""
    m, mN, mS = W5.edges(n, inset=1.0, jag=2.6, rad=6.0, seed=seed)
    X, Y = X16, Y16
    rgb = np.zeros((16, 16, 3), int); al = np.zeros((16, 16), bool)
    pads = _pads(seed + 1)
    def mval(x, y):
        x = int(min(15, max(0, x))); y = int(min(15, max(0, y))); return m[y, x]
    for (cx0, cy0, r, h, pid) in sorted(pads, key=lambda p: p[1]):
        for ox in (-16, 0, 16):
            for oy in (-16, 0, 16):
                cx, cy = cx0 + ox, cy0 + oy
                if cx + r < 0 or cx - r > 16 or cy + r < 0 or cy - r > 16: continue
                # 윤곽: 잎이 칸 안에 걸친 부분 중 하나라도 바깥(m<0)이면 뺀다
                dd = np.hypot(X + .5 - cx, (Y + .5 - cy) * 1.3)
                pad = dd <= r
                if not pad.any(): continue
                if (m[pad] < 0).any(): continue
                # 칸 밖으로 넘친 쪽: 그 방향 이웃이 없으면 뺀다(이웃이 없으면 그 칸은 잎을 안 그린다)
                if (cx - r < 0 and not (n & 8)) or (cx + r > 16 and not (n & 2)) or (cy - r < 0 and not (n & 1)) or (cy + r > 16 and not (n & 4)): continue
                ang = np.arctan2(Y + .5 - cy, X + .5 - cx)
                na = h * 6.283
                notch = (np.abs(np.angle(np.exp(1j * (ang - na)))) < .32) & (dd > .8)
                pad &= ~notch
                lt = np.where((X + .5 - cx) + (Y + .5 - cy) < -1.2, 5, np.where(dd > r - .9, 3, 4))
                vein = (np.abs(np.angle(np.exp(1j * (ang - na - 3.14)))) < .12) & (dd < r - 1)
                lt = np.where(vein, 3, lt)
                lt = np.where(dd < .9, 5, lt)
                under = np.roll(pad, 1, 0) & ~pad & ~al
                rgb = np.where(under[..., None], MIZUa[1], rgb); al |= under
                rgb = np.where(pad[..., None], HASUa[lt], rgb); al |= pad
    # 연꽃(칸마다 드물게, 잎 위에)
    if _hash(n, 1, seed) > (.45 if n != 15 else .78):
        fx = 4 + int(_hash(n, 2, seed) * 8); fy = 4 + int(_hash(n, 3, seed) * 8)
        if m[fy, fx] > 2.5:
            for (dx, dy, k) in ((0, -2, 6), (-2, -1, 5), (2, -1, 4), (-1, 0, 5), (1, 0, 4), (0, -1, 6), (-1, 1, 3), (1, 1, 3), (0, 1, 4)):
                rgb[fy + dy, fx + dx] = MOMOa[k]; al[fy + dy, fx + dx] = True
            rgb[fy, fx] = np.array(GOLD[5]); rgb[fy + 2, fx] = HASUa[2]; al[fy + 2, fx] = True
    elif _hash(n, 4, seed) > .5:
        fx = 3 + int(_hash(n, 5, seed) * 10); fy = 3 + int(_hash(n, 6, seed) * 10)
        if m[fy, fx] > 2.0:
            rgb[fy - 1, fx] = MOMOa[6]; rgb[fy, fx] = MOMOa[4]; rgb[fy + 1, fx] = HASUa[3]
            al[fy - 1, fx] = al[fy, fx] = al[fy + 1, fx] = True
    return _cell(rgb, al)


def autotile_lotus(): return sheet_from_cells([lotus_cell(n) for n in range(16)])


SAMPLES = {'ground-grass': ground_grass, 'ground-grass-meadow': ground_grass_meadow, 'ground-grass-shade': ground_grass_shade,
           'ground-dirt': ground_dirt, 'ground-flagstone': ground_flagstone, 'ground-flagstone-moss': ground_flagstone_moss,
           'ground-brick': ground_brick, 'ground-dock': ground_dock}
AUTOS = {'autotile-canal': autotile_canal, 'autotile-wet-flagstone': autotile_wetflag, 'autotile-lotus': autotile_lotus, 'autotile-flagstone-curb': autotile_curb}


if __name__ == '__main__':
    import os
    os.makedirs(os.path.join(HERE, '_qa'), exist_ok=True)
    tiles = [f() for f in SAMPLES.values()]
    sh = Image.new('RGBA', (len(tiles) * 100, 100), (30, 30, 36, 255))
    for i, t in enumerate(tiles):
        big = Image.new('RGBA', (96, 96)); [big.paste(t, (x * 48, y * 48)) for x in range(2) for y in range(2)]
        sh.alpha_composite(big, (i * 100, 2))
    sh.resize((sh.width * 2, sh.height * 2), Image.NEAREST).save(os.path.join(HERE, '_qa', 'grounds.png'))
    au = [f() for f in AUTOS.values()]
    sh = Image.new('RGBA', (len(au) * 70, 68), (60, 110, 60, 255))
    for i, t in enumerate(au): sh.alpha_composite(t, (i * 70 + 2, 2))
    sh.resize((sh.width * 4, sh.height * 4), Image.NEAREST).save(os.path.join(HERE, '_qa', 'autos.png'))
    print('ok')
