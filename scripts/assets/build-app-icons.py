#!/usr/bin/env python3
"""앱 아이콘 원본(design/app-icon/oprn-icon-sword.png)에서 배포용 아이콘 파일을 만든다.

    python3 scripts/assets/build-app-icons.py

원본은 투명 배경의 도트 검 한 자루다. 판(배경) 없이 그림만 쓰는 게 기본이고,
배경이 꼭 있어야 하는 두 곳만 판을 깐다.

만드는 파일
- public/icons/favicon-32.png, pwa-192.png, pwa-512.png   투명 배경 (purpose: any)
- public/icons/pwa-maskable-512.png   안드로이드 마스커블. 런처가 모양대로 자르므로 가장자리까지 채운다
- build/icon.png                      윈도우 ico·리눅스 png 원본(1024px, 투명)
- build/icon-mac.png                  맥 icns 원본. macOS 26 은 둥근 사각형이 아닌 아이콘을 회색 판에
                                      줄여 넣으므로(이른바 icon jail) 맥만 판을 깐다
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "design/app-icon/oprn-icon-sword.png"
# RPG Maker 2000 메시지 창의 짙은 남색. 판을 깔아야 하는 곳에서만 쓴다.
PLATE_TOP = (52, 86, 214)
PLATE_BOTTOM = (20, 34, 132)


def fit(art: Image.Image, size: int, height_ratio: float) -> Image.Image:
    """투명 정사각 캔버스 가운데에 그림 높이를 size * height_ratio 로 맞춰 놓는다."""
    target_h = round(size * height_ratio)
    target_w = max(1, round(art.width * target_h / art.height))
    resample = Image.NEAREST if target_h >= art.height else Image.LANCZOS
    scaled = art.resize((target_w, target_h), resample)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(scaled, ((size - target_w) // 2, (size - target_h) // 2))
    return canvas


def plate(size: int, rounded: bool) -> Image.Image:
    """세로 그라데이션 판. rounded 면 맥 격자(824/1024)에 맞춘 둥근 사각형, 아니면 가장자리까지."""
    scale = 4
    big = size * scale
    grad = Image.new("RGB", (1, big))
    for y in range(big):
        t = y / (big - 1)
        grad.putpixel((0, y), tuple(round(a + (b - a) * t) for a, b in zip(PLATE_TOP, PLATE_BOTTOM)))
    grad = grad.resize((big, big))
    mask = Image.new("L", (big, big), 0 if rounded else 255)
    if rounded:
        inset = round(big * 100 / 1024)
        ImageDraw.Draw(mask).rounded_rectangle(
            (inset, inset, big - 1 - inset, big - 1 - inset), radius=round(big * 185 / 1024), fill=255
        )
    out = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    out.paste(grad, (0, 0), mask)
    return out.resize((size, size), Image.LANCZOS)


def on_plate(art: Image.Image, size: int, rounded: bool, height_ratio: float) -> Image.Image:
    base = plate(size, rounded)
    base.alpha_composite(fit(art, size, height_ratio))
    return base


def main() -> None:
    art = Image.open(SOURCE).convert("RGBA")
    art = art.crop(art.getbbox())
    icons = ROOT / "public/icons"
    build = ROOT / "build"
    build.mkdir(exist_ok=True)
    outputs = {
        # 탭·작업표시줄에서는 여백이 곧 손해다. 작은 크기일수록 꽉 채운다.
        icons / "favicon-32.png": fit(art, 32, 0.97),
        icons / "pwa-192.png": fit(art, 192, 0.9),
        icons / "pwa-512.png": fit(art, 512, 0.9),
        # 마스커블 안전 영역은 가운데 80% 원이다. 세로로 긴 검은 그 원의 지름 안쪽에 둔다.
        icons / "pwa-maskable-512.png": on_plate(art, 512, rounded=False, height_ratio=0.68),
        build / "icon.png": fit(art, 1024, 0.86),
        build / "icon-mac.png": on_plate(art, 1024, rounded=True, height_ratio=0.62),
    }
    for path, img in outputs.items():
        img.save(path, optimize=True)
        print(f"{path.relative_to(ROOT)} {img.width}x{img.height}")


if __name__ == "__main__":
    main()

