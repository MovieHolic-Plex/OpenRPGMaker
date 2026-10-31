"""폴른 스타 B5 새벽샘 터 — 웨이브 장소 「폐허 마을」을 불탄 마을로 다시 칠한다(새 그림 없음, 원본 화소를 옮기고 칠만 바꾼다).

순서(맵 전체 그림 단위로 한 뒤 16px 칸으로 다시 자른다):
  1. 칸 편집(원본 칸 번호 그대로 옮김) — 북쪽 출구로 가는 흙길(예배당 동쪽 세로 길을 맵 위 끝까지, 길 자리 고목 한 그루 걷기),
     서쪽 길 한가운데 잿더미(예배당 서쪽 시커먼 잔해 칸 3×3 을 그대로 옮겨 놓는다).
  2. 다시 칠하기 — 풀·잎 초록 → 재의 들판 땅 밝기의 중립 회색(보랏빛 없음), 마른 풀 → 그을린 갈색, 흙길 → 밝은 잿빛 흙(땅과 대비),
     지붕 붉은색 → 숯빛, 회벽·나무 벽 → 그을음. 바깥에서 잠긴 집(이야기상 「이 집만 무너지지 않았다」)은 칠을 약하게.
  3. 무너뜨리기 — 광장 둘레 집 넷(A·B·C·E)은 지붕 위쪽을 들쭉날쭉 잘라 내고(투명) 잘린 가장자리를 숯으로 칠한다.

출력: src/project/flagship/fallen/dawnwellAshSheet.ts
  DAWNWELL_ASH_PNG(64칸 폭 시트, 255색+투명) · DAWNWELL_ASH_LOWER/UPPER(맵 칸 → 시트 칸, -1 빈칸) ·
  DAWNWELL_ASH_PASS(시트 칸 → 통행·층을 빌려 올 원래 웨이브 칸 번호).
  python3 scripts/content/fallen-dawnwell-ash/recolor.py
"""
import base64, colorsys, io, json, os, random
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
J = json.load(open(os.path.join(ROOT, "src/project/regionReferences/beodeul-wave-places.json")))
SHEET = Image.open(os.path.join(ROOT, "public/assets/beodeul-wave-places/beodeul-wave-places-chipset.png")).convert("RGBA")
TPR = J["tilesets"]["beodeul_wave_places"]["tilesPerRow"]
OUT_COLS = 64
M = J["maps"]["bd-wave-ruined-village"]
W, H = M["width"], M["height"]

# 칸 좌표(act2Places.ts DAWN_SPOTS 와 맞춘다).
KEPT = (42, 33, 45, 38)                      # 바깥에서 잠긴 집 — 칠을 약하게
COLLAPSE = [(9, 19, 14, 23), (16, 25, 20, 30), (51, 26, 55, 30), (7, 36, 10, 41)]   # 무너뜨릴 집(광장 서쪽 둘·동쪽 하나·남서쪽 하나)
NORTH_ROAD = dict(xs=(38, 39), y0=0, y1=8, sample=(9, 12), clear=(38, 0, 41, 5))
ASH_HEAP = (15, 32)                          # 서쪽 길 한가운데 잿더미(기억 셋째) — 칸 가운데를 중심으로 길 화소를 숯·재로 칠한다


