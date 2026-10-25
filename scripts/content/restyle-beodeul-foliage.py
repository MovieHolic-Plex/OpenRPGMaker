#!/usr/bin/env python3
"""버들항 시트(beodeul_city)의 낱 나무·덤불·생울타리·바늘잎·숲 바닥 풀포기를 숲 수관(forestCanopy)과 같은 화풍으로 다시 칠한다.

왜: 2026-10-18 사용자 「괜찮은데 흠 .. 근데 이렇게 할거면 기존 수풀들 이미지들도 쫙 바꿔서 화풍을 좀 일치시켜야할듯」.
    숲 수관은 append-beodeul-forest-canopy.py 가 왼쪽 위 해·수종별 6단 색 단·바이어 점묘·햇빛 테·그늘 쪽 외곽선으로 다시 칠하는데,
    그 옆에 서는 낱 나무·덤불은 옛 그림 그대로(푸른 기 도는 평평한 초록, 해 방향 없음)라 숲 덩이와 마을 나무가 다른 그림체로 보였다.
무엇: 키트 그림 하나를 통째로 모아(아래·위 층) 잎 화소와 줄기 화소를 나눈다.
  - 잎: 숲 수관과 같은 relight(같은 해·같은 색 단·햇빛 테·외곽선). 실루엣(둥근 지붕)은 잎 사이로 비치는 가지까지 채운 모양으로 잰다.
    색 단은 원래 그림 밝기·색조로 고른다(밝은 → lime, 누런 → elm, 보통 → oak, 짙은 덤불 → oak 한 단 아래, 기둥 나무 → cedar,
    전나무 → pine/cedar, 설원 소나무 → spruce + 눈, 고산 → fir, 풀포기 → shrub).
  - 줄기·가지: 숲 수관 줄기와 같은 4단 나무껍질 색(밝기 순위 + 왼쪽 밝고 오른쪽 짙게). 잎 바로 밑 2px 는 그늘(수관이 덮은 줄기 머리 AO).
  - 꽃·화분·돌 화소(초록·갈색 아닌 것)는 그대로.
  칸은 시트 안 제자리에 다시 쓴다(같은 칸을 쓰는 큰 구획 키트 — 항구·성당·장원 정원 — 의 나무도 함께 바뀐다). 두 키트가 같은 칸을 쓰면 먼저 칠한 것.
멱등: 다시 칠할 칸의 원본을 scripts/content/beodeul-foliage/source-tiles.png(+ .json 칸 번호·다시 칠한 칸 지문)에 모아 두고, 다음부터는 그 원본에서 칠한다.
  시트 칸이 지문과 다르면(bake_picks.py·build-beodeul-city.py 등이 칸을 새로 그림) 그 새 그림을 원본으로 삼는다 — 굽기 뒤 이 스크립트를 다시 돌리면 된다.
  숲 수관 스크립트(append-beodeul-forest-canopy.py)도 같은 규칙으로 원본을 읽는다.

  python3 scripts/content/restyle-beodeul-foliage.py
"""
import colorsys, importlib.util, json
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

HERE = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location("canopy", HERE / "append-beodeul-forest-canopy.py")
cv = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(cv)
T, COLS = cv.T, cv.COLS

