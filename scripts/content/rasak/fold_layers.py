# Fold MZ-style per-cell stacks into OPRN's two layers.
#
# OPRN draws exactly one lower and one upper tile per cell (tile stacks are retired,
# see src/project/mapOverlayTiles.ts). reconstruct_preview.py keeps the MZ stacks
# (A floor + A overlay + shadow, then B..E objects); this step composites each
# multi-tile stack into one "scene composite" cell appended to the bundle atlas.
# Animated A1 bases stay animated: every frame is composited and registered as a strip.
#   python3 scripts/content/rasak/fold_layers.py --baked ~/third-party-assets/rasak/baked/rasak_field \
#       --maps ~/third-party-assets/rasak/maps
# Writes atlas.folded.png / manifest.folded.json next to the atlas and <id>.folded.map.json
# next to each map of that bundle. Like every Rasak artefact these stay outside the repo.
import argparse, json, os
from pathlib import Path
import numpy as np
from PIL import Image

T = 48


def over(dst, src):
    """Porter-Duff source-over on float RGBA in 0..255."""
    sa, da = src[..., 3:4] / 255.0, dst[..., 3:4] / 255.0
    oa = sa + da * (1 - sa)
    rgb = np.where(oa > 0, (src[..., :3] * sa + dst[..., :3] * da * (1 - sa)) / np.maximum(oa, 1e-9), 0)
    return np.concatenate([rgb, oa * 255.0], axis=-1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--baked', required=True)
    ap.add_argument('--maps', required=True)
    args = ap.parse_args()
    baked, maps_dir = Path(os.path.expanduser(args.baked)), Path(os.path.expanduser(args.maps))
    manifest = json.loads((baked / 'manifest.json').read_text())
    img = np.array(Image.open(baked / 'atlas.png').convert('RGBA'))
    cols, n0 = manifest['tilesPerRow'], manifest['count']
    entries = list(manifest['entries'])
    strips = {s['baseTile']: s for s in manifest['animationStrips']}

    def tile(i):
        return img[(i // cols) * T:(i // cols + 1) * T, (i % cols) * T:(i % cols + 1) * T].astype(np.float64)

    new_tiles, new_strips, index = [], [], {}

    def add(rgba):
        new_tiles.append(np.clip(np.round(rgba), 0, 255).astype(np.uint8))
        return n0 + len(new_tiles) - 1

    def composite(parts, layer):
        if len(parts) == 1:
            return parts[0]
        key = (layer, tuple(parts))
        if key in index:
            return index[key]
        strip = strips.get(parts[0])
        frames = strip['frames'] if strip else 1
        first = None
        for f in range(frames):
            acc = np.zeros((T, T, 4))
            for k, t in enumerate(parts):
                acc = over(acc, tile(t + f if k == 0 and strip else t))
            i = add(acc)
            entries.append({'slot': 'composite', 'layer': layer, 'frame': f,
                            'parts': [entries[t] and entries[t].get('mzTileId') for t in parts], 'partTiles': parts})
            first = i if first is None else first
        if strip:
            new_strips.append({'baseTile': first, 'frames': frames, 'fps': strip['fps']})
        index[key] = first
        return first

    folded_maps = []
    for path in sorted(maps_dir.glob('*.map.json')):
        if path.name.endswith('.folded.map.json'):
            continue
        m = json.loads(path.read_text())
        if m['tilesetId'] != manifest['bundle']:
            continue
        lower, upper = [], []
        for i in range(m['width'] * m['height']):
            lo = [m['lowerTiles'][i]] + m.get('lowerTileStacks', {}).get(str(i), [])
            up = ([m['upperTiles'][i]] if m['upperTiles'][i] >= 0 else []) + m.get('upperTileStacks', {}).get(str(i), [])
            lower.append(composite(lo, 'lower'))
            upper.append(composite(up, 'upper') if up else -1)
        out = {k: v for k, v in m.items() if k not in ('lowerTileStacks', 'upperTileStacks')}
        out.update(lowerTiles=lower, upperTiles=upper)
        (maps_dir / path.name.replace('.map.json', '.folded.map.json')).write_text(json.dumps(out))
        folded_maps.append(m['id'])

    total = n0 + len(new_tiles)
    total = (total + cols - 1) // cols * cols
    rows = total // cols
    out_img = np.zeros((rows * T, cols * T, 4), np.uint8)
    out_img[:img.shape[0]] = img
    for k, t in enumerate(new_tiles):
        i = n0 + k
        out_img[(i // cols) * T:(i // cols + 1) * T, (i % cols) * T:(i % cols + 1) * T] = t
    entries += [None] * (total - len(entries))
    Image.fromarray(out_img).save(baked / 'atlas.folded.png', optimize=True)
    folded = {**manifest, 'count': total, 'entries': entries, 'compositeStart': n0,
              'animationStrips': manifest['animationStrips'] + new_strips}
    (baked / 'manifest.folded.json').write_text(json.dumps(folded))
    print(json.dumps({'bundle': manifest['bundle'], 'maps': folded_maps, 'composites': len(new_tiles),
                      'compositeStrips': len(new_strips), 'size': [cols * T, rows * T]}))


if __name__ == '__main__':
    main()
