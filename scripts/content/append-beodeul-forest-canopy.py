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

STYLES = {
    "leaf": {
        "period": 6, "density": (0.95, 0.9, 0.75),
        # 수관은 한 무리(잔 점묘 활엽수 — 마을 낱 나무와 같은 결)만 쓴다. 매끈한 베개 음영 수관(bd-tree-e9d9b3·47e17a·d105b2)을 섞으면
        # 화소 덩이 크기·색 온도가 달라 한 숲 안에서 두 그림체가 부딪친다(Gemini Argon VQA 1회차). 깊이는 아래 겹 «low» 색조로만 낸다.
        "crowns": [("bd-tree-f4f319", 1.0), ("bd-tree-37f48b", 1.0), ("bd-tree-0f7ed1", 1.0)],
        "weights": [3, 3, 2],
        "tints": [(1.0, 1.0, 1.0), (1.04, 1.03, 0.88), (0.92, 0.97, 1.03), (0.9, 0.92, 0.92), (1.02, 1.0, 0.93)],
        "low": (0.66, 0.72, 0.74),
        "under": (20, 46, 30), "deep": (12, 28, 20),
        "trunk": ((128, 94, 54), (92, 66, 38), (58, 42, 26)), "root": (64, 50, 30),
        "shade": (14, 30, 18),
        "brush": ["bd-pick-deep-forest-path-fern-a", "bd-pick-deep-forest-path-fern-b", "bd-pick-deep-forest-path-fern-c",
                  "bd-pick-deep-forest-path-wild-a", "bd-pick-deep-forest-path-toadstools-a", "bd-pick-deep-forest-path-wild-b"],
    },
    "snow": {
        # 소나무는 키가 커서 32px 로 맞추면 덩이 안에서 위아래로 움직일 틈이 없어 16px 피치 가로줄(흰 눈-짙은 밑)로 늘어선다 — 20~29px 로 줄여 흔든다
        "period": 4, "density": (0.95, 0.9, 0.85, 0.8, 0.7), "fits": (20, 23, 26, 29),
        "crowns": [("bd-pick-snowfield-pine", 0.86)],
        "weights": [1],
        "tints": [(1.0, 1.0, 1.0), (0.95, 0.98, 1.03), (1.03, 1.02, 0.98), (0.88, 0.93, 0.97)],
        "low": (0.74, 0.8, 0.86),
        "under": (176, 192, 212), "deep": (128, 146, 170),
        "trunk": ((120, 92, 64), (84, 62, 44), (54, 42, 32)), "root": (70, 56, 44),
        "shade": (40, 60, 86),
        "brush": ["bd-pick-snowfield-mound", "bd-pick-snowfield-rock"],
    },
}

def build_slots(style, seed):
    """주기 판(P×P 칸) 모서리마다 수관 자리 — 겹마다 서로 대각 1칸 넘게 떨어지게 뽑고,
    어느 겹 수관도 덮지 않는 칸이 남으면 아래 겹 수관을 하나 더 세운다(숲 속에 빈 네모가 생기지 않게).
    수관마다 크기(fits)·위치(덩이 안 흔들림)·색조·반전이 달라 같은 수관이 격자로 늘어서 보이지 않는다."""
    st = STYLES[style]; P = st["period"]
    fits = st.get("fits", (24, 27, 30, 32))
    imgs = [{f: sprite(k, keep, f) for f in fits} for k, keep in st["crowns"]]
    w = np.array(st["weights"], float); w /= w.sum()
    rng = np.random.default_rng(seed)
    slots = {}   # (덩이 왼쪽 위 칸 x, y) -> [slot, ...]
    def put(x, y, layer):
        ci = int(rng.choice(len(imgs), p=w))
        # 아래 겹은 큰 쪽 둘로 숲 속을 메우고, 위 겹은 모든 크기를 섞어 실루엣이 고르지 않게 한다
        img = imgs[ci][fits[int(rng.integers(2, len(fits)))] if layer == 0 else fits[int(rng.integers(len(fits)))]]
        h, wd = img.shape[:2]
        tint = np.array(st["tints"][int(rng.integers(len(st["tints"])))], float)
        if layer == 0: tint = tint * np.array(st["low"])
        slots.setdefault((x, y), []).append(dict(
            layer=layer, img=img[:, ::-1] if rng.integers(2) else img, tint=tint,
            dx=int(rng.integers(0, B - wd + 1)), dy=int(rng.integers(0, B - h + 1)),
            trunk=int(rng.integers(-2, 3)), root=int(rng.integers(0, 4)), flare=int(rng.integers(2))))
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
    brush = [sprite(k) for k in st["brush"] if k in KITS]
    return dict(P=P, slots=slots, brush=brush, seed=seed)

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

