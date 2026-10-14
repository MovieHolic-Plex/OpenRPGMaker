#!/usr/bin/env python3
"""farm_runtime_check.mts 의 그리기 기록(calls.json)을 바탕 맵 PNG 위에 런타임과 같은 깊이 순서로 합쳐 단계별 한 장으로 만든다.

  python3 scripts/content/beodeul-farm/farm_runtime_compose.py DIR   # DIR/base.png + DIR/calls.json → DIR/runtime-steps.png
타일 그림은 번들 시트(beodeul-city-chipset.png)의 `tile_<n>` 칸, 작물은 등록 스프라이트(public/assets/farming/crops/*.png)의 프레임이다.
"""
import json, pathlib, sys
from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parents[3]
d = pathlib.Path(sys.argv[1])
calls = json.loads((d / "calls.json").read_text())
base = Image.open(d / "base.png").convert("RGBA")
sheet = Image.open(ROOT / "public/assets/beodeul-city/beodeul-city-chipset.png").convert("RGBA")
sprites = {}


def sprite(tex):
    if tex not in sprites:
        slug = tex.replace("farming-crop-", "")
        sprites[tex] = Image.open(ROOT / f"public/assets/farming/crops/crop_{slug}.png").convert("RGBA")
    return sprites[tex]


panels = []
for name, cs in calls["frames"].items():
    im = base.copy()
    for c in sorted(cs, key=lambda c: c.get("depth") or 0):
        if c["kind"] == "image":
            t = int(str(c["frame"]).split("_")[1])
            tile = sheet.crop(((t % 128) * 16, (t // 128) * 16, (t % 128) * 16 + 16, (t // 128) * 16 + 16))
            if c.get("alpha") is not None:
                a = tile.getchannel("A").point(lambda v: int(v * c["alpha"])); tile.putalpha(a)
            im.alpha_composite(tile, (int(c["x"]), int(c["y"])))
        elif c["kind"] == "rect":
            col = c.get("color") or 0; al = int(255 * (c.get("alpha") or 1))
            ov = Image.new("RGBA", (16, 16), ((col >> 16) & 255, (col >> 8) & 255, col & 255, al))
            im.alpha_composite(ov, (int(c["x"]), int(c["y"])))
        else:
            s = sprite(c["texture"]); f = int(c["frame"] or 0)
            fr = s.crop((f * 16, 0, f * 16 + 16, 16))
            im.alpha_composite(fr, (int(c["x"]) - 8, int(c["y"]) - 8))
    crop = im.crop((2 * 16, 3 * 16, 12 * 16, 11 * 16))
    lab = Image.new("RGBA", (crop.width, crop.height + 12), (24, 24, 28, 255)); lab.paste(crop, (0, 12))
    ImageDraw.Draw(lab).text((2, 0), name, fill=(230, 230, 230, 255))
    panels.append(lab)
W = sum(p.width for p in panels) + 6 * (len(panels) - 1)
out = Image.new("RGBA", (W, panels[0].height), (24, 24, 28, 255)); x = 0
for p in panels: out.paste(p, (x, 0)); x += p.width + 6
out.save(d / "runtime-steps.png")
print(d / "runtime-steps.png", out.size)
