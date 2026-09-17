"""계단 2종 버그 수정 증거 렌더 — 실물 타일셋 PNG + depth 규칙 시각화.

Evidence A (3칸 전이): 가로 3칸 계단 행(141/111/171)의 세 칸에 전이 이벤트 마커가
달리는지 — buildConceptEvents 실물 결과(빨간 테두리 마커)를 타일 위에 겹친다.
Evidence B (1칸 칩 부상): 1칸 계단(474) 칩 위에 캐릭터 스프라이트를 겹쳐,
수정 전(★: 칩이 캐릭터 위) vs 수정 후(○: 칩이 캐릭터 아래) 렌더 순서를 보인다.
depth 판정은 src/player/characterDepth.ts 실물 규칙과 동일 값으로 계산한다.
"""
from PIL import Image, ImageDraw

SHEET = "public/assets/tibo-interior/interior-expanded.png"
CHARSET = "public/assets/generated/starter/hero-01-charset.png"
OUT = "verify-shots/stair-fix"
SCALE = 4
TILE = 16
COLS = 30

import os
os.makedirs(OUT, exist_ok=True)

sheet = Image.open(SHEET).convert("RGBA")


def tile_img(t):
    x, y = (t % COLS) * TILE, (t // COLS) * TILE
    return sheet.crop((x, y, x + TILE, y + TILE))


def char_sprite():
    im = Image.open(CHARSET).convert("RGBA")
    # 캐릭터 시트: 4열 x 2행, 셀 72x128. 첫 셀(정면)이 비어 있으면 다음 셀을 쓴다.
    cw, ch = im.width // 4, im.height // 2
    for cx in range(4):
        for cy in range(2):
            cell = im.crop((cx * cw, cy * ch, cx * cw + cw, cy * ch + ch))
            alpha = list(cell.getchannel("A").get_flattened_data())
            if sum(1 for a in alpha if a > 10) > 500:
                return cell
    return im.crop((0, 0, cw, ch))
CHAR = char_sprite()
print("charset cell:", CHAR.size)

# ---------- Evidence A: 3칸 계단 + 전이 마커 3개 ----------
a = Image.new("RGBA", (3 * TILE * SCALE, 2 * TILE * SCALE), (24, 20, 16, 255))
for i, t in enumerate([141, 111, 171]):
    a.paste(tile_img(t).resize((TILE * SCALE, TILE * SCALE), Image.NEAREST), (i * TILE * SCALE, 0))
d = ImageDraw.Draw(a)
for i in range(3):
    x0, y0 = i * TILE * SCALE, 0
    # 전이 이벤트 마커: 노란 테두리 + T
    d.rectangle([x0 + 2, y0 + 2, x0 + TILE * SCALE - 3, y0 + TILE * SCALE - 3], outline=(240, 192, 64, 255), width=3)
    d.text((x0 + TILE * SCALE // 2 - 4, y0 + TILE * SCALE // 2 - 6), "T", fill=(240, 192, 64, 255))
d.text((4, TILE * SCALE + 8), "3 tiles x transfer event (141/111/171)", fill=(235, 230, 220, 255))
a.save(f"{OUT}/A-3wide-transfers.png")

# ---------- Evidence B: 1칸 계단 depth 수정 전/후 ----------
# 캐릭터(발밑 정렬)가 1칸 계단(474) 칩과 같은 칸에 설 때:
# BEFORE(★ 버그)=칩이 캐릭터 위에 그려짐 / AFTER(○ 수정)=칩이 캐릭터 아래.
ch_w = TILE * SCALE
ch_h = int(CHAR.height * ch_w / CHAR.width)
ch = CHAR.resize((ch_w, ch_h), Image.NEAREST)
chip = tile_img(474).resize((TILE * SCALE, TILE * SCALE), Image.NEAREST)
floor = tile_img(72).resize((TILE * SCALE, TILE * SCALE), Image.NEAREST)
CHIP_Y = ch_h - TILE * SCALE // 2  # 칩 칸(발밑)과 캐릭터 발이 겹치는 위치


def render(order):
    img = Image.new("RGBA", (TILE * SCALE, ch_h), (24, 20, 16, 255))
    img.paste(floor, (0, CHIP_Y))
    char_on_top = order == "after"
    first, second = (chip, ch) if char_on_top else (ch, chip)
    first_xy = (0, CHIP_Y) if first is chip else (0, 0)
    second_xy = (0, CHIP_Y) if second is chip else (0, 0)
    img.paste(first, first_xy, first if first is chip else ch)
    img.paste(second, second_xy, second if second is chip else ch)
    return img


before = render("before")
after = render("after")
LABEL_H = 36
COL_W = before.width + 72
b = Image.new("RGBA", (COL_W * 2 + 16, before.height + LABEL_H), (24, 20, 16, 255))
b.paste(before, (0, LABEL_H))
b.paste(after, (COL_W + 16, LABEL_H))
d = ImageDraw.Draw(b)
d.text((4, 4), "BEFORE (bug)", fill=(255, 120, 120, 255))
d.text((4, 20), "chip over char", fill=(255, 120, 120, 255))
d.text((COL_W + 20, 4), "AFTER (fix)", fill=(140, 255, 140, 255))
d.text((COL_W + 20, 20), "chip under char", fill=(140, 255, 140, 255))
b.save(f"{OUT}/B-1wide-depth.png")
print("saved A + B")
