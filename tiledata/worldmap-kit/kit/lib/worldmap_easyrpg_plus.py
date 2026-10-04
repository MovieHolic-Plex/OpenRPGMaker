#!/usr/bin/env python3
"""EasyRPG World 원본 vs 개선판 시트로 같은 40x30 월드맵을 엔진 사분면 규칙으로 깔아 비교한다.

  python3 worldmap_easyrpg_plus.py [--out DIR] [--frame N]
    DIR/map-orig-1x.png, map-plus-1x.png (+ 2x), 그리고 지형 코드 JSON.
원본 시트는 public/assets/easyrpg-chipset-world.png (CC BY 4.0, EasyRPG RTP World),
개선판은 tiledata/atlas-pick/worldmap-easyrpg-plus/world-plus.png.
연결 규칙은 엔진(worldCoastMapping.ts 및 land kit)의 8분면 규칙과 같다:
  세로·가로 둘 다 안 이어짐=모서리, 세로만=가로변(n/s), 가로만=세로변(w/e), 대각만=안쪽모서리, 나머지=몸통.
바다는 킷 배열(0=모서리, 1=세로변, 2=가로변, 3=안쪽, 4=몸통)이고 눈 지형 옆이면 열 3~5 를 쓴다.
"""
import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

# [worldmap-kit 복사본] 경로 상수만 키트 안으로 바꿨다(동작 변경 없음). 원본: scripts/content/atlas-pick/worldmap_easyrpg_plus.py
ROOT = Path(__file__).resolve().parents[3]
KIT_ASSETS = Path(__file__).resolve().parent.parent / 'assets'
ORIG = ROOT / 'public' / 'assets' / 'easyrpg-chipset-world.png'          # 이 키트의 렌더에는 쓰지 않는다(원본 CLI 용)
PLUS = KIT_ASSETS / 'world-plus.png'
CELL, Q = 16, 8
EXT = KIT_ASSETS / 'world-plus-ext.png'          # 빌더가 아이콘 세트 시트로 덮어쓴다
EXT_JSON = EXT.with_suffix('.json')
KEY = np.array([255, 103, 139])
W, H = 40, 30

SEA, GRASS, DIRT, SAND, MARSH, SNOW, FOREST, MOUNT, SFOREST, SMOUNT = range(10)
NAMES = ['sea', 'grass', 'dirt', 'sand', 'marsh', 'snow', 'forest', 'mountain', 'snow-forest', 'snow-mountain']
KIT = {DIRT: (6, 0), SAND: (9, 0), MARSH: (6, 4), SNOW: (9, 4), FOREST: (0, 12), MOUNT: (3, 12),
       SFOREST: (6, 8), SMOUNT: (9, 8)}
ROLE = dict(iso=(0, 0), inner=(2, 0), nw=(0, 1), n=(1, 1), ne=(2, 1), w=(0, 2), body=(1, 2), e=(2, 2),
            sw=(0, 3), s=(1, 3), se=(2, 3))
GRASS_CELL = (0, 8)
SNOW_CELL = (10, 6)
SNOWY = (SNOW, SFOREST, SMOUNT)


def make_map(seed=7):
    rng = np.random.default_rng(seed)
    def noise(sig):
        n = ndimage.gaussian_filter(rng.random((H, W)), sig, mode='nearest')
        return (n - n.min()) / (n.max() - n.min())
    elev, moist, temp = noise(3.2), noise(2.4), noise(5)
    yy = np.arange(H)[:, None] / (H - 1)
    xx = np.arange(W)[None, :] / (W - 1)
    edge = np.minimum(np.minimum(xx, 1 - xx), np.minimum(yy, 1 - yy))
    e = elev * 0.75 + np.clip(edge * 2.0, 0, 1) * 0.55
    t = np.full((H, W), GRASS, np.uint8)
    t[e < 0.40] = SEA
    land = t != SEA
    coast = land & ndimage.binary_dilation(~land, iterations=2)
    t[coast & (moist > 0.35)] = SAND
    t[(t == GRASS) & (moist > 0.66) & (elev < 0.62)] = MARSH
    t[(t == GRASS) & (moist < 0.30)] = DIRT
    t[(t == GRASS) & (moist > 0.52) & (moist <= 0.66)] = FOREST
    t[(t == GRASS) & (e > 0.66)] = MOUNT
    t[(t != SEA) & (e > 0.74)] = MOUNT
    north = (yy < 0.30) & (t != SEA)
    north = np.broadcast_to(north, (H, W)) & (temp > 0.35)
    t[north & (t == FOREST)] = SFOREST
    t[north & (t == MOUNT)] = SMOUNT
    t[north & np.isin(t, (GRASS, DIRT, SAND, MARSH))] = SNOW
    # 잔 알갱이(외딴 한 칸)를 남겨 iso 칸도 시험한다: 그대로 둔다.
    return t


