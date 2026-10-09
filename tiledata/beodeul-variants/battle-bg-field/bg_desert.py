# 전투 배경 4 — 사막 (desert-pyramid). 바닥·물체 = src-desert/ 의 복사한 그림 함수
# (모래 sand_rgb·잔물결·오아시스 풀/물·언덕 능선 _dune·카라반 길 오토타일·야자·선인장·오벨리스크).
# 먼 피라미드는 원 지도 pyramid() 와 같은 규칙(단·디딤·가운데 계단·사암 마름돌 sash)으로 작게 새로 찍는다(축소 아님).
import os, sys, random, math
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, 'src-desert'))
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
import bgkit as K
from dp_bd import Scene, ground
import dp_wl as wl
import dp_art as A
import dp_auto as U
import dp_props as PP
import dp_pyr as Y
from dp_art import SS, SA, mix, mul, sash
import pz

SLUG = 'desert-pyramid'
CW, CH = 40, 23
Wp, Hp = CW * 16, CH * 16


def far_pyramid(W=172, NT=6, rh=(12, 8, 8, 8, 8, 8), td=5, ss=13, sw=7, seed=0, ruin=True):
    """계단식 사암 피라미드(원경): 원 pyramid() 의 단·디딤·가운데 계단·무너진 오른쪽 위 규칙을 작은 마름돌(10x5)로."""
    tiers = []; y = 0
    Hh = sum(rh) + NT * td + 12
    o = Image.new('RGBA', (W, Hh)); px = o.load()
    def put(x, yy, c):
        if 0 <= x < W and 0 <= yy < Hh: px[x, yy] = tuple(c[:3]) + (255,)
    yb = Hh - 2; y = yb
    for i in range(NT):
        x0, x1 = i * ss, W - i * ss
        fb = y; ft = fb - rh[i]
        tiers.append((x0, x1, ft, fb)); y = ft - td
    top_y = y - 3
    for i in range(NT):                                         # 윗면(디딤): 왼쪽 밝음
        x0, x1, ft, fb = tiers[i]
        ytop = (tiers[i + 1][2] - td) if i + 1 < NT else top_y
        for yy in range(ytop, ft):
            for x in range(x0, x1):
                if i + 1 < NT:
                    nx0, nx1, nft, nfb = tiers[i + 1]
                    if nx0 <= x < nx1 and yy >= nft: continue
                lit = x < W / 2
                c = mix(sash(x, yy, bw=14, bh=3, seed=11 + i + seed), SS[5], 0.72 if lit else 0.45)
                if yy == ft - 1: c = SS[6] if lit else SS[5]
                if x == x0: c = SS[6]
                elif x >= x1 - 1: c = SS[3]
                put(x, yy, c)
    for i in range(NT):                                         # 앞면(마름돌): 디딤보다 한 단 어둡다
        x0, x1, ft, fb = tiers[i]
        for yy in range(ft, fb + 1):
            for x in range(x0, x1):
                z = fb - yy
                c = mul(sash(x + i * 5, 200 - z, bw=10, bh=5, seed=21 + i + seed), 0.94)
                if x == x0: c = SS[5]
                if x >= x1 - 2: c = mul(c, 0.85)
                if yy == ft: c = SS[2]
                put(x, yy, c)
    cx = W // 2; bw_ = 3
    ys = tiers[1][3]; ye = top_y + 1
    for yy in range(ye, ys + 1):                                # 가운데 계단 + 난간
        k = ys - yy
        for x in range(cx - sw - bw_, cx + sw + bw_):
            dx = x - cx
            if abs(dx) < sw:
                ph = k % 3
                c = (SS[6] if dx < 0 else SS[5]) if ph == 0 else (SS[4] if ph == 1 else SS[2])
                if dx > sw - 2: c = mul(c, 0.85)
            else:
                u = abs(dx) - sw
                c = SS[6] if u < 1 else (SS[5] if u < 2 else SS[3])
                if dx > 0: c = mix(c, SS[3], 0.35)
            put(x, yy, c)
    if ruin:                                                    # 오른쪽 위가 계단꼴로 무너졌다(심석)
        xa, xb = cx + sw + bw_ + 14, tiers[2][1] - 3
        ya, yb2 = tiers[4][2] - 3, tiers[2][2] - 2
        x = xa
        while x < xb:
            st = 3 + int(K.h2(x, 1, seed) * 5)
            t = (x - xa) / max(1, xb - xa)
            yc = int(ya + (yb2 - ya) * t ** 0.8 + (K.h2(x, 2, seed) - 0.5) * 4)
            for xx in range(x, min(xb, x + st)):
                for yy in range(0, yc): px[xx, yy] = (0, 0, 0, 0)
                for yy in range(yc, tiers[2][2]):
                    if px[xx, yy][3] == 0: continue
                    d = yy - yc
                    c = mul(sash(xx * 3 // 4 + 11, yy + 5, bw=6, bh=4, seed=47), 0.78)
                    if d == 0: c = SS[6]
                    elif d == 1: c = SS[3]
                    put(xx, yy, c)
            x += st
        for xx in range(xb, W):
            for yy in range(0, tiers[2][2] - td):
                px[xx, yy] = (0, 0, 0, 0)
    x0, x1, ft, fb = tiers[0]                                   # 입구
    for yy in range(fb - 9, fb):
        for x in range(cx - 4, cx + 4):
            put(x, yy, SS[0] if yy > fb - 8 else SS[1])
    for x in range(cx - 6, cx + 6): put(x, fb - 10, SS[6]); put(x, fb - 11, SS[5])
    im = pz.fin(o); p = im.load()
    for (hx_, w_, h_, sd) in ((10, 22, 7, 71), (W * 0.32, 14, 4, 72), (W * 0.70, 18, 5, 73), (W - 12, 24, 8, 74)):   # 밑동에 쌓인 모래(원 그림과 같은 _sand_heap)
        Y._sand_heap(p, W, Hh, int(hx_), yb + 1, w_ // 2, h_, sd + seed)
    return im


def backdrop():
    b = K.canvas()
    K.sky(b, [(40, '#6aa0dc'), (86, '#8cbce6'), (126, '#b4dcf4'), (156, '#d4ecf6'), (180, '#f6eccc')])
    CL = ['#b4dcf4', '#d4ecf6', '#eef8ff', '#f7fdff']
    K.cloud(b, 520, 40, 80, 12, CL, seed=21, flat=True)
    K.cloud(b, 120, 66, 60, 8, CL, seed=23, flat=True)
    # 먼 모래 언덕(사암 램프 옅은 쪽) → 피라미드 → 가까운 언덕
    K.ridge(b, 152, 16, ['#bf8e58', '#dcaf6c', '#eccb86', '#f8e2a4'], seed=51, sc=110, sc2=31)
    P1 = far_pyramid(); P2 = far_pyramid(W=96, NT=4, rh=(9, 7, 7, 7), td=4, ss=11, sw=5, seed=5, ruin=False)
    K.place(b, P2, 412, 150, shadow=False)
    K.place(b, P1, 196, 156, shadow=False)
    K.ridge(b, 166, 9, ['#ac7044', '#bf8e58', '#dcaf6c', '#eccb86'], seed=53, sc=80, sc2=19)
    return b


def floor(s, LAWN_PX, WATER_PX, TRAIL, DUNES):
    """원 지도 render() 의 모래·오아시스·길·언덕 순서 그대로(폭만 화면에 맞춤)."""
    img, lab = ground.render(Wp, Hp, [], np.zeros((Hp, Wp), bool), s.seed)
    Yy, Xx = np.mgrid[0:Hp, 0:Wp]
    nz = A.Noise(Wp, Hp)
    rip = 0.45 * (0.6 + 0.6 * A.vn_full(Wp, Hp, 40, 7))
    rip = rip * np.where(Yy < 186, 0.4, 1.0)
    sand = A.sand_rgb(Xx, Yy, nz, rip, seed=91)
    near = ndi.binary_dilation(LAWN_PX, iterations=3) & ~LAWN_PX
    damp = ndi.binary_dilation(LAWN_PX, iterations=1) & ~LAWN_PX
    sand = np.where(damp[..., None], A.P('sand')[2], sand)
    tuft = near & (wl.hash2(Xx, Yy, 43) > 0.80)
    LW = np.array([K.hx(c) for c in ('#4b8232', '#579f35', '#73b83e', '#8fd24a')])
    sand = np.where(tuft[..., None], LW[(wl.hash2(Xx, Yy, 44) * 4).astype(int).clip(0, 3)], sand)
    img.alpha_composite(Image.fromarray(np.dstack([sand.astype(np.uint8), np.where(LAWN_PX, 0, 255).astype(np.uint8)]), 'RGBA'))
    sheet = U.trail()
    img.alpha_composite(K.auto_layer(sheet, TRAIL, edge_on=True))
    for (im, x, y) in DUNES: img.alpha_composite(im, (x, y))
    wm = WATER_PX
    if wm.any():
        dist = ndi.distance_transform_edt(wm)
        wt = np.where(dist < 2, 4, np.where(dist < 5, 3, np.where(dist < 10, 2, 1)))
        rip_w = (np.mod(Yy + np.rint(np.sin(Xx / 6.0) * 1.2), 6) == 0) & (A.vn_full(Wp, Hp, 7, 63) > 0.62) & (dist > 2)
        wt = np.where(rip_w, np.minimum(wt + 2, 5), wt)
        wt = np.where((dist >= 1) & (dist < 1.5), 6, wt)
        wrgb = A.P('oasis')[np.clip(wt, 0, 6)]
        img.alpha_composite(Image.fromarray(np.dstack([wrgb.astype(np.uint8), np.where(wm, 255, 0).astype(np.uint8)]), 'RGBA'))
    return img


def gen_dune(rng, wc, hc, sd):
    Wd, Hd = wc * 16, hc * 16
    base = Hd * (0.55 + rng.random() * 0.1); amp = Hd * (0.18 + rng.random() * 0.14)
    skew = 0.35 + rng.random() * 0.3; ph = rng.random() * 6.28; wa = 0.6 + rng.random() * 1.2
    pts = []
    for x in range(2, Wd - 1, 3):
        t = (x - 2) / (Wd - 4)
        arch = math.sin(math.pi * (t ** (math.log(0.5) / math.log(skew))))
        pts.append((x, base - amp * arch + wa * math.sin(x / 9.0 + ph)))
    return PP._dune(Wd, Hd, pts, sd)


def build():
    s = Scene('bg-desert', CW, CH, seed=90)
    rng = random.Random(9061)
    Yy, Xx = np.mgrid[0:Hp, 0:Wp]
    # 오아시스(오른쪽 뒤): 풀밭 고리 + 못, 화소 모양
    def blob(cx, cy, rx, ry, seed, rough):
        X = (Xx + 0.5) / 16.0; Yc = (Yy + 0.5) / 16.0
        ang = np.arctan2(Yc - cy, X - cx)
        r = 1 + rough * (np.sin(ang * 3 + seed) * 0.6 + np.sin(ang * 5 + seed * 2.1) * 0.4) + (A.vn_full(Wp, Hp, 20, seed + 9) - 0.5) * 0.12
        return ((X - cx) / rx) ** 2 + ((Yc - cy) / ry) ** 2 < r * r
    LAWN_PX = blob(36.5, 11.6, 5.2, 1.9, 2, 0.14)
    WATER_PX = blob(36.2, 11.9, 2.8, 0.8, 5, 0.10) & (Yy >= 178)
    TRAIL = [[False] * CW for _ in range(CH)]
    for x in range(CW):
        for y in (17, 18): TRAIL[y][x] = True
    DUNES = []
    for (cx, cy, wc, hc, fl) in ((0, 14, 6, 3, 0), (34, 15, 6, 3, 1), (1, 21, 7, 3, 1), (33, 21, 7, 3, 0), (12, 12, 5, 2, 0), (24, 12, 5, 2, 1)):
        im = gen_dune(rng, wc, hc, 800 + cx * 3 + cy)
        if fl: im = im.transpose(Image.FLIP_LEFT_RIGHT)
        DUNES.append((im, cx * 16, (cy + 1) * 16 - im.height))
    s.overlays.append((floor(s, LAWN_PX, WATER_PX, TRAIL, DUNES), 0, 0))
    # ---------------------------------------------------------- 오아시스 야자(뒤 오른쪽) · 갈대
    for (n, x, y, fl) in (('palm_tall', 32, 11, 0), ('palm_short', 35, 10, 1), ('palm_tall', 37, 11, 1), ('palm_young', 39, 12, 0), ('palm_lean', 29, 11, 1)):
        im = getattr(PP, n)(); im = im.transpose(Image.FLIP_LEFT_RIGHT) if fl else im
        s.at(im, x, y, block=None)
    s.at(PP.reeds(), 34, 12, block=None, shadow=False)
    s.at(PP.reeds(), 38, 12, block=None, dx=6, shadow=False)
    # ---------------------------------------------------------- 왼쪽 뒤: 쓰러진 오벨리스크·부러진 기둥·수호 짐승상(유적 끝자락)
    s.at(Y.obelisk(), 2, 11, block=None) if hasattr(Y, 'obelisk') else None
    for (n, x, y, dx) in (('column_broken', 5, 11, 0), ('obelisk_fallen', 6, 12, 4), ('beast_statue', 0, 13, 4), ('sand_block', 9, 12, 0)):
        mod = Y if hasattr(Y, n) else PP
        s.at(getattr(mod, n)(), x, y, block=None, dx=dx)
    # ---------------------------------------------------------- 가장자리 앞: 선인장·바위·뼈·마른 풀
    for (n, x, y, dx) in (('cactus_branch', 1, 17, 0), ('sand_boulder', 4, 19, 0), ('cactus_column', 6, 15, 4), ('skull', 2, 21, 6),
                          ('rock_spire', 36, 18, 0), ('cactus_barrel', 34, 20, 4), ('sand_boulder_s', 38, 21, 0), ('ribcage', 35, 15, 0),
                          ('dry_tuft', 7, 20, 0), ('dry_tuft', 32, 18, 0), ('tumbleweed', 31, 21, 4), ('pebbles', 5, 22, 0), ('pot_shards', 37, 16, 0)):
        mod = Y if hasattr(Y, n) else PP
        s.at(getattr(mod, n)(), x, y, block=None, dx=dx)
    im = s.render()
    hz = K.horizon_line(seed=13, base=176, amp=3)
    out = K.compose(backdrop(), im, s.objs, hz, rim='#dcaf6c', tufts=None, seed=13)
    return K.finish(out)


if __name__ == '__main__':
    im = build()
    im.save(os.path.join(HERE, SLUG + '.png'))
    print(SLUG, im.size, K.ncolors(im))
