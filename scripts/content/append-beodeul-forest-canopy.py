#!/usr/bin/env python3
"""버들항 자연 덧그림(beodeul_nature)에 «이어진 숲 수관(forestCanopy)» 오토타일을 덧붙인다.

배경
  - 2026-10-18 사용자 반려 「버들 마을은 풀이 뭉쳐진 .. '숲' 을 구현하질 못함」 → 1판: 작은 수관 화소를 13×9px 간격으로 촘촘히 찍은 32px 주기 판.
  - 같은 날 2차 반려 「'숲' 이라고 만들어놓은게 좆같이 어색함」: 1판은 수관 하나하나가 작고 고르게 깔려 뽁뽁이(버블랩)·브로콜리 줄처럼 보였고,
    가장자리 수관이 칸 경계에서 곧게 잘려 숲 덩이가 네모로 보였으며, 남쪽 줄기가 32px 마다 같은 자리(빗살)에 서 있었다.
  2판은 실제 나무 한 그루 크기(32px)의 수관을 두 겹으로 겹쳐 쌓는다.

칸 경계 이음매가 생기지 않는 규칙(핵심)
  수관 하나는 «칸 2×2 덩이» 한 곳에만 산다(덩이 밖으로 화소가 나가지 않는다). 그 덩이의 네 칸은 서로 이웃이라 네 칸 어느 칸의 오토타일도
  나머지 세 칸이 숲인지 안다 — 그래서 «네 칸이 다 숲일 때만 그린다» 는 판정이 네 칸에서 똑같이 나고, 수관이 칸 경계에서 잘리지 않는다.
  숲 덩이의 테두리는 칸 계단이 아니라 둥근 수관들의 실루엣이 된다.

무엇(16px 칸, 이웃 비트 = 북서1 북2 북동4 서8 동16 남서32 남64 남동128, 맵 밖은 «숲»):
  - 여러 겹 수관(활엽 3겹·설원 소나무 4겹): 아래 겹은 짙게 눌러 칠한 큰 수관(30~32px), 위 겹은 햇빛 받는 24~32px 수관. 겹마다 주기 판(P×P 칸)
    모서리에 서로 대각 1칸 넘게 떨어진 자리를 뽑아 버들항 둥근 활엽수 수관(밝은·올리브·짙은 무리)·색조(따뜻한·차가운)·좌우 반전·덩이 안 흔들림을 준다.
    어느 수관도 덮지 않는 칸이 남으면 아래 겹 수관을 하나 더 세운다. 남쪽 수관이 위(3/4 시점). 위 겹 수관은 덮는 수관 둘레 2px 에 접촉 그늘(AO)을 남긴다.
  - 수관 사이 틈: 깊은 숲 속은 짙은 숲 속 그늘, 숲 가장자리 16px 띠에서는 위·왼쪽·오른쪽이 모두 수관인 틈만 그늘(나머지는 풀이 비친다 —
    숲 끝을 따라 짙은 네모 판·곧은 띠가 드러나지 않는다). 그늘 문턱은 절대 좌표 물결로 흔든다.
  - 남쪽 숲 끝(덩이 아래 줄 칸의 남쪽이 숲 아님): 수관 아래 절반을 8px 로 눌러 둥근 밑면을 만들고, 그 밑 8px 에 수관 «바로 밑» 줄기·뿌리와
    수관 실루엣을 따라 옅어지는 떨어진 그림자.
  - 덩이가 하나도 서지 못하는 칸(한 칸 폭 숲 띠·뾰족한 끝): 셋 중 둘 꼴로 고사리·들꽃·독버섯 같은 숲 가장자리 덤불을 칸 안에 둔다.
  - 숲 그림자(forestShade): 숲 남쪽 바로 아래 칸의 옅은 2층 그늘. 깊이·짙기가 x 에 따라 물결친다. [(x % 주기)*4 + (북서 숲?2:0) + (북동 숲?1:0)].
출력: public/assets/beodeul-nature/chipset.png 뒤에 덧붙이고 src/assets/beodeulNatureCatalog.json 에
  forestPeriod: {leaf, snow}(칸), forestCanopy: { leaf: [위상 P²][256], snow: [위상 P²][256] }, forestShade: {leaf: [P*4], snow: [P*4]} 를 쓴다.
  위상 = (x % P) + P * (y % P).
멱등: 처음 돌 때의 count 를 forestBase 로 적어 두고 다음부터는 그 뒤만 다시 쓴다. 텍스처는 한 줄 16칸 · 4096px 이하(GPU 한도)여야 한다.

  python3 scripts/content/append-beodeul-forest-canopy.py
"""
import json, math
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
PNG = ROOT / "public/assets/beodeul-nature/chipset.png"
CAT = ROOT / "src/assets/beodeulNatureCatalog.json"
SHEET = ROOT / "public/assets/beodeul-city/beodeul-city-chipset.png"
TSJ = ROOT / "src/assets/beodeulCityTileset.json"
T, COLS = 16, 16
MAX_ROWS = 4096 // T
B = 2 * T          # 수관 덩이 한 변(px)

sheet = np.array(Image.open(SHEET).convert("RGBA"))
KITS = {k["id"]: k for k in json.loads(TSJ.read_text())["structureKits"]}

