#!/usr/bin/env python3
"""버들항 물 그림판 굽기 — 물가 둑·깊이 띠 덧그림과 «게임마다 다른 물빛».

  python3 scripts/content/beodeul-water/bake.py            # 굽는다
  python3 scripts/content/beodeul-water/bake.py --check    # 다시 구워 지금 파일과 같은지만 본다

무엇을 굽나 (모두 코드가 만든다 — 새로 그린 그림 없음, 버들항 시트 화소와 수식뿐이라 3/4 관문 대상 그림이 없다)
- 물가 둑(shore, 2층 덧그림): 물 칸의 8이웃 256꼴. 풀 → 짙은 풀 입술 → 흙 → 젖은 흙 → 어두운 젖은 테 → 밝은 얕은 물 선 → 옅은 얕은 물 띠.
  둥글기는 거리 장(자연 덧그림 bank_tile 과 같은 법)이고, 바닥 겉모습(tiledata/beodeul-looks/textures/ground-*.png)마다 한 벌 더 굽는다.
- 깊이 띠(deep, 2층 덧그림): 뭍에서 두 칸·네 칸·일곱 칸 넘는 물 칸 묶음의 8이웃 256꼴 — 반투명 어두운 막, 가장자리는 들쭉날쭉. 속 칸은 농담 넷 × 얼룩 둘.
  반투명이라 1층 물의 8프레임 물결이 그대로 비친다.
- 물빛(looks): 버들항 시트에서 물 화소가 실린 칸마다 «물 화소만» 다시 칠한 칸(나머지 화소는 그대로) — 그릴 때 그 칸 그림으로 바꾼다(src/assets/tilesetLooks.ts).
  물과 풀·포석이 함께 실린 칸은 바닥·길 겉모습(beodeul-looks 그림판)이 이미 다시 그리므로, 그 그림 위에 물만 다시 칠한 칸을 겉모습마다 따로 둔다 —
  그래서 beodeul-looks 를 다시 구우면 이것도 다시 굽는다.

출력: public/assets/beodeul-water/chipset.png(128칸 폭) · src/assets/beodeulWater.json. 버들항 시트·타일셋 정의·맵의 칸 번호는 그대로다.
"""
import argparse, colorsys, json, math, pathlib, sys
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = pathlib.Path(__file__).resolve().parents[3]
SHEET = ROOT / "public/assets/beodeul-city/beodeul-city-chipset.png"
TSJ = ROOT / "src/assets/beodeulCityTileset.json"
GROUNDS = ROOT / "tiledata/beodeul-looks/textures"
OUT_PNG = ROOT / "public/assets/beodeul-water/chipset.png"
OUT_JSON = ROOT / "src/assets/beodeulWater.json"
LOOKS_JSON = ROOT / "src/assets/beodeulLooks.json"
LOOKS_PNG = ROOT / "public/assets/beodeul-looks/chipset.png"
T, COLS = 16, 128

# 물빛: 색상(도) · 채도 배율 · 밝기 배율 · 몸통 물결 무늬 세기. 원래 버들항 물은 색상 171°(초록 쪽)다.
LOOKS = {
    "clear": {"label": "맑은 청록 물", "en": "clear teal water", "hue": 187, "sat": 0.98, "val": 1.10},
    "deep": {"label": "깊은 푸른 물", "en": "deep blue water", "hue": 203, "sat": 1.04, "val": 1.04},
    "jade": {"label": "비취빛 물", "en": "jade water", "hue": 177, "sat": 0.88, "val": 1.14},
    "tarn": {"label": "어두운 산못 물", "en": "dark tarn water", "hue": 194, "sat": 0.74, "val": 0.80},
}

cells = [np.zeros((T, T, 4), np.uint8)]
index = {}
def add(px):
    if px[..., 3].max() == 0: return -1
    key = px.tobytes()
    if key not in index: index[key] = len(cells); cells.append(px.copy())
    return index[key]

