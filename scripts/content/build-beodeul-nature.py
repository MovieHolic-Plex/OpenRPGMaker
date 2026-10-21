"""버들항 자연 덧그림 팩(beodeul_nature) — 그림자·자연 물가·풀밭 가장자리를 코드 도트로 굽는다(2026-10-11).

왜: 마을 시공기(author_beodeul_town)의 나무·덤불·선인장·집에 그림자가 없어 공간감이 없었고(사용자 지적),
    물은 돌 둑 운하 오토타일 하나뿐이라 강·바다·못이 「성 안 공사한 물길」처럼 보였고, 오아시스 풀밭은 표본을 칸으로 잘라 네모났다.
무엇: 모두 2층(lowerOverlayTiles) 투명 덧그림이다. 1층 바닥(잔디·모래·물)은 그대로 두고 위에 얹는다.
  - 그림자: 키트마다 실제 그림의 알파로 모양을 잰다. 줄기가 좁은 것(나무·야자·선인장)은 밑동 타원(진한 속 + 옅은 바깥, 오른쪽 아래로),
    밑이 넓은 것(집·소품·바위)은 오른쪽·아래로 비낀 그림자. 색은 어두운 중성색 + 알파 두 단(warm-trees 그림자와 같은 51/126 결).
  - 자연 물가: 물 칸(1층 = 운하 물 몸통 23152 또는 오아시스 물)에 얹는다. 이웃 8칸 중 물 아닌 쪽으로 잔디·흙 둑이 4±1px 들어오고
    물가 1px 은 어둡게. 8이웃 256가지 → 같은 그림끼리 합친다. 굽이는 16px 주기라 이웃 칸끼리 이어진다.
  - 풀밭 가장자리: 모래 위 풀밭 칸에 얹는다(오아시스). 풀이 아닌 쪽으로 4±1.8px 물러나고 가장자리 1px 은 짙은 풀.
  - 설원 얼음 못(눈 둑)·늪 물(이끼 둑)·늪 이끼 칸(진흙 둑)도 같은 방식 — 늪·얼음 못이 칸 모양 네모로 보이던 것.
그림: 버들항 시트의 실제 잔디(737)·오아시스 풀밭 표본 칸의 화소를 그대로 무늬로 쓴다(이웃 바닥과 이음매가 없다).
출력: public/assets/beodeul-nature/chipset.png(16열), src/assets/beodeulNatureCatalog.json.
  python3 scripts/content/build-beodeul-nature.py
"""
import json, math, re
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
SHEET = ROOT / "public/assets/beodeul-city/beodeul-city-chipset.png"
TSJ = ROOT / "src/assets/beodeulCityTileset.json"
OUT_PNG = ROOT / "public/assets/beodeul-nature/chipset.png"
OUT_JSON = ROOT / "src/assets/beodeulNatureCatalog.json"
T, COLS = 16, 16
SHADOW_RGB = (26, 30, 40)          # 어두운 중성색 — 풀·모래·눈 어디서나 그 바닥의 어두운 결로 읽힌다
A_CORE, A_OUTER = 128, 66
SOIL_HI, SOIL_LO = (138, 112, 72), (116, 92, 58)   # 집 밑 밟힌 흙(버들항 흙길보다 조금 어둡게)

sheet = np.array(Image.open(SHEET).convert("RGBA"))
ts = json.loads(TSJ.read_text())
KITS = {k["id"]: k for k in ts["structureKits"]}