PIN = {'bd-tree-03a8f7': ('oak', 0), 'bd-tree-d43edd': ('oak', 0), 'bd-tree-5844f6': ('oak', 0), 'bd-tree-3e8732': ('oak', 0), 'bd-tree-f4f319': ('lime', 0), 'bd-tree-e9d9b3': ('oak', -1), 'bd-tree-37f48b': ('lime', 0), 'bd-tree-1a786c': ('oak', 0), 'bd-tree-47e17a': ('oak', -1), 'bd-tree-d105b2': ('oak', -1), 'bd-tree-0f7ed1': ('elm', 0), 'bd-tree-d61d7e': ('oak', 0), 'bd-tree-a80c85': ('oak', 0), 'bd-tree-7ecdb8': ('lime', 0), 'bd-tree-cc0fcb': ('oak', -1), 'bd-tree-132848': ('lime', 0), 'bd-tree-1e09f0': ('oak', -1), 'bd-tree-bdd36e': ('oak', 0), 'bd-tree-b1d104': ('oak', 0)}
# (키트, 색 단 | None = 밝기·색조로 고름, 겹 깊이 off). 설원 소나무는 눈 단을 함께 쓴다.
KITS = (
    # 색 단은 2026-10-22 새로 그린 나무로 바꾸며 그 전 그림이 고른 단으로 고정했다(새 그림의 밝기로 단이 바뀌어 마을 색이 흔들리지 않게).
    [(f"bd-tree-{h}", *PIN[f"bd-tree-{h}"]) for h in
     "03a8f7 d43edd 5844f6 3e8732 f4f319 e9d9b3 37f48b 1a786c 47e17a d105b2 0f7ed1 d61d7e a80c85 7ecdb8 cc0fcb 132848 1e09f0 bdd36e b1d104".split()]
    + [("bd-tree-eef4bc", "cedar", 0), ("bd-tree-28ad5e", "cedar", 0), ("bd-tree-c27062", "pine", 0)]
    + [("bd-mpart-bush-c", "oak", -1), ("bd-mpart-bush-e", "lime", 0),
       ("bd-mpart-hedge", "oak", 0), ("bd-prop-hedge", "oak", 0), ("bd-pick-wizard-tower-hedge", "oak", 0),   # elm 은 다듬은 생울타리를 레몬빛으로 바랬다
       ("bd-mpart-shrub-tub", "oak", 0), ("bd-mpart-cypress-tub", "pine", 0), ("bd-prop-tree_planter", "oak", 0)]
    + [("bd-pick-coast-cliff-road-fir-l", "pine", 0), ("bd-pick-coast-cliff-road-fir-m", "pine", 0),
       ("bd-pick-coast-cliff-road-fir-m2", "cedar", 0), ("bd-pick-coast-cliff-road-fir-s", "cedar", 0),
       ("bd-pick-mining-valley-fir", "pine", -1), ("bd-pick-temple-ruins-cypress-ruin", "pine", 0),   # 측백은 cedar 로 칠하면 짙은 속이 빠져 흐려졌다
       ("bd-pick-mountain-pass-alpine-a", "fir", 0), ("bd-pick-mountain-pass-alpine-b", "fir", 0),
       ("bd-pick-snowfield-pine", "spruce", 0)]
    + [(f"bd-pick-{p}", "shrub", 0) for p in
       ["coast-cliff-road-heath-a", "coast-cliff-road-heath-b", "coast-cliff-road-heath-c",
        "deep-forest-path-fern-a", "deep-forest-path-fern-b", "deep-forest-path-fern-c",
        "deep-forest-path-heath-a", "deep-forest-path-heath-b", "deep-forest-path-heath-c",
        "deep-forest-path-wild-a", "deep-forest-path-wild-b", "deep-forest-path-wild-c",
        "wheat-roman-road-wild-a", "wheat-roman-road-wild-b"]]
)
SNOWY = {"bd-pick-snowfield-pine"}
TRUNK = cv.STYLES["leaf"]["trunk"]          # 숲 수관 줄기와 같은 4단 나무껍질(밝음 → 짙음)

def hsv(rgb):
    f = rgb.reshape(-1, 3) / 255.0
    return np.array([colorsys.rgb_to_hsv(*p) for p in f]).reshape(rgb.shape)

