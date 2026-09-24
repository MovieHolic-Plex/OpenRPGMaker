# Render a folded map the way OPRN does (lower tile, then upper tile, nothing else) and
# score it against the creator preview. Independent of reconstruct_preview.py's renderer.
#   python3 scripts/content/rasak/verify_folded.py --baked <bundle dir> --map <id>.folded.map.json \
#       --preview <preview.png> --phase px,py --out <diff.png>
import argparse, json, os
from pathlib import Path
import numpy as np
from PIL import Image

T = 48


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--baked', required=True)
    ap.add_argument('--map', required=True)
    ap.add_argument('--preview', required=True)
    ap.add_argument('--phase', required=True)
    ap.add_argument('--out')
    a = ap.parse_args()
    baked = Path(os.path.expanduser(a.baked))
    man = json.loads((baked / 'manifest.folded.json').read_text())
    atlas = Image.open(baked / 'atlas.folded.png').convert('RGBA')
    cols = man['tilesPerRow']
    m = json.loads(Path(os.path.expanduser(a.map)).read_text())
    if m.get('lowerTileStacks') or m.get('upperTileStacks'):
        raise SystemExit('map still has tile stacks; OPRN would not draw them')
    canvas = Image.new('RGBA', (m['width'] * T, m['height'] * T), (0, 0, 0, 255))
    cache = {}

    def tile(i):
        if i not in cache:
            cache[i] = atlas.crop(((i % cols) * T, (i // cols) * T, (i % cols + 1) * T, (i // cols + 1) * T))
        return cache[i]

    for n in range(m['width'] * m['height']):
        x, y = (n % m['width']) * T, (n // m['width']) * T
        for layer in ('lowerTiles', 'upperTiles'):
            t = m[layer][n]
            if t >= 0:
                canvas.alpha_composite(tile(t), (x, y))
    px, py = map(int, a.phase.split(','))
    ox, oy = ((px % T) - T if px % T else 0), ((py % T) - T if py % T else 0)
    src = np.array(Image.open(os.path.expanduser(a.preview)).convert('RGB'))
    ren = np.array(canvas.convert('RGB'))[-oy:-oy + src.shape[0], -ox:-ox + src.shape[1]]
    d = np.abs(ren.astype(np.int16) - src.astype(np.int16)).max(2)
    res = {'map': m['id'], 'exact': round(float((d == 0).mean()), 6), 'near3': round(float((d <= 3).mean()), 6),
           'close32': round(float((d <= 32).mean()), 6), 'maxTile': max(max(m['lowerTiles']), max(m['upperTiles'])),
           'atlasCount': man['count']}
    if a.out:
        Image.fromarray(np.where((d == 0)[:, :, None], src // 3, np.array([255, 0, 100], np.uint8)).astype(np.uint8)).save(a.out)
    print(json.dumps(res))


if __name__ == '__main__':
    main()