class Sheet:
    def __init__(self, path):
        self.a = np.array(Image.open(path).convert('RGB'), np.uint8)

    def cell(self, c, r):
        return self.a[r * CELL:(r + 1) * CELL, c * CELL:(c + 1) * CELL]

    def kcell(self, terr, role):
        c0, r0 = KIT[terr]
        c, r = ROLE[role]
        return self.cell(c0 + c, r0 + r)


def role_of(v, h, d, qx, qy):
    if not v and not h:
        return ('nw', 'ne', 'sw', 'se')[qy * 2 + qx]
    if not v:
        return 'n' if qy == 0 else 's'
    if not h:
        return 'w' if qx == 0 else 'e'
    if not d:
        return 'inner'
    return 'body'


def render(sheet, t, frame=0):
    Hh, Ww = t.shape
    img = np.zeros((Hh * CELL, Ww * CELL, 3), np.uint8)

    def same(x, y, k):
        if not (0 <= x < Ww and 0 <= y < Hh):
            return False
        return t[y, x] == k

    def snow_near(x, y):
        return any(0 <= x + dx < Ww and 0 <= y + dy < Hh and t[y + dy, x + dx] in SNOWY
                   for dx in (-1, 0, 1) for dy in (-1, 0, 1))
    for y in range(Hh):
        for x in range(Ww):
            k = int(t[y, x])
            tile = np.zeros((CELL, CELL, 3), np.uint8)
            if k == GRASS:
                tile[:] = sheet.cell(*GRASS_CELL)
            elif k == SEA:
                base = 3 if snow_near(x, y) else 0
                col = base + frame
                for qy in (0, 1):
                    for qx in (0, 1):
                        sx, sy = (-1 if qx == 0 else 1), (-1 if qy == 0 else 1)
                        # 바다는 맵 가장자리를 「이어짐」으로 본다(끝없는 바다)
                        def s2(xx, yy):
                            if not (0 <= xx < Ww and 0 <= yy < Hh):
                                return True
                            return t[yy, xx] == SEA
                        v, h, d = s2(x, y + sy), s2(x + sx, y), s2(x + sx, y + sy)
                        if not v and not h:
                            row = 0
                        elif not v:
                            row = 2
                        elif not h:
                            row = 1
                        elif not d:
                            row = 3
                        else:
                            row = 4
                        src = sheet.cell(col, row)
                        tile[qy * Q:(qy + 1) * Q, qx * Q:(qx + 1) * Q] = src[qy * Q:(qy + 1) * Q, qx * Q:(qx + 1) * Q]
            else:
                iso = not any(same(x + dx, y + dy, k) for dx in (-1, 0, 1) for dy in (-1, 0, 1) if (dx, dy) != (0, 0))
                if iso:
                    tile[:] = sheet.kcell(k, 'iso')
                else:
                    for qy in (0, 1):
                        for qx in (0, 1):
                            sx, sy = (-1 if qx == 0 else 1), (-1 if qy == 0 else 1)
                            r = role_of(same(x, y + sy, k), same(x + sx, y, k), same(x + sx, y + sy, k), qx, qy)
                            src = sheet.kcell(k, r)
                            tile[qy * Q:(qy + 1) * Q, qx * Q:(qx + 1) * Q] = src[qy * Q:(qy + 1) * Q, qx * Q:(qx + 1) * Q]
            img[y * CELL:(y + 1) * CELL, x * CELL:(x + 1) * CELL] = tile
    return img


