#!/usr/bin/env python3
"""check-rooms.mts --json 이 쓴 엔진 칸 배열 → 원 해상도 PNG(구운 시트 칸을 그대로 붙인다, 1층→2층→3층→4층).
   python3 render_map.py check.json OUTDIR [--x 1]"""
import json, os, sys
from PIL import Image
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))
SHEET = Image.open(os.path.join(ROOT, 'public/assets/modern-city/modern-city-chipset.png')).convert('RGBA')
TPR = json.load(open(os.path.join(ROOT, 'src/assets/modernCitySheet.json')))['tilesPerRow']
_c = {}


def tile(t):
    if t not in _c: _c[t] = SHEET.crop(((t % TPR) * 16, (t // TPR) * 16, (t % TPR) * 16 + 16, (t // TPR) * 16 + 16))
    return _c[t]


def render(d):
    W, H = d['width'], d['height']
    im = Image.new('RGBA', (W * 16, H * 16), (0, 0, 0, 255))
    for layer in ('lower', 'lower2', 'upper', 'upper2'):
        for i, t in enumerate(d.get(layer) or []):
            if t is not None and t >= 0: im.alpha_composite(tile(t), ((i % W) * 16, (i // W) * 16))
    return im


if __name__ == '__main__':
    d = json.load(open(sys.argv[1]))['maps']; out = sys.argv[2]; os.makedirs(out, exist_ok=True)
    k = int(sys.argv[sys.argv.index('--x') + 1]) if '--x' in sys.argv else 1
    for mid, m in d.items():
        if 'width' not in m: continue
        im = render(m)
        if k > 1: im = im.resize((im.width * k, im.height * k), Image.NEAREST)
        im.save(os.path.join(out, mid + '.png'))
    print(len(d), 'maps →', out)
