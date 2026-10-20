#!/usr/bin/env python3
"""첫 화면 컨셉 카드의 「무대」 그림 — 번들 칩셋 등록 장소 그림(public/assets/region-references)을 16:9 로 자른다.

컨셉 카드는 그 컨셉이 실제로 지어질 칩셋 화면을 크게 보여 준다(src/start/conceptFeed/stageArt.ts).
도트를 다시 그리지 않는다 — 원본 화소를 정수배로만 키우고(작은 실내) 자른다. 결과 480×270 PNG.
실행: python3 scripts/content/bake-home-stage-art.py
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "public/assets/region-references"
OUT = ROOT / "public/assets/start/stages"
W, H = 480, 270

# (출력 이름, 원본, 중심 x 비율, 중심 y 비율)
STAGES = [
    ("joseon-town", "joseon-v20.png", 0.5, 0.55),
    ("joseon-palace", "gungnae.png", 0.5, 0.6),
    ("joseon-field", "joseon-field.png", 0.45, 0.5),
    ("joseon-inn", "joseon-in-inn.png", 0.5, 0.5),
    ("jp-shopstreet", "jp-city-shopstreet.png", 0.5, 0.5),
    ("jp-town", "jp-city-town.png", 0.5, 0.5),
    ("jp-tram", "jp-city-tramstreet.png", 0.5, 0.5),
    ("jp-school", "jp-city-school.png", 0.5, 0.55),
    ("wz-library", "wz-space-library.png", 0.5, 0.5),
    ("wz-common", "wz-space-shared.png", 0.5, 0.5),
    ("wz-potions", "wz-space-potions.png", 0.5, 0.5),
    ("wz-greenhouse", "wz-space-greenhouse.png", 0.5, 0.5),
]

OUT.mkdir(parents=True, exist_ok=True)
for name, source, fx, fy in STAGES:
    im = Image.open(SRC / source).convert("RGB")
    scale = 1
    while im.width * scale < W or im.height * scale < H:
        scale += 1
    if scale > 1:
        im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
    cx, cy = int(im.width * fx), int(im.height * fy)
    left = max(0, min(im.width - W, cx - W // 2))
    top = max(0, min(im.height - H, cy - H // 2))
    im.crop((left, top, left + W, top + H)).save(OUT / f"{name}.png", optimize=True)
    print(name, source, "x%d" % scale, (OUT / f"{name}.png").stat().st_size // 1024, "KB")
