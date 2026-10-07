#!/usr/bin/env python3
"""2묶음 실내 예제 대조 시트 — 관문(--stage interior-shop)이 보는 그림.
maps/interior.mjs 가 만든 verify-shots/jp-city/interior-<이름>-x2.png(도구가 실제로 지은 맵)를 묶어
verify-shots/jp-city/interior2/sheet1~4.png 로 쓴다. 이름표 = 예제 파일 이름.
  python3 scripts/content/jp-city/qa/interior-sheets.py
"""
import os
from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../..'))
SRC = os.path.join(ROOT, 'verify-shots/jp-city')
OUT = os.path.join(SRC, 'interior2')
SHEETS = [
    ['konbini', 'supermarket', 'ramen', 'izakaya', 'sushi', 'kissaten'],
    ['bakery', 'bookstore', 'pharmacy', 'florist', 'yaoya', 'barber'],
    ['sento', 'laundry', 'koban', 'clinic'],
    ['mansion-2ldk', 'mokuchin', 'hiraya'],
]
COLS, GAP, LAB = 3, 12, 16


def sheet(names, out):
    ims = [Image.open(os.path.join(SRC, f'interior-{n}-x2.png')).convert('RGB') for n in names]
    rows = [ims[i:i + COLS] for i in range(0, len(ims), COLS)]
    rh = [max(i.height for i in r) + LAB for r in rows]
    W = max(sum(i.width for i in r) + GAP * (len(r) - 1) for r in rows)
    m = Image.new('RGB', (W, sum(rh) + GAP * (len(rows) - 1)), (30, 30, 34))
    d = ImageDraw.Draw(m)
    y, k = 0, 0
    for r, h in zip(rows, rh):
        x = 0
        for im in r:
            d.text((x + 2, y + 2), names[k], fill=(235, 235, 200))
            m.paste(im, (x, y + LAB))
            x += im.width + GAP
            k += 1
        y += h + GAP
    m.save(out)
    print(out, m.size)


os.makedirs(OUT, exist_ok=True)
for i, names in enumerate(SHEETS, 1):
    sheet(names, os.path.join(OUT, f'sheet{i}.png'))