# ── 맥락 시험: 원본 마을·성 아이콘 옆에 새 확장 아이콘을 같은 지도 위에 놓는다 ──────────────
# 광장(카브): 마을·성을 놓을 자리만 풀/눈으로 바꾼다. 원본·개선판 지도가 같은 지형을 쓴다.
PLAZAS = [((19, 2, 33, 9), GRASS), ((22, 15, 36, 23), GRASS), ((34, 1, 39, 8), SNOW)]
# (출처, 이름 또는 (col,row,w,h), x, y)   출처 orig=원본(개선판 지도에선 눌린 시트의 같은 칸), ext=새 확장 시트
PLACEMENTS = [
    ('orig', (20, 10, 2, 2), 20, 3), ('ext', 'castle_dark', 23, 3), ('orig', (22, 10, 2, 2), 27, 3),
    ('orig', (20, 12, 1, 2), 30, 3), ('orig', (21, 12, 1, 2), 31, 3),
    ('orig', (22, 8, 1, 1), 20, 7), ('orig', (22, 9, 1, 1), 21, 7), ('ext', 'village_wood', 23, 7),
    ('ext', 'town_bell', 26, 6), ('ext', 'town_red', 29, 6),
    ('ext', 'castle_dark_grand', 23, 16),
    ('orig', (20, 10, 2, 2), 29, 16), ('orig', (22, 10, 2, 2), 31, 16), ('orig', (20, 14, 2, 2), 33, 16),
    ('orig', (22, 8, 1, 1), 29, 19), ('orig', (22, 9, 1, 1), 30, 19), ('ext', 'town_red', 32, 19),
    ('ext', 'village_wood', 29, 21),
    ('ext', 'town_snow', 35, 2), ('orig', (23, 8, 1, 1), 35, 6), ('orig', (23, 9, 1, 1), 36, 6), ('ext', 'village_snow', 37, 6),
]


# 광장을 파고 남은 산·흙 한 칸짜리 떨어진 조각(2라운드 적대 검수에서 잡음)
STRAYS = [(28, 10), (29, 10), (27, 14), (28, 14)]


def carve(t):
    t = t.copy()
    for x, y in STRAYS:
        t[y, x] = GRASS
    for (x0, y0, x1, y1), k in PLAZAS:
        t[y0:y1 + 1, x0:x1 + 1] = k
    return t


def overlay(img, sheet_arr, ext_arr, meta, with_ext=True):
    img = img.copy()
    by = {m['name']: m for m in meta['icons']}
    for src, spec, x, y in PLACEMENTS:
        if src == 'ext':
            if not with_ext:
                continue
            m = by[spec]
            w, h = m['cells']
            icon = ext_arr[m['row'] * CELL:(m['row'] + h) * CELL, m['col'] * CELL:(m['col'] + w) * CELL]
        else:
            c, r, w, h = spec
            icon = sheet_arr[r * CELL:(r + h) * CELL, c * CELL:(c + w) * CELL]
        dst = img[y * CELL:(y + h) * CELL, x * CELL:(x + w) * CELL]
        solid = ~np.all(icon == KEY, axis=2)
        dst[solid] = icon[solid]
    return img


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=str(ROOT / 'verify-shots' / 'worldmap-easyrpg-plus'))
    ap.add_argument('--frame', type=int, default=0)
    ap.add_argument('--plus', default=str(PLUS))
    ap.add_argument('--seed', type=int, default=7)
    ap.add_argument('--icons', action='store_true', help='광장을 파고 원본·새 확장 아이콘을 얹은 맥락 지도(map-ctx-*)도 만든다')
    a = ap.parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    t = make_map(a.seed)
    (out / 'terrain.json').write_text(json.dumps({'width': W, 'height': H, 'names': NAMES, 'terrain': t.tolist()}))
    for tag, p in (('orig', ORIG), ('plus', Path(a.plus))):
        if not p.exists():
            continue
        im = Image.fromarray(render(Sheet(p), t, a.frame))
        im.save(out / f'map-{tag}-1x.png')
        im.resize((im.width * 2, im.height * 2), Image.NEAREST).save(out / f'map-{tag}-2x.png')
    if a.icons:
        tc = carve(t)
        meta = json.loads(EXT_JSON.read_text())
        ext_arr = np.array(Image.open(EXT).convert('RGB'), np.uint8)
        for tag, p in (('orig', ORIG), ('plus', Path(a.plus))):
            sh = Sheet(p)
            base = render(sh, tc, a.frame)
            im = Image.fromarray(overlay(base, sh.a, ext_arr, meta, with_ext=(tag == 'plus')))
            im.save(out / f'map-ctx-{tag}-1x.png')
            im.resize((im.width * 2, im.height * 2), Image.NEAREST).save(out / f'map-ctx-{tag}-2x.png')
    print('terrain counts:', {NAMES[i]: int((t == i).sum()) for i in range(10)})


if __name__ == '__main__':
    main()
