"""『첫사랑』 홈 카드 표지 — 타이틀 그림 위에 제목을 크게 다시 쓴다.

왜: 타이틀 화면 캡처는 메뉴 상자가 끼고 제목이 작아, 홈 카드 크기에서 제목이 약하다(첫사랑 VQA 5차).
그림은 앱에 든 타이틀 그림(romance-office.jpg), 글꼴은 Noto Sans CJK(시스템). 사람·캐릭터를 새로 그리지 않는다.
두 번째 컷은 오프닝 첫 컷(교복의 두 사람) 캡처를 쓴다: HOME_SHOTS_FIRSTLOVE_OPENING=<런타임 QA 샷 디렉터리>/02-opening-1.png
"""
import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public/assets/start/builtin"
W, H = 960, 540


def cover() -> Image.Image:
    art = Image.open(ROOT / "public/assets/generated/title/romance-office.jpg").convert("RGB")
    s = max(W / art.width, H / art.height)
    a = art.resize((round(art.width * s), round(art.height * s)), Image.LANCZOS)
    ox, oy = (a.width - W) // 2, (a.height - H) // 2
    a = a.crop((ox, oy, ox + W, oy + H)).convert("RGBA")
    veil = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    vd = ImageDraw.Draw(veil)
    for x in range(W):
        vd.line([(x, 0), (x, H)], fill=(20, 12, 40, int(max(0, 1 - x / 560) ** 1.6 * 120)))
    a = Image.alpha_composite(a, veil)
    big = ImageFont.truetype("/usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc", 118, index=1)
    sub = ImageFont.truetype("/usr/share/fonts/opentype/noto/NotoSansCJK-Medium.ttc", 30, index=1)
    title, tag, x, y = "첫사랑", "10년 만에, 사수가 됐다", 70, 108
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(glow).text((x, y), title, font=big, fill=(140, 190, 255, 230))
    glow = glow.filter(ImageFilter.GaussianBlur(14))
    a = Image.alpha_composite(Image.alpha_composite(a, glow), glow)
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.text((x + 3, y + 5), title, font=big, fill=(10, 8, 30, 200))
    sd.text((x + 6, y + 177), tag, font=sub, fill=(10, 8, 30, 200))
    a = Image.alpha_composite(a, shadow.filter(ImageFilter.GaussianBlur(3)))
    d = ImageDraw.Draw(a)
    d.text((x, y), title, font=big, fill=(250, 252, 255, 255))
    d.text((x + 4, y + 174), tag, font=sub, fill=(246, 236, 255, 255))
    return a.convert("RGB")


def main() -> None:
    dest = OUT / "firstlove-title.webp"
    cover().resize((480, 270), Image.LANCZOS).save(dest, "WEBP", quality=92, method=6)
    print(dest.relative_to(ROOT), dest.stat().st_size // 1024, "KB")
    opening = os.environ.get("HOME_SHOTS_FIRSTLOVE_OPENING")
    if opening:
        op = OUT / "firstlove-op1.webp"
        Image.open(opening).convert("RGB").resize((480, 270), Image.LANCZOS).save(op, "WEBP", quality=92, method=6)
        print(op.relative_to(ROOT), op.stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()
