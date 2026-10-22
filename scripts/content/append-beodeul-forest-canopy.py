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

  python3 scripts/content/append-beodeul-forest-canopy.py              (칸 번호 그대로 그림만 다시 굽기 — 이미 덧붙인 뒤의 기본)
  python3 scripts/content/append-beodeul-forest-canopy.py --renumber   (덧붙인 칸을 처음부터 다시 번호 매김 — 저장된 맵의 숲 칸 번호가 바뀐다)
"""
import hashlib, json, math
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

# 버들항 시트의 나무·덤불 칸은 restyle-beodeul-foliage.py 가 이 수관과 같은 해·색 단으로 다시 칠해 둔다(2026-10-18).
# 수관은 원래 그림의 잎 뭉치 결(밝기 순위)을 읽어야 하므로, 다시 칠하기 전 원본 칸을 덮어 써서 읽는다(두 번 칠해지지 않게).
# 원본은 시트 칸이 아직 «다시 칠한 그 화소»(json 의 out 지문)일 때만 쓴다 — 다른 굽기(bake_picks·build-beodeul-city)가 칸을 새로 그렸으면
# 그 새 그림이 원본이다(낡은 원본 띠로 새 그림을 되돌리지 않는다).
FOLIAGE_SRC = ROOT / "scripts/content/beodeul-foliage/source-tiles.png"
FOLIAGE_IDX = ROOT / "scripts/content/beodeul-foliage/source-tiles.json"

def tile_fingerprint(px):
    return hashlib.sha1(np.ascontiguousarray(px).tobytes()).hexdigest()[:16]

def foliage_originals(cur):
    """{칸 번호: 다시 칠하기 전 16×16 RGBA} — 원본 띠 그림(한 줄 16칸)·칸 번호·다시 칠한 지문 목록 중 cur 시트에 아직 다시 칠한 그림이 남은 칸만."""
    if not FOLIAGE_IDX.exists(): return {}
    idx = json.loads(FOLIAGE_IDX.read_text())
    strip = np.array(Image.open(FOLIAGE_SRC).convert("RGBA"))
    got = {}
    for i, (n, fp) in enumerate(zip(idx["tiles"], idx["out"])):
        if tile_fingerprint(cur[(n // 128) * T:(n // 128 + 1) * T, (n % 128) * T:(n % 128 + 1) * T]) != fp: continue
        got[n] = strip[(i // COLS) * T:(i // COLS + 1) * T, (i % COLS) * T:(i % COLS + 1) * T].copy()
    return got

FOLIAGE_ORIG = foliage_originals(sheet)
for _n, _px in FOLIAGE_ORIG.items():
    sheet[(_n // 128) * T:(_n // 128 + 1) * T, (_n % 128) * T:(_n % 128 + 1) * T] = _px

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

# 명암 단(어둠 → 빛). 활엽(참나무·느릅·라임), 바늘잎(소나무·삼나무 — 더 짙고 차갑다), 덤불, 설원 가문비·눈.
# 색의 정본은 scripts/content/beodeul-redraw/palette.json 의 leaf_ramps 하나다(손 도트 원본 그림·마을 낱 나무·숲 수관이 같은 단을 쓴다).
# 2026-10-22 활엽 세 단(oak·elm·lime)을 풀밭(칸 737, L*58)과 떨어지게 짙고 차갑게 다시 잡았다 — 옛 단은 4번째 단이 풀 색과 같았다.
RAMP = {k: [tuple(c) for c in v] for k, v in json.loads((ROOT / "scripts/content/beodeul-redraw/palette.json").read_text())["leaf_ramps"].items()}

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
        # 4판(「숲이 주변 바닥 타일들이랑 잘 어울리게」): 숲 테두리 틈의 이끼 치마(색·바깥→안쪽 세 단 알파), 낙엽·이끼 점, 숲 속 그늘 둘레 중간 톤
        "skirt": (36, 60, 30), "skirt_a": (0, 52, 92, 136),
        "litter": [(132, 100, 48), (156, 128, 60), (98, 74, 38), (120, 142, 58), (88, 112, 44)],
        "edge": (30, 52, 32),
        # 숲 앞(남쪽) 밑동 사이 하층: 덤불·고사리·이끼 바위·쓰러진 통나무(id, 맞출 px, 다시 칠할 색 단)
        "undergrowth": [("bd-mpart-bush-c", 13, "shrub"), ("bd-mpart-bush-e", 12, "shrub"), ("bd-tree-47e17a", 11, "shrub"),
                        ("bd-pick-deep-forest-path-fern-a", 12, "shrub"), ("bd-pick-deep-forest-path-fern-b", 12, "shrub"),
                        ("bd-pick-mountain-pass-boulder-m", 13, None), ("bd-pick-deep-forest-path-log-fallen", 18, None)],
        # (id, 맞출 px, 다시 칠할 색 단) — 고사리·들풀·덤불은 원본(source-tiles.png, 옛 쨍한 초록)에서 읽으므로 마을 낱 그림(restyle-beodeul-foliage.py 가
        # shrub 단으로 칠함)과 같게 shrub 단으로 다시 칠한다 — 그대로 두면 숲 끝에서 바닥·수관과 따로 놀았다(4판 VQA)
        "brush": [("bd-pick-deep-forest-path-fern-a", 16, "shrub"), ("bd-pick-deep-forest-path-fern-b", 16, "shrub"), ("bd-pick-deep-forest-path-fern-c", 16, "shrub"),
                  ("bd-pick-deep-forest-path-wild-a", 16, "shrub"), ("bd-pick-deep-forest-path-toadstools-a", 16, None), ("bd-pick-deep-forest-path-wild-b", 16, "shrub"),
                  ("bd-pick-mountain-pass-boulder-m", 14, None), ("bd-mpart-bush-c", 14, "shrub")],
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
        "skirt": (78, 92, 130), "skirt_a": (0, 36, 64, 96),
        "litter": [(112, 92, 72), (84, 70, 58), (150, 166, 196), (128, 108, 84)],
        "edge": (88, 104, 144),
        "undergrowth": [("bd-pick-snowfield-mound", 13, None), ("bd-pick-snowfield-rock", 12, None)],
        "brush": [("bd-pick-snowfield-mound", 16, None), ("bd-pick-snowfield-rock", 16, None)],
    },
}

def relight(img, ramp, off, rim, snow=None, caps=False, shape=None, clump=False):
    """수관 그림(RGBA) → 왼쪽 위 해로 다시 칠한 RGBA. off = 겹 깊이(아래 겹일수록 음수 → 짙은 단). rim = 왼쪽 위 테두리 1px 햇빛 테.
    snow 색 단이 오면 푸르스름·흰 화소(눈)는 그 단으로, 나머지(바늘잎)는 ramp 로 칠한다.
    caps 면 눈이 없는 바늘잎 그림에 가지 층 윗면(위 화소가 비었거나 훨씬 짙은 곳)·해 쪽 1~2px 에 눈을 얹는다.
    shape(bool, 없으면 불투명 부분) = 둥근 지붕·테두리를 잴 실루엣 — 낱 나무는 잎 사이로 비치는 가지까지 넣어 잎 덩이 속에 테두리가 생기지 않게 한다.
    clump 면 낱 나무용: 원래 잎 뭉치마다 그려 둔 밝은 윗면·짙은 밑면(밝기 순위)을 더 살리고 점묘를 반으로 줄인다(큰 수관이 한 덩이 둥근 지붕으로 뭉개지지 않게)."""
    a = img[..., 3] > 0
    sh = a if shape is None else shape
    h, w = a.shape
    rgb = img[..., :3].astype(float)
    lum = rgb @ np.array([0.3, 0.59, 0.11])
    # 잎 뭉치 결: 원래 그림의 밝기 순위(0~1)
    idx = np.flatnonzero(a)
    rank = np.zeros(h * w); rank[idx] = lum.ravel()[idx].argsort(kind="stable").argsort(kind="stable") / max(1, len(idx) - 1)
    rank = rank.reshape(h, w)
    # 둥근 지붕 높이 → 법선 → 햇빛
    d = ndimage.distance_transform_edt(np.pad(sh, 1))[1:-1, 1:-1]
    R = max(3.0, 0.34 * min(h, w))
    hgt = ndimage.gaussian_filter(np.sqrt(1 - (1 - np.clip(d / R, 0, 1)) ** 2) * R, 0.8)
    gy, gx = np.gradient(hgt)
    n = np.dstack([-gx, -gy, np.full_like(gx, 0.9)]); n /= np.linalg.norm(n, axis=-1, keepdims=True)
    lam = n @ LIGHT
    lv = lam[a]; lam = (lam - lv.min()) / max(1e-6, lv.max() - lv.min())
    ys = np.arange(h)[:, None] / max(1, h - 1)
    wl, wr, wy, dm = (0.36, 0.5, 0.14, 0.35) if clump else (0.5, 0.34, 0.16, 0.7)
    v = np.clip((wl * lam + wr * rank + wy * (1 - ys) - 0.5) * 1.3 + 0.5, 0, 1)
    dith = BAYER[np.arange(h)[:, None] % 4, np.arange(w)[None, :] % 4] * dm
    edge = a & ~ndimage.binary_erosion(sh)
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
    brush = [relight(sprite(k, 1.0, f), RAMP[r], 0, True) if r else sprite(k, 1.0, f) for k, f, r in st["brush"] if k in KITS]
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
    # 낙엽·이끼 점(주기 판에 감싸 이어짐): 흐린 잡음 위쪽 몫에 모인 무리 속에서만 드문드문 — 흩뿌린 고른 점(모래 무늬)이 되지 않게
    r3 = np.random.default_rng(seed + 2)
    clump = ndimage.gaussian_filter(r3.random((L, L)), 3.0, mode="wrap")
    pick = (clump > np.quantile(clump, 0.55)) & (r3.random((L, L)) < 0.07)
    litter = np.where(pick, r3.integers(0, len(st["litter"]), (L, L)), -1)
    return dict(P=P, slots=slots, brush=brush, seed=seed, ug=ug, fleck=fleck, shaft=shaft, litter=litter)

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
    # 4) 숲 테두리 치마(4판): 수관 사이로 풀이 그대로 비치던 틈(숲 밖까지 1~9px)에 바깥→안쪽 세 단 이끼 그늘(바이어 점묘)을 깔아
    #    밝은 풀밭과 짙은 숲 속 그늘이 곧장 맞닿지 않게 하고, 무리 진 낙엽·이끼 점을 흩는다(숲이 바닥 «위에 붙은» 판이 아니라 뿌리내린 결).
    #    숲 속 그늘 덩이의 둘레 1px 는 중간 톤으로 눌러 검은 구멍처럼 끊기지 않게 한다.
    #    해는 왼쪽 위 — 그늘·낙엽은 수관 «밑»(바로 위 수관까지 12px 안)에만 깐다. 숲 북쪽 끝 위 틈까지 깔면 나무 꼭대기 위에 점묘 띠가
    #    칸 경계에서 곧게 끊긴 네모 후광으로 떴다(설원 5판 VQA).
    open_ = gap & (rgba[..., 3] == 0) & fp & (up <= 12)
    q = np.clip(np.floor(np.clip((d - 0.5) / 9.0, 0, 1) * 3 + 0.3 + dith), 0, 3).astype(int)
    sa = np.array(st["skirt_a"])[q]
    sk = open_ & (sa > 0)
    rgba[sk, :3] = st["skirt"]; rgba[sk, 3] = sa[sk]
    li_idx = data["litter"][IY, IX]
    li = open_ & (li_idx >= 0) & (d > 1.5) & any_valid   # 수관 없는 칸(한 칸 폭 띠)까지 낙엽을 흩으면 위상마다 칸이 갈려 4096px 를 넘는다
    rgba[li, :3] = np.array(st["litter"], float)[li_idx[li]]; rgba[li, 3] = 255
    solid = gap & (rgba[..., 3] == 255) & ~li & ~fl
    soft = solid & ndimage.binary_dilation(gap & (rgba[..., 3] < 255) & fp, structure=ndimage.generate_binary_structure(2, 1))
    rgba[soft, :3] = st["edge"]
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
    # 4판: 숲 끝에서 굴러 나온 낙엽·이끼 점 — 그늘이 짙은 곳에만 드문드문(같은 phx 의 nw/ne 변형끼리 같은 자리)
    r = np.random.default_rng(1000 + phx).random((T, T)); pick = np.random.default_rng(2000 + phx).integers(0, len(st["litter"]), (T, T))
    li = (a > 0.3) & (r < 0.06)
    out[li, :3] = np.array(st["litter"], np.uint8)[pick[li]]; out[li, 3] = 255
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

def main_in_place(cat):
    """칸 번호 범위를 그대로 두고 그림만 다시 굽는다(2026-10-22 나무 다시 그리기). 저장된 맵이 가리키는 칸 번호가 덧붙인 범위를 벗어나지 않게,
    새로 구운 칸 그림마다 지금 목록에서 그 그림을 쓰는 (수종, 위상, 이웃 모양) 자리가 가장 많이 가리키던 옛 번호를 하나씩 짝지어(헝가리안) 그 번호에 쓰고,
    목록은 새 짝에 맞춰 다시 쓴다(새로 깔리는 숲은 정확). 옛 굽기에서 두 자리가 한 번호를 나눠 쓰던 곳은 저장된 맵에서 짝 그림이 보인다."""
    from scipy.optimize import linear_sum_assignment
    tiles, canopy, shade, period = bake()
    assert period == cat["forestPeriod"], "forestPeriod changed — rerun with --renumber"
    base = cat["forestBase"]
    sheet = np.array(Image.open(PNG).convert("RGBA"))
    pairs = []                                          # (옛 번호 - base, 새 칸)
    for s_, v in canopy.items():
        for ph, row in enumerate(v):
            pairs += [(cat["forestCanopy"][s_][ph][m] - base, n) for m, n in enumerate(row) if n >= 0 and cat["forestCanopy"][s_][ph][m] >= 0]
    for s_, v in shade.items():
        pairs += [(cat["forestShade"][s_][i] - base, n) for i, n in enumerate(v) if n >= 0 and cat["forestShade"][s_][i] >= 0]
    olds = sorted({o for o, _ in pairs}); oi = {o: i for i, o in enumerate(olds)}
    # 새 그림 종류가 옛 번호보다 많으면(옛 프로젝트의 칸 수는 늘릴 수 없다) 가장 닮은 두 그림을 하나로 합쳐 번호 수에 맞춘다.
    alias = list(range(len(tiles)))
    if len(tiles) > len(olds):
        F = np.array([t.astype(np.float32).ravel() for t in tiles]); sq = (F * F).sum(1)
        D = sq[:, None] + sq[None, :] - 2 * F @ F.T; np.fill_diagonal(D, np.inf)
        for _ in range(len(tiles) - len(olds)):
            i, j = np.unravel_index(np.argmin(D), D.shape)
            alias[j] = i; D[j, :] = np.inf; D[:, j] = np.inf
        def root(n):
            while alias[n] != n: n = alias[n]
            return n
        alias = [root(n) for n in range(len(tiles))]
        pairs = [(o, alias[n]) for o, n in pairs]
        print(f"forest canopy: {len(tiles) - len(olds)} near-identical tiles merged to fit {len(olds)} slots")
    roots = sorted(set(alias)); ri = {n: j for j, n in enumerate(roots)}
    w = np.zeros((len(olds), len(roots)))
    for o, n in pairs: w[oi[o], ri[n]] += 1
    r, c = linear_sum_assignment(-w)
    slot = {roots[j]: olds[i] for i, j in zip(r, c)}
    assert len(slot) == len(roots)
    kept = sum(w[i, j] for i, j in zip(r, c)); total = len(pairs)
    used = set(slot.values())
    for o in olds:                                      # 남는 옛 번호(새 그림이 더 적을 때)도 옛 그림을 남기지 않는다 — 가장 많이 가리키던 새 그림
        if o in used: continue
        k = base + o
        sheet[(k // COLS) * T:(k // COLS + 1) * T, (k % COLS) * T:(k % COLS + 1) * T] = tiles[roots[int(w[oi[o]].argmax())]]
    for n in range(len(tiles)):
        if alias[n] != n: slot[n] = slot[alias[n]]
    for n, o in slot.items():
        if alias[n] != n: continue
        k = base + o
        sheet[(k // COLS) * T:(k // COLS + 1) * T, (k % COLS) * T:(k % COLS + 1) * T] = tiles[n]
    rel = lambda n: -1 if n < 0 else base + slot[n]
    cat["forestCanopy"] = {s_: [[rel(n) for n in ph] for ph in v] for s_, v in canopy.items()}
    cat["forestShade"] = {s_: [rel(n) for n in v] for s_, v in shade.items()}
    Image.fromarray(sheet, "RGBA").save(PNG, optimize=True)
    import sys as _s, pathlib as _pl; _s.path.insert(0, str(_pl.Path(__file__).resolve().parents[2] / 'scripts/content/rtp-attribution')); from rtp_check import require_credit; require_credit(PNG)  # EasyRPG RTP CC BY credit check (public/assets/ATTRIBUTION.md)
    CAT.write_text(json.dumps(cat, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"forest canopy in place: 새 그림 {len(tiles)}종 → 옛 번호 {len(olds)}칸, 저장된 맵 자리 {int(kept)}/{total} 같은 그림 그대로")

def main():
    cat = json.loads(CAT.read_text(encoding="utf-8"))
    if "forestCanopy" in cat and "--renumber" not in __import__("sys").argv:
        return main_in_place(cat)
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
    import sys as _s, pathlib as _pl; _s.path.insert(0, str(_pl.Path(__file__).resolve().parents[2] / 'scripts/content/rtp-attribution')); from rtp_check import require_credit; require_credit(PNG)  # EasyRPG RTP CC BY credit check (public/assets/ATTRIBUTION.md)
    cat["forestBase"] = base
    cat["forestPeriod"] = period
    cat["forestCanopy"] = {s: [[rel(n) for n in ph] for ph in v] for s, v in canopy.items()}
    cat["forestShade"] = {s: [rel(n) for n in v] for s, v in shade.items()}
    cat["count"] = base + rows * COLS
    CAT.write_text(json.dumps(cat, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"forest canopy {len(tiles)}칸 덧붙임: count {base} -> {cat['count']} ({(base // COLS + rows) * T}px)")

if __name__ == "__main__":
    main()
