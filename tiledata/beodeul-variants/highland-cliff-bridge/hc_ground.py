# 고원 절벽과 하늘 다리 — 바닥 표본(풀·마른 풀·맨땅·하늘) + 풀 덧그림.
# 풀 = 버들항 칩셋 풀 타일(잔디 0,128 / 들풀 304,304 / 그늘 풀 112,2144) 을 주기 잡음으로 섞는다(표본은 48 주기라 이어 붙여도 이음새 없음).
# 그 위에 칸마다 풀 포기(큰 것·작은 것)를 찍어 얼룩진 고원 풀 질감을 낸다. 마른 풀 = 칩셋 잔디 결의 밝기 순위를 누런 올리브(nuren)로.
# 하늘 = 단색 바탕(sora 4) + 옅은 가로 결 + 손으로 찍은 구름 덩이(가장자리 2px 안쪽만 — 어느 표본끼리 붙어도 이음새 없음).
import math
import numpy as np
from PIL import Image
from hc_base import *
from hc_base import _hash, _cell
import ground as G
from fr_base import tnoise

X, Y = X16, Y16


def _img(rgb, al=None):
    rgb = np.clip(rgb, 0, 255).astype(np.uint8)
    if al is None: return Image.fromarray(rgb, 'RGB').convert('RGBA')
    return Image.fromarray(np.dstack([rgb, np.where(al, 255, 0).astype(np.uint8)]), 'RGBA')


# ================================================================ 풀 포기 덧그림(칸 하나)
def tuft(rgb, al, ox, oy, big, ramp=None, mask=None):
    """풀 포기: 가운데 곧은 잎 + 양옆 비스듬한 잎(빛 = 끝, 그늘 = 밑) + 밑 그늘 점 2~3. big = 잎 5장(높이 5), 아니면 3장(높이 3)."""
    R = GRa if ramp is None else ramp
    if big:
        blades = ((0, 0, 3), (0, -1, 4), (0, -2, 5), (0, -3, 5), (0, -4, 6), (-1, -1, 4), (-2, -2, 5), (-2, -3, 6),
                  (1, -1, 4), (2, -2, 5), (3, -3, 6), (-1, 0, 3), (1, 0, 3))
        shade = ((-2, 1), (-1, 1), (0, 1), (1, 1), (2, 1))
    else:
        blades = ((0, 0, 3), (0, -1, 4), (0, -2, 6), (-1, -1, 5), (1, -1, 5), (-1, 0, 3), (1, 0, 3))
        shade = ((-1, 1), (0, 1), (1, 1))
    for (dx, dy) in shade:
        x_, y_ = (ox + dx) % 16, (oy + dy) % 16
        if mask is not None and not mask[y_, x_]: continue
        rgb[y_, x_] = R[2]; al[y_, x_] = True
    for (dx, dy, k) in blades:
        x_, y_ = (ox + dx) % 16, (oy + dy) % 16
        if mask is not None and not mask[y_, x_]: continue
        rgb[y_, x_] = R[k]; al[y_, x_] = True


