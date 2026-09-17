"""Rasterize the frozen DB-authored maps, including decorative charset overlays."""
import base64
import io
import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[2]
source = json.loads((root / 'src/project/regionReferences/ships.json').read_text())
out = root / 'public/assets/region-references'
out.mkdir(parents=True, exist_ok=True)

def transparent(im):
    im = im.convert('RGBA')
    im.putdata([(0, 0, 0, 0) if v[:3] == (255, 103, 139) else v for v in im.getdata()])
    return im

atlas = transparent(Image.open(root / 'public/assets/easyrpg-chipset-ship-transparent.png'))
entries = dict(zip(['bluewave-ship', 'bluewave-cabin', 'giant-ship', 'giant-cabin', 'wide-ship', 'wide-cabin', 'bluewave-harbor'],
                   ['map_bluewave_ship', 'map_bluewave_cabin', 'map_bluewave_giant', 'map_giant_cabin', 'map_bluewave_vertical', 'map_vertical_cabin', 'map_bluewave_harbor']))
for name, map_id in entries.items():
    m = source['maps'][map_id]
    w, h = m['width'], m['height']
    im = Image.new('RGBA', (w * 16, h * 16))
    for layer in ['lowerTiles', 'upperTiles']:
        for i, tile in enumerate(m[layer]):
            if tile >= 0:
                x, y = tile % 30 * 16, tile // 30 * 16
                im.alpha_composite(atlas.crop((x, y, x + 16, y + 16)), (i % w * 16, i // w * 16))
    for event in sorted(m['events'], key=lambda e: e['y']):
        sprite = event.get('sprite') or (event.get('pages') or [{}])[0].get('graphic', {}).get('sprite')
        if not sprite or sprite['type'] != 'uploaded':
            continue
        asset = source['assets'][sprite['id']]
        frame = transparent(Image.open(io.BytesIO(base64.b64decode(asset['dataUrl'].split(',')[1])))).crop((0, 0, 24, 32))
        im.alpha_composite(frame, (event['x'] * 16 - 4, event['y'] * 16 - 16))
    im.save(out / (name + '.png'))
