#!/usr/bin/env python3
"""설린 전투 시트 — 은발 여검사 48px 포즈 시트를 걷기 칩에 맞춘다.

원본은 charset-battler 파이프라인이 찍은 silver-swordswoman.png (3열×8행, 칸 48px).
포즈·크기·외곽은 그대로 두고, 눈 높이에 청록 바이저 한 줄을 넣고 붉은 목도리를 남색 깃으로 바꾼다.
생성 그림 없음. 사용: python3 scripts/asset-gen/charset-battler/derive_seolrin.py
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / "public/assets/generated/charset-battlers/silver-swordswoman.png"
OUT = ROOT / "public/assets/generated/charset-battlers/il-seolrin.png"
CELL = 48
VISOR = (72, 244, 224, 255)
VISOR_D = (16, 96, 108, 255)
NAVY = (32, 40, 72, 255)
SEAM = (150, 255, 232, 255)


def skin(r, g, b):
    return r > 170 and g > 120 and b > 90 and r > b and abs(r - g) < 80


def scarf(r, g, b):
    return r > 120 and g < 110 and b < 120 and r > g + 30 and r > b + 20


def main():
    im = Image.open(SRC).convert("RGBA")
    px = im.load()
    cols, rows = im.width // CELL, im.height // CELL
    for row in range(rows):
        for col in range(cols):
            ox, oy = col * CELL, row * CELL
            opaque = [(x, y) for y in range(oy, oy + CELL) for x in range(ox, ox + CELL) if px[x, y][3] > 200]
            if len(opaque) < 30:
                continue
            top = min(y for _, y in opaque)
            bot = max(y for _, y in opaque)
            left = min(x for x, _ in opaque)
            right = max(x for x, _ in opaque)
            eye = top + max(2, (bot - top) // 7)
            for x, y in opaque:
                r, g, b, a = px[x, y]
                if scarf(r, g, b):
                    px[x, y] = NAVY if (x + y) % 5 else SEAM
            for x in range(left + 1, right):
                if px[x, eye][3] > 200 and skin(*px[x, eye][:3]):
                    px[x, eye] = VISOR
                    if eye + 1 < oy + CELL and px[x, eye + 1][3] > 200:
                        px[x, eye + 1] = VISOR_D
    OUT.parent.mkdir(parents=True, exist_ok=True)
    im.save(OUT)
    print(OUT, im.size)


if __name__ == "__main__":
    main()
