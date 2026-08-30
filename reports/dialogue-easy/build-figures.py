#!/usr/bin/env python3
"""쉬운 말 보고서에 실을 **가공 그림**을 만든다.

원본 사진은 `test/e2e/_dialogue-easy-report-shots.spec.ts` 가 shots/ 에 찍는다.
이 스크립트는 그 사진에서 두 장을 만들고, 본문에 인용한 숫자를 같이 찍어 낸다.

    npx playwright test test/e2e/_dialogue-easy-report-shots.spec.ts
    python3 reports/dialogue-easy/build-figures.py

숫자가 달라지면 index.html 의 해당 문장도 같이 고쳐야 한다. 그래서 그냥 만들지 않고
쓰인 값을 전부 표준출력에 남긴다.
"""

from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

SHOTS = Path(__file__).parent / "shots"


def overshoot_band() -> None:
    """진입 프레임이 제자리보다 더 큰 만큼을 빨간 띠로 칠하고, 같은 자리를 5배로 덧붙인다.

    두 사진을 나란히 놓으면 11px 차이는 눈에 안 잡힌다. 차이를 **칠해야** 보인다.
    """
    enter = Image.open(SHOTS / "enter-1neutral-crop.png").convert("RGB")
    settled = Image.open(SHOTS / "settled-1neutral-crop.png").convert("RGB")
    w, he, hs = enter.width, enter.height, settled.height
    diff = he - hs
    if diff <= 0:
        raise SystemExit(f"진입 프레임이 제자리보다 크지 않다(진입 {he}, 제자리 {hs}) — 얼음이 안 걸렸다")

    pad, gap, zoom, zw = 26, 26, 5, 150
    zoom_w, zoom_h = zw * zoom, (diff + 16) * zoom
    canvas = Image.new("RGB", (w + pad * 2, pad + he + gap + hs + gap + zoom_h + pad), (255, 255, 255))
    canvas.paste(enter, (pad, pad))
    canvas.paste(settled, (pad, pad + he + gap))

    def paint_band(x: int, y: int, width: int, height: int) -> None:
        strip = canvas.crop((x, y, x + width, y + height))
        wash = Image.new("RGB", (width, height), (220, 60, 48))
        canvas.paste(Image.blend(strip, wash, 0.45), (x, y))

    draw = ImageDraw.Draw(canvas)
    band_top = pad + hs
    paint_band(pad, band_top, w, diff)
    draw.rectangle([pad, band_top, pad + w - 1, band_top + diff - 1], outline=(180, 30, 20), width=1)

    zy0 = hs - 8
    zx, zy = pad, pad + he + gap + hs + gap
    canvas.paste(enter.crop((0, zy0, zw, zy0 + diff + 16)).resize((zoom_w, zoom_h), Image.NEAREST), (zx, zy))
    paint_band(zx, zy + 8 * zoom, zoom_w, diff * zoom)
    draw.rectangle([zx, zy, zx + zoom_w - 1, zy + zoom_h - 1], outline=(120, 130, 150), width=1)
    draw.rectangle([zx, zy + 8 * zoom, zx + zoom_w - 1, zy + 8 * zoom + diff * zoom - 1], outline=(180, 30, 20), width=2)

    canvas.save(SHOTS / "overshoot-compare.png")
    print(f"overshoot-compare.png — 진입 {he}px, 제자리 {hs}px, 띠 {diff}px, 확대 {zoom}배")