def hsh(x, y, s):
    v = (np.asarray(x).astype(np.int64) * 374761393 + np.asarray(y).astype(np.int64) * 668265263 + s * 2147483647) & 0xFFFFFFFF
    v = ((v ^ (v >> 13)) * 1274126177) & 0xFFFFFFFF
    return (v & 0xFFFF) / 65535.0

N8 = [(-1, -1), (0, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (0, 1), (1, 1)]
YY, XX = np.mgrid[0:T, 0:T].astype(float)
def mask_field(mask):
    f = np.zeros((3 * T, 3 * T), bool); f[T:2 * T, T:2 * T] = True
    for b, (dx, dy) in enumerate(N8):
        if mask >> b & 1: f[(dy + 1) * T:(dy + 2) * T, (dx + 1) * T:(dx + 2) * T] = True
    return f
def wobble(amp, s):
    return amp * (0.55 * np.sin(2 * math.pi * (XX + YY * 0.37) / T + s) + 0.45 * np.sin(2 * math.pi * (YY - XX * 0.29) / T * 2 + s * 1.7))
def shade(px, f):
    out = px.astype(float); out[..., :3] *= f; return np.clip(out, 0, 255).astype(np.uint8)
def centre(a):
    return a[T:2 * T, T:2 * T]
WOB3 = None
def wobble3(amp, s):
    return np.tile(wobble(amp, s), (3, 3))

DIRT_HI, DIRT_LO, DIRT_WET = np.array([150, 114, 74, 255], np.uint8), np.array([120, 88, 56, 255], np.uint8), np.array([78, 56, 40, 255], np.uint8)
RIM = (8, 22, 28, 176)            # 풀 입술 밑 젖은 그늘
LINE = (176, 228, 222, 124)       # 밝은 얕은 물 선
SHALLOW = ((132, 204, 196, 74), (132, 204, 196, 44))   # 얕은 물 띠 두 단

def shore_tile(mask, land):
    """물 칸 덧그림. 둑 선 = (뭍에서 4.6±0.9px 들어온 선) ∪ (칸 계단을 흐리게 편 선 — 물이 뭍으로 파고든 모서리와 대각 계단을 메운다, 7.5px 까지).
    뭍 쪽: 풀 → 짙은 풀 입술 1px → 흙 → 젖은 흙 1px. 물 쪽: 어두운 젖은 테 → 밝은 얕은 물 선 → 얕은 물 띠(안쪽 끝은 점점이)."""
    f = mask_field(mask)
    inside = ndimage.distance_transform_edt(f)                  # 뭍에서 물 안쪽으로 잰 거리
    sm = ndimage.gaussian_filter(f.astype(float), 6.0, mode="nearest")
    land48 = ~f | (inside < 4.6 + wobble3(1.5, 0.7)) | ((sm < 0.79 + wobble3(0.04, 2.3)) & (inside < 7.5))
    if land48.all(): land48 = ~f | (inside < 7.0)               # 한 칸 폭 물길: 가운데 실개천은 남긴다
    dl = centre(ndimage.distance_transform_edt(land48)); dw = centre(ndimage.distance_transform_edt(~land48)); is_land = centre(land48)
    out = np.zeros((T, T, 4), np.uint8)
    out[is_land] = land[is_land]
    lip = is_land & (dl > 2.6) & (dl <= 3.6)
    out[lip] = shade(land, 0.78)[lip]
    dirt = is_land & (dl <= 2.6)
    hi = hsh(XX, YY, 5) > 0.55
    out[dirt & hi] = DIRT_HI; out[dirt & ~hi] = DIRT_LO
    out[is_land & (dl <= 1.0)] = DIRT_WET
    w = ~is_land
    out[w & (dw <= 1.6)] = RIM
    out[w & (dw > 1.6) & (dw <= 2.6) & (hsh(XX // 2, YY, 13) > 0.16)] = LINE
    far = 6.4 + wobble(1.2, 2.9)
    band = w & (dw > 2.6) & (dw <= far)
    out[band & (dw <= 4.4)] = SHALLOW[0]
    out[band & (dw > 4.4)] = SHALLOW[1]
    out[band & (dw > far - 1.4) & (hsh(XX, YY, 17) > 0.6)] = 0     # 띠 안쪽 끝은 점점이 흩어진다
    return out

def blotch(seed):
    """속 칸 얼룩: 16px 주기 낮은 주파수 무늬 → 0~1."""
    a, b = 1 + seed % 2, 1 + (seed // 2) % 2
    v = 0.5 + 0.28 * np.sin(2 * math.pi * (a * XX + YY * 0.5) / T + seed * 1.3) + 0.22 * np.sin(2 * math.pi * (b * YY - XX * 0.5) / T + seed * 2.1)
    return v + (hsh(XX, YY, 40 + seed) - 0.5) * 0.22

DEEP_RGB = (5, 20, 34)
DEEP_A = (34, 70, 104)             # 띠마다 바탕 알파. 칸의 농담(tone 0~3)과 칸 안 얼룩이 9 씩 더한다 — 이웃 칸의 농담 경계가 얼룩에 묻힌다
def deep_tile(mask, level, tone=1, variant=0):
    """level 0·1·2 = 뭍에서 두 칸·네 칸·일곱 칸 넘는 물 칸 묶음. 그 묶음의 칸 계단을 흐리게 편 선 안쪽만 칠하고(가장자리는 들쭉날쭉),
    바깥은 한 단 옅은 띠의 막이다. 반투명이라 아래 물결이 비친다."""
    f = mask_field(mask)
    sm = centre(ndimage.gaussian_filter(f.astype(float), 5.0, mode="nearest"))
    thr = 0.60 + wobble(0.10, 1.1 + level * 1.9)
    bl = blotch(variant + level * 5) >= 0.5
    out = np.zeros((T, T, 4), np.uint8)
    def paint(sel, lv):
        a = DEEP_A[lv] + 9 * tone
        out[sel & ~bl] = (*DEEP_RGB, a); out[sel & bl] = (*DEEP_RGB, a + 9)
    if level > 0: paint(np.ones((T, T), bool), level - 1)
    keep = (sm > thr) | ((sm > thr - 0.07) & (hsh(XX, YY, 23 + level) > 0.5))
    paint(keep, level)
    if mask == 255:   # 물비늘: 깊은 띠 속의 옅은 가로 잔물결(원래 항구 그림의 밝은 줄)
        for k in range(2):
            y0 = int(hsh(variant + tone * 3, k, 61 + level) * T); x0 = int(hsh(variant + tone * 3, k, 67 + level) * (T - 5)); n = 3 + int(hsh(variant, k, 71) * 3)
            if hsh(variant + tone * 3, k, 73 + level) > 0.5: out[y0, x0:x0 + n] = (150, 210, 214, 46)
    return out

def side_mask(pos):
    """폭포 자리(0 왼끝 · 1 가운데 · 2 오른끝 · 3 한 칸 폭)의 물줄기 자리 — 끝 칸은 물가 둑 폭(5px 남짓)만큼 안으로 들고 가장자리가 들쭉날쭉하다."""
    m = np.ones((T, T), bool)
    edge = 4.6 + (hsh(0, YY, 97) - 0.5) * 2.2
    if pos in (0, 3): m &= XX >= edge
    if pos in (2, 3): m &= XX <= T - 1 - edge
    return m

def crest_tile(pos):
    """폭포 마루: 떨어지기 직전 물 칸의 남쪽 끝 — 밝은 물마루 줄과 점점이 흰 물보라."""
    out = np.zeros((T, T, 4), np.uint8)
    out[12] = (150, 214, 224, 70); out[13] = (176, 228, 236, 120); out[14] = (214, 240, 246, 200); out[15] = (150, 214, 224, 170)
    spray = hsh(XX, YY, 91) > 0.62
    out[13][spray[13]] = (240, 250, 252, 200)
    out[~side_mask(pos)] = 0
    return out

def plunge_tile(pos):
    """용소: 폭포 바로 밑 물 칸 — 위쪽 흰 물보라가 아래로 점점이 흩어지고 가로 잔물결이 번진다."""
    out = np.zeros((T, T, 4), np.uint8)
    for y in range(T):
        dens = max(0.0, 0.95 - y * 0.11)
        row = hsh(XX[y] + pos * 31, y, 101) < dens
        a = int(max(60, 235 - y * 16))
        out[y][row] = (236, 248, 250, a)
        if y in (9, 12, 14):
            x0 = int(hsh(pos, y, 103) * 6); out[y, x0:x0 + 5] = (170, 224, 230, 110); out[y, x0 + 8:x0 + 11] = (170, 224, 230, 80)
    wide = np.ones((T, T), bool)
    if pos in (0, 3): wide &= XX >= 3
    if pos in (2, 3): wide &= XX <= T - 4
    out[~wide] = 0
    return out

def bake_overlays(table):
    sheet = np.array(Image.open(SHEET).convert("RGBA"))
    grass = sheet[(737 // 128) * T:(737 // 128 + 1) * T, (737 % 128) * T:(737 % 128 + 1) * T].copy()
    table["shore"] = [add(shore_tile(m, grass)) for m in range(256)]
    grounds = {}
    for f in sorted(GROUNDS.glob("ground-*.png")):
        tex = np.array(Image.open(f).convert("RGBA"))
        pairs, seen = [], set()
        for m in range(256):
            base = table["shore"][m]
            if base < 0 or base in seen: continue
            seen.add(base)
            pairs += [base, add(shore_tile(m, tex))]
        grounds[f.stem] = pairs
    table["shoreGrounds"] = grounds
    table["deep"] = [[add(deep_tile(m, lv)) for m in range(256)] for lv in range(3)]
    table["deepFull"] = [[add(deep_tile(255, lv, tone, v)) for tone in range(4) for v in range(2)] for lv in range(3)]
    table["crest"] = [add(crest_tile(pos)) for pos in range(4)]
    table["plunge"] = [add(plunge_tile(pos)) for pos in range(4)]

def hsv_arrays(a):
    rgb = a[..., :3].astype(float) / 255
    mx, mn = rgb.max(-1), rgb.min(-1); d = mx - mn; r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    dd = np.where(d > 0, d, 1)
    h = np.where(mx == r, ((g - b) / dd) % 6, np.where(mx == g, (b - r) / dd + 2, (r - g) / dd + 4)) * 60
    return np.where(d > 0, h, 0), np.where(mx > 0, d / np.where(mx > 0, mx, 1), 0), mx

def bake_looks(table):
    ts = json.loads(TSJ.read_text(encoding="utf-8"))
    sheet = np.array(Image.open(SHEET).convert("RGBA"))
    n = ts["count"]
    tiles = sheet[: n // COLS * T].reshape(n // COLS, T, COLS, T, 4).swapaxes(1, 2).reshape(-1, T, T, 4)
    h, s, v = hsv_arrays(tiles)
    opaque = tiles[..., 3] == 255
    wat = (h >= 160) & (h <= 204) & (s >= 0.2) & opaque
    key = (tiles[..., 0].astype(np.int64) << 16) | (tiles[..., 1].astype(np.int64) << 8) | tiles[..., 2]
    # 물 색 줄: 통째로 물인 칸에 40화소 넘게 나오는 색
    pal, cnt = np.unique(key[wat.sum((1, 2)) == 256], return_counts=True)
    pal = pal[cnt >= 40]
    in_pal = np.isin(key, pal) & opaque
    body = np.isin(key, np.array([(26 << 16) | (70 << 8) | 64, (20 << 16) | (60 << 8) | 54, (28 << 16) | (74 << 8) | 68])) & opaque
    # 물 칸: 물 색이 16화소 넘고 몸통 물 색(가장 흔한 세 색)이 12화소 넘는다 — 창 유리·수조처럼 몸통 색이 없는 청록은 건드리지 않는다
    targets = np.nonzero((in_pal.sum((1, 2)) >= 16) & (body.sum((1, 2)) >= 12))[0]
    recolour = {}
    for name, look in LOOKS.items():
        m = {}
        for k in pal:
            r, g, b = (int(k) >> 16) & 255, (int(k) >> 8) & 255, int(k) & 255
            hh, ss, vv = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            # 초록 쪽(171°)에서 밝은 물비늘(182~190°)까지의 차이는 지키며 옮긴다
            nh = (look["hue"] + (hh * 360 - 171) * 0.6) / 360
            hi = vv > 0.6   # 물비늘·물보라는 밝기를 덜 건드린다
            nr, ng, nb = colorsys.hsv_to_rgb(nh % 1, min(1, ss * look["sat"]), min(1, vv * (look["val"] if not hi else (1 + look["val"]) / 2)))
            m[int(k)] = (round(nr * 255), round(ng * 255), round(nb * 255))
        recolour[name] = m
    looks_table = json.loads(LOOKS_JSON.read_text(encoding="utf-8"))
    looks_sheet = np.array(Image.open(LOOKS_PNG).convert("RGBA"))
    def looks_cell(i):
        return looks_sheet[(i // COLS) * T:(i // COLS + 1) * T, (i % COLS) * T:(i % COLS + 1) * T]
    def paint(src, t, lut):
        px = src.copy(); sel = in_pal[t]
        px[sel] = [(*lut[int(k)], 255) for k in key[t][sel]]
        return px
    # 폭포(절벽면 그림): 원래 도시의 폭포 킷(bd-waterfall-drop, 12칸 폭 운하 폭포) 가운데 두 열의 물줄기 화소를 좁은 강 폭에 맞춰 다시 짠다 —
    # 마루 줄(물마루 선 + 물줄기) · 떨어지는 줄 · 물보라 줄, 자리 넷(왼끝·가운데·오른끝·한 칸 폭) × 물결 여덟 프레임. 끝 칸은 둑 폭만큼 투명(절벽이 보인다).
    kit = next(k for k in ts["structureKits"] if k["id"] == "bd-waterfall-drop")
    strips = {st["baseTile"]: st["frames"] for st in ts["animationStrips"]}
    def frame_of(t, f):
        return tiles[t + f % strips.get(t, 1)]      # 프레임 수가 다른 띠(여덟 장·넉 장)와 서 있는 칸이 섞여 있다
    def strip_frame(row, col, f):
        lo, up = kit["rows"][row]["tiles"][col], (kit["rows"][row].get("upperTiles") or [-1] * 12)[col]
        px = frame_of(lo, f).copy()
        if up >= 0:
            top = frame_of(up, f); a = top[..., 3:4].astype(float) / 255
            px[..., :3] = (top[..., :3] * a + px[..., :3] * (1 - a)).astype(np.uint8); px[..., 3] = np.maximum(px[..., 3], top[..., 3])
        return px
    fall_rows = {"top": 1, "body": 2, "foot": 3}
    fall = {"frames": 8, "fps": 8}
    fall_src = {}                      # 그림판 칸 → 원래 화소(물빛마다 다시 칠할 원본)
    for part, row in fall_rows.items():
        firsts = []
        for pos in range(4):
            firsts.append(len(cells))
            for f in range(8):
                px = strip_frame(row, 5 + (pos % 2), f)
                px[~side_mask(pos)] = 0
                fall_src[len(cells)] = px; cells.append(px)
        fall[part] = firsts
    table["fall"] = fall
    def paint_px(px, lut):
        out = px.copy()
        k = (px[..., 0].astype(np.int64) << 16) | (px[..., 1].astype(np.int64) << 8) | px[..., 2]
        sel = np.isin(k, pal) & (px[..., 3] == 255)
        out[sel] = [(*lut[int(v)], 255) for v in k[sel]]
        return out
    uniq, order, tcell = {}, [], []
    for t in targets:
        b = tiles[t].tobytes()
        if b not in uniq: uniq[b] = len(order); order.append(int(t))
        tcell.append(uniq[b])
    table["targets"] = [int(t) for t in targets]; table["cells"] = tcell; table["looks"] = {}
    # 바닥·길 겉모습이 이미 다시 그리는 칸(물과 풀·포석이 함께 실린 칸): 그 겉모습 그림 위에 물 화소만 다시 칠한 칸을 겉모습마다 따로 굽는다
    tset = set(int(t) for t in targets)
    g_idx = [(i, t) for i, t in enumerate(looks_table["targets"]["ground"]) if t in tset]
    p_idx = [(i, t) for i, t in enumerate(looks_table["targets"]["paved"]) if t in tset]
    table["mixed"] = {"ground": [t for _, t in g_idx], "paved": [t for _, t in p_idx]}
    for name, look in LOOKS.items():
        lut = recolour[name]
        base = len(cells)
        for t in order: cells.append(paint(tiles[t], t, lut))     # 물빛 묶음 안 자리 = cells[i]
        grounds, surfaces = {}, {}
        for gid, g in looks_table["grounds"].items():
            grounds[gid] = len(cells)
            for i, t in g_idx: cells.append(paint(looks_cell(g["base"] + i), t, lut))
        for sid, o in looks_table["parts"]["surface"]["options"].items():
            if "base" not in o or not p_idx: continue
            surfaces[sid] = len(cells)
            for i, t in p_idx: cells.append(paint(looks_cell(o["base"] + i), t, lut))
        pairs = []
        for cell, px in fall_src.items(): pairs += [cell, len(cells)]; cells.append(paint_px(px, lut))
        table["looks"][name] = {"label": look["label"], "en": look["en"], "base": base, "grounds": grounds, "surfaces": surfaces, "sources": {"tex_beodeul_water": pairs}}
    return len(order)

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--check", action="store_true"); args = ap.parse_args()
    table = {"version": 1, "tilesetId": "beodeul_city", "image": "tex_beodeul_city", "texture": "tex_beodeul_water", "tileSize": T, "tilesPerRow": COLS,
             "note": "생성 파일 — scripts/content/beodeul-water/bake.py. shore·deep[띠] = [이웃 비트 256] → 그림판 칸(-1 없음). deepFull[띠][농담*2+얼룩] = 속 칸. crest·plunge = 폭포 마루·용소 [자리]. fall = 폭포 띠(프레임 여덟 장)의 첫 칸 [자리]. shoreGrounds = 바닥 겉모습마다 [원래 둑 칸, 그 바닥 둑 칸] 쌍. "
                     "물빛: targets[i] 칸의 그림 = 그림판 (looks[이름].base + cells[i]). mixed.ground[i]·mixed.paved[i] 칸은 바닥·길 겉모습이 있으면 (looks[이름].grounds[바닥] + i)·(looks[이름].surfaces[겉모습] + i)."}
    bake_overlays(table)
    overlay_cells = len(cells)
    uniq = bake_looks(table)
    table["count"] = -(-len(cells) // COLS) * COLS
    a = np.zeros((table["count"] // COLS * T, COLS * T, 4), np.uint8)
    for i, c in enumerate(cells):
        y, x = divmod(i, COLS); a[y * T:(y + 1) * T, x * T:(x + 1) * T] = c
    im = Image.fromarray(a, "RGBA")
    text = json.dumps(table, ensure_ascii=False, separators=(",", ":")) + "\n"
    print(f"그림판 {im.size[0]}×{im.size[1]} · 덧그림 칸 {overlay_cells - 1} · 물 칸 {len(table['targets'])}(서로 다른 그림 {uniq}) · 물빛 {len(LOOKS)}")
    if args.check:
        same = OUT_JSON.exists() and OUT_JSON.read_text(encoding="utf-8") == text and OUT_PNG.exists() and np.array_equal(np.array(Image.open(OUT_PNG).convert("RGBA")), a)
        print("같다" if same else "다르다 — 다시 구워야 한다"); sys.exit(0 if same else 1)
    OUT_PNG.parent.mkdir(parents=True, exist_ok=True)
    im.save(OUT_PNG, optimize=True)
    OUT_JSON.write_text(text, encoding="utf-8")
    print(f"썼다: {OUT_PNG.relative_to(ROOT)} ({OUT_PNG.stat().st_size // 1024} KB) · {OUT_JSON.relative_to(ROOT)} ({len(text) // 1024} KB)")

if __name__ == "__main__":
    main()
