# prepare-monster-cave-references.mjs 의 그림 렌더러. stdin 으로 배열 JSON 을 받아 실제 칸을 nearest 로 합성한다.
import json
import sys

from PIL import Image

spec = json.loads(sys.stdin.read())
sheet = Image.open("public/assets/monster-cave/monster-cave.png").convert("RGBA")
T = 16


def tile(i):
    return sheet.crop(((i % 30) * T, (i // 30) * T, (i % 30) * T + T, (i // 30) * T + T))


def render(lower, upper, crop=None):
    h, w = len(lower), len(lower[0])
    x0, y0, cw, ch = crop or (0, 0, w, h)
    im = Image.new("RGBA", (cw * T, ch * T), (0, 0, 0, 255))
    for y in range(y0, y0 + ch):
        for x in range(x0, x0 + cw):
            for layer in (lower, upper):
                t = layer[y][x]
                if t >= 0:
                    im.alpha_composite(tile(t), ((x - x0) * T, (y - y0) * T))
    return im


def save(im, name, scale):
    big = im.resize((im.width * scale, im.height * scale), Image.NEAREST).convert("RGB")
    big.quantize(255).save(spec["out"] + "/" + name, optimize=True)


ex = spec["example"]
save(render(ex["lower"], ex["upper"]), "cave-example.png", 2)
bg = Image.new("RGBA", sheet.size, (40, 40, 40, 255))
bg.alpha_composite(sheet)
save(bg, "sheet-overview.png", 2)
for v in spec["variants"]:
    ok = render(ex["lower"], ex["upper"], v["crop"])
    bad = render(v["lower"], v["upper"], v["crop"])
    pair = Image.new("RGBA", (ok.width * 2 + 8, ok.height), (255, 255, 255, 255))
    pair.paste(ok, (0, 0))
    pair.paste(bad, (ok.width + 8, 0))
    save(pair, v["id"] + "-ok-bad.png", 3)
print("images ok")

