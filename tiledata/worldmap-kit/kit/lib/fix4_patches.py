#!/usr/bin/env python3
"""fix4 지형 보정 (fix4_build.py 가 불러 쓴다).

  분화구 호수(68,40) 를 장소 목록에서 빼고, 그 자리(붉은 고원 윗면)를 아이콘 없는 연못 지형으로 채운다.

  연못 모양  픽셀 해상도의 불규칙한 타원 마스크(pond_mask). 칸 격자와 무관하게 윤곽이 휘어 직선·사각이 생기지 않는다.
  지형 코드  마스크가 칸 하나를 통째로 덮는 칸만 RIVER(물)로 바꾼다 -> 통행 판정은 물이 확실한 칸만 막는다. 나머지 가장자리 칸은 땅 그대로.
  그림       paint_pond: 물 속은 terrain_v4.water_tile 의 원본 월드 칩셋 물 타일(순수 물 칸)을 그대로 깔고,
             가장자리에서 (a) 물 안쪽 2~3px 에 붉은 흙을 베이어 디더로 섞고 (b) 가장자리 1px 는 가장 밝은 물색 거품,
             (c) 바깥 땅 쪽 1px 어두운 윤곽 + 3px 젖은 흙(어두운 흙색 디더) 전이를 둔다. 색은 전부 이미 그림 안에 있는 색이다(새 색 0).
"""
import sys
from pathlib import Path

import numpy as np
import scipy.ndimage as ndi

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE / 'src' / 'journey'))
import terrain_v4 as V  # noqa: E402
from boundary_v5 import hash2  # noqa: E402
from terrain_lib import BAYER  # noqa: E402

REMOVED_SITE = '분화구 호수'
REMOVED_ICON = 'crater_lake'
# 연못 마스크(픽셀 좌표, 칸 = 16px). 고원 윗면에서 동쪽 길(x=71 세로선, 픽셀 x 1136)과 서쪽 숲/벽 사이에 들어가게 잡았다.
CENTER_PX = (1102.0, 624.0)
RADII_PX = (24.0, 36.0)          # 가로·세로 반지름
TILT = 0.30                      # 라디안, 긴 축을 살짝 기울인다
LOG = {}


def _h(ix, iy, salt):
    return hash2(np.asarray(ix), np.asarray(iy), salt)


