"""object-gate 3/4 판정자에게 주는 「맞는/틀린 모양」 안내 그림 — 코드로 그린 합성 도형(보정 표본과 겹치지 않는다).

    python3 src/harnesses/object-gate/tools/build_view34_guide.py   → harness-data/object-gate/view34-guide.png

각 칸은 16px 폭 물건을 6배로 그린 것. 위쪽 초록 띠 = 맞는 모양, 빨간 띠 = 틀린 모양.
계약 원문: tiledata/atlas-pick/modern-style-bible.md §10·§11 (윗면 T 4~6행 + 앞 가장자리 하이라이트 1행 + 처마 그림자 2행 + 들어간 앞면).
"""
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[4] / "harness-data" / "object-gate" / "view34-guide.png"
TOP, EDGE, SHADE, FRONT, FRONT2, DARK, LEG = (214, 170, 118), (240, 205, 150), (92, 56, 40), (150, 96, 64), (118, 74, 50), (52, 32, 26), (80, 50, 36)


def px(img, x, y, c):
    img.putpixel((x, y), c + (255,))


def box(w, h, top_rows, edge=True, shade=True, panel=True):
    """w×h 상자형 가구. top_rows 행 윗면 → 하이라이트 1행 → 처마 그림자 2행 → 앞면."""
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    y = 0
    for _ in range(top_rows):
        for x in range(w): px(img, x, y, TOP)
        y += 1
    if edge:
        for x in range(w): px(img, x, y, EDGE)
        y += 1
    if shade:
        for _ in range(2):
            for x in range(w): px(img, x, y, SHADE)
            y += 1
    while y < h:
        for x in range(w): px(img, x, y, FRONT)
        y += 1
    if panel:  # 들어간 문짝 두 장
        for (x0, x1) in ((2, w // 2 - 1), (w // 2 + 1, w - 3)):
            for yy in range(top_rows + (1 if edge else 0) + (2 if shade else 0) + 2, h - 3):
                for x in range(x0, x1):
                    px(img, x, yy, DARK if (yy == top_rows + (1 if edge else 0) + (2 if shade else 0) + 2 or x == x0) else FRONT2)
    for x in (0, w - 1):
        for yy in range(h): px(img, x, yy, DARK)
    for x in range(w): px(img, x, h - 1, DARK)
    return img


def column(w, h, ellipse):
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    stone, stone_l, stone_d = (170, 170, 180), (214, 214, 224), (110, 110, 124)
    d.rectangle((2, 5 if ellipse else 1, w - 3, h - 1), fill=stone)
    d.rectangle((w - 5, 5 if ellipse else 1, w - 3, h - 1), fill=stone_d)
    if ellipse:
        d.ellipse((1, 0, w - 2, 8), fill=stone_l, outline=stone_d)
    else:
        d.rectangle((1, 0, w - 2, 2), fill=stone_l)
        d.rectangle((1, 3, w - 2, 3), fill=stone_d)
    return img


def seat(w, h, top_rows):
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rectangle((1, 0, w - 2, top_rows - 1), fill=TOP)
    d.rectangle((1, top_rows, w - 2, top_rows + 1), fill=EDGE if top_rows > 2 else FRONT)
    d.rectangle((1, top_rows + 2, w - 2, top_rows + 4), fill=FRONT2)
    d.rectangle((2, top_rows + 5, 4, h - 1), fill=LEG)
    d.rectangle((w - 5, top_rows + 5, w - 3, h - 1), fill=LEG)
    return img


def barrel(w, h, ellipse):
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rectangle((1, 5 if ellipse else 2, w - 2, h - 1), fill=FRONT)
    d.rectangle((w - 5, 5 if ellipse else 2, w - 2, h - 1), fill=FRONT2)
    d.rectangle((1, h // 2, w - 2, h // 2 + 1), fill=DARK)
    if ellipse:
        d.ellipse((0, 0, w - 1, 8), fill=DARK, outline=DARK)
        d.ellipse((2, 1, w - 3, 6), fill=TOP)
    else:
        d.rectangle((1, 0, w - 2, 1), fill=TOP)
    return img


def slab(w, h):  # 위에서 내려다본 판(앞면 없음)
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rectangle((1, 0, w - 2, h - 1), fill=TOP, outline=DARK)
    d.rectangle((3, 3, w - 4, h - 4), fill=EDGE)
    return img


def side_chair(w, h):  # 옆모습 의자(좌판 윗면 없음)
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rectangle((1, 0, 4, h - 1), fill=FRONT)
    d.rectangle((1, h // 2, w - 2, h // 2 + 2), fill=FRONT)
    d.rectangle((w - 4, h // 2 + 3, w - 2, h - 1), fill=LEG)
    return img


CELLS = [
    ("OK cabinet: top 5 + edge + eave", box(16, 32, 5), True),
    ("BAD front elevation: top 1", box(16, 32, 1, edge=False, shade=False), False),
    ("BAD rim only: top 2", box(16, 32, 2, edge=False), False),
    ("OK column: ellipse cap 5", column(16, 36, True), True),
    ("BAD column: flat band cap", column(16, 36, False), False),
    ("OK seat: top 5 + legs", seat(16, 22, 5), True),
    ("BAD seat: band 2", seat(16, 22, 2), False),
    ("OK barrel: ellipse top", barrel(16, 24, True), True),
    ("BAD barrel: lid 2px", barrel(16, 24, False), False),
    ("BAD top-down slab (no front)", slab(16, 30), False),
    ("BAD side elevation chair", side_chair(16, 24), False),
]


def main() -> None:
    S, pad, labh = 6, 10, 46
    cw = 16 * S + pad
    cols = 6
    rows = (len(CELLS) + cols - 1) // cols
    ch = 36 * S + labh + pad
    sheet = Image.new("RGBA", (cols * cw + pad, rows * ch + pad), (70, 72, 82, 255))
    d = ImageDraw.Draw(sheet)
    for i, (label, img, ok) in enumerate(CELLS):
        x, y = pad + (i % cols) * cw, pad + (i // cols) * ch
        d.rectangle((x - 2, y - 2, x + 16 * S + 2, y + 36 * S + 2), outline=(60, 170, 80) if ok else (200, 70, 70), width=3)
        big = img.resize((img.width * S, img.height * S), Image.NEAREST)
        sheet.alpha_composite(big, (x, y + 36 * S - big.height))
        words = label.split(" ", 1)
        d.text((x, y + 36 * S + 6), words[0], fill=(120, 230, 140) if ok else (240, 120, 120))
        d.text((x, y + 36 * S + 20), words[1][:20], fill=(255, 255, 255))
        d.text((x, y + 36 * S + 32), words[1][20:40], fill=(255, 255, 255))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT)
    print(OUT, sheet.size)


if __name__ == "__main__":
    main()
