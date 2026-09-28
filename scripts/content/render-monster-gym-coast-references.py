# 체육관·해변 참고문서 그림 렌더러. prepare-monster-gym-coast-references.mjs 가 stdin 으로 배열을 넘긴다.
# 그림은 전부 시트의 실제 칸을 nearest 로 붙여 만든다(AI 가 그린 모형이 아니다).
import json
import sys

from PIL import Image, ImageDraw

spec = json.loads(sys.stdin.read())
sheet = Image.open(spec["sheet"]).convert("RGBA")
T = 16


def tile(i):
    return sheet.crop(((i % 30) * T, (i // 30) * T, (i % 30) * T + T, (i // 30) * T + T))


def draw(m):
    im = Image.new("RGBA", (m["w"] * T, m["h"] * T), (0, 0, 0, 255))
    for layer in ("lower", "upper"):
        for i, t in enumerate(m[layer]):
            if t >= 0:
                im.alpha_composite(tile(t), ((i % m["w"]) * T, (i // m["w"]) * T))
    return im


def save(im, name, scale):
    im.resize((im.width * scale, im.height * scale), Image.NEAREST).convert("RGB").quantize(160).save(spec["out"] + "/" + name, optimize=True)


save(draw(spec["gym"]), "gym-example.png", 2)
save(draw(spec["gymOpen"]), "gym-example-open.png", 2)
save(draw(spec["beach"]), "beach-example.png", 2)

# 새 부품 반쪽 한눈에(칸 번호 480~, 투명은 회색 체크)
half = sheet.crop((0, 256, 320, 512))
bg = Image.new("RGBA", half.size)
d = ImageDraw.Draw(bg)
for y in range(0, half.height, 8):
    for x in range(0, half.width, 8):
        d.rectangle([x, y, x + 7, y + 7], fill=(200, 200, 200, 255) if (x // 8 + y // 8) % 2 else (235, 235, 235, 255))
bg.alpha_composite(half)
save(bg, "kit-overview.png", 2)

for b in spec["bad"]:
    x, y, w, h = b["crop"]
    s = 4
    box = (x * T, y * T, (x + w) * T, (y + h) * T)
    ok = draw(b["ok"]).crop(box).resize((w * T * s, h * T * s), Image.NEAREST)
    bad = draw(b["m"]).crop(box).resize((w * T * s, h * T * s), Image.NEAREST)
    dd = ImageDraw.Draw(bad)
    for mx, my in b["marks"]:
        if x <= mx < x + w and y <= my < y + h:
            px, py = (mx - x) * T * s, (my - y) * T * s
            dd.rectangle([px + 1, py + 1, px + T * s - 2, py + T * s - 2], outline=(255, 0, 60, 255), width=3)
    pair = Image.new("RGBA", (ok.width * 2 + 12, ok.height), (255, 255, 255, 255))
    pair.paste(ok, (0, 0))
    pair.paste(bad, (ok.width + 12, 0))
    pair.convert("RGB").quantize(160).save(spec["out"] + "/" + b["id"] + "-ok-bad.png", optimize=True)
print("images ok")
