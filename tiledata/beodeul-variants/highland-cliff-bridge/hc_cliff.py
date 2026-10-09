# 고원 절벽과 하늘 다리 — 주황·갈색 절벽 앞면(3줄) · 절벽 끝/안 모서리 · 하늘로 떨어지는 절벽 밑동 · 가장자리 오토타일 둘.
# 절벽 결(cliff_k): 층진 비늘 돌(줄 높이 6px, 줄마다 엇갈린 폭 7~9px 돌 — 돌마다 왼 위 빛 · 오른 아래 그늘 · 사이 어두운 틈)
#   + 세로 결 주름(13~19px 마다 흔들리는 어두운 골과 그 왼쪽 빛 줄) + 위 턱 밑 그늘 + 아래로 갈수록 한 단 어둡게.
# 결은 전역 화소 좌표로 정해서 이웃 칸·이웃 조각과 이어진다. 앞면 높이는 3줄(48px) — 천장 밑 벽 규칙.
#   autotile-cliff-lip  고원 끝 흙 턱(낮은 땅·절벽 앞면 쪽 가장자리): 주황 흙덩이가 울퉁불퉁 둥근 턱 + 풀 술이 늘어진다. 걷기(턱 칸은 고원).
#   autotile-sky-rim    하늘 칸 가장자리(땅 쪽): 하늘과 맞닿은 고원 북쪽·옆 가장자리를 둥글고 울퉁불퉁한 흙 턱 + 풀로 덮는다. 막힘(하늘).
import math
import numpy as np
from PIL import Image
from hc_base import *
from hc_base import _hash, _cell
import hc_ground as HG

X, Y = X16, Y16
FH = 48                                   # 절벽 앞면 높이 px(3줄)


