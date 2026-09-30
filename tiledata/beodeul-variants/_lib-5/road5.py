"""픽셀 대로 — 중심선 road_c(X)·반폭 road_hw(X)로 굽이치는 돌길을 그린다(칸 단위 포장 대신).
연석 돌덩이(길이 7~10px) + 돌판 + 닳은 가운데(자갈·바퀴 자국) + 흘러나온 흙. 3/4 계약: 길은 위에서 본 1:1 바닥, 연석은 윗면만."""
import math
import numpy as np
from PIL import Image
from px2 import vnoise, _hash
import roman, terrain


def build(s, road_c, road_hw, seed=800):
    W, H = s.W, s.H
    RM = np.zeros((H * 16, W * 16), bool); RD = np.zeros((H * 16, W * 16), np.float32)
    for X in range(W * 16):
        cy = road_c(X); hw = road_hw(X); sl = (road_c(X + 1) - road_c(X - 1)) / 2.0; nf = 1.0 / math.sqrt(1 + sl * sl)
        for Y in range(int(cy - hw - 4), int(cy + hw + 5)):
            if not (0 <= Y < H * 16): continue
            j = 2.2 * (vnoise(X, Y, 7, seed + 1) - 0.5) + 1.3 * (_hash(X // 3, Y // 3, seed + 3) - 0.5)
            de = (hw + j - abs(Y - cy)) * nf
            RD[Y, X] = de
            if de > -3.0: RM[Y, X] = de > 0
    topc = [0] * W; botc = [0] * W
    for x in range(W):
        ys = [y for y in range(H) if RM[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16].any()]
        topc[x], botc[x] = min(ys), max(ys)
        for y in range(topc[x], botc[x] + 1): s.cobble[y][x] = True
    return RM, RD, topc, botc


def image(s, RD, road_c, road_hw, seed=800):
    TS = terrain.ST; GR = roman.GRV; LFc = terrain.LF
    W, H = s.W, s.H
    im = Image.new('RGBA', (W * 16, H * 16)); px = im.load()
    for X in range(W * 16):
        cy = road_c(X)
        for Y in range(int(cy - road_hw(X) - 6), int(cy + road_hw(X) + 7)):
            if not (0 <= Y < H * 16): continue
            de = float(RD[Y, X])
            if de <= -3.0: continue
            if de <= 0:
                if _hash(X, Y, seed + 11) < 0.22 + 0.1 * (de + 3) / 3: px[X, Y] = GR[3] + (255,)
                continue
            d = de
            if d < 1.0: c = TS[1]
            elif d < 4.0:
                u = X + int(3 * vnoise(X, Y, 11, seed + 12)); k = int(u / 8.5 + _hash(int(u / 8.5), Y > cy, seed + 13) * 0.5)
                hb = _hash(k, Y > cy, seed + 14); c = TS[5] if hb < 0.55 else TS[4]
                if d < 1.9: c = TS[4] if hb < 0.55 else TS[3]
                if (u % 8.5) < 0.9: c = TS[2]
                if d >= 3.2: c = TS[3]
            else:
                c = roman.tex_flag(X, Y)
                ct = abs(Y - cy); wear = vnoise(X, Y, 17, seed + 15)
                if ct < 8 and wear > 0.42 - 0.05 * (8 - ct):
                    c = GR[4] if _hash(X, Y, seed + 16) < 0.82 else GR[3]
                    if _hash(X, Y, seed + 17) > 0.95: c = GR[5]
                for rut in (-5.5, 5.5):
                    if abs(Y - (cy + rut + 1.2 * math.sin(X / 9.0 + rut))) < 0.8 and wear > 0.3: c = GR[2]
                if _hash(X // 2, Y // 2, seed + 18) < 0.012: c = GR[2]
                if d < 6.0 and _hash(X, Y, seed + 19) < 0.03: c = LFc[3]
            px[X, Y] = tuple(c[:3]) + (255,)
    return im


def install(s, RM, RD, road_c, road_hw, seed=800):
    from scipy.ndimage import binary_dilation
    s.overlays.append((image(s, RD, road_c, road_hw, seed), 0, 0))
    terrain.paving = lambda mask, tx, ty, joins=None, curb=True: Image.new('RGBA', (s.W * 16, s.H * 16))
    def _rp():
        tk = np.kron(np.array(s.track, bool) & ~np.array(s.sand, bool), np.ones((16, 16), bool))
        return tk | binary_dilation(RM, iterations=2)
    s.road_px = _rp
