# 대나무 숲 계곡 — 바닥 표본·땅 덩이 오토타일·지도 바닥 합성.
# 풀 = 버들항 ground.render(칩셋 풀 섞기), 흙 = 칩셋 흙(16,224), 판석 = 돌담 막돌 규칙 윗면(ek_ground.flag_k), 물 = 버들항 운하 물 톤(MIZU).
# 오토타일 16변형(칸 번호 = 위 1 + 오른쪽 2 + 아래 4 + 왼쪽 8). 가장자리는 ek_wave5.edges(모든 변형에 같은 씨앗 → 이웃 칸 윤곽이 이어진다),
# 속 결은 16 주기라 어떤 칸끼리 붙어도 이음새가 없다.
#   autotile-stream        개울 물(둥근 강돌 둑 + 이끼 + 물가 거품, 북쪽 둑은 돌 앞면이 물로 내려간다) — 막힘
#   autotile-bamboo-litter 대나무 잎 깔린 땅(가늘고 긴 마른 잎이 겹겹이, 가장자리는 잎이 풀 위로 흩어진다) — 걷기
#   autotile-moss          이끼 덩이(두툼한 이끼 방석, 남쪽 끝은 방석 두께가 보인다) — 걷기
#   autotile-leaf-trail    낙엽 깔린 오솔길(흙 + 대나무 잎·붉은 낙엽, 풀이 먹어 든 들쭉날쭉 끝) — 걷기
#   autotile-bamboo-rail   낮은 대나무 난간 울타리(기둥 + 가로대 둘 + 새끼 매듭) — 막힘(위층)
import math
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from bv_base import *
from bv_base import _hash
import ground as G
import ek_ground as EG

STa = A(ST)
X, Y = X16, Y16


# ================================================================ 잔 무늬 도우미
def leaf_strokes(rgb, al, seed, density, mask, palette=('kare', 'take', 'aki'), long_=4, cx=0, cy=0):
    """대나무 잎(가늘고 긴 1px 잎, 길이 3~5, 비스듬히) 을 4x4 블록마다 흔든 자리에 찍는다. 잎 머리 = 빛, 꼬리 = 그늘, 잎 밑 그늘 1px.
    mask 밖은 찍지 않는다. cx, cy = 칸 좌표(표본에서 칸마다 다르게)."""
    pal = {'kare': KAREa, 'take': TAKEa, 'aki': AKIa, 'soil': SOILa}
    for by in range(4):
        for bx in range(4):
            for rep in range(2):
                h = _hash(bx + cx * 4, by + cy * 4, seed + rep * 13)
                if h > density: continue
                ox = bx * 4 + int(_hash(bx + cx * 4, by + cy * 4, seed + 2 + rep * 13) * 4)
                oy = by * 4 + int(_hash(bx + cx * 4, by + cy * 4, seed + 3 + rep * 13) * 4)
                dirn = int(_hash(bx + cx * 4, by + cy * 4, seed + 4 + rep * 13) * 4)
                dx, dy = ((1, 0), (1, 1), (1, -1), (0, 1))[dirn]
                L = 3 + int(_hash(bx, by, seed + 5 + rep) * (long_ - 2))
                hp = _hash(bx + cx * 4, by + cy * 4, seed + 6 + rep * 13)
                name = palette[0] if hp < .62 else (palette[1] if hp < .85 else palette[min(2, len(palette) - 1)])
                col = pal[name]
                base = 4 + (1 if hp < .3 else 0)
                for t in range(L):
                    x_ = (ox + dx * t) % 16; y_ = (oy + dy * t) % 16
                    if not mask[y_, x_]: continue
                    k = base + (1 if t == 0 else 0) - (1 if t == L - 1 else 0)
                    rgb[y_, x_] = col[clamp(k, 1, 6)]; al[y_, x_] = True
                    yb = (y_ + 1) % 16
                    if mask[yb, x_] and not (t < L - 1 and dy == 1):
                        if not al[yb, x_] or rgb[yb, x_].sum() > col[3].sum(): rgb[yb, x_] = SOILa[1]; al[yb, x_] = True
    return rgb, al


