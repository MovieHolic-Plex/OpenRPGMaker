#!/usr/bin/env python3
"""버들항 자연 덧그림(beodeul_nature)에 «이어진 숲 수관(forestCanopy)» 오토타일을 덧붙인다.

배경(2026-10-18 사용자 반려 「버들 마을은 풀이 뭉쳐진 .. 그러니까 '숲' 을 구현하질 못함. 차라리 '숲' 용 타일들을 아예 새로 만드는 게 나을 수준」):
마을 바깥 숲은 나무 키트 3~7그루를 잔디 위에 흩어 찍은 것이라 수관 사이로 잔디가 보이고, 위에서 보면 덤불 뭉치였다.
이 스크립트는 숲 덩이 전체를 한 장으로 덮는 수관 오토타일을 굽는다.

무엇(모두 16px 칸, 이웃 비트 = 북서1 북2 북동4 서8 동16 남서32 남64 남동128, 맵 밖은 «숲»):
  - 수관 무늬: 버들항 시트의 실제 활엽수 수관(bd-tree-03a8f7·3e8732·1a786c·a80c85·7ecdb8) / 설원 소나무(bd-pick-snowfield-pine) 화소를
    32px 주기 판에 겹겹이 찍는다(북쪽 수관이 먼저, 남쪽 수관이 위 — 3/4 시점). 판 바탕은 수관 사이 그늘색이라 잔디가 비치지 않는다.
    주기 32px = 칸 2×2 → 칸마다 위상(x&1, y&1) 4가지라 같은 무늬가 16px 마다 되풀이되지 않는다.
  - 가장자리: 숲 아닌 쪽으로 수관 혹(2.5±1.2px 굽이)을 남기고 1px 짙은 윤곽. 오목·볼록 모서리는 거리 장이라 둥글다.
  - 남쪽 숲 끝(남쪽이 숲 아님): 수관이 칸 아래에서 6±1.5px 위에서 끝나고, 그 밑으로 줄기·뿌리와 짙은 하층 그늘 — 숲 앞면.
  - 숲 그림자(forestShade): 숲 남쪽 바로 아래 칸에 얹는 2층 그늘(위에서 아래로 옅어짐). 북서·북동 이웃이 숲이 아니면 그 쪽 끝을 둥글게 줄인다.
출력: public/assets/beodeul-nature/chipset.png 뒤에 덧붙이고 src/assets/beodeulNatureCatalog.json 에
  forestCanopy: { leaf: [위상 4][256], snow: [위상 4][256] }, forestShade: [4] (NW 없음·NE 없음 비트 조합) 을 쓴다.
멱등: 처음 돌 때의 count 를 forestBase 로 적어 두고 다음부터는 그 뒤만 다시 쓴다.

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
T, COLS, P = 16, 16, 32

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

def crown(kid, keep):
    """나무 그림에서 수관만 — 불투명 경계 상자 위쪽 keep 비율(줄기·뿌리·그림자 줄을 뺀다)."""
    im = kit_image(kid)
    ys, xs = np.nonzero(im[..., 3] > 200)
    top, bot = ys.min(), ys.max()
    cut = top + int((bot - top + 1) * keep)
    c = im[top:cut, xs.min():xs.max() + 1].copy()
    c[c[..., 3] < 200] = 0
    return c

def hsh(x, y, s):
    v = (np.asarray(x).astype(np.int64) * 374761393 + np.asarray(y).astype(np.int64) * 668265263 + s * 2147483647) & 0xFFFFFFFF
    v = ((v ^ (v >> 13)) * 1274126177) & 0xFFFFFFFF
    return (v & 0xFFFF) / 65535.0

STYLES = {
    "leaf": {
        "crowns": [("bd-tree-03a8f7", 0.72), ("bd-tree-3e8732", 0.72), ("bd-tree-1a786c", 0.7), ("bd-tree-a80c85", 0.72), ("bd-tree-7ecdb8", 0.72)],
        "under": (20, 66, 36), "outline": (14, 46, 28), "spacing": (13, 9),
        "understory": (16, 40, 26), "trunk": ((133, 98, 52), (78, 61, 34), (52, 40, 24)),
    },
    "snow": {
        "crowns": [("bd-pick-snowfield-pine", 0.82)],
        "under": (40, 66, 70), "outline": (26, 44, 54), "spacing": (9, 8),
        "understory": (54, 70, 88), "trunk": ((120, 92, 64), (82, 62, 44), (54, 42, 32)),
    },
}

def canopy_texture(style, seed):
    """32px 주기 수관 판 + 화소마다 그 화소를 덮은 수관의 중심까지 거리(oy, ox). 바탕(수관 틈)은 중심 없음(큰 값)."""
    st = STYLES[style]
    tex = np.zeros((P, P, 4), np.uint8); tex[..., :3] = st["under"]; tex[..., 3] = 255
    own = np.full((P, P, 2), 99, np.int16)
    crowns = [crown(k, keep) for k, keep in st["crowns"]]
    # 간격은 P 를 나누어 떨어지게 맞춘다(안 맞으면 32px 마다 이음매 줄이 생긴다)
    nx, ny = max(1, round(P / st["spacing"][0])), max(1, round(P / st["spacing"][1]))
    sx, sy = P / nx, P / ny
    rng = np.random.default_rng(seed)
    # 줄무늬 금지: 격자에서 크게 흔들고 줄마다 반 칸 어긋나게, 수관마다 밝기·좌우 반전
    spots = []
    for gy in range(ny):
        for gx in range(nx):
            x = int(gx * sx + (gy % 2) * sx / 2) + int(rng.integers(-int(sx // 4), int(sx // 4) + 1))
            y = int(gy * sy) + int(rng.integers(-int(sy // 4), int(sy // 4) + 1))
            spots.append((y, x, int(rng.integers(len(crowns))), float(rng.uniform(0.84, 1.08)), bool(rng.integers(2))))
    # 감아 붙인 사본까지 한 줄로 세워 y 순으로 그린다 — 남쪽 수관이 늘 북쪽 수관을 덮어 이음매가 없다
    placed = sorted((y + oy, x + ox, ci, tint, flip) for y, x, ci, tint, flip in spots for oy in (-P, 0, P) for ox in (-P, 0, P))
    YY, XX = np.mgrid[0:P, 0:P]
    broad = 1 + 0.07 * np.sin(2 * math.pi * (XX + 2 * YY) / P + seed)   # 큰 결의 명암
    for y, x, ci, tint, flip in placed:
        c = crowns[ci][:, ::-1] if flip else crowns[ci]
        h, w = c.shape[:2]
        x0, y0 = x - w // 2, y - h // 2
        for j in range(h):
            ty = y0 + j
            if not 0 <= ty < P: continue
            for i in range(w):
                tx = x0 + i
                if 0 <= tx < P and c[j, i, 3]:
                    tex[ty, tx, :3] = np.clip(c[j, i, :3] * tint * broad[ty, tx], 0, 255)
                    own[ty, tx] = (y - ty, x - tx)
    return tex, own

N8 = [(-1, -1), (0, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (0, 1), (1, 1)]
def mask_field(mask):
    f = np.zeros((3 * T, 3 * T), bool); f[T:2 * T, T:2 * T] = True
    for b, (dx, dy) in enumerate(N8):
        if mask >> b & 1: f[(dy + 1) * T:(dy + 2) * T, (dx + 1) * T:(dx + 2) * T] = True
    return f

def side_depth(f, R=6.0):
    """칸 계단을 둥글게 편 «숲 밖에서 떨어진 거리»(build-beodeul-nature.py rounded_depth 와 같은 방식, 48×48 전체).
    R=6 이라 한 칸 폭(16px) 숲 띠도 속(깊이 6)이 생겨 수관이 남는다."""
    core = ndimage.distance_transform_edt(np.pad(f, 1, mode="edge"))[1:-1, 1:-1] >= R
    if not core.any(): return np.zeros(f.shape)
    return np.maximum(0.0, R - ndimage.distance_transform_edt(~core))

def south_depth(f):
    """아래로 숲이 몇 px 더 이어지나(열마다). 창 밖(남쪽 이웃 칸 아래)은 숲이 이어진다고 본다 - 그 칸의 끝은 그 칸이 그린다."""
    d = np.zeros(f.shape)
    run = np.full(f.shape[1], 2.0 * T)
    for y in range(f.shape[0] - 1, -1, -1):
        run = np.where(f[y], run + 1, 0); d[y] = run
    return d

def canopy_tile(texown, style, mask, phx, phy):
    """수관은 «통째로» 남기거나 뺀다 — 화소를 덮은 수관의 중심이 숲 안쪽(옆 4px·남쪽 9px 이상)이면 남긴다.
    그래서 숲 가장자리가 칸 계단이 아니라 둥근 수관 혹들로 끝난다. 수관 틈(바탕)은 숲 안쪽 깊이 6px 이상에서만."""
    tex, own = texown
    st = STYLES[style]
    f = mask_field(mask)
    ds, dn = side_depth(f), south_depth(f)
    Y, X = np.mgrid[0:3 * T, 0:3 * T]
    AX = (X - T + phx * T) % P; AY = (Y - T + phy * T) % P
    oy, ox = own[AY, AX, 0], own[AY, AX, 1]
    has = oy < 90
    cy = np.clip(Y + np.where(has, oy, 0), 0, 3 * T - 1); cx = np.clip(X + np.where(has, ox, 0), 0, 3 * T - 1)
    # 수관 중심이 가장자리에서 반 수관(5.5px) 넘게 들어와야 남긴다 - 칸 경계에 잘린 직선 대신 둥근 혹이 가장자리가 된다
    keep_crown = has & (ds[cy, cx] >= 5.5) & (dn[cy, cx] >= 9.0) & f[cy, cx] & (dn >= 4)
    keep_gap = ~has & (ds >= 6.0) & (dn >= 12)
    can = keep_crown | keep_gap
    out = np.zeros((3 * T, 3 * T, 4), np.uint8)
    out[can] = tex[AY[can], AX[can]]
    # 수관 아랫면 그늘(앞면에서 보이는 수관 밑 2px)
    under = can & ~np.vstack([can[2:], np.zeros((2, 3 * T), bool)])
    out[under, :3] = (out[under, :3].astype(float) * 0.7).astype(np.uint8)
    # 줄기·하층: 수관 바로 밑(위 12px 안에 수관이 있는 숲 칸)
    since = np.full(can.shape, 99.0); run = np.full(can.shape[1], 99.0)
    for y in range(can.shape[0]):
        run = np.where(can[y], 0, run + 1); since[y] = run
    band = f & ~can & (since <= 12) & (ds >= 1.5)
    out[band, :3] = st["understory"]; out[band, 3] = np.clip(140 + 12 * dn, 140, 220).astype(np.uint8)[band]
    hi, mid, lo = st["trunk"]
    for tx0, tw in ((3, 3), (14, 2), (23, 3)):
        xs = (AX - tx0) % P
        stem = band & (xs < tw) & (dn >= 1)
        out[stem, :3] = mid; out[stem, 3] = 255
        out[stem & (xs == 0), :3] = hi
        out[stem & (xs == tw - 1), :3] = lo
        flare = band & (dn < 2) & ((xs < tw + 1) | (xs == P - 1))
        out[flare, :3] = lo; out[flare, 3] = 255
    foot = band & (dn < 1)
    out[foot, :3] = st["outline"]; out[foot, 3] = 200
    # 윤곽 1px: 수관이 빈 곳(수관도 하층도 아닌 곳)과 맞닿는 화소
    solid = can | band
    edge = can & ~ndimage.binary_erosion(solid, structure=np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]]), border_value=1)
    out[edge, :3] = st["outline"]; out[edge, 3] = 255
    return out[T:2 * T, T:2 * T]

def shade_tile(nw, ne):
    """숲 남쪽 바로 아래 칸의 그늘 — 위 5px 진하고 아래로 옅어진다. 북서/북동이 숲이 아니면 그 쪽 끝을 둥글게."""
    Y, X = np.mgrid[0:T, 0:T].astype(float)
    a = np.clip(120 - Y * 22, 0, 120)
    if not nw: a *= np.clip((X - Y * 0.6) / 6.0, 0, 1)
    if not ne: a *= np.clip(((T - 1 - X) - Y * 0.6) / 6.0, 0, 1)
    out = np.zeros((T, T, 4), np.uint8); out[..., :3] = (20, 30, 24); out[..., 3] = a.astype(np.uint8)
    return out

def main():
    cat = json.loads(CAT.read_text(encoding="utf-8"))
    base = cat.get("forestBase", cat["count"])
    old = Image.open(PNG).convert("RGBA")
    kept = np.array(old)[:(base // COLS) * T]
    tiles, index = [], {}
    def add(px):
        if px[..., 3].max() == 0: return -1
        key = px.tobytes()
        if key not in index: index[key] = base + len(tiles); tiles.append(px)
        return index[key]
    canopy = {}
    for si, style in enumerate(STYLES):
        tex = canopy_texture(style, 11 + si)
        canopy[style] = [[add(canopy_tile(tex, style, m, ph % 2, ph // 2)) for m in range(256)] for ph in range(4)]
    shade = [add(shade_tile(nw, ne)) for nw in (False, True) for ne in (False, True)]
    rows = math.ceil(len(tiles) / COLS)
    extra = np.zeros((rows * T, COLS * T, 4), np.uint8)
    for n, px in enumerate(tiles):
        extra[(n // COLS) * T:(n // COLS + 1) * T, (n % COLS) * T:(n % COLS + 1) * T] = px
    Image.fromarray(np.vstack([kept, extra]), "RGBA").save(PNG, optimize=True)
    cat["forestBase"] = base
    cat["forestCanopy"] = canopy
    cat["forestShade"] = shade
    cat["count"] = base + rows * COLS
    CAT.write_text(json.dumps(cat, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"forest canopy {len(tiles)}칸 덧붙임: count {base} -> {cat['count']}")

if __name__ == "__main__":
    main()
