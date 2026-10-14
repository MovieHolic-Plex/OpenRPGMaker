#!/usr/bin/env python3
"""헤드리스 프로젝트 JSON 의 맵 하나를 원 해상도(타일 크기 그대로) PNG 로 그린다 — 던전 종류 감사·시험용.
   python3 scripts/content/render-project-map.py <project.json> <mapId> <out.png> [--scale N]
   층 순서: lowerTiles → lowerOverlayTiles → upperTiles → upperOverlayTiles. 번들 텍스처만(textureKey → public/assets 경로는 src/assets/bundled.ts 에서 읽는다)."""
import json, os, re, sys
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
def texture_paths():
    src = open(os.path.join(ROOT, 'src/assets/bundled.ts'), encoding='utf8').read()
    return {m.group(1): m.group(2) for m in re.finditer(r'textureKey:\s*"(tex_[A-Za-z0-9_]+)"\s*,\s*path:\s*"([^"]+)"', src)}
def main():
    proj = json.load(open(sys.argv[1])); mid = sys.argv[2]; out = sys.argv[3]
    scale = int(sys.argv[sys.argv.index('--scale') + 1]) if '--scale' in sys.argv else 1
    m = proj['maps'][mid]; ts = proj['tilesets'][m['tilesetId']]
    key = ts['image']['id']; paths = texture_paths()
    if key in paths: sheet_path = os.path.join(ROOT, 'public', paths[key])
    elif key.startswith('tex_monster_'): sheet_path = os.path.join(ROOT, 'public/assets/monster-kit', 'monster-' + key[len('tex_monster_'):] + '.png')
    else: sys.exit(f'텍스처 {key} 를 번들에서 못 찾음')
    sheet = Image.open(sheet_path).convert('RGBA')
    T = ts['tileSize']; per = ts['tilesPerRow']
    W, H = m['width'], m['height']
    im = Image.new('RGBA', (W * T, H * T), (12, 10, 18, 255))
    cache = {}
    def tile(t):
        if t not in cache:
            cache[t] = sheet.crop(((t % per) * T, (t // per) * T, (t % per) * T + T, (t // per) * T + T))
        return cache[t]
    for layer in ('lowerTiles', 'lowerOverlayTiles', 'upperTiles', 'upperOverlayTiles'):
        arr = m.get(layer)
        if not arr: continue
        for i, t in enumerate(arr):
            if t is None or t < 0: continue
            im.alpha_composite(tile(t), ((i % W) * T, (i // W) * T))
    if scale != 1: im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
    im.save(out); print(out, im.size)
main()
