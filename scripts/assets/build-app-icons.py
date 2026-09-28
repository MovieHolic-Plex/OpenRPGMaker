#!/usr/bin/env python3
"""앱 아이콘 원본(design/app-icon/*.png)에서 배포용 아이콘 파일을 만든다.

    python3 scripts/assets/build-app-icons.py            # 기본안: 메시지 창 + 검과 깃펜
    python3 scripts/assets/build-app-icons.py --backup   # 백업안: 떠 있는 맵 조각

원본은 이미지 생성 모델이 뽑은 1254px 그림이라 둥근 사각형 바깥에 옅은 파란 번짐이 있다.
그 번짐은 밝은 바탕(독, 탐색기)에서 얼룩으로 보이므로 둥근 사각형 마스크로 잘라낸다.

만드는 파일
- public/icons/pwa-192.png, pwa-512.png   웹 파비콘·PWA 설치 아이콘 (purpose: any)
- public/icons/pwa-maskable-512.png        안드로이드 마스커블. 가장자리까지 채우고 그림은 안전 영역(80%) 안
- public/icons/favicon-32.png              브라우저 탭용 작은 파비콘
- build/icon.png                           electron-builder 가 ico/icns 를 만드는 1024px 원본
"""
import argparse
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
SOURCES = {
    "primary": ROOT / "design/app-icon/oprn-icon-sword-quill.png",
    "backup": ROOT / "design/app-icon/oprn-icon-map-cube.png",
}


def plate_bbox(img: Image.Image) -> tuple[int, int, int, int]:
    """번짐을 뺀 둥근 사각형 판의 경계. 불투명도 200 이상만 판으로 본다."""
    alpha = img.getchannel("A").point(lambda v: 255 if v >= 200 else 0)
    box = alpha.getbbox()
    if box is None:
        raise SystemExit("원본에서 불투명한 판을 찾지 못했다")
    return box


def squircle_mask(size: int, radius_ratio: float = 0.225) -> Image.Image:
    """4배로 그린 뒤 줄여 가장자리를 부드럽게 한 둥근 사각형 마스크."""
    scale = 4
    big = Image.new("L", (size * scale, size * scale), 0)
    ImageDraw.Draw(big).rounded_rectangle(
        (0, 0, size * scale - 1, size * scale - 1), radius=int(size * scale * radius_ratio), fill=255
    )
    return big.resize((size, size), Image.LANCZOS)


def clean_plate(src: Image.Image) -> Image.Image:
    """판만 정사각형으로 잘라 번짐을 지운 1024px 그림."""
    left, top, right, bottom = plate_bbox(src)
    side = max(right - left, bottom - top)
    cx, cy = (left + right) / 2, (top + bottom) / 2
    box = tuple(int(round(v)) for v in (cx - side / 2, cy - side / 2, cx + side / 2, cy + side / 2))
    plate = src.crop(box).resize((1024, 1024), Image.LANCZOS)
    mask = squircle_mask(1024)
    # 판 안쪽은 불투명하게, 바깥 번짐은 마스크로 지운다.
    plate.putalpha(mask)
    return plate


def with_margin(plate: Image.Image, size: int, content_ratio: float) -> Image.Image:
    """투명 캔버스 가운데에 판을 content_ratio 크기로 놓는다(데스크톱 아이콘 여백)."""
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    inner = int(round(size * content_ratio))
    art = plate.resize((inner, inner), Image.LANCZOS)
    offset = (size - inner) // 2
    canvas.alpha_composite(art, (offset, offset))
    return canvas


def maskable(plate: Image.Image, size: int = 512) -> Image.Image:
    """가장자리까지 판의 어두운 아래쪽 테두리 색으로 채우고, 판 전체를 안전 영역 80% 안에 둔다."""
    edge = plate.convert("RGB").getpixel((plate.width // 2, int(plate.height * 0.975)))
    canvas = Image.new("RGBA", (size, size), edge + (255,))
    inner = int(size * 0.8)
    art = plate.resize((inner, inner), Image.LANCZOS)
    canvas.alpha_composite(art, ((size - inner) // 2, (size - inner) // 2))
    return canvas


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--backup", action="store_true", help="백업안(맵 조각)으로 만든다")
    args = parser.parse_args()

    variant = "backup" if args.backup else "primary"
    plate = clean_plate(Image.open(SOURCES[variant]).convert("RGBA"))

    icons = ROOT / "public/icons"
    build = ROOT / "build"
    build.mkdir(exist_ok=True)
    outputs = {
        # 브라우저 탭·PWA 는 여백 없이 판을 꽉 채워야 작게 봐도 읽힌다.
        icons / "favicon-32.png": plate.resize((32, 32), Image.LANCZOS),
        icons / "pwa-192.png": plate.resize((192, 192), Image.LANCZOS),
        icons / "pwa-512.png": plate.resize((512, 512), Image.LANCZOS),
        icons / "pwa-maskable-512.png": maskable(plate),
        # macOS 독 아이콘 격자(1024 안에 약 824)에 맞춘 여백.
        build / "icon.png": with_margin(plate, 1024, 0.805),
    }
    for path, img in outputs.items():
        img.save(path, optimize=True)
        print(f"{variant}: {path.relative_to(ROOT)} {img.width}x{img.height}")


if __name__ == "__main__":
    main()