def classify(px, snowy):
    """화소 → 0 투명, 1 잎, 2 줄기·가지(갈색), 3 그대로(꽃·화분·돌). 설원 소나무의 푸르스름한 흰 화소(눈)는 잎(relight 가 눈 단으로 칠한다)."""
    a = px[..., 3] > 0
    H = hsv(px[..., :3].astype(float))
    h, s, v = H[..., 0], H[..., 1], H[..., 2]
    leaf = a & (h > 0.15) & (h < 0.5) & (s > 0.12)
    bark = a & ~leaf & (h < 0.14) & (s > 0.18) & (v < 0.75)
    if snowy:
        rgb = px[..., :3].astype(int)
        leaf |= a & (rgb[..., 2] >= rgb[..., 0]) & (rgb[..., 2] >= rgb[..., 1] - 6) & (v > 0.24) & ~bark
    return np.where(leaf, 1, np.where(bark, 2, np.where(a, 3, 0)))

def kit_layers(kid):
    """키트 칸 자리 [(층, j, i, 칸 번호)] 과 아래 층 → 위 층 순으로 덮은 RGBA 그림."""
    k = cv.KITS[kid]
    cells = []
    im = np.zeros((k["height"] * T, k["width"] * T, 4), np.uint8)
    for li, name in enumerate(("tiles", "upperTiles")):
        for j, r in enumerate(k["rows"]):
            for i, n in enumerate(r.get(name) or []):
                if n is None or n < 0: continue
                cells.append((li, j, i, n))
                src = cv.tile_px(n); m = src[..., 3] > 0
                im[j * T:(j + 1) * T, i * T:(i + 1) * T][m] = src[m]
    return cells, im

def pick_ramp(img, cls):
    """원래 잎 색 → 숲 수관 색 단 이름과 겹 깊이. 밝은 잎 lime, 누런 잎 elm, 짙은 덤불은 oak 한 단 아래."""
    c = img[cls == 1][:, :3].astype(float)
    lum = (c @ [0.3, 0.59, 0.11]).mean(); rg = c[:, 0].sum() / max(1.0, c[:, 1].sum())
    if lum >= 108: return "lime", 0
    if rg >= 0.5: return "elm", 0
    if lum < 78: return "oak", -1
    return "oak", 0

def recolor_bark(img, cls, leaf_shape):
    """줄기 화소 → 4단 나무껍질. 밝기 순위 + 왼쪽(해 쪽) 밝힘, 잎 바로 밑 2px 는 그늘."""
    out = img.copy()
    m = cls == 2
    if not m.any(): return out
    lum = img[..., :3].astype(float) @ [0.3, 0.59, 0.11]
    idx = np.flatnonzero(m)
    rank = np.zeros(m.size); rank[idx] = lum.ravel()[idx].argsort(kind="stable").argsort(kind="stable") / max(1, len(idx) - 1)
    rank = rank.reshape(m.shape)
    # 줄기 무리마다 왼쪽 → 오른쪽 위치(0~1)
    lab, n = ndimage.label(m)
    xs = np.tile(np.arange(m.shape[1], dtype=float), (m.shape[0], 1)); side = np.zeros(m.shape)
    for k in range(1, n + 1):
        sel = lab == k; x = xs[sel]
        side[sel] = (x - x.min()) / max(1.0, x.max() - x.min())
    v = 0.55 * rank + 0.45 * (1 - side)
    dith = cv.BAYER[np.arange(m.shape[0])[:, None] % 4, np.arange(m.shape[1])[None, :] % 4] * 0.6
    k = np.clip(3 - np.floor(v * 3.99 + dith), 0, 3).astype(int)
    under = np.zeros_like(m)
    for d in (1, 2): under[d:] |= leaf_shape[:-d]
    k[m & under] = np.maximum(k[m & under], 2)
    pal = np.array(TRUNK, np.uint8)
    out[m, :3] = pal[k[m]]
    return out

