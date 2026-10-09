#!/usr/bin/env python3
"""시트(public/assets/jp-city/jp-city-chipset.png)에서 맵 JSON(lowerTiles·lowerOverlayTiles·upperTiles·upperOverlayTiles)을 합성한다.
  python3 render.py out/shopstreet.map.json <접두> [--overlay out/shopstreet.report.json]
→ verify-shots/jp-city/<접두>-1x.png(원본 16px) · <접두>-x3.png · (--overlay) <접두>-reach.png
층 순서: 1층 → 2층 → 3층 → 4층 (모두 같은 16px 칸, 알파 합성). 사람·그림자는 없다."""
import sys, os, json
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
SHEET = Image.open(os.path.join(ROOT, 'public/assets/jp-city/jp-city-chipset.png')).convert('RGBA')
COLS = SHEET.width // 16; T = 16          # 열 수는 시트 폭에서(48 → 96열 다시 놓기 2026-10-08)
def tile(i): return SHEET.crop(((i % COLS) * T, (i // COLS) * T, (i % COLS) * T + T, (i // COLS) * T + T))
def render(m):
    W, H = m['width'], m['height']
    img = Image.new('RGBA', (W * T, H * T), (0, 0, 0, 255))
    for key in ('lowerTiles', 'lowerOverlayTiles', 'upperTiles', 'upperOverlayTiles'):
        arr = m.get(key)
        if not arr: continue
        for i, t in enumerate(arr):
            if t is None or t < 0: continue
            img.alpha_composite(tile(t), ((i % W) * T, (i // W) * T))
    return img
if __name__ == '__main__':
    path, prefix = sys.argv[1], sys.argv[2]
    m = json.load(open(path))
    img = render(m)
    out = os.path.join(ROOT, 'verify-shots/jp-city'); os.makedirs(out, exist_ok=True)
    img.convert('RGB').save(os.path.join(out, prefix + '-1x.png'))
    img.convert('RGB').resize((img.width * 3, img.height * 3), Image.NEAREST).save(os.path.join(out, prefix + '-x3.png'))
    print(img.size)
