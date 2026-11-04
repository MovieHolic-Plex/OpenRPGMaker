#!/usr/bin/env python3
"""배포용 앱 아이콘을 만든다 — 편집기 상단바·목업과 같은 「검은 둥근 사각형 + 흰 O」 표시(2026-11 오너 결정).

옛 도트 검 원본(design/app-icon/oprn-icon-sword.png)은 지우지 않고 남겨 둔다(되돌리기용). 아래 원래 설명은 그 시절 것이다.

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
# 표시 색: 상단바 라이트 테마의 --text-1(거의 검정) 위에 흰 글자.
MARK_BG = (24, 24, 27, 255)
MARK_FG = (255, 255, 255, 255)
MARK_EDGE = (82, 82, 91, 255)


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


def mark(size: int, inset_ratio: float = 0.0, radius_ratio: float = 0.2222) -> Image.Image:
    """편집기 상단바·목업과 같은 표시: 검은 둥근 사각형 안에 흰 「O」.

    「O」는 글꼴 대신 고리 두 타원으로 그린다 — 어느 기계에서 돌려도 같은 모양이고 16px 에서도 뭉개지지 않는다.
    상단바 표시(18px, 모서리 5px, 글자 10px 굵게)의 비율을 그대로 키운다: 모서리 5/18, 글자 높이 약 0.42, 획 약 0.09.
    inset_ratio 는 판 바깥 투명 여백(맥 격자 100/1024)이다.
    """
    scale = 8
    big = size * scale
    out = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(out)
    inset = round(big * inset_ratio)
    side = big - 2 * inset
    radius = round(side * radius_ratio)
    # 어두운 작업표시줄·다크 바탕에서 판이 묻히지 않게 옅은 테두리를 두른다(판 너비의 약 3%).
    edge = max(scale, round(side * 0.03))
    d.rounded_rectangle((inset, inset, big - 1 - inset, big - 1 - inset), radius=radius, fill=MARK_EDGE)
    d.rounded_rectangle((inset + edge, inset + edge, big - 1 - inset - edge, big - 1 - inset - edge), radius=max(0, radius - edge), fill=MARK_BG)
    cx = cy = big / 2
    oh = side * 0.46          # 「O」 바깥 높이
    ow = oh * 0.86            # 바깥 너비(굵은 산세리프 O 의 세로가 약간 길다)
    stroke = side * 0.105
    d.ellipse((cx - ow / 2, cy - oh / 2, cx + ow / 2, cy + oh / 2), fill=MARK_FG)
    iw, ih = ow - 2 * stroke, oh - 2 * stroke
    d.ellipse((cx - iw / 2, cy - ih / 2, cx + iw / 2, cy + ih / 2), fill=MARK_BG)
    return out.resize((size, size), Image.LANCZOS)


def main() -> None:
    icons = ROOT / "public/icons"
    build = ROOT / "build"
    build.mkdir(exist_ok=True)
    outputs = {
        # 작은 크기는 판을 가장자리까지 채운다 — 탭·작업표시줄에서는 여백이 곧 손해다.
        icons / "favicon-32.png": mark(32),
        icons / "pwa-192.png": mark(192),
        icons / "pwa-512.png": mark(512),
        # 마스커블: 런처가 모양대로 자르므로 둥근 모서리 없이 가장자리까지 채운다(안전 영역 80% 안에 「O」).
        icons / "pwa-maskable-512.png": mark(512, radius_ratio=0.0),
        # 윈도우 ico·리눅스 png. 작업표시줄에서 다른 앱 아이콘과 크기가 맞게 약간 여백을 둔다.
        build / "icon.png": mark(1024, inset_ratio=0.04),
        # 맥 icns: macOS 격자(824/1024 안쪽, 모서리 185/824)에 맞춘다.
        build / "icon-mac.png": mark(1024, inset_ratio=100 / 1024, radius_ratio=185 / 824),
    }
    for path, img in outputs.items():
        img.save(path, optimize=True)
        print(f"{path.relative_to(ROOT)} {img.width}x{img.height}")


if __name__ == "__main__":
    main()