def cell(t):
    return SHEET.crop(((t % TPR) * 16, (t // TPR) * 16, (t % TPR) * 16 + 16, (t // TPR) * 16 + 16))


def lum(r, g, b):
    return 0.299 * r + 0.587 * g + 0.114 * b


# ── 1. 칸 편집 ──
lower = list(M["lowerTiles"])
upper = list(M["upperTiles"])
at = lambda x, y: y * W + x
x0, y0, x1, y1 = NORTH_ROAD["clear"]
for y in range(y0, y1 + 1):
    for x in range(x0, x1 + 1):
        upper[at(x, y)] = -1
        if x not in NORTH_ROAD["xs"]:
            lower[at(x, y)] = M["lowerTiles"][at(33 + ((x + y) % 2), 6 + (y % 2))]
s0, s1 = NORTH_ROAD["sample"]
for y in range(NORTH_ROAD["y0"], NORTH_ROAD["y1"] + 1):
    for x in NORTH_ROAD["xs"]:
        sy = s0 + ((y - s0) % (s1 - s0 + 1))
        lower[at(x, y)] = M["lowerTiles"][at(x, sy)]
        upper[at(x, y)] = -1


def compose(layer):
    im = Image.new("RGBA", (W * 16, H * 16), (0, 0, 0, 0))
    for i, t in enumerate(layer):
        if t >= 0:
            c = cell(t)
            im.paste(c, ((i % W) * 16, (i // W) * 16), c)
    return im


low_img, up_img = compose(lower), compose(upper)

# ── 2. 다시 칠하기 ──
ash = J["maps"]["bd-wave-ash-plain"]
ls = []
for t in set(x for x in ash["lowerTiles"] if x >= 0):
    for (r, g, b, a) in cell(t).get_flattened_data():
        if a == 255 and colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)[1] <= 0.25:
            ls.append(lum(r, g, b))
ls.sort()
L_LO, L_HI = ls[int(len(ls) * 0.05)], ls[int(len(ls) * 0.95)]


def grey(l, mul=1.0):
    v = max(0, min(255, int(l * mul)))
    return (v, v, min(255, v + 2))          # 중립 회색(아주 살짝 찬 기) — 보랏빛 없음


def ground(l):
    k = max(0.0, min(1.0, (l - 40) / 170))
    return grey(L_LO + k * (L_HI - L_LO) * 0.8)


def hsv(h, s, v):
    r, g, b = colorsys.hsv_to_rgb(h, max(0, min(1, s)), max(0, min(1, v)))
    return int(r * 255), int(g * 255), int(b * 255)


def recolor(r, g, b, is_upper, mild):
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    hd = h * 360
    l = lum(r, g, b)
    if s > 0.18 and 65 <= hd <= 175:                       # 풀·잎
        if is_upper:
            return grey(ground(l)[0] * 0.5)                 # 수관 → 숯
        return ground(l)
    if not is_upper and 18 <= hd < 45 and 0.15 < s < 0.42 and v > 0.42:   # 흙길 → 밝은 잿빛 흙(땅보다 밝게)
        return hsv(30 / 360, 0.07, 0.46 + 0.16 * v)
    if s > 0.22 and 35 <= hd < 65:                          # 마른 풀
        return hsv(28 / 360, min(0.35, s * 0.5), v * 0.55)
    if mild:
        return hsv(h, s * 0.5, v * 0.85)
    if is_upper and (hd < 30 or hd > 330) and s > 0.3:      # 붉은 지붕·차양 → 숯
        return hsv(h, s * 0.3, v * 0.42)
    if is_upper:                                            # 벽·나무·돌 → 그을음
        return hsv(h, s * 0.3, v * 0.5)
    return hsv(h, s * 0.35, v * 0.8)


def in_box(px, py, box):
    return box[0] * 16 <= px < (box[2] + 1) * 16 and box[1] * 16 <= py < (box[3] + 1) * 16


def recolor_img(im, is_upper, cover=None):
    """cover: 위층 그림이 덮는 화소(원본 위층 알파) — 1층의 그 화소는 건물·나무 그림이 겹쳐 있으니 건물 규칙으로 칠한다."""
    src = im.load()
    cv = cover.load() if cover is not None else None
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    dst = out.load()
    cache = {}
    for py in range(im.height):
        for px in range(im.width):
            r, g, b, a = src[px, py]
            if a == 0:
                continue
            mild = in_box(px, py, KEPT)
            up_rule = is_upper or (cv is not None and cv[px, py][3] > 0)
            key = (r, g, b, mild, up_rule)
            if key not in cache:
                cache[key] = recolor(r, g, b, up_rule, mild)
            c = cache[key]
            # 그을음 얼룩 — 위층 건물 칠에 화소마다 약한 어둡기 차.
            if up_rule and not mild:
                k = 1 - 0.18 * (((px * 7349 + py * 1931) ^ (px * py)) % 5) / 4
                c = tuple(int(q * k) for q in c)
            dst[px, py] = (*c, 255)
    return out


up_orig = up_img
low_img = recolor_img(low_img, False, up_orig)
up_img = recolor_img(up_img, True)

# ── 3. 무너뜨리기 ──
rng = random.Random(5)
ua = up_img.load()
la = low_img.load()


# 지붕이 없어진 자리에 깔 맨땅 화소 — 길 서쪽 위 빈 땅 칸(33~34, 6~7)의 다시 칠한 화소에서 고른다.
GROUND_PX = [la[x, y] for x in range(33 * 16, 35 * 16) for y in range(6 * 16, 8 * 16) if la[x, y][3]]


def char_px():
    k = rng.random()
    if k < 0.05:
        return (150, 70, 30, 255)          # 불씨
    if k < 0.35:
        return (62, 60, 62, 255)           # 재
    return (28, 26, 28, 255)               # 숯
for (bx0, by0, bx1, by1) in COLLAPSE:
    X0, Y0, X1, Y1 = bx0 * 16, by0 * 16, (bx1 + 1) * 16, (by1 + 1) * 16
    cols = [x for x in range(X0, X1) if any(ua[x, y][3] for y in range(Y0, Y1))]
    if not cols:
        continue
    top = {x: next(y for y in range(Y0, Y1) if ua[x, y][3]) for x in cols}
    ys = [y for x in cols for y in range(Y0, Y1) if ua[x, y][3]]
    hgt = max(ys) - min(ys) + 1
    cut = min(ys) + int(hgt * 0.38)
    for x in cols:
        cut += rng.choice((-2, -1, -1, 0, 0, 1, 1, 2))
        cut = max(min(ys) + int(hgt * 0.22), min(min(ys) + int(hgt * 0.55), cut))
        deb = rng.choice((4, 5, 6, 7))
        for y in range(Y0, cut):
            if ua[x, y][3]:
                if y >= cut - deb:
                    la[x, y] = char_px()   # 내려앉은 지붕 잔해 — 잘린 선 바로 위에 숯·재·불씨
                else:
                    # 그 위는 지붕이 없어진 자리 — 집 바로 위 땅 화소를 거울처럼 가져와 땅이 보이게 한다.
                    la[x, y] = rng.choice(GROUND_PX)
            ua[x, y] = (0, 0, 0, 0)
        # 잘린 가장자리 두세 줄은 숯, 군데군데 불씨.
        band = rng.choice((2, 3, 3, 4))
        for y in range(cut, min(Y1, cut + band)):
            if ua[x, y][3]:
                ember = rng.random() < 0.06
                ua[x, y] = (150, 70, 30, 255) if ember else (24, 22, 24, 255)
        # 그 아래 벽에 그을음 — 잘린 선에서 멀어질수록 옅게, 기둥마다 길이가 다르게 흘러내린다.
        soot = rng.choice((8, 12, 16, 22))
        for y in range(cut + band, min(Y1, cut + band + soot)):
            r_, g_, b_, a_ = ua[x, y]
            if a_:
                k = 0.45 + 0.5 * (y - cut - band) / soot
                ua[x, y] = (int(r_ * k), int(g_ * k), int(b_ * k), 255)

# 서쪽 길 잿더미 — 길 위 화소를 숯·재·불씨로 칠한 낮은 더미(가로 약 2.5칸). 아래 가장자리는 더 어둡게(그림자), 위는 밝은 재.
hx, hy = ASH_HEAP[0] * 16 + 8, ASH_HEAP[1] * 16 + 10
for py in range(hy - 16, hy + 12):
    for px in range(hx - 22, hx + 22):
        n = ((px * 92837111) ^ (py * 689287499)) % 7
        rx, ry = (px - hx) / (19 + n * 0.6), (py - hy) / (9 + (n % 3))
        d = rx * rx + ry * ry
        if d > 1:
            continue
        k = rng.random()
        if py - hy > 6 * (1 - rx * rx) ** 0.5 - 1:
            c = (14, 13, 15, 255)                      # 아래쪽 그늘
        elif py - hy < -5 and k < 0.5:
            c = (92, 90, 92, 255)                      # 위에 앉은 밝은 재
        elif k < 0.07:
            c = (170, 78, 30, 255)                     # 불씨
        elif k < 0.3:
            c = (58, 56, 58, 255)
        else:
            c = (26, 24, 26, 255)
        la[px, py] = c

# ── 4. 칸으로 다시 자르기 ──
tiles, index = [], {}
pass_src = []


def slot(img, x, y, src_tile):
    c = img.crop((x * 16, y * 16, x * 16 + 16, y * 16 + 16))
    if c.getbbox() is None:
        return -1
    key = (c.tobytes(), src_tile)
    if key not in index:
        index[key] = len(tiles)
        tiles.append(c)
        pass_src.append(src_tile)
    return index[key]


LOW = [slot(low_img, i % W, i // W, lower[i]) if lower[i] >= 0 else -1 for i in range(W * H)]
UP = [slot(up_img, i % W, i // W, upper[i]) if upper[i] >= 0 else -1 for i in range(W * H)]

rows = (len(tiles) + OUT_COLS - 1) // OUT_COLS
out = Image.new("RGBA", (OUT_COLS * 16, rows * 16), (0, 0, 0, 0))
for n, c in enumerate(tiles):
    out.paste(c, ((n % OUT_COLS) * 16, (n // OUT_COLS) * 16))
# 255색 팔레트 + 투명 칸 하나(255번) — 데이터 URL 크기를 줄인다. 알파는 0/255 뿐이다.
alpha = out.getchannel("A")
q = out.convert("RGB").quantize(colors=255, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
pal = q.getpalette()[: 255 * 3] + [0, 0, 0]
data = [255 if a == 0 else i for i, a in zip(q.get_flattened_data(), alpha.get_flattened_data())]
pimg = Image.new("P", out.size)
pimg.putpalette(pal)
pimg.putdata(data)
buf = io.BytesIO()
pimg.save(buf, format="PNG", optimize=True, transparency=255)
url = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
dst = os.path.join(ROOT, "src/project/flagship/fallen/dawnwellAshSheet.ts")
js = lambda v: json.dumps(v, separators=(",", ":"))
with open(dst, "w") as f:
    f.write("// 생성 파일 — python3 scripts/content/fallen-dawnwell-ash/recolor.py. 손으로 고치지 말 것.\n")
    f.write("// 『폴른 스타』 B5 새벽샘 터: 웨이브 장소 「폐허 마을」을 불탄 마을로 다시 칠한 시트(새 그림 없음 — 원본 화소를 옮기고 칠만 바꿈).\n")
    f.write(f"export const DAWNWELL_ASH_COLS = {OUT_COLS};\n")
    f.write(f"export const DAWNWELL_ASH_SIZE = {{ width: {W}, height: {H} }};\n")
    f.write("/** 맵 칸 → 시트 칸(1층·3층). -1 빈칸. */\n")
    f.write(f"export const DAWNWELL_ASH_LOWER: readonly number[] = {js(LOW)};\n")
    f.write(f"export const DAWNWELL_ASH_UPPER: readonly number[] = {js(UP)};\n")
    f.write("/** 시트 칸 n 의 통행·층을 빌려 올 원래 웨이브 칩셋(beodeul_wave_places) 칸 번호. */\n")
    f.write(f"export const DAWNWELL_ASH_PASS: readonly number[] = {js(pass_src)};\n")
    f.write(f"export const DAWNWELL_ASH_PNG = \"{url}\";\n")
prev = Image.open(io.BytesIO(buf.getvalue())).convert("RGBA")
full = Image.new("RGBA", (W * 16, H * 16), (0, 0, 0, 255))
for L in (LOW, UP):
    for i, n in enumerate(L):
        if n >= 0:
            c = prev.crop(((n % OUT_COLS) * 16, (n // OUT_COLS) * 16, (n % OUT_COLS) * 16 + 16, (n // OUT_COLS) * 16 + 16))
            full.paste(c, ((i % W) * 16, (i // W) * 16), c)
os.makedirs("/tmp/fs2b5", exist_ok=True)
full.convert("RGB").save("/tmp/fs2b5/village-ash2.png")
print(len(tiles), "tiles", out.size, len(url), "chars")