# ================================================================ ① 개울 물(막힘)
def stream_cell(n, seed=31):
    """개울 칸: 이웃 없는 쪽 = 둥근 강돌 둑(돌 윗면 빛 · 돌 사이 이끼 · 물 닿는 줄 젖은 물때). 북쪽 둑은 돌 앞면이 물로 내려가며
    그늘이 진다(3/4). 속 = 버들항 운하 물 톤 한 톤(깊은 곳 점) + 물가 거품 점·흐름 줄(가장자리 칸에만, 남북으로 짧게)."""
    m, mN, mS = edges(n, inset=3.4, jag=2.9, rad=7.5, seed=seed)
    rgb = np.zeros((16, 16, 3), int); al = np.zeros((16, 16), bool)
    BANK = 5.0
    north = (mN < m + 1.6) & (mN < 10)
    wstart = np.where(north, BANK + 2.4, BANK)
    water = m >= wstart
    deep = (hash2(X // 2, Y // 3, seed + 3) > .86)
    wt = np.where(deep, 2, 3)
    wt = np.where(water & (m < wstart + 1.3) & ~north, 4, wt)                     # 얕은 물가 밝은 띠
    wt = np.where(water & north & (m < wstart + 2.2), 1, wt)                      # 북쪽 둑 그늘
    wt = np.where(water & north & (m >= wstart + 2.2) & (m < wstart + 3.2), 2, wt)
    if n != 15:                                                                  # 가장자리 칸: 흐름 줄(남북 짧은 빛 줄) · 돌 밑 거품
        for i in range(3):
            fx = 2 + int(_hash(n, 40 + i, seed) * 12); fy = 2 + int(_hash(n, 50 + i, seed) * 10)
            for t in range(3):
                if 0 <= fy + t < 16 and water[fy + t, fx] and m[fy + t, fx] > wstart[fy + t, fx] + 1.0: wt[fy + t, fx] = 5 if t == 0 else 4
        foam = water & (m < wstart + .9) & ~north & (hash2(X, Y, seed + 5) > .45)
        wt = np.where(foam, 6, wt)
    rgb = np.where(water[..., None], MIZUa[np.clip(wt, 1, 6)], rgb); al |= water
    # 강돌 둑
    ct, cid, gap = cobble(X, Y, seed + 7, k=3)
    band = (m >= 0) & (m < BANK)
    st = ct.copy() + 1                                                           # 마른 강돌은 한 단 밝다(희게 바랜 돌)
    st = np.where(m < .9, np.maximum(st - 2, 1), st)                              # 풀 쪽 밑동 그늘
    mossy = (np.array([_hash(i, 0, seed + 8) for i in range(9)])[cid] > .62) & (m < BANK * .55)
    rgb = np.where(band[..., None], STa_[np.clip(st, 1, 6)], rgb); al |= band
    rgb = np.where((band & mossy & ~gap & (hash2(X, Y, seed + 6) > .3))[..., None], KOKEa[np.where(Y % 2 == 0, 5, 4)], rgb)
    rgb = np.where((band & gap)[..., None], np.where((hash2(X, Y, seed + 9) > .4)[..., None], KOKEa[3], STa_[1]), rgb)
    face = north & (m >= BANK) & (m < BANK + 2.4)                                # 북쪽 둑 돌 앞면(물로 내려간다)
    ft = np.where(gap, 1, np.where(m < BANK + 1.2, 3, 2))
    rgb = np.where(face[..., None], np.where((m < BANK + 1.2)[..., None], STa_[ft], SEIa[ft + 1]), rgb); al |= face
    lip = band & ~north & (m >= BANK - 1.2)                                      # 남·서·동 돌 아래 물 닿는 줄(젖은 물때)
    rgb = np.where(lip[..., None], SEIa[np.clip(ct, 2, 4)], rgb)
    damp = (m >= -1.4) & (m < 0) & (hash2(X, Y, seed + 11) > .5)                  # 둑 바깥 젖은 풀 점
    rgb = np.where(damp[..., None], LEAFa[2], rgb); al |= damp
    return _cell(rgb, al)


def autotile_stream(): return sheet_from_cells([stream_cell(n) for n in range(16)])


# ================================================================ ② 대나무 잎 깔린 땅(걷기)
def litter_cell(n, seed=43, cx=0, cy=0):
    """대숲 바닥: 속 = 짙은 숲 흙(칩셋 흙 결, 흙 램프 1~3) 위에 가늘고 긴 마른 대나무 잎이 겹겹이(누런 올리브·볏짚 빛, 드문 초록 새 잎·붉은 잎).
    가장자리 = 잎이 듬성해지며 풀 위로 흩어진다(흙은 안쪽에만), 바깥 2px 에 떨어진 잎 몇 장."""
    m, mN, mS = edges(n, inset=2.2, jag=3.0, rad=7.0, seed=seed)
    rgb = np.zeros((16, 16, 3), int); al = np.zeros((16, 16), bool)
    soil = m >= 2.0 + (vn_arr16(seed + 1) - .5) * 2.0
    T = chip_tones_lin(16, 224, 1, 3)[Y % 16, X % 16]
    rgb = np.where(soil[..., None], SOILa[T], rgb); al |= soil
    rgb, al = leaf_strokes(rgb, al, seed + 2, .95, m >= 1.0, cx=cx, cy=cy)
    rgb, al = leaf_strokes(rgb, al, seed + 3, .55, m >= 2.5, palette=('kare', 'kare', 'take'), cx=cx, cy=cy)
    rgb, al = leaf_strokes(rgb, al, seed + 4, .3, (m >= -2.0) & (m < 1.5), cx=cx, cy=cy)
    return _cell(rgb, al)


def vn_arr16(seed):
    from fr_ground import vn_arr
    return vn_arr(X, Y, 4, seed, per=16) * .6 + vn_arr(X, Y, 8, seed + 1, per=16) * .4


def autotile_litter(): return sheet_from_cells([litter_cell(n) for n in range(16)])


# ================================================================ ③ 이끼 덩이(걷기)
def moss_cell(n, seed=55):
    """두툼한 이끼 방석: 속 = 이끼 램프 톤 3~5 고운 알갱이(2x2 덩이 빛 점 + 그늘 점) + 드문 홀씨 줄기 점(볏짚 빛).
    북·서 가장자리는 빛 테(톤 5~6), 남쪽 가장자리는 방석 두께(앞면 2px: 톤 2 → 1) + 아래 흙 그늘 1px, 바깥은 이끼 점이 풀로 번진다."""
    m, mN, mS = edges(n, inset=2.0, jag=2.6, rad=6.5, seed=seed)
    rgb = np.zeros((16, 16, 3), int); al = np.zeros((16, 16), bool)
    inside = m >= 0
    g = vn_arr16(seed + 1)
    k = np.where(g > .62, 5, np.where(g > .36, 4, 3))
    bump = (hash2(X // 2, Y // 2, seed + 2) > .7) & ((X + Y) % 2 == 0)
    k = np.where(bump, np.minimum(k + 1, 6), k)
    k = np.where(hash2(X, Y, seed + 3) > .93, k - 1, k)
    south = (mS < m + 1.0) & (mS < 6)
    north = (mN < m + 1.0) & (mN < 6)
    k = np.where(inside & (m < 1.2) & ~south, 5, k)                              # 빛 테
    k = np.where(inside & north & (m < 1.6), 6, k)
    face = inside & south & (m < 2.2)
    k = np.where(face, np.where(m < 1.1, 1, 2), k)                               # 남쪽 방석 두께
    rgb = np.where(inside[..., None], KOKEa[np.clip(k, 1, 6)], rgb); al |= inside
    spore = inside & ~face & (hash2(X, Y, seed + 4) > .965)
    rgb = np.where(spore[..., None], KAREa[6], rgb)
    rgb = np.where((np.roll(spore, -1, 0) & inside & ~face)[..., None], KAREa[3], rgb)
    under = (m >= -1.0) & (m < 0) & south                                        # 방석 밑 흙 그늘
    rgb = np.where(under[..., None], SOILa[1], rgb); al |= under
    fr = (m >= -2.2) & (m < 0) & ~south & (hash2(X, Y, seed + 7) > .6)             # 바깥 이끼 점
    rgb = np.where(fr[..., None], KOKEa[np.where(Y % 2, 3, 4)], rgb); al |= fr
    return _cell(rgb, al)


def autotile_moss(): return sheet_from_cells([moss_cell(n) for n in range(16)])


# ================================================================ ④ 낙엽 깔린 오솔길(걷기)
def trail_cell(n, seed=67):
    """죽림 흙길: 속 = 칩셋 흙(16,224) 그대로(지도 흙길과 같은 결) + 대나무 잎·붉은 낙엽이 드문드문(길 가운데는 밟혀 듬성).
    이웃 없는 쪽 = 풀이 먹어 든 들쭉날쭉 끝 + 끝 1px 그늘 + 삐친 풀 포기 + 끝 자갈, 바깥에 흙 알갱이."""
    m, mN, mS = edges(n, inset=2.6, jag=2.4, rad=6.0, seed=seed)
    d = chip_tex(16, 224).astype(int)
    rgb = np.zeros((16, 16, 3), int); al = np.zeros((16, 16), bool)
    inside = m >= 0
    rgb = np.where(inside[..., None], d, rgb); al |= inside
    rgb = np.where((inside & (m < 1.0))[..., None], SOILa[2], rgb)
    rgb = np.where((inside & (m >= 1.0) & (m < 2.0) & (mS < m + .5))[..., None], (d * .82).astype(int), rgb)
    rgb, al = leaf_strokes(rgb, al, seed + 1, .38, inside & (m >= 1.0), palette=('kare', 'aki', 'take'))
    spk = (m >= -2.2) & (m < 0) & (hash2(X, Y, seed + 3) > .7)
    rgb = np.where(spk[..., None], SOILa[np.where(hash2(X, Y, seed + 4) > .5, 3, 4)], rgb); al |= spk
    for i in range(2 + int(_hash(n, 1, seed) * 3)):                              # 삐친 풀 포기
        tx = 1 + int(_hash(n, 10 + i, seed) * 14); ty = 2 + int(_hash(n, 20 + i, seed) * 13)
        if not (0.3 <= m[ty, tx] < 3.2): continue
        for (dx, dy, k) in ((0, 0, 3), (0, -1, 5), (-1, -1, 4), (1, -2, 6), (0, -2, 5)):
            x_, y_ = tx + dx, ty + dy
            if 0 <= x_ < 16 and 0 <= y_ < 16: rgb[y_, x_] = LEAFa[k]; al[y_, x_] = True
    for i in range(2):                                                            # 끝 자갈
        px_ = 1 + int(_hash(n, 30 + i, seed) * 13); py_ = 1 + int(_hash(n, 40 + i, seed) * 13)
        if not (1.0 <= m[py_, px_] < 3.5): continue
        rgb[py_, px_] = STa_[6]; rgb[py_, min(15, px_ + 1)] = STa_[5]; rgb[min(15, py_ + 1), px_] = STa_[4]; rgb[min(15, py_ + 1), min(15, px_ + 1)] = STa_[2]
    return _cell(rgb, al)


def autotile_trail(): return sheet_from_cells([trail_cell(n) for n in range(16)])


# ================================================================ ⑤ 낮은 대나무 난간 울타리(막힘, 위층)
def rail_cell(tc, n):
    """칸 가운데 대 기둥(3px, 위 끝 자른 마디 빛) + 이웃 쪽으로 가로대 둘(앞에서 본 굵은 대 2px, 마디 점) + 기둥에 감은 새끼 매듭(마른 잎 빛).
    남북 이웃 = 위에서 본 가로대 윗면 줄 둘. 낮은 울타리라 뒤 땅이 보인다."""
    o = 8
    hN, hE, hS, hW = bool(n & 1), bool(n & 2), bool(n & 4), bool(n & 8)
    for (on, x0, x1) in ((hW, 0, o + 7), (hE, o + 9, 32)):
        if not on: continue
        for x in range(x0, x1):
            for (yy, kk) in ((o + 5, 5), (o + 10, 4)):
                tc.px(x, yy, 'take', kk + (1 if x % 7 == 3 else 0)); tc.px(x, yy + 1, 'take', 2)
                if (x + yy) % 9 == 0: tc.px(x, yy, 'take', 2)
            tc.px(x, o + 13, 'dark', 1, 90)
    for (on, y0, y1) in ((hN, 0, o + 5), (hS, o + 11, 32)):
        if not on: continue
        for y in range(y0, y1):
            for xx, kk in ((o + 5, 5), (o + 9, 4)):
                tc.px(xx, y, 'take', kk if y % 5 else 2); tc.px(xx + 1, y, 'take', 2)
    for y in range(o + 1, o + 15):
        tc.px(o + 6, y, 'take', 6); tc.px(o + 7, y, 'take', 4); tc.px(o + 8, y, 'take', 2)
        if y == o + 7: tc.px(o + 6, y, 'take', 3); tc.px(o + 7, y, 'take', 2)
    tc.px(o + 6, o, 'kare', 6); tc.px(o + 7, o, 'kare', 5); tc.px(o + 8, o, 'kare', 4)    # 자른 마디
    for yy in (o + 5, o + 10):                                                   # 새끼 매듭
        for dx in range(-1, 4): tc.px(o + 5 + dx, yy, 'kare', 5 if dx < 1 else 3)
        tc.px(o + 6, yy + 1, 'kare', 2)


def autotile_rail():
    cells = []
    for n in range(16):
        tc = TC(32, 32, n); rail_cell(tc, n)
        cells.append(tc.fin(.6).crop((8, 8, 24, 24)))
    return sheet_from_cells(cells)


# ================================================================ 풀 덧그림(칸 안에만 — 어떤 칸끼리도 이음새 없음)
def grass_overlay(kind, cx, cy, seed=80):
    """kind: 'sprig'(고사리 새순·잔 풀 포기), 'litter'(풀 위에 떨어진 대나무 잎 2~5장), 'shade'(대숲 그늘: 짙은 풀 점 + 잎).
    반환 16x16 RGBA(투명 = 밑 풀)."""
    rgb = np.zeros((16, 16, 3), int); al = np.zeros((16, 16), bool)
    sd = seed + cx * 131 + cy * 71
    full = np.ones((16, 16), bool)
    if kind in ('litter', 'shade'):
        if kind == 'shade':
            dk = hash2(X + cx * 16, Y + cy * 16, sd) > .55
            rgb = np.where(dk[..., None], LEAFa[3], rgb); al |= dk
            dk2 = hash2(X + cx * 16, Y + cy * 16, sd + 1) > .9
            rgb = np.where(dk2[..., None], LEAFa[2], rgb); al |= dk2
        rgb, al = leaf_strokes(rgb, al, sd + 3, .16 if kind == 'litter' else .24, full, cx=cx, cy=cy)
    if kind == 'sprig':
        for i in range(2 + int(_hash(cx, cy, sd) * 3)):
            ox = 2 + int(_hash(i, 1, sd) * 11); oy = 4 + int(_hash(i, 2, sd) * 10)
            if _hash(i, 3, sd) > .5:                                              # 고사리 새순(감긴 머리 + 잎 셋)
                for (dx, dy, k) in ((0, 0, 3), (0, -1, 4), (0, -2, 5), (1, -3, 6), (2, -3, 5), (2, -2, 4), (-1, -1, 5), (1, -1, 5)):
                    x_, y_ = ox + dx, oy + dy
                    if 0 <= x_ < 16 and 0 <= y_ < 16: rgb[y_, x_] = LEAFa[k]; al[y_, x_] = True
            else:                                                                 # 잔 풀 포기
                for (dx, dy, k) in ((0, 0, 3), (0, -1, 5), (-1, -1, 4), (1, -2, 6), (-1, -2, 5)):
                    x_, y_ = ox + dx, oy + dy
                    if 0 <= x_ < 16 and 0 <= y_ < 16: rgb[y_, x_] = LEAFa[k]; al[y_, x_] = True
    return _cell(rgb, al)


# ================================================================ 바닥 표본 3x3(48x48)
def _img(rgb): return Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), 'RGB').convert('RGBA')


def ground_grass(kind=None):
    base = Image.fromarray(G.tiled(G.tex(0, 128), 48, 48)).convert('RGBA')
    if kind:
        for cy in range(3):
            for cx in range(3): base.alpha_composite(grass_overlay(kind, cx, cy), (cx * 16, cy * 16))
    return base


def ground_dirt():
    Y3, X3 = np.mgrid[0:48, 0:48]
    d = tiled(chip_tex(16, 224), 48, 48).astype(int)
    peb = hash2(X3 // 2, Y3 // 2, 7) > .965
    d = np.where(peb[..., None], np.where(((X3 % 2) + (Y3 % 2) == 0)[..., None], STa_[5], STa_[3]), d)
    return _img(d)


def ground_litter():
    out = Image.new('RGBA', (48, 48))
    for cy in range(3):
        for cx in range(3): out.alpha_composite(litter_cell(15, cx=cx, cy=cy), (cx * 16, cy * 16))
    base = ground_dirt(); base.alpha_composite(out); return base


def ground_flag():
    """판석 길(회색 화강암 막돌 윗면, 줄눈에 이끼)."""
    Y3, X3 = np.mgrid[0:48, 0:48]
    T = EG.flag_k(X3, Y3, seed=12)
    rgb = STa[T].astype(int)
    moss = (T == 1) & (hash2(X3, Y3, 13) > .45)
    rgb = np.where(moss[..., None], KOKEa[np.where(Y3 % 2 == 0, 4, 3)], rgb)
    return _img(rgb)


def pebble_k(Xa, Ya, seed=17):
    t, idx, gap = cobble(Xa, Ya, seed, per=16, k=4)
    return np.where(gap, 1, np.clip(t + 1, 1, 6)), gap


def ground_pebble():
    """물가 자갈(작은 강돌, 희게 바랜 윗면 + 틈 젖은 그늘)."""
    Y3, X3 = np.mgrid[0:48, 0:48]
    t, gap = pebble_k(X3, Y3)
    rgb = STa_[t]
    rgb = np.where(gap[..., None] & (hash2(X3, Y3, 19) > .5), SEIa[2], rgb)
    return _img(rgb)


# ================================================================ 지도 바닥 합성
def compose(W, H, M, seed=4):
    """M: 칸 마스크 'dirt'(흙), 'flag'(판석), 'pebble'(물가 자갈). 풀은 버들항 ground.render, 흙은 칩셋 흙(부드러운 가장자리)."""
    Wp, Hp = W * 16, H * 16
    K = lambda m: np.kron(m, np.ones((16, 16))).astype(bool)
    pav = K(M['flag'] | M['pebble'])
    grass, lab = G.render(Wp, Hp, [], pav | K(M['dirt']), seed=seed)
    out = np.array(grass)[..., :3].astype(int)
    Yp, Xp = np.mgrid[0:Hp, 0:Wp]
    import fr_ground as FG
    dm = FG.soft_mask(K(M['dirt']), seed + 3, 3.0, 6.0)
    d = tiled(chip_tex(16, 224), Wp, Hp).astype(int)
    out = np.where(dm[..., None], d, out)
    km = K(M['flag'])
    if km.any():
        ys, xs = np.nonzero(km)
        T = EG.flag_k(xs, ys, seed=12)
        c = STa[T].astype(int)
        moss = (T == 1) & (hash2(xs, ys, 13) > .45)
        c = np.where(moss[..., None], KOKEa[np.where(ys % 2 == 0, 4, 3)], c)
        out[ys, xs] = c
    km = K(M['pebble'])
    if km.any():
        ys, xs = np.nonzero(km)
        t, gap = pebble_k(xs, ys)
        c = STa_[t]
        c = np.where(gap[..., None] & (hash2(xs, ys, 19) > .5), SEIa[2], c)
        out[ys, xs] = c
    ped = K(M['flag'])
    edge = ped & ~ndi.binary_erosion(ped, iterations=1)
    out = np.where(edge[..., None], STa[3].astype(int), out)
    sh = ~pav & np.roll(ped, 1, 0)
    out = np.where(sh[..., None], (out * .75).astype(int), out)
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGB').convert('RGBA')
