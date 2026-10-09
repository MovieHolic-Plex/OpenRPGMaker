# 최종 탑 — 허공 틈과 부유 바닥 조각.
# 허공 바탕은 시간의 틈(time-rift)의 tr_void.void_image(허공 남색 + 덩이 성운 + 별)를 그대로 쓴다.
# 부유 바닥: 바닥 칸 집합의 「허공 쪽」 가장자리만 들쭉날쭉하게 깨고(벽 쪽은 그대로), 남쪽 가장자리에는 판 두께 띠(돌판 + 강철 갑판),
# 그 아래 허공 칸에는 찢긴 밑면(강철 들보 띠, 늘어진 철근·전선, 짧은 깨진 돌 뿌리)이 허공 빛에 식으며 매달린다.
import math
import numpy as np
from scipy import ndimage as ndi
from ft_base import *
from ft_base import _hash

LIP = 5

def void_bg(Wc, Hc, seed=7):
    return TV.void_image(Wc * T, Hc * T, seed=seed, per=False, nebula=True, star_dens=1.0)

def _arr(im): return np.array(im.convert('RGBA'))

def frag_layer(floor_cells, void_cells, Wc, Hc, floor_img, seed=5):
    """floor_cells: 걷는 바닥 칸, void_cells: 허공 칸. floor_img: 바닥 칸이 칠해진 RGBA(지도 크기). 반환: 덮어 그릴 RGBA(바닥 + 깨진 가장자리 + 밑면)
    와 지울 마스크(허공으로 깨진 화소 = 허공 바탕이 보여야 할 화소)."""
    Hp, Wp = Hc * T, Wc * T
    M = np.zeros((Hp, Wp), bool); V = np.zeros((Hp, Wp), bool)
    for (x, y) in floor_cells: M[y * T:(y + 1) * T, x * T:(x + 1) * T] = True
    for (x, y) in void_cells: V[y * T:(y + 1) * T, x * T:(x + 1) * T] = True
    dist = ndi.distance_transform_edt(~V)
    jag = .8 + 5.0 * FB.tnoise(Wp, Hp, 7, seed) ** 1.5 + 1.4 * FB.tnoise(Wp, Hp, 2, seed + 1)
    cut = M & (dist <= jag)
    M2 = M & ~cut
    # 볼록 모서리 둥글게(허공 쪽만)
    near = dist <= 6
    op = ndi.binary_opening(M2, structure=np.ones((3, 3)))
    M2 = np.where(near, op & M2, M2)
    V = V | (M & ~M2)                                            # 깨져 나간 화소도 허공
    out = np.zeros((Hp, Wp, 4), np.uint8)
    fa = _arr(floor_img)
    out[M2] = fa[M2]
    # 남쪽 가장자리: 아래로 첫 빈 화소까지 거리
    below_void = np.zeros((Hp, Wp), bool); below_void[:-1] = ~M2[1:] & V[1:]
    run = np.full((Hp, Wp), 99)
    for y in range(Hp - 1, -1, -1):
        if y == Hp - 1: run[y] = np.where(M2[y], 0, 99)
        else: run[y] = np.where(M2[y] & ~M2[y + 1], 0, np.where(M2[y], run[y + 1] + 1, 99))
    lipm = M2 & (run < LIP)
    # 아래가 허공일 때만 두께 띠(벽 쪽 남쪽 가장자리는 해당 없음)
    hasvoid = np.zeros((Hp, Wp), bool)
    for y in range(Hp):
        yy = np.minimum(Hp - 1, y + run[y] + 1)
        hasvoid[y] = V[yy, np.arange(Wp)] & (run[y] < 99)
    lipm &= hasvoid
    FTc = np.array(FT, np.uint8); STc = np.array(STEEL, np.uint8)
    for (y, x) in zip(*np.nonzero(lipm)):
        d = run[y, x]                                            # 0 = 맨 아래
        if d == LIP - 1: c = FT[5]
        elif d == LIP - 2: c = FT[3]
        elif d >= 1: c = FT[2] if (x // 6 + d) % 5 else FT[1]
        else: c = FT[1]
        out[y, x, :3] = c; out[y, x, 3] = 255
    # 깨진 위·옆 가장자리: 안쪽 1px 어두운 윤곽, 북쪽 깨짐은 밝은 모
    edge = M2 & ~ndi.binary_erosion(M2) & (dist <= 8) & ~lipm
    up_open = np.zeros_like(M2); up_open[1:] = ~M2[:-1]
    for (y, x) in zip(*np.nonzero(edge)):
        c = out[y, x, :3].astype(float)
        out[y, x, :3] = (np.minimum(255, c * .6 + np.array(FT[6]) * .4) if up_open[y, x] else c * .55).astype(np.uint8)
    # 밑면: 남쪽 가장자리 아래 허공 화소
    VR = np.array(VOIDR, float)
    cols = {}
    for (y, x) in zip(*np.nonzero(M2 & (run == 0) & hasvoid)): cols.setdefault(x, []).append(y)
    for x, ys in cols.items():
        for yb in ys:
            Lr = int(4 + 11 * FB.tnoise1(Wp, 6, seed + 3)[x] ** 1.3 + 3 * (_hash(x // 3, 0, seed) > .7))
            for k in range(1, 34):
                y = yb + k
                if y >= Hp or M2[y, x] or not V[y, x]: break
                c = None
                if k <= 4:                                           # 강철 갑판 띠(리벳)
                    c = STEEL[(4, 3, 2, 1)[k - 1]]
                    if k == 2 and x % 9 == 3: c = STEEL[6]
                elif k <= 4 + Lr:                                    # 깨진 돌 뿌리(아래로 식는다)
                    t = (k - 4) / max(1, Lr)
                    tone = 3 - int(t * 2.4) + (1 if (x + k) % 7 == 0 else 0)
                    c = FT[max(1, tone)]
                    c = tuple(int(v) for v in np.array(c) * (1 - .4 * t) + VR[3] * .4 * t)
                    if k == 4 + Lr: c = FT[0]
                else:
                    # 늘어진 철근·전선: 드문 기둥 줄
                    hh = _hash(x, 7, seed + 9)
                    if hh < .08 and k < 4 + Lr + 4 + int(_hash(x, 8, seed) * 10):
                        c = RUST[3] if hh < .05 else CABLE[3]
                    elif hh < .02 and k < 4 + Lr + 3: c = STEEL[3]
                if c is None: break
                out[y, x, :3] = c; out[y, x, 3] = 255
    return Image.fromarray(out, 'RGBA'), cut

def voidbreak_sheet(floor_kind='ft_core', seed=5):
    """허공 ↔ 바닥 깨진 가장자리 16변형(위1·오른쪽2·아래4·왼쪽8): 이웃이 없는 쪽은 허공으로 깨지고, 아래가 없으면 두께 띠."""
    sh = new(64, 64)
    for n in range(16):
        cells = {(1, 1)}
        if n & 1: cells.add((1, 0))
        if n & 2: cells.add((2, 1))
        if n & 4: cells.add((1, 2))
        if n & 8: cells.add((0, 1))
        void = {(x, y) for x in range(3) for y in range(3)} - cells
        fl = new(48, 48)
        for (x, y) in cells: fl.alpha_composite(dlib.floor_tile(floor_kind, x + 7, y + 4), (x * T, y * T))
        lay, _ = frag_layer(cells, void, 3, 3, fl, seed + n * 0)
        sh.alpha_composite(lay.crop((16, 16, 32, 32)), (n % 4 * T, n // 4 * T))
    return sh

def underside_sample(floor_kind='ft_core', seed=5):
    """깨진 밑면 3x2 표본: 위 줄 = 남쪽 가장자리 바닥(두께 띠), 아래 줄 = 허공 칸에 매달린 강철 갑판·돌 뿌리·철근."""
    cells = {(0, 0), (1, 0), (2, 0)}; void = {(0, 1), (1, 1), (2, 1)}
    fl = new(48, 32)
    for (x, y) in cells: fl.alpha_composite(dlib.floor_tile(floor_kind, x + 3, y + 2), (x * T, y * T))
    lay, _ = frag_layer(cells, void, 3, 2, fl, seed + 11)
    return lay

def fragment_piece(cells_wh, seed=5, floor_kind='ft_core', vseed=21):
    """부유 바닥 조각 표본(허공 위): w×h 칸 바닥 + 아래 1~2줄 밑면. 칸 집합 전체를 허공으로 둘러싸 깨뜨린다."""
    w, h = cells_wh
    Wc, Hc = w + 2, h + 3
    cells = {(x + 1, y + 1) for x in range(w) for y in range(h)}
    rr = np.random.default_rng(seed)
    for _ in range(max(1, w * h // 4)):                         # 귀퉁이 칸 하나둘 떨어져 나감
        c = (1 + int(rr.integers(0, w)), 1 + (0 if rr.random() < .5 else h - 1))
        if len(cells) > 3 and rr.random() < .5: cells.discard(c)
    void = {(x, y) for x in range(Wc) for y in range(Hc)} - cells
    fl = new(Wc * T, Hc * T)
    for (x, y) in cells: fl.alpha_composite(dlib.floor_tile(floor_kind, x + 5, y + 3), (x * T, y * T))
    lay, _ = frag_layer(cells, void, Wc, Hc, fl, seed)
    bb = lay.getbbox()
    return lay.crop((T, T, (w + 1) * T, (h + 3) * T)), cells
