#!/usr/bin/env python3
"""9단계 후처리: 사구 바다를 「걸어서 못 건너는 곳」으로 읽히게 한다.

v8 의 사구는 연한 모래 바닥에 흐린 점무늬뿐이라 장벽으로 안 읽혔다. 같은 모래 팔레트 안에서(새 색 없이 명도만)
  - 비스듬한 사구 마루(밝은 선) + 그늘(어두운 면) 줄무늬
  - 걸을 수 있는 모래와 사구가 만나는 경계에 어두운 능선 띠
를 칸 좌표 해시 노이즈로 얹는다. 생성 이미지·트레이싱 없음. 소재는 EasyRPG World 모래(CC BY 4.0) 위 손 계산.
"""
import numpy as np
from terrain_lib import rnd

CELL = 16


def _vnoise(h, w, scale, salt):
    """픽셀 해상도 값 노이즈(0..1), 결정적."""
    gy, gx = int(h / scale) + 3, int(w / scale) + 3
    g = np.array([[rnd(i, j, salt) for i in range(gx)] for j in range(gy)])
    ys, xs = np.mgrid[0:h, 0:w]
    fx, fy = xs / scale, ys / scale
    i0, j0 = fx.astype(int), fy.astype(int)
    tx, ty = fx - i0, fy - j0
    tx, ty = tx * tx * (3 - 2 * tx), ty * ty * (3 - 2 * ty)
    a = g[j0, i0] * (1 - tx) + g[j0, i0 + 1] * tx
    b = g[j0 + 1, i0] * (1 - tx) + g[j0 + 1, i0 + 1] * tx
    return a * (1 - ty) + b * ty


def apply_dune_fx(img, world):
    img = img.copy()
    H, W = world.dune.shape
    h, w = H * CELL, W * CELL
    dune_px = np.kron(world.dune.astype(np.uint8), np.ones((CELL, CELL), np.uint8)).astype(bool)
    Y, X = np.mgrid[0:h, 0:w]
    r, g, b = img[..., 0].astype(int), img[..., 1].astype(int), img[..., 2].astype(int)
    sandy = (r > g) & (g > b) & (r > 150) & ((r - b) > 25)
    nz = _vnoise(h, w, 38, 901)
    nz2 = _vnoise(h, w, 15, 902)
    u = (X * 0.50 + Y * 1.0) / 11.0 + 2.6 * nz + 0.5 * nz2
    f = u - np.floor(u)
    seg = _vnoise(h, w, 52, 903) > 0.36          # 마루가 끊기고 이어지게
    crest = dune_px & sandy & seg & (f < 0.11)
    shade = dune_px & sandy & seg & (f >= 0.11) & (f < 0.33)
    out = img.astype(np.float32)
    out[shade] *= np.array([0.84, 0.81, 0.76], np.float32)
    out[crest] = out[crest] * 0.35 + np.array([255, 246, 214], np.float32) * 0.65
    img = np.clip(out, 0, 255).astype(np.uint8)
    # 경계 능선: 사구 칸과 걸을 수 있는 땅(사구 아님) 사이
    land = (world.M.G >= 10) & ~world.dune
    foot = np.zeros((H, W), bool)
    for n, (x, y, ww, hh) in world.ic.items():
        foot[y:y + hh, x:x + ww] = True
    edge = np.zeros((h, w), bool)
    ridge_dark = np.array([139, 111, 63], np.uint8)
    ridge_light = np.array([255, 240, 196], np.uint8)
    for y in range(H):
        for x in range(W):
            if not world.dune[y, x]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                a, bb = x + dx, y + dy
                if not (0 <= a < W and 0 <= bb < H) or not (land[bb, a] or foot[bb, a]):
                    continue
                x0, y0 = x * CELL, y * CELL
                for t in range(CELL):
                    wob = int(round((rnd(x * 16 + t, y, 905) - .5) * 2.4))
                    if dx:   # 세로 경계
                        px = x0 + (CELL - 3 if dx > 0 else 0) + wob
                        for k in range(3):
                            xx = px + k
                            if x0 - 1 <= xx < x0 + CELL + 1:
                                img[y0 + t, xx] = ridge_dark
                        lx = px - 1 if dx > 0 else px + 3
                        if 0 <= lx < w:
                            img[y0 + t, lx] = ridge_light
                    else:
                        py = y0 + (CELL - 3 if dy > 0 else 0) + wob
                        for k in range(3):
                            yy = py + k
                            if y0 - 1 <= yy < y0 + CELL + 1:
                                img[yy, x0 + t] = ridge_dark
                        ly = py - 1 if dy > 0 else py + 3
                        if 0 <= ly < h:
                            img[ly, x0 + t] = ridge_light
    return img
