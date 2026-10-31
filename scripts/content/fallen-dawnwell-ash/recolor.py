"""폴른 스타 B5 새벽샘 터 — 웨이브 장소 「폐허 마을」 칸을 같은 칩셋의 「재의 들판」 색으로 다시 칠한다(불탄 마을).

새 그림은 없다. 마을이 쓰는 칸만 골라, 초록 풀·잎 화소를 재의 들판 땅 화소의 밝기별 색으로 옮기고,
마른 풀(누런색)은 그을린 갈색으로, 나머지(돌·지붕·나무 벽)는 채도만 낮춘다. 화소 위치·윤곽·투명은 그대로다.

출력: src/project/flagship/fallen/dawnwellAshSheet.ts — 64칸 폭 시트(255색 + 투명 팔레트 PNG, data URL)와
  시트 칸 n 이 원래 웨이브 칩셋의 몇 번 칸인지(DAWNWELL_ASH_SOURCE[n]). 통행·층은 짓는 쪽이 원래 칸에서 그대로 옮긴다.
  python3 scripts/content/fallen-dawnwell-ash/recolor.py
"""
import base64, colorsys, io, json, os
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
J = json.load(open(os.path.join(ROOT, "src/project/regionReferences/beodeul-wave-places.json")))
SHEET = Image.open(os.path.join(ROOT, "public/assets/beodeul-wave-places/beodeul-wave-places-chipset.png")).convert("RGBA")
TS = J["tilesets"]["beodeul_wave_places"]
TPR = TS["tilesPerRow"]
LAYERS = ("lowerTiles", "lowerOverlayTiles", "upperTiles", "upperOverlayTiles")
OUT_COLS = 64


def cell(t):
    return SHEET.crop(((t % TPR) * 16, (t // TPR) * 16, (t % TPR) * 16 + 16, (t // TPR) * 16 + 16))


def lum(r, g, b):
    return 0.299 * r + 0.587 * g + 0.114 * b


# 재의 들판 땅 화소 — 밝기 32칸별 색(채도 낮은 화소만: 용암·유황은 빼고).
ash = J["maps"]["bd-wave-ash-plain"]
buckets = [[] for _ in range(32)]
for t in set(x for x in ash["lowerTiles"] if x >= 0):
    for (r, g, b, a) in cell(t).get_flattened_data():
        if a < 255:
            continue
        h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        if s > 0.25:
            continue
        buckets[min(31, int(lum(r, g, b) / 8))].append((r, g, b))
LUT = []
last = (60, 58, 62)
for bk in buckets:
    if bk:
        bk.sort(key=lambda c: lum(*c))
        last = bk[len(bk) // 2]
    LUT.append(last)
# 비어 있는 어두운 칸은 가장 가까운 아는 색을 쓴다.
for i in range(31, -1, -1):
    if not buckets[i] and i < 31:
        LUT[i] = LUT[i + 1]
lo = min(i for i, b in enumerate(buckets) if b)
hi = max(i for i, b in enumerate(buckets) if b)


def ash_of(l, lift=0.0):
    # 풀의 밝기 폭(대략 50~200)을 재의 들판 밝기 폭에 늘려 맞춘다.
    k = (l - 40) / 170 * 0.62
    k = max(0.0, min(1.0, k + lift))
    i = int(lo + k * (hi - lo))
    return LUT[i]


def recolor(r, g, b, upper):
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    hd = h * 360
    l = lum(r, g, b)
    if s > 0.18 and 65 <= hd <= 175:
        # 위층(나무 수관) 잎은 숯 빛으로 — 재 땅보다 훨씬 어둡게. 아래층 풀은 재 땅.
        if upper:
            c = ash_of(l, -0.2)
            return int(c[0] * 0.55), int(c[1] * 0.5), int(c[2] * 0.5)
        return ash_of(l)
    if s > 0.22 and 35 <= hd < 65:           # 마른 풀·연두 끝 → 그을린 갈색
        nr, ng, nb = colorsys.hsv_to_rgb(28 / 360, min(0.45, s * 0.6), v * 0.62)
        return int(nr * 255), int(ng * 255), int(nb * 255)
    # 나머지(돌·벽·지붕·흙)는 채도를 낮추고 조금 어둡게 — 재가 앉은 색.
    nr, ng, nb = colorsys.hsv_to_rgb(h, s * 0.55, v * 0.86)
    return int(nr * 255), int(ng * 255), int(nb * 255)


def main():
    m = J["maps"]["bd-wave-ruined-village"]
    used = sorted(set(t for L in LAYERS for t in m[L] if t >= 0))
    upper = set(t for L in ("upperTiles", "upperOverlayTiles") for t in m[L] if t >= 0)
    rows = (len(used) + OUT_COLS - 1) // OUT_COLS
    out = Image.new("RGBA", (OUT_COLS * 16, rows * 16), (0, 0, 0, 0))
    cache = {}
    for n, t in enumerate(used):
        src = cell(t)
        px = []
        for (r, g, b, a) in src.get_flattened_data():
            if a == 0:
                px.append((0, 0, 0, 0))
                continue
            key = (r, g, b, t in upper)
            if key not in cache:
                cache[key] = recolor(r, g, b, t in upper)
            px.append((*cache[key], a))
        im = Image.new("RGBA", (16, 16))
        im.putdata(px)
        out.paste(im, ((n % OUT_COLS) * 16, (n // OUT_COLS) * 16))
    # 255색 팔레트 + 투명 칸 하나(255번) — 데이터 URL 크기를 1/3 로 줄인다. 알파는 0/255 뿐이다.
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
    with open(dst, "w") as f:
        f.write("// 생성 파일 — python3 scripts/content/fallen-dawnwell-ash/recolor.py. 손으로 고치지 말 것.\n")
        f.write("// 『폴른 스타』 B5 새벽샘 터: 웨이브 장소 「폐허 마을」 칸을 같은 칩셋 「재의 들판」 색으로 다시 칠한 시트(새 그림 없음).\n")
        f.write(f"export const DAWNWELL_ASH_COLS = {OUT_COLS};\n")
        f.write("/** 시트 칸 n 의 원래 웨이브 칩셋(beodeul_wave_places) 칸 번호. */\n")
        f.write("export const DAWNWELL_ASH_SOURCE: readonly number[] = " + json.dumps(used, separators=(",", ":")) + ";\n")
        f.write(f"export const DAWNWELL_ASH_PNG = \"{url}\";\n")
    Image.open(io.BytesIO(buf.getvalue())).convert("RGBA").save("/tmp/fs2b5/dawnwellAsh-preview.png")
    print(len(used), "tiles", out.size, len(url), "chars")


if __name__ == "__main__":
    main()