def restyle(kid, ramp_name, off):
    cells, img = kit_layers(kid)
    snowy = kid in SNOWY
    cls = classify(img, snowy)
    if not (cls == 1).any(): return None
    if ramp_name is None: ramp_name, off = pick_ramp(img, cls)
    leaf = cls == 1
    # 둥근 지붕 실루엣 = 잎 + 잎에 둘러싸인 가지·틈(잎 덩이 속에 외곽선이 생기지 않게)
    shape = ndimage.binary_fill_holes(ndimage.binary_closing(leaf, iterations=2) | leaf) & ((cls == 1) | (cls == 2) | ~(img[..., 3] > 0))
    fol = np.zeros_like(img); fol[leaf] = img[leaf]
    lit = cv.relight(fol, cv.RAMP[ramp_name], off, rim=True, snow=cv.RAMP["snow"] if snowy else None, shape=shape | leaf, clump=True)
    out = recolor_bark(img, cls, shape | leaf)
    out[leaf, :3] = lit[leaf, :3]
    return cells, img, out, ramp_name, off

def main():
    originals = dict(cv.FOLIAGE_ORIG)              # cv.sheet 에는 이미 원본이 덮여 있다(지문이 맞는 칸만)
    sheet = cv.sheet.copy()
    hidden = {1: np.array(cv.RAMP["oak"][2], np.uint8), 2: np.array(TRUNK[2], np.uint8)}
    done, report = set(), []
    for kid, ramp, off in KITS:
        if kid not in cv.KITS: raise SystemExit(f"missing kit {kid}")
        r = restyle(kid, ramp, off)
        if r is None: continue
        cells, img, out, rn, of = r
        top_cls = classify(img, kid in SNOWY)
        wrote = 0
        for _, j, i, n in cells:
            if n in done: continue
            src = cv.tile_px(n).copy()
            cls = classify(src, kid in SNOWY)
            vis = out[j * T:(j + 1) * T, i * T:(i + 1) * T]
            vcls = top_cls[j * T:(j + 1) * T, i * T:(i + 1) * T]
            new = src.copy()
            # 잎·줄기 화소는 다시 칠한 그림의 같은 자리 색. 위 층에 가려진 아래 층 화소가 다른 무리(잎 밑 줄기 등)면 그 무리의 가운데 단.
            for c in (1, 2):
                m = cls == c
                same = m & (vcls == c)
                new[same, :3] = vis[same, :3]
                new[m & ~same, :3] = hidden[c]
            if not np.array_equal(new, src):
                done.add(n); wrote += 1
                originals[n] = src
                sheet[(n // 128) * T:(n // 128 + 1) * T, (n % 128) * T:(n % 128 + 1) * T] = new
        report.append(f"{kid}: {rn}{'' if of == 0 else f' {of:+d}'} · {wrote}칸")
    # 원본 띠(한 줄 16칸) — 이번에 다시 칠한 칸만, 칸 번호 순. 지문 = 다시 칠한 칸 화소.
    ids = sorted(done)
    cv.FOLIAGE_SRC.parent.mkdir(parents=True, exist_ok=True)
    strip = np.zeros(((len(ids) + COLS - 1) // COLS * T, COLS * T, 4), np.uint8)
    for i, n in enumerate(ids):
        strip[(i // COLS) * T:(i // COLS + 1) * T, (i % COLS) * T:(i % COLS + 1) * T] = originals[n]
    Image.fromarray(strip, "RGBA").save(cv.FOLIAGE_SRC, optimize=True)
    fps = [cv.tile_fingerprint(sheet[(n // 128) * T:(n // 128 + 1) * T, (n % 128) * T:(n % 128 + 1) * T]) for n in ids]
    cv.FOLIAGE_IDX.write_text(json.dumps({"note": "restyle-beodeul-foliage.py 가 다시 칠하기 전 버들항 시트 칸 원본(띠 그림 순서) · out = 다시 칠한 칸 지문", "tiles": ids, "out": fps}) + "\n")
    Image.fromarray(sheet, "RGBA").save(cv.SHEET, optimize=True)
    print("\n".join(report))
    print(f"다시 칠한 칸 {len(done)} -> {cv.FOLIAGE_SRC.relative_to(cv.ROOT)}")

if __name__ == "__main__":
    main()