def grass_overlay(kind, cx, cy, seed=120, ramp=None):
    """kind: 'tuft'(풀 포기 큰 것 0~1 + 작은 것 1~3), 'tufts'(빽빽: 큰 것 1~2 + 작은 것 2~4), 'mottle'(짙은 얼룩 점 + 작은 포기 1),
    'flower'(흰 별꽃 1~3 + 포기 하나). 칸 좌표마다 자리가 바뀐다. 반환 16x16 RGBA(투명 = 밑 풀)."""
    rgb = np.zeros((16, 16, 3), int); al = np.zeros((16, 16), bool)
    sd = seed + cx * 131 + cy * 71
    R = GRa if ramp is None else ramp
    if kind == 'mottle':
        dk = (hash2(X // 2 + cx * 8, Y // 2 + cy * 8, sd) > .62) & (hash2(X, Y, sd + 1) > .35)
        rgb = np.where(dk[..., None], R[3], rgb); al |= dk
        tuft(rgb, al, 3 + int(_hash(cx, cy, sd) * 10), 5 + int(_hash(cx, cy, sd + 1) * 9), False, R)
        return _cell(rgb, al)
    nb = {'tuft': (0 if _hash(cx, cy, sd + 2) < .55 else 1), 'tufts': 1 + int(_hash(cx, cy, sd + 2) * 2), 'flower': 0}[kind]
    ns = {'tuft': 1 + int(_hash(cx, cy, sd + 3) * 3), 'tufts': 2 + int(_hash(cx, cy, sd + 3) * 3), 'flower': 1}[kind]
    spots = []
    for i in range(nb + ns):
        for t in range(6):
            ox = 2 + int(_hash(i, t, sd + 4) * 12); oy = 5 + int(_hash(i, t, sd + 5) * 10)
            if all(abs(ox - a) + abs(oy - b) > 5 for a, b in spots): break
        spots.append((ox, oy))
        tuft(rgb, al, ox, oy, i < nb, R)
    if kind == 'flower':
        for i in range(1 + int(_hash(cx, cy, sd + 6) * 3)):
            fx = 2 + int(_hash(i, 1, sd + 7) * 12); fy = 2 + int(_hash(i, 2, sd + 7) * 12)
            for (dx, dy, c) in ((1, 0, WASHI[6]), (0, 1, WASHI[5]), (2, 1, WASHI[5]), (1, 2, WASHI[4]), (1, 1, GOLD[5]), (1, 3, GRa[2])):
                x_, y_ = (fx + dx) % 16, (fy + dy) % 16
                rgb[y_, x_] = c; al[y_, x_] = True
    return _cell(rgb, al)


# ================================================================ 바탕 풀 섞기(주기 잡음 → 이음새 없는 표본 / 지도 전체)
_GT = {}
def _gtex():
    if not _GT:
        _GT['lawn'] = recolor(G.tex(0, 128), NFGRASS, 2.7, 5.1)[0].astype(int)            # 장르 규격 nfgrass(칩셋 풀 결의 밝기 순위)
        _GT['meadow'] = recolor(G.tex(304, 304), NFGRASS, 2.9, 5.6)[0].astype(int)
        _GT['shade'] = recolor(G.tex(112, 2144), NFGRASS, 1.6, 4.2)[0].astype(int)
        dry, _ = recolor(G.tex(304, 304), NUREN, 3.6, 5.6); _GT['dry'] = dry.astype(int)
        dry2, _ = recolor(G.tex(0, 128), NUREN, 3.8, 5.4); _GT['drylawn'] = dry2.astype(int)
    return _GT


def grass_mix(Wp, Hp, seed=4, periodic=True, dry=0.0):
    """버들항 칩셋 풀 셋을 덩이로 섞는다. 잔디(바탕) · 들풀(밝은 덩이) · 그늘 풀(짙은 덩이 — 얼룩) [· 마른 풀 dry 비율].
    periodic = 주기 잡음(표본이 이어 붙는다). 덩이 경계는 화소 디더(칸 격자가 보이지 않는다)."""
    T = _gtex()
    Yp, Xp = np.mgrid[0:Hp, 0:Wp]
    tl = lambda t: t[Yp % 16, Xp % 16]
    nz = (lambda sc, sd: tnoise(Wp, Hp, sc, sd)) if periodic else (lambda sc, sd: G.smooth(Wp, Hp, sc, sd))
    dith = (hash2(Xp, Yp, seed + 9) - .5) * .12
    out = tl(T['lawn']).copy()
    n1 = nz(24, seed) * .65 + nz(12, seed + 1) * .35
    m = n1 + dith > .5; out[m] = tl(T['meadow'])[m]
    n2 = nz(16, seed + 2) * .7 + nz(8, seed + 3) * .3
    m = n2 + dith * 2 > .76; out[m] = tl(T['shade'])[m]
    if dry > 0:
        n3 = nz(24, seed + 4) * .6 + nz(12, seed + 5) * .4
        m = n3 + dith > 1 - dry; out[m] = tl(T['dry'])[m]
    return out


def ground_grass(kinds=('tuft',), dry=0.0, seed=4, mottle=.4):
    """바닥 표본 3x3(48x48): 섞은 칩셋 풀 + 칸마다 풀 포기 덧그림."""
    base = _img(grass_mix(48, 48, seed, True, dry))
    for cy in range(3):
        for cx in range(3):
            h = _hash(cx, cy, seed + 31)
            k = 'mottle' if h < mottle else kinds[int(_hash(cx, cy, seed + 32) * len(kinds))]
            base.alpha_composite(grass_overlay(k, cx, cy, seed), (cx * 16, cy * 16))
    return base


def ground_dry():
    """마른 고원 풀: 누런 올리브 풀(칩셋 결 밝기 순위) + 초록 풀 덩이가 얼룩으로 + 올리브 풀 포기."""
    T = _gtex()
    Yp, Xp = np.mgrid[0:48, 0:48]
    out = T['dry'][Yp % 16, Xp % 16].copy()
    n = tnoise(48, 48, 8, 51) * .5 + tnoise(48, 48, 4, 52) * .5
    m = n + (hash2(Xp, Yp, 53) - .5) * .3 > .7; out[m] = T['meadow'][Yp % 16, Xp % 16][m]
    m = n + (hash2(Xp, Yp, 54) - .5) * .12 < .3; out[m] = T['drylawn'][Yp % 16, Xp % 16][m]
    base = _img(out)
    for cy in range(3):
        for cx in range(3):
            base.alpha_composite(grass_overlay('tuft' if _hash(cx, cy, 55) > .4 else 'mottle', cx, cy, 57, ramp=NURENa), (cx * 16, cy * 16))
    return base


# ================================================================ 맨땅(밟아 다진 누런 흙)
def dirt_rgb(Xa, Ya, seed=61):
    """맨땅 화소: michi 톤 3·4 바탕(4px 덩이 얼룩) + 밝은 알갱이 점 + 작은 자갈(왼 위 빛·오른 아래 그늘) + 마른 풀 줄기 점."""
    blob = (hash2(Xa // 4, Ya // 3, seed) > .5) | (hash2((Xa + 2) // 4, (Ya + 1) // 3, seed + 5) > .8)
    t = np.where(blob, 5, 4)
    t = np.where(hash2(Xa, Ya, seed + 1) > .9, t + 1, t)
    t = np.where(hash2(Xa, Ya, seed + 2) < .06, 3, t)
    rgb = MICHIa[np.clip(t, 1, 6)].copy()
    peb = (hash2(Xa // 3, Ya // 3, seed + 3) > .93)
    pl = peb & (Xa % 3 == 0) & (Ya % 3 == 0)
    pd = peb & (Xa % 3 == 1) & (Ya % 3 == 1)
    rgb = np.where(pl[..., None], STa_[5], rgb); rgb = np.where(pd[..., None], MICHIa[2], rgb)
    stem = hash2(Xa, Ya // 2, seed + 4) > .975
    rgb = np.where(stem[..., None], NURENa[4], rgb)
    return rgb


def ground_dirt():
    Yp, Xp = np.mgrid[0:48, 0:48]
    return _img(dirt_rgb(Xp % 16, Yp % 16) if False else dirt_rgb(Xp, Yp))


# ================================================================ 하늘
def sky_rgb(Wp, Hp, seed=71, streaks=4):
    """하늘 바탕: sora 4 단색 + 성긴 옅은 가로 결(sora 5 체크 디더, 길이 6~14, 가장자리 2px 안쪽에만 — 격자 반복이 생기지 않게
    표본마다 씨앗으로 자리를 바꾼다)."""
    Yp, Xp = np.mgrid[0:Hp, 0:Wp]
    rgb = np.zeros((Hp, Wp, 3), int) + SORAa[4]
    for i in range(streaks):
        L = 6 + int(_hash(i, 1, seed) * 9); sx = 2 + int(_hash(i, 2, seed) * (Wp - L - 4)); sy = 2 + int(_hash(i, 3, seed) * (Hp - 5))
        for t in range(L):
            if _hash(sx + t, sy, seed + 5) < (.45 if t in (0, L - 1) else .12): continue
            rgb[sy, sx + t] = SORAa[5]
    return rgb


def cloud_blob(tc, cx, cy, w, h, seed, lo=0):
    """손 구름 덩이(톤 캔버스에): 크고 작은 둥근 혹 4~7개 합집합(가운데가 높다), 밑변은 거의 평평.
    윗모 kumo 6, 혹 위쪽 절반 kumo 6/5 체크, 속 kumo 4, 밑 두 줄 kumo 3·2(푸른 그늘), 혹과 혹 사이 골에 kumo 4 한 줄."""
    n = 4 + int(_hash(seed, 1, 7) * 4)
    blobs = []
    for k in range(n):
        t = (k + .5) / n
        bx = cx - w / 2 + t * w + (_hash(seed, k, 3) - .5) * w * .1
        r = (w / n) * (.75 + _hash(seed, k, 4) * .55) * (.7 + .6 * math.sin(math.pi * t))
        r = max(2.2, min(r, h * 1.0))
        by = cy - r * .55 - (h * .35) * math.sin(math.pi * t) * (.6 + .4 * _hash(seed, k, 5))
        blobs.append((bx, by, r))
    cells = {}
    for yy in range(int(cy - h * 2 - 4), int(cy) + 1):
        for xx in range(int(cx - w / 2 - 6), int(cx + w / 2 + 7)):
            best = None
            for j, (bx, by, r) in enumerate(blobs):
                d = math.hypot(xx + .5 - bx, (yy + .5 - by) * 1.15) / r
                if d <= 1.0 and (best is None or d < best[1]): best = (j, d, (yy + .5 - by) / r)
            if best: cells[(xx, yy)] = best
    for (x, y), (j, d, v) in cells.items():
        above = (x, y - 1) in cells; b1 = (x, y + 1) in cells; b2 = (x, y + 2) in cells
        if not above: k = 6
        elif not b1: k = 2
        elif not b2: k = 3
        elif v < -.35: k = 6 if (x + y) % 2 == 0 else 5
        elif v < .05: k = 5
        else: k = 4
        if above and cells[(x, y - 1)][0] != j and v < -.2: k = 4                      # 혹 사이 골
        tc.px(x, y, 'kumo', clamp(k - lo, 1, 6))
    for (x, y) in list(cells):
        if (x, y + 1) not in cells and _hash(x, y, seed + 11) > .35: tc.px(x, y + 1, 'sora', 5)


def sky_sample(kind, seed=0):
    """하늘 표본 48x48 셋: 'clear'(맑은 하늘: 결만 + 아주 작은 구름 한 점), 'puffs'(작은 뭉게구름 둘~셋), 'drift'(가로로 길게 흐르는 엷은 구름 하나 + 작은 것).
    구름은 표본 가장자리 3px 안쪽에만 둔다 → 어떤 표본끼리 붙어도, 좌우 뒤집어도 이음새가 없다."""
    rgb = sky_rgb(48, 48, seed=71 + seed * 7, streaks={'clear': 5, 'puffs': 3, 'drift': 3}[kind])
    tc = TC(48, 48, seed)
    if kind == 'clear':
        pass
    elif kind == 'puffs':
        cloud_blob(tc, 18, 24, 26, 11, seed + 2); cloud_blob(tc, 35, 43, 16, 6, seed + 3, lo=1)
    elif kind == 'drift':
        cloud_blob(tc, 24, 32, 32, 7, seed + 5, lo=1); cloud_blob(tc, 33, 14, 14, 5, seed + 6, lo=1)
    im = tc.img(); a = np.array(im)
    on = a[..., 3] > 0
    rgb = np.where(on[..., None], a[..., :3], rgb)
    return _img(rgb)


def cloud_bank(w=4, h=2, seed=0):
    """하늘 위 큰 구름 덩이(물체가 아니라 하늘 칸 위 장식) w x h 칸, 투명 바탕."""
    tc = TC(w * 16, h * 16, seed)
    cloud_blob(tc, w * 8, h * 16 - 3, w * 16 - 8, h * 6, seed)
    return tc.img()


if __name__ == '__main__':
    import os
    ims = [ground_grass(('tuft',)), ground_grass(('tufts', 'tuft', 'flower'), seed=8, mottle=.3), ground_dry(), ground_dirt(),
           sky_sample('clear'), sky_sample('puffs', 3), sky_sample('drift', 5)]
    o = Image.new('RGB', (len(ims) * 150, 300), (28, 28, 34))
    for i, im in enumerate(ims):
        t = Image.new('RGBA', (144, 144))
        for yy in range(3):
            for xx in range(3): t.alpha_composite(im, (xx * 48, yy * 48))
        o.paste(t.convert('RGB'), (i * 150, 0))
        o.paste(im.resize((144, 144), Image.NEAREST).convert('RGB'), (i * 150, 150))
    o = o.resize((o.width * 2, o.height * 2), Image.NEAREST)
    o.save(os.path.join(HERE, '_qa', 'grounds.png'))