def scrim_difference() -> None:
    """창이 있을 때와 없을 때의 배경 밝기 차이를 6배로 부풀린 그림 + 위/중간/아래 밝기 표."""
    plain = Image.open(SHOTS / "no-dialogue-play.png").convert("RGB")
    withbox = Image.open(SHOTS / "settled-1neutral-play.png").convert("RGB")
    if plain.size != withbox.size:
        raise SystemExit(f"두 사진 크기가 다르다: {plain.size} vs {withbox.size}")

    gain = 10
    diff = ImageChops.difference(plain, withbox).point(lambda v: min(255, v * gain))
    diff.save(SHOTS / "scrim-difference-x10.png")
    print(f"scrim-difference-x10.png — {diff.size[0]}x{diff.size[1]}, {gain}배로 부풀림")

    # 밝기를 재는 자리는 **창이 가리지 않은 지도**여야 한다. 창이 덮은 자리를 같이 재면
    # "스크림이 어둡게 했다" 가 아니라 "창이 가렸다" 를 재게 된다(실측: 그렇게 재면 -57.9%
    # 가 나오는데 그건 지도가 아니라 나무 액자 색이다).
    covered = ImageChops.difference(plain, withbox).convert("L").point(lambda v: 255 if v > 40 else 0).getbbox()
    if not covered:
        raise SystemExit("두 사진에 차이가 없다 — 스크림이 안 걸렸다")
    w, h = plain.size
    box_top = covered[1]
    span = box_top
    print(f"  (잰 자리: 창 위쪽 지도 세로 0~{box_top - 1}, 창 윗변은 {box_top})")

    # 어둠이 0 이 되는 자리를 사진에서 직접 찾는다. CSS 는 "아래에서 56%" 라고 적혀 있으니
    # 위에서 44% 줄쯤에서 차이가 사라져야 한다 — 맞는지 재서 확인한다.
    rows = []
    for y in range(box_top):
        hist = ImageChops.difference(plain, withbox).convert("L").crop((0, y, w, y + 1)).histogram()
        rows.append(sum(i * n for i, n in enumerate(hist)) / sum(hist))
    zero_at = next(y for y in range(box_top - 1, -1, -1) if rows[y] < 0.05)
    print(f"  어둠이 사라지는 줄: 위에서 {zero_at}px = 화면 높이의 {zero_at / h * 100:.0f}%"
          f" (= 아래에서 {(h - zero_at) / h * 100:.0f}%; CSS 는 56%)")
    print(f"  창 윗변 바로 위 밝기차: {rows[box_top - 1]:.1f}/255")

    bands = (("위쪽 (창에서 가장 먼 곳)", 0.02, 0.22), ("가운데", 0.40, 0.60), ("아래쪽 (창 바로 위)", 0.78, 0.98))
    for name, top, bottom in bands:
        crop = (0, int(span * top), w, int(span * bottom))

        def mean(image: Image.Image) -> float:
            hist = image.convert("L").crop(crop).histogram()
            return sum(i * n for i, n in enumerate(hist)) / sum(hist)

        before, after = mean(plain), mean(withbox)
        drop = (after - before) / before * 100
        print(f"  {name}: 창 없을 때 {before:.1f} → 창 있을 때 {after:.1f} ({drop:+.1f}%)")


def flash_brightness() -> None:
    """놀람의 번쩍임이 지도를 얼마나 밝히는지 잰다 — 같은 대사의 안 번쩍이는 프레임과 비교한다."""
    flash = Image.open(SHOTS / "flash-play.png").convert("RGB")
    base = Image.open(SHOTS / "flash-baseline-play.png").convert("RGB")
    if flash.size != base.size:
        raise SystemExit(f"두 사진 크기가 다르다: {flash.size} vs {base.size}")
    w, h = flash.size
    covered = ImageChops.difference(
        Image.open(SHOTS / "no-dialogue-play.png").convert("RGB"), base
    ).convert("L").point(lambda v: 255 if v > 40 else 0).getbbox()
    crop = (0, 0, w, covered[1])

    def mean(image: Image.Image) -> float:
        hist = image.convert("L").crop(crop).histogram()
        return sum(i * n for i, n in enumerate(hist)) / sum(hist)

    before, after = mean(base), mean(flash)
    print(f"flash — 창 위쪽 지도 평균: 안 번쩍일 때 {before:.1f} → 번쩍일 때 {after:.1f} ({(after / before - 1) * 100:+.1f}%)")


if __name__ == "__main__":
    overshoot_band()
    scrim_difference()
    flash_brightness()