def _scale(X, Y, seed):
    """층진 비늘 돌: 줄 높이 6px, 줄마다 반 칸 엇갈린 돌 중심(간격 7px, 흔들림). 가장 가까운 중심 = 돌, 둘째와 차이 작음 = 틈.
    반환 (dx, dy, gap, 돌 해시) — dx·dy 는 돌 중심에서 화소까지(정규화)."""
    RH, SP = 6, 7.0
    r0 = Y // RH
    best = (1e9, 0, 0, 0); second = 1e9
    for r in (r0 - 1, r0, r0 + 1):
        off = (r % 2) * SP * .5 + _hash(r, 0, seed + 1) * 2
        i0 = int((X - off) // SP)
        for i in (i0 - 1, i0, i0 + 1):
            cx = off + (i + .5) * SP + (_hash(i, r, seed + 2) - .5) * 2.2
            cy = r * RH + 3 + (_hash(i, r, seed + 3) - .5) * 1.4
            dx = (X + .5 - cx) / (SP * .55); dy = (Y + .5 - cy) / (RH * .55)
            d = math.hypot(dx, dy)
            if d < best[0]: second = best[0]; best = (d, dx, dy, _hash(i, r, seed + 4))
            elif d < second: second = d
    return best[1], best[2], (second - best[0]) < .22, best[3]


def cliff_k(X, Y, fy, H=FH, seed=5):
    """절벽 앞면 한 화소의 톤(1..6). X, Y = 전역 화소, fy = 앞면 맨 위에서 아래로 px."""
    dx, dy, gap, hs = _scale(X, Y, seed)
    t = 3.4 + (.8 if hs > .75 else 0) - (.8 if hs < .15 else 0)
    l = -(dx * .7 + dy * 1.0)                                                # 왼 위 빛
    t += 1.6 * l
    if dy > .55: t -= .8                                                     # 돌 밑 그늘
    if gap: t = 1.1
    v = 0
    # 세로 결 주름
    fx = X + 3 * math.sin(Y / 8.5 + seed) + 2 * math.sin(Y / 3.7)
    per = 16 + int(_hash(int(fx) // 16, 3, seed + 4) * 4)
    f = fx % per
    if f < 1.2: t = min(t, 1.6)
    elif f < 2.6: t -= .9
    elif f > per - 2.2 and not gap: t += .7
    # 높이에 따른 밝기: 위 1/3 밝고 아래로 어둡게, 턱 밑 그늘
    t += .5 - fy / H * 1.1
    if fy < 2: t = min(t, 1.5)
    elif fy < 4: t -= 1
    return int(max(1, min(6, round(t))))


def face_pixels(X0, Y0, w, foot='ground', endW=False, endE=False, innerW=False, innerE=False, seed=5, H=FH):
    """앞면 w px x H px 를 그린 RGBA 배열. X0, Y0 = 전역 화소(앞면 맨 위). foot: 'ground'(발치 그늘 + 풀 술) | 'sky'(밑이 울퉁불퉁 들려 하늘이 보인다).
    endW/endE = 그쪽이 절벽 끝(바깥 모서리): 위 모서리가 둥글게 깎이고 3px 가 돌아 들어가며 어두워진다(바깥 = 투명).
    innerW/innerE = 그쪽에 고원 옆면이 붙는 안 모서리: 2px 짙은 골 + 옆 턱 그림자."""
    rgb = np.zeros((H, w, 3), int); al = np.zeros((H, w), bool)
    for y in range(H):
        for x in range(w):
            X = X0 + x; Y = Y0 + y
            # 바깥 모서리: 둥근 위 모서리 + 옆으로 돌아 들어가는 면
            ex = None
            if endW: ex = x
            if endE: ex = w - 1 - x if ex is None else min(ex, w - 1 - x)
            if ex is not None:
                cut = 4.5 - math.sqrt(max(0, 4.5 ** 2 - max(0, 4.5 - y) ** 2)) if y < 4.5 else 0
                cut += 1.0 + .8 * _hash(X, Y // 3, seed + 21) if y > 4 else 0
                if ex < cut: continue
            if foot == 'sky':
                tooth = 6 + int(4 * _hash(X // 3, 7, seed + 22) + 3 * _hash(X // 5, 8, seed + 23))
                if ex is not None: tooth += max(0, 6 - ex)
                if y >= H - tooth + (3 if (X // 3) % 2 else 0) * (0 if tooth > 9 else 1): continue
            k = cliff_k(X, Y, y, H, seed)
            if ex is not None and ex < 4: k = max(1, k - (4 - int(ex)))
            if innerW and x < 3: k = 1 if x == 0 else max(1, k - 2)
            if innerE and x > w - 4: k = 1 if x == w - 1 else max(1, k - 2)
            if foot == 'ground' and y >= H - 3: k = 1 if y == H - 1 else max(1, k - 1)
            rgb[y, x] = DANa[k]; al[y, x] = True
    if foot == 'sky':                                                          # 들린 밑동: 맨 아래 화소 줄은 짙게(바위 밑면)
        for x in range(w):
            col = np.nonzero(al[:, x])[0]
            if len(col):
                yb = col.max()
                rgb[yb, x] = DANa[1]
                if yb - 1 >= 0 and al[yb - 1, x]: rgb[yb - 1, x] = DANa[2]
    # 턱 밑으로 늘어진 풀 술·덩굴(위 3~8px)
    for i in range(max(1, w // 7)):
        fx = int(_hash(i, X0 // 16, seed + 9) * (w - 2)) + 1
        if not al[0, fx]: continue
        L = 3 + int(_hash(i, X0, seed + 10) * 6)
        for j in range(L):
            xx = fx + (j // 3) * (1 if (i + X0 // 16) % 2 else -1)
            if 0 <= xx < w and al[j, xx]: rgb[j, xx] = GRa[4 if j < L - 2 else 3]
    if foot == 'ground':                                                       # 발치 풀 술
        for x in range(w):
            if al[H - 1, x] and _hash(X0 + x, 1, seed + 12) < .35:
                rgb[H - 1, x] = GRa[3]
                if _hash(X0 + x, 2, seed + 12) < .5: rgb[H - 2, x] = GRa[4]
    return rgb, al


def face_img(X0, Y0, w, **kw):
    rgb, al = face_pixels(X0, Y0, w, **kw)
    return Image.fromarray(np.dstack([np.clip(rgb, 0, 255).astype(np.uint8), np.where(al, 255, 0).astype(np.uint8)]), 'RGBA')


# ================================================================ 조각(1칸 폭 x 3줄, 결 자리는 조각마다 고정)
def cliff_piece(kind, cx=3, foot='ground'):
    """kind: 'mid'(가운데 앞면) · 'end_w'/'end_e'(바깥 모서리) · 'inner_w'/'inner_e'(안 모서리) · 'wide'(4칸 넓은 앞면)."""
    if kind == 'wide': return face_img(cx * 16, 0, 64, foot=foot)
    return face_img(cx * 16, 0, 16, foot=foot, endW=kind == 'end_w', endE=kind == 'end_e', innerW=kind == 'inner_w', innerE=kind == 'inner_e')


def face_sample():
    """절벽 앞면 표본 3x3(48x48): 가로로 이어 붙여도 결이 이어진다(앞면 높이 3줄 그대로 = 세로로는 한 번만 쓴다)."""
    rgb, al = face_pixels(0, 0, 48, foot='ground')
    return Image.fromarray(np.dstack([rgb.astype(np.uint8), np.full((48, 48), 255, np.uint8)]), 'RGBA')


# ================================================================ 오토타일 ① 고원 끝 흙 턱(cliff-lip)
def _crust(rgb, al, m, band, seed, X0=0, Y0=0, grass_side=True):
    """흙 턱 띠: m(바깥 경계에서 안쪽 px)이 band 보다 작은 곳. 바깥 → 안: 짙은 밑모(dan 2) → 흙덩이 몸(dan 4·3) → 둥근 윗모 빛(dan 5·6)
    → 풀 가장자리 그늘(leaf 2). 흙덩이는 4~6px 폭 둥근 혹(가로로 이어지는 둥근 혹의 줄)."""
    for y in range(16):
        for x in range(16):
            d = m[y, x]
            bw = band[y, x]
            if d >= bw + 1.2 or d < -0.01: continue
            if d >= bw:
                if grass_side: rgb[y, x] = GRa[2]; al[y, x] = True
                continue
            f = d / bw
            if f < .18: k = 2
            elif f < .45: k = 3 + (1 if _hash((X0 + x) // 2, (Y0 + y) // 2, seed + 3) > .55 else 0)
            elif f < .75: k = 4 + (1 if _hash((X0 + x) // 2, (Y0 + y) // 2, seed + 4) > .4 else 0)
            else: k = 6 if _hash(X0 + x, Y0 + y, seed + 5) > .35 else 5
            rgb[y, x] = DANa[k]; al[y, x] = True


def _bumps(X, Y, n, seed):
    """흙 턱 두께(px): 둥근 혹 4~6px 폭 — 칸 경계에서 두께가 같도록(이웃 칸과 이어진다) 16 주기 사인 합."""
    xx = np.arange(16) + .5
    b = 3.8 + 1.1 * np.abs(np.sin(np.pi * xx / 5.33 + _hash(seed, 1, 3) * 0)) + .5 * np.sin(2 * np.pi * xx / 16 * 2 + seed)
    return b


def lip_cell(n, seed=211):
    """고원 끝 흙 턱: 이웃이 빠진 쪽(낮은 땅·절벽 앞면 쪽) 가장자리를 둥근 흙덩이 턱 + 늘어진 풀 술로. 속(15)은 투명."""
    m, mN, mS = edges(n, inset=0.0, jag=1.4, rad=6.0, seed=seed)
    rgb = np.zeros((16, 16, 3), int); al = np.zeros((16, 16), bool)
    xx = np.arange(16) + .5
    bx = 3.6 + 1.3 * np.abs(np.sin(np.pi * xx / 5.33)) + .4 * np.sin(2 * np.pi * xx / 8 + 1.1)
    band = np.where(mS <= m + .01, bx[X], bx[Y] * .85)
    _crust(rgb, al, m, band, seed)
    # 남쪽 턱 위로 늘어진 풀 술(턱을 덮어 흙덩이가 끊긴다)
    if not (n & 4):
        for i in range(2):
            fx = 2 + int(_hash(n, i, seed + 7) * 11)
            for j in range(3 + int(_hash(n, i, seed + 8) * 3)):
                y_ = 16 - 6 + j
                if 0 <= y_ < 16 and al[y_, fx]: rgb[y_, fx] = GRa[4 if j < 2 else 3]
    return _cell(rgb, al)


def autotile_lip(): return sheet_from_cells([lip_cell(n) for n in range(16)])


# ================================================================ 오토타일 ② 하늘 가장자리(sky-rim)
_LAWN = None
def _lawn():
    global _LAWN
    if _LAWN is None: _LAWN = HG._gtex()['lawn']
    return _LAWN


def skyrim_cell(n, seed=223):
    """하늘 칸(막힘)의 땅 쪽 가장자리: 이웃이 땅인 쪽에 풀(칩셋 잔디 결) + 둥근 흙 턱(하늘 쪽으로 혹이 튀어나온다) + 턱 밑 짙은 바위 모.
    북쪽 땅(위)은 앞면이 보이는 절벽 자리라 이 오토타일은 쓰지 않는다(절벽 밑동 'sky' 조각 + 하늘 칸이 이어 받는다). 속(15)은 투명 = 하늘 표본."""
    m, mN, mS = edges(n, inset=2.4, jag=1.5, rad=6.0, seed=seed)
    rgb = np.zeros((16, 16, 3), int); al = np.zeros((16, 16), bool)
    land = m < 0
    rgb = np.where(land[..., None], _lawn()[Y, X], rgb); al |= land
    # 흙 턱: 땅 경계(m=0)에서 하늘 쪽으로 0~3px
    for y in range(16):
        for x in range(16):
            d = m[y, x]
            if 0 <= d < 3.2:
                k = 5 if d < .9 else (4 if d < 1.9 else (2 if d < 2.7 else 1))
                if d < .9 and _hash(x, y, seed + 2) < .3: k = 6
                rgb[y, x] = DANa[k]; al[y, x] = True
            elif -1.2 <= d < 0:
                rgb[y, x] = GRa[2] if _hash(x, y, seed + 3) > .3 else DANa[3]
    # 땅 위 풀 포기(가장자리 칸에만, 칸 번호마다 다른 자리)
    if n != 15:
        for i in range(2):
            ox = 3 + int(_hash(n, i, seed + 4) * 10); oy = 3 + int(_hash(n, i, seed + 5) * 10)
            if land[oy % 16, ox % 16] and m[oy % 16, ox % 16] < -2.5:
                HG.tuft(rgb, al, ox, oy, False, None, mask=land & (m < -1.5))
    return _cell(rgb, al)


def autotile_skyrim(): return sheet_from_cells([skyrim_cell(n) for n in range(16)])


if __name__ == '__main__':
    import os
    o = Image.new('RGBA', (16 * 16 + 64 * 2 + 40, 160), (28, 28, 34, 255))
    xs = 0
    for k in ('mid', 'end_w', 'end_e', 'inner_w', 'inner_e'):
        o.alpha_composite(cliff_piece(k), (xs, 0)); xs += 20
    for k in ('mid', 'end_w', 'end_e'):
        o.alpha_composite(cliff_piece(k, foot='sky'), (xs, 0)); xs += 20
    o.alpha_composite(cliff_piece('wide'), (xs, 0)); xs += 68
    o.alpha_composite(face_sample(), (xs, 0)); xs += 52
    o.alpha_composite(autotile_lip(), (0, 60)); o.alpha_composite(autotile_skyrim(), (70, 60))
    o.resize((o.width * 4, o.height * 4), Image.NEAREST).save(os.path.join(HERE, '_qa', 'cliff.png'))
