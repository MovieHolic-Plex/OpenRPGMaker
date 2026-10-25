#!/usr/bin/env python3
"""아스트라 호라이즌 인트로·타이틀의 밤 풀밭 층 — 새 화소 없음.

이미 고른 타이틀 그림(public/assets/emerald-monster/title-meadow.png, 240×160)에서
1) 하늘(위 가장자리에서 이어진 하늘·구름 색)만 투명하게 오려 내고
2) 남은 땅을 달빛 밤 색으로 다시 칠한다(색마다 같은 식, 도트 배치 그대로).
뒤에는 OPRN 밤하늘 파노라마를 깐다(엔진 층).

  python3 scripts/content/astra/astra-night-cutouts.py

출력: public/assets/emerald-monster/astra/meadow-night.png (240×160)
      public/assets/emerald-monster/astra/title-night.png  (320×240 = 2배 확대 뒤 가운데 아래 창)
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / "public/assets/emerald-monster/title-meadow.png"
OUT = ROOT / "public/assets/emerald-monster/astra"
# 하늘 그라데이션·구름(흰·연청·구름 그늘)·지평선 아지랑이 점무늬(226,244,242).
SKY = {(90, 168, 232), (120, 188, 240), (152, 208, 244), (191, 228, 246), (255, 255, 255), (232, 242, 250), (184, 210, 234), (226, 244, 242)}


def night(rgb: tuple[int, int, int]) -> tuple[int, int, int]:
    r, g, b = rgb
    # 달빛: 밝기는 살리고 붉은 기를 눌러 푸른 밤으로. 밝은 색(길·지붕)은 조금 덜 누른다.
    lum = 0.3 * r + 0.59 * g + 0.11 * b
    k = 0.42 + 0.18 * (lum / 255)
    return (int(r * k * 0.62 + 6), int(g * k * 0.78 + 10), int(min(255, b * k * 1.05 + 34)))


def main() -> None:
    image = Image.open(SRC).convert("RGBA")
    w, h = image.size
    px = image.load()
    sky = set()
    stack = [(x, 0) for x in range(w)]
    while stack:
        x, y = stack.pop()
        if (x, y) in sky or not (0 <= x < w and 0 <= y < h) or px[x, y][:3] not in SKY:
            continue
        sky.add((x, y))
        stack.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    out = Image.new("RGBA", (w, h))
    po = out.load()
    for y in range(h):
        for x in range(w):
            po[x, y] = (0, 0, 0, 0) if (x, y) in sky else (*night(px[x, y][:3]), 255)
    OUT.mkdir(parents=True, exist_ok=True)
    out.save(OUT / "meadow-night.png")
    big = out.resize((w * 2, h * 2), Image.NEAREST)
    big.crop((80, 30, 400, 270)).save(OUT / "title-night.png")
    print(f"sky cut {len(sky)} px of {w * h}")


if __name__ == "__main__":
    main()
