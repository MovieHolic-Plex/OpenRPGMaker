# Load MZ-style per-cell stacks into OPRN's four tile layers + shadow (no folding).
#
# reconstruct_preview.py keeps each cell as an MZ stack: A floor (+ A overlay) + shadow, then
# B..E/X objects. OPRN maps now have the same slots (src/project/mapLayers.ts):
#   layer 1 = lowerTiles          <- first A tile (or an opaque B..E base when the cell has no A)
#   layer 2 = lowerOverlayTiles   <- second A tile
#   shadow  = shadowBits          <- the shadow tile's quarter bits (bit0 TL, bit1 TR, bit2 BL, bit3 BR)
#   layer 3 = upperTiles          <- first B..E/X tile
#   layer 4 = upperOverlayTiles   <- second B..E/X tile
# A cell whose stack does not fit (three A tiles, two shadows or three objects) is listed and only
# that cell's overflowing group is folded back into one composite tile, exactly like fold_layers.py.
#   python3 scripts/content/rasak/stack_to_layers.py --baked ~/third-party-assets/rasak/baked/rasak_swamp \
#       --maps ~/third-party-assets/rasak/maps
# Writes atlas.layers.png / manifest.layers.json next to the atlas and <id>.layers.map.json next to
# each map of that bundle. Like every Rasak artefact these stay outside the repo.
import argparse, json, os, sys
from pathlib import Path
import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fold_layers import T, over  # noqa: E402


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

    def slot(t):
        return entries[t]['slot']

    def tile(i):
        return img[(i // cols) * T:(i // cols + 1) * T, (i % cols) * T:(i % cols + 1) * T].astype(np.float64)

    new_tiles, new_strips, index = [], [], {}

    def add(rgba):
        new_tiles.append(np.clip(np.round(rgba), 0, 255).astype(np.uint8))
        return n0 + len(new_tiles) - 1

    # Same composite (key, frame handling, entry shape) as fold_layers.py, so an overflow cell
    # draws pixel-for-pixel like the folded map did.
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

    report = []
    for path in sorted(maps_dir.glob('*.map.json')):
        if path.name.endswith(('.folded.map.json', '.layers.map.json')):
            continue
        m = json.loads(path.read_text())
        if m['tilesetId'] != manifest['bundle']:
            continue
        n = m['width'] * m['height']
        l1, l2, l3, l4, shadow = [-1] * n, [-1] * n, [-1] * n, [-1] * n, [0] * n
        overflow, five_plus = [], 0
        for i in range(n):
            lo = [m['lowerTiles'][i]] + m.get('lowerTileStacks', {}).get(str(i), [])
            up = ([m['upperTiles'][i]] if m['upperTiles'][i] >= 0 else []) + m.get('upperTileStacks', {}).get(str(i), [])
            five_plus += len(lo) + len(up) >= 5
            # lo[0] is the cell base: an A tile, or an opaque B..E tile when the cell has no A.
            base, rest = lo[0], lo[1:]
            a_tiles = [t for t in rest if slot(t) != 'shadow']
            shadows = [t for t in rest if slot(t) == 'shadow']
            lower_fits = len(a_tiles) <= 1 and len(shadows) <= 1
            upper_fits = len(up) <= 2
            if not (lower_fits and upper_fits):
                overflow.append({'cell': i, 'x': i % m['width'], 'y': i // m['width'],
                                 'lower': [slot(t) for t in lo], 'upper': [slot(t) for t in up],
                                 'folded': [g for g, ok in (('lower', lower_fits), ('upper', upper_fits)) if not ok]})
            if lower_fits:
                l1[i] = base
                l2[i] = a_tiles[0] if a_tiles else -1
                shadow[i] = entries[shadows[0]]['bits'] if shadows else 0
            else:
                l1[i] = composite(lo, 'lower')
            if upper_fits:
                l3[i] = up[0] if up else -1
                l4[i] = up[1] if len(up) > 1 else -1
            else:
                l3[i] = composite(up, 'upper')
        out = {k: v for k, v in m.items() if k not in ('lowerTileStacks', 'upperTileStacks')}
        out.update(lowerTiles=l1, upperTiles=l3)
        # Optional slots stay absent when empty (compactMapLayers in mapLayers.ts).
        if any(t >= 0 for t in l2):
            out['lowerOverlayTiles'] = l2
        if any(t >= 0 for t in l4):
            out['upperOverlayTiles'] = l4
        if any(shadow):
            out['shadowBits'] = shadow
        (maps_dir / path.name.replace('.map.json', '.layers.map.json')).write_text(json.dumps(out))
        report.append({'map': m['id'], 'cells': n, 'cellsWith5PlusTiles': five_plus,
                       'overflowCells': len(overflow), 'overflow': overflow,
                       'layer2': sum(t >= 0 for t in l2), 'layer4': sum(t >= 0 for t in l4),
                       'shadow': sum(1 for b in shadow if b)})

    total = n0 + len(new_tiles)
    total = (total + cols - 1) // cols * cols
    rows = total // cols
    out_img = np.zeros((rows * T, cols * T, 4), np.uint8)
    out_img[:img.shape[0]] = img
    for k, t in enumerate(new_tiles):
        i = n0 + k
        out_img[(i // cols) * T:(i // cols + 1) * T, (i % cols) * T:(i % cols + 1) * T] = t
    entries += [None] * (total - len(entries))
    Image.fromarray(out_img).save(baked / 'atlas.layers.png', optimize=True)
    layered = {**manifest, 'count': total, 'entries': entries, 'compositeStart': n0,
               'animationStrips': manifest['animationStrips'] + new_strips}
    (baked / 'manifest.layers.json').write_text(json.dumps(layered))
    print(json.dumps({'bundle': manifest['bundle'], 'composites': len(new_tiles), 'compositeStrips': len(new_strips),
                      'maps': report}, ensure_ascii=False))


if __name__ == '__main__':
    main()