def tile_px(n):
    return sheet[(n // 128) * T:(n // 128 + 1) * T, (n % 128) * T:(n % 128 + 1) * T].copy()

def kit_image(k):
    im = np.zeros((k["height"] * T, k["width"] * T, 4), np.uint8)
    for j, r in enumerate(k["rows"]):
        for layer in (r.get("tiles") or [], r.get("upperTiles") or []):
            for i, n in enumerate(layer):
                if n is None or n < 0: continue
                src = tile_px(n); a = src[..., 3:4].astype(float) / 255
                dst = im[j * T:(j + 1) * T, i * T:(i + 1) * T].astype(float)
                dst[..., :3] = src[..., :3] * a + dst[..., :3] * (1 - a); dst[..., 3:4] = np.maximum(dst[..., 3:4], src[..., 3:4])
                im[j * T:(j + 1) * T, i * T:(i + 1) * T] = dst.astype(np.uint8)
    return im

def hsh(x, y, s):
    v = (np.asarray(x).astype(np.int64) * 374761393 + np.asarray(y).astype(np.int64) * 668265263 + s * 2147483647) & 0xFFFFFFFF
    v = ((v ^ (v >> 13)) * 1274126177) & 0xFFFFFFFF
    return (v & 0xFFFF) / 65535.0

# ------------------------------------------------------------------ 타일 저장(같은 그림은 하나로)
tiles: list[np.ndarray] = []
index: dict[bytes, int] = {}
def add_tile(px: np.ndarray) -> int:
    if px[..., 3].max() == 0: return -1
    key = px.tobytes()
    if key not in index: index[key] = len(tiles); tiles.append(px)
    return index[key]

# ------------------------------------------------------------------ 1. 그림자
SKIP = re.compile(r"ground|field|wheat|wild-|heath|fern|flower|decal|boat|lily|duck|ice-|jetty|bridge|waterwheel|reed|vine-field|bed-|rug|datemat|bones|fence|lantern-str|mpart-flower|sand-patch|crab-trap|laundry|garden-|path|stones-|-mat|shadow|road|plaza|deck|water|bog|mud|snow$|pilings|mound")
PLACES = "riverside-mill|fishing-port|desert-oasis|snowfield|swamp-stilt|walled-market|wheat-roman-road|deep-forest-path|coast-cliff-road|vineyard|wizard-tower"
INCLUDE = re.compile(r"^bd-(tree|mpart-bush|house|prop|out)-|^bd-pick-(" + PLACES + ")-")
PLACE = re.compile(r"^bd-pick-(" + PLACES + ")-")

def shadow_for(k):
    im = kit_image(k); M = im[..., 3] > 40
    if not M.any(): return None
    ys, xs = np.nonzero(M)
    top, yb = ys.min(), ys.max()
    if yb - top < 6: return None
    H0, W0 = M.shape
    maxw = xs.max() - xs.min() + 1
    base = np.nonzero(M[max(top, yb - 3):yb + 1].any(0))[0]
    bw = base.max() - base.min() + 1; bc = (base.max() + base.min()) / 2
    pad = T  # 왼쪽 한 칸, 오른쪽 두 칸, 아래 한 칸 여유
    Hc, Wc = H0 + T, W0 + 3 * T
    Y, X = np.mgrid[0:Hc, 0:Wc].astype(float)
    sh = np.zeros((Hc, Wc), np.uint8)
    tall = bw <= 0.5 * maxw and maxw >= 10
    is_building = any(p.get("kind") == "entrance" for p in (k.get("parts") or [])) or k["id"].startswith("bd-house-")
    dirt = np.zeros((Hc, Wc), bool)
    if tall:
        cx, cy = pad + bc + 0.24 * maxw, yb + 1.0
        rx, ry = max(6.0, 0.56 * maxw), max(3.5, min(7.5, 0.16 * maxw + 2.6))
        jit = (hsh(X // 2, Y // 2, 11) - 0.5) * 0.18
        outer = ((X - cx) / rx) ** 2 + ((Y - cy) / ry) ** 2 <= 1 + jit
        ccx, ccy = pad + bc + 1.0, yb + 0.5
        crx, cry = max(3.0, bw * 0.75 + 2), 2.4
        core = ((X - ccx) / crx) ** 2 + ((Y - ccy) / cry) ** 2 <= 1 + jit * 0.5
        sh[outer] = A_OUTER; sh[core] = A_CORE
    else:
        Mc = np.zeros((Hc, Wc), bool); Mc[0:H0, pad:pad + W0] = M
        # 아래쪽 65% 만 그림자를 드리운다(지붕 꼭대기 그림자가 옆 땅에 뜨지 않게). 빛은 왼쪽 위 → 그림자는 오른쪽·아래.
        # 2px 비낌은 16px 칸에서 물체 테두리에 묻혀 보이지 않았다(2026-10-11 첫 판) — 속 4px·바깥 7px 로 땅에 확실히 떨어진다.
        cut = top + int((yb - top) * 0.35); Mc[:cut] = False
        def sh_(m, dy, dx):
            o = np.zeros_like(m); o[dy:, dx:] = m[:m.shape[0] - dy, :m.shape[1] - dx]; return o
        near = sh_(Mc, 3, 4) | sh_(Mc, 2, 3)
        far = sh_(Mc, 5, 7) | sh_(Mc, 6, 6) | sh_(Mc, 4, 7)
        # 접지: 밑변 바로 아래 2px 는 진하게(집·바위가 땅에 박혀 보이게)
        bottom = Mc & ~np.vstack([Mc[1:], np.zeros((1, Wc), bool)])
        contact = sh_(bottom, 1, 0) | sh_(bottom, 2, 0) | sh_(bottom, 2, 1)
        sh[far] = A_OUTER; sh[near | contact] = A_CORE
        if is_building:
            # 집 밑동: 벽이 풀에 칼같이 꽂히면 떠 보인다 — 밟혀 드러난 흙 띠 2~3px(가장자리 들쭉날쭉) + 그 위 접지 그림자
            d1 = sh_(bottom, 1, 0); d2 = sh_(bottom, 2, 0); d3 = sh_(bottom, 3, 0) & (hsh(X, Y, 23) > 0.55)
            dirt = (d1 | d2 | d3) & ~Mc
            # 양옆으로 1px 번지게(모서리가 둥글게 닳아 보이게)
            dirt |= (sh_(d1, 0, 1) | np.roll(d1, -1, axis=1)) & (hsh(X, Y, 29) > 0.4) & ~Mc
    # 물체 자신의 칸 위는 물체가 덮는다 — 그래도 투명 틈으로 보이는 그림자가 진해지지 않게 물체 화소 밑은 지운다
    full = np.zeros((Hc, Wc), bool); full[0:H0, pad:pad + W0] = M
    sh[full] = 0
    if not sh.any(): return None
    rgba = np.zeros((Hc, Wc, 4), np.uint8); rgba[..., 0], rgba[..., 1], rgba[..., 2] = SHADOW_RGB; rgba[..., 3] = sh
    if not tall and is_building:
        dirt &= ~full
        hi = hsh(X, Y, 31) > 0.5
        soil = np.where(hi[..., None], np.array(SOIL_HI), np.array(SOIL_LO)).astype(np.uint8)
        # 흙 위에 그림자를 미리 섞어 둔다(한 칸에 2층 덧그림 하나뿐이라)
        a = sh.astype(float)[..., None] / 255
        mixed = (soil[..., :3] * (1 - a) + np.array(SHADOW_RGB) * a).astype(np.uint8)
        rgba[dirt, :3] = mixed[dirt]; rgba[dirt, 3] = 255
    rows = []
    for j in range(Hc // T):
        rows.append([add_tile(rgba[j * T:(j + 1) * T, i * T:(i + 1) * T]) for i in range(Wc // T)])
    # 빈 가장자리 열·줄을 잘라 낸다
    dx = -1
    while rows and all(r[0] < 0 for r in rows): rows = [r[1:] for r in rows]; dx += 1
    while rows and all(r[-1] < 0 for r in rows): rows = [r[:-1] for r in rows]
    dy = 0
    while rows and all(n < 0 for n in rows[0]): rows = rows[1:]; dy += 1
    while rows and all(n < 0 for n in rows[-1]): rows = rows[:-1]
    if not rows: return None
    return {"dx": dx, "dy": dy, "rows": rows, "kind": "tall" if tall else "block"}

shadows = {}
for kid, k in KITS.items():
    # SKIP 은 장소 이름을 뗀 나머지에만 — 「snowfield」의 field, 「deep-forest-path」의 path, 「wheat-roman-road」의 road 가 키트 전체를 빼던 것
    if not INCLUDE.search(kid) or SKIP.search(PLACE.sub("", kid)): continue
    if k["width"] > 12 or k["height"] > 12: continue
    if (k.get("ai") or {}).get("role") in ("terrain", "water", "wall"): continue
    s = shadow_for(k)
    if s: shadows[kid] = s
print("shadows", len(shadows), "tiles so far", len(tiles))
shadow_tiles = {n for sd in shadows.values() for r in sd["rows"] for n in r if n >= 0}

# ------------------------------------------------------------------ 2·3. 8이웃 가장자리(물가·풀밭)
N8 = [(-1, -1), (0, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (0, 1), (1, 1)]   # 비트 0..7 (북서·북·북동·서·동·남서·남·남동)
def mask_field(mask: int) -> np.ndarray:
    """3×3 칸(가운데 = 그 칸, 가운데는 늘 「같은 것」) → 48×48 불리언 장."""
    f = np.zeros((3 * T, 3 * T), bool); f[T:2 * T, T:2 * T] = True
    for b, (dx, dy) in enumerate(N8):
        if mask >> b & 1: f[(dy + 1) * T:(dy + 2) * T, (dx + 1) * T:(dx + 2) * T] = True
    return f
YY, XX = np.mgrid[0:T, 0:T].astype(float)
def wobble(amp, s):
    # 16px 주기 — 같은 방향 가장자리끼리 이웃 칸과 이어진다
    return amp * (0.55 * np.sin(2 * math.pi * (XX + YY * 0.37) / T + s) + 0.45 * np.sin(2 * math.pi * (YY - XX * 0.29) / T * 2 + s * 1.7))

def rounded_depth(f: np.ndarray, R: float) -> np.ndarray:
    """칸 경계의 계단을 둥글게 편 「뭍에서 떨어진 거리」. 속(뭍에서 R 이상)을 구한 뒤 속에서 거리를 재 R 에서 뺀다 —
    곧은 가장자리는 그대로, 볼록 모서리는 반지름 R−r, 오목 모서리는 반지름 r 로 둥글어진다(r = 쓰는 쪽 둑 폭)."""
    core = ndimage.distance_transform_edt(f) >= R
    if not core.any(): return np.zeros((T, T))
    dc = ndimage.distance_transform_edt(~core)
    return np.maximum(0.0, R - dc)[T:2 * T, T:2 * T]

def tex_tile(n):
    return tile_px(n)
GRASS = tex_tile(737)
def kit_tex(kid):
    return tex_tile(KITS[kid]["rows"][1]["tiles"][1])
LAWN = kit_tex("bd-pick-desert-oasis-ground-lawn")
SNOW = kit_tex("bd-pick-snowfield-ground-snow")
BOG = kit_tex("bd-pick-swamp-stilt-ground-bog")
MUD = kit_tex("bd-pick-swamp-stilt-ground-mud")
def shade(px, f):
    out = px.astype(float); out[..., :3] *= f; return np.clip(out, 0, 255).astype(np.uint8)
DIRT_HI = np.array([156, 118, 76, 255], np.uint8); DIRT_LO = np.array([122, 88, 56, 255], np.uint8); DIRT_WET = np.array([84, 60, 42, 255], np.uint8)

BANK_STYLES = {
    # 잔디·풀밭 둑: 잔디 → 짙은 풀 1px → 흙 3px → 젖은 흙 1px → 어두운 물가 → 얕은 물빛
    "earth": {"dirt": (DIRT_HI, DIRT_LO), "wet": DIRT_WET, "lip": 0.8, "rim": (12, 26, 30, 150), "shallow": (120, 190, 180, 46)},
    # 눈 둑(얼음 못): 흙 없이 눈 → 푸른 그늘 2px → 얼음 가장자리 어두운 선
    "snow": {"dirt": ((176, 196, 222, 255), (160, 182, 212, 255)), "wet": (122, 146, 182, 255), "lip": 0.9, "rim": (40, 70, 110, 120), "shallow": (230, 244, 255, 60)},
    # 이끼 늪 둑(늪 물): 이끼 → 짙은 진흙 2px → 물가 검은 선
    # 늪 진흙 → 이끼 늪(막힘) 가장자리: 진흙 무늬가 이끼 칸으로 둥글게 들어온다. 얕은 물빛 없이 짙은 선만
    "mud": {"dirt": ((96, 84, 52, 255), (86, 74, 46, 255)), "wet": (56, 50, 30, 255), "lip": 0.9, "rim": (20, 26, 14, 110), "shallow": (0, 0, 0, 0)},
    "bog": {"dirt": ((74, 70, 40, 255), (62, 58, 34, 255)), "wet": (40, 38, 24, 255), "lip": 0.82, "rim": (8, 14, 10, 150), "shallow": (90, 120, 80, 40)},
}

def bank_tile(mask: int, land: np.ndarray, style: str = "earth") -> np.ndarray:
    """물 칸 덧그림: 물이 아닌 쪽에서 둑(바닥 무늬 + 둑 띠 3px)이 5.5±0.8px 들어온다. 모서리는 거리 장이라 둥글다.
    물 부분은 투명(1층 물·얼음이 보인다), 물가 1px 은 그늘, 그 안 2px 은 얕은 물빛."""
    st = BANK_STYLES[style]
    d = rounded_depth(mask_field(mask), 12.0)
    r = 5.5 + wobble(0.8, 0.7)
    out = np.zeros((T, T, 4), np.uint8)
    is_land = d < r
    out[is_land] = land[is_land]
    dirt = is_land & (d >= r - 3.0)
    hi = (hsh(XX, YY, 5) > 0.55)
    out[dirt & hi] = st["dirt"][0]; out[dirt & ~hi] = st["dirt"][1]
    wet = is_land & (d >= r - 1.0)
    out[wet] = st["wet"]
    grass_lip = is_land & (d >= r - 4.0) & (d < r - 3.0)
    out[grass_lip] = shade(land, st["lip"])[grass_lip]
    rim = (~is_land) & (d < r + 1.0)
    out[rim] = st["rim"]
    shallow = (~is_land) & (d >= r + 1.0) & (d < r + 3.0)
    out[shallow] = st["shallow"]
    return out

def edge_tile(mask: int, tex: np.ndarray) -> np.ndarray:
    """풀밭 칸 덧그림: 풀이 아닌 쪽으로 3±1px 물러난다. 가장자리 1px 은 짙은 풀."""
    d = rounded_depth(mask_field(mask), 11.0)
    r = 4.0 + wobble(1.8, 2.1)
    out = np.zeros((T, T, 4), np.uint8)
    keep = d >= r
    out[keep] = tex[keep]
    edge = keep & (d < r + 1.0)
    out[edge] = shade(tex, 0.78)[edge]
    tuft = (~keep) & (d >= r - 1.0) & (hsh(XX, YY, 9) > 0.72)       # 가장자리 밖으로 삐죽 나온 풀 한 점
    out[tuft] = shade(tex, 0.86)[tuft]
    return out

def table(fn, *a):
    return [add_tile(fn(m, *a)) for m in range(256)]
bank_grass = table(bank_tile, GRASS)
bank_lawn = table(bank_tile, LAWN)
edge_lawn = table(edge_tile, LAWN)
bank_snow = table(bank_tile, SNOW, "snow")
bank_bog = table(bank_tile, BOG, "bog")
bank_mud = table(bank_tile, MUD, "mud")
# ------------------------------------------------------------------ 울타리 마감(2026-10-11 사용자 「울타리 외곽 마감이 별로, 이어져 있다는 느낌이 안 든다」)
# 공용 기초 칩셋(beodeul_ground)의 숲 울타리는 가로(643)·세로(644)·T(645) 셋뿐이라 위 모서리는 가로 조각(난간이 반 칸 삐져나가고 세로와 5px 끊김),
# 아래 모서리는 T(바깥으로 난간이 삐져나감), 문 옆은 난간이 허공에서 끝났다. 원본 화소로 모서리·끝 조각을 만든다:
# 모서리 기둥 = 가로 조각의 기둥(3×11)을 가운데 열(6~8, 세로 난간 줄)에 세우고, 난간은 기둥 안쪽으로만, 세로 난간을 위/아래로 잇는다.
GROUND = np.array(Image.open(ROOT / "public/assets/beodeul-ground/chipset.png").convert("RGBA"))
def gtile(n): return GROUND[(n // 8) * T:(n // 8 + 1) * T, (n % 8) * T:(n % 8 + 1) * T].copy()
FH, FV = gtile(643), gtile(644)
def fence_piece(east: bool, west: bool, up: bool, down: bool) -> np.ndarray:
    px = np.zeros((T, T, 4), np.uint8)
    if east: px[:, 6:16] = FH[:, 6:16]           # 가운데 → 동쪽 난간(+ 동쪽 기둥)
    if west: px[:, 0:10] = np.where(px[:, 0:10, 3:4] > 0, px[:, 0:10], FH[:, 0:10])
    post = FH[3:14, 12:15] if west and not east else FH[3:14, 1:4]   # 서쪽으로 뻗으면 오른쪽 기둥(그늘 면)을
    px[3:14, 6:9] = post
    if up: px[0:3, 6:9] = FV[5:8, 6:9]
    if down: px[14:16, 6:9] = FV[5:7, 6:9]
    return px
# 둥근 모서리(2026-10-11 사용자 「울타리는 네모보다 모서리가 둥근 사각형 느낌으로」): 옛 모서리 기둥(직각) 대신 두 난간이 사분원으로 휘어
# 세로 난간 줄(6~8열)로 이어지는 조각. 글자는 643·644 의 실제 화소 색(A 기둥 윗면 · B 기둥 · C 기둥 그늘 · D 가로 난간 빛 · E 가로 난간 ·
# F 세로 난간 빛 · G 세로 난간 · H 판 빛 · I 판). 가로 조각과 만나는 쪽은 난간 두 줄(위 5~7줄, 아래 10~12줄), 세로 조각과 만나는 쪽은 6~8열.
# 3/4 시점: 땅 위 반지름 7칸 남짓의 사분원을 난간 높이(위 난간 = 땅 −7, 아래 난간 = 땅 −2)만큼 올려 그린 모양 — 위 모서리는 곡선이 칸 아래쪽,
# 아래 모서리는 칸 위쪽으로 휜다. 빛은 가로로 누운 곳은 윗줄, 세로로 선 곳은 왼쪽 열. 손으로 고른 행 문자열이다(수식으로 만들지 않았다).
FENCE_PAL = {"A": FH[3, 1], "B": FH[4, 1], "C": FH[4, 3], "D": FH[5, 0], "E": FH[6, 0], "F": FV[0, 6], "G": FV[0, 7], "H": FV[1, 4], "I": FV[2, 4]}
def fence_grid(rows: list[str]) -> np.ndarray:
    px = np.zeros((T, T, 4), np.uint8)
    for y, r in enumerate(rows):
        assert len(r) == T
        for x, ch in enumerate(r):
            if ch != ".": px[y, x] = FENCE_PAL[ch]
    return px
ROUND_CORNER = {
    "tl": [
        "................",
        "................",
        "................",
        "................",
        "................",
        "...........DDDDD",
        "..........DEEEEE",
        ".........DEEEEEE",
        "........FEE.....",
        ".......FGE......",
        ".......FG..DDDDD",
        ".......FG.DEEEEE",
        "......FGGDEEEEEE",
        "......FGGEE.....",
        "......FGGE......",
        "......FGG.......",
    ],
    "tr": [
        "................",
        "................",
        "................",
        "................",
        "................",
        "DDD.............",
        "EEED............",
        "EEEED...........",
        "...EED..........",
        "....EEF.........",
        "DDD..EF.........",
        "EEED..FG........",
        "EEEED.FGG.......",
        "...EEDFGG.......",
        "....EEFGG.......",
        ".....EFGG.......",
    ],
    "bl": [
        "......FGG.......",
        "......FGG.......",
        "......FGG.......",
        "......FGGD......",
        "......FGGED.....",
        "......FGGEEDDDDD",
        ".......FG.EEEEEE",
        ".......FG..EEEEE",
        ".......FGD......",
        "........FED.....",
        ".........EEDDDDD",
        "..........EEEEEE",
        "...........EEEEE",
        "................",
        "................",
        "................",
    ],
    "br": [
        "......FGG.......",
        "......FGG.......",
        "......FGG.......",
        ".....DFGG.......",
        "....DEFGG.......",
        "DDDDEEFGG.......",
        "EEEEE.FG........",
        "EEEE..FG........",
        ".....DFG........",
        "....DEG.........",
        "DDDDEE..........",
        "EEEEE...........",
        "EEEE............",
        "................",
        "................",
        "................",
    ],
}
fence = {
    "h": add_tile(FH.copy()), "v": add_tile(FV.copy()),
    "tl": add_tile(fence_grid(ROUND_CORNER["tl"])), "tr": add_tile(fence_grid(ROUND_CORNER["tr"])),
    "bl": add_tile(fence_grid(ROUND_CORNER["bl"])), "br": add_tile(fence_grid(ROUND_CORNER["br"])),
    "endW": add_tile(fence_piece(True, False, False, False)), "endE": add_tile(fence_piece(False, True, False, False)),
}
vn = FV.copy(); vn[0:1] = 0; fence["endN"] = add_tile(vn)   # 위가 문: 세로 난간 맨 윗줄을 걷어 기둥(판)에서 끝
vs = FV.copy(); vs[15:16] = 0; fence["endS"] = add_tile(vs)
print("tiles", len(tiles))

# ------------------------------------------------------------------ 시트·목록
rows_n = math.ceil(len(tiles) / COLS)
img = np.zeros((rows_n * T, COLS * T, 4), np.uint8)
for n, px in enumerate(tiles):
    img[(n // COLS) * T:(n // COLS + 1) * T, (n % COLS) * T:(n % COLS + 1) * T] = px
OUT_PNG.parent.mkdir(parents=True, exist_ok=True)
Image.fromarray(img, "RGBA").save(OUT_PNG, optimize=True)
import sys as _s, pathlib as _pl; _s.path.insert(0, str(_pl.Path(__file__).resolve().parents[2] / 'scripts/content/rtp-attribution')); from rtp_check import require_credit; require_credit(OUT_PNG)  # EasyRPG RTP CC BY credit check (public/assets/ATTRIBUTION.md)
cat = {
    "id": "beodeul_nature", "texture": "tex_beodeul_nature", "tileSize": T, "tilesPerRow": COLS, "count": rows_n * COLS,
    "note": "2층 투명 덧그림. 생성 scripts/content/build-beodeul-nature.py. 이웃 비트 = 북서1 북2 북동4 서8 동16 남서32 남64 남동128(같은 것이면 1).",
    "shadows": shadows,
    # 불투명 흙 화소(집 밑동)가 든 그림자 칸
    "soilTiles": sorted({n for n, px in enumerate(tiles) if (px[..., 3] == 255).any() and n in shadow_tiles}),
    "bankGrass": bank_grass, "bankLawn": bank_lawn, "edgeLawn": edge_lawn,
    "bankSnow": bank_snow, "bankBog": bank_bog, "bankMud": bank_mud,
    # 울타리 조각: h 가로 · v 세로 · tl/tr/bl/br 모서리 · endW/endE 가로 끝(그 쪽으로 뻗고 반대쪽이 문) · endN/endS 세로 끝(문이 위/아래)
    "fence": fence,
}
OUT_JSON.write_text(json.dumps(cat, ensure_ascii=False, separators=(",", ":")) + "\n")
print("wrote", OUT_PNG, img.shape, OUT_JSON, OUT_JSON.stat().st_size)