def tile_px(n):
    return sheet[(n // 128) * T:(n // 128 + 1) * T, (n % 128) * T:(n % 128 + 1) * T]

def kit_image(kid):
    k = KITS[kid]
    im = np.zeros((k["height"] * T, k["width"] * T, 4), np.uint8)
    for j, r in enumerate(k["rows"]):
        for layer in (r.get("tiles") or [], r.get("upperTiles") or []):
            for i, n in enumerate(layer):
                if n is None or n < 0: continue
                src = tile_px(n); m = src[..., 3] > 0
                im[j * T:(j + 1) * T, i * T:(i + 1) * T][m] = src[m]
    return im

def sprite(kid, keep=1.0, fit=B):
    """키트 그림의 불투명 부분(위에서 keep 비율 — 줄기를 뺀다). fit px 를 넘으면 비율을 지켜 줄인다(가장 가까운 화소)."""
    im = kit_image(kid)
    ys, xs = np.nonzero(im[..., 3] > 200)
    c = im[ys.min():ys.min() + int((ys.max() - ys.min() + 1) * keep), xs.min():xs.max() + 1].copy()
    c[c[..., 3] < 200] = 0
    ys, xs = np.nonzero(c[..., 3])
    c = c[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    h, w = c.shape[:2]
    if max(h, w) > fit:
        s = fit / max(h, w)
        c = np.array(Image.fromarray(c).resize((max(1, round(w * s)), max(1, round(h * s))), Image.NEAREST))
    return c

# 3판(2026-10-18 「숲들을 좀 더 고도화해라. 명암이나 뭐 이런거」): 수관 그림을 그대로 쓰지 않고 «한 해» 로 다시 칠한다.
#   해는 왼쪽 위(x+ 오른쪽, y+ 아래, z+ 화면 밖). 수관 실루엣을 둥근 지붕(거리 변환)으로 세워 법선을 내고, 법선·햇빛 내적 + 원래 그림의 잎 뭉치 밝기
#   순위 + 3/4 시점 위쪽 밝힘을 섞어 수종별 6단 색 단(그늘 푸른 기 → 빛 누런 기)에 4×4 바이어 점묘로 끊는다.
LIGHT = np.array([-0.58, -0.66, 0.48]); LIGHT /= np.linalg.norm(LIGHT)
BAYER = (np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) + 0.5) / 16 - 0.5
SHADOW_MUL = np.array([0.5, 0.56, 0.7])   # 위 겹 수관이 오른쪽 아래로 드리우는 그림자 — 짙고 푸르게(빛 쪽 누런 기와 색 온도 대비)
CAST = (4, 3)                             # 드리운 그림자 밀림(아래 px, 오른쪽 px)

# 명암 단(어둠 → 빛). 활엽(참나무 따뜻한·느릅 올리브·라임 싱그러운), 바늘잎(소나무·삼나무 — 더 짙고 차갑다), 덤불, 설원 가문비·눈.
RAMP = {
    "oak":    [(12, 34, 34), (22, 58, 44), (36, 88, 50), (62, 122, 52), (110, 160, 58), (176, 204, 88)],
    "elm":    [(18, 36, 32), (32, 62, 40), (54, 94, 44), (88, 126, 48), (132, 160, 62), (186, 198, 104)],
    "lime":   [(10, 36, 40), (18, 64, 52), (30, 100, 58), (56, 138, 62), (102, 178, 72), (166, 220, 106)],
    "pine":   [(10, 30, 36), (18, 50, 50), (30, 74, 60), (46, 100, 70), (76, 130, 80), (128, 168, 100)],
    "cedar":  [(14, 32, 32), (26, 54, 44), (42, 80, 54), (64, 108, 62), (100, 140, 72), (152, 180, 96)],
    "shrub":  [(10, 32, 28), (18, 54, 36), (30, 82, 42), (52, 116, 48), (92, 152, 58), (150, 194, 84)],
    "spruce": [(8, 26, 36), (14, 44, 52), (22, 66, 64), (36, 94, 78), (60, 124, 92), (104, 160, 116)],
    "fir":    [(10, 24, 34), (18, 40, 50), (28, 60, 62), (44, 84, 74), (70, 112, 86), (112, 148, 108)],
    "snow":   [(110, 130, 172), (150, 170, 204), (192, 206, 230), (224, 232, 246), (246, 250, 255)],
}

STYLES = {
    "leaf": {
        "period": 6, "density": (0.95, 0.9, 0.75), "fits": (24, 27, 30, 32),
        # 활엽 무리(잔 점묘 수관 — 마을 낱 나무와 같은 결)가 바탕이고, 주기 판 위 둥근 무리 자리에 바늘잎(전나무) 숲이 모인다.
        # 두 무리 모두 같은 해·같은 점묘 규칙으로 다시 칠하므로 그림체가 부딪치지 않는다(2판의 «베개 음영 수관 섞임» 문제를 피함).
        "species": [
            dict(kits=[("bd-tree-f4f319", 1.0), ("bd-tree-37f48b", 1.0), ("bd-tree-0f7ed1", 1.0)], ramps=["oak", "elm", "lime"], tw=4),
            dict(kits=[("bd-pick-coast-cliff-road-fir-m", 0.88), ("bd-pick-coast-cliff-road-fir-m2", 0.88), ("bd-pick-coast-cliff-road-fir-l", 0.9)],
                 ramps=["pine", "cedar"], tw=2, fits=(28, 30, 32)),
        ],
        "conifer": 0.3,
        "layer_off": (-1, 0, 0),
        "under": (12, 28, 24), "deep": (6, 16, 14),
        "trunk": ((150, 112, 66), (112, 80, 46), (76, 54, 32), (46, 32, 22)), "root": (64, 48, 30), "moss": ((70, 120, 46), (40, 82, 40)),
        "shade": (10, 28, 24),
        "fleck": (104, 140, 54), "shaft": (255, 238, 150), "shaft_k": 0.26,
        # 숲 앞(남쪽) 밑동 사이 하층: 덤불·고사리·이끼 바위·쓰러진 통나무(id, 맞출 px, 다시 칠할 색 단)
        "undergrowth": [("bd-mpart-bush-c", 13, "shrub"), ("bd-mpart-bush-e", 12, "shrub"), ("bd-tree-47e17a", 11, "shrub"),
                        ("bd-pick-deep-forest-path-fern-a", 12, None), ("bd-pick-deep-forest-path-fern-b", 12, None),
                        ("bd-pick-mountain-pass-boulder-m", 13, None), ("bd-pick-deep-forest-path-log-fallen", 18, None)],
        "brush": [("bd-pick-deep-forest-path-fern-a", 16), ("bd-pick-deep-forest-path-fern-b", 16), ("bd-pick-deep-forest-path-fern-c", 16),
                  ("bd-pick-deep-forest-path-wild-a", 16), ("bd-pick-deep-forest-path-toadstools-a", 16), ("bd-pick-deep-forest-path-wild-b", 16),
                  ("bd-pick-mountain-pass-boulder-m", 14), ("bd-mpart-bush-c", 14)],
    },
    "snow": {
        # 소나무는 키가 커서 32px 로 맞추면 덩이 안에서 위아래로 움직일 틈이 없어 16px 피치 가로줄(흰 눈-짙은 밑)로 늘어선다 — 20~29px 로 줄여 흔든다.
        # 3판: 눈 소나무 한 그림만 4×4 칸으로 되풀이하면 세모 격자(벽지)가 드러나 주기 6×6 칸 · 전나무 세 그림(가지 윗면에 눈을 얹어)을 섞는다.
        "period": 6, "density": (0.95, 0.9, 0.85, 0.8, 0.7), "fits": (20, 23, 26, 29),
        "species": [dict(kits=[("bd-pick-snowfield-pine", 0.86)], ramps=["spruce", "fir"], tw=2),
                    dict(kits=[("bd-pick-coast-cliff-road-fir-m", 0.88), ("bd-pick-coast-cliff-road-fir-m2", 0.88), ("bd-pick-coast-cliff-road-fir-l", 0.9)],
                         ramps=["spruce", "fir"], tw=2, caps=True)],
        "conifer": 0.45,
        "layer_off": (-1, -1, 0, 0, 0),
        "under": (100, 116, 156), "deep": (78, 92, 130),
        "trunk": ((132, 100, 70), (98, 72, 50), (70, 52, 38), (44, 34, 28)), "root": (70, 56, 44), "moss": ((206, 216, 232), (170, 184, 208)),
        "shade": (40, 60, 96),
        "fleck": (238, 242, 250), "shaft": (255, 250, 236), "shaft_k": 0.14,
        "undergrowth": [("bd-pick-snowfield-mound", 13, None), ("bd-pick-snowfield-rock", 12, None)],
        "brush": [("bd-pick-snowfield-mound", 16), ("bd-pick-snowfield-rock", 16)],
    },
}

def relight(img, ramp, off, rim, snow=None, caps=False):
    """수관 그림(RGBA) → 왼쪽 위 해로 다시 칠한 RGBA. off = 겹 깊이(아래 겹일수록 음수 → 짙은 단). rim = 왼쪽 위 테두리 1px 햇빛 테.
    snow 색 단이 오면 푸르스름·흰 화소(눈)는 그 단으로, 나머지(바늘잎)는 ramp 로 칠한다.
    caps 면 눈이 없는 바늘잎 그림에 가지 층 윗면(위 화소가 비었거나 훨씬 짙은 곳)·해 쪽 1~2px 에 눈을 얹는다."""
    a = img[..., 3] > 0
    h, w = a.shape
    rgb = img[..., :3].astype(float)
    lum = rgb @ np.array([0.3, 0.59, 0.11])
    # 잎 뭉치 결: 원래 그림의 밝기 순위(0~1)
    idx = np.flatnonzero(a)
    rank = np.zeros(h * w); rank[idx] = lum.ravel()[idx].argsort(kind="stable").argsort(kind="stable") / max(1, len(idx) - 1)
    rank = rank.reshape(h, w)
    # 둥근 지붕 높이 → 법선 → 햇빛
    d = ndimage.distance_transform_edt(np.pad(a, 1))[1:-1, 1:-1]
    R = max(3.0, 0.34 * min(h, w))
    hgt = ndimage.gaussian_filter(np.sqrt(1 - (1 - np.clip(d / R, 0, 1)) ** 2) * R, 0.8)
    gy, gx = np.gradient(hgt)
    n = np.dstack([-gx, -gy, np.full_like(gx, 0.9)]); n /= np.linalg.norm(n, axis=-1, keepdims=True)
    lam = n @ LIGHT
    lv = lam[a]; lam = (lam - lv.min()) / max(1e-6, lv.max() - lv.min())
    ys = np.arange(h)[:, None] / max(1, h - 1)
    v = np.clip((0.5 * lam + 0.34 * rank + 0.16 * (1 - ys) - 0.5) * 1.3 + 0.5, 0, 1)
    dith = BAYER[np.arange(h)[:, None] % 4, np.arange(w)[None, :] % 4] * 0.7
    edge = a & ~ndimage.binary_erosion(a)
    out = np.zeros((h, w, 4), np.uint8)
    sn = (rgb[..., 2] >= rgb[..., 0]) & (rgb[..., 2] >= rgb[..., 1] - 6) & (lum > 60) if snow else np.zeros_like(a)
    if snow and caps:
        up = np.zeros_like(a); up[1:] = a[:-1]
        lup = np.full_like(lum, 999.0); lup[1:] = lum[:-1]
        top = a & (~up | (lup < lum - 22))
        top2 = np.zeros_like(top); top2[1:] = top[:-1]
        sn |= (top & (lam > 0.3)) | (top2 & a & (lam > 0.55))
    for part, rp in ((a & ~sn, ramp), (a & sn, snow)):
        if rp is None or not part.any(): continue
        N = len(rp); pal = np.array(rp, np.uint8)
        k = np.clip(np.floor(v * (N - 0.01) + dith) + off, 0, N - 1).astype(int)
        k[edge & (lam < 0.45)] = 0                                   # 그늘 쪽 테두리 = 가장 짙은 단(외곽선)
        if rim: k[edge & (lam > 0.62)] = N - 1                         # 해 쪽 테두리 = 햇빛 테
        out[part, :3] = pal[k[part]]
    out[a, 3] = 255
    return out

def build_slots(style, seed):
    """주기 판(P×P 칸) 모서리마다 수관 자리 — 겹마다 서로 대각 1칸 넘게 떨어지게 뽑고,
    어느 겹 수관도 덮지 않는 칸이 남으면 아래 겹 수관을 하나 더 세운다(숲 속에 빈 네모가 생기지 않게).
    수관마다 수종·크기(fits)·위치(덩이 안 흔들림)·색 단·반전이 달라 같은 수관이 격자로 늘어서 보이지 않는다.
    바늘잎은 주기 판 위 둥근 무리(감싸 흐린 잡음의 위쪽 몫)에 모여 섞인 숲에 «전나무 무리» 가 생긴다."""
    st = STYLES[style]; P = st["period"]
    rng = np.random.default_rng(seed)
    species = []
    for sp in st["species"]:
        fits = sp.get("fits", st["fits"])
        species.append(dict(sp, fits=fits, imgs=[{f: sprite(k, keep, f) for f in fits} for k, keep in sp["kits"]]))
    zone = np.zeros((P, P), bool)
    if len(species) > 1 and st["conifer"] > 0:
        fld = ndimage.gaussian_filter(rng.random((P, P)), 1.0, mode="wrap")
        zone = fld >= np.quantile(fld, 1 - st["conifer"])
    nlay = len(st["density"])
    ug = [relight(sprite(k, 1.0, f), RAMP[r], 0, True) if r else sprite(k, 1.0, f) for k, f, r in st["undergrowth"] if k in KITS]
    slots = {}   # (덩이 왼쪽 위 칸 x, y) -> [slot, ...]
    def put(x, y, layer):
        conifer = len(species) > 1 and (rng.random() < (0.85 if zone[y, x] else 0.05))
        sp = species[1 if conifer else 0]; fits = sp["fits"]
        imgs = sp["imgs"][int(rng.integers(len(sp["imgs"])))]
        # 아래 겹은 큰 쪽으로 숲 속을 메우고, 위 겹은 모든 크기를 섞어 실루엣이 고르지 않게 한다
        img = imgs[fits[int(rng.integers(min(2, len(fits) - 1), len(fits)))] if layer == 0 else fits[int(rng.integers(len(fits)))]]
        if rng.integers(2): img = img[:, ::-1]
        ramp = RAMP[sp["ramps"][int(rng.integers(len(sp["ramps"])))]]
        lit = relight(img, ramp, st["layer_off"][layer], rim=layer >= nlay - 2, snow=RAMP["snow"] if style == "snow" else None, caps=sp.get("caps", False))
        h, wd = lit.shape[:2]
        slots.setdefault((x, y), []).append(dict(
            layer=layer, img=lit, tw=sp["tw"],
            dx=int(rng.integers(0, B - wd + 1)), dy=int(rng.integers(0, B - h + 1)),
            trunk=int(rng.integers(-2, 3)), root=int(rng.integers(0, 4)), flare=int(rng.integers(2)), knot=int(rng.integers(0, 5)),
            ug=int(rng.integers(len(ug))) if ug and rng.random() < 0.7 else -1, ugj=int(rng.integers(0, 16)), ugdy=int(rng.integers(0, 2))))
    for layer, dens in enumerate(st["density"]):
        chosen = []
        corners = [(x, y) for y in range(P) for x in range(P)]
        rng.shuffle(corners)
        for x, y in corners:
            if rng.random() > dens: continue
            if any(min(abs(x - a), P - abs(x - a)) ** 2 + min(abs(y - b), P - abs(y - b)) ** 2 < 2 for a, b in chosen): continue
            chosen.append((x, y)); put(x, y, layer)
    for cy in range(P):
        for cx in range(P):
            around = [((cx - i) % P, (cy - j) % P) for j in (0, 1) for i in (0, 1)]
            if not any(k in slots for k in around):
                put(*around[int(rng.integers(4))], 0)
    brush = [sprite(k, 1.0, f) for k, f in st["brush"] if k in KITS]
    # 주기 판(L×L px)에 감싸 이어지는 햇빛: 숲 바닥 햇빛 조각(fleck)과 왼쪽 위→오른쪽 아래로 비끼는 빛줄기(shaft) — 잡음으로 끊어 얼룩진 빛
    L = P * T
    r2 = np.random.default_rng(seed + 1)
    nz = ndimage.gaussian_filter(r2.random((L, L)), 1.6, mode="wrap")
    fleck = nz > np.quantile(nz, 0.9)
    Yl, Xl = np.mgrid[0:L, 0:L]
    u = (Xl - Yl) % L
    def band(c, wdt): return np.clip(1 - np.abs((u - c * L + L / 2) % L - L / 2) / wdt, 0, 1)
    dap = ndimage.gaussian_filter(r2.random((L, L)), 1.3, mode="wrap")
    shaft = np.clip(band(0.3, 7) + 0.6 * band(0.74, 4), 0, 1) * (dap > np.quantile(dap, 0.4))
    return dict(P=P, slots=slots, brush=brush, seed=seed, ug=ug, fleck=fleck, shaft=shaft)

N8 = [(-1, -1), (0, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (0, 1), (1, 1)]
def mask_cells(mask):
    """3×3 칸 창의 숲 여부(가운데 = 이 칸)."""
    g = np.zeros((3, 3), bool); g[1, 1] = True
    for b, (dx, dy) in enumerate(N8):
        if mask >> b & 1: g[dy + 1, dx + 1] = True
    return g

def canon(mask):
    """47 모양으로 줄인 이웃 비트 — 대각 이웃은 두 옆 이웃이 다 숲일 때만 그림에 영향을 준다."""
    n, w, e, s = mask & 2, mask & 8, mask & 16, mask & 64
    if not (n and w): mask &= ~1
    if not (n and e): mask &= ~4
    if not (s and w): mask &= ~32
    if not (s and e): mask &= ~128
    return mask

def put_px(out, y, x, rgb, a=255):
    if 0 <= y < B and 0 <= x < B and out[y, x, 3] <= a: out[y, x, :3] = rgb; out[y, x, 3] = a

def crown_block(st, s, front, data):
    """덩이 32×32 그림 하나(RGBA float) — front 면 아래 절반을 8px 로 누르고 그 밑에 하층 그늘·줄기·뿌리·이끼·하층 덤불."""
    blk = np.zeros((B, B, 4), float)
    img = s["img"].astype(float); h, w = img.shape[:2]
    y0 = min(s["dy"], B - h)
    m = img[..., 3] > 0
    blk[y0:y0 + h, s["dx"]:s["dx"] + w][m] = img[m]
    if not front: return blk
    top = blk[:T].copy()
    rows = np.round(np.linspace(T, B - 1, T // 2)).astype(int)
    low = blk[rows]
    out = np.zeros_like(blk)
    out[:T] = top; out[T:T + T // 2] = low
    # 눌린 수관 밑면: 해 반대쪽(아래)이라 맨 아래 2줄을 한 단·두 단 짙게(수관 밑 그늘 — 줄기가 그늘 속에서 나온다)
    crown = out[..., 3] > 0
    for k, mul in ((1, 0.62), (2, 0.8)):
        bottom = crown & np.vstack([~crown[k:], np.ones((k, B), bool)])
        bottom[:T] = False
        out[bottom, :3] *= mul
    # 하층 그늘: 눌린 수관 실루엣을 아래로 밀어 낸 떨어진 그림자(둥근 밑면을 따라 옅어진다 — 네모 띠가 아니다)
    for k in range(1, T // 2 + 1):
        sh = np.zeros_like(crown); sh[k:] = crown[:-k]
        sh = ndimage.binary_erosion(sh, iterations=1 + k // 3) if k > 2 else sh
        a = max(100, 215 * (1 - (k - 1) / (T // 2)) ** 1.2)   # 밑에서 숲 그림자(forestShade, 100 안팎에서 시작)와 이어진다
        sel = sh & (out[..., 3] < a) & ~crown
        out[sel, :3] = st["deep"]; out[sel, 3] = a
    # 줄기·뿌리: 수관 가운데 «바로 밑». 밑동 높이는 수관마다 0~3px 달라(한 줄로 늘어서지 않게), 나무껍질은 왼쪽(해 쪽) 밝고 오른쪽 짙게,
    # 수관 밑 2줄은 그늘로 눌러(수관이 덮은 줄기 머리 AO) 뿌리는 양쪽으로 퍼지고, 밑동 왼쪽에 이끼, 아래에 3줄 접지 그늘(AO).
    hi, mid, lo, dk = st["trunk"]
    tw = s["tw"]
    bark = {4: (hi, mid, lo, dk), 3: (hi, mid, dk), 2: (mid, dk)}[tw]
    cx = s["dx"] + w // 2 + s["trunk"]
    base = B - 3 - s["root"]
    xl = cx - tw // 2
    for dy, half, a in ((0, tw // 2 + 3, 120), (1, tw // 2 + 3, 180), (2, tw // 2 + 2, 110)):
        for x in range(cx - half, cx + half + 1):
            put_px(out, base + dy, x, st["deep"], a)
    ytop = T + T // 2 - 3
    for y in range(ytop, base + 1):
        for i in range(tw):
            x = xl + i
            if not 0 <= x < B: continue
            if y < T + T // 2 - 1 and out[y, x, 3] > 0 and out[y, x, :3].sum() > 0 and crown[y, x]: continue  # 수관이 덮은 줄기 머리
            c = np.array(bark[i], float)
            if y <= T + T // 2: c = c * 0.6                                # 수관 밑 그늘 속 줄기 머리
            elif y == base - 2 - s["knot"] and i == tw - 1: c = np.array(dk, float) * 0.8   # 옹이
            out[y, x, :3] = c; out[y, x, 3] = 255
    root = st["root"]
    put_px(out, base, xl - 1, root); put_px(out, base, xl + tw, root)
    if s["flare"]: put_px(out, base, xl - 2, root); put_px(out, base - 1, xl - 1, root)
    else: put_px(out, base, xl + tw + 1, root); put_px(out, base - 1, xl + tw, root)
    moss_hi, moss_lo = st["moss"]
    put_px(out, base, xl, moss_hi); put_px(out, base - 1, xl, moss_lo)
    put_px(out, base + 1, xl - 1, moss_lo, 255); put_px(out, base + 1, xl - 2, moss_hi, 255)
    # 하층: 줄기 옆 넓은 쪽에 덤불·고사리·이끼 바위·그루터기·쓰러진 통나무(줄기와 겹치지 않을 때만), 밑에 접지 그늘
    if s["ug"] >= 0 and data["ug"]:
        u = data["ug"][s["ug"]].astype(float); uh, uw = u.shape[:2]
        lroom, rroom = xl - 2, B - (xl + tw + 2)
        if rroom >= lroom and rroom >= uw: ux = xl + tw + 2 + s["ugj"] % (rroom - uw + 1)
        elif lroom >= uw: ux = xl - 2 - uw - s["ugj"] % (lroom - uw + 1)
        else: ux = None
        if ux is not None and 0 <= ux and ux + uw <= B:
            ub = min(B - 2, base + s["ugdy"]); uy = max(T, ub - uh + 1)
            for x in range(ux + 1, ux + uw - 1):
                put_px(out, ub + 1, x, st["deep"], 160)
            um = u[: ub - uy + 1, :, 3] > 0
            out[uy:ub + 1, ux:ux + uw][um] = u[: ub - uy + 1][um]
    return out

def canopy_tile(style, data, mask, phx, phy):
    st = STYLES[style]; P = data["P"]
    g = mask_cells(mask)
    S = 3 * T
    rgba = np.zeros((S, S, 4), float)
    # 1) 숲 속 그늘(수관 틈) — 숲 밖까지 거리 ~10→~13px 에서 차오른다(16 보다 짧아 이웃 칸과 판정이 같다). 가장자리 수관 사이 틈은 풀이 비쳐
    #    숲 테두리에 짙은 네모 판이 드러나지 않는다. 차오르는 문턱을 절대 좌표(주기 판) 물결로 흔들어 곧은 띠가 서지 않게 한다.
    #    깊은 숲 바닥에는 주기 판에 감싸 이어지는 햇빛 조각(fleck)이 수관 틈으로 비친다.
    fp = np.kron(g, np.ones((T, T), bool))
    d = ndimage.distance_transform_edt(np.pad(fp, 1, constant_values=True))[1:-1, 1:-1]
    Yp, Xp = np.mgrid[0:S, 0:S].astype(float)
    L = P * T; AX = Xp + (phx - 1) * T; AY = Yp + (phy - 1) * T
    IX = AX.astype(int) % L; IY = AY.astype(int) % L
    wob = 1.6 * np.sin(2 * math.pi * AY / L * 3 + 0.9) + 1.0 * np.sin(2 * math.pi * AX / L * 4 + 2.3) + 0.6 * np.sin(2 * math.pi * (AX + AY) / L * 7)
    frac = np.where(fp, np.clip((d - 9 - wob) / 3.5, 0, 1), 0)
    dith = BAYER[np.arange(S)[:, None] % 4, np.arange(S)[None, :] % 4] * 0.95
    rgba[..., :3] = st["under"]; rgba[..., 3] = np.where(frac > 0, 255, 0)
    fl = data["fleck"][IY, IX] & (data["shaft"][IY, IX] > 0.35) & (d > 12) & fp   # 햇빛 조각은 빛줄기가 닿는 바닥에만(흩뿌린 점 방지)
    rgba[fl, :3] = st["fleck"]
    # 2) 이 칸을 포함하는 덩이 넷(왼쪽 위 모서리 = 창 칸 (bx, by), bx·by ∈ {0, 1})
    draws = []
    any_valid = False
    for by in (0, 1):
        for bx in (0, 1):
            if not g[by:by + 2, bx:bx + 2].all(): continue
            key = ((phx + bx - 1) % P, (phy + by - 1) % P)
            # 덩이 아래 줄의 남쪽이 숲이 아니면 앞면 — 이 칸이 덩이 아래 줄일 때만(by == 0) 알 수 있고, 위 줄 칸 그림에는 상관없다
            front = by == 0 and not (g[2, bx] and g[2, bx + 1])
            for s in data["slots"].get(key, []):
                any_valid = True
                draws.append(((s["layer"], by * T + s["dy"], bx), bx, by, s, front))
    draws.sort(key=lambda t: t[0])
    covered = np.zeros((S, S), bool); painted = np.zeros((S, S), bool)
    for _, bx, by, s, front in draws:
        blk = crown_block(st, s, front, data)
        x0, y0 = bx * T, by * T
        m = blk[..., 3] > 0
        crown = np.zeros((S, S), bool); crown[y0:y0 + B, x0:x0 + B] = (blk[..., 3] > 0) & (blk[..., :3].sum(-1) > 0)
        if s["layer"] >= 1:
            # 위 겹 수관은 오른쪽 아래로 그림자를 드리우고(아래 수관·숲 바닥을 짙고 푸르게), 겹친 둘레 1px 에 접촉 그늘(AO)을 남긴다.
            # 덩이 밖으로는 그리지 않는다(이웃 칸과 판정이 같아야 이음매가 없다).
            inblk = np.zeros((S, S), bool); inblk[y0:y0 + B, x0:x0 + B] = True
            dy, dx = CAST
            cast = np.zeros((S, S), bool); cast[dy:, dx:] = crown[:-dy, :-dx]
            cast &= ~crown & inblk & (rgba[..., 3] > 0)
            rgba[cast, :3] *= SHADOW_MUL
            ring = ndimage.binary_dilation(crown, iterations=1) & ~crown & covered & inblk
            rgba[ring, :3] *= 0.75
        sub = rgba[y0:y0 + B, x0:x0 + B]
        sub[m] = blk[m]
        covered |= crown; painted[y0:y0 + B, x0:x0 + B] |= m
    # 빛줄기: 왼쪽 위에서 비끼는 띠가 수관 위를 얼룩지게 밝힌다(주기 판에 감싸 이어짐), 숲 바닥 햇빛 조각도 함께 밝아진다
    k = data["shaft"][IY, IX] * st["shaft_k"]
    lit = (covered | fl) & (k > 0)
    rgba[lit, :3] = rgba[lit, :3] * (1 - k[lit, None]) + np.array(st["shaft"], float) * k[lit, None]
    # 숲 속 그늘은 수관에 «둘러싸인» 틈에서 짙다. 숲 가장자리 띠(숲 밖까지 17px 안)에서 위 6px·왼쪽 8px·오른쪽 8px 안에 모두 수관이 있지 않은 틈은
    #    수관 밑면에 매달린 그늘만 남긴다: 바로 위 수관까지 거리가 숲 안쪽으로 갈수록 길게 허용되어(d=9 에서 1px → d=17 에서 15px),
    #    그늘 아래 끝이 수관 실루엣을 따라 들쭉날쭉하다(거리 문턱·점묘 띠는 숲 끝과 나란한 곧은 선이 된다 — 4·7회차 VQA).
    #    깊은 숲 속(17px 넘게)은 이웃 칸 수관을 모르므로 그대로 두어 칸 경계에 틈이 생기지 않는다.
    above = np.zeros((S, S), bool); left = np.zeros((S, S), bool); right = np.zeros((S, S), bool)
    for k in range(1, 7): above[k:] |= covered[:-k]
    for k in range(1, 9): left[:, k:] |= covered[:, :-k]; right[:, :-k] |= covered[:, k:]
    open_gap = ~(above & left & right) & (d < 17)
    up = np.full((S, S), 99.0)   # 바로 위 수관 화소까지 거리(px)
    for y in range(1, S): up[y] = np.where(covered[y - 1], 1, up[y - 1] + 1)
    ridge = 1.2 * wob + 1.8 * np.sin(2 * math.pi * AX / L * 9 + 0.4) * np.sin(2 * math.pi * AX / L * 4 + 1.9)   # 잔 물결: 3칸에 걸친 곧은 윗선 방지(9회차)
    hang = (up <= 1 + (d - 9 - 0.5 * wob) * 1.75) | (d >= 13.5 + ridge)   # 수관 사이 뒤 숲 그늘 윗선도 물결(곧은 칸 줄 금지)
    gap = ~painted
    rgba[gap, 3] = np.where(np.where(open_gap, hang & (frac > 0), frac > 0.5 + dith)[gap], 255, 0)
    rgba[gap & fl & (frac > 0.2), 3] = 255   # 숲 바닥 햇빛 조각은 점묘로 쪼개지 않고 덩이로 남긴다(체 무늬 점 방지)
    # 3) 수관이 하나도 서지 못한 칸(한 칸 폭 띠·뾰족한 끝): 셋 중 둘 꼴로 숲 가장자리 덤불·바위·그루터기(칸 안에만), 나머지는 풀
    h = (phx * 7 + phy * 13 + mask * 5 + data["seed"]) % (len(data["brush"]) * 3 // 2 + 1) if data["brush"] else len(data["brush"])
    if not any_valid and h < len(data["brush"]):
        b = data["brush"][h].astype(float); bh, bw = b.shape[:2]
        x0 = T + (T - bw) // 2; y0 = T + T - bh
        m = b[..., 3] > 0
        for x in range(x0 + 1, x0 + bw - 1):
            if rgba[2 * T - 1, x, 3] < 120: rgba[2 * T - 1, x, :3] = st["deep"]; rgba[2 * T - 1, x, 3] = 120
        rgba[y0:y0 + bh, x0:x0 + bw][m] = b[m]
    out = np.clip(rgba[T:2 * T, T:2 * T], 0, 255).astype(np.uint8)
    out[out[..., 3] == 0] = 0
    return out

def shade_tile(style, phx, nw, ne):
    """숲 남쪽 바로 아래 칸의 그늘 — 짙기·깊이가 x 에 따라 물결쳐(수관 그림자가 닿는 곳만 짙다) 칸 경계에 곧은 선이 서지 않는다.
    짙기는 세 단으로 끊고 단 경계는 4×4 바이어 점묘(화소 그림 결 — 매끈한 알파 흐림이 아니다). 북서/북동이 숲이 아니면 그 쪽 끝을 둥글게."""
    st = STYLES[style]; P = st["period"] * T
    Y, X = np.mgrid[0:T, 0:T].astype(float)
    AX = X + phx * T
    depth = 7.5 + 2.5 * np.sin(2 * math.pi * AX / P * 2 + 0.7) + 1.5 * np.sin(2 * math.pi * AX / P * 3 + 2.1)
    amp = 0.78 + 0.22 * np.sin(2 * math.pi * AX / P * 5 + 1.3) * np.sin(2 * math.pi * AX / P * 2 + 0.4)
    a = np.clip(1 - Y / depth, 0, 1) ** 1.2 * amp
    if not nw: a *= np.clip((X - Y * 0.6) / 6.0, 0, 1)
    if not ne: a *= np.clip(((T - 1 - X) - Y * 0.6) / 6.0, 0, 1)
    levels = np.array([0, 40, 72, 104])
    q = np.clip(np.floor(a * 3 + 0.5 + BAYER[Y.astype(int) % 4, X.astype(int) % 4] * 0.9), 0, 3).astype(int)
    out = np.zeros((T, T, 4), np.uint8); out[..., :3] = st["shade"]; out[..., 3] = levels[q]
    out[out[..., 3] == 0] = 0
    return out

def bake():
    """(tiles, canopy, shade, period) — 덧붙일 칸 그림(0부터)과 목록(-1 = 빈 칸)."""
    tiles, index = [], {}
    def add(px):
        if px[..., 3].max() == 0: return -1
        key = px.tobytes()
        if key not in index: index[key] = len(tiles); tiles.append(px)
        return index[key]
    canopy, shade, period = {}, {}, {}
    for si, style in enumerate(STYLES):
        data = build_slots(style, 23 + si * 7)
        P = data["P"]; period[style] = P
        memo = {}
        def tile_for(m, ph):
            key = (canon(m), ph)
            if key not in memo: memo[key] = add(canopy_tile(style, data, key[0], ph % P, ph // P))
            return memo[key]
        canopy[style] = [[tile_for(m, ph) for m in range(256)] for ph in range(P * P)]
        shade[style] = [add(shade_tile(style, phx, nw, ne)) for phx in range(P) for nw in (False, True) for ne in (False, True)]
    return tiles, canopy, shade, period

def main():
    cat = json.loads(CAT.read_text(encoding="utf-8"))
    base = cat.get("forestBase", cat["count"])
    old = Image.open(PNG).convert("RGBA")
    kept = np.array(old)[:(base // COLS) * T]
    tiles, canopy, shade, period = bake()
    rel = lambda n: -1 if n < 0 else base + n
    rows = math.ceil(len(tiles) / COLS)
    assert base // COLS + rows <= MAX_ROWS, f"chipset would be {(base // COLS + rows) * T}px tall (> 4096)"
    extra = np.zeros((rows * T, COLS * T, 4), np.uint8)
    for n, px in enumerate(tiles):
        extra[(n // COLS) * T:(n // COLS + 1) * T, (n % COLS) * T:(n % COLS + 1) * T] = px
    Image.fromarray(np.vstack([kept, extra]), "RGBA").save(PNG, optimize=True)
    cat["forestBase"] = base
    cat["forestPeriod"] = period
    cat["forestCanopy"] = {s: [[rel(n) for n in ph] for ph in v] for s, v in canopy.items()}
    cat["forestShade"] = {s: [rel(n) for n in v] for s, v in shade.items()}
    cat["count"] = base + rows * COLS
    CAT.write_text(json.dumps(cat, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"forest canopy {len(tiles)}칸 덧붙임: count {base} -> {cat['count']} ({(base // COLS + rows) * T}px)")

if __name__ == "__main__":
    main()
