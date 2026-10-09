# 필수 QA 시트: compare-ref.png(배경 | 같은 장소 맵 렌더 크롭, 같은 1x 배율) · check-overlay.png(가짜 전투원 표식 겹침).
import os
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__))
VAR = os.path.abspath(os.path.join(HERE, '..'))
W, H = 640, 360
# 맵 렌더에서 같은 재질이 보이는 360×360 크롭(장소 폴더 render-1x.png, 읽기만)
CROP = {'sky-city': (330, 60), 'airship': (60, 20), 'time-rift': (140, 100), 'future-ruins': (780, 180),
        'machine-factory': (20, 0), 'final-tower': (1390, 0)}
ENEMY = [(140, 196), (214, 228), (150, 272)]
ALLY = [(392, 200), (432, 232), (470, 262), (506, 290)]


def compare_ref(slugs):
    rows = []
    for s in slugs:
        bg = Image.open(os.path.join(HERE, s + '.png')).convert('RGB')
        ref = Image.open(os.path.join(VAR, s, 'render-1x.png')).convert('RGB')
        x, y = CROP[s]; rc = ref.crop((x, y, x + 360, y + 360))
        row = Image.new('RGB', (W + 8 + 360, H + 14), (24, 24, 30)); d = ImageDraw.Draw(row)
        row.paste(bg, (0, 14)); row.paste(rc, (W + 8, 14))
        d.text((2, 1), f'{s}  battle-bg 640x360', fill=(255, 230, 120)); d.text((W + 10, 1), f'{s}/render-1x.png crop', fill=(160, 220, 255))
        rows.append(row)
    out = Image.new('RGB', (rows[0].width, sum(r.height for r in rows)), (24, 24, 30))
    y = 0
    for r in rows: out.paste(r, (0, y)); y += r.height
    out.save(os.path.join(HERE, 'compare-ref.png')); return out.size


def check_overlay(slugs):
    cols = 2; rows_ = (len(slugs) + 1) // 2
    out = Image.new('RGB', (cols * (W + 8), rows_ * (H + 14)), (24, 24, 30))
    for i, s in enumerate(slugs):
        bg = Image.open(os.path.join(HERE, s + '.png')).convert('RGBA')
        ov = Image.new('RGBA', bg.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
        d.rectangle((120, 190, 560, 330), outline=(255, 255, 255, 140))
        d.rectangle((0, H - 20, W, H), fill=(0, 0, 0, 120))
        for (x, y) in ENEMY: d.rectangle((x, y, x + 47, y + 47), fill=(230, 60, 60, 110), outline=(255, 120, 120, 230))
        for (x, y) in ALLY: d.rectangle((x, y, x + 47, y + 47), fill=(60, 120, 240, 110), outline=(140, 180, 255, 230))
        bg.alpha_composite(ov)
        cell = Image.new('RGB', (W + 8, H + 14), (24, 24, 30)); cell.paste(bg.convert('RGB'), (0, 14))
        ImageDraw.Draw(cell).text((2, 1), s, fill=(255, 230, 120))
        out.paste(cell, ((i % cols) * (W + 8), (i // cols) * (H + 14)))
    out.save(os.path.join(HERE, 'check-overlay.png')); return out.size
