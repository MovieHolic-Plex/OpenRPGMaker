#!/usr/bin/env python3
"""방 견본 그림: rooms.mts 가 적은 층 배열(BD_LAYERS)과 구운 시트로 방을 그린다 — 조립기가 낸 칸 그대로(엔진과 같은 층 순서).
  BD_LAYERS=/tmp/x.json bun scripts/content/beodeul-interiors/rooms.mts --check && python3 scripts/content/beodeul-interiors/render.py /tmp/x.json <출력 폴더> [주인공.png]"""
import json, pathlib, sys
from PIL import Image
ROOT = pathlib.Path(__file__).resolve().parents[3]
T, COLS = 16, 128
def main(layers, out, hero=None):
    sheet = Image.open(ROOT / "public/assets/beodeul-city/beodeul-city-chipset.png").convert("RGBA")
    out = pathlib.Path(out); out.mkdir(parents=True, exist_ok=True)
    hero = Image.open(hero).convert("RGBA") if hero else None
    for rid, r in json.load(open(layers)).items():
        im = Image.new("RGBA", (r["w"] * T, r["h"] * T), (7, 21, 40, 255))
        for layer in r["layers"]:
            for i, t in enumerate(layer):
                if t is None or t < 0: continue
                im.alpha_composite(sheet.crop(((t % COLS) * T, (t // COLS) * T, (t % COLS) * T + T, (t // COLS) * T + T)), ((i % r["w"]) * T, (i // r["w"]) * T))
        if hero:   # 주인공은 문 위 둘째 칸에 세운다(크기 견줌)
            door = (r["w"] - 3) // 2 + 1
            im.alpha_composite(hero, (door * T - 4, (r["h"] - 3) * T - 16))
        im.save(out / f"{rid}.png")
    print("그림", len(list(out.glob("*.png"))))
if __name__ == "__main__": main(*sys.argv[1:])