def crown_block(st, s, front):
    """덩이 32×32 그림 하나(RGBA float) — front 면 아래 절반을 8px 로 누르고 그 밑에 하층 그늘·줄기·뿌리."""
    blk = np.zeros((B, B, 4), float)
    img = s["img"].astype(float); h, w = img.shape[:2]
    y0 = min(s["dy"], B - h)
    m = img[..., 3] > 0
    blk[y0:y0 + h, s["dx"]:s["dx"] + w][m] = np.concatenate([np.clip(img[..., :3] * s["tint"], 0, 255), img[..., 3:]], -1)[m]
    if not front: return blk
    top = blk[:T].copy()
    rows = np.round(np.linspace(T, B - 1, T // 2)).astype(int)
    low = blk[rows]
    out = np.zeros_like(blk)
    out[:T] = top; out[T:T + T // 2] = low
    # 하층 그늘: 눌린 수관 실루엣을 아래로 밀어 낸 떨어진 그림자(둥근 밑면을 따라 옅어진다 — 네모 띠가 아니다)
    crown = out[..., 3] > 0
    for k in range(1, T // 2 + 1):
        sh = np.zeros_like(crown); sh[k:] = crown[:-k]
        sh = ndimage.binary_erosion(sh, iterations=1 + k // 3) if k > 2 else sh
        a = 200 * (1 - (k - 1) / (T // 2)) ** 1.4
        sel = sh & (out[..., 3] < a) & ~crown
        out[sel, :3] = st["deep"]; out[sel, 3] = a
    # 줄기·뿌리: 수관 가운데 «바로 밑». 밑동 높이는 수관마다 0~3px 달라(한 줄로 늘어서지 않게), 뿌리는 한쪽으로만 1px 퍼지고
    # 밑동 아래에 둥근 접지 그늘 2줄을 깔아 풀 위에 선다(평평한 T자 막대가 아니다).
    hi, mid, lo = st["trunk"]
    cx = s["dx"] + w // 2 + s["trunk"]; tw = 3
    base = B - 3 - s["root"]
    xl = cx - tw // 2
    for dy, half, a in ((1, tw // 2 + 2, 120), (2, tw // 2 + 1, 60)):
        for x in range(cx - half, cx + half + 1):
            if 0 <= x < B and base + dy < B and out[base + dy, x, 3] < a:
                out[base + dy, x, :3] = st["deep"]; out[base + dy, x, 3] = a
    for y in range(T + T // 2 - 3, base + 1):
        for i in range(tw):
            x = xl + i
            if not 0 <= x < B: continue
            if y < T + T // 2 - 1 and out[y, x, 3] > 0 and out[y, x, :3].sum() > 0: continue  # 수관이 덮은 줄기 머리
            out[y, x, :3] = hi if i == 0 else lo if i == tw - 1 else mid; out[y, x, 3] = 255
    rx = xl - 1 if s["flare"] else xl + tw
    if 0 <= rx < B: out[base, rx, :3] = st["root"]; out[base, rx, 3] = 255
    return out

def canopy_tile(style, data, mask, phx, phy):
    st = STYLES[style]; P = data["P"]
    g = mask_cells(mask)
    S = 3 * T
    rgba = np.zeros((S, S, 4), float)
    # 1) 숲 속 그늘(수관 틈) — 숲 밖까지 거리 ~10→~13px 에서 차오른다(16 보다 짧아 이웃 칸과 판정이 같다). 가장자리 수관 사이 틈은 풀이 비쳐
    #    숲 테두리에 짙은 네모 판이 드러나지 않는다. 차오르는 문턱을 절대 좌표(주기 판) 물결로 흔들어 곧은 띠가 서지 않게 한다.
    fp = np.kron(g, np.ones((T, T), bool))
    d = ndimage.distance_transform_edt(np.pad(fp, 1, constant_values=True))[1:-1, 1:-1]
    Yp, Xp = np.mgrid[0:S, 0:S].astype(float)
    L = P * T; AX = Xp + (phx - 1) * T; AY = Yp + (phy - 1) * T
    wob = 1.6 * np.sin(2 * math.pi * AY / L * 3 + 0.9) + 1.0 * np.sin(2 * math.pi * AX / L * 4 + 2.3) + 0.6 * np.sin(2 * math.pi * (AX + AY) / L * 7)
    a = np.clip((d - 10 - wob) / 3, 0, 1) * 255
    rgba[..., :3] = st["under"]; rgba[..., 3] = np.where(fp, a, 0)
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
        blk = crown_block(st, s, front)
        x0, y0 = bx * T, by * T
        m = blk[..., 3] > 0
        crown = np.zeros((S, S), bool); crown[y0:y0 + B, x0:x0 + B] = (blk[..., 3] > 0) & (blk[..., :3].sum(-1) > 0)
        if s["layer"] >= 1:
            inblk = np.zeros((S, S), bool); inblk[y0:y0 + B, x0:x0 + B] = True
            ring = ndimage.binary_dilation(crown, iterations=2) & ~crown & covered & inblk
            rgba[ring, :3] *= 0.7
        sub = rgba[y0:y0 + B, x0:x0 + B]
        sub[m] = blk[m]
        covered |= crown; painted[y0:y0 + B, x0:x0 + B] |= m
    # 숲 속 그늘은 수관에 «둘러싸인» 틈만 — 숲 가장자리 띠(숲 밖까지 16px 안)에서는 위 6px·왼쪽 8px·오른쪽 8px 안에 모두 수관이 있는 곳만 남기고
    #    지운다(좁은 숲 띠의 빈 자리, 숲 끝을 따라 수관 바깥으로 드러나는 곧은 그늘 띠 → 풀이 보인다).
    #    깊은 숲 속(16px 넘게)은 이웃 칸 수관을 모르므로 지우지 않아 칸 경계에 틈이 생기지 않는다.
    above = np.zeros((S, S), bool); left = np.zeros((S, S), bool); right = np.zeros((S, S), bool)
    for k in range(1, 7): above[k:] |= covered[:-k]
    for k in range(1, 9): left[:, k:] |= covered[:, :-k]; right[:, :-k] |= covered[:, k:]
    rgba[~painted & ~(above & left & right) & (d < 17), 3] = 0
    # 3) 수관이 하나도 서지 못한 칸(한 칸 폭 띠·뾰족한 끝): 셋 중 둘 꼴로 숲 가장자리 덤불(칸 안에만), 나머지는 풀
    h = (phx * 7 + phy * 13 + mask * 5 + data["seed"]) % (len(data["brush"]) * 3 // 2 + 1) if data["brush"] else len(data["brush"])
    if not any_valid and h < len(data["brush"]):
        b = data["brush"][h].astype(float); bh, bw = b.shape[:2]
        x0 = T + (T - bw) // 2; y0 = T + T - bh
        m = b[..., 3] > 0
        rgba[y0:y0 + bh, x0:x0 + bw][m] = b[m]
    out = np.clip(rgba[T:2 * T, T:2 * T], 0, 255).astype(np.uint8)
    out[out[..., 3] == 0] = 0
    return out

def shade_tile(style, phx, nw, ne):
    """숲 남쪽 바로 아래 칸의 옅은 그늘 — 짙기·깊이가 x 에 따라 물결쳐(수관 그림자가 닿는 곳만 짙다) 칸 경계에 곧은 선이 서지 않는다.
    북서/북동이 숲이 아니면 그 쪽 끝을 둥글게."""
    st = STYLES[style]; P = st["period"] * T
    Y, X = np.mgrid[0:T, 0:T].astype(float)
    AX = X + phx * T
    depth = 6.0 + 2.5 * np.sin(2 * math.pi * AX / P * 2 + 0.7) + 1.5 * np.sin(2 * math.pi * AX / P * 3 + 2.1)
    amp = 34 + 22 * np.sin(2 * math.pi * AX / P * 5 + 1.3) * np.sin(2 * math.pi * AX / P * 2 + 0.4)
    a = np.clip(1 - Y / depth, 0, 1) ** 1.6 * amp
    if not nw: a *= np.clip((X - Y * 0.6) / 6.0, 0, 1)
    if not ne: a *= np.clip(((T - 1 - X) - Y * 0.6) / 6.0, 0, 1)
    out = np.zeros((T, T, 4), np.uint8); out[..., :3] = st["shade"]; out[..., 3] = a.astype(np.uint8)
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