def pond_mask(H, W):
    """(H*16, W*16) 불리언 마스크. 결정적(고정 해시·고정 위상)."""
    out = np.zeros((H * 16, W * 16), bool)
    cx, cy = CENTER_PX
    rx, ry = RADII_PX
    x0, x1 = int(cx - rx - 20), int(cx + rx + 20)
    y0, y1 = int(cy - ry - 20), int(cy + ry + 20)
    yy, xx = np.mgrid[y0:y1, x0:x1].astype(float)
    ca, sa = np.cos(TILT), np.sin(TILT)
    u = (xx - cx) * ca + (yy - cy) * sa
    v = -(xx - cx) * sa + (yy - cy) * ca
    rho = np.sqrt((u / rx) ** 2 + (v / ry) ** 2)
    th = np.arctan2(v / ry, u / rx)
    r_edge = (1.0 + .085 * np.sin(2 * th + 1.1) + .07 * np.sin(3 * th + .4) + .05 * np.sin(5 * th + 2.3)
              + .035 * np.sin(7 * th + 0.7))
    fine = (_h(xx // 2, yy // 2, 5501) - .5) * .09
    out[y0:y1, x0:x1] = rho < (r_edge + fine)
    return out


def add_pond(M):
    """마스크가 칸을 통째로 덮는 고원 윗면 칸만 RIVER 로 판다."""
    G, Hh = M.G, M.Hh
    mk = pond_mask(M.H, M.W)
    keep = []
    for y in range(M.H):
        for x in range(M.W):
            if not mk[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16].all():
                continue
            if M.is_face(x, y) or M.RAMP[y, x] or Hh[y, x] < 1 or G[y, x] < 10:
                continue
            keep.append((x, y))
    before = {}
    for (x, y) in keep:
        before[(x, y)] = (int(G[y, x]), int(M.O[y, x]))
        G[y, x] = V.RIVER
        M.O[y, x] = 0
    LOG['pond_cells'] = [[int(x), int(y)] for (x, y) in sorted(keep, key=lambda c: (c[1], c[0]))]
    LOG['pond_before'] = {'%d,%d' % k: list(v) for k, v in before.items()}
    LOG['mask_px'] = int(mk.sum())
    ys, xs = np.nonzero(mk)
    LOG['mask_bbox_px'] = [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())]
    return keep


class _AllWater:
    """사방이 물인 3x3 가짜 지도: water_tile 이 가운데 칸을 순수 물(내부) 타일로 만든다."""
    G = np.full((3, 3), V.RIVER, np.int16)

    def inb(self, a, b):
        return 0 <= a < 3 and 0 <= b < 3


def _lum(c):
    return .3 * float(c[0]) + .59 * float(c[1]) + .11 * float(c[2])


def paint_pond(img):
    """img: (H*16, W*16, 3) uint8, 늪 후처리 뒤·아이콘 얹기 전. 연못 픽셀을 칠해 같은 크기로 돌려준다(원본 변경 없음)."""
    H, W = img.shape[0] // 16, img.shape[1] // 16
    mk = pond_mask(H, W)
    img = img.copy()
    wtile = V.water_tile(_AllWater(), 1, 1, V.RIVER)
    Hp, Wp = img.shape[:2]
    ys, xs = np.nonzero(mk)
    y0, y1, x0, x1 = max(ys.min() - 14, 0), min(ys.max() + 15, Hp), max(xs.min() - 14, 0), min(xs.max() + 15, Wp)
    sub = img[y0:y1, x0:x1].copy()
    m = mk[y0:y1, x0:x1]
    din = ndi.distance_transform_cdt(m, metric='chessboard')          # 안쪽: 가장자리 픽셀 = 1
    dout = ndi.distance_transform_cdt(~m, metric='chessboard')        # 바깥: 가장자리 바로 밖 = 1
    yy, xx = np.mgrid[y0:y1, x0:x1]
    bay = (BAYER[yy % 4, xx % 4] + .5) / 16.0
    wat = wtile[yy % 16, xx % 16]
    wcols = sorted({tuple(int(v) for v in c) for c in wtile.reshape(-1, 3)}, key=_lum)
    foam = np.array(wcols[-1], np.uint8)
    band = (dout >= 4) & (dout <= 14)
    soil_cnt = {}
    for c in sub[band]:
        k = tuple(int(v) for v in c)
        if not (k[0] > k[1] + 12 and k[1] >= k[2]):      # 붉은 흙 색만(숲 잎·길 색 제외)
            continue
        soil_cnt[k] = soil_cnt.get(k, 0) + 1
    wset = set(wcols)
    scols = [c for c, n in sorted(soil_cnt.items(), key=lambda kv: -kv[1]) if n >= 12 and c not in wset]
    scols = sorted(scols[:5], key=_lum)
    assert len(scols) >= 2, scols
    soil_dark, soil_mid = np.array(scols[0], np.uint8), np.array(scols[1], np.uint8)
    win = img[max(y0 - 26, 0):y1 + 26, max(x0 - 26, 0):x1 + 26].reshape(-1, 3)
    uniq = {tuple(int(v) for v in c) for c in win if c[0] >= c[1] and c[0] > c[2]} - wset      # 어두운 붉은 갈색 윤곽
    outline = np.array(min(uniq, key=_lum), np.uint8)
    inside = m
    sub[inside] = wat[inside]
    sub[inside & (din == 2) & (bay < .55)] = soil_mid
    sub[inside & (din == 3) & (bay < .25)] = soil_mid
    jit = _h(xx, yy, 5502)
    edge = inside & (din == 1)
    sub[edge & (jit < .6)] = foam
    sub[edge & (jit >= .6)] = soil_mid
    sub[(dout == 1) & (jit < .78)] = outline
    sub[(dout == 2) & (bay < .50)] = soil_dark
    sub[(dout == 3) & (bay < .28)] = soil_dark
    sub[(dout == 4) & (bay < .10)] = soil_dark
    img[y0:y1, x0:x1] = sub
    LOG['paint'] = dict(water_colors=['%02x%02x%02x' % c for c in wcols], soil_dark='%02x%02x%02x' % tuple(int(v) for v in soil_dark),
                        soil_mid='%02x%02x%02x' % tuple(int(v) for v in soil_mid), outline='%02x%02x%02x' % tuple(int(v) for v in outline),
                        foam='%02x%02x%02x' % tuple(int(v) for v in foam))
    return img
